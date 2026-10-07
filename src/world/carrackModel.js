// @ts-check
// SHIPS-2 (2026-10-07, Mac, sending New_Ship_2.fbx with its shutter and the Tiny Ship: "implement both of these new ship
// placement models, UV Map/Texture, and ensure it matches the love we gave the other new ship model we implemented"):
// THE NEW CARRACK - Mac's three-masted ship, built as Come Sail Away builds a hull, as the galleon is
// (world/galleonModel.js) for hull 2.
//
// Come Sail Away's hull 4 (the Carrack) is a prefab the C# instances and walks BY NAME (systems/comeSailAwayBoat.js
// GetBoatTransforms): its first MeshCollider the boat's frame, its DrivePosition the helm, its triggers what the player
// activates, its Booms and Sails the rig the wind fills, its RudderObject the wheel and the rudder, its anchor, its
// ladders and its modifiers. `carrackPrefab` makes that tree over Mac's model (src/assets/ships/carrack.json, baked by
// tools/bakeCarrack.mjs) and the parts built here, and systems/comeSailAwayModels.js stands it in for prefab 112414 -
// so everything that sails, steers, boards, fights, berths, saves and goes online on hull 4 reads her without a line of
// it knowing she is new.
//
// WHAT IS MAC'S AND WHAT IS BUILT. His: the hull with its ten gunports and its entry port, the gun deck and the main deck
// with their two hatchways, the six deck beams, the three deckhouses and the door of the middle one, the quarter rail,
// the three masts on their partners and steps (and a fourth step aft with no mast), the bowsprit, the rudder (his hull's,
// cut out to turn) and the gunport shutter. Built here: their textures (world/carrackArt.js - every face laid on its
// picture by `faceSkin`), the door as a leaf on its hinge in his doorway, stairs down each hatchway, his shutter at all
// ten ports fitted to her side, the guns behind them on their platforms and the chasers on her bow, the helm's wheel and
// its binnacle, the rig (world/carrackRig.js), the rope ladders over her side. Come Sail Away's own small things stand
// in her - the carrack's own anchor, weighed and let go, the galleon's cargo, the lanterns' poles and hooks, the colours,
// the wake and the carrack's modifiers (her handling: so she sails as the mod's carrack sails).
//
// WHAT OPENS AND CLOSES rides the mod's own Door Controller (systems/comeSailAway.js TriggerDoor): the middle house's
// door swings in on its hinge, and it is her cabin's door (SAILING-CABINS: a door's trigger on a ship with a cabin offers
// Enter cabin - the large bank ship's room, systems/sailingCabin.js); each gunport's shutter swings up on its top, the
// guns' (systems/naval/galleonGunDeck.js) as a broadside is laid.
//
// THE FRAME is Unity's, the boat's: +x starboard, +y up, +z the bow, the root on the waterline - every measurement below
// is read off the bake (tools/bakeCarrack.mjs FRAME: Mac's metres x 0.8) and pinned against it (test/ships2_carrack.test.js).
// Not a DFU member. Ledger A (SHIPS-2).
import { CARRACK_ARCHIVE, TEX, CARRACK_TILE, BANDS } from './carrackArt.js';
import { MeshBench, colliderOf, prism, rope, box, planarUv, sub, add, scl, dot, cross, norm } from './galleonMesh.js';
import {
  bakedPartGeometry, benchPart, mastCap, rudderBlade, doorLeafGeometry, gunGeometry, chaserGeometry, wheelGeometry, mergeGeometries,
  GUN as GALLEON_GUN, MEASURED as GALLEON_MEASURED, DOOR_THICK, LID_OPEN_DEG, WHEEL_TURNS, RUDDER_DEG, RUDDER_CLEAR, MANROPE,
} from './galleonModel.js';
import { nodeOf, yaw, clone, findNode, constClip, eulerCurve, pointsOf, partOf, prefabBench, inArchive } from './shipKit.js';
import { buildCarrackRig, CARRACK_RIG } from './carrackRig.js';
import { CAPSULE_HEIGHT } from '../player/motor.js';   // Come Sail Away pins the capsule's CENTRE to DrivePosition (AUDIT GN-P1)

/** The prefab she stands in for: Come Sail Away's hull 4 (FIRST_HULL_MODEL_ID + 4). */
export const CARRACK_PREFAB_ID = 112414;
/** The node the boat's frame is (Boat.MeshObject): her hull, carrying the first MeshCollider of the tree. */
export const CARRACK_HULL_NODE = 'NewCarrack';
/** The mod's galleon, whose small things (the cargo, the lanterns' poles and hooks, the colours) stand in her too. */
const GALLEON_ID = 112412;

/** Her measurements in the boat's frame (metres): each read off the bake - the scene's number x 0.8, the waterline and
 *  the midship taken off (tools/bakeCarrack.mjs FRAME) - and pinned there (test/ships2_carrack.test.js). */
export const MEASURED = Object.freeze({
  gunDeckY: 1.9576, mainDeckY: 7.8082, mainDeckUnderY: 7.5086, railY: 8.6343, bowRailY: 9.7475,
  // her side: widest at the knuckle her ports straddle, the throats' inner planking
  hullOuterX: 6.6951, knuckleY: 3.5587, throatX: 5.8417,
  // her five gunports a side, aft to fore - each 1.921 m along her, sill to head
  portZ: Object.freeze([-9.2435, -5.6075, -1.3762, 2.6505, 6.8825]), portHalfW: 0.9604, portSillY: 3.0661, portTopY: 4.0607,
  // her two hatchways (her main deck's openings - the middle and the fore houses stand over them)
  hatchAft: Object.freeze({ z0: -7.9235, z1: -4.7313, halfX: 1.2232 }), hatchFore: Object.freeze({ z0: 2.6933, z1: 5.8856, halfX: 1.2232 }),
  // her entry port in her waist's bulwark (the galleon's, at the same scene station): its sill, its jambs' faces
  gangway: Object.freeze({ z0: -1.761, z1: 0.7075, sillY: 7.9378, innerX: 5.8085, outerX: 6.0858 }),
  // her houses: the aft one (open fore and aft) where the galleon's castle stood, the middle one (its door forward) and
  // the fore one (open to port and starboard) over her hatchways - their walls' inner faces, their ends, their ceilings
  houseAft: Object.freeze({ x0: -2.9712, x1: 3.0726, z0: -20.6804, z1: -15.8128, ceilingY: 10.6965 }),
  houseMid: Object.freeze({ halfX: 1.508, z0: -8.9014, z1: -4.0346, ceilingY: 10.6965 }),
  houseFore: Object.freeze({ x0: -2.6345, x1: 2.2973, z0: 2.1869, z1: 6.4552, ceilingY: 10.6965 }),
  // Mac's door in the middle house's fore end: the doorway it closes (the house's walls inside, her deck to the ceiling)
  // and where it hangs along her (its middle)
  houseDoor: Object.freeze({ halfX: 1.508, y0: 7.8082, y1: 10.6965, z: -4.1925 }),
  // her rudder hangs on her STERNPOST - the hull's two vertices on her centreline at its foot (-3.1146) and its head
  // (3.5587), z -22.6356 both (the galleon's AUDIT GN-P8 law)
  rudderPivotZ: -22.6356,
  // her quarter rail's cap and its reach along her
  sternRail: Object.freeze({ capY: 9.5573, z0: -23.312, z1: -12.448 }),
  // her six deck beams over the gun deck, aft to fore - each 0.885 m fore and aft, their feet `underY`
  beams: Object.freeze({ z: Object.freeze([-15.7895, -8.9955, -3.256, 1.4275, 7.0255, 10.8685]), halfZ: 0.4425, underY: 6.6871, halfX: 5.805 }),
});

/** The helm: the wheel's hub on her main deck before the aft house's open fore end, and where the helmsman stands -
 *  DrivePosition, half a capsule over her deck (AUDIT GN-P1: Come Sail Away pins the capsule's centre to it). Her
 *  middle house stands on her centreline ahead of it: a first-person helmsman sees her bow past either side of it, as a
 *  carrack's waist did from her helm; Eye of the Beholder's boat camera frames the whole ship. */
export const HELM = Object.freeze({ hub: Object.freeze([0, MEASURED.mainDeckY + 0.72, -13.75]), stand: Object.freeze([0, MEASURED.mainDeckY + CAPSULE_HEIGHT / 2, -15.1]), wheelR: 0.4 });
/** Her DriveTrigger's node (a metre's cube on it): over her wheel AND its binnacle, the galleon's AUDIT GN2-PF7 law. */
export const DRIVE_TRIGGER_AT = Object.freeze([HELM.hub[0], HELM.hub[1], HELM.hub[2] + 0.25]);

/** Her board triggers' middles abeam (their boxes 3 m a side, the mod's): each cube's inner face 4 cm outside her
 *  entry port's outer jamb and her side under it (AUDIT GN-P4's law - never into her planking). */
const BOARD_X = MEASURED.hullOuterX + 1.5 + 0.04;
/** Where her rope ladders hang and her board lands, along her: the entry port's fore part - its ropes and rungs 7 cm
 *  inside its fore jamb (0.7075), and 7 cm forward of gunport 2's shutter (swung up, it reaches z 0.028). */
export const LADDER_Z = 0.35;

/** Her shutter's stations (Mac's Cube.037: 2.809 m along her, 1.780 m from its hinge to its foot) - its ROWS (its hinge
 *  7 cm over the port's head, her side's knuckle, the port's sill, seven under it and its foot) by its COLUMNS (along her
 *  about the port's middle, every 0.18 m) - its board `thick`, its inner face `gap` off her planking, its hinge's eyes
 *  `eyeR` round its pin at `eyesZ`. Finer than the galleon's four rows by five: under her ports her side turns in at a
 *  chine that climbs as she narrows forward (2.75 m up at port 4's after edge, 3.2 at its fore edge), and the board is
 *  bent over it at every station (test/ships2_carrack.test.js measures its inner face against her side). */
const SILL_TO_FOOT = (MEASURED.portSillY - (MEASURED.portTopY + 0.07 - 1.78)) / 8;
export const LID = Object.freeze({
  rows: Object.freeze([MEASURED.portTopY + 0.07, MEASURED.knuckleY, ...[2, 1].map((k) => MEASURED.portSillY + k * (MEASURED.knuckleY - MEASURED.portSillY) / 3), MEASURED.portSillY, ...[1, 2, 3, 4, 5, 6, 7].map((k) => MEASURED.portSillY - k * SILL_TO_FOOT), MEASURED.portTopY + 0.07 - 1.78]),
  cols: Object.freeze([-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => k * 0.1755625)),
  thick: 0.11, gap: 0.003, eyeR: 0.045, eyesZ: Object.freeze([-0.95, 0.95]),
});
/** The row of LID's stations at the port's sill (its fit read on the planking just under it; its board solid down to it). */
export const LID_SILL_ROW = LID.rows.indexOf(MEASURED.portSillY);

/** Her guns: the galleon's gun (world/galleonModel.js gunGeometry - its axis 1.16 m over its foot) on a platform at
 *  each port (her ports' sills stand 1.11 m over her gun deck, the galleon's 0.48), its top `platformY` a step over her
 *  gun deck - PLATFORM_RISE, under the deck lens's DECK_STEP, so her gun deck beside a platform stays her floor and a
 *  body on a platform's end stands aboard (systems/naval/navalDeck.js: a wall rising more than a step walls a floor;
 *  at 0.445 m, the port's middle, the floor round each platform's ends fell out and its ends read ashore) - and the
 *  gun's axis 6.5 cm under the port's middle, 0.43 m over its sill; run out its muzzle 9 cm outside her planking at the
 *  knuckle, run in 1.1 m inboard to load.
 *  Her chasers on their swivels at `chaserZ` on her bow's deck, a metre inboard of its flared bulwark's inner skin (the
 *  deck narrows to 1.8 m across at z 21), their barrels `chaserY` - over her bow's cap (8.87 to 9.47 there) and, laid
 *  6 degrees down, 0.3 m over it forward. */
const AXIS_OVER_FOOT = GALLEON_GUN.axisY - GALLEON_MEASURED.gunDeckY;
const PLATFORM_RISE = 0.38;
export const GUN = Object.freeze({
  axisY: MEASURED.gunDeckY + PLATFORM_RISE + AXIS_OVER_FOOT,
  platformY: MEASURED.gunDeckY + PLATFORM_RISE,
  runOutX: MEASURED.hullOuterX + 0.09 - GALLEON_GUN.muzzleX, runInX: MEASURED.hullOuterX + 0.09 - GALLEON_GUN.muzzleX - 1.1,
  muzzleX: GALLEON_GUN.muzzleX, chaserY: 9.95, chaserZ: 19.5,
});
/** A gun's platform: its half sizes (athwartships to her inner planking, fore and aft). */
export const PLATFORM = Object.freeze({ x0: 2.95, halfZ: 0.85 });
/** Her five sides' guns as HULL_BUILDS reads them (systems/naval/navalShips.js): the starboard muzzles (the port side
 *  their mirror), the bow chasers, the barrels' drop astern. */
export const CARRACK_BATTERIES = Object.freeze({
  broadside: Object.freeze(MEASURED.portZ.map((z) => Object.freeze([MEASURED.hullOuterX + 0.09, GUN.axisY, z]))),
  bow: Object.freeze([Object.freeze([-1.15, GUN.chaserY, GUN.chaserZ + 0.95]), Object.freeze([1.15, GUN.chaserY, GUN.chaserZ + 0.95])]),
  stern: Object.freeze([Object.freeze([0, 8.9, -23.6])]),
});

// ── her faces, textured ─────────────────────────────────────────────────────────────────────────────────────────────

/** Which picture a face of a baked part of hers wears, and how it lies on it: `{ rec, uv(p) }`, or a face of a livery
 *  `{ band, u(p) }` - the livery's slices by height (world/carrackArt.js BANDS) that world/galleonModel.js
 *  bakedPartGeometry cuts the face into (the galleon's R14 law). */
function faceSkin(role, n, c) {
  const tiled = (rec, key = keyOf(rec)) => ({ rec, uv: (p) => planarUv(p, n, CARRACK_TILE[key]) });
  const banded = (name) => ({ band: BANDS[name], u: (p) => planarUv(p, n, [CARRACK_TILE[name][0], 1])[0] });
  const up = n[1] > 0.7, down = n[1] < -0.7;
  switch (role) {
    case 'hull': {
      // a gunport's throat - its sill, head and cheeks - in her strake's blue planks (world/carrackArt.js's dark)
      if (c[1] > 2.9 && c[1] < 4.2 && Math.abs(c[0]) > 5.7 && Math.abs(c[0]) < 6.8 && Math.abs(n[0]) < 0.3) return tiled(TEX.dark);
      if (up) return tiled(c[1] > 7.9 ? TEX.trim : TEX.hullInner);
      const core = [0, c[1], Math.max(-17, Math.min(18, c[2]))];
      if (dot(n, sub(core, c)) > 0) return tiled(TEX.hullInner);   // a face looking in toward her keel line: her ceiling
      if (n[1] < -0.55) return tiled(TEX.hullBottom);
      if (n[2] < -0.6 && c[1] > BANDS.transom.y0) return banded('transom');
      return banded('hullSide');
    }
    case 'rudder': return tiled(TEX.hullBottom);
    case 'deckBeam': return { rec: TEX.trim, uv: (p) => [p[0] / CARRACK_TILE.trim[0], (Math.abs(n[1]) > 0.7 ? p[2] : p[1]) / CARRACK_TILE.trim[1]] };
    case 'gunDeck': return tiled(TEX.deck);
    case 'mainDeck': return tiled(up ? TEX.deck : down ? TEX.underDeck : TEX.trim);
    case 'houseAft': case 'houseMid': case 'houseFore': {
      // a house: its roof's two slopes, its ceiling under them, its walls' outer faces in her houses' livery and their
      // inner faces in her ceiling planks, its two end frames (the walls' thickness round each open end) in her trim
      const mid = HOUSE_MID[role];
      if (n[1] > 0.9 && c[1] > 10.8) return tiled(TEX.roof);
      if (down) return tiled(TEX.underDeck);
      const along = role === 'houseFore' ? 0 : 2;   // the axis its ridge runs along: the fore house's lies athwartships
      if (Math.abs(n[along]) > 0.9) return tiled(TEX.trim);
      return dot(n, sub(c, mid)) > 0 ? banded('house') : tiled(TEX.hullInner);
    }
    case 'sternRail': {
      const out = dot(n, sub(c, [0, c[1], -14.5])) > 0;
      if (up || down) return tiled(TEX.trim);
      return out ? banded('quarterRail') : tiled(TEX.trim);
    }
    case 'foreMast': case 'mainMast': case 'mizzenMast': case 'bowsprit': return tiled(TEX.spar);
    default: return tiled(TEX.trim);
  }
}
const keyOf = (rec) => Object.keys(TEX).find((k) => TEX[k] === rec);
/** Each house's middle (the point its outer faces look away from). */
const HOUSE_MID = Object.freeze({
  houseAft: Object.freeze([0.0507, 9.2, -18.2466]), houseMid: Object.freeze([0, 9.2, -6.468]), houseFore: Object.freeze([-0.1686, 9.2, 4.3211]),
});
/** A baked part of hers drawn: her skin, her archive. */
const drawn = (part, opts = {}) => bakedPartGeometry(part, { ...opts, skin: faceSkin, archive: CARRACK_ARCHIVE });

// ── her side, measured ──────────────────────────────────────────────────────────────────────────────────────────────

/** Her outer planking's half-breadth on side `s` at height `y` and station `z` - the outermost of her hull's triangles a
 *  line athwartships there meets - or null where none does (a port's opening). */
export function sideAt(hull, y, z, s = 1) {
  const P = pointsOf(hull);
  let best = null;
  for (let t = 0; t < hull.triangles.length; t += 3) {
    const a = P[hull.triangles[t]], b = P[hull.triangles[t + 1]], c = P[hull.triangles[t + 2]];
    const d = (b[1] - a[1]) * (c[2] - a[2]) - (c[1] - a[1]) * (b[2] - a[2]);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((y - a[1]) * (c[2] - a[2]) - (c[1] - a[1]) * (z - a[2])) / d;
    const v = ((b[1] - a[1]) * (z - a[2]) - (y - a[1]) * (b[2] - a[2])) / d;
    if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
    const x = a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0]);
    if (x * s <= 0) continue;
    if (best == null || x * s > best) best = x * s;
  }
  return best;
}

/**
 * EACH PORT'S SHUTTER FIT (the galleon's AUDIT GN-P6 law, measured here off her bake where the galleon's was a table): her
 * half-breadth on side `s` at each of LID's stations, rows by columns - each side's shutter fitted to its own side (Mac's
 * hull is not her mirror to the centimetre: 2.7 cm between them at port 1's after edge, where one fit for both, the
 * galleon's way, stood the port shutter that far off her) - read at each row's height (the sill's own row 1 mm under it,
 * on the planking there); over the port's opening, where no planking stands, the line between the row's outer stations.
 * `[port][row][col]`.
 */
export function lidFitOf(hull, s = 1) {
  return MEASURED.portZ.map((zc) => LID.rows.map((y, r) => {
    const yy = r === LID_SILL_ROW ? y - 0.001 : y;
    const at = LID.cols.map((dz) => sideAt(hull, yy, zc + dz, s));
    // over the opening: the line between the outer stations
    const K = at.length, a = at[0], b = at[K - 1];
    return at.map((x, k) => (x != null ? x : a + (b - a) * (k / (K - 1))));
  }));
}

// ── the parts built here ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Her shutter in its hinge's frame, on side `s` (1 starboard, -1 port), fitted to her side at one port (`fit`, its row
 * of lidFitOf): Mac's shutter hanging closed down her side, its blue face out - its inner face LID.gap off her planking
 * at every station, bent at the knuckle and over the sill, its hinge (the node, `xh` out) on her side over the port's
 * head. Each side its own mesh, the port side's the starboard's mirrored (the galleon's AUDIT GN-G1). Returns
 * { geometry, xh, collider }: `collider` its board's two plates from the hinge to the sill over the port (AUDIT
 * GN-P10's - solid, and no face of it level: her deck's bake reads every collider).
 */
function lidGeometry(s, fit) {
  const bench = new MeshBench(CARRACK_ARCHIVE);
  const R = LID.rows.length, K = LID.cols.length, t = LID.thick;
  const xh = Math.max(...fit[0]);
  const inner = LID.rows.map((y, r) => LID.cols.map((dz, k) => [s * (fit[r][k] + LID.gap - xh), y - LID.rows[0], dz]));
  const quadN = (r, k) => { const n = norm(cross(sub(inner[r + 1][k + 1], inner[r][k]), sub(inner[r][k + 1], inner[r + 1][k]))); return n[0] * s < 0 ? scl(n, -1) : n; };
  const outer = inner.map((row, r) => row.map((p, k) => {
    let n = [0, 0, 0];
    for (const [rr, kk] of [[r - 1, k - 1], [r - 1, k], [r, k - 1], [r, k]]) if (rr >= 0 && kk >= 0 && rr < R - 1 && kk < K - 1) n = add(n, quadN(rr, kk));
    return add(p, scl(norm(n), t));
  }));
  const uv = (r, k) => [s > 0 ? k / (K - 1) : 1 - k / (K - 1), (LID.rows[r] - LID.rows[R - 1]) / (LID.rows[0] - LID.rows[R - 1])];
  for (let r = 0; r < R - 1; r++) for (let k = 0; k < K - 1; k++) {
    const n = quadN(r, k), at = [[r, k], [r, k + 1], [r + 1, k + 1], [r + 1, k]];
    bench.quad(TEX.lid, ...at.map(([a, b]) => outer[a][b]), at.map(([a, b]) => uv(a, b)), n);
    bench.quad(TEX.lid, ...at.map(([a, b]) => inner[a][b]), at.map(([a, b]) => uv(a, b)), scl(n, -1));
  }
  const edge = (a, b, c, d, out) => bench.quad(TEX.lid, a, b, c, d, [[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1]], out);
  for (let k = 0; k < K - 1; k++) {
    edge(inner[0][k], inner[0][k + 1], outer[0][k + 1], outer[0][k], sub(inner[0][k], inner[1][k]));
    edge(inner[R - 1][k], inner[R - 1][k + 1], outer[R - 1][k + 1], outer[R - 1][k], sub(inner[R - 1][k], inner[R - 2][k]));
  }
  for (let r = 0; r < R - 1; r++) {
    edge(inner[r][0], inner[r + 1][0], outer[r + 1][0], outer[r][0], sub(inner[r][0], inner[r][1]));
    edge(inner[r][K - 1], inner[r + 1][K - 1], outer[r + 1][K - 1], outer[r][K - 1], sub(inner[r][K - 1], inner[r][K - 2]));
  }
  for (const z of LID.eyesZ) prism(bench, TEX.iron, [0, 0, z - 0.08], [0, 0, z + 0.08], LID.eyeR, LID.eyeR, 6);
  const solid = new MeshBench(CARRACK_ARCHIVE);
  for (let r = 0; r < LID_SILL_ROW; r++) for (let k = 0; k < K - 1; k++) {
    const n = quadN(r, k), at = [[r, k], [r, k + 1], [r + 1, k + 1], [r + 1, k]];
    solid.quad(TEX.lid, ...at.map(([a, b]) => outer[a][b]), at.map(() => [0, 0]), n);
    solid.quad(TEX.lid, ...at.map(([a, b]) => inner[a][b]), at.map(() => [0, 0]), scl(n, -1));
  }
  return { geometry: bench.finish(), xh, collider: solid.finish() };
}

/** A gun's platform, in her frame on side `s` at station `z`: a planked step from her inner planking in, its top
 *  GUN.platformY, cleated at its edge. */
export function platformGeometry(s, z) {
  const bench = new MeshBench(CARRACK_ARCHIVE);
  const x0 = PLATFORM.x0, x1 = MEASURED.throatX - 0.01, y0 = MEASURED.gunDeckY, y1 = GUN.platformY;
  box(bench, TEX.deck, [s * (x0 + x1) / 2, (y0 + y1) / 2, z], [(x1 - x0) / 2, (y1 - y0) / 2, PLATFORM.halfZ], { tile: CARRACK_TILE.deck, skip: [0, 1, 4, 5] });
  box(bench, TEX.trim, [s * (x0 + x1) / 2, (y0 + y1) / 2, z], [(x1 - x0) / 2, (y1 - y0) / 2, PLATFORM.halfZ], { tile: CARRACK_TILE.trim, skip: [2, 3] });
  return bench.finish();
}

/** A companion down a hatchway: from her main deck's edge of the hole down to her gun deck at `pitch`, `dir` the way it
 *  descends along z - treads, a stringer each side and a manrope over each from its foot up the stair's line to 0.95 m
 *  over her deck at the hatchway's edge, made fast there to the coaming (a house stands over each of her hatchways, so
 *  no cover shuts on it - the galleon's AUDIT GN-P2). */
function companionGeometry(topZ, dir, halfX = 0.8, pitch = 48) {
  const bench = new MeshBench(CARRACK_ARCHIVE);
  const top = MEASURED.mainDeckY, bottom = MEASURED.gunDeckY;
  const rise = 0.3, steps = Math.round((top - bottom) / rise);
  const r = (top - bottom) / steps, run = r / Math.tan((pitch * Math.PI) / 180);
  for (let i = 1; i <= steps; i++) {
    const y = top - i * r, z0 = topZ + dir * (i - 1) * run, z1 = topZ + dir * i * run;
    box(bench, TEX.deck, [0, y - 0.04, (z0 + z1) / 2], [halfX, 0.04, Math.abs(z1 - z0) / 2 + 0.02], { tile: CARRACK_TILE.deck });
  }
  const zEnd = topZ + dir * steps * run;
  for (const s of [-1, 1]) {
    const a = [s * (halfX + 0.05), top - 0.1, topZ], b = [s * (halfX + 0.05), bottom + 0.1, zEnd];
    prism(bench, TEX.trim, a, b, 0.09, 0.09, 4, { tileV: 2, twist: Math.PI / 4 });
    const foot = add(b, [0, 0.95, 0]), head = [a[0], top + 0.95, topZ];
    rope(bench, TEX.rope, [foot, head, [s * MEASURED.hatchAft.halfX, top + 0.02, topZ]], MANROPE.r);
  }
  return { geometry: bench.finish(), bottomZ: zEnd, steps, rise: r, run };
}

/** A rope ladder down her side from her entry port to the water, on side `s`: two side ropes down her planking to her
 *  knuckle (where her side stands out furthest), plumb from it, and the rungs between. */
export function ropeLadderGeometry(s = 1) {
  const bench = new MeshBench(CARRACK_ARCHIVE);
  const g = MEASURED.gangway, k = MEASURED.knuckleY, xk = MEASURED.hullOuterX + 0.03;
  // over the entry port's sill, down her side to her knuckle, and from it plumb to the water (her side tucks in under it:
  // a ladder hangs free there, as the galleon's does)
  const path = (dz) => [[s * (g.innerX + 0.1), g.sillY + 0.15, LADDER_Z + dz], [s * (g.outerX + 0.03), g.sillY - 0.05, LADDER_Z + dz], [s * xk, k, LADDER_Z + dz], [s * xk, 0.05, LADDER_Z + dz]];
  for (const dz of [-0.24, 0.24]) rope(bench, TEX.rope, path(dz), 0.03);
  const xAt = (y) => (y > k ? g.outerX + 0.03 + ((g.sillY - 0.05 - y) / (g.sillY - 0.05 - k)) * (xk - g.outerX - 0.03) : xk);
  for (let y = 0.35; y < g.sillY - 0.3; y += 0.34) box(bench, TEX.trim, [s * (xAt(y) + 0.04), y, LADDER_Z], [0.03, 0.025, 0.25], { tile: CARRACK_TILE.trim });
  return bench.finish();
}

/** A geometry mirrored across her centreline (x negated - its normals with it, its triangles wound back), its uvs as
 *  they were: a door leaf hung on the other jamb, its picture's planks and strap the other way about. */
export function mirroredX(g) {
  const positions = Float32Array.from(g.positions), normals = Float32Array.from(g.normals), indices = Uint32Array.from(g.indices);
  for (let i = 0; i < positions.length; i += 3) { positions[i] = -positions[i]; normals[i] = -normals[i]; }
  for (let i = 0; i < indices.length; i += 3) { const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t; }
  return { ...g, positions, normals, indices, aabb: { center: [-g.aabb.center[0], g.aabb.center[1], g.aabb.center[2]], extent: [...g.aabb.extent] } };
}

/** The binnacle before her wheel: a box, its gilt cap and its lamp's hood, under the helmsman's sight lines over the
 *  wheel (the galleon's AUDIT GN-P1 heights over her deck). */
function helmPedestalGeometry() {
  const bench = new MeshBench(CARRACK_ARCHIVE);
  const [hx, hy, hz] = HELM.hub, y0 = MEASURED.mainDeckY;
  box(bench, TEX.trim, [hx, y0 + 0.48, hz + 0.42], [0.26, 0.48, 0.22], { tile: CARRACK_TILE.trim });
  box(bench, TEX.gilt, [hx, y0 + 0.99, hz + 0.42], [0.28, 0.03, 0.24], { tile: CARRACK_TILE.gilt });
  prism(bench, TEX.iron, [hx, hy, hz + 0.2], [hx, hy, hz + 0.05], 0.05, 0.05, 6, { smooth: true });
  prism(bench, TEX.gilt, [hx, y0 + 1.02, hz + 0.42], [hx, y0 + 1.3, hz + 0.42], 0.16, 0.06, 8, { smooth: true });
  return bench.finish();
}

// ── the clips ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The clips and overrides her shutters and her helm play, over the mod's own controllers: each shutter up on its top
 *  (the port side's the other way about her length - the galleon's AUDIT GN-G1), the wheel turned WHEEL_TURNS hard over
 *  each way and her rudder RUDDER_DEG on its post through the Rudder Wheel Controller's ten Sailing clips. */
export function carrackClips() {
  const clips = {}, overrides = {};
  const pair = (ov, closed, opened) => {
    clips[`${ov} Closed`] = constClip(`${ov} Closed`, [eulerCurve('', closed)]);
    clips[`${ov} Opened`] = constClip(`${ov} Opened`, [eulerCurve('', opened)]);
    overrides[ov] = { base: 'Door Controller', clips: [['Door Closed', `${ov} Closed`], ['Door Opened', `${ov} Opened`]] };
  };
  pair('carrack2/Gunport', [0, 0, 0], [0, 0, LID_OPEN_DEG]);
  pair('carrack2/GunportPort', [0, 0, 0], [0, 0, -LID_OPEN_DEG]);
  // the house's starboard leaf: the mod's Door Controller's Opened turns a leaf +90 (its +x aft) - this one's -x is aft
  pair('carrack2/DoorStarboard', [0, 0, 0], [0, -90, 0]);
  const swaps = [];
  for (const [side, sign] of /** @type {const} */ ([['Left', -1], ['Right', 1]])) {
    for (let i = 0; i < 5; i++) {
      const t = sign * (0.2 + 0.2 * i);
      const name = `carrack2/Rudder Sailing ${side} ${i}`;
      clips[name] = constClip(name, [eulerCurve('HelmWheel', [0, 0, -t * WHEEL_TURNS * 360]), eulerCurve('HelmRudder', [0, -t * RUDDER_DEG, 0])]);
      swaps.push([`Rudder Wheel Sailing ${side} ${i}`, name]);
    }
  }
  overrides['carrack2/Rudder'] = { base: 'Rudder Wheel Controller', clips: swaps };
  return { clips, overrides };
}

// ── the prefab ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The new carrack as Come Sail Away's data: her prefab tree (component indices into the shared table - `base` the place
 * hers start: the mod's table's length, and the galleon's components' after it when the new galleon stands, as
 * systems/comeSailAwayModels.js lays them), the components she adds, her meshes by key, and the clips and overrides she
 * adds.
 * @param {any} bake - carrack.json
 * @param {{ prefabs: Record<string, any>, components: any[] }} csa - Come Sail Away's prefabs.json (the mod's carrack's
 *   and galleon's small things are copied out of their own trees)
 * @param {number} [base]
 */
export function carrackPrefab(bake, csa, base = csa.components.length) {
  const { comp, mesh, renderer, meshNode, boxCollider, animator, skinned, finish, meshes } = prefabBench(base, 'carrack');
  const cx = { archive: CARRACK_ARCHIVE, mesh, comp, skinned };
  const part = (role) => partOf(bake, role, 'carrack');
  const own = (geometry) => inArchive(geometry, CARRACK_ARCHIVE);   // a galleon-built part, worn in her archive
  /** A baked part drawn and solid - with `extra` faces built onto its drawing (never its collider: Mac's mesh). */
  const baked = (role, name, extra = null) => {
    const plain = drawn(part(role));
    if (!extra) return meshNode(name, `carrack:${role}`, plain, { collider: true });
    const bench = new MeshBench(CARRACK_ARCHIVE);
    benchPart(bench, part(role), { offset: [0, 0, 0], role, keep: null, skin: faceSkin });
    extra(bench, part(role));
    return meshNode(name, `carrack:${role}`, bench.finish(), { collider: true, colliderGeometry: plain });
  };
  const fromPrefab = (id, ship) => (name, at = {}) => {
    const n = clone(findNode(csa.prefabs[String(id)], name));
    if (!n) throw new Error(`carrack: Come Sail Away's ${ship} has no ${name}`);
    if (at.p) n.position = [...at.p];
    if (at.r) n.rotation = [...at.r];
    if (at.name) n.name = at.name;
    if (at.active !== undefined) n.active = at.active;
    return n;
  };
  const fromCarrack = fromPrefab(CARRACK_PREFAB_ID, 'carrack'), fromGalleon = fromPrefab(GALLEON_ID, 'galleon');
  const M = MEASURED;
  const kids = [];
  const hull = part('hull');

  // ── her own: the board, the triggers before the doors (the walk files a door's trigger under BoardTriggers - kept -
  //    and BoardTriggers[0] is a gangway's) ──
  for (const s of [1, -1]) {
    const t = [s * BOARD_X, 2.4, LADDER_Z];
    const stand = [s * (M.gangway.innerX - 1.0), M.mainDeckY + 0.05, LADDER_Z];
    kids.push(nodeOf('BoardTrigger', { p: t, s: [3, 3, 3], kids: [nodeOf('BoardPosition', { p: scl(sub(stand, t), 1 / 3), r: yaw(s > 0 ? -90 : 90), s: [1 / 3, 1 / 3, 1 / 3] })] }));
  }
  kids.push(nodeOf('DriveTrigger', { p: DRIVE_TRIGGER_AT }));
  kids.push(nodeOf('DrivePosition', { p: HELM.stand }));

  // ── Mac's model ──
  // her houses and her quarter rail draw on their own nodes and stand in the HULL's collider (below), as the galleon's
  // castle does: her hull's box is the shots' target, and a ball into a house strikes her as one into her side does
  for (const [role, name] of [['houseAft', 'HouseAft'], ['houseMid', 'HouseMid'], ['houseFore', 'HouseFore'], ['sternRail', 'QuarterRail']]) kids.push(meshNode(name, `carrack:${role}`, drawn(part(role))));
  const extras = { foreMast: (b, p) => mastCap(b, p, faceSkin), mainMast: (b, p) => mastCap(b, p, faceSkin), mizzenMast: (b, p) => mastCap(b, p, faceSkin) };
  for (const [role, name] of [['gunDeck', 'GunDeck'], ['mainDeck', 'MainDeck'],
    ['foreMast', 'ForeMast'], ['forePartner', 'ForePartner'], ['foreStep', 'ForeStep'],
    ['mainMast', 'MainMast'], ['mainPartner', 'MainPartner'], ['mainStep', 'MainStep'],
    ['mizzenMast', 'MizzenMast'], ['mizzenPartner', 'MizzenPartner'], ['mizzenStep', 'MizzenStep'],
    ['aftStep', 'AftStep'], ['bowsprit', 'Bowsprit']]) kids.push(baked(role, name, extras[role] ?? null));
  const beamParts = bake.parts.filter((x) => x.role === 'deckBeam');
  if (beamParts.length !== 6) throw new Error(`carrack: the bake has ${beamParts.length} deck beams where Mac drew six`);
  kids.push(meshNode('DeckBeams', 'carrack:deckBeams', drawn(beamParts), { collider: true }));

  // the stairs down her two hatchways, each descending aft from the hatchway's fore edge
  kids.push(meshNode('CompanionAft', 'carrack:companionAft', companionGeometry(M.hatchAft.z1, -1).geometry, { collider: true }));
  kids.push(meshNode('CompanionFore', 'carrack:companionFore', companionGeometry(M.hatchFore.z1, -1).geometry, { collider: true }));

  // the middle house's doors: Mac's door (Cube.008) where he hung it, across the house's whole fore end (3.0 m) - hung as
  // two leaves, each on its jamb, each hinged on its after face (the galleon's AUDIT GN2-PF8), its foot a centimetre over
  // her deck, a hand's gap between them; each swings in, aft, and each is a door of its own, as the mod's carrack's own
  // pair is (CarrackDoor.003 and .004) - the starboard leaf the port one mirrored, on its own clips (it turns the other way)
  const d = M.houseDoor;
  const foot = d.y0 + 0.01, leafW = d.halfX - 0.03, leafH = d.y1 - 0.01 - foot;
  for (const [s, side] of /** @type {const} */ ([[-1, 'Port'], [1, 'Starboard']])) {
    const leaf = own(s < 0 ? doorLeafGeometry(leafW, leafH) : mirroredX(doorLeafGeometry(leafW, leafH)));
    kids.push(meshNode(`HouseDoor${side}`, `carrack:door${side}`, leaf, { collider: true, p: [s * (d.halfX - 0.02), foot, d.z - DOOR_THICK / 2], c: [animator(s < 0 ? 'Door Controller' : 'carrack2/DoorStarboard')], kids: [nodeOf('DoorTrigger')] }));
  }

  // the shutters and the guns behind them: five ports a side, each shutter fitted to its own side at its port (the port
  // side's built mirrored, lidGeometry), each solid; each gun on its platform
  const fits = { [1]: lidFitOf(hull, 1), [-1]: lidFitOf(hull, -1) };
  const lidXh = { [1]: [], [-1]: [] };
  M.portZ.forEach((z, i) => {
    for (const [s, suffix] of [[1, ''], [-1, 'Port']]) {
      const lid = lidGeometry(s, fits[s][i]);
      mesh(`carrack:gunportLid${suffix}${i}`, lid.geometry);
      mesh(`carrack:gunportLid${suffix}${i}:collider`, colliderOf(lid.collider));
      lidXh[s][i] = lid.xh;
    }
  });
  mesh('carrack:gun', own(gunGeometry()));
  const lidComps = (key) => [comp({ type: 'MeshFilter', m_Mesh: { mesh: key } }), renderer(meshes[key]), comp({ type: 'MeshCollider', m_Enabled: true, m_IsTrigger: false, m_Convex: false, m_Mesh: { mesh: `${key}:collider` } })];
  for (const [sideName, s] of /** @type {const} */ ([['Starboard', 1], ['Port', -1]])) {
    M.portZ.forEach((z, i) => {
      kids.push(nodeOf(`Gunport${sideName}${i}`, { p: [s * lidXh[s][i], LID.rows[0], z], c: [...lidComps(s > 0 ? `carrack:gunportLid${i}` : `carrack:gunportLidPort${i}`), animator(s > 0 ? 'carrack2/Gunport' : 'carrack2/GunportPort')] }));
      kids.push(meshNode(`GunPlatform${sideName}${i}`, `carrack:gunPlatform${sideName}${i}`, platformGeometry(s, z), { collider: true }));
      kids.push(nodeOf(`Gun${sideName}${i}`, { p: [s * GUN.runInX, GUN.platformY, z], r: yaw(s > 0 ? 0 : 180), c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'carrack:gun' } }), renderer(meshes['carrack:gun']), boxCollider([-0.05, 0.55, 0], [1.25, 1.1, 0.8]), comp({ type: 'GunCarriage', runInX: GUN.runInX, runOutX: GUN.runOutX })] }));
    });
  }
  // the bow chasers on their swivels over her bow's rail
  mesh('carrack:chaser', own(chaserGeometry(GUN.chaserY - M.mainDeckY)));
  for (const [i, m] of CARRACK_BATTERIES.bow.entries()) kids.push(nodeOf(`BowChaser${i}`, { p: [m[0], M.mainDeckY, m[2] - 0.95], c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'carrack:chaser' } }), renderer(meshes['carrack:chaser'])] }));

  // the helm: its binnacle (still), and the RudderObject the mod's Rudder Wheel Controller turns - the wheel on its axle
  // and the rudder on her sternpost, cut RUDDER_CLEAR abaft it and closed at its front (the galleon's AUDIT GN-P8)
  kids.push(meshNode('HelmPedestal', 'carrack:helmPedestal', helmPedestalGeometry(), { c: [boxCollider([0, M.mainDeckY + 0.6, HELM.hub[2] + 0.42], [0.6, 1.2, 0.5])] }));
  mesh('carrack:wheel', own(wheelGeometry(HELM.wheelR)));
  const rudderPivot = [0, 0, M.rudderPivotZ];
  mesh('carrack:rudder', drawn(rudderBlade(part('rudder'), M.rudderPivotZ - RUDDER_CLEAR), { offset: rudderPivot }));
  kids.push(nodeOf('RudderObject', {
    c: [animator('carrack2/Rudder')],
    kids: [
      nodeOf('HelmWheel', { p: HELM.hub, c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'carrack:wheel' } }), renderer(meshes['carrack:wheel'])] }),
      nodeOf('HelmRudder', { p: rudderPivot, c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'carrack:rudder' } }), renderer(meshes['carrack:rudder'])] }),
    ],
  }));

  // the rig
  const rig = buildCarrackRig(cx);
  kids.push(...rig.kids);

  // ── Come Sail Away's own small things, stood in her ──
  const D = M.mainDeckY, G = M.gunDeckY;
  kids.push(nodeOf('ActiveObject', { kids: [fromCarrack('CarrackAnchor', { p: ANCHOR.weighed, r: yaw(ANCHOR.yawDeg) })] }));
  kids.push(nodeOf('IdleObject', { kids: [
    fromCarrack('CarrackAnchorDeployed', { p: ANCHOR.letGo, r: yaw(ANCHOR.yawDeg) }),
    meshNode('RopeLadderStarboard', 'carrack:ladderStarboard', ropeLadderGeometry(1)),
    meshNode('RopeLadderPort', 'carrack:ladderPort', ropeLadderGeometry(-1)),
  ] }));
  // her cargo on her gun deck forward, and its trigger over it
  kids.push(fromGalleon('GalleonCargo', { p: [-3.2, G, 12.6], r: yaw(-90), name: 'CarrackCargo' }));
  kids.push(nodeOf('CargoTrigger', { p: [-3.2, G + 0.85, 12.6] }));   // its metre's cube over the crate's top (0.58 m)
  // the mod's carrack's fire and bed stand as it left them, switched off (it carries neither)
  kids.push(fromCarrack('FireObject'), fromCarrack('BedObject'));
  // her lanterns: a pole at each quarter on her quarter rail's cap where it turns round her stern (QUARTER_POLES), the
  // galleon's taffrail stand on the cap at her stern, one hanging in the aft house, and three in her gun deck from her
  // beams (the second, third and fifth, aft to fore)
  const lanternFlat = () => nodeOf('BillboardHelper-210_027:2');
  const pole = fromGalleon('LanternHookStandPoleShort');
  for (const s of [-1, 1]) kids.push({ ...clone(pole), position: [s * QUARTER_POLES.x, M.sternRail.capY + 0.003, QUARTER_POLES.z], rotation: yaw(s * QUARTER_POLES.yawDeg) });
  kids.push(fromGalleon('LanternHookStandPlank', { p: [0, M.sternRail.capY, TAFFRAIL_Z], r: yaw(180), name: 'LanternHookStandTaffrail' }));
  kids.push(nodeOf('LanternHanging (3)', { p: [0.05, M.houseAft.ceilingY - 0.05, -18.2], kids: [lanternFlat()] }));
  for (const [i, k] of [1, 2, 4].entries()) kids.push(nodeOf(i ? `LanternHanging (${i})` : 'LanternHanging', { p: [0, M.beams.underY - 0.01, M.beams.z[k]], kids: [lanternFlat()] }));
  // her colours over her main masthead, on the flagstaff the rig stands there
  kids.push(fromGalleon('FlagObject', { p: [0, CARRACK_RIG.flagY, CARRACK_RIG.masts.main.z] }));

  // her hull: the node the boat's frame is, every other part under it - its collider her hull's planking, her houses' and
  // her quarter rail's, one mesh (the first MeshCollider of the tree)
  const hullGeometry = drawn(hull);
  mesh('carrack:hull:collider', colliderOf(mergeGeometries([hullGeometry, meshes['carrack:houseAft'], meshes['carrack:houseMid'], meshes['carrack:houseFore'], meshes['carrack:sternRail']])));
  const hullNode = meshNode(CARRACK_HULL_NODE, 'carrack:hull', hullGeometry, { kids, c: [comp({ type: 'MeshCollider', m_Enabled: true, m_IsTrigger: false, m_Convex: false, m_Mesh: { mesh: 'carrack:hull:collider' } })] });
  const root = nodeOf(String(CARRACK_PREFAB_ID), { kids: [fromCarrack('WakeObject'), hullNode, fromCarrack('Modifiers')] });

  const { components } = finish(root);
  const ownClips = carrackClips();
  return {
    prefab: root, components, meshes,
    animation: { clips: { ...ownClips.clips, ...rig.clips }, overrides: { ...ownClips.overrides, ...rig.overrides } },
  };
}

/** Her quarter poles (the mod's galleon's LanternHookStandPoleShort): on her quarter rail's cap (9.557, from x 4.5 to 5.5
 *  at z -21 where it turns round her stern), each turned so its hook hangs its lantern inboard and forward of it, over
 *  her deck between her rail and her aft house. */
export const QUARTER_POLES = Object.freeze({ x: 5.0, z: -21.0, yawDeg: 135 });
/** The taffrail stand's place on the cap at her stern, its plank across her centreline (the cap from z -23.31 to -22.69
 *  there; the stand's foot 0.41 m fore and aft). */
export const TAFFRAIL_Z = -23.05;

/** Come Sail Away's carrack's anchor on her starboard bow - weighed (ActiveObject's) and let go (IdleObject's) - turned
 *  `yawDeg` (Unity's: +z toward +x) so it lies flattest along her bow's flare (its stock and ring piece, 1.6 m across its
 *  node unturned, along her side: turned every 10 degrees round, -150 stands its node nearest her side, 0.61 m off it -
 *  unturned, 1.6 m), and stood out so EVERY vertex of both clears her outer planking by 2 cm or more (the galleon's AUDIT
 *  GN-P3 law) and no edge of either crosses a face of hers (test/ships2_carrack.test.js measures it on the mod's own
 *  mesh - its vertices clear at 4.094, the let-go anchor's shank under the water crossed her bow's swell between them,
 *  and stood 0.1 m further out it clears): its node over her main deck's height, its cable's head under her bow's rail. */
export const ANCHOR = Object.freeze({ yawDeg: -150, weighed: Object.freeze([4.334, 7.2, 18.2]), letGo: Object.freeze([4.244, 7.2, 18.2]) });
