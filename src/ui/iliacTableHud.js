// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 33): ILIAC HAND'S PANEL AT THE TAVERN TABLE - the
// port's own enhanced panel beside the Hold'em one (ui/card/cardTableHud.js: outside the window stack, the world going on
// while it stands), where the player picks a deck and a regular, stages a turn and commits it.
//
// CARDS-PLUS (2026-10-13, section 38; the owner: "Lets improve the illiac bay minigame visuals and ensure the general card
// UI uses enhanced plus and our fonts"): the panel wears the Enhanced Plus kit and the game's face on every skin
// (ui/card/cardPanelKit.js), and the game reads as a game: the turn a track of six and the magicka its gems (the staged spend
// dimmed); the other player's hand as its backs, their deck, their commit; each holding a plate under its own painted
// location card - their lane above, yours below, every place a side has left an empty slot, the power each way in a duel
// whose holder is lit (and the plate's edge brass for yours, blood for theirs); the hand a tray sunk into the stone, the card
// picked lifted in brass; the end a verdict; a fold to see the cloth; the log a line a sentence. Every card is the
// binder's own painting (ui/card/cardBinderPage.js cardCanvas), so a little card is the painter's tile face.
//
// TWO HALVES, as the Hold'em panel's. `iliacHudModel` is pure: the game's view (net/iliac/iliacHand.js iliacView, the offline
// session's or the relay's) and the host's staging as the rows, cards and buttons the panel shows - every label and every
// enabled flag decided here, pinned by test/systems/cards10_table.test.js. `createIliacTableHud` paints that model into the page
// and hands presses back to the host.
//
// STAGING READS ONLY WHAT THE PLAYER SEES. `stagedRefusal` is the rules' playsRefusal said over the view (his hand, his
// magicka, a holding's room and its rule, his own face-up cards' discounts) - the panel greys a play the rules would
// refuse; the rules themselves (the session's commit, the relay's) still decide.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { cardById } from '../net/iliac/iliacCards.js';
import { cardRules } from '../systems/iliac/iliacCardWords.js';   // KG-SET: a card's rules, in the player's language
import { ILIAC_HAND_MAX, ILIAC_HOLDINGS, ILIAC_MAGICKA_MAX, ILIAC_ROOM, ILIAC_TURNS } from '../net/iliac/iliacHand.js';
import { ILIAC_CARD_ASPECT } from '../render/iliacCardFaces.js';
import { cardCanvasCopy } from './card/cardBinderPage.js';   // CARDS-PLUS: the binder's own painting of a face, at its CSS size
import { cardPanelChromeCss, dressCardPanel, foldWords } from './card/cardPanelKit.js';   // CARDS-PLUS: the kit and the face, both panels' one home
import { PIXELIFY_FIVE_FACE } from './pixelifyFive.js';   // FIX-D: the face's five, carried by every sheet that sets it
import { t, localizedText } from '../systems/textManager.js';   // CARDS-PLUS (L10N4): the words this panel's look added, in the player's language
import { playGambitWord } from './gambitTableWords.js';   // KG3: the third game's press, in the player's language

/** A temper as the panel names it. */
export const TEMPER_WORDS = Object.freeze({ tight: 'careful', loose: 'reckless', bluffer: 'sly' });
/** A deck's refusal (the binder page's words: ui/card/cardBinderPage.js DECK_REFUSAL_WORDS) as the setup's row says it. */
export const ILIAC_REFUSAL_WORDS = Object.freeze({
  over: 'The game is over.', committed: 'You have committed this turn.', shape: 'That is not a valid play.', hand: 'That card is not in your hand.',
  holding: 'No such holding.', spell: 'Spells cannot be played there.', magicka: 'Not enough magicka.', room: 'No room on your side there.',
});

/** A holding's ongoing rule of `verb` (its own card's text), or null. */
const holdingRule = (id, verb) => cardById(id)?.fx?.find((f) => f.on === 'ongoing' && f.do === verb) ?? null;

/**
 * What a card costs the viewer at holding `h`, read off the view: its cost, less the holding's discount and his own
 * face-up cards' discounts for its kind, never below 0 (iliacHand.js costOf, over what he sees).
 * @param {any} view @param {any} card @param {number} h
 */
export function viewCostOf(view, card, h) {
  const p = view.viewer;
  let off = 0;
  for (const fx of cardById(view.holdings[h].id)?.fx ?? []) if (fx.on === 'ongoing' && fx.do === 'discount' && fx.kind === card.kind) off += fx.n;
  for (const hd of view.holdings) for (const c of hd.sides[p]) {
    if (c.down) continue;
    for (const fx of cardById(c.form ?? c.id)?.fx ?? []) if (fx.on === 'ongoing' && fx.do === 'discount' && fx.kind === card.kind) off += fx.n;
  }
  return Math.max(0, card.cost - off);
}
/** The magicka a staged list spends. */
export const stagedSpend = (/** @type {any} */ view, /** @type {{card: number, holding: number}[]} */ plays) => plays.reduce((s, x) => {
  const id = view.players[view.viewer].hand?.[x.card]?.id;
  const c = id ? cardById(id) : null;
  return s + (c ? viewCostOf(view, c, x.holding) : 0);
}, 0);
/**
 * Why the viewer may not commit `plays` (playsRefusal's words, over the view), or null.
 * @param {any} view @param {{card: number, holding: number}[]} plays
 */
export function stagedRefusal(view, plays) {
  if (!view || view.over) return 'over';
  const me = view.players[view.viewer];
  if (!me?.hand) return 'over';
  if (me.committed) return 'committed';
  if (!Array.isArray(plays) || plays.length > ILIAC_HAND_MAX) return 'shape';
  const seen = new Set(), units = [0, 0, 0];
  for (const x of plays) {
    if (!Number.isInteger(x?.card) || !Number.isInteger(x?.holding)) return 'shape';
    if (x.card < 0 || x.card >= me.hand.length || seen.has(x.card)) return 'hand';
    if (x.holding < 0 || x.holding >= ILIAC_HOLDINGS) return 'holding';
    seen.add(x.card);
    const card = cardById(me.hand[x.card].id);
    if (card.kind === 'spell') { if (holdingRule(view.holdings[x.holding].id, 'nospell')) return 'spell'; } else units[x.holding]++;
  }
  if (stagedSpend(view, plays) > me.magicka) return 'magicka';
  for (let h = 0; h < ILIAC_HOLDINGS; h++) if (units[h] > view.holdings[h].room - view.holdings[h].sides[view.viewer].length) return 'room';
  return null;
}

/** A card as the panel shows it: its id (painted), its name, what the hover says - or a face-down card. */
export const iliacFace = (/** @type {any} */ c, extra = {}) => {
  if (!c || c.down && !c.id) return { id: null, name: 'Face down', title: 'A card face down', ...extra };
  const card = cardById(c.form ?? c.id);
  return { id: card?.id ?? null, name: card?.name ?? '?', power: c.power ?? card?.power ?? 0, cost: card?.cost ?? 0, title: card ? `${card.name} - ${cardRules(card)}` : '?', ...(c.down ? { down: true } : {}), ...extra };
};

/** The result said. */
export function resultLine(view, end) {
  const r = view?.result;
  const me = view?.viewer ?? 0;
  if (end === 'left') return 'You concede the game.';
  if (end === 'won-left') return 'Your opponent concedes. You win.';   // CARDS10: the relay's concession
  if (end === 'void') return 'No contest. The game is called off.';   // AUDIT CARDS-6 C7/E13: nobody's
  if (!r) return '';
  const held = r.held.filter((x) => x === me).length, theirs = r.held.filter((x) => x === 1 - me).length;
  if (r.winner === null) return `A draw: ${held} holdings each, and ${r.total[me]} power to ${r.total[1 - me]}.`;
  const won = r.winner === me;
  return r.by === 'holdings'
    ? `${won ? 'You win' : 'You lose'} - ${won ? held : theirs} of three holdings ${won ? 'held' : 'lost'}.`
    : `${won ? 'You win' : 'You lose'} on power, ${r.total[me]} to ${r.total[1 - me]}.`;
}

/**
 * CARDS-PLUS: who holds holding `h` as the board stands for the viewer - 'mine', 'theirs' or null - by the rules' own law
 * (net/iliac/iliacHand.js result: the greater power holds it, a tie nobody), read off the power the view shows (a face-down
 * card of the other's counts nothing to it); once the game is decided, the result's own word.
 * @param {any} view @param {number} h
 */
export function holdingLead(view, h) {
  const me = view?.viewer >= 0 ? view.viewer : 0, them = 1 - me;
  const held = view?.result?.held?.[h];
  if (held === me) return 'mine';
  if (held === them) return 'theirs';
  if (view?.result) return null;
  const p = view?.holdings?.[h]?.power ?? [0, 0];
  return p[me] > p[them] ? 'mine' : p[them] > p[me] ? 'theirs' : null;
}
/** CARDS-PLUS: a game's end as its player's - 'won', 'lost', 'drawn', or 'void' for no contest; null while it is played,
 *  and for a watcher (the end is the players', said in the line). `end` is the session's or the relay's word. */
export function iliacOutcome(view, end) {
  if (view && !(view.viewer >= 0)) return null;   // AUDIT CARDS-PLUS A6: a watcher's 'void' too - the end is the players'
  if (end === 'left') return 'lost';
  if (end === 'won-left') return 'won';
  if (end === 'void') return 'void';
  const r = view?.result;
  if (!r) return null;   // a watcher is turned away above (A6); asked again here, it was a check no pin could fail
  return r.winner === null ? 'drawn' : r.winner === view.viewer ? 'won' : 'lost';
}
/** CARDS-PLUS: the end's banner word - read when it is shown (L10N4: a frozen table's words are getters, never read at
 *  module load, which comes before the boot chooses the language). */
export const VERDICT_WORDS = Object.freeze({
  get won() { return t('cards.iliac.verdict.won', 'Victory'); },
  get lost() { return t('cards.iliac.verdict.lost', 'Defeat'); },
  get drawn() { return t('cards.iliac.verdict.drawn', 'A draw'); },
  get void() { return t('cards.iliac.verdict.void', 'No contest'); },
});

/**
 * The panel's model.
 * @param {{phase: 'setup'|'playing'|'over', view?: any, staged?: {card: number, holding: number}[], pick?: number|null, setup?: any, end?: string|null, prize?: any, log?: string[], packPrice?: number|null, online?: any, friendly?: boolean, why?: string|null, gambit?: boolean}} p
 */
export function iliacHudModel({ phase, view = null, staged = [], pick = null, setup = null, end = null, prize = null, log = [], packPrice = null, online = null, friendly = false, why = null, gambit = false }) {
  const title = 'Card table: Iliac Hand';
  const note = online ? (online.ranked ? 'A ranked game against another player. The result counts on the season board.' : 'A game against another player in the room.')
    : friendly ? 'A friendly game. Online, no cards change hands at a regulars\' table.' : null;
  const pack = packPrice ? [{ id: 'pack', label: `Buy a card pack (${packPrice} gold)`, enabled: true }] : [];
  if (phase === 'setup') {
    const s = setup ?? { decks: [], foes: [] };
    const deckOk = s.deck != null && s.decks[s.deck] && !s.decks[s.deck].word;
    const foeOk = online ? true : s.foe != null && !!s.foes[s.foe];
    return {
      phase, title, note,
      decks: s.decks.map((d, i) => ({ i, name: d.name, word: d.word ?? null, chosen: i === s.deck })),
      foes: online ? [] : s.foes.map((f, i) => ({ i, name: f.name, temper: TEMPER_WORDS[f.temper] ?? f.temper, paid: !!f.paid, chosen: i === s.foe })),
      keeps: online ? null : { on: !!s.forKeeps && !!s.keepsOk, enabled: !!s.keepsOk, why: s.keepsWhy ?? null },
      // CARDS10: online, the season's board - a deck the service vouches the realm character holds (the relay seats it ranked)
      ranked: online ? { on: !!online.rankedOn && !!online.rankedOk, enabled: !!online.rankedOk, why: online.rankedWhy ?? null } : null,
      board: online?.board ? boardLines(online.board) : null,
      message: why ?? (!s.decks.length ? 'Your binder has no deck. Build one under Holdings, Collections.' : !deckOk ? 'Choose a valid deck from your binder.' : !foeOk ? 'Choose a regular to play.' : online?.busy ? 'Checking your deck with the realm...'
        : online ? [online.lastLine, 'Sit down and wait for another player.'].filter(Boolean).join(' ') : 'Ready to deal.'),   // AUDIT CARDS-6 E10: a watched game's end said as its chair frees
      // CARDS-PLUS: what the line is - a refusal, or no deck to play, a warning; the realm vouching a wait
      tone: why || !deckOk ? 'warn' : online?.busy ? 'wait' : null,
      actions: [
        { id: 'deal', label: online ? 'Sit at the table' : 'Deal', enabled: !!(deckOk && foeOk) && !online?.busy, kind: 'primary' },
        ...(online ? [{ id: 'regulars', label: 'Play a regular instead', enabled: !!online.regularsOk }] : []),   // CARDS10: the tavern's own, while he holds no seat at the relay's (AUDIT CARDS-6 E20: not "alone in the room")
        ...(online ? [{ id: 'board', label: online.board ? 'Hide the season board' : 'Season board', enabled: !online.boardBusy }] : []),   // CARDS10: the ladder
        { id: 'holdem', label: 'Play Hold\'em instead', enabled: true },
        ...(gambit ? [{ id: 'gambit', label: playGambitWord(), enabled: true }] : []),   // KG3: the third game, its Features switch on
        ...pack,
        { id: 'stand', label: 'Stand up', enabled: true, kind: 'quiet' },
      ],
      log: log.slice(-6),
    };
  }
  const me = view?.viewer >= 0 ? view.viewer : 0, them = 1 - me;   // a spectator's view (-1) reads seat 0 as the first side
  const mine = view?.players?.[me] ?? null;
  const stagedAt = (h) => staged.flatMap((x, k) => (x.holding === h ? [{ ...iliacFace(mine?.hand?.[x.card]), staged: k }] : []));
  const holdings = (view?.holdings ?? []).map((hd, h) => {
    const loc = cardById(hd.id);
    const st = stagedAt(h);
    return {
      h, id: hd.id, name: loc?.name ?? '?', text: loc?.text ?? '', room: hd.room,
      power: [hd.power[me], hd.power[them]],
      mine: hd.sides[me].map((c) => iliacFace(c)), theirs: hd.sides[them].map((c) => iliacFace(c)),
      staged: st,
      // CARDS-PLUS: who holds it as the board stands, and the room left each side - a staged unit takes its place, a
      // staged spell none (stagedRefusal's own count)
      lead: holdingLead(view, h),
      open: [Math.max(0, hd.room - hd.sides[me].length - st.filter((c) => c.id && cardById(c.id)?.kind !== 'spell').length), Math.max(0, hd.room - hd.sides[them].length)],
      target: pick !== null && phase === 'playing' && stagedRefusal(view, [...staged, { card: pick, holding: h }]) === null,
    };
  });
  const used = new Set(staged.map((x) => x.card));
  const hand = (mine?.hand ?? []).map((c, i) => ({ ...iliacFace(c), i, picked: i === pick, staged: used.has(i),
    playable: phase === 'playing' && !used.has(i) && holdings.some((_, h) => stagedRefusal(view, [...staged, { card: i, holding: h }]) === null) }));
  const spend = view ? stagedSpend(view, staged) : 0;
  const committed = !!mine?.committed;
  const actions = [];
  if (phase === 'playing') {
    // AUDIT CARDS-6 E3: a commit in flight is pressed once
    actions.push({ id: 'commit', label: committed ? 'Committed' : online?.committing ? 'Committing...' : staged.length ? `Commit ${staged.length} ${staged.length === 1 ? 'play' : 'plays'}` : 'Pass this turn', enabled: !committed && !online?.committing && stagedRefusal(view, staged) === null, kind: 'primary' });
    actions.push({ id: 'clear', label: 'Clear', enabled: !committed && staged.length > 0 });
    // CARDS-PLUS: a concession costs something - the card staked, the ranked game - and is edged in blood (the kit's warn)
    const concede = !!(view?.forKeeps || (online && view && !online.watching));
    actions.push({ id: 'stand', label: concede ? 'Concede and stand' : 'Stand up', enabled: true, kind: concede ? 'warn' : 'quiet' });
  } else if (online) {
    actions.push(...pack);   // CARDS10: the relay deals the next game while both still sit
    actions.push({ id: 'stand', label: 'Leave the table', enabled: true, kind: 'quiet' });
  } else {
    actions.push({ id: 'again', label: 'Play again', enabled: true, kind: 'primary' });
    actions.push({ id: 'holdem', label: 'Play Hold\'em', enabled: true });
    if (gambit) actions.push({ id: 'gambit', label: playGambitWord(), enabled: true });   // KG3
    actions.push(...pack);
    actions.push({ id: 'stand', label: 'Leave the table', enabled: true, kind: 'quiet' });
  }
  const other = view?.names?.[them] ?? (online ? 'Your opponent' : 'The regular');
  // AUDIT CARDS-6 E10: the next game deals only while both chairs are filled - a winner left alone waits for a player
  const next = !online ? '' : online.full ? 'The next game starts in a moment.' : 'Waiting for another player to sit down.';
  const message = phase === 'over'
    ? [online?.watching === false && online?.lastLine ? online.lastLine : resultLine(view, end), prizeLine(prize, other), online?.rankedLine ?? '', next].filter(Boolean).join(' ')
    // AUDIT CARDS-6 E19: no game on the cloth yet - the wait said, never "Turn 1 of 6 - your magicka 0 of 0"
    : online?.seating ? 'Sitting down at the table...'
      : online?.waiting ? 'Waiting for another player to sit down.'
      : online && !view ? 'Both seats are taken. The game starts in a moment.'
      : online?.watching ? `You watch ${view?.names?.[0] ?? 'a player'} and ${view?.names?.[1] ?? 'a player'} play.`
      : view?.revealing ? 'The cards turn over...'
      : committed ? (view?.players?.[them]?.committed ? 'Both players have committed. The cards turn over.' : `${other} is thinking...`)
      : `Turn ${view?.turn ?? 1} of ${view?.turns ?? 6} - your magicka ${Math.max(0, (mine?.magicka ?? 0) - spend)} of ${mine?.magicka ?? 0}.${online?.clock ? ` ${online.clock} s.` : ''}`;
  const outcome = phase === 'over' ? iliacOutcome(view, end) : null;
  // CARDS-PLUS: what the line is, as the Hold'em panel says it - a refusal a warning; the table's time (a sit on its way,
  // the other chair empty, a game watched, the cards turning, the other's thought) a wait; the turn yours; the end its own
  const tone = online?.error || why ? 'warn'
    : phase === 'over' ? (outcome === 'won' || outcome === 'lost' ? outcome : null)
      : online?.seating || online?.waiting || (online && !view) || online?.watching || view?.revealing || committed ? 'wait' : 'turn';
  return {
    phase, title, note, holdings, hand, tone, outcome,
    // AUDIT CARDS-PLUS A3: a game on the cloth - online, the chairs fill and the relay deals before there is one, and the
    // panel draws no turn, no other player and no board until it does (AUDIT CARDS-6 E19: never "Turn 1 of 6")
    dealt: !!view,
    spectator: !(view?.viewer >= 0),   // CARDS-PLUS: a watcher holds no hand and no magicka of their own
    them: { name: other, hand: view?.players?.[them]?.handCount ?? 0, deck: view?.players?.[them]?.deckCount ?? 0, committed: !!view?.players?.[them]?.committed },
    me: { deck: mine?.deckCount ?? 0, magicka: mine?.magicka ?? 0, spend },
    turn: view?.turn ?? 1, turns: view?.turns ?? 6,
    sides: online && view?.viewer === -1 ? [view?.names?.[0] ?? 'seat one', view?.names?.[1] ?? 'seat two'] : ['you', 'them'],   // AUDIT CARDS-6 C9: a watched game's last board too
    // AUDIT CARDS-6 E9: and why a press did nothing (a refusal, the relay not answering) - said only in the setup before
    actions, message: [online?.error ? `${message} (${online.error})` : message, why].filter(Boolean).join(' '), log: log.slice(-6),
  };
}
/**
 * CARDS10: THE SEASON'S BOARD as the panel says it (server-account/src/iliac.js iliacBoardOf's answer): the season, its
 * top rows and the caller's own pinned under them, its #1 and whether they wear the title, the caller's standing.
 * @param {any} b
 */
export function boardLines(b) {
  if (!b) return [];
  if (b.error) return [b.error];
  const row = (r) => `${r.rank}. ${r.name ?? '?'} - ${r.rating} (${r.wins}-${r.losses}-${r.draws})${r.you ? ' - you' : ''}`;
  const out = [`Season ${b.season?.n ?? '?'}, day ${b.season?.day ?? '?'}.`];
  if (!b.rows?.length) out.push('No ranked game has been played this season.');
  for (const r of b.rows ?? []) out.push(row(r));
  if (b.pinned) out.push('...', row(b.pinned));
  out.push(b.champion ? `Iliac Champion: ${b.champion.name}.` : `No Iliac Champion yet. The top player needs ${b.titleNeeds?.games ?? 10} games against ${b.titleNeeds?.foes ?? 5} different players.`);
  if (b.me) out.push(`Your rating ${b.me.rating}, ${b.me.games} ${b.me.games === 1 ? 'game' : 'games'} this season.`);
  return out;
}

/** The prize said: a card won or lost for keeps. */
export function prizeLine(prize, other = 'The regular') {
  if (!prize?.card) return '';
  const name = cardById(prize.card)?.name ?? 'a card';
  return prize.from === 'patron' ? `${other} pays you a card: ${name}.` : `${other} takes a card from your deck: ${name}.`;
}

const STYLE_ID = 'dfiliac-style';
/** CARDS-PLUS: the panel's little cards, CSS pixels tall (their width the cards' own aspect) - a card on a holding's lane,
 *  one in the hand, a holding's own location card. Each at most ILIAC_TILE_MAX_H, so the binder's painting of it at its
 *  CSS size is the painter's TILE face (render/iliacCardFaces.js: the emblem large, the name at its least, no rules box). */
export const ILIAC_LANE_CARD_H = 46;
export const ILIAC_HAND_CARD_H = 80;
export const ILIAC_PLACE_CARD_H = 43;
/** A card's CSS width at `h`, as the binder's canvas paints it. */
const cardW = (/** @type {number} */ h) => Math.round(h * ILIAC_CARD_ASPECT);
/** The most of the other player's backs drawn beside their count, and the most magicka gems in a row - the rules' own
 *  ceilings (a hand's most, the magicka's), so a number past them is said in the count and never grows the row. */
const BACKS_MAX = ILIAC_HAND_MAX;
const GEMS_MAX = ILIAC_MAGICKA_MAX;
/** AUDIT CARDS-PLUS A1: and the track's pips and a lane's empty places the same way - a game's turns and a side's room
 *  (a relay's garbled 2,000,000 grew them without end: 38 s to paint one board). */
const TRACK_MAX = ILIAC_TURNS;
const SLOTS_MAX = ILIAC_ROOM;
const LANE_W = cardW(ILIAC_LANE_CARD_H), HAND_W = cardW(ILIAC_HAND_CARD_H), PLACE_W = cardW(ILIAC_PLACE_CARD_H);
/** CARDS-PLUS: the panel's own sheet - geometry and words. The chrome (the window's box, the header band and its fold,
 *  the note, the line, the presses, the log) is ui/card/cardPanelKit.js's; every surface's paint is the kit's by role
 *  (ui/enhanced/enhancedFrame.js FRAME_ROLES: the window, a holding a panel, the tray and the season's board wells, a choice a
 *  tile, a power a chip, the deal and the commit primary, a concession warn). A state the kit does not know - a holding
 *  held, one a picked card can go to - is said with a leading body, to outweigh the role it stands in; a theme or the
 *  DFO Grimoire dress that repaints the role re-says it in its own colours (ui/enhanced/enhancedFrame.js themeCss,
 *  ui/grimoireDress.js kitCss - AUDIT CARDS-PLUS B1). A target is a ring outside the plate, so the plate's top edge
 *  still says who holds it (B5); a word in red is --cp-red, lifted on Stone (B3). Nothing overlaps
 *  (AUDIT CARDS-PLUS A2: overlapped on a phone, each card covered the power of the one before it): a lane is a grid as
 *  wide as its plate allows - two by two on a phone - and the tray wraps. An edge is a width and a style, never a
 *  colour (the kit paints it - AUDIT CARDS-PLUS C3). */
export const ILIAC_TABLE_CSS = `
${PIXELIFY_FIVE_FACE}
${cardPanelChromeCss('.dfiliac')}
.dfiliac{left:50%;bottom:18px;transform:translateX(-50%);width:min(760px,calc(100vw - 32px))}
@media (min-width:1100px){.dfiliac{left:auto;right:16px;transform:none;width:540px}}
.dfiliac:focus{outline:none}
.dfiliac [tabindex="0"]:focus-visible,.dfiliac button:focus-visible{outline:2px solid #f3cf86;outline-offset:1px}
.dfiliac .hold:focus-visible{outline-offset:5px}
.dfiliac.collapsed .ilbody{display:none}
.dfiliac .ilsec{margin:0 0 8px}
.dfiliac .ilsec-head{margin:0 0 4px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--cp-dim)}
.dfiliac .opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.dfiliac .opt{display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:0;padding:4px 8px 5px;border-width:2px;border-style:solid;cursor:pointer}
.dfiliac .opt .optname{color:#efe8d6;overflow-wrap:anywhere;text-shadow:1px 1px 0 #050608}
.dfiliac .opt[aria-pressed="true"] .optname{color:#f3cf86}
.dfiliac .opt .opttemper{color:var(--cp-dim)}
.dfiliac .opt .optword{font-size:11px;color:var(--cp-dim)}
.dfiliac .opt .optword.bad{color:#ffb4a6}
.dfiliac .opt .optword.paid{letter-spacing:.08em;text-transform:uppercase;color:#ffb4a6}
.dfiliac .opt.off{opacity:.55;cursor:default;pointer-events:none}
.dfiliac .opt.box{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:8px;align-items:center}
.dfiliac .opt.box::before{content:'';grid-row:1/span 2;width:12px;height:12px;border:2px solid #7a7260;background:rgba(4,5,7,.7);box-shadow:0 0 0 1px #050608}
.dfiliac .opt.box[aria-pressed="true"]::before{border-color:#f3cf86 #7a5424 #5c3f1a #c08a3e;background:linear-gradient(180deg,#fff0b8 0 2px,#c08a3e 2px)}
.dfiliac .opt.box .optword{white-space:normal}
.dfiliac .season{margin:0 0 8px;padding:6px 8px;border-width:2px;border-style:solid;font-size:12px;color:var(--cp-word)}
.dfiliac .verdict{margin:0 0 8px;padding:4px 8px;text-align:center;font-size:18px;letter-spacing:.24em;text-transform:uppercase;color:#efe8d6;text-shadow:2px 2px 0 #050608}
.dfiliac .verdict.won{color:#f3cf86;background:linear-gradient(90deg,transparent,rgba(243,207,134,.2),transparent)}
.dfiliac .verdict.lost{color:var(--cp-red);background:linear-gradient(90deg,transparent,rgba(184,58,46,.26),transparent)}
.dfiliac .ilbar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:4px 14px;margin:0 0 6px}
.dfiliac .track{display:flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--cp-dim)}
.dfiliac .track b{font-weight:inherit;letter-spacing:0;color:#efe8d6;font-variant-numeric:tabular-nums;text-shadow:1px 1px 0 #050608}
.dfiliac .pips,.dfiliac .gems{display:inline-flex;align-items:center;gap:4px}
.dfiliac .pip{width:8px;height:8px;transform:rotate(45deg);background:rgba(4,5,7,.8);box-shadow:0 0 0 1px #050608,inset 0 0 0 1px #5a5446}
.dfiliac .pip.past{background:#7a5424;box-shadow:0 0 0 1px #050608}
.dfiliac .pip.now{background:#f3cf86;box-shadow:0 0 0 1px #050608,0 0 6px rgba(243,207,134,.65)}
.dfiliac .gem{width:8px;height:12px;clip-path:polygon(50% 0,100% 28%,100% 72%,50% 100%,0 72%,0 28%);background:#26304a}
.dfiliac .gem.lit{background:linear-gradient(180deg,#b7c8ff 0 3px,#6f8fe6 3px 6px,#3f5fc4 6px)}
.dfiliac .gem.spent{background:linear-gradient(180deg,#56648f 0 3px,#344068 3px)}
.dfiliac .foe{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin:0 0 6px;font-size:12px;color:var(--cp-word)}
.dfiliac .foename{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#efe8d6;text-shadow:1px 1px 0 #050608}
.dfiliac .backs{display:inline-flex;align-items:center}
.dfiliac .mb{width:9px;height:13px;background:#16384a;box-shadow:0 0 0 1px #050608,inset 0 0 0 1px #c9a24a}
.dfiliac .mb+.mb{margin-left:-2px}
.dfiliac .foestate{padding:0 6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#f3cf86;background:rgba(84,62,22,.65);box-shadow:0 0 0 1px #050608,inset 0 0 0 1px #7a5424}
.dfiliac .holds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 6px}
.dfiliac .hold{display:flex;flex-direction:column;gap:4px;min-width:0;padding:4px 5px 5px;border-width:2px;border-style:solid;cursor:default}
body .dfiliac .hold.lead-mine{border-top-color:#f3cf86}
body .dfiliac .hold.lead-theirs{border-top-color:#e0584a}
body .dfiliac .hold.target{box-shadow:0 0 0 1px #050608,0 0 0 3px #f3cf86,0 0 12px rgba(243,207,134,.5);cursor:pointer}
.dfiliac .holdhead{display:flex;align-items:flex-start;gap:5px;min-height:${ILIAC_PLACE_CARD_H}px}
.dfiliac .holdart{flex:none;line-height:0;box-shadow:0 0 0 1px #050608}
.dfiliac .holdart canvas{display:block;width:${PLACE_W}px;height:${ILIAC_PLACE_CARD_H}px}
.dfiliac .holdwords{flex:1 1 auto;min-width:0}
.dfiliac .holdname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#efe0b8;text-shadow:1px 1px 0 #050608}
.dfiliac .hold.lead-mine .holdname{color:#f3cf86}
.dfiliac .hold.lead-theirs .holdname{color:var(--cp-red)}
.dfiliac .holdrule{font-size:11px;line-height:1.25;color:var(--cp-dim);overflow-wrap:anywhere}
.dfiliac .lane{display:grid;grid-template-columns:repeat(auto-fill,${LANE_W}px);gap:3px;align-content:start;min-height:${ILIAC_LANE_CARD_H}px}
.dfiliac .duel{display:flex;align-items:center;justify-content:center;gap:5px;min-width:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--cp-dim)}
.dfiliac .duelpart{display:inline-flex;align-items:center;gap:5px;min-width:0}
.dfiliac .duel .duelside{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dfiliac .pw{flex:none;min-width:24px;padding:0 4px;border-width:2px;border-style:solid;text-align:center;font-size:13px;letter-spacing:0;color:#efe8d6;font-variant-numeric:tabular-nums}
body .dfiliac .pw.ahead{border-color:#f3cf86 #7a5424 #5c3f1a #c08a3e;color:#f3cf86}
.dfiliac .ic{position:relative;flex:none;display:inline-block;line-height:0;box-shadow:0 0 0 1px #050608,2px 2px 0 rgba(0,0,0,.4)}
.dfiliac .lane .ic canvas{display:block;width:${LANE_W}px;height:${ILIAC_LANE_CARD_H}px}
.dfiliac .tray .ic canvas{display:block;width:${HAND_W}px;height:${ILIAC_HAND_CARD_H}px}
.dfiliac .ic .icname{display:inline-block;max-width:${HAND_W}px;padding:2px 3px;font-size:11px;line-height:1.2;color:#1a1a1a;background:#f4ecd8}
.dfiliac .ic .p{position:absolute;right:-3px;bottom:-3px;min-width:14px;padding:0 3px;font-size:11px;line-height:14px;text-align:center;color:#fff6ee;background:#8e2a1c;box-shadow:0 0 0 1px #050608}
.dfiliac .ic .p.up{background:#2f7a43}
.dfiliac .ic .p.down{background:#4a1a12;color:#ffb4a6}
.dfiliac .ic.staged{outline:2px dashed #f3cf86;outline-offset:1px;opacity:.85;cursor:pointer}
.dfiliac .ic.staged:focus-visible{outline-style:solid;outline-offset:3px}
.dfiliac .ic.down::after{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(135deg,rgba(8,10,16,.62) 0 3px,rgba(8,10,16,.28) 3px 6px);box-shadow:inset 0 0 0 1px #c9a24a}
.dfiliac .ic .p{z-index:1}
.dfiliac .slot{flex:none;width:${LANE_W}px;height:${ILIAC_LANE_CARD_H}px;background:rgba(4,5,7,.35);box-shadow:inset 0 0 0 1px rgba(163,152,128,.22)}
.dfiliac .tray{display:flex;flex-wrap:wrap;gap:10px 6px;align-items:flex-end;min-height:${ILIAC_HAND_CARD_H + 18}px;margin:0 0 2px;padding:10px 8px 6px;border-width:2px;border-style:solid}
.dfiliac .tray .ic{cursor:pointer}
.dfiliac .tray .ic:hover{z-index:1;transform:translateY(-4px)}
.dfiliac .tray .ic.picked{z-index:2;transform:translateY(-8px);box-shadow:0 0 0 1px #050608,0 0 0 3px #f3cf86,0 0 12px rgba(243,207,134,.55)}
.dfiliac .tray .ic.off{opacity:.45;filter:grayscale(.6);cursor:default}
.dfiliac .tray .ic.off:hover{transform:none}
.dfiliac .tray .ic.used{opacity:.3}
.dfiliac .trayempty{align-self:center;font-size:12px;color:var(--cp-dim)}
.dfiliac .msg.won{color:#f3cf86;border-left-color:#f3cf86;background:linear-gradient(90deg,rgba(243,207,134,.13),transparent 85%)}
.dfiliac .msg.lost{color:#ffc4bb;border-left-color:#b83a2e}
@media (max-width:540px){.dfiliac .holdart{display:none}.dfiliac .holdhead{min-height:0}.dfiliac .duel{flex-direction:column-reverse;gap:2px}.dfiliac .duelto{display:none}}
@media (pointer:coarse){.dfiliac .opt{min-height:44px}}
@media (prefers-reduced-motion:reduce){.dfiliac .tray .ic,.dfiliac .tray .ic:hover,.dfiliac .tray .ic.picked{transform:none}}
`;

/** A press on the panel is the panel's - never a swing or a look (the Hold'em panel's own law). */
const swallowPresses = (node) => {
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) node.addEventListener(t, swallow);
};

/**
 * The panel in the page. `onPress(id, value)`: 'deck' and 'foe' with an index, 'keeps', 'ranked', 'regulars', 'board', 'deal', 'holdem', 'pack',
 * 'pick' with a hand index, 'hold' with a holding, 'unstage' with a staged index, 'commit', 'clear', 'again', 'stand'.
 * `render(model)` repaints; `destroy()` takes it away (once).
 * @param {{onPress: (id: string, value?: number) => void, doc?: any}} p
 */
export function createIliacTableHud({ onPress, doc = document }) {
  if (doc?.getElementById && !doc.getElementById(STYLE_ID)) {
    const s = doc.createElement('style');
    s.id = STYLE_ID; s.textContent = ILIAC_TABLE_CSS;
    (doc.head ?? doc.body)?.append(s);
  }
  dressCardPanel(doc);   // CARDS-PLUS: the kit on the classic skin, the face on every skin
  const root = doc.createElement('div');
  root.className = 'dfiliac';
  root.setAttribute('tabindex', '-1');   // AUDIT CARDS-6 B10: the keyboard's resting place when its control is gone
  swallowPresses(root);
  // AUDIT CARDS-6 B10: Tab in the panel walks its controls - the browser's walk, never the game's dial (QuickDial took
  // it, and nothing past the buttons was ever reached)
  // AUDIT CARDS-PLUS A4: and Space and Enter on the panel itself are the panel's - Space is the game's jump, and a jump
  // stands the player up and concedes (the root holds the keyboard when its control is gone)
  root.addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === ' ' || e.key === 'Enter') e.stopPropagation?.(); });
  doc.body?.append(root);
  try { root.focus?.({ preventScroll: true }); } catch { /* a page that cannot focus */ }   // AUDIT CARDS-6 B10: the keyboard starts in the panel
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  // AUDIT CARDS-6 B10: THE KEYBOARD PLAYS THE PANEL. A row the mouse presses - a deck, a regular, a box, a card of the
  // hand, a holding, a staged card - is in the Tab order and takes Enter or Space as its click; a button's own Enter
  // and Space are the panel's too (never the game's jump or step, which stand the player up). Every control carries a
  // `data-focus` key, and the panel drawn anew gives the keyboard back to the one it was on (the binder page's way,
  // ui/card/cardBinderPage.js) - one gone (a holding no longer a target) hands it to the hand's first card, else to the panel
  // itself (never to a button a stray Enter would press - Concede among them). Only the buttons were reachable: a
  // keyboard dealt the defaults and passed.
  const ACTIVATE = new Set(['Enter', ' ']);
  const pressable = (n, key, fn) => {
    n.setAttribute('tabindex', '0');
    n.setAttribute('role', 'button');
    n.setAttribute('data-focus', key);
    n.addEventListener('click', fn);
    n.addEventListener('keydown', (e) => { if (!ACTIVATE.has(e.key)) return; e.preventDefault?.(); e.stopPropagation?.(); fn(); });
  };
  const focusedKey = () => {
    const a = doc.activeElement;
    return a && a !== root && root.contains?.(a) ? a.getAttribute?.('data-focus') ?? null : null;
  };
  const refocus = (key) => {
    if (!key) return;
    const keyed = [];
    const walk = (n) => { for (const c of n.children ?? []) { if (c.getAttribute?.('data-focus') && !c.disabled) keyed.push(c); walk(c); } };
    walk(root);
    const at = (k) => keyed.find((n) => n.getAttribute('data-focus') === k) ?? null;
    // AUDIT CARDS-PLUS A4: the keyboard goes to a control that TOOK it - one inside the folded body is not drawn, and its
    // focus() left the keyboard on the page's body, where Space is the game's; so each is asked in turn, the panel last
    const took = (n) => { try { n.focus({ preventScroll: true }); } catch { n.focus?.(); } return doc.activeElement === n; };
    for (const n of [at(key), keyed.find((x) => x.getAttribute('data-focus').startsWith('pick-'))]) if (n && took(n)) return;
    took(root);
  };
  // CARDS-PLUS: a card's face is the binder's own painting (ui/card/cardBinderPage.js cardCanvas - at its CSS size and the
  // screen's pixel ratio, 2 at most as the binder paints, so a little card is the painter's tile face; CARDS10 painted
  // twice its size, past the tile's bound, and the hand wore the full face's rules box at 4px), a fresh copy for each
  // place it stands; a page with no canvas writes the card's name
  const canPaint = !!doc.createElement('canvas')?.getContext?.('2d');
  const face = (id, h) => (canPaint ? cardCanvasCopy(doc, id ? cardById(id) ?? null : null, h) : null);
  const card = (c, { h = ILIAC_LANE_CARD_H, cls = '', press = null, value = undefined, power = true } = {}) => {
    // AUDIT CARDS-PLUS (lane A): your own card played face down keeps its face for you under a veil - the other player
    // sees its back, and its text never runs (net/iliac/iliacHand.js: a face-down card is its power alone, unveiled at the end)
    const n = el('span', `ic${cls ? ` ${cls}` : ''}${c.down && c.id ? ' down' : ''}`);
    const cv = face(c.id, h);
    if (cv) n.append(cv); else n.append(el('span', 'icname', c.name));
    // the power it stands at now, beside its printed one - raised green, lowered dark
    const k = power && c.id ? cardById(c.id) : null;
    if (k && k.kind !== 'spell' && k.kind !== 'location') {
      const p = c.power ?? k.power ?? 0;
      n.append(el('span', `p${p > k.power ? ' up' : p < k.power ? ' down' : ''}`, String(p)));
    }
    n.title = c.title ?? '';
    if (press) pressable(n, `${press}-${value}`, () => onPress(press, value));   // AUDIT CARDS-6 B10
    return n;
  };
  /** A holding's lane: its cards from the duel outward, then the places that side has left - a grid as wide as the plate
   *  allows (AUDIT CARDS-PLUS A2: overlapped on a phone, each card covered the next one's power). */
  const lane = (cls, nodes, open) => {
    const n = el('div', `lane ${cls}`);
    n.append(...nodes);
    const places = Math.min(open, SLOTS_MAX);
    for (let k = 0; k < places; k++) n.append(el('i', 'slot'));
    return n;
  };
  /** A choice of the setup: its name, what it is, and whether it is the one chosen (the kit's tile, brass when pressed). */
  const opt = (key, on, enabled, fn, parts, cls = '') => {
    const n = el('div', `opt${cls}${enabled ? '' : ' off'}`);
    n.append(...parts);
    n.setAttribute('aria-pressed', String(!!on));
    if (enabled) pressable(n, key, fn); else n.setAttribute('aria-disabled', 'true');
    return n;
  };
  const section = (head, body) => { const s = el('div', 'ilsec'); s.append(el('div', 'ilsec-head', head), body); return s; };
  let alive = true, shownKey = null, msgEl = null, collapsed = false;
  /** The header's fold - the table's words put away so the cloth shows; the line and the presses stay. Kept across
   *  repaints, as the Hold'em panel's is. */
  const foldToggle = () => {
    const fold = el('span', 'fold', collapsed ? '+' : '−');
    const say = () => {
      fold.textContent = collapsed ? '+' : '−';
      foldWords(fold, collapsed);
      fold.setAttribute('aria-expanded', String(!collapsed));
    };
    say();
    pressable(fold, 'fold', () => { collapsed = !collapsed; root.className = `dfiliac${collapsed ? ' collapsed' : ''}`; say(); });
    return fold;
  };
  return {
    root,
    render(m) {
      if (!alive) return;
      const key = JSON.stringify({ ...m, message: null });
      if (key === shownKey && msgEl) { msgEl.textContent = m.message; return; }
      shownKey = key;
      const kept = focusedKey();   // AUDIT CARDS-6 B10: the keyboard's control, found again below
      root.replaceChildren();
      const head = el('h3', 'tablehead');
      head.append(el('span', 'tabletitle', m.title), foldToggle());
      root.append(head);
      if (m.note) root.append(el('div', 'tablenote', m.note));
      const body = el('div', 'ilbody');
      if (m.phase === 'setup') {
        const decks = el('div', 'opts');
        for (const d of m.decks) {
          decks.append(opt(`deck-${d.i}`, d.chosen, true, () => onPress('deck', d.i), [el('span', 'optname', d.name), ...(d.word ? [el('span', 'optword bad', d.word)] : [])]));
        }
        body.append(section(t('cards.iliac.setup.deck', 'Your deck'), decks));
        if (m.foes.length) {
          const foes = el('div', 'opts');
          for (const f of m.foes) {
            const name = el('span', 'optname', f.name);
            name.append(el('span', 'opttemper', ` (${f.temper})`));
            foes.append(opt(`foe-${f.i}`, f.chosen, true, () => onPress('foe', f.i), [name, ...(f.paid ? [el('span', 'optword paid', t('cards.iliac.setup.paid', 'has paid a card tonight'))] : [])]));
          }
          body.append(section(t('cards.iliac.setup.against', 'Play against'), foes));
        }
        if (m.board) {
          const box = el('div', 'season');
          for (const line of m.board) box.append(el('div', '', line));
          body.append(box);
        }
        const boxes = el('div', 'opts');
        // the boxes a game is dealt with - ticked brass (the kit's tile pressed); one that cannot be ticked says why
        if (m.ranked) boxes.append(opt('ranked', m.ranked.on, m.ranked.enabled, () => onPress('ranked'), [el('span', 'optname', t('cards.iliac.setup.ranked', 'Ranked')), el('span', 'optword', m.ranked.why ?? t('cards.iliac.setup.rankedWhy', 'Counts on the season board. Uses your realm character\'s cards.'))], ' box'));
        if (m.keeps) boxes.append(opt('keeps', m.keeps.on, m.keeps.enabled, () => onPress('keeps'), [el('span', 'optname', t('cards.iliac.setup.keeps', 'Play for a card')), el('span', 'optword', m.keeps.why ?? t('cards.iliac.setup.keepsWhy', 'The loser pays one from their deck'))], ' box'));
        if (m.ranked || m.keeps) body.append(boxes);
      } else {
        if (m.outcome) body.append(el('div', `verdict ${m.outcome}`, VERDICT_WORDS[m.outcome]));
      }
      if (m.phase !== 'setup' && m.dealt) {
        const bar = el('div', 'ilbar');
        const turn = el('div', 'track');
        const pips = el('span', 'pips');
        // AUDIT CARDS-PLUS A5: an ended game lights the turns it reached - a concession on turn 2 is two of six, as its
        // label says, never the whole track
        const reached = Math.min(m.turn, m.turns);
        for (let n = 1; n <= Math.min(m.turns, TRACK_MAX); n++) {
          pips.append(el('i', `pip${m.phase === 'over' ? (n <= reached ? ' past' : '') : n < m.turn ? ' past' : n === m.turn ? ' now' : ''}`));
        }
        turn.append(el('span', '', t('cards.iliac.track.turn', 'Turn')), pips, el('b', '', `${reached}/${m.turns}`));
        bar.append(turn);
        if (!m.spectator) {
          const mana = el('div', 'track');
          const gems = el('span', 'gems');
          const left = Math.max(0, m.me.magicka - m.me.spend);
          for (let k = 0; k < Math.min(m.me.magicka, GEMS_MAX); k++) gems.append(el('i', `gem${k < left ? ' lit' : ' spent'}`));
          mana.append(el('span', '', localizedText('magicka', 'Magicka')), gems, el('b', '', `${left}/${m.me.magicka}`));
          bar.append(mana);
        }
        body.append(bar);
        const foe = el('div', 'foe');
        const backs = el('span', 'backs');
        for (let k = 0; k < Math.min(m.them.hand, BACKS_MAX); k++) backs.append(el('i', 'mb'));
        foe.append(el('span', 'foename', m.them.name), backs, el('span', '', t('cards.iliac.foe.counts', '{hand} in hand · {deck} in deck', { hand: m.them.hand, deck: m.them.deck })));
        if (m.them.committed) foe.append(el('span', 'foestate', t('cards.iliac.foe.committed', 'Committed')));
        body.append(foe);
        const holds = el('div', 'holds');
        for (const hd of m.holdings) {
          // AUDIT CARDS-PLUS A7: the plate's edge says who holds it as yours or theirs - a watcher has neither (the duel's
          // lit number says which side leads)
          const box = el('div', `hold${hd.target ? ' target' : ''}${hd.lead && !m.spectator ? ` lead-${hd.lead}` : ''}`);
          box.title = `${hd.name} - ${hd.text}`;
          const top = el('div', 'holdhead');
          const art = face(hd.id, ILIAC_PLACE_CARD_H);
          if (art) { const a = el('span', 'holdart'); a.append(art); top.append(a); }
          const words = el('div', 'holdwords');
          words.append(el('div', 'holdname', hd.name), el('div', 'holdrule', hd.text));
          top.append(words);
          // the power each way, each number with its side's word (AUDIT CARDS-PLUS A2: on a phone the words fell away and
          // "21 - 22" said nobody's) - one line, "21 YOU - THEM 22"; on a phone two, theirs over their lane, yours over yours
          const duel = el('div', 'duel');
          const part = (k) => {
            const g = el('span', 'duelpart');
            const pw = el('b', `pw${hd.lead === (k ? 'theirs' : 'mine') ? ' ahead' : ''}`, String(hd.power[k]));
            const word = el('span', 'duelside', m.sides?.[k] ?? (k ? 'them' : 'you'));
            if (k) g.append(word, pw); else g.append(pw, word);
            return g;
          };
          duel.append(part(0), el('span', 'duelto', '-'), part(1));
          box.append(top, lane('theirs', hd.theirs.map((c) => card(c)), hd.open?.[1] ?? 0), duel,
            lane('mine', [...hd.mine.map((c) => card(c)), ...hd.staged.map((c) => card(c, { cls: 'staged', press: 'unstage', value: c.staged, power: false }))], hd.open?.[0] ?? 0));
          if (hd.target) pressable(box, `hold-${hd.h}`, () => onPress('hold', hd.h));
          holds.append(box);
        }
        body.append(holds);
        if (!m.spectator) {
          const tray = el('div', 'tray');
          for (const c of m.hand) tray.append(card(c, { h: ILIAC_HAND_CARD_H, cls: c.picked ? 'picked' : c.staged ? 'used' : c.playable ? '' : 'off', press: c.playable || c.picked ? 'pick' : null, value: c.i, power: false }));
          if (!m.hand.length) tray.append(el('span', 'trayempty', t('cards.iliac.hand.empty', 'No cards in hand.')));
          body.append(tray);
        }
      }
      root.append(body);
      msgEl = el('div', `msg${m.tone ? ` ${m.tone}` : ''}`, m.message);
      root.append(msgEl);
      const acts = el('div', 'tableacts');
      for (const a of m.actions) {
        const b = el('button', '', a.label);
        b.disabled = !a.enabled;
        if (a.kind) b.dataset.kind = a.kind;   // CARDS-PLUS: the kit's primary, its blood-edged warn, a quiet press at the row's end
        b.setAttribute('data-focus', `act-${a.id}`);   // AUDIT CARDS-6 B10: its key, and its Enter and Space its own
        b.addEventListener('keydown', (e) => { if (ACTIVATE.has(e.key)) e.stopPropagation?.(); });
        b.addEventListener('click', () => { if (a.enabled) onPress(a.id); });
        acts.append(b);
      }
      root.append(acts);
      // CARDS-PLUS: a line a sentence, the newest last and in view (the Hold'em panel's CARDS-PANEL law) - one run of
      // sentences under a hidden overflow cut the newest off at the box
      if (m.log?.length) {
        const log = el('div', 'log');
        log.append(...m.log.map((line) => el('div', '', line)));
        root.append(log);
        log.scrollTop = log.scrollHeight ?? 0;
      }
      refocus(kept);
    },
    destroy() { if (!alive) return; alive = false; root.remove?.(); },
  };
}
