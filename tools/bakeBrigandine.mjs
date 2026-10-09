// THE STEEL BRIGANDINE'S MORROWIND ASSETS, in one command.
//
//     node tools/bakeBrigandine.mjs [--fbx=src/assets/mw/source/Brigandine_Steel.fbx] [--sheets]
//
// MW-BRIG4 (2026-10-09, Mac: "Also for the integrated brigadine chest piece, we need each of these textures
// implemented", nine paintings of the same unwrap; asked which metal wears which, he took the map offered - one per
// metal): the one mesh is baked once and written once PER METAL the Jerkin is a brigandine in (ownArmorModels.js
// BRIGANDINE_METALS, Iron to Daedric), each NIF naming its metal's DDS. Steel keeps MW-BRIG1's red; the nine are Mac's,
// committed under their metals' names (PAINTING) as he sent them - in the order he attached them, 1 Iron (tan, dark
// rivets), 2 Adamantium (tan, red rivets), 3 Mithril (light blue, teal rivets), 4 Daedric (bright red, dark rivets),
// 5 Orcish (dark green, dark rivets), 6 Elven (green, white rivets), 7 Silver (deep blue, silver rivets), 8 Ebony (red,
// light rivets), 9 Dwarven (blue, gold rivets).
//
// MW-BRIG1 (2026-09-29, Mac: "This is for the morrowind model. The steel
// brigantine"). The second of the port's own Morrowind models, and the
// first one that is WORN rather than held: Roleplay & Realism Items'
// Jerkin in Steel - "Brigandine Jerkin" by its own mint (rriItems.js
// lightWord) - wore retail's steel_cuirass, and now wears this.
//
// tools/bakeThunderlock.mjs is the precedent and this follows it where
// the two are the same thing - the source committed beside what it
// makes, the numbers in a file somebody can read, the output re-made
// byte for byte by test/mwbrig2.test.js - and departs where they are not:
//
//   WHERE IT SITS IS THE AUTHORING. Mac fitted the brigandine onto the
//   Morrowind body in his scene (his answer, asked: "fitted in place"),
//   so the bake keeps the scene placement - `placement: 'scene'`, see
//   tools/fbxMesh.mjs - 1 Blender unit to 1 Morrowind unit. A gun is
//   placed by the hand that grips it; a cuirass is placed by the body it
//   was fitted to. MW-BRIG3: the scene's body is NOT the skeleton at rest
//   - it stood lower, and drawn at the scene's height the brigandine sat
//   under the torso - so its height is measured on the wearer at bind time
//   (ownArmorModels.js `fitTo`, formats/mwSkinTransfer.js fitLift). The
//   bake keeps the scene's numbers; the binder puts it on the body.
//
//   THE TEXTURE IS PAINTED, NOT BAKED. The Thunderlock's DDS was grown
//   from its own geometry because Mac's export carried no texture; this
//   one carries Steel.png and UVs laid out for it, so the DDS is that
//   PNG, mip-chained, and the mesh keeps its own unwrap.
//
//   IT IS ONE PIECE, SKINNED FROM THE BODY AT BIND TIME (MW-BRIG2,
//   formats/mwSkinTransfer.js). MW-BRIG1 split it at the belt and hung the
//   halves rigid on the Chest and Groin nodes. Skinned from the chest,
//   groin, thighs and knees, the whole garment moves with the body it
//   covers, and the skirt bends with the legs. (What moved it in game, in
//   both builds, was the height above - MW-BRIG3.)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFbx } from './fbxRead.mjs';
import { bakeMesh } from './fbxMesh.mjs';
import { mipChain, writeDds } from './meshTexture.mjs';
import { meshToNif } from './nifWrite.mjs';
import { previewSheet } from './meshSheets.mjs';
import { readPng, writePng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';
import { BRIGANDINE_METALS } from '../src/characters/ownArmorModels.js';

/** Mac's Blender export and the texture it names, committed so the bake
 *  is reproducible. (The FBX points at the PNG as "Steel.png"; it is
 *  kept under the asset's own name here.) */
export const SOURCE_FBX = 'src/assets/mw/source/Brigandine_Steel.fbx';

/** MW-BRIG4: each brigandine metal's painting - Steel's the FBX's own (MW-BRIG1), the nine others Mac's (2026-10-09). */
export const PAINTING = Object.freeze(Object.fromEntries(BRIGANDINE_METALS.map((m) => [m, `src/assets/mw/source/Brigandine_${m}.png`])));
export const SOURCE_PNG = PAINTING.Steel;

/** The DDS's name as a metal's NIF spells it: a BARE file, which
 *  `correctTexturePath` re-roots under `textures/` - the ladder the whole
 *  lane uses (the Thunderlock's own convention). */
export const textureNameFor = (metal) => `brigandine_${metal.toLowerCase()}.dds`;
/** A metal's shipped files. ownMwAssets.js serves `src/assets/mw/` as a Data Files tree, so these ARE their game paths. */
export const outFor = (metal) => Object.freeze({
  mesh: `src/assets/mw/meshes/brigandine_${metal.toLowerCase()}.nif`,
  texture: `src/assets/mw/textures/${textureNameFor(metal)}`,
});
export const OUT = outFor('Steel');
export const TEXTURE_NAME = textureNameFor('Steel');

export const SETTINGS = Object.freeze({
  placement: 'scene',
  // THE FRONT, MEASURED: the buckle, the three clasps and the split in
  // the skirt are all on the scene's -Y side (the clasps sit at y -5.7
  // to -10, the whole of their extent), and Morrowind's actors face +Y.
  // So the bake turns it half round: forward -Y, up +Z.
  forward: '-y',
  up: '+z',
});


const save = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };

/** The mesh, in the scene's placement, turned to Morrowind's front. */
export const bakeBrigandineMesh = (fbxBytes) => bakeMesh(readFbx(fbxBytes), {
  name: 'Steel Brigandine',
  placement: SETTINGS.placement, forward: SETTINGS.forward, up: SETTINGS.up,
});

/** One metal's files: its painting mip-chained to a DDS, and the mesh written naming it. */
function paint(mesh, metal, pngBytes, sheets) {
  const png = readPng(pngBytes);
  const dds = writeDds(mipChain({ width: png.width, height: png.height, data: png.data }));
  const out = { metal, png, dds, nif: meshToNif(mesh, { texture: textureNameFor(metal), node: 'Brigandine' }), sheets: null };
  if (sheets) {
    out.sheets = { preview: writePng(previewSheet(mesh, 360, { width: png.width, height: png.height, data: png.data })) };
  }
  return out;
}

/** One metal's bake (Steel's by default - MW-BRIG1's). */
export function bakeBrigandine(fbxBytes, pngBytes, { sheets = false, metal = 'Steel' } = {}) {
  const mesh = bakeBrigandineMesh(fbxBytes);
  return { mesh, ...paint(mesh, metal, pngBytes, sheets) };
}

/** MW-BRIG4: every metal's - the mesh baked once, `pngs` by metal (PAINTING's keys). Pure: bytes in, bytes out. */
export function bakeBrigandineMetals(fbxBytes, pngs, { sheets = false } = {}) {
  const mesh = bakeBrigandineMesh(fbxBytes);
  return {
    mesh,
    metals: BRIGANDINE_METALS.map((metal) => {
      if (!pngs[metal]) throw new Error(`no painting for the ${metal} brigandine (${PAINTING[metal]})`);
      return paint(mesh, metal, pngs[metal], sheets);
    }),
  };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
  const fbx = opt('fbx', SOURCE_FBX);
  const wantSheets = args.includes('--sheets');
  const r = bakeBrigandineMetals(readFileSync(fbx), Object.fromEntries(Object.entries(PAINTING).map(([m, p]) => [m, readFileSync(p)])), { sheets: wantSheets });
  const b = r.mesh.bake;
  console.log(fbx);
  console.log(`  ${b.polygons} polygons (${b.clipped} ear-clipped) -> ${r.mesh.indices.length / 3} triangles, placed at ${b.sceneTranslation.join(', ')}`);
  console.log(`  z ${r.mesh.bounds.min[2].toFixed(2)}..${r.mesh.bounds.max[2].toFixed(2)}`);
  for (const m of r.metals) {
    const out = outFor(m.metal);
    save(out.mesh, m.nif);
    save(out.texture, m.dds);
    console.log(`  ${m.metal.padEnd(11)} ${PAINTING[m.metal]} ${m.png.width}x${m.png.height} -> ${out.mesh}  ${m.nif.length} bytes, ${out.texture}  ${m.dds.length} bytes`);
    if (wantSheets) {
      for (const [k, bytes] of Object.entries(m.sheets)) save(`scratch/brigandine-${m.metal.toLowerCase()}-${k}.png`, bytes);
    }
  }
}
