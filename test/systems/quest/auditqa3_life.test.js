// AUDIT QA3 (2026-10-23, the owner: "Audit this", of QUEST-AUDIT III; bible/01-Overview/audits/Quest-Audit-III.md): the
// quest's life, its actions and its stands, held to what the audit found. Each pin is red on the change it audited:
//
// - A2: RESTART-PAID refused quests that had paid nothing a restart could pay again - four quests from their first tick
//   (A0C00Y11, K0C00Y08 and A0C41Y18's start-up gold, M0B00Y16's `make _magic_ permanent` on the giant's loot). Gold is
//   not "paid" now: a restart hands the old copy's goldPaid marks to the new copy (quest/machine.js restartQuest).
// - A3: a stamped quest's `get item` of gold is scaled by its outcome, as its `give pc` is (quest/actions.js GetItem) -
//   N0B21Y14's rescue paid its purse at 1x where the sheet's `rescued` pays "greater".
// - B1: a quest whose `start quest` ran refuses the journal's Restart ('started', machine.js restartRefusal) - S0000008's
//   new copy started S0000106 again, +100 with sixteen powers every press.
// - B3 (QUEST-RESET's half): standing is not pay - P0B00L01 refused its restart after its +5 errand.
// - B7: a pending hand-over whose sender its quest no longer holds (a party's resync rebuilt every action) is let go
//   (ui/pendingOffer.js giveOffer).
// - B8: `toting` and `have` read the pack (the host's carriesQuestItem), the reclaim reads every keeping (keepsQuestItem,
//   through questBridge.js to machine.js reclaimQuest) - S0000022's lich dust in the wagon ran its step.
// - C2: %di with nothing referenced reads a remote contact's home (person.js getDialogPlace; questMacros.js direction) -
//   V0C00Y00's "If you go %di of here in __contact_" said "...never mind...".
// - C3: M0B11Y18's `pc at _L.00_ ... _S.12_` (read at last, DOTTED-SYMBOLS) keeps _S.12_ once the player reaches K'avar's
//   hideout, so `_conhouse_`'s archers do not begin again at every exit (quest/questPatches.js).
// - C4: a joke's "the %nt" drops the tavern's own "The" (questMacros.js %jok).
// - D1: a body stood up again by a same-dungeon quickload whose Foe the load holds alive counts its next death
//   (resourceBehaviour.js); a destroyed behaviour is neither relinked nor "already here" (sceneMount.js).
// - D2: a quest the machine no longer holds (the journal's Restart threw it away) puts its non-foe stands away.
// - D3: a dungeon quest Person freed from a model keeps the stand's 2% lift (sceneMount.js freeQuestStand).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { QuestResourceBehaviour } from '../../../src/systems/quest/resourceBehaviour.js';
import { addQuestResourceObjects, freeQuestStand, isAlreadyInjected } from '../../../src/systems/quest/sceneMount.js';
import { SITE_TYPES, Place } from '../../../src/systems/quest/place.js';
import { Symbol as QuestSymbol } from '../../../src/systems/quest/symbol.js';
import { getMacroValue, getContextValue } from '../../../src/systems/quest/questMacros.js';
import { prepareQuestShare, receiveSharedQuest } from '../../../src/systems/quest/questShare.js';
import { createQuestBridge, restartRefusalText } from '../../../src/scenes/quest/questBridge.js';
import { bindQuestFoeHost } from '../../../src/scenes/quest/questFoeHost.js';
import { keepsQuestItem } from '../../../src/systems/item/itemTransfer.js';
import { noteOfferPending, giveOffer, pendingOfferSender, clearPendingOffer } from '../../../src/ui/pendingOffer.js';
import { dateFromSeconds } from '../../../src/systems/gameDate.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { Collider } from '../../../src/player/collider.js';
import { identity } from '../../../src/world/mat4.js';
import { lodgedIn } from '../../../src/characters/foeSpacing.js';
import { loadTables as loadTownTables, rmbBlock, town, dungeon, worldOf, questScript } from '../../fb1004dTowns.mjs';
import { packMachine, questSource, loadTables as loadPackTables, ROOT } from '../../qlSources.mjs';

loadTownTables();
loadPackTables();
const quiet = (fn) => { const w = console.warn, l = console.log, i = console.info; console.warn = () => {}; console.log = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; console.info = i; } };
const ticks = (m, n = 5) => quiet(() => { for (let i = 0; i < n; i++) m.tick(); });
const sym = (name) => ({ name });
const corpus = (name) => { try { return questScript(name); } catch { return null; } };
/** A script: two messages, two gold Items and a letter, then `body` (the start-up block, then its tasks). */
const script = (name, body) => [`Quest: ${name}`, `DisplayName: ${name}`, 'QRC:', 'Message:  1011', ' x', '', 'Message:  1012', ' y', '',
  'QBN:', 'Item _gold_ gold', 'Item _gold2_ gold', 'Item _letter_ letter', '', ...body];
/** A headless machine over the corpus and `more`, every purse, standing and box recorded. */
function rig(more = {}, extra = {}) {
  const seen = { gold: [], rep: [], offers: [], boxes: [] };
  const m = new QuestMachine({
    nowSeconds: () => 1e6, playerLevel: () => 30, getQuestSourceLines: (n) => more[n] ?? corpus(n),
    addGold: (n) => seen.gold.push(n), changeReputation: (f, a) => seen.rep.push([f, a]), changeLegalRep: (a) => seen.rep.push(['legal', a]),
    getReputation: () => 0, showPopup() {}, giveItemToPlayer() {}, offerReward: (q, it) => seen.offers.push(it),
    showPrompt: (q, message, respond) => { seen.boxes.push({ id: message?.id, respond }); },
    ...extra,
  });
  m.seen = seen;
  return m;
}

// ---- A2: gold rides the restart; the four quests restart from their first tick ----

/** The region the four need, built (no game data): two towns of every kind they ask for - the questor's and another -
 *  and three dungeons, one of type 0 (A0C41Y18's `remote dungeon0`), each with a quest spawn and item marker. */
function a2World() {
  const B = BUILDING_TYPES;
  const kinds = [B.Tavern, B.GeneralStore, B.House2, B.Temple, B.House1, B.House3, B.Palace, B.Alchemist, B.GeneralStore, B.House1, B.Tavern];
  const markers = (position) => ({ position, rdbBlock: { objectRootList: [{ rdbObjects: [11, 18].map((record, i) => ({ type: 3, position: 100 + i * 8, xPos: 10, yPos: 4, zPos: 20, resources: { flatResource: { textureArchive: 199, textureRecord: record } } })) }] } });
  const other = town({ name: 'Other', locationIndex: 0, mapId: 101, grid: ['OTHER.RMB'] });
  const home = town({ name: 'Home', locationIndex: 1, mapId: 100, grid: ['HOME.RMB'] });
  for (const t of [other, home]) t.exterior.buildings = kinds.map((buildingType) => ({ buildingType }));
  const crypt = dungeon({ name: 'The Crypt', locationIndex: 2, mapId: 300, dungeonType: 0, block: 'CRYPT.RDB' });
  const lair = dungeon({ name: 'The Lair', locationIndex: 3, mapId: 301, dungeonType: 2, block: 'LAIR.RDB' });
  const den = dungeon({ name: 'The Den', locationIndex: 4, mapId: 302, dungeonType: 2, block: 'DEN.RDB' });
  return worldOf({ locations: [other, home, crypt, lair, den], current: home, blocks: new Map([
    ['HOME.RMB', rmbBlock('HOME.RMB', kinds.map((type) => ({ type })))], ['OTHER.RMB', rmbBlock('OTHER.RMB', kinds.map((type) => ({ type })))],
    ['CRYPT.RDB', markers(9000)], ['LAIR.RDB', markers(9100)], ['DEN.RDB', markers(9200)]]) });
}

test('QA3 A2: A0C00Y11, K0C00Y08, A0C41Y18 and M0B00Y16 restart from their first ticks - their start-up gold, a `give pc nothing` and a `make permanent` of loot nobody handed over are nothing a restart pays again (mutants: the narrowed law)', () => {
  const world = a2World();
  for (const name of ['A0C00Y11', 'K0C00Y08', 'A0C41Y18', 'M0B00Y16']) {
    const m = rig({}, { world });
    const q = quiet(() => m.startQuestByName(name, 0, { rolls: () => 0 }));   // rolls 0: M0B00Y16's `pick one of` takes _magicItem_
    ticks(m, 3);
    assert.ok(m.getQuest(q.uid) === q && !q.questComplete, `${name} runs`);
    assert.equal(m.restartRefusal(q.uid), null, `${name}: restartable`);
  }
  // what each paid at start-up, by the script's own words
  const m = rig({}, { world });
  const loot = quiet(() => m.startQuestByName('M0B00Y16', 0, { rolls: () => 0 }));
  ticks(m, 3);
  assert.equal(loot.getItem(sym('magic')).madePermanent, true, 'the fixture: M0B00Y16 made the giant\'s loot permanent');
  const advance = quiet(() => m.startQuestByName('A0C41Y18', 0, { rolls: () => 0 }));
  ticks(m, 3);
  assert.equal(advance.questSuccess, true, 'the fixture: A0C41Y18\'s `give pc nothing` stood the box');
  assert.equal(advance.getItem(sym('gold1')).goldPaid, true, 'and its `get item _gold1_` paid');
});

test('QA3 A2: a restarted quest\'s gold, paid, is not paid again - A0C00Y11\'s start-up advance pays once over a restart; the new copy\'s `give pc` of a paid pile stands the box with no purse; gold the old copy never paid still pays (mutants: the carry, its paid test)', () => {
  const m = rig();
  const q = quiet(() => m.startQuestByName('A0C00Y11', 0, { rolls: () => 0 }));
  ticks(m, 3);
  assert.equal(m.seen.gold.length, 1, 'the fixture: the advance paid');
  const r = quiet(() => m.restartQuest(q.uid));
  assert.equal(r.ok, true, `restarted - ${r.reason}`);
  ticks(m, 5);
  assert.equal(m.seen.gold.length, 1, 'the new copy\'s `get item _gold1_` pays nothing more');
  assert.equal(r.quest.getItem(sym('gold1')).goldPaid, true, 'its pile is paid');
  assert.notEqual(r.quest.getItem(sym('gold2')).goldPaid, true, 'the reward it has not paid is not');

  const more = { __PURSE: script('__PURSE', ['\tget item _gold_', '\tlog 1011 step 0', '', '_hand_ task:', '\twhen _S.01_', '\tgive pc _gold_', '\tget item _gold2_', '', 'variable _S.01_']) };
  const p = rig(more);
  const old = p.startQuestByName('__PURSE');
  ticks(p, 2);
  assert.equal(p.seen.gold.length, 1);
  assert.equal(p.restartRefusal(old.uid), null, 'gold got is no refusal');
  const fresh = quiet(() => p.restartQuest(old.uid)).quest;
  ticks(p, 2);
  fresh.startTask(sym('S.01'));
  ticks(p, 3);
  assert.equal(fresh.questSuccess, true, 'the box stands');
  assert.equal(p.seen.offers.length, 0, 'with no purse in it');
  assert.deepEqual(p.seen.gold, [old.getItem(sym('gold')).daggerfallUnityItem.stackCount, fresh.getItem(sym('gold2')).daggerfallUnityItem.stackCount], 'the first pile once, the second - never paid - paid');
});

// ---- A3 ----

test('QA3 A3: a stamped quest\'s `get item` of gold is scaled by its outcome - N0B21Y14\'s rescue (`get item _gold_`, then `give pc _gold_` of the pile paid) pays the sheet\'s "greater" purse, once (mutants: the get\'s reward)', () => {
  setPref(QUESTLINES_PREF, true);
  const gold = [];
  let now = 1000;
  const bridge = quiet(() => createQuestBridge({
    data: { readListTable: (name) => { try { return readFileSync(join(ROOT, 'vendor/dfu-quests/Tables', `QuestList-${name}.txt`), 'utf8'); } catch { return null; } }, getQuestSourceLines: (n) => questSource(n, true) },
    classicSeconds: () => now, nowSeconds: () => now, worldSeconds: () => now,
    playerEntity: { name: 'Hero', gender: 'female', level: 12, career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(40) },
    getReputation: () => 0, carriesQuestItem: () => false, showPrompt: (_q, _m, respond) => respond(true),
    onQuestlineOffer: () => {}, offerReward: () => {}, addGold: (n) => gold.push(n),
  }));
  const q = quiet(() => bridge.machine.startQuestByName('N0B21Y14', 0));
  // headless, the start-up's `place npc` has nowhere to stand - each action that throws for it is spent instead
  for (const t of q.tasks.values()) for (const a of t.actions) if (!a.isTriggerCondition) { const up = a.update.bind(a); a.update = (c) => { try { up(c); } catch { a.setComplete(); } }; }
  const step = (n) => quiet(() => { for (let i = 0; i < n; i++) { now += 60; bridge.machine.tick(); bridge.questlines.look(); } });
  step(2);
  assert.ok(q.ql?.stamp, 'the fixture: a stamped quest');
  const base = q.getItem(sym('gold')).daggerfallUnityItem.stackCount;
  q.startTask(sym('S.07')); q.startTask(sym('S.04'));   // the love rescued, the noble clicked: _S.06_
  step(6);
  assert.equal(q.questComplete, true);
  assert.deepEqual(gold, [Math.round(base * 1.25)], `the rescue's purse, x1.25 of ${base}, once`);
});

// ---- B1 ----

test('QA3 B1: a quest whose `start quest` has run refuses the journal\'s Restart (\'started\', in words) - S0000008 after the Totem reached the King of Worms (`start quest 106 106`) runs on, and S0000106 is not started again; one that paid refuses \'paid\' first; a `start quest` not yet run is no refusal (mutants: the rung, its run test, its words)', () => {
  const m = rig();
  const q = quiet(() => m.startQuestByName('S0000008'));
  ticks(m, 2);
  assert.equal(m.restartRefusal(q.uid), null, 'the fixture: before the Totem, restartable');
  q.startTask(sym('S.33'));   // KingOfWormsGotTotem: `start quest 106 106`
  ticks(m, 6);
  const powers = () => m.seen.rep.filter(([, a]) => a === 100).length;
  const copies = () => [...m.quests.values()].filter((x) => x.questName === 'S0000106').length;
  assert.deepEqual([copies(), powers(), q.questTombstoned], [1, 16, false], 'the fixture: S0000106 ran, +100 with sixteen powers; S0000008 runs on');
  assert.equal(m.restartRefusal(q.uid), 'started');
  assert.deepEqual(quiet(() => m.restartQuest(q.uid)), { ok: false, reason: 'started' });
  ticks(m, 6);
  assert.deepEqual([copies(), powers(), m.getQuest(q.uid) === q], [1, 16, true], 'nothing started twice, nothing paid twice');
  assert.equal(restartRefusalText('started'), 'That quest has already started another, so starting it again would start that one twice.');

  const more = {
    __KID: script('__KID', ['\tlog 1011 step 0']),
    __BOTH: script('__BOTH', ['\tgive pc _letter_', '\tstart quest __KID']),
    __LATER: script('__LATER', ['\tlog 1011 step 0', '', '_kid_ task:', '\twhen _S.01_', '\tstart quest __KID', '', 'variable _S.01_']),
  };
  const s = rig(more);
  const both = s.startQuestByName('__BOTH'), later = s.startQuestByName('__LATER');
  ticks(s, 2);
  assert.equal(s.restartRefusal(both.uid), 'paid', 'paid first');
  assert.equal(s.restartRefusal(later.uid), null, 'a `start quest` not yet run');
});

// ---- B3 ----

test('QA3 B3: standing is not pay - P0B00L01 after its +5 with the vampire for the letter (its reward not yet given) restarts, as before RESTART-PAID (mutants: standing read as paid)', () => {
  const m = rig();
  const q = quiet(() => m.startQuestByName('P0B00L01'));
  ticks(m, 2);
  q.startTask(sym('vampclicked'));
  ticks(m, 2);
  q.startTask(sym('npcclicked'));
  ticks(m, 2);
  assert.ok(m.seen.rep.some(([, a]) => a === 5) && !q.questSuccess, 'the fixture: the errand\'s +5, no reward');
  assert.equal(m.restartRefusal(q.uid), null);
  const r = quiet(() => m.restartQuest(q.uid));
  assert.equal(r.ok, true);
  assert.notEqual(r.quest.uid, q.uid, 'a new copy');
});

// ---- B7 ----

test('QA3 B7: a latched pending hand-over whose sender its quest no longer holds - a party\'s resync rebuilt every action, and the new GivePc gave on its own - is let go: the Rest or Travel press is the player\'s; one its quest holds is handed over (mutants: the held test)', () => {
  const name = '__LATCH';
  const source = ['Quest: __LATCH', 'DisplayName: Latch', 'QRC:', 'Message:  1011', ' A letter.', '', 'Message:  1012', ' Step two.', '', 'QBN:', 'Item _letter_ letter used 1011', '',
    '\tlog 1012 step 0', '', '_send_ task:', '\tgive pc _letter_ notify 1011', '', '_two_ task:', '\tlog 1011 step 1', '', 'variable _x_'];
  let noon = 0;
  while (dateFromSeconds(noon).hour !== 12) noon += 600;
  const given = [];
  let inTown = false;
  const mk = (who) => new QuestMachine({ nowSeconds: () => noon, getQuestSourceLines: (n) => (n === name ? source : null), isPlayerInTown: () => inTown,
    onOfferPending: (g) => noteOfferPending(g), giveItemToPlayer: () => given.push(who), showPopup() {} });
  const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
  const actionsOf = (q) => [...q.tasks.values()].flatMap((t) => t.actions);
  try {
    const A = mk('A'), B = mk('B');
    const qa = A.scheduleQuest(source, 0, { rolls: () => 0.5 });
    ticks(A, 1);
    const qb = quiet(() => receiveSharedQuest(B, lists, name, JSON.parse(JSON.stringify(prepareQuestShare(A, qa.uid).data)))).quest;
    qb.startTask(sym('send'));
    ticks(B, 1);   // out of town: the letter waits for one
    inTown = true;
    ticks(B, 1);   // into town by day: the sender latched
    assert.ok(actionsOf(qb).includes(pendingOfferSender()), 'the fixture: B latched its own GivePc');
    qa.startTask(sym('two'));
    ticks(A, 1);
    const sync = JSON.parse(JSON.stringify(prepareQuestShare(A, qa.uid).data));
    sync.sync = 1;
    assert.equal(quiet(() => receiveSharedQuest(B, lists, name, sync)).ok, true);
    assert.equal(actionsOf(qb).includes(pendingOfferSender()), false, 'the fixture: the resync rebuilt it - the latch holds an orphan');
    ticks(B, 3);
    assert.deepEqual(given, ['B'], 'the new GivePc handed the letter over on its own');
    assert.equal(giveOffer(), false, 'the press is the player\'s');
    assert.equal(pendingOfferSender(), null, 'let go');
    assert.deepEqual(given, ['B'], 'nothing handed twice');
  } finally { clearPendingOffer(); }
  // one its quest holds still hands over
  const live = { isComplete: false, offered: 0, offerImmediatelyNow() { this.offered++; }, parentQuest: { questComplete: false, questTombstoned: false, shelvedAt: null } };
  live.parentQuest.tasks = new Map([['t', { actions: [live] }]]);
  try {
    noteOfferPending(live);
    assert.equal(giveOffer(), true);
    assert.equal(live.offered, 1);
  } finally { clearPendingOffer(); }
});

// ---- B8 ----

test('QA3 B8: `have` reads the pack alone (the host\'s carriesQuestItem) - a letter in the wagon sets nothing; the reclaim reads every keeping (keepsQuestItem, through the bridge) - a letter moved to the wagon while its quest was set aside is not handed back twice, one thrown away is (mutants: the reclaim\'s read, the bridge\'s seam)', () => {
  const lines = script('__TOTE', ['\tget item _letter_', '\tlog 1011 step 0', '', '_look_ task:', '\twhen _S.01_', '\thave _letter_ set _held_', '', 'variable _S.01_', 'variable _held_']);
  const entity = { items: [], wagonItems: [], bagItems: [], otherItems: [] };
  const mine = (it) => (res) => it.questItem && it.questUID === res.parentQuest?.uid && it.questSymbol?.name === res.symbol?.name;
  const bridge = quiet(() => createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => (n === '__TOTE' ? lines : null) },
    carriesQuestItem: (res) => entity.items.some((it) => mine(it)(res)),   // world.js's: the pack
    keepsQuestItem: (res) => keepsQuestItem(entity, res),                 // world.js's: every keeping
    giveItemToPlayer: (it) => entity.items.push(it),
  }));
  const m = bridge.machine;
  const q = quiet(() => m.startQuestByName('__TOTE'));
  ticks(m, 2);
  const letter = q.getItem(sym('letter')).daggerfallUnityItem;
  assert.deepEqual(entity.items, [letter], 'the fixture: the letter in the pack');
  const toWagon = () => { entity.items.splice(entity.items.indexOf(letter), 1); entity.wagonItems.push(letter); };
  toWagon();
  q.startTask(sym('S.01'));
  ticks(m, 3);
  assert.equal(q.getTask(sym('held')).getTriggerValue(), false, '`have`: a letter in the wagon is not carried');

  entity.wagonItems.length = 0;
  entity.items.push(letter);
  assert.equal(m.shelveQuest(q.uid).ok, true);
  toWagon();
  const r = m.reclaimQuest(q.uid);
  assert.deepEqual([r.ok, r.returned, entity.items.length], [true, 0, 0], 'kept in the wagon: nothing handed back');
  assert.equal(m.shelveQuest(q.uid).ok, true, 'set aside again, the letter in the wagon - not in the pack, so not listed');
  entity.wagonItems.length = 0;
  entity.items.push(letter);
  assert.equal(m.reclaimQuest(q.uid).ok, true);
  assert.equal(m.shelveQuest(q.uid).ok, true);
  entity.items.length = 0;   // thrown away while set aside
  assert.deepEqual([m.reclaimQuest(q.uid).returned, entity.items.length], [1, 1], 'gone: handed back, its own quest item');
});

// ---- C2 ----

/** `name`'s message `msg` (variant by `roll`) after a load - nothing referenced - its Person `who` remote with no
 *  `place npc`: set-up minted their home (person.js _assignHomeTown) and left them standing nowhere until the player walks
 *  in. The home is built here as set-up builds it, a sited Place the quest holds. */
function diAfterLoad(name, who, msg, roll) {
  const m = packMachine();
  const q = quiet(() => m.parseQuestForLists(questSource(name), 0, { rolls: () => 0, headless: true }));
  const home = new Place(q);
  home.symbol = new QuestSymbol(`_${who}_home_`);
  home.scope = 'remote';
  home.siteDetails = { locationName: 'Wickfield', buildingName: 'The Wily Fox', buildingKey: 3, mapId: 99, regionIndex: 17 };
  q.addResource(home);
  const person = q.getResource(new QuestSymbol(`_${who}_`));
  person.homePlaceSymbol = home.symbol.clone();
  q.hooks = { ...q.hooks, world: { locationCompassDirection: (p) => (p?.siteDetails ? 'northeast' : null), currentLocation: () => ({ name: 'Daggerfall' }) } };
  q.lastPlaceReferenced = null;
  assert.equal(person.assignedPlaceSymbol ?? null, null, `the fixture: ${name}'s ${who} stands nowhere yet`);
  return quiet(() => q.getMessage(msg).getTextTokens(-1, () => roll).map((t) => t.text ?? '').join(' ').trim());
}

test('QA3 C2: %di with nothing referenced reads a remote contact\'s home - V0C00Y00\'s "If you go %di of here in __contact_" and P0B01L02\'s rumor name the way; a questor is never read (they are where the player is) (mutants: the dialog place, the questor test)', () => {
  assert.match(diAfterLoad('V0C00Y00', 'contact', 1012, 0.99), /^If you go northeast of here in The Wily Fox/);
  assert.match(diAfterLoad('P0B01L02', 'vampire', 1010, 0), /is northeast of here in The Wily Fox/);
  const sited = (locationName) => ({ scope: 'remote', siteDetails: { locationName, buildingKey: 0 } });
  const q = {
    uid: 1, lastPlaceReferenced: null,
    resources: new Map([['contact', { isPerson: true, getDialogPlace: () => sited('Wickfield') }], ['giver', { isPerson: true, isQuestor: true, getDialogPlace: () => sited('Bigtown') }]]),
    hooks: { world: { locationCompassDirection: (p) => (p?.siteDetails ? `toward ${p.siteDetails.locationName}` : null), currentLocation: () => ({ name: 'Elsewhere' }) } },
  };
  assert.equal(getContextValue('%di', q, q.hooks), 'toward Wickfield', 'the questor, last declared, passed over');
});

// ---- C3 ----

test('QA3 C3: M0B11Y18 - once the player reaches K\'avar\'s hideout (_L.00_) _S.12_ stays set after they leave it, so `_conhouse_` (`when _S.00_ and not _S.12_`) never arms again and its archers do not begin anew at every exit (mutants: the patch)', () => {
  const world = { createFoeGameObjects: (foe, n) => Array.from({ length: n }, () => ({ foe })), tryPlaceFoe: () => true, isPlayerInLocationRect: () => true, raiseOnEncounterEvent: () => {} };
  const clock = { t: 1e6 };
  const m = packMachine({ nowSeconds: () => clock.t, world });
  const q = quiet(() => m.parseQuestForLists(questSource('M0B11Y18'), 0, { rolls: () => 0.05, headless: true }));
  q.hooks = { ...q.hooks, world };
  let atL = false;
  q.getResource(sym('L.00')).isPlayerHere = () => atL;
  const task = (n) => q.getTask(sym(n));
  const conFoe = task('conhouse').actions.find((a) => a.typeName === 'CreateFoe');
  /** Half an hour at a time, in the quest's order, the four tasks of the law and any task a patch adds (the start-up
   *  needs a sited world, and the rest stand people in places this world has not sited). */
  const own = new Set(questScript('M0B11Y18').map((l) => /^_([A-Za-z0-9.]+)_ task:/.exec(l)?.[1]).filter(Boolean));
  const tasks = [...q.tasks.values()].filter((t) => ['S.00', 'S.10', 'S.12', 'conhouse'].includes(t.symbol?.name) || (t.symbol?.name && !own.has(t.symbol.name) && t !== q.tasks.values().next().value));
  const step = (minutes) => quiet(() => {
    for (let i = 0; i < minutes; i += 30) {
      clock.t += 1800;
      for (const t of tasks) { q.questBreak = false; t.update(); }
    }
  });
  quiet(() => { task('S.00').start(); task('S.11').start(); });   // the amulet carried, the clock run: _S.10_ (the teleport)
  step(60 * 24);   // a day out of L.00: K'avar's archers come
  const waves = conFoe.spawnCounter;
  assert.ok(waves > 0, 'the fixture: the archers came');
  atL = true;
  step(60);
  assert.deepEqual([task('S.12').getTriggerValue(), task('conhouse').getTriggerValue()], [true, false], 'at the hideout: _S.12_ set, `_conhouse_` cleared');
  for (let trip = 0; trip < 3; trip++) {
    atL = false;
    step(60 * 24 * 3);
    assert.deepEqual([task('S.12').getTriggerValue(), task('conhouse').getTriggerValue()], [true, false], `trip ${trip + 1} out of L.00: still set, still cleared`);
    atL = true;
    step(60);
  }
  assert.equal(conFoe.spawnCounter, waves, 'no wave began anew');
});

// ---- C4 ----

test('QA3 C4: a joke\'s "the %nt" drops the tavern\'s own "The" - "Over at the Mole and Jug", whatever the case; a name with no article, and one not after "the ", are as given (mutants: the drop, the article\'s case, the joke\'s "the" read)', () => {
  const tell = (joke, tavern) => getMacroValue('%jok', null, { world: { getRandomText: (id) => (id === 200 ? joke : null), randomTavernName: () => tavern } });
  assert.equal(tell('Over at the %nt, spitting will cost you a copper piece.', 'The Mole and Jug'), 'Over at the Mole and Jug, spitting will cost you a copper piece.');
  assert.equal(tell('Over at THE %nt!', 'the Mole and Jug'), 'Over at THE Mole and Jug!');
  assert.equal(tell('Over at the %nt!', 'Mole and Jug'), 'Over at the Mole and Jug!', 'no article to drop');
  assert.equal(tell('%nt is closed.', 'The Mole and Jug'), 'The Mole and Jug is closed.', 'not after "the ": as given');
  assert.equal(tell('A drink at %nt.', 'The Mole and Jug'), 'A drink at The Mole and Jug.');
  assert.equal(tell('Over at the %nt!', 'Theodor\'s Rest'), 'Over at the Theodor\'s Rest!', 'a name that only begins with "The"');
  // the fixes' own audit: "the " as a word of the joke, never the end of another word
  assert.equal(tell('Never breathe %nt air.', 'The Mole and Jug'), 'Never breathe The Mole and Jug air.', '"breathe " ends no article');
});

// ---- D1, D2: the dungeon host's stands ----

const LAIR = (position) => ({ position, rdbBlock: { objectRootList: [{ rdbObjects: [11, 18].map((record, i) => ({ type: 3, position: 100 + i * 8, xPos: 10, yPos: 4, zPos: 20, resources: { flatResource: { textureArchive: 199, textureRecord: record } } })) }] } });
/** The player's town, a town of houses (a Person's home), and a dungeon of one block - more as `extra` [name, block, position]. */
function lairWorld(extra = []) {
  const home = town({ name: 'Home', locationIndex: 0, mapId: 100, grid: ['HOME.RMB'] });
  const dens = [['The Lair', 'LAIR.RDB', 9000], ...extra];
  const lairs = dens.map(([name, block], i) => dungeon({ name, locationIndex: i + 1, mapId: 300 + i, dungeonType: 2, block }));
  const other = town({ name: 'Other', locationIndex: dens.length + 1, mapId: 102, grid: ['OTHER.RMB'] });
  other.exterior.buildings = [{ buildingType: BUILDING_TYPES.House2 }, { buildingType: BUILDING_TYPES.House2 }];
  const blocks = new Map([['HOME.RMB', rmbBlock('HOME.RMB', [{ type: BUILDING_TYPES.Tavern }])], ['OTHER.RMB', rmbBlock('OTHER.RMB', [{ type: BUILDING_TYPES.House2 }, { type: BUILDING_TYPES.House2 }])],
    ...dens.map(([, block, pos]) => [block, LAIR(pos)])]);
  return worldOf({ locations: [home, ...lairs, other], blocks, current: home });
}
const KILL_QUEST = ['Quest: __SLAIN', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Place _lair_ remote dungeon', 'Foe _f_ is Giant', '',
  '\tplace foe _f_ at _lair_', '\tlog 1011 step 0', '', '_slain_ task:', '\tkilled 1 _f_', '\tlog 1011 step 1'];

/** The dungeon host as it is (worldModes.js dungeonQuestAdapter, dungeonContext.js): findBehaviours = the stands' and
 *  every foe stand it ever took (never pruned until teardown); each frame drives every foe's behaviour, dead or alive;
 *  a same-dungeon load restores the machine, mounts at once, then patches the live foes in place (applyWorld: a body
 *  killed after the save stands again, its behaviour untouched); a foe's build lands after the mount (spawnQuestFoe). */
function dungeonHost() {
  const m = new QuestMachine({ nowSeconds: () => 0, world: lairWorld(), playerLevel: () => 1 });
  const q = quiet(() => m.scheduleQuest(KILL_QUEST, 0, { rolls: () => 0.5 }));
  ticks(m, 2);
  const lair = q.getPlace(sym('lair'));
  const foes = [], stands = [], pending = [];
  const pool = { removeFoe: (f) => { if (f.dead) return; f.dead = true; f.questBehaviour?.notifyDestroyed(); }, zeroFoeHealth: (f) => { f.entity.health = 0; }, spellsByIndex: () => null, foeSinks: () => null };
  const adapter = {
    currentMapId: () => lair.siteDetails.mapId, findBehaviours: () => [...stands], loadInProgress: () => false, standNPC: () => null, standItem: () => null,
    standFoe: ({ behaviour }) => { stands.push(behaviour); pending.push(() => { const f = { entity: { health: 10, maxHealth: 10 }, dead: false }; foes.push(f); bindQuestFoeHost(f, behaviour, pool); }); return null; },
  };
  const h = {
    m, q, foes,
    mount: () => quiet(() => addQuestResourceObjects(m, adapter, SITE_TYPES.Dungeon, 0)),
    land: () => { while (pending.length) pending.shift()(); },
    frame: () => { for (const f of foes) { if (f.entity.health <= 0) f.dead = true; f.questBehaviour?.update(); } ticks(m, 1); },
    killAll: () => { for (const f of foes) if (!f.dead) f.entity.health = 0; h.frame(); h.frame(); },
    standing: () => foes.filter((f) => !f.dead).length,
    foe: () => m.getQuest(q.uid).getResource(sym('f')),
    slain: () => m.getQuest(q.uid).getTask(sym('slain')).getTriggerValue(),
    /** F9 here and F12 here: the envelope and the world's foe record, then the load in the same dungeon. */
    save: () => ({ env: JSON.parse(JSON.stringify(m.getSaveData())), record: foes.map((f) => ({ health: f.entity.health, dead: f.dead })) }),
    load: ({ env, record }) => {
      quiet(() => { m.clearState(); m.restoreSaveData(env); });
      h.mount();
      record.forEach((sf, i) => { const f = foes[i]; f.entity.health = sf.health; if (!sf.dead && f.dead) f.dead = false; });
      for (let i = foes.length - 1; i >= record.length; i--) { foes[i].dead = true; foes[i].questBehaviour?.notifyDestroyed(); foes.splice(i, 1); }
      h.land();
    },
  };
  h.mount(); h.land(); h.frame();
  return h;
}

test('QA3 D1: a quest foe killed, then a quickload in the same dungeon from before the kill - the body stands again and the loaded Foe is alive - counts its next death, and its `killed 1` fires (mutants: the revive)', () => {
  const h = dungeonHost();
  assert.equal(h.standing(), 1);
  const saved = h.save();
  h.killAll();
  assert.deepEqual([h.foe().killCount, h.slain()], [1, true], 'the fixture: the kill counted');
  h.load(saved);
  h.frame();
  assert.deepEqual([h.foe().killCount, h.slain(), h.standing()], [0, false, 1], 'loaded: alive, one body standing');
  h.killAll();
  assert.deepEqual([h.foe().killCount, h.slain()], [1, true], 'the next death counts');
});

test('QA3 D1: a quest foe its quest hid (its behaviour destroyed, gone with its body), then a quickload from before - the destroyed behaviour is neither relinked nor "already here": the foe the save held standing stands, and its death counts (mutants: the relink\'s guard, the injected guard)', () => {
  const h = dungeonHost();
  const saved = h.save();
  const first = h.foes[0].questBehaviour;
  h.foe().isHidden = true;
  h.frame();
  assert.equal(first.isComponentDestroyed, true, 'the fixture: `hide foe` destroyed its behaviour');
  h.load(saved);
  h.frame();
  const live = h.foes.filter((f) => !f.dead && f.questBehaviour !== first && !f.questBehaviour.isComponentDestroyed);
  assert.equal(live.length, 1, 'the foe the save held stands, a behaviour of its own');
  assert.equal(first.targetResource === h.foe(), false, 'the destroyed behaviour is not bound to the loaded Foe');
  h.killAll();
  assert.deepEqual([h.foe().killCount, h.slain()], [1, true], 'its death counts');
  // the guard by itself: a destroyed behaviour is no stand, by its symbol or (the repair's mount) by its name
  const foe = h.foe();
  const gone = { isComponentDestroyed: true, targetSymbol: foe.symbol, questUID: foe.parentQuest.uid };
  assert.equal(isAlreadyInjected([gone], foe), false);
  assert.equal(isAlreadyInjected([{ ...gone, targetSymbol: { name: foe.symbol.name } }], foe, true), false);
  assert.equal(isAlreadyInjected([{ ...gone, isComponentDestroyed: false }], foe), true, 'one standing is');
});

test('QA3 D1\'s revive, by its law: a body whose health stands again un-deads its behaviour only while its Foe has kills left - a fallen body of a two-body Foe counts once, frame after frame; stood again (a load from before its fall) its next fall counts; stood again once every kill is counted it counts nothing more (mutants: the revive, the health test, the kills test)', () => {
  const m = new QuestMachine({ nowSeconds: () => 0, world: lairWorld(), playerLevel: () => 1 });
  const q = quiet(() => m.scheduleQuest(['Quest: __TWO', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Foe _f_ is 2 Giant', '', '\tlog 1011 step 0'], 0, { rolls: () => 0.5 }));
  ticks(m, 2);
  const foe = q.getResource(sym('f'));
  assert.equal(foe.spawnCount, 2, 'the fixture: a Foe of two');
  const body = () => {
    const f = { entity: { health: 10, maxHealth: 10 }, dead: false };
    const b = new QuestResourceBehaviour(m);
    b.assignResource(foe);
    bindQuestFoeHost(f, b, { removeFoe: () => {}, zeroFoeHealth: (x) => { x.entity.health = 0; }, spellsByIndex: () => null, foeSinks: () => null });
    return f;
  };
  const one = body(), two = body();
  const frames = (n) => { for (let i = 0; i < n; i++) for (const f of [one, two]) f.questBehaviour.update(); };
  frames(1);
  one.entity.health = 0;
  frames(4);
  assert.equal(foe.killCount, 1, 'one body fallen: one kill, however many frames');
  foe.killCount = 0;   // a load from before the fall: the Foe alive again, the body stood again in place
  one.entity.health = 10;
  frames(2);
  one.entity.health = 0;
  frames(2);
  assert.equal(foe.killCount, 1, 'stood again, its next fall counts');
  two.entity.health = 0;
  frames(2);
  assert.equal(foe.killCount, 2, 'the second body\'s fall');
  one.entity.health = 10;
  frames(2);
  one.entity.health = 0;
  frames(2);
  assert.equal(foe.killCount, 2, 'every kill counted: a body stood again and fallen counts nothing more');
});

test('QA3 D2: a quest the journal\'s Restart threw away puts its stands away - its item and its person no longer drawn, none takes a click; its foe is left to its own law and a named NPC\'s home copy stands (mutants: the put-away, the foe, the home copy)', () => {
  const QUEST = ['Quest: __RESTART', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Item _it_ letter', 'Person _npc_ face 1 group Noble', 'Place _lair_ remote dungeon', 'Foe _f_ is Giant', '',
    '\tplace item _it_ at _lair_', '\tplace npc _npc_ at _lair_', '\tplace foe _f_ at _lair_', '\tlog 1011 step 0'];
  const m = new QuestMachine({ nowSeconds: () => 0, world: lairWorld([['The Den', 'DEN.RDB', 9100]]), playerLevel: () => 1, getQuestSourceLines: () => QUEST });
  let s0 = 7;
  const rolls = () => { s0 = (s0 * 16807) % 2147483647; return (s0 - 1) / 2147483646; };
  const q = quiet(() => m.scheduleQuest(QUEST, 0, { rolls }));
  ticks(m, 2);
  const lair = q.getPlace(sym('lair'));
  const stands = [];
  const stand = (kind, behaviour, enemy = null) => { const s = { kind, behaviour, enemy, shown: [], setActive(a) { this.shown.push(!!a); } }; stands.push(s); return s; };
  const adapter = {
    currentMapId: () => lair.siteDetails.mapId, findBehaviours: () => stands.map((s) => s.behaviour), loadInProgress: () => false,
    standNPC: ({ behaviour }) => stand('person', behaviour), standItem: ({ behaviour }) => stand('item', behaviour),
    standFoe: ({ behaviour }) => stand('foe', behaviour, { currentHealth: 10, maxHealth: 10, setCurrentHealth() {} }),
  };
  quiet(() => addQuestResourceObjects(m, adapter, SITE_TYPES.Dungeon, 0));
  assert.deepEqual(stands.map((s) => s.kind).sort(), ['foe', 'item', 'person']);
  const home = { shown: [], setActive(a) { this.shown.push(!!a); } };
  const homeCopy = new QuestResourceBehaviour(m, home);
  homeCopy.individualHome = true; homeCopy.assignResource(q.getResource(sym('npc'))); homeCopy.start();
  for (const s of stands) s.behaviour.update();
  homeCopy.update();
  assert.ok(stands.every((s) => !s.shown.includes(false)), 'running: everything stands');
  const r = quiet(() => m.restartQuest(q.uid));
  assert.equal(r.ok, true, `restarted - ${r.reason}`);
  assert.equal(m.getQuest(q.uid), null, 'the fixture: the old copy is the machine\'s no more');
  ticks(m, 2);
  for (const s of stands) s.shown.length = 0;
  for (let i = 0; i < 3; i++) { for (const s of stands) s.behaviour.update(); homeCopy.update(); }
  const of = (kind) => stands.find((s) => s.kind === kind);
  assert.deepEqual(of('item').shown.at(-1), false, 'its item put away');
  assert.deepEqual(of('person').shown.at(-1), false, 'its person put away');
  assert.deepEqual(of('foe').shown, [], 'its foe left to its own law');
  assert.deepEqual(home.shown, [], 'a named NPC\'s home copy stands');
  assert.equal(of('item').behaviour.doClick(), false, 'no click is its');
});

// ---- D3 ----

test('QA3 D3: a dungeon quest Person freed from a model keeps the stand\'s 2% lift off the floor it is freed onto; feet in the open are as given (the host lifted them) (mutants: the lift)', () => {
  const c = new Collider(() => -Infinity);
  c.addMesh('dungeon', [-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10], [0, 2, 1, 0, 3, 2], identity());
  const box = { positions: [], indices: [] };
  const v = (x, y, z) => { box.positions.push(x, y, z); return box.positions.length / 3 - 1; };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => [v(x, 0, z), v(x, 2, z)]);
  for (let i = 0; i < 4; i++) {
    const [a0, a1] = corners[i], [b0, b1] = corners[(i + 1) % 4];
    box.indices.push(a0, b1, b0, a0, a1, b1);
  }
  const [t0, t1, t2, t3] = corners.map(([, top]) => top);
  box.indices.push(t0, t2, t1, t0, t3, t2);
  c.addMesh('dungeon', box.positions, box.indices, identity());
  const height = 1.8;
  const inside = [0.2, height * 0.02, 0.1];   // the host's stand: the floor, lifted
  assert.ok(lodgedIn(c, inside), 'the fixture: the stand is in the box');
  const stood = freeQuestStand(c, inside, height);
  assert.ok(!lodgedIn(c, stood) && Math.max(Math.abs(stood[0]), Math.abs(stood[2])) > 1, `beside the box - ${stood}`);
  assert.ok(Math.abs(stood[1] - height * 0.02) < 1e-9, `lifted 2% of its height off the floor it stands on - ${stood[1]}`);
  const open = [5, height * 0.02, 5];
  assert.equal(freeQuestStand(c, open, height), open, 'in the open: as given, lifted once');
});

// ---- the fixes' own audit (the pin lane's findings on D2 and A3) ----

test('QA3 D2 (the fixes\' own audit): a guild questor whose quest the machine threw away stays at their post - the put-away is for the quest\'s own stands, never the clicked NPC\'s body (mutants: the questor\'s mark, its read)', async () => {
  const { loadTables, rmbBlock, town, worldOf } = await import('../../fb1004dTowns.mjs');
  loadTables();
  for (const mode of ['error', 'tombstone']) {
    let now = 1e6;
    const home = town({ name: 'Home', locationIndex: 0, mapId: 100, grid: ['HOME.RMB'] });
    const world = worldOf({ locations: [home], blocks: new Map([['HOME.RMB', rmbBlock('HOME.RMB', [{ type: 11 }])]]), current: home });
    const m = new QuestMachine({ nowSeconds: () => now, playerLevel: () => 1, world });
    const shown = [];
    const host = { setActive: (a) => shown.push(!!a), staticNpcFactionId: null };
    m.setLastNPCClicked({ hash: 77, mapID: 5, nameSeed: 9, buildingKey: 3 }, host);
    const body = mode === 'error' ? ['\thave _missing_ set _x_', '', 'variable _x_'] : ['\tlog 1011 step 0', '\tend quest'];
    const q = quiet(() => m.scheduleQuest(['Quest: __GUILD', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Item _nothing_ letter', 'Person _qg_ group Questor', '', ...body], 0, { rolls: () => 0.5 }));
    quiet(() => m.tick());
    const b = host.questBehaviour;
    assert.ok(b?.questorHost, `${mode}: the questor's own body carries the mark`);
    quiet(() => { m.tick(); m.tick(); });
    if (mode === 'tombstone') { now += 8 * 24 * 3600; quiet(() => { for (let i = 0; i < 3; i++) m.tick(); }); }
    assert.equal(m.getQuest(q.uid), null, `${mode}: the machine holds the quest no more`);
    for (let i = 0; i < 3; i++) b.update();
    assert.deepEqual(shown, [], `${mode}: never put away`);
  }
});

test('QA3 A3 (the fixes\' own audit): a stamped quest\'s start-up advance is paid as it stands, and leaves the quest unpaid - its own Item, never handed over by `give pc`; the reward after it is the one the outcome scales (mutants: the reward test)', () => {
  loadPackTables(); setPref(QUESTLINES_PREF, true);
  for (const [name, advance] of [['K0C00Y08', 5], ['A0C00Y11', 5]]) {
    const gold = [];
    const bridge = createQuestBridge({
      data: { readListTable: (n) => { try { return readFileSync(join(ROOT, 'vendor/dfu-quests/Tables', `QuestList-${n}.txt`), 'utf8'); } catch { return null; } }, getQuestSourceLines: (n) => questSource(n, true) },
      classicSeconds: () => 1000, nowSeconds: () => 1000, worldSeconds: () => 1000,
      playerEntity: { name: 'Hero', gender: 'female', level: 12, career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(40) },
      getReputation: () => 0, carriesQuestItem: () => false, showPrompt: (_q, _m, respond) => respond(true), onQuestlineOffer: () => {}, offerReward: () => {}, addGold: (n) => gold.push(n),
    });
    const q = quiet(() => bridge.machine.startQuestByName(name, 0, { rolls: () => 0 }));
    for (const t of q.tasks.values()) for (const a of t.actions) if (!a.isTriggerCondition) { const up = a.update.bind(a); a.update = (c) => { try { up(c); } catch { a.setComplete(); } }; }
    quiet(() => { for (let i = 0; i < 3; i++) { bridge.machine.tick(); bridge.questlines.look(); } });
    assert.ok(q.ql?.stamp, `${name}: stamped`);
    assert.deepEqual(gold, [advance], `${name}: the advance as it stands`);
    assert.equal(q.ql?.paid, false, `${name}: and the quest not yet paid - its reward still the outcome's to scale`);
  }
});
