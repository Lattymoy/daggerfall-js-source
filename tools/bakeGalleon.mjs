// THE NEW GALLEON'S MODEL, BAKED OUT OF MAC'S BLENDER SCENE.
//
//     node tools/bakeGalleon.mjs [--fbx=src/assets/galleon/source/New_Ship.fbx]
//                                [--out=src/assets/galleon/galleon.json] [--list]
//
// AUDIT GN2-BK4: --fbx and --out are read from where it runs, their defaults
// the repo's own; the file records the FBX it baked (`source`, its path in the
// repo when it lies there).
//
// GALLEON (2026-10-01, Mac: "So this model is to replace the current ingame
// gallon model. The doors/hatches should open and close and we will need to
// give this a proper texture, along with a wheel at the helm, the sails and
// ropes, and ensuring cannon fire shoots from the cannon holes properly").
//
// Mac sent three exports - New_Ship.fbx, New_Ship_Access_Hatch.fbx and
// New_Ship_Window_Shutters.fbx - and they are ONE SCENE three times: every
// node of the three trees reads the same but the header's creation stamp
// (measured, node for node). So one is committed, and the hatch and the
// shutter are read out of it by their own objects (`ROLES` below).
//
// GALLEON-2 (2026-10-02, Mac: "Replace it with this updated model"):
// New_Ship_Even_EVEN_newer.fbx, committed over New_Ship.fbx. Read against
// the first, part for part: the ship stands 36.25 m along the scene's Y
// (FRAME.centreline - she was on Y 0). Her hull is reshaped (95 faces where
// it was 87) - AUDIT GN-B7, measured: a deeper V bottom on a keel 1.08 m
// lower in the scene (0.75 m in her frame, -3.89 to -4.64), a finer entry
// and a forefoot swept up to the stem, and at the bow the wale's two
// forward corners (scene X 21.21) drawn in from 8.37 m off her centreline
// to 7.48 m - corners her upper sides share with her lower ones, so both
// changed, and both now lean out of their own planes (step 2). Six deck
// beams carry her main deck over the gun deck (`deckBeam`); every other
// part is the first's, moved with her, to 3 micrometres. The scene also
// keeps a TWIN of most parts standing in the same place (Shift+D, never
// moved - checked vertex for vertex, `SKIP` twin) and working stations far
// along Y (`SKIP` minY, each said for what it is).
//
// tools/fbxRead.mjs is the reader and tools/fbxMesh.mjs's helpers do the
// polygon work; this is the bake for a SCENE OF PARTS rather than one mesh.
// It does three things and nothing else, and leaves everything that is art
// (which face wears which texture, how a texture lies on it, what a part is
// hung from) to src/world/galleonModel.js, where a test can read it:
//
// 1. EACH OBJECT INTO THE BOAT'S FRAME. A Blender export carries its axis
//    conversion on every object (Lcl Rotation -90 about X, Lcl Scaling 100,
//    UnitScaleFactor 1 - centimetres), so the object's own T*R*S is applied
//    and the file's GlobalSettings (`sceneFrame`) take the result back to
//    Mac's Z-up scene in metres, where the ship's bow is +X and her port side
//    +Y. Come Sail Away's hulls - and so the port's boats - stand in Unity's
//    frame: +x starboard, +y up, +z the bow, the root on the waterline
//    (systems/naval/navalShips.js's header). So a scene point (X, Y, Z) is
//    the boat's ( CENTRELINE - Y, Z - WATERLINE, X - MIDSHIP ) times SCALE
//    (CENTRELINE her keel line's Y - her hull object's own): a mirror,
//    which is why every polygon's corners are REVERSED on the way through -
//    Blender's front is counter-clockwise in a right-handed frame and the
//    port's is clockwise in Unity's (renderer.js frontFace(CW)), so the
//    reversal keeps each face's front its front.
//
//    AUDIT GN-B5: WHAT IT CANNOT READ, IT REFUSES BY NAME - never bakes
//    wrong: a file whose GlobalSettings are not this export's axes
//    (EXPORT_AXES), an object parented under another, one carrying a
//    pre/post rotation, a pivot, a rotation or scaling OFFSET or a
//    geometric transform (the bake reads T*R*S only), one MIRRORED by its
//    own transform (a negative determinant: every face of it would bake
//    inside out), and one not standing where it was read (`ROLES`' boxes).
//
//    THE FRAME IS CHOSEN, AND SAID (AUDIT GN-B7: every number measured on
//    this export): SCALE 0.7 makes her 43.8 m from her stem head to her
//    rudder (the bowsprit apart), the length of the galleon she replaces
//    (Come Sail Away's hull 2, 44.1 m - every number the sea fight measured
//    against that hull keeps its sense), and stands her gun deck 4.86 m
//    under her main deck's planking (Mac's scene: 6.94 m). WATERLINE 3
//    (scene metres) puts her keel 4.64 m under the sea - the first
//    export's 3.89, the mod's galleon drew 3.35 - her gun deck 1.08 m and
//    her port sills 1.56 m over it. MIDSHIP 2.7 is the middle of those
//    43.8 m (to 2 cm), so she pivots where she is longest. CENTRELINE
//    (AUDIT GN-B6) is her hull object's own scene Y, to the bit - the bake
//    refuses a hull whose origin is not on it - so a vertex Mac mirrored
//    across her bakes to the same |x| either side.
//
// 2. EACH POLYGON CUT INTO TRIANGLES AS BLENDER CUTS IT (AUDIT GN-B1; GN-B4
//    this account, where the last one called its own fill Blender's):
//    tools/fbxMesh.mjs blenderTessellate, Blender's own tessellation
//    ported - a triangle kept, a quad split on the diagonal Blender
//    takes, an n-gon filled by BLI_polyfill_calc in the plane of its
//    Newell normal, all in single precision - AUDIT GN2-BK1: as Blender
//    5.1 cuts it, the Blender Mac exports from (the first port was 5.0's,
//    whose fill cut two of her hull's 24-gons otherwise), and an export
//    any other Blender wrote is refused by name (assertBlenderFill: its
//    fill may not be the port's) - on each polygon as Blender
//    holds it (the mesh's own coordinates, its corners in their own order),
//    the triangles then carried through the mirror as the polygon is.
//    Blender draws a face by its triangles, and a face that is not planar
//    is a different surface under a different cut: since GALLEON-2 her
//    hull's sides lean up to 0.55 m out of their own planes, and the ear
//    clip this bake used to run (an axis dropped, the lowest-index ear
//    first) cut her two lower sides unlike each other - a 22 m wedge 65
//    degrees off her starboard side that her port side lacked, the two
//    half a metre apart in shape - and folded a fin under her port quarter.
//    Blender's cut lays that wedge on BOTH sides (it is how his side, bent
//    at the bow, is drawn), and they stand within 3.3 cm of each other's
//    mirror. Blender itself cuts five of her hull's faces unlike their
//    mirror images - her stern quarters (0.36 m apart) and four quads: Mac
//    drew each the mirror of its partner, but their corners start
//    elsewhere - and the bake keeps that too, as he sees it (pinned in
//    test/auditgalleon_bake.test.js). A polygon
//    its triangles do not TILE is refused by object and number, never
//    patched (tools/fbxMesh.mjs tilingFault: every triangle wound with its
//    face, their areas its area to 1e-6, no part of its plane covered more
//    or fewer times than the face winds about it) - so the bake makes no
//    point and no triangle of its own. Where Mac drew three corners on one
//    line (a gunport's sill, a lintel, the fold of her port inner planking,
//    #76), Blender's fill can cut a triangle of no area along it: it is
//    kept, as Blender keeps it, and draws nothing (world/galleonMesh.js
//    MeshBench drops a triangle of no area). The polygons are kept as well,
//    since a face's texture is chosen per polygon.
//
// 3. THE RUDDER OUT OF THE HULL. Mac modelled it into the hull's own mesh
//    (five faces aft of the sternpost); it turns, so it is its own part.
//
// The output is a JSON a test re-bakes byte for byte
// (test/galleon_model.test.js): the source is committed beside it, so the
// file is a DERIVATION, never a blob.
//
// SHIPS-2 (2026-10-07): the reading, the cut and the refusals are every ship's now - tools/shipBake.mjs, the bake for
// a scene of parts, moved out of this file word for word; this is the galleon's spec over it (her frame, roles,
// skips and rudder) and her command line, and it answers every name it always answered.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readFbx } from './fbxRead.mjs';
import { bakeScene, bakePart, bakeJson, toBoat as sceneToBoat, listScene, sourcePath, ROOT } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';
export { EXPORT_AXES, BOX_SLACK, round4, sceneObjects, fillFace, sourcePath } from './shipBake.mjs';

export const SOURCE_FBX = 'src/assets/galleon/source/New_Ship.fbx';
export const OUT = 'src/assets/galleon/galleon.json';

/** The boat's frame, from Mac's scene (metres, Z up, bow +X). GALLEON-2: `centreline` the scene Y of her keel line,
 *  where the first export stood her on Y 0. AUDIT GN-B6: it is her hull object's own placement, exactly - Lcl
 *  Translation Z -3624.673828125 cm through the file's frame (FBX -Z is the scene's Y, a centimetre a hundredth) - not
 *  her beam halved to 0.1 mm (36.2467, 38 um to starboard of it, split mirror pairs' |x| at the bake's last digit). */
export const FRAME = Object.freeze({ scale: 0.7, waterline: 3, midship: 2.7, centreline: 36.24673828125 });

/**
 * Each of the scene's objects, by the role it plays aboard. Read off the
 * scene itself (tools/bakeGalleon.mjs --list prints every object's box):
 * the names are Blender's defaults, so each role ALSO states where its
 * object stands. AUDIT GN-B5: as its whole scene `box` ([min, max], metres,
 * to the millimetre, read off this export) - BOX_SLACK (2 cm) out in any
 * coordinate and the bake refuses it by name: a re-export that renamed,
 * moved or reshaped one never ships a stair as a hatch (the old test was a
 * point inside the box, which let a gun deck slide 5 cm and a deck beam 59).
 */
export const ROLES = Object.freeze({
  Cube: Object.freeze({ role: 'hull', box: [[-28.597, 27.878, -3.634], [34.033, 44.616, 13.367]] }),
  'Cube.001': Object.freeze({ role: 'gunDeck', box: [[-23.233, 28.924, 4.547], [31.592, 43.569, 4.547]] }),
  'Cube.002': Object.freeze({ role: 'mainDeck', box: [[-24.532, 28.657, 11.486], [32.581, 43.837, 11.86]] }),
  'Cube.003': Object.freeze({ role: 'hatchAft', box: [[-6.283, 34.167, 11.925], [-1.439, 37.403, 14.207]] }),
  'Cube.004': Object.freeze({ role: 'hatchFore', box: [[6.913, 34.456, 11.701], [11.757, 38.038, 12.111]] }),
  'Cube.005': Object.freeze({ role: 'castle', box: [[-25.736, 28.652, 11.172], [-12.009, 43.854, 18.74]] }),
  'Cube.006': Object.freeze({ role: 'castleParapet', box: [[-18.434, 31.642, 18.567], [-12.121, 40.867, 19.797]] }),
  'Cube.007': Object.freeze({ role: 'bulkhead', box: [[-12.126, 28.788, 3.959], [-11.498, 43.705, 11.612]] }),
  'Cube.008': Object.freeze({ role: 'stairsStarboard', box: [[-18.272, 29.466, 11.596], [-7.926, 31.507, 18.707]] }),
  'Cube.009': Object.freeze({ role: 'balustradePort', box: [[-14.12, 43.587, 10.114], [-3.083, 43.81, 17.037]] }),
  'Cube.010': Object.freeze({ role: 'stairsPort', box: [[-18.272, 41.027, 11.596], [-7.926, 43.067, 18.707]] }),
  'Cube.011': Object.freeze({ role: 'gunportLid', box: [[-4.215, 44.421, 7.037], [-2.971, 46.646, 7.385]] }),
  // GALLEON-2: the deck beams, aft to fore - one role, six objects (galleonModel.js draws them as one)
  'Cube.019': Object.freeze({ role: 'deckBeam', box: [[-16.22, 28.991, 10.458], [-15.114, 43.503, 11.565]] }),
  'Cube.013': Object.freeze({ role: 'deckBeam', box: [[-7.727, 28.991, 10.458], [-6.621, 43.503, 11.565]] }),
  'Cube.012': Object.freeze({ role: 'deckBeam', box: [[-0.553, 28.991, 10.458], [0.553, 43.503, 11.565]] }),
  'Cube.018': Object.freeze({ role: 'deckBeam', box: [[5.301, 28.991, 10.458], [6.408, 43.503, 11.565]] }),
  'Cube.017': Object.freeze({ role: 'deckBeam', box: [[12.299, 28.991, 10.458], [13.405, 43.503, 11.565]] }),
  'Cube.016': Object.freeze({ role: 'deckBeam', box: [[17.102, 28.991, 10.458], [18.209, 43.503, 11.565]] }),
  'Cube.014': Object.freeze({ role: 'balustradeStarboard', box: [[-14.12, 28.684, 10.114], [-3.083, 28.907, 17.037]] }),
  'Cube.015': Object.freeze({ role: 'castleRail', box: [[-25.709, 28.661, 18.567], [-12.345, 43.793, 20.567]] }),
  Cylinder: Object.freeze({ role: 'bowsprit', box: [[32.218, 35.605, 12.134], [42.484, 36.887, 16.067]] }),
  'Cylinder.001': Object.freeze({ role: 'mainMast', box: [[1.617, 35.296, 4.102], [3.427, 37.198, 29.69]] }),
  'Cylinder.002': Object.freeze({ role: 'foreMast', box: [[14.422, 35.296, 4.102], [16.232, 37.198, 27.198]] }),
  'Cylinder.003': Object.freeze({ role: 'mainPartner', box: [[0.901, 34.455, 11.615], [4.312, 38.04, 12.839]] }),
  'Cylinder.004': Object.freeze({ role: 'mainStep', box: [[0.901, 34.455, 4.271], [4.312, 38.04, 6.416]] }),
  'Cylinder.005': Object.freeze({ role: 'foreStep', box: [[13.659, 34.455, 4.271], [17.071, 38.04, 6.416]] }),
  'Cylinder.006': Object.freeze({ role: 'forePartner', box: [[13.659, 34.455, 11.615], [17.071, 38.04, 12.839]] }),
  'Cylinder.007': Object.freeze({ role: 'crowsNest', box: [[0.111, 33.528, 28.901], [5.287, 38.968, 31.255]] }),
});
/** What the scene keeps and she never wears, each checked to be what it is said to be - so a real part is never
 *  dropped by its name:
 *  - `minY`: a working STATION, wholly beyond that scene Y. AUDIT GN-B7, each read face for face against the parts:
 *    Cube.022 the FIRST export's ship joined into one object (its hull the first's, her fore hatch cover with it, no
 *    aft cover, lid or beams); Cube.038 a hull BETWEEN the two exports' (79 of her 95 faces, 4 of the first's, 8 of
 *    neither) with her other parts and her beams, no hatch cover or lid; Cube.029 her current parts joined TWICE OVER
 *    (every face of them twice, in place), no hatch cover or lid; and Cube.020, .021 and .023, a spare aft and fore
 *    hatch cover and gunport lid standing beside Cube.038;
 *  - `twin`: GALLEON-2, a part's copy standing IN its place (a Shift+D never moved), the same corners and faces as
 *    the part it names to the micrometre - its materials' names apart. */
export const SKIP = Object.freeze({
  'Cube.020': Object.freeze({ minY: 60 }), 'Cube.021': Object.freeze({ minY: 60 }), 'Cube.022': Object.freeze({ minY: 60 }),
  'Cube.023': Object.freeze({ minY: 60 }), 'Cube.029': Object.freeze({ minY: 60 }), 'Cube.038': Object.freeze({ minY: 60 }),
  'Cube.044': Object.freeze({ twin: 'Cube' }), 'Cube.043': Object.freeze({ twin: 'Cube.001' }), 'Cube.042': Object.freeze({ twin: 'Cube.002' }),
  'Cube.041': Object.freeze({ twin: 'Cube.005' }), 'Cube.040': Object.freeze({ twin: 'Cube.006' }), 'Cube.039': Object.freeze({ twin: 'Cube.007' }),
  'Cube.035': Object.freeze({ twin: 'Cube.008' }), 'Cube.034': Object.freeze({ twin: 'Cube.009' }), 'Cube.033': Object.freeze({ twin: 'Cube.010' }),
  'Cube.032': Object.freeze({ twin: 'Cube.012' }), 'Cube.031': Object.freeze({ twin: 'Cube.013' }), 'Cube.030': Object.freeze({ twin: 'Cube.014' }),
  'Cube.028': Object.freeze({ twin: 'Cube.015' }), 'Cube.027': Object.freeze({ twin: 'Cube.016' }), 'Cube.026': Object.freeze({ twin: 'Cube.017' }),
  'Cube.025': Object.freeze({ twin: 'Cube.018' }), 'Cube.024': Object.freeze({ twin: 'Cube.019' }),
  'Cylinder.015': Object.freeze({ twin: 'Cylinder' }), 'Cylinder.014': Object.freeze({ twin: 'Cylinder.001' }),
  'Cylinder.013': Object.freeze({ twin: 'Cylinder.002' }), 'Cylinder.012': Object.freeze({ twin: 'Cylinder.003' }),
  'Cylinder.011': Object.freeze({ twin: 'Cylinder.004' }), 'Cylinder.010': Object.freeze({ twin: 'Cylinder.005' }),
  'Cylinder.009': Object.freeze({ twin: 'Cylinder.006' }), 'Cylinder.008': Object.freeze({ twin: 'Cylinder.007' }),
});
/** The rudder's faces in the hull's mesh: aft of the sternpost, within this half-thickness of the centreline. */
export const RUDDER = Object.freeze({ aftOf: -23.3, halfThickness: 0.2 });

/** The galleon's spec for tools/shipBake.mjs bakeScene: her frame, her roles and skips, and her rudder cut out of her
 *  hull (`cut`). */
export const GALLEON_SPEC = Object.freeze({
  bake: 'tools/bakeGalleon.mjs', source: SOURCE_FBX, frame: FRAME, roles: ROLES, skip: SKIP, hull: 'hull',
  cut(o, all) {
    const rudder = all.filter((k) => o.polygons[k].every((vi) => o.scene[vi][0] < RUDDER.aftOf && Math.abs(o.scene[vi][1] - FRAME.centreline) <= RUDDER.halfThickness));
    if (rudder.length !== 5) throw new Error(`the hull's rudder was five faces aft of ${RUDDER.aftOf} and ${rudder.length} were found`);
    return [bakePart('hull', o, all.filter((k) => !rudder.includes(k)), FRAME), bakePart('rudder', o, rudder, FRAME)];
  },
});

/** A scene point (metres, Z up, bow +X) in the boat's frame - hers unless another is given. */
export const toBoat = (p, frame = FRAME) => sceneToBoat(p, frame);

/** The bake: the FBX's bytes in, the galleon's parts out. Pure. `tree` is the bytes parsed - a test hands in one it
 *  has changed, to see the bake refuse it; `source` the FBX's path as the file records it (AUDIT GN2-BK4). */
export const bakeGalleon = (fbxBytes, tree = readFbx(fbxBytes), source = SOURCE_FBX) => bakeScene(fbxBytes, GALLEON_SPEC, tree, source);

/** The bake as the file holds it: one part a line, so a re-bake that moves a part is one line of the diff. */
export const galleonJson = bakeJson;

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  // AUDIT GN2-BK4: given paths read from where it runs; the defaults the repo's own, from anywhere
  const fbx = resolve(opt('fbx', resolve(ROOT, SOURCE_FBX)));
  const out = resolve(opt('out', resolve(ROOT, OUT)));
  const bytes = readFileSync(fbx);
  if (args.includes('--list')) {
    // AUDIT GN-B5: the box as ROLES records it, to the millimetre
    for (const line of listScene(bytes, GALLEON_SPEC)) console.log(line);
  } else {
    const baked = bakeGalleon(bytes, readFbx(bytes), sourcePath(fbx));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, galleonJson(baked));
    console.log(`${fbx} -> ${out}`);
    for (const p of baked.parts) console.log(`  ${p.role.padEnd(20)} ${p.object.padEnd(14)} ${String(p.positions.length / 3).padStart(4)} vertices ${String(p.polygons.length).padStart(3)} polygons ${String(p.triangles.length / 3).padStart(4)} triangles${p.split ? ` (${p.split} cut)` : ''}`);
  }
}
