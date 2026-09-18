// SURV1 (2026-09-18, Mac: "we have been given permission to completely
// overhaul this mod ... tackle everything here properly") - THE FELT
// TEMPERATURE. An ORIGINAL SYSTEM, designed from Ralzar's Climates &
// Calories 1.7.1 (the shipped DLL read off its IL - there is no source
// in the bundle; the reading is in Systems-Arc SURV) and rebuilt to the
// port's shape: pure functions over an environment record, the worn
// items and a small context, no static state, one number out.
//
// The shape is C&C's, because it is a good one: the world has a NATURAL
// temperature (climate + month + hour + weather), the character has an
// OWN temperature (race + clothes + armour - wetness), each resisted by
// the character's frost or fire resistance, and the sum is what the
// body feels. Zero is comfortable; the scale is degrees of DISCOMFORT
// rather than Celsius - +20 is a warm day in a tunic, -40 is a mountain
// night in the rain. The numbers were retuned where the IL showed a
// cliff (a naked Argonian doubling its heat loss above 30, a dungeon
// always below -20 in a desert); the tables' spirit is kept.
import { EQUIP_SLOTS } from '../../characters/paperdoll.js';
import { CLIMATES } from '../../formats/mapsFile.js';
import { RACES } from '../races.js';

/** spellcast.js's EFFECT_FLAGS.Fire and .Frost (DFCareer.EffectFlags),
 *  restated so this leaf imports no combat module: spellcast sits on the
 *  formulas -> equip cycle, and equip mints the starting kit from here. */
export const FLAG_FIRE = 8;
export const FLAG_FROST = 16;

/** The climate's own temperature. Desert2 is the Dak'fron interior, the
 *  hottest; Mountain the coldest; Ocean is a beach (the classic maps put
 *  a few pixels of it under a player's feet at the coast). */
export const CLIMATE_TEMP = Object.freeze({
  [CLIMATES.Ocean]: 20, [CLIMATES.Desert]: 40, [CLIMATES.Desert2]: 50, [CLIMATES.Mountain]: -40,
  [CLIMATES.Rainforest]: 20, [CLIMATES.Swamp]: 10, [CLIMATES.Subtropical]: 30,
  [CLIMATES.MountainWoods]: -30, [CLIMATES.Woodlands]: -10, [CLIMATES.HauntedWoodlands]: -20,
});
/** The month's swing, Morning Star first (the year turns in deep winter). */
export const MONTH_TEMP = Object.freeze([-20, -15, -5, 0, 5, 10, 20, 15, 0, -5, -10, -15]);
/** The night multiplier: deserts and mountains swing hardest. */
export const NIGHT_MULT = Object.freeze({ [CLIMATES.Desert]: 3, [CLIMATES.Desert2]: 4, [CLIMATES.Mountain]: 2 });
/** Weather: the degrees it takes off, and how wet a minute in it makes
 *  you with nothing on, a cloak, or a cloak with its hood up. The
 *  sandstorm is the port's own word (WEATHER2d): hot and dry. */
export const WEATHER_TEMP = Object.freeze({
  sunny: 0, cloudy: 0, overcast: -8, fog: -5, rain: -10, thunder: -15, snow: -10, sandstorm: 5,
});
export const WEATHER_WET = Object.freeze({
  rain: [1, 0, 0], thunder: [5, 2, 1], snow: [3, 1, 0], fog: [1, 0, 0],
});
/** The race's own warmth: Nords and Bretons carry some, Argonians none. */
export const RACE_TEMP = Object.freeze({
  [RACES.Breton]: 5, [RACES.Redguard]: -5, [RACES.Nord]: 5, [RACES.DarkElf]: -5,
  [RACES.HighElf]: 0, [RACES.WoodElf]: 0, [RACES.Khajiit]: -5, [RACES.Argonian]: -10,
});
/** The naked offset: nothing on at a comfortable natural temperature is
 *  still a little cold. */
export const NAKED_OFFSET = -5;
/** A drink in the pack takes the edge off the heat (the felt line only). */
export const WATER_COOLS = 10;
/** A hood in strong sun shades the head. */
export const HOOD_SHADE = 10;
/** Wetness caps here; a soaking counts against clothing warmth one for one
 *  and chills the body at a twentieth. */
export const WET_MAX = 300;
export const WET_SUBMERGED = 300;
export const WET_WADING = 50;

/** Clothing warmth by template. Chest clothes (slot 17), legs (24), feet
 *  (26). What is not listed warms nothing. */
export const CHEST_WARMTH = Object.freeze({
  141: 1, 142: 1, 143: 10, 144: 1, 145: 1, 146: 1,                 // straps, armbands, kimono, fancy armbands, sash, eodoric
  157: 12, 158: 8, 159: 12, 160: 8, 161: 12, 163: 12, 164: 12,    // surcoat, tunics, toga, robes
  165: 5, 166: 5, 167: 8, 168: 8, 169: 8, 170: 8, 171: 10, 172: 10, 173: 10,   // shirts
  176: 12, 177: 1, 178: 8, 179: 8, 180: 1, 181: 1,                // anticlere surcoat, straps, plain shirts, vest
  182: 1, 183: 1, 184: 8, 185: 1, 194: 1, 195: 10, 196: 12, 197: 10, 198: 8,   // brassieres, blouse, eodorics, gowns, dresses
  200: 12, 201: 12, 202: 5, 203: 5, 204: 8, 205: 8, 206: 8, 207: 8, 208: 10, 209: 12, 210: 10,   // robes, shirts, tunic
  214: 8, 215: 8, 216: 1,
});
export const LEGS_WARMTH = Object.freeze({
  151: 10, 152: 10, 153: 4, 156: 2, 162: 1, 174: 4, 175: 8,
  190: 10, 193: 2, 199: 1, 211: 4, 212: 8, 213: 4,
});
export const FEET_WARMTH = Object.freeze({ 147: 2, 148: 4, 149: 4, 150: 0, 186: 2, 187: 4, 188: 4, 189: 0 });
/** Cloaks: the casual cloak's warmth by variant, and the formal cloak is
 *  three times it. Variants 1, 2 and 5 are drawn with the hood UP. */
export const CLOAK_WARMTH = Object.freeze([4, 5, 3, 2, 1, 2]);
export const CASUAL_CLOAKS = Object.freeze(new Set([154, 191]));
export const FORMAL_CLOAKS = Object.freeze(new Set([155, 192]));
export const HOODED_CLOAK_VARIANTS = Object.freeze(new Set([1, 2, 5]));
export const HOODED_ROBES = Object.freeze(new Set([163, 200]));   // variant 1 is the hood up
/** What covers the chest so the sun cannot heat the armour under it. */
export const COVERING_CHEST = Object.freeze(new Set([163, 164, 176, 177, 200, 201]));

/** Armour: [leather, chain, plate] warmth and [chain, plate] metal, by
 *  slot. Metal heats in the sun and chills in the cold. */
export const ARMOR_WARMTH = Object.freeze({
  [EQUIP_SLOTS.ChestArmor]: Object.freeze({ warm: [3, 1, 3], metal: [1, 4] }),
  [EQUIP_SLOTS.LegsArmor]: Object.freeze({ warm: [2, 1, 2], metal: [1, 3] }),
  [EQUIP_SLOTS.Head]: Object.freeze({ warm: [1, 2, 1], metal: [1, 1] }),
  [EQUIP_SLOTS.RightArm]: Object.freeze({ warm: [1, 2, 1], metal: [0, 1] }),
  [EQUIP_SLOTS.LeftArm]: Object.freeze({ warm: [1, 2, 1], metal: [0, 1] }),
  [EQUIP_SLOTS.Gloves]: Object.freeze({ warm: [1, 0, 0], metal: [0, 0] }),
  [EQUIP_SLOTS.Feet]: Object.freeze({ warm: [2, 1, 2], metal: [1, 2] }),
});
/** DFU's armour material enum: 0x0000 leather, 0x0100 chain, 0x02xx plate. */
export const armorMaterialClass = (material) => {
  const m = (material ?? 0) & 0x0f00;
  return m === 0 ? 0 : m === 0x0100 ? 1 : 2;
};

/** The natural temperature: what the world is, before anyone stands in
 *  it. Indoors the weather does not reach you and the hour matters less;
 *  underground there is no hour at all. */
export function naturalTemperature({ climateIndex, month, hour, weather, insideBuilding = false, insideDungeon = false } = {}) {
  const climate = CLIMATE_TEMP[climateIndex] ?? 0;
  const season = MONTH_TEMP[((month ?? 0) % 12 + 12) % 12] ?? 0;
  if (insideBuilding) return Math.trunc((climate + season) / 2);
  const day = insideDungeon ? 0 : hourTemperature(hour, climateIndex);
  const sky = insideDungeon ? 0 : (WEATHER_TEMP[weather] ?? 0);
  return climate + season + day + sky;
}

/** The hour's swing: evening and dawn cool, the small hours coldest, the
 *  day itself the climate's own. */
export function hourTemperature(hour, climateIndex) {
  const h = ((hour ?? 12) % 24 + 24) % 24;
  const m = NIGHT_MULT[climateIndex] ?? 1;
  if (h >= 8 && h <= 15) return 0;
  if (h >= 16 && h <= 19) return -10 * m;
  if (h >= 4 && h <= 7) return -10 * m;
  return -20 * m;   // 20:00 - 03:59
}

/** How wet a minute in this weather makes you, outdoors. */
export function weatherWetGain(weather, { cloak = false, hood = false, insideBuilding = false, insideDungeon = false } = {}) {
  if (insideBuilding || insideDungeon) return 0;
  const row = WEATHER_WET[weather];
  if (!row) return 0;
  return cloak ? (hood ? row[2] : row[1]) : row[0];
}

/** The environment's wetness: under water you are soaked at once,
 *  wading soaks the legs. */
export const environmentWet = ({ submerged = false, wading = false } = {}) =>
  (submerged ? WET_SUBMERGED : 0) + (wading ? WET_WADING : 0);

/** Resistance in degrees: the frost or fire resistance the character
 *  carries, from the race template's flags (resist 25, immune 50, low
 *  tolerance -25, critical weakness -50), the spell resistances the
 *  effect manager holds (their chance, as degrees), and the curses (a
 *  vampire feels no frost; a were-beast in its form feels almost
 *  nothing). A cold temperature is raised toward zero by frost
 *  resistance, a hot one lowered toward zero by fire resistance, and
 *  neither crosses it. */
export function resistTemperature(temp, ctx = {}) {
  if (temp === 0) return 0;
  const cold = temp < 0;
  const bit = cold ? FLAG_FROST : FLAG_FIRE;
  const rt = ctx.raceTemplate ?? {};
  let r = cold ? (ctx.frostResist ?? 0) : (ctx.fireResist ?? 0);
  if (((rt.resistanceFlags ?? 0) & bit) === bit) r += 25;
  if (((rt.immunityFlags ?? 0) & bit) === bit) r += 50;
  if (((rt.lowToleranceFlags ?? 0) & bit) === bit) r -= 25;
  if (((rt.criticalWeaknessFlags ?? 0) & bit) === bit) r -= 50;
  if (ctx.beastForm) r += cold ? 100 : 80;
  else if (ctx.lycanthrope) r += 10;
  if (cold && ctx.vampire) r += 25;
  return cold ? Math.min(temp + r, 0) : Math.max(temp - r, 0);
}

/** The worn items, as { slot: item } over EQUIP_SLOTS. `worn` may be an
 *  array indexed by slot (the equip table) or a plain object. */
const at = (worn, slot) => (worn ? worn[slot] ?? null : null);

/** The cloak on either cloak slot, and whether a hood is up. */
export function cloakState(worn) {
  const cloaks = [at(worn, EQUIP_SLOTS.Cloak1), at(worn, EQUIP_SLOTS.Cloak2)].filter(Boolean);
  const cloak = cloaks.length > 0;
  let hood = cloaks.some((c) => HOODED_CLOAK_VARIANTS.has(c.variant ?? 0));
  const chest = at(worn, EQUIP_SLOTS.ChestClothes);
  if (!hood && chest && HOODED_ROBES.has(chest.templateIndex) && (chest.variant ?? 0) === 1) hood = true;
  return { cloak, hood, cloaks };
}

/** Clothing warmth: chest, legs, feet and the cloaks, less the wetness,
 *  never below nothing; a hood in strong sun cools the head. */
export function clothingWarmth(worn, { wet = 0, natural = 0, inSunlight = false } = {}) {
  const chest = at(worn, EQUIP_SLOTS.ChestClothes), legs = at(worn, EQUIP_SLOTS.LegsClothes), feet = at(worn, EQUIP_SLOTS.Feet);
  let warmth = (chest ? CHEST_WARMTH[chest.templateIndex] ?? 0 : 0)
    + (legs ? LEGS_WARMTH[legs.templateIndex] ?? 0 : 0)
    + (feet && feet.group !== 'Armor' ? FEET_WARMTH[feet.templateIndex] ?? 0 : 0);
  const { cloaks, hood } = cloakState(worn);
  for (const c of cloaks) {
    const v = CLOAK_WARMTH[c.variant ?? 0] ?? CLOAK_WARMTH[0];
    warmth += FORMAL_CLOAKS.has(c.templateIndex) ? 3 * v : CASUAL_CLOAKS.has(c.templateIndex) ? v : 0;
  }
  const pure = warmth;
  warmth = Math.max(0, warmth - Math.min(wet, WET_MAX));
  if (natural > 30 && inSunlight && hood) warmth -= HOOD_SHADE;
  return { warmth, pure, hood };
}

/** Armour: the pieces' own warmth, and the metal's heat or chill - the
 *  natural temperature scaled by the metal, a twentieth per point, felt
 *  only when the sun reaches it (heat) or always (cold, halved). Wetness
 *  eats armour warmth too. */
export function armorWarmth(worn, { natural = 0, wet = 0, inSunlight = false } = {}) {
  let warm = 0, metal = 0;
  for (const [slot, row] of Object.entries(ARMOR_WARMTH)) {
    const item = at(worn, Number(slot));
    if (!item || item.group !== 'Armor') continue;
    const cls = armorMaterialClass(item.material);
    warm += row.warm[cls] ?? 0;
    if (cls > 0) metal += row.metal[cls - 1] ?? 0;
  }
  const chest = at(worn, EQUIP_SLOTS.ChestClothes);
  const covered = cloakState(worn).cloak || (chest ? COVERING_CHEST.has(chest.templateIndex) : false);
  const metalTemp = Math.trunc((metal * natural) / 20);
  let heat = 0;
  if (metalTemp > 0 && inSunlight && !covered) heat = metalTemp;
  else if (metalTemp < 0) heat = Math.trunc((metalTemp - 1) / 2);   // toward the colder side
  const warmth = warm > 0 ? Math.max(0, warm - Math.min(wet, WET_MAX)) : 0;
  return { warmth: warmth + heat, pieces: warm, metal: metalTemp, heat, covered };
}

/** The underground correction: a dungeon is cool whatever the sky, and
 *  a deep one is cold. */
export function dungeonTemperature(natTemp) {
  return natTemp > -20 ? Math.max(Math.trunc(natTemp / 2) - 30, -20) : Math.min(Math.trunc(natTemp / 2) + 30, -20);
}

/**
 * The felt temperature - the one number the needs read.
 *
 * @param {object} env   { climateIndex, month, hour, weather, insideBuilding, insideDungeon, inSunlight, submerged, wading, byFire }
 * @param {object} worn  the equip table (slot -> item)
 * @param {object} ctx   { raceId, raceTemplate, frostResist, fireResist, vampire, lycanthrope, beastForm, hasWater, wet }
 */
export function feltTemperature(env = {}, worn = null, ctx = {}) {
  const natural = naturalTemperature(env);
  const wet = Math.min(Math.max(0, ctx.wet ?? 0), WET_MAX);
  let natTemp = resistTemperature(natural, ctx);
  if (env.insideDungeon) natTemp = dungeonTemperature(natTemp);
  const clothes = clothingWarmth(worn, { wet, natural, inSunlight: !!env.inSunlight });
  const armour = armorWarmth(worn, { natural, wet, inSunlight: !!env.inSunlight });
  const race = RACE_TEMP[ctx.raceId] ?? 0;
  const water = Math.trunc(wet / 20);
  const fire = env.byFire ? 15 : 0;
  const own = resistTemperature(race + clothes.warmth + armour.warmth + fire - water, ctx) + NAKED_OFFSET;
  let felt = natTemp + own;
  if (felt > 9 && ctx.hasWater && !ctx.vampire) felt = Math.max(felt - WATER_COOLS, 0);
  return {
    natural, natTemp, own, felt, abs: Math.abs(felt),
    clothes: clothes.warmth, clothesDry: clothes.pure, armour: armour.warmth, metal: armour.heat, race, water, fire,
    cloak: cloakState(worn).cloak, hood: clothes.hood, wet,
    wetGain: weatherWetGain(env.weather, { cloak: cloakState(worn).cloak, hood: clothes.hood, insideBuilding: env.insideBuilding, insideDungeon: env.insideDungeon })
      + environmentWet(env),
  };
}

/** The words the status page and the HUD use for a felt temperature. */
export function temperatureWord(felt) {
  if (felt > 50) return 'scorching';
  if (felt > 30) return 'hot';
  if (felt > 10) return 'warm';
  if (felt >= -10) return 'comfortable';
  if (felt >= -30) return 'cold';
  if (felt >= -50) return 'freezing';
  return 'deadly cold';
}
