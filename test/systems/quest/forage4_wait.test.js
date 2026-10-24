// FORAGE4 (2026-09-28, Mac: "Continue! Remember, this is your baby"):
// FORAGING'S ONLINE WAIT - bible/06-Systems/Foraging.md 13.1. Online the
// shared clock is nobody's to move, so Quest Actions Extension's `raise
// time by` is a wait on the wait page (ui/waitWindow.js - C&C's hunt page
// until the text hunt was removed, 2026-10-04; its busy page is what
// stayed), at 8 real seconds a game hour; the page opens when the slot is
// free, holds the quest's boxes behind it, ends early for a foe near with
// the rest forgiven, and rides the save.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { WaitWindow, BUSY_DOTS } from '../../../src/ui/waitWindow.js';
import { createForagingWait, waitLine, saneWait, FORAGING_WAIT_MAX_SECONDS, WAIT_PER_HOUR, waitRealSeconds } from '../../../src/scenes/foragingWait.js';
import { RaiseTime, questActionsExtensionTemplates } from '../../../src/systems/quest/questActionsExtension.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QUEST_CTX_CONTRACT } from '../../../src/scenes/quest/questBridge.js';
import { FATIGUE_MULTIPLIER } from '../../../src/systems/statMods.js';
// ENH-NOTICE3: the wait page is a parchment of its own and rides the enhanced notice panel
import { enhancedNoticeKeys, destroyEnhancedNotice, ENHANCED_NOTICE_ID } from '../../../src/ui/enhanced/enhancedNotice.js';
import { withDom } from '../../invdrag.mjs';
import { _setMessageBoxArtForTests } from '../../../src/ui/messageBox.js';
import { createTownTalk } from '../../../src/scenes/townTalk.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A slot as the host keeps one: showOverlay replaces and disposes the outgoing window, as townTalk's does. */
function slot() {
  const s = { win: null, busy: false };
  s.show = (w) => { const out = s.win; s.win = w; if (out && out !== w) out.dispose?.(); };
  return s;
}
/** A wait over a player, online, with a foe switch and a slot. */
function rig({ online = true } = {}) {
  const entity = { foragingWait: null };
  const s = slot();
  const foe = { near: false };
  const wait = createForagingWait({ entity, showOverlay: s.show, overlayActive: () => s.busy, enemiesNear: () => foe.near, online: () => online });
  return { entity, s, foe, wait };
}

test('FORAGE4: the wait page takes no key and no click - the wait is the cost; a second wait joins the one standing; the end closes it once', () => {
  const closed = [];
  const w = new WaitWindow({ busy: 'Chop and Gather Wood...', seconds: 3, onClosed: (s) => closed.push(s) });
  for (const k of ['Escape', 'back', 'confirm', 'KeyY', 'KeyN']) w.input(k);
  assert.equal(w.done, false, 'no key ends the wait - Escape, nor the action townTalk hands for it');
  assert.equal(w.click(0, 0), true, 'a click is swallowed...');
  assert.equal(w.done, false, '...and ends nothing');
  w.tick(1);
  assert.equal(w.remaining, 2);
  w.extend(2);
  assert.equal(w.remaining, 4, 'a second wait joins the one standing');
  w.tick(3.99);
  assert.equal(w.done, false, 'not a hair early');
  w.tick(0.01);
  assert.deepEqual([w.done, closed], [true, [true]], 'the end closes the page, finished');
  w.tick(5); w.dispose();
  assert.deepEqual(closed, [true], 'once - a tick or a dispose after the end tells nobody again');
  w.extend(5);
  assert.equal(w.remaining, 0, 'and a closed page takes no more time');
  // AUDIT HUNT-OUT: the two guards - a page asked for no time still opens and ends, and a frame's dt that is no number
  // (or runs backwards) moves nothing
  const z = new WaitWindow({ seconds: 0 });
  assert.equal(z.dots, '.', 'a zero wait draws its first dot, not NaN of them');
  z.tick(0.01);
  assert.equal(z.done, true, 'and ends at the next frame, not a second later');
  const g = new WaitWindow({ seconds: 4 });
  g.tick(NaN); g.tick(-5); g.tick(undefined);
  assert.equal(g.remaining, 4, 'no dt, a NaN or a negative one spends nothing - a NaN would hold the wait for ever');
});

test('FORAGE4: a foe near ends the page early, unfinished; so does the slot taken from under it; the dots fill as it runs', () => {
  const closed = [];
  let foe = false;
  const f = new WaitWindow({ seconds: 10, interruptWhen: () => foe, onClosed: (s) => closed.push(s) });
  f.tick(1);
  foe = true;
  f.tick(1);
  assert.equal(f.done, true);
  assert.deepEqual(closed, [false], 'a foe near ends it, the rest forgiven');
  const d = new WaitWindow({ seconds: 10, onClosed: (s) => closed.push(s) });
  d.tick(2);
  d.dispose();
  assert.equal(d.done, true);
  assert.deepEqual(closed, [false, false], 'a death screen, a transition: the page goes with the slot');
  // the dots: the first at once, the last before the end
  const dots = (t) => { const w = new WaitWindow({ seconds: 10 }); w.tick(t); return w.dots.length; };
  assert.equal(dots(0.01), 1);
  assert.equal(BUSY_DOTS, 12, 'twelve dots at the full wait');
  assert.equal(dots(5), 7, 'halfway: the seventh dot is being drawn, not the sixth finished');
  assert.equal(dots(9.99), BUSY_DOTS, 'the row fills before the page ends');
});

// ── ENH-NOTICE3: THE WAIT PAGE, ON THE PANEL ─────────────────────

const recorder = () => ({ quads: [], drawScreenQuad(tex, rect) { this.quads.push({ tex, ...rect }); } });
const WAIT_FONT = { fnt: { fixedHeight: 9, fixedWidth: 4, glyphWidth: () => 4 }, tex: 'tex:font', cols: 16, rows: 16, cw: 8, ch: 8 };
const WAIT_CANVAS = { width: 640, height: 400 };

/** The live notice panels' rows, read off the stack in `dom`. */
const noticeTexts = (dom) => {
  const live = new Set(enhancedNoticeKeys());
  const stack = (dom.body.children ?? []).find((c) => c.id === ENHANCED_NOTICE_ID);
  return (stack?.children ?? [])
    .filter((c) => String(c.className).split(/\s+/).includes('notice') && live.has(c.dataset.owner))
    .flatMap((panel) => (panel.children.find((c) => c.className === 'notice-body')?.children ?? [])
      .filter((r) => r.style.display !== 'none').map((r) => r.textContent));
};

/** A running wait page on `skin`, over a document. */
function waiting(skin, fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: `?skin=${skin}` };
  try {
    return withDom((dom) => {
      const closed = [];
      const win = new WaitWindow({ busy: 'Chop and Gather Wood...', seconds: 4, onClosed: (finished) => closed.push(finished) });
      return fn({ dom, win, closed, r: recorder() });
    });
  } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
    destroyEnhancedNotice();
  }
}

test('ENH-NOTICE3: the wait page is the notice panel, redrawn per frame, and released when it ends or is taken (mutants: WAIT-parchment-drawn-under-the-panel, WAIT-panel-painted-once-and-left-stale, WAIT-no-release-on-close)', () => {
  waiting('enhanced', ({ dom, win, closed, r }) => {
    win.draw(r, WAIT_CANVAS, WAIT_FONT);
    assert.deepEqual(noticeTexts(dom), ['Chop and Gather Wood...', '.'], 'the wait\'s line and its first dot are the panel\'s');
    assert.equal(win._box, null, 'mutants: the parchment laid out under the panel');
    assert.equal(enhancedNoticeKeys().length, 1, 'one page, one panel');
    assert.ok(win._noticeKey, 'the per-frame door minted this owner a key');
    // A PER-FRAME DOOR, so the dots really move
    win.tick(2);
    win.draw(r, WAIT_CANVAS, WAIT_FONT);
    assert.deepEqual(noticeTexts(dom), ['Chop and Gather Wood...', win.dots], 'mutants: the panel painted once and left stale while the wait runs');
    assert.ok(win.dots.length > 1 && win.dots.length <= BUSY_DOTS);
    // THE END: `_end` is this window's one close door, and the panel leaves with it
    win.tick(2);
    assert.deepEqual(closed, [true]);
    assert.deepEqual(enhancedNoticeKeys(), [], 'mutants: _end not releasing - a panel left over the world');
    assert.deepEqual(noticeTexts(dom), []);
  });
  // ...and the same through dispose(), the host taking the slot
  waiting('enhanced', ({ win, r }) => {
    win.draw(r, WAIT_CANVAS, WAIT_FONT);
    win.dispose();
    assert.deepEqual(enhancedNoticeKeys(), [], 'the slot taken from under the window takes the panel too');
  });
});

test('ENH-NOTICE3: the classic skin keeps the wait\'s parchment, drawn, and builds no stack (mutants: WAIT-parchment-never-drawn)', () => {
  waiting('classic', ({ dom, win, r }) => {
    // AUDIT HUNT-OUT: with no art loaded drawMessageBox paints nothing, so a page that never drew passed - the art is
    // handed in, and the parchment's own slices must reach the renderer
    _setMessageBoxArtForTests({ slices: Array.from({ length: 9 }, (_, i) => `spop:${i}`), buttons: new Map() });
    try { win.draw(r, WAIT_CANVAS, WAIT_FONT); } finally { _setMessageBoxArtForTests(null); }
    assert.ok(r.quads.some((q) => String(q.tex).startsWith('spop:')), 'the parchment is painted');
    assert.ok(win._box, 'the message-box layout is minted');
    assert.deepEqual(win._box.rows.map((row) => row.text), ['Chop and Gather Wood...', '.'], 'with the wait\'s line and its dots');
    assert.equal(win._noticeKey, undefined, 'mutants: a key minted on the classic skin');
    assert.deepEqual(enhancedNoticeKeys(), [], 'no panel');
    assert.equal((dom.body.children ?? []).some((c) => c.id === ENHANCED_NOTICE_ID), false, 'and no stack was ever built');
  });
});

test('AUDIT HUNT-OUT C1: the real townTalk host takes the pointer\'s move and its release under the wait page - none reaches the look behind it (mutants: WAIT-hover-not-taken, WAIT-release-not-taken)', () => {
  // townTalk answers "not mine" for a window with no `hover` / `release`, and the host then hands the move to the look
  // (world.js's mousemove: `if (townTalk.hover(e) || modes?.hover?.(e)) return;`). The hunt's page had both; the wait
  // page lost them at its split, so a look still locked in the relock grace after the page opened was banked under it.
  const canvas = { width: 320, height: 200, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }) };
  const tt = createTownTalk({
    renderer: { uploadTexture: () => ({}) }, canvas,
    fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
    playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] }, regionIndex: 0,
  });
  const w = new WaitWindow({ busy: 'Chop and Gather Wood...', seconds: 4 });
  tt.showOverlay(w);
  assert.equal(tt.hover({ clientX: 40, clientY: 40 }), true, 'the move is the page\'s');
  assert.equal(tt.pointer('up', { clientX: 40, clientY: 40, button: 0 }), true, 'and so is the release');
  assert.equal(w.done, false, 'and neither ends the wait');
  tt.closeOverlay(w);
});

test('ENH-NOTICE3 (AUDIT B2/B7): the wait\'s panel promises nothing - no caption on a page that takes no click and no key - and the release precedes the close hook', () => {
  waiting('enhanced', ({ dom, win, r }) => {
    win.draw(r, WAIT_CANVAS, WAIT_FONT);
    assert.deepEqual(dom.doc.querySelectorAll('.notice-hint').map((n) => n.textContent), [],
      'mutants: the default "click or press a key" on a page that takes neither');
  });
  // THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD, in miniature: the
  // close hook may raise the next box (the quest's, held behind the
  // wait), and it must not find this window's panel still standing.
  const seen = [];
  waiting('enhanced', ({ win, r }) => {
    win.draw(r, WAIT_CANVAS, WAIT_FONT);
    win._onClosed = () => seen.push(enhancedNoticeKeys().length);
    win.tick(4);
    assert.deepEqual(seen, [0], 'mutant: the release after the hook, so the hook\'s own box lands under a panel that is leaving');
  });
});

test('FORAGE4: a wait is its game time at 8 real seconds an hour - Food 8 s, Chop and Plants 12 s, Mining and Graves 16 s', () => {
  assert.equal(WAIT_PER_HOUR, 8);
  for (const [gameSeconds, real] of [[3600, 8], [5400, 12], [7200, 16]]) {
    const { wait, entity } = rig();
    assert.equal(wait.add(gameSeconds, 'Chop and Gather Wood'), real);
    assert.deepEqual(entity.foragingWait, { seconds: real, label: 'Chop and Gather Wood', held: [] });
  }
  // AUDIT HUNT-OUT: to the hundredth - seven minutes is 0.93 s, not 0.9333... nor 0.9
  assert.equal(waitRealSeconds(7), 0.93);
  assert.equal(rig().wait.add(420), 0.93, 'and the quest\'s seconds go through it');
  assert.equal(waitLine('Chop and Gather Wood'), 'Chop and Gather Wood...', 'the page says the quest\'s own DisplayName');
  assert.equal(waitLine(null), 'Time passes...');
});

test('FORAGE4: the page opens only when the slot is free, writes its seconds left for the save, and clears at its end', () => {
  const { wait, entity, s } = rig();
  s.busy = true;   // the tool's result box, the pack
  wait.add(5400, 'Chop and Gather Wood');
  assert.equal(wait.tick(), null, 'the box and the pack close first');
  assert.equal(s.win, null);
  s.busy = false;
  const page = wait.tick();
  assert.equal(s.win, page);
  assert.equal(page.busy, 'Chop and Gather Wood...');
  assert.ok(page instanceof WaitWindow);
  page.tick(5);
  wait.tick();
  assert.equal(entity.foragingWait.seconds, 7, 'what is left, for a save made now');
  wait.add(3600);
  assert.equal(page.remaining, 15, 'a second raise joins the page');
  page.tick(15);
  assert.equal(page.done, true);
  assert.equal(entity.foragingWait, null);
  assert.equal(wait.tick(), null, 'nothing left, nothing opens');
});

test('FORAGE4: a foe near, or a window taking the slot, ends the wait with the rest forgiven', () => {
  const a = rig();
  a.wait.add(7200, 'Mine for Gems or Elements');
  const page = a.wait.tick();
  page.tick(2);
  a.foe.near = true;
  page.tick(0.1);
  assert.equal(page.done, true);
  assert.equal(a.entity.foragingWait, null, 'forgiven, not owed');
  const b = rig();
  b.wait.add(7200);
  b.wait.tick();
  b.s.show({ dispose() {} });   // a death screen, a transition
  assert.equal(b.wait.window, null);
  assert.equal(b.entity.foragingWait, null);
});

test('FORAGE4: the quest\'s boxes wait behind the page - held while it is pending or open, shown in order when it ends', () => {
  const { wait, s } = rig();
  const shown = [];
  assert.equal(wait.holds(), false);
  s.busy = true;
  wait.add(3600, 'Forage for some Food');
  assert.equal(wait.holds(), true, 'pending behind the pack is holding too - a bonus\'s line comes after the work');
  wait.hold(() => shown.push('bonus'));
  wait.hold(() => shown.push('second'));
  s.busy = false;
  const page = wait.tick();
  assert.deepEqual(shown, []);
  page.tick(8);
  assert.deepEqual(shown, [], 'the finished page leaves the slot first (AUDIT 28 H6)');
  wait.tick();
  assert.deepEqual(shown, ['bonus', 'second']);
  assert.equal(wait.holds(), false);
});

test('FORAGE4: a reload reopens the page with its seconds; offline a saved wait is forgiven; a save-edited one is cut to the max', () => {
  const { wait, entity, s } = rig();
  entity.foragingWait = { seconds: 9.5, label: 'Forage for Plants' };   // as ENTITY_FIELDS restores it
  const page = wait.tick();
  assert.equal(s.win, page);
  assert.equal(page.remaining, 9.5);
  assert.equal(page.busy, 'Forage for Plants...');
  const off = rig({ online: false });
  off.entity.foragingWait = { seconds: 12, label: 'x' };
  assert.equal(off.wait.tick(), null);
  assert.equal(off.entity.foragingWait, null, 'the offline lane has no waits');
  assert.equal(FORAGING_WAIT_MAX_SECONDS, 64, 'eight game hours: the build\'s Mining quadruple, more than the patched pack raises');
  assert.deepEqual(saneWait({ seconds: 86400, label: 'a'.repeat(100) }), { seconds: 64, label: 'a'.repeat(60), held: [] });
  assert.equal(saneWait({ seconds: -1 }), null);
  assert.equal(saneWait({ seconds: NaN }), null);
  assert.equal(saneWait('12'), null);
  const edited = rig();
  edited.entity.foragingWait = { seconds: 1e9, label: 7 };
  assert.equal(edited.wait.tick().remaining, 64);
  assert.equal(edited.wait.add(3600 * 100), 800);
  assert.equal(edited.entity.foragingWait.seconds, 864, 'a SAVED wait is cut; a wait joined in play is the sum (AUDIT 28 F1)');
});

test('FORAGE4: QAE\'s raise time is the host\'s wait online and the clock offline - MERGE 2 (main\'s LIVED1): and the character\'s own time online too', () => {
  const calls = [];
  const quest = (online) => ({
    displayName: 'Chop and Gather Wood',
    hooks: { sharedClock: () => online, raiseTime: (s) => calls.push(['clock', s]), waitOnline: (s, q) => calls.push(['wait', s, q.displayName]), nowSeconds: () => 0 },
    showMessagePopup() {},
  });
  const t = new RaiseTime(null);
  t.createNew('raise time by 1:30', quest(true)).update(null);
  t.createNew('raise time by 1:30', quest(false)).update(null);
  assert.deepEqual(calls, [['wait', 5400, 'Chop and Gather Wood'], ['clock', 5400], ['clock', 5400]], 'online the wait AND the character\'s own clock; offline the one clock');
  assert.ok(QUEST_CTX_CONTRACT.includes('waitOnline'), 'the bridge\'s contract names the door');
});

test('FORAGE4 done-when: online, the Wood-Axe\'s quest gives a 12-second wait and 20% fatigue, and the shared clock does not move', () => {
  const T = new URL('../../../vendor/dfu-quests/Tables/', import.meta.url);
  loadQuestTables(Object.fromEntries(readdirSync(T).map((f) => [f.replace(/\.txt$/, ''), readFileSync(new URL(f, T), 'utf8')])));
  const entity = {
    stats: { intelligence: 62, strength: 55, agility: 50, endurance: 50, luck: 45, willpower: 50, personality: 50, speed: 50 },
    items: [], wagonItems: [], fatigue: 105 * FATIGUE_MULTIPLIER, health: 50, maxHealth: 100, magicka: 10, maxMagicka: 50,
    level: 5, gender: 'male', name: 'Tester', foragingWait: null,
  };
  const s = slot();
  const wait = createForagingWait({ entity, showOverlay: s.show, overlayActive: () => false, online: () => true });
  const clock = [];
  const m = new QuestMachine({
    nowSeconds: () => 1000000, sharedClock: () => true, playerEntity: entity,
    raiseTime: (sec) => clock.push(sec), waitOnline: (sec, q) => wait.add(sec, q?.displayName ?? null),
    getQuestSourceLines: () => null, giveItemToPlayer: () => {}, addGold: () => {}, addHUDText: () => {}, showPopup: () => {},
    releaseQuestItem: () => {}, makeHeldQuestItemsPermanent: () => {}, getGuild: () => null, regionPriceAdjustment: () => 0,
  });
  for (const a of questActionsExtensionTemplates()) m.registerAction(a);
  const src = rd('vendor/foraging/Quests/ChopWoodQuest.txt').split(/\r?\n/);
  const ow = console.warn, ol = console.log; console.warn = () => {}; console.log = () => {};
  try {
    m.scheduleQuest(src, 0, { rolls: () => 0.99 });
    for (let i = 0; i < 6; i++) m.tick();
  } finally { console.warn = ow; console.log = ol; }
  assert.equal(clock.length, 1, 'MERGE 2 (LIVED1): the host\'s raiseTime, the character\'s OWN clock, takes the quest\'s time once - the shared clock is never the host\'s to move');
  assert.deepEqual(entity.foragingWait, { seconds: 12, label: 'Chop and Gather Wood', held: [] });
  assert.equal(entity.fatigue, 105 * FATIGUE_MULTIPLIER * 0.8, '20% of the maximum, as offline');
  const page = wait.tick();
  assert.equal(page.remaining, 12);
});

test('FORAGE4: the wiring - the streaming host builds the wait on its own slot and rest test, ticks it, holds its boxes, and the save carries it', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const foragingWait = createForagingWait\(\{\n\s*entity: playerEntity,\n\s*showOverlay: \(w\) => townTalk\.showOverlay\(w\),\n\s*overlayActive: \(\) => townTalk\.overlayActive \|\| !!modes\?\.overlayHeld,\n\s*enemiesNear: \(\) => duelEnemyNear\(\) \|\| areEnemiesNearby\(exteriorFoePool\(\), \{ resting: true \}\),\n\s*online: \(\) => sharedClockOn\(\),/);
  assert.match(w, /\n\s*foragingWait\.tick\(\);   \/\/ FORAGE4: online, a standing wait takes the slot when it is free/, 'every frame, in every mode');
  assert.match(w, /waitOnline: \(seconds, quest\) => \{ foragingWait\.add\(seconds, quest\?\.displayName \?\? null\); \},/);
  assert.match(w, /const showQuestBox = \(box\) => \{\n[^\n]*\n\s*if \(foragingWait\.holds\(\)\) \{ foragingWait\.hold\(\(\) => showQuestBox\(box\), keptBox\(box\)\); return; \}/);
  assert.match(w, /if \(foragingWait\.holds\(\)\) foragingWait\.hold\(\(\) => giveReward\(dfItem\), \{ reward: dfItem \}\);/, 'a reward\'s pile after its box, behind the wait - and kept in the save');
  assert.match(rd('src/systems/save/save.js'), /'lastSkillCheckTime',\n\s*'foragingWait',/);   // MERGE 2: main's LIVED1 retired restSimMinutes
  assert.match(rd('src/systems/quest/questActionsExtension.js'), /if \(hooks\?\.sharedClock\?\.\(\)\) hooks\?\.waitOnline\?\.\(seconds, this\.parentQuest\);\n\s*hooks\?\.raiseTime\?\.\(seconds\);/);   // MERGE 2: the character's time in both lanes
});
