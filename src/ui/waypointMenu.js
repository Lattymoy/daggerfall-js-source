// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WAYPOINTS (2026-10-06): THE RIGHT-CLICK MENU - one box for both maps (the Overworld, scenes/world.js; the held map,
// ui/heldMap.js). On the land or the sheet it ADDS a waypoint there: a name (the next "Waypoint N" offered, selected),
// its kind (Personal, Party, Guild) and its flag's colour. On a flag it EDITS that waypoint: rename, recolour, follow
// or stop following, travel there (where the map can), share it again (one of mine for a party or a guild), remove.
//
// THE HUD'S KIND OF THING, NOT A WINDOW (ui/travelViewHud.js's law): it registers with no overlay stack - the Overworld's
// world runs on under it. It takes its own presses (a press inside it is never the map's or the world's), Escape closes
// it (the host's overlayUp asks `waypointMenuOpen` so the view's own Escape waits), Enter answers it, and a press
// anywhere outside lets it go. One at a time: a second replaces the first.
// ═══════════════════════════════════════════════════════════════════
import {
  WAYPOINT_KINDS, WAYPOINT_COLORS, WAYPOINT_TEXT, WAYPOINT_NAME_MAX, waypointById, nextWaypointName, addWaypoint,
  renameWaypoint, recolorWaypoint, removeWaypoint, setWaypointFollowed, isWaypointFollowed, shareWaypoint,
  waypointSharingLive, cleanWaypointName,
} from '../systems/mapWaypoints.js';

export const WAYPOINT_MENU_ID = 'wp-menu';
const STYLE_ID = 'wp-menu-style';
const MENU_W = 248;

/** Every rule under `:where()` (no weight): the Enhanced Plus kit (FRAME_ROLES: the box a window, the presses buttons,
 *  the name an input) and its sheet always dress it, whatever order the sheets landed in. It stands at the in-game top
 *  tier, 39 - appended last, so over both maps and every window of that tier - and under the asset picker (MWFIX 1,
 *  scenes/dataSource.js ASSET_PICKER_Z, 40, which nothing in src/ may reach). */
const CSS = `
:where(#${WAYPOINT_MENU_ID}) { position: fixed; z-index: 39; box-sizing: border-box; width: ${MENU_W}px;
  max-width: calc(100vw - 16px); padding: 10px 12px 12px; pointer-events: auto; user-select: none;
  font-family: var(--data, 'Barlow Semi Condensed', system-ui, sans-serif); font-size: 12px; color: var(--bone, #e9e4d9);
  background: linear-gradient(180deg, rgba(23,27,33,0.97), rgba(14,16,19,0.98));
  border: 1px solid rgba(192,138,62,0.55); border-radius: 3px; box-shadow: 0 4px 20px rgba(0,0,0,0.65); }
:where(#${WAYPOINT_MENU_ID}) * { box-sizing: border-box; }
:where(#${WAYPOINT_MENU_ID}) .wpm-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
:where(#${WAYPOINT_MENU_ID}) .wpm-title { flex: 1 1 auto; min-width: 0; font-size: 14px; color: var(--bone, #e9e4d9);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
:where(#${WAYPOINT_MENU_ID}) .wpm-sub { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim, #9a9384); }
:where(#${WAYPOINT_MENU_ID}) .wpm-x { flex: 0 0 auto; cursor: pointer; background: none; border: 0; color: var(--dim, #9a9384); font-size: 16px; line-height: 1; padding: 0 2px; }
:where(#${WAYPOINT_MENU_ID}) .wpm-x:hover { color: var(--bone, #e9e4d9); }
:where(#${WAYPOINT_MENU_ID}) .wpm-label { display: block; margin: 8px 0 4px; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim, #9a9384); }
:where(#${WAYPOINT_MENU_ID}) .wpm-row { display: flex; gap: 6px; align-items: center; }
:where(#${WAYPOINT_MENU_ID}) input.wpm-name { flex: 1 1 auto; min-width: 0; padding: 5px 7px; font: inherit; font-size: 13px;
  color: var(--bone, #e9e4d9); background: rgba(5,6,8,0.6); border: 1px solid rgba(192,138,62,0.4); border-radius: 2px; outline: none; user-select: text; }
:where(#${WAYPOINT_MENU_ID}) input.wpm-name:focus { border-color: var(--brass, #c08a3e); }
:where(#${WAYPOINT_MENU_ID}) .wpm-kinds { display: flex; }
:where(#${WAYPOINT_MENU_ID}) .wpm-kind { flex: 1 1 0; padding: 5px 4px; cursor: pointer; font: inherit; font-size: 11px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--dim, #9a9384); background: rgba(43,50,59,0.9); border: 1px solid rgba(192,138,62,0.4); }
:where(#${WAYPOINT_MENU_ID}) .wpm-kind + .wpm-kind { border-left: 0; }
:where(#${WAYPOINT_MENU_ID}) .wpm-kind.on { color: var(--brass, #c08a3e); background: rgba(192,138,62,0.28); }
:where(#${WAYPOINT_MENU_ID}) .wpm-kind:disabled { opacity: 0.4; cursor: default; }
:where(#${WAYPOINT_MENU_ID}) .wpm-swatches { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; }
:where(#${WAYPOINT_MENU_ID}) .wpm-swatch { height: 20px; cursor: pointer; border: 2px solid rgba(0,0,0,0.6); border-radius: 2px; padding: 0; }
:where(#${WAYPOINT_MENU_ID}) .wpm-swatch.on { border-color: var(--bone, #e9e4d9); box-shadow: 0 0 0 1px var(--brass, #c08a3e); }
:where(#${WAYPOINT_MENU_ID}) .wpm-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
:where(#${WAYPOINT_MENU_ID}) .wpm-btn { flex: 1 1 auto; padding: 6px 9px; cursor: pointer; font: inherit; font-size: 11.5px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--bone, #e9e4d9); background: rgba(43,50,59,0.9); border: 1px solid rgba(192,138,62,0.4); border-radius: 2px; }
:where(#${WAYPOINT_MENU_ID}) .wpm-btn:hover, :where(#${WAYPOINT_MENU_ID}) .wpm-kind:not(:disabled):hover { border-color: var(--verdigris, #4e7f72); color: var(--bone, #e9e4d9); }
:where(#${WAYPOINT_MENU_ID}) .wpm-btn.main { color: var(--brass, #c08a3e); background: rgba(192,138,62,0.22); }
:where(#${WAYPOINT_MENU_ID}) .wpm-btn.danger:hover { border-color: #bf2a1f; color: #ffb3a8; }
:where(#${WAYPOINT_MENU_ID}) .wpm-note { margin-top: 8px; font-size: 11px; line-height: 1.35; color: var(--dim, #9a9384); }
:where(#${WAYPOINT_MENU_ID}) .wpm-btn:focus-visible, :where(#${WAYPOINT_MENU_ID}) .wpm-kind:focus-visible, :where(#${WAYPOINT_MENU_ID}) .wpm-swatch:focus-visible { outline: 1px solid var(--brass, #c08a3e); outline-offset: 1px; }
`;

let open = null;   // { el, win, key, away, onClose, owner }

/** Whether the box stands (the hosts' overlayUp asks, so their own Escape waits for it). */
export const waypointMenuOpen = () => !!open;

/** Close it - or, with `owner`, only a box that map opened (the Overworld going down leaves the held map's alone). */
export function closeWaypointMenu(owner = null) {
  const o = open;
  if (!o || (owner != null && o.owner !== owner)) return;
  open = null;   // the slot emptied before the occupant is told (bible/Home.md)
  o.win?.removeEventListener?.('keydown', o.key, true);
  o.win?.removeEventListener?.('pointerdown', o.away, true);
  o.el.remove?.();
  try { o.onClose?.(); } catch { /* the caller's own fault */ }
}

function injectStyle(doc) {
  if (doc.getElementById?.(STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  (doc.head ?? doc.body)?.append(s);
}

/**
 * Open the box at the pointer.
 * @param {{
 *   x: number, y: number, doc?: Document,
 *   point?: { mx: number, my: number } | null,   // add: where on the bay
 *   id?: string | null,                           // edit: the waypoint
 *   by?: string,                                  // my name, written on a waypoint I share
 *   canKind?: { party?: boolean, guild?: boolean },
 *   onTravel?: ((w: any) => void) | null,         // edit: "Travel here", where the map can go there
 *   onNote?: ((text: string) => void) | null,     // a word to the player (a share that could not go)
 *   onClose?: (() => void) | null,
 *   owner?: string,                               // which map opened it ('overworld', 'heldmap')
 * }} o
 */
export function openWaypointMenu(o) {
  const doc = o.doc ?? globalThis.document;
  if (!doc?.body) return false;
  closeWaypointMenu();
  injectStyle(doc);
  const win = doc.defaultView;
  const el = (tag, cls = '', text = '') => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const box = el('div');
  box.id = WAYPOINT_MENU_ID;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Waypoint');
  const wp = o.id ? waypointById(o.id) : null;
  const adding = !wp;
  if (adding && !o.point) return false;
  const live = waypointSharingLive();
  let kind = 'personal';
  let color = adding ? 'red' : wp.color;
  // the head
  const head = el('div', 'wpm-head');
  const title = el('div', 'wpm-title', adding ? 'New waypoint' : wp.name);
  const x = el('button', 'wpm-x', '×');
  x.type = 'button'; x.title = 'Close'; x.onclick = (e) => { e.preventDefault(); closeWaypointMenu(); };
  head.append(title, x);
  box.append(head);
  if (!adding) box.append(el('div', 'wpm-sub', `${WAYPOINT_TEXT.kindWord[wp.kind]}${!wp.mine && wp.by ? ` · by ${wp.by}` : ''}`));
  // the name
  box.append(el('label', 'wpm-label', adding ? 'Name' : 'Rename'));
  const nameRow = el('div', 'wpm-row');
  const input = /** @type {HTMLInputElement} */ (el('input', 'wpm-name'));
  input.type = 'text';
  input.maxLength = WAYPOINT_NAME_MAX;
  input.value = adding ? nextWaypointName() : wp.name;
  input.spellcheck = false;
  input.autocomplete = 'off';
  nameRow.append(input);
  let saveName = null;
  if (!adding) {
    saveName = el('button', 'wpm-btn main', 'Save');
    saveName.type = 'button';
    saveName.style.flex = '0 0 auto';
    nameRow.append(saveName);
  }
  box.append(nameRow);
  // the kind (adding only - a waypoint keeps the kind it was made with)
  const kindBtns = {};
  if (adding) {
    box.append(el('label', 'wpm-label', 'Kind'));
    const kinds = el('div', 'wpm-kinds');
    for (const k of WAYPOINT_KINDS) {
      const b = el('button', 'wpm-kind', WAYPOINT_TEXT[k]);
      b.type = 'button';
      const allowed = k === 'personal' || o.canKind?.[k] !== false;
      b.disabled = !allowed;
      b.title = k === 'personal' ? 'Only you see it' : !allowed ? `You are not in a ${k}` : !live ? 'Kept here - you are offline, share it later' : `Your ${k} sees it`;
      b.onclick = (e) => { e.preventDefault(); kind = k; paint(); };
      kindBtns[k] = b;
      kinds.append(b);
    }
    box.append(kinds);
  }
  // the colour
  box.append(el('label', 'wpm-label', 'Flag colour'));
  const sw = el('div', 'wpm-swatches');
  const swatches = {};
  for (const c of WAYPOINT_COLORS) {
    const b = el('button', 'wpm-swatch');
    b.type = 'button';
    b.title = c.name;
    b.style.background = c.css;
    b.setAttribute('aria-label', c.name);
    b.onclick = (e) => {
      e.preventDefault();
      color = c.id;
      if (!adding) recolorWaypoint(wp.id, color);
      paint();
    };
    swatches[c.id] = b;
    sw.append(b);
  }
  box.append(sw);
  // the acts
  const acts = el('div', 'wpm-acts');
  const note = el('div', 'wpm-note');
  note.style.display = 'none';
  const say = (t) => { note.textContent = t; note.style.display = t ? '' : 'none'; o.onNote?.(t); };
  const btn = (label, cls, fn) => { const b = el('button', `wpm-btn ${cls}`, label); b.type = 'button'; b.onclick = (e) => { e.preventDefault(); fn(); }; acts.append(b); return b; };
  const doAdd = () => {
    const r = addWaypoint({ kind, mx: o.point.mx, my: o.point.my, name: input.value, color, by: o.by ?? '' });
    if (!r) { closeWaypointMenu(); return; }
    if (r.shared === false) o.onNote?.(`Waypoint "${r.waypoint.name}" kept - it could not be sent to your ${kind} right now (use Share again later).`);
    closeWaypointMenu();
  };
  const doRename = () => {
    if (!wp) return;
    renameWaypoint(wp.id, cleanWaypointName(input.value, wp.name));
    title.textContent = waypointById(wp.id)?.name ?? wp.name;
    say('Renamed.');
  };
  if (adding) {
    btn('Add', 'main', doAdd);
    btn('Cancel', '', closeWaypointMenu);
  } else {
    saveName.onclick = (e) => { e.preventDefault(); doRename(); };
    const follow = btn(isWaypointFollowed(wp.id) ? 'Unfollow' : 'Follow', '', () => {
      const on = !isWaypointFollowed(wp.id);
      setWaypointFollowed(wp.id, on);
      follow.textContent = on ? 'Unfollow' : 'Follow';
    });
    if (o.onTravel) btn('Travel here', 'main', () => { const w = waypointById(wp.id); closeWaypointMenu(); if (w) o.onTravel(w); });
    if (wp.mine && wp.kind !== 'personal') {
      btn('Share again', '', () => say(shareWaypoint(wp.id) ? `Sent to your ${wp.kind}.` : `Could not reach your ${wp.kind} right now.`));
    }
    btn('Remove', 'danger', () => { removeWaypoint(wp.id); closeWaypointMenu(); });
  }
  box.append(acts, note);
  function paint() {
    for (const [k, b] of Object.entries(kindBtns)) { b.className = k === kind ? 'wpm-kind on' : 'wpm-kind'; b.setAttribute('aria-pressed', k === kind ? 'true' : 'false'); }
    for (const [k, b] of Object.entries(swatches)) b.className = k === color ? 'wpm-swatch on' : 'wpm-swatch';
  }
  paint();
  // its own presses: never the map's, never the world's (the browser's own menu is the document's ONE guard's - ui/input.js
  // installContextMenuGuard, MAC-L3 - so the name keeps its paste menu, as every field does)
  const own = (e) => e.stopPropagation?.();
  for (const t of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'click', 'dblclick', 'wheel', 'touchstart']) box.addEventListener(t, own);
  doc.body.append(box);
  // placed at the pointer, kept on the screen
  const vw = win?.innerWidth ?? 800, vh = win?.innerHeight ?? 600;
  const r = box.getBoundingClientRect?.() ?? { width: MENU_W, height: 240 };
  const left = Math.max(8, Math.min(o.x + 6, vw - r.width - 8));
  const top = Math.max(8, Math.min(o.y + 6, vh - r.height - 8));
  box.style.left = `${Math.round(left)}px`;
  box.style.top = `${Math.round(top)}px`;
  // Escape closes, Enter answers - before the host's own keys (a capture listener on the window)
  const key = (e) => {
    const k = e.key ?? e.code ?? '';
    if (k === 'Escape' || e.code === 'Escape') {
      e.preventDefault?.(); e.stopImmediatePropagation?.(); e.stopPropagation?.();
      closeWaypointMenu();
      return;
    }
    if ((k === 'Enter' || e.code === 'NumpadEnter') && box.contains(e.target)) {
      e.preventDefault?.(); e.stopImmediatePropagation?.(); e.stopPropagation?.();
      if (adding) doAdd(); else if (e.target === input) doRename();
      else /** @type {any} */ (e.target)?.click?.();
    }
  };
  const away = (e) => { if (!box.contains(e.target)) closeWaypointMenu(); };
  win?.addEventListener?.('keydown', key, true);
  // the press that opened it is over; the next one outside lets it go
  win?.addEventListener?.('pointerdown', away, true);
  open = { el: box, win, key, away, onClose: o.onClose ?? null, owner: o.owner ?? null };
  try { input.focus({ preventScroll: true }); input.select(); } catch { /* a headless page */ }
  return true;
}
