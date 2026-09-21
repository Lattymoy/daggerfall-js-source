// U5: the message queue - PopupText's single-timer model (AUDIT 18
// ui-native: the old per-line 2.0 s countdown and 4-row cap were the
// port's, not DFU's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HudText, HUD_TEXT_POP_DELAY, HUD_TEXT_MAX_ROWS, HUD_TEXT_RUBBERBAND } from '../src/ui/hudText.js';

test('hudText: PopupText.AddText/Update - the queue never caps, the timer pops', () => {
  const h = new HudText();
  for (let i = 0; i < 6; i++) h.add(`m${i}`);
  // AddText queues unconditionally - nothing is dropped on add
  assert.equal(h.lines.length, 6);
  assert.equal(h.lines[0].text, 'm0');
  assert.equal(h.timer, HUD_TEXT_POP_DELAY);
  // timer must fall below -popDelay before the FIRST row pops
  h.tick(HUD_TEXT_POP_DELAY * 2 - 0.01);
  assert.equal(h.lines.length, 6);
  h.tick(0.02);
  assert.equal(h.lines.length, 5);
  assert.equal(h.lines[0].text, 'm1');
  // one pop per popDelay of further drain
  h.tick(HUD_TEXT_POP_DELAY);
  assert.equal(h.lines.length, 4);
  h.tick(10);
  assert.equal(h.lines.length, 0);
  h.tick(1);                                             // empty ticks safe
});

test('hudText: the rubberband speedup only engages past maxRows', () => {
  const under = new HudText();
  for (let i = 0; i < HUD_TEXT_MAX_ROWS; i++) under.add(`m${i}`);
  under.tick(0.5);
  assert.equal(under.timer, HUD_TEXT_POP_DELAY - 0.5);
  const over = new HudText();
  for (let i = 0; i < HUD_TEXT_MAX_ROWS + 3; i++) over.add(`m${i}`);
  over.tick(0.5);
  assert.equal(over.timer, HUD_TEXT_POP_DELAY - 0.5 * (1 + HUD_TEXT_RUBBERBAND * 3));
});


// ── FONT1 (2026-09-16, Mac: "Enhanced mode UI ... Ambient Text mod also
// doesnt use it. Any enhanced UI or text must be our enhanced
// version"): THE POPUP ROWS IN THE ENHANCED FACE ────────────────────
//
// The model above is PopupText and stays PopupText: what the skin
// changes is the PAINT. FONT1's paint was a DOM column at the top of
// the screen; ENH-NOTICE3 (2026-09-21, Mac: "All mods, including
// climates and calories need to utilize the enhanced notification
// popup") moved it into the notice stack as TOASTS - one panel per row
// in the same right-edge stack the message box slides into
// (ui/enhancedNotice.js drawEnhancedToasts). These drive that arm over
// a fake document (the shape test/enhancedNotice.test.js drives its
// panels through) and the classic arm over a recording renderer, and
// each pin names the mutants it kills.
import { readFileSync } from 'node:fs';
import { drawEnhancedStatusLine, destroyEnhancedHudText, setEnhancedMidTextScale, midTextTopPx, ENHANCED_MID_TEXT_ID, ENHANCED_STATUS_ID } from '../src/ui/enhancedHudText.js';
import { destroyEnhancedNotice, enhancedNoticeKeys, _setNoticeClockForTests, ENHANCED_NOTICE_ID, NOTICE_SLIDE_MS } from '../src/ui/enhancedNotice.js';
import { MidScreenText, MID_SCREEN_TEXT_DEFAULT_DELAY, midScreenText } from '../src/ui/midScreenText.js';
import { ENHANCED_CSS, ENHANCED_STYLE_ID, injectEnhancedStyle } from '../src/ui/enhancedStyle.js';
import * as enhancedStyle from '../src/ui/enhancedStyle.js';
import { hideHudTextSurfaces } from '../src/ui/hud.js';
import { nativeMetrics } from '../src/ui/nativePanel.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '',
    style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, attrs: {},
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { c.parent = n; const i = n.children.indexOf(ref); if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = {};
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
/** The renderer HudText's classic arm draws through - every quad it puts up. */
const recorder = () => ({ quads: [], drawScreenQuad(tex, rect) { this.quads.push({ tex, ...rect }); } });
const FONT = { fnt: { fixedHeight: 9, fixedWidth: 4, glyphWidth: () => 4 }, tex: 'tex:font', cols: 16, rows: 16, cw: 8, ch: 8 };
/** The notice module's clock, turned by hand (test/enhancedNotice.test.js's
 *  shape): a released toast's node leaves when NOTICE_SLIDE_MS fires. */
function fakeClock() {
  const due = [];
  let id = 0;
  _setNoticeClockForTests(
    (fn, ms) => { const t = { id: ++id, fn, ms, live: true }; due.push(t); return t; },
    (t) => { if (t) t.live = false; },
  );
  return { due, fire(ms) { for (const t of due.filter((t) => t.live && t.ms === ms)) { t.live = false; t.fn(); } } };
}
/** The skin, for one test. isEnhanced() reads globalThis.location.search when nothing is passed. */
const withSkin = (skin, fn) => {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  const hadDoc = Object.hasOwn(globalThis, 'document') ? globalThis.document : undefined;
  globalThis.location = { search: `?skin=${skin}` };
  const clock = fakeClock();
  try { return fn(clock); } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
    if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc;
    destroyEnhancedHudText();
    destroyEnhancedNotice();
    _setNoticeClockForTests((fn2, ms) => setTimeout(fn2, ms), (t) => clearTimeout(t));
  }
};
const stackOf = (doc) => doc.getElementById(ENHANCED_NOTICE_ID);
/** This model's toasts, in stack order - the panels keyed `${model.key}:${row id}`. */
const toastsOf = (doc, h) => (stackOf(doc)?.children ?? []).filter((p) => String(p.dataset.owner).startsWith(`${h.key}:`));
const bodyOf = (panel) => panel.children.find((c) => c.className === 'notice-body');
const hintOf = (panel) => panel.children.find((c) => c.className === 'notice-hint');
/** The rows a reader sees: each SHOWN toast's one row, released ones (sliding out) excluded. */
const rowsOf = (toasts) => toasts
  .filter((p) => p.style.display !== 'none' && !p.className.includes('notice-out'))
  .map((p) => bodyOf(p).children[0].textContent);

test('FONT1: HudText.frame is PopupText.Draw as data - the same rows, the same scroll-out, the same off-by-one - and ENH-NOTICE3 an id beside each row', () => {
  const h = new HudText();
  assert.deepEqual(h.frame(), { rows: [], ids: [], slide: 0 }, 'nothing queued, nothing drawn');
  for (let i = 0; i < 3; i++) h.add(`m${i}`);
  assert.deepEqual(h.frame().rows, ['m0', 'm1', 'm2'], 'front first, in the queue\'s order');
  // ENH-NOTICE3: a toast must know WHICH row it is across frames - a
  // row that left the frame was popped and slides out, a row still in
  // it stays put. The ids are the rows' own, never reused by a model.
  assert.deepEqual(h.frame().ids, [1, 2, 3], 'mutants: no ids (every toast keyed by index, so a pop re-keys every row and the whole stack re-slides); ids reused');
  h.tick(HUD_TEXT_POP_DELAY * 2 + 0.01);
  assert.deepEqual(h.frame().ids, [2, 3], 'the popped row\'s id leaves with it');
  h.add('m3');
  assert.deepEqual(h.frame().ids, [2, 3, 4], 'mutant: the counter reset, so a new row takes a popped row\'s id and its toast');
  // PopupText.Draw breaks AFTER the row that takes the count past
  // maxRows (`if (++count > maxCount) break`), so a long queue paints
  // maxRows + 1. The classic arm has always done this; the enhanced
  // one must do the same or the two skins show different rows.
  const many = new HudText();
  for (let i = 0; i < 20; i++) many.add(`m${i}`);
  assert.equal(many.frame().rows.length, HUD_TEXT_MAX_ROWS + 1,
    'mutants: rows cut to maxRows (the 8th row vanishes under the enhanced skin alone); the queue drawn whole (20 rows down the screen)');
  assert.equal(many.frame().ids.length, HUD_TEXT_MAX_ROWS + 1, 'the ids are cut where the rows are');
  // The slide is PopupText's own `timer / popDelay`, and ONLY while the
  // timer is negative - a positive timer is a row waiting, not leaving.
  assert.equal(many.frame().slide, 0, 'mutants: the slide taken from a positive timer, so the column sits low and drifts up as it waits');
  many.tick(HUD_TEXT_POP_DELAY + 0.5);
  assert.ok(Math.abs(many.frame().slide - (many.timer / HUD_TEXT_POP_DELAY)) < 1e-9);
  assert.ok(many.frame().slide < 0, 'the classic column rides UP as the front row leaves');
});

test('ENH-NOTICE3: under the enhanced skin each PopupText row is a TOAST in the notice stack - no hint, updated not rebuilt, hidden on command, gone when the model pops it', () => {
  withSkin('enhanced', (clock) => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const h = new HudText();
    h.draw(recorder(), CANVAS, null);
    assert.equal(stackOf(doc), null, 'silence builds nothing - a stack for no lines is furniture');

    h.add('Your Long Blade skill has improved.');
    h.add('You found 5 gold pieces.');
    // The FONT is null here on purpose: the enhanced face owes the
    // classic bitmap font nothing, and a skin that could not speak
    // without ARENA2's font would be the classic skin wearing a coat.
    h.draw(recorder(), CANVAS, null);
    const stack = stackOf(doc);
    assert.ok(stack, 'mutants: the enhanced arm dropped, so the lines draw in the 1996 bitmap face (or not at all with no font)');
    assert.equal(stack.className, 'notice-stack', 'THE SAME STACK the message box slides into - not a second face');
    const toasts = toastsOf(doc, h);
    assert.equal(toasts.length, 2, 'mutants: the rows painted into ONE panel (a box, not toasts - a new line would repaint every old one)');
    assert.deepEqual(toasts.map((p) => p.dataset.owner), [`${h.key}:1`, `${h.key}:2`], 'each keyed by its row under its model');
    assert.deepEqual(toasts.map((p) => p.className), ['notice notice-toast notice-in', 'notice notice-toast notice-in'],
      'mutants: the toast class dropped (a toast wearing the box\'s edge); notice-in never set (no slide)');
    assert.deepEqual(rowsOf(toasts), ['Your Long Blade skill has improved.', 'You found 5 gold pieces.']);
    assert.equal(hintOf(toasts[0]), undefined, 'mutant: "click or press a key" on a row nothing dismisses');

    // UPDATED, NOT REBUILT: the nodes survive the next frame, and there
    // is still exactly ONE stack in the document.
    h.draw(recorder(), CANVAS, null);
    assert.equal(toastsOf(doc, h)[0], toasts[0], 'mutants: the panel rebuilt every frame (PX19k at sixty times a second), or released and re-raised so it re-slides every frame');
    assert.equal(doc.body.children.filter((c) => c.id === ENHANCED_NOTICE_ID).length, 1,
      'mutant: a fresh stack built every frame, stacking dead toasts under the live ones');

    // A THIRD LINE JOINS; the first two stay where they are.
    h.add('The door is locked.');
    h.draw(recorder(), CANVAS, null);
    assert.deepEqual(rowsOf(toastsOf(doc, h)), ['Your Long Blade skill has improved.', 'You found 5 gold pieces.', 'The door is locked.']);
    assert.equal(toastsOf(doc, h)[0], toasts[0], 'mutant: a new row re-keys the old ones (index keys), so the whole stack slides again on every line');

    // THE HIDE DOOR (AUDIT 64 F37): a DOM face stays painted unless it
    // is told otherwise, and the hosts tell it on the else of the gate
    // they already had.
    h.hide();
    assert.deepEqual(toastsOf(doc, h).map((p) => p.style.display), ['none', 'none', 'none'],
      'mutants: hide() a no-op, so the last lines stand over a hidden HUD until something else is said; hide releasing (the rows would re-slide in when the HUD came back)');
    assert.deepEqual(h.lines.map((l) => l.text), ['Your Long Blade skill has improved.', 'You found 5 gold pieces.', 'The door is locked.'],
      'and hiding the paint never touches the QUEUE - PopupText.Update keeps draining under a window');
    h.draw(recorder(), CANVAS, null);
    assert.deepEqual(toastsOf(doc, h).map((p) => p.style.display), ['', '', ''], 'and the next drawn frame brings them back, the same nodes');

    // A ROW THAT POPPED SLIDES OUT. The queue is the model's; the face
    // must follow it down as well as up - and only the popped row goes.
    h.tick(HUD_TEXT_POP_DELAY * 2 + 0.01);
    assert.equal(h.lines.length, 2, 'the front row popped (PopupText.Update)');
    h.draw(recorder(), CANVAS, null);
    assert.equal(toasts[0].className, 'notice notice-toast notice-out', 'mutants: a spent row left standing (the face only ever grows); the popped row hidden rather than slid out');
    assert.deepEqual(rowsOf(toastsOf(doc, h)), ['You found 5 gold pieces.', 'The door is locked.']);
    clock.fire(NOTICE_SLIDE_MS);
    assert.ok(toasts[0].removed, 'the node leaves after the slide');
    assert.equal(toastsOf(doc, h).length, 2);
    assert.equal(toastsOf(doc, h)[0], toasts[1], 'the rows still queued kept their nodes');

    // ...and the last pop takes the stack with it.
    h.tick(10);
    h.draw(recorder(), CANVAS, null);
    clock.fire(NOTICE_SLIDE_MS);
    assert.equal(stackOf(doc), null, 'mutant: the stack outlives its last panel');
    assert.deepEqual(enhancedNoticeKeys(), [], 'and no panel is left registered');
  });
});

test('FONT1: the classic skin draws the column exactly as it did - bitmap glyphs, no DOM at all', () => {
  withSkin('classic', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const h = new HudText();
    h.add('AB');
    const r = recorder();
    h.draw(r, { width: 1920, height: 1080 }, FONT);
    assert.ok(r.quads.length >= 2, 'the classic arm still paints its glyphs through the renderer');
    assert.equal(stackOf(doc), null,
      'mutants: the enhanced arm taken unconditionally, so the classic skin grows a DOM stack over its own column');
    // ...and the classic skin's hide is nothing at all, because the
    // classic column is repainted every frame.
    h.hide();
    assert.equal(stackOf(doc), null);
    // A font-less classic frame draws nothing rather than throwing.
    const r2 = recorder();
    h.draw(r2, { width: 1920, height: 1080 }, null);
    assert.equal(r2.quads.length, 0);
  });
});

test('ENH-NOTICE3: the toast wears the popup\'s yellow on the box\'s dark, in the one stack\'s face - and the column\'s sheet is GONE', () => {
  const css = ENHANCED_CSS;
  // The stack's face is the notice panel's (ENH-NOTICE1 pins it); the
  // toast is the same panel with the classic popup's own colour pair
  // (nativePanel DEFAULT_TEXT_COLOR rgb(243,239,44), its shadow
  // rgb(93,77,12)) so a row the game SAYS reads apart from a box the
  // player must ANSWER.
  assert.match(css, /\.notice\.notice-toast \{[^}]*border-left-color: rgba\(243,239,44,0\.55\);/,
    'mutant: the toast rule dropped, so a skill-up wears the brass edge of a box waiting for a click');
  assert.match(css, /\.notice\.notice-toast \.notice-row \{[^}]*color: rgb\(243,239,44\); text-shadow: 2px 2px 0 rgb\(93,77,12\);/,
    'mutants: the popup\'s yellow dropped (a toast in the box\'s bone, one kind indistinguishable from the other)');
  assert.match(css, /\.notice-stack \{[^}]*font-family: 'Pixelify Five', 'Pixelify Sans', monospace; -webkit-font-smoothing: none;/,
    'the toast speaks in the skin\'s face because the stack does');
  // THE COLUMN IS RETIRED, sheet and numbers alike: a second enhanced
  // face for the HUD line would be exactly what ENH-NOTICE3 closed.
  assert.doesNotMatch(css, /\.hudtext/, 'mutant: the column\'s rules back in the sheet beside the toasts');
  for (const name of ['HUD_TEXT_TOP_PX', 'HUD_TEXT_ROW_PX', 'HUD_TEXT_TOP_NARROW_PX', 'HUD_TEXT_TOP_CHAT_PX', 'HUD_TEXT_TOP_CHAT_TOUCH_PX']) {
    assert.equal(enhancedStyle[name], undefined, `mutant: ${name} exported again - a number for a surface that is not there`);
  }
  const mod = rd('src/ui/enhancedHudText.js');
  assert.doesNotMatch(mod, /export function drawEnhancedHudText|export function releaseEnhancedHudText|ENHANCED_HUD_TEXT_ID/,
    'mutant: the column\'s draw back in the module - two enhanced faces for one PopupText');
  assert.match(rd('src/ui/hudText.js'), /import \{ drawEnhancedToasts, releaseEnhancedToasts \} from '\.\/enhancedNotice\.js';/,
    'the model draws through the notice stack and nothing else');
});

test('FONT1: the HUD\'s OTHER text surface - the mid-screen label - speaks in the same face, and hides on the same law', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const label = new MidScreenText();
    label.draw(recorder(), { width: 1280, height: 800 }, null);
    assert.equal(doc.getElementById(ENHANCED_MID_TEXT_ID), null, 'an unset label builds nothing');

    label.set('You are too far away.');
    label.draw(recorder(), { width: 1280, height: 800 }, null);
    const node = doc.getElementById(ENHANCED_MID_TEXT_ID);
    assert.ok(node, 'mutants: the enhanced arm dropped, so the mode word and every refusal stay in the 1996 face');
    assert.equal(node.className, 'hudmid');
    assert.equal(node.textContent, 'You are too far away.');
    assert.equal(node.attrs['aria-hidden'], 'true');
    // It REPLACES - DaggerfallHUD.cs:367-370, one line, never a queue.
    label.set('Interaction is now in talk mode.');
    label.draw(recorder(), { width: 1280, height: 800 }, null);
    assert.equal(doc.body.children.filter((c) => c.id === ENHANCED_MID_TEXT_ID).length, 1, 'mutant: a node per message, stacking');
    assert.equal(node.textContent, 'Interaction is now in talk mode.');
    // The timer blanks it (the 1.5 s delay is DFU's and untouched).
    label.tick(MID_SCREEN_TEXT_DEFAULT_DELAY + 0.1);
    label.draw(recorder(), { width: 1280, height: 800 }, null);
    assert.equal(node.style.display, 'none', 'mutants: the blanked label left on screen for good');
    // ...and so does the hide door, on a frame that is not drawn.
    label.set('back');
    label.draw(recorder(), { width: 1280, height: 800 }, null);
    assert.equal(node.style.display, '');
    label.hide();
    assert.equal(node.style.display, 'none', 'mutant: hide() a no-op, so the line stands over a hidden HUD');
    assert.equal(label.text, 'back', 'and the hide never touches the label\'s own state - only the paint');
  });
  // The classic arm is untouched: bitmap glyphs, no DOM.
  withSkin('classic', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const label = new MidScreenText();
    label.set('AB');
    const r = recorder();
    label.draw(r, { width: 1920, height: 1080 }, FONT);
    assert.ok(r.quads.length >= 2);
    assert.equal(doc.getElementById(ENHANCED_MID_TEXT_ID), null,
      'mutant: the enhanced arm taken unconditionally, so the classic skin grows a DOM line over its own');
  });
  // ...and the sheet dresses it in the skin's face at DFU's own height
  // (146 of 200 native rows is 73% of the screen).
  assert.match(ENHANCED_CSS, /\.hudmid \{[^}]*top: var\(--hudmid-top, 73%\);/,
    'mutants: the module\'s own number dropped, leaving a proportion that is only right at 16:10 (AUDIT FONT F11); the fallback dropped, so a label drawn before any frame has no place at all');
  assert.match(ENHANCED_CSS, /\.hudmid \{[^}]*font-family: 'Pixelify Five', 'Pixelify Sans', monospace; -webkit-font-smoothing: none;/,
    'mutants: left in --data (the launcher face); the smoothing left on');
  assert.match(ENHANCED_CSS, /\.hudmid \{[^}]*pointer-events: none;/);
  // The one host-agnostic call owns both halves: drawHud paints the
  // label on a drawn frame and HIDES it on one that is not, so no host
  // can leave a DOM line standing (AUDIT 64 F37's law, FONT1's door).
  assert.match(rd('src/ui/hud.js'), /if \(hudDrawn\) midScreenText\.draw\(renderer, canvas, font\); else midScreenText\.hide\(\);/,
    'mutant: the hide door dropped from drawHud, so a hidden HUD keeps its last refusal on screen');
});

test('FONT1: the online status line is the skin\'s face too, and every silent path says so', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    assert.equal(drawEnhancedStatusLine('', doc), null, 'no line, no node');
    const node = drawEnhancedStatusLine('online: reconnecting', doc);
    assert.ok(node, 'the line is drawn');
    assert.equal(node.className, 'hudstatus');
    assert.equal(node.textContent, 'online: reconnecting');
    assert.equal(node.attrs['aria-hidden'], 'true');
    drawEnhancedStatusLine('online: connecting', doc);
    assert.equal(doc.body.children.filter((c) => c.id === ENHANCED_STATUS_ID).length, 1, 'mutant: a node per status, stacking');
    assert.equal(node.textContent, 'online: connecting', 'it REPLACES - there is one socket and one word for it');
    drawEnhancedStatusLine('', doc);
    assert.equal(node.style.display, 'none', 'mutant: a connected session left wearing "reconnecting" for good');
  });
  // The host: the online lane is the enhanced lane whole, so the line
  // goes through ONE door that knows the skin - and every path that
  // draws no names hides it rather than returning into a painted DOM
  // strip (AUDIT 64 F37's law).
  const world = rd('src/scenes/world.js');
  assert.match(world, /const sayNetStatus = \(line\) => \{\s*\n\s*if \(isEnhanced\(\) && typeof document !== 'undefined'\) \{ drawEnhancedStatusLine\(line \?\? ''\); return; \}/,
    'mutants: the enhanced arm dropped, so the one online surface left in the 1996 face stays in it; the classic arm dropped, so a classic-skin probe loses the line');
  assert.equal((world.match(/sayNetStatus/g) ?? []).length, 4,
    'mutant: a silent return that does not hide the strip - the door is declared once and called on BOTH early returns as well as at the draw');
  assert.match(rd('src/ui/enhancedStyle.js'), /\.hudstatus \{[^}]*font-family: \$\{PIXEL_STACK\}; -webkit-font-smoothing: none;/,
    'mutants: the strip in --data; the smoothing left on');
});

// ── AUDIT FONT (2026-09-16) - THE FONT1 SLICE AUDITED ────────────────
//
// Thirteen findings against FONT1's own arm. These are the fixes, each
// driven over a fake document through the REAL modules - a HudText, a
// MidScreenText, the sheet as it is actually injected - because the
// failures they close are failures of what the modules DO to a
// document, and a regex over the source could not have seen any of
// them. Each names the mutants it kills (tools/mutants/font1.json).

const CANVAS = { width: 1280, height: 800 };

test('AUDIT FONT F1: two PopupText models, two sets of toasts in ONE stack - a dungeon line survives townTalk\'s empty frame, and both are readable', () => {
  withSkin('enhanced', (clock) => {
    const doc = fakeDocument();
    globalThis.document = doc;
    // The two that are alive at once on ?world inside a dungeon:
    // scenes/dungeonContext.js's (the skill lines, the loot tallies,
    // the door texts, every ctx.hudSay) and scenes/townTalk.js's (the
    // street, and the Ambient Text mod's lines - which are said in a
    // dungeon too, through townTalk.say).
    const dungeon = new HudText('dungeon');
    const town = new HudText('town');
    assert.notEqual(dungeon.key, town.key,
      'mutant: one key for every model - which IS the finding: FONT1 kept the host, the row pool and the last-frame cache as module singletons');

    dungeon.add('You found 25 gold pieces.');
    dungeon.draw(recorder(), CANVAS, null);
    assert.deepEqual(rowsOf(toastsOf(doc, dungeon)), ['You found 25 gold pieces.']);

    // THE FRAME ORDER, verbatim: worldModes' dungeon arm draws the
    // dungeon's rows and returns true, then townTalk.frame draws its
    // own - empty, because the street is not talking - in the same task.
    town.draw(recorder(), CANVAS, null);
    assert.equal(toastsOf(doc, town).length, 0, 'silence still builds nothing');
    assert.deepEqual(rowsOf(toastsOf(doc, dungeon)), ['You found 25 gold pieces.'],
      'mutants: the two models share one key, so townTalk\'s empty draw released every dungeon popup this port has ever spoken');

    // ...and when the street DOES talk, the two stack rather than
    // overwrite: both sets of lines readable, which is the whole point.
    town.add('A dog barks somewhere behind you.');
    town.draw(recorder(), CANVAS, null);
    assert.deepEqual(rowsOf(toastsOf(doc, town)), ['A dog barks somewhere behind you.']);
    assert.deepEqual(rowsOf(toastsOf(doc, dungeon)), ['You found 25 gold pieces.'],
      'mutant: the later model writes the earlier one\'s rows');
    assert.equal(doc.body.children.filter((c) => c.id === ENHANCED_NOTICE_ID).length, 1,
      'one STACK holds both - and the message box too - the place is the document\'s, the rows are each model\'s');
    assert.equal(stackOf(doc).children.length, 2);

    // EVERY ALLOCATION HAS AN OWNER: a dungeon context ends inside a
    // session (scenes/dungeonContext.js destroy), and takes its toasts.
    dungeon.dispose();
    clock.fire(NOTICE_SLIDE_MS);
    assert.equal(toastsOf(doc, dungeon).length, 0, 'mutant: dispose a no-op, so a torn-down context\'s rows outlive it');
    assert.deepEqual(rowsOf(toastsOf(doc, town)), ['A dog barks somewhere behind you.'], 'and it takes only its own');
    town.dispose();
    clock.fire(NOTICE_SLIDE_MS);
    assert.equal(stackOf(doc), null, 'mutant: the stack outlives its last panel');
  });
});

test('AUDIT FONT F2: --hud-scale reaches the mid-screen label - a SIBLING of .hud, not a child of it; the toasts are the box\'s size and take none', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const h = new HudText('town');
    h.add('Your Long Blade skill has improved.');
    h.draw(recorder(), CANVAS, null);
    const label = new MidScreenText();
    label.set('Interaction is now in steal mode.');
    label.draw(recorder(), CANVAS, null);
    const mid = doc.getElementById(ENHANCED_MID_TEXT_ID);
    assert.equal(mid.style['--hud-scale'], undefined, 'nothing has set it yet - the variable is declared on .hud and does not inherit here');
    setEnhancedMidTextScale(2, doc);
    assert.equal(mid.style['--hud-scale'], '2', 'mutants: the mid-screen label left off the scale write, so at hudScale 2 it draws at 1 and at 0.5 it floats');
    assert.equal(stackOf(doc).style['--hud-scale'], undefined,
      'ENH-NOTICE3: the notice stack is the BOX\'s stack, at the box\'s size - a HUD scale of 2 must not double a notice the box beside it draws at 1');
  });
  // ...AND THE HOST BUILT AFTERWARDS GETS IT TOO. enhancedHud writes
  // the scale only when it CHANGES - once at boot - and the label is
  // built on the first line the game says, which may be an hour later.
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    setEnhancedMidTextScale(0.5, doc);          // the boot frame, with nothing built yet
    const label = new MidScreenText();
    label.set('You are too far away.');
    label.draw(recorder(), CANVAS, null);
    assert.equal(doc.getElementById(ENHANCED_MID_TEXT_ID).style['--hud-scale'], '0.5',
      'mutant: the scale not kept, so a label built after the one write draws at 1 under a HUD at 0.5');
  });
  // ...and the one hand that knows the live scale calls it, beside the
  // damage-number layer it already fed for exactly this reason.
  assert.match(rd('src/ui/enhancedHud.js'), /getElementById\('enhanced-hitnums'\)\?\.style\.setProperty\('--hud-scale', String\(scale\)\);[\s\S]{0,400}?setEnhancedMidTextScale\(scale, document\);/,   // AUDIT ENH-NOTICE3 A10: named for the one surface it scales
    'mutant: the propagation dropped out of the scale write, so nothing ever sets it on the label');
});

test('AUDIT FONT F3: the dungeon hosts\' overlay branch takes BOTH DOM surfaces down before it returns', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const hud = new HudText('dungeon');
    hud.add('You found 25 gold pieces.');
    hud.draw(recorder(), CANVAS, null);
    midScreenText._reset();
    midScreenText.set('You are too far away.');
    midScreenText.draw(recorder(), CANVAS, null);
    const toast = toastsOf(doc, hud)[0];
    const mid = doc.getElementById(ENHANCED_MID_TEXT_ID);
    assert.equal(toast.style.display, '');
    assert.equal(mid.style.display, '');
    // The frame a dungeon host runs with a window up: it returns above
    // drawFoes, which is the only place it reaches drawHud, so this is
    // the ONLY call that can ever take these two down on such a frame.
    hideHudTextSurfaces(hud);
    assert.equal(toast.style.display, 'none',
      'mutants: the popup rows left standing over an open dungeon window (and on ?dungeon there is no second model behind them)');
    assert.equal(mid.style.display, 'none',
      'mutants: "You are too far away" left standing over the window that opened under it');
    // The PAINT went; the model did not. PopupText.Update keeps
    // draining under a window and the label keeps its 1.5 s.
    assert.deepEqual(hud.lines.map((l) => l.text), ['You found 25 gold pieces.']);
    assert.equal(midScreenText.text, 'You are too far away.');
    // ...and a door with no popup model still takes the label down (the
    // hosts pass theirs; a future caller that has none must not throw).
    midScreenText.set('back');
    midScreenText.draw(recorder(), CANVAS, null);
    hideHudTextSurfaces();
    assert.equal(mid.style.display, 'none');
    midScreenText._reset();
  });
  // BOTH dungeon hosts say it, ON the branch, BEFORE the return - the
  // branch is an early return and a hide written after it is dead code.
  assert.match(rd('src/scenes/worldModes.js'),
    /if \(dungeonCtx\.uiOverlayActive\) \{ dungeonCtx\.hideHudText\?\.\(\); hideWorldPlaque\(\); dungeonCtx\.tickOverlay\(dt\); host\.drawPeerNames\?\.\(\{ proj, view, eye: mwv\.eye \}\); dungeonCtx\.drawOverlay\(canvas\); return true; \}/,   // AUDIT NAME1 F1 runs the name pass on the same arm, between the clock and the overlay; AUDIT-WH H4 puts the world plaque - a THIRD DOM surface, and the same law - beside the two
    'mutants: the hide door dropped from ?world\'s dungeon arm, or written after the return where nothing runs it');
  const dg = rd('src/scenes/dungeon.js');
  const branch = dg.indexOf('if (ctx.uiOverlayActive) {');
  const hidden = dg.indexOf('ctx.hideHudText?.();', branch);
  const drawn = dg.indexOf('ctx.tickOverlay(dt); ctx.drawOverlay(canvas);', branch);
  // AUDIT-WH H4: the world plaque is the third DOM surface on that line.
  const plaque = dg.indexOf('hideWorldPlaque();', hidden);   // from the hide door, not the branch: L3 puts one on the held-frame return further up too
  assert.ok(plaque > hidden && plaque < drawn, 'mutants: the plaque left standing over an open ?dungeon window');
  assert.ok(branch > 0 && hidden > branch && hidden < drawn,
    'mutants: the hide door dropped from ?dungeon\'s overlay branch, or written after the return where nothing runs it');
  assert.match(rd('src/scenes/dungeonContext.js'), /hideHudText: \(\) => hideHudTextSurfaces\(hudText\),/,
    'mutants: the context\'s door hides one surface and not the other');
});

test('AUDIT FONT F4: a canvas window covers the classic column, so the toasts go while one is up', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const h = new HudText('town');
    h.add('Your Long Blade skill has improved.');
    h.observe(false);
    h.draw(recorder(), CANVAS, null);
    const toast = toastsOf(doc, h)[0];
    assert.deepEqual(rowsOf([toast]), ['Your Long Blade skill has improved.']);
    // The death screen, the rest and save windows, the travel pop-up,
    // the quest journal, every MessageBox and ActionTextBox are drawn
    // on the CANVAS after this column - so on the classic skin they
    // cover it. The notice stack is DOM over all of them.
    h.observe(true);
    h.draw(recorder(), CANVAS, null);
    assert.equal(toast.style.display, 'none',
      'mutants: the covered flag ignored, so the popup lines stand OVER the death screen and every native window');
    assert.deepEqual(h.lines.map((l) => l.text), ['Your Long Blade skill has improved.'],
      'the paint went, the queue did not - PopupText.Update drains under a window');
    h.observe(false);
    h.draw(recorder(), CANVAS, null);
    assert.equal(toast.style.display, '', 'and the window closing brings it back');
  });
  // The classic arm is byte for byte what it was: there the draw ORDER
  // already says it, and a `covered` frame still paints its glyphs
  // under the window exactly as DFU's HUD does.
  withSkin('classic', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const h = new HudText('town');
    h.add('AB');
    const r = recorder();
    h.observe(true);
    h.draw(r, { width: 1920, height: 1080 }, FONT);
    assert.ok(r.quads.length >= 2, 'mutant: the covered gate taken on the classic arm too, which would blank a column DFU draws');
    assert.equal(stackOf(doc), null);
  });
  // ...and every host that owns a model hands its own window slot in.
  const town = rd('src/scenes/townTalk.js');
  // AUDIT ENH-NOTICE3 F3/C2: the question is THE PREVIOUSWINDOW CHAIN,
  // not the slot. DFU paints PopupText as part of the HUD window at the
  // bottom of the stack, and a pushed box paints its previousWindow
  // first (DaggerfallPopupWindow.cs:77-85) - so under a BOX the rows
  // stay and under a window that cuts the chain (the inventory, the
  // rest) they go. Both townTalk sites ask one predicate: this slot's
  // chain (AUDIT 64 F35's hudCovered), the held map's outright hide,
  // and the MODE host's chain - the interior slot this model is drawn
  // under, which `overlay` cannot see.
  assert.equal([...town.matchAll(/hud\.observe\(toastsCovered\(\)\);/g)].length, 2,
    'mutants: townTalk\'s frame - or the interior arm\'s own hudFrame - stops telling the model that a window covers the HUD');
  assert.match(town, /const toastsCovered = \(\) => \(talkPaused\(\) && windows\.hudCovered\(overlay\)\) \|\| hidesHud\(overlay\) \|\| !!otherHudCovered\?\.\(\);/,
    'mutants: the slot asked instead of the chain (a pushed box hides the toasts DFU keeps); the held map\'s hide dropped; the mode host dropped (an interior window never hides them)');
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(rd(h), /otherHudCovered: \(\) => modes\?\.hudCovered \?\? false,/, `${h}: the seam IS the mode machine's previousWindow chain`);
  }
  assert.match(rd('src/scenes/dungeonContext.js'), /hudText\.observe\(!!activeOverlay && \(dungeonWindows\.hudCovered\(activeOverlay\) \|\| hidesHud\(activeOverlay\)\)\);/,
    'mutant: the dungeon asks the slot (its own windowCoversHud asks the chain)');
  assert.match(rd('src/scenes/dungeonContext.js'), /hudText\.observe\(!!activeOverlay && /,
    'mutants: the dungeon\'s frame stops telling it');
  // ...and the model's own draw is back to three arguments: a fourth
  // positional slot on a `draw` in src/ui is the scale's (audit24
  // wave40's sweep), which is why this is a report and not an argument.
  assert.match(rd('src/ui/hudText.js'), /  draw\(renderer, canvas, font\) \{/,
    'mutant: the window slot smuggled into draw\'s argument list, where the sheet\'s forward fills the fourth with a number');
});

test('AUDIT FONT F8: a long line is drawn WHOLE in its toast, and the stack\'s row wraps rather than cuts', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const h = new HudText('town');
    // A TEXT.RSC-length line - the shape a quest or a door text really
    // has. The classic column measures the string and draws all of it.
    const LONG = 'You have been given a letter of introduction to the Knights of the Dragon, and are expected at their hall in Daggerfall before the 15th of Hearthfire.';
    h.add(LONG);
    h.draw(recorder(), CANVAS, null);
    const toast = toastsOf(doc, h)[0];
    assert.deepEqual(rowsOf([toast]), [LONG],
      'mutants: the row truncated in the DOM, so the operative half of a quest line never reaches the player at all');
    assert.equal(bodyOf(toast).children[0].textContent.length, LONG.length);
    // The sheet wraps rather than ellipsising it - the notice row's own
    // rule, which the box's rows already rely on.
    assert.match(ENHANCED_CSS, /\.notice-row \{[^}]*white-space: pre-wrap; overflow-wrap: anywhere;/,
      'mutants: nowrap on the row; the overflow-wrap dropped, so a long unbroken word spills out of the panel');
    assert.doesNotMatch(ENHANCED_CSS, /\.notice-row \{[^}]*text-overflow: ellipsis;/,
      'mutant: an ellipsis on the row, which is what cut the line');
  });
});

test('AUDIT FONT F11: the mid-screen label lands on the CLASSIC label\'s own line, not on a proportion that is right at 16:10 alone', () => {
  // DFU's y=146 of 200 is a NativePanel row, and nativeMetrics FLOORS
  // the fit and centres what is left - so the label's real place is
  // (oy + 146*s), and only at 16:10 does that come out at 73%.
  const at = (w, h) => {
    const m = nativeMetrics({ width: w, height: h });
    return { want: m.oy + 146 * m.s, got: midTextTopPx({ width: w, height: h }, 146) };
  };
  for (const [w, h] of [[1280, 800], [1280, 1024], [1920, 1080], [430, 932]]) {
    const r = at(w, h);
    assert.equal(r.got, r.want, `${w}x${h}: mutants: the label taken off a bare proportion again; the floored scale or the centring dropped`);
  }
  const wide = at(1280, 800), tall = at(1280, 1024);
  assert.ok(Math.abs(wide.want / 800 - 0.73) < 0.01, '16:10 really is 73% - which is why the proportion looked right');
  assert.ok(Math.abs(tall.want / 1024 - 0.73) > 0.04,
    '...and 5:4 is not: the panel is scale 4 with oy 112 there, so 73% put the line four native rows off');
  assert.equal(midTextTopPx(null, 146), null, 'and no canvas leaves the sheet\'s fallback alone');

  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const label = new MidScreenText();
    label.set('You are too far away.');
    label.draw(recorder(), { width: 1280, height: 1024 }, null);
    const node = doc.getElementById(ENHANCED_MID_TEXT_ID);
    assert.equal(node.style['--hudmid-top'], `${at(1280, 1024).want.toFixed(1)}px`,
      'mutants: the label never writes its place, so it keeps the 73% fallback wherever the canvas puts the classic one');
    // The large-HUD lift moves `this.y`, and the label follows it.
    label.observe(1024, 4, 500);   // a bar tall enough to lift the label (:356-365's clamp keeps a SHORT one at 146)
    label.set('You are too far away.');
    label.draw(recorder(), { width: 1280, height: 1024 }, null);
    assert.ok(label.y < 146);
    assert.equal(node.style['--hudmid-top'], `${(nativeMetrics({ width: 1280, height: 1024 }).oy + label.y * 4).toFixed(1)}px`,
      'mutant: the label drawn at the default row while the classic one is lifted off the large HUD');
  });
});

test('AUDIT FONT F12: the teardown\'s doc names callers that exist', () => {
  const s = rd('src/ui/enhancedHudText.js');
  assert.doesNotMatch(s, /the same hand that calls ui\/enhancedHud\.js destroyEnhancedHud/,
    'mutant: the old sentence back - it named a caller that is nowhere in src/, and destroyEnhancedHud has none either');
  // The per-owner teardown a live host really does reach is the
  // toasts' (ENH-NOTICE3), through HudText.dispose.
  assert.match(rd('src/ui/enhancedNotice.js'), /export function releaseEnhancedToasts\(key\)/,
    'the per-owner teardown a live host really does reach');
  assert.match(rd('src/ui/hudText.js'), /dispose\(\) \{\n    if \(typeof document !== 'undefined'\) releaseEnhancedToasts\(this\.key\);/,
    'mutant: dispose no longer reaches it');
  assert.equal([...rd('src/scenes/dungeonContext.js').matchAll(/hudText\.dispose\(\);/g)].length, 1,
    'mutant: the context\'s rows never released, so a torn-down dungeon leaves its toasts on the page');
});

test('ENH-NOTICE3 (AUDIT A1): under the enhanced skin WITH the classic font loaded the bitmap column paints nothing - one face, not two', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const h = new HudText('town');
    h.add('Your Long Blade skill has improved.');
    const r = recorder();
    h.draw(r, CANVAS, FONT);   // the shipping hosts pass the font - every earlier pin passed null
    assert.equal(toastsOf(doc, h).length, 1, 'the toast is up');
    assert.equal(r.quads.length, 0, 'mutant: the enhanced arm\'s return dropped, so the classic glyphs paint under the toasts');
  });
});

test('ENH-NOTICE3 (AUDIT A6-A8): PopupText.AddText\'s delay arithmetic - the waiting timer and the next pop delay take the MAX, and the next pop delay resets after a pop', () => {
  // AddText (PopupText.cs): an empty queue takes the delay outright; a
  // queue still waiting (timer >= 0) takes max(timer, delay); a queue
  // already draining (timer < 0) raises nextPopDelay to max(next,
  // delay). Update: each pop adds nextPopDelay back and resets it to
  // popDelay. Every earlier pin added with the default 1 s, so the
  // whole delay half - the mod's textDisplayTime - was unpinned.
  const h = new HudText();
  h.add('a');                          // empty: timer = 1
  h.add('b', 0.5);                     // waiting: max(1, 0.5) = 1, not 0.5
  assert.equal(h.timer, 1, 'mutant: the waiting timer ASSIGNED (a short line cuts a long one\'s life)');
  h.add('c', 3);                       // waiting: max(1, 3) = 3
  assert.equal(h.timer, 3);
  h.tick(3.5);                         // timer = -0.5: draining, nothing popped yet
  assert.equal(h.lines.length, 3);
  h.add('d', 0.5);                     // draining: nextPopDelay = max(1, 0.5) = 1, not 0.5
  assert.equal(h.nextPopDelay, 1, 'mutant: the next pop delay ASSIGNED');
  h.add('e', 2);                       // draining: nextPopDelay = max(1, 2) = 2
  assert.equal(h.nextPopDelay, 2);
  h.tick(0.6);                         // timer = -1.1 < -1: pop 'a', timer += 2 -> 0.9, next resets to 1
  assert.deepEqual(h.lines.map((l) => l.text), ['b', 'c', 'd', 'e']);
  assert.ok(Math.abs(h.timer - 0.9) < 1e-9, 'the popped row gave back the RAISED delay');
  assert.equal(h.nextPopDelay, HUD_TEXT_POP_DELAY, 'mutant: the next pop delay never reset, so every later row lives the raised life too');
  h.tick(2.0);                         // timer = -1.1: pop 'b', timer += 1 (the reset delay) -> -0.1
  assert.deepEqual(h.lines.map((l) => l.text), ['c', 'd', 'e']);
  assert.ok(Math.abs(h.timer - (-0.1)) < 1e-9, 'mutant: the second pop added the old raised delay');
});

test('ENH-NOTICE3 (AUDIT A1/A6/A9/A10): the sheet - the stack clips what will not fit, the toast keeps its dark, and the media blocks reach a toast\'s row', () => {
  assert.match(ENHANCED_CSS, /\.notice-stack \{[^}]*max-height: 90vh; overflow: hidden;/,
    'mutant: the cap raised or the overflow open, so eight toasts and a box spill the last toast off a 520px screen');
  assert.match(ENHANCED_CSS, /\.notice\.notice-toast \{[^}]*background: rgba\(10,12,17,0\.82\);/,
    'mutant: the toast\'s dark thinned, and the popup\'s yellow stands on the sky');
  // the toast rule (0-2-1) outranks the media blocks\' bare .notice-row
  // (0-1-0), so each block names the toast\'s row too
  assert.match(ENHANCED_CSS, /@media \(max-width: 720px\) \{[^@]*\.notice-row, \.notice\.notice-toast \.notice-row \{ font-size: 13px; \}/,
    'mutant: on a phone the toast stays 14px while the box drops to 13 - the panel merely read set larger than the one to answer');
  assert.match(ENHANCED_CSS, /@media \(max-height: 520px\) \{[^@]*\.notice-row, \.notice\.notice-toast \.notice-row \{ font-size: 13px; line-height: 1\.25; \}/);
});
