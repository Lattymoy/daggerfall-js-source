// ETHER-HOLD (from play, 2026-10-11): Deep Waters' bathymetry is the Bay's. TAMRIEL2 held the near promote to the
// Bay, but the pump's deferred builds and a refresh still carved an Eltheric Ocean pixel's floor - a player went over the
// side onto a seabed under the drawn surface and could neither swim nor float back. The host's one promote holds them all.
// PIN MOVED (ETHER-DEEP, bible/03-World/Eltheric-Ocean.md): the floor was carved against the Bay's clamped corner, and
// the sea past the Veil has its own bake now - a host told the Eltheric Ocean stands (`ether`) carves its box by every
// arm (test/world/deepWater/ether_deep.test.js); this pin is a host told nothing of it, which holds the box with the continent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeepWatersHost } from '../../src/scenes/deepWater/deepWatersHost.js';
import { landfall } from '../../src/world/ethericSea.js';

const pixel = (px, py) => ({ px, py, samples: new Float32Array(4), tilemap: new Uint8Array(4), tilemapBytes: new Uint8Array(4) });
const floor = () => ({ positions: new Float32Array(9), indices: new Uint32Array(0), floorGridIndexCount: 0, vertexLocalY: new Float32Array(4225) });
const settle = async () => { for (let i = 0; i < 5; i++) await null; };

test('ETHER-HOLD: a host told nothing of the sea carves the Bay alone - an Eltheric Ocean pixel and one of the continent past the map keep the kernel\'s water, by every arm', async () => {
  const lf = landfall();
  const ether = pixel(lf.px, lf.py), west = pixel(-5, 250), bay = pixel(500, 250);
  const built = new Map([[`${ether.px},${ether.py}`, ether], ['-5,250', west], ['500,250', bay]]);
  const asked = [];
  let answer;
  const client = { ready: new Promise((r) => { answer = r; }), buildPixel: async (job) => { asked.push(`${job.px},${job.py}`); return { ocean: true, floor: floor() }; } };
  let here = { x: ether.px, y: ether.py };
  const host = createDeepWatersHost({ built, climateAt: () => 223, currentPixel: () => here, client, clock: () => 0 });
  answer({ mapPixelOrCardinalNeighborHasWaterCells: () => true });
  await host.ready; await settle();
  assert.equal(await host.promoteNear(ether), null, 'the near promote past the map answers nothing');
  for (let i = 0; i < 6; i++) { host.pump(); await settle(); }
  assert.deepEqual(asked, ['500,250'], 'the worker is asked for the Bay\'s pixel alone');
  assert.ok(!ether.deepWaters?.floor && !west.deepWaters?.floor, 'no seafloor carved past the map');
  assert.equal(host.floorLocalY(ether, 400, 400), null, 'heightAt keeps the kernel\'s ground there');
  assert.ok(bay.deepWaters?.floor, 'the Bay\'s own sea is carved as ever');
  here = { x: west.px, y: west.py };
  host.refreshLoadedTile(west, true);
  for (let i = 0; i < 3; i++) { host.pump(); await settle(); }
  assert.deepEqual(asked, ['500,250']);
  assert.ok(!west.deepWaters?.floor);
});
