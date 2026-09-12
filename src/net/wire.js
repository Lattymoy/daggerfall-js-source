// ONLINE1 (2026-09-12, Mac: "the basic bones of multiplayer ... being
// able to see and traverse with other players"): THE WIRE'S LAW, pure,
// ONE HOME (AUDIT ONLINE B7/B8). The relay (server/src/relay.js) re-exports
// this file and the session (net/online.js) imports it, so what the
// relay refuses the client never sends, what the relay may send the
// client checks the same way, and the world's bounds are one number.
// No I/O: test/online_relay.test.js executes it.
//
// THE WIRE. JSON text frames, one message each.
//   client -> room:  {t:'hello', id, name, look, pose}   once, first
//                    {t:'pose', p}                       POSE_HZ_MAX a second at most
//                    {t:'ping'}
//   room -> client:  {t:'welcome', id, peers:[{id,name,look,pose}]}
//                    {t:'join', id, name, look, pose}   {t:'leave', id}
//                    {t:'pose', id, p}                  {t:'pong'}
//                    {t:'error', m}                     then the socket closes
// A pose is {x, y, z, yaw, pitch, mv} in the room's frame - a world
// cell's in MapsFile world units (the streaming world's map-pixel
// origin, PIXEL_UNITS a pixel), every other room's in the scene's own -
// mv 1 when moving. A look is the paperdoll's recipe: race, gender,
// face, and the equipped items as the save writes them.
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
/** The largest frame the room reads; bigger ones close the socket. */
export const MAX_FRAME_BYTES = 16 * 1024;
/** The most equipped items a look may carry (DFU's equip table has 27 slots). */
export const MAX_LOOK_ITEMS = 27;
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
export const CLOSE_REPLACED = 4000;   // another socket said hello with this id
export const CLOSE_POLICY = 1008;     // a frame the relay refused; it said why in an error frame first

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

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
  return { x, y, z, yaw, pitch, mv: mv ? 1 : 0 };
}

/** A look the room will keep and repeat: the paperdoll's recipe, bounded. */
export function validLook(look) {
  if (!look || typeof look !== 'object') return null;
  const race = typeof look.race === 'string' ? look.race.slice(0, 16) : 'Breton';
  const gender = look.gender === 'female' ? 'female' : 'male';
  const faceIndex = finite(look.faceIndex) ? Math.max(0, Math.min(9, Math.floor(look.faceIndex))) : 0;
  const items = Array.isArray(look.items) ? look.items.slice(0, MAX_LOOK_ITEMS).filter((it) => it && typeof it === 'object') : [];
  return { race, gender, faceIndex, items };
}

/** The room's key from the request path: /room/<key>, or null. */
export function roomOf(pathname) {
  const m = /^\/room\/([A-Za-z0-9_.,:+-]{1,80})$/.exec(pathname);
  return m ? m[1] : null;
}

/** The streaming world's room for a MAP PIXEL (the client mints it; the relay only reads the key). */
export const worldRoom = (px, py) => `world:${Math.floor(px / WORLD_CELL)},${Math.floor(py / WORLD_CELL)}`;

/** A world-frame pose's cell coordinates - floor(x / PIXEL_UNITS),
 *  floor(z / PIXEL_UNITS). NOT the map pixel (the map's y runs the
 *  other way, 499 - this); distances between two of these equal map
 *  pixel distances, which is all inRange asks (AUDIT ONLINE B8). */
export const pixelOf = (p) => [Math.floor(p.x / PIXEL_UNITS), Math.floor(p.z / PIXEL_UNITS)];

/** Does a pose from `from` reach `to`? Inside a world cell, within
 *  RANGE_PIXELS by Chebyshev distance; in every other room, always. */
export function inRange(roomKey, from, to) {
  if (!String(roomKey ?? '').startsWith('world:')) return true;
  if (!from || !to) return false;
  const [ax, ay] = pixelOf(from), [bx, by] = pixelOf(to);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) <= RANGE_PIXELS;
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
    const id = typeof m.id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(m.id) ? m.id : null;
    if (!id) return { error: 'bad id' };
    const look = validLook(m.look);
    if (!look) return { error: 'bad look' };
    const pose = validPose(m.pose);
    return { t: 'hello', id, name: sanitizeName(m.name), look, pose };
  }
  if (m.t === 'pose') {
    if (!hasHello) return { error: 'pose before hello' };
    const p = validPose(m.p);
    return p ? { t: 'pose', p } : { error: 'bad pose' };
  }
  return { error: 'unknown message' };
}

/** The pose rate gate: a token bucket of POSE_HZ_MAX a second. Answers
 *  the bucket after the frame and whether the frame passes. */
export function poseGate(bucket, nowMs) {
  const b = bucket ?? { tokens: POSE_HZ_MAX, at: nowMs };
  const refill = ((nowMs - b.at) / 1000) * POSE_HZ_MAX;
  const tokens = Math.min(POSE_HZ_MAX, b.tokens + Math.max(0, refill));
  if (tokens < 1) return { bucket: { tokens, at: nowMs }, pass: false };
  return { bucket: { tokens: tokens - 1, at: nowMs }, pass: true };
}

/** What a joiner is told: everyone else in the room who has said hello. */
export function rosterFor(peers, meId) {
  const out = [];
  for (const p of peers) if (p && p.id && p.id !== meId) out.push({ id: p.id, name: p.name, look: p.look, pose: p.pose ?? null });
  return out;
}
