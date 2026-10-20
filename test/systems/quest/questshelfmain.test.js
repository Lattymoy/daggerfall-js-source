// QUEST-SHELF-MAIN (2026-10-13, Dudey: "an Abandon button for all quests except main quest", then "leave the main quest
// logic untouched") - pinned. The chronicle (the L key) draws QUEST-SHELF's Abandon, twice, on every running quest but the
// main story's - through the pause tab's own door (questBridge.js journalClean), in every host that builds a chronicle.
// The machine's ladder is QUEST-SHELF's, unchanged. Its words are the text core's (L10N4, `chronicle.quests.*`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMainQuestName } from '../../../src/systems/quest/questLists.js';
import { mountEnhancedChronicle } from '../../../src/ui/enhanced/enhancedChronicle.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('QUEST-SHELF-MAIN leaves the ladder as it was: the machine still sets a main-story quest aside (the pause tab\'s door) and refuses only the world\'s own (protected) - the chronicle\'s button alone leaves the main story out', async () => {
  const { QuestMachine } = await import('../../../src/systems/quest/machine.js');
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const q = { uid: 9001, questName: 'S0000101', questComplete: false, questTombstoned: false, ticksToEnd: 0, shelvedAt: null, tasks: new Map() };
  m.quests.set(q.uid, q);
  assert.equal(isMainQuestName('S0000101'), true);
  assert.equal(m.shelveRefusal(q.uid), null, 'a main-story quest is not refused by the machine');
  for (const name of ['S0000999', 'S0000977', '_BRISIEN']) { q.questName = name; assert.equal(m.shelveRefusal(q.uid), 'protected', name); }
  assert.doesNotMatch(src('src/systems/quest/machine.js'), /return 'main'/, 'no main rung');
  assert.doesNotMatch(src('src/scenes/quest/questBridge.js'), /case 'main'/);
});

/** the chronicle over a fake document, journal1.test.js's own rig */
function chronicleRig(deps) {
  const node = (tag) => {
    const n = { tag, children: [], attrs: {}, style: {}, dataset: {}, className: '', textContent: '', listeners: {},
      classList: { add(c) { n.className = `${n.className} ${c}`.trim(); } },
      append(...cs) { for (const c of cs) if (c) n.children.push(c); },
      setAttribute(k, v) { n.attrs[k] = String(v); },
      addEventListener(t, fn) { (n.listeners[t] ??= []).push(fn); }, removeEventListener() {},
      remove() { n.removed = true; },
      querySelectorAll: () => [] };   // FB1018f SPELL-SCROLL: the repaint asks for the scrolled panes first (ui/domRepaint.js) - a fake with no layout has none
    Object.defineProperty(n, 'innerHTML', { set() { n.children = []; }, get() { return ''; } });
    return n;
  };
  const doc = { createElement: node, createTextNode: (t) => ({ textContent: t, children: [] }) };
  doc.head = node('head'); doc.body = node('body');
  doc.getElementById = (id) => doc.head.children.find((c) => c.id === id) ?? null;
  const prev = { document: globalThis.document, window: globalThis.window };
  globalThis.document = doc;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const host = node('div');
  const view = mountEnhancedChronicle(host, deps);
  return { host, restore() { view.destroy(); globalThis.document = prev.document; globalThis.window = prev.window; } };
}
const all = (n, cls, out = []) => { if (`${n.className ?? ''}`.split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) all(c, cls, out); return out; };
const text = (n) => (n.textContent || '') + (n.children ?? []).map(text).join('');

test('QUEST-SHELF-MAIN the chronicle: Abandon on each running quest the bridge allows - never the main story\'s, never where the door says no - pressed twice, through the bridge\'s own door, saying what happened; a host with no door draws none (mutants: the gate, the arming, the door, the words)', () => {
  const log = { active: [
    { id: '5', name: 'The Rat', questName: 'M0B00Y00', clockSeconds: null, messages: [[{ formatting: 'text', text: 'a step' }]] },
    { id: '6', name: 'The Emperor', questName: 'S0000101', clockSeconds: null, messages: [[{ formatting: 'text', text: 'a step' }]] },
    { id: '7', name: 'The Raid', questName: 'R0C10Y01', clockSeconds: null, messages: [[{ formatting: 'text', text: 'a step' }]] },
  ], finished: [] };
  const pressed = [];
  const clean = {
    canAbandon: (id) => id === '5' || id === '6',   // '6' would pass the door: the row's own main flag still keeps it
    abandon: (id) => { pressed.push(id); return { ok: true, text: 'Abandoned: The Rat. Reclaim it from your journal.' }; },
  };
  const rig = chronicleRig({ questLog: () => log, section: 'quests', shelfDoor: () => clean });
  try {
    const abandons = () => all(rig.host, 'cr-share').filter((b) => /Abandon|Click again/.test(text(b)));
    assert.equal(abandons().length, 1, 'one Abandon: the side quest the door allows - not the main story, not the one refused');
    abandons()[0].onclick();
    assert.deepEqual(pressed, [], 'the first press arms');
    assert.equal(text(abandons()[0]), 'Click again');
    abandons()[0].onclick();
    assert.deepEqual(pressed, ['5'], 'the second goes through the bridge\'s door, by the quest\'s id');
    assert.ok(text(rig.host).includes('Abandoned: The Rat. Reclaim it from your journal.'), 'and says what happened');
  } finally { rig.restore(); }
  const bare = chronicleRig({ questLog: () => log, section: 'quests' });
  try {
    assert.equal(all(bare.host, 'cr-share').filter((b) => /Abandon/.test(text(b))).length, 0, 'no door, no button');
  } finally { bare.restore(); }
});

test('QUEST-SHELF-MAIN the chronicle\'s Abandon in the player\'s language (L10N4): its label, its armed label, its title and its two aria-labels are the text core\'s (`chronicle.quests.*`) - in French they read French, read when they are drawn; in English byte for byte as before (mutants: a word left English)', async () => {
  const tm = await import('../../../src/systems/textManager.js');
  const rows = tm.loadStringTableCsv(src('locales/fr/Port_Strings.csv'));
  tm.patchLocaleTable('fr', 'Port_Strings', rows);
  const fr = new Map(rows);
  const log = { active: [{ id: '5', name: 'The Rat', questName: 'M0B00Y00', clockSeconds: null, messages: [[{ formatting: 'text', text: 'a step' }]] }], finished: [] };
  const clean = { canAbandon: () => true, abandon: () => ({ ok: true, text: '' }) };
  /** the one button the rig draws (no bounty, no hunt, no party): [label, title, aria-label], unarmed then armed */
  const words = () => {
    const rig = chronicleRig({ questLog: () => log, section: 'quests', shelfDoor: () => clean });
    try {
      const button = () => { const bs = all(rig.host, 'cr-share'); assert.equal(bs.length, 1, 'the side quest\'s Abandon alone'); return bs[0]; };
      const read = (b) => [text(b), b.title, b.attrs['aria-label']];
      const unarmed = read(button());
      button().onclick();
      return [unarmed, read(button())];
    } finally { rig.restore(); }
  };
  try {
    tm.setLocale('fr');
    const french = words();
    assert.deepEqual(french, [
      [fr.get('chronicle.quests.abandon'), fr.get('chronicle.quests.abandonTitle'), fr.get('chronicle.quests.abandonLabel')],
      [fr.get('chronicle.quests.abandonArmed'), fr.get('chronicle.quests.abandonTitle'), fr.get('chronicle.quests.abandonArmedLabel')],
    ]);
    assert.ok(french.flat().every((w) => w && !/Abandon\b|Click again|Give up/.test(w)), 'no English left in it');
  } finally {
    tm.setLocale('en');
  }
  const title = 'Give up this quest for now. You can reclaim it from the pause menu\'s Quests tab';
  assert.deepEqual(words(), [['Abandon', title, 'Abandon this quest'], ['Click again', title, 'Click again to abandon this quest']], 'English again, byte for byte');
});

test('QUEST-SHELF-MAIN the hosts: every chronicle builder hands the bridge\'s journalClean as its shelfDoor - the streaming world and the fixed town (and the interiors through each), the dungeon (mutants: a host left out, an interiors route gone)', () => {
  assert.match(src('src/scenes/world.js'), /notebook: \(\) => questBridge\?\.notebook \?\? null,\n\s+shelfDoor: \(\) => questBridge\?\.journalClean \?\? null,   \/\/ QUEST-SHELF-MAIN/);
  assert.match(src('src/scenes/exterior.js'), /questLog: \(\) => pauseQuestLog\(\),\n\s+notebook: \(\) => questBridge\.notebook \?\? null,\n\s+shelfDoor: \(\) => questBridge\?\.journalClean \?\? null,   \/\/ QUEST-SHELF-MAIN/);
  assert.match(src('src/scenes/dungeonContext.js'), /questLog: \(\) => opts\.questBridge\.questLog\(\),\n\s+notebook: \(\) => opts\.questBridge\.notebook \?\? null,\n\s+shelfDoor: \(\) => opts\.questBridge\?\.journalClean \?\? null,   \/\/ QUEST-SHELF-MAIN/);
  assert.match(src('src/scenes/world.js'), /makeJournal: \(mode\) => makeJournalWindow\(mode\),/, 'the interiors open the world host\'s');
  assert.match(src('src/scenes/exterior.js'), /makeJournal: \(mode\) => makeJournalWindow\(mode\),/, 'and the town host\'s, in the fixed town');
});
