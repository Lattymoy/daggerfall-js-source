// FIELD BUGS 2026-10-26 - BREACH-SPOILS (bible/01-Overview/bugs/Field-Bugs-2026-10-26.md; a player, of the Elite Breach: "I
// also have been experiencing a bug where I can't pick up any of the loot, and I have to leave the breach and claim 20+
// pieces through the mailbox"): A REDOUBT'S SPOILS ON A HALL'S FLOOR ARE PRESSED. EG-E threw a Redoubt's spoils into the
// Hour's pool and routed the press to it (scenes/world.js floorPool), but the hall stood no target for them - the Hour
// (worldModes.js standSdRealm), the court (gate/gateStand.js) and the Ketch (ketch/ketchDeckHost.js) each do - so the ray
// never met a piece, the crosshair never named one, and each lay until the next Redoubt's throw or the way out mailed it
// (LOST-SPOILS). Pinned on the circle's own module (scenes/eliteGates/egCircleHost.js standEgHall), stood as the mode machine
// stands it, over the pool's own targets and the real pick (player/activate.js pickActivatableHit).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEgCircleHost } from '../../../src/scenes/eliteGates/egCircleHost.js';
import { Collider } from '../../../src/player/collider.js';
import { pickActivatableHit, RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE } from '../../../src/player/activate.js';
import { EG_TEXT } from '../../../src/net/eliteGates/egLaw.js';

const SEED = 0x5eed1234, B = '0123456789abcdef';
const eh = (c) => ({ b: B, seed: SEED, c, geo: 0 });

/** A built context's two activation doors (scenes/dungeonContext.js addActivationTargets, addActivationNamer), recorded; the
 *  outer host's spoils seams (scenes/world.js spoilTargets, spoilName) over `spoils`. */
function rig(spoils) {
  const targets = [], namers = [];
  const host = {
    spoilTargets: () => spoils.list,
    spoilName: (key) => (spoils.list.some((s) => s.key === key) ? { title: `the piece ${key}` } : null),
    egGateOpen: () => false,
  };
  const circle = createEgCircleHost({ renderer: null, host, wm: { mode: 'dungeon', dungeonCtx: null, dungeonLoc: null } });
  const ctx = {
    dynamicDraws: [], collider: new Collider(() => -Infinity), addTeardown() {},
    addActivationTargets: (fn) => { targets.push(fn); return () => {}; },
    addActivationNamer: (fn) => { namers.push(fn); return () => {}; },
  };
  return { circle, ctx, targets, namers, all: () => targets.flatMap((fn) => fn() ?? []), name: (key) => namers.reduce((t, n) => t ?? n(key), null) };
}

test('BREACH-SPOILS: a hall stood stands the floor\'s spoils as targets the press can win, each named by its own word; none on the floor stands none; the way home still named (mutants: the targets not stood; the namer not stood; the namer answering every key)', () => {
  const spoils = { list: [] };
  const R = rig(spoils);
  R.circle.standEgHall(R.ctx, eh(4));
  assert.deepEqual(R.all(), [], 'an empty floor stands no targets');
  // a Redoubt's spoils thrown: two pieces at rest on the floor, the pool's own target shape (scenes/spoilsPool.js targets)
  const box = (x) => ({ min: [x - 0.3, 0, -0.3], max: [x + 0.3, 0.6, 0.3] });
  spoils.list = [
    { key: 'spoil:0', aabb: box(0), distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE },
    { key: 'spoilGold:1', aabb: box(2), distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE },
  ];
  assert.deepEqual(R.all().map((t) => t.key), ['spoil:0', 'spoilGold:1'], 'the floor\'s pieces are the hall\'s targets, read live');
  // the press's own pick over them: a ray from a body before the first piece meets it
  const hit = pickActivatableHit([0, 0.3, -2], [0, 0, 1], R.all(), new Collider(() => -Infinity));   // open ground: no wall between
  assert.equal(hit?.key, 'spoil:0', 'the ray meets the piece before it');
  assert.ok(hit.distance <= hit.reach, 'within the press\'s reach');
  assert.deepEqual(R.name('spoil:0'), { title: 'the piece spoil:0' });
  assert.deepEqual(R.name('spoilGold:1'), { title: 'the piece spoilGold:1' });
  assert.equal(R.name('door:7'), null, 'a key not the spoils\' is not named by them');
  assert.deepEqual(R.name('exit:0'), { title: EG_TEXT.wayHome }, 'the way home still named');
});

test('BREACH-SPOILS: one stand, one door each - and the next circle\'s context (a step out and in again, where THE SWAP was not ready) stands its own', () => {
  const spoils = { list: [{ key: 'spoil:3', aabb: { min: [0, 0, 0], max: [1, 1, 1] }, distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE }] };
  const R = rig(spoils);
  R.circle.standEgHall(R.ctx, eh(4));
  assert.equal(R.targets.length, 1, 'one targets door a stand');
  assert.equal(R.namers.length, 2, 'two namers a stand: the spoils\' and the way home\'s');
  assert.deepEqual(R.all().map((t) => t.key), ['spoil:3']);
  const S = rig(spoils);
  S.circle.standEgHall(S.ctx, eh(5));
  assert.deepEqual(S.all().map((t) => t.key), ['spoil:3'], 'the next circle\'s context stands them too');
});
