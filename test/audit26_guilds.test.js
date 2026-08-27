// AUDIT 26 - the guild-services cluster (F112-F117).
//
// F112: the witches-coven constants were BOTH wrong (6/8 are
//       VampireClan/GGroup8; WitchesCoven=8, Witches=22 in
//       FactionFile.cs), so a real coven never drew its daily prince
//       and a failed summoning never spawned the reprisal.
// F113: the cure-disease quote skipped ApplyRegionalPriceAdjustment -
//       CalculateCost ALWAYS applies it (FormulaHelper.cs:1895); the
//       two-argument C# call omits conditionPercentage, not the region.
// F114: the knightly rank-9 promotion now consults OwnsHouse
//       (KnightlyOrder.GetPromotionMsgId :144-145), ternary inverted
//       exactly as DFU wrote it.
// F115: a NON-MEMBER never reaches the subclass access switch -
//       GuildManager.GetGuild (:229-249) hands them NonMemberGuild
//       first, so a stranger at a knightly seneschal is refused with
//       "members only", not the members' rank refusal.
// F116: serviceReceiveHouseAlready is DFU's exact en string.
// F117: Stendarr's AvoidDeath - rank-in-fifty odds, not submerged,
//       and SetHealth restores 10% of max instead of raising death
//       (Temple.cs:450-460, GuildManager.cs:396-402,
//       PlayerEntity.cs:1205-1211).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  WITCHES_COVEN_TYPE, WITCHES_GUILD_GROUP, DAEDRA, HIRCINE_INDEX,
  daedraForSummoner, attemptSummoning,
} from '../src/systems/daedraSummoning.js';
import { FACTION_TYPES, GUILD_GROUPS } from '../src/formats/factionFile.js';
import { cureDiseaseOffer } from '../src/systems/guildServiceActions.js';
import { SKILLS } from '../src/systems/skills.js';
import { orderOf, templeOf } from '../src/systems/guildVariants.js';
import { promotionTextId, GUILDS } from '../src/systems/guilds.js';
import { canAccessService, avoidDeath, AVOID_DEATH_TEXT } from '../src/systems/guildServices.js';
import { serviceAccess, SERVICE_MEMBERS_ONLY, INSUFFICIENT_RANK_ID } from '../src/systems/guildServiceFlow.js';
import { ALREADY_GIVEN_HOUSE } from '../src/systems/knightlyGifts.js';

// ── F112 ──────────────────────────────────────────────────────────

test('F112: the coven constants are FactionFile.cs values, pinned as literals', () => {
  // FactionFile.cs: WitchesCoven = 8 (6 is VampireClan), Witches = 22
  // (8 is GGroup8). The old pins used the constants symbolically and
  // restated the port; these are the numbers.
  assert.equal(WITCHES_COVEN_TYPE, 8);
  assert.equal(WITCHES_GUILD_GROUP, 22);
  // and the port's own enum tables agree - one home, both ways.
  assert.equal(FACTION_TYPES.WitchesCoven, 8);
  assert.equal(GUILD_GROUPS.Witches, 22);
});

test('F112: a REAL coven record (type 8) draws the daily random prince', () => {
  // The caller passes the faction record's raw type. Before the fix a
  // type-8 coven fell through to the summoning-day calendar and
  // answered nobody on day 33 (no prince's day).
  const state = {};
  const d = daedraForSummoner({ factionType: 8, dayOfYear: 33, state, rolls: () => 0.5 });
  assert.ok(d, 'the coven answers on a non-summoning day');
  assert.equal(state.daedraSummonDay, 33, 'and remembers the draw');
  assert.ok(state.daedraSummonIndex >= 1, 'Range(1, length) excludes Hircine');
  assert.equal(d, DAEDRA[state.daedraSummonIndex]);
  assert.notEqual(d, DAEDRA[HIRCINE_INDEX]);
});

test('F112: a failed summoning at a REAL coven (ggroup 22) spawns the reprisal', () => {
  // rolls: #1 dodges Sheogorath (100 > 5), #2 misses the 30% chance.
  const seq = () => { const r = [0.99, 0.99]; let i = 0; return () => r[i++] ?? 0.99; };
  const coven = attemptSummoning({
    daedra: DAEDRA[3], gold: 1e6, summonerGuildGroup: 22, rolls: seq(),
  });
  assert.equal(coven.kind, 'failed');
  assert.equal(coven.spawnFoes, true, 'AttemptSummon :256 - covens set daedra on you');
  // ...and ggroup 8 (GGroup8, the OLD wrong literal) does not.
  const notCoven = attemptSummoning({
    daedra: DAEDRA[3], gold: 1e6, summonerGuildGroup: 8, rolls: seq(),
  });
  assert.equal(notCoven.kind, 'failed');
  assert.equal(notCoven.spawnFoes, false);
});

// ── F113 ──────────────────────────────────────────────────────────

test('F113: the cure quote scales by the regional price adjustment', () => {
  // One disease, non-Arkay temple, quality 10 (the quality term
  // vanishes: cost = 2 * regional(base)), mercantile 50 / personality
  // 50 on a quality-10 shop makes CalculateTradePrice a flat
  // (144 * cost) >> 8. Hand-computed from FormulaHelper.cs:
  //   adj 1000: 250 -> 500 before bargaining -> (144*500)>>8 = 281
  //   adj 1250: trunc(250*1250/1000)=312 -> 624 -> (144*624)>>8 = 351
  const entityOf = () => ({
    activeEffects: [{ kind: 'disease' }],
    skillOverrides: { [SKILLS.Mercantile]: 50 },
    stats: { personality: 50 },
  });
  const guild = templeOf('Stendarr');
  const day10 = 10 * 1440;   // no holiday
  const neutral = cureDiseaseOffer(entityOf(), guild, null, {
    quality: 10, regionIndex: 0, nowClassicMinutes: day10,
  });
  assert.equal(neutral.kind, 'offer');
  assert.equal(neutral.cost, 281);
  const dear = cureDiseaseOffer(entityOf(), guild, null, {
    quality: 10, regionIndex: 0, nowClassicMinutes: day10, priceAdjustment: 1250,
  });
  assert.equal(dear.kind, 'offer');
  assert.equal(dear.cost, 351, 'the 750-1250 regional term reaches the quote');
});

test('F113: the host hands the cure flow the live regional adjustment', () => {
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const site = wm.slice(wm.indexOf("destination === 'guildServiceCureDisease'"));
  assert.ok(site.slice(0, 600).includes('priceAdjustment: regionPriceAdjustment(playerEntity,'),
    'buildCureDiseaseFlow receives regionPriceAdjustment, not the neutral default');
});

// ── F114 ──────────────────────────────────────────────────────────

test('F114: the rank-9 knightly promotion consults house ownership', () => {
  // KnightlyOrder.GetPromotionMsgId :144-145, ternary INVERTED as
  // written: OwnsHouse -> PromotionNoHouseId 5241.
  const rose = orderOf('Rose');
  assert.equal(promotionTextId(rose, 9, { ownsHouse: () => true }), 5241);
  assert.equal(promotionTextId(rose, 9, { ownsHouse: () => false }), 5240);
  assert.equal(promotionTextId(rose, 9, {}), 5240, 'no seam reads as no house');
  assert.equal(promotionTextId(rose, 4, { ownsHouse: () => true }), 5238, 'ranks 4/6 ignore the house');
  assert.equal(promotionTextId(rose, 3, { ownsHouse: () => true }), 5237, 'the default is PromotionMsgId');
});

// ── F115 ──────────────────────────────────────────────────────────

test('F115: a non-member never reaches the subclass access switch', () => {
  const rose = orderOf('Rose');
  // The order's own switch answers ReceiveHouse/ReceiveArmor for
  // MEMBERS; a stranger gets NonMemberGuild -> the base switch.
  assert.equal(canAccessService(rose, null, 'ReceiveHouse'), false);
  assert.equal(canAccessService(rose, null, 'ReceiveArmor'), false);
  assert.equal(canAccessService(rose, null, 'Quests'), true, 'quests stay open - that is how you join');
  assert.equal(canAccessService(rose, { guild: 'Order:Rose', rank: 0 }, 'ReceiveHouse'), true,
    'a member of THIS order reaches the order switch');
  // NonMemberGuild\'s one override: Training answers canTrain, true
  // only for templeNotMember - a temple trains strangers, a guild not.
  assert.equal(canAccessService(templeOf('Stendarr'), null, 'Training'), true);
  assert.equal(canAccessService(GUILDS.FightersGuild, null, 'Training'), false);
});

test('F115: the seneschal refuses a stranger with the members-only line', () => {
  // DoGuildService :311-329: CanAccessService false + not a member ->
  // "My services are reserved for members only." - NOT the rank
  // refusal DFU reserves for members below 9.
  const access = serviceAccess(orderOf('Rose'), null, 'ReceiveHouse');
  assert.equal(access.allowed, false);
  assert.equal(access.text, SERVICE_MEMBERS_ONLY);
  assert.equal(access.textId, undefined, 'no 3100 rank box for a stranger');
  // and a MEMBER refused a rank-gated service still gets 3100
  // (Stendarr's buyPotions column is 2; soulGems would be -1, which
  // passes at EVERY rank - the "-1 is not never" law).
  const member = serviceAccess(templeOf('Stendarr'), { guild: 'Temple:Stendarr', rank: 0 }, 'BuyPotions');
  assert.equal(member.allowed, false);
  assert.equal(member.textId, INSUFFICIENT_RANK_ID);
});

// ── F116 ──────────────────────────────────────────────────────────

test('F116: serviceReceiveHouseAlready is DFU\'s exact string', () => {
  // Internal_Strings_en, m_Id 95 - not the paraphrase.
  assert.equal(ALREADY_GIVEN_HOUSE, 'You have already received your house.');
});

// ── F117 ──────────────────────────────────────────────────────────

test('F117: avoidDeath is Stendarr\'s rank-in-fifty, dry only', () => {
  const stendarr = (rank) => ({ 17: { guild: 'Temple:Stendarr', rank } });
  // Random.Range(0,50) < rank: roll 4 with rank 5 survives...
  assert.equal(avoidDeath(stendarr(5), { rolls: () => 4.4 / 50 }), true);
  // ...roll 5 with rank 5 does not (strict <)...
  assert.equal(avoidDeath(stendarr(5), { rolls: () => 5.4 / 50 }), false);
  // ...and rank 0 NEVER survives - 0 < 0 is false on the best roll.
  assert.equal(avoidDeath(stendarr(0), { rolls: () => 0 }), false);
  // Submerged, the blessing does not reach you (Temple.cs:453-454).
  assert.equal(avoidDeath(stendarr(9), { submerged: true, rolls: () => 0 }), false);
  // Only Stendarr overrides the base false.
  assert.equal(avoidDeath({ 17: { guild: 'Temple:Kynareth', rank: 9 } }, { rolls: () => 0 }), false);
  assert.equal(avoidDeath({ 9: { guild: 'Order:Rose', rank: 9 } }, { rolls: () => 0 }), false);
  assert.equal(avoidDeath({}, { rolls: () => 0 }), false);
  assert.equal(AVOID_DEATH_TEXT, 'By the mercy of Stendarr, you survive certain death!');
});

test('F117: the door restores a tenth instead of presenting the death', async () => {
  const { hurtPlayer, setDeathPresenter, setAvoidDeathHook } = await import('../src/characters/playerEntity.js');
  const prevPresent = setDeathPresenter(null);
  const prevAvoid = setAvoidDeathHook(null);
  try {
    let died = 0, asked = 0;
    setDeathPresenter(() => { died++; });

    // Hook answers true: SetHealth's (int)(MaxHealth * 0.1f), no
    // death event, and the blow reports NOT killed.
    setAvoidDeathHook(() => { asked++; return true; });
    const saved = { health: 5, maxHealth: 47 };
    assert.equal(hurtPlayer(saved, 10), false, 'the avoided blow did not kill');
    assert.equal(saved.health, 4, 'trunc(47 * 0.1)');
    assert.equal(died, 0);
    assert.equal(asked, 1);

    // A survivable blow never consults the hook - it is the zero
    // crossing's question (PlayerEntity.cs:1205).
    assert.equal(hurtPlayer(saved, 1), false);
    assert.equal(asked, 1);

    // Hook answers false: the death presents exactly as before.
    setAvoidDeathHook(() => false);
    const doomed = { health: 5, maxHealth: 47 };
    assert.equal(hurtPlayer(doomed, 10), true);
    assert.equal(doomed.health, 0);
    assert.equal(died, 1);

    // The consult rides the TRANSITION, like the presenter: a corpse
    // taking another hit re-raises neither question.
    setAvoidDeathHook(() => { asked = 99; return true; });
    assert.equal(hurtPlayer(doomed, 10), false);
    assert.notEqual(asked, 99, 'no consult past the transition');

    // The bypassShield kill doors (drowning, exhaustion) still reach
    // the consult - DFU routes them through SetHealth(0) too.
    setAvoidDeathHook(() => true);
    const collapsed = { health: 30, maxHealth: 30 };
    assert.equal(hurtPlayer(collapsed, 30, { bypassShield: true }), false);
    assert.equal(collapsed.health, 3);
  } finally {
    setDeathPresenter(prevPresent);
    setAvoidDeathHook(prevAvoid);
  }
});

test('F117: every live host installs the consult beside its presenter', () => {
  // The law is one-homed in guildServices.avoidDeath and the restore
  // on the door; the hosts only wire seams. The dungeon is the one
  // host with a submersion model, so ITS hook passes the breath
  // tick's marker.
  for (const [file, needle] of [
    ['../src/scenes/world.js', 'setAvoidDeathHook(() => {'],
    ['../src/scenes/exterior.js', 'setAvoidDeathHook(() => {'],
    ['../src/scenes/worldModes.js', 'setAvoidDeathHook(() => {'],
    ['../src/scenes/dungeonContext.js', 'avoidDeath(activeMemberships(playerEntity), { submerged: _submergedNow })'],
  ]) {
    const s = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.ok(s.includes(needle), `${file} wires the consult`);
  }
  const d = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.ok(d.includes('_submergedNow = submerged;'), 'the breath tick feeds the marker');
});
