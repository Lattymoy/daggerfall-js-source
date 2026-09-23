// @ts-check
// HORSE CART AND CARGO - THE WIRE (HCC-ONLINE, 2026-09-23, Mac: "...and also enhance its online integration
// functionality"). The mod is single-player: its wagon and its horse are objects in one Unity scene. Online, a
// player's parked wagon, waiting horse, following horse and trailing team stand in a shared cell, so everyone
// near should see them and the plaque should name whose they are. This is the record that says them - `hv` on
// the cell's foes frame, beside the camps' `c` (scenes/camps.js), under the same owner law (an owner's word
// replaces that owner's and no one else's; an owner gone quiet takes theirs with them). Nothing of the wagon's
// STORAGE rides: a player's items are their own client's, and a peer's wagon is a thing to see and walk around,
// not to open.
//
// AN OWNER'S WORD NEEDS ITS OWNER (AUDIT HCC O10, recorded, not a defect of this record): the word rides the
// owner's own foes frame, so a team stands for the others while its owner is in the cell room to say it. An owner
// who goes indoors (every door is a room of its own - WORLD6a), travels, dies or leaves takes it with them, as their
// camps and their foes go (the sweep, clearPuppets). A parked wagon that outlived its owner's presence would be a
// cell's own MEMORY on the relay, which cell rooms do not keep; the Enabled note says what this law shows.
//
// The record is what the presentation shows, not the save: the WAGON shown (kind, base position, rotation as
// Unity spells it, cargo tier, wheel angle) and the HORSE shown (base position, horizontal forward, walking), plus
// the horse's name. The walk FRAME does not ride (AUDIT HCC O5): the stride is the reader's own
// HorseWalkAnimationState over the pace it shows - a frame on the wire turned a standing horse's idle flicker into
// a word twice a second, forever, to everyone in range. The NAME rides through the wire's label door
// (sanitizeLabel: printable ASCII, the name filter - AUDIT HCC O4), as a player's name and a party's place do. Positions are in the wire frame (natives, the compensation-free height) as
// every cell object's are; a reader converts at landing and every frame after (the floating origin, AUDIT
// ONLINE D5). The orientation the horse billboard shows is the READER's camera's, computed there
// (horseCartLaw calculateHorseOrientation) - a sprite faces whoever looks at it.
import { POSE_BOUND, POSE_Y_BOUND, sanitizeLabel } from '../net/wire.js';
import { HORSE_NAME_MAX, CARGO_TIERS } from './horseCartLaw.js';

/** What the wagon shown is: the team's trailing wagon behind the cart, the parked wagon, the following team's. */
export const HCC_WIRE_KIND = Object.freeze({ Trailing: 1, Deployed: 2, Following: 3 });
const KINDS = new Set(Object.values(HCC_WIRE_KIND));
const TIERS = new Set([0, ...CARGO_TIERS]);
const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const finite3 = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const inBounds = (p) => Math.abs(p[0]) <= POSE_BOUND && Math.abs(p[2]) <= POSE_BOUND && Math.abs(p[1]) <= POSE_Y_BOUND;

/**
 * My word: the pool's view of the runtime as the wire says it. `view` is scenes/horseCartPool.js's
 * `shown()` - `{ wagon: { kind, position, rotation, tier, angle } | null, horse: { position, forward, walking } | null,
 * name }` in scene units; `toWire` converts a scene point to the wire frame.
 * @returns {{ w?: number[], h?: number[], n?: string } | null} null when nothing stands (the reader drops mine)
 */
export function hccWireRecord(view, toWire = (p) => p) {
  if (!view) return null;
  const out = {};
  const w = view.wagon;
  if (w && finite3(w.position) && Array.isArray(w.rotation) && w.rotation.length === 4) {
    const p = toWire(w.position);
    out.w = [w.kind | 0, r2(p[0]), r2(p[1]), r2(p[2]), r4(w.rotation[0]), r4(w.rotation[1]), r4(w.rotation[2]), r4(w.rotation[3]), w.tier | 0, r2(w.angle ?? 0)];
  }
  const h = view.horse;
  if (h && finite3(h.position) && finite3(h.forward)) {
    const p = toWire(h.position);
    out.h = [r2(p[0]), r2(p[1]), r2(p[2]), r4(h.forward[0]), r4(h.forward[2]), h.walking ? 1 : 0];
  }
  const n = hccHorseNameOnWire(view.name);
  if (n && out.h) out.n = n;
  return out.w || out.h ? out : null;
}

/** The horse's name as the wire carries it: the label door at the mod's 31 (NormalizeHorseName's bound); '' when
 *  nothing printable is left or the filter refuses it - the horse is then named by the mod's own "Horse". */
export const hccHorseNameOnWire = (name) => (typeof name === 'string' ? sanitizeLabel(name, HORSE_NAME_MAX) : '');

/** A peer's word through the door: shape, bounds, a unit quaternion, a known kind, a known tier, a walking bit.
 *  Anything else is null - the record is dropped whole. The name alone is cleaned rather than refused: a name
 *  the label door will not carry leaves the horse unnamed, not unseen. */
export function validHccRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  if (raw.w !== undefined) {
    const w = raw.w;
    if (!Array.isArray(w) || w.length !== 10 || !w.every(Number.isFinite)) return null;
    if (!KINDS.has(w[0])) return null;
    const p = [w[1], w[2], w[3]];
    if (!inBounds(p)) return null;
    const q = [w[4], w[5], w[6], w[7]];
    const len = Math.hypot(q[0], q[1], q[2], q[3]);
    if (!(len > 0.5 && len < 2)) return null;
    if (!TIERS.has(w[8])) return null;
    out.w = { kind: w[0], position: p, rotation: q.map((v) => v / len), tier: w[8], angle: ((w[9] % 360) + 360) % 360 };
  }
  if (raw.h !== undefined) {
    const h = raw.h;
    if (!Array.isArray(h) || h.length !== 6 || !h.every(Number.isFinite)) return null;
    const p = [h[0], h[1], h[2]];
    if (!inBounds(p)) return null;
    const fl = Math.hypot(h[3], h[4]);
    if (!(fl > 1e-6)) return null;
    if (h[5] !== 0 && h[5] !== 1) return null;
    out.h = { position: p, forward: [h[3] / fl, 0, h[4] / fl], walking: h[5] === 1 };
  }
  if (raw.n !== undefined) {
    if (typeof raw.n !== 'string' || raw.n.length > HORSE_NAME_MAX * 4) return null;
    out.n = hccHorseNameOnWire(raw.n);
  }
  if (!out.w && !out.h) return null;
  return out;
}

/** A change key, so a frame carries the record only when the word moved (the full frame always does). */
export function hccRecordKey(rec) {
  if (!rec) return '';
  return JSON.stringify([rec.w ?? 0, rec.h ?? 0, rec.n ?? '']);
}

/** The snap-or-ease a reader shows between two words: a step past `snap` metres is a teleport (the owner
 *  crossed a pixel, summoned, or fast-travelled), anything nearer eases at `rate` per second. Pure. */
export function easeToward(shown, target, dt, rate = 12, snap = 20) {
  if (!shown) return [...target];
  const dx = target[0] - shown[0], dy = target[1] - shown[1], dz = target[2] - shown[2];
  if (dx * dx + dy * dy + dz * dz > snap * snap) return [...target];
  const t = 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt));
  return [shown[0] + dx * t, shown[1] + dy * t, shown[2] + dz * t];
}
