// @ts-check
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 3,
// with section 1's forms a band and 1.5's Brink): THE RUIN - everything a hall of the Battlemages' academy is that the law
// is not, one mesh a hall (`{ h, x0, model, sphere }`), built with the circle in the swap's worker (world/eliteGates/egCircleParts.js
// egCircleBuild) and on the main thread for the first stand - byte for byte the same. Every piece wears the kit's records
// (world/eliteGates/egKit.js EG_KIT_RECORD) packed under its band's archive (world/eliteGates/egBandArt.js egBandArchive), so the band's dress
// picks the picture:
//
//   THE FOUNDATIONS under every disc (section 3.1): the floor's slab under its lip, the academy's courses as an inverted
//     stepped mass (each set in by the band's step - EG_RUIN_FORMS), a rubble skirt, then 3-6 spires of the band's deep
//     stone - the Hour's hangPlan law (world/superDungeon/sdIslandModel.js) driven with the band's shape - the strata by depth in the
//     `found` record (EG_FOUND_V, top to tip); and under the courts the band's HANGING things (the Galleries' chandeliers on
//     iron rods, the Cairn's soul-gem cages, the Shade's black-glass shards, the Wellhead's bent girders and chains).
//   THE BRIDGES under every band and lane (section 3.1): a voussoir arch every 6-8 m springing from piers that fall into
//     the void, the spandrels filled - a passage's under its walls' foot.
//   THE CORNICES under every edge (section 3.2): the band's profile (EG_CORNICES - egg-and-dart, skulls, facets, straps)
//     swept along the rim, its crown 2 mm under the floor's top and never more than 0.35 m past the floor's edge.
//   THE COLUMN RINGS (section 3.3, `egRuinColumns` - the plan the lamps read): round every court, isle, plate and bastion
//     at the rim plus 2.5 m (in a ring wall's gap, or past a chamber's tiers), one each 6-9 m of arc, rising from 20-40 m
//     under the floor, broken at the seed's heights, one in three whole under an entablature; THE LAMPS ON THEM - each
//     disc's lamps (world/eliteGates/egHall.js egCircleLights) at a column's top under the band's fixture (a bronze tripod, a soul-gem
//     lantern on an iron gallows, a silver moon-lamp, an iron fire basket); round the plates two arches framing the way on.
//   THE PLACE'S THINGS (section 3.4): the band's statues on broken plinths facing in, banners hanging still from the
//     entablatures, the band's own among the columns (the Cairn's obelisks, the Shade's thorns, the Wellhead's pylons).
//   THE BRINK (section 1.5): a Brink hall's first third in the band above's forms and archive, its last the new band's,
//     the middle mixed piece by piece on the hall's seed - one mesh, its sub-meshes under both archives.
//
// THE LAW: nothing here is a collider. Every piece is laid, then judged against the hall's law (`ruinLaw` - its discs, bands,
// lanes and ramps, its passages, heroes, ring walls and the spans' swept steps) and let go whole if any of it would stand
// above a floor's top inside that floor's footprint or inside what the law keeps clear: no visual larger than the law,
// nothing through another floor. Tall pieces stand EG_RUIN.wayPad from every way onto a disc (net/eliteGates/egLaw.js egMoltenRim's
// ends, the steps' ends, the passages' mouths, the ring walls' gaps). The tall pieces are the ruin's OCCLUDERS (EG-ZN's
// law - `model.occluders`, scenes/eliteGates/egOcclude.js): the camera dithers a column standing between it and the body.
//
// LITE (section 3.5, phones): one spire a foundation, a column each 12 m, no statues or banners, a bridge's arch each 12 m.
// The lamps' columns are the same on both tiers (the lights are every screen's).
//
// THE ASCENT (LAW 9, 2026-10-16; Elite-Gates-Ascent.md section 1): a Brink's thirds are thirds of its ROUTE (net/eliteGates/egRoute.js -
// the progress of a piece's place along the hall's ways), never of its z; laws 4-8 read the numbers they did.
//
// Pure: no DOM, no GL. Not a DFU member. Ledger A (ELITE-GATES).
import { egCircleSpecs, egBandOfHall, EG_BRINK_HALLS, egSeed } from '../../net/eliteGates/egLaw.js';
import { egRouteAlongAt, egRouteLen } from '../../net/eliteGates/egRoute.js';   // THE ASCENT (LAW 9): a Brink's thirds along its route
import { SD_REALM_ORIGIN } from '../../net/superDungeon/sdBrain.js';
import { SD_LIP, SD_ISLAND_SIDES } from '../superDungeon/sdRealm.js';
import { hangPlan, SD_HANG } from '../superDungeon/sdIslandModel.js';
import { rng } from '../superDungeon/sdPixelKit.js';
import { EG_KIT_RECORD, egKitStyle } from './egKit.js';
import { egBandArchive, EG_DRESS, EG_KIT_MAP } from './egBandArt.js';
import { egAtmosOf } from './egAtmos.js';
// read only inside functions (egHall.js reads this module's plan the same way - world/eliteGates/egHall.js egCircleLights)
import { egIsleDisc, egTubeBand, egWallBand, egWallFoot, egNicheBoxes, EG_LAMP } from './egHall.js';

const K = EG_KIT_RECORD, ASHLAR = EG_DRESS.pillar;
const TAU = Math.PI * 2;
/** A column's bearing about its disc's centre, in [0, a whole turn) - its place round the ring. */
const ringAngle = (c) => ((Math.atan2(c.z - c.cz, c.x - c.cx) % TAU) + TAU) % TAU;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** THE RUIN'S MEASURES (m): the ring past a disc's rim, a column each `pitch` of arc (lite `pitchLite`), the clearance of
 *  a tall piece from every way onto a disc (`wayPad`) and from every floor's edge (`floorPad`) and the spans' swept steps
 *  (`stepPad`), how far under its floor a column rises from (`depth`), a lamp column's top, a whole column's (its
 *  capital's) and a broken one's over the floor, one in `wholeEvery` whole; the floor's slab under its lip; a bridge's
 *  bay (lite `bayLite`) and how far its piers fall; and a hall's budget in triangles (section 3.6 - lite `trisLite`). */
export const EG_RUIN = Object.freeze({
  ring: 2.5, pitch: Object.freeze([6, 9]), pitchLite: 12, wayPad: 4, floorPad: 1.0, stepPad: 1.2,
  depth: Object.freeze([20, 40]), lampTop: Object.freeze([2.6, 3.4]), whole: Object.freeze([7.2, 9.4]), broken: Object.freeze([-1.5, 6.0]),
  wholeEvery: 3, slab: 0.6, bay: Object.freeze([6, 8]), bayLite: 12, fall: Object.freeze([16, 28]),
  tris: 20000, trisLite: 12000,
});
/** THE CORNICE (section 3.2): its inner face this far past the floor's edge, its crown this far under the floor's top, and
 *  the most of it past the edge (the Hour's teeth's reach). */
export const EG_RUIN_CORNICE = Object.freeze({ gap: 0.004, under: 0.002, reach: 0.35 });
/** THE KIT'S PICTURES AS THE BAND ART LAYS THEM (world/eliteGates/egBandArt.js EG_KIT_MAP - the builders' one table): the moulding's
 *  bands down its profile (fillet, ornament, the metal band, cove, torn), the fixture's (its flame cells, its body, its
 *  grille), the foundation's strata top to tip (slab, courses - a course of eight rows each - rubble, deep, haze) and the
 *  chain's (a link's faces, its outer and inner walls). */
const MB = EG_KIT_MAP[EG_KIT_RECORD.moulding].bands, FXB = EG_KIT_MAP[EG_KIT_RECORD.fixture].bands, FDB = EG_KIT_MAP[EG_KIT_RECORD.found].bands, CHB = EG_KIT_MAP[EG_KIT_RECORD.chain].bands;
/** THE FOUNDATION RECORD'S STRATA (`found`, v down, top to tip - EG_KIT_MAP): the floor's slab, the courses (a course of the
 *  academy's masonry each `row` of v), the rubble skirt, the band's deep stone down the spires, the haze at the broken tips. */
export const EG_FOUND_V = Object.freeze({ slab: FDB.slab, course: FDB.courses, row: 8 / EG_KIT_MAP[EG_KIT_RECORD.found].h, rubble: FDB.rubble, deep: FDB.deep, haze: FDB.haze[0] });
/** THE FIXTURE RECORD (`fixture`, v down - EG_KIT_MAP): its flame cells (the band's light, the ruin's one emissive - four
 *  across, worn on a crossed quad `quad` metres, cut out), its body, its grille (cut out between its bars). */
export const EG_FIXTURE_V = Object.freeze({ flame: FXB.flame, body: FXB.body, grille: FXB.grille, cells: EG_KIT_MAP[EG_KIT_RECORD.fixture].cells, quad: Object.freeze([0.5, 1]) });
/**
 * THE BANDS' FORMS, the ruin's numbers for each name of world/eliteGates/egKit.js EG_KIT_STYLE (by band):
 *   col      a column's shaft: radius, sides (fluted round 12, bone round 12, a glass octagon, a basalt hexagon), its taper
 *   course   the foundation's courses: how many under a large floor, each's height, the band's step in
 *   spire    the spires (world/superDungeon/sdIslandModel.js SD_SPIRE's numbers, the band's): sides, rings, jitter, bend, broken tip,
 *            the cake's step, a twist a ring, a length share; `sats` thin spires about each (the Shade's stalactites, the
 *            Wellhead's prisms) and `rec` the record they wear
 *   statue   the figure's height over its plinth (m)
 */
export const EG_RUIN_FORMS = Object.freeze([
  Object.freeze({ col: Object.freeze({ r: 0.55, sides: 12, taper: 0.88 }), course: Object.freeze({ n: 5, h: 0.85, step: 0.55 }), spire: Object.freeze({ sides: 7, rings: 6, jitter: 0.18, bend: 0.06, tip: 0.18, step: 0.14, twist: 0, len: 1.0, sats: 0, rec: K.found }), statue: 3.7 }),
  Object.freeze({ col: Object.freeze({ r: 0.6, sides: 12, taper: 0.9 }), course: Object.freeze({ n: 3, h: 0.8, step: 0.45 }), spire: Object.freeze({ sides: 6, rings: 7, jitter: 0.26, bend: 0.2, tip: 0.1, step: 0.05, twist: 0.32, len: 1.1, sats: 2, rec: K.found }), statue: 3.5 }),
  Object.freeze({ col: Object.freeze({ r: 0.5, sides: 8, taper: 0.92 }), course: Object.freeze({ n: 2, h: 0.7, step: 0.4 }), spire: Object.freeze({ sides: 5, rings: 5, jitter: 0.05, bend: 0, tip: 0.02, step: 0, twist: 0, len: 1.15, sats: 5, rec: K.crystal }), statue: 2.6 }),
  Object.freeze({ col: Object.freeze({ r: 0.65, sides: 6, taper: 0.95 }), course: Object.freeze({ n: 3, h: 0.9, step: 0.6 }), spire: Object.freeze({ sides: 6, rings: 4, jitter: 0.03, bend: 0, tip: 0.7, step: 0.32, twist: 0, len: 0.8, sats: 5, rec: K.crystal }), statue: 3.8 }),
]);
const formOf = (band) => EG_RUIN_FORMS[clamp(band | 0, 0, 3)];
/** THE FIXTURES' FLAMES (EG_KIT_STYLE.fixture): the light's height over the fixture's foot (the bronze tripod's bowl, the
 *  soul-gem in its lantern under the gallows, the moon-lamp's globe on its post, the fire in the iron basket). */
export const EG_FIXTURE_FLAME = Object.freeze({ tripod: 1.1, lantern: 1.2, moonlamp: 1.64, basket: 1.45 });
/** The gallows' reach: how far the Cairn's lantern hangs out from its column (m). */
const GALLOWS = 1.05;

/** THE CORNICES' PROFILES (section 1's rims), `pts` `[out, dy]` from the floor's edge and top, crown to foot (the face's way
 *  out is each edge's left hand), and the moulding's band (EG_KIT_MAP) each face wears: the Galleries' fillet, egg-and-dart
 *  ovolo, gold band and cavetto; the Cairn's slate crown, bone beads and frieze of skulls; the Shade's faceted glass and its
 *  silver arris; the Wellhead's basalt block strapped in iron (its spikes laid apart). */
/** v in band `b` of the moulding (MB), `t` of the way down it. */
const mv = (b, t) => lerp(MB[b][0], MB[b][1], clamp(t, 0, 1));
const prof = (pts, bands) => Object.freeze({ pts: Object.freeze(pts.map((p) => Object.freeze(p))), bands: Object.freeze(bands) });
/** A profile at the phones' tier: its corners where its band turns (and its ends) alone. */
const leanProfile = (P) => {
  const keep = P.pts.map((_, j) => j === 0 || j === P.pts.length - 1 || P.bands[j] !== P.bands[j - 1]);
  return { pts: P.pts.filter((_, j) => keep[j]), bands: P.bands.filter((_, j) => keep[j]) };
};
export const EG_CORNICES = Object.freeze({
  'egg-and-dart': prof([[0, 0], [0.3, 0], [0.3, -0.06], [0.27, -0.08], [0.32, -0.13], [0.32, -0.19], [0.27, -0.24], [0.24, -0.26], [0.24, -0.34], [0.2, -0.37], [0.13, -0.42], [0.07, -0.5], [0.03, -0.62], [0.01, -0.78]],
    ['fillet', 'fillet', 'fillet', 'ornament', 'ornament', 'ornament', 'band', 'band', 'cove', 'cove', 'cove', 'cove', 'torn']),
  skulls: prof([[0, 0], [0.28, 0], [0.28, -0.05], [0.24, -0.08], [0.31, -0.11], [0.31, -0.13], [0.31, -0.42], [0.25, -0.45], [0.25, -0.5], [0.12, -0.6], [0.02, -0.76]],
    ['fillet', 'fillet', 'fillet', 'band', 'band', 'ornament', 'cove', 'cove', 'cove', 'torn']),
  facets: prof([[0, 0], [0.33, 0], [0.33, -0.05], [0.34, -0.17], [0.2, -0.3], [0.27, -0.38], [0.06, -0.62], [0.01, -0.68]],
    ['fillet', 'fillet', 'ornament', 'ornament', 'band', 'cove', 'torn']),
  straps: prof([[0, 0], [0.34, 0], [0.34, -0.55], [0.22, -0.62], [0.01, -0.7]],
    ['fillet', 'ornament', 'band', 'torn']),
});

// ── the seeds ────────────────────────────────────────────────────────────────────────────────────────────────────────
const RUIN_SALT = 0x0e6a51;
/** A seeded hash in [0, 1) of a key's whole numbers (world/superDungeon/sdIslandModel.js's mix). */
function h01(seed, a = 0, b = 0, c = 0) {
  let h = (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca6b) ^ Math.imul(c + 1, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0; h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const hallSeed = (spec) => egSeed(spec.seed >>> 0, RUIN_SALT ^ Math.imul(spec.h | 0, 0x2545f491));
/** The band a hall's ruin is dressed in at (x, y, z) - a Brink hall (net/eliteGates/egLaw.js EG_BRINK_HALLS, section 1.5) the band above
 *  in its first third, its own in its last, the two mixed piece by piece between on the hall's seed (`key` the piece). THE
 *  ASCENT: the thirds of its route (net/eliteGates/egRoute.js - laws 4-8 its z over its length; `y` undefined, in plan). */
function bandAt(spec, seed, x, y, z, key) {
  const band = egBandOfHall(spec.h);
  if (!EG_BRINK_HALLS.includes(spec.h) || band <= 0) return band;
  const t = clamp(egRouteAlongAt(spec, x, y, z) / Math.max(1, spec.route ? egRouteLen(spec) : spec.len ?? 80), 0, 1);
  if (t < 1 / 3) return band - 1;
  if (t > 2 / 3) return band;
  return h01(seed, 777, key) < (t - 1 / 3) * 3 ? band : band - 1;
}

// ── THE HALL'S LAW, AS THE RUIN READS IT ─────────────────────────────────────────────────────────────────────────────
/**
 * Hall `spec`'s floors, the room its law keeps clear and its ways (the hall's frame): `floors` - each disc (a circle), band
 * (a rectangle), lane (its capsule) and ramp (its quad, its top sloping) with its plan box; `boxes` - the passages with
 * their walls and niches, the heroes, the spans' steps swept through their amplitude and their gaps, the vents, a long
 * hall's walls, a chamber's arch; `rings` - the ring walls and tiers (annuli); `ways` - every way onto a disc `[x, z, hw]`
 * (egMoltenRim's ends - the course's landings, the lanes', bands' and stairs' ends - and every step's ends, the passages'
 * mouths, the ring walls' gaps); `magma` - a magma chamber's sea. Pure; made once a spec.
 * @param {any} spec
 */
/** How far under a piece that falls the ruin keeps clear (m): deeper than any foot or spire of it. */
const EG_RUIN_FALL_DEEP = 120;
function ruinLaw(spec) {
  const floors = [], boxes = [], air = [], rings = [], ways = [];
  let magma = null;
  for (const [i, d] of spec.discs.entries()) floors.push({ t: 'd', i, x: d.x, z: d.z, r: d.r, y: d.y ?? 0, b: [d.x - d.r, d.z - d.r, d.x + d.r, d.z + d.r], top: d.y ?? 0 });
  for (const bd of spec.bands) floors.push({ t: 'b', x0: bd.x - bd.halfW, x1: bd.x + bd.halfW, z0: bd.z0, z1: bd.z1, y: bd.y ?? 0, b: [bd.x - bd.halfW, bd.z0, bd.x + bd.halfW, bd.z1], top: bd.y ?? 0 });
  for (const l of spec.lanes ?? []) {
    const dx = l.bx - l.ax, dz = l.bz - l.az, len = Math.hypot(dx, dz) || 1;
    floors.push({ t: 'l', ax: l.ax, az: l.az, bx: l.bx, bz: l.bz, ux: dx / len, uz: dz / len, len, hw: l.hw, y: l.y ?? 0, b: [Math.min(l.ax, l.bx) - l.hw, Math.min(l.az, l.bz) - l.hw, Math.max(l.ax, l.bx) + l.hw, Math.max(l.az, l.bz) + l.hw], top: l.y ?? 0 });
  }
  for (const q of spec.ramps ?? []) {
    const dx = q.bx - q.ax, dz = q.bz - q.az, len = Math.hypot(dx, dz) || 1;
    floors.push({ t: 'r', ax: q.ax, az: q.az, ux: dx / len, uz: dz / len, len, hw: q.hw, y0: q.y0, y1: q.y1, b: [Math.min(q.ax, q.bx) - q.hw, Math.min(q.az, q.bz) - q.hw, Math.max(q.ax, q.bx) + q.hw, Math.max(q.az, q.bz) + q.hw], top: Math.min(q.y0, q.y1) });
  }
  // the passages: their walls and vaults (an open one's drums from 0.9 under its floor), their niches (world/eliteGates/egHall.js
  // egNicheBoxes - the dungeon's frame), and their mouths a way
  for (const q of spec.caves ?? []) {
    const yLo = Math.min(q.y, q.yB ?? q.y), yHi = Math.max(q.y, q.yB ?? q.y), out = q.open ? 1.4 : 0.6;
    boxes.push([q.x - q.halfW - out, q.open ? yLo - 0.9 : yLo - egWallFoot(q), q.z0, q.x + q.halfW + out, yHi + q.height + (q.kit === 'gloam' ? 10 : 1.2), q.z1]);
    ways.push([q.x, q.z0, q.halfW + 0.6], [q.x, q.z1, q.halfW + 0.6]);
  }
  const ox = SD_REALM_ORIGIN[0] + spec.x0, oz = SD_REALM_ORIGIN[2];
  for (const { b } of egNicheBoxes(spec)) boxes.push([b[0] - ox - 0.1, b[1] - 0.1, b[2] - oz - 0.1, b[3] - ox + 0.1, b[4] + 0.3, b[5] - oz + 0.1]);
  for (const q of spec.heroes ?? []) boxes.push([q.box[0] - 0.5, q.box[1] - 0.5, q.box[2] - 0.5, q.box[3] + 0.5, q.box[4] + 0.5, q.box[5] + 0.5]);
  // the spans' steps: each body swept through its amplitude (the law keeps it), its air over its gaps and a body's arc
  // (the tall pieces keep clear of it), its ends a way
  for (const s of spec.steps ?? []) {
    const hw = s.w / 2 + (s.amp ?? 0);
    boxes.push([s.x - hw - 0.3, s.y - 1.5, s.z - s.d / 2 - 0.3, s.x + hw + 0.3, s.y + 3, s.z + s.d / 2 + 0.3]);
    // (THE AUDIT: a piece turned along its broken bridge - spec law 10's `hd`, 1 +x, 2 -z, 3 -x - leaps along its heading: its
    // air before and after it there, its landing its bridge's lane end)
    const g = s.gap ?? 0, a = s.after ?? 0;
    if (s.hd === 1 || s.hd === 3) { const lo = s.hd === 1 ? g : a, hi = s.hd === 1 ? a : g; air.push([s.x - s.w / 2 - lo - 0.3, s.y - 4, s.z - s.d / 2 - 0.3, s.x + s.w / 2 + hi + 0.3, s.y + 4, s.z + s.d / 2 + 0.3]); }
    else air.push([s.x - hw - 0.3, s.y - 4, s.z - s.d / 2 - (s.hd === 2 ? a : g) - 0.3, s.x + hw + 0.3, s.y + 4, s.z + s.d / 2 + (s.hd === 2 ? g : a) + 0.3]);
    ways.push([s.x, s.z - s.d / 2, hw], [s.x, s.z + s.d / 2, hw]);
    if ((s.road ?? 0) === 0 && s.after > 0 && !s.hd) ways.push([s.x, s.z + s.d / 2 + s.after, s.w / 2]);   // egMoltenRim's landing
  }
  for (const v of spec.vents ?? []) boxes.push([v.x - v.halfW, 0.05, v.z - v.d / 2, v.x + v.halfW, 8, v.z + v.d / 2]);   // a vent's fire, over the walk
  for (const l of spec.lanes ?? []) ways.push([l.ax, l.az, l.hw], [l.bx, l.bz, l.hw]);
  for (const bd of spec.bands) ways.push([bd.x, bd.z0, bd.halfW], [bd.x, bd.z1, bd.halfW]);
  for (const q of spec.ramps ?? []) ways.push([q.ax, q.az, q.hw], [q.bx, q.bz, q.hw]);
  for (const d of spec.deco ?? []) {
    const y = d.y ?? 0;
    if (d.t === 'wall') { rings.push([d.x, d.z, d.r - 0.4, d.r + 1.3, y - 0.6, y + d.h + 2]); ways.push([d.x, d.z - d.r, 0.2 * d.r], [d.x, d.z + d.r, 0.2 * d.r]); }
    else if (d.t === 'tiers') { rings.push([d.x, d.z, d.r - 0.4, d.r + 3.9, y - 0.6, y + d.h * 0.5 + 1]); ways.push([d.x, d.z - d.r, 0.2 * d.r], [d.x, d.z + d.r, 0.2 * d.r]); }
    else if (d.t === 'hall') { for (const sg of [-1, 1]) boxes.push([d.x + sg * d.hw - (sg > 0 ? 0.4 : 1.3), y - 0.6, d.z0, d.x + sg * d.hw + (sg > 0 ? 1.3 : 0.4), y + d.h + 2, d.z1]); ways.push([d.x, d.z0, d.hw], [d.x, d.z1, d.hw]); }
    else if (d.t === 'arch') boxes.push([d.x - d.r - 1.5, y + 0.05, d.z - 0.8, d.x + d.r + 1.5, y + d.h + 0.5, d.z + 0.8]);
    else if (d.t === 'magma') magma = { x: d.x, z: d.z, r: d.r, y };
  }
  if (spec.gate) boxes.push([spec.gate.x - spec.gate.halfW - 0.3, 0.05, spec.gate.z - 0.5, spec.gate.x + spec.gate.halfW + 0.3, 5, spec.gate.z + 0.5]);
  // THE PIECES THAT FALL (the spans' own - scenes/eliteGates/egSpan.js stands each with its own cornice and torn foundation, and fells
  // it): Grath's islands, the Falling Wall's walkway and the Collapsing Tube's floor. Nothing of the ruin under them or in
  // them - a ruin there would hang in the air after they go: each a box or a disc (a ring from its centre) down the deep
  for (const d of spec.discs) if (egIsleDisc(spec, d)) rings.push([d.x, d.z, 0, d.r + 0.05, (d.y ?? 0) - EG_RUIN_FALL_DEEP, (d.y ?? 0) + 0.05]);
  for (const bd of spec.bands) if (egWallBand(spec, bd) || egTubeBand(bd)) boxes.push([bd.x - bd.halfW - 0.05, (bd.y ?? 0) - EG_RUIN_FALL_DEEP, bd.z0, bd.x + bd.halfW + 0.05, (bd.y ?? 0) + 0.05, bd.z1]);
  return { floors, boxes, air, rings, ways, magma };
}
/** Is (x, z) on floor `F` (plan, inclusive)? */
function onFloor(F, x, z) {
  if (x < F.b[0] || x > F.b[2] || z < F.b[1] || z > F.b[3]) return false;
  if (F.t === 'd') { const dx = x - F.x, dz = z - F.z; return dx * dx + dz * dz <= F.r * F.r; }
  if (F.t === 'b') return true;
  const px = x - F.ax, pz = z - F.az, s = px * F.ux + pz * F.uz, t = -px * F.uz + pz * F.ux;
  if (F.t === 'r') return s >= 0 && s <= F.len && Math.abs(t) <= F.hw;
  const sc = clamp(s, 0, F.len);
  return Math.hypot(px - F.ux * sc, pz - F.uz * sc) <= F.hw;   // a lane's capsule (net/eliteGates/egLaw.js egOnFloor's)
}
/** Floor `F`'s top at (x, z) - a ramp's sloping. */
function topOf(F, x, z) {
  if (F.t !== 'r') return F.y;
  return F.y0 + (F.y1 - F.y0) * clamp(((x - F.ax) * F.ux + (z - F.az) * F.uz) / F.len, 0, 1);
}
/** (x, z)'s distance outside floor `F` in plan (negative inside). */
function floorDist(F, x, z) {
  if (F.t === 'd') return Math.hypot(x - F.x, z - F.z) - F.r;
  if (F.t === 'b') { const dx = Math.max(F.x0 - x, x - F.x1), dz = Math.max(F.z0 - z, z - F.z1); return dx > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) : Math.max(dx, dz); }
  const px = x - F.ax, pz = z - F.az, s = px * F.ux + pz * F.uz, t = -px * F.uz + pz * F.ux;
  if (F.t === 'l') { const sc = clamp(s, 0, F.len); return Math.hypot(px - F.ux * sc, pz - F.uz * sc) - F.hw; }
  const ds = Math.max(-s, s - F.len), dt = Math.abs(t) - F.hw;
  return ds > 0 || dt > 0 ? Math.hypot(Math.max(ds, 0), Math.max(dt, 0)) : Math.max(ds, dt);
}
/** May a tall piece of radius `rad` stand at (x, z)? Clear of every way onto a disc by EG_RUIN.wayPad, of every floor's
 *  edge by `floorPad`, of the spans' swept steps by stepPad, of every box and ring wall the law keeps (by `ringPad`). */
/** @param {any} L @param {number} x @param {number} z @param {number} rad @param {number} [floorPad] @param {number} [ringPad] */
function clearTall(L, x, z, rad, floorPad = EG_RUIN.floorPad, ringPad = 0.3) {
  for (const [wx, wz, hw] of L.ways) if (Math.hypot(x - wx, z - wz) - hw < EG_RUIN.wayPad + rad) return false;
  for (const F of L.floors) if (floorDist(F, x, z) < floorPad + rad) return false;
  for (const b of L.boxes) { const pad = rad + 0.5; if (x > b[0] - pad && x < b[3] + pad && z > b[2] - pad && z < b[5] + pad) return false; }
  for (const b of L.air) { const pad = rad + EG_RUIN.stepPad; if (x > b[0] - pad && x < b[3] + pad && z > b[2] - pad && z < b[5] + pad) return false; }
  for (const [cx, cz, r0, r1] of L.rings) { const d = Math.hypot(x - cx, z - cz); if (d > r0 - rad - ringPad && d < r1 + rad + ringPad) return false; }
  return true;
}

// ── THE WRITER: a bucket a band's record, a piece at a time ──────────────────────────────────────────────────────────
/**
 * The ruin's writer (world/eliteGates/meshKit.js's buckets, made for a hall of pieces): every triangle flat-shaded and wound to face
 * the way asked, into a growable Float32Array bucket a (band, record); a PIECE begun, laid, then judged against the hall's
 * law (`commit` - let go whole when any of it stands above a floor's top inside its footprint, or inside the room the law
 * keeps) - its triangles' runs kept as an occluder when asked. Hall frame; packed into the dungeon's.
 */
/** The writers' buckets, kept between halls (a hall's are emptied, never made again - the swap's worker builds circle after
 *  circle): (band, record) -> its arrays. Its content is only ever what a hall wrote, so a build is the same bytes. */
const POOL = new Map();
function ruinWriter() {
  const B = new Map();
  let band = 0, cur = null, curKey = -1, marks = null;
  const lo = [0, 0, 0], hi = [0, 0, 0];
  const pieces = [];
  const bucket = (rec) => {
    const key = band * 1000 + rec;
    if (key === curKey) return cur;
    let g = B.get(key);
    if (!g) {
      g = POOL.get(key);
      if (!g) POOL.set(key, (g = { band, rec, p: new Float32Array(3 * 8192), n: new Float32Array(3 * 8192), uv: new Float32Array(2 * 8192), v: 0 }));
      g.v = 0;
      B.set(key, g);
    }
    if (marks && !marks.has(key)) marks.set(key, g.v);
    cur = g; curKey = key;
    return g;
  };
  const grow = (g) => {
    const cap = (g.p.length / 3) * 2, p = new Float32Array(cap * 3), n = new Float32Array(cap * 3), uv = new Float32Array(cap * 2);
    p.set(g.p); n.set(g.n); uv.set(g.uv); g.p = p; g.n = n; g.uv = uv;
  };
  /** One triangle as wound ((b - a) x (c - a) its face); a degenerate one is let go. */
  function tri(rec, ax, ay, az, bx, by, bz, cx, cy, cz, au, av, bu, bv, cu, cv) {
    const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(l > 1e-10)) return;
    nx /= l; ny /= l; nz /= l;
    const g = bucket(rec);
    if ((g.v + 3) * 3 > g.p.length) grow(g);
    let i = g.v * 3, j = g.v * 2;
    g.p[i] = ax; g.p[i + 1] = ay; g.p[i + 2] = az; g.p[i + 3] = bx; g.p[i + 4] = by; g.p[i + 5] = bz; g.p[i + 6] = cx; g.p[i + 7] = cy; g.p[i + 8] = cz;
    for (let k = 0; k < 3; k++, i += 3) { g.n[i] = nx; g.n[i + 1] = ny; g.n[i + 2] = nz; }
    g.uv[j] = au; g.uv[j + 1] = av; g.uv[j + 2] = bu; g.uv[j + 3] = bv; g.uv[j + 4] = cu; g.uv[j + 5] = cv;
    g.v += 3;
    if (marks) {
      if (ax < lo[0]) lo[0] = ax; if (bx < lo[0]) lo[0] = bx; if (cx < lo[0]) lo[0] = cx; if (ax > hi[0]) hi[0] = ax; if (bx > hi[0]) hi[0] = bx; if (cx > hi[0]) hi[0] = cx;
      if (ay < lo[1]) lo[1] = ay; if (by < lo[1]) lo[1] = by; if (cy < lo[1]) lo[1] = cy; if (ay > hi[1]) hi[1] = ay; if (by > hi[1]) hi[1] = by; if (cy > hi[1]) hi[1] = cy;
      if (az < lo[2]) lo[2] = az; if (bz < lo[2]) lo[2] = bz; if (cz < lo[2]) lo[2] = cz; if (az > hi[2]) hi[2] = az; if (bz > hi[2]) hi[2] = bz; if (cz > hi[2]) hi[2] = cz;
    }
  }
  /** A triangle of points facing `o` (a direction). */
  function T(rec, a, b, c, ua, va, ub, vb, uc, vc, ox, oy, oz) {
    const n0 = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), n1 = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), n2 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (n0 * ox + n1 * oy + n2 * oz >= 0) tri(rec, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], ua, va, ub, vb, uc, vc);
    else tri(rec, a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2], ua, va, uc, vc, ub, vb);
  }
  /** A quad a-b-c-d facing `o` (a direction), its corners' uvs as given. */
  function Q4(rec, a, b, c, d, ua, va, ub, vb, uc, vc, ud, vd, ox, oy, oz) {
    const n0 = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), n1 = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), n2 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (n0 * ox + n1 * oy + n2 * oz >= 0) { tri(rec, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], ua, va, ub, vb, uc, vc); tri(rec, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], ua, va, uc, vc, ud, vd); }
    else { tri(rec, a[0], a[1], a[2], d[0], d[1], d[2], c[0], c[1], c[2], ua, va, ud, vd, uc, vc); tri(rec, a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2], ua, va, uc, vc, ub, vb); }
  }
  /** A quad facing away from point `p` (inside the solid it bounds), a rectangle of uv (u0, v0) at a to (u1, v1) at c. */
  function QA(rec, a, b, c, d, u0, v0, u1, v1, p) {
    const mx = (a[0] + c[0]) / 2 - p[0], my = (a[1] + c[1]) / 2 - p[1], mz = (a[2] + c[2]) / 2 - p[2];
    Q4(rec, a, b, c, d, u0, v0, u1, v0, u1, v1, u0, v1, mx, my, mz);
  }
  const W = {
    tri, T, Q4, QA,
    /** The record the bridges' and arches' walls wear: the academy's ashlar (the ground's wall record), a Brink hall's the
     *  voussoirs' (its two bands' records held to the hall's draws). */
    ashlar: /** @type {number} */ (ASHLAR),
    /** Lay pieces in band `b`'s archive from here. */
    band(b) { band = b; curKey = -1; return W; },
    get bandNow() { return band; },
    /** A piece begun: its triangles judged together at `commit`. */
    begin() { marks = new Map(); curKey = -1; lo[0] = lo[1] = lo[2] = Infinity; hi[0] = hi[1] = hi[2] = -Infinity; },
    /** The piece judged against `law` (ruinLaw) - kept, or let go whole (answers which); `occ` keeps its runs an occluder. */
    /** The piece let go whole (over the hall's budget). */
    drop() { const m = marks; marks = null; curKey = -1; if (m) for (const [key, v] of m) B.get(key).v = v; },
    commit(law, occ = false) {
      const m = marks;
      marks = null; curKey = -1;
      if (!m) return false;
      if (law && breaks(law, m)) { for (const [key, v] of m) B.get(key).v = v; return false; }
      if (occ) {
        const runs = [];
        for (const [key, v] of m) { const g = B.get(key), n = (g.v - v) / 3; if (n > 0) runs.push([key, v / 3, n]); }
        if (runs.length) pieces.push({ runs, b: [lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]] });
      }
      return true;
    },
    /** Every bucket, (band, record) ascending. */
    buckets: () => [...B.entries()].filter(([, g]) => g.v > 0).sort((a, b) => a[0] - b[0]).map(([key, g]) => ({ key, ...g })),
    pieces,
    get triangles() { let n = 0; for (const g of B.values()) n += g.v / 3; return n; },
  };
  /** Does the piece (its buckets' runs since `m`) break the law? Every corner, edge middle and centre of each of its
   *  triangles: none above a floor's top on that floor, none inside a box or a ring wall the law keeps. */
  function breaks(law, m) {
    const F = law.floors.filter((f) => hi[1] > f.top + 1e-3 && f.b[0] <= hi[0] && f.b[2] >= lo[0] && f.b[1] <= hi[2] && f.b[3] >= lo[2]);
    const X = law.boxes.filter((b) => b[0] < hi[0] && b[3] > lo[0] && b[1] < hi[1] && b[4] > lo[1] && b[2] < hi[2] && b[5] > lo[2]);
    const R = law.rings.filter(([cx, cz, r0, r1, y0, y1]) => {
      if (!(y0 < hi[1] && y1 > lo[1])) return false;
      const nx = Math.max(lo[0] - cx, 0, cx - hi[0]), nz = Math.max(lo[2] - cz, 0, cz - hi[2]), fx = Math.max(Math.abs(lo[0] - cx), Math.abs(hi[0] - cx)), fz = Math.max(Math.abs(lo[2] - cz), Math.abs(hi[2] - cz));
      return nx * nx + nz * nz < r1 * r1 && fx * fx + fz * fz > r0 * r0;   // the piece's box meets the annulus
    });
    if (!F.length && !X.length && !R.length) return false;
    // each candidate's box in plan and its height's span, one flat list (a ring's its square - the exact test in `bad`)
    const C = [];
    for (const f of F) C.push(f.b[0], f.top + 1e-3, f.b[1], f.b[2], Infinity, f.b[3]);
    for (const b of X) C.push(b[0], b[1], b[2], b[3], b[4], b[5]);
    for (const q of R) C.push(q[0] - q[3], q[4], q[1] - q[3], q[0] + q[3], q[5], q[1] + q[3]);
    const nC = C.length;
    const bad = (x, y, z) => {
      for (const f of F) if (y > topOf(f, x, z) + 1e-3 && onFloor(f, x, z)) return true;
      for (const b of X) if (x > b[0] && x < b[3] && y > b[1] && y < b[4] && z > b[2] && z < b[5]) return true;
      for (const [cx, cz, r0, r1, y0, y1] of R) { if (y <= y0 || y >= y1) continue; const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz; if (d2 > r0 * r0 && d2 < r1 * r1) return true; }
      return false;
    };
    for (const [key, v0] of m) {
      const g = B.get(key), P = g.p;
      for (let v = v0; v < g.v; v += 3) {
        const i = v * 3, ax = P[i], ay = P[i + 1], az = P[i + 2], bx = P[i + 3], by = P[i + 4], bz = P[i + 5], cx = P[i + 6], cy = P[i + 7], cz = P[i + 8];
        let tx0 = ax, tx1 = ax, ty0 = ay, ty1 = ay, tz0 = az, tz1 = az;
        if (bx < tx0) tx0 = bx; else if (bx > tx1) tx1 = bx;
        if (cx < tx0) tx0 = cx; else if (cx > tx1) tx1 = cx;
        if (by < ty0) ty0 = by; else if (by > ty1) ty1 = by;
        if (cy < ty0) ty0 = cy; else if (cy > ty1) ty1 = cy;
        if (bz < tz0) tz0 = bz; else if (bz > tz1) tz1 = bz;
        if (cz < tz0) tz0 = cz; else if (cz > tz1) tz1 = cz;
        let near = false;
        for (let c = 0; c < nC; c += 6) if (C[c] <= tx1 && C[c + 3] >= tx0 && C[c + 2] <= tz1 && C[c + 5] >= tz0 && C[c + 1] < ty1 && C[c + 4] > ty0) { near = true; break; }
        if (!near) continue;
        if (bad(ax, ay, az) || bad(bx, by, bz) || bad(cx, cy, cz) || bad((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2) || bad((bx + cx) / 2, (by + cy) / 2, (bz + cz) / 2)
          || bad((ax + cx) / 2, (ay + cy) / 2, (az + cz) / 2) || bad((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3)) return true;
      }
    }
    return false;
  }

  return W;
}
/** @typedef {ReturnType<typeof ruinWriter>} RuinWriter */

// ── THE SHAPES (hall frame; a frame `f` places a figure: its foot, its yaw, its scale) ──────────────────────────────────
/** A frame: origin (x, y, z), turned `yaw` (its +z toward (sin yaw, cos yaw)), scaled `k`. */
const frame = (x, y, z, yaw = 0, k = 1) => ({ x, y, z, c: Math.cos(yaw), s: Math.sin(yaw), k });
const ID = frame(0, 0, 0);
/** A point of frame `f`'s, in the hall's. */
const at = (f, x, y, z) => [f.x + (x * f.c + z * f.s) * f.k, f.y + y * f.k, f.z + (-x * f.s + z * f.c) * f.k];
/** A direction of frame `f`'s, in the hall's. */
const dirOf = (f, x, y, z) => [x * f.c + z * f.s, y, -x * f.s + z * f.c];

/**
 * LATHE: profile `[[r, y], ...]` (bottom to top along its surface, the solid on the axis side) turned about frame `f`'s
 * upright through (cx, cy, cz) in `sides` steps from `a0` - its faces out by the profile's own normal. `wraps` the record
 * round it (whole, so it meets itself; by default ~2 m a repeat), `vOf(y)` a profile height's v (2 m a repeat, top up),
 * `jit(k, j)` a corner's radius share (a broken drum, a rough skull).
 */
function lathe(W, rec, f, cx, cy, cz, prof, sides, { a0 = 0, wraps = 0, vOf = (y) => -y / 2, jit = null } = {}) {
  let rmax = 0;
  for (const p of prof) if (p[0] > rmax) rmax = p[0];
  const U = wraps || Math.max(1, Math.round((TAU * rmax * f.k) / 2)), n = prof.length, grid = new Array((sides + 1) * n), vs = prof.map((p) => vOf(p[1]));
  for (let k = 0; k <= sides; k++) {
    const a = a0 + (k / sides) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0; j < n; j++) { const r = prof[j][0] * (jit ? jit(k % sides, j) : 1); grid[k * n + j] = at(f, cx + ca * r, cy + prof[j][1], cz + sa * r); }
  }
  for (let k = 0; k < sides; k++) {
    const am = a0 + ((k + 0.5) / sides) * TAU, ca = Math.cos(am), sa = Math.sin(am), u0 = (k / sides) * U, u1 = ((k + 1) / sides) * U;
    for (let j = 0; j + 1 < n; j++) {
      const r0 = prof[j][0], y0 = prof[j][1], r1 = prof[j + 1][0], y1 = prof[j + 1][1];
      if (r0 <= 0 && r1 <= 0) continue;
      const ox = (y1 - y0) * ca, oy = -(r1 - r0), oz = (y1 - y0) * sa, wx = ox * f.c + oz * f.s, wz = -ox * f.s + oz * f.c, v0 = vs[j], v1 = vs[j + 1];
      const A = grid[k * n + j], Bq = grid[(k + 1) * n + j], C = grid[(k + 1) * n + j + 1], D = grid[k * n + j + 1];
      if (r0 <= 0) W.T(rec, A, C, D, (u0 + u1) / 2, v0, u1, v1, u0, v1, wx, oy, wz);
      else if (r1 <= 0) W.T(rec, A, Bq, C, u0, v0, u1, v0, (u0 + u1) / 2, v1, wx, oy, wz);
      else W.Q4(rec, A, Bq, C, D, u0, v0, u1, v0, u1, v1, u0, v1, wx, oy, wz);
    }
  }
}
/** A BEAM: a box `w` across and `h` deep from point a to point b (hall frame) - a rod, a girder, a limb, an architrave;
 *  `caps` closes its ends; uv metres over 2 (u along it). */
function beam(W, rec, a, b, w, h, { caps = true, up = null, uS = 0.5, v0 = 0, v1 = 0 } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
  if (!(len > 1e-6)) return;
  const d = [dx / len, dy / len, dz / len], u = up ?? (Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]);
  let sx = d[1] * u[2] - d[2] * u[1], sy = d[2] * u[0] - d[0] * u[2], sz = d[0] * u[1] - d[1] * u[0];
  const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
  const ux = sy * d[2] - sz * d[1], uy = sz * d[0] - sx * d[2], uz = sx * d[1] - sy * d[0];
  const C = (p, i, j) => [p[0] + sx * i * w / 2 + ux * j * h / 2, p[1] + sy * i * w / 2 + uy * j * h / 2, p[2] + sz * i * w / 2 + uz * j * h / 2];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const vv = v1 > v0;
  for (let k = 0; k < 4; k++) {
    const [i0, j0] = corners[k], [i1, j1] = corners[(k + 1) % 4], side = (k % 2 ? h : w);
    const A = C(a, i0, j0), Bp = C(a, i1, j1), Cp = C(b, i1, j1), Dp = C(b, i0, j0);
    if (vv) W.QA(rec, A, Bp, Cp, Dp, 0, v0, side * uS, v1, mid); else W.QA(rec, A, Bp, Cp, Dp, 0, 0, side * uS, len * uS, mid);
  }
  if (caps) for (const [p, s] of [[a, -1], [b, 1]]) { const q = corners.map(([i, j]) => C(p, i, j)); W.QA(rec, q[0], q[1], q[2], q[3], 0, 0, w * uS, h * uS, [p[0] - d[0] * s, p[1] - d[1] * s, p[2] - d[2] * s]); }
}
/** A TUBE of `sides` sides from point a (radius r0) to point b (r1), its ends closed - a volute, a rod, a horn; u round
 *  it (once), v along it over `vS` a metre. */
function tube(W, rec, a, b, r0, r1, sides, { v0 = 0, vS = 0.5, v1 = null, caps = true } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
  if (!(len > 1e-6)) return;
  const d = [dx / len, dy / len, dz / len], u = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let sx = d[1] * u[2] - d[2] * u[1], sy = d[2] * u[0] - d[0] * u[2], sz = d[0] * u[1] - d[1] * u[0];
  const sl = Math.hypot(sx, sy, sz); sx /= sl; sy /= sl; sz /= sl;
  const tx = sy * d[2] - sz * d[1], ty = sz * d[0] - sx * d[2], tz = sx * d[1] - sy * d[0];
  const R = (p, r, k) => { const t = (k / sides) * TAU, c = Math.cos(t) * r, q = Math.sin(t) * r; return [p[0] + sx * c + tx * q, p[1] + sy * c + ty * q, p[2] + sz * c + tz * q]; };
  for (let k = 0; k < sides; k++) {
    const t = ((k + 0.5) / sides) * TAU, o = [sx * Math.cos(t) + tx * Math.sin(t), sy * Math.cos(t) + ty * Math.sin(t), sz * Math.cos(t) + tz * Math.sin(t)];
    const ve = v1 ?? v0 + len * vS;
    W.Q4(rec, R(a, r0, k), R(a, r0, k + 1), R(b, r1, k + 1), R(b, r1, k), k / sides, v0, (k + 1) / sides, v0, (k + 1) / sides, ve, k / sides, ve, o[0], o[1], o[2]);
    if (caps) { W.T(rec, a, R(a, r0, k), R(a, r0, k + 1), 0.5, v0, 0, v0, 1, v0, -d[0], -d[1], -d[2]); W.T(rec, b, R(b, r1, k), R(b, r1, k + 1), 0.5, v0, 0, v0, 1, v0, d[0], d[1], d[2]); }
  }
}
/** A BOX in frame `f`: from (x0, y0, z0) to (x1, y1, z1) of its own; `skip` the faces left off (by name); u metres over
 *  `1 / uS` along each face; v (EG_KIT_MAP's way) 'up' - the height in the hall over 2 m a repeat - or 'down' from the box's
 *  top, or `[v0, v1]` from its top to its foot (a band of a record); its top and bottom planar.
 *  @param {any} W @param {number} rec @param {any} f @param {number} x0 @param {number} y0 @param {number} z0
 *  @param {number} x1 @param {number} y1 @param {number} z1 @param {{ skip?: string, uS?: number, v?: string | number[] }} [o] */
function fbox(W, rec, f, x0, y0, z0, x1, y1, z1, { skip = '', uS = 0.5, v = 'down' } = {}) {
  const P = (x, y, z) => at(f, x, y, z), c = at(f, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), k = f.k;
  const wy0 = f.y + y0 * k, wy1 = f.y + y1 * k;
  const [vt, vb] = Array.isArray(v) ? v : v === 'up' ? [wy1 * uS, wy0 * uS] : [0, (y1 - y0) * k * uS];
  /** @type {Array<[string, number[][], number]>} */
  const sides = [
    ['nz', [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)], x1 - x0],
    ['pz', [P(x0, y1, z1), P(x1, y1, z1), P(x1, y0, z1), P(x0, y0, z1)], x1 - x0],
    ['nx', [P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1), P(x0, y0, z0)], z1 - z0],
    ['px', [P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), P(x1, y0, z0)], z1 - z0],
  ];
  for (const [name, q, w] of sides) if (!skip.includes(name)) W.QA(rec, q[0], q[1], q[2], q[3], 0, vt, w * uS * k, vb, c);
  const planar = Array.isArray(v) ? [v[0], v[0] + (v[1] - v[0]) * 0.5] : null;
  for (const [name, y] of /** @type {Array<[string, number]>} */ ([['top', y1], ['bottom', y0]])) {
    if (skip.includes(name)) continue;
    const q = [P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)];
    if (planar) W.QA(rec, q[0], q[1], q[2], q[3], 0, planar[0], (x1 - x0) * uS * k, planar[1], c);
    else W.QA(rec, q[0], q[1], q[2], q[3], 0, 0, (x1 - x0) * uS * k, (z1 - z0) * uS * k, c);
  }
}
/** An OCTAHEDRON (a gem, a staff's head): radius r at (x, y, z) of frame `f`, `tall` its height's share. */
function gem(W, rec, f, x, y, z, r, tall = 1.6) {
  const c = at(f, x, y, z), top = at(f, x, y + r * tall, z), bot = at(f, x, y - r * tall, z);
  const rim = [0, 1, 2, 3].map((k) => at(f, x + Math.cos((k / 4) * TAU) * r, y, z + Math.sin((k / 4) * TAU) * r));
  for (let k = 0; k < 4; k++) {
    const a = rim[k], b = rim[(k + 1) % 4];
    for (const t of [top, bot]) { const m = [(a[0] + b[0] + t[0]) / 3 - c[0], (a[1] + b[1] + t[1]) / 3 - c[1], (a[2] + b[2] + t[2]) / 3 - c[2]]; W.T(rec, a, b, t, 0, 0.5, 0.5, 0.5, 0.25, t === top ? 0 : 1, m[0], m[1], m[2]); }
  }
}
/** A CHAIN of `n` links from `a` straight down (the chain record - EG_KIT_MAP: each bar u 0-1 along it, a link's faces, its
 *  outer and its inner walls each in their band), alternate links a quarter turned, each a loop of four bars. Answers its
 *  foot's height. */
function chain(W, a, n, link = 0.32) {
  const w = link * 0.58, th = link * 0.13, pitch = link - 2 * th, ho = w / 2, vo = link / 2;
  for (let i = 0; i < n; i++) {
    const cy = a[1] - th - i * pitch - link / 2, e = i % 2 ? [0, 0, 1] : [1, 0, 0], nrm = i % 2 ? [1, 0, 0] : [0, 0, 1];
    const P = (s, y, d) => [a[0] + e[0] * s + nrm[0] * d, cy + y, a[2] + e[2] * s + nrm[2] * d];
    const out = [[-ho, -vo], [ho, -vo], [ho, vo], [-ho, vo]], inn = [[-ho + th, -vo + th], [ho - th, -vo + th], [ho - th, vo - th], [-ho + th, vo - th]], hd = th / 2;
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4, o0 = out[k], o1 = out[k1], i0 = inn[k], i1 = inn[k1];
      for (const d of [-hd, hd]) { const nd = [nrm[0] * d, 0, nrm[2] * d]; W.Q4(K.chain, P(o0[0], o0[1], d), P(o1[0], o1[1], d), P(i1[0], i1[1], d), P(i0[0], i0[1], d), 0, CHB.faces[0], 1, CHB.faces[0], 1, CHB.faces[1], 0, CHB.faces[1], nd[0], nd[1], nd[2]); }
      const mo = [e[0] * (o0[0] + o1[0]) / 2, (o0[1] + o1[1]) / 2, e[2] * (o0[0] + o1[0]) / 2];
      W.Q4(K.chain, P(o0[0], o0[1], -hd), P(o1[0], o1[1], -hd), P(o1[0], o1[1], hd), P(o0[0], o0[1], hd), 0, CHB.outer[0], 1, CHB.outer[0], 1, CHB.outer[1], 0, CHB.outer[1], mo[0], mo[1], mo[2]);
      W.Q4(K.chain, P(i0[0], i0[1], -hd), P(i1[0], i1[1], -hd), P(i1[0], i1[1], hd), P(i0[0], i0[1], hd), 0, CHB.inner[0], 1, CHB.inner[0], 1, CHB.inner[1], 0, CHB.inner[1], -mo[0], -mo[1], -mo[2]);
    }
  }
  return a[1] - n * pitch - 2 * th;
}

// ── THE CORNICE (section 3.2) ────────────────────────────────────────────────────────────────────────────────────────
/**
 * A CORNICE along an edge: `path` points (hall frame, at the floor's top), each with its way out `[nx, nz]` (horizontal,
 * unit) and its miter `m` (the offset's stretch at a corner - 1 on a straight run); `prof` the band's profile ([out, dy],
 * crown to foot), laid `gap` past the edge and `under` beneath the top. u along the edge (2 m a repeat), v down the profile.
 * `ends` closes its two ends (a run cut short).
 */
function corniceRun(W, rec, path, P, { closed = false, ends = true } = {}) {
  const G = EG_RUIN_CORNICE.gap, U = EG_RUIN_CORNICE.under, n = path.length, segs = closed ? n : n - 1, prof = P.pts;
  // each face's v: its band of the moulding (EG_KIT_MAP), shared along the faces that wear it by their length
  const vA = [], vB = [];
  for (let j = 0; j + 1 < prof.length;) {
    let e = j;
    while (e + 1 < prof.length - 1 && P.bands[e + 1] === P.bands[j]) e++;
    const band = MB[P.bands[j]], seg = [];
    let tot = 0;
    for (let q = j; q <= e; q++) { const l = Math.hypot(prof[q + 1][0] - prof[q][0], prof[q + 1][1] - prof[q][1]); seg.push(l); tot += l; }
    let acc = 0;
    for (let q = j; q <= e; q++) { vA[q] = lerp(band[0], band[1], acc / tot); acc += seg[q - j]; vB[q] = lerp(band[0], band[1], acc / tot); }
    j = e + 1;
  }
  // the profile drawn in so its reach at a mitred corner stays within EG_RUIN_CORNICE.reach of the floor's edge
  let reach = 0, mm = 1;
  for (const q of prof) reach = Math.max(reach, q[0]);
  for (const q of path) mm = Math.max(mm, q.m);
  const sc = Math.min(1, (EG_RUIN_CORNICE.reach / mm - G - 1e-3) / reach);
  const pt = (p, j) => { const o = (G + prof[j][0] * sc) * p.m; return [p.x + p.nx * o, p.y - U + prof[j][1], p.z + p.nz * o]; };
  const grid = path.map((p) => prof.map((_, j) => pt(p, j)));   // each corner's profile, once
  let along = 0;
  for (let s = 0; s < segs; s++) {
    const A = path[s], Bq = path[(s + 1) % n], L = Math.hypot(Bq.x - A.x, Bq.z - A.z), nx = (A.nx + Bq.nx) / 2, nz = (A.nz + Bq.nz) / 2;
    for (let j = 0; j + 1 < prof.length; j++) {
      const du = prof[j + 1][0] - prof[j][0], dv = prof[j + 1][1] - prof[j][1];
      const o = [-dv * nx, du, -dv * nz];   // the profile's left hand: out and up
      const GA = grid[s], GB = grid[(s + 1) % n];
      W.Q4(rec, GA[j], GB[j], GB[j + 1], GA[j + 1], along / 2, vA[j], (along + L) / 2, vA[j], (along + L) / 2, vB[j], along / 2, vB[j], o[0], o[1], o[2]);
    }
    along += L;
  }
  if (closed || !ends) return;
  // the ends: each profile face back to the edge's line, a slice at a time
  for (const [p, q] of [[path[0], path[1]], [path[n - 1], path[n - 2]]]) {
    const tx = p.x - q.x, tz = p.z - q.z;   // facing on, out of the run
    for (let j = 0; j + 1 < prof.length; j++) {
      if (Math.abs(prof[j + 1][1] - prof[j][1]) < 1e-6) continue;
      const a = pt(p, j), b = pt(p, j + 1), back = (y) => [p.x + p.nx * G * p.m, y, p.z + p.nz * G * p.m];
      W.Q4(rec, a, b, back(b[1]), back(a[1]), prof[j][0] / 2, vA[j], prof[j + 1][0] / 2, vB[j], 0, vB[j], 0, vA[j], tx, 0, tz);
    }
  }
}
/** The Wellhead's cornice spikes: iron points hanging under its block, one each 1.2 m of `path`. */
function corniceSpikes(W, path, closed) {
  const n = path.length, segs = closed ? n : n - 1, G = EG_RUIN_CORNICE.gap;
  let carry = 0.6;
  for (let s = 0; s < segs; s++) {
    const A = path[s], Bq = path[(s + 1) % n], L = Math.hypot(Bq.x - A.x, Bq.z - A.z);
    for (let t = carry; t < L; t += 1.2) {
      const k = t / L, x = lerp(A.x, Bq.x, k), z = lerp(A.z, Bq.z, k), y = lerp(A.y, Bq.y, k) - EG_RUIN_CORNICE.under - 0.55, nx = lerp(A.nx, Bq.nx, k), nz = lerp(A.nz, Bq.nz, k), o = (G + 0.26) * A.m;
      const c = [x + nx * o, y, z + nz * o], tip = [c[0], y - 0.32, c[2]], q = [[0.07, 0], [0, 0.07], [-0.07, 0], [0, -0.07]].map(([a, b]) => [c[0] + a, y, c[2] + b]);
      for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], m = [(a[0] + b[0]) / 2 - c[0], -0.1, (a[2] + b[2]) / 2 - c[2]]; W.T(K.fixture, a, b, tip, 0, 0.3, 0.1, 0.3, 0.05, 0.9, m[0], m[1], m[2]); }
      carry = t + 1.2 - L;
    }
    if (carry >= L) carry -= L;
  }
}
/** A disc's rim as a cornice's path: its own polygon's corners (world/superDungeon/sdRealm.js realmIsland's SD_ISLAND_SIDES - every second
 *  one under a small disc's), each mitred out by the half-angle's secant. */
const rimSides = (r) => (r <= 3.5 ? SD_ISLAND_SIDES / 3 : r < 7 ? SD_ISLAND_SIDES / 2 : SD_ISLAND_SIDES);
function rimPath(d) {
  const N = rimSides(d.r), m = 1 / Math.cos(Math.PI / N), out = [];
  for (let k = 0; k < N; k++) { const a = (k / N) * TAU; out.push({ x: d.x + Math.cos(a) * d.r, y: d.y ?? 0, z: d.z + Math.sin(a) * d.r, nx: Math.cos(a), nz: Math.sin(a), m, a }); }
  return out;
}

// ── THE FOUNDATIONS (section 3.1) ────────────────────────────────────────────────────────────────────────────────────
/**
 * Disc `d`'s foundations into the writer, each part a piece the law judges (`piece(fn)`): the floor's slab under its lip
 * and the courses stepped in, the rubble skirt and its cap; the spires (the Hour's hangPlan, the band's shape -
 * EG_RUIN_FORMS) and the band's thin ones about them; under a court or an isle the band's hanging thing.
 */
function foundation(W, piece, d, band, seed, lite) {
  const F = formOf(band), style = egKitStyle(band), y0 = (d.y ?? 0) - SD_LIP, N = rimSides(d.r), rec = K.found;
  const big = d.r >= 10, nC = Math.max(1, Math.min(lite ? 2 : F.course.n, Math.floor((d.r * 0.42) / F.course.step))), FV = EG_FOUND_V;
  // the found record's strata (EG_KIT_MAP): its texels near square - a band's rows over its face's height, repeated whole
  // round the ring at that size (the slab's six rows over its 0.6 m, a course's eight over its height, the rubble's)
  const perOf = (rows, h, r) => Math.max(1, Math.round((TAU * r) / ((EG_KIT_MAP[K.found].w * h) / rows)));
  const ringAt = (r, y, jitR = 0, jitY = 0, key = 0) => {
    const out = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * TAU, jr = jitR ? 1 + jitR * (2 * h01(seed, key, k) - 1) : 1, jy = jitY ? jitY * (2 * h01(seed, key + 50, k) - 1) : 0;
      out.push([d.x + Math.cos(a) * r * jr, y + jy, d.z + Math.sin(a) * r * jr]);
    }
    return out;
  };
  const centre = (y) => [d.x, y, d.z];
  const wall = (A, B, va, vb, mid, per) => { for (let k = 0; k < N; k++) { const k1 = (k + 1) % N; W.QA(rec, A[k], A[k1], B[k1], B[k], (k / N) * per, va, ((k + 1) / N) * per, vb, mid); } };
  let r = d.r - 0.002, y = y0, Bk = null, rFoot = 0;
  const skirt = (big ? 2.2 : 1.4) + 0.6 * h01(seed, 12), H = EG_KIT_MAP[K.found].h;
  piece(() => {
    // the slab: the lip's face carried down, in the record's slab
    const A = ringAt(r, y);
    Bk = ringAt(r, y - EG_RUIN.slab);
    wall(A, Bk, FV.slab[0], FV.slab[1], centre(y - 0.3), perOf((FV.slab[1] - FV.slab[0]) * H, EG_RUIN.slab, r));
    y -= EG_RUIN.slab;
    // the courses, each set in by the band's step, the lower ones broken - each one of the record's courses, its ledge the
    // shadowed rows at the foot of the course over it
    for (let c = 0; c < nC; c++) {
      const r1 = r - F.course.step * (0.85 + 0.3 * h01(seed, 11, c)), j = c < 2 ? 0 : 0.02 * c, per = perOf(8, F.course.h, r1);
      const cv0 = FV.course[0] + Math.min(c, 4) * FV.row, cv1 = Math.min(FV.course[1], cv0 + FV.row), lv = c ? cv0 - 2 / H : FV.slab[1] - 1 / H;
      const top = ringAt(r1, y, j, 0, 100 + c), bottom = ringAt(r1, y - F.course.h, j * 1.5, c >= nC - 1 ? 0.12 : 0, 200 + c);
      for (let k = 0; k < N; k++) { const k1 = (k + 1) % N; W.Q4(rec, Bk[k], Bk[k1], top[k1], top[k], (k / N) * per, lv, ((k + 1) / N) * per, lv, ((k + 1) / N) * per, lv + 1.5 / H, (k / N) * per, lv + 1.5 / H, 0, -1, 0); }   // the ledge, facing down
      wall(top, bottom, cv0, cv1, centre(y - F.course.h / 2), per);
      Bk = bottom; r = r1; y -= F.course.h;
    }
    // the rubble skirt, jagged, and its cap
    rFoot = r * 0.9;
    const foot = ringAt(rFoot, y - skirt, 0.06, 0.45, 300), per = perOf((FV.rubble[1] - FV.rubble[0]) * H, skirt, r);
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N;
      W.QA(rec, Bk[k], Bk[k1], foot[k1], foot[k], (k / N) * per, FV.rubble[0], ((k + 1) / N) * per, FV.rubble[1], centre(y - skirt / 2));
      W.T(rec, centre(y - skirt + 0.02), foot[k], foot[k1], 0.5, FV.rubble[1], (k / N) * per, FV.rubble[1], ((k + 1) / N) * per, FV.rubble[1], 0, -1, 0);
    }
  });
  if (!rFoot) return;
  const yF = y - skirt;
  // the spires: the Hour's plan, hung from the skirt's foot, in the band's shape
  const n = lite ? 1 : clamp(Math.round(d.r / 4) + 2, 3, 6);
  const plan = hangPlan({ x: d.x, z: d.z, y: yF - SD_HANG.top + SD_HANG.skirt, r: rFoot / SD_HANG.foot, seed: (seed ^ 0x51ee) >>> 0, spires: n, chains: 0, gears: 0 }, { lite });
  const L0 = plan.L0 * F.spire.len, vOf = F.spire.rec === K.crystal ? (yy) => yy / 2 : (yy) => lerp(FV.deep[0], FV.deep[1], clamp((yF - yy) / L0, 0, 1));
  const S = d.r <= 3.5 ? { ...F.spire, rings: Math.max(4, F.spire.rings - 2) } : F.spire;
  plan.spires.forEach((s, j) => piece(() => spire(W, S, { ...s, len: s.len * F.spire.len }, yF, seed, j, vOf)));
  // the band's thin ones about them: the Cairn's roots, the Shade's stalactites, the Wellhead's prisms
  const sats = lite || d.r <= 3.5 ? 0 : Math.round(F.spire.sats * Math.min(2, d.r / 8));
  for (let j = 0; j < sats; j++) {
    const a = h01(seed, 13, j) * TAU, rr = rFoot * (0.45 + 0.42 * h01(seed, 14, j)), R = Math.max(0.35, rFoot * (0.06 + 0.07 * h01(seed, 15, j)));
    piece(() => spire(W, F.spire, { x: d.x + Math.cos(a) * rr, z: d.z + Math.sin(a) * rr, R, len: L0 * (0.2 + 0.35 * h01(seed, 16, j)), bendA: a, bend: 0 }, yF, seed, 40 + j, vOf));
  }
  if (!lite && (d.role === 'court' || d.role === 'isle')) hanging(W, piece, style.hanging, d, yF, rFoot, plan, seed);
}
/**
 * ONE SPIRE (world/superDungeon/sdIslandModel.js islandRoot's, in the band's shape `S`): `s` its plan (top centre, radius, length, its
 * bend's bearing and reach), hung from `foot`; rings jittered, stepped (the cake), twisted; its broken tip into the haze.
 */
function spire(W, S, s, foot, seed, j, vOf) {
  const rec = S.rec, R = S.rings, n = S.sides, rings = [], metric = rec !== K.found;
  // the found record the Hour's way (whole repeats round, its texels near square to the strata's); a crystal's 2 m a repeat
  const U = metric ? Math.max(1, Math.round((TAU * s.R) / 2)) : Math.max(1, Math.round((TAU * s.R * 2) / Math.max(2, s.len * 1.4)));
  for (let i = 0; i < R; i++) {
    const t = i / (R - 1), b = (s.bend || S.bend * s.len) * t * t, cx = s.x + Math.cos(s.bendA) * b, cz = s.z + Math.sin(s.bendA) * b;
    const y = foot + 0.05 - s.len * t, rr = s.R * (1 - (1 - S.tip) * Math.pow(t, 1.1)), tw = S.twist * i;
    const ring = [], step = i > 0 && i < R - 1 ? 1 + S.step * (0.6 + 0.8 * h01(seed, j, 80 + i)) : 1;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + j + tw, r = rr * (1 + S.jitter * (2 * h01(seed, j, i, k) - 1));
      const dy = i === R - 1 && S.tip < 0.5 ? rr * 1.2 * (h01(seed, j, 50 + i, k) - 0.5) : 0;
      ring.push([cx + Math.cos(a) * r, y + dy, cz + Math.sin(a) * r]);
    }
    rings.push({ cx, cz, y, ring, outer: ring.map((p) => [cx + (p[0] - cx) * step, p[1], cz + (p[2] - cz) * step]) });
  }
  for (let i = 0; i + 1 < R; i++) {
    const A = rings[i], Bq = rings[i + 1], mid = [(A.cx + Bq.cx) / 2, (A.y + Bq.y) / 2, (A.cz + Bq.cz) / 2], ledge = i + 1 < R - 1 && S.step > 0;
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n, u0 = (k / n) * U, u1 = ((k + 1) / n) * U;
      W.QA(rec, A.ring[k], A.ring[k1], Bq.outer[k1], Bq.outer[k], u0, vOf(A.y), u1, vOf(Bq.y), mid);
      if (ledge) W.Q4(rec, Bq.outer[k], Bq.outer[k1], Bq.ring[k1], Bq.ring[k], u0, vOf(Bq.y), u1, vOf(Bq.y), u1, vOf(Bq.y), u0, vOf(Bq.y), 0, -1, 0);
    }
  }
  const last = rings[R - 1], flat = S.tip >= 0.5;
  const tip = flat ? [last.cx, last.y - 0.02, last.cz] : [last.cx + s.R * S.tip * 0.4, last.y - Math.max(0.6, s.R * (0.6 + 1.2 * S.tip)), last.cz];
  const hv = metric ? vOf(last.y) : Math.max(EG_FOUND_V.haze, vOf(last.y)), tv = metric ? vOf(tip[1]) : 0.98;
  for (let k = 0; k < n; k++) W.T(rec, last.ring[k], last.ring[(k + 1) % n], tip, (k / n) * U, hv, ((k + 1) / n) * U, hv, ((k + 0.5) / n) * U, tv, 0, -1, 0);
}
/** UNDER A COURT, the band's hanging thing (section 1, EG_KIT_STYLE.hanging), between the outer spires. */
function hanging(W, piece, kind, d, yF, rF, plan, seed) {
  const outer = plan.spires.slice(1), n = kind === 'chandelier' ? 1 : kind === 'cage' ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const a = (outer.length ? Math.atan2(outer[i % outer.length].z - d.z, outer[i % outer.length].x - d.x) + Math.PI / Math.max(2, outer.length) : 0) + i * 2.1 + 0.4 * h01(seed, 60, i);
    const rr = rF * (0.62 + 0.18 * h01(seed, 61, i)), x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr, top = [x, yF + 0.1, z];
    piece(() => hangOne(W, kind, a, x, z, top, yF, rF, seed, i));
  }
}
/** One hanging thing at (x, z) under the skirt's foot `yF` (`top` its anchor). */
function hangOne(W, kind, a, x, z, top, yF, rF, seed, i) {
  {
    if (kind === 'chandelier') {
      // three iron rods to a hub, two iron crowns of candle cups
      const R = clamp(rF * 0.12, 1.2, 2.4), drop = 4 + 3 * h01(seed, 62, i), hub = [x, yF - drop, z];
      for (let k = 0; k < 3; k++) { const b = (k / 3) * TAU; beam(W, K.fixture, [x + Math.cos(b) * R * 0.7, yF + 0.1, z + Math.sin(b) * R * 0.7], hub, 0.07, 0.07, { caps: false, v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] }); }
      beam(W, K.fixture, [x, yF + 0.1, z], [x, hub[1] - 1.6, z], 0.12, 0.12, { v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] });
      for (const [rr2, dy] of [[R, -0.9], [R * 0.6, -1.5]]) {
        const pts = Array.from({ length: 12 }, (_, k) => [x + Math.cos((k / 12) * TAU) * rr2, hub[1] + dy, z + Math.sin((k / 12) * TAU) * rr2]);
        for (let k = 0; k < 12; k++) beam(W, K.fixture, pts[k], pts[(k + 1) % 12], 0.09, 0.07, { caps: false, v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] });
        for (let k = 0; k < 12; k += 2) { beam(W, K.fixture, [x, hub[1], z], pts[k], 0.05, 0.05, { caps: false, v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] }); lathe(W, K.fixture, ID, pts[k][0], pts[k][1], pts[k][2], [[0, 0], [0.05, 0.02], [0.11, 0.16], [0.09, 0.17], [0, 0.1]], 5, { vOf: (y) => lerp(EG_FIXTURE_V.body[0], EG_FIXTURE_V.body[1], y / 0.17) }); }
      }
    } else if (kind === 'cage') {
      // a soul-gem in an iron cage on a chain
      const end = chain(W, top, 3 + Math.floor(3 * h01(seed, 63, i)), 0.4), cy = end - 0.85, R = 0.42;
      const bv = (h) => (y) => lerp(EG_FIXTURE_V.body[0], EG_FIXTURE_V.body[1], y / h);
      grille(W, frame(x, cy - 0.75, z), [[R, 0], [R, 1.5]], 6);
      lathe(W, K.fixture, ID, x, cy + 0.75, z, [[R + 0.04, 0], [R + 0.04, 0.06], [0.08, 0.32], [0, 0.34]], 6, { vOf: bv(0.34) });
      lathe(W, K.fixture, ID, x, cy - 0.81, z, [[0, 0], [R + 0.04, 0], [R + 0.04, 0.06], [0, 0.06]], 6, { vOf: bv(0.06) });
      beam(W, K.fixture, [x, cy + 1.09, z], [x, end + 0.02, z], 0.05, 0.05, { caps: false, v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] });
      gem(W, K.crystal, ID, x, cy, z, 0.24, 1.8);
    } else if (kind === 'shards') {
      // a long black-glass shard, its silver veins in the record
      const R = 0.5 + 0.5 * h01(seed, 64, i);
      spire(W, { sides: 4, rings: 3, jitter: 0.12, bend: 0, tip: 0.02, step: 0, twist: 0.4, rec: K.crystal }, { x, z, R, len: 7 + 6 * h01(seed, 65, i), bendA: a, bend: 0.4 }, yF + 0.3, seed, 90 + i, (yy) => yy / 2);
    } else {
      // an iron girder bent through the rock, and a chain hanging from it
      const L = clamp(rF * 0.9, 3, 9), b = a + Math.PI / 2, p0 = [x - Math.cos(b) * L, yF - 1.5, z - Math.sin(b) * L], p1 = [x, yF - 2.4 - 1.5 * h01(seed, 66, i), z], p2 = [x + Math.cos(b) * L * 0.8, yF - 0.6 - 2.5 * h01(seed, 67, i), z + Math.sin(b) * L * 0.8];
      for (const [p, q] of [[p0, p1], [p1, p2]]) { beam(W, K.fixture, p, q, 0.36, 0.08, { v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] }); beam(W, K.fixture, [p[0], p[1] - 0.25, p[2]], [q[0], q[1] - 0.25, q[2]], 0.1, 0.42, { caps: false, v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] }); beam(W, K.fixture, [p[0], p[1] - 0.5, p[2]], [q[0], q[1] - 0.5, q[2]], 0.36, 0.08, { v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] }); }
      chain(W, [p2[0], p2[1] - 0.55, p2[2]], 4 + Math.floor(4 * h01(seed, 68, i)), 0.45);
    }
  }
}

// ── THE BRIDGES (section 3.1) ────────────────────────────────────────────────────────────────────────────────────────
/** How far an arch of span `w` rises from its springing (EG_KIT_STYLE.arch): a round arch half its span, a pointed
 *  (equilateral) one 0.87 of it, a lancet's (its arcs 1.3 spans round) a little more than its span, a squat segment a
 *  quarter. */
export function egArchRise(style, w) {
  if (style === 'round') return w / 2;
  if (style === 'squat') return w / 4;
  const R = (style === 'lancet' ? 1.3 : 1) * w;
  return Math.sqrt(R * R - (R - w / 2) ** 2);
}
/** An arch's intrados at t (0 one springing, 1 the other) of span `w`: `[s, h, ns, nh]` - its point across the span and over
 *  the springing, and its way out (from the arc's centre; a pointed arch's two arcs each their own). */
function archAt(style, w, t) {
  const hw = w / 2;
  if (style === 'round') { const a = Math.PI * (1 - t); return [Math.cos(a) * hw, Math.sin(a) * hw, Math.cos(a), Math.sin(a)]; }
  if (style === 'squat') {
    const rise = w / 4, R = (hw * hw + rise * rise) / (2 * rise), c = rise - R, a = lerp(Math.atan2(-c, -hw), Math.atan2(-c, hw), t);
    return [Math.cos(a) * R, c + Math.sin(a) * R, Math.cos(a), Math.sin(a)];
  }
  const R = (style === 'lancet' ? 1.3 : 1) * w, off = R - hw;   // a pointed arch: the left half's arc about (off, 0), the right's about (-off, 0)
  if (t <= 0.5) { const a = lerp(Math.PI, Math.acos(-off / R), t * 2); return [off + Math.cos(a) * R, Math.sin(a) * R, Math.cos(a), Math.sin(a)]; }
  const a = lerp(Math.acos(off / R), 0, (t - 0.5) * 2);
  return [-off + Math.cos(a) * R, Math.sin(a) * R, Math.cos(a), Math.sin(a)];
}
/**
 * AN ARCH of voussoirs in frame `f` (its x across the span, from -w/2 to w/2; its z through the arch, ±th/2): springing at
 * `ys`, the ring `ring` deep in `blocks` blocks (radial joints, each the voussoir record whole), its soffit under it; `fill`
 * the spandrels' top (the ashlar filled from the ring up to it), or null - a freestanding ring, its back the voussoirs'.
 */
function archRing(W, f, style, w, ys, th, ring, blocks, fill) {
  const pts = [];
  for (let k = 0; k <= blocks; k++) { const [s, h, ns, nh] = archAt(style, w, k / blocks); pts.push([s, ys + h, ns, nh]); }
  const P = (s, y, t) => at(f, s, y, t), rv = ring / 2;
  let ua = 0;
  for (let k = 0; k < blocks; k++) {
    const [as, ah, an, anh] = pts[k], [bs, bh, bn, bnh] = pts[k + 1], ub = ua + Math.hypot(bs - as, bh - ah) / 2;
    const ea = [as + an * ring, ah + anh * ring], eb = [bs + bn * ring, bh + bnh * ring];
    for (const t of [-th / 2, th / 2]) { const o = dirOf(f, 0, 0, t); W.Q4(K.voussoir, P(as, ah, t), P(bs, bh, t), P(eb[0], eb[1], t), P(ea[0], ea[1], t), ua, 0, ub, 0, ub, rv, ua, rv, o[0], o[1], o[2]); }
    const si = dirOf(f, -(an + bn), -(anh + bnh), 0);   // the soffit, facing in under the arch
    W.Q4(K.voussoir, P(as, ah, -th / 2), P(bs, bh, -th / 2), P(bs, bh, th / 2), P(as, ah, th / 2), ua, 0, ub, 0, ub, Math.min(0.5, th / 4), ua, Math.min(0.5, th / 4), si[0], si[1], si[2]);
    if (fill != null) {
      for (const t of [-th / 2, th / 2]) { const o = dirOf(f, 0, 0, t); W.Q4(W.ashlar, P(ea[0], ea[1], t), P(eb[0], eb[1], t), P(eb[0], fill, t), P(ea[0], fill, t), ea[0] / 2, ea[1] / 2, eb[0] / 2, eb[1] / 2, eb[0] / 2, fill / 2, ea[0] / 2, fill / 2, o[0], o[1], o[2]); }
    } else {
      const ob = dirOf(f, an + bn, anh + bnh, 0);
      W.Q4(K.voussoir, P(ea[0], ea[1], -th / 2), P(eb[0], eb[1], -th / 2), P(eb[0], eb[1], th / 2), P(ea[0], ea[1], th / 2), ua, rv, ub, rv, ub, rv + th / 4, ua, rv + th / 4, ob[0], ob[1], ob[2]);
    }
    ua = ub;
  }
}
/** A PIER in frame `f` (x from s0 to s1, z ±th/2): from `yTop` down to about `yFoot`, its foot broken to a jagged point in
 *  the foundation record - its faces the ashlar. */
function pier(W, f, s0, s1, th, yTop, yFoot, seed, key) {
  const P = (s, y, t) => at(f, s, y, t), c = at(f, (s0 + s1) / 2, (yTop + yFoot) / 2, 0);
  const q = [[s0, -th / 2], [s1, -th / 2], [s1, th / 2], [s0, th / 2]], feet = q.map((_, k) => yFoot + 2.5 * h01(seed, key, k));
  for (let k = 0; k < 4; k++) {
    const [a0, b0] = q[k], [a1, b1] = q[(k + 1) % 4], k1 = (k + 1) % 4, len = Math.hypot(a1 - a0, b1 - b0);
    W.QA(W.ashlar, P(a0, yTop, b0), P(a1, yTop, b1), P(a1, feet[k1], b1), P(a0, feet[k], b0), 0, yTop / 2, len / 2, Math.min(feet[k], feet[k1]) / 2, c);   // the ashlar's v up
  }
  const tip = P((s0 + s1) / 2 + 0.2 * (h01(seed, key, 9) - 0.5), yFoot - 2.5 - 2 * h01(seed, key, 8), 0.1);
  for (let k = 0; k < 4; k++) {
    const [a0, b0] = q[k], [a1, b1] = q[(k + 1) % 4], A = P(a0, feet[k], b0), Bq = P(a1, feet[(k + 1) % 4], b1), m = [(A[0] + Bq[0]) / 2 - c[0], -0.5, (A[2] + Bq[2]) / 2 - c[2]];
    W.T(K.found, A, Bq, tip, 0, EG_FOUND_V.deep[0], 0.5, EG_FOUND_V.deep[0], 0.25, EG_FOUND_V.haze, m[0], m[1], m[2]);
  }
}
/** The frame standing at (x, z) whose x runs along the way (ux, uz) and whose z across it (world `at`'s turn: its +x is
 *  (c, -s) - so c = ux, s = -uz). */
const alongFrame = (x, y, z, ux, uz) => ({ x, y, z, c: ux, s: -uz, k: 1 });
/**
 * A WAY'S BRIDGE: under a run from (ax, az) to (bx, bz) of half-width `hw`, its deck's foot at `yd` - each bay an arch of
 * the band's style springing from piers that fall into the void, the spandrels filled up to the deck. Each bay is a piece
 * the law judges; the run is cut first where a box the law keeps (a step's body, a passage's walls, a chamber) stands under
 * the deck, so the law keeps the bays either side of it.
 */
function bridge(W, piece, band, seed, run, lite, law = null) {
  if (law) { for (const r of bridgeRuns(law, run)) bridge(W, piece, band, seed, r, lite); return; }
  const { ax, az, bx, bz, hw, yd } = run, L = Math.hypot(bx - ax, bz - az);
  if (L < 2) return;
  const ux = (bx - ax) / L, uz = (bz - az) / L, style = egKitStyle(band).arch, th = 2 * hw - 0.1;
  const nb = Math.max(1, Math.round(L / (lite ? EG_RUIN.bayLite : lerp(EG_RUIN.bay[0], EG_RUIN.bay[1], h01(seed, 70))))), bay = L / nb;
  const pw = Math.min(1.1, bay * 0.16), fall = lerp(EG_RUIN.fall[0], EG_RUIN.fall[1], h01(seed, 71));
  const pt = (s) => [ax + ux * s, az + uz * s];
  for (let i = 0; i < nb; i++) {
    const s0 = i * bay, s1 = (i + 1) * bay, span = bay - pw, rise = egArchRise(style, span);
    const ys = yd - 0.25 - rise - 0.45, [mx, mz] = pt((s0 + s1) / 2);
    piece(() => {
      archRing(W, alongFrame(mx, 0, mz, ux, uz), style, span, ys, th, 0.45, style === 'squat' ? 7 : 11, yd);
      for (const ps of i === 0 ? [s0, s1] : [s1]) {
        const [px, pz] = pt(ps);
        pier(W, alongFrame(px, 0, pz, ux, uz), -pw / 2, pw / 2, th + 0.1, yd, ys - fall * (0.8 + 0.4 * h01(seed, 72, i)), seed, 700 + i * 7 + (ps === s0 ? 1 : 0));
      }
    });
  }
}
/** A bridge's run cut where a box the law keeps stands under its deck (within its width and a pier's reach along it, from
 *  the deck's top - `top`, a passage's slab's, else its foot `yd` - down a fall's depth): the runs either side of it, each
 *  at least 2 m, its ends held a pier's half clear. */
function bridgeRuns(law, run) {
  const { ax, az, bx, bz, hw, yd } = run, L = Math.hypot(bx - ax, bz - az), top = run.top ?? yd;
  if (!(L >= 2)) return [];
  const ux = (bx - ax) / L, uz = (bz - az) / L, n = Math.max(2, Math.ceil(L / 0.25)), w = hw + 0.15, PAD = 0.7, out = [];
  const boxes = law.boxes.filter((b) => b[1] < top - 1e-3 && b[4] > yd - EG_RUIN.fall[1] - 4);
  const discs = law.rings.filter((q) => q[2] === 0 && q[4] < top - 1e-3 && q[5] > yd - EG_RUIN.fall[1] - 4);   // an island that falls
  if (!boxes.length && !discs.length) return [run];
  const ok = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * L, x = ax + ux * s, z = az + uz * s, ex = Math.abs(uz) * w + Math.abs(ux) * PAD, ez = Math.abs(ux) * w + Math.abs(uz) * PAD;
    ok.push(!boxes.some((b) => x + ex > b[0] && x - ex < b[3] && z + ez > b[2] && z - ez < b[5]) && !discs.some((q) => Math.hypot(x - q[0], z - q[1]) < q[3] + w + PAD));
  }
  if (ok.every(Boolean)) return [run];
  for (let i = 0; i <= n;) {
    if (!ok[i]) { i++; continue; }
    let j = i;
    while (j + 1 <= n && ok[j + 1]) j++;
    const s0 = (i / n) * L, s1 = (j / n) * L;
    if (s1 - s0 >= 2) out.push({ ...run, ax: ax + ux * s0, az: az + uz * s0, bx: ax + ux * s1, bz: az + uz * s1 });
    i = j + 1;
  }
  return out;
}

// ── THE COLUMN RINGS (section 3.3): THE PLAN ─────────────────────────────────────────────────────────────────────────
/** The roles a ring of columns stands round, and the lamps a disc carries (world/eliteGates/egHall.js egCircleLights' count: six a
 *  court or isle, two a plate, one a bastion, balcony or perch). */
const RING_ROLES = Object.freeze(['court', 'isle', 'arrive', 'end', 'bastion']);
export const egDiscLamps = (d) => (d.role === 'court' || d.role === 'isle' ? 6 : d.role === 'arrive' || d.role === 'end' ? 2 : d.role === 'bastion' || d.role === 'balcony' || d.role === 'perch' ? 1 : 0);
/** A fixture's reach about its column (m, at full size - the bowl, the basket, the globe; the lantern's from its flame). */
const FIXTURE_R = Object.freeze({ tripod: 0.5, lantern: 0.36, moonlamp: 0.26, basket: 0.47 });
/**
 * Where disc `d`'s ring stands: `R` and its columns' radius `rad` - the rim plus EG_RUIN.ring; and `gap` - where a ring
 * wall or a chamber's tiers stand too near the rim for the ring, its lamps stand slim in the gap between (`{ R, rad, room }`,
 * their fixtures made to fit its room) and the ring beyond the arcade's room or the tiers' benches.
 */
function ringOf(spec, d, band) {
  const rad0 = formOf(band).col.r;
  let R = d.r + EG_RUIN.ring, gap = null;
  for (const q of spec.deco ?? []) {
    if ((q.t !== 'wall' && q.t !== 'tiers') || Math.hypot(q.x - d.x, q.z - d.z) > 0.5 || q.r <= d.r) continue;
    if (q.r - d.r >= EG_RUIN.ring + 2 * rad0 + 1.2) continue;   // the ring stands inside the wall
    const room = q.r - 0.4 - d.r;
    gap = { R: d.r + room / 2, rad: clamp(room / 2 - 0.3, 0.16, 0.3), room };
    R = (q.t === 'wall' ? q.r + 1.3 : q.r + 3.9) + rad0 + 0.8;
  }
  return { R, rad: rad0, gap };
}
/** The fixture's light over its column's top (EG_FIXTURE_FLAME, at size `k`): over the column, or - the Cairn's lantern -
 *  hung out on its gallows toward the floor where the ring has room, else along the ring. */
function flameAt(kind, x, z, top, cx, cz, rDisc, k) {
  const y = top + 0.05 + EG_FIXTURE_FLAME[kind] * k;
  if (kind !== 'lantern') return [x, y, z];
  const d = Math.hypot(x - cx, z - cz) || 1, room = d - rDisc - 0.45 - FIXTURE_R.lantern * k;
  if (room >= GALLOWS * k) return [x + ((cx - x) / d) * GALLOWS * k, y, z + ((cz - z) / d) * GALLOWS * k];
  return [x - ((z - cz) / d) * GALLOWS * k, y, z + ((x - cx) / d) * GALLOWS * k];   // a narrow ring: the arm along it
}
const _plans = new Map();
/**
 * THE COLUMN RINGS OF HALL `spec`, planned (hall frame; pure, cached a spec and tier): `cols` - each column `{ d, k, kind
 * ('lamp' | 'whole' | 'broken' | 'statue'), x, z, a, rad, foot, top, floor, band, slot, ring, cx, cz }` (`k` its lamp, or -1;
 * a lamp's `flame` its light and `fk` its fixture's size); `arches` - the plates' two `{ d, x, z, w, h, foot, floor, band,
 * key }`; `among` - the band's things `{ d, x, z, floor, band, key, foot }`; `lamps` - each disc's lamp on its column `{ d,
 * k, at: [x, y, z], band }` (`lamp(d, k)` finds one, null where none could stand clear - world/eliteGates/egHall.js egCircleLights
 * keeps that lamp where it was). The lamps' columns are the same on both tiers.
 * @param {any} spec @param {{ lite?: boolean }} [o]
 */
export function egRuinColumns(spec, { lite = false } = {}) {
  const key = `${spec.seed >>> 0}:${spec.h}:${spec.geo ?? 0}:${spec.laid ?? 0}:${spec.v ?? 0}:${lite ? 1 : 0}`;
  const had = _plans.get(key);
  if (had && had.spec === spec) return had.plan;
  const plan = planRings(spec, lite);
  if (_plans.size >= 64) _plans.delete(_plans.keys().next().value);
  _plans.set(key, { spec, plan });
  return plan;
}
function planRings(spec, lite) {
  const seed = hallSeed(spec), L = ruinLaw(spec), cols = [], arches = [], among = [], lamps = [], magma = L.magma;
  spec.discs.forEach((d, i) => {
    const nl = egDiscLamps(d), ring = RING_ROLES.includes(d.role), y = d.y ?? 0;
    if (!nl && !ring && d.role !== 'island') return;
    if (egIsleDisc(spec, d)) return;   // Grath's islands fall (the spans' own, each with its cornice and torn foundation): no ring round them
    const band0 = bandAt(spec, seed, d.x, y, d.z, i), { R, rad, gap } = ringOf(spec, d, band0), ds = (seed ^ Math.imul(i + 1, 0x632be5ab)) >>> 0;
    const footOf = (x, z, j) => {
      const f = y - lerp(EG_RUIN.depth[0], EG_RUIN.depth[1], h01(ds, 5, j));
      return magma && Math.abs(x - magma.x) < magma.r && Math.abs(z - magma.z) < magma.r ? Math.max(f, magma.y - 0.3) : f;   // rising out of the magma
    };
    const taken = [];
    // THE LAMPS first: each nearest its old bearing (egCircleLights' k / n of a turn and an eighth) where it stands clear,
    // on the ring (or the gap's), else on a ring a step and two out, within its share of the turn
    const lrad = gap ? gap.rad : rad, fp = gap ? 0.15 : EG_RUIN.floorPad, rp = gap ? 0.05 : 0.3;
    for (let k = 0; k < nl; k++) {
      const a0 = (k / nl) * TAU + Math.PI / 4, lim = Math.PI / Math.max(1, nl) - 0.03;
      let got = null;
      for (const LR of gap ? [gap.R] : [R, R + 2.5, R + 5]) for (let step = 0; step * 0.035 <= lim && !got; step++) for (const sg of step ? [1, -1] : [1]) {
        const a = a0 + sg * step * 0.035, x = d.x + Math.cos(a) * LR, z = d.z + Math.sin(a) * LR;
        const cb = bandAt(spec, seed, x, y, z, 1000 + i * 16 + k), kind = egKitStyle(cb).fixture, fk = gap ? clamp((gap.room / 2 - fp - 0.03) / FIXTURE_R[kind], 0.45, 1) : 1;
        if (!clearTall(L, x, z, Math.max(lrad, FIXTURE_R[kind] * fk), fp, rp) || taken.some((t) => Math.hypot(t[0] - x, t[1] - z) < 2 * lrad + 1.6)) continue;
        const top = y + lerp(EG_RUIN.lampTop[0], EG_RUIN.lampTop[1], h01(ds, 6, k)), flame = flameAt(kind, x, z, top, d.x, d.z, d.r, fk);
        if (kind === 'lantern' && !clearTall(L, flame[0], flame[2], FIXTURE_R.lantern * fk, fp, rp)) continue;
        got = { d: i, k, kind: 'lamp', x, z, a, rad: lrad, foot: footOf(x, z, 100 + k), top, floor: y, band: cb, slot: -1, ring: LR, cx: d.x, cz: d.z, flame, fk };
        break;
      }
      if (got) { cols.push(got); taken.push([got.x, got.z]); lamps.push(Object.freeze({ d: i, k, at: Object.freeze(got.flame), band: got.band })); }
    }
    const place = (a) => [d.x + Math.cos(a) * R, d.z + Math.sin(a) * R];
    if (d.role === 'island') {
      // a span's island: a broken column or two beside the course
      if (lite) return;
      for (let j = 0; j < 2; j++) {
        const a = h01(ds, 7, j) * TAU, [x, z] = place(a);
        if (!clearTall(L, x, z, rad)) continue;
        cols.push({ d: i, k: -1, kind: 'broken', x, z, a, rad, foot: footOf(x, z, j), top: y + lerp(-2, 3.5, h01(ds, 8, j)), floor: y, band: bandAt(spec, seed, x, y, z, 2000 + i * 8 + j), slot: -1, ring: R, cx: d.x, cz: d.z });
      }
      return;
    }
    if (!ring) return;
    // THE RING: a column each 6-9 m of arc (lite 12), clear of the lamps' and of every way; one in three whole, the whole
    // ones of a ring the one height (their entablatures run level)
    const pitch = lite ? EG_RUIN.pitchLite : lerp(EG_RUIN.pitch[0], EG_RUIN.pitch[1], h01(ds, 9));
    const n = Math.max(4, Math.round((TAU * R) / pitch)), a0 = h01(ds, 10) * TAU, wholeAt = Math.floor(h01(ds, 11) * EG_RUIN.wholeEvery);
    const H = y + lerp(EG_RUIN.whole[0], EG_RUIN.whole[1], h01(ds, 12)), slots = [];
    for (let j = 0; j < n; j++) {
      const a = a0 + (j / n) * TAU, [x, z] = place(a);
      if (taken.some((t) => Math.hypot(t[0] - x, t[1] - z) < Math.max(2 * rad + 1.6, pitch * 0.55)) || !clearTall(L, x, z, rad)) continue;
      const whole = j % EG_RUIN.wholeEvery === wholeAt && d.role !== 'arrive' && d.role !== 'end';
      slots.push({ d: i, k: -1, kind: whole ? 'whole' : 'broken', x, z, a, rad, foot: footOf(x, z, j), top: whole ? H : y + lerp(EG_RUIN.broken[0], EG_RUIN.broken[1], h01(ds, 13, j)), floor: y, band: bandAt(spec, seed, x, y, z, 3000 + i * 64 + j), slot: j, ring: R, cx: d.x, cz: d.z, n });
    }
    // THE STATUES (section 3.4): one or two a court on broken plinths, in slots that stand clear for a figure
    if (!lite && d.role === 'court') {
      const want = 1 + (h01(ds, 14) < 0.6 ? 1 : 0), cands = slots.filter((c) => c.kind === 'broken' && clearTall(L, c.x, c.z, 1.3));
      cands.sort((p, q) => h01(ds, 15, p.slot) - h01(ds, 15, q.slot));
      for (const c of cands.slice(0, want)) c.kind = 'statue';
    }
    cols.push(...slots);
    // THE PLATES' ARCHES: beyond the plate's sides, framing the way on (the course runs along z)
    if (d.role === 'arrive' || d.role === 'end') for (const sx of [-1, 1]) {
      for (const dz of [0, 1.5, -1.5, 3, -3]) {
        const x = d.x + sx * (d.r + 3.4), z = d.z + dz, w = 3.2, kk = 4000 + i * 4 + (sx > 0 ? 1 : 0);
        if (!clearTall(L, x, z - w / 2 - 0.4, 0.6) || !clearTall(L, x, z + w / 2 + 0.4, 0.6) || taken.some((t) => Math.hypot(t[0] - x, t[1] - z) < w / 2 + 2)) continue;
        arches.push({ d: i, x, z, w, h: y + 5.2 + 1.2 * h01(ds, 16, sx + 1), foot: y - lerp(14, 24, h01(ds, 17, sx + 1)), floor: y, band: bandAt(spec, seed, x, y, z, kk), key: kk });
        break;
      }
    }
    // THE BAND'S THINGS among the columns (a court's and an isle's), out past the ring
    if (d.role === 'court' || d.role === 'isle') {
      const m = lite ? 2 : d.role === 'court' ? 5 : 3;
      for (let j = 0; j < m; j++) {
        const a = a0 + ((j + 0.5) / m) * TAU + 0.3 * (h01(ds, 18, j) - 0.5), rr = R + 2.2 + 2.5 * h01(ds, 19, j), x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr;
        if (!clearTall(L, x, z, 1.4) || cols.some((c) => c.d === i && Math.hypot(c.x - x, c.z - z) < c.rad + 2.2)) continue;
        among.push({ d: i, x, z, a, floor: y, band: bandAt(spec, seed, x, y, z, 5000 + i * 8 + j), key: 5000 + i * 8 + j, foot: footOf(x, z, 300 + j) });
      }
    }
  });
  const byKey = new Map(lamps.map((l) => [`${l.d}:${l.k}`, l]));
  return Object.freeze({ cols, arches, among, lamps, lamp: (d, k) => byKey.get(`${d}:${k}`) ?? null });
}

// ── THE COLUMNS, LAID ────────────────────────────────────────────────────────────────────────────────────────────────
/** A column's shaft profile: its plinth and torus at its foot, the shaft (its entasis), and - whole - its necking. */
function column(W, c, lite) {
  const F = formOf(c.band), r = c.rad, sides = F.col.sides, style = egKitStyle(c.band), wraps = EG_KIT_MAP[K.shaft].around[clamp(c.band, 0, 3)];
  const base = c.foot, top = c.top, vOf = (yy) => (yy - c.floor) / 2, a0 = c.band === 3 ? Math.PI / 6 : 0;   // the shaft's v up it, its flutes or faces whole round
  // the torn foundation block it stands on, and its plinth and torus
  const blk = { x: c.x, z: c.z, R: r * 1.9, len: 2.5 + 2.5 * h01(c.foot * 977 | 0, 3), bendA: c.a, bend: 0.2 };
  spire(W, { sides: 5, rings: 3, jitter: 0.2, bend: 0, tip: 0.15, step: 0.1, twist: 0, rec: K.found }, blk, base - 0.55, (c.x * 131 + c.z * 71) | 0, 7, (yy) => lerp(EG_FOUND_V.rubble[0], EG_FOUND_V.deep[1], clamp((base - yy) / 6, 0, 1)));
  fbox(W, K.voussoir, frame(c.x, base - 0.55, c.z, c.a), -r * 1.35, 0, -r * 1.35, r * 1.35, 0.55, r * 1.35, { skip: '' });
  lathe(W, K.moulding, ID, c.x, base, c.z, [[r * 1.24, 0], [r * 1.2, 0.2], [r, 0.36]], sides, { a0, vOf: (yy) => mv('cove', 1 - yy / 0.36) });
  // the shaft, broken - its top a jagged break (a lamp's column flat under its fixture), or whole under its capital
  const yTop = top - (c.kind === 'whole' ? 0.85 : 0), rt = r * F.col.taper, mid = lerp(r, rt, 0.4);
  const prof = [[r, base + 0.36], [mid, lerp(base + 0.36, yTop, 0.45)], [rt, yTop]];
  lathe(W, K.shaft, ID, c.x, 0, c.z, prof, sides, { a0, wraps, vOf });
  if (c.kind === 'whole') capital(W, c, style.capital, rt, yTop, sides, a0);
  else if (c.kind === 'lamp') {
    lathe(W, K.shaft, ID, c.x, yTop, c.z, [[rt, 0], [rt * 0.98, 0.04], [0, 0.05]], sides, { a0, wraps, vOf: (yy) => vOf(yTop + yy) });
    fixture(W, c, style.fixture, yTop + 0.05, lite);
  } else breakTop(W, c, rt, yTop, sides, a0, wraps, vOf);
}
/** A broken column's top: the last drum knocked askew and its break jagged. */
function breakTop(W, c, r, y, sides, a0, wraps, vOf) {
  const s = (c.x * 53 + c.z * 97) | 0, h = 0.5 + 0.5 * h01(s, 1), ox = 0.08 * (h01(s, 2) - 0.5), oz = 0.08 * (h01(s, 3) - 0.5);
  const ring = [], top = [];
  for (let k = 0; k < sides; k++) {
    const a = a0 + (k / sides) * TAU, jr = 1 - 0.04 * h01(s, 4, k);
    ring.push([c.x + ox + Math.cos(a) * r * jr, y + 0.02, c.z + oz + Math.sin(a) * r * jr]);
    top.push([c.x + ox + Math.cos(a) * r * jr * 0.97, y + h * (0.3 + 0.7 * h01(s, 5, k)), c.z + oz + Math.sin(a) * r * jr * 0.97]);
  }
  const ctr = [c.x + ox, y + h * (0.4 + 0.5 * h01(s, 6)), c.z + oz], mid = [c.x, y + h / 2, c.z];
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides, u0 = (k / sides) * wraps, u1 = ((k + 1) / sides) * wraps;
    W.QA(K.shaft, ring[k], ring[k1], top[k1], top[k], u0, vOf(y), u1, vOf(y + h), mid);
    W.T(K.shaft, top[k], top[k1], ctr, u0, vOf(y + h), u1, vOf(y + h), (u0 + u1) / 2, vOf(y + h) + 0.1, 0, 1, 0);
  }
}
/** A whole column's capital (the band's form, EG_KIT_STYLE.capital) over its necking at `y`, its abacus's top at y + 0.85. */
function capital(W, c, kind, r, y, sides, a0) {
  const f = frame(c.x, y, c.z, Math.atan2(c.cx - c.x, c.cz - c.z)), vM = (yy) => mv('ornament', 1 - yy / 0.5), ab = { v: [MB.fillet[0], MB.band[1]] };
  lathe(W, K.moulding, ID, c.x, y, c.z, [[r, 0], [r * 1.06, 0.06], [r * 1.06, 0.12], [r, 0.14]], sides, { a0, vOf: (yy) => mv('band', 1 - yy / 0.14) });
  if (kind === 'scroll') {
    lathe(W, K.moulding, ID, c.x, y + 0.14, c.z, [[r, 0], [r * 1.3, 0.16], [r * 1.38, 0.3], [r * 1.2, 0.38]], sides, { a0, vOf: vM });
    for (const sx of [-1, 1]) { tube(W, K.moulding, at(f, sx * r * 1.22, 0.42, -r * 1.3), at(f, sx * r * 1.22, 0.42, r * 1.3), 0.21, 0.21, 8, { v0: MB.ornament[0], v1: MB.ornament[1] }); tube(W, K.moulding, at(f, sx * r * 1.22, 0.42, -r * 1.36), at(f, sx * r * 1.22, 0.42, r * 1.36), 0.09, 0.09, 6, { v0: MB.band[0], v1: MB.band[1] }); }
    fbox(W, K.moulding, f, -r * 1.45, 0.62, -r * 1.45, r * 1.45, 0.85, r * 1.45, ab);
  } else if (kind === 'skull') {
    lathe(W, K.moulding, ID, c.x, y + 0.14, c.z, [[r * 0.95, 0], [r * 1.25, 0.12], [r * 1.3, 0.3], [r * 1.0, 0.5]], sides, { a0, vOf: vM });
    for (let k = 0; k < 4; k++) {
      const a = Math.atan2(c.cz - c.z, c.cx - c.x) + (k / 4) * TAU, sx = c.x + Math.cos(a) * r * 1.15, sz = c.z + Math.sin(a) * r * 1.15;
      lathe(W, K.statue, ID, sx, y + 0.2, sz, [[0, 0], [0.16, 0.04], [0.2, 0.2], [0.17, 0.33], [0, 0.38]], 6, { vOf: (yy) => (y + yy) / 2 });
      fbox(W, K.statue, frame(sx, y + 0.12, sz, Math.PI / 2 - a), -0.11, 0, 0.0, 0.11, 0.13, 0.16, { v: 'up' });
    }
    fbox(W, K.moulding, f, -r * 1.4, 0.62, -r * 1.4, r * 1.4, 0.85, r * 1.4, ab);
  } else if (kind === 'crescent') {
    lathe(W, K.moulding, ID, c.x, y + 0.14, c.z, [[r, 0], [r * 1.4, 0.3], [r * 1.42, 0.4], [r * 1.1, 0.48]], sides, { a0, vOf: vM });
    fbox(W, K.moulding, f, -r * 1.3, 0.48, -r * 1.3, r * 1.3, 0.62, r * 1.3, ab);
    // the crescent standing on its abacus, facing the floor - in the metal band (the Shade's silver)
    const pts = [];
    for (let k = 0; k <= 8; k++) { const t = (k / 8) * Math.PI; pts.push([Math.cos(t) * 0.62, 0.62 + 0.25 + Math.sin(t) * 0.55]); }
    for (let k = 8; k >= 0; k--) { const t = (k / 8) * Math.PI; pts.push([Math.cos(t) * 0.42 + 0.0, 0.62 + 0.25 + Math.sin(t) * 0.32 + 0.12]); }
    for (let k = 0; k < 8; k++) {
      const a = pts[k], b = pts[k + 1], ib = pts[16 - k - 1], ia = pts[16 - k];
      const u0 = k / 8, u1 = (k + 1) / 8, b0 = MB.band[0], b1 = MB.band[1];
      for (const t of [-0.06, 0.06]) { const o = dirOf(f, 0, 0, t); W.Q4(K.moulding, at(f, a[0], a[1], t), at(f, b[0], b[1], t), at(f, ib[0], ib[1], t), at(f, ia[0], ia[1], t), u0, b0, u1, b0, u1, b1, u0, b1, o[0], o[1], o[2]); }
      const om = dirOf(f, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.87, 0), oi = dirOf(f, -(ia[0] + ib[0]) / 2, -((ia[1] + ib[1]) / 2 - 0.87), 0);
      W.Q4(K.moulding, at(f, a[0], a[1], -0.06), at(f, b[0], b[1], -0.06), at(f, b[0], b[1], 0.06), at(f, a[0], a[1], 0.06), u0, b0, u1, b0, u1, b1, u0, b1, om[0], om[1], om[2]);
      W.Q4(K.moulding, at(f, ia[0], ia[1], -0.06), at(f, ib[0], ib[1], -0.06), at(f, ib[0], ib[1], 0.06), at(f, ia[0], ia[1], 0.06), u0, b0, u1, b0, u1, b1, u0, b1, oi[0], oi[1], oi[2]);
    }
  } else {
    lathe(W, K.moulding, ID, c.x, y + 0.14, c.z, [[r, 0], [r * 1.3, 0.2], [r * 1.3, 0.5]], sides, { a0, vOf: vM });
    fbox(W, K.moulding, f, -r * 1.4, 0.5, -r * 1.4, r * 1.4, 0.85, r * 1.4, ab);
    for (let k = 0; k < 6; k++) {
      const a = a0 + (k / 6) * TAU, b0 = [c.x + Math.cos(a) * r * 1.3, y + 0.7, c.z + Math.sin(a) * r * 1.3], tip = [c.x + Math.cos(a) * (r * 1.3 + 0.7), y + 1.15, c.z + Math.sin(a) * (r * 1.3 + 0.7)];
      beam(W, K.fixture, b0, tip, 0.12, 0.12, { v0: FXB.body[0], v1: FXB.body[1] });
    }
  }
}
/** THE FLAME: one of the fixture record's four cells of light (EG_FIXTURE_V - lit, the ruin's one emissive, cut out of the
 *  dark) on a crossed quad EG_FIXTURE_V.quad metres at size `k`, its foot at `y0`, both faces of each. */
function flame(W, x, y0, z, k, cell) {
  const [qw, qh] = EG_FIXTURE_V.quad, w = (qw * k) / 2, h = qh * k, u0 = cell / EG_FIXTURE_V.cells, u1 = (cell + 1) / EG_FIXTURE_V.cells, [v0, v1] = EG_FIXTURE_V.flame;
  for (const [ax, az] of [[1, 0], [0, 1]]) {
    const A = [x - ax * w, y0 + h, z - az * w], Bq = [x + ax * w, y0 + h, z + az * w], C = [Bq[0], y0, Bq[2]], D = [A[0], y0, A[2]];
    for (const sg of [1, -1]) W.Q4(K.fixture, A, Bq, C, D, u0, v0, u1, v0, u1, v1, u0, v1, -az * sg, 0, ax * sg);
  }
}
/** A GRILLE: the fixture record's bars (cut out between them) round a cage or a basket - a lathe's both faces. */
function grille(W, f, prof, sides) {
  const [g0, g1] = EG_FIXTURE_V.grille, y0 = prof[0][1], y1 = prof[prof.length - 1][1], vOf = (yy) => lerp(g1, g0, (yy - y0) / (y1 - y0 || 1));
  lathe(W, K.fixture, f, 0, 0, 0, prof, sides, { vOf, wraps: 1 });
  lathe(W, K.fixture, f, 0, 0, 0, [...prof].reverse(), sides, { vOf, wraps: 1 });   // its inner face: the profile run back
}
/** THE LAMP'S FIXTURE (section 3.3, EG_KIT_STYLE.fixture) on a column's top `y`, at its size `c.fk`: its body the fixture
 *  record's body, its cage or basket its grille, its light a flame cell on a crossed quad (EG_FIXTURE_V) - centred where
 *  egRuinColumns' plan put the lamp (`c.flame`, EG_FIXTURE_FLAME over the fixture's foot). */
function fixture(W, c, kind, y, lite) {
  const k = c.fk ?? 1, f = frame(c.x, y, c.z, 0, k), sides = lite ? 5 : 7, [b0, b1] = EG_FIXTURE_V.body, fl = c.flame;
  const body = (h) => (yy) => lerp(b0, b1, clamp(yy / h, 0, 1));
  const rod = (p, q, w, caps = true) => beam(W, K.fixture, at(f, ...p), at(f, ...q), w * k, w * k, { caps, v0: b0, v1: b1 });
  const cell = Math.floor(h01((Math.round(c.x * 31) ^ Math.round(c.z * 17)) >>> 0, 67) * EG_FIXTURE_V.cells), qh = EG_FIXTURE_V.quad[1] * k;
  if (kind === 'tripod') {
    // a bronze tripod: three splayed legs, a bowl, the fire in it
    for (let j = 0; j < 3; j++) { const a = (j / 3) * TAU + (c.a ?? 0); rod([Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36], [Math.cos(a) * 0.16, 0.55, Math.sin(a) * 0.16], 0.06); }
    lathe(W, K.fixture, f, 0, 0.5, 0, [[0, 0], [0.38, 0.12], [0.5, 0.34], [0.42, 0.34], [0, 0.18]], sides + 1, { vOf: body(0.34) });
  } else if (kind === 'lantern') {
    // an iron gallows: a post, its arm out to the lantern, a brace; the lantern a cage on a chain, its soul-gem the light
    const ox = (fl[0] - c.x) / k, oz = (fl[2] - c.z) / k, arm = EG_FIXTURE_FLAME.lantern + 0.9;
    rod([-ox * 0.08, 0, -oz * 0.08], [-ox * 0.08, arm + 0.1, -oz * 0.08], 0.12);
    rod([-ox * 0.08, arm, -oz * 0.08], [ox, arm, oz], 0.1);
    rod([-ox * 0.08, arm - 0.55, -oz * 0.08], [ox * 0.55, arm, oz * 0.55], 0.06);
    chain(W, at(f, ox, arm - 0.05, oz), 1, 0.3 * k);
    const cg = frame(fl[0], fl[1] - 0.55 * k, fl[2], 0, k);
    grille(W, cg, [[0.3, 0], [0.3, 1.1]], 6);
    lathe(W, K.fixture, cg, 0, 1.1, 0, [[0.34, 0], [0.34, 0.05], [0.06, 0.2], [0, 0.22]], 6, { vOf: body(0.22) });
    lathe(W, K.fixture, cg, 0, -0.06, 0, [[0, 0], [0.34, 0], [0.34, 0.06], [0, 0.06]], 6, { vOf: body(0.06) });
  } else if (kind === 'moonlamp') {
    // a silver moon-lamp: a thin post and the cup its globe of light stands in
    lathe(W, K.fixture, f, 0, 0, 0, [[0.14, 0], [0.07, 0.1], [0.05, 1.3], [0.12, 1.36], [0.2, 1.42], [0.16, 1.44]], sides, { vOf: body(1.44) });
  } else {
    // an iron spike holding an open fire basket
    lathe(W, K.fixture, f, 0, 0, 0, [[0.16, 0], [0.08, 0.2], [0.05, 0.8], [0.04, 0.95]], 4, { vOf: body(0.95), a0: Math.PI / 4 });
    grille(W, f, [[0.12, 0.82], [0.3, 1.04], [0.46, 1.3]], 8);
  }
  flame(W, fl[0], fl[1] - qh / 2, fl[2], k, cell);
}
/** AN ENTABLATURE from whole column `c` toward `n` (its neighbour on the ring) at the capitals' top: architrave, frieze
 *  (the relief), cornice (the moulding), soffit (the coffer); `share` of the way (a fragment's end broken). Answers its
 *  architrave's foot line `[a, b, y]` (the banners hang from it). */
function entablature(W, c, n, share, seed) {
  const y = c.top, dx = n.x - c.x, dz = n.z - c.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, len = L * share;
  const yaw = Math.atan2(ux, uz), f = frame(c.x, y, c.z, yaw), w = c.rad * 1.25;
  const broken = share < 0.99, jag = (k) => (broken ? 0.35 * h01(seed, 81, k) : 0);
  // architrave, frieze, cornice: three boxes along the way, each a little longer as it rises - a broken end jagged
  /** @type {Array<[number, number, number, number, { uS?: number, v?: number[] }]>} */
  const parts = [[K.voussoir, 0, 0.45, w * 0.92, {}], [K.relief, 0.45, 1.05, w * 0.86, { uS: 1 / 0.6, v: [0, 1] }], [K.moulding, 1.05, 1.35, w * 1.06, { v: [MB.ornament[0], MB.ornament[1]] }]];
  for (const [rec, y0, y1, hw, o] of parts) {
    const z1 = len - jag(rec), z0 = -c.rad * 0.6;
    fbox(W, rec, f, -hw, y0, z0, hw, y1, z1, { skip: 'bottom', ...o });
    W.QA(K.coffer, at(f, -hw, y0, z0), at(f, hw, y0, z0), at(f, hw, y0, z1), at(f, -hw, y0, z1), 0, 0, hw, (z1 - z0) / 2, at(f, 0, y0 + 1, z0));
  }
  return { a: at(f, 0, 0, Math.min(0.6, len * 0.2)), b: at(f, 0, 0, len - 0.6), y, ux, uz, len };
}
/** A BANNER hanging still from an entablature (section 3.4): a cloth `w` across and `h` long, its picture the banner record
 *  whole (its torn foot the record's cutout), both faces, on its iron rod. */
function banner(W, line, t, w, h) {
  const cx = lerp(line.a[0], line.b[0], t), cz = lerp(line.a[2], line.b[2], t), y = line.y - 0.02, ux = line.ux, uz = line.uz;
  const A = [cx - ux * w / 2, y, cz - uz * w / 2], Bq = [cx + ux * w / 2, y, cz + uz * w / 2], C = [Bq[0], y - h, Bq[2]], D = [A[0], y - h, A[2]];
  const nx = -uz, nz = ux;
  W.Q4(K.banner, A, Bq, C, D, 0, 0, 1, 0, 1, 1, 0, 1, nx, 0, nz);
  W.Q4(K.banner, A, Bq, C, D, 0, 0, 1, 0, 1, 1, 0, 1, -nx, 0, -nz);
  beam(W, K.fixture, [A[0] - ux * 0.12, y - 0.04, A[2] - uz * 0.12], [Bq[0] + ux * 0.12, y - 0.04, Bq[2] + uz * 0.12], 0.06, 0.06, { v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] });
}

// ── THE STATUES (section 3.4): the band's figure, low-poly, on a broken plinth, facing in ─────────────────────────────
/** A broken plinth from `foot` to `top` at (x, z), turned `yaw`, its top's corner knocked off. */
function plinth(W, x, z, yaw, foot, top, seed) {
  const f = frame(x, 0, z, yaw), s = 0.85;
  fbox(W, K.statue, f, -s, top - 0.18, -s, s, top, s * 0.55 - 0.2 * h01(seed, 3), { v: 'up' });
  fbox(W, K.voussoir, f, -s * 0.9, foot, -s * 0.9, s * 0.9, top - 0.18, s * 0.9, { skip: 'bottom' });
  spire(W, { sides: 4, rings: 3, jitter: 0.15, bend: 0, tip: 0.2, step: 0, twist: 0.3, rec: K.found }, { x, z, R: 1.25, len: 4 + 3 * h01(seed, 4), bendA: yaw, bend: 0 }, foot, seed, 3, () => EG_FOUND_V.deep[0]);
}
/** The band's figure (EG_KIT_STYLE.statue) standing in frame `f` (its feet at the origin, facing +z). */
function statue(W, f, kind) {
  const S = K.statue, v = (yy) => (f.y + yy * f.k) / 2, P = (x, y, z) => at(f, x, y, z);   // the stone's v up the figure (EG_KIT_MAP)
  const limb = (a, b, w, h = w) => beam(W, S, P(...a), P(...b), w * f.k, h * f.k);
  if (kind === 'battlemage') {
    lathe(W, S, f, 0, 0, 0, [[0, 0], [0.64, 0], [0.68, 0.32], [0.6, 0.9], [0.5, 1.6], [0.42, 2.05], [0.5, 2.28], [0.47, 2.42], [0.28, 2.56], [0, 2.58]], 10, { vOf: v });
    lathe(W, S, f, 0, 0, 0.02, [[0, 2.52], [0.2, 2.56], [0.26, 2.74], [0.25, 2.92], [0.16, 3.08], [0, 3.14]], 8, { vOf: v });
    lathe(W, S, f, 0, 0, -0.06, [[0, 2.5], [0.3, 2.56], [0.33, 2.8], [0.27, 3.04], [0.12, 3.2], [0, 3.22]], 8, { vOf: v, a0: Math.PI / 8 });
    limb([0.44, 2.3, 0], [0.6, 2.76, 0.1], 0.24); limb([0.6, 2.76, 0.1], [0.66, 3.28, 0.2], 0.2);   // the arm raised
    limb([0.68, 0.9, 0.22], [0.7, 4.15, 0.22], 0.09); gem(W, S, f, 0.7, 4.32, 0.22, 0.18, 1.5);   // the staff and its head
    limb([-0.44, 2.3, 0], [-0.54, 1.8, 0.16], 0.24); limb([-0.54, 1.8, 0.16], [-0.3, 1.62, 0.4], 0.2);   // the other arm, a book in its hand
    fbox(W, S, f, -0.42, 1.52, 0.36, -0.12, 1.92, 0.5, { v: 'up' });
  } else if (kind === 'mourner') {
    lathe(W, S, f, 0, 0, 0, [[0, 0], [0.72, 0], [0.74, 0.3], [0.6, 1.1], [0.5, 1.8], [0.47, 2.15], [0.3, 2.34], [0, 2.36]], 10, { vOf: v });
    // the hood bowed forward over the face
    const g = frame(f.x, f.y, f.z, Math.atan2(f.s, f.c), f.k), tilt = 0.35, hood = [[0, 0], [0.3, 0.04], [0.35, 0.3], [0.29, 0.55], [0.12, 0.72], [0, 0.75]];
    const hp = hood.map(([r, y]) => [r, y]), base = [0, 2.2, 0.06];
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU;
      for (let j = 0; j + 1 < hp.length; j++) {
        const Pq = (r, y, a) => { const lx = Math.cos(a) * r, lz0 = Math.sin(a) * r, ly = y; return at(g, base[0] + lx, base[1] + ly * Math.cos(tilt) - lz0 * Math.sin(tilt), base[2] + lz0 * Math.cos(tilt) + ly * Math.sin(tilt)); };
        const A = Pq(hp[j][0], hp[j][1], a0), Bq = Pq(hp[j][0], hp[j][1], a1), C = Pq(hp[j + 1][0], hp[j + 1][1], a1), D = Pq(hp[j + 1][0], hp[j + 1][1], a0), c = at(g, base[0], base[1] + 0.35, base[2] + 0.1);
        if (hp[j][0] <= 0) W.T(S, A, C, D, 0, 0, 0.3, 0.3, 0, 0.3, (C[0] + D[0]) / 2 - c[0], (C[1] + D[1]) / 2 - c[1], (C[2] + D[2]) / 2 - c[2]);
        else if (hp[j + 1][0] <= 0) W.T(S, A, Bq, C, 0, 0, 0.3, 0, 0.15, 0.3, (A[0] + Bq[0]) / 2 - c[0], (A[1] + Bq[1]) / 2 - c[1], (A[2] + Bq[2]) / 2 - c[2]);
        else W.QA(S, A, Bq, C, D, 0, 0, 0.3, 0.3, c);
      }
    }
    limb([0.42, 2.1, 0.04], [0.1, 1.55, 0.42], 0.26); limb([-0.42, 2.1, 0.04], [-0.1, 1.55, 0.42], 0.26);   // the sleeves, the hands clasped
    fbox(W, S, f, -0.16, 1.42, 0.38, 0.16, 1.66, 0.58, { v: 'up' });
    fbox(W, S, f, -0.5, 0, -0.95, 0.5, 0.22, -0.4, { v: 'up' });   // the shroud's train
  } else if (kind === 'raven') {
    // a great raven perched, its body leaning forward, wings folded, its beak toward the floor
    limb([0.16, 0, 0.1], [0.16, 0.55, 0.05], 0.09); limb([-0.16, 0, 0.1], [-0.16, 0.55, 0.05], 0.09);
    const tilt = 0.62, body = [[0, 0], [0.26, 0.12], [0.44, 0.45], [0.46, 0.82], [0.38, 1.15], [0.24, 1.4], [0, 1.5]];
    const Pb = (r, y, a) => { const lx = Math.cos(a) * r, lz = Math.sin(a) * r * 1.1; return at(f, lx, 0.5 + y * Math.cos(tilt) - lz * Math.sin(tilt), -0.2 + lz * Math.cos(tilt) + y * Math.sin(tilt)); };
    const bc = at(f, 0, 1.05, 0.2);
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU;
      for (let j = 0; j + 1 < body.length; j++) {
        const A = Pb(body[j][0], body[j][1], a0), Bq = Pb(body[j][0], body[j][1], a1), C = Pb(body[j + 1][0], body[j + 1][1], a1), D = Pb(body[j + 1][0], body[j + 1][1], a0);
        if (body[j][0] <= 0) W.T(S, A, C, D, 0, 0, 0.3, 0.3, 0, 0.3, (C[0] + D[0]) / 2 - bc[0], (C[1] + D[1]) / 2 - bc[1], (C[2] + D[2]) / 2 - bc[2]);
        else if (body[j + 1][0] <= 0) W.T(S, A, Bq, C, 0, 0, 0.3, 0, 0.15, 0.3, (A[0] + Bq[0]) / 2 - bc[0], (A[1] + Bq[1]) / 2 - bc[1], (A[2] + Bq[2]) / 2 - bc[2]);
        else W.QA(S, A, Bq, C, D, 0, 0, 0.3, 0.3, bc);
      }
    }
    lathe(W, S, f, 0, 0, 0.62, [[0, 1.55], [0.2, 1.6], [0.26, 1.78], [0.2, 1.96], [0, 2.02]], 7, { vOf: v });
    limb([0, 1.8, 0.82], [0, 1.66, 1.32], 0.14, 0.12);   // the beak
    for (const sx of [-1, 1]) {   // the folded wings
      const a = P(sx * 0.42, 1.45, 0.25), b = P(sx * 0.36, 0.55, -0.85), c = P(sx * 0.48, 0.85, 0.2), o = dirOf(f, sx, 0, 0);
      W.T(S, a, b, c, 0, 0, 0.6, 0.6, 0.1, 0.4, o[0], o[1], o[2]);
      W.T(S, a, b, c, 0, 0, 0.6, 0.6, 0.1, 0.4, -o[0], -o[1], -o[2]);
    }
    fbox(W, S, f, -0.22, 0.32, -1.25, 0.22, 0.4, -0.45, { v: 'up' });   // the tail
  } else {
    // a Dremora warrior: armoured, horned, both hands on a greatsword planted before it
    fbox(W, S, f, -0.4, 0, -0.18, -0.08, 1.3, 0.18, { v: 'up' }); fbox(W, S, f, 0.08, 0, -0.18, 0.4, 1.3, 0.18, { v: 'up' });
    lathe(W, S, f, 0, 1.15, 0, [[0.5, 0], [0.56, 0.4], [0.46, 0.5]], 6, { vOf: v });
    lathe(W, S, f, 0, 1.6, 0, [[0.42, 0], [0.5, 0.5], [0.58, 0.9], [0.5, 1.02], [0.2, 1.08]], 6, { vOf: v, a0: Math.PI / 6 });
    for (const sx of [-1, 1]) {
      lathe(W, S, frame(...P(sx * 0.62, 2.48, 0), Math.atan2(f.s, f.c), f.k), 0, 0, 0, [[0.3, -0.12], [0.34, 0.06], [0.22, 0.22], [0, 0.26]], 6, { vOf: v });
      limb([sx * 0.62, 2.35, 0.05], [sx * 0.42, 1.95, 0.4], 0.24); limb([sx * 0.42, 1.95, 0.4], [sx * 0.1, 2.06, 0.62], 0.2);
      limb([sx * 0.14, 3.0, 0.02], [sx * 0.34, 3.36, -0.12], 0.1); limb([sx * 0.34, 3.36, -0.12], [sx * 0.24, 3.66, -0.4], 0.06);   // the horns
    }
    fbox(W, S, f, -0.17, 2.68, -0.18, 0.17, 3.08, 0.18, { v: 'up' });
    limb([0, 0.02, 0.62], [0, 1.8, 0.62], 0.22, 0.06); limb([-0.42, 1.82, 0.62], [0.42, 1.82, 0.62], 0.1); limb([0, 1.82, 0.62], [0, 2.22, 0.62], 0.07); gem(W, S, f, 0, 2.3, 0.62, 0.08, 1.2);
  }
}

// ── THE PLACE'S THINGS (section 3.4): the band's among the columns ────────────────────────────────────────────────────
function amongThing(W, m, kind, lite) {
  const s = (Math.round(m.x * 37) ^ Math.round(m.z * 59)) >>> 0, y = m.floor;
  if (kind === 'obelisk') {
    // a cairn of black stones stacked out of the mist
    let yy = y - 5 - 3 * h01(s, 1), rr = 1.1 + 0.3 * h01(s, 2);
    const n = 5 + Math.floor(3 * h01(s, 3));
    spire(W, { sides: 5, rings: 3, jitter: 0.2, bend: 0, tip: 0.15, step: 0, twist: 0.2, rec: K.found }, { x: m.x, z: m.z, R: rr * 1.1, len: 6, bendA: 0, bend: 0 }, yy, s, 1, (q) => lerp(EG_FOUND_V.rubble[1], EG_FOUND_V.deep[1], clamp((yy - q) / 6, 0, 1)));
    for (let i = 0; i < n; i++) {
      const hh = 0.9 + 0.9 * h01(s, 4, i), ox = 0.15 * (h01(s, 5, i) - 0.5), oz = 0.15 * (h01(s, 6, i) - 0.5), yaw = h01(s, 7, i) * TAU, poly = [];
      for (let k = 0; k < 5; k++) { const a = yaw + (k / 5) * TAU, r = rr * (0.8 + 0.3 * h01(s, 8 + i, k)); poly.push([m.x + ox + Math.cos(a) * r, m.z + oz + Math.sin(a) * r]); }
      const c = [m.x + ox, yy + hh / 2, m.z + oz];
      for (let k = 0; k < 5; k++) { const [a0, b0] = poly[k], [a1, b1] = poly[(k + 1) % 5]; W.QA(K.statue, [a0, yy + hh, b0], [a1, yy + hh, b1], [a1, yy, b1], [a0, yy, b0], 0, (yy + hh) / 2, Math.hypot(a1 - a0, b1 - b0) / 2, yy / 2, c); }
      for (let k = 1; k < 4; k++) { W.T(K.statue, [poly[0][0], yy + hh, poly[0][1]], [poly[k][0], yy + hh, poly[k][1]], [poly[k + 1][0], yy + hh, poly[k + 1][1]], 0, 0, 0.5, 0, 0.5, 0.5, 0, 1, 0); W.T(K.statue, [poly[0][0], yy, poly[0][1]], [poly[k][0], yy, poly[k][1]], [poly[k + 1][0], yy, poly[k + 1][1]], 0, 0, 0.5, 0, 0.5, 0.5, 0, -1, 0); }
      yy += hh; rr *= 0.86;
    }
  } else if (kind === 'thorns') {
    // a thicket of black-glass thorns grown up out of the dusk
    const root = [m.x, y - 9 - 5 * h01(s, 1), m.z], n = lite ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const a = h01(s, 2, i) * TAU, lean = 0.25 + 0.4 * h01(s, 3, i), len = 9 + 7 * h01(s, 4, i), kink = 0.45 + 0.2 * h01(s, 5, i);
      const mid = [root[0] + Math.cos(a) * lean * len * kink, root[1] + len * kink, root[2] + Math.sin(a) * lean * len * kink];
      const tip = [mid[0] + Math.cos(a + 0.5) * lean * 1.4 * len * (1 - kink), root[1] + len, mid[2] + Math.sin(a + 0.5) * lean * 1.4 * len * (1 - kink)];
      const R = 0.35 + 0.25 * h01(s, 6, i);
      thorn(W, root, mid, tip, R);
    }
  } else if (kind === 'pylon') {
    // an iron pylon of the Kyn: a tapering girder tower, its crossbars, a chain hanging from its arm
    const foot = y - 12 - 6 * h01(s, 1), top = y + 5 + 3 * h01(s, 2), yaw = h01(s, 3) * TAU, f = frame(m.x, 0, m.z, yaw);
    const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [i, j] of legs) beam(W, K.fixture, at(f, i * 0.9, foot, j * 0.9), at(f, i * 0.35, top, j * 0.35), 0.18, 0.18, { v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] });
    for (let yy = y - 2; yy < top - 1; yy += 2.6) { const t = (yy - foot) / (top - foot), w = lerp(0.9, 0.35, t); for (let k = 0; k < 4; k++) { const [i0, j0] = legs[k], [i1, j1] = legs[(k + 1) % 4]; beam(W, K.fixture, at(f, i0 * w, yy, j0 * w), at(f, i1 * w, yy, j1 * w), 0.1, 0.1, { caps: false, v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] }); } }
    beam(W, K.fixture, at(f, 0, top, -0.4), at(f, 0, top, 2.2), 0.22, 0.26, { v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] });
    if (!lite) chain(W, at(f, 0, top - 0.15, 2.0), 6 + Math.floor(5 * h01(s, 4)), 0.48);
  }
}
/** A thorn: two four-sided spans from its root to its kink and on to its point. */
function thorn(W, root, mid, tip, R) {
  const ring = (p, r, q, k) => { const dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz) || 1, sx = -dz / l, sz = dx / l; return [[p[0] + sx * r, p[1], p[2] + sz * r], [p[0], p[1] + r * 0.2, p[2]], [p[0] - sx * r, p[1], p[2] - sz * r], [p[0], p[1] - r * 0.2 - k, p[2]]]; };
  const a = ring(root, R, mid, 0), b = ring(mid, R * 0.55, tip, 0.05);
  for (let k = 0; k < 4; k++) {
    const k1 = (k + 1) % 4, c0 = [(root[0] + mid[0]) / 2, (root[1] + mid[1]) / 2, (root[2] + mid[2]) / 2];
    W.QA(K.crystal, a[k], a[k1], b[k1], b[k], k / 4, root[1] / 2, (k + 1) / 4, mid[1] / 2, c0);
    const c1 = [(mid[0] * 2 + tip[0]) / 3, (mid[1] * 2 + tip[1]) / 3, (mid[2] * 2 + tip[2]) / 3];
    const m = [(b[k][0] + b[k1][0] + tip[0]) / 3 - c1[0], (b[k][1] + b[k1][1] + tip[1]) / 3 - c1[1], (b[k][2] + b[k1][2] + tip[2]) / 3 - c1[2]];
    W.T(K.crystal, b[k], b[k1], tip, k / 4, mid[1] / 2, (k + 1) / 4, mid[1] / 2, (k + 0.5) / 4, tip[1] / 2, m[0], m[1], m[2]);
  }
}
/** A plate's freestanding arch (EG_KIT_STYLE.arch): two piers out of the void, the ring of voussoirs over the way's air, a
 *  broken attic over it. */
function plateArch(W, q, seed) {
  const style = egKitStyle(q.band).arch, g = alongFrame(q.x, 0, q.z, 0, 1), pw = 0.7, th = 0.9, top = q.h + 0.6, ys = q.h - egArchRise(style, q.w);
  archRing(W, g, style, q.w, ys, th, 0.5, style === 'squat' ? 7 : 11, top);
  for (const sg of [-1, 1]) pier(W, g, sg > 0 ? q.w / 2 : -q.w / 2 - pw, sg > 0 ? q.w / 2 + pw : -q.w / 2, th + 0.12, top, q.foot, seed, 900 + (sg > 0 ? 1 : 0));
  // a string course over the ring and the attic on it, its top broken off
  const h = 0.5 + 0.6 * h01(seed, 91);
  fbox(W, K.moulding, g, -q.w / 2 - pw - 0.1, top - 0.12, -th / 2 - 0.12, q.w / 2 + pw + 0.1, top, th / 2 + 0.12, {});
  fbox(W, W.ashlar, g, -q.w / 2 - pw, top, -th / 2 - 0.06, q.w / 2 + pw * (0.2 + 0.8 * h01(seed, 92)) - q.w * 0.3 * h01(seed, 93), top + h, th / 2 + 0.06, {});
}

// ── THE WAYS' AND THE RIMS' RUNS ─────────────────────────────────────────────────────────────────────────────────────
/** A band's or lane's two long edges as cornice paths, each cut where another floor stands over its reach (a disc it meets,
 *  a band beyond it), each run at least a metre. */
function edgeRuns(law, ax, az, bx, bz, hw, y, self) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, out = [];
  for (const side of [-1, 1]) {
    const nx = -uz * side, nz = ux * side, n = Math.max(2, Math.ceil(L / 0.5)), ok = [];
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * L, ex = ax + ux * s + nx * hw, ez = az + uz * s + nz * hw;
      ok.push(!(corniceHit(law, self, ex - nx * 0.05, ez - nz * 0.05, y) || corniceHit(law, self, ex + nx * 0.18, ez + nz * 0.18, y) || corniceHit(law, self, ex + nx * EG_RUIN_CORNICE.reach, ez + nz * EG_RUIN_CORNICE.reach, y)));
    }
    let i = 0;
    while (i <= n) {
      if (!ok[i]) { i++; continue; }
      let j = i;
      while (j + 1 <= n && ok[j + 1]) j++;
      const s0 = (i / n) * L, s1 = (j / n) * L;
      if (s1 - s0 >= 1) out.push([{ x: ax + ux * s0 + nx * hw, y, z: az + uz * s0 + nz * hw, nx, nz, m: 1 }, { x: ax + ux * s1 + nx * hw, y, z: az + uz * s1 + nz * hw, nx, nz, m: 1 }]);
      i = j + 1;
    }
  }
  return out;
}
/** Does a cornice under a floor's edge at height `y` meet anything at (x, z): another floor over it, a box or ring wall the
 *  law keeps through its depth? */
function corniceHit(law, self, x, z, y) {
  for (const F of law.floors) if (F !== self && onFloor(F, x, z)) return true;
  for (const b of law.boxes) if (x > b[0] && x < b[3] && z > b[2] && z < b[5] && b[1] < y && b[4] > y - 1) return true;
  for (const [cx, cz, r0, r1, y0, y1] of law.rings) { const d = Math.hypot(x - cx, z - cz); if (d > r0 && d < r1 && y0 < y && y1 > y - 1) return true; }
  return false;
}
/** A disc's rim cut where another floor stands over the cornice's reach, or the law keeps the room: its runs of its own
 *  polygon's corners. */
function rimRuns(law, d, self) {
  const P = rimPath(d), N = P.length, y = d.y ?? 0, ok = P.map((p, k) => {
    const q = P[(k + 1) % N], mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, nx = (p.nx + q.nx) / 2, nz = (p.nz + q.nz) / 2;
    return ![0, 0.1, 0.25, EG_RUIN_CORNICE.reach].some((o) => corniceHit(law, self, mx + nx * o, mz + nz * o, y) || corniceHit(law, self, p.x + p.nx * o, p.z + p.nz * o, y) || corniceHit(law, self, q.x + q.nx * o, q.z + q.nz * o, y));
  });
  if (ok.every(Boolean)) return [{ path: P, closed: true }];
  if (!ok.some(Boolean)) return [];
  const start = ok.indexOf(false), runs = [];
  let cur = null;
  for (let i = 1; i <= N; i++) {
    const k = (start + i) % N;
    if (ok[k]) { if (!cur) cur = [P[k]]; cur.push(P[(k + 1) % N]); }
    else if (cur) { runs.push({ path: cur, closed: false }); cur = null; }
  }
  if (cur) runs.push({ path: cur, closed: false });
  return runs;
}

// ── A HALL'S RUIN ────────────────────────────────────────────────────────────────────────────────────────────────────
/** A walkway's lamp (world/eliteGates/egHall.js egCircleLights: EG_LAMP.h over the walk, 0.3 m past its edge) on the band's fixture,
 *  carried on an iron bracket from a post rising out of the void beside the walk (clear of its cornice). */
function walkLamp(W, x, z, s, band, lite, seed) {
  const kind = egKitStyle(band).fixture, k = Math.min(0.8, 0.26 / FIXTURE_R[kind]), ly = EG_LAMP.h, px = x + s * 0.8;   // its fixture made to fit the 0.3 m past the walk's edge
  if (kind === 'lantern') {
    const base = ly - EG_FIXTURE_FLAME.lantern * k;
    lathe(W, K.shaft, ID, px, 0, z, [[0, -10 - 3 * h01(seed, 34)], [0.2, -9.5 - 3 * h01(seed, 34)], [0.15, base - 0.05], [0, base]], 6, { vOf: (yy) => -yy / 2 });
    fixture(W, { x: px, z, a: 0, flame: [x, ly, z], fk: k }, kind, base, lite);
    return;
  }
  const base = ly - EG_FIXTURE_FLAME[kind] * k;
  lathe(W, K.shaft, ID, px, 0, z, [[0, -10 - 3 * h01(seed, 34)], [0.2, -9.5 - 3 * h01(seed, 34)], [0.15, base - 0.1], [0.18, base - 0.02], [0, base]], 6, { vOf: (yy) => -yy / 2 });
  beam(W, K.fixture, [px, base - 0.06, z], [x, base - 0.06, z], 0.1, 0.1, { v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] });
  beam(W, K.fixture, [px, base - 0.75, z], [lerp(px, x, 0.7), base - 0.08, z], 0.06, 0.06, { v0: EG_FIXTURE_V.body[0], v1: EG_FIXTURE_V.body[1] });
  fixture(W, { x, z, a: 0, flame: [x, ly, z], fk: k }, kind, base, lite);
}
/** Every piece of hall `spec`'s ruin into writer `W`, each judged against the hall's law as it is laid. */
function hallRuin(W, spec, lite, tally = null) {
  const seed = hallSeed(spec), law = ruinLaw(spec), plan = egRuinColumns(spec, { lite });
  const cap = lite ? EG_RUIN.trisLite : EG_RUIN.tris, was0 = W.triangles;
  /** A piece laid and judged; an `optional` one (the ring's columns, the statues, the entablatures, the arches, the band's
   *  things) let go too where it would carry the hall past its budget - the foundations, cornices, bridges and the lamps'
   *  fixtures are laid first and never let go for it. */
  const lay = (band, occ, fn, what = '', optional = false) => {
    const was = W.triangles;
    W.band(band); W.begin(); fn();
    const over = optional && W.triangles - was0 > cap;
    if (over) W.drop();
    const kept = !over && W.commit(law, occ);
    if (tally) { const e = tally[what] ?? (tally[what] = { tris: 0, kept: 0, cut: 0, over: 0 }); e.tris += W.triangles - was; e[kept ? 'kept' : over ? 'over' : 'cut']++; }
    return kept;
  };
  const pieces = (band, what) => (fn) => lay(band, false, fn, what);
  const corn = (kind) => (lite ? leanProfile(EG_CORNICES[kind]) : EG_CORNICES[kind]);
  // THE FOUNDATIONS AND THE CORNICES under every disc but the spans' falling isles
  spec.discs.forEach((d, i) => {
    if (egIsleDisc(spec, d)) return;
    const self = law.floors.find((F) => F.t === 'd' && F.i === i), band = bandAt(spec, seed, d.x, d.y ?? 0, d.z, i), ds = (seed ^ Math.imul(i + 1, 0x7fffffed)) >>> 0, kind = egKitStyle(band).cornice;
    foundation(W, pieces(band, 'foundation'), d, band, ds, lite);
    for (const run of rimRuns(law, d, self)) lay(band, false, () => { corniceRun(W, K.moulding, run.path, corn(kind), { closed: run.closed }); if (kind === 'straps') corniceSpikes(W, run.path, run.closed); }, 'cornice');
  });
  // THE BRIDGES AND THE CORNICES under every band and lane but those the spans fell
  spec.bands.forEach((b, i) => {
    if (egWallBand(spec, b) || egTubeBand(b)) return;
    const self = law.floors.find((F) => F.t === 'b' && F.x0 === b.x - b.halfW && F.z0 === b.z0 && F.z1 === b.z1), band = bandAt(spec, seed, b.x, b.y ?? 0, (b.z0 + b.z1) / 2, 100 + i), y = b.y ?? 0;
    const q = b.role === 'cave' ? (spec.caves ?? []).find((c) => b.z0 >= c.z0 - 0.01 && b.z1 <= c.z1 + 0.01 && !c.open) : null, bs = (seed ^ Math.imul(i + 1, 7919)) >>> 0;
    // the run clipped to the discs it meets (their foundations carry it there)
    let z0 = b.z0, z1 = b.z1;
    for (const d of spec.discs) {
      if (Math.abs(d.x - b.x) >= d.r) continue;
      const half = Math.sqrt(d.r * d.r - (b.x - d.x) ** 2);
      if (d.z <= b.z0 + 1 && d.z + half > z0) z0 = Math.min(b.z1, d.z + half);
      if (d.z >= b.z1 - 1 && d.z - half < z1) z1 = Math.max(b.z0, d.z - half);
    }
    if (z1 - z0 < 1.5) return;
    if (q) {
      // a passage's: its deck under its walls' foot, the arches under that
      const yd = Math.min(q.y, q.yB ?? q.y) - egWallFoot(q) - 0.05, hw = b.halfW + 0.65;
      for (const r of bridgeRuns(law, { ax: b.x, az: z0, bx: b.x, bz: z1, hw, yd: yd - 0.6, top: yd + 0.04 })) {   // its deck and arches cut as one
        lay(band, false, () => fbox(W, W.ashlar, frame(b.x, 0, 0), -hw, yd - 0.6, r.az, hw, yd + 0.04, r.bz, { skip: 'top' }), 'bridge');
        bridge(W, pieces(band, 'bridge'), band, bs, r, lite);
      }
      return;
    }
    bridge(W, pieces(band, 'bridge'), band, bs, { ax: b.x, az: z0, bx: b.x, bz: z1, hw: b.halfW - 0.02, yd: y - 0.92 }, lite, law);
    const kind = egKitStyle(band).cornice;
    for (const path of edgeRuns(law, b.x, b.z0, b.x, b.z1, b.halfW, y, self)) lay(band, false, () => { corniceRun(W, K.moulding, path, corn(kind)); if (kind === 'straps') corniceSpikes(W, path, false); }, 'cornice');
  });
  (spec.lanes ?? []).forEach((l, i) => {
    const self = law.floors.find((F) => F.t === 'l' && F.ax === l.ax && F.az === l.az && F.bx === l.bx && F.bz === l.bz), band = bandAt(spec, seed, (l.ax + l.bx) / 2, l.y ?? 0, (l.az + l.bz) / 2, 200 + i), y = l.y ?? 0;
    const len = Math.hypot(l.bx - l.ax, l.bz - l.az), ux = (l.bx - l.ax) / len, uz = (l.bz - l.az) / len;
    let s0 = 0, s1 = len;
    for (const d of spec.discs) {   // clipped to the discs at its ends
      const px = d.x - l.ax, pz = d.z - l.az, s = px * ux + pz * uz, t = -px * uz + pz * ux;
      if (Math.abs(t) >= d.r) continue;
      const half = Math.sqrt(d.r * d.r - t * t);
      if (s < len / 2) s0 = Math.max(s0, s + half); else s1 = Math.min(s1, s - half);
    }
    if (s1 - s0 > 1.5) bridge(W, pieces(band, 'bridge'), band, (seed ^ Math.imul(i + 1, 104729)) >>> 0, { ax: l.ax + ux * s0, az: l.az + uz * s0, bx: l.ax + ux * s1, bz: l.az + uz * s1, hw: l.hw - 0.02, yd: y - 0.92 }, lite, law);
    const kind = egKitStyle(band).cornice;
    for (const path of edgeRuns(law, l.ax, l.az, l.bx, l.bz, l.hw, y, self)) lay(band, false, () => { corniceRun(W, K.moulding, path, corn(kind)); if (kind === 'straps') corniceSpikes(W, path, false); }, 'cornice');
  });
  // THE LAMPS (each an occluder): every disc's on its column under its fixture, the walkway's on their posts
  for (const c of plan.cols) if (c.kind === 'lamp') lay(c.band, true, () => column(W, c, lite), 'lamp');
  if (spec.walk) for (let z = spec.walk.z0 + 8; z < spec.walk.z1; z += EG_LAMP.pitch) for (const s of [-1, 1]) {
    const band = bandAt(spec, seed, spec.walk.x, undefined, z, 6000 + Math.round(z));
    lay(band, true, () => walkLamp(W, s * (spec.walk.halfW + 0.3), z, s, band, lite, (seed ^ Math.imul(Math.round(z * 10) + 1, s > 0 ? 17 : 23)) >>> 0), 'lamp');
  }
  // THE PLATES' ARCHES, THE COLUMN RINGS, THE STATUES on their plinths (each an occluder)
  for (const q of plan.arches) lay(q.band, true, () => plateArch(W, q, (seed ^ q.key) >>> 0), 'arch', true);
  const stood = new Set(plan.cols.filter((c) => c.kind === 'lamp'));
  for (const c of plan.cols) {
    if (c.kind === 'lamp') continue;
    if (c.kind !== 'statue') { if (lay(c.band, true, () => column(W, c, lite), 'column', true)) stood.add(c); continue; }
    const yaw = Math.atan2(c.cx - c.x, c.cz - c.z), top = c.floor + 0.35 + 0.5 * h01(seed, 30, c.slot), k = formOf(c.band).statue / 3.6;
    if (lay(c.band, true, () => { plinth(W, c.x, c.z, yaw, c.foot + 8, top, (seed ^ Math.imul(c.slot + 1, 31)) >>> 0); statue(W, frame(c.x, top, c.z, yaw, k), egKitStyle(c.band).statue); }, 'statue', true)) stood.add(c);
  }
  // THE ENTABLATURES from each whole column toward its neighbour on the ring (the next round it, else the one before),
  // whole to a whole one, a fragment broken off toward any other; their banners hanging still
  const byDisc = new Map();
  for (const c of plan.cols) if (stood.has(c)) { const key = `${c.d}:${c.ring.toFixed(2)}`; if (!byDisc.has(key)) byDisc.set(key, []); byDisc.get(key).push(c); }
  for (const ring of byDisc.values()) {
    ring.sort((p, q) => ringAngle(p) - ringAngle(q));
    for (let j = 0; j < ring.length; j++) {
      const c = ring[j];
      if (c.kind !== 'whole' || ring.length < 2) continue;
      const nb = [ring[(j + 1) % ring.length], ring[(j - 1 + ring.length) % ring.length]].find((q) => q !== c && Math.hypot(q.x - c.x, q.z - c.z) <= 11);
      if (!nb) continue;
      const L = Math.hypot(nb.x - c.x, nb.z - c.z), share = nb.kind === 'whole' ? 1 : Math.min(4.6 / L, (nb.kind === 'statue' ? 0.4 : 0.42) + 0.22 * h01(seed, 31, c.slot));
      lay(c.band, true, () => {
        const line = entablature(W, c, nb, share, (seed ^ Math.imul(c.slot + 1, 977)) >>> 0);
        if (!lite && line.len > 2.2) banner(W, line, 0.5, Math.min(1.5, line.len - 1), 3.4 + 1.8 * h01(seed, 32, c.slot));
      }, 'entablature', true);
    }
  }
  // THE BAND'S THINGS among the columns
  for (const m of plan.among) { const kind = egKitStyle(m.band).among; if (kind) lay(m.band, true, () => amongThing(W, m, kind, lite), 'among', true); }
}

/** The writer's buckets packed into renderer.createMesh's model in the dungeon's frame (world/eliteGates/meshKit.js pack's shape: Uint32
 *  indices, a sub-mesh a record lowest first) - each sub-mesh under its band's archive (a Brink hall's two) - and its
 *  OCCLUDERS (`model.occluders` - world/eliteGates/egHall.js egOccluderRuns' shape: each `{ b, r: [[subMesh, startIndex,
 *  primitiveCount], ...] }`). */
function packRuin(W, ox, oz) {
  const bs = W.buckets();
  let verts = 0;
  for (const g of bs) verts += g.v;
  const positions = new Float32Array(verts * 3), normals = new Float32Array(verts * 3), uvs = new Float32Array(verts * 2), indices = new Uint32Array(verts), subMeshes = [], first = new Map();
  let v = 0;
  for (const g of bs) {
    first.set(g.key, { sub: subMeshes.length, v });
    for (let i = 0; i < g.v; i++) { positions[(v + i) * 3] = g.p[i * 3] + ox; positions[(v + i) * 3 + 1] = g.p[i * 3 + 1]; positions[(v + i) * 3 + 2] = g.p[i * 3 + 2] + oz; }
    normals.set(g.n.subarray(0, g.v * 3), v * 3); uvs.set(g.uv.subarray(0, g.v * 2), v * 2);
    for (let i = 0; i < g.v; i++) indices[v + i] = v + i;
    subMeshes.push({ textureArchive: egBandArchive(g.band), textureRecord: g.rec, startIndex: v, primitiveCount: g.v / 3 });
    v += g.v;
  }
  const occluders = W.pieces.map(({ runs, b }) => ({ b: [b[0] + ox, b[1], b[2] + oz, b[3] + ox, b[4], b[5] + oz], r: runs.map(([key, tri, n]) => { const s = first.get(key); return [s.sub, s.v + tri * 3, n]; }) }));
  return { positions, normals, uvs, indices, subMeshes, occluders };
}
/** A model's bounding sphere `[x, y, z, r]` (the cull's). */
function sphereOf(P) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  if (!(x0 <= x1)) return [0, 0, 0, 0];
  return [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2];   // its box's: every corner inside
}

/**
 * A CIRCLE'S RUIN: one part a hall - `{ h, x0, model, sphere: [x, y, z, r] }` in the dungeon's frame (renderer.createMesh's
 * model, its sub-meshes in the hall's band's archive - a Brink hall's in two; `model.occluders` its tall pieces; `x0` its
 * hall's origin along the level, the cull's key). Pure and deterministic: the worker's build is the main thread's, byte
 * for byte.
 * @param {number} seed @param {number} c @param {number} [geo] @param {{ lite?: boolean }} [opts]
 * @returns {Array<{ h: number, x0: number, model: any, sphere: number[] }>}
 */
export function buildEgRuinParts(seed, c, geo = 0, { lite = false } = {}) {
  const out = [];
  for (const spec of egCircleSpecs(seed, c, geo)) {
    const W = ruinWriter();
    W.band(egBandOfHall(spec.h));
    if (EG_BRINK_HALLS.includes(spec.h)) W.ashlar = K.voussoir;
    hallRuin(W, spec, lite);
    const model = packRuin(W, SD_REALM_ORIGIN[0] + spec.x0, SD_REALM_ORIGIN[2]);
    out.push({ h: spec.h, x0: spec.x0, model, sphere: sphereOf(model.positions) });
  }
  return out;
}
/**
 * THE RUIN'S BUDGET, hall by hall (the lab's and the tests' measure - Elite-Gates-Look.md section 3.6): each hall's
 * triangles and draws (its sub-meshes) and, by kind of piece (foundation, cornice, bridge, column, lamp, entablature,
 * statue, arch, among), the triangles kept and the pieces kept and let go by the law.
 * @param {number} seed @param {number} c @param {number} [geo] @param {{ lite?: boolean }} [opts]
 */
export function egRuinBudget(seed, c, geo = 0, { lite = false } = {}) {
  return egCircleSpecs(seed, c, geo).map((spec) => {
    const W = ruinWriter(), kinds = {};
    W.band(egBandOfHall(spec.h));
    if (EG_BRINK_HALLS.includes(spec.h)) W.ashlar = K.voussoir;
    hallRuin(W, spec, lite, kinds);
    return { h: spec.h, kind: spec.kind, tris: W.triangles, draws: W.buckets().length, kinds };
  });
}
/** THE BANDS A CIRCLE'S RUIN WEARS: its own, and - a Brink circle's (net/eliteGates/egLaw.js EG_BRINK_HALLS, section 1.5) - the band
 *  above's first (its first hall's first third is dressed in it), so a host puts up each one's dress before it draws. */
export function egRuinBands(c) {
  const band = egBandOfHall(5 * (c - 1) + 1);
  return EG_BRINK_HALLS.includes(5 * (c - 1) + 1) && band > 0 ? [band - 1, band] : [band];
}
/** The lamp's tint for a column of band `band` (world/eliteGates/egAtmos.js - the band's fixtures' flame). */
export const egRuinLampTint = (band) => egAtmosOf(band).lamp;
/** Test seams: the hall's law as the ruin reads it, and its floor tests. */
export const egRuinLaw = (spec) => ruinLaw(spec);
export { onFloor as egRuinOnFloor, topOf as egRuinTopOf };
void rng;
