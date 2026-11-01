// IC-SWAP-BEHIND (2026-10-26, bible/03-World/Arena-Provinces.md IC-GRAND, "Built behind the view that stands") - every
// rebuild of a standing pixel built behind its view and swapped in in one step (scenes/swapBehind.js; player/collider.js
// hold and wake, ai/cover.js, player/lateSolid.js rename; scenes/world.js and scenes/pixelBuild.js wired), pinned by state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// IC-SWAP-BEHIND (2026-10-26, the owner walking the Imperial City: "Weird pop in issues in the city when moving"; "No band
// aids for any of this") - A PIXEL BUILT AGAIN BEHIND THE ONE THAT STANDS (scenes/swapBehind.js): every rebuild of a
// standing pixel tore it down and then built it, the pixel standing nothing for the build's length; now the view that
// stands stays until the one built behind it publishes, and the swap is one step.
test('IC-SWAP-BEHIND THE COLLIDER HOLDS A VIEW BUILT BEHIND - a held key\'s bucket (and its gates\', `key:...`) answers no query, files nowhere, bounds nothing, while the standing view\'s answers; woken, it answers under the pixel\'s own key, its cover and its withheld late parts with it; a key standing there refused; let go, nothing left (mutants: a held bucket queried; the gates not held; the wake not renamed; the cover live)', async () => {
  const { Collider } = await import('../../src/player/collider.js');
  const { createCoverIndex } = await import('../../src/ai/cover.js');
  const { lateSolidsOf } = await import('../../src/player/lateSolid.js');
  const box = (cx) => {   // a 2 m box about (cx, 1, 0)
    const P = [], I = [];
    const v = [[-1, 0, -1], [1, 0, -1], [1, 2, -1], [-1, 2, -1], [-1, 0, 1], [1, 0, 1], [1, 2, 1], [-1, 2, 1]].map(([x, y, z]) => [x + cx, y, z]);
    for (const p of v) P.push(...p);
    for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) I.push(f[0], f[1], f[2], f[0], f[2], f[3]);
    return { P: Float32Array.from(P), I: Uint32Array.from(I) };
  };
  const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const c = new Collider(() => -Infinity);
  c.cover = createCoverIndex({ enabled: () => true });
  const late = lateSolidsOf(c);
  const hitAt = (x) => c.raycast([x, 5, 0], [0, -1, 0], 10);
  const old = box(0), behind = box(10), gate = box(20);
  c.addMesh('3,4', old.P, old.I, ID);
  c.hold('3,4#b');
  c.addMesh('3,4#b', behind.P, behind.I, ID);
  c.addMesh('3,4#b:gate:0', gate.P, gate.I, ID);
  c.cover.add('3,4#b', [{ c: [10, 0, 0], r: 1, h: 2 }]);
  late.add('3,4#b', behind.P, behind.I, ID, { body: { pos: [10, 0.5, 0] } });   // withheld: it closes on the body
  assert.ok(Number.isFinite(hitAt(0)), 'the standing view answers');
  assert.equal(hitAt(10), Infinity, 'the view behind answers nothing');
  assert.equal(hitAt(20), Infinity, 'nor its gate');
  assert.ok(c.bounds().max[0] < 5, 'bounds the standing view alone');
  assert.equal(c.insideSolid([10, 1, 0]), false);
  assert.equal(c.cover.size(), 0, 'its cover held');
  assert.ok(c.holds('3,4#b') && c.holds('3,4#b:gate:0'));
  // woken under a key that still stands: refused (its view goes first)
  assert.throws(() => c.wake('3,4#b', '3,4'));
  // the old view down, the new one woken: it answers under the pixel's own key, its gate under its own
  c.hold('9,9#b'); c.addMesh('9,9#b', behind.P, behind.I, ID); c.addMesh('9,9#b:gate:0', gate.P, gate.I, ID);
  c.cover.add('9,9#b', [{ c: [10, 0, 0], r: 1, h: 2 }]);
  late.add('9,9#b', old.P, old.I, ID, { body: { pos: [0, 0.5, 0] } });
  c.removeBucket('3,4');
  c.unhold('3,4#b');
  assert.equal(hitAt(0), Infinity, 'the old view gone');
  c.wake('9,9#b', '9,9');
  assert.ok(Number.isFinite(hitAt(10)) && Number.isFinite(hitAt(20)), 'the new view and its gate answer');
  assert.ok(c._buckets.has('9,9') && c._buckets.has('9,9:gate:0') && !c._held.size, 'under the pixel\'s own keys');
  assert.equal(c.cover.size(), 1, 'its cover in');
  assert.ok(late.withheld('9,9') && !late.withheld('9,9#b'), 'its withheld parts under its own key');
  assert.equal(c.holds('9,9#b'), false);
});

test('IC-SWAP-BEHIND THE SWAP - a rebuild of a standing pixel takes its carry now and leaves its view standing; the build lays its own under the behind key; the publish takes the old view down (its carry not again), wakes the new one\'s under the pixel\'s own key, moves its staged doors in and publishes it - one step: before it the old view, after it the new, never neither; a failed build lets its own go and the old stands; one marked again under way built once more; the switch off tears down as it was (mutants: torn down at the mark; carried twice; the doors live while it builds; the wake skipped; the old view left; again forgotten; the switch unread)', async () => {
  const { createSwapBehind, behindKeyOf, swapBehindOff } = await import('../../src/scenes/swapBehind.js');
  const { Collider } = await import('../../src/player/collider.js');
  const log = [];
  const built = new Map(), queue = [], doors = [{ pixelKey: '5,5', door: 'old' }];
  const collider = new Collider(() => -Infinity);
  let off = false, doorGen = 0;
  const destroyPixel = (px, py, o = {}) => {
    const key = `${px},${py}`;
    log.push(`destroy ${key} ${o.carryOnly ? 'carry' : o.carried ? 'carried' : o.collectLoose === false ? 'rebuild' : 'unload'}`);
    if (o.carryOnly) return;
    collider.removeBucket(key);
    for (let i = doors.length - 1; i >= 0; i--) if (doors[i].pixelKey === key) doors.splice(i, 1);
    built.delete(key);
  };
  const host = { built, destroyPixel, collider, buildingDoors: doors, doorsMoved: () => { doorGen++; }, queue, nearestFirst: () => () => 0,
    state: { current: { x: 5, y: 5 } }, walkMode: () => true, playerSpawned: () => true, seasonHold: (k) => log.push(`hold ${k}`), off: () => off };
  const swap = createSwapBehind(host);
  const tri = Float32Array.from([0, 0, 0, 1, 0, 0, 0, 0, 1]), ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  built.set('5,5', { v: 'old' });
  collider.addMesh('5,5', tri, [0, 1, 2], ID);
  // the mark: the carry alone, the view standing, owed a build behind
  swap.rebuild([{ px: 5, py: 5 }]);
  assert.deepEqual(log, ['destroy 5,5 carry'], 'its carry taken, nothing torn down, no hold (it stands)');
  assert.equal(built.get('5,5').v, 'old');
  assert.deepEqual(queue, [{ px: 5, py: 5 }]);
  assert.ok(swap.owes('5,5'));
  // the build: its own under the behind key, held; its doors staged
  const rkey = swap.keyFor(5, 5);
  assert.equal(rkey, behindKeyOf('5,5'));
  assert.notEqual(rkey, '5,5', 'the two buffers\' keys never meet');
  collider.addMesh(rkey, tri, [0, 1, 2], ID);
  const made = { doors: [{ pixelKey: rkey, door: 'new' }] };
  assert.equal(doors.length, 1, 'its doors never the world\'s while it builds');
  assert.ok(collider._buckets.has('5,5') && !collider._buckets.has(rkey), 'the old view\'s bucket stands, the new one held');
  // the publish: one step
  const entry = { v: 'new', cityGates: [{ bucketKey: `${rkey}:gate:0` }], placeHold: { rekey: (k) => log.push(`rekey ${k}`) } };
  swap.publish(5, 5, rkey, made, entry);
  assert.deepEqual(log, ['destroy 5,5 carry', 'destroy 5,5 carried', 'rekey 5,5'], 'the old view down once, its carry not again; then its place hold the pixel\'s');
  assert.equal(built.get('5,5'), entry, 'the new view published');
  assert.ok(collider._buckets.has('5,5') && !collider._held.size, 'its bucket under the pixel\'s own key');
  assert.equal(entry.cityGates[0].bucketKey, '5,5:gate:0');
  assert.deepEqual(doors.map((d) => [d.pixelKey, d.door]), [['5,5', 'new']], 'its doors the world\'s, the old view\'s gone');
  assert.equal(doorGen, 1);
  assert.equal(swap.owes('5,5'), false);
  // never neither: the pixel stood through it all (the publish is one call - no frame inside it)
  // a build that fails: its own let go, the old view standing
  log.length = 0;
  swap.mark(5, 5);
  const r2 = swap.keyFor(5, 5);
  collider.addMesh(r2, tri, [0, 1, 2], ID);
  assert.equal(swap.failed(5, 5), r2, 'the key its ledger frees');
  assert.ok(!collider._held.size && built.get('5,5') === entry && !swap.owes('5,5'), 'nothing of it left; the view stands');
  assert.equal(swap.failed(5, 5), null, 'a build as ever frees its own key');
  // marked again while it builds: built once more after the publish, from the state as it is then
  queue.length = 0;
  swap.mark(5, 5);
  const r3 = swap.keyFor(5, 5);
  swap.mark(5, 5);
  swap.publish(5, 5, r3, {}, { v: 'third' });
  assert.ok(swap.owes('5,5') && queue.some((q) => q.px === 5 && q.py === 5), 'owed again and queued');
  // a build of a pixel owed nothing: its own key, published as ever
  assert.equal(swap.keyFor(7, 7), '7,7');
  swap.publish(7, 7, '7,7', {}, { v: 'plain' });
  assert.equal(built.get('7,7').v, 'plain');
  // the switch off: torn down at once, the hold armed under the player, built as it was
  off = true;
  log.length = 0;
  built.set('6,6', { v: 'x' });
  host.state.current = { x: 6, y: 6 };
  swap.rebuild([{ px: 6, py: 6 }]);
  assert.deepEqual(log, ['hold 6,6', 'destroy 6,6 rebuild'], 'the hold armed BEFORE the ground goes');
  // switched on again: a pixel under the player that stands builds behind it - nothing held
  off = false;
  log.length = 0;
  built.set('6,6', { v: 'x' });
  swap.rebuild([{ px: 6, py: 6 }]);
  assert.deepEqual(log, ['destroy 6,6 carry'], 'behind its view: no hold');
  assert.equal(swap.stands('6,6'), true);
  off = true;
  assert.equal(swap.stands('6,6'), false, 'the switch off: nothing stands to build behind');
  assert.equal(swapBehindOff('?swapbehind=off'), true);
  assert.equal(swapBehindOff('?world&x=1'), false);
});

test('IC-SWAP-BEHIND THE PLACE HOLD - a view built behind holds what it asks for under its own key, and is its pixel\'s place from the swap: the old view\'s keep (its rebuild\'s old layout) settled by it, and its own keep the pixel\'s one when it goes (scenes/placeHolds.js rekey)', async () => {
  const { createPlaceHolds } = await import('../../src/scenes/placeHolds.js');
  const freed = [];
  const holds = createPlaceHolds({ free: { mesh: () => true, tex: (k) => freed.push(k), tile: () => {} }, kept: { pixel: 8 } });
  const old = holds.place('pixel', '5,5');
  old.hold('tex', 'old-wall'); old.hold('tex', 'shared');
  const behind = holds.place('pixel', '5,5#b');
  behind.hold('tex', 'new-wall'); behind.hold('tex', 'shared');
  old.release();   // the swap's teardown: the old view kept
  assert.deepEqual(freed, [], 'kept a while');
  behind.rekey('5,5');
  behind.settle();   // the new view stands: the old view's keep goes, with what it alone held
  assert.deepEqual(freed, ['old-wall'], 'the rebuild\'s old layout let go');
  behind.release();
  holds.place('pixel', '5,5').settle();   // the pixel's next visit settles that keep - one keep a pixel
  assert.deepEqual(freed.sort(), ['new-wall', 'old-wall', 'shared']);
});

test('IC-SWAP-BEHIND THE HOSTS - every rebuild of a standing pixel goes through the swap (the roads, the late regions, the breach\'s clearing, the season, a layout\'s change, Arena\'s places, the capitals and their slices near and far, the roads past the Bay, the build\'s own roadless retry); buildPixel builds a pixel owed one behind its view; destroyPixel takes a rebuild\'s carry first or alone and not again; the build lays its own under its key and reads its pixel\'s identity under the pixel\'s; it publishes through the swap; a failed build behind frees its own (mutants: a sweep tearing down; the owed pixel never built; the build under the pixel\'s key)', () => {
  const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
  const w = read('src/scenes/world.js'), pb = read('src/scenes/pixelBuild.js'), sw = read('src/scenes/tamrielSweepsHost.js');
  assert.equal((w.match(/swap\.rebuild\(again\);/g) ?? []).length, 4, 'the roads, the late regions (two), the breach\'s clearing');
  assert.match(w, /swap\.rebuild\(keys\.map\(\(key\) => \{ const \[px, py\] = key\.split\(','\)\.map\(Number\); return \{ px, py \}; \}\)\);/, 'the season');
  assert.match(w, /swap\.mark\(px, py\);   \/\/ IC-SWAP-BEHIND: built again behind its view\n\s+queue\.push\(\{ px, py \}\);/, 'a layout\'s change');
  assert.match(w, /if \(built\.has\(key\) && !swap\.owes\(key\)\) return built\.get\(key\);/);
  assert.match(w, /releaseFailedBuild\(swap\.failed\(px, py\) \?\? key\)/);
  assert.match(w, /function destroyPixel\(px, py, \{ collectLoose = true, carried = false, carryOnly = false \} = \{\}\) \{\n[^\n]*\n[^\n]*\n\s+if \(!p\) return;[\s\S]*?if \(!collectLoose && !carried && \(p\.wodSpawners \|\| p\.privateersHold\)\) carryWodSite\(p, key, \{ hold: p\.privateersHold\?\.state \?\? null \}\);[^\n]*\n\s+if \(carryOnly\) return;/, 'the carry the build behind reads before it publishes, first or alone');
  assert.equal((sw.match(/swap\.rebuild\(again\);/g) ?? []).length, 3, 'Arena\'s places, the capitals, the roads past the Bay');
  assert.match(sw, /swap\.rebuild\(far\);\n\s+swap\.rebuild\(near, \{ front: true \}\);/, 'the city\'s slices near and far');
  assert.doesNotMatch(sw, /destroyPixel\(k\.px, k\.py/, 'no sweep tears down itself');
  assert.match(pb, /const pkey = `\$\{px\},\$\{py\}`, key = swap\.keyFor\(px, py\), pipeline = holdPixel\(key\),/);
  assert.match(pb, /swap\.publish\(px, py, key, made, \{/);
  assert.match(pb, /\(key === pkey \? buildingDoors : \(made\.doors \?\?= \[\]\)\)\.push\(\{/);
  assert.match(pb, /swap\.mark\(px, py\);/);
  assert.match(pb, /if \(key === pkey && isEnhanced\(\) && !midRingDisabled\(\)\) stampPixelFade\(terrain, px, py,/, 'a view swapped in for one that stood never eases in from the ring\'s tint');
  const build = pb.slice(pb.indexOf('async function buildPixelNow('), pb.indexOf('async function reskinPixelNow('));
  assert.ok(build.length > 10000, 'the build\'s own body');
  assert.doesNotMatch(build, /built\.set\(key,/, 'nothing published past the swap');
  assert.doesNotMatch(build, /built\.(get|has)\(key\)/, 'the identity read under the pixel\'s own key');
  // the pixel's own key wherever the pixel is named after the publish - its re-skin, its restride, its ground's riders
  assert.match(build, /_reskin\.mark\(pkey\);/);
  assert.match(build, /host\.restridePending\.set\(pkey, entry\);/);
  assert.match(build, /host\.rideGround\?\.\(t, pkey, moved, key !== pkey\);/, 'the ground\'s riders, and whether the view was swapped in from behind');
  // the player on the view swapped out rides the ground's move unheld, as the held one rides a pixel built under them
  assert.match(w, /rideGround = \(t, key, moved, behind = false\) => \{[^\n]*\n[^\n]*\n\s+if \(\(_seasonHoldKey === key \|\| \(behind && key === `\$\{state\.current\.x\},\$\{state\.current\.y\}`\)\) && walkMode && playerSpawned && player\.grounded\) player\.pos\[1\] \+= moved\(player\.pos\[0\], player\.pos\[2\]\);/);
  // the kill switch, read once where the swap is made; the city's slices: one owed a build behind is left to it, and a
  // view swapped in walks the sweep (the set's size unmoved)
  assert.match(sw, /const swapOff = swapBehindOff\(\);/);
  assert.match(sw, /    off: \(\) => swapOff,\n/);
  assert.match(sw, /if \(at === _lod\.at && host\.built\.size === _lod\.size && swap\.swaps === _lod\.swaps\) return;/);
  assert.match(sw, /if \(!p\.capitalLod \|\| swap\.owes\(k\)\) continue;/);
});
