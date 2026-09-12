// ONLINE1 (2026-09-12, Mac: "the basic bones of multiplayer ... being
// able to see and traverse with other players"): THE WIRE'S LAW, pure,
// ONE HOME (AUDIT ONLINE B7/B8). The relay (server/src/relay.js) re-exports
// this file and the session (net/online.js) imports it, so what the
// relay refuses the client never sends, what the relay may send the
// client checks the same way, and the world's bounds are one number.
// No I/O: test/online_relay.test.js executes it.
//
// THE WIRE. JSON text frames, one message each.
//   client -> room:  {t:'hello', id, secret, name, look, pose}   once, first
//                    {t:'pose', p}                       POSE_HZ_MAX a second at most
//                    {t:'ping'}
//   room -> client:  {t:'welcome', id, peers:[{id,name,look,pose}]}
//                    {t:'join', id, name, look, pose}   {t:'leave', id}
//                    {t:'pose', id, p}                  {t:'pong'}
//                    {t:'error', m}                     then the socket closes
// A pose is {x, y, z, yaw, pitch, mv} in the room's frame - a world
// cell's in MapsFile world units (the streaming world's map-pixel
// origin, PIXEL_UNITS a pixel), every other room's in the scene's own -
// mv 1 when walking, 2 when running (the sender's own isRunning - AUDIT
// MWBODY B3: a speed guess sat under every walk). A look is the paperdoll's recipe: race, gender,
// face, and the equipped items projected onto the six fields the doll
// art reads (AUDIT ONLINE A12: nothing else travels, so a look is small
// by construction and never a stranger's junk rebroadcast).
//
// THE ID AND ITS SECRET (AUDIT ONLINE A3). Ids are public - every pose
// carries one - so a hello with an id the room already holds must
// carry the secret the first hello minted, or it is refused; a
// reconnect with the same id and secret replaces its old socket.
// Without this any client could kick and impersonate any peer.
//
// ROOMS. The client names the room in the path: /room/<key>. The
// streaming world is sharded into WORLD_CELL-pixel cells
// (world:<cx>,<cy>); a town, a dungeon and an interior are each a room
// by location. Inside a world cell a pose reaches only the peers within
// RANGE_PIXELS of the sender (interest management: a cell may hold
// many, a player sees the few around them); every other room is small
// and hears everything.

/** The streaming world's shard: a square of map pixels. */
export const WORLD_CELL = 16;
/** How far, in map pixels, a pose travels inside a world cell. */
export const RANGE_PIXELS = 3;
/** The most poses a client may send per second; the rest are dropped. */
export const POSE_HZ_MAX = 20;
/** The most hellos a ROOM admits per second (AUDIT ONLINE A6: a reconnect storm is 2N frames a cycle for everyone). */
export const HELLO_HZ_MAX = 10;
/** The most sockets one room holds; past it the upgrade is refused. */
export const SOCKETS_MAX = 256;
/** The most peers a welcome carries: the nearest, in a world cell (AUDIT ONLINE A5). */
export const ROSTER_MAX = 64;
/** Over-rate poses dropped in a row before the socket is closed (AUDIT ONLINE A8: ungated ingress is a bill). */
export const DROP_STRIKES_MAX = 200;
/** The largest frame the room reads (UTF-16 units); bigger ones close the socket. */
export const MAX_FRAME_BYTES = 16 * 1024;
/** The most equipped items a look may carry (DFU's equip table has 27 slots). */
export const MAX_LOOK_ITEMS = 27;
/** The fields of an equipped item the doll art reads - all a look carries per item. */
export const LOOK_ITEM_FIELDS = Object.freeze(['templateIndex', 'group', 'material', 'dye', 'variant', 'equipSlot']);
/** The item groups the doll art knows; anything else draws nothing and is dropped. */
export const LOOK_GROUPS = Object.freeze(['MensClothing', 'WomensClothing', 'Armor', 'Weapons', 'Jewellery']);
/** A display name's bounds. */
export const NAME_MAX = 24;
/** World units per map pixel in the frame the streaming world's poses
 *  travel in: MapsFile's (world/streamingWorld.js NATIVE_PIXEL). */
export const PIXEL_UNITS = 32768;
/** The map is 1000 x 500 pixels; a pose's x and z lie within this
 *  (AUDIT ONLINE B2/E2: the first bound, 1e7, refused most of the Bay
 *  - the classic start included - and the relay closed every mover). */
export const POSE_BOUND = 1024 * PIXEL_UNITS;
/** A pose's height bound, the scene's own units. */
export const POSE_Y_BOUND = 1e5;
/** The relay's close codes with a meaning of their own. */
export const CLOSE_REPLACED = 4000;   // another socket said hello with this id and its secret
export const CLOSE_POLICY = 1008;     // a frame the relay refused; it said why in an error frame first
export const CLOSE_BUSY = 1013;       // the room is full or its hello gate is shut: try again later

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const uint = (v, max) => (finite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : null);
const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** A name the room will show: printable ASCII, trimmed, bounded, never empty. */
export function sanitizeName(name) {
  let s = '';
  for (const ch of String(name ?? '')) { const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) s += ch; }
  s = s.trim().slice(0, NAME_MAX);
  return s || 'Traveller';
}

/** A pose the room will relay, or null. */
export function validPose(p) {
  if (!p || typeof p !== 'object') return null;
  const { x, y, z, yaw, pitch, mv } = p;
  if (![x, y, z, yaw, pitch].every(finite)) return null;
  if (Math.abs(x) > POSE_BOUND || Math.abs(z) > POSE_BOUND || Math.abs(y) > POSE_Y_BOUND) return null;
  return { x, y, z, yaw, pitch, mv: mv === 2 ? 2 : mv ? 1 : 0 };
}

/** One equipped item as the look carries it - the six fields, clamped - or null. */
export function validLookItem(it) {
  if (!it || typeof it !== 'object') return null;
  const templateIndex = uint(it.templateIndex, 65535), equipSlot = uint(it.equipSlot, 1e6);
  if (templateIndex == null || equipSlot == null || equipSlot >= MAX_LOOK_ITEMS || !LOOK_GROUPS.includes(it.group)) return null;   // a slot past the table is no item, not another slot's
  const out = { templateIndex, group: it.group, equipSlot };
  for (const k of ['material', 'dye', 'variant']) { const v = uint(it[k], 4095); if (v != null) out[k] = v; }
  return out;
}

/** A look the room will keep and repeat: the paperdoll's recipe, bounded and projected. */
export function validLook(look) {
  if (!look || typeof look !== 'object') return null;
  const race = typeof look.race === 'string' && /^[A-Za-z]{1,16}$/.test(look.race) ? look.race : 'Breton';
  const gender = look.gender === 'female' ? 'female' : 'male';
  const faceIndex = uint(look.faceIndex, 9) ?? 0;
  const items = Array.isArray(look.items) ? look.items.map(validLookItem).filter(Boolean).slice(0, MAX_LOOK_ITEMS) : [];
  return { race, gender, faceIndex, items };
}

/** The room's key from the request path: /room/<key>, or null. */
export function roomOf(pathname) {
  const m = /^\/room\/([A-Za-z0-9_.,:+-]{1,80})$/.exec(pathname);
  return m ? m[1] : null;
}

/** A relay the client may connect to: wss:// anywhere, ws:// on localhost only (AUDIT ONLINE A16/E11). */
export function relayUrl(url) {
  const s = String(url ?? '').trim().replace(/\/+$/, '');
  if (/^wss:\/\/[A-Za-z0-9.-]+(:\d+)?(\/[A-Za-z0-9._~/-]*)?$/.test(s)) return s;
  if (/^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[A-Za-z0-9._~/-]*)?$/.test(s)) return s;
  return null;
}

/** The streaming world's room for a MAP PIXEL (the client mints it; the relay only reads the key). */
export const worldRoom = (px, py) => `world:${Math.floor(px / WORLD_CELL)},${Math.floor(py / WORLD_CELL)}`;

/** A world-frame pose's cell coordinates - floor(x / PIXEL_UNITS),
 *  floor(z / PIXEL_UNITS). NOT the map pixel (the map's y runs the
 *  other way, 499 - this); distances between two of these equal map
 *  pixel distances, which is all inRange asks (AUDIT ONLINE B8). */
export const pixelOf = (p) => [Math.floor(p.x / PIXEL_UNITS), Math.floor(p.z / PIXEL_UNITS)];

/** The Chebyshev distance between two poses, in map pixels. */
export function pixelDistance(a, b) {
  const [ax, ay] = pixelOf(a), [bx, by] = pixelOf(b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Does a pose from `from` reach `to`? Inside a world cell, within
 *  RANGE_PIXELS by Chebyshev distance; in every other room, always. */
export function inRange(roomKey, from, to) {
  if (!String(roomKey ?? '').startsWith('world:')) return true;
  if (!from || !to) return false;
  return pixelDistance(from, to) <= RANGE_PIXELS;
}

/** One client frame, parsed and checked: {t:'hello'|'pose'|'ping', ...}
 *  or {error} - the caller closes on an error. */
export function parseClient(text, { hasHello = false } = {}) {
  if (typeof text !== 'string') return { error: 'text frames only' };
  if (text.length > MAX_FRAME_BYTES) return { error: 'frame too large' };
  let m;
  try { m = JSON.parse(text); } catch { return { error: 'not JSON' }; }
  if (!m || typeof m !== 'object') return { error: 'not an object' };
  if (m.t === 'ping') return { t: 'ping' };
  if (m.t === 'hello') {
    if (hasHello) return { error: 'hello twice' };
    const id = typeof m.id === 'string' && ID_RE.test(m.id) ? m.id : null;
    if (!id) return { error: 'bad id' };
    const secret = typeof m.secret === 'string' && SECRET_RE.test(m.secret) ? m.secret : null;
    if (!secret) return { error: 'bad secret' };
    const look = validLook(m.look);
    if (!look) return { error: 'bad look' };
    const pose = validPose(m.pose);
    return { t: 'hello', id, secret, name: sanitizeName(m.name), look, pose };
  }
  if (m.t === 'pose') {
    if (!hasHello) return { error: 'pose before hello' };
    const p = validPose(m.p);
    return p ? { t: 'pose', p } : { error: 'bad pose' };
  }
  return { error: 'unknown message' };
}

/** A token bucket of `rate` a second: the bucket after the frame and
 *  whether the frame passes. The pose gate and the hello gate ride it. */
export function tokenGate(bucket, nowMs, rate = POSE_HZ_MAX) {
  const b = bucket ?? { tokens: rate, at: nowMs };
  const refill = ((nowMs - b.at) / 1000) * rate;
  const tokens = Math.min(rate, b.tokens + Math.max(0, refill));
  if (tokens < 1) return { bucket: { tokens, at: nowMs }, pass: false };
  return { bucket: { tokens: tokens - 1, at: nowMs }, pass: true };
}

/** The pose rate gate: POSE_HZ_MAX a second. */
export const poseGate = (bucket, nowMs) => tokenGate(bucket, nowMs, POSE_HZ_MAX);

/** What a joiner is told: everyone else in the room who has said hello
 *  - the nearest ROSTER_MAX to `near` when there is a pose to measure
 *  from (a world cell), the first ROSTER_MAX otherwise. */
export function rosterFor(peers, meId, near = null) {
  const out = [];
  for (const p of peers) if (p && p.id && p.id !== meId) out.push({ id: p.id, name: p.name, look: p.look, pose: p.pose ?? null });
  if (near && out.length > ROSTER_MAX) out.sort((a, b) => (a.pose ? pixelDistance(near, a.pose) : Infinity) - (b.pose ? pixelDistance(near, b.pose) : Infinity));
  return out.slice(0, ROSTER_MAX);
}
