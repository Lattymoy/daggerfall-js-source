// @ts-check
// EG-ZG (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 11.7, 25.2, 25.4, 25.5,
// 25.6 and 25.8 - EG6b, and what EG-G2, EG-G1 and EG-H1 left for the screen): THE TELEGRAPHS AS WRITTEN, AS LAW - every
// rule the Spire's fight draws its warnings by, pure, so a test holds each one and a pass only draws it:
//   THE TELEGRAPHS PER FIGHT FLOOR (section 11.7) - each fight floor (`spec.fl`) triangulated once (a disc's 48 sides, the
//     drawn rim's own - world/superDungeon/sdRealm.js SD_ISLAND_SIDES; a lane's rectangle and its two round ends, the floor test's own
//     capsule - net/eliteGates/egLaw.js egOnFight), each shape drawn on every floor it covers - clipped on the CPU to the shape's bounds
//     (render/gate/gateTelegraph.js telegraphBounds), only at the heights it lands on (the relay's own rule: the floors whose plan
//     holds its anchor, net/bossRef.js floorsUnder) - at most THE TELEGRAPH BUDGET's 32 shape-floor draws a frame, in its
//     order (mine and what holds my feet first, then the blows in net/eliteGates/egShape.js egShapeOrder's rank, then the nearest);
//   THE PERIL ARROW (section 25.5) - the soonest blow on my feet, its way out searched over my own fight floor (never across
//     a wall or an open edge), preferring a bearing that clears every other pending shape, and a CHECK with no exit its
//     order instead;
//   THE TWO TETHER GRAMMARS, A SPIRE POOL, THE ECLIPSE (sections 25.2 and 25.5), the marks' sigils over heads (section 13.2),
//     a Vestige aura's ring (section 25.4), THE SHADE'S RIM LIGHT (section 25.6), and WEIGHT (section 25.8): the heavy blows'
//     shakes, allies' hits at 0.4, a Drop's thud and dust.
//   EG-ZJ (2026-10-12): A HAZARD'S OWN SURFACE (egHazardSurface) - the traversal ground's hazards and the Cooling Slag's spill
//     drawn as one quad at their own height, never clipped onto a fight floor near them.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { telegraphBounds, telegraphField, telegraphStrip, TELEGRAPH_KIND, TELEGRAPH_NOW_MS } from '../../render/gate/gateTelegraph.js';
import { egInShape, segDist, egPieceIn } from '../../net/eliteGates/egShape.js';
import { egHazardParts, EG_HAZARDS } from '../../net/eliteGates/egFragLaw.js';
import { egFightFloorAt } from '../../net/eliteGates/egFair.js';
import { egOneStorey } from '../../net/eliteGates/egWalkGraph.js';   // THE ASCENT - HEIGHT: a shape drawn on its own storey's floors, the peril arrow's blow of mine
import { EG_FL } from '../../net/eliteGates/egBodies.js';
import { EG_ECLIPSE_NM } from '../../net/eliteGates/egLords.js';   // EG-PERFECT: a lord's own Eclipse, by its name
import { EG_VESTIGES } from '../../net/eliteGates/egVestige.js';
import { gateHitFlash } from '../gate/gateBoss.js';
import { EG_BAND_RAMPS } from './egBandArt.js';
import { SD_ISLAND_SIDES } from '../superDungeon/sdRealm.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ── THE TELEGRAPHS PER FIGHT FLOOR (section 11.7, EG6b) ─────────────────────────────────────────────────────────
/** THE TELEGRAPH BUDGET's floor half (section 25.4): the most shape-floor draws a frame; a lane's round ends' sides each;
 *  how far past a floor's plan a shape's anchor still lands on it (m - the relay's own margin, net/bossRef.js floorsUnder). */
export const EG_FLOOR_DRAWS_MAX = 32;
export const EG_FLOOR_CAP_SIDES = 12;
export const EG_FLOOR_NEAR_M = 1;
/** Does fight floor piece `f` (spec.fl's - a disc `d` or a lane `l`; EG-HERO-LAY: a hero's polygon `p`) hold (x, z), `pad` m
 *  about? */
const holds = (f, x, z, pad = 0) => (f.t === 'p' ? egPieceIn(f, x, z, pad) : f.t === 'd' ? Math.hypot(x - f.x, z - f.z) <= f.r + pad : segDist(x, z, f.ax, f.az, f.bx, f.bz) <= f.hw + pad);
/** EG-HERO-LAY: a polygon (x, z - counter-clockwise, x right and z up) cut into triangles by its ears, into `tri`. */
function earCut(poly, tri) {
  const v = poly.map((p) => [p[0], p[1]]);
  const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inTri = (p, a, b, c) => turn(a, b, p) >= 0 && turn(b, c, p) >= 0 && turn(c, a, p) >= 0;
  for (let guard = 0; v.length > 3 && guard < 4096; guard++) {
    let cut = false;
    for (let i = 0; i < v.length; i++) {
      const a = v[(i + v.length - 1) % v.length], b = v[i], c = v[(i + 1) % v.length];
      if (turn(a, b, c) <= 0 || v.some((p) => p !== a && p !== b && p !== c && inTri(p, a, b, c))) continue;
      tri(a[0], a[1], b[0], b[1], c[0], c[1]); v.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (v.length === 3) tri(v[0][0], v[0][1], v[1][0], v[1][1], v[2][0], v[2][1]);
}

/**
 * EACH FIGHT FLOOR, TRIANGULATED ONCE (the hall's frame - x, z pairs, three a triangle): `[{ y, tris, box, cx, cz, R, piece,
 * over }]` - `box` [x0, z0, x1, z1], (`cx`, `cz`) and `R` the circle the floor stands in (its rim for a disc, its ends for a
 * lane), `over` that circle as the telegraph pass's court for the floor's draws (its `floor` - { r, courts }). A disc is its
 * drawn rim's 48 sides; a lane its rectangle and two round ends (net/eliteGates/egLaw.js egOnFight's capsule). None for a hall with no
 * fight floor. Pure.
 */
export function egFightFloors(spec) {
  const out = [];
  for (const f of spec?.fl ?? []) {
    const v = [];
    const tri = (ax, az, bx, bz, cx, cz) => v.push(ax, az, bx, bz, cx, cz);
    const fan = (x, z, r, a0, a1, n) => { for (let k = 0; k < n; k++) { const p = a0 + ((a1 - a0) * k) / n, q = a0 + ((a1 - a0) * (k + 1)) / n; tri(x, z, x + Math.sin(p) * r, z + Math.cos(p) * r, x + Math.sin(q) * r, z + Math.cos(q) * r); } };
    if (f.t === 'p') {
      // EG-HERO-LAY: a hero's fight floor - its polygon cut by its ears; its circle about its box's middle
      earCut(f.poly, tri);
      const xs = f.poly.map((p) => p[0]), zs = f.poly.map((p) => p[1]), box = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
      const cx = (box[0] + box[2]) / 2, cz = (box[1] + box[3]) / 2, R = Math.max(...f.poly.map((p) => Math.hypot(p[0] - cx, p[1] - cz)));
      out.push({ y: f.y ?? 0, tris: new Float32Array(v), box, cx, cz, R, piece: f, over: Object.freeze({ r: R, courts: Object.freeze([Object.freeze([cx, cz])]) }) });
      continue;
    }
    if (f.t === 'd') {
      fan(f.x, f.z, f.r, 0, Math.PI * 2, SD_ISLAND_SIDES);
      out.push({ y: f.y ?? 0, tris: new Float32Array(v), box: [f.x - f.r, f.z - f.r, f.x + f.r, f.z + f.r], cx: f.x, cz: f.z, R: f.r, piece: f, over: Object.freeze({ r: f.r, courts: Object.freeze([Object.freeze([f.x, f.z])]) }) });
      continue;
    }
    const dx = f.bx - f.ax, dz = f.bz - f.az, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, nx = -uz * f.hw, nz = ux * f.hw;
    tri(f.ax + nx, f.az + nz, f.bx + nx, f.bz + nz, f.bx - nx, f.bz - nz);
    tri(f.ax + nx, f.az + nz, f.bx - nx, f.bz - nz, f.ax - nx, f.az - nz);
    const head = Math.atan2(ux, uz);
    fan(f.bx, f.bz, f.hw, head - Math.PI / 2, head + Math.PI / 2, EG_FLOOR_CAP_SIDES);   // its far end, round
    fan(f.ax, f.az, f.hw, head + Math.PI / 2, head + (Math.PI * 3) / 2, EG_FLOOR_CAP_SIDES);   // its near end
    const cx = (f.ax + f.bx) / 2, cz = (f.az + f.bz) / 2, R = L / 2 + f.hw;
    out.push({ y: f.y ?? 0, tris: new Float32Array(v), box: [Math.min(f.ax, f.bx) - f.hw, Math.min(f.az, f.bz) - f.hw, Math.max(f.ax, f.bx) + f.hw, Math.max(f.az, f.bz) + f.hw],
      cx, cz, R, piece: f, over: Object.freeze({ r: R, courts: Object.freeze([Object.freeze([cx, cz])]) }) });
  }
  return out;
}

const _pa = [], _pb = [];
/** AUDIT EG V (L6-2, L6-4): a strip's four sides as planes `(nx, nz, c)` - inside where nx * x + nz * z >= c - set once a clip
 *  and read in place (a double handed to a call is boxed). */
const _planes = new Float64Array(12);
/** One polygon (x, z flat in `src`, `n` points) cut to the side of axis `ax` (0 x, 1 z) where `sign` * (v - `box[bi]`) >= 0,
 *  into `dst`. Answers its points. */
function cutPoly(src, n, dst, ax, box, bi, sign) {
  const at = box[bi];
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = src[i * 2 + ax], b = src[j * 2 + ax], ina = sign * (a - at) >= 0, inb = sign * (b - at) >= 0;
    if (ina) { dst[m * 2] = src[i * 2]; dst[m * 2 + 1] = src[i * 2 + 1]; m++; }
    if (ina !== inb) {
      const k = (at - a) / (b - a);
      dst[m * 2] = src[i * 2] + (src[j * 2] - src[i * 2]) * k; dst[m * 2 + 1] = src[i * 2 + 1] + (src[j * 2 + 1] - src[i * 2 + 1]) * k;
      dst[m * 2 + ax] = at; m++;
    }
  }
  return m;
}
/** AUDIT EG V (L6-2): one polygon (x, z flat in `src`, `n` points) cut to the inside of strip plane `p` (_planes), into `dst`.
 *  Answers its points. */
function cutLine(src, n, dst, p) {
  const nx = _planes[p * 3], nz = _planes[p * 3 + 1], c = _planes[p * 3 + 2];
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, da = nx * src[i * 2] + nz * src[i * 2 + 1] - c, db = nx * src[j * 2] + nz * src[j * 2 + 1] - c;
    if (da >= 0) { dst[m * 2] = src[i * 2]; dst[m * 2 + 1] = src[i * 2 + 1]; m++; }
    if ((da >= 0) !== (db >= 0)) {
      const k = da / (da - db);
      dst[m * 2] = src[i * 2] + (src[j * 2] - src[i * 2]) * k; dst[m * 2 + 1] = src[i * 2 + 1] + (src[j * 2 + 1] - src[i * 2 + 1]) * k; m++;
    }
  }
  return m;
}
/** AUDIT EG V (L6-2): is the point at `tris[t]` inside the strip's four planes (_planes)? */
function inStrip(tris, t) {
  const x = tris[t], z = tris[t + 1];
  for (let p = 0; p < 12; p += 3) if (_planes[p] * x + _planes[p + 1] * z - _planes[p + 2] < 0) return false;
  return true;
}
/**
 * A floor's triangles (`tris`, x, z pairs) clipped to `box` [x0, z0, x1, z1] (null: whole) into `out` from float `at` -
 * each triangle cut to the box's four sides (Sutherland-Hodgman) and fanned back to triangles. AUDIT EG V (L6-2): with a
 * `strip` (render/gate/gateTelegraph.js telegraphStrip - a tether's own ground, `box` about it), cut to the strip's four sides
 * instead, so a tether laid across a floor shades its own strip and not the square about it. `out` must hold five
 * triangles a triangle more. Answers the next float. Pure but for `out`.
 * @param {Float32Array|number[]} tris @param {number[]|null} box @param {Float32Array} out @param {number} at
 * @param {{ a: number[], u: number[], len: number, w: number }|null} [strip]
 */
export function egClipTris(tris, box, out, at, strip = null) {
  let w = at;
  if (strip) {
    // the strip's four sides: along it from its start to its length, across it either side of its line (its vertex stage's
    // own frame - render/gate/gateTelegraph.js TELEGRAPH_VS, `vec2(uWalkU.y, -uWalkU.x)`)
    const ux = strip.u[0], uz = strip.u[1], ua = ux * strip.a[0] + uz * strip.a[1], va = uz * strip.a[0] - ux * strip.a[1];
    _planes[0] = ux; _planes[1] = uz; _planes[2] = ua;
    _planes[3] = -ux; _planes[4] = -uz; _planes[5] = -(ua + strip.len);
    _planes[6] = uz; _planes[7] = -ux; _planes[8] = va - strip.w;
    _planes[9] = -uz; _planes[10] = ux; _planes[11] = -(va + strip.w);
  }
  for (let t = 0; t + 5 < tris.length; t += 6) {
    if (!box) { for (let k = 0; k < 6; k++) out[w++] = tris[t + k]; continue; }
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let k = 0; k < 6; k += 2) { x0 = Math.min(x0, tris[t + k]); x1 = Math.max(x1, tris[t + k]); z0 = Math.min(z0, tris[t + k + 1]); z1 = Math.max(z1, tris[t + k + 1]); }
    if (x1 < box[0] || x0 > box[2] || z1 < box[1] || z0 > box[3]) continue;
    const whole = strip ? inStrip(tris, t) && inStrip(tris, t + 2) && inStrip(tris, t + 4) : x0 >= box[0] && x1 <= box[2] && z0 >= box[1] && z1 <= box[3];
    if (whole) { for (let k = 0; k < 6; k++) out[w++] = tris[t + k]; continue; }
    for (let k = 0; k < 6; k++) _pa[k] = tris[t + k];
    let n;
    if (strip) {
      n = cutLine(_pa, 3, _pb, 0);
      n = cutLine(_pb, n, _pa, 1);
      n = cutLine(_pa, n, _pb, 2);
      n = cutLine(_pb, n, _pa, 3);
    } else {
      n = cutPoly(_pa, 3, _pb, 0, box, 0, 1);
      n = cutPoly(_pb, n, _pa, 0, box, 2, -1);
      n = cutPoly(_pa, n, _pb, 1, box, 1, 1);
      n = cutPoly(_pb, n, _pa, 1, box, 3, -1);
    }
    for (let k = 1; k + 1 < n; k++) { out[w++] = _pa[0]; out[w++] = _pa[1]; out[w++] = _pa[k * 2]; out[w++] = _pa[k * 2 + 1]; out[w++] = _pa[k * 2 + 2]; out[w++] = _pa[k * 2 + 3]; }
  }
  return w;
}

/** Does a shape land on chosen floors at all (never the whole floor's or the spokes')? */
const pinsFloors = (sh) => sh.kind !== TELEGRAPH_KIND.all && sh.kind !== TELEGRAPH_KIND.spokes;
/** Does fight floor `f`'s plan hold an anchor of shape `sh` within EG_FLOOR_NEAR_M (its centre; a lane's two ends; each of a
 *  discs' points)? */
function anchorOn(f, sh) {
  const M = EG_FLOOR_NEAR_M;
  if (sh.kind === TELEGRAPH_KIND.discs) { for (let j = 0; j < sh.points.length; j++) if (holds(f.piece, sh.points[j][0], sh.points[j][1], M)) return true; return false; }
  return holds(f.piece, sh.origin[0], sh.origin[1], M) || (sh.kind === TELEGRAPH_KIND.lane && holds(f.piece, sh.end[0], sh.end[1], M));
}
/**
 * Does a shape land at fight floor height `y`? At the heights the relay judges it at: those floors whose plan holds its
 * anchor within EG_FLOOR_NEAR_M (its centre; a lane's two ends; each of a discs' points - net/bossRef.js floorsUnder's
 * rule); at any height when no floor's plan holds an anchor of it, and for the whole floor's and the spokes'. Pure; read in
 * place, a floor a shape (AUDIT EG V, L6-4: no Set of heights a shape a frame). THE ASCENT (Elite-Gates-Ascent.md section
 * 2): a shape whose blow or zone says the height it lands at (`sh.by` - a hall that judges by height) is drawn on the floors
 * of that storey alone (net/eliteGates/egWalkGraph.js egOneStorey) - never on a fight floor stacked over or under it in plan.
 * @param {ReturnType<typeof egFightFloors>} floors @param {any} sh @param {number} y
 */
function landsAt(floors, sh, y) {
  const by = Number.isFinite(sh.by) ? sh.by : NaN;
  if (!egOneStorey(y, by)) return false;
  if (!pinsFloors(sh)) return true;
  let any = false;
  for (let k = 0; k < floors.length; k++) { if (!anchorOn(floors[k], sh) || !egOneStorey(floors[k].y, by)) continue; if (floors[k].y === y) return true; any = true; }
  return !any;
}

/**
 * EG-ZJ (section 11.7; EG-ZC's shafts) - A HAZARD'S OWN SURFACE: the height a fragment hazard's telegraph draws at as one quad
 * of its own (scenes/eliteGates/egFight.js `sh.y` - egFloorPlan's own-surface draw), or NaN for one drawn on the fight floors it covers.
 * A hazard of the traversal ground (`aim` 'trav': a fire fall, the Forge Line's hammers), and THE COOLING SLAG's spill, whose
 * lanes pour over a crossing's crust (a step of the course, never a fight floor) and its lip - in a Forge Gut's chasm and
 * down a Wellhead Deepway's Slag Chute, where no fight floor stands at all. Pure.
 * @param {any} hz the hazard as the spec says it
 */
export const egHazardSurface = (hz) => (EG_HAZARDS[hz?.kind]?.aim === 'trav' || hz?.kind === 'slag' ? hz.y ?? 0 : NaN);
/** How far my feet stand from a shape's ground (its bounds' box, into `out`; nought inside it or for a whole floor's). */
function nearOf(sh, feet, out = null) {
  const B = telegraphBounds(sh, out);
  if (!B) return 0;
  return Math.hypot(Math.max(B[0] - feet[0], 0, feet[0] - B[2]), Math.max(B[1] - feet[1], 0, feet[1] - B[3]));
}
/**
 * THE FLOOR BUDGET (sections 11.7 and 25.4): the frame's shape-floor draws and every floor's clipped triangles in one
 * buffer. `shapes` the frame's (the look laid on - scenes/eliteGates/egFight.js egLookShapes), `floors` egFightFloors's, `feet` mine
 * [x, z] (the hall's frame; null: none), `buf` the kept buffer (grown here). Taken in THE TELEGRAPH BUDGET's order - mine and
 * every shape whose field holds my feet first, then the blows by egShapeOrder's rank (`sh.order` - a CHECK's havens keep
 * their CHECK's), then the nearest my feet, ties by place - each shape on every floor it covers at the heights it lands on,
 * until `max` draws. A shape with its own surface (`sh.y` - a span piece's, a holder's feet) is one draw of its own quad at
 * that height (`over` its own circle); in a hall with no fight floor every shape is (the hall's court, `over` null). Answers
 * `{ draws, buf, n }`: each draw `{ sh, f, first, count, over }` (`f` the floor, its vertices first..first+count; null: the
 * quad), mine last; `n` the floats written. AUDIT EG V (L6-4): `keep` (egFloorPlanKeep - the fight holds one) the plan's
 * own slots, so a frame's plan makes nothing new: its ranks, its draws, its bounds and strip, and the
 * plan it answers (its draws rewritten next frame). Pure but for `buf` and `keep`.
 * @param {any[]} shapes @param {ReturnType<typeof egFightFloors>} floors @param {number[]|null} feet @param {Float32Array|null} buf
 * @param {number} [max] @param {ReturnType<typeof egFloorPlanKeep>|null} [keep]
 */
export function egFloorPlan(shapes, floors, feet, buf, max = EG_FLOOR_DRAWS_MAX, keep = null) {
  const K = keep ?? egFloorPlanKeep(), ranked = K.ranked, draws = K.plan.draws;
  ranked.length = 0; draws.length = 0; K.used = 0;
  for (let i = 0; i < shapes.length; i++) {
    const sh = shapes[i], r = (K.ranks[i] ??= { sh: null, i: 0, k0: 0, k1: 0, k2: 0 });
    r.sh = sh; r.i = i; r.k0 = sh.mine || (feet && telegraphField(sh, feet[0], feet[1]).inside) ? 0 : 1; r.k1 = Number.isFinite(sh.order) ? sh.order : Infinity; r.k2 = feet ? nearOf(sh, feet, K.N) : 0;
    ranked.push(r);
  }
  ranked.sort(byRank);
  let out = buf ?? new Float32Array(4096), n = 0;
  for (let q = 0; q < ranked.length; q++) {
    if (draws.length >= max) break;
    const r = ranked[q], sh = r.sh;
    if (!(sh.alpha > 0.001)) continue;
    const B = telegraphBounds(sh, K.B);
    if (Number.isFinite(sh.y) || !floors.length) {
      const d = planDraw(K, sh, null, 0, 0, r.i);
      if (Number.isFinite(sh.y) && B) { d.over = d.own; d.own.r = Math.hypot(B[2] - B[0], B[3] - B[1]) / 2; d.own.courts[0][0] = (B[0] + B[2]) / 2; d.own.courts[0][1] = (B[1] + B[3]) / 2; }
      draws.push(d);
      continue;
    }
    const strip = telegraphStrip(sh, K.strip);   // AUDIT EG V (L6-2): a tether's floor cut to its own strip
    for (let k = 0; k < floors.length; k++) {
      const f = floors[k];
      if (draws.length >= max) break;
      if (!landsAt(floors, sh, f.y)) continue;   // only the heights it lands on
      if (B && (B[2] < f.box[0] || B[0] > f.box[2] || B[3] < f.box[1] || B[1] > f.box[3])) continue;
      if (out.length < n + f.tris.length * 5) { const grown = new Float32Array(Math.max(out.length * 2, n + f.tris.length * 5)); grown.set(out.subarray(0, n)); out = grown; }
      const at = n;
      n = egClipTris(f.tris, B, out, n, strip);
      if (n > at) draws.push(planDraw(K, sh, f, at / 2, (n - at) / 2, r.i));
    }
  }
  draws.sort(mineLast);
  K.plan.buf = out; K.plan.n = n;
  return K.plan;
}
/** AUDIT EG V (L6-4): what egFloorPlan keeps between a caller's frames (scenes/eliteGates/egFight.js holds one a fight): its rank and
 *  draw slots, its bounds' and its nearest's boxes, its strip, and the plan it answers. */
export const egFloorPlanKeep = () => ({ ranks: [], ranked: [], slots: [], used: 0, B: [0, 0, 0, 0], N: [0, 0, 0, 0], strip: { a: [0, 0], u: [0, 0], len: 0, w: 0 }, plan: { draws: [], buf: null, n: 0 } });
/** THE TELEGRAPH BUDGET's order (egFloorPlan): mine and what holds my feet, then the blows' rank, then the nearest, then place. */
const byRank = (a, b) => a.k0 - b.k0 || a.k1 - b.k1 || a.k2 - b.k2 || a.i - b.i;
/** Mine drawn last, on top (section 25.4). */
const mineLast = (a, b) => (a.sh.mine ? 1 : 0) - (b.sh.mine ? 1 : 0) || a.i - b.i;
/** A draw of `keep`'s next slot - `{ sh, f, first, count, over, i }`, its own circle (`own`) kept for an own surface's quad. */
function planDraw(K, sh, f, first, count, i) {
  const d = (K.slots[K.used++] ??= { sh: null, f: null, first: 0, count: 0, over: null, i: 0, own: { r: 0, courts: [[0, 0]] } });
  d.sh = sh; d.f = f; d.first = first; d.count = count; d.over = null; d.i = i;
  return d;
}

// ── THE PERIL ARROW (section 25.5) ─────────────────────────────────────────────────────────────────────────────
/** THE PERIL ARROW's search: bearings, its step and reach (m), how far inside a floor's edge it keeps (m) - the gate's own
 *  numbers (scenes/gate/gateCourt.js PERIL_BEARINGS, PERIL_STEP_M, PERIL_REACH_M, PERIL_RIM_M, restated here so this law never
 *  loads the court's scene; test/world/eliteGates/egz_telegraph.test.js holds them equal) - and a blow's last moment (TELEGRAPH_NOW_MS). */
export const EG_PERIL = Object.freeze({ bearings: 24, step: 0.25, reach: 20, rim: 0.4, nowMs: TELEGRAPH_NOW_MS });
/** A CHECK's order, shown in place of the arrow when no light is in reach (section 25.5). */
export const EG_CHECK_ORDER = 'Stand in the light!';
/** Is (x, z) on a fight floor at height `y`, `inset` m inside its edges? Pure. */
export function egOnFloorAt(spec, x, z, y, inset = 0) {
  for (const f of spec?.fl ?? []) if ((f.y ?? 0) === y && holds(f, x, z, -inset)) return true;
  return false;
}
const inStamps = (b, x, z) => b.s.some((s) => s[0] !== 'a' && egInShape(s, x, z));
/**
 * THE PERIL ARROW (section 25.5): of `pending` (`[{ s, at, wu, nm, ch }]` - the blows and the place's told hazards, each its
 * stamps), the soonest still to land whose shape holds my feet `f` ([x, z], the hall's frame; `fy` their height) - never a
 * whole floor's (no step escapes it) - and its way out, searched over MY fight floor along EG_PERIL's bearings: a bearing
 * stops at a wall or an open edge (the floor's own edge, never crossed), its exit the first point out of the shape, and a
 * bearing that also clears every other pending shape is preferred over a nearer one that does not. Answers `{ name, t, now,
 * check, dir, m }` (`dir` [dx, dz] or null - no way out in reach; `check` a CHECK, its order shown with no way) or null:
 * nothing on me, or I stand on no fight floor (traversal ground: no blow lands there). THE ASCENT (Elite-Gates-Ascent.md
 * section 2): a blow that says its height lands on my feet only from my floor's storey (net/eliteGates/egWalkGraph.js egOneStorey) - one
 * on the floor over or under mine in plan is never the peril. Pure.
 */
export function egPerilOf(pending, f, fy, spec, now) {
  if (!f || !spec) return null;
  const fl = egFightFloorAt(spec, f[0], fy, f[1]);
  if (!fl) return null;
  let best = null;
  for (const b of pending ?? []) {
    if (!(now < b.at) || now < b.at - b.wu || !inStamps(b, f[0], f[1]) || !egOneStorey(fl.y ?? 0, Number.isFinite(b.y) ? b.y : NaN)) continue;
    if (!best || b.at < best.at) best = b;
  }
  if (!best) return null;
  const y0 = fl.y ?? 0, P = EG_PERIL, others = (pending ?? []).filter((b) => b !== best && now < b.at);
  let exit = null, clear = null;
  for (let k = 0; k < P.bearings; k++) {
    const a = (k / P.bearings) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    let out = false;
    for (let m = P.step; m <= P.reach + 1e-9; m += P.step) {
      if (clear && m >= clear.m) break;
      const x = f[0] + dx * m, z = f[1] + dz * m;
      if (!egOnFloorAt(spec, x, z, y0, P.rim)) break;   // a wall, an open edge: never crossed
      if (!out && !inStamps(best, x, z)) { out = true; if (!exit || m < exit.m) exit = { dx, dz, m }; }
      if (out && !inStamps(best, x, z) && !others.some((b) => inStamps(b, x, z))) { if (!clear || m < clear.m) clear = { dx, dz, m }; break; }
    }
  }
  const way = clear ?? exit;
  return { name: best.nm || '', t: best.wu > 0 ? clamp01((now - (best.at - best.wu)) / best.wu) : 1, now: best.at - now <= P.nowMs, check: !!best.ch || best.s.some((s) => s[0] === 'h'),
    dir: way ? [way.dx, way.dz] : null, m: way ? way.m : null };
}

// ── THE TETHERS' TWO GRAMMARS (section 25.5) ───────────────────────────────────────────────────────────────────
/** A tether's grammar by its kind (`tx[2]` - net/eliteGates/egLegion.js, net/eliteGates/egLords.js): 0 a Wraith's drain and 1 a Blood Tether pull
 *  apart, 2 Morvayn's Chaining stays close; the stay-close's slack and break (m), the pull-apart's width at rest and at the
 *  break (its share of itself), how far past the break's tick its lane runs (m), the chain's half width (m), and how near
 *  its break a pull-apart of mine must have stood to SNAP when it goes (its glass - the share of the break). */
export const EG_TETHER = Object.freeze({ slack: 6, taut: 8, half: 0.35, thin: 0.25, past: 0.6, chainHalf: 0.3, snap: 0.85 });
export const egTetherKind = (tx) => (tx?.[2] === 2 ? 'close' : 'pull');
/** A tether's break (m): a drain's packs its reach and its break (`r` x 100 + `brk`, net/eliteGates/egLegion.js), the rest carry cm. */
export const egTetherBreak = (tx) => (tx?.[2] === 0 ? tx[3] % 100 : (tx?.[3] ?? 0) / 100);
/**
 * A PULL-APART TETHER between `a` and `b` ([x, z]), breaking at `brk` m: the shape's numbers - its lane run along the pair
 * from the middle as far as the pair or the break's tick (whichever is further), `r` the line's own half (the pair's), `r1`
 * the break's half (the tick), `halfW` thinning to EG_TETHER.thin of itself as the pair nears the break. Pure.
 */
export function egPullLook(a, b, brk) {
  const dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz), ux = d > 1e-6 ? dx / d : 1, uz = d > 1e-6 ? dz / d : 0;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, half = Math.max(d / 2, brk / 2 + EG_TETHER.past);
  return { origin: [mx - ux * half, mz - uz * half], end: [mx + ux * half, mz + uz * half], r: d / 2, r1: brk / 2, d, halfW: EG_TETHER.half * (EG_TETHER.thin + (1 - EG_TETHER.thin) * clamp01(1 - d / Math.max(brk, 1e-3))) };
}
/** A STAY-CLOSE TETHER at `d` m: how taut (0 slack under 6 m, to 1 at 8 m - the shader's links brighten and throb with it)
 *  and its chip, *6.8/8 m*. Pure. */
export const egChainLook = (d) => ({ taut: clamp01((d - EG_TETHER.slack) / (EG_TETHER.taut - EG_TETHER.slack)), chip: `${d.toFixed(1)}/${EG_TETHER.taut} m` });
/** The words under the crosshair while I am chained (section 25.5). */
export const egChainWords = (name, d) => `Chained to ${name || 'another'} - ${egChainLook(d).chip}`;

// ── A SPIRE POOL (section 25.2) ────────────────────────────────────────────────────────────────────────────────
/** Which of each band's ramps its pools take (world/eliteGates/egBandArt.js EG_BAND_RAMPS - the fire-sea's, the Cairn's slate violet,
 *  the Shade's quicksilver, the Wellhead's molten), the step, and how far it is darkened. */
export const EG_POOL_RAMP = Object.freeze(['liquid', 'stone', 'liquid', 'liquid']);
export const EG_POOL_STEP = 2;
export const EG_POOL_DARK = 0.5;
/** Band `band`'s pool colour (display rgb 0-1): its ramp's step, darkened - never POOL_COLOR, never blue. Pure. */
export function egPoolRgb(band) {
  const b = Math.max(0, Math.min(3, band | 0)), c = EG_BAND_RAMPS[b][EG_POOL_RAMP[b]][EG_POOL_STEP];
  return [(c[0] / 255) * EG_POOL_DARK, (c[1] / 255) * EG_POOL_DARK, (c[2] / 255) * EG_POOL_DARK];
}

// ── THE ECLIPSE (section 25.5) ─────────────────────────────────────────────────────────────────────────────────
/** The Eclipse's look: the darkening's last seconds, the wind's, how deep it darkens; its wind and its toll (Daggerfall's
 *  own records - systems/soundClips.js AmbientWindBlow1, and the bell ui/eliteGates/egBeats.js EG_BEAT_SOUNDS.toll plays). */
export const EG_ECLIPSE_LOOK = Object.freeze({ dark: 2, wind: 3, deep: 0.62, windSound: Object.freeze({ rec: 70, vol: 0.9, pitch: 0.8 }), tollSound: Object.freeze({ rec: 107, vol: 1, pitch: 0.75 }) });
/** Hall `spec`'s Eclipse at `t` (the shared clock, s): `{ secs, live, havens, r, key }` while it is told or striking, else
 *  null. Pure. */
export function egEclipseAt(spec, t) {
  for (const hz of spec?.hazards ?? []) {
    if (hz.kind !== 'eclipse') continue;
    for (const p of egHazardParts(hz, t)) {
      const havens = [];
      for (let k = 1; k + 2 < p.sh.length; k += 3) havens.push([p.sh[k], p.sh[k + 1]]);
      return { secs: p.st === 'tell' ? (1 - p.k) * (EG_HAZARDS.eclipse.tell / 1000) : 0, live: p.st === 'live', havens, r: EG_HAZARDS.eclipse.r, key: p.key };
    }
  }
  return null;
}
/** EG-PERFECT (sections 13.4 and 25.5): A LORD'S OWN ECLIPSE (Seyth's - net/eliteGates/egLords.js, the haven CHECK named 'The Eclipse'
 *  she throws every 40 s on the Vault's ground) read as the Vault's place hazard is (egEclipseAt's shape), from the fight's blows
 *  at `ms` (relay ms): told from its word to its landing, live for EG_ECLIPSE_BLOW_LIVE_MS - so it has the chip, the dark, the wind
 *  and the toll the place's has (it had none: only the havens drawn). Null when none stands. Pure. */
export const EG_ECLIPSE_BLOW_LIVE_MS = 600;
export function egEclipseOfBlows(blows, ms) {
  for (const b of blows ?? []) {
    const s = b?.s?.[0];
    if (!b.ch || b.nm !== EG_ECLIPSE_NM || b.cut || s?.[0] !== 'h' || ms < b.at - b.wu || ms >= b.at + EG_ECLIPSE_BLOW_LIVE_MS) continue;
    const havens = [];
    for (let k = 1; k + 2 < s.length; k += 3) havens.push([s[k], s[k + 1]]);
    return { secs: Math.max(0, (b.at - ms) / 1000), live: ms >= b.at, havens, r: s[3] ?? EG_HAZARDS.eclipse.r, key: `b${b.i}` };
  }
  return null;
}
/** The bar's chip, *The Eclipse - 5*, while it is told; nothing else. Pure. */
export const egEclipseChip = (e) => (e && !e.live ? `The Eclipse - ${Math.max(1, Math.ceil(e.secs - 1e-9))}` : '');
/** How dark the floor is (0-1): from its last 2 s to the strike, the havens kept. Pure. */
export const egEclipseDark = (e) => (!e ? 0 : e.live ? 1 : clamp01(1 - e.secs / EG_ECLIPSE_LOOK.dark));

// ── THE MARKS OVER HEADS (sections 13.2 and 25.5) ──────────────────────────────────────────────────────────────
/** Each mark's sigil (net/eliteGates/egLords.js egMark's kinds; ui/eliteGates/egHud.js EG_MARK_NAMES): a hound's tooth (the Scent), a gem with its
 *  seconds (a soul-mark), a flame and a snowflake (Fire- and Frost-touched, their rims tinted), a chain, a cage, the
 *  challenge's ring, an eye (hunted), a knot (bound) - each its own shape, Dagon red. */
export const EG_SIGILS = Object.freeze(['tooth', 'gem', 'flame', 'flake', 'chain', 'cage', 'ring', 'eye', 'knot']);
/** The tinted rims (Fire-touched's fire, Frost-touched's frost - scenes/eliteGates/egFight.js's elements' colours). */
export const EG_SIGIL_RIM = Object.freeze({ 2: Object.freeze([1.0, 0.45, 0.1]), 3: Object.freeze([0.62, 0.78, 0.82]) });
/** How far over a member's eye their sigils hang (m - over the head, never on it). */
export const EG_SIGIL_UP_M = 0.6;
/** Member `sub`'s live marks at `now` (`F.mk`'s `[sub, kind, until, n]`): `[{ k, sigil, secs, n, rim }]`, by kind. Pure. */
export function egSigilsOf(mk, sub, now) {
  const out = [];
  for (const m of mk ?? []) if (m[0] === sub && m[2] > now && EG_SIGILS[m[1]]) out.push({ k: m[1], sigil: EG_SIGILS[m[1]], secs: Math.ceil((m[2] - now) / 1000), n: m[3] | 0, rim: EG_SIGIL_RIM[m[1]] ?? null });
  return out.sort((a, b) => a.k - b.k);
}
/** Where point `p` (the scene's frame) stands on the screen under the view-projection `vp` (column-major): [x, y] in 0..1
 *  (y down), or null behind the eye or off the screen. Pure. */
export function egScreenAt(vp, p) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12], y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13], w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (!(w > 1e-3)) return null;
  const sx = 0.5 + (0.5 * x) / w, sy = 0.5 - (0.5 * y) / w;
  return sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1 ? [sx, sy] : null;
}
/** The camera's yaw (the port's: ahead [sin, cos] - scenes/gate/gateCourt.js screenBearing's) read off a view matrix
 *  (world/mat4.js lookAt's: the eye looks down its -z). Pure. */
export const egViewYaw = (view) => Math.atan2(-view[2], -view[10]);

// ── A VESTIGE AURA (sections 15 and 25.4) ──────────────────────────────────────────────────────────────────────
/** A Vestige aura's ring: its radius (m) and its Battlemage blue (the Galleries' accent ramp's [92, 124, 196]). */
export const EG_AURA_RING = Object.freeze({ r: 0.6, color: Object.freeze([92 / 255, 124 / 255, 196 / 255]) });
const AURA_IDS = new Set(EG_VESTIGES.filter((v) => /** @type {any} */ (v).aura > 0).map((v) => v.id));   // the table's own field (its type names it not)
/** Who of the company holds an aura Vestige (net/eliteGates/egVestige.js's with `aura` - Bastion, the Spire's Standard): their subs,
 *  from the room's runs (`E.ms`). Pure. */
export const egAuraHolders = (E) => (E?.ms ?? []).filter((r) => (r[6] ?? []).some((v) => AURA_IDS.has(v[0]))).map((r) => r[0]);

// ── READABLE IN THE DARK (section 25.6) ────────────────────────────────────────────────────────────────────────
/** THE SHADE'S RIM LIGHT: the band it burns in, and the outline - moon-silver (the Shade's metal ramp, [187, 193, 202]),
 *  as a glint (systems/hitFlash.js setBatchGlint's [r, g, b, strength]: the sprite's outline, the body lifted a little
 *  toward it). */
export const EG_SHADE_BAND = 2;
export const EG_SHADE_RIM = Object.freeze([187 / 255, 193 / 255, 202 / 255, 0.3]);
/** EG-PERFECT (section 13.3, the Last Armsmaster's Riposte: "The tell: his blade raised, glinting"): A LORD'S GUARD - the 0.6 s
 *  after it rises (`lit`, net/eliteGates/egLords.js's Guard), in which a blow landed on him is answered by the Riposte - glints
 *  white-gold over the whole sprite on every screen, brighter than the Shade's rim (the relay set the flag and no screen read it:
 *  the Riposte was a punish nobody could see coming), with its ring (EG_GUARD_SOUND - Parry6, systems/soundClips.js). */
export const EG_GUARD_GLINT = Object.freeze([1, 0.92, 0.7, 0.75]);
export const EG_GUARD_SOUND = Object.freeze({ rec: 433, vol: 1, pitch: 1.2 });
/** EG-PERFECT (section 13.3, the Mother of Dusk's Wingbeat, "told 1 s"): A GUST TOLD - for the second before a glade-wide gust
 *  lands (`egust`'s `at`), a lane from the member's feet the way it will push them and as far (its speed x its time), pulsing, and
 *  the Steps' breath rising once (AmbientWindMoanDeep, systems/soundClips.js) - the gust came with no word before. */
export const EG_GUST_TELL_MS = 1000;
export const EG_GUST_SOUND = Object.freeze({ rec: 66, vol: 0.9, pitch: 1.1 });
/** A body's rim light: every foe's in the Shade (never a friend's), the dormant Lurker aside (section 12); null elsewhere.
 *  EG-PERFECT: a guard raised glints over it (EG_GUARD_GLINT), in every band. Pure. */
export const egRimOf = (band, fl, lord = true) => ((fl & EG_FL.lit) !== 0 && lord ? EG_GUARD_GLINT : band === EG_SHADE_BAND && (fl & (EG_FL.dormant | EG_FL.friend)) === 0 ? EG_SHADE_RIM : null);   // (THE AUDIT: `lord` - a Binder's raise is lit too, and no guard)

// ── WEIGHT (section 25.8) ──────────────────────────────────────────────────────────────────────────────────────
/** THE HEAVY BLOWS' SHAKES: by name (net/eliteGates/egLords.js's Savage, Gore, Whirl and Maul, net/eliteGates/egLegion.js's Smash), the shake at
 *  nought metres and the reach it fades to nothing over - the gate's LAND_SHAKE law (world/gate/gateBoss.js landShake), within
 *  8-10 m, under the player's own maxShake (systems/betterAmbience.js weaponKick). */
export const EG_HEAVY_SHAKE = Object.freeze({ Savage: Object.freeze([2.5, 10]), Gore: Object.freeze([3, 10]), Whirl: Object.freeze([2.5, 10]), Smash: Object.freeze([2, 8]), Maul: Object.freeze([2.5, 8]) });
/** How far (x, z) stands from where stamp `s` lands (its centre, a lane's line; nought for the whole floor's). */
const stampDist = (s, x, z) => (s[0] === 'l' ? segDist(x, z, s[1], s[2], s[3], s[4]) : s[0] === 'a' || s[0] === 'h' ? 0 : Math.hypot(x - s[1], z - s[2]));
/** The shake a heavy blow's landing gives feet at (x, z) - its nearest stamp - times `motion` (egShakeMotion). Pure. */
export function egHeavyShake(blow, x, z, motion = 1) {
  const w = EG_HEAVY_SHAKE[blow?.nm];
  if (!w || !(motion > 0)) return 0;
  let d = Infinity;
  for (const s of blow.s ?? []) d = Math.min(d, stampDist(s, x, z));
  return w[0] * Math.max(0, 1 - d / w[1]) * Math.min(1, motion);
}
/** How much the screen may move: nothing under reduced motion (the shelf's row or the system's - ui/eliteGates/egAccess.js
 *  egReducedMotion), else the port's own Technique camera motion (0-1, systems/uiPrefs.js techniqueMotion - read as
 *  combat/technique/techniqueFx.js techniqueMotion reads it). Pure. */
export const egShakeMotion = (still, technique) => { if (still) return 0; const v = Number(technique); return Number.isFinite(v) ? clamp01(v) : 1; };
/** An hp drop this soon after my own blow on a body is my blow's own word back (the relay's `ehp`), never an ally's. */
export const EG_MINE_ECHO_MS = 400;
/**
 * A body's hit flash at `t` (section 25.8 - WB13d's decision kept, no hit-stop): my own blow flashes it fully, anyone
 * else's (an ally's, the relay's word of a drop I did not strike) at 0.4 - the gate's own law (world/gate/gateBoss.js
 * gateHitFlash, GATE_FLASH_COURT); a fallen body none. `b.mineAt` my last blow's moment, `b.hurtAt` the last drop's. Pure.
 */
export function egBodyFlash(b, t) {
  if (!b || b.fellAt) return 0;
  const mine = b.mineAt ?? -Infinity, hurt = b.hurtAt ?? -Infinity;
  return gateHitFlash(mine, hurt >= mine && hurt - mine <= EG_MINE_ECHO_MS ? -Infinity : hurt, t);
}
/** A DROP'S LANDING (section 25.8): a landing counts from this far over a Drop's top (m), as far as its fall and a hop
 *  over it; the dust thrown out across its landing (m, ms); the thud - Daggerfall's own records, layered and pitched down
 *  (systems/soundClips.js BodyFall and DungeonDoorClose) - never DFU's hard-landing grunt (FallHard). */
export const EG_DROP_THUD = Object.freeze({ min: 1, over: 6, r0: 0.6, r1: 3.2, ms: 700,
  sounds: Object.freeze([Object.freeze({ rec: 15, vol: 1, pitch: 0.6 }), Object.freeze({ rec: 24, vol: 0.55, pitch: 0.5 })]) });
/** The Drop (`spec.steps` kind `drop`) whose landing lies under feet at (x, y, z) (the hall's frame), at most
 *  EG_DROP_THUD.over over its top - or null. Pure. */
export function egDropUnder(spec, x, y, z) {
  for (const s of spec?.steps ?? []) if (s.kind === 'drop' && Math.abs(x - s.x) <= s.w / 2 && Math.abs(z - s.z) <= s.d / 2 && y >= s.y - 0.3 && y - s.y <= EG_DROP_THUD.over) return s;
  return null;
}
/** Am I falling onto a Drop the course asked for - over its landing by EG_DROP_THUD.min or more? Pure. */
export const egOverDrop = (spec, x, y, z) => { const s = egDropUnder(spec, x, y, z); return !!s && y - s.y >= EG_DROP_THUD.min; };
