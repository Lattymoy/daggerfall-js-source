// SD-ONELIFE (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md sections 7 and 16; Mac: "A death
// within the rift casts you out and youre unable to re enter. You get one life to prove your worth"): ONE LIFE A HOLLOW.
// A death in the Shattered Hour casts the player out (SD5a) and is final for that Hollow: the realm keeps the account
// its dying pose came from and refuses its every hello after ("The Hour will not take you back."); the page keeps the
// slot on the device, its Rift refuses it, and no Resurrect raises a body in the Hour.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms } from './fakeRoom.mjs';
import { SD_KEY, SD_REALM_KEY, SOCIAL_ROOM, PIXEL_UNITS, worldRoom, chatRegionRoom } from '../src/net/wire.js';
import { sdRoomKey, sdFirst, sdRise, sdFind, sdFell, SD_NO_FALLEN, SD_NO_CLOSED, SD_NO_RIFT, SD_COLLAPSE_MS } from '../src/net/sdLaw.js';
import { SD_ARENA, realmToDungeon } from '../src/net/sdBrain.js';
import { PIXEL_M } from '../src/net/gateLaw.js';
import { sdRiftWord, SD_FALLEN_KEY, SD_ENTERED_KEY, SD_ENTERED_MAX } from '../src/world/sdDungeon.js';
import { SD_REALM_TEXT } from '../src/world/sdRealm.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = read('src/scenes/world.js');
const T0 = 1_800_000_000_000, M = 60_000;
const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArena = (x = 0, z = -10, extra = {}) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0, ...extra }; };
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };

/** The fake world driven to a FOUND Hollow (slot 1), its realm standing past the Orrery. */
async function withRealm(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      await fire(hub);
      clock = hub.room._sdRec.next;
      for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const r = world.room(chatRegionRoom(17)); const ws = r.connect(); await r.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      const realm = world.room(sdRoomKey(rec.s));
      const h = await realm.room._sdHallOf(rec.s); h.ok = true; await realm.room.state.storage.put('sdorrery', h);
      const hello = async (id, pose) => { const ws = realm.connect(); await realm.hello(ws, id, pose, { name: id.replace('peer-', '') }); return ws; };
      await fn({ world, realm, cell, mara, rec, hello, step: (ms) => { clock += ms; } });
    });
  } finally { Date.now = realNow; }
}

test('SD-ONELIFE THE REALM REMEMBERS A DEATH: the dying pose (PCORPSE1\'s `dd`) that comes through a realm marks its account dead there, kept in the realm\'s storage; every hello of that account after is refused "The Hour will not take you back." - a fresh instance too; another fighter comes and goes as before; a dying pose anywhere else marks nothing (mutants: the death unkept; unread at the door; kept in memory alone; any room\'s death)', async () => {
  await withRealm(async ({ realm, cell, mara, rec, hello }) => {
    const ann = await hello('peer-ann', inArena(0, -12)), bo = await hello('peer-bo', inArena(4, -12));
    assert.equal(ann.closed, null); assert.equal(bo.closed, null);
    await realm.raw(ann, JSON.stringify({ t: 'pose', p: inArena(0, -12, { dd: 1 }) }));
    assert.deepEqual(realm.store.get(SD_REALM_KEY).dead, ['acct-peer-ann'], 'kept with the realm');
    const again = await hello('peer-ann', inArena(0, -12));
    assert.equal(again.closed?.reason, SD_NO_FALLEN, 'one life');
    assert.equal(SD_NO_FALLEN, 'The Hour will not take you back.');
    realm.room._sdRealm = undefined;   // a fresh instance reads it from storage
    const later = await hello('peer-ann', inArena(0, -12));
    assert.equal(later.closed?.reason, SD_NO_FALLEN, 'across an instance');
    const bo2 = await hello('peer-bo', inArena(4, -12));
    assert.equal(bo2.closed, null, 'the living come back as before');
    await realm.raw(bo2, JSON.stringify({ t: 'pose', p: inArena(4, -12, { dd: 1 }) }));
    await realm.raw(bo2, JSON.stringify({ t: 'pose', p: inArena(4, -12, { dd: 1 }) }));
    assert.deepEqual(realm.store.get(SD_REALM_KEY).dead, ['acct-peer-ann', 'acct-peer-bo'], 'once each');
    // a death in the Hollow's own cell: nothing marked
    await cell.raw(mara, JSON.stringify({ t: 'pose', p: { ...doorPose(10), dd: 1 } }));
    assert.equal(realm.store.get(SD_REALM_KEY).dead.includes('acct-peer-mara'), false);
    assert.equal(cell.store.get(SD_REALM_KEY), undefined, 'a world cell keeps no realm');
    assert.equal(realm.room._sdRealm.s, rec.s);
  });
});

test('SD-ONELIFE THE RIFT\'S WORD: a slot whose Hour this player died in is refused at its Rift for good - found, or in its collapse though they went through - in the realm\'s own words; another slot\'s word is its own (mutants: the fallen let through; the fallen before the slot)', () => {
  const r = sdRise(sdFirst(T0 - 3 * 3_600_000), T0 - 10 * M, 0), f = sdFind(r, T0, 'Mara');
  assert.equal(sdRiftWord(f, f.s, T0 + M), null, 'found: through');
  assert.equal(sdRiftWord(f, f.s, T0 + M, { fallen: true }), SD_NO_FALLEN, 'died in it: never again');
  const k = sdFell(f, T0 + 2 * M, { top: 'Mara', n: 2 });
  assert.equal(sdRiftWord(k, k.s, T0 + 3 * M, { entered: true }), null, 'its collapse: one who went through, back');
  assert.equal(sdRiftWord(k, k.s, T0 + 3 * M, { entered: true, fallen: true }), SD_NO_FALLEN, 'not one who died there');
  assert.equal(sdRiftWord(f, f.s + 1, T0 + M, { fallen: true }), SD_NO_CLOSED, 'another slot\'s Hollow: closed');
  assert.equal(sdRiftWord(null, 1, T0, { fallen: true }), SD_NO_RIFT);
  assert.ok(T0 + 3 * M < k.fellAt + SD_COLLAPSE_MS);
});

test('SD-ONELIFE THE PAGE, from the world host\'s own text: the slot of the Hour I die in kept on the device (its own key, the last few, once each), the Rift asked with it, no Resurrect raising me in the Hour, and the death\'s words say it is for good (mutants: the death unkept; kept in the session alone; the Rift blind to it; a Resurrect in the Hour)', () => {
  const block = W.slice(W.indexOf('  const sdSlotsKept = (key) => {'), W.indexOf('\n  };\n', W.indexOf('  const sdSlotsKept = (key) => {')) + 5);
  const store = new Map();
  const appStorage = () => ({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
  const make = new Function('appStorage', 'SD_ENTERED_MAX', '_accountSds', `${block}\nreturn sdSlotsKept;`)(appStorage, SD_ENTERED_MAX, { me: () => null });   // AUDIT SD III (H1, PIN MOVED): the signed-in account's - none here, the device's
  const fallen = make(SD_FALLEN_KEY);
  fallen.add(7); fallen.add(7);
  assert.equal(fallen.has(7), true);
  assert.deepEqual(JSON.parse(store.get(SD_FALLEN_KEY)), [7], 'on the device, once');
  for (let s = 8; s < 20; s++) fallen.add(s);
  assert.equal(JSON.parse(store.get(SD_FALLEN_KEY)).length, SD_ENTERED_MAX, 'the last few');
  assert.equal(make(SD_FALLEN_KEY).has(19), true, 'a reload reads it back');
  assert.notEqual(SD_FALLEN_KEY, SD_ENTERED_KEY);
  assert.match(W, /const _sdFallen = sdSlotsKept\(SD_FALLEN_KEY\);/);
  assert.match(W, /if \(_deathWasOnline == null\)[^\n]*\n\s*\{ const hourSlot = modes\?\.sdRealmSlot\?\.\(\) \?\? null; if \(hourSlot != null\) _sdFallen\.add\(hourSlot\); \}/, 'kept the frame I die');   // AUDIT SD III (PIN MOVED): under D-ONLINE1's capture, which stays the death block's first statement (AUDIT WORLD B6, MWBODY1)
  assert.match(W, /word: sdRiftWord\(rec, s, now, \{ entered: _sdEntered\.has\(s\), fallen: _sdFallen\.has\(s\) \}\),/, 'the Rift asked with it');
  assert.match(W, /const rez = social\?\.acct && modes\?\.sdRealmSlot\?\.\(\) == null \? rezFor\(social\.others\(\), social\.acct, _rezSeen\) : null;[^\n]*\n\s*if \(rez\) \{ resurrectInPlace\(rez\); return; \}/, 'no Resurrect in the Hour');   // AUDIT SD III (PIN MOVED): asked of the call, the rise MWBODY1's own line
  assert.equal(SD_REALM_TEXT.died, 'The Shattered Hour casts you out for good. You wake before the Abyss Dungeon\'s door.');
});
