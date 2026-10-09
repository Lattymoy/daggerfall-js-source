// SNOWLESS1 (FIELD BUGS 2026-10-09 #1, Toomgis: snow in swamp and desert towns with snow turned off for them) - SNOWLESS SWAMPS AND
// JUNGLES SAYS THE SNOW, NOT ONLY THE TILES. The add-on's 403 decides the swamp/jungle winter ground; Snowfall's snow
// surface and the enhanced weather's ground law asked the archive law alone (climateType, season) and laid and dropped
// snow on the green ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setDfmodEnabled, DFMOD_SHIPPED_PREF, DFMOD_OFF_PREF, _resetDfmodForTests, winterGroundSnowless } from '../src/systems/dfmodTextures.js';
import { installVanillaEnhancedPack } from '../src/systems/vanillaEnhancedPack.js';
import { clearTextureReplacements } from '../src/systems/textureReplacement.js';
import { VE_ADDONS_PREF, setVeAddon } from '../src/systems/vanillaEnhanced.js';
import { setValue } from '../src/systems/settings.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { groundWearsSnow, groundIsSnowy, getTerrainGroundArchive, SEASON } from '../src/world/climateSwaps.js';
import { resetWeatherSim, setSnowGroundLaw, overGround, mapGround, WEATHER_ENUM } from '../src/systems/weatherSim.js';
import { CLIMATES, getWorldClimateSettings } from '../src/formats/mapsFile.js';
import { createSnowfallHost } from '../src/scenes/snowfallHost.js';

const SNOWLESS = 'dfmod/vanilla enhanced - snowless swamps and jungles.dfmod';
const WINTER = 0;
const SIZE = 819.2;
const MASKS = [103, 303, 403].map((a) => new Uint8Array(readFileSync(new URL(`../public/art/snowfall/snow_surface_masks_${a}.bytes`, import.meta.url))));
const SWAMPS = [CLIMATES.Ocean, CLIMATES.Rainforest, CLIMATES.Swamp];

function fresh() {
  _resetDfmodForTests();
  setValue('Enhancements', 'AssetInjection', 'True');
  setPref(DFMOD_OFF_PREF, []); setPref(DFMOD_SHIPPED_PREF, {}); setPref(VE_ADDONS_PREF, []);
  clearTextureReplacements();
  installVanillaEnhancedPack();
}

test('SNOWLESS1 the ground as drawn: the add-on on, the swamp-base winter wears no snow - the terrain still keys 403 (the pack dresses it), every other climate as before', () => {
  fresh();
  assert.equal(winterGroundSnowless(403), false, 'off by default: Snowfall\'s winter records decide 403');
  setDfmodEnabled('dfmod/snowfall.dfmod', false);
  assert.equal(winterGroundSnowless(403), false, 'Snowfall\'s ground off: the Base\'s own 403 array, snowy, decides - an array is not the add-on\'s');
  setDfmodEnabled('dfmod/snowfall.dfmod', true);
  for (const c of SWAMPS) assert.equal(groundWearsSnow(getWorldClimateSettings(c), SEASON.Winter), true);
  setVeAddon(SNOWLESS, true);
  assert.equal(winterGroundSnowless(403), true, 'loaded last, its 403 array decides over Snowfall\'s records');
  for (const c of SWAMPS) {
    const s = getWorldClimateSettings(c);
    assert.equal(groundWearsSnow(s, SEASON.Winter), false, `climate ${c}: snowless`);
    assert.equal(groundIsSnowy(s, SEASON.Winter), true, 'the archive law is unchanged');
    assert.equal(getTerrainGroundArchive(s, SEASON.Winter), 403, 'and the terrain still draws 403');
  }
  for (const c of [CLIMATES.Woodlands, CLIMATES.Mountain, CLIMATES.MountainWoods]) assert.equal(groundWearsSnow(getWorldClimateSettings(c), SEASON.Winter), true, `climate ${c} still wears its snow`);
  setValue('Enhancements', 'AssetInjection', 'False');
  assert.equal(winterGroundSnowless(403), false, 'Replace Game Artwork off: the classic 403, snowy');
});

test('SNOWLESS1 the weather: rain and a storm over a snowless swamp or jungle stay rain and a storm; the add-on off, they fall as snow (WEATHER2a)', () => {
  fresh(); resetWeatherSim(); setSnowGroundLaw(true);
  assert.equal(overGround(WEATHER_ENUM.thunder, CLIMATES.Rainforest, WINTER), WEATHER_ENUM.snow);
  setVeAddon(SNOWLESS, true);
  assert.equal(overGround(WEATHER_ENUM.thunder, CLIMATES.Rainforest, WINTER), WEATHER_ENUM.thunder);
  assert.equal(overGround(WEATHER_ENUM.rain, CLIMATES.Swamp, WINTER), WEATHER_ENUM.rain);
  assert.equal(overGround(WEATHER_ENUM.rain, CLIMATES.Woodlands, WINTER), WEATHER_ENUM.snow, 'the woodlands keep their snow');
  assert.equal(overGround(WEATHER_ENUM.snow, CLIMATES.Swamp, WINTER), WEATHER_ENUM.rain, 'the swamp\'s own winter snow falls as rain on its snowless ground');
  assert.equal(overGround(WEATHER_ENUM.snow, CLIMATES.Woodlands, WINTER), WEATHER_ENUM.snow, 'on a snowy ground, snow stays snow');
  resetWeatherSim();
});

test('SNOWLESS1 the desert: a snow system drifted over from a snowy climate (the weather map, WEATHER3b) falls as rain on a desert\'s ground, which wears no snow; the classic lane keeps every word', () => {
  fresh(); resetWeatherSim(); setSnowGroundLaw(true);
  for (const c of [CLIMATES.Desert, CLIMATES.Desert2]) {
    assert.equal(groundWearsSnow(getWorldClimateSettings(c), SEASON.Winter), false);
    assert.equal(overGround(WEATHER_ENUM.snow, c, WINTER), WEATHER_ENUM.rain, `climate ${c}`);
    assert.equal(overGround(WEATHER_ENUM.thunder, c, WINTER), WEATHER_ENUM.thunder, 'a storm stays a storm');
  }
  assert.equal(overGround(WEATHER_ENUM.snow, CLIMATES.Mountain, WINTER), WEATHER_ENUM.snow, 'the mountains keep their snow');
  const map = mapGround((px) => (px < 500 ? CLIMATES.Mountain : CLIMATES.Desert));   // the map's readers: the sky's cells, the forecast
  assert.equal(map('snow', 600 * SIZE, 250 * SIZE, WINTER), 'rain', 'the map\'s snow system over the desert');
  assert.equal(map('snow', 400 * SIZE, 250 * SIZE, WINTER), 'snow', 'and over the mountains');
  setSnowGroundLaw(false);
  assert.equal(overGround(WEATHER_ENUM.snow, CLIMATES.Desert, WINTER), WEATHER_ENUM.snow, 'the classic lane: the word as rolled');
  resetWeatherSim();
});

function hostGround(climate, climateOf = () => climate) {
  const pixels = new Map();
  const pixel = (x, y) => { const k = `${x},${y}`; if (!pixels.has(k)) pixels.set(k, { x, y }); return pixels.get(k); };
  const tileMap = new Uint8Array(16384).fill(1 << 2);
  return {
    size: SIZE, terrainDistance: 1,
    pixelAt: (x, z) => pixel(500 + Math.floor(x / SIZE), 250 - Math.floor(z / SIZE)),
    pixelOn: (x, y) => pixel(x, y),
    pixelsNear: (ring) => { const out = []; for (let j = -ring; j <= ring; j++) for (let k = -ring; k <= ring; k++) out.push(pixel(500 + k, 250 + j)); return out; },
    translation: (p, out) => { out[0] = (p.x - 500) * SIZE; out[1] = 0; out[2] = -(p.y - 250) * SIZE; return out; },
    height: () => 0, normal: (p, lx, lz, out) => { out[0] = 0; out[1] = 1; out[2] = 0; return out; },
    tileMap: () => tileMap, climate: (p) => climateOf(p), mapPixel: (p) => ({ x: p.x, y: p.y }),
    toGlobal: (x, z) => [500 * SIZE + x, 249 * SIZE + z], settlements: () => [],
  };
}
async function stand(climate, climateOf) {
  const host = createSnowfallHost({ enhanced: true, ground: hostGround(climate, climateOf), loadMasks: async () => MASKS });
  const st = { now: 1, sec: 3_000_000 };
  const frame = () => host.frame({ now: st.now, inside: false, player: { x: 20, y: 0, z: 20, grounded: true }, weather: 'snow', seconds: st.sec, winter: true, climate });
  frame(); await new Promise((r) => setTimeout(r, 10)); frame();
  host.runtime.frameBudgetMs = Infinity;
  for (let i = 0; i < 200; i++) { st.now += 1 / 60; st.sec += 1; frame(); }
  return host;
}

test('SNOWFALL x SNOWLESS1: Snowfall lays no snow on a snowless swamp - the player standing in one is the desert\'s case (no tier stands), and its tiles are bare from a neighbour; the add-on off, the swamp\'s winter snow as the mod lays it', async () => {
  fresh();
  let host = await stand(CLIMATES.Swamp);
  assert.equal(host.runtime.lastEnvironmentEligible, true, 'off: the swamp\'s winter is the mod\'s');
  assert.equal(host.runtime.visibleTiers().local || host.runtime.visibleTiers().mid, true);
  setVeAddon(SNOWLESS, true);
  host = await stand(CLIMATES.Swamp);
  assert.equal(host.runtime.lastEnvironmentEligible, false, 'on: no snow stands in the swamp');
  assert.deepEqual(host.runtime.visibleTiers(), { local: false, mid: false, blanket: false, far: false });
});

test('SNOWFALL x SNOWLESS1: standing in the woodlands\' winter, the desert\'s pixel next door is bare - the mod counts unmasked ground as snowed, and laid its snow over the desert\'s edge; the woodlands\' own tile keeps its masks', async () => {
  fresh();
  const host = await stand(CLIMATES.Woodlands, (p) => (p.x >= 501 ? CLIMATES.Desert : CLIMATES.Woodlands));
  assert.equal(host.runtime.lastEnvironmentEligible, true, 'the woodlands\' winter is the mod\'s');
  const desert = host.runtime.world.terrainAt(SIZE * 1.5, 20), woods = host.runtime.world.terrainAt(20, 20);
  assert.equal(desert.bare(1, 1), true, 'the desert\'s ground: no snow');
  assert.equal(woods.bare?.(1, 1) ?? false, false, 'the woodlands\' ground: as the masks say');
});
