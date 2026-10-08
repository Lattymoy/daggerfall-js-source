// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 6.4; Mac: "Lets build every inch of this"): THE
// TAVERN'S REGULARS AT ILIAC HAND - pure, DOM-free. Section 6.4, DECIDED: "Offline against a patron who has a deck of his
// own (a deck per temperament, growing harder with the tavern's town)". Two things live here: a regular's DECK (built
// from the first set by his temper and the tavern's grade, the same deck every evening for the same regular) and his
// PLAY (the plays he commits each turn, read off the rules engine itself - he tries each play on a copy of the game and
// keeps the one that leaves the board best for him, which is how he learns every card's text without a line of it here).
//
// HE SEES WHAT A PLAYER SEES. A trial is played on a copy of the state with the other side passing, and judged through
// `iliacView` as his own seat sees it - never the other's hand, never a face-down card of theirs. The copy draws its
// next turn's card off his own deck; that card is never judged (the board alone is).
//
// THE TEMPERS are Hold'em's three (systems/cardPatrons.js PATRON_TEMPERS - one regular, one temper at both games):
//   tight    a temple-and-knights deck; weighs every holding alike and plays the best line he finds.
//   loose    beasts, orcs and giants; piles power on and likes a big board more than a close one.
//   bluffer  the dead and the Daedra; holds his hand back early, likes a veiled holding, and is harder to read.
// THE GRADE is the tavern's (`iliacGrade`, the Hold'em stakes' own bands of the building's quality): a village's
// regulars hold commons and magics and slip now and then; a town's add rares; a city's carry a legendary and a Prince
// and never slip.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { ILIAC_CARDS, cardById, ILIAC_TIERS, STARTER_DECK } from '../net/iliacCards.js';
import { ILIAC_DECK_SIZE, ILIAC_COPIES_MAX, ILIAC_LEGENDARY_COPIES_MAX, ILIAC_TURNS, ILIAC_HOLDINGS, deckValid, commit, reveal, iliacView, legalPlays, playsRefusal } from '../net/iliacHand.js';
import { TEMPER_NAMES } from './cardPatrons.js';
import { BOSS_CARD_IDS } from './bossCards.js';   // CARDS9: a boss's own card is found, never dealt
const BOSS_IDS = new Set(BOSS_CARD_IDS);

/** The tavern's grade by its building's quality (1..20): the Hold'em stakes' own bands (cardTableSession.js
 *  TABLE_STAKES - to 7, to 13, above). 0 a village's, 1 a town's, 2 a city's. */
export const ILIAC_GRADE_BANDS = Object.freeze([7, 13]);
export function iliacGrade(quality) {
  const q = Math.max(1, Math.min(20, Math.round(Number(quality) || 1)));
  return q <= ILIAC_GRADE_BANDS[0] ? 0 : q <= ILIAC_GRADE_BANDS[1] ? 1 : 2;
}

/** MEASURE (CARDS10): the tiers a grade's decks are drawn from, and how many of each above magic a deck may carry. */
export const GRADE_TIERS = Object.freeze([
  Object.freeze({ common: 30, magic: 30 }),
  Object.freeze({ common: 30, magic: 30, rare: 3 }),
  Object.freeze({ common: 30, magic: 30, rare: 4, legendary: 2, aetheric: 1 }),
]);
/** MEASURE (CARDS10): how often a regular takes a good play instead of his best, by grade. */
export const GRADE_SLIP = Object.freeze([0.25, 0.1, 0]);

/** Each temper's deck: the tags he builds round (a card wearing one is his kind), the spells he favours, and his play -
 *  `scale` how close a holding's margin is weighed (the larger, the more he likes a big lead), `greed` his liking for
 *  power on the board, `hold` the turns he holds his hand to one play, `veil` his liking for a veiled holding. */
export const ILIAC_TEMPERS = Object.freeze({
  tight: Object.freeze({ tags: Object.freeze(['knight', 'temple', 'priest', 'guild', 'noble']), spells: Object.freeze(['heal', 'recall', 'turn-undead', 'banish-daedra']), scale: 3, greed: 0, hold: 0, veil: 0 }),
  loose: Object.freeze({ tags: Object.freeze(['beast', 'orc', 'giant', 'were', 'warrior', 'centaur', 'sea']), spells: Object.freeze(['fireball', 'shock', 'frostbite']), scale: 5, greed: 0.04, hold: 0, veil: 0 }),
  bluffer: Object.freeze({ tags: Object.freeze(['undead', 'vampire', 'daedra', 'thief', 'assassin', 'atronach', 'fey']), spells: Object.freeze(['animate-dead', 'shock', 'recall']), scale: 3, greed: 0.01, hold: 2, veil: 0.35 }),
});
/** One regular, one temper at both games: Iliac Hand's tempers are Hold'em's names, pinned equal. */
export const ILIAC_TEMPER_NAMES = Object.freeze(Object.keys(ILIAC_TEMPERS));

/** A small seeded source (mulberry32) - a regular's deck is his seed's, the same every evening; never the game's dice. */
export function seededUnit(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** MEASURE (CARDS10): how many of the starter deck's thirty a regular trades for a card of his kind, by grade - flavour,
 *  not strength. CARDS10's sims found the curve is the game (in six turns of one to six magicka a deck of cheap cards
 *  beat any deck of dear ones, the starter deck among them) and a card is strong only in a deck that suits it: so a
 *  regular's deck is the starter deck's curve, card for card at the same cost, his kind's traded in. */
export const GRADE_SWAPS = Object.freeze([6, 3, 2]);
/** MEASURE (CARDS10): each temper's upgrades - his kind's cards that each won over the starter deck's own in the sims
 *  (eighty games each, both seats: Azura 48-28, Mehrunes Dagon 46-33, Daedroth 49-31, the Orc Shaman 46-31, the
 *  Werewolf 45-33, the Daedra Seducer 43-33, the Knight of the Flame 42-35, the Wraith 42-37, King Gothryd 41-36, the
 *  Dragonling 41-34, Hircine 40-37) - his Prince first. A town's regular carries the first two that are not Princes; a
 *  city's, his Prince and all of them. */
export const TEMPER_UPGRADES = Object.freeze({
  tight: Object.freeze(['azura', 'knight-of-the-flame', 'king-gothryd']),
  loose: Object.freeze(['hircine', 'werewolf', 'orc-shaman', 'dragonling']),
  bluffer: Object.freeze(['mehrunes-dagon', 'daedroth', 'daedra-seducer', 'wraith']),
});

/**
 * A REGULAR'S DECK: thirty ids the rules take (deckValid) - the starter deck, his grade's upgrades (TEMPER_UPGRADES: a
 * town's two, a city's Prince and all) each in place of the starter's card of its cost (a Prince for a four), then
 * GRADE_SWAPS of the rest traded for a card of his kind at the same cost (his kind six times as likely, his spells three
 * for a spell); never more of a tier above magic than the grade allows, never an artifact (the Princes' gifts are found,
 * not dealt) or a boss's own. The same seed, temper and grade build the same deck.
 * @param {number} seed @param {string} temper @param {number} grade
 * @returns {string[]}
 */
export function patronDeck(seed, temper, grade) {
  const g = Math.max(0, Math.min(2, grade | 0));
  const tp = ILIAC_TEMPERS[temper] ? temper : 'tight';
  const T = ILIAC_TEMPERS[tp];
  const caps = GRADE_TIERS[g];
  const u = seededUnit(seed);
  const deck = [...STARTER_DECK];
  const fixed = new Set();
  const count = new Map();
  const tiers = {};
  const tally = (id, d) => { count.set(id, (count.get(id) ?? 0) + d); const t = cardById(id).tier; tiers[t] = (tiers[t] ?? 0) + d; };
  for (const id of deck) tally(id, 1);
  const room = (c) => {
    const most = ILIAC_TIERS.indexOf(c.tier) >= ILIAC_TIERS.indexOf('legendary') ? ILIAC_LEGENDARY_COPIES_MAX : ILIAC_COPIES_MAX;
    return (count.get(c.id) ?? 0) < most && (tiers[c.tier] ?? 0) < (caps[c.tier] ?? 0);
  };
  const swap = (at, id) => { tally(deck[at], -1); tally(id, 1); deck[at] = id; fixed.add(at); };
  const ups = TEMPER_UPGRADES[tp].filter((id) => (g === 2 ? true : g === 1 ? cardById(id).kind !== 'prince' : false));
  for (const id of g === 1 ? ups.slice(0, 2) : ups) {
    const c = cardById(id);
    if (!c || !room(c)) continue;
    // its own cost's place, else the dearest below it (the starter deck stops at four; a Prince always takes a four's)
    const want = c.kind === 'prince' ? 4 : c.cost;
    let at = -1;
    for (let cost = want; cost >= 1 && at < 0; cost--) at = deck.findIndex((x, i) => !fixed.has(i) && cardById(x).cost === cost && cardById(x).kind !== 'spell');
    if (at >= 0) swap(at, id);
  }
  const pool = ILIAC_CARDS.filter((c) => c.kind === 'unit' || c.kind === 'spell').filter((c) => c.tier !== 'artifact' && caps[c.tier] !== undefined && !BOSS_IDS.has(c.id));
  const weight = (c) => (c.kind === 'spell' ? (T.spells.includes(c.id) ? 3 : 0.3) : c.tags.some((t) => T.tags.includes(t)) ? 6 : 1);
  const order = deck.map((_, i) => i).filter((i) => !fixed.has(i));
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(u() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const at of order.slice(0, GRADE_SWAPS[g])) {
    const was = cardById(deck[at]);
    const open = pool.filter((c) => c.cost === was.cost && c.id !== was.id && room(c) && (c.kind === 'spell') === (was.kind === 'spell'));
    if (!open.length) continue;
    const w = open.map(weight);
    let r = u() * w.reduce((a, b) => a + b, 0);
    let k = 0;
    while (k < open.length - 1 && r >= w[k]) { r -= w[k]; k++; }
    swap(at, open[k].id);
  }
  return deck.sort();
}

/**
 * How a board looks to seat `p` - the score his trials are judged by. Each holding's margin as he can see it, weighed by
 * tanh(margin / scale) (a lead of a few counts nearly as much as a large one, for a tight player), his total power at
 * `greed` a point, and on the last turn two holdings held weighed above all.
 * @param {any} view  iliacView(state, p)
 * @param {number} p @param {any} T  the temper's numbers
 */
export function boardScore(view, p, T) {
  let s = 0, held = 0, mine = 0;
  for (const hd of view.holdings) {
    const m = hd.power[p] - hd.power[1 - p];
    s += Math.tanh(m / T.scale);
    if (m > 0) held++;
    mine += hd.power[p];
  }
  s += T.greed * mine;
  if (view.over || view.turn > ILIAC_TURNS) s += held >= 2 ? 4 : 0;
  return s;
}

/** A trial: `plays` committed on a copy with the other side passing, the turn revealed, judged as seat `p` sees it. */
function trial(state, p, plays, T) {
  const copy = structuredClone(state);
  copy.players[1 - p].plays = null;
  if (commit(copy, p, plays) !== null || commit(copy, 1 - p, []) !== null) return -Infinity;
  reveal(copy);
  const v = iliacView(copy, p);
  let s = boardScore(v, p, T);
  for (const x of plays) if (T.veil && state.holdings[x.holding] && copy.holdings[x.holding]) s += vetoVeil(state, x.holding) ? T.veil : 0;
  return s;
}
/** Whether holding `h` lays its cards face down (its own rule). */
const vetoVeil = (state, h) => !!cardById(state.holdings[h].id)?.fx?.some((f) => f.on === 'ongoing' && f.do === 'veil');

/** MEASURE (CARDS10): the most trials one decision plays - a hand of seven at three holdings is 21 a step. */
export const ILIAC_THINK_TRIALS = 400;

/**
 * A REGULAR'S PLAYS for this turn, built a play at a time: from no plays, each step tries every single play the rules
 * still take beside the ones chosen and keeps the best, until none makes the board better - a slip (the grade's) takes a
 * good one instead of the best. A bluffer holds to one play in his first `hold` turns. Answers a commit list the rules
 * take (playsRefusal null) - an empty one passes.
 * @param {any} state @param {number} p @param {string} temper @param {number} grade @param {() => number} unit  [0,1)
 */
export function patronPlays(state, p, temper, grade, unit) {
  const T = ILIAC_TEMPERS[temper] ?? ILIAC_TEMPERS.tight;
  const slip = GRADE_SLIP[Math.max(0, Math.min(2, grade | 0))];
  const most = T.hold && state.turn <= T.hold ? 1 : Infinity;
  let chosen = [], best = trial(state, p, [], T), trials = 1;
  while (chosen.length < most && trials < ILIAC_THINK_TRIALS) {
    const used = new Set(chosen.map((x) => x.card));
    const options = [];
    for (const one of legalPlays(state, p)) {
      if (used.has(one.card)) continue;
      const next = [...chosen, one];
      if (playsRefusal(state, p, next) !== null) continue;
      if (++trials > ILIAC_THINK_TRIALS) break;
      options.push({ plays: next, score: trial(state, p, next, T) });
    }
    const better = options.filter((o) => o.score > best + 1e-9).sort((a, b) => b.score - a.score);
    if (!better.length) break;
    const pick = slip > 0 && better.length > 1 && unit() < slip ? better[1 + Math.floor(unit() * (better.length - 1))] : better[0];
    chosen = pick.plays;
    best = pick.score;
  }
  return chosen;
}

/** The card a beaten regular pays: one of his deck's, drawn by the table's source. */
export function forfeitCard(deck, unit) {
  return Array.isArray(deck) && deck.length ? deck[Math.floor(unit() * deck.length) % deck.length] : null;
}

/** A regular's deck is sound for his grade (the rules' law, and no tier past it) - the pins' and the session's check. */
export function patronDeckSound(deck, grade) {
  if (deckValid(deck) !== null) return false;
  const caps = GRADE_TIERS[Math.max(0, Math.min(2, grade | 0))];
  const by = {};
  for (const id of deck) { const t = cardById(id).tier; by[t] = (by[t] ?? 0) + 1; }
  return Object.entries(by).every(([t, n]) => (caps[t] ?? 0) >= n);
}

/** Hold'em's tempers and Iliac Hand's are the same three names (one regular, one temper). */
export const TEMPERS_AGREE = TEMPER_NAMES.length === ILIAC_TEMPER_NAMES.length && TEMPER_NAMES.every((n) => ILIAC_TEMPER_NAMES.includes(n));
export { ILIAC_HOLDINGS };
