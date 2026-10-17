// THE CLOAK'S MORROWIND ASSETS, in one command.
//
//     node tools/bakeCloak.mjs
//         re-make the shipped NIFs and DDSs from the committed export, its eight paintings and retail's skeleton
//
// MW-CLOAK1 (2026-10-09, Mac: "2. The new cloak and its textures. Note: The new cloak will need bones to animate with
// the character movement"). One mesh, hung from the shoulders down the back to the calves, in eight paintings - a mesh
// per painting, each naming its own (src/characters/ownModels/ownClothingModels.js CLOAK_PAINTINGS).
//
//   THE STEEL PLATE'S SCENE. The cloak came out of the Blender file the steel plate did ("New Ship.blend"), fitted on
//   the same body: its axes are Morrowind's (front +Y - the cloak stands wholly behind, y -21.7 to -1.4), its placement
//   the scene's, and SCENE_FROM_BIND stands it on retail's bind as it stands the plate (tools/bakeSteelPlate.mjs).
//
//   ONE BONE, THE CHEST (MW-CAPE-RIGID, 2026-10-14, Mac: "Remove all waypaiting from capes, attach cape mesh to
//   chestbone. So it exclusively moves with the chest bone and no other bone with effect the vertices of the cape").
//   Every vertex is skinned to CHEST_BONE at weight 1 and to nothing else, so the cloak moves as one rigid sheet with the
//   chest. It was skinned over the spine, the clavicles and both thighs (MW-CLOAK1's hang, tools/skinWeights.mjs mode
//   'over'); that painting is gone whole. It stays a skinned NIF of one bone, not a rigid part on the Chest node:
//   retail's bind (RETAIL_SKELETON) carries Bip01 Spine2's frame and not the Chest node's, and the fits
//   (src/formats/morrowind/mwCloakFit.js) edit a skinned cloak's batch.
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
import { loopSubdivide } from './meshSubdivide.mjs';
import { readPng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';
import { RETAIL_SKELETON, plateBind, bakeObject } from './bakeSteelPlate.mjs';
import { CLOAK_PAINTINGS, cloakModel } from '../src/characters/ownModels/ownClothingModels.js';

/** Mac's export, as committed - the cloak alone, as it came. */
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

/** MW-CAPE-RIGID: the one bone the cloak moves with - the chest (the spine's top, where the clavicles join). */
export const CHEST_BONE = 'Bip01 Spine2';
/** The cloak's rig: the chest alone. */
export const CLOAK_RIG = Object.freeze({ shape: 'Tri Cloak', bones: Object.freeze([CHEST_BONE]) });

/** The cloak's mesh in the scene's placement, smoothed, every vertex weighted wholly to the chest, and that bone at its
 *  bind (plateBind). */
export function cloakRig(tree, bind) {
  const mesh = loopSubdivide(bakeObject(tree, CLOAK_OBJECT, CLOAK_BOX), CLOAK_SUBDIVISIONS);
  if (!bind.get(CHEST_BONE)) throw new Error(`no ${CHEST_BONE} in the skeleton to hang the cloak from`);
  const weights = Array.from({ length: mesh.positions.length / 3 }, () => [[CHEST_BONE, 1]]);
  return { mesh, weights, bones: CLOAK_RIG.bones.map((name) => ({ name, bind: bind.get(name) })) };
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
