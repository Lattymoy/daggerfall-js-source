// W1: THE WEATHER SIMULATION - the Chronicles pg. 47 climate/season
// table (WeatherTable.json digit for digit), the cumulative roll
// (Weather.cs:116-129), the six-zone daily re-roll (PlayerEntity.cs:
// 440-448 + WeatherManager.SetClimateWeathers), the respawn re-roll
// (WeatherManager.cs:514-522), and the one persisted value
// (SerializablePlayer's playerPosition.weather).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEATHER_TABLE, WEATHER_ENUM, weatherTableFor, rollWeather,
  setClimateWeathers, weatherForClimate, tickWeather, weatherRespawn,
  applyClimateWeather, setWeather, currentWeather, restoreWeather, resetWeatherSim,
  rollClimateWeathersForDay,
} from '../src/systems/weatherSim.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p2) => readFileSync(join(ROOT, p2), 'utf8');
import { CLIMATES } from '../src/formats/mapsFile.js';
import { SEASONS, MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

test('W1 table: every climate/season row sums to 100 - the Chronicles page needs no normalization', () => {
  for (const [climate, seasons] of Object.entries(WEATHER_TABLE)) {
    for (const [season, row] of Object.entries(seasons)) {
      const total = row.reduce((a, b) => a + b, 0);
      assert.equal(total, 100, `${climate}/${season} sums ${total}`);
      assert.equal(row.length, 7);
    }
  }
});

test('W1 dispatch: Ocean rolls the SWAMP table, MountainWoods the Mountains, unknown answers Sunny (Weather.cs:200-224)', () => {
  assert.equal(weatherTableFor(CLIMATES.Ocean), WEATHER_TABLE.swamp);
  assert.equal(weatherTableFor(CLIMATES.MountainWoods), WEATHER_TABLE.mountains);
  assert.equal(weatherTableFor(CLIMATES.HauntedWoodlands), WEATHER_TABLE.woodlands);
  assert.equal(rollWeather(999, SEASONS.Summer, () => 0.99), WEATHER_ENUM.sunny, 'the LogWarning + Sunny arm');
});

test('W1 roll: the cumulative walk with its <= 0 boundary and the compiled Snow-before-Thunder order', () => {
  // Desert Winter row [75, 15, 0, 3, 5, 0, 2]
  const dw = (r) => rollWeather(CLIMATES.Desert, SEASONS.Winter, () => r);
  assert.equal(dw(0.74), WEATHER_ENUM.sunny);
  assert.equal(dw(0.75), WEATHER_ENUM.sunny, 'rand - chance == 0 still lands (<= 0)');
  assert.equal(dw(0.76), WEATHER_ENUM.cloudy);
  assert.equal(dw(0.9299), WEATHER_ENUM.fog, 'the zero-width Overcast column is stepped over');
  assert.equal(dw(0.97), WEATHER_ENUM.rain);
  assert.equal(dw(0.99), WEATHER_ENUM.thunder, 'the zero-width Snow column sits BEFORE Thunder (Weather.cs:94-100)');
  // Mountains Winter [18, 20, 25, 2, 0, 35, 0] - snow country
  assert.equal(rollWeather(CLIMATES.Mountain, SEASONS.Winter, () => 0.99), WEATHER_ENUM.snow);
  // a snow-free climate's rows really carry no snow column
  for (const row of Object.values(WEATHER_TABLE.desert)) assert.equal(row[5], 0);
});

test('W1/S41 daily tick: the ROLL is the day block\'s and the APPLY is the frame\'s, and the frame drains the flag exactly once', () => {
  resetWeatherSim();
  try {
    // S41 split tickWeather in two. The DAY CHANGE rolls the zones and
    // raises WeatherManager's updateWeatherFromClimateArray; the
    // EXTERIOR FRAME drains that flag. Before the split both halves
    // sat behind weatherSim's own private `_lastDay`, which is why a
    // day boundary crossed underground rolled nothing at all.
    //
    // Frame one is the boot roll (StartGameBehaviour.cs:435-436):
    // Woodlands (231) in classic winter, dice pinned high -> snow.
    assert.equal(tickWeather(100, CLIMATES.Woodlands, () => 0.99), true);
    assert.equal(currentWeather(), 'snow');
    // Every later frame with no day change is INERT - it does not
    // even look at the dice, because DFU's is `if (flag)` and nothing
    // has raised it.
    let dice = 0;
    assert.equal(tickWeather(200, CLIMATES.Woodlands, () => { dice++; return 0.0; }), false);
    assert.equal(dice, 0, 'a frame with the flag down consumes no roll');
    assert.equal(currentWeather(), 'snow');

    // THE DAY BLOCK rolls - and does NOT apply. The sky is unchanged
    // until a frame drains the flag, which is what defers a rolled
    // sky to the first frame back outside.
    rollClimateWeathersForDay(100 + MINUTES_PER_DAY, () => 0.0);
    assert.equal(currentWeather(), 'snow', 'the roll alone never touches the sky');
    // ...and now the frame applies it: low dice land Woodlands sunny.
    assert.equal(tickWeather(100 + MINUTES_PER_DAY, CLIMATES.Woodlands, () => 0.99), true);
    assert.equal(currentWeather(), 'sunny', 'the APPLIED value came from the DAY roll, not this frame');
    // and the flag is down again - one drain per raise (:411-414)
    assert.equal(tickWeather(100 + MINUTES_PER_DAY, CLIMATES.Woodlands, () => 0.99), false);
  } finally { resetWeatherSim(); }
});

test('W1/S41 daily tick: a day crossed UNDERGROUND still rolls, and the sky lands on the way out', () => {
  resetWeatherSim();
  try {
    tickWeather(100, CLIMATES.Woodlands, () => 0.99);   // boot: snow
    assert.equal(currentWeather(), 'snow');
    // Ten days pass in a dungeon. No exterior frame runs, so the old
    // fused tickWeather saw nothing at all; the day block runs
    // wherever the player is, exactly as PlayerEntity.Update does.
    for (let d = 1; d <= 10; d++) rollClimateWeathersForDay(100 + d * MINUTES_PER_DAY, () => 0.0);
    assert.equal(currentWeather(), 'snow', 'still underground - nothing applied');
    // The first frame back outside drains the flag once.
    assert.equal(tickWeather(100 + 10 * MINUTES_PER_DAY, CLIMATES.Woodlands, () => 0.99), true);
    assert.equal(currentWeather(), 'sunny');
  } finally { resetWeatherSim(); }
});

test('W1 zone array: the classic six slots + THE OCEAN QUIRK - the array path reads slot 0 where the roll used the Swamp table', () => {
  resetWeatherSim();
  try {
    // scripted dice: each zone roll consumes one value, in slot order
    // Desert, Mountain, Rainforest, Swamp, Subtropical, Woodlands
    const seq = [0.0, 0.99, 0.0, 0.99, 0.0, 0.99][Symbol.iterator]();
    setClimateWeathers(SEASONS.Winter, () => seq.next().value);
    assert.equal(weatherForClimate(CLIMATES.Desert), WEATHER_ENUM.sunny);
    assert.equal(weatherForClimate(CLIMATES.Mountain), WEATHER_ENUM.snow);
    // MountainWoods reads the WOODLANDS slot (climateIndices 230->5)
    // where the DIRECT roll uses the Mountains table - DFU's own
    // asymmetry, kept as DFU has it
    assert.equal(weatherForClimate(CLIMATES.MountainWoods), weatherForClimate(CLIMATES.Woodlands));
    // THE OCEAN QUIRK (recorded, verbatim): WeatherTable.GetWeather
    // sends Ocean to the Swamp table, but the ARRAY path maps Ocean
    // through climateIndices[0] = slot 0 - the DESERT slot
    // (TravelTimeCalculator.cs:30 vs Weather.cs:210). Two DFU code
    // paths, two answers; the port keeps both, as DFU has them.
    assert.equal(weatherForClimate(CLIMATES.Ocean), weatherForClimate(CLIMATES.Desert));
  } finally { resetWeatherSim(); }
});

test('W1 respawn: only a climate BASE change re-rolls, and it rolls the DESTINATION directly (WeatherManager.cs:514-522)', () => {
  resetWeatherSim();
  try {
    // first arrival: base None -> Desert(0) differs; Desert Winter at 0.99 -> thunder
    assert.equal(weatherRespawn(100, CLIMATES.Desert, () => 0.99), true);
    assert.equal(currentWeather(), 'thunder');
    // Desert2 shares the Desert BASE - no re-roll however loud the dice
    assert.equal(weatherRespawn(100, CLIMATES.Desert2, () => 0.0), false);
    assert.equal(currentWeather(), 'thunder');
    // Mountain is a new base - rolls (0.99 -> Mountains Winter snow)
    assert.equal(weatherRespawn(100, CLIMATES.Mountain, () => 0.99), true);
    assert.equal(currentWeather(), 'snow');
  } finally { resetWeatherSim(); }
});

test('W1 save: one weather value rides every host\'s envelope; the restore stamps the day so boot cannot clobber it', () => {
  resetWeatherSim();
  try {
    setWeather('rain');
    const w = { name: 'W', health: 10, maxHealth: 10, level: 1, stats: {}, skills: [30], skillUses: [], items: [] };
    const snap = JSON.parse(JSON.stringify(snapshotPlayer(w, { classicMinutes: 5000 })));
    assert.equal(snap.weather, 'rain');
    resetWeatherSim();
    assert.equal(currentWeather(), 'sunny');
    restorePlayer({}, snap);
    assert.equal(currentWeather(), 'rain', 'restorePlayer restored the sim');
    // the boot roll is suppressed (startedFromLoadedSaveGame) - the
    // restore stamped the array rolled and the flag down
    assert.equal(tickWeather(5001, CLIMATES.Woodlands, () => 0.99), false);
    assert.equal(currentWeather(), 'rain');
    // a pre-W1 snapshot restores nothing and the current sky stands
    delete snap.weather;
    setWeather('fog');
    restorePlayer({}, snap);
    assert.equal(currentWeather(), 'fog');
  } finally { resetWeatherSim(); }
});

test('W1 restore law: restoreWeather alone pins the value, and no frame can clobber it until a DAY rolls', () => {
  resetWeatherSim();
  try {
    restoreWeather('overcast');
    assert.equal(currentWeather(), 'overcast');
    // startedFromLoadedSaveGame's else arm (WeatherManager.cs:540-542)
    // - the restore stamps the array ROLLED and the pending-apply flag
    // DOWN, so no exterior frame re-rolls or re-applies over the
    // loaded sky, however many frames or in-game days of them run.
    let dice = 0;
    const noisy = () => { dice++; return 0.99; };
    assert.equal(tickWeather(3 * MINUTES_PER_DAY + 100, CLIMATES.Desert, noisy), false);
    assert.equal(tickWeather(4 * MINUTES_PER_DAY, CLIMATES.Desert, noisy), false, 'a later frame is still inert');
    assert.equal(dice, 0, 'the restore left nothing for a frame to roll');
    assert.equal(currentWeather(), 'overcast');
    // Only the DAY BLOCK re-arms it (Desert Winter at 0.99 -> thunder).
    rollClimateWeathersForDay(4 * MINUTES_PER_DAY, () => 0.99);
    assert.equal(tickWeather(4 * MINUTES_PER_DAY, CLIMATES.Desert, () => 0.99), true);
    assert.equal(currentWeather(), 'thunder');
  } finally { resetWeatherSim(); }
});

test('W1 review: fast travel applies the ARRAY slot (OnInitWorld), never a fresh roll; backward time never re-rolls', () => {
  resetWeatherSim();
  try {
    // roll the zones once (winter, loud dice -> mountains snow)
    tickWeather(100, CLIMATES.Woodlands, () => 0.99);
    // a same-day arrival in the mountains applies slot 1 - NO dice consumed
    let diceRolled = 0;
    applyClimateWeather(CLIMATES.Mountain);
    assert.equal(diceRolled, 0);
    assert.equal(currentWeather(), 'snow');
    // S41: the `daysPast > 0` guard that used to live here is the day
    // block's now (runDayChange), and a frame with the flag down is
    // inert whatever the clock says - including a clock that moved
    // BACKWARD, which is a load.
    assert.equal(tickWeather(100 - MINUTES_PER_DAY, CLIMATES.Woodlands, () => { diceRolled++; return 0.0; }), false);
    assert.equal(diceRolled, 0);
  } finally { resetWeatherSim(); }
});

test('W1 review: the precip draw gates on the MODE in both hosts - the renderer object outlives a clear-up', () => {
  // applyWeather lazily creates the PrecipitationRenderer and never
  // drops it; a draw gated on the object alone rained under clear
  // skies forever after the first storm passed (the review's bug).
  assert.match(src('src/scenes/world.js'), /if \(precipMode && precip\) \{/);
  assert.match(src('src/scenes/exterior.js'), /if \(precipMode && precip\) \{/);
  // and the respawner roll lives on the RESPAWNER path alone
  assert.match(src('src/scenes/world.js'), /_respawnAtSite[\s\S]{0,900}weatherRespawn\(/);
  assert.doesNotMatch(src('src/scenes/world.js').slice(0, src('src/scenes/world.js').indexOf('async function _respawnAtSite')), /weatherRespawn\(/, 'no earlier caller - not the teleport, not fast travel');
});
