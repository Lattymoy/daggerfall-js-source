// NPC3b: WHAT A TOWNSPERSON IS WEARING.
//
// Mac: "just give them a random assortment of clothing depending on
// what they are." Both halves of that sentence are load-bearing.
//
// ── WHY THIS EXISTS AT ALL ───────────────────────────────────────
//
// A Daggerfall townsperson carries NO equipment: their clothes are
// painted into the sprite. A Morrowind body is skin plus what it
// wears, so without a wardrobe every citizen renders NUDE. This is
// therefore an INVENTION, and it is declared as one - the port's own
// clothes for people the game never dressed.
//
// ── "DEPENDING ON WHAT THEY ARE" ─────────────────────────────────
//
// Not invented: the NPC's faction SOCIAL GROUP (FACTION.TXT's sgroup,
// DFU's own five - Commoners, Merchants, Scholars, Nobility,
// Underworld). A noble wears a surcoat and a beggar wears a shirt
// because the data says which they are.
//
// ── "RANDOM" MEANS STABLE, NOT ROLLED ────────────────────────────
//
// An NPC whose shirt changed every frame would be worse than a
// sprite. The pick rides `nameSeed` - the same identity DFU derives a
// person's NAME from (StaticNPC.cs:245) - so someone's clothes are
// exactly as stable as their name, across frames, saves and revisits.
//
// It deliberately does NOT draw from DFU's shared PRNG. srand/rand is
// one stream that names, loot and quests all pull from; spending
// draws on clothing would shift every later roll in the game.
//
// ── THE CACHE BUDGET, STATED ─────────────────────────────────────
//
// Every distinct outfit is a BUILD and a cached body (NPC1), so this
// table's size is a memory decision, not a taste one:
//
//   5 tiers x 2 sexes x PERSONAS_PER_TIER = the region's whole crowd
//
// A region has ONE race (REGION_RACES), so that product is the live
// working set; travelling evicts the old one naturally. The face is
// folded INTO the persona rather than varying independently, because
// independent faces would multiply the set instead of adding to it.
import { SOCIAL_GROUPS } from '../formats/factionFile.js';
import { CLOTHING_NAME } from '../formats/mwItemMap.js';

/** How many distinct looks a tier offers per sex. Four is a crowd
 *  that does not read as clones without becoming a memory problem -
 *  see the budget above; the pin asserts the product. */
export const PERSONAS_PER_TIER = 4;

/** The five tiers a wardrobe is written for. Every other sgroup - the
 *  unnamed ones, guild members, supernatural beings - dresses as a
 *  commoner, which is the honest default rather than a hole. */
export const WARDROBE_TIERS = Object.freeze([
  SOCIAL_GROUPS.Commoners, SOCIAL_GROUPS.Merchants,
  SOCIAL_GROUPS.Scholars, SOCIAL_GROUPS.Nobility, SOCIAL_GROUPS.Underworld,
]);

export function wardrobeTier(sgroup) {
  return WARDROBE_TIERS.includes(sgroup) ? sgroup : SOCIAL_GROUPS.Commoners;
}

// Daggerfall's clothing splits at 184: men's 141-183, women's
// 184-216. An outfit is a list of template indices; the name each one
// resolves through is CLOTHING_NAME's, so the MW record is picked by
// the very same map the player's own garments use (MW-D30).
const M = {
  shoes: 147, tallBoots: 148, boots: 149, sandals: 150,
  pants: 151, breeches: 152, casualCloak: 154, formalCloak: 155,
  surcoatD: 157, shortTunic: 158, formalTunic: 159, robes: 163, priestRobes: 164,
  shortShirt: 165, longShirt: 167, openTunic: 173, surcoatA: 176, vest: 180,
};
const W = {
  blouse: 184, shoes: 186, tallBoots: 187, boots: 188, sandals: 189,
  pants: 190, casualCloak: 191, formalCloak: 192, formalEodoric: 194,
  eveningGown: 195, dayGown: 196, casualDress: 197, straplessDress: 198,
  robes: 200, priestessRobes: 201, shortShirt: 202, longShirt: 204,
  openTunic: 210, wrap: 211, longSkirt: 212, vest: 216,
};

/** tier -> sex -> PERSONAS_PER_TIER outfits. Each persona also fixes a
 *  FACE, so a crowd varies in both without the two multiplying. */
const WARDROBE = Object.freeze({
  [SOCIAL_GROUPS.Commoners]: {
    male: [
      [M.shortShirt, M.pants, M.shoes], [M.longShirt, M.breeches, M.boots],
      [M.shortShirt, M.breeches, M.sandals], [M.robes, M.shoes],
    ],
    female: [
      [W.blouse, W.longSkirt, W.shoes], [W.shortShirt, W.pants, W.shoes],
      [W.casualDress, W.shoes], [W.robes, W.sandals],
    ],
  },
  [SOCIAL_GROUPS.Merchants]: {
    male: [
      [M.longShirt, M.breeches, M.tallBoots], [M.shortTunic, M.breeches, M.shoes],
      [M.longShirt, M.pants, M.boots, M.casualCloak], [M.vest, M.breeches, M.boots],
    ],
    female: [
      [W.dayGown, W.shoes], [W.longShirt, W.longSkirt, W.shoes],
      [W.vest, W.pants, W.boots], [W.casualDress, W.casualCloak, W.shoes],
    ],
  },
  [SOCIAL_GROUPS.Scholars]: {
    male: [
      [M.robes, M.shoes], [M.priestRobes, M.sandals],
      [M.formalTunic, M.breeches, M.shoes], [M.robes, M.casualCloak, M.boots],
    ],
    female: [
      [W.robes, W.shoes], [W.priestessRobes, W.sandals],
      [W.dayGown, W.shoes], [W.robes, W.casualCloak, W.boots],
    ],
  },
  [SOCIAL_GROUPS.Nobility]: {
    male: [
      [M.formalTunic, M.breeches, M.tallBoots, M.formalCloak],
      [M.surcoatD, M.breeches, M.tallBoots], [M.surcoatA, M.breeches, M.boots],
      [M.formalTunic, M.breeches, M.shoes],
    ],
    female: [
      [W.eveningGown, W.formalCloak, W.shoes], [W.formalEodoric, W.longSkirt, W.tallBoots],
      [W.dayGown, W.shoes], [W.straplessDress, W.formalCloak, W.shoes],
    ],
  },
  [SOCIAL_GROUPS.Underworld]: {
    male: [
      [M.shortShirt, M.pants, M.boots], [M.openTunic, M.breeches, M.boots],
      [M.shortShirt, M.breeches, M.tallBoots], [M.vest, M.pants, M.shoes],
    ],
    female: [
      [W.openTunic, W.pants, W.boots], [W.shortShirt, W.longSkirt, W.boots],
      [W.wrap, W.pants, W.shoes], [W.vest, W.pants, W.tallBoots],
    ],
  },
});

/**
 * A stable, self-contained spread of one seed. NOT DFU's PRNG: that
 * stream is shared with names, loot and quests, and spending draws on
 * clothing would shift every later roll in the game.
 */
function spread(seed) {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * What this person wears and which face they wear it with.
 *
 * @param nameSeed the NPC's own identity (DFU's, stable across saves)
 * @param sgroup   their faction's social group
 * @param female   from the billboard's own gender bit
 * @returns {{worn: object[], faceIndex: number, persona: number, tier: number}}
 */
export function personaFor(nameSeed, sgroup, female = false) {
  const tier = wardrobeTier(sgroup);
  const rack = WARDROBE[tier][female ? 'female' : 'male'];
  const n = spread(nameSeed);
  const persona = n % rack.length;
  return {
    tier,
    persona,
    // The face rides the SAME persona, so looks vary without the
    // wardrobe and the face pool multiplying into each other.
    faceIndex: persona,
    // The shape composeWornArmor wants, through CLOTHING_NAME - the
    // same door the player's own garments resolve by (MW-D30).
    worn: rack[persona].map((templateIndex) => ({
      kind: 'clothing',
      templateIndex,
      name: CLOTHING_NAME[templateIndex],
      dye: 0,
    })),
  };
}

/** The whole table's size, for the budget pin: how many distinct
 *  bodies a region's crowd can ask the cache for. */
export function wardrobeBudget() {
  let outfits = 0;
  for (const tier of WARDROBE_TIERS) {
    outfits += WARDROBE[tier].male.length + WARDROBE[tier].female.length;
  }
  return outfits;
}
