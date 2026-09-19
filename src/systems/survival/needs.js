// SURV1 - THE NEEDS: hunger, thirst, sleep, wetness and exposure, as
// one state record on the entity and one law per world minute. An
// original design after Climates & Calories (Systems-Arc SURV records
// the mod's own numbers and where these depart from them).
//
// THE SHAPE. Every need is a MARKER or a COUNTER on `entity.survival`:
//   lastAte     the classic minute of the last meal (hunger is now - it)
//   thirst      0..THIRST_MAX, rises with the felt heat, a drink takes 40
//   wet         0..300, rain and water raise it, warmth and fire dry it
//   sleepDebt   hours owed: grows past AWAKE_FREE_HOURS awake, sleep pays
//   awakeSince  the classic minute you last woke
//   exposure    minutes the felt temperature has stood past 30
//   fed         the well-fed tally that pays fatigue back
//   drunk       what the tavern poured, one off every ten minutes
// and `survivalMinute` is the whole per-minute law: it reads the felt
// temperature (temperature.js), moves the counters, and hands its
// costs to the host's sinks (fatigue, health, a line). Stat drains
// are ONE activeEffects entry of kind 'survival' whose statMods map is
// rewritten each minute (statMods.liveStat reads it), so a drain never
// outlives the cause and a save carries it as any other effect.
//
// ONLINE (WORLD5): the world's clock is wall time and a save arrives
// without catching up. `alignSurvival` is that law for these markers:
// a player away longer than a day comes back fed, watered and rested
// rather than dead of the time they were not playing. The tick itself
// owes at most MAX_CATCHUP_MINUTES per reading.
import { feltTemperature, temperatureWord } from './temperature.js';
import { drinkFrom, findDrink, waterskinName, DRINK_RELIEF, TEMPLATE, isFood, foodStage, FOOD_STAGE, rotFoodDay, rotWeight, ROT_DAY_MINUTES } from './food.js';
import { STAT_KEYS_ORDER } from '../statMods.js';
/** SURV4: speed and agility down by this while stiff (survival/rest.js's STIFF_PENALTY, restated here so rest.js may import this module). */
const STIFF_PENALTY = 5;
import { MINUTES_PER_DAY } from '../gameDate.js';

export const NEED = Object.freeze({
  PECKISH_AT: 240, HUNGRY_AT: 720, STARVING_AT: 1440,   // minutes since a meal
  THIRSTY: 50, PARCHED: 80, DEHYDRATED: 100, THIRST_MAX: 150,
  /** SURV-THIRST1: where thirst starts costing BLOOD - twenty past dehydrated,
   *  which is the number the mod's own heat-only line used. */
  THIRST_HARM: 120,
  SLEEP_TIRED: 4, SLEEP_DROWSY: 8, SLEEP_EXHAUSTED: 12, SLEEP_DEBT_MAX: 24, AWAKE_FREE_HOURS: 16,
  WET_DAMP: 5, WET_WET: 30, WET_SOAKED: 100, WET_DRENCHED: 200, WET_MAX: 300,
  EXPOSURE_AT: 30, DAMAGE_AT: 50,
});
/** Thirst rises this much a minute at a comfortable temperature (100 in
 *  six hours), scaled by the heat: felt 40 is four times as fast. */
export const THIRST_PER_MINUTE = 100 / 360;
/** The fatigue units (x64 is one classic point) the needs charge per
 *  minute. DFU's own walking drain is 11 a minute for scale. */
export const DRAIN = Object.freeze({ heatPer20: 6, starving: 4, parched: 6, dehydrated: 12, exhausted: 8, wellFed: 64, bareFeet: 4 });
/** AUDIT SURV E: the harms that can kill come once every ten minutes,
 *  not every minute, and the bare-skin harms leave the last five
 *  points - a starting character (short shirt, casual pants, no shoes,
 *  25 health) walked a clear winter afternoon and died in two hours.
 *  Only EXPOSURE past DAMAGE_AT kills, and never in your sleep - the
 *  rest gate refuses the freezing and the scorching night (rest.js). */
export const HARM_EVERY_MINUTES = 10;
export const HEALTH_FLOOR = 5;
/** AUDIT SURV A: the well-fed hour - a point of fatigue back for every hour spent fed (the mod's 500-tally was minutes and paid twenty). */
export const WELL_FED_MINUTES = 60;
/** Rough drains cannot take the last of a pool by themselves. */
export const FLOOR_FATIGUE = 64;
export const MAX_CATCHUP_MINUTES = 2 * MINUTES_PER_DAY;
export const NOTE_EVERY_MINUTES = 5;

export const SURVIVAL_TEXT = Object.freeze({
  peckish: 'Your stomach rumbles...',
  hungry: 'You have not eaten in a long while...',
  starving: 'You are starving...',
  thirsty: 'You are getting thirsty...',
  parched: 'Your mouth is dry. You need water.',
  dehydrated: 'You are dehydrated...',
  drank: 'You drink from your waterskin.',
  drankLow: 'Your waterskin is nearly empty.',
  drained: 'You drain your waterskin.',
  tired: 'You stifle a yawn...',
  drowsy: 'You are drowsy from lack of sleep...',
  exhausted: 'You really need some sleep...',
  damp: 'You are a bit wet.',
  wet: 'You are quite wet.',
  soaked: 'You are soaking wet.',
  drenched: 'You are completely drenched.',
  warm: 'You are a bit warm...',
  hot: 'You wipe the sweat from your brow...',
  scorching: 'You are getting dizzy from the heat...',
  burning: 'You cannot go on much longer in this heat...',
  chilly: 'You are a bit chilly...',
  cold: 'You shiver from the cold...',
  freezing: 'The cold is seeping into your bones...',
  deadly: 'Your teeth are chattering uncontrollably!',
  nakedCold: 'The cold air numbs your bare skin.',
  bareFeetCold: 'Your bare feet are freezing.',
  bareFeetHot: 'Your bare feet are getting burned.',
  sunburn: 'The sun burns your bare skin.',
  armorHot: 'Your armor is starting to heat up.',
  armorCold: 'Your armor is getting cold.',
  rust: (name) => `Your ${name} is getting rusty...`,
  rot: 'Your food is getting a bit ripe...',
  ateRations: 'You eat some rations.',
  emptiedRations: 'You empty your sack of rations.',
});

/** A fresh record at `now`: just fed, watered, dry and awake. */
export function newSurvival(now = 0) {
  return { lastAte: now - 10, thirst: 0, wet: 0, sleepDebt: 0, awakeSince: now, exposure: 0, fed: 0, drunk: 0, rotMinutes: 0, rotDays: 0, stiffUntil: 0, notes: {} };   // SURV4: stiffUntil, the rough night's morning
}
/** The entity's record, made if missing. */
export function survivalOf(entity, now = 0) {
  if (!entity.survival || typeof entity.survival !== 'object') entity.survival = newSurvival(now);
  const s = entity.survival;
  s.notes ??= {};
  return s;
}

export const hungerMinutes = (s, now) => Math.max(0, now - (s.lastAte ?? now));
export function hungerStage(minutes) {
  if (minutes >= NEED.STARVING_AT) return 'starving';
  if (minutes >= NEED.HUNGRY_AT) return 'hungry';
  if (minutes >= NEED.PECKISH_AT) return 'peckish';
  return 'fed';
}
export const starvingDays = (minutes) => Math.max(0, Math.trunc(minutes / NEED.STARVING_AT));
export function thirstStage(t) {
  if (t >= NEED.DEHYDRATED) return 'dehydrated';
  if (t >= NEED.PARCHED) return 'parched';
  if (t >= NEED.THIRSTY) return 'thirsty';
  return 'fine';
}
export function sleepStage(debt) {
  if (debt >= NEED.SLEEP_EXHAUSTED) return 'exhausted';
  if (debt >= NEED.SLEEP_DROWSY) return 'drowsy';
  if (debt >= NEED.SLEEP_TIRED) return 'tired';
  return 'rested';
}
export function wetStage(w) {
  if (w >= NEED.WET_DRENCHED) return 'drenched';
  if (w >= NEED.WET_SOAKED) return 'soaked';
  if (w >= NEED.WET_WET) return 'wet';
  if (w >= NEED.WET_DAMP) return 'damp';
  return 'dry';
}
export const awakeHours = (s, now) => Math.max(0, now - (s.awakeSince ?? now)) / 60;

/** The stat drains the needs impose, as one map the 'survival' entry
 *  carries. Each is capped so a drain can never pull a stat under 5
 *  (the caller clamps against the permanent stat). */
export function survivalStatMods(s, temp, now, { endurance = 50 } = {}) {
  const mods = {};
  const sub = (keys, n) => { if (n > 0) for (const k of keys) mods[k] = (mods[k] ?? 0) - n; };
  const ALL = ['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed'];
  const starve = starvingDays(hungerMinutes(s, now));
  if (starve > 0) sub(ALL, Math.min(20, starve * 2));
  if (temp && temp.abs > NEED.EXPOSURE_AT) sub(ALL, Math.trunc(Math.min(s.exposure, temp.abs - NEED.EXPOSURE_AT) / 4));
  if (s.thirst >= NEED.DEHYDRATED) sub(ALL, Math.trunc((s.thirst - 90) / 10));
  const sleep = sleepStage(s.sleepDebt);
  if (sleep === 'tired') sub(ALL, 2); else if (sleep === 'drowsy') sub(ALL, 5); else if (sleep === 'exhausted') sub(ALL, 10);
  if (Number.isFinite(s.stiffUntil) && now < s.stiffUntil) sub(['speed', 'agility'], STIFF_PENALTY);   // SURV4: the rough night's morning
  if (s.drunk > endurance / 2) {
    const d = Math.trunc((s.drunk - endurance / 2) / 10);
    sub(['agility', 'intelligence', 'willpower', 'speed'], d);
    mods.personality = (mods.personality ?? 0) + Math.min(5, d + 1);   // the drink makes you a little friendlier (AUDIT SURV A: +1..+5 rising with the drink, never the +20 that paid for itself)
  }
  return mods;
}

/** Write the map onto the entity's one 'survival' effect entry (made
 *  or removed as needed) and cap each drain against the permanent stat. */
export function applySurvivalMods(entity, mods) {
  const list = entity.activeEffects ??= [];
  let entry = list.find((a) => a?.kind === 'survival');
  const capped = {};
  let any = false;
  for (const k of STAT_KEYS_ORDER) {
    const m = mods[k] ?? 0;
    if (m === 0) continue;
    const perm = entity.stats?.[k] ?? 0;
    capped[k] = m < 0 ? -Math.min(-m, Math.max(0, perm - 5)) : m;
    if (capped[k] !== 0) any = true;
  }
  if (!any) { if (entry) list.splice(list.indexOf(entry), 1); return null; }
  if (!entry) { entry = { kind: 'survival', statMods: {} }; list.push(entry); }
  entry.statMods = capped;
  return entry;
}

/** Say a line at most once per NOTE_EVERY_MINUTES per key. Stage lines
 *  (`once`) fire when the stage is first reached and not again until it
 *  is left. */
function note(s, key, now, say, text, { once = false } = {}) {
  const n = s.notes;
  if (once) { if (n[key] === 'on') return; n[key] = 'on'; say?.(text); return; }
  if (Number.isFinite(n[key]) && now - n[key] < NOTE_EVERY_MINUTES) return;
  n[key] = now;
  say?.(text);
}
const clearNote = (s, key) => { if (s.notes[key] === 'on') delete s.notes[key]; };

/**
 * ONE WORLD MINUTE of the needs.
 *
 * @param {object} entity   the player (stats, raceId, items, activeEffects, fatigue)
 * @param {number} now      the classic minute this step lands on
 * @param {object} env      the host's environment (see feltTemperature) plus:
 *                          resting, sleeping ('bed'|'camp'|'rough'|null), swimming, transport
 * @param {object} deps     { worn, ctx, sinks: { drainFatigue, restoreFatigue, hurt, say }, rolls, autoDrink, autoEat, collections }
 * @returns the felt temperature record for the HUD and the status page
 */
export function survivalMinute(entity, now, env = {}, deps = {}) {
  const s = survivalOf(entity, now);
  const { worn = null, sinks = {}, rolls = Math.random, autoDrink = true, autoEat = true } = deps;
  const say = sinks.say ?? deps.say ?? null;
  const items = entity.items ?? [];
  const ctx = { ...(deps.ctx ?? {}), wet: s.wet, hasWater: !!findDrink(items) };
  const temp = feltTemperature(env, worn, ctx);
  const resting = !!env.resting;
  const sleeping = env.sleeping ?? null;
  const vampire = !!ctx.vampire;
  const endurance = entity.stats?.endurance ?? 50;

  // WET: rain and water raise it; warmth dries it, a fire dries it fast.
  s.wet = Math.min(NEED.WET_MAX, s.wet + temp.wetGain);
  if (temp.wetGain <= 0) {
    let dry = temp.natTemp > 10 ? Math.trunc(temp.natTemp / 10) : 1;
    if (env.byFire || env.insideBuilding) dry += 2;
    s.wet = Math.max(0, s.wet - dry);
  }
  const wetNow = wetStage(s.wet);
  if (wetNow !== 'dry') note(s, `wet:${wetNow}`, now, say, SURVIVAL_TEXT[wetNow], { once: true });
  for (const k of ['damp', 'wet', 'soaked', 'drenched']) if (k !== wetNow) clearNote(s, `wet:${k}`);

  // HUNGER: the marker stands; the tallies move.
  const hunger = hungerMinutes(s, now);
  const hungerNow = vampire ? 'fed' : hungerStage(hunger);
  if (hungerNow === 'fed' && !vampire) { s.fed += 1; if (s.fed >= WELL_FED_MINUTES) { s.fed = 0; sinks.restoreFatigue?.(DRAIN.wellFed); } }
  if (hungerNow === 'starving' && autoEat) {
    const sack = items.find((i) => i.templateIndex === TEMPLATE.Rations && isFood(i));
    if (sack) { eatRations(entity, sack, now, say); }
  }
  const hungerAfter = vampire ? 'fed' : hungerStage(hungerMinutes(s, now));
  if (hungerAfter !== 'fed') note(s, `hunger:${hungerAfter}`, now, say, SURVIVAL_TEXT[hungerAfter], { once: true });
  for (const k of ['peckish', 'hungry', 'starving']) if (k !== hungerAfter) clearNote(s, `hunger:${k}`);
  if (hungerAfter === 'starving' && !resting) sinks.drainFatigue?.(DRAIN.starving);

  // THIRST: the heat drives it; a skin in the pack answers it.
  if (!vampire) {
    const rate = THIRST_PER_MINUTE * Math.max(0.5, 1 + Math.max(0, temp.felt - 10) / 10);
    s.thirst = Math.min(NEED.THIRST_MAX, s.thirst + rate);
    if (autoDrink && s.thirst >= NEED.THIRSTY) drinkWater(entity, now, say);   // AUDIT SURV E: at the stage, so the chip never blinks with a skin in the pack
    const thirstNow = thirstStage(s.thirst);
    if (thirstNow !== 'fine') note(s, `thirst:${thirstNow}`, now, say, SURVIVAL_TEXT[thirstNow], { once: true });
    for (const k of ['thirsty', 'parched', 'dehydrated']) if (k !== thirstNow) clearNote(s, `thirst:${k}`);
    if (!resting) {
      if (thirstNow === 'parched') sinks.drainFatigue?.(DRAIN.parched);
      else if (thirstNow === 'dehydrated') sinks.drainFatigue?.(DRAIN.dehydrated);
    }
    // SURV-THIRST1 (2026-09-19, Mac: "You should also should die on
    // dehydration"). THE DEPARTURE, and the only one in this block.
    //
    // Climates & Calories bleeds you for thirst only in HEAT - this line
    // read `s.thirst >= 120 && temp.felt > NEED.EXPOSURE_AT`, so a cool
    // dungeon taxed fatigue for ever and never a drop of blood. Water is
    // not a climate: a body past dehydrated fails wherever it stands, and
    // the port says so. (bible/06-Systems/Climates-Calories.md carries the
    // departure; it is NOT the mod's law and must not be tidied back.)
    //
    // The shape is AUDIT SURV E's, not a new one. A harm that can kill
    // comes on the HARM TICK and not every minute - the old line fired
    // sixty times an hour, which is how a starting character loses
    // twenty-five points in twenty-five game-minutes - and it escalates
    // the way exposure's does, off how far past the threshold you are.
    // No `hurtFloored`: the bare-skin harms leave the last five points
    // BECAUSE they are not meant to kill, and this one is.
    //
    // HEAT STILL KILLS YOU FASTER, through the mod's own mechanism rather
    // than a second rule: the thirst RATE above already scales with the
    // felt heat (felt 40 is four times as fast), so a desert reaches 150
    // and stays there while a cellar crawls. What heat no longer does is
    // buy a separate, harsher damage law.
    //
    // Not in your sleep, and not sat by a fire - the same two words the
    // temperature harm below uses. Nothing in `systems/rest.js` refuses a
    // rest for thirst, so a sleeper who could not wake to drink would be
    // killed by a window they were allowed to open.
    if (s.thirst >= NEED.THIRST_HARM && !sleeping && !resting && now % HARM_EVERY_MINUTES === 0) {
      sinks.hurt?.(Math.max(1, Math.trunc((s.thirst - NEED.THIRST_HARM + 10) / 10)));
    }
  }

  // SLEEP: the debt grows past the free hours; sleep pays it by quality.
  if (!vampire) {
    if (sleeping) {
      const rate = sleeping === 'rough' ? 0.5 : 1.5;   // hours of debt per hour asleep
      const floor = sleeping === 'rough' ? NEED.SLEEP_TIRED : 0;
      const next = s.sleepDebt - rate / 60;
      s.sleepDebt = s.sleepDebt >= floor ? Math.max(floor, next) : Math.max(0, next);   // AUDIT SURV A: the floor holds from above and never lifts a rested sleeper up to it
      s.awakeSince = now;
    } else if (awakeHours(s, now) > NEED.AWAKE_FREE_HOURS) {
      s.sleepDebt = Math.min(NEED.SLEEP_DEBT_MAX, s.sleepDebt + 1 / 60);
    }
    const sleepNow = sleepStage(s.sleepDebt);
    if (sleepNow !== 'rested') note(s, `sleep:${sleepNow}`, now, say, SURVIVAL_TEXT[sleepNow], { once: true });
    for (const k of ['tired', 'drowsy', 'exhausted']) if (k !== sleepNow) clearNote(s, `sleep:${k}`);
    if (sleepNow === 'exhausted' && !resting) sinks.drainFatigue?.(DRAIN.exhausted);
  }

  // TEMPERATURE: the body pays for the heat and the cold.
  const abs = temp.abs;
  if (abs > NEED.EXPOSURE_AT) s.exposure = Math.min(s.exposure + 1, 600); else s.exposure = Math.max(0, s.exposure - 2);
  const harmTick = now % HARM_EVERY_MINUTES === 0;
  const hurtFloored = (n) => { if ((entity.health ?? 0) > HEALTH_FLOOR) sinks.hurt?.(n); };
  if (!resting || !env.byFire) {
    if (abs >= 20) sinks.drainFatigue?.(DRAIN.heatPer20 * Math.trunc(abs / 20));
    if (abs > NEED.DAMAGE_AT && !sleeping && harmTick) sinks.hurt?.(Math.max(1, Math.trunc((abs - 40) / 10)));
  }
  // AUDIT SURV A/E: the strip's own words (temperature.js temperatureWord), one note a word said once - an escalation
  // speaks at once and a held reading never repeats (a cold afternoon said three lines every five minutes)
  const tw = temperatureWord(temp.felt);
  const word = tw === 'scorching' ? 'scorching' : tw === 'hot' ? 'hot' : tw === 'warm' ? 'warm' : tw === 'deadly cold' ? 'deadly' : tw === 'freezing' ? 'freezing' : tw === 'cold' ? 'cold' : null;
  const tempKey = word && !(env.insideDungeon && word === 'warm') ? `temp:${word}` : null;
  if (tempKey) note(s, tempKey, now, say, SURVIVAL_TEXT[word], { once: true });
  for (const k of ['scorching', 'hot', 'warm', 'deadly', 'freezing', 'cold']) if (`temp:${k}` !== tempKey) clearNote(s, `temp:${k}`);

  // BARE SKIN: naked in the cold, bare feet, the sun on uncovered skin.
  // AUDIT SURV E: never asleep or sat resting (the bedroll and the fire), once every ten minutes, never the last five points;
  // bare feet cost fatigue, not blood. Each line is said once and again only after it lifted.
  let naked = false, sun = false, feet0 = false;
  if (!env.insideBuilding && !vampire && !ctx.beastForm && !sleeping && !resting) {
    const chest = worn?.[17] ?? null, chestArmor = worn?.[18] ?? null, legs = worn?.[24] ?? null, legsArmor = worn?.[23] ?? null, feet = worn?.[26] ?? null;
    const bareTop = !chest && !chestArmor && !temp.cloak, bareLegs = !legs && !legsArmor && !temp.cloak;
    if ((bareTop || bareLegs) && temp.natTemp < -10) { naked = true; if (harmTick) hurtFloored(1); note(s, 'naked', now, say, SURVIVAL_TEXT.nakedCold, { once: true }); }
    if ((bareTop || bareLegs) && env.inSunlight && temp.natTemp > 10 && env.weather !== 'overcast' && ctx.raceId !== 8 && ctx.raceId !== 4) {
      sun = true;
      if (harmTick) hurtFloored(1);
      note(s, 'sun', now, say, SURVIVAL_TEXT.sunburn, { once: true });
    }
    if (!feet && !env.transport && abs > endurance / 2 && !env.swimming) {
      feet0 = true;
      sinks.drainFatigue?.(DRAIN.bareFeet);
      note(s, 'feet', now, say, temp.felt > 0 ? SURVIVAL_TEXT.bareFeetHot : SURVIVAL_TEXT.bareFeetCold, { once: true });
    }
  }
  if (!naked) clearNote(s, 'naked'); if (!sun) clearNote(s, 'sun'); if (!feet0) clearNote(s, 'feet');
  if (temp.metal > 5) note(s, 'armor:hot', now, say, SURVIVAL_TEXT.armorHot, { once: true }); else clearNote(s, 'armor:hot');
  if (temp.metal < -5) note(s, 'armor:cold', now, say, SURVIVAL_TEXT.armorCold, { once: true }); else clearNote(s, 'armor:cold');

  // RUST: a wet metal piece loses a point on a 5% minute.
  if (s.wet > NEED.WET_DAMP && worn && rolls() < 0.05) {
    const metal = [18, 23, 12, 13, 15, 26, 20].map((k) => worn[k]).filter((i) => i && i.group === 'Armor' && ((i.material ?? 0) & 0x0f00) !== 0);
    if (metal.length) {
      const piece = metal[Math.floor(rolls() * metal.length)];
      const loss = Math.max(1, Math.trunc((piece.maxCondition ?? 100) / 100));
      piece.currentCondition = Math.max(0, (piece.currentCondition ?? piece.maxCondition ?? 0) - loss);   // AUDIT SURV A: the port's field (mintCondition's), not a phantom `condition`
      if (piece.currentCondition < (piece.maxCondition ?? 0) / 10) note(s, 'rust', now, say, SURVIVAL_TEXT.rust(piece.name ?? 'armor'));
    }
  }

  // ROT: the day counter turns with the heat; each day rolls every food.
  s.rotMinutes += rotWeight(temp.natural);
  if (s.rotMinutes >= ROT_DAY_MINUTES) {
    s.rotMinutes -= ROT_DAY_MINUTES;
    s.rotDays += 1;
    const spoiled = rotFoodDay(deps.collections ?? [items, entity.wagonItems, entity.otherItems], s.rotDays, rolls);
    if (spoiled > 0) note(s, 'rot', now, say, SURVIVAL_TEXT.rot);
  }

  // DRUNK: one off every ten minutes.
  if (s.drunk > 0 && now % 10 === 0) s.drunk = Math.max(0, s.drunk - 1);

  applySurvivalMods(entity, survivalStatMods(s, temp, now, { endurance }));
  s.lastMinute = now;   // AUDIT SURV B: the last minute paid - a span run under a rest is not run again by the frame
  s.felt = temp.felt;   // SURV5: the last felt reading rides the record - the HUD strip and the status page read it without the env
  return temp;
}

/** A drink from the first skin with one in it. */
export function drinkWater(entity, now, say = null) {
  const s = survivalOf(entity, now);
  const skin = findDrink(entity.items ?? []);
  if (!skin) return false;
  const r = drinkFrom(skin);
  if (!r.ok) return false;
  skin.name = waterskinName(skin);
  s.thirst = Math.max(0, s.thirst - DRINK_RELIEF);
  s.notes['thirst:thirsty'] = s.notes['thirst:parched'] = s.notes['thirst:dehydrated'] = undefined;
  say?.(r.empty ? SURVIVAL_TEXT.drained : r.low ? SURVIVAL_TEXT.drankLow : SURVIVAL_TEXT.drank);
  return true;
}

/** Rations: a sack feeds one meal's worth (FOOD[Rations].satiety) and
 *  the marker lands at now - 10 so a starving player is fed at once. */
export function eatRations(entity, sack, now, say = null) {
  const s = survivalOf(entity, now);
  const items = entity.items ?? [];
  s.lastAte = now - 10;   // a sack is a full meal: fed, whatever the hunger was
  for (const k of Object.keys(s.notes)) if (k.startsWith('hunger:')) delete s.notes[k];
  say?.(SURVIVAL_TEXT.ateRations);
  if ((sack.stackCount ?? 1) <= 1) { const i = items.indexOf(sack); if (i >= 0) items.splice(i, 1); say?.(SURVIVAL_TEXT.emptiedRations); }
  else sack.stackCount -= 1;
  return true;
}

/** Run the law over a span of minutes (a jump: a rest, a travel), capped
 *  so a long absence charges no more than two days. Returns the last felt
 *  temperature. */
export function runSurvivalMinutes(entity, from, to, env, deps) {
  let temp = null;
  const end = Math.floor(to);
  const s = survivalOf(entity, end);
  // AUDIT SURV B: the record's own marker - the dungeon's rest pays its night asleep under the window and the frame
  // after it must not pay the same night awake; a marker from a clock ahead of this one (a rewind) is re-anchored
  let last = Number.isFinite(s.lastMinute) ? s.lastMinute : Math.floor(from);
  if (last > end + MAX_CATCHUP_MINUTES) last = Math.floor(from);
  const start = Math.max(Math.floor(from), last, end - MAX_CATCHUP_MINUTES);
  for (let m = start + 1; m <= end; m++) temp = survivalMinute(entity, m, env, deps);
  if (end > (s.lastMinute ?? -Infinity)) s.lastMinute = end;
  return temp;
}
/** AUDIT SURV A: the feed stopped (the mod off, a host with no reader) - the drains the last minute wrote go with it. */
export function clearSurvivalMods(entity) {
  if (!entity?.activeEffects?.some((a) => a && a.kind === 'survival')) return false;
  applySurvivalMods(entity, {});
  return true;
}

/** WORLD5's law for these markers: a save (or a player) arriving from
 *  more than a day ago is not charged the absence. Markers older than
 *  `graceMinutes` snap to a fed, watered, rested start; counters that
 *  only grow are reset. */
export const ALIGN_GRACE_MINUTES = MINUTES_PER_DAY;
export function alignSurvival(entity, now, lastSeen = null) {
  const s = survivalOf(entity, now);
  const gap = lastSeen == null ? Infinity : now - lastSeen;
  if (gap > ALIGN_GRACE_MINUTES || (s.lastAte ?? now) > now || (s.awakeSince ?? now) > now) {
    Object.assign(s, { lastAte: now - 10, thirst: 0, wet: 0, sleepDebt: 0, awakeSince: now, exposure: 0, drunk: 0, fed: 0, lastMinute: now, notes: {} });
    return true;
  }
  return false;
}

/** Stage words for the HUD and the status page. */
export function survivalSummary(entity, now, temp = null) {
  const s = survivalOf(entity, now);
  return {
    hunger: hungerStage(hungerMinutes(s, now)), hungerMinutes: hungerMinutes(s, now),
    thirst: thirstStage(s.thirst), thirstValue: s.thirst,
    sleep: sleepStage(s.sleepDebt), sleepDebt: s.sleepDebt, awakeHours: awakeHours(s, now),
    wet: wetStage(s.wet), wetValue: s.wet,
    felt: temp?.felt ?? null, drunk: s.drunk,
    stage: foodStage, FOOD_STAGE,
  };
}
