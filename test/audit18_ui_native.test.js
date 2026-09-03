// AUDIT 18, lane ui-native. Every pin here drives the real draw
// function with a RECORDING renderer (the lane's missed-item: drawHud
// and NativeTalkWindow.draw both take `renderer` as their first
// argument and no test had ever passed one, so every geometry defect
// in this lane was invisible to the suite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { FntFile } from '../src/formats/fntFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { measureText, drawText, spaceGlyphWidth, makeFont } from '../src/ui/text.js';
import {
  drawHud, hudScale, HUD_BORDER, HUD_NATIVE_BAR_WIDTH, HUD_BAR_STRIDE,
  BREATH_BAR_LEFT, BREATH_BAR_BOTTOM, BREATH_BAR_WIDTH,
} from '../src/ui/hud.js';
import { HudText, HUD_TEXT_MAX_ROWS, HUD_TEXT_TOP, HUD_TEXT_SPACING, HUD_TEXT_POP_DELAY } from '../src/ui/hudText.js';
import {
  NativeTalkWindow, TALK_RECTS, TALK_TOGGLE_COLOR, TOPIC_ARROW_SCROLL, TOPIC_ROW_H,
  ROW_H, ROW_SPACING, layoutPixelRows, conversationScroll, clampScrollPixels,
  preloadTalkArt, talkArtLoaded,
} from '../src/ui/nativeTalk.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { CharSheet, CHARSHEET_RECTS, STATS_ROLLOUT_SELECT, statDescriptionTextId } from '../src/ui/charsheet.js';
import { NativeInventoryWindow } from '../src/ui/nativeInventory.js';   // U26: the keyed window is deleted
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
import { actionOf, setBindings } from '../src/ui/input.js';
import { createBindings, resetDefaults } from '../src/systems/inputActions.js';
import { equipItem, equipTableOf, EQUIP_SLOTS } from '../src/systems/equip.js';
import { wrapText } from '../src/ui/talkWindow.js';
import { nativeMetrics } from '../src/ui/nativePanel.js';
import { preloadPaperDollArt, paperDollArtLoaded, refreshPaperDoll, slotAtPaperDoll, _debugPaperDoll } from '../src/ui/paperDoll.js';
import { TextureFile } from '../src/formats/textureFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

/** A renderer that records every drawScreenQuad rect + colour. */
function recorder() {
  const quads = [];
  return {
    quads,
    uploadTexture: (g, name) => `tex:${name}`,
    releaseTexture: () => {},
    drawScreenQuad: (tex, rect, uv, color) => quads.push({ tex, ...rect, uv, color }),
  };
}
const realFont = () => new FntFile().load(new Uint8Array(readFileSync(join(ARENA2, 'FONT0003.FNT'))));

/** A recorder with TALK01I0.IMG loaded into the module art cache. */
async function talkRenderer() {
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const r = recorder();
  await preloadTalkArt({ renderer: r, palette, fetchBytes: async (n) => new Uint8Array(readFileSync(join(ARENA2, n))) });
  assert.ok(talkArtLoaded(), 'TALK01I0.IMG');
  r.quads.length = 0;
  return r;
}

// ---------------------------------------------------------------
// F1  Space glyph width + the trailing glyph spacing
// ---------------------------------------------------------------
test('audit18 ui-native F1: the space glyph is FixedWidth - 1 and measureText keeps the trailing spacing', { skip: skipReal }, () => {
  const f = realFont();
  assert.equal(f.fixedWidth, 5, 'FONT0003 header');
  assert.equal(f.fixedHeight, 7);
  // DaggerfallFont.CreateSpaceGlyph: glyph.width = FixedWidth - 1
  assert.equal(spaceGlyphWidth(f), 4);
  // CalculateTextWidth accumulates GetGlyphWidth(code) + GlyphSpacing
  // for EVERY glyph, trailing spacing included. Strings with 0 and
  // with 3 spaces are the only ones that separate the two laws - a
  // one-space string measures the same either way.
  assert.equal(measureText(f, 'HELLO'), 25);            // was 24 (no space, trailing trim)
  assert.equal(measureText(f, 'a b c d'), 36);          // was 38 (3 spaces at 6 px)
  assert.equal(measureText(f, '  '), 10);               // was 11
  assert.equal(measureText(f, 'Uthar the Blacksmith'), 95);
  assert.equal(measureText(f, ''), 0);
  // A space advances exactly 5 px: (FixedWidth - 1) + GlyphSpacing.
  assert.equal(measureText(f, 'A A') - measureText(f, 'AA'), 5);
});

test('audit18 ui-native F1b (corrected by AUDIT 23): the DRAWN space omits GlyphSpacing', { skip: skipReal }, () => {
  // DaggerfallFont.cs:318-329: a non-space advances rect.width +
  // GlyphSpacing; the SPACE arm advances rect.width ALONE - while
  // CalculateTextWidth (:381 GetGlyphWidth) adds the spacing for
  // every code, space included. The asymmetry is DFU's; this pin
  // originally encoded draw == measure, which DFU does not have
  // (AUDIT 23 ui-native-5 re-read the source).
  const r = recorder();
  const font = makeFont(r, realFont(), 'FONT0003');
  drawText(r, font, 'A A', 0, 0, 1);
  const xs = r.quads.map((q) => q.x);
  assert.equal(xs.length, 2, 'the space draws no quad');
  const aw = font.fnt.glyphWidth('A'.charCodeAt(0) - 33);
  assert.equal(xs[0], 0);
  assert.equal(xs[1], aw + 1 + 4, 'A + spacing + space(4), NO spacing after the space');
  // the drawn advance is one GlyphSpacing SHORT of the measured width
  // per space - the two metrics deliberately disagree.
  const r2 = recorder();
  const f2 = makeFont(r2, realFont(), 'FONT0003');
  assert.equal(measureText(f2.fnt, 'a b c d') - drawText(r2, f2, 'a b c d', 0, 0, 1), 3);
});

// ---------------------------------------------------------------
// F2  HUD vitals: 8 native-px stride, 10 SCREEN-px border
// F3  Compass sits FLUSH in the bottom-right corner
// F4  Breath bar left-anchored at 10 + 306*S, bottom screenH + 10 - 92*S
// ---------------------------------------------------------------
const hudArt = () => {
  const bar = (n) => ({ tex: `tex:${n}`, w: 4, h: 32 });
  return {
    health: bar('MAIN03I0'), fatigue: bar('MAIN04I0'), magicka: bar('MAIN05I0'),
    compass: { tex: 'tex:COMPASS', w: 258 + 64, h: 17 },
    compassBox: { tex: 'tex:COMPBOX', w: 69, h: 17 },
    breathNormal: { tex: 'tex:breath-normal', w: 1, h: 1 },
    breathShort: { tex: 'tex:breath-short', w: 1, h: 1 },
  };
};
const vitalsFull = {
  health: 50, maxHealth: 50, magicka: 20, maxMagicka: 20, fatigue: 6400,
  stats: { strength: 50, endurance: 50 },
};

test('audit18 ui-native F2/F3/F4: drawHud lays out verbatim HUDVitals/HUDCompass/HUDBreathBar geometry', () => {
  const canvas = { width: 1280, height: 800 };
  const s = hudScale(canvas.width, canvas.height);
  assert.equal(s, 4);
  const r = recorder();
  drawHud(r, canvas, hudArt(), { ...vitalsFull, currentBreath: 12 }, 0);
  const q = r.quads;
  // VB1: with EnableVitalsIndicators shipping TRUE the vitals are NINE
  // quads in Components.Add order (HUDVitals.cs:108-119) - three loss
  // trails (solid colour, tex null), three gain bars, then the three
  // art-filled mains on top. The geometry law this pin owns rides the
  // MAIN bars, same as it always did.
  assert.deepEqual(q.slice(0, 6).map((b) => b.tex), [null, null, null, null, null, null],
    'the six indicator bars draw BEHIND the mains');
  const bars = q.slice(6, 9);
  assert.deepEqual(bars.map((b) => b.tex), ['tex:MAIN03I0', 'tex:MAIN04I0', 'tex:MAIN05I0']);
  // PositionIndicators: barWidth = nativeBarWidth * Scale.x, offsets
  // 0 / barWidth*2 / barWidth*4 -> a stride of 8 native px.
  assert.equal(HUD_NATIVE_BAR_WIDTH, 4);
  assert.equal(HUD_BAR_STRIDE, 8);
  assert.deepEqual(bars.map((b) => b.x), [10, 10 + 32, 10 + 64]);
  // the border margin is 10 SCREEN px at every scale (parentScale = 1)
  assert.deepEqual(bars.map((b) => b.y + b.h), [790, 790, 790]);
  assert.deepEqual(bars.map((b) => b.w), [16, 16, 16]);
  // breath bar: HUDBreathBar's already-scaled 306 / -92 offsets over a
  // zero-size bottom-aligned panel whose 10 px margin is unscaled.
  const breath = q.find((x) => String(x.tex).startsWith('tex:breath'));
  assert.equal(BREATH_BAR_LEFT, 306);
  assert.equal(BREATH_BAR_BOTTOM, 92);
  assert.equal(breath.x, 10 + 306 * 4);              // 1234
  assert.equal(breath.y + breath.h, 800 + 10 - 92 * 4);   // 442
  assert.equal(breath.w, BREATH_BAR_WIDTH * 4);
  // compass: DaggerfallHUD positions COMPBOX flush at the viewport's
  // bottom-right; HUDCompass never calls SetMargins.
  const box = q.find((x) => x.tex === 'tex:COMPBOX');
  assert.equal(box.x, 1280 - 69 * 4);
  assert.equal(box.y, 800 - 17 * 4);
  assert.equal(box.x + box.w, 1280);
  assert.equal(box.y + box.h, 800);
  assert.equal(HUD_BORDER, 10);
});

test('audit18 ui-native F2b: the border does NOT scale with the HUD scale', () => {
  // The same 10 px inset at s=1 and s=4 is the whole point: a scaled
  // border put the health bar at x=40 on a 1280x800 canvas.
  for (const canvas of [{ width: 320, height: 200 }, { width: 1280, height: 800 }]) {
    const r = recorder();
    drawHud(r, canvas, hudArt(), vitalsFull, 0);
    assert.equal(r.quads[0].x, 10, `x at ${canvas.width}`);
    assert.equal(r.quads[0].y + r.quads[0].h, canvas.height - 10, `bottom at ${canvas.width}`);
  }
});

// ---------------------------------------------------------------
// F5  HUD popup text is TOP-anchored in the native panel, 7 rows
// ---------------------------------------------------------------
test('audit18 ui-native F5: PopupText draws from y=4 at the TOP of the native panel, centred', { skip: skipReal }, () => {
  const canvas = { width: 1280, height: 800 };
  const r = recorder();
  const font = makeFont(r, realFont(), 'FONT0003');
  r.quads.length = 0;
  const h = new HudText();
  h.add('one'); h.add('two'); h.add('three');
  h.draw(r, canvas, font);
  const m = nativeMetrics(canvas);
  assert.deepEqual([m.s, m.ox, m.oy], [4, 0, 0]);
  // Row tops: native 4, 4+8, 4+16 (TextHeight 7 + textSpacing 1).
  assert.equal(HUD_TEXT_TOP, 4);
  assert.equal(HUD_TEXT_SPACING, 1);
  const tops = [...new Set(r.quads.map((q) => q.y))].sort((a, b) => a - b);
  assert.deepEqual(tops, [16, 48, 80]);
  // and every row centres on the 320-wide panel, not on the canvas
  // bottom band: leftmost quad of row 0 == (320 - width)/2 * s.
  const row0 = r.quads.filter((q) => q.y === 16);
  assert.equal(Math.min(...row0.map((q) => q.x)), Math.floor((320 - measureText(font.fnt, 'one')) / 2 * 4));
});

test('audit18 ui-native F5b: PopupText.maxRows is 7 and AddText never trims the queue', () => {
  const h = new HudText();
  for (let i = 0; i < 9; i++) h.add(`m${i}`);
  assert.equal(HUD_TEXT_MAX_ROWS, 7);
  assert.equal(h.lines.length, 9, 'AddText queues unconditionally');
  // the timer, not the add, retires rows - and it takes 2*popDelay
  // before the first one goes (rubberbanded here, 2 rows late)
  h.tick(0.1);
  assert.equal(h.lines.length, 9);
  assert.equal(h.timer, HUD_TEXT_POP_DELAY - 0.1 * (1 + 0.8 * 2));
});

// ---------------------------------------------------------------
// F6  Talk conversation top-anchors while it is shorter than 126 px
// F7  Topic arrows scroll 5 PIXELS
// ---------------------------------------------------------------
test('audit18 ui-native F6: the conversation lays out FORWARD from the listbox origin', () => {
  // UpdateScrollBarConversation: ScrollIndex = HeightContent - Size.y,
  // floored at 0 by VerticalScrollBar.SetScrollIndex.
  assert.equal(conversationScroll(14, 126), 0, 'a 2-row greeting scrolls 0');
  assert.equal(conversationScroll(200, 126), 74);
  const short = layoutPixelRows([14], conversationScroll(14, 126), 126, ROW_SPACING);
  assert.deepEqual(short, [{ index: 0, y: 0 }], 'the first row sits at the panel TOP');
  // 30 single-line entries: content 30*7 + 29*4 = 326 -> scroll 200,
  // and the LAST row's top lands at 126 - 7.
  const heights = new Array(30).fill(ROW_H);
  const contentH = 30 * ROW_H + 29 * ROW_SPACING;
  assert.equal(contentH, 326);
  const scroll = conversationScroll(contentH, 126);
  assert.equal(scroll, 200);
  const laid = layoutPixelRows(heights, scroll, 126, ROW_SPACING);
  assert.equal(laid.at(-1).index, 29);
  assert.equal(laid.at(-1).y, 126 - ROW_H);
  assert.ok(laid[0].y < 0, 'the top row is clipped, not dropped');
});

test('audit18 ui-native F7: the topic arrows move the PIXEL scroll index by 5', () => {
  assert.equal(TOPIC_ARROW_SCROLL, 5);
  const w = new NativeTalkWindow('Yes?', {
    categories: () => Array.from({ length: 20 }, (_, i) => ({ label: `t${i}`, buildings: [] })),
    answer: () => '', tone: () => 1, setTone: () => {}, onClose: () => {},
  });
  w.click(10, 15);                        // Where is -> 20 topics
  assert.equal(w.topics.length, 20);
  w.click(105, 165);                      // topicDown (102,161,9,16)
  assert.equal(w.scroll, 5, 'five PIXELS, not fifteen rows');
  // row 0 is only clipped, so the first digit accelerator still picks it
  w._pick(0);
  assert.equal(w.topicMode, 'buildings');
  // the clamp is VerticalScrollBar.SetScrollIndex's [0, total-display]
  const contentH = 20 * TOPIC_ROW_H;
  assert.equal(clampScrollPixels(9999, contentH, 104), contentH - 104);
  assert.equal(clampScrollPixels(-9999, contentH, 104), 0);
  assert.equal(clampScrollPixels(5, 7 * TOPIC_ROW_H, 104), 0, 'content shorter than the panel never scrolls');
});

test('audit18 ui-native F7b: the topic hit test reads scrollIndex + clickY', () => {
  const w = new NativeTalkWindow('Yes?', {
    categories: () => Array.from({ length: 20 }, (_, i) => ({ label: `t${i}`, buildings: [{ label: `b${i}` }] })),
    answer: (b) => `${b.label}!`, tone: () => 1, setTone: () => {}, onClose: () => {},
  });
  w.click(10, 15);
  w.scroll = 21;                          // three rows off the top
  // ROAD-D D10: two presses, because MouseDoubleClick is what descends
  w.click(10, 71, false, 1000);           // the very top of the list band
  w.click(10, 71, false, 1100);
  assert.equal(w.topicMode, 'buildings');
  assert.equal(w.topics[0].label, 'b3', 'ListBox.MouseClick: floor((21 + 0) / 7) = 3');
});

// ---------------------------------------------------------------
// F8  Tone marker is a 6x6 toggleColor fill on the rect itself
// F9  Listbox rows draw AT the listbox origin (the shadow takes +1)
// F10 The conversation wraps at the listbox width (114), not 112
// ---------------------------------------------------------------
test('audit18 ui-native F8/F9: the talk window draws panelTone and its listboxes verbatim', { skip: skipReal }, async () => {
  const r = await talkRenderer();
  const font = makeFont(r, realFont(), 'FONT0003');
  const w = new NativeTalkWindow('Yes?', {
    categories: () => [{ label: 'Taverns', buildings: [] }],
    answer: () => '', tone: () => 1, setTone: () => {}, onClose: () => {}, npcName: '',
  });
  w.click(10, 15);                        // one topic row
  r.quads.length = 0;
  w.draw(r, { width: 320, height: 200 }, font);   // s = 1, ox = oy = 0

  // panelTone: a solid 6x6 toggleColor fill AT toneNormal (258,28).
  const solids = r.quads.filter((q) => q.tex === null && q.w === 6 && q.h === 6);
  assert.equal(solids.length, 1);
  assert.deepEqual([solids[0].x, solids[0].y, solids[0].w, solids[0].h], [258, 28, 6, 6]);
  assert.deepEqual(solids[0].color, TALK_TOGGLE_COLOR);
  assert.deepEqual(TALK_TOGGLE_COLOR.map((v) => Math.round(v * 255)), [162, 36, 12, 255]);

  // ListBox.Draw sets label.Position = (0, -scrollIndex) INSIDE the
  // listbox rect, and TextLabel puts the shadow at +1,+1. So the
  // topic row's TEXT starts at (6,71) and its shadow at (7,72); the
  // conversation's greeting at (189,65) / (190,66).
  const glyphs = r.quads.filter((q) => q.tex === 'tex:FONT0003');
  const leftmostAt = (y) => Math.min(...glyphs.filter((g) => g.y === y).map((g) => g.x));
  assert.equal(leftmostAt(71), TALK_RECTS.topicList[0]);
  assert.equal(leftmostAt(72), TALK_RECTS.topicList[0] + 1);
  assert.equal(leftmostAt(65), TALK_RECTS.conversation[0]);
  assert.equal(leftmostAt(66), TALK_RECTS.conversation[0] + 1);
});

test('audit18 ui-native F10: the conversation wraps at ListBox MaxWidth = Size.x (114)', { skip: skipReal }, () => {
  const f = realFont();
  assert.equal(TALK_RECTS.conversation[2], 114, 'listboxConversation.Size.x');
  // Find a two-word run measuring 113 or 114 px under the corrected
  // metric: it stays on ONE line at MaxWidth 114 and splits at 112.
  let probe = null;
  for (let a = 1; a < 60 && !probe; a++) {
    for (let b = 1; b < 60; b++) {
      const s = `${'i'.repeat(a)} ${'i'.repeat(b)}`;
      const w = measureText(f, s);
      if (w === 113 || w === 114) { probe = s; break; }
      if (w > 114) break;
    }
  }
  assert.ok(probe, 'a 113/114 px probe exists');
  assert.equal(wrapText(f, probe, 114).length, 1, 'MaxWidth 114 keeps it on one line');
  assert.equal(wrapText(f, probe, 112).length, 2, 'the old 114-2 width split it');
});

test('audit18 ui-native F10b: the WINDOW wraps its conversation at 114, not 112', { skip: skipReal }, async () => {
  const f = realFont();
  let probe = null;
  for (let a = 1; a < 60 && !probe; a++) {
    for (let b = 1; b < 60; b++) {
      const t = `${'i'.repeat(a)} ${'i'.repeat(b)}`;
      const w = measureText(f, t);
      if (w === 113 || w === 114) { probe = t; break; }
      if (w > 114) break;
    }
  }
  const r = await talkRenderer();
  const font = makeFont(r, f, 'FONT0003');
  const w = new NativeTalkWindow(probe, {
    categories: () => [], answer: () => '', tone: () => 0, setTone: () => {}, onClose: () => {}, npcName: '',
  });
  r.quads.length = 0;
  w.draw(r, { width: 320, height: 200 }, font);
  const convRows = [...new Set(r.quads
    .filter((q) => q.tex === 'tex:FONT0003' && q.x >= TALK_RECTS.conversation[0])
    .map((q) => q.y))].sort((a, b) => a - b);
  // one wrapped line -> exactly two y values: the text row and its
  // +1 shadow. A 112 px MaxWidth splits it and adds two more.
  assert.deepEqual(convRows, [TALK_RECTS.conversation[1], TALK_RECTS.conversation[1] + 1]);
});

// ---------------------------------------------------------------
// F11  Trade window keyboard scroll clamps at both ends
// ---------------------------------------------------------------
test('audit18 ui-native F11: KeyN cannot drive the shelf list off its end', () => {
  const shelf = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
  const w = new NativeTradeWindow({
    mode: 'Buy', shelfItems: () => shelf, packItems: () => [],
    priceCtx: () => ({ quality: 10, skills: {} }), gold: () => 100,
    rows: () => [], icons: {}, entity: {},
  });
  for (let i = 0; i < 10; i++) w.input('KeyN');
  assert.equal(w.remoteScroll, 0, '3 items, 4 slots -> max scroll 0');
  // U40: the slot resolves into the BASKET now rather than into a
  // purchase, but the clamp is the same law and the same defect - an
  // unclamped KeyN leaves slot 0 pointing past the end of the list.
  w._pickRemote(0);
  assert.deepEqual(w.basket.map((i) => i.name), ['a'], 'the visible slot still resolves');
  // a longer shelf clamps at len - LIST_SLOTS, and KeyP floors at 0
  const long = Array.from({ length: 9 }, (_, i) => ({ name: `i${i}` }));
  shelf.length = 0; shelf.push(...long);
  for (let i = 0; i < 20; i++) w.input('KeyN');
  assert.equal(w.remoteScroll, 5);
  for (let i = 0; i < 20; i++) w.input('KeyP');
  assert.equal(w.remoteScroll, 0);
});

// ---------------------------------------------------------------
// F12  The native character sheet answers clicks
// ---------------------------------------------------------------
test('audit18 ui-native F12: CharSheet.click - the exit button closes, every DFU rect is consumed', () => {
  const e = { name: 'Uthar', stats: {}, skills: {}, items: [] };
  const s = new CharSheet(e);
  assert.equal(typeof s.click, 'function', 'the window must expose click() or the host grabs pointer lock');
  // exit (50,179,39,19)
  assert.deepEqual([...CHARSHEET_RECTS.exit], [50, 179, 39, 19]);
  assert.ok(s.click(55, 185));
  assert.ok(s.done);
  // the four skill buttons page the sheet, same as keys 1-4
  const s2 = new CharSheet(e);
  assert.ok(s2.click(20, 110));      // primary (11,106,115,8)
  assert.equal(s2.page, 1);
  assert.ok(s2.click(20, 140));      // misc (11,136,115,8)
  assert.equal(s2.page, 4);
  assert.ok(!s2.done, 'a skill click never closes the sheet');
  // every other DFU button rect is consumed (return true) so the click
  // cannot fall through to requestLook
  for (const [name, rect] of Object.entries(CHARSHEET_RECTS)) {
    assert.ok(new CharSheet(e).click(rect[0] + 1, rect[1] + 1), `${name} consumed`);
  }
  // and a point on no button is NOT consumed
  assert.equal(new CharSheet(e).click(300, 195), false);

  // AUDIT 54: THE EIGHT ATTRIBUTE POPUP BUTTONS. DFU lays
  // `(141, 6 + 24*i, 28, 20)` over the stat column
  // (DaggerfallCharacterSheetWindow.cs:209-216) and
  // StatButton_OnMouseClick's NOT-levelling arm (:925-936) plays
  // ButtonClick and pops the stat's TEXT.RSC description
  // (GetStatDescriptionTextID -> records 0..7, TextProvider.cs
  // :582-604). The port answered them only WHILE levelling, so on a
  // normal sheet all eight returned false, silently - and this test's
  // own "every DFU rect is consumed" walk did not reach them because
  // they are not in CHARSHEET_RECTS.
  const se = STATS_ROLLOUT_SELECT;
  assert.deepEqual([se.x, se.y, se.w, se.h, se.step], [141, 6, 28, 20, 24]);
  for (let i = 0; i < 8; i++) {
    assert.equal(statDescriptionTextId(i), i, 'DFCareer.Stats order IS records 0..7');
    const asked = [];
    const w = new CharSheet(e, { rows: (id) => { asked.push(id); return [`stat ${id}`]; } });
    assert.equal(w.leveling, false, 'a normal sheet, which is the arm that was missing');
    assert.ok(w.click(se.x + 1, se.y + se.step * i + 1), `attribute ${i} is answered`);
    assert.deepEqual(asked, [i], 'and it asks for THAT stat\'s record');
    assert.ok(w.child, 'the description box is up (ClickAnywhereToClose)');
  }
  // a host with no TEXT.RSC still gets the click and the consume, and
  // no empty box
  const bare = new CharSheet(e);
  assert.ok(bare.click(se.x + 1, se.y + 1));
  assert.equal(bare.child, null);
  // ...and while LEVELLING the rollout keeps first claim on them
  const lvl = new CharSheet({
    ...e, readyToLevelUp: true, pendingLevel: 2, level: 1, health: 20, maxHealth: 20,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    career: { hitPointsPerLevel: 10 },
  }, { rows: () => ['x'] }, () => 0.5);
  assert.equal(lvl.leveling, true);
  assert.ok(lvl.click(se.x + 1, se.y + se.step * 3 + 1));
  assert.equal(lvl.cursor, 3, 'SelectStat, not the popup');
  assert.equal(lvl.child, null, 'and no description box while levelling');
});

// ---------------------------------------------------------------
// F13  The dungeon host's inventory equips ARMOR, and still not arrows
// ---------------------------------------------------------------
test('audit18 ui-native F13: the dungeon equips every group, arrows excepted', () => {
  // AUDIT 18 wrote this against ui/inventory.js's keyed window, which
  // was the dungeon's until U26 swapped it for the native one and
  // DELETED it. The LAW is unchanged and is what this pins - it just
  // lives in equipItem now rather than in a window's Enter branch,
  // which is the whole point of the swap: one equip model, one career
  // gate, one arrow exclusion, in every host.
  const cuirass = { group: 'Armor', name: 'Iron Cuirass', templateIndex: 102, material: 0x0200, variant: 0 };
  const e = { items: [cuirass], equip: undefined };
  equipItem(e, cuirass);
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.ChestArmor], cuirass, 'armor is wearable in a dungeon');
  assert.ok(e.armorValues.some((v) => v !== 100), 'and the armor table moved off unarmored');
  // clothing too
  const shirt = { group: 'MensClothing', name: 'Casual shirt', templateIndex: 141, variant: 0 };
  const e2 = { items: [shirt] };
  equipItem(e2, shirt);
  assert.equal(equipTableOf(e2)[EQUIP_SLOTS.ChestClothes], shirt, 'clothing is wearable in a dungeon');
  // DaggerfallInventoryWindow.EquipItem's ONE exclusion still stands,
  // and the window that reaches it is now the native one
  const arrow = { group: 'Weapons', name: 'Arrow', templateIndex: 131, stackCount: 20 };
  const e3 = { items: [arrow], activeEffects: [] };
  assert.equal(equipItem(e3, arrow), null, 'arrows never equip');
  const w = new NativeInventoryWindow({ items: () => e3.items, entity: e3, icons: ICONS });
  w.click(163 + 9 + 25, 48 + 5);   // an EQUIP-mode click on the arrow
  assert.equal(equipTableOf(e3).filter(Boolean).length, 0, 'still nothing worn');
  assert.equal(w.done, false, 'and the window stays open');
});

// ---------------------------------------------------------------
// F14  QuickLoad is F11
// ---------------------------------------------------------------
test('audit18 ui-native F14: QuickLoad binds F11 (InputManager.SetupDefaults)', () => {
  const b = createBindings();
  resetDefaults(b);
  setBindings(b);
  assert.equal(actionOf({ code: 'F11' }), 'QuickLoad');
  assert.equal(actionOf({ code: 'F12' }), null, 'F12 appears nowhere in SetupDefaults');
  assert.equal(actionOf({ code: 'F9' }), 'QuickSave');
});

// ---------------------------------------------------------------
// F15  The cloak INTERIOR enters the GetEquipIndex click mask, first
// ---------------------------------------------------------------
test('audit18 ui-native F15: BlitCloakInterior pushes an ItemElement, and it is checked LAST', { skip: skipReal }, async () => {
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const r = recorder();
  const texCache = new Map();
  const getTexture = async (archive) => {
    if (!texCache.has(archive)) {
      const name = `TEXTURE.${String(archive).padStart(3, '0')}`;
      const tf = new TextureFile();
      tf.load(new Uint8Array(readFileSync(join(ARENA2, name))), name, palette);
      texCache.set(archive, tf);
    }
    return texCache.get(archive);
  };
  await preloadPaperDollArt({
    renderer: r, palette, getTexture,
    fetchBytes: async (n) => new Uint8Array(readFileSync(join(ARENA2, n))),
  });
  assert.ok(paperDollArtLoaded());
  const e = { items: [] };
  const cloak = { group: 'MensClothing', name: 'Formal Cloak', templateIndex: 155, variant: 0 };
  equipItem(e, cloak);
  assert.equal(cloak.equipSlot, EQUIP_SLOTS.Cloak2, 'GetFirstSlot pairs Cloak2 then Cloak1');
  await refreshPaperDoll(e);
  const layers = _debugPaperDoll().layers;
  // Refresh blits the interior BEFORE the body and the items
  // (PaperDollRenderer.cs:169/173/177), so it is itemLayout[0] and the
  // backwards GetEquipIndex walk reaches it last.
  assert.equal(layers[0], cloak.equipSlot, 'the interior is the FIRST layout element');
  assert.equal(layers.length, 2, 'interior + the cloak exterior');
  // and it answers clicks: the lining pixels resolve to Cloak1 too.
  let hits = 0;
  for (let y = 0; y < 184; y++) {
    for (let x = 0; x < 110; x++) {
      const s = slotAtPaperDoll(x, y);
      if (s != null) { assert.equal(s, cloak.equipSlot); hits++; }
    }
  }
  assert.ok(hits > 0, 'the doll answers clicks on the cloak');
});
