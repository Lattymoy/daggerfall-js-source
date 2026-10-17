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

/** The tabs, in their order: the Descent's three brackets (server-account/src/egHonours.js EG_BRACKETS), the Depths and
 *  the Deepest Redoubts. */
export const EG_BOARD_TABS = Object.freeze(['alone', 'few', 'company', 'depths', 'deepest', 'runs']);
/** A tab's name. AUDIT EG V (c, L7-19; section 27.6 - "the last five runs are kept"): the sixth, this device's own last runs
 *  (ui/eliteGates/egHud.js egRecapsKept - the recaps it kept, read here and nowhere else before). */
export const EG_BOARD_TAB_TEXT = Object.freeze({
  alone: 'The Descent - Alone', few: 'The Descent - The Few', company: 'The Descent - The Company',
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

const STYLE_ID = 'dfegboard-style';
const CSS = `
.dfegboard{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:13;box-sizing:border-box;width:min(640px,calc(100vw - 32px));
  max-height:calc(100vh - 36px);overflow:auto;background:rgba(18,14,10,.93);border:1px solid #8a6a2c;border-radius:6px;color:#e8dcc0;
  font:14px/1.35 Georgia,serif;padding:10px 14px;box-shadow:0 6px 24px rgba(0,0,0,.6)}
.dfegboard h3{margin:0 0 6px;font-size:15px;color:#e2b85a;font-weight:normal;letter-spacing:.04em}
.dfegboard .tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}
.dfegboard .tabs button.on{border-color:#e2b85a;color:#fff3cf;box-shadow:0 0 0 1px #e2b85a inset}
.dfegboard .line{margin:1px 0}.dfegboard .line.you{color:#f6e3a4}.dfegboard .line.head{color:#c8b48a;font-size:13px}
.dfegboard .foot{margin-top:6px;color:#c8b48a;font-size:13px}
.dfegboard .acts{display:flex;justify-content:flex-end;margin-top:8px}
.dfegboard button{background:#3a2c14;color:#f0dfb0;border:1px solid #8a6a2c;border-radius:3px;padding:3px 9px;font:13px Georgia,serif;cursor:pointer}
.dfegboard:focus{outline:none}.dfegboard button:focus-visible{outline:2px solid #f0dfb0;outline-offset:1px}
`;

/**
 * THE ENHANCED SKIN'S PANEL in the page: the title, the five tabs, the tab's lines (egBoardLines - the head's two, the
 * rows, the foot's two), a close. `onTab(tab)` a tab pressed, `onClose()` the close or Escape. `render(board, tab)`
 * repaints; `destroy()` takes it away (once).
 * @param {{ doc?: any, onTab: (tab: string) => void, onClose: () => void, runs?: () => any[] }} p
 */
export function createEgBoardPanel({ doc = document, onTab, onClose, runs = () => [] }) {   // AUDIT EG V (c, L7-19): `runs` this device's last runs
  if (doc?.getElementById && !doc.getElementById(STYLE_ID)) {
    const s = doc.createElement('style');
    s.id = STYLE_ID; s.textContent = CSS;
    (doc.head ?? doc.body)?.append(s);
  }
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const root = el('div', 'dfegboard');
  root.id = EG_BOARD_PANEL_ID;   // AUDIT EG III: an enhanced door, for the pad
  root.setAttribute('tabindex', '-1');
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
  return {
    root,
    render(board, tab) {
      if (!alive) return;
      const t = EG_BOARD_TABS.includes(tab) ? tab : EG_BOARD_TABS[0];
      root.replaceChildren();
      root.append(el('h3', '', EG_BOARD_TEXT.title));
      const tabs = el('div', 'tabs');
      for (const k of EG_BOARD_TABS) {
        const b = el('button', k === t ? 'on' : '', EG_BOARD_TAB_TEXT[k]);
        b.setAttribute('data-tab', k);
        b.addEventListener('click', () => onTab(k));
        tabs.append(b);
      }
      root.append(tabs);
      const lines = egBoardLines(board, t, { runs: t === 'runs' ? runs() : [] });
      const foot = t !== 'runs' && board && !board.error;   // AUDIT EG V (c, L7-19): the last runs have no foot and no head of the season
      const rows = foot ? lines.length - 2 : lines.length;   // the foot's two (the Proclamation, the best) apart
      lines.forEach((line, i) => {
        if (i >= rows && foot) { root.append(el('div', 'foot', line)); return; }
        root.append(el('div', `line${(foot && i < 2) || (t === 'runs' && i === 0) ? ' head' : ''}${/ - you$/.test(line) ? ' you' : ''}`, line));
      });
      const acts = el('div', 'acts');
      const close = el('button', '', EG_BOARD_TEXT.close);
      close.addEventListener('click', () => onClose());
      acts.append(close);
      root.append(acts);
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
