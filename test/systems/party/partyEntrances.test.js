import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partyEntranceMembers } from '../../../src/systems/party/partyEntrances.js';
import { readPartyBodies } from '../../../src/ui/partyMapMarks.js';
import { paintPartyCarets } from '../../../src/ui/ink/inkMap.js';
import { createPartyEntranceHost } from '../../../src/scenes/partyEntranceHost.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { tinyRmb } from '../../wd3Fakes.mjs';
import { makeBuildingKey } from '../../../src/systems/talk/talkTopics.js';
import { RMB_SIDE } from '../../../src/world/locationLayout.js';

const house = { key: 'house', px: 1, py: 2, inside: 2, buildingKey: 131590, at: [10, 2, 30] };
const dungeon = { key: 'crypt', px: 1, py: 2, inside: 1, location: 'Crypt', at: [20, 3, 40] };
const member = (p) => ({ acct: 'a', name: 'Mate', online: true, peers: ['peer'], at: -1e9, p });

test('building identity uses full key and pixel, preserving idle entrances without guessed locations', () => {
  const m = member({ in: 2, px: 1, py: 2, bk: 131590 });
  const doors = [house, { ...house, key: 'wrong-pixel', px: 2 }, { ...house, key: 'wrong-key', buildingKey: 65535 }, dungeon];
  const result = partyEntranceMembers({ others: [m], doors });
  assert.equal(result.length, 1); assert.deepEqual(result[0].at, house.at);
  assert.equal(result[0].name, 'Mate · Entrance'); assert.equal(result[0].entrance, true);
  assert.deepEqual(partyEntranceMembers({ others: [m], doors: [] }), []);
});

test('dungeons match destination name and pixel; all real entrances aggregate companions', () => {
  const m = member({ in: 1, px: 1, py: 2, loc: 'Crypt' });
  const doors = [dungeon, { ...dungeon, key: 'back', at: [40, 3, 40] }, { ...dungeon, key: 'arena', location: 'Undercroft' }, house];
  const result = partyEntranceMembers({ others: [m, { ...m, acct: 'b', name: 'Second' }], doors });
  assert.equal(result.length, 2); assert.equal(result[0].name, 'Mate, Second · Entrance');
  assert.equal(result[0].playerName, 'Mate, Second'); assert.equal(result[0].place, 'Dungeon entrance · Crypt');
  assert.deepEqual(partyEntranceMembers({ others: [member({ ...m.p, loc: '' })], doors }), []);
});

test('returning outdoors, leaving, offline and concealed peers remove entrance marks', () => {
  const m = member({ in: 1, px: 1, py: 2, loc: 'Crypt' }), doors = [dungeon];
  for (const others of [[], [{ ...m, online: false }], [member({ ...m.p, in: 0 })]]) {
    assert.deepEqual(partyEntranceMembers({ others, doors }), []);
  }
  assert.deepEqual(partyEntranceMembers({ others: [m], doors, hidden: () => true }), []);
});

test('map data preserves entrance kind and paints a diamond at its projected point', () => {
  const marks = readPartyBodies(() => [{ acct: 'a', name: 'Mate · Entrance', feet: [10, 2, 30], entrance: true }]);
  assert.equal(marks[0].entrance, true);
  const path = [];
  const ctx = { beginPath() {}, closePath() {}, stroke() {}, fill() {}, strokeText() {}, fillText() {},
    moveTo(x, y) { path.push([x, y]); }, lineTo(x, y) { path.push([x, y]); } };
  paintPartyCarets(ctx, [{ ...marks[0], x: 50, y: 60 }], { fill: '#66e5a0', halo: '#000' });
  assert.equal(path.length, 4); assert.equal(path[0][0], 50); assert.equal(path[1][1], 60);
  assert.equal(path[2][0], 50); assert.equal(path[3][1], 60);
});

test('world adapter transforms actual door geometry, follows rebases and applies independent options', () => {
  setPref('partyVisibility', true); setPref('ketaPartyEntrances',true);setPref('ketaPartyEntranceMap',true);
  let offset = 100, generation = 1;
  const entry = { pixelKey: '1,2', door: { doorType: 2 } };
  const host = { doors: [entry], generation: () => generation, mode: () => 'exterior', hidden: new Set(),
    built: new Map(), locations: new Map(), dungeonTarget: () => ({ dfLocation: { name: 'Crypt' } }),
    shift: () => ({ centre: { x: 2, y: 3, z: 4 }, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, offset, 20, 30, 1] }),
    online: { status: 'open' }, social: { party: {}, others: () => [member({ in: 1, px: 1, py: 2, loc: 'Crypt' })] } };
  const tracker = createPartyEntranceHost(host);
  try {
    assert.deepEqual(tracker.world()[0].at, [102, 23, 34]);
    offset = 200; assert.deepEqual(tracker.map()[0].feet, [202, 23, 34]);
    setPref('ketaPartyEntrances',false);
    assert.deepEqual(tracker.world(), []); assert.equal(tracker.map().length, 1);
    setPref('ketaPartyEntrances',true);setPref('ketaPartyEntranceMap',false);
    assert.equal(tracker.world().length, 1); assert.deepEqual(tracker.map(), []);
    host.online.status = 'closed'; assert.deepEqual(tracker.world(), []);
    host.online.status = 'open'; host.mode = () => 'dungeon'; assert.deepEqual(tracker.world(), []);
    host.mode = () => 'exterior'; host.doors.length = 0; generation++;
    assert.deepEqual(tracker.world(), []);
    setPref('partyVisibility', false); assert.deepEqual(tracker.world(), []);
  } finally { setPref('partyVisibility', false); setPref('ketaPartyEntrances',true);setPref('ketaPartyEntranceMap',true); }
});

test('repeated building blocks resolve by pixel-local instance and place diamond above the door', () => {
  const block = tinyRmb(7, 'TWIN.RMB');
  const origin = [100, 5, 200];
  const entries = [10, RMB_SIDE + 10].map((x) => ({ pixelKey: '1,2', dfBlock: block, recordIndex: 0,
    door: { doorType: 1, centre: { x: 0, y: 1, z: 0 }, size: { x: 2, y: 2, z: 0.1 },
      matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, origin[0] + x, origin[1], origin[2] + 10, 1] } }));
  const host = { doors: entries, generation: () => 1, mode: () => 'exterior', hidden: new Set(),
    online: { status: 'open' }, social: { party: {}, others: () => [member({ in: 2, px: 1, py: 2, bk: makeBuildingKey(1, 0, 0) })] },
    locations: new Map([['1,2', { exterior: { buildings: [] } }]]),
    built: new Map([['1,2', { locOrigin: origin, locBlocks: [0, 1].map((x) => ({ x, y: 0, originX: x * RMB_SIDE, originZ: 0, dfBlock: block })) }]]),
    shift: (e) => { const matrix = [...e.door.matrix]; matrix[12] += 500; return { ...e.door, matrix }; } };
  setPref('partyVisibility', true); setPref('ketaPartyEntrances',true);setPref('ketaPartyEntranceMap',true);
  try {
    const [mark, extra] = createPartyEntranceHost(host).world();
    assert.equal(extra, undefined); assert.deepEqual(mark.at, [610 + RMB_SIDE, 6, 210]);
    assert.equal(mark.rise, 1.5);
  } finally { setPref('partyVisibility', false); setPref('ketaPartyEntrances',true);setPref('ketaPartyEntranceMap',true); }
});
