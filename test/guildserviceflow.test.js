import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SERVICE_LABEL, serviceLabel, SERVICE_MEMBERS_ONLY, INSUFFICIENT_RANK_ID,
  YOU_ARE_HEALED_ID, TEMPLE_RESET_STATS, SORCEROR_MAGICKA_RECHARGE,
  NO_POTION_INGREDIENTS, SPYMASTER_GREETING_ID, TG_SPYMASTER_FACTION_ID,
  staticNpcRoute, showsJoinButton, serviceAccess, onPushEffects,
  hasDamagedAttributes, cureAllAttributes, serviceDestination,
} from '../src/systems/guildServiceFlow.js';
import { GUILD_SERVICES } from '../src/systems/guildServices.js';
import { GUILDS, joinGuild, daySinceZero } from '../src/systems/guilds.js';
import { templeOf, createGuildForGroup } from '../src/systems/guildVariants.js';
import { GUILD_GROUPS, SOCIAL_GROUPS, FACTION_TYPES } from '../src/formats/factionFile.js';
import { createFactionRep } from '../src/systems/factionRep.js';
import { SKILLS } from '../src/systems/skills.js';

const BUILDING = { Bank: 3, GuildHall: 11, Temple: 14, Tavern: 15, WeaponSmith: 13, GeneralStore: 9, House1: 17 };
const isShop = (t) => t === BUILDING.WeaponSmith || t === BUILDING.GeneralStore;
const isRepairShop = (t) => t === BUILDING.WeaponSmith || t === BUILDING.GeneralStore;
const routeDeps = { isShop, isRepairShop, isBank: (t) => t === BUILDING.Bank, isTavern: (t) => t === BUILDING.Tavern };

const faction = (o) => ({ id: 0, ggroup: GUILD_GROUPS.None, sgroup: SOCIAL_GROUPS.None, type: FACTION_TYPES.Group, ...o });

// ---------------------------------------------------------------------------
// StaticNPCClick's routing (PlayerActivate.cs:1512-1607)
// ---------------------------------------------------------------------------

test('U23: a guild-service NPC in a hall of that guild opens the popup', () => {
  const r = staticNpcRoute({
    npcFactionId: 61,   // MG_Training
    npcFaction: faction({ id: 61, ggroup: GUILD_GROUPS.MagesGuild }),
    buildingFaction: faction({ id: 40, ggroup: GUILD_GROUPS.MagesGuild }),
    buildingType: BUILDING.GuildHall, ...routeDeps,
  });
  assert.deepEqual(r, { kind: 'guildService', guildGroup: GUILD_GROUPS.MagesGuild, buildingFactionId: 40 });
});

test('U23: a building with NO guild group falls back to the NPC\'s own', () => {
  // DFU's comment: "Use NPC guild group if building has none (e.g.
  // Temple buildings of divine faction)". Arkay's hall is faction 21,
  // a divine, so IsDivine passes and the escape does not fire.
  const r = staticNpcRoute({
    npcFactionId: 241,   // TAr_Training
    npcFaction: faction({ id: 241, ggroup: GUILD_GROUPS.HolyOrder }),
    buildingFaction: faction({ id: 21, ggroup: GUILD_GROUPS.None }),
    buildingType: BUILDING.Temple, ...routeDeps,
  });
  assert.deepEqual(r, { kind: 'guildService', guildGroup: GUILD_GROUPS.HolyOrder, buildingFactionId: 21 });
});

test('U23: bug t=1238 - a holy-order NPC in a NON-divine building talks instead', () => {
  const r = staticNpcRoute({
    npcFactionId: 241,
    npcFaction: faction({ id: 241, ggroup: GUILD_GROUPS.HolyOrder }),
    buildingFaction: faction({ id: 9999, ggroup: GUILD_GROUPS.None }),   // not one of the eight
    buildingType: BUILDING.House1, ...routeDeps,
  });
  assert.deepEqual(r, { kind: 'talk', spymaster: false });
});

test('U23: bug t=2037 - the TG spymaster in a faction-less building talks, AS the spymaster', () => {
  const npc = faction({ id: TG_SPYMASTER_FACTION_ID, ggroup: GUILD_GROUPS.GeneralPopulace });
  const r = staticNpcRoute({
    npcFactionId: TG_SPYMASTER_FACTION_ID, npcFaction: npc,
    buildingFaction: null, buildingType: BUILDING.House1, ...routeDeps,
  });
  // The third TalkToStaticNPC argument is what makes this different
  // from an ordinary talk, so it has to survive the routing.
  assert.deepEqual(r, { kind: 'talk', spymaster: true });
  // ...and with a real building faction it is a service after all
  const r2 = staticNpcRoute({
    npcFactionId: TG_SPYMASTER_FACTION_ID, npcFaction: npc,
    buildingFaction: faction({ id: 42, ggroup: GUILD_GROUPS.None }),
    buildingType: BUILDING.House1, ...routeDeps,
  });
  assert.equal(r2.kind, 'guildService');
});

test('U23: merchants route by BUILDING type, not by the NPC', () => {
  const merchant = faction({ id: 510, sgroup: SOCIAL_GROUPS.Merchants });
  const at = (buildingType) => staticNpcRoute({
    npcFactionId: 510, npcFaction: merchant, buildingFaction: null, buildingType, ...routeDeps,
  });
  assert.deepEqual(at(BUILDING.WeaponSmith), { kind: 'merchant', service: 'repair' });
  assert.deepEqual(at(BUILDING.Bank), { kind: 'merchant', service: 'banking' });
  assert.deepEqual(at(BUILDING.Tavern), { kind: 'merchant', service: 'tavern' });
  assert.deepEqual(at(BUILDING.House1), { kind: 'talk', spymaster: false });
});

test('U23: a witches coven, and an unresolvable faction', () => {
  assert.deepEqual(staticNpcRoute({
    npcFactionId: 510, npcFaction: faction({ type: FACTION_TYPES.WitchesCoven }), ...routeDeps,
  }), { kind: 'witchesCoven' });
  // GetFactionData missing -> DFU's outer else: talk
  assert.deepEqual(staticNpcRoute({ npcFactionId: 12345, npcFaction: null, ...routeDeps }),
    { kind: 'talk', spymaster: false });
});

// ---------------------------------------------------------------------------
// Setup / DoGuildService
// ---------------------------------------------------------------------------

test('U23: the join button is hidden for the two invitation-only groups (:107-112)', () => {
  const none = {};
  assert.equal(showsJoinButton(none, GUILD_GROUPS.FightersGuild), true);
  // "exempt Thieves Guild and Dark Brotherhood since should never find
  // em until a member" - and the Thieves Guild's group IS GeneralPopulace
  assert.equal(showsJoinButton(none, GUILD_GROUPS.DarkBrotherHood), false);
  assert.equal(showsJoinButton(none, GUILD_GROUPS.GeneralPopulace), false);
  const joined = {};
  joinGuild(joined, GUILDS.FightersGuild, { year: 405, dayOfYear: 1 });
  assert.equal(showsJoinButton(joined, GUILD_GROUPS.FightersGuild), false);
});

test('U23: the two refusals are different, and say different things (:311-329)', () => {
  // A NON-MEMBER is told to join; a MEMBER of too low a rank is told
  // 3100. Training is the base guilds' member-only service, and
  // Akatosh gates potions at service rank 4, so a rank-0 member of his
  // temple is the low-rank case.
  const nonMember = serviceAccess(GUILDS.FightersGuild, null, 'Training');
  assert.deepEqual(nonMember, { allowed: false, text: SERVICE_MEMBERS_ONLY });
  const akatosh = templeOf('Akatosh');
  const low = serviceAccess(akatosh, { guild: akatosh.name, rank: 0 }, 'BuyPotions');
  assert.deepEqual(low, { allowed: false, textId: INSUFFICIENT_RANK_ID });
  assert.equal(INSUFFICIENT_RANK_ID, 3100);
  // ...and rank 4 clears it, so the gate is the RANK and not the guild
  assert.deepEqual(serviceAccess(akatosh, { guild: akatosh.name, rank: 4 }, 'BuyPotions'), { allowed: true });
  // a service open to everyone refuses nobody
  assert.deepEqual(serviceAccess(GUILDS.FightersGuild, null, 'Quests'), { allowed: true });
});

test('U23: every guild service has a label, and they are DFU\'s strings', () => {
  for (const s of GUILD_SERVICES) {
    assert.ok(SERVICE_LABEL[s], `no label for ${s}`);
  }
  assert.equal(serviceLabel('Training'), 'Training');
  assert.equal(serviceLabel('Quests'), 'Get Quest');
  assert.equal(serviceLabel('Repair'), 'Repairs');
  assert.equal(serviceLabel('Donate'), 'Make Donation');
  assert.equal(serviceLabel('Teleport'), 'Teleportation');
  assert.equal(serviceLabel('BuySoulgems'), 'Buy Soulgems');
  // the two spell-buying services share one label (:379-381)
  assert.equal(serviceLabel('BuySpells'), serviceLabel('BuySpellsMages'));
  assert.equal(serviceLabel('NotAService'), '?');   // DFU's `default:`
  // and every kind is accounted for in the destination table, so a new
  // service cannot silently fall through the popup
  for (const s of GUILD_SERVICES) {
    assert.ok(Object.hasOwn(SERVICE_LABEL, s) && serviceDestination(s) !== undefined, s);
  }
});

test('U23: the window\'s four quoted text ids (:29-32, :455)', () => {
  assert.equal(NO_POTION_INGREDIENTS, 34);
  assert.equal(SORCEROR_MAGICKA_RECHARGE, 465);
  assert.equal(TEMPLE_RESET_STATS, 403);
  assert.equal(YOU_ARE_HEALED_ID, 350);
  assert.equal(SPYMASTER_GREETING_ID, 402);
});

// ---------------------------------------------------------------------------
// OnPush (:158-205)
// ---------------------------------------------------------------------------

const playerFor = (over = {}) => ({
  name: 'Bob', level: 1, health: 10, maxHealth: 30, magicka: 5, maxMagicka: 20,
  career: {}, activeEffects: [],
  skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
  ...over,
});

test('U23: free healing heals FIRST and shows 350 only when hurt', () => {
  const e = playerFor();
  const steps = onPushEffects(e, GUILDS.FightersGuild, {}, null, { year: 405, dayOfYear: 1 }, { freeHealing: true });
  assert.equal(e.health, 30, 'SetHealth(MaxHealth) already happened');
  assert.deepEqual(steps.map((s) => s.textId), [YOU_ARE_HEALED_ID]);
  // at full health there is no box at all
  const e2 = playerFor({ health: 30 });
  assert.deepEqual(onPushEffects(e2, GUILDS.FightersGuild, {}, null, { year: 405, dayOfYear: 1 }, { freeHealing: true }), []);
});

test('U23: damaged attributes ASK before curing, and the Yes branch cures', () => {
  const e = playerFor({ health: 30, activeEffects: [{ kind: 'drainAttribute', stat: 'strength', magnitude: 7 }] });
  assert.equal(hasDamagedAttributes(e), true);
  const steps = onPushEffects(e, GUILDS.FightersGuild, {}, null, { year: 405, dayOfYear: 1 }, { freeHealing: true });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].textId, TEMPLE_RESET_STATS);
  assert.equal(steps[0].buttons, 'YesNo');
  assert.equal(hasDamagedAttributes(e), true, 'nothing is cured until Yes');
  steps[0].onYes();
  assert.equal(hasDamagedAttributes(e), false);
  // a POSITIVE mod (a drug's fortify) is not damage and must survive
  const e2 = playerFor({ activeEffects: [{ kind: 'poison', statMods: { speed: 5 } }] });
  assert.equal(hasDamagedAttributes(e2), false);
  assert.equal(cureAllAttributes(e2), 0);
  assert.equal(e2.activeEffects[0].statMods.speed, 5);
});

test('U23: the sorceror recharge shows 465 and refills, only when low', () => {
  const e = playerFor({ health: 30 });
  const steps = onPushEffects(e, GUILDS.MagesGuild, {}, null, { year: 405, dayOfYear: 1 }, { freeMagickaRecharge: true });
  assert.deepEqual(steps.map((s) => s.textId), [SORCEROR_MAGICKA_RECHARGE]);
  assert.equal(e.magicka, 20);
  const full = playerFor({ health: 30, magicka: 20 });
  assert.deepEqual(onPushEffects(full, GUILDS.MagesGuild, {}, null, { year: 405, dayOfYear: 1 }, { freeMagickaRecharge: true }), []);
});

test('U23: OnPush runs UpdateRank and carries ITS text id, not a recomputed one', () => {
  // A member who has earned rank 1 and waited the 28 days is promoted
  // the moment the popup opens.
  const guild = GUILDS.FightersGuild;
  const store = createFactionRep(new Map([[guild.factionId, { id: guild.factionId, rep: 30, children: [] }]]));
  const e = playerFor({ health: 30, magicka: 20 });
  for (const s of guild.skills) e.skills[s] = 40;
  const memberships = {};
  joinGuild(memberships, guild, { year: 405, dayOfYear: 1 });
  const steps = onPushEffects(e, guild, memberships, store, { year: 405, dayOfYear: 29 });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].rankChange.outcome, 'promotion');
  assert.equal(steps[0].textId, steps[0].rankChange.textId);
  assert.ok(memberships[guild.guildGroup].rank > 0);
  assert.equal(memberships[guild.guildGroup].lastRankChange, daySinceZero({ year: 405, dayOfYear: 29 }));
});

test('U23: GuildManager.CreateGuildObj picks the right guild per group', () => {
  assert.equal(createGuildForGroup(GUILD_GROUPS.FightersGuild).name, 'FightersGuild');
  assert.equal(createGuildForGroup(GUILD_GROUPS.MagesGuild).name, 'MagesGuild');
  // the Thieves Guild really does sit under GeneralPopulace
  assert.equal(createGuildForGroup(GUILD_GROUPS.GeneralPopulace).name, 'ThievesGuild');
  assert.equal(createGuildForGroup(GUILD_GROUPS.DarkBrotherHood).name, 'DarkBrotherhood');
  // the variant groups need the building's faction id
  assert.equal(createGuildForGroup(GUILD_GROUPS.KnightlyOrder, 409).name, orderName('Rose'));
  assert.equal(createGuildForGroup(GUILD_GROUPS.KnightlyOrder, 0), null);
  assert.equal(createGuildForGroup(GUILD_GROUPS.Bards), null);   // DFU's `default: return null`
  // Arkay's hall, through the divine table
  const arkay = createGuildForGroup(GUILD_GROUPS.HolyOrder, 21, new Map());
  assert.equal(arkay.name, templeOf('Arkay').name);
});
const orderName = (o) => `Order:${o}`;
