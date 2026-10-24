// SURV1 (2026-09-18, Mac: "we have been given permission to completely
// overhaul this mod ... tackle everything here properly") - THE FELT
// TEMPERATURE. An ORIGINAL SYSTEM, designed from Ralzar's Climates &
// Calories 1.7.1 (the shipped DLL read off its IL - there is no source
// in the bundle; the reading is in Systems-Arc SURV) and rebuilt to the
// port's shape: pure functions over an environment record, the worn
// items and a small context, no static state, one number out. (AUDIT
// C&C, 2026-10-12: the mod's source is public - github.com/Ralzar81/
// Climates-Calories, every revision to 1.7.0 - and the law was read
// against it; Climates-Calories.md says where the port departs.)
//
// The shape is C&C's, because it is a good one: the world has a NATURAL
// temperature (climate + month + hour + weather), resisted by the
// character's frost or fire resistance, the character has an OWN
// temperature (race + clothes + armour - wetness), never resisted (AUDIT
// TEMP-UI E1), and the sum is what the body feels. Zero is comfortable;
// the scale is degrees of DISCOMFORT rather than Celsius - +20 is a warm
// day in a tunic, -40 is a mountain night in the rain. The numbers were
// retuned where the IL showed a cliff (a naked Argonian doubling its heat
// loss above 30, a dungeon always below -20 in a desert); the tables'
// spirit is kept.
import { EQUIP_SLOTS } from '../../characters/paperdoll/paperdoll.js';
import { CLIMATES } from '../../formats/mapsFile.js';
import { RACES } from '../races.js';
import { monthNames, DAWN_HOUR, DUSK_HOUR } from '../gameDate.js';   // TEMP-UI: the breakdown names the month (an import-free leaf; L10N3e: in the player's language); AUDIT C&C: the sun's hours
import { precipitationForWeather } from '../../world/weather.js';   // WET-FALL: which words fall (an import-free leaf but for UMRandom)

/** spellcast.js's EFFECT_FLAGS.Fire and .Frost (DFCareer.EffectFlags),
 *  restated so this leaf imports no combat module: spellcast sits on the
 *  formulas -> equip cycle, and equip mints the starting kit from here. */
export const FLAG_FIRE = 8;
export const FLAG_FROST = 16;

/** The climate's own temperature. Desert2 is the Dak'fron interior, the
 *  hottest; Mountain the coldest. AUDIT C&C (2026-10-12, E4): OCEAN IS THE
 *  SEA, AT NOUGHT. SURV1's +20 was a beach (a classic player met a few
 *  pixels of it at the coast); the port sails the whole Bay over it (the
 *  one water law, ui/overworldModel.js isWaterPixel: every Ocean pixel is
 *  sea), and +20 made a winter crossing comfortable and a summer one hot.
 *  The sea is the season, the hour and the weather alone - the mod's own
 *  answer too: its published Climate() has no Ocean case and answers its
 *  default 0 in every revision to 1.7.0, so the +20 came with SURV1's
 *  reading of the 1.7.1 DLL (Port-Ledger A, the AUDIT C&C row: a reading
 *  corrected). */
export const CLIMATE_TEMP = Object.freeze({
  [CLIMATES.Ocean]: 0, [CLIMATES.Desert]: 40, [CLIMATES.Desert2]: 50, [CLIMATES.Mountain]: -40,
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
/** AUDIT C&C T2 (2026-10-12): rain and snow are the mod's own (Climates.cs Weather(), every published revision) - rain
 *  soaks three a minute bare, one under a cloak and none under its hood; snow one bare and none under any cloak. SURV1's
 *  reading of the IL had the two rows swapped: a cloak kept every drop of rain off, hood down, and snow soaked a bare
 *  body three times as fast as rain. Fog's is the port's own (the mod's Weather() has no fog). */
export const WEATHER_WET = Object.freeze({
  rain: [3, 1, 0], thunder: [5, 2, 1], snow: [1, 0, 0], fog: [1, 0, 0],
});
/** The race's own warmth: Nords and Bretons carry some, Argonians none. */
export const RACE_TEMP = Object.freeze({
  [RACES.Breton]: 5, [RACES.Redguard]: -5, [RACES.Nord]: 5, [RACES.DarkElf]: -5,
  [RACES.HighElf]: 0, [RACES.WoodElf]: 0, [RACES.Khajiit]: -5, [RACES.Argonian]: -10,
});
/** The body's heat loss (the mod's `offSet`): every body sheds it, dressed
 *  or not, so a comfortable natural temperature reads a little cold
 *  before the clothes (AUDIT C&C T8: the breakdown's "Heat loss" - it said
 *  "Bare skin" on a body dressed head to foot). */
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
/** Shoes 2, tall boots and boots 4, sandals nothing. AUDIT C&C T9 - THE BOOTS, a declared departure (Port-Ledger A):
 *  the mod's Boots arm (Climates.cs Clothes) warms 4 at the first of their three variants alone and nothing at the
 *  others (its leather 6 is overwritten by that test); the port's boots warm at every variant - a boot is a boot
 *  whatever it looks like. */
export const FEET_WARMTH = Object.freeze({ 147: 2, 148: 4, 149: 4, 150: 0, 186: 2, 187: 4, 188: 4, 189: 0 });
/** Cloaks: the casual cloak's warmth by variant, and the formal cloak is
 *  three times it. Variants 1, 2 and 5 are drawn with the hood UP. */
export const CLOAK_WARMTH = Object.freeze([4, 5, 3, 2, 1, 2]);
export const CASUAL_CLOAKS = Object.freeze(new Set([154, 191]));
export const FORMAL_CLOAKS = Object.freeze(new Set([155, 192]));
export const HOODED_CLOAK_VARIANTS = Object.freeze(new Set([1, 2, 5]));
export const HOODED_ROBES = Object.freeze(new Set([163, 200]));   // variant 1 is the hood up
/** What covers the chest so the sun cannot heat the armour under it: what the doll draws OVER the cuirass - the plain
 *  robes, the priest's and the priestess's robes (drawOrder 80 to the cuirass's 50; a cloak's 90 covers too -
 *  armorWarmth). AUDIT C&C T1 (2026-10-12): SURV1's reading of the IL had the Anticlere Surcoat and the Challenger
 *  Straps beside the robes, so a strap shaded a cuirass. The mod's own list (Climates.cs ArmorCovered, the published
 *  source) is the robes and the three long gowns - the evening gown, the day gown and the casual dress; the gowns are
 *  drawn under the cuirass like every other chest garment (drawOrder 40), so the metal the player sees in the sun is
 *  the metal the sun heats. A declared departure (Port-Ledger A). */
export const COVERING_CHEST = Object.freeze(new Set([163, 164, 200, 201]));

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
 *  it. Indoors the street's own reaches you softened to the roof's size;
 *  underground there is no hour or sky at all.
 *  FIELD BUGS 2026-09-30 (ROOF-SHELTER; #bug-reports, "Climates & Calories
 *  Bugs": "Whether you are appropriately clothed for your region, indoors,
 *  etc. your temperature gets to either "Scorching" or "Freezing" ... and
 *  seems to never recover"): A ROOF SHELTERS, IT DOES NOT HEAT. Indoors
 *  read half the climate and the season and never the hour, so a desert
 *  inn at eleven at night read 30 while the street outside it read 0 -
 *  in from the sand, the starting kit felt Hot all night, and the chip
 *  never lifted. Inside a building the natural temperature was the MILDER
 *  (the smaller in size) of the street's own now - climate, season, hour
 *  and weather, as outdoors - and the roofed half. AUDIT C&C T4: that
 *  picked across nought (a Dak'fron inn read the roof's +30 in the rain
 *  and -28 when overcast), so it is the street's own reading softened to
 *  the roofed half's size now - never across nought, never harsher than
 *  the street, and a mountain inn keeps its roof. A declared departure
 *  (Port-Ledger A): SURV1 read the mod's indoor temperature as the roofed
 *  half alone, and the mod's published source (AUDIT C&C T9) reads the
 *  climate, the season and the hour indoors, no weather and no halving -
 *  and its minute law charges no temperature indoors at all. */
export function naturalTemperature({ climateIndex, month, hour, weather, insideBuilding = false, insideDungeon = false } = {}) {
  const climate = CLIMATE_TEMP[climateIndex] ?? 0;
  const season = MONTH_TEMP[((month ?? 0) % 12 + 12) % 12] ?? 0;
  if (insideBuilding) {
    const roofed = Math.trunc((climate + season) / 2);
    const street = climate + season + hourTemperature(hour, climateIndex) + (WEATHER_TEMP[weather] ?? 0);
    return Math.max(-Math.abs(roofed), Math.min(Math.abs(roofed), street)) || 0;   // AUDIT C&C T4: the street's own reading, softened to the roof's size - never across nought (and nought, never -0)
  }
  const day = insideDungeon ? 0 : hourTemperature(hour, climateIndex);
  const sky = insideDungeon ? 0 : (WEATHER_TEMP[weather] ?? 0);
  return climate + season + day + sky;
}

/** The hour's swing: evening and dawn cool, the small hours coldest, the
 *  day itself the climate's own. AUDIT SURV-TIERS: the bands are whole
 *  hours and the hosts hand the clock's fractional hour ((minutes % 1440)
 *  / 60), so every minute past 07, 15 and 19 o'clock but the hour itself
 *  fell through the bands to the small hours' -20 - a mountain afternoon
 *  read Deadly cold from 15:01 to 15:59. The hour a minute is IN is its
 *  floor. */
export function hourTemperature(hour, climateIndex) {
  const h = ((Math.floor(hour ?? 12)) % 24 + 24) % 24;
  const m = NIGHT_MULT[climateIndex] ?? 1;
  if (h >= 8 && h <= 15) return 0;
  if (h >= 16 && h <= 19) return -10 * m;
  if (h >= 4 && h <= 7) return -10 * m;
  return -20 * m;   // 20:00 - 03:59
}

/** AUDIT C&C (2026-10-12): THE SUN'S ONE LAW - outdoors, between DFU's dawn and dusk (DaggerfallDateTime.IsDay: 6:00 to
 *  17:59), under a sky the sun comes through (sunny or cloudy), and not under a pitched tent's canvas. The exterior
 *  hosts' readers ask it for their minute, and a jump's replay for each of its own (needs.js runSurvivalMinutes): a
 *  replayed minute had its own hour and month but the frame's sun, so a jump set out at noon met the sun at 01:00. */
export function sunlit({ hour = 12, weather = 'sunny', insideBuilding = false, insideDungeon = false, sheltered = false } = {}) {
  const h = ((Math.floor(hour ?? 12)) % 24 + 24) % 24;
  return !insideBuilding && !insideDungeon && !sheltered && h >= DAWN_HOUR && h < DUSK_HOUR && (weather === 'sunny' || weather === 'cloudy');
}

/** TEMP-UI (2026-10-12): the hour's band by NAME - the bands hourTemperature reads, said for the breakdown ('day' its
 *  zero, 'evening' and 'dawn' its -10 x the night multiplier, 'night' its -20 x; test/systems/survival/tempui.test.js holds the two to
 *  one another over every minute of the day). */
export function hourBand(hour) {
  const h = ((Math.floor(hour ?? 12)) % 24 + 24) % 24;
  if (h >= 8 && h <= 15) return 'day';
  if (h >= 16 && h <= 19) return 'evening';
  if (h >= 4 && h <= 7) return 'dawn';
  return 'night';
}
/**
 * TEMP-UI: THE NATURAL TEMPERATURE'S PARTS - the climate, the season, the hour, the weather and the roof - which sum to
 * naturalTemperature(env) EXACTLY, by construction: the roof's share is what the law's answer is past the climate and
 * the season wherever it is not the street's own sum. So the roof law stays naturalTemperature's alone (ROOF-SHELTER)
 * and this only says what it did.
 */
export function naturalParts(env = {}) {
  const { climateIndex, month, hour, weather } = env;
  const climate = CLIMATE_TEMP[climateIndex] ?? 0;
  const season = MONTH_TEMP[((month ?? 0) % 12 + 12) % 12] ?? 0;
  // no case for the ground: underground the law's answer is the climate and the season alone, so where an hour or a
  // sky would have moved the street's sum, the remainder below is nought and no hour, sky or roof is said (AUDIT
  // TEMP-UI: a flag for it was a second statement of the law, and a mutant proved it changed nothing)
  const day = hourTemperature(hour, climateIndex);
  const sky = WEATHER_TEMP[weather] ?? 0;
  const natural = naturalTemperature(env);
  if (natural === climate + season + day + sky) return { climate, season, hour: day, weather: sky, roof: 0, natural };
  return { climate, season, hour: 0, weather: 0, roof: natural - climate - season, natural };
}

/** How wet a minute in this weather makes you, outdoors - AUDIT C&C I2: and none at rest in a tent (`sheltered`: the
 *  mod's camp rest is its "inside or camping" arm, where the counter only dries). */
export function weatherWetGain(weather, { cloak = false, hood = false, insideBuilding = false, insideDungeon = false, sheltered = false, fall = 1, snow = null } = {}) {
  if (insideBuilding || insideDungeon || sheltered) return 0;
  let row = WEATHER_WET[weather];
  if (!row) return 0;
  // PRECIP1 (AUDIT PRECIP FALL-4): a fall of two phases - sleet, wet snow - soaks as its rain (a storm's) and its snow in
  // their shares (`snow`, the fall's snow share: weatherSim.js fallingWeather), never as the word it rounds to
  if (snow != null && (weather === 'rain' || weather === 'thunder' || weather === 'snow')) {
    const wet = WEATHER_WET[weather === 'snow' ? 'rain' : weather], white = WEATHER_WET.snow, k = Math.max(0, Math.min(1, snow));
    row = wet.map((v, i) => v + (white[i] - v) * k);
  }
  // WET-FALL (FIELD BUGS 2026-10-15f): a rain, a storm or a snow soaks by how hard it FALLS - `fall`, the front's level
  // (weatherSim.js fallingWeather; 1 on the classic sky, as the mod's every-minute row) - so a sprinkle soaks as a
  // sprinkle and a word with nothing yet falling not at all. Fog is not falling: its row stands whole.
  const k = precipitationForWeather(weather) ? Math.max(0, Math.min(1, Number.isFinite(fall) ? fall : 1)) : 1;
  return k * (cloak ? (hood ? row[2] : row[1]) : row[0]);
}

/** LOOT14 (the Loot arc II, bible/06-Systems/Loot-II-Arc.md section 6): the most of the weather's soaking a wardrobe's
 *  weatherproofing turns aside (%) - a river, a wade and a dive soak you whatever you wear. */
export const GEAR_DRY_MOST = 75;
/** LOOT14/LOOT15: what the loot ladder's fold put on the wearer (`entity._mods` - empty with the ladder off), as the
 *  felt temperature's context reads it: a garment's warmth and weatherproofing, and a Legendary's degrees - the cold's
 *  and the heat's, which feltTemperature takes off the felt number alone. AUDIT LOOT II A2: they were laid on the host's
 *  frost and fire resistance, and the own warmth (the clothes', the armour's, the race's) was then resisted as heat - so
 *  the Wayfarer's Robes cut the outfit's warmth by their 20 and made a cold night colder (-28 to -40 on a temperate
 *  one). The host's resistances stand as they are, beside these (AUDIT C&C: so the host's context, which this never
 *  read, is no argument). */
export function wardrobeCtx(mods) {
  if (!mods) return {};
  return {
    gearWarmth: Number(mods.warmth) || 0, gearDry: Number(mods.dry) || 0,
    coldDegrees: Number(mods.coldDegrees) || 0, heatDegrees: Number(mods.heatDegrees) || 0,
  };
}
/** The environment's wetness: a head under the water is soaked at once,
 *  and a swim on the surface - the mod's wading (ClimateCalories.cs: the
 *  motor's OnExteriorWater Swimming) - soaks fifty a minute. */
export const environmentWet = ({ submerged = false, wading = false } = {}) =>
  (submerged ? WET_SUBMERGED : 0) + (wading ? WET_WADING : 0);

/** Resistance in degrees: the frost or fire resistance the character
 *  carries, from the race template's flags (resist 25, immune 50, low
 *  tolerance -25, critical weakness -50), the spell resistances the
 *  effect manager holds (their chance, as degrees), and the curses (a
 *  vampire 25 of the frost; a lycanthrope 10 of either out of its form,
 *  and in it 100 of the cold and 80 of the heat). A cold temperature is
 *  raised toward zero by frost resistance, a hot one lowered toward zero
 *  by fire resistance, and neither crosses it. */
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

/** The cloak on either cloak slot, and whether a hood is up - the ONE
 *  hood law: VAMP-HOOD's sun reads it too (vampirism.js racialSunAverse). */
export function cloakState(worn) {
  const cloaks = [at(worn, EQUIP_SLOTS.Cloak1), at(worn, EQUIP_SLOTS.Cloak2)].filter(Boolean);
  const cloak = cloaks.length > 0;
  let hood = cloaks.some((c) => HOODED_CLOAK_VARIANTS.has(c.variant ?? 0));
  const chest = at(worn, EQUIP_SLOTS.ChestClothes);
  if (!hood && chest && HOODED_ROBES.has(chest.templateIndex) && (chest.variant ?? 0) === 1) hood = true;
  return { cloak, hood, cloaks };
}

/** HOOD-SAID (FIELD BUGS 2026-09-30): the garments that carry a hood - the casual and the formal cloak on either
 *  body, and plain robes. */
export const hoodCapable = (item) => CASUAL_CLOAKS.has(item?.templateIndex) || FORMAL_CLOAKS.has(item?.templateIndex)
  || HOODED_ROBES.has(item?.templateIndex);
/** HOOD-SAID: whether ONE garment is drawn hood up - cloakState asked of a table holding that piece alone, in the slot
 *  its hood is read from, so a piece's hood is the one hood law and never a second list. */
export function hoodUp(item) {
  if (!hoodCapable(item)) return false;
  return cloakState({ [HOODED_ROBES.has(item.templateIndex) ? EQUIP_SLOTS.ChestClothes : EQUIP_SLOTS.Cloak1]: item }).hood;
}

/** FIELD BUGS 2026-09-30 (CLOTHES-BREATHE; #bug-reports, "Climates &
 *  Calories Bugs": "Whether you are appropriately clothed for your
 *  region, indoors, etc. your temperature gets to either "Scorching" or
 *  "Freezing" ... and seems to never recover"): CLOTHES BREATHE IN THE
 *  HEAT. Clothing only ever added warmth, at full weight in any weather,
 *  so nothing worn lowered a hot reading and the lightest outfit in the
 *  desert was charged its every point: the starting kit's short shirt and
 *  casual pants are fifteen degrees, and a desert inn at noon read Hot in
 *  them. Above this natural temperature - the warm word's own line
 *  (temperatureWord), where the drying and the sun on bare skin read heat
 *  (needs.js) - the clothes give up a degree for each degree past it,
 *  down to half their warmth, truncated, and no further (AUDIT TEMP-UI E7:
 *  they fell to half at once), before the wet eats what is left. The cold
 *  is unchanged; armour is unchanged, its metal's heat in the sun its own
 *  rule (armorWarmth). A declared departure (Port-Ledger A): the mod's
 *  clothes warm alike in any heat. */
export const CLOTHES_BREATHE_ABOVE = 10;
/** Clothing warmth: chest, legs, feet and the cloaks, less the wetness,
 *  never below nothing; a hood in strong sun cools the head. */
export function clothingWarmth(worn, { wet = 0, natural = 0, inSunlight = false, gear = 0 } = {}) {
  const chest = at(worn, EQUIP_SLOTS.ChestClothes), legs = at(worn, EQUIP_SLOTS.LegsClothes), feet = at(worn, EQUIP_SLOTS.Feet);
  let warmth = (chest ? CHEST_WARMTH[chest.templateIndex] ?? 0 : 0)
    + (legs ? LEGS_WARMTH[legs.templateIndex] ?? 0 : 0)
    + (feet && feet.group !== 'Armor' ? FEET_WARMTH[feet.templateIndex] ?? 0 : 0)
    + Math.max(0, Number(gear) || 0);   // LOOT14: a garment's warmth lines - a lining, halved in the heat and eaten by the wet as the cloth is
  const { cloaks, hood } = cloakState(worn);
  for (const c of cloaks) {
    const v = CLOAK_WARMTH[c.variant ?? 0] ?? CLOAK_WARMTH[0];
    warmth += FORMAL_CLOAKS.has(c.templateIndex) ? 3 * v : CASUAL_CLOAKS.has(c.templateIndex) ? v : 0;
  }
  // CLOTHES-BREATHE: half in the heat, the dry reading with it - AUDIT TEMP-UI E7: eased in a degree at a time from the
  // line, never past half, so a warmer world never reads cooler (it fell from half at once, and a world of 12 read
  // seventeen degrees cooler than one of 10 in a warm outfit)
  // AUDIT C&C T5: and a hood's shade in strong sun eases in the same way - a degree a degree past thirty, to its ten -
  // and is taken before the wet, so the dry reading is the dry law's. It came off whole at 31, after the wet: a hooded
  // outfit read Scorching 51 at a natural 30 and Hot 45 at 35, and its dry note named a warmth the law never gave
  const shade = natural > 30 && inSunlight && hood ? Math.min(HOOD_SHADE, natural - 30) : 0;
  if (natural > CLOTHES_BREATHE_ABOVE) warmth = Math.max(Math.trunc(warmth / 2) - shade, warmth - (natural - CLOTHES_BREATHE_ABOVE));
  const pure = Math.max(0, warmth);   // AUDIT SURV D: never below nothing, as the law says
  warmth = Math.max(0, pure - Math.min(wet, WET_MAX));
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
  else if (metalTemp < 0) heat = Math.trunc((metalTemp + 1) / 2);   // AUDIT C&C T11: the mod's own (Climates.cs Armor(), toward nought) - it chilled a degree colder than the mod at every reading
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
 * @param {object} ctx   { raceId, raceTemplate, frostResist, fireResist, vampire, lycanthrope, beastForm, hasWater, wet,
 *                        and wardrobeCtx's gearWarmth, gearDry, coldDegrees, heatDegrees }
 */
export function feltTemperature(env = {}, worn = null, ctx = {}) {
  const natural = naturalTemperature(env);
  // AUDIT C&C T7: the law reads WHOLE wetness - a weatherproof garment turns part of a minute's soaking aside
  // (LOOT14), the counter keeps the fraction, and a fractional reading printed "-10" over the word "cold"
  const wet = Math.floor(Math.min(Math.max(0, Number(ctx.wet) || 0), WET_MAX));
  // AUDIT TEMP-UI E3: THE AIR THE BODY STANDS IN - underground the dungeon's, not the surface's. The clothes breathed and
  // the armour's metal heated or chilled by the sky over the dungeon, so a desert dungeon's air of -20 read the starting
  // kit halved for the surface's heat ("cold") where every other dungeon read it whole ("comfortable"); and the food
  // spoiled by the surface's heat (needs.js reads `air` for the rot, and the drying).
  const air = env.insideDungeon ? dungeonTemperature(natural) : natural;
  // AUDIT C&C T1: AND THE RESISTANCES TURN THAT AIR toward nought - they were laid on the surface's reading before the
  // ground's correction, so underground a Resist Fire pushed a cool hall colder (a naked Argonian in an Alik'r dungeon,
  // -15 bare, read -35 Freezing with fifty) and a Resist Frost did nothing while its row still showed. A declared
  // departure (Port-Ledger A): the mod resists before the dungeon's correction.
  const natTemp = resistTemperature(air, ctx);
  const clothes = clothingWarmth(worn, { wet, natural: air, inSunlight: !!env.inSunlight, gear: ctx.gearWarmth });
  const armour = armorWarmth(worn, { natural: air, wet, inSunlight: !!env.inSunlight });
  const race = RACE_TEMP[ctx.raceId] ?? 0;
  const water = Math.trunc(wet / 20);
  const fire = env.byFire ? 15 : 0;
  // AUDIT TEMP-UI E1: THE BODY'S OWN WARMTH IS NOT RESISTED. It was resisted as heat, so a Resist Fire made a blizzard
  // colder by every degree the clothes and the campfire gave (-62 to -112 at fifty), and a Resist Frost a desert hotter
  // - the mechanism AUDIT LOOT II A2 found for a Legendary's degrees and mended for those alone. A resistance turns the
  // WORLD's cold or heat toward nothing (natTemp, above); what the body carries is its own. A declared departure
  // (Port-Ledger A): the mod resists both.
  const own = race + clothes.warmth + armour.warmth + fire - water + NAKED_OFFSET;
  let felt = natTemp + own;
  const unwatered = felt;   // TEMP-UI: before the drink to hand
  if (felt > 9 && ctx.hasWater && !ctx.vampire) felt = Math.max(felt - WATER_COOLS, 9);   // AUDIT TEMP-UI E8: never under where the cooling starts - a reading of 10 fell to 0 and 19 to 9, a warmer day reading cooler
  const watered = felt;   // TEMP-UI: before a Legendary garment's degrees
  // LOOT15 (bible/06-Systems/Loot-II-Arc.md section 7): a Legendary garment's degrees - the cold felt so much less, or the
  // heat - toward comfortable and never past it, each on its own side alone (AUDIT LOOT II A2)
  const coldLess = Math.max(0, Number(ctx.coldDegrees) || 0), heatLess = Math.max(0, Number(ctx.heatDegrees) || 0);
  if (felt < 0) felt = Math.min(felt + coldLess, 0);
  else if (felt > 0) felt = Math.max(felt - heatLess, 0);
  return {
    natural, natTemp, own, felt, abs: Math.abs(felt), air,
    clothes: clothes.warmth, clothesDry: clothes.pure, armour: armour.warmth, metal: armour.heat, race, water, fire,
    cloak: cloakState(worn).cloak, hood: clothes.hood, wet,
    // TEMP-UI: the rest of the sum, so a breakdown adds up to `felt` exactly (temperatureBreakdown): the resistances on
    // the air, the ground's correction, the heat loss, the drink to hand, a garment's degrees
    worldResist: natTemp - air, dungeon: air - natural, naked: NAKED_OFFSET, waterCools: watered - unwatered, degrees: felt - watered,
    wetGain: weatherWetGain(env.falling?.word ?? env.weather, { cloak: cloakState(worn).cloak, hood: clothes.hood, insideBuilding: env.insideBuilding, insideDungeon: env.insideDungeon, sheltered: !!env.sheltered, fall: env.falling?.level ?? 1, snow: env.falling?.snow ?? null })   // WET-FALL: what falls, not the sky's word; AUDIT PRECIP FALL-4: at its snow share
        * (1 - Math.min(GEAR_DRY_MOST, Math.max(0, Number(ctx.gearDry) || 0)) / 100)   // LOOT14: weatherproofing turns the weather's soaking aside
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

/** TEMP-UI (2026-10-12): the climates as the temperature's breakdown names them. */
export const CLIMATE_NAMES = Object.freeze({
  [CLIMATES.Ocean]: 'Sea', [CLIMATES.Desert]: 'Desert', [CLIMATES.Desert2]: 'Deep desert', [CLIMATES.Mountain]: 'Mountains',
  [CLIMATES.Rainforest]: 'Rainforest', [CLIMATES.Swamp]: 'Swamp', [CLIMATES.Subtropical]: 'Subtropics',
  [CLIMATES.MountainWoods]: 'Mountain woods', [CLIMATES.Woodlands]: 'Woodlands', [CLIMATES.HauntedWoodlands]: 'Haunted woods',
});
/** TEMP-UI: the weathers, as the breakdown names them (WEATHER_TEMP's keys). */
export const WEATHER_NAMES = Object.freeze({
  sunny: 'Clear sky', cloudy: 'Cloudy', overcast: 'Overcast', fog: 'Fog', rain: 'Rain', thunder: 'Thunderstorm', snow: 'Snow', sandstorm: 'Sandstorm',
});
/** TEMP-UI: the hour's bands, as the breakdown names them (hourBand). */
export const HOUR_NAMES = Object.freeze({ day: 'Daytime', evening: 'Evening', dawn: 'Dawn', night: 'Night' });

/**
 * TEMP-UI (2026-10-12, the owner: "add a temperature widget to the UI including allowing players to see their personal
 * temperature in their inventory"): WHAT MAKES THE FELT TEMPERATURE, AS ROWS THAT ADD UP TO IT. `env` is the one the
 * reading was taken in and `temp` feltTemperature's answer for it. Each row is { key, label, value, note? }: the
 * climate always, then every part that moved the number - the season, the hour, the weather, a roof, the ground, the
 * resistances (on the air - AUDIT TEMP-UI E1: the body's own warmth is not resisted), the race, the clothing (with what it would be dry,
 * where the wet ate some), the armour (and its metal in the sun or the cold), a fire, wet clothes, bare skin, a drink to
 * hand, a Legendary garment's degrees. The values sum to `temp.felt` to the degree (test/systems/survival/tempui.test.js sweeps it).
 */
export function temperatureBreakdown(env = {}, temp = null) {
  if (!temp) return [];
  const p = naturalParts(env);
  const out = [{ key: 'climate', label: CLIMATE_NAMES[env.climateIndex] ?? 'The land', value: p.climate }];
  const add = (key, label, value, note = null) => { if (value) out.push(note ? { key, label, value, note } : { key, label, value }); };
  add('season', monthNames()[((env.month ?? 0) % 12 + 12) % 12] ?? 'The season', p.season);
  add('hour', HOUR_NAMES[hourBand(env.hour)], p.hour);
  add('weather', WEATHER_NAMES[env.weather] ?? 'The weather', p.weather);
  add('roof', 'Shelter', p.roof);
  add('ground', env.castle ? 'Castle walls' : 'Underground', temp.dungeon);   // AUDIT C&C (lens T): the mod's Dungeon() corrects a castle's halls as a dungeon's, and a palace is not underground
  add('resist', 'Resistances', temp.worldResist);
  add('race', 'Your race', temp.race);
  add('clothes', 'Clothing', temp.clothes, temp.clothesDry > temp.clothes && temp.wet > 0 ? `${signedDegrees(temp.clothesDry)} dry` : null);
  add('armour', 'Armour', temp.armour, temp.metal > 0 ? 'hot metal' : temp.metal < 0 ? 'cold metal' : null);   // `metal` is the heat the law laid on: the sun's, uncovered, or the cold's
  add('fire', 'A fire', temp.fire);
  add('wet', 'Wet through', -temp.water);
  add('skin', 'Heat loss', temp.naked);   // AUDIT C&C T8: the mod's own offset, every body's - not "Bare skin" on a body dressed head to foot
  add('drink', 'Water to hand', temp.waterCools);
  add('garment', 'Enchanted garment', temp.degrees);
  return out;
}
/** TEMP-UI: a reading as the HUD and the pack print it - signed, rounded, with its degree sign: "-14\u00b0", "+3\u00b0", "0\u00b0". */
export function signedDegrees(n) {
  const v = Math.round(Number(n) || 0);
  return `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v)}\u00b0`;
}

