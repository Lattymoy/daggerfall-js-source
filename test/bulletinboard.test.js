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
// box shows, plus the two host wirings that carry it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BULLETIN_BOARD_ACTIVATION_DISTANCE, TOO_FAR_AWAY_TEXT, bulletinBoardTokens, bulletinBoardRows,
} from '../src/systems/bulletinBoard.js';
import { tokenRows } from '../src/ui/messageBox.js';
import { BULLETIN_BOARD_MODEL_ID, isBulletinBoard } from '../src/world/rmbLayout.js';
import { RSC, TOKEN_TEXT } from '../src/formats/textRsc.js';
import { RumorMill } from '../src/systems/rumorMill.js';
import { MOBILE_NPC_ACTIVATION_DISTANCE, rayAabb } from '../src/player/activate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const text = (s) => ({ formatting: TOKEN_TEXT, text: s, x: 0, y: 0 });
const brk = (f) => ({ formatting: f, text: '', x: 0, y: 0 });

test('the sign model is 41739 and nothing else - RMBLayout.cs:42, :1013-1017', () => {
  assert.equal(BULLETIN_BOARD_MODEL_ID, 41739);
  assert.equal(isBulletinBoard(41739), true);
  assert.equal(isBulletinBoard(41738), false, '"Only a single variant of Bulletin Board model known"');
  assert.equal(isBulletinBoard(0), false);
  assert.equal(isBulletinBoard(undefined), false);
});

test('the board reaches as far as a townsperson does, not as far as a door', () => {
  // :709-710 gates on MobileNPCActivationDistance (256 units), NOT
  // the 128-unit door/default reach.
  assert.equal(BULLETIN_BOARD_ACTIVATION_DISTANCE, MOBILE_NPC_ACTIVATION_DISTANCE);
  assert.equal(BULLETIN_BOARD_ACTIVATION_DISTANCE, 256 * 0.025);
  assert.equal(TOO_FAR_AWAY_TEXT, 'You are too far away...');
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

test('the reach gate is a SECOND test after the pick, and it refuses', () => {
  // :709-713: the raycast already found the board (RayDistance);
  // this is the distance test the arm itself runs.
  const aabb = { min: [-0.5, 0, 9.5], max: [0.5, 2, 10.5] };
  const eye = [0, 1, 0];
  const dir = [0, 0, 1];
  const d = rayAabb(eye, dir, aabb);
  assert.equal(d, 9.5);
  assert.ok(d > BULLETIN_BOARD_ACTIVATION_DISTANCE, 'a board 9.5 out is seen but not read');
  const near = rayAabb(eye, dir, { min: [-0.5, 0, 4.5], max: [0.5, 2, 5.5] });
  assert.ok(near <= BULLETIN_BOARD_ACTIVATION_DISTANCE, '...and one at 4.5 is');
});

// ---------------------------------------------------------------
// The host wiring. RMBLayout stands the board STANDALONE (:857,
// :935) so it can carry DaggerfallBulletinBoard (:966-970); this
// port has no components, so the pixel keeps the list and the
// exterior ray reads it.
// ---------------------------------------------------------------

test('world.js collects the boards a pixel stands and hands them over shifted', () => {
  const w = src('src/scenes/world.js');
  assert.ok(w.includes("import { isBulletinBoard } from '../world/rmbLayout.js'"),
    'the model test comes from RMBLayout\'s home, not a second 41739');
  assert.ok(w.includes('if (isBulletinBoard(placed.modelIdNum)) pixelBoards.push({ box });'),
    'the board is caught where the placement is stood, with the box already in the pixel frame');
  assert.ok(w.includes('boards: pixelBoards,'), 'the list rides the pixel, so destroyPixel takes it away');
  assert.match(w, /boardTargets: \(\) => \{/);
  assert.ok(w.includes('const t = state.pixelTranslation(p.px, p.py);'),
    'through the LIVE floating-origin translation, like npcTargets');
  assert.ok(w.includes('bulletinBoardNews: () => rumorMill.getNewsOrRumorsForBulletinBoard(),'),
    'TK-i\'s sign face finally has a caller');
  // the TK-i interim that said the board consumers were unmounted is gone
  assert.equal(/bulletin boards, the questor-post greeting\) mount\n  \/\/ with TK-v/.test(w), false,
    'the stale "mount with TK-v" note is rewritten, not left standing');
});

test('worldModes puts the board in the SAME ray, at the ray\'s reach', () => {
  const m = src('src/scenes/worldModes.js');
  assert.ok(m.includes("boards.forEach((aabb, i) => targets.push({ key: `board:${i}`, aabb, distance: RAY_DISTANCE }));"),
    'the pick reaches to RayDistance - the board\'s own gate is inside the arm');
  assert.ok(m.includes("if (typeof key === 'string' && key.startsWith('board:')) {"),
    'and a board under the ray ENDS the activation, as C#\'s hit does');
  const arm = m.slice(m.indexOf('function activateBulletinBoard'), m.indexOf('function activateStaticNpc'));
  assert.ok(arm.includes('if (d === null || d > BULLETIN_BOARD_ACTIVATION_DISTANCE) {'), 'the :709 gate');
  assert.ok(arm.includes('townTalk?.say?.(TOO_FAR_AWAY_TEXT);'), 'the :712 refusal, and it returns');
  assert.ok(arm.includes('bulletinBoardRows(locationName, bulletinBoardNews?.() ?? null, tokenRows)'),
    'the news is fetched BEFORE the box is composed (:716)');
  assert.ok(arm.includes('townTalk?.showOverlay?.(new ChoiceWindow'),
    'DaggerfallUI.MessageBox(tokens) (:738) - unconditional, news or none');
});

test('the probe exterior host stands its boards too - the standing host rule', () => {
  const e = src('src/scenes/exterior.js');
  assert.ok(e.includes("import { isBulletinBoard } from '../world/rmbLayout.js'"));
  assert.ok(e.includes('if (isBulletinBoard(placed.modelIdNum)) {'),
    "caught where the placement is stood, world-frame like this host's doors");
  assert.ok(e.includes('boardTargets: () => bulletinBoards,'));
  assert.equal(e.includes('bulletinBoardNews:'), false,
    "no mill in this host - the board opens on the location name alone, C#'s own empty arm");
  // ...AND THE NAME IS NOT FREE. The heading is PlayerGPS
  // .CurrentLocalizedLocationName (:721), which the arm reads off
  // `buildingDirectory` (worldModes.js:1694) and off nothing else - so
  // a host that stands boards without handing one over opens the box
  // on a BLANK parchment, not "the location name alone": the head row
  // composes empty and bulletinBoard.js:97 shifts the starter row off,
  // leaving one empty line. This host knows its own location outright.
  assert.match(e, /buildingDirectory: \(\) => \(\{[\s\S]{0,400}?locationName: dfLocation\.name \?\? locationName,/,
    'the probe host hands the arm the location name it already holds');
  // and the CONTENT of the no-news arm, which the absence pin above
  // could never observe - one centred row, the location's own name.
  assert.deepEqual(bulletinBoardRows('Daggerfall', null, tokenRows).map((r) => r.text), ['Daggerfall'],
    'the empty mill still shows the town');
  assert.deepEqual(bulletinBoardRows('', null, tokenRows).map((r) => r.text), [''],
    '...and with no name at all there is nothing on the sign, which is the defect this pins against');
});
