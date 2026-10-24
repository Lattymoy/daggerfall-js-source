// FIELD BUGS 2026-09-29 (the sea) #1 - "The player sprite doesnt seem mounted to the deck when the ship moves around"
// (the Discord, through Mac). Online, only a passenger said where they stood on a boat; the player at their own helm
// was drawn from their world pose - a send behind - while their boat was led ahead by its way, so they trailed the
// wheel. A passenger was stood in the boat's root frame while its owner's deck rocked under them. And a body carried
// by a deck read as walking: the moving bit and the pace were read off the world, where the deck's way is a stride.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { raycastColliders } from '../../../src/world/prefabColliders.js';
import { quatEuler } from '../../../src/world/unityAnimator.js';
import { createComeSailAwayAboard, deckPose, helmWord, localOf, worldOf } from '../../../src/scenes/comeSailAway/comeSailAwayAboard.js';
import { PeerBodies } from '../../../src/net/peer/peerBodies.js';
import { readyPool } from '../../navalSea.mjs';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const yawQ = (deg) => [0, Math.sin((deg * Math.PI) / 360), 0, Math.cos((deg * Math.PI) / 360)];
const nearV = (a, b, eps, msg) => assert.ok(a.every((v, k) => Math.abs(v - b[k]) <= eps), `${msg}: [${a.map((v) => v.toFixed(4))}] vs [${b.map((v) => v.toFixed(4))}]`);
const rootOf = (boat) => ({ position: boat.GameObject.position, rotation: boat.GameObject.rotation });
const apply = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

async function twoBoats() {
  const pool = await readyPool();
  pool.destroyAll();
  const mine = pool.spawnNow(Object.assign(new Boat(2, 0), { uid: 1 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const copy = pool.spawnNow(Object.assign(new Boat(2, 0), { uid: 2 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  mine.GameObject.position = [40, 0, -12]; mine.GameObject.rotation = yawQ(25);
  copy.GameObject.position = [-300, 0, 90]; copy.GameObject.rotation = yawQ(-70);
  return { pool, mine, copy, geometry: (c) => (c.m_Mesh?.mesh ? pool.models.geometry(c.m_Mesh.mesh) : null) };
}

test('FIELD BUGS 2026-09-29 (the sea) #1: THE HELMSMAN AT THE WHEEL - my place at my own helm is said as a passenger\'s is, the helm at rest in her root\'s frame (the feet half a height under the pinned transform), the same word whatever her bob; every reader stands me at the wheel of the boat they draw (mutants: the bob not undone, the half height, the helm word unsaid)', async () => {
  const { pool, mine, copy } = await twoBoats();
  const words = new Set();
  for (const [pitch, roll] of [[0, 0], [3, -2], [-2.5, 4], [1, 1]]) {
    mine.MeshObject.localRotation = quatEuler(pitch, 0, roll);
    words.add(JSON.stringify(helmWord('bo', 0, mine, 1.8)));
  }
  assert.equal(words.size, 1, `one word whatever her bob (${[...words].join(' | ')})`);
  const word = JSON.parse([...words][0]);
  mine.MeshObject.localRotation = [0, 0, 0, 1];
  const at = mine.DrivePosition.position;
  nearV(word.slice(2), localOf(rootOf(mine), [at[0], at[1] - 0.9, at[2]]), 0.006, 'the helm at rest, the feet half a height under it');
  // a reader: my boat drawn at another pose (their copy), the glue stands me there
  const aboard = createComeSailAwayAboard({ peers: { placeOf: () => null, shown: () => [] }, geometry: () => null, selfId: () => 'cy' });
  assert.equal(aboard.applyRider('bo', word, 0), true);
  const [drawn] = aboard.glue([{ id: 'bo', shown: { x: 0, y: 0, z: 0, yaw: 0 } }], { poseOf: (o, i) => (o === 'bo' && i === 0 ? deckPose(copy) : null), toWire: (p) => p, dt: 1 });
  const wheel = copy.DrivePosition.position;
  nearV([drawn.shown.x, drawn.shown.y, drawn.shown.z], [wheel[0], wheel[1] - 0.9, wheel[2]], 0.01, 'at the wheel of the boat drawn here');
  assert.equal(drawn.shown.deckKey, 'bo:0');
  // the world says it: my own helm, when aboard nothing else - PIN MOVED (DECK-POSE): one place for the foes word and the
  // pose (world.js csaDeckWord, test/net/peer/deckpose.test.js), so the expression is the shared one's
  assert.match(WORLD, /const csaDeckWord = \(\) => \(csaOn\(\) \? \(csaAboard\.word\(player\.pos\) \?\? csaHelmWord\(\) \?\? naval\?\.deckWord\?\.\(player\.pos\) \?\? null\) : null\);/);
  assert.match(WORLD, /const w = csaDeckWord\(\);/);
  assert.match(WORLD, /return slot < 0 \? null : csaHelmWordOf\(id, slot, boat, player\.height\);/);
  pool.remove(mine); pool.remove(copy);
});

test('FIELD BUGS 2026-09-29 (the sea) #1: A PASSENGER RIDES THE DECK THAT ROCKS - on her owner\'s screen a place said at rest is stood where her bob carries it, the deck point under the passenger\'s feet as the rocked hull holds it (the root\'s frame alone left them 0.3 m and more off the deck at her bow); a boat at rest - a peer\'s copy - is her root\'s own frame (mutants: the bob unapplied, the place about the root not her MeshObject)', async () => {
  const { pool, mine, geometry } = await twoBoats();
  const root = rootOf(mine);
  const probe = worldOf(root, [0, 30, 12]);
  const deckAt = raycastColliders(mine.GameObject, probe, [0, -1, 0], 60, { triggers: false, geometry });
  assert.ok(deckAt, 'her deck near the bow');
  const l = localOf(root, deckAt.point);
  assert.deepEqual(deckPose(mine), root, 'at rest: the root\'s own frame');
  mine.MeshObject.localRotation = quatEuler(3, 0, -2);   // Come Sail Away's bob
  const stood = worldOf(deckPose(mine), l);
  const m = mine.MeshObject.localPosition;
  const held = apply(mine.MeshObject.worldMatrix(), [l[0] - m[0], l[1] - m[1], l[2] - m[2]]);
  nearV(stood, held, 1e-6, 'the deck point as the rocked hull holds it');
  const rootOnly = worldOf(root, l);
  assert.ok(Math.hypot(stood[0] - rootOnly[0], stood[1] - rootOnly[1], stood[2] - rootOnly[2]) > 0.3, 'the root\'s frame alone: off her deck');
  mine.MeshObject.localRotation = [0, 0, 0, 1];
  pool.remove(mine);
});

test('FIELD BUGS 2026-09-29 (the sea) #1: A BODY ON A MOVING DECK STANDS - a peer\'s pace is read off their place on the deck (the glue\'s `deck`), never the deck\'s way: carried at 6 m/s standing reads no pace, walking the deck 1.5 m/s reads 1.5; a deck changed starts afresh (mutants: the pace off the world feet, the key unasked)', () => {
  const layer = new PeerBodies({ renderer: {}, enabled: () => false });
  const b = { state: 'building', feet: null, speed: 0, yaw: 0, cam: null };
  const peer = (x, deck, key = 'bo:0') => ({ shown: { x, y: 0, z: 0, yaw: 0, deck, deckKey: key }, look: {} });
  const toScene = (s) => [s.x, s.y, s.z];
  const dt = 1 / 60;
  for (let i = 0; i < 120; i++) layer._place(b, peer(i * 6 * dt, [0, 1, 2]), toScene, dt, null);
  assert.ok(b.speed < 0.01, `carried standing: no pace (${b.speed})`);
  for (let i = 0; i < 240; i++) layer._place(b, peer(i * 7.5 * dt, [i * 1.5 * dt, 1, 2]), toScene, dt, null);
  assert.ok(Math.abs(b.speed - 1.5) < 0.02, `walking her deck: the deck's stride (${b.speed})`);
  layer._place(b, peer(0, [239 * 1.5 * dt + 0.02, 1, 2], 'cy:1'), toScene, dt, null);
  assert.equal(b.speed, 0, 'another deck: afresh - its place is in another frame, however near the number');
  const walkers = readFileSync(new URL('../../../src/net/peer/peerRiders.js', import.meta.url), 'utf8');
  assert.match(walkers, /const on = pose\.deckKey \?\? null, at = on \? pose\.deck : feet;\n\s+r\.pace = stepPeerPace\(r\.pace, r\.paceKey === on \? r\.paceFeet : null, at, dt\);/, 'the walkers\' lanterns by the same law');
});

test('FIELD BUGS 2026-09-29 (the sea) #1: STANDING AT THE WHEEL IS STANDING - my moving bit is measured on what carries me (a deck aboard, or the boat I sail) at the body\'s centre, the transform the helm pins: a helmsman under way and turning sends no walk; walking the deck does; ashore it is the world\'s (mutants: the world\'s position read, the carrier unasked)', async () => {
  const { pool, mine } = await twoBoats();
  const body = WORLD.slice(WORLD.indexOf('    const carrier = csaOn() ?'), WORLD.indexOf('    if (movedThisFrame) {'));
  const keep = /\n\s+_onlineLast = \[here\[0\], here\[1\], here\[2\]\]; _onlineLastOn = carrier;/;
  assert.match(WORLD, keep, 'the last place and its carrier kept');
  // eslint-disable-next-line no-new-func
  const step = new Function('s', `const { csaOn, csaAboard, csaRuntime, csaLocalOf, csaDeckPose, player, naval } = s; let { _onlineLast, _onlineLastOn } = s;\n${body}\ns._onlineLast = [here[0], here[1], here[2]]; s._onlineLastOn = carrier; return movedThisFrame;`);
  const player = { pos: [0, 0, 0], height: 1.8 };
  const s = { csaOn: () => true, csaAboard: { aboard: null }, csaRuntime: { isSailing: () => true, state: { CurrentBoat: mine } }, csaLocalOf: localOf, csaDeckPose: deckPose, player, naval: null, _onlineLast: null, _onlineLastOn: null };
  const pin = () => { const d = mine.DrivePosition.position; player.pos = [d[0], d[1] - 0.9, d[2]]; };
  let walked = 0;
  for (let f = 0; f < 90; f++) {
    const p = mine.GameObject.position;
    mine.GameObject.position = [p[0] + 0.12, p[1], p[2] + 0.05];
    mine.GameObject.rotation = yawQ(25 + f * 0.4);
    mine.MeshObject.localRotation = quatEuler(2 * Math.sin(f / 9), 0, 3 * Math.sin(f / 13));
    pin();
    if (step(s) && f > 0) walked++;
  }
  assert.equal(walked, 0, 'at the wheel under way and turning: no frame moved');
  s.csaRuntime = { isSailing: () => false, state: { CurrentBoat: null } };
  s.csaAboard = { aboard: { boat: mine } };
  step(s);
  player.pos = [player.pos[0] + 0.3, player.pos[1], player.pos[2]];
  assert.equal(step(s), true, 'walking her deck: moved');
  s.csaAboard = { aboard: null };
  step(s);
  assert.equal(step(s), false, 'ashore, standing: no');
  pool.remove(mine);
});

test('AUDIT CROWD-WIDE A2 the shipmates: those aboard one of my boats; and, aboard another\'s boat, its owner and the others aboard it - never one aboard a third (the crowd\'s count never cuts them: net/gate/gateCrowd.js crowdKept) (mutants: my boat\'s riders dropped; the owner dropped; the boat\'s riders unread; a third boat\'s rider kept)', () => {
  const theirs = {};
  const aboard = createComeSailAwayAboard({ peers: { placeOf: (b) => (b === theirs ? { owner: 'olaf', slot: 0 } : null), shown: () => [] }, geometry: () => null, selfId: () => 'cy' });
  assert.equal(aboard.applyRider('bo', ['cy', 1, 0, 0, 0], 0), true);
  assert.equal(aboard.applyRider('sven', ['olaf', 0, 0, 0, 0], 0), true);
  assert.equal(aboard.applyRider('eirik', ['harald', 0, 0, 0, 0], 0), true);
  assert.deepEqual(aboard.shipmates(), ['bo'], 'ashore: those aboard my boat');
  assert.equal(aboard.board(theirs), true);
  assert.deepEqual(aboard.shipmates().sort(), ['bo', 'olaf', 'sven'], 'aboard Olaf\'s: Olaf and the one aboard with me - and mine still');
});
