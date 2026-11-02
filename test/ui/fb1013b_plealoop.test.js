// PLEA-LOOP (FIELD BUGS 2026-10-13b, a player: "Pleading guilty not working" - "I'm stuck in a loop of being able to
// plead guilty or not guilty for a crime after I assassinated an NPC for a quest"; the screenshot: the plea's buttons,
// "7 days until freedom." under them, and the Crime tutorial page beside them).
//
// The court opens on the courtroom, its plea pushed over it, and the courtroom's constructor is the Crime page's first
// use - so a beat later the page is pushed OVER the plea. The keys reach the page alone. The enhanced keyed menu's
// buttons reached the plea directly: answered under the page, its prison screen replaced the PAGE, the answered plea
// stayed in the stack, painted every frame with live buttons, and every press pleaded again - the term halved, the fine
// taken again, the release run again. Its scrim took every click the page asked for.
//
// Driven through the real town host's stack (townTalk), the real arrest flow and court, the real tutorial line and page
// (its clock and timers turned by hand) and the real keyed menu's DOM (a fake document that keeps listeners).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTownTalk } from '../../src/scenes/townTalk.js';
import { createArrestFlow, RELEASE_MINUTES } from '../../src/scenes/arrestFlow.js';
import { CRIMES } from '../../src/systems/court.js';
import { ChoiceWindow } from '../../src/ui/talkWindow.js';
import { PrisonScreenWindow, CourtScreenWindow, PRISON_UPDATE_INTERVAL } from '../../src/ui/prisonScreen.js';
import { makeWindowStack, windowCovered } from '../../src/ui/windowStack.js';
import { COVERED_CLASS, closeEnhancedChoice } from '../../src/ui/enhanced/enhancedDialog.js';
import { PLUS_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';   // the sheet the enhanced skin injects (the dialog's rules ride it)
import { _setTutorialDepsForTests, SHOW_DELAY_MS, INPUT_GRACE_MS } from '../../src/ui/tutorialPopup.js';
import { forgetTutorialsSeen, isTutorialSeen } from '../../src/systems/tutorials.js';
import { _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';

// ── a document that keeps its listeners (the keyed menu's buttons are addEventListener'd) ──
function fakeNode(tag) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', type: '',
    style: { setProperty() {} }, attrs: {}, dataset: {}, listeners: {},
    classList: { add() {}, remove() {}, contains: () => false },
    append(...cs) { for (const c of cs) if (typeof c === 'object') { c.parent = n; n.children.push(c); } },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(type, fn) { (n.listeners[type] ??= []).push(fn); },
    removeEventListener() {},
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { createElement: (t) => fakeNode(t) };
  doc.head = fakeNode('head'); doc.body = fakeNode('body');
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls, out = []) => {
  if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n);
  for (const c of n.children ?? []) find(c, cls, out);
  return out;
};
const textOf = (n) => (n.textContent || '') + n.children.map(textOf).join('');
const choiceShell = (doc) => find(doc.body, 'dlg-choice')[0] ?? null;
const button = (doc, word) => find(doc.body, 'dlg-btn').find((b) => textOf(b).includes(word)) ?? null;
/** A press on the keyed menu's button: its click listener, as the browser runs it. */
const press = (btn) => { for (const fn of btn.listeners.click ?? []) fn({ preventDefault() {}, stopPropagation() {} }); };

/** The enhanced skin (uiSkin reads ?skin) and a document, for one test. */
async function withEnhanced(fn) {
  const hadLoc = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  const hadDoc = Object.hasOwn(globalThis, 'document') ? globalThis.document : undefined;
  globalThis.location = { search: '?skin=enhanced' };
  const doc = fakeDocument();
  globalThis.document = doc;
  try { return await fn(doc); } finally {
    closeEnhancedChoice();
    if (hadLoc === undefined) delete globalThis.location; else globalThis.location = hadLoc;
    if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc;
  }
}

/** The tutorial line on a hand-turned clock. Answers the clock's advance. */
function handClock() {
  let now = 10_000;
  const timers = [];
  _setTutorialDepsForTests({
    now: () => now,
    setTimeout: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t; },
    clearTimeout: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); },
    win: () => null,          // no press watching: the page reads after its grace alone
    held: () => false,
  });
  return (ms) => {
    now += ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0];
      if (!due) return;
      timers.splice(timers.indexOf(due), 1);
      due.fn();
    }
  };
}

/** A FNT the port's reader accepts, so the town host's frame paints (townTalk.js `if (overlay && font)`). */
function synthFnt() {
  const bytes = new Uint8Array(4 + 240 * 4 + 240 * 32);
  const v = new DataView(bytes.buffer);
  v.setUint16(0, 5, true); v.setUint16(2, 7, true);
  for (let i = 0; i < 240; i++) { v.setUint16(4 + i * 4, 4 + 240 * 4 + i * 32, true); v.setUint16(4 + i * 4 + 2, 4, true); }
  return bytes;
}
const CANVAS = { width: 640, height: 400, clientWidth: 640, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }) };
async function townHost() {
  const townTalk = createTownTalk({
    renderer: { uploadTexture: (_k, n) => `tex:${n}`, createTexture: () => ({}), drawScreenQuad: () => {} },
    canvas: CANVAS,
    fetchBytes: async (n) => { if (n === 'FONT0003.FNT') return synthFnt(); throw new Error('this pin loads no ARENA2'); },
    playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
    regionIndex: 0,
  });
  await townTalk.ensureLoaded();
  return townTalk;
}

/** The report's defendant: a Criminal Conspiracy (the watch's "come quietly"), a standing in the -20s, 160 gold. */
const defendant = () => ({
  name: 'Shana Joral', health: 1, maxHealth: 40, fatigue: 0, maxFatigue: 100, magicka: 0, maxMagicka: 20,
  stats: { endurance: 50, strength: 50, willpower: 50, personality: 50 },
  crimeCommitted: CRIMES.Criminal_Conspiracy, chargedCrime: CRIMES.Criminal_Conspiracy, legalRep: { 17: -22 },
  items: [], skills: 30, goldPieces: 160, haveShownSurrenderDialogue: true, arrested: false,
});
function court(townTalk, player = defendant()) {
  const log = { days: [], minutes: [] };
  const flow = createArrestFlow({
    townTalk, playerEntity: player, regionIndex: 17, rolls: () => 0.99,
    advanceDays: (d) => log.days.push(d), advanceMinutes: (m) => log.minutes.push(m),
    guildRankOf: () => null,
  });
  return { flow, player, log };
}

test('PLEA-LOOP: under the Crime page the plea is painted, takes no pointer and answers nothing; the click puts the page away; then the plea is answered once and the trial ends once', async () => {
  resetPrefs();
  forgetTutorialsSeen();
  const advance = handClock();
  await withEnhanced(async (doc) => {
    const townTalk = await townHost();
    const { flow, player, log } = court(townTalk);
    flow.startCourtFlow();
    const plea = townTalk.overlay;
    assert.ok(plea instanceof ChoiceWindow && plea.options.length === 2, 'the plea stands over the courtroom');
    townTalk.frame(0.016);
    assert.ok(button(doc, 'Guilty'), 'the plea is the enhanced keyed menu');
    assert.equal(choiceShell(doc).className.includes(COVERED_CLASS), false, 'on top, it takes the pointer');

    // the courtroom's constructor was the Crime page's first use: a beat later the page is pushed over the plea
    advance(SHOW_DELAY_MS);
    const page = townTalk.overlay;
    assert.ok(page?.tutorial, 'the Crime page is the top window');
    assert.equal(windowCovered(plea), true, 'the plea is covered');
    assert.equal(windowCovered(page), false);
    townTalk.frame(0.016);
    assert.ok(button(doc, 'Guilty'), 'the covered plea is still painted (the stack paints what its top covers)');
    assert.ok(choiceShell(doc).className.split(/\s+/).includes(COVERED_CLASS), 'covered, the dialog wears the class that takes no pointer');
    // ...and the sheet the game composes takes it: no pointer for the covered shell, which every node of the dialog
    // inherits - no rule of a .dlg- selector gives one back
    const rules = PLUS_CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')).filter((p) => p.length === 2)
      .map(([sel, body]) => [sel.trim(), body]).filter(([sel, body]) => /\.dlg-/.test(sel) && /pointer-events/.test(body));
    assert.deepEqual(rules.map(([sel, body]) => [sel, /pointer-events:\s*none/.test(body)]), [[`.dlg-shell.${COVERED_CLASS}`, true]],
      'the covered dialog takes no pointer, and nothing in the dialog takes it back');

    // the report's press: "Guilty" while the page stands - nothing is pleaded
    press(button(doc, 'Guilty'));
    press(button(doc, 'Not guilty'));
    assert.equal(plea.done, false, 'a covered plea answers nothing');
    assert.equal(player.goldPieces, 160, 'no fine taken');
    assert.equal(townTalk.overlay, page, 'the page is still the top window - no prison screen replaced it');
    assert.equal(player.inPrison ?? false, false);

    // the click falls through the covered dialog to the canvas, and the host hands it to the page
    advance(INPUT_GRACE_MS);
    assert.equal(townTalk.pointerdown({ clientX: 320, clientY: 200, button: 0 }), true, 'the canvas click is the top window\'s');
    assert.equal(page.done, true, 'the page is put away by the click its hint asks for');
    await Promise.resolve();   // the box's onClose runs past the dismissal (ui/actionText.js SEARCH1)
    assert.equal(isTutorialSeen('crime'), true, 'and read');
    assert.equal(townTalk.overlay, plea, 'the plea is uncovered');
    townTalk.frame(0.016);
    assert.equal(choiceShell(doc).className.includes(COVERED_CLASS), false, 'on top again, it takes the pointer');

    // now the plea answers - once
    press(button(doc, 'Guilty'));
    assert.equal(plea.done, true);
    assert.equal(player.goldPieces, 80, 'the guilty plea halves the 160 fine and takes it, once');
    const prison = townTalk.overlay;
    assert.ok(prison instanceof PrisonScreenWindow, 'the prison screen replaced the PLEA');
    assert.equal(windowCovered(plea), false, 'the answered plea is in no stack');
    const term = prison.daysInPrison;
    assert.ok(term > 0);
    let pleaShown = 0;
    for (let i = 0; i < term + 4; i++) {
      townTalk.frame(PRISON_UPDATE_INTERVAL);
      if (button(doc, 'Guilty')) pleaShown++;
      press(button(doc, 'Guilty') ?? { listeners: {} });   // a press on a plea that is not there does nothing
    }
    assert.equal(pleaShown, 0, 'the answered plea is never painted again - its buttons never come back');
    assert.equal(player.goldPieces, 80, 'the fine was taken once');
    assert.deepEqual(log.days, [term], 'the term was served once, whole');
    assert.deepEqual(log.minutes, [RELEASE_MINUTES], 'ReleaseFromPrison ran once');
    assert.equal(player.arrested, false);
    assert.equal(player.crimeCommitted, 0);
    assert.ok(!(townTalk.overlay instanceof CourtScreenWindow) && !(townTalk.overlay instanceof PrisonScreenWindow), 'the court is gone');
    flow.dispose();
  });
});

test('PLEA-LOOP: the stack answers "covered" through every door in and out - a push, a pop, a replacement, keepOnly, beneath a window that holds the top - and a window in no stack is nobody\'s to cover', () => {
  const s = makeWindowStack();
  const a = { name: 'a' }, b = { name: 'b' }, c = { name: 'c' }, d = { name: 'd' }, loose = { name: 'loose' };
  assert.equal(windowCovered(loose), false, 'a window no stack holds');
  assert.equal(windowCovered(null), false);
  s.pushWindow(a);
  assert.equal(windowCovered(a), false, 'the top answers');
  s.pushWindow(b);
  assert.equal(windowCovered(a), true, 'a window under another is covered');
  assert.equal(windowCovered(b), false);
  s.popWindow();
  assert.equal(windowCovered(b), false, 'a popped window is in no stack - it covers and is covered by nothing');
  assert.equal(windowCovered(a), false, 'uncovered, it answers again');
  s.pushWindow(b);
  s.reconcile(c);   // a one-level replacement (showOverlay's): c takes b's place over a
  assert.equal(windowCovered(b), false, 'the replaced window has left the stack');
  assert.equal(windowCovered(a), true);
  s.pushWindow(d);
  assert.equal(windowCovered(c), true, 'the replacement is held - a push over it covers it');
  s.keepOnly(d);
  assert.equal(windowCovered(a), false, 'keepOnly\'s drained windows are in no stack');
  assert.equal(windowCovered(c), false);
  assert.equal(windowCovered(d), false);
  const death = { holdsTop: true };
  s.pushWindow(death);
  const waiting = { name: 'waiting' };
  s.pushWindow(waiting);   // RISE-STUCK: suspended beneath the window that holds the top
  assert.equal(windowCovered(waiting), true, 'a window waiting beneath the death screen answers nothing');
  s.clear();
  assert.equal(windowCovered(waiting), false);
  assert.equal(windowCovered(death), false);
});

test('PLEA-LOOP: a keyed menu answers ONCE, however many doors reach it - a key, a click, its enhanced button rebuilt by a later paint', async () => {
  await withEnhanced(async (doc) => {
    const got = [];
    const box = new ChoiceWindow({ lines: ['How plead you?'], options: [
      { code: 'KeyG', label: 'G - guilty', action: () => got.push('G') },
      { code: 'KeyN', label: 'N - not guilty', action: () => got.push('N') },
    ] });
    box.input('KeyG');
    box.input('KeyG');
    box.input('KeyN');
    assert.deepEqual(got, ['G'], 'the first answer is the only one');
    // a done box painted again (as the stack paints a window its top covers) raises its dialog again - and a press on
    // it answers nothing
    box.draw({ drawScreenQuad() {} }, CANVAS, { fnt: { fixedHeight: 9, glyphWidth: () => 4 } }, 2);
    const again = button(doc, 'Guilty');
    assert.ok(again, 'the rebuilt dialog');
    press(again);
    assert.deepEqual(got, ['G'], 'its press pleads nothing');
  });
});

test('PLEA-LOOP: a released trial is over - a step armed for it acts on nothing after ReleaseFromPrison', async () => {
  resetPrefs();
  forgetTutorialsSeen();
  handClock();
  const townTalk = await townHost();
  const { flow, player, log } = court(townTalk);
  flow.startCourtFlow();
  const plea = townTalk.overlay;
  const [guilty, notGuilty] = plea.options.map((o) => o.action);
  townTalk.keydown({ code: 'KeyG', key: 'g', preventDefault() {} });
  const prison = townTalk.overlay;
  assert.ok(prison instanceof PrisonScreenWindow);
  for (let i = 0; i < prison.daysInPrison + 4; i++) townTalk.frame(PRISON_UPDATE_INTERVAL);
  assert.deepEqual(log.minutes, [RELEASE_MINUTES], 'released');
  assert.equal(player.goldPieces, 80);
  // the plea's two steps, reached by a door that does not ask the box (its own once-guard is the box's half)
  guilty();
  notGuilty();
  assert.equal(player.goldPieces, 80, 'no plea after the release - no fine taken again');
  assert.deepEqual(log.minutes, [RELEASE_MINUTES], 'no second release - no four more hours, no second grace');
  assert.equal(townTalk.overlay instanceof PrisonScreenWindow || townTalk.overlay?.isChoiceWindow === true && townTalk.overlay?.options?.length > 0, false,
    'no prison screen and no box of the released trial comes back');
  assert.equal(player.arrested, false);
  flow.dispose();
});
