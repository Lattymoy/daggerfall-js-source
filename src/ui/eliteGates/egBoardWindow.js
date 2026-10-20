// @ts-check
// EG-E2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 20, THE BOARD WINDOW):
// THE ELITE BREACH'S BOARDS ON THE SCREEN - the three boards as tabs (the Descent's three brackets, the Depths and the
// Deepest Redoubts), each a top ten with the member's own row pinned at the foot, a company's names, the Unfallen's
// flame, each breach's Proclamation, this week's, and "Your best: Hall 47 - 1:44:12". EG-ZM: the host opens it through
// ONE door (createEgBoardDoor) from `/breach board`, the Timers row's Elite entries and the start window.
//
// THREE HALVES. `egBoardLines(board, tab)` is pure: the service's answer (server-account/src/egHonours.js egBoardOf) as
// the lines a tab shows - every word decided here. The ENHANCED skin paints them in one DOM panel outside the window
// stack (createEgBoardPanel: ui/iliacTableHud.js's plate and gold, the tabs, a close - the world going on behind it); the
// CLASSIC skin builds them from DFU windows (ui/listPicker.js, DaggerfallListPickerWindow, as the start window uses it):
// a picker of the five tabs, and the chosen tab's lines in one of its own, back to the tabs on its close - the slot
// emptied before the next window is put in it.
// AUDIT EG III (2026-10-13): THE PANEL IS A WINDOW TO THE PAD - an `enhanced-` door on the page (ui/gamepadInput.js
// domWindowUp) and on the enhanced doors' stack (ui/enhanced/enhancedOverlays.js - Tab puts it away, and the pad's cursor drives it),
// and its Back (the pad's, or Escape anywhere on the page - the enhanced doors' own `back`, ui/input.js overlayAction) closes it.
//
// Not a DFU member: Daggerfall Unity has no Elite Breach. Ledger A (ELITE-GATES).
import { egBandOfHall, EG_BAND_NAMES, EG_DECREES, EG_TEXT } from '../../net/eliteGates/egLaw.js';   // AUDIT EG V (L8-9): a Wager's decrees by name, in the start window's own words
import { ListPickerWindow } from '../listPicker.js';
import { registerOverlay } from '../enhanced/enhancedOverlays.js';   // AUDIT EG III: on the enhanced doors' stack
import { overlayAction } from '../input.js';   // AUDIT EG III: the doors' own Back
import { t } from '../../systems/textManager.js';   // AUDIT EG V (c, L7-19): the last runs' words, in the player's language
import { dressEgKit, egEl, egHead, egSection } from './egKit.js';   // EG-PLUS: the breach windows' chrome

/** The tabs, in their order: the Descent's three brackets (server-account/src/egHonours.js EG_BRACKETS), the Depths and
 *  the Deepest Redoubts. */
export const EG_BOARD_TABS = Object.freeze(['alone', 'few', 'company', 'depths', 'deepest', 'runs']);
/** A tab's name. AUDIT EG V (c, L7-19; section 27.6 - "the last five runs are kept"): the sixth, this device's own last runs
 *  (ui/eliteGates/egHud.js egRecapsKept - the recaps it kept, read here and nowhere else before). */
export const EG_BOARD_TAB_TEXT = Object.freeze({
  alone: 'The Descent: Alone', few: 'The Descent: The Few', company: 'The Descent: The Company',
  depths: 'The Depths', deepest: 'The Deepest Redoubts',
  get runs() { return t('eg.board.runs', 'Your last runs'); },
});
/** AUDIT EG III: the panel's id on the page - an enhanced door's, so the pad's window test finds it. */
export const EG_BOARD_PANEL_ID = 'enhanced-egboard';
/** The window's words. */
export const EG_BOARD_TEXT = Object.freeze({
  title: 'The Boards of the Spire',
  reading: 'Reading the boards...',
  failed: (why) => `The boards cannot be read now (${why}).`,
  season: (s) => `Season ${s?.n ?? '?'}, day ${s?.day ?? '?'}.`,
  noDescent: 'No company has gone down this season.',
  noDepths: 'No hall has been cleared this season.',
  noDeepest: 'No Redoubt has been taken yet.',
  unfallen: 'unfallen',
  wagered: 'wagered',
  you: 'you',
  proclamation: (p) => `This week's Proclamation: ${p.name}${p.line ? ` - ${p.line}` : ''}`,
  best: (h, t) => `Your best: Hall ${h} - ${egBoardClock(t)}`,
  noBest: 'Your best: no descent yet this season.',
  close: 'Close',
});

/** Seconds as the board says them: `h:mm:ss`, `m:ss` under the hour. Pure. */
export function egBoardClock(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const two = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(x)}` : `${m}:${two(x)}`;
}
/** A Redoubt's day, as the Deepest says when it was taken (UTC, the board's own clock). Pure. */
const dayOf = (at) => (Number.isFinite(at) && at > 0 ? new Date(at * 1000).toISOString().slice(0, 10) : '?');
/**
 * AUDIT EG V (c, L7-19; section 27.6 - "The last five runs are kept"): THE LAST RUNS' LINES - the tab's name, then each recap
 * this device kept (ui/eliteGates/egHud.js egRecapKeep - `{ title, time, whyText, why, board, at }`), newest first: its day, its depth,
 * its time from the first wake, why it ended and its board's line; or that none is kept. Pure.
 * @param {any[]} runs
 */
export function egRunsLines(runs) {
  const list = (Array.isArray(runs) ? runs : []).filter((r) => r && typeof r === 'object' && typeof r.title === 'string').slice().reverse();
  if (!list.length) return [EG_BOARD_TAB_TEXT.runs, t('eg.board.noRuns', 'No run is kept on this device yet.')];
  return [EG_BOARD_TAB_TEXT.runs, ...list.map((r) => [dayOf(Number(r.at) / 1000), r.title, r.time, r.whyText || r.why || '', r.board || ''].filter(Boolean).join(' - '))];
}

/**
 * THE LINES OF A TAB (`tab` one of EG_BOARD_TABS - the first for any other): its name and the season; its ranked rows,
 * then `...` and the member's own row where it is pinned under them; this week's Proclamation and the member's best on
 * the Descent. A Descent row says its company's names, the hall and its band, the time, the Unfallen's flame and its
 * breach's Proclamation (`short`: the first name and how many more, no band and no Proclamation - the classic picker's
 * narrow list). Null, a refusal or a board: never a throw. Pure. AUDIT EG V (c, L7-19): the `runs` tab is this device's own
 * last runs (`runs` - ui/eliteGates/egHud.js egRecapsKept's recaps, newest first here), the service's board aside.
 * @param {any} board the service's answer (or `{ error }`, or null while it is read)
 * @param {string} tab
 * @param {{ short?: boolean, runs?: any[] }} [o]
 */
export function egBoardLines(board, tab, { short = false, runs = [] } = {}) {
  if (tab === 'runs') return egRunsLines(runs);
  if (!board) return [EG_BOARD_TEXT.reading];
  if (board.error) return [EG_BOARD_TEXT.failed(board.error)];
  const t = EG_BOARD_TABS.includes(tab) ? tab : EG_BOARD_TABS[0];
  const you = (r) => (r.you ? ` - ${EG_BOARD_TEXT.you}` : '');
  /** @type {any} */ let b;
  /** @type {(r: any) => string} */ let row;
  let none;
  if (t === 'depths') {
    b = board.depths; none = EG_BOARD_TEXT.noDepths;
    // AUDIT EG V (lane8 L8-9; sections 18 and 20 - "the Wager shown on the row"): its decrees by name; a row whose end kept
    // none of them (claimed before they were kept) says it was wagered
    const wager = (r) => { const names = (Array.isArray(r.wg) ? r.wg : []).map((id) => EG_DECREES[id]?.name).filter(Boolean); return names.length ? ` - ${EG_TEXT.wager(names.join(', '))}` : r.wagered ? ` - ${EG_BOARD_TEXT.wagered}` : ''; };
    row = (r) => `${r.rank}. ${r.name ?? '?'} - Hall ${r.h}${r.ew > 0 ? ` from Redoubt ${r.ew}` : ''}${wager(r)}${you(r)}`;
  } else if (t === 'deepest') {
    b = board.deepest; none = EG_BOARD_TEXT.noDeepest;
    row = (r) => `${r.rank}. ${r.name ?? '?'} - Redoubt ${r.w} - ${dayOf(r.at)}${you(r)}`;
  } else {
    b = board.descent?.[t]; none = EG_BOARD_TEXT.noDescent;
    row = (r) => {
      const names = Array.isArray(r.names) && r.names.length ? r.names : ['?'];
      const who = short && names.length > 1 ? `${names[0]} +${names.length - 1}` : names.join(', ');
      const band = short ? '' : ` (${EG_BAND_NAMES[egBandOfHall(r.h)]})`;
      return `${r.rank}. ${who} - Hall ${r.h}${band} - ${egBoardClock(r.t)}${r.flame ? ` - ${EG_BOARD_TEXT.unfallen}` : ''}${!short && r.pr ? ` - ${r.pr}` : ''}${you(r)}`;
    };
  }
  const out = [EG_BOARD_TAB_TEXT[t], EG_BOARD_TEXT.season(board.season)];
  if (!b?.rows?.length) out.push(none);
  for (const r of b?.rows ?? []) out.push(row(r));
  if (b?.pinned) out.push('...', row(b.pinned));
  if (board.proclamation) out.push(EG_BOARD_TEXT.proclamation(board.proclamation));
  out.push(board.best ? EG_BOARD_TEXT.best(board.best.h, board.best.t) : EG_BOARD_TEXT.noBest);
  return out;
}

/**
 * EG-PLUS: THE ENHANCED PANEL'S VIEW of a tab (`tab` one of EG_BOARD_TABS - the first for any other) - the board's facts as
 * rows of their own, where the classic picker's lines (egBoardLines) run them into one string: `season` (its chip),
 * `note` (reading, a refusal, an empty board), `rows` - each `{ rank, who, sub, val, you, flame }` - and `pinned` (the
 * reader's own row under the ten), `foot` (this week's Proclamation and the reader's best). The last runs (`runs`) are
 * this device's, newest first, with no rank and no foot. Pure.
 * @param {any} board @param {string} tab @param {{ runs?: any[] }} [o]
 */
export function egBoardView(board, tab, { runs = [] } = {}) {
  if (tab === 'runs') {
    const list = (Array.isArray(runs) ? runs : []).filter((r) => r && typeof r === 'object' && typeof r.title === 'string').slice().reverse();
    return { season: '', note: list.length ? '' : t('eg.board.noRuns', 'No run is kept on this device yet.'), foot: [], pinned: null,
      rows: list.map((r) => ({ rank: '', who: r.title, sub: [dayOf(Number(r.at) / 1000), r.whyText || r.why || '', r.board || ''].filter(Boolean).join(' - '), val: r.time ?? '', you: false, flame: false })) };
  }
  if (!board) return { season: '', note: EG_BOARD_TEXT.reading, rows: [], pinned: null, foot: [] };
  if (board.error) return { season: '', note: EG_BOARD_TEXT.failed(board.error), rows: [], pinned: null, foot: [] };
  const k = EG_BOARD_TABS.includes(tab) ? tab : EG_BOARD_TABS[0];
  /** @type {any} */ let b;
  /** @type {(r: any) => { who: string, sub: string, val: string, flame?: boolean }} */ let row;
  let none;
  if (k === 'depths') {
    b = board.depths; none = EG_BOARD_TEXT.noDepths;
    const wager = (r) => { const names = (Array.isArray(r.wg) ? r.wg : []).map((id) => EG_DECREES[id]?.name).filter(Boolean); return names.length ? EG_TEXT.wager(names.join(', ')) : r.wagered ? EG_BOARD_TEXT.wagered : ''; };
    row = (r) => ({ who: r.name ?? '?', sub: [r.ew > 0 ? t('eg.board.fromRedoubt', 'From Redoubt {n}', { n: r.ew }) : '', wager(r)].filter(Boolean).join(' - '), val: `Hall ${r.h}` });
  } else if (k === 'deepest') {
    b = board.deepest; none = EG_BOARD_TEXT.noDeepest;
    row = (r) => ({ who: r.name ?? '?', sub: dayOf(r.at), val: `Redoubt ${r.w}` });
  } else {
    b = board.descent?.[k]; none = EG_BOARD_TEXT.noDescent;
    row = (r) => ({ who: (Array.isArray(r.names) && r.names.length ? r.names : ['?']).join(', '), sub: [`Hall ${r.h} - ${EG_BAND_NAMES[egBandOfHall(r.h)]}`, r.pr || ''].filter(Boolean).join(' - '), val: egBoardClock(r.t), flame: !!r.flame });
  }
  const full = (r) => ({ rank: `${r.rank}.`, flame: false, ...row(r), you: !!r.you });
  return {
    season: EG_BOARD_TEXT.season(board.season), note: b?.rows?.length ? '' : none, rows: (b?.rows ?? []).map(full), pinned: b?.pinned ? full(b.pinned) : null,
    foot: [board.proclamation ? EG_BOARD_TEXT.proclamation(board.proclamation) : '', board.best ? EG_BOARD_TEXT.best(board.best.h, board.best.t) : EG_BOARD_TEXT.noBest].filter(Boolean),
  };
}

const STYLE_ID = 'dagger-eg-board-style';
/** EG-PLUS: the boards are a breach window (ui/eliteGates/egKit.js) - this sheet places it and sizes its rows; the kit paints. */
export const EG_BOARD_CSS = `
.eg-board { left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(660px, calc(100vw - 24px)); z-index: 13; }
.eg-board .eg-k-row .eg-k-val { min-width: 76px; }
.eg-board .eg-k-gap { padding: 2px 8px; font-size: 13px; color: var(--egk-dim); }
.eg-board .eg-k-flame { margin-left: 6px; text-transform: capitalize; }
@media (max-width: 480px) { .eg-board .eg-k-tab { flex: 1 1 45%; } }
`;

/**
 * THE ENHANCED SKIN'S PANEL in the page: a breach window (EG-PLUS) - the header band with the season and a close, the six
 * tabs, the tab's rows (egBoardView - a rank, who, where and when, the time or depth, the Unfallen's mark, the reader's
 * own row in brass), this week's Proclamation and the reader's best. `onTab(tab)` a tab pressed, `onClose()` the close or
 * Escape. `render(board, tab)` repaints; `destroy()` takes it away (once).
 * @param {{ doc?: any, onTab: (tab: string) => void, onClose: () => void, runs?: () => any[] }} p
 */
export function createEgBoardPanel({ doc = document, onTab, onClose, runs = () => [] }) {   // AUDIT EG V (c, L7-19): `runs` this device's last runs
  dressEgKit(doc);
  if (doc?.getElementById && !doc.getElementById(STYLE_ID)) {
    const s = doc.createElement('style');
    s.id = STYLE_ID; s.textContent = EG_BOARD_CSS;
    (doc.head ?? doc.body)?.append(s);
  }
  const el = (tag, cls, text) => egEl(doc, tag, cls, text);
  const root = el('div', 'eg-win eg-board');
  root.id = EG_BOARD_PANEL_ID;   // AUDIT EG III: an enhanced door, for the pad
  root.setAttribute('tabindex', '-1');
  root.setAttribute('aria-label', EG_BOARD_TEXT.title);
  // a press on the panel is the panel's - never a swing or a look (ui/iliacTableHud.js's law); Escape is its close
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) root.addEventListener(t, (e) => e.stopPropagation());
  root.addEventListener('keydown', (e) => { e.stopPropagation?.(); if (e.key === 'Escape') { e.preventDefault?.(); onClose(); } });
  doc.body?.append(root);
  try { root.focus?.({ preventScroll: true }); } catch { /* a page that cannot focus */ }
  let alive = true;
  // AUDIT EG III: on the enhanced doors' stack while it stands, and its Back heard on the whole page (the pad's Escape is
  // dispatched at the document, never at the panel)
  const unregister = registerOverlay(() => onClose());
  const win = doc.defaultView ?? globalThis;
  const onBack = (e) => { if (typeof e?.key !== 'string' || e.metaKey || e.ctrlKey || e.altKey || overlayAction(e) !== 'back') return; e.preventDefault?.(); e.stopPropagation?.(); onClose(); };
  win.addEventListener?.('keydown', onBack, { capture: true });
  const rowOf = (r) => {
    const n = el('div', `eg-k-row${r.you ? ' on' : ''}`);
    if (r.rank) n.append(el('span', 'eg-k-rank', r.rank));
    const who = el('span', 'eg-k-who', r.who);
    if (r.you) who.append(el('span', 'eg-k-chip gold eg-k-flame', EG_BOARD_TEXT.you));
    if (r.flame) who.append(el('span', 'eg-k-chip gold eg-k-flame', EG_BOARD_TEXT.unfallen));
    if (r.sub) who.append(el('span', 'eg-k-sub', r.sub));
    n.append(who);
    if (r.val) n.append(el('span', 'eg-k-val', r.val));
    return n;
  };
  return {
    root,
    render(board, tab) {
      if (!alive) return;
      const k = EG_BOARD_TABS.includes(tab) ? tab : EG_BOARD_TABS[0];
      const view = egBoardView(board, k, { runs: k === 'runs' ? runs() : [] });
      root.replaceChildren();
      root.append(egHead(doc, EG_BOARD_TEXT.title, { chips: view.season ? [el('span', 'eg-k-chip', view.season)] : [], onClose: () => onClose(), closeWords: EG_BOARD_TEXT.close }));
      const body = el('div', 'eg-k-body');
      const tabs = el('div', 'eg-k-tabs');
      tabs.setAttribute('role', 'tablist');
      for (const key of EG_BOARD_TABS) {
        const b = el('button', `eg-k-tab${key === k ? ' on' : ''}`, EG_BOARD_TAB_TEXT[key]);
        b.setAttribute('data-tab', key);
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(key === k));
        b.addEventListener('click', () => onTab(key));
        tabs.append(b);
      }
      body.append(tabs);
      const sec = egSection(doc, EG_BOARD_TAB_TEXT[k]);
      if (view.note) sec.append(el('div', 'eg-k-line dim', view.note));
      for (const r of view.rows) sec.append(rowOf(r));
      if (view.pinned) sec.append(el('div', 'eg-k-gap', '...'), rowOf(view.pinned));
      body.append(sec);
      for (const line of view.foot) body.append(el('div', 'eg-k-line dim', line));
      root.append(body);
    },
    destroy() { if (!alive) return; alive = false; unregister(); win.removeEventListener?.('keydown', onBack, { capture: true }); root.remove?.(); },
  };
}

/**
 * OPEN THE BOARDS: the board asked (`fetchBoard` - accountEg(...).board(), `call`'s shape: `{ ok, data }` or
 * `{ ok: false, error }`) and shown in the skin's window. Enhanced (`classic` false): the DOM panel in `doc`, its tabs
 * switching in place. Classic: the five tabs in a DaggerfallListPickerWindow put up with `mountWindow(win)` (false when
 * the slot refused it - nothing opens) and taken down with `closeWindow(win)`; a tab picked shows its lines in a picker
 * of their own, and that one's close (or a line picked) goes back to the tabs - each window out of the slot before the
 * next goes in. `listPickerReady()` says the picker's art is loaded (ui/listPicker.js listPickerArtLoaded). `onClosed()`
 * once, however it closes. Answers `{ close(), tab(), board() }`, or null where nothing could open.
 * @param {{ doc?: any, classic?: boolean, fetchBoard: () => Promise<any>, mountWindow?: (win: any) => boolean,
 *   closeWindow?: (win: any) => void, listPickerReady?: () => boolean, tab?: string, onClosed?: () => void,
 *   ListPicker?: any, runs?: () => any[] }} deps
 */
export function openEgBoard({ doc = globalThis.document, classic = false, fetchBoard, mountWindow, closeWindow, listPickerReady = () => true, tab = EG_BOARD_TABS[0], onClosed, ListPicker = ListPickerWindow, runs = () => [] }) {
  let open = true, board = null, at = EG_BOARD_TABS.includes(tab) ? tab : EG_BOARD_TABS[0], shown = '';
  /** @type {any} */ let panel = null;
  /** @type {any} */ let win = null;
  const close = () => {
    if (!open) return;
    open = false;
    const w = win, p = panel;
    win = null; panel = null;   // the slot emptied before its occupant is told
    if (w) closeWindow?.(w);
    p?.destroy();
    onClosed?.();
  };
  const handle = { close, tab: () => at, board: () => board };
  /** Into the slot, the one before it out first; a slot that refuses it closes the boards. */
  const put = (next) => {
    const prev = win;
    win = null;
    if (prev) closeWindow?.(prev);
    if (!open) return;
    if (!mountWindow?.(next)) { close(); return; }
    win = next;
  };
  const showTabs = () => { shown = 'tabs'; put(new ListPicker({
    items: EG_BOARD_TABS.map((k) => EG_BOARD_TAB_TEXT[k]), backdrop: 'none', selectedIndex: EG_BOARD_TABS.indexOf(at),
    onPick: (i) => { at = EG_BOARD_TABS[i] ?? at; showLines(); }, onCancel: close,
  })); };
  const showLines = () => { shown = 'lines'; put(new ListPicker({ items: egBoardLines(board, at, { short: true, runs: at === 'runs' ? runs() : [] }), backdrop: 'none', onPick: () => showTabs(), onCancel: () => showTabs() })); };
  if (classic) {
    if (!listPickerReady() || typeof mountWindow !== 'function') return null;
    showTabs();
    if (!open) return null;
  } else {
    if (!doc?.createElement) return null;
    panel = createEgBoardPanel({ doc, onTab: (k) => { at = k; panel?.render(board, at); }, onClose: close, runs });
    panel.render(null, at);
  }
  Promise.resolve().then(() => fetchBoard()).then((r) => (r?.ok === false ? { error: r.error ?? 'offline' } : r?.ok === true ? r.data : r), () => ({ error: 'offline' })).then((b) => {
    if (!open) return;
    board = b ?? { error: 'offline' };
    if (panel) panel.render(board, at);
    else if (win && shown === 'lines') showLines();   // a tab's lines up while the board was read: shown again, read
  });
  return handle;
}

/**
 * EG-ZM (2026-10-12, Elite-Gates.md section 20 - "reached from the Timers row and from the start window"): THE BOARDS' ONE
 * DOOR - every way in (`/breach board`, the Timers row's Elite entries, the start window) opens the boards here. `open(o)`
 * opens them (the host's openEgBoard, its skin and its service) with this door's `mountWindow`, `closeWindow` and
 * `onClosed` laid over; `slot` is the host's mode slot - `top()` its occupant, `mount(w)` (false: refused), `close(w)`.
 *   - ONE AT A TIME: asked again, the boards standing are closed first - out of the slot before the next go in (their own
 *     close is once, so boards their own door already closed are closed again to no effect).
 *   - A WINDOW ON ITS WAY OUT gives the slot up: the pause face a Timers door handed off is done but not yet drained from
 *     the mode's slot, and the classic skin's picker would be refused behind it.
 * The door answers the boards it opened, or null; `onClosed` is told once, however they close.
 * @param {{ open: (o: { mountWindow: (w: any) => boolean, closeWindow: (w: any) => void, onClosed: () => void }) => any,
 *   slot: { top: () => any, mount: (w: any) => any, close: (w: any) => void } }} deps
 * @returns {(onClosed?: (() => void) | null) => any}
 */
export function createEgBoardDoor({ open, slot }) {
  let standing = null;
  const mountWindow = (w) => { const top = slot.top(); if (top?.done) slot.close(top); return !!slot.mount(w); };
  return (onClosed = null) => {
    standing?.close();
    standing = open({ mountWindow, closeWindow: slot.close, onClosed: () => onClosed?.() });
    return standing;
  };
}
