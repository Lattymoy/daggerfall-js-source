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
import { feltTemperature, temperatureWord } from './temperature.js';
import { drinkFrom, findDrink, waterskinName, DRINK_RELIEF, TEMPLATE, isFood, foodStage, FOOD_STAGE, rotFoodDay, rotWeight, ROT_DAY_MINUTES } from './food.js';
import { STAT_KEYS_ORDER, maxFatigue, liveStat } from '../statMods.js';
import { HARD_RULES } from './difficulty.js';
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
 *  minute. DFU's own walking drain is 11 a minute for scale. The rates
 *  are the body's and the same in every tier; WHICH of them a tier
 *  charges, and how far down the pool, are its rules' `stamina`. */
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
// SURV-TIERS: `FLOOR_FATIGUE = 64` stood here under "rough drains cannot
// take the last of a pool by themselves", and nothing read it. Hard's
// drains DO take the last point - the collapse that follows is the cost
// AUDIT-DEATH1 recorded as intended ("dehydration does kill; it kills
// through the collapse"). The floor is real now, as a tier's rule:
// `stamina.floor`, the share of the pool the needs may not take - none
// in Hard, half in Casual.
export const MAX_CATCHUP_MINUTES = 2 * MINUTES_PER_DAY;
/** The sleep-debt stage a tier's rough night cannot pay below (difficulty.js `roughSleepFloor`), as hours of debt. */
const SLEEP_FLOOR_AT = Object.freeze({ tired: NEED.SLEEP_TIRED, drowsy: NEED.SLEEP_DROWSY, exhausted: NEED.SLEEP_EXHAUSTED });
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
  repaid: 'You feel your strength returning.',   // AUDIT SURV-TIERS: a tier that repays - the need met, what it borrowed comes back
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
 *  (the caller clamps against the permanent stat). SURV-TIERS: the
 *  needs' drains are the tier's `attributes`; the drink's swing is
 *  every tier's - it is chosen at a bar, not a need left unmet. */
export function survivalStatMods(s, temp, now, { endurance = 50, rules = HARD_RULES, vampire = false } = {}) {
  const mods = {};
  const sub = (keys, n) => { if (n > 0) for (const k of keys) mods[k] = (mods[k] ?? 0) - n; };
  const ALL = ['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed'];
  if ((rules ?? HARD_RULES).attributes) {   // AUDIT SURV-TIERS: null is no rules too, as in every other law
    // AUDIT SURV-TIERS (the third pass): a VAMPIRE has no need for food, drink or sleep (the minute law calls them
    // fed and freezes the thirst and the debt; the page says so) - and these read the frozen markers, so a Hard
    // vampire lost two from every attribute a day to a hunger it cannot have, down to twenty. Since SURV1.
    const starve = vampire ? 0 : starvingDays(hungerMinutes(s, now));
    if (starve > 0) sub(ALL, Math.min(20, starve * 2));
    if (temp && temp.abs > NEED.EXPOSURE_AT) sub(ALL, Math.trunc(Math.min(s.exposure, temp.abs - NEED.EXPOSURE_AT) / 4));
    if (!vampire && s.thirst >= NEED.DEHYDRATED) sub(ALL, Math.trunc((s.thirst - 90) / 10));
    const sleep = vampire ? 'rested' : sleepStage(s.sleepDebt);
    if (sleep === 'tired') sub(ALL, 2); else if (sleep === 'drowsy') sub(ALL, 5); else if (sleep === 'exhausted') sub(ALL, 10);
    if (Number.isFinite(s.stiffUntil) && now < s.stiffUntil) sub(['speed', 'agility'], STIFF_PENALTY);   // SURV4: the rough night's morning
  }
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
function stageNote(s, family, stage, say, text, replay) {
  if (replay) return;
  const was = s.notes[family];
  if (!stage) { delete s.notes[family]; return; }
  if (stage === was) return;
  const sev = STAGE_SEVERITY[family], now = sev[stage] ?? 0, before = was ? sev[was] ?? 0 : 0;
  if (Math.sign(now) !== Math.sign(before) || Math.abs(now) > Math.abs(before)) say?.(text);
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
  const { worn = null, sinks = {}, rolls = Math.random, autoDrink = true, autoEat = true, replay = false } = deps;
  const rules = deps.rules ?? HARD_RULES;   // AUDIT SURV-TIERS: null is no rules too - survivalRules() answers null for Off
  const say = sinks.say ?? deps.say ?? null;
  const items = entity.items ?? [];
  const ctx = { ...(deps.ctx ?? {}), wet: s.wet, hasWater: !!findDrink(items) };
  const temp = feltTemperature(env, worn, ctx);
  const resting = !!env.resting;
  const sleeping = env.sleeping ?? null;
  const vampire = !!ctx.vampire;
  const endurance = entity.stats?.endurance ?? 50;
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
    if (!(n > 0)) return;
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
    let dry = temp.natTemp > 10 ? Math.trunc(temp.natTemp / 10) : 1;
    if (env.byFire || env.insideBuilding) dry += 2;
    s.wet = Math.max(0, s.wet - dry);
  }
  const wetNow = wetStage(s.wet);
  stageNote(s, 'wet', wetNow === 'dry' ? null : wetNow, say, SURVIVAL_TEXT[wetNow], replay);

  // HUNGER: the marker stands; the tallies move.
  const hunger = hungerMinutes(s, now);
  const hungerNow = vampire ? 'fed' : hungerStage(hunger);
  let refunded = 0;   // AUDIT SURV-TIERS (the third pass): the fed hour's refund is a refill the loan is settled by (loanPool)
  if (hungerNow === 'fed' && !vampire) { s.fed += 1; if (s.fed >= WELL_FED_MINUTES) { s.fed = 0; sinks.restoreFatigue?.(DRAIN.wellFed); refunded = DRAIN.wellFed; } }
  if (hungerNow === 'starving' && autoEat) {
    const sack = items.find((i) => i.templateIndex === TEMPLATE.Rations && isFood(i));
    if (sack) { eatRations(entity, sack, now, say); }
  }
  const hungerAfter = vampire ? 'fed' : hungerStage(hungerMinutes(s, now));
  stageNote(s, 'hunger', hungerAfter === 'fed' ? null : hungerAfter, say, SURVIVAL_TEXT[hungerAfter], replay);
  if (hungerAfter === 'starving' && !resting) tire(DRAIN.starving, 'hunger');

  // THIRST: the heat drives it; a skin in the pack answers it.
  let thirstRed = false;   // AUDIT SURV-TIERS: the stage a repaying tier charges (and repays when it lifts)
  if (!vampire) {
    const rate = THIRST_PER_MINUTE * Math.max(0.5, 1 + Math.max(0, temp.felt - 10) / 10);
    s.thirst = Math.min(NEED.THIRST_MAX, s.thirst + rate);
    if (autoDrink && s.thirst >= NEED.THIRSTY) drinkWater(entity, now, say);   // AUDIT SURV E: at the stage, so the chip never blinks with a skin in the pack
    const thirstNow = thirstStage(s.thirst);
    stageNote(s, 'thirst', thirstNow === 'fine' ? null : thirstNow, say, SURVIVAL_TEXT[thirstNow], replay);
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
    // temperature harm below uses. Nothing in `systems/rest.js` refuses a
    // rest for thirst, so a sleeper who could not wake to drink would be
    // killed by a window they were allowed to open.
    //
    // AND NOT DEAD INSIDE A JUMP. `runSurvivalMinutes` replays every
    // minute a clock jump crossed - a fast travel, a rest, a training
    // session - so six game-hours of travel is thirty-six harm ticks in
    // one frame, which took a starting character from full health to
    // dead ON ARRIVAL. A replayed minute may wound to the floor and no
    // further; the LAST minute of the walk is the one the player is
    // standing in, and that one may finish them. So a thirsty journey
    // still lands you at death's door, and the next minute you do not
    // drink is the one that kills - which is the behaviour asked for,
    // without the arrival being a coin flip.
    //
    // SURV-TIERS: and only in a tier that wounds (Hard). Casual's
    // dehydration is the stamina above and nothing more.
    if (rules.health && s.thirst >= NEED.THIRST_HARM && !sleeping && !resting && now % HARM_EVERY_MINUTES === 0) {
      const bite = Math.max(1, Math.trunc((s.thirst - NEED.THIRST_HARM + 10) / 10));
      if (!replay) sinks.hurt?.(bite);
      else if ((entity.health ?? 0) > HEALTH_FLOOR) sinks.hurt?.(Math.min(bite, (entity.health ?? 0) - HEALTH_FLOOR));
    }
  }

  // SLEEP: the debt grows past the free hours; sleep pays it by quality.
  let sleepRed = false;
  if (!vampire) {
    if (sleeping) {
      const rate = sleeping === 'rough' ? 0.5 : 1.5;   // hours of debt per hour asleep
      const floor = sleeping === 'rough' ? SLEEP_FLOOR_AT[rules.roughSleepFloor] ?? 0 : 0;   // SURV-TIERS: Hard's rough night never pays below tired; Casual's pays down to nothing
      const next = s.sleepDebt - rate / 60;
      s.sleepDebt = s.sleepDebt >= floor ? Math.max(floor, next) : Math.max(0, next);   // AUDIT SURV A: the floor holds from above and never lifts a rested sleeper up to it
      s.awakeSince = now;
    } else if (awakeHours(s, now) > NEED.AWAKE_FREE_HOURS) {
      s.sleepDebt = Math.min(NEED.SLEEP_DEBT_MAX, s.sleepDebt + 1 / 60);
    }
    const sleepNow = sleepStage(s.sleepDebt);
    stageNote(s, 'sleep', sleepNow === 'rested' ? null : sleepNow, say, SURVIVAL_TEXT[sleepNow], replay);
    sleepRed = sleepNow === 'exhausted';
    if (sleepNow === 'exhausted' && !resting) tire(DRAIN.exhausted, 'sleep');
  }

  // TEMPERATURE: the body pays for the heat and the cold.
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
  const warmedByFire = !!(rules.stamina.fireWarms && env.byFire && temp.felt < 0);
  if (warmedByFire) s.warmed = true; else if (s.warmed) delete s.warmed;   // AUDIT SURV-TIERS (the third pass): the strip's word for it (status.js)
  const tempRed = !warmedByFire && (temp.felt >= rules.stamina.hotFrom || temp.felt <= rules.stamina.coldFrom);
  if (!resting || !env.byFire) {
    if (tempRed && (!resting || rules.stamina.duringRest)) tire(DRAIN.heatPer20 * Math.trunc(abs / 20), 'temp');
    // AUDIT SURV-TIERS (the second pass): SURV-THIRST1's law for a harm that can kill (above), which this one never
    // had - a REPLAYED minute (a jump) wounds to the floor and no further, and the minute the player stands in may
    // finish them. A cautious fast travel through a summer desert healed the traveller whole and then replayed the
    // trip's heat as waking minutes: dead on arrival, in Hard, since SURV1.
    if (rules.health && abs > NEED.DAMAGE_AT && !sleeping && harmTick) {
      const bite = Math.max(1, Math.trunc((abs - 40) / 10));
      if (!replay) sinks.hurt?.(bite);
      else if ((entity.health ?? 0) > HEALTH_FLOOR) sinks.hurt?.(Math.min(bite, (entity.health ?? 0) - HEALTH_FLOOR));
    }
  }
  // AUDIT SURV A/E: the strip's own words (temperature.js temperatureWord), one note a word said once - an escalation
  // speaks at once and a held reading never repeats (a cold afternoon said three lines every five minutes)
  const tw = temperatureWord(temp.felt);
  const word = tw === 'scorching' ? 'scorching' : tw === 'hot' ? 'hot' : tw === 'warm' ? 'warm' : tw === 'deadly cold' ? 'deadly' : tw === 'freezing' ? 'freezing' : tw === 'cold' ? 'cold' : null;
  stageNote(s, 'temp', word && !(env.insideDungeon && word === 'warm') ? word : null, say, SURVIVAL_TEXT[word], replay);

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
    if (!feet && !env.transport && abs > endurance / 2 && !env.swimming) {
      feet0 = true;
      if (rules.stamina.bareFeet) tire(DRAIN.bareFeet, 'feet');
      note(s, 'feet', now, say, temp.felt > 0 ? SURVIVAL_TEXT.bareFeetHot : SURVIVAL_TEXT.bareFeetCold, { once: true });
    }
  }
  if (!naked) clearNote(s, 'naked'); if (!sun) clearNote(s, 'sun'); if (!feet0) clearNote(s, 'feet');
  if (temp.metal > 5) note(s, 'armor:hot', now, say, SURVIVAL_TEXT.armorHot, { once: true }); else clearNote(s, 'armor:hot');
  if (temp.metal < -5) note(s, 'armor:cold', now, say, SURVIVAL_TEXT.armorCold, { once: true }); else clearNote(s, 'armor:cold');

  // RUST: a wet metal piece loses a point on a 5% minute - in a tier that rusts (Hard; Casual takes no item's condition).
  if (rules.rust && s.wet > NEED.WET_DAMP && worn && rolls() < 0.05) {
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

  // AUDIT SURV-TIERS: the drink's bands on the LIVE endurance - the mod's LiveEndurance, the one the tavern, the HUD
  // and the status page already read (the permanent stat here put the swing out of step with the word that named it)
  applySurvivalMods(entity, survivalStatMods(s, temp, now, { endurance: liveStat(entity, 'endurance'), rules, vampire }));
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
 *  the marker lands at now - 10 so a starving player is fed at once. */
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
  // SURV-THIRST1 AUDIT: WHICH MINUTE IS THE PLAYER ACTUALLY LIVING IN.
  // Every minute but the last is a REPLAY - a jump's minutes, fabricated
  // by `playerTicker.advance` (scenes/shared.js) for a fast travel, a
  // rest or a training session, all of which run this same loop. A harm
  // that may kill must not be charged hundreds of times inside one
  // frame: six game-hours of fast travel is 36 harm ticks, and that
  // killed a starting character dead on arrival. The last minute is the
  // one the player is standing in, and it is the one that may finish
  // them. ONE object, mutated - this loop runs up to 2,880 times and a
  // fresh deps per minute would be 2,880 objects a jump (EV2's rule).
  if (s.offFor) delete s.offFor;   // AUDIT SURV-TIERS: the arc is on again - an Off span ends (pauseSurvival)
  // AUDIT SURV-TIERS (the third pass): AND WHAT A JUMP SAYS, IT SAYS ONCE, AS IT LANDS. Every replayed minute spoke
  // as if lived, so a three-day journey arrived with thirty lines - eighteen of them "You drink from your waterskin."
  // - and a blackout night drank from the skin while its drinker was out cold. The replay's lines are gathered, each
  // said once when the walk reaches the minute the player stands in; the stage lines wait for that minute
  // (stageNote), which says the net change.
  const sinks = deps.sinks ?? {};
  const heard = [];
  const walk = { ...deps, replay: true, sinks: { ...sinks, say: (t) => { if (!heard.includes(t)) heard.push(t); } } };
  for (let m = start + 1; m <= end; m++) {
    walk.replay = m < end;
    if (!walk.replay) { walk.sinks = sinks; const say = sinks.say ?? deps.say; for (const t of heard) say?.(t); }
    temp = survivalMinute(entity, m, env, walk);
  }
  if (end > (s.lastMinute ?? -Infinity)) s.lastMinute = end;
  return temp;
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
 * leaves exactly such a gap for a short absence ON PURPOSE - "an hour
 * away keeps its hunger" - which the shift forgave in every tier. Paused
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
  s.lastMinute = Math.floor(to);
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
/**
 * AUDIT SURV-TIERS (the third pass): A CORRECTION IS NOT AN ABSENCE. The relay's clock stepping this machine's by
 * `delta` minutes moved the world under the needs' timestamps - worldTick.js alignEntityClocks moves every other
 * marker by it - so a player fed a minute before the socket opened on a clock three hours slow read Starving, and in
 * Hard lost two from every attribute. The record rides the same delta: the needs stand where they were. (A LOAD's
 * gap is different, and save.js keeps it: an hour away is an hour hungrier - WORLD5.)
 */
export function shiftSurvival(entity, delta) {
  const s = entity?.survival;
  if (!s || typeof s !== 'object' || !Number.isFinite(delta) || delta === 0) return false;
  for (const k of ['lastAte', 'awakeSince', 'lastMinute', 'stiffUntil']) if (Number.isFinite(s[k]) && s[k] !== 0) s[k] += delta;
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
