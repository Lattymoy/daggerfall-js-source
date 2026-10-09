// THE OBLIVION GATE'S MODEL, BAKED OUT OF ITS BLENDER SCENE.
//
//     node tools/bakeGate.mjs [--fbx=src/assets/gate/source/Oblivion_Gate.fbx] [--out=src/assets/gate/oblivionGate.json]
//                             [--list]
//
// GATE-FBX (2026-10-09, Mac, sending Oblivion_Gate.fbx: "I want to replace the oblivion gate model with this handcrafted
// model which also needs texturing"). The file is a Blender 5.1.1 export of a whole scene ("Oblivion Models.blend" in its
// header): 1,905 meshes - graves, crypts, crystals, a spiked tower, six lesser arches, a walled yard - and among them THE
// GATE, one object (`OBJECT`, Cube.1688): two pillars on clawed feet, a flared lintel over them, the opening's top
// corners cut in, three spines down each pillar's outside. 60 polygons; its two materials split the pillars, the
// right a copy of the left (the spines are told apart by their shape - world/gateModel.js gateSpines). It is the one
// object read; every other stands wholly clear of its box, and the bake says so of
// each (`assertAlone`), so a piece of the gate exported as an object of its own is refused, never dropped. The file
// embeds no texture - its materials are Blender's default grey - so the gate is painted (world/gateArt.js) and every
// face laid on its picture by world/gateModel.js. The source is committed beside the bake, as the ships' are
// (tools/shipBake.mjs): the bake is a DERIVATION, never a blob.
//
// ITS FRAME (`FRAME`): the gate's own (world/gateModel.js) - metres, the origin on the ground in the middle of the
// threshold, +y up, the pillars across x, the opening facing +z and -z. Mac's scene is Z up, so a scene point (X, Y, Z)
// is the gate's ( X - x, Z - ground, y - Y ) times SCALE - a turn, not a mirror, so every polygon keeps its corners'
// order: each face's (b - a) x (c - a) still points out of the stone, as world/gateModel.js faces' do. `x` and `y` are the
// object's own origin, to the bit - the middle of the cube Mac drew the lintel from (the spines stand 6 cm off it, as
// drawn); `ground` the feet. SCALE 0.53 makes it 16.19 m tall, the 16.2 m of the gate it replaces (WB2's), so the
// beacon, the light, the clearing and the court's fire keep their sense; Mac drew it 30.55 m.
//
// tools/shipBake.mjs does the reading (sceneObjects - the export's axes, the Blender that wrote it, the transforms it
// cannot read, all refused by name) and the cutting (fillFace - each polygon as Blender 5.1 cuts it, or refused).
//
// The output is a JSON a test re-bakes byte for byte (test/gatefbx.test.js).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { readFbx, childNamed } from './fbxRead.mjs';
import { sceneObjects, assertBlenderFill, fillFace, boxOf, mm, round4, bakeJson, sourcePath, ROOT, BOX_SLACK } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

export const SOURCE_FBX = 'src/assets/gate/source/Oblivion_Gate.fbx';
export const OUT = 'src/assets/gate/oblivionGate.json';

/** The gate in Mac's scene, and the box it was read standing in (--list), metres. */
export const OBJECT = 'Cube.1688';
export const BOX = Object.freeze([[-128.626, 58.597, -15.352], [-99.585, 63.727, 15.201]]);
/** Its frame: `x` and `y` the object's own origin in the scene, `ground` its feet's Z, `scale` into the world. */
export const FRAME = Object.freeze({ scale: 0.53, x: -114.166103515625, y: 61.1000537109375, ground: -15.352 });

/** A scene point (metres, Z up) in the gate's frame. */
export const toGate = ([x, y, z], frame = FRAME) => [(x - frame.x) * frame.scale, (z - frame.ground) * frame.scale, (frame.y - y) * frame.scale];

/** Every other object of the scene stands wholly clear of the gate's box - or the bake refuses, naming it. */
export function assertAlone(objects, gate) {
  const g = boxOf(gate.scene);
  for (const o of objects) {
    if (o === gate || !o.scene.length) continue;
    const b = boxOf(o.scene);
    if ([0, 1, 2].every((k) => b.max[k] >= g.min[k] && b.min[k] <= g.max[k])) {
      throw new Error(`${o.name} stands inside the gate's box (${JSON.stringify(mm(b))}) - a piece of the gate exported as an object of its own is not baked; join it to ${gate.name} in Blender, or move it clear`);
    }
  }
}

/**
 * The bake: the FBX's bytes in, the gate out, in tools/shipBake.mjs's shape (one part, `gate`): its positions (the
 * source's corners and no others), its polygons as authored, each one's material, its triangles as Blender cuts them
 * and which polygon each is of. Pure.
 * @param {Uint8Array} fbxBytes
 */
export function bakeGate(fbxBytes, tree = readFbx(fbxBytes), source = SOURCE_FBX) {
  assertBlenderFill(tree);
  const objects = sceneObjects(tree, (name) => name === OBJECT);
  const gate = objects.find((o) => o.name === OBJECT);
  if (!gate) throw new Error(`the scene has no ${OBJECT}`);
  const b = boxOf(gate.scene);
  const off = Math.max(...[b.min, b.max].flatMap((end, e) => end.map((v, k) => Math.abs(v - BOX[e][k]))));
  if (!(off <= BOX_SLACK)) throw new Error(`${OBJECT} was read standing in the box ${JSON.stringify(BOX)} and stands in ${JSON.stringify(mm(b))} - read the scene again (--list) before re-baking`);
  if (gate.origin[0] !== FRAME.x || gate.origin[1] !== FRAME.y) throw new Error(`${OBJECT}'s origin stands at scene (${gate.origin[0]}, ${gate.origin[1]}) and FRAME says (${FRAME.x}, ${FRAME.y}) - set the frame to the object's origin`);
  assertAlone(objects, gate);
  const positions = gate.scene.flatMap((p) => toGate(p).map(round4));
  const polygons = [], material = [], triangles = [], triangleOf = [];
  let split = 0;
  gate.polygons.forEach((poly, k) => {
    polygons.push([...poly]);
    material.push(gate.polyMaterial[k] >= 0 ? gate.materials[gate.polyMaterial[k]] ?? null : null);
    for (const [a, b2, c] of fillFace(gate, k)) { triangles.push(poly[a], poly[b2], poly[c]); triangleOf.push(k); }
    if (poly.length > 3) split++;
  });
  return {
    bake: 'tools/bakeGate.mjs',
    source,
    sha256: createHash('sha256').update(fbxBytes).digest('hex'),
    creator: childNamed(tree.nodes, 'Creator')?.props[0] ?? null,
    frame: { ...FRAME },
    parts: [{ role: 'gate', object: OBJECT, positions, polygons, material, triangles, triangleOf, split }],
  };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const fbx = resolve(opt('fbx', resolve(ROOT, SOURCE_FBX)));
  const out = resolve(opt('out', resolve(ROOT, OUT)));
  const bytes = readFileSync(fbx);
  if (args.includes('--list')) {
    for (const o of sceneObjects(readFbx(bytes), () => false)) if (o.scene.length) console.log(`${o.name.padEnd(14)} ${JSON.stringify(mm(boxOf(o.scene)))}  origin ${JSON.stringify(o.origin)}`);
  } else {
    const baked = bakeGate(bytes, readFbx(bytes), sourcePath(fbx));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, bakeJson(baked));
    const p = baked.parts[0];
    console.log(`${fbx} -> ${out}\n  ${p.object}: ${p.positions.length / 3} vertices, ${p.polygons.length} polygons, ${p.triangles.length / 3} triangles (${p.split} cut)`);
  }
}
