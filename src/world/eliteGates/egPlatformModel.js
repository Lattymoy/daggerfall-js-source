// @ts-check
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md "What was
// wrong" - "The span pieces wore the Steps' clock faces" - and "The idea": "Every hall is a piece of the Battlemages'
// academy, torn off and falling"): THE SPANS' PIECES AS THE ACADEMY TORN - what every piece a span stands looks like
// (scenes/eliteGates/egSpan.js stands them, moves them and batches them). Each is a piece of the academy's own floor broken off with
// the stone it stood on, in its band's dress (world/eliteGates/egKit.js EG_KIT_STYLE, world/eliteGates/egBandArt.js):
//
//   ITS TOP is the law's: the collider's rectangle exactly (net/eliteGates/egSpanLaw.js - its w by d, SD_STEP_THICK deep), flat at
//     the law's height, in the band's flags (marble, slate, black glass, basalt - the floor record, a Falling Wall's walk
//     its tesserae), a flag's whole metre shifted a piece by its seed so no two slabs lay alike. THE EDGE LINE rides its
//     rim as it always did (the slab's gold strip - scenes/eliteGates/egSpan.js since EG-PLAY: 0.02 m out, from 4 mm over the top
//     to 5 cm under it).
//   ITS CORNICE (Elite-Gates-Look.md section 1's rims - EG_CORNICE): the band's profile under every rim no other piece
//     abuts - the Galleries' ovolo, gold band and cavetto, the Cairn's corona over its frieze of skulls, the Shade's black
//     glass in facets, the Wellhead's heavy block with its iron spikes pointing down - its top under the strip, standing
//     out of the footprint by at most EG_PIECE_LOOK.reach (the Hour's teeth's) and never over the top: it never lies about
//     where the floor ends. Mitred where two runs meet, broken by the seed on a side in three (the body behind the break).
//   ITS FOUNDATION (section 3.1's at a piece's size): under the slab the academy's courses stepped in, then the band's
//     own torn mass (EG_KIT_STYLE `found`): the Galleries' marble courses breaking to red-rock spires, the Cairn's packed
//     bone with black roots, the Shade's black-glass stalactites, the Wellhead's basalt prisms hanging in columns - the
//     strata by depth (the kit's `found` record, the Hour's root mapping - world/eliteGates/egBandArt.js EG_KIT_MAP: v the depth
//     under the top over the foundation's whole depth, slab, courses, rubble, deep stone and every broken tip into the haze),
//     the prisms and the glass the kit's `crystal`. All of it under the top and inside the footprint in plan, its depth
//     the plan's (egPiecePlan): an open span's deep, a fragment's short, never into the room a body needs over a floor
//     beneath it.
//   ITS RUIN, where the footprint allows (never over the top inside it): a broken column of the band's (EG_KIT_STYLE
//     `column` - fluted, bone, glass, basalt) standing out of the cornice at a long side's middle, clear of the leap's
//     corridor, its broken top a stub over the floor's level; or the band's hanging thing small (`hanging` - a chandelier,
//     a soul-gem cage, black-glass shards, a bent girder) on a rod under its first course.
//   A BEAT (egBeatModel) keeps the Steps' dial as its top - the dial, its bezel and the line under its rim the Steps' own
//     picture, so its frames, its white warning and its dissolve are the law's tell exactly (world/eliteGates/egBandArt.js
//     EG_BEAT_TELL_RECORDS) - set in the band's stone: its cornice and a short torn underside, which dissolve with it
//     (world/eliteGates/egPlatformArt.js EG_BEAT_STONE_RECORDS). No Hour's clock is on any other piece.
//   A CRUMBLE (egCrumbleModels) keeps the Steps' own box and chunks - its cracks are where it breaks - in the band's flags
//     cracking (world/eliteGates/egPlatformArt.js egCrumbleArt): a slab already loose of its foundations, so nothing hangs under it.
//   A RISER is a pier of the band's ashlar (the pillar record) its 2.3 m face flush for the run up, its gold lip the edge
//     line; a DROP's landing a court of flags walled in ashlar coped with the moulding; a Rail and a Drum carriages on the
//     gold track (runners in the band's metal over it, no foundation into it); a Drift, a Beat and a Moon branch a short
//     torn underside (what swings and what comes and goes is light).
//   GRATH'S ISLES (egIsleModel): the court's plates on the band's cornice, their stone down into the magma - no gear teeth.
//
// Pure (no DOM, no GL): renderer.createMesh's model shape, a piece's own frame (its top's centre the origin, x across, z
// along - the slab's own, scenes/eliteGates/egSpan.js), the band's archive and the band's tell archive (and the Steps' own for a
// Beat's dial). The same seed builds the same bytes. Not a DFU member. Ledger A (ELITE-GATES).
import { createMeshKit } from './meshKit.js';
import { EG_DRESS, EG_KIT_MAP, egBandArchive, egTellArchive } from './egBandArt.js';
import { EG_KIT_RECORD, egKitStyle } from './egKit.js';
import { SD_REALM_ARCHIVE, SD_ISLAND_SIDES } from '../superDungeon/sdRealm.js';
import { SD_STEP_THICK, SD_RISER_H } from '../superDungeon/sdSteps.js';
import { SD_STEPS_RECORD, SD_STEPS_ATLAS, SD_STEP_BEVEL, SD_STEP_LINE } from '../superDungeon/sdStepsArt.js';
import { buildStepModel, buildCrumbleChunks } from '../superDungeon/sdStepsModel.js';
import { EG_CRUMBLE_TELL_RECORDS } from './egPlatformArt.js';

/** THE PIECES' MEASURES (m): THE EDGE LINE's strip (the slab's own since EG-PLAY - out from the side, its top over the top
 *  and its foot under it); a cornice's top (under the strip's foot) and its most reach out of the footprint (the Hour's
 *  teeth's); a broken tip's least v (into the haze); the courses' set-in; the depth
 *  a foundation hangs to under its top by where it stands (an open span's, a fragment's, a light piece's, a phone's); a
 *  column stub's radius, its rise over the top and its fall under it, and the share of pieces that carry one; the share
 *  that carry the band's hanging thing, its rod's length and how far it hangs under its rod's end; the room a body needs over a floor beneath (no foundation hangs into it); and the
 *  least depth a piece's strata are laid over (a shallow underside shows its slab and its courses, never the haze). */
export const EG_PIECE_LOOK = Object.freeze({
  edge: Object.freeze({ out: 0.02, top: 0.004, foot: -0.05 }),
  corniceTop: -0.07,
  reach: 0.35,
  haze: 0.84,
  ledge: 0.14,
  set: 0.2,
  depth: Object.freeze({ span: Object.freeze([2.3, 3.5]), frag: Object.freeze([1.1, 1.5]), light: Object.freeze([1.05, 1.4]), lite: Object.freeze([1.3, 1.8]) }),
  column: Object.freeze({ r: Object.freeze([0.22, 0.28]), up: Object.freeze([0.3, 1.1]), down: Object.freeze([1.0, 1.8]), share: 0.3, clear: 0.6 }),
  hang: Object.freeze({ share: 0.35, len: Object.freeze([0.45, 0.95]), under: 0.7 }),
  head: 2.2,
  strata: 2.4,
});
const L = EG_PIECE_LOOK, T = SD_STEP_THICK;
/** THE BANDS' CORNICES (Elite-Gates-Look.md section 1, by band index): each profile `[out, y]` from the rim's top down -
 *  its first face flush under the edge line's strip, out no further than EG_PIECE_LOOK.reach, its last back on the body;
 *  each face laid in its band of the moulding picture (`bands` - world/eliteGates/egBandArt.js EG_KIT_MAP's: the fillet, the ornament
 *  - egg-and-dart, skulls, facets, straps - the metal band, the cove, the torn stone). The Wellhead's spikes (`spikes`: m apart, out, long, half-width) point down
 *  from its soffit. */
export const EG_CORNICE = Object.freeze([
  Object.freeze({ name: 'egg-and-dart', profile: fz([[0, 0], [0, -0.08], [0.26, -0.2], [0.26, -0.3], [0, -0.46]]), bands: fz1(['fillet', 'ornament', 'band', 'cove']), spikes: null }),
  Object.freeze({ name: 'skulls', profile: fz([[0, 0], [0, -0.07], [0.24, -0.12], [0.14, -0.2], [0.14, -0.42], [0, -0.48]]), bands: fz1(['fillet', 'band', 'cove', 'ornament', 'torn']), spikes: null }),
  Object.freeze({ name: 'facets', profile: fz([[0, 0], [0, -0.07], [0.18, -0.11], [0.26, -0.22], [0.14, -0.34], [0, -0.42]]), bands: fz1(['fillet', 'band', 'ornament', 'cove', 'torn']), spikes: null }),
  Object.freeze({ name: 'straps', profile: fz([[0, 0], [0, -0.07], [0.3, -0.07], [0.3, -0.36], [0, -0.52]]), bands: fz1(['fillet', 'band', 'ornament', 'cove']), spikes: Object.freeze({ every: 1.5, out: 0.2, len: 0.28, half: 0.07 }) }),
]);
/** @param {string[]} a */
function fz1(a) { return Object.freeze(a.slice()); }
/** @param {number[][]} pts */
function fz(pts) { return Object.freeze(pts.map((p) => Object.freeze(p))); }
/** A band's cornice (clamped 0-3). `lite` a phone's: its profile cut to its fillet, its reach and its foot (the same
 *  reach and depth in three faces), no spikes. */
export const egCornice = (band, lite = false) => {
  const C = EG_CORNICE[Math.max(0, Math.min(3, band | 0))];
  if (!lite) return C;
  const P = C.profile, far = P.reduce((m, p) => (p[0] > m[0] ? p : m), P[0]);
  return { name: C.name, profile: [P[0], P[1], far, P[P.length - 1]], bands: ['fillet', 'ornament', 'cove'], spikes: null };
};
/** A profile's reach out of its footprint (m). */
export const egCorniceReach = (profile) => Math.max(...profile.map((p) => p[0]));

// ── THE SEED ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A piece's own seed: the breach's, its circle, its hall and its number - the same piece the same stone on every screen. */
export function egPieceSeed(seed, c, h, i) {
  let x = (Math.imul((seed | 0) ^ 0x6a09e667, 0x9e3779b1) ^ Math.imul(c + 1, 0x85ebca6b) ^ Math.imul(h + 7, 0xc2b2ae35) ^ Math.imul(i + 13, 0x27d4eb2f)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
/** A stream of numbers in [0, 1) off a seed (the Hour's own LCG - world/superDungeon/sdStepsModel.js buildGritModel's). */
function stream(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const lerp = (r, t) => r[0] + (r[1] - r[0]) * t;

// ── THE PLAN ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The pieces a span stands as slabs of the academy (their kind's dress below), and the pieces that move on the clock. */
const SLABS = Object.freeze(['still', 'ledge', 'gust', 'vent', 'pend', 'sink']);
const LIGHT = Object.freeze(['drift', 'moon', 'beat']);
const CARRIAGES = Object.freeze(['rail', 'drum']);
/** A step's plan in metres of its hall (x, z its rest, its sweep - a Drift across, a Rail and a Drum along). */
const sweptOf = (s) => {
  const ax = s.kind === 'drift' ? Math.abs(s.amp ?? 0) : 0, az = CARRIAGES.includes(s.kind) ? Math.abs(s.amp ?? 0) : 0;
  return [s.x - s.w / 2 - ax, s.z - s.d / 2 - az, s.x + s.w / 2 + ax, s.z + s.d / 2 + az];
};
/** Every floor of hall `spec` in plan, for the room under a piece: `{ box: [x0, z0, x1, z1], y, poly? }` - its discs, bands,
 *  lanes, passages' floors, steps (swept) and a hero's floors. */
const _floors = new WeakMap();
function floorsOf(spec) {
  let out = _floors.get(spec);
  if (out) return out;   // a hall's once (its pieces ask in turn)
  _floors.set(spec, out = []);
  for (const d of spec.discs ?? []) out.push({ box: [d.x - d.r, d.z - d.r, d.x + d.r, d.z + d.r], y: d.y ?? 0, disc: d });
  for (const b of spec.bands ?? []) out.push({ box: [b.x - b.halfW, b.z0, b.x + b.halfW, b.z1], y: b.y ?? 0 });
  for (const l of spec.lanes ?? []) out.push({ box: [Math.min(l.ax, l.bx) - l.hw, Math.min(l.az, l.bz) - l.hw, Math.max(l.ax, l.bx) + l.hw, Math.max(l.az, l.bz) + l.hw], y: l.y ?? 0 });
  for (const q of spec.caves ?? []) {
    out.push({ box: [q.x - q.halfW, q.z0, q.x + q.halfW, q.zA ?? q.z1], y: q.y });
    if (q.zB != null) out.push({ box: [q.x - q.halfW, q.zB, q.x + q.halfW, q.z1], y: q.yB ?? q.y });
  }
  for (const s of spec.steps ?? []) out.push({ box: sweptOf(s), y: s.y, step: s });
  for (const H of spec.heroes ?? []) for (const g of H.floors ?? []) { const xs = g.poly.map((p) => p[0]), zs = g.poly.map((p) => p[1]); out.push({ box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], y: g.y }); }
  return out;
}
const overlaps = (a, b, pad = 0) => a[0] < b[2] + pad && b[0] < a[2] + pad && a[1] < b[3] + pad && b[1] < a[3] + pad;

/**
 * A PIECE'S PLAN (pure - the hall's spec `spec`, its step `s`): what it wears and how far its stone may hang -
 * `{ kind, w, d, body, top, cornice: [-z, +x, +z, -x], breaks, depth, spires, column, hang, uv, seed }`:
 *   `cornice` each side's run, off where the kind says (a Riser's run-up face, a Drop's walled sides, a carriage's ends -
 *     it travels to within EG_RAIL_CLEAR of what it meets) or another floor abuts it inside the cornice's reach;
 *   `depth` the metres under its top its lowest tip hangs to - the kind's (an open span's deep, a fragment's short, a light
 *     piece's short, nought for a carriage), never into the head room over a floor of the hall beneath it in plan;
 *   `column` and `hang` its ornament off its seed (an open span's slabs alone - a gust's push, a fragment's walls and a
 *     piece that moves never carry a column).
 * `w` and `d` its top where the collider's box is not the step's own size (a Drift's, a Beat's, a Riser's - the Steps' box,
 * world/superDungeon/sdStepsModel.js stepBox).
 * @param {any} spec @param {any} s @param {{ seed?: number, lite?: boolean, band?: number, w?: number, d?: number }} [o]
 */
export function egPiecePlan(spec, s, { seed = 0, lite = false, band = 0, w = s.w, d = s.d } = {}) {
  const r = stream(seed ^ 0x51ab), kind = s.kind, open = !s.kit;
  const cornice = kind === 'riser' ? [false, true, true, true] : kind === 'drop' ? [true, false, false, false] : CARRIAGES.includes(kind) ? [false, true, false, true] : [true, true, true, true];
  // a side another floor abuts within the cornice's reach (a Beat run into its Riser - gap nought) keeps its face flush
  const reach = egCorniceReach(egCornice(band).profile) + 0.1, me = sweptOf({ ...s, w, d }), floors = floorsOf(spec);
  const sideBox = [[me[0], me[1] - reach, me[2], me[1]], [me[2], me[1], me[2] + reach, me[3]], [me[0], me[3], me[2], me[3] + reach], [me[0] - reach, me[1], me[0], me[3]]];
  for (const f of floors) {
    if (f.step === s) continue;
    if (f.y < s.y - T - 0.6 || f.y > s.y + 3) continue;
    for (let k = 0; k < 4; k++) if (cornice[k] && overlaps(sideBox[k], f.box)) cornice[k] = false;
  }
  // the depth: the kind's, then the room over whatever floor stands under its plan
  const range = lite ? L.depth.lite : !open ? L.depth.frag : L.depth.span;
  let depth = CARRIAGES.includes(kind) ? T : LIGHT.includes(kind) ? lerp(L.depth.light, r()) : kind === 'riser' ? SD_RISER_H + lerp(L.depth.light, r()) : Math.min(lerp(range, r()), kind === 'drop' ? 4.2 : 99) + (kind === 'drop' && !lite ? 0.8 : 0);
  const under = [me[0] - 0.4, me[1] - 0.4, me[2] + 0.4, me[3] + 0.4];
  for (const f of floors) {
    if (f.step === s || f.y >= s.y - T || !overlaps(under, f.box)) continue;
    depth = Math.min(depth, s.y - f.y - L.head);
  }
  depth = Math.max(kind === 'riser' ? SD_RISER_H + T : T, depth);
  // a side's cornice broken (one side in three, on an open span's slab), the body behind the break
  const breaks = [null, null, null, null];
  if (open && !lite && SLABS.includes(kind) && r() < 0.34) { const k = Math.floor(r() * 4), len = [w, d, w, d][k], g = 0.35 + 0.35 * r(), at = 0.25 + (len - 0.5 - g) * r(); if (cornice[k] && len > 1.6) breaks[k] = [at, at + g]; }
  // the ornament: a column on a long side's middle (an open span's still slabs), or the band's hanging thing small
  let column = null, hang = null;
  const roll = r();
  if (!lite && open && SLABS.includes(kind) && kind !== 'gust' && roll < L.column.share) {
    // (THE AUDIT: a piece turned along x - spec law 10's broken bridge, its `hd` 1 or 3 - leaps over its +x and -x sides, so its
    // column stands on a z side, clear of the leap's corridor as every other's)
    const along = s.hd % 2 === 1, side = along ? (r() < 0.5 ? 0 : 2) : r() < 0.5 ? 1 : 3, room = (along ? w : d) / 2 - L.column.clear, R = lerp(L.column.r, r());
    const beside = side === 1 ? [me[2], me[1], me[2] + 1.2, me[3]] : side === 3 ? [me[0] - 1.2, me[1], me[0], me[3]] : side === 0 ? [me[0], me[1] - 1.2, me[2], me[1]] : [me[0], me[3], me[2], me[3] + 1.2];
    const clear = !floors.some((f) => f.step !== s && f.y > s.y - 4 && f.y < s.y + 3 && overlaps(beside, f.box));
    if (room > R && clear && cornice[side] && !breaks[side]) column = { side, at: (r() * 2 - 1) * (room - R), R, up: lerp(L.column.up, r()), down: Math.min(depth - 0.5, lerp(L.column.down, r())) };
  } else if (!lite && (SLABS.includes(kind) || kind === 'drop') && roll < L.column.share + L.hang.share) {
    const corner = Math.floor(r() * 4), len = Math.min(lerp(L.hang.len, r()), depth - T - L.hang.under);   // all of it within its depth
    if (len >= L.hang.len[0] * 0.6) hang = { corner, len };
  }
  const spires = lite ? 1 : w * d >= 14 ? 3 : w * d >= 7 ? 2 : 1;
  const top = s.top ?? 'floor';
  return { kind, w, d, body: kind === 'riser' ? SD_RISER_H + T : T, top, cornice, breaks, depth, strata: Math.max(depth, L.strata), spires, column, hang, uv: [Math.floor(r() * 4) * 0.5, Math.floor(r() * 4) * 0.5], seed: seed >>> 0, lite: !!lite };
}

/**
 * A SEGMENT'S PLAN (a Falling Wall's walkway, a Collapsing Tube's floor - scenes/eliteGates/egSpan.js EG_WALL_SEG_M long, `w` across):
 * the walkway's tesserae on top and the band's cornice along its two sides (its ends meet its neighbours' - flush), a short
 * torn underside a segment, each its own; a tube's floor between its walls bare of any cornice. Pure.
 * @param {'wall'|'tube'} kind @param {number} w @param {number} d @param {{ seed?: number, lite?: boolean }} [o]
 */
export function egSegmentPlan(kind, w, d, { seed = 0, lite = false } = {}) {
  const r = stream(seed ^ 0x3e9d), wall = kind === 'wall';
  const depth = lerp(L.depth.light, r()) + (wall && !lite ? 0.3 * r() : 0);
  return { kind, w, d, body: T, top: wall ? 'cobble' : 'floor', cornice: [false, wall, false, wall], breaks: [null, null, null, null], depth, strata: Math.max(depth, L.strata), spires: 1, column: null, hang: null, uv: [0, 0], seed: seed >>> 0, lite: !!lite };   // the tiles run on across the joins
}

// ── THE PARTS ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** A kit an archive, packed into one model (their sub-meshes one after another, each kit's records lowest first). */
function packAll(list) {
  const packs = list.filter(([, k]) => k.vertexCount > 0).map(([a, k]) => k.pack(a));
  const V = packs.reduce((n, p) => n + p.positions.length / 3, 0);
  const positions = new Float32Array(V * 3), normals = new Float32Array(V * 3), uvs = new Float32Array(V * 2), indices = new Uint32Array(V), subMeshes = [];
  let v = 0;
  for (const p of packs) {
    positions.set(p.positions, v * 3); normals.set(p.normals, v * 3); uvs.set(p.uvs, v * 2);
    for (let i = 0; i < p.indices.length; i++) indices[v + i] = p.indices[i] + v;
    for (const sm of p.subMeshes) subMeshes.push({ ...sm, startIndex: sm.startIndex + v });
    v += p.positions.length / 3;
  }
  return { positions, normals, uvs, indices, subMeshes };
}
/** The rectangle's sides about the origin (half-sizes a across, b along), the slab's own order (scenes/eliteGates/egSpan.js
 *  slabFaces): -z, +x, +z, -x - each its start corner (x, z), its way along, its normal out and its length. */
const rectSides = (a, b) => [
  { p: [-a, -b], u: [1, 0], n: [0, -1], L: 2 * a },
  { p: [a, -b], u: [0, 1], n: [1, 0], L: 2 * b },
  { p: [a, b], u: [-1, 0], n: [0, 1], L: 2 * a },
  { p: [-a, b], u: [0, -1], n: [-1, 0], L: 2 * b },
];
/** A point `s` along side S, `o` out of it, at height y. */
const at3 = (S, s, o, y) => [S.p[0] + S.u[0] * s + S.n[0] * o, y, S.p[1] + S.u[1] * s + S.n[1] * o];
/** The foundation picture's whole depth (m) for the model being built (the Hour's root mapping - world/eliteGates/egBandArt.js EG_KIT_MAP
 *  `found`: v the depth under the top over the foundation's whole depth, u repeated so its texels stay square), set by each
 *  builder before it lays a face. */
let _fd = 3;
const foundV = (y) => Math.max(0, Math.min(1, -y / _fd));
/** Metres along a foundation's face as its u (its texels square: the picture's 64 across a repeat of half its depth). */
const foundU = (m) => (m * 2) / _fd;
/** A face's v at height y by its record: the strata's by depth, a picture worn v up (the walls' ashlar, a shaft, a crystal -
 *  EG_KIT_MAP's `v: 'up'`) its height over two metres, any other from its top down. */
const UP = new Set([EG_DRESS.pillar, EG_KIT_RECORD.shaft, EG_KIT_RECORD.statue, EG_KIT_RECORD.crystal, EG_KIT_RECORD.wreck]);
const vAt = (rec, y) => (rec === EG_KIT_RECORD.found ? foundV(y) : UP.has(rec) ? y / 2 : -y / 2);
const REC = Object.freeze({ floor: EG_DRESS.floor, metal: EG_DRESS.brass, edge: EG_DRESS.edge, pillar: EG_DRESS.pillar, cobble: EG_DRESS.cobble, arena: EG_DRESS.arena, moulding: EG_KIT_RECORD.moulding, found: EG_KIT_RECORD.found, shaft: EG_KIT_RECORD.shaft, crystal: EG_KIT_RECORD.crystal });

/** THE TOP: the footprint's rectangle at y 0, the band's flags (a tile two metres), shifted by `uv` whole flags. */
function topFace(K, rec, a, b, uv) {
  K.quad(rec, [-a, 0, -b], [a, 0, -b], [a, 0, b], [-a, 0, b], [0, 1, 0], true, [[uv[0] - a / 2, uv[1] - b / 2], [uv[0] + a / 2, uv[1] - b / 2], [uv[0] + a / 2, uv[1] + b / 2], [uv[0] - a / 2, uv[1] + b / 2]]);
}
/** THE EDGE LINE's strip round the rim (the slab's own - scenes/eliteGates/egSpan.js slabFaces): each side `on`, gold, out of it. */
function edgeStrip(K, sides, on = [true, true, true, true]) {
  const E = L.edge;
  sides.forEach((S, k) => {
    if (!on[k]) return;
    K.quad(REC.edge, at3(S, 0, E.out, E.top), at3(S, 0, E.out, E.foot), at3(S, S.L, E.out, E.foot), at3(S, S.L, E.out, E.top), [S.n[0], 0, S.n[1]], true, [[0, 0], [0, 1], [1, 1], [1, 0]]);
  });
}
/** The profile's running length at each point (the moulding's v), and its whole. */
const MOULD = EG_KIT_MAP[EG_KIT_RECORD.moulding].bands;
/** Each face of a profile its v at its top and its foot - its band of the moulding picture (`bands`, EG_KIT_MAP's). */
const profileV = (prof, bands) => prof.slice(1).map((_, j) => MOULD[bands?.[j] ?? 'cove'] ?? MOULD.cove);
/**
 * A CORNICE RUN along side S from `s0` to `s1`: the profile carried along it, mitred at an end that meets the next side's
 * run (`m0`, `m1`), capped where it breaks off (the profile's own outline, fanned from the body).
 */
function corniceRun(K, S, prof, s0, s1, m0, m1, spikes = null, bands = null) {
  const V = profileV(prof, bands), A = prof.map(([o, y]) => at3(S, s0 - (m0 ? o : 0), o, y)), B = prof.map(([o, y]) => at3(S, s1 + (m1 ? o : 0), o, y));
  for (let j = 0; j + 1 < prof.length; j++) {
    const [o0, y0] = prof[j], [o1, y1] = prof[j + 1], no = -(y1 - y0), ny = o1 - o0;
    if (Math.hypot(no, ny) < 1e-9) continue;
    K.quad(REC.moulding, A[j], B[j], B[j + 1], A[j + 1], [S.n[0] * no, ny, S.n[1] * no], true, [[(s0 - (m0 ? o0 : 0)) / 2, V[j][0]], [(s1 + (m1 ? o0 : 0)) / 2, V[j][0]], [(s1 + (m1 ? o1 : 0)) / 2, V[j][1]], [(s0 - (m0 ? o1 : 0)) / 2, V[j][1]]]);
  }
  const yb = prof[prof.length - 1][1], cap = (pts, s, sign) => {
    const M = at3(S, s, 0, (prof[0][1] + yb) / 2), out = [S.u[0] * sign, 0, S.u[1] * sign];
    for (let j = 0; j + 1 < pts.length; j++) {
      const a = pts[j], b = pts[j + 1], e = [(a[0] - M[0]) * (b[1] - M[1]) - (a[1] - M[1]) * (b[0] - M[0]), (a[1] - M[1]) * (b[2] - M[2]) - (a[2] - M[2]) * (b[1] - M[1])];
      if (Math.abs(e[0]) + Math.abs(e[1]) + Math.abs((a[0] - M[0]) * (b[2] - M[2]) - (a[2] - M[2]) * (b[0] - M[0])) < 1e-7) continue;
      K.tri(REC.moulding, M, a, b, out, true, [0.25, V[j][1]], [(prof[j][0]) / 2, V[j][0]], [(prof[j + 1][0]) / 2, V[j][1]]);
    }
  };
  if (!m0) cap(A, s0, -1);
  if (!m1) cap(B, s1, 1);
  // THE WELLHEAD'S SPIKES: iron, pointing down from the soffit, one every `every` m along the run
  if (spikes) {
    const lo = prof[prof.length - 2], hi = prof[prof.length - 1], soffit = (o) => lo[1] + (hi[1] - lo[1]) * ((lo[0] - o) / (lo[0] - hi[0] || 1));
    const ys = Math.max(soffit(spikes.out - spikes.half), soffit(spikes.out + spikes.half)) + 0.01;   // its base inside the stone
    for (let s = s0 + spikes.every / 2; s < s1 - 0.1; s += spikes.every) {
      const h = spikes.half, c = at3(S, s, spikes.out, ys), apex = [c[0], ys - spikes.len, c[2]];
      const base = [at3(S, s - h, spikes.out - h, ys), at3(S, s + h, spikes.out - h, ys), at3(S, s, spikes.out + h, ys)];
      for (let k = 0; k < 3; k++) { const p = base[k], q = base[(k + 1) % 3], mid = [(p[0] + q[0]) / 2 - c[0], 0, (p[2] + q[2]) / 2 - c[2]]; K.tri(REC.metal, p, q, apex, mid, true, [0, 0], [0.25, 0], [0.12, 0.5]); }
    }
  }
}
/** A flat face at out 0 (the body) along side S from s0 to s1, from y0 down to y1, wearing `rec` (u along, v the strata's
 *  or the ashlar's). */
function bodyFace(K, rec, S, s0, s1, y0, y1, inset = 0) {
  const u = rec === REC.found ? foundU : (m) => m / 2;
  K.quad(rec, at3(S, s0, -inset, y0), at3(S, s1, -inset, y0), at3(S, s1, -inset, y1), at3(S, s0, -inset, y1), [S.n[0], 0, S.n[1]], true, [[u(s0), vAt(rec, y0)], [u(s1), vAt(rec, y0)], [u(s1), vAt(rec, y1)], [u(s0), vAt(rec, y1)]]);
}
/** A ledge facing down at y round the rectangle, from inset i0 in to inset i1 (a course's set-in seen from below). */
function ledge(K, a, b, y, i0, i1) {
  const ring = (i) => [[-a + i, -b + i], [a - i, -b + i], [a - i, b - i], [-a + i, b - i]];
  const A = ring(i0), B = ring(i1), v = foundV(y), dv = foundV(y - (i1 - i0)) - v;   // the set-in read as that much more depth
  for (let k = 0; k < 4; k++) { const k1 = (k + 1) % 4, su = foundU(Math.abs(A[k][0]) + Math.abs(A[k][1])), tu = foundU(Math.abs(A[k1][0]) + Math.abs(A[k1][1])); K.quad(REC.found, [A[k][0], y, A[k][1]], [A[k1][0], y, A[k1][1]], [B[k1][0], y, B[k1][1]], [B[k][0], y, B[k][1]], [0, -1, 0], true, [[su, v], [tu, v], [tu, v + dv], [su, v + dv]]); }
}
/** Eight points round the rectangle inset `i` at height y (its corners and its sides' middles). */
const ring8 = (a, b, i, y) => [[-a + i, y, -b + i], [0, y, -b + i], [a - i, y, -b + i], [a - i, y, 0], [a - i, y, b - i], [0, y, b - i], [-a + i, y, b - i], [-a + i, y, 0]];
/** A ring of `n` points about (x, z) radius `R` at height y, turned by `a0`. */
const ringN = (x, y, z, R, n, a0 = 0) => Array.from({ length: n }, (_, k) => { const t = a0 + (k / n) * Math.PI * 2; return [x + Math.cos(t) * R, y, z + Math.sin(t) * R]; });
/** Quads from ring A down to ring B (same count), each facing out of the axis through `c` (the found record, u round). */
function loft(K, rec, A, B, c) {
  const n = A.length, per = A.reduce((s, p, k) => s + Math.hypot(A[(k + 1) % n][0] - p[0], A[(k + 1) % n][2] - p[2]), 0), Uc = Math.max(1, Math.round(rec === REC.found ? foundU(per) : per / 2));
  for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n, a = A[k], b = A[k1], cc = B[k1], d = B[k];
    const mid = [(a[0] + b[0] + cc[0] + d[0]) / 4, 0, (a[2] + b[2] + cc[2] + d[2]) / 4];
    const v = (p) => vAt(rec, p[1]);
    K.quad(rec, a, b, cc, d, [mid[0] - c[0], 0, mid[2] - c[2]], true, [[(k / n) * Uc, v(a)], [((k + 1) / n) * Uc, v(b)], [((k + 1) / n) * Uc, v(cc)], [(k / n) * Uc, v(d)]]);
  }
}
/** Ring B fanned to point `tip` (its faces away from the axis over it), the tip's v into the haze. */
function fanTo(K, rec, B, tip, c) {
  const n = B.length, vt = rec === REC.found ? Math.max(L.haze, foundV(tip[1])) : vAt(rec, tip[1]);
  for (let k = 0; k < n; k++) {
    const a = B[k], b = B[(k + 1) % n], mid = [(a[0] + b[0]) / 2 - c[0], -0.6, (a[2] + b[2]) / 2 - c[2]];
    K.tri(rec, a, b, tip, mid, true, [k / n, vAt(rec, a[1])], [(k + 1) / n, vAt(rec, b[1])], [(k + 0.5) / n, vt]);
  }
}
/** A cone hanging from (x, y, z): `n` sides of radius R, its apex `len` down (moved `lean` across) - a spire, a stalactite,
 *  a root's tip. */
function cone(K, rec, x, y, z, R, n, len, lean = [0, 0], a0 = 0) {
  const base = ringN(x, y, z, R, n, a0), tip = [x + lean[0], y - len, z + lean[1]];
  fanTo(K, rec, base, tip, [x, 0, z]);
}

/**
 * THE FOUNDATION under a slab of half-sizes a by b whose body ends at y0, its lowest tip `depth` under its top: band
 * `band`'s own (EG_KIT_STYLE `found`) - see the header. `spires` its tips (one, two or three), `r` its stream, `lite` a
 * phone's (one tip, no course).
 */
function foundation(K, band, a, b, y0, depth, spires, r, lite, style = egKitStyle(band).found) {
  const i1 = L.ledge, tipY = -depth, c = [0, 0, 0];
  if (depth <= -y0 + 0.05) { K.quad(REC.found, [-a, y0, -b], [a, y0, -b], [a, y0, b], [-a, y0, b], [0, -1, 0], true, [[0, foundV(y0)], [foundU(a), foundV(y0)], [foundU(a), foundV(y0)], [0, foundV(y0)]]); return; }   // no room: its underside
  ledge(K, a, b, y0, 0, i1);
  if (style === 'prisms') {
    // THE WELLHEAD: the basalt hangs in columns - hexagonal prisms of different lengths under the slab, their ends broken
    K.quad(REC.found, [-a + i1, y0, -b + i1], [a - i1, y0, -b + i1], [a - i1, y0, b - i1], [-a + i1, y0, b - i1], [0, -1, 0], true, [[0, foundV(y0) + 0.02], [foundU(a), foundV(y0) + 0.02], [foundU(a), foundV(y0) + 0.03], [0, foundV(y0) + 0.03]]);
    const nx = lite ? 1 : Math.min(2, Math.max(1, Math.round((a * 2 - 2 * i1) / 1.2))), nz = lite ? 2 : Math.min(3, Math.max(1, Math.round((b * 2 - 2 * i1) / 1.2))), cw = (2 * (a - i1)) / nx, cd = (2 * (b - i1)) / nz;
    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
      const R = Math.min(cw, cd) * (0.36 + 0.08 * r()), x = -a + i1 + cw * (ix + 0.5) + (r() - 0.5) * (cw / 2 - R), z = -b + i1 + cd * (iz + 0.5) + (r() - 0.5) * (cd / 2 - R);
      const yb = y0 - (0.35 + (depth + y0 - 0.35) * (0.35 + 0.65 * r())), a0 = r() * Math.PI;
      const top = ringN(x, y0 + 0.01, z, R, 6, a0), bot = ringN(x, yb, z, R * 0.94, 6, a0).map((p, k) => [p[0], p[1] + (k === 0 || k === 3 ? 0.1 : k === 1 ? -0.06 : 0) * (r() + 0.4), p[2]]);
      loft(K, REC.crystal, top, bot, [x, 0, z]);
      for (let k = 1; k < 5; k++) K.tri(REC.crystal, bot[0], bot[k], bot[k + 1], [0, -1, 0], true, [0, 0], [0.2, 0], [0.1, 0.1]);   // its broken end
    }
    return;
  }
  // the courses: the Galleries step in once more before the rubble
  let yA = y0, iA = i1;
  if (style === 'courses' && !lite && depth > -y0 + 1.2) {
    const y1 = y0 - (0.3 + 0.14 * r());
    ledgeSides(K, a, b, i1, y0, y1);
    ledge(K, a, b, y1, i1, i1 + L.set);
    yA = y1; iA = i1 + L.set;
  }
  // THE TORN MASS: eight points round the course pulled in and down, each its own
  const A = ring8(a, b, iA, yA), hMass = Math.min(depth + yA - 0.2, 0.4 + 0.45 * r());
  const B = A.map((p, k) => { const kk = 0.32 + 0.3 * r(), dy = hMass * (0.7 + 0.6 * r()) * (k % 2 ? 0.85 : 1); return [p[0] * (1 - kk), Math.max(tipY + 0.3, yA - Math.max(0.15, dy)), p[2] * (1 - kk)]; });   // never under its tip
  loft(K, REC.found, A, B, c);
  const yB = Math.min(...B.map((p) => p[1]));
  if (style === 'courses' && spires <= 1) {   // one spire: the mass falls to its broken tip
    fanTo(K, REC.found, B, [(r() - 0.5) * a * 0.5, tipY, (r() - 0.5) * b * 0.5], c);
    return;
  }
  // the mass closed under (its centre a little lower), and the band's own hanging from it
  const cen = [(r() - 0.5) * a * 0.3, Math.max(tipY + 0.15, yB - 0.12), (r() - 0.5) * b * 0.3];
  fanTo(K, REC.found, B, cen, c);
  const n = style === 'ossuary' ? Math.max(2, spires) : style === 'stalactites' ? spires + 2 : spires;
  for (let j = 0; j < n; j++) {
    const k = Math.floor(((j + r() * 0.6) / n) * 8) % 8, f = 0.35 + 0.35 * r(), p = B[k];
    const x = cen[0] + (p[0] - cen[0]) * f, z = cen[2] + (p[2] - cen[2]) * f, y = cen[1] + (p[1] - cen[1]) * f + 0.06;   // inside the mass's underside
    const room = y - tipY, len = Math.min(room, Math.max(Math.min(0.6, room), room * (j === 0 ? 1 : 0.45 + 0.4 * r())));   // to its depth, never past it
    if (style === 'ossuary') root(K, x, y, z, len, r);
    else if (style === 'stalactites') cone(K, REC.crystal, x, y, z, 0.14 + 0.14 * r(), 4, len, [(r() - 0.5) * 0.2, (r() - 0.5) * 0.2], r());
    else cone(K, REC.found, x, y, z, 0.28 + 0.2 * r(), 5, len, [(r() - 0.5) * 0.4, (r() - 0.5) * 0.4], r());
  }
}
/** A course's four sides from y0 down to y1, inset `i` (the found record). */
function ledgeSides(K, a, b, i, y0, y1) {
  const sides = rectSides(a - i, b - i);
  for (const S of sides) bodyFace(K, REC.found, S, 0, S.L, y0, y1);
}
/** THE CAIRN'S ROOT: a black root of three sides from inside the mass, bent out and down to its tip `len` under it. */
function root(K, x, y, z, len, r) {
  const ang = r() * Math.PI * 2, ox = Math.cos(ang), oz = Math.sin(ang), out = 0.25 + 0.35 * r();
  const P0 = [x, y, z], P1 = [x + ox * out * 0.6, y - len * 0.5, z + oz * out * 0.6], tip = [x + ox * out, y - len, z + oz * out];
  const R0 = ringN(P0[0], P0[1], P0[2], 0.24, 3, ang), R1 = ringN(P1[0], P1[1], P1[2], 0.15, 3, ang + 0.4);
  loft(K, REC.found, R0, R1, [P1[0], 0, P1[2]]);
  fanTo(K, REC.found, R1, tip, [tip[0], 0, tip[2]]);
}

/** A BROKEN COLUMN of the band's (EG_KIT_STYLE `column`) at side S's `at` (m from its middle), standing out of the cornice
 *  (`o` its axis out of the side) from `down` under the top to `up` over it, its top and its foot broken. */
function column(K, band, S, col, o, r) {
  const style = egKitStyle(band).column, n = style === 'basalt' ? 6 : 8, mid = S.L / 2 + col.at, base = at3(S, mid, o, 0), R = col.R;
  const round = EG_KIT_MAP[EG_KIT_RECORD.shaft].around[Math.max(0, Math.min(3, band | 0))];   // the shaft's repeats once round (its flutes and facets whole at the seam)
  const yb = -col.down, yt = col.up, a0 = r() * Math.PI;
  const bot = ringN(base[0], yb, base[2], R, n, a0).map((p) => [p[0], p[1] + (r() - 0.5) * 0.3, p[2]]);
  const top = ringN(base[0], yt, base[2], R, n, a0).map((p) => [p[0], p[1] + (r() - 0.5) * 0.24, p[2]]);
  for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n, mid2 = [(bot[k][0] + bot[k1][0]) / 2 - base[0], 0, (bot[k][2] + bot[k1][2]) / 2 - base[2]];
    K.quad(REC.shaft, bot[k], bot[k1], top[k1], top[k], mid2, true, [[(k / n) * round, bot[k][1] / 2], [((k + 1) / n) * round, bot[k1][1] / 2], [((k + 1) / n) * round, top[k1][1] / 2], [(k / n) * round, top[k][1] / 2]]);
  }
  const brk = [base[0] + (r() - 0.5) * R * 0.6, yt - 0.06 - 0.1 * r(), base[2] + (r() - 0.5) * R * 0.6];
  for (let k = 0; k < n; k++) K.tri(REC.found, top[k], top[(k + 1) % n], brk, [0, 1, 0], true, [k / n, 0.02], [(k + 1) / n, 0.02], [(k + 0.5) / n, 0.06]);
  fanTo(K, REC.found, bot, [base[0], yb - 0.35, base[2]], [base[0], 0, base[2]]);
}

/** THE BAND'S HANGING THING, small (EG_KIT_STYLE `hanging`): on a rod from under the slab's first course at a corner - a
 *  chandelier, a soul-gem cage, black-glass shards, a bent girder. Nothing of it lights (the soul-gem's own picture
 *  aside - the kit's crystal is the band's own light). */
function hanging(K, band, a, b, y0, hg, r) {
  const style = egKitStyle(band).hanging, sx = hg.corner & 1 ? 1 : -1, sz = hg.corner & 2 ? 1 : -1, i = L.ledge / 2;
  const x = sx * (a - i), z = sz * (b - i), y1 = y0 - hg.len;
  const rod = (x0, z0, ya, yb2, h = 0.025) => K.box(REC.metal, [x0 - h, yb2, z0 - h], [x0 + h, ya, z0 + h], { skip: ['top', 'bottom'] });
  if (style === 'girders') {
    // a girder bent out of the stone and down, a chain's stub from its end
    const P0 = [x - sx * 0.3, y0 - 0.15, z], P1 = [x + sx * 0.35, y0 - 0.3, z + sz * 0.1], P2 = [x + sx * 0.6, y0 - 0.85, z + sz * 0.2];
    const prof = [[-0.06, -0.1], [0.06, -0.1], [0.06, 0.1], [-0.06, 0.1]];
    K.sweep(REC.metal, prof, [P0, P1, P2]);
    rod(P2[0], P2[2], P2[1] + 0.05, P2[1] - hg.len * 0.6, 0.02);
    return;
  }
  rod(x, z, y0 + 0.02, y1);
  if (style === 'chandelier') {
    // a gilt crown of six sides, its bowl under it
    const top = ringN(x, y1, z, 0.22, 6), low = ringN(x, y1 - 0.12, z, 0.24, 6), bowl = [x, y1 - 0.3, z];
    loft(K, REC.metal, top, low, [x, 0, z]);
    fanTo(K, REC.metal, low, bowl, [x, 0, z]);
    for (let k = 0; k < 6; k++) K.tri(REC.metal, top[(k + 1) % 6], top[k], [x, y1, z], [0, 1, 0], true, [0, 0], [0.2, 0], [0.1, 0.1]);
  } else if (style === 'cage') {
    // a soul-gem in its cage: the gem's eight faces (the kit's crystal - the Cairn's own light), three bars round it
    const g = [x, y1 - 0.2, z], e = 0.11;
    const pts = [[g[0] + e, g[1], g[2]], [g[0], g[1], g[2] + e], [g[0] - e, g[1], g[2]], [g[0], g[1], g[2] - e]];
    for (const tip of [[g[0], g[1] + e * 1.6, g[2]], [g[0], g[1] - e * 1.6, g[2]]]) for (let k = 0; k < 4; k++) K.tri(REC.crystal, pts[k], pts[(k + 1) % 4], tip, [(pts[k][0] + pts[(k + 1) % 4][0]) / 2 - g[0], tip[1] - g[1], (pts[k][2] + pts[(k + 1) % 4][2]) / 2 - g[2]], true, [0, 0], [0.25, 0], [0.12, 0.25]);
    for (let k = 0; k < 3; k++) { const t = (k / 3) * Math.PI * 2, bx = x + Math.cos(t) * 0.17, bz = z + Math.sin(t) * 0.17; rod(bx, bz, y1 + 0.02, y1 - 0.42, 0.015); }
  } else {
    // black-glass shards on their chains (the kit's crystal), two, one longer
    for (let k = 0; k < 2; k++) {
      const sxk = x + (k ? 0.18 : -0.12) * sx * -1, szk = z + (k ? -0.1 : 0.12) * sz * -1, yk = y1 - (k ? 0.25 : 0), len = k ? 0.42 : 0.6;
      if (k) rod(sxk, szk, y0 + 0.02, yk);
      const top = [sxk, yk, szk], ring = ringN(sxk, yk - 0.12, szk, 0.07, 4, r()), tip = [sxk, yk - len, szk];
      for (let q = 0; q < 4; q++) { const p = ring[q], s2 = ring[(q + 1) % 4], mid = [(p[0] + s2[0]) / 2 - sxk, 0, (p[2] + s2[2]) / 2 - szk]; K.tri(REC.crystal, top, s2, p, [mid[0], 0.5, mid[2]], true, [0, 0], [0.2, 0], [0.1, 0.2]); K.tri(REC.crystal, p, s2, tip, [mid[0], -0.3, mid[2]], true, [0, 0], [0.2, 0], [0.1, 0.4]); }
    }
  }
}

// ── THE PIECES ──────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A SLAB OF THE ACADEMY (every piece but a Beat, a Crumble, a Riser and a Drop's landing - those below): band `band`'s
 * piece to `plan` (egPiecePlan) - its top, THE EDGE LINE, its cornice, its body, its foundation and its ornament. A Rail's
 * and a Drum's carriage rides on runners over the gold track (world/eliteGates/egLook.js EG_TRACK - nothing of it hangs into the
 * track's line).
 * @param {number} band @param {ReturnType<typeof egPiecePlan>} plan
 */
export function egPieceModel(band, plan) {
  const K = createMeshKit(), a = plan.w / 2, b = plan.d / 2, sides = rectSides(a, b), C = egCornice(band, plan.lite), r = stream(plan.seed ^ 0x7c3a);
  _fd = plan.strata;
  topFace(K, plan.top === 'cobble' ? REC.cobble : REC.floor, a, b, plan.uv);
  edgeStrip(K, sides);
  slabSides(K, band, sides, plan, C, 0, plan.body, REC.found);
  if (CARRIAGES.includes(plan.kind)) carriage(K, a, b);
  else foundation(K, band, a, b, -plan.body, plan.depth, plan.spires, r, plan.lite || LIGHT.includes(plan.kind));   // what swings or comes and goes hangs light
  if (plan.column) { const S = sides[plan.column.side]; column(K, band, S, plan.column, egCorniceReach(C.profile) + 0.6 * plan.column.R, r); }
  if (plan.hang) hanging(K, band, a, b, -plan.body, plan.hang, r);
  return K.pack(egBandArchive(band));
}
/** Every side of a slab: its cornice runs (mitred where two meet, capped at a break or a side without one), the body under
 *  them down to `-body` (the record `bodyRec` - the found's strata, a Riser's ashlar), the body bare where no cornice is. */
function slabSides(K, band, sides, plan, C, yTop, body, bodyRec, face = bodyFace) {
  const prof = C.profile, spikes = C.spikes, bands = C.bands, yb = prof[prof.length - 1][1];
  sides.forEach((S, k) => {
    const on = plan.cornice[k], prev = plan.cornice[(k + 3) % 4], next = plan.cornice[(k + 1) % 4], br = plan.breaks?.[k];
    if (!on) { face(K, bodyRec, S, 0, S.L, yTop, -body); return; }
    if (br) {
      corniceRun(K, S, prof, 0, br[0], prev, false, spikes, bands); corniceRun(K, S, prof, br[1], S.L, false, next, spikes, bands);
      bodyFace(K, bodyRec, S, br[0], br[1], prof[0][1], yb);   // behind the break: the body
    } else corniceRun(K, S, prof, 0, S.L, prev, next, spikes, bands);
    face(K, bodyRec, S, 0, S.L, yb, -body);
  });
}
/** A RISER'S PIER: the ashlar in courses EG_RISER_COURSE high, each joint a V cut back into the stone (never out of the box -
 *  the run-up face is the collider's own), its lower lip facing up to catch the light above: a wall that reads as one to
 *  climb, rung by rung, as the Steps' rack did. */
export const EG_RISER_COURSE = Object.freeze({ h: 0.5, cut: 0.05, lip: 0.05 });
function groovedFace(K, rec, S, s0, s1, y0, y1) {
  const G = EG_RISER_COURSE, n = Math.max(1, Math.round((y0 - y1) / G.h)), h = (y0 - y1) / n;
  let top = y0;
  for (let j = 1; j <= n; j++) {
    const yj = y0 - j * h, last = j === n;
    bodyFace(K, rec, S, s0, s1, top, last ? y1 : yj + G.lip);
    if (last) break;
    const up = [S.n[0] * G.lip, 1, S.n[1] * G.lip], dn = [S.n[0] * G.lip, -1, S.n[1] * G.lip], v = (y) => vAt(rec, y);
    K.quad(rec, at3(S, s0, 0, yj + G.lip), at3(S, s1, 0, yj + G.lip), at3(S, s1, -G.cut, yj), at3(S, s0, -G.cut, yj), dn, true, [[s0 / 2, v(yj + G.lip)], [s1 / 2, v(yj + G.lip)], [s1 / 2, v(yj)], [s0 / 2, v(yj)]]);
    K.quad(rec, at3(S, s0, -G.cut, yj), at3(S, s1, -G.cut, yj), at3(S, s1, 0, yj - G.lip), at3(S, s0, 0, yj - G.lip), up, true, [[s0 / 2, v(yj)], [s1 / 2, v(yj)], [s1 / 2, v(yj - G.lip)], [s0 / 2, v(yj - G.lip)]]);
    top = yj - G.lip;
  }
}
/** A CARRIAGE's underside: the slab's underside, and two runners of the band's metal along it over the gold track. */
function carriage(K, a, b) {
  K.quad(REC.found, [-a, -T, -b], [a, -T, -b], [a, -T, b], [-a, -T, b], [0, -1, 0], true, [[0, foundV(-T)], [foundU(a), foundV(-T)], [foundU(a), foundV(-T)], [0, foundV(-T)]]);
  for (const s of [-1, 1]) { const x = s * (a - 0.2); K.box(REC.metal, [x - 0.07, -T - 0.08, -b + 0.15], [x + 0.07, -T + 0.01, b - 0.15], { skip: ['top'] }); }
}

/**
 * A BEAT: the Steps' dial as its top (its bezel and the line under its rim - world/superDungeon/sdStepsArt.js beatArt's top, bevel and
 * line cells, the Steps' own record, so every frame of its dial and its warning is the law's picture), set in the band's
 * stone - the band's cornice under the line, a short torn underside. `plan` its plan (egPiecePlan).
 * @param {number} band @param {ReturnType<typeof egPiecePlan>} plan
 */
export function egBeatModel(band, plan) {
  const K = createMeshKit(), Dk = createMeshKit(), a = plan.w / 2, b = plan.d / 2, rec = SD_STEPS_RECORD.beat[0], A = SD_STEPS_ATLAS, bv = SD_STEP_BEVEL, r = stream(plan.seed ^ 0x2b7e);
  _fd = plan.strata;
  const cell = (c) => [(c[0] + 0.25) / A.w, (c[1] + 0.25) / A.h, (c[0] + c[2] - 0.25) / A.w, (c[1] + c[3] - 0.25) / A.h];
  // the dial: the top inset by the bezel (the Steps' own uv - +z far, the dial's XII), its chamfer, its line
  const Tc = cell(A.top);
  Dk.quad(rec, [-a + bv, 0, -b + bv], [-a + bv, 0, b - bv], [a - bv, 0, b - bv], [a - bv, 0, -b + bv], [0, 1, 0], true, [[Tc[0], Tc[1]], [Tc[0], Tc[3]], [Tc[2], Tc[3]], [Tc[2], Tc[1]]]);
  const ring = (y, i) => [[-a + i, y, -b + i], [a - i, y, -b + i], [a - i, y, b - i], [-a + i, y, b - i]];
  /** @type {Array<[number[][], number[][], number[]]>} */
  const bands = [[ring(0, bv), ring(-bv, 0), cell(A.bevel)], [ring(-bv, 0), ring(-bv - SD_STEP_LINE, 0), cell(A.line)]];
  for (const [up, lo, c] of bands) for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
    const out = [(up[i][0] + up[j][0]) / 2, 0, (up[i][2] + up[j][2]) / 2];
    Dk.quad(rec, up[i], up[j], lo[j], lo[i], out, true, [[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]]);
  }
  // the band's stone under the line: its cornice (the profile from the line's foot), its body, its torn underside
  const C = egCornice(band, plan.lite), y0 = -bv - SD_STEP_LINE, prof = [[0, y0], ...C.profile.slice(1).map(([o, y]) => [o, y + y0 + 0.02])];
  slabSides(K, band, rectSides(a, b), { ...plan, breaks: null }, { profile: prof, spikes: null, bands: C.bands }, y0, plan.body, REC.found);   // no iron on it: all of it dissolves with the dial
  foundation(K, band, a, b, -plan.body, plan.depth, 1, r, true, 'courses');   // the strata alone (world/eliteGates/egPlatformArt.js EG_BEAT_STONE_RECORDS)
  return packAll([[SD_REALM_ARCHIVE, Dk], [egBandArchive(band), K]]);
}

/**
 * A RISER: a pier of the band's ashlar SD_RISER_H + SD_STEP_THICK high - its top the band's flags, THE EDGE LINE its gold lip
 * (the run's tell), its run-up face (-z) flush and bare, the band's cornice under its other rims, a short torn foundation
 * under its foot.
 * @param {number} band @param {ReturnType<typeof egPiecePlan>} plan
 */
export function egRiserModel(band, plan) {
  const K = createMeshKit(), a = plan.w / 2, b = plan.d / 2, sides = rectSides(a, b), C = egCornice(band, plan.lite), r = stream(plan.seed ^ 0x4d1c);
  _fd = plan.strata;
  topFace(K, REC.floor, a, b, plan.uv);
  edgeStrip(K, sides);
  slabSides(K, band, sides, plan, C, 0, plan.body, REC.pillar, groovedFace);
  foundation(K, band, a, b, -plan.body, plan.depth, 1, r, true);
  return K.pack(egBandArchive(band));
}

/** A DROP's walls' thickness (m) - scenes/eliteGates/egSpan.js DROP_WALL_T, the collider's. */
export const EG_DROP_WALL_T = 0.3;
/**
 * A DROP'S LANDING (section 10.4): the slab `w` by `d` walled on its far side and both flanks to `H` over its top - every
 * wall the collider's own box (scenes/eliteGates/egSpan.js egDropTris), in the band's ashlar coped with its moulding, the far wall's
 * doorway (`door` - its width and its height, on the course's line) open; the landing's flags, THE EDGE LINE round it as
 * before, the band's cornice along its open side (under the flanks' feet too), its foundation under the landing.
 * @param {number} band @param {ReturnType<typeof egPiecePlan>} plan @param {number} H @param {{ w: number, h: number }} door
 */
export function egDropLookModel(band, plan, H, door) {
  const K = createMeshKit(), w = plan.w, d = plan.d, a = w / 2, b = d / 2, t = EG_DROP_WALL_T, sides = rectSides(a, b), C = egCornice(band, plan.lite), r = stream(plan.seed ^ 0x6e2d);
  _fd = plan.strata;
  topFace(K, REC.floor, a, b, plan.uv);
  edgeStrip(K, sides);
  // the open side's cornice runs under the flanks' feet too, capped at their outer faces
  const S0 = sides[0], prof = C.profile, yb = prof[prof.length - 1][1];
  corniceRun(K, S0, prof, -t, S0.L + t, false, false, C.spikes, C.bands);
  bodyFace(K, REC.found, S0, 0, S0.L, yb, -T);
  // the walls, the collider's boxes: ashlar faces, the moulding's coping
  const wall = (x0, x1, z0, z1, y0, y1) => {
    const P = (x, y, z) => [x, y, z], vw = (y) => vAt(REC.pillar, y);   // the ashlar worn v up (EG_KIT_MAP's walls)
    K.quad(REC.pillar, P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), [0, 0, -1], true, [[x0 / 2, vw(y0)], [x1 / 2, vw(y0)], [x1 / 2, vw(y1)], [x0 / 2, vw(y1)]]);
    K.quad(REC.pillar, P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), [0, 0, 1], true, [[x0 / 2, vw(y0)], [x1 / 2, vw(y0)], [x1 / 2, vw(y1)], [x0 / 2, vw(y1)]]);
    K.quad(REC.pillar, P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), [-1, 0, 0], true, [[z0 / 2, vw(y0)], [z1 / 2, vw(y0)], [z1 / 2, vw(y1)], [z0 / 2, vw(y1)]]);
    K.quad(REC.pillar, P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), [1, 0, 0], true, [[z0 / 2, vw(y0)], [z1 / 2, vw(y0)], [z1 / 2, vw(y1)], [z0 / 2, vw(y1)]]);
    K.quad(REC.moulding, P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), [0, 1, 0], true, [[x0 / 2, 0.2], [x1 / 2, 0.2], [x1 / 2, 0.35], [x0 / 2, 0.35]]);
    K.quad(REC.pillar, P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), [0, -1, 0], true, [[x0 / 2, z0 / 2], [x1 / 2, z0 / 2], [x1 / 2, z1 / 2], [x0 / 2, z1 / 2]]);
  };
  const h = door.w / 2;
  for (const [x0, x1, y0] of [[-a - t, -h, -T], [h, a + t, -T], [-h, h, door.h]]) wall(x0, x1, b, b + t, y0, H);   // the far wall, its doorway open
  wall(-a - t, -a, -b, b, -T, H);   // the flanks
  wall(a, a + t, -b, b, -T, H);
  foundation(K, band, a, b, -T, plan.depth, plan.spires, r, plan.lite);
  if (plan.hang) hanging(K, band, a, b, -T, plan.hang, r);
  return K.pack(egBandArchive(band));
}

/**
 * A COLLAPSING TUBE's vault over one segment (scenes/eliteGates/egSpan.js - it falls with its floor): a slab of the vault's stone
 * `height` up, the walls' width across - its underside the band's coffers, its stone the foundation's.
 */
export function egTubeLidModel(band, w, d, height) {
  const K = createMeshKit(), x = w / 2 + 0.6, z = d / 2, y0 = height, y1 = height + 1;
  K.quad(EG_KIT_RECORD.coffer, [-x, y0, -z], [x, y0, -z], [x, y0, z], [-x, y0, z], [0, -1, 0], true, [[-x / 2, -z / 2], [x / 2, -z / 2], [x / 2, z / 2], [-x / 2, z / 2]]);
  K.quad(REC.found, [-x, y1, -z], [-x, y1, z], [x, y1, z], [x, y1, -z], [0, 1, 0], true, [[0, 0.02], [z, 0.02], [z, 0.04], [0, 0.04]]);
  for (const zz of [-z, z]) K.quad(REC.found, [-x, y0, zz], [-x, y1, zz], [x, y1, zz], [x, y0, zz], [0, 0, Math.sign(zz)], true, [[0, 0.1], [0, 0.02], [x, 0.02], [x, 0.1]]);
  return K.pack(egBandArchive(band));
}

/**
 * GRATH'S ISLE (section 13.3 - a court's isle that cracks and falls): in its own frame (its top's centre the origin), the
 * court's plates (the arena record, laid flat - never a clock's rings) on the law's own 48 sides (world/superDungeon/sdRealm.js
 * SD_ISLAND_SIDES - its collider's), THE EDGE LINE's strip round its rim, the band's cornice under it - never teeth - and its
 * stone down `down` m under its top (into the magma it stands in).
 * @param {number} band @param {number} radius @param {{ down?: number, lite?: boolean }} [o]
 */
export function egIsleModel(band, radius, { down = 2.4, lite = false } = {}) {
  const K = createMeshKit(), N = SD_ISLAND_SIDES, C = egCornice(band, lite), prof = C.profile, V = profileV(prof, C.bands), E = L.edge;
  _fd = down;
  const at = (k, rr, y) => { const t = (k / N) * Math.PI * 2; return [Math.cos(t) * rr, y, Math.sin(t) * rr]; };
  const mitre = 1 / Math.cos(Math.PI / N);   // a side moved out by o moves its corners out by o x this (the polygon's own)
  const circ = 2 * Math.PI * radius;
  for (let k = 0; k < N; k++) {
    const k1 = k + 1, am = ((k + 0.5) / N) * Math.PI * 2, outN = [Math.cos(am), 0, Math.sin(am)];
    const u0 = (k / N) * (circ / 2), u1 = (k1 / N) * (circ / 2);
    K.tri(REC.arena, [0, 0, 0], at(k1, radius, 0), at(k, radius, 0), [0, 1, 0], true, [0, 0], [at(k1, radius, 0)[0] / 2, at(k1, radius, 0)[2] / 2], [at(k, radius, 0)[0] / 2, at(k, radius, 0)[2] / 2]);
    K.quad(REC.edge, at(k, radius + E.out, E.top), at(k, radius + E.out, E.foot), at(k1, radius + E.out, E.foot), at(k1, radius + E.out, E.top), outN, true, [[0, 0], [0, 1], [1, 1], [1, 0]]);
    for (let j = 0; j + 1 < prof.length; j++) {
      const [o0, y0] = prof[j], [o1, y1] = prof[j + 1], no = -(y1 - y0), ny = o1 - o0;
      if (Math.hypot(no, ny) < 1e-9) continue;
      const r0 = radius + o0 * mitre, r1 = radius + o1 * mitre;
      K.quad(REC.moulding, at(k, r0, y0), at(k1, r0, y0), at(k1, r1, y1), at(k, r1, y1), [outN[0] * no, ny, outN[2] * no], true, [[u0, V[j][0]], [u1, V[j][0]], [u1, V[j][1]], [u0, V[j][1]]]);
    }
    const yb = prof[prof.length - 1][1];
    K.quad(REC.found, at(k, radius, yb), at(k1, radius, yb), at(k1, radius, -down), at(k, radius, -down), outN, true, [[u0, foundV(yb)], [u1, foundV(yb)], [u1, foundV(-down)], [u0, foundV(-down)]]);
  }
  return K.pack(egBandArchive(band));
}

/**
 * A CRUMBLE'S MODELS in band `band`'s dress (the Steps' own geometry - world/superDungeon/sdStepsModel.js buildStepModel's bevelled box
 * and buildCrumbleChunks' chunks along its main cracks, so its cracks, its fall and its rewind are the law's tell exactly -
 * wearing the band's crack stages, world/eliteGates/egPlatformArt.js EG_CRUMBLE_TELL_RECORDS, under the band's tell archive):
 * `{ rest, stages: [1, 2, 3], chunks: [{ model, at, poly }] }` (`n` chunks - two on a phone). Pure.
 */
export function egCrumbleModels(band, n = 4) {
  const arch = egTellArchive(band), box = buildStepModel('crumble');
  const as = (m, rec) => ({ ...m, subMeshes: m.subMeshes.map((sm) => ({ ...sm, textureArchive: arch, textureRecord: rec })) });
  const chunks = buildCrumbleChunks(n).map((q) => ({ ...q, model: as(q.model, EG_CRUMBLE_TELL_RECORDS[3]) }));
  return { rest: as(box, EG_CRUMBLE_TELL_RECORDS[0]), stages: [1, 2, 3].map((k) => as(box, EG_CRUMBLE_TELL_RECORDS[k])), chunks };
}
