// LAIR-WALK (FIELD BUGS 2026-10-19; bible/01-Overview/bugs/Field-Bugs-2026-10-19.md): A REVENANT AT HOME STANDS WHERE A
// WALK FROM THE WAY IN REACHES. LAIR-REACH took the lair's end off the border caps (SD-REACH's candidates - an interior
// block's enemy markers, out of the water); an interior marker could still stand in a pocket no walk reaches, which only a
// walk over the floor can tell. The dungeon bakes that floor already (ENHANCED AI 3b's navmesh - on by default, and always
// online): the lair waits for it (LAIR_WALK_WAIT_MS at most), floods it ONCE from where I came in (ai/nav/navmesh.js
// reachableFrom - the port's own query in the file's head, over the body's locate; AUDIT FB1019 B1: a path search per
// candidate walked the whole floor for each that failed, and six failing fell back to the very marker the walk refused),
// and stands its revenant at the farthest candidate on that floor (world/dungeon/dungeonEnd.js reachableEndOf), on a spot
// on it too (B3). With no navmesh, or none on the floor (every marker past a locked door or a drop), SD-REACH's end. The
// Rift keeps SD-REACH alone: it stands the same on every client, and a client's bake is anchored on its own feet.
// tools/mutants/lair_walk.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reachableFrom, REACH_LEVEL_M } from '../../../src/ai/nav/navmesh.js';
import { bakeNavFromCollider } from '../../../src/ai/nav/navBake.js';
import { reachableEndOf, dungeonEndOf, LAIR_WALK_WAIT_MS } from '../../../src/world/dungeon/dungeonEnd.js';

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A triangle soup (test/ai/nav/audit0928_nav.test.js's): a floor quad, and a room - floor, ceiling and four walls. */
function soup() {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const s = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  const room = (x0, x1, z0, z1, y, h = 3) => {
    quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]); quad([x0, y + h, z0], [x0, y + h, z1], [x1, y + h, z1], [x1, y + h, z0]);
    for (const [a, b] of [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]]) quad([a[0], y, a[1]], [b[0], y, b[1]], [b[0], y + h, b[1]], [a[0], y + h, a[1]]);
  };
  return { P, I, quad, room };
}
async function colliderOf(s) {
  const { Collider } = await import('../../../src/player/collider.js');
  const c = new Collider(() => -Infinity);
  c.addMesh('dungeon', new Float32Array(s.P), new Uint32Array(s.I), IDENTITY);
  return c;
}

test('LAIR-WALK the floor a walk reaches, on real bakes: from the way in, the far end of the hall it opens on - never a sealed room beside it, though the bake keeps that room (a marker anchors it); never a low sealed room stacked over the hall, whose floor never made the mesh, taken for the hall\'s under it (AUDIT FB1019 B2); a start on no floor answers no walk (mutants: no flood; any poly reaching; the level unread)', async () => {
  const s = soup();
  s.quad([0, 0, 0], [40, 0, 0], [40, 0, 10], [0, 0, 10]);   // the hall: the way in at one end, a marker at the other
  s.room(60, 70, 0, 10, 0);                                 // a sealed room: a marker in it, no way to it
  const IN = [2, 0, 5], FAR = [36, 0, 5], SEALED = [65, 0, 5];
  const bake = bakeNavFromCollider(await colliderOf(s), { anchor: IN, anchors: [FAR, SEALED] });
  const walk = reachableFrom(bake.chf, IN);
  assert.ok(walk, 'the way in stands on the floor');
  assert.deepEqual([walk(IN), walk(FAR), walk(SEALED)], [true, true, false], 'the hall\'s far end, never the sealed room');
  assert.equal(reachableFrom(bake.chf, null), null);
  assert.equal(reachableFrom(null, IN), null, 'no navmesh: no walk');
  // a sealed room 1.2 m high over the hall's far end: too low for the bake, its floor never made the mesh - and its
  // marker must not be located onto the hall under it (the auditor's stacked.mjs)
  const t = soup();
  t.room(0, 40, 0, 10, 0, 3);
  t.room(30, 38, 2, 8, 4, 1.2);
  const UP = [34, 4, 5];
  const low = bakeNavFromCollider(await colliderOf(t), { anchor: IN, anchors: [UP] });
  const w2 = reachableFrom(low.chf, IN);
  assert.deepEqual([w2([34, 0, 5]), w2(UP)], [true, false], 'the hall under it, never the room over it');
  assert.equal(REACH_LEVEL_M, 1);
});

test('LAIR-WALK the split hall (the auditor\'s tries.mjs): the farthest of the hall\'s own markers, though seven sealed rooms beyond hold farther ones - never the marker the walk refused (AUDIT FB1019 B1) (mutants: a cap on the walk; the refused marker as the end)', async () => {
  const s = soup();
  const N = 40;
  s.quad([0, 0, 0], [N, 0, 0], [N, 0, N], [0, 0, N]);
  for (let x = 3; x < N - 2; x += 4) for (let z = 3; z < N - 2; z += 4) s.room(x, x + 1, z, z + 1, 0, 3);
  const sealed = [];
  for (let k = 0; k < 7; k++) { const x0 = N + 10 + k * 12; s.room(x0, x0 + 8, 0, 8, 0); sealed.push({ x: x0 + 4, y: 0, z: 4 }); }
  const IN = [1, 0, 1];
  const hall = [{ x: N - 2, y: 0, z: N - 2 }, { x: N / 2, y: 0, z: 1.5 }];
  const marks = [...hall, ...sealed];
  const bake = bakeNavFromCollider(await colliderOf(s), { anchor: IN, anchors: marks.map((m) => [m.x, m.y, m.z]) });
  const walk = reachableFrom(bake.chf, IN);
  const end = reachableEndOf({ x: 0, z: 0 }, marks, (m) => walk([m.x, m.y, m.z]));
  assert.equal(end, hall[0], 'the hall\'s farthest');
  assert.ok(sealed.every((m) => !walk([m.x, m.y, m.z])), 'every sealed room refused');
});

test('LAIR-WALK the end a walk reaches: the farthest candidate the walk reaches, the farthest asked first, a tie keeping the list\'s order; none reaching, none; no walk, the marker law (dungeonEndOf) (mutants: the walk unread; the nearest first; a tie reordered)', () => {
  const from = { x: 0, z: 0 };
  const near = { x: 10, z: 0 }, mid = { x: 20, z: 0 }, tieA = { x: 0, z: 30 }, tieB = { x: 30, z: 0 }, sealed = { x: 50, z: 0 };
  const marks = [near, tieA, mid, sealed, tieB];
  const asked = [];
  const reaches = (m) => { asked.push(m); return m !== sealed; };
  assert.equal(reachableEndOf(from, marks, reaches), tieA, 'the sealed one passed by; of two as far, the first listed');
  assert.deepEqual(asked, [sealed, tieA], 'the farthest asked first, and no more than needed');
  assert.equal(reachableEndOf(from, marks, () => false), null, 'none reaches: none');
  assert.equal(reachableEndOf(from, marks, null), dungeonEndOf(from, marks), 'no walk: the marker law');
  assert.equal(reachableEndOf(from, marks), sealed);
  assert.equal(reachableEndOf(from, [{ x: NaN, z: 0 }, near], () => true), near, 'a placeless marker none');
  assert.equal(LAIR_WALK_WAIT_MS, 20000);
});

test('LAIR-WALK the host: the bake anchored where I came in and said landed or failed; the lair asked once that has happened - or at once with no bake coming, or past LAIR_WALK_WAIT_MS; its end the farthest on the walk\'s floor - SD-REACH\'s candidates, then every layout marker - else SD-REACH\'s; the spot it stands on on that floor, else the marker itself; the Rift\'s end never the walk\'s (mutants: the lair not waiting; no bound; never landed; no anchor; the walk unasked; the spot unasked; the Rift on a client\'s own walk)', () => {
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /enhancedNav\.requested = true;\n\s*enhancedNav\.anchor = \[playerFeet\[0\], playerFeet\[1\], playerFeet\[2\]\];/);
  assert.match(D, /\.catch\(\(e\) => console\.warn\('\[enhanced-ai\] navmesh bake failed - classic motor stands:', e\?\.message \?\? e\)\)\n\s*\.finally\(\(\) => \{ enhancedNav\.settled = true; \}\);/);
  const bakeAt = D.indexOf('enhancedNav.requested = true;'), askAt = D.indexOf('{ _lairAsked = true; standLairRevenant().catch(() => null); }');
  assert.ok(bakeAt > 0 && askAt > bakeAt, 'the lair asked after the bake is asked for, in the frame');
  assert.match(D, /if \(playerFeet && !_lairAsked && \(!enhancedNav\.requested \|\| enhancedNav\.settled \|\| Date\.now\(\) - \(_lairWaitFrom \?\?= Date\.now\(\)\) > LAIR_WALK_WAIT_MS\)\) \{ _lairAsked = true; standLairRevenant\(\)\.catch\(\(\) => null\); \}/);
  assert.equal(D.match(/standLairRevenant\(\)\.catch/g)?.length, 1, 'asked in one place');
  const lair = D.slice(D.indexOf('async function standLairRevenant() {'), D.indexOf('function standDungeonBand('));
  assert.match(lair, /const walk = enhancedNav\.chf \? reachableFrom\(enhancedNav\.chf, enhancedNav\.anchor\) : null;\n\s*const reaches = walk && \(\(m\) => walk\(floorLanding\(collider, \[m\.x, m\.y \+ 0\.2, m\.z\]\)\)\);\n\s*const far = \(reaches && dungeonEnd\(reaches\)\) \|\| dungeonEnd\(\);/);
  assert.match(lair, /const about = spotAbout\(\[far\.x, far\.y, far\.z\], 4\);\n\s*const sp = about && \(!reaches \|\| reaches\(about\)\) \? about : \{ x: far\.x, y: far\.y, z: far\.z \};/, 'its spot on the walk\'s floor, else the marker');
  assert.match(D, /function dungeonEnd\(reaches = null\) \{\n\s*const from = dungeon\.enterMarker \?\? dungeon\.startMarker \?\? null;\n\s*return reachableEndOf\(from, sdEndMarks\(_layoutEnemies, dungeon\.blocks, \(m\) => floorLanding\(collider, \[m\.x, m\.y \+ 0\.2, m\.z\]\)\[1\]\), reaches\) \?\? \(reaches \? reachableEndOf\(from, _layoutEnemies\.filter\(\(m\) => !m\.eliteCopy\), reaches\) : null\);/);
  const rift = D.slice(D.indexOf('function standSdEnd() {'), D.indexOf('const probe = sdProbeOf(collider);', D.indexOf('function standSdEnd() {')));   // SD-THROUGH (PIN MOVED): the end's one probe (scenes/superDungeon/sdEnd.js sdProbeOf)
  assert.match(rift, /const end = dungeonEnd\(\);/, 'the Rift: the same on every client, never one client\'s walk');
});
