import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createComeSailAwayAboard } from '../src/scenes/comeSailAwayAboard.js';
const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
// Execute the host's actual near-player marker loop with its view dependencies.
// PIN MOVED (THE WROTHGARIAN ZONE): the zone's own loops over the drawable peers stand above this one now, so the
// loop is found by the block it heads - the last such loop above the region's travellers (TV3)
const end = world.indexOf('    // TV3: THE REGION');
const begin = world.lastIndexOf('    for (const d of online?.drawable?.() ?? []) {', end);
assert.ok(begin > 0 && end > begin);
assert.ok(world.slice(begin, end).includes('marks.push({ key: `peer:${d.id}`'), 'the slice is the near-player marker loop');
const loop = world.slice(begin, end);
function markers(raw, drawn, hidden = new Set()) {
  const _peerMapPoses = new Map();
  const drawable = drawn;
  const start = world.indexOf('    _peerMapPoses.clear();');
  const stop = world.indexOf('    const visiblePeers =', start);
  // eslint-disable-next-line no-new-func
  new Function('_peerMapPoses', 'drawable', world.slice(start, stop))(_peerMapPoses, drawable);
  // eslint-disable-next-line no-new-func
  return new Function('online', '_peerMapPoses', '_hiddenPeers', `
    const marks = [], near = new Set(), sharing = new Map(), _veils = new Map();
    const onlineToScene = p => [p.x, p.y, p.z];
    const social = { isPartyPeer: () => true, isFriendPeer: () => false };
    const travellerKin = () => null, myGt = null;   // OW-KIN (FIELD BUGS 2026-10-04e): who each is to me - none here
    const player = { pos: [0, 0, 0] }, NAME_RANGE = 60, TV_PEER_HEAD_M = 2;
    const peerRiders = { heightOf: () => 0 }, peerBodies = peerRiders, peerWalkers = peerRiders;
    const isShipMark = () => true, tvBadgeOf = () => null;
    const _wildStrangerIds = new Set(), WILD_TEXT = { stranger: 'Stranger' }, wildHidesPlayer = () => false;   // WILD1/WILD3: out of the zone - no stranger, no one hidden
    ${loop}
    return marks;
  `)({ drawable: () => raw }, _peerMapPoses, hidden);
}
test('Overworld marker follows rendered boat passenger after joining, not old network pose', () => {
  const aboard = createComeSailAwayAboard({ peers: {}, geometry: () => null });
  aboard.applyRider('passenger', ['owner', 0, 2, 3, 4], 0);
  const raw = [{ id: 'passenger', name: 'Passenger', shown: { x: -900, y: 0, z: -800 } }];
  for (const x of [100, 200]) {
    const drawn = aboard.glue(raw, { poseOf: () => ({ position: [x, 10, 300], rotation: [0, 0, 0, 1] }), toWire: p => p, dt: 1 / 60 });
    assert.deepEqual(markers(raw, drawn)[0].at, [x + 2, 15, 304]);
  }
  assert.deepEqual(raw[0].shown, { x: -900, y: 0, z: -800 }, 'network state is unchanged');
});
test('Unresolved boats and disembarked players retain their ordinary position', () => {
  const aboard = createComeSailAwayAboard({ peers: {}, geometry: () => null });
  const raw = [{ id: 'p', shown: { x: 10, y: 20, z: 30 } }];
  aboard.applyRider('p', ['owner', 0, 2, 3, 4], 0);
  const draw = () => aboard.glue(raw, { poseOf: () => null, toWire: p => p, dt: 0 });
  assert.deepEqual(markers(raw, draw())[0].at, [10, 22, 30]);
  aboard.applyRider('p', null, 1);
  assert.deepEqual(markers(raw, draw())[0].at, [10, 22, 30]);
  assert.deepEqual(markers(raw, draw(), new Set(['p'])), []);
  assert.deepEqual(markers([], draw()), [], 'departed peers leave no stale map marker');
});
