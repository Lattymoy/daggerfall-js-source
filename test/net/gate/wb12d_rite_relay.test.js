// WB12d (2026-10-01, Mac: "faithful and a Summoner"): THE FAITHFUL'S RITE ON THE RELAY - the circle's cell keeps who
// struck the faithful and tells the hub when the Summoner falls; the hub says the broken rite to everyone online, at
// every hello and to the channel; the breach's room asks it for the day's helpers at the kill - a fighter's receipt
// carries `r`, one who broke it alone is minted a receipt of the rite alone (bible/11-Multiplayer/World-Bosses.md
// section 19 D). AUDIT WB12d: each circle kept on its own at the cell and the hub, the hub standing by the gate's agreed
// site; one tell in flight, its retry armed before it goes and let go when the breach collapses; one fall at a time,
// the helpers asked ahead of it; a deeper bucket than the client's, and a word in the rite's last moment still heard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riteNativeOf, RITE_REACH_M, RITE_UNITS_PER_M, RITE_HELPERS_MAX, RITE_GRACE_MS } from '../../../src/net/gate/gateRite.js';
import { gateTimes, gateRoomKey, GATE_COLLAPSE_MS } from '../../../src/net/gate/gateLaw.js';
import { BRAIN_TICK_MS, HIT_KINDS, COURT_CENTRE } from '../../../src/net/gate/gateBrain.js';
import { readReceipt } from '../../../src/net/gate/gateReceipt.js';
import { HERALD_RETRY_MS } from '../../../src/net/gate/gateHerald.js';
import { worldRoom, SOCIAL_ROOM, RITE_KEY, GATE_BRAIN_V, gateReceiptKey, RITE_TELL_RETRY_MS, RITE_INTERNAL_BROKEN, RITE_INTERNAL_DAY, RITE_HZ_MAX, RITE_RELAY_BURST, RITE_CIRCLES_MAX, RITE_HUB_CIRCLES_MAX, GATE_INTERNAL_FELL, RITE_BY_MAX } from '../../../src/net/wire.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { cardOf, cardWords } from '../../heraldCards.mjs';   // HERALD-CARDS: a post read as its card

const DAY = 200;
const TT = gateTimes(DAY);
const PX = 300, PY = 200;
const CELL = worldRoom(PX, PY);
const poseAt = (day = DAY, px = PX, py = PY, east = 3) => { const [x, z] = riteNativeOf(day, px, py); return { x: x + east * RITE_UNITS_PER_M, y: 0, z, yaw: 0, pitch: 0 }; };
const AT = poseAt();
const FAR = poseAt(DAY, PX, PY, RITE_REACH_M + 5);
const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';
const court = (x, z) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
const rites = (ws) => ws.sent.filter((m) => m.t === 'rite');
const circle = (led, px = PX, py = PY) => led?.c?.[`${px},${py}`] ?? null;
const quiet = (fn) => { const warn = console.warn; console.warn = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; }); };
const settle = () => new Promise((r) => setImmediate(r));

async function withRite(fn, { start = TT.omenAt + 60_000 } = {}) {
  const realNow = Date.now, realFetch = globalThis.fetch;
  let clock = start;
  Date.now = () => clock;
  const posts = [];
  const net = { discordUp: true };
  globalThis.fetch = async (url, init) => { if (!net.discordUp) return { ok: false, status: 500 }; posts.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 204 }; };
  const world = fakeRooms({ now: () => clock });
  const cell = world.room(CELL), hub = world.room(SOCIAL_ROOM);
  const say = (ws, o = {}, room = cell) => room.raw(ws, JSON.stringify({ t: 'rite', d: DAY, px: PX, py: PY, s: 0, f: 0, ...o }));
  const at = async (id, pose = AT, room = cell) => { const ws = room.connect(); await room.hello(ws, id, pose); clock += 1000; return ws; };
  const door = (path, body) => hub.room.fetch(new Request(`https://relay.internal${path}`, { method: 'POST', body: JSON.stringify(body) })).then((r) => r.json());
  // the hub's door to the cells, answered as `answer(req)` says (a Response, or undefined for the hub's own)
  const hubAnswers = (answer) => { const get = world.ROOMS.get; world.ROOMS.get = (id) => { const o = get(id); return id === SOCIAL_ROOM ? { fetch: async (req) => (await answer(req)) ?? o.fetch(req) } : o; }; return () => { world.ROOMS.get = get; }; };
  const hubDown = () => hubAnswers(async () => new Response('no', { status: 503 }));
  // a hub account that says where the gate stands (DISCORD-GATES' site word)
  const siteBy = async (n, px = PX, py = PY, pl = 'Copperham') => { const ws = hub.connect(); await hub.hello(ws, `peer-s${n}`, null, { name: `s${n}`, acct: `acct-s${n}`, asecret: `secret-of-acct-s${n}` }); await hub.raw(ws, JSON.stringify({ t: 'gate', k: 'site', d: DAY, px, py, pl })); return ws; };
  try { await quiet(() => fn({ world, cell, hub, say, at, door, posts, net, hubAnswers, hubDown, siteBy, now: () => clock, set: (t) => { clock = t; }, step: (ms) => { clock += ms; } })); }
  finally { Date.now = realNow; globalThis.fetch = realFetch; }
}

/** A breach's room at the kill: fighters in, the Warden a blow from falling. */
async function courtOf({ world, set }, ids = ['peer-0001', 'peer-0002']) {
  set(TT.openAt + 1000);
  const r = world.room(gateRoomKey(DAY));
  const tick = async (n = 1) => { for (let i = 0; i < n; i++) { set(Date.now() + BRAIN_TICK_MS); if (r.alarm.at != null && Date.now() >= r.alarm.at) await r.fire(); } };
  const gsay = (ws, o) => r.raw(ws, JSON.stringify({ t: 'gate', ...o }));
  const fighters = [];
  for (const [i, id] of ids.entries()) { const ws = r.connect(); await r.hello(ws, id, court(2 * i, 3)); await gsay(ws, { k: 'in', lv: 10 + i, bv: GATE_BRAIN_V }); fighters.push(ws); }
  await tick(2); await settle();
  for (const id of ids) r.room._fight.players[`acct-${id}`].stoodMs = 1e9;
  r.room._fight.hp = 1;
  const mine = (ws) => readReceipt(ws.sent.find((m) => m.t === 'gate' && m.k === 'rcpt')?.r);
  const kill = (ws = fighters[0]) => gsay(ws, { k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell });
  return { r, tick, gsay, fighters, mine, kill };
}

test('WB12d relay: the cell keeps who struck the faithful - from a pose at the circle, inside the window (and RITE_GRACE_MS past it), by the verified account; a word from past its reach, before the omen or after the grace, from one who never struck, or said in another cell keeps no one; RITE_HELPERS_MAX at most (mutants: the pose unasked; the window unasked; no grace; the cell unasked; an unstruck word paid; the helpers unbounded)', async () => {
  await withRite(async ({ world, cell, say, at, set }) => {
    const a = await at('peer-0001');
    await say(a, { s: 0 });
    assert.equal(cell.store.get(RITE_KEY)?.c?.[`${PX},${PY}`]?.h ?? null, null, 'never struck: no one kept');
    await say(a, { s: 0, f: 1 });
    assert.deepEqual(circle(cell.store.get(RITE_KEY)).h, {}, 'saw the Summoner fall, never struck: no helper');
    await say(a, { s: 1 });
    assert.deepEqual(cell.store.get(RITE_KEY), { d: DAY, c: { [`${PX},${PY}`]: { px: PX, py: PY, h: { 'acct-peer-0001': 'peer-0001' }, f: 1, at: circle(cell.store.get(RITE_KEY)).at, told: 1 } } });
    const b = await at('peer-0002', FAR);
    await say(b, { s: 1 });
    assert.deepEqual(Object.keys(circle(cell.store.get(RITE_KEY)).h), ['acct-peer-0001'], 'past its reach: not at the circle');
    const other = world.room(worldRoom(PX + 16, PY));
    const x = await at('peer-0003', AT, other);
    await say(x, { s: 1 }, other);
    assert.equal(x.meters.junk, 1, 'the circle is not in that cell');
    set(TT.openAt + RITE_GRACE_MS - 1);
    const c = await at('peer-0004');
    set(TT.openAt + RITE_GRACE_MS - 1);
    await say(c, { s: 1 });
    assert.deepEqual(Object.keys(circle(cell.store.get(RITE_KEY)).h), ['acct-peer-0001', 'acct-peer-0004'], 'said in the rite\'s last moment: heard');
    set(TT.openAt + RITE_GRACE_MS);
    const d = await at('peer-0005');
    await say(d, { s: 1 });
    assert.equal(Object.keys(circle(cell.store.get(RITE_KEY)).h).length, 2, 'past the grace: the rite is over');
    set(TT.omenAt - 1000);
    await say(d, { s: 1 });
    assert.equal(Object.keys(circle(cell.store.get(RITE_KEY)).h).length, 2, 'before the omen: no rite yet');
  });
  await withRite(async ({ cell, say, at }) => {
    const h = Object.fromEntries(Array.from({ length: RITE_HELPERS_MAX }, (_, i) => [`acct-x${i}`, `X${i}`]));
    cell.store.set(RITE_KEY, { d: DAY, c: { [`${PX},${PY}`]: { px: PX, py: PY, h, f: 0, at: 0, told: -1 } } });
    const a = await at('peer-0001');
    await say(a, { s: 1 });
    assert.equal(Object.keys(circle(cell.store.get(RITE_KEY)).h).length, RITE_HELPERS_MAX, 'the 65th is not kept');
  });
});

test('AUDIT WB12d (R1) relay: A CIRCLE OF ITS OWN - a word for another circle in the same cell is kept beside this one, never in its way, RITE_CIRCLES_MAX a day; a new day is a ledger of its own, an older day\'s word nothing (mutants: the day\'s first circle stands; another circle folded in; the circles unbounded; yesterday folded into today)', async () => {
  await withRite(async ({ cell, say, at }) => {
    assert.equal(worldRoom(PX + 1, PY + 1), CELL);
    const liar = await at('peer-0666', poseAt(DAY, PX + 1, PY + 1));
    await cell.raw(liar, JSON.stringify({ t: 'rite', d: DAY, px: PX + 1, py: PY + 1, s: 1, f: 0 }));
    const a = await at('peer-0001');
    await say(a, { s: 1, f: 1 });
    const led = cell.store.get(RITE_KEY);
    assert.deepEqual(Object.keys(led.c).sort(), [`${PX + 1},${PY + 1}`, `${PX},${PY}`].sort());
    assert.deepEqual(Object.keys(circle(led).h), ['acct-peer-0001'], 'the true circle keeps its own');
    assert.equal(circle(led).f, 1, 'its fall read');
    assert.deepEqual(Object.keys(circle(led, PX + 1, PY + 1).h), ['acct-peer-0666']);
    for (let i = 2; i < RITE_CIRCLES_MAX + 3; i++) {
      assert.equal(worldRoom(PX, PY + i), CELL);
      const w = await at(`peer-07${i}`, poseAt(DAY, PX, PY + i));
      await cell.raw(w, JSON.stringify({ t: 'rite', d: DAY, px: PX, py: PY + i, s: 1, f: 0 }));
    }
    assert.equal(Object.keys(cell.store.get(RITE_KEY).c).length, RITE_CIRCLES_MAX, 'RITE_CIRCLES_MAX a day');
  });
  await withRite(async ({ cell, say, at, set }) => {
    const a = await at('peer-0001');
    await say(a, { s: 1, f: 1 });
    const T2 = gateTimes(DAY + 1);
    set(T2.omenAt + 60_000);
    const b = await at('peer-0002', poseAt(DAY + 1));
    await cell.raw(b, JSON.stringify({ t: 'rite', d: DAY + 1, px: PX, py: PY, s: 1, f: 0 }));
    const led = cell.store.get(RITE_KEY);
    assert.equal(led.d, DAY + 1);
    assert.deepEqual(Object.keys(circle(led).h), ['acct-peer-0002'], 'today\'s helpers alone');
    assert.equal(circle(led).f, 0, 'today\'s Summoner still stands');
  });
});

test('WB12d relay: the Summoner\'s fall breaks the rite - the hub told, and again as more who struck are said; each circle said to everyone online once and at every hello while it stands - an early kill\'s collapse ending it - and posted to the channel with the names known when it goes (mutants: the hub never told; the broken word unsaid; said at every word; the hello unsaid; the early kill unread; the names frozen at the first tell; the post unarmed)', async () => {
  await withRite(async ({ cell, hub, say, at, posts, set, now }) => {
    Object.assign(hub.env, { GATE_DISCORD_WEBHOOK: HOOK });
    const h = hub.connect(); await hub.hello(h, 'peer-0009');
    const a = await at('peer-0001');
    await say(a, { s: 1 });
    assert.deepEqual(rites(h), [], 'struck, not yet broken');
    await say(a, { s: 1, f: 1 });
    const c = circle(cell.store.get(RITE_KEY));
    assert.equal(c.f, 1);
    assert.equal(c.told, 1, 'the hub heard it, with the one who struck');
    assert.deepEqual(rites(h), [{ t: 'rite', k: 'br', d: DAY, px: PX, py: PY, at: c.at, by: ['peer-0001'], n: 1 }], 'AUDIT WB12d (D4): and how many broke it');
    assert.ok(hub.alarm.at != null && hub.alarm.at <= now(), 'the post armed at once');
    await say(a, { s: 1, f: 1 });
    assert.equal(rites(h).length, 1, 'said once');
    const b = await at('peer-0002');
    await say(b, { s: 1, f: 1 });
    assert.deepEqual(Object.keys(circle(hub.store.get(RITE_KEY)).h).sort(), ['acct-peer-0001', 'acct-peer-0002'], 'told again: the second who struck');
    assert.equal(rites(h).length, 1, 'and not said again');
    const late = hub.connect(); await hub.hello(late, 'peer-0010');
    assert.equal(rites(late).length, 1, 'a hello hears it while the circle stands');
    await hub.fire();
    const post = posts.find((p) => /is broken/.test(cardWords(p.body)));
    assert.ok(post, 'posted');
    assert.equal(cardOf(post.body).title, 'The faithful\'s rite is broken');
    assert.match(cardOf(post.body).fields.Where, /^(Near [^,]+|In the wilds)$/);
    assert.equal(cardOf(post.body).fields['Broken by'], 'peer-0001 and peer-0002', 'both named - the names read when it goes; AUDIT WB12d (D4): the kill\'s own card');
    const fellAt = now();
    await hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ d: DAY, at: fellAt, top: ['Ann'], n: 1, rc: [], here: [] }) }));
    set(fellAt + GATE_COLLAPSE_MS);
    const gone = hub.connect(); await hub.hello(gone, 'peer-0011');
    assert.equal(rites(gone).length, 0, 'the Warden fell early: the breach collapsed, and the circle with it');
  });
});

test('AUDIT WB12d (R1) relay: THE HUB STANDS BY THE GATE\'S AGREED SITE - every circle told is kept and said once (each client hears its own), and once two accounts agree where the gate stands the kill pays that circle\'s helpers alone, the channel names that circle; with no site agreed, every circle\'s, the most struck first (mutants: the first circle wins; the agreed site unread; a liar\'s circle paid beside the true one; the site kept only with a herald)', async () => {
  await withRite(async ({ hub, door, siteBy }) => {
    const h = hub.connect(); await hub.hello(h, 'peer-0009');
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: 120, py: 410, at: 5, h: [['acct-peer-0666', 'peer-0666']] });
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: PX, py: PY, at: 9, h: [['acct-peer-0001', 'peer-0001'], ['acct-peer-0003', 'peer-0003']] });
    assert.deepEqual(rites(h).map((m) => [m.px, m.py]), [[120, 410], [PX, PY]], 'each circle said once');
    assert.deepEqual(await door(RITE_INTERNAL_DAY, { d: DAY }), { h: ['acct-peer-0001', 'acct-peer-0003', 'acct-peer-0666'] }, 'no site agreed: every circle, the most struck first');
    await siteBy(1); await siteBy(2);
    assert.deepEqual(await door(RITE_INTERNAL_DAY, { d: DAY }), { h: ['acct-peer-0001', 'acct-peer-0003'] }, 'the agreed site\'s circle alone');
    assert.deepEqual(await door(RITE_INTERNAL_DAY, { d: DAY + 1 }), { h: [] }, 'another day\'s kill: none');
    for (let i = 0; i < RITE_HUB_CIRCLES_MAX + 2; i++) await door(RITE_INTERNAL_BROKEN, { d: DAY, px: 10 + i, py: 10, at: 5, h: [] });
    assert.equal(Object.keys(hub.store.get(RITE_KEY).c).length, RITE_HUB_CIRCLES_MAX, 'RITE_HUB_CIRCLES_MAX a day');
  });
  await withRite(async ({ hub, door, siteBy, posts }) => {
    Object.assign(hub.env, { GATE_DISCORD_WEBHOOK: HOOK });
    await siteBy(1); await siteBy(2);
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: 120, py: 410, at: 5, h: [['acct-peer-0666', 'peer-0666']] });
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: PX, py: PY, at: 9, h: [['acct-peer-0001', 'peer-0001']] });
    await hub.fire();
    const post = posts.find((p) => /is broken/.test(cardWords(p.body)));
    assert.ok(post && /Copperham/.test(cardWords(post.body)) && /peer-0001/.test(cardWords(post.body)) && !/peer-0666/.test(cardWords(post.body)), post && cardWords(post.body));
  });
});

test('AUDIT WB12d relay: THE HUB\'S DAY - a second day\'s rite is kept and said fresh, never yesterday\'s helpers; a late word of an older day changes nothing; two tells landing together said once; a tell after its breach collapsed is taken and said to no one (mutants: the second day never said; yesterday carried over; an older day replacing today; said twice; said past the collapse)', async () => {
  await withRite(async ({ hub, door, set }) => {
    const h = hub.connect(); await hub.hello(h, 'peer-0009');
    await Promise.all([door(RITE_INTERNAL_BROKEN, { d: DAY, px: PX, py: PY, at: 5, h: [['a1', 'Ann']] }), door(RITE_INTERNAL_BROKEN, { d: DAY, px: PX, py: PY, at: 5, h: [['b1', 'Bran']] })]);
    assert.equal(rites(h).length, 1, 'two at once: said once');
    assert.deepEqual(Object.keys(circle(hub.store.get(RITE_KEY)).h).sort(), ['a1', 'b1'], 'and both kept');
    const T2 = gateTimes(DAY + 1);
    set(T2.omenAt + 60_000);
    assert.deepEqual(await door(RITE_INTERNAL_BROKEN, { d: DAY + 1, px: PX + 3, py: PY, at: 9, h: [['c1', 'Cid']] }), { ok: true });
    assert.deepEqual(rites(h).map((m) => m.d), [DAY, DAY + 1]);
    assert.deepEqual(rites(h)[1].by, ['Cid'], 'today\'s own names');
    assert.deepEqual(hub.store.get(RITE_KEY), { d: DAY + 1, c: { [`${PX + 3},${PY}`]: { px: PX + 3, py: PY, at: 9, h: { c1: 'Cid' }, said: 1 } } });
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: PX, py: PY, at: 5, h: [['d1', 'Dag']] });
    assert.equal(hub.store.get(RITE_KEY).d, DAY + 1, 'a late word of yesterday changes nothing');
    set(T2.wrathAt + GATE_COLLAPSE_MS + 1);
    assert.deepEqual(await door(RITE_INTERNAL_BROKEN, { d: DAY + 1, px: PX + 9, py: PY, at: 9, h: [] }), { ok: true }, 'taken');
    assert.equal(rites(h).length, 2, 'and said to no one - its breach is gone');
  });
});

test('AUDIT WB12d (R3-R5) relay: A TELL - one in flight however many words land (the alarm tells the rest), its retry armed before it goes (a reset mid-tell still tells), never pushing off a sooner alarm, re-armed past a raid\'s; a hub that never answers let go once the breach collapses (mutants: a tell a word; the retry armed after; a sooner alarm pushed off; the raid\'s alarm winning; told for ever)', async () => {
  await withRite(async ({ cell, say, at, hubAnswers }) => {
    let release, told = 0;
    const held = new Promise((r) => { release = r; });
    hubAnswers(async (req) => { if (new URL(req.url).pathname === RITE_INTERNAL_BROKEN) { told++; await held; } });
    const ws = [];
    for (let i = 1; i <= 4; i++) ws.push(await at(`peer-000${i}`));
    const first = say(ws[0], { s: 1, f: 1 });
    await settle();
    assert.equal(told, 1, 'the fall told');
    assert.ok(cell.alarm.at != null, 'its retry armed before it went');
    for (const w of ws.slice(1)) await say(w, { s: 1, f: 1 });   // words landing while the hub is asked (a fetch lets them in)
    assert.equal(told, 1, 'one tell in flight');
    release(); await first;
    assert.equal(circle(cell.store.get(RITE_KEY)).told, 1);
    assert.equal(Object.keys(circle(cell.store.get(RITE_KEY)).h).length, 4, 'every word kept');
    await cell.fire();
    assert.equal(circle(cell.store.get(RITE_KEY)).told, 4, 'the alarm told the rest');
  });
  await withRite(async ({ cell, say, at, hubDown, now }) => {
    hubDown();
    const a = await at('peer-0001');
    cell.alarm.at = now() + 3_600_000;
    await say(a, { s: 1, f: 1 });
    assert.equal(cell.alarm.at, now() + RITE_TELL_RETRY_MS, 'sooner than a later alarm');
  });
  await withRite(async ({ cell, say, at, hubDown, now }) => {
    hubDown();
    const a = await at('peer-0001');
    cell.alarm.at = now() + 1000;
    await say(a, { s: 1, f: 1 });
    assert.equal(cell.alarm.at, now() + 1000, 'never pushing off a sooner one');
  });
  await withRite(async ({ cell, say, at, hubDown, now, step }) => {
    hubDown();
    const a = await at('peer-0001');
    await say(a, { s: 1, f: 1 });
    cell.room._raidSweep = async (t) => { await cell.state.storage.setAlarm(t + 3_600_000); return true; };   // a raid's end an hour off
    step(RITE_TELL_RETRY_MS);
    await cell.fire();
    assert.ok(cell.alarm.at <= now() + RITE_TELL_RETRY_MS, 'the rite\'s retry, not the raid\'s hour');
  });
  await withRite(async ({ cell, say, at, hubDown, set }) => {
    let asked = 0;
    const up = hubDown();
    const a = await at('peer-0001');
    await say(a, { s: 1, f: 1 });
    up();
    const get = cell.env.ROOMS.get;
    cell.env.ROOMS.get = (id) => (id === SOCIAL_ROOM ? { fetch: async () => { asked++; return new Response('no', { status: 503 }); } } : get(id));
    set(TT.wrathAt + GATE_COLLAPSE_MS + 1);
    await cell.fire();
    assert.equal(asked, 0, 'the breach collapsed: let go');
    cell.env.ROOMS.get = get;
  });
});

test('WB12d relay: the ledger outlives a drained cell\'s sweep and an eviction - its hub told when it answers (mutants: the key swept; the ledger kept in memory alone)', async () => {
  await withRite(async ({ cell, hub, say, at, hubDown, step }) => {
    const up = hubDown();
    const a = await at('peer-0001');
    await say(a, { s: 1, f: 1 });
    await cell.drop(a);
    cell.wake();
    step(RITE_TELL_RETRY_MS); await cell.fire();
    up(); cell.wake();
    step(RITE_TELL_RETRY_MS); await cell.fire();
    assert.deepEqual(Object.keys(circle(hub.store.get(RITE_KEY))?.h ?? {}), ['acct-peer-0001']);
  });
});

test('AUDIT WB12d (L4) relay: the rite\'s bucket - RITE_HZ_MAX a second, its burst RITE_RELAY_BURST (deeper than the client\'s, so words a stalled socket bunched are all read), the rest dropped (mutants: unmetered; the client\'s burst)', async () => {
  assert.equal(RITE_HZ_MAX, 2);
  assert.ok(RITE_RELAY_BURST > RITE_HZ_MAX);
  await withRite(async ({ say, at }) => {
    const a = await at('peer-0001');
    for (let i = 0; i < RITE_RELAY_BURST; i++) await say(a, { s: 1 });
    assert.equal(a.meters.riteDrops ?? 0, 0, 'a stalled socket\'s words all read');
    await say(a, { s: 1 });
    assert.equal(a.meters.riteDrops, 1);
  });
  await withRite(async ({ say, at }) => {
    const a = await at('peer-0001');
    await say(a, { s: 1 });
    const b = await at('peer-0002');
    assert.equal(rites(b).length, 0, 'a cell\'s hello says no rite - the hub\'s word alone');
  });
});

test('WB12d relay: the kill asks the hub for the day\'s helpers - a fighter who broke the rite is minted `r`, one who did not none, and one who broke it and took no part in the fight a receipt of the rite alone, kept by the hub for their next hello; yesterday\'s rite pays nothing (mutants: the helpers unasked; r for every fighter; the rite\'s own never minted; the day unasked)', async () => {
  await withRite(async (k) => {
    const { say, at, world } = k;
    for (const id of ['peer-0001', 'peer-0003']) { const ws = await at(id); await say(ws, { s: 1 }); }
    const a1 = await at('peer-0001');
    await say(a1, { s: 1, f: 1 });
    const { fighters, mine, kill } = await courtOf(k);
    await kill();
    assert.equal(mine(fighters[0]).r, 1, 'fought and broke the rite: an ember more');
    assert.ok(['dealt', 'stood'].includes(mine(fighters[0]).x));
    assert.equal('r' in mine(fighters[1]), false, 'fought, never at the circle: none');
    const hub = world.room(SOCIAL_ROOM);
    const kept = hub.store.get(gateReceiptKey('acct-peer-0003'));
    assert.ok(kept, 'the hub keeps the rite\'s own');
    const c = readReceipt(kept.r);
    assert.deepEqual([c.x, c.s, c.d, 'r' in c], ['rite', 'acct-peer-0003', DAY, false]);
    const h3 = hub.connect(); await hub.hello(h3, 'peer-0003');
    assert.equal(readReceipt(h3.sent.find((m) => m.t === 'gate' && m.k === 'rcpt')?.r)?.x, 'rite', 'handed over at their hello');
  });
  await withRite(async (k) => {
    await k.door(RITE_INTERNAL_BROKEN, { d: DAY - 1, px: PX, py: PY, at: 5, h: [['acct-peer-0001', 'peer-0001']] });
    const { fighters, mine, kill } = await courtOf(k, ['peer-0001']);
    await kill();
    assert.ok(mine(fighters[0]));
    assert.equal('r' in mine(fighters[0]), false, 'yesterday\'s rite pays nothing today');
  });
});

test('AUDIT WB12d (R2, L2, L3) relay: ONE FALL - a blow or a beat that lands while the hub is asked waits on the fall under way: each fighter one `fell`, one receipt, the court\'s checkpoint and the hub\'s copy the same seed; a hub that does not answer at the kill leaves the answer the beats were given from the opening (mutants: the fall re-entered; the helpers asked once, at the kill alone)', async () => {
  await withRite(async (k) => {
    const { say, at } = k;
    const a1 = await at('peer-0001');
    await say(a1, { s: 1, f: 1 });
    const { r, fighters, mine, kill, gsay } = await courtOf(k);
    let release; const held = new Promise((res) => { release = res; });
    const put = k.hubAnswers(async (req) => { if (new URL(req.url).pathname === RITE_INTERNAL_DAY) await held; });
    const first = kill();
    await settle();
    const second = gsay(fighters[1], { k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell });
    const beat = r.room._gateTick();
    await settle();
    release(); await Promise.all([first, second, beat]); put();
    for (const ws of fighters) {
      assert.equal(ws.sent.filter((m) => m.t === 'gate' && m.k === 'fell').length, 1, 'fell once');
      assert.equal(ws.sent.filter((m) => m.t === 'gate' && m.k === 'rcpt').length, 1, 'one receipt');
    }
    const hubCopy = readReceipt(k.world.room(SOCIAL_ROOM).store.get(gateReceiptKey('acct-peer-0001'))?.r);
    assert.equal(readReceipt(r.store.get('gatefight').rc['acct-peer-0001']).c, mine(fighters[0]).c, 'the checkpoint holds the seed handed');
    if (hubCopy) assert.equal(hubCopy.c, mine(fighters[0]).c, 'and the hub\'s copy the same');
  });
  await withRite(async (k) => {
    const a1 = await k.at('peer-0001');
    await k.say(a1, { s: 1, f: 1 });
    const { r, fighters, mine, kill } = await courtOf(k, ['peer-0001']);
    await settle();
    assert.deepEqual(r.room._fight.helped, ['acct-peer-0001'], 'asked ahead, from the opening');
    k.hubAnswers(async (req) => (new URL(req.url).pathname === RITE_INTERNAL_DAY ? new Response('busy', { status: 503 }) : undefined));
    await kill();
    assert.equal(mine(fighters[0]).r, 1, 'the hub busy at the kill: the beats\' answer stands');
  });
});

test('AUDIT WB12d (lens T F3, F12, F14) relay: the fall\'s time is its first word\'s; a circle told is told no more, however often the alarm comes; the hub keeps what it is told within bounds - RITE_HELPERS_MAX a circle however often told, no id over 128 characters - and says it to sockets that said hello alone, its first RITE_BY_MAX names and how many (mutants: the fall restamped; told at every alarm; the hub\'s helpers unbounded; a long id kept; said to the unhelloed; its names unbounded)', async () => {
  await withRite(async ({ cell, hub, say, at, door, hubAnswers, step }) => {
    let told = 0;
    const undo = hubAnswers(async (req) => { if (new URL(req.url).pathname === RITE_INTERNAL_BROKEN) told++; return undefined; });
    const a = await at('peer-0001');
    await say(a, { s: 1, f: 1 });
    const first = circle(cell.store.get(RITE_KEY)).at;
    step(1000); await say(a, { s: 1, f: 1 });
    assert.equal(circle(cell.store.get(RITE_KEY)).at, first, 'the fall\'s time its first word\'s');
    assert.equal(told, 1);
    for (let i = 0; i < 3; i++) { step(RITE_TELL_RETRY_MS); await cell.fire(); }
    assert.equal(told, 1, 'told no more');
    undo();
    const h = hub.connect(); await hub.hello(h, 'peer-0009');
    const u = hub.connect();
    const long = 'x'.repeat(200);
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: PX + 1, py: PY, at: 5, h: [[long, 'Long'], ...Array.from({ length: RITE_HELPERS_MAX - 1 }, (_, i) => [`a${i}`, `A${i}`])] });
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: PX + 1, py: PY, at: 5, h: Array.from({ length: RITE_HELPERS_MAX }, (_, i) => [`b${i}`, `B${i}`]) });
    const kept = Object.keys(circle(hub.store.get(RITE_KEY), PX + 1, PY).h);
    assert.equal(kept.length, RITE_HELPERS_MAX, 'RITE_HELPERS_MAX a circle, however often told');
    assert.ok(!kept.includes(long), 'no id over 128 characters');
    const said = rites(h).filter((m) => m.px === PX + 1);
    assert.equal(said.length, 1);
    assert.equal(said[0].by.length, RITE_BY_MAX, 'its first RITE_BY_MAX names');
    assert.equal(said[0].n, RITE_HELPERS_MAX - 1, 'and how many');
    assert.deepEqual(rites(u), [], 'a socket that never said hello hears nothing');
  });
});

test('AUDIT WB12d (lens T F15) relay: THE CHANNEL\'S POST of a broken rite - tried again HERALD_RETRY_MS on while Discord does not take it; owed while no circle stands at the agreed site yet, and posted when the true one breaks; let go once the breach collapses; armed at once by the hub\'s first hello after an eviction (mutants: no retry; none yet unretried; kept past the collapse; the hello blind to the rite)', async () => {
  const after = { start: TT.openAt + 60_000 };   // the omen's post no longer owed: the rite's alone
  await withRite(async ({ hub, door, posts, net, now, step }) => {
    Object.assign(hub.env, { GATE_DISCORD_WEBHOOK: HOOK });
    net.discordUp = false;
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: PX, py: PY, at: 5, h: [['a1', 'Ann']] });
    await hub.fire();
    assert.ok(hub.alarm.at != null && hub.alarm.at <= now() + HERALD_RETRY_MS, 'Discord down: tried again soon');
    net.discordUp = true;
    step(HERALD_RETRY_MS); await hub.fire();
    assert.equal(posts.filter((p) => /is broken/.test(cardWords(p.body))).length, 1, 'posted once Discord answers');
  }, after);
  await withRite(async ({ hub, door, posts, siteBy, now, step }) => {
    Object.assign(hub.env, { GATE_DISCORD_WEBHOOK: HOOK });
    await siteBy(1); await siteBy(2);
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: 120, py: 410, at: 5, h: [['acct-peer-0666', 'peer-0666']] });
    await hub.fire();
    assert.equal(posts.filter((p) => /is broken/.test(cardWords(p.body))).length, 0, 'a circle the agreed site never names: not posted');
    assert.ok(hub.alarm.at != null && hub.alarm.at <= now() + HERALD_RETRY_MS, 'owed while the breach stands');
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: PX, py: PY, at: 9, h: [['acct-peer-0001', 'peer-0001']] });
    step(HERALD_RETRY_MS); await hub.fire();
    const post = posts.find((p) => /is broken/.test(cardWords(p.body)));
    assert.ok(post && /peer-0001/.test(cardWords(post.body)) && !/peer-0666/.test(cardWords(post.body)), post && cardWords(post.body));
  }, after);
  await withRite(async ({ hub, door, posts, net, set }) => {
    Object.assign(hub.env, { GATE_DISCORD_WEBHOOK: HOOK });
    net.discordUp = false;
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: PX, py: PY, at: 5, h: [['a1', 'Ann']] });
    await hub.fire();
    net.discordUp = true;
    set(TT.wrathAt + GATE_COLLAPSE_MS + 1);
    await hub.fire();
    assert.equal(posts.filter((p) => /is broken/.test(cardWords(p.body))).length, 0, 'no news once the breach collapsed');
  }, after);
  await withRite(async ({ hub, door, now }) => {
    Object.assign(hub.env, { GATE_DISCORD_WEBHOOK: HOOK });
    await door(RITE_INTERNAL_BROKEN, { d: DAY, px: PX, py: PY, at: 5, h: [['a1', 'Ann']] });
    hub.alarm.at = null;   // the alarm lost
    hub.wake();
    const ws = hub.connect(); await hub.hello(ws, 'peer-0009', null, { name: 'n9', acct: 'acct-n9', asecret: 'secret-of-acct-n9' });
    assert.ok(hub.alarm.at != null && hub.alarm.at <= now(), 'a rite owed: the alarm at once');
  }, after);
});
