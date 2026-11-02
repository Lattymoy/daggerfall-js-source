// QL-OFFERED (2026-10-25, Lord Rumpkin, "too many quests": "My quest log ... has become congested in a very
// short span ... also every town I enter there is some courier ramming quest letters into my hand ... Random quests like
// that should be picked up in the tavern, or notice board"; the owner: "No band aids", and his decision: A QUESTLINE IS
// TAKEN, NEVER SENT - bible/06-Systems/Questlines-Arc.md section 4, THE RUNNER). QL0's runner began every line whose
// gate held, unasked, and its first letter came by courier at the next town by day; the quest log drew each running
// step twice and every line, locked ones included. Now a line whose gate holds is OFFERED - posted on the notice board
// (the introductions), at its giver's door (the story lines, DFU's own Yes and No) and on the Quests tab - and the TAKE
// begins it, its letter in hand at once (systems/questlines/qlLineRunner.js takeLine, scenes/quest/questlineOffers.js).
// A first step that lapses puts its line back on offer, never sends it again; the later steps of a line the player took
// still come; a save from before keeps every line it had begun. The real bridge, the real runner, the real scripts, the
// real board and pause window on the house's minimal DOM. Mutants: tools/mutants/ql_offered.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass } from '../../chargenDom.mjs';   // the minimal DOM - globals (the board and the pause window mount on it)
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { createLineRunner, STEP_GAP_S, RETRY_GAP_S } from '../../../src/systems/questlines/qlLineRunner.js';
import { QUESTLINES_PREF, questlinesOn } from '../../../src/systems/questlines/qlLaw.js';
import { LOOT_RARITY_KEY } from '../../../src/systems/loot/lootRarity.js';
import { KINGS_GAMBIT_KEY } from '../../../src/systems/features.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { GUILD_GROUPS } from '../../../src/formats/factionFile.js';
import { questSource, loadTables } from '../../qlSources.mjs';
import { mountNoticeBoard } from '../../../src/ui/noticeWindow.js';
import { createNoticeOverlay } from '../../../src/ui/noticeDoor.js';
import { mountEnhancedMenu } from '../../../src/ui/enhanced/enhancedMenu.js';
import { TRACKER_PREF, _resetQuestTrackerForTests } from '../../../src/ui/quest/questTracker.js';
import { lineBoard } from '../../../src/scenes/quest/questlineOffers.js';

loadTables();
for (const k of [QUESTLINES_PREF, LOOT_RARITY_KEY, KINGS_GAMBIT_KEY, 'naval']) setPref(k, true);
// NO LIVE TIMER RUNS HERE (GUIDE2's law): the pause tab's intervals are recorded, never run
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};

const settle = async (n = 4) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

/** The real bridge as a host wires it, the player in a town by day - offline, or online with a registered account's
 *  service (the endgame lines' gate). Its HUD lines, the boxes it showed, the pack, the questors let go of the work pool. */
function bridgeAt({ level = 20, online = false } = {}) {
  const st = { s: 400 * 86400 + 12 * 3600, pack: [], hud: [], popups: [], removed: [] };
  const service = online ? { account: () => 'acct', guest: () => false, claim: async () => ({ ok: true, data: { opened: true } }) } : null;
  const warn = console.warn;
  console.warn = () => {};
  try {
    const bridge = createQuestBridge({
      data: { readListTable: () => null, getQuestSourceLines: (n) => questSource(n, questlinesOn()) },
      classicSeconds: () => st.s, skySeconds: () => st.s, worldSeconds: () => st.s, isPlayerInTown: () => true, questlineService: service,
      playerEntity: { name: 'Hero', level, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30), items: [] },
      giveItemToPlayer: (item) => st.pack.push(item), offerReward: () => {}, addHUDText: (text) => st.hud.push(text),
      showPopup: (q) => st.popups.push(q?.questName ?? null), removeNpcQuestor: (seed) => st.removed.push(seed),
      // the world's own part of `place npc` (no building to stand them in here), as ql12_lines' bridge does it
      onQuestStarted: (q) => { for (const task of q.tasks.values()) for (const a of task.actions) if (a.typeName === 'PlaceNpc') a.isComplete = true; },
    });
    const tick = (n = 1) => { const w = console.warn; console.warn = () => {}; try { for (let i = 0; i < n; i++) bridge.tick(1); } finally { console.warn = w; } };
    const named = (name) => [...bridge.machine.quests.values()].find((q) => q.questName === name && !q.questComplete && !q.questTombstoned) ?? null;
    const row = (id) => bridge.questLog().lines.find((l) => l.id === id) ?? null;
    /** What the runner parses for an offer, by line - the quest a letter is read from. */
    const read = new Map();
    const offerQuest = bridge.questlines.runner.offerQuest;
    bridge.questlines.runner.offerQuest = (id) => { const q = offerQuest(id); if (q) read.set(id, q); return q; };
    return { bridge, st, tick, named, row, read };
  } finally { console.warn = warn; }
}

/** A notice board's book with nothing on it (the service's notes are not this pin's). */
const quietBook = () => ({ seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null,
  draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) });

test('QL-OFFERED THE LAW: a line whose gate holds is offered and never scheduled - a day of looks begins none and sends nothing; the take begins it, its first step started then and its record the player\'s (`taken`, the take a letter\'s moment); a line its gate shuts is no row and no take; online, where else each is posted (mutants: look begins a line; the take\'s gate; the locked row drawn; the post)', () => {
  setPref(QUESTLINES_PREF, true);
  const machineOf = () => {
    let uid = 1;
    const m = { quests: new Map(), questsToInvoke: [], scheduled: [],
      scheduleQuestByName(name) { const q = { uid: uid++, questName: name, questComplete: false, questTombstoned: false }; m.questsToInvoke.push(q); m.scheduled.push(name); return q; },
      tick() { for (const q of m.questsToInvoke.splice(0)) m.quests.set(q.uid, q); } };
    return m;
  };
  const machine = machineOf();
  const clock = { s: 50 * 86400 };
  const runner = createLineRunner({ machine, ctx: { level: () => 30, online: () => false, nowSeconds: () => clock.s } });
  for (let i = 0; i < 24; i++) { runner.look(); machine.tick(); clock.s += STEP_GAP_S; }
  assert.deepEqual(machine.scheduled, [], 'a day in town: nothing sent');
  assert.deepEqual(runner.rows().map((r) => [r.id, r.state, r.post]), [['introGear', 'offered', null], ['introSea', 'offered', null], ['introRoad', 'offered', null], ['introTables', 'offered', null]],
    'on offer, and only what may be taken - no locked line drawn; offline a town\'s board is DFU\'s rumour box, so none is posted there');
  assert.equal(runner.takeLine('burningDoors').reason, 'closed', 'an endgame line offline: not on offer');
  assert.equal(runner.takeLine('noSuchLine').reason, 'unknown');
  assert.deepEqual(runner.takeLine('introRoad'), { ok: true, line: 'introRoad' });
  assert.deepEqual(machine.scheduled, ['QLIR01'], 'its first step started on the take');
  const rec = runner.lineState('introRoad');
  assert.deepEqual([rec.step, rec.taken, rec.begun, rec.lettered], [0, true, clock.s, clock.s], 'the player\'s, from this second');
  runner.look(); machine.tick();
  assert.equal(runner.rows().find((r) => r.id === 'introRoad').state, 'running');
  assert.deepEqual(machine.scheduled, ['QLIR01'], 'once');
  // online, a registered account: each line on offer says where else it is posted (qlLines.js LinePost)
  const svc = { account: () => 'acct', guest: () => false, claim: async () => ({ ok: true, data: { opened: true } }) };
  const on = createLineRunner({ machine: machineOf(), service: svc, ctx: { level: () => 30, online: () => true, nowSeconds: () => clock.s } });
  const posts = Object.fromEntries(on.rows().map((r) => [r.id, r.post]));
  assert.deepEqual([posts.burningDoors, posts.hourThatWasNot, posts.skyKetch, posts.oldCoil, posts.introCrafts], ['magery', 'temple', 'tavern', 'tavern', 'board']);
  assert.equal(posts.covensHoard, undefined, 'after the Burning Doors: not yet on offer, no row');
});

test('QL-OFFERED THE TAKE, on the real bridge: nothing begins unasked; taken from the Quests tab, the first step\'s letter is in hand at once and in silence - no courier, no box - its journal entry written and its own clock counting, and the take said in the HUD (mutants: the start-up\'s letter on a courier again; the take unsaid)', () => {
  const S = bridgeAt({ level: 2 });
  S.tick(6);
  assert.equal(S.named('QLIT01'), null, 'nothing begun unasked');
  assert.equal(S.row('introTables').state, 'offered');
  const r = S.bridge.journalClean.takeLine('introTables');
  assert.equal(r.ok, true);
  assert.equal(r.text, 'You took up A Seat at the Table. It is on the Quests tab of the pause menu.');
  assert.ok(S.st.hud.includes(r.text), 'said in the HUD');
  S.tick(3);
  const q = S.named('QLIT01');
  assert.ok(q, 'its first step running');
  assert.ok(S.st.pack.includes(q.getItem({ name: 'card' }).daggerfallUnityItem), 'the card in the pack');
  assert.deepEqual(S.st.popups, [], 'taken, never sent: no courier\'s box');
  assert.deepEqual(q.getLogMessages().map((m) => m.messageID), [1010], 'its journal entry');
  assert.equal(q.getClock({ name: 'wait' }).clockEnabled, true, 'its thirty days counting from the take');
  assert.equal(S.row('introTables').state, 'running');
  assert.equal(S.bridge.journalClean.takeLine('introTables').text, 'That questline is not on offer now.', 'taken once');
});

test('QL-OFFERED A FIRST STEP THAT LAPSES IS OFFERED AGAIN, NEVER SENT AGAIN, on the real bridge: its thirty days run out (QuestFail), the line is back on offer with no record; days on, no copy of it has begun; taken again, it begins (mutants: the end\'s re-offer and the look\'s)', () => {
  const S = bridgeAt({ level: 2 });
  S.bridge.journalClean.takeLine('introTables');
  S.tick(3);
  S.named('QLIT01').getTask({ name: 'wait' }).start();   // its _wait_ clock's own task: "... found another" - `end quest`
  S.tick(6);
  assert.equal(S.named('QLIT01'), null, 'ended');
  assert.equal(S.bridge.questlines.runner.lineState('introTables'), null, 'its record let go');
  assert.equal(S.row('introTables').state, 'offered', 'on offer again');
  S.st.s += 3 * 86400;
  S.tick(10);
  assert.equal(S.named('QLIT01'), null, 'three days on: never sent again');
  assert.equal(S.bridge.journalClean.takeLine('introTables').ok, true, 'taken again');
  S.tick(3);
  assert.ok(S.named('QLIT01'));
});

test('QL-OFFERED A TAKEN LINE\'S LATER STEPS STILL COME, on the real bridge: the first step finished (a hand won, its regular told), the second begins an hour on with no take of its own (mutants: a later step left to a take)', () => {
  const S = bridgeAt({ level: 2 });
  S.bridge.journalClean.takeLine('introTables');
  S.tick(3);
  const q = S.named('QLIT01');
  S.bridge.questlines.act('cards-won', 1);
  S.tick(3);
  for (const r of q.resources.values()) if (r.isPerson && r.symbol?.name === 'regular') r.setPlayerClicked();
  S.tick(6);
  assert.ok(q.questComplete && q.questSuccess, 'the first step done');
  assert.equal(S.bridge.questlines.runner.lineState('introTables').step, 1);
  assert.equal(S.named('QLIT02'), null, 'not in the same breath');
  S.st.s += STEP_GAP_S;
  S.tick(3);
  assert.ok(S.named('QLIT02'), 'an hour on, the next step - the line the player\'s');
});

test('QL-OFFERED OLD SAVES KEEP THEIR PROGRESS: a save from before (QL0\'s records, no `taken`) loads every line it had begun where it stood - a first step whose letter came (its journal entry written) stays the player\'s, a later step stands; a first step SENT and never delivered (scheduled, no entry) is let go and its line is on offer; a first step with no quest goes back on offer; a line the player TOOK is never let go, its letter come or not (mutants: the migration unread; `taken` unread; the journal unread)', () => {
  const A = bridgeAt({ level: 30 });
  A.bridge.machine.startQuestByName('QLIT01'); A.tick(2);   // QL0's runner began it, and its letter came
  A.bridge.machine.startQuestByName('QLIG02'); A.tick(2);   // the Smith's Secrets at its second step
  A.bridge.machine.scheduleQuestByName('QLIR01');   // sent, its letter not come - saved before the next tick
  const snap = A.bridge.snapshot();
  const ql0 = (step) => ({ step, outcomes: {}, done: false, wait: 0, claims: {}, begun: 1, lettered: 0 });
  snap.questlines.lines = { introTables: ql0(0), introGear: ql0(1), introRoad: ql0(0), introSea: ql0(0) };
  const B = bridgeAt({ level: 30 });
  B.bridge.restore(structuredClone(snap));
  const runner = B.bridge.questlines.runner;
  assert.equal(runner.lineState('introTables')?.step, 0, 'its letter came: the player\'s');
  assert.equal(runner.lineState('introGear')?.step, 1, 'a later step: where it stood');
  assert.equal(runner.lineState('introRoad'), null, 'sent and never delivered: let go');
  assert.ok(![...B.bridge.machine.questsToInvoke, ...B.bridge.machine.quests.values()].some((q) => q.questName === 'QLIR01' && !q.questTombstoned), 'its quest gone with it');
  B.tick(2);
  assert.deepEqual(['introTables', 'introGear', 'introRoad', 'introSea'].map((id) => B.row(id)?.state), ['running', 'running', 'offered', 'offered']);
  // a line the player TOOK, its letter still to come: never let go
  const C = bridgeAt({ level: 30 });
  const snap2 = structuredClone(snap);
  snap2.questlines.lines = { introRoad: { ...ql0(0), taken: true } };
  C.bridge.restore(snap2);
  assert.equal(C.bridge.questlines.runner.lineState('introRoad')?.step, 0, 'taken: the player\'s');
  C.tick(2);
  assert.equal(C.row('introRoad').state, 'running');
});

test('QL-OFFERED THE NOTICE BOARD\'S WORK WANTED: online, the introductions on offer hang on the Notices tab, each its giver\'s letter under the town\'s seal; read large, a card\'s Take begins its line with the very quest its letter was read from, says so and comes down; a line begun is no card; every board the door opens posts them (mutants: the section dropped; the Take unwired; the card left up; the take a new draw; the door\'s source; the bridge unregistered)', async () => {
  const S = bridgeAt({ level: 20, online: true });
  assert.ok(lineBoard()?.cards.some((c) => c.id === 'introTables'), 'the bridge posts its board on the page');
  const host = globalThis.document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Daggerfall', mapId: 5 }, book: quietBook(), questlines: () => S.bridge.lineOffers.board() });
  await settle();
  const head = byClass(host, 'notice-section').map((n) => n.textContent).find((h) => h.startsWith('Help wanted'));
  assert.ok(head, 'its section');
  const cards = () => byClass(host, 'notice-card').filter((c) => /seal-town/.test(c.className) && c.textContent.includes('A Seat at the Table'));
  assert.equal(cards().length, 1, 'A Seat at the Table hangs there');
  assert.match(cards()[0].textContent, /a tavern regular/, 'its giver named');
  cards()[0].click();
  const read = byClass(host, 'notice-read')[0];
  assert.match(read.textContent, /every coin I own, and I have taken every coin they own/, 'its letter, its lines joined as one');
  const take = byClass(host, 'notice-take')[0];
  assert.ok(take, 'its Take');
  take.click();
  assert.equal(byClass(host, 'notice-word')[0].textContent, 'You took up A Seat at the Table. It is on the Quests tab of the pause menu.');
  assert.equal(cards().length, 0, 'its card down');
  assert.equal(S.named('QLIT01'), S.read.get('introTables'), 'the letter read is the quest begun');
  assert.equal(S.bridge.questlines.runner.lineState('introTables')?.taken, true);
  // the next board: a line begun is no card - and the door posts the bridge's own, no host handing it
  const ov = createNoticeOverlay({ town: { name: 'Daggerfall', mapId: 5 }, book: quietBook(), onClose() {} });
  await settle(8);
  const door = globalThis.document.body.children.find((n) => n.attrs?.id === 'notice-board-host' || n.id === 'notice-board-host');
  try {
    const titles = byClass(door, 'notice-card').map((c) => c.textContent);
    assert.ok(titles.some((t) => t.includes('Written in the Stars')), 'the door\'s board posts them');
    assert.ok(!titles.some((t) => t.includes('A Seat at the Table')), 'a line begun: no card');
  } finally { ov.dispose(); }
});

test('QL-OFFERED THE GIVERS\' DOORS: a Mages Guild hall\'s Get Quest offers Ysolde\'s letter behind DFU\'s Yes and No - Yes takes the line with the quest the letter was read from; No rests it a day at every giver, the guild\'s own draw meanwhile and the Quests tab still offering it; a temple\'s offers the Prior\'s; someone with work in a tavern the first tavern line on offer, the questor out of the work pool; elsewhere DFU\'s own door; a questor whose quest is open offers nothing new; a load lets an offer in hand go (mutants: the guild door; the tavern door; the rest; its day; the pool; the busy questor; the load)', () => {
  const guild = (B, guildGroup) => B.bridge.offerGuildQuest({ guildGroup, guild: {}, membership: null, reputation: 0, buildingFactionId: 0 });
  const S = bridgeAt({ level: 20, online: true });
  const step = guild(S, GUILD_GROUPS.MagesGuild);
  assert.deepEqual([step?.kind, step?.line], ['offer', 'burningDoors']);
  const [box] = S.bridge.offerBoxes(step, () => []);
  assert.equal(box.buttons, 'YesNo', 'DFU\'s own Yes and No');
  assert.match(box.rows.join('\n'), /Ysolde Marnhel, Master Conjurer of Wayrest/, 'her letter, its sign-off');
  assert.deepEqual(box.onYes(), [], 'taken: no box of its own - the HUD says it');
  assert.equal(S.bridge.questlines.runner.lineState('burningDoors')?.taken, true);
  assert.equal(S.named('QLBD01'), S.read.get('burningDoors'), 'the letter read is the quest begun');
  assert.ok(S.st.hud.includes('You took up The Burning Doors. It is on the Quests tab of the pause menu.'));
  // No: it rests a day at every giver
  const R = bridgeAt({ level: 20, online: true });
  R.bridge.offerBoxes(guild(R, GUILD_GROUPS.MagesGuild), () => [])[0].onNo();
  assert.notEqual(guild(R, GUILD_GROUPS.MagesGuild)?.line, 'burningDoors', 'refused: the guild\'s own draw');
  assert.equal(R.row('burningDoors').state, 'offered', 'still on offer at the Quests tab');
  R.st.s += RETRY_GAP_S - 1;
  assert.notEqual(guild(R, GUILD_GROUPS.MagesGuild)?.line, 'burningDoors', 'not within its day');
  R.st.s += 1;
  assert.equal(guild(R, GUILD_GROUPS.MagesGuild)?.line, 'burningDoors', 'a day on, asked again');
  // a temple's questor: the Prior's; a tavern's: the first tavern line on offer (the Weir Road waits on the Hoard)
  assert.equal(guild(R, GUILD_GROUPS.HolyOrder)?.line, 'hourThatWasNot');
  assert.equal(guild(R, GUILD_GROUPS.FightersGuild)?.line, undefined, 'a guild that posts none: its own draw');
  const npc = { nameSeed: 4242, factionID: 0, gender: 0 };
  assert.equal(R.bridge.offerSocialQuest(npc, 0, false, true)?.line, 'skyKetch');
  assert.deepEqual(R.st.removed, [4242], 'the questor leaves the work pool, as DFU\'s offer window does');
  assert.equal(R.bridge.offerSocialQuest(npc, 0, false, false)?.line, undefined, 'outside a tavern: DFU\'s own social draw');
  // a questor whose quest is still open offers nothing new - DFU's door says so
  R.bridge.machine.lastNPCClickedQuestorOf = () => ({ quest: { displayName: 'Brass at Dusk', questName: 'QLHR01' }, person: {} });
  assert.equal(guild(R, GUILD_GROUPS.HolyOrder)?.kind, 'close');
  delete R.bridge.machine.lastNPCClickedQuestorOf;
  // a load under the offer: its Yes starts nothing in the loaded game (QUEST-UID1)
  const L = bridgeAt({ level: 20, online: true });
  const held = guild(L, GUILD_GROUPS.MagesGuild);
  L.bridge.restore(L.bridge.snapshot());
  assert.deepEqual(held.respond(true), { kind: 'close' });
  assert.equal(L.bridge.questlines.runner.lineState('burningDoors'), null, 'nothing taken');
});

/** The pause window's Quests tab over a log, in the document as the pause door mounts it. */
async function withTab(log, clean, fn) {
  setPref(TRACKER_PREF, true);
  _resetQuestTrackerForTests();
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: { questLog: () => log, journalClean: () => clean }, onAction: () => {}, at: 'quests' });
  try { return await fn(host); } finally { menu.unmount(); host.remove(); _resetQuestTrackerForTests(); }
}
const all = (root) => root.querySelectorAll('*');
/** The rail top to bottom: each section's heading and each row's words. */
const rowsOf = (host) => all(host).filter((n) => (n.tagName === 'BUTTON' && String(n.className).includes('px-qrow')) || String(n.className).includes('px-qarch')).map((n) => n.textContent.replace(/^\W+/, ''));

test('QL-OFFERED THE QUESTS TAB: a questline\'s running step is drawn under its line, never a second time as a side quest; a line on offer says where it is posted and its Take up arms on its first press and takes on the second; with the questlines off the step is a side quest again, never lost (mutants: the step left in Side Quests; the step not drawn under its line; one press takes; the Take up unwired; the post unsaid)', async () => {
  const message = (text) => ({ id: 1, getTextTokens: () => [{ formatting: 'text', text }], parentQuest: null });
  const quest = (id, name, questName) => ({ id, name, questName, clockSeconds: null, clocks: [], messages: [message(`${name}.`)], steps: [{ stepID: 0, messageID: 1, time: 1 }], ql: null });
  const step = (q, title, state) => ({ quest: q, title, state, witnessed: false, outcome: null });
  const log = () => ({
    active: [quest('4', 'Rat Problem', 'M0B00Y01'), quest('9', 'The First Hand', 'QLIT01')],
    unlogged: [], shelved: [], hidden: [], finished: [], ladders: [],
    lines: [
      { id: 'introTables', group: 'intro', title: 'A Seat at the Table', lead: 'A card player.', giver: 'a tavern regular', state: 'running', opens: null, outcome: null, honour: null, post: null, steps: [step('QLIT01', 'The First Hand', 'current'), step('QLIT02', 'The Long Game', 'next')] },
      { id: 'introRoad', group: 'intro', title: 'The Merchant’s Road', lead: 'A load to haul.', giver: 'a stable master', state: 'offered', opens: null, outcome: null, honour: null, post: 'board', steps: [step('QLIR01', 'A Load for the Yard', 'next'), step('QLIR02', 'The Long Haul', 'next')] },
    ],
  });
  const taken = [];
  const clean = { offers: () => [], takeLine: (id) => { taken.push(id); return { ok: true, text: 'You took up The Merchant’s Road. It is on the Quests tab of the pause menu.' }; } };
  await withTab(log(), clean, async (host) => {
    const order = rowsOf(host);
    assert.deepEqual(order.slice(order.indexOf('Side Quests'), order.indexOf('Archived')), ['Side Quests', 'Rat Problem', 'Questlines', 'A Seat at the Table', 'The First Hand', 'The Merchant’s Road'],
      'the step under its line, once; the line on offer after the one under way');
    const stepRow = all(host).find((n) => n.tagName === 'BUTTON' && n.textContent.includes('The First Hand'));
    assert.match(String(stepRow.className), /px-qstep/);
    stepRow.click();
    assert.match(host.querySelectorAll('.px-qdetail')[0].textContent, /The First Hand\./, 'its own quest\'s page');
    const road = all(host).find((n) => n.tagName === 'BUTTON' && String(n.className).includes('px-qlinerow') && n.textContent.includes('Merchant'));
    road.click();
    const detail = () => host.querySelectorAll('.px-qdetail')[0];
    assert.match(detail().textContent, /On offer: nothing comes until you take it up.*You can also take it from the notice board in any town\./);
    const go = () => all(detail()).find((n) => n.tagName === 'BUTTON' && /take it up/i.test(n.textContent));
    assert.equal(go().textContent, 'Take it up');
    go().click();
    assert.deepEqual(taken, [], 'armed, not taken');
    assert.equal(go().textContent, 'Click again to take it up');
    go().click();
    assert.deepEqual(taken, ['introRoad']);
    assert.match(detail().textContent, /You took up The Merchant’s Road\./, 'said under the line');
  });
  // the questlines off (the bridge hands no lines): the step is a side quest again
  const off = { ...log(), lines: [] };
  await withTab(off, clean, async (host) => {
    const order = rowsOf(host);
    assert.deepEqual(order.slice(order.indexOf('Side Quests'), order.indexOf('Archived')), ['Side Quests', 'Rat Problem', 'The First Hand']);
  });
});
