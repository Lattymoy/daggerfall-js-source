import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TRADE_MESSAGE_BASE_ID, NOT_ENOUGH_GOLD_ID,
  TRAINING_OFFER_ID, TRAINING_TOO_SKILLED_ID, TRAINING_TOO_SOON_ID, TRAIN_SKILL_ID,
  TRAINING_COOLDOWN_MINUTES, TRAINING_HOURS, TRAINING_FATIGUE_LOSS,
  trainingTooSoon, tooSkilledToTrain, trainSkill, trainableSkills,
  trainingOffer, canAffordTraining,
  TOO_GENEROUS_ID, DONATION_THANKS_ID, DONATION_DEFAULT, DONATION_MAX_CHARACTERS, donate,
  NO_DISEASE_ID, CURE_BASE_COST_PER_DISEASE, cureDiseaseOffer, cureOfferMessageOffset,
  payForCure, cureForFree, expandGuildMacros,
} from '../src/systems/guildServiceActions.js';
import { GUILDS } from '../src/systems/guilds.js';
import { templeOf } from '../src/systems/guildVariants.js';
import { createFactionRep, getReputation, setReputation } from '../src/systems/factionRep.js';
import { SKILLS } from '../src/systems/skills.js';
import { SKILL_ADVANCEMENT_MULTIPLIER } from '../src/systems/advancement.js';
import { FATIGUE_LOSS } from '../src/systems/statMods.js';
import { goldAmount } from '../src/systems/court.js';
import { startDisease, diseaseCount } from '../src/systems/diseases.js';
import { HOLIDAY_DAYS_OF_YEAR, HOLIDAYS } from '../src/systems/holidays.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { calculateCost, calculateTradePrice } from '../src/systems/shopStock.js';

const player = (over = {}) => ({
  name: 'Bob', isPlayer: true, level: 2, health: 30, maxHealth: 30,
  items: [{ group: 'Currency', name: 'Gold pieces', stackCount: 5000 }],
  skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 20])),
  skillUses: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
  stats: { personality: 50 }, activeEffects: [], fatigue: 3200,
  timeOfLastSkillTraining: 0, ...over,
});

// ── TRAINING ──────────────────────────────────────────────────────

test('U24: the training cooldown is 720 CLASSIC MINUTES and it is a difference', () => {
  assert.equal(TRAINING_COOLDOWN_MINUTES, 720);   // twelve hours
  const e = player({ timeOfLastSkillTraining: 1000 });
  assert.equal(trainingTooSoon(e, 1000), true, 'the instant after training');
  assert.equal(trainingTooSoon(e, 1719), true, 'one minute short');
  assert.equal(trainingTooSoon(e, 1720), false, 'exactly 720 later clears it');
  // an entity that has never trained is at 0, and any real clock clears
  assert.equal(trainingTooSoon(player(), 720), false);
  assert.equal(trainingTooSoon(player(), 719), true, 'a brand new game IS too soon');
});

test('U24: the too-skilled gate is STRICTLY greater than the cap', () => {
  const guild = GUILDS.FightersGuild;
  const at = (v) => tooSkilledToTrain(player({ skills: { [SKILLS.Axe]: v } }), guild, SKILLS.Axe);
  assert.equal(at(49), false);
  assert.equal(at(50), false, 'sitting exactly on the cap may still train');
  assert.equal(at(51), true);
});

test('U24: TrainSkill returns the three things the host must apply', () => {
  const e = player();
  // Random.Range(10, 20 + 1) is INCLUSIVE of 20 - roll 0 gives 10,
  // roll just under 1 gives 20.
  const lo = trainSkill(e, SKILLS.Axe, 5000, () => 0);
  const hi = trainSkill(e, SKILLS.Axe, 5000, () => 0.999999);
  const mult = SKILL_ADVANCEMENT_MULTIPLIER[SKILLS.Axe];
  assert.equal(lo.tally, 10 * mult);
  assert.equal(hi.tally, 20 * mult);
  assert.equal(e.timeOfLastSkillTraining, 5000, 'the cooldown clock is stamped');
  assert.equal(lo.advanceMinutes, TRAINING_HOURS * 60);
  assert.equal(TRAINING_HOURS, 3);
  // DecreaseFatigue(DefaultFatigueLoss * 180) - 180 is the minutes in
  // those three hours, so it is the ordinary drain charged in one go
  assert.equal(TRAINING_FATIGUE_LOSS, FATIGUE_LOSS.Default * 180);
  assert.equal(TRAINING_FATIGUE_LOSS, 1980);
  assert.equal(lo.textId, TRAIN_SKILL_ID);
  // a skill with advancement multiplier 0 tallies nothing at all
  const zero = trainSkill(e, 99, 5000, () => 0.5);
  assert.equal(zero.tally, 0);
});

test('U24: the offer, its price, and the gold check that precedes the picker', () => {
  const guild = GUILDS.FightersGuild;
  const e = player({ level: 3 });
  const member = trainingOffer(e, guild, { guild: guild.name, rank: 0 }, 100000);
  const nonMember = trainingOffer(e, guild, null, 100000);
  assert.equal(member.textId, TRAINING_OFFER_ID);
  assert.equal(member.price, 100 * 3);
  assert.equal(nonMember.price, 400 * 3);
  assert.equal(trainingOffer(player({ timeOfLastSkillTraining: 99999 }), guild, null, 100000).textId,
    TRAINING_TOO_SOON_ID);
  // the gold check happens BEFORE the picker opens
  assert.equal(canAffordTraining(player({ level: 3 }), null), true);   // 1200 of 5000
  assert.equal(canAffordTraining(player({ level: 20 }), null), false); // 8000 of 5000
  assert.equal(TRAINING_TOO_SKILLED_ID, 4022);
  assert.equal(NOT_ENOUGH_GOLD_ID, 454);
});

test('U24: a TEMPLE trains its divine\'s list, a knightly order trains nothing', () => {
  // "Handle Temples even when not a member" - GetTrainingSkills has a
  // temple arm that never reads membership.
  const arkay = trainableSkills(templeOf('Arkay'));
  assert.ok(arkay.length > 0);
  assert.notDeepEqual(arkay, trainableSkills(GUILDS.FightersGuild));
  assert.deepEqual(trainableSkills({ order: 'Rose', name: 'Order:Rose' }), []);
});

// ── DONATION ──────────────────────────────────────────────────────

/** Arkay (21) UNDER a root, because "Does not propagate in classic" is
 *  only observable against a tree: a propagating change hands the ROOT
 *  the full amount too (PropagateReputationChange's `parent === 0`
 *  arm), where the non-propagating one touches 21 alone. A flat
 *  one-faction fixture cannot tell the two apart, and a mutation run
 *  proved it - this pin passed with `propagate: true` until the
 *  parent was added. */
const ROOT_ID = 20;
const templeStore = (rep = 0) => {
  const store = createFactionRep(new Map([
    [ROOT_ID, { id: ROOT_ID, rep: 0, parent: 0, type: 2, children: [21] }],
    [21, { id: 21, rep: 0, parent: ROOT_ID, type: 9, children: [] }],
  ]));
  setReputation(store, 21, rep);
  return store;
};

test('U24: the donation field opens on 1000 and takes 8 digits', () => {
  assert.equal(DONATION_DEFAULT, '1000');
  assert.equal(DONATION_MAX_CHARACTERS, 8);
  assert.equal(TOO_GENEROUS_ID, 702);
  assert.equal(DONATION_THANKS_ID, 703);
});

test('U24: donating more than you carry buys NOTHING - not a partial gift', () => {
  const e = player();
  const store = templeStore(0);
  const r = donate(e, store, 21, 6000, () => 0);
  assert.equal(r.kind, 'tooGenerous');
  assert.equal(r.textId, TOO_GENEROUS_ID);
  assert.equal(goldAmount(e), 5000, 'not a coin left the purse');
  assert.equal(getReputation(store, 21), 0);
});

test('U24: the donation chance truncates BEFORE the +1, and reads |rep|', () => {
  // (2 * amount / max(rep,1)) + 1, C# integer division.
  const at = (amount, rep) => donate(player(), templeStore(rep), 21, amount, () => 0.99).chance;
  assert.equal(at(100, 0), 201);        // rep 0 -> max(0,1) = 1
  assert.equal(at(100, 3), Math.trunc(200 / 3) + 1);   // 66 + 1, not 67.67
  assert.equal(at(100, 3), 67);
  // ABSOLUTE value: a temple that hates you is exactly as hard as one
  // that loves you
  assert.equal(at(100, -40), at(100, 40));
  assert.equal(at(100, 40), 6);
});

test('U24: a successful donation raises reputation by ONE, without propagating', () => {
  const e = player();
  const store = templeStore(0);
  // chance 201 - a roll of 0.99 gives 99 < 201, so it always lands
  const ok = donate(e, store, 21, 100, () => 0.99);
  assert.equal(ok.kind, 'thanks');
  assert.equal(ok.raised, true);
  assert.equal(getReputation(store, 21), 1);
  assert.equal(getReputation(store, ROOT_ID), 0, 'the parent gets NOTHING - it does not propagate');
  assert.equal(goldAmount(e), 4900);
  // a chance the roll misses spends the gold and raises nothing -
  // classic takes the donation either way
  const store2 = templeStore(100);
  const e2 = player();
  const miss = donate(e2, store2, 21, 1, () => 0.99);   // chance (2/100)+1 = 1, roll 99
  assert.equal(miss.raised, false);
  assert.equal(goldAmount(e2), 4999, 'the gold is still gone');
  assert.equal(getReputation(store2, 21), 100);
});

// ── CURE DISEASE ──────────────────────────────────────────────────

const diseased = (n = 1) => {
  const e = player();
  for (let i = 0; i < n; i++) startDisease(e, i, 0, () => 0);
  return e;
};

test('U24: no disease costs nothing and says so', () => {
  const r = cureDiseaseOffer(player(), GUILDS.FightersGuild, null, { quality: 10 });
  assert.deepEqual(r, { kind: 'noDisease', textId: NO_DISEASE_ID });
  assert.equal(NO_DISEASE_ID, 30);
});

test('U24: the cure price is 250 PER DISEASE through quality and bargaining', () => {
  assert.equal(CURE_BASE_COST_PER_DISEASE, 250);
  const e = diseased(2);
  assert.equal(diseaseCount(e), 2);
  const offer = cureDiseaseOffer(e, GUILDS.FightersGuild, null, { quality: 10, nowClassicMinutes: 0 });
  assert.equal(offer.kind, 'offer');
  assert.equal(offer.diseases, 2);
  // the same arithmetic DFU runs: CalculateCost with the NEUTRAL
  // regional adjustment (it is called with two arguments), then
  // CalculateTradePrice buying
  const expect = calculateTradePrice(calculateCost(500, 10), 10,
    { mercantile: 20, personality: 50 }, false);
  assert.equal(offer.cost, expect);
  assert.equal(offer.textId, TRADE_MESSAGE_BASE_ID + cureOfferMessageOffset(calculateCost(500, 10), offer.cost));
});

test('U24: only ARKAY discounts curing, and only for members', () => {
  const e = diseased(1);
  const arkay = templeOf('Arkay'), mara = templeOf('Mara');
  const at = (guild, m) => cureDiseaseOffer(e, guild, m, { quality: 10 }).cost;
  const full = at(mara, { guild: mara.name, rank: 9 });
  assert.equal(at(arkay, null), full, 'a non-member pays full at Arkay too');
  assert.ok(at(arkay, { guild: arkay.name, rank: 9 }) < full, 'a senior Arkay member pays less');
});

test('U24: three holidays cure FREE and a fourth halves the price', () => {
  const day = (n) => (n - 1) * MINUTES_PER_DAY;
  const free = cureDiseaseOffer(diseased(1), GUILDS.FightersGuild, null,
    { quality: 10, regionIndex: 0, nowClassicMinutes: day(HOLIDAY_DAYS_OF_YEAR[3]) });
  assert.equal(free.kind, 'freeHoliday');
  assert.equal(free.holidayId, HOLIDAYS.South_Winds_Prayer);
  // ...and it cures even a player with no gold at all
  const broke = player({ items: [] });
  startDisease(broke, 0, 0, () => 0);
  assert.equal(diseaseCount(broke), 1);
  cureForFree(broke);
  assert.equal(diseaseCount(broke), 0);
  // North Winds halves the pre-bargain cost
  const plain = cureDiseaseOffer(diseased(1), GUILDS.FightersGuild, null, { quality: 10, nowClassicMinutes: 0 });
  const half = cureDiseaseOffer(diseased(1), GUILDS.FightersGuild, null,
    { quality: 10, nowClassicMinutes: day(HOLIDAY_DAYS_OF_YEAR[49]) });
  assert.equal(half.holidayId, HOLIDAYS.North_Winds_Festival);
  assert.ok(half.cost < plain.cost, `${half.cost} !< ${plain.cost}`);
});

test('U24: the haggle message is three SHIFT bands, not fractions', () => {
  // (cost >> 1) <= paid ? ((cost - (cost >> 2)) <= paid ? 2 : 1) : 0
  assert.equal(cureOfferMessageOffset(100, 49), 0);    // under half
  assert.equal(cureOfferMessageOffset(100, 50), 1);    // half exactly
  assert.equal(cureOfferMessageOffset(100, 74), 1);
  assert.equal(cureOfferMessageOffset(100, 75), 2);    // three quarters exactly
  assert.equal(cureOfferMessageOffset(100, 100), 2);
  // the shifts TRUNCATE, which an odd cost exposes
  assert.equal(cureOfferMessageOffset(101, 50), 1, '101>>1 is 50, not 50.5');
  assert.equal(TRADE_MESSAGE_BASE_ID, 260);
});

test('U24: paying checks gold INSIDE the yes arm, and cures everything', () => {
  const e = diseased(3);
  assert.equal(payForCure(e, 6000).kind, 'notEnoughGold');
  assert.equal(diseaseCount(e), 3, 'still sick');
  const r = payForCure(e, 400);
  assert.equal(r.kind, 'cured');
  assert.equal(goldAmount(e), 4600);
  assert.equal(diseaseCount(e), 0, 'ALL diseases, not one');
});

test('U24: the four macros these windows use', () => {
  assert.equal(expandGuildMacros('%a'), '%a', 'an unsupplied macro is left alone');
  assert.equal(
    expandGuildMacros('%a %gii %god %pct %pcn', { amount: 7, gold: 8, god: 'Arkay', guildTitle: 'Curate', playerName: 'Bob' }),
    '7 8 Arkay Curate Bob');
});
