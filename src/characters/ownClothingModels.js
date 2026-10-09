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

/** Every mesh path the cloak can ask for - for a preload and a coverage walk alike. */
export const ownCloakModelPaths = () => CLOAK_PAINTINGS.map((p) => `meshes/${cloakModel(p)}`);

/** Is a bound piece's slot the cloak's? The composer labels the add `cloak (<id>)`, as every worn add is labelled
 *  `<part> (<record id>)`, and no part of ARMO_PART is named "cloak". */
export const isCloakSlot = (slot) => String(slot ?? '').startsWith('cloak (');
