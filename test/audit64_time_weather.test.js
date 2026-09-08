// AUDIT 64 - WORLD TIME AND WEATHER (F8, F9, F10). Three laws about
// what a town does with the clock: which flag its glass burns on, that
// weather never touches that glass at all, and the festival parchment
// that walking into a settlement on a holiday raises.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { windowStyleForTime, isCityLightsOn, isNight } from '../src/world/worldClock.js';
import * as weather from '../src/world/weather.js';
import { WINDOW_STYLES } from '../src/render/windowEmission.js';
import {
  HOLIDAYS_START_ID, holidayTextId, holidayTextPrimesFor, HolidayTextTimer,
  HOLIDAYS, getHolidayId,
} from '../src/systems/holidays.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { dateToClassicMinutes } from '../src/systems/gameDate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

// ---------------------------------------------------------------
// F8: DaggerfallLocation.ApplyTimeAndSpace (Internal/
// DaggerfallLocation.cs:141-145) — `if (dfUnity.WorldTime.Now
// .IsCityLightsOn) WindowTextureStyle = WindowStyle.Night; else ...
// = WindowStyle.Day;`, re-run off the :124 `lastCityLightsFlag !=
// Now.IsCityLightsOn` edge — and the only other writer of a window
// style, DayNight.Set (Utility/AssetInjection/Components/DayNight.cs:90
// then :120), agree. IsCityLightsOn is hour >= 17 || hour < 8
// (Utility/DaggerfallDateTime.cs:155-157 over LightsOnHour/
// LightsOffHour at :50-51); IsNight is hour < 6 || hour >= 18
// (:171-173). Nothing in DFU picks a window style from IsNight.
// ---------------------------------------------------------------
test('audit64 F8: town glass follows IsCityLightsOn, so it lights at 17:00 and unlights at 08:00', () => {
  // The four discriminating hours — the reference's edges, not the
  // port's. Under IsNight all four answer the other way round.
  assert.equal(windowStyleForTime(16 * 60 + 59), 'day');
  assert.equal(windowStyleForTime(17 * 60), 'night');       // an hour BEFORE dusk
  assert.equal(windowStyleForTime(7 * 60 + 59), 'night');   // two hours AFTER dawn
  assert.equal(windowStyleForTime(8 * 60), 'day');

  // And the two hour-windows where the reference's two properties
  // disagree are exactly where the style must NOT follow IsNight.
  for (let m = 17 * 60; m < 18 * 60; m++) {
    assert.equal(isNight(m), false, `IsNight is still false at ${m}`);
    assert.equal(windowStyleForTime(m), 'night', `glass must be lit at ${m}`);
  }
  for (let m = 6 * 60; m < 8 * 60; m++) {
    assert.equal(isNight(m), false);
    assert.equal(windowStyleForTime(m), 'night', `glass must still be lit at ${m}`);
  }
});

test('audit64 F8: the glass and the lanterns are two halves of ONE flag, every minute of the day', () => {
  for (let m = 0; m < 24 * 60; m++) {
    assert.equal(windowStyleForTime(m) === 'night', isCityLightsOn(m), `minute ${m}`);
  }
  // The emission the two answers reach really does differ, so this is
  // a visible law and not a naming one (MaterialReader.cs:111-118).
  assert.deepEqual(WINDOW_STYLES.day, { color: [89, 154, 178], intensity: 0.5 });
  assert.deepEqual(WINDOW_STYLES.night, { color: [255, 182, 56], intensity: 0.8 });
});

// ---------------------------------------------------------------
// F9: WindowStyle.Fog is DECLARED (DaggerfallUnityEnums.cs:87-94) and
// SPENT (MaterialReader.cs:927-929 over FogWindowColor :113 and
// FogWindowIntensity :117) but never ASSIGNED: the whole tree's
// writers are DaggerfallLocation.cs:44/:143/:145, DayNight.cs:120,
// DaggerfallInterior.cs:473/:517/:1270 and
// DaggerfallBankPurchasePopUp.cs:267 — Day, Night and Disabled only.
// Game/WeatherManager.cs names no window at all.
// ---------------------------------------------------------------
test('audit64 F9: weather chooses no window style — the module exports no such rule', () => {
  assert.equal(weather.windowStyleForWeather, undefined);
  for (const name of Object.keys(weather)) {
    assert.ok(!/^windowStyle/.test(name), `weather.js must export no window-style rule, found ${name}`);
  }
});

test('audit64 F9: both exterior hosts hand setWindowEmission the CLOCK alone', () => {
  // DaggerfallLocation.ApplyTimeAndSpace is the only window-style rule
  // a town runs, and it reads WorldTime. Nothing may sit between the
  // ?window= dev override (the inspector's equivalent) and the clock.
  const call = /setWindowEmission\(windowEmissionRGB\(\s*params\.has\('window'\) \? params\.get\('window'\) : windowStyleForTime\(minute\)\)\);/;
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const text = src(host);
    assert.match(text, call, host);
    assert.ok(!/windowStyleForWeather/.test(text), `${host} must not consult weather for a window style`);
  }
});

test('audit64 F9: the Fog TABLE ROW survives — it is reference data, like Custom', () => {
  // MaterialReader.cs:113/:117 declare it and :927-929 spend it; the
  // row is reachable through ?window=fog exactly as DFU's inspector
  // reaches it. Same standing as Custom (:114/:118), which DFU also
  // assigns nowhere.
  assert.deepEqual(WINDOW_STYLES.fog, { color: [117, 117, 117], intensity: 0.5 });
  assert.deepEqual(WINDOW_STYLES.custom, { color: [200, 0, 200], intensity: 1.0 });
});

// ---------------------------------------------------------------
// F10: PlayerEnterExit.ShowHolidayText (Game/PlayerEnterExit.cs:565-585)
// — record 8349 + GetHolidayId(classic minutes, CurrentRegionIndex),
// ClickAnywhereToClose, and `holidayTextTimer = 10f` at :584 OUTSIDE
// the `if (holidayId != 0)` block. Primed only on the town arm of
// PlayerGPS_OnEnterLocationRect (:1382-1383 under :1362's
// `!isPlayerInside`, 2.5 s at :1406), drained in Update (:355-368).
// ---------------------------------------------------------------
test('audit64 F10: the record id is 8349 + holidayId, and 0 when today is not a holiday', () => {
  assert.equal(HOLIDAYS_START_ID, 8349);
  // Day 1 of the year is New Life (holiday id 1), celebrated
  // everywhere (REGION_CELEBRATING_HOLIDAY 0xFF).
  const newLife = dateToClassicMinutes({ year: 405, month: 0, day: 0, hour: 12, minute: 0 });
  assert.equal(getHolidayId(newLife, 17), HOLIDAYS.New_Life);
  assert.equal(holidayTextId(newLife, 17), 8349 + HOLIDAYS.New_Life);
  // Day 2 is not a holiday anywhere.
  const plainDay = newLife + 1440;
  assert.equal(getHolidayId(plainDay, 17), HOLIDAYS.None);
  assert.equal(holidayTextId(plainDay, 17), 0);
});

test('audit64 F10: only DFU\'s TOWN arm primes — dungeons, graveyards, covens and moorings do not', () => {
  // :1364-1367 take the flavour-text arm and prime nothing; :1382-1383
  // excludes Coven and HomeYourShips from the town arm as well.
  for (const t of ['DungeonLabyrinth', 'DungeonKeep', 'DungeonRuin', 'Graveyard', 'Coven', 'HomeYourShips']) {
    assert.equal(holidayTextPrimesFor(LOCATION_TYPES[t]), false, t);
  }
  for (const t of ['TownCity', 'TownHamlet', 'TownVillage', 'Tavern', 'ReligionTemple',
    'ReligionCult', 'HomeFarms', 'HomeWealthy', 'HomePoor']) {
    assert.equal(holidayTextPrimesFor(LOCATION_TYPES[t]), true, t);
  }
});

/** A HolidayTextTimer harness: one location object, a HUD that can be
 *  covered, and a log of the records the box door was handed. */
function harness({ location = { name: 'Daggerfall' }, minutes = 0, region = 17 } = {}) {
  const shown = [];
  let onHUD = true;
  let current = location;
  const deps = {
    currentLocation: () => current,
    onHUD: () => onHUD,
    gameMinutes: () => minutes,
    regionIndex: () => region,
    showRecord: (id) => shown.push(id),
  };
  return {
    timer: new HolidayTextTimer(), deps, shown,
    cover: (v) => { onHUD = !v; },
    leaveTo: (loc) => { current = loc; },
  };
}

test('audit64 F10: the prime is 2.5 s and the box fires only after it drains', () => {
  const newLife = dateToClassicMinutes({ year: 405, month: 0, day: 0, hour: 12, minute: 0 });
  const h = harness({ minutes: newLife });
  h.timer.enterLocationRect(h.deps.currentLocation());
  assert.equal(h.timer.primed, true);
  assert.equal(h.timer.timer, 2.5);
  h.timer.update(1, h.deps);
  assert.deepEqual(h.shown, [], 'nothing at 1 s - the save-game fade-in is still running');
  h.timer.update(1.6, h.deps);
  assert.deepEqual(h.shown, [8349 + HOLIDAYS.New_Life]);
  assert.equal(h.timer.primed, false);
});

test('audit64 F10: leaving the location before the delay expires CANCELS the box', () => {
  const newLife = dateToClassicMinutes({ year: 405, month: 0, day: 0, hour: 12, minute: 0 });
  const h = harness({ minutes: newLife });
  h.timer.enterLocationRect(h.deps.currentLocation());
  h.leaveTo({ name: 'Wayrest' });   // StreamingWorld.CurrentPlayerLocationObject changed (:355)
  h.timer.update(5, h.deps);
  assert.deepEqual(h.shown, []);
  assert.equal(h.timer.primed, false);
  assert.equal(h.timer.timer, 0);
});

test('audit64 F10: a window on top DEFERS the box, it does not drop it', () => {
  const newLife = dateToClassicMinutes({ year: 405, month: 0, day: 0, hour: 12, minute: 0 });
  const h = harness({ minutes: newLife });
  h.timer.enterLocationRect(h.deps.currentLocation());
  h.cover(true);                       // IsPlayerOnHUD false (:364)
  h.timer.update(5, h.deps);
  assert.deepEqual(h.shown, []);
  assert.equal(h.timer.primed, true, 'still primed - the fire waits');
  h.cover(false);
  h.timer.update(0, h.deps);
  assert.deepEqual(h.shown, [8349 + HOLIDAYS.New_Life]);
});

test('audit64 F10: the 10 s re-arm is set even on a NON-holiday, so a border-crosser is not re-checked every frame', () => {
  // PlayerEnterExit.cs:584 sits outside the `if (holidayId != 0)` block.
  const plainDay = dateToClassicMinutes({ year: 405, month: 0, day: 1, hour: 12, minute: 0 });
  const h = harness({ minutes: plainDay });
  h.timer.enterLocationRect(h.deps.currentLocation());
  h.timer.update(3, h.deps);
  assert.deepEqual(h.shown, [], 'not a holiday - no box');
  assert.equal(h.timer.timer, 10, 'but the re-arm is set all the same');
  // and a fresh entry inside those ten seconds primes NOTHING (:1404).
  h.timer.enterLocationRect(h.deps.currentLocation());
  assert.equal(h.timer.primed, false);
});


test('audit64 F10: the region index is the box\'s SECOND argument, and a regional holiday is silent elsewhere', () => {
  // FormulaHelper.GetHolidayId (:1819-1852) matches a row when
  // `regionIndexCelebratingHoliday[id] == 0xFF ||
  //  regionIndexCelebratingHoliday[id] == regionIndex + 1` (:1841).
  // Row 1 is Scour Day: region byte 0x19 (REGION ID 25, so region
  // INDEX 24) on day-of-year 0x02. Any other region gets no box at
  // all — which is what a host handing ShowHolidayText the wrong
  // region index (or a constant) turns into a wrong-province
  // announcement.
  const day2 = dateToClassicMinutes({ year: 405, month: 0, day: 1, hour: 12, minute: 0 });
  assert.equal(holidayTextId(day2, 24), 8349 + HOLIDAYS.Scour_Day);
  for (const region of [0, 17, 23, 25, 30]) assert.equal(holidayTextId(day2, region), 0, `region ${region}`);

  // And the drain really does spend the deps' regionIndex: the same
  // frame, the same day, two regions, two outcomes — with the ten
  // second re-arm (:584) set either way.
  for (const [region, expected] of [[24, [8349 + HOLIDAYS.Scour_Day]], [0, []]]) {
    const h = harness({ minutes: day2, region });
    h.timer.enterLocationRect(h.deps.currentLocation());
    h.timer.update(2.6, h.deps);
    assert.deepEqual(h.shown, expected, `region ${region}`);
    assert.equal(h.timer.timer, 10, `region ${region} re-arm`);
  }
});

// The two exterior hosts' own names for the two arguments that decide
// whether the parchment works at all: StreamingWorld
// .CurrentPlayerLocationObject (the identity :355 compares) and
// PlayerGPS.CurrentRegionIndex (:570). world.js reads the POLITIC
// index through _questRegionIndex(), exterior.js reads its one
// location's own regionIndex — every other CurrentRegionIndex read in
// each host uses the same idiom.
const HOLIDAY_HOSTS = [
  { file: 'src/scenes/world.js', region: '_questRegionIndex()' },
  { file: 'src/scenes/exterior.js', region: 'dfLocation.regionIndex' },
];
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The host's `_holidayText.update(dt, { … });` block, as source text. */
function drainBlock(text, file) {
  const at = text.indexOf('_holidayText.update(dt, {');
  assert.ok(at > 0, `${file} must drain the holiday timer per frame (PlayerEnterExit.cs:355-368)`);
  const end = text.indexOf('\n    });', at);
  assert.ok(end > at, `${file}'s drain block must close`);
  return { at, block: text.slice(at, end) };
}

test('audit64 F10: each host PRIMES with the very object its drain compares against', () => {
  // PlayerEnterExit.cs:1409 stores `GameManager.Instance.StreamingWorld
  // .CurrentPlayerLocationObject` into holidayTextLocation and :355
  // cancels when `holidayTextLocation != <that same expression>` — a
  // C# REFERENCE comparison, so the two must be the one object. Hand
  // the prime anything else and the cancel fires on the very next
  // frame: the box can never appear in any town on any holiday.
  for (const { file } of HOLIDAY_HOSTS) {
    const text = src(file);
    const { block } = drainBlock(text, file);
    const m = /currentLocation:\s*\(\)\s*=>\s*([A-Za-z0-9_$.]+)\s*,/.exec(block);
    assert.ok(m, `${file}'s drain must name its CurrentPlayerLocationObject`);
    const loc = m[1];
    assert.match(
      text,
      new RegExp(`_holidayText\\.enterLocationRect\\(\\s*${reEscape(loc)}\\s*\\)`),
      `${file} must prime with ${loc} — the SAME object its drain's currentLocation() returns, or :355's identity cancel kills the box on the next frame`,
    );
    // and behind DFU's town arm (:1382-1383), never on the bare edge.
    assert.match(
      text,
      new RegExp(`^\\s*if \\(holidayTextPrimesFor\\(.*\\)\\) _holidayText\\.enterLocationRect\\(\\s*${reEscape(loc)}\\s*\\);`, 'm'),
      `${file} must gate the prime by location type (PlayerEnterExit.cs:1364-1367 / :1382-1383)`,
    );
  }
});

test('audit64 F10: each host spends the RIGHT region index, clock and HUD flag on the drain', () => {
  for (const { file, region } of HOLIDAY_HOSTS) {
    const { block } = drainBlock(src(file), file);
    // PlayerGPS.CurrentRegionIndex (:570). A constant or the wrong
    // region source announces a regional holiday in the wrong province
    // (FormulaHelper.cs:1841).
    assert.match(
      block,
      new RegExp(`regionIndex:\\s*\\(\\)\\s*=>\\s*${reEscape(region)}\\s*,`),
      `${file} must hand ShowHolidayText ${region} — its own PlayerGPS.CurrentRegionIndex (PlayerEnterExit.cs:570)`,
    );
    // ToClassicDaggerfallTime (:569) — GetHolidayId's whole day
    // arithmetic is in classic minutes.
    assert.match(block, /gameMinutes:\s*\(\)\s*=>\s*Math\.floor\(playerTicker\.classicMinutes\)/, `${file} must hand it CLASSIC minutes (:569)`);
    // GameManager.IsPlayerOnHUD (GameManager.cs:400-402 -> IsHUDTopWindow
    // :915): a window on top DEFERS the fire, so the term must be the
    // host's own top-window question, not a drop.
    assert.match(block, /onHUD:\s*\(\)\s*=>\s*!gamePaused\(\)/, `${file} must defer under a window (:364)`);
    // SetTextTokens(int) with ClickAnywhereToClose (:573-575).
    assert.match(block, /showRecord: \(id\)/, `${file} must wire the message-box door`);
  }
});

test('audit64 F10: the drain runs ABOVE the modal gate — PlayerEnterExit.Update is not suspended indoors', () => {
  // DFU's drain is in PlayerEnterExit.Update (:325, the block at
  // :355-368), which carries NO isPlayerInside guard: the component
  // ticks every frame whether the player is in a street, a tavern or a
  // dungeon. `IsPlayerOnHUD` (GameManager.cs:400-402 -> IsHUDTopWindow
  // :915) is a UI-window test, not a location test, so walking through
  // a tavern door 1 s after crossing the city border must NOT lose the
  // parchment — it fires inside. Both hosts' `modes.frame(dt, now)`
  // returns true in the interior/dungeon modes and the caller RETURNS
  // (worldModes.js frame: "the host's exterior path must not run"), so
  // a drain placed below that gate would stop for exactly the case DFU
  // keeps running.
  for (const { file } of HOLIDAY_HOSTS) {
    const text = src(file);
    const { at } = drainBlock(text, file);
    const gate = text.indexOf('if (modes.frame(dt, now)) {');
    assert.ok(gate > 0, `${file} must have a modal gate to place the drain against`);
    assert.ok(
      at < gate,
      `${file}: the holiday drain must sit ABOVE the modal gate — PlayerEnterExit.Update (:325/:355-368) has no isPlayerInside guard, so the box must still fire after the player steps indoors`,
    );
  }
});
