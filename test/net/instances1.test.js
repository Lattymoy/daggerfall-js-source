// INSTANCES (2026-10-15, Mac: "lets implement an instanced system ... select public or instanced (if applicable)";
// bible/11-Multiplayer/Instances.md): THE LAW - an instance is its place's public world room with an owner and an
// epoch after it (net/instanceRoom.js), a world room like its twin (net/wire.js WORLD_ROOM, worldTtlMsFor), keyed by
// roomKeyFor from an identity's `instance` (net/online.js), and admitted to its owner, staff and the party of its owner alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  instanceOwnerOf, holdEpochOf, isInstanceEpoch, instanceRoomOf, instanceOf, isInstanceRoom, instanceAdmits, partyHoldsOwner,
  instanceWord, instanceOfWord, relaySupportsInstances, INSTANCE_RELAY_MIN,
} from '../../src/net/instanceRoom.js';
import { isWorldRoom, worldTtlMsFor, WORLD_TTL_MS, INSTANCE_TTL_MS, roomOf, RELAY_VERSION } from '../../src/net/wire.js';
import { roomKeyFor } from '../../src/net/online.js';

const hex = (s, bytes) => createHash('sha256').update(s).digest('hex').slice(0, bytes * 2);
const INST = { owner: '0123456789abcdef', epoch: '89abcdef' };

test('INSTANCES: the owner is the account\'s digest, the Hold\'s epoch the character\'s - eight and four bytes of SHA-256, salted apart; an epoch is eight lower-case hex (a quest\'s is its own, instances3)', async () => {
  assert.equal(await instanceOwnerOf('acct_1234'), hex('instance:account:acct_1234', 8));
  assert.equal(await holdEpochOf('char_99'), hex('instance:epoch:char_99:hold', 4));
  assert.notEqual(await holdEpochOf('char_99'), await holdEpochOf('char_98'), 'two characters of one account never share the Hold\'s room');
  assert.equal(await instanceOwnerOf('a b'), null);
  assert.equal(await instanceOwnerOf(null), null);
  assert.equal(await holdEpochOf(''), null);
  assert.equal(await holdEpochOf(null), null);
  assert.equal(isInstanceEpoch('89abcdef'), true);
  for (const bad of ['89ABCDEF', '89abcde', '89abcdef0', 7, null]) assert.equal(isInstanceEpoch(bad), false, String(bad));
});

test('INSTANCES: the key - a dungeon whole or a building, the owner and the epoch after it; never beside a re-laid dungeon, a cell or an owned room', () => {
  assert.equal(instanceRoomOf('dungeon:m187853213', INST), 'dungeon:m187853213.i0123456789abcdef.89abcdef');
  assert.equal(instanceRoomOf('interior:m206728581.131590', INST), 'interior:m206728581.131590.i0123456789abcdef.89abcdef');
  for (const bad of ['dungeon:m187853213.m', 'dungeon:m187853213.s', 'world:6,9', 'owned:0123456789abcdef0123456789abcdef.0123456789abcdef:1.2', 'dungeon:m0', 'interior:m5.0']) {
    assert.equal(instanceRoomOf(bad, INST), null, bad);
  }
  assert.equal(instanceRoomOf('dungeon:m1', { owner: 'ABCDEF0123456789', epoch: '89abcdef' }), null, 'hex is lower case, one spelling');
  assert.equal(instanceRoomOf('dungeon:m1', { owner: '0123456789abcdef', epoch: '89abcde' }), null);
  assert.deepEqual(instanceOf('dungeon:m187853213.i0123456789abcdef.89abcdef'), { base: 'dungeon:m187853213', owner: '0123456789abcdef', epoch: '89abcdef' });
  assert.equal(instanceOf('dungeon:m187853213'), null);
  assert.equal(isInstanceRoom('interior:m206728581.131590.i0123456789abcdef.89abcdef'), true);
  assert.equal(isInstanceRoom('dungeon:m187853213.m.i0123456789abcdef.89abcdef'), false);
  // the relay's path law carries it (eighty characters at most - the longest instance is 56)
  const longest = instanceRoomOf('interior:m4294967295.16777215', INST);
  assert.equal(roomOf(`/room/${longest}`), longest);
});

test('INSTANCES: a world room like its public twin, on a memory clock of its own', () => {
  for (const k of ['dungeon:m187853213.i0123456789abcdef.89abcdef', 'interior:m206728581.131590.i0123456789abcdef.89abcdef']) {
    assert.equal(isWorldRoom(k), true, k);
    assert.equal(worldTtlMsFor(k), INSTANCE_TTL_MS, k);
  }
  assert.equal(isWorldRoom('dungeon:m187853213.m.i0123456789abcdef.89abcdef'), false, 'never beside a re-laid layout');
  assert.equal(isWorldRoom('dungeon:m187853213.i0123456789abcdef'), false, 'no epoch, no room');
  assert.equal(worldTtlMsFor('dungeon:m187853213'), WORLD_TTL_MS);
  assert.equal(worldTtlMsFor('dungeon:m187853213.s'), WORLD_TTL_MS);
  assert.equal(INSTANCE_TTL_MS, 7 * 24 * 3600 * 1000);
});

test('INSTANCES: roomKeyFor keys an identity\'s instance - the dungeon whole whatever size the world gives it, the building in its layout; none keyed is no room, never the public one', () => {
  assert.equal(roomKeyFor({ host: 'world', mode: 'dungeon', mapId: 187853213, size: 'medium', instance: INST }), 'dungeon:m187853213.i0123456789abcdef.89abcdef');
  assert.equal(roomKeyFor({ host: 'world', mode: 'dungeon', mapId: 187853213, size: 'medium' }), 'dungeon:m187853213.m');
  assert.equal(roomKeyFor({ host: 'world', mode: 'interior', mapId: 206728581, buildingKey: 131590, instance: INST }), 'interior:m206728581.131590.i0123456789abcdef.89abcdef');
  assert.equal(roomKeyFor({ host: 'world', mode: 'interior', mapId: 206728581, buildingKey: 131590, layout: 'beautiful-cities@3', instance: INST }), `interior:m206728581.${131590 + 2 * 0x1000000}.i0123456789abcdef.89abcdef`, 'WD3: the building\'s room in its town\'s layout');
  assert.equal(roomKeyFor({ host: 'world', mode: 'dungeon', mapId: null, regionIndex: 3, locationName: 'X', instance: INST }), null);
  assert.equal(roomKeyFor({ host: 'world', mode: 'dungeon', mapId: 187853213, instance: { owner: 'x', epoch: 'y' } }), null);
  assert.equal(roomKeyFor({ host: 'world', mode: 'interior', mapId: 206728581, buildingKey: 0, instance: INST }), null);
});

test('INSTANCES: the relay\'s door - the owner, staff, and the owner\'s party (the hub\'s word); nobody else, and nothing for another key', async () => {
  const owner = await instanceOwnerOf('acct_owner');
  const key = instanceRoomOf('dungeon:m187853213', { owner, epoch: '89abcdef' });
  assert.equal(await instanceAdmits(key, 'acct_owner'), true);
  assert.equal(await instanceAdmits(key, 'acct_stranger'), false);
  assert.equal(await instanceAdmits(key, 'acct_stranger', { staff: true }), true);
  const asked = [];
  const kin = async (a, o) => { asked.push([a, o]); return a === 'acct_friend'; };
  assert.equal(await instanceAdmits(key, 'acct_friend', { kin }), true);
  assert.equal(await instanceAdmits(key, 'acct_stranger', { kin }), false);
  assert.deepEqual(asked, [['acct_friend', owner], ['acct_stranger', owner]], 'the hub is asked by the owner\'s digest');
  assert.equal(await instanceAdmits('dungeon:m187853213', 'acct_owner', { staff: true }), false, 'a public room is not this door\'s');
  assert.equal(await instanceAdmits(key, 'not an id!', { staff: true }), false);
});

test('INSTANCES: the hub\'s answer - the asker\'s party holds another member whose digest is the owner', async () => {
  const owner = await instanceOwnerOf('acct_owner');
  assert.equal(await partyHoldsOwner(['acct_friend', 'acct_owner'], 'acct_friend', owner), true);
  assert.equal(await partyHoldsOwner(['acct_friend', 'acct_other'], 'acct_friend', owner), false);
  assert.equal(await partyHoldsOwner(['acct_owner', 'acct_other'], 'acct_friend', owner), false, 'the asker must be in the party it names');
  assert.equal(await partyHoldsOwner(['acct_owner'], 'acct_owner', owner), false, 'the owner is the door\'s own arm, not kin of itself');
  assert.equal(await partyHoldsOwner(null, 'acct_friend', owner), false);
});

test('INSTANCES: a party pose\'s word for a member\'s instance, both ways', () => {
  assert.equal(instanceWord(INST), '0123456789abcdef.89abcdef');
  assert.deepEqual(instanceOfWord('0123456789abcdef.89abcdef'), INST);
  assert.equal(instanceWord({ owner: 'x', epoch: 'y' }), null);
  assert.equal(instanceOfWord('0123456789abcdef'), null);
  assert.equal(instanceOfWord(7), null);
});

test('INSTANCES: offered only where the relay admits them - world208 and later (world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges)', () => {
  assert.equal(INSTANCE_RELAY_MIN, 208);
  assert.equal(relaySupportsInstances('world207'), false, 'ONE-BODY\'s relay keeps no instance');
  assert.equal(relaySupportsInstances('world209'), true);
  assert.equal(relaySupportsInstances('world1000'), true);
  assert.equal(relaySupportsInstances(undefined), false);
  assert.equal(relaySupportsInstances('world208x'), false);
  assert.ok(relaySupportsInstances(RELAY_VERSION), 'this relay is one');
});
