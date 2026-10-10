// THE THREE NEW WAGONS' MODELS, BAKED OUT OF MAC'S BLENDER SCENE.
//
//     node tools/bakeWagons.mjs [--fbx=src/assets/wagons/source/Wagon_Cart_Tiny_1.fbx] [--list]
//
// WAGONS1 (2026-10-09, Mac, sending Wagon_Cart_1.fbx, Wagon_1.fbx, Caravan_1-1.fbx and then Wagon_Cart_Tiny_1.fbx: "Here
// are 3 new models that will need to be textured - 1. Is a replacement model for the current cart ingame 2. Theres an
// open wagon which I want to implement as a new type of cart with increased storage and the ability for players to
// request to sit in the back of the cart and be transported across daggerfall 3. Is a closed wagon varient that also
// increases storage but also acts as an enterable and customizable interior"; asked, the cart that replaces the Small
// Cart is the Wagon Cart).
//
// THE FOUR FILES ARE ONE SCENE SAVED FOUR TIMES ("wagons.blend" in each header), each a Blender 5.1.1 export:
// Caravan_1-1.fbx at 16:34:29 on 2026-09-22, Wagon_1.fbx at 16:58:24, Wagon_Cart_1.fbx at 17:06:30 and
// Wagon_Cart_Tiny_1.fbx at 16:29:16 the next day (their headers' creation stamps). Mac keeps his wagons as WORKING
// STATIONS along the scene's X - each a scene of parts, a body, a bench, axles, each wheel its own object - and every
// save added one: read object for object, every object of the first three is in the newest to the micrometre, but
// one (Caravan_1-1.fbx's Cube.005, a joined copy of the caravan, gone from the later saves and its name reused). So the
// newest is the one committed (src/assets/wagons/source/Wagon_Cart_Tiny_1.fbx) and all three wagons bake out of it.
// None embeds a texture - their materials are Blender's default grey, their UVs Blender's default unwraps - so each
// wagon is painted (world/wagonArt.js) and every face laid on its picture by world/wagonModels.js.
//
// THE STATIONS (`--list`; boxes in scene metres, Z up):
//   X ~ 0    THE CARAVAN - a closed body under a rounded roof (Cube), a driver's bench (Cube.001) and a step under it
//            (Cube.002) at its fore end, two axles, four wheels: Caravan_1-1.fbx's (`CARAVAN`).
//   X ~ 25   a second caravan, its body cut differently and no step (Cube.003, Cube.005, Cylinder.007-.012): an earlier
//            idea of the first, never sent as a model of its own - skipped (`band`).
//   X ~ 41   THE OPEN WAGON - a hooped tilt open at both ends (Cube.004), its bench (Cube.006), two axles, four wheels:
//            Wagon_1.fbx's (`OPEN_WAGON`).
//   X ~ 57   THE WAGON CART - a two-wheeled box (Cube.007) on one axle, two shafts forward (Cube.009, Cube.010):
//            Wagon_Cart_1.fbx's (`CART`), the Small Cart's new model.
//   X ~ 74   a handcart with two legs and short handles (Cube.012-.016, Cylinder.022-.024): Wagon_Cart_Tiny_1.fbx's,
//            which Mac was not sure of ("This might be the small cart. Im not sure") and the Wagon Cart was chosen
//            over - skipped (`band`).
//   Y > 15   each station's parts JOINED into one object (Cube.008, Cube.011, Cube.017) - the same faces again, no
//            wheel of its own to turn - skipped (`minY`).
//
// EACH WAGON'S FRAME (`frame`): the port's wagon - metres, +x its right, +y up, +z the way it is pulled (Unity's, as
// the Small Cart's model 41214 stands: the horse hitched ahead on +z, systems/horseCartLaw.js HITCHED_HORSE_LOCAL_Z) -
// with its origin ON THE GROUND UNDER ITS REAR WHEELS' CENTRES: `centre` the body object's own scene X (to the bit, as a
// ship's centreline is her hull's Y - the cart's wheels stand 3.8 scene cm off it, as drawn), `rear` the rear wheels'
// own origin Y (their turning centre), `ground` their lowest corner's Z. The caravan and the open wagon are drawn with
// their benches toward -Y, the cart with its shafts toward +Y (`forward`). Mac's scene is right-handed and the world
// left-handed (world/mat4.js THE HANDEDNESS LAW), so either way the map is a MIRROR in the numbers and every polygon's
// corners are reversed on the way through (tools/shipBake.mjs bakePart, which takes `toWagon` as its frame).
//
// SCALE 0.45, one for all three - they are one scene at one size: the cart's wheels 1.13 m across and its box 2.4 m
// long, the caravan's body 5.8 m long, 2.7 m wide and 3.5 m to its roof, its floor 0.94 m up and 2.57 m under the
// roof - a Daggerfall horse (the mod's 3 m billboard) to pull them and a body to stand in.
//
// The output is one JSON a wagon, each a test re-bakes byte for byte (test/wagons1_bake.test.js): the source is
// committed beside them, so the files are a DERIVATION, never a blob.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { readFbx, childNamed } from './fbxRead.mjs';
import { sceneObjects, assertBlenderFill, bakePart, bakeJson, boxOf, mm, listScene, sourcePath, ROOT, BOX_SLACK } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

export const SOURCE_FBX = 'src/assets/wagons/source/Wagon_Cart_Tiny_1.fbx';
export const SCALE = 0.45;

/** A scene point (metres, Z up) in a wagon's frame (`frame`: its scale, centre, rear, ground and forward). */
export function toWagon([x, y, z], frame) {
  const s = frame.scale;
  if (frame.forward === '-Y') return [(frame.centre - x) * s, (z - frame.ground) * s, (frame.rear - y) * s];
  if (frame.forward === '+Y') return [(x - frame.centre) * s, (z - frame.ground) * s, (y - frame.rear) * s];
  throw new Error(`a wagon is pulled toward -Y or +Y in Mac's scene, not ${frame.forward}`);
}

const role = (r, box) => Object.freeze({ role: r, box });
const off = Object.freeze({ band: true });
const joined = Object.freeze({ minY: 15 });

/** Every object of the scene: which wagon reads it, or what it is (checked - `skipFault`). */
const STATION_X = Object.freeze({ caravan: [-10, 10], second: [10, 34], open: [34, 50], cart: [50, 66], tiny: [66, 82] });

/** THE CARAVAN (X ~ 0): pulled toward -Y. */
export const CARAVAN = Object.freeze({
  key: 'caravan', out: 'src/assets/wagons/caravan.json', band: STATION_X.caravan,
  frame: Object.freeze({ scale: SCALE, forward: '-Y', centre: 0, rear: 4.166549072265625, ground: -3.8911753456700353 }),
  roles: Object.freeze({
    Cube: role('body', [[-3.021, -7.203, -1.797], [3.021, 5.739, 3.923]]),
    'Cube.001': role('bench', [[-2.975, -9.028, -1.693], [2.975, -6.517, 1.806]]),
    'Cube.002': role('step', [[-2.799, -9.728, -1.656], [2.799, -8.894, 0.379]]),
    'Cylinder.001': role('axleRear', [[-3.562, 3.963, -2.286], [3.562, 4.393, -1.834]]),
    'Cylinder.006': role('axleFront', [[-3.562, -4.617, -2.286], [3.562, -4.186, -1.834]]),
    'Cylinder.002': role('wheelRearRight', [[-3.479, 2.562, -3.891], [-3.252, 5.947, -0.42]]),
    'Cylinder.003': role('wheelRearLeft', [[3.248, 2.562, -3.891], [3.475, 5.947, -0.42]]),
    'Cylinder.004': role('wheelFrontLeft', [[3.248, -6.017, -3.891], [3.475, -2.632, -0.42]]),
    'Cylinder.005': role('wheelFrontRight', [[-3.479, -6.017, -3.891], [-3.252, -2.632, -0.42]]),
  }),
});

/** THE OPEN WAGON (X ~ 41): pulled toward -Y. */
export const OPEN_WAGON = Object.freeze({
  key: 'openWagon', out: 'src/assets/wagons/openWagon.json', band: STATION_X.open,
  frame: Object.freeze({ scale: SCALE, forward: '-Y', centre: 41.188896484375, rear: 4.166549072265625, ground: -3.8911753456700353 }),
  roles: Object.freeze({
    'Cube.004': role('body', [[38.168, -7.441, -1.797], [44.21, 5.739, 3.926]]),
    'Cube.006': role('bench', [[38.39, -8.391, -1.761], [43.988, -6.731, -0.434]]),
    'Cylinder.013': role('axleRear', [[37.627, 3.963, -2.286], [44.751, 4.393, -1.834]]),
    'Cylinder.018': role('axleFront', [[37.627, -4.617, -2.286], [44.751, -4.186, -1.834]]),
    'Cylinder.014': role('wheelRearRight', [[37.71, 2.562, -3.891], [37.937, 5.947, -0.42]]),
    'Cylinder.015': role('wheelRearLeft', [[44.437, 2.562, -3.891], [44.664, 5.947, -0.42]]),
    'Cylinder.016': role('wheelFrontLeft', [[44.437, -6.017, -3.891], [44.664, -2.632, -0.42]]),
    'Cylinder.017': role('wheelFrontRight', [[37.71, -6.017, -3.891], [37.937, -2.632, -0.42]]),
  }),
});

/** THE WAGON CART (X ~ 57): pulled toward +Y, its one axle the rear. */
export const CART = Object.freeze({
  key: 'cart', out: 'src/assets/wagons/cart.json', band: STATION_X.cart,
  frame: Object.freeze({ scale: SCALE, forward: '+Y', centre: 56.990771484375, rear: -4.424051208496094, ground: -2.9596500751362784 }),
  roles: Object.freeze({
    'Cube.007': role('body', [[54.415, -5.502, -2.637], [59.566, 0.858, 0.897]]),
    'Cube.009': role('shaftRight', [[58.104, 0.288, -2.99], [58.384, 2.554, -2.32]]),
    'Cube.010': role('shaftLeft', [[55.263, 0.288, -2.99], [55.543, 2.554, -2.32]]),
    'Cylinder.019': role('axleRear', [[54.156, -4.632, -1.889], [59.904, -4.185, -1.444]]),
    'Cylinder.020': role('wheelRearLeft', [[54.223, -5.69, -2.96], [54.407, -3.13, -0.437]]),
    'Cylinder.021': role('wheelRearRight', [[59.65, -5.69, -2.96], [59.834, -3.13, -0.437]]),
  }),
});

export const WAGONS = Object.freeze([CART, OPEN_WAGON, CARAVAN]);

/** What the scene keeps that no wagon wears, each checked to be what it is said to be: `band`, a station of its own
 *  (wholly outside every wagon's band of the scene's X - the second caravan's and the handcart's parts); `minY`, a
 *  station's parts joined into one object, wholly beyond that scene Y. */
export const SKIP = Object.freeze(Object.fromEntries([
  ...['Cube.003', 'Cube.005', 'Cylinder.007', 'Cylinder.008', 'Cylinder.009', 'Cylinder.010', 'Cylinder.011', 'Cylinder.012',
    'Cube.012', 'Cube.013', 'Cube.014', 'Cube.015', 'Cube.016', 'Cylinder.022', 'Cylinder.023', 'Cylinder.024'].map((n) => [n, off]),
  ...['Cube.008', 'Cube.011', 'Cube.017'].map((n) => [n, joined]),
]));

/** A skipped object's fault, or null: `band` wholly outside every wagon's X band; `minY` wholly beyond that Y. */
function skipFault(o, skip, wagons = WAGONS) {
  const b = boxOf(o.scene);
  if (skip.band) {
    const inside = wagons.find((w) => !(b.max[0] < w.band[0] || b.min[0] > w.band[1]));
    return inside ? `${o.name} was to be another station's and stands in the ${inside.key}'s (X ${b.min[0].toFixed(2)} to ${b.max[0].toFixed(2)})` : null;
  }
  return !(b.min[1] > skip.minY) ? `${o.name} was to be a joined copy beyond Y ${skip.minY} and stands at Y ${b.min[1].toFixed(2)}` : null;
}

/** The ground and the rear a wagon's frame names are its rear wheels' own: their lowest corner and their origin's Y,
 *  to the bit - or the bake refuses, so a re-export that moved a wheel is read again. */
function assertFrame(spec, byName) {
  const wheels = Object.entries(spec.roles).filter(([, r]) => r.role.startsWith('wheelRear')).map(([n]) => byName.get(n));
  if (wheels.length !== 2) throw new Error(`the ${spec.key} has ${wheels.length} rear wheels`);
  for (const w of wheels) {
    if (w.origin[1] !== spec.frame.rear) throw new Error(`the ${spec.key}'s ${w.name} turns about scene Y ${w.origin[1]} and its frame's rear is ${spec.frame.rear}`);
    const low = boxOf(w.scene).min[2];
    if (low !== spec.frame.ground) throw new Error(`the ${spec.key}'s ${w.name} stands on scene Z ${low} and its frame's ground is ${spec.frame.ground}`);
  }
  const body = byName.get(Object.entries(spec.roles).find(([, r]) => r.role === 'body')[0]);
  if (body.origin[0] !== spec.frame.centre) throw new Error(`the ${spec.key}'s body stands at scene X ${body.origin[0]} and its frame's centre is ${spec.frame.centre}`);
}

/**
 * The bake: the FBX's bytes in, each wagon's parts out (`{ cart, openWagon, caravan }`). Pure. Every object of the
 * scene is read by exactly one wagon or skipped as what it is; a part not standing where it was read (BOX_SLACK) is
 * refused, as a ship's is. `wagons` and `skip` are the specs (a test hands in ones it has changed, to see it refuse).
 */
export function bakeWagons(fbxBytes, tree = readFbx(fbxBytes), source = SOURCE_FBX, wagons = WAGONS, skips = SKIP) {
  assertBlenderFill(tree);
  const objects = sceneObjects(tree);
  const byName = new Map(objects.map((o) => [o.name, o]));
  const sha256 = createHash('sha256').update(fbxBytes).digest('hex');
  const creator = childNamed(tree.nodes, 'Creator')?.props[0] ?? null;
  for (const o of objects) {
    const skip = skips[o.name];
    const readers = wagons.filter((w) => w.roles[o.name]);
    if (skip && readers.length) throw new Error(`${o.name} is both skipped and read by the ${readers[0].key}`);
    if (skip) { const fault = skipFault(o, skip, wagons); if (fault) throw new Error(fault); continue; }
    if (readers.length !== 1) throw new Error(`${o.name} plays no part on any wagon - name it in a wagon's roles (or SKIP) after reading the scene`);
  }
  const out = {};
  for (const spec of wagons) {
    for (const n of Object.keys(spec.roles)) if (!byName.has(n)) throw new Error(`the scene has no ${n} (the ${spec.key}'s ${spec.roles[n].role})`);
    assertFrame(spec, byName);
    const place = (p) => toWagon(p, spec.frame);
    const parts = Object.entries(spec.roles).map(([name, r]) => {
      const o = byName.get(name);
      const b = boxOf(o.scene);
      const far = Math.max(...[b.min, b.max].flatMap((end, e) => end.map((v, k) => Math.abs(v - r.box[e][k]))));
      if (!(far <= BOX_SLACK)) throw new Error(`${name} (the ${spec.key}'s ${r.role}) was read standing in the box ${JSON.stringify(r.box)} and stands in ${JSON.stringify(mm(b))}; read the scene again (--list) before re-baking`);
      const part = bakePart(r.role, o, o.polygons.map((_, k) => k), place);
      // the part's own turning centre - a wheel's origin, where Mac's cylinder was drawn about - in the wagon's frame
      return { ...part, origin: place(o.origin).map((v) => Math.round(v * 1e4) / 1e4 + 0) };
    });
    out[spec.key] = { bake: 'tools/bakeWagons.mjs', source, sha256, creator, wagon: spec.key, frame: { ...spec.frame }, parts };
  }
  return out;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const fbx = resolve(opt('fbx', resolve(ROOT, SOURCE_FBX)));
  const bytes = readFileSync(fbx);
  if (args.includes('--list')) {
    const spec = { roles: Object.fromEntries(WAGONS.flatMap((w) => Object.entries(w.roles).map(([n, r]) => [n, { role: `${w.key}.${r.role}` }]))), skip: SKIP };
    for (const line of listScene(bytes, spec)) console.log(line);
  } else {
    const baked = bakeWagons(bytes, readFbx(bytes), sourcePath(fbx));
    for (const spec of WAGONS) {
      const out = resolve(ROOT, spec.out);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, bakeJson(baked[spec.key]));
      console.log(`${fbx} -> ${out}`);
      for (const p of baked[spec.key].parts) console.log(`  ${p.role.padEnd(16)} ${p.object.padEnd(14)} ${String(p.positions.length / 3).padStart(4)} vertices ${String(p.polygons.length).padStart(3)} polygons ${String(p.triangles.length / 3).padStart(4)} triangles${p.split ? ` (${p.split} cut)` : ''}`);
    }
  }
}
