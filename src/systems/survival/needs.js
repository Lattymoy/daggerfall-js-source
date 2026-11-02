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
//
// SURV-TIERS (2026-09-23): THE COUNTERS ARE THE WORLD'S, THE COSTS ARE
// THE TIER'S. Everything above moves the same way in Casual and Hard;
// what a minute CHARGES - the stamina, the attributes, the health, the
// rust - is read off the tier's rules (survival/difficulty.js), handed in
// as `deps.rules` by the host's feed (env.js survivalFeed). No rules
// (undefined or null) is Hard, the law at full strength. A tier that
// repays (Casual) keeps one more field, `borrowed`: the stamina each need
// took, returned when that need is met.
//
// SURV-BOONS (2026-10-12): AND A TIER THAT REWARDS (Boons) KEEPS TWO MORE -
// `wellRested`, the minutes of Well rested a night in a bed or by a fire
// banked (paySleep), spent a waking minute at a time; and `boons`, the
// boons the last minute granted (survivalBoons), which the strip and the
// status page read as they read `felt`. Both are the body's, like the
// loan: a tier without boons carries neither.
import { feltTemperature, temperatureWord, wardrobeCtx, sunlit } from './temperature.js';
import { drinkFrom, findDrink, waterskinName, DRINK_RELIEF, TEMPLATE, isFood, foodStage, FOOD_STAGE, rotFoodDay, rotWeight, ROT_DAY_MINUTES } from './food.js';
import { STAT_KEYS_ORDER, maxFatigue, liveStat, FATIGUE_MULTIPLIER } from '../statMods.js';
import { HARD_RULES } from './difficulty.js';
/** SURV4: speed and agility down by this while stiff (survival/rest.js's STIFF_PENALTY, restated here so rest.js may import this module). */
const STIFF_PENALTY = 5;
import { MINUTES_PER_DAY, dateFromClassicMinutes } from '../gameDate.js';

/** RATIONS-HUNGRY: the hunger stages a sack of rations in the pack is eaten at by itself (Starving alone until
 *  2026-10-03). Peckish is not one - a sack is a full meal, and Peckish is a rumble, not a need. */
export const AUTO_EAT_STAGES = Object.freeze(['hungry', 'starving']);

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
 *  minute. DFU's own walking drain is 11 a minute for scale. The rates
 *  are the body's and the same in every tier; WHICH of them a tier
 *  charges, and how far down the pool, are its rules' `stamina`. */
export const DRAIN = Object.freeze({ heatPer20: 6, starving: 4, parched: 6, dehydrated: 12, exhausted: 8, wellFed: 64, bareFeet: 4 });
/** AUDIT SURV E: the harms that can kill come once every ten minutes,
 *  not every minute, and the bare-skin harms leave the last five
 *  points - a starting character (short shirt, casual pants, no shoes,
 *  25 health) walked a clear winter afternoon and died in two hours.
 *  Exposure past DAMAGE_AT and dehydration past THIRST_HARM can kill
 *  (SURV-THIRST1), never in your sleep - the rest gate refuses the
 *  freezing and the scorching night (rest.js) - and never inside a jump
 *  (runSurvivalMinutes: the minute lived after it is the first that may). */
export const HARM_EVERY_MINUTES = 10;
export const HEALTH_FLOOR = 5;
/** AUDIT SURV A: the well-fed hour - a point of fatigue back for every hour spent fed (the mod's 500-tally was minutes and paid twenty). */
export const WELL_FED_MINUTES = 60;
/**
 * HEARTY-MEAL (2026-10-23, the owner: "eating a meal in taverns should make you fed and not thirsty for a while (Well Fed
 * buff etc)"): A TAVERN MEAL IS A SIT-DOWN MEAL. It fills the stomach and quenches the thirst (the table pours with it),
 * and for HEARTY_MEAL_MINUTES after it neither need moves: the hunger stays Fed and the thirst stays at nought - the HUD's
 * Well Fed tile says so, its hours left on its foot (status.js survivalHudChips). `s.mealUntil`, the classic minute it
 * ends; it moves with the needs' own markers wherever the clock is stood still (pauseSurvival). A ration, a skin or a
 * fountain is no meal and grants none. A declared departure (Port-Ledger A): Climates & Calories' TavernFood fills the
 * hunger by its worth alone and pours nothing.
 */
export const HEARTY_MEAL_MINUTES = 6 * 60;
export const heartyMealHeld = (s, now) => Number.isFinite(s?.mealUntil) && s.mealUntil > now;
/** The Well Fed hold's minutes left at `now` (0 when none). */
export const heartyMealLeft = (s, now) => (heartyMealHeld(s, now) ? s.mealUntil - now : 0);
/** HEARTY-MEAL: the meal eaten at `at` (its end): quenched, and held fed and quenched till HEARTY_MEAL_MINUTES past it.
 *  The hunger's marker is the meal's own law's (tavernMenu.js tavernEat banks its worth); the hold keeps it Fed from
 *  the minute law's next minute (survivalMinute), so it leaves the hold Fed whatever the worth banked. */
export function heartyMeal(s, at) {
  s.thirst = 0;
  s.mealUntil = Math.max(Number.isFinite(s.mealUntil) ? s.mealUntil : 0, at + HEARTY_MEAL_MINUTES);
  return s;
}
/**
 * SURV-BOONS: WHAT A NEED MET EARNS, in a tier whose `boons` says so (Boons - difficulty.js). Attribute points on the
 * needs' one entry, the same door the drains leave by: Well fed while the hunger is at its first stage (a better meal
 * is a longer one - food.js satiety), Quenched while the thirst is, Well rested while a night's bank lasts, and
 * Thriving for all three at once. The order is the strip's.
 */
export const BOON = Object.freeze({
  fed: Object.freeze({ strength: 5, endurance: 5 }),
  quenched: Object.freeze({ agility: 5, speed: 5 }),
  rested: Object.freeze({ intelligence: 5, willpower: 5 }),
  thriving: Object.freeze({ luck: 5 }),
});
export const BOON_IDS = Object.freeze(['fed', 'quenched', 'rested', 'thriving', 'hearth']);
/** AUDIT SURV-BOONS C4: the boons a line is said for as they are earned - not the hearth, which every brazier in a street
 *  or a tavern raised on the way past (eleven lines an hour beside a row of them, at a full pool): its tile says it. */
export const SAID_BOONS = Object.freeze(['fed', 'quenched', 'rested', 'thriving']);
/** SURV-BOONS: the hearth - fatigue units a waking minute beside a lit fire gives back: one classic point (statMods.js
 *  FATIGUE_MULTIPLIER, AUDIT SURV-BOONS B10 - the one export, not a second 64). */
export const HEARTH_FATIGUE = FATIGUE_MULTIPLIER;
/** SURV-BOONS: Well rested - minutes banked a minute asleep in a bed or by a fire (an eight-hour night banks twelve
 *  hours), and the most a body holds. The rest window's rough sleep banks none: the bed and the fire are the go-to rest. */
export const WELL_RESTED_PER_SLEEP_MINUTE = 1.5;
export const WELL_RESTED_MAX_MINUTES = 12 * 60;
// SURV-TIERS: `FLOOR_FATIGUE = 64` stood here under "rough drains cannot
// take the last of a pool by themselves", and nothing read it. Hard's
// drains DO take the last point - the collapse that follows is the cost
// AUDIT-DEATH1 recorded as intended ("dehydration does kill; it kills
// through the collapse"). The floor is real now, as a tier's rule:
// `stamina.floor`, the share of the pool the needs may not take - none
// in Hard, half in Casual.
export const MAX_CATCHUP_MINUTES = 2 * MINUTES_PER_DAY;
/** AUDIT C&C (2026-10-12): a ROAD - a jump of more than this that is not a rest (a fast travel, a training, a span the
 *  clock was moved over) - is felt under a fair sky (runSurvivalMinutes): the weather it met is nobody's to know. */
export const ROAD_MINUTES = 60;
/** The sleep-debt stage a tier's rough night cannot pay below (difficulty.js `roughSleepFloor`), as hours of debt. */
const SLEEP_FLOOR_AT = Object.freeze({ tired: NEED.SLEEP_TIRED, drowsy: NEED.SLEEP_DROWSY, exhausted: NEED.SLEEP_EXHAUSTED });
export const NOTE_EVERY_MINUTES = 5;
/** AUDIT C&C N6: a stage line (or a recovery's) heard within this many minutes of the character's clock is not said
 *  again - half an hour, two and a half minutes of play. A body at a fire's edge, stepping in and out of its reach,
 *  worsened its stage on every step out and heard the line each time: twenty lines an hour in a Hard snow, eleven of
 *  them "Your teeth are chattering uncontrollably!". The mod paces every line it says (txtIntervals); this is the
 *  port's pace for the lines it says once. */
export const STAGE_REPEAT_MINUTES = 30;
const heardLately = (s, key, now) => Number.isFinite(s.notes[key]) && now >= s.notes[key] && now - s.notes[key] < STAGE_REPEAT_MINUTES;

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
  wakingEnd: 'The salts wear off, and your weariness comes back all at once.',   // REST6
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
  // WARM-SAID (FIELD BUGS 2026-09-30): the way out of the red, said once (stageNote's recoveryNote)
  cooling: 'You are cooling down.',
  warming: 'You are warming up.',
  dried: 'You have dried off.',
  nakedCold: 'The cold air numbs your bare skin.',
  bareFeetCold: 'Your bare feet are freezing.',
  bareFeetHot: 'Your bare feet are getting burned.',
  sunburn: 'The sun burns your bare skin.',
  armorHot: 'Your armor is starting to heat up.',
  armorCold: 'Your armor is getting cold.',
  rust: (name) => `Your ${name} is getting rusty...`,
  rot: 'Your food is getting a bit ripe...',
  repaid: 'You feel your strength returning.',   // AUDIT SURV-TIERS: a tier that repays - the need met, what it borrowed comes back
  ateRations: 'You eat some rations.',
  emptiedRations: 'You empty your sack of rations.',
  // SURV-BOONS: a boon earned, said once until it lapses
  boon: Object.freeze({
    fed: 'You feel well fed.',
    quenched: 'Your thirst is quenched.',
    rested: 'You feel well rested.',
    thriving: 'You are in fine form.',
  }),
});

/** The felt temperature's context for a body: the host's (`base` - race, resistances, the curses: env.js survivalCtx),
 *  the record's wetness, a drink to hand, and the wardrobe's warmth, weatherproofing and degrees (`mods`, the entity's
 *  folded channels by default - LOOT14/LOOT15). TEMP-UI: ONE CONSTRUCTION SEAM - the minute law and the pack's live
 *  reading (env.js feltNow) build it here, so the reading the pack shows is the one the next minute charges. */
export function feltCtx(entity, s, base = null, mods = entity?._mods) {
  return { ...(base ?? {}), wet: s?.wet ?? 0, hasWater: !!findDrink(entity?.items ?? []), ...wardrobeCtx(mods) };
}
/** AUDIT SURV-TIERS (the second pass): whether a lit fire answers the cold - in a tier whose `fireWarms` says so (Casual,
 *  Boons), beside a fire, on a reading under nought. AUDIT C&C S9: ONE LAW - the minute law writes it on the record
 *  (`s.warmed`) and the HUD reads it off the live reading (survival/status.js), so the two never disagree. */
export const warmedByFire = (rules, env, felt) => !!((rules ?? HARD_RULES).stamina.fireWarms && env?.byFire && felt < 0);

/** A fresh record at `now`: just fed, watered, dry and awake. */
export function newSurvival(now = 0) {
  return { lastAte: now - 10, thirst: 0, wet: 0, sleepDebt: 0, awakeSince: now, exposure: 0, fed: 0, drunk: 0, rotMinutes: 0, rotDays: 0, stiffUntil: 0, notes: {} };   // SURV4: stiffUntil, the rough night's morning
}
/** The entity's record, made if missing. */
export function survivalOf(entity, now = 0) {
  if (!entity.survival || typeof entity.survival !== 'object') entity.survival = newSurvival(now);
  const s = entity.survival;
  s.notes ??= {};
  // AUDIT TEMP-UI E12: a counter that is no number (a record from an older build, a hand edit) is the fresh record's -
  // a missing `wet` made every felt reading NaN for the session, and the guards on it hid the chip without a word
  if (![s.lastAte, s.thirst, s.wet, s.sleepDebt, s.awakeSince, s.exposure, s.fed, s.drunk, s.rotMinutes, s.rotDays].every(Number.isFinite)) {
    for (const [k, v] of Object.entries(newSurvival(now))) if (typeof v === 'number' && !Number.isFinite(s[k])) s[k] = v;
  }
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
 *  (the caller clamps against the permanent stat). SURV-TIERS: the
 *  needs' drains are the tier's `attributes`; the drink's swing is
 *  every tier's - it is chosen at a bar, not a need left unmet. */
/** REST6 (Rest-Arc.md section 6): the Waking Salts' hour - the sleep need's penalties held while `wakingUntil` is ahead
 *  of the character's clock, the debt still growing; when it ends WAKING_DEBT_HOURS more land at once (systems/
 *  restItems.js useSalts sets it). */
export const WAKING_DEBT_HOURS = 2;
export const wakingHeld = (s, now) => Number.isFinite(s?.wakingUntil) && s.wakingUntil > now;
/** Each minute: the salts' end lands their debt once. Answers whether it landed. */
export function landWakingDebt(s, now) {
  if (!Number.isFinite(s?.wakingUntil) || s.wakingUntil <= 0 || now < s.wakingUntil) return false;
  s.wakingUntil = 0;
  s.sleepDebt = Math.min(NEED.SLEEP_DEBT_MAX, (s.sleepDebt ?? 0) + WAKING_DEBT_HOURS);
  return true;
}

/** SLEEP PAYS ITS DEBT BY ITS QUALITY: `minutes` asleep `sleeping` ('bed' | 'camp' | 'rough') take what they pay off the
 *  record's debt, never below the tier's rough floor, and the sleeper is awake from `now`. The minute law pays its
 *  minute here; REST-SLEEP1's short rest (systems/rest/restAct.js sleepShortRest) a night's minutes at once, no clock moving. */
export function paySleep(s, sleeping, minutes, now, rules = HARD_RULES) {
  const rate = sleeping === 'rough' ? 0.5 : 1.5;   // hours of debt per hour asleep
  const floor = sleeping === 'rough' ? SLEEP_FLOOR_AT[rules.roughSleepFloor] ?? 0 : 0;   // SURV-TIERS: Hard's rough night never pays below tired; Casual's pays down to nothing
  const next = s.sleepDebt - rate * minutes / 60;
  s.sleepDebt = s.sleepDebt >= floor ? Math.max(floor, next) : Math.max(0, next);   // AUDIT SURV A: the floor holds from above and never lifts a rested sleeper up to it
  s.awakeSince = now;
  // SURV-BOONS: a night in a bed or by a fire banks Well rested, in a tier that rewards - both payers (the minute law's
  // night and REST-SLEEP1's short rest) come through here
  if (rules?.boons && sleeping !== 'rough' && minutes > 0) s.wellRested = Math.min(WELL_RESTED_MAX_MINUTES, (s.wellRested ?? 0) + WELL_RESTED_PER_SLEEP_MINUTE * minutes);
}

/**
 * SURV-BOONS: THE BOONS A BODY HAS EARNED, in the strip's order - pure, off the record. A vampire has no need for
 * food, drink or sleep (the minute law freezes them), so it earns none of theirs; the hearth is anyone's, and is the
 * minute law's to say (`hearth`, a waking minute beside a lit fire).
 */
export function survivalBoons(s, now, { vampire = false, hearth = false } = {}) {
  const out = [];
  if (!vampire) {
    if (hungerStage(hungerMinutes(s, now)) === 'fed') out.push('fed');
    if (thirstStage(s.thirst ?? 0) === 'fine') out.push('quenched');
    if (s.wellRested > 0 && sleepStage(s.sleepDebt ?? 0) === 'rested') out.push('rested');   // AUDIT SURV-BOONS A1: a bank beside an unpaid debt is no rest - a short night from Exhausted woke Well rested (and Thriving) under an Exhausted chip
    if (out.length === 3) out.push('thriving');
  }
  if (hearth) out.push('hearth');
  return out;
}

export function survivalStatMods(s, temp, now, { endurance = 50, rules = HARD_RULES, vampire = false, beast = false } = {}) {
  const mods = {};
  const sub = (keys, n) => { if (n > 0) for (const k of keys) mods[k] = (mods[k] ?? 0) - n; };
  const ALL = ['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed'];
  if ((rules ?? HARD_RULES).attributes) {   // AUDIT SURV-TIERS: null is no rules too, as in every other law
    // AUDIT SURV-TIERS (the third pass): a VAMPIRE has no need for food, drink or sleep (the minute law calls them
    // fed and freezes the thirst and the debt; the page says so) - and these read the frozen markers, so a Hard
    // vampire lost two from every attribute but luck a day to a hunger it cannot have, down to twenty. Since SURV1.
    const starve = vampire || beast ? 0 : starvingDays(hungerMinutes(s, now));   // AUDIT C&C N4: the beast is fed, as the mod's
    if (starve > 0) sub(ALL, Math.min(20, starve * 2));
    if (temp && temp.abs > NEED.EXPOSURE_AT) sub(ALL, Math.trunc(Math.min(s.exposure, temp.abs - NEED.EXPOSURE_AT) / 4));
    if (!vampire && !beast && s.thirst >= NEED.DEHYDRATED) sub(ALL, Math.trunc((s.thirst - 90) / 10));
    const sleep = vampire || wakingHeld(s, now) ? 'rested' : sleepStage(s.sleepDebt);   // REST6: the salts hold the penalties
    if (sleep === 'tired') sub(ALL, 2); else if (sleep === 'drowsy') sub(ALL, 5); else if (sleep === 'exhausted') sub(ALL, 10);
    if (Number.isFinite(s.stiffUntil) && now < s.stiffUntil) sub(['speed', 'agility'], STIFF_PENALTY);   // SURV4: the rough night's morning
  }
  // SURV-BOONS: the boons the minute granted (the record's `boons`, written by the law before this is read), in a tier
  // that rewards - the hearth is stamina, not an attribute, and has no row here
  if ((rules ?? HARD_RULES).boons) for (const id of s.boons ?? []) for (const [k, n] of Object.entries(BOON[id] ?? {})) mods[k] = (mods[k] ?? 0) + n;
  if (s.drunk > endurance / 2) {
    const d = Math.trunc((s.drunk - endurance / 2) / 10);
    sub(['agility', 'intelligence', 'willpower', 'speed'], d);
    mods.personality = (mods.personality ?? 0) + Math.min(5, d + 1);   // the drink makes you a little friendlier (AUDIT SURV A: +1..+5 rising with the drink, never the +20 that paid for itself)
  }
  return mods;
}

/** Write the map onto the entity's one 'survival' effect entry (made
 *  or removed as needed) and cap each drain so the stat stays at five.
 *  AUDIT SURV-TIERS: FIVE LIVE, NOT FIVE PERMANENT. The cap read the
 *  permanent stat alone, and every other drain stacks on top in the live
 *  one (statMods.js liveStat) - a Drain Agility spell at a live 4 and the
 *  drink's -5 made a live 0, and a live zero kills (worldTick.js
 *  killIfAnyLiveStatZero): a tavern ale killed a Casual player. The
 *  floor is five of whichever is lower, the permanent stat or the live
 *  one without this entry, so a fortified stat drains no further than
 *  it ever did and a drained one is never taken past five. */
export function applySurvivalMods(entity, mods) {
  const list = entity.activeEffects ??= [];
  let entry = list.find((a) => a?.kind === 'survival');
  const capped = {};
  let any = false;
  for (const k of STAT_KEYS_ORDER) {
    const m = mods[k] ?? 0;
    if (m === 0) continue;
    const perm = entity.stats?.[k] ?? 0;
    const floorAt = Math.min(perm, liveStat(entity, k, 'survival'));
    capped[k] = m < 0 ? -Math.min(-m, Math.max(0, floorAt - 5)) : m;
    if (capped[k] !== 0) any = true;
  }
  if (!any) { if (entry) list.splice(list.indexOf(entry), 1); return null; }
  if (!entry) { entry = { kind: 'survival', statMods: {} }; list.push(entry); }
  entry.statMods = capped;
  return entry;
}

/** AUDIT SURV-TIERS: the record's loan held to `room` (the pool's shortfall) - each need's share cut in proportion,
 *  whole units, and a need owed nothing leaves the record. */
export function settleLoan(s, room) {
  const b = s.borrowed;
  let total = 0;
  for (const k of Object.keys(b)) total += b[k];
  if (total <= room) return;
  for (const k of Object.keys(b)) { b[k] = Math.floor((b[k] * room) / total); if (!(b[k] > 0)) delete b[k]; }
  if (!Object.keys(b).length) delete s.borrowed;
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
 * AUDIT SURV-TIERS (the third pass): A STAGE LINE IS SAID WHEN THE STAGE
 * WORSENS - reached from a milder one, or from none - and never on the way
 * back. Each stage was a note of its own, cleared the moment another took
 * over, so every stage passed through spoke: a sleep paying off Exhausted
 * announced "You are drowsy" and a yawn, a cup of milk from Dehydrated
 * said "You are getting thirsty", and a warming morning said the cold was
 * seeping in. `s.notes[family]` holds the stage last reached; a stage on
 * the other side (the cold after the heat) is a new one. A jump's
 * replayed minutes leave it alone, so the minute the player lands in says
 * the net change, once (runSurvivalMinutes).
 */
const STAGE_SEVERITY = Object.freeze({
  wet: Object.freeze({ damp: 1, wet: 2, soaked: 3, drenched: 4 }),
  hunger: Object.freeze({ peckish: 1, hungry: 2, starving: 3 }),
  thirst: Object.freeze({ thirsty: 1, parched: 2, dehydrated: 3 }),
  sleep: Object.freeze({ tired: 1, drowsy: 2, exhausted: 3 }),
  temp: Object.freeze({ cold: -1, freezing: -2, deadly: -3, warm: 1, hot: 2, scorching: 3 }),
});
/**
 * FIELD BUGS 2026-09-30 (WARM-SAID; #bug-reports, "Climates & Calories
 * Bugs": "your temperature gets to either "Scorching" or "Freezing" or
 * "Soaked" etc and seems to never recover"): THE WAY OUT OF THE RED IS
 * SAID, ONCE. The rule above is right for the stages and left every
 * recovery unsaid: the cold seeping into your bones was said and its
 * going never was, and a drenching dried without a word. Leaving a red
 * temperature (scorching, freezing, deadly cold - Casual's strip's danger
 * words; AUDIT C&C S5: each tier's strip paints its own band, and these
 * lines keep to the extremes) for any stage that is not red says "You are cooling down." or
 * "You are warming up."; a soaking or a drenching dried all the way says
 * "You have dried off." Each is said once a recovery - the temperature
 * at its first stage out of the red, the wet at dry (its way down passes
 * wet and damp) - and the improving stages stay silent. `s.notes` keeps
 * the red stage last reached under '<family>:red'; stageNote asks after
 * the replay gate, so a jump's landing says the net recovery. A declared
 * departure (Port-Ledger A): the mod speaks no recovery.
 */
const RECOVERY = Object.freeze({
  temp: Object.freeze({ from: Object.freeze({ scorching: 'cooling', freezing: 'warming', deadly: 'warming' }), atDry: false }),
  wet: Object.freeze({ from: Object.freeze({ soaked: 'dried', drenched: 'dried' }), atDry: true }),
});
function recoveryNote(s, family, stage, say, now) {
  const r = RECOVERY[family];
  if (!r) return;
  const key = `${family}:red`;
  if (stage && r.from[stage]) { s.notes[key] = stage; return; }
  const from = s.notes[key];
  if (!from || (r.atDry && stage)) return;
  delete s.notes[key];
  const heard = `${family}@${r.from[from]}`;   // AUDIT C&C N6: a recovery heard lately is not said again
  if (heardLately(s, heard, now)) return;
  s.notes[heard] = now;
  say?.(SURVIVAL_TEXT[r.from[from]]);
}
function stageNote(s, family, stage, say, text, replay, now) {
  if (replay) return;
  const was = s.notes[family];
  recoveryNote(s, family, stage, say, now);   // WARM-SAID: the way out of the red, said once
  if (!stage) { delete s.notes[family]; return; }
  if (stage === was) return;
  const sev = STAGE_SEVERITY[family], at = sev[stage] ?? 0, before = was ? sev[was] ?? 0 : 0;
  // AUDIT C&C N6: and not again while the stage's line was heard lately (STAGE_REPEAT_MINUTES)
  const heard = `${family}@${stage}`;
  if ((Math.sign(at) !== Math.sign(before) || Math.abs(at) > Math.abs(before)) && !heardLately(s, heard, now)) { s.notes[heard] = now; say?.(text); }
  s.notes[family] = stage;
}

/**
 * ONE WORLD MINUTE of the needs.
 *
 * @param {object} entity   the player (stats, raceId, items, activeEffects, fatigue)
 * @param {number} now      the classic minute this step lands on
 * @param {object} env      the host's environment (see feltTemperature) plus:
 *                          resting, sleeping ('bed'|'camp'|'rough'|null), swimming, transport
 * @param {object} deps     { worn, ctx, sinks: { drainFatigue, restoreFatigue, hurt, say }, rolls, autoDrink, autoEat, collections,
 *                          rules (the tier's - survival/difficulty.js; Hard when absent) }
 * @returns the felt temperature record for the HUD and the status page
 */
export function survivalMinute(entity, now, env = {}, deps = {}) {
  const s = survivalOf(entity, now);
  const { worn = null, sinks = {}, rolls = Math.random, autoDrink = true, autoEat = true, replay = false, landing = false } = deps;   // AUDIT TEMP-UI E6: `landing`, the minute a jump lands in
  const rules = deps.rules ?? HARD_RULES;   // AUDIT SURV-TIERS: null is no rules too - survivalRules() answers null for Off
  const say = sinks.say ?? deps.say ?? null;
  const items = entity.items ?? [];
  const ctx = feltCtx(entity, s, deps.ctx);   // LOOT14/LOOT15: the wardrobe's warmth, weatherproofing and degrees
  const temp = feltTemperature(env, worn, ctx);
  const resting = !!env.resting;
  const sleeping = env.sleeping ?? null;
  const vampire = !!ctx.vampire;
  // AUDIT C&C N4: A BODY THAT DOES NOT EAT DOES NOT HUNGER. A vampire has no need for food or sleep and a beast in its
  // form eats as it hunts (the mod's Hunger.cs Starvation reads a beast fed, its thirst line skips one - and a
  // vampire's sleep, Sleep.cs): the minute law called them fed, and the timestamps that ARE hunger and wakefulness ran
  // on under them - a vampire cured after ten days was Starving and 240 hours awake in its first minute. Both stand
  // still while the need does, as Off's do (pauseSurvival): the minutes since the last paid one are carried.
  const beast = !!ctx.beastForm;
  const step = Number.isFinite(s.lastMinute) ? Math.max(0, now - s.lastMinute) : 0;
  if ((vampire || beast) && step > 0 && Number.isFinite(s.lastAte)) s.lastAte += step;
  if (vampire && step > 0 && Number.isFinite(s.awakeSince)) s.awakeSince += step;
  // SURV-TIERS: THE ONE DOOR THE NEEDS' STAMINA LEAVES BY. A tier with no
  // floor (Hard) hands every charge to the sink as it always did; a tier
  // with one (Casual, half the pool) spends only what lies above it, read
  // at the minute's first charge - after the well-fed hour's refund - and
  // counted down here, so two needs in one minute share one budget
  // whatever the sink does with them. AUDIT SURV-TIERS: in a tier that
  // repays, what each need takes is written to `borrowed` under the need's
  // name, and handed back below when the need is met.
  const floorShare = rules.stamina.floor;
  const repays = !!rules.stamina.repaid;
  let budget = null;
  const tire = (n, need) => {
    if (!(n > 0) || floorShare >= 1) return;   // AUDIT SURV-BOONS A4/D1: a floor of the whole pool takes NOTHING - read against a pool that had just shrunk (Well fed lapsing, a Fortify's end), the budget drained the fatigue above the new ceiling
    let d = n;
    if (floorShare > 0) {
      budget ??= Math.max(0, (entity.fatigue ?? 0) - Math.floor(maxFatigue(entity) * floorShare));
      d = Math.min(n, budget);
      if (!(d > 0)) return;
      budget -= d;
    }
    sinks.drainFatigue?.(d);
    if (repays) { const b = (s.borrowed ??= {}); b[need] = (b[need] ?? 0) + d; }
  };
  // A tier without the attribute costs carries no stiff morning either: a
  // Hard night's stiffness lifts the minute the player turns to Casual, so
  // the HUD's Stiff chip never names a cost the tier does not charge. And a
  // tier that does not repay carries no loan (Casual to Hard: Hard keeps
  // what it takes, and so keeps what was taken).
  if (!rules.attributes && s.stiffUntil) s.stiffUntil = 0;
  if (!repays && s.borrowed) { delete s.borrowed; delete s.loanPool; }
  // SURV-BOONS: and a tier that does not reward carries no boon - the bank and the last minute's grant go, with the
  // lines that said them, so a return to Boons says each again as it is earned
  if (!rules.boons && ('boons' in s || 'wellRested' in s)) { delete s.boons; delete s.wellRested; for (const id of BOON_IDS) delete s.notes[`boon:${id}`]; }
  // AUDIT SURV-TIERS (the second pass): A LOAN IS NEVER MORE THAN THE POOL IS SHORT. A bed, a potion, the fed
  // hour or the collapse's hour refills the pool without meeting the need - and the loan stayed owed, so the meal
  // after paid it AGAIN: a player who slept starving banked a pool of stamina a day and ate it mid-fight. Whatever
  // refilled the pool has paid that much of the loan, so it is settled down to the pool's shortfall here, before
  // the minute charges anything (each charge then adds to both alike).
  // AUDIT SURV-TIERS (the third pass): ...AND ONLY BY A REFILL. A pool whose CEILING fell - a Drain on endurance, a
  // ring of strength taken off, a Fortify's end - had its loan cut as if refilled, and what the need took never came
  // back when the need was met. The settle runs when the pool has RISEN since the last minute left it (`loanPool`,
  // the fed hour's refund counted as the rise it is); a pool that only shrank still owes the loan, and the repayment
  // below never fills past the ceiling.
  if (repays && s.borrowed && !((entity.fatigue ?? 0) <= (s.loanPool ?? -Infinity))) settleLoan(s, Math.max(0, maxFatigue(entity) - (entity.fatigue ?? 0)));

  // WET: rain and water raise it; warmth dries it, a fire dries it fast.
  s.wet = Math.min(NEED.WET_MAX, s.wet + temp.wetGain);
  if (temp.wetGain <= 0) {
    let dry = temp.air > 10 ? Math.trunc(temp.air / 10) : 1;   // AUDIT C&C T1: the air dries the clothes - a Resist Fire made a Soaked shirt at an Alik'r noon take six times as long
    if (env.byFire || env.insideBuilding || env.sheltered) dry += 2;   // AUDIT C&C I2: and at rest in a tent, the mod's camp arm
    s.wet = Math.max(0, s.wet - dry);
  }
  const wetNow = wetStage(s.wet);
  stageNote(s, 'wet', wetNow === 'dry' ? null : wetNow, say, SURVIVAL_TEXT[wetNow], replay, now);

  // HEARTY-MEAL: a tavern meal's hold - the stomach stays full and the cup stays full while it lasts
  const hearty = heartyMealHeld(s, now);
  if (hearty) { s.lastAte = Math.max(s.lastAte ?? now, now - 10); s.thirst = 0; }
  // HUNGER: the marker stands; the tallies move.
  const hunger = hungerMinutes(s, now);
  const hungerNow = vampire || beast ? 'fed' : hungerStage(hunger);   // AUDIT C&C N4: the beast's too, as the mod's
  let refunded = 0;   // AUDIT SURV-TIERS (the third pass): the fed hour's refund is a refill the loan is settled by (loanPool)
  if (hungerNow === 'fed' && !vampire) { s.fed += 1; if (s.fed >= WELL_FED_MINUTES) { s.fed = 0; sinks.restoreFatigue?.(DRAIN.wellFed); refunded = DRAIN.wellFed; } }
  // RATIONS-HUNGRY (2026-10-03, Mac: "With C&C let it auto consume any rations in inventory when hungry"): a sack in
  // the pack is eaten as the player turns Hungry, not left until they starve - the Hungry line never said over food
  if (AUTO_EAT_STAGES.includes(hungerNow) && autoEat) {
    const sack = items.find((i) => i.templateIndex === TEMPLATE.Rations && isFood(i));
    if (sack) { eatRations(entity, sack, now, say); }
  }
  const hungerAfter = vampire || beast ? 'fed' : hungerStage(hungerMinutes(s, now));
  stageNote(s, 'hunger', hungerAfter === 'fed' ? null : hungerAfter, say, SURVIVAL_TEXT[hungerAfter], replay, now);
  if (hungerAfter === 'starving' && !resting) tire(DRAIN.starving, 'hunger');

  // THIRST: the heat drives it; a skin in the pack answers it.
  let thirstRed = false;   // AUDIT SURV-TIERS: the stage a repaying tier charges (and repays when it lifts)
  if (!vampire && !beast) {   // AUDIT C&C N4: the beast drinks as it hunts - the mod's thirst line skips its form
    // AUDIT C&C N8: the base rate in the cold too - a body loses water in any weather, as the mod's rises at its least
    // (`Math.Max(totalTemp - 10, 1)`); a floor meant to halve it there sat over a factor never under one, and is gone
    const rate = hearty ? 0 : THIRST_PER_MINUTE * (1 + Math.max(0, temp.felt - 10) / 10);   // HEARTY-MEAL: no thirst while the meal holds
    s.thirst = Math.min(NEED.THIRST_MAX, s.thirst + rate);
    if (autoDrink && s.thirst >= NEED.THIRSTY) drinkWater(entity, now, say);   // AUDIT SURV E: at the stage, so the chip never blinks with a skin in the pack
    const thirstNow = thirstStage(s.thirst);
    stageNote(s, 'thirst', thirstNow === 'fine' ? null : thirstNow, say, SURVIVAL_TEXT[thirstNow], replay, now);
    thirstRed = thirstNow === 'parched' || thirstNow === 'dehydrated';
    if (!resting) {
      if (thirstNow === 'parched') tire(DRAIN.parched, 'thirst');
      else if (thirstNow === 'dehydrated') tire(DRAIN.dehydrated, 'thirst');
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
    // temperature harm below uses. Nothing in `systems/rest/rest.js` refuses a
    // rest for thirst, so a sleeper who could not wake to drink would be
    // killed by a window they were allowed to open.
    //
    // AND NOT DEAD INSIDE A JUMP. `runSurvivalMinutes` replays every
    // minute a clock jump crossed - a fast travel, a rest, a training
    // session - so six game-hours of travel is thirty-six harm ticks in
    // one frame, which took a starting character from full health to
    // dead ON ARRIVAL. A replayed minute may wound to the floor and no
    // further, and so may the minute a jump lands in (AUDIT TEMP-UI E6);
    // the first minute lived after the landing is the one that may finish
    // them. So a thirsty journey still lands you at death's door, and the
    // next minute you do not drink is the one that kills - which is the
    // behaviour asked for, without the arrival being a coin flip.
    //
    // SURV-TIERS: and only in a tier that wounds (Hard). Casual's
    // dehydration is the stamina above and nothing more.
    if (rules.health && s.thirst >= NEED.THIRST_HARM && !sleeping && !resting && now % HARM_EVERY_MINUTES === 0) {
      const bite = Math.max(1, Math.trunc((s.thirst - NEED.THIRST_HARM + 10) / 10));
      if (!replay && !landing) sinks.hurt?.(bite);
      else if ((entity.health ?? 0) > HEALTH_FLOOR) sinks.hurt?.(Math.min(bite, (entity.health ?? 0) - HEALTH_FLOOR));
    }
  }

  // SLEEP: the debt grows past the free hours; sleep pays it by quality.
  let sleepRed = false;
  if (!vampire) {
    if (landWakingDebt(s, now)) say?.(SURVIVAL_TEXT.wakingEnd);   // REST6: the salts' hour is over
    if (sleeping) {
      paySleep(s, sleeping, 1, now, rules);
    } else if (awakeHours(s, now) > NEED.AWAKE_FREE_HOURS) {
      s.sleepDebt = Math.min(NEED.SLEEP_DEBT_MAX, s.sleepDebt + 1 / 60);
    }
    const sleepNow = sleepStage(s.sleepDebt);
    stageNote(s, 'sleep', sleepNow === 'rested' ? null : sleepNow, say, SURVIVAL_TEXT[sleepNow], replay, now);
    sleepRed = sleepNow === 'exhausted';
    if (sleepNow === 'exhausted' && !resting && !wakingHeld(s, now)) tire(DRAIN.exhausted, 'sleep');   // REST6: held while the salts last
  }

  // TEMPERATURE: the body pays for the heat and the cold.
  // AUDIT C&C T9 - THE ROOF'S CHARGE, a declared departure (Port-Ledger A): under a roof too. The mod's "inside or
  // camping" arm charges no temperature at all; the port's roof softens the reading (temperature.js
  // naturalTemperature, ROOF-SHELTER) rather than ending it, so a red reading indoors costs what its tier charges.
  // SURV-TIERS: from the tier's band (Hard: twenty either way; Casual: the red words only), and it wounds only in a
  // tier that wounds. AUDIT SURV-TIERS: and a rest away from a fire pays it only in a tier whose `duringRest` says so
  // (Hard, whose gate refuses the worst of it). Casual has no gate, so a Casual rest in a blizzard charged the band
  // faster than DFU's hour restored it: the sleeper woke more tired than they lay down, and a rest until healed
  // never ended. In Casual a rest is a rest.
  const abs = temp.abs;
  if (abs > NEED.EXPOSURE_AT) s.exposure = Math.min(s.exposure + 1, 600); else s.exposure = Math.max(0, s.exposure - 2);
  const harmTick = now % HARM_EVERY_MINUTES === 0;
  const hurtFloored = (n) => { if ((entity.health ?? 0) > HEALTH_FLOOR) sinks.hurt?.(n); };
  // AUDIT SURV-TIERS (the second pass): and in a tier whose `fireWarms` says so (Casual), a lit fire answers the cold
  // outright - the fire's fifteen degrees alone left a camper in a snowstorm Deadly cold beside it, charged, and the
  // cold's loan never repaid. The felt reading stays the world's; the body is warm.
  const warmed = warmedByFire(rules, env, temp.felt);   // AUDIT C&C S9: the one law the HUD reads live too
  if (warmed) s.warmed = true; else if (s.warmed) delete s.warmed;   // AUDIT SURV-TIERS (the third pass): the strip's word for it (status.js)
  const tempRed = !warmed && (temp.felt >= rules.stamina.hotFrom || temp.felt <= rules.stamina.coldFrom);
  if (!resting || !env.byFire) {
    if (tempRed && (!resting || rules.stamina.duringRest)) tire(DRAIN.heatPer20 * Math.trunc(abs / 20), 'temp');
    // AUDIT SURV-TIERS (the second pass): SURV-THIRST1's law for a harm that can kill (above), which this one never
    // had - a REPLAYED minute (a jump) and the one a jump lands in wound to the floor and no further (AUDIT TEMP-UI E6),
    // and the first minute lived after may finish them. A cautious fast travel through a summer desert healed the traveller whole and then replayed the
    // trip's heat as waking minutes: dead on arrival, in Hard, since SURV1.
    if (rules.health && abs > NEED.DAMAGE_AT && !sleeping && harmTick) {
      const bite = Math.max(1, Math.trunc((abs - 40) / 10));
      if (!replay && !landing) sinks.hurt?.(bite);
      else if ((entity.health ?? 0) > HEALTH_FLOOR) sinks.hurt?.(Math.min(bite, (entity.health ?? 0) - HEALTH_FLOOR));
    }
  }
  // AUDIT SURV A/E: the strip's own words (temperature.js temperatureWord), one note a word said once - an escalation
  // speaks at once and a held reading never repeats (a cold afternoon said three lines every five minutes)
  const word = tempStage(temp.felt);
  stageNote(s, 'temp', word && !(env.insideDungeon && word === 'warm') ? word : null, say, SURVIVAL_TEXT[word], replay, now);

  // BARE SKIN: naked in the cold, bare feet, the sun on uncovered skin.
  // AUDIT SURV E: never asleep or sat resting (the bedroll and the fire), once every ten minutes, never the last five points;
  // bare feet cost fatigue, not blood. Each line is said once and again only after it lifted.
  // SURV-TIERS: the lines are the world's and said in every tier; the wound and the barefoot tax are the tier's. In
  // Casual the cold and the sun on bare skin are already in the felt temperature the band above charges.
  let naked = false, sun = false, feet0 = false;
  if (!env.insideBuilding && !vampire && !ctx.beastForm && !sleeping && !resting) {
    const chest = worn?.[17] ?? null, chestArmor = worn?.[18] ?? null, legs = worn?.[24] ?? null, legsArmor = worn?.[23] ?? null, feet = worn?.[26] ?? null;
    const bareTop = !chest && !chestArmor && !temp.cloak, bareLegs = !legs && !legsArmor && !temp.cloak;
    if ((bareTop || bareLegs) && temp.natTemp < -10) { naked = true; if (harmTick && rules.health) hurtFloored(1); note(s, 'naked', now, say, SURVIVAL_TEXT.nakedCold, { once: true }); }
    if ((bareTop || bareLegs) && env.inSunlight && temp.natTemp > 10 && env.weather !== 'overcast' && ctx.raceId !== 8 && ctx.raceId !== 4) {
      sun = true;
      if (harmTick && rules.health) hurtFloored(1);
      note(s, 'sun', now, say, SURVIVAL_TEXT.sunburn, { once: true });
    }
    // AUDIT C&C D5: the mod's FeetDmg - the NATURAL temperature (resisted, before the clothes: a robe and a cloak shoe
    // no foot) past half the LIVE endurance (LiveEndurance: a Fortify hardens them), on foot, out of the water, never
    // inside (PlayerEnterExit.IsPlayerInside - a dungeon is inside). The port had read the felt temperature against the
    // permanent endurance, underground too.
    if (!feet && !env.transport && !env.insideDungeon && Math.abs(temp.natTemp) > liveStat(entity, 'endurance') / 2 && !env.swimming && !env.wading) {
      feet0 = true;
      if (rules.stamina.bareFeet) tire(DRAIN.bareFeet, 'feet');
      note(s, 'feet', now, say, temp.natTemp > 0 ? SURVIVAL_TEXT.bareFeetHot : SURVIVAL_TEXT.bareFeetCold, { once: true });
    }
  }
  if (!naked) clearNote(s, 'naked'); if (!sun) clearNote(s, 'sun'); if (!feet0) clearNote(s, 'feet');
  if (temp.metal > 5) note(s, 'armor:hot', now, say, SURVIVAL_TEXT.armorHot, { once: true }); else clearNote(s, 'armor:hot');
  if (temp.metal < -5) note(s, 'armor:cold', now, say, SURVIVAL_TEXT.armorCold, { once: true }); else clearNote(s, 'armor:cold');

  // RUST: a wet metal piece loses a point on a 5% minute - in a tier that rusts (Hard; Casual takes no item's condition).
  // AUDIT C&C I2: and only where the mod rolls it - its ArmorDmg is in the arm "If not camping, bed sleeping or
  // traveling": never at rest and never under a roof. A sleeper in a tent in the rain rusted all night.
  if (rules.rust && !resting && !env.insideBuilding && s.wet > NEED.WET_DAMP && worn && rolls() < 0.05) {
    const metal = [18, 23, 12, 13, 15, 26, 20].map((k) => worn[k]).filter((i) => i && i.group === 'Armor' && ((i.material ?? 0) & 0x0f00) !== 0);
    if (metal.length) {
      const piece = metal[Math.floor(rolls() * metal.length)];
      const loss = Math.max(1, Math.trunc((piece.maxCondition ?? 100) / 100));
      piece.currentCondition = Math.max(0, (piece.currentCondition ?? piece.maxCondition ?? 0) - loss);   // AUDIT SURV A: the port's field (mintCondition's), not a phantom `condition`
      if (piece.currentCondition < (piece.maxCondition ?? 0) / 10) note(s, 'rust', now, say, SURVIVAL_TEXT.rust(piece.name ?? 'armor'));
    }
  }

  // ROT: the day counter turns with the heat; each day rolls every food.
  s.rotMinutes += rotWeight(temp.air);   // AUDIT TEMP-UI E3: the air the food is carried in - a dungeon's, underground
  if (s.rotMinutes >= ROT_DAY_MINUTES) {
    s.rotMinutes -= ROT_DAY_MINUTES;
    s.rotDays += 1;
    // AUDIT BAG1 B7: and the Materials Bag's - food carried in it never rotted, a larder with no clock
    const spoiled = rotFoodDay(deps.collections ?? [items, entity.wagonItems, entity.otherItems, entity.bagItems], s.rotDays, rolls);
    if (spoiled > 0) note(s, 'rot', now, say, SURVIVAL_TEXT.rot);
  }

  // DRUNK: one off every ten minutes.
  if (s.drunk > 0 && now % 10 === 0) s.drunk = Math.max(0, s.drunk - 1);

  // AUDIT SURV-TIERS: THE LOAN COMES BACK WITH THE ANSWER. A tier that repays hands back what each need took the
  // minute that need leaves its costing stage - a meal the hunger's, a drink the thirst's, a sleep the exhaustion's,
  // a warm place (or a fire) the cold's - whatever the sink or the rest did in between, up to the pool. A rest
  // pauses the charge, not the need: a starving sleeper is repaid when fed, not when lying down.
  if (repays && s.borrowed) {
    const met = { hunger: hungerAfter !== 'starving', thirst: !thirstRed, sleep: !sleepRed, temp: !tempRed, feet: !feet0 };
    let back = 0;
    for (const k of Object.keys(s.borrowed)) if (met[k]) { back += s.borrowed[k]; delete s.borrowed[k]; }
    if (!Object.keys(s.borrowed).length) delete s.borrowed;
    const give = Math.min(back, Math.max(0, maxFatigue(entity) - (entity.fatigue ?? 0)));
    if (give > 0) { sinks.restoreFatigue?.(give); note(s, 'repaid', now, say, SURVIVAL_TEXT.repaid); }
  }
  if (s.borrowed) s.loanPool = (entity.fatigue ?? 0) - refunded; else if ('loanPool' in s) delete s.loanPool;

  // SURV-BOONS: A BODY KEPT EARNS (Boons - difficulty.js). The bank of Well rested is spent a waking minute at a time;
  // a lit fire beside a waking player gives a point of stamina back each minute, up to the pool (the rest window by a
  // fire is already the camp's whole rest - this is the minute it is not opened); and the minute's boons ride the
  // record, which the entry below and the strip both read, so what the strip says is what the body has. Each is said
  // once as it is earned and again only after it lapsed.
  if (rules.boons) {
    if (s.wellRested > 0 && !sleeping) s.wellRested = Math.max(0, s.wellRested - 1);
    if (!(s.wellRested > 0) && 'wellRested' in s) delete s.wellRested;
    const hearth = !!env.byFire && !resting && !sleeping && !replay;   // AUDIT SURV-BOONS A3: a jump's replayed minutes are no waking minutes by a fire - three hours' training beside a brazier cost nothing
    if (hearth) {
      const give = Math.min(HEARTH_FATIGUE, Math.max(0, maxFatigue(entity) - (entity.fatigue ?? 0)));
      if (give > 0) sinks.restoreFatigue?.(give);
    }
    s.boons = survivalBoons(s, now, { vampire, hearth });
    // AUDIT SURV-BOONS C1/A5: and said as the minute the player stands in has them - a jump's replayed minutes said boons
    // gained and lost inside it, beside the chips that said they were gone
    if (!replay) for (const id of SAID_BOONS) { if (s.boons.includes(id)) note(s, `boon:${id}`, now, say, SURVIVAL_TEXT.boon[id], { once: true }); else clearNote(s, `boon:${id}`); }
  }

  // AUDIT SURV-TIERS: the drink's bands on the LIVE endurance - the mod's LiveEndurance, the one the tavern, the HUD
  // and the status page already read (the permanent stat here put the swing out of step with the word that named it)
  applySurvivalMods(entity, survivalStatMods(s, temp, now, { endurance: liveStat(entity, 'endurance'), rules, vampire, beast }));
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
  say?.(r.empty ? SURVIVAL_TEXT.drained : r.low ? SURVIVAL_TEXT.drankLow : SURVIVAL_TEXT.drank);
  return true;
}

/** Rations: a sack feeds one meal's worth (FOOD[Rations].satiety) and
 *  the marker lands at now - 10 so a hungry or starving player is fed at once. */
export function eatRations(entity, sack, now, say = null) {
  const s = survivalOf(entity, now);
  const items = entity.items ?? [];
  s.lastAte = now - 10;   // a sack is a full meal: fed, whatever the hunger was
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
  // AUDIT UPDATE E-N5: a meal's hold that ran in the minutes a long jump never replays held them all the same
  if (Number.isFinite(s.mealUntil) && s.mealUntil > last && start > last) s.lastAte = Math.max(s.lastAte ?? last, Math.min(s.mealUntil, start) - 11);   // the last held minute's own lift (survivalMinute: now - 10)
  // SURV-THIRST1 AUDIT: WHICH MINUTE IS THE PLAYER ACTUALLY LIVING IN.
  // Every minute but the last is a REPLAY - a jump's minutes, fabricated
  // by `playerTicker.advance` (scenes/shared.js) for a fast travel, a
  // rest or a training session, all of which run this same loop. A harm
  // that may kill must not be charged hundreds of times inside one
  // frame: six game-hours of fast travel is 36 harm ticks, and that
  // killed a starting character dead on arrival. Neither a replayed
  // minute nor the one a jump lands in may finish them (AUDIT TEMP-UI E6,
  // below): the next minute lived is the first that may. ONE object,
  // mutated - this loop runs up to 2,880 times and a fresh deps per minute
  // would be 2,880 objects a jump (EV2's rule).
  if (s.offFor) delete s.offFor;   // AUDIT SURV-TIERS: the arc is on again - an Off span ends (pauseSurvival)
  // AUDIT SURV-TIERS (the third pass): AND WHAT A JUMP SAYS, IT SAYS ONCE, AS IT LANDS. Every replayed minute spoke
  // as if lived, so a three-day journey arrived with thirty lines - eighteen of them "You drink from your waterskin."
  // - and a blackout night drank from the skin while its drinker was out cold. The replay's lines are gathered, each
  // said once when the walk reaches the minute the player stands in; the stage lines wait for that minute
  // (stageNote), which says the net change.
  // AUDIT C&C (2026-10-12, E5): A JUMP'S MINUTES ARE FELT AT THEIR OWN SKY. The host reads the air once a frame, BEFORE
  // the clock moves, so a fast travel or a night's rest was felt whole at the hour it set out in - three days set out at
  // a mountain midnight froze at -60 every minute, set out at noon never met a night. Where the sky is this clock
  // (`skyFollows`: offline, worldTick.js) EVERY minute of a jump - the one it lands in too (AUDIT C&C N1/H4/R1: the
  // landing was felt at the departure's hour, so a noon departure landed Scorching at midnight and said the sun on bare
  // skin) - is felt at its own hour and month, under its own sun (temperature.js sunlit - AUDIT C&C T6/R3: a replayed
  // 01:00 had kept the noon's sun on its metal). Online the sky is the world's and stands while the character's clock
  // moves (LIVED1), so the host's reading holds. A one-minute step is no jump: it is that minute, the host's own.
  // AUDIT C&C H3/N1: AND A ROAD MEETS NO WEATHER IT CANNOT KNOW. A jump of more than ROAD_MINUTES that is not a rest - a
  // fast travel, a training, a span the clock was moved over - is felt under a fair sky, away from the fire and the
  // water it set out from: the sim rolls each day's weather at its date change, from the dice, and the departure's rain
  // held for two days landed a traveller Drenched under a clear desert sky with every steel piece rusted. A rest keeps
  // the host's weather, which its window re-reads every few minutes.
  const jump = end - start > 1;
  const sky = deps.skyFollows && jump ? { ...env } : null;
  if (sky && !env.resting && end - start > ROAD_MINUTES) Object.assign(sky, { weather: 'sunny', falling: null, byFire: false, swimming: false, submerged: false, wading: false });
  const sinks = deps.sinks ?? {};
  // AUDIT C&C N2/H1: A JUMP NEVER EMPTIES THE POOL. In Hard every replayed minute drained the live pool, and at nothing
  // the host's collapse fired from inside the replay - a nested hour and a box each time: a three-day fast travel
  // collapsed 83 times and landed 6.46 days out, and a foe near the arrival made one of them a death. A replayed minute,
  // and the one a jump lands in, leaves the pool its last point (FATIGUE_MULTIPLIER): the next minute lived is the first
  // that may collapse, as it is the first that may kill (SURV-THIRST1's floor, and E6's).
  const drainFloored = (n, a) => sinks.drainFatigue?.(Math.min(n, Math.max(0, (entity.fatigue ?? 0) - FATIGUE_MULTIPLIER)), a);
  // AUDIT C&C N2: the collapse's hour, marked by its host (markOutCold), is walked as a night on the ground
  const coldTill = Number.isFinite(s.outColdUntil) ? s.outColdUntil : -Infinity;
  const cold = coldTill > start ? { ...(sky ?? env), resting: true, sleeping: 'rough' } : null;
  const heard = [];
  const walk = { ...deps, replay: true, sinks: { ...sinks, drainFatigue: drainFloored, say: (t) => { if (!heard.includes(t)) heard.push(t); } } };
  for (let m = start + 1; m <= end; m++) {
    walk.replay = m < end;
    // AUDIT TEMP-UI E6: AND THE MINUTE A JUMP LANDS IN WOUNDS TO THE FLOOR TOO - "without the arrival being a coin flip"
    // (SURV-THIRST1) was false: a landing on a harm tick (one minute in ten) killed outright. The next minute lived is
    // the one that may kill.
    walk.landing = !walk.replay && jump;
    if (!walk.replay) { walk.sinks = jump ? { ...sinks, drainFatigue: drainFloored } : sinks; const say = sinks.say ?? deps.say; for (const t of heard) say?.(t); }
    if (sky) { sky.hour = (((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) / 60; sky.month = dateFromClassicMinutes(m).month; sky.inSunlight = sunlit(sky); }
    let at = sky ?? env;
    if (cold && m <= coldTill) { if (sky) Object.assign(cold, { hour: sky.hour, month: sky.month, inSunlight: sky.inSunlight }); at = cold; }
    temp = survivalMinute(entity, m, at, walk);
  }
  if (end > (s.lastMinute ?? -Infinity)) s.lastMinute = end;
  if (s.outColdUntil <= end) delete s.outColdUntil;
  return temp;
}

/**
 * AUDIT C&C (2026-10-12, N2): THE COLLAPSE'S HOUR IS A NIGHT ON THE GROUND. DFU's CollapseFromExhaustion raises the clock
 * an hour with the body out cold (RaiseTime), and the four hosts' hour (CAMP-REST: "the forced hour is a rest") reached
 * the needs as an hour AWAKE - the debt that had collapsed the body grew by it, and in Hard the exhaustion drained the
 * hour through. A host marks the hour as it raises it: the `minutes` after the minute in hand (the character's own
 * clock, whichever that is) are felt as a rough sleep. The minute in hand is the tick's: a collapse fires from INSIDE
 * one - its fatigue band, or a minute's drain here, before that minute is written on the record - and the tick's marker
 * (PlayerEntity's lastGameMinutes, worldTick.js) already stands at it, where the record's last paid minute is one
 * behind: read alone, it left the raised hour's last minute awake. The needs only - DFU's own laws read the raise as DFU
 * does (worldTick.js's walking drain reads isResting, which the collapse never sets).
 */
export function markOutCold(entity, minutes = 60) {
  const s = entity?.survival;
  const marks = [s?.lastMinute, entity?.lastGameMinutes].filter(Number.isFinite);
  if (!s || typeof s !== 'object' || !marks.length) return false;
  s.outColdUntil = Math.max(Number.isFinite(s.outColdUntil) ? s.outColdUntil : -Infinity, Math.floor(Math.max(...marks)) + minutes);
  return true;
}
/**
 * AUDIT SURV-TIERS: OFF'S MINUTES ARE NOBODY'S NEEDS - paused as they
 * pass. Hunger and wakefulness are TIMESTAMPS, so a player back from five
 * days Off was Starving in the first minute (and in Hard had lost ten
 * from every attribute). The world tick (worldTick.js tickPlayerMinutes)
 * calls this for every span it walks with the arc Off, and it carries the
 * two markers forward by the span, with the record's last paid minute:
 * the needs stand where they were, and resume there.
 *
 * The first cut did it the other way - the walk, on the arc's return,
 * moved the markers by the whole gap behind its start - and the second
 * audit found both ways that was wrong: a meal eaten while Off (which
 * writes `lastAte` inside the gap) was moved a second time, days into
 * the future; and WORLD5's online load (worldTick.js alignEntityClocks)
 * left exactly such a gap for a short absence ON PURPOSE - "an hour
 * away keeps its hunger" - which the shift forgave in every tier.
 * [LIVED1: online an absence leaves no gap at all - the needs stand on
 * the character's own clock, which stood while they were away.] Paused
 * here, per span, only while Off, neither can happen: a meal writes a
 * marker the next span carries, and a gap the arc was on for is not
 * touched. A player with no record is given none.
 */
export function pauseSurvival(entity, from, to) {
  const s = entity?.survival;
  if (!s || typeof s !== 'object') return false;
  const span = Math.floor(to) - Math.floor(from);
  if (!(span > 0)) return false;
  if (Number.isFinite(s.lastAte)) s.lastAte += span;
  if (Number.isFinite(s.awakeSince)) s.awakeSince += span;
  if (Number.isFinite(s.mealUntil)) s.mealUntil += span;   // HEARTY-MEAL: the meal's hold is a need's marker too
  s.lastMinute = Math.floor(to);
  // AUDIT SURV-BOONS A9/B9: and Off carries no boon - a tier that does not reward keeps neither the bank nor the grant
  if ('boons' in s || 'wellRested' in s) { delete s.boons; delete s.wellRested; for (const id of BOON_IDS) delete s.notes?.[`boon:${id}`]; }
  // AUDIT SURV-TIERS (the third pass): ...BUT THE WORLD'S OWN DECAYS RUN. What is paused is the NEEDS - the two
  // timestamps that are hunger and wakefulness, and the thirst that stands. A drink wears off and a soaking dries in
  // any game, and they had been frozen with the needs: twenty hours Off in a dry inn came back Very drunk and
  // Drenched, the drink's swing on every attribute with it (the symptom the fresh start below cures, under its one
  // day). They run at their slowest rates - one off every ten minutes for the drink, one a minute for the wet - and
  // the body's exposure cools as it does indoors.
  if (s.drunk > 0) s.drunk = Math.max(0, s.drunk - (Math.floor(to / 10) - Math.floor(from / 10)));
  if (s.wet > 0) s.wet = Math.max(0, s.wet - span);
  if (s.exposure > 0) s.exposure = Math.max(0, s.exposure - 2 * span);
  // ...AND A LONG ONE IS A FRESH START, WORLD5's own rule for an absence (alignSurvival, below): paused whole, five
  // days Off came back Drenched and Very drunk, the drink's penalty with them. Past the grace the body has lived the
  // classic game's days - fed, watered, rested, dry and sober - and the needs start again from there.
  s.offFor = (s.offFor ?? 0) + span;
  if (s.offFor > ALIGN_GRACE_MINUTES) { alignSurvival(entity, Math.floor(to), null); delete s.offFor; }   // AUDIT SURV-TIERS (the third pass): gone, not nought - a 0 rode every save after
  return true;
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
  if (Number.isFinite(s.mealUntil) && s.mealUntil > now + HEARTY_MEAL_MINUTES) s.mealUntil = now + HEARTY_MEAL_MINUTES;   // AUDIT UPDATE E-N4: no meal holds longer than one - a record carried or written past it
  const gap = lastSeen == null ? Infinity : now - lastSeen;
  if (gap > ALIGN_GRACE_MINUTES || (s.lastAte ?? now) > now || (s.awakeSince ?? now) > now) {
    Object.assign(s, { lastAte: now - 10, thirst: 0, wet: 0, sleepDebt: 0, awakeSince: now, exposure: 0, drunk: 0, fed: 0, mealUntil: 0, lastMinute: now, notes: boonNotes(s) });   // HEARTY-MEAL: a clock run back holds no meal   // AUDIT SURV-BOONS C3: the boons already said stay said
    return true;
  }
  return false;
}

/** AUDIT SURV-BOONS C3: the notes a record keeps across a load or a fresh start - the boons it carries, said already
 *  (save.js drops the notes; a well-kept body said every boon again at every load and every online join). */
export const boonNotes = (s) => Object.fromEntries((Array.isArray(s?.boons) ? s.boons : []).filter((id) => SAID_BOONS.includes(id)).map((id) => [`boon:${id}`, 'on']));
/** The temperature's stage, the strip's own word for it (temperature.js temperatureWord) - null where it is none. */
const TEMP_STAGE = Object.freeze({ scorching: 'scorching', hot: 'hot', warm: 'warm', 'deadly cold': 'deadly', freezing: 'freezing', cold: 'cold' });
export const tempStage = (felt) => TEMP_STAGE[temperatureWord(felt)] ?? null;
/**
 * AUDIT C&C N6: THE NOTES A LOAD KEEPS - the boons (boonNotes), and every stage the record stands at, said already: the
 * save drops the notes (their minutes are a session's), and a body Hungry, Thirsty, Tired, Damp and Cold heard all five
 * again in the first minute after every load. Each family's stage is read off the record at its last paid minute, as
 * the minute law read it - the hunger off the marker, the thirst, the debt, the wet, the felt reading - and a red one
 * keeps its way out to be said (WARM-SAID's '<family>:red').
 */
export function savedNotes(s) {
  const notes = boonNotes(s);
  if (!s || typeof s !== 'object') return notes;
  const at = Number.isFinite(s.lastMinute) ? s.lastMinute : null;
  const stages = {
    hunger: at == null || !Number.isFinite(s.lastAte) ? null : hungerStage(hungerMinutes(s, at)),
    thirst: Number.isFinite(s.thirst) ? thirstStage(s.thirst) : null,
    sleep: Number.isFinite(s.sleepDebt) ? sleepStage(s.sleepDebt) : null,
    wet: Number.isFinite(s.wet) ? wetStage(s.wet) : null,
    temp: Number.isFinite(s.felt) ? tempStage(s.felt) : null,
  };
  const QUIET = { hunger: 'fed', thirst: 'fine', sleep: 'rested', wet: 'dry' };
  for (const [family, stage] of Object.entries(stages)) {
    if (!stage || stage === QUIET[family]) continue;
    notes[family] = stage;
    if (RECOVERY[family]?.from[stage]) notes[`${family}:red`] = stage;
  }
  return notes;
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
