// THE BULLETIN BOARD MOUNTED - PlayerActivate.ActivateBulletinBoard
// (:706-739) plus the model id RMBLayout stands the sign under
// (:42, :1013-1017) and MultiFormatTextLabel's token->row law
// (:316-378), which is what turns the composed tokens into the rows a
// parchment draws.
//
// The mill's sign face (GetNewsOrRumorsForBulletinBoard) shipped at
// TK-i with no caller at all: the board existed as law and as a model
// in every town block, and no click could reach either. What is
// pinned here is the whole path from a mill entry to the lines the
// box shows. NOTICE-PANEL (2026-10-29): no board stands any more - the
// town panel's Notice Board opens the same box (test/scenes/fb1029f_townpanel.test.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bulletinBoardTokens, bulletinBoardRows,
} from '../../src/systems/bulletinBoard.js';
import { tokenRows } from '../../src/ui/messageBox.js';
import { BULLETIN_BOARD_MODEL_ID, isBulletinBoard } from '../../src/world/rmbLayout.js';
import { RSC, TOKEN_TEXT } from '../../src/formats/textRsc.js';
import { RumorMill } from '../../src/systems/rumorMill.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (f) => hostText(f);

const text = (s) => ({ formatting: TOKEN_TEXT, text: s, x: 0, y: 0 });
const brk = (f) => ({ formatting: f, text: '', x: 0, y: 0 });

test('the sign model is 41739 and nothing else - RMBLayout.cs:42, :1013-1017', () => {
  assert.equal(BULLETIN_BOARD_MODEL_ID, 41739);
  assert.equal(isBulletinBoard(41739), true);
  assert.equal(isBulletinBoard(41738), false, '"Only a single variant of Bulletin Board model known"');
  assert.equal(isBulletinBoard(0), false);
  assert.equal(isBulletinBoard(undefined), false);
});

test('ActivateBulletinBoard composes the head three tokens, always', () => {
  // :715-724 - JustifyCenter, the location name, JustifyCenter. The
  // trailing one is what CENTRES the name (it stamps the label it
  // just closed, MultiFormatTextLabel.cs:342-344).
  const t = bulletinBoardTokens('Daggerfall', null);
  assert.deepEqual(t.map((x) => x.formatting),
    [RSC.JustifyCenter, TOKEN_TEXT, RSC.JustifyCenter]);
  assert.equal(t[1].text, 'Daggerfall');
});

test('a board with news adds the blank separator then the rumour, verbatim :726-736', () => {
  const news = [text('The King is dead.'), brk(RSC.JustifyLeft)];
  const t = bulletinBoardTokens('Wayrest', news);
  assert.deepEqual(t.map((x) => x.formatting), [
    RSC.JustifyCenter, TOKEN_TEXT, RSC.JustifyCenter,
    // NewLineOffset IS 0x00 (TextFile.cs:106) - the separator is a
    // break, an EMPTY text token, and a second break
    RSC.NewLine, TOKEN_TEXT, RSC.NewLine,
    TOKEN_TEXT, RSC.JustifyLeft,
  ]);
  assert.equal(t[4].text, '', 'string.Empty (:732)');
  assert.equal(t[6].text, 'The King is dead.');
  // the rumour tokens are APPENDED, not copied over - AddRange
  assert.equal(t[6], news[0], 'the mill\'s own token objects ride through');
});

test('an empty board still opens a box - the town name alone', () => {
  // :727's `if (bulletinBoardMessage != null)` guards only the second
  // half; the MessageBox at :738 is unconditional.
  const rows = tokenRows(bulletinBoardTokens('Sentinel', null));
  assert.deepEqual(rows, [
    { text: '', center: true },
    { text: 'Sentinel', center: true },
  ]);
});

test('tokenRows is MultiFormatTextLabel.LayoutTextElements: text APPENDS, breaks close', () => {
  // :247 advances cursorX per text label, so two text tokens in a row
  // are ONE row; :333-345 closes on NewLine/JustifyLeft/JustifyCenter,
  // and only JustifyCenter centres.
  const rows = tokenRows([
    text('a'), text('b'), brk(RSC.NewLine),
    text('c'), brk(RSC.JustifyCenter),
    text('d'), brk(RSC.JustifyLeft),
    text('trailing'),
  ]);
  assert.deepEqual(rows, [
    { text: 'ab', center: false },
    { text: 'c', center: true },
    { text: 'd', center: false },
    { text: 'trailing', center: false },
  ]);
});

test('tokenRows moves no row for the tokens the switch ignores', () => {
  // PositionPrefix tabs, FontPrefix, the cursor positioner and the
  // record terminator all leave the row alone (:346-373).
  const rows = tokenRows([
    brk(RSC.PositionPrefix), text('x'), brk(RSC.FontPrefix),
    brk(RSC.InputCursorPositioner), text('y'), brk(RSC.EndOfRecord),
  ]);
  assert.deepEqual(rows, [{ text: 'xy', center: false }]);
  assert.deepEqual(tokenRows(null), []);
  assert.deepEqual(tokenRows([]), []);
});

test('the whole path: a SIGN rumour in the mill becomes the lines a board shows', () => {
  // Type 10 is one of GetFlagsForNewRumor's seven sign types, so the
  // entry is posted (flags&1) rather than spoken - and 1475 is in
  // allowedBulletinTextIds, so the sign filter keeps it.
  const mill = new RumorMill({
    currentRegionIndex: () => 3,
    getRandomTokens: () => [text('A crime wave grips'), brk(RSC.JustifyLeft), text('the region.')],
  });
  mill.addNonQuestRumor(0, 0, 3, 10, 1475);
  const news = mill.getNewsOrRumorsForBulletinBoard();
  assert.notEqual(news, null, 'the sign face answers tokens');
  const rows = tokenRows(bulletinBoardTokens('Tulune', news));
  // TWO blank rows between the heading and the rumour, and that is
  // DFU's own layout: each NewLineOffset calls NewLine(), which
  // advances by lastLabel.TextHeight - and an EMPTY label is a full
  // glyph height, not zero (TextLabel.cs:543 sets totalHeight =
  // font.GlyphHeight before it looks at the text). So the separator
  // costs one advance for the row the name's JustifyCenter opened and
  // one for the empty label's own.
  assert.deepEqual(rows.map((r) => r.text),
    ['', 'Tulune', '', '', 'A crime wave grips', 'the region.']);
  assert.deepEqual(rows.map((r) => r.center), [true, true, false, false, false, false]);
  // The LEADING row is the one with no height: `lastLabel = new
  // TextLabel()` (MultiFormatTextLabel.cs:40) has never laid out, so
  // its totalHeight is still 0 and the opening JustifyCenter's
  // NewLine() moves the cursor nowhere. bulletinBoardRows drops it -
  // and drops NOTHING else.
  assert.equal(rows[0].text, '');
  assert.deepEqual(bulletinBoardRows('Tulune', news, tokenRows).map((r) => r.text),
    ['Tulune', '', '', 'A crime wave grips', 'the region.']);
  assert.deepEqual(bulletinBoardRows('Tulune', null, tokenRows), [{ text: 'Tulune', center: true }],
    'an empty board is the town name and nothing else');
  // A board with no location name (no directory - nowhere a board
  // stands, but the arm must not throw) still composes: the drop
  // takes the starter row, the nameless heading row stays, and the
  // rumour follows its separator.
  assert.deepEqual(bulletinBoardRows('', news, tokenRows).map((r) => r.text),
    ['', '', '', 'A crime wave grips', 'the region.']);

  // ...and a SPOKEN rumour (type 100 -> flags 8) never reaches a board,
  // so the same town shows its name and nothing else.
  const spoken = new RumorMill({
    currentRegionIndex: () => 3,
    getRandomTokens: () => [text('never posted')],
  });
  spoken.addNonQuestRumor(0, 0, 3, 100, 1475);
  assert.equal(spoken.getNewsOrRumorsForBulletinBoard(), null);
  assert.deepEqual(tokenRows(bulletinBoardTokens('Tulune', null)).map((r) => r.text), ['', 'Tulune']);
});


// ---------------------------------------------------------------
// The hosts. RMBLayout stands the board STANDALONE (:857, :935) so it
// can carry DaggerfallBulletinBoard (:966-970). NOTICE-PANEL (the
// owner, 2026-10-29: "remove the notice board prop from all cities"):
// no host stands it now, and the town panel is the press.
// ---------------------------------------------------------------

test('NOTICE-PANEL the streaming world stands no board: the build keeps its place alone (the siege field\'s Market), the street\'s ray holds none, and the town panel\'s Notice Board reads the mill\'s sign', () => {
  const b = src('src/scenes/pixelBuild.js');
  const at = b.indexOf('if (isBulletinBoard(placed.modelIdNum)) { pixelBoards.push({ box, local }); continue; }');
  assert.ok(at > 0 && at < b.indexOf('const climateFree = isClimateFreeModel(placed.modelIdNum);'), 'caught before it is remapped, drawn or made solid');
  // PIN MOVED (AUDIT FB1029f R1): its place is the very box and matrix a drawn model's are - one reckoning, read once
  assert.match(b, /if \(!gpu\) continue;\n\s*const local = multiply\(originMatrix, placed\.matrix\);\n\s*const cpu = cpuModels\.get\(placed\.modelIdNum\);\n\s*const box = transformedAabb\(archAabb\(placed\.modelIdNum, cpu\.positions\), local\);\n(\s*\/\/[^\n]*\n)*\s*if \(isBulletinBoard\(placed\.modelIdNum\)\) \{ pixelBoards\.push\(\{ box, local \}\); continue; \}/);
  assert.equal(b.match(/multiply\(originMatrix, placed\.matrix\)/g)?.length, 1, 'no second reckoning of a placed model\'s matrix');
  assert.doesNotMatch(b, /boards: pixelBoards,   \/\/|BULLETIN_BOARD_MODEL_ID/, 'no list on the pixel, and no board of the build\'s own');
  const w = src('src/scenes/world.js');
  assert.doesNotMatch(w, /boardTargets|bulletinBoardNews|openBountyBoard/, 'the street\'s host hands the ray no board');
  assert.match(w, /news: \(\) => rumorMill\.getNewsOrRumorsForBulletinBoard\(\),/, 'TK-i\'s sign face, the panel\'s');
  assert.equal(/bulletin boards, the questor-post greeting\) mount\n  \/\/ with TK-v/.test(w), false, 'the stale "mount with TK-v" note stays rewritten');
  const m = src('src/scenes/worldModes.js');
  assert.doesNotMatch(m, /activateBulletinBoard|boardTargets|key: `board:/, 'no board in the ray, nor its press');
});

test('the probe exterior host stands no board either - FLAGGED: no account service and no mill, so no town panel', () => {
  const e = src('src/scenes/exterior.js');
  assert.ok(e.includes("import { isBulletinBoard, isCityGate,") && e.includes("} from '../world/rmbLayout.js';"));
  assert.match(e, /if \(isBulletinBoard\(placed\.modelIdNum\)\) continue;/, 'skipped where the placement is stood');
  assert.match(e, /if \(!isBulletinBoard\(placed\.modelIdNum\)\) modelIds\.add\(placed\.modelIdNum\);/, 'AUDIT FB1029f R6: and never fetched for it');
  assert.match(src('tools/townSolidsSweep.mjs'), /&& !RMBRP_HILLS\[p\.id\] && !isBulletinBoard\(p\.id\)\);/, 'AUDIT FB1029f R6: the solids sweep counts no board as standing');
  assert.doesNotMatch(e, /boardTargets|bulletinBoards|createTownPanelHost/);
  // and the CONTENT of the no-news arm, which the panel opens offline -
  // one centred row, the location's own name.
  assert.deepEqual(bulletinBoardRows('Daggerfall', null, tokenRows).map((r) => r.text), ['Daggerfall'],
    'the empty mill still shows the town');
  assert.deepEqual(bulletinBoardRows('', null, tokenRows).map((r) => r.text), [''],
    '...and with no name at all there is nothing on the sign, which is the defect this pins against');
});
