// SD-PARTY (2026-10-28, as the owner asked;
// bible/11-Multiplayer/Super-Dungeons.md SD-PARTY): EACH PARTY ITS OWN SHATTERED HOUR. A realm is `sd:<s>.<owner>`, and
// its door admits the owner, staff and the owner's party alone - the hub's party word, through the real Room and hub.
// One life and one win a Hollow hold across every copy: a death in one copy, or a receipt for the slot, shuts the rest.
// And the page picks its party's copy (scenes/superDungeon/sdCopy.js). SD-BACK: a death keeps its own copy open to it.
// SD-SOLO: a player in no party goes to a shared Hour of SD_PUB_SEATS, the Worker's walk finding it; the entry line says
// whose Hour it is or how many share it. SD-WON: a won copy takes nobody back once its kill's collapse has run.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRooms } from '../../fakeRoom.mjs';
import { SD_KEY, SD_INTERNAL_FELL, SOCIAL_ROOM, PIXEL_UNITS, worldRoom, chatRegionRoom, sdReceiptKey } from '../../../src/net/wire.js';
import { sdRoomKey, isSdRoom, SD_NO_FALLEN, SD_NO_FULL, SD_NO_CLOSED, SD_PUB_SEATS, SD_PUB_MAX, SD_COLLAPSE_MS, sdPubOwner, isSdPubOwner } from '../../../src/net/superDungeon/sdLaw.js';
import { SD_ARENA, realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { PIXEL_M } from '../../../src/net/gate/gateLaw.js';
import { instanceOwnerOf } from '../../../src/net/instanceRoom.js';
import { SD_NO_PARTY, SD_NO_WON, SD_INTERNAL_ACCT, sdAcctKey, sdCopyRight, validSdAcct, sdOpenDoor, SD_INTERNAL_SEATS } from '../../../server/src/sdCopy.js';
import { sdCopyChoice, createSdCopy, SD_COPY_KEY, sdCopyLine, sdRelayHttp } from '../../../src/scenes/superDungeon/sdCopy.js';

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

test('SD-BACK A DEATH KEEPS ITS OWN COPY: the hub keeps a death with the copy it was in - that copy takes the dead back, as often as it dies; no other copy takes it (mutants: the death untold; the copy unkept; the own copy refusing; another copy admitting)', async () => {
  await withHollow(async ({ hub, rec, copy, hello, party, step }) => {
    const ann = await copy('acct-peer-ann'), bo = await copy('acct-peer-bo');
    await party(['acct-peer-bo', 'acct-peer-ann']);
    const a = await hello(ann, 'peer-ann');
    assert.equal(a.closed, null, 'its own copy');
    await ann.raw(a, JSON.stringify({ t: 'pose', p: inArena(0, -12, { dd: 1 }) }));
    await new Promise((ok) => setImmediate(ok));
    const O = await instanceOwnerOf('acct-peer-ann');
    assert.deepEqual(hub.store.get(sdAcctKey('acct-peer-ann')), { s: rec.s, d: 1, o: O }, 'the hub keeps the death, and its copy');
    const again = await hello(bo, 'peer-ann');
    assert.equal(reason(again), SD_NO_FALLEN, 'another copy will not take it');
    step(120_000);
    const back = await hello(ann, 'peer-ann');
    assert.equal(back.closed, null, 'its own copy takes it back');
    await ann.raw(back, JSON.stringify({ t: 'pose', p: inArena(0, -12, { dd: 1 }) }));
    await new Promise((ok) => setImmediate(ok));
    assert.deepEqual(hub.store.get(sdAcctKey('acct-peer-ann')), { s: rec.s, d: 1, o: O }, 'a second death keeps the first copy');
    assert.equal((await hello(ann, 'peer-ann')).closed, null, 'and back again');
    assert.equal(reason(await hello(bo, 'peer-ann')), SD_NO_FALLEN, 'still no other');
    // the hub's own word, asked as a realm asks it: a later death elsewhere (staff stand anywhere) keeps the first copy
    const ask = async (body) => (await hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_ACCT}`, { method: 'POST', body: JSON.stringify({ s: rec.s, a: 'acct-peer-ann', ...body }) }))).json();
    const B = await instanceOwnerOf('acct-peer-bo');
    await ask({ op: 'down', o: B });
    assert.equal(hub.store.get(sdAcctKey('acct-peer-ann')).o, O, 'the first copy kept');
    assert.deepEqual([await ask({ op: 'may', o: O }), await ask({ op: 'may', o: B })], [{ ok: true }, { ok: true, w: 'down' }], 'its own copy may take it - a seat it lost - and no other');
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

test('SD-PARTY THE HUB\'S DOOR: a realm\'s word is its slot, an account, may or down, and its copy\'s owner - anything else refused (mutants: a bad op believed; the owner unread)', () => {
  const o = '0123456789abcdef';
  assert.deepEqual(validSdAcct({ s: 4, a: 'acct-peer-ann', op: 'down', o }), { s: 4, a: 'acct-peer-ann', op: 'down', o });   // PIN MOVED (SD-BACK): and the copy
  assert.deepEqual(validSdAcct({ s: 4, a: 'acct-peer-ann', op: 'may', o: 'p3' }), { s: 4, a: 'acct-peer-ann', op: 'may', o: 'p3' }, 'a shared Hour');
  for (const bad of [null, [], { s: 0, a: 'acct-peer-ann', op: 'may', o }, { s: 4, a: 'x', op: 'may', o }, { s: 4, a: 'acct-peer-ann', op: 'kill', o }, { s: 4, a: 'acct-peer-ann', op: 'up', o }, { s: 4, a: 'acct-peer-ann', op: 'may' }, { s: 4, a: 'acct-peer-ann', op: 'may', o: 'p99' }]) assert.equal(validSdAcct(bad), null, JSON.stringify(bad));
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
  // PIN MOVED (SD-SOLO): alone, the relay's walk names the shared Hour; no answer, my own
  const asked = [];
  const solo = (n, party = null) => createSdCopy({ social: () => ({ acct: me, party }), relay: () => 'wss://relay.test/', fetchImpl: async (u) => { asked.push(String(u)); return new Response(JSON.stringify({ n })); } });
  const M = await instanceOwnerOf(me);
  assert.equal(await solo(3).ownerFor(1), 'p3', 'the walk\'s Hour');
  assert.deepEqual(asked, [`https://relay.test/sd/open?s=1&o=${M}`]);
  assert.equal(await solo(3, { id: 'pt9', leader: me, members: [{ acct: me }] }).ownerFor(1), 'p3', 'a party of one is alone');
  assert.equal(await solo(null).ownerFor(1), M, 'none open: my own');
  assert.equal(await createSdCopy({ social: () => ({ acct: me }), relay: () => 'wss://r.test', fetchImpl: async () => { throw new Error('down'); } }).ownerFor(1), M, 'the relay silent: my own');
  assert.equal(await createSdCopy({ social: () => ({ acct: me }) }).ownerFor(1), M, 'no relay: my own');
  assert.deepEqual([sdRelayHttp('wss://a.b/'), sdRelayHttp('ws://localhost:8787'), sdRelayHttp('ftp://x'), sdRelayHttp(null)], ['https://a.b', 'http://localhost:8787', null, null]);
});

test('SD-SOLO A SHARED HOUR: `sd:<s>.p<n>` admits anyone in no party to SD_PUB_SEATS - its seats its first SD_PUB_SEATS\', never freed; one of them comes back, the next newcomer is refused (mutants: the stranger refused; the seats the realm\'s; a seat freed)', async () => {
  assert.deepEqual([SD_PUB_SEATS, sdPubOwner(0), sdPubOwner(SD_PUB_MAX - 1), sdPubOwner(SD_PUB_MAX), sdPubOwner(-1), isSdPubOwner('p01'), isSdPubOwner('p7')], [40, 'p0', `p${SD_PUB_MAX - 1}`, null, null, false, true]);
  assert.equal(sdRoomKey(2, 'p5'), 'sd:2.p5');
  assert.equal(isSdRoom(`sd:2.p${SD_PUB_MAX}`), false, 'past the last shared Hour, no room');
  assert.equal(await sdCopyRight('sd:2.p5', 'acct-peer-cy', false, async () => false), null, 'a shared Hour\'s door is its seats\'');
  await withHollow(async ({ world, rec, hello, step }) => {
    const pub = world.room(/** @type {string} */ (sdRoomKey(rec.s, 'p0')));
    const h = await pub.room._sdHallOf(rec.s); h.ok = true; await pub.room.state.storage.put('sdorrery', h);
    const ws = [];
    for (let i = 0; i < SD_PUB_SEATS; i++) { ws.push(await hello(pub, `peer-s${i}`, { kind: 'linked' })); step(1000); }   // signed in, a beat apart - the hello's own gates are not this law's
    assert.deepEqual(ws.map((w) => w.closed), Array(SD_PUB_SEATS).fill(null), 'every seat a stranger\'s');   // PIN MOVED (SD-SOLO-40, 2026-10-28, as the owner asked): 40 seats, it was eight
    await pub.drop(ws[0]);
    assert.equal(reason(await hello(pub, 'peer-s99', { kind: 'linked' })), SD_NO_FULL, 'the next refused - a gone one\'s seat stays its');
    assert.equal((await hello(pub, 'peer-s0', { kind: 'linked' })).closed, null, 'its own comes back');
    const seats = async (o) => (await pub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_SEATS}`, { method: 'POST', body: JSON.stringify({ s: rec.s, o }) }))).json();
    assert.deepEqual(await seats(await instanceOwnerOf('acct-peer-s3')), { ok: true, has: true, open: false }, 'the walk\'s answer: full, and holds s3');
    assert.deepEqual(await seats(await instanceOwnerOf('acct-peer-zz')), { ok: true, has: false, open: false });
  });
});

test('SD-SOLO THE WORKER\'S WALK: the first shared Hour that holds me, else the first open - in order, so the one I am in comes first; a silent one ends it (mutants: the open passed over; the holder passed over; the walk unbounded)', async () => {
  const me = '0123456789abcdef';
  const walk = async (rooms) => {
    const asked = [];
    const env = { ROOMS: { idFromName: (n) => n, get: (n) => ({ fetch: async () => { asked.push(n); const r = rooms[asked.length - 1]; return r ? new Response(JSON.stringify(r)) : new Response('{}', { status: 503 }); } }) } };
    const res = await sdOpenDoor(env, new URL(`https://relay.test/sd/open?s=4&o=${me}`));
    return [(await res.json()).n, asked];
  };
  assert.deepEqual(await walk([{ ok: true, has: false, open: true }]), [0, ['sd:4.p0']]);
  assert.deepEqual(await walk([{ has: false, open: false }, { has: false, open: false }, { has: false, open: true }]), [2, ['sd:4.p0', 'sd:4.p1', 'sd:4.p2']], 'past the full and the won');
  assert.deepEqual((await walk([{ has: false, open: false }, { has: true, open: false }]))[0], 1, 'the one that holds me, full or not');
  assert.deepEqual((await walk([{ has: false, open: false }]))[0], null, 'a silent room ends the walk');
  assert.deepEqual((await walk(Array(SD_PUB_MAX + 5).fill({ has: false, open: false })))[1].length, SD_PUB_MAX, 'bounded');
  const bad = await sdOpenDoor({ ROOMS: { idFromName: (n) => n, get: () => ({}) } }, new URL('https://relay.test/sd/open?s=4&o=p1'));
  assert.equal(bad.status, 400, 'a digest, never a shared owner');
  const worker = (await import('../../../server/src/index.js')).default;
  const res = await worker.fetch(new Request(`https://relay.test/sd/open?s=4&o=${me}`), { ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response(JSON.stringify({ has: false, open: true })) }) } });
  assert.deepEqual([res.status, (await res.json()).n, res.headers.get('access-control-allow-origin')], [200, 0, '*'], 'the Worker\'s door');
});

test('SD-SOLO THE ENTRY LINE: a party\'s Hour says only the party enters it; a shared one, how many are in it of SD_PUB_SEATS (mutants: the count unsaid; the party\'s said as shared)', () => {
  assert.equal(sdCopyLine('0123456789abcdef', 3), 'Only your party can enter this Hour.');
  assert.equal(sdCopyLine('p2', 3), '3 of 40 players are in this shared Hour.');
  assert.equal(sdCopyLine('p2', 0), '1 of 40 players are in this shared Hour.', 'me counted');
  assert.equal(sdCopyLine(null, 3), null);
});

test('SD-WON A WON COPY TAKES NOBODY BACK: once its kill\'s collapse has run, one who was in it is refused at its door; before, back as before (mutants: a returner always let in; refused at once)', async () => {
  await withHollow(async ({ copy, hello, step }) => {
    const ann = await copy('acct-peer-ann');
    assert.equal((await hello(ann, 'peer-ann')).closed, null);
    const at = Date.now();
    ann.room._sdFightOf = async () => ({ fell: { at, top: [], n: 1 }, players: {} });
    step(SD_COLLAPSE_MS - 1000);
    assert.equal((await hello(ann, 'peer-ann')).closed, null, 'inside the collapse: back');
    step(2000);
    assert.equal(reason(await hello(ann, 'peer-ann')), SD_NO_CLOSED, 'past it: closed for them');
  });
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
