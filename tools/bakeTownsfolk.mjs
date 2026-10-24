// THE TOWNSFOLK'S OUTFITS FOR THE MORROWIND BODY, in one command.
//
//     node tools/bakeTownsfolk.mjs
//         re-make the shipped NIFs and DDSs from the committed export, its fourteen paintings and retail's skeleton
//
// MW-FOLK1 (2026-10-13, the owner: "This is for the Townspeople outfits", with clothes.fbx and the paintings; asked how
// townspeople wear them: each walker sprite's own outfit, in that sprite's colours - bible/04-Characters/Townsfolk-Outfits.md).
// Daggerfall's townspeople are pictures - four outfits a race and a sex (characters/mobile/mobilePerson.js PERSON_TEXTURES) -
// and the export is those outfits made for the Morrowind body: all four Redguard men's (381-384), all four Nord men's
// (387-390), the Bretons' 385 and 386, and the hooded Redguard woman's (398). Each sprite's body wears its picture's
// outfit (characters/ownModels/ownClothingModels.js TOWNSFOLK_OUTFITS), so the body that replaces a picture at its range wears
// what the picture wore.
//
//   NINE OBJECTS, EACH A WHOLE OUTFIT. Every object is one sprite's clothes - a tunic, its sleeves, its hose or
//   breeches, its boots or shoes, a pouch - one material a painting, and it ships as ONE skinned part of one shape per
//   painting (the steel cuirass's breastplate and band are one part of two shapes), worn in no slot of its own (the
//   cloak's door) with the skin it covers hidden (`hides`). The export assigns each object's materials their
//   paintings; Nords 389 and 390 are 388's and 386's outfits in the colours their pictures wear (RECOLOURS): 389's
//   tunic islands are 386's own (602 of 602 corners alike) and wear its painting, its hood - which 386 has not -
//   reading that painting where 386's yoke is painted (2468 of its 2908 texels) and its ground (the other 440), both
//   the hood's teal; 390's boots are 384's (278 of 278 corners alike) and wear 384's painting.
//
//   THE MORROWIND BODY IT WAS MADE ON. The owner's `Breton_Male.018` (385) carried 61 polygons of half a groin under the
//   tunic, painted with Morrowind's own tx_b_n_generic_m_g00 - a piece of the body the outfit was made on, Bethesda's
//   mesh, which the port never ships (MW-STEEL1's law: a source is committed less the body it was fitted on).
//   tools/fbxStrip.mjs CUT them out of the export before it was committed (`--cut=Breton_Male.018:6`): that object's
//   Geometry less those polygons and the 41 vertices only they used, every other record byte for byte, the slot left
//   wearing nothing. Every material that carries a polygon is the owner's painting. THE LEGS ARE ANOTHER MATTER (AUDIT
//   MW-FOLK1 L1-F3, measured): 385's hose was made from the pack body's own leg - its object's empty slots still name
//   Morrowind's leg pictures (tx_b_n_breton_m_ll and _ul) - and the same mesh is 388's and 389's hose (270 of 270
//   positions alike); 386's and 390's breeches are a part of it (138 of 138), and the boots of 384, 386, 387 and 390
//   share its lower leg (100 of their 192 positions). Seven outfits carry that geometry, repainted; whether it is the
//   owner's to give is the owner's to confirm (test/tooling/doctrine.test.js says so on each of those meshes' rows).
//
//   A T-POSE WHOSE ARMS ARE NOT RETAIL'S. The outfits were made on the "Morrowind_Symmetric_TPose_Models" body - the
//   steel plate's is the plain pack's - and its legs, feet and trunk stand where the steel plate's do: the scene's
//   floor and SCENE_FROM_BIND stand them on retail's bind (the hose's cross-sections centred within 1.5 of the thigh
//   and calf lines, 2.4 at the hip; the ankles 6.6 over the floor). Its ARMS do not: the sleeves, cuffs and wraps
//   stand over retail's arm line - at the shoulder 0.95 (the bell sleeves) to 1.97 (385's), where the two binds'
//   joints stand 1.89 apart; 2.3 to 2.9 at the elbow, which only 385's long sleeve reaches; 3.2 to 3.3 at the wrist.
//   Fitted as two turns of retail's arm, the symmetric pack's clavicle is LEVEL - the fit turns it up 11.46 degrees,
//   the very fall retail's has from its root to the shoulder joint - and its arm falls PACK_ARM_FALL from the shoulder
//   to the wrist (the wraps over the wrists on its line to 0.07). So the outfits are skinned in THEIR pose
//   (packBind): retail's bind with each arm turned so, the inverse binds that pose's. A skin's binds are the pose its
//   mesh was made in; written so, the game's own skinning lays each sleeve on the arm it animates - no vertex is moved
//   to fit.
//
//   A HOOD IS A HELM. The hoods were made over the T-posed scene's head, which the game draws HELM_LIFT lower on its
//   bone than its own (MW-STEEL5); at the game's head the scalp stands through them. A hood's island is raised
//   HELM_LIFT onto it, as the open steel helm is, and rides the head; a hooded outfit hides the hair, as a helmet does.
//
//   THE WEIGHTS ARE A RIGGER'S, PIECE BY PIECE. Each connected island of a painting is one garment piece - a tunic, a
//   collar, a sleeve, a cuff, a leg of hose, a boot, a kilt, a belt, a flap, a pouch - and is weighted by what it is
//   (islandClass): a hood the neck and head; an arm's piece its clavicle, arm, hand and fingers; a leg's its pelvis,
//   thigh, calf and foot; a torso's the spine, and the clavicles and upper arms within their reach (ARM_REACH - the
//   shoulder's cap and a sleeve joined on, never the body's side under the armpit, which is the ribcage's); cloth that
//   hangs round the legs (a tunic's skirt, a kilt, a robe, a dress, a flap at one side) that law above the waist and
//   the hang below it (hangOf: tools/skinWeights.mjs hang 'over', the ebony breastplate's tassets' - here the thighs'
//   whole share from the hip joints down, the calves' past the knees); a pouch or a buckle on the belt the pelvis.
//   Every law is one of position, the same for every piece of every outfit, so pieces that touch and layers that lie
//   over each other move as one, and no seam opens under a pose (test/tooling/mwfolk1.test.js poses them on the body).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFbx } from './fbxRead.mjs';
import { bakeMesh, objectMaterials } from './fbxMesh.mjs';
import { mipChain, writeDds } from './meshTexture.mjs';
import { skinnedMeshesToNif } from './nifWrite.mjs';
import { jointWeights } from './skinWeights.mjs';
import { readPng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';
import { RETAIL_SKELETON, plateBind, rigSegments, objectTree, BOX_SLACK, HELM_LIFT, SCENE_BODY } from './bakeSteelPlate.mjs';

/** The owner's export, as committed - clothes.fbx as it came, less the Morrowind skin cut from it (CUT). */
export const SOURCE = 'src/assets/mw/source/Townsfolk.fbx';

/** The fourteen paintings, as committed - each under the piece it paints and the export folder it came from, beside the
 *  path the export names it by. */
export const PAINTINGS = Object.freeze({
  tunic_bretonnpc: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Tunic_Bretonnpc.png', named: 'bretonnpc/Material.019_2D_View_<UDIM>.png' }),
  hose_bretonnpc: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Hose_Bretonnpc.png', named: 'bretonnpc/Material.020_2D_View_<UDIM>.png' }),
  sleeves_bretonnpc: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Sleeves_Bretonnpc.png', named: 'bretonnpc/Material.018_2D_View_<UDIM>.png' }),
  tunic_nord1: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Tunic_Nord1.png', named: 'nord1/Material.019_2D_View_<UDIM>.png' }),
  breeches_nord1: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Breeches_Nord1.png', named: 'nord1/Material.020_2D_View_<UDIM>.png' }),
  tunic_nord2: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Tunic_Nord2.png', named: 'nord2/Material.019_2D_View_<UDIM>.png' }),
  tunic_nord3: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Tunic_Nord3.png', named: 'NORD3/Material.019_2D_View_<UDIM>.png' }),
  shoulders_nord3: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Shoulders_Nord3.png', named: 'NORD3/Material.018_2D_View_<UDIM>.png' }),
  kit_redguard1: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Kit_Redguard1.png', named: 'redguard1/DefaultMaterial_2D_View_<UDIM>.png' }),
  skirt_redguard2: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Skirt_Redguard2.png', named: 'Redguard2/Material.007_2D_View_<UDIM>.png' }),
  boots_redguard2: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Boots_Redguard2.png', named: 'Redguard2/14124.png' }),
  robe_redguard3: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Robe_Redguard3.png', named: 'redguard3/tunic_2D_View_<UDIM>.png' }),
  robe_redguard4: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Robe_Redguard4.png', named: 'redguard4/tunic_2D_View_<UDIM>.png' }),
  dress_redguardwoman1: Object.freeze({ png: 'src/assets/mw/source/Townsfolk_Dress_Redguardwoman1.png', named: 'redguardwoman1/DefaultMaterial_2D_View_<UDIM>.png' }),
});

/** The DDS's name as the NIFs spell it (a bare file, re-rooted under `textures/`), and the shipped files. */
export const textureName = (paint) => `townsfolk_${paint}.dds`;
export const meshFile = (archive) => `src/assets/mw/meshes/townsfolk_${archive}.nif`;
export const textureFile = (paint) => `src/assets/mw/textures/townsfolk_${paint}.dds`;

/** Each object: the pictures the export names on its materials (held whole - a re-export that re-painted or reordered
 *  one is refused by name) and the box it was read at, in its own frame (its scene placement less the row it was laid
 *  out in - the floor and the facing are the body's). */
const object = (materials, box) => Object.freeze({ materials: Object.freeze(materials), box: Object.freeze(box) });
const MW = 'Morrowind_TPose_Models (2)/Morrowind_Symmetric_TPose_Models';
export const OBJECTS = Object.freeze({
  'Breton_Male.018': object(['bretonnpc/Material.020_2D_View_<UDIM>.png', 'bretonnpc/Material.019_2D_View_<UDIM>.png', 'bretonnpc/Material.018_2D_View_<UDIM>.png',
    `${MW}/Breton_Male/textures/tx_b_n_breton_m_ll.png`, `${MW}/Breton_Male/textures/tx_b_n_breton_m_ul.png`, `${MW}/Breton_Male/textures/tx_b_n_breton_m_ll.png`,
    `${MW}/Breton_Male/textures/tx_b_n_generic_m_g00.png`, 'redguard1/DefaultMaterial_2D_View_<UDIM>.png'], [[-47.91, -12.08, 0], [47.91, 14.84, 119.46]]),
  'Breton_Male.028': object(['nord2/Material.019_2D_View_<UDIM>.png', 'bretonnpc/Material.020_2D_View_<UDIM>.png', 'bretonnpc/Material.019_2D_View_<UDIM>.png',
    'bretonnpc/Material.018_2D_View_<UDIM>.png', `${MW}/Breton_Male/textures/tx_b_n_breton_m_ll.png`, `${MW}/Breton_Male/textures/tx_b_n_breton_m_ul.png`,
    `${MW}/Breton_Male/textures/tx_b_n_breton_m_ll.png`, `${MW}/Breton_Male/textures/tx_b_n_generic_m_g00.png`, 'redguard1/DefaultMaterial_2D_View_<UDIM>.png'],
  [[-20.87, -12.08, 0], [20.87, 14.84, 136.16]]),
  'Breton_Male.038': object(['nord1/Material.019_2D_View_<UDIM>.png', 'nord1/Material.020_2D_View_<UDIM>.png', 'bretonnpc/Material.020_2D_View_<UDIM>.png',
    'bretonnpc/Material.019_2D_View_<UDIM>.png', 'bretonnpc/Material.018_2D_View_<UDIM>.png', `${MW}/Breton_Male/textures/tx_b_n_breton_m_ll.png`,
    `${MW}/Breton_Male/textures/tx_b_n_breton_m_ul.png`, `${MW}/Breton_Male/textures/tx_b_n_breton_m_ll.png`, `${MW}/Breton_Male/textures/tx_b_n_generic_m_g00.png`,
    'redguard1/DefaultMaterial_2D_View_<UDIM>.png', 'Redguard2/14124.png'], [[-60.41, -12.08, 0], [60.41, 14.84, 119.46]]),
  'Plane Remeshed': object(['redguardwoman1/DefaultMaterial_2D_View_<UDIM>.png'], [[-25.28, -13.25, 0.44], [25.28, 16.84, 135.76]]),
  'Redguard_Male.002': object(['redguard1/DefaultMaterial_2D_View_<UDIM>.png'], [[-44.13, -10.48, 5.42], [44.13, 11.8, 116.46]]),
  'Redguard_Male.003': object(['Redguard2/Material.007_2D_View_<UDIM>.png', `${MW}/Breton_Male/textures/tx_b_n_breton_m_ll.png`, `${MW}/Breton_Male/textures/tx_b_n_breton_m_ul.png`,
    `${MW}/Breton_Male/textures/tx_b_n_breton_m_ll.png`, `${MW}/Breton_Male/textures/tx_b_n_generic_m_g00.png`, 'redguard1/DefaultMaterial_2D_View_<UDIM>.png',
    'NORD3/Material.018_2D_View_<UDIM>.png', 'NORD3/Material.019_2D_View_<UDIM>.png'], [[-60.41, -11.54, 0], [60.41, 14.84, 119.46]]),
  'Redguard_Male.007': object(['Redguard2/Material.007_2D_View_<UDIM>.png'], [[-16.06, -11.74, 0], [15.96, 14.84, 88.34]]),
  'Redguard_Male.010': object([`${MW}/Redguard_Male/textures/tx_b_n_redguard_m_ll.png`, `${MW}/Redguard_Male/textures/tx_b_n_redguard_m_lf.png`,
    'redguard1/DefaultMaterial_2D_View_<UDIM>.png', `${MW}/Redguard_Male/textures/tx_b_n_redguard_m_uf.png`, `${MW}/Redguard_Male/textures/tx_b_n_redguard_m_ll.png`,
    `${MW}/Redguard_Male/textures/tx_b_n_redguard_m_ul.png`, 'npc guy/material_6_2D_View_<UDIM>.png', 'redguard4/tunic_2D_View_<UDIM>.png'], [[-25.95, -12.08, 5.42], [25.95, 12.37, 119.12]]),
  'Redguard_Male.028': object(['redguard1/DefaultMaterial_2D_View_<UDIM>.png', 'redguard3/tunic_2D_View_<UDIM>.png'], [[-25.95, -12.08, 5.42], [25.95, 12.37, 119.12]]),
});

/** The material slots cut out of the owner's export before it was committed (see the header) - 385's half groin,
 *  Morrowind's own skin: in the committed export no polygon wears one, and no outfit may name one. */
export const CUT = Object.freeze({ 'Breton_Male.018': Object.freeze([6]) });

const outfit = (archive, obj, shapes) => Object.freeze({ archive, object: obj, shapes: Object.freeze(shapes.map(([material, paint]) => Object.freeze({ material, paint }))) });
/**
 * Each sprite's outfit: its archive (the walker's picture, mobilePerson.js PERSON_TEXTURES), the object it is read
 * from, and each shape - a material and the painting it wears. The export's own pairings, and two RECOLOURS.
 */
export const OUTFITS = Object.freeze([
  outfit(381, 'Redguard_Male.028', [[0, 'kit_redguard1'], [1, 'robe_redguard3']]),
  outfit(382, 'Redguard_Male.002', [[0, 'kit_redguard1']]),
  outfit(383, 'Redguard_Male.010', [[2, 'kit_redguard1'], [7, 'robe_redguard4']]),
  outfit(384, 'Redguard_Male.007', [[0, 'skirt_redguard2']]),
  outfit(385, 'Breton_Male.018', [[0, 'hose_bretonnpc'], [1, 'tunic_bretonnpc'], [2, 'sleeves_bretonnpc'], [7, 'kit_redguard1']]),
  outfit(386, 'Breton_Male.038', [[0, 'tunic_nord1'], [1, 'breeches_nord1'], [9, 'kit_redguard1'], [10, 'boots_redguard2']]),
  outfit(387, 'Redguard_Male.003', [[0, 'skirt_redguard2'], [5, 'kit_redguard1'], [6, 'shoulders_nord3'], [7, 'tunic_nord3']]),
  outfit(388, 'Breton_Male.028', [[0, 'tunic_nord2'], [1, 'hose_bretonnpc']]),
  outfit(389, 'Breton_Male.028', [[0, 'tunic_nord1'], [1, 'hose_bretonnpc']]),
  outfit(390, 'Breton_Male.038', [[0, 'tunic_nord1'], [1, 'breeches_nord1'], [9, 'kit_redguard1'], [10, 'skirt_redguard2']]),
  outfit(398, 'Plane Remeshed', [[0, 'dress_redguardwoman1']]),
]);

/** The two outfits that wear a painting the export names on another object: Nord 389 is 388's hooded tunic in the teal
 *  his picture wears (386's tunic painting - 388's tunic islands are 386's; its hood, which 386 has not, reads the
 *  painting's yoke and ground, both teal), Nord 390 386's outfit with the yellow-striped boots his picture wears (384's
 *  skirt-and-boots painting, drawn for the same boots - their islands alike). */
export const RECOLOURS = Object.freeze({ 389: Object.freeze([0]), 390: Object.freeze([10]) });

/** An object's scene-placed mesh in its own frame: its scene translation's x and y taken off - the row the owner laid
 *  the outfits out in; its floor (z) is the body's, as the steel plate's is. To the bake's six places. */
export function outfitFrame(mesh) {
  const t = mesh.bake.sceneTranslation;
  const off = (v, k) => +(k < 2 ? v - t[k] : v).toFixed(6);
  return { ...mesh, positions: mesh.positions.map((v, i) => off(v, i % 3)), bounds: { min: mesh.bounds.min.map(off), max: mesh.bounds.max.map(off) } };
}

/** One material of an object, in the object's frame. */
export function materialMesh(tree, name, material) {
  return outfitFrame(bakeMesh(objectTree(tree, name), { name: `${name} ${material}`, placement: 'scene', forward: '+y', up: '+z', material }));
}

/** An object held to the pictures the export names on it and to the box it was read at (the whole object's bounds,
 *  every material). A re-export that re-painted, reordered, moved or reshaped one is refused by name. */
export function checkObject(tree, name) {
  const want = OBJECTS[name];
  if (!want) throw new Error(`no object "${name}" is read for an outfit`);
  const names = objectMaterials(tree, name);
  if (JSON.stringify(names) !== JSON.stringify(want.materials)) {
    throw new Error(`"${name}" names ${JSON.stringify(names)} on its materials, not ${JSON.stringify(want.materials)} - re-read the export before baking it`);
  }
  const whole = outfitFrame(bakeMesh(objectTree(tree, name), { name, placement: 'scene', forward: '+y', up: '+z' }));
  const off = [0, 1, 2].flatMap((k) => [Math.abs(whole.bounds.min[k] - want.box[0][k]), Math.abs(whole.bounds.max[k] - want.box[1][k])]);
  if (Math.max(...off) > BOX_SLACK) throw new Error(`"${name}" stands at ${JSON.stringify(whole.bounds)}, not where it was read (${JSON.stringify(want.box)}) - re-read the export before baking it`);
  return names;
}

// ── THE POSE THE OUTFITS WERE MADE IN ─────────────────────────────────

/**
 * How far the symmetric pack's arm falls from the shoulder joint to the wrist joint (units; retail's bind falls 1.83) -
 * read off the export's own tubes with its clavicle level: the wraps over 386's and 387's wrists stand on its line (to
 * 0.07 - 0.066), 385's long sleeve to 0.39; the bell sleeves sit 0.4 to 1.0 under it and 382's cuffs within 1.2 either
 * side (AUDIT MW-FOLK1 L1-F7: the record had them all on it at once; bible/04-Characters/Townsfolk-Outfits.md).
 */
export const PACK_ARM_FALL = 0.5;

/** The world rotation about +Y by `ang` (column vectors, row-major), and its product with a bone's. */
const rotY = (ang) => { const c = Math.cos(ang), s = Math.sin(ang); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const mul3 = (r, a) => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => r[i * 3] * a[j] + r[i * 3 + 1] * a[3 + j] + r[i * 3 + 2] * a[6 + j]));
const turn = (r, p, t) => { const d = [t[0] - p[0], t[1] - p[1], t[2] - p[2]]; return [0, 1, 2].map((i) => p[i] + r[i * 3] * d[0] + r[i * 3 + 1] * d[1] + r[i * 3 + 2] * d[2]); };

/**
 * THE OUTFITS' BIND: retail's (plateBind - the scene stood on it by SCENE_FROM_BIND) with each arm turned into the
 * symmetric pack's T-pose - its clavicle, and everything past it, turned about the clavicle's root until the shoulder
 * joint stands level with it; then the arm, and everything past it, turned about the shoulder until the wrist joint
 * stands PACK_ARM_FALL under it. Every other bone is retail's. Map(bone name -> { a, t }), as plateBind's.
 */
export function packBind(skeletonBytes) {
  const bind = plateBind(skeletonBytes);
  for (const S of ['R', 'L']) {
    const arm = [...bind.keys()].filter((n) => n.startsWith(`Bip01 ${S} `) && !/(Thigh|Calf|Foot|Toe)/.test(n));
    const sgn = S === 'R' ? 1 : -1;   // raising the right arm (+x) is a turn about +Y by a negative angle
    const C = bind.get(`Bip01 ${S} Clavicle`).t;
    const U0 = bind.get(`Bip01 ${S} UpperArm`).t;
    const a = Math.atan2(C[2] - U0[2], Math.abs(U0[0] - C[0]));   // the clavicle's fall, taken out
    const Ra = rotY(-sgn * a);
    for (const n of arm) { const m = bind.get(n); bind.set(n, { a: mul3(Ra, m.a), t: turn(Ra, C, m.t) }); }
    const U = bind.get(`Bip01 ${S} UpperArm`).t;
    const H = bind.get(`Bip01 ${S} Hand`).t;
    const now = Math.atan2(U[2] - H[2], Math.abs(H[0] - U[0]));
    const want = Math.asin(PACK_ARM_FALL / Math.hypot(H[0] - U[0], H[2] - U[2]));   // a turn about Y keeps that reach
    const Rb = rotY(sgn * (want - now));   // the clavicle's turn raised the arm with it: lowered to the pack's fall
    for (const n of arm.filter((x) => x !== `Bip01 ${S} Clavicle`)) { const m = bind.get(n); bind.set(n, { a: mul3(Rb, m.a), t: turn(Rb, U, m.t) }); }
  }
  return bind;
}

// ── THE RIGS, PIECE BY PIECE ──────────────────────────────────────────

const bone = (name, to, joint = null) => Object.freeze({ name, to, ...(joint ? { parent: joint[0], blend: joint[1] } : {}) });
const PELVIS = bone('Bip01 Pelvis', 'Bip01 Spine');
const SPINE = Object.freeze([
  PELVIS,
  bone('Bip01 Spine', 'Bip01 Spine1', ['Bip01 Pelvis', 3]),
  bone('Bip01 Spine1', 'Bip01 Spine2', ['Bip01 Spine', 3]),
  bone('Bip01 Spine2', 'Bip01 Neck', ['Bip01 Spine1', 3]),
  bone('Bip01 Neck', 'Bip01 Head', ['Bip01 Spine2', 2]),
]);
const side = (S) => {
  const b = (n) => `Bip01 ${S} ${n}`;
  return {
    clavicle: (joint) => bone(b('Clavicle'), b('UpperArm'), joint),
    upperArm: bone(b('UpperArm'), b('Forearm'), [b('Clavicle'), 2.5]),
    arm: [
      bone(b('Forearm'), b('Hand'), [b('UpperArm'), 2.5]),
      bone(b('Hand'), { mid: [b('Finger1'), b('Finger2')] }, [b('Forearm'), 1.5]),
      bone(b('Finger0'), b('Finger01'), [b('Hand'), 1]), bone(b('Finger01'), { local: [2.5, 0, 0] }, [b('Finger0'), 0.75]),
      bone(b('Finger1'), b('Finger11'), [b('Hand'), 1]), bone(b('Finger11'), { local: [2.5, 0, 0] }, [b('Finger1'), 0.75]),
      bone(b('Finger2'), b('Finger21'), [b('Hand'), 1]), bone(b('Finger21'), { local: [2.5, 0, 0] }, [b('Finger2'), 0.75]),
    ],
    thigh: bone(b('Thigh'), b('Calf'), ['Bip01 Pelvis', 3]),
    leg: [bone(b('Calf'), b('Foot'), [b('Thigh'), 3]), bone(b('Foot'), { local: [5.5, 9, 0] }, [b('Calf'), 2])],
  };
};
const R = side('R');
const L = side('L');
/** AUDIT MW-FOLK1 (L1-F5): how far from its own line an arm's bone claims a piece of the TORSO (units) - the shoulder's
 *  cap over the joint and a sleeve joined to the body, never the body's side under the armpit. That side stands nearer
 *  the shoulder joint than the spine's line, so the nearest line gave it to the arm (14 off the spine in the bind),
 *  and the idle, lowering the arm the pack's T-pose raised and its clavicle the pack's fit levelled, swung it 12 into
 *  the chest (to 2.3 off the spine). The arm's own pieces keep their whole rig. */
export const ARM_REACH = 6;
/** ...and over how far past it that claim fades into the ribcage's (units): the sleeves' seams stand 5.8 or less off
 *  the arm's line (398's bodice meets her sleeve at 5.8), the body's side under the armpit 7.3 and more. */
export const ARM_FADE = 1.5;
const reaching = (b) => Object.freeze({ ...b, reach: ARM_REACH, fade: ARM_FADE });
const TORSO = Object.freeze([...SPINE, reaching(R.clavicle(['Bip01 Spine2', 2])), reaching(L.clavicle(['Bip01 Spine2', 2])), reaching(R.upperArm), reaching(L.upperArm)]);
/**
 * THE HANG - cloth round the legs (a tunic's skirt, a kilt, a robe, a dress, a flap at one side): one law of where a
 * point stands, the same for every piece and every outfit, so layers and pieces that touch move as one (AUDIT MW-FOLK1
 * L1-F6: each piece hung to its own hem, and a flap sheared through the kilt under it). From the waist (HANG_TOP, the
 * ebony breastplate's and the steel skirt's 84) the thighs take a growing share, the whole of it (HANG_SHARE) from the
 * hip joints down, split across HANG_CENTRE either side of the middle; past the knees the calves take it from the
 * thighs, across KNEE_BLEND either side. AUDIT MW-FOLK1 (L2-F1): the share was 0.7, reached at each piece's own hem,
 * and the legs stood out through the cloth every stride - the owner's cloth sits within a unit of the leg's own
 * surface at mid-thigh (the tunics' hose IS the leg), so cloth that lags a swinging thigh at all is cloth it passes
 * through. The leg's own surface (385's hose) now stays inside every tunic in a 35-degree stride.
 */
export const HANG_TOP = 84;
export const HANG_SHARE = 1;
export const HANG_CENTRE = 4;
export const KNEE_BLEND = 3;
/** The hang a hanging piece takes, read off the bind: full at the hip joints' height, the calves past the knees'. */
export function hangOf(bind) {
  const hip = (bind.get('Bip01 L Thigh').t[2] + bind.get('Bip01 R Thigh').t[2]) / 2;
  const knee = (bind.get('Bip01 L Calf').t[2] + bind.get('Bip01 R Calf').t[2]) / 2;
  return { mode: 'over', root: 'Bip01 Pelvis', legs: ['Bip01 L Thigh', 'Bip01 R Thigh'], top: HANG_TOP, bottom: hip, share: HANG_SHARE, centre: HANG_CENTRE,
    calves: ['Bip01 L Calf', 'Bip01 R Calf'], knee, kneeBlend: KNEE_BLEND };
}

/** Each piece's rig, by its class (islandClass). A hanging piece takes the hang (hangOf). */
export const RIGS = Object.freeze({
  hood: Object.freeze({ bones: Object.freeze([bone('Bip01 Neck', 'Bip01 Head'), bone('Bip01 Head', { local: [10, 0, 0] }, ['Bip01 Neck', 2])]) }),
  'arm:R': Object.freeze({ bones: Object.freeze([R.clavicle(), R.upperArm, ...R.arm]) }),
  'arm:L': Object.freeze({ bones: Object.freeze([L.clavicle(), L.upperArm, ...L.arm]) }),
  'leg:R': Object.freeze({ bones: Object.freeze([PELVIS, R.thigh, ...R.leg]) }),
  'leg:L': Object.freeze({ bones: Object.freeze([PELVIS, L.thigh, ...L.leg]) }),
  torso: Object.freeze({ bones: TORSO }),
  skirt: Object.freeze({ bones: Object.freeze([...TORSO, bone('Bip01 L Thigh', 'Bip01 L Calf'), bone('Bip01 R Thigh', 'Bip01 R Calf'),
    bone('Bip01 L Calf', 'Bip01 L Foot'), bone('Bip01 R Calf', 'Bip01 R Foot')]), hang: true }),
  hip: Object.freeze({ bones: Object.freeze([PELVIS, bone('Bip01 Spine', 'Bip01 Spine1', ['Bip01 Pelvis', 3])]) }),
});

/** Where the thighs swing from (the bind's hip joints stand at 76.4): cloth reaching below them hangs. */
export const HIP_JOINTS = 76;
/**
 * WHAT A PIECE IS, by where it stands (its island's box, in the outfit's frame): over the shoulders, narrower than them
 * and up over the crown (SCENE_BODY's head - AUDIT MW-FOLK1 L1-F4: a narrow collar was a hood, lifted onto the head),
 * a hood; out along one arm, that arm's; round both legs and down past the hip joints, cloth that hangs; across the
 * middle above them, the torso's (a collar, a vest, a bodice, a belt); down one leg, that leg's; at one side and down
 * past the hip joints - a flap - cloth that hangs too (AUDIT MW-FOLK1 L1-F4: 384's side flap was the pelvis's,
 * rigid, and the thigh swung through it), the hang's split giving it to its own leg; anything else at the hip - a
 * pouch, a buckle - the pelvis's.
 */
export function islandClass({ min, max }) {
  if (min[2] > 112 && max[2] > SCENE_BODY.head.max[2] && Math.max(-min[0], max[0]) < 12) return 'hood';
  if (min[2] > 100 && min[0] > 6) return 'arm:R';
  if (min[2] > 100 && max[0] < -6) return 'arm:L';
  if (min[0] < -3 && max[0] > 3) return min[2] < HIP_JOINTS ? 'skirt' : 'torso';
  if (min[2] < 70) return min[0] + max[0] > 0 ? 'leg:R' : 'leg:L';
  return min[2] < HIP_JOINTS ? 'skirt' : 'hip';
}

/** A mesh's islands - triangles joined by a shared POSITION (a seam in the UVs or the normals is one piece) - each its
 *  vertices, sorted, and its box. */
export function islandsOf(mesh) {
  const n = mesh.positions.length / 3;
  const key = (v) => `${Math.round(mesh.positions[v * 3] * 1e4)},${Math.round(mesh.positions[v * 3 + 1] * 1e4)},${Math.round(mesh.positions[v * 3 + 2] * 1e4)}`;
  const at = new Map(); const rep = new Int32Array(n);
  for (let v = 0; v < n; v++) { const k = key(v); if (!at.has(k)) at.set(k, at.size); rep[v] = at.get(k); }
  const parent = Array.from({ length: at.size }, (_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = find(rep[mesh.indices[i]]);
    for (const k of [1, 2]) { const b = find(rep[mesh.indices[i + k]]); if (a !== b) parent[b] = a; }
  }
  const groups = new Map();
  for (let v = 0; v < n; v++) { const g = find(rep[v]); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(v); }
  return [...groups.values()].map((verts) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const v of verts) for (let k = 0; k < 3; k++) { const x = mesh.positions[v * 3 + k]; if (x < min[k]) min[k] = x; if (x > max[k]) max[k] = x; }
    return { verts, min, max };
  }).sort((p, q) => p.verts[0] - q.verts[0]);
}

/** A mesh with its hood islands raised HELM_LIFT onto the game's head (see the header), to the bake's six places - its
 *  bounds the lifted mesh's (AUDIT MW-FOLK1 L1-F9: they were the unlifted ones). */
export function liftHoods(mesh) {
  const up = new Set(islandsOf(mesh).filter((isl) => islandClass(isl) === 'hood').flatMap((isl) => isl.verts));
  if (!up.size) return mesh;
  const positions = mesh.positions.map((v, i) => (i % 3 === 2 && up.has((i - 2) / 3) ? +(v + HELM_LIFT).toFixed(6) : v));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  positions.forEach((v, i) => { const k = i % 3; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; });
  return { ...mesh, positions, bounds: { min, max } };
}

/**
 * One shape's weights: each island by its class's rig in the outfits' bind (`bind`, packBind), a hanging piece the
 * hang (hangOf). One `[[bone, weight], ...]` list per vertex, and the bones the shape uses.
 */
export function shapeWeights(mesh, bind) {
  const weights = new Array(mesh.positions.length / 3);
  const used = new Set();
  const hanging = hangOf(bind);
  for (const isl of islandsOf(mesh)) {
    const rig = RIGS[islandClass(isl)];
    const hang = rig.hang ? hanging : null;
    const pos = isl.verts.flatMap((v) => [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]]);
    const lists = jointWeights(pos, rigSegments(rig.bones, bind), { hang });
    isl.verts.forEach((v, k) => { weights[v] = lists[k]; for (const [b] of lists[k]) used.add(b); });
  }
  return { weights, used };
}

/** Every bone any outfit rig names, in one order - the NIF's bones are these, at the outfits' bind. */
const ALL_BONES = [...new Set(Object.values(RIGS).flatMap((r) => r.bones.map((b) => b.name)))];

/**
 * The bake: the committed export, the fourteen paintings and retail's skeleton in; every sprite's outfit NIF and every
 * painting's DDS out. Pure - bytes in, bytes out.
 */
export function bakeTownsfolk({ source, pngs, skeleton }) {
  if (!skeleton) throw new Error('no skeleton to skin the outfits in - the bake reads its bind (RETAIL_SKELETON)');
  const tree = readFbx(Buffer.from(source));
  const bind = packBind(skeleton);
  for (const name of Object.keys(OBJECTS)) checkObject(tree, name);
  const meshes = new Map();
  const meshOf = (name, material) => {
    const k = `${name}|${material}`;
    if (!meshes.has(k)) meshes.set(k, liftHoods(materialMesh(tree, name, material)));
    return meshes.get(k);
  };
  const outfits = OUTFITS.map((o) => {
    const shapes = o.shapes.map((s, i) => {
      if (CUT[o.object]?.includes(s.material)) throw new Error(`${o.archive}: material ${s.material} of "${o.object}" is Morrowind's own skin, cut from the export - no outfit wears it`);
      const mesh = meshOf(o.object, s.material);
      const { weights, used } = shapeWeights(mesh, bind);
      return { mesh, texture: textureName(s.paint), name: `Tri Chest ${i}`, weights, used };
    });
    const bones = ALL_BONES.filter((n) => shapes.some((s) => s.used.has(n))).map((name) => ({ name, bind: bind.get(name) }));
    const nif = skinnedMeshesToNif(shapes.map(({ mesh, texture, name, weights }) => ({ mesh, texture, name, weights })), { node: `Townsfolk ${o.archive}`, bones });
    return { archive: o.archive, shapes, nif };
  });
  const textures = Object.keys(PAINTINGS).map((paint) => {
    if (!pngs[paint]) throw new Error(`no painting for ${paint}`);
    const png = readPng(pngs[paint]);
    return { paint, png, dds: writeDds(mipChain({ width: png.width, height: png.height, data: png.data })) };
  });
  return { outfits, textures, bind };
}

const save = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };

if (isMain(import.meta.url)) {
  const missing = Object.entries(PAINTINGS).filter(([, p]) => !existsSync(p.png)).map(([paint]) => paint);
  if (missing.length) { console.error(`no painting yet for: ${missing.join(', ')}`); process.exit(1); }
  const r = bakeTownsfolk({
    source: readFileSync(SOURCE),
    pngs: Object.fromEntries(Object.entries(PAINTINGS).map(([paint, p]) => [paint, readFileSync(p.png)])),
    skeleton: readFileSync(RETAIL_SKELETON),
  });
  for (const o of r.outfits) {
    save(meshFile(o.archive), o.nif);
    const tris = o.shapes.reduce((n, s) => n + s.mesh.indices.length / 3, 0);
    console.log(`  ${String(o.archive).padEnd(4)} ${String(tris).padStart(5)} triangles, ${o.shapes.length} shapes -> ${meshFile(o.archive)}  ${o.nif.length} bytes`);
  }
  for (const t of r.textures) {
    save(textureFile(t.paint), t.dds);
    console.log(`  ${t.paint.padEnd(22)} ${t.png.width}x${t.png.height} -> ${textureFile(t.paint)}  ${t.dds.length} bytes`);
  }
}
