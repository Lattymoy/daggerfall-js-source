// THE STEEL PLATE'S MORROWIND ASSETS, in one command.
//
//     node tools/bakeSteelPlate.mjs [--sheets]
//         re-make the shipped NIFs and DDSs from the committed sources
//     node tools/bakeSteelPlate.mjs --import=<New_Ship.fbx>,<New_Ship1.fbx>
//         take Mac's two exports into the committed sources first (tools/fbxStrip.mjs), and measure his scene's
//         reference head and neck - the numbers characters/ownArmorModels.js fits the set by
//
// MW-STEEL1 (2026-10-06, Mac: "These 2 files are for the armor replacement of the morrowind steel armor with a varient
// to toggle the helmet type"). The third of the port's own Morrowind models, and the first SET: a whole suit of steel
// plate, a piece for every one of Daggerfall's seven, worn on the Morrowind body by Daggerfall's Steel armour in place of
// retail's steel_* records (Mac, asked: Steel only - Silver and Elven keep retail's steel). Two helms: the open one, a
// nasal helm over a mail aventail with the face showing, and the closed one, the same shell without the nasal, a
// perforated visor and a blue plume - chosen by the Steel Helm switch (systems/features.js; closed by default, Mac's
// answer).
//
// tools/bakeBrigandine.mjs is the precedent and this follows it where they are the same thing - the scene placement
// kept (`placement: 'scene'`), the textures Mac painted taken as they are and mip-chained, the source committed beside
// what it makes and the output re-made byte for byte by test/mwsteel1.test.js - and departs where they are not:
//
//   A SCENE OF PIECES. Mac's two exports are ONE scene twice - twelve objects the same to the vertex, and the helm
//   alone different (measured at --import: every shared object bakes byte for byte the same from both). Each piece is
//   read out of it by its own object (PIECES below), and each object must stand where it was read (its scene box,
//   BOX_SLACK) or the bake refuses it by name, so a re-export that renamed, moved or reshaped one never ships a boot as
//   a greave. The names are no help - Blender's (Cube.019, Sphere.002) or a source mesh's: the right gauntlet is
//   `Imperial_Steel_Left_Gauntlet_20_Male`, standing at +X, which on a Morrowind actor (facing +Y, Z up) is the right.
//
//   ITS FRONT IS ALREADY MORROWIND'S. The brigandine's scene faced -Y and its bake turned it round; this one faces +Y
//   (the boots' toes, the visor and the nasal all stand at +Y), so the bake keeps the scene's axes.
//
//   THE BODY IT WAS FITTED ON IS NOT COMMITTED. The scene carries Morrowind's own Breton head and neck (out of a
//   "Morrowind_TPose_Models" pack, wearing Morrowind's tx_b_n_breton_m_* pictures) as the body the armour sits on.
//   Those are Bethesda's meshes, so --import strips them (fbxStrip.mjs - every other record copied byte for byte) and
//   keeps only their BOUNDS, measured here and written into characters/ownArmorModels.js (STEEL_PLATE_SCENE): the set
//   is fitted onto the wearer by them at bind time (formats/mwSkinTransfer.js fitShift), as MW-BRIG3 fitted the
//   brigandine by the chest - the same lesson, that a modeller's scene is not the skeleton's rest, learned before.
//
//   THE SKIRT CAME WITH ITS PAINTING (MW-STEEL2, 2026-10-07, Mac: "This is the missing texture for the morrowind steel
//   armor's skirt"). The scene keeps a skirt of plates under the breastplate (`Imperial_Silver_Cuirass_67_Male.011`,
//   modelled from the same cuirass mesh as the breastplate, `.009`), painted from a "steelpelvis" texture that MW-STEEL1
//   never had - so it was stripped at --import then, Mac having said "That was never apart of the set". The painting
//   came, and the skirt is a piece now: `Steel_Plate_Skirt.png` is Mac's steelpelvis picture, and the skirt is baked
//   from the open helm's export like every shared piece (both of Mac's exports carry it, the same to the vertex).
//
//   THE CLOSED HELM IS TWO PICTURES ON ONE PART. Its shell wears the helm's texture and its visor and plume the
//   faceplate's, so its NIF carries two shapes (tools/nifWrite.mjs meshesToNif). The second export is committed as the
//   closed helm alone - the shared pieces are the first export's, byte for byte.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFbx, childrenNamed, nodeAt, objectName } from './fbxRead.mjs';
import { bakeMesh } from './fbxMesh.mjs';
import { stripFbx, meshModelNames } from './fbxStrip.mjs';
import { mipChain, writeDds } from './meshTexture.mjs';
import { meshesToNif } from './nifWrite.mjs';
import { previewSheet } from './meshSheets.mjs';
import { readPng, writePng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';

/** Mac's two exports, as committed: the whole set with the open helm, and the closed helm alone. */
export const SOURCE = Object.freeze({
  open: 'src/assets/mw/source/Steel_Plate.fbx',
  closed: 'src/assets/mw/source/Steel_Plate_Closed_Helm.fbx',
});

/** Mac's paintings, as committed - each under the piece's name, beside the folder his FBX names it from. */
export const TEXTURES = Object.freeze({
  cuirass: 'src/assets/mw/source/Steel_Plate_Cuirass.png',     // steelbreastplate\material_0.015_2D_View_<UDIM>.png
  pauldron: 'src/assets/mw/source/Steel_Plate_Pauldron.png',   // steelpauldrons\Material.034_2D_View_<UDIM>.png
  gauntlet: 'src/assets/mw/source/Steel_Plate_Gauntlet.png',   // newgloves\DefaultMaterial_2D_View_<UDIM>.png
  greave: 'src/assets/mw/source/Steel_Plate_Greave.png',       // steelpants\material_12.010_2D_View_<UDIM>.png
  boot: 'src/assets/mw/source/Steel_Plate_Boot.png',           // BOOTS\DefaultMaterial_2D_View_<UDIM>.png
  helm: 'src/assets/mw/source/Steel_Plate_Helm.png',           // helmet\DefaultMaterial_2D_View_<UDIM>.png
  visor: 'src/assets/mw/source/Steel_Plate_Visor.png',         // helmetface\DefaultMaterial_2D_View_<UDIM>.png
  skirt: 'src/assets/mw/source/Steel_Plate_Skirt.png',         // steelpelvis\material_2.013_2D_View_<UDIM>.png (MW-STEEL2)
});

/** The DDS's name as the NIFs spell it: a BARE file, which `correctTexturePath` re-roots under `textures/` (the
 *  Thunderlock's and the brigandine's convention). */
export const textureName = (tex) => `steel_plate_${tex}.dds`;
/** The shipped files. ownMwAssets.js serves `src/assets/mw/` as a Data Files tree, so these ARE their game paths. */
export const meshFile = (id) => `src/assets/mw/meshes/steel_plate_${id}.nif`;
export const textureFile = (tex) => `src/assets/mw/textures/steel_plate_${tex}.dds`;

/** The scene's own axes are Morrowind's: front +Y, up +Z. */
export const SETTINGS = Object.freeze({ placement: 'scene', forward: '+y', up: '+z' });

/** The reference body in Mac's scene - stripped from the committed sources, its bounds kept. */
export const REFERENCE_PARTS = Object.freeze({ head: 'Breton_Male.003', neck: 'Breton_Male.006' });

/** How far (any coordinate of its box) an object may stand from where its piece was read. */
export const BOX_SLACK = 0.02;

const shape = (object, texture, box) => Object.freeze({ object, texture, box: Object.freeze(box) });
const piece = (id, file, shapes) => Object.freeze({ id, file, shapes: Object.freeze(shapes) });
/**
 * Each piece, the object(s) it is read from, the texture each wears, and the scene box (min, max) each object was
 * read at - in the scene's own numbers, the placement the bake keeps.
 */
export const PIECES = Object.freeze([
  piece('cuirass', 'open', [shape('Imperial_Silver_Cuirass_67_Male.009', 'cuirass', [[-14.42, -11.94, 78.8], [14.42, 11.46, 115.42]])]),
  piece('skirt', 'open', [shape('Imperial_Silver_Cuirass_67_Male.011', 'skirt', [[-14.42, -11.98, 64.55], [14.42, 12.17, 86.93]])]),
  piece('pauldron_right', 'open', [shape('Breton_Male.009 Remeshed.001', 'pauldron', [[7.44, -7.71, 107.59], [30.56, 6.17, 117.66]])]),
  piece('pauldron_left', 'open', [shape('Breton_Male.009 Remeshed.003', 'pauldron', [[-30.56, -7.71, 107.59], [-7.44, 6.17, 117.66]])]),
  piece('gauntlet_right', 'open', [shape('Imperial_Steel_Left_Gauntlet_20_Male', 'gauntlet', [[27.03, -5.81, 106.44], [59.04, 4.56, 115.56]])]),
  piece('gauntlet_left', 'open', [shape('Imperial_Steel_Left_Gauntlet_20_Male.001', 'gauntlet', [[-59.04, -5.81, 106.44], [-27.03, 4.56, 115.56]])]),
  piece('greave_right', 'open', [shape('Breton_Male.007', 'greave', [[0.53, -5.13, 39.78], [11.9, 8.05, 79.72]])]),
  piece('greave_left', 'open', [shape('Breton_Male.001', 'greave', [[-11.9, -5.13, 39.78], [-0.53, 8.05, 79.72]])]),
  piece('boot_right', 'open', [shape('Cube.024', 'boot', [[0.32, -6.48, -0.21], [11.33, 14.61, 48.13]])]),
  piece('boot_left', 'open', [shape('Cube.019', 'boot', [[-11.33, -6.48, -0.21], [-0.32, 14.61, 48.13]])]),
  piece('helm_open', 'open', [shape('Sphere.002', 'helm', [[-7.5, -7.93, 112.88], [7.5, 9.22, 131.82]])]),
  piece('helm_closed', 'closed', [
    shape('Sphere', 'helm', [[-7.5, -7.93, 112.88], [7.5, 8.95, 131.82]]),
    shape('Sphere.001 Remeshed Remeshed', 'visor', [[-5.07, -8.02, 111.58], [6.82, 10.29, 139.61]]),
  ]),
]);

/** One Mesh Model of a parsed scene, with its Geometry - the tree bakeMesh takes, which wants exactly one mesh. */
export function objectTree(tree, name) {
  const objects = nodeAt(tree.nodes, 'Objects');
  const model = childrenNamed(objects, 'Model').find((m) => m.props[2] === 'Mesh' && objectName(m.props[1]) === name);
  if (!model) throw new Error(`no Mesh object "${name}" in this export`);
  const id = String(model.props[0]);
  const keep = new Set([id]);
  for (const c of childrenNamed(nodeAt(tree.nodes, 'Connections'), 'C')) {
    if (c.props[0] === 'OO' && String(c.props[2]) === id) keep.add(String(c.props[1]));
  }
  const only = { ...objects, children: objects.children.filter((o) => keep.has(String(o.props[0])) && (o.name === 'Geometry' || o.name === 'Model')) };
  return { ...tree, nodes: tree.nodes.map((n) => (n === objects ? only : n)) };
}

/** One object baked in the scene's placement, held to the box it was read at. */
export function bakeObject(tree, name, box = null) {
  const mesh = bakeMesh(objectTree(tree, name), { name, ...SETTINGS });
  if (box) {
    const off = [0, 1, 2].flatMap((k) => [Math.abs(mesh.bounds.min[k] - box[0][k]), Math.abs(mesh.bounds.max[k] - box[1][k])]);
    if (Math.max(...off) > BOX_SLACK) {
      throw new Error(`"${name}" stands at ${JSON.stringify(mesh.bounds)}, not where its piece was read (${JSON.stringify(box)}) - re-read the export before baking it`);
    }
  }
  return mesh;
}

/**
 * The bake: the two committed exports and the eight paintings in, every piece's NIF and every texture's DDS out.
 * Pure - bytes in, bytes out.
 */
export function bakeSteelPlate({ open, closed, pngs }, { sheets = false } = {}) {
  const trees = { open: readFbx(Buffer.from(open)), closed: readFbx(Buffer.from(closed)) };
  const textures = Object.keys(TEXTURES).map((tex) => {
    if (!pngs[tex]) throw new Error(`no painting for the ${tex} texture`);
    const png = readPng(pngs[tex]);
    return { tex, png, dds: writeDds(mipChain({ width: png.width, height: png.height, data: png.data })) };
  });
  const byTex = new Map(textures.map((t) => [t.tex, t]));
  const pieces = PIECES.map((p) => {
    const meshes = p.shapes.map((s) => bakeObject(trees[p.file], s.object, s.box));
    const nif = meshesToNif(p.shapes.map((s, i) => ({ mesh: meshes[i], texture: textureName(s.texture) })), { node: `Steel Plate ${p.id}` });
    const out = { id: p.id, meshes, nif };
    if (sheets) {
      const t = byTex.get(p.shapes[0].texture).png;
      out.sheet = writePng(previewSheet(meshes[0], 360, { width: t.width, height: t.height, data: t.data }));
    }
    return out;
  });
  return { pieces, textures };
}

/** The bounds of the scene's reference head and neck - what the set is fitted to the wearer by. */
export function measureReference(tree) {
  return Object.fromEntries(Object.entries(REFERENCE_PARTS).map(([part, name]) => [part, bakeObject(tree, name).bounds]));
}

/**
 * --import: Mac's two exports into the two committed sources. Which is which is read from the files (the open helm's
 * object is in one, the closed helm's in the other), every object they share must bake the same from both, and the
 * reference body comes out of each - measured first.
 */
export function importSteelPlate(a, b) {
  const helmOf = (bytes) => meshModelNames(bytes);
  const [openBytes, closedBytes] = helmOf(a).includes('Sphere.002') ? [a, b] : [b, a];
  if (!helmOf(openBytes).includes('Sphere.002') || !helmOf(closedBytes).includes('Sphere')) {
    throw new Error('these are not the two steel-plate exports: one must carry the open helm (Sphere.002), the other the closed (Sphere)');
  }
  const trees = { open: readFbx(Buffer.from(openBytes)), closed: readFbx(Buffer.from(closedBytes)) };
  const shared = helmOf(openBytes).filter((n) => helmOf(closedBytes).includes(n));
  for (const name of shared) {
    const x = JSON.stringify(bakeObject(trees.open, name)); const y = JSON.stringify(bakeObject(trees.closed, name));
    if (x !== y) throw new Error(`"${name}" differs between the two exports - the bake reads it from the open helm's, so say which is meant`);
  }
  const reference = measureReference(trees.open);
  const refNames = Object.values(REFERENCE_PARTS);
  const closedKeep = new Set(PIECES.filter((p) => p.file === 'closed').flatMap((p) => p.shapes.map((s) => s.object)));
  const open = stripFbx(openBytes, { drop: refNames }).bytes;
  const closed = stripFbx(closedBytes, { drop: helmOf(closedBytes).filter((n) => !closedKeep.has(n)) }).bytes;
  return { open, closed, reference, shared: shared.filter((n) => !refNames.includes(n)) };
}

const save = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const imp = opt('import');
  if (imp) {
    const files = imp.split(',');
    if (files.length !== 2) { console.error('usage: --import=<New_Ship.fbx>,<New_Ship1.fbx>'); process.exit(2); }
    const r = importSteelPlate(readFileSync(files[0]), readFileSync(files[1]));
    save(SOURCE.open, r.open);
    save(SOURCE.closed, r.closed);
    console.log(`${SOURCE.open}  ${r.open.length} bytes: ${meshModelNames(r.open).join(', ')}`);
    console.log(`${SOURCE.closed}  ${r.closed.length} bytes: ${meshModelNames(r.closed).join(', ')}`);
    console.log(`  ${r.shared.length} pieces the two exports share, the same in both`);
    console.log('  the reference body, stripped - its bounds for ownArmorModels.js STEEL_PLATE_SCENE:');
    for (const [part, b] of Object.entries(r.reference)) console.log(`    ${part}: min ${JSON.stringify(b.min)} max ${JSON.stringify(b.max)}`);
  }
  const missing = Object.entries(TEXTURES).filter(([, p]) => !existsSync(p)).map(([t]) => t);
  if (missing.length) { console.error(`no painting yet for: ${missing.join(', ')} (${missing.map((t) => TEXTURES[t]).join(', ')})`); process.exit(1); }
  const wantSheets = args.includes('--sheets');
  const r = bakeSteelPlate({
    open: readFileSync(SOURCE.open), closed: readFileSync(SOURCE.closed),
    pngs: Object.fromEntries(Object.entries(TEXTURES).map(([t, p]) => [t, readFileSync(p)])),
  }, { sheets: wantSheets });
  for (const p of r.pieces) {
    save(meshFile(p.id), p.nif);
    const tris = p.meshes.reduce((n, m) => n + m.indices.length / 3, 0);
    console.log(`  ${p.id.padEnd(15)} ${String(tris).padStart(4)} triangles -> ${meshFile(p.id)}  ${p.nif.length} bytes`);
    if (wantSheets) save(`scratch/steel-plate-${p.id}.png`, p.sheet);
  }
  for (const t of r.textures) {
    save(textureFile(t.tex), t.dds);
    console.log(`  ${t.tex.padEnd(15)} ${t.png.width}x${t.png.height} -> ${textureFile(t.tex)}  ${t.dds.length} bytes`);
  }
}
