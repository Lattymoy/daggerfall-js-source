// @ts-check
// CARDS7 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 6; Mac: "Iliac Hand as proposed"): THE RULES OF ILIAC
// HAND - the collectible game's engine, pure, DOM-free and plain-data (structuredClone-safe, the way holdemTable's table
// is), one home for both ends: the tavern's patrons will play by it offline and the relay will run it online (CARDS10),
// so it imports nothing outside `net/` - the catalog beside it (`net/iliacCards.js`), the cards' shuffle
// (`net/cardLaw.js`) and the dice's unbiased draw (`net/dice.js`). Nothing here draws, sounds or waits.
//
// THE GAME (section 6.1, DECIDED; its numbers MEASURE until CARDS10 plays them against patrons). Two players, each a
// deck of ILIAC_DECK_SIZE cards (at most ILIAC_COPIES_MAX of a card, ILIAC_LEGENDARY_COPIES_MAX of one of the legendary
// tier or above). THREE HOLDINGS - location cards of the Iliac Bay - lie between them, drawn at the start. MAGICKA pays
// for cards: one on the first turn, one more each turn, never past ILIAC_MAGICKA_MAX (six turns reach six; the cap
// stands anyway, for the magicka a card gives). A hand starts at ILIAC_HAND_START and draws one at the start of every
// later turn, never past ILIAC_HAND_MAX (a draw into a full hand stays on the deck). After ILIAC_TURNS turns a player
// HOLDS a holding whose power there is higher; two of three win; a split or a tie goes to the higher power across all
// three; still level, a draw.
//
// THE TURN IS SIMULTANEOUS - which is what lets the relay run it. Each player COMMITS his plays hidden (`commit`, a list
// of `{card: handIndex, holding}`, checked whole: the hand, the magicka, the room); when both have, `reveal` turns them
// over together. The player with more power on the board reveals first (a tie: player 0), and his plays resolve one by
// one in the order he listed them, each card's own "Reveal:" text as it lands; then the other's. Then every card's "End
// of turn:" text, holding by holding, the first revealer's side first, oldest first; then the holdings' own. Then the
// next turn: its magicka, its draw. Nothing in a turn draws on the random source - the only draws are the shuffles and
// the holdings, at `newGame` - so a game is the same game wherever it is replayed from the same plays and the same
// `rand32` (THE RELAY ROLLS: online that is its CSPRNG, never a client's number).
//
// A SIDE OF A HOLDING STANDS AT MOST ILIAC_ROOM CARDS (a holding's own text may say fewer). A unit or a prince stands
// there until destroyed; a spell is played to a holding, resolves, and goes to its owner's discard - it takes no room.
// A Prince is a unit whose "Ongoing:" text rules the whole board while it stands.
//
// THE EFFECT LANGUAGE. A card's text is data: `fx`, a list of records `{on, do, to?, n?, tag?, cost?, pick?, card?,
// kind?}` - WHEN (`on`: ILIAC_TRIGGERS), WHAT (`do`: ILIAC_VERBS), TO WHOM (`to`: ILIAC_TARGETS, narrowed by `tag`, by
// `cost` [lo, hi] and to one card by `pick`: ILIAC_PICKS). `fxText` says a list in the player's words, and the catalog's
// every `text` is pinned to be exactly that sentence (test/cards8_catalog.test.js), so what a card says is what it does.
// A holding's text is the same language, aimed at both sides of it (`to: 'here'`). The verbs:
//   buff / weaken  +n / -n power: for good on a trigger (a weaken never takes a card's power below 0), while the
//                  source stands when `ongoing` (the total is floored at 0 too).
//   destroy        to its owner's discard (a summoned token is gone).          move     to the next holding with room.
//   draw / magicka n cards now / +n magicka next turn, for the source's owner. summon   n tokens of `card` here.
//   transform      the target becomes `card` (its power and text), keeping its own identity for the discard.
//   room / veil / nospell / discount   the rules a holding (or a prince's ongoing text) bends.
// Ties in a `pick` go to the card met first: holdings in order, the source's owner's side first, oldest first.
//
// A FACE-DOWN CARD (played to a veiled holding) has no text until the game ends: it reveals nothing, it is never a
// target, nothing ongoing touches it, and the other player is told only that a card lies there. It counts its own
// power at the end, when every face-down card is unveiled and the board is tallied whole - its POWER alone: its own
// text never runs, its ongoing text included (AUDIT CARDS-5 A2: a face-down Prince ruled the final count it never ruled
// in play), while the board's ongoing rules reach it as any card standing there. A card MOVED to a veiled holding came
// face up and stays so (the veil hides what is played there).
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { shuffleDeck } from './cardLaw.js';
import { drawBelow } from './dice.js';
import { cardById, ILIAC_CARDS, ILIAC_LOCATIONS, ILIAC_TAGS, ILIAC_TIERS } from './iliacCards.js';

/** MEASURE (section 6.1): a deck's size, the copies of one card, the copies of a legendary-or-higher card. */
export const ILIAC_DECK_SIZE = 30;
export const ILIAC_COPIES_MAX = 2;
export const ILIAC_LEGENDARY_COPIES_MAX = 1;
/** MEASURE (section 6.1): the turns a game lasts, and the magicka's ceiling (six turns reach six; with a card's gift a turn
 *  reaches ten at most - AUDIT CARDS-5 A4). */
export const ILIAC_TURNS = 6;
export const ILIAC_MAGICKA_MAX = 10;
/** MEASURE (CARDS7): the opening hand and the most a hand holds. */
export const ILIAC_HAND_START = 4;
export const ILIAC_HAND_MAX = 7;
/** The holdings between the players, and the cards one side of a holding stands (MEASURE). */
export const ILIAC_HOLDINGS = 3;
export const ILIAC_ROOM = 4;

/** THE EFFECT LANGUAGE's words - the engine knows these and no others (fxValid). */
export const ILIAC_TRIGGERS = Object.freeze(['reveal', 'ongoing', 'end']);
export const ILIAC_VERBS = Object.freeze(['buff', 'weaken', 'destroy', 'move', 'draw', 'magicka', 'summon', 'transform', 'room', 'veil', 'nospell', 'discount']);
export const ILIAC_TARGETS = Object.freeze(['self', 'here.mine', 'here.theirs', 'here.all', 'all.mine', 'all.theirs', 'here']);
export const ILIAC_PICKS = Object.freeze(['weakest', 'strongest']);

/** Which verbs each trigger may carry: the triggered ones act once, the ongoing ones hold while their source stands. */
const TRIGGERED_VERBS = Object.freeze(['buff', 'weaken', 'destroy', 'move', 'draw', 'magicka', 'summon', 'transform']);
const ONGOING_VERBS = Object.freeze(['buff', 'weaken', 'room', 'veil', 'nospell', 'discount']);
/** The verbs that are a holding's rule alone, and the verbs that need a target. */
const HOLDING_RULES = Object.freeze(['room', 'veil', 'nospell']);
const TARGETED = Object.freeze(['buff', 'weaken', 'destroy', 'move', 'transform']);
/** A move carries a card of the mover's own - never an enemy's into a side he does not keep. */
const OWN_TARGETS = Object.freeze(['self', 'here.mine', 'all.mine']);
const LEGENDARY_RANK = ILIAC_TIERS.indexOf('legendary');

// ── THE EFFECT LANGUAGE, SAID ─────────────────────────────────────────────────────────────────────────────────────

const NUMBER_WORDS = Object.freeze(['no', 'a', 'two', 'three', 'four']);
const an = (name) => (/^[AEIOU]/.test(name) ? `an ${name}` : `a ${name}`);
/** AUDIT CARDS-5 A5: a card's name made plural - its head noun ("Priests of Arkay", "Rats", "Harpies"). */
const pluralWord = (w) => (/(s|x|ch|sh)$/.test(w) ? `${w}es` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`);
const plural = (name) => { const ws = name.split(' '); const k = ws.indexOf('of') > 0 ? ws.indexOf('of') - 1 : ws.length - 1; ws[k] = pluralWord(ws[k]); return ws.join(' '); };

/** "that cost 1 or 2", "that costs 4 or more" - a `cost` [lo, hi] filter said (hi at the magicka's ceiling is open). */
function costWords([lo, hi], one) {
  const verb = one ? 'costs' : 'cost';
  if (lo === hi) return ` that ${verb} ${lo}`;
  if (hi >= ILIAC_MAGICKA_MAX) return ` that ${verb} ${lo} or more`;
  if (lo <= 0) return ` that ${verb} ${hi} or less`;
  return hi === lo + 1 ? ` that ${verb} ${lo} or ${hi}` : ` that ${verb} ${lo} to ${hi}`;
}

/** The target said, and whether it is one card (the verb's number follows it). */
function targetWords(fx) {
  if (fx.to === 'self') return { words: 'this', one: true };
  const one = !!fx.pick;
  const noun = (fx.tag ? `${fx.tag} unit` : 'unit') + (one ? '' : 's');
  const cost = fx.cost ? costWords(fx.cost, one) : '';
  const p = fx.pick ? `${fx.pick} ` : '';
  const words = {
    'here.mine': one ? `your ${p}${noun} here${cost}` : `your ${noun} here${cost}`,
    'here.theirs': one ? `the ${p}enemy ${noun} here${cost}` : `enemy ${noun} here${cost}`,
    'here.all': one ? `the ${p}${noun} here${cost}` : `${noun} here${cost}`,
    'all.mine': one ? `your ${p}${noun}${cost}` : `your ${noun}${cost}`,
    'all.theirs': one ? `the ${p}enemy ${noun}${cost}` : `enemy ${noun}${cost}`,
    here: one ? `the ${p}${noun} on each side here${cost}` : `${noun} here${cost}`,
  }[fx.to];
  return { words, one };
}

/** One record's clause, without its trigger. `kind` the card's (a holding speaks of "its owner"). */
function clause(fx, kind) {
  const loc = kind === 'location';
  const t = TARGETED.includes(fx.do) ? targetWords(fx) : null;
  const n = fx.n ?? 1;
  switch (fx.do) {
    case 'buff': return fx.on === 'ongoing' ? `${t.words} ${t.one ? 'has' : 'have'} +${n} power` : `${t.words} ${t.one ? 'gains' : 'gain'} +${n} power`;
    case 'weaken': return fx.on === 'ongoing' ? `${t.words} ${t.one ? 'has' : 'have'} -${n} power` : `${t.words} ${t.one ? 'loses' : 'lose'} ${n} power`;
    case 'destroy': return `destroy ${t.words}`;
    case 'move': return `move ${t.words} to the next holding round the table with room`;   // AUDIT CARDS-5 A7: it wraps from the last to the first
    case 'transform': return `turn ${t.words} into ${an(cardById(fx.card)?.name ?? '?')}`;
    case 'summon': {
      const name = cardById(fx.card)?.name ?? '?';
      const many = n === 1 ? an(name) : `${NUMBER_WORDS[n] ?? n} ${plural(name)}`;
      return loc ? `its owner summons ${many} here` : `summon ${many} here`;   // AUDIT CARDS-5 A5: a location's summon is its owner's
    }
    case 'draw': {
      const cards = n === 1 ? 'a card' : `${n} cards`;
      return loc ? `its owner draws ${cards}` : `draw ${cards}`;
    }
    case 'magicka': return loc ? `its owner gains +${n} magicka next turn` : `gain +${n} magicka next turn`;
    case 'room': return `each side holds only ${n === 1 ? 'one card' : `${n} cards`} here`;   // AUDIT CARDS-5 A5
    case 'veil': return 'cards here are played face down and unveiled when the game ends';
    case 'nospell': return 'spells cannot be played here';
    case 'discount': return loc ? `${fx.kind}s played here cost ${n} less` : `your ${fx.kind}s cost ${n} less`;
    default: return '?';
  }
}

/** A trigger's lead-in, by the kind of card that carries it. */
function lead(on, kind) {
  if (on === 'end') return 'End of turn: ';
  if (kind === 'spell') return '';
  if (kind === 'location') return on === 'reveal' ? 'After a card is revealed here, ' : '';
  return on === 'reveal' ? 'Reveal: ' : 'Ongoing: ';
}

const joinAnd = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`);

/**
 * A card's effect list in the player's words - the one sentence its `text` must be. Consecutive records under one
 * trigger share it ("End of turn: X and Y."); a holding's ongoing rules are sentences of their own.
 * @param {readonly any[]} fx @param {string} kind
 */
export function fxText(fx, kind) {
  const out = [];
  for (let i = 0; i < fx.length;) {
    const on = fx[i].on, pre = lead(on, kind);
    const group = [];
    do group.push(clause(fx[i], kind)); while (++i < fx.length && fx[i].on === on && (pre || kind === 'spell'));
    const s = pre + joinAnd(group);
    out.push(s[0].toUpperCase() + s.slice(1) + '.');
  }
  return out.join(' ');
}

/**
 * Is this record a sentence of the language, carried by a card of `kind` - its trigger, its verb, its target, its
 * filters, its numbers all ones the engine reads. Answers null, or the word for what is wrong.
 * @param {any} fx @param {string} kind
 */
export function fxRefusal(fx, kind) {
  if (!fx || typeof fx !== 'object') return 'shape';
  const loc = kind === 'location';
  if (!ILIAC_TRIGGERS.includes(fx.on)) return 'trigger';
  if (!ILIAC_VERBS.includes(fx.do)) return 'verb';
  if (!(fx.on === 'ongoing' ? ONGOING_VERBS : TRIGGERED_VERBS).includes(fx.do)) return 'verb';
  if (kind === 'spell' && fx.on !== 'reveal') return 'trigger';
  if (HOLDING_RULES.includes(fx.do) && !loc) return 'verb';
  if (loc && fx.on === 'end' && (fx.do === 'draw' || fx.do === 'magicka')) return 'verb';   // a holding has no owner at the turn's end
  if (fx.n !== undefined && !(Number.isInteger(fx.n) && fx.n >= 1 && fx.n <= ILIAC_MAGICKA_MAX)) return 'n';
  if ((fx.do === 'room' || fx.do === 'discount') && fx.n === undefined) return 'n';
  const aims = TARGETED.includes(fx.do);
  if (aims) {
    if (!ILIAC_TARGETS.includes(fx.to)) return 'target';
    if (loc !== (fx.to === 'here')) return 'target';
    if (fx.to === 'self' && kind === 'spell') return 'target';
  } else if (fx.to !== undefined) return 'target';
  if (fx.do === 'move' && !OWN_TARGETS.includes(fx.to)) return 'target';
  if (fx.pick !== undefined && (!ILIAC_PICKS.includes(fx.pick) || !aims || fx.on === 'ongoing' || fx.to === 'self')) return 'pick';
  if (fx.tag !== undefined && (!ILIAC_TAGS.includes(fx.tag) || !aims || fx.to === 'self')) return 'tag';
  if (fx.cost !== undefined && !(Array.isArray(fx.cost) && fx.cost.length === 2 && fx.cost.every(Number.isInteger) && fx.cost[0] <= fx.cost[1] && aims && fx.to !== 'self')) return 'cost';
  if (fx.do === 'summon' || fx.do === 'transform') {
    const c = cardById(fx.card);
    if (!c || c.kind !== 'unit') return 'card';
  } else if (fx.card !== undefined) return 'card';
  if (fx.do === 'discount' ? fx.kind !== 'spell' : fx.kind !== undefined) return 'kind';
  if (fx.do === 'discount' && !loc && fx.to !== undefined) return 'target';
  return null;
}

// ── THE DECK ──────────────────────────────────────────────────────────────────────────────────────────────────────

const PLAYABLE = new Set(ILIAC_CARDS.map((c) => c.id));

/**
 * A deck's refusal, or null for one the table takes: 'size' (not ILIAC_DECK_SIZE ids), 'unknown card' (an id the
 * catalog does not deal - a holding is not a deck's), 'legendary' (two of one legendary-or-higher card), 'copies'
 * (three of one).
 * @param {any} ids
 */
export function deckValid(ids) {
  if (!Array.isArray(ids) || ids.length !== ILIAC_DECK_SIZE) return 'size';
  const counts = new Map();
  for (const id of ids) {
    if (typeof id !== 'string' || !PLAYABLE.has(id)) return 'unknown card';
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, k] of counts) {
    if (ILIAC_TIERS.indexOf(cardById(id).tier) >= LEGENDARY_RANK && k > ILIAC_LEGENDARY_COPIES_MAX) return 'legendary';
    if (k > ILIAC_COPIES_MAX) return 'copies';
  }
  return null;
}

// ── THE BOARD ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The card an instance is now (a transformed one is its new form). */
const cardOf = (inst) => cardById(inst.form ?? inst.id);
const holdingCard = (state, h) => cardById(state.holdings[h].id);
const holdingRule = (state, h, verb) => holdingCard(state, h).fx.find((f) => f.on === 'ongoing' && f.do === verb) ?? null;
/** The cards one side of holding `h` stands. */
export const holdingRoomOf = (state, h) => holdingRule(state, h, 'room')?.n ?? ILIAC_ROOM;
const veiled = (state, h) => !!holdingRule(state, h, 'veil');
const noSpells = (state, h) => !!holdingRule(state, h, 'nospell');

/** Where a card stands: {h, p, i, inst}, or null. */
function find(state, uid) {
  for (let h = 0; h < ILIAC_HOLDINGS; h++) for (let p = 0; p < 2; p++) {
    const i = state.holdings[h].sides[p].findIndex((x) => x.uid === uid);
    if (i >= 0) return { h, p, i, inst: state.holdings[h].sides[p][i] };
  }
  return null;
}

/** The free room on player `p`'s side of `h`, less the plays of his still on their way there this reveal (`T.res`). */
const freeRoom = (state, T, p, h) => holdingRoomOf(state, h) - state.holdings[h].sides[p].length - (T ? T.res[p][h] : 0);

/** The refs on one side of one holding. */
const sideRefs = (state, h, p) => state.holdings[h].sides[p].map((inst, i) => ({ h, p, i, inst }));

/**
 * The cards a record reaches, from `ctx` - {p: its source's owner (null for a holding), h: where it acts, uid: the
 * source card (null for a spell gone or a holding)}. A face-down card is never reached. `pw` (powers) when it picks.
 */
function select(state, ctx, fx, pw) {
  if (fx.to === 'self') {
    const r = find(state, ctx.uid);
    return r && !r.inst.down ? [r] : [];
  }
  const { p, h } = ctx;
  const all = (q) => [0, 1, 2].flatMap((hh) => sideRefs(state, hh, q));
  const groups = {
    'here.mine': () => [sideRefs(state, h, p)],
    'here.theirs': () => [sideRefs(state, h, 1 - p)],
    'here.all': () => [[...sideRefs(state, h, p), ...sideRefs(state, h, 1 - p)]],
    'all.mine': () => [all(p)],
    'all.theirs': () => [all(1 - p)],
    here: () => [sideRefs(state, h, 0), sideRefs(state, h, 1)],
  }[fx.to]();
  const fits = (inst) => {
    if (inst.down) return false;
    const c = cardOf(inst);
    return (!fx.tag || c.tags.includes(fx.tag)) && (!fx.cost || (c.cost >= fx.cost[0] && c.cost <= fx.cost[1]));
  };
  const kept = groups.map((g) => g.filter((r) => fits(r.inst)));
  if (!fx.pick) return kept.flat();
  return kept.flatMap((g) => {
    if (!g.length) return [];
    let best = g[0];
    for (const r of g) if (fx.pick === 'weakest' ? pw[r.inst.uid] < pw[best.inst.uid] : pw[r.inst.uid] > pw[best.inst.uid]) best = r;
    return [best];
  });
}

/**
 * EVERY CARD'S POWER NOW: its card's power, what triggers gave or took (`mod`), and every ongoing buff and weaken of
 * the face-up cards and the holdings that reach it, the total floored at 0. A face-down card counts its card's power
 * alone. Answers {uid: power}.
 * @param {any} state
 */
export function powers(state) {
  const pw = {};
  const each = (fn) => state.holdings.forEach((hd, h) => hd.sides.forEach((side, p) => side.forEach((inst) => fn(inst, h, p))));
  each((inst) => { pw[inst.uid] = cardOf(inst).power + (inst.mod ?? 0); });
  const apply = (ctx, fx) => {
    if (fx.on !== 'ongoing' || (fx.do !== 'buff' && fx.do !== 'weaken')) return;
    for (const r of select(state, ctx, fx, null)) pw[r.inst.uid] += fx.do === 'buff' ? fx.n : -fx.n;
  };
  each((inst, h, p) => { if (!inst.down && !inst.unveiled) for (const fx of cardOf(inst).fx) apply({ p, h, uid: inst.uid }, fx); });   // AUDIT CARDS-5 A2: nor one unveiled at the end
  for (let h = 0; h < ILIAC_HOLDINGS; h++) for (const fx of holdingCard(state, h).fx) apply({ p: null, h, uid: null }, fx);
  for (const k of Object.keys(pw)) pw[k] = Math.max(0, pw[k]);
  return pw;
}

/**
 * What a card costs player `p` to play at holding `h`: its cost, less the holding's discount and his own face-up
 * cards' ongoing discounts for its kind, never below 0.
 * @param {any} state @param {number} p @param {any} card @param {number} h
 */
export function costOf(state, p, card, h) {
  let off = 0;
  for (const fx of holdingCard(state, h).fx) if (fx.on === 'ongoing' && fx.do === 'discount' && fx.kind === card.kind) off += fx.n;
  for (let hh = 0; hh < ILIAC_HOLDINGS; hh++) for (const inst of state.holdings[hh].sides[p]) {
    if (inst.down) continue;
    for (const fx of cardOf(inst).fx) if (fx.on === 'ongoing' && fx.do === 'discount' && fx.kind === card.kind) off += fx.n;
  }
  return Math.max(0, card.cost - off);
}

/**
 * A side's power at a holding, counting the cards `seen` lets in (all of them, unless told).
 * @param {any} state @param {Record<string, number>} pw @param {number} h @param {number} p
 * @param {(inst: any) => boolean} [seen]
 */
function sidePower(state, pw, h, p, seen = () => true) {
  return state.holdings[h].sides[p].reduce((s, inst) => s + (seen(inst) ? pw[inst.uid] : 0), 0);
}

/**
 * Who reveals first this turn: the player with more power standing face up on the board (a face-down card is not
 * counted - the order would tell it), a tie player 0. Answers [first, second].
 * @param {any} state
 */
export function revealOrder(state) {
  const pw = powers(state);
  const total = [0, 1].map((p) => [0, 1, 2].reduce((s, h) => s + sidePower(state, pw, h, p, (inst) => !inst.down), 0));
  if (total[0] !== total[1]) return total[1] > total[0] ? [1, 0] : [0, 1];
  // AUDIT CARDS-5 A3: a tie (every first turn) by the deal's coin, then turn about - player 0 revealing first in every
  // tie was the second player's reply every opening (47.6 to 50.8 in greedy play)
  const first = ((state.coin ?? 0) + state.turn - 1) % 2;
  return [first, 1 - first];
}

// ── THE GAME ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Up to `n` cards from the top of `p`'s deck into his hand, never past ILIAC_HAND_MAX. Answers how many came. */
function drawCards(state, p, n) {
  const pl = state.players[p];
  let k = 0;
  while (k < n && pl.deck.length && pl.hand.length < ILIAC_HAND_MAX) { pl.hand.push(pl.deck.shift()); k++; }
  return k;
}

/**
 * A NEW GAME, or null for one the law refuses (a deck deckValid refuses, a holding that is not one, no source).
 * `rand32`, a source of uniform 32-bit integers (the relay's CSPRNG, a test's script), draws the three holdings (unless
 * `locations` names them) and then shuffles deck 0, then deck 1 - and nothing after. A card's `uid` is its player's
 * seat times ILIAC_DECK_SIZE plus its place in his SHUFFLED deck, so a uid tells nothing of what the card is.
 * @param {{decks: string[][], rand32: () => number, locations?: string[]}} p
 */
export function newGame({ decks, rand32: source, locations }) {
  if (!Array.isArray(decks) || decks.length !== 2 || typeof source !== 'function') return null;
  // AUDIT CARDS-5 A6: the source checked - a uint32, and a bounded count of draws (one stuck at the top rejected for ever)
  let draws = 0;
  const rand32 = () => {
    const v = source();
    if (!Number.isInteger(v) || v < 0 || v > 0xFFFFFFFF || ++draws > ILIAC_RAND_DRAWS_MAX) throw new Error('rand32');
    return v;
  };
  try { return deal(decks, rand32, locations); } catch { return null; }
}
/** AUDIT CARDS-5 A6: the most draws a deal may take - its own need is a few hundred; past this the source is broken. */
export const ILIAC_RAND_DRAWS_MAX = 100_000;
function deal(decks, rand32, locations) {
  if (decks.some((d) => deckValid(d) !== null)) return null;
  let held;
  if (locations !== undefined) {
    const ids = new Set(ILIAC_LOCATIONS.map((c) => c.id));
    if (!Array.isArray(locations) || locations.length !== ILIAC_HOLDINGS || new Set(locations).size !== ILIAC_HOLDINGS || !locations.every((id) => ids.has(id))) return null;
    held = locations.slice();
  } else {
    const pool = ILIAC_LOCATIONS.map((c) => c.id);
    held = [];
    for (let k = 0; k < ILIAC_HOLDINGS; k++) held.push(pool.splice(drawBelow(pool.length, rand32), 1)[0]);
  }
  const state = {
    turn: 1, over: false, nextUid: 2 * ILIAC_DECK_SIZE,
    holdings: held.map((id) => ({ id, sides: [[], []] })),
    players: decks.map((d, p) => ({
      // The cards' own shuffle, over the deck's places (its law deals integers): Fisher-Yates, each partner unbiased.
      deck: shuffleDeck(rand32, d.map((_, i) => i)).map((i, k) => ({ uid: p * ILIAC_DECK_SIZE + k, id: d[i] })),
      hand: [], discard: [], magicka: 1, bonus: 0, plays: null,
    })),
  };
  state.coin = drawBelow(2, rand32);   // AUDIT CARDS-5 A3: who reveals first in a tie - drawn after the shuffles, so no deal moves
  for (let p = 0; p < 2; p++) drawCards(state, p, ILIAC_HAND_START);
  return state;
}

/**
 * Why player `player` may not commit `plays` now - 'over', 'player', 'committed' (he already has this turn), 'shape',
 * 'hand' (no such card, or one card twice), 'holding' (no such holding), 'spell' (a holding where spells cannot be
 * played), 'magicka' (the plays cost more than he has), 'room' (more units at a holding than its side has room) - or
 * null. The UI's staging asks this; `commit` asks it too.
 * @param {any} state @param {number} player @param {any} plays
 */
export function playsRefusal(state, player, plays) {
  if (!state || state.over) return 'over';
  if (player !== 0 && player !== 1) return 'player';
  const pl = state.players[player];
  if (pl.plays) return 'committed';
  if (!Array.isArray(plays) || plays.length > ILIAC_HAND_MAX) return 'shape';
  const seen = new Set(), units = [0, 0, 0];
  let spend = 0;
  for (const x of plays) {
    if (!x || typeof x !== 'object' || !Number.isInteger(x.card) || !Number.isInteger(x.holding)) return 'shape';
    if (x.card < 0 || x.card >= pl.hand.length || seen.has(x.card)) return 'hand';
    if (x.holding < 0 || x.holding >= ILIAC_HOLDINGS) return 'holding';
    seen.add(x.card);
    const card = cardById(pl.hand[x.card].id);
    if (card.kind === 'spell') { if (noSpells(state, x.holding)) return 'spell'; } else units[x.holding]++;
    spend += costOf(state, player, card, x.holding);
  }
  if (spend > pl.magicka) return 'magicka';
  for (let h = 0; h < ILIAC_HOLDINGS; h++) if (units[h] > freeRoom(state, null, player, h)) return 'room';
  return null;
}

/**
 * Every single play `player` could commit alone this turn: `{card, holding}` for each card of his hand he can pay for
 * at each holding that takes it. (A list of several is checked whole by playsRefusal.)
 * @param {any} state @param {number} player
 */
export function legalPlays(state, player) {
  if (playsRefusal(state, player, []) !== null) return [];
  const out = [];
  state.players[player].hand.forEach((_, card) => {
    for (let holding = 0; holding < ILIAC_HOLDINGS; holding++) if (playsRefusal(state, player, [{ card, holding }]) === null) out.push({ card, holding });
  });
  return out;
}

/**
 * Player `player` commits his turn's plays, hidden until both have: `[{card: handIndex, holding}]`, resolved in that
 * order (an empty list passes). Answers null, or the refusal word (playsRefusal's) - a refused commit changes nothing.
 * @param {any} state @param {number} player @param {{card: number, holding: number}[]} plays
 */
export function commit(state, player, plays) {
  const no = playsRefusal(state, player, plays);
  if (no) return no;
  state.players[player].plays = plays.map((x) => ({ card: x.card, holding: x.holding }));
  return null;
}

/** Take a card off the board (a token is gone; a card goes to its owner's discard as itself, never its form). */
function removeFromBoard(state, r) {
  state.holdings[r.h].sides[r.p].splice(r.i, 1);
  if (!r.inst.token) state.players[r.p].discard.push({ uid: r.inst.uid, id: r.inst.id });
}

/** One triggered record, acted. `src` names its source in the events: {uid} or {holding}. */
function act(state, T, ctx, fx, src) {
  const ev = T.events;
  const n = fx.n ?? 1;
  switch (fx.do) {
    case 'buff': case 'weaken': {
      const pw = powers(state);
      for (const r of select(state, ctx, fx, fx.pick ? pw : null)) {
        const before = r.inst.mod ?? 0;
        // a weaken takes from the power the card SHOWS, and stops at 0 (AUDIT CARDS-5 A1: it stopped at the card's own
        // power, so a buffed card lost less than its text said)
        const take = fx.do === 'weaken' ? Math.min(n, Math.max(0, pw[r.inst.uid] ?? 0)) : n;
        if (!take) continue;   // AUDIT CARDS-5 A9: a card at 0 loses nothing, and nothing is said
        r.inst.mod = fx.do === 'buff' ? before + n : before - take;
        ev.push({ t: fx.do, uid: r.inst.uid, n: take, src });
      }
      return;
    }
    case 'destroy': {
      const pw = fx.pick ? powers(state) : null;
      for (const uid of select(state, ctx, fx, pw).map((r) => r.inst.uid)) {
        const r = find(state, uid);
        removeFromBoard(state, r);
        ev.push({ t: 'destroy', uid, id: r.inst.id, p: r.p, holding: r.h, src });
      }
      return;
    }
    case 'move': {
      const pw = fx.pick ? powers(state) : null;
      for (const uid of select(state, ctx, fx, pw).map((r) => r.inst.uid)) {
        const r = find(state, uid);
        let to = -1;
        for (let k = 1; k < ILIAC_HOLDINGS && to < 0; k++) if (freeRoom(state, T, r.p, (r.h + k) % ILIAC_HOLDINGS) > 0) to = (r.h + k) % ILIAC_HOLDINGS;
        if (to < 0) continue;
        state.holdings[r.h].sides[r.p].splice(r.i, 1);
        state.holdings[to].sides[r.p].push(r.inst);
        ev.push({ t: 'move', uid, from: r.h, to, src });
      }
      return;
    }
    case 'transform': {
      const pw = fx.pick ? powers(state) : null;
      for (const r of select(state, ctx, fx, pw)) {
        r.inst.form = fx.card;
        r.inst.mod = 0;
        ev.push({ t: 'transform', uid: r.inst.uid, id: fx.card, src });
      }
      return;
    }
    case 'summon': {
      for (let k = 0; k < n && freeRoom(state, T, ctx.p, ctx.h) > 0; k++) {
        const inst = { uid: state.nextUid++, id: fx.card, mod: 0, token: true };
        state.holdings[ctx.h].sides[ctx.p].push(inst);
        ev.push({ t: 'summon', p: ctx.p, uid: inst.uid, id: fx.card, holding: ctx.h, src });
      }
      return;
    }
    case 'draw': ev.push({ t: 'draw', p: ctx.p, n: drawCards(state, ctx.p, n), src }); return;
    case 'magicka': state.players[ctx.p].bonus += n; ev.push({ t: 'magicka', p: ctx.p, n, src }); return;
    default: return;   // a holding's rule, or an ongoing verb: read where it bends, never acted
  }
}

/** The holding's own "After a card is revealed here" text, for the revealed card's owner. */
function holdingReveal(state, T, p, h) {
  for (const fx of holdingCard(state, h).fx) if (fx.on === 'reveal') act(state, T, { p, h, uid: null }, fx, { holding: h });
}

/** One committed play, landed and revealed. */
function resolvePlay(state, T, p, inst, h) {
  const card = cardById(inst.id), ev = T.events;
  if (card.kind === 'spell') {
    ev.push({ t: 'play', p, uid: inst.uid, id: inst.id, holding: h, kind: card.kind });
    for (const fx of card.fx) if (fx.on === 'reveal') act(state, T, { p, h, uid: null }, fx, { uid: inst.uid });
    holdingReveal(state, T, p, h);
    state.players[p].discard.push(inst);
    ev.push({ t: 'spent', p, uid: inst.uid, id: inst.id });
    return;
  }
  T.res[p][h]--;
  if (freeRoom(state, T, p, h) <= 0) {
    // Unreachable by construction - the commit counted the room, only a player's own cards ever join his side, and
    // his own summons and moves leave room for his plays still landing. Kept so a broken promise costs a card's
    // play, never a card: it goes home to the hand. The random games pin that it never fires.
    state.players[p].hand.push(inst);
    ev.push({ t: 'fizzle', p, uid: inst.uid, holding: h });   // AUDIT CARDS-5 A9: never the card's id - it goes back to a hidden hand
    return;
  }
  const down = veiled(state, h);
  const b = { uid: inst.uid, id: inst.id, mod: 0, ...(down ? { down: true } : {}) };
  state.holdings[h].sides[p].push(b);
  if (down) { ev.push({ t: 'play', p, uid: b.uid, holding: h, down: true }); return; }   // the other player is told a card, never which
  ev.push({ t: 'play', p, uid: b.uid, id: b.id, holding: h, kind: card.kind });
  for (const fx of card.fx) if (fx.on === 'reveal') act(state, T, { p, h, uid: b.uid }, fx, { uid: b.uid });
  holdingReveal(state, T, p, h);
}

/**
 * REVEAL: once both players have committed, the turn resolves - the reveal order, each player's plays as he listed
 * them, the end of the turn, then the next turn's magicka and draw (or, after ILIAC_TURNS, the unveiling and the
 * result). Answers the events, in order - [] while a player has yet to commit (nothing changes).
 * @param {any} state
 */
export function reveal(state) {
  if (!state || state.over || !state.players[0].plays || !state.players[1].plays) return [];
  const order = revealOrder(state);
  const T = { events: /** @type {any[]} */ ([{ t: 'order', first: order[0], turn: state.turn }]), res: [[0, 0, 0], [0, 0, 0]] };
  // Every play leaves the hand at once (the indices are the hand as it was committed), its room held for it.
  const landing = [0, 1].map((p) => {
    const pl = state.players[p];
    const list = pl.plays.map((x) => ({ inst: pl.hand[x.card], h: x.holding }));
    const played = new Set(pl.plays.map((x) => x.card));
    pl.hand = pl.hand.filter((_, i) => !played.has(i));
    for (const x of list) if (cardById(x.inst.id).kind !== 'spell') T.res[p][x.h]++;
    return list;
  });
  for (const p of order) for (const x of landing[p]) resolvePlay(state, T, p, x.inst, x.h);
  // THE END OF THE TURN: every face-up card's end text once (it may move on its way), then the holdings'.
  const uids = [];
  for (let h = 0; h < ILIAC_HOLDINGS; h++) for (const p of order) for (const inst of state.holdings[h].sides[p]) uids.push(inst.uid);
  for (const uid of uids) {
    const at = find(state, uid);
    if (!at || at.inst.down) continue;
    for (const fx of cardOf(at.inst).fx) {
      if (fx.on !== 'end') continue;
      const r = find(state, uid);
      if (!r) break;
      act(state, T, { p: r.p, h: r.h, uid }, fx, { uid });
    }
  }
  for (let h = 0; h < ILIAC_HOLDINGS; h++) for (const fx of holdingCard(state, h).fx) if (fx.on === 'end') act(state, T, { p: null, h, uid: null }, fx, { holding: h });
  for (const pl of state.players) pl.plays = null;
  if (state.turn >= ILIAC_TURNS) {
    const cards = [];
    state.holdings.forEach((hd, h) => hd.sides.forEach((side, p) => side.forEach((inst) => {
      if (inst.down) { delete inst.down; inst.unveiled = true; cards.push({ uid: inst.uid, id: inst.id, p, holding: h }); }
    })));
    if (cards.length) T.events.push({ t: 'unveil', cards });
    state.over = true;
    T.events.push({ t: 'over', result: result(state) });
    return T.events;
  }
  state.turn++;
  for (const pl of state.players) { pl.magicka = Math.min(ILIAC_MAGICKA_MAX, state.turn + pl.bonus); pl.bonus = 0; }
  T.events.push({ t: 'turn', turn: state.turn, magicka: state.players.map((pl) => pl.magicka) });
  for (const p of order) T.events.push({ t: 'drew', p, n: drawCards(state, p, 1) });
  return T.events;
}

/**
 * The game's result, or null while it is played: `{winner: 0|1|null, held: [0|1|null x3], power: [[p0 by holding],
 * [p1 by holding]], total: [p0, p1], by: 'holdings'|'power'|'draw'}`. Two holdings held win; otherwise (a split, a tie
 * at a holding) the higher total power wins; level, a draw.
 * @param {any} state
 */
export function result(state) {
  if (!state || !state.over) return null;
  const pw = powers(state);
  const power = [0, 1].map((p) => [0, 1, 2].map((h) => sidePower(state, pw, h, p)));
  const held = [0, 1, 2].map((h) => (power[0][h] > power[1][h] ? 0 : power[1][h] > power[0][h] ? 1 : null));
  const total = power.map((row) => row.reduce((a, b) => a + b, 0));
  const count = [0, 1].map((p) => held.filter((x) => x === p).length);
  let winner = null, by = 'draw';
  if (count[0] >= 2) { winner = 0; by = 'holdings'; } else if (count[1] >= 2) { winner = 1; by = 'holdings'; } else if (total[0] !== total[1]) { winner = total[0] > total[1] ? 0 : 1; by = 'power'; }
  return { winner, held, power, total, by };
}

/**
 * The game as `viewer` (0 or 1; -1 a spectator) may see it - plain data, never the state's own objects. His own hand
 * and his own committed plays; of the other, the counts and that he has committed. Neither deck's order. A face-down
 * card of the other's is `{uid, down: true}` and his power at that holding counts only what the viewer can see.
 * @param {any} state @param {number} viewer
 */
export function iliacView(state, viewer) {
  const pw = powers(state);
  const seen = (p) => (inst) => !inst.down || p === viewer;
  const cardView = (inst, p) => (seen(p)(inst)
    ? { uid: inst.uid, id: inst.id, power: pw[inst.uid], mod: inst.mod ?? 0, ...(inst.form ? { form: inst.form } : {}), ...(inst.token ? { token: true } : {}), ...(inst.down ? { down: true } : {}) }
    : { uid: inst.uid, down: true });
  return {
    viewer, turn: state.turn, turns: ILIAC_TURNS, over: state.over,
    holdings: state.holdings.map((hd, h) => ({
      id: hd.id, room: holdingRoomOf(state, h),
      sides: hd.sides.map((side, p) => side.map((inst) => cardView(inst, p))),
      power: [0, 1].map((p) => sidePower(state, pw, h, p, seen(p))),
    })),
    players: state.players.map((pl, p) => ({
      handCount: pl.hand.length, deckCount: pl.deck.length, magicka: pl.magicka, bonus: pl.bonus, committed: !!pl.plays,
      discard: pl.discard.map((c) => ({ uid: c.uid, id: c.id })),
      ...(p === viewer ? { hand: pl.hand.map((c) => ({ uid: c.uid, id: c.id })), plays: pl.plays ? pl.plays.map((x) => ({ ...x })) : null } : {}),
    })),
    result: result(state),
  };
}
