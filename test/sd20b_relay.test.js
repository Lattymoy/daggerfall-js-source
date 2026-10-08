// SD20b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md "SD20 - AUDIT SD III"): THE RELAY
// AND THE ACCOUNT, AUDITED A THIRD TIME - each finding reproduced on the arc's own rooms first. A premature word for the
// next slot poisoned the cell that heard it: kept as told and answered, that slot's real find was never told from there.
// A word for the old slot told a minute before the rise held the new Hollow's every find at that door nine minutes. The
// realm's list of the dead stopped at 256, and the 257th death came straight back. And the honours were rolled off the
// receipt's seed, which the page holds: a guest read its roll before it registered.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto as crypto } from 'node:crypto';
import { fakeRooms } from './fakeRoom.mjs';
import { SD_KEY, SD_REALM_KEY, SOCIAL_ROOM, PIXEL_UNITS, SD_FIGHTERS_MAX, SD_INTERNAL_FOUND, worldRoom, chatRegionRoom, sdDeadKey } from '../src/net/wire.js';
import { sdRoomKey, SD_NO_FALLEN } from '../src/net/sdLaw.js';
import { SD_ARENA, realmToDungeon } from '../src/net/sdBrain.js';
import { PIXEL_M } from '../src/net/gateLaw.js';
import { mintSdReceipt } from '../src/net/sdReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import { importPublicKeyB64 } from '../src/net/identityToken.js';
import { claimSd, sdHonoursRoll } from '../server-account/src/sds.js';
import { createGuest } from '../server-account/src/accounts.js';
import { d1 } from './accountDb.mjs';

const subtle = crypto.subtle;
const T0 = 1_800_000_000_000, PX = 300, PY = 200, UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArena = (extra = {}) => { const [x, y, z] = realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z - 12); return { x, y, z, yaw: 0, pitch: 0, ...extra }; };
const found = (s) => JSON.stringify({ t: 'sd', k: 'found', s, px: PX, py: PY });
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };

/** The fake world with its hub's first Hollow risen (slot 1); a cell at the Hollow's pixel; the hub's found asks counted. */
async function withHub(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      await fire(hub); clock = hub.room._sdRec.next; await fire(hub);
      const cell = world.room(worldRoom(PX, PY));
      let asks = 0;
      const ROOMS = cell.room.env.ROOMS;
      cell.room.env.ROOMS = { idFromName: ROOMS.idFromName, get: (id) => ({ fetch: (q) => { if (new URL(q.url).pathname === SD_INTERNAL_FOUND) asks++; return ROOMS.get(id).fetch(q); } }) };
      await fn({ world, hub, cell, fire, rec: () => hub.store.get(SD_KEY), asks: () => asks, set: (t) => { clock = t; }, step: (ms) => { clock += ms; }, now: () => clock });
    });
  } finally { Date.now = realNow; }
}

test('SD20b A SLOT AHEAD OF THE HUB\'S IS NOT TOLD FOR GOOD (R1): a guest\'s word for the NEXT slot, said at the pixel\'s centre before it rose, is not kept as told and answered - once that Hollow rises, the cell tells its real find and the hub holds it found; a slot the hub answered for is still told once (mutant: the premature word kept)', async () => {
  await withHub(async ({ hub, cell, fire, rec, asks, set, step }) => {
    const grief = cell.connect(); await cell.hello(grief, 'peer-grief', doorPose(0), { name: 'Grief' });
    await cell.raw(grief, found(2));
    assert.equal(rec().s, 1);
    assert.deepEqual([...(cell.room._sdTold ?? [])], [], 'the slot ahead of the hub\'s: not kept');
    await cell.drop(grief);
    set(rec().until + 1); await fire(hub);
    set(rec().next + 1); await fire(hub);
    assert.deepEqual([rec().s, rec().ph], [2, 'risen']);
    const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
    step(15_000);
    await cell.raw(mara, found(2));
    assert.equal(rec().ph, 'found', 'the honest find, told and held');
    assert.deepEqual([...cell.room._sdTold], [2], 'and kept as told now');
    const before = asks();
    step(15_000);
    await cell.raw(mara, found(2));
    assert.equal(asks(), before, 'a slot the hub answered for: never told again (AUDIT SD II, L7 M4)');
  });
});

test('SD20b THE NEXT SLOT TOLD ONCE IT MAY HAVE RISEN (R3): the hub\'s answer says when the next may rise (`next`), and while that word is fresh a find for the slot after it is held until then - not ten minutes: a word for the old slot a minute before the rise held the new Hollow\'s finds at that door nine; a slot two ahead is held as ever (mutants: `next` unsaid; the next slot held whole)', async () => {
  await withHub(async ({ hub, cell, fire, rec, asks, set }) => {
    set(rec().until + 1); await fire(hub);
    const riseAt = rec().next;
    set(riseAt - 60_000);
    const grief = cell.connect(); await cell.hello(grief, 'peer-grief', doorPose(0), { name: 'Grief' });
    await cell.raw(grief, found(1));
    assert.deepEqual(cell.room._sdHubSlot, { s: 1, at: riseAt - 60_000, next: riseAt }, 'the hub\'s slot and when the next may rise');
    const early = asks();
    await cell.raw(grief, found(2));
    assert.equal(asks(), early, 'before it may rise: held');
    await cell.drop(grief);
    set(riseAt + 1); await fire(hub);
    assert.equal(rec().s, 2);
    const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
    await cell.raw(mara, found(3));
    assert.equal(asks(), early, 'two ahead of the hub\'s word: held');
    await cell.raw(mara, found(2));
    assert.equal(rec().ph, 'found', 'the new Hollow found at once');
  });
});

test('SD20b ONE LIFE A HOLLOW, HOWEVER MANY HAVE DIED IN IT (R2): past the realm\'s list of SD_FIGHTERS_MAX dead, each death is kept under its account\'s own key and its next hello refused - a click-each guest\'s 256 deaths no longer let the 257th account die and come straight back; a living account past the list is admitted (mutants: the death past the list forgotten; the key never read)', async () => {
  await withHub(async ({ world, cell, rec }) => {
    const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
    await cell.raw(mara, found(rec().s));
    const realm = world.room(sdRoomKey(rec().s));
    const h = await realm.room._sdHallOf(rec().s); h.ok = true; await realm.room.state.storage.put('sdorrery', h);
    const r = await realm.room._sdRealmOf(rec().s);
    r.dead = Array.from({ length: SD_FIGHTERS_MAX }, (_, k) => `acct-gone-${k}`);
    await realm.room.state.storage.put(SD_REALM_KEY, r);
    const hello = async (id) => { const ws = realm.connect(); await realm.hello(ws, id, inArena(), { name: id.replace('peer-', ''), kind: 'linked' }); return ws; };
    const main = await hello('peer-main');
    assert.equal(main.closed, null, 'alive: admitted past the list');
    await realm.raw(main, JSON.stringify({ t: 'pose', p: inArena({ dd: 1 }) }));
    assert.equal(realm.store.get(sdDeadKey('acct-peer-main')), 1, 'its death under its own key');
    assert.equal(realm.store.get(SD_REALM_KEY).dead.length, SD_FIGHTERS_MAX, 'the list as it was');
    await realm.drop(main);
    const back = await hello('peer-main');
    assert.deepEqual(back.closed?.reason, SD_NO_FALLEN, 'never back in');
    assert.equal((await hello('peer-other')).closed, null, 'another, alive: admitted');
  });
  assert.equal(sdDeadKey('acct-x'), 'sddead:acct-x');
});

test('SD20b THE HONOURS ARE THE CLAIM\'S OWN DRAW (R4): the title and the aura are rolled at the claim off four bytes the service draws - nothing the page holds beforehand - so a receipt whose seed would roll both grants nothing on a draw that rolls none, and one whose seed rolls none grants both on a draw that does (mutant: rolled off the receipt\'s seed)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  const priv = await importReceiptKey(pkcs8, { subtle }), pubKey = await importPublicKeyB64(pub, { subtle });
  const seedFor = (title, aura) => { for (let c = 1; c <= 1000; c++) { const x = sdHonoursRoll(c); if (x.title === title && x.aura === aura) return c; } throw new Error('none'); };
  const rand = (b) => crypto.getRandomValues(b);
  const asked = [];
  const rolling = (seed) => (b) => { asked.push(b.length); return b.length === 4 ? (b.set([(seed >>> 24) & 255, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255]), b) : rand(b); };
  const db = d1(), nowS = 1_800_000_000;
  const member = async (h) => { const id = (await createGuest({ db, subtle, rand, nowS }, { deviceLabel: null })).id; db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id); return { id, handle: h }; };
  const A = await member('Breaker1'), B = await member('Breaker2');
  const both = seedFor(true, true), none = seedFor(false, false);
  const ra = await mintSdReceipt({ d: 7, s: A.id, c: both, x: 'dealt', l: 30 }, priv, { subtle, nowS });
  const got = await claimSd({ db, nowS: nowS + 60, subtle, rand: rolling(none) }, A, ra, pubKey);
  assert.deepEqual([got.recorded, got.title, got.aura], [true, false, false], 'the receipt\'s seed rolls nothing');
  assert.ok(asked.includes(4), 'four bytes drawn at the claim');
  const rb = await mintSdReceipt({ d: 7, s: B.id, c: none, x: 'dealt', l: 30 }, priv, { subtle, nowS });
  const gotB = await claimSd({ db, nowS: nowS + 60, subtle, rand: rolling(both) }, B, rb, pubKey);
  assert.deepEqual([gotB.recorded, gotB.title, gotB.aura], [true, true, true], 'the claim\'s draw rolls both');
});
