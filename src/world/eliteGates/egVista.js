// @ts-check
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 4,
// with section 1's wreck a band): THE WRECK - the depth of the place. Every hall is a piece of the Battlemages' academy torn
// off and falling; round it the rest of the academy drifts in the haze, and far overhead the sealed Spire hangs:
//   THE WINGS - each band's torn wings (world/eliteGates/egKit.js EG_KIT_STYLE `wreck`), each a recognisable silhouette at 120-450 m
//     in the fog, its torn foundations hanging under it (the found record's strata, the Hour's islandRoot law - world/
//     sdIslandModel.js - a cake cut through, its tips in the haze):
//       THE BROKEN GALLERIES - a domed rotunda broken in half (gold-leaf capitals, its dome's gilt drum), a bell tower
//         leaning with its bell still in the belfry, a long arcade torn off at one end, a spiral stair hanging in the air
//         with its gilt rail - all marble;
//       THE SOUL CAIRN - a floating mausoleum hung with chains among its sarcophagi, a crypt's facade with nothing behind
//         its door, giant soul-gem crystals in the mist (the band's own light - the crystal record), broken columns
//         half-sunk in it;
//       THE SHADE PERILOUS - towers wrapped in black-glass thorns, great black-glass shards turning slowly, a broken
//         observatory with its glass still raised through the split dome;
//       THE HAVOC WELLHEAD - siege towers with their bridges down and a fire basket on top, a broken war-gate with its
//         portcullis half down, floating basalt crags with forges glowing in them (the fixture record - its flame the
//         one light, capped by the band's art).
//     Placed on a table (EG_VISTA_PLACES; each band's forms, sizes and leans EG_VISTA_WINGS) about the hall's centre - out
//     of the neighbouring halls (EG_HALL_PITCH apart along x), 120-450 m out, 30-160 m above or below the floors, never in
//     the cone from a floor to the door or the Court's lord (about a Court its side wings sink below its floors - `court`),
//     never past the dungeon arm's far plane from anywhere in the hall (test/world/eliteGates/eglook_wreck.test.js holds every one against
//     the halls themselves) - and turning about their own axes, a turn in four to six minutes (`spin`, rad/s, on the shared
//     clock - scenes/eliteGates/egWreckLook.js); the phones' four still.
//   THE SEALED SPIRE OVERHEAD (`under`) - world/eliteGates/egUndersideModel.js's model, the torn academy the halls fell from, laid in
//     the kit's far stone and foundations (EG_VISTA_UNDER_DRESS), hung at the band's angular size (EG_VISTA_UNDER - the
//     sky's own numbers, world/eliteGates/egLook.js EG_SKIES: smaller each band) leaning toward the course, lit from below by the
//     realm (the trilight's ground). It hangs at a sky's distance from the EYE, not the hall: no step of the eye moves it
//     against the sky (the wings' parallax is the depth; its stillness is the distance), and from wherever the eye stands
//     it is inside the far plane. One underside: the sky paints none (render/eliteGates/egSkyMap.js).
// Records (the kit's, under the band's archive - meshKit pack(egBandArchive(band))), worn as the art's own table says
// (world/eliteGates/egBandArt.js EG_KIT_MAP): the far stone (`wreck` 69, sixteen metres a picture, v up), the foundations (`found` 68,
// the Hour's root mapping, v down its whole depth), the band's crystal (`crystal` 70 round the gem and up it: the Cairn's
// soul-gems lit, the Shade's black glass, the Wellhead's basalt prisms their seams lit), the Cairn's chains (`chain` 81) and
// the fixture (`fixture` 67: its flame cells the forges' and the fire baskets' fire, cut out and lit; its grille a
// basket's bars; one texel of its body every face of the band's metal - the gilt, the silver, the iron). At most four a
// band, so the wings batch into four draws and the underside two (scenes/eliteGates/egWreckLook.js): six, the page's cost (section 10).
//
// Built once a band - in the swap's worker with the band's dress (world/eliteGates/egCircleParts.js egCircleBuild), or on the main
// thread at a stand - so it is pure: no DOM, no GL, and nothing past the mesh kit, the band's archive, the kit's table and
// the underside's model (never the stair's clock - world/eliteGates/egUnderside.js). Seeded: the same bytes every build.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { createMeshKit, meshKitBounds } from './meshKit.js';
import { rng } from '../superDungeon/sdPixelKit.js';
import { egBandArchive, EG_KIT_MAP } from './egBandArt.js';
import { EG_KIT_RECORD } from './egKit.js';
import { buildEgUndersideModel, EG_UNDERSIDE } from './egUndersideModel.js';

const TAU = Math.PI * 2;
const K = EG_KIT_RECORD;

/** THE WRECK'S RECORDS (the kit's - world/eliteGates/egKit.js EG_KIT_RECORD - in the band's archive): the far stone, the foundations'
 *  strata, the band's crystal (the Cairn's soul-gems, the Shade's black glass, the Wellhead's basalt prisms), the band's
 *  chains (the Cairn's tombs hang on them) and the fixture - its flame the forges' and the fire baskets', its body the
 *  band's metal (the Galleries' gilt, the Shade's silver, the Wellhead's iron: EG_VISTA_METAL). */
export const EG_VISTA_RECORD = Object.freeze({ stone: K.wreck, found: K.found, glass: K.crystal, chain: K.chain, fire: K.fixture });
/** How many metres a picture spans on the wings: the far stone at the art's own far law (world/eliteGates/egBandArt.js EG_KIT_MAP -
 *  four texels a metre, a texel about a pixel at 300 m with no mips, two bays and two storeys a repeat, v up); the crystal
 *  round the gem and up it (EG_KIT_MAP's way) at 8 m, not its 2 - a facet one to two metres wide, never finer than the haze
 *  resolves at 120 m.
 *  @type {Readonly<{ stone: number, glass: number }>} */
export const EG_VISTA_UV = Object.freeze({ stone: EG_KIT_MAP[K.wreck].mU, glass: 8 });
/** THE BAND'S METAL on the wings, a band: the one texel of the fixture's body (EG_KIT_MAP's `body` band, v down from its
 *  top) each metal face wears whole - the Galleries' gilt row, the Cairn's bone, the Shade's silver facet, the Wellhead's
 *  iron - so a capital, a bell, a rail, a band or a spike is the band's metal at any distance, never a picture's detail
 *  shimmering. */
export const EG_VISTA_METAL = Object.freeze([[2.5, 38.5], [2.5, 39.5], [1.5, 37.5], [10.5, 36.5]].map(([x, y]) => Object.freeze([x / 64, y / 64])));
/** The fixture's flame (the forges' fire): its band of v (from the picture's top - its tips up) and its cells across u. */
const FLAME = Object.freeze({ v: EG_KIT_MAP[K.fixture].bands.flame, cells: EG_KIT_MAP[K.fixture].cells });
/** The fixture's grille (a basket's bars, cut out between): its band of v. */
const GRILLE = EG_KIT_MAP[K.fixture].bands.grille;
/** A foundation's strata: its broken tips at least this far into the haze (world/superDungeon/sdIslandModel.js SD_SPIRE.haze's law). */
export const EG_VISTA_HAZE = 0.84;
/** THE SEALED SPIRE OVERHEAD, a band: its angular radius (rad) and its lean from the zenith toward the course (+z) - the
 *  sky's own numbers (world/eliteGates/egLook.js EG_SKIES `underside` and `lean`, held equal by test/world/eliteGates/eglook_wreck.test.js; smaller each
 *  band as the halls fall further down the legions' road) - and how far its torn floor hangs from the eye (m): near enough
 *  that the band's haze leaves four tenths of it (world/eliteGates/egAtmos.js's fog), a dark mass over the haze with its ledges lit
 *  from below, never past the far plane - and, hanging from the eye, at the same angle from everywhere in the hall. */
export const EG_VISTA_UNDER = Object.freeze([
  Object.freeze({ radius: 0.34, lean: 0.18, d: 170 }),
  Object.freeze({ radius: 0.22, lean: 0.24, d: 120 }),
  Object.freeze({ radius: 0.13, lean: 0.3, d: 150 }),
  Object.freeze({ radius: 0.07, lean: 0.36, d: 100 }),
]);
/** The underside's parts in the kit's records (world/eliteGates/egUndersideModel.js EG_UNDERSIDE_DRESS's shape): its rock and spires
 *  the foundations' strata, its floor, galleries, colonnade and girders the far stone - two draws. */
export const EG_VISTA_UNDER_DRESS = Object.freeze({ floor: K.wreck, metal: K.wreck, rock: K.found, stone: K.wreck });
/**
 * THE WINGS' PLACES (the hall's frame about its centre: x across the course, y up from its floors, z along it - a band's
 * table takes them in order): each its bearing (degrees from +z toward +x), its distance out (m, level, before the band's
 * reach - EG_VISTA_REACH), its height (m - the wing's middle) and its height about a Court hall (null: the same). Four
 * kinds of place: beside the course at the horizon, where a trial's haze shows them from the plates and the spans
 * (about a Court they sink below its floors, out of the lord's sky - the Court's rim sees its lord against nothing); low
 * in the deep in every bearing, ahead past the door too (the door's cone climbs from the floors, never down); high to the
 * sides, under the Spire's underside; the farthest low, receding into the haze. The first four the phones' (lite).
 */
export const EG_VISTA_PLACES = Object.freeze([
  [76, 175, 40, -104], [-95, 178, 40, -108], [16, 235, -112, null], [80, 150, 150, null],
  [118, 205, 44, -112], [-122, 195, 40, -110], [-26, 265, -118, null], [150, 215, -94, null],
  [-146, 235, -100, null], [-96, 165, 155, null], [37, 300, -156, null], [-158, 300, -150, null],
].map(([bearing, d, h, court]) => Object.freeze({ bearing, d, h, court })));
/** How far each band's haze lets its wings stand (a share of EG_VISTA_PLACES' distances): the Wellhead's smoke the
 *  nearest, so every band's farthest wing still shows through its fog (world/eliteGates/egAtmos.js). */
export const EG_VISTA_REACH = Object.freeze([1, 0.85, 0.95, 0.8]);
/**
 * EACH BAND'S WINGS, in EG_VISTA_PLACES' order (section 1's wreck - world/eliteGates/egKit.js EG_KIT_STYLE `wreck`): its form, its
 * size (the far ones built larger, so the haze has something to swallow) and its lean (rad). Each turns a whole turn in
 * four to six minutes, every other one the other way (egVistaTurn), from a heading its seed draws.
 */
export const EG_VISTA_WINGS = Object.freeze(/** @type {Array<Array<[string, number, number]>>} */ ([
  [['rotunda', 1.4, 0.06], ['belltower', 1.45, 0.24], ['arcade', 1.75, 0.05], ['spiral', 1.15, 0.12], ['arcade', 1.3, 0.04], ['rotunda', 1.2, 0.1],
    ['spiral', 1.75, 0.16], ['belltower', 1.5, -0.26], ['rotunda', 1.8, 0.08], ['arcade', 1.2, 0.06], ['belltower', 1.55, 0.2], ['belltower', 1.6, -0.12]],
  [['tomb', 1.45, 0.08], ['crypt', 1.4, 0.05], ['gem', 1.75, 0.16], ['gem', 1.2, 0.2], ['sunken', 1.35, 0.06], ['tomb', 1.2, 0.1],
    ['sunken', 1.85, 0.08], ['crypt', 1.45, -0.06], ['tomb', 1.75, 0.12], ['gem', 1.4, 0.14], ['crypt', 1.9, 0.05], ['sunken', 1.9, 0.07]],
  [['thorntower', 1.4, 0.08], ['observatory', 1.4, 0.06], ['shard', 1.7, 0.3], ['shard', 1.2, 0.4], ['thorntower', 1.25, -0.1], ['observatory', 1.2, 0.08],
    ['shard', 1.8, 0.5], ['thorntower', 1.5, 0.12], ['observatory', 1.7, 0.05], ['shard', 1.4, 0.35], ['thorntower', 1.5, -0.08], ['shard', 1.8, 0.25]],
  [['siegetower', 1.4, 0.1], ['wargate', 1.4, 0.05], ['crag', 1.7, 0.12], ['crag', 1.2, 0.1], ['siegetower', 1.25, -0.14], ['crag', 1.3, 0.08],
    ['wargate', 1.7, 0.06], ['crag', 1.5, 0.1], ['siegetower', 1.7, 0.12], ['crag', 1.2, 0.14], ['wargate', 1.8, 0.05], ['crag', 1.9, 0.1]],
]).map((band) => Object.freeze(band.map(([kind, size, tilt]) => Object.freeze({ kind, size, tilt })))));
/** Wing `i`'s turn (rad/s): a whole turn in four to six minutes, every other one the other way. */
export const egVistaTurn = (i) => ((i % 2 ? -1 : 1) * TAU) / (240 + 30 * ((i * 3) % 5));
/** The phones' tier: this many wings (the table's first), and none turns. */
export const EG_VISTA_LITE = 4;
/** THE WRECK'S COST, a band (Elite-Gates-Look.md section 4 and 10): its triangles (the wings and the underside), a wing's
 *  own (the page's 200-1,500), and its draws - the wings' records and the underside's. */
export const EG_VISTA_BUDGET = Object.freeze({ tris: 8000, wing: Object.freeze([200, 1500]), draws: 6 });

// ── the shapes ─────────────────────────────────────────────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const mix = (a, b, t) => a + (b - a) * t;
/** A face's uv, planar in metres over `m` a picture: a level face by its plan, a wall along its level tangent and up. */
function planar(p, n, m) {
  if (Math.abs(n[1]) > 0.7) return [p[0] / m, p[2] / m];
  const t = unit([n[2], 0, -n[0]]);
  return [(p[0] * t[0] + p[2] * t[2]) / m, p[1] / m];
}
/** A convex face `pts` fanned from its first corner, wound to face `out` (a direction), its uv planar. */
function face(kit, rec, pts, out, m = EG_VISTA_UV.stone) {
  const n = unit(out), uv = pts.map((p) => planar(p, n, m));
  for (let k = 1; k + 1 < pts.length; k++) kit.tri(rec, pts[0], pts[k], pts[k + 1], out, true, uv[0], uv[k], uv[k + 1]);
}
/** `n` corners of an ellipse (rx, rz) about (cx, cz) from bearing a0, each pushed out or in by up to `jit` of its radius. */
function ringOf(n, rx, { rz = rx, cx = 0, cz = 0, a0 = 0, jit = 0, rnd = null } = {}) {
  const out = [];
  for (let k = 0; k < n; k++) { const a = a0 + (k / n) * TAU, j = jit && rnd ? 1 + jit * (2 * rnd() - 1) : 1; out.push([cx + Math.cos(a) * rx * j, cz + Math.sin(a) * rz * j]); }
  return out;
}
/** A SLAB: polygon `poly` ([[x, z]], star-shaped about its middle) stood from y0 to y1 - its sides out; its top fanned
 *  from its middle (or from its first corner when `convex`), its underside when `under`. */
function slab(kit, rec, poly, y0, y1, { top = true, under = false, convex = false, m = EG_VISTA_UV.stone } = {}) {
  const n = poly.length, cx = poly.reduce((s, p) => s + p[0], 0) / n, cz = poly.reduce((s, p) => s + p[1], 0) / n;
  let along = 0;
  for (let k = 0; k < n; k++) {
    const p = poly[k], q = poly[(k + 1) % n], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    kit.quad(rec, [p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], [(p[0] + q[0]) / 2 - cx, 0, (p[1] + q[1]) / 2 - cz], true,
      [[along / m, y0 / m], [(along + len) / m, y0 / m], [(along + len) / m, y1 / m], [along / m, y1 / m]]);
    along += len;
  }
  const cap = (y, up) => {
    const P = (p) => [p[0], y, p[1]];
    if (convex) { face(kit, rec, poly.map(P), [0, up, 0], m); return; }
    for (let k = 0; k < n; k++) face(kit, rec, [[cx, y, cz], P(poly[k]), P(poly[(k + 1) % n])], [0, up, 0], m);
  };
  if (top) cap(y1, 1);
  if (under) cap(y0, -1);
}
/**
 * A SHAFT standing on y: a column, a newel, a tower - `sides` round about (x, z) from y0 to y1, its radius r0 at its foot
 * and r1 at its head (from bearing a0 - four sides at a0 = pi/4 a square). `cut` breaks its head (m off the top at the
 * most, falling toward bearing `cutA`, jagged by `rnd`) and closes it; a whole head is closed when `cap`.
 */
function shaft(kit, rec, x, z, y0, y1, r0, r1, sides, { cut = 0, cutA = 0, rnd = null, cap = true, a0 = 0, m = EG_VISTA_UV.stone } = {}) {
  const top = [], bot = [];
  for (let k = 0; k < sides; k++) {
    const a = a0 + (k / sides) * TAU, c = Math.cos(a), s = Math.sin(a);
    const drop = cut > 0 ? cut * (0.5 + 0.5 * Math.cos(a - cutA)) * (0.5 + 0.5 * (rnd ? rnd() : 1)) : 0;
    bot.push([x + c * r0, y0, z + s * r0]); top.push([x + c * r1, y1 - drop, z + s * r1]);
  }
  const circ = TAU * Math.max(r0, r1), axis = [x, (y0 + y1) / 2, z];
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides, u0 = (circ * k) / sides / m, u1 = (circ * (k + 1)) / sides / m;
    kit.quad(rec, bot[k], bot[k1], top[k1], top[k], axis, false, [[u0, y0 / m], [u1, y0 / m], [u1, top[k1][1] / m], [u0, top[k][1] / m]]);
  }
  if (cut > 0 || cap) {
    const ctr = [x, top.reduce((s, p) => s + p[1], 0) / sides - cut * 0.15, z];   // a broken head dips at its heart
    for (let k = 0; k < sides; k++) face(kit, rec, [ctr, top[k], top[(k + 1) % sides]], [0, 1, 0], m);
  }
}
/** A TUBE from `a` to `b` (any way but straight up - a fallen drum, a telescope, a beam): `sides` round, its radius r0
 *  at a and r1 at b, its ends closed when `caps`. */
function tube(kit, rec, a, b, r0, r1, sides, { caps = true, m = EG_VISTA_UV.stone } = {}) {
  const d = unit(sub(b, a)), side = unit(Math.abs(d[1]) > 0.95 ? cross(d, [1, 0, 0]) : cross(d, [0, 1, 0])), up = cross(side, d);
  const ring = (o, r) => Array.from({ length: sides }, (_, k) => { const t = (k / sides) * TAU, c = Math.cos(t) * r, s = Math.sin(t) * r; return [o[0] + side[0] * c + up[0] * s, o[1] + side[1] * c + up[1] * s, o[2] + side[2] * c + up[2] * s]; });
  const A = ring(a, r0), B = ring(b, r1), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], len = Math.hypot(...sub(b, a)), circ = TAU * Math.max(r0, r1);
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides, u0 = (circ * k) / sides / m, u1 = (circ * (k + 1)) / sides / m;
    kit.quad(rec, A[k], A[k1], B[k1], B[k], mid, false, [[u0, 0], [u1, 0], [u1, len / m], [u0, len / m]]);
  }
  if (caps) { face(kit, rec, A, [-d[0], -d[1], -d[2]], m); face(kit, rec, B, d, m); }
}
/** A SPIKE: a pyramid from ring `base` (its corners in order) to `tip`, its faces out; its base closed when `closed`. A
 *  facet's picture whole (a thorn's, a crystal's). */
function spike(kit, rec, base, tip, { closed = false, m = EG_VISTA_UV.stone } = {}) {
  const n = base.length, c = [0, 1, 2].map((i) => base.reduce((s, p) => s + p[i], 0) / n), inside = [0, 1, 2].map((i) => c[i] + (tip[i] - c[i]) * 0.25);
  const per = base.reduce((s, p, k) => s + len3(sub(base[(k + 1) % n], p)), 0), L = len3(sub(tip, c)) / m, u = (k) => (k / n) * (per / m);   // round its base, up to its tip
  for (let k = 0; k < n; k++) kit.tri(rec, base[k], base[(k + 1) % n], tip, inside, false, [u(k), 0], [u(k + 1), 0], [u(k + 0.5), L]);
  if (closed) for (let k = 1; k + 1 < n; k++) kit.tri(rec, base[0], base[k], base[k + 1], inside, false, [u(0), 0], [u(k), 0], [u(k + 1), 0]);
}
/**
 * A GEM: a crystal, a shard - a bipyramid about `c` along `axis`, its belt `sides` round (rx across, rz deep - a blade
 * when they differ), each corner jittered by `jit`, its tips `lo` below and `hi` above the belt (a little off the axis).
 */
function gem(kit, rec, c, axis, lo, hi, rx, sides, rnd, { rz = rx, jit = 0.2, twist = 0, m = EG_VISTA_UV.glass } = {}) {
  const d = unit(axis), side = unit(Math.abs(d[1]) > 0.95 ? cross(d, [1, 0, 0]) : cross(d, [0, 1, 0])), up = cross(side, d);
  const off = () => (rnd() - 0.5) * rx * 0.5;
  const at = (s, u, v) => [c[0] + d[0] * s + side[0] * u + up[0] * v, c[1] + d[1] * s + side[1] * u + up[1] * v, c[2] + d[2] * s + side[2] * u + up[2] * v];
  const belt = Array.from({ length: sides }, (_, k) => { const t = twist + (k / sides) * TAU, j = 1 + jit * (2 * rnd() - 1); return at((rnd() - 0.5) * rx * 0.4, Math.cos(t) * rx * j, Math.sin(t) * rz * j); });
  const top = at(hi, off(), off()), bot = at(-lo, off(), off());
  const U = (k) => (k / sides) * ((Math.PI * (rx + rz)) / m), vb = lo / m, vt = (lo + hi) / m;   // round the gem, along it from its lower tip
  for (let k = 0; k < sides; k++) {
    const p = belt[k], q = belt[(k + 1) % sides];
    kit.tri(rec, p, q, top, c, false, [U(k), vb], [U(k + 1), vb], [U(k + 0.5), vt]);
    kit.tri(rec, q, p, bot, c, false, [U(k + 1), vb], [U(k), vb], [U(k + 0.5), 0]);
  }
}
/** A CHAIN hanging from `a` to `b`: two crossed strips of the band's links, each seen from both sides. */
function hang(kit, rec, a, b, w) {
  const d = unit(sub(b, a)), len = Math.hypot(...sub(b, a)), uvs = [[0, 0], [1, 0], [1, len / w], [0, len / w]];
  for (const s of [unit(cross(d, [1, 0, 0])), unit(cross(d, [0, 0, 1]))]) {
    const h = [s[0] * w / 2, s[1] * w / 2, s[2] * w / 2], q = [[a[0] - h[0], a[1] - h[1], a[2] - h[2]], [a[0] + h[0], a[1] + h[1], a[2] + h[2]], [b[0] + h[0], b[1] + h[1], b[2] + h[2]], [b[0] - h[0], b[1] - h[1], b[2] - h[2]]];
    const n = cross(s, d);
    kit.quad(rec, q[0], q[1], q[2], q[3], n, true, uvs);
    kit.quad(rec, q[0], q[1], q[2], q[3], [-n[0], -n[1], -n[2]], true, uvs);
  }
}
/** A FLAME standing on `base` (`w` wide, `h` tall): two crossed quads, each seen from both sides, wearing the fixture's
 *  flame cell `cell` (EG_KIT_MAP: its tips at the band's top, cut out round them, lit). */
function flame(kit, rec, base, w, h, cell) {
  const u0 = cell / FLAME.cells, u1 = (cell + 1) / FLAME.cells, uvs = [[u0, FLAME.v[1]], [u1, FLAME.v[1]], [u1, FLAME.v[0]], [u0, FLAME.v[0]]];
  for (const [dx, dz] of [[1, 0], [0, 1]]) {
    const q = [[base[0] - dx * w / 2, base[1], base[2] - dz * w / 2], [base[0] + dx * w / 2, base[1], base[2] + dz * w / 2], [base[0] + dx * w / 2, base[1] + h, base[2] + dz * w / 2], [base[0] - dx * w / 2, base[1] + h, base[2] - dz * w / 2]];
    for (const f of [1, -1]) kit.quad(rec, q[0], q[1], q[2], q[3], [-dz * f, 0, dx * f], true, uvs);
  }
}
/** A FIRE BASKET about (x, z) from y0 to y1 (its radius r0 at its foot, r1 at its rim): `sides` faces of the fixture's
 *  grille (EG_KIT_MAP: its bars, cut out between), each seen from both sides. */
function basket(kit, rec, x, z, y0, y1, r0, r1, sides) {
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * TAU, b = ((k + 1) / sides) * TAU, P = (t, r, y) => [x + Math.cos(t) * r, y, z + Math.sin(t) * r], o = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
    const q = [P(a, r0, y0), P(b, r0, y0), P(b, r1, y1), P(a, r1, y1)], uvs = [[k / 2, GRILLE[1]], [(k + 1) / 2, GRILLE[1]], [(k + 1) / 2, GRILLE[0]], [k / 2, GRILLE[0]]];
    kit.quad(rec, q[0], q[1], q[2], q[3], o, true, uvs);
    kit.quad(rec, q[0], q[1], q[2], q[3], [-o[0], 0, -o[2]], true, uvs);
  }
}
/**
 * AN ARCH on the plane z0-z1 (a wall's thickness): its intrados sprung at ys from x0 + e to x1 - e (piers centred on x0
 * and x1, e their half width) - round (`pointed` 0) or pointed - in `segs` steps, and its spandrels filled to yTop between
 * the piers' middles, front (facing -z) and back.
 */
function arch(kit, rec, x0, x1, e, ys, yTop, z0, z1, { segs = 6, pointed = 0, m = EG_VISTA_UV.stone } = {}) {
  const a = x0 + e, b = x1 - e, R = (b - a) / 2, cx = (a + b) / 2, rho = R * (1 + pointed), half = segs / 2;
  const th = Math.acos(-pointed / (1 + pointed));   // where each half's arc meets the apex
  const I = [];
  for (let k = 0; k <= half; k++) { const t = Math.PI + ((th - Math.PI) * k) / half; I.push([cx + pointed * R + rho * Math.cos(t), ys + rho * Math.sin(t)]); }
  for (let k = half - 1; k >= 0; k--) I.push([2 * cx - I[k][0], I[k][1]]);
  for (let k = 0; k < segs; k++) {   // the intrados, facing in and down
    const p = I[k], q = I[k + 1], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], ctr = k < half ? [cx + pointed * R, ys] : [cx - pointed * R, ys];
    const out = [ctr[0] - mid[0], ctr[1] - mid[1], 0], len = Math.hypot(q[0] - p[0], q[1] - p[1]), u0 = (k * len) / m;
    kit.quad(rec, [p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1], out, true, [[u0, z0 / m], [u0 + len / m, z0 / m], [u0 + len / m, z1 / m], [u0, z1 / m]]);
  }
  for (const [z, f] of [[z0, -1], [z1, 1]]) {   // the spandrels, fanned from the top corners over the piers
    const P = (p) => [p[0], p[1], z], TL = [x0, yTop, z], TR = [x1, yTop, z], apex = [cx, yTop, z];
    face(kit, rec, [TL, [x0, ys, z], P(I[0])], [0, 0, f], m);
    for (let k = 0; k < half; k++) face(kit, rec, [TL, P(I[k]), P(I[k + 1])], [0, 0, f], m);
    face(kit, rec, [TL, P(I[half]), apex], [0, 0, f], m);
    face(kit, rec, [TR, P(I[segs]), [x1, ys, z]], [0, 0, f], m);
    for (let k = half; k < segs; k++) face(kit, rec, [TR, P(I[k + 1]), P(I[k])], [0, 0, f], m);
    face(kit, rec, [TR, apex, P(I[half])], [0, 0, f], m);
  }
}
/**
 * A DOME broken open: about (0, y, 0), its base radius r and its rise h, over bearings a0-a1 in `sectors`, sector j
 * `rings[j]` of the profile's `full` rings high - a shell `t` thick, its outer face and its inner, closed where it broke
 * (its two ends, each sector's torn top, the steps between). `metal` lays the lowest ring's outer face in that record, in
 * kit `mk` (a gilt drum - the wing's metal).
 */
function dome(kit, rec, y, r, h, t, a0, a1, sectors, rings, full, { metal = -1, mk = kit, m = EG_VISTA_UV.stone } = {}) {
  const phi = (i) => (Math.PI / 2) * (i / full) * 0.97;
  const P = (i, a, inner) => { const rr = inner ? r - t : r, hh = inner ? h - t : h, c = Math.cos(phi(i)); return [Math.cos(a) * rr * c, y + hh * Math.sin(phi(i)), Math.sin(a) * rr * c]; };
  const ctr = [0, y, 0], ang = (j) => a0 + ((a1 - a0) * j) / sectors;
  for (let j = 0; j < sectors; j++) {
    const t0 = ang(j), t1 = ang(j + 1), n = rings[j];
    for (let i = 0; i < n; i++) {
      const gilt = i === 0 && metal >= 0;
      (gilt ? mk : kit).quad(gilt ? metal : rec, P(i, t0, false), P(i, t1, false), P(i + 1, t1, false), P(i + 1, t0, false), ctr, false, [[t0 * r / m, i * 2 / m], [t1 * r / m, i * 2 / m], [t1 * r / m, (i + 1) * 2 / m], [t0 * r / m, (i + 1) * 2 / m]]);
      const q = [P(i, t0, true), P(i, t1, true), P(i + 1, t1, true), P(i + 1, t0, true)], mid = q[2];
      kit.quad(rec, q[0], q[1], q[2], q[3], sub(ctr, mid), true, [[t0 * r / m, i * 2 / m], [t1 * r / m, i * 2 / m], [t1 * r / m, (i + 1) * 2 / m], [t0 * r / m, (i + 1) * 2 / m]]);
    }
    if (n < full) face(kit, rec, [P(n, t0, false), P(n, t1, false), P(n, t1, true), P(n, t0, true)], [0, 1, 0], m);   // its torn top
  }
  const end = (a, n, f) => {   // a broken end: the shell's section, facing along the turn
    const dir = [-Math.sin(a) * f, 0, Math.cos(a) * f];
    for (let i = 0; i < n; i++) face(kit, rec, [P(i, a, false), P(i + 1, a, false), P(i + 1, a, true), P(i, a, true)], dir, m);
  };
  end(a0, rings[0], -1); end(a1, rings[sectors - 1], 1);
  for (let j = 0; j + 1 < sectors; j++) {   // a step between a taller sector and a shorter: the taller's section
    const lo = Math.min(rings[j], rings[j + 1]), hi = Math.max(rings[j], rings[j + 1]), a = ang(j + 1), f = rings[j] > rings[j + 1] ? 1 : -1;
    const dir = [-Math.sin(a) * f, 0, Math.cos(a) * f];
    for (let i = lo; i < hi; i++) face(kit, rec, [P(i, a, false), P(i + 1, a, false), P(i + 1, a, true), P(i, a, true)], dir, m);
  }
}
/**
 * THE TORN FOUNDATIONS under a wing (the Hour's islandRoot law - world/superDungeon/sdIslandModel.js - in the found record): from its
 * top ring at y (an ellipse rx by rz about (cx, cz), `n` corners) down `depth` to a broken point - `rings` bands, each
 * narrower by its taper and jittered, each stepped out at its foot with a ledge facing down into the realm's light - and
 * `spires` smaller spires hanging round it, bent out; its strata by depth (v 0 at the top, the tips in the haze). Its top
 * closed (facing down) when `cap` - left open under a slab that closes itself.
 */
function rock(kit, rec, o, rnd) {
  const { cx = 0, cz = 0, rx, rz = rx, n = 8, y, depth, rings = 3, spires = 2, taper = 1.25, jit = 0.16, step = 0.14, cap = false } = o;
  const total = depth * 1.1, vOf = (yy) => Math.max(0, Math.min(1, (y - yy) / total)), U = Math.max(1, Math.round((Math.PI * (rx + rz) * 2) / total));
  const a0 = rnd() * TAU, R = [];
  for (let i = 0; i < rings; i++) {
    const t = i / rings, yy = y - depth * t * (i ? 0.9 + 0.2 * rnd() : 1), f = (1 - t) ** taper, corners = [];
    for (let k = 0; k < n; k++) { const a = a0 + (k / n) * TAU + i * 0.13, j = i ? 1 + jit * (2 * rnd() - 1) : 1; corners.push([cx + Math.cos(a) * rx * f * j, yy, cz + Math.sin(a) * rz * f * j]); }
    R.push({ y: yy, corners, step: i ? 1 + step * (0.6 + 0.8 * rnd()) : 1 });
  }
  const uvAt = (k, yy) => [(k / n) * U, vOf(yy)];
  if (cap) for (let k = 0; k < n; k++) kit.tri(rec, [cx, y, cz], R[0].corners[k], R[0].corners[(k + 1) % n], [0, -1, 0], true, [((k + 0.5) / n) * U, 0], uvAt(k, y), uvAt(k + 1, y));
  for (let i = 0; i + 1 < rings; i++) {
    const A = R[i], B = R[i + 1], outer = B.corners.map((p) => [cx + (p[0] - cx) * B.step, p[1], cz + (p[2] - cz) * B.step]), mid = [cx, (A.y + B.y) / 2, cz];
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      kit.quad(rec, A.corners[k], A.corners[k1], outer[k1], outer[k], mid, false, [uvAt(k, A.y), uvAt(k + 1, A.y), uvAt(k + 1, B.y), uvAt(k, B.y)]);
      kit.quad(rec, outer[k], outer[k1], B.corners[k1], B.corners[k], [0, -1, 0], true, [uvAt(k, B.y), uvAt(k + 1, B.y), uvAt(k + 1, B.y), uvAt(k, B.y)]);
    }
  }
  const last = R[rings - 1], tip = [cx + (rnd() - 0.5) * rx * 0.3, y - depth, cz + (rnd() - 0.5) * rz * 0.3], above = [cx, last.y + 1, cz];
  for (let k = 0; k < n; k++) kit.tri(rec, last.corners[k], last.corners[(k + 1) % n], tip, above, false, uvAt(k, last.y), uvAt(k + 1, last.y), [((k + 0.5) / n) * U, 1]);
  // the spires hanging round it, from under its first band, bent away from its heart
  const S = 5, top = R.length > 1 ? R[1].y + 0.5 : y - 0.5;
  for (let j = 0; j < spires; j++) {
    const a = a0 + (j + 0.5) * (TAU / Math.max(1, spires)) + (rnd() - 0.5) * 0.6, rho = 0.5 + 0.2 * rnd(), sx = cx + Math.cos(a) * rx * rho, sz = cz + Math.sin(a) * rz * rho;
    const len = depth * (0.45 + 0.35 * rnd()), r0 = Math.min(rx, rz) * (0.2 + 0.08 * rnd()), bend = len * 0.12, rs = [];
    for (let i = 0; i < 3; i++) {
      const t = i / 2, cy = top - len * t * 0.8, cxx = sx + Math.cos(a) * bend * t * t, czz = sz + Math.sin(a) * bend * t * t, rr = r0 * (1 - 0.75 * t), ring = [];
      for (let k = 0; k < S; k++) { const b = (k / S) * TAU + j, q = rr * (1 + 0.2 * (2 * rnd() - 1)); ring.push([cxx + Math.cos(b) * q, cy, czz + Math.sin(b) * q]); }
      rs.push({ c: [cxx, cy, czz], ring });
    }
    const v = (p, tipEnd) => (tipEnd ? Math.max(EG_VISTA_HAZE, vOf(p[1])) : vOf(p[1]));
    for (let i = 0; i < 2; i++) {
      const A = rs[i], B = rs[i + 1], mid = [(A.c[0] + B.c[0]) / 2, (A.c[1] + B.c[1]) / 2, (A.c[2] + B.c[2]) / 2];
      for (let k = 0; k < S; k++) { const k1 = (k + 1) % S; kit.quad(rec, A.ring[k], A.ring[k1], B.ring[k1], B.ring[k], mid, false, [[k / S, v(A.ring[k], false)], [(k + 1) / S, v(A.ring[k1], false)], [(k + 1) / S, v(B.ring[k1], i === 1)], [k / S, v(B.ring[k], i === 1)]]); }
    }
    const L = rs[2], point = [L.c[0] + Math.cos(a) * r0 * 0.3, top - len, L.c[2] + Math.sin(a) * r0 * 0.3], up = [L.c[0], L.c[1] + 1, L.c[2]];
    for (let k = 0; k < S; k++) kit.tri(rec, L.ring[k], L.ring[(k + 1) % S], point, up, false, [k / S, v(L.ring[k], true)], [(k + 1) / S, v(L.ring[(k + 1) % S], true)], [(k + 0.5) / S, 1]);
  }
}

// ── the wings ──────────────────────────────────────────────────────────────────────────────────────────────────
/** Each wing laid into `kit` in its own frame (its torn floor's top at y 0, its foundations under it), from `rnd`, in the
 *  records `R` (EG_VISTA_RECORD). */
const WINGS = Object.freeze({
  // ── THE BROKEN GALLERIES ──
  /** A domed rotunda broken in half: the surviving arc of its floor and colonnade (gold-leaf capitals), the entablature
   *  over the whole columns, the half dome torn jagged above its gilt drum. */
  rotunda(kit, rnd, R) {
    const rr = 11 + 3 * rnd(), H = 9 + 3 * rnd(), aB = rnd() * TAU, arc0 = aB + 0.42 * Math.PI, arc1 = aB + 1.58 * Math.PI, q = rr + 1.6, poly = [];
    for (let k = 0; k <= 10; k++) { const a = mix(arc0, arc1, k / 10); poly.push([Math.cos(a) * q, Math.sin(a) * q]); }
    const e1 = poly[10], e0 = poly[0];
    for (let k = 1; k <= 3; k++) { const f = k / 4, j = (rnd() - 0.5) * 3; poly.push([mix(e1[0], e0[0], f) + Math.cos(aB) * j, mix(e1[1], e0[1], f) + Math.sin(aB) * j]); }
    slab(kit, R.stone, poly, -1.6, 0, { under: true });
    const n = 8, cols = [];
    for (let k = 0; k < n; k++) {
      const a = mix(arc0 + 0.07 * Math.PI, arc1 - 0.07 * Math.PI, k / (n - 1)), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const broken = k === 0 || k === n - 1 || rnd() < 0.15;
      cols.push({ x, z, broken });
      if (broken) { shaft(kit, R.stone, x, z, 0, H * (0.45 + 0.4 * rnd()), 0.85, 0.75, 6, { cut: 1.5, cutA: aB, rnd }); continue; }
      shaft(kit, R.stone, x, z, 0, H - 0.8, 0.85, 0.72, 6, { cap: false });
      shaft(R.mk, R.metal, x, z, H - 0.8, H, 0.72, 1.2, 6, { cap: false });   // its gold-leaf capital
    }
    const prof = [[-0.95, 0], [0.95, 0], [0.95, 1.5], [-0.95, 1.5]];
    for (let k = 0; k + 1 < n; k++) if (!cols[k].broken && !cols[k + 1].broken) kit.extrude(R.stone, prof, [cols[k].x, H, cols[k].z], [cols[k + 1].x, H, cols[k + 1].z], { uvScale: 1 / EG_VISTA_UV.stone });
    const sectors = 7, rings = Array.from({ length: sectors }, (_, j) => (j === 0 || j === sectors - 1 ? 1 + Math.floor(rnd() * 2) : j === 1 || j === sectors - 2 ? 2 + Math.floor(rnd() * 2) : 4));
    dome(kit, R.stone, H + 1.5, rr + 0.4, rr * 0.85, 0.9, arc0 + 0.12 * Math.PI, arc1 - 0.12 * Math.PI, sectors, rings, 4, { metal: R.metal, mk: R.mk });
    rock(kit, R.found, { rx: q * 0.82, n: 10, y: -1.6, depth: 17 + 6 * rnd(), rings: 3, spires: 2 }, rnd);
  },
  /** A bell tower leaning: its square shaft and string courses, a stair turret at a corner, the belfry's four piers with
   *  the bell still in them (the band's metal), its spire snapped. */
  belltower(kit, rnd, R) {
    const w = 3.4 + 0.6 * rnd(), Hs = 22 + 6 * rnd(), yb = Hs + 0.6, yc = yb + 8.5, U = 1 / EG_VISTA_UV.stone;
    slab(kit, R.stone, ringOf(8, w * 1.8, { a0: Math.PI / 8, jit: 0.1, rnd }), -1.8, 0, { under: true });
    kit.box(R.stone, [-w, 0, -w], [w, Hs, w], { skip: ['top', 'bottom'], uvScale: U });
    for (const y of [Hs / 3, (2 * Hs) / 3]) kit.box(R.stone, [-w - 0.3, y, -w - 0.3], [w + 0.3, y + 0.5, w + 0.3], { skip: ['top', 'bottom'], uvScale: U });
    kit.box(R.stone, [-w - 0.45, Hs, -w - 0.45], [w + 0.45, yb, w + 0.45], { uvScale: U });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x0 = sx < 0 ? -w : w - 1.3, z0 = sz < 0 ? -w : w - 1.3;
      kit.box(R.stone, [x0, yb, z0], [x0 + 1.3, yc, z0 + 1.3], { skip: ['top', 'bottom'], uvScale: U });
    }
    kit.box(R.stone, [-w - 0.4, yc, -w - 0.4], [w + 0.4, yc + 0.9, w + 0.4], { uvScale: U });
    shaft(kit, R.stone, 0, 0, yc + 0.9, yc + 10, (w + 0.3) * Math.SQRT2, 0.9, 4, { a0: Math.PI / 4, cut: 3.5, cutA: rnd() * TAU, rnd });
    R.mk.lathe(R.metal, [[0, yb + 1.0], [1.9, yb + 0.6], [1.35, yb + 2.2], [1.1, yb + 3.6], [0, yb + 4.2]], 8);
    R.mk.box(R.metal, [-w + 0.6, yb + 4.2, -0.25], [w - 0.6, yb + 4.8, 0.25]);
    const tx = w + 0.3, tz = w + 0.3;   // the stair turret at its corner
    shaft(kit, R.stone, tx, tz, 0, Hs + 3, 1.5, 1.4, 6, { cap: false });
    kit.lathe(R.stone, [[1.7, Hs + 3], [0, Hs + 6.5]], 6, { centre: [tx, 0, tz], uvScale: U });
    rock(kit, R.found, { rx: w * 1.55, n: 8, y: -1.8, depth: 15 + 5 * rnd(), rings: 3, spires: 2 }, rnd);
  },
  /** A long arcade torn off at one end: its floor, its piers and round arches with their spandrels, the entablature and
   *  its cornice, an attic wall over its middle. */
  arcade(kit, rnd, R) {
    const bays = 6, s = 7, pw = 1.7, d = 2.4, ys = 6.5 + rnd(), r = (s - pw) / 2, yE = ys + r + 1.3, L = bays * s, x0 = -L / 2, torn = rnd() < 0.5 ? 0 : bays - 1, U = 1 / EG_VISTA_UV.stone;
    const poly = [];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, c = Math.cos(a), sn = Math.sin(a); poly.push([Math.sign(c) * Math.abs(c) ** 0.4 * (L / 2 + 2.5) * (1 + 0.08 * (2 * rnd() - 1)), Math.sign(sn) * Math.abs(sn) ** 0.4 * (d / 2 + 3)]); }
    slab(kit, R.stone, poly, -1.6, 0, { under: true });
    for (let i = 0; i <= bays; i++) {
      const x = x0 + i * s, end = (torn === 0 && i === 0) || (torn === bays - 1 && i === bays);
      if (end) { shaft(kit, R.stone, x, 0, 0, ys * (0.5 + 0.3 * rnd()), pw * 0.72, pw * 0.72, 4, { a0: Math.PI / 4, cut: 1.2, cutA: rnd() * TAU, rnd }); continue; }
      kit.box(R.stone, [x - pw / 2, 0, -d / 2], [x + pw / 2, ys, d / 2], { skip: ['top', 'bottom'], uvScale: U });
    }
    const xa = x0 + (torn === 0 ? s : 0), xb = x0 + L - (torn === bays - 1 ? s : 0);
    for (let i = 0; i < bays; i++) if (i !== torn) arch(kit, R.stone, x0 + i * s, x0 + (i + 1) * s, pw / 2, ys, yE, -d / 2, d / 2, { segs: 6 });
    for (const [x, f] of [[xa, -1], [xb, 1]]) face(kit, R.stone, [[x, ys, -d / 2], [x, ys, d / 2], [x, yE, d / 2], [x, yE, -d / 2]], [f, 0, 0]);
    kit.extrude(R.stone, [[-d / 2 - 0.3, 0], [d / 2 + 0.3, 0], [d / 2 + 0.3, 1.1], [-d / 2 - 0.3, 1.1]], [xa - 0.6, yE, 0], [xb + 0.6, yE, 0], { uvScale: U });
    kit.extrude(R.stone, [[-d / 2 - 0.7, 1.1], [d / 2 + 0.7, 1.1], [d / 2 + 0.7, 1.8], [-d / 2 - 0.7, 1.8]], [xa - 1, yE, 0], [xb + 1, yE, 0], { uvScale: U });
    const ax0 = mix(xa, xb, 0.3 + 0.1 * rnd()), ax1 = mix(xa, xb, 0.7 + 0.1 * rnd());
    kit.box(R.stone, [ax0, yE + 1.8, -d / 2], [ax1, yE + 4.4 + 1.5 * rnd(), d / 2], { skip: ['bottom'], uvScale: U });
    rock(kit, R.found, { rx: L / 2 + 1, rz: d / 2 + 2.6, n: 10, y: -1.6, depth: 14 + 5 * rnd(), rings: 3, spires: 2 }, rnd);
  },
  /** A spiral stair hanging in the air: its stair tower torn open - a broken arc of the tower's wall still standing behind
   *  it, jagged at its head - its newel snapped, its wedge steps winding up with some fallen, the landing it climbed to, a
   *  run of its gilt rail; the tower's floor torn away under it with its rock. */
  spiral(kit, rnd, R) {
    const steps = 22, rise = 1.4, a0 = rnd() * TAU, da = 0.42, ri = 1.4, ro = 7.4, th = 0.7, H = 1 + steps * rise;
    const gone = new Set([4 + Math.floor(rnd() * 4), 11 + Math.floor(rnd() * 3), 17 + Math.floor(rnd() * 3)]);
    slab(kit, R.stone, ringOf(9, 9.6, { jit: 0.14, rnd }), -2, 0, { under: true });
    shaft(kit, R.stone, 0, 0, 0, H + 3, 1.6, 1.4, 8, { cut: 3, cutA: rnd() * TAU, rnd });
    const at = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
    for (let k = 0; k < steps; k++) {
      if (gone.has(k)) continue;
      const a = a0 + k * da, y = 1 + k * rise;
      slab(kit, R.stone, [at(a, ri), at(a, ro), at(a + da * 0.93, ro), at(a + da * 0.93, ri)], y - th, y, { under: true, convex: true });
    }
    const aL = a0 + steps * da, yL = 1 + steps * rise;
    slab(kit, R.stone, [at(aL, ri), at(aL - 0.3, ro + 0.6), at(aL + 0.5, ro + 1.4), at(aL + 1.2, ro + 0.4), at(aL + 1.5, ri)], yL - 0.8, yL, { under: true });
    // the tower's wall, an arc of it left standing: its head highest at its middle, broken down toward its torn ends
    const n = 9, w0 = a0 + Math.PI * (0.6 + 0.3 * rnd()), w1 = w0 + Math.PI * (0.75 + 0.2 * rnd()), r0 = 8.0, r1 = 8.9, ctr = [0, H / 2, 0];
    const top = Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return H * (0.35 + 0.75 * Math.sin(Math.PI * t) ** 0.7) * (0.85 + 0.3 * rnd()); });
    const P = (k, r, y) => { const a = mix(w0, w1, k / n); return [Math.cos(a) * r, y, Math.sin(a) * r]; };
    for (let k = 0; k < n; k++) {
      const h0 = top[k], h1 = top[k + 1];
      face(kit, R.stone, [P(k, r1, 0), P(k + 1, r1, 0), P(k + 1, r1, h1), P(k, r1, h0)], sub(P(k + 0.5, r1, (h0 + h1) / 4), ctr));
      face(kit, R.stone, [P(k, r0, 0), P(k + 1, r0, 0), P(k + 1, r0, h1), P(k, r0, h0)], sub(ctr, P(k + 0.5, r0, (h0 + h1) / 4)));
      face(kit, R.stone, [P(k, r0, h0), P(k + 1, r0, h1), P(k + 1, r1, h1), P(k, r1, h0)], [0, 1, 0]);
    }
    for (const [k, f] of [[0, -1], [n, 1]]) {
      const a = mix(w0, w1, k / n);
      face(kit, R.stone, [P(k, r0, 0), P(k, r1, 0), P(k, r1, top[k]), P(k, r0, top[k])], [-Math.sin(a) * f, 0, Math.cos(a) * f]);
    }
    const k0 = 6 + Math.floor(rnd() * 6), rail = [];
    for (let k = k0; k < k0 + 8; k++) { const a = a0 + (k + 0.5) * da, p = at(a, ro - 0.3); rail.push([p[0], 1 + k * rise + 1.1, p[1]]); }
    R.mk.sweep(R.metal, [[-0.14, -0.14], [0.14, -0.14], [0.14, 0.14], [-0.14, 0.14]], rail);
    rock(kit, R.found, { rx: 8, n: 9, y: -2, depth: 16 + 5 * rnd(), rings: 3, spires: 2 }, rnd);
  },
  // ── THE SOUL CAIRN ──
  /** A floating tomb: a torn slab carrying a mausoleum (its plinth, pilasters, pitched roof and a soul-gem in its
   *  pediment), sarcophagi beside it (one knocked askew), a cairn of stacked stones, chains hanging from its rim. */
  tomb(kit, rnd, R) {
    const U = 1 / EG_VISTA_UV.stone, rs = 9.5 + 1.5 * rnd();
    slab(kit, R.stone, ringOf(9, rs, { rz: rs * 0.8, jit: 0.12, rnd, a0: rnd() }), -1.6, 0, { under: true });
    kit.box(R.stone, [-5, 0, -3.6], [5, 0.9, 3.6], { skip: ['bottom'], uvScale: U });
    kit.box(R.stone, [-3.6, 0.9, -2.6], [3.6, 7.2, 2.6], { skip: ['top', 'bottom'], uvScale: U });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kit.box(R.stone, [sx * 3.6 - 0.5, 0.9, sz * 2.6 - 0.5], [sx * 3.6 + 0.5, 7.6, sz * 2.6 + 0.5], { skip: ['bottom'], uvScale: U });
    kit.box(R.stone, [-4.1, 7.2, -3.1], [4.1, 8.0, 3.1], { uvScale: U });
    kit.extrude(R.stone, [[-3.4, 0], [3.4, 0], [0, 3.4]], [-4.3, 8.0, 0], [4.3, 8.0, 0], { uvScale: U });
    gem(kit, R.glass, [-4.45, 9.2, 0], [1, 0, 0], 0.4, 0.4, 0.9, 6, rnd, { jit: 0.1 });
    for (const x of [-4.3, 4.3]) spike(kit, R.stone, [[x - 0.4, 11.4, -0.4], [x + 0.4, 11.4, -0.4], [x + 0.4, 11.4, 0.4], [x - 0.4, 11.4, 0.4]], [x, 13.2, 0]);
    const lidded = (a, b) => {   // a sarcophagus from a to b on the slab, its lid stepped over it
      kit.extrude(R.stone, [[-1.1, 0], [1.1, 0], [1.1, 1.4], [-1.1, 1.4]], a, b, { uvScale: U });
      kit.extrude(R.stone, [[-1.3, 1.4], [1.3, 1.4], [0.9, 2.0], [-0.9, 2.0]], [a[0] - 0.15 * (b[0] - a[0]), a[1], a[2] - 0.15 * (b[2] - a[2])], [b[0] + 0.15 * (b[0] - a[0]), b[1], b[2] + 0.15 * (b[2] - a[2])], { uvScale: U });
    };
    lidded([6.2, 0, -2.6], [6.4, 0, 2.4]);
    const sk = (rnd() - 0.5) * 2.4;   // the second knocked askew
    lidded([-2.3, 0, rs * 0.55 + sk], [2.3, 0, rs * 0.55 - sk]);
    let y = 0;
    for (const [hw, hh] of [[1.4, 1.6], [1.15, 1.5], [0.9, 1.4], [0.7, 1.2]]) { kit.box(R.stone, [-hw, y, -rs * 0.62 - hw], [hw, y + hh, -rs * 0.62 + hw], { skip: ['bottom'], uvScale: U }); y += hh; }
    for (let k = 0; k < 3; k++) {
      const a = rnd() * TAU, p = [Math.cos(a) * rs * 0.92, -1.6, Math.sin(a) * rs * 0.74];   // outside its rock top
      hang(kit, R.chain, p, [p[0] * 1.08, p[1] - 9 - 9 * rnd(), p[2] * 1.08], 0.8);
    }
    rock(kit, R.found, { rx: rs * 0.82, rz: rs * 0.66, n: 9, y: -1.6, depth: 15 + 5 * rnd(), rings: 3, spires: 2 }, rnd);
  },
  /** A crypt's facade with nothing behind it: its steps, two flank towers (one snapped) under their pinnacles, the
   *  pointed portal opening onto the void, its gable. */
  crypt(kit, rnd, R) {
    const U = 1 / EG_VISTA_UV.stone, ys = 8 + rnd(), yT = ys + 6, broke = rnd() < 0.5 ? -1 : 1;
    slab(kit, R.stone, ringOf(10, 13.5, { rz: 6.5, jit: 0.1, rnd }), -1.6, 0, { under: true });
    kit.box(R.stone, [-8, 0, -4.5], [8, 0.7, 1.5], { skip: ['bottom'], uvScale: U });
    kit.box(R.stone, [-7, 0.7, -3.6], [7, 1.4, 1.5], { skip: ['bottom'], uvScale: U });
    for (const sx of [-1, 1]) {
      const x = sx * 7.8, top = yT + 7;
      if (sx === broke) { shaft(kit, R.stone, x, 1.5, 1.4, top * (0.55 + 0.2 * rnd()), 2.5 * Math.SQRT2, 2.3 * Math.SQRT2, 4, { a0: Math.PI / 4, cut: 3, cutA: rnd() * TAU, rnd }); continue; }
      shaft(kit, R.stone, x, 1.5, 1.4, top, 2.5 * Math.SQRT2, 2.3 * Math.SQRT2, 4, { a0: Math.PI / 4 });
      spike(kit, R.stone, [[x - 1.9, top, -0.4], [x + 1.9, top, -0.4], [x + 1.9, top, 3.4], [x - 1.9, top, 3.4]], [x, top + 7, 1.5]);
    }
    kit.box(R.stone, [-5.4, 1.4, 0], [-2.4, ys, 3], { skip: ['top', 'bottom', 'nx'], uvScale: U });
    kit.box(R.stone, [2.4, 1.4, 0], [5.4, ys, 3], { skip: ['top', 'bottom', 'px'], uvScale: U });
    arch(kit, R.stone, -5.4, 5.4, 3, ys, yT, 0, 3, { segs: 6, pointed: 0.6 });
    const g = [[-5.4, yT, 0], [5.4, yT, 0], [0, yT + 5.5, 0]];
    face(kit, R.stone, g, [0, 0, -1]); face(kit, R.stone, g.map((p) => [p[0], p[1], 3]), [0, 0, 1]);
    face(kit, R.stone, [g[0], g[2], [0, yT + 5.5, 3], [-5.4, yT, 3]], [-1, 1, 0]); face(kit, R.stone, [g[2], g[1], [5.4, yT, 3], [0, yT + 5.5, 3]], [1, 1, 0]);
    spike(kit, R.stone, [[-0.5, yT + 5.2, 1.0], [0.5, yT + 5.2, 1.0], [0.5, yT + 5.2, 2.0], [-0.5, yT + 5.2, 2.0]], [0, yT + 9, 1.5]);
    rock(kit, R.found, { rx: 11.5, rz: 5.5, n: 10, y: -1.6, depth: 16 + 5 * rnd(), rings: 3, spires: 2 }, rnd);
  },
  /** Giant soul-gem crystals in the mist (the band's own light): a great gem and its brood grown from a torn lump of the
   *  ossuary's stone, a few shards drifting free beside it. */
  gem(kit, rnd, R) {
    slab(kit, R.stone, ringOf(8, 6.5, { jit: 0.18, rnd }), -1.2, 0.6, { under: true });
    const tilt = (rnd() - 0.5) * 0.4;
    gem(kit, R.glass, [0, 9, 0], [Math.sin(tilt), 1, 0.2 * tilt], 10, 22 + 6 * rnd(), 3.6, 7, rnd, { jit: 0.15 });
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + rnd() * 0.5, d = 2 + 3.5 * rnd(), lean = 0.35 + 0.5 * rnd(), len = 6 + 12 * rnd();
      gem(kit, R.glass, [Math.cos(a) * d, 1.5 + len * 0.3, Math.sin(a) * d], [Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean)], len * 0.35, len * 0.7, 0.9 + 1.5 * rnd(), 5 + (k % 2), rnd);
    }
    for (let k = 0; k < 4; k++) {
      const a = rnd() * TAU, d = 9 + 6 * rnd();
      gem(kit, R.glass, [Math.cos(a) * d, 4 + 14 * rnd(), Math.sin(a) * d], [rnd() - 0.5, 1, rnd() - 0.5], 1.5, 2.5 + 2 * rnd(), 0.8, 5, rnd);
    }
    rock(kit, R.found, { rx: 5.5, n: 8, y: -1.2, depth: 13 + 4 * rnd(), rings: 3, spires: 2 }, rnd);
  },
  /** Broken columns half-sunk in the mist: a torn stylobate, its colonnade snapped at every height - two still whole,
   *  carrying their architrave - and a drum fallen across it. */
  sunken(kit, rnd, R) {
    const U = 1 / EG_VISTA_UV.stone;
    slab(kit, R.stone, ringOf(10, 13, { rz: 8, jit: 0.12, rnd }), -1.6, 0, { under: true });
    const H = 13 + 4 * rnd(), cols = [[-9, -2], [-4.5, -2], [0, -2], [4.5, -2], [9, -2], [-6, 4]];
    cols.forEach(([x, z], k) => {
      if (k === 1 || k === 2) {
        shaft(kit, R.stone, x, z, 0, H - 0.8, 1.0, 0.85, 7, { cap: false });
        kit.lathe(R.stone, [[0.85, H - 0.8], [1.35, H - 0.2], [1.35, H]], 7, { centre: [x, 0, z], uvScale: U });
        return;
      }
      shaft(kit, R.stone, x, z, 0, H * (0.25 + 0.55 * rnd()), 1.0, 0.9, 7, { cut: 1.6, cutA: rnd() * TAU, rnd });
    });
    kit.box(R.stone, [-5.6, H, -3.1], [1.1, H + 1.4, -0.9], { uvScale: U });
    const a = rnd() * TAU;
    tube(kit, R.stone, [2 + Math.cos(a) * 4, 1.0, 3 + Math.sin(a) * 4], [2 - Math.cos(a) * 4, 1.0, 3 - Math.sin(a) * 4], 1.0, 1.0, 7);
    rock(kit, R.found, { rx: 11, rz: 6.5, n: 10, y: -1.6, depth: 15 + 5 * rnd(), rings: 3, spires: 2 }, rnd);
  },
  // ── THE SHADE PERILOUS ──
  /** A tower wrapped in black-glass thorns: its round shaft and corbelled crown under a conical roof, the thorns winding
   *  up it and the great ones curling out from its plinth. */
  thorntower(kit, rnd, R) {
    const U = 1 / EG_VISTA_UV.stone, H = 28 + 6 * rnd();
    slab(kit, R.stone, ringOf(8, 7.5, { jit: 0.12, rnd }), -1.6, 0, { under: true });
    shaft(kit, R.stone, 0, 0, 0, H, 4.6, 3.9, 8, { cap: false });
    shaft(kit, R.stone, 0, 0, H, H + 1.6, 4.3, 5.0, 8, { cap: true });
    kit.lathe(R.stone, [[4.6, H + 1.6], [2.4, H + 7], [0, H + 13]], 8, { uvScale: U });
    const a0 = rnd() * TAU;
    for (let k = 0; k < 26; k++) {
      const a = a0 + k * 0.74, y = 2 + k * (H - 4) / 26, r = mix(4.6, 3.9, y / H) - 0.2, c = Math.cos(a), s = Math.sin(a), tg = [-s, 0, c];
      const len = 2.5 + 3.5 * rnd(), up = 0.5 + 1.5 * rnd();
      const base = [[c * r + tg[0] * 0.5, y - 0.5, s * r + tg[2] * 0.5], [c * r - tg[0] * 0.5, y - 0.5, s * r - tg[2] * 0.5], [c * r, y + 0.6, s * r]];
      spike(kit, R.glass, base, [c * (r + len) + tg[0] * len * 0.4, y + up, s * (r + len) + tg[2] * len * 0.4], { m: EG_VISTA_UV.glass });
    }
    for (let k = 0; k < 5; k++) {
      const a = a0 + (k / 5) * TAU + 0.3, c = Math.cos(a), s = Math.sin(a), r = 6.4, len = 8 + 5 * rnd();
      spike(kit, R.glass, [[c * r - s * 0.9, 0, s * r + c * 0.9], [c * r + s * 0.9, 0, s * r - c * 0.9], [c * r, 1.6, s * r]], [c * (r + len * 0.7), len * 0.8, s * (r + len * 0.7)], { m: EG_VISTA_UV.glass });
    }
    rock(kit, R.found, { rx: 6.4, n: 8, y: -1.6, depth: 17 + 5 * rnd(), rings: 3, spires: 3 }, rnd);
  },
  /** A great black-glass shard turning slowly: two blades fused at an angle, their splinters drifting by them, the knot
   *  of glass stalactites it was torn from at its foot. */
  shard(kit, rnd, R) {
    const lean = (rnd() - 0.5) * 0.3, twist = rnd() * TAU;
    gem(kit, R.glass, [0, 0, 0], [Math.sin(lean), 1, 0], 18 + 6 * rnd(), 26 + 10 * rnd(), 7.5, 7, rnd, { rz: 2.4, jit: 0.25, twist });
    const b = twist + 0.9 + 0.4 * rnd();
    gem(kit, R.glass, [1.5, 4, 0.5], [0.45, 1, 0.2], 9, 18 + 6 * rnd(), 5, 6, rnd, { rz: 1.6, jit: 0.25, twist: b });
    for (let k = 0; k < 9; k++) {   // its splinters, drifting with it
      const a = (k / 9) * TAU + rnd() * 0.6, d = 9 + 9 * rnd();
      gem(kit, R.glass, [Math.cos(a) * d, -12 + 34 * rnd(), Math.sin(a) * d], [rnd() - 0.5, 1, rnd() - 0.5], 1.5 + 2 * rnd(), 3 + 5 * rnd(), 1.0 + 1.2 * rnd(), 5, rnd, { rz: 0.5 + 0.4 * rnd() });
    }
    slab(kit, R.stone, ringOf(6, 4.2, { jit: 0.2, rnd }), -17, -14, { under: true });
    rock(kit, R.found, { rx: 3.6, n: 6, y: -17, depth: 11 + 4 * rnd(), rings: 2, spires: 2 }, rnd);
  },
  /** A broken observatory: its platform and drum, the dome split along its slot with one half fallen away, the great
   *  glass (the band's silver) still raised through the slot on its mount. */
  observatory(kit, rnd, R) {
    const U = 1 / EG_VISTA_UV.stone, r = 9 + 1.5 * rnd(), aS = rnd() * TAU;
    slab(kit, R.stone, ringOf(12, r + 3.5, { jit: 0.1, rnd }), -1.6, 0, { under: true });
    shaft(kit, R.stone, 0, 0, 0, 7.5, r, r, 12, { cap: false });
    shaft(kit, R.stone, 0, 0, 7.5, 8.6, r + 0.5, r + 0.5, 12, { cap: false });
    dome(kit, R.stone, 8.6, r + 0.2, r * 0.9, 0.8, aS + 0.22, aS + Math.PI - 0.22, 5, [3, 4, 4, 4, 3], 4);
    dome(kit, R.stone, 8.6, r + 0.2, r * 0.9, 0.8, aS + Math.PI + 0.22, aS + Math.PI + 0.22 + 1.4, 3, [2, 1 + Math.floor(rnd() * 2), 1], 4);
    kit.box(R.stone, [-1.6, 0, -1.6], [1.6, 5, 1.6], { skip: ['bottom'], uvScale: U });
    const up = 0.95, ex = Math.cos(aS), ez = Math.sin(aS);   // raised along the slot
    tube(R.mk, R.metal, [-ex * 4, 3.5, -ez * 4], [ex * 9 * Math.cos(up), 3.5 + 20 * Math.sin(up), ez * 9 * Math.cos(up)], 1.4, 1.0, 8);
    rock(kit, R.found, { rx: r + 2, n: 10, y: -1.6, depth: 17 + 5 * rnd(), rings: 3, spires: 3 }, rnd);
  },
  // ── THE HAVOC WELLHEAD ──
  /** A siege tower: three stages tapering up, bound in iron, its bridge down and chained, iron spikes round its top
   *  and its fire basket still burning (the forges' flame). */
  siegetower(kit, rnd, R) {
    slab(kit, R.stone, ringOf(8, 8, { a0: Math.PI / 8, jit: 0.12, rnd }), -1.6, 0, { under: true });
    const st = [[4.6, 0, 10], [3.9, 10.6, 19.6], [3.2, 20.2, 27.6]];
    st.forEach(([w, y0, y1], i) => {
      const w1 = i + 1 < st.length ? st[i + 1][0] + 0.25 : w - 0.3;
      shaft(kit, R.stone, 0, 0, y0, y1, w * Math.SQRT2, w1 * Math.SQRT2, 4, { a0: Math.PI / 4, cap: true });
      shaft(R.mk, R.metal, 0, 0, y1, y1 + 0.6, (w1 + 0.15) * Math.SQRT2, (w1 + 0.15) * Math.SQRT2, 4, { a0: Math.PI / 4, cap: i === st.length - 1 });
    });
    const yt = 28.2, wt = 3.2;
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * 4, side = Math.floor(t), f = t - side, c = [[-wt, -wt], [wt, -wt], [wt, wt], [-wt, wt]], p = c[side], q = c[(side + 1) % 4];
      const x = mix(p[0], q[0], f), z = mix(p[1], q[1], f);
      spike(R.mk, R.metal, [[x - 0.3, yt, z - 0.3], [x + 0.3, yt, z - 0.3], [x + 0.3, yt, z + 0.3], [x - 0.3, yt, z + 0.3]], [x * 1.12, yt + 2.6, z * 1.12]);
    }
    const hy = 24, out = 7 + 2 * rnd();
    kit.extrude(R.stone, [[-2.3, -0.3], [2.3, -0.3], [2.3, 0.3], [-2.3, 0.3]], [0, hy, -3.4], [0, hy - out * 0.8, -3.4 - out * 0.6], { uvScale: 1 / EG_VISTA_UV.stone });
    for (const sx of [-2, 2]) hang(R.mk, R.metal, [sx * 1.3, hy + 3, -3.4], [sx, hy - out * 0.8, -3.4 - out * 0.6], 0.5);
    basket(kit, R.fire, 0, 0, yt, yt + 1.8, 0.7, 1.5, 6);   // its fire basket, its iron bars cut out round the fire in it
    flame(kit, R.fire, [0, yt + 0.4, 0], 2.6, 3.4, 1);
    rock(kit, R.found, { rx: 6.6, n: 8, y: -1.6, depth: 18 + 5 * rnd(), rings: 3, spires: 2 }, rnd);
  },
  /** A broken war-gate: two hexagonal bastions crowned with spikes (one snapped), the squat arch between them under its
   *  parapet, its portcullis half down. */
  wargate(kit, rnd, R) {
    const U = 1 / EG_VISTA_UV.stone, broke = rnd() < 0.5 ? -1 : 1;
    slab(kit, R.stone, ringOf(12, 16, { rz: 8.5, jit: 0.1, rnd }), -1.8, 0, { under: true });
    for (const sx of [-1, 1]) {
      const x = sx * 9.2, H = 24 + 3 * rnd();
      if (sx === broke) { shaft(kit, R.stone, x, 0, 0, H * (0.55 + 0.2 * rnd()), 5.4, 4.9, 6, { cut: 4, cutA: rnd() * TAU, rnd }); continue; }
      shaft(kit, R.stone, x, 0, 0, H, 5.4, 4.7, 6, { cap: true });
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU, c = Math.cos(a) * 4.4, s = Math.sin(a) * 4.4; spike(R.mk, R.metal, [[x + c - 0.4, H, s - 0.4], [x + c + 0.4, H, s - 0.4], [x + c + 0.4, H, s + 0.4], [x + c - 0.4, H, s + 0.4]], [x + c * 1.15, H + 3.2, s * 1.15]); }
    }
    kit.box(R.stone, [-5, 0, -3], [-2.6, 8, 3], { skip: ['top', 'bottom', 'nx'], uvScale: U });
    kit.box(R.stone, [2.6, 0, -3], [5, 8, 3], { skip: ['top', 'bottom', 'px'], uvScale: U });
    arch(kit, R.stone, -5, 5, 2.4, 8, 14, -3, 3, { segs: 4 });
    kit.box(R.stone, [-5.4, 14, -3.4], [5.4, 15.6, 3.4], { uvScale: U });
    const down = 3 + 3 * rnd();
    for (let k = 0; k < 5; k++) { const x = -2.2 + k * 1.1; R.mk.box(R.metal, [x - 0.17, down, -0.6], [x + 0.17, 12, -0.26], { skip: ['top'] }); }
    for (const y of [down + 1, down + 4]) R.mk.box(R.metal, [-2.6, y, -0.75], [2.6, y + 0.35, -0.6]);
    rock(kit, R.found, { rx: 14, rz: 7, n: 12, y: -1.8, depth: 17 + 5 * rnd(), rings: 3, spires: 2 }, rnd);
  },
  /** A floating basalt crag with forges glowing in it: a cluster of hexagonal prisms standing at every height on its
   *  torn rock, three forges in its flank - each a hearth with its mouth burning and its chimney's throat aglow. */
  crag(kit, rnd, R) {
    slab(kit, R.stone, ringOf(9, 9.5, { jit: 0.16, rnd }), -0.6, 0, { under: true });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU + rnd() * 0.4, d = k === 0 ? 0 : 3.5 + 3.5 * rnd(), x = Math.cos(a) * d, z = Math.sin(a) * d, r = 1.8 + 1.4 * rnd(), h = 5 + 13 * rnd() * (1 - d / 10);
      slab(kit, R.glass, ringOf(6, r, { cx: x, cz: z, a0: rnd() }), 0, h, { convex: true, m: EG_VISTA_UV.glass });
    }
    const fa = rnd() * TAU;
    for (let k = 0; k < 3; k++) {
      const a = fa + k * 2.1, c = Math.cos(a), s = Math.sin(a), d = 8.4, x = c * d, z = s * d, tg = [-s, 0, c], hw = 1.6;
      const P = (u, y, v) => [x + tg[0] * u + c * v, y, z + tg[2] * u + s * v];
      const Q = (u, v) => { const p = P(u, 0, v); return [p[0], p[2]]; };
      slab(kit, R.stone, [Q(-hw - 0.6, -1.6), Q(hw + 0.6, -1.6), Q(hw + 0.6, 1.2), Q(-hw - 0.6, 1.2)], 0, 4.2, { convex: true });
      kit.quad(R.fire, P(-hw, 0.4, 1.25), P(hw, 0.4, 1.25), P(hw, 3.6, 1.25), P(-hw, 3.6, 1.25), [c, 0, s], true, [[k / 4, FLAME.v[1]], [(k + 1) / 4, FLAME.v[1]], [(k + 1) / 4, FLAME.v[0]], [k / 4, FLAME.v[0]]]);   // its mouth burning
      const cx = x - c * 0.4, cz = z - s * 0.4, top = 9 + 4 * rnd();
      shaft(kit, R.stone, cx, cz, 4.2, top, 0.9, 0.7, 6, { cap: false });
      flame(kit, R.fire, [cx, top - 0.3, cz], 1.3, 2.2, (k + 1) % 4);   // its throat, aflame
    }
    rock(kit, R.found, { rx: 9, n: 9, y: -0.6, depth: 20 + 6 * rnd(), rings: 3, spires: 3 }, rnd);
  },
});
/** The forms THE WINGS know (world/eliteGates/egKit.js EG_KIT_STYLE's wreck names, every band's). */
export const EG_VISTA_FORMS = Object.freeze(Object.keys(WINGS));

/**
 * ONE WING'S MODEL (pure, seeded): form `kind` laid in band `band`'s archive from `seed`, turned to its `heading`
 * (degrees), grown by `size` and stood about its own middle - its axis of turn through the middle of its bounds, so it
 * turns in place.
 * @param {number} band @param {string} kind @param {number} seed @param {number} [heading] @param {number} [size]
 */
export function buildEgWingModel(band, kind, seed, heading = 0, size = 1) {
  const lay = WINGS[kind];
  if (!lay) throw new Error(`no wing ${kind}`);
  const kit = createMeshKit({ start: 256 }), mk = createMeshKit({ start: 64 }), rnd = rng((0x5ec0 + band * 0x1000 + seed * 0x9e37) >>> 0);
  lay(kit, rnd, { ...EG_VISTA_RECORD, metal: K.fixture, mk });
  if (mk.vertexCount) {   // the band's metal: every face of it the fixture body's one texel (EG_VISTA_METAL)
    const mm = mk.pack(0), t = EG_VISTA_METAL[Math.max(0, Math.min(3, band | 0))];
    for (let i = 0; i < mm.uvs.length; i += 2) { mm.uvs[i] = t[0]; mm.uvs[i + 1] = t[1]; }
    kit.mesh(K.fixture, mm);
  }
  const m = kit.pack(egBandArchive(band)), b = meshKitBounds(m.positions).box, cx = (b[0] + b[3]) / 2, cy = (b[1] + b[4]) / 2, cz = (b[2] + b[5]) / 2;
  const h = (heading * Math.PI) / 180, c = Math.cos(h) * size, s = Math.sin(h) * size, P = m.positions, N = m.normals, cn = Math.cos(h), sn = Math.sin(h);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i] - cx, z = P[i + 2] - cz, nx = N[i], nz = N[i + 2];
    P[i] = c * x + s * z; P[i + 1] = (P[i + 1] - cy) * size; P[i + 2] = -s * x + c * z;
    N[i] = cn * nx + sn * nz; N[i + 2] = -sn * nx + cn * nz;
  }
  return m;
}

/**
 * THE UNDERSIDE OVERHEAD for band `band`: world/eliteGates/egUndersideModel.js's model laid in the kit's far stone and foundations
 * (EG_VISTA_UNDER_DRESS), `at` where its torn floor's middle hangs from the EYE (EG_VISTA_UNDER: its distance, leaning
 * toward the course) and `scale` its size there - its rim at the band's angular radius.
 */
export function buildEgVistaUnder(band) {
  const b = Math.max(0, Math.min(3, band | 0)), U = EG_VISTA_UNDER[b];
  const at = [0, U.d * Math.cos(U.lean), U.d * Math.sin(U.lean)], scale = (U.d * Math.tan(U.radius)) / EG_UNDERSIDE.r;
  const model = buildEgUndersideModel(b, { recs: EG_VISTA_UNDER_DRESS });
  // its far stone at the far law in the world's metres, not the model's: the fall's two metres a picture (the mesh kit's
  // uvScale 0.5) grown by its scale onto EG_VISTA_UV.stone a picture (its strata keep their depth's mapping)
  const f = scale / (0.5 * EG_VISTA_UV.stone);
  for (const sm of model.subMeshes) if (sm.textureRecord === EG_VISTA_RECORD.stone) for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i++) { const j = model.indices[i] * 2; model.uvs[j] *= f; model.uvs[j + 1] *= f; }
  return { model, at, scale };
}

/**
 * A BAND'S WRECK: `{ band, wings: [{ model, at: [x, y, z], court: [x, y, z], spin, tilt }], under: { model, at, scale } |
 * null }` - each wing's model about its own axis, `at` from its hall's centre (the dungeon frame's axes, m) and `court`
 * about a Court hall's, `spin` its turn (rad/s), `tilt` its lean (rad); the underside's model, where it hangs from the eye
 * and its scale. In the band's archive. `lite` the phones' tier: the first EG_VISTA_LITE wings, none turning.
 * @param {number} band @param {{ lite?: boolean }} [opts]
 * @returns {{ band: number, wings: Array<{ model: any, at: number[], court: number[], spin: number, tilt: number }>, under: { model: any, at: number[], scale: number } | null }}
 */
export function buildEgVista(band, { lite = false } = {}) {
  const b = Math.max(0, Math.min(3, band | 0)), reach = EG_VISTA_REACH[b];
  const wings = EG_VISTA_WINGS[b].slice(0, lite ? EG_VISTA_LITE : undefined).map((w, i) => {
    const P = EG_VISTA_PLACES[i], a = (P.bearing * Math.PI) / 180, x = Math.sin(a) * P.d * reach, z = Math.cos(a) * P.d * reach, seed = b * 16 + i + 1;
    const heading = (rng(0xa11 + seed)() * 360) | 0;
    return { model: buildEgWingModel(b, w.kind, seed, heading, w.size), at: [x, P.h, z], court: [x, P.court ?? P.h, z], spin: lite ? 0 : egVistaTurn(i), tilt: w.tilt };
  });
  return { band: b, wings, under: buildEgVistaUnder(b) };
}
