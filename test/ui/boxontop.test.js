// BOX-ON-TOP (2026-10-25, the in-game check of the Identify refund): a message box pushed over an enhanced window -
// the "Casting Spells" tutorial page over the Identify window - was the top of its host's stack, but the window's DOM
// layer took every click, so the box could not be clicked away (ui/boxClickCatcher.js has the whole account).
//
// These draw real boxes (ActionTextBox, TutorialBox) on the enhanced skin over a fake document, with an enhanced
// window registered as open, and click the layer the box raises.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionTextBox } from '../../src/ui/actionText.js';
import { TutorialBox, INPUT_GRACE_MS, _setTutorialDepsForTests } from '../../src/ui/tutorialPopup.js';
import { BOX_CLICK_CATCHER_CLASS, BOX_CLICK_CATCHER_Z } from '../../src/ui/boxClickCatcher.js';
import { registerOverlay } from '../../src/ui/enhanced/enhancedOverlays.js';
import { makeWindowStack } from '../../src/ui/windowStack.js';
import { destroyEnhancedNotice } from '../../src/ui/enhanced/enhancedNotice.js';
import { createTradeWindow } from '../../src/ui/tradeDoor.js';
import { _frameForTests, DRAW_FRAMES_UNDRAWN } from '../../src/ui/drawWatchdog.js';

function fakeNode(tag) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', listeners: {},
    style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, attrs: {}, blurred: false,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { c.parent = n; const i = n.children.indexOf(ref); if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(type, fn) { (n.listeners[type] ??= []).push(fn); },
    blur() { n.blurred = true; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = {};
  doc.createElement = (tag) => fakeNode(tag);
  doc.head = fakeNode('head'); doc.body = fakeNode('body');
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const FONT = { fnt: { fixedHeight: 9, fixedWidth: 4, glyphWidth: () => 4 }, tex: 'tex:font', cols: 16, rows: 16, cw: 8, ch: 8 };
const CANVAS = { width: 640, height: 400 };
const RENDERER = { drawScreenQuad() {} };
const draw = (box) => box.draw(RENDERER, CANVAS, FONT, 2);
const catcherOf = (doc) => doc.body.children.find((c) => c.className === BOX_CLICK_CATCHER_CLASS) ?? null;
const fire = (node, type) => {
  const e = { type, prevented: false, preventDefault() { e.prevented = true; }, stopPropagation() {} };
  for (const fn of node.listeners[type] ?? []) fn(e);
  return e;
};

/** The enhanced skin, a document, and (unless `overlay` is false) an enhanced window registered as open. */
function withScene(fn, { overlay = true } = {}) {
  const hadLocation = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  const hadDoc = Object.hasOwn(globalThis, 'document') ? globalThis.document : undefined;
  const doc = fakeDocument();
  globalThis.location = { search: '?skin=enhanced' };
  globalThis.document = doc;
  const closeOverlay = overlay ? registerOverlay(() => {}) : () => {};
  const cleanUp = () => {
    closeOverlay();
    if (hadLocation === undefined) delete globalThis.location; else globalThis.location = hadLocation;
    if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc;
    destroyEnhancedNotice();
  };
  let result;
  try { result = fn(doc); } catch (e) { cleanUp(); throw e; }
  if (typeof result?.then === 'function') return result.finally(cleanUp);
  cleanUp();
  return result;
}

test('BOX-ON-TOP: a box drawn over an open enhanced window takes a click anywhere - the layer over the screen hands it to the box, and goes with it', () => {
  withScene((doc) => {
    const button = fakeNode('button');
    doc.activeElement = button;   // the window's own button, focused by the click that opened the box
    const box = new ActionTextBox(['You do not have enough spell points left.']);
    draw(box);
    const layer = catcherOf(doc);
    assert.ok(layer, 'the box raised no layer: the window under it takes every click');
    assert.match(layer.style.cssText, /position:fixed;inset:0/);
    assert.match(layer.style.cssText, new RegExp(`z-index:${BOX_CLICK_CATCHER_Z}`));
    assert.equal(button.blurred, true, 'the covered window keeps the focus, and Enter presses its button');
    draw(box);
    assert.equal(doc.body.children.filter((c) => c.className === BOX_CLICK_CATCHER_CLASS).length, 1, 'one layer a box, however many frames');
    assert.equal(fire(layer, 'click').prevented, true, 'the click is the box\'s alone');
    assert.equal(box.done, true, 'a click anywhere puts the box away');
    assert.equal(catcherOf(doc), null, 'the layer leaves with the box');
  });
});

test('BOX-ON-TOP: the right and the middle buttons close the box too, and the right one opens no menu', () => {
  withScene((doc) => {
    const box = new ActionTextBox(['A line.']);
    draw(box);
    assert.equal(fire(catcherOf(doc), 'contextmenu').prevented, true);
    fire(catcherOf(doc), 'auxclick');
    assert.equal(box.done, true);
  });
});

test('BOX-ON-TOP: the tutorial page over the Identify window - a click once it has stood its grace puts it away', () => {
  let now = 1000;
  _setTutorialDepsForTests({ now: () => now });
  try {
    withScene((doc) => {
      const page = new TutorialBox(['CASTING SPELLS', 'Choose a spell, then aim and cast it.']);
      draw(page);
      const layer = catcherOf(doc);
      assert.ok(layer, 'the page raised no layer');
      fire(layer, 'click');
      assert.equal(page.done, false, 'a click inside the grace is not a reading');
      assert.equal(catcherOf(doc), layer, 'and the page still holds the screen\'s clicks');
      now += INPUT_GRACE_MS;
      draw(page);
      fire(layer, 'click');
      assert.equal(page.done, true, 'the page could not be clicked away');
      assert.equal(catcherOf(doc), null);
    });
  } finally {
    _setTutorialDepsForTests({ now: () => Date.now() });
  }
});

test('BOX-ON-TOP: no layer without an enhanced window open, for a readout that is not modal, or for a box another window covers', () => {
  withScene((doc) => {
    const box = new ActionTextBox(['A line.']);
    draw(box);
    assert.equal(catcherOf(doc), null, 'no enhanced window open: the host hands the canvas\'s clicks to the box');
  }, { overlay: false });
  withScene((doc) => {
    const readout = new ActionTextBox(['Health'], { pauseWhileOpen: false });
    draw(readout);
    assert.equal(catcherOf(doc), null, 'the status readout is no modal box: the window beside it keeps its clicks');
  });
  withScene((doc) => {
    const stack = makeWindowStack();
    const box = new ActionTextBox(['A line.']);
    stack.pushWindow(box);
    draw(box);
    assert.ok(catcherOf(doc), 'on top of its stack, it takes the clicks');
    stack.pushWindow({ draw() {} });
    draw(box);   // townTalk paints the windows a top window covers
    assert.equal(catcherOf(doc), null, 'covered, it answers nothing: the window over it has the clicks');
    box.dispose();
  });
});

test('BOX-ON-TOP: a box replaced takes its layer with it; a box whose draws stop loses it after a frame undrawn', async () => {
  await withScene(async (doc) => {
    const replaced = new ActionTextBox(['A line.']);
    draw(replaced);
    replaced.dispose();
    assert.equal(catcherOf(doc), null, 'a replaced box left its layer over the screen');

    const dropped = new ActionTextBox(['A line.']);
    draw(dropped);
    assert.ok(catcherOf(doc));
    _frameForTests(DRAW_FRAMES_UNDRAWN);
    await new Promise((r) => setTimeout(r, 450));   // the layer's watchdog asks at the notice panel's interval
    assert.equal(catcherOf(doc), null, 'a box a host dropped by hand left a layer taking every click');
    assert.equal(dropped.done, false, 'dropped, not read');
  });
});

test('BOX-ON-TOP: the enhanced counter knows when a box stands over it, so its keys (Enter, Escape) are left to the box', () => {
  withScene(() => {
    const hooks = { entity: {}, mode: 'Identify', items: () => [] };
    const counter = createTradeWindow(hooks);
    assert.ok(counter, 'the enhanced counter was built');
    try {
      const stack = makeWindowStack();
      stack.pushWindow(counter);
      assert.equal(hooks.covered(), false, 'the counter alone keeps its keys');
      const refusal = new ActionTextBox(['You do not have enough spell points left.']);
      stack.pushWindow(refusal);
      assert.equal(hooks.covered(), true, 'under the box, Enter ran the counter\'s action again and Escape closed it');
      stack.popWindow();
      assert.equal(hooks.covered(), false, 'the box gone, the keys are the counter\'s again');
    } finally {
      counter.dispose();
    }
  });
});
