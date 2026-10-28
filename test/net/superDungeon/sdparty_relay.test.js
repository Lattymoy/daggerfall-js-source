// SD-PARTY (2026-10-28, the owner: "we need to make this a party instance ... to stop griefin on the bosses";
// bible/11-Multiplayer/Super-Dungeons.md SD-PARTY): EACH PARTY ITS OWN SHATTERED HOUR. A realm is `sd:<s>.<owner>`, and
// its door admits the owner, staff and the owner's party alone - the hub's party word, through the real Room and hub.
// One life and one win a Hollow hold across every copy: a death in one copy, or a receipt for the slot, shuts the rest.
// And the page picks its party's copy (scenes/superDungeon/sdCopy.js).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRooms } from '../../fakeRoom.mjs';
import { SD_KEY, SD_INTERNAL_FELL, SOCIAL_ROOM, PIXEL_UNITS, worldRoom, chatRegionRoom, sdReceiptKey } from '../../../src/net/wire.js';
import { sdRoomKey, isSdRoom, SD_NO_FALLEN } from '../../../src/net/superDungeon/sdLaw.js';
import { SD_ARENA, realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { PIXEL_M } from '../../../src/net/gate/gateLaw.js';
import { instanceOwnerOf } from '../../../src/net/instanceRoom.js';
import { SD_NO_PARTY, SD_NO_WON, SD_INTERNAL_ACCT, sdAcctKey, sdCopyRight, validSdAcct } from '../../../server/src/sdCopy.js';
import { sdCopyChoice, createSdCopy, SD_COPY_KEY } from '../../../src/scenes/superDungeon/sdCopy.js';

const T0 = 1_800_000_000_000;
const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArena = (x = 0, z = -10, extra = {}) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0, ...extra }; };
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const reason = (ws) => ws.closed?.reason ?? null;

/** A found Hollow (slot 1) and the hub that holds it - SD12's own rig, no party stood in for anyone. */
async function withHollow(fn, vars = {}) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock, vars });
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
      assert.equal(hub.store.get(SD_KEY).ph, 'found');
      /** The copy of account `owner`'s party, past its Orrery. */
      const copy = async (owner) => {
        const r = world.room(/** @type {string} */ (sdRoomKey(rec.s, await instanceOwnerOf(owner))));
        const h = await r.room._sdHallOf(rec.s); h.ok = true; await r.room.state.storage.put('sdorrery', h);
        return r;
      };
      const hello = async (room, id, over = {}) => { const ws = room.connect(); await room.hello(ws, id, inArena(0, -12), { name: id.replace('peer-', ''), ...over }); return ws; };
      /** `members` one party in the hub, its leader the first. */
      const party = async (members) => {
        await hub.room._putParty({ id: 'pt1', leader: members[0], members: [...members], away: {} });
        for (const m of members) await hub.room._putAcct(m, { ...((await hub.room._acct(m)) ?? {}), party: 'pt1' });
      };
      await fn({ world, hub, rec, copy, hello, party, step: (ms) => { clock += ms; } });
    });
  } finally { Date.now = realNow; }
}

test('SD-PARTY THE KEY: a realm is a party\'s own, `sd:<s>.<owner>` - the one shared `sd:<s>` is no room; the Worker mints no object for it (mutants: the bare key a realm)', async () => {
  const O = await instanceOwnerOf('acct-peer-ann');
  assert.equal(sdRoomKey(3, O), `sd:3.${O}`);
  assert.equal(isSdRoom('sd:3'), false, 'the shared Hour is gone');
  assert.equal(sdRoomKey(3, null), null);
  const worker = (await import('../../../server/src/index.js')).default;
  const res = await worker.fetch(new Request('https://relay.test/room/sd:3', { headers: { Upgrade: 'websocket' } }), { ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('{}') }) } });
  assert.equal(res.status, 404, 'no object for the shared key');
});

test('SD-PARTY THE DOOR: a party\'s Hour admits its owner, staff, and a member of the owner\'s party the hub names - a stranger is refused in words; the hub silent is busy (mutants: the owner unasked; staff refused; the party never asked)', async () => {
  const O = await instanceOwnerOf('acct-peer-ann');
  const key = /** @type {string} */ (sdRoomKey(1, O));
  assert.equal(await sdCopyRight(key, 'acct-peer-ann', false, async () => false), null, 'the owner');
  assert.equal(await sdCopyRight(key, 'acct-peer-zed', true, async () => false), null, 'staff');
  assert.equal(await sdCopyRight(key, 'acct-peer-bo', false, async () => true), null, 'the owner\'s party');
  assert.equal(await sdCopyRight(key, 'acct-peer-cy', false, async () => false), SD_NO_PARTY, 'a stranger');
  assert.equal(await sdCopyRight(key, 'acct-peer-cy', false, async () => null), 'busy', 'the hub silent');
  assert.equal(await sdCopyRight(key, null, false, async () => true), SD_NO_PARTY, 'no account');
  await withHollow(async ({ copy, hello, party }) => {
    const ann = await copy('acct-peer-ann');
    const a = await hello(ann, 'peer-ann');
    assert.equal(a.closed, null, 'the owner comes in');
    const cy = await hello(ann, 'peer-cy');
    assert.equal(reason(cy), SD_NO_PARTY, 'a stranger is refused - the griefer stands in no other party\'s fight');
    const staff = await hello(ann, 'peer-zed', { glyphs: ['dev'] });
    assert.equal(staff.closed, null, 'staff stand in any party\'s Hour');
    await party(['acct-peer-ann', 'acct-peer-bo']);
    const bo = await hello(ann, 'peer-bo');
    assert.equal(bo.closed, null, 'the owner\'s party comes in');
  });
});

test('SD-PARTY ONE LIFE A HOLLOW, ACROSS THE COPIES: a death in one party\'s Hour is kept by the hub, and no other copy takes that account - raised by a friend, it is free again (mutants: the death untold; the rise untold; the hub unasked)', async () => {
  await withHollow(async ({ hub, rec, copy, hello, party }) => {
    const ann = await copy('acct-peer-ann'), bo = await copy('acct-peer-bo');
    await party(['acct-peer-bo', 'acct-peer-ann']);
    const a = await hello(ann, 'peer-ann');
    assert.equal(a.closed, null, 'its own copy');
    await ann.raw(a, JSON.stringify({ t: 'pose', p: inArena(0, -12, { dd: 1 }) }));
    await new Promise((ok) => setImmediate(ok));
    assert.deepEqual(hub.store.get(sdAcctKey('acct-peer-ann')), { s: rec.s, d: 1 }, 'the hub keeps the death');
    const again = await hello(bo, 'peer-ann');
    assert.equal(reason(again), SD_NO_FALLEN, 'its party\'s other copy will not take it - one life a Hollow');
    const up = await hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_ACCT}`, { method: 'POST', body: JSON.stringify({ s: rec.s, a: 'acct-peer-ann', op: 'up' }) }));
    assert.equal(up.status, 200);
    assert.equal(hub.store.get(sdAcctKey('acct-peer-ann')), undefined, 'raised: the mark cleared');
    const back = await hello(bo, 'peer-ann');
    assert.equal(back.closed, null, 'and in');
  });
});

test('SD-PARTY ONE WIN A HOLLOW: an account holding this slot\'s receipt is refused by every copy it is new to - one party\'s kill pays it once (mutants: the receipt unread; another slot\'s receipt refusing)', async () => {
  await withHollow(async ({ hub, rec, copy, hello }) => {
    const bo = await copy('acct-peer-bo');
    await hub.room.state.storage.put(sdReceiptKey('acct-peer-bo'), { s: rec.s, r: 'x' });
    const b = await hello(bo, 'peer-bo');
    assert.equal(reason(b), SD_NO_WON, 'broken once already');
    await hub.room.state.storage.put(sdReceiptKey('acct-peer-bo'), { s: rec.s - 1 || 999, r: 'x' });
    const b2 = await hello(bo, 'peer-bo');
    assert.equal(b2.closed, null, 'another Hollow\'s receipt is no bar');
  });
});

test('SD-PARTY THE HUB\'S DOOR: a realm\'s word is its slot, an account and may/down/up - anything else refused; a word for a slot the hub does not hold keeps nothing (mutants: a bad op believed)', () => {
  assert.deepEqual(validSdAcct({ s: 4, a: 'acct-peer-ann', op: 'down' }), { s: 4, a: 'acct-peer-ann', op: 'down' });
  for (const bad of [null, [], { s: 0, a: 'acct-peer-ann', op: 'may' }, { s: 4, a: 'x', op: 'may' }, { s: 4, a: 'acct-peer-ann', op: 'kill' }]) assert.equal(validSdAcct(bad), null, JSON.stringify(bad));
});

test('SD-PARTY THE PAGE PICKS ITS PARTY\'S HOUR: the kept copy while it is this slot\'s, mine, my party unchanged and its owner still in it; else the leader\'s; alone, mine (mutants: the kept copy never read; a new party kept in the old one)', async () => {
  const me = 'acct-peer-ann', ld = 'acct-peer-bo';
  const D = await instanceOwnerOf(ld);
  assert.deepEqual(sdCopyChoice(1, me, null, null, []), { captain: me }, 'alone: my own');
  assert.deepEqual(sdCopyChoice(1, me, ld, null, [D]), { captain: ld }, 'in a party: the leader\'s');
  const kept = { s: 1, a: me, o: D, p: 'pt1' };
  assert.deepEqual(sdCopyChoice(1, me, me, kept, [D], 'pt1'), { owner: D }, 'the copy I went into, the lead handed on');
  assert.deepEqual(sdCopyChoice(2, me, me, kept, [D], 'pt1'), { captain: me }, 'another Hollow');
  assert.deepEqual(sdCopyChoice(1, me, me, kept, [D], 'pt2'), { captain: me }, 'another party');
  assert.deepEqual(sdCopyChoice(1, me, me, kept, [], 'pt1'), { captain: me }, 'its owner gone from the party');
  const store = new Map();
  const c = createSdCopy({ social: () => ({ acct: me, party: { id: 'pt1', leader: ld, members: [{ acct: me }, { acct: ld }] } }), store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) } });
  assert.equal(await c.ownerFor(1), D);
  assert.deepEqual(store.get(SD_COPY_KEY), { s: 1, a: me, o: D, p: 'pt1' }, 'kept on the device');
  assert.equal(await createSdCopy({ social: () => null }).ownerFor(1), null, 'no account, no Hour');
});

test('SD-PARTY A PARTY\'S WIN CLOSES ITS OWN HOUR: told a copy\'s kill, the hub keeps the record found - the Hollow stands for every other party until it fades; the hub\'s `sdCollapse` on, the first kill collapses it for all, as before (mutants: the setting unread)', async () => {
  for (const [vars, ph] of [[{}, 'found'], [{ SD_COLLAPSE: 'on' }, 'fell']]) {
    await withHollow(async ({ hub, rec, step }) => {
      step(60_000);
      const res = await hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ s: rec.s, at: Date.now(), top: 'Ann', n: 2, rc: [], here: [] }) }));
      assert.equal(res.status, 200);
      assert.equal(hub.store.get(SD_KEY).ph, ph, JSON.stringify(vars));
    }, vars);
  }
});
