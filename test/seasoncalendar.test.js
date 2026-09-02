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
import { PlayerMotor, FALL_DAMAGE_THRESHOLD } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

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
    // PIN MOVED (ROAD-Ar, R1): the streaming host's refreshSeason now
    // takes the clock to READ, because a fast travel has to straighten
    // from the arrival minute - performFastTravel raises time only
    // after TeleportToCoordinates (:333, :344) and the port keeps that
    // order. So the needle is the day-grained SHAPE rather than the
    // literal `worldMinutes()` both hosts used to inline; `atMinutes`
    // defaults to that same clock for every other caller.
    assert.match(text, /const day = Math\.floor\((?:worldMinutes\(\)|atMinutes) \/ MINUTES_PER_DAY\);\s*\n\s*if \(day === _seasonDay\) return/,
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
  const refresh = tp.indexOf('refreshSeason(arriveMinutes ?? worldMinutes());');
  const teardown = tp.indexOf('for (const key of [...built.keys()])');
  assert.ok(refresh > 0 && refresh < teardown,
    'the teleport must re-read the season before it rebuilds the world');
});

// =====================================================================
// ROAD-Ar R0 - the re-skin must not delete the ground under a live
// player. DaggerfallLocation.Update (:118-130) -> ApplyTimeAndSpace
// (:133-148) -> ApplyClimateSettings is an IN-PLACE material swap on
// standing geometry: the reference never removes terrain for a season
// change, so it has no outage and no fall exposure at all. This host
// bakes its swaps into GL uploads and has to destroy and rebuild the
// pixel, which takes the collider bucket and the terrain floor with
// it - so the port owes the equivalent of "the player never left the
// ground", and the way to owe it is to hold the motor.
// =====================================================================

const STILL = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const QUAD = (y) => new Float32Array([-20, y, -20, 20, y, -20, 20, y, 20, -20, y, 20]);
const QUAD_IX = new Uint32Array([0, 1, 2, 0, 2, 3]);
/** The pixel the player stands on: a building roof at 110 in its own
 *  collider bucket, over terrain at 100. destroyPixel takes BOTH
 *  (removeBucket, and `built.delete` which turns heightAt into
 *  -Infinity), so this is the outage in miniature. */
function reskinRig() {
  let floor = 100;
  const col = new Collider(() => floor);
  const add = () => col.addMesh('7,7', QUAD(110), QUAD_IX, IDENTITY);
  add();
  const motor = new PlayerMotor(col);
  motor.spawn(0, 110, 0);
  motor.update(1 / 60, STILL, 0, 0);
  return {
    motor,
    tearDown() { col.removeBucket('7,7'); floor = -Infinity; },
    rebuild() { add(); floor = 100; },
  };
}

test('ROAD-Ar R0: a torn-down pixel is NO FLOOR, and a motor left running is billed the roof it was standing on', () => {
  const rig = reskinRig();
  assert.equal(rig.motor.grounded, true, 'the player starts standing on the pixel');
  const stood = rig.motor.pos[1];
  rig.tearDown();
  // heightAt answers -Infinity for a key that has left `built`, and
  // Collider's last-resort clamp is `feet[1] < floor + SKIN`, which
  // can never fire against it: nothing holds the player up at all.
  for (let i = 0; i < 60; i++) rig.motor.update(1 / 60, STILL, 0, 0);
  assert.equal(rig.motor.grounded, false, 'one second of outage, in free fall');
  assert.ok(rig.motor.pos[1] < stood - FALL_DAMAGE_THRESHOLD, 'and well past the threshold');
  // ...and the ledger is settled against fallStart the moment the
  // rebuilt pixel returns (AcrobatMotor's grounded branch): the floor
  // clamp catches him on the TERRAIN, ten metres under the roof he
  // never stepped off.
  rig.rebuild();
  rig.motor.update(1 / 60, STILL, 0, 0);   // the collider catches him...
  assert.equal(rig.motor.grounded, true, 'the rebuilt pixel is ground again');
  rig.motor.update(1 / 60, STILL, 0, 0);   // ...and FixedUpdate's next pass settles the ledger
  assert.ok(rig.motor.landedFallDistance > FALL_DAMAGE_THRESHOLD,
    'the re-skin arrives as fall damage - the defect this fix exists for');
});

test('ROAD-Ar R0: a HELD motor crosses the same outage unmoved and unbilled', () => {
  // The fix's law: not calling update() at all is this port's nearest
  // thing to ApplyClimateSettings, because the player does not move -
  // no gravity is integrated, so position, fallStart and `falling`
  // are exactly what they were when the ground went away.
  const rig = reskinRig();
  const stood = rig.motor.pos[1];
  rig.tearDown();
  for (let i = 0; i < 60; i++) { /* the host runs no update while _seasonHeld */ }
  assert.equal(rig.motor.pos[1], stood, 'a held motor does not fall');
  rig.rebuild();
  // The release re-anchors the fall the way _teleportToPixel's landing
  // does - spawn() clears `falling` and puts fallStart at the feet.
  rig.motor.spawn(rig.motor.pos[0], rig.motor.pos[1], rig.motor.pos[2]);
  assert.equal(rig.motor.fallStart, stood);
  assert.equal(rig.motor.falling, false);
  rig.motor.update(1 / 60, STILL, 0, 0);
  rig.motor.update(1 / 60, STILL, 0, 0);
  assert.equal(rig.motor.grounded, true, 'and he is standing where he stood');
  assert.equal(rig.motor.pos[1], stood);
  assert.ok(rig.motor.landedFallDistance <= FALL_DAMAGE_THRESHOLD,
    'nothing is billed for the outage');
});

test('ROAD-Ar R0: the streaming host arms the hold before the teardown and releases it on the rebuilt pixel', () => {
  // Host wiring, so it is pinned at its source like the rest of this
  // file. The three halves that have to stay joined: the arm (before
  // the ground goes), the release (on the player's own pixel, with
  // the re-anchoring spawn), and the gate on the motor itself.
  const world = read('src/scenes/world.js');
  const tick = world.slice(world.indexOf('function tickSeason()'));
  const arm = tick.indexOf('_seasonHoldKey = `${state.current.x},${state.current.y}`');
  const teardown = tick.indexOf('destroyPixel(bx, by, { collectLoose: false });');
  assert.ok(arm > 0 && arm < teardown,
    'the hold must be armed while the player still has a pixel to name');
  assert.match(world, /if \(_seasonHoldKey !== null && \(built\.has\(_seasonHoldKey\) \|\| \(!building && !queue\.length\)\)\) \{\s*\n\s*player\.spawn\(player\.pos\[0\], player\.pos\[1\], player\.pos\[2\]\);\s*\n\s*_seasonHoldKey = null;/,
    'the release must wait for the pixel and re-anchor the fall (and never wedge)');
  assert.match(world, /const _seasonHeld = _seasonHoldKey !== null;/);
  assert.match(world, /if \(!_overlayHeld && !_seasonHeld\) player\.update\(dt,/,
    'the motor must not integrate gravity while the ground is being rebuilt');
  assert.match(world, /if \(!_seasonHeld\) applyFallLanding\(playerEntity, player\.landedFallDistance,/,
    'and a frame the motor never ran reports no landing');
  // The teleport core owns its own landing (player.spawn), so it drops
  // any hold on the way through rather than testing a stale key
  // against a brand-new origin.
  const tp = world.slice(world.indexOf('async function _teleportToPixel'));
  assert.ok(tp.indexOf('_seasonHoldKey = null;') > 0
    && tp.indexOf('_seasonHoldKey = null;') < tp.indexOf('for (const key of [...built.keys()])'),
    'the teleport clears the hold before it re-origins the streamer');
});

// =====================================================================
// ROAD-Ar R1 - the straightening must read the ARRIVAL clock.
// =====================================================================

test('ROAD-Ar R1: fast travel hands the teleport core the minute it is about to arrive at', () => {
  // performFastTravel calls TeleportToCoordinates (:333) and only then
  // RaiseTime (:344), and this port keeps that order - so the one
  // clock still reads the DEPARTURE date inside _teleportToPixel, and
  // reading it there straightened nothing on exactly the trip the
  // straightening exists for. The reference-faithful half of the fix
  // is to pass the arrival minute rather than to move RaiseTime.
  const world = read('src/scenes/world.js');
  assert.match(world, /async function _teleportToPixel\(px, py, localPos = null, \{ grounded = false, arriveMinutes = null \} = \{\}\)/,
    'the core takes the arrival clock');
  assert.match(world, /refreshSeason\(arriveMinutes \?\? worldMinutes\(\)\);/,
    'and straightens from it, falling back to the live clock for every other caller');
  assert.match(world, /function refreshSeason\(atMinutes = worldMinutes\(\)\) \{[\s\S]{0,400}?Math\.floor\(atMinutes \/ MINUTES_PER_DAY\)[\s\S]{0,200}?climateSeasonFromMinutes\(atMinutes\)/,
    'refreshSeason must read the minute it was given, both times');
  // The CALLER order, which the old pin could not see: the teleport
  // is handed worldMinutes() + the journey, and RaiseTime still runs
  // after it, exactly where DaggerfallTravelPopUp puts it.
  const i = world.indexOf('async function fastTravelTo');
  const fn = world.slice(i, world.indexOf('const toggleTravelMap', i));
  const teleport = fn.indexOf('await _teleportToPixel(pick.pixel.x, pick.pixel.y, null,\n        { arriveMinutes: worldMinutes() + computed.minutes });');
  const raise = fn.indexOf('playerTicker.advance(computed.minutes)');
  assert.ok(teleport > 0, 'the arrival minute rides the teleport');
  assert.ok(raise > teleport, 'and RaiseTime still comes after it (:333 then :344)');
});

test('R1 CLOSEOUT: the frame cannot poll the straightened season away while the destination builds', () => {
  // R1 straightened the season off the ARRIVAL clock, and the frame
  // loop put it straight back. DaggerfallTravelPopUp runs
  // TeleportToCoordinates (:333) and RaiseTime (:344) inside ONE Unity
  // frame with nothing between them, so the state R1 creates - the
  // season cache holding the ARRIVAL month while the one clock still
  // reads the DEPARTURE minute - cannot be observed there. Here it can:
  // the destination pixel is built across an await, and the frame's
  // tickSeason has no travel gate.
  //
  // The mechanism, over the real law: refreshSeason latches its day AND
  // its season from whatever clock it is handed, with no memory that
  // the clock was a future one - so a live-clock re-read during the
  // build sees the day go BACKWARDS and reassigns both.
  const departure = dateToClassicMinutes({ year: 405, month: 5, day: 0, hour: 12, minute: 0 });   // Second Seed
  const arrival = dateToClassicMinutes({ year: 405, month: 11, day: 0, hour: 12, minute: 0 });    // Evening Star
  assert.equal(climateSeasonFromMinutes(departure), SEASON.Summer);
  assert.equal(climateSeasonFromMinutes(arrival), SEASON.Winter);
  assert.notEqual(Math.floor(arrival / MINUTES_PER_DAY), Math.floor(departure / MINUTES_PER_DAY),
    'the day moves, which is the only thing refreshSeason gates on - so a live re-read is not a no-op');
  // buildPixelNow reads `season` only AFTER its own await, so whatever
  // the last write left is what the destination is skinned with.
  const world = read('src/scenes/world.js');
  const build = world.slice(world.indexOf('async function buildPixelNow'));
  assert.ok(build.indexOf('await terrainGen.generate') < build.indexOf('getTerrainGroundArchive(climate, season)'),
    'the ground archive is chosen after the worker yields - the window is real');

  // THE LATCH. The frame's poll is the first thing tickSeason answers
  // to, the teleport raises it beside the straightening, and it comes
  // down in a `finally` so a failed build cannot switch the frame's
  // season off for the rest of the session.
  const tick = world.slice(world.indexOf('function tickSeason() {'));
  assert.match(tick.slice(0, tick.indexOf('\n  }')), /^function tickSeason\(\) \{\n(\s*\/\/[^\n]*\n)*\s*if \(_seasonStraightening\) return;[^\n]*\n\s*if \(refreshSeason\(\)\) _reskinPending = true;/,
    'the frame poll stands down FIRST - above the refreshSeason that would otherwise mutate the cache');
  const tp = world.slice(world.indexOf('async function _teleportToPixel'));
  const core = tp.slice(0, tp.indexOf('\n  }'));
  const straighten = core.indexOf('refreshSeason(arriveMinutes ?? worldMinutes());');
  const raise = core.indexOf('_seasonStraightening = true;');
  const build2 = core.indexOf('await buildPixel(first.px, first.py);');
  const clear = core.indexOf('finally { _seasonStraightening = false; }');
  assert.ok(straighten > 0 && raise > straighten, 'the latch goes up with the straightening');
  assert.ok(build2 > raise, '...before the destination build yields');
  assert.ok(clear > build2, '...and comes down only once it has landed');
  assert.match(core, /try \{ dest = await buildPixel\(first\.px, first\.py\); \}\n\s*finally \{ _seasonStraightening = false; \}/,
    'in a `finally`, so a throwing build cannot leave the frame poll off');
});
