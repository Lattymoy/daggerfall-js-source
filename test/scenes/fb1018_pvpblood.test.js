// FIELD BUGS 2026-10-18 PVP-BLOOD (bible/01-Overview/bugs/Field-Bugs-2026-10-18.md, found reading Anon-e-moose's
// "Gradual FPS loss then crash" and left in its first pass). A duel's blow and the open zone's both splashed into the
// street's pool (`hitEffects`), which only the street's frame ticks and draws, and whose marks are the street's ring on
// the street's collider; a peer's blow already took the pool I stand in (`modes.liveHitEffects`, PEERFX2), and these
// take it too. AUDIT FB1018 L3-5 (bible/01-Overview/audits/Audit-Field-Bugs-2026-10-18.md): neither could bleed off the
// street - a duel is outdoors only, and in the zone's dungeons every peer was refused (wildFair read a dungeon-frame pose
// as the map's corner pixel); fixed, the zone's halls fight and their blood is the dungeon's pool's. Source pins:
// bootWorld is not run in Node.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { worldCoordToMapPixel } from '../../src/world/streamingWorld.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const LIVE = '(modes?.liveHitEffects?.() ?? hitEffects).showBloodSplash(';
const BARE = /(?<![\w.)])hitEffects\??\.showBloodSplash\(/g;   // AUDIT FB1018 L3-6: the optional call too
/** The body of the arrow `head` opens in world.js, to the first line that closes it at its own indent. */
const body = (src, head) => {
  const at = src.indexOf(head);
  assert.ok(at > 0, `${head} is in world.js`);
  const end = src.indexOf('\n  };\n', at);
  assert.ok(end > at, `${head} closes`);
  return src.slice(at, end);
};

test('PVP-BLOOD THE POOL I STAND IN: a duel\'s blow and the open zone\'s splash through the live pool (the room\'s indoors, the dungeon\'s in a dungeon, the street\'s outside), as a peer\'s blow does - never into the street\'s pool from wherever I stand', () => {
  const src = rd('src/scenes/world.js');
  for (const head of ['const duelHpIn = (g) => {', 'const wildHpIn = (g) => {']) {
    const b = body(src, head);
    assert.ok(b.includes(LIVE), `${head} splashes into the live pool`);
    assert.doesNotMatch(b, BARE, `${head} splashes into the street's pool`);
  }
  // the seam both take, and the peer's blows beside them
  const modes = rd('src/scenes/worldModes.js');
  assert.match(modes, /liveHitEffects\(\) \{ return mode === 'dungeon' \? \(dungeonCtx\?\.hitEffects \?\? null\) : mode === 'interior' \? interiorHitEffects : null; \},/);
  assert.equal(src.split('(modes?.liveHitEffects?.() ?? hitEffects).showBloodSplash(').length - 1, 4, 'the peer\'s blow and hurt, the duel\'s and the zone\'s');
});

test('PVP-BLOOD THE STREET\'S OWN: the only splashes world.js sends straight to the street\'s pool are on paths that run in the street alone - a road traveller struck down (livingStrikeRoad, refused off the exterior) and a horse\'s trample (rrRiding)', () => {
  const src = rd('src/scenes/world.js');
  const at = [...src.matchAll(BARE)].map((m) => m.index);
  // PIN MOVED (FIELD BUGS 2026-10-25i ROAD-SPARE): the road's strike, its splash with it, is scenes/livingWorld/roadStrike.js -
  // its one splash past the host's `open()`, which is the exterior alone, into the pool the host hands it, the street's
  assert.equal(at.length, 1, 'a new splash straight into the street\'s pool - is its path the street\'s alone?');
  const road = rd('src/scenes/livingWorld/roadStrike.js');
  assert.equal([...road.matchAll(BARE)].length, 1, 'the road\'s one splash');
  assert.ok(road.indexOf('if (!layer || !open()) return false;') > 0 && road.indexOf('if (!layer || !open()) return false;') < road.search(BARE), 'refused before it, off the open world');
  assert.match(src, /const livingStrikeRoad = createRoadStrike\(\{ roads: \(\) => livingRoads, open: \(\) => livingWorldOn\(\) && _mode\(\) === 'exterior', collider, cityGuards, hitEffects, playerEntity \}\);/);
  assert.ok(src.lastIndexOf('const rrRiding = createRrRidingContacts({', at[0]) > 0);
  assert.match(src.slice(at[0] - 40, at[0]), /splashBlood: \(pos, fwd\) => $/);
  // AUDIT FB1018 L3-6: and the trample runs in the street alone - its one door is called in the exterior arm of the frame
  assert.equal(src.split('rrRiding.contacts()').length - 1, 1, 'the trample has one door');
  const calls = [...src.matchAll(/rrRidingContacts\(\);/g)].map((m) => m.index);
  assert.equal(calls.length, 1);
  assert.ok(calls[0] > src.indexOf('// is the EXTERIOR arm of the cadence loop'), 'the trample is asked in the street\'s frame');
});

test('PVP-BLOOD THE ZONE\'S HALLS (AUDIT FB1018 L3-5): in a dungeon a room\'s peer is fair by the place, never by its pose - the pose is the dungeon\'s own frame, which the map reads as its corner pixel, so every peer in the zone\'s halls was refused and no blow landed there', () => {
  const src = rd('src/scenes/world.js');
  const fair = body(src, 'const wildFair = (peerId) => {');
  assert.match(fair, /if \(!peerId \|\| !wildCan\(\)\) return false;/, 'the place is the zone first (wildCan: wildHere, the door\'s pixel)');
  assert.match(fair, /return modes\?\.mode === 'dungeon' \|\| wildAtWire\(duelWorldOf\(peerId\)\);/);
  assert.match(src, /const nativeFrame = overworld \|\| !!privateInteriorOf\(key\);/, 'the frames the pose is sent in: a dungeon\'s is its own');
  // the cause, executed: a dungeon's own coordinates (blocks at 51.2 m, a few either side of its centre) are the map's corner
  for (const [x, z] of [[0, 0], [307.2, 307.2], [-307.2, -307.2], [100, -300]]) assert.deepEqual({ ...worldCoordToMapPixel(x, z), x: Math.abs(worldCoordToMapPixel(x, z).x) }, { x: 0, y: 499 });
});
