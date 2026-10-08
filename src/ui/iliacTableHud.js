// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 29): ILIAC HAND'S PANEL AT THE TAVERN TABLE - the
// port's own enhanced panel beside the Hold'em one (ui/cardTableHud.js: the same dark plate and gold, outside the window
// stack, the world going on while it stands), where the player picks a deck and a regular, stages his turn and commits it.
//
// TWO HALVES, as the Hold'em panel's. `iliacHudModel` is pure: the game's view (net/iliacHand.js iliacView, the offline
// session's or the relay's) and the host's staging as the rows, cards and buttons the panel shows - every label and every
// enabled flag decided here, pinned by test/cards10_table.test.js. `createIliacTableHud` paints that model into the page
// and hands presses back to the host.
//
// STAGING READS ONLY WHAT THE PLAYER SEES. `stagedRefusal` is the rules' playsRefusal said over the view (his hand, his
// magicka, a holding's room and its rule, his own face-up cards' discounts) - the panel greys a play the rules would
// refuse; the rules themselves (the session's commit, the relay's) still decide.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { cardById } from '../net/iliacCards.js';
import { ILIAC_HAND_MAX, ILIAC_HOLDINGS } from '../net/iliacHand.js';
import { paintIliacCard, paintIliacBack } from '../render/iliacCardFaces.js';

/** A temper as the panel names it. */
export const TEMPER_WORDS = Object.freeze({ tight: 'careful', loose: 'reckless', bluffer: 'sly' });
/** A deck's refusal (the binder page's words: ui/cardBinderPage.js DECK_REFUSAL_WORDS) as the setup's row says it. */
export const ILIAC_REFUSAL_WORDS = Object.freeze({
  over: 'The game is over.', committed: 'You have committed this turn.', shape: 'That is no play.', hand: 'That card is not in your hand.',
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
  return { id: card?.id ?? null, name: card?.name ?? '?', power: c.power ?? card?.power ?? 0, cost: card?.cost ?? 0, title: card ? `${card.name} - ${card.text}` : '?', ...(c.down ? { down: true } : {}), ...extra };
};

/** The result said. */
export function resultLine(view, end) {
  const r = view?.result;
  const me = view?.viewer ?? 0;
  if (end === 'left') return 'You concede the game.';
  if (!r) return '';
  const held = r.held.filter((x) => x === me).length, theirs = r.held.filter((x) => x === 1 - me).length;
  if (r.winner === null) return `A draw - ${held} holdings each way and ${r.total[me]} power to ${r.total[1 - me]}.`;
  const won = r.winner === me;
  return r.by === 'holdings'
    ? `${won ? 'You win' : 'You lose'} - ${won ? held : theirs} of three holdings ${won ? 'held' : 'lost'}.`
    : `${won ? 'You win' : 'You lose'} on power, ${r.total[me]} to ${r.total[1 - me]}.`;
}

/**
 * The panel's model.
 * @param {{phase: 'setup'|'playing'|'over', view?: any, staged?: {card: number, holding: number}[], pick?: number|null, setup?: any, end?: string|null, prize?: any, log?: string[], packPrice?: number|null, online?: any, friendly?: boolean, why?: string|null}} p
 */
export function iliacHudModel({ phase, view = null, staged = [], pick = null, setup = null, end = null, prize = null, log = [], packPrice = null, online = null, friendly = false, why = null }) {
  const title = 'Card table - Iliac Hand';
  const note = online ? (online.ranked ? 'A ranked game with the room: the relay deals, and the result counts on the season\'s board.' : 'A game with the room: the relay deals and keeps the clock.')
    : friendly ? 'A friendly game: online, no card changes hands at a regulars\' table.' : null;
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
      message: why ?? (!s.decks.length ? 'Your binder holds no deck - build one under Holdings, Collections.' : !deckOk ? 'Choose a lawful deck from your binder.' : !foeOk ? 'Choose a regular to play.' : online ? 'Sit down and wait for another player.' : 'Ready to deal.'),
      actions: [
        { id: 'deal', label: online ? 'Sit at the table' : 'Deal', enabled: !!(deckOk && foeOk) },
        { id: 'holdem', label: 'Play Hold\'em instead', enabled: true },
        ...pack,
        { id: 'stand', label: 'Stand up', enabled: true },
      ],
      log: log.slice(-6),
    };
  }
  const me = view?.viewer ?? 0, them = 1 - me;
  const mine = view?.players?.[me] ?? null;
  const stagedAt = (h) => staged.flatMap((x, k) => (x.holding === h ? [{ ...iliacFace(mine?.hand?.[x.card]), staged: k }] : []));
  const holdings = (view?.holdings ?? []).map((hd, h) => {
    const loc = cardById(hd.id);
    return {
      h, id: hd.id, name: loc?.name ?? '?', text: loc?.text ?? '', room: hd.room,
      power: [hd.power[me], hd.power[them]],
      mine: hd.sides[me].map((c) => iliacFace(c)), theirs: hd.sides[them].map((c) => iliacFace(c)),
      staged: stagedAt(h),
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
    actions.push({ id: 'commit', label: committed ? 'Committed' : staged.length ? `Commit ${staged.length} ${staged.length === 1 ? 'play' : 'plays'}` : 'Pass this turn', enabled: !committed && stagedRefusal(view, staged) === null });
    actions.push({ id: 'clear', label: 'Clear', enabled: !committed && staged.length > 0 });
    actions.push({ id: 'stand', label: view?.forKeeps ? 'Concede and stand' : 'Stand up', enabled: true });
  } else {
    actions.push({ id: 'again', label: 'Play again', enabled: !online });
    actions.push({ id: 'holdem', label: 'Play Hold\'em', enabled: !online });
    actions.push(...pack);
    actions.push({ id: 'stand', label: 'Leave the table', enabled: true });
  }
  const other = view?.names?.[them] ?? (online ? 'Your opponent' : 'The regular');
  const message = phase === 'over'
    ? [resultLine(view, end), prizeLine(prize, other)].filter(Boolean).join(' ')
    : online?.waiting ? 'Waiting for another player to sit down.'
      : view?.revealing ? 'The cards turn over...'
      : committed ? (view?.players?.[them]?.committed ? 'Both committed - the turn turns over.' : `${other} is thinking...`)
      : `Turn ${view?.turn ?? 1} of ${view?.turns ?? 6} - your magicka ${Math.max(0, (mine?.magicka ?? 0) - spend)} of ${mine?.magicka ?? 0}.${online?.clock ? ` ${online.clock} s.` : ''}`;
  return {
    phase, title, note, holdings, hand,
    them: { name: other, hand: view?.players?.[them]?.handCount ?? 0, deck: view?.players?.[them]?.deckCount ?? 0, committed: !!view?.players?.[them]?.committed },
    me: { deck: mine?.deckCount ?? 0, magicka: mine?.magicka ?? 0, spend },
    turn: view?.turn ?? 1, turns: view?.turns ?? 6,
    actions, message: online?.error ? `${message} (${online.error})` : message, log: log.slice(-6),
  };
}
/** The prize said: a card won or lost for keeps. */
export function prizeLine(prize, other = 'The regular') {
  if (!prize?.card) return '';
  const name = cardById(prize.card)?.name ?? 'a card';
  return prize.from === 'patron' ? `${other} pays you a card: ${name}.` : `${other} takes a card from your deck: ${name}.`;
}

const STYLE_ID = 'dfiliac-style';
const CSS = `
.dfiliac{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:13;box-sizing:border-box;width:min(760px,calc(100vw - 32px));
  max-height:calc(100vh - 36px);overflow:auto;background:rgba(18,14,10,.93);border:1px solid #8a6a2c;border-radius:6px;color:#e8dcc0;
  font:14px/1.35 Georgia,serif;padding:10px 14px;box-shadow:0 6px 24px rgba(0,0,0,.6)}
@media (min-width:1100px){.dfiliac{left:auto;right:16px;transform:none;width:520px}}
.dfiliac h3{margin:0 0 4px;font-size:15px;color:#e2b85a;font-weight:normal;letter-spacing:.04em}
.dfiliac .note{font-size:12px;color:#b9a77f;margin-bottom:6px}
.dfiliac .them{font-size:12px;color:#c8b48a;margin:2px 0}
.dfiliac .holds{display:flex;gap:6px;margin:6px 0}
.dfiliac .hold{flex:1 1 0;min-width:0;border:1px solid #4a3a1c;border-radius:4px;padding:4px;background:rgba(40,30,18,.7);cursor:default}
.dfiliac .hold.target{border-color:#e2b85a;box-shadow:0 0 0 2px #e2b85a inset;cursor:pointer}
.dfiliac .hold .nm{font-size:13px;color:#e2b85a}.dfiliac .hold .tx{font-size:11px;color:#b9a77f;min-height:28px}
.dfiliac .hold .pw{font-size:12px;margin:2px 0}.dfiliac .hold .pw b{color:#f0dfb0}
.dfiliac .row{display:flex;flex-wrap:wrap;gap:3px;min-height:46px;align-items:flex-start}
.dfiliac .ic{position:relative;display:inline-block;width:32px;height:45px;line-height:0;border-radius:3px}
.dfiliac .ic canvas{width:32px;height:45px;border-radius:3px}
.dfiliac .ic .p{position:absolute;right:-2px;bottom:-2px;font:bold 11px/14px Georgia,serif;background:#8e2a1c;color:#fff;border-radius:7px;padding:0 3px}
.dfiliac .ic.staged{outline:2px dashed #e2b85a;opacity:.85;cursor:pointer}
.dfiliac .hand{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.dfiliac .hand .ic{width:56px;height:80px;cursor:pointer}.dfiliac .hand .ic canvas{width:56px;height:80px}
.dfiliac .hand .ic.picked{outline:2px solid #e2b85a;transform:translateY(-4px)}
.dfiliac .hand .ic.off{opacity:.4;cursor:default}.dfiliac .hand .ic.used{opacity:.25}
.dfiliac .opts{display:flex;flex-direction:column;gap:3px;margin:4px 0}
.dfiliac .opts label{cursor:pointer}.dfiliac .opts .w{color:#b98a6a;font-size:12px}
.dfiliac .msg{margin:4px 0;color:#efe3c4}
.dfiliac .log{font-size:12px;color:#a8977a;max-height:64px;overflow:hidden}
.dfiliac .acts{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}
.dfiliac button{background:#3a2c14;color:#f0dfb0;border:1px solid #8a6a2c;border-radius:3px;padding:4px 10px;font:14px Georgia,serif;cursor:pointer}
.dfiliac button:disabled{opacity:.4;cursor:default}
`;

/** A press on the panel is the panel's - never a swing or a look (the Hold'em panel's own law). */
const swallowPresses = (node) => {
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) node.addEventListener(t, swallow);
};

/**
 * The panel in the page. `onPress(id, value)`: 'deck' and 'foe' with an index, 'keeps', 'deal', 'holdem', 'pack',
 * 'pick' with a hand index, 'hold' with a holding, 'unstage' with a staged index, 'commit', 'clear', 'again', 'stand'.
 * `render(model)` repaints; `destroy()` takes it away (once).
 * @param {{onPress: (id: string, value?: number) => void, doc?: any}} p
 */
export function createIliacTableHud({ onPress, doc = document }) {
  if (doc?.getElementById && !doc.getElementById(STYLE_ID)) {
    const s = doc.createElement('style');
    s.id = STYLE_ID; s.textContent = CSS;
    (doc.head ?? doc.body)?.append(s);
  }
  const root = doc.createElement('div');
  root.className = 'dfiliac';
  swallowPresses(root);
  doc.body?.append(root);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const cache = new Map();
  /** A card's face painted at w x h (twice that, for the screen's density), cached by card and size. */
  const faceOf = (id, w, h) => {
    const key = `${id ?? 'back'}:${w}`;
    let src = cache.get(key);
    if (src === undefined) {
      const cv = doc.createElement('canvas'), ctx = cv.getContext?.('2d');
      if (ctx) { cv.width = w * 2; cv.height = h * 2; if (id) paintIliacCard(ctx, cardById(id), cv.width, cv.height); else paintIliacBack(ctx, cv.width, cv.height); src = cv; } else src = null;
      cache.set(key, src);
    }
    if (!src) return null;
    const cv = doc.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    cv.getContext?.('2d')?.drawImage?.(src, 0, 0);
    return cv;
  };
  const card = (c, { w = 32, h = 45, cls = '', press = null, value = undefined, power = true } = {}) => {
    const n = el('span', `ic${cls ? ` ${cls}` : ''}`);
    const cv = faceOf(c.id, w, h);
    if (cv) n.append(cv); else n.append(el('span', '', c.name));
    if (power && c.id && cardById(c.id)?.kind !== 'spell' && cardById(c.id)?.kind !== 'location') n.append(el('span', 'p', String(c.power ?? 0)));
    n.title = c.title ?? '';
    if (press) n.addEventListener('click', () => onPress(press, value));
    return n;
  };
  let alive = true, shownKey = null, msgEl = null;
  return {
    root,
    render(m) {
      if (!alive) return;
      const key = JSON.stringify({ ...m, message: null });
      if (key === shownKey && msgEl) { msgEl.textContent = m.message; return; }
      shownKey = key;
      root.replaceChildren();
      root.append(el('h3', '', m.title));
      if (m.note) root.append(el('div', 'note', m.note));
      if (m.phase === 'setup') {
        const decks = el('div', 'opts');
        decks.append(el('div', '', 'Your deck:'));
        for (const d of m.decks) {
          const l = el('label', '', `${d.chosen ? '◉' : '○'} ${d.name}`);
          if (d.word) l.append(el('span', 'w', ` - ${d.word}`));
          l.addEventListener('click', () => onPress('deck', d.i));
          decks.append(l);
        }
        root.append(decks);
        if (m.foes.length) {
          const foes = el('div', 'opts');
          foes.append(el('div', '', 'Play against:'));
          for (const f of m.foes) {
            const l = el('label', '', `${f.chosen ? '◉' : '○'} ${f.name} (${f.temper})${f.paid ? ' - has paid a card tonight' : ''}`);
            l.addEventListener('click', () => onPress('foe', f.i));
            foes.append(l);
          }
          root.append(foes);
        }
        if (m.keeps) {
          const k = el('label', '', `${m.keeps.on ? '☑' : '☐'} Play for a card (the loser pays one from their deck)`);
          if (!m.keeps.enabled) { k.style && (k.style.opacity = '0.5'); if (m.keeps.why) k.append(el('span', 'w', ` - ${m.keeps.why}`)); }
          else k.addEventListener('click', () => onPress('keeps'));
          const box = el('div', 'opts');
          box.append(k);
          root.append(box);
        }
      } else {
        root.append(el('div', 'them', `${m.them.name}: ${m.them.hand} in hand, ${m.them.deck} in deck${m.them.committed ? ' - committed' : ''}`));
        const holds = el('div', 'holds');
        for (const hd of m.holdings) {
          const box = el('div', `hold${hd.target ? ' target' : ''}`);
          box.append(el('div', 'nm', hd.name), el('div', 'tx', hd.text));
          const theirs = el('div', 'row');
          for (const c of hd.theirs) theirs.append(card(c));
          const pw = el('div', 'pw');
          pw.append(el('b', '', String(hd.power[0])), el('span', '', ' you - them '), el('b', '', String(hd.power[1])));
          const mine = el('div', 'row');
          for (const c of hd.mine) mine.append(card(c));
          for (const c of hd.staged) mine.append(card(c, { cls: 'staged', press: 'unstage', value: c.staged }));
          box.append(theirs, pw, mine);
          if (hd.target) box.addEventListener('click', () => onPress('hold', hd.h));
          holds.append(box);
        }
        root.append(holds);
        const hand = el('div', 'hand');
        for (const c of m.hand) hand.append(card(c, { w: 56, h: 80, cls: c.picked ? 'picked' : c.staged ? 'used' : c.playable ? '' : 'off', press: c.playable || c.picked ? 'pick' : null, value: c.i }));
        root.append(hand);
      }
      msgEl = el('div', 'msg', m.message);
      root.append(msgEl);
      const acts = el('div', 'acts');
      for (const a of m.actions) {
        const b = el('button', '', a.label);
        b.disabled = !a.enabled;
        b.addEventListener('click', () => { if (a.enabled) onPress(a.id); });
        acts.append(b);
      }
      root.append(acts);
      if (m.log?.length) root.append(el('div', 'log', m.log.join(' ')));
    },
    destroy() { if (!alive) return; alive = false; root.remove?.(); },
  };
}
