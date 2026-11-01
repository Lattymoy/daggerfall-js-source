// OWN-AUDIT (2026-11-01): THE MODS' INERT KEYS, EACH LIVE OR RETIRED - the ones this file holds: Travel Options'
// AllowRealGrass (a sped-up journey holds our grass back), Snowfall's three Location Loader keys (the snow kept shallow on
// World of Daggerfall's sites), Eye Of The Beholder's offset scales and three retired keys, and every retired key let go
// from a saved file. Come Sail Away's and Handheld Torches' are ownaudit_csa_keys and ownaudit_ht_keys; Windfall's
// heading windfall1_model. Mutants: tools/mutants/ownaudit_keys.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOD_SETTINGS, RETIRED_KEYS, modSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { readTravelOptionsSettings, createTravelOptions } from '../../src/systems/travel/travelOptions.js';
import { mapPixelWorldOrigin } from '../../src/systems/travel/travelPaths.js';
import { rectOf } from '../../src/systems/travel/travelAutopilot.js';
import { TravelControlUI } from '../../src/ui/travel/travelControlUI.js';
import { createSnowGround } from '../../src/scenes/snowGround.js';
import { siteFootprintsIn } from '../../src/scenes/snowfallHost.js';
import { SnowContext } from '../../src/systems/snowfallRuntime.js';
import { snowfallSettings } from '../../src/systems/snowfall.js';
import { inBay } from '../../src/world/tamriel/tamrielFrame.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const RETIRED = [
  ['come-sail-away', 'Compatibility.AnimatedWaterVertexWaves'],
  ['eye-of-the-beholder', 'Camera.TogglePerspective'],
  ['eye-of-the-beholder', 'CameraScrolling.ScrollableZOffsetAxis'],
  ['eye-of-the-beholder', 'Graphics.PingPongOffset'],
  ['windfall', 'General.WindDirectionDegrees'],
];

test('OWN-AUDIT: the five keys that could mean nothing here are off the pane, refused by modSetting, and a file that saved one has it let go once - the rest of the file kept', () => {
  for (const [v, k] of RETIRED) {
    assert.equal(MOD_SETTINGS[v].keys[k], undefined, `${v}/${k} is not declared`);
    assert.throws(() => modSetting(v, k), /not a declared switch/, `${v}/${k}: nothing may read it`);
    assert.ok(RETIRED_KEYS.some((r) => r.vendor === v && r.key === k), `${v}/${k} is retired`);
  }
  const K = 'dfjs-mod-settings';
  const prevLs = globalThis.localStorage;
  try {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    _resetModSettings();
    const saved = {};
    for (const [v, k] of RETIRED) (saved[v] ??= {})[k] = k === 'Camera.TogglePerspective' ? 'KeypadEnter' : 1;
    saved['eye-of-the-beholder']['Animation.GlobalOffsetScale'] = 2;
    store.set(K, JSON.stringify(saved));
    assert.equal(modSetting('eye-of-the-beholder', 'Animation.GlobalOffsetScale'), 2, 'the file loads, and its live keys are the player\'s');
    const written = JSON.parse(store.get(K));
    assert.deepEqual(written['eye-of-the-beholder'], { 'Animation.GlobalOffsetScale': 2 }, 'written back without the retired keys');
    assert.deepEqual([written['come-sail-away'], written.windfall], [{}, {}]);
  } finally {
    globalThis.localStorage = prevLs;
    _resetModSettings();
  }
});

test('OWN-AUDIT Eye Of The Beholder: the offset scales say what they do, and its view key is the game\'s TogglePerspective action on the mod\'s tile', () => {
  const k = MOD_SETTINGS['eye-of-the-beholder'].keys;
  assert.equal(k['Animation.GlobalOffsetScale'].description, 'How far each sprite is shifted to keep it centred on you. 1 is the art’s own shift.');
  assert.equal(k['Animation.FineGlobalOffsetScale'].description, 'Added to GlobalOffsetScale, for a finer adjustment.');
  assert.match(src('src/systems/inputActions.js'), /'eye-of-the-beholder': Object\.freeze\(\['TogglePerspective'\]\)/);
});

function journey(allowGrass) {
  const settings = readTravelOptionsSettings((vendor, key) =>
    vendor === 'travel-options' && key === 'GeneralOptions.AllowRealGrass' ? allowGrass : vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key));
  const o = mapPixelWorldOrigin(500, 250);
  const state = { pos: { x: o.x + 16384, z: o.z + 16384 }, pixel: { x: 500, y: 250 } };
  let to = null;
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onClose: () => to?.interruptTravel() });
  const net = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' };
  to = createTravelOptions({
    settings, ui, roads: () => net, worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false, localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231, entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }), enemiesNearby: () => false,
    diseaseCount: () => 0, say: () => {}, messageBox: () => {}, setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0, pushWindow: (w) => w.show(),
    locationWorldRect: (s) => { const q = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(q.x + 16000, q.z + 16000, 768, 768); },
    locationTileRect: () => null,
  });
  return to;
}

test('OWN-AUDIT AllowRealGrass: a sped-up journey holds the grass back with the switch off and keeps it with it on; the journey\'s end gives it back - and the street host asks it where it draws the field', () => {
  const off = journey(false);
  assert.equal(off.grassHidden, false, 'no journey: the grass');
  off.beginTravel({ pixel: { x: 502, y: 250 }, name: 'Daggerfall', mapId: 199102 }, false);
  assert.equal(off.grassHidden, true, 'a journey, the switch off: none');
  off.interruptTravel();
  assert.equal(off.grassHidden, false, 'its end: back');
  const on = journey(true);
  on.beginTravel({ pixel: { x: 502, y: 250 }, name: 'Daggerfall', mapId: 199102 }, false);
  assert.equal(on.grassHidden, false, 'the switch on: the grass on the way');
  assert.match(src('src/scenes/world.js'), /if \(labGrass && !tvf && !travelOptions\?\.grassHidden\) \{/);
  assert.equal(MOD_SETTINGS['travel-options'].keys['GeneralOptions.AllowRealGrass'].description, 'Show the grass during a sped-up journey.');
});

test('OWN-AUDIT Snowfall\'s Location Loader keys: a built pixel\'s World of Daggerfall site is a footprint in global metres, near the point asked, on the Bay and past it alike; the context caps the snow inside it and feathers it out, and with the switch off there is none', () => {
  const site = { xMin: 32, xMax: 48, yMin: 64, yMax: 80 };   // sixteen tiles a side, tile-local
  const built = new Map([
    ['500,250', { px: 500, py: 250, samples: {}, tilemapBytes: new Uint8Array(1), wodSite: site }],
    ['-20,250', { px: -20, py: 250, samples: {}, tilemapBytes: new Uint8Array(1), wodSite: site }],
    ['501,250', { px: 501, py: 250, samples: {}, tilemapBytes: new Uint8Array(1), wodSite: null }],
  ]);
  assert.equal(inBay(500, 250), true);
  assert.equal(inBay(-20, 250), false, 'a pixel past the Bay');
  const { snowGround } = createSnowGround({ blocks: null, locationIndex: new Map(), maps: null, terrainGen: null, built, deepWaters: null, state: {} });
  const rect = (px) => ({ minX: px * 819.2 + 32 * 6.4, minZ: 249 * 819.2 + 64 * 6.4, maxX: px * 819.2 + 48 * 6.4, maxZ: 249 * 819.2 + 80 * 6.4 });
  const close = (a, b) => ['minX', 'minZ', 'maxX', 'maxZ'].every((k) => Math.abs(a[k] - b[k]) < 1e-6);
  for (const px of [500, -20]) {
    const g = [px * 819.2 + 40 * 6.4, 249 * 819.2 + 72 * 6.4];
    const found = snowGround.footprints(g[0], g[1], 20);
    assert.equal(found.length, 1, `pixel ${px}: its site`);
    assert.ok(close(found[0], rect(px)), `pixel ${px}: in global metres - ${JSON.stringify(found[0])}`);
  }
  assert.deepEqual(siteFootprintsIn((x, y) => built.get(`${x},${y}`) ?? null, 501 * 819.2 + 400, 249 * 819.2 + 400, 20), [], 'a pixel with no site: none');
  // the context: the cap inside the site, feathered over the boundary, none with the switch off
  const world = { toGlobal: (x, z) => [x, z], footprints: snowGround.footprints, settlements: () => [], terrainsIn: () => [] };
  const s = { ...snowfallSettings(() => undefined), locationLoaderIntegration: true, basicRoadsIntegration: false };
  const c = new SnowContext(world, null);
  const g = [500 * 819.2 + 40 * 6.4, 249 * 819.2 + 72 * 6.4];
  c.prepare(g[0], g[1], 64, 8, 4, s);
  assert.equal(c.locations.length, 1);
  assert.equal(c.sampleLocationCap(g[0], g[1]), 255, 'inside: the whole cap');
  const edge = rect(500).maxX;
  const feathered = c.sampleLocationCap(edge + 2, g[1]);
  assert.ok(feathered > 0 && feathered < 255, `half way across the feather: ${feathered}`);
  assert.equal(c.sampleLocationCap(edge + 5, g[1]), 0, 'past the four-metre feather: none');
  c.prepare(g[0], g[1], 64, 8, 4, { ...s, locationLoaderIntegration: false });
  assert.equal(c.locations.length, 0, 'the switch off: no site asked');
  assert.match(src('src/scenes/snowfallHost.js'), /footprints: \(gx, gz, radius\) => ground\.footprints\?\.\(gx, gz, radius\) \?\? \[\],/, 'the host hands the ground\'s sites to the snow');
  const keys = MOD_SETTINGS.snowfall.keys;
  for (const k of ['Context.LocationLoaderIntegration', 'Context.LocationLoaderMaximumDepth', 'Context.LocationLoaderBoundaryFeather']) assert.doesNotMatch(keys[k].description, /no effect/i, k);
});
