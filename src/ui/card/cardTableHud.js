// @ts-check
// CARDS4 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 14): THE CARD TABLE'S PANEL - the port's own enhanced
// panel, no DFU window behind it (Daggerfall has no card games), so the native-window rule's DFU citations have nothing
// to cite. CARDS-PLUS (section 38): it wears the Enhanced Plus stone-and-brass kit and the game's face whichever skin is
// worn (ui/card/cardPanelKit.js - this sheet writes geometry and words, the kit paints). It does NOT pause the world: the
// patrons play on while it stands, as the table does (a DOM panel outside the window stack, the decor panel's own
// pattern - ui/decorPanel.js).
//
// TWO HALVES. `cardHudModel` is pure: the table's view (systems/card/cardTableSession.js view(), legal()) as the rows,
// cards and buttons the panel shows - every label and every enabled flag decided here, pinned by
// test/systems/card/cards4_hud.test.js. `createCardTableHud` paints that model into the page and hands presses back to the host.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { rankOf, suitOf, isCard } from '../../net/card/cardLaw.js';
import { SUIT_CROWNS, rankLabel, cardTitle, paintFace, paintBack } from '../../render/cardFaces.js';   // CARDS-BAY: the suits' one home
import { BUY_IN_MIN_BB, BUY_IN_START_BB } from '../../systems/card/cardTableSession.js';   // the buy-in's one home (AUDIT CARDS-2 L10)
import { noteFirstUse } from '../../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page
import { cardPanelChromeCss, dressCardPanel, foldWords } from './cardPanelKit.js';   // CARDS-PLUS: the kit and the face, both panels' one home
import { PIXELIFY_FIVE_FACE } from '../pixelifyFive.js';   // FIX-D: the face's five, carried by every sheet that sets it
import { playGambitWord } from '../gambitTableWords.js';   // KG3: the third game's press, in the player's language

/** A card as the panel shows it (CARDS-BAY): its own painted face (`card`), the words a page without a canvas writes
 *  - `{text: 'K Daggerfall'}` in the crown's colour - and what the hover says; or a face-down card. */
export const cardFace = (c) => (isCard(c)
  ? { card: c, text: `${rankLabel(rankOf(c))} ${SUIT_CROWNS[suitOf(c)].crown}`, colour: SUIT_CROWNS[suitOf(c)].colour, title: cardTitle(c) }
  : { card: -1, text: '', colour: null, title: cardTitle(c), back: true });
/** MEASURE (CARDS-BAY): the panel's little card, CSS pixels (the cloth's 128 x 180 cell at a quarter, painted at half). */
export const PANEL_CARD_W = 32;
export const PANEL_CARD_H = 45;

/** CARDS-PANEL (Tavern-Cards section 36): the buy-in's quick stakes - its floor and its ceiling, a press setting the
 *  slider (never dealing); none when the two are one. */
export const buyInPicks = (b) => (b && b.max > b.min ? [{ label: 'Min', value: b.min }, { label: 'Max', value: b.max }] : []);
/**
 * CARDS-PANEL: a raise's quick sizes - half the pot and the pot, as a raise TO (the street's total): the bet faced, then
 * the pot once called, or its half. Each on the slider's step from its floor, strictly inside the law's range (the floor
 * is where the slider starts, the ceiling is All in), one per amount. A press sets the slider; the raise is still pressed.
 * @param {{min: number, max: number}} raise  legal().raise
 * @param {number} currentBet  the street's bet faced
 * @param {number} call  what calling it costs this seat
 * @param {number} pot  every chip in the hand, this street's bets too
 * @param {number} step  the slider's step
 */
export function raisePicks(raise, currentBet, call, pot, step) {
  const s = Math.max(1, step | 0), out = [];
  for (const [label, add] of /** @type {[string, number][]} */ ([['½ pot', Math.floor((pot + call) / 2)], ['Pot', pot + call]])) {
    const to = Math.min(raise.max, raise.min + Math.round((currentBet + add - raise.min) / s) * s);
    if (to > raise.min && to < raise.max && !out.some((p) => p.to === to)) out.push({ label, to });
  }
  return out;
}

/**
 * The panel's model.
 * @param {{phase: 'buyin'|'playing'|'over', view?: any, legal?: any, buyIn?: {min: number, max: number}|null, stakes: {sb: number, bb: number}, friendly?: boolean, log?: string[], why?: string|null, refused?: string|null, online?: {waiting: boolean, clock: number, error: string|null, regulars?: boolean, gold?: boolean}|null, gold?: boolean, staking?: boolean, topUp?: number|null, iliac?: boolean, gambit?: boolean, packPrice?: number|null}} p
 */
export function cardHudModel({ phase, view = null, legal = null, buyIn = null, stakes, friendly = false, log = [], why = null, online = null, gold = false, staking = false, topUp = null, iliac = false, gambit = false, packPrice = null, refused = null }) {
  const unit = friendly ? 'chips' : 'gold';
  const title = `Card table - ${stakes.sb}/${stakes.bb} ${unit}`;
  // CARDS6: online, a realm character's table plays for gold - the realm holds the stake, the relay deals
  const note = gold ? 'A gold table. The realm holds your stake, and you keep what you have when you stand up.'
    : online ? 'A friendly game with the room. No gold changes hands.' : friendly ? 'A friendly game. Online, no gold changes hands at a patrons\' table.' : null;
  if (phase === 'buyin') {
    return {
      phase, title, note, unit,
      // CARDS-PANEL: what the line is - a refusal or a purse too thin to sit is a warning, a stake being asked a wait
      tone: staking ? 'wait' : refused || !buyIn ? 'warn' : null,
      buyIn: buyIn ? { min: buyIn.min, max: buyIn.max, value: Math.min(buyIn.max, Math.max(buyIn.min, BUY_IN_START_BB * stakes.bb)), picks: buyInPicks(buyIn) } : null,
      // CARDS-SAID (Tavern-Cards section 31): a stake the realm refused, said here until the next press - never the panel
      // as it was, as though the press did nothing
      message: staking ? 'The realm is holding your stake...' : refused ? `${refused}${buyIn ? ` (Buy in for ${buyIn.min}-${buyIn.max} ${unit}.)` : ''}` : buyIn ? `Buy in for ${buyIn.min}-${buyIn.max} ${unit}.` : `You need ${BUY_IN_MIN_BB * stakes.bb} ${unit} to sit in at these stakes.`,
      actions: [
        { id: 'deal', label: 'Deal me in', enabled: !!buyIn && !staking },   // CARDS6: one stake at a time
        ...(iliac ? [{ id: 'iliac', label: 'Play Iliac Hand', enabled: !staking }] : []),   // CARDS10: the other game at this table
        ...(gambit ? [{ id: 'gambit', label: playGambitWord(), enabled: !staking }] : []),   // KG3: and the third - its Features switch on
        ...(packPrice ? [{ id: 'pack', label: `Buy a card pack (${packPrice} gold)`, enabled: !staking }] : []),   // CARDS9: the house sells packs
        { id: 'stand', label: 'Stand up', enabled: true },
      ],
    };
  }
  const hand = view?.hand ?? null;
  // AUDIT CARDS-2 M7: between hands the last showdown stays on the panel - the hands shown, the board, the winners - so
  // you see what beat you
  const sd = !hand ? view?.showdown ?? null : null;
  const you = view ? view.seats.findIndex((s) => s.kind === 'player') : -1;
  const won = sd ? new Set(showdownWinners(sd).flatMap((w) => w.seats)) : null;
  const seats = (view?.seats ?? []).map((s, i) => {
    const k = view.handSeats.indexOf(i);
    const h = hand && k >= 0 ? hand.seats[k] : null;
    const shown = sd ? sd.holes?.[sd.seats.indexOf(i)] ?? null : null;
    return {
      name: s.name, you: i === you, stack: h ? h.stack : s.stack, bet: h ? h.bet : 0,
      button: i === view.button,
      state: s.gone ? 'gone' : sd ? (won.has(i) ? 'won' : '') : !h ? (hand ? 'out' : '') : h.folded ? 'folded' : h.allIn ? 'all in' : hand.toAct === k ? 'to act' : '',
      cards: sd ? (shown ? shown.map(cardFace) : []) : h && h.hole ? h.hole.map(cardFace) : h && !h.folded ? [cardFace(-1), cardFace(-1)] : [],
    };
  });
  const pot = hand ? hand.seats.reduce((a, s) => a + s.total, 0) : sd ? sd.result.pots.reduce((a, p) => a + p.amount, 0) : 0;
  // CARDS5: a relay table's empty chairs are no seats to show
  const present = seats.filter((_, i) => view.seats[i].kind !== 'empty');
  const actions = [];
  if (phase === 'playing' && legal) {
    actions.push({ id: 'fold', label: 'Fold', enabled: true });
    actions.push(legal.check ? { id: 'check', label: 'Check', enabled: true } : { id: 'call', label: `Call ${legal.call}`, enabled: legal.call > 0 });
    if (legal.raise) {
      const bet = hand.currentBet === 0;
      const step = Math.max(1, stakes.sb);
      actions.push({ id: 'raise', label: bet ? 'Bet' : 'Raise to', enabled: true, min: legal.raise.min, max: legal.raise.max, step, picks: raisePicks(legal.raise, hand.currentBet, legal.call, pot, step) });
      actions.push({ id: 'allin', label: `All in (${legal.raise.max})`, enabled: true, to: legal.raise.max });
    }
  }
  // CARDS5: alone at the relay's table, the regulars are a game too
  if (online?.waiting && online.regulars !== false) actions.push({ id: 'regulars', label: 'Play the regulars', enabled: true });   // AUDIT CARDS-3 B11: only with a chair for one
  if (phase === 'playing' && topUp > 0) actions.push({ id: 'topup', label: `Top up ${topUp}`, enabled: !staking });   // CARDS6 follow-up: between hands, a gold seat
  // AUDIT CARDS-6 E7: the other game and the house's packs whenever he is not in a hand at the relay's table - it sits
  // him at once (no buy-in panel, where alone they stood), so a player online never saw "Play Iliac Hand"; and on the
  // panel that says a cloth plays Iliac Hand already (E8: 'other game')
  const inHand = !!hand && view.handSeats.includes(you);
  if ((online && !inHand) || (phase === 'over' && why === 'other game')) {
    if (iliac) actions.push({ id: 'iliac', label: 'Play Iliac Hand', enabled: !staking });
    if (gambit) actions.push({ id: 'gambit', label: playGambitWord(), enabled: !staking });   // KG3: the third game - the tavern's regulars, never the relay's table
    if (packPrice) actions.push({ id: 'pack', label: `Buy a card pack (${packPrice} gold)`, enabled: !staking });
  }
  actions.push({ id: 'stand', label: phase === 'over' ? 'Leave the table' : 'Stand up', enabled: true });
  const message = phase === 'over'
    ? (why === 'broke' ? 'You are out of chips.' : why === 'empty' ? 'The table has emptied. Every patron is broke.' : why === 'stood' ? 'You were removed from the table.' : why === 'other game' ? HOLDEM_REFUSALS['other game'] : 'You leave the table.')
    : sd ? showdownLine(sd, view.seats.map((x) => x.name), you)
      : online?.waiting ? 'Waiting for another player to sit down.'
      : !hand ? 'The next hand is being dealt...' : legal ? (online?.clock ? `Your turn - ${online.clock} s.` : 'Your turn.') : `Waiting on ${seats.find((s) => s.state === 'to act')?.name ?? 'the table'}...`;
  return {
    phase, title, note, unit, seats: present, pot,
    board: hand ? hand.board.map(cardFace) : sd ? sd.board.map(cardFace) : [],
    street: hand?.street ?? (sd ? 'showdown' : null),
    // CARDS-PANEL: the relay's refusal is a warning, your turn the line to look at
    tone: online?.error && !legal ? 'warn' : phase === 'playing' && legal ? 'turn' : null,
    actions, message: online?.error && !legal ? `${message} (${HOLDEM_REFUSALS[online.error] ?? 'The table refused that.'})` : message, log: log.slice(-6),
  };
}

/**
 * A showdown's winners, pot by pot - `[{pot, amount, seats, cat}]` (this.seats indices; `cat` the hand's category when it
 * was shown). AUDIT CARDS-2 M8: only a CONTESTED pot is won - an uncalled bet coming home is a pot of one, nobody's win,
 * and the first audit's line counted it ("You and Ana split the pot" for a hand you lost).
 * @param {{seats: number[], result: any}} sd
 */
export function showdownWinners(sd) {
  const pots = sd.result.pots.map((p, i) => ({ ...p, i }));
  const contested = sd.result.shown ? pots.filter((p) => p.eligible.length > 1) : pots.slice(0, 1);
  return contested.map((p) => ({
    pot: p.i, amount: p.amount, seats: p.winners.map((k) => sd.seats[k] ?? k),
    cat: sd.result.shown && p.winners.length ? sd.result.hands?.[p.winners[0]]?.cat ?? null : null,
  }));
}

/** A hand as the log says it - "a flush", "two pair", "three of a kind" (HAND_NAMES' order). */
export const HAND_SAID = Object.freeze(['high card', 'a pair', 'two pair', 'three of a kind', 'a straight', 'a flush', 'a full house', 'four of a kind', 'a straight flush']);

/** The showdown said: who took which pot, and with what (`you` the player's this.seats index - said as "You"). */
export function showdownLine(sd, names, you = -1) {
  const lines = showdownWinners(sd).map((w, n) => {
    const who = w.seats.map((i) => (i === you ? 'You' : names[i] ?? 'Someone'));
    const one = who.length === 1;
    const verb = !one ? 'split' : w.seats[0] === you ? 'take' : 'takes';
    const what = n === 0 ? 'the pot' : 'a side pot';
    const how = w.cat != null ? ` with ${HAND_SAID[w.cat]}` : '';
    return `${who.join(' and ')} ${verb} ${what}${how}.`;
  });
  return lines.length ? lines.join(' ') : 'The hand is over.';
}

/** CARDS5: the relay's refusals as the panel says them. AUDIT CARDS-6 E8: and 'other game' - the cloth plays another
 *  game (the relay's own word; iliacTableGame.js says its mirror) - KG5: Iliac Hand or The King's Gambit, so the words
 *  name neither - said on a panel of its own that offers the other games. */
export const HOLDEM_REFUSALS = Object.freeze({ 'other game': 'Another game is being played at this table.', taken: 'That chair is taken.', seated: 'You already sit at this table.', 'not your turn': 'It is not your turn.', refused: 'The table refused that.', 'no table': 'The table has closed.', 'bad table': 'The table cannot open.', 'no such chair': 'No such chair.', 'no hand': 'No hand is being played.', 'table differs': 'That table is set up for different seats or stakes.', 'account seated': 'You already sit at a table here.', busy: 'The table is busy. Try again.', 'gold table': 'That table plays for gold. Only a realm character can stake there.', 'friendly table': 'That table plays for chips.', 'bad stake': 'That stake is outside the table\'s buy-in.', 'stake spent': 'That stake has been spent. Buy in again to sit.', 'stake refused': 'The table will not take that stake.', 'stake elsewhere': 'That stake was for another table. It has been returned to you.', 'stakes closed': 'The table cannot take stakes right now.', 'stake too old': 'That stake is too old to return here.', 'cashed out': 'Your stake there has been returned. Buy in again to sit.', 'in hand': 'Top up between hands.', 'not seated': 'You are not seated at that table.' });

/** A one-line account of a session event for the panel's log (`names` this.seats' names; `you` the player's index, said in
 *  the second person - AUDIT CARDS-2 L10). */
export function eventLine(e, names, you = -1) {
  const me = e.seat === you;
  const who = me ? 'You' : names[e.seat] ?? 'Someone';
  const s = me ? '' : 's';
  switch (e.t) {
    case 'hand': return `Hand ${e.hand}: ${e.button === you ? 'you deal' : `${names[e.button] ?? 'someone'} deals`}.`;
    case 'act':
      if (e.timeout) return `${who} ${me ? 'are' : 'is'} out of time and ${e.type === 'check' ? (me ? 'check' : 'checks') : (me ? 'fold' : 'folds')}.`;   // CARDS5: the seat's clock
      if (e.allIn) return `${who} ${me ? 'go' : 'goes'} all in${e.paid > 0 ? ` (${e.paid})` : ''}.`;
      if (e.type === 'raise') return e.bet ? `${who} bet${s} ${e.to}.` : `${who} raise${s} to ${e.to}.`;
      if (e.type === 'call') return `${who} call${s} ${e.paid}.`;
      return `${who} ${e.type}${s}.`;
    case 'street': return `The ${e.street}.`;
    case 'showdown': return showdownLine(e, names, you);
    case 'leave': return e.broke === undefined ? `${e.name} is broke and leaves for the night.` : me ? (e.broke ? 'You are out of chips and stand up.' : 'You stand up.') : e.broke ? `${e.name} is out of chips and stands up.` : `${e.name} stands up.`;   // CARDS5: a player at the relay's table, not a regular; AUDIT CARDS-3 B7: said to me when it is me
    case 'sit': return me ? 'You sit down.' : `${e.name} sits down.`;
    case 'topup': return me ? `You top up by ${e.amount} gold.` : `${e.name} tops up by ${e.amount}.`;   // CARDS6 follow-up
    case 'over': return e.why === 'broke' ? 'You are broke.' : e.why === 'empty' ? 'The table has emptied.' : 'You stand up.';
    default: return '';
  }
}

const STYLE_ID = 'dfcards-style';
/** The keys a range input answers. */
const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
/** CARDS-PLUS: the panel's own sheet - its place, its seats, its cards and its board; the chrome (the window's box, the
 *  header band, the line, the presses, the log) is ui/card/cardPanelKit.js's, and every surface's paint is the kit's by role
 *  (ui/enhanced/enhancedFrame.js FRAME_ROLES: the window, a seat a panel, the board a well, the pot a chip, the presses). A state
 *  the kit does not know - your seat, the one to act, the winner's - is said here with a leading body, to outweigh the
 *  role it stands in. AUDIT CARDS-PLUS C3/C4: an edge here is a width and a style, never a colour (the pot's
 *  `border:2px solid` outweighed the kit's chip and painted it brass); the board wraps its pot under the river's five
 *  cards on a phone; the panel scrolls inside the screen's height - the chrome's, both panels' (six seats and a log, or a
 *  landscape phone's touch-sized presses, stood its title and its fold off the top - B2). A theme or the DFO Grimoire
 *  dress that repaints a seat's role re-says its states in its own colours (B1, B7). */
export const CARD_TABLE_CSS = `
${PIXELIFY_FIVE_FACE}
${cardPanelChromeCss('.dfcards')}
.dfcards{left:50%;bottom:18px;transform:translateX(-50%);box-sizing:border-box;min-width:min(520px,calc(100vw - 32px));max-width:min(760px,calc(100vw - 32px))}
@media (min-width:1000px){.dfcards{left:auto;right:16px;transform:none;min-width:0;width:430px}}
.dfcards.collapsed .seats,.dfcards.collapsed .board{display:none}
.dfcards .seats{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px}
.dfcards .seat{flex:1 1 90px;min-width:0;padding:4px 6px 5px;border-width:2px;border-style:solid}
body .dfcards .seat.you{border-color:#f3cf86 #7a5424 #5c3f1a #c08a3e}
body .dfcards .seat.to-act{box-shadow:0 0 0 1px #050608,inset 0 0 0 1px rgba(243,207,134,.85),0 0 10px rgba(243,207,134,.35)}
body .dfcards .seat.won{border-color:#f3cf86 #7a5424 #5c3f1a #c08a3e;background-color:rgba(84,62,22,.85)}
.dfcards .seat.folded,.dfcards .seat.gone,.dfcards .seat.out{opacity:.5}
.dfcards .seat .nm{font-size:13px;color:#efe8d6;overflow-wrap:anywhere;text-shadow:1px 1px 0 #050608}
.dfcards .seat.you .nm,.dfcards .seat.won .nm{color:#f3cf86}
.dfcards .seat .st{font-size:12px;color:var(--cp-word);font-variant-numeric:tabular-nums}
.dfcards .cards{display:flex;gap:4px;align-items:center;min-height:45px;margin-top:3px}
.dfcards .card-face{display:inline-block;min-width:26px;padding:3px 4px;background:#f4ecd8;color:#1a1a1a;text-align:center;font-size:14px;box-shadow:0 0 0 1px #050608}
.dfcards .card-face.painted{padding:0;min-width:0;width:32px;height:45px;background:none;line-height:0;box-shadow:0 0 0 1px #050608,2px 2px 0 rgba(0,0,0,.45)}
.dfcards .card-face.painted canvas{display:block;width:32px;height:45px}
.dfcards .card-face.back{background:repeating-linear-gradient(45deg,#5a1e1e,#5a1e1e 4px,#7a2a2a 4px,#7a2a2a 8px)}
.dfcards .board{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin:0 0 6px;padding:5px 6px;border-width:2px;border-style:solid}
.dfcards .board .cards{margin:0}
.dfcards .board .pot{margin-left:auto;padding:2px 8px;border-width:2px;border-style:solid;font-size:13px;color:#f3cf86;white-space:nowrap;text-shadow:1px 1px 0 #050608}
.dfcards .slide{display:flex;flex-wrap:wrap;gap:6px;align-items:center;flex:1 1 100%}
.dfcards .slide .amt{min-width:72px;color:#f3cf86;font-variant-numeric:tabular-nums;text-shadow:1px 1px 0 #050608}
.dfcards button.pick{padding:1px 8px;font-size:12px}
.dfcards input[type=range]{width:min(160px,40vw);flex:1 1 120px}
`;
/** CARDS-PANEL: the action buttons drawn heavier - the press that moves the game on - and the one that leaves, lighter. */
const PRIMARY_ACTS = new Set(['deal', 'check', 'call']);
const QUIET_ACTS = new Set(['stand']);

/** A press on the panel is the panel's - never a swing or a look (decorPanel.js's own law). */
const swallowPresses = (node) => {
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) node.addEventListener(t, swallow);
};

/**
 * The panel in the page. `onPress(id, value)` - 'deal' with the buy-in, 'fold', 'check', 'call', 'raise' with its total,
 * 'allin', 'stand'. `render(model)` repaints; `destroy()` takes it away (once).
 * @param {{onPress: (id: string, value?: number) => void, doc?: any}} p
 */
export function createCardTableHud({ onPress, doc = document }) {
  noteFirstUse('tavern-cards');   // TUT1: the first seat at a card table
  if (doc?.getElementById && !doc.getElementById(STYLE_ID)) {
    const s = doc.createElement('style');
    s.id = STYLE_ID; s.textContent = CARD_TABLE_CSS;
    (doc.head ?? doc.body)?.append(s);
  }
  dressCardPanel(doc);   // CARDS-PLUS: the kit on the classic skin, the face on every skin
  const root = doc.createElement('div');
  root.className = 'dfcards';
  swallowPresses(root);
  // a slider's own keys are the slider's - never a step that stands you up; every other key is the game's, so Escape and
  // the activate key still stand you up and the function keys still save and load (AUDIT CARDS-2 L8)
  root.addEventListener('keydown', (e) => { if (e.target?.type === 'range' && SLIDER_KEYS.has(e.key)) e.stopPropagation(); });
  doc.body?.append(root);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  // CARDS-BAY: each card its own painted face, the cloth's painter at the panel's size; a page with no canvas writes it
  const painted = (c) => {
    const cv = doc.createElement('canvas'), ctx = cv.getContext?.('2d');
    if (!ctx) return null;
    cv.width = PANEL_CARD_W * 2; cv.height = PANEL_CARD_H * 2;
    if (c.back) paintBack(ctx, cv.width, cv.height); else paintFace(ctx, c.card, cv.width, cv.height);
    return cv;
  };
  const cardsOf = (list) => {
    const box = el('div', 'cards');
    for (const c of list) {
      const cv = painted(c);
      const n = el('span', `card-face${cv ? ' painted' : ''}${c.back ? ' back' : ''}`, cv ? null : c.text);   // CARDS-PLUS: its own word - the bare .card is a settings card's
      if (cv) n.append(cv);
      if (c.colour && n.style) n.style.color = c.colour;
      n.title = c.title;
      box.append(n);
    }
    return box;
  };
  let alive = true, sliderValue = null, shownKey = null, msgEl = null, collapsed = false;
  /** CARDS-PANEL: a slider's amount as it reads beside it - the table's unit after it. */
  const amount = (v, m) => `${v}${m.unit ? ` ${m.unit}` : ''}`;
  /** CARDS-PANEL: quick stakes beside a slider - a press moves the slider (and what it says), never deals or raises. */
  const picksFor = (list, range, onPick) => list.map((p) => {
    const b = el('button', 'pick', p.label);
    b.title = String(p.value ?? p.to);
    b.addEventListener('click', () => { range.value = String(p.value ?? p.to); sliderValue = Number(range.value); onPick(); });
    return b;
  });
  /** CARDS-PANEL: the header's fold - the seats, the board, the note and the log put away so the cloth shows; the line
   *  and the buttons stay. The panel's own choice, kept across its repaints. */
  const foldToggle = () => {
    const fold = el('span', 'fold', collapsed ? '+' : '−');
    fold.setAttribute?.('role', 'button'); fold.setAttribute?.('tabindex', '0');
    const say = () => {
      fold.textContent = collapsed ? '+' : '−';
      foldWords(fold, collapsed);
      fold.setAttribute?.('aria-expanded', String(!collapsed));
    };
    say();
    const flip = () => { collapsed = !collapsed; root.className = `dfcards${collapsed ? ' collapsed' : ''}`; say(); };
    fold.addEventListener('click', flip);
    fold.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault?.(); e.stopPropagation?.(); flip(); } });
    return fold;
  };
  return {
    root,
    render(m) {
      if (!alive) return;
      // AUDIT CARDS-3 B5: a model that differs only in its message (the turn's clock, once a second) is the message
      // rewritten in place - a rebuild threw away the slider being dragged and the button being pressed
      const key = JSON.stringify({ ...m, message: null });
      if (key === shownKey && msgEl) { msgEl.textContent = m.message; return; }
      shownKey = key;
      root.replaceChildren();
      const head = el('h3', 'tablehead');   // CARDS-PLUS: the kit's header band
      head.append(el('span', 'tabletitle', m.title), foldToggle());
      root.append(head);
      if (m.note) root.append(el('div', 'tablenote', m.note));
      if (m.seats) {
        const seats = el('div', 'seats');
        for (const s of m.seats) {
          const box = el('div', `seat${s.you ? ' you' : ''}${s.state ? ` ${s.state.replace(' ', '-')}` : ''}`);
          box.append(el('div', 'nm', `${s.button ? '● ' : ''}${s.name}${s.state && s.state !== 'to act' ? ` (${s.state})` : ''}`));
          box.append(el('div', 'st', `${s.stack}${s.bet ? ` - in ${s.bet}` : ''}`));
          box.append(cardsOf(s.cards));
          seats.append(box);
        }
        root.append(seats);
        const board = el('div', 'board');
        board.append(cardsOf(m.board), el('span', 'pot', `${m.street && m.street !== 'preflop' ? `${m.street[0].toUpperCase()}${m.street.slice(1)} - ` : ''}Pot ${m.pot}`));   // AUDIT CARDS-2 L15: the street named
        root.append(board);
      }
      msgEl = el('div', `msg${m.tone ? ` ${m.tone}` : ''}`, m.message);
      root.append(msgEl);
      const acts = el('div', 'tableacts');
      if (m.buyIn) {
        const row = el('div', 'slide');
        const range = el('input');
        range.type = 'range'; range.min = String(m.buyIn.min); range.max = String(m.buyIn.max); range.step = '1';
        range.value = String(sliderValue ?? m.buyIn.value);
        const label = el('span', 'amt', amount(range.value, m));
        range.addEventListener('input', () => { sliderValue = Number(range.value); label.textContent = amount(range.value, m); });
        row.append(range, label, ...picksFor(m.buyIn.picks ?? [], range, () => { label.textContent = amount(range.value, m); }));
        acts.append(row);
      }
      for (const a of m.actions) {
        if (a.id === 'raise') {
          const row = el('div', 'slide');
          const range = el('input');
          range.type = 'range'; range.min = String(a.min); range.max = String(a.max); range.step = String(a.step);
          range.value = String(Math.min(a.max, Math.max(a.min, sliderValue ?? a.min)));
          const b = el('button', '', `${a.label} ${range.value}`);
          range.addEventListener('input', () => { sliderValue = Number(range.value); b.textContent = `${a.label} ${range.value}`; });
          b.addEventListener('click', () => onPress('raise', Number(range.value)));
          row.append(range, b, ...picksFor(a.picks ?? [], range, () => { b.textContent = `${a.label} ${range.value}`; }));
          acts.append(row);
          continue;
        }
        const b = el('button', '', a.label);
        if (PRIMARY_ACTS.has(a.id)) b.dataset.kind = 'primary';
        else if (QUIET_ACTS.has(a.id)) b.dataset.kind = 'quiet';
        b.disabled = !a.enabled;
        b.addEventListener('click', () => {
          if (!a.enabled) return;
          if (a.id === 'deal') onPress('deal', Number(sliderValue ?? m.buyIn?.value ?? 0));
          else if (a.id === 'allin') onPress('raise', a.to);
          else onPress(a.id);
        });
        acts.append(b);
      }
      root.append(acts);
      // CARDS-PANEL: a line a sentence, the newest last and in view - the run of sentences cut the newest off at the box
      if (m.log?.length) {
        const log = el('div', 'log');
        log.append(...m.log.map((line) => el('div', '', line)));
        root.append(log);
        log.scrollTop = log.scrollHeight ?? 0;
      }
    },
    /** A new hand forgets the last raise's slider. */
    resetSlider() { sliderValue = null; shownKey = null; },   // the next render rebuilds the slider at the law's own value
    /** CARDS3b: the slider's value (the raise a drag of chips carries), or null when untouched. */
    sliderValue: () => sliderValue,
    destroy() { if (!alive) return; alive = false; root.remove?.(); },
  };
}
