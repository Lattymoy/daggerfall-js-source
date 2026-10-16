// THE CLOTHING MORROWIND DOES NOT HAVE.
//
// MW-CLOAK1 (2026-10-09, Mac: "2. The new cloak and its textures. Note: The new cloak will need bones to animate with
// the character movement. Ensure theres no clipping with weapons that are stowed", with the cloak's export and eight
// paintings of it; asked, both cloaks wear it, Aquamarine and Yellow the nearest of the eight, and stowed gear rides over
// it). The clothing counterpart of ownArmorModels.js, and a leaf for the same reason: mwItemMap.js asks it, and nothing
// it imports may reach back.
//
// Daggerfall's Casual Cloak and Formal Cloak - a man's and a woman's of each - wore a whole Morrowind ROBE on the
// Morrowind body (mwItemMap.js DF_CLOTHING_ROWS), which reserves eleven slots and hides every piece of armour under
// it. They wear Mac's cloak now: one mesh hung from the shoulders down the back, shipped skinned to Morrowind's own
// bones (tools/bakeCloak.mjs), claiming no slot and hiding nothing - armour stays drawn under it. Its colour is the
// garment's dye: Daggerfall dyes clothing in ten colours and Mac painted eight, so Aquamarine wears the blue cloak and
// Yellow the light brown, the nearest of the eight.

/** The garments that wear the cloak, by the names mwItemMap.js's clothing rows know them (a man's and a woman's
 *  template each - both resolve to the name). */
export const CLOAK_NAMES = Object.freeze(['Casual Cloak', 'Formal Cloak']);

/** Mac's paintings, one mesh each (`cloak_<painting>.nif`), in Daggerfall's dye order less the two he did not paint. */
export const CLOAK_PAINTINGS = Object.freeze(['blue', 'grey', 'red', 'dark_brown', 'purple', 'light_brown', 'white', 'green']);

/** Each Daggerfall clothing dye's painting, by the dye's index (DyeColors: Blue, Grey, Red, Dark Brown, Purple, Light
 *  Brown, White, Aquamarine, Yellow, Green - mwItemMap.js DF_CLOTHING_DYE_RGB): its own where Mac painted it, the
 *  nearest of the eight where he did not - Aquamarine the blue, Yellow the light brown. */
export const CLOAK_DYE_PAINTING = Object.freeze(['blue', 'grey', 'red', 'dark_brown', 'purple', 'light_brown', 'white', 'blue', 'light_brown', 'green']);

export const cloakModel = (painting) => `cloak_${painting}.nif`;

/** The cloak a worn garment wears - `{ id, model, painting }` - or null for every garment that is not a cloak. A dye
 *  out of range wears the first (Daggerfall's own default, Blue). */
export function ownCloakFor(piece) {
  if (!piece || piece.kind !== 'clothing' || !CLOAK_NAMES.includes(piece.name)) return null;
  const painting = CLOAK_DYE_PAINTING[piece.dye | 0] ?? CLOAK_DYE_PAINTING[0];
  return Object.freeze({ id: 'daggerfall_cloak', model: cloakModel(painting), painting });
}

/** Every mesh path the cloak can ask for - the coverage walk's (each ships, test/tooling/mwcloak1.test.js). */
export const ownCloakModelPaths = () => CLOAK_PAINTINGS.map((p) => `meshes/${cloakModel(p)}`);

/** Is a bound piece's slot the cloak's? The composer labels the add `cloak (<id>)`, as every worn add is labelled
 *  `<part> (<record id>)`, and no part of ARMO_PART is named "cloak". */
export const isCloakSlot = (slot) => String(slot ?? '').startsWith('cloak (');

// ═══ MW-FOLK1: THE TOWNSFOLK'S OUTFITS ═══════════════════════════════════════════════════════════════════════════
//
// (2026-10-13, the owner: "This is for the Townspeople outfits", with the export and its paintings; asked, each walker
// sprite's own outfit in that sprite's colours - bible/04-Characters/Townsfolk-Outfits.md.) Daggerfall's townspeople
// are pictures, four outfits a race and a sex (mobilePerson.js PERSON_TEXTURES); these are those outfits made for the
// Morrowind body - all four Redguard men's, all four Nord men's, the Bretons' 385 and 386 and the hooded Redguard
// woman's 398 - so a body standing in for a picture wears what the picture wears (characters/folkBodies.js folkLookOf).
// Each is ONE skinned part (tools/bakeTownsfolk.mjs, one shape a painting) claiming no slot of its own, as the cloak
// claims none: the skin it covers all round - every ray out of the part's bone line meets the outfit, MW-FIT1's measure
// - is HIDDEN (`hides`, an occupation with no mesh at clothing's priority), and the skin a neckline, a short sleeve, a
// sandal or a bare midriff leaves showing is the body's. So is a leg part inside cloth hanging round BOTH legs all
// along its span: every ray out of the line between the two legs meets it (AUDIT MW-FOLK1 L2-F1 - one leg's rays cross
// to the other inside a skirt and never met it, so 398's dress hid nothing of the thighs it closes round, and they
// stood out through it every stride; Morrowind's skirt and robe reserve the upper legs they reach past, mwItemMap.js
// RESERVES). A hem short of a part's span hides none of it - the leg below a tunic is the body's, the cloth following
// the thighs (tools/bakeTownsfolk.mjs hangOf) - and 398's knees are hers: her hem rises to 29.4 at her sides, and
// hiding them would open the shin's top under it. A hood hides the hair, as a helmet does. `covers` names
// the skin it dresses without hiding (398's open bodice over the chest - the modesty shirt a bare chest wears is not
// hers).

/** One outfit: its id, its mesh, the ARMO_PART slots whose skin it hides, the skin it dresses without hiding. */
const outfit = (archive, hides, covers = []) => Object.freeze({
  id: `townsfolk_${archive}`, archive, model: `townsfolk_${archive}.nif`, hides: Object.freeze(hides), covers: Object.freeze(covers),
});
const PAIR = (...parts) => parts.flatMap((p) => [`right ${p}`, `left ${p}`]);

/** Each walker sprite's outfit, by its archive (the walker's picture). The skin each hides is what it covers all round
 *  (test/tooling/mwfolk1.test.js measures every one). */
export const TOWNSFOLK_OUTFITS = Object.freeze(Object.fromEntries([
  outfit(381, ['groin']),                                                                                // Redguard: the grey robe with the red hem
  outfit(382, ['groin']),                                                                                // Redguard: the kilt, the wrist cuffs, the sandals
  outfit(383, ['groin']),                                                                                // Redguard: the teal robe with the yellow hem
  outfit(384, ['groin', ...PAIR('ankle', 'foot')]),                                                      // Redguard: the striped skirt and the boots
  outfit(385, ['cuirass', 'groin', ...PAIR('upper arm', 'forearm', 'upper leg', 'knee', 'ankle', 'foot')]),   // Breton: the tunic, the long sleeves, the striped hose
  outfit(386, ['cuirass', 'groin', ...PAIR('wrist', 'upper leg', 'knee', 'ankle', 'foot')]),             // Breton: the tunic, the wraps, the breeches, the boots
  outfit(387, ['groin', ...PAIR('wrist', 'ankle', 'foot')]),                                             // Nord: the green vest, the wraps, the striped skirt, the boots
  outfit(388, ['cuirass', 'groin', 'hair', ...PAIR('upper leg', 'knee', 'ankle', 'foot')]),              // Nord: the green hood, the orange tunic, the striped hose
  outfit(389, ['cuirass', 'groin', 'hair', ...PAIR('upper leg', 'knee', 'ankle', 'foot')]),              // Nord: the hooded tunic in teal
  outfit(390, ['cuirass', 'groin', ...PAIR('wrist', 'upper leg', 'knee', 'ankle', 'foot')]),             // Nord: the teal tunic, the striped boots
  outfit(398, ['groin', 'hair', ...PAIR('upper leg', 'foot')], ['chest']),                                // Redguard woman: the hooded dress
].map((o) => [o.archive, o])));

/** The outfit a walker's sprite wears (its archive), or null for a sprite with none yet. */
export const townsfolkOutfitOf = (archive) => TOWNSFOLK_OUTFITS[archive] ?? null;

/** The outfit an id names - a look's `outfit`, read as data: an id the table does not hold is no outfit. */
export function ownOutfitFor(id) {
  for (const o of Object.values(TOWNSFOLK_OUTFITS)) if (o.id === id) return o;
  return null;
}

/** Every mesh path an outfit can ask for - the coverage walk's (each ships, test/tooling/mwfolk1.test.js). */
export const ownOutfitModelPaths = () => Object.values(TOWNSFOLK_OUTFITS).map((o) => `meshes/${o.model}`);

/** Is a bound piece's slot an outfit's? The composer labels it `outfit (<id>)`, as the cloak's is `cloak (<id>)`. */
export const isOutfitSlot = (slot) => String(slot ?? '').startsWith('outfit (');
