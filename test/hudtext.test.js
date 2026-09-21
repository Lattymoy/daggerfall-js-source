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
import { drawEnhancedHudText, drawEnhancedStatusLine, destroyEnhancedHudText, setEnhancedHudTextScale, midTextTopPx, ENHANCED_HUD_TEXT_ID, ENHANCED_MID_TEXT_ID, ENHANCED_STATUS_ID, ENHANCED_HUD_TEXT_ROW_H } from '../src/ui/enhancedHudText.js';
import { MidScreenText, MID_SCREEN_TEXT_DEFAULT_DELAY, midScreenText } from '../src/ui/midScreenText.js';
import { ENHANCED_CSS, ENHANCED_STYLE_ID, injectEnhancedStyle, HUD_TEXT_ROW_PX, HUD_TEXT_TOP_PX, HUD_TEXT_TOP_NARROW_PX, HUD_TEXT_TOP_CHAT_PX, HUD_TEXT_TOP_CHAT_TOUCH_PX } from '../src/ui/enhancedStyle.js';
import { CHAT_CSS } from '../src/ui/chatPanel.js';
import { CHAT_PEEK } from '../src/net/chat.js';
import { hideHudTextSurfaces } from '../src/ui/hud.js';
import { nativeMetrics } from '../src/ui/nativePanel.js';

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
    // AUDIT FONT F1: the id is the STACK's - one per document - and the
    // column inside it is this model's own (see that finding below).
    const stack = doc.getElementById(ENHANCED_HUD_TEXT_ID);
    assert.ok(stack, 'mutants: the enhanced arm dropped, so the lines draw in the 1996 bitmap face (or not at all with no font)');
    assert.equal(stack.className, 'hudtext-stack');
    assert.equal(stack.attrs['aria-hidden'], 'true', 'a readout, not a reading order - the notebook carries the words');
    const host = stack.children[0];
    assert.equal(host.className, 'hudtext');
    assert.equal(host.dataset.owner, h.key, 'the column is named for the model that draws it');
    assert.deepEqual(rowsOf(host), ['Your Long Blade skill has improved.', 'You found 5 gold pieces.']);
    assert.equal(host.style['--hudtext-slide'], '0.00px', 'at rest the column does not slide');

    // UPDATED, NOT REBUILT: the nodes survive the next frame, and there
    // is still exactly ONE column in the document.
    const first = host.children[0];
    h.draw(recorder(), { width: 1280, height: 800 }, null);
    assert.equal(host.children[0], first, 'mutants: the column rebuilt every frame (PX19k at sixty times a second)');
    assert.equal(doc.body.children.filter((c) => c.id === ENHANCED_HUD_TEXT_ID).length, 1,
      'mutant: a fresh host built every frame, stacking dead columns under the live one');
    assert.equal(stack.children.length, 1, 'and one column for one model');

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
  assert.match(css, /\.hudtext-stack \{[^}]*pointer-events: none;/, 'a readout takes no clicks');
  // The two numbers are one number: the sheet's row height IS the pixel
  // step the module slides by, and the top is the sheet's too.
  assert.equal(ENHANCED_HUD_TEXT_ROW_H, HUD_TEXT_ROW_PX, 'mutants: the module keeps a row height of its own and the scroll-out slides by the wrong amount');
  assert.match(css, new RegExp(`\\.hudtext-row \\{ min-height: ${HUD_TEXT_ROW_PX}px; line-height: ${HUD_TEXT_ROW_PX}px;`));
  assert.match(css, new RegExp(`\\.hudtext-stack \\{[^}]*top: ${HUD_TEXT_TOP_PX}px;`));
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
/** The columns inside the one stack, by the model that owns each. */
const columnOf = (doc, h) => doc.getElementById(ENHANCED_HUD_TEXT_ID)?.children.find((c) => c.dataset.owner === h.key);

test('AUDIT FONT F1: two PopupText models, two columns - a dungeon line survives townTalk\'s empty frame, and both sets are readable', () => {
  withSkin('enhanced', () => {
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
    assert.deepEqual(rowsOf(columnOf(doc, dungeon)), ['You found 25 gold pieces.']);

    // THE FRAME ORDER, verbatim: worldModes' dungeon arm draws the
    // dungeon's column and returns true, then townTalk.frame draws its
    // own - empty, because the street is not talking - in the same task.
    town.draw(recorder(), CANVAS, null);
    assert.equal(columnOf(doc, town), undefined, 'silence still builds nothing');
    assert.equal(columnOf(doc, dungeon).style.display, '',
      'mutants: the two models share one element, so townTalk\'s empty draw hid every dungeon popup this port has ever spoken');
    assert.deepEqual(rowsOf(columnOf(doc, dungeon)), ['You found 25 gold pieces.']);

    // ...and when the street DOES talk, the two stack rather than
    // overwrite: both sets of lines readable, which is the whole point.
    town.add('A dog barks somewhere behind you.');
    town.draw(recorder(), CANVAS, null);
    assert.deepEqual(rowsOf(columnOf(doc, town)), ['A dog barks somewhere behind you.']);
    assert.deepEqual(rowsOf(columnOf(doc, dungeon)), ['You found 25 gold pieces.'],
      'mutant: the later model writes the earlier one\'s rows');
    assert.equal(doc.body.children.filter((c) => c.id === ENHANCED_HUD_TEXT_ID).length, 1,
      'one STACK holds both - the place, the z-index and the scale are the document\'s, the rows are each model\'s');
    assert.equal(doc.getElementById(ENHANCED_HUD_TEXT_ID).children.length, 2);

    // EVERY ALLOCATION HAS AN OWNER: a dungeon context ends inside a
    // session (scenes/dungeonContext.js destroy), and takes its column.
    dungeon.dispose();
    assert.equal(columnOf(doc, dungeon), undefined, 'mutant: dispose a no-op, so a torn-down context\'s column outlives it');
    assert.deepEqual(rowsOf(columnOf(doc, town)), ['A dog barks somewhere behind you.'], 'and it takes only its own');
    town.dispose();
    assert.equal(doc.getElementById(ENHANCED_HUD_TEXT_ID), null, 'mutant: the stack outlives its last column');
  });
});

test('AUDIT FONT F2: --hud-scale reaches the column and the label - they are SIBLINGS of .hud, not children of it', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const h = new HudText('town');
    h.add('Your Long Blade skill has improved.');
    h.draw(recorder(), CANVAS, null);
    const label = new MidScreenText();
    label.set('Interaction is now in steal mode.');
    label.draw(recorder(), CANVAS, null);
    const stack = doc.getElementById(ENHANCED_HUD_TEXT_ID);
    const mid = doc.getElementById(ENHANCED_MID_TEXT_ID);
    assert.equal(stack.style['--hud-scale'], undefined, 'nothing has set it yet - the variable is declared on .hud and does not inherit here');
    setEnhancedHudTextScale(2, doc);
    assert.equal(stack.style['--hud-scale'], '2',
      'mutants: the column left off the scale write, so at hudScale 2 it draws at 1 - straight through the compass block - and at 0.5 it floats');
    assert.equal(mid.style['--hud-scale'], '2', 'mutants: the mid-screen label left off it');
  });
  // ...AND THE HOST BUILT AFTERWARDS GETS IT TOO. enhancedHud writes
  // the scale only when it CHANGES - once at boot - and these hosts are
  // built on the first line the game says, which may be an hour later.
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    setEnhancedHudTextScale(0.5, doc);          // the boot frame, with nothing built yet
    const h = new HudText('town');
    h.add('Your Long Blade skill has improved.');
    h.draw(recorder(), CANVAS, null);
    const label = new MidScreenText();
    label.set('You are too far away.');
    label.draw(recorder(), CANVAS, null);
    assert.equal(doc.getElementById(ENHANCED_HUD_TEXT_ID).style['--hud-scale'], '0.5',
      'mutant: the scale not kept, so a column built after the one write draws at 1 under a HUD at 0.5');
    assert.equal(doc.getElementById(ENHANCED_MID_TEXT_ID).style['--hud-scale'], '0.5',
      'mutant: ...and the label with it');
  });
  // ...and the one hand that knows the live scale calls it, beside the
  // damage-number layer it already fed for exactly this reason.
  assert.match(rd('src/ui/enhancedHud.js'), /getElementById\('enhanced-hitnums'\)\?\.style\.setProperty\('--hud-scale', String\(scale\)\);[\s\S]{0,400}?setEnhancedHudTextScale\(scale, document\);/,
    'mutant: the propagation dropped out of the scale write, so nothing ever sets it on either host');
  // AND THE SLIDE RIDES INSIDE THE SCALE. The scale is on the stack,
  // the translateY on the column within it - so a row leaves by a
  // SCALED row. FONT1 put both on one element with the translate
  // outside the scale, so the scroll-out was always unscaled pixels.
  assert.match(ENHANCED_CSS, /\.hudtext-stack \{[^}]*transform: translateX\(-50%\) scale\(var\(--hud-scale, 1\)\);/);
  assert.match(ENHANCED_CSS, /\.hudtext \{[^}]*transform: translateY\(var\(--hudtext-slide, 0px\)\);/,
    'mutant: the slide back outside the scale, so the scroll-out does not match the rows it is scrolling');
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
    const col = columnOf(doc, hud);
    const mid = doc.getElementById(ENHANCED_MID_TEXT_ID);
    assert.equal(col.style.display, '');
    assert.equal(mid.style.display, '');
    // The frame a dungeon host runs with a window up: it returns above
    // drawFoes, which is the only place it reaches drawHud, so this is
    // the ONLY call that can ever take these two down on such a frame.
    hideHudTextSurfaces(hud);
    assert.equal(col.style.display, 'none',
      'mutants: the popup column left standing over an open dungeon window (and on ?dungeon there is no second column behind it)');
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
    /if \(dungeonCtx\.uiOverlayActive\) \{ dungeonCtx\.hideHudText\?\.\(\); dungeonCtx\.tickOverlay\(dt\); host\.drawPeerNames\?\.\(\{ proj, view, eye: mwv\.eye \}\); dungeonCtx\.drawOverlay\(canvas\); return true; \}/,   // AUDIT NAME1 F1 runs the name pass on the same arm, between the clock and the overlay
    'mutants: the hide door dropped from ?world\'s dungeon arm, or written after the return where nothing runs it');
  const dg = rd('src/scenes/dungeon.js');
  const branch = dg.indexOf('if (ctx.uiOverlayActive) {');
  const hidden = dg.indexOf('ctx.hideHudText?.();', branch);
  const drawn = dg.indexOf('ctx.tickOverlay(dt); ctx.drawOverlay(canvas);', branch);
  assert.ok(branch > 0 && hidden > branch && hidden < drawn,
    'mutants: the hide door dropped from ?dungeon\'s overlay branch, or written after the return where nothing runs it');
  assert.match(rd('src/scenes/dungeonContext.js'), /hideHudText: \(\) => hideHudTextSurfaces\(hudText\),/,
    'mutants: the context\'s door hides one surface and not the other');
});

test('AUDIT FONT F4: a canvas window covers the classic column, so the DOM column goes while one is up', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const h = new HudText('town');
    h.add('Your Long Blade skill has improved.');
    h.observe(false);
    h.draw(recorder(), CANVAS, null);
    const col = columnOf(doc, h);
    assert.deepEqual(rowsOf(col), ['Your Long Blade skill has improved.']);
    // The death screen, the rest and save windows, the travel pop-up,
    // the quest journal, every MessageBox and ActionTextBox are drawn
    // on the CANVAS after this column - so on the classic skin they
    // cover it. The DOM column is at z-index 4 over all of them.
    h.observe(true);
    h.draw(recorder(), CANVAS, null);
    assert.equal(col.style.display, 'none',
      'mutants: the covered flag ignored, so the popup lines stand OVER the death screen and every native window');
    assert.deepEqual(h.lines.map((l) => l.text), ['Your Long Blade skill has improved.'],
      'the paint went, the queue did not - PopupText.Update drains under a window');
    h.observe(false);
    h.draw(recorder(), CANVAS, null);
    assert.equal(col.style.display, '', 'and the window closing brings it back');
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
    assert.equal(doc.getElementById(ENHANCED_HUD_TEXT_ID), null);
  });
  // ...and every host that owns a column hands its own window slot in.
  const town = rd('src/scenes/townTalk.js');
  assert.equal([...town.matchAll(/hud\.observe\(!!overlay\);/g)].length, 2,
    'mutants: townTalk\'s frame - or the interior arm\'s own hudFrame - stops telling the column that a window is up');
  assert.match(rd('src/scenes/dungeonContext.js'), /hudText\.observe\(!!activeOverlay\);/,
    'mutants: the dungeon\'s frame stops telling it');
  // ...and the model's own draw is back to three arguments: a fourth
  // positional slot on a `draw` in src/ui is the scale's (audit24
  // wave40's sweep), which is why this is a report and not an argument.
  assert.match(rd('src/ui/hudText.js'), /  draw\(renderer, canvas, font\) \{/,
    'mutant: the window slot smuggled into draw\'s argument list, where the sheet\'s forward fills the fourth with a number');
});

test('AUDIT FONT F7: the column steps out of the chat\'s peek where the chat is mounted, and the numbers are the chat sheet\'s own', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    // The sheet as it is really injected, not a string read off the
    // module: one <style> in the head, carrying the rule.
    const h = new HudText('town');
    h.add('Your Long Blade skill has improved.');
    h.draw(recorder(), CANVAS, null);
    const sheet = doc.getElementById(ENHANCED_STYLE_ID);
    assert.ok(sheet, 'the module injects its sheet on the first line it paints');
    assert.match(sheet.textContent, new RegExp(`body:has\\(\\.dfchat\\) \\.hudtext-stack \\{ top: ${HUD_TEXT_TOP_CHAT_PX}px; \\}`),
      'mutants: the offset dropped, so the column sits inside the chat peek - .dfchat is z-index 5 over it and on a 430px phone the two boxes are the same box');
    assert.match(sheet.textContent, new RegExp(`body:has\\(\\.dfchat\\.touch\\) \\.hudtext-stack \\{ top: ${HUD_TEXT_TOP_CHAT_TOUCH_PX}px; \\}`),
      'mutant: the touch skin\'s own chat top (72, not 44) forgotten');
  });
  // The numbers are DERIVED from the chat's sheet, so a chat that moves
  // reddens this rather than quietly sliding under the column again.
  const chatTop = Number(/\.dfchat \{[^}]*top: calc\((\d+)px/.exec(CHAT_CSS)[1]);
  const chatTouchTop = Number(/\.dfchat\.touch \{ top: calc\((\d+)px/.exec(CHAT_CSS)[1]);
  const line = /\.dfchat-line \{[^}]*font-size: (\d+)px; line-height: ([\d.]+);/.exec(CHAT_CSS);
  const gap = Number(/\.dfchat-peek \{[^}]*gap: (\d+)px;/.exec(CHAT_CSS)[1]);
  // A peek line wraps in .dfchat's 440px box - tools/font1Probe.mjs
  // measures the real panel at 248.5 (292.5 touch) and that is two
  // rows a line, so the floor here is the two-row peek.
  const peekH = CHAT_PEEK * 2 * Number(line[1]) * Number(line[2]) + (CHAT_PEEK - 1) * gap;
  assert.ok(HUD_TEXT_TOP_CHAT_PX >= chatTop + peekH,
    `mutant: the offset stops clearing the peek (${HUD_TEXT_TOP_CHAT_PX} against ${chatTop} + ${peekH.toFixed(1)})`);
  assert.ok(HUD_TEXT_TOP_CHAT_TOUCH_PX >= chatTouchTop + peekH,
    'mutant: the touch offset stops clearing the peek');
  assert.ok(HUD_TEXT_TOP_CHAT_PX > HUD_TEXT_TOP_PX && HUD_TEXT_TOP_CHAT_TOUCH_PX > HUD_TEXT_TOP_CHAT_PX,
    'the compass clearance is a FLOOR - the chat only ever pushes the column further down');
});

test('AUDIT FONT F8: a long line is drawn WHOLE, and the scroll-out is measured off the row it is scrolling', () => {
  withSkin('enhanced', () => {
    const doc = fakeDocument();
    globalThis.document = doc;
    const h = new HudText('town');
    // A TEXT.RSC-length line - the shape a quest or a door text really
    // has. The classic column measures the string and draws all of it.
    const LONG = 'You have been given a letter of introduction to the Knights of the Dragon, and are expected at their hall in Daggerfall before the 15th of Hearthfire.';
    h.add(LONG);
    h.draw(recorder(), CANVAS, null);
    const col = columnOf(doc, h);
    assert.deepEqual(rowsOf(col), [LONG],
      'mutants: the row truncated in the DOM, so the operative half of a quest line never reaches the player at all');
    assert.equal(col.children[0].textContent.length, LONG.length);
    // The sheet wraps rather than ellipsising it.
    assert.match(ENHANCED_CSS, /\.hudtext-row \{[^}]*white-space: normal; overflow-wrap: anywhere;/,
      'mutants: nowrap back on the row; the overflow-wrap dropped, so a long unbroken word spills out of the column');
    assert.doesNotMatch(ENHANCED_CSS, /\.hudtext-row \{[^}]*text-overflow: ellipsis;/,
      'mutant: the ellipsis back, which is what cut the line');
    assert.match(ENHANCED_CSS, new RegExp(`\\.hudtext-row \\{ min-height: ${HUD_TEXT_ROW_PX}px;`),
      'mutant: a fixed height back on a row that now wraps, so the second line draws outside its own box');

    // ...and the slide is honest about that row's REAL height. A row
    // that wrapped to two lines and scrolled out by one row's worth
    // would jump; the module measures the front row and falls back to
    // the sheet's minimum for a row that has never been laid out.
    h.tick(HUD_TEXT_POP_DELAY + 0.5);
    col.children[0].offsetHeight = 44;          // what a two-line row measures
    h.draw(recorder(), CANVAS, null);
    assert.equal(col.style['--hudtext-slide'], `${(h.timer * 44).toFixed(2)}px`,
      'mutants: the slide taken off the constant while the row is taller, so a wrapped line leaves by half of itself');
    delete col.children[0].offsetHeight;
    h.draw(recorder(), CANVAS, null);
    assert.equal(col.style['--hudtext-slide'], `${(h.timer * ENHANCED_HUD_TEXT_ROW_H).toFixed(2)}px`,
      'mutant: no fallback, so a row with no layout yet slides by NaN and the column vanishes');
  });
});

test('AUDIT FONT F9: the narrow top is an export the sheet interpolates, like its wide sibling', () => {
  assert.equal(typeof HUD_TEXT_TOP_NARROW_PX, 'number');
  assert.ok(HUD_TEXT_TOP_NARROW_PX < HUD_TEXT_TOP_PX,
    'the compass block moves UP under 860px (.hud-top 18 -> 10), so the column follows it');
  assert.match(ENHANCED_CSS, new RegExp(`@media \\(max-width: 860px\\) \\{[\\s\\S]*?\\.hudtext-stack \\{ top: ${HUD_TEXT_TOP_NARROW_PX}px; \\}`),
    'mutants: the narrow top back as a literal, so a slice that moves the compass moves one of the two numbers and not the other');
  assert.doesNotMatch(rd('src/ui/enhancedStyle.js'), /\.hudtext-stack \{ top: 82px; \}/,
    'mutant: the literal restored beside the export');
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
  assert.match(s, /export function releaseEnhancedHudText\(key\)/,
    'the per-owner teardown a live host really does reach');
  assert.equal([...rd('src/scenes/dungeonContext.js').matchAll(/hudText\.dispose\(\);/g)].length, 1,
    'mutant: the context\'s column never released, so a torn-down dungeon leaves its column on the page');
});
