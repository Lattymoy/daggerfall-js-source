// THE STEEL PLATE'S MORROWIND ASSETS, in one command.
//
//     node tools/bakeSteelPlate.mjs [--sheets]
//         re-make the shipped NIFs and DDSs from the committed sources
//     node tools/bakeSteelPlate.mjs --import=<New_Ship.fbx>,<New_Ship1.fbx>
//         take Mac's two exports into the committed sources first (tools/fbxStrip.mjs), and measure his scene's
//         reference head and neck (SCENE_BODY)
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
//   keeps only their BOUNDS (SCENE_BODY) - the evidence the scene's frame is read against, below.
//
//   THE SKIRT CAME WITH ITS PAINTING (MW-STEEL2, 2026-10-07, Mac: "This is the missing texture for the morrowind steel
//   armor's skirt"). The scene keeps a skirt of plates under the breastplate (`Imperial_Silver_Cuirass_67_Male.011`,
//   modelled from the same cuirass mesh as the breastplate, `.009`), painted from a "steelpelvis" texture that MW-STEEL1
//   never had - so it was stripped at --import then, Mac having said "That was never apart of the set". The painting
//   came, and the skirt is a piece now: `Steel_Plate_Skirt.png` is Mac's steelpelvis picture, and the skirt is baked
//   from the open helm's export like every shared piece (both of Mac's exports carry it, the same to the vertex).
//
//   THE CLOSED HELM IS TWO PICTURES ON ONE PART. Its shell wears the helm's texture and its visor and plume the
//   faceplate's, so its NIF carries two shapes. The second export is committed as the closed helm alone - the shared
//   pieces are the first export's, byte for byte.
//
// ═══ MW-STEEL4: RIGGED HERE, AS RETAIL'S ARMOUR IS ═══════════════════
//
// (2026-10-07, Mac: "I think the prior session to rig the new steel set on the morrowind model really fucked it up.
// How hard is it to switch it out?", and asked how: "You do it properly".) Every piece ships SKINNED - a NiSkinInstance
// over Morrowind's own Bip01 bones and a NiSkinData of their inverse binds and weights, the shape of a retail armour
// piece - so the game takes it on the path it takes Morrowind's own (rule 12: rebound onto the wearer's skeleton by
// the bones' names; rule 20: drawn by skinBatch). MW-STEEL1-3 shipped static meshes and rigged them at runtime against
// the player's body; nothing of that is left.
//
//   THE BIND IS RETAIL'S OWN. Mac's scene stands its Breton in a T-pose, and a T-pose is exactly what Morrowind's
//   skins are bound in: the skeleton file's "Tri Shadow" binds all 32 Bip01 bones there, the arms level (its rest is
//   the idle's first frame, the arms hanging). The vendored retail hierarchy carries it (RETAIL_SKELETON, Greatness7's
//   Weapon Sheathing skeleton - the retail nodes and their Tri Shadow verbatim), and retailBind reads each bone's bind
//   off its inverse bind.
//
//   THE SCENE STANDS ON IT, MEASURED. The Tri Shadow's frame is its own (the pelvis 22 units under its origin); the
//   scene's is Blender's (the soles on z = 0). Their axes agree - both upright, both facing +Y - and the scene is the
//   bind moved by SCENE_FROM_BIND, read off the pieces themselves: the forearm's bone line runs through the middle of
//   the gauntlets' cuffs, the neck bone through the scene's neck, the ankle stands over the boots' soles.
//
//   THE WEIGHTS ARE A RIGGER'S (tools/skinWeights.mjs jointWeights): each piece's own bones (PLATE_RIG), each vertex
//   to the bone it covers, blended across a joint's width and nowhere else; the skirt hangs from the pelvis and swings
//   with the thighs; the helms ride the head alone. Each shape is named for the slot it fills (rule 15's filter picks a
//   skinned part's geometry by that name - "Tri Right Hand 0").
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFbx, childrenNamed, nodeAt, objectName } from './fbxRead.mjs';
import { bakeMesh } from './fbxMesh.mjs';
import { stripFbx, meshModelNames } from './fbxStrip.mjs';
import { mipChain, writeDds } from './meshTexture.mjs';
import { skinnedMeshesToNif } from './nifWrite.mjs';
import { jointWeights } from './skinWeights.mjs';
import { previewSheet } from './meshSheets.mjs';
import { readPng, writePng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';
import { parseNif } from '../src/formats/mwNifFile.js';
import { affineOfTransform } from '../src/formats/mwAffine.js';

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

/** ...and those bounds (scene units, Morrowind's axes), as `--import` measured them: twelve numbers of Bethesda's
 *  Breton, kept as the evidence SCENE_FROM_BIND is read against - the neck bone stands in this neck, the head bone in
 *  this head. */
export const SCENE_BODY = Object.freeze({
  head: Object.freeze({ min: Object.freeze([-4.764463, -5.649226, 113.146219]), max: Object.freeze([4.764463, 9.197224, 129.199977]) }),
  neck: Object.freeze({ min: Object.freeze([-3.895279, -4.097911, 109.962381]), max: Object.freeze([3.895279, 3.687286, 121.834567]) }),
});

/** MW-STEEL4: the retail skeleton whose bind the plate is skinned in - the retail hierarchy and its "Tri Shadow"
 *  verbatim, vendored with Greatness7's Weapon Sheathing (vendor/weapon-sheathing/README.md). */
export const RETAIL_SKELETON = 'vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif';

/**
 * MW-STEEL4: WHERE MAC'S SCENE STANDS AGAINST THE BIND - the scene is the Tri Shadow's frame moved by this much (units;
 * the axes agree). Read off the pieces, because the T-posed Breton's own meshes are not here to read:
 *   - the forearm's bone line runs through the middle of each gauntlet's cuff: its cross-sections centre 2.6-3.0 in
 *     front of the line and 98.3-98.8 above it (x 34-46, where the cuff is a clean tube);
 *   - the neck bone stands mid-neck: the scene's neck is centred 1.9 in front of where the bind puts it;
 *   - the bind's pelvis stands at the idle's height (76.37 - the 98.55), so the ankle bone stands 6.6 over the scene's
 *     floor (6.8 over the boots' lowest point), as it stands 6.8-7.0 over the floor in the idle.
 * Across, nothing: the bind and the plate are both mirrored about x = 0.
 */
export const SCENE_FROM_BIND = Object.freeze([0, 2.5, 98.55]);

/** An affine of a rotation and a translation, inverted: (R^T, -R^T t). */
const rigidInverse = ({ a, t }) => {
  const r = [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
  return { a: r, t: [-(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]), -(r[3] * t[0] + r[4] * t[1] + r[5] * t[2]), -(r[6] * t[0] + r[7] * t[1] + r[8] * t[2])] };
};

/**
 * MW-STEEL4: THE BIND, READ OFF RETAIL'S SKELETON. The file's own "Tri Shadow" is skinned over the whole Bip01 chain
 * (never drawn - rule 59) with an identity skin transform on an identity shape, so each bone's inverse bind, undone,
 * is where that bone stood when the skins were bound: the T-pose. Answers Map(bone name -> { a, t }) in the Tri
 * Shadow's own frame. A skeleton whose shadow is missing, or turned, scaled or moved, is refused - its binds would
 * stand somewhere else.
 */
export function retailBind(skeletonBytes) {
  const nif = parseNif(new Uint8Array(skeletonBytes));
  const shadow = nif.records.find((r) => r?.type === 'NiTriShape' && r.name === 'Tri Shadow' && r.skin >= 0);
  if (!shadow) throw new Error('this skeleton carries no skinned "Tri Shadow" to read the bind from');
  const skin = nif.records[shadow.skin];
  const data = nif.records[skin.data];
  const identity = (tr) => tr.scale === 1 && tr.translation.every((v) => v === 0) && [1, 0, 0, 0, 1, 0, 0, 0, 1].every((v, i) => tr.rotation[i] === v);
  if (!identity(shadow) || !identity(data.transform)) throw new Error('the Tri Shadow is moved or turned - its binds stand in another frame');
  const bind = new Map();
  skin.bones.forEach((ref, i) => {
    const tr = data.bones[i].transform;
    if (Math.abs(tr.scale - 1) > 1e-6) throw new Error(`"${nif.records[ref].name}" is bound at scale ${tr.scale}`);
    bind.set(nif.records[ref].name, rigidInverse(affineOfTransform(tr)));
  });
  return bind;
}

/** MW-STEEL4: the bind in the scene's frame - where every bone stood under Mac's plate. */
export function plateBind(skeletonBytes) {
  return new Map([...retailBind(skeletonBytes)].map(([name, m]) => [name, { a: Array.from(m.a), t: m.t.map((v, k) => v + SCENE_FROM_BIND[k]) }]));
}

/** A bone of a piece's rig: its name, where its segment ends (another bone's name - that bone's origin; `mid` -
 *  halfway between two bones' origins; or `local` - a point in the bone's own frame at bind), and its joint with its
 *  rig `parent`, `blend` units either side (tools/skinWeights.mjs). */
const bone = (name, to, joint = null) => Object.freeze({ name, to, ...(joint ? { parent: joint[0], blend: joint[1] } : {}) });
const SPINE = Object.freeze([
  bone('Bip01 Pelvis', 'Bip01 Spine'),
  bone('Bip01 Spine', 'Bip01 Spine1', ['Bip01 Pelvis', 3]),
  bone('Bip01 Spine1', 'Bip01 Spine2', ['Bip01 Spine', 3]),
  bone('Bip01 Spine2', 'Bip01 Neck', ['Bip01 Spine1', 3]),
  bone('Bip01 Neck', 'Bip01 Head', ['Bip01 Spine2', 2]),
]);
/** One side's limbs, `S` 'R' or 'L'. The bones that end in nothing end where the body does: the hand at its
 *  knuckles, a finger 2.5 past its last joint (along its X, the finger's own length axis), the foot at its ball (its
 *  X runs down to the sole, its Y forward). */
const limbs = (S) => {
  const b = (n) => `Bip01 ${S} ${n}`;
  return {
    clavicle: (joint) => bone(b('Clavicle'), b('UpperArm'), joint),
    upperArm: bone(b('UpperArm'), b('Forearm'), [b('Clavicle'), 2.5]),
    forearm: bone(b('Forearm'), b('Hand')),
    hand: [
      bone(b('Hand'), { mid: [b('Finger1'), b('Finger2')] }, [b('Forearm'), 1.5]),
      bone(b('Finger0'), b('Finger01'), [b('Hand'), 1]), bone(b('Finger01'), { local: [2.5, 0, 0] }, [b('Finger0'), 0.75]),
      bone(b('Finger1'), b('Finger11'), [b('Hand'), 1]), bone(b('Finger11'), { local: [2.5, 0, 0] }, [b('Finger1'), 0.75]),
      bone(b('Finger2'), b('Finger21'), [b('Hand'), 1]), bone(b('Finger21'), { local: [2.5, 0, 0] }, [b('Finger2'), 0.75]),
    ],
    thigh: bone(b('Thigh'), b('Calf')),
    calf: bone(b('Calf'), b('Foot'), [b('Thigh'), 3]),
    foot: bone(b('Foot'), { local: [5.5, 9, 0] }, [b('Calf'), 2]),
  };
};
const R = limbs('R');
const L = limbs('L');
const rig = (shape, bones, hang = null) => Object.freeze({ shape, bones: Object.freeze(bones), ...(hang ? { hang: Object.freeze(hang) } : {}) });

/**
 * MW-STEEL4: EACH PIECE'S RIG - the shape name rule 15's filter knows it by (the part's bone: "Tri Right Hand"; the
 * helm fills the HAIR slot, whose filter is the word "hair", rule 15's exception), and its own bones, a modeller's
 * vertex groups:
 *   - the breastplate the spine from the pelvis to the neck, and the clavicles at its shoulders;
 *   - the skirt hangs from the pelvis, the thighs taking up to 0.7 of its hem;
 *   - a pauldron the clavicle at its root and the upper arm it covers;
 *   - a gauntlet the forearm under its cuff, the hand and the three fingers Morrowind's hand has (the thumb, and two
 *     pairs), so its fingers close as the hand's do;
 *   - a greave the thigh and, past the knee, the calf; a boot the calf, the foot past the ankle, and the thigh at its
 *     top, which stands over the knee;
 *   - the helm the head alone - it is rigid on the skull, as a helmet is.
 */
export const PLATE_RIG = Object.freeze({
  cuirass: rig('Tri Chest', [...SPINE, R.clavicle(['Bip01 Spine2', 2]), L.clavicle(['Bip01 Spine2', 2])]),
  skirt: rig('Tri Groin', [SPINE[0], L.thigh, R.thigh], { root: 'Bip01 Pelvis', legs: ['Bip01 L Thigh', 'Bip01 R Thigh'], top: 84, bottom: 64.5, share: 0.7, centre: 4 }),
  pauldron_right: rig('Tri Right Clavicle', [R.clavicle(), R.upperArm]),
  pauldron_left: rig('Tri Left Clavicle', [L.clavicle(), L.upperArm]),
  gauntlet_right: rig('Tri Right Hand', [R.forearm, ...R.hand]),
  gauntlet_left: rig('Tri Left Hand', [L.forearm, ...L.hand]),
  greave_right: rig('Tri Right Upper Leg', [R.thigh, R.calf]),
  greave_left: rig('Tri Left Upper Leg', [L.thigh, L.calf]),
  boot_right: rig('Tri Right Foot', [R.thigh, R.calf, R.foot]),
  boot_left: rig('Tri Left Foot', [L.thigh, L.calf, L.foot]),
  helm_open: rig('Tri Hair', [bone('Bip01 Head', { local: [10, 0, 0] })]),
  helm_closed: rig('Tri Hair', [bone('Bip01 Head', { local: [10, 0, 0] })]),
});

/** A rig's bones as segments in `bind` (plateBind): `from` the bone's origin, `to` where its `to` names. */
export function rigSegments(rigBones, bind) {
  const origin = (name) => {
    const m = bind.get(name);
    if (!m) throw new Error(`the bind has no "${name}"`);
    return m.t;
  };
  const end = (b) => {
    if (typeof b.to === 'string') return origin(b.to);
    if (b.to.mid) { const [p, q] = b.to.mid.map(origin); return [0, 1, 2].map((k) => (p[k] + q[k]) / 2); }
    const m = bind.get(b.name); const l = b.to.local;
    return [0, 1, 2].map((k) => m.a[k * 3] * l[0] + m.a[k * 3 + 1] * l[1] + m.a[k * 3 + 2] * l[2] + m.t[k]);
  };
  return rigBones.map((b) => ({ ...b, from: origin(b.name), to: end(b) }));
}

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
 * MW-STEEL4: one piece's shapes weighted to its rig in `bind` (plateBind) - one `[[bone, weight], ...]` list per vertex
 * per shape (tools/skinWeights.mjs jointWeights), and the rig's bones at their binds, for skinnedMeshesToNif.
 */
export function pieceRig(id, meshes, bind) {
  const r = PLATE_RIG[id];
  if (!r) throw new Error(`no rig for the ${id}`);
  const segments = rigSegments(r.bones, bind);
  return {
    shape: r.shape,
    weights: meshes.map((m) => jointWeights(m.positions, segments, { hang: r.hang ?? null })),
    bones: r.bones.map((b) => ({ name: b.name, bind: bind.get(b.name) })),
  };
}

/**
 * The bake: the two committed exports, the eight paintings and retail's skeleton in, every piece's NIF and every
 * texture's DDS out. Each piece is skinned in the skeleton's bind (MW-STEEL4). Pure - bytes in, bytes out.
 */
export function bakeSteelPlate({ open, closed, pngs, skeleton }, { sheets = false } = {}) {
  if (!skeleton) throw new Error('no skeleton to skin the plate in - the bake reads its bind (RETAIL_SKELETON)');
  const trees = { open: readFbx(Buffer.from(open)), closed: readFbx(Buffer.from(closed)) };
  const bind = plateBind(skeleton);
  const textures = Object.keys(TEXTURES).map((tex) => {
    if (!pngs[tex]) throw new Error(`no painting for the ${tex} texture`);
    const png = readPng(pngs[tex]);
    return { tex, png, dds: writeDds(mipChain({ width: png.width, height: png.height, data: png.data })) };
  });
  const byTex = new Map(textures.map((t) => [t.tex, t]));
  const pieces = PIECES.map((p) => {
    const meshes = p.shapes.map((s) => bakeObject(trees[p.file], s.object, s.box));
    const r = pieceRig(p.id, meshes, bind);
    const nif = skinnedMeshesToNif(p.shapes.map((s, i) => ({ mesh: meshes[i], texture: textureName(s.texture), name: `${r.shape} ${i}`, weights: r.weights[i] })),
      { node: `Steel Plate ${p.id}`, bones: r.bones });
    const out = { id: p.id, meshes, weights: r.weights, nif };
    if (sheets) {
      const t = byTex.get(p.shapes[0].texture).png;
      out.sheet = writePng(previewSheet(meshes[0], 360, { width: t.width, height: t.height, data: t.data }));
    }
    return out;
  });
  return { pieces, textures, bind };
}

/** The bounds of the scene's reference head and neck (SCENE_BODY). */
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
    console.log('  the reference body, stripped - its bounds for SCENE_BODY:');
    for (const [part, b] of Object.entries(r.reference)) console.log(`    ${part}: min ${JSON.stringify(b.min)} max ${JSON.stringify(b.max)}`);
  }
  const missing = Object.entries(TEXTURES).filter(([, p]) => !existsSync(p)).map(([t]) => t);
  if (missing.length) { console.error(`no painting yet for: ${missing.join(', ')} (${missing.map((t) => TEXTURES[t]).join(', ')})`); process.exit(1); }
  const wantSheets = args.includes('--sheets');
  const r = bakeSteelPlate({
    open: readFileSync(SOURCE.open), closed: readFileSync(SOURCE.closed),
    pngs: Object.fromEntries(Object.entries(TEXTURES).map(([t, p]) => [t, readFileSync(p)])),
    skeleton: readFileSync(RETAIL_SKELETON),
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
