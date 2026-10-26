// @ts-check
// MWNPC17 (2026-10-11, Mac: "We also need to hone in on what NPCs get what type of clothing/armor. General NPCs should
// have a procedural system where barely any 2 NPCs look alike" - bible/04-Characters/Morrowind-NPCs.md section 25):
// THE WARDROBE. Every person the lanes stand in a Morrowind body was dressed by a fixed outfit: a walker by one of four
// per sprite (folkBodies.js FOLK_OUTFITS), a standing person by one per faction (peopleBodies.js PEOPLE_WARDROBE), the
// faction's knights all in the same steel - and the item map resolved each garment by its TYPE and its dye alone
// (mwItemMap.js mwClothingRecord: a Short Shirt, a Long Shirt and a Tunic are one Morrowind shirt), so a street was ten
// shirts in ten colours over the same face per portrait.
//
// Now a person is DRESSED from a ROLE, off their own seed, along every axis Morrowind can draw:
//   - WHO WEARS WHAT. A role (the street's commoner, a tradesman, a traveller, a scholar, a merchant, a noble, a priest,
//     a mage, the underworld, a fighter, a knight) holds weighted SILHOUETTES - a top and breeches, a top and a skirt, a
//     robe, a dress or a gown - each with its own Daggerfall garments (itemTemplates.json, the men's and the women's),
//     its own dyes, its odds of a cloak (the port's own, MW-CLOAK1), and the martial roles their ARMOUR: a knight's whole
//     plate of one metal by rank, a fighter's mismatched pieces, a rogue's leathers. The garments are Daggerfall's, so
//     the classic paperdoll and the item map read them as they read the player's.
//   - HOW WELL. A wealth TIER per role - Morrowind's own clothing ladder (common, expensive, extravagant, exquisite: the
//     records' ids say it) - so a noble is never in a peasant's shirt and a farmhand never in silk: a garment's rung
//     strays one from the person's, but never past the role's own (the hint's `lo` and `hi`; AUDIT MWNPC16-18 C F1).
//   - WHICH ONE. The look carries `npc` - its seed, its tier and its role's range - and the build (net/peer/peerBodies.js peerBuildOpts) reads
//     it per garment: the tier's records of the garment's type, the few nearest the dye's colour, one picked off the
//     seed (mwClothingRecord's `pick` and `tier`); and the head and the hair WALKED off the seed, each on its own (a
//     race's heads times its hairs, where the face index named one pair of ten). A player's look carries no `npc`: the
//     player and every peer are resolved exactly as before.
// Pure: no clock, no randomness but the seed's - every machine that sees the same person dresses them the same.
import { EQUIP_SLOTS } from '../systems/equip.js';
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../systems/armorMaterials.js';

/** A 32-bit mix (splitmix's finaliser) - the wardrobe's every draw. */
export function wmix(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Morrowind's clothing ladder, by the record ids' own prefixes (mwItemMap.js clothingTierOf reads them). */
export const CLOTHING_TIERS = Object.freeze(['common', 'expensive', 'extravagant', 'exquisite']);

/** Daggerfall's garments by name (itemTemplates.json, 141-181 the men's, 182-216 the women's). */
export const MENS = Object.freeze({
  straps: 141, armbands: 142, kimono: 143, sash: 145, eodoric: 146, shoes: 147, tallBoots: 148, boots: 149, sandals: 150,
  casualPants: 151, breeches: 152, shortSkirt: 153, casualCloak: 154, formalCloak: 155, dwynnenSurcoat: 157,
  shortTunic: 158, formalTunic: 159, toga: 160, reversibleTunic: 161, loincloth: 162, plainRobes: 163, priestRobes: 164,
  shortShirts: Object.freeze([165, 166, 169, 170, 178]), longShirts: Object.freeze([167, 168, 171, 172, 179]),
  openTunic: 173, wrap: 174, longSkirt: 175, anticlereSurcoat: 176, vest: 180,
});
export const WOMENS = Object.freeze({
  brassiere: 182, formalBrassiere: 183, blouse: 184, eodoric: 185, shoes: 186, tallBoots: 187, boots: 188, sandals: 189,
  casualPants: 190, casualCloak: 191, formalCloak: 192, formalEodoric: 194, eveningGown: 195, dayGown: 196,
  casualDress: 197, straplessDress: 198, plainRobes: 200, priestessRobes: 201,
  shortShirts: Object.freeze([202, 203, 206, 207, 214]), longShirts: Object.freeze([204, 205, 208, 209, 215]),
  openTunic: 210, wrap: 211, longSkirt: 212, tights: 213, vest: 216,
});
const M = MENS, W = WOMENS;

/** The dyes (characters/dyes.js DYE_COLORS: Blue 0, Grey 1, Red 2, Dark Brown 3, Purple 4, Light Brown 5, White 6,
 *  Aquamarine 7, Yellow 8, Green 9), as a role wears them. */
export const WARDROBE_DYES = Object.freeze({
  street: Object.freeze([1, 3, 5, 0, 2, 9, 6, 7, 8, 4]),
  earth: Object.freeze([3, 5, 1, 9, 6, 2]),
  fine: Object.freeze([4, 2, 0, 6, 9, 7, 8]),
  temple: Object.freeze([6, 8, 2, 5]),
  arcane: Object.freeze([0, 4, 7, 1, 6]),
  dark: Object.freeze([3, 1, 4, 9]),
  plain: Object.freeze([1, 3, 5, 6, 0]),
});

/** The silhouettes: `pants` a top over breeches, `skirt` a top over a skirt, `robe` one garment from shoulder to foot (a
 *  robe, a dress, a gown - Morrowind's robe slot, which hides what is under it). */
export const SILHOUETTES = Object.freeze(['pants', 'skirt', 'robe']);

/**
 * THE ROLES (WARDROBE_ROLES) - who wears what. Per role: `tiers` the wealth ladder's weights (common, expensive, extravagant,
 * exquisite), `dyes` the palette, `match` the odds the lower half takes the top's dye, `cloak` the odds of a cloak and
 * `formal` the odds it is the formal one; per gender each silhouette's weight and its garments (`top`, `legs`, `robe`,
 * `feet` - a list to draw one from); `armor` a kit (below), or none.
 * @typedef {{ w: number, top?: number[], legs?: number[], robe?: number[], feet: number[] }} Silhouette
 * @typedef {{ pants?: Silhouette, skirt?: Silhouette, robe?: Silhouette }} Cut
 * @typedef {{ tiers: number[], dyes: readonly number[], match: number, cloak: number, formal: number, male: Cut, female: Cut, armor?: string }} Role
 */
/** @type {Readonly<Record<string, Role>>} */
export const WARDROBE_ROLES = Object.freeze({
  // the street: a shirt or a vest, breeches or a wrap, shoes or sandals; a skirt or a plain dress for a woman
  commoner: {
    tiers: [92, 8, 0, 0], dyes: WARDROBE_DYES.street, match: 0.2, cloak: 0.08, formal: 0,
    male: {
      pants: { w: 86, top: [...M.shortShirts, ...M.longShirts, M.vest, M.openTunic, M.reversibleTunic, M.straps], legs: [M.casualPants, M.casualPants, M.breeches, M.loincloth], feet: [M.shoes, M.shoes, M.sandals, M.boots] },
      skirt: { w: 10, top: [...M.shortShirts, M.vest], legs: [M.wrap, M.shortSkirt], feet: [M.sandals, M.shoes] },
      robe: { w: 4, robe: [M.plainRobes], feet: [M.sandals, M.shoes] },
    },
    female: {
      pants: { w: 28, top: [...W.shortShirts, ...W.longShirts, W.vest, W.blouse], legs: [W.casualPants, W.tights], feet: [W.shoes, W.boots, W.sandals] },
      skirt: { w: 52, top: [W.blouse, W.blouse, ...W.shortShirts, ...W.longShirts, W.vest, W.brassiere], legs: [W.longSkirt, W.longSkirt, W.wrap], feet: [W.shoes, W.sandals, W.boots] },
      robe: { w: 20, robe: [W.casualDress, W.casualDress, W.straplessDress, W.plainRobes], feet: [W.shoes, W.sandals] },
    },
  },
  // a tradesman: a tunic, breeches, boots - the walker's second outfit, a merchant's hand
  tradesman: {
    tiers: [78, 20, 2, 0], dyes: WARDROBE_DYES.earth, match: 0.3, cloak: 0.1, formal: 0.1,
    male: { pants: { w: 100, top: [M.shortTunic, M.reversibleTunic, M.openTunic, ...M.longShirts, M.vest, M.eodoric], legs: [M.breeches, M.casualPants], feet: [M.boots, M.boots, M.tallBoots, M.shoes] } },
    female: {
      pants: { w: 70, top: [...W.longShirts, W.vest, W.eodoric, W.openTunic], legs: [W.casualPants, W.tights], feet: [W.boots, W.tallBoots, W.shoes] },
      skirt: { w: 30, top: [...W.longShirts, W.blouse, W.vest], legs: [W.longSkirt], feet: [W.boots, W.shoes] },
    },
  },
  // a traveller: a long shirt, breeches, tall boots and, more often than not, a cloak
  traveller: {
    tiers: [80, 18, 2, 0], dyes: WARDROBE_DYES.earth, match: 0.25, cloak: 0.6, formal: 0.05,
    male: { pants: { w: 100, top: [...M.longShirts, M.shortTunic, M.openTunic, M.vest], legs: [M.breeches, M.casualPants], feet: [M.tallBoots, M.tallBoots, M.boots] } },
    female: {
      pants: { w: 75, top: [...W.longShirts, W.vest, W.openTunic], legs: [W.casualPants, W.tights], feet: [W.tallBoots, W.tallBoots, W.boots] },
      skirt: { w: 25, top: [...W.shortShirts, ...W.longShirts], legs: [W.longSkirt], feet: [W.tallBoots, W.boots] },
    },
  },
  // a scholar: a plain robe, or a long shirt under a cloak
  scholar: {
    tiers: [70, 26, 4, 0], dyes: WARDROBE_DYES.plain, match: 0.6, cloak: 0.35, formal: 0.2,
    male: {
      robe: { w: 70, robe: [M.plainRobes, M.plainRobes, M.kimono, M.toga], feet: [M.shoes, M.sandals] },
      pants: { w: 30, top: [...M.longShirts, M.formalTunic], legs: [M.breeches], feet: [M.shoes, M.boots] },
    },
    female: {
      robe: { w: 70, robe: [W.plainRobes, W.plainRobes, W.casualDress], feet: [W.shoes, W.sandals] },
      skirt: { w: 30, top: [...W.longShirts, W.blouse], legs: [W.longSkirt], feet: [W.shoes] },
    },
  },
  // a merchant: a fine tunic or a long shirt, breeches, boots; now and then a cloak
  merchant: {
    tiers: [45, 45, 9, 1], dyes: WARDROBE_DYES.earth.concat([0, 4]), match: 0.35, cloak: 0.18, formal: 0.3,
    male: { pants: { w: 100, top: [M.shortTunic, M.formalTunic, M.reversibleTunic, ...M.longShirts, M.vest, M.eodoric], legs: [M.breeches, M.breeches, M.casualPants], feet: [M.boots, M.tallBoots, M.shoes] } },
    female: {
      pants: { w: 35, top: [...W.longShirts, W.eodoric, W.vest], legs: [W.casualPants, W.tights], feet: [W.boots, W.tallBoots, W.shoes] },
      skirt: { w: 45, top: [W.blouse, ...W.longShirts, W.eodoric], legs: [W.longSkirt], feet: [W.shoes, W.boots] },
      robe: { w: 20, robe: [W.dayGown, W.casualDress], feet: [W.shoes] },
    },
  },
  // the nobility and the courts: a formal tunic, breeches or tights, tall boots, a formal cloak; a gown
  noble: {
    tiers: [0, 35, 45, 20], dyes: WARDROBE_DYES.fine, match: 0.45, cloak: 0.4, formal: 0.85,
    male: {
      pants: { w: 85, top: [M.formalTunic, M.formalTunic, M.eodoric, M.shortTunic, ...M.longShirts], legs: [M.breeches, M.breeches, M.casualPants], feet: [M.tallBoots, M.tallBoots, M.boots, M.shoes] },
      robe: { w: 15, robe: [M.kimono, M.toga, M.dwynnenSurcoat, M.anticlereSurcoat], feet: [M.tallBoots, M.shoes] },
    },
    female: {
      robe: { w: 60, robe: [W.eveningGown, W.dayGown, W.eveningGown, W.straplessDress], feet: [W.shoes, W.tallBoots] },
      skirt: { w: 25, top: [W.formalBrassiere, W.formalEodoric, W.blouse, ...W.longShirts], legs: [W.longSkirt], feet: [W.shoes, W.tallBoots] },
      pants: { w: 15, top: [W.formalEodoric, ...W.longShirts], legs: [W.tights, W.casualPants], feet: [W.tallBoots] },
    },
  },
  // a temple's: the priest's robes most of all, a plain robe else
  priest: {
    tiers: [40, 45, 13, 2], dyes: WARDROBE_DYES.temple, match: 0.7, cloak: 0.1, formal: 0.3,
    male: {
      robe: { w: 85, robe: [M.priestRobes, M.priestRobes, M.plainRobes, M.toga], feet: [M.sandals, M.shoes] },
      pants: { w: 15, top: [...M.longShirts], legs: [M.breeches], feet: [M.sandals, M.shoes] },
    },
    female: {
      robe: { w: 85, robe: [W.priestessRobes, W.priestessRobes, W.plainRobes], feet: [W.sandals, W.shoes] },
      skirt: { w: 15, top: [...W.longShirts, W.blouse], legs: [W.longSkirt], feet: [W.sandals, W.shoes] },
    },
  },
  // a mage: robes of every cut, or a long shirt under a cloak
  mage: {
    tiers: [35, 45, 16, 4], dyes: WARDROBE_DYES.arcane, match: 0.6, cloak: 0.35, formal: 0.4,
    male: {
      robe: { w: 70, robe: [M.plainRobes, M.plainRobes, M.kimono, M.toga], feet: [M.shoes, M.sandals, M.boots] },
      pants: { w: 30, top: [...M.longShirts, M.formalTunic, M.eodoric], legs: [M.breeches, M.casualPants], feet: [M.boots, M.tallBoots, M.shoes] },
    },
    female: {
      robe: { w: 70, robe: [W.plainRobes, W.plainRobes, W.dayGown], feet: [W.shoes, W.sandals, W.boots] },
      skirt: { w: 15, top: [...W.longShirts, W.formalEodoric], legs: [W.longSkirt], feet: [W.boots, W.shoes] },
      pants: { w: 15, top: [...W.longShirts, W.vest], legs: [W.casualPants, W.tights], feet: [W.boots, W.tallBoots] },
    },
  },
  // the underworld: dark clothes, boots, a cloak half the time, and a rogue's leathers now and then
  rogue: {
    tiers: [75, 22, 3, 0], dyes: WARDROBE_DYES.dark, match: 0.5, cloak: 0.5, formal: 0, armor: 'rogue',
    male: { pants: { w: 100, top: [M.vest, ...M.shortShirts, ...M.longShirts, M.openTunic], legs: [M.casualPants, M.breeches], feet: [M.boots, M.tallBoots] } },
    female: {
      pants: { w: 80, top: [W.vest, ...W.shortShirts, ...W.longShirts], legs: [W.casualPants, W.tights], feet: [W.boots, W.tallBoots] },
      skirt: { w: 20, top: [W.vest, W.brassiere, ...W.shortShirts], legs: [W.wrap, W.longSkirt], feet: [W.boots] },
    },
  },
  // a fighter: the clothes of the road under whatever armour came to hand
  fighter: {
    tiers: [80, 18, 2, 0], dyes: WARDROBE_DYES.earth, match: 0.3, cloak: 0.2, formal: 0, armor: 'fighter',
    male: { pants: { w: 100, top: [...M.shortShirts, ...M.longShirts, M.vest, M.shortTunic], legs: [M.casualPants, M.breeches], feet: [M.boots, M.tallBoots] } },
    female: { pants: { w: 100, top: [...W.shortShirts, ...W.longShirts, W.vest], legs: [W.casualPants, W.tights], feet: [W.boots, W.tallBoots] } },
  },
  // a knight of an order, a court's guard: the whole plate of one metal, by rank
  knight: {
    tiers: [20, 50, 25, 5], dyes: WARDROBE_DYES.fine, match: 0.5, cloak: 0.35, formal: 0.6, armor: 'knight',
    male: { pants: { w: 100, top: [...M.longShirts, M.formalTunic], legs: [M.breeches], feet: [M.boots] } },
    female: { pants: { w: 100, top: [...W.longShirts, W.formalEodoric], legs: [W.tights, W.casualPants], feet: [W.boots] } },
  },
});

/** The roles' names. */
export const ROLE_NAMES = Object.freeze(Object.keys(WARDROBE_ROLES));

/** A list's member by a hash. @template T @param {readonly T[]} list @param {number} h @returns {T} */
const pickOf = (list, h) => list[h % list.length];
/** A weighted draw: the index whose weight the hash lands in (a weight of 0 is never drawn; all 0, the first). */
export function weighted(weights, h) {
  let total = 0;
  for (const w of weights) total += w > 0 ? w : 0;
  if (!(total > 0)) return 0;
  let r = h % total;
  for (let i = 0; i < weights.length; i++) { const w = weights[i] > 0 ? weights[i] : 0; if (r < w) return i; r -= w; }
  return 0;
}
/** True with probability `p` off a hash. */
const chance = (p, h) => (h % 10000) < p * 10000;

/**
 * THE ARMOUR KITS - what a martial role wears over its clothes. `pieces` [slot, template, odds] (an odds of 1 always),
 * the metals by the person's tier (a knight's whole plate is one metal: `one`), and the pieces Morrowind draws in no
 * other metal - imperial chain is a cuirass and greaves alone (mwItemMap.js's judgement rows), so a chain helm is never
 * asked for.
 */
const A = ARMOR_ENUM, MAT = ARMOR_MATERIAL;
export const ARMOR_KITS = Object.freeze({
  knight: Object.freeze({
    one: true,
    pieces: Object.freeze([['ChestArmor', A.Cuirass, 1], ['LegsArmor', A.Greaves, 1], ['Feet', A.Boots, 1], ['LeftArm', A.Left_Pauldron, 1],
      ['RightArm', A.Right_Pauldron, 1], ['Gloves', A.Gauntlets, 0.85], ['Head', A.Helm, 0.3]]),
    // by tier: [material, weight]
    metals: Object.freeze([
      [[MAT.Iron, 50], [MAT.Steel, 50]],
      [[MAT.Steel, 70], [MAT.Iron, 10], [MAT.Silver, 10], [MAT.Dwarven, 10]],
      [[MAT.Steel, 40], [MAT.Silver, 25], [MAT.Elven, 15], [MAT.Dwarven, 20]],
      [[MAT.Dwarven, 30], [MAT.Ebony, 30], [MAT.Orcish, 20], [MAT.Silver, 20]],
    ]),
  }),
  fighter: Object.freeze({
    one: false,
    pieces: Object.freeze([['ChestArmor', A.Cuirass, 0.9], ['LegsArmor', A.Greaves, 0.55], ['Feet', A.Boots, 0.45], ['LeftArm', A.Left_Pauldron, 0.4],
      ['RightArm', A.Right_Pauldron, 0.4], ['Gloves', A.Gauntlets, 0.35], ['Head', A.Helm, 0.15]]),
    metals: Object.freeze([
      [[MAT.Leather, 45], [MAT.Chain, 20], [MAT.Iron, 30], [MAT.Steel, 5]],
      [[MAT.Leather, 25], [MAT.Chain, 25], [MAT.Iron, 25], [MAT.Steel, 25]],
      [[MAT.Chain, 20], [MAT.Iron, 15], [MAT.Steel, 45], [MAT.Dwarven, 20]],
      [[MAT.Steel, 50], [MAT.Dwarven, 30], [MAT.Orcish, 20]],
    ]),
  }),
  rogue: Object.freeze({
    one: true,
    pieces: Object.freeze([['ChestArmor', A.Cuirass, 0.35], ['Gloves', A.Gauntlets, 0.3], ['Feet', A.Boots, 0.25]]),
    metals: Object.freeze([[[MAT.Leather, 1]], [[MAT.Leather, 1]], [[MAT.Leather, 1]], [[MAT.Leather, 1]]]),
  }),
});
/** The pieces imperial chain is drawn in (mwItemMap.js: retail carries chain as a cuirass and greaves alone). */
const CHAIN_PIECES = new Set([A.Cuirass, A.Greaves]);

/** A metal off a tier's weighted list. @param {any[]} list @param {number} h */
const metalOf = (list, h) => list[weighted(list.map((m) => m[1]), h)][0];

/** The armour a kit dresses a person in, by tier, off the seed. @param {string} kit @param {number} tier @param {number} seed */
export function armorKit(kit, tier, seed) {
  const K = ARMOR_KITS[kit];
  if (!K) return [];
  const metals = K.metals[Math.max(0, Math.min(3, tier | 0))];
  const one = K.one ? metalOf(metals, wmix(seed ^ 0x3e7a1)) : null;
  const out = [];
  K.pieces.forEach(([slot, templateIndex, odds], k) => {
    if (odds < 1 && !chance(odds, wmix(seed ^ (0xa110 + k)))) return;
    let material = one ?? metalOf(metals, wmix(seed ^ (0xa2e0 + k)));
    if (material === MAT.Chain && !CHAIN_PIECES.has(templateIndex)) material = MAT.Iron;   // no chain helm in Morrowind: iron, its own neighbour
    out.push({ templateIndex, group: 'Armor', equipSlot: EQUIP_SLOTS[slot], material });
  });
  // the pauldrons are a pair: one alone is the other's twin
  const l = out.find((it) => it.templateIndex === A.Left_Pauldron), r = out.find((it) => it.templateIndex === A.Right_Pauldron);
  if (l && !r) out.push({ templateIndex: A.Right_Pauldron, group: 'Armor', equipSlot: EQUIP_SLOTS.RightArm, material: l.material });
  else if (r && !l) out.push({ templateIndex: A.Left_Pauldron, group: 'Armor', equipSlot: EQUIP_SLOTS.LeftArm, material: r.material });
  return out;
}

const rung = (t) => Math.max(0, Math.min(3, t | 0));
/** The `npc` hint a dressed look carries - its seed, its tier and the rungs its role dresses in (`lo`..`hi`, the
 *  role's tiers that are ever drawn - AUDIT MWNPC16-18 C F1), for the build (peerBuildOpts). */
export const npcHint = (seed, tier, lo = 0, hi = 3) => {
  const t = rung(tier), l = Math.min(rung(lo), t), h = Math.max(rung(hi), t);
  return Object.freeze({ seed: seed >>> 0, tier: t, lo: l, hi: h });
};
/** A look's hint, read as relay-shaped data is: a seed, a tier and its range in range (lo <= tier <= hi), else null.
 *  @param {any} look */
export function npcHintOf(look) {
  const n = look?.npc;
  if (!n || typeof n !== 'object' || !Number.isInteger(n.seed) || n.seed < 0 || n.seed > 0xffffffff) return null;
  const ok = (t) => Number.isInteger(t) && t >= 0 && t <= 3;
  if (!ok(n.tier) || !ok(n.lo) || !ok(n.hi) || n.lo > n.tier || n.tier > n.hi) return null;
  return n;
}
/** The key a hint adds to a body's (net/peer/peerBodies.js peerBodyKey): two people in the same garments are two bodies. */
export const npcKeyOf = (look) => { const n = npcHintOf(look); return n ? `|npc${n.seed}.${n.tier}.${n.lo}${n.hi}` : ''; };

/**
 * THE PICKS a hint asks of one worn garment (mwItemMap.js mwClothingRecord `pick` and `tier`): the person's tier, one
 * rung down for a garment in four and up for one in eight (a merchant's good coat over common breeches) - never past
 * the rungs the role dresses in (`lo`..`hi`: a noble's garment never on the common rung, a farmhand's never in silk -
 * AUDIT MWNPC16-18 C F1, a noble's top fell to common one time in eleven) - and the record among its candidates, each
 * off the seed and the garment. @param {any} n @param {any} piece
 */
export function npcGarmentPick(n, piece) {
  const h = wmix((n.seed ^ wmix(((piece.templateIndex | 0) * 0x9e37) + 0x51ed)) >>> 0);
  const step = h & 7;
  const tier = Math.max(n.lo ?? 0, Math.min(n.hi ?? 3, n.tier + (step < 2 ? -1 : step === 2 ? 1 : 0)));
  return { pick: h >>> 8, tier };
}
/** The races Morrowind builds on the beast skeleton (fpArm.js tpSkeletonPath `beast`). What a beast of them wears of
 *  its worn list is the item map's call for every look, an NPC's and a player's alike, by the viewer's Beast Footwear
 *  and Beast Helmets switches (mwItemMap.js beastCut, BEAST-BOOTS). */
export const WARDROBE_BEAST_RACES = Object.freeze(['Khajiit', 'Argonian']);
/** The worn list (mwItemMap.js dfWornEquipment's) with each garment's picks - the armour as it was. @param {any[]} worn @param {any} n */
export function withNpcPicks(worn, n) {
  return worn.map((p) => (p.kind === 'clothing' ? { ...p, ...npcGarmentPick(n, p) } : p));
}
/** The head and the hair a hint walks (formats/morrowind/mwFirstPerson.js playerBodyRows `walk`), each on its own. @param {any} n */
export const npcFaceOf = (n) => ({ head: wmix(n.seed ^ 0x4ead5eed), hair: wmix(n.seed ^ 0x4a12b0b5) });

/**
 * DRESS A PERSON: `role` one of WARDROBE_ROLES (an unknown one the commoner's), `gender` 'male' or 'female', `seed` theirs
 * (32-bit), `cut` a silhouette their picture already shows (a walker's sprite - 'robe' a robe, 'pants' or 'skirt'
 * their legs), honoured where the role has it. Answers `{ items, npc, role, cut, tier }` - the items a look wears
 * (Daggerfall's garments and armour, in their equip slots), the hint the build reads.
 * @param {{ role?: string, gender?: string, seed: number, cut?: string|null }} o
 */
export function dressPerson({ role = 'commoner', gender = 'male', seed, cut = null }) {
  const name = Object.prototype.hasOwnProperty.call(WARDROBE_ROLES, role) ? role : 'commoner';
  const R = WARDROBE_ROLES[name];
  const female = gender === 'female';
  const C = female ? R.female : R.male;
  const group = female ? 'WomensClothing' : 'MensClothing';
  const s = seed >>> 0;
  const tier = weighted(R.tiers, wmix(s ^ 0x7e1e));
  const lo = R.tiers.findIndex((w) => w > 0), hi = R.tiers.length - 1 - [...R.tiers].reverse().findIndex((w) => w > 0);
  // the cut: the one asked for where the role has it, else the nearest it has (a robe's picture never stands in
  // breeches); none asked for, the role's own weighted draw
  const cuts = SILHOUETTES.filter((x) => C[x]);
  const prefer = cut === 'robe' ? ['robe', 'skirt', 'pants'] : cut === 'skirt' ? ['skirt', 'pants', 'robe'] : cut === 'pants' ? ['pants', 'skirt', 'robe'] : null;
  const k = prefer ? prefer.find((x) => C[x]) ?? cuts[0] : cuts[weighted(cuts.map((x) => C[x].w), wmix(s ^ 0xc07))];
  const S = C[k];
  const dye = (salt) => pickOf(R.dyes, wmix(s ^ salt));
  const topDye = dye(0xd1);
  const lowDye = chance(R.match, wmix(s ^ 0x3a7c)) ? topDye : dye(0xd2);
  /** @type {any[]} */
  const items = [];
  if (S.robe) items.push({ templateIndex: pickOf(S.robe, wmix(s ^ 0xc1)), group, equipSlot: EQUIP_SLOTS.ChestClothes, dye: topDye });
  else {
    items.push({ templateIndex: pickOf(/** @type {number[]} */ (S.top), wmix(s ^ 0xc1)), group, equipSlot: EQUIP_SLOTS.ChestClothes, dye: topDye });
    items.push({ templateIndex: pickOf(/** @type {number[]} */ (S.legs), wmix(s ^ 0xc2)), group, equipSlot: EQUIP_SLOTS.LegsClothes, dye: lowDye });
  }
  const armor = R.armor ? armorKit(R.armor, tier, wmix(s ^ 0xa4)) : [];
  // the feet: the armour's boots where the kit gave them (one slot - Daggerfall's Feet), else the cut's shoes
  if (!armor.some((it) => it.equipSlot === EQUIP_SLOTS.Feet)) items.push({ templateIndex: pickOf(S.feet, wmix(s ^ 0xc3)), group, equipSlot: EQUIP_SLOTS.Feet, dye: dye(0xd3) });
  if (chance(R.cloak, wmix(s ^ 0xc10a))) {
    const formal = chance(R.formal, wmix(s ^ 0xf0a1));
    const cloak = female ? (formal ? W.formalCloak : W.casualCloak) : (formal ? M.formalCloak : M.casualCloak);
    items.push({ templateIndex: cloak, group, equipSlot: EQUIP_SLOTS.Cloak1, dye: chance(0.4, wmix(s ^ 0xc1d)) ? topDye : dye(0xd4) });
  }
  items.push(...armor);
  return { items, npc: npcHint(s, tier, lo, hi), role: name, cut: k, tier };
}

/**
 * Could `role` have dressed this look - every garment one its cuts hold for the look's gender (a cloak its cloaks),
 * every dye its palette's, every armour piece its kit's? The test of a look's ROLE, for a reader who cannot know the
 * seed's roll (the pins, the census). @param {any} look @param {string} role
 */
export function wornByRole(look, role) {
  const R = WARDROBE_ROLES[role];
  if (!R || !look) return false;
  const female = look.gender === 'female';
  const C = female ? R.female : R.male;
  const G = female ? W : M;
  const ok = new Set([G.casualCloak, G.formalCloak]);
  for (const k of SILHOUETTES) { const S = C[k]; if (S) for (const t of [...(S.top ?? []), ...(S.legs ?? []), ...(S.robe ?? []), ...S.feet]) ok.add(t); }
  const kit = R.armor ? ARMOR_KITS[R.armor] : null;
  for (const it of look.items ?? []) {
    if (it.group === 'Armor') { if (!kit || !kit.pieces.some((p) => p[1] === it.templateIndex)) return false; continue; }
    if (it.group === 'Weapons') continue;
    if (!ok.has(it.templateIndex) || !R.dyes.includes(it.dye)) return false;
  }
  return true;
}
