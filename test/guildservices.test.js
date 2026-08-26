// G3: guild services - what rank BUYS. The service NPC table, the rank
// gates, the training rules and the benefit formulas, against
// Services.cs and the Benefits regions of Guild.cs and its subclasses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUILD_SERVICES, NPC_SERVICE, npcServiceKind, hasGuildService,
  TRAINING_SKILLS, TEMPLE_TRAINING_SKILLS, trainingSkills, trainingMax, trainingPrice,
  canAccessService, canAccessLibrary,
  canRest, hallAccessAnytime, freeHealing, freeMagickaRecharge,
  freeTavernRooms, freeShipTravel, alterReward, reducedRepairCost, reducedCureCost,
  avoidDeath, guildAvoidDeath,
} from '../src/systems/guildServices.js';
import { GUILDS, MEMBER_TRAINING_COST, NON_MEMBER_TRAINING_COST, DEFAULT_TRAINING_MAX } from '../src/systems/guilds.js';
import { templeOf, orderOf, TEMPLE_DATA } from '../src/systems/guildVariants.js';
import { SKILLS } from '../src/systems/skills.js';

const at = (rank) => ({ guild: 'x', rank, lastRankChange: 0 });

test('services: the NPC table is DFU\'s switch, not the enum names', () => {
  // Three entries where the name and the switch DISAGREE. A table
  // derived from the enum names - which is the obvious shortcut -
  // gets exactly these three wrong.
  assert.equal(npcServiceKind(60), 'BuySpellsMages', 'MG_BuySpells is NOT BuySpells');
  assert.equal(npcServiceKind(845), 'ReceiveArmor', 'KO_Smith');
  assert.equal(npcServiceKind(848), 'ReceiveHouse', 'KO_Seneschal');
  assert.notEqual(npcServiceKind(60), 'BuySpells');

  assert.equal(Object.keys(NPC_SERVICE).length, 61, "DFU's 61 service NPCs");
  assert.equal(GUILD_SERVICES.length, 20, 'and 20 service kinds');
  for (const [id, kind] of Object.entries(NPC_SERVICE)) {
    assert.ok(GUILD_SERVICES.includes(kind), `NPC ${id} maps to a real service kind`);
  }
  // spot the four guild questors the rank law already knows
  for (const [id, name] of [[63, 'MG'], [851, 'FG'], [804, 'TG'], [807, 'DB']]) {
    assert.equal(npcServiceKind(id), 'Quests', `${name}_Quests`);
  }
  assert.equal(hasGuildService(61), true);
  assert.equal(hasGuildService(9999), false);
  assert.equal(npcServiceKind(9999), null);
});

test('services: -1 in the temple table PASSES the rank gate - it is not "never"', () => {
  // CanAccessService tests `serviceRank <= rank`, so -1 passes at every
  // rank. It reads as "never offered" only because the temple has no
  // NPC for it - the rank gate and the OFFER are different things, and
  // the port's own G2 comment had this backwards.
  const arkay = templeOf('Arkay');
  assert.equal(TEMPLE_DATA.Arkay.buySpells, -1, 'Arkay has no spell service');
  assert.equal(canAccessService(arkay, at(0), 'BuySpells'), true,
    'and the RANK GATE still passes at rank 0 - DFU never asks, because there is no NPC');
  // the same -1 never matches the promotion switch, since ranks are 0..9
  assert.notEqual(arkay.promotionForRank(0), undefined);

  // a real gate still gates
  assert.equal(TEMPLE_DATA.Arkay.summoning, 7);
  assert.equal(canAccessService(arkay, at(6), 'DaedraSummoning'), false);
  assert.equal(canAccessService(arkay, at(7), 'DaedraSummoning'), true);
});

test('services: a temple trains non-members, a guild does not', () => {
  const fg = GUILDS.FightersGuild;
  assert.equal(canAccessService(fg, null, 'Training'), false, 'the Fighters Guild wants a member');
  assert.equal(canAccessService(fg, at(0), 'Training'), true);
  assert.equal(canAccessService(templeOf('Mara'), null, 'Training'), true, 'a temple does not');

  // Quests, Identify, Donate and CureDisease are open to anyone
  for (const s of ['Quests', 'Identify', 'Donate', 'CureDisease']) {
    assert.equal(canAccessService(fg, null, s), true, `${s} is public`);
  }
  assert.equal(canAccessService(fg, null, 'Repair'), false, 'Repair is not');
  assert.equal(canAccessService(fg, null, 'BuySpells'), false, 'and BuySpells is false everywhere but a temple');
  assert.equal(canAccessService(fg, null, 'BuySpellsMages'), true, 'while the MAGES variant is public');
});

test('services: training caps at 50 and costs the split TIMES LEVEL', () => {
  assert.equal(trainingMax(), 50);
  assert.equal(trainingMax(), DEFAULT_TRAINING_MAX, 'no guild overrides it');
  assert.equal(MEMBER_TRAINING_COST, 100);
  assert.equal(NON_MEMBER_TRAINING_COST, 400);
  assert.equal(trainingPrice(at(0), 1), 100, 'a level-1 member');
  assert.equal(trainingPrice(at(9), 1), 100, 'and rank does NOT discount it');
  assert.equal(trainingPrice(at(0), 7), 700, 'it scales with the character, not the skill');
  assert.equal(trainingPrice(null, 7), 2800, 'a non-member pays four times');
});

test('services: a knightly order trains NOTHING, and a temple trains its own list', () => {
  assert.equal(trainingSkills(orderOf('Rose')), null, 'KnightlyOrder.TrainingSkills returns null');
  assert.equal(trainingSkills(GUILDS.FightersGuild).length, 11);
  assert.equal(trainingSkills(templeOf('Zenithar')).length, 12);

  // The TRAINING list is not the GUILD-SKILL list the rank law reads -
  // but not uniformly, and the split is measured rather than assumed.
  // FIVE divines train a wider set than they rank you on; Kynareth,
  // Mara and Zenithar happen to use the same list for both. A blanket
  // "they always differ" is what this pin first asserted, and it was
  // wrong on three of eight.
  const sorted = (a) => [...a].sort((x, y) => x - y);
  const identical = Object.keys(TEMPLE_TRAINING_SKILLS).filter((d) => {
    const t = templeOf(d);
    return JSON.stringify(sorted(t.skills)) === JSON.stringify(sorted(trainingSkills(t)));
  });
  assert.deepEqual(identical, ['Kynareth', 'Mara', 'Zenithar'],
    'exactly these three train what they rank on');
  for (const d of ['Akatosh', 'Arkay', 'Dibella', 'Julianos', 'Stendarr']) {
    const t = templeOf(d);
    assert.ok(trainingSkills(t).length > t.skills.length, `${d} trains MORE than it ranks`);
  }
  const fg = GUILDS.FightersGuild;
  assert.ok(trainingSkills(fg).includes(SKILLS.Jumping), 'the guild trains Jumping');
  assert.ok(!fg.skills.includes(SKILLS.Jumping), 'but never ranks you for it');

  const ids = new Set(Object.values(SKILLS));
  for (const [name, list] of [...Object.entries(TRAINING_SKILLS), ...Object.entries(TEMPLE_TRAINING_SKILLS)]) {
    for (const s of list) assert.ok(s !== undefined && ids.has(s), `${name}: a real skill`);
    assert.equal(new Set(list).size, list.length, `${name}: no skill twice`);
  }
});

test('services: the money formulas TRUNCATE before the multiply', () => {
  // (((10 + rank) << 8) / 10 * reward) >> 8 is C# int arithmetic: the
  // /10 truncates FIRST, so a rank-3 reward is 1296 and not 1300.
  const fg = GUILDS.FightersGuild;
  assert.equal(alterReward(fg, at(0), 1000), 1000, 'rank 0 is no change');
  assert.equal(alterReward(fg, at(3), 1000), 1296, 'not 1300 - the truncation shows');
  assert.equal(alterReward(fg, at(9), 1000), 1898, 'not 1900');
  assert.equal(reducedRepairCost(fg, at(3), 1000), 699, 'not 700');
  assert.equal(reducedRepairCost(fg, at(9), 1000), 97, 'not 100');

  // and only the Fighters Guild alters either
  assert.equal(alterReward(GUILDS.MagesGuild, at(9), 1000), 1000);
  assert.equal(reducedRepairCost(templeOf('Arkay'), at(9), 1000), 1000);
});

test('services: ONLY Arkay discounts curing', () => {
  // The god of burial and the cycle of life is the one who makes it
  // cheaper to be cured.
  assert.equal(reducedCureCost(templeOf('Arkay'), at(5), 1000), 500);
  for (const d of ['Akatosh', 'Dibella', 'Julianos', 'Kynareth', 'Mara', 'Stendarr', 'Zenithar']) {
    assert.equal(reducedCureCost(templeOf(d), at(9), 1000), 1000, `${d} charges full price`);
  }
  assert.equal(reducedCureCost(GUILDS.MagesGuild, at(9), 1000), 1000);
});

test('services: the hall-access and rest benefits, per guild', () => {
  assert.equal(canRest(GUILDS.FightersGuild, at(0)), true, 'members rest in the Fighters hall');
  assert.equal(canRest(GUILDS.FightersGuild, null), false);
  assert.equal(canRest(GUILDS.MagesGuild, at(9)), false, 'and nowhere else');

  for (const n of ['FightersGuild', 'MagesGuild']) {
    assert.equal(hallAccessAnytime(GUILDS[n], at(5)), false, `${n} wants rank 6`);
    assert.equal(hallAccessAnytime(GUILDS[n], at(6)), true);
  }
  for (const n of ['ThievesGuild', 'DarkBrotherhood']) {
    assert.equal(hallAccessAnytime(GUILDS[n], at(0)), true,
      `${n} opens to any member - its hall is not public at any hour`);
    assert.equal(hallAccessAnytime(GUILDS[n], null), false);
  }
  assert.equal(hallAccessAnytime(templeOf('Mara'), at(9)), false);
});

test('services: free healing follows the divine own healing rank', () => {
  assert.equal(TEMPLE_DATA.Arkay.healing, 0, 'Arkay heals from rank 0');
  assert.equal(freeHealing(templeOf('Arkay'), at(0)), true);
  assert.equal(TEMPLE_DATA.Dibella.healing, 2);
  assert.equal(freeHealing(templeOf('Dibella'), at(1)), false);
  assert.equal(freeHealing(templeOf('Dibella'), at(2)), true);
  assert.equal(freeHealing(GUILDS.FightersGuild, at(9)), false, 'no guild heals');
});

test('services: the Mages Guild recharge exists FOR the Sorcerer', () => {
  // FreeMagickaRecharge is gated on Career.NoRegenSpellPoints - the
  // very career flag U20b writes and S23-era work found live. The perk
  // is for the one career that cannot regenerate at all.
  const mg = GUILDS.MagesGuild;
  const sorcerer = { career: { noRegenSpellPoints: true } };
  const mage = { career: { noRegenSpellPoints: false } };
  assert.equal(freeMagickaRecharge(mg, at(0), sorcerer), true);
  assert.equal(freeMagickaRecharge(mg, at(9), mage), false, 'a career that regenerates gets nothing');
  assert.equal(freeMagickaRecharge(mg, null, sorcerer), false, 'and it needs membership');
  assert.equal(freeMagickaRecharge(GUILDS.FightersGuild, at(9), sorcerer), false);
});

test('services: a knight rooms free at rank 4, or anywhere in their OWN region', () => {
  const rose = orderOf('Rose');
  assert.equal(freeTavernRooms(rose, at(3), { regionIndex: 5, orderRegion: 17 }), false);
  assert.equal(freeTavernRooms(rose, at(4), { regionIndex: 5, orderRegion: 17 }), true, 'rank 4 anywhere');
  assert.equal(freeTavernRooms(rose, at(0), { regionIndex: 17, orderRegion: 17 }), true,
    'or any rank at home - a knight is a local somebody there');
  assert.equal(freeTavernRooms(rose, at(0), { regionIndex: 5, orderRegion: 17 }), false);
  assert.equal(freeTavernRooms(GUILDS.FightersGuild, at(9), {}), false, 'orders only');

  assert.equal(freeShipTravel(rose, at(5)), false);
  assert.equal(freeShipTravel(rose, at(6)), true);
  assert.equal(freeShipTravel(GUILDS.FightersGuild, at(9)), false);
});

test('services: temples open their library at their own rank; the Mages Guild at 2', () => {
  assert.equal(TEMPLE_DATA.Julianos.library, 0, 'the god of wisdom opens his at rank 0');
  assert.equal(canAccessLibrary(templeOf('Julianos'), at(0)), true);
  assert.equal(TEMPLE_DATA.Dibella.library, 4);
  assert.equal(canAccessLibrary(templeOf('Dibella'), at(3)), false);
  assert.equal(canAccessLibrary(templeOf('Dibella'), at(4)), true);
  // AUDIT 23 (guilds-6): MagesGuild.CanAccessLibrary overrides the
  // same predicate at rank >= 2 (MagesGuild.cs:129-132) - the old pin
  // encoded the port's own gap as a law.
  assert.equal(canAccessLibrary(GUILDS.MagesGuild, at(1)), false);
  assert.equal(canAccessLibrary(GUILDS.MagesGuild, at(2)), true);
  assert.equal(canAccessLibrary(GUILDS.FightersGuild, at(9)), false, 'no other guild has one');
});

test('AUDIT 26 F117: Temple.AvoidDeath is STENDARR only, max-exclusive, and no use under water', () => {
  // Temple.cs:450-458:
  //   deity == Divines.Stendarr && !IsPlayerSubmerged &&
  //   UnityEngine.Random.Range(0, 50) < rank
  const stendarr = templeOf('Stendarr');
  const roll = (n) => () => n / 50;            // Random.Range(0, 50) -> n
  // rank 0 is never saved: Range is max-EXCLUSIVE, so the lowest draw
  // is 0 and `0 < 0` is false.
  assert.equal(avoidDeath(stendarr, at(0), { rolls: roll(0) }), false);
  assert.equal(avoidDeath(stendarr, at(1), { rolls: roll(0) }), true);
  // the boundary at every rank: draw == rank fails, draw == rank-1 saves
  for (let rank = 1; rank <= 9; rank++) {
    assert.equal(avoidDeath(stendarr, at(rank), { rolls: roll(rank - 1) }), true, `rank ${rank}`);
    assert.equal(avoidDeath(stendarr, at(rank), { rolls: roll(rank) }), false, `rank ${rank} boundary`);
  }
  // the top of the range never saves anybody - ranks stop at 9
  assert.equal(avoidDeath(stendarr, at(9), { rolls: roll(49) }), false);
  // SUBMERGED disqualifies it outright: drowning is not survivable here
  assert.equal(avoidDeath(stendarr, at(9), { submerged: true, rolls: roll(0) }), false);
  // and no other guild overrides Guild.AvoidDeath's `return false`
  for (const divine of ['Arkay', 'Julianos', 'Mara', 'Akatosh', 'Zenithar', 'Kynareth', 'Dibella']) {
    assert.equal(avoidDeath(templeOf(divine), at(9), { rolls: roll(0) }), false, divine);
  }
  assert.equal(avoidDeath(GUILDS.FightersGuild, at(9), { rolls: roll(0) }), false);
  assert.equal(avoidDeath(orderOf('TheRose'), at(9), { rolls: roll(0) }), false);
  assert.equal(avoidDeath(null, at(9), { rolls: roll(0) }), false, 'no guild at all');

  // GuildManager.AvoidDeath (GuildManager.cs:396-402) folds over EVERY
  // membership and answers at the first guild that says yes.
  const member = (guild, rank) => ({ [guild.guildGroup]: { guild: guild.name, rank, lastRankChange: 0 } });
  assert.equal(guildAvoidDeath(member(stendarr, 9), { rolls: roll(0) }), true);
  assert.equal(guildAvoidDeath(member(stendarr, 9), { submerged: true, rolls: roll(0) }), false);
  assert.equal(guildAvoidDeath(member(templeOf('Arkay'), 9), { rolls: roll(0) }), false);
  assert.equal(guildAvoidDeath({ ...member(GUILDS.FightersGuild, 9), ...member(stendarr, 4) },
    { rolls: roll(3) }), true, 'a Stendarr membership among others still answers');
  assert.equal(guildAvoidDeath({}, { rolls: roll(0) }), false, 'no memberships');
  assert.equal(guildAvoidDeath(null, { rolls: roll(0) }), false, 'no store at all');
});

test('AUDIT 26 F117: the killing blow ASKS the guilds, and a saved player keeps 10% of MaxHealth', async () => {
  // PlayerEntity.SetHealth (:1204-1213): health at zero calls
  // GuildManager.AvoidDeath first, and a member it saves is set to
  // `(int)(MaxHealth * 0.1f)` instead of raising OnDeath. The port's
  // one damage door is characters/playerEntity.hurtPlayer.
  const { hurtPlayer, setDeathPresenter } = await import('../src/characters/playerEntity.js');
  const stendarr = templeOf('Stendarr');
  const faithful = () => ({
    health: 30, maxHealth: 37,
    guildMemberships: { [stendarr.guildGroup]: { guild: stendarr.name, rank: 9, lastRankChange: 0 } },
  });
  const prevPresenter = setDeathPresenter(null);
  const prevRandom = Math.random;
  try {
    let died = 0;
    setDeathPresenter(() => { died++; });

    Math.random = () => 0;                   // Random.Range(0, 50) -> 0 < rank 9
    const saved = faithful();
    assert.equal(hurtPlayer(saved, 999), false, 'the blow does not kill a member Stendarr saves');
    assert.equal(saved.health, 3, '(int)(37 * 0.1f)');
    assert.equal(died, 0, 'and the death screen never comes up');

    Math.random = () => 49 / 50;             // Random.Range(0, 50) -> 49, no save at any rank
    const doomed = faithful();
    assert.equal(hurtPlayer(doomed, 999), true);
    assert.equal(doomed.health, 0);
    assert.equal(died, 1);

    // AND DROWNING IS STILL FATAL. breathStep records the host's
    // IsPlayerSubmerged on the entity (breath.js), which is the flag
    // Temple.cs:452 excludes: the same member, saved above, dies when
    // the killing blow lands under water.
    Math.random = () => 0;
    const drowning = faithful();
    drowning.submerged = true;
    assert.equal(hurtPlayer(drowning, drowning.health, { bypassShield: true }), true,
      'SetHealth(0) while submerged is not survivable');
    assert.equal(drowning.health, 0);
    assert.equal(died, 2);

    // a player in no guild at all dies exactly as before
    Math.random = () => 0;
    const nobody = { health: 10, maxHealth: 10 };
    assert.equal(hurtPlayer(nobody, 99), true);
    assert.equal(nobody.health, 0);
    assert.equal(died, 3);
  } finally {
    Math.random = prevRandom;
    setDeathPresenter(prevPresenter);
  }
});
