// AUDIT TAMRIEL-WIDE III (2026-10-29, bible/01-Overview/audits/Audit-Tamriel-Wide.md): the PR read cold again on the
// integrated tree, after main's PvP and staff work merged under it. Each pin holds a case past the Bay beside the Bay's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPvpFlagHost, pvpFlagOn } from '../../../src/scenes/pvpFlagHost.js';
import { createPortalStoneHost } from '../../../src/scenes/portalStoneHost.js';
import { createSdCopy, sdCopyKeyOf, SD_COPY_KEY } from '../../../src/scenes/superDungeon/sdCopy.js';
import { instanceOwnerOf } from '../../../src/net/instanceRoom.js';
import { sdLaneOf } from '../../../src/net/superDungeon/sdLaw.js';
import { zoneEdgeSee, resetZoneEdge } from '../../../src/systems/wild/zoneEdge.js';
import { newWildRef, wildZone } from '../../../src/net/wild/wildRef.js';
import { OnlineSession } from '../../../src/net/online.js';
import { SOCIAL_ROOM, PIXEL_UNITS } from '../../../src/net/wire.js';
import { staffAbyssWorldSupported, STAFF_ABYSS_WORLD_RELAY_MIN, validStaffDestination, validStaffTeleportIn, validStaffTeleportOut } from '../../../src/net/staffTeleport.js';
import { newAbyssSaveData } from '../../../src/scenes/oceanHolesAbyss.js';
import { buildDungeonName } from '../../../src/world/oceanHoles.js';
import { pvp30Rows } from '../../../src/ui/levelUp/pvp30Ask.js';
import { FEATURES } from '../../../src/systems/features.js';
import { ETHER_WORD } from '../../../src/world/ethericSea.js';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { codeOnly } from '../../codeOnly.mjs';

const world = codeOnly(readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8'));
const settle = () => new Promise((r) => setTimeout(r, 20));

test('AUDIT TAMRIEL-WIDE III F1: unflagged, a Portal Stone into Cyrodiil\'s open country arrives - the stone asked the zone by the flag, and teleportTo is told so, never asking again after the stone is spent (mutants: the arrival asks the zone unflagged; teleportTo reads no word)', async () => {
  createPvpFlagHost(() => ({ id: 'me', wildOk: true, setWildFlag() {} }), { level: 40 }, () => {}, { say: () => {} }, { doc: null, now: () => 0 });
  assert.equal(pvpFlagOn(), false, 'unflagged');
  const zone = { x: 1500, y: 700 }, town = { x: 207, y: 213 };
  const wildTeleportRefused = (to) => !!to && to.x === zone.x && to.y === zone.y;   // Cyrodiil's open country: the zone's law refuses
  const calls = [];
  // world.js teleportTo's first gates, as it asks them
  const teleportTo = async (pick, { zoneFree = false } = {}) => { calls.push(zoneFree); return !(!zoneFree && wildTeleportRefused(pick.pixel)); };
  const host = { _mode: () => 'exterior', buildTravelMapWindow: () => null, cam: { pos: [0, 0, 0], yaw: 0 }, cityGuards: { guards: [] }, collider: {}, csaBoatUnderMe: () => false,
    duelEnemyNear: () => false, exteriorFoes: { foes: [] }, hccRuntimeOn: () => null, navalHostileNear: () => false, player: {}, playerTravelPixel: () => town,
    portalGates: { mine: () => null }, teleportTo, townTalk: { say() {} }, walkMode: true, worldMoveBusy: () => false, _teleporting: false, inSiegeRoom: () => false,
    playerSpawned: true, travelOptions: null, travelView: { state: 'off' }, veilRefused: () => false, wildTeleportRefused, wildTravelGate: () => ({ ok: true, fee: 0 }) };
  const { portalArrive } = createPortalStoneHost(host);
  for (const pixel of [zone, town]) {
    calls.length = 0;
    portalArrive({ dest: { pixel, name: 'there' } });
    await settle();
    assert.deepEqual(calls, [true], `(${pixel.x}, ${pixel.y}): the arrival carries the stone's own verdict`);
  }
  assert.match(world, /async function teleportTo\(pick, \{ zoneFree = false \} = \{\}\) \{/);
  assert.match(world, /if \(\(!zoneFree && wildTeleportRefused\(pick\.pixel\)\) \|\| veilRefused\(pick\.pixel\)\) return false;/, 'the guild\'s own teleport keeps the zone\'s law');
});

test('AUDIT TAMRIEL-WIDE III V1: staff /tp lifts the black it said over when teleportTo refuses - a pixel of Cyrodiil\'s open country, a move in flight (mutants: the refusal left black)', () => {
  assert.match(world, /teleportTo\(pick\)\.then\(\(ok\) => ok \|\| hudFade\.clearFade\(\)\)/);
});

test('AUDIT TAMRIEL-WIDE III P1: the copy of a Hollow I went into is kept a lane at a time - a province\'s Hollow never forgets the Bay\'s, and a Bay copy kept before keeps its key (mutants: one key for every lane)', async () => {
  const mem = new Map();
  const store = { get: (k) => mem.get(k), set: (k, v) => mem.set(k, v) };
  let party = { id: 'party1', leader: 'acctAAAA', members: [{ acct: 'acctAAAA' }, { acct: 'acctBBBB' }] };
  const copy = createSdCopy({ social: () => ({ acct: 'acctBBBB', party }), store });
  const bay = 7, skyrim = 10_000_003;
  assert.deepEqual([sdLaneOf(bay), sdLaneOf(skyrim)], [0, 1]);
  assert.deepEqual([sdCopyKeyOf(bay), sdCopyKeyOf(skyrim)], [SD_COPY_KEY, `${SD_COPY_KEY}.1`]);
  const A = await instanceOwnerOf('acctAAAA'), B = await instanceOwnerOf('acctBBBB');
  assert.equal(await copy.ownerFor(bay), A, 'the Bay: the leader\'s copy');
  party = { ...party, leader: 'acctBBBB' };
  assert.equal(await copy.ownerFor(bay), A, 'a new leader keeps me in it');
  assert.equal(await copy.ownerFor(skyrim), B, 'Skyrim: the new leader\'s');
  assert.equal(await copy.ownerFor(bay), A, 'back on the Bay: still the copy I fought in');
  assert.equal(await copy.ownerFor(skyrim), B, 'and Skyrim\'s kept beside it');
  // a copy kept under the old key, before this fix, is the Bay's still
  const old = new Map([[SD_COPY_KEY, { s: bay, a: 'acctBBBB', o: A, p: 'party1' }]]);
  const later = createSdCopy({ social: () => ({ acct: 'acctBBBB', party }), store: { get: (k) => old.get(k), set: (k, v) => old.set(k, v) } });
  assert.equal(await later.ownerFor(bay), A);
});

test('AUDIT TAMRIEL-WIDE III P2: a building\'s door in the zone is no walk over its edge - the edge reads the zone\'s pixel alone, so a shop left in Cyrodiil grants no safe passage, and a walk in from outside still does (mutants: the host reads the outdoors test again)', () => {
  assert.match(world, /zoneEdgeSee\(wildHere\(\), player\.pos, Date\.now\(\)\)/);
  const fighter = (ed) => ({ id: 'p1', cl: 40, ci: 'c1', fl: 0, ...(ed ? { ed } : {}) });
  const pose = { x: 0, y: 0, z: 0 };
  // a shop: the pixel is in the zone throughout, the zone word 0 indoors (wildCan)
  resetZoneEdge();
  let st = newWildRef(), t = 1_000_000;
  zoneEdgeSee(true, [100, 0, 100], t); wildZone(st, 'a1', fighter(false), true, pose, t);
  for (let s = 0; s <= 31; s++) zoneEdgeSee(true, [104, 0, 108], t + s * 1000);
  wildZone(st, 'a1', fighter(false), false, pose, t);
  t += 31_000;
  const ed = zoneEdgeSee(true, [100, 0, 100], t);
  assert.equal(ed, false, 'a door is no edge');
  assert.equal(wildZone(st, 'a1', fighter(ed), true, pose, t).graceUntil, -Infinity, 'no passage');
  // the edge itself: outside the zone's pixel, a step in
  resetZoneEdge();
  st = newWildRef(); t = 2_000_000;
  zoneEdgeSee(false, [0, 0, 0], t); wildZone(st, 'a2', fighter(false), false, pose, t - 60_000);
  const walked = zoneEdgeSee(true, [10, 0, 0], t + 1000);
  assert.equal(walked, true, 'a walk over the edge');
  assert.ok(wildZone(st, 'a2', fighter(walked), true, pose, t + 1000).graceUntil > t, 'passage');
});

test('AUDIT TAMRIEL-WIDE III M1: an abyss pit past the Bay goes to a hub that reads one (world284) - an older hub refuses the frame and closes the socket, so the answer says `unavailable` and a pull is never sent; a Bay pit to every hub (mutants: the gate dropped)', () => {
  assert.equal(STAFF_ABYSS_WORLD_RELAY_MIN, 284);
  assert.deepEqual(['world283', 'world284', null].map(staffAbyssWorldSupported), [false, true, false]);
  const abyssAt = (px, py) => ({ kind: 'abyss', pixel: { x: 412, y: 220 }, pos: [1.5, -20.25, 3.75], yaw: 0.5, pitch: 0,
    abyss: { ...newAbyssSaveData(), Active: true, PitMapX: px, PitMapY: py, TemplateMapX: 412, TemplateMapY: 220, TemplateRegionIndex: 17, TemplateLocationIndex: 33,
      ReturnWorldX: (px + 0.5) * PIXEL_UNITS, ReturnWorldZ: (499 - py + 0.5) * PIXEL_UNITS, HasReturnPitDepth: true, ReturnPitDepth: 40, DungeonName: buildDungeonName(px, py) } });
  for (const [v, reads] of [['world283', false], ['world284', true]]) {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Bran', id: 'peer-bran', secret: 'secret-bran', WebSocketImpl: FakeWS, presence: false });
    s.join(SOCIAL_ROOM); const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'peer-bran', peers: [], n: 1, v });
    const sent = () => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'stp');
    s.sendStaffTeleport({ k: 'answer', ticket: 'tk-bay', dest: abyssAt(600, 140) });
    assert.equal(sent().at(-1).dest?.abyss?.PitMapX, 600, `${v}: a Bay pit to every hub`);
    s.sendStaffTeleport({ k: 'answer', ticket: 'tk-far', dest: abyssAt(2441, 1500) });
    assert.deepEqual(reads ? sent().at(-1).dest.abyss.PitMapX : sent().at(-1), reads ? 2441 : { t: 'stp', k: 'answer', ticket: 'tk-far', error: 'unavailable' }, `${v}: a pit past the Bay`);
    const before = sent().length;
    s.sendStaffTeleport({ k: 'pull', nonce: 'nonce-1', name: 'Ann', dest: abyssAt(2441, 1500) });
    assert.equal(sent().length - before, reads ? 1 : 0, `${v}: a pull from a pit past the Bay`);
    s.leave();
  }
});

test('AUDIT TAMRIEL-WIDE III T8 and F3: the level-30 warning names the open Eltheric Ocean, not every sea, and the map\'s note says no fast travel crosses into or out of Cyrodiil online (mutants: the sea again; the note promising the zone)', () => {
  assert.match(pvp30Rows()[0], new RegExp(`\\(Cyrodiil, the open ${ETHER_WORD} Ocean\\)`));
  const note = FEATURES.find((f) => f.id === 'tamriel-map').note;
  assert.match(note, /fast travel reaches them, except into or out of Cyrodiil online\.$/);
});

test('AUDIT TAMRIEL-WIDE III P3/T13: STAFF-PULL reaches every province as /tp does - a pull from a staff member standing in Skyrim names that place, and the player is told it (mutants: the destination held to the Bay)', () => {
  for (const pixel of [{ x: 207, y: 213 }, { x: 2700, y: -300 }]) {
    const here = validStaffDestination({ kind: 'exterior', pixel, pos: [123456.5, -14.25, 654321.75], yaw: 0.8, pitch: -0.3 });
    assert.ok(here, `(${pixel.x}, ${pixel.y}): a staff destination`);
    assert.deepEqual(validStaffTeleportIn({ k: 'pull', nonce: 'n1', name: 'Bran', dest: here }), { k: 'pull', nonce: 'n1', name: 'Bran', dest: here }, 'the staff member\'s pull');
    assert.deepEqual(validStaffTeleportOut({ k: 'pull', ticket: 'tk-1', dest: here }), { k: 'pull', ticket: 'tk-1', dest: here }, 'the player told it');
  }
});
