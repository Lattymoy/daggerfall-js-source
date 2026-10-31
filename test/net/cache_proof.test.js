// AUDIT AURUM-CACHES E1 (2026-10-31, the owner: "Ensure security on aurem caches so nobody can dupe or cheat"): THE
// RELAY'S WORD THAT AN ACCOUNT STOOD IN A DUNGEON (net/cacheProof.js). The relay signs it into a dungeon room's welcome,
// the page keeps it for that dungeon's coffer, and the account service pays a claim only with it
// (test/server/aurum_cache_service.test.js). tools/mutants/cache_proof.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { mintCacheProof, readCacheProof, verifyCacheProof, cacheProofRoomMap, cacheProofPlace, keepCacheProof, cacheProofFor, _resetCacheProof, CACHE_PROOF_TTL_S, CACHE_BAY_IDS } from '../../src/net/cacheProof.js';
import { importReceiptKey } from '../../src/net/gate/gateReceipt.js';
import { BAY_PIXEL_IDS } from '../../src/world/placeIds.js';
import { discoveryKeyOf } from '../../src/systems/discovery.js';
import { aurumCachePlaceOf } from '../../src/scenes/aurumCacheHost.js';
import { aurumCacheDungeonKey } from '../../src/net/aurumCacheLaw.js';
import { fakeRooms } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { OnlineSession } from '../../src/net/online.js';
import { RELAY_VERSION } from '../../src/net/wire.js';

const { subtle } = webcrypto;
const NOW_S = 1_800_000_000;
async function keys() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  return { pkcs8, priv: await importReceiptKey(pkcs8, { subtle }), pub: kp.publicKey };
}

test('E1 a room\'s map and a map\'s cache: every dungeon room\'s spelling names its map - its size, its curated block, an instance - and nothing else does; a map\'s cache is the professions\' key, the page\'s coffer\'s own, in the Bay and past it (mutants: the instance unread, the port id keyed by its low bits)', () => {
  for (const k of ['dungeon:m77', 'dungeon:m77.m', 'dungeon:m77.s.c2', 'dungeon:m77.c12', 'dungeon:m77.i0123456789abcdef.0000abcd']) assert.equal(cacheProofRoomMap(k), 77, k);
  for (const k of ['interior:m77.3', 'world:9,9', 'chat:global', 'dungeon:m0', 'dungeon:m077', 'dungeon:m4294967296', 'xdungeon:m77', '', null, 77]) assert.equal(cacheProofRoomMap(k), null, String(k));
  assert.equal(CACHE_BAY_IDS, BAY_PIXEL_IDS, 'the Bay\'s ids, one number');
  const port = (BAY_PIXEL_IDS + 1234) | (5 << 20);
  for (const m of [77, 872939597, BAY_PIXEL_IDS - 1, BAY_PIXEL_IDS, port, 0xfff7a120]) assert.equal(cacheProofPlace(m), aurumCacheDungeonKey(discoveryKeyOf(m)), String(m));
  for (const m of [77, 872939597, BAY_PIXEL_IDS - 1, BAY_PIXEL_IDS, port]) assert.equal(cacheProofPlace(m), aurumCachePlaceOf({ mapTableData: { mapId: m } }), `${m}: the coffer the page stands is the one the proof pays`);
  for (const m of [0, -1, 1.5, 2 ** 32, '77', null]) assert.equal(cacheProofPlace(m), null, String(m));
});

test('E1 mint, read and verify: the relay\'s key signs an account and a map for six hours; another key, a changed body, an expired or future proof, a stray claim and no key are each refused (mutants: the signature unchecked, the expiry unchecked)', async () => {
  const k = await keys(), other = await keys();
  const p = await mintCacheProof({ s: 'acct-0001', m: 77 }, k.priv, { subtle, nowS: NOW_S });
  assert.match(p, /^q1\./);
  assert.deepEqual(readCacheProof(p), { s: 'acct-0001', m: 77, i: NOW_S, e: NOW_S + CACHE_PROOF_TTL_S });
  assert.deepEqual(await verifyCacheProof(p, k.pub, { subtle, nowS: NOW_S + 60 }), { ok: true, claims: readCacheProof(p) });
  assert.equal((await verifyCacheProof(p, other.pub, { subtle, nowS: NOW_S })).why, 'signature');
  const [v, body, sig] = p.split('.');
  const forged = Buffer.from(JSON.stringify({ s: 'acct-0001', m: 78, i: NOW_S, e: NOW_S + CACHE_PROOF_TTL_S })).toString('base64url');
  assert.equal((await verifyCacheProof(`${v}.${forged}.${sig}`, k.pub, { subtle, nowS: NOW_S })).why, 'signature', 'another map under the same signature');
  assert.equal((await verifyCacheProof(p, k.pub, { subtle, nowS: NOW_S + CACHE_PROOF_TTL_S })).why, 'expired');
  assert.equal((await verifyCacheProof(p, k.pub, { subtle, nowS: NOW_S - 120 })).why, 'future');
  assert.equal((await verifyCacheProof(p, null, { subtle, nowS: NOW_S })).why, 'no-key');
  for (const bad of [`q2.${body}.${sig}`, `${v}.${body}`, '', null, 'x'.repeat(401)]) assert.equal((await verifyCacheProof(bad, k.pub, { subtle, nowS: NOW_S })).ok, false, String(bad).slice(0, 12));
  assert.equal(await mintCacheProof({ s: 'acct-0001', m: 77 }, null, { subtle, nowS: NOW_S }), null, 'no key, no proof');
  assert.equal(await mintCacheProof({ s: 'a b', m: 77 }, k.priv, { subtle, nowS: NOW_S }), null, 'no account');
  assert.equal(await mintCacheProof({ s: 'acct-0001', m: 0 }, k.priv, { subtle, nowS: NOW_S }), null, 'no map');
});

test('E1 the page keeps a welcome\'s proof for its room\'s cache alone: another cache reads none, a proof for another map than its room or no proof keeps nothing, a later room\'s replaces it (mutants: kept for any room)', async () => {
  const k = await keys();
  _resetCacheProof();
  const p77 = await mintCacheProof({ s: 'acct-0001', m: 77 }, k.priv, { subtle, nowS: NOW_S });
  const p78 = await mintCacheProof({ s: 'acct-0001', m: 78 }, k.priv, { subtle, nowS: NOW_S });
  keepCacheProof('dungeon:m77', p78);
  assert.equal(cacheProofFor('d77'), null, 'a proof of another map than its room');
  keepCacheProof('dungeon:m77.m', p77);
  assert.equal(cacheProofFor('d77'), p77);
  assert.equal(cacheProofFor('d78'), null, 'another cache');
  keepCacheProof('world:9,9', p78); keepCacheProof('dungeon:m78', 'q1.x.y'); keepCacheProof('dungeon:m78', undefined);
  assert.equal(cacheProofFor('d77'), p77, 'nothing kept over it');
  keepCacheProof('dungeon:m78', p78);
  assert.deepEqual([cacheProofFor('d77'), cacheProofFor('d78')], [null, p78]);
  _resetCacheProof();
});

test('E1 THE RELAY: a dungeon room\'s welcome carries a proof the relay\'s key signed for the hello\'s account and the room\'s map; a guest\'s, another room\'s and a relay with no key carry none (mutants: the field unsent, a guest proved, the map not the room\'s)', async () => {
  const k = await keys();
  const world = fakeRooms();
  const welcome = (ws) => ws.sent.find((f) => f.t === 'welcome');
  const d = world.room('dungeon:m77.m');
  d.env.GATE_SIGNING_KEY = k.pkcs8;
  const a = d.connect();
  await d.hello(a, 'peer-0001', null, { kind: 'linked', tokenSub: 'acct-peer-0001' });
  const cp = welcome(a)?.cp;
  const v = await verifyCacheProof(cp, k.pub, { subtle, nowS: Math.floor(Date.now() / 1000) });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.deepEqual([v.claims.s, v.claims.m], ['acct-peer-0001', 77]);
  const g = d.connect();
  await d.hello(g, 'peer-0002', null, { kind: 'guest', tokenSub: 'acct-peer-0002' });
  assert.ok(welcome(g), 'welcomed');
  assert.equal(welcome(g).cp, undefined, 'a guest keeps no Aurum');
  const c = world.room('interior:m77.3');
  c.env.GATE_SIGNING_KEY = k.pkcs8;
  const b = c.connect();
  await c.hello(b, 'peer-0003', null, { kind: 'linked', tokenSub: 'acct-peer-0003' });
  assert.ok(welcome(b));
  assert.equal(welcome(b).cp, undefined, 'no dungeon, no proof');
  const bare = world.room('dungeon:m78').connect();
  await world.room('dungeon:m78').hello(bare, 'peer-0004', null, { kind: 'linked', tokenSub: 'acct-peer-0004' });
  assert.ok(welcome(bare));
  assert.equal(welcome(bare).cp, undefined, 'no key, no proof');
});

test('E1 THE PAGE: the session keeps the proof its dungeon room\'s welcome brought - its coffer reads it - (mutants: the page keeps nothing)', async () => {
  const k = await keys();
  _resetCacheProof();
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 2, items: [] }, id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS });
  const cp = await mintCacheProof({ s: 'acct-0001', m: 77 }, k.priv, { subtle, nowS: NOW_S });
  s.join('dungeon:m77.m', { x: 1000, y: 0, z: 1000, yaw: 0, pitch: 0, mv: 0 });
  sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], v: RELAY_VERSION, cp });
  assert.equal(cacheProofFor('d77'), cp);
  s.leave?.();
  _resetCacheProof();
});
