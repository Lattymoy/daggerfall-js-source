// FIELD BUGS 2026-09-30 (CHOP-WAIT) - "Hardlocked in woodcutting animation after game Crash": "Was choppin wood for money
// and some quests when the game crashed and now im stuck in an endless loop of logging in, been stuck on the treecutting
// animation and it locks up all my controls til it crashes again."
//
// Online the Wood-Axe's ChopWoodQuest raises time by 1:30, which is Foraging's wait page ("Chop and Gather Wood...", no
// Escape - scenes/foragingWait.js, FORAGE4), and every quest box is held behind it; the held boxes ride the save (AUDIT
// 28 F6). The page's end released them, and a released box is the host's showQuestBox, whose first question is the
// wait's `holds()` - true while any box is still held. With two boxes behind the page (two chops, each quest's find) the
// first went back behind the second and the second behind the first, for ever, in one frame: the tab hung. The save
// kept the record, so every login reopened the page and hung again when it ran out. A box the release shows is shown
// now, and one release runs only the boxes held when it began.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { createForagingWait } from '../../../src/scenes/foragingWait.js';
import { tokensToRows } from '../../../src/scenes/quest/questBridge.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { questActionsExtensionTemplates } from '../../../src/systems/quest/questActionsExtension.js';
import { snapshotPlayer, restorePlayer } from '../../../src/systems/save/save.js';
import { FATIGUE_MULTIPLIER } from '../../../src/systems/statMods.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const W = rd('src/scenes/world.js');
/** One of the streaming host's own statements, lifted off world.js by the regex that finds it. */
const lifted = (re, what) => { const m = re.exec(W); assert.ok(m, `world.js no longer has ${what}`); return m[1]; };
const SHOW = lifted(/\n {2}(const showQuestBox = \(box\) => \{\n[\s\S]*?\n {2}\};)\n/, 'showQuestBox');
const KEPT = lifted(/\n {2}(const keptBox = \(box\) => \{\n[\s\S]*?\n {2}\};)\n/, 'keptBox');
const LIVE = lifted(/\n {2}(const _liveQuestOverlay = \(win\) =>\n[^\n]*;)\n/, '_liveQuestOverlay');
const REVIVE = lifted(/\n {4}revive: (\(keep\) => \{[^\n]*\}),\n/, 'the wait\'s revive');

/** Past this many asks of the wait the host's `holds()` throws: the old release asked for ever, and a pin must end. */
const ASKS_MAX = 1000;

/** The host's slot as townTalk keeps it: a window that ends stays in the slot until the next frame drains it. */
function slot() {
  const s = { win: null };
  s.show = (w) => { const out = s.win; s.win = w; if (out && out !== w && !out.done) out.dispose?.(); };
  s.active = () => !!s.win;
  s.drain = () => { if (s.win?.done) s.win = null; };
  return s;
}

/** The streaming host's quest-box half over one player: the real wait, and world.js's own showQuestBox, keptBox,
 *  _liveQuestOverlay and the wait's revive; a mounted box is recorded by its find's line and takes the slot. */
function host(entity) {
  const s = slot();
  const shown = [];
  let asks = 0;
  class ServiceFlowWindow {
    constructor(boxes, o) { this.boxes = boxes; this.o = o; this.done = false; }
    push(boxes) { this.boxes.unshift(...boxes); }
    close() { this.done = true; this.o.onClose?.(); }
  }
  const h = {};
  const wait = createForagingWait({ entity, showOverlay: s.show, overlayActive: s.active, online: () => true, revive: (keep) => h.revive(keep) });
  const foragingWait = {
    holds: () => { if (++asks > ASKS_MAX) throw new Error('showQuestBox asked the wait past the pin\'s ceiling: the release does not end'); return wait.holds(); },
    hold: (fn, keep) => wait.hold(fn, keep),
  };
  const mountWindow = (win) => { shown.push(win.boxes[0].rows[1]); s.show(win); };
  // eslint-disable-next-line no-new-func
  const make = new Function('foragingWait', 'ServiceFlowWindow', 'mountWindow', 'modes', 'townTalk', 'giveReward',
    `let _questBoxWin = null;\nlet _onQuestBoxClosed = null;\nconst QUEST_BOX_GRACE_MS = 600;   // QUEST-NOTE: the box's grace, world.js's own\n${KEPT}\n${SHOW}\n${LIVE}\nreturn { showQuestBox, revive: ${REVIVE} };`);
  Object.assign(h, make(foragingWait, ServiceFlowWindow, mountWindow, null, { get overlay() { return s.win; } }, () => {}));
  /** The slot's box read and closed, and the next frame. */
  const read = () => { s.win?.close?.(); s.drain(); wait.tick(); };
  return { s, wait, h, shown, read, get asks() { return asks; } };
}

const T = new URL('../../../vendor/dfu-quests/Tables/', import.meta.url);
loadQuestTables(Object.fromEntries(readdirSync(T).map((f) => [f.replace(/\.txt$/, ''), readFileSync(new URL(f, T), 'utf8')])));
const CHOP = rd('vendor/foraging/Quests/ChopWoodQuest.txt').split(/\r?\n/);
const chopper = () => ({
  name: 'Tester', gender: 'male', level: 5, careerIndex: 0, health: 50, maxHealth: 100, magicka: 10, maxMagicka: 50,
  fatigue: 105 * FATIGUE_MULTIPLIER, stats: { intelligence: 62, strength: 55, agility: 50, endurance: 50, luck: 45, willpower: 50, personality: 50, speed: 50 },
  skills: [], skillUses: [], career: {}, items: [], wagonItems: [], spells: [], activeEffects: [], foragingWait: null,
});
/** The real quest machine over the host - the find's line through the host's own popup door (tokensToRows, showQuestBox). */
function machine(entity, H) {
  const m = new QuestMachine({
    nowSeconds: () => 1000000, sharedClock: () => true, playerEntity: entity, raiseTime: () => {}, waitOnline: (sec, q) => H.wait.add(sec, q?.displayName ?? null),
    getQuestSourceLines: () => null, giveItemToPlayer: () => {}, addGold: () => {}, addHUDText: () => {},
    showPopup: (_q, tokens) => { const rows = tokensToRows(tokens); if (rows.length) H.h.showQuestBox({ rows }); },
    releaseQuestItem: () => {}, makeHeldQuestItemsPermanent: () => {}, getGuild: () => null, regionPriceAdjustment: () => 0,
  });
  for (const a of questActionsExtensionTemplates()) m.registerAction(a);
  return m;
}
/** A Wood-Axe use per roll, run through: 0.99 finds an Ichor, 0.85 a Map (Luck 45, the quest's even chance). */
function chop(m, rolls) {
  const ow = console.warn, ol = console.log; console.warn = () => {}; console.log = () => {};
  try {
    for (const r of rolls) m.scheduleQuest(CHOP, 0, { rolls: () => r });
    for (let i = 0; i < 8; i++) m.tick();
  } finally { console.warn = ow; console.log = ol; }
}
const find = (what) => ({ box: { rows: ['While chopping and gathering wood,', `you chanced upon a ${what}`, 'that someone must have lost or discarded.'] } });
const line = (what) => `you chanced upon a ${what}`;
/** The character through the save and back, as a checkpoint and a login carry it (systems/save/save.js ENTITY_FIELDS). */
function relog(entity) {
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(entity, { position: [0, 0, 0], classicMinutes: 0, locationKey: 'world' })));
  const loaded = chopper();
  restorePlayer(loaded, snap, new Map());
  return loaded;
}

test('CHOP-WAIT: two chops\' finds behind the page - the page\'s end shows each once, in order, one to the slot, and the record clears; the next chop holds its box again (mutants: a shown box held again; the release never marked; nothing held after the first release)', () => {
  const warned = [];
  const warn = mock.method(console, 'warn', (...a) => { warned.push(a.map(String).join(' ')); });
  try {
    const e = chopper();
    const H = host(e);
    const m = machine(e, H);
    chop(m, [0.99, 0.85]);   // two Wood-Axe uses behind the pack
    assert.deepEqual(e.foragingWait, { seconds: 24, label: 'Chop and Gather Wood', held: [find('Ichor'), find('Map')] }, 'the premise: both finds held behind one 24-second page');
    const page = H.wait.tick();
    assert.equal(page.busy, 'Chop and Gather Wood...');
    page.tick(24);
    H.wait.tick();
    assert.deepEqual(H.shown, [], 'the finished page still holds the slot this frame (AUDIT 28 H6)');
    H.s.drain();
    H.wait.tick();   // the frame that hung the tab
    assert.deepEqual(H.shown, [line('Ichor')], 'the first find, shown - the second waits for the slot');
    assert.deepEqual(e.foragingWait, { seconds: 0, label: 'Chop and Gather Wood', held: [find('Map')] }, 'the record keeps what is still to be read');
    H.read();
    assert.deepEqual(H.shown, [line('Ichor'), line('Map')], 'then the second, once');
    assert.equal(e.foragingWait, null, 'the record is gone with them');
    H.read();
    assert.deepEqual(H.shown, [line('Ichor'), line('Map')], 'nothing twice');
    assert.equal(H.wait.holds(), false);
    assert.ok(H.asks < 10, `showQuestBox asked the wait ${H.asks} times`);
    chop(m, [0.99]);
    assert.equal(H.wait.holds(), true, 'a third chop is a wait again');
    assert.deepEqual(H.shown, [line('Ichor'), line('Map')], 'its find held behind its page, not over it');
    assert.deepEqual(e.foragingWait, { seconds: 12, label: 'Chop and Gather Wood', held: [find('Ichor')] });
    assert.deepEqual(warned, [], 'no box threw');
  } finally { warn.mock.restore(); }
});

test('CHOP-WAIT: the stuck save logs in - the page reopens with what was left, and its end shows each find once, in order; a save made after the first was read gives the second alone, at once (mutants: a shown box held again; the release never marked)', () => {
  const warned = [];
  const warn = mock.method(console, 'warn', (...a) => { warned.push(a.map(String).join(' ')); });
  try {
    const before = chopper();
    chop(machine(before, host(before)), [0.99, 0.85]);
    const e = relog(before);   // the checkpoint mid-wait, and the login
    assert.deepEqual(e.foragingWait, { seconds: 24, label: 'Chop and Gather Wood', held: [find('Ichor'), find('Map')] }, 'the premise: the save carries the page and both finds');
    const H = host(e);
    const page = H.wait.tick();
    assert.equal(page.remaining, 24, 'the page reopens');
    page.tick(24);
    H.s.drain();
    H.wait.tick();
    assert.deepEqual(H.shown, [line('Ichor')], 'the login no longer hangs where the page ends');
    const mid = relog(e);   // a checkpoint with the first find read
    H.read();
    assert.deepEqual(H.shown, [line('Ichor'), line('Map')]);
    assert.equal(e.foragingWait, null);
    assert.deepEqual(mid.foragingWait, { seconds: 0, label: 'Chop and Gather Wood', held: [find('Map')] });
    const H2 = host(mid);
    assert.equal(H2.wait.tick(), null, 'no page - the wait was done');
    assert.deepEqual(H2.shown, [line('Map')], 'the find still to be read, and not the one read before');
    assert.equal(mid.foragingWait, null);
    assert.deepEqual(warned, [], 'no box threw');
  } finally { warn.mock.restore(); }
});

test('CHOP-WAIT: one release runs the boxes held when it began - a box held again while they are shown waits for the next frame (mutants: a release without end)', () => {
  const entity = { foragingWait: null };
  const wait = createForagingWait({ entity, online: () => true });
  let ran = 0;
  const again = () => { ran++; if (ran < 50) wait.hold(again); };
  wait.hold(again);
  wait.tick();
  assert.equal(ran, 1, 'once this frame, not fifty');
  wait.tick();
  assert.equal(ran, 2, 'and once the next');
});
