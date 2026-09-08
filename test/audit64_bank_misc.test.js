// AUDIT 64, bank-misc lane. Five laws, each pinned against the
// REFERENCE's value rather than the port's own text:
//   F25 the banking window's macro pass (SetTextTokens -> ExpandMacros)
//   F26 SellHouse's building-resolution guard
//   F27 LoanChecker's HUD reminder and its 3-second delay
//   F28 CreateBankingStatusBox behind the character sheet's gold button
//   F55 the exterior automap's persistent view mode and background

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ExteriorAutomapWindow, VIEW_MODES, _resetZoomForTests,
} from '../src/ui/exteriorAutomapWindow.js';
import { _resetForTests } from '../src/systems/settings.js';
import { shortcutBinding } from '../src/systems/dialogShortcuts.js';
import { BankWindow, BANK_RECTS, BANK_PANEL_X, BANK_PANEL_Y } from '../src/ui/bankWindow.js';
import {
  TRANSACTION_RESULT, sellHouse, createBankAccounts, createHouses,
  bankingStatusRows, BANKING_STATUS_COLUMNS, BANKING_STATUS_HEADERS,
  calculateMaxBankLoan, borrowLoan,
} from '../src/systems/banking.js';
import { runDayChange, LOAN_REMINDER_HUD_DELAY } from '../src/systems/worldTick.js';
import { CharSheet, CHARSHEET_RECTS } from '../src/ui/charsheet.js';
import { ActionTextBox } from '../src/ui/actionText.js';
import { layoutMessageBox, drawMessageBox, _setMessageBoxArtForTests } from '../src/ui/messageBox.js';

const FONT = { fnt: { fixedWidth: 6, fixedHeight: 6, glyphWidth: () => 5 } };
/** DaggerfallUI.cs:65 `DaggerfallUnityStatDrainedTextColor =
 *  new Color32(190, 85, 24, 255)` - the REFERENCE's own numbers, so the
 *  pin stands even if the port's constant is renamed or moved. */
const DRAINED = [190 / 255, 85 / 255, 24 / 255, 1];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

// ── F55 ──────────────────────────────────────────────────────────────

const deps = (id) => ({
  locationName: 'T', locationId: id, gridW: 2, gridH: 2,
  blocks: [], playerPos: () => [102.4, 0, 102.4], playerYaw: () => 0,
  locOrigin: [0, 0, 0], isCustomLocation: false,
  arrowMesh: () => null, compassArt: null,
  buildings: () => [], directory: () => [], discovered: () => [],
});

test('AUDIT 64 F55: the exterior automap view mode and background OUTLIVE the window, and a change of town too (ExteriorAutomap.cs:101, DaggerfallUI.cs:531/:647)', () => {
  _resetForTests(); _resetZoomForTests();
  try {
    const w = new ExteriorAutomapWindow(deps('r:A'));
    assert.equal(w.mode, VIEW_MODES[0], 'a clean session starts at Original (ExteriorAutomap.cs:101)');
    assert.equal(w.background, 'original');
    w.runVerb('ActionSwitchToExteriorAutomapViewModeAll', 1);
    const alt2 = shortcutBinding('ExtAutomapSwitchToExteriorAutomapBackgroundAlternative2').code;
    w.input(alt2, { code: alt2 });
    assert.equal(w.mode, 'all');
    assert.equal(w.background, 'alt2');
    // ActionExit closes INSIDE runVerb, so there is no further tick to
    // write anything back - the state must already live outside.
    w.runVerb('ActionExit', 1);
    assert.equal(w.done, true);
    // the next M in the SAME town
    const again = new ExteriorAutomapWindow(deps('r:A'));
    assert.equal(again.mode, 'all', 'OnPush (:481-540) resets neither');
    assert.equal(again.background, 'alt2', 'OnPop (:545-563) resets neither');
    // ...and in a DIFFERENT town: LoadAndCreateLocationExteriorAutomap
    // only READS currentExteriorAutomapViewMode (:1588-1599), and the
    // new-location signal (ExteriorAutomap.cs:1650-1660) is spent on
    // ResetCameraPosition and the zoom alone (window :512-524).
    const elsewhere = new ExteriorAutomapWindow(deps('r:B'));
    assert.equal(elsewhere.mode, 'all');
    assert.equal(elsewhere.background, 'alt2');
  } finally { _resetForTests(); _resetZoomForTests(); }
});

// ── F25 ──────────────────────────────────────────────────────────────

// The REAL record text, from DFU's own master dump
// (Assets/StreamingAssets/Text/Master Localization CSV Files/
// Internal_RSC.csv:615-682). These are the reference's values, not the
// port's - a row per record line, as linesById answers them.
const RECORDS = {
  [TRANSACTION_RESULT.PURCHASED_HOUSE]: [
    'Congratulations! You have purchased a lovely', 'home here in %cn.',
  ],
  [TRANSACTION_RESULT.NOT_PORT_TOWN]: [
    'This is not a port town, %pcn.', 'We have no ships to sell you here.',
  ],
  [TRANSACTION_RESULT.ALREADY_DEFAULTED]: [
    '%pcn, you have defaulted', 'place other than %reg and',
  ],
  [TRANSACTION_RESULT.LOAN_REQUEST_TOO_HIGH]: [
    'I am afraid that we cannot loan that much', 'our limit is %ml gold pieces.',
  ],
  [TRANSACTION_RESULT.SELL_HOUSE_OFFER]: [
    'We would gladly purchase your house for the', 'generous sum of %a gold',
  ],
  [TRANSACTION_RESULT.SELL_SHIP_OFFER]: ['Your ship is worth %a gold'],
};

const bankHooks = (over = {}) => ({
  accounts: () => createBankAccounts(3),
  regionIndex: () => 1,
  level: () => 4,
  now: () => 0,
  player: { gold: () => 0, totalGold: () => 0, deductGold: () => 0 },
  rows: (id) => (RECORDS[id] ?? []).map((text) => ({ text, center: true })),
  playerName: () => 'Nulfaga',
  cityName: () => 'Daggerfall',
  regionName: () => 'Betony',
  ...over,
});

test('AUDIT 64 F25: every bank box runs SetTextTokens\' macro pass - %a, %ml, %cn, %pcn and %reg (DaggerfallBankingWindow.cs:311, :497-514; MacroHelper.cs:50/:67/:139/:152/:211)', () => {
  const w = new BankWindow(bankHooks());
  const text = () => w.box.rows.map((r) => r.text).join('\n');

  // %a - GetHouseSellPrice passed into GeneratePopup at :450
  w._popup(TRANSACTION_RESULT.SELL_HOUSE_OFFER, 461316);
  assert.match(text(), /generous sum of 461316 gold/);
  assert.equal(text().includes('%'), false);

  // %a again - GetShipSellPrice at :470
  w._popup(TRANSACTION_RESULT.SELL_SHIP_OFFER, 85000);
  assert.equal(text(), 'Your ship is worth 85000 gold');

  // %ml - BankingMacroDataSource.MaxLoan() is
  // FormulaHelper.CalculateMaxBankLoan(), level x 50000, and this is
  // the ONE class in DFU that overrides it.
  w._popup(TRANSACTION_RESULT.LOAN_REQUEST_TOO_HIGH);
  assert.match(text(), /our limit is 200000 gold pieces\./);
  assert.equal(calculateMaxBankLoan(4), 200000);

  // ...and the three GLOBAL macros the same records carry, which the
  // window's own data source does not override (MacroHelper.cs:565-572
  // CityName, :779-782 PlayerName, :1049-1057 RegionInContext).
  w._popup(TRANSACTION_RESULT.PURCHASED_HOUSE);
  assert.match(text(), /home here in Daggerfall\./);
  w._popup(TRANSACTION_RESULT.NOT_PORT_TOWN);
  assert.match(text(), /This is not a port town, Nulfaga\./);
  w._popup(TRANSACTION_RESULT.ALREADY_DEFAULTED);
  assert.match(text(), /^Nulfaga, you have defaulted/);
  assert.match(text(), /place other than Betony and/);

  // A host that supplies no producer leaves the token VERBATIM, which
  // is GetValue's own ladder (MacroHelper.cs:503-527) rather than an
  // empty hole in the sentence.
  const bare = new BankWindow(bankHooks({ cityName: undefined, playerName: undefined, regionName: undefined }));
  bare._popup(TRANSACTION_RESULT.PURCHASED_HOUSE);
  assert.match(bare.box.rows.map((r) => r.text).join('\n'), /home here in %cn\./);

  // TOO_HEAVY never reaches SetTextTokens (:308-309) - it is the one
  // result the window supplies a line for.
  w._popup(TRANSACTION_RESULT.TOO_HEAVY);
  assert.equal(w.box.rows.length, 1);
});

test('AUDIT 64 F25: the reachable %ml box - a level-1 character over the cap reads the NUMBER (banking.js borrowLoan -> LOAN_REQUEST_TOO_HIGH)', () => {
  const accounts = createBankAccounts(3);
  const w = new BankWindow(bankHooks({ accounts: () => accounts, level: () => 1 }));
  const result = borrowLoan(accounts, 1, 60000, { level: 1, nowMinutes: 0 });
  assert.equal(result, TRANSACTION_RESULT.LOAN_REQUEST_TOO_HIGH);
  w._popup(result, 60000);
  assert.match(w.box.rows.map((r) => r.text).join('\n'), /our limit is 50000 gold pieces\./);
});

// ── F26 ──────────────────────────────────────────────────────────────

test('AUDIT 64 F26: SellHouse does NOTHING when the owned building is not in the current directory (DaggerfallBankManager.cs:449-464)', () => {
  const hooks = () => {
    const calls = { removed: 0, undiscovered: 0 };
    return [calls, {
      removePermanentScene: () => { calls.removed += 1; },
      undiscoverBuilding: () => { calls.undiscovered += 1; },
    }];
  };
  // OWNED BUT UNRESOLVED - GetBuildingSummary missed (or the directory
  // is null, :452). Every effect of SellHouse is nested inside that
  // success arm, so the miss is a total no-op and the deed stands.
  const accounts = createBankAccounts(2);
  const houses = createHouses(2);
  houses[0].buildingKey = 7;
  houses[0].mapId = 12345;
  const [calls, sinks] = hooks();
  const miss = sellHouse(accounts, houses, 0, { meshRadius: 10, found: false }, sinks);
  assert.equal(miss.kind, 'none');
  assert.equal(accounts[0].accountGold, 0, 'no credit at all - not even houseSellPrice(0)');
  assert.equal(houses[0].buildingKey, 7, 'the player keeps the house');
  assert.equal(calls.removed, 0, 'the interior stays permanent');
  assert.equal(calls.undiscovered, 0, 'and stays on the map');

  // ...and the resolved case still sells, so the guard is the lookup
  // and not the ownership test that already existed.
  const [calls2, sinks2] = hooks();
  const sold = sellHouse(accounts, houses, 0, { meshRadius: 10, found: true }, sinks2);
  assert.equal(sold.kind, 'sold');
  assert.ok(accounts[0].accountGold > 0);
  assert.equal(houses[0].buildingKey, 0);
  assert.equal(calls2.removed, 1);
  assert.equal(calls2.undiscovered, 1);
});

test('AUDIT 64 F26: SellHouseButton raises NO offer box when the building does not resolve (DaggerfallBankingWindow.cs:440-453)', () => {
  const w = new BankWindow(bankHooks({
    ownsHouse: () => true,
    ownedHouseResolved: () => false,
    houseSellPrice: () => 0,
  }));
  w._button('sellHouse');
  assert.equal(w.box, null, 'there is no else arm - the click is silent');
  // resolved: the offer appears, priced off the resolved building
  const ok = new BankWindow(bankHooks({
    ownsHouse: () => true,
    ownedHouseResolved: () => true,
    houseSellPrice: () => 461316,
  }));
  ok._button('sellHouse');
  assert.match(ok.box.rows.map((r) => r.text).join('\n'), /generous sum of 461316 gold/);
  // a host that wires no resolver IS a host whose StreamingWorld hands
  // back no BuildingDirectory - :446's `if (buildingDirectory)` with no
  // else - so that click is silent too. There is no lenient arm in the
  // reference to port.
  const noDirectory = new BankWindow(bankHooks({ ownsHouse: () => true, houseSellPrice: () => 10 }));
  noDirectory._button('sellHouse');
  assert.equal(noDirectory.box, null, ':446 has no else either');
});

// ── F27 ──────────────────────────────────────────────────────────────

test('AUDIT 64 F27: the loan reminder carries loanReminderHUDDelay = 3 (LoanChecker.cs:15, :41-45)', () => {
  assert.equal(LOAN_REMINDER_HUD_DELAY, 3, 'LoanChecker.cs:15 const float loanReminderHUDDelay = 3');
  const MINUTES_PER_MONTH = 1440 * 30;
  const accounts = createBankAccounts(2);
  accounts[1].loanTotal = 4000;
  // due in a shade over six months: the tick crosses the 6-month mark
  accounts[1].loanDueDate = MINUTES_PER_MONTH * 6 + 100;
  const said = [];
  const entity = { bankAccounts: accounts, factionRep: { dict: null } };
  runDayChange({
    entity, lastMinutes: 0, nowMinutes: 1440, rolls: () => 0.5,
    say: (msg, delay) => said.push([msg, delay]),
  });
  assert.equal(said.length, 2, 'both AddHUDText lines (LoanChecker.cs:42-45)');
  for (const [, delay] of said) assert.equal(delay, 3, 'DFU passes the delay on BOTH');
  assert.match(said[0][0], /4000 gold pieces due in/);
});

test('AUDIT 64 F27: the two outdoor hosts speak the ticker\'s lines instead of logging them', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const text = src(host);
    assert.equal(/say: \(msg\) => console\.log\('\[player\]'/.test(text), false,
      `${host}: DaggerfallUI.AddHUDText is a HUD popup, not a log (LoanChecker.cs:42-45)`);
    assert.match(text, /say: \(msg, delay\) => townTalk\.say\(msg, delay\)/,
      `${host}: the sink reaches the HUD and forwards the delay`);
  }
  // and the two hosts that already spoke now FORWARD the delay
  assert.match(src('src/scenes/dungeonContext.js'), /say: \(msg, delay\) => hudText\.add\(msg, delay\)/);
  assert.match(src('src/scenes/worldModes.js'), /const say = \(l, delay\) =>/);
});

// ── the HOST WIRING (the AUDIT 63 lesson: an unpinned host wiring is
//    a law that only half landed) ───────────────────────────────────

test('AUDIT 64 F25/F26: the one host that mounts the bank feeds the macro producers and the house resolver', () => {
  const modes = src('src/scenes/worldModes.js');
  // ONE resolver, asked by the price, the offer gate and the sale -
  // DFU's window and manager both run the same GetBuildingSummary.
  assert.match(modes, /const ownedHouseSummary = \(\) => \{/);
  assert.match(modes, /ownedHouseResolved: \(\) => ownedHouseSummary\(\) !== null/);
  assert.match(modes, /found: owned !== null/);
  assert.equal(/dir\?\.buildings\?\.find\(\(b\) => b\.buildingKey === key\)/.test(modes), false,
    'the second, independent lookup is gone');
  // the three GLOBAL macro producers SetTextTokens needs
  for (const hook of ['playerName:', 'cityName:', 'regionName:']) {
    assert.ok(modes.includes(`      ${hook}`), `worldModes wires ${hook} for the bank window`);
  }
  // AUDIT 64 F26: and the fixed-city host's directory carries its real
  // buildings, or an owned house never resolves even in its own town.
  assert.match(src('src/scenes/exterior.js'),
    /buildings: locationBuildings\(dfLocation\.exterior\?\.buildings \?\? \[\], loc\.blocks\)/);
});

// ── F28 ──────────────────────────────────────────────────────────────

test('AUDIT 64 F28: CreateBankingStatusBox\'s rows - the header, the qualifying walk, the defaulted highlight and "None" (DaggerfallBankingWindow.cs:520-550, :559-577)', () => {
  const regionName = (i) => ['Alik\'r Desert', 'Dragontail Mountains', 'Betony'][i] ?? '';
  // Internal_Strings.csv:856-859 - the four column headings verbatim
  assert.deepEqual(BANKING_STATUS_HEADERS, ['Region', 'Account', 'Loan', 'Loan Due Date']);
  // GetLoansLine's tab stops (:566, :569, :572)
  assert.deepEqual(BANKING_STATUS_COLUMNS, [0, 60, 120, 180]);

  const accounts = createBankAccounts(3);
  accounts[0].accountGold = 1200;
  accounts[1].loanTotal = 5000;
  accounts[1].loanDueDate = 100;
  accounts[1].hasDefaulted = true;
  const rows = bankingStatusRows(accounts, { regionName });
  // header, blank line (:531), then the two qualifying regions
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0].cells.map((c) => c.text), BANKING_STATUS_HEADERS);
  assert.deepEqual(rows[0].cells.map((c) => c.x), [0, 60, 120, 180]);
  assert.equal(rows[0].highlight, false, 'the header is plain Text formatting');
  assert.equal(rows[1].text, '', 'TextFile.NewLineToken after the header (:531)');
  // ShortenName(name, 12) - 11 characters and an ellipsis (:552-557)
  assert.deepEqual(rows[2].cells.map((c) => c.text), ['Alik\'r Dese...', '1200', '0', '']);
  assert.equal(rows[2].highlight, false);
  assert.deepEqual(rows[3].cells.map((c) => c.text)[0], 'Dragontail ...');
  assert.equal(rows[3].cells[2].text, '5000', 'GetLoanedTotal, not the +10% repayment');
  assert.equal(rows[3].highlight, true, 'HasDefaulted -> TextFile.Formatting.TextHighlight (:536)');
  // A region with neither a balance nor a loan is skipped (:534)
  assert.equal(rows.some((r) => r.cells?.[0]?.text?.startsWith('Betony')), false);

  // nothing qualified -> the ONE "None" row (:541-546), the header
  // still printed above it
  const empty = bankingStatusRows(createBankAccounts(3), { regionName });
  assert.equal(empty.length, 3);
  assert.equal(empty[2].text, 'None', 'Internal_Strings.csv:860 noAccount');
  // a player who has never entered a bank has no accounts at all
  assert.equal(bankingStatusRows(null, { regionName }).at(-1).text, 'None');
});

test('AUDIT 64 F28: the character sheet\'s GOLD button opens the box (DaggerfallCharacterSheetWindow.cs:787-792)', () => {
  const entity = {
    name: 'Nulfaga', level: 1, race: 0, gender: 0,
    stats: {}, skills: {}, bankAccounts: createBankAccounts(2),
  };
  entity.bankAccounts[0].accountGold = 90;
  const sheet = new CharSheet(entity, {});
  const [gx, gy] = CHARSHEET_RECTS.gold;
  assert.equal(sheet.click(gx + 2, gy + 2), true);
  assert.ok(sheet.child instanceof ActionTextBox, 'CreateBankingStatusBox(this).Show()');
  assert.deepEqual(sheet.child.lines[0].cells.map((c) => c.text), BANKING_STATUS_HEADERS);
  // SetHighlightColor(DaggerfallUnityStatDrainedTextColor) (:523) is
  // the FIRST thing CreateBankingStatusBox does, before a single token
  // is laid out ("Must be set before text", DaggerfallMessageBox.cs
  // :452-458) - so a defaulted region reads as a warning rather than in
  // MultiFormatTextLabel's ordinary highlight orange.
  assert.deepEqual(sheet.child.highlightColor, DRAINED,
    'DaggerfallUI.cs:65 Color32(190, 85, 24)');
  // ClickAnywhereToClose (:548): dismissing returns to the SHEET
  sheet.child.input();
  assert.equal(sheet.child.done, true);
});

test('AUDIT 64 F28: the message box lays a tab-stopped row at GetLoansLine\'s own x offsets, never centred (MultiFormatTextLabel.cs:341-344, :346-352, :380-384)', () => {
  const rows = [{ cells: [{ x: 0, text: 'AB' }, { x: 60, text: 'CD' }], highlight: false }];
  const box = layoutMessageBox(FONT, rows);
  // MultiFormatTextLabel's rowWidth is lastLabel.Position.x + TextWidth
  // (:380-384), so a cell at x=60 makes the row 60 + its own width.
  assert.equal(box.textW, 60 + 2 * 6);
  assert.equal(box.rows[0].cells.length, 2);
  // A row of cells NEVER centres. DFU centres a row only through a
  // JustifyCenter token, which stamps HorizontalAlignment.Center on the
  // finished label (:341-344), and GetLoansLine emits none - its rows
  // start at the label box's own left edge, which is the only thing
  // that keeps four columns lined up down the box.
  assert.equal(box.rows[0].center, false);
});

test('AUDIT 64 F28: and it DRAWS one label per cell at that x, the defaulted row in the caller\'s highlight colour (MultiFormatTextLabel.cs:346-352, :359-364)', () => {
  // The nine SPOP.RCI slices gate drawMessageBox, so the pin stands
  // them up and records every quad the glyph pass lays down.
  const quads = [];
  const renderer = {
    drawScreenQuad: (tex, rect, uv, color) => quads.push({ tex, x: rect.x, y: rect.y, color }),
    setScreenScissor() {}, clearScreenScissor() {},
  };
  const font = { fnt: FONT.fnt, tex: 'FONTTEX' };
  const TEXT = [1, 1, 1, 1];
  // one glyph per cell, so one main-pass quad per cell
  const four = (t) => BANKING_STATUS_COLUMNS.map((x, i) => ({ x, text: t[i] }));
  _setMessageBoxArtForTests({ slices: Array.from({ length: 9 }, (_, i) => `spop:${i}`), buttons: new Map() });
  try {
    const rows = [
      { cells: four('ABCD'), highlight: true },    // HasDefaulted -> TextHighlight (:536)
      { cells: four('EFGH'), highlight: false },   // plain Text
    ];
    const box = layoutMessageBox(font, rows);
    const m = { ox: 0, oy: 0, s: 1 };
    assert.equal(drawMessageBox(renderer, m, font, box, { textColor: TEXT, highlightColor: DRAINED }), true);
    // the label box's left edge - a cells row is never centred, so
    // every row starts here and the columns are the token's own x
    const labelX = box.x + Math.round((box.w - box.textW) / 2);
    const stops = BANKING_STATUS_COLUMNS.map((x) => labelX + x);
    // the shadow pass draws the same glyphs one pixel down-right in the
    // shadow colour; the main pass is the one carrying our two colours
    const main = quads.filter((q) => q.tex === 'FONTTEX' && (q.color === DRAINED || q.color === TEXT));
    const rowAt = (i) => main.filter((q) => q.y === box.textY + i * box.rowH);
    assert.deepEqual(rowAt(0).map((q) => q.x), stops,
      'cursorX = token.x outright (:346-352) - four labels, not one string');
    assert.ok(rowAt(0).every((q) => q.color === DRAINED),
      'AddTextLabel(token.text, font, HighlightColor) (:363), HighlightColor being SetHighlightColor\'s');
    assert.deepEqual(rowAt(1).map((q) => q.x), stops);
    assert.ok(rowAt(1).every((q) => q.color === TEXT),
      'AddTextLabel(token.text, font, TextColor) (:360)');

    // ...and the character sheet's box carries that colour all the way
    // to the glyphs: ActionTextBox forwards SetHighlightColor.
    quads.length = 0;
    new ActionTextBox([{ cells: four('ABCD'), highlight: true }], { highlightColor: DRAINED })
      .draw(renderer, { width: 320, height: 200 }, font, 1);
    const painted = quads.filter((q) => q.tex === 'FONTTEX');
    assert.equal(painted.length, 8, 'four cells, each with its shadow');
    assert.equal(painted.filter((q) => q.color === DRAINED).length, 4);
  } finally { _setMessageBoxArtForTests(null); }
});
