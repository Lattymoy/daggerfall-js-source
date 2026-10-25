// QL2 (bible/06-Systems/Questlines-Arc.md section 6): THE QUESTS TAB'S QUESTLINE PARTS - one module the pause window's
// Quests tab and the chronicle both draw from (ui/questlines/qlJournal.js): a stamped quest's objectives as the
// machine's state opened them (never a hidden one), its choices, how it ended, what it pays; a reward waiting, its three
// pieces and their Take. And the bridge hands both faces their doors through `journalClean`, the one door every host
// already hands its pause window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakePage } from '../../hudPage.mjs';
import { qlObjectivesBlock, qlOfferDetail, offerRowWords, rewardWords, floorWords, qlLineDetail, lineStateWords, qlLadderDetail, pieceStatWords, offerWaitingWords } from '../../../src/ui/questlines/qlJournal.js';
import { questRail, unloggedRail } from '../../../src/ui/quest/questRail.js';
import { TIER_FLOORS, REWARD_CHOICES, rollRewardChoice } from '../../../src/systems/questlines/qlRewards.js';
import { weaponDamageString, armourModString, weightString } from '../../../src/systems/item/itemInfo.js';
import { PlayerNotebook, filedOutcome } from '../../../src/systems/notebook.js';
import { QuestJournalWindow } from '../../../src/ui/quest/questJournal.js';
import { createQuestlines } from '../../../src/systems/questlines/qlLayer.js';
import { createLineRunner } from '../../../src/systems/questlines/qlLineRunner.js';
import { QUESTLINES_PREF } from '../../../src/systems/questlines/qlLaw.js';
import { GAME_START_QUESTS, createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { questSource, loadTables, ROOT } from '../../qlSources.mjs';   // the pack as the game reads it
import { questlinesOn } from '../../../src/systems/questlines/qlLaw.js';
import { tutorialById, setTutorialHandler, markTutorialSeen, forgetTutorialsSeen, _resetTutorialTriggerForTests } from '../../../src/systems/tutorials.js';
import { setPref } from '../../../src/systems/uiPrefs.js';

const text = (n) => n.textContent;

test('QL2 the block: what to do as the state opened it - done, failed, optional, alternatives joined by "or" - the choices, and what finishing pays', () => {
  const doc = fakePage();
  const ql = {
    tier: 3,
    gear: true,   // AUDIT QUESTLINES UI-4 (PIN MOVED): the promise is drawn only for a quest that can pay gear (the row's `gear`)
    objectives: [
      { id: 'a', text: 'Find the ring', state: 'done' },
      { id: 'b', text: 'Return it to the Guild', state: 'open', any: 'end' },
      { id: 'c', text: 'Sell it to the fence', state: 'open', any: 'end' },
      { id: 'd', text: 'Read the letter', state: 'open', optional: true },
      { id: 'e', text: 'Never shown', state: 'hidden' },
      { id: 'f', text: 'Keep the client alive', state: 'failed' },
    ],
    choices: [{ branch: 'fate', text: 'The thief begs for mercy.', choice: 'Let the thief go' }],
    outcome: null,
  };
  const block = qlObjectivesBlock(doc, ql);
  const rows = block.querySelectorAll('.px-qobj-row');
  assert.deepEqual(rows.map(text).map((s) => s.replace(/^\W+/, '')), ['Find the ringdone', 'Return it to the Guild', 'Sell it to the fence', 'Read the letteroptional', 'Keep the client alivefailed']);
  assert.deepEqual(rows.map((r) => r.className.split(' ')[1]), ['done', 'open', 'open', 'open', 'failed']);
  assert.equal(block.querySelectorAll('.px-qobj-or').length, 1, 'two alternatives, one "or" between them');
  assert.ok(!text(block).includes('Never shown'), 'a hidden objective is never drawn');
  assert.match(text(block), /What to do/);
  assert.match(text(block), /Your choices.*The thief begs for mercy\.Let the thief go/);
  assert.equal(text(block.querySelector('.px-qobj-reward')), rewardWords(3));
  assert.match(rewardWords(3), new RegExp(`choose one of ${REWARD_CHOICES} pieces`));
  assert.equal(floorWords(3), TIER_FLOORS[3].floor === 'rare' ? 'Rare or better' : 'Magic or better', 'read off the constant');
  assert.equal(floorWords(1), 'Magic or better');
});

test('QL2 the block: an ended quest says how it ended (a failure in its own colour) and no reward line; DFU\'s quest draws nothing', () => {
  const doc = fakePage();
  const won = qlObjectivesBlock(doc, { tier: 2, objectives: [{ id: 'a', text: 'x', state: 'done' }], choices: [], outcome: { id: 'done', text: 'The beast is dead.', failure: false } });
  assert.match(text(won), /How it ended.*The beast is dead\./);
  assert.equal(won.querySelector('.px-qobj-reward'), null);
  const lost = qlObjectivesBlock(doc, { tier: 2, objectives: [], choices: [], outcome: { id: 'failed', text: 'Too late.', failure: true } });
  assert.ok(lost.querySelector('.px-qobj-outcome').className.includes('failed'));
  assert.equal(qlObjectivesBlock(doc, null), null);
  assert.equal(qlObjectivesBlock(doc, { tier: 1, objectives: [{ id: 'a', text: 'x', state: 'hidden' }], choices: [], outcome: null }), null, 'nothing opened, nothing to say');
});

test('QL3 a reward waiting: its pieces as cards - name, tier and kind, their magic - each with its Take', () => {
  const doc = fakePage();
  const taken = [];
  const offer = { id: 7, title: 'Wild Animal', pieces: [
    { kind: 'weapon', tier: 'rare', item: { name: 'Keen Longsword', affixes: [] } },
    { kind: 'armor', tier: 'magic', item: { name: 'Sturdy Cuirass', affixes: [] } },
    { kind: 'jewel', tier: 'magic', item: { name: 'Ring', affixes: [] } },
  ] };
  const box = qlOfferDetail(doc, offer, (i) => taken.push(i));
  const cards = box.querySelectorAll('.px-qpiece');
  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map((c) => c.dataset.rarity), ['rare', 'magic', 'magic'], 'the ladder\'s colour by the sheet');
  // PIN MOVED (AUDIT QUESTLINES VOICE-QL): Armor, Jewelry - American spelling in the game's own words (Voice.md rule 8)
  assert.deepEqual(cards.map((c) => text(c.querySelector('.px-qpiece-tier'))), ['Rare · Weapon', 'Magic · Armor', 'Magic · Jewelry']);
  const take = cards[1].querySelector('.act');
  assert.equal(text(take), 'Take this');
  assert.match(take.title, /Sturdy Cuirass/, 'a press explains what a hover would (plain words, law 5)');
  take.onclick();
  assert.deepEqual(taken, [1]);
  assert.equal(offerRowWords(offer), 'Reward: Wild Animal');
});

test('QL2 the rail carries `ql` to both faces, and a stamped quest with no journal entry yet is a row of the pause tab\'s by its objectives', () => {
  const ql = { tier: 1, objectives: [{ id: 'a', text: 'x', state: 'open' }], choices: [], outcome: null };
  const message = { getTextTokens: () => [{ text: 'An entry.', formatting: 'text' }], parentQuest: null };
  const rail = questRail({ active: [{ id: '4', name: 'Q', questName: 'M0B00Y06', messages: [message], steps: [{ stepID: 0, time: 0 }], ql }] });
  assert.equal(rail.active[0].ql, ql);
  const un = unloggedRail({ unlogged: [{ id: '9', name: 'Silent', questName: 'S0000988', ql }] });
  assert.deepEqual(un.map((r) => [r.key, r.entries.length, r.main, r.ql === ql]), [['a:9', 0, true, true]]);
  assert.deepEqual(unloggedRail({}), []);
});

test('QL12 a questline\'s page: what a questline is, its story and giver, its steps as the path walked, what it waits on and the title it earns', () => {
  const doc = fakePage();
  const line = {
    id: 'burningDoors', title: 'The Burning Doors', lead: 'Someone is opening the breaches.', giver: 'Ysolde Marnhel', state: 'waiting',
    opens: 'Opens online.', outcome: null, honour: 'doorwarden',
    steps: [
      { quest: 'QLBD01', title: 'A Letter from Wayrest', state: 'done', witnessed: false, outcome: 'Ysolde told you how.' },
      { quest: 'QLBD02', title: 'The Faithful', state: 'current', witnessed: false, outcome: null },
      { quest: 'QLBD03', title: 'Breaking the Rite', state: 'next', witnessed: true, outcome: null },
    ],
  };
  const box = qlLineDetail(doc, line, { titleText: (k) => (k === 'doorwarden' ? 'Doorwarden' : k) });
  assert.match(text(box), /A questline is a story told in several quests/, 'the page says what a questline is');
  assert.match(text(box), /Someone is opening the breaches\./);
  assert.match(text(box), /Given by Ysolde Marnhel/);
  assert.match(text(box), /Waiting for its next step/);
  assert.match(text(box), /Opens online\./);
  const rows = box.querySelectorAll('.px-qobj-row');
  assert.deepEqual(rows.map((r) => r.className.split(' ')[1]), ['done', 'open', 'next']);
  assert.ok(text(rows[0]).includes('done') && text(rows[1]).includes('now'));
  // AUDIT QUESTLINES UI-12 (PIN MOVED): a hover explained "witnessed" - no press, no pad; the page says it once
  assert.equal(text(rows[2].querySelector('.px-qobj-tag')), 'needs a witness', 'a step still to do needs one');
  // PIN MOVED (AUDIT QUESTLINES VOICE-QL): the places by name, a sentence of its own - never "an endgame place" (Voice.md rule 3)
  assert.match(text(box), /A witnessed step is done in a Dagon.s Breach, an Elite Breach.s Redoubts, the Abyss Dungeon.s Shattered Hour, against the Sea Serpent or at a fallen star\. The account service checks it against that place.s own record before it pays\./);   // PIN MOVED (STAR8): and a fallen star
  assert.equal(text(box.querySelector('.px-qline-said')), 'Ysolde told you how.', 'a done step says how it ended');
  assert.match(text(box), /Finish it to earn the title Doorwarden/);
  const done = qlLineDetail(doc, { ...line, state: 'done', opens: null, outcome: 'The embers went to the Guild.' }, { titleText: () => 'Doorwarden' });
  assert.match(text(done), /How it ended.*The embers went to the Guild\./);
  assert.match(text(done), /earns the title Doorwarden/);
  // PIN MOVED (QL-OFFERED - a questline is taken, never sent): a line its gate shuts is no row, so no state says it; a
  // line on offer says nothing comes until it is taken, and where else it is posted
  assert.equal(lineStateWords('offered'), 'On offer: nothing comes until you take it up');
  const offered = qlLineDetail(doc, { ...line, state: 'offered', opens: null, post: 'magery', steps: line.steps.map((x) => ({ ...x, state: 'next', outcome: null })) }, { titleText: () => 'Doorwarden' });
  assert.match(text(offered), /On offer: nothing comes until you take it up.*A Mages Guild questor in any guild hall offers it too\./);
  assert.doesNotMatch(text(box), /offers it too/, 'a line begun is posted nowhere');
});

test('AUDIT QUESTLINES UI-7, UI-16, ACTS-1: a done step\'s mark is the service\'s answer (witnessed / not yet seen, and what to do); a finished line\'s title waits on a deed not yet seen; the last step\'s outcome said once; a failed step and a step set aside said (mutants: the mark from the kind; the title regardless; the outcome twice; the states\' words)', () => {
  const doc = fakePage();
  const steps = [
    { quest: 'QLBD03', title: 'Breaking the Rite', state: 'done', witnessed: true, seen: true, unseen: false, outcome: 'The rite broke.' },
    { quest: 'QLBD04', title: 'Through the Burning Door', state: 'done', witnessed: true, seen: false, unseen: true, outcome: 'The door closed.' },
    { quest: 'QLBD05', title: 'The Caged Broker', state: 'done', witnessed: false, outcome: 'The embers went to the Guild.' },
  ];
  const box = qlLineDetail(doc, { id: 'burningDoors', title: 'The Burning Doors', lead: '', giver: '', state: 'done', opens: null, outcome: 'The embers went to the Guild.', honour: 'doorwarden', steps }, { titleText: () => 'Doorwarden' });
  const tags = box.querySelectorAll('.px-qobj-row').map((r) => r.querySelector('.px-qobj-tag')).map((g) => (g ? text(g) : null));
  assert.deepEqual(tags, ['witnessed', 'not yet seen', null]);
  assert.match(text(box), /Not yet seen: the account service has no record of that deed since this questline began\. Do it again and it will count\./);
  assert.match(text(box), /The title Doorwarden waits until the account service has seen every deed this questline asks\./);
  assert.doesNotMatch(text(box), /earns the title/);
  assert.equal(box.querySelectorAll('.px-qline-said').length, 2, 'the last step\'s outcome is "How it ended" alone');
  assert.equal(lineStateWords('retry'), 'Its last step failed: it will be offered again');
  assert.equal(lineStateWords('shelved'), 'Its step is set aside in your journal');
});

test('QL2 the Quest Guide reads objectives: the tracker\'s card says the one asked now, and the herald says one done', async () => {
  const { QuestLens, currentObjective } = await import('../../../src/ui/quest/questLens.js');
  const { QuestHerald, HERALD_WORDS } = await import('../../../src/ui/quest/questHerald.js');
  const { QuestTracker } = await import('../../../src/ui/quest/questTracker.js');
  const message = { id: 1010, getTextTokens: () => [{ text: 'A beast is loose in the house.', formatting: 'text' }], parentQuest: null };
  let ql = { tier: 1, objectives: [{ id: 'slay', text: 'Kill the beast', state: 'open' }, { id: 'tell', text: 'Return for your pay', state: 'hidden' }], choices: [], outcome: null };
  const row = () => ({ id: '7', name: 'Wild Animal', questName: 'M0B00Y06', messages: [message], steps: [{ stepID: 0, messageID: 1010, time: 1 }], clocks: [], ql });
  const lens = new QuestLens({ questLog: () => ({ active: [row()], ended: [] }) });
  assert.equal(currentObjective(ql), 'Kill the beast');
  assert.deepEqual(lens.look().events, [], 'a baseline');
  const tracker = new QuestTracker();
  tracker.pinned = '7';
  tracker.hear(lens.look());
  assert.equal(tracker.frame().opening, 'Kill the beast', 'the card: the objective, not the entry');
  ql = { ...ql, objectives: [{ id: 'slay', text: 'Kill the beast', state: 'done' }, { id: 'tell', text: 'Return for your pay', state: 'open' }] };
  const seen = lens.look();
  assert.deepEqual(seen.events, [{ type: 'objective', id: '7', title: 'Wild Animal', main: false, text: 'Kill the beast' }]);
  tracker.hear(seen);
  assert.equal(tracker.frame().opening, 'Return for your pay');
  const herald = new QuestHerald();
  herald.hear(seen);
  assert.deepEqual([herald.rows[0].type, herald.rows[0].line], ['objective', 'Kill the beast']);
  assert.equal(HERALD_WORDS.objective, 'Objective done');
  assert.deepEqual(lens.look().events, [], 'said once');
});

test('AUDIT QUESTLINES UI-1, UI-2: the tracker\'s card names the objective the quest NEEDS before an optional one opened first; the herald\'s "Objective done" keeps its words when the script\'s entry lands a look later (mutants: the optional first; the kept line recomputed)', async () => {
  const { QuestLens, currentObjective } = await import('../../../src/ui/quest/questLens.js');
  const { QuestHerald } = await import('../../../src/ui/quest/questHerald.js');
  // C0B10Y15's shape: the lich (optional) listed before the return (needed)
  const lich = { id: 'lich', text: 'Destroy the lich', state: 'open', optional: true };
  const back = { id: 'back', text: 'Return the relic', state: 'open' };
  assert.equal(currentObjective({ objectives: [lich, back] }), 'Return the relic', 'the needed one first');
  assert.equal(currentObjective({ objectives: [lich, { ...back, state: 'done' }] }), 'Destroy the lich', 'an optional one while nothing needed is open');
  assert.equal(currentObjective({ objectives: [{ ...lich, state: 'done' }, { ...back, state: 'hidden' }] }), null);
  // the herald: an objective done, and the script's entry a look later while the notice still stands
  const tokens = (s) => () => [{ text: s, formatting: 'text' }];
  let messages = [{ id: 1010, getTextTokens: tokens('A beast is loose.'), parentQuest: null }];
  let steps = [{ stepID: 0, messageID: 1010, time: 1 }];
  let ql = { tier: 1, objectives: [{ id: 'slay', text: 'Kill the beast', state: 'open' }], choices: [], outcome: null };
  const lens = new QuestLens({ questLog: () => ({ active: [{ id: '7', name: 'Wild Animal', questName: 'M0B00Y06', messages, steps, clocks: [], ql }], ended: [] }) });
  lens.look();
  const herald = new QuestHerald();
  ql = { ...ql, objectives: [{ id: 'slay', text: 'Kill the beast', state: 'done' }] };
  herald.hear(lens.look());
  messages = [...messages, { id: 1011, getTextTokens: tokens('Come back for your pay.'), parentQuest: null }];
  steps = [...steps, { stepID: 1, messageID: 1011, time: 2 }];
  const later = lens.look();
  assert.deepEqual(later.events.map((e) => e.type), ['updated'], 'the entry, a look later');
  herald.hear(later);
  assert.deepEqual([herald.rows[0].type, herald.rows[0].line], ['objective', 'Kill the beast'], 'the notice keeps its words');
});

test('AUDIT QUESTLINES DOC-20, DOC-21: the card never names a failed objective as the one to do; a quest that comes back to the lens with objectives done is no news; a named piece\'s card says it is the quest\'s own (mutants: Q2 a failed objective current; Q1 `was &&` dropped; J1 the named label)', async () => {
  const { QuestLens, currentObjective } = await import('../../../src/ui/quest/questLens.js');
  assert.equal(currentObjective({ objectives: [{ id: 'a', text: 'Keep him alive', state: 'failed' }, { id: 'b', text: 'Report back', state: 'open' }] }), 'Report back');
  // a quest the lens knows, its objective done and told; then a look without its entries (a `remove log step` took them),
  // and back: the objective told already is no news again
  const tokens = () => [{ text: 'A beast.', formatting: 'text' }];
  const messages = [{ id: 1010, getTextTokens: tokens, parentQuest: null }];
  let steps = [{ stepID: 0, messageID: 1010, time: 1 }];
  let state = 'open';
  const lens = new QuestLens({ questLog: () => ({ active: [{ id: '9', name: 'Wild Animal', questName: 'M0B00Y06', messages: steps.length ? messages : [], steps, clocks: [],
    ql: { tier: 1, objectives: [{ id: 'slay', text: 'Kill the beast', state }], choices: [], outcome: null } }], ended: [] }) });
  lens.look();
  state = 'done';
  assert.deepEqual(lens.look().events.map((e) => e.type), ['objective'], 'told once');
  steps = [];
  lens.look();
  steps = [{ stepID: 0, messageID: 1010, time: 1 }];
  assert.ok(!lens.look().events.some((e) => e.type === 'objective'), 'back after a look without entries: not told again');
  const doc = fakePage();
  const box = qlOfferDetail(doc, { id: 3, title: 'The Caged Broker', pieces: [
    { kind: 'weapon', tier: 'rare', named: true, item: { name: "Ysolde's Ember-Rod", affixes: [] } },
    { kind: 'armor', tier: 'rare', item: { name: 'Cuirass', affixes: [] } },
  ] }, () => {});
  const cards = box.querySelectorAll('.px-qpiece');
  assert.equal(text(cards[0].querySelector('.px-qpiece-named')), 'This quest’s own');
  assert.equal(cards[1].querySelector('.px-qpiece-named'), null);
});

// ---- AUDIT QUESTLINES (the UI lane's findings, fixed: FIX-UI) ----

test('AUDIT QUESTLINES UI-4 (REWARD-6): the block promises a choice of gear only on a quest that can pay it - the row\'s `gear` - and the Tutorials\' page promises it only where a quest\'s page does (mutants: the promise on the tier alone)', () => {
  const doc = fakePage();
  const open = { tier: 2, objectives: [{ id: 'summon', text: 'Do the Prince\'s bidding', state: 'open' }], choices: [], outcome: null };
  assert.equal(qlObjectivesBlock(doc, { ...open, gear: false }).querySelector('.px-qobj-reward'), null, 'a quest whose outcomes pay no gear promises none');
  assert.equal(qlObjectivesBlock(doc, open).querySelector('.px-qobj-reward'), null, 'nor one whose row says nothing of it');
  assert.equal(text(qlObjectivesBlock(doc, { ...open, gear: true }).querySelector('.px-qobj-reward')), rewardWords(2));
  const page = tutorialById('questlines');
  assert.doesNotMatch(page.body.join(' '), /A finished quest lets you pick/, 'no promise for every quest');
  assert.match(page.body[1], /^Some quests, once finished, let you pick one of three pieces of gear: the quest.s page says so\./);
});

test('AUDIT QUESTLINES UI-10, UI-11: each Take carries its own key and says when it is armed; a card says what its piece IS - the pack card\'s own numbers, never a second law (mutants: the key dropped; the armed words; the stat line dropped)', () => {
  const doc = fakePage();
  const pieces = rollRewardChoice({ seed: 1234, level: 10, tier: 'magic', entity: null, named: null });
  assert.deepEqual(pieces.map((p) => p.kind), ['weapon', 'armor', 'jewel']);
  const presses = [];
  const box = qlOfferDetail(doc, { id: 5, title: 'Wild Animal', pieces }, (i) => presses.push(i), { armed: 1 });
  const cards = box.querySelectorAll('.px-qpiece');
  const takes = cards.map((c) => c.querySelector('.act'));
  assert.deepEqual(takes.map((b) => b.getAttribute('data-focus')), ['take:5:0', 'take:5:1', 'take:5:2'], 'a redraw finds THIS piece\'s Take by its key');
  assert.deepEqual(takes.map(text), ['Take this', 'Click again to take', 'Take this'], 'the armed one says so');
  takes[2].onclick();
  assert.deepEqual(presses, [2], 'every press is the window\'s to judge (it arms, then takes)');
  // UI-11: the weapon's damage, the armour's rating, each piece's weight - the producers the pack's card reads (itemInfo.js)
  const [w, a, j] = pieces.map((p) => p.item);
  const stat = cards.map((c) => text(c.querySelector('.px-qpiece-stat')));
  assert.ok(stat[0].startsWith(`Damage ${weaponDamageString(w)} · `) && stat[0].endsWith(` · ${weightString(w)} kg`), stat[0]);
  assert.match(stat[0], / · (One|Two)-handed · /, 'and how it is held');
  assert.equal(stat[1], `Armor ${armourModString(a)} · ${weightString(a)} kg`);   // PIN MOVED (AUDIT QUESTLINES VOICE-QL): Armor (Voice.md rule 8)
  assert.equal(stat[2], `${weightString(j)} kg`);
  assert.equal(pieceStatWords({ name: 'a test piece', affixes: [] }), '', 'no template, nothing to read');
  assert.equal(qlOfferDetail(doc, { id: 6, title: 'X', pieces: [{ kind: 'jewel', tier: 'magic', item: { name: 'Ring', affixes: [] } }] }, () => {}).querySelector('.px-qpiece-stat'), null);
});

test('AUDIT QUESTLINES UI-12: a ladder says once, on its page, what its "a choice" mark means - where one stands, never on a hover alone (mutants: the paragraph dropped)', () => {
  const doc = fakePage();
  const rung = (flagship) => ({ rank: 0, title: 'Initiate', reached: true, quests: [{ name: 'M0B00Y16', title: 'Mountain Giant', done: false, flagship }] });
  const marked = qlLadderDetail(doc, { name: 'The Fighters Guild', rankTitle: 'Initiate', rungs: [rung(true)] });
  assert.match(text(marked), /A quest marked “a choice” asks you to choose, and ends differently for each choice\./);
  assert.equal(marked.querySelector('.px-qobj-tag').title, '', 'the page says it; the tag is only the mark');
  const plain = qlLadderDetail(doc, { name: 'The Fighters Guild', rankTitle: 'Initiate', rungs: [rung(false)] });
  assert.doesNotMatch(text(plain), /asks you to choose/, 'no mark, nothing to explain');
  assert.match(text(plain), /^A guild.s own quests, by the rank that opens them\. Each rank is a promotion\./);
});

test('AUDIT QUESTLINES UI-19: a claim the service refuses - its switch shut, a claim its law refuses - is the step\'s to say, in the service\'s own words, while it waits; gone once answered (mutants: the refusal unkept; the line\'s page silent)', async () => {
  setPref(QUESTLINES_PREF, true);
  let answer = { ok: false, error: 'ql-closed', status: 403 };
  const quests = new Map();
  let uid = 1;
  const machine = { quests, questsToInvoke: [], scheduleQuestByName(name) { const q = { uid: uid++, questName: name, questComplete: false, questTombstoned: false }; quests.set(q.uid, q); return q; } };
  const clock = { ms: 0 };
  const runner = createLineRunner({ machine, nowMs: () => clock.ms, service: { account: () => 'acct', guest: () => false, claim: async () => answer }, ctx: { level: () => 30, online: () => true, nowSeconds: () => 1000 } });
  const settle = () => new Promise((r) => setImmediate(r));
  runner.takeLine('burningDoors');   // PIN MOVED (QL-OFFERED): taken - its opening the take's claim
  runner.look(); await settle();
  const bd = () => runner.rows().find((l) => l.id === 'burningDoors');
  assert.equal(bd().steps[0].refused, 'ql-closed', 'the opening the service shut its door on');
  assert.ok(bd().steps.slice(1).every((s) => s.refused === null), 'the steps no claim was asked for say nothing');
  const page = qlLineDetail(fakePage(), bd());
  // PIN MOVED (AUDIT QUESTLINES VOICE-QL): "are not", the voice's plain word (Voice.md)
  assert.match(text(page), /The questlines' rewards are not available to you right now\./, 'net/accountClient.js account.refusal.qlClosed, drawn');
  answer = { ok: false, error: 'ql-body', status: 400 };
  clock.ms += 60_000; runner.look(); await settle();
  assert.match(text(qlLineDetail(fakePage(), bd())), /That questline step could not be claimed\./, 'account.refusal.qlBody');
  answer = { ok: true, data: { opened: true } };
  clock.ms += 60_000; runner.look(); await settle();
  assert.equal(bd().steps[0].refused, null, 'answered: nothing refused to say');
  assert.equal(qlLineDetail(fakePage(), bd()).querySelectorAll('.px-qline-said.failed').length, 0);
});

test('AUDIT QUESTLINES UI-5: a stamped quest\'s outcome is the filed entry\'s side record - DFU\'s classic logbook draws the entry as DFU filed it, no line of it; it survives the notebook\'s save and restore (mutants: the outcome filed as a token; the save drops it; the restore drops it)', () => {
  const nb = new PlayerNotebook({ midDateTimeString: () => 'noon on Sundas', nowMinutes: () => 600 });
  const quest = { uid: 4, displayName: 'Hunt for a Gargoyle', questSuccess: true, questName: 'M0B50Y09' };
  nb.addFinishedQuest([{ parentQuest: quest, getTextTokens: () => [{ formatting: 'text', text: 'The Fighters Guild charged me with the duty.' }] }]);
  assert.equal(nb.fileFinishedOutcome('The gargoyle is rubble and the fee is paid.'), true);
  const classic = new QuestJournalWindow({ questMessages: () => [], notebook: () => nb, mode: 'finishedQuests' });
  const drawn = classic.entries().flat().map((tok) => tok.text).join(' ');
  assert.match(drawn, /Hunt for a Gargoyle completed at noon on Sundas:.*The Fighters Guild charged me with the duty\./);
  assert.doesNotMatch(drawn, /Outcome|gargoyle is rubble/, 'the classic logbook is DFU\'s verbatim');
  assert.equal(filedOutcome(nb.getFinishedQuests()[0]), 'The gargoyle is rubble and the fee is paid.', 'the enhanced archive\'s to draw');
  const data = JSON.parse(JSON.stringify(nb.getSaveData()));
  assert.ok(!JSON.stringify(data.finishedQuestEntries).includes('rubble'), 'DFU\'s line lists carry none of it');
  assert.deepEqual(data.finishedQuestOutcomes, ['The gargoyle is rubble and the fee is paid.']);
  const back = new PlayerNotebook();
  back.restoreSaveData(data);
  assert.equal(filedOutcome(back.getFinishedQuests()[0]), 'The gargoyle is rubble and the fee is paid.', 'through a save');
  assert.doesNotMatch(back.getFinishedQuests()[0].map((tok) => tok.text).join(' '), /rubble/);
  // a quest with no outcome, and an older save: nothing written, nothing read
  const plain = new PlayerNotebook();
  plain.addFinishedQuest([{ parentQuest: { uid: 5, displayName: 'Rat Problem', questSuccess: true }, getTextTokens: () => [{ formatting: 'text', text: 'Rats.' }] }]);
  assert.equal(plain.getSaveData().finishedQuestOutcomes, undefined);
  assert.equal(filedOutcome(plain.getFinishedQuests()[0]), null);
  assert.equal(new PlayerNotebook().fileFinishedOutcome('nothing filed'), false);
});

test('AUDIT QUESTLINES UI-13: the Tutorials\' Questlines page pops at the first quest with objectives the player TAKES - never at the quests a new character is started on (mutants: the game-start skip dropped)', () => {
  setPref(QUESTLINES_PREF, true);
  forgetTutorialsSeen();
  _resetTutorialTriggerForTests();
  const popped = [];
  setTutorialHandler((id) => { popped.push(id); markTutorialSeen(id); return true; });
  try {
    const layer = createQuestlines({ machine: { quests: new Map() } });
    assert.deepEqual(GAME_START_QUESTS, ['S0000977', '_BRISIEN'], 'the bridge\'s list - the layer skips these two');
    for (const questName of GAME_START_QUESTS) layer.stamp({ questName });   // what initAtGameStart's two starts ask
    assert.deepEqual(popped, [], 'nothing at character creation');
    layer.stamp({ questName: 'M0B00Y06' });
    assert.deepEqual(popped, ['questlines'], 'the first quest taken');
  } finally { _resetTutorialTriggerForTests(); forgetTutorialsSeen(); }
});

test('AUDIT QUESTLINES UI-6 (REWARD-8): the HUD\'s line for a reward waiting names the way to it on the skin worn - never a journal tab the classic logbook lacks (mutants: one line for both skins)', () => {
  try {
    setPref('skin', 'enhanced');
    assert.equal(offerWaitingWords({ title: 'Wild Animal' }), 'A reward waits for Wild Animal: choose it under Quests in the pause menu.');
    setPref('skin', 'classic');
    assert.equal(offerWaitingWords({ title: 'Wild Animal' }), 'A reward waits for Wild Animal: in the pause menu, press Controls, then Escape, and choose it under Quests.');
  } finally { setPref('skin', 'enhanced'); }
});

test('AUDIT QUESTLINES UI-5, UI-6: through the real bridge - M0B50Y09 run to its end with the switch on: DFU\'s classic logbook files the entry as DFU does, the outcome its side record; the HUD\'s line names the way to the reward on the skin worn (mutants: the bridge files no outcome; the bridge\'s old line)', () => {
  loadTables();
  setPref(QUESTLINES_PREF, true);
  for (const skin of ['enhanced', 'classic']) {
    setPref('skin', skin);
    const hud = [];
    const bridge = createQuestBridge({
      data: {
        readListTable: (name) => { try { return readFileSync(join(ROOT, 'vendor/dfu-quests/Tables', `QuestList-${name}.txt`), 'utf8'); } catch { return null; } },
        getQuestSourceLines: (n) => questSource(n, questlinesOn()),
      },
      classicSeconds: () => 0,
      playerEntity: { name: 'Hero', level: 12, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30) },
      showChoice: (q, m, choices, respond) => respond(0),
      addHUDText: (line) => hud.push(line),
      offerReward: () => {}, showPopup: () => {},
    });
    const quiet = console.warn, info = console.info, log = console.log;
    console.warn = () => {}; console.info = () => {}; console.log = () => {};
    try {
      const quest = bridge.machine.startQuestByName('M0B50Y09', 41);
      for (const task of quest.tasks.values()) for (const a of task.actions) if (a.typeName === 'PlaceFoe') a.isComplete = true;
      quest.getTask({ name: 'S.01' }).start();
      quest.getTask({ name: 'qgclicked' }).start();
      for (let i = 0; i < 5; i++) bridge.machine.tick();
      quest.getClock({ name: 'end' })?.endTimer?.();
      quest.getTask({ name: 'end' })?.start();
      for (let i = 0; i < 6; i++) bridge.machine.tick();
    } finally { console.warn = quiet; console.info = info; console.log = log; }
    const classic = new QuestJournalWindow({ questMessages: () => [], notebook: () => bridge.notebook, mode: 'finishedQuests' });
    const drawn = classic.entries().flat().map((tok) => tok.text).join(' ');
    assert.match(drawn, /Hunt for a Gargoyle completed/);
    assert.doesNotMatch(drawn, /Outcome|rubble/, `${skin}: DFU's logbook, verbatim`);
    assert.equal(filedOutcome(bridge.notebook.getFinishedQuests().at(-1)), 'The gargoyle is rubble and the fee is paid.');
    const offerLine = hud.find((l) => l.startsWith('A reward waits for Hunt for a Gargoyle'));
    assert.equal(offerLine, offerWaitingWords({ title: 'Hunt for a Gargoyle' }), `${skin}: the skin's own words`);
    assert.doesNotMatch(offerLine, /journal.s Quests tab/);
  }
  setPref('skin', 'enhanced');
});
