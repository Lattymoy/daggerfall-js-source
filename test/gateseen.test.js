// GATE-SEEN (2026-09-26, Mac: "Somepeople cant see the gate spawn not sure but got reports of this" - "No oblivion
// portal to enter :("): two ways a player saw no gate. (1) It stood on built ground alone, and the streamed grid is
// the Land View Distance's: the omen's town is 2 to 4 pixels off, so on a short view nothing stood - the beacon
// "found by looking up" included. A gate on a pixel not built yet stands its BEACON now, on the ground the pixel
// will be built from; the stone, its collider, light and door wait for the pixel. (2) The site scan read a region's
// every row, and Replace Game Artwork appends a mod's locations (Roleplay & Realism's fort) on some clients and not
// others - the region's list changed length and the day's roll picked two spots. The scan reads the game's own rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGatePool, gatePlacement } from '../src/scenes/gatePool.js';
import { GatePassRenderer } from '../src/render/gatePass.js';
import { gateArchProfile } from '../src/world/gateModel.js';
import { gateTimes, GATE_RISE_MS } from '../src/net/gateLaw.js';
import { scanGatePixels } from '../src/systems/gateSite.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A gate standing, risen, sealed; its pixel built or not (`built`), the far ground `far` (null: none to ask). */
function world({ built = true, far = 40, phase = 'sealed' } = {}) {
  const t = gateTimes(700);
  const clock = { now: phase === 'open' ? t.openAt + 1000 : t.riseAt + GATE_RISE_MS + 1000 };
  const col = { adds: [], removes: 0 };
  const g = { day: 700, px: 400, py: 200, spot: [409.6, 409.6], t, fellAt: null, near: 'Copperham' };
  const entered = [];
  const pool = createGatePool({
    renderer: { createMesh: () => ({ stone: true }), uploadTexture() {}, uploadEmissionTexture() {} }, gl: null,
    collider: () => ({ addMesh: (k) => col.adds.push(k), removeBucket: () => { col.removes++; } }),
    standing: () => ({ ...g, phase }),
    pixelTranslation: () => [0, 0, 0],
    heightAt: () => (built ? 12 : -Infinity),
    groundAt: far == null ? null : () => far,
    now: () => clock.now,
    feet: () => [409.6, 12, 409.6],
    ready: () => true, enter: (x) => entered.push(x),
  });
  return { pool, col, t, clock, g, entered };
}

test('GATE-SEEN: a gate on a pixel not built yet stands its beacon on the ground the pixel will be built from; built, it stands whole', () => {
  const t = gateTimes(700);
  const g = { day: 700, px: 400, py: 200, spot: [409.6, 409.6], t, fellAt: null };
  const at = { pixelTranslation: () => [0, 0, 0], heightAt: () => -Infinity, now: t.riseAt + GATE_RISE_MS + 1 };
  assert.equal(gatePlacement(g, at), null, 'no ground to ask: nowhere, as before');
  const asked = [];
  const far = gatePlacement(g, { ...at, groundAt: (px, py, x, z) => { asked.push([px, py, x, z]); return 55; } });
  assert.deepEqual(asked, [[400, 200, 409.6, 409.6]], 'the pixel and the spot asked for');
  assert.equal(far.coarse, true);
  assert.equal(far.origin[1], 55, 'on the far ground');
  const near = gatePlacement(g, { ...at, heightAt: () => 12, groundAt: () => 55 });
  assert.equal(near.coarse, false, 'a built pixel is the ground, whatever the far one says');
  assert.equal(near.origin[1], 12);
  assert.equal(gatePlacement(g, { ...at, groundAt: () => -Infinity }), null, 'a far ground with no answer stands nothing');
});

test('GATE-SEEN: the beacon alone - no stone, no collider, no light, no door - until the pixel is built', () => {
  const w = world({ built: false });
  const place = w.pool.frame(0.016);
  assert.ok(place?.coarse, 'it stands, far');
  assert.equal(w.pool.draw({ drawMesh: () => assert.fail('no stone at a beacon alone') }), 0);
  assert.equal(w.col.adds.length, 0, 'nothing to walk into');
  assert.deepEqual(w.pool.lights(), []);
  assert.deepEqual(w.pool.targets(), []);
  assert.equal(w.pool.activate('gate:700'), false, 'no door');
  const open = world({ built: false, phase: 'open' });
  open.pool.frame(0.016);
  assert.equal(open.pool.activate('gate:700'), false, 'not even open: a door is at the gate, never at its beacon');
  assert.deepEqual(open.entered, []);
  const built = world({ built: true });
  const whole = built.pool.frame(0.016);
  assert.equal(whole.coarse, false);
  assert.equal(built.col.adds.length, 1, 'built: the stone stands in the collider');
  assert.equal(built.pool.lights().length, 1);
  assert.equal(built.pool.targets().length, 1);
  let drawn = 0;
  assert.equal(built.pool.draw({ drawMesh: () => { drawn++; } }), 1, 'and the stone is drawn');
  assert.equal(drawn, 1);
  assert.equal(world({ built: false, far: null }).pool.frame(0.016), null, 'a host with no far ground: nowhere, as before');
});

test('GATE-SEEN: the pool hands its pass the beacon alone while far, and the whole gate once built', () => {
  for (const [built, want] of [[false, 1], [true, 2]]) {
    const { gl, calls } = fakeGl();
    const t = gateTimes(700);
    const pool = createGatePool({
      gl, standing: () => ({ day: 700, px: 400, py: 200, spot: [409.6, 409.6], t, fellAt: null, phase: 'sealed' }),
      pixelTranslation: () => [0, 0, 0], heightAt: () => (built ? 12 : -Infinity), groundAt: () => 40,
      now: () => t.riseAt + GATE_RISE_MS + 1000,
    });
    pool.frame(0.016);
    calls.length = 0;
    const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    pool.drawPass(I, I, [0, 0, 0], 1);
    assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, want, built ? 'the beacon and the fire' : 'the beacon alone');
  }
});

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, ONE_MINUS_SRC_ALPHA: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}

test('GATE-SEEN: the pass draws a far gate\'s beacon and no fire - a near one both, and each counts once', () => {
  const { gl, calls } = fakeGl();
  const pass = new GatePassRenderer(gl, gateArchProfile());
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  pass.draw([{ origin: [0, 0, 0], yaw: 0, open: 0, fade: 1, beaconOnly: true }], I, I, [0, 0, 0], 1);
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, 1, 'the beacon alone');
  assert.equal(pass.drawn, 1);
  calls.length = 0;
  pass.draw([{ origin: [0, 0, 0], yaw: 0, open: 0, fade: 1 }], I, I, [0, 0, 0], 1);
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, 2, 'a beacon and a fire');
  assert.equal(pass.drawn, 1);
});

/** A two-region map: region 0 holds a town and, past its own rows, a mod's added location. */
function mapsWith({ added = true, base = true } = {}) {
  const town = { mapId: 100 * 1000 + 500, locationType: LOCATION_TYPES.TownCity };
  const fort = { mapId: 103 * 1000 + 503, locationType: LOCATION_TYPES.Tavern ?? 5 };
  const rows = added ? [town, fort] : [town];
  return {
    regionCount: 1,
    getRegion: () => ({ mapTable: rows, mapNames: ['Copperham', 'Northrock Fort'] }),
    ...(base ? { baseLocationCount: () => 1 } : {}),
    getClimateIndex: () => CLIMATES.Temperate ?? 231,
    getPoliticIndex: () => 128,
    getRegionIndexAt: () => 0,
  };
}

test('GATE-SEEN: every client scans the same map - a mod\'s appended location bars no pixel, so the suitable lists are the game\'s own', () => {
  const heightAt = () => 100;
  const plain = scanGatePixels(mapsWith({ added: false }), { heightAt });
  const modded = scanGatePixels(mapsWith({ added: true }), { heightAt });
  const list = (s) => [...(s.byRegion.get(0) ?? [])];
  assert.ok(list(plain).length > 0, 'the town\'s ring holds suitable pixels');
  assert.deepEqual(list(modded), list(plain), 'the fort\'s neighbourhood is the same on both clients');
  assert.deepEqual(modded.towns.map((t) => t.name), ['Copperham'], 'and it names no town');
  // a map with no base count (a fake, an old reader) reads every row, as before
  const all = scanGatePixels(mapsWith({ added: true, base: false }), { heightAt });
  assert.ok(list(all).length < list(plain).length, 'without the count the fort bars its neighbours');
});

test('GATE-SEEN by source: the world hands the pool the far ground - the terrain sampler\'s own kernel for the gate\'s pixel', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /groundAt: \(px, py, x, z\) => gateGroundAt\(px, py, x, z\),/);
  assert.match(w, /if \(key !== _gateKernelAt\) \{ _gateKernelAt = key; _gateKernel = sampleKernel\(woods, px, py\); \}/);
  assert.match(w, /return _gateKernel\(lx \/ heightCell, lz \/ heightCell\) \* worldHeight \+ t\[1\];/, 'heightAt\'s own sample coordinates and scale');
});
