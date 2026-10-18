// @ts-check
// EG-PLAY (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 7, 8, 11 and 24): THE SPIRE'S
// HALLS, MADE - a circle of an Elite Breach as one made level, the Hour's way (world/superDungeon/sdRealm.js): a made location and a
// blocks file answering one made block (its start marker on the first hall's arrival plate), the halls' floors as one
// mesh and one collider bucket, their lamps, their light. Built off the hall law (net/eliteGates/egLaw.js egCircleSpecs) - one seed
// and one circle give one level on every screen, and the relay judges the same floors.
//
// A CIRCLE IS ONE LEVEL (EG-PLAY's form of THE SWAP, section 7): its five halls stand side by side EG_HALL_PITCH apart
// (each in its own frame about its origin - net/eliteGates/egLaw.js), far past the fog, and the pull between them is a step
// through the veil to the next hall's plate in the same level; a new circle is a new level, built as the Hour's is
// entered. What each hall is made of:
//   its PLATES - the arrival plate (a gold ring inset) and the end plate (its door's two posts and lintel), the Hour's
//     islands (realmIsland);
//   its COURT DISCS - a Rift-Yard's, a proving court's and the Court's floors, bronze plates in rings, and a Rampart's
//     bastions;
//   its BANDS - bridges and the Rampart's walkway, kerbed in brass, an edge line on each side;
//   its OBLIVION CAVERNS PASSAGE (section 11's first fragment) - a tunnel of basalt over the course, its floor broken by a
//     chasm crossed on ledges, the fire running down its walls in channels, a fire-fall curtain at the chasm's lip;
//   its SPAN'S STEPS - not here: they move, so the span's set stands them (scenes/eliteGates/egSpan.js).
// EG-FULL, LAYER THREE (section 11.6): every fragment's mesh half off its law (net/eliteGates/egFragLaw.js) - each passage's walls
// and vault in its kit's dress, broken at its alcoves with the niche behind; the chambers' arches, stairs and vignettes;
// each fragment's lights. A Collapsing Tube's floor and vault and Grath's islands are the spans' (scenes/eliteGates/egSpan.js).
// EG-G2 (2026-10-12, section 25.1 - THE BAND'S DRESS): built with the Hour's records (world/superDungeon/sdRealm.js) and moved onto the
// circle's band's own archive (world/eliteGates/egBandArt.js egBandDress): white marble and gold leaf in the Galleries, slate violet
// and bone in the Cairn, black glass and moon-silver in the Shade, basalt and iron in the Wellhead. The magma and the fire
// channels wear the band's liquid (EG_DRESS.molten), no longer the edge line's gold.
// EG-ZC (2026-10-12, Mac: "I said I want everything"; sections 11.1-11.2): THE SHAFTS built - the Deepway's way down (the
// law's `caves` marked `shaft`): their walls running 6 m down past their foot, their vault over the rim (none over THE
// HOLLOW TRUNK, open to the moon), their kit's dress; and THE COOLING SLAG's spouts over each crossing's lanes, their mouths
// in the band's liquid (draw-only - the crusts and the spill are the spans', scenes/eliteGates/egSpan.js).
// EG-ZN (2026-10-12, Mac: "I said I want everything"; section 11.8, "The camera in rock"): THE OCCLUDERS MARKED - every
// piece of rock the camera may stand behind (a passage's wall runs and vault, each box of its kit's dress, a niche's walls
// and lid, a vignette, a ring wall a segment at a time, an arch's walls, a door's posts and lintel, a slag spout) laid as
// its own runs of the circle's one mesh (`model.occluders`, egOccluderRuns), so a camera ray to the body can dither exactly
// those (scenes/eliteGates/egOcclude.js) while the circle stays one mesh, one upload and one draw; and THE SHAFT'S LEDGE
// (egShaftLedgeAt), the ground the camera leans out over (player/mwView.js).
// EG-HERO-LAY (2026-10-13, spec law 7; sections 11.6-11.8): THE HERO DRAWN - a hall's hero fragment (net/eliteGates/egLaw.js's `heroes`)
// is its mesh half laid into the circle's one mesh at its origin (world/eliteGates/egHeroFragModel.js egHeroFragInto - its ground, where its
// law lays ground, plainly; its rock a cell at a time, each an occluder of its own), its proxy into the circle's one collider
// bucket (egHeroFragCollider), so both are freed
// with the circle; its lights join the circle's by its kit; no code-built stair, niche or slag spout is drawn inside its box
// (its own mesh holds them). THE HERO'S CLAMP (egFragZones' `hero` zone): its law's floors extruded to its ceilings, its
// walls every floor edge its law does not open.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { realmToDungeon, dungeonToRealm } from '../../net/superDungeon/sdBrain.js';
import { faces } from '../gate/gateModel.js';
import { realmIsland, packRealmFaces, SD_REALM_FLOOR_RECORD, SD_REALM_BRASS_RECORD, SD_REALM_ROOT_RECORD, SD_REALM_ARENA_RECORD, SD_REALM_EDGE_RECORD, SD_REALM_PILLAR_RECORD, SD_REALM_COBBLE_RECORD, SD_ISLAND_SIDES, SD_LIP } from '../superDungeon/sdRealm.js';
import { egCircleSpecs, egBandOfCircle, egBandOfHall, EG_TEXT } from '../../net/eliteGates/egLaw.js';
import { EG_FRAGS } from '../../net/eliteGates/egFragLaw.js';
import { egSlagX, EG_SLAG_SPOUTS } from '../../net/eliteGates/egSpanLaw.js';   // EG-ZC: the slag's spouts
import { egBandDress, egBandArchive, EG_DRESS } from './egBandArt.js';   // EG-G2: the band's dress
import { EG_KIT_RECORDS } from './egKit.js';   // EG-LOOK: the kit's records, packed under the band's archive
import { egKitInto, egDiscFloor, egPassage, egRingArcade, egTierBenches, egLongWalls, egChokeArch, egDoorway, egVignette } from './egGround.js';   // EG-LOOK (Elite-Gates-Look.md section 2): THE GROUND, the academy's dress
import { egAtmosOf } from './egAtmos.js';   // EG-LOOK (Elite-Gates-Look.md section 7): each band's air and light
import { FIRE_WALLS_ARCHIVE } from '../emissiveTextures.js';   // EG-ZH: the Caverns' fire falls wear Daggerfall's own fire
import { egHeroFragInto, egHeroFragCollider, EG_HERO_FRAG_MESHES } from './egHeroFragModel.js';   // EG-HERO-LAY: a hall's hero, drawn and collided
import { egRoomModelInto, egRoomColliderInto, egClimbZones, egClimbKeep } from './egRoomModel.js';   // THE ASCENT (spec law 9): the rooms built, the climbs' clamp
import { GATE_PART } from '../gate/gateModel.js';
import { egPolyIn, segDist } from '../../net/eliteGates/egShape.js';   // EG-HERO-LAY: the hero's clamp
import { egRingSideWalls, EG_RING_DOOR } from '../../net/eliteGates/egWalkGraph.js';   // EG-PERFECT (spec law 10): a ring open at an alcove's doorway (THE AUDIT: its doorway alone)
import { lightList, lightListView, packLight, copyLights } from '../../render/lightId.js';   // LIGHT-ID (main's, at the merge into PR #800): the circle's lamps into the frame's list through the one seam (pure - the swap's worker may read it)
import { egRuinColumns, egDiscLamps, egRuinLampTint } from './egRuin.js';   // EG-LOOK (Elite-Gates-Look.md section 3.3): THE LAMPS ON THE RUIN'S COLUMNS

/** The made location's id (the Hour's is 0x7ffff200, the court's 0x7ffff000), its one block's name and index. */
export const EG_HALL_LOCATION_ID = 0x7ffff300;
export const EG_HALL_BLOCK = 'SPIRE.RDB';
export const EG_HALL_BLOCK_INDEX = 900300;
const UNITS_PER_M = 40;
/** The door's posts and lintel (m), a lamp's head and reach, the walkway's lamp pitch. EG-LOOK (Elite-Gates-Look.md section
 *  3.3): `h` is a walkway's lamp's height and a disc's where no column of the ruin could stand clear for it; a disc's lamps
 *  stand on the ruin's columns under the band's fixture (world/eliteGates/egRuin.js egRuinColumns), tinted the band's (world/
 *  egAtmos.js - `color` the Galleries' gold, a Drop's wall lamp's). */
export const EG_DOOR = Object.freeze({ halfW: 1.6, post: 0.5, h: 4.2, lintel: 0.6 });
export const EG_LAMP = Object.freeze({ h: 2.6, range: 14, color: Object.freeze([1.0, 0.78, 0.42]), lava: Object.freeze([1.0, 0.45, 0.12]), moon: Object.freeze([0.62, 0.7, 1.0]), pitch: 24 });
/** EG-ZL - A DROP'S WALL LIT (section 10.3's tell: "the landing's edge line, gold; the wall's face lit"): a lamp over the
 *  landing, `h` up its far wall and `off` out from its face (m) - the wall a body carried too far meets, seen from the
 *  takeoff before the jump. */
export const EG_DROP_LAMP = Object.freeze({ h: 4.5, off: 1.5 });
/** The made level's fog: EG-LOOK (Elite-Gates-Look.md section 7) - each band's own (world/eliteGates/egAtmos.js), the Galleries' the
 *  level's default (a probe or a pass with no circle in hand). */
export const EG_HALL_FOG = egAtmosOf(0).fog;
/** EG-LOOK: circle `c`'s band's fog (world/eliteGates/egAtmos.js) - the dungeon arm's haze in the Spire. */
export const egHallFog = (c) => egAtmosOf(egBandOfCircle(Number.isSafeInteger(c) && c > 0 ? c : 1)).fog;
/** EG-LOOK: circle `c`'s band's grade (world/eliteGates/egAtmos.js) - the lane's grade in the Spire (the Hour's, before). */
export const egHallGrade = (c) => egAtmosOf(egBandOfCircle(Number.isSafeInteger(c) && c > 0 ? c : 1)).grade;

/**
 * THE MADE LOCATION - a name, a region, a climate, the map table's row (map id 0: no world room keys off it; the breach's
 * room is the relay's own `eg:<b>`), the dungeon's record and its one block; `egBreach` the breach, `egSeed` its seed,
 * `egCircle` the circle this level is.
 * @param {{ b: string, seed: number, c: number, geo?: number, regionIndex?: number, regionName?: string, climate?: { worldClimate: number, climateType: number } }} o
 */
export function egHallLocation({ b, seed, c, geo = 0, regionIndex = -1, regionName = '', climate = { worldClimate: 231, climateType: 2 } }) {
  return {
    name: 'The Battlespire', regionIndex, regionName, locationIndex: -1, hasDungeon: true,
    climate: { worldClimate: climate.worldClimate, climateType: climate.climateType },
    mapTableData: { mapId: 0, locationType: -1, dungeonType: 0, longitude: 0, latitude: 0 },
    exterior: { exteriorData: { locationId: EG_HALL_LOCATION_ID } },
    dungeon: {
      recordElement: { header: { locationId: EG_HALL_LOCATION_ID, unknown: 0 } },
      blocks: [{ x: 0, z: 0, blockName: EG_HALL_BLOCK, isStartingBlock: true, blockIndex: 0, blockNumber: 0, blockNumberStartIndexBitfield: 0 }],
    },
    egBreach: b, egSeed: seed >>> 0, egCircle: c, egGeo: geo | 0,
  };
}
/** Is this location a circle of an Elite Breach? */
export const isEgHall = (loc) => typeof loc?.egBreach === 'string' && Number.isSafeInteger(loc?.egCircle) && loc?.dungeon?.recordElement?.header?.locationId === EG_HALL_LOCATION_ID;
/** THE EMPTY BLOCK: its start marker on the first hall's arrival plate (slot 1's origin), nothing else. */
export function egHallBlock() {
  const [x, , z] = realmToDungeon(0, 0, 1.5);
  const marker = {
    type: 0x03, position: 1, index: 0, xPos: Math.round(x * UNITS_PER_M), yPos: 0, zPos: Math.round(z * UNITS_PER_M),
    resources: { flatResource: { textureArchive: 199, textureRecord: 10, flags: 0, magnitude: 0, soundIndex: 0, factionOrMobileId: 0, nextObjectOffset: -1, action: 0, position: 0 } },
  };
  return { name: EG_HALL_BLOCK, position: 0, rdbBlock: { modelReferenceList: [], objectRootList: [{ rdbObjects: [marker] }] } };
}
/** THE BLOCKS FILE THE LEVEL IS LAID FROM: the real one, answering one name more. */
export function egHallBlocks(real) {
  const block = egHallBlock();
  return {
    getBlockIndex: (name) => (name === EG_HALL_BLOCK ? EG_HALL_BLOCK_INDEX : real ? real.getBlockIndex(name) : -1),
    getBlock: (i) => (i === EG_HALL_BLOCK_INDEX ? block : real ? real.getBlock(i) : null),
  };
}

/** A hall-frame point (net/eliteGates/egLaw.js) in the dungeon's frame. */
export const egToDungeon = (spec, x, y, z) => realmToDungeon(spec.x0 + x, y, z);
/** A hall's centre in the dungeon's frame - the origin its fight's frames are said about (the gate's driver's `centre`). */
export const egHallCentre = (spec) => realmToDungeon(spec.x0, 0, 0);
/** A dungeon-frame point in hall `spec`'s own frame. */
export const egFromDungeon = (spec, p) => [p[0] - realmToDungeon(spec.x0, 0, 0)[0], p[1], p[2] - realmToDungeon(0, 0, 0)[2]];

// ── the builders ───────────────────────────────────────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A quad wound to face `want` (faces' normal is (b - a) x (c - a)). */
function quadTo(f, rec, a, b, c, d, want, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
  if (dot(cross(sub(b, a), sub(c, a)), want) >= 0) f.quad(rec, a, b, c, d, uv[0], uv[1], uv[2], uv[3]);
  else f.quad(rec, a, d, c, b, uv[0], uv[3], uv[2], uv[1]);
}
/** A box from (x0, y0, z0) to (x1, y1, z1) in the dungeon's frame, every face out (`under` false: no underside). */
function boxD(f, rec, x0, y0, z0, x1, y1, z1, under = true, s = 1) {
  const P = (x, y, z) => [x, y, z];
  const u = (a, b) => [[0, 0], [a * s, 0], [a * s, b * s], [0, b * s]];
  quadTo(f, rec, P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), [0, 1, 0], u(x1 - x0, z1 - z0));
  if (under) quadTo(f, rec, P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), [0, -1, 0], u(x1 - x0, z1 - z0));
  quadTo(f, rec, P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), [0, 0, -1], u(x1 - x0, y1 - y0));
  quadTo(f, rec, P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), [0, 0, 1], u(x1 - x0, y1 - y0));
  quadTo(f, rec, P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), [-1, 0, 0], u(z1 - z0, y1 - y0));
  quadTo(f, rec, P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), [1, 0, 0], u(z1 - z0, y1 - y0));
}
/** A band (a bridge, the walkway, a passage's floor): its floor, its brass kerbs, its torn lip, its edge lines. */
function bandModel(f, spec, b) {
  const D = (x, y, z) => egToDungeon(spec, x, y, z);
  const xl = b.x - b.halfW, xr = b.x + b.halfW, y = b.y;
  const rec = b.role === 'walk' ? SD_REALM_COBBLE_RECORD : SD_REALM_FLOOR_RECORD;
  // EG-LOOK (Elite-Gates-Look.md section 2): a fire-lit passage's floor cut into its strips - the fire's channel 0.3 m wide by
  // each wall, a hand from it, IN the floor's own plane (it was a quad a centimetre over it)
  const q = b.role === 'cave' ? spec.caves.find((c) => Math.abs(c.x - b.x) < 1e-6 && b.z0 >= c.z0 - 1e-6 && b.z1 <= c.z1 + 1e-6) : null;
  const fire = !!q && (q.kit === 'caverns' || q.kit === 'deep' || q.kit === 'forge');
  const xs = fire ? [xl, xl + 0.05, xl + 0.35, xr - 0.35, xr - 0.05, xr] : [xl, xr];
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i], c = xs[i + 1], r = fire && (i === 1 || i === 3) ? EG_DRESS.molten : rec;
    quadTo(f, r, D(a, y, b.z0), D(c, y, b.z0), D(c, y, b.z1), D(a, y, b.z1), [0, 1, 0], [[a / 2, b.z0 / 2], [c / 2, b.z0 / 2], [c / 2, b.z1 / 2], [a / 2, b.z1 / 2]]);
  }
  if (b.role === 'cave') return;   // the passage's walls are its kerbs
  for (const [x0, x1] of [[xl, xl + 0.18], [xr - 0.18, xr]]) { const a = D(x0, y, b.z0), c = D(x1, y + 0.12, b.z1); boxD(f, SD_REALM_BRASS_RECORD, a[0], a[1], a[2], c[0], c[1], c[2], false); }
  for (const x of [xl, xr]) { const a = D(x, y - 0.9, b.z0), c = D(x, y, b.z1); quadTo(f, SD_REALM_ROOT_RECORD, [a[0], a[1], a[2]], [a[0], a[1], c[2]], [a[0], c[1], c[2]], [a[0], c[1], a[2]], [x < b.x ? -1 : 1, 0, 0]); }
  for (const x of [xl - 0.004, xr + 0.004]) { const a = D(x, y + 0.124, b.z0), c = D(x, y + 0.124, b.z1); const s2 = x < b.x ? 0.05 : -0.05; quadTo(f, SD_REALM_EDGE_RECORD, [a[0], a[1], a[2]], [a[0] + s2, a[1], a[2]], [c[0] + s2, c[1], c[2]], [c[0], c[1], c[2]], [0, 1, 0]); }
}
/** EG-FULL LAYER THREE: is band `b` a Collapsing Tube's floor (section 11.3) - stood and felled segment by segment by the
 *  spans (scenes/eliteGates/egSpan.js)? */
export const egTubeBand = (b) => b.role === 'tube';
/** EG-FULL LAYER THREE: is disc `d` one of Grath's islands (section 13.3 - they crack and fall), stood by the spans? */
export const egIsleDisc = (spec, d) => d.role === 'isle' && spec.kind === 'court';
/** EG-FULL LAYER TWO: is band `b` a Falling Wall's walkway (section 8.3) - stood and felled segment by segment by the
 *  spans (scenes/eliteGates/egSpan.js), so neither the circle's mesh nor its collider carries it? */
export const egWallBand = (spec, b) => spec.variant === 'fallingwall' && b.role === 'walk';
/**
 * EG-FULL LAYER THREE - A FRAGMENT'S PASSAGE (section 11.6's mesh half, net/eliteGates/egFragLaw.js's law half): its walls and its
 * vault (none where it is open - the Broken Colonnade over the void, the Gloam Thicket under its moon), each wall broken
 * where an alcove opens off it (the niche behind - its floor, walls and lid), and its kit's dress:
 *   the Oblivion Caverns (and deep)  basalt walls, the fire running down their feet in channels;
 *   the Fallen Stacks                bookcases fallen against both walls;
 *   the Broken Colonnade             drums standing and toppled along both sides;
 *   the Ossuary                      rib arches over the way;
 *   the Mist Stair                   pale stone, the pit's walls running down past the far floor;
 *   the Gloam Thicket                black-glass trunks rising past the edge of sight;
 *   the Forge Gut                    pipes along the walls, anvils at their feet.
 * The top you see is the top you stand on: the floors are the bands' (bandModel), the collider's proxy the same walls
 * (egCircleColliderTris), every decoration outside the walk.
 */
const NICHE = Object.freeze({ w: 2.0, d: 2.4, h: 2.6 });
/** EG-ZC: how far a passage's walls run down under its lowest floor (m) - a pit's (the Mist Stair's, every shaft's) 6 m. */
export const egWallFoot = (q) => (q.kit === 'mist' || q.shaft ? 6 : 1.2);
/** EG-ZC - THE COOLING SLAG's SPOUTS (section 11.2): over each slag crossing's lanes, at the crust's near edge, a spout on
 *  its wall 2.6 m over the crust - an iron mouth whose lip is the band's liquid. Draw-only (nothing stands under it but the
 *  lane's outer half, over every jump's head). Its boxes (the dungeon's frame) and lips, each `[x0, y0, z0, x1, y1, z1]`. */
export const EG_SLAG_SPOUT = Object.freeze({ up: 2.6, h: 0.6, d: 0.8, out: 0.7 });
export function egSlagSpouts(spec) {
  const out = [];
  for (const s of spec.steps ?? []) {
    if (s.kind !== 'slag' || egInHeroBox(spec, s.x, s.z)) continue;   // EG-HERO-LAY: a hero's spouts are its own mesh's
    const q = (spec.caves ?? []).find((c) => s.z >= c.z0 && s.z <= c.z1), wall = q ? q.halfW : s.w + s.amp, zN = s.z - s.d / 2;
    for (let k = 0; k < EG_SLAG_SPOUTS; k++) {
      const side = egSlagX(s, k) < s.x ? -1 : 1, xw = (q ? q.x : s.x) + side * wall, xi = xw - side * EG_SLAG_SPOUT.out;
      const a = egToDungeon(spec, Math.min(xw, xi), s.y + EG_SLAG_SPOUT.up, zN - EG_SLAG_SPOUT.d), c = egToDungeon(spec, Math.max(xw, xi), s.y + EG_SLAG_SPOUT.up + EG_SLAG_SPOUT.h, zN);
      out.push({ box: [Math.min(a[0], c[0]), a[1], Math.min(a[2], c[2]), Math.max(a[0], c[0]), c[1], Math.max(a[2], c[2])], side, lip: egToDungeon(spec, xi, s.y + EG_SLAG_SPOUT.up, zN - EG_SLAG_SPOUT.d / 2) });
    }
  }
  return out;
}
/** The z-spans of passage `q`'s wall on `side` left standing between its alcoves' openings. */
function wallRuns(spec, q, side) {
  const cuts = (spec.alcoves ?? []).filter((a) => Math.sign(a.x - q.x) === side && Math.abs(Math.abs(a.x - q.x) - q.halfW) < 3 && a.z > q.z0 && a.z < q.z1).map((a) => [a.z - NICHE.w / 2, a.z + NICHE.w / 2]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let z = q.z0;
  for (const [a, b] of cuts) { if (a > z) out.push([z, a]); z = Math.max(z, b); }
  if (z < q.z1) out.push([z, q.z1]);
  return out;
}
/** Each alcove's niche box (the dungeon's frame): `{ b: [x0, y0, z0, x1, y1, z1], side, door }` - from its wall's inner
 *  face (its doorway through the wall floored too) out NICHE.d; `door` the doorway's x in the dungeon's frame. AUDIT EG V
 *  (lane5 #8): a HERO's alcove opens off its hero's own floor - its wall's inner face where the line from the alcove back toward
 *  the course (along x, its `side`) first meets a floor of its hero at or under its own height (egHeroDoor), and `along` that
 *  floor edge's way (the wall's, so its false wall stands flush in a slanted wall) - never the code-built niche's 1.2 m rule. */
export function egNicheBoxes(spec) {
  const out = [];
  for (const a of spec.alcoves ?? []) {
    const side = a.side ?? 1, hd = egHeroDoor(spec, a), xw = hd ? hd.x : a.x - side * 1.2, xo = xw + side * (NICHE.d + 0.6);
    const p0 = egToDungeon(spec, Math.min(xw, xo), a.y, a.z - NICHE.w / 2), p1 = egToDungeon(spec, Math.max(xw, xo), a.y + NICHE.h, a.z + NICHE.w / 2);
    out.push({ b: [Math.min(p0[0], p1[0]), p0[1], Math.min(p0[2], p1[2]), Math.max(p0[0], p1[0]), p1[1], Math.max(p0[2], p1[2])], side, door: egToDungeon(spec, xw + side * 0.3, a.y, a.z), a, ...(hd ? { along: hd.along } : {}) });
  }
  return out;
}
/** How far (m) a hero alcove's doorway is looked for back toward the course, and how far under its height (m) the floor it
 *  opens off may stand (the Mist Stair's niche a step over its rim). */
export const EG_HERO_DOOR_LOOK_M = 8;
export const EG_HERO_DOOR_UNDER_M = 1.0;
/**
 * AUDIT EG V (lane5 #8) - A HERO ALCOVE'S DOORWAY (section 11.10's false wall): for alcove `a` of hall `spec` inside its hero's box,
 * where its wall's inner face stands - `{ x, along }`, the hall's frame: the first point of a hero floor (at most
 * EG_HERO_DOOR_UNDER_M under the alcove, never over it by more than a hand) met going from the alcove toward the course along x,
 * and the unit way of that floor's nearest edge ([x, z]); null for a code-built alcove, or none met within EG_HERO_DOOR_LOOK_M.
 * Pure.
 * @param {any} spec @param {any} a
 */
export function egHeroDoor(spec, a) {
  const H = (spec?.heroes ?? []).find((q) => a.x >= q.box[0] && a.x <= q.box[3] && a.z >= q.box[2] && a.z <= q.box[5]);
  if (!H) return null;
  const side = a.side ?? 1, floors = H.floors.filter((g) => g.y <= a.y + EG_HERO_GROUND_HAND_M && g.y >= a.y - EG_HERO_DOOR_UNDER_M);
  for (let k = 0; k * 0.05 <= EG_HERO_DOOR_LOOK_M; k++) {
    const x = a.x - side * k * 0.05, g = floors.find((f) => egPolyIn(f.poly, x, a.z));
    if (!g) continue;
    let best = null, bd = Infinity;
    for (let i = 0; i < g.poly.length; i++) {
      const p = g.poly[i], q = g.poly[(i + 1) % g.poly.length], d = segDist(x, a.z, p[0], p[1], q[0], q[1]), L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (L > 0 && d < bd) { bd = d; best = [(q[0] - p[0]) / L, (q[1] - p[1]) / L]; }
    }
    return { x, along: best ?? [0, 1] };
  }
  return null;
}
/** EG-LOOK (Elite-Gates-Look.md section 2): the niches' mouths in passage `q`'s wall on `side` (wallRuns' cuts) - each `[za,
 *  zb, floor, lid]`. */
function wallCuts(spec, q, side) {
  return (spec.alcoves ?? []).filter((a) => Math.sign(a.x - q.x) === side && Math.abs(Math.abs(a.x - q.x) - q.halfW) < 3 && a.z > q.z0 && a.z < q.z1).map((a) => [Math.max(q.z0, a.z - NICHE.w / 2), Math.min(q.z1, a.z + NICHE.w / 2), a.y, a.y + NICHE.h]).sort((a, b) => a[0] - b[0]);
}
/** EG-LOOK (Elite-Gates-Look.md section 2): a passage as THE ACADEMY'S (world/eliteGates/egGround.js egPassage) - its walls' runs out from
 *  the collider's planes (pilasters, windows onto the void, a cornice), its vault over the ceiling, its kit's own form; each
 *  bay a piece the camera dithers (EG-ZN). The fire's channels are its floor's (bandModel). */
function caveModel(f, spec, q, occ = whole, band = spec.band ?? 0) {
  const piece = (build) => occ(() => egKitInto(f, build));
  egPassage(spec, q, { runs: [wallRuns(spec, q, -1), wallRuns(spec, q, 1)], cuts: [wallCuts(spec, q, -1), wallCuts(spec, q, 1)], foot: egWallFoot(q), band, piece });
}
/** The alcoves' niches: each a floor, three walls and a lid behind its opening; a jump alcove's ledge is a step's. EG-ZN:
 *  the walls and the lid one occluder a niche, the floor the circle's ground. */
function nicheModel(f, spec, occ = whole) {
  for (const { b: [x0, y0, z0, x1, y1, z1], door, a } of egNicheBoxes(spec)) {
    if (egInHeroBox(spec, a.x, a.z)) continue;   // EG-HERO-LAY: a hero's alcove is its own mesh's
    quadTo(f, SD_REALM_FLOOR_RECORD, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, 1, 0]);
    occ(() => {
      quadTo(f, SD_REALM_ROOT_RECORD, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, -1, 0]);
      quadTo(f, SD_REALM_PILLAR_RECORD, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, 1]);
      quadTo(f, SD_REALM_PILLAR_RECORD, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, -1]);
      // the back wall: the x face away from the doorway, facing in
      const xb = Math.abs(x0 - door[0]) > Math.abs(x1 - door[0]) ? x0 : x1, inward = xb === x0 ? 1 : -1;
      quadTo(f, SD_REALM_PILLAR_RECORD, [xb, y0, z0], [xb, y0, z1], [xb, y1, z1], [xb, y1, z0], [inward, 0, 0]);
    });
  }
}
/** A vignette (section 11.10 - the lore the halls tell): a barricade of lecterns, a rack of broken staves, a Kyn shrine,
 *  a fallen shelf, a weapon rack - small, against a wall, outside the walk. */
function vignetteModel(f, spec, v) {
  egKitInto(f, (kit) => egVignette(kit, spec, v));   // EG-LOOK (section 2): rebuilt with the kit, inside the box its collider holds
}
/** A chamber's arch (section 11.4 - a chokepoint 6 m wide splitting the floor): two walls across it and a lintel. */
function archParts(spec, d) {
  const out = [], half = d.w / 2, R = d.r + 1;
  for (const s of [-1, 1]) out.push([d.x + s * half, d.x + s * R, d.z - 0.4, d.z + 0.4, (d.y ?? 0) - 0.5, (d.y ?? 0) + d.h]);
  out.push([d.x - half, d.x + half, d.z - 0.4, d.z + 0.4, (d.y ?? 0) + d.h - 1.0, (d.y ?? 0) + d.h]);
  return out.map(([x0, x1, z0, z1, y0, y1]) => { const a = egToDungeon(spec, Math.min(x0, x1), y0, z0), c = egToDungeon(spec, Math.max(x0, x1), y1, z1); return [Math.min(a[0], c[0]), a[1], Math.min(a[2], c[2]), Math.max(a[0], c[0]), c[1], Math.max(a[2], c[2])]; });
}
/** A ramp (a chamber's stair to its second floor): its sloped top, the four corners in the dungeon's frame. */
function rampCorners(spec, q) {
  const dx = q.bx - q.ax, dz = q.bz - q.az, len = Math.hypot(dx, dz) || 1, nx = -dz / len, nz = dx / len;
  return [egToDungeon(spec, q.ax + nx * q.hw, q.y0, q.az + nz * q.hw), egToDungeon(spec, q.ax - nx * q.hw, q.y0, q.az - nz * q.hw), egToDungeon(spec, q.bx - nx * q.hw, q.y1, q.bz - nz * q.hw), egToDungeon(spec, q.bx + nx * q.hw, q.y1, q.bz + nz * q.hw)];
}
/** A plate: the Hour's island, and its mark - the arrival plate's gold ring inset; the end plate's door (two posts and a
 *  lintel of basalt across its far side). */
function plateModel(f, spec, d, occ = whole, band = spec.band ?? 0) {
  // EG-LOOK (Elite-Gates-Look.md section 2): the rim's lip and the law's edge as the Hour laid them, no teeth; the floor cut
  // into its border's regions (the arrival plate's gold ring IN it now, inside its compass of inlay - world/eliteGates/egGround.js)
  realmIsland(f, spec.x0 + d.x, d.z, d.r, SD_REALM_FLOOR_RECORD, { y: d.y, teeth: false, floor: false });
  egDiscFloor(f, spec, d, SD_REALM_FLOOR_RECORD, band);
  // the end plate's door: two pilasters on plinths in its posts' boxes, a round arch, a keystone carrying the band's sigil
  if (d.role === 'end') egDoorway(spec, d, EG_DOOR, band, (build) => occ(() => egKitInto(f, build)));
}

/** EG-FULL: A LANE (a bridge at any bearing - Grath's between his islands, a perch's side span, a caster's): its floor,
 *  its brass kerbs, its edge lines. */
/**
 * THE AUDIT (spec law 10): A LANE'S ENDS THAT NO FLOOR MEETS - `1` its a end, `2` its b end (both 3): a point a quarter metre past
 * the end, at the lane's height, on no disc, lane, band, ramp, piece's top, hero's floor or room - a broken bridge's foot at its
 * break, an approach run into its course's first piece over a gap. The laws before laid none (every lane end met a floor). Pure.
 * @param {any} spec @param {{ax: number, az: number, bx: number, bz: number, hw: number, y?: number}} l
 */
export function egLaneOpenEnds(spec, l) {
  const dx = l.bx - l.ax, dz = l.bz - l.az, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len, y = l.y ?? 0, H = 0.6;
  const seg = (px, pz, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / L2)); return Math.hypot(px - ax - vx * t, pz - az - vz * t); };
  const inPoly = (poly, px, pz) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) c = !c; } return c; };
  const met = (px, pz) => (spec.discs ?? []).some((d) => Math.abs((d.y ?? 0) - y) < H && Math.hypot(px - d.x, pz - d.z) <= d.r)
    || (spec.lanes ?? []).some((q) => q !== l && Math.abs((q.y ?? 0) - y) < H && seg(px, pz, q.ax, q.az, q.bx, q.bz) <= q.hw)
    || (spec.bands ?? []).some((b) => Math.abs((b.y ?? 0) - y) < H && Math.abs(px - b.x) <= b.halfW && pz >= b.z0 && pz <= b.z1)
    || (spec.ramps ?? []).some((q) => y >= Math.min(q.y0, q.y1) - H && y <= Math.max(q.y0, q.y1) + H && seg(px, pz, q.ax, q.az, q.bx, q.bz) <= q.hw)
    || (spec.steps ?? []).some((q) => Math.abs(q.y - y) < H && Math.abs(px - q.x) <= q.w / 2 && Math.abs(pz - q.z) <= q.d / 2)
    || (spec.heroes ?? []).some((q) => (q.floors ?? []).some((f) => Math.abs(f.y - y) < H && inPoly(f.poly, px, pz)) || (!q.room && px >= q.box[0] && px <= q.box[3] && pz >= q.box[2] && pz <= q.box[5] && y >= q.box[1] - H && y <= q.box[4]));
  return (met(l.ax - ux * 0.25, l.az - uz * 0.25) ? 0 : 1) | (met(l.bx + ux * 0.25, l.bz + uz * 0.25) ? 0 : 2);
}
function laneModel(f, spec, l) {
  const dx = l.bx - l.ax, dz = l.bz - l.az, len = Math.hypot(dx, dz) || 1, nx = -dz / len, nz = dx / len, y = l.y ?? 0;
  const P = (x, yy, z) => egToDungeon(spec, x, yy, z);
  const a0 = [l.ax + nx * l.hw, l.az + nz * l.hw], a1 = [l.ax - nx * l.hw, l.az - nz * l.hw], b0 = [l.bx + nx * l.hw, l.bz + nz * l.hw], b1 = [l.bx - nx * l.hw, l.bz - nz * l.hw];
  quadTo(f, SD_REALM_FLOOR_RECORD, P(a0[0], y, a0[1]), P(a1[0], y, a1[1]), P(b1[0], y, b1[1]), P(b0[0], y, b0[1]), [0, 1, 0], [[0, 0], [l.hw, 0], [l.hw, len / 2], [0, len / 2]]);
  for (const [p0, p1, side] of /** @type {[number[], number[], number][]} */ ([[a0, b0, 1], [a1, b1, -1]])) {
    quadTo(f, SD_REALM_ROOT_RECORD, P(p0[0], y - 0.9, p0[1]), P(p1[0], y - 0.9, p1[1]), P(p1[0], y, p1[1]), P(p0[0], y, p0[1]), [nx * side, 0, nz * side]);
    const o = 0.05 * side;
    quadTo(f, SD_REALM_EDGE_RECORD, P(p0[0], y + 0.02, p0[1]), P(p1[0], y + 0.02, p1[1]), P(p1[0] - nx * o, y + 0.02, p1[1] - nz * o), P(p0[0] - nx * o, y + 0.02, p0[1] - nz * o), [0, 1, 0]);
  }
  // THE AUDIT (spec law 10): a lane's end over the void (egLaneOpenEnds - a broken bridge's, an approach run into its course's
  // first piece) closed by its face down to its root and its edge's line across it, as its sides - every lane end met a floor
  // before the bridges broke
  const open = egLaneOpenEnds(spec, l);
  for (const [on, p0, p1, s] of /** @type {[number, number[], number[], number][]} */ ([[open & 1, a1, a0, -1], [open & 2, b0, b1, 1]])) {
    if (!on) continue;
    const ux = (dx / len) * s, uz = (dz / len) * s, o = 0.05;
    quadTo(f, SD_REALM_ROOT_RECORD, P(p0[0], y - 0.9, p0[1]), P(p1[0], y - 0.9, p1[1]), P(p1[0], y, p1[1]), P(p0[0], y, p0[1]), [ux, 0, uz]);
    quadTo(f, SD_REALM_EDGE_RECORD, P(p0[0], y + 0.02, p0[1]), P(p1[0], y + 0.02, p1[1]), P(p1[0] - ux * o, y + 0.02, p1[1] - uz * o), P(p0[0] - ux * o, y + 0.02, p0[1] - uz * o), [0, 1, 0]);
  }
}
/** EG-FULL: THE GROUNDS' DRESS (section 13.3, 11.4) - a chamber's ring wall (open where the course enters and leaves), a
 *  magma chamber's molten floor far below, a pit's tiers, the forge's long walls. */
function decoModel(f, spec, d, occ = whole, band = spec.band ?? 0) {
  const P = (x, yy, z) => egToDungeon(spec, x, yy, z), piece = (build) => occ(() => egKitInto(f, build));
  // EG-LOOK (Elite-Gates-Look.md section 2 - world/eliteGates/egGround.js): a ring wall the academy's arcade out from its collider's ring,
  // open at the course's gaps; a pit's tiers stepped stone benches; the long walls the academy's wall - each bay a piece
  if (d.t === 'wall') egRingArcade(spec, d, band, piece);
  else if (d.t === 'tiers') egTierBenches(spec, d, piece);
  else if (d.t === 'magma') {
    const y = d.y ?? -1.5, r = d.r;
    quadTo(f, EG_DRESS.molten, P(d.x - r, y, d.z - r), P(d.x + r, y, d.z - r), P(d.x + r, y, d.z + r), P(d.x - r, y, d.z + r), [0, 1, 0], [[0, 0], [r / 4, 0], [r / 4, r / 4], [0, r / 4]]);   // EG-G2: the band's liquid
  } else if (d.t === 'hall') egLongWalls(spec, d, band, piece);
}
// ── EG-HERO-LAY (2026-10-13, spec law 7): THE HERO DRAWN ─────────────────────────────────────────────────────────────────
/** The hero meshes the circle draws from (egHeroMeshSeam): world/eliteGates/egHeroFragModel.js EG_HERO_FRAG_MESHES unless a test said
 *  otherwise. */
let _heroMeshes = /** @type {Readonly<Record<string, any>>|null} */ (null);
/** THE SEAM: the hero mesh registry the circle draws and collides from (world/eliteGates/egHeroFragModel.js egHeroFragMeshes's shape) -
 *  null for EG_HERO_FRAG_MESHES. Answers the one it replaced. For a test, and nothing that stands a breach. */
export function egHeroMeshSeam(meshes = null) { const was = _heroMeshes; _heroMeshes = meshes; return was; }
const heroMeshes = () => _heroMeshes ?? EG_HERO_FRAG_MESHES;
/** A hand (m): a hero's triangle whose top stands within it of a height its law lays ground at is its ground. */
export const EG_HERO_GROUND_HAND_M = 0.2;
/** The heights (m, from hero `q`'s origin - net/eliteGates/egLaw.js `heroes`) its law lays ground at: its floors' and its stairs' corners'. */
export const egHeroGroundYs = (q) => [...new Set([...q.floors.map((g) => g.y - q.y), ...q.ramps.flatMap((r) => r.poly.map((p) => p[1] - q.y))])];
/** Does a hall's hero's box (net/eliteGates/egLaw.js `heroes` - the hall's frame) hold (x, z) in plan - and, given `y`, at that height
 *  too? Pure. THE ASCENT: never a room's (spec law 9's heroes with a `room`) - a room has no mesh of its own: its stairs, its alcoves,
 *  its spouts are the hall's. A stair is asked at its height: a room's stair over a hero's box (the sweep, seed 320's Clan Pit with
 *  a stair 8 m over its rim) is the hall's, never the hero's mesh's. */
export const egInHeroBox = (spec, x, z, y = null) => (spec?.heroes ?? []).some((q) => !q.room && x >= q.box[0] && x <= q.box[3] && z >= q.box[2] && z <= q.box[5]
  && (y == null || (y >= q.box[1] && y <= q.box[4])));
/** The side (m) of the cells a hero's rock is cut into, a record's in each an occluder of its own (EG-ZN - a camera's ray
 *  dithers the rock it crosses, never the whole fragment, and a piece dithering costs its one record two draws more). */
export const EG_HERO_ROCK_CELL_M = 6;
/** A kit (world/eliteGates/egHeroFragModel.js egHeroFragInto's) that sorts a baked mesh's triangles: its GROUND (each whose top stands
 *  within EG_HERO_GROUND_HAND_M of a height in `ys`, the law's - a floor, a floor's lip and side, a stair) in `ground`, its
 *  ROCK (every other: a wall, a pillar, a vault, a fall of fire, whatever record it wears) in `rock` by its record and the cell
 *  of its middle (EG_HERO_ROCK_CELL_M across, from the origin) - each `[record, mesh, first index]`. EG-HERO-LAY at the merge of the ten
 *  heroes: it was told by the record, and a hero dresses a trunk or a tier in its floor's or its molten's record - rock the
 *  camera could not see through; and the rock was one occluder, the whole fragment dithered for one wall. */
const heroSorter = (ys) => {
  const ground = [], rock = new Map();
  return {
    ground, rock,
    mesh(rec, src, { start = 0, count = src.indices.length / 3 } = {}) {
      const P = src.positions, I = src.indices;
      for (let k = start; k < start + count * 3; k += 3) {
        const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3, top = Math.max(P[a + 1], P[b + 1], P[c + 1]);
        if (ys.some((y) => Math.abs(top - y) <= EG_HERO_GROUND_HAND_M)) { ground.push([rec, src, k]); continue; }
        const key = `${rec}:${Math.floor((P[a] + P[b] + P[c]) / 3 / EG_HERO_ROCK_CELL_M)}:${Math.floor((P[a + 2] + P[b + 2] + P[c + 2]) / 3 / EG_HERO_ROCK_CELL_M)}`;
        let list = rock.get(key);
        if (!list) rock.set(key, list = []);
        list.push([rec, src, k]);
      }
      return this;
    },
  };
};
/** Triangles `tris` (heroSorter's) copied into faces `f` (world/gate/gateModel.js faces' `byRec`) with their own normals and UVs,
 *  moved by `at`. */
function heroTrisInto(f, tris, at) {
  for (const [rec, src, k] of tris) {
    let g = f.byRec.get(rec);
    if (!g) f.byRec.set(rec, g = { p: [], n: [], uv: [], parts: [] });
    for (let c = 0; c < 3; c++) {
      const v = src.indices[k + c];
      g.p.push(src.positions[v * 3] + at[0], src.positions[v * 3 + 1] + at[1], src.positions[v * 3 + 2] + at[2]);
      g.n.push(src.normals[v * 3], src.normals[v * 3 + 1], src.normals[v * 3 + 2]);
      g.uv.push(src.uvs[v * 2], src.uvs[v * 2 + 1]);
    }
    g.parts.push(GATE_PART.Stone);
  }
}
/** A hall's hero, drawn into faces `f` at its origin (the dungeon's frame): its ground, then its rock a record's cell at a time,
 *  each an occluder. A hero this build does not carry (a hall the relay gave a law-foreign client) draws nothing - its law stands all
 *  the same. */
function heroModel(f, spec, occ = whole) {
  for (const q of spec.heroes ?? []) {
    const M = heroMeshes();
    if (q.room || !M[q.id]) continue;   // THE ASCENT: a room is built from its words (world/eliteGates/egRoomModel.js), never a baked mesh
    const at = egToDungeon(spec, q.x, q.y, q.z), S = egHeroFragInto(heroSorter(egHeroGroundYs(q)), q.id, at, M);
    heroTrisInto(f, S.ground, at);
    for (const tris of S.rock.values()) occ(() => heroTrisInto(f, tris, at));
  }
}
/** THE CIRCLE'S HALLS, as one mesh (renderer.createMesh's model), in the circle's band's dress (EG-G2 - world/eliteGates/egBandArt.js).
 *  `geo` the circle's span decrees (net/eliteGates/egLaw.js egGeoOf) - the same specs the relay judges. EG-ZN: and its OCCLUDERS
 *  (`model.occluders` - egOccluderRuns), each piece of rock laid as runs of the one mesh. */
export function buildEgCircleModel(seed, c, geo = 0) {
  const f = faces(), pieces = [], occ = occluderMarker(f, pieces), band = egBandOfCircle(c);
  for (const spec of egCircleSpecs(seed, c, geo)) {
    for (const d of spec.discs) {
      if (egIsleDisc(spec, d)) continue;   // LAYER THREE: Grath's islands fall - the spans stand each (scenes/eliteGates/egSpan.js)
      if (d.role === 'arrive' || d.role === 'end') { plateModel(f, spec, d, occ, band); continue; }
      // EG-LOOK (Elite-Gates-Look.md section 2): the rim and its edge, never the Hour's teeth; the floor cut into its regions
      // (a court's great mosaic of its band's sigil and its border - world/eliteGates/egGround.js egDiscFloor)
      const rec = d.role === 'court' || d.role === 'isle' || d.role === 'balcony' ? SD_REALM_ARENA_RECORD : SD_REALM_FLOOR_RECORD;
      realmIsland(f, spec.x0 + d.x, d.z, d.r, rec, { y: d.y, teeth: false, floor: false });
      egDiscFloor(f, spec, d, rec, band);
    }
    for (const b of spec.bands) if (!egWallBand(spec, b) && !egTubeBand(b)) bandModel(f, spec, b);   // a Falling Wall's walkway and a Collapsing Tube's floor are the spans' own segments (scenes/eliteGates/egSpan.js)
    for (const l of spec.lanes ?? []) laneModel(f, spec, l);
    for (const q of spec.caves) caveModel(f, spec, q, occ, band);
    for (const d of spec.deco ?? []) decoModel(f, spec, d, occ, band);
    // EG-FULL LAYER THREE: the alcoves' niches, the vignettes, the chambers' arches and stairs (EG-ZN: each an occluder)
    nicheModel(f, spec, occ);
    for (const v of spec.vignettes ?? []) occ(() => vignetteModel(f, spec, v));
    for (const d of spec.deco ?? []) if (d.t === 'arch') egChokeArch(spec, d, band, archParts(spec, d), (build) => occ(() => egKitInto(f, build)));   // EG-LOOK: its arms dressed in the law's boxes, a voussoir arch over the gap
    for (const q of spec.ramps ?? []) { if (egInHeroBox(spec, (q.ax + q.bx) / 2, (q.az + q.bz) / 2, (q.y0 + q.y1) / 2)) continue; const [a, b, c, e] = rampCorners(spec, q); quadTo(f, SD_REALM_FLOOR_RECORD, a, b, c, e, [0, 1, 0]); quadTo(f, SD_REALM_ROOT_RECORD, a, b, [b[0], b[1] - 0.6, b[2]], [a[0], a[1] - 0.6, a[2]], [0, -1, 0]); }   // EG-HERO-LAY: a hero's stairs are its own mesh's
    heroModel(f, spec, occ);   // EG-HERO-LAY: the hall's hero, at its origin
    // THE ASCENT (spec law 9): the hall's rooms, plain - their floors, ceilings, walls, balustrades and climb faces
    egRoomModelInto(f, spec, { floor: SD_REALM_FLOOR_RECORD, root: SD_REALM_ROOT_RECORD, wall: SD_REALM_PILLAR_RECORD, rail: SD_REALM_BRASS_RECORD }, occ);
    // EG-ZC: the slag's spouts - iron on the wall, the band's liquid at the mouth facing down onto the lane
    for (const { box: [x0, y0, z0, x1, y1, z1] } of egSlagSpouts(spec)) occ(() => {
      boxD(f, SD_REALM_BRASS_RECORD, x0, y0, z0, x1, y1, z1, false, 0.5);
      quadTo(f, EG_DRESS.molten, [x0, y0 - 0.002, z0], [x1, y0 - 0.002, z0], [x1, y0 - 0.002, z1], [x0, y0 - 0.002, z1], [0, -1, 0]);
    });
  }
  // the Hour's records it wears onto the band's archive (EG-G2), and the kit's (EG-LOOK - 61, 62, 71: never the Hour's archive,
  // whose 60-78 are the Steps' pictures; the circle's mesh holds none of the Steps' faces): one model, one upload
  const model = egBandDress(packRealmFaces(f), band);
  for (const sm of model.subMeshes) if (EG_KIT_RECORDS.includes(sm.textureRecord)) sm.textureArchive = egBandArchive(band);
  model.occluders = egOccluderRuns(model, pieces);
  return model;
}

// ── EG-ZN: THE OCCLUDERS, MARKED ────────────────────────────────────────────────────────────────────────────────────
/** A builder's faces laid whole (no occluder marked) - every builder's own default. */
function whole(fn) { fn(); }
/** The marker over faces `f` (world/gate/gateModel.js faces): `occ(fn)` lays `fn`'s faces as ONE OCCLUDER, keeping per record
 *  which of that record's triangles it laid (`[record, first, count]`) on `pieces`. A piece's faces in one record are laid
 *  together, so each is one run of its record's sub-mesh. */
function occluderMarker(f, pieces) {
  return (fn) => {
    const at = new Map();
    for (const [rec, g] of f.byRec) at.set(rec, g.p.length / 9);
    fn();
    const runs = [];
    for (const [rec, g] of f.byRec) { const a = at.get(rec) ?? 0, n = g.p.length / 9 - a; if (n > 0) runs.push([rec, a, n]); }
    if (runs.length) pieces.push(runs);
  };
}
/**
 * A packed model's OCCLUDERS (world/superDungeon/sdRealm.js packRealmFaces - a sub-mesh a record, its triangles in the order laid):
 * each piece `{ b: [x0, y0, z0, x1, y1, z1], r: [[subMesh, startIndex, primitiveCount], ...] }` - its box in the
 * dungeon's frame, and its runs of the model's indices in a sub-mesh's own units (`startIndex`, `primitiveCount`). Pure.
 * @param {any} model @param {Array<Array<number[]>>} pieces
 */
export function egOccluderRuns(model, pieces) {
  const sub = new Map(model.subMeshes.map((sm, i) => [sm.textureRecord, i])), P = model.positions, I = model.indices;
  return pieces.map((runs) => {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    const r = runs.map(([rec, a, n]) => {
      const i = sub.get(rec), s = model.subMeshes[i].startIndex + a * 3;
      for (let j = s; j < s + n * 3; j++) for (let k = 0, v = I[j] * 3; k < 3; k++) { const x = P[v + k]; if (x < b[k]) b[k] = x; if (x > b[k + 3]) b[k + 3] = x; }
      return [i, s, n];
    }).sort((x, y) => x[0] - y[0]);   // EG-LOOK HALLS: a piece of several records lists its runs in the sub-meshes' order (the view's)
    return { b, r };
  });
}

/** AUDIT EG V (lane5 #15): the floors that stand raised over the ground their ways leave - a Rampart's caster pillar, the Wyrm's
 *  perches, a chamber's and the Rotunda's balconies: each stands its rim faces in the collider (egCircleColliderTris), but over
 *  this much (m) beside a stair's top on it. */
export const EG_RAISED_ROLES = Object.freeze(['pillar', 'perch', 'balcony']);
export const EG_RAISED_WAY_PAD_M = 0.35;
/** THE CIRCLE'S FLOORS AND WALLS, FOR THE COLLIDER (the dungeon's frame; both faces are one to the collider): its discs,
 *  its bands, its passages' walls and ceilings, its doors' posts. One bucket. */
export function egCircleColliderTris(seed, c, geo = 0) {
  const out = [];
  const tri = (a, b, d) => out.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2]);
  const quad = (a, b, d, e) => { tri(a, b, d); tri(a, d, e); };
  const box = (x0, y0, z0, x1, y1, z1) => {
    const P = (x, y, z) => [x, y, z];
    quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)); quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1));
    quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)); quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1));
    quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)); quad(P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0));
  };
  for (const spec of egCircleSpecs(seed, c, geo)) {
    for (const l of spec.lanes ?? []) {
      const dx = l.bx - l.ax, dz = l.bz - l.az, len = Math.hypot(dx, dz) || 1, nx = -dz / len, nz = dx / len, y = l.y ?? 0;
      quad(egToDungeon(spec, l.ax + nx * l.hw, y, l.az + nz * l.hw), egToDungeon(spec, l.ax - nx * l.hw, y, l.az - nz * l.hw), egToDungeon(spec, l.bx - nx * l.hw, y, l.bz - nz * l.hw), egToDungeon(spec, l.bx + nx * l.hw, y, l.bz + nz * l.hw));
    }
    for (const d of spec.deco ?? []) {
      if (d.t === 'wall') {
        const n = 32, y0 = (d.y ?? 0) - 0.5, y1 = (d.y ?? 0) + d.h;
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
          const x0 = d.x + Math.sin(a0) * d.r, z0 = d.z + Math.cos(a0) * d.r, x1 = d.x + Math.sin(a1) * d.r, z1 = d.z + Math.cos(a1) * d.r;
          // what stands of it: none at the course's gaps; (spec law 10) the two beside an alcove's doorway (THE AUDIT)
          for (const [t0, t1] of egRingSideWalls(spec, d, k, n)) {
            const p0 = egToDungeon(spec, x0 + (x1 - x0) * t0, y0, z0 + (z1 - z0) * t0), p1 = egToDungeon(spec, x0 + (x1 - x0) * t1, y0, z0 + (z1 - z0) * t1);
            quad(p0, p1, [p1[0], p1[1] + (y1 - y0), p1[2]], [p0[0], p0[1] + (y1 - y0), p0[2]]);
          }
        }
      } else if (d.t === 'hall') {
        for (const sgn of [-1, 1]) { const a = egToDungeon(spec, d.x + sgn * d.hw, (d.y ?? 0) - 0.5, d.z0), b = egToDungeon(spec, d.x + sgn * d.hw, (d.y ?? 0) - 0.5, d.z1); quad(a, b, [b[0], b[1] + d.h + 0.5, b[2]], [a[0], a[1] + d.h + 0.5, a[2]]); }
      }
    }
    for (const d of spec.discs) {
      if (egIsleDisc(spec, d)) continue;
      // AUDIT EG V (lane5 #15): a RAISED floor (a caster's pillar, a perch, a balcony - EG_RAISED_ROLES) stands its rim faces as
      // deep as its drawn lip (SD_LIP), but where a stair comes up onto it: a body walking at its foot meets its face, never
      // the underside of its top (nothing walks in under a pillar's top, into its rock, and falls)
      const way = EG_RAISED_ROLES.includes(d.role) ? (spec.ramps ?? []).filter((q) => Math.abs(q.y1 - d.y) < 0.05 && Math.hypot(q.bx - d.x, q.bz - d.z) <= d.r + 0.5) : null;
      for (let k = 0; k < SD_ISLAND_SIDES; k++) {
        const a0 = (k / SD_ISLAND_SIDES) * Math.PI * 2, a1 = ((k + 1) / SD_ISLAND_SIDES) * Math.PI * 2;
        tri(realmToDungeon(spec.x0 + d.x, d.y, d.z), realmToDungeon(spec.x0 + d.x + Math.cos(a1) * d.r, d.y, d.z + Math.sin(a1) * d.r), realmToDungeon(spec.x0 + d.x + Math.cos(a0) * d.r, d.y, d.z + Math.sin(a0) * d.r));
        if (!way) continue;
        const mx = d.x + Math.cos((a0 + a1) / 2) * d.r, mz = d.z + Math.sin((a0 + a1) / 2) * d.r;
        if (way.some((q) => Math.hypot(mx - q.bx, mz - q.bz) <= q.hw + EG_RAISED_WAY_PAD_M)) continue;
        const p0 = realmToDungeon(spec.x0 + d.x + Math.cos(a0) * d.r, d.y, d.z + Math.sin(a0) * d.r), p1 = realmToDungeon(spec.x0 + d.x + Math.cos(a1) * d.r, d.y, d.z + Math.sin(a1) * d.r);
        quad(p0, p1, [p1[0], p1[1] - SD_LIP, p1[2]], [p0[0], p0[1] - SD_LIP, p0[2]]);
      }
      if (d.role === 'end') {
        for (const s of [-1, 1]) { const a = realmToDungeon(spec.x0 + d.x + s * EG_DOOR.halfW - EG_DOOR.post / 2, d.y, d.z - EG_DOOR.post / 2), e = realmToDungeon(spec.x0 + d.x + s * EG_DOOR.halfW + EG_DOOR.post / 2, d.y + EG_DOOR.h, d.z + EG_DOOR.post / 2); box(a[0], a[1], a[2], e[0], e[1], e[2]); }
      }
    }
    for (const b of spec.bands) if (!egWallBand(spec, b) && !egTubeBand(b)) quad(egToDungeon(spec, b.x - b.halfW, b.y, b.z0), egToDungeon(spec, b.x + b.halfW, b.y, b.z0), egToDungeon(spec, b.x + b.halfW, b.y, b.z1), egToDungeon(spec, b.x - b.halfW, b.y, b.z1));
    // the passages' walls (broken at their alcoves) and vaults - none where a passage is open (the Colonnade) or under
    // the moon (the Gloam Thicket): the collider's proxy is the drawn walls' inner envelope
    for (const q of spec.caves) {
      const yLo = Math.min(q.y, q.yB ?? q.y), yHi = Math.max(q.y, q.yB ?? q.y);
      if (q.open) continue;
      for (const s of [-1, 1]) for (const [z0, z1] of wallRuns(spec, q, s)) { const a = egToDungeon(spec, q.x + s * (q.halfW + 0.6), yLo - egWallFoot(q), z0), e = egToDungeon(spec, q.x + s * q.halfW, yHi + q.height, z1); box(Math.min(a[0], e[0]), a[1], a[2], Math.max(a[0], e[0]), e[1], e[2]); }
      if (q.kit === 'gloam' || q.tube) continue;
      const a = egToDungeon(spec, q.x - q.halfW - 0.6, yHi + q.height, q.z0), e = egToDungeon(spec, q.x + q.halfW + 0.6, yHi + q.height + 1, q.z1);
      box(a[0], a[1], a[2], e[0], e[1], e[2]);
    }
    // EG-FULL LAYER THREE: the niches (floor, walls, lid), the arches' walls, the ramps, the vignettes
    for (const { b: [x0, y0, z0, x1, y1, z1], door, a } of egNicheBoxes(spec)) {
      if (egInHeroBox(spec, a.x, a.z)) continue;   // EG-HERO-LAY: a hero's alcove is its proxy's
      quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]); quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
      quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]); quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
      const xb = Math.abs(x0 - door[0]) > Math.abs(x1 - door[0]) ? x0 : x1;
      quad([xb, y0, z0], [xb, y0, z1], [xb, y1, z1], [xb, y1, z0]);
    }
    for (const d of spec.deco ?? []) if (d.t === 'arch') for (const [x0, y0, z0, x1, y1, z1] of archParts(spec, d)) box(x0, y0, z0, x1, y1, z1);
    for (const q of spec.ramps ?? []) { if (egInHeroBox(spec, (q.ax + q.bx) / 2, (q.az + q.bz) / 2, (q.y0 + q.y1) / 2)) continue; const [a, b, c, e] = rampCorners(spec, q); quad(a, b, c, e); }   // EG-HERO-LAY: a hero's stairs are its proxy's
    for (const v of spec.vignettes ?? []) { const a = egToDungeon(spec, v.x - 0.4, v.y, v.z - 1.0), e = egToDungeon(spec, v.x + 0.4, v.y + 1.4, v.z + 1.0); box(Math.min(a[0], e[0]), a[1], Math.min(a[2], e[2]), Math.max(a[0], e[0]), e[1], Math.max(a[2], e[2])); }
    // EG-HERO-LAY: the hall's hero's proxy (section 11.6 - never its drawn mesh), at its origin
    for (const q of spec.heroes ?? []) { const M = heroMeshes(); if (!q.room && M[q.id]) for (const v of egHeroFragCollider(q.id, egToDungeon(spec, q.x, q.y, q.z), M)) out.push(v); }
    egRoomColliderInto(spec, out);   // THE ASCENT (spec law 9): the rooms' floors, ceilings and walls - the top you see is the top you stand on
  }
  return new Float32Array(out);
}

/** THE RAMPART'S PORTCULLIS (section 8.3): bars across its walkway's end, held by its Ward-Bearers - its own mesh and its
 *  own collider triangles (the scene sinks both once its door opens). `null` for a hall with no gate. */
export function egGateParts(spec) {
  if (!spec.gate) return null;
  const g = spec.gate, f = faces(), tris = [];
  const n = Math.max(4, Math.round((g.halfW * 2) / 0.55));
  for (let k = 0; k <= n; k++) {
    const x = -g.halfW + (k / n) * g.halfW * 2;
    const a = egToDungeon(spec, x - 0.07, 0, g.z - 0.07), c = egToDungeon(spec, x + 0.07, 4.2, g.z + 0.07);
    boxD(f, SD_REALM_BRASS_RECORD, a[0], a[1], a[2], c[0], c[1], c[2], false, 0.5);
  }
  for (const yb of [1.2, 2.6, 4.0]) { const a = egToDungeon(spec, -g.halfW, yb, g.z - 0.09), c = egToDungeon(spec, g.halfW, yb + 0.16, g.z + 0.09); boxD(f, SD_REALM_PILLAR_RECORD, a[0], a[1], a[2], c[0], c[1], c[2], true, 0.5); }
  const a = egToDungeon(spec, -g.halfW, 0, g.z - 0.15), c = egToDungeon(spec, g.halfW, 4.2, g.z + 0.15);
  const P = (x, y, z) => [x, y, z];
  for (const z of [a[2], c[2]]) tris.push(...P(a[0], 0, z), ...P(c[0], 0, z), ...P(c[0], 4.2, z), ...P(a[0], 0, z), ...P(c[0], 4.2, z), ...P(a[0], 4.2, z));
  return { model: egBandDress(packRealmFaces(f), spec.band ?? 0), tris: new Float32Array(tris) };
}

/** AUDIT EG V (L5-16; Elite-Gates.md section 11.9): THE LAMPS' BUDGET - at most `n` lamps stand within `r` m of any lamp of a
 *  circle, so the renderer's nearest lights (16 - render/renderer.js) never cut one beside the eye and none pops as it moves:
 *  Grath's three islands and their court stood 24 lamps within 40 m (18 about one), 338 of 1,200 circles past 12. */
export const EG_LAMP_BUDGET = Object.freeze({ n: 12, r: 40 });
/** A ring's lamps in the order they keep their place under the budget: each next one as far round from those before as it
 *  can stand (six: 0, 3, 1, 4, 2, 5 - two facing, then the pairs between), so a thinned ring stays spread. */
const spreadRank = (k, n) => { const order = [0]; for (let step = n; order.length < n; step = Math.ceil(step / 2)) for (let j = 0; j < n; j += step) if (!order.includes(j)) order.push(j); return order.indexOf(k); };

/** THE CIRCLE'S LAMPS (the light list's shape, the dungeon's frame): two by each plate, round each court's rim, along the
 *  walkway, the fire in each passage's channels; EG-ZL: one before each Drop's far wall (EG_DROP_LAMP). EG-LOOK (Elite-Gates-
 *  Look.md section 3.3): a disc's lamp on its column of the ruin, at its fixture's flame (world/eliteGates/egRuin.js egRuinColumns -
 *  the old place where none stands clear), and the disc's and the walkway's lamps the band's tint (world/eliteGates/egAtmos.js); the
 *  count and the budget as they were. AUDIT EG V (L5-16):
 *  held to EG_LAMP_BUDGET - a lamp that would stand a 13th within 40 m of itself or of another is let go, the meaningful
 *  first (a fragment's own lights and a Drop's wall, whose colour says where you are), then each ring's spread order, then
 *  the walkways', in the order they were laid. */
export function egCircleLights(seed, c, geo = 0) {
  const out = [], rank = [];
  const lamp = (p, color = EG_LAMP.color, range = Number(EG_LAMP.range), pr = 0) => { out.push({ x: p[0], y: p[1], z: p[2], range, color: [...color] }); rank.push(pr); };
  for (const spec of egCircleSpecs(seed, c, geo)) {
    const ruin = egRuinColumns(spec), tint = egRuinLampTint(egBandOfHall(spec.h));
    spec.discs.forEach((d, i) => {
      const n = egDiscLamps(d);
      for (let k = 0; k < n; k++) {
        const on = ruin.lamp(i, k), a = (k / n) * Math.PI * 2 + Math.PI / 4;
        lamp(on ? egToDungeon(spec, on.at[0], on.at[1], on.at[2]) : egToDungeon(spec, d.x + Math.cos(a) * (d.r - 1), d.y + EG_LAMP.h, d.z + Math.sin(a) * (d.r - 1)), on ? egRuinLampTint(on.band) : tint, Number(EG_LAMP.range), 1 + spreadRank(k, n));
      }
    });
    if (spec.walk) for (let z = spec.walk.z0 + 8; z < spec.walk.z1; z += EG_LAMP.pitch) for (const s of [-1, 1]) lamp(egToDungeon(spec, s * (spec.walk.halfW + 0.3), EG_LAMP.h, z), tint, Number(EG_LAMP.range), 7);
    for (const s of spec.steps) if (s.kind === 'drop') lamp(egToDungeon(spec, s.x, s.y + EG_DROP_LAMP.h, s.z + s.d / 2 - EG_DROP_LAMP.off));   // EG-ZL: a Drop's wall lit
    // EG-FULL LAYER THREE: each fragment's own lights (net/eliteGates/egFragLaw.js) - the lava's orange, the kit's own colour, the moon
    for (const [x, y, z, kind] of spec.lights ?? []) {
      const kit = (spec.frags ?? []).find((q) => z >= q.z0 - 1 && z <= q.z1 + 1)?.kit;
      lamp(egToDungeon(spec, x, y, z), kind === 'lava' ? EG_LAMP.lava : kind === 'moon' ? EG_LAMP.moon : EG_FRAGS[kit]?.light ?? EG_LAMP.color, kind === 'moon' ? 18 : 10);
    }
  }
  // AUDIT EG V (L5-16): THE LAMPS' BUDGET, kept greedily in rank order - each lamp's neighbours within r counted with it
  const { n: N, r: R } = EG_LAMP_BUDGET, order = out.map((_, i) => i).sort((a, b) => rank[a] - rank[b] || a - b);
  const kept = [], near = new Map();
  for (const i of order) {
    const L = out[i], by = kept.filter((j) => Math.hypot(out[j].x - L.x, out[j].y - L.y, out[j].z - L.z) <= R);
    if (by.length + 1 > N || by.some((j) => near.get(j) + 1 > N)) continue;
    for (const j of by) near.set(j, near.get(j) + 1);
    near.set(i, by.length + 1);
    kept.push(i);
  }
  return out.filter((_, i) => near.has(i));
}
/** The lamps nearest `eye` first, the arm's own lights before them, in kept arrays (world/superDungeon/sdRealm.js realmLightsWith's
 *  composition, over the circle's own lamps). */
const _egLit = { cap: 0, data: lightList(0), colors: new Float32Array(0), carried: new Uint8Array(0), views: new Map() };
export function egLightsWith(lit, extra, lamps, eye) {
  const n = lit.data.length / 4, H = _egLit;
  if (eye && lamps.length > 1) {
    const ex = eye[0], ez = eye[2];
    for (let i = 1; i < lamps.length; i++) {
      const l = lamps[i], dl = (l.x - ex) ** 2 + (l.z - ez) ** 2;
      let j = i - 1;
      while (j >= 0 && (lamps[j].x - ex) ** 2 + (lamps[j].z - ez) ** 2 > dl) { lamps[j + 1] = lamps[j]; j--; }
      lamps[j + 1] = l;
    }
  }
  const m = n + extra.length + Math.min(lamps.length, 24);
  if (m > H.cap) { H.cap = Math.max(m, H.cap * 2, 32); H.data = lightList(H.cap); H.colors = new Float32Array(H.cap * 3); H.carried = new Uint8Array(H.cap); H.views.clear(); }
  copyLights(H.data, 0, lit.data, 0, n);   // LIGHT-ID: the arm's own lights, their identities with them (sdRealm.js realmLightsWith's shape)
  for (let j = 0; j < n * 3; j++) H.colors[j] = lit.colors[j];
  const lc = lit.data.carried;
  for (let j = 0; j < m; j++) H.carried[j] = j < n && lc ? lc[j] : 0;
  for (let i = n; i < m; i++) {
    const q = i - n, l = q < extra.length ? extra[q] : lamps[q - extra.length];
    packLight(H.data, i, l);   // LIGHT-ID: the one seam - a lamp is its record's light
    H.colors[i * 3] = l.color[0]; H.colors[i * 3 + 1] = l.color[1]; H.colors[i * 3 + 2] = l.color[2];
  }
  let v = H.views.get(m);
  if (!v) {
    /** @type {Float32Array & { carried?: Uint8Array }} */
    const data = lightListView(H.data, m), carried = H.carried.subarray(0, m);
    data.carried = carried;
    v = { data, colors: H.colors.subarray(0, m * 3), carried };
    H.views.set(m, v);
  }
  return v;
}
/** The level's light (a dungeon trilight and its key) - EG-LOOK (Elite-Gates-Look.md section 7): circle `c`'s band's own
 *  (world/eliteGates/egAtmos.js - the realm's light from below, the Spire's lost sky or the moon from above), the Galleries' with no
 *  circle. One frozen object a band, made once. */
const _egLight = [0, 1, 2, 3].map((b) => Object.freeze({ tri: egAtmosOf(b).tri, key: egAtmosOf(b).key }));
export const egHallLighting = (c = 1) => _egLight[egBandOfCircle(Number.isSafeInteger(c) && c > 0 ? c : 1)];
/** The words the level's refusals say (the dungeon host's save, map and rest arms). */
export const EG_HALL_TEXT = Object.freeze({ noSave: EG_TEXT.noSave, noMap: EG_TEXT.noMap, noRest: EG_TEXT.noRest });

// ── EG-ZH (2026-10-12, Mac: "I said I want everything"): THE FIRE FALLS DRESSED, AND THE FRAGMENT'S OWN CLAMP ─────────────
/**
 * THE CAVERNS' FIRE FALLS (Elite-Gates.md sections 11.6 and 25.8): a fire fall wears Daggerfall's own TEXTURE.356 - the
 * Mantellan Crux's fire walls, record 0, lit through DFU's GetFireWallColors32 (formats/baseImageFile.js) - read from the
 * player's own ARENA2 at runtime, never shipped. Its flames stand across the passage on the fall's own line, `w` wide each
 * and as tall as the passage, while the fall burns (scenes/eliteGates/egFight.js draws them, animated at the billboards' own rate).
 */
export const EG_FIRE_FALL = Object.freeze({ archive: FIRE_WALLS_ARCHIVE, record: 0, w: 2, h: 4 });
/**
 * A fire fall's flames in hall `spec` (`hz` one of its hazards, kind `fall`): `{ at: [[x, y, z], ...], w, h }` in the hall's
 * frame - each flame's foot on the fall's line across the passage, `w` wide, the passage's height tall (the passage the
 * line crosses - its cave - else EG_FIRE_FALL.h) - or null for any other hazard. Pure.
 * @param {any} spec @param {any} hz
 */
export function egFireFallFlames(spec, hz) {
  if (hz?.kind !== 'fall' || !Array.isArray(hz.sh) || hz.sh.length < 4) return null;
  const [x0, z0, x1, z1] = hz.sh, len = Math.hypot(x1 - x0, z1 - z0);
  const cave = (spec.caves ?? []).find((q) => Math.abs(q.x - (x0 + x1) / 2) <= q.halfW + 0.5 && (z0 + z1) / 2 >= q.z0 && (z0 + z1) / 2 <= q.z1);
  const n = Math.max(1, Math.round(len / EG_FIRE_FALL.w));
  const at = [];
  for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; at.push([x0 + (x1 - x0) * t, hz.y ?? 0, z0 + (z1 - z0) * t]); }
  return { at, w: len / n, h: cave ? cave.height : EG_FIRE_FALL.h };
}

/** THE FRAGMENT'S CLAMP's slack (m): a body this far past a zone's footprint is still that zone's to put back. */
export const EG_CLAMP_SLACK_M = 1.5;
/** The capsule's height (player/motor.js CAPSULE_HEIGHT): a zone's ceiling holds the head under it, so the feet stand at
 *  most this far below. */
const CLAMP_BODY_M = 1.8;
/**
 * THE FRAGMENT KEEPS ITS OWN CLAMP (Elite-Gates.md sections 11.7 and 11.8): climbing and wall-runs would carry a player up a
 * chamber's walls, and a safe perch over the fight would make traversal's immunity a ranged build's fortress - so each
 * fragment's footprint is extruded to its ceiling as the motor's clamp (`player.arena.clamp`), its open edges released.
 * Hall `spec`'s zones, in the hall's frame (pure):
 *   a PASSAGE (each cave)  `{ t: 'passage', x, z0, z1, halfW, y, ceil, open, shaft, zB, yB }` - its walls bound it (an open passage's sides
 *     are open edges), its two mouths and every alcove's doorway are open, its vault (or its walls' top) the ceiling;
 *   a CHAMBER (each fragment's ring wall - a trial's own walled floor is never a fragment) `{ t: 'chamber', x, z, r, y, ceil }`
 *     - its ring bounds it, the gaps where the course comes in and goes on are open, the ring's top the ceiling;
 *   EG-HERO-LAY - A HERO (spec law 7's `heroes`) `{ t: 'hero', h, box, y, ceil, shaft, zB, yB }` - its law's floors bound it,
 *     each edge a wall unless its law opens it (an `open` edge: the void, a lower floor, a stair, another floor at its height,
 *     its mouth, its exits), its stairs free, its ceilings over them (open to the sky where none stands); a hero shaft marked
 *     as a code-built one is (its foot its course's exit);
 *   THE ASCENT - A CLIMB (spec law 9's `climbs` - world/eliteGates/egRoomModel.js egClimbZones) `{ t: 'climb', c, x0, z0, x1, z1, y, ceil }`
 *     - first of all, so a climber on a room's face is the face's: held along its span (egClimbKeep), never its room's walls,
 *     no ceiling over it (its room's ceilings stand back from its lip).
 * Never the made levels' analytic clamps (the Hour's realmClamp, the Burning Court's courtArena).
 */
export function egFragZones(spec) {
  const out = egClimbZones(spec);
  for (const q of spec.caves ?? []) out.push({ t: 'passage', x: q.x, z0: q.z0, z1: q.z1, halfW: q.halfW, y: Math.min(q.y, q.yB ?? q.y), ceil: Math.max(q.y, q.yB ?? q.y) + q.height, open: q.open ? 1 : 0, shaft: q.shaft ? 1 : 0, zB: q.zB ?? q.z1, yB: q.yB ?? q.y });   // EG-ZN: a shaft's mark, where its foot begins and the foot's height
  for (const d of spec.deco ?? []) if (d.t === 'wall' && d.kit) out.push({ t: 'chamber', x: d.x, z: d.z, r: d.r, y: d.y ?? 0, ceil: (d.y ?? 0) + d.h });
  for (const h of spec.heroes ?? []) { const o = h.sockets.out[h.exit]; out.push({ t: 'hero', h, box: h.box, y: h.box[1], ceil: h.box[4], shaft: h.cls === 'shaft' ? 1 : 0, zB: o.z, yB: o.y }); }   // EG-HERO-LAY
  return out;
}
/** EG-HERO-LAY: the floor of hero `H` (a hall's `heroes` entry) a body's feet at (x, y, z) stand over - the highest whose
 *  polygon holds it and whose height band (0.5 m under, 3 m over - section 11.7's) holds its feet; its index, or -1. Pure. */
export function egHeroFloorAt(H, x, y, z) {
  let k = -1;
  for (const [i, f] of H.floors.entries()) if ((!Number.isFinite(y) || (y >= f.y - 0.5 && y <= f.y + 3)) && egPolyIn(f.poly, x, z) && (k < 0 || f.y > H.floors[k].y)) k = i;
  return k;
}
/** EG-HERO-LAY: the ceiling of hero `H` over (x, z) above height `y` - the lowest standing higher - or null (open to the sky).
 *  Pure. */
export function egHeroCeilAt(H, x, z, y) {
  let best = null;
  for (const c of H.ceil ?? []) if (c.y > y && (best === null || c.y < best) && egPolyIn(c.poly, x, z)) best = c.y;
  return best;
}
/** The zone of `zones` (egFragZones) a hall-frame point stands in - within its footprint and EG_CLAMP_SLACK_M, from 3 m
 *  under its floor to 3 m over its ceiling - or null. Pure. */
export function egFragZoneAt(zones, x, y, z) {
  for (const q of zones) {
    if (y < q.y - 3 || y > q.ceil + 3) continue;
    if (q.t === 'climb') { if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && y >= q.y && y <= q.ceil) return q; continue; }   // THE ASCENT: its face's own ground, no slack
    if (q.t === 'hero' ? z >= q.box[2] && z <= q.box[5] && x >= q.box[0] - EG_CLAMP_SLACK_M && x <= q.box[3] + EG_CLAMP_SLACK_M
      : q.t === 'passage' ? z >= q.z0 && z <= q.z1 && Math.abs(x - q.x) <= q.halfW + EG_CLAMP_SLACK_M : Math.hypot(x - q.x, z - q.z) <= q.r + EG_CLAMP_SLACK_M) return q;
  }
  return null;
}
/** EG-HERO-LAY - A HERO'S KEEP: (x, z) put back inside hero zone `q` (egFragZones') for a body of radius `r` whose feet stand
 *  at `y` - `[x, z]`, or null where it stands free. On a stair it is free; on a floor (egHeroFloorAt), each WALL edge (one its
 *  law does not open) holds it `r` inside; off every floor, the nearest edge of a floor of its height within
 *  EG_CLAMP_SLACK_M puts it back inside - unless that edge is open (it steps off into the void, onto a stair, out of its mouth
 *  or an exit). Pure. */
function heroKeep(q, x, z, r, y) {
  const H = q.h, open = new Set(H.open.map((e) => `${e[0]}:${e[1]}`));
  for (const rp of H.ramps) { const ys = rp.poly.map((p) => p[1]); if (egPolyIn(rp.poly.map((p) => [p[0], p[2]]), x, z, 0.05) && (!Number.isFinite(y) || (y >= Math.min(...ys) - 0.5 && y <= Math.max(...ys) + 3))) return null; }
  /** the point `r` inside edge e of floor fi, the body's nearest on it - its inward normal a counter-clockwise outline's left */
  const inside = (f, e, px, pz) => {
    const a = f.poly[e], b = f.poly[(e + 1) % f.poly.length], ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1, L = Math.sqrt(L2);
    const t = Math.max(0, Math.min(1, ((px - a[0]) * ex + (pz - a[1]) * ez) / L2));
    return [a[0] + ex * t - (ez / L) * r, a[1] + ez * t + (ex / L) * r];
  };
  const fi = egHeroFloorAt(H, x, y, z);
  if (fi >= 0) {
    const f = H.floors[fi];
    let px = x, pz = z, moved = false;
    for (let pass = 0; pass < 2; pass++) for (let e = 0; e < f.poly.length; e++) {
      if (open.has(`${fi}:${e}`)) continue;
      const a = f.poly[e], b = f.poly[(e + 1) % f.poly.length];
      if (segDist(px, pz, a[0], a[1], b[0], b[1]) < r - 1e-6) { [px, pz] = inside(f, e, px, pz); moved = true; }
    }
    return moved ? [px, pz] : null;
  }
  let best = null, bd = EG_CLAMP_SLACK_M;
  for (const [i, f] of H.floors.entries()) {
    if (Number.isFinite(y) && !(y >= f.y - 0.5 && y <= f.y + 3)) continue;
    for (let e = 0; e < f.poly.length; e++) { const a = f.poly[e], b = f.poly[(e + 1) % f.poly.length], d = segDist(x, z, a[0], a[1], b[0], b[1]); if (d < bd) { bd = d; best = [i, e]; } }
  }
  if (!best || open.has(`${best[0]}:${best[1]}`)) return null;
  return inside(H.floors[best[0]], best[1], x, z);
}
/** Whether a ring's bearing from its centre is one of its open gaps (the course in at -z, on at +z: world/eliteGates/egHall.js's ring
 *  wall leaves out every side whose middle's |sin| is under 0.2). */
const ringGap = (dx, dz) => { const d = Math.hypot(dx, dz); return d > 1e-9 && Math.abs(dx / d) < 0.2; };
/**
 * THE KEEP: a hall-frame (x, z) put back inside zone `q`, a body of radius `r` - `[x, z]` where it is put, or null where it
 * already stands (or stands at an open edge, or has left the zone). A passage's side holds it `r` inside its wall, never past
 * its mouths, at an alcove's doorway (`spec`'s alcoves) or along an open passage; a chamber's ring holds it `r` inside its
 * rim, never through a gap or once it is past the rim's slack. Pure.
 */
export function egFragKeep(q, x, z, r, spec = null, y = NaN) {
  if (!q) return null;
  if (q.t === 'hero') return heroKeep(q, x, z, r, y);   // EG-HERO-LAY: its law's floors and open edges
  if (q.t === 'climb') return egClimbKeep(q, x, z, r);   // THE ASCENT: along its face
  if (q.t === 'passage') {
    if (q.open || z < q.z0 || z > q.z1) return null;   // an open passage's sides, and its two mouths, are open edges
    const dx = x - q.x, lim = q.halfW - r;
    if (Math.abs(dx) <= lim) return null;
    const side = Math.sign(dx);
    const door = (spec?.alcoves ?? []).some((a) => Math.sign(a.x - q.x) === side && Math.abs(a.z - z) <= NICHE.w / 2 && a.z > q.z0 && a.z < q.z1);
    return door ? null : [q.x + side * lim, z];
  }
  const dx = x - q.x, dz = z - q.z, d = Math.hypot(dx, dz), lim = q.r - r;
  if (d <= lim || d > q.r + EG_CLAMP_SLACK_M || ringGap(dx, dz)) return null;
  // EG-PERFECT - SPEC LAW 10: an alcove's doorway at the court's rim (net/eliteGates/egWalkGraph.js egRingSideWalls - the ring open
  // there). THE AUDIT: its doorway alone, the body through it (EG_RING_DOOR less its radius across the alcove's line), on the
  // ring's own floor
  const doorOf = (a) => { const ax = a.x - q.x, az = a.z - q.z, al = Math.hypot(ax, az) || 1; return Math.abs((x - a.x) * (az / al) - (z - a.z) * (ax / al)) <= EG_RING_DOOR.w / 2 - r && Math.abs((x - a.x) * (ax / al) + (z - a.z) * (az / al)) <= NICHE.d; };
  if ((spec?.law ?? spec?.v ?? 0) >= 10 && (spec?.alcoves ?? []).some((a) => Math.abs((a.y ?? 0) - (q.y ?? 0)) < 1 && doorOf(a))) return null;
  return [q.x + (dx / d) * lim, q.z + (dz / d) * lim];
}
/**
 * THE MOTOR'S ARENA for a body at dungeon-frame `pos` in hall `spec` (player/motor.js _keepInArena's shape): `{ centre,
 * radius, ceilAbove, clamp, zone }` - the zone's floor its centre's height, its ceiling less the body its `ceilAbove`, and a
 * clamp that puts the feet back inside its walls (dungeon frame in, dungeon frame out) - or null outside every zone. Pure.
 * @param {any} spec @param {number[]} pos
 */
export function egFragArena(spec, pos) {
  if (!spec || !Array.isArray(pos)) return null;
  const [rx, y, z] = dungeonToRealm(pos[0], pos[1], pos[2]), x = rx - spec.x0;
  const q = egFragZoneAt(egFragZones(spec), x, y, z);
  if (!q) return null;
  if (q.t === 'climb') {
    // THE ASCENT: a climb's face - its foot the centre's height, nothing over it, held along its span
    return {
      centre: egToDungeon(spec, (q.c.x0 + q.c.x1) / 2, q.c.y0, (q.c.z0 + q.c.z1) / 2), radius: 1, ceilAbove: Infinity, zone: q,
      clamp: (p, r) => {
        const [px, , pz] = dungeonToRealm(p[0], p[1], p[2]);
        const to = egClimbKeep(q, px - spec.x0, pz, r);
        return to ? [egToDungeon(spec, to[0], 0, to[1])[0], egToDungeon(spec, to[0], 0, to[1])[2]] : null;
      },
    };
  }
  if (q.t === 'hero') {
    // EG-HERO-LAY: the hero's floor under the feet, its ceiling over them (open to the sky: no cap)
    const fi = egHeroFloorAt(q.h, x, y, z), fy = fi >= 0 ? q.h.floors[fi].y : q.y, top = egHeroCeilAt(q.h, x, z, fy);
    return {
      centre: egToDungeon(spec, x, fy, z), radius: 1, ceilAbove: top === null ? Infinity : Math.max(0.5, top - fy - CLAMP_BODY_M), zone: q,
      clamp: (p, r) => {
        const [px, py, pz] = dungeonToRealm(p[0], p[1], p[2]);
        const to = egFragKeep(q, px - spec.x0, pz, r, spec, py);
        return to ? [egToDungeon(spec, to[0], 0, to[1])[0], egToDungeon(spec, to[0], 0, to[1])[2]] : null;
      },
    };
  }
  const c = egToDungeon(spec, q.x, q.y, q.t === 'passage' ? (q.z0 + q.z1) / 2 : q.z);
  return {
    centre: c, radius: 1, ceilAbove: Math.max(0.5, q.ceil - q.y - CLAMP_BODY_M), zone: q,
    clamp: (p, r) => {
      const [px, , pz] = dungeonToRealm(p[0], p[1], p[2]);
      const to = egFragKeep(q, px - spec.x0, pz, r, spec);
      return to ? [egToDungeon(spec, to[0], 0, to[1])[0], egToDungeon(spec, to[0], 0, to[1])[2]] : null;
    },
  };
}

// ── EG-ZN (2026-10-12, Mac: "I said I want everything"): THE SHAFT'S LEDGE ─────────────────────────────────────────────
/** How far over its foot a shaft's ground stands while a drop is still before it (m): the Drop's landing and the Slag
 *  Chute's crust stand at the foot's own height, the rim and every flight a Drop's fall (3 m and more) over it. */
export const EG_SHAFT_LEDGE_M = 0.5;
/** The way down every shaft faces (net/eliteGates/egFragLaw.js egFragShaft: "its foot facing +Z"), a unit [x, z] - the hall's frame
 *  and the dungeon's alike (the two differ by a shift alone). */
export const EG_SHAFT_WAY = Object.freeze([0, 1]);
/**
 * THE SHAFT'S LEDGE (Elite-Gates.md section 11.8, "On a shaft's ledge facing a drop"): the shaft's way down (EG_SHAFT_WAY)
 * while a body whose feet stand at dungeon-frame `pos` in hall `spec` is on a shaft's ground with a drop still before it -
 * in a zone marked `shaft` (egFragZones: a cave the law marks, net/eliteGates/egLaw.js), short of its foot and at least
 * EG_SHAFT_LEDGE_M over the foot's height: its rim and every flight down to the Drop, and the air between them - else null
 * (the Drop's landing, the slag's crust, the foot, every passage and chamber, open ground). Pure.
 * @param {any} spec @param {number[]} pos
 */
export function egShaftLedgeAt(spec, pos) {
  if (!spec || !Array.isArray(pos)) return null;
  const [rx, y, z] = dungeonToRealm(pos[0], pos[1], pos[2]);
  const q = egFragZoneAt(egFragZones(spec), rx - spec.x0, y, z);
  return q?.shaft && z < q.zB && y >= q.yB + EG_SHAFT_LEDGE_M ? EG_SHAFT_WAY : null;
}
