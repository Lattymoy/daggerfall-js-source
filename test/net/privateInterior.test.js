import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { privateInteriorPrefix, privateInteriorRoom, privateInteriorOf, privateInteriorMatches, privateInteriorAdmits } from '../../src/net/privateInterior.js';
import { validStaffDestination, staffDestinationKey } from '../../src/net/staffTeleport.js';
import { roomOf, isWorldRoom } from '../../src/net/wire.js';
import worker from '../../server/src/index.js';
import { layoutsMatch } from '../../src/systems/layoutPins.js';
import { fakeRoom } from '../fakeRoom.mjs';

const prefix = await privateInteriorPrefix('acct-owner', 'character-one');
const room = privateInteriorRoom(prefix, -1, -2);

test('private interiors: stable owner/character rooms fit relay keys and preserve unsigned map/building identities', async () => {
  assert.equal(await privateInteriorPrefix('acct-owner', 'character-one'), prefix);
  assert.notEqual(await privateInteriorPrefix('acct-owner', 'character-two'), prefix);
  assert.notEqual(await privateInteriorPrefix('acct-other', 'character-one'), prefix);
  assert.equal(roomOf(`/room/${room}`), room); assert.ok(room.length <= 80);
  assert.equal(isWorldRoom(room), false, 'never routes world loot or scene memory');
  assert.equal(privateInteriorOf(room).mapId, 0xffffffff);
  assert.equal(privateInteriorOf(room).buildingKey, 0xfffffffe);
  assert.equal(privateInteriorMatches(room, -1, -2), true);
  assert.equal(privateInteriorMatches(room, 3, -2), false);
  assert.equal(privateInteriorMatches(room, -1, 3), false);
  for (const key of [null, 'owned:guess', `${prefix}:01.2`, `${prefix}:1.0`, `${prefix}:4294967296.2`, `${prefix}:1.4294967296`]) assert.equal(privateInteriorOf(key), null);
  assert.equal(await privateInteriorAdmits(room, 'acct-owner', false), true);
  assert.equal(await privateInteriorAdmits(room, 'acct-other', false), false);
  assert.equal(await privateInteriorAdmits(room, 'acct-staff', true), true);
});

test('private interiors: worker rejects malformed keys before minting a room', async () => {
  const response = await worker.fetch(new Request('https://relay.test/room/owned:guess', { headers: { Upgrade: 'websocket' } }), { ROOMS: { idFromName: () => assert.fail('no object for malformed key') } });
  assert.equal(response.status, 404);
});

test('private interiors: real signed owner and staff share presence, unrelated users cannot spoof access', async () => {
  const r = fakeRoom(room), pose = { x: 150123.4567, y: -15.875, z: 256789.125, yaw: 0.125, pitch: -0.1, mv: 0 };
  const join = async (id, who, extra = {}) => { const ws = r.connect(); await r.hello(ws, id, pose, { name: who.n, tok: await r.token(id, who), ...extra }); return ws; };
  const owner = await join('peer-owner', { s: 'acct-owner', n: 'Bran', k: 'guest' });
  assert.ok(owner.sent.some((m) => m.t === 'welcome'));
  const visitor = await join('peer-staff', { s: 'acct-staff', n: 'Mac', k: 'guest', g: ['dm'] });
  assert.ok(visitor.sent.some((m) => m.t === 'welcome' && m.peers.some((p) => p.id === 'peer-owner')));
  const stranger = await join('peer-other', { s: 'acct-other', n: 'Other', k: 'guest' }, { glyphs: ['dm'], sub: 'acct-owner' });
  assert.equal(stranger.sent.some((m) => m.t === 'welcome'), false);
  assert.ok(stranger.closed);
  assert.equal(r.store.has('secret:peer-other'), false, 'refusal precedes identity/secret writes');
  await r.pose(owner, { ...pose, y: -25.25 });
  assert.ok(visitor.sent.some((m) => m.t === 'pose' && m.id === 'peer-owner' && m.p.y === -25.25));
  const otherRoom = fakeRoom(privateInteriorRoom(await privateInteriorPrefix('acct-other', 'character-one'), -1, -2));
  const other = otherRoom.connect(); await otherRoom.hello(other, 'peer-other', pose, { name: 'Other', tok: await otherRoom.token('peer-other', { s: 'acct-other', n: 'Other', k: 'guest' }) });
  assert.equal(other.sent.find((m) => m.t === 'welcome').peers.length, 0);
});

test('private interiors: destination retains room identity, and same door belonging to a different owner reloads', () => {
  const base = { kind: 'interior', pixel: { x: 20, y: 30 }, pos: [12.12345, -54.321, 98.765], yaw: 1, pitch: 0, door: { blockIndex: 1, recordIndex: 2, doorIndex: 0, buildingKey: 0xfffffffe } };
  const d = validStaffDestination({ ...base, privateRoom: room });
  assert.equal(d.privateRoom, room);
  assert.notEqual(staffDestinationKey(d), staffDestinationKey(base));
  assert.equal(validStaffDestination({ ...base, privateRoom: 'owned:guess' }), null);
  assert.equal(validStaffDestination({ ...base, privateRoom: privateInteriorRoom(prefix, -1, 8) }), null);
});

const source = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
const declarations = new Map(), properties = new Map();
function walk(n) {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'FunctionDeclaration' && n.id) declarations.set(n.id.name, source.slice(n.start, n.end));
  if (n.type === 'Property' && n.key?.name) properties.set(n.key.name, source.slice(n.start, n.end));
  for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
}
walk(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
const method = (name, supplied) => { const scope = { layoutLocationKeyOfMapId: () => 1, layoutsMatch, visitLayoutNow: () => 'classic', arenaRecordDisplaced: () => false, ...supplied }; return Function(...Object.keys(scope), `let mode = 'exterior'; let _enemyRestoreInProgress = false; const enterInteriorCore = async (...a) => { entered(...a); mode = 'interior'; }; return ({${properties.get(name)}}).${name};`)(...Object.values(scope)); };

test('private interiors: live-door restore resolves building locally, rejects wrong building/map and unauthorised saved visits', async () => {
  const door = { blockIndex: 1, recordIndex: 2, doorIndex: 0, buildingKey: -2 };
  const building = { buildingKey: -2, buildingType: 23 };
  let mounted;
  const entry = { door, building };
  const scope = { doorTargets: () => [entry], buildingDataForDoor: (e) => e.building, privateInteriorMatches, questSceneCtx: () => ({ mapId: -1 }), host: { canVisitPrivateRoom: () => true }, entered: (...a) => { mounted = a; }, console };
  const saved = { door: { ...door, buildingKey: 0xfffffffe }, privateRoom: room };
  assert.equal(await method('restoreInterior', scope)(saved, [1.1, 2.2, 3.3], { strictDoor: true }), true);
  assert.equal(mounted[2].building, building); assert.equal(mounted[2].privateRoom, room);
  assert.deepEqual(mounted[2].pos, [1.1, 2.2, 3.3]);
  for (const override of [{ host: { canVisitPrivateRoom: () => false } }, { questSceneCtx: () => ({ mapId: 7 }) }, { buildingDataForDoor: () => ({ buildingKey: 8 }) }]) {
    assert.equal(await method('restoreInterior', { ...scope, ...override, entered: () => assert.fail('must not mount') })(saved, null, { strictDoor: true }), false);
  }
  mounted = null;
  assert.equal(await method('restoreInterior', scope)({ door: saved.door }, null, { strictDoor: true }), true);
  assert.equal(mounted[2].building, building, 'ordinary exact interior travel also gets its real identity');
  const savedBuilding = { ...building, insideOpenShop: false };
  assert.equal(await method('restoreInterior', scope)({ door, building: savedBuilding }), true);
  assert.equal(mounted[2].building, savedBuilding, 'ordinary save/load retains its saved building latches');
});

test('private interiors: visiting never reads or overwrites personal caches; save/Recall retains private instance', () => {
  const fn = (name, supplied) => { const scope = { privateVisitOwner: null, interiorCabin: null, placeInstance: null, _sceneHeldForLayout: null, _visitLayout: 'classic', layoutLocationKeyOfMapId: () => 1, questSceneCtx: () => ({ mapId: -1 }), visitLayoutNow: () => 'classic', ...supplied }; return Function(...Object.keys(scope), `return (${declarations.get(name)});`)(...Object.values(scope)); };
  const guard = { privateVisitRoom: room, currentInteriorScene: () => assert.fail('visitor cannot touch personal cache'), _keptHidden: [] };
  fn('cacheInteriorScene', guard)(); fn('restoreInteriorScene', guard)();
  assert.equal(fn('decorOwnerHere', { privateVisitRoom: room })(), false, 'visiting grants no furnishing/storage rights');
  const identity = fn('interiorIdentity', { privateVisitRoom: room, exteriorDoor: { blockIndex: 1, recordIndex: 2, doorIndex: 0 }, interiorBuilding: { buildingKey: -2 } })();
  assert.equal(identity.privateRoom, room);
  // INSTANCES: `placeInstance` - the mode's own word for what the building was entered as: none here (PIN MOVED, the audit)
  const roomIdentity = Function('mode', '_intShared', 'privateVisitRoom', 'interiorBuilding', 'interiorCabin', '_visitLayout', 'placeInstance', `return ({${properties.get('roomIdentity')}}).roomIdentity();`)('interior', { owned: true }, room, { buildingKey: -2 }, null, 'classic', null);
  assert.deepEqual(roomIdentity, { kind: 'interior', buildingKey: -2, layout: 'classic', instance: null, private: true, privateRoom: room });
  const onlineHome = Function('mode', '_intShared', 'privateVisitRoom', 'interiorBuilding', 'interiorCabin', '_visitLayout', 'placeInstance', `return ({${properties.get('roomIdentity')}}).roomIdentity();`)('interior', { owned: false, home: true }, null, { buildingKey: 8 }, null, 'classic', null);
  assert.deepEqual(onlineHome, { kind: 'interior', buildingKey: 8, layout: 'classic', instance: null }, 'persistent online homes retain their existing shared room');
});


test('private interiors: town-layout mismatch and displaced buildings cannot restore even for authorised staff', async () => {
  const door = { blockIndex: 1, recordIndex: 2, doorIndex: 0, buildingKey: 8 };
  const entry = { door, building: { buildingKey: 8 } };
  const scope = { doorTargets: () => [entry], buildingDataForDoor: (e) => e.building, privateInteriorMatches, questSceneCtx: () => ({ mapId: 1 }), host: { canVisitPrivateRoom: () => true }, entered: () => assert.fail('must not mount another layout'), console: { warn() {} } };
  assert.equal(await method('restoreInterior', scope)({ door, layout: 'beautiful-cities@0.5.0' }, null, { strictDoor: true }), false);
  assert.equal(await method('restoreInterior', { ...scope, arenaRecordDisplaced: () => true })({ door, layout: 'classic' }, null, { strictDoor: true }), false);
  let entered = false;
  assert.equal(await method('restoreInterior', { ...scope, entered: () => { entered = true; } })({ door: { ...door, blockIndex: 99 }, layout: 'classic' }, null, { strictDoor: true }), true);
  assert.equal(entered, true, 'a renumbered world-data block resolves through the stable building key');
});
