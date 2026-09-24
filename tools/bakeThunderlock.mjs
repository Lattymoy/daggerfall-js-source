// THE DWARVEN THUNDERLOCK'S MORROWIND ASSETS, in one command.
//
//     node tools/bakeThunderlock.mjs [--fbx=src/assets/mw/source/Pellet_Shot.fbx]
//                                    [--sheets]
//
// FIELD-GUN-MW2. The four tools this calls are general; the NUMBERS are
// this weapon's, and they are decisions rather than defaults, so they
// live in a file somebody can read instead of in a command line nobody
// re-runs. `npm run gunart` (tools/gunPaperdoll.mjs) is the precedent
// one dimension down.
//
// Deterministic end to end: same .fbx in, same bytes out - and that is
// not a hope, it is GATED. `src/assets/mw/source/Pellet_Shot.fbx` is
// committed beside the assets it produces and
// test/fieldgunmw.test.js re-runs this function over it and compares
// the result to the committed .nif and .dds, byte for byte.
//
// COMMITTING THE SOURCE IS A DEPARTURE from tools/gunPaperdoll.mjs,
// whose PNGs stay in the ignored scratch/, and it is deliberate: those
// are thousand-pixel paintings and this is seventeen kilobytes, and
// without it the shipped mesh is a blob whose provenance nobody can
// check. A campaign proved the cost of the alternative - six mutants of
// these tools SURVIVED, because every pin read the committed bytes and
// the committed bytes are the output of a run that already happened.
// A derivation you cannot re-run is a claim you cannot check.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFbx } from './fbxRead.mjs';
import { bakeMesh } from './fbxMesh.mjs';
import { unwrap, unwrapQuality } from './meshUnwrap.mjs';
import { bakeTexture, mipChain, writeDds } from './meshTexture.mjs';
import { meshToNif } from './nifWrite.mjs';
import { previewSheet, uvSheet } from './meshSheets.mjs';
import { writePng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';

/**
 * MORROWIND IS 69.99 UNITS TO THE METRE.
 *
 * Not a constant this file invents - `MW_UNITS_PER_METER` in
 * src/formats/mwFirstPerson.js is the port's own, read off the
 * reference, and test/fieldgunmw.test.js asserts the two agree. It is
 * restated here rather than imported because a bake must not drag the
 * Morrowind first-person module in behind it, and a number with a pin
 * on it is a number that cannot drift.
 */
export const MW_UNITS_PER_METRE = 69.99125109;

/**
 * HOW LONG THE GUN IS, and this is the field that makes the difference
 * between a weapon and a speck. The first bake normalised the mesh to a
 * longest axis of 1 unit - one and a half centimetres - because 1 is a
 * tidy number for a MESH and a meaningless one for a WEAPON.
 *
 * 0.75 m is a short two-handed carbine, which is what the model is and
 * what the weapon's own row says: `isOneHanded: false` (both hands on
 * it in the art the lab settled) and `baseWeight` 6.0, the heaviest
 * weapon in the game. Longer would out-reach a claymore; shorter would
 * be a pistol, and the port already decided this is not one.
 */
export const THUNDERLOCK_METRES = 0.75;

export const SETTINGS = Object.freeze({
  // The frame, measured off the model - see tools/fbxMesh.mjs's header.
  forward: '-z',
  up: '-x',
  // The pivot is THE GRIP, because the bone this hangs on is a HAND.
  // Centred on its bounds - the first bake's default - puts the middle
  // of the receiver in the fist.
  origin: 'grip',
  units: THUNDERLOCK_METRES * MW_UNITS_PER_METRE,
  // 256 is Morrowind's own weapon-texture size, and the unwrap is
  // packed against it so the island margins are whole texels.
  atlas: 256,
  // The occlusion's ray count. 64 over 539 vertices is five million
  // ray-triangle tests and about a second; there is no reason to be
  // stingy in a bake that runs by hand.
  rays: 64,
});

/** Mac's Blender export, committed so the bake is reproducible. */
export const SOURCE_FBX = 'src/assets/mw/source/Pellet_Shot.fbx';

export const OUT = Object.freeze({
  mesh: 'src/assets/mw/meshes/thunderlock.nif',
  texture: 'src/assets/mw/textures/thunderlock.dds',
});

const save = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };

export function bakeThunderlock(fbxBytes, { sheets = null } = {}) {
  const raw = bakeMesh(readFbx(fbxBytes), {
    name: 'Dwarven_Thunderlock',
    forward: SETTINGS.forward, up: SETTINGS.up,
    units: SETTINGS.units, origin: SETTINGS.origin,
  });
  const before = unwrapQuality(raw);
  const mesh = unwrap(raw, { size: SETTINGS.atlas });
  const top = bakeTexture(mesh, { size: SETTINGS.atlas, rays: SETTINGS.rays });
  const dds = writeDds(mipChain({ width: top.width, height: top.height, data: top.data }));
  // The texture is named as a BARE file, which `correctTexturePath`
  // re-roots under `textures/` - the ladder the whole lane uses, so
  // the archive keys by what the ladder lands on and not by what the
  // NIF says.
  const nif = meshToNif(mesh, { texture: 'thunderlock.dds', node: 'Thunderlock' });
  const out = { mesh, nif, dds, before, sheets: null };
  if (sheets) {
    const tex = { width: top.width, height: top.height, data: top.data };
    out.sheets = {
      preview: writePng(previewSheet(mesh, 440, tex)),
      uv: writePng(uvSheet(mesh, 1024)),
      texture: writePng(tex),
    };
  }
  return out;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
  const fbx = opt('fbx', SOURCE_FBX);
  const wantSheets = args.includes('--sheets');
  const r = bakeThunderlock(readFileSync(fbx), { sheets: wantSheets });
  save(OUT.mesh, r.nif);
  save(OUT.texture, r.dds);
  const u = r.mesh.unwrap;
  const b = r.mesh.bounds;
  const size = [0, 1, 2].map((k) => +(b.max[k] - b.min[k]).toFixed(2));
  console.log(`${fbx}`);
  console.log(`  unwrap   ${r.before.coverage} -> ${u.quality.coverage} over ${u.islands} islands (1.0 fills the atlas once)`);
  console.log(`  size     ${size.join(' x ')} units = ${(size[1] / MW_UNITS_PER_METRE * 100).toFixed(0)} cm long`);
  console.log(`  pivot    ${SETTINGS.origin}: muzzle at +${b.max[1].toFixed(1)}, butt at ${b.min[1].toFixed(1)}`);
  console.log(`  ${OUT.mesh}  ${r.nif.length} bytes`);
  console.log(`  ${OUT.texture}  ${r.dds.length} bytes`);
  if (wantSheets) {
    for (const [k, png] of Object.entries(r.sheets)) { save(`scratch/thunderlock-${k}.png`, png); console.log(`  scratch/thunderlock-${k}.png`); }
  }
}
