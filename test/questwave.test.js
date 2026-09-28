// QUEST-WAVE (2026-09-26, SquidKamer, Warm Ashes - Ships' author: "ship encounters ... get jumped by everyone"; "no
// collision on monsters = free space to spawn enemy always"). CreateFoe places a wave through PlaceFoeFreely, whose
// OverlapSphere(0.65) meets every PLACED foe's capsule - Unity syncs a placed foe before the next action's test in the
// same tick (CreateFoe.cs:319-328), so a spot that is taken refuses the next foe and it waits a tick. Here a pool's
// stand is async (the career, the texture) and its record joins the pool only after, so WAQ_SHIP_SMALLRAID's thirteen
// placed in ONE tick saw none of their own - and on a deck every ray meets a rail, so every spot falls in the same two
// small slivers: thirteen foes in two heaps. Every quest arm holds its spot now until the stand lands
// (scenes/questFoeHost.js heldSpots / holdSpotWhile), the loose-foe door the same set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placeFoeFreely } from '../src/systems/quest/sceneMount.js';
import { placeFoeEnv, entityOccupancy, heldSpots, holdSpotWhile } from '../src/scenes/questFoeHost.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const PLAYER = [0, 0, 0];
/** A ship's deck: rails nine metres round the player, the deck at 0. */
const deck = () => ({
  raycastHit: (o, d) => (Math.abs(d[1]) > 0.99 ? { dist: Infinity, normal: null } : { dist: 9, normal: [-d[0], 0, -d[2]] }),
  heightAt: () => 0,
  sphereOverlaps: () => false,
});
const seeded = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const env = (collider, pool, rolls, held = true) => placeFoeEnv({
  collider, playerFeet: [PLAYER[0], PLAYER[1] + 0.9, PLAYER[2]], playerYawRad: 0, fovDegrees: 75, rolls,
  isOccupied: entityOccupancy((f) => f.ai?.feet, () => (held ? [...pool, ...heldSpots(collider)] : pool), PLAYER),
});
/** One machine tick of a wave: every action places, each stand still in flight when the next is placed. */
function tick(collider, pool, rolls, count, held = true) {
  const spots = [], landings = [];
  for (let i = 0; i < count; i++) {
    const spot = placeFoeFreely(env(collider, pool, rolls, held));
    if (!spot) continue;
    spots.push(spot);
    if (held) {
      let land;
      const stand = new Promise((r) => { land = () => { pool.push({ ai: { feet: [spot.x, spot.y - 1.25, spot.z], height: 1.8 } }); r(); }; });
      landings.push(land);
      holdSpotWhile(collider, spot, () => stand);
    }
  }
  return { spots, landings };
}
const tooClose = (spots) => {
  let n = 0;
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) if (Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z) < 1.1 - 1e-9) n++;
  return n;
};

test('QUEST-WAVE: thirteen placed in one tick on a deck stood in two heaps; now a spot in flight refuses the next, which waits a tick', () => {
  const before = tick(deck(), [], seeded(11), 13, false);
  assert.equal(before.spots.length, 13, 'every action placed at once');
  assert.ok(tooClose(before.spots) > 20, `and they stood inside each other (${tooClose(before.spots)} pairs closer than a capsule)`);
  const collider = deck();
  const now = tick(collider, [], seeded(11), 13);
  assert.ok(now.spots.length >= 2 && now.spots.length < 13, `the tick places what fits (${now.spots.length}); the rest try again next tick, as CreateFoe does`);
  assert.equal(tooClose(now.spots), 0, 'no two stand inside each other');
  assert.equal(heldSpots(collider).size, now.spots.length, 'each placed spot is held while its stand is in flight');
});

test('QUEST-WAVE: a hold lasts exactly as long as its stand - landed, the record blocks instead; a failed stand lets go too', async () => {
  const collider = deck(), pool = [];
  const { spots, landings } = tick(collider, pool, seeded(5), 13);
  for (const land of landings) land();
  await new Promise((r) => setImmediate(r));
  assert.equal(heldSpots(collider).size, 0, 'every hold released');
  assert.equal(pool.length, spots.length, 'and the landed records stand in the pool');
  const next = tick(collider, pool, seeded(5), 13);
  assert.equal(tooClose([...spots, ...next.spots]), 0, 'the next tick\'s spots keep clear of the landed ones');
  // a stand that throws, or rejects, releases its hold
  const c2 = deck();
  assert.throws(() => holdSpotWhile(c2, { x: 1, y: 1.25, z: 1 }, () => { throw new Error('no texture'); }), /no texture/);
  assert.equal(heldSpots(c2).size, 0);
  await holdSpotWhile(c2, { x: 1, y: 1.25, z: 1 }, () => Promise.reject(new Error('no career'))).catch(() => {});
  assert.equal(heldSpots(c2).size, 0);
});

test('QUEST-WAVE by source: every quest arm and the loose-foe door hold their spots in the one set, and ask it', () => {
  const world = rd('src/scenes/world.js'), ext = rd('src/scenes/exterior.js'), wm = rd('src/scenes/worldModes.js'), he = rd('src/scenes/hostEnchant.js');
  assert.match(world, /isOccupied: entityOccupancy\(\(f\) => f\.ai\?\.feet, \(\) => \[\.\.\.exteriorFoePool\(\), \.\.\.heldSpots\(collider\)\], feet\),/);
  assert.match(world, /holdSpotWhile\(collider, spot, \(\) => exteriorFoes\.spawnFoe\(foe\.foeType,/);
  assert.match(ext, /isOccupied: entityOccupancy\(\(f\) => f\.ai\?\.feet, \(\) => \[\.\.\.exteriorFoePool\(\), \.\.\.heldSpots\(collider\)\], feet\),/);
  assert.match(ext, /holdSpotWhile\(collider, spot, \(\) => exteriorFoes\.spawnFoe\(foe\.foeType,/);
  assert.match(wm, /\(\) => \[\.\.\.interiorFoePool\(\), \.\.\.heldSpots\(interiorCtx\.collider\)\]/);
  assert.match(wm, /holdSpotWhile\(interiorCtx\.collider, spot, \(\) => interiorFoes\.spawnFoe\(foe\.foeType,/);
  assert.match(wm, /\(\) => \[\.\.\.dungeonCtx\.foes, \.\.\.heldSpots\(dungeonCtx\.collider\)\]/);
  assert.match(wm, /holdSpotWhile\(dungeonCtx\.collider, spot, \(\) => dungeonCtx\.spawnQuestFoe\(\{/);
  assert.match(he, /const pending = heldSpots\(collider\);/);
  assert.match(he, /return holdSpotWhile\(collider, spot, \(\) => spawn\(mobileType, pos, \{ yawRad: yaw, allied \}\)\)\.catch\(\(\) => null\);/);
});
