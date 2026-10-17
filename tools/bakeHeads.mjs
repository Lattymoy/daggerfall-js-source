// THE PORT'S OWN HEADS AND HAIRS FOR THE MORROWIND BODY, race by race, in one command.
//
//     node tools/bakeHeads.mjs
//         re-make the shipped NIFs and DDSs from the committed exports and their paintings
//
// MW-HEADS1 (2026-10-13, the owner: "Everything we are doing is for the morrowwind model. This batch is for breton",
// with daggerwind.fbx and six paintings; asked, every Breton man wears them - bible/04-Characters/Own-Heads.md). The
// first batch of the port's own heads: three Breton men's heads and three hairs, in place of the Breton men's heads
// Morrowind's own data carries (characters/ownModels/ownHeadModels.js, formats/morrowind/mwFirstPerson.js facePools).
//
//   THREE OBJECTS, EACH A HEAD AND A HAIR. The export carries `b_n_breton_m_hair_widow`, `b_n_breton_m_head_05.002`
//   and `.003` - each a face in a head painting and a hair in a hair painting, two materials of one object. To the game
//   they are what Morrowind's own are: a head part and a hair part, each its own file, worn in two slots (PRT_Head and
//   PRT_Hair) and chosen each on its own. Every hair sits on every head - all three faces share one frame and one crown
//   - so the three objects are three heads and three hairs: nine faces.
//
//   EACH PART IN THE HEAD'S OWN FRAME. A retail head or hair is a RIGID part hung under the skeleton's "Head" node
//   (02-Formats/Morrowind-Rules.md rules 5, 12 and 13), its geometry in that node's frame. The three faces carry one
//   such frame between them, not a recentring of each: every one has the same crown (z 7.66), the same sides
//   (x +-4.78) and the same back, though one is a different mesh with a sculpted beard - so the frame is the source
//   head's (`b_n_breton_m_head_05`, the names say), and each part is baked in it: the object's scene placement taken
//   back off (`partFrame` - a translation, the scene turning nothing), never re-centred, never scaled.
//   MW-HEADS2 (2026-10-15, the owner: "some of the ingame heads are backwards on the body"): AND TURNED ROUND. How the
//   game's Head node turns that frame is the one link the tree cannot read - no retail skeleton's part nodes are
//   vendored - and the first bake took the scene's +Y for the face's, as the scene's body faced: seen in game, the face
//   hung backwards on the body. So the head's frame faces -Y - the scene turned half round about its crown
//   (HEAD_FORWARD: the scene's -Y is the frame's +Y, the brigandine's turn), a rotation and no mirror, the back now at
//   y +6.95 and the face ahead of the crown on -Y (test/tooling/mwheads1.test.js). Where the owner's scene stood them - z 125 over its floor - is where MW-STEEL5 measured the game drawing a
//   retail head over the T-posed scene's own (3.2 to 4.3 higher than its 113.15 to 129.2, and 125 puts these 3.46
//   higher): the same height, read two ways.
//
//   THE PAINTINGS, BY THE NAMES THE EXPORT GIVES THEM. They came as attachments with no names; the export names each
//   material's picture (tx_b_n_breton_m_h04.png and so on), so each part is read by its material AND held to that name
//   (`objectMaterials`), and each painting was matched to its name by what it is drawn for - the red band on the
//   headband's own island, the eyepatch on a full-face layout that is not mirrored, the hairline along its hair's
//   island (bible/04-Characters/Own-Heads.md). MW-HEADS3 (2026-10-15, the export's author, through the owner: "the
//   eyepatch head was assigned the wrong hair / it gave me the rambo hair / ... its using the eyepatch on the wrong
//   head"): the eyepatch is h0411's - object .002's face, its hair the 01 - and the plain brown beard h0423's; the two
//   share one layout, so the paintings could not tell them apart and the first match guessed the headband's object.
//
//   NOTHING OF A SKELETON. A rigid part needs no bind and no weights: each NIF is the part's mesh and its painting, the
//   shape the Thunderlock's is (tools/nifWrite.mjs meshToNif).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFbx } from './fbxRead.mjs';
import { bakeMesh, objectMaterials, basisMap } from './fbxMesh.mjs';
import { mipChain, writeDds } from './meshTexture.mjs';
import { meshToNif } from './nifWrite.mjs';
import { readPng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';
import { objectTree, BOX_SLACK } from './bakeSteelPlate.mjs';

/** The owner's exports, as committed - one per batch, as it came. */
export const SOURCES = Object.freeze({
  breton: 'src/assets/mw/source/Breton_Heads.fbx',   // daggerwind.fbx (2026-10-13)
});

/** The paintings, as committed - each under its part's id, beside the name the export gives it. */
export const PAINTINGS = Object.freeze({
  breton_m_head_h04: 'src/assets/mw/source/Breton_Head_H04.png',       // tx_b_n_breton_m_h04.png
  breton_m_head_h0411: 'src/assets/mw/source/Breton_Head_H0411.png',   // tx_b_n_breton_m_h0411.png
  breton_m_head_h0423: 'src/assets/mw/source/Breton_Head_H0423.png',   // tx_b_n_breton_m_h0423.png
  breton_m_hair_widow: 'src/assets/mw/source/Breton_Hair_Widow.png',   // tx_b_n_breton_m_hair_widow.png
  breton_m_hair_01: 'src/assets/mw/source/Breton_Hair_01.png',         // tx_b_n_breton_m_hair01.png
  breton_m_hair_0111: 'src/assets/mw/source/Breton_Hair_0111.png',     // tx_b_n_breton_m_hair0111.png
});

/** The DDS's name as the NIFs spell it (a bare file, re-rooted under `textures/`), and the shipped files -
 *  ownMwAssets.js serves `src/assets/mw/` as a Data Files tree, so these ARE their game paths. */
export const textureName = (id) => `${id}.dds`;
export const meshFile = (id) => `src/assets/mw/meshes/${id}.nif`;
export const textureFile = (id) => `src/assets/mw/textures/${id}.dds`;

/** MW-HEADS2: the scene's axis that becomes the head frame's +Y - its -Y, the scene turned half round about its crown:
 *  a retail head's frame looks -Y (seen in game - the first bake's +Y hung every face backwards on the body). */
export const HEAD_FORWARD = '-y';
export const HEAD_UP = '+z';

const part = (id, batch, slot, object, material, texture, box) => Object.freeze({ id, batch, slot, object, material, texture, box: Object.freeze(box) });

/**
 * Every part: its id (its mesh's, its texture's and its record's), its batch, its slot, the object and the material it
 * is read from, the picture the export names on that material, and the box it was read at - in its own frame, the
 * placement the bake keeps.
 */
export const HEAD_PARTS = Object.freeze([
  part('breton_m_head_h04', 'breton', 'head', 'b_n_breton_m_hair_widow', 1, 'tx_b_n_breton_m_h04.png', [[-4.78, -8.28, -8.89], [4.78, 6.95, 7.66]]),
  part('breton_m_hair_widow', 'breton', 'hair', 'b_n_breton_m_hair_widow', 0, 'tx_b_n_breton_m_hair_widow.png', [[-7.18, -5.92, -8.71], [7.18, 10.83, 9.27]]),
  part('breton_m_head_h0411', 'breton', 'head', 'b_n_breton_m_head_05.002', 0, 'tx_b_n_breton_m_h0411.png', [[-4.78, -8.38, -8.4], [4.78, 6.95, 7.66]]),
  part('breton_m_hair_01', 'breton', 'hair', 'b_n_breton_m_head_05.002', 1, 'tx_b_n_breton_m_hair01.png', [[-6.05, -6.9, -6.94], [6.05, 8.56, 9.16]]),
  part('breton_m_head_h0423', 'breton', 'head', 'b_n_breton_m_head_05.003', 0, 'tx_b_n_breton_m_h0423.png', [[-4.78, -7.92, -9.84], [4.78, 6.95, 7.66]]),
  part('breton_m_hair_0111', 'breton', 'hair', 'b_n_breton_m_head_05.003', 1, 'tx_b_n_breton_m_hair0111.png', [[-6.96, -7.31, -6.94], [6.96, 8.56, 8.82]]),
]);

/** A scene-placed mesh in its OBJECT'S own frame: the scene translation the bake kept, taken back off - to the bake's
 *  six places. Nothing else moves: no re-centring, no scale. `toBasis` the bake's axes (the translation is the scene's,
 *  so it is turned as the vertices were - MW-HEADS2's half turn). */
export function partFrame(mesh, toBasis = basisMap(HEAD_FORWARD, HEAD_UP)) {
  const t = toBasis(mesh.bake.sceneTranslation);
  const off = (v, k) => +(v - t[k]).toFixed(6);
  return {
    ...mesh,
    positions: mesh.positions.map((v, i) => off(v, i % 3)),
    bounds: { min: mesh.bounds.min.map(off), max: mesh.bounds.max.map(off) },
  };
}

/** One part's mesh: its material of its object, held to the picture the export names on it and to the box it was read
 *  at, in the head's own frame. A re-export that renamed, moved, reshaped or re-painted a part is refused by name. */
export function partMesh(tree, p) {
  const names = objectMaterials(tree, p.object);
  if (names[p.material] !== p.texture) {
    throw new Error(`"${p.object}" wears ${JSON.stringify(names[p.material] ?? null)} in material ${p.material}, not ${p.texture} - re-read the export before baking it`);
  }
  const mesh = partFrame(bakeMesh(objectTree(tree, p.object), { name: p.id, placement: 'scene', forward: HEAD_FORWARD, up: HEAD_UP, material: p.material }));
  const off = [0, 1, 2].flatMap((k) => [Math.abs(mesh.bounds.min[k] - p.box[0][k]), Math.abs(mesh.bounds.max[k] - p.box[1][k])]);
  if (Math.max(...off) > BOX_SLACK) {
    throw new Error(`"${p.id}" stands at ${JSON.stringify(mesh.bounds)}, not where it was read (${JSON.stringify(p.box)}) - re-read the export before baking it`);
  }
  return mesh;
}

/**
 * The bake: the committed exports (`sources`, by batch) and the paintings (`pngs`, by part id) in, every part's NIF and
 * every painting's DDS out. Pure - bytes in, bytes out.
 */
export function bakeHeads({ sources, pngs }) {
  const trees = Object.fromEntries(Object.entries(sources).map(([b, bytes]) => [b, readFbx(Buffer.from(bytes))]));
  const parts = HEAD_PARTS.map((p) => {
    if (!trees[p.batch]) throw new Error(`no export for the ${p.batch} batch (SOURCES.${p.batch})`);
    const mesh = partMesh(trees[p.batch], p);
    return { id: p.id, mesh, nif: meshToNif(mesh, { texture: textureName(p.id), node: p.id }) };
  });
  const textures = HEAD_PARTS.map((p) => {
    if (!pngs[p.id]) throw new Error(`no painting for ${p.id}`);
    const png = readPng(pngs[p.id]);
    return { id: p.id, png, dds: writeDds(mipChain({ width: png.width, height: png.height, data: png.data })) };
  });
  return { parts, textures };
}

const save = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };

if (isMain(import.meta.url)) {
  const missing = Object.entries(PAINTINGS).filter(([, p]) => !existsSync(p)).map(([id]) => id);
  if (missing.length) { console.error(`no painting yet for: ${missing.join(', ')}`); process.exit(1); }
  const r = bakeHeads({
    sources: Object.fromEntries(Object.entries(SOURCES).map(([b, p]) => [b, readFileSync(p)])),
    pngs: Object.fromEntries(Object.entries(PAINTINGS).map(([id, p]) => [id, readFileSync(p)])),
  });
  for (const p of r.parts) {
    save(meshFile(p.id), p.nif);
    console.log(`  ${p.id.padEnd(22)} ${String(p.mesh.indices.length / 3).padStart(5)} triangles -> ${meshFile(p.id)}  ${p.nif.length} bytes`);
  }
  for (const t of r.textures) {
    save(textureFile(t.id), t.dds);
    console.log(`  ${t.id.padEnd(22)} ${t.png.width}x${t.png.height} -> ${textureFile(t.id)}  ${t.dds.length} bytes`);
  }
}
