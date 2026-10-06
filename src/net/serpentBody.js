// @ts-check
// SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"): THE SERPENT'S BODY AS LAW - where every part of
// Sethrakul is at a moment of the relay's clock, how high it rides the sea, and which of it a ball can strike. The relay's
// brain (net/serpentBrain.js) judges a blow by it; the client draws it, aims at it and builds its hit boxes by it - one
// law, both ends, so a ball that strikes a coil on one screen strikes the coil the relay sees. Design:
// bible/11-Multiplayer/Sea-Serpent.md section 4.
//
// THE FRAME. Metres in the site's frame: the site (systems/serpentSite.js - a point on a packet lane) at the origin,
// x east and z north (the native frame's axes, SERPENT_NATIVE_PER_M to the metre), y up from the sea's top. A facing is
// `atan2(dx, dz)` - 0 looks north.
//
// THE HEAD SWIMS A PATH OF LEGS; THE BODY FOLLOWS IT. A leg is a straight run or a circular arc at a constant speed,
// begun at a moment from where the last one left the head (the brain only ever starts a leg from the head's own place
// and heading - so the path is smooth, never a jump or a kink). The body is the path itself: the point `s` metres behind
// the head is the head's own track walked back `s` metres (spinePoint) - so the body of a serpent turning traces the
// turn its head swam, as a snake's does, and every client draws the same body from the same few legs, a late joiner's
// too. Past the oldest leg kept, the track runs straight back along that leg's first heading.
//
// THE BODY RIDES THE SEA BY ITS MODE. A mode is how it holds itself (MODE): sounded under, cruising (the coils arching
// out of the sea in humps that roll down its length), breaching (the head and neck thrown up), reared (the head high
// over the waves), coiled about a ship, dying. A change of mode is eased over MODE_BLEND_MS; a coil takes over the whole
// body from the path's (coilPoint), eased in and out over COIL_BLEND_MS.
//
// WHAT A BALL MAY STRIKE: a segment above the sea (exposed) - its box (segmentBox) is the shots' target, and the relay
// refuses a blow while nothing of it is above the water (anyExposed). The head is the weak place while it is thrown up
// (headExposed): a breach, a rear, a coil, a stun.
//
// PURE: numbers in, points out - the relay, the client and the pins alike. Not a DFU member. Ledger A (SERPENT1).

/** The body: SEG_N segments of SEG_LEN metres - 168 m, three carracks end to end and more. */
export const SEG_N = 24;
export const SEG_LEN = 7;
export const BODY_LEN = SEG_N * SEG_LEN;
/** The head's length (the jaws to the back of the skull), metres - segment 0 is the head. */
export const HEAD_LEN = 9;
/** Its girth along its length: [s metres behind the snout, radius metres] - the jaws, the skull, a neck, the great
 *  coils a third of the way down, the taper to the tail. */
export const RADII = Object.freeze([[0, 2.2], [4, 3.4], [9, 3.0], [14, 2.9], [40, 3.9], [90, 3.4], [140, 1.9], [BODY_LEN, 0.7]].map((p) => Object.freeze(p)));
/** The radius `s` metres behind the snout. */
export function radiusAt(s) {
  if (!(s > 0)) return RADII[0][1];
  for (let i = 1; i < RADII.length; i++) {
    const [s1, r1] = RADII[i];
    if (s <= s1) { const [s0, r0] = RADII[i - 1]; return r0 + ((r1 - r0) * (s - s0)) / (s1 - s0); }
  }
  return RADII[RADII.length - 1][1];
}

// ── the path ───────────────────────────────────────────────────────────
/** A leg's kind: a straight run, or an arc turning `sd` (+1 to the right - clockwise from above - or -1). */
export const LEG = Object.freeze({ line: 0, arc: 1 });
/** The slowest a leg swims, m/s - a body that stops has no track to lie along. */
export const SWIM_MIN_V = 2;
/** The legs kept: enough of the track to lay the whole body along, and a few to spare. */
export const LEGS_KEPT = 12;

/**
 * A leg: `{k, at, x, z, yw, v, r?, sd?, j?}` - its kind, when it began (relay ms), where the head was then and its
 * heading, its speed (m/s), for an arc its radius (m) and its turn, and `j` 1 for a JUMP - the head placed there under
 * the sea rather than swum there (a breach rising under a ship, the coil, the maelstrom's orbit): the body never lies
 * back past a jump, but straight back along its first heading.
 * @typedef {{k: number, at: number, x: number, z: number, yw: number, v: number, r?: number, sd?: number, j?: number}} Leg
 */

/** The head on leg `L` at `t` (never before the leg began): `{x, z, yw}`. */
export function legAt(L, t) {
  const dt = Math.max(0, t - L.at) / 1000, v = Math.max(SWIM_MIN_V, L.v);
  if (L.k === LEG.arc && L.r > 0) {
    const sd = L.sd < 0 ? -1 : 1, yw = L.yw + (sd * v * dt) / L.r;
    // the centre stands r to the turn's side of the start: right of a heading yw is (cos yw, -sin yw)
    const cx = L.x + sd * L.r * Math.cos(L.yw), cz = L.z - sd * L.r * Math.sin(L.yw);
    return { x: cx - sd * L.r * Math.cos(yw), z: cz + sd * L.r * Math.sin(yw), yw };
  }
  return { x: L.x + Math.sin(L.yw) * v * dt, z: L.z + Math.cos(L.yw) * v * dt, yw: L.yw };
}
/**
 * AUDIT SERPENT S2: THE TIMELINE'S ONE RULE - a leg or a mode said at `at` supersedes every one still to come after it
 * (taken off `list`, in place). The relay applies it as it pushes (serpentBrain.js pushLeg, pushMode) and every client
 * as it folds the word (net/serpentLink.js), so both hold one track in time order and draw one body - where a word said
 * now beside one still to come (a surfacing on its way, a turn mid-breach) parted them by hundreds of metres.
 */
export function supersede(list, at) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].at > at) list.splice(i, 1);
  return list;
}
/** Two legs alike in every number the wire carries. */
export const sameLeg = (a, b) => a.at === b.at && a.k === b.k && a.x === b.x && a.z === b.z && a.yw === b.yw && a.v === b.v && (a.r ?? 0) === (b.r ?? 0) && (a.sd ?? 0) === (b.sd ?? 0) && !!a.j === !!b.j;
/** A mode already ridden by `b`'s moment (`a` is the track's last, so begun by then). */
export const sameMode = (a, b) => a.m === b.m && a.at <= b.at;
/**
 * AUDIT SERPENT 2 F2: A WORD ON THE TIMELINE, the relay's (serpentBrain.js pushLeg, pushMode) and every client's
 * (net/serpentLink.js) alike: the one rule applied (supersede), then `entry` kept unless the track already ends on it
 * (`same`). The client used to ask whether it held the word BEFORE superseding, and the relay kept a second 'deep now'
 * after dropping a surfacing still to come: every client took that word for one it had and kept the surfacing the
 * relay had dropped - its serpent drawn up and struck at for seconds while the relay held it under. Answers whether the
 * track changed.
 */
export function onTimeline(list, entry, same) {
  const had = list.length;
  supersede(list, entry.at);
  const last = list[list.length - 1];
  if (last && same(last, entry)) return list.length !== had;
  list.push(entry);
  return true;
}
/** The leg swum at `t` (the last begun by then), its index, or -1 before the first. */
export function legIndexAt(legs, t) {
  for (let i = legs.length - 1; i >= 0; i--) if (legs[i].at <= t) return i;
  return -1;
}
/** The head at `t`: `{x, z, yw}` (the first leg's start before it). */
export function headAt(legs, t) {
  if (!legs?.length) return { x: 0, z: 0, yw: 0 };
  const i = legIndexAt(legs, t);
  return i < 0 ? { x: legs[0].x, z: legs[0].z, yw: legs[0].yw } : legAt(legs[i], t);
}
/**
 * THE TRACK WALKED BACK: the point `s` metres behind the head at `t`, `{x, z, yw}` (yw the way the body there faces).
 * Each leg's own speed is its metres a second, so a fast run and a slow turn lay their own lengths - and the body is
 * never stretched or squeezed by a change of pace.
 * @param {ReadonlyArray<Leg>} legs @param {number} t @param {number} s
 */
export function spinePoint(legs, t, s) {
  if (!legs?.length) return { x: 0, z: -s, yw: 0 };
  let i = legIndexAt(legs, t);
  if (i < 0) { const L = legs[0]; return { x: L.x - Math.sin(L.yw) * s, z: L.z - Math.cos(L.yw) * s, yw: L.yw }; }
  let end = t, left = Math.max(0, s), L0 = legs[0];
  for (; i >= 0; i--) {
    const L = legs[i], v = Math.max(SWIM_MIN_V, L.v);
    const run = (v * Math.max(0, end - L.at)) / 1000;
    if (left <= run) return legAt(L, end - (left / v) * 1000);
    left -= run;
    end = L.at;
    L0 = L;
    if (L.j) break;   // A JUMP: the head was placed there under the sea - the body never reaches back past it
  }
  return { x: L0.x - Math.sin(L0.yw) * left, z: L0.z - Math.cos(L0.yw) * left, yw: L0.yw };
}
/**
 * A NEW LEG from where the head is at `t` (and its heading there) - the only way the brain begins one, so the track is
 * smooth. `k` the kind; an arc's radius and turn. Pure; the legs are not touched.
 */
export function legFrom(legs, t, k, v, r = 0, sd = 1) {
  const h = headAt(legs, t);
  return k === LEG.arc ? { k, at: t, x: h.x, z: h.z, yw: h.yw, v, r, sd: sd < 0 ? -1 : 1 } : { k: LEG.line, at: t, x: h.x, z: h.z, yw: h.yw, v };
}
/** A leg's heading at its end `t` - where a turn has brought the head. */
export const yawAt = (L, t) => legAt(L, t).yw;

// ── how it rides the sea ───────────────────────────────────────────────
/** The ways it holds itself. */
export const MODE = Object.freeze({ deep: 0, cruise: 1, breach: 2, rear: 3, coil: 4, dying: 5 });
export const MODE_NAMES = Object.freeze(['deep', 'cruise', 'breach', 'rear', 'coil', 'dying']);
/** A change of mode is eased over this long, ms. */
export const MODE_BLEND_MS = 1500;
/** Sounded, the whole of it this far under (m). */
export const DEEP_Y = -12;
/** The humps: their length along the body (m), how fast they roll down it (rad/s), how high their crowns stand (m) and
 *  how far under their troughs lie. */
export const HUMP_L = 46;
export const HUMP_W = 1.25;
export const HUMP_TOP = 3.2;
export const HUMP_UNDER = -3.4;
/** A breach throws the head this high (m), falling away along the neck over BREACH_FALL metres; a rear holds it
 *  REAR_Y high over REAR_FALL. */
export const BREACH_Y = 12;
export const BREACH_FALL = 26;
export const REAR_Y = 14;   // AUDIT SERPENT T4: at 24 m the reared head stood over every broadside's arc (long guns 17.6 m at their highest)
export const REAR_FALL = 30;
/** The head skims at the sea's top while it cruises. */
export const CRUISE_HEAD_Y = 0.8;

const smooth = (k) => { const x = Math.max(0, Math.min(1, k)); return x * x * (3 - 2 * x); };
/** The hump's height `s` behind the snout at `t` (ms). */
const hump = (s, t) => HUMP_UNDER + (HUMP_TOP - HUMP_UNDER) * Math.max(0, Math.sin((2 * Math.PI * s) / HUMP_L - (HUMP_W * t) / 1000));
/** The height (m over the sea) mode `m` holds the point `s` behind the snout at `t`. A coil's own shape is coilPoint's;
 *  as a mode alone it lies sounded - the path's body under the coil, never a second serpent on the surface beside it. */
export function depthOf(m, s, t, since = t) {
  switch (m) {
    case MODE.deep: return DEEP_Y;
    case MODE.coil: return DEEP_Y;   // the path's body under the sea - the coil's own shape is coilPoint's, eased over it
    case MODE.breach: { const w = Math.exp(-s / BREACH_FALL); return w * BREACH_Y + (1 - w) * hump(s, t); }
    case MODE.rear: { const w = Math.exp(-s / REAR_FALL); return w * REAR_Y + (1 - w) * hump(s, t) * 0.6; }
    case MODE.dying: {
      // DEATH THROES: the body rolls high once, then founders - under DEEP_Y by the dive's end
      const k = Math.max(0, Math.min(1, (t - since) / 15_000));
      return (1 - k) * (2 + 2.5 * Math.sin((2 * Math.PI * s) / 60 - t / 400)) + k * DEEP_Y;
    }
    default: { const w = Math.exp(-s / 10); return w * CRUISE_HEAD_Y + (1 - w) * hump(s, t); }
  }
}
/**
 * A mode change: `{at, m}`. The body's height `s` behind the snout at `t` - the mode at `t` eased from the one before
 * it over MODE_BLEND_MS.
 * @param {ReadonlyArray<{at: number, m: number}>} modes
 */
export function depthAt(modes, s, t) {
  if (!modes?.length) return depthOf(MODE.cruise, s, t);
  let i = modes.length - 1;
  while (i > 0 && modes[i].at > t) i--;
  const cur = modes[i];
  if (cur.at > t) return depthOf(cur.m, s, t, cur.at);   // before the first word: as the first says
  const prev = i > 0 ? modes[i - 1] : null;
  const k = prev ? smooth((t - cur.at) / MODE_BLEND_MS) : 1;
  const y = depthOf(cur.m, s, t, cur.at);
  return k >= 1 ? y : depthOf(prev.m, s, t, prev.at) * (1 - k) + y * k;
}
/** The mode at `t`. */
export function modeAt(modes, t) {
  if (!modes?.length) return MODE.cruise;
  for (let i = modes.length - 1; i >= 0; i--) if (modes[i].at <= t) return modes[i].m;
  return modes[0].m;
}
/** The modes kept (the one before the newest is the newest's ease). */
export const MODES_KEPT = 4;

// ── the coil ───────────────────────────────────────────────────────────
/** A coil about a ship: the loop's radius (m - a carrack's middle; her bow and stern stand out of it), how long the
 *  body takes to wind on and off it (ms), the head's height looming over her deck and how far in over it. */
export const COIL_R = 22;
export const COIL_BLEND_MS = 1800;
export const COIL_HEAD_Y = 15;
export const COIL_HEAD_IN = 0.45;
/** The neck from the head down to the loop (m), and the loop's share of a whole turn - the rest of the body trails off
 *  into the sea. */
export const COIL_NECK = 22;
export const COIL_TURN = 0.92;
/** Adrift (m/s): its throes, and its head going round a coil's ring - the brain's own (serpentBrain.js re-exports it). */
export const DRIFT_V = 3;
/**
 * AUDIT SHIPS B6 (2026-10-06): THE COIL TURNS WITH ITS HEAD - the bearing from her its head is at `t`: the bearing it began
 * at (`th`), gone round counter-clockwise at DRIFT_V on COIL_R since it wound on (the brain's own swim round its ring),
 * held where it was let go (`off`). Drawn at `th` alone, the coil lay still while its head went round its ring - 190
 * degrees by a full coil's end - and the body slid across the ring as it let go.
 */
export function coilAngleAt(c, t) {
  const end = c.off > 0 ? Math.min(t, c.off) : t;
  return c.th - (DRIFT_V * Math.max(0, end - c.at)) / 1000 / COIL_R;
}
/**
 * The coil's point `s` behind the snout - a coil `{x, z, th}` (its ship's place in the site frame and the bearing from
 * her it began at): the head looming over her deck, the neck down to her waterline, the loop round her at it, the tail
 * trailing off and down. `{x, y, z}`. AUDIT SHIPS B6: `th` the bearing its head is at now (coilAngleAt).
 */
export function coilPoint(c, s, th = c.th) {
  const loopLen = COIL_TURN * 2 * Math.PI * COIL_R;
  if (s <= COIL_NECK) {
    const k = s / COIL_NECK;
    const hx = c.x + Math.sin(th) * COIL_R * COIL_HEAD_IN, hz = c.z + Math.cos(th) * COIL_R * COIL_HEAD_IN;
    const lx = c.x + Math.sin(th) * COIL_R, lz = c.z + Math.cos(th) * COIL_R;
    return { x: hx + (lx - hx) * k, y: COIL_HEAD_Y + (2.2 - COIL_HEAD_Y) * smooth(k), z: hz + (lz - hz) * k };
  }
  if (s <= COIL_NECK + loopLen) {
    const a = th + (s - COIL_NECK) / COIL_R;
    const k = (s - COIL_NECK) / loopLen;
    return { x: c.x + Math.sin(a) * COIL_R, y: 2.2 - 3.2 * k, z: c.z + Math.cos(a) * COIL_R };
  }
  // the tail off the loop's end, along its tangent, down into the sea
  const a = th + loopLen / COIL_R, rest = s - COIL_NECK - loopLen;
  const ex = c.x + Math.sin(a) * COIL_R, ez = c.z + Math.cos(a) * COIL_R;
  return { x: ex + Math.cos(a) * rest, y: -1 - rest * 0.4, z: ez - Math.sin(a) * rest };
}
/** How much of the body the coil holds at `t` (0..1): wound on from its `at`, off from its `off` (its breaking, its
 *  crush or its slipping - 0 while it holds) - null coil, none. AUDIT SHIPS D2 (2026-10-06): wound on from `w` when it
 *  says one - the moment every screen holds its word (the relay winds it at the beat after its landing, and says it
 *  SERPENT_SAY_AHEAD_MS on): eased from its landing, which no screen had heard of yet, a screen 150 ms behind snapped
 *  its head 2 m up as the word came. Its clock (`at` - its hold, its turn round her, its end) is its landing's still. */
export function coilWeight(c, t) {
  if (!c) return 0;
  const on = smooth((t - (c.w > c.at ? c.w : c.at)) / COIL_BLEND_MS);
  return c.off > 0 && t >= c.off ? on * (1 - smooth((t - c.off) / COIL_BLEND_MS)) : on;
}

// ── the whole body ─────────────────────────────────────────────────────
/**
 * THE BODY AT `t`: SEG_N + 1 points along it, snout first, each `{x, y, z, yw, r}` - the site frame, y over the sea,
 * the radius there. `b` is the body's word: `{legs, modes, coil}` (the brain's fight, or the client's fold - one
 * shape). `out` reuses an array of points.
 * @param {{legs: ReadonlyArray<Leg>, modes: ReadonlyArray<{at: number, m: number}>, coil?: any}} b @param {number} t
 * @param {Array<{x: number, y: number, z: number, yw: number, r: number}>} [out]
 */
export function bodyAt(b, t, out = []) {
  const w = coilWeight(b.coil, t);
  const th = w > 0 ? coilAngleAt(b.coil, t) : 0;   // AUDIT SHIPS B6: the coil as its head has gone round it
  for (let i = 0; i <= SEG_N; i++) {
    const s = i * SEG_LEN;
    const p = spinePoint(b.legs, t, s);
    let x = p.x, z = p.z, y = depthAt(b.modes, s, t);
    if (w > 0) { const c = coilPoint(b.coil, s, th); x += (c.x - x) * w; y += (c.y - y) * w; z += (c.z - z) * w; }
    const o = out[i] ?? (out[i] = { x: 0, y: 0, z: 0, yw: 0, r: 0 });
    o.x = x; o.y = y; o.z = z; o.yw = p.yw; o.r = radiusAt(s);
  }
  out.length = SEG_N + 1;
  // the facing along the body as it lies (a coil's included) - each point toward the one before it
  for (let i = 0; i <= SEG_N; i++) {
    const a = out[Math.max(0, i - 1)], c = out[Math.min(SEG_N, i + 1)];
    if (i > 0 || w > 0) out[i].yw = Math.atan2(a.x - c.x, a.z - c.z);
  }
  return out;
}

/** A segment stands out of the sea when its crown is this far over it (m) - a ball skimming the wave top meets water. */
export const EXPOSED_M = 0.4;
/** Is segment `i` (points i to i+1) above the sea? */
export const segExposed = (pts, i) => Math.max(pts[i].y + pts[i].r, pts[i + 1].y + pts[i + 1].r) > EXPOSED_M;
/** Is any of it above the sea? */
export function anyExposed(pts) {
  for (let i = 0; i < SEG_N; i++) if (segExposed(pts, i)) return true;
  return false;
}
/** THE WEAK PLACE: its head out of the sea and thrown up - a breach, a rear, a coil (it looms over the deck) - or the
 *  head on the water stunned (`stunned`). */
export function headExposed(b, pts, t, stunned = false) {
  if (!segExposed(pts, 0)) return false;
  if (stunned) return true;
  const m = modeAt(b.modes, t);
  return m === MODE.breach || m === MODE.rear || coilWeight(b.coil, t) > 0.5;
}
/** The nearest point of the body above the sea to (x, z) - its distance on the flat (m) and the segment - or null when
 *  none of it is. */
export function nearestExposed(pts, x, z) {
  let best = null;
  for (let i = 0; i < SEG_N; i++) {
    if (!segExposed(pts, i)) continue;
    const a = pts[i], c = pts[i + 1];
    const dx = c.x - a.x, dz = c.z - a.z, L2 = dx * dx + dz * dz;
    const k = L2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)) : 0;
    const d = Math.hypot(x - (a.x + dx * k), z - (a.z + dz * k)) - Math.max(a.r, c.r);
    if (!best || d < best.d) best = { d: Math.max(0, d), i };
  }
  return best;
}
/**
 * Segment `i`'s box (navalBallistics.js orientedBox's shape: centre, three unit axes, half extents) in a frame where
 * the site's (x, z) is `toFrame(x, z)` and the sea's top is `seaY` - the shots' target (systems/naval/navalShots.js).
 * Its long axis along the segment (z), y up through it.
 */
export function segmentBox(pts, i, seaY = 0, toFrame = (x, z) => [x, z]) {
  const a = pts[i], c = pts[i + 1];
  const [ax, az] = toFrame(a.x, a.z), [cx, cz] = toFrame(c.x, c.z);
  const dx = cx - ax, dy = c.y - a.y, dz = cz - az, len = Math.hypot(dx, dy, dz) || 1e-6;
  const zA = [dx / len, dy / len, dz / len];
  // a y axis square to it, as near up as it can be
  let yA = [-zA[0] * zA[1], 1 - zA[1] * zA[1], -zA[2] * zA[1]];
  const yl = Math.hypot(yA[0], yA[1], yA[2]);
  yA = yl > 1e-6 ? [yA[0] / yl, yA[1] / yl, yA[2] / yl] : [1, 0, 0];
  const xA = [yA[1] * zA[2] - yA[2] * zA[1], yA[2] * zA[0] - yA[0] * zA[2], yA[0] * zA[1] - yA[1] * zA[0]];
  const r = Math.max(a.r, c.r);
  return { c: [(ax + cx) / 2, seaY + (a.y + c.y) / 2, (az + cz) / 2], ax: xA, ay: yA, az: zA, h: [r, r, len / 2 + r * 0.25] };
}
