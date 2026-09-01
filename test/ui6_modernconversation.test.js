import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MODERN_TEXT_SCALE, MODERN_BLOCK_SIZE, MODERN_QUESTION_BG, MODERN_ANSWER_BG,
} from '../src/ui/nativeTalk.js';
import { LIVE } from '../src/systems/settings.js';

// UI6 - THE MODERN CONVERSATION STYLE (DaggerfallTalkWindow :53-60,
// :645-650, :1262-1267, :1273-1278), the last of AUDIT 28's six UI-only
// keys. With the setting on, the three conversation labels - the NPC's
// greeting, each question and each answer - are drawn SMALLER
// (TextScale 0.8), WRAPPED NARROWER (MaxWidth x 0.75) and on their own
// BACKGROUND BLOCK, one colour for questions and one for answers.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('UI6: the four constants are DFU\'s (:53-54, :59-60)', () => {
  assert.equal(MODERN_TEXT_SCALE, 0.8);
  assert.equal(MODERN_BLOCK_SIZE, 0.75);
  assert.deepEqual([...MODERN_QUESTION_BG], [0.3, 0.35, 0.43, 1]);
  assert.deepEqual([...MODERN_ANSWER_BG], [0.32, 0.31, 0.06, 1]);
  assert.notDeepEqual([...MODERN_QUESTION_BG], [...MODERN_ANSWER_BG], 'the two speakers differ');
});

test('UI6: the wrap narrows BEFORE the scale, the row pitch follows the scale, and the block is the LINE not the panel', () => {
  const talk = read('src/ui/nativeTalk.js');
  // MaxWidth *= 0.75 happens on the label, and the glyphs are then
  // drawn at 0.8 - so the wrap width in FONT units is the narrowed
  // box divided by the scale.
  assert.match(talk, /const wrapW = modern \? Math\.trunc\(R\.conversation\[2\] \* MODERN_BLOCK_SIZE\) : R\.conversation\[2\];/);
  assert.match(talk, /wrapText\(font\.fnt, e\.text, modern \? Math\.round\(wrapW \/ MODERN_TEXT_SCALE\) : wrapW\)/);
  assert.match(talk, /const rowH = modern \? ROW_H \* MODERN_TEXT_SCALE : ROW_H;/);
  // The label's own BackgroundColor fills the LABEL's box, so the
  // block is the drawn line's width, not the conversation panel's.
  assert.match(talk, /w: tw \* m\.s, h: rowH \* m\.s \}/);
  assert.match(talk, /e\.kind === 'question' \? MODERN_QUESTION_BG : MODERN_ANSWER_BG\)/);
});

test('UI6: shadowText grew a REAL scale - the option existed nowhere before, so a `scale:` would have been silently ignored', () => {
  const panel = read('src/ui/nativePanel.js');
  // AUDIT 39 F128 added shadowOffset after scale (ListBox's selected
  // row draws with ShadowPosition zero); the pin keeps asking for the
  // scale option it was written for.
  assert.match(panel, /shadow = DEFAULT_SHADOW_COLOR, scale = 1[,}]/);
  assert.match(panel, /const tw = measureText\(font\.fnt, text\) \* scale;/, 'the measure scales, so right-aligned questions still hug the margin');
  assert.match(panel, /m\.s \* scale, shadow\);/);
  assert.match(panel, /m\.s \* scale, color\);/);
  // The shadow OFFSET stays one native pixel: DFU's ShadowPosition is
  // in the label's own space, not the scaled glyph's. F128 made that
  // ONE the default of a `shadowOffset` option rather than a literal,
  // so the offset is still unscaled - it just has a name now.
  assert.match(panel, /shadowOffset = 1 \} = \{\}\)/);
  assert.match(panel, /m\.ox \+ \(ax \+ shadowOffset\) \* m\.s, m\.oy \+ \(y \+ shadowOffset\) \* m\.s, m\.s \* scale, shadow\);/);
});

test('UI6: the classic path is untouched and the key is LIVE', () => {
  const talk = read('src/ui/nativeTalk.js');
  assert.match(talk, /const modern = getBool\('GUI', 'EnableModernConversationStyleInTalkWindow'\);/);
  // Off, every modern term collapses to the classic one.
  assert.match(talk, /const tw = measureText\(font\.fnt, text\) \* \(modern \? MODERN_TEXT_SCALE : 1\);/);
  assert.match(talk, /scale: modern \? MODERN_TEXT_SCALE : 1/);
  assert.match(read('src/systems/settingsDefaults.js'), /"EnableModernConversationStyleInTalkWindow": "False"/, 'ships off');
  assert.equal(LIVE['GUI/EnableModernConversationStyleInTalkWindow'], 'src/ui/nativeTalk.js');
});
