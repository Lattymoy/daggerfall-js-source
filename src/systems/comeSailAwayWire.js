// @ts-check
// COME SAIL AWAY - THE WIRE (CSA-J, 2026-09-28). The mod is single-player: a boat is a possession in its owner's save,
// placed and sailed on their client alone (systems/onlineLane.js ONLINE_PLAYERS_OWN_MODS). Online, the others in a
// cell should SEE it - the hull a sailor stands on, the boats they left at the shore - as Horse Cart and Cargo's team
// is seen (systems/horseCartWire.js, whose law this follows): `sa` on the owner's own foes frame, beside the camps'
// `c` and the team's `hv`, under the same owner law (an owner's word replaces that owner's and no one else's; an owner
// gone quiet takes theirs with them). The relay reads nothing inside a foes frame, so the word needs no relay change.
//
// The record is what the presentation shows, not the save: each active boat's hull, its variant, its root's place
// and turn (the wire frame's natives, as every cell object's), which of its sails stand raised, whether its owner is
// at its helm (the crew's two objects) and whether its lanterns are lit. Nothing of the cargo, the wind or the time
// scale rides, and the helm's way only as CSA-K says it (below) - a peer's boat is a thing to see, and to stand on
// once aboard it (scenes/comeSailAwayAboard.js), never to open or sail: its helm, cargo and variant are its owner's.
// Its bob, wake, oars, sounds and trim are not played for the others (the owner's own frame drives them; the wire
// carries the pose five times a second).
//
// CSA-K (SAIL-TOGETHER, 2026-09-28): A BOAT UNDER WAY SAYS ITS WAY. The pose rides five times a second, and a boat
// eased from word to word surges and stalls five times a second under whoever walks its deck. So the boat at the helm
// says, beside the record (`m`, a place for each of `b`'s), where it is going: its velocity on the water in the wire
// frame and its turn, each per second of the real clock (the owner's time scale in it). A reader leads the pose along
// them from the word's arrival (scenes/comeSailAwayPeers.js). A moored fleet says no `m` at all, so the record a
// reader of the older build reads - which knows `b` alone - is unchanged, and a new reader of an old record leads
// nothing.
//
// HOLDINGS (2026-10-03, Mac: "This also introduces the ability to change your ship name for others to see" -
// bible/03-World/Holdings.md): A NAMED BOAT SAYS HER NAME. `n`, beside `b` as `m` is - a name for each of `b`'s, '' for
// one her captain never named - and only while one of them has one, so an unnamed fleet's record is the older build's
// to the letter. A reader takes each name through the ledger's own law (systems/fleet.js shipNameVerdict: printable,
// SHIP_NAME_MAX, the name filter every player's name passes); a name it refuses reads as none. A bad `n` never drops the
// boats - a name is a thing to read, not a thing to stand on - and an older reader ignores the key.
import { POSE_BOUND, POSE_Y_BOUND } from '../net/wire.js';
import { HULL_NAMES, HULL_VARIANT_COUNTS } from './comeSailAwayBoat.js';
import { shipNameVerdict, SHIP_NAME_MAX } from './fleet.js';

/** The boats one word carries - a player's shore holds few, and a frame's size is the room's. */
export const CSA_WIRE_BOATS_MAX = 8;
/** The variants a boat can be (the mod's `variantNames`, I to X). */
export const CSA_WIRE_VARIANTS = 10;
/** The sails a hull's bits can name (the Carrack's are the most). */
export const CSA_WIRE_SAILS_MAX = 16;
/** CSA-K: a way and a turn past these are no boat's (natives a second, degrees a second) - AUDIT 2 XA6 (2026-10-06): the
 *  way sized from its real ceiling, SAIL-FREE's fastest (a Carrack on her quarter in the sea's strongest wind with her
 *  Rigging at its best, 43.6 m/s) at the Handling dials' tenfold and the world's fastest time scale (timeScale.js
 *  MAX_TIME_SCALE, a road journey's x100), in natives (SCENE_MAP_RATIO 40): 1.74M a second. It was 64k (that tenfold on
 *  HELM-WAY's fastest at the thirtyfold scale) - 27.3 m/s of way at an open journey's x60 - and every reader dropped a
 *  storm galleon's word whole, her boats gone from every screen and her passengers left on a frozen hull. The writer
 *  holds her word to both (csaWireRecord), so no honest word is dropped for its way. The turn: an oar's 20 degrees a
 *  second at that tenfold and x100 is 20,000. */
export const CSA_WIRE_SPEED_MAX = 2 * 1024 * 1024;
export const CSA_WIRE_TURN_MAX = 36000;
const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const finite3 = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const inBounds = (p) => Math.abs(p[0]) <= POSE_BOUND && Math.abs(p[2]) <= POSE_BOUND && Math.abs(p[1]) <= POSE_Y_BOUND;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/**
 * My word: the boats as they stand, in scene units - `[{ hull, variant, position, rotation, sails, helm, light,
 * velocity?, turn? }]` (sails a bit per raised sail in the boat's own order; CSA-K: the velocity in scene units and the
 * turn in degrees, each a real second's) - and `toWire` converting a scene point to the wire frame.
 * @returns {{ b: number[][], m?: number[][], u?: number[], n?: string[] } | null} null when none stands (the reader drops mine);
 *   `m` only while a boat is under way; `u` only while one carries her number; HOLDINGS: `n` only while one is named
 */
export function csaWireRecord(view, toWire = (p) => p) {
  if (!Array.isArray(view)) return null;
  const b = [], m = [], n = [], u = [];
  let underWay = false, named = false;
  for (const v of view) {
    if (b.length >= CSA_WIRE_BOATS_MAX) break;
    if (!v || !int(v.hull, 0, HULL_NAMES.length - 1) || !finite3(v.position) || !Array.isArray(v.rotation) || v.rotation.length !== 4) continue;
    const p = toWire(v.position);
    const q = v.rotation;
    b.push([v.hull, v.variant | 0, r2(p[0]), r2(p[1]), r2(p[2]), r4(q[0]), r4(q[1]), r4(q[2]), r4(q[3]), (v.sails | 0) & ((1 << CSA_WIRE_SAILS_MAX) - 1), v.helm ? 1 : 0, v.light ? 1 : 0]);
    // CSA-K: the way in the wire frame - the point a second on, converted, less the point (the frame is affine)
    const vel = finite3(v.velocity) ? v.velocity : null;
    const at = vel ? toWire([v.position[0] + vel[0], v.position[1] + vel[1], v.position[2] + vel[2]]) : p;
    const way = [r2(at[0] - p[0]), r2(at[2] - p[2]), Number.isFinite(v.turn) ? r2(v.turn) : 0];
    // AUDIT 2 XA6: held to the door's bounds, her way's bearing kept - a word past them every reader drops whole
    const sp = Math.hypot(way[0], way[1]);
    if (sp > CSA_WIRE_SPEED_MAX) { const k = (CSA_WIRE_SPEED_MAX * 0.999) / sp; way[0] = r2(way[0] * k); way[1] = r2(way[1] * k); }
    way[2] = Math.max(-CSA_WIRE_TURN_MAX, Math.min(CSA_WIRE_TURN_MAX, way[2]));
    if (way[0] || way[1] || way[2]) underWay = true;
    m.push(way);
    const name = typeof v.name === 'string' ? shipNameVerdict(v.name) : null;   // HOLDINGS: her name, as the ledger keeps it
    n.push(name?.ok ? name.name : '');
    if (name?.ok && name.name) named = true;
    u.push(Number.isSafeInteger(v.uid) && v.uid > 0 ? v.uid : 0);
  }
  if (!b.length) return null;
  return { b, ...(underWay ? { m } : {}), ...(u.some(Boolean) ? { u } : {}), ...(named ? { n } : {}) };   // HOLDINGS: `n` only while one is named
}

/**
 * A peer's word through the door: shape, a known hull and variant, bounds, a unit quaternion, the sail bits and two
 * flags. Anything else is null - the record is dropped whole.
 * @returns {{ boats: { hull:number, variant:number, position:number[], rotation:number[], sails:number, helm:boolean, light:boolean }[], cabin?:boolean } | null}
 */
export function validCsaRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.b)) return null;
  if ((raw.b.length < 1 && raw.cabin !== 1) || raw.b.length > CSA_WIRE_BOATS_MAX) return null;
  if (raw.u !== undefined && (!Array.isArray(raw.u) || raw.u.length !== raw.b.length || raw.u.some((u) => !Number.isSafeInteger(u) || u < 0) || new Set(raw.u.filter(Boolean)).size !== raw.u.filter(Boolean).length)) return null;
  // CSA-K: the way, when it is said, is a place for each boat - its two speeds and its turn, finite and a boat's
  const m = raw.m;
  if (m !== undefined) {
    if (!Array.isArray(m) || m.length !== raw.b.length) return null;
    for (const way of m) {
      if (!Array.isArray(way) || way.length !== 3 || !way.every(Number.isFinite)) return null;
      if (Math.hypot(way[0], way[1]) > CSA_WIRE_SPEED_MAX || Math.abs(way[2]) > CSA_WIRE_TURN_MAX) return null;
    }
  }
  const boats = [];
  for (const w of raw.b) {
    if (!Array.isArray(w) || w.length !== 12 || !w.every(Number.isFinite)) return null;
    if (!int(w[0], 0, HULL_NAMES.length - 1) || !int(w[1], 0, CSA_WIRE_VARIANTS - 1)) return null;
    if (HULL_VARIANT_COUNTS[w[0]] > 0 && w[1] >= HULL_VARIANT_COUNTS[w[0]]) return null;   // AUDIT PRE-MERGE 0928 O1: a hull with variants names one of its own - SpawnBoat throws on any other
    const p = [w[2], w[3], w[4]];
    if (!inBounds(p)) return null;
    const q = [w[5], w[6], w[7], w[8]];
    const len = Math.hypot(q[0], q[1], q[2], q[3]);
    if (!(len > 0.5 && len < 2)) return null;
    if (!int(w[9], 0, (1 << CSA_WIRE_SAILS_MAX) - 1)) return null;
    if ((w[10] !== 0 && w[10] !== 1) || (w[11] !== 0 && w[11] !== 1)) return null;
    const boat = { hull: w[0], variant: w[1], position: p, rotation: q.map((v) => v / len), sails: w[9], helm: w[10] === 1, light: w[11] === 1 };
    if (m !== undefined) { const way = m[boats.length]; boat.velocity = [way[0], 0, way[1]]; boat.turn = way[2]; }   // CSA-K
    const name = shipNameOf(raw.n, raw.b.length, boats.length);   // HOLDINGS: hers, where she has one - an unnamed boat's shape the older one
    if (name) boat.name = name;
    if (raw.u?.[boats.length]) boat.uid = raw.u[boats.length];
    boats.push(boat);
  }
  // A cabin keeps its owner's fleet on the exterior stream; only the player is below deck.
  if (raw.cabin !== undefined && raw.cabin !== 1) return null;
  if (raw.cabin === 1 && boats.some((b) => b.helm || b.velocity?.some((v) => v !== 0) || b.turn)) return null;
  return { boats, ...(raw.cabin === 1 ? { cabin: true } : {}) };
}
/** HOLDINGS: the name `n` gives the boat at `i` - read through the ledger's law (a name it refuses, '') - or '' for an `n`
 *  that is not a name for each boat. Never a reason to drop the record. */
function shipNameOf(n, count, i) {
  if (!Array.isArray(n) || n.length !== count) return '';
  const raw = n[i];
  if (typeof raw !== 'string' || raw.length > SHIP_NAME_MAX * 4) return '';
  const v = shipNameVerdict(raw);
  return v.ok ? v.name : '';
}

/** A change key, so a frame carries the record only when the word moved (the full frame always does). CSA-K: the way
 *  is in it, so a boat brought up short is said at once (its readers stop leading it). */
export const csaRecordKey = (rec) => (rec ? JSON.stringify(rec.u || rec.cabin || rec.n ? [rec.b, rec.m ?? null, rec.u ?? null, rec.cabin ?? null, rec.n ?? null] : rec.m ? [rec.b, rec.m] : rec.b) : '');   // HOLDINGS: a renamed boat is said at once
