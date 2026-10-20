// OH-B / OH-C (2026-09-26) - THERE'S A HOLE IN THE BOTTOM OF THE OCEAN IN THE
// STREAMED WORLD (src/scenes/oceanHolesHost.js) against the assembly's
// OceanHoles tile work: the gates in ProcessTerrain's order and their
// diagnostics, the wait for Iliac Puddle No More's floor (RequestSeafloorRefresh
// on a new wait and every thirtieth attempt, MaxFloorWaitFrames), the bake's
// verification (PassesBakeFilter), the depth, DeformSeafloor committed once per
// build version, BuildPit's parts (pixel-local), ShouldSuppressDecoration,
// OnTerrainPromoted / OnDeepWaterFloorBuilt's state machine, a settings change
// re-cutting every loaded floor, the unload, and OceanPitCollision's gates.
// Iliac Puddle No More's own half of the API (deepWatersHost.js) is pinned too.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOceanHoles, oceanHolesSettings } from '../../src/scenes/oceanHolesHost.js';
import { isPitPixel, placementFraction, getFloorPitDepth, MINIMUM_DEPTH } from '../../src/world/oceanHoles.js';
import { sampleMeshLocalY } from '../../src/world/deepWater/deepWaterFloor.js';
import { MOD_SETTINGS } from '../../src/systems/modSettings.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const f32 = Math.fround;
const SIZE = 819.2;
const OCEAN_LOCAL_Y = 34;

/** The first pixels the hash picks (rate 0.5) and does not. */
function pitPixels(n) {
  const out = [];
  for (let y = 0; y < 500 && out.length < n; y++) for (let x = 0; x < 1000 && out.length < n; x++) if (isPitPixel(x, y, 0.5)) out.push([x, y]);
  return out;
}
function notPit() { for (let x = 0; x < 1000; x++) if (!isPitPixel(x, 0, 0.5)) return [x, 0]; return null; }

/** A flat floor at local y `floorY` over the whole pixel. */
function floorAt(floorY) {
  const positions = [];
  const vertexLocalY = new Float32Array(65 * 65);
  for (let i = 0; i < 65; i++) for (let j = 0; j < 65; j++) { positions.push(j * SIZE / 64, floorY, i * SIZE / 64); vertexLocalY[i * 65 + j] = floorY; }
  return { positions: Float32Array.from(positions), vertexLocalY, floorQuadWater: null };
}

/** A fake Iliac Puddle No More seafloor API over a set of entries. */
function fakeDeepWaters({ bake = fakeBake() } = {}) {
  const floors = new Map();
  const log = [];
  return {
    log, floors,
    bake,
    oceanLocalY: OCEAN_LOCAL_Y,
    build(entry, floorY, version) { floors.set(entry, { floor: floorAt(floorY), version, current: true }); },
    isSeafloorCurrent: (e) => !!floors.get(e)?.current,
    seafloorBuildVersion: (e) => floors.get(e)?.version ?? -1,
    tryGetSeafloor: (e) => floors.get(e)?.floor ?? null,
    commitSeafloorChanges(e, positions) {
      const f = floors.get(e)?.floor;
      if (!f) return false;
      log.push(['commit', e.px, e.py]);
      f.positions = Float32Array.from(positions);
      for (let i = 0; i < 4225; i++) f.vertexLocalY[i] = f.positions[i * 3 + 1];
      return true;
    },
    refreshLoadedTile(e, force = false) { log.push(['refresh', e.px, e.py, force]); },
  };
}
function fakeBake({ loaded = true, water = true, land = false, carved = true, edge = 1000 } = {}) {
  return { loaded, mapPixelHasWaterCells: () => water, mapPixelHasLandCells: () => land, isCarvedWater: () => carved, sampleEdgeDistanceMeters: () => edge };
}

function rig({ deepWaters = fakeDeepWaters(), hasLocation = () => false, climate = 223, decor = null, settings = null, inside = () => false } = {}) {
  const built = new Map();
  const pits = [];
  const released = [];
  const entered = [];
  let clock = 0;
  const oh = createOceanHoles({
    deepWaters, decor, built,
    pixelTranslation: (px, py) => [px * SIZE, 0, -py * SIZE],
    hasLocation, worldClimateOf: () => climate,
    pits: { create: (e, pit) => { const h = { e, pit }; pits.push(h); return h; }, destroy: (h) => released.push(h) },
    onEnterPit: (x, y) => entered.push([x, y]),
    now: () => clock,
    settings: settings ?? (() => ({ surfaceHoleRadius: 20, seafloorHoleScale: 1, pitSpawnRate: 0.5, miasmaParticleCount: 72, miasmaHeight: 300, dungeonVisualIntensity: 0.5, dungeonVisualDarkness: 0.5 })),
    warn: () => {},
    inside,
  });
  const add = (px, py) => { const e = { px, py }; built.set(`${px},${py}`, e); return e; };
  return { oh, built, add, deepWaters, pits, released, entered, tick: (dt) => { clock += dt; } };
}

test('OH-B ProcessTerrain: a pixel the hash does not pick is rejected at once, before anything else is asked', () => {
  const r = rig();
  const [x, y] = notPit();
  const e = r.add(x, y);
  r.oh.promoted(e);
  r.oh.update();
  assert.equal(r.oh.stateOf(e).diagnostic, 'rejected:not-selected');
  assert.equal(r.oh.stateOf(e).processed, true);
  assert.deepEqual(r.deepWaters.log, [], 'no floor asked for');
});

test('OH-B ProcessTerrain (ETHER-DEEP): a pixel off the Bay\'s map - the Eltheric Ocean\'s carved floor - is never cut: an abyss is named by its pit pixel\'s id, the Bay\'s alone - nor the continent\'s west of it (mutants: the hold dropped, the box\'s alone held)', () => {
  const r = rig();
  let pit = null;
  for (let x = 4000; x < 8000 && !pit; x++) if (isPitPixel(x, -5000, 0.5)) pit = [x, -5000];
  assert.ok(pit, 'a pixel past the Veil the hash picks');
  const e = r.add(...pit);
  r.deepWaters.build(e, -100, 1);
  r.oh.promoted(e);
  r.oh.update();
  assert.equal(r.oh.stateOf(e).diagnostic, 'rejected:off-the-map');
  assert.deepEqual([r.pits.length, r.deepWaters.log.filter((l) => l[0] === 'commit').length], [0, 0], 'no pit, no cut');
  // AUDIT ETHER-OW T-14: the continent's west of the map too - off the map is off it, the box or not
  let west = null;
  for (let x = -1; x > -1000 && !west; x--) if (isPitPixel(x, 250, 0.5)) west = [x, 250];
  assert.ok(west, 'a pixel west of the Bay the hash picks');
  const c = r.add(...west);
  r.deepWaters.build(c, -100, 1);
  r.oh.promoted(c);
  r.oh.update();
  assert.equal(r.oh.stateOf(c).diagnostic, 'rejected:off-the-map');
  assert.deepEqual([r.pits.length, r.deepWaters.log.filter((l) => l[0] === 'commit').length], [0, 0], 'no pit, no cut');
});

test('OH-B ProcessTerrain: a location is never cut; a missing floor waits, asking the sea to build it (a new wait and every thirtieth try) until MaxFloorWaitFrames', () => {
  const [[x, y]] = pitPixels(1);
  const loc = rig({ hasLocation: () => true });
  const le = loc.add(x, y);
  loc.oh.promoted(le); loc.oh.update();
  assert.equal(loc.oh.stateOf(le).diagnostic, 'rejected:has-location');

  const r = rig();
  const e = r.add(x, y);
  r.oh.promoted(e);
  for (let i = 0; i < 700; i++) r.oh.update();
  const st = r.oh.stateOf(e);
  assert.equal(st.diagnostic, 'rejected:missing-seafloor-timeout', 'six hundred tries, then given up');
  const asks = r.deepWaters.log.filter((l) => l[0] === 'refresh');
  assert.equal(asks.length, 1 + Math.floor(599 / 30), 'the first wait, then every thirtieth attempt');
  assert.ok(asks.every((a) => a[3] === false), 'RefreshLoadedTile unforced');
});

test('OH-B the bake\'s verification: not loaded, no water, a land cell, not carved, too near the coast - each its own rejection', () => {
  const [[x, y]] = pitPixels(1);
  const cases = [
    [{ loaded: false }, 'rejected:bake-not-loaded'],
    [{ water: false }, 'rejected:bake-no-water'],
    [{ land: true }, 'rejected:bake-has-land'],
    [{ carved: false }, 'rejected:not-carved-water'],
    [{ edge: 255.94 }, 'rejected:edge-distance-255.9'],
  ];
  for (const [b, want] of cases) {
    const dw = fakeDeepWaters({ bake: fakeBake(b) });
    const r = rig({ deepWaters: dw });
    const e = r.add(x, y);
    dw.build(e, -100, 1);
    r.oh.promoted(e); r.oh.update();
    assert.equal(r.oh.stateOf(e).diagnostic, want);
    assert.deepEqual(dw.log.filter((l) => l[0] === 'commit'), [], 'nothing cut');
  }
  // no bake yet: the host has the API, its bake is null
  const dw = fakeDeepWaters({ bake: null });
  const r = rig({ deepWaters: dw });
  const e = r.add(x, y);
  dw.build(e, -100, 1);
  r.oh.promoted(e); r.oh.update();
  assert.equal(r.oh.stateOf(e).diagnostic, 'rejected:bake-not-loaded');
});

test('OH-B the depth: MinimumDepth under the sea at the pit\'s spot, or rejected; deep enough, the floor is cut and the pit stands', () => {
  const [[x, y]] = pitPixels(1);
  const shallow = rig();
  const se = shallow.add(x, y);
  shallow.deepWaters.build(se, OCEAN_LOCAL_Y - 69.5, 1);
  shallow.oh.promoted(se); shallow.oh.update();
  assert.equal(shallow.oh.stateOf(se).diagnostic, 'rejected:depth-69.5');

  const r = rig();
  const e = r.add(x, y);
  r.deepWaters.build(e, OCEAN_LOCAL_Y - 100, 1);
  r.oh.seafloorBuilt(e);   // OnDeepWaterFloorBuilt: evaluated in the call
  const st = r.oh.stateOf(e);
  assert.equal(st.diagnostic, 'built');
  assert.equal(st.appliedFloorBuildVersion, 1);
  assert.equal(r.deepWaters.log.filter((l) => l[0] === 'commit').length, 1, 'committed once');
  const fx = placementFraction(x, y, 88), fz = placementFraction(x, y, 90);
  const pit = r.oh.pitOf(e);
  assert.ok(pit);
  assert.equal(pit.marker.localX, f32(f32(x * SIZE + f32(fx * SIZE)) - x * SIZE), 'pixel-local, the placement fraction in');
  assert.equal(pit.marker.decorationExclusionRadius, 32);
  // the pit's bottom: 14 m down at the centre; the opening the highest the CUT mesh draws on the 12 m ring (its
  // triangles span 12.8 m, so the ring reads the pit's curve through them, above the analytic depth there)
  const bottom = OCEAN_LOCAL_Y - 100 - 14;
  const cut = r.deepWaters.tryGetSeafloor(e);
  let ring = -Infinity;
  for (let i = 0; i < 16; i++) {
    const a = f32(f32(f32(Math.PI * 2) * i) / 16);
    const y = sampleMeshLocalY(cut, f32(pit.marker.localX + f32(f32(Math.cos(a)) * 12)), f32(pit.marker.localZ + f32(f32(Math.sin(a)) * 12)));
    if (y != null) ring = Math.max(ring, y);
  }
  assert.ok(Math.abs(pit.openingY - ring) < 1e-3, `the opening is the ring's highest (${pit.openingY} vs ${ring})`);
  assert.ok(pit.openingY > bottom && pit.openingY < OCEAN_LOCAL_Y - 100, 'inside the pit, above its bottom');
  assert.ok(Math.abs(pit.black.y - (pit.openingY + 0.08)) < 1e-4);
  assert.ok(Math.abs(pit.entrance.y - (pit.openingY + 0.22)) < 1e-4);
  assert.deepEqual(pit.entrance.size, [18, f32(0.35), 18]);
  assert.ok(Math.abs(pit.core.y - (OCEAN_LOCAL_Y + 0.07)) < 1e-4, 'the core just over the sea');
  assert.ok(Math.abs(pit.underside.y - (OCEAN_LOCAL_Y - 0.01)) < 1e-4, 'the underside just under it');
  assert.equal(pit.core.radius, 20);
  assert.equal(pit.black.radius, 12);
  assert.equal(pit.miasma.count, 72);
  assert.equal(pit.miasma.radius, 19, 'the circle one metre inside the hole');
  assert.equal(r.pits.length, 1, 'its visuals made');
  // the floor under the centre fell
  const f = r.deepWaters.tryGetSeafloor(e);
  assert.ok(Math.min(...f.vertexLocalY) < OCEAN_LOCAL_Y - 100 - 13, 'the grid read back off the cut mesh');
  assert.ok(MINIMUM_DEPTH === 70);
});

test('OH-B the state machine: a promote of an evaluated pixel is nothing; a new floor build re-cuts; a lost pit on the same floor is stood again without a second cut', () => {
  const [[x, y]] = pitPixels(1);
  const r = rig();
  const e = r.add(x, y);
  r.deepWaters.build(e, OCEAN_LOCAL_Y - 100, 1);
  r.oh.seafloorBuilt(e);
  const first = r.oh.pitOf(e);
  r.oh.promoted(e); r.oh.update();
  assert.equal(r.oh.pitOf(e), first, 'nothing redone');
  assert.equal(r.deepWaters.log.filter((l) => l[0] === 'commit').length, 1);
  // Iliac Puddle No More rebuilds the floor (a new version): the old pit goes, the new floor is cut
  r.deepWaters.build(e, OCEAN_LOCAL_Y - 100, 2);
  r.oh.seafloorBuilt(e);
  assert.notEqual(r.oh.pitOf(e), first);
  assert.equal(r.released.length, 1, 'the old pit released');
  assert.equal(r.deepWaters.log.filter((l) => l[0] === 'commit').length, 2);
  // the pit lost while the floor stands (applied >= 0 and no pit): Reprocess - stood again, the cut not repeated
  const h = r.oh.pitOf(e);
  e._ohPit = null;
  r.oh.promoted(e);
  assert.equal(r.oh.stateOf(e).diagnostic, 'requeued');
  r.oh.update();
  assert.equal(r.oh.stateOf(e).diagnostic, 'built');
  assert.ok(r.oh.pitOf(e) && r.oh.pitOf(e) !== h);
  assert.equal(r.deepWaters.log.filter((l) => l[0] === 'commit').length, 2, 'DeformSeafloor answers true for an applied version');
});

test('OH-B ShouldSuppressDecoration: inside the exclusion radius of this pixel\'s pit, in world space through the live translation', () => {
  const [[x, y]] = pitPixels(1);
  const subs = [];
  const decor = { onShouldSuppressDecoration: (fn) => { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); }, refreshLoadedTile: (e) => subs.refreshed = e };
  const r = rig({ decor });
  const e = r.add(x, y);
  r.deepWaters.build(e, OCEAN_LOCAL_Y - 100, 1);
  r.oh.seafloorBuilt(e);
  assert.equal(subs.length, 1, 'subscribed');
  assert.equal(subs.refreshed, e, 'BuildPit asked the decorations again');
  const m = r.oh.pitOf(e).marker;
  const wx = x * SIZE + m.localX, wz = -y * SIZE + m.localZ;
  assert.equal(subs[0](e, [wx + 31.9, 0, wz]), true);
  assert.equal(subs[0](e, [wx + 32.1, 0, wz]), false);
  assert.equal(subs[0]({ px: x + 1, py: y }, [wx, 0, wz]), false, 'another pixel\'s marker is not this one\'s');
  r.oh.dispose();
  assert.equal(subs.length, 0, 'unsubscribed');
});

test('OH-B a settings change re-cuts every loaded floor (RefreshLoadedPits, forced) when one of its five keys moved; the abyss\'s two dials do not', () => {
  let s = { surfaceHoleRadius: 20, seafloorHoleScale: 1, pitSpawnRate: 0.5, miasmaParticleCount: 72, miasmaHeight: 300, dungeonVisualIntensity: 0.5, dungeonVisualDarkness: 0.5 };
  const r = rig({ settings: () => s });
  const e = r.add(5, 5);
  // the generation moves when a mod setting is written; the rig drives the snapshot directly
  const bump = async () => { const m = await import('../../src/systems/modSettings.js'); m.setModSetting('ocean-holes', 'General.DungeonVisualDarkness', Math.random()); };
  return bump().then(async () => {
    s = { ...s, dungeonVisualDarkness: 0.9 };
    r.oh.update();
    assert.equal(r.deepWaters.log.filter((l) => l[0] === 'refresh').length, 0, 'the dark dial re-cuts nothing');
    await bump();
    s = { ...s, seafloorHoleScale: 1.5 };
    r.oh.update();
    assert.deepEqual(r.deepWaters.log.filter((l) => l[0] === 'refresh'), [['refresh', 5, 5, true]]);
    assert.equal(r.oh.settings.seafloorHoleScale, 1.5);
    assert.ok(e);
  });
});

test('OH-C OceanPitCollision: once a second at most, outside and swimming, with the pit\'s own pixel; the unload releases the pit', () => {
  const [[x, y]] = pitPixels(1);
  const r = rig();
  const e = r.add(x, y);
  r.deepWaters.build(e, OCEAN_LOCAL_Y - 100, 1);
  r.oh.seafloorBuilt(e);
  assert.equal(r.oh.characterCollided(e, { inside: false, swimming: false }), false, 'a walker on the box does not go in');
  assert.equal(r.oh.characterCollided(e, { inside: true, swimming: true }), false);
  assert.equal(r.oh.characterCollided(e, { inside: false, swimming: true }), true);
  assert.deepEqual(r.entered, [[x, y]]);
  r.tick(0.5);
  assert.equal(r.oh.characterCollided(e, { inside: false, swimming: true }), false, 'within the second');
  r.tick(0.6);
  assert.equal(r.oh.characterCollided(e, { inside: false, swimming: true }), true);
  const at = r.oh.entranceOf(e);
  assert.ok(Math.abs(at.topY - (at.position[1] + f32(0.35) / 2)) < 1e-5, 'the box\'s bounds.max.y');
  r.oh.destroyed(e);
  assert.equal(r.oh.pitOf(e), null);
  assert.equal(r.released.length, 1);
});

test('OH-B ApplySettings off the declared keys: the midpoint\'s values, as the C# scales them', () => {
  const s = oceanHolesSettings();
  assert.equal(s.surfaceHoleRadius, 20);
  assert.equal(s.seafloorHoleScale, 1);
  assert.equal(s.pitSpawnRate, 0.5);
  assert.equal(s.miasmaParticleCount, 72);
  assert.equal(s.miasmaHeight, 300);
  assert.equal(s.dungeonVisualIntensity, 0.5);
  assert.deepEqual(Object.keys(MOD_SETTINGS['ocean-holes'].keys), ['Enabled', 'General.PitSpawnRate', 'General.SurfaceHoleSize', 'General.SeafloorHoleSize',
    'General.MiasmaParticleCount', 'General.MiasmaHeight', 'General.DungeonVisualIntensity', 'General.DungeonVisualDarkness'], 'the shipped order');
  const shipped = JSON.parse(readFileSync(new URL('../../vendor/ocean-holes/modsettings.json', import.meta.url), 'utf8'));
  // PLAIN-TEXT (2026-10-19): four of the mod's lines said plainly for a player - their words, exactly
  const PLAIN = {
    PitSpawnRate: 'How many blue holes there are: none at 0, 1 square in 48 at the middle, 1 in 24 at most',
    MiasmaParticleCount: 'Amount of mist over a hole',
    MiasmaHeight: 'Height of the mist over a hole',
    DungeonVisualDarkness: 'How dark the fog and light are in flooded dungeons',
  };
  for (const k of shipped.Sections[0].Keys) {
    const d = MOD_SETTINGS['ocean-holes'].keys[`General.${k.Name}`];
    assert.equal(d.default, k.Value, k.Name);
    assert.equal(d.description, PLAIN[k.Name] ?? k.Description, k.Name);
    assert.equal(d.min, k.Min);
    assert.equal(d.max, k.Max);
  }
});

test('OH-B Iliac Puddle No More\'s half of the API: OnSeafloorBuilt before OnFloorRefreshed, the commit reads the grid back, RefreshLoadedTile goes to the front', () => {
  const src = readFileSync(new URL('../../src/scenes/deepWater/deepWatersHost.js', import.meta.url), 'utf8');
  assert.match(src, /onSeafloorBuilt\?\.\(entry\);[^\n]*\n\s*onFloorRefreshed\?\.\(entry\);/, 'the built event first');
  assert.match(src, /heightGridFromPositions\(s\.floor\.positions, s\.floor\.vertexLocalY\);\s*\n\s*standWalls\(entry, s\);\s*\n\s*if \(s\.gpu\) gpu\?\.updateFloor\?\.\(s\.gpu, s\.floor\);/);
  assert.match(src, /const d = urgent\.has\(k\) \? -1 : chebyshev/, 'an urgent refresh is taken before the nearest');
  assert.match(src, /if \(!force && this\.isSeafloorCurrent\(entry\)\) return;/);
  const world = hostText('src/scenes/world.js');
  assert.match(world, /onSeafloorBuilt: \(e\) => oceanHoles\?\.seafloorBuilt\(e\)/);
  assert.match(world, /if \(host\.oceanHoles\) host\.oceanHoles\.promoted\(built\.get\(key\)\);/, 'OnTerrainPromoted after the sea\'s own promote');
  assert.match(world, /if \(oceanHoles\) oceanHoles\.destroyed\(p\);/);
});

test('OH-B RefreshLoadedTile through the sea\'s own host: nothing while the terrain may not be mutated, a current floor kept unless forced, the refresh built before a nearer pixel, and the built event before the refreshed one', async () => {
  const { createDeepWatersHost } = await import('../../src/scenes/deepWater/deepWatersHost.js');
  const pixel = (px, py) => ({ px, py, samples: new Float32Array(4), tilemap: new Uint8Array(4), tilemapBytes: new Uint8Array(4) });
  const floor = () => ({ positions: new Float32Array(9), indices: new Uint32Array(0), floorGridIndexCount: 0, vertexLocalY: new Float32Array(4225) });
  const built = new Map();
  const far = pixel(14, 10);
  built.set('14,10', far);
  let frozen = false, answer;
  const asked = [], heard = [];
  const client = { ready: new Promise((r) => { answer = r; }), buildPixel: async (job) => { asked.push(`${job.px},${job.py}`); return { ocean: true, floor: floor() }; } };
  const host = createDeepWatersHost({ built, climateAt: () => 223, currentPixel: () => ({ x: 10, y: 10 }), client, clock: () => 0,
    canMutateTerrainData: () => !frozen, onSeafloorBuilt: (e) => heard.push(`built ${e.px}`), onFloorRefreshed: (e) => heard.push(`refreshed ${e.px}`) });
  answer({ mapPixelOrCardinalNeighborHasWaterCells: () => true });
  await host.ready; await null;
  const settle = async () => { for (let i = 0; i < 5; i++) await null; };
  host.pump(); await settle();
  assert.ok(host.isSeafloorCurrent(far), 'the bake\'s arrival stood the floor');
  assert.deepEqual(heard, ['built 14', 'refreshed 14'], 'OnSeafloorBuilt, then the refresh');
  assert.equal(host.pendingCount, 0);
  host.refreshLoadedTile(far);
  assert.equal(host.pendingCount, 0, 'a current floor is left standing');
  frozen = true;
  host.refreshLoadedTile(far, true);
  assert.equal(host.pendingCount, 0, 'CanMutateTerrainData false: nothing, forced or not');
  frozen = false;
  host.refreshLoadedTile(far, true);
  assert.equal(host.pendingCount, 1, 'forced: built again');
  const nearer = pixel(12, 10);
  built.set('12,10', nearer);
  host.published(nearer);   // a promote deferred to PumpDeferredBuilds, nearer the player than the refresh
  asked.length = 0;
  host.pump(); await settle();
  host.pump(); await settle();
  assert.deepEqual(asked, ['14,10', '12,10'], 'the refresh first (the mod builds it in the call), then the nearest');
});

test('OH-C the pit\'s programs take their attributes where the buffers put them: every input bound by layout(location), the disc\'s position at 0, the miasma\'s centre, corner and size-and-turn at 0, 1 and 2 (a linker orders unbound inputs as it likes)', () => {
  const src = readFileSync(new URL('../../src/render/oceanHolesRender.js', import.meta.url), 'utf8');
  assert.match(src, /const DISC_VS = `#version 300 es\nlayout\(location = 0\) in vec3 aPos;/);
  assert.match(src, /const MIASMA_VS = `#version 300 es\nlayout\(location = 0\) in vec3 aCentre;\nlayout\(location = 1\) in vec2 aCorner;\nlayout\(location = 2\) in vec2 aSizeRot;/);
  for (const vs of ['DISC_VS', 'MIASMA_VS']) {
    const body = src.match(new RegExp(`const ${vs} = \`([^\`]*)\``))[1];
    assert.doesNotMatch(body, /^in /m, `${vs}: no input left to the linker`);
  }
  assert.match(src, /gl\.vertexAttribPointer\(0, 3, gl\.FLOAT, false, 28, 0\);\n[^\n]*gl\.vertexAttribPointer\(1, 2, gl\.FLOAT, false, 28, 12\);\n[^\n]*gl\.vertexAttribPointer\(2, 2, gl\.FLOAT, false, 28, 20\);/, 'the stream\'s three, in that order');
});

// AUDIT OH-F A1/A3 (2026-09-26): LoadSettings is a callback DFU raises in any mode, and indoors every terrain is
// inactive (DisableAllParents) - so FindObjectsOfType finds none and ProcessTerrain waits toward its timeout.
test('AUDIT OH-F A1/A3 indoors: a settings change applies at once (the abyss\'s dials live) and re-cuts nothing; it is not replayed on the way out', async () => {
  let s = { surfaceHoleRadius: 20, seafloorHoleScale: 1, pitSpawnRate: 0.5, miasmaParticleCount: 72, miasmaHeight: 300, dungeonVisualIntensity: 0.5, dungeonVisualDarkness: 0.5 };
  let inside = true;
  const r = rig({ settings: () => s, inside: () => inside });
  r.add(5, 5);
  const m = await import('../../src/systems/modSettings.js');
  m.setModSetting('ocean-holes', 'General.DungeonVisualIntensity', Math.random());
  s = { ...s, dungeonVisualIntensity: 1, seafloorHoleScale: 1.5 };
  r.oh.checkSettings();
  assert.equal(r.oh.settings.dungeonVisualIntensity, 1, 'ApplySettings: the fog dial is live inside the abyss');
  assert.equal(r.oh.settings.seafloorHoleScale, 1.5);
  assert.equal(r.deepWaters.log.filter((l) => l[0] === 'refresh').length, 0, 'RefreshLoadedPits finds no active terrain indoors');
  inside = false;
  r.oh.checkSettings();
  r.oh.update();
  assert.equal(r.deepWaters.log.filter((l) => l[0] === 'refresh').length, 0, 'the change was the callback\'s - walking out re-cuts nothing');
});

test('AUDIT OH-F A3 indoors: a queued pixel waits as an inactive terrain for MaxFloorWaitFrames, then is given up; a load indoors promotes nothing', () => {
  const [[x, y]] = pitPixels(1);
  let inside = true;
  const r = rig({ inside: () => inside });
  const e = r.add(x, y);
  r.oh.promoted(e);
  r.oh.processOneTerrain();
  assert.equal(r.oh.stateOf(e).diagnostic, 'waiting:inactive-terrain');
  for (let i = 0; i < 700; i++) r.oh.processOneTerrain();
  assert.equal(r.oh.stateOf(e).diagnostic, 'rejected:inactive-terrain-timeout', 'six hundred tries behind the door, then given up - as the mod\'s own Update does');
  assert.equal(r.deepWaters.log.filter((l) => l[0] === 'refresh').length, 0, 'an inactive terrain asks the sea for nothing');
  const q = rig({ inside: () => inside });
  const e2 = q.add(x, y);
  q.oh.saveLoaded();
  assert.equal(q.oh.stateOf(e2) ?? null, null, 'OnSaveLoaded: FindObjectsOfType finds no inactive terrain');
  inside = false;
  q.oh.saveLoaded();
  assert.equal(q.oh.stateOf(e2)?.diagnostic, 'queued', 'outside it promotes every loaded terrain');
});

test('AUDIT OH-F A1/A2/A3 the wiring: the settings above the modal gate, the queue in both modes (after the sea outside), the plume in its pixel\'s box', () => {
  const w = hostText('src/scenes/world.js');
  const gate = w.indexOf('if (modes.frame(dt, now)) {');
  const check = w.indexOf('oceanHoles.checkSettings();');
  assert.ok(check > 0 && check < gate, 'LoadSettings\' callback is asked above the modal gate');
  const modal = w.slice(gate, w.indexOf('requestAnimationFrame(frame);', gate));
  assert.match(modal, /if \(oceanHoles\) oceanHoles\.processOneTerrain\(\);/, 'indoors the queue runs on');
  assert.match(w, /function ohFrame\(dt\) \{[^}]*oceanHoles\.processOneTerrain\(\);/, 'outside, OceanHoles.Update after the sea (its execution order)');
  assert.match(w, /inside: \(\) => \(modes\?\.mode \?\? 'exterior'\) !== 'exterior',[^\n]*AUDIT OH-F A3/);
  assert.match(w, /const b = entry\._box, reach = miasmaReach\(pit\.miasma\), c = \[x, pit\.miasma\.y, z\];\n\s*if \(b\) for \(let i = 0; i < 3; i\+\+\) \{ b\[i\] = Math\.min\(b\[i\], c\[i\] \+ reach\[i\]\); b\[3 \+ i\] = Math\.max\(b\[3 \+ i\], c\[i\] \+ reach\[3 \+ i\]\); \}/);
});

test('AUDIT OH-F A2 miasmaReach: the disc and a life\'s drift out, the whole rise up, the largest puff\'s half all round', async () => {
  const { miasmaReach, START_SIZE_MAX, DRIFT } = await import('../../src/world/oceanHolesMiasma.js');
  assert.equal(START_SIZE_MAX, 6);
  assert.equal(DRIFT, 0.12);
  const [x0, y0, z0, x1, y1, z1] = miasmaReach({ height: 300, radius: 19 });
  assert.ok(Math.abs(x1 - (19 + 0.12 * 30 + 3)) < 1e-9 && x0 === -x1 && z0 === -x1 && z1 === x1);
  assert.equal(y0, -3);
  assert.equal(y1, 303, 'v at most height / 30, for a 30 s life');
});
