// PVPDUNGEONS (2026-10-08, the owner: "THOSE HAVE TO WORK!"): the zone's halls as the relay keeps them - the day by the
// relay's clock, an account's hour lock (lifted while its own remains lie in the hall), the empty hall's reset (its world
// room wiped), the crows told to everyone online, and no party member taking a fallen friend's remains.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  SOCIAL_ROOM, PIXEL_UNITS, worldRoom, parseClient, validWdunIn, validWdunOut, wdunHall, wdunRoomKey, isWorldRoom,
  WDUN_LOCK_MS, WDUN_RESET_MS, WDUN_STALE_MS, WDUN_DAY_MS, relaySupportsWdun, RELAY_VERSION, WILD_REMAINS_MS,
} from '../src/net/wire.js';
import * as L from '../src/net/wildLaw.js';
import { mintRemainsOrder, remainsDigest } from '../src/net/identityToken.js';
import { fakeRooms } from './fakeRoom.mjs';

test('PVPDUNGEONS wire: a hall is a pixel, its room a world room of its own lane; the words in and out are bounded', () => {
  assert.equal(wdunHall('512,88'), '512,88');
  assert.equal(wdunHall('1000,1'), null);
  assert.equal(wdunHall('5,500'), null);
  assert.equal(wdunHall('a,b'), null);
  assert.ok(isWorldRoom(wdunRoomKey('512,88')), 'the hall\'s room is a world room the relay admits');
  assert.notEqual(wdunRoomKey('512,88'), wdunRoomKey('513,88'));
  assert.deepEqual(validWdunIn({ k: 'in', h: '3,4' }), { k: 'in', h: '3,4' });
  assert.equal(validWdunIn({ k: 'in' }), null);
  assert.equal(validWdunIn({ k: 'boom', h: '3,4' }), null);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'wdun', k: 'hi' }), { hasHello: true }), { t: 'wdun', k: 'hi' });
  assert.equal(parseClient(JSON.stringify({ t: 'wdun', k: 'hi' })).error, 'wdun before hello');
  assert.equal(validWdunOut({ t: 'wdun', k: 'st', day: -1 }), null);
  assert.deepEqual(validWdunOut({ t: 'wdun', k: 'cr', crows: [['1,2', 5], ['bad', 3]] }), { k: 'cr', crows: [['1,2', 5]] });
  assert.ok(relaySupportsWdun(RELAY_VERSION));
  assert.ok(!relaySupportsWdun('world175'));
});

test('PVPDUNGEONS law: a lock an hour, the way back while my remains lie there, the reset after twenty empty minutes, the crows', () => {
  const st = L.wdunEmpty(), t = 1e12;
  assert.equal(L.wdunEnter(st, 'A', '5,5', t).ok, true);
  L.wdunLeave(st, 'A', '5,5', t + 1000);
  const no = L.wdunEnter(st, 'A', '5,5', t + 2000);
  assert.equal(no.ok, false);
  assert.equal(no.left, WDUN_LOCK_MS - 1000);
  assert.equal(L.wdunEnter(st, 'A', '5,5', t + 1000 + WDUN_LOCK_MS).ok, true, 'an hour on, open again');
  L.wdunDie(st, 'B', '6,6', t, t + WILD_REMAINS_MS);
  assert.deepEqual(L.wdunCrows(st, t + 1), [['6,6', WILD_REMAINS_MS - 1]]);
  assert.equal(L.wdunEnter(st, 'B', '6,6', t + 60_000).ok, true, 'my remains there: my way back');
  L.wdunLeave(st, 'B', '6,6', t + 120_000);
  L.wdunGone(st, 'B', t + 130_000);
  assert.equal(L.wdunEnter(st, 'B', '6,6', t + 140_000).ok, false, 'remains gone: locked out');
  assert.deepEqual(L.wdunCrows(st, t + 140_000), [], 'and the crows go with them');
  const r = L.wdunEnter(st, 'C', '6,6', t + 120_000 + WDUN_RESET_MS);
  assert.deepEqual([r.ok, r.reset], [true, true], 'empty twenty minutes: reset');
  L.wdunEnter(st, 'D', '6,6', t + 120_000 + WDUN_RESET_MS + 5);
  assert.equal(L.wdunEnter(st, 'E', '6,6', t + 120_000 + WDUN_RESET_MS + 9).reset, false, 'never while someone is in it');
  const s2 = L.wdunEmpty();
  L.wdunEnter(s2, 'Z', '1,1', t);
  L.wdunPrune(s2, t + WDUN_STALE_MS + 1);
  assert.equal(s2.inside['1,1'], undefined, 'a silent occupant lapses');
  assert.equal(s2.empty['1,1'], t, 'and the hall counts empty from their last word');
});

const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const ON = { x: PX * PIXEL_UNITS + 16384, y: 0, z: (499 - PY) * PIXEL_UNITS + 16384, yaw: 0, pitch: 0 };
const item = (n) => ({ templateIndex: 100 + n, group: 'Armor', stackCount: 1 });

test('PVPDUNGEONS relay: the hub keeps the halls - day, locks, the reset wipes the room, crows to all; no party member takes a friend\'s remains', async () => {
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const hub = world.room(SOCIAL_ROOM);
    const join = async (n) => { const ws = hub.connect(); await hub.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-${n}` }); clock += 700; return ws; };
    const a = await join('a'), b = await join('b'), c = await join('c');
    const wd = (ws, o) => hub.raw(ws, JSON.stringify({ t: 'wdun', ...o }));
    const got = (ws, k) => ws.sent.filter((m) => m.t === 'wdun' && (!k || m.k === k));
    await wd(a, { k: 'hi' });
    const st = got(a, 'st').at(-1);
    assert.ok(validWdunOut(st), 'the client\'s door takes it');
    assert.equal(st.day, Math.floor(clock / WDUN_DAY_MS), 'the day is the relay\'s clock');

    // a's way in and out: the hour's lock
    await wd(a, { k: 'in', h: '512,88' }); clock += 700;
    assert.deepEqual(got(a, 'ok').at(-1), { t: 'wdun', k: 'ok', h: '512,88', ep: 0 });
    await wd(a, { k: 'out', h: '512,88' }); clock += 700;
    assert.equal(got(a, 'lk').at(-1).left, WDUN_LOCK_MS);
    await wd(a, { k: 'in', h: '512,88' }); clock += 700;
    assert.equal(got(a, 'no').at(-1).h, '512,88', 'locked out for the hour');

    // the hall's world room keeps a world; standing empty twenty minutes, the next one in finds it wiped
    const dun = world.room(wdunRoomKey('512,88'));
    dun.store.set('world:snap', { foes: [1, 2, 3] });
    clock += WDUN_RESET_MS + 1000;
    await wd(b, { k: 'in', h: '512,88' }); clock += 700;
    assert.equal(got(b, 'ok').length, 1);
    assert.equal(dun.store.get('world:snap'), undefined, 'reset: the hall as it was never touched');
    assert.equal(got(b, 'ok').at(-1).ep, 1, 'a new epoch: its chests full again for everyone');

    // b falls inside: the crows are told to everyone online, and b's way back stays open while the remains lie there
    await wd(b, { k: 'die', h: '512,88' }); clock += 700;
    const cr = got(c, 'cr').at(-1);
    assert.equal(cr.crows[0][0], '512,88', 'everyone hears the crows');
    await wd(b, { k: 'in', h: '512,88' }); clock += 700;
    assert.equal(got(b, 'ok').length, 2, 'the way back to my remains');

    // a party: a and c; c may not take from a's remains in a cell, b (a stranger) may
    await hub.raw(a, JSON.stringify({ t: 'social', k: 'party.invite', peer: 'peer-c' })); clock += 700;
    const pid = c.sent.filter((m) => m.t === 'social' && m.k === 'invite').at(-1)?.party;
    assert.ok(pid, 'an invite');
    await hub.raw(c, JSON.stringify({ t: 'social', k: 'party.accept', party: pid })); clock += 700;
    const cell = world.room(CELL);
    const ca = cell.connect(), cc = cell.connect(), cb = cell.connect();
    await cell.hello(ca, 'peer-a', ON, { name: 'a', tokenSub: 'acct-a' });
    await cell.hello(cc, 'peer-c', ON, { name: 'c', tokenSub: 'acct-c' });
    await cell.hello(cb, 'peer-b', ON, { name: 'b', tokenSub: 'acct-b' });
    const say = (ws, data) => cell.raw(ws, JSON.stringify({ t: 'wild', data }));
    // PIN MOVED (INT9, 2026-10-09 - bible/06-Systems/Integrity-Arc.md lane 2): a deposit is kept only on the account
    // service's order over its records (test/int9_wild_ref.test.js) - the order minted here with the room's own key
    const R = '0123456789ab', dep = [item(1), item(2)];
    const o = await mintRemainsOrder({ s: 'acct-a', wr: R, wh: await remainsDigest(dep, { subtle: globalThis.crypto.subtle }), wn: 2, wm: CELL }, (await cell.signer()).privateKey, { subtle: globalThis.crypto.subtle, nowS: Math.floor(clock / 1000) });
    await say(ca, { k: 'fall', r: R, p: [1, 2, 3], items: dep, last: 1, o });
    await say(cc, { k: 'take', r: R, i: 0, n: 1 });
    const party = hub.store.get('acct:acct-c')?.party ?? null;
    if (party) assert.deepEqual(cc.sent.filter((m) => m.t === 'wild' && m.k === 'no').at(-1), { t: 'wild', k: 'no', r: R, i: 0 }, 'a party member is told no');
    await say(cb, { k: 'take', r: R, i: 0, n: 1 });
    assert.equal(cb.sent.filter((m) => m.t === 'wild' && m.k === 'got').length, 1, 'a stranger takes it');
    assert.ok(party, 'the party stood (the kin rule was exercised)');
    // the kin cache is bounded as the relay's caches are (SCALE2b): the stalest pair goes, never the whole cache
    const relay = readFileSync(new URL('../server/src/index.js', import.meta.url), 'utf8');
    assert.doesNotMatch(relay, /this\._wdunKin\.clear\(\)/, 'never the whole cache at once');
    // PIN MOVED (INT9's audit): a hub's silence is kept WDUN_KIN_SILENT_MS alone (its pair is kin meanwhile)
    assert.match(relay, /this\._wdunKin\.delete\(key\);\s*\n\s*if \(this\._wdunKin\.size >= 512\) this\._wdunKin\.delete\(this\._wdunKin\.keys\(\)\.next\(\)\.value\);\s*\n\s*this\._wdunKin\.set\(key, \{ kin, at: heard \? now : now - 60_000 \+ WDUN_KIN_SILENT_MS \}\);/, 'the stalest pair first, and a pair asked again moves to the end');
  } finally { Date.now = realNow; }
});
