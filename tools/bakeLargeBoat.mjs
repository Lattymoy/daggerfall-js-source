// THE NEW LARGE BOAT'S MODEL, BAKED OUT OF MAC'S BLENDER SCENE.
//
//     node tools/bakeLargeBoat.mjs [--fbx=src/assets/ships/source/Tiny_Ship.fbx]
//                                  [--out=src/assets/ships/largeBoat.json] [--list]
//
// SHIPS-2 (2026-10-07, Mac, sending Tiny_Ship.fbx with New Ship 2: "implement both of these new ship placement models,
// UV Map/Texture, and ensure it matches the love we gave the other new ship model we implemented"): the TINY SHIP, which
// stands in for Come Sail Away's hull 1, the Large Boat (the mod's `OldSkiffHull` - world/largeBoatModel.js). The scene
// and why this file is the one committed: tools/bakeCarrack.mjs's header.
//
// HER PARTS (`ROLES`): an open boat - her hull a double skin (her outer planking and her ceiling inside it, met at her
// gunwale's cap, the ceiling open at its foot under her deck), her deck, one mast with its collar where it passes the
// deck (`mastStep`), a bowsprit, and a rail round her stern (`sternRail`). No rudder, no tiller, no cabin, no gunport:
// those she is given (world/largeBoatModel.js). Her deck, mast and bowsprit stand on the scene's Y -10.067 and her
// hull's origin on -10.091: her centreline is the hull's (AUDIT GN-B6's law), so her mast stands 1.7 cm to port of it -
// as Mac drew it, and the rig stands on the mast's own axis.
//
// EVERYTHING ELSE IN THE SCENE IS ANOTHER STATION'S (`SKIP`): New Ship 2 and the galleon's twins, her own joined copy
// (Cube.012, Y -33.5 - the hull, deck, mast, collar, bowsprit and rail run together), the working copies far along Y,
// and Cube.055, which has no faces.
//
// HER FRAME (`FRAME`): SCALE 0.72 makes her 12.48 m from her stem to her transom (the bowsprit apart) - the Large Boat
// she replaces (Come Sail Away's hull 1, 12.50 m by its collider); WATERLINE 1.6 (scene metres) puts her keel 0.615 m
// under the sea (the mod's skiff's 0.64), her deck 0.90 m over it and her gunwale 2.25; MIDSHIP 6.24 the middle of her
// length (to 0.3 cm); CENTRELINE her hull object's own scene Y, to the bit.
//
// The output is a JSON a test re-bakes byte for byte (test/ships2_bake.test.js).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readFbx } from './fbxRead.mjs';
import { bakeScene, bakeJson, listScene, sourcePath, ROOT } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';
import { SOURCE_FBX as SCENE_FBX } from './bakeCarrack.mjs';

export const SOURCE_FBX = SCENE_FBX;
export const OUT = 'src/assets/ships/largeBoat.json';

/** Her frame in Mac's scene (metres, Z up, bow +X): `centreline` her hull object's own scene Y (AUDIT GN-B6). */
export const FRAME = Object.freeze({ scale: 0.72, waterline: 1.6, midship: 6.24, centreline: -10.091069946289062 });

/** Her band of the scene: every part of hers stands within these scene Y, and every other object wholly outside. */
export const BAND = Object.freeze([-14, -6]);

const role = (r, box) => Object.freeze({ role: r, box });
/** Each of her objects by the role it plays aboard, and the scene box it was read standing in (`--list`). */
export const ROLES = Object.freeze({
  'Cube.009': role('hull', [[-2.431, -12.906, 0.746], [14.906, -7.276, 4.723]]),
  'Cube.053': role('deck', [[-1.893, -12.776, 2.854], [13.678, -7.359, 2.854]]),
  'Cube.045': role('sternRail', [[-1.951, -12.651, 4.603], [1.869, -7.499, 5.203]]),
  'Cylinder.026': role('mast', [[5.178, -10.419, 2.727], [5.692, -9.715, 10.415]]),
  'Cylinder.027': role('mastStep', [[4.961, -10.73, 2.775], [5.93, -9.404, 3.384]]),
  'Cylinder.030': role('bowsprit', [[13.856, -10.305, 4.33], [16.772, -9.831, 5.447]]),
});

/** What the scene keeps and she never wears, each checked to be what it is said to be (tools/bakeCarrack.mjs SKIP's
 *  kinds): every other object wholly outside her band, and Cube.055, which has no faces. */
const off = Object.freeze({ band: true });
export const SKIP = Object.freeze(Object.fromEntries([
  ...['Cube', 'Cube.001', 'Cube.002', 'Cube.005', 'Cube.006', 'Cube.007', 'Cube.008', 'Cube.013', 'Cube.014', 'Cube.016', 'Cube.017',
    'Cube.018', 'Cube.019', 'Cube.036', 'Cube.037', 'Cylinder.001', 'Cylinder.002', 'Cylinder.003', 'Cylinder.004', 'Cylinder.005',
    'Cylinder.006', 'Cylinder.007', 'Cylinder.016', 'Cylinder.017', 'Cylinder.018', 'Cylinder.019',
    'Cube.003', 'Cube.004', 'Cube.011', 'Cube.024', 'Cube.025', 'Cube.026', 'Cube.027', 'Cube.028', 'Cube.030', 'Cube.031',
    'Cube.032', 'Cube.033', 'Cube.034', 'Cube.035', 'Cube.039', 'Cube.040', 'Cube.041', 'Cube.042', 'Cube.043', 'Cube.044',
    'Cylinder.008', 'Cylinder.009', 'Cylinder.010', 'Cylinder.011', 'Cylinder.012', 'Cylinder.013', 'Cylinder.014', 'Cylinder.015',
    'Cube.012', 'Cube.020', 'Cube.021', 'Cube.022', 'Cube.023', 'Cube.029', 'Cube.038', 'Cube.051'].map((n) => [n, off]),
  ['Cube.055', Object.freeze({ empty: true })],
]));

/** Her spec for tools/shipBake.mjs bakeScene: no part of her hull cut off it. */
export const LARGE_BOAT_SPEC = Object.freeze({ bake: 'tools/bakeLargeBoat.mjs', source: SOURCE_FBX, frame: FRAME, roles: ROLES, skip: SKIP, band: BAND, hull: 'hull' });

/** The bake: the FBX's bytes in, her parts out. Pure. */
export const bakeLargeBoat = (fbxBytes, tree = readFbx(fbxBytes), source = SOURCE_FBX) => bakeScene(fbxBytes, LARGE_BOAT_SPEC, tree, source);

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const fbx = resolve(opt('fbx', resolve(ROOT, SOURCE_FBX)));
  const out = resolve(opt('out', resolve(ROOT, OUT)));
  const bytes = readFileSync(fbx);
  if (args.includes('--list')) for (const line of listScene(bytes, LARGE_BOAT_SPEC)) console.log(line);
  else {
    const baked = bakeLargeBoat(bytes, readFbx(bytes), sourcePath(fbx));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, bakeJson(baked));
    console.log(`${fbx} -> ${out}`);
    for (const p of baked.parts) console.log(`  ${p.role.padEnd(20)} ${p.object.padEnd(14)} ${String(p.positions.length / 3).padStart(4)} vertices ${String(p.polygons.length).padStart(3)} polygons ${String(p.triangles.length / 3).padStart(4)} triangles${p.split ? ` (${p.split} cut)` : ''}`);
  }
}
