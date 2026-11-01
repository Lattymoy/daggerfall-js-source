// OWN-WORK4 (2026-10-31; the owner: "Our goal is no latching onto other mod authors or needing permissions"): OUR OWN
// BIPED, the skeleton the pins and the bakes stand a Morrowind body on. It replaces the retail hierarchy Weapon
// Sheathing's skeleton addon carried, which is retired. Morrowind's own skeleton is the player's, never the tree's.
//
//   THE NAMES AND THE TREE are the game's interface: the Bip01 bones a retail body binds by name, and their parents.
//   THE BIND is our own record: where each bone stands in the bind our shipped armour is skinned in (the steel plate's
//     bone nodes, src/assets/mw/meshes/steel_plate_*.nif), in the bake's scene frame (the soles on z = 0, facing +Y).
//   THE REST is our rule, an idle stance with the weight on the right leg: every bone at its bind, but each arm
//     turned about the body's forward axis to hang out from the side and its elbow bent forward, each shoulder let
//     down and rolled forward as the arms fall (STANCE, the left a little looser than the right), and the right leg a
//     half-step ahead (its thigh forward, its shin upright again).
//   THE GRIPS are our rule: "Weapon Bone" and "Shield Bone" sit in each fist, at the knuckles (GRIP_REACH, GRIP_INDEX:
//     more the index finger's than the middle's) and GRIP_PALM_DEPTH into the palm, square to the body at the bind.
//   THE TRI SHADOW is the skin the bakes read the bind from (tools/bakeSteelPlate.mjs retailBind): one triangle over
//     the 32 bones, each bound at its bind less SHADOW_FROM_SCENE.
import { writeNif } from './nifWrite.mjs';

/** The bind our armour is skinned in: [name, rotation (row-major 3x3), translation], parents before children. */
export const BIPED_BIND = Object.freeze(
  [
    ['Bip01 Pelvis', [0.0000013670301086676773, -0.0000028173117243568413, -0.9999999403953552, 3.822114066215354e-12, 1, -0.0000028173117243568413, 0.9999999403953552, -4.697743997733768e-14, 0.0000013670301086676773], [3.5252421071163553e-7, 0.4013254642486572, 76.37200164794922]],
    ['Bip01 Spine', [2.8959236786363363e-8, 0.0000013431250636131153, -1, 0.0007962305098772049, 0.9999997019767761, 0.00000134311335386883, 0.9999996423721313, -0.0007962305098772049, 2.7889807796555033e-8], [2.410634181160276e-7, 0.3946039378643036, 83.98426818847656]],
    ['Bip01 L Thigh', [-2.4143552934674517e-8, -0.0000015176045735643129, 1, 0.030182648450136185, 0.9995443820953369, 0.0000015175781982179615, -0.9995443820953369, 0.030182648450136185, 2.1665787386382362e-8], [-6.619357585906982, 0.4013128876686096, 76.37200164794922]],
    ['Bip01 L Calf', [2.904244134072087e-8, -0.0000015154365655689617, 1, -0.04762148857116699, 0.9988654255867004, 0.0000015168164964052266, -0.9988654851913452, -0.04762148857116699, -4.3203382205092566e-8], [-6.619358539581299, 1.3806740045547485, 43.938941955566406]],
    ['Bip01 L Foot', [5.0123109218702666e-8, -0.0000014305118156698882, 0.9999999403953552, 1.0331608280012006e-7, 1, 0.0000014305118156698882, -0.9999999403953552, 1.0331606858926534e-7, 5.0123258432677176e-8], [-6.619354724884033, -0.3983103930950165, 6.624582290649414]],
    ['Bip01 R Thigh', [-2.4143552934674517e-8, -0.0000015176045735643129, 1, 0.030182648450136185, 0.9995443820953369, 0.0000015175781982179615, -0.9995443820953369, 0.030182648450136185, 2.1665787386382362e-8], [6.619358539581299, 0.4013317823410034, 76.37200164794922]],
    ['Bip01 R Calf', [2.904244134072087e-8, -0.0000015154365655689617, 1, -0.04762148857116699, 0.9988654255867004, 0.0000015168164964052266, -0.9988654851913452, -0.04762148857116699, -4.3203382205092566e-8], [6.619357585906982, 1.380692958831787, 43.93894577026367]],
    ['Bip01 R Foot', [5.0123109218702666e-8, -0.0000014305118156698882, 0.9999999403953552, 1.0331608280012006e-7, 1, 0.0000014305118156698882, -0.9999999403953552, 1.0331606858926534e-7, 5.0123258432677176e-8], [6.619360446929932, -0.3982917070388794, 6.624582767486572]],
    ['Bip01 Spine1', [2.8959236786363363e-8, 0.0000013431250636131153, -1, 0.0007962305098772049, 0.9999997019767761, 0.00000134311335386883, 0.9999996423721313, -0.0007962305098772049, 2.7889807796555033e-8], [1.1042452285892068e-7, 0.3921853005886078, 92.42069244384766]],
    ['Bip01 Spine2', [2.8959236786363363e-8, 0.0000013431250636131153, -1, 0.0007962305098772049, 0.9999997019767761, 0.00000134311335386883, 0.9999996423721313, -0.0007962305098772049, 2.7889807796555033e-8], [-7.313767014238692e-8, 0.3930153548717499, 103.89425659179688]],
    ['Bip01 Neck', [2.8959236786363363e-8, 0.0000013431250636131153, -1, 0.0007962305098772049, 0.9999997019767761, 0.00000134311335386883, 0.9999996423721313, -0.0007962305098772049, 2.7889807796555033e-8], [-2.4515853169759794e-7, 0.3973672091960907, 114.32475280761719]],
    ['Bip01 Head', [1.8331464346488247e-8, 0.000001343088456451369, -0.9999999403953552, -0.000001430511474609375, 1, 0.000001343088456451369, 0.9999999403953552, 0.0000014305115882962127, 1.83333828118748e-8], [-3.296525790119631e-7, 0.40132036805152893, 119.28926086425781]],
    ['Bip01 L Clavicle', [-0.9800665974617004, 0.000001439196125829767, -0.19866938889026642, -0.000001393312800246349, -1, -3.7075042769174615e-7, -0.19866938889026642, -8.655147354375003e-8, 0.9800665974617004], [-2.3169991970062256, 0.3431239724159241, 114.324951171875]],
    ['Bip01 L UpperArm', [-0.9971466064453125, 0.0542619526386261, -0.05248039588332176, -0.05434861779212952, -0.9985219240188599, 0.0002246952790301293, -0.05239063873887062, 0.003076291410252452, 0.998621940612793], [-11.687703132629395, 0.3431110680103302, 112.4254150390625]],
    ['Bip01 L Forearm', [-0.9980578422546387, -0.033564504235982895, -0.05248039960861206, 0.033599015325307846, -0.9994354248046875, 0.0002246952790301293, -0.05245830863714218, -0.001539030927233398, 0.998621940612793], [-29.649738311767578, -0.6358948349952698, 111.481689453125]],
    ['Bip01 L Hand', [-0.9980577826499939, 0.052453652024269104, -0.03360627591609955, 0.033599019050598145, -0.0010204698191955686, -0.9994348883628845, -0.052458301186561584, -0.9986228346824646, -0.000743952754419297], [-46.55265808105469, -0.06686688214540482, 110.59325408935547]],
    ['Bip01 L Finger0', [-0.8475609421730042, 0.5280967354774475, 0.052480388432741165, 0.5288154482841492, 0.8487368226051331, -0.00022469405666925013, -0.044660698622465134, 0.02756199985742569, -0.9986218810081482], [-50.946990966796875, 3.3321022987365723, 108.9249496459961]],
    ['Bip01 L Finger01', [-0.8475609421730042, 0.5280967354774475, 0.052480388432741165, 0.5288154482841492, 0.8487368226051331, -0.00022469405666925013, -0.044660698622465134, 0.02756199985742569, -0.9986218810081482], [-53.05674743652344, 4.64843225479126, 108.81377410888672]],
    ['Bip01 L Finger1', [-0.9980578422546387, 0.05248039960861206, -0.033564500510692596, 0.033599019050598145, -0.0002247351803816855, -0.9994354248046875, -0.05245830863714218, -0.9986220002174377, -0.0015390787739306688], [-52.91300964355469, 2.313103199005127, 110.25894165039062]],
    ['Bip01 L Finger11', [-0.9980578422546387, 0.05248039960861206, -0.033564500510692596, 0.033599019050598145, -0.0002247351803816855, -0.9994354248046875, -0.05245830863714218, -0.9986220002174377, -0.0015390787739306688], [-55.80784606933594, 2.4105560779571533, 110.1067886352539]],
    ['Bip01 L Finger2', [-0.9980578422546387, 0.05248039960861206, -0.033564500510692596, 0.033599019050598145, -0.0002247351803816855, -0.9994354248046875, -0.05245830863714218, -0.9986220002174377, -0.0015390787739306688], [-53.010005950927734, -0.5708986520767212, 110.25395202636719]],
    ['Bip01 L Finger21', [-0.9980578422546387, 0.05248039960861206, -0.033564500510692596, 0.033599019050598145, -0.0002247351803816855, -0.9994354248046875, -0.05245830863714218, -0.9986220002174377, -0.0015390787739306688], [-55.908443450927734, -0.47332441806793213, 110.10160064697266]],
    ['Bip01 R Clavicle', [0.9800665974617004, 0.0000014218277328836848, -0.19866935908794403, 0.0000014106809658187558, -1.0000001192092896, -1.9764736691740836e-7, -0.19866935908794403, -8.655148775460475e-8, -0.9800666570663452], [2.3169991970062256, 0.343123197555542, 114.32495880126953]],
    ['Bip01 R UpperArm', [0.9971468448638916, -0.05425892770290375, -0.05248036980628967, -0.05434560030698776, -0.9985222220420837, -0.00022485452063847333, -0.05239061266183853, 0.0030762897804379463, -0.9986220002174377], [11.687705039978027, 0.3431369662284851, 112.4254150390625]],
    ['Bip01 R Forearm', [0.9980576038360596, 0.03356753662228584, -0.052480366080999374, 0.033602047711610794, -0.9994352459907532, -0.00022485463705379516, -0.052458275109529495, -0.0015390298794955015, -0.9986218810081482], [29.64973258972168, -0.6358128786087036, 111.481689453125]],
    ['Bip01 R Hand', [0.9980576038360596, -0.05245361849665642, -0.033609312027692795, 0.033602047711610794, -0.0010207745945081115, 0.9994348287582397, -0.052458275109529495, -0.9986228942871094, 0.0007437567110173404], [46.55264663696289, -0.06673562526702881, 110.59326171875]],
    ['Bip01 R Finger0', [0.84755939245224, -0.5280992984771729, 0.052480362355709076, 0.5288180112838745, 0.8487352132797241, 0.00022485492809209973, -0.044660672545433044, 0.027561981230974197, 0.998621940612793], [50.94699478149414, 3.33210825920105, 108.92495727539062]],
    ['Bip01 R Finger01', [0.84755939245224, -0.5280992984771729, 0.052480362355709076, 0.5288180112838745, 0.8487352132797241, 0.00022485492809209973, -0.044660672545433044, 0.027561981230974197, 0.998621940612793], [53.05674743652344, 4.648446559906006, 108.81377410888672]],
    ['Bip01 R Finger1', [0.9980576038360596, -0.052480366080999374, -0.03356753662228584, 0.033602047711610794, -0.00022484842338599265, 0.999435305595398, -0.052458275109529495, -0.998621940612793, 0.0015390359330922365], [52.912994384765625, 2.3131062984466553, 110.25894927978516]],
    ['Bip01 R Finger11', [0.9980576038360596, -0.052480366080999374, -0.03356753662228584, 0.033602047711610794, -0.00022484842338599265, 0.999435305595398, -0.052458275109529495, -0.998621940612793, 0.0015390359330922365], [55.807830810546875, 2.4105679988861084, 110.10679626464844]],
    ['Bip01 R Finger2', [0.9980576038360596, -0.052480366080999374, -0.03356753662228584, 0.033602047711610794, -0.00022484842338599265, 0.999435305595398, -0.052458275109529495, -0.998621940612793, 0.0015390359330922365], [53.00999069213867, -0.5708940029144287, 110.25395202636719]],
    ['Bip01 R Finger21', [0.9980576038360596, -0.052480366080999374, -0.03356753662228584, 0.033602047711610794, -0.00022484842338599265, 0.999435305595398, -0.052458275109529495, -0.998621940612793, 0.0015390359330922365], [55.90842819213867, -0.47331100702285767, 110.10160827636719]],
  ].map(([name, a, t]) => Object.freeze({ name, a: Object.freeze(a), t: Object.freeze(t) })),
);

/** Each bone's parent - the game's own tree. */
export const BIPED_PARENT = Object.freeze({
  'Bip01': null,
  'Bip01 Pelvis': 'Bip01',
  'Bip01 Spine': 'Bip01 Pelvis',
  'Bip01 L Thigh': 'Bip01 Spine',
  'Bip01 L Calf': 'Bip01 L Thigh',
  'Bip01 L Foot': 'Bip01 L Calf',
  'Bip01 R Thigh': 'Bip01 Spine',
  'Bip01 R Calf': 'Bip01 R Thigh',
  'Bip01 R Foot': 'Bip01 R Calf',
  'Bip01 Spine1': 'Bip01 Spine',
  'Bip01 Spine2': 'Bip01 Spine1',
  'Bip01 Neck': 'Bip01 Spine2',
  'Bip01 Head': 'Bip01 Neck',
  ...Object.fromEntries(
    ['L', 'R'].flatMap((s) => [
      [`Bip01 ${s} Clavicle`, 'Bip01 Neck'],
      [`Bip01 ${s} UpperArm`, `Bip01 ${s} Clavicle`],
      [`Bip01 ${s} Forearm`, `Bip01 ${s} UpperArm`],
      [`Bip01 ${s} Hand`, `Bip01 ${s} Forearm`],
      ...['0', '1', '2'].flatMap((f) => [
        [`Bip01 ${s} Finger${f}`, `Bip01 ${s} Hand`],
        [`Bip01 ${s} Finger${f}1`, `Bip01 ${s} Finger${f}`],
      ]),
    ]),
  ),
  'Weapon Bone': 'Bip01 R Hand',
  'Shield Bone': 'Bip01 L Hand',
});

/** The shadow's frame against the scene's: the bakes add it back (tools/bakeSteelPlate.mjs SCENE_FROM_BIND). */
export const SHADOW_FROM_SCENE = Object.freeze([0, 2.5, 98.55]);
/** The idle stance, in degrees: each shoulder let down (`shrug`) and rolled forward (`roll`) from the bind's, each arm
 *  out from the side and each elbow bent forward, the right thigh forward. */
export const STANCE = Object.freeze({
  shrug: Object.freeze({ R: 12, L: 10 }),
  roll: 12,
  hang: Object.freeze({ R: 6, L: 8 }),
  elbow: Object.freeze({ R: 10, L: 14 }),
  step: 6,
});
/** How far from the wrist toward the knuckles each grip sits. */
export const GRIP_REACH = 1;
/** How much of the fist's knuckle point is the index finger's (the rest the middle finger's). */
export const GRIP_INDEX = 0.7;
/** How far into the palm each grip sits, in units. */
export const GRIP_PALM_DEPTH = 0.8;

const IDENTITY = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const mul3 = (p, q) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => p[r * 3] * q[c] + p[r * 3 + 1] * q[3 + c] + p[r * 3 + 2] * q[6 + c]));
const apply3 = (m, v) => [0, 1, 2].map((r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2]);
const transpose3 = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const sub = (a, b) => a.map((v, k) => v - b[k]);
const add = (a, b) => a.map((v, k) => v + b[k]);
/** A transform's inverse, for rigid ones: (R^T, -R^T t). */
const rigidInverse = ({ a, t }) => {
  const r = transpose3(a);
  return { a: r, t: apply3(r, t).map((v) => -v) };
};
const compose = (p, q) => ({ a: mul3(p.a, q.a), t: add(apply3(p.a, q.t), p.t) });
/** A turn about the world's Y (the body's forward axis) and X (its right) by `rad`. */
const turnY = (rad) => [Math.cos(rad), 0, Math.sin(rad), 0, 1, 0, -Math.sin(rad), 0, Math.cos(rad)];
const turnZ = (rad) => [Math.cos(rad), -Math.sin(rad), 0, Math.sin(rad), Math.cos(rad), 0, 0, 0, 1];
const turnX = (rad) => [1, 0, 0, 0, Math.cos(rad), -Math.sin(rad), 0, Math.sin(rad), Math.cos(rad)];
const RAD = Math.PI / 180;

const BIND = new Map(BIPED_BIND.map((b) => [b.name, b]));
const under = (name, root) => {
  for (let n = name; n; n = BIPED_PARENT[n]) if (n === root) return true;
  return false;
};

/** Each node's place at rest, in the scene frame: Map(name -> { a, t }). */
export function bipedRest() {
  const world = new Map();
  world.set('Bip01', { a: [...IDENTITY], t: [...BIND.get('Bip01 Pelvis').t] });
  for (const b of BIPED_BIND) world.set(b.name, { a: [...b.a], t: [...b.t] });
  for (const s of ['R', 'L']) {
    const hand = BIND.get(`Bip01 ${s} Hand`);
    const knuckles = [1, 2].map((f) => BIND.get(`Bip01 ${s} Finger${f}`).t);
    const fist = knuckles[0].map((v, k) => v * GRIP_INDEX + knuckles[1][k] * (1 - GRIP_INDEX));
    const mid = fist.map((v, k) => hand.t[k] + (v - hand.t[k]) * GRIP_REACH);
    const palm = [hand.a[1], hand.a[4], hand.a[7]]; // the hand's own +Y: its palm side
    world.set(s === 'R' ? 'Weapon Bone' : 'Shield Bone', { a: [...IDENTITY], t: add(mid, palm.map((v) => v * GRIP_PALM_DEPTH)) });
  }
  // turn `root` and everything under it by `q`, about the root's own origin
  const turn = (root, q) => {
    const o = world.get(root).t;
    for (const [name, m] of world) {
      if (under(name, root)) world.set(name, { a: mul3(q, m.a), t: add(o, apply3(q, sub(m.t, o))) });
    }
  };
  for (const s of ['R', 'L']) {
    turn(`Bip01 ${s} Clavicle`, turnY((s === 'R' ? 1 : -1) * STANCE.shrug[s] * RAD));
    turn(`Bip01 ${s} Clavicle`, turnZ((s === 'R' ? 1 : -1) * STANCE.roll * RAD));
    const arm = world.get(`Bip01 ${s} UpperArm`);
    const x = [arm.a[0], arm.a[3], arm.a[6]];
    const side = s === 'R' ? 1 : -1;
    const hang = Math.atan2(-Math.cos(STANCE.hang[s] * RAD), side * Math.sin(STANCE.hang[s] * RAD));
    turn(`Bip01 ${s} UpperArm`, turnY(Math.atan2(x[2], x[0]) - hang));
    turn(`Bip01 ${s} Forearm`, turnX(STANCE.elbow[s] * RAD));
  }
  turn('Bip01 R Thigh', turnX(STANCE.step * RAD));
  turn('Bip01 R Calf', turnX(-STANCE.step * RAD));
  return world;
}

/** Our biped as a NIF: the root, the Bip01 tree at its rest, the two grips, and the Tri Shadow (`shadow`). */
export function bipedSkeletonBytes({ shadow = true } = {}) {
  const world = bipedRest();
  const names = Object.keys(BIPED_PARENT);
  const at = new Map(names.map((n, i) => [n, i + 1]));
  const records = [{ type: 'NiNode', name: 'Biped', children: [at.get('Bip01')] }];
  for (const name of names) {
    const parent = BIPED_PARENT[name];
    const local = parent ? compose(rigidInverse(world.get(parent)), world.get(name)) : world.get(name);
    records.push({
      type: 'NiNode',
      name,
      translation: local.t,
      rotation: local.a,
      scale: 1,
      children: names.filter((n) => BIPED_PARENT[n] === name).map((n) => at.get(n)),
    });
  }
  if (shadow) {
    const k = records.length;
    records[0].children.push(k);
    records.push(
      { type: 'NiTriShape', name: 'Tri Shadow', data: k + 1, skin: k + 2 },
      { type: 'NiTriShapeData', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: null, uvs: null, indices: [0, 1, 2] },
      { type: 'NiSkinInstance', data: k + 3, skeletonRoot: at.get('Bip01'), bones: BIPED_BIND.map((b) => at.get(b.name)) },
      {
        type: 'NiSkinData',
        bones: BIPED_BIND.map((b) => {
          const ib = rigidInverse({ a: b.a, t: sub(b.t, SHADOW_FROM_SCENE) });
          return { transform: { rotation: ib.a, translation: ib.t, scale: 1 }, indices: [0, 1, 2], weights: [0.1, 0.1, 0.1] };
        }),
      },
    );
  }
  return writeNif(records, [0]);
}
