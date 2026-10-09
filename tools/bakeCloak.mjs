// THE CLOAK'S MORROWIND ASSETS, in one command.
//
//     node tools/bakeCloak.mjs
//         re-make the shipped NIFs and DDSs from the committed export, its eight paintings and retail's skeleton
//
// MW-CLOAK1 (2026-10-09, Mac: "2. The new cloak and its textures. Note: The new cloak will need bones to animate with
// the character movement"). One mesh, hung from the shoulders down the back to the calves, in eight paintings - a mesh
// per painting, each naming its own (src/characters/ownClothingModels.js CLOAK_PAINTINGS).
//
//   THE STEEL PLATE'S SCENE. The cloak came out of the Blender file the steel plate did ("New Ship.blend"), fitted on
//   the same body: its axes are Morrowind's (front +Y - the cloak stands wholly behind, y -21.7 to -1.4), its placement
//   the scene's, and SCENE_FROM_BIND stands it on retail's bind as it stands the plate (tools/bakeSteelPlate.mjs).
//
//   IT HAS BONES - SKINNED AT BAKE TIME, as the plate is (MW-STEEL4): from the shoulders to the waist it rides the
//   spine as the steel breastplate does (the pelvis, the spine to the neck, the clavicles at its shoulders), and from
//   the waist down it HANGS OVER that (tools/skinWeights.mjs, mode 'over'): each thigh takes a growing share of its
//   own side, to 0.85 at the hem, split across 10 units of the middle - so the cloak walks with the legs, the side over
//   the leg stepping back going back with it, without riding a leg outright and tearing at the middle. Half at the hem
//   was tried first and lost: posed on retail's rig in a stride (the back thigh 30 degrees, its knee 45), the trailing
//   calf came through the hem; at 0.85 the hem stays behind it.
//
//   SMOOTHED, TWO LEVELS (MW-CLOAK2, Mac: "I dont like how the cloak isnt smooth around the shoulders"). The export is
//   140 vertices about five units apart - over the shoulders, where it turns from the back over the top, a face stood
//   up to 35 degrees off its corners' normals, the silhouette the polygon and the straps' ends a ragged run of small
//   triangles. Two levels of Loop subdivision (tools/meshSubdivide.mjs) round the turn and relax the open edges into
//   curves, 1,949 vertices; the weights are the subdivided cloak's own, and so is every fit after (mwCloakFit.js).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFbx } from './fbxRead.mjs';
import { mipChain, writeDds } from './meshTexture.mjs';
import { skinnedMeshesToNif } from './nifWrite.mjs';
import { jointWeights } from './skinWeights.mjs';
import { loopSubdivide } from './meshSubdivide.mjs';
import { readPng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';
import { PLATE_RIG, RETAIL_SKELETON, plateBind, rigSegments, bakeObject } from './bakeSteelPlate.mjs';
import { CLOAK_PAINTINGS, cloakModel } from '../src/characters/ownClothingModels.js';

/** Mac's export, as committed - the cloak and a light, as it came. */
export const SOURCE = 'src/assets/mw/source/Cloak.fbx';
/** The cloak's object in it, and the scene box it was read at. */
export const CLOAK_OBJECT = 'Cube.020 Remeshed.001';
export const CLOAK_BOX = Object.freeze([Object.freeze([-23.64, -21.66, 29.28]), Object.freeze([25.85, -1.35, 117.56])]);
/** MW-CLOAK2: the levels of Loop subdivision it is smoothed by (tools/meshSubdivide.mjs) - 140 vertices to 1,949. */
export const CLOAK_SUBDIVISIONS = 2;

/** Each painting, as committed. The export names one, `capthing\red.png` - Mac's red. */
export const PAINTING = Object.freeze(Object.fromEntries(CLOAK_PAINTINGS.map((p) => [p, `src/assets/mw/source/Cloak_${p.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join('_')}.png`])));

export const textureName = (painting) => `cloak_${painting}.dds`;
export const meshFile = (painting) => `src/assets/mw/meshes/${cloakModel(painting)}`;
export const textureFile = (painting) => `src/assets/mw/textures/${textureName(painting)}`;

const [, LEFT_THIGH, RIGHT_THIGH] = PLATE_RIG.skirt.bones;
/** The cloak's rig: the steel breastplate's spine and clavicles, the thighs' share hung over them below the waist. */
export const CLOAK_RIG = Object.freeze({
  shape: 'Tri Cloak',
  bones: Object.freeze([...PLATE_RIG.cuirass.bones, LEFT_THIGH, RIGHT_THIGH]),
  hang: Object.freeze({ mode: 'over', root: 'Bip01 Pelvis', legs: Object.freeze([LEFT_THIGH.name, RIGHT_THIGH.name]), top: 86, bottom: 29.28, share: 0.85, centre: 10 }),
});

/** The cloak's mesh in the scene's placement, smoothed, its weights in `bind` (plateBind), and its bones at their binds. */
export function cloakRig(tree, bind) {
  const mesh = loopSubdivide(bakeObject(tree, CLOAK_OBJECT, CLOAK_BOX), CLOAK_SUBDIVISIONS);
  const weights = jointWeights(mesh.positions, rigSegments(CLOAK_RIG.bones, bind), { hang: CLOAK_RIG.hang });
  return { mesh, weights, bones: CLOAK_RIG.bones.map((b) => ({ name: b.name, bind: bind.get(b.name) })) };
}

/** The bake: the committed export, the eight paintings and retail's skeleton in; a NIF and a DDS per painting out, the
 *  NIFs the one mesh naming each its own painting. Pure - bytes in, bytes out. */
export function bakeCloak({ source, pngs, skeleton }) {
  if (!skeleton) throw new Error('no skeleton to skin the cloak in - the bake reads its bind (RETAIL_SKELETON)');
  const { mesh, weights, bones } = cloakRig(readFbx(Buffer.from(source)), plateBind(skeleton));
  const paintings = CLOAK_PAINTINGS.map((painting) => {
    if (!pngs[painting]) throw new Error(`no painting for the ${painting} cloak (${PAINTING[painting]})`);
    const png = readPng(pngs[painting]);
    const nif = skinnedMeshesToNif([{ mesh, texture: textureName(painting), name: `${CLOAK_RIG.shape} 0`, weights }], { node: 'Cloak', bones });
    return { painting, png, dds: writeDds(mipChain({ width: png.width, height: png.height, data: png.data })), nif };
  });
  return { mesh, weights, paintings };
}

const save = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };

if (isMain(import.meta.url)) {
  const missing = Object.entries(PAINTING).filter(([, p]) => !existsSync(p)).map(([t]) => t);
  if (missing.length) { console.error(`no painting yet for: ${missing.join(', ')}`); process.exit(1); }
  const r = bakeCloak({
    source: readFileSync(SOURCE),
    pngs: Object.fromEntries(Object.entries(PAINTING).map(([t, p]) => [t, readFileSync(p)])),
    skeleton: readFileSync(RETAIL_SKELETON),
  });
  console.log(`${SOURCE}: ${r.mesh.indices.length / 3} triangles, ${r.mesh.positions.length / 3} vertices`);
  for (const p of r.paintings) {
    save(meshFile(p.painting), p.nif);
    save(textureFile(p.painting), p.dds);
    console.log(`  ${p.painting.padEnd(12)} ${p.png.width}x${p.png.height} -> ${meshFile(p.painting)} ${p.nif.length} bytes, ${textureFile(p.painting)} ${p.dds.length} bytes`);
  }
}
