// @ts-check
// EVENTS1 (2026-10-23, the owner: "Instead of stuffing these in the chat menu, there must be a less obstructive and more
// detailed way to handle them"): THE EVENT BOARD, ON THE HUD. Design: bible/10-UI/Event-Board.md; its audit,
// bible/01-Overview/audits/Audit-Event-Board.md.
//
// ONE PLATE AT THE LEFT EDGE. Its rows are the shared events a player can still reach (systems/eventBoard.js
// eventBoardModel) - each one's name, its clock ("12:04 left", "in 4:30"), how far and which way from here, then where;
// live ones first; a raid's count while it runs. Its NEWS stands at its head: an event come onto it ("Starting soon"),
// one begun ("Under way") - its name, clock, way, place and detail - and the events' own lines (systems/eventNotices.js,
// the one door) as its notes, so the gate's omen, a star's hold and a raid's cleansing are said here and no longer on
// the chat. One news at a time, EVENT_TOAST_MS of shown time each (the rest wait); its clock stops while the HUD is
// hidden. Nothing takes the pointer.
//
// WHERE IT STANDS - MEASURED, NOT ASSUMED (AUDIT EVENTS1 B1-B3, B5): every EVENT_LAYOUT_MS, and whenever what it shows
// changes, the plate stands under whatever stands above its edge (the chat's box - however wide or open - and the Social
// panel), and no higher than its own place (`clamp(244px, 40vh, 460px)`, under a full chat peek); and it keeps over
// whatever stands below (the status widget, the quick slots, the hotbar, the vitals, the temperature plate, the touch
// layer's presses, the journey bar, a phone's party list). Its rows are as many as fit (EVENT_TALL_ROWS on a tall
// screen, EVENT_BOARD_ROWS on a desk's, fewer where the room is less); where not even its news fits - a phone on its
// side, a chat opened tall - the news is said on the HUD's line instead (systems/notify.js hudText: the notices'
// stack under Enhanced Plus, PopupText on the classic skin) and the plate stands down. It reads the HUD's scale off
// `.hud` as the loot banners do. The status widget no longer yields to it: what a player needs in a fight keeps its band
// and the board takes what is left. A plate the player moved in the HUD editor keeps where they put it.
//
// SPOKEN ONCE (AUDIT EVENTS1 B7): a visually hidden polite region of its own, standing while the board does, says each
// news once and whole on the first frame it shows (the quest herald's law, AUDIT GUIDE H3); the plate itself is
// aria-hidden, so no clock is read out every second.
//
// DRAWN FROM ui/hud/hud.js drawHud, the one call all four hosts make, under the HUD's own hide gate - no host line
// (HOST-SPLIT). The source is the host's Timers source, seated where it is made (scenes/world.js timersSource,
// systems/eventNotices.js seatEventBoard), read at most every EVENT_READ_MS.
//
// DRESSED IN EVERY SKIN, as the star's tracker is: under Enhanced Plus the kit's panel (ui/enhanced/enhancedFrame.js
// FRAME_ROLES), on the classic skin the kit's own rules cut to it (scopeRules). A movable piece under Enhanced Plus
// (ui/hud/hudLayout.js HUD_PIECES `events`); taken off the page while it has nothing to show, so the editor's preview
// stands in for it (AUDIT EVENTS1 B6). The player's switch (systems/features.js `event-board`, or the piece put away in
// the editor) takes it down and gives the lines back to where they were said before. Not a DFU member. Ledger A (EVENTS1).
import { eventBoardModel, eventAnnouncements, createEventToasts, EVENT_KIND_TEXT, EVENT_BOARD_TEXT, EVENT_BOARD_ROWS, EVENT_SINGLE_KINDS } from '../systems/eventBoard.js';
import { takeEventNotices, eventBoardSource, eventBoardOn, eventNoticeElsewhere, eventHudLine } from '../systems/eventNotices.js';
import { timerText } from '../systems/eventTimers.js';
import { t } from '../systems/textManager.js';
import { FRAME_TONES, frameCss, scopeRules } from './enhanced/enhancedFrame.js';
import { injectEnhancedFonts } from './enhanced/enhancedStyle.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { PIXEL_FONT_CSS, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';
import { STAR_VIOLET_CSS } from './starfall/starMapMark.js';
import { SERPENT_RING_MAP_CSS } from './serpentMapMark.js';
import { SD_RING_MAP_CSS } from './superDungeon/sdMapMark.js';

export const EVENT_BOARD_STYLE_ID = 'dagger-event-board-style';
export const EVENT_BOARD_KIT_ID = 'dagger-event-board-kit';
export const EVENT_BOARD_LIVE_ID = 'dagger-event-board-live';
/** The source is read this often at most (the clocks are written every frame from the last read). */
export const EVENT_READ_MS = 500;
/** The plate's room is measured this often (and whenever what it shows changes). */
export const EVENT_LAYOUT_MS = 250;
/** The air the plate keeps above and below. */
export const EVENT_GAP_PX = 8;
/** A tall screen's rows (EVENT_BOARD_ROWS a desk's), at most - fewer where the room is less. */
export const EVENT_TALL_ROWS = 4;
export const EVENT_TALL_PX = 900;
/** The rows the board stands at most for a screen `h` px tall. */
export const eventRowsFor = (h) => (h >= EVENT_TALL_PX ? EVENT_TALL_ROWS : EVENT_BOARD_ROWS);
/** What stands above the plate's edge (it stands under them) and below it (it keeps over them). */
export const EVENT_ABOVE = Object.freeze(['.dfchat', '.dfsocial[data-open="1"]']);
export const EVENT_BELOW = Object.freeze(['.hud .hud-stat', '.hud .hud-quick', '.hud .hb', '.hud .hud-bars', '.hud .hud-temp', '.dftouch-btn', '.travelpanel-bar', '.dfparty']);
/** Where no enhanced HUD stands (the classic skin's is drawn in the canvas, its vitals at the bottom left): the plate
 *  keeps over this share of the screen's foot. */
export const EVENT_CLASSIC_FOOT = 0.22;
/** A kind's mark - the Timers window's own colours (ui/enhanced/enhancedStyle.js `.px-timerswin .tm-*`), so a row reads
 *  the same in both; the festival's is the board's own (the window has no row of it). */
export const EVENT_KIND_CSS = Object.freeze({
  gate: '#e2554c', serpent: SERPENT_RING_MAP_CSS, super: SD_RING_MAP_CSS, star: STAR_VIOLET_CSS, raid: '#f2c46b', festival: '#9fd18b',
});

/**
 * THE PLATE'S PLACE (AUDIT EVENTS1 B1-B3, B5): its top - under the lowest of what stands above its edge, and no higher
 * than its own place - and the room under it to the highest of what stands below. `above` and `below` are the screen
 * boxes `{ top, bottom, left, right }` that cross the plate's own span (`left`..`right`); `vh` the screen's height;
 * `classic` where no enhanced HUD stands (its canvas vitals take EVENT_CLASSIC_FOOT of the foot). Pure.
 * @param {{ vh: number, left: number, right: number, above?: any[], below?: any[], classic?: boolean }} o
 */
export function eventBoardPlace({ vh, left, right, above = [], below = [], classic = false }) {
  const crosses = (r) => r && r.right > left && r.left < right && r.bottom > r.top;
  const home = Math.min(460, Math.max(244, 0.4 * vh));
  const top = Math.max(home, ...above.filter(crosses).map((r) => r.bottom + EVENT_GAP_PX));
  // whatever reaches below the plate's top - a bar that starts a pixel above it too (a phone on its side: the hotbar, the
  // quick slots' column) - ends its room
  const floor = Math.min(classic ? vh * (1 - EVENT_CLASSIC_FOOT) : vh - EVENT_GAP_PX, ...below.filter((r) => crosses(r) && r.bottom > top).map((r) => r.top - EVENT_GAP_PX));
  return { top, room: Math.max(0, floor - top) };
}

const kindRules = Object.entries(EVENT_KIND_CSS).map(([k, c]) => `.evboard .ev-${k} { --ev-kind: ${c}; }`).join('\n');
export const EVENT_BOARD_CSS = `
.evhud { position: fixed; left: calc(14px + var(--ui-pillar, 0px) + env(safe-area-inset-left, 0px)); top: clamp(244px, 40vh, 460px); z-index: 4;
  pointer-events: none; box-sizing: border-box; width: min(300px, calc((100vw - 28px) / var(--hud-scale, 1)));
  transform: scale(var(--hud-scale, 1)); transform-origin: left top; ${PIXEL_FONT_CSS} }
.evhud.hidden { visibility: hidden; }
/* the ink and its shadow on the plate itself, the surface a dress inks (the Grimoire's - AUDIT EVENTS1 B11) */
.evboard { box-sizing: border-box; padding: 7px 10px 8px; border-width: 2px; border-style: solid; color: #e9e4d9; text-shadow: ${PIXEL_TEXT_SHADOW}; }
.evboard-title { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: ${FRAME_TONES.brassHi}; margin-bottom: 4px; }
.evrow { position: relative; padding: 4px 0 4px 12px; border-top: 1px solid rgba(163,152,128,0.22); }
.evboard-rows > .evrow:first-child { border-top: 0; }
.evrow::before { content: '\\25c6'; position: absolute; left: 0; top: 6px; font-size: 8px; color: var(--ev-kind, #9c937d); }
.evrow-top { display: flex; align-items: baseline; gap: 8px; }
.evrow-title { flex: 1 1 auto; min-width: 0; font-size: 14px; line-height: 1.25; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.evrow-clock { flex: none; font-size: 13px; font-variant-numeric: tabular-nums; color: #f3cf86; }
.evrow.live .evrow-clock { color: #9fe8b4; }
.evrow-where, .evrow-detail { font-size: 12px; line-height: 1.3; color: #b7ae97; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.evrow-detail { color: #9a9486; }
.evrow-where:empty, .evrow-detail:empty, .evboard-more:empty, .evboard-rows:empty { display: none; }
.evboard-more { font-size: 11px; color: #9a9486; margin-top: 3px; }
/* THE NEWS: at the head of the plate, in its kind's colour, sliding in from the edge the plate stands at */
.evnews { position: relative; margin: 2px 0 6px; padding: 6px 8px 7px 11px; background: rgba(255,255,255,0.05);
  box-shadow: inset 3px 0 0 var(--ev-kind, #c08a3e); transition: transform 240ms ease-out, opacity 240ms ease-out; }
.evnews.enter { transform: translateX(-24px); opacity: 0; }
.evnews-kind { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ev-kind, #c08a3e); }
.evnews-top { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; }
.evnews-title { flex: 1 1 auto; min-width: 0; font-size: 15px; line-height: 1.25; color: #ffffff; }
.evnews-where { font-size: 12px; line-height: 1.3; margin-top: 2px; color: #c9c0a8; }
.evnews-clock { flex: none; font-size: 13px; color: #f3cf86; font-variant-numeric: tabular-nums; }
.evnews.live .evnews-clock { color: #9fe8b4; }
.evnews-detail { font-size: 12px; line-height: 1.3; margin-top: 2px; color: #9a9486; }
.evnews-note { font-size: 13px; line-height: 1.35; margin-top: 4px; color: #e9e4d9; }
.evnews-title:empty, .evnews-where:empty, .evnews-clock:empty, .evnews-detail:empty { display: none; }
@media (prefers-reduced-motion: reduce) { .evnews, .evnews.enter { transition: none; transform: none; opacity: 1; } }
@media (max-width: 640px) { .evhud { width: min(240px, calc((100vw - 28px) / var(--hud-scale, 1))); } .evrow-title { font-size: 13px; } }
/* the board's own voice: visually hidden, read once a news (the quest herald's region's shape) */
.evboard-live { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }
${kindRules}
`;
/** The kit's selector of the board (its classic copy is the kit's rules cut to it). */
export const isEventBoardSelector = (/** @type {string} */ sel) => /\.evboard(?![\w-])/.test(sel);

let root = null, board = null, newsBox = null, list = null, more = null, live = null, readAt = -Infinity, layoutAt = -Infinity;
let model = { rows: [], more: 0, all: [], now: NaN };
let watchFrom = null, offsetMs = 0, rowsCap = EVENT_BOARD_ROWS, room = Infinity, spoken = '', lastScale = '', lastFitKey = '';
const seen = new Map();
const toasts = createEventToasts({ shown: 1 });
/** news key -> its node and parts */
const newsNodes = new Map();
/** row id -> its parts, and the shape the rows were built for */
let rowNodes = new Map(), shape = null;

function ensureStyle(doc) {
  const lay = (id, text) => {
    if (doc.getElementById?.(id)) return;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = text;
    (doc.head ?? doc.body)?.append(st);
  };
  lay(EVENT_BOARD_STYLE_ID, EVENT_BOARD_CSS);
  if (doc.head) injectEnhancedFonts(doc);
  if (!isEnhancedPlus()) lay(EVENT_BOARD_KIT_ID, scopeRules(frameCss(), isEventBoardSelector));
}
const part = (doc, cls, text = '') => { const n = doc.createElement('div'); n.className = cls; if (text) n.textContent = text; return n; };
const set = (n, v) => { const s = v ?? ''; if (n.textContent !== s) n.textContent = s; };
/** A class list from its parts, the false ones left out. */
const classes = (...parts) => parts.filter(Boolean).join(' ');

function build(doc) {
  ensureStyle(doc);
  root = part(doc, 'evhud');
  root.setAttribute?.('aria-hidden', 'true');   // AUDIT EVENTS1 B7: the board's voice speaks; the plate never does
  board = part(doc, 'evboard');
  newsBox = part(doc, 'evboard-news');
  list = part(doc, 'evboard-rows');
  more = part(doc, 'evboard-more');
  board.append(part(doc, 'evboard-title', EVENT_BOARD_TEXT.title()), newsBox, list, more);
  root.append(board);
  live = part(doc, 'evboard-live');
  live.id = EVENT_BOARD_LIVE_ID;
  live.setAttribute?.('aria-live', 'polite');
  live.setAttribute?.('aria-atomic', 'true');
  (doc.body ?? doc.documentElement)?.append(live);
}
/** On the page while it has something to show; off it otherwise (the editor's preview stands in for it). */
function stand(doc, on) {
  if (!root) return;
  const host = doc.body ?? doc.documentElement;
  if (on && root.parentNode !== host) host?.append(root);
  else if (!on && root.parentNode) root.remove?.();
}

/** A row's or a news's clock: to its end while live, to its start while coming. */
const clockOf = (r, now) => (r ? (r.live ? EVENT_BOARD_TEXT.left(timerText(r.at - now)) : EVENT_BOARD_TEXT.starts(timerText(r.at - now))) : '');
/** How far and which way, then where - the way first, so a long place name cut at the plate's edge never cuts it. */
const whereOf = (r) => [r?.way?.text, r?.where].filter(Boolean).join(' · ');

/** AUDIT EVENTS1 A1: a news's row - its own event's (its id); a line of a kind with one event at a time that came with
 *  no id, that kind's one row; else none (a line whose event has gone shows alone, never under another's). */
export function newsRowOf(c, rows) {
  if (c.id) return rows.find((x) => x.id === c.id) ?? null;
  if (!EVENT_SINGLE_KINDS.includes(c.kind)) return null;
  const ofKind = rows.filter((r) => r.kind === c.kind);
  return ofKind.length === 1 ? ofKind[0] : null;
}

function drawRows(doc, now, inNews) {
  // the news's own row is the news, opened - never twice on the plate
  const rows = model.rows.filter((r) => !inNews.has(r.id)).slice(0, Math.max(0, rowsCap));
  const next = JSON.stringify(rows.map((r) => [r.id, r.kind, r.live]));
  if (next !== shape) {
    shape = next;
    rowNodes = new Map();
    list.textContent = '';
    for (const r of rows) {
      const row = part(doc, classes('evrow', `ev-${r.kind}`, r.live && 'live'));
      const top = part(doc, 'evrow-top');
      const p = { title: part(doc, 'evrow-title'), clock: part(doc, 'evrow-clock'), where: part(doc, 'evrow-where'), detail: part(doc, 'evrow-detail') };
      top.append(p.title, p.clock);
      row.append(top, p.where, p.detail);
      list.append(row);
      rowNodes.set(r.id, p);
    }
  }
  for (const r of rows) {
    const p = rowNodes.get(r.id);
    if (!p) continue;
    set(p.title, r.title); set(p.clock, clockOf(r, now)); set(p.where, whereOf(r));
    set(p.detail, r.kind === 'raid' && r.live ? r.detail : '');   // a raid's count; the rest on its news
  }
  // AUDIT EVENTS1 A9: what stands that the plate shows nowhere - every event less its rows and its news's own
  const shownIds = new Set([...rows.map((r) => r.id), ...inNews]);
  const hidden = model.all.filter((r) => !shownIds.has(r.id)).length;
  set(more, hidden > 0 ? EVENT_BOARD_TEXT.more(hidden) : '');
  return rows.length;
}

/** The news's words: its heading (with its phase - "Under way" once its event is, whatever it was announced as), and
 *  the one line it is said in on the HUD's line where the plate has no room for it. */
function newsWords(c, r, now) {
  const heading = EVENT_KIND_TEXT[c.kind]?.() ?? '';
  const phase = !c.phase ? '' : c.phase === 'soon' && !r?.live ? EVENT_BOARD_TEXT.soon() : EVENT_BOARD_TEXT.begun();
  return { kind: phase ? `${heading} · ${phase}` : heading, line: r ? EVENT_BOARD_TEXT.alone(heading, [r.title, whereOf(r)].filter(Boolean).join(', '), clockOf(r, now)) : '' };
}

function drawNews(doc, now, inNews) {
  const shown = toasts.cards();
  const keep = new Set(shown.map((c) => c.key));
  for (const [key, n] of newsNodes) if (!keep.has(key)) { newsNodes.delete(key); n.root.remove?.(); }
  for (const c of shown) {
    let n = newsNodes.get(c.key);
    if (!n) {
      n = { root: part(doc, classes('evnews', `ev-${c.kind}`, 'enter')), kind: part(doc, 'evnews-kind'), title: part(doc, 'evnews-title'), where: part(doc, 'evnews-where'), clock: part(doc, 'evnews-clock'), detail: part(doc, 'evnews-detail'), notes: part(doc, 'evnews-notes'), said: '', entering: true };
      const top = part(doc, 'evnews-top');
      top.append(n.title, n.clock);
      n.root.append(n.kind, top, n.where, n.detail, n.notes);
      newsBox.append(n.root);
      newsNodes.set(c.key, n);
      void n.root.offsetWidth;   // the resting style computed first, so the slide has a "before" (ui/enhanced/enhancedNotice.js's law)
    } else n.entering = false;
    const r = newsRowOf(c, model.all);
    if (r) inNews.add(r.id);
    const w = newsWords(c, r, now);
    set(n.kind, w.kind);
    set(n.title, r?.title ?? '');
    set(n.where, whereOf(r));
    set(n.clock, r ? clockOf(r, now) : '');
    set(n.detail, r?.detail ?? '');
    const cls = classes('evnews', `ev-${c.kind}`, r?.live && 'live', n.entering && 'enter');
    if (n.root.className !== cls) n.root.className = cls;
    const said = c.notes.join('\n');
    if (said !== n.said) {
      n.said = said;
      n.notes.textContent = '';
      for (const s of c.notes) n.notes.append(part(doc, 'evnews-note', s));
    }
    // the board's voice: a news said once when it first shows, and again only when a line joins it (never its clock)
    const voice = `${c.key}|${w.kind}|${c.notes.length}`;
    if (live && voice !== spoken) { spoken = voice; live.textContent = [w.kind, r?.title, whereOf(r), ...c.notes].filter(Boolean).join('. '); }
  }
  return shown.length;
}

/** AUDIT EVENTS1 B1-B3, B5: the plate's place and room, off the page as it stands now, and the HUD's scale. */
function measure(doc) {
  const win = doc.defaultView ?? globalThis;
  const vh = Number(win.innerHeight) || 720;
  const hud = doc.querySelector?.('.hud');
  const scale = hud?.style?.getPropertyValue?.('--hud-scale') || '';
  if (scale !== lastScale) { lastScale = scale; if (scale) root.style?.setProperty?.('--hud-scale', scale); else root.style?.removeProperty?.('--hud-scale'); }
  if (root.hasAttribute?.('data-hm-moved')) { room = Infinity; return; }   // where the player put it, theirs to keep
  const box = (n) => { const r = n?.getBoundingClientRect?.(); return r && r.height > 0 && r.width > 0 ? r : null; };
  const all = (sels) => sels.flatMap((s) => { try { return [...(doc.querySelectorAll?.(s) ?? [])]; } catch { return []; } }).map(box).filter(Boolean);
  const me = box(root) ?? box(board);
  const left = me?.left ?? 14, right = me ? me.right : left + 300;
  const place = eventBoardPlace({ vh, left, right, above: all(EVENT_ABOVE), below: all(EVENT_BELOW), classic: !hud });
  const top = `${Math.round(place.top)}px`;
  if (root.style && root.style.top !== top) root.style.top = top;
  room = place.room;
}
/** The plate's height on the screen now (its scale in it); 0 where it cannot be measured (a fake page). */
const plateHeight = () => Number(board?.getBoundingClientRect?.()?.height) || 0;

/** Every memory of the board let go, its plate and its voice taken down (the switch off, a reset). */
function reset() {
  root?.remove?.(); live?.remove?.();
  root = null; board = null; newsBox = null; list = null; more = null; live = null; readAt = -Infinity; layoutAt = -Infinity;
  model = { rows: [], more: 0, all: [], now: NaN };
  watchFrom = null; offsetMs = 0; rowsCap = EVENT_BOARD_ROWS; room = Infinity; spoken = ''; lastScale = ''; lastFitKey = '';
  seen.clear(); toasts.clear(); newsNodes.clear(); rowNodes = new Map(); shape = null;
}

/** Draw the news and the rows; where the plate stands taller than its room, a row fewer until it fits. False where it
 *  does not, or where nothing is left on it (a title over "more in Timers" is no board). */
function drawFitted(doc, now, fit) {
  let shown = 0;
  const once = () => { const inNews = new Set(); shown = drawNews(doc, now, inNews) + drawRows(doc, now, inNews); };
  once();
  if (!fit || !Number.isFinite(room)) return shown > 0;
  for (let guard = 0; guard <= EVENT_TALL_ROWS && plateHeight() > room && rowsCap > 0; guard++) { rowsCap--; once(); }
  return shown > 0 && !(plateHeight() > room);
}

/**
 * ONE HUD FRAME OF THE BOARD. `hidden` the HUD's own hide gate (a window, the cursor, a hidden HUD): the board hides and
 * the news's clock stops; the lines still come off the door and the announcements are still made. `dt` the frame's
 * seconds; `nowMs` this machine's clock (the tests'); `height` the screen's (its rows at most).
 * @param {{ hidden?: boolean, dt?: number, doc?: any, nowMs?: number, height?: number }} [o]
 */
export function drawEventBoard({ hidden = false, dt = 0, doc = globalThis.document, nowMs = Date.now(), height = Number(globalThis.innerHeight) || 720 } = {}) {
  const lines = takeEventNotices();
  // AUDIT EVENTS1 C4 / B9: off, a line taken in this frame goes where it went before, and the board forgets everything
  if (!eventBoardOn()) { for (const l of lines) eventNoticeElsewhere(l.kind, l.text, true); if (root || seen.size || watchFrom != null) reset(); return; }
  if (!doc?.createElement) return;
  if (nowMs - readAt >= EVENT_READ_MS) {
    const src = eventBoardSource();
    readAt = nowMs;
    model = eventBoardModel(src, { max: EVENT_TALL_ROWS });   // cut again to the plate's rows (eventRowsFor, the room)
    offsetMs = Number.isFinite(model.now) ? model.now - nowMs : 0;
    // AUDIT EVENTS1 A5: the board watches from its first read of the world; what came onto it before that is no news
    if (src && watchFrom == null && Number.isFinite(model.now)) watchFrom = model.now;
    if (src) for (const a of eventAnnouncements(model.all, seen, watchFrom)) toasts.announce(a);
  }
  for (const l of lines) toasts.note(l.kind, l.text, l.at, l.id);
  const on = !hidden;
  if (on) toasts.step((Number(dt) || 0) * 1000);
  if (!root) {
    if (!model.rows.length && !toasts.cards().length) return;
    build(doc);
  }
  const want = classes('evhud', !on && 'hidden');
  if (root.className !== want) root.className = want;
  if (!on) return;   // hidden, the whole of it is - news behind a window keeps its place and its time
  const now = nowMs + offsetMs;
  if (!model.rows.length && !toasts.cards().length) { stand(doc, false); return; }
  stand(doc, true);
  const layoutDue = nowMs - layoutAt >= EVENT_LAYOUT_MS;
  if (layoutDue) { layoutAt = nowMs; rowsCap = eventRowsFor(height); measure(doc); }
  // fitted again whenever what it shows changes (a row on or off, a news or a line joining it), from its full count
  const fitKey = `${model.rows.map((r) => r.id).join()}|${toasts.cards().map((c) => `${c.key}:${c.notes.length}`).join()}`;
  const refit = fitKey !== lastFitKey;
  lastFitKey = fitKey;
  if (refit && !layoutDue) rowsCap = eventRowsFor(height);
  if (drawFitted(doc, now, layoutDue || refit)) return;
  // no room even for its news: each said on the HUD's line, and the plate stands down until there is room again
  for (const c of toasts.cards()) {
    const w = newsWords(c, newsRowOf(c, model.all), now);
    eventHudLine(w.line || w.kind);   // the board's own line, a moment's - never the journal's
    for (const s of c.notes) eventHudLine(s);   // the door filed each already
    toasts.take(c.key);
  }
  for (const [, n] of newsNodes) n.root.remove?.();
  newsNodes.clear();
  stand(doc, false);
}

/** EVENTS1: the HUD editor's stand-in (ui/hud/hudLayout.js buildGhost `events`) - the board as it stands with an event
 *  on it, in its own sheet, so a player can place it whether or not an event stands now. */
export function buildEventBoardPreview(doc) {
  ensureStyle(doc);
  const g = part(doc, 'evhud');
  const b = part(doc, 'evboard');
  b.append(part(doc, 'evboard-title', EVENT_BOARD_TEXT.title()));
  const row = part(doc, 'evrow ev-star live');
  const top = part(doc, 'evrow-top');
  top.append(part(doc, 'evrow-title', t('menu.hud.preview.events', '{kind} (preview)', { kind: EVENT_KIND_TEXT.star() })), part(doc, 'evrow-clock', EVENT_BOARD_TEXT.left('12:00')));
  row.append(top, part(doc, 'evrow-where', EVENT_BOARD_TEXT.way(4.2, t('events.dir.ne', 'NE'))));   // AUDIT EVENTS1 B6: in the player's words
  const rows = part(doc, 'evboard-rows');
  rows.append(row);
  b.append(rows);
  g.append(b);
  return g;
}

/** The board taken down (a reset, the tests): nothing waiting is kept. */
export function destroyEventBoard() { reset(); }
