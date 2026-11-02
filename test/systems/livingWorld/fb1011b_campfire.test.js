// CAMP-FIRE (FIELD BUGS 2026-10-11b, bible/01-Overview/bugs/Field-Bugs-2026-10-11b.md; the Discord's "The Morrowind Model For a
// Caravan Campfire is a Dead Dude"): a road camp's fire is its flame, never one of the fallen. The roads' layer hands the
// sprites its camp's fire as a still flat nobody talks to (LW9) - the shape MWNPC10c reads as the fallen - so with the
// Morrowind bodies on, the fire stood as a dead Breton and its flame drew its shadow alone. The fire says it is nobody's
// body (`body: false`) and the lane stands none for it. Pinned on the real roads' layer's own fire, through the real sprites
// over a recording lane. Pure and synthetic: no game data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLivingRoads, corpseLook } from '../../../src/scenes/livingWorld/livingRoads.js';
import { createTravellerSprites } from '../../../src/world/travellerSprites.js';
import { travellerRoster } from '../../../src/systems/livingWorld/census.js';
import { townTrips, partyAt, CALENDAR_MPM } from '../../../src/systems/livingWorld/trips.js';
import { DAY_MIN } from '../../../src/systems/livingWorld/dayPlan.js';
import { createRelations } from '../../../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../../../src/systems/worldTick.js';
import { FIRE_FLAT } from '../../../src/systems/survival/camp.js';

const settle = () => new Promise((r) => setTimeout(r, 0));

/** lw9_traffic's small map: the planner's way the straight run of pixels between two towns. */
function miniWorld(towns) {
  const rosters = new Map();
  return {
    townsNear: (px, py, r) => towns.filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= r).sort((a, b) => a.mapId - b.mapId),
    routeOf: (a, b) => {
      const k = Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));
      const pixels = [];
      for (let i = 0; i <= k; i++) pixels.push({ x: Math.round(a.px + ((b.px - a.px) * i) / k), y: Math.round(a.py + ((b.py - a.py) * i) / k) });
      return { pixels, kinds: pixels.slice(1).map(() => 'road') };
    },
    rosterOf: (t) => { let r = rosters.get(t.mapId); if (!r) { r = travellerRoster(t); rosters.set(t.mapId, r); } return r; },
    templeTown: (t) => t.blocks >= 16,
    dryAt: () => true,
  };
}
const town = (mapId, px, py, blocks) => ({ mapId, px, py, blocks, type: 0, region: 17, people: 3, name: `T${mapId}`, port: false });

/** The roads' layer's own list at a lit camp by night - its fire as the layer mints it. */
function campList() {
  const city = town(970, 100, 100, 30), b = town(971, 108, 100, 30);
  const world = miniWorld([city, b]);
  const lists = [];
  const sprites = { sync: (list) => { lists.push(list.map((m) => ({ ...m }))); }, batches: () => [], persons: () => [], bodyOf: () => null, clear: () => {} };
  for (let day = 300; day < 340; day++) {
    const t = day * DAY_MIN + 23 * 60;
    for (const tr of townTrips(city, t, world, { mpm: CALENDAR_MPM, memo: new Map() }) ?? []) {
      const at = partyAt(tr, t);
      if ((at.phase !== 'out' && at.phase !== 'back') || !at.camp || at.halt || at.inn) continue;
      const roads = createLivingRoads({ world, mpm: CALENDAR_MPM, clock: () => t, baseRate: () => CLASSIC_MINUTES_PER_SECOND, sceneOf: (nx, nz) => [nx / 40, 0, nz / 40],
        here: () => ({ x: at.x, z: at.z }), sprites: /** @type {any} */ (sprites), relations: () => createRelations() });
      roads.frame(1 / 30, [at.x / 40, 1.6, at.z / 40]);
      const list = lists[lists.length - 1];
      if (list.some((m) => /^fire:/.test(m.key))) return list;
    }
  }
  return null;
}

function recordingLane() {
  const L = { offered: [], standing: new Set() };
  Object.assign(L, {
    begin() { L.offered.length = 0; },
    stand(lane, a) { L.offered.push({ lane, id: a.id, dead: a.dead }); },
    end() {}, has(lane, id) { return L.standing.has(id); }, draw() {}, drawVeiled() {}, destroy() {}, offsetAll() {},
  });
  return L;
}

test('CAMP-FIRE: the roads\' layer mints its camp\'s fire as nobody\'s body - the flame\'s flat, nobody to talk to, `body: false`', () => {
  const list = campList();
  assert.ok(list, 'a lit camp by night in the synthetic map');
  const fire = list.find((m) => /^fire:/.test(m.key));
  assert.deepEqual(fire.flat, FIRE_FLAT);
  assert.equal(fire.talk, false);
  assert.equal(fire.body, false, 'the fire says it is no one');
  assert.ok(list.filter((m) => !/^fire:/.test(m.key)).every((m) => m.body !== false), 'every other entry is someone');
});

test('CAMP-FIRE: with the Morrowind bodies on, the camp\'s fire stands no body and its flame draws - the fallen beside it still lie dead', async () => {
  const fire = campList().find((m) => /^fire:/.test(m.key));
  const fallen = { key: 'd', res: { id: 'L7.t3', cls: null, sex: 'male', gender: 0, race: 'Redguard', archive: 381, face: 5, name: 'Ann', job: 'farmer' },
    feet: [4, 0, 0], yaw: 0, moving: false, distM: 5, talk: false, flat: corpseLook() };
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) };
  const renderer = { textures: new Map(), createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch() {} };
  let lane = null;
  const sp = createTravellerSprites({ renderer, getTexture: async () => tex, uploadRecordFrame() {}, laneName: 'roads', wantBodies: () => true, makeBodies: () => (lane = recordingLane()) });
  const list = [{ ...fire, distM: 5 }, fallen];
  sp.sync(list); await settle(); sp.sync(list);
  sp.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  lane.standing.add(sp.bodyOf('d').id);   // the fallen's body stands, so its sprite casts alone
  sp.drawBodies({}, null, null, [0, 0, 0], 1 / 60);
  assert.equal(sp.bodyOf('d').batch.castOnly, true, 'the lane is live: a standing body\'s sprite casts alone');
  const flame = sp.bodyOf(fire.key);
  assert.ok(flame?.batch, 'the fire has its sprite');
  assert.ok(!lane.offered.some((o) => o.id === flame.id), 'no body stands for the fire');
  assert.ok(sp.batches().includes(flame.batch), 'its flame in the billboard pass');
  assert.notEqual(flame.batch.castOnly, true, 'the flame draws, not its shadow alone');
  const dead = lane.offered.find((o) => o.id === sp.bodyOf('d').id);
  assert.ok(dead && dead.dead > 0, 'the fallen lie dead');
  assert.equal(lane.offered.length, 1);
});
