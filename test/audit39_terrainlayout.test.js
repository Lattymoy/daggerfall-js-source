// AUDIT 39 - TERRAIN & LAYOUT (2026-09-01).
//
// Seven findings over the world-assembly lane: the exterior ambient's
// weather term, the storm strobe on the sun, a production-dead sky
// parameter that was a landmine, the terrain worker's inbound wire, the
// streamed pixel set at the edge of the world map, the windmill
// subrecord that widened the building count on the classic skin, and
// the archive-216 flats that were read as enemy markers.
//
// Where the law is in a host that wants GL and ARENA2, the pin reads
// the host source - the windmillwiring rule, for the R5 reason.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exteriorAmbient, daylightScale } from '../src/world/worldClock.js';
import { skyOffsetForWeather, weatherRng } from '../src/world/weather.js';
import { TerrainGenClient } from '../src/world/terrainGenClient.js';
import { StreamingWorldState, TERRAIN_DISTANCE } from '../src/world/streamingWorld.js';
import { layoutRmbBlock } from '../src/world/rmbLayout.js';
import { blockBuildingCount } from '../src/systems/talkTopics.js';
import { collectDungeonEnemies } from '../src/characters/dungeonEnemies.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const HOSTS = ['src/scenes/exterior.js', 'src/scenes/world.js'];

test('AUDIT 39 #13: the daytime ambient takes the weather scale TWICE', () => {
  // SunlightManager.Update writes the scale into its own backing field
  // (`daylightScale *= ScaleFactor`) while the key light is enabled, and
  // DaylightScale returns that already-scaled field; LateUpdate's
  // CalcDaytimeAmbientLight then multiplies by ScaleFactor again. So the
  // lerp factor is curve x scale^2, not curve x scale.
  const night = 0.25;            // ExteriorNightAmbientLight
  const noonComponent = 0.9;     // ExteriorNoonAmbientLight
  for (const scale of [1, 0.65, 0.45, 0.25]) {
    const s = daylightScale(720) * scale * scale;
    const want = night + (noonComponent - night) * s;
    // the result is a Float32Array - compare at single precision
    assert.ok(Math.abs(exteriorAmbient(720, 1, scale)[0] - want) < 1e-6,
      `weather scale ${scale} is not squared`);
  }
  // The key light is scaled ONCE on both sides, so the two diverge: a
  // storming noon ambient is a quarter of the single-scaled value above
  // the night floor, not the whole of it.
  const storm = exteriorAmbient(720, 1, 0.25)[0];
  const singleScaled = 0.25 + (0.9 - 0.25) * daylightScale(720) * 0.25;
  assert.ok(storm < singleScaled, 'a storming noon is darker than the single-scaled ambient');
  // Night is untouched: the curve is 0 outside dawn-dusk, so squaring
  // multiplies zero (DFU skips the *= there for the same reason).
  assert.deepEqual([...exteriorAmbient(0, 1, 0.25)], [...exteriorAmbient(0, 1, 1)]);
});

test('AUDIT 39 #14: the storm strobe is enhanced-skin only in both hosts', () => {
  // Shipped DFU renders no flash: PlayEffects starts the coroutine only
  // `if (PlayLightningEffect)` and both AmbientEffectsPlayer instances
  // serialize PlayLightningEffect: 0 with LightForEffects unassigned -
  // the storm is sound-only. Even reached, `LightForEffects.intensity =
  // 2f` is an absolute set on that separate light, never a multiplier
  // on SunlightManager's key light.
  for (const host of HOSTS) {
    const text = read(host);
    assert.match(text, /const flash = params\.has\('flashtest'\) \? 2 : \(isEnhanced\(\) \? strobe : 1\);/,
      `${host}: the flash multiplier is not gated on the skin`);
    // The player still ticks on both skins - it is the clip schedule
    // the Audio arc reads, not just the strobe.
    // WX2a (AUDIT 57): the tick is `strobeNow` now - the player still
    // ticks every frame on both skins; the FLASH is withheld under the
    // enhanced front until the storm is shown
    assert.match(text, /const strobeNow = lightning \? lightning\.tick\(dt\) : 1;/,
      `${host}: the lightning player stopped ticking`);
    assert.match(text, /const lightningShown = !enhancedFront \|\| fx\.shown === 'storm' \? lightning : null;\s*\n\s*const strobe = lightningShown \? strobeNow : 1;/,
      `${host}: the flash waits for the storm under the front, and is the player's on classic`);
  }
});

test('AUDIT 39 #15: skyOffsetForWeather answers the WeatherStyle and takes no season', () => {
  // The return feeds `weatherSkyOffset === 0`, which is BOTH the season
  // arm (DaggerfallSky.cs:354-357) and showNightSky
  // (:363-367). A season folded in here would read as a non-Normal
  // style: no night sky on a clear night, and the season added twice.
  assert.equal(skyOffsetForWeather.length, 2, 'the dead season parameter is back');
  const rng = { nextFloat: () => 0.9 };
  for (const w of ['sunny', 'cloudy', 'overcast']) {
    assert.equal(skyOffsetForWeather(w, rng), 0, `${w} is WeatherStyle.Normal`);
  }
  assert.equal(skyOffsetForWeather('rain', weatherRng(1)) >= 4, true);
  // No production caller passes a third argument.
  for (const host of HOSTS) {
    assert.doesNotMatch(read(host), /skyOffsetForWeather\([^)]*,[^)]*,/,
      `${host} passes a season into the WeatherStyle`);
  }
});

test('AUDIT 39 #16: the worker reply crosses WHOLE, like the job', () => {
  // The outbound wire learned this at AUDIT EV F-DOC1 (a spread, not a
  // hand-copied field list). The inbound one was still a seven-name
  // list, so a new generatePixelTerrain output would be produced by the
  // worker, returned by every fallback arm, and dropped only on the
  // worker path - with node green, because node always falls back.
  let onmessage = null;
  const fake = {
    set onmessage(fn) { onmessage = fn; },
    set onerror(fn) { this._e = fn; },
    postMessage: () => {},
    terminate: () => {},
  };
  const c = new TerrainGenClient({
    woods: {}, woodsBytes: new Uint8Array(4), workerFactory: () => fake,
  });
  const p = c.generate({ px: 1, py: 2, tilemap: new Uint8Array(4), climateType: 231 });
  onmessage({ data: { t: 'done', avg: 3.5, aFieldTheKernelGrewLater: 42 } });
  return p.then((out) => {
    assert.equal(out.avg, 3.5);
    assert.equal(out.aFieldTheKernelGrewLater, 42, 'a new kernel output was dropped at the wire');
    assert.equal('t' in out, false, 'the envelope tag leaked into the result');
  });
});

test('AUDIT 39 #17: the streamed set stops at the edge of the world map', () => {
  // PlaceTerrain (StreamingWorld.cs:855-860) refuses any pixel outside
  // 0..999 by 0..499. The port had no bounds test at all, so at the map
  // edge it built terrain, climate, ground archive and nature scatter
  // for coordinates DFU declines to render (WoodsFile clamps and
  // PakFile answers -1, which defaults to Temperate/Woodlands).
  const d = TERRAIN_DISTANCE;
  const nw = new StreamingWorldState();
  const list = nw.init(0, 0);
  assert.equal(list.length, (d + 1) * (d + 1), 'the north-west corner streams a quarter grid');
  for (const p of list) {
    assert.ok(p.px >= 0 && p.px < 1000 && p.py >= 0 && p.py < 500, `${p.px},${p.py} is off the map`);
  }
  const se = new StreamingWorldState();
  for (const p of se.init(999, 499)) {
    assert.ok(p.px < 1000 && p.py < 500, `${p.px},${p.py} is off the map`);
  }
  // ...and an off-map pixel is never marked loaded, so it can never be
  // released or unloaded either.
  assert.equal(nw.loaded.has(StreamingWorldState.key(-1, 0)), false);
  assert.equal(nw.inRange(-1, 0), false, 'an off-map pixel reads as in range');
  assert.equal(nw.inRange(2, 2), true);
  // The interior of the map is untouched: a full grid, as before.
  assert.equal(new StreamingWorldState().init(207, 213).length, (2 * d + 1) ** 2);
});

// The seven FARM* blocks, and a block with no mill, in the shape
// layoutRmbBlock reads.
function farmBlock(name = 'FARMAA00.RMB', records = 2) {
  const groundTiles = [];
  for (let x = 0; x < 16; x++) {
    groundTiles.push(new Array(16).fill(null)
      .map(() => ({ textureRecord: 1, isRotated: false, isFlipped: false })));
  }
  const sub = () => ({
    xPos: 0, zPos: 0, yRotation: 0,
    exterior: { block3dObjectRecords: [] },
    interior: {},
  });
  return {
    name,
    rmbBlock: {
      fldHeader: { numBlockDataRecords: records, groundData: { groundTiles } },
      subRecords: new Array(records).fill(null).map(sub),
      misc3dObjectRecords: [],
    },
  };
}

test('AUDIT 39 #18: the windmill subrecord is attached on the enhanced skin only', () => {
  // subRecords.length IS the building count - DFU scans
  // SubRecords.Length entries of a fixed 32-slot BuildingDataList
  // (RMBLayout.cs:553/:642) - so a synthetic subrecord gives the block
  // one phantom building, which can take a name-pool draw and misalign
  // every named building after it in the location.
  const classic = farmBlock();
  layoutRmbBlock(classic);
  assert.equal(classic.rmbBlock.subRecords.length, 2, 'the classic block grew a subrecord');
  assert.equal(classic.rmbBlock.subRecords.some((r) => r?.windmill), false);
  // The default is classic: a caller that knows nothing about skins
  // gets the block Daggerfall shipped.
  const enhanced = farmBlock();
  const laid = layoutRmbBlock(enhanced, { enhanced: true });
  assert.equal(enhanced.rmbBlock.subRecords.length, 3, 'the mill has no subrecord, so its door has no inside');
  assert.equal(enhanced.rmbBlock.subRecords[2].windmill, true);
  assert.equal(laid.models.some((m) => m.enhancedOnly), true, 'the mill building is not placed');
  // A block with no mill is untouched either way.
  const plain = farmBlock('MAGEAA00.RMB');
  layoutRmbBlock(plain, { enhanced: true });
  assert.equal(plain.rmbBlock.subRecords.length, 2);
});

test('AUDIT 39 #18: the building-count bound cannot be widened by a synthetic subrecord', () => {
  // The three talkTopics scans and quest/place's building search all
  // bound on this. numBlockDataRecords is what blocksFile sized
  // subRecords from, so on an untouched block the two agree.
  const b = farmBlock();
  assert.equal(blockBuildingCount(b), 2);
  layoutRmbBlock(b, { enhanced: true });
  assert.equal(blockBuildingCount(b), 2, 'the mill subrecord widened the building count');
  // A hand-built block with no header count falls back to the array.
  assert.equal(blockBuildingCount({ rmbBlock: { subRecords: [{}, {}, {}] } }), 3);
  assert.equal(blockBuildingCount(null), null);
});

test('AUDIT 39 #19: archive-216 treasure flats are not read as enemy markers', () => {
  // DFU's editorObjects list is archive-199 by construction
  // (RDBLayout.cs:352) and AddFixedEnemies/AddRandomEnemies iterate
  // nothing else, so their record-alone test is safe there. The port
  // shares one markers array, and a 216 flat carries none of the enemy
  // fields: 216/16 spawned a Rat out of `undefined & 0xff`, and 216/15
  // an undefined mobile type with the slot reroll never firing.
  const block = (markers) => ({ markers, waterLevel: 10000, originX: 0, originZ: 0 });
  const treasure = (record) => ({ record, archive: 216, x: 1, y: 2, z: 3, position: 0, action: null });
  assert.deepEqual(collectDungeonEnemies([block([treasure(16), treasure(15)])],
    { locationId: 1, dungeonType: 0 }), []);
  // ...while the editor flats beside them still spawn. An editor marker
  // carries no `archive` field, which is how rdbLayout marks it.
  const editor = {
    record: 16, x: 1, y: 2, z: 3, rawY: 0, flags: 0, soundIndex: 7,
    actionByte: 0, factionOrMobileId: 32,
  };
  const out = collectDungeonEnemies([block([treasure(16), editor, treasure(15)])],
    { locationId: 1, dungeonType: 0 });
  assert.equal(out.length, 1);
  assert.equal(out[0].mobileType, 32);
});

test('AUDIT 39 #20: the windmill subrecord guard no longer claims BlocksFile caches', () => {
  // blocksFile.js sets autoDiscard = true and nothing clears it, so
  // loadBlock discards the previous block on every request: an A,B,A
  // sequence re-parses A into a NEW object. DFU is the same, which is
  // why RMBLayout keeps its own locationCache.
  assert.match(read('src/formats/blocksFile.js'), /this\.autoDiscard = true;/);
  const blocks = read('src/formats/blocksFile.js');
  assert.equal((blocks.match(/this\.autoDiscard\s*=/g) || []).length, 1,
    'autoDiscard is assigned somewhere else now - the rationale must be re-checked');
  const layout = read('src/world/rmbLayout.js');
  assert.doesNotMatch(layout, /BlocksFile CACHES its parsed blocks/,
    'the false idempotence rationale is back');
  assert.match(layout, /autoDiscard is true and nothing ever clears it/);
});
