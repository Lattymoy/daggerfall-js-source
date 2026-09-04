// ID1 - AN ITEM DROPPED INDOORS LANDED OUTSIDE.
//
// GameObjectHelper.CreateDroppedLootContainer (:716-775) picks the
// container's PARENT BY CONTEXT:
//
//     if (GameManager.Instance.IsPlayerInside)
//         if (IsPlayerInsideDungeon) parent = playerEnterExit.Dungeon.transform;
//         else                       parent = playerEnterExit.Interior.transform;
//     else                           parent = StreamingTarget.transform;
//
// and only the OUTDOOR arm enrols the container in the streaming
// world's loose-object bookkeeping:
//
//     if (!GameManager.Instance.IsPlayerInside)
//         GameManager.Instance.StreamingWorld.TrackLooseObject(loot.gameObject, true);
//
// The port had two of those three arms. dungeonContext mounts its own
// pool; world.js and exterior.js mount the streaming one; the INTERIOR
// arm of worldModes mounted none, so `host.makeInventory`'s onDrop -
// the world host's - was the only one it could reach. That handler
// drops at `dropFeet()`, which reads the EXTERIOR player and raycasts
// the EXTERIOR collider, and stamps the pile with the map pixel that
// IS the port's TrackLooseObject.
//
// Three things followed from one missing pool: the item did not land
// where it was dropped, it could not be picked back up (the interior's
// E-ray had no pile targets), and it was enrolled in P2's
// out-of-range collection sweep - a sweep DFU never runs on an
// interior container - so walking far enough could destroy it.
//
// The same member is GivePc's (GivePc.cs:168), so the quest reward
// pile had the identical three arms and the identical missing one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDroppedLoot } from '../src/scenes/droppedLoot.js';
import { nearbyLootRecords } from '../src/scenes/shared.js';
import { updateNearbyObjects, getNearbyObjects, NEARBY } from '../src/systems/nearbyObjects.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const wm = () => read('src/scenes/worldModes.js');

/** The pool with its GL and archive deps stubbed - enough to exercise
 *  every law below, none of which is about pixels on a screen. */
let _roll = 0;
const pool = () => {
  _roll = 0;
  return createDroppedLoot({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} },
    getTexture: () => new Promise(() => {}),   // never resolves: no batch is minted, which no law here needs
    uploadRecordFrame: () => {},
    // ADVANCING, not constant: a fixed roll cannot tell a restore that
    // KEEPS the saved icon from one that rerolls it and happens to
    // land on the same record. The first campaign's icon mutant
    // survived on exactly that.
    pick: () => _roll++ % 20,
  });
};
const item = (name) => ({ name });

test('ID1: a pile dropped with NO pixel key is not enrolled in the collection sweep', () => {
  // This IS TrackLooseObject's gate. The port's pixelKey is what the
  // sweep matches on, so an interior drop must carry none.
  const p = pool();
  const inside = p.dropPile([item('a')], [1, 0, 1]);              // the interior arm: no key
  const outside = p.dropPile([item('b')], [2, 0, 2], '10,20');    // the outdoor arm: tracked
  assert.equal(inside.pixelKey, null);
  assert.equal(outside.pixelKey, '10,20');
  p.collectPixel('10,20');
  assert.deepEqual(p._piles.map((x) => x.items[0].name), ['a'],
    'the tracked pile is collected out of range; the untracked one is not');
});

test('ID1: the interior pool is its OWN pool - a pile dropped inside is not in the world list', () => {
  const world = pool();
  const interior = pool();
  interior.dropPile([item('ring')], [3, 0, 3]);
  assert.equal(world._piles.length, 0, 'nothing leaks into the streaming pool');
  assert.equal(interior._piles.length, 1);
  assert.deepEqual(interior._piles[0].pos, [3, 0, 3], 'and it lands where it was dropped');
});

test('ID1: an interior pile is an activation target and a Detect Treasure object', () => {
  const p = pool();
  const pile = p.dropPile([item('gem')], [4, 0, -4]);
  assert.deepEqual(p.lootTargets().map((t) => t.key), [`droppedLoot:${pile.id}`]);
  assert.equal(p.pileFor(`droppedLoot:${pile.id}`), pile);
  const list = updateNearbyObjects([0, 0, 0], { loot: nearbyLootRecords({ piles: p._piles }) });
  assert.equal(getNearbyObjects(list, NEARBY.Treasure).length, 1);
});

test('ID1: the piles cache with the scene and come back on re-entry', () => {
  // A DaggerfallLoot in an interior is a SerializableLootContainer, so
  // it rides CacheScene/RestoreCachedScene like the shelves.
  const p = pool();
  p.dropPile([item('sword')], [5, 1, 5]);
  const cached = p._piles.filter((x) => x.items.length)
    .map((x) => ({ pos: [...x.pos], record: x.record, items: x.items.map((it) => ({ ...it })) }));
  p.restorePiles(null);                      // the teardown on the way out
  assert.equal(p._piles.length, 0);
  p.restorePiles(cached);                    // the restore on the way back in
  assert.equal(p._piles.length, 1);
  assert.deepEqual(p._piles[0].pos, [5, 1, 5]);
  assert.equal(p._piles[0].items[0].name, 'sword');
  assert.equal(p._piles[0].record, cached[0].record, 'a restore must not reroll the icon');
});

test('ID1: an emptied pile is freed at the WINDOW close, not at the last item', () => {
  const p = pool();
  const pile = p.dropPile([item('coin')], [0, 0, 0]);
  pile.items.length = 0;
  assert.equal(p._piles.length, 1, 'still there while the window is open');
  assert.equal(p.lootTargets().length, 0, 'but no longer activatable');
  p.releaseEmptied();
  assert.equal(p._piles.length, 0);
});

test('ID1: the interior host mounts its own pool, with no pixel key', () => {
  const m = wm();
  assert.match(m, /const interiorDropped = createDroppedLoot\(\{ renderer, getTexture, uploadRecordFrame \}\);/);
  // ROAD-G G5 widened this door: the icon and the replaced container's
  // x/z ride OnPop too. The pixel key is still NULL - that third
  // argument IS TrackLooseObject, and an interior has no map pixel.
  assert.match(m, /interiorDropped\.dropPile\(items, containerDropPos\(at, interiorDropFeet\(\)\), null, icon\),/,
    'the pixel key stays null - that argument IS TrackLooseObject');
  assert.match(m, /onDrop: \(items, icon = null, at = null\) =>/, 'and OnPop hands both halves through');
  // FindGroundPosition, on the INTERIOR collider
  const feet = m.slice(m.indexOf('const interiorDropFeet = ()'), m.indexOf('const interiorInventory'));
  assert.match(feet, /const p0 = \[\.\.\.player\.pos\];/, 'it starts at the PLAYER');
  assert.match(feet, /interiorCtx\?\.collider \? interiorCtx\.collider\.raycast\(p0, \[0, -1, 0\], 10\) : NaN;/, 'and finds the ground below them, on the INTERIOR collider');
  assert.match(feet, /if \(Number\.isFinite\(d\)\) p0\[1\] -= d;/, 'a miss leaves the feet where they are');
});

test('ID1: EVERY inventory this host opens goes through the one door', () => {
  const m = wm();
  // the door composes rather than overwrites - `...extra` before
  // onClose would have silently dropped the emptied-container free
  const door = m.slice(m.indexOf('const interiorInventory = ('), m.indexOf('let interiorCtx = null;'));
  assert.match(door, /\.\.\.extra,\n\s*onClose: \(\) => \{ interiorDropped\.releaseEmptied\(\); onClose\?\.\(\); \},/);
  // and no interior call site reaches past it. The slice starts AFTER
  // the door's own body - the door is the one legitimate caller of
  // host.makeInventory, which is the point.
  const body = m.slice(m.indexOf('let interiorCtx = null;'));
  const raw = [...body.matchAll(/host\.makeInventory\?\.\(/g)];
  assert.equal(raw.length, 0, 'no interior window bypasses the door');
});

test('ID1: the piles are picked up, drawn, cached, restored and freed', () => {
  const m = wm();
  assert.match(m, /targets\.push\(\.\.\.interiorDropped\.lootTargets\(\)\);/, 'the E-ray sees them');
  assert.match(m, /if \(key\.startsWith\('droppedLoot:'\)\) \{/, 'and activating one opens it');
  assert.match(m, /interiorDropped\.tickFlats\(dt\);/, 'the flats animate');
  assert.match(m, /const _dropBatches = interiorDropped\.batches\(\);/, 'and are drawn');
  assert.match(m, /const droppedPiles = interiorDropped\._piles/, 'CacheScene builds them');
  assert.match(m, /return \{ lootContainers, actionDoors, droppedPiles \};/,
    'and RETURNS them - a built list the state does not carry is not cached at all');
  assert.match(m, /interiorDropped\.restorePiles\(data\.droppedPiles\);/, 'RestoreCachedScene brings them back');
  // BOTH teardowns free them - the door exit and the quest-teleport /
  // load arm. One of the two is exactly the kind of site the port has
  // leaked batches from before.
  assert.equal([...m.matchAll(/interiorDropped\.restorePiles\(null\);/g)].length, 2,
    'both interior teardowns free the pool');
});

test('ID1: the interior Detect scan carries the piles - DT1\'s routed row, closed', () => {
  const m = wm();
  const feed = m.slice(m.indexOf('const detectFeed = createDetectFeed'), m.indexOf('let interiorCtx = null;'));
  assert.match(feed, /piles: interiorDropped\._piles,/,
    'GetActiveLoot has no kind gate - the player\'s own drop is a container like any other');
});

test('ID1: the quest reward mints on the ground the player is standing on', () => {
  const m = wm();
  const arm = m.slice(m.indexOf('mintRewardPile(dfItem) {'));
  const interior = arm.slice(arm.indexOf("if (mode === 'interior' && interiorCtx) {"), arm.indexOf('return undefined;'));
  assert.match(interior, /return \(\) => \{/, 'a thunk, like the dungeon and world arms - the mint is deferred');
  assert.match(interior, /interiorDropped\.dropPile\(\[dfItem\], interiorDropFeet\(\)\)/);
  assert.match(interior, /mountInterior\(interiorInventory\(\{ loot: droppedLootHooks\(pile\) \}\)\)/,
    'and opens on the pile, the same remote-target law every container rides - G5: with the pile\'s DaggerfallLoot identity, so its icon can be cycled');
});
