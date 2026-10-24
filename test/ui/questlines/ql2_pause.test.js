// AUDIT QUESTLINES UI-9 (bible/06-Systems/Questlines-Arc.md section 6): THE QUESTS TAB, DRAWN. The window's questline
// parts are pinned one by one (ql2_journal.test.js), and nothing drew the pause window's Quests tab with them wired in
// (ui/enhanced/enhancedMenu.js pauseQuests): the rewards waiting above the quests, a stamped quest with no journal entry
// yet as a row (unloggedRail), the Questlines and their pages, the Take that hands a piece over, the archive's outcome.
// The UI lane's three probes survived every suite; here they die. Mounted on the minimal DOM the house's pause-tab pins
// mount on (test/chargenDom.mjs - the menu needs a document, which test/hudPage.mjs's fakePage is not), and the
// pause door's Quests landing on the classic skin (ui/pauseDoor.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Node_ } from '../../chargenDom.mjs';   // the minimal DOM - globals (the pause window mounts on it)
import { setPref } from '../../../src/systems/uiPrefs.js';
import { TRACKER_PREF, _resetQuestTrackerForTests } from '../../../src/ui/quest/questTracker.js';
import { mountEnhancedMenu } from '../../../src/ui/enhanced/enhancedMenu.js';
import { chronicleModel } from '../../../src/ui/enhanced/enhancedChronicle.js';
import { openPauseFlow } from '../../../src/ui/pauseDoor.js';
import { PlayerNotebook } from '../../../src/systems/notebook.js';
import { rollRewardChoice } from '../../../src/systems/questlines/qlRewards.js';

// NO LIVE TIMER RUNS HERE (GUIDE2's law, guide4_tracker.test.js): the tab's intervals are recorded, never run
const intervals = new Map();
let nextInterval = 1;
globalThis.setInterval = (fn, ms) => { const id = nextInterval++; intervals.set(id, { fn, ms }); return id; };
globalThis.clearInterval = (id) => { intervals.delete(id); };

/** Every node under `root`, depth first. */
const all = (root) => root.querySelectorAll('*');
const byText = (root, tag, words) => all(root).filter((n) => n.tagName === tag && n.textContent.includes(words));
const rowNamed = (host, words) => byText(host, 'BUTTON', words).find((b) => String(b.className).includes('px-qrow'));
const detailOf = (host) => host.querySelectorAll('.px-qdetail')[0];
const cardsOf = (host) => host.querySelectorAll('.px-qpiece');
const takeOf = (card) => card.querySelectorAll('.act')[0];

const ql = (objectives, extra = {}) => ({ tier: 2, gear: true, family: 'FightersGuild', objectives, choices: [], outcome: null, ...extra });
const message = (text) => ({ id: 1, getTextTokens: () => [{ formatting: 'text', text }], parentQuest: null });

/** A host's walk and its tidy-ups: two rewards waiting, a quest with an entry, a stamped one with none yet, a line, and
 *  an archived quest whose outcome was filed. */
function journal() {
  const notebook = new PlayerNotebook({ midDateTimeString: () => 'noon on Sundas' });
  notebook.addFinishedQuest([{ parentQuest: { uid: 30, displayName: 'Hunt for a Gargoyle', questSuccess: true }, getTextTokens: () => [{ formatting: 'text', text: 'The guild charged me with the duty.' }] }]);
  notebook.fileFinishedOutcome('The gargoyle is rubble and the fee is paid.');
  const offers = [
    { id: 7, questName: 'M0B00Y06', title: 'Wild Animal', outcome: 'done', tier: 'magic', pieces: rollRewardChoice({ seed: 1234, level: 10, tier: 'magic', entity: null, named: null }) },
    { id: 8, questName: 'M0B00Y16', title: 'Mountain Giant', outcome: 'done', tier: 'magic', pieces: rollRewardChoice({ seed: 99, level: 10, tier: 'magic', entity: null, named: null }) },
  ];
  const log = {
    active: [{ id: '4', name: 'Rat Problem', questName: 'M0B00Y01', clockSeconds: null, clocks: [], messages: [message('Rats in the cellar.')], steps: [{ stepID: 0, messageID: 1, time: 1 }], ql: ql([{ id: 'rats', text: 'Kill the rats', state: 'open' }]) }],
    unlogged: [{ id: '20', name: 'A Silent Summons', questName: 'M0B10Y02', ql: ql([{ id: 'read', text: 'Read the letter the courier brought', state: 'open' }]) }],
    shelved: [], hidden: [],
    finished: notebook.getFinishedQuests(),
    lines: [{ id: 'introTables', group: 'intro', title: 'A Seat at the Table', lead: 'A card player wants a partner.', giver: 'Tavern keeper', state: 'running', opens: null, outcome: null, honour: null,
      steps: [{ quest: 'QLIT01', title: 'The First Hand', state: 'current', witnessed: false, outcome: null }, { quest: 'QLIT02', title: 'The Long Game', state: 'next', witnessed: false, outcome: null }] }],
    ladders: [],
  };
  const taken = [], said = [];
  const clean = {
    offers: () => offers.map((o) => ({ ...o })),
    takeOffer: (id, index) => { taken.push([id, index]); offers.splice(offers.findIndex((o) => o.id === id), 1); return {}; },
    hide: (id) => { said.push(['hide', id]); log.hidden.push(String(id)); return true; },
    unhide: () => true,
    abandon: (id) => { said.push(['abandon', id]); return { ok: true, text: 'Abandoned.' }; },
    canAbandon: () => true,
    restart: (id) => ({ ok: true, uid: id, text: 'Restarted.' }),
    canRestart: () => true,
    removeFinished: () => true, clearFinished: () => 0,
  };
  return { log, clean, taken, said };
}

/** The pause window on its Quests tab over the journal `j`, in the document as the pause door mounts it - put away after
 *  `fn` (and after its promise, for a pin that waits). */
async function withTab(j, fn) {
  setPref(TRACKER_PREF, true);
  _resetQuestTrackerForTests();
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: { questLog: () => j.log, journalClean: () => j.clean }, onAction: () => {}, at: 'quests' });
  try { return await fn(host); } finally { menu.unmount(); host.remove(); _resetQuestTrackerForTests(); }
}

test('AUDIT QUESTLINES UI-9: the Quests tab draws its new wiring - the rewards waiting first, a stamped quest with no entry yet a row of its own with its objectives, the Questlines and a line\'s page (mutants: no Questlines section; the unlogged rows left out)', async () => {
  const j = journal();
  await withTab(j, (host) => {
    const heads = host.querySelectorAll('.px-qarch').map((n) => n.textContent);
    assert.deepEqual(heads, ['Rewards waiting', 'Main Quests', 'Side Quests', 'Questlines', 'Archived'], 'the rail\'s sections, in the record\'s order');
    assert.ok(rowNamed(host, 'Reward: Wild Animal') && rowNamed(host, 'Reward: Mountain Giant'), 'a row for each reward waiting');
    assert.ok(String(rowNamed(host, 'Reward: Wild Animal').className).includes(' on'), 'the tab opens on the first thing it has to ask');
    // the stamped quest with no journal entry yet: a row, its page its objectives
    const silent = rowNamed(host, 'A Silent Summons');
    assert.ok(silent, 'unloggedRail\'s row is the rail\'s');
    silent.click();
    assert.match(detailOf(host).textContent, /What to do.*Read the letter the courier brought/);
    // the questlines
    const lineRows = host.querySelectorAll('.px-qlinerow');
    assert.deepEqual(lineRows.map((b) => b.textContent.replace(/^\W+/, '')), ['A Seat at the Table']);
    assert.equal(lineRows[0].title, 'Under way');
    lineRows[0].click();
    assert.match(detailOf(host).textContent, /A questline is a story told in several quests.*A card player wants a partner\..*Given by Tavern keeper.*The First Hand.*now.*The Long Game/);
  });
});

test('AUDIT QUESTLINES UI-9, UI-10: a Take ARMS on its first press - its words say so and the focus stays on it - and hands over THAT piece on the second; the next reward\'s Take is never the one pressed (mutants: the piece pressed taken as the first; one press takes; the Take\'s key dropped)', async () => {
  const j = journal();
  await withTab(j, (host) => {
    let cards = cardsOf(host);
    assert.equal(cards.length, 3, 'the first reward\'s three pieces');
    const second = takeOf(cards[1]);
    second.focus();
    second.click();
    assert.deepEqual(j.taken, [], 'the first press arms - nothing taken');
    cards = cardsOf(host);
    assert.equal(takeOf(cards[1]).textContent, 'Click again to take');
    assert.deepEqual(cards.map((c) => takeOf(c).textContent), ['Take this', 'Click again to take', 'Take this'], 'only the piece pressed is armed');
    assert.equal(globalThis.document.activeElement, takeOf(cards[1]), 'the focus stays on the armed Take (its key), not the first "Take this"');
    takeOf(cards[1]).click();
    assert.deepEqual(j.taken, [[7, 1]], 'the second press takes the piece pressed - the second, not the first');
    // the next reward stands where the first stood: a stray press there arms, never takes
    cards = cardsOf(host);
    assert.ok(byText(detailOf(host), 'H3', 'Mountain Giant').length, 'the next reward is up');
    assert.notEqual(globalThis.document.activeElement, takeOf(cards[1]), 'the focus did not land on the next reward\'s Take');
    takeOf(cards[1]).click();
    assert.deepEqual(j.taken, [[7, 1]], 'a press on a reward never looked at arms it, nothing more');
  });
});

test('AUDIT QUESTLINES UI-8: a stamped quest with no journal entry yet offers no Track, no Hide and no Abandon - the HUD\'s card reads entries, the rail hides by entries, and a quest set aside before its first entry was no row to reclaim; a quest with an entry offers all three (mutants: Track, Hide, Abandon on an entryless row)', async () => {
  const j = journal();
  await withTab(j, (host) => {
    const presses = () => all(detailOf(host)).filter((n) => n.tagName === 'BUTTON').map((b) => b.textContent);
    rowNamed(host, 'Rat Problem').click();
    const logged = presses();
    assert.ok(logged.some((w) => /Track/.test(w)), `a quest with an entry: Track (${logged})`);
    assert.ok(logged.includes('Hide from journal') && logged.includes('Abandon quest'), String(logged));
    rowNamed(host, 'A Silent Summons').click();
    const silent = presses();
    assert.ok(!silent.some((w) => /Track/.test(w)), `no Track on a row the lens never sees (${silent})`);
    assert.ok(!silent.includes('Hide from journal'), 'no Hide the rail would ignore');
    assert.ok(!silent.includes('Abandon quest'), 'no Abandon whose Reclaim no row could offer');
    assert.ok(silent.includes('Restart quest'), 'a restart is the quest again, a row again');
  });
});

test('AUDIT QUESTLINES UI-5: the enhanced archive draws an archived quest\'s outcome - the filed entry\'s side record - under its record: the pause tab\'s Archived, and the chronicle the L key opens (mutants: the pause archive\'s outcome dropped; the chronicle\'s)', async () => {
  const j = journal();
  await withTab(j, (host) => {
    rowNamed(host, 'Hunt for a Gargoyle').click();
    const desc = detailOf(host).textContent;
    assert.match(desc, /The guild charged me with the duty\..*Outcome: The gargoyle is rubble and the fee is paid\./);
  });
  const filed = chronicleModel({ questLog: () => j.log }).quests.find((q) => q.head.startsWith('Hunt for a Gargoyle'));
  assert.deepEqual(filed.body.slice(-1), ['Outcome: The gargoyle is rubble and the fee is paid.'], 'the chronicle\'s archive, the same record');
});

test('AUDIT QUESTLINES UI-14: on a phone a row pressed brings its page into view, once the repaint has put the scroll back - and only on the press (mutants: the reveal dropped)', async () => {
  const j = journal();
  const scrolled = [];
  Node_.prototype.scrollIntoView = function (o) { scrolled.push([this.className, o]); };
  try {
    await withTab(j, async (host) => {
      await Promise.resolve();
      assert.deepEqual(scrolled, [], 'opening the tab scrolls nothing');
      rowNamed(host, 'A Silent Summons').click();
      assert.deepEqual(scrolled, [], 'not inside the repaint (the scroll kept would undo it)');
      await Promise.resolve();
      assert.deepEqual(scrolled, [['px-qdetail', { block: 'start' }]], 'the page pressed for, brought into view');
    });
  } finally { delete Node_.prototype.scrollIntoView; }
});

test('AUDIT QUESTLINES UI-6 (REWARD-8): the pause door\'s Quests landing opens the enhanced pause on the classic skin too - the classic pause has no tabs (mutants: the landing left to the classic window)', () => {
  setPref('skin', 'classic');
  let shown = null;
  try {
    const overlay = openPauseFlow((w) => { shown = w; }, { at: 'quests', questLog: () => ({ active: [], finished: [] }) });
    assert.equal(shown, overlay);
    assert.ok(globalThis.document.body.children.some((n) => n.id === 'enhanced-pause'), 'the enhanced pause, on its Quests tab');
    overlay.dispose();
    assert.ok(!globalThis.document.body.children.some((n) => n.id === 'enhanced-pause'));
  } finally { setPref('skin', 'enhanced'); }
});
