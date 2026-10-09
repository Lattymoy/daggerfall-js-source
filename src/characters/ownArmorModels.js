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
// Iron and up). Mac's model was the STEEL one (MW-BRIG1); since MW-BRIG4
// every brigandine metal wears it in its own painting, and the leather
// and fur jerkins keep the retail cuirass they resolved to before.
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
//
// MW-STEEL4 (2026-10-07, Mac: "You do it properly"): the plate's meshes
// ship SKINNED, as retail's armour does - weighted to Morrowind's own
// bones in its bind at bake time (tools/bakeSteelPlate.mjs) - so a steel
// piece here is the parts it fills and nothing else, and the binder takes
// it on the very path it takes a retail ARMO's BODY meshes. The runtime fit
// and skin solve MW-STEEL1-3 carried (`fit`, `solvePose`, a part's own
// `skinFrom`) are gone with it.
// MW-BRIG4 (2026-10-09, Mac: "Also for the integrated brigadine chest piece, we need each of these textures
// implemented", nine paintings; asked which metal wears which, he took the map offered - one per metal): EVERY METAL
// OF THE BRIGANDINE JERKIN wears the brigandine now, each in its own painting - the one mesh, baked once per metal
// with that metal's texture (tools/bakeBrigandine.mjs). Steel keeps MW-BRIG1's red.
//
// ═══ MW-FIT1: WHAT THE PLATE COVERS ════════════════════════════════
//
// (2026-10-09, a player's report Mac passed on, over the paperdoll in both sets: "the upper arm is still visible with
// the steel armor", "the ebony armor gets the same issue", "the helmet elevation is too much", "the coif has to cover
// the neck".) A PAULDRON IS A SLEEVE: both sets' pauldrons close round the upper arm from the shoulder to the elbow,
// where the gauntlet's cuff takes over (measured on the bind - every ray out of the upper arm's bone line meets the
// pauldron), so each hides its upper arm as a gauntlet hides its forearm - and the skin that came up through the steel
// is not drawn. A CLOSED HELM IS THE HEAD: a retail helmet that fills the head's slot is the closed helm, and no head
// is drawn under it (bible/02-Formats/Morrowind-Rules.md, "A helmet force-deletes hair before its own parts are
// added"); the steel plate's closed helm and the ebony helm hide it, and stand where Mac fitted them on the body, the
// coif hung to the collar (tools/bakeSteelPlate.mjs HELM_LIFT is the open helm's alone). The open helm shows the face,
// so it keeps the head.
import { ARMOR_MATERIAL, isPlate } from '../systems/armorMaterials.js';

/** Roleplay & Realism Items' Jerkin (systems/rriItems.js RRI_TEMPLATES,
 *  ItemJerkin). Restated rather than imported for the leaf's sake;
 *  test/mwbrig2.test.js holds it to the mod's own row. */
export const RRI_JERKIN_TEMPLATE = 520;

/** MW-BRIG4: the metals the Jerkin is a BRIGANDINE in - every plate material, Iron to Daedric (rriItems.js lightWord:
 *  "Iron and up"), in the material ladder's order. Each wears the brigandine in its own painting. */
export const BRIGANDINE_METALS = Object.freeze(Object.keys(ARMOR_MATERIAL).filter((k) => isPlate(ARMOR_MATERIAL[k])));

/** MW-STEEL1: Daggerfall's classic armour templates (combat/enemyEquipment.js ARMOR_ENUM, DFU's ItemEnums.Armor),
 *  restated for the leaf's sake; test/mwsteel1.test.js holds them to the enum. */
export const CLASSIC_ARMOR_TEMPLATE = Object.freeze({
  Cuirass: 102, Gauntlets: 103, Greaves: 104, Left_Pauldron: 105, Right_Pauldron: 106, Helm: 107, Boots: 108,
});

/** MW-STEEL1: the steel helm's two styles - the Steel Helm switch's values (systems/features.js, pref `mwSteelHelm`),
 *  the default first. */
export const STEEL_HELM_STYLES = Object.freeze(['closed', 'open']);
export const STEEL_HELM_DEFAULT = STEEL_HELM_STYLES[0];

const part = (p, model, hides = null) => Object.freeze({ part: p, model, ...(hides ? { hides: Object.freeze(hides) } : {}) });
const plate = (material) => (id, name, templateIndex, { parts, styles = null }) => Object.freeze({
  id, name, templateIndex, material, parts: Object.freeze(parts),
  ...(styles ? { styles: Object.freeze(styles) } : {}),
});
const steel = plate(ARMOR_MATERIAL.Steel);
const ebony = plate(ARMOR_MATERIAL.Ebony);   // MW-EBONY1

/** MW-STEEL1: Mac's steel plate, piece by piece (tools/bakeSteelPlate.mjs bakes the meshes, skinned - MW-STEEL4). Each
 *  piece fills the ARMO_PART slots a retail piece of its shape fills, so the priority law and the skin shadows are the
 *  ordinary path: the cuirass the cuirass, and (MW-STEEL2, its painting come: "This is the missing texture for the
 *  morrowind steel armor's skirt") the plate skirt under it Morrowind's skirt slot - modelled from the same cuirass mesh
 *  as the breastplate, shadowing nothing (ARMO_PART's skirt row), so a clothing skirt worn over it takes the slot at its
 *  higher priority as the law says; each gauntlet its hand, hiding the wrist and forearm under it; the greaves the
 *  upper legs; each pauldron its pauldron, hiding the upper arm it sleeves to the elbow (MW-FIT1); each boot its foot,
 *  hiding the ankle and knee. The helm fills the HAIR slot, which hides the hair; the open helm leaves the head, its
 *  face showing, and the closed one hides it (MW-FIT1). */
function steelPlate() {
  const helmClosed = Object.freeze([part('hair', 'steel_plate_helm_closed.nif', ['head'])]);   // MW-FIT1: a closed helm is the head
  const helmOpen = Object.freeze([part('hair', 'steel_plate_helm_open.nif')]);
  return [
    steel('daggerfall_steel_cuirass', 'Steel Cuirass', CLASSIC_ARMOR_TEMPLATE.Cuirass, {
      parts: [part('cuirass', 'steel_plate_cuirass.nif'), part('skirt', 'steel_plate_skirt.nif')],
    }),
    steel('daggerfall_steel_gauntlets', 'Steel Gauntlets', CLASSIC_ARMOR_TEMPLATE.Gauntlets, {
      parts: [
        part('right hand', 'steel_plate_gauntlet_right.nif', ['right wrist', 'right forearm']),
        part('left hand', 'steel_plate_gauntlet_left.nif', ['left wrist', 'left forearm']),
      ],
    }),
    steel('daggerfall_steel_greaves', 'Steel Greaves', CLASSIC_ARMOR_TEMPLATE.Greaves, {
      parts: [part('right upper leg', 'steel_plate_greave_right.nif'), part('left upper leg', 'steel_plate_greave_left.nif')],
    }),
    steel('daggerfall_steel_left_pauldron', 'Steel Left Pauldron', CLASSIC_ARMOR_TEMPLATE.Left_Pauldron, {
      parts: [part('left pauldron', 'steel_plate_pauldron_left.nif', ['left upper arm'])],
    }),
    steel('daggerfall_steel_right_pauldron', 'Steel Right Pauldron', CLASSIC_ARMOR_TEMPLATE.Right_Pauldron, {
      parts: [part('right pauldron', 'steel_plate_pauldron_right.nif', ['right upper arm'])],
    }),
    steel('daggerfall_steel_helm', 'Steel Helm', CLASSIC_ARMOR_TEMPLATE.Helm, {
      parts: helmClosed, styles: { closed: helmClosed, open: helmOpen },
    }),
    steel('daggerfall_steel_boots', 'Steel Boots', CLASSIC_ARMOR_TEMPLATE.Boots, {
      parts: [
        part('right foot', 'steel_plate_boot_right.nif', ['right ankle', 'right knee']),
        part('left foot', 'steel_plate_boot_left.nif', ['left ankle', 'left knee']),
      ],
    }),
  ];
}

/** MW-BRIG1: Roleplay & Realism Items' Jerkin as a brigandine - MW-BRIG4: in every metal it is one, its painting the
 *  metal's (`brigandine_<metal>.nif`, which names `brigandine_<metal>.dds`). One piece, worn as a cuirass (it hides the
 *  chest skin). The skirt needs no split of its own: skinned from the groin, thighs and knees, it bends with the legs
 *  under it. */
const BRIGANDINE_SKIN_FROM = Object.freeze(['chest', 'groin', 'upperleg', 'knee']);
const brigandine = (metal) => Object.freeze({
  id: `daggerfall_brigandine_${metal.toLowerCase()}`,
  name: `${metal} Brigandine`,
  templateIndex: RRI_JERKIN_TEMPLATE,
  material: ARMOR_MATERIAL[metal],
  skinFrom: BRIGANDINE_SKIN_FROM,
  fitTo: 'chest',   // MW-BRIG3: its closed top sits where the chest skin it hides ends, at the base of the neck
  parts: Object.freeze([Object.freeze({ part: 'cuirass', model: `brigandine_${metal.toLowerCase()}.nif` })]),
});

/** MW-EBONY1 (2026-10-09, Mac: "The ebony armor set and its textures"; asked, Ebony only): Mac's ebony plate,
 *  Daggerfall's seven classic pieces in Ebony (tools/bakeEbonyPlate.mjs bakes the meshes, skinned as the steel plate's
 *  are). Each piece fills the slots its steel twin fills and hides what it hides - the breastplate the cuirass and its
 *  plates the skirt, each gauntlet its hand over the wrist and forearm, each pauldron its pauldron over the upper arm,
 *  the greaves the upper legs, each boot its foot over the ankle and knee, the helm the HAIR over the head (one helm,
 *  closed, no styles). Mithril and Adamantium keep the Morrowind ebony they wore (mwItemMap.js
 *  DF_TO_MW_ARMOR_MATERIAL). */
function ebonyPlate() {
  return [
    ebony('daggerfall_ebony_cuirass', 'Ebony Cuirass', CLASSIC_ARMOR_TEMPLATE.Cuirass, {
      parts: [part('cuirass', 'ebony_plate_cuirass.nif'), part('skirt', 'ebony_plate_skirt.nif')],
    }),
    ebony('daggerfall_ebony_gauntlets', 'Ebony Gauntlets', CLASSIC_ARMOR_TEMPLATE.Gauntlets, {
      parts: [
        part('right hand', 'ebony_plate_gauntlet_right.nif', ['right wrist', 'right forearm']),
        part('left hand', 'ebony_plate_gauntlet_left.nif', ['left wrist', 'left forearm']),
      ],
    }),
    ebony('daggerfall_ebony_greaves', 'Ebony Greaves', CLASSIC_ARMOR_TEMPLATE.Greaves, {
      parts: [part('right upper leg', 'ebony_plate_greave_right.nif'), part('left upper leg', 'ebony_plate_greave_left.nif')],
    }),
    ebony('daggerfall_ebony_left_pauldron', 'Ebony Left Pauldron', CLASSIC_ARMOR_TEMPLATE.Left_Pauldron, {
      parts: [part('left pauldron', 'ebony_plate_pauldron_left.nif', ['left upper arm'])],
    }),
    ebony('daggerfall_ebony_right_pauldron', 'Ebony Right Pauldron', CLASSIC_ARMOR_TEMPLATE.Right_Pauldron, {
      parts: [part('right pauldron', 'ebony_plate_pauldron_right.nif', ['right upper arm'])],
    }),
    ebony('daggerfall_ebony_helm', 'Ebony Helm', CLASSIC_ARMOR_TEMPLATE.Helm, { parts: [part('hair', 'ebony_plate_helm.nif', ['head'])] }),
    ebony('daggerfall_ebony_boots', 'Ebony Boots', CLASSIC_ARMOR_TEMPLATE.Boots, {
      parts: [
        part('right foot', 'ebony_plate_boot_right.nif', ['right ankle', 'right knee']),
        part('left foot', 'ebony_plate_boot_left.nif', ['left ankle', 'left knee']),
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
 * A model with neither ships skinned (the steel plate, MW-STEEL4): its NIF carries its own weights and inverse binds,
 * as a retail armour mesh's do, and is bound exactly as one.
 *
 * `hides`, per part: the slots a part covers beyond its own, reserved with no mesh so their skin is not drawn (a
 * gauntlet over the wrist and forearm, a boot over the ankle and knee, a pauldron over the upper arm, a closed helm
 * over the head) - reserveIndividualPart's occupation, at the armour's priority like the part itself. A part the
 * first person does not draw hides nothing from it (mwItemMap.js composeWornArmor's `fpShadows`, MW-FIT1).
 *
 * `styles`: a piece that comes more than one way (the steel helm), the parts of each - `parts` is the default's.
 */
export const OWN_MW_ARMOR = Object.freeze([
  ...BRIGANDINE_METALS.map(brigandine),
  ...steelPlate(),
  ...ebonyPlate(),
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
