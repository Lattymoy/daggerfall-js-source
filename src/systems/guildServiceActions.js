// U24: THE THREE GUILD SERVICES THE PORT CAN ACTUALLY PERFORM -
// TRAINING, DONATION, CURE DISEASE. 1:1 from Daggerfall Unity's
// DaggerfallGuildServiceTraining.cs, DaggerfallGuildServiceDonation.cs
// and DaggerfallGuildServiceCureDisease.cs (MIT, Daggerfall Workshop /
// Hazelnut). Unity plumbing dropped; the windows are ui/guildServiceWindows.js.
//
// All three of DFU's classes are message-box flows with no art of
// their own - "Note this is not a real UI window, and is not actually
// pushed onto the stack", as the training one says outright - so
// nearly all of each is LAW, and it belongs here where it can be run
// headlessly.
//
// ── the clock is real now ─────────────────────────────────────────
// Training has a 720-MINUTE (12 hour) cooldown and COSTS THREE HOURS,
// and both are written against DaggerfallDateTime. S28 landed the
// calendar, so these are exact rather than approximated: the cooldown
// compares classic minutes, and trainSkill RETURNS the minutes the
// host must advance rather than reaching for a clock it does not own.
import { SKILLS, skillValue } from './skills.js';
import { SKILL_ADVANCEMENT_MULTIPLIER } from './advancement.js';
import { FATIGUE_LOSS } from './statMods.js';
import { goldAmount, deductGold } from './court.js';
import { getReputation, changeReputation } from './factionRep.js';
import { diseaseCount } from './diseases.js';
import { cureAllDiseases } from './effects.js';
import { calculateCost, calculateTradePrice } from './shopStock.js';
import { trainingPrice, trainingMax, trainingSkills, reducedCureCost } from './guildServices.js';
import { getHolidayId, FREE_CURE_HOLIDAYS, HALF_PRICE_CURE_HOLIDAY } from './holidays.js';
import { expandMacros } from './talkSession.js';

/** MacroHelper's four (Utility/MacroHelper.cs :50, :105, :107, :153),
 *  which are all these three windows ask for. The FULL table is 100+
 *  entries and belongs to its own slice - Ledger C - so this is a
 *  named subset rather than a second macro engine: %a is the
 *  MacroDataSource's Amount (the training price or the curing cost),
 *  %gii the gold in hand, %god the temple's divine, %pct the player's
 *  GUILD TITLE, which U23's recovered rank titles finally make real.
 *
 *  The shared %pcn/%pcf/%cn/%oth live in talkSession.expandMacros and
 *  are applied first, so a guild record with a player name in it
 *  reads correctly too. */
export function expandGuildMacros(text, { amount = null, gold = null, god = null, guildTitle = null, roomHours = null, race = null, honorific = null, playerName = '', cityName = '' } = {}) {
  let out = expandMacros(text ?? '', { playerName, cityName });
  // U39: %ra and %hnr are MacroHelper STATICS - ExpandRandomTextRecord
  // runs the whole table over every record, so they resolve in a
  // service window's TEXT.RSC exactly as they do in a greeting. The
  // tavern's own "how many days" prompt (5102) opens with "Good day,
  // %ra." and printed the macro raw on screen until U39's live probe
  // read it back. The port already had both readers (talkSession's
  // raceDisplayName / honorificOf); nothing had connected them here.
  if (race != null) out = out.replaceAll('%ra', race);
  if (honorific != null) out = out.replaceAll('%hnr', honorific);
  if (amount != null) out = out.replaceAll('%a', String(amount));
  if (gold != null) out = out.replaceAll('%gii', String(gold));
  if (god != null) out = out.replaceAll('%god', god);
  if (guildTitle != null) out = out.replaceAll('%pct', guildTitle);
  // U39: MacroHelper.cs:80 `{ "%dwr", RoomHoursLeft }` - the hours a
  // rented room still has to run, which the tavern's "how many
  // ADDITIONAL days" prompt quotes back at the player. It lives here
  // rather than in the tavern because this is the one table every
  // service window's TEXT.RSC goes through.
  if (roomHours != null) out = out.replaceAll('%dwr', String(roomHours));
  return out;
}

/** DaggerfallTradeWindow's two shared ids, which all three of these
 *  windows borrow (:33-34). */
export const TRADE_MESSAGE_BASE_ID = 260;
export const NOT_ENOUGH_GOLD_ID = 454;

// ── TRAINING (DaggerfallGuildServiceTraining.cs) ──────────────────

export const TRAINING_OFFER_ID = 8;
export const TRAINING_TOO_SKILLED_ID = 4022;
export const TRAINING_TOO_SOON_ID = 4023;
export const TRAIN_SKILL_ID = 5221;
/** The cooldown, in CLASSIC MINUTES (:54). Twelve hours. */
export const TRAINING_COOLDOWN_MINUTES = 720;
/** `now.RaiseTime(SecondsPerHour * 3)` (:121) - training eats three
 *  hours of the day. */
export const TRAINING_HOURS = 3;
/** `DecreaseFatigue(PlayerEntity.DefaultFatigueLoss * 180)` (:122).
 *  180 is the number of MINUTES in those three hours, so this is the
 *  ordinary per-minute drain charged for the whole session at once. */
export const TRAINING_FATIGUE_LOSS = FATIGUE_LOSS.Default * 180;

/** TrainingService's gate (:52-70). True means the player is turned
 *  away with 4023 rather than offered a price. The field is
 *  PlayerEntity.TimeOfLastSkillTraining, in classic minutes; an entity
 *  that has never trained reads 0, which is the same 0 DFU starts at. */
export function trainingTooSoon(entity, nowClassicMinutes) {
  return (nowClassicMinutes - (entity?.timeOfLastSkillTraining ?? 0)) < TRAINING_COOLDOWN_MINUTES;
}

/** TrainingSkill_OnItemPicked's skill gate (:98-104). DFU compares the
 *  PERMANENT skill value against the guild's training max, and the
 *  comparison is STRICTLY GREATER - a player sitting exactly on the
 *  cap may still train. */
export function tooSkilledToTrain(entity, guild, skill) {
  // GetTrainingMax is a virtual NO SUBCLASS OVERRIDES (Guild.cs
  // :294-297) - every guild, temple and order caps training at 50 -
  // so G3's trainingMax takes no arguments and this passes none.
  return skillValue(entity, skill) > trainingMax();
}

/** TrainSkill (:118-127). Returns what the HOST must apply, because
 *  two of the three effects are not this module's to make: the world
 *  clock advance and the fatigue drain both live on the host's ticker.
 *
 *  `Random.Range(10, 20 + 1)` is inclusive of 20 - the +1 is DFU's own
 *  and is why this is 10..20 rather than 10..19. */
export function trainSkill(entity, skill, nowClassicMinutes, rolls = Math.random) {
  entity.timeOfLastSkillTraining = nowClassicMinutes;
  const mult = SKILL_ADVANCEMENT_MULTIPLIER[skill] ?? 0;
  const tally = (10 + Math.floor(rolls() * 11)) * mult;
  return {
    skill, tally,
    advanceMinutes: TRAINING_HOURS * 60,
    fatigueLoss: TRAINING_FATIGUE_LOSS,
    textId: TRAIN_SKILL_ID,
  };
}

/** GetTrainingSkills (:130-155): a TEMPLE trains its divine's list
 *  whether or not the player is a member, and everyone else trains the
 *  guild's own. G3 already keyed both by the guild record, so the
 *  switch collapses - but the "even when not a member" comment is the
 *  law that makes a temple different and it is pinned. */
export const trainableSkills = (guild) => trainingSkills(guild) ?? [];

/** The whole offer decision, so a window is only buttons. */
export function trainingOffer(entity, guild, membership, nowClassicMinutes) {
  if (trainingTooSoon(entity, nowClassicMinutes)) return { kind: 'tooSoon', textId: TRAINING_TOO_SOON_ID };
  return { kind: 'offer', textId: TRAINING_OFFER_ID, price: trainingPrice(membership, entity.level ?? 1) };
}

/** ConfirmTraining's Yes branch (:73-90): the gold check happens
 *  BEFORE the skill picker opens, so a player who cannot pay never
 *  sees the list. */
export function canAffordTraining(entity, membership) {
  return goldAmount(entity) >= trainingPrice(membership, entity.level ?? 1);
}

// ── DONATION (DaggerfallGuildServiceDonation.cs) ──────────────────

export const TOO_GENEROUS_ID = 702;
export const DONATION_THANKS_ID = 703;
/** TextBox.Text = "1000" (:51) - the field opens pre-filled, and
 *  MaxCharacters is 8. */
export const DONATION_DEFAULT = '1000';
export const DONATION_MAX_CHARACTERS = 8;

/** DonationMsgBox_OnGotUserInput (:55-83).
 *
 *  Three things here are easy to get wrong and all three are pinned:
 *  - the reputation read is ABSOLUTE (`Math.Abs`), so a player the
 *    temple already hates is as hard to impress as one it loves;
 *  - the chance is `(2 * amount / max(rep,1)) + 1` with C# INTEGER
 *    division, truncating before the +1;
 *  - the change is NON-propagating, and DFU says why in its own
 *    comment: "Does not propagate in classic".
 *
 *  A donation larger than the player's purse buys nothing at all - not
 *  a partial gift, not a refusal to spend what they have. */
export function donate(entity, store, divineFactionId, amount, rolls = Math.random) {
  if (!Number.isInteger(amount)) return { kind: 'invalid' };
  if (goldAmount(entity) < amount) return { kind: 'tooGenerous', textId: TOO_GENEROUS_ID };
  deductGold(entity, amount);
  const rep = Math.abs(getReputation(store, divineFactionId));
  const chance = Math.trunc((2 * amount) / Math.max(rep, 1)) + 1;
  const raised = Math.floor(rolls() * 100) < chance;
  if (raised) changeReputation(store, divineFactionId, 1, false);
  return { kind: 'thanks', textId: DONATION_THANKS_ID, amount, chance, raised };
}

// ── CURE DISEASE (DaggerfallGuildServiceCureDisease.cs) ───────────

export const NO_DISEASE_ID = 30;
/** 250 gold PER DISEASE before every modifier (:78). */
export const CURE_BASE_COST_PER_DISEASE = 250;

/** CureDiseaseService (:54-113), as a decision.
 *
 *  `numberOfDiseases` is DFU's disease count PLUS ONE if the player is
 *  turning into a vampire or werebeast - FLAGGED: the port has no
 *  vampirism/lycanthropy timer, so `becomingVampireOrWerebeast` is
 *  passed in and is false everywhere today. The moment that arc lands
 *  it feeds this one argument and the price is right.
 *
 *  The three FREE holidays are checked before anything is priced, and
 *  they cure whether or not the player could have paid. */
export function cureDiseaseOffer(entity, guild, membership, {
  quality = 0, regionIndex = 0, nowClassicMinutes = 0,
  becomingVampireOrWerebeast = false,
} = {}) {
  let numberOfDiseases = diseaseCount(entity);
  if (becomingVampireOrWerebeast) numberOfDiseases++;
  const holidayId = getHolidayId(nowClassicMinutes, regionIndex);

  if (numberOfDiseases > 0 && FREE_CURE_HOLIDAYS.includes(holidayId)) {
    return { kind: 'freeHoliday', holidayId, diseases: numberOfDiseases };
  }
  if (numberOfDiseases === 0) return { kind: 'noDisease', textId: NO_DISEASE_ID };

  let baseCost = CURE_BASE_COST_PER_DISEASE * numberOfDiseases;
  baseCost = reducedCureCost(guild, membership, baseCost);   // Arkay's members only
  // CalculateCost is called with TWO arguments here (:81), so the
  // regional price adjustment stays at its neutral 1000 - curing a
  // disease costs the same in every province, unlike merchandise.
  let costBeforeBargaining = calculateCost(baseCost, quality);
  // "Halve the price on North Winds Prayer holiday" - DFU's comment
  // names the wrong holiday; the CODE tests North_Winds_Festival, and
  // the code is what ships.
  if (holidayId === HALF_PRICE_CURE_HOLIDAY) costBeforeBargaining = Math.trunc(costBeforeBargaining / 2);
  const cost = calculateTradePrice(costBeforeBargaining, quality, {
    mercantile: skillValue(entity, SKILLS.Mercantile),
    personality: entity.stats?.personality ?? 50,
  }, false);
  return {
    kind: 'offer', diseases: numberOfDiseases, cost, holidayId,
    textId: TRADE_MESSAGE_BASE_ID + cureOfferMessageOffset(costBeforeBargaining, cost),
  };
}

/** The message the temple haggles you with (:93-100). Three bands, and
 *  they are written as SHIFTS rather than fractions - `>> 1` is half
 *  and `- (>> 2)` is three quarters, both truncating. Offset 0 is the
 *  cheerful one (the player bargained the price below half), 1 the
 *  middle, 2 the grudging one. */
export function cureOfferMessageOffset(costBeforeBargaining, cost) {
  if ((costBeforeBargaining >> 1) <= cost) {
    return (costBeforeBargaining - (costBeforeBargaining >> 2)) <= cost ? 2 : 1;
  }
  return 0;
}

/** ConfirmCuring's Yes branch (:116-130). The gold check is INSIDE the
 *  Yes arm, so a player who says yes and cannot pay is told so rather
 *  than being stopped earlier - the opposite of training's order. */
export function payForCure(entity, cost) {
  if (goldAmount(entity) < cost) return { kind: 'notEnoughGold', textId: NOT_ENOUGH_GOLD_ID };
  deductGold(entity, cost);
  cureAllDiseases(entity);
  return { kind: 'cured', cost };
}

/** The free-holiday arm's cure (:69-75), which takes no payment. */
export function cureForFree(entity) {
  cureAllDiseases(entity);
  return { kind: 'cured', cost: 0 };
}
