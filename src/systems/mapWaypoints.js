// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WAYPOINTS (2026-10-06, the player: "Let players add waypoints, partywaypoints and guild waypoints to the overworld map
// and Worldmap(V) with right mouseclick context menu players should also be able to rename them. They can be small flags
// with different colors. Add the waypoints you want to mark (to follow) to the filter list on the overworld map with a
// dropdown menu. Add Waypoints to the filter on the worldmap").
//
// ONE STORE, BOTH MAPS. A waypoint is a point on the Iliac Bay in MAP PIXELS (floats - the held map's own unit,
// ui/inkMap.js toMap; the Overworld converts its native world point: mx = x / 32768, my = 500 - z / 32768, the inverse
// of MapsFile.MapPixelToWorldCoords plus the pixel's own span), a name, a flag colour and a KIND:
//   personal - mine alone, kept on this device
//   party    - said to my party on the hub's party channel, kept by every member who heard it
//   guild    - said to my guild on the hub's guild channel, the same way
// The Overworld (ui/travelViewHud.js) and the held map (ui/heldMap.js) both draw them as small flags, both take a
// right-click to add one or to rename, recolour, follow or remove one (ui/waypointMenu.js), and both read the same
// show-switches (one per kind). FOLLOWED waypoints are the ones the player picked from the Overworld's dropdown: those
// stay on the screen's edge with their distance wherever they are; the rest are drawn only where they lie in the view.
//
// THE WIRE. No relay change: a shared waypoint rides the hub's own party and guild chat channels (CHAT-CHAN, GUILD1c -
// net/online.js sendChat with `ch`) as one line of WP_WIRE_PREFIX. The host (scenes/world.js) hands this store its
// sender and gives every party or guild line to `receiveWaypointLine` before the chat log - a waypoint line is taken
// here and never shown. Only the AUTHOR's later lines move a shared waypoint (a rename, a colour, a removal - the line's
// sender id must be the one that made it); anyone may rename or drop one on their own screen alone. A member who
// joins later hears a waypoint when its author shares it again (the menu's "Share again").
// ═══════════════════════════════════════════════════════════════════
import { appStorage } from './appStorage.js';

export const WAYPOINT_KINDS = Object.freeze(['personal', 'party', 'guild']);
export const WAYPOINT_STORE_KEY = 'dfjs.waypoints';
export const WAYPOINT_SHOW_KEY = 'dfjs.waypoints.show';
/** The flags' colours, by id - bright enough on the parchment and on the land alike. */
export const WAYPOINT_COLORS = Object.freeze([
  Object.freeze({ id: 'red', css: '#e0473a', name: 'Red' }),
  Object.freeze({ id: 'orange', css: '#f08a2c', name: 'Orange' }),
  Object.freeze({ id: 'gold', css: '#f2cf4a', name: 'Gold' }),
  Object.freeze({ id: 'green', css: '#5cc464', name: 'Green' }),
  Object.freeze({ id: 'teal', css: '#3fc1b4', name: 'Teal' }),
  Object.freeze({ id: 'blue', css: '#4f8ff0', name: 'Blue' }),
  Object.freeze({ id: 'purple', css: '#b072e8', name: 'Purple' }),
  Object.freeze({ id: 'white', css: '#f1ece0', name: 'White' }),
]);
/** A kind's own default colour - a party's in the party green family, a guild's in the guild-mate violet. */
export const WAYPOINT_KIND_COLOR = Object.freeze({ personal: 'red', party: 'green', guild: 'purple' });
export const WAYPOINT_TEXT = Object.freeze({
  title: 'Waypoints',
  personal: 'Personal',
  party: 'Party',
  guild: 'Guild',
  defaultName: (n) => `Waypoint ${n}`,
  follow: 'Follow waypoint…',
  following: 'Following',
  none: 'No waypoints yet - right-click the map to add one',
  tip: (label, on) => `${on ? 'Hide' : 'Show'} ${label.toLowerCase()} waypoints on the maps`,
  kindWord: { personal: 'Personal waypoint', party: 'Party waypoint', guild: 'Guild waypoint' },
});
/** The most a name may hold, and the most waypoints of each kind kept. */
export const WAYPOINT_NAME_MAX = 32;
export const WAYPOINT_MAX_PER_KIND = 64;
/** The wire's word: a chat line that starts with it is a waypoint, never a line of chat. */
export const WP_WIRE_PREFIX = '[WP1]';
const MAP_W = 1000, MAP_H = 500;

/** The colour's CSS by id (an unknown id: the first). */
export const waypointCss = (id) => (WAYPOINT_COLORS.find((c) => c.id === id) ?? WAYPOINT_COLORS[0]).css;
/** A colour id, checked. */
const colorId = (id, kind = 'personal') => (WAYPOINT_COLORS.some((c) => c.id === id) ? id : WAYPOINT_KIND_COLOR[kind] ?? 'red');

/** A name, cleaned: one line, no control characters, bounded. */
export function cleanWaypointName(name, fallback = 'Waypoint') {
  const s = String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, WAYPOINT_NAME_MAX);
  return s || fallback;
}

/** A point on the bay, checked: map pixels inside the map. */
const onMap = (mx, my) => Number.isFinite(mx) && Number.isFinite(my) && mx >= 0 && my >= 0 && mx < MAP_W && my < MAP_H;

/** Native world units (DFU's, the streaming world's `worldCoords`) to map pixels, as floats. */
export const nativeToMapPoint = (x, z) => ({ mx: x / 32768, my: 500 - z / 32768 });
/** And back: map pixels to native world units. */
export const mapPointToNative = (mx, my) => ({ x: mx * 32768, z: (500 - my) * 32768 });

const newId = () => {
  const r = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36).slice(-5)}${r}`.replace(/[^a-z0-9]/g, '').slice(0, 12) || 'w';
};

/**
 * @typedef {{ id: string, kind: 'personal'|'party'|'guild', name: string, color: string, mx: number, my: number,
 *   mine: boolean, by: string, src: string|null, at: number, grp?: string|null }} Waypoint
 */

let state = null;   // { list: Waypoint[], follow: string[] }
let show = null;    // { personal, party, guild }
const listeners = new Set();
/** The host's sender: (ch: 'party'|'guild', text: string) => boolean. */
let sender = null;
/** GROUP-LEAVE: the party and the guild I stand in now, as the hub last said (undefined: not known yet). */
let groups = { party: undefined, guild: undefined };

function readState() {
  const st = { list: [], follow: [] };
  let raw = null;
  try { raw = appStorage()?.getItem(WAYPOINT_STORE_KEY) ?? null; } catch { raw = null; }
  if (!raw) return st;
  try {
    const v = JSON.parse(raw);
    for (const w of Array.isArray(v?.list) ? v.list : []) {
      const kind = WAYPOINT_KINDS.includes(w?.kind) ? w.kind : null;
      if (!kind || typeof w.id !== 'string' || !onMap(w.mx, w.my)) continue;
      st.list.push({ id: w.id.slice(0, 24), kind, name: cleanWaypointName(w.name), color: colorId(w.color, kind), mx: w.mx, my: w.my,
        mine: w.mine !== false, by: String(w.by ?? '').slice(0, 40), src: typeof w.src === 'string' ? w.src.slice(0, 64) : null, at: Number(w.at) || 0,
        grp: typeof w.grp === 'string' ? w.grp.slice(0, 64) : null });
    }
    for (const id of Array.isArray(v?.follow) ? v.follow : []) if (st.list.some((w) => w.id === id)) st.follow.push(id);
  } catch { /* a bad word: none */ }
  return st;
}
function store() {
  state ??= readState();
  return state;
}
function save(why = 'change') {
  try { appStorage()?.setItem(WAYPOINT_STORE_KEY, JSON.stringify(state)); } catch { /* held for the session */ }
  for (const fn of [...listeners]) { try { fn(why); } catch { /* a listener's own fault */ } }
}

/** Every waypoint, newest last. */
export function listWaypoints() { return store().list; }
/** One waypoint by id, or null. */
export const waypointById = (id) => store().list.find((w) => w.id === id) ?? null;
/** The ids the player follows, in the order they were followed. */
export function followedWaypointIds() { return store().follow; }
export const isWaypointFollowed = (id) => store().follow.includes(id);

/** Hear any change (a waypoint added, moved, a switch, a follow); returns the way to stop. */
export function onWaypoints(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── THE SHOW-SWITCHES (one per kind, both maps) ─────────────────────
function readShow() {
  const s = { personal: true, party: true, guild: true };
  let raw = null;
  try { raw = appStorage()?.getItem(WAYPOINT_SHOW_KEY) ?? null; } catch { raw = null; }
  if (raw) {
    try { const v = JSON.parse(raw); for (const k of WAYPOINT_KINDS) if (typeof v?.[k] === 'boolean') s[k] = v[k]; } catch { /* the defaults */ }
  }
  return s;
}
/** The switches now: { personal, party, guild }. */
export function waypointKindsShown() {
  show ??= readShow();
  return show;
}
/** Flip one kind's switch; returns its new state. */
export function toggleWaypointKind(kind) {
  if (!WAYPOINT_KINDS.includes(kind)) return false;
  const cur = waypointKindsShown();
  show = { ...cur, [kind]: !cur[kind] };
  try { appStorage()?.setItem(WAYPOINT_SHOW_KEY, JSON.stringify(show)); } catch { /* held for the session */ }
  for (const fn of [...listeners]) { try { fn('show'); } catch { /* a listener's own fault */ } }
  return show[kind];
}
/** The waypoints the switches let the maps draw (a followed one always - the player asked for it). */
export function shownWaypoints() {
  const s = waypointKindsShown(), st = store();
  return st.list.filter((w) => s[w.kind] !== false || st.follow.includes(w.id));
}

// ── THE EDITS ───────────────────────────────────────────────────────
/** The next default name ("Waypoint 3"). */
export function nextWaypointName() {
  const used = new Set(store().list.map((w) => w.name));
  for (let n = 1; n < 1000; n++) { const s = WAYPOINT_TEXT.defaultName(n); if (!used.has(s)) return s; }
  return 'Waypoint';
}

/**
 * Add a waypoint of mine. A party's or a guild's is said on its channel at once (`shared` in the answer says whether
 * it went - no hub, no party, a relay before the channel). Null for a point off the map.
 * @param {{ kind?: string, mx: number, my: number, name?: string, color?: string, by?: string }} w
 * @returns {{ waypoint: Waypoint, shared: boolean|null } | null}
 */
export function addWaypoint({ kind = 'personal', mx, my, name, color, by = '' }) {
  if (!onMap(mx, my)) return null;
  const k = WAYPOINT_KINDS.includes(kind) ? /** @type {Waypoint['kind']} */ (kind) : 'personal';
  const st = store();
  const own = st.list.filter((w) => w.kind === k && w.mine);
  if (own.length >= WAYPOINT_MAX_PER_KIND) removeWaypoint(own[0].id, { quiet: true });
  /** @type {Waypoint} */
  const wp = { id: newId(), kind: k, name: cleanWaypointName(name, nextWaypointName()), color: colorId(color, k), mx, my, mine: true, by: String(by).slice(0, 40), src: null, at: Date.now(), grp: groupOf(k) };
  st.list.push(wp);
  save('add');
  const shared = k === 'personal' ? null : shareWaypoint(wp.id);
  return { waypoint: wp, shared };
}

/** Rename one. Mine and shared: the channel hears it; another's: my screen alone. */
export function renameWaypoint(id, name) {
  const w = waypointById(id);
  if (!w) return false;
  const n = cleanWaypointName(name, w.name);
  if (n === w.name) return true;
  w.name = n;
  save('rename');
  if (w.mine && w.kind !== 'personal') say(w.kind, ['ren', w.id, n]);
  return true;
}

/** Recolour one - the same law as a rename. */
export function recolorWaypoint(id, color) {
  const w = waypointById(id);
  if (!w) return false;
  const c = colorId(color, w.kind);
  if (c === w.color) return true;
  w.color = c;
  save('color');
  if (w.mine && w.kind !== 'personal') say(w.kind, ['col', w.id, c]);
  return true;
}

/** Remove one. Mine and shared: the channel hears it gone; another's: gone from my screen alone. */
export function removeWaypoint(id, { quiet = false } = {}) {
  const st = store();
  const i = st.list.findIndex((w) => w.id === id);
  if (i < 0) return false;
  const [w] = st.list.splice(i, 1);
  st.follow = st.follow.filter((f) => f !== id);
  save('remove');
  if (!quiet && w.mine && w.kind !== 'personal') say(w.kind, ['del', w.id]);
  return true;
}

/** Follow one (it joins the Overworld's list and stays at the screen's edge), or stop following it. */
export function setWaypointFollowed(id, on) {
  const st = store();
  if (!st.list.some((w) => w.id === id)) return false;
  const has = st.follow.includes(id);
  if (on && !has) st.follow = [...st.follow, id];
  else if (!on && has) st.follow = st.follow.filter((f) => f !== id);
  else return true;
  save('follow');
  return true;
}

// ── THE WIRE ────────────────────────────────────────────────────────
/** The host's sender, or null (offline, the chat gone). `(ch, text) => boolean`. */
export function setWaypointSender(fn) { sender = typeof fn === 'function' ? fn : null; }
/** Whether a shared waypoint can be said now. */
export const waypointSharingLive = () => !!sender;

const num = (v) => (Math.round(v * 1000) / 1000).toString();
/** A wire line's words, joined; the name last (it may hold spaces). */
export function encodeWaypointLine(words) { return `${WP_WIRE_PREFIX} ${words.join(' ')}`; }
function say(kind, words) {
  if (!sender || (kind !== 'party' && kind !== 'guild')) return false;
  try { return !!sender(kind, encodeWaypointLine(words)); } catch { return false; }
}

/** Say one of mine on its channel again (a member who joined since hears it). */
export function shareWaypoint(id) {
  const w = waypointById(id);
  if (!w || !w.mine || w.kind === 'personal') return false;
  return say(w.kind, ['add', w.id, num(w.mx), num(w.my), w.color, w.name]);
}

/**
 * A wire line's meaning, or null for a line that is not a waypoint's (or is a broken one).
 * @param {string} text
 * @returns {{ op: 'add', id: string, mx: number, my: number, color: string, name: string }
 *   | { op: 'ren', id: string, name: string } | { op: 'col', id: string, color: string } | { op: 'del', id: string } | null}
 */
export function decodeWaypointLine(text) {
  const s = String(text ?? '');
  if (!s.startsWith(`${WP_WIRE_PREFIX} `)) return null;
  const w = s.slice(WP_WIRE_PREFIX.length + 1).split(' ');
  const op = w[0], id = w[1];
  if (!id || !/^[a-z0-9]{1,24}$/.test(id)) return null;
  if (op === 'add') {
    const mx = Number(w[2]), my = Number(w[3]);
    if (!onMap(mx, my)) return null;
    return { op, id, mx, my, color: colorId(w[4]), name: cleanWaypointName(w.slice(5).join(' ')) };
  }
  if (op === 'ren') return { op, id, name: cleanWaypointName(w.slice(2).join(' ')) };
  if (op === 'col') return { op, id, color: colorId(w[2]) };
  if (op === 'del') return { op, id };
  return null;
}

/** Whether a chat line is a waypoint's - the chat log never shows one. */
export const isWaypointLine = (text) => typeof text === 'string' && text.startsWith(`${WP_WIRE_PREFIX} `);

/**
 * A party or guild line in from the hub. True when it was a waypoint's (taken here, never shown as chat) - mine
 * included (the relay says my own line back to me; I applied it when I made it).
 * @param {{ ch?: string, text?: string, id?: string, name?: string, mine?: boolean }} line
 */
export function receiveWaypointLine(line) {
  if (!line || !isWaypointLine(line.text)) return false;
  if (line.mine) return true;
  const kind = line.ch === 'party' || line.ch === 'guild' ? line.ch : null;
  const d = decodeWaypointLine(line.text);
  if (!kind || !d) return true;
  const src = String(line.id ?? '').slice(0, 64) || null;
  const st = store();
  const key = (w) => w.kind === kind && !w.mine && w.id === d.id;
  const have = st.list.find(key);
  if (d.op === 'add') {
    if (have) {
      if (have.src && src && have.src !== src) return true;   // another's word on a waypoint they did not make
      have.mx = d.mx; have.my = d.my; have.color = d.color; have.name = d.name; have.by = String(line.name ?? have.by).slice(0, 40);
    } else {
      const theirs = st.list.filter((w) => w.kind === kind && !w.mine);
      if (theirs.length >= WAYPOINT_MAX_PER_KIND * 2) st.list.splice(st.list.indexOf(theirs[0]), 1);
      st.list.push({ id: d.id, kind, name: d.name, color: d.color, mx: d.mx, my: d.my, mine: false, by: String(line.name ?? '').slice(0, 40), src, at: Date.now(), grp: groupOf(kind) });
    }
    save('wire');
    return true;
  }
  if (!have || (have.src && src && have.src !== src)) return true;   // only its author moves a shared waypoint
  if (d.op === 'ren') have.name = d.name;
  else if (d.op === 'col') have.color = d.color;
  else if (d.op === 'del') { st.list.splice(st.list.indexOf(have), 1); st.follow = st.follow.filter((f) => f !== have.id); }
  save('wire');
  return true;
}

// ── GROUP-LEAVE (2026-10-06, the player: "i hope the waypoints are removed when leaving party") ──
/** The group a new waypoint of this kind belongs to - the party's id, the guild's tag - or null. */
const groupOf = (kind) => (kind === 'party' || kind === 'guild' ? (groups[kind] ?? null) : null);

/**
 * The host's word on the party and the guild I stand in NOW (`party` the party's id or null, `guild` the guild's tag or
 * null) - said only while the hub is open, so a dropped connection never reads as a leave. Every party waypoint of
 * another party (or of none, when I left) goes, mine and theirs alike; the same for the guild's. A waypoint kept from
 * before groups were told takes the group it is first seen in. Answers how many went.
 * @param {{ party?: string|null, guild?: string|null }} now
 */
export function syncWaypointGroups(now) {
  const st = store();
  let gone = 0, moved = false;
  for (const kind of /** @type {const} */ (['party', 'guild'])) {
    if (!(kind in now)) continue;
    const g = now[kind] == null ? null : String(now[kind]).slice(0, 64);
    if (groups[kind] === g) continue;
    groups[kind] = g;
    for (let i = st.list.length - 1; i >= 0; i--) {
      const w = st.list[i];
      if (w.kind !== kind) continue;
      if (w.grp == null && g != null) { w.grp = g; moved = true; continue; }   // kept from before: adopted
      if (w.grp !== g) { st.list.splice(i, 1); st.follow = st.follow.filter((f) => f !== w.id); gone++; }
    }
  }
  if (gone || moved) save('groups');
  return gone;
}

/** Pins: back to the device's word. */
export function _resetWaypoints() { state = null; show = null; sender = null; groups = { party: undefined, guild: undefined }; listeners.clear(); }
