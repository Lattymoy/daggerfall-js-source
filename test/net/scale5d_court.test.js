// SCALE5d part two (2026-10-11, the plan's "the gate's court ... as copies around one fight object that takes their
// blows batched and fans the boss's state back"; Mac: "I wanna do every single slice"; bible/11-Multiplayer/Scale-Arc.md
// SCALE5d): A GATE'S COURT, COPIED. The court keeps its fight and its first SOCKETS_MAX sockets; a crowd past them goes
// to its copies (`gate:<n>#<k>`), each a crowd of its own whose fight is the court's - its hellos, poses and gate words
// handed up, the boss's beats, answers and closes handed back - over the shards' machinery (net/hubShards.js
// isCourtCopy, courtOfCopy, upOf; server/src/index.js _courtHello, _courtPose, _courtSockets). A copy's socket
// is never the court's index, so no crowd walk there reaches it. tools/mutants/scale5d_court.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeRooms } from '../fakeRoom.mjs';
import * as H from '../../src/net/hubShards.js';
import { LAYERS_MAX, LAYER_HEADER, LAYER_FULL_HEADER, SOCKETS_MAX, GATE_BRAIN_V } from '../../src/net/wire.js';
import { gateTimes, gateRoomKey } from '../../src/net/gate/gateLaw.js';
import { COURT_CENTRE, BRAIN_TICK_MS, OPENING_MS, COURT_R, POSE_SLACK, HIT_KINDS, profileOf } from '../../src/net/gate/gateBrain.js';
import worker from '../../server/src/index.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const DAY = 200;
const TT = gateTimes(DAY);
const KEY = gateRoomKey(DAY);
const at = (x, z, extra = {}) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0, ...extra });
const gates = (ws, k) => ws.sent.filter((m) => m.t === 'gate' && (!k || m.k === k));

/** A court and its copies on a clock of their own, the batches between them driven to rest between steps. */
async function court(fn, { start = TT.openAt + 1000 } = {}) {
  const realNow = Date.now;
  let clock = start;
  Date.now = () => clock;
  try {
    return await quiet(async () => {
      const W = fakeRooms({ now: () => clock });
      const F = W.room(KEY);
      const copy = (k) => W.room(`${KEY}#${k}`);
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          for (const [k, r] of [...W.made]) if (H.isCourtCopy(k)) await r.room._hubUpFlush();
          await F.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isCourtCopy(k)) await r.room._hubPoll();   // HUB-PULL: each copy asks for what it is owed
        }
      };
      /** A socket into copy `k` - its attachment the place's key and its layer, as the Worker's walk says them (the
       *  harness names an object's sockets by its object's name, which a copy's never are). */
      const into = async (k, peer, pose, extra = {}) => {
        const C = copy(k);
        const ws = C.connect();
        ws.att.key = KEY; ws.att.ly = k;
        clock += 10;
        await C.hello(ws, peer, pose, extra);
        await settle();
        return ws;
      };
      const own = async (peer, pose, extra = {}) => { const ws = F.connect(); clock += 10; await F.hello(ws, peer, pose, extra); await settle(); return ws; };
      const say = async (R, ws, o) => { await R.raw(ws, JSON.stringify({ t: 'gate', ...o })); await settle(); };
      const pose = async (R, ws, p) => { await R.pose(ws, p); await settle(); };
      const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += BRAIN_TICK_MS; if (F.alarm.at != null && clock >= F.alarm.at) await F.fire(); await settle(); } };
      try { return await fn({ W, F, copy, into, own, say, pose, tick, settle, set: (t) => { clock = t; } }); } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); }
      }
    });
  } finally { Date.now = realNow; }
}
const courtVs = (F) => [...F.room._vsocks.values()].filter((v) => v.court);

test('SCALE5d part two the law: a copy of a gate\'s court is `gate:<n>#<k>`, k 1 to LAYERS_MAX - 1, and hands up to its court; a channel\'s shard to its bus; the court, a channel and a cell to nobody; a copy hands the court its gate words alone (mutants: a copy past the last layer; a key with a leading zero; a channel\'s shard read as a copy; every frame handed)', () => {
  assert.equal(LAYERS_MAX, 8, 'k 1 to 7');
  for (let k = 1; k < LAYERS_MAX; k++) { assert.equal(H.isCourtCopy(`${KEY}#${k}`), true); assert.equal(H.upOf(`${KEY}#${k}`), KEY); }
  for (const n of [KEY, `${KEY}#0`, `${KEY}#8`, `${KEY}#11`, 'gate:0200#1', 'gate:#1', 'sd:3#1', 'world:1,2#1', 'chat:world', null, 42]) { assert.equal(H.isCourtCopy(n), false, String(n)); assert.equal(H.courtOfCopy(n), null, String(n)); }
  assert.equal(H.isCourtCopy('gate:0#1'), true, 'day 0 is a day');
  assert.equal(H.upOf('chat:world.3'), 'chat:world');
  assert.equal(H.upOf(KEY), null);
  // PIN MOVED (AUDIT SCALE II R3-1): a copy hands its court the frames PARSED as gate words, said again `t` first - never a frame
  // read off its first bytes (`courtHands`, retired); test/net/auditscale2_bus.test.js holds it over a copy, a court and every key order
});

test('SCALE5d part two the Worker: a gate\'s court is walked from the court itself, whatever the page asks - past a full one to its copies, each told its layer; a Super dungeon\'s realm is never walked (mutants: the court unwalked; the page\'s layer asked first)', async () => {
  const realNow = Date.now;
  Date.now = () => TT.openAt + 1000;
  const asked = [];
  const env = { ROOMS: {
    idFromName: (n) => n,
    get: (n) => ({ fetch: async (req) => { asked.push([n, req.headers.get(LAYER_HEADER)]); if (n === KEY) { const r = new Response('{"error":"room full"}', { status: 503 }); r.headers.set(LAYER_FULL_HEADER, '1'); return r; } return new Response('ok'); } }),
  } };
  try {
    const res = await worker.fetch(new Request(`https://relay.test/room/${KEY}?ly=5`, { headers: { Upgrade: 'websocket' } }), env);
    assert.equal(await res.text(), 'ok');
    assert.deepEqual(asked, [[KEY, '0'], [`${KEY}#1`, '1']], 'the court first, then its first copy');
  } finally { Date.now = realNow; }
  const w = src('server/src/index.js');
  assert.match(w, /if \(isGateRoom\(key\)\) return layerWalk\(env\.ROOMS, key, request, 0\);/);
  assert.match(w, /const ly = isLayered\(key\) \|\| isGateRoom\(key\) \? layerOf\(request\.headers\.get\(LAYER_HEADER\)\) : 0;/, 'and the object keeps its layer');
});

test('SCALE5d part two a copy\'s socket: welcomed by its copy, and the court\'s - a ShardSocket there the court\'s index never holds; its `in` joins the one fight and is answered through its copy; the boss\'s beats reach it as they reach the court; the crowds never meet (mutants: the hello not handed up; the copy\'s socket in the court\'s index; the gate word kept by the copy; the beat not handed down; a court pose fanned to a copy)', () => court(async ({ F, copy, into, own, say, pose, tick }) => {
  const a = await own('peer-0001', at(0, 4));
  const c = await into(2, 'peer-0002', at(2, 4));
  const C = copy(2);
  assert.equal(c.sent[0].t, 'welcome', 'its copy welcomed it');
  assert.deepEqual(c.sent[0].peers, [], 'and the copy\'s crowd is its own - the court\'s socket is not in it');
  const [v] = courtVs(F);
  assert.ok(v, 'the court holds it');
  assert.equal(v.att.sub, 'acct-peer-0002');
  assert.deepEqual([v.att.pose.x, v.att.pose.z], [at(2, 4).x, at(2, 4).z], 'where it stands');
  assert.equal([...F.room._all()].length, 1, 'never in the court\'s index');
  F.room._setAttach(v, { ...v.att, probe: 1 });
  assert.equal(F.room._all().has(v), false, 'not even by a write of its attachment');
  assert.equal(v.att.probe, 1);
  assert.equal(a.sent.filter((m) => m.t === 'join').length, 0, 'the court\'s crowd was told nothing');
  await say(C, c, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
  assert.ok(F.room._fight.players['acct-peer-0002'], 'the one fight knows it');
  assert.equal(gates(c, 'st').length, 1, 'answered through its copy');
  await say(F, a, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
  await tick(Math.ceil(OPENING_MS / BRAIN_TICK_MS) + 3);
  const heardA = gates(a, 'atk'), heardC = gates(c, 'atk');
  assert.ok(heardA.length >= 1, 'he acted');
  assert.deepEqual(heardC, heardA, 'and the copy heard the same words as the court');
  assert.equal(C.room._hubTotal ?? null, null, 'a copy is told no channel\'s count');
  const before = c.sent.length;
  await pose(F, a, at(1, 5));
  assert.equal(c.sent.filter((m) => m.t === 'pose' || m.t === 'poses').length, c.sent.slice(0, before).filter((m) => m.t === 'pose' || m.t === 'poses').length, 'the court\'s poses never reach a copy');
  const d = await into(2, 'peer-0003', at(3, 4));
  await pose(C, d, at(3, 6));
  assert.ok(c.sent.some((m) => (m.t === 'pose' && m.id === 'peer-0003') || (m.t === 'poses')), 'a copy\'s crowd sees its own');
  assert.ok(!a.sent.some((m) => m.t === 'pose' && m.id === 'peer-0003'), 'and the court\'s never sees it');
  const p3 = courtVs(F).find((x) => x.att.id === 'peer-0003').att.pose;
  assert.deepEqual([p3.x, p3.z], [at(3, 6).x, at(3, 6).z], 'though the court knows where it stands');
}));

test('SCALE5d part two the fight hears a copy\'s fighter: its blow lands from where its pose stands, off the court it lands nothing; a heal names its copy-mate healer; its trail is kept; the kill names it here and hands it its receipt through its copy (mutants: a copy\'s pose unread; the bodies the court\'s alone; the healer looked for in the court alone; the kill\'s receipts the court\'s alone)', () => court(async ({ F, copy, into, say, pose, tick, settle }) => {
  const C = copy(1);
  const c = await into(1, 'peer-0001', at(0, 3));
  const h = await into(1, 'peer-0002', at(1, 3));
  await say(C, c, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
  await say(C, h, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
  const f = F.room._fight, full = f.hp;
  await pose(C, c, at(0, COURT_R + POSE_SLACK + 1));
  const vc = courtVs(F).find((x) => x.att.id === 'peer-0001');
  assert.equal(F.room._trails?.get(vc)?.at(-1)?.[3], at(0, COURT_R + POSE_SLACK + 1).z, 'its trail follows its poses, for the judge');
  await say(C, c, { k: 'hit', q: 1, d: 10, r: HIT_KINDS.Shaft });
  assert.equal(f.hp, full, 'from off the court, nothing');
  await pose(C, c, at(0, 3));
  await say(C, c, { k: 'hit', q: 2, d: 10, r: 0 });
  assert.equal(f.hp, full - 10 * profileOf(f).hitX, 'from where it stands, as the court judges any blow');
  const v = courtVs(F).find((x) => x.att.id === 'peer-0001');
  const bodies = F.room._gateBodies(f);
  assert.deepEqual(bodies.map((b) => b.sub).sort(), ['acct-peer-0001', 'acct-peer-0002'], 'the census counts the copy\'s fighters');
  f.players['acct-peer-0001'].hp = 1;
  await say(C, c, { k: 'heal', h: [['peer-0002', 5]] });
  assert.ok((f.players['acct-peer-0002'].healed ?? 0) > 0 || (f.players['acct-peer-0002'].hd ?? 0) > 0, 'the healer named in the copy is credited');
  // the kill - after beats in which the copy's fighters stood (each beat's census counts them, as the court's)
  await tick(6);
  assert.ok(f.players['acct-peer-0001'].stoodMs > 0, 'the beat counts a copy\'s fighter standing');
  f.hp = 5;
  await say(C, c, { k: 'hit', q: 3, d: 10, r: 0 });
  assert.ok(f.fell, 'he fell');
  await tick(2);
  assert.ok(f.here.includes('acct-peer-0001'), 'the kill names the copy\'s fighter here');
  assert.ok(gates(c, 'rcpt').length >= 1, 'and its receipt reached it through its copy');
  assert.ok(gates(c, 'fell').length >= 1, 'and the fall');
  await C.drop(c); await settle();
  assert.equal(F.room._trails?.has(v) ?? false, false, 'a copy\'s socket gone, its trail goes with it');
}));

test('SCALE5d part two the court\'s law at the door: a copy admits by the clock alone, the court by its own - a newcomer after the seal refused in its words and closed through its copy, a fighter of the fight let back; one seat an account across the court and its copies, the older replaced; a copy socket\'s leave said to its own crowd alone (mutants: the copy judging the fight; the court\'s admission skipped; one seat the court\'s alone; a copy\'s leave said to the court)', () => court(async ({ F, copy, into, own, say, settle, set }) => {
  const C = copy(3);
  // a refused hello is never asked again: counted, and stopped past a bound (a loop of them starves every timer here)
  let rehellos = 0;
  const rehello = C.room._hubRehello.bind(C.room);
  C.room._hubRehello = (vid) => { if (++rehellos > 20) { C.room._up.length = 0; return; } rehello(vid); };
  const fighter = await into(3, 'peer-0001', at(0, 4));
  await say(C, fighter, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
  const mate = await into(3, 'peer-0004', at(0, 5));
  const stays = await into(3, 'peer-0007', at(0, 7));
  const watcher = await own('peer-0005', at(0, 6));
  set(TT.sealAt + 1000);
  const late = await into(3, 'peer-0002', at(0, 4));
  // a refused socket's gate word already on its way asks its hello of nobody again (it was asked, and refused, for ever)
  const eager = C.connect(); eager.att.key = KEY; eager.att.ly = 3;
  await C.hello(eager, 'peer-0006', at(0, 4));
  await C.raw(eager, JSON.stringify({ t: 'gate', k: 'in', lv: 10, bv: GATE_BRAIN_V }));
  await settle();
  assert.equal(eager.sent.filter((m) => m.t === 'error').length, 1, 'refused once');
  assert.equal(rehellos, 0, `a refused hello asked again ${rehellos} times`);
  assert.ok(!watcher.sent.some((m) => m.t === 'leave'), 'a copy\'s refused socket is no leave in the court');
  assert.ok(late.sent.some((m) => m.t === 'error' && m.m === 'the gate is sealed'), 'the court\'s word');
  assert.ok(late.closed, 'and closed through its copy');
  assert.equal(courtVs(F).filter((v) => v.att.id === 'peer-0002').length, 0);
  const back = await into(3, 'peer-0001', at(0, 4), { name: 'peer-0001b' });
  assert.ok(!back.closed && back.sent[0].t === 'welcome', 'a fighter of the fight comes back');
  // one seat: the account's newer hello in the court replaces its copy's socket
  const there = courtVs(F).find((v) => v.att.sub === 'acct-peer-0001' && !v.closed);
  assert.ok(there);
  const inCourt = await own('peer-0001', at(1, 4), { name: 'peer-0001c' });
  await settle();
  assert.ok(inCourt.sent[0].t === 'welcome');
  assert.ok(there.closed, 'its copy\'s socket replaced');
  assert.ok(back.closed, 'and closed through its copy');
  // and a copy's hello replaces the court's socket of the same account
  const again = await into(3, 'peer-0001', at(0, 4), { name: 'peer-0001d' });
  assert.ok(!again.closed);
  assert.ok(inCourt.closed, 'the court\'s socket replaced by the copy\'s');
  // one seat across the copies: the account's hello in another copy replaces this one's
  const other = await into(2, 'peer-0001', at(0, 4), { name: 'peer-0001e' });
  assert.ok(!other.closed);
  assert.ok(again.closed, 'the other copy\'s socket replaced');
  // a copy's leave: its crowd told, the court's never
  await C.drop(mate); await settle();
  assert.ok(stays.sent.some((m) => m.t === 'leave' && m.id === 'peer-0004'), 'its copy said it went');
  assert.ok(!watcher.sent.some((m) => m.t === 'leave' && m.id === 'peer-0004'), 'the court said nothing');
  assert.equal(courtVs(F).filter((v) => v.att.id === 'peer-0004' && !v.closed).length, 0, 'and the court let it go');
}));

test('SCALE5d part two a court without copies is the court it was - every socket its index\'s, every beat its own sockets\' alone; and a copy holds no fight of its own (mutants: a copy minting a fight; the court\'s fan reaching for copies it has not)', () => court(async ({ F, copy, into, own, say, tick }) => {
  const a = await own('peer-0001', at(0, 4));
  await say(F, a, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
  assert.equal(F.room._cper.size, 0);
  assert.deepEqual([...F.room._courtSockets()].map(([ws]) => ws), [...F.room._all().keys()], 'its sockets, its index\'s');
  await tick(3);
  assert.equal(F.room._down.size, 0, 'nothing owed any copy');
  const C = copy(1);
  const c = await into(1, 'peer-0002', at(0, 4));
  await say(C, c, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
  assert.equal(C.room._fight ?? null, null, 'the copy minted no fight');
  assert.equal(C.store.get('gatefight'), undefined);
  assert.ok(SOCKETS_MAX >= 256);
}));

test('SCALE5d part two a court woken holds no copy\'s socket, and each copy\'s sync - its alarm, a copy woken too - says them again, and the fight hears them as before (mutants: a woken copy hands nothing up; a refused hello asked again)', () => court(async ({ F, copy, into, say, settle }) => {
  const C = copy(2);
  const c = await into(2, 'peer-0001', at(0, 4));
  await say(C, c, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
  F.wake(); C.wake();
  assert.equal(courtVs(F).length, 0, 'a woken court holds none');
  await C.fire(); await settle();
  const [v] = courtVs(F);
  assert.ok(v && v.att.id === 'peer-0001', 'the copy\'s sync said it again');
  assert.equal(v.att.sub, 'acct-peer-0001');
  assert.ok(v.att.pose, 'and where it stands');
  assert.ok(F.room._gateBodies(await F.room._gateFightOf()).some((b) => b.sub === 'acct-peer-0001'), 'the fight hears it as before');
}));
