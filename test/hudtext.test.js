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
// version"): THE POPUP COLUMN IN THE ENHANCED FACE ───────────────────
//
// The model above is PopupText and stays PopupText: what the skin
// changes is the PAINT. These drive the enhanced arm over a fake
// document (the shape test/soc3_socialpanel.test.js drives its panel
// through, cut to what this renderer touches) and the classic arm over
// a recording renderer, and each pin names the mutants it kills.
import { readFileSync } from 'node:fs';
import { drawEnhancedHudText, drawEnhancedStatusLine, destroyEnhancedHudText, ENHANCED_HUD_TEXT_ID, ENHANCED_MID_TEXT_ID, ENHANCED_STATUS_ID, ENHANCED_HUD_TEXT_ROW_H } from '../src/ui/enhancedHudText.js';
import { MidScreenText, MID_SCREEN_TEXT_DEFAULT_DELAY } from '../src/ui/midScreenText.js';
import { ENHANCED_CSS, HUD_TEXT_ROW_PX, HUD_TEXT_TOP_PX } from '../src/ui/enhancedStyle.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '',
    style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, attrs: {},
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
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
/** The skin, for one test. isEnhanced() reads globalThis.location.search when nothing is passed. */
const withSkin = (skin, fn) => {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  const hadDoc = Object.hasOwn(globalThis, 'document') ? globalThis.document : undefined;
  globalThis.location = { search: `?skin=${skin}` };
  try { return fn(); } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
    if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc;
    destroyEnhancedHudText();
  }
};
const rowsOf = (host) => host.children.filter((c) => c.style.display !== 'none').map((c) => c.textContent);

test('FONT1: HudText.frame is PopupText.Draw as data - the same rows, the same scroll-out, the same off-by-one', () => {
  const h = new HudText();
  assert.deepEqual(h.frame(), { rows: [], slide: 0 }, 'nothing queued, nothing drawn');
  for (let i = 0; i < 3; i++) h.add(`m${i}`);
  assert.deepEqual(h.frame().rows, ['m0', 'm1', 'm2'], 'front first, in the queue\'s order');
  // PopupText.Draw breaks AFTER the row that takes the count past
  // maxRows (`if (++count > maxCount) break`), so a long queue paints
  // maxRows + 1. The classic arm has always done this; the enhanced
  // one must do the same or the two skins show different columns.
  const many = new HudText();
  for (let i = 0; i < 20; i++) many.add(`m${i}`);
  assert.equal(many.frame().rows.length, HUD_TEXT_MAX_ROWS + 1,
    'mutants: rows cut to maxRows (the 8th row vanishes under the enhanced skin alone); the queue drawn whole (20 rows down the screen)');
  // The slide is PopupText's own `timer / popDelay`, and ONLY while the
  // timer is negative - a positive timer is a row waiting, not leaving.
  assert.equal(many.frame().slide, 0, 'mutants: the slide taken from a positive timer, so the column sits low and drifts up as it waits');
  many.tick(HUD_TEXT_POP_DELAY + 0.5);
  assert.ok(Math.abs(many.frame().slide - (many.timer / HUD_TEXT_POP_DELAY)) < 1e-9);
  assert.ok(many.frame().slide < 0, 'the column rides UP as the front row leaves');
});

test('FONT1: under the enhanced skin the column is DOM in the pixel face, updated rather than rebuilt, and it hides on command', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const h = new HudText();
    h.draw(recorder(), { width: 1280, height: 800 }, null);
    assert.equal(doc.getElementById(ENHANCED_HUD_TEXT_ID), null, 'silence builds nothing - a host for no lines is furniture');

    h.add('Your Long Blade skill has improved.');
    h.add('You found 5 gold pieces.');
    // The FONT is null here on purpose: the enhanced column owes the
    // classic bitmap font nothing, and a skin that could not speak
    // without ARENA2's font would be the classic skin wearing a coat.
    h.draw(recorder(), { width: 1280, height: 800 }, null);
    const host = doc.getElementById(ENHANCED_HUD_TEXT_ID);
    assert.ok(host, 'mutants: the enhanced arm dropped, so the lines draw in the 1996 bitmap face (or not at all with no font)');
    assert.equal(host.className, 'hudtext');
    assert.equal(host.attrs['aria-hidden'], 'true', 'a readout, not a reading order - the notebook carries the words');
    assert.deepEqual(rowsOf(host), ['Your Long Blade skill has improved.', 'You found 5 gold pieces.']);
    assert.equal(host.style['--hudtext-slide'], '0.00px', 'at rest the column does not slide');

    // UPDATED, NOT REBUILT: the nodes survive the next frame, and there
    // is still exactly ONE column in the document.
    const first = host.children[0];
    h.draw(recorder(), { width: 1280, height: 800 }, null);
    assert.equal(host.children[0], first, 'mutants: the column rebuilt every frame (PX19k at sixty times a second)');
    assert.equal(doc.body.children.filter((c) => c.id === ENHANCED_HUD_TEXT_ID).length, 1,
      'mutant: a fresh host built every frame, stacking dead columns under the live one');

    // The scroll-out: PopupText's timer, in pixels, off the ONE row
    // height the sheet and the module share. 1.5 s in, the timer is
    // -0.5 and nothing has popped yet (a row leaves at -popDelay).
    h.tick(HUD_TEXT_POP_DELAY + 0.5);
    assert.equal(h.lines.length, 2);
    h.draw(recorder(), { width: 1280, height: 800 }, null);
    assert.equal(host.style['--hudtext-slide'], `${(h.timer * ENHANCED_HUD_TEXT_ROW_H).toFixed(2)}px`);
    assert.ok(parseFloat(host.style['--hudtext-slide']) < 0, 'mutants: the sign flipped (the column falls as a line leaves); the slide never written (no scroll-out at all)');

    // THE HIDE DOOR (AUDIT 64 F37): a DOM column stays painted unless
    // it is told otherwise, and the hosts tell it on the else of the
    // gate they already had.
    h.hide();
    assert.equal(host.style.display, 'none', 'mutants: hide() a no-op, so the last lines stand over a hidden HUD until something else is said');
    assert.deepEqual(h.lines.map((l) => l.text), ['Your Long Blade skill has improved.', 'You found 5 gold pieces.'],
      'and hiding the paint never touches the QUEUE - PopupText.Update keeps draining under a window');
    h.draw(recorder(), { width: 1280, height: 800 }, null);
    assert.equal(host.style.display, '', 'and the next drawn frame brings it back');

    // A ROW THAT POPPED IS GONE FROM THE PAINT. The queue is the
    // model's; the renderer must follow it down as well as up.
    h.tick(HUD_TEXT_POP_DELAY);
    assert.equal(h.lines.length, 1, 'the front row popped (PopupText.Update)');
    h.draw(recorder(), { width: 1280, height: 800 }, null);
    assert.deepEqual(rowsOf(host), ['You found 5 gold pieces.'],
      'mutants: a spent row left on screen (the pool never hides its tail), so the column only ever grows');
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
    assert.equal(doc.getElementById(ENHANCED_HUD_TEXT_ID), null,
      'mutants: the enhanced arm taken unconditionally, so the classic skin grows a DOM column over its own');
    // ...and the classic skin's hide is nothing at all, because the
    // classic column is repainted every frame.
    h.hide();
    assert.equal(doc.getElementById(ENHANCED_HUD_TEXT_ID), null);
    // A font-less classic frame draws nothing rather than throwing.
    const r2 = recorder();
    h.draw(r2, { width: 1920, height: 1080 }, null);
    assert.equal(r2.quads.length, 0);
  });
});

test('FONT1: the enhanced column wears the skin\'s face and stands clear of the compass, in ONE set of numbers', () => {
  const css = ENHANCED_CSS;
  // The face, unsmoothed, with the classic popup's own yellow and its
  // shadow (nativePanel DEFAULT_TEXT_COLOR is rgb(243,239,44)).
  assert.match(css, /\.hudtext \{[^}]*font-family: 'Pixelify Five', 'Pixelify Sans', monospace;[^}]*-webkit-font-smoothing: none;/,
    'mutants: the column left in --data (the launcher face); the smoothing left on, which blurs a pixel glyph');
  assert.match(css, /\.hudtext \{[^}]*color: rgb\(243,239,44\); text-shadow: 2px 2px 0 rgb\(93,77,12\);/);
  assert.match(css, /\.hudtext \{[^}]*pointer-events: none;/, 'a readout takes no clicks');
  // The two numbers are one number: the sheet's row height IS the pixel
  // step the module slides by, and the top is the sheet's too.
  assert.equal(ENHANCED_HUD_TEXT_ROW_H, HUD_TEXT_ROW_PX, 'mutants: the module keeps a row height of its own and the scroll-out slides by the wrong amount');
  assert.match(css, new RegExp(`\\.hudtext-row \\{ height: ${HUD_TEXT_ROW_PX}px; line-height: ${HUD_TEXT_ROW_PX}px;`));
  assert.match(css, new RegExp(`\\.hudtext \\{[^}]*top: ${HUD_TEXT_TOP_PX}px;`));
  // The compass strip is at top 18 and 26 tall, so the column must
  // start below 44 - tools/font1Probe.mjs measures the whole top block
  // (with a named target under the compass) at 82 and this at 96.
  assert.ok(HUD_TEXT_TOP_PX > 44, 'mutants: the column back at the native panel\'s y=4, straight through the compass');
  assert.match(rd('src/ui/enhancedHudText.js'), /import \{ injectEnhancedStyle, injectEnhancedFonts, HUD_TEXT_ROW_PX \} from '\.\/enhancedStyle\.js';/,
    'the renderer reads the sheet\'s number rather than restating it');
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
  assert.match(ENHANCED_CSS, /\.hudmid \{[^}]*top: 73%;/, 'mutant: moved off the classic label\'s proportion, so the line jumps when a player swaps skins');
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
