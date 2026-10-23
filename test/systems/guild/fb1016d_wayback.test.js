// WAY-BACK (FIELD BUGS 2026-10-16d; Glade on Discord: "I failed a quest for the Mages Guild yesterday that put me down
// to -55 rep, now I'm at -53 rep, but they kicked me out so I can't do any quests to recover. It's unclear to me whether
// I'll have to remake my character or wait IRL weeks just to get back to 0"). Both roads back were open and nothing
// said either: a stranger may ask a hall's quest-giver for work, each quest done pays the guild DFU's +5, and a standing
// below 0 recovers a point every 7 days of the character's own time. The hall (the enhanced skin), the join's refusal
// (the classic skin) and the Standing page now say so, with the numbers the law moves by. AUDIT WAY-BACK
// (bible/01-Overview/audits/Audit-Way-Back.md) read it cold: the guild skills the join also asks, a shut hall, time logged
// off, and the chapter writs the Roll's pace does not bound are said too.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUILDS, joinGuild, activeMemberships, guildOfFaction, guildFactionIdOfGroup } from '../../../src/systems/guild/guilds.js';
import { templeOf, orderOf, DIVINES, ORDERS, resolveVariantGuild } from '../../../src/systems/guild/guildVariants.js';
import { canAccessService } from '../../../src/systems/guild/guildServices.js';
import { createFactionRep, setReputation } from '../../../src/systems/faction/factionRep.js';
import { wayBackLines, wayBackQuestLine } from '../../../src/systems/guild/guildServiceFlow.js';
import { setStandingOwed } from '../../../src/systems/standingOwed.js';
import { PORT_SPECS } from '../../../src/ui/enhanced/enhancedPorts.js';
import { GuildServiceWindow } from '../../../src/ui/guildServiceWindow.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { QuestListsManager } from '../../../src/systems/quest/questLists.js';
import { QuestOfferFlow } from '../../../src/systems/quest/offerFlow.js';
import { GUILD_GROUPS, FACTION_TYPES } from '../../../src/formats/factionFile.js';
import { offerGuildSurface } from '../../../src/scenes/quest/questBridge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const MAGES = GUILDS.MagesGuild.factionId;
const storeOf = (reps) => {
  const dict = new Map(Object.keys(reps).map((id) => [Number(id), { id: Number(id), parent: 0, rep: 0, flags: 0, power: 50,
    ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, type: -1, ggroup: 0, name: `F${id}` }]));   // FACTION_TYPES.None: no group of the page's by type (0 is the Daedra's)
  const store = createFactionRep(dict);
  for (const [id, rep] of Object.entries(reps)) setReputation(store, Number(id), rep);
  return store;
};
const STANDING = 'Your standing here is -53. It takes members at 0 or more.';
const QUESTS = (tail) => `As a stranger you may still ask its quest-giver for work: each quest done raises your standing 5${tail}.`;
const DRIFT = 'Below 0 your standing also recovers a point every 7 days of your own time. Rests and journeys count.';
const DRIFT_ONLINE = 'Below 0 your standing also recovers a point every 7 days of your own time. Rests and journeys count, and so does time logged off.';
const PACE = (owed) => `Online, quests and the recovery raise it by at most 15 a real day (days start at midnight UTC)${owed}. On top of that, a chapter writ of the guild's on a notice board adds 2.`;
/** A character whose guild skills meet rank 0's bars (one at 22, a second at 4), as the join reads them - and one with none. */
const skilled = (g) => ({ name: 'Glade', skills: Object.fromEntries(g.skills.map((sk) => [sk, 30])) });
const UNSKILLED = { name: 'Glade', skills: {} };
afterEach(() => setStandingOwed(null));

test('WAY-BACK: a stranger at -53 is told the standing the guild takes, the quests that reach it at DFU\'s +5 each, and REP4\'s week - online also time logged off, and the Roll\'s day with its chapter writs; what the Roll owes counts toward the line on both (mutants: the count floored, the owed not counted, the pace said offline, the log-off said offline, the week not the law\'s, the writ not the law\'s)', () => {
  const g = GUILDS.MagesGuild, store = storeOf({ [MAGES]: -53 });
  assert.deepEqual(wayBackLines(g, skilled(g), {}, store), [STANDING, QUESTS(' - 11 more quests reach 0'), DRIFT]);
  assert.deepEqual(wayBackLines(g, skilled(g), {}, store, { online: true, paced: true }), [STANDING, QUESTS(' - 11 more quests reach 0'), DRIFT_ONLINE, PACE('')]);
  assert.deepEqual(wayBackLines(g, skilled(g), {}, store, { online: true }), [STANDING, QUESTS(' - 11 more quests reach 0'), DRIFT_ONLINE], 'online with the Roll stopped: no pace said');
  setStandingOwed({ [MAGES]: 10 });
  const owed = wayBackLines(g, skilled(g), {}, store, { online: true, paced: true });
  assert.equal(owed[1], QUESTS(' - 9 more quests reach 0'), 'the 10 owed counts');
  assert.equal(owed[3], PACE(', with 10 more standing on the way'));
  // AUDIT WAY-BACK L2-3: a lease's stop keeps the owed and stops the pace - the count still reads it, as the page's does
  assert.equal(wayBackLines(g, skilled(g), {}, store, { online: true })[1], QUESTS(' - 9 more quests reach 0'));
  setStandingOwed({ [MAGES]: 60 });
  assert.equal(wayBackLines(g, skilled(g), {}, store, { paced: true })[1], QUESTS(''), 'the owed reaches 0 on its own');
  setStandingOwed(null);
  assert.equal(wayBackLines(g, skilled(g), {}, storeOf({ [MAGES]: -1 }))[1], QUESTS(' - 1 more quest reaches 0'));
  assert.equal(wayBackLines(g, skilled(g), {}, storeOf({ [MAGES]: -100 }))[1], QUESTS(' - 20 more quests reach 0'));
});

test('WAY-BACK: the join\'s other bar is said with it - a stranger short of the guild skills is told the skills rank 0 asks, beside the standing (AUDIT WAY-BACK L1-4, L3-1); and a hall a Crackdown shut says its own Get Quest is closed and the guild\'s other halls are not (L1-3) (mutants: the skills never said, said to the skilled, the shut line dropped)', () => {
  const g = GUILDS.MagesGuild, store = storeOf({ [MAGES]: -53 });
  const SKILLS = 'It also asks one of its guild skills at 22 and a second at 4: Alteration, Destruction, Illusion, Mysticism, Restoration, Thaumaturgy.';
  assert.deepEqual(wayBackLines(g, UNSKILLED, {}, store), [STANDING, SKILLS, QUESTS(' - 11 more quests reach 0'), DRIFT]);
  const oneHigh = { name: 'Glade', skills: { [g.skills[0]]: 22 } };
  assert.equal(wayBackLines(g, oneHigh, {}, store)[1], SKILLS, 'one guild skill at the high bar is not two');
  assert.equal(wayBackLines(g, { name: 'Glade', skills: { [g.skills[0]]: 22, [g.skills[1]]: 4 } }, {}, store).includes(SKILLS), false, 'one at 22, a second at 4: the bars met');
  assert.deepEqual(wayBackLines(g, skilled(g), {}, store, { shut: true }),
    [STANDING, QUESTS(' - 11 more quests reach 0'), 'This hall is shut this Season. The guild\'s halls in other regions still give work.', DRIFT]);
});

test('WAY-BACK: said only where a join is offered and refused on the standing - not at 0, not to a member of the slot (this guild, or another temple or order in it), not for a guild joined by invitation, not without a store (mutants: the line at 0, the slot read as this guild alone, the invitation gate dropped)', () => {
  const g = GUILDS.MagesGuild;
  assert.equal(wayBackLines(g, skilled(g), {}, storeOf({ [MAGES]: 0 })), null, 'at 0 the join takes the standing');
  const book = activeMemberships({});
  joinGuild(book, g, { year: 405, dayOfYear: 1 });
  assert.equal(wayBackLines(g, skilled(g), book, storeOf({ [MAGES]: -5 })), null, 'a member: the review\'s words are theirs');
  const mara = templeOf('Mara'), arkay = templeOf('Arkay');
  const arkayStore = storeOf({ [DIVINES.Arkay]: -20 });
  const temples = activeMemberships({});
  assert.equal(wayBackLines(arkay, skilled(arkay), temples, arkayStore).length, 3, 'a stranger to every temple: Arkay\'s way in');
  joinGuild(temples, mara, { year: 405, dayOfYear: 1 });
  assert.equal(wayBackLines(arkay, skilled(arkay), temples, arkayStore), null, 'Mara\'s member is offered no join at Arkay\'s (showsJoinButton)');
  assert.equal(wayBackLines(orderOf('Dragon'), skilled(orderOf('Dragon')), {}, storeOf({ [ORDERS.Dragon]: -3 })).length, 3);
  assert.equal(wayBackLines(GUILDS.ThievesGuild, UNSKILLED, {}, storeOf({ [GUILDS.ThievesGuild.factionId]: -30 })), null, 'joined by invitation alone');
  assert.equal(wayBackLines(GUILDS.DarkBrotherhood, UNSKILLED, {}, storeOf({ [GUILDS.DarkBrotherhood.factionId]: -30 })), null);
  assert.equal(wayBackLines(g, skilled(g), {}, null), null);
  assert.equal(wayBackQuestLine(g, {}, storeOf({ [MAGES]: -53 })), QUESTS(' - 11 more quests reach 0'), 'the page\'s line is the hall\'s');
  assert.equal(wayBackQuestLine(g, book, storeOf({ [MAGES]: -53 })), null);
});

// The road the words name is real: through the vendored lists and the real offer flow, a stranger far below 0 is given
// the guild's Get Quest and drawn from its non-member quests - for every guild a stranger walks into.
loadQuestTables(Object.fromEntries(readdirSync(join(VENDOR, 'Tables')).filter((f) => f.endsWith('.txt'))
  .map((f) => [f.replace('.txt', ''), read(join(VENDOR, 'Tables', f))])));
/** TEST THE SHAPE THE PRODUCER MINTS (AUDIT WAY-BACK L4-4): the guild surface the bridge mints for the hall's offer
 *  (questBridge.js offerGuildSurface - a stranger's `membership: null`) and the host's own group->faction door
 *  (world.js `getGuildFactionId: (g) => guildFactionIdOfGroup(g)`); the building's faction is the hall's. */
const strangerPool = (guildGroup, guild, buildingFactionId) => {
  const m = new QuestMachine({ nowSeconds: () => 0, playerLevel: () => 12, getReputation: () => -53 });
  const lists = new QuestListsManager({
    readListTable: (name) => { try { return read(join(VENDOR, 'Tables', `QuestList-${name}.txt`)); } catch { return null; } },
    getQuestSourceLines: () => null,
    parseQuest: () => null,
  });
  const flow = new QuestOfferFlow(m, lists, { getGuildFactionId: (g) => guildFactionIdOfGroup(g), guildQuestListBox: true, sharedClock: () => true });
  flow.offerGuildQuest({ guildGroup, buildingFactionId, guild: offerGuildSurface({ guildGroup, guild, membership: null, reputation: -53 }) });
  return { names: flow.questPool.map((q) => q.name), factionId: flow._getFactionIdForGuild() };
};

test('WAY-BACK: the stranger\'s road is real - at -53 a non-member\'s Get Quest opens, and the Mages Guild, the Fighters Guild, a temple and an order each draw from their non-member quests, the reward\'s faction the guild\'s own (mutant: none here - a pin on the law the words read)', () => {
  for (const g of [GUILDS.MagesGuild, GUILDS.FightersGuild, templeOf('Arkay'), orderOf('Dragon')]) {
    assert.equal(canAccessService(g, null, 'Quests'), true, `${g.name}: a stranger's Get Quest`);
  }
  const classic = read(join(VENDOR, 'Tables', 'QuestList-Classic.txt'));
  const nonMember = (group) => [...classic.matchAll(new RegExp(`^(\\w+), ${group}, N, 0,`, 'gm'))].map((r) => r[1]);
  assert.deepEqual(nonMember('MagesGuild'), ['N0C00Y10', 'N0C00Y11', 'N0C00Y12', 'N0C00Y13']);
  for (const [group, groupName, guild, building, factionId] of [
    [GUILD_GROUPS.MagesGuild, 'MagesGuild', GUILDS.MagesGuild, 0, MAGES],
    [GUILD_GROUPS.FightersGuild, 'FightersGuild', GUILDS.FightersGuild, 0, GUILDS.FightersGuild.factionId],
    [GUILD_GROUPS.HolyOrder, 'HolyOrder', templeOf('Arkay'), DIVINES.Arkay, DIVINES.Arkay],
    [GUILD_GROUPS.KnightlyOrder, 'KnightlyOrder', orderOf('Dragon'), ORDERS.Dragon, ORDERS.Dragon]]) {
    const pool = strangerPool(group, guild, building);
    assert.ok(pool.names.length > 0, `${groupName}: work for a stranger`);
    for (const n of nonMember(groupName)) assert.ok(pool.names.includes(n), `${groupName}: ${n}`);
    assert.equal(pool.factionId, factionId, `${groupName}: the +5 is the guild's own`);
  }
});

test('WAY-BACK: the enhanced hall shows a stranger the way in above its buttons; a member keeps the next rank\'s line (mutant: the stranger\'s line not drawn)', () => {
  const lines = wayBackLines(GUILDS.MagesGuild, UNSKILLED, {}, storeOf({ [MAGES]: -53 }));
  const hooks = (member) => ({ member: () => member, service: () => 'Quests', rows: () => [], steps: () => [],
    rankNeeds: () => ['Next rank: Journeyman'], wayBack: () => lines });
  assert.deepEqual(PORT_SPECS.guild.view(new GuildServiceWindow(hooks(false))).blocks[0], { type: 'text', rows: lines, scroll: true });
  assert.deepEqual(PORT_SPECS.guild.view(new GuildServiceWindow(hooks(true))).blocks[0].rows, ['Next rank: Journeyman']);
  assert.equal(PORT_SPECS.guild.view(new GuildServiceWindow({ ...hooks(false), wayBack: () => null })).blocks.some((b) => b.type === 'text'), false);
});

test('WAY-BACK: the interior host hands the hall its way in - the character\'s skills, the shared clock, the Roll\'s pace while it holds, a shut hall as the popup found it - and on the classic skin puts it under DFU\'s refusal of a join; on the enhanced skin the hall\'s well says it and the refusal is DFU\'s record alone (AUDIT WAY-BACK L2-2/4/5) (mutants: the hook dropped, the refusal bare, the refusal doubled on the enhanced skin, the shut not read)', () => {
  const wm = read(join(ROOT, 'src/scenes/worldModes.js'));
  assert.ok(wm.includes('    const shutAtOpen = !!shutBox();'), 'the shut asked once, as the popup opens');
  assert.ok(wm.includes('    const wayBack = () => wayBackLines(guild, playerEntity, memberships, store, { paced: !!host.rollPace?.(guild.factionId), online: sharedClockOn(), shut: shutAtOpen });'));
  assert.ok(/\n {6}wayBack,\s+\/\/ WAY-BACK/.test(wm), 'the popup\'s hook');
  assert.ok(wm.includes('        if (!decision.eligible) return { rows: [...rows(decision.textId), ...(isEnhanced() ? [] : wayBack() ?? [])] };'), 'the refusal, then the way in - the classic skin\'s');
});

test('WAY-BACK: the Standing page puts the hall\'s quest line under a guild, temple or order the join refuses - not under a kingdom, nor a standing at 0, nor a temple whose slot the player\'s book holds; online what the Roll owes counts, as at the hall (AUDIT WAY-BACK L4-1, L4-2, L4-8) (mutants: the note dropped, the variants unresolved, the book not read)', async () => {
  const page = (id) => guildOfFaction(id, resolveVariantGuild(null));   // the page's own read: GetGuild, the variants resolved
  assert.equal(page(MAGES), GUILDS.MagesGuild);
  assert.equal(page(DIVINES.Arkay).name, 'Temple:Arkay');
  assert.equal(page(ORDERS.Dragon).name, 'Order:Dragon');
  assert.equal(page(201), null);
  const { statsEveryStanding } = await import('../../../src/ui/enhanced/enhancedMenu.js');
  const make = (tag) => ({ tag, className: '', textContent: '', children: [], append(...c) { this.children.push(...c); } });
  const notesOf = (entity) => {
    const detail = make('div');
    statsEveryStanding(detail, entity);
    return detail;
  };
  const notes = (detail) => detail.children.filter((n) => n.className === 'px-note').map((n) => n.textContent);
  globalThis.document = { createElement: make };
  try {
    const rep = storeOf({ [GUILDS.FightersGuild.factionId]: 0, [MAGES]: -53, [DIVINES.Arkay]: -20, [ORDERS.Dragon]: 4, 201: -20 });
    rep.dict.get(201).type = FACTION_TYPES.Province;   // a kingdom below 0: listed, and no guild's way in under it
    const detail = notesOf({ name: 'x', factionRep: rep, guildMemberships: {} });
    assert.deepEqual(notes(detail), [QUESTS(' - 11 more quests reach 0'), QUESTS(' - 4 more quests reach 0')]);
    const at = detail.children.findIndex((n) => n.className === 'px-note');
    assert.equal(detail.children[at - 1].children[0].textContent, 'F' + MAGES, 'under its own row');
    // the book the join reads (activeMemberships): Mara's member is offered no join at Arkay's, so no line under it
    const mara = { name: 'x', factionRep: rep };
    joinGuild(activeMemberships(mara), templeOf('Mara'), { year: 405, dayOfYear: 1 });
    assert.deepEqual(notes(notesOf(mara)), [QUESTS(' - 11 more quests reach 0')]);
    setStandingOwed({ [MAGES]: 10 });
    assert.deepEqual(notes(notesOf({ name: 'x', factionRep: rep, guildMemberships: {} }))[0], QUESTS(' - 9 more quests reach 0'), 'the owed, as the hall counts it');
  } finally { delete globalThis.document; }
});
