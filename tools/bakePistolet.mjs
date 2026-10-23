// THE DWARVEN PISTOLET'S MORROWIND ASSETS (PISTOLET, 2026-10-21; PISTOLET-MODEL, 2026-10-22; bible/05-Combat/Dwarven-Pistolet.md).
//
//     node tools/bakePistolet.mjs [--sheet=<png>]
//
// The model is built part by part and its texture painted from its own surface (tools/modelPistolet.mjs - the owner, of
// the first bake, the inventory sprite extruded a block deep: "Uhhh can you make an actual 3d model and texture it. This
// is bad"), and written by the same NIF and DDS writers the Thunderlock's bake uses (tools/nifWrite.mjs,
// tools/meshTexture.mjs). The frame is the one the arm holds: +Y the barrel, +Z up, +X the gun's right, the grip's middle
// at the origin (src/characters/ownModels/ownWeaponModels.js PISTOL_GRIP_ATTITUDE).
//
// Deterministic: the same code bakes the same bytes; test/systems/pistolet.test.js re-runs it and compares.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { writePng } from './pngIO.mjs';
import { meshToNif } from './nifWrite.mjs';
import { mipChain, writeDds } from './meshTexture.mjs';
import { buildPistolet, paintPistolet, occlusionOf } from './modelPistolet.mjs';
import { MW_UNITS_PER_METRE } from './bakeThunderlock.mjs';
import { isMain } from './lib/isMain.mjs';

export const OUT = Object.freeze({
  mesh: 'src/assets/mw/meshes/pistolet.nif',
  texture: 'src/assets/mw/textures/pistolet.dds',
  gildedMesh: 'src/assets/mw/meshes/pistolet_gilded.nif',
  gildedTexture: 'src/assets/mw/textures/pistolet_gilded.dds',
});

/** The bake: the model, its texture and the Sunken Sovereign's gold one, and the two NIFs naming them. Pure. */
export function bakePistolet() {
  const model = buildPistolet();
  const ao = occlusionOf(model);
  const atlas = paintPistolet(model, { ao });
  const gildedAtlas = paintPistolet(model, { gilded: true, ao });
  return {
    model,
    mesh: model.mesh,
    nif: meshToNif(model.mesh, { texture: 'pistolet.dds', node: 'Pistolet' }),
    dds: writeDds(mipChain(atlas)),
    gildedNif: meshToNif(model.mesh, { texture: 'pistolet_gilded.dds', node: 'SunkenSovereign' }),
    gildedDds: writeDds(mipChain(gildedAtlas)),
    atlas,
    gildedAtlas,
  };
}

if (isMain(import.meta.url)) {
  const save = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };
  const r = bakePistolet();
  save(OUT.mesh, r.nif);
  save(OUT.texture, r.dds);
  save(OUT.gildedMesh, r.gildedNif);
  save(OUT.gildedTexture, r.gildedDds);
  const b = r.mesh.bounds, size = [0, 1, 2].map((k) => +(b.max[k] - b.min[k]).toFixed(2));
  console.log(`the Dwarven Pistolet: ${r.mesh.positions.length / 3} vertices, ${r.mesh.indices.length / 3} triangles, ${r.model.islands.length} islands`);
  console.log(`  size ${size.join(' x ')} units = ${(size[1] / MW_UNITS_PER_METRE * 100).toFixed(0)} cm long; muzzle at +${b.max[1].toFixed(1)}, butt at ${b.min[1].toFixed(1)}`);
  for (const [k, p] of Object.entries(OUT)) console.log(`  ${p}  ${({ mesh: r.nif, texture: r.dds, gildedMesh: r.gildedNif, gildedTexture: r.gildedDds })[k].length} bytes`);
  const sheet = process.argv.find((a) => a.startsWith('--sheet='))?.slice(8);
  if (sheet) save(sheet, writePng(r.atlas));
}
