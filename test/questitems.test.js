// Q2b-ii - THE ITEM TRANCHE: the Item mint (Item.cs's create ladder,
// the classic gold reward formula with its integer division at every
// step, quest-linking, MakePermanent, the dispose sweep), the seven
// item actions over the machine's player-inventory hooks, and the
// QuestListsManager over the vendored QuestList tables. Every pin
// asserts DFU literals; list counts are derived independently from
// the raw tables, gold amounts hand-computed through the C# math.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine, QUEST_MESSAGES } from '../src/systems/quest/machine.js';
import { Item, makeItemPermanent } from '../src/systems/quest/item.js';
import { QuestListsManager, MEMBERSHIP_STATUS } from '../src/systems/quest/questLists.js';
import { GUILD_GROUPS, SOCIAL_GROUPS } from '../src/formats/factionFile.js';
import { CLOTHING_DYES } from '../src/characters/dyes.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

function makeMachine(deps = {}) {
  const calls = [];
  const capture = (name) => (...args) => { calls.push([name, ...args]); return deps[`${name}Result`]; };
  const m = new QuestMachine({
    nowSeconds: () => m.now,
    showPopup: (q, message) => calls.push(['showPopup', message]),
    playerLevel: () => deps.level ?? 0,
    playerGender: () => deps.gender ?? 'male',
    getGuild: (factionId) => { calls.push(['getGuild', factionId]); return deps.guild ?? null; },
    regionPriceAdjustment: () => deps.priceAdjustment ?? 0,
    isPlayerInTown: () => m.inTown,
    addGold: capture('addGold'),
    addHUDText: capture('addHUDText'),
    giveItemToPlayer: capture('giveItemToPlayer'),
    removeItemFromPlayer: capture('removeItemFromPlayer'),
    playerHasItem: (dfItem) => { calls.push(['playerHasItem', dfItem]); return m.playerHas; },
    carriesQuestItem: (item) => { calls.push(['carriesQuestItem', item]); return m.carries; },
    releaseQuestItem: capture('releaseQuestItem'),
    makeHeldQuestItemsPermanent: capture('makeHeldQuestItemsPermanent'),
    offerReward: capture('offerReward'),
    onQuestStarted: capture('onQuestStarted'),
  });
  m.now = 12 * 3600;   // noon - inside GivePc's 07:00..18:00 window
  m.inTown = false;
  m.carries = false;
  m.playerHas = false;
  m.calls = calls;
  m.of = (name) => calls.filter((c) => c[0] === name);
  return m;
}

const HEADER = ['Quest: __QI', 'QRC:', 'Message:  1011', ' x', '',
  `QuestComplete:  [${QUEST_MESSAGES.QuestComplete}]`, ' done', '', 'QBN:'];
const schedule = (m, qbn, { rolls = () => 0, factionId = 0 } = {}) =>
  m.scheduleQuest([...HEADER, ...qbn], factionId, { rolls });

// ---------------------------------------------------------------
// The mint
// ---------------------------------------------------------------

test('mint: the named/class/template/random arms resolve through the tables to DFU templates', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Item _l_ letter', '',                          // Quests-Items (9,5) -> UselessItems2[5]
    'Item _s_ item class 17 subclass 13', '',       // CreatureIngredients1[13]
    'Item _a_ item class 3 template 131', '',       // by TEMPLATE index (Arrow)
    'Item _w_ weapon', '',                          // (3,-1): random subclass
    'variable _pad_',
  ], { rolls: () => 0.5 });
  const df = (n) => q.getResource({ name: n }).daggerfallUnityItem;
  assert.equal(df('l').templateIndex, 279, 'letter is the Parchment template');
  assert.equal(df('l').group, 'UselessItems2');
  assert.equal(df('s').templateIndex, 54, "class 17 subclass 13 is Saint's Hair");
  assert.equal(df('a').templateIndex, 131, 'class 3 template 131 is Arrow, by template index');
  // random subclass: floor(0.5 * 19 weapons) = 9 -> Claymore (122)
  assert.equal(df('w').templateIndex, 122);
  // every minted item is quest-linked
  for (const n of ['l', 's', 'a', 'w']) {
    assert.equal(df(n).questItem, true);
    assert.equal(df(n).questUID, q.uid);
    assert.equal(df(n).questSymbol.name, n);
  }
});

test('mint: clothing draws subclass THEN dye, in that roll order', () => {
  const m = makeMachine();
  const draws = [0.5, 0];
  const q = schedule(m, ['Item _c_ womens_clothing', '', 'variable _pad_'],
    { rolls: () => draws.shift() ?? 0 });
  const df = q.getResource({ name: 'c' }).daggerfallUnityItem;
  assert.equal(df.templateIndex, 199, 'floor(0.5 * 35) = 17 -> Loincloth');
  assert.equal(df.dye, CLOTHING_DYES[0], 'the SECOND roll picked the dye');
});

test('mint: MAGIC.DEF-less magic items and artifacts pend LOUDLY instead of throwing', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Item _mi_ magic_item', '',
    'Item _art_ artifact Chrysamere', '',
    'variable _pad_',
  ]);
  const mi = q.getResource({ name: 'mi' }).daggerfallUnityItem;
  const art = q.getResource({ name: 'art' }).daggerfallUnityItem;
  assert.equal(mi.pendingMagicDef, true);
  assert.equal(mi.group, 'MagicItems');
  assert.equal(art.pendingMagicDef, true);
  assert.equal(art.artifactIndex, 14, 'Chrysamere is artifact 14 in Quests-Items');
  assert.equal(art.questItem, true, 'pending or not, the link stands');
});

test('mint: gold with a range draws Range(low, high+1); the floor is 1', () => {
  const m = makeMachine();
  const q = schedule(m, ['Item _g_ gold range 5 to 25', '', 'variable _pad_'], { rolls: () => 0.5 });
  const df = q.getResource({ name: 'g' }).daggerfallUnityItem;
  assert.equal(df.group, 'Currency');
  assert.equal(df.templateIndex, 276);
  assert.equal(df.stackCount, 15, '5 + floor(0.5 * 21)');

  const m2 = makeMachine();
  const q2 = schedule(m2, ['Item _g_ gold range 0 to 0', '', 'variable _pad_'], { rolls: () => 0 });
  assert.equal(q2.getResource({ name: 'g' }).daggerfallUnityItem.stackCount, 1, 'amount < 1 becomes 1');
});

test('mint: the no-range gold formula - level path, the playerMod clamp, and the guild path with AlterReward', () => {
  // Level path: level 10 -> playerMod 6; PriceAdjustment 400 -> mod 200;
  // draw Range(900, 1201) at 0.5 = 1050; 1050*700/1000=735; *100/100=735.
  const m = makeMachine({ level: 10, priceAdjustment: 400 });
  const q = schedule(m, ['Item _g_ gold', '', 'variable _pad_'], { rolls: () => 0.5 });
  assert.equal(q.getResource({ name: 'g' }).daggerfallUnityItem.stackCount, 735);
  assert.equal(m.of('getGuild').length, 0, 'factionId 0 never consults the guilds');

  // The clamp: level 30 -> 16 -> 10; draw at 0 = 1500; *500/1000=750.
  const m2 = makeMachine({ level: 30 });
  const q2 = schedule(m2, ['Item _g_ gold', '', 'variable _pad_'], { rolls: () => 0 });
  assert.equal(q2.getResource({ name: 'g' }).daggerfallUnityItem.stackCount, 750);

  // Guild path (a FightersGuild faction quest): rank 4 -> playerMod 5,
  // power 30 -> factionMod; draw Range(750, 1001) at 0.5 = 875;
  // 875*500/1000=437; 437*80/100=349; FG AlterReward:
  // (trunc((14<<8)/10) * 349) >> 8 = (358 * 349) >> 8 = 488.
  const m3 = makeMachine({ guild: { guildGroup: GUILD_GROUPS.FightersGuild, rank: 4, power: 30, isNonMember: false } });
  const q3 = schedule(m3, ['Item _g_ gold', '', 'variable _pad_'], { rolls: () => 0.5, factionId: 40 });
  assert.equal(q3.getResource({ name: 'g' }).daggerfallUnityItem.stackCount, 488);
  assert.deepEqual(m3.of('getGuild'), [['getGuild', 40]]);

  // A NonMemberGuild keeps the level mods but still passes AlterReward
  // (the base identity): level 0 -> playerMod 1; draw at 0.5 -> 175;
  // 175*500/1000=87; 87*100/100=87.
  const m4 = makeMachine({ guild: { guildGroup: GUILD_GROUPS.GeneralPopulace, rank: 9, power: 80, isNonMember: true } });
  const q4 = schedule(m4, ['Item _g_ gold', '', 'variable _pad_'], { rolls: () => 0.5, factionId: 42 });
  assert.equal(q4.getResource({ name: 'g' }).daggerfallUnityItem.stackCount, 87);
});

test('mint: an unknown item name throws, as DFU', () => {
  assert.throws(() => new Item({ rolls: () => 0 }, 'Item _x_ notarealitem'),
    /Could not find Item name notarealitem in items table/);
});

test('makePermanent: the virtual flag, the instance unlink, and the held-copy sweep', () => {
  const m = makeMachine();
  const q = schedule(m, ['Item _l_ letter', '', ' make _l_ permanent']);
  m.tick();
  const item = q.getResource({ name: 'l' });
  assert.equal(item.madePermanent, true);
  assert.equal(item.daggerfallUnityItem.questItem, false, 'the instance dropped its quest link');
  assert.equal(item.daggerfallUnityItem.questSymbol, null);
  assert.deepEqual(m.of('makeHeldQuestItemsPermanent').map((c) => [c[1], c[2].name]), [[q.uid, 'l']]);

  // makeItemPermanent is idempotent on a non-quest item
  const df = { questItem: false, questUID: 7, questSymbol: {} };
  makeItemPermanent(df);
  assert.equal(df.questUID, 7, 'only a quest-linked item unlinks');
});

test('dispose: a still-quest-linked item leaves the player at quest end; a permanent one stays', () => {
  const m = makeMachine();
  const q = schedule(m, ['Item _l_ letter', '', 'Item _keep_ talisman', '', ' make _keep_ permanent', ' end quest']);
  m.tick(); m.tick(); m.tick();
  assert.equal(q.questTombstoned, true);
  assert.deepEqual(m.of('removeItemFromPlayer').map((c) => c[1].questSymbol?.name),
    ['l'], 'only the still-linked _l_ swept; the permanent _keep_ stays with the player');
});

// ---------------------------------------------------------------
// The seven actions
// ---------------------------------------------------------------

test('GivePc: the bare form offers the reward - QuestComplete, success, PERMANENT, released, offered', () => {
  const m = makeMachine();
  const q = schedule(m, ['Item _l_ letter', '', ' give pc _l_']);
  m.tick();
  const item = q.getResource({ name: 'l' });
  assert.equal(q.questSuccess, true);
  assert.equal(m.of('showPopup').length, 1, 'the QuestComplete parchment');
  assert.equal(item.daggerfallUnityItem.questItem, false, 'ReleaseQuestItemForReoffer(uid, item, TRUE) made it permanent');
  assert.deepEqual(m.of('releaseQuestItem').map((c) => [c[1], c[2]]), [[q.uid, item]]);
  assert.deepEqual(m.of('offerReward').map((c) => c[2]), [item.daggerfallUnityItem]);
});

test('GivePc: "give pc nothing" shows QuestComplete without loot', () => {
  const m = makeMachine();
  const q = schedule(m, [' give pc nothing']);
  m.tick();
  assert.equal(q.questSuccess, true);
  assert.equal(m.of('showPopup').length, 1);
  assert.equal(m.of('offerReward').length, 0);
  assert.equal(m.of('releaseQuestItem').length, 0);
});

test('GivePc: the notify form waits for town + daylight, then a 40..500-tick delay, then gives at the FRONT', () => {
  const m = makeMachine();
  const q = schedule(m, ['Item _l_ letter', '', ' give pc _l_ notify 1011']);
  m.tick();
  assert.equal(m.of('giveItemToPlayer').length, 0, 'not in town - waiting');
  m.inTown = true;
  m.now = 5 * 3600;   // 05:00 - before minHour 7
  m.tick();
  assert.equal(m.of('giveItemToPlayer').length, 0, 'daylight gate: hour < 7 waits');
  m.now = 12 * 3600;
  // rolls () => 0: delay = 40; the assignment tick decrements too, so
  // the give lands on the 41st in-town daylight tick
  for (let i = 0; i < 40; i++) m.tick();
  assert.equal(m.of('giveItemToPlayer').length, 0, 'still counting down');
  m.tick();
  const gives = m.of('giveItemToPlayer');
  assert.equal(gives.length, 1);
  assert.equal(gives[0][2], true, 'AddPosition.Front');
  assert.equal(gives[0][1], q.getResource({ name: 'l' }).daggerfallUnityItem);
  assert.equal(m.of('showPopup').length, 1, 'the notify message');
});

test('GetItem: gold lands as gold with the HUD line; items land at the front; both release first', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Item _g_ gold range 5 to 25', '',
    'Item _l_ letter', '',
    ' get item _g_',
    ' get item _l_ saying 1011',
  ], { rolls: () => 0.5 });
  m.tick();
  assert.deepEqual(m.of('addGold').map((c) => c[1]), [15]);
  assert.deepEqual(m.of('addHUDText').map((c) => c[1]), ['You receive 15 gold pieces.']);
  assert.deepEqual(m.of('giveItemToPlayer').map((c) => [c[1].templateIndex, c[2]]), [[279, true]]);
  assert.equal(m.of('releaseQuestItem').length, 2, 'both released for re-offer first');
  assert.equal(m.of('showPopup').length, 1, 'the saying on the second');
  assert.equal(q.getResource({ name: 'g' }).daggerfallUnityItem.questItem, true,
    'plain release does NOT make permanent');
});

test('TakeItem: releases with its saying and completes', () => {
  const m = makeMachine();
  const q = schedule(m, ['Item _l_ letter', '', ' take _l_ from pc saying 1011']);
  m.tick();
  assert.deepEqual(m.of('releaseQuestItem').map((c) => [c[1], c[2].symbol.name]), [[q.uid, 'l']]);
  assert.equal(m.of('showPopup').length, 1);
});

test('HaveItem: starts the task while carrying, NEVER completes, and keeps re-checking', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Item _l_ letter', '',
    ' have _l_ set _carried_', '',
    'variable _carried_',
  ]);
  m.tick();
  assert.equal(q.getTask({ name: 'carried' }).getTriggerValue(), false);
  m.carries = true;
  m.tick();
  assert.equal(q.getTask({ name: 'carried' }).getTriggerValue(), true);
  const startup = [...q.tasks.values()][0];
  assert.equal(startup.actions[0].isComplete, false, 'no SetComplete on the carry branch, verbatim');
  q.getTask({ name: 'carried' }).clear();
  m.tick();
  assert.equal(q.getTask({ name: 'carried' }).getTriggerValue(), true, 'it keeps re-starting while carried');
});

test('TotingItemAndClickedNpc: click + carried item -> consume click, popup id passes through, release', () => {
  const m = makeMachine();
  const q = schedule(m, [
    'Person _pp_ group Questor', '',
    'Item _l_ letter', '',
    '_t_ task:', ' toting _l_ and _pp_ clicked saying 1011', '',
    'variable _pad_',
  ]);
  m.tick();
  const person = q.getResource({ name: 'pp' });
  person.setPlayerClicked();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'clicked but not carrying');
  m.carries = true;
  person.setPlayerClicked();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true);
  assert.equal(m.of('showPopup').length, 1);
  assert.deepEqual(m.of('releaseQuestItem').map((c) => c[2].symbol.name), ['l']);
});

test('GiveItem: a Foe target queues the item and the player copy leaves; a not-in-scene Person target keeps trying', () => {
  const m = makeMachine();
  m.playerHas = true;
  const q = schedule(m, [
    'Foe _crook_ is Thief', '',
    'Person _pp_ group Questor', '',
    'Item _l_ letter', '',
    'Item _l2_ talisman', '',
    ' give item _l_ to _crook_',
    ' give item _l2_ to _pp_',
  ]);
  m.tick();
  const foe = q.getResource({ name: 'crook' });
  assert.equal(foe.itemQueueCount, 1);
  assert.equal(foe.itemQueue[0], q.getResource({ name: 'l' }).daggerfallUnityItem);
  assert.deepEqual(m.of('removeItemFromPlayer').map((c) => c[1].questSymbol.name), ['l']);
  const startup = [...q.tasks.values()][0];
  assert.equal(startup.actions[1].isComplete, false, 'no scene object: the Person arm keeps trying, verbatim');
});

// ---------------------------------------------------------------
// The QuestListsManager
// ---------------------------------------------------------------

const readListTable = (name) => read(join(VENDOR, 'Tables', `QuestList-${name}.txt`));

test('quest lists: the vendored tables file 188 quests under their groups - counts derived from the raw rows', () => {
  // Derived independently from the raw tables: rows not '-'-commented
  // (the dropped Daedra-summoning Oblivion block is dash-commented
  // whole, so DFU's Table never sees it), with an integer minReq.
  const lists = new QuestListsManager({ readListTable });
  const byGroup = {};
  for (const [id, pool] of lists.guilds) byGroup[Object.keys(GUILD_GROUPS).find((k) => GUILD_GROUPS[k] === id)] = pool.length;
  for (const [id, pool] of lists.social) byGroup[Object.keys(SOCIAL_GROUPS).find((k) => SOCIAL_GROUPS[k] === id)] = pool.length;
  assert.deepEqual(byGroup, {
    Commoners: 20, DarkBrotherHood: 13, FightersGuild: 21, GeneralPopulace: 15,
    HolyOrder: 24, KnightlyOrder: 17, MagesGuild: 18, Merchants: 12,
    Nobility: 28, Vampires: 10, Witches: 10,
  });
  assert.equal(lists.init.length, 0, 'no InitAtGameStart rows ship in the two lists');
});

test('quest lists: the guild pool law - membership, minReq rank vs rep, HolyOrder fold, oneTime, adult', () => {
  const CRAFTED = [
    'schema: *name, group, membership, minReq, flag, notes',
    'QA, FightersGuild, N, 0, 0, x',
    'QB, FightersGuild, M, 3, 0, x',
    'QC, FightersGuild, M, 20, 0, x',
    'QD, FightersGuild, M, 0, 1, x',
    'QE, FightersGuild, M, 0, X, x',
    'QT, HolyOrder, M, 0, 0, x',
    'QBAD, FightersGuild, M, notanint, 0, skipped row',
  ].join('\n');
  const lists = new QuestListsManager({ readListTable: (name) => (name === 'Classic' ? CRAFTED : null) });
  const names = (pool) => (pool ?? []).map((qd) => qd.name);

  const FG = GUILD_GROUPS.FightersGuild;
  assert.deepEqual(names(lists.getGuildQuestPool(FG, MEMBERSHIP_STATUS.Nonmember, 0, 0, 0)),
    ['QA'], 'a non-member sees only membership N at minReq 0');
  assert.deepEqual(names(lists.getGuildQuestPool(FG, MEMBERSHIP_STATUS.Member, 0, 0, 2)),
    ['QD'], 'rank 2 misses the rank-3 gate; the rep-20 gate needs rep');
  assert.deepEqual(names(lists.getGuildQuestPool(FG, MEMBERSHIP_STATUS.Member, 0, 0, 3)),
    ['QB', 'QD'], 'rank 3 opens the rank gate');
  assert.deepEqual(names(lists.getGuildQuestPool(FG, MEMBERSHIP_STATUS.Member, 0, 25, 3)),
    ['QB', 'QC', 'QD'], 'rep 25 opens the >= 10 reputation gate');

  // adult needs the nudity setting
  const lists2 = new QuestListsManager({ readListTable: (name) => (name === 'Classic' ? CRAFTED : null), playerNudity: true });
  assert.deepEqual(names(lists2.getGuildQuestPool(FG, MEMBERSHIP_STATUS.Member, 0, 0, 0)),
    ['QD', 'QE'], 'PlayerNudity admits the X-flagged quest');

  // the Temple fold: ANY member-side status reads Member for HolyOrder
  assert.deepEqual(names(lists.getGuildQuestPool(GUILD_GROUPS.HolyOrder, MEMBERSHIP_STATUS.Akatosh, 0, 0, 0)),
    ['QT']);

  // a started one-time quest never re-offers
  lists.getGuildQuestPool(FG, MEMBERSHIP_STATUS.Member, 0, 0, 0);   // arms the accepted list
  lists.noteQuestStarted({ oneTime: true, questName: 'QD' });
  assert.deepEqual(names(lists.getGuildQuestPool(FG, MEMBERSHIP_STATUS.Member, 0, 0, 3)),
    ['QB'], 'QD is spent');
});

test('quest lists: the social law (level-or-rep gate, N/M/F rows), SelectQuest and the machine glue', () => {
  const CRAFTED = [
    'schema: *name, group, membership, minReq, flag, notes',
    'SA, Commoners, N, 0, 0, x',
    'SB, Commoners, M, 0, 0, x',
    'SC, Commoners, F, 0, 0, x',
    'SD, Commoners, N, 5, 0, x',
  ].join('\n');
  const CHILD = ['Quest: __LST', 'QRC:', 'Message:  1011', ' c', '', 'QBN:', 'variable _x_'];
  const m = makeMachine();
  const lists = new QuestListsManager({
    readListTable: (name) => (name === 'Classic' ? CRAFTED : null),
    getQuestSourceLines: (name) => (name === 'SA' ? CHILD : null),
    parseQuest: (lines, factionId) => m.parseQuestForLists(lines, factionId, { rolls: () => 0 }),
    rolls: () => 0,   // SelectQuest picks pool[0]
  });
  // gender rows: a male level-1 player sees N + M (+ the level-5 row only at level 5)
  const pool = [];
  const origSelect = lists.selectQuest.bind(lists);
  lists.selectQuest = (p, f) => { pool.push(...p.map((qd) => qd.name)); return origSelect(p, f); };
  const quest = lists.getSocialQuest(SOCIAL_GROUPS.Commoners, 0, 'male', 0, 1);
  assert.deepEqual(pool, ['SA', 'SB'], 'the F row needs a female player; minReq 5 needs level 5');
  assert.equal(quest.questName, '__LST', 'SelectQuest loaded pool[0] through the machine parse glue');
  assert.equal(quest.oneTime, false);

  // GetQuest prefers the source seam; unknown names answer null
  assert.equal(lists.getQuest('SA').questName, '__LST');
  assert.equal(lists.getQuest('NOPE'), null);
  // a listed quest with no source THROWS out of loadQuest
  assert.throws(() => lists.loadQuest({ name: 'SB' }, 0), /Quest file SB not found/);

  // the machine's onQuestStarted event feeds noteQuestStarted (Q4
  // wires them; here the dep captures)
  const scheduled = m.scheduleParsedQuest(quest);
  m.tick();
  assert.deepEqual(m.of('onQuestStarted').map((c) => c[1]), [scheduled]);
});
