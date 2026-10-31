// DRAGON-BUDGET (2026-10-31, the owner: "Do it", of AUDIT DRAGON-CELL II's open D3; bible/11-Multiplayer/Dwarven-Dragon.md
// DRAGON-BUDGET). One account is judged in at most DRAGON_JUDGED_CELLS_MAX cells a watch, on the hub, whatever sockets and
// rooms it opens: a cell room asks the hub before it judges an account in a cell it has not, and hears nothing past the
// count. Pinned: the hub's count; a sweep stopped at it while another account is told; one ask of the hub a cell; a hub
// that fails to answer refuses. tools/mutants/dragonbudget.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Law from '../../../src/net/dragon/dragonLaw.js';
import { SOCIAL_ROOM, DRAGON_INTERNAL_JUDGE } from '../../../src/net/wire.js';
import { siegeRoomKey } from '../../../src/net/siege/siegeRef.js';
import { DRAGON_TELL_DWELL_MS } from '../../../server/src/dragonFights.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { RELAY_KEY, dragonOmenFrom, siteOf, aged } from '../../dragonOmen.mjs';

const OMEN = await dragonOmenFrom(500_000), W = OMEN.w, TT = Law.dragonTimes(OMEN), SITE = siteOf(OMEN);
const posed = (px, py) => { const c = Law.pixelCentreNative(px, py); return { x: c.sx, y: 0, z: c.sz, yaw: 0, pitch: 0 }; };
const omens = (ws) => ws.sent.filter((m) => m.t === 'dragon' && m.k === 'omen').map(({ w, s }) => [w, s]);

async function withWorld(fn, start = TT.landAt + 1000) {
  const realNow = Date.now; let clock = start;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const room = (key) => { const r = world.room(key); r.env.GATE_SIGNING_KEY = RELAY_KEY.pkcs8; return r; };
    const hub = room(SOCIAL_ROOM);
    const judge = (body) => hub.room.fetch(new Request(`https://relay.internal${DRAGON_INTERNAL_JUDGE}`, { method: 'POST', body: JSON.stringify(body) })).then(async (r) => [r.status, (await r.json()).ok]);
    await fn({ room, hub, judge, say: (r, ws, o) => r.raw(ws, JSON.stringify({ t: 'dragon', ...o })), set: (t) => { clock = t; }, now: () => clock });
  } finally { Date.now = realNow; }
}

test('DRAGON-BUDGET the hub: an account\'s cells a watch granted up to DRAGON_JUDGED_CELLS_MAX - a cell granted before granted again, another account and another watch their own - and a watch no longer about forgotten; a word it cannot read refused (mutants: no count; a cell granted twice counted twice; one count for every account)', async () => {
  assert.equal(Law.DRAGON_JUDGED_CELLS_MAX, 24);
  assert.equal(Law.dragonJudgedCell(-1, 33), '-1,2');
  await withWorld(async ({ judge, set }) => {
    for (let i = 0; i < Law.DRAGON_JUDGED_CELLS_MAX; i++) assert.deepEqual(await judge({ w: W, sub: 'acct-a', c: `${i},0` }), [200, true], `cell ${i}`);
    assert.deepEqual(await judge({ w: W, sub: 'acct-a', c: '99,0' }), [200, false], 'one more: refused');
    assert.deepEqual(await judge({ w: W, sub: 'acct-a', c: '3,0' }), [200, true], 'one it has: granted');
    assert.deepEqual(await judge({ w: W, sub: 'acct-b', c: '99,0' }), [200, true], 'another account');
    assert.deepEqual(await judge({ w: W - 1, sub: 'acct-a', c: '99,0' }), [200, true], 'the last watch its own');
    for (const bad of [{ w: W + 5, sub: 'acct-a', c: '1,1' }, { w: W, sub: '', c: '1,1' }, { w: W, sub: 'acct-a', c: 'x' }, { w: W, sub: 'x'.repeat(65), c: '1,1' }]) assert.equal((await judge(bad))[0], 400);
    set((W + 2) * Law.DRAGON_WATCH_MS + 1);
    assert.equal((await judge({ w: W, sub: 'acct-a', c: '99,0' }))[0], 400, 'a watch no longer about');
    assert.deepEqual(await judge({ w: W + 2, sub: 'acct-a', c: '99,0' }), [200, true], 'a new watch, a new count');
  });
});

test('DRAGON-BUDGET a sweep: an account judged in DRAGON_JUDGED_CELLS_MAX cells hears nothing in one more - its dragon\'s cell too, by an `ask` or an `in` - while another account standing there is told; the hub asked once a cell (mutants: the budget unasked; asked of every ask; the `in` unbudgeted)', async () => {
  await withWorld(async ({ room, hub, say, set, now }) => {
    let asked = 0;
    const fetch = hub.room.fetch.bind(hub.room);
    hub.room.fetch = (req) => { if (new URL(req.url).pathname === DRAGON_INTERNAL_JUDGE) asked++; return fetch(req); };
    const b = room(siegeRoomKey(3021, 20)), a = b.connect();
    await b.hello(a, 'peer-0001', posed(SITE.px + 64, SITE.py), { glyphs: ['dev'] });
    for (let i = 1; i <= Law.DRAGON_JUDGED_CELLS_MAX; i++) {
      await b.pose(a, posed(SITE.px + 64 * i, SITE.py));
      await say(b, a, { k: 'ask', w: W });
      set(now() + DRAGON_TELL_DWELL_MS + 1);
      await say(b, a, { k: 'ask', w: W });
      await say(b, a, { k: 'ask', w: W });
    }
    assert.equal(asked, Law.DRAGON_JUDGED_CELLS_MAX, 'the hub asked once a cell');
    assert.equal(omens(a).length, 2 * Law.DRAGON_JUDGED_CELLS_MAX, 'each far cell judged: null');
    await b.pose(a, posed(SITE.px, SITE.py));
    await say(b, a, { k: 'ask', w: W });
    set(now() + DRAGON_TELL_DWELL_MS + 1);
    await say(b, a, { k: 'ask', w: W });
    assert.equal(omens(a).length, 2 * Law.DRAGON_JUDGED_CELLS_MAX, 'one more cell - the dragon\'s: nothing');
    const r = room(siegeRoomKey(3021, 20)), c = r.connect();
    await r.hello(c, 'peer-0002', posed(SITE.px, SITE.py), { glyphs: ['dev'] });
    await say(r, c, { k: 'ask', w: W });
    set(now() + DRAGON_TELL_DWELL_MS + 1);
    await say(r, c, { k: 'ask', w: W });
    assert.deepEqual(omens(c), [[W, OMEN.s]], 'another account: told');
  }, Law.dragonQuietAt(W));
  // the `in` from a cell room, its account past its count
  await withWorld(async ({ room, judge, say, set, now }) => {
    for (let i = 0; i < Law.DRAGON_JUDGED_CELLS_MAX; i++) await judge({ w: W, sub: 'acct-peer-0001', c: `${900 + i},0` });
    const r = aged(room(`world:${Math.floor(SITE.px / 16)},${Math.floor(SITE.py / 16)}`)), a = r.connect();
    await r.hello(a, 'peer-0001', posed(SITE.px, SITE.py));
    await say(r, a, { k: 'in', w: W, bv: Law.DRAGON_BRAIN_V, lv: 20, sx: SITE.sx, sz: SITE.sz });
    assert.deepEqual([a.sent.filter((m) => m.t === 'dragon'), r.room._dg?.fights?.size ?? 0], [[], 0], 'past its count: an `in` hears nothing, no fight');
  });
});

test('DRAGON-BUDGET a hub that fails to answer refuses: nothing told, and the cell asked again at the next ask (mutants: a failed answer granted)', async () => {
  await withWorld(async ({ room, hub, say, set, now }) => {
    const fetch = hub.room.fetch.bind(hub.room);
    let down = true;
    hub.room.fetch = (req) => (down && new URL(req.url).pathname === DRAGON_INTERNAL_JUDGE ? Promise.reject(new Error('hub down')) : fetch(req));
    const r = aged(room(`world:${Math.floor(SITE.px / 16)},${Math.floor(SITE.py / 16)}`)), a = r.connect();
    await r.hello(a, 'peer-0001', posed(SITE.px, SITE.py));
    const warn = console.warn; console.warn = () => {};
    try { await say(r, a, { k: 'ask', w: W }); } finally { console.warn = warn; }
    assert.deepEqual(omens(a), [], 'down: nothing');
    down = false;
    await say(r, a, { k: 'ask', w: W });
    assert.deepEqual(omens(a), [[W, OMEN.s]], 'up again: told');
  });
});
