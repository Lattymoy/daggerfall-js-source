// A1 (ROAD TO 1:1): THE TEXTURE SEASON READS THE CALENDAR.
//
// The port had a calendar (S28) and a texture season, and nothing
// joined them: `?season` was parsed once at boot and
// DaggerfallDateTime.SeasonValue was never asked, so winter climate
// swaps, the winter ground archive, the winter nature scatter, the
// winter footstep set and the winter sun could only be reached with a
// URL. Evening Star arrived and the world stayed green.
//
// The reference writes the same one-line test at every production
// site - ClimateSwaps.cs:382-386, DaggerfallLocation.ApplyTimeAndSpace
// (:135-139), StreamingWorld.cs:812, RuntimeMaterials.cs:169,
// DaggerfallBankPurchasePopUp.cs:265 - and polls it LIVE
// (DaggerfallLocation.Update :118-130, PlayerFootsteps :107/:122-133).
//
// The law is pure, so it is tested behaviourally; the host wiring
// needs GL and ARENA2, so it is pinned on the host source the way
// audit23_hosts/audit39_terrainlayout pin theirs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SEASON, INTERIOR_SEASON, climateSeasonFromDate, climateSeasonFromMinutes,
  getGroundArchive, getNatureArchive, applyClimate,
} from '../src/world/climateSwaps.js';
import { seasonOverride } from '../src/scenes/shared.js';
import { weatherSunlightScale } from '../src/world/weather.js';
import {
  SEASONS, MINUTES_PER_DAY, DAYS_PER_MONTH, CLASSIC_GAME_START_TIME,
  dateToClassicMinutes, dateFromClassicMinutes, seasonValue,
} from '../src/systems/gameDate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const HOSTS = ['src/scenes/exterior.js', 'src/scenes/world.js'];

test('A1: the world clock answers ClimateSeason Winter or Summer, and only those two', () => {
  // ClimateSwaps.cs:382-386 is the conversion written out:
  //     ClimateSeason climateSeason = ClimateSeason.Summer;
  //     if (worldSeason == DaggerfallDateTime.Seasons.Winter)
  //         climateSeason = ClimateSeason.Winter;
  // Spring and Fall are SUMMER to the texture swaps - there is no
  // spring archive in the data - and ClimateSeason.Rain is unreachable
  // from the clock in the whole reference.
  const byMonth = [...Array(12).keys()].map((month) => climateSeasonFromDate({ month }));
  // Evening Star (11), Morning Star (0), Sun's Dawn (1) are the
  // calendar's winter (GetSeasonValue :586-591).
  assert.deepEqual(byMonth, [
    SEASON.Winter, SEASON.Winter, SEASON.Summer, SEASON.Summer,
    SEASON.Summer, SEASON.Summer, SEASON.Summer, SEASON.Summer,
    SEASON.Summer, SEASON.Summer, SEASON.Summer, SEASON.Winter,
  ]);
  assert.ok(!byMonth.includes(SEASON.Rain), 'the clock never selects ClimateSeason.Rain');
  for (let m = 0; m < 12; m++) {
    const want = seasonValue({ month: m }) === SEASONS.Winter ? SEASON.Winter : SEASON.Summer;
    assert.equal(climateSeasonFromDate({ month: m }), want);
  }
});

test('A1: the same law off the one clock - a new game is summer, Evening Star is winter', () => {
  // SetClassicGameStartTime is the 4th of Morning Star (month 0), and
  // month 0 IS winter on GetSeasonValue's clean month boundaries - the
  // quirk DFU's own comment admits and the port carries. So the very
  // first frame of a classic start is a WINTER frame, which is exactly
  // what the old ?season default (summer) got wrong.
  assert.equal(climateSeasonFromMinutes(CLASSIC_GAME_START_TIME), SEASON.Winter);
  const at = (month, day) => dateToClassicMinutes({ year: 405, month, day, hour: 12, minute: 0 });
  assert.equal(climateSeasonFromMinutes(at(4, 0)), SEASON.Summer, 'Second Seed is green');
  assert.equal(climateSeasonFromMinutes(at(11, 0)), SEASON.Winter, 'Evening Star is white');
  // ...and it moves ON A DAY BOUNDARY, which is what lets the hosts
  // poll days instead of minutes: the last minute of Frostfall 30 is
  // summer, the first minute of Evening Star 1 is winter.
  const eve = dateToClassicMinutes({ year: 405, month: 10, day: DAYS_PER_MONTH - 1, hour: 23, minute: 59 });
  assert.equal(climateSeasonFromMinutes(eve), SEASON.Summer);
  assert.equal(climateSeasonFromMinutes(eve + 1), SEASON.Winter);
  assert.equal(dateFromClassicMinutes(eve + 1).month, 11);
});

test('A1: the calendar reaches the archives - ground, nature, climate swap, sun', () => {
  // The four things the season actually moves, driven from a date
  // rather than a URL. Temperate ground 302 -> 303 (GetGroundArchive
  // +1), temperate woodland nature 504 -> 505 (GetNatureArchive's
  // wintering set), the city-A rebase 312 -> 313 (ApplyClimate's
  // supportsWinter arm), and SetSunlightScale's 0.65 winter scale.
  const winter = climateSeasonFromMinutes(dateToClassicMinutes({ year: 405, month: 11, day: 4 }));
  const summer = climateSeasonFromMinutes(dateToClassicMinutes({ year: 405, month: 5, day: 4 }));
  assert.equal(getGroundArchive(300, summer), 302);
  assert.equal(getGroundArchive(300, winter), 303);
  assert.equal(getNatureArchive(504, summer), 504);
  assert.equal(getNatureArchive(504, winter), 505);
  assert.equal(applyClimate(12, 0, 300, summer), 312);
  assert.equal(applyClimate(12, 0, 300, winter), 313);
  assert.equal(weatherSunlightScale('sunny', summer === SEASON.Winter), 1);
  assert.equal(weatherSunlightScale('sunny', winter === SEASON.Winter), 0.65);
});

test('A1: ?season is a debug OVERRIDE now - null when nothing pinned it', () => {
  // The ?cull=off shape: a probe still nails a season for a shot, and
  // an empty URL means "ask the clock", not "summer". The old parser
  // answered SEASON.Summer for a missing param, which is precisely how
  // the calendar got locked out.
  const p = (q) => new URLSearchParams(q);
  assert.equal(seasonOverride(p('')), null);
  assert.equal(seasonOverride(p('loc=Daggerfall')), null);
  assert.equal(seasonOverride(p('season=winter')), SEASON.Winter);
  assert.equal(seasonOverride(p('season=WINTER')), SEASON.Winter);
  assert.equal(seasonOverride(p('season=rain')), SEASON.Rain, 'the unreachable-from-the-clock arm stays hand-selectable');
  assert.equal(seasonOverride(p('season=summer')), SEASON.Summer);
  assert.equal(seasonOverride(p('season=nonsense')), null, 'a typo falls to the clock, not to summer');
});

test('A1: an interior is summer-skinned whatever the date outside', () => {
  // DaggerfallInterior.cs:51 declares `ClimateSeason climateSeason =
  // ClimateSeason.Summer;` and the class NEVER assigns it - :473,
  // :517 and :1270 are the only other mentions and all three are
  // reads. So the exterior season stops at the threshold: with the
  // calendar now driving winter for real, a door carrying the world's
  // season inside would have winter-skinned interiors the reference
  // never winter-skins.
  assert.equal(INTERIOR_SEASON, SEASON.Summer);
  for (const host of HOSTS) {
    const text = read(host);
    assert.match(text, /climateBase, season: INTERIOR_SEASON/,
      `${host}: the static door hands the interior its own constant season`);
    assert.doesNotMatch(text, /climateBase, season,/,
      `${host}: the world season is crossing the threshold again`);
  }
});

test('A1: both hosts take the season from the clock, with ?season demoted to a pin', () => {
  for (const host of HOSTS) {
    const text = read(host);
    assert.match(text, /const seasonPin = seasonOverride\(params\);/,
      `${host}: ?season is still the source, not an override`);
    assert.match(text, /let season = seasonPin \?\? climateSeasonFromMinutes\(worldMinutes\(\)\);/,
      `${host}: the season must fall back to the one clock`);
    // `let`, because both hosts re-read it: the old `const season`
    // could not have been re-read even if something wanted to.
    assert.doesNotMatch(text, /const season = /, `${host}: the season is frozen again`);
    // PlayerFootsteps (:107, :122-133) re-reads SeasonValue every
    // frame and re-picks the set; the snow crunch is not a boot value.
    assert.match(text, /winter: season === SEASON\.Winter/,
      `${host}: the footstep set lost its winter arm`);
    // SetSunlightScale (WeatherManager.cs:316-319).
    assert.match(text, /weatherSun = weatherSunlightScale\(weather, season === SEASON\.Winter\)/,
      `${host}: the winter sun lost its term`);
    // The poll is on the frame, beside the weather drain, and it only
    // builds a date when the DAY turns over.
    assert.match(text, /const day = Math\.floor\(worldMinutes\(\) \/ MINUTES_PER_DAY\);\s*\n\s*if \(day === _seasonDay\) return/,
      `${host}: the season poll must be day-grained, not per-minute`);
    assert.match(text, /if \(seasonPin !== null\) return/,
      `${host}: a pinned ?season must not be walked over by the clock`);
  }
});

test('A1: the streaming host re-skins what already stands, without unloading it', () => {
  // DaggerfallLocation.Update (:118-130) -> ApplyTimeAndSpace
  // (:133-148): the standing location is RE-SKINNED when SeasonValue
  // moves. This host bakes its swaps into GL uploads, so the
  // equivalent is destroyPixel + requeue - but that must NOT be an
  // unload: the reference's terrain never goes away for a season
  // change, so its loose piles and corpses do not either
  // (CollectLooseObjects is the unload's, StreamingWorld.cs:1040-1052).
  const world = read('src/scenes/world.js');
  assert.match(world, /function destroyPixel\(px, py, \{ collectLoose = true \} = \{\}\) \{/,
    'destroyPixel lost the re-skin door');
  assert.match(world, /if \(collectLoose\) droppedLoot\.collectPixel\(key\);/);
  assert.match(world, /if \(collectLoose\) \{ cityGuards\.collectPixel\(key\); exteriorFoes\.collectPixel\(key\); \}/);
  assert.match(world, /destroyPixel\(bx, by, \{ collectLoose: false \}\);/,
    'the season rebuild must not sweep loose objects');
  // The pixels stay in state.loaded ("built or building") - releasing
  // them would let the next crossing list them a second time.
  const tick = world.slice(world.indexOf('function tickSeason()'), world.indexOf('function tickSeason()') + 1800);
  assert.doesNotMatch(tick, /state\.release/, 'the re-skin released the pixels it is about to rebuild');
  assert.match(tick, /queue\.push\(\.\.\.rebuild\)/, 'the torn-down pixels must be queued back');
  // ...and it waits for a build in flight: buildPixel publishes only at
  // its very end, so tearing down a key that has no entry yet frees
  // nothing and orphans everything the finished build made (the hazard
  // pump re-checks for after its own await, AUDIT 24).
  assert.match(tick, /if \(!_reskinPending \|\| building\) return;/,
    'the re-skin must not tear down a pixel whose textures are still crossing');
  assert.match(world, /^\s*tickSeason\(\);$/m, 'nothing calls the season poll on the frame');
  // A fast travel is where the calendar jumps weeks: straighten the
  // season BEFORE the destination pixel builds, and take the quiet
  // path - the teleport's own teardown is a real unload.
  const tp = world.slice(world.indexOf('async function _teleportToPixel'));
  const refresh = tp.indexOf('refreshSeason();');
  const teardown = tp.indexOf('for (const key of [...built.keys()])');
  assert.ok(refresh > 0 && refresh < teardown,
    'the teleport must re-read the season before it rebuilds the world');
});
