// @ts-check
// CARDS4 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 14): THE CARD TABLE'S PANEL - the port's own enhanced
// panel, no DFU window behind it (Daggerfall has no card games), so the native-window rule's DFU citations have nothing
// to cite; it keeps the enhanced skin's dark plate and gold. It does NOT pause the world: the patrons play on while it
// stands, as the table does (a DOM panel outside the window stack, the decor panel's own pattern - ui/decorPanel.js).
//
// TWO HALVES. `cardHudModel` is pure: the table's view (systems/cardTableSession.js view(), legal()) as the rows,
// cards and buttons the panel shows - every label and every enabled flag decided here, pinned by
// test/cards4_hud.test.js. `createCardTableHud` paints that model into the page and hands presses back to the host.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { RANKS, rankOf, suitOf, isCard } from '../net/cardLaw.js';

/** The suits as the table draws them: spades, hearts, diamonds, clubs in cardLaw's own order (c, d, h, s). */
export const SUIT_GLYPHS = Object.freeze(['♣', '♦', '♥', '♠']);
/** A card as the panel writes it - `{text: 'A♠', red}` - or a face-down card. */
export const cardFace = (c) => (isCard(c)
  ? { text: `${RANKS[rankOf(c)] === 'T' ? '10' : RANKS[rankOf(c)]}${SUIT_GLYPHS[suitOf(c)]}`, red: suitOf(c) === 1 || suitOf(c) === 2 }
  : { text: '', red: false, back: true });

/**
 * The panel's model.
 * @param {{phase: 'buyin'|'playing'|'over', view?: any, legal?: any, buyIn?: {min: number, max: number}|null, stakes: {sb: number, bb: number}, friendly?: boolean, log?: string[], why?: string|null}} p
 */
export function cardHudModel({ phase, view = null, legal = null, buyIn = null, stakes, friendly = false, log = [], why = null }) {
  const unit = friendly ? 'chips' : 'gold';
  const title = `Card table - ${stakes.sb}/${stakes.bb} ${unit}`;
  const note = friendly ? 'A friendly game: online, no gold changes hands at a patrons\' table.' : null;
  if (phase === 'buyin') {
    return {
      phase, title, note,
      buyIn: buyIn ? { min: buyIn.min, max: buyIn.max, value: Math.min(buyIn.max, Math.max(buyIn.min, 40 * stakes.bb)) } : null,
      message: buyIn ? `Buy in for ${buyIn.min}-${buyIn.max} ${unit}.` : `You need ${20 * stakes.bb} ${unit} to sit in at these stakes.`,
      actions: [{ id: 'deal', label: 'Deal me in', enabled: !!buyIn }, { id: 'stand', label: 'Stand up', enabled: true }],
    };
  }
  const hand = view?.hand ?? null;
  const you = view ? view.seats.findIndex((s) => s.kind === 'player') : -1;
  const seats = (view?.seats ?? []).map((s, i) => {
    const k = view.handSeats.indexOf(i);
    const h = hand && k >= 0 ? hand.seats[k] : null;
    return {
      name: s.name, you: i === you, stack: h ? h.stack : s.stack, bet: h ? h.bet : 0,
      button: i === view.button,
      state: s.gone ? 'gone' : !h ? (hand ? 'out' : '') : h.folded ? 'folded' : h.allIn ? 'all in' : hand.toAct === k ? 'to act' : '',
      cards: h && h.hole ? h.hole.map(cardFace) : h && !h.folded ? [cardFace(-1), cardFace(-1)] : [],
    };
  });
  const pot = hand ? hand.seats.reduce((a, s) => a + s.total, 0) : 0;
  const actions = [];
  if (phase === 'playing' && legal) {
    actions.push({ id: 'fold', label: 'Fold', enabled: true });
    actions.push(legal.check ? { id: 'check', label: 'Check', enabled: true } : { id: 'call', label: `Call ${legal.call}`, enabled: legal.call > 0 });
    if (legal.raise) {
      const bet = hand.currentBet === 0;
      actions.push({ id: 'raise', label: bet ? 'Bet' : 'Raise to', enabled: true, min: legal.raise.min, max: legal.raise.max, step: Math.max(1, stakes.sb) });
      actions.push({ id: 'allin', label: `All in (${legal.raise.max})`, enabled: true, to: legal.raise.max });
    }
  }
  actions.push({ id: 'stand', label: phase === 'over' ? 'Leave the table' : 'Stand up', enabled: true });
  const message = phase === 'over'
    ? (why === 'broke' ? 'You are out of chips.' : why === 'empty' ? 'The table has emptied - every patron is broke.' : 'You leave the table.')
    : !hand ? 'The next hand is being dealt...' : legal ? 'Your turn.' : `Waiting on ${seats.find((s) => s.state === 'to act')?.name ?? 'the table'}...`;
  return {
    phase, title, note, seats, pot,
    board: hand ? hand.board.map(cardFace) : [],
    street: hand?.street ?? null,
    actions, message, log: log.slice(-6),
  };
}

/** A one-line account of a session event for the panel's log (`names` this.seats' names). */
export function eventLine(e, names) {
  const who = names[e.seat] ?? 'Someone';
  switch (e.t) {
    case 'hand': return `Hand ${e.hand}: ${names[e.button] ?? 'someone'} deals.`;
    case 'act': return e.type === 'raise' ? `${who} raises to ${e.to}.` : e.type === 'call' ? `${who} calls ${e.paid}.` : `${who} ${e.type}s.`;
    case 'street': return `The ${e.street}.`;
    case 'showdown': {
      const won = e.result.payouts.map((p, k) => (p > 0 ? k : -1)).filter((k) => k >= 0);
      return won.length ? `${won.map((k) => names[e.seats?.[k] ?? k] ?? 'Someone').join(' and ')} ${won.length > 1 ? 'split' : 'takes'} the pot.` : 'The hand is over.';
    }
    case 'leave': return `${e.name} is broke and leaves the table.`;
    case 'over': return e.why === 'broke' ? 'You are broke.' : e.why === 'empty' ? 'The table has emptied.' : 'You stand up.';
    default: return '';
  }
}

const STYLE_ID = 'dfcards-style';
const CSS = `
.dfcards{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:13;min-width:520px;max-width:min(760px,calc(100vw - 32px));
  background:rgba(18,14,10,.92);border:1px solid #8a6a2c;border-radius:6px;color:#e8dcc0;font:14px/1.35 Georgia,serif;padding:10px 14px;
  box-shadow:0 6px 24px rgba(0,0,0,.6)}
.dfcards h3{margin:0 0 4px;font-size:15px;color:#e2b85a;font-weight:normal;letter-spacing:.04em}
.dfcards .note{font-size:12px;color:#b9a77f;margin-bottom:6px}
.dfcards .seats{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.dfcards .seat{flex:1 1 110px;border:1px solid #4a3a1c;border-radius:4px;padding:4px 6px;background:rgba(40,30,18,.7)}
.dfcards .seat.you{border-color:#e2b85a}.dfcards .seat.to-act{box-shadow:0 0 0 2px #e2b85a inset}
.dfcards .seat.folded,.dfcards .seat.gone,.dfcards .seat.out{opacity:.45}
.dfcards .seat .nm{font-size:13px}.dfcards .seat .st{font-size:12px;color:#c8b48a}
.dfcards .cards{display:flex;gap:4px;align-items:center;min-height:30px}
.dfcards .card{display:inline-block;min-width:26px;padding:3px 4px;border-radius:3px;background:#f4ecd8;color:#1a1a1a;text-align:center;font:bold 14px Georgia,serif}
.dfcards .card.red{color:#a01818}.dfcards .card.back{background:repeating-linear-gradient(45deg,#5a1e1e,#5a1e1e 4px,#7a2a2a 4px,#7a2a2a 8px)}
.dfcards .board{display:flex;gap:8px;align-items:center;margin:6px 0}
.dfcards .msg{margin:4px 0;color:#efe3c4}
.dfcards .log{font-size:12px;color:#a8977a;max-height:64px;overflow:hidden}
.dfcards .acts{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}
.dfcards button{background:#3a2c14;color:#f0dfb0;border:1px solid #8a6a2c;border-radius:3px;padding:4px 10px;font:14px Georgia,serif;cursor:pointer}
.dfcards button:disabled{opacity:.4;cursor:default}
.dfcards input[type=range]{width:160px}
`;

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
  if (doc?.getElementById && !doc.getElementById(STYLE_ID)) {
    const s = doc.createElement('style');
    s.id = STYLE_ID; s.textContent = CSS;
    (doc.head ?? doc.body)?.append(s);
  }
  const root = doc.createElement('div');
  root.className = 'dfcards';
  swallowPresses(root);
  root.addEventListener('keydown', (e) => e.stopPropagation());   // a slider's arrow key is the slider's - never a step that stands you up
  doc.body?.append(root);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const cardsOf = (list) => { const box = el('div', 'cards'); for (const c of list) box.append(el('span', `card${c.red ? ' red' : ''}${c.back ? ' back' : ''}`, c.text)); return box; };
  let alive = true, sliderValue = null;
  return {
    root,
    render(m) {
      if (!alive) return;
      root.replaceChildren();
      root.append(el('h3', '', m.title));
      if (m.note) root.append(el('div', 'note', m.note));
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
        board.append(cardsOf(m.board), el('span', '', `Pot ${m.pot}`));
        root.append(board);
      }
      root.append(el('div', 'msg', m.message));
      const acts = el('div', 'acts');
      if (m.buyIn) {
        const range = el('input');
        range.type = 'range'; range.min = String(m.buyIn.min); range.max = String(m.buyIn.max); range.step = '1';
        range.value = String(sliderValue ?? m.buyIn.value);
        const label = el('span', '', `${range.value}`);
        range.addEventListener('input', () => { sliderValue = Number(range.value); label.textContent = range.value; });
        acts.append(range, label);
      }
      for (const a of m.actions) {
        if (a.id === 'raise') {
          const range = el('input');
          range.type = 'range'; range.min = String(a.min); range.max = String(a.max); range.step = String(a.step);
          range.value = String(Math.min(a.max, Math.max(a.min, sliderValue ?? a.min)));
          const b = el('button', '', `${a.label} ${range.value}`);
          range.addEventListener('input', () => { sliderValue = Number(range.value); b.textContent = `${a.label} ${range.value}`; });
          b.addEventListener('click', () => onPress('raise', Number(range.value)));
          acts.append(range, b);
          continue;
        }
        const b = el('button', '', a.label);
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
      if (m.log?.length) root.append(el('div', 'log', m.log.join(' ')));
    },
    /** A new hand forgets the last raise's slider. */
    resetSlider() { sliderValue = null; },
    destroy() { if (!alive) return; alive = false; root.remove?.(); },
  };
}
