// THE ARMOUR MORROWIND DOES NOT HAVE.
//
// MW-BRIG1 (2026-09-29, Mac: "This is for the morrowind model. The steel
// brigantine"). The worn counterpart of ownWeaponModels.js, and a leaf
// for the same reason that one is: mwItemMap.js asks it, and nothing it
// imports may reach back.
//
// A worn Daggerfall piece reaches the Morrowind body through the player's
// own records - mwArmorRecords finds an ARMO by material and piece token,
// composeRefs follows its part references to BODY records, and each BODY
// names the mesh. A model the port ships has no record in anybody's
// Morrowind.esm, so this table stands where those two records would: per
// piece, which Morrowind PART it fills (ARMO_PART's names - that is what
// decides its bone and the skin it hides) and the mesh, shipped by
// systems/ownMwAssets.js under the same `meshes/` path a BODY's model
// takes. Everything downstream - the priority law, the skin shadows, the
// binder - is the ordinary path.
//
// ═══ KEYED ON TEMPLATE AND MATERIAL ═══════════════════════════════
//
// The weapon table keys on the template alone because the Thunderlock has
// no material ladder. Armour does: Roleplay & Realism Items' Jerkin is
// leather, fur or "Brigandine" by its material (rriItems.js lightWord -
// Iron and up), and Mac's model is the STEEL one. Every other material
// of the same jerkin keeps the retail cuirass it resolved to before.
//
// ═══ MW-STEEL1: THE STEEL PLATE ═══════════════════════════════════
//
// (2026-10-06, Mac: "These 2 files are for the armor replacement of the
// morrowind steel armor with a varient to toggle the helmet type".) A
// whole set: Daggerfall's seven classic pieces in STEEL wear Mac's plate
// instead of retail's steel_* records - Steel only, Mac's answer, so Silver
// and Elven (which wear Morrowind's steel because Morrowind has no silver
// armour) keep retail's, and so does every Roleplay & Realism piece but the
// brigandine. The helm comes two ways, closed (a visor and a plume) and
// open (a nasal helm, the face showing): `styles`, picked by the Steel
// Helm switch (systems/features.js, pref `mwSteelHelm`; closed by default,
// Mac's answer). bible/04-Characters/Steel-Plate.md is the record.
import { ARMOR_MATERIAL } from '../systems/armorMaterials.js';

/** Roleplay & Realism Items' Jerkin (systems/rriItems.js RRI_TEMPLATES,
 *  ItemJerkin). Restated rather than imported for the leaf's sake;
 *  test/mwbrig2.test.js holds it to the mod's own row. */
export const RRI_JERKIN_TEMPLATE = 520;

/** MW-STEEL1: Daggerfall's classic armour templates (combat/enemyEquipment.js ARMOR_ENUM, DFU's ItemEnums.Armor),
 *  restated for the leaf's sake; test/mwsteel1.test.js holds them to the enum. */
export const CLASSIC_ARMOR_TEMPLATE = Object.freeze({
  Cuirass: 102, Gauntlets: 103, Greaves: 104, Left_Pauldron: 105, Right_Pauldron: 106, Helm: 107, Boots: 108,
});

/** MW-STEEL1: the steel helm's two styles - the Steel Helm switch's values (systems/features.js, pref `mwSteelHelm`),
 *  the default first. */
export const STEEL_HELM_STYLES = Object.freeze(['closed', 'open']);
export const STEEL_HELM_DEFAULT = STEEL_HELM_STYLES[0];

/** MW-STEEL1: THE BODY MAC'S STEEL PLATE WAS FITTED ON - the bounds (scene units, Morrowind's axes) of the Breton
 *  head and neck his scene carries, measured by `node tools/bakeSteelPlate.mjs --import`. The meshes are Morrowind's
 *  own and were stripped from the committed source; these twelve numbers are what the fit needs of them. */
export const STEEL_PLATE_SCENE = Object.freeze({
  head: Object.freeze({ min: Object.freeze([-4.764463, -5.649226, 113.146219]), max: Object.freeze([4.764463, 9.197224, 129.199977]) }),
  neck: Object.freeze({ min: Object.freeze([-3.895279, -4.097911, 109.962381]), max: Object.freeze([3.895279, 3.687286, 121.834567]) }),
});

/** MW-STEEL1: the set's fits. Every piece but the helm and the boots keeps its place by the NECK - the one part of
 *  the scene's body every wearer has in the same place over the shoulders, across and front to back by its middle and
 *  up by its base. The helm sits on the wearer's own HEAD (heads differ by race and face; the neck would carry it to
 *  where the Breton's was): across by its middle, front to back by the back of the skull (noses differ, skulls far
 *  less), up by its crown. The boots stand on the wearer's FEET (legs differ in length between the three skeletons;
 *  a boot off the ground or sunk into it is the plainest error a body can show), the sole at the foot's lowest point,
 *  and keep the neck's across and front to back so they stay under the greaves. */
const AT_NECK = Object.freeze({ to: 'neck', x: 'centre', y: 'centre', z: 'min', scene: STEEL_PLATE_SCENE.neck });
const AT_HEAD = Object.freeze({ to: 'head', x: 'centre', y: 'min', z: 'max', scene: STEEL_PLATE_SCENE.head });
const ON_FEET = Object.freeze({ to: 'foot', z: 'min', scene: 'self' });
const NECK_FIT = Object.freeze([AT_NECK]);
const HEAD_FIT = Object.freeze([AT_HEAD]);
const BOOT_FIT = Object.freeze([Object.freeze({ ...AT_NECK, z: null }), ON_FEET]);
const slotsOf = (fit) => Object.freeze([...new Set(fit.map((r) => r.to))]);

const part = (p, model, hides = null) => Object.freeze({ part: p, model, ...(hides ? { hides: Object.freeze(hides) } : {}) });
const steel = (id, name, templateIndex, { skinFrom, fit, parts, styles = null }) => Object.freeze({
  id, name, templateIndex, material: ARMOR_MATERIAL.Steel,
  skinFrom: Object.freeze(skinFrom), fit, fitFrom: slotsOf(fit), parts: Object.freeze(parts),
  ...(styles ? { styles: Object.freeze(styles) } : {}),
});

/** MW-STEEL1: Mac's steel plate, piece by piece (tools/bakeSteelPlate.mjs bakes the meshes). Each piece fills the
 *  ARMO_PART slots a retail piece of its shape fills, so the priority law and the skin shadows are the ordinary path:
 *  the cuirass the cuirass (the breastplate alone - Mac: "its just the breastplate and leg armor"); each gauntlet its
 *  hand, hiding the wrist and forearm under it; the greaves the upper legs;
 *  each pauldron its pauldron; each boot its foot, hiding the ankle and knee. The helm fills the HAIR slot, which
 *  hides the hair and leaves the head - the open helm shows the face, and the closed one's eye slit looks onto it. */
function steelPlate() {
  const helmClosed = Object.freeze([part('hair', 'steel_plate_helm_closed.nif')]);
  const helmOpen = Object.freeze([part('hair', 'steel_plate_helm_open.nif')]);
  return [
    steel('daggerfall_steel_cuirass', 'Steel Cuirass', CLASSIC_ARMOR_TEMPLATE.Cuirass, {
      skinFrom: ['chest', 'groin', 'upperarm'], fit: NECK_FIT, parts: [part('cuirass', 'steel_plate_cuirass.nif')],
    }),
    steel('daggerfall_steel_gauntlets', 'Steel Gauntlets', CLASSIC_ARMOR_TEMPLATE.Gauntlets, {
      skinFrom: ['hand', 'wrist', 'forearm', 'upperarm'], fit: NECK_FIT,
      parts: [
        part('right hand', 'steel_plate_gauntlet_right.nif', ['right wrist', 'right forearm']),
        part('left hand', 'steel_plate_gauntlet_left.nif', ['left wrist', 'left forearm']),
      ],
    }),
    steel('daggerfall_steel_greaves', 'Steel Greaves', CLASSIC_ARMOR_TEMPLATE.Greaves, {
      skinFrom: ['upperleg', 'knee', 'groin'], fit: NECK_FIT,
      parts: [part('right upper leg', 'steel_plate_greave_right.nif'), part('left upper leg', 'steel_plate_greave_left.nif')],
    }),
    steel('daggerfall_steel_left_pauldron', 'Steel Left Pauldron', CLASSIC_ARMOR_TEMPLATE.Left_Pauldron, {
      skinFrom: ['upperarm', 'chest'], fit: NECK_FIT, parts: [part('left pauldron', 'steel_plate_pauldron_left.nif')],
    }),
    steel('daggerfall_steel_right_pauldron', 'Steel Right Pauldron', CLASSIC_ARMOR_TEMPLATE.Right_Pauldron, {
      skinFrom: ['upperarm', 'chest'], fit: NECK_FIT, parts: [part('right pauldron', 'steel_plate_pauldron_right.nif')],
    }),
    steel('daggerfall_steel_helm', 'Steel Helm', CLASSIC_ARMOR_TEMPLATE.Helm, {
      skinFrom: ['head'], fit: HEAD_FIT, parts: helmClosed, styles: { closed: helmClosed, open: helmOpen },
    }),
    steel('daggerfall_steel_boots', 'Steel Boots', CLASSIC_ARMOR_TEMPLATE.Boots, {
      skinFrom: ['foot', 'ankle', 'knee'], fit: BOOT_FIT,
      parts: [
        part('right foot', 'steel_plate_boot_right.nif', ['right ankle', 'right knee']),
        part('left foot', 'steel_plate_boot_left.nif', ['left ankle', 'left knee']),
      ],
    }),
  ];
}

/**
 * The port's own worn models.
 *
 * `skinFrom`: the body slots the model was fitted over. It is SKINNED FROM THEM at bind time
 * (formats/mwSkinTransfer.js): every vertex copies the skin of the body vertex under it, so it moves by the body's
 * own bones and binds and never comes away from it (MW-BRIG2).
 *
 * `fitTo`: the body slot the model HIDES, and so must cover (MW-BRIG3). At bind time the model is moved onto the
 * wearer - its top to that part's top, measured in the rest pose - before it is skinned. The meshes keep the
 * modeller's scene placement (tools/bakeBrigandine.mjs, `placement: 'scene'`), but that scene's body stood lower than
 * the Morrowind body: drawn at the scene's height, the brigandine sat below the torso and left the chest it hides
 * bare, in MW-BRIG1 and MW-BRIG2 alike.
 *
 * `fit` (MW-STEEL1): the same lesson said for a scene that CARRIES its body. Mac's steel-plate scene has the body it
 * was fitted on - Morrowind's own Breton head and neck, whose bounds STEEL_PLATE_SCENE keeps - so a piece keeps its
 * relation to that body rather than to its own edges: a list of rules (formats/mwSkinTransfer.js fitShift), each
 * naming a wearer's part (`to`), for each axis the feature of it to meet ('min', 'max', 'centre'), and the scene's own
 * bounds of that part (or 'self', the piece's own, for a part the scene did not carry). A pure translation, measured
 * on the wearer in the rest pose, before the piece is skinned. `fitFrom` is the slots the rules measure.
 *
 * `hides`, per part: the slots a part covers beyond its own, reserved with no mesh so their skin is not drawn (a
 * gauntlet over the wrist and forearm, a boot over the ankle and knee) - reserveIndividualPart's occupation, at the
 * armour's priority like the part itself.
 *
 * `styles`: a piece that comes more than one way (the steel helm), the parts of each - `parts` is the default's.
 */
export const OWN_MW_ARMOR = Object.freeze([
  Object.freeze({
    id: 'daggerfall_brigandine_steel',
    name: 'Steel Brigandine',
    templateIndex: RRI_JERKIN_TEMPLATE,
    material: ARMOR_MATERIAL.Steel,
    // One piece, worn as a cuirass (it hides the chest skin). The skirt needs no split of its own: skinned from the
    // groin, thighs and knees, it bends with the legs under it.
    skinFrom: Object.freeze(['chest', 'groin', 'upperleg', 'knee']),
    fitTo: 'chest',   // MW-BRIG3: its closed top sits where the chest skin it hides ends, at the base of the neck
    parts: Object.freeze([
      Object.freeze({ part: 'cuirass', model: 'brigandine_steel.nif' }),
    ]),
  }),
  ...steelPlate(),
]);

/** The own model this worn piece wears, or null for everything that
 *  resolves through Morrowind's own records. */
export const ownArmorModelFor = (piece) =>
  (piece && OWN_MW_ARMOR.find((a) => a.templateIndex === piece.templateIndex && a.material === piece.material)) || null;

/** MW-STEEL1: the parts an own model wears in this style - its `styles` entry when it has one, else `parts`. */
export const ownArmorParts = (own, { helmStyle = STEEL_HELM_DEFAULT } = {}) =>
  (own?.styles?.[helmStyle] ?? own?.parts ?? []);

/** Every mesh path this table can ask for, derived rather than typed out
 *  again - for a preload and a coverage walk alike. Every style's. */
export const ownArmorModelPaths = () =>
  [...new Set(OWN_MW_ARMOR.flatMap((a) => [a.parts, ...Object.values(a.styles ?? {})].flat().map((p) => `meshes/${p.model}`)))];
