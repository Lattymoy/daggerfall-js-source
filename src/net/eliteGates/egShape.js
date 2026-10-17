// @ts-check
// EG-FULL (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 11.7, 13.2 and 25.4): THE
// SPIRE'S SHAPES - every blow a lord, an add or a hall throws, as ONE stamp the relay sends whole (a FULL shape stamp,
// section 21: its kind and every number, so no screen reads a table to know what lands) and every screen tests its own
// feet against at the landing (co-op's law - net/gate/gateStrike.js's, for any shape).
//
// THE STAMPS (metres, the hall's own frame - net/eliteGates/egLaw.js; a facing `atan2(dx, dz)` as the gate's):
//   ['d', x, z, r]              a disc
//   ['l', ax, az, bx, bz, w]    a lane from a to b, w wide
//   ['c', x, z, yaw, r, arc]    a cone from (x, z), r long, arc degrees about yaw
//   ['r', x, z, r0, r1]         a ring - safe inside r0 and outside r1
//   ['a']                       the whole floor (a CHECK)
//   ['h', x0, z0, r0, x1, ...]  everywhere OUTSIDE the havens (gold discs) it names - the Haven Nova's (a CHECK)
//
// THE FLOORS EVERY BLOW KEEPS (section 13.2), here as law:
//   THE WIND-UP FLOOR - `windup >= escape(shape) / EG_ESCAPE_MPS + EG_REACT_S`, the escape the farthest interior point's
//     distance to the shape's edge at THE ESCAPE BUILD's run, ceiled to 10 ms; it CLAMPS (lengthens), never refuses.
//   THE WIDTH RULE - every aimed shape at least EG_WIDTH_MIN across at its narrowest, or the relay's census could never
//     see it (net/bossBody.js deepIn's probes).
//   THE UNION FLOOR - a member's pending landings, taken in time, never leave them no floor to stand on (EG-H1: moved to
//     net/eliteGates/egFloor.js, where the page says it lives - egUnionHolds, and the place's landings beside the blows).
//   THE CHECK CLASS - a whole-floor or haven blow (`ch` 1) has a fixed wind-up and damage; the wind-up floor does not
//     touch it (its errand's own floor does - the lords' brains).
//   THE TELEGRAPH BUDGET - which shapes a screen draws when there are more than it can (egShapeOrder).
//
// Pure, integer-free arithmetic is fine here (this is no hall's draw - the spec law, net/eliteGates/egLaw.js, is); in the relay
// bundle. Not a DFU member. Ledger A (ELITE-GATES).

/** THE ESCAPE BUILD's run (section 10.2: Speed 40, Running 20) - the motor's GetRunSpeed, (LiveSpeed + 150) / 39.5 x
 *  (1.35 + Running / 200); pinned equal to player/motor.js runSpeed(40, 20). */
export const EG_ESCAPE_MPS = ((40 + 150) / 39.5) * (1.35 + 20 / 200);
/** A human's reaction and a one-way latency (section 13.2). */
export const EG_REACT_S = 0.5;
/** THE WIDTH RULE's narrowest aimed shape (m). */
export const EG_WIDTH_MIN = 4;
/** THE TELEGRAPH BUDGET: the most shapes a screen draws (section 25.4). */
export const EG_SHAPES_DRAWN_MAX = 24;
/** The most stamps one blow carries, and the most pending blows a frame says. */
export const EG_STAMPS_MAX = 10;
export const EG_BLOWS_MAX = 32;
/** The stamps' kinds. */
export const EG_SHAPE = Object.freeze({ disc: 'd', lane: 'l', cone: 'c', ring: 'r', all: 'a', out: 'h' });

const DEG = Math.PI / 180;
const wrap = (a) => { let x = (a + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; };
const r2 = (v) => Math.round(v * 100) / 100;
/** The distance from (px, pz) to the segment (ax, az)-(bx, bz). */
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

// ── EG-HERO-LAY (2026-10-13, spec law 7; Elite-Gates.md sections 11.5 and 11.7): A FIGHT FLOOR'S PIECE AS A POLYGON ─────────
// A hero fragment's fight floors are polygons at their heights (its law record's `floors` - net/eliteGates/egFragLaw.js), laid into a
// hall spec's fight floor beside the discs and lanes as `{ t: 'p', poly: [[x, z], ...], y }` (metres, the hall's frame,
// counter-clockwise with x right and z up). Every reader of the fight floor asks these three of a polygon: does it hold a
// point, how far is a point from it, and where is the nearest point inside it.
/** Does polygon `poly` ([[x, z], ...]) hold (x, z) - its edges and corners its own - or stand within `pad` of it? */
export function egPolyIn(poly, x, z, pad = 0) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], az = poly[j][1], bx = poly[i][0], bz = poly[i][1];
    if ((az > z) !== (bz > z) && x < ax + ((bx - ax) * (z - az)) / (bz - az)) inside = !inside;
  }
  return inside || egPolyEdgeDist(poly, x, z) <= Math.max(0, pad) + 1e-9;
}
/** The distance from (x, z) to polygon `poly`'s outline (m). */
export function egPolyEdgeDist(poly, x, z) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, segDist(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
  return d;
}
/** How far (x, z) stands outside polygon `poly` (m): its distance to the outline outside it, minus that distance inside. */
export const egPolyDist = (poly, x, z) => (egPolyIn(poly, x, z) ? -egPolyEdgeDist(poly, x, z) : egPolyEdgeDist(poly, x, z));
/** The point of polygon `poly` nearest (x, z), `inset` m inside its outline (along the nearest edge's inward normal - a
 *  counter-clockwise polygon's left), or the outline's own nearest point where the inset would leave it. `[x, z]`. */
export function egPolyKeep(poly, x, z, inset = 0) {
  if (egPolyIn(poly, x, z) && egPolyEdgeDist(poly, x, z) >= inset) return [x, z];
  let best = null, bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], az = poly[j][1], ex = poly[i][0] - ax, ez = poly[i][1] - az, L2 = ex * ex + ez * ez;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2)) : 0, px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; const L = Math.sqrt(L2) || 1; best = [px, pz, -ez / L, ex / L]; }
  }
  if (!best) return [x, z];
  const q = [best[0] + best[2] * inset, best[1] + best[3] * inset];
  return egPolyIn(poly, q[0], q[1]) ? q : [best[0], best[1]];
}
/** Does fight floor piece `f` (a disc `d`, a lane `l`, a polygon `p`) hold (x, z), `pad` m about - a negative pad that far
 *  inside its edge? */
export const egPieceIn = (f, x, z, pad = 0) => (f.t === 'p' ? egPolyIn(f.poly, x, z, Math.max(0, pad)) && (pad >= 0 || egPolyEdgeDist(f.poly, x, z) >= -pad) : f.t === 'd' ? Math.hypot(x - f.x, z - f.z) <= f.r + pad : segDist(x, z, f.ax, f.az, f.bx, f.bz) <= f.hw + pad);

// ── the stamps' makers (each rounded to the centimetre, the wire's) ──────────────────────────────────────
export const shDisc = (x, z, r) => ['d', r2(x), r2(z), r2(r)];
export const shLane = (ax, az, bx, bz, w) => ['l', r2(ax), r2(az), r2(bx), r2(bz), r2(w)];
/** A lane `len` long from (x, z) along `yaw`. */
export const shLaneAt = (x, z, yaw, len, w) => shLane(x, z, x + Math.sin(yaw) * len, z + Math.cos(yaw) * len, w);
export const shCone = (x, z, yaw, r, arc) => ['c', r2(x), r2(z), Math.round(wrap(yaw) * 1000) / 1000, r2(r), Math.round(arc)];
export const shRing = (x, z, r0, r1) => ['r', r2(x), r2(z), r2(r0), r2(r1)];
export const shAll = () => ['a'];
/** Everywhere outside the havens `[[x, z, r], ...]`. */
export const shOut = (havens) => ['h', ...havens.flatMap(([x, z, r]) => [r2(x), r2(z), r2(r)])];

/** Is the stamp a valid one (its kind, its numbers' count and bounds - `B` the frame's coordinate bound)? */
export function egStampOk(s, B = 400) {
  if (!Array.isArray(s) || typeof s[0] !== 'string') return false;
  const n = (i, lo = -B, hi = B) => typeof s[i] === 'number' && Number.isFinite(s[i]) && s[i] >= lo && s[i] <= hi;
  switch (s[0]) {
    case 'd': return s.length === 4 && n(1) && n(2) && n(3, 0.1, 80);
    case 'l': return s.length === 6 && n(1) && n(2) && n(3) && n(4) && n(5, 0.1, 80);
    case 'c': return s.length === 6 && n(1) && n(2) && n(3, -4, 4) && n(4, 0.1, 80) && n(5, 1, 360);
    case 'r': return s.length === 5 && n(1) && n(2) && n(3, 0, 80) && n(4, 0.1, 120) && s[3] < s[4];
    case 'a': return s.length === 1;
    case 'h': if (s.length < 4 || (s.length - 1) % 3 !== 0 || s.length > 1 + 3 * 8) return false; for (let i = 1; i < s.length; i++) if (!n(i, (i - 1) % 3 === 2 ? 0.1 : -B, (i - 1) % 3 === 2 ? 40 : B)) return false; return true;
    default: return false;
  }
}

/** Is (px, pz) inside the stamp? */
export function egInShape(s, px, pz) {
  if (!s || !Number.isFinite(px) || !Number.isFinite(pz)) return false;
  switch (s[0]) {
    case 'd': return Math.hypot(px - s[1], pz - s[2]) <= s[3];
    case 'l': return segDist(px, pz, s[1], s[2], s[3], s[4]) <= s[5] / 2;
    case 'c': { const dx = px - s[1], dz = pz - s[2], d = Math.hypot(dx, dz); return d <= s[4] && (d < 0.5 || Math.abs(wrap(Math.atan2(dx, dz) - s[3])) <= (s[5] / 2) * DEG); }
    case 'r': { const d = Math.hypot(px - s[1], pz - s[2]); return d >= s[3] && d <= s[4]; }
    case 'a': return true;
    case 'h': { for (let i = 1; i + 2 < s.length; i += 3) if (Math.hypot(px - s[i], pz - s[i + 1]) <= s[i + 2]) return false; return true; }
    default: return false;
  }
}
/** Is (px, pz) inside any of a blow's stamps? */
export const egInBlow = (blow, px, pz) => !!blow?.s?.some((s) => egInShape(s, px, pz));
/** AUDIT EG IV (lane1 #5; section 13.2's CHECK class): does a blow reach member `sub` standing at (px, pz)? A blow that names its
 *  members (`on` - an errand's failure blow: the Chain Snaps, a Soul Burst, the Cage Closes) lands on them wherever they stand,
 *  and on no one else; any other, where its stamps hold the feet. */
export const egBlowOn = (blow, sub, px, pz) => (blow?.on ? sub != null && blow.on.includes(sub) : egInBlow(blow, px, pz));

/** A cone's inscribed radius: the largest disc inside the sector (half its length past a half-turn). */
export function coneInscribed(r, arcDeg) {
  if (arcDeg >= 180) return r / 2;
  const s = Math.sin((arcDeg / 2) * DEG);
  return (r * s) / (1 + s);
}
/** How far the deepest point of an aimed stamp lies from its edge (m) - Infinity for a CHECK's. */
export function egEscapeM(s) {
  switch (s?.[0]) {
    case 'd': return s[3];
    case 'l': return s[5] / 2;
    case 'c': return coneInscribed(s[4], s[5]);
    case 'r': return (s[4] - s[3]) / 2;
    default: return Infinity;
  }
}
/** A stamp's narrowest width (m) - Infinity for a CHECK's. */
export const egWidthOf = (s) => 2 * egEscapeM(s);
/** Does the stamp keep THE WIDTH RULE (a CHECK's always does)? */
export const egWidthOk = (s) => egWidthOf(s) >= EG_WIDTH_MIN - 1e-9;
/** THE WIND-UP FLOOR for a stamp (ms, ceiled to 10) - 0 for a CHECK's (its errand's floor is the brain's). */
export function egWindupFloorMs(s) {
  const e = egEscapeM(s);
  if (!Number.isFinite(e)) return 0;
  return Math.ceil(((e / EG_ESCAPE_MPS + EG_REACT_S) * 1000) / 10) * 10;
}
/** A blow's wind-up kept at its floor: every stamp's, unless it is a CHECK (fixed). */
export function egFloorWindup(wu, stamps, check = false) {
  if (check) return wu;
  let f = 0;
  for (const s of stamps) f = Math.max(f, egWindupFloorMs(s));
  return Math.max(wu, f);
}
/** AUDIT EG III (section 13.2's fury, section 14's Chained Blows): a chained second shape's fill past its wind-up floor, and
 *  its least (ms). */
export const EG_CHAIN_PAD_MS = 300;
export const EG_CHAIN_MIN_MS = 1000;
/**
 * AUDIT EG III - THE CHAINED GAP, the one rule fury's chained shape (net/eliteGates/egLords.js) and Chained Blows (net/eliteGates/egLegion.js) both
 * read: how long after a blow of wind-up `wu` and stamps `stamps` lands its chained second shape lands - `max(the blow's own
 * wind-up, its wind-up floor + 0.3 s, 1.0 s)` (sections 13.2 and 14), so a chained shape never counts down faster than the
 * same blow alone. A CHECK's stamps carry no floor (egWindupFloorMs), so its gap is its wind-up or the least.
 * @param {number} wu @param {any[]} stamps
 */
export function egChainGapMs(wu, stamps) {
  let f = 0;
  for (const s of stamps ?? []) f = Math.max(f, egWindupFloorMs(s));
  return Math.max(wu, f + EG_CHAIN_PAD_MS, EG_CHAIN_MIN_MS);
}
/** A lone runner's route at the escape build plus the errand floor's 1.5 s (THE ERRAND FLOOR, section 13.2), ms. */
export const egErrandMs = (routeM) => Math.ceil(((routeM / EG_ESCAPE_MPS + 1.5) * 1000) / 10) * 10;

/** AUDIT EG V (lane1 #18; sections 13.2 and 14): the longest a chained shape's dim outline stands before its fill (ms). */
export const EG_OUTLINE_MAX_MS = 30_000;
/**
 * A BLOW AS THE RELAY SAYS IT: `i` its number (the fight's), `o` who throws it (a body's number, 0 the place), `s` its
 * stamps, `at` when it lands (relay ms), `wu` its wind-up (the word went out `at - wu`), `p` the share of the struck body's
 * own maximum health and `b` the points beside it, `el` its element (null plain), `nm` its name, `ch` a CHECK, `pu` its push
 * (m), `sp` how long its landing lasts (ms - a charge's run, a fire-fall's burn), `ft` a feint (cut at FEINT_AT - never
 * said: the relay sends the cut). AUDIT EG IV (lane1 #5): `on` the members a CHECK names (egBlowOn) - its stamps then only
 * mark them; absent, it lands where its stamps lie. AUDIT EG V (lane1 #18): `ol` a chained shape's DIM OUTLINE's lead (ms) - its
 * outline stands that long before its fill begins (`at - wu`), from the first shape's word: the gate's "dim outline at once"
 * grammar, its fill starting when the first lands.
 * @param {{ i: number, o?: number, s: any[], at: number, wu: number, p: number, b?: number, el?: string|null, nm?: string, ch?: number|boolean, pu?: number, sp?: number, ft?: number, on?: string[]|null, ol?: number }} blow
 */
export function egBlowOf({ i, o = 0, s, at, wu, p, b = 0, el = null, nm = '', ch = 0, pu = 0, sp = 0, on = null, ol = 0 }) {
  const blow = { i, o, s, at, wu: egFloorWindup(wu, s, !!ch), p, b, el, nm, ch: ch ? 1 : 0, pu, sp };
  if (on?.length) blow.on = [...on];
  if (ol > 0) blow.ol = Math.min(EG_OUTLINE_MAX_MS, Math.round(ol));
  return blow;
}
/** AUDIT EG V (lane1 #18): when a blow's outline first stands (relay ms) - its word, a chained shape's dim outline's lead before
 *  its fill. */
export const egBlowOutlineFrom = (blow) => blow.at - blow.wu - (blow.ol ?? 0);
/** Its word's instant (relay ms): the wind-up's start. */
export const egBlowFrom = (blow) => blow.at - blow.wu;

/**
 * THE VERDICT on the struck member's machine at `now`: 'hit', 'miss' or 'wait' - decided at the first frame at or past
 * its landing (a landing with a span is 'hit' at the first frame inside it while it lasts), and a landing met later than
 * `late` past its span lets it pass (nobody is struck by what their screen never showed land). AUDIT EG IV: `sub` the member
 * judged, for a blow that names its members (egBlowOn).
 */
export function egBlowVerdict(blow, px, pz, now, late = 400, sub = null) {
  if (!blow || !Number.isFinite(blow.at)) return 'miss';
  if (now < blow.at) return 'wait';
  const span = Math.max(1, blow.sp ?? 0);
  if (now > blow.at + span + late) return 'miss';
  if (egBlowOn(blow, sub, px, pz)) return 'hit';
  return now >= blow.at + span ? 'miss' : 'wait';
}

// ── THE TELEGRAPH BUDGET (section 25.4) ────────────────────────────────────────────────────────────────
/**
 * The order a screen draws pending blows in, `max` at most: every blow whose field holds my feet or that is aimed at me,
 * then CHECKs and lords' blows, then the soonest to land, then the nearest my feet, ties by number. `lords` the bodies
 * that are lords; `me` my feet ([x, z], the hall's frame) and my sub (`aimedAt` - a blow's aim).
 * @param {any[]} blows @param {number[]|null} me @param {number} now
 * @param {{ lords?: Set<any>, max?: number, aimedAt?: (b: any) => boolean }} [o]
 */
export function egShapeOrder(blows, me, now, { lords = new Set(), max = EG_SHAPES_DRAWN_MAX, aimedAt = () => false } = {}) {
  const near = (b) => {
    let d = Infinity;
    for (const s of b.s) {
      if (s[0] === 'd' || s[0] === 'c' || s[0] === 'r') d = Math.min(d, Math.hypot(me[0] - s[1], me[1] - s[2]));
      else if (s[0] === 'l') d = Math.min(d, segDist(me[0], me[1], s[1], s[2], s[3], s[4]));
      else d = 0;
    }
    return d;
  };
  const key = (b) => [me && (egInBlow(b, me[0], me[1]) || aimedAt(b)) ? 0 : 1, b.ch || lords.has(b.o) ? 0 : 1, Math.max(0, b.at - now), me ? near(b) : 0, b.i];
  return [...blows].map((b) => ({ b, k: key(b) })).sort((x, y) => { for (let i = 0; i < 5; i++) if (x.k[i] !== y.k[i]) return x.k[i] - y.k[i]; return 0; }).slice(0, max).map((e) => e.b);
}
