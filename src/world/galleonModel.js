// @ts-check
// GALLEON (2026-10-01, Mac: "So this model is to replace the current ingame gallon model. The doors/hatches should
// open and close and we will need to give this a proper texture, along with a wheel at the helm, the sails and ropes,
// and ensuring cannon fire shoots from the cannon holes properly. I really need you to go all in and make this
// something special"): THE NEW GALLEON - Mac's ship, built as Come Sail Away builds a hull.
//
// Come Sail Away's hull 2 (the Small Ship, the mod's `Galleon`) is a prefab the C# instances and walks BY NAME
// (systems/comeSailAwayBoat.js GetBoatTransforms): its MeshCollider the boat's frame, its DrivePosition the helm, its
// triggers what the player activates, its Booms and Sails the rig the wind fills, its RudderObject the wheel and the
// rudder, its lanterns, crew and modifiers. So the new galleon is that prefab again - `galleonPrefab` makes the tree,
// every node the walk reads under the name it reads it by - over Mac's model (src/assets/galleon/galleon.json, baked
// by tools/bakeGalleon.mjs) and the parts built here, and systems/comeSailAwayModels.js (`comeSailAwayModels({ ...,
// galleon })`, AUDIT GN2-PF9: this named a `withGalleon` that never was) stands it in for prefab 112412. Everything
// that sails, steers, boards, lights, saves, fights and goes online on hull 2 then reads her without a line of it
// knowing she is new.
//
// WHAT IS MAC'S AND WHAT IS BUILT. His: the hull with its ten gunports, the gun deck and the main deck with their two
// hatchways, the stern castle with its doorway, the bulkhead below with its own, the stairs, the masts, the crow's
// nest, the bowsprit, the rudder (his hull's, cut out to turn), the two hatch covers and the gunport shutter. Built
// here: their textures (world/galleonArt.js), the doors that hang in his two doorways, the shutter at all ten ports,
// stairs down each hatchway, the guns behind the ports and the chasers on the bow, the helm's wheel and its pedestal,
// the rig (world/galleonRig.js), the rope ladders over the side. Come Sail Away's own small things are hers as they
// were the old galleon's - the anchor, the stove, the lanterns' hooks, the crate, the flag, the wake - stood in her.
//
// WHAT OPENS AND CLOSES rides the mod's own Door Controller (systems/comeSailAway.js TriggerDoor: activate it, its
// Animator's Opened turns over, Daggerfall's door clips play): the castle's door and the bulkhead's swing on their
// hinges, each hatch cover lifts on its starboard edge, and each gunport's shutter swings up on its top - those ten
// are not the player's to work, the guns' (systems/naval/galleonGunDeck.js) open them as a broadside is laid.
//
// THE FRAME is Unity's, the boat's: +x starboard, +y up, +z the bow, the root on the waterline - every measurement
// below is read off the bake (its frame, tools/bakeGalleon.mjs FRAME: Mac's metres x 0.7) and pinned against it
// (test/galleon_model.test.js; AUDIT GN-NITS: the ones it left unpinned - the castle's front and aft, the gangway, both
// doors, her sternpost and her gun deck - test/auditgalleon_prefab.test.js, to the same tolerance). Not a DFU member.
// Ledger A (GALLEON).
import { GALLEON_ARCHIVE, TEX, GALLEON_TILE, BANDS } from './galleonArt.js';
import { MeshBench, colliderOf, prism, rope, box, planarUv, newell, sub, add, scl, dot, cross, norm, len } from './galleonMesh.js';
import { buildRig, RIG } from './galleonRig.js';
import { nodeOf, yaw, clone, findNode, constClip, eulerCurve, pointsOf, prefabBench } from './shipKit.js';   // SHIPS-2: the shipwright's kit, every ship's
import { CAPSULE_HEIGHT } from '../player/motor.js';   // AUDIT GN-P1: Come Sail Away pins the capsule's CENTRE to DrivePosition

/** The prefab she stands in for: Come Sail Away's hull 2 (FIRST_HULL_MODEL_ID + 2). */
export const GALLEON_PREFAB_ID = 112412;
/** The node the boat's frame is (Boat.MeshObject): her hull, carrying the first MeshCollider of the tree. */
export const GALLEON_HULL_NODE = 'NewGalleon';

/** Her measurements in the boat's frame (metres): each read off the bake - the scene's number x 0.7, the waterline and
 *  the midship taken off (tools/bakeGalleon.mjs FRAME) - and pinned there. */
export const MEASURED = Object.freeze({
  // AUDIT GN-NITS: the gun deck, the castle's front and aft, the gangway, both doorways and the sternpost re-read off the
  // final bake (eac64ad59) to the tenth of a millimetre and pinned there (test/auditgalleon_prefab.test.js NITS) - they
  // had stood unpinned, up to 3.5 mm off it: the gun deck's top 1.0829 (1.085), the bulkhead's doorway 0.7804 a side
  // (0.777) and 3.6785 to its head (3.675), the castle's doorway's jambs 0.7745 a side (0.777) from 6.1784 (6.181)
  mainDeckY: 6.202, mainDeckUnderY: 5.943, gunDeckY: 1.0829, railY: 6.923,
  castleRoofY: 11.018, castleCeilingY: 10.577, castleFrontZ: -10.2965, castleFrontInnerZ: -10.4961, castleAftZ: -19.9049,
  hullOuterX: 5.859, hullInnerX: 5.11,
  portZ: Object.freeze([-7.595, -4.417, -0.714, 2.8105, 6.5135]), portHalfW: 0.371, portSillY: 1.561, portTopY: 2.926,
  hatchAft: Object.freeze({ z0: -5.971, z1: -3.178, halfX: 1.071 }), hatchFore: Object.freeze({ z0: 3.318, z1: 6.111, halfX: 1.071 }),
  gangway: Object.freeze({ z0: -0.5818, z1: 1.5781, sillY: 6.3156 }),
  castleDoor: Object.freeze({ halfX: 0.7745, y0: 6.1784, y1: 8.7713, z: -10.3963 }),
  bulkheadDoor: Object.freeze({ halfX: 0.7804, y0: 1.0829, y1: 3.6785, z: -10.158 }),
  // AUDIT GN-P8: the rudder hangs on her STERNPOST - the hull's two vertices on her centreline at its foot (-3.355) and
  // its head (2.484), z -18.8472 both - and turns there; -18.228 was the rudder's own open front face, 0.62 m inside her
  rudderPivotZ: -18.8472,
  // AUDIT GN-P6: the knuckle of her side every gunport's jambs break at (the hull's port corners at 2.484); AUDIT GN-P5:
  // the cap of her castle's rail (its top, 12.297); AUDIT GN-P2: the underside of a shut hatch cover (Mac's fore cover's
  // foot, 6.090 - it sinks 0.112 into the deck round the hatchway)
  knuckleY: 2.484, railCapY: 12.297, hatchCoverUnderY: 6.09,
  // GALLEON-2: her six deck beams over the gun deck (Mac's second export), aft to fore - each 0.775 m fore and aft,
  // their feet `underY`, their heads in the main deck
  beams: Object.freeze({ z: Object.freeze([-12.857, -6.912, -1.89, 2.208, 7.107, 10.469]), halfZ: 0.387, underY: 5.221, halfX: 5.079 }),
});

/** The slope of the ramps her castle's stair wells run down under her two flights (a face's normal's y between
 *  these, 34 degrees off level): the treads her collider, never the ramp under them. */
export const WELL_RAMP_NY = Object.freeze([0.75, 0.9]);
/** The helm: the wheel's hub (on the castle's roof, inside its low parapet), and where the helmsman stands - far
 *  enough behind it, and the wheel low enough, that the eye at the helm looks over it to the bow.
 *  AUDIT GN-P1: `stand` is DrivePosition, and Come Sail Away pins the player's capsule CENTRE to it (scenes/world.js
 *  csaSetPlayerPosition: pinFeet(c.y - height/2); scenes/comeSailAwayAboard.js helmWord: "the feet, half a height
 *  under") - so it stands CAPSULE_HEIGHT/2 over her roof, as every hull of the mod's stands its own over its deck (its
 *  galleon 0.982, carrack 0.943, trireme 1.383, skiff 1.102, dinghy 0.704). It stood ON the roof: her helmsman's feet
 *  0.9 m under it, through it into the great cabin, his eye (11.818) under the wheel's hub and all 28 of the bow's
 *  sight lines blocked. Measured from the right eye (12.718), the wheel she had (its handles' tips 0.80 m round a hub
 *  0.92 m up) still blocked 16 of the 28 (its binnacle, 1.42 m to its hood, 5 of those); the mod's galleon, from its
 *  own DrivePosition, has none of its 28 blocked by its wheel or wheel-well (it stands its helmsman 0.546 m to port of a
 *  wheel 0.98 m ahead of him - 1.12 m in plan - and 0.05 m under DrivePosition's height). So her wheel is smaller and
 *  lower - its tips 0.66 m round a hub 0.72 m over the roof (6 cm clear of it at the bottom, 9 cm under the lowest
 *  sight line at the top) - and the binnacle forward of it 1.30 m to its hood's top (14 cm under the line): none of the
 *  28 blocked at any turn of the wheel (test/auditgalleon_prefab.test.js P1). */
export const HELM = Object.freeze({ hub: Object.freeze([0, MEASURED.castleRoofY + 0.72, -12.9]), stand: Object.freeze([0, MEASURED.castleRoofY + CAPSULE_HEIGHT / 2, -14.25]), wheelR: 0.4 });
/** AUDIT GN2-PF7: her DriveTrigger's node - Come Sail Away's trigger is a metre's cube on it, whatever the node's scale
 *  (ImportCustomGameobject keeps its world scale) - over her wheel AND its binnacle: 0.25 m forward of the hub, so the
 *  hub stands inside the cube and her HelmPedestal's collider inside it too (its fore face 8 cm in, its top 2 cm under
 *  the cube's). At the hub, that box's fore face stood 0.17 m forward of the cube's: from forward of the wheel (150-210
 *  degrees round it) the activation ray met the pedestal first and the helm was taken one time in six; the mod's
 *  galleon's wheel-well stands inside its cube, every bearing taken. Its after face 1.1 m forward of DrivePosition
 *  (test/auditgalleon2_prefab.test.js PF7). */
export const DRIVE_TRIGGER_AT = Object.freeze([HELM.hub[0], HELM.hub[1], HELM.hub[2] + 0.25]);
/** AUDIT GN-P3: Come Sail Away's anchor on her starboard bow - weighed (ActiveObject's, shown as she sails) and let go
 *  (IdleObject's cable down from her hawse) - each node turned `yawDeg` (Unity's: +z toward +x) so the weighed
 *  anchor's shank and arms lie along her bow's flare in plan (hull polygon 1's side, 30.8 deg off her centreline) with
 *  its stock square out from it, the cable's head at her side; and stood out so EVERY vertex of both clears her outer
 *  planking (the bake's own hull triangles under it) by 2 cm or more. Measured (test/auditgalleon_prefab.test.js P3):
 *  the weighed anchor's nearest vertex 2.0 cm off her side, the let-go cable's 2.0 cm. The mod's anchor stood at
 *  (4.05, 5.85, 15.9) unturned, its mesh reaching 1.62 m inboard of its node: 205 of its 312 vertices inboard of her
 *  outer planking, 62 of them in her open interior (her bow's deck inboard of the bulwark, and between her decks), and
 *  83 of the cable's 106, 7 - the mod's own galleon has none in its open interior. Turned the other way (+31) the stock
 *  lies along her side but the shank points into her: stood out till every vertex clears her, the anchor hangs 1.8 m
 *  off her side and the cable 1.7 m; unturned, its arms stand square out of her side. */
export const ANCHOR = Object.freeze({ yawDeg: -31, weighed: Object.freeze([5.452, 5.85, 15.9]), letGo: Object.freeze([5.366, 5.85, 15.9]) });
/** AUDIT GN-P6: a gunport shutter's stations - its ROWS (heights, top down: its hinge 7 cm over the lintel, her side's
 *  knuckle, the port's sill, its foot 1.554 m under the hinge, Mac's shutter's length) by its COLUMNS (along her about
 *  the port's middle, Mac's 0.868 across) - its board `thick`, its inner face `gap` off her planking, its hinge's eyes
 *  `eyeR` round its pin. */
export const LID = Object.freeze({
  rows: Object.freeze([MEASURED.portTopY + 0.07, MEASURED.knuckleY, MEASURED.portSillY, MEASURED.portTopY + 0.07 - 1.554]),
  cols: Object.freeze([-0.434, -0.217, 0, 0.217, 0.434]),
  thick: 0.098, gap: 0.003, eyeR: 0.04,
});
/** AUDIT GN-P6: each port's shutter fit (aft to fore, as MEASURED.portZ): her half-breadth at each of LID's stations,
 *  rows by columns - the outer of her two sides' (they differ by 0.8 cm at most, at port 0's sill aft; 0.3 at port 1's
 *  sill, 0.2 at port 4's hinge, under 0.1 mm at ports 2 and 3) - measured off the bake by tools/galleonLidFit.mjs
 *  (`node tools/galleonLidFit.mjs` prints it again) and pinned against it. Over each port's opening, the knuckle row's
 *  stations are the line between its outer ones. Port 4's foot follows her side falling in under its sill toward the
 *  bow (5.758 aft to 5.387 fore). So fitted, a shut shutter's inner face lies 1.2 cm off her side at the most along its
 *  edges (port 0's starboard, its aft edge between knuckle and sill: the outer side's fit) and her planking stands 2.3 cm
 *  into it at the most (port 4's fore edge just over the sill, either side, where a crease of the bake's own cut of her
 *  side's 24-gon runs up across the corner), under 0.5 cm everywhere else (test/auditgalleon_prefab.test.js P6). */
const frozen = (a) => Object.freeze(a.map((x) => (Array.isArray(x) ? frozen(x) : x)));
export const LID_FIT = frozen([
  [[5.788, 5.795, 5.795, 5.795, 5.795], [5.858, 5.858, 5.858, 5.858, 5.858], [5.773, 5.773, 5.774, 5.775, 5.775], [5.757, 5.758, 5.758, 5.758, 5.758]],
  [[5.795, 5.795, 5.795, 5.795, 5.795], [5.858, 5.858, 5.858, 5.858, 5.858], [5.775, 5.775, 5.775, 5.775, 5.775], [5.758, 5.758, 5.758, 5.758, 5.758]],
  [[5.795, 5.795, 5.795, 5.795, 5.795], [5.858, 5.858, 5.858, 5.858, 5.858], [5.775, 5.775, 5.775, 5.775, 5.775], [5.758, 5.758, 5.758, 5.758, 5.758]],
  [[5.795, 5.795, 5.795, 5.795, 5.795], [5.858, 5.858, 5.858, 5.858, 5.858], [5.775, 5.775, 5.775, 5.775, 5.775], [5.758, 5.758, 5.758, 5.758, 5.758]],
  [[5.795, 5.797, 5.797, 5.797, 5.797], [5.858, 5.857, 5.855, 5.853, 5.852], [5.775, 5.767, 5.759, 5.751, 5.743], [5.758, 5.741, 5.623, 5.505, 5.387]],
]);
/** AUDIT GN-P4: her board triggers' middles abeam (their boxes 3 m a side, the mod's). */
export const BOARD_X = 7.4;
/** AUDIT GN-P12: the bed's node over the deck it stands on - the mod's galleon's (BedObject 4.420, 3.906, -14.522 over
 *  its deck at 3.644). */
export const BED_OVER_DECK = 0.262;
/** AUDIT GN-STOVE: the stove's cowl (Come Sail Away's StovePipe) stood `headGap` under the deckhead over it, as the mod's
 *  galleon stands it (its top 6.602 under its deck's underside at 6.738); `cowlTop` the cowl mesh's top over its node
 *  (its bounds, 0.540); the flue run up under it `r` round, seated `seat` into the cowl's foot. */
export const STOVE = Object.freeze({ headGap: 0.136, cowlTop: 0.54, r: 0.14, seat: 0.03 });
/** The guns: each port's gun, run out (its muzzle a hair outside her planking) and run in (to load). */
export const GUN = Object.freeze({ muzzleX: 1.75, runOutX: 4.16, runInX: 3.06, axisY: 2.2435, chaserY: 7.45 });
/** Her five sides' guns as HULL_BUILDS reads them (systems/naval/navalShips.js): the starboard muzzles (the port side
 *  their mirror), the bow chasers, the barrels' drop astern. */
export const GALLEON_BATTERIES = Object.freeze({
  broadside: Object.freeze(MEASURED.portZ.map((z) => Object.freeze([MEASURED.hullOuterX + 0.09, GUN.axisY, z]))),
  bow: Object.freeze([Object.freeze([-1.15, GUN.chaserY, 19.15]), Object.freeze([1.15, GUN.chaserY, 19.15])]),
  stern: Object.freeze([Object.freeze([0, 5.4, -20.6])]),
});

// ── the bake's parts, textured ─────────────────────────────────────────────────────────────────────────────────────

/** Which picture a face of a baked part wears, and how it lies on it: `{ rec, uv(p) }` - or, a face of a livery (the
 *  hull's side, the castle's, the stern's), `{ band, u(p) }`: the livery's slices by height (galleonArt.js BANDS),
 *  each 64 texels tall, that bakedPartGeometry cuts the face into, u along her as the livery tiles. */
export function faceSkin(role, n, c) {
  const tiled = (rec) => ({ rec, uv: (p) => planarUv(p, n, GALLEON_TILE[keyOf(rec)]) });
  const banded = (name) => ({ band: BANDS[name], u: (p) => planarUv(p, n, [GALLEON_TILE[name][0], 1])[0] });
  const up = n[1] > 0.7, down = n[1] < -0.7;
  switch (role) {
    case 'hull': {
      // a gunport's throat: its sill, lintel and cheeks, painted red inside as the lids are. AUDIT GN-R8: in the
      // throat's own tiling planks (TEX.dark), not the lid's whole-face picture - that, on a tile of [0, 0], repeated
      // every metre across the throats, its iron straps and black border on 23% of them
      if (c[1] > 1.4 && c[1] < 3.1 && Math.abs(c[0]) > 4.9 && Math.abs(c[0]) < 6.1 && Math.abs(n[0]) < 0.3) return tiled(TEX.dark);
      if (up) return tiled(c[1] > 6.3 ? TEX.trim : TEX.hullInner);
      const core = [0, c[1], Math.max(-14, Math.min(14, c[2]))];
      if (dot(n, sub(core, c)) > 0) return tiled(TEX.hullInner);   // a face looking in toward her keel line: the ceiling planks
      if (n[1] < -0.55) return tiled(TEX.hullBottom);
      return banded('hullSide');
    }
    case 'rudder': return tiled(TEX.hullBottom);
    // GALLEON-2: a deck beam is a squared oak timber, its grain along it (athwartships) on its sides and its foot
    case 'deckBeam': return { rec: TEX.trim, uv: (p) => [p[0] / GALLEON_TILE.trim[0], (Math.abs(n[1]) > 0.7 ? p[2] : p[1]) / GALLEON_TILE.trim[1]] };
    case 'gunDeck': return tiled(TEX.deck);
    case 'mainDeck': return tiled(up ? TEX.deck : down ? TEX.underDeck : TEX.trim);   // GALLEON-2: under it, her beams are Mac's
    case 'castle': {
      const out = dot(n, sub(c, [0, 8.4, -15.1])) > 0;
      if (Math.abs(c[0]) < 0.85 && c[2] > -10.6 && Math.abs(n[2]) < 0.3 && c[1] < 9.2) return tiled(TEX.trim);   // the doorway's jambs and head
      // AUDIT GN-P7: the stair wells' casings - each well's two walls (the castle's faces 9/10 and 12/13, x ±3.33..4.76)
      // and the casing's sides in the great cabin (26/27 and 29/30, x ±3.29..4.81), all inside her, in her ceiling's
      // planks. The which-side-of-a-point test below gave each well one wall of her outer livery and the cabin's outboard
      // side of each casing the livery too. (Its old "stairwells' cut" rule - neither up nor down, |n.y| over 0.4, high -
      // matched no face: the flights' ramps, n.y 0.83, are `up` and wear the deck, the casings' soffits, -0.85, `down`
      // and wear the beams.)
      if (Math.abs(n[0]) > 0.9 && Math.abs(c[0]) > 3 && Math.abs(c[0]) < 5 && c[1] > 8) return tiled(TEX.hullInner);
      if (out) {
        if (up) return tiled(TEX.deck);
        if (n[2] < -0.25 && c[1] > 7.6) return banded('sternWindows');
        if (down) return tiled(TEX.hullInner);
        return banded('castle');
      }
      return tiled(down ? TEX.beams : up ? TEX.deck : TEX.hullInner);
    }
    case 'castleRail': case 'castleParapet': {
      const out = dot(n, sub(c, [0, c[1], -15.0])) > 0;
      if (up || down) return tiled(TEX.trim);
      return out ? banded('castle') : tiled(TEX.trim);
    }
    case 'stairsPort': case 'stairsStarboard': return tiled(up ? TEX.deck : TEX.trim);
    case 'bulkhead': return tiled(Math.abs(c[0]) < 0.85 && Math.abs(n[2]) < 0.3 ? TEX.trim : TEX.hullInner);
    case 'mainMast': case 'foreMast': case 'bowsprit': return tiled(TEX.spar);
    case 'crowsNest': return tiled(up ? TEX.deck : TEX.trim);
    case 'hatchAft': case 'hatchFore': return tiled(up || down ? TEX.grate : TEX.trim);
    default: return tiled(TEX.trim);
  }
}
const keyOf = (rec) => Object.keys(TEX).find((k) => TEX[k] === rec);

/**
 * A baked part as the port draws it: each polygon's triangles flat on its own normal, wearing its face's picture -
 * moved by `offset` (a hinge's: its part re-based on the node that turns it). GALLEON-2: or several parts of one role
 * as one mesh (`part` a list - her six deck beams), each face its own picture as alone.
 */
export function bakedPartGeometry(part, { offset = [0, 0, 0], role = Array.isArray(part) ? part[0].role : part.role, keep = null, skin = faceSkin, archive = GALLEON_ARCHIVE } = {}) {
  const bench = new MeshBench(archive);   // SHIPS-2: another ship's part on her own skin and archive (world/carrackModel.js)
  for (const one of Array.isArray(part) ? part : [part]) benchPart(bench, one, { offset, role, keep, skin });
  return bench.finish();
}
/**
 * One baked part's faces onto `bench` (bakedPartGeometry's).
 * AUDIT GN-R14: EVERY face of a part that wears a livery anywhere is cut at that livery's slice heights (`sliceCuts`),
 * banded or not - a cut through one side of a shared edge only left a T-junction there (20 on her hull, at 1.600 on
 * every gunport's outer cheek edges where the side's livery met the throat; 8 on her castle, at 9.000 by the wells) -
 * and the bake's own triangles are first split at any of the part's corners that lie on their edges (`splitAtCorners`:
 * the final bake has 10 such corners on her hull (AUDIT GN2-BK1: Blender 5.1.1's cut), at her ports' sill and lintel corners, and 1 in her castle). AUDIT
 * GN-B1: each triangle carries its POLYGON's normal at all three corners - 38 of Mac's 401 n-gons stand more than 1 cm
 * out of their planes (her hull's up to 0.40 m), and lit by each triangle's own normal a polygon's triangles shaded as
 * creases Blender's flat shading never shows.
 */
export function benchPart(bench, part, { offset, role, keep, skin: skinOf = faceSkin }) {
  const pts = pointsOf(part).map((p) => sub(p, offset));
  const faces = part.polygons.map((poly) => {
    const ring = poly.map((i) => pts[i]);
    const n = norm(newell(ring));
    const c = scl(ring.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / ring.length);
    return { n, skin: skinOf(role, n, add(c, offset)) };
  });
  const cuts = sliceCuts(faces.map((f) => f.skin));
  for (const [k, a, b, cc] of splitAtCorners(part, pts)) {
    const { n, skin } = faces[k];
    if (keep && !keep(n)) continue;
    for (const piece of slabs([a, b, cc], offset[1], cuts)) {
      if ('band' in skin) bandPiece(bench, skin, n, offset, piece);
      else for (let i = 1; i + 1 < piece.length; i++) bench.tri(skin.rec, piece[0], piece[i], piece[i + 1], skin.uv(add(piece[0], offset)), skin.uv(add(piece[i], offset)), skin.uv(add(piece[i + 1], offset)), n, [n, n, n]);
    }
  }
}

/** AUDIT GN-R14: the heights (her frame) every face of a part is cut at - the slice boundaries of each livery any of
 *  its faces wears, ascending, each once. */
function sliceCuts(skins) {
  const out = new Set();
  for (const s of skins) {
    if (!('band' in s)) continue;
    const S = s.band.recs.length, h = (s.band.y1 - s.band.y0) / S;
    for (let k = 1; k < S; k++) out.add(s.band.y1 - k * h);
  }
  return [...out].sort((a, b) => a - b);
}

/** AUDIT GN-R14: a part's triangles `[polygon, a, b, c]`, each split at every corner of the part lying inside one of its
 *  edges (within 2e-5 m) - so a corner one face has on a shared edge the face beside it has too. */
function splitAtCorners(part, pts) {
  const out = [];
  const onEdge = (p, q, v) => {
    const d = sub(q, p), L2 = dot(d, d);
    if (!(L2 > 1e-12)) return null;
    const t = dot(sub(v, p), d) / L2;
    if (t <= 1e-6 || t >= 1 - 1e-6) return null;
    return len(sub(add(p, scl(d, t)), v)) < 2e-5 ? t : null;
  };
  const split = (k, tri) => {
    for (let e = 0; e < 3; e++) {
      const p = tri[e], q = tri[(e + 1) % 3], r = tri[(e + 2) % 3];
      for (const v of pts) {
        if (onEdge(p, q, v) == null) continue;
        split(k, [p, v, r]); split(k, [v, q, r]);
        return;
      }
    }
    out.push([k, ...tri]);
  };
  for (let t = 0; t < part.triangleOf.length; t++) split(part.triangleOf[t], [part.triangles[t * 3], part.triangles[t * 3 + 1], part.triangles[t * 3 + 2]].map((i) => pts[i]));
  return out;
}

/** AUDIT GN-R14: a triangle cut at the heights `cuts` (her frame: a point's y plus `dy`) into its slabs, bottom up - each
 *  a convex polygon, its corners in order. */
function slabs(tri, dy, cuts) {
  const out = [];
  let rest = tri;
  for (const y of cuts) {
    const below = clipY(rest, dy, y, -1);
    if (below.length >= 3) out.push(below);
    rest = clipY(rest, dy, y, 1);
    if (rest.length < 3) return out;
  }
  out.push(rest);
  return out;
}

/**
 * GALLEON-2: a livery's piece (a slab between two of its slice heights - AUDIT GN-R14: `slabs`) worn on its 64-texel
 * slice: the slice whose heights hold its middle, its record, v up that slice (1 its top row). The outer slices take what
 * lies past the band's ends, v held at their edge (her faces lie inside their bands - a pin reads it).
 */
function bandPiece(bench, { band, u }, n, offset, piece) {
  const S = band.recs.length, h = (band.y1 - band.y0) / S;
  const mid = piece.reduce((a, p) => a + p[1], 0) / piece.length + offset[1];
  const k = Math.min(S - 1, Math.max(0, Math.floor((band.y1 - mid) / h)));
  const y0 = band.y1 - (k + 1) * h;
  const uv = (p) => { const w = add(p, offset); return [u(w), Math.min(1, Math.max(0, (w[1] - y0) / h))]; };
  for (let i = 1; i + 1 < piece.length; i++) bench.tri(band.recs[k], piece[0], piece[i], piece[i + 1], uv(piece[0]), uv(piece[i]), uv(piece[i + 1]), n, [n, n, n]);
}
/** The part of a convex polygon on one side of the level `y` (her frame: a point's y plus `dy`) - `keep` 1 above it,
 *  -1 below; its corners in order, the level's crossings among them. */
function clipY(poly, dy, y, keep) {
  if (!Number.isFinite(y)) return poly;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = keep * (p[1] + dy - y), sq = keep * (q[1] + dy - y);
    if (sp >= 0) out.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]); }
  }
  return out;
}

/** AUDIT GN-CROWSNEST: a mast's head capped - its top ring (the part's highest corners, in order round them) one face
 *  looking up, in the spar's wood. Onto `bench`, in her frame. */
export function mastCap(bench, part, skinOf = faceSkin) {
  const pts = pointsOf(part);
  const top = Math.max(...pts.map((p) => p[1]));
  const ring = pts.filter((p) => p[1] > top - 1e-4);
  const c = scl(ring.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / ring.length);
  ring.sort((p, q) => Math.atan2(p[2] - c[2], p[0] - c[0]) - Math.atan2(q[2] - c[2], q[0] - c[0]));
  const n = [0, 1, 0], skin = skinOf(part.role, n, c);
  if ('band' in skin) throw new Error('galleon: a mast wears no livery');
  bench.poly(skin.rec, ring, ring.map((p) => skin.uv(p)), n);
}
/** AUDIT GN-CROWSNEST: a crow's nest's floor (its lowest face looking up) given its underside - its own triangles
 *  again, looking down, in the nest's dark oak - and the bowl's open bottom closed round the mast that passes through
 *  it: a band looking down from the bowl's lowest ring in to the mast's section at that height (`mast` the mast's
 *  part). Mac's bowl is hollow - its outer wall and its inner wall a skin each, open between them at the bottom - so
 *  from below the floor's underside alone left the sky showing through the wall's hollow. Onto `bench`, her frame. */
export function nestUnderside(bench, part, mast) {
  const pts = pointsOf(part);
  // the bowl's bottom: its lowest ring, and the mast's section through it (the mast's side edges cut at that height)
  const low = Math.min(...pts.map((p) => p[1]));
  const ring = pts.filter((p) => p[1] < low + 1e-4);
  const mp = pointsOf(mast), mTop = Math.max(...mp.map((p) => p[1])), mBot = Math.min(...mp.map((p) => p[1]));
  const heads = mp.filter((p) => p[1] > mTop - 1e-4), feet = mp.filter((p) => p[1] < mBot + 1e-4);
  const ax = scl(heads.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / heads.length);
  const angle = (p) => Math.atan2(p[2] - ax[2], p[0] - ax[0]);
  const section = heads.map((h) => {
    const f = feet.reduce((best, q) => (Math.hypot(q[0] - h[0], q[2] - h[2]) < Math.hypot(best[0] - h[0], best[2] - h[2]) ? q : best));
    const t = (low - f[1]) / (h[1] - f[1]);
    return [f[0] + (h[0] - f[0]) * t, low, f[2] + (h[2] - f[2]) * t];
  });
  const down = [0, -1, 0], skinD = faceSkin(part.role, down, [ax[0], low, ax[2]]);
  if ('band' in skinD) throw new Error('galleon: a nest wears no livery');
  const outer = [...ring].sort((p, q) => angle(p) - angle(q)), inner = [...section].sort((p, q) => angle(p) - angle(q));
  // the band between two rings round one axis: march both by angle, a triangle a step (read in turns: a ring's k-th
  // corner past its last is a whole turn on)
  let i = 0, j = 0;
  const wrap = (a, k) => a[k % a.length], turns = (a, k) => angle(wrap(a, k)) / (2 * Math.PI) + Math.floor(k / a.length);
  while (i < outer.length || j < inner.length) {
    const takeOuter = j >= inner.length || (i < outer.length && turns(outer, i + 1) <= turns(inner, j + 1));
    const a = wrap(outer, i), b = wrap(inner, j), c = takeOuter ? wrap(outer, i + 1) : wrap(inner, j + 1);
    bench.tri(skinD.rec, a, b, c, skinD.uv(a), skinD.uv(b), skinD.uv(c), down, [down, down, down]);
    if (takeOuter) i++; else j++;
  }
  let floor = null;
  part.polygons.forEach((poly, k) => {
    const ring = poly.map((i) => pts[i]);
    if (norm(newell(ring))[1] < 0.99) return;
    const y = ring.reduce((a, p) => a + p[1], 0) / ring.length;
    if (!floor || y < floor.y) floor = { k, ring, y };
  });
  if (!floor) throw new Error('galleon: the crow\'s nest has no floor');
  const n = [0, -1, 0], c = scl(floor.ring.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / floor.ring.length);
  const skin = faceSkin(part.role, n, c);
  if ('band' in skin) throw new Error('galleon: a nest wears no livery');
  for (let t = 0; t < part.triangleOf.length; t++) {
    if (part.triangleOf[t] !== floor.k) continue;
    const [a, b, cc] = [part.triangles[t * 3], part.triangles[t * 3 + 1], part.triangles[t * 3 + 2]].map((i) => pts[i]);
    bench.tri(skin.rec, a, b, cc, skin.uv(a), skin.uv(b), skin.uv(cc), n, [n, n, n]);
  }
}

/** AUDIT GN-P8: the rudder blade's front, abaft her sternpost - far enough that turned RUDDER_DEG about the post its
 *  forward corners stay 1 cm or more clear of her stern planking (1.2 cm at 35 degrees; the blade 0.241 m thick at its
 *  front, her planking running forward off the post 0.396 m in each metre out). */
export const RUDDER_CLEAR = 0.04;
/**
 * AUDIT GN-P8: the rudder Mac cut out of her hull, cut again at `cutZ` (abaft her sternpost) and closed there: each of
 * its faces clipped to the part of it aft of the cut, and the cut's own section a face looking forward (the bake's
 * rudder is open at its front, where it was her hull's). A baked part's shape (positions, polygons, triangles,
 * triangleOf), its faces convex as Mac's five are.
 */
export function rudderBlade(part, cutZ) {
  const pts = pointsOf(part);
  const positions = [], polygons = [], triangles = [], triangleOf = [];
  const at = (p) => {
    for (let i = 0; i < positions.length; i += 3) if (Math.hypot(positions[i] - p[0], positions[i + 1] - p[1], positions[i + 2] - p[2]) < 1e-7) return i / 3;
    positions.push(p[0], p[1], p[2]);
    return positions.length / 3 - 1;
  };
  const face = (ring) => {
    const k = polygons.length;
    polygons.push(ring.map(at));
    for (let i = 1; i + 1 < ring.length; i++) { triangles.push(polygons[k][0], polygons[k][i], polygons[k][i + 1]); triangleOf.push(k); }
  };
  const section = [];
  for (const poly of part.polygons) {
    const ring = poly.map((i) => pts[i]), out = [];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      if (p[2] <= cutZ) out.push(p);
      if ((p[2] < cutZ && q[2] > cutZ) || (p[2] > cutZ && q[2] < cutZ)) {
        const t = (cutZ - p[2]) / (q[2] - p[2]);
        const x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, cutZ];
        out.push(x); section.push(x);
      }
    }
    if (out.length >= 3) face(out);
  }
  // the section's corners (each found on two faces) in order round their middle - the front, looking forward
  const ends = section.filter((p, i) => section.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-7) === i);
  const c = scl(ends.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / ends.length);
  ends.sort((p, q) => Math.atan2(p[1] - c[1], p[0] - c[0]) - Math.atan2(q[1] - c[1], q[0] - c[0]));
  if (dot(newell(ends), [0, 0, 1]) < 0) ends.reverse();
  face(ends);
  return { role: part.role, positions, polygons, triangles, triangleOf };
}

// ── the parts built here ───────────────────────────────────────────────────────────────────────────────────────────

/** A hatch cover in its hinge's frame: the box Mac made (his fore cover's - both covers are it), lying closed with
 *  its starboard side on the hinge, `drop` under its top, and the rest of it to port. */
export function hatchCoverGeometry(cover, drop = 0) {
  const bench = new MeshBench();
  const [hx, hy, hz] = cover.half;
  // the hinge is on its starboard side `drop` under its top: the cover spans x -2hx..0, y drop-2hy..drop round it
  box(bench, TEX.grate, [-hx, drop - hy, 0], [hx, hy, hz], { tile: GALLEON_TILE.grate, skip: [0, 1, 4, 5] });
  box(bench, TEX.trim, [-hx, drop - hy, 0], [hx, hy, hz], { tile: GALLEON_TILE.trim, skip: [2, 3] });
  // the battens' frame along it, a ring bolt to lift it by
  for (const s of [-1, 1]) box(bench, TEX.trim, [-hx, drop + 0.02, s * (hz - 0.08)], [hx - 0.04, 0.02, 0.08], { tile: GALLEON_TILE.trim });
  prism(bench, TEX.iron, [-hx * 2 + 0.25, drop, 0], [-hx * 2 + 0.25, drop + 0.06, 0], 0.09, 0.09, 6);
  return bench.finish();
}
/** AUDIT GN-P9: how far under a cover's top its hinge stands (on its starboard side) for the cover to lie on her deck
 *  opened to `deg` - turned that far about the hinge, its lowest point (`g`, the cover built with its hinge at its top's
 *  starboard edge: its battens' starboard ends, turned under it) `clear` over the deck, its top standing `over` her
 *  deck's top shut. A point (x, y) about the hinge turns to y' = x sin + y cos; the hinge `drop` under the top lifts
 *  every point by `drop` before the turn and lowers the hinge by it, so the lowest point falls `drop (1 - cos)`. */
export function hatchHingeDrop(g, over, clear = 0.002, deg = HATCH_OPEN_DEG) {
  const s = Math.sin((deg * Math.PI) / 180), c = Math.cos((deg * Math.PI) / 180);
  let low = Infinity;
  for (let i = 0; i < g.positions.length; i += 3) low = Math.min(low, g.positions[i] * s + g.positions[i + 1] * c);
  return (over + low - clear) / (1 - c);
}

/** A door leaf's thickness. */
export const DOOR_THICK = 0.08;
/** A door leaf in its hinge's frame: the leaf to +x of the hinge, its foot on the hinge's height, `w` wide and `h`
 *  tall, `t` thick FORWARD of it (+z); planked, strapped and ringed (doorArt, the whole face). AUDIT GN2-PF8: the
 *  hinge on the leaf's after face, the face it swings to - Come Sail Away's Door Opened turns it +90 (+x to -z, aft), so
 *  open it lies on the hinge's free side. Hinged at the middle of its thickness, open, half of it (4 cm) stood back
 *  through the hinge, 2 cm into the doorway's jamb over its whole height. */
export function doorLeafGeometry(w, h, t = DOOR_THICK) {
  const bench = new MeshBench();
  box(bench, TEX.door, [w / 2, h / 2, t / 2], [w / 2, h / 2, t / 2], { uvFace: (fi, k) => {
    const q = [[0, 0], [0, 1], [1, 1], [1, 0]][k];
    return fi === 4 ? [1 - q[0], q[1]] : fi === 5 ? q : [q[0] * 0.08, q[1]];
  } });
  return bench.finish();
}

/**
 * A gunport shutter in its hinge's frame, on side `s` (1 starboard, -1 port), fitted to her side at one port: Mac's
 * shutter - 0.87 along her, 1.55 down from its hinge, 0.1 thick - hanging closed down her side, its strake-red face out.
 * AUDIT GN-G1: each side its own mesh, the port side's the starboard's mirrored, so neither node needs a turn its clip
 * would write over (the shutter clip sets the node's whole turn: the port side's yaw of 180 went, and five boards swung
 * into her gun deck).
 * AUDIT GN-P6: its inner face lies LID.gap off her planking at LID's stations (`fit`, LID_FIT's row for its port: her
 * half-breadth at each), the board bent between them - at her side's knuckle and over the sill, and across it where her
 * side falls in under port 4's sill toward the bow - its hinge (the node, `xh` out) on her side at the lintel. It was a
 * plumb slab hung on a hinge 2 cm off her widest (5.879): 2.1 cm off her side at the knuckle, 8-9 at the hinge, 10-11
 * at the sill and 12 at its foot at ports 0-3, 47 at port 4's lower fore corner. Returns { geometry, xh, collider }:
 * `collider` its board's two plates from the hinge down to the sill, over the port's opening, in the node's frame - its
 * MeshCollider (AUDIT GN-P10).
 */
export function lidGeometry(s, fit) {
  const bench = new MeshBench();
  const R = LID.rows.length, K = LID.cols.length, t = LID.thick;
  const xh = Math.max(...fit[0]);   // the hinge's pin: on her side at the lintel, nowhere inside it along the port
  const inner = LID.rows.map((y, r) => LID.cols.map((dz, k) => [s * (fit[r][k] + LID.gap - xh), y - LID.rows[0], dz]));
  // each corner's outward normal: the mean of its quads' (each the cross of its diagonals, turned out of her side)
  const quadN = (r, k) => { const n = norm(cross(sub(inner[r + 1][k + 1], inner[r][k]), sub(inner[r][k + 1], inner[r + 1][k]))); return n[0] * s < 0 ? scl(n, -1) : n; };
  const outer = inner.map((row, r) => row.map((p, k) => {
    let n = [0, 0, 0];
    for (const [rr, kk] of [[r - 1, k - 1], [r - 1, k], [r, k - 1], [r, k]]) if (rr >= 0 && kk >= 0 && rr < R - 1 && kk < K - 1) n = add(n, quadN(rr, kk));
    return add(p, scl(norm(n), t));
  }));
  // the whole picture over each face, u along her (mirrored to port), v up it; a tenth of it on the edges
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
  // the hinge's two iron eyes, on its pin
  for (const z of [-0.26, 0.26]) prism(bench, TEX.iron, [0, 0, z - 0.07], [0, 0, z + 0.07], LID.eyeR, LID.eyeR, 6);
  // AUDIT GN-P10: what of it is solid - its board's two faces over the port's opening (its plates from the hinge down to
  // the sill), and no face of it a floor to her deck's bake (navalDeck.js DECK_FLAT, within 30 degrees of level): a box
  // round them put its flat top (a ledge 0.24 x 0.87 m at y 3.0, outside her side) among the deck's floors, and the
  // strip under port 4's sill lies 18 degrees off level (no cell's centre falls under it now; one would, a cell over)
  const solid = new MeshBench();
  for (let r = 0; r < 2; r++) for (let k = 0; k < K - 1; k++) {
    const n = quadN(r, k), at = [[r, k], [r, k + 1], [r + 1, k + 1], [r + 1, k]];
    solid.quad(TEX.lid, ...at.map(([a, b]) => outer[a][b]), at.map(() => [0, 0]), n);
    solid.quad(TEX.lid, ...at.map(([a, b]) => inner[a][b]), at.map(() => [0, 0]), scl(n, -1));
  }
  return { geometry: bench.finish(), xh, collider: solid.finish() };
}

/** A gun: its carriage and trucks under the barrel, in the gun's frame (its muzzle down +x, its foot on the gun deck
 *  at y 0). `barrel` the barrel alone (it rides the same node: the whole gun runs out and recoils). */
export function gunGeometry() {
  const bench = new MeshBench();
  const axis = GUN.axisY - MEASURED.gunDeckY;
  // the cheeks and the bed between them
  for (const s of [-1, 1]) box(bench, TEX.trim, [-0.05, axis * 0.46, s * 0.27], [0.62, axis * 0.42, 0.07], { tile: GALLEON_TILE.trim });
  box(bench, TEX.trim, [-0.05, 0.26, 0], [0.6, 0.06, 0.22], { tile: GALLEON_TILE.trim });
  // the trucks
  for (const x of [-0.48, 0.38]) prism(bench, TEX.trim, [x, 0.17, -0.38], [x, 0.17, 0.38], 0.17, 0.17, 8, { smooth: true });
  // the barrel: breech to muzzle, its reinforcing rings, the swell at its mouth, the cascabel, the trunnions
  prism(bench, TEX.iron, [-0.62, axis, 0], [GUN.muzzleX, axis, 0], 0.2, 0.13, 10, { smooth: true, tileV: 1 });
  for (const [x, r] of [[-0.5, 0.215], [0.15, 0.19], [0.8, 0.165]]) prism(bench, TEX.iron, [x, axis, 0], [x + 0.08, axis, 0], r, r, 10, { smooth: true });
  prism(bench, TEX.iron, [GUN.muzzleX - 0.16, axis, 0], [GUN.muzzleX, axis, 0], 0.165, 0.16, 10, { smooth: true });
  prism(bench, TEX.iron, [-0.62, axis, 0], [-0.8, axis, 0], 0.09, 0.05, 8, { smooth: true });
  prism(bench, TEX.iron, [0.2, axis, -0.33], [0.2, axis, 0.33], 0.065, 0.065, 8, { smooth: true });
  // the breeching rope from the cascabel to either side of her
  for (const s of [-1, 1]) rope(bench, TEX.rope, [[-0.8, axis, 0], [-0.4, axis - 0.1, s * 0.5], [0.9, axis - 0.15, s * 0.62]], 0.03);
  return bench.finish();
}

/** A chaser: a light gun on a swivel over her bow rail, its muzzle down +z. In its post's frame (the post's foot on the
 *  deck at y 0). */
export function chaserGeometry(height) {
  const bench = new MeshBench();
  prism(bench, TEX.trim, [0, 0, 0], [0, height - 0.12, 0], 0.11, 0.09, 6);
  box(bench, TEX.iron, [0, height - 0.06, 0], [0.16, 0.06, 0.06], { tile: GALLEON_TILE.iron });
  prism(bench, TEX.iron, [0, height, -0.55], [0, height, 0.95], 0.11, 0.08, 8, { smooth: true });
  prism(bench, TEX.iron, [0, height, -0.55], [0, height + 0.04, -0.9], 0.03, 0.03, 4);   // its tiller
  return bench.finish();
}

/** The ship's wheel in its own frame (the hub at the origin, the axle along z): a rim on eight spokes whose turned
 *  handles stand out past it, an inner ring, the hub and its brass cap. Its handles' tips stand `R + 0.26` round the
 *  hub (AUDIT GN-P1: the circle every turn of it sweeps). */
export function wheelGeometry(R = HELM.wheelR) {
  const bench = new MeshBench();
  const N = 16;
  const ringOf = (r, w, d, rec) => {
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
      const p = (a, rr, z) => [Math.cos(a) * rr, Math.sin(a) * rr, z];
      const o0 = p(a0, r + w, -d), o1 = p(a1, r + w, -d), i0 = p(a0, r - w, -d), i1 = p(a1, r - w, -d);
      const O0 = p(a0, r + w, d), O1 = p(a1, r + w, d), I0 = p(a0, r - w, d), I1 = p(a1, r - w, d);
      const mid = (a0 + a1) / 2, out = [Math.cos(mid), Math.sin(mid), 0];
      const uv = [[k / N * 4, 0], [(k + 1) / N * 4, 0], [(k + 1) / N * 4, 0.1], [k / N * 4, 0.1]];
      bench.quad(rec, o0, o1, O1, O0, uv, out);
      bench.quad(rec, i0, i1, I1, I0, uv, scl(out, -1));
      bench.quad(rec, o0, o1, i1, i0, uv, [0, 0, -1]);
      bench.quad(rec, O0, O1, I1, I0, uv, [0, 0, 1]);
    }
  };
  ringOf(R, 0.045, 0.05, TEX.trim);
  ringOf(R * 0.5, 0.025, 0.035, TEX.trim);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, d = [Math.cos(a), Math.sin(a), 0];
    prism(bench, TEX.trim, scl(d, 0.1), scl(d, R + 0.05), 0.028, 0.024, 6, { smooth: true });
    prism(bench, TEX.trim, scl(d, R + 0.05), scl(d, R + 0.22), 0.032, 0.026, 6, { smooth: true });
    prism(bench, TEX.gilt, scl(d, R + 0.22), scl(d, R + 0.26), 0.036, 0.0, 6, { smooth: true, caps: [true, false] });
  }
  prism(bench, TEX.trim, [0, 0, -0.1], [0, 0, 0.1], 0.13, 0.13, 10, { smooth: true });
  prism(bench, TEX.gilt, [0, 0, -0.1], [0, 0, -0.16], 0.08, 0.04, 10, { smooth: true });
  return bench.finish();
}

/** The wheel's pedestal: a binnacle box forward of it, the axle's iron to the hub, a lamp hood on top. In her frame.
 *  AUDIT GN-P1: its gilt cap 0.99 m over her roof and its hood's top 1.30 (they stood 1.12 and 1.42), under the helmsman's
 *  sight lines to the bow - its box collider (galleonPrefab) kept as it stood, 1.2 m, round it. */
export function helmPedestalGeometry() {
  const bench = new MeshBench();
  const [hx, hy, hz] = HELM.hub;
  const y0 = MEASURED.castleRoofY;
  box(bench, TEX.trim, [hx, y0 + 0.48, hz + 0.42], [0.26, 0.48, 0.22], { tile: GALLEON_TILE.trim });
  box(bench, TEX.gilt, [hx, y0 + 0.99, hz + 0.42], [0.28, 0.03, 0.24], { tile: GALLEON_TILE.gilt });
  prism(bench, TEX.iron, [hx, hy, hz + 0.2], [hx, hy, hz + 0.05], 0.05, 0.05, 6, { smooth: true });
  prism(bench, TEX.gilt, [hx, y0 + 1.02, hz + 0.42], [hx, y0 + 1.3, hz + 0.42], 0.16, 0.06, 8, { smooth: true });
  return bench.finish();
}

/** A manrope's radius, and its clearance under a shut hatch cover (AUDIT GN-P2). */
export const MANROPE = Object.freeze({ r: 0.03, clear: 0.02 });

/** AUDIT GN-STOVE: the stove's flue in the stove's frame: an iron pipe from its stack's top (`foot`, where the cowl
 *  stood) straight up `length`, open at both ends (the stack and the cowl seat on them). */
export function stoveFlueGeometry(foot, length) {
  const bench = new MeshBench();
  prism(bench, TEX.iron, foot, add(foot, [0, length, 0]), STOVE.r, STOVE.r, 8, { smooth: true, caps: [false, false], tileV: GALLEON_TILE.iron[1] });
  return bench.finish();
}

/** Stairs down a hatchway: from the main deck's edge of the hole down to the gun deck at `pitch`, `dir` the way
 *  they descend along z (+1 toward the bow, -1 aft). Treads, risers, a stringer each side, and a manrope over each.
 *  AUDIT GN-P2: a manrope runs 0.95 m over its stringer from the stair's foot UP TO HER DECK'S UNDERSIDE and no
 *  higher - its head where its top is MANROPE.clear under a shut cover's foot (MEASURED.hatchCoverUnderY), then made
 *  fast outboard to the hatchway's side (`holeHalfX`, the deck's edge) at that height. It ran on up the stair's line to
 *  0.85 m over her deck at the hatchway's head, and with the covers shut (as she spawns) four rope stubs stood up
 *  through them, up to 0.69 m high, in the companions' colliders too. */
export function companionGeometry(topZ, dir, halfX = 0.72, pitch = 48, holeHalfX = MEASURED.hatchFore.halfX) {
  const bench = new MeshBench();
  const top = MEASURED.mainDeckY, bottom = MEASURED.gunDeckY;
  const rise = 0.3, steps = Math.round((top - bottom) / rise);
  const r = (top - bottom) / steps, run = r / Math.tan((pitch * Math.PI) / 180);
  for (let i = 1; i <= steps; i++) {
    const y = top - i * r, z0 = topZ + dir * (i - 1) * run, z1 = topZ + dir * i * run;
    box(bench, TEX.deck, [0, y - 0.04, (z0 + z1) / 2], [halfX, 0.04, Math.abs(z1 - z0) / 2 + 0.02], { tile: GALLEON_TILE.deck });
  }
  const zEnd = topZ + dir * steps * run;
  const headY = MEASURED.hatchCoverUnderY - MANROPE.clear - MANROPE.r;
  for (const s of [-1, 1]) {
    const a = [s * (halfX + 0.05), top - 0.1, topZ], b = [s * (halfX + 0.05), bottom + 0.1, zEnd];
    prism(bench, TEX.trim, a, b, 0.09, 0.09, 4, { tileV: 2, twist: Math.PI / 4 });
    // the manrope to hold: its foot 0.95 m over the stringer's, up the stair's line to its head under the deck
    const foot = add(b, [0, 0.95, 0]), line = add(a, [0, 0.95, 0]);
    const t = (headY - foot[1]) / (line[1] - foot[1]);
    const head = [foot[0], headY, foot[2] + (line[2] - foot[2]) * t];
    rope(bench, TEX.rope, [foot, head, [s * holeHalfX, headY, head[2]]], MANROPE.r);
  }
  return { geometry: bench.finish(), bottomZ: zEnd, steps, rise: r, run };
}

/** A rope ladder down her side from the gangway to the water: two side ropes against the hull and the rungs between.
 *  The starboard one (`s` -1 mirrors it to port - the rungs' wood has no hand). */
export function ropeLadderGeometry(s = 1) {
  const bench = new MeshBench();
  const g = MEASURED.gangway, zc = (g.z0 + g.z1) / 2;
  const path = (dz) => [[s * 5.38, g.sillY + 0.15, zc + dz], [s * 5.93, 2.45, zc + dz], [s * 5.93, 0.05, zc + dz]];
  for (const dz of [-0.24, 0.24]) rope(bench, TEX.rope, path(dz), 0.03);
  for (let y = 0.35; y < g.sillY - 0.1; y += 0.34) {
    const x = y > 2.45 ? 5.93 - ((y - 2.45) / (g.sillY + 0.15 - 2.45)) * (5.93 - 5.38) : 5.93;
    box(bench, TEX.trim, [s * (x + 0.04), y, zc], [0.03, 0.025, 0.25], { tile: GALLEON_TILE.trim });
  }
  return bench.finish();
}

// ── the clips ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A hatch cover lifts on its starboard edge and over, to lie on her deck beside the hatchway. AUDIT GN-P9: 2 degrees
 *  short of flat, so the clips' blend (the shortest turn between shut and open) swings it over to starboard and never
 *  back through the hatchway; its hinge (`hatchHingeDrop`) set so turned this far it rests on its battens 2 mm over her
 *  deck, its foot 0.18 m outboard of the hatchway's edge. At -105 it stood up past upright, 2.5 m tall - in the main
 *  gaff boom's sweep (y 7.75), which trimmed 15-30 degrees to starboard passed through the aft cover, and the gaff's
 *  canvas with it. Lying open, with her rig as it stands (03efe519e), a cover is 1.85 m or more from the gaff's boom and
 *  spars and 1.45 from its canvas at every trim to 90 either way, 0.2 m from her running rope at the nearest (the
 *  mainsheet, the gaff squared off to starboard, over the aft cover's after end) and 1.47 from a belay
 *  (test/auditgalleon_prefab.test.js P9). */
export const HATCH_OPEN_DEG = -178;
/** A shutter swings up on its top to stand out from her side, a little short of level - as Mac's stands. */
export const LID_OPEN_DEG = 84;
/** The wheel turns this many times hard over each way, and the rudder this far. */
export const WHEEL_TURNS = 1.25;
export const RUDDER_DEG = 35;

/** The clips and overrides the doors, hatches, shutters and the helm play, over the mod's own controllers. */
export function galleonClips() {
  const clips = {}, overrides = {};
  const pair = (ov, closed, opened) => {
    clips[`${ov} Closed`] = constClip(`${ov} Closed`, [eulerCurve('', closed)]);
    clips[`${ov} Opened`] = constClip(`${ov} Opened`, [eulerCurve('', opened)]);
    overrides[ov] = { base: 'Door Controller', clips: [['Door Closed', `${ov} Closed`], ['Door Opened', `${ov} Opened`]] };
  };
  pair('galleon2/Hatch', [0, 0, 0], [0, 0, HATCH_OPEN_DEG]);
  pair('galleon2/Gunport', [0, 0, 0], [0, 0, LID_OPEN_DEG]);
  // AUDIT GN-G1: the port side's shutters swing the other way about her length - up and out to port
  pair('galleon2/GunportPort', [0, 0, 0], [0, 0, -LID_OPEN_DEG]);
  // the helm: the Rudder Wheel Controller's ten Sailing clips (TurnAngle -1 .. 1, the 0.2 steps the mod's own galleon
  // used), the wheel turned about its axle and the rudder about its post
  const swaps = [];
  for (const [side, sign] of /** @type {const} */ ([['Left', -1], ['Right', 1]])) {
    for (let i = 0; i < 5; i++) {
      const t = sign * (0.2 + 0.2 * i);   // the threshold this clip answers
      const name = `galleon2/Rudder Sailing ${side} ${i}`;
      clips[name] = constClip(name, [eulerCurve('HelmWheel', [0, 0, -t * WHEEL_TURNS * 360]), eulerCurve('HelmRudder', [0, -t * RUDDER_DEG, 0])]);
      swaps.push([`Rudder Wheel Sailing ${side} ${i}`, name]);
    }
  }
  overrides['galleon2/Rudder'] = { base: 'Rudder Wheel Controller', clips: swaps };
  return { clips, overrides };
}

// ── the prefab ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The new galleon as Come Sail Away's data: her prefab tree (component indices into `[...csaComponents, ...components]`),
 * the components she adds, her meshes by key (the CSA geometry shape), and the clips and overrides she adds.
 * @param {any} bake - galleon.json
 * @param {{ prefabs: Record<string, any>, components: any[] }} csa - Come Sail Away's prefabs.json (its galleon's
 *   small things are copied out of hull 2's own tree)
 */
export function galleonPrefab(bake, csa) {
  // SHIPS-2: her bench is the shipwright's kit's (world/shipKit.js prefabBench - every ship's prefab is built on it): a
  // node drawing a geometry, with a MeshCollider over the same triangles when `collider` - or over `colliderGeometry`'s
  // (AUDIT GN-CROWSNEST: a drawing with faces its collider leaves out)
  const { comp, mesh, renderer, meshNode, boxCollider, animator, skinned, finish, meshes } = prefabBench(csa.components.length, 'galleon');
  const cx = { archive: GALLEON_ARCHIVE, mesh, comp, skinned };

  const part = (role) => { const p = bake.parts.find((x) => x.role === role); if (!p) throw new Error(`galleon: the bake has no ${role}`); return p; };
  /** A baked part drawn and solid - AUDIT GN-CROWSNEST: with `extra` faces built onto its drawing (never its collider,
   *  which stays Mac's mesh: the deck's bake reads colliders). */
  const baked = (role, name, extra = null) => {
    const plain = bakedPartGeometry(part(role));
    if (!extra) return meshNode(name, `galleon:${role}`, plain, { collider: true });
    const bench = new MeshBench();
    benchPart(bench, part(role), { offset: [0, 0, 0], role, keep: null });
    extra(bench, part(role));
    return meshNode(name, `galleon:${role}`, bench.finish(), { collider: true, colliderGeometry: plain });
  };
  const old = csa.prefabs[String(GALLEON_PREFAB_ID)];
  const fromOld = (name, at = {}) => {
    const n = clone(findNode(old, name));
    if (!n) throw new Error(`galleon: Come Sail Away's galleon has no ${name}`);
    if (at.p) n.position = [...at.p];
    if (at.r) n.rotation = [...at.r];
    if (at.name) n.name = at.name;
    return n;
  };
  const M = MEASURED;
  const kids = [];

  // ── her own: the board, the triggers before the doors (the walk files a door's trigger under BoardTriggers - kept -
  //    and BoardTriggers[0] is a gangway's) ──
  const g = M.gangway, gz = (g.z0 + g.z1) / 2;
  for (const s of [1, -1]) {
    // the board trigger outside her at the gangway, three metres a side (the mod's scale), its BoardPosition on her
    // deck inside the gap, facing in. AUDIT GN-P4: its inner face at her outer planking (x ±5.90, her side 5.86 at
    // most) - at ±6.6 it stood 0.4-2 cm into her gun deck (her inner planking 5.10-5.12) and filled gunport 2's throat,
    // and a look at her side from the gun deck boarded her (the port's raycast met BoardBoat at 1.5-1.6 m)
    const t = [s * BOARD_X, 2.4, gz];
    const stand = [s * 4.3, M.mainDeckY + 0.05, gz];
    kids.push(nodeOf('BoardTrigger', { p: t, s: [3, 3, 3], kids: [nodeOf('BoardPosition', { p: scl(sub(stand, t), 1 / 3), r: yaw(s > 0 ? -90 : 90), s: [1 / 3, 1 / 3, 1 / 3] })] }));
  }
  kids.push(nodeOf('DriveTrigger', { p: DRIVE_TRIGGER_AT }));   // AUDIT GN2-PF7: over her wheel and its pedestal's collider
  kids.push(nodeOf('DrivePosition', { p: HELM.stand }));

  // ── Mac's model ──
  // the castle, its rail and its parapet draw on their own nodes and stand in the HULL's collider (below): the hull's
  // box is the shots' target (scenes/navalHost.js hullBoxOf - her MeshCollider's bounds), and a ball into her castle
  // strikes her as one into her side does
  for (const [role, name] of [['castle', 'Castle'], ['castleParapet', 'CastleParapet'], ['castleRail', 'CastleRail']]) kids.push(meshNode(name, `galleon:${role}`, bakedPartGeometry(part(role))));
  // AUDIT GN-CROWSNEST: Mac drew his main mast open at its head and his crow's nest's floor one-sided, its bowl open
  // under it round the mast - from below, a ring of sky (about 0.10 m) showed round the masthead through the floor's
  // back. The masthead is capped, the floor given its underside and the bowl's bottom closed here (galleon.json
  // untouched)
  const extras = { mainMast: mastCap, crowsNest: (bench, p) => nestUnderside(bench, p, part('mainMast')) };
  for (const [role, name] of [['gunDeck', 'GunDeck'], ['mainDeck', 'MainDeck'],
    ['bulkhead', 'Bulkhead'], ['stairsPort', 'StairsPort'], ['stairsStarboard', 'StairsStarboard'], ['balustradePort', 'BalustradePort'], ['balustradeStarboard', 'BalustradeStarboard'],
    ['mainMast', 'MainMast'], ['foreMast', 'ForeMast'], ['mainPartner', 'MainPartner'], ['mainStep', 'MainStep'], ['forePartner', 'ForePartner'], ['foreStep', 'ForeStep'],
    ['crowsNest', 'CrowsNest'], ['bowsprit', 'Bowsprit']]) kids.push(baked(role, name, extras[role] ?? null));
  // GALLEON-2: her deck beams, one node over the six (a collider too - nothing aboard reaches them but a ladder's
  // climber's hand)
  const beamParts = bake.parts.filter((x) => x.role === 'deckBeam');
  if (!beamParts.length) throw new Error('galleon: the bake has no deckBeam');
  kids.push(meshNode('DeckBeams', 'galleon:deckBeams', bakedPartGeometry(beamParts), { collider: true }));

  // the hatch covers: Mac's fore cover is both (his aft one he left propped open), each on a hinge at its starboard edge
  const fore = part('hatchFore');
  const fp = pointsOf(fore);
  const fmin = [0, 1, 2].map((k) => Math.min(...fp.map((p) => p[k]))), fmax = [0, 1, 2].map((k) => Math.max(...fp.map((p) => p[k])));
  const cover = { half: [(fmax[0] - fmin[0]) / 2, (fmax[1] - fmin[1]) / 2, (fmax[2] - fmin[2]) / 2] };
  // AUDIT GN-P9: the hinge on the cover's starboard side, as far under its top as lays it on her deck opened
  const drop = hatchHingeDrop(hatchCoverGeometry(cover), fmax[1] - M.mainDeckY);
  const coverGeometry = hatchCoverGeometry(cover, drop);
  const hatch = (name, hole) => {
    const zc = (hole.z0 + hole.z1) / 2 + ((fmin[2] + fmax[2]) / 2 - (M.hatchFore.z0 + M.hatchFore.z1) / 2);
    const hinge = [cover.half[0], fmax[1] - drop, zc];
    return meshNode(name, 'galleon:hatchCover', coverGeometry, { collider: true, p: hinge, c: [animator('galleon2/Hatch')], kids: [nodeOf('DoorTrigger')] });
  };
  // the stairs down each hatchway, built before the covers so a ray down the open hatch meets them
  const aftStairs = companionGeometry(M.hatchAft.z1, -1);
  const foreStairs = companionGeometry(M.hatchFore.z1, -1);
  kids.push(meshNode('CompanionAft', 'galleon:companionAft', aftStairs.geometry, { collider: true }));
  kids.push(meshNode('CompanionFore', 'galleon:companionFore', foreStairs.geometry, { collider: true }));
  kids.push(hatch('HatchAft', M.hatchAft));
  kids.push(hatch('HatchFore', M.hatchFore));

  // the doors in his two doorways, hinged on their port jambs, swinging aft. AUDIT GN2-PF8: each hinged on its leaf's
  // after face (doorLeafGeometry), the shut leaf where it stood - across its doorway's middle - and each leaf's foot a
  // centimetre over the deck it stands on: the castle's doorway runs down under her main deck (6.178, the deck 6.202),
  // and its leaf's foot stood 1.4 cm inside it
  const door = (name, d, floor) => {
    const foot = Math.max(d.y0, floor) + 0.01;
    return meshNode(name, `galleon:door:${name}`, doorLeafGeometry(d.halfX * 2 - 0.04, d.y1 - 0.01 - foot), { collider: true, p: [-d.halfX + 0.02, foot, d.z - DOOR_THICK / 2], c: [animator('Door Controller')], kids: [nodeOf('DoorTrigger')] });
  };
  kids.push(door('CastleDoor', M.castleDoor, M.mainDeckY));
  kids.push(door('BulkheadDoor', M.bulkheadDoor, M.gunDeckY));

  // the shutters and the guns behind them: five ports a side, the port side's shutters the starboard's mirrored.
  // AUDIT GN-P6: a shutter a port, fitted to her side there (LID_FIT), each pair one shape mirrored, hinged on her side
  // at the lintel. AUDIT GN-P10: each node solid - a MeshCollider of its board's two plates from the hinge to the sill
  // (lidGeometry's `collider`), turning with it - where a crouched body (0.9 m, 0.35 round; the sill 0.478 over the gun
  // deck, under a step's 0.5) crawled out through a shut port into the sea. Plates, not a box: no face of them lies
  // level, so her deck's bake (navalDeck.js, every switched-on collider) is cell for cell the bake without them - a
  // box's top was taken for a floor at 3.0 m outside her side
  const lidXh = M.portZ.map((z, i) => {
    for (const [s, suffix] of [[1, ''], [-1, 'Port']]) {
      const lid = lidGeometry(s, LID_FIT[i]);
      mesh(`galleon:gunportLid${suffix}${i}`, lid.geometry);
      mesh(`galleon:gunportLid${suffix}${i}:collider`, colliderOf(lid.collider));
    }
    return lidGeometry(1, LID_FIT[i]).xh;
  });
  mesh('galleon:gun', gunGeometry());
  const lidComps = (key) => [comp({ type: 'MeshFilter', m_Mesh: { mesh: key } }), renderer(meshes[key]), comp({ type: 'MeshCollider', m_Enabled: true, m_IsTrigger: false, m_Convex: false, m_Mesh: { mesh: `${key}:collider` } })];
  for (const [sideName, s] of /** @type {const} */ ([['Starboard', 1], ['Port', -1]])) {
    M.portZ.forEach((z, i) => {
      kids.push(nodeOf(`Gunport${sideName}${i}`, { p: [s * lidXh[i], LID.rows[0], z], c: [...lidComps(s > 0 ? `galleon:gunportLid${i}` : `galleon:gunportLidPort${i}`), animator(s > 0 ? 'galleon2/Gunport' : 'galleon2/GunportPort')] }));
      kids.push(nodeOf(`Gun${sideName}${i}`, { p: [s * GUN.runInX, M.gunDeckY, z], r: yaw(s > 0 ? 0 : 180), c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'galleon:gun' } }), renderer(meshes['galleon:gun']), boxCollider([-0.05, 0.55, 0], [1.25, 1.1, 0.8])] }));
    });
  }
  // the bow chasers on their swivels over her rail
  mesh('galleon:chaser', chaserGeometry(GUN.chaserY - M.mainDeckY));
  for (const [i, m] of GALLEON_BATTERIES.bow.entries()) {
    kids.push(nodeOf(`BowChaser${i}`, { p: [m[0], M.mainDeckY, m[2] - 0.95], c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'galleon:chaser' } }), renderer(meshes['galleon:chaser'])] }));
  }

  // the helm: its pedestal (still), and the RudderObject the mod's Rudder Wheel Controller turns - the wheel on its
  // axle and the rudder on its post, both its children
  kids.push(meshNode('HelmPedestal', 'galleon:helmPedestal', helmPedestalGeometry(), { c: [boxCollider([0, M.castleRoofY + 0.6, HELM.hub[2] + 0.42], [0.6, 1.2, 0.5])] }));
  mesh('galleon:wheel', wheelGeometry());
  // AUDIT GN-P8: the blade hangs on her sternpost and turns there, cut RUDDER_CLEAR abaft it and closed at its front.
  // Pivoted at its own open front 0.62 m inside her stern, at 35 degrees it swung 0.355 m sideways through her stern
  // planking, its hollow front opening as it went
  const rudderPart = rudderBlade(part('rudder'), M.rudderPivotZ - RUDDER_CLEAR);
  const rudderPivot = [0, 0, M.rudderPivotZ];
  mesh('galleon:rudder', bakedPartGeometry(rudderPart, { offset: rudderPivot }));
  kids.push(nodeOf('RudderObject', {
    c: [animator('galleon2/Rudder')],
    kids: [
      nodeOf('HelmWheel', { p: HELM.hub, c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'galleon:wheel' } }), renderer(meshes['galleon:wheel'])] }),
      nodeOf('HelmRudder', { p: rudderPivot, c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'galleon:rudder' } }), renderer(meshes['galleon:rudder'])] }),
    ],
  }));

  // the rig
  const rig = buildRig(cx);
  kids.push(...rig.kids);

  // ── Come Sail Away's own small things, stood in her ──
  const D = M.mainDeckY, G = M.gunDeckY, R = M.castleRoofY;
  kids.push(nodeOf('ActiveObject', { kids: [fromOld('GalleonAnchor', { p: ANCHOR.weighed, r: yaw(ANCHOR.yawDeg) })] }));
  kids.push(nodeOf('IdleObject', { kids: [
    fromOld('GalleonAnchorDeployed', { p: ANCHOR.letGo, r: yaw(ANCHOR.yawDeg) }),
    meshNode('RopeLadderStarboard', 'galleon:ladderStarboard', ropeLadderGeometry(1)),
    meshNode('RopeLadderPort', 'galleon:ladderPort', ropeLadderGeometry(-1)),
  ] }));
  // the crew, by the posts the mod's galleon gave them (and its triggers under the four that carry one)
  const crew = (name, flat, at, trigger = null) => nodeOf(name, { p: at, kids: [nodeOf(`BillboardHelper-${flat}:1`), ...(trigger ? [nodeOf(trigger, { p: [0, 1, 0] })] : [])] });
  kids.push(crew('OfficerStanding1', '182_025', [2.1, R, -16.6], 'StatusTrigger'));
  kids.push(crew('Coxswain', '346_006', [-2.1, R, -16.7], 'PositionTrigger'));
  kids.push(crew('Boatswain', '182_035', [-2.6, D, 2.3], 'VariantTrigger'));
  kids.push(crew('Quartermaster', '182_020', [-2.3, D, 7.3], 'CargoTrigger'));
  kids.push(crew('Master-At-Arms', '183_004', [2.4, G, -1.9]));
  kids.push(crew('Cook', '182_008', [-1.6, G, 10.6]));
  kids.push(fromOld('GalleonCargo', { p: [-3.3, D, 6.6], r: yaw(-20) }));
  // AUDIT GN-STOVE: her stove's cowl carried up to STOVE.headGap under her deckhead, as the mod's galleon's ends under
  // its own (0.136 m) - an iron flue run up from the stove's stack to it. It stood where the mod's stove sets it, its
  // top at 4.019, 1.92 m under her deckhead (5.943): her gun deck is 4.86 m tall where the mod's lower deck was 3.09
  const stove = fromOld('Stove', { p: [-3.1, G, 11.4], r: yaw(45) });
  const cowl = findNode(stove, 'StovePipe');
  if (!cowl) throw new Error('galleon: Come Sail Away\'s stove has no StovePipe');
  const raise = M.mainDeckUnderY - STOVE.headGap - (G + cowl.position[1] + STOVE.cowlTop);
  stove.children.push(meshNode('StoveFlue', 'galleon:stoveFlue', stoveFlueGeometry([cowl.position[0], cowl.position[1], cowl.position[2]], raise + STOVE.seat)));
  cowl.position = [cowl.position[0], cowl.position[1] + raise, cowl.position[2]];
  kids.push(stove);
  // the bed in the great cabin under the castle's roof. AUDIT GN-P12: stood BED_OVER_DECK over her deck, the mod's own
  // galleon's offset for the same bed (its BedObject 0.262 m over its deck there; its trireme's 0.261) - the bed model
  // (ARCH3D 41000, Daggerfall's) is not in the repository to measure, so the mod's own stand is the one followed; at
  // her deck the bed sank that much into the cabin's floor
  kids.push(nodeOf('BedObject', { p: [3.55, D + BED_OVER_DECK, -16.2], r: yaw(-90) }));
  // the lanterns: two on the stern rail and the great one at her taffrail, two flanking the castle's door, three
  // hanging in the gun deck - from her beams (GALLEON-2: the second, third and fifth, aft to fore) - and one in the cabin
  const lanternFlat = () => nodeOf('BillboardHelper-210_027:2');
  const pole = clone(findNode(old, 'LanternHookStandPoleShort'));
  // AUDIT GN-P5: each pole stands ON the stern rail's cap, as the mod's galleon stands its two on its stern rail's top
  // at its quarters (their feet 0.5 cm over it) - here 0.3 cm over hers, the cap 0.36-0.40 m across (fore and aft)
  // where they stand and a pole's foot 0.1 m - its lantern hung 0.84 m over the cap. They stood on her roof at -18.7,
  // in the rail (45 and 37 of their 51 vertices inside it, the pole never showing over it), their lanterns 1.2 cm off
  // its inner face.
  for (const s of [-1, 1]) kids.push({ ...clone(pole), position: [s * 2.35, M.railCapY + 0.003, -18.7], rotation: yaw(s * -150) });
  const stand = fromOld('LanternHookStandPlank', { p: [0, R, -19.05], r: yaw(180), name: 'LanternHookStandTaffrail' });
  kids.push(stand);
  const hook = clone(findNode(old, 'LanternHook'));
  for (const s of [-1, 1]) kids.push({ ...clone(hook), name: s < 0 ? 'LanternHookDoorPort' : 'LanternHookDoorStarboard', position: [s * 1.45, M.castleDoor.y1 + 0.2, M.castleFrontZ + 0.02], rotation: yaw(180) });
  for (const [i, k] of [1, 2, 4].entries()) kids.push(nodeOf(i ? `LanternHanging (${i})` : 'LanternHanging', { p: [0, M.beams.underY - 0.01, M.beams.z[k]], kids: [lanternFlat()] }));
  kids.push(nodeOf('LanternHanging (3)', { p: [0, M.castleCeilingY - 0.05, -15.4], kids: [lanternFlat()] }));
  // her colours over the crow's nest, on the flagstaff the rig stands there
  kids.push(fromOld('FlagObject', { p: [0, RIG.nestTopY + 1.45, RIG.mainZ + 0.05] }));

  // her hull: the node the boat's frame is, every other part under it - its collider her hull's planking and her
  // castle's, one mesh (the first MeshCollider of the tree: Boat.MeshCollider, whose box SpawnBoat stands her five
  // nodes off and the sea fight aims at)
  const hullGeometry = bakedPartGeometry(part('hull'));
  // (her castle's there but for the ramps its stair wells slope down under her two flights: the treads stand on them,
  // and at a flight's head the ramp rose through the top tread to meet her roof - 2.3 cm over it, the roof at 11.018
  // and the tread at 10.995 (AUDIT GN-NITS: this said 4 cm) - a roof over it to the walk, the flight cut short of her
  // castle's top: systems/naval/navalDeck.js)
  const castleSolid = bakedPartGeometry(part('castle'), { keep: (n) => !(n[1] > WELL_RAMP_NY[0] && n[1] < WELL_RAMP_NY[1]) });
  mesh('galleon:hull:collider', colliderOf(mergeGeometries([hullGeometry, castleSolid, meshes['galleon:castleRail'], meshes['galleon:castleParapet']])));
  const hull = meshNode(GALLEON_HULL_NODE, 'galleon:hull', hullGeometry, { kids, c: [comp({ type: 'MeshCollider', m_Enabled: true, m_IsTrigger: false, m_Convex: false, m_Mesh: { mesh: 'galleon:hull:collider' } })] });
  const root = nodeOf(String(GALLEON_PREFAB_ID), { kids: [
    fromOld('WakeObject', { p: [0, 0.1, 2.2] }),
    hull,
    fromOld('Modifiers'),
  ] });

  // ── the skinned renderers' bones, now the tree's paths are known ──
  const { components } = finish(root);

  const own = galleonClips();
  return {
    prefab: root, components, meshes,
    animation: { clips: { ...own.clips, ...rig.clips }, overrides: { ...own.overrides, ...rig.overrides } },
  };
}

/** Several geometries as one (their triangles, re-indexed; their sub-meshes run together - a collider's read). */
export function mergeGeometries(list) {
  const geos = list.filter(Boolean);
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.vertexCount; ni += g.indices.length; }
  const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), indices = new Uint32Array(ni);
  let v = 0, i = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const g of geos) {
    positions.set(g.positions, v * 3); normals.set(g.normals, v * 3); uvs.set(g.uvs, v * 2);
    for (let k = 0; k < g.indices.length; k++) indices[i + k] = g.indices[k] + v;
    for (let k = 0; k < g.positions.length; k += 3) for (let d = 0; d < 3; d++) { const x = g.positions[k + d]; if (x < min[d]) min[d] = x; if (x > max[d]) max[d] = x; }
    v += g.vertexCount; i += g.indices.length;
  }
  return { vertexCount: nv, positions, normals, uvs, indices, subMeshes: [{ startIndex: 0, primitiveCount: ni / 3 }], slots: [], blendIndices: null, bindPoses: null,
    aabb: { center: [0, 1, 2].map((d) => (min[d] + max[d]) / 2), extent: [0, 1, 2].map((d) => (max[d] - min[d]) / 2) } };
}

export { len };
