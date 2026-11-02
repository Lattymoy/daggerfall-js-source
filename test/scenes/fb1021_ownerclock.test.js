// OWNER-CLOCK (2026-10-21, the field: players report enemy desync; a player's profile shows boats, peers, horses and grass
// each taking a tenth to a quarter of the main thread, so a slow owner is common). A foe is its owner's to step and
// stream, and a reader leads each puppet along the way its last two records show (DESYNC-ZERO, scenes/puppetLead.js) -
// measured on the READER's arrival clock and carried LEAD_MAX_S at most. An owner at 3 fps sends a frame every 333 ms,
// and every hitch on its machine or on the road between stood its foes still and jumped them; below 20 fps its foes also
// walked slower than its own player (FOE-CATCHUP's cap; half its pace below 10 fps), for every reader. Now:
//   1. every foes and own frame says when its foes were stepped (`tm`, net/ownerClock.js), stamped by the session in the
//      bytes it sends, and the relay - which reads nothing inside a frame - carries it through as it carries the rest;
//   2. a reader takes velocity from the OWNER's time between two records that both say it, and carries the lead for the
//      interval the owner is seen to keep (bounded), with DESYNC-ZERO's law exact where a record says none;
//   3. online, with anyone else in the room, the street's pool steps its foes through the host's own clamped frame in
//      FOE-CATCHUP's own size of step - its owner's player's pace, never past it - and only on the extra calls a measured
//      share of the frame's own time buys (scenes/ownerCatchUp.js).
// Executed: the session on the fake socket, the relay's Room on the fake Durable Object, the real encounter pool as owner
// and as reader, the pure doors, the world host's wiring on the page's own clocks; the hosts' calls by source.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OnlineSession } from '../../src/net/online.js';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { fakeRoom } from '../fakeRoom.mjs';
import { createOwnerClock, ownerClock, ownerTmOf, ownerTmDiffS, stampedFrameText, applyingOwnerTm, appliedOwnerTm, OWNER_TM_MOD } from '../../src/net/ownerClock.js';
import { POSE_TS_MOD, parseClient, FOES_FRAME_MAX, OWN_RELAY_MIN, GROUND_LAW, GRANT_HELLO_LAW, cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { puppetLead, LEAD_MAX_S, LEAD_DIST_MAX, LEAD_SLOW_MAX_S, LEAD_DIST_SLOW_MAX, LEAD_SLACK_S, LEAD_GAP_EASE } from '../../src/scenes/puppetLead.js';
import { catchUpPlan, catchUpOwnerFoes, markModalSteps, wireOwnerClock, extrasAfforded, OWNER_CATCHUP_MAX_S, OWNER_CATCHUP_SHARE, OWNER_CATCHUP_STEPS_MAX, FRAME_MS_MAX } from '../../src/scenes/ownerCatchUp.js';
import { FOE_MAX_FRAME_DT, foeFrameDt } from '../../src/characters/enemy/enemyMotor.js';
import { tacticsNow } from '../../src/ai/tacticsClock.js';
import { FIXED_DT } from '../../src/player/motor.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const quiet = (fn) => { const keep = [console.info, console.warn, console.log]; console.info = console.warn = console.log = () => {}; try { return fn(); } finally { [console.info, console.warn, console.log] = keep; } };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---- DESYNC-ZERO's lead as it shipped (src/scenes/puppetLead.js at 4bba28c), frozen: the law an older owner's puppets keep ----
function desyncZeroLead(p, t, nowS) {
  if (!p || !t || !Number.isFinite(nowS)) return t;
  let L = p._dz;
  if (!L) { L = p._dz = { x: t[0], y: t[1], z: t[2], at: nowS, vx: 0, vz: 0, out: [0, 0, 0] }; return t; }
  if (t[0] !== L.x || t[1] !== L.y || t[2] !== L.z) {
    const dt = nowS - L.at, dx = t[0] - L.x, dz = t[2] - L.z;
    L.vx = 0; L.vz = 0;
    if (dt >= 0.04 && dt <= 1.2) {
      const vx = dx / dt, vz = dz / dt, s2 = vx * vx + vz * vz;
      if (s2 <= 9 * 9) { L.vx = vx; L.vz = vz; }
    }
    L.x = t[0]; L.y = t[1]; L.z = t[2]; L.at = nowS;
  }
  if (!p.moving || (L.vx === 0 && L.vz === 0)) return t;
  const age = Math.min(Math.max(0, nowS - L.at), 0.3);
  let ox = L.vx * age, oz = L.vz * age;
  const d = Math.hypot(ox, oz);
  if (d > 1) { ox *= 1 / d; oz *= 1 / d; }
  L.out[0] = t[0] + ox; L.out[1] = t[1]; L.out[2] = t[2] + oz;
  return L.out;
}

/** An owner at `fps` whose foe walks +x at `v` m/s, as world.js streams it: a frame on the first of its frames FOES_MS
 *  past the last, carrying the foe as the frame BEFORE stepped it (the send runs ahead of the step) and that step's
 *  moment as `tm`; each lands `lat(k)` ms after it left, never before the one ahead of it (one ordered socket). */
function ownerSends({ fps, v, lat = () => 80, durS = 6 }) {
  const frameMs = 1000 / fps, sends = [];
  let sentAt = -Infinity, landed = -Infinity;
  for (let k = 1; k * frameMs <= durS * 1000; k++) {
    const now = k * frameMs;
    if (now - sentAt < 200) continue;
    sentAt = now;
    const steppedAt = (k - 1) * frameMs;
    landed = Math.max(landed, now + lat(sends.length));
    sends.push({ at: landed, x: v * steppedAt / 1000, tm: Math.round(steppedAt) % POSE_TS_MOD });
  }
  return sends;
}
/** A 60 fps reader leading the puppet by `law`: what its ease walks toward each frame, from 1.5 s on (past the first words). */
function readerTargets(sends, { law = puppetLead, withTm = true } = {}) {
  const p = { moving: true, wire: null, tm: null };
  const out = [];
  let k = 0;
  for (let ms = sends[0].at; ms <= sends.at(-1).at; ms += 1000 / 60) {
    while (k < sends.length && sends[k].at <= ms) { p.wire = [sends[k].x, 0, 0]; if (withTm) p.tm = sends[k].tm; k++; }
    const t = law(p, p.wire, ms / 1000);
    if (ms >= 1500) out.push(t[0]);
  }
  return { out, p };
}
const glide = (xs) => {
  let still = 0, jump = 0;
  for (let i = 1; i < xs.length; i++) { const d = Math.abs(xs[i] - xs[i - 1]); if (d < 1e-9) still++; jump = Math.max(jump, d); }
  return { still: still / (xs.length - 1), jump };
};
/** The road: latency between 40 and 200 ms, a fixed draw. */
const jittery = (seed) => { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return 40 + (x / 2147483648) * 160; }; };

test('OWNER-CLOCK the word: `tm` is the last step\'s moment in whole ms inside the pose time\'s wrap; a reader takes an integer inside it and nothing else; the time between two words crosses the wrap; the stamp rides the text, never the caller\'s frame, and gives way before the frame\'s cap (mutants: the wrap dropped; the range unread; the frame stamped in place; the cap unread)', () => {
  assert.equal(OWNER_TM_MOD, POSE_TS_MOD, 'one wrap for both clocks on the wire (SCALE2b\'s)');
  const c = createOwnerClock();
  assert.equal(c.tm(), null, 'nothing stepped: nothing said');
  c.mark(1234.6);
  assert.equal(c.tm(), 1235);
  c.mark(POSE_TS_MOD + 10.2);
  assert.equal(c.tm(), 10, 'inside the wrap');
  c.mark(NaN);
  assert.equal(c.tm(), 10, 'a junk moment moves nothing');
  for (const ok of [0, 1, POSE_TS_MOD - 1]) assert.equal(ownerTmOf({ tm: ok }), ok);
  for (const bad of [-1, POSE_TS_MOD, 1.5, '12', null, undefined, NaN, Infinity]) assert.equal(ownerTmOf({ tm: bad }), null, String(bad));
  assert.equal(ownerTmOf(null), null);
  assert.equal(ownerTmOf({}), null, 'an older owner\'s frame');
  assert.equal(ownerTmDiffS(500, 300), 0.2);
  assert.equal(ownerTmDiffS(100, POSE_TS_MOD - 233), 0.333, 'across the wrap');
  assert.equal(ownerTmDiffS(300, 500), -0.2, 'an older word is behind');
  const frame = { n: 1, k: 'world:3,12', full: 1, f: [{ i: 1, t: 0, f: [1, 2, 3] }] };
  assert.equal(stampedFrameText('foes', frame, 4242, FOES_FRAME_MAX), JSON.stringify({ t: 'foes', data: { ...frame, tm: 4242 } }));
  assert.equal(frame.tm, undefined, 'the stream\'s own frame is left as it was built (net/foesQuiet.js reads it)');
  assert.equal(stampedFrameText('foes', frame, null, FOES_FRAME_MAX), JSON.stringify({ t: 'foes', data: frame }), 'nothing stepped yet: the frame an older owner sends');
  const bare = JSON.stringify({ t: 'own', data: frame }).length;
  assert.equal(stampedFrameText('own', frame, 4242, bare), JSON.stringify({ t: 'own', data: frame }), 'a stamp that would carry the frame past its cap gives way - the frame still goes');
  assert.equal(stampedFrameText('own', frame, 4242, bare - 1), null, 'and a frame past the cap without one does not go');
  assert.equal(ownerClock.tm(), null, 'the page\'s own clock: nothing in this file has stepped a foe on it');
});

test('OWNER-CLOCK the session: every foes frame - a cell\'s, a world room\'s host stream - and every own frame says the owner clock in the bytes it sends; a page that never stepped a foe says none; a frame in is applied with its `tm` in hand, and nothing after it holds one (mutants: the foes stamp dropped; the own stamp dropped; either lane delivered bare; the hand kept)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000, tm = 777;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now, ownerTm: () => tm });
  const heard = [];
  s.onFoes = (id, data) => heard.push(['foes', id, data.n, appliedOwnerTm()]);
  s.onOwnFoes = (id, data) => heard.push(['own', id, data.n, appliedOwnerTm()]);
  const bob = { id: 'bob-0002', name: 'Bob', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 } };
  const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
  quiet(() => {
    s.join('world:3,12', pose);
    let ws = sockets.at(-1); ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [bob], host: null, world: null });
    const foes = { n: 1, k: 'world:3,12', full: 1, f: [] };
    assert.equal(s.sendFoes(foes), true);
    assert.equal(ws.sent.at(-1), JSON.stringify({ t: 'foes', data: { ...foes, tm: 777 } }), 'a cell\'s frame says when');
    assert.equal(foes.tm, undefined, 'on the wire alone');
    now += 1000; tm = null;
    assert.equal(s.sendFoes({ ...foes, n: 2 }), true);
    assert.equal(ws.sent.at(-1), JSON.stringify({ t: 'foes', data: { ...foes, n: 2 } }), 'nothing stepped: no `tm`, an older owner\'s frame');
    ws.receive({ t: 'foes', id: 'bob-0002', data: { n: 5, k: 'world:3,12', full: 0, f: [], tm: 555 } });
    ws.receive({ t: 'foes', id: 'bob-0002', data: { n: 6, k: 'world:3,12', full: 0, f: [] } });
    ws.receive({ t: 'foes', id: 'bob-0002', data: { n: 7, k: 'world:3,12', full: 0, f: [], tm: -4 } });
    assert.deepEqual(heard, [['foes', 'bob-0002', 5, 555], ['foes', 'bob-0002', 6, null], ['foes', 'bob-0002', 7, null]], 'each frame applied with its own `tm` in hand - none from an older owner, none from junk');
    assert.equal(appliedOwnerTm(), null, 'and nothing outside a frame holds one');
    // a world room: the host's stream and the own lane
    s.join('dungeon:m188', pose);
    ws = sockets.at(-1); ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [bob], host: 'mac-0001', world: null, v: `world${OWN_RELAY_MIN}` });
    now += 1000; tm = 9001;
    const host = { n: 1, k: 'dungeon:m188', f: [] };
    assert.equal(s.sendFoes(host), true);
    assert.equal(ws.sent.at(-1), JSON.stringify({ t: 'foes', data: { ...host, tm: 9001 } }), 'a dungeon host\'s stream says when');
    now += 1000;
    const mine = { n: 1, full: 1, f: [] };
    assert.equal(s.sendOwnFoes(mine), true);
    assert.equal(ws.sent.at(-1), JSON.stringify({ t: 'own', data: { ...mine, tm: 9001 } }), 'and the own lane');
    heard.length = 0;
    ws.receive({ t: 'own', id: 'bob-0002', data: { n: 3, full: 1, f: [], tm: 1234 } });
    assert.deepEqual(heard, [['own', 'bob-0002', 3, 1234]], 'the own lane is applied with its `tm` in hand');
    assert.equal(appliedOwnerTm(), null);
  });
  assert.equal(applyingOwnerTm({ tm: 3 }, () => applyingOwnerTm({}, () => appliedOwnerTm())), null, 'a frame inside a frame holds its own');
  assert.equal(applyingOwnerTm({ tm: 3 }, () => { applyingOwnerTm({ tm: 4 }, () => 0); return appliedOwnerTm(); }), 3, 'and the outer one\'s comes back');
});

// ---- the relay: its Room on the fake Durable Object ----
const P0 = { x: 402 * PIXEL_UNITS + 100, y: 60, z: (499 - 151) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 };
const CELL = cellRoomOfWire(P0.x, P0.z);
async function stripCell(t) {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  const { subtle } = globalThis.crypto;
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const r = fakeRoom(CELL, { now: () => now });
  Object.assign(r.env, {
    GATE_SIGNING_KEY: Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'),
    GRANT_FEED_URL: 'https://accounts.example/v1/mod/grant-feed',
    ACCOUNTS: { fetch: async () => new Response('{}', { status: 202 }) },
    GRANT_STRIP: 'on',
  });
  const join = async (id, extra = {}) => { const ws = r.connect(); await quiet(() => r.hello(ws, id, P0, { lv: 7, charLevel: 12, ...extra })); return ws; };
  return { r, join };
}

test('OWNER-CLOCK the relay carries `tm` as it carries every word inside a frame: a cell\'s frame with the grant strip ON and a record stripped from it, a world room\'s host stream and its own lane each reach every reader with the owner\'s `tm` exactly, nothing counted as junk; the relay\'s parse and its fan read nothing of it (mutants: none - the relay is untouched; this is its version safety)', async (t) => {
  const tm = POSE_TS_MOD - 1;   // the longest the word can be, in the bytes it was sent
  const data = { n: 1, k: 'world:3,12', full: 1, f: [{ i: 1, t: 0, f: [1, 2, 3] }], tm };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'foes', data }), { hasHello: true }), { t: 'foes', data }, 'the relay\'s parse asks only that `data` is an object');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'own', data }), { hasHello: true }), { t: 'own', data });
  const idx = rd('server/src/index.js');
  assert.doesNotMatch(idx, /data\??\.tm\b/, 'the relay reads no frame\'s `tm` - no relay change, no version (its own `tm` is a traveller\'s mark)');
  assert.match(idx, /out = JSON\.stringify\(g \? \{ t, id, g: 1, data \} : \{ t, id, data \}\);/, 'the fan re-serialises `data` whole');
  assert.match(idx, /return keep\.length === data\.f\.length \? data : \{ \.\.\.data, f: keep \};/, 'and the grant strip keeps every field but the records it strips');
  const C = await stripCell(t);
  const mac = await C.join('sock-mac-01', { gl: GROUND_LAW, gv: GRANT_HELLO_LAW }), zed = await C.join('sock-zed-01');
  const forged = { i: 2, t: 0, f: [1, 2, 3], k: 99_999, h: 99_999 };   // no builder's rat: FOE-BOUNDS strips it at the relay
  const cellFrame = { n: 1, k: CELL, full: 1, f: [{ i: 1, t: 0, f: [1, 2, 3], d: 1 }, forged], tm };
  await C.r.raw(mac, JSON.stringify({ t: 'foes', data: cellFrame }));
  const got = zed.sent.filter((m) => m.t === 'foes');
  assert.equal(got.length, 1, 'the cell\'s frame went');
  assert.deepEqual(got[0].data.f.map((r) => r.i), [1], 'the strip took its record');
  assert.equal(got[0].data.tm, tm, 'and left the owner\'s clock');
  assert.equal((mac.meters?.junk ?? 0), 0, 'a stamped frame is no junk');
  await C.r.room._grantFlush();   // the stripped record's tally goes now, not on its timer
  for (const key of ['dungeon:m187', 'interior:m187.4']) {
    const w = fakeRoom(key);
    const h = w.connect(), j = w.connect();
    await quiet(async () => { await w.hello(h, 'host-0001', P0); await w.hello(j, 'join-0002', P0); });
    const stream = { n: 1, k: key, f: [{ i: 0, t: 0, f: [1, 2, 3] }], tm };
    await w.raw(h, JSON.stringify({ t: 'foes', data: stream }));
    if (key.startsWith('dungeon')) assert.deepEqual(j.sent.filter((m) => m.t === 'foes'), [{ t: 'foes', id: 'host-0001', data: stream }], `${key}: the host's stream, its clock and all`);
    const own = { n: 1, full: 1, f: [{ i: 1, t: 0, f: [1, 2, 3] }], tm };
    await w.raw(j, JSON.stringify({ t: 'own', data: own }));
    assert.deepEqual(h.sent.filter((m) => m.t === 'own'), [{ t: 'own', id: 'join-0002', data: own }], `${key}: the own lane's, its clock and all`);
    assert.equal((h.meters?.junk ?? 0) + (j.meters?.junk ?? 0), 0);
  }
});

test('OWNER-CLOCK the reader: a 3-fps owner\'s foe at its walk is led by the owner\'s time - its target stands still on fewer than one reader frame in fifteen where DESYNC-ZERO\'s stood on a third, and never jumps a quarter metre where it jumped two-thirds; a 2-fps owner\'s slower foe glides where it stood a third of the time; a healthy owner\'s puppet is led as before (mutants: the arrival clock kept; the cap unscaled; the reach unscaled)', () => {
  const at3 = ownerSends({ fps: 3, v: 5 });
  const now = glide(readerTargets(at3).out), was = glide(readerTargets(at3, { law: desyncZeroLead, withTm: false }).out);
  assert.ok(now.still < 1 / 15, `3 fps: still ${now.still.toFixed(3)} of the frames`);
  assert.ok(now.jump < 0.25, `3 fps: the largest step ${now.jump.toFixed(3)} m`);
  assert.ok(was.still > 0.3 && was.jump > 0.6, `DESYNC-ZERO's lead at 3 fps: still ${was.still.toFixed(3)}, a step of ${was.jump.toFixed(3)} m`);
  const at2 = ownerSends({ fps: 2, v: 3.75 });   // the slowest foe there is: (Speed 0 + DF_WALK_BASE) x GLOBAL_SCALE
  const now2 = glide(readerTargets(at2).out), was2 = glide(readerTargets(at2, { law: desyncZeroLead, withTm: false }).out);
  assert.ok(now2.still < 0.02 && now2.jump < 2.5 * 3.75 / 60, `2 fps: still ${now2.still.toFixed(3)}, a step of ${now2.jump.toFixed(3)} m - never much past two frames' walk`);
  assert.ok(was2.still > 0.3, `DESYNC-ZERO's at 2 fps: still ${was2.still.toFixed(3)}`);
  const { p } = readerTargets(at3);
  assert.ok(near(p._lead.cap, Math.min(LEAD_SLOW_MAX_S, 1 / 3 + LEAD_SLACK_S), 2e-3), `the lead covers the owner's interval and a frame's slack: ${p._lead.cap}`);
  // a healthy owner: its words come FOES_MS apart give or take its frame, and so is its lead DESYNC-ZERO's give or take it
  // (LEAD_MAX_S was FOES_MS and the slack: the same law, measured)
  const fast = readerTargets(ownerSends({ fps: 60, v: 5 }));
  assert.ok(fast.p._lead.cap >= LEAD_MAX_S && fast.p._lead.cap <= LEAD_MAX_S + 1 / 60 + 1e-9, `a 60 fps owner's lead: ${fast.p._lead.cap}`);
});

test('OWNER-CLOCK the reader: the road\'s jitter does not move the velocity - the same owner\'s words landing steadily or anywhere from 40 to 200 ms late read one speed, the owner\'s, word for word; on the arrival clock they read a different speed nearly every time (mutants: the arrival clock kept; the owner\'s time read the wrong way round)', () => {
  const speeds = (sends, withTm) => {
    const p = { moving: true, wire: null, tm: null }, out = [];
    for (const s of sends) { p.wire = [s.x, 0, 0]; if (withTm) p.tm = s.tm; puppetLead(p, p.wire, s.at / 1000); out.push(p._lead.vx); }
    return out.slice(2);
  };
  const steady = ownerSends({ fps: 3, v: 5 }), rough = ownerSends({ fps: 3, v: 5, lat: jittery(11) });
  assert.deepEqual(speeds(rough, true), speeds(steady, true), 'one speed, whatever the road did');
  assert.ok(speeds(rough, true).every((v) => near(v, 5, 0.02)), 'and it is the owner\'s: 5 m/s');
  const arrival = speeds(rough, false);
  assert.ok(arrival.filter((v) => !near(v, 5, 0.25)).length > arrival.length / 2, 'the arrival clock reads the road');
});

test('OWNER-CLOCK the reader: an owner\'s word with no `tm` - or a pair where either lacks it - is led by DESYNC-ZERO\'s law exactly, frame for frame, through walks, stops, turns, jumps and a silence (mutants: the cap read without a clock; the reach scaled without one)', () => {
  let seed = 5;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let trial = 0; trial < 20; trial++) {
    const a = { moving: true }, b = { moving: true };
    let x = 0, z = 0, ms = 0;
    for (let k = 0; k < 400; k++) {
      ms += 5 + rnd() * 60;
      if (rnd() < 0.15) { const kind = rnd(); x += kind < 0.1 ? 40 : (rnd() - 0.3) * 3; z += (rnd() - 0.5) * 2; a.moving = b.moving = rnd() < 0.85; }
      const w = [x, rnd() < 0.05 ? 3 : 0, z];
      const got = puppetLead(a, w, ms / 1000), want = desyncZeroLead(b, w, ms / 1000);
      assert.deepEqual([...got], [...want], `trial ${trial}, frame ${k}`);
    }
  }
  // a pair where the newer record carries `tm` and the older does not reads the arrival clock
  const p = { moving: true, tm: null }, q = { moving: true };
  puppetLead(p, [0, 0, 0], 0); desyncZeroLead(q, [0, 0, 0], 0);
  p.tm = 5000;
  assert.deepEqual([...puppetLead(p, [1, 0, 0], 0.5)], [...desyncZeroLead(q, [1, 0, 0], 0.5)]);
  assert.deepEqual([...puppetLead(p, [1, 0, 0], 0.7)], [...desyncZeroLead(q, [1, 0, 0], 0.7)], 'led at the arrival clock\'s 2 m/s, the arrival clock\'s cap');
  p.tm = 5200;
  puppetLead(p, [2, 0, 0], 0.71);
  assert.ok(near(p._lead.vx, 5), 'from the first pair that both say when, the owner\'s time: 1 m in 0.2 s');
});

test('OWNER-CLOCK the reader: bounded - a silent owner\'s word is carried LEAD_SLOW_MAX_S at most and LEAD_DIST_SLOW_MAX at most, below both pools\' PUPPET_SNAP; never less than LEAD_MAX_S; a long gap is taken at once and forgotten at LEAD_GAP_EASE; a new `tm` at the same feet is a word that it stands; a jump and a standing foe lead nothing (mutants: the upper bound dropped; the lower bound dropped; the gap taken whole; the gap read off the arrival clock; a new moment unread)', () => {
  assert.equal(LEAD_DIST_SLOW_MAX, LEAD_DIST_MAX * LEAD_SLOW_MAX_S / LEAD_MAX_S);
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/dungeonContext.js']) {
    const snap = Number(/const PUPPET_SNAP = (\d+(?:\.\d+)?);/.exec(rd(f))?.[1]);
    assert.ok(LEAD_DIST_SLOW_MAX < snap, `${f}: the lead alone never reaches the snap (${LEAD_DIST_SLOW_MAX} < ${snap})`);
  }
  // an owner whose words come a second apart, then goes silent: the time bound
  const slow = { moving: true };
  const word = (pp, x, tm, s) => { pp.tm = tm; return puppetLead(pp, [x, 0, 0], s); };
  word(slow, 0, 0, 0); word(slow, 1, 1000, 1); word(slow, 2, 2000, 2);
  assert.ok(near(slow._lead.cap, LEAD_SLOW_MAX_S), 'a second apart: carried LEAD_SLOW_MAX_S, not past it');
  assert.ok(near(puppetLead(slow, [2, 0, 0], 9)[0], 2 + 1 * LEAD_SLOW_MAX_S), 'a word carried LEAD_SLOW_MAX_S at most (1 m/s)');
  // the distance bound: a fast foe of the same owner
  const run = { moving: true };
  word(run, 0, 0, 0); word(run, 8, 1000, 1);
  const far = puppetLead(run, [8, 0, 0], 9);
  assert.ok(near(far[0] - 8, LEAD_DIST_SLOW_MAX), `never past LEAD_DIST_SLOW_MAX: ${far[0] - 8}`);
  // words 100 ms apart in the owner's time (a burst): never carried less than LEAD_MAX_S
  const burst = { moving: true };
  word(burst, 0, 0, 0); word(burst, 0.2, 100, 0.1); word(burst, 0.4, 200, 0.2);
  assert.ok(near(burst._lead.cap, LEAD_MAX_S), 'never under LEAD_MAX_S');
  assert.ok(near(puppetLead(burst, [0.4, 0, 0], 5)[0], 0.4 + 2 * LEAD_MAX_S), 'carried LEAD_MAX_S');
  // a long gap is taken at once and let go slowly
  const hitch = { moving: true };
  word(hitch, 0, 0, 0); word(hitch, 1, 200, 0.2); word(hitch, 2, 1100, 1.1);
  assert.ok(near(hitch._lead.gap, 0.9), 'a hitch\'s gap taken whole');
  word(hitch, 3, 1300, 1.3);
  assert.ok(near(hitch._lead.gap, 0.9 + (0.2 - 0.9) * LEAD_GAP_EASE), 'and let go at LEAD_GAP_EASE');
  assert.ok(near(hitch._lead.cap, Math.min(LEAD_SLOW_MAX_S, hitch._lead.gap + LEAD_SLACK_S)));
  // pairs on the arrival clock teach the owner's interval nothing
  const late = { moving: true };
  puppetLead(late, [0, 0, 0], 0); puppetLead(late, [1, 0, 0], 1);   // an arrival-clock pair a second apart
  word(late, 2, 5000, 1.2); word(late, 3, 5200, 1.4);
  assert.ok(near(late._lead.cap, LEAD_MAX_S), `the owner's own 0.2 s, not the road's second: ${late._lead.cap}`);
  // a new moment at the same feet: it stands
  const stop = { moving: true };
  word(stop, 0, 0, 0); word(stop, 1, 200, 0.2);
  assert.ok(puppetLead(stop, [1, 0, 0], 0.3)[0] > 1, 'walking: led');
  word(stop, 1, 400, 0.4);
  assert.deepEqual([...puppetLead(stop, [1, 0, 0], 0.5)], [1, 0, 0], 'its owner says it stood there 0.2 s later: led nowhere');
  // a jump (a snap, a floating-origin shift: the same moment, other feet) leads nothing; nor does a standing foe
  const jump = { moving: true };
  word(jump, 0, 0, 0); word(jump, 1, 200, 0.2); word(jump, 40, 400, 0.4);
  assert.deepEqual([...puppetLead(jump, [40, 0, 0], 0.5)], [40, 0, 0], 'a jump leads nothing');
  const shift = { moving: true };
  word(shift, 0, 0, 0); word(shift, 1, 200, 0.2);
  assert.deepEqual([...puppetLead(shift, [101, 0, 0], 0.3)], [101, 0, 0], 'the scene moved under one word: no velocity from it');
  const still = { moving: false };
  word(still, 0, 0, 0); word(still, 1, 200, 0.2);
  assert.deepEqual([...puppetLead(still, [1, 0, 0], 0.3)], [1, 0, 0], 'its owner says it stands');
});

test('OWNER-CLOCK the reader: a clock that stops says nothing - two words with ONE `tm` at other feet (an owner whose mark never came) are led on the arrival clock, never at a velocity of nothing for as long as the clock stands; a word without `tm` forgets the last one\'s, and the lead\'s bound goes back to LEAD_MAX_S with it; a pair too far apart or too close in the owner\'s time teaches its interval nothing (mutants: one moment read as owned; the moment kept past a word without one; the slow cap kept unowned; the gap read outside the range)', () => {
  const word = (pp, x, tm, s) => { pp.tm = tm; return puppetLead(pp, [x, 0, 0], s); };
  // the clock stops: the owner's foe walks on while its frames keep saying the same moment
  const frozen = { moving: true };
  word(frozen, 0, 1000, 0); word(frozen, 1, 1200, 0.2);
  assert.ok(near(frozen._lead.vx, 5), 'two moments: the owner\'s 1 m in 0.2 s');
  word(frozen, 2, 1200, 0.45);
  assert.ok(near(frozen._lead.vx, 4), `one moment twice: the arrival clock's 1 m in 0.25 s - ${frozen._lead.vx}`);
  word(frozen, 3, 1200, 0.65);
  assert.ok(near(frozen._lead.vx, 5) && near(frozen._lead.cap, LEAD_MAX_S), 'and on, at DESYNC-ZERO\'s bound');
  assert.ok(near(puppetLead(frozen, [3, 0, 0], 0.75)[0], 3.5), 'led, not stood still');
  // a word without `tm` between two with: the newer pair is no owner's pair
  const gap = { moving: true };
  word(gap, 0, 1000, 0); word(gap, 1, null, 0.2); word(gap, 2, 1400, 0.45);
  assert.equal(gap._lead.tm, 1400);
  assert.ok(near(gap._lead.vx, 4), `the arrival clock's 1 m in 0.25 s, not the owner's 1 m in 0.4 s across a word that said none - ${gap._lead.vx}`);
  // an owner's slow words, then one without: the bound DESYNC-ZERO's again, frame for frame
  const slow = { moving: true }, dz = { moving: true };
  for (const [x, tm, s] of [[0, 0, 0], [1, 500, 0.5], [2, 1000, 1]]) { word(slow, x, tm, s); desyncZeroLead(dz, [x, 0, 0], s); }
  assert.ok(near(slow._lead.cap, 0.5 + LEAD_SLACK_S), 'words half a second apart: carried 0.6 s');
  word(slow, 3, null, 1.2); desyncZeroLead(dz, [3, 0, 0], 1.2);
  assert.equal(slow._lead.cap, LEAD_MAX_S, 'a word without a clock: DESYNC-ZERO\'s bound');
  assert.deepEqual([...puppetLead(slow, [3, 0, 0], 2.2)], [...desyncZeroLead(dz, [3, 0, 0], 2.2)], 'and DESYNC-ZERO\'s lead');
  // a silence past LEAD_DT_MAX (1.2 s) and a burst under LEAD_DT_MIN (0.04 s) are no interval the owner keeps
  const quiet = { moving: true };
  word(quiet, 0, 0, 0); word(quiet, 1, 500, 0.5); word(quiet, 2, 1000, 1);
  word(quiet, 3, 4000, 4);
  assert.ok(near(quiet._lead.gap, 0.5) && near(quiet._lead.cap, 0.5 + LEAD_SLACK_S), `three seconds of silence: the interval kept, ${quiet._lead.gap}`);
  word(quiet, 3.1, 4020, 4.02);
  assert.ok(near(quiet._lead.gap, 0.5), `a burst 20 ms apart: the interval kept, ${quiet._lead.gap}`);
});

// ---- the encounter pool, owner and reader (the WORLD6b-ii rig: a crafted MONSTER.BSA on flat open ground) ----
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const pool = (self, peers = []) => {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'world:3,12', selfId: () => self, peers: () => peers, now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  return p;
};
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const me = [0, 0, 0], eye = [0, 1.6, 0];

test('OWNER-CLOCK the reader, executed on the real encounter pool: a record applied inside its frame carries the frame\'s `tm` onto the puppet; one a build lands after its frame carries none; three words landing within a millisecond lead at the owner\'s 5 m/s, where an older owner\'s same three words give no velocity at all (mutants: the street\'s door drops the stamp)', async () => {
  const reader = pool('mmm-0002', [{ id: 'bob-0002', feet: [12, 0, 10], height: 1.8 }, { id: 'eve-0003', feet: [12, 0, 10], height: 1.8 }]);
  const pe = playerEntity();
  const rec = (x) => ({ i: 5, t: 0, x: 0, f: [x, 0, 10], y: 0, h: 9, d: 0, a: 0, m: 1, g: '' });
  const word = (from, n, x, tm) => { const data = { n, k: 'world:3,12', full: 1, f: [rec(x)], ...(tm != null ? { tm } : {}) }; applyingOwnerTm(data, () => reader.applyFoes(from, data)); };
  for (const from of ['bob-0002', 'eve-0003']) word(from, 1, 10, from === 'bob-0002' ? 1000 : null);
  for (let i = 0; i < 5; i++) await settle();
  const pup = (from) => reader.foes.find((f) => f.puppet === from && !f.dead);
  assert.ok(pup('bob-0002') && pup('eve-0003'), 'both stood');
  assert.equal(pup('bob-0002')._pup.tm, null, 'its build landed after its frame: no moment of its own');
  reader.update(0.05, me, eye, senses(pe));
  word('bob-0002', 2, 11, 1200); word('eve-0003', 2, 11, null);
  assert.equal(pup('bob-0002')._pup.tm, 1200, 'the frame\'s `tm`, beside the feet');
  assert.equal(pup('eve-0003')._pup.tm, null, 'an older owner\'s: none');
  reader.update(0.05, me, eye, senses(pe));
  word('bob-0002', 3, 12, 1400); word('eve-0003', 3, 12, null);
  reader.update(0.05, me, eye, senses(pe));
  assert.ok(near(pup('bob-0002')._pup._lead.vx, 5), `the owner's 1 m in 0.2 s: ${pup('bob-0002')._pup._lead.vx}`);
  assert.equal(pup('eve-0003')._pup._lead.vx, 0, 'DESYNC-ZERO\'s arrival clock: three words in a millisecond say no speed');
});

test('OWNER-CLOCK the owner: the plan - at 20 fps and up, held, or with nothing to spend, the host\'s one step exactly; under it the HOST\'S OWN FRAME in FOE-CATCHUP\'s own size of step - never more game time than that frame, and whatever is afforded more than the host\'s one step gave a body; a frame past OWNER_CATCHUP_MAX_S stepped OWNER_CATCHUP_STEPS_MAX times and no more (mutants: the cap; the step size; the afforded count unread; the host\'s step lost; a fast frame caught up)', () => {
  assert.equal(OWNER_CATCHUP_STEPS_MAX, 6);
  assert.ok(near(OWNER_CATCHUP_STEPS_MAX * FOE_MAX_FRAME_DT, OWNER_CATCHUP_MAX_S));
  assert.deepEqual(catchUpPlan(1 / 60), { n: 1, dt: 1 / 60 }, '60 fps');
  assert.deepEqual(catchUpPlan(FOE_MAX_FRAME_DT), { n: 1, dt: FOE_MAX_FRAME_DT }, '20 fps: FOE-CATCHUP never cut it');
  assert.deepEqual(catchUpPlan(0), { n: 1, dt: 0 }, 'held');
  assert.deepEqual(catchUpPlan(NaN), { n: 1, dt: NaN }, 'no frame: the host\'s own call');
  assert.deepEqual(catchUpPlan(0.1, 0), { n: 1, dt: 0.1 }, 'nothing afforded: the host\'s own step');
  assert.deepEqual(catchUpPlan(0.1, 0.9), { n: 1, dt: 0.1 }, 'less than a call afforded: none');
  assert.deepEqual(catchUpPlan(0.1), { n: 2, dt: 0.05 }, '10 fps and below (world.js clamps its frame at 0.1 s): the frame in two');
  assert.deepEqual(catchUpPlan(0.1, 5), { n: 2, dt: 0.05 }, 'and no more, whatever is afforded');
  const at15 = catchUpPlan(1 / 15);
  assert.ok(at15.n === 2 && near(at15.n * at15.dt, 1 / 15), `15 fps: the frame in two - ${JSON.stringify(at15)}`);
  assert.deepEqual(catchUpPlan(0.3, 1.9), { n: 2, dt: FOE_MAX_FRAME_DT }, 'a longer host frame and one extra afforded: two full steps, never longer ones');
  const long = catchUpPlan(0.5);
  assert.ok(long.n === OWNER_CATCHUP_STEPS_MAX && near(long.n * long.dt, OWNER_CATCHUP_MAX_S), 'past OWNER_CATCHUP_MAX_S: stepped OWNER_CATCHUP_STEPS_MAX times, no more');
  for (const dt of [0.051, 0.06, 1 / 15, 0.08, 0.1, 0.2, 0.3, 0.5]) {
    for (const extra of [1, 2, 3, 6]) {
      const pl = catchUpPlan(dt, extra);
      assert.ok(pl.dt <= FOE_MAX_FRAME_DT + 1e-12, 'every call a shape FOE-CATCHUP already hands a foe');
      assert.ok(pl.n * pl.dt <= dt + 1e-12, `${dt}/${extra}: never more than the host's own frame`);
      assert.ok(pl.n * pl.dt > FOE_MAX_FRAME_DT, `${dt}/${extra}: more than the host's one step gave a body`);
    }
  }
});

/** A pool whose calls are counted, each costing `cost` ms of the injected clock. */
function countedPool(clock, cost = 0) { const calls = []; return { calls, update(dt) { calls.push(dt); clock.ms += cost; } }; }
/** The body seconds a frame's calls gave a foe (each body takes foeFrameDt of its call). */
const bodyS = (calls) => calls.reduce((a, d) => a + foeFrameDt(d), 0);

test('OWNER-CLOCK the owner: THE PARITY - at every rate world.js\'s clamp allows, a street foe\'s body takes the seconds its owner\'s player takes and never more: 60 to 20 fps the host\'s one call as ever, 15 fps and below the clamped frame (0.1 s from 10 fps down) in FOE-CATCHUP\'s steps; alone, FOE-CATCHUP\'s half below 10 fps; a quarter-second frame is not read as a quarter second of foe time (mutants: the wall time planned; the plan outrunning the host)', () => {
  assert.match(rd('src/scenes/world.js'), /const dt = Math\.min\(0\.1, \(now - last\) \/ 1000\);/, 'the player\'s frame: world.js\'s clamp');
  const perFrame = (fps, shared) => {
    const clock = { ms: 0 };
    const p = catchUpOwnerFoes(countedPool(clock, 1), { shared: () => shared, clock: () => clock.ms, tick: () => {}, mark: () => {} });
    let spent = 0, body = 0;
    for (let k = 0; k < 6; k++) { clock.ms += 1000 / fps - spent; p.calls.length = 0; const t0 = clock.ms; p.update(Math.min(0.1, 1 / fps), me); spent = clock.ms - t0; body = bodyS(p.calls); }
    return body;
  };
  const table = [60, 30, 20, 15, 10, 5, 4, 3, 2, 1].map((fps) => {
    const player = Math.min(0.1, 1 / fps);
    return [fps, +(perFrame(fps, true) / player).toFixed(9), +(perFrame(fps, false) / player).toFixed(9)];
  });
  assert.deepEqual(table, [[60, 1, 1], [30, 1, 1], [20, 1, 1], [15, 1, 0.75], [10, 1, 0.5], [5, 1, 0.5], [4, 1, 0.5], [3, 1, 0.5], [2, 1, 0.5], [1, 1, 0.5]],
    'fps, then a street foe\'s seconds over its owner\'s player\'s a frame - online with anyone else in the room, and alone (as shipped the catch-up gave x2, x2.5 and x3 at 5, 4 and 3 fps)');
});

test('OWNER-CLOCK the owner: online with anyone else in the room, a 4 fps owner\'s street pool keeps its own world\'s pace - the host\'s clamped 0.1 s in two calls of FOE-CATCHUP\'s size, never the wall\'s quarter second; the brain\'s clock carried to each call\'s end; alone or offline the host\'s one call as before; every call marks the owner clock (mutants: the plan unread; the brain left behind; the shared test unread; the mark dropped)', () => {
  const clock = { ms: 0 };
  let shared = true;
  const ticks = [], marks = [], want = [];
  const pool4 = catchUpOwnerFoes(countedPool(clock, 1), { shared: () => shared, clock: () => clock.ms, tick: (d) => ticks.push(d), mark: (m) => marks.push(m) });
  for (let k = 0; k < 9; k++) {
    clock.ms += 250; pool4.calls.length = 0; ticks.length = 0; want.push(clock.ms); pool4.update(0.1, me);
    if (k === 0) { assert.deepEqual(pool4.calls, [0.1], 'the first frame: no cost measured, the host\'s own call'); continue; }
    assert.deepEqual(pool4.calls, [FOE_MAX_FRAME_DT, FOE_MAX_FRAME_DT], `frame ${k}: the host's 0.1 s in two of FOE-CATCHUP's steps`);
    assert.ok(near(ticks.reduce((a, b) => a + b, 0), 0.1 - FOE_MAX_FRAME_DT), 'the brain carried past the host\'s own tick to the bodies\' time');
  }
  assert.deepEqual(marks, want, 'every call marks the moment its foes were stepped');
  clock.ms += 500; pool4.calls.length = 0; pool4.update(0.1, me);
  assert.deepEqual(pool4.calls, [FOE_MAX_FRAME_DT, FOE_MAX_FRAME_DT], '2 fps: the host\'s frame still, never the wall\'s half second');
  shared = false;
  for (let k = 0; k < 3; k++) { clock.ms += 250; pool4.calls.length = 0; ticks.length = 0; pool4.update(0.1, me); assert.deepEqual(pool4.calls, [0.1], 'nobody else in the room: FOE-CATCHUP\'s law, the host\'s own call'); assert.deepEqual(ticks, []); }
  shared = true;
  for (const fps of [60, 20]) { clock.ms += 1000 / fps; pool4.calls.length = 0; pool4.update(1 / fps, me); assert.deepEqual(pool4.calls, [1 / fps], `${fps} fps: the host's own call`); }
  clock.ms += 250; pool4.calls.length = 0; pool4.update(0, me);
  assert.deepEqual(pool4.calls, [0], 'held: held');
});

test('OWNER-CLOCK the owner: where the foes ARE the frame\'s cost the catch-up stands down - the extra call spends OWNER_CATCHUP_SHARE of the frame at the last measured cost, a frame with none affordable takes the host\'s own call, and the first frame (no cost measured) takes it too; time away is no frame - a minute in a building or five seconds of a hidden tab buys nothing, a 1.5 s frame is still a frame (mutants: the share unread; the cost unread; the absence read as a frame)', () => {
  for (const [cost, want] of [[5, [0.05, 0.05]], [20, [0.05, 0.05]], [25, [0.05, 0.05]], [30, [0.1]]]) {
    const clock = { ms: 0 };
    const p = catchUpOwnerFoes(countedPool(clock, cost), { shared: () => true, clock: () => clock.ms, tick: () => {}, mark: () => {} });
    clock.ms += 250; p.update(0.1, me);
    assert.deepEqual(p.calls, [0.1], 'the first frame: no cost measured, the host\'s own call');
    let spent = cost;
    for (let k = 0; k < 4; k++) {
      clock.ms += 250 - spent; p.calls.length = 0;   // a quarter-second frame, its foes' calls and all
      const t0 = clock.ms; p.update(0.1, me);
      spent = clock.ms - t0;
      assert.deepEqual(p.calls, want, `${cost} ms a call`);
      assert.ok(spent - cost <= OWNER_CATCHUP_SHARE * 250 + 1e-9, `the extra call spent ${spent - cost} ms of the frame`);
    }
  }
  assert.equal(FRAME_MS_MAX, 2000);
  for (const [awayMs, want] of [[60_000, [0.1]], [5000, [0.1]], [1500, [0.05, 0.05]]]) {
    const clock = { ms: 0 };
    const q = catchUpOwnerFoes(countedPool(clock, 1), { shared: () => true, clock: () => clock.ms, tick: () => {}, mark: () => {} });
    for (let k = 0; k < 10; k++) { clock.ms += 16.7; q.update(1 / 60, me); }
    clock.ms += awayMs; q.calls.length = 0; q.update(0.1, me);
    assert.deepEqual(q.calls, want, `${awayMs} ms since the pool was last stepped`);
  }
  assert.equal(extrasAfforded(60_000, 1), 0, 'a minute away: no extra call');
  assert.equal(extrasAfforded(FRAME_MS_MAX, 1), FRAME_MS_MAX * OWNER_CATCHUP_SHARE, 'a 0.5 fps frame: its share');
});

test('OWNER-CLOCK the owner: the budget is measured, never assumed - a clock too coarse to see a call (it reads 0, as a privacy-clamped performance.now() does) buys no extra call where a free call bought them all; and the extras stop once their measured time passes the share, whatever the last frame forecast; the dearest of a frame\'s calls prices the next (mutants: a 0 reading priced free; the break dropped; the last call priced)', () => {
  assert.equal(extrasAfforded(250, 0), 0, 'a call read as free buys nothing');
  assert.equal(extrasAfforded(250, Infinity), 0, 'nothing measured buys nothing');
  assert.equal(extrasAfforded(250, NaN), 0, 'a junk reading buys nothing');
  assert.equal(extrasAfforded(250, 5), 5);
  // a clock that never sees a call
  const still = { ms: 0 };
  const a = catchUpOwnerFoes(countedPool(still, 0), { shared: () => true, clock: () => still.ms, tick: () => {}, mark: () => {} });
  for (let k = 0; k < 6; k++) { still.ms += 250; a.calls.length = 0; a.update(0.1, me); assert.deepEqual(a.calls, [0.1], `frame ${k}: a call read at 0 ms is no price`); }
  // 100 ms quanta: a 20 ms call reads 0 or 100, and neither buys a call
  const real = { ms: 0 };
  const b = catchUpOwnerFoes(countedPool(real, 20), { shared: () => true, clock: () => Math.floor(real.ms / 100) * 100, tick: () => {}, mark: () => {} });
  for (let k = 0; k < 200; k++) { real.ms += 230; b.update(0.1, me); }
  assert.equal(b.calls.length, 200, 'one call a frame on a coarse clock');
  // a host frame longer than world.js hands (0.3 s): six calls forecast at 4 ms a call, each costing 10 - the extras stop
  // at the share (25 ms of a 250 ms frame), the brain carried to the last call made
  const clock = { ms: 0 }, costs = [4];
  const ticks = [], cCalls = [];
  const c = catchUpOwnerFoes({ update(dt) { cCalls.push(dt); clock.ms += costs.shift() ?? 10; } }, { shared: () => true, clock: () => clock.ms, tick: (d) => ticks.push(d), mark: () => {} });
  clock.ms += 250; c.update(0.3, me);
  clock.ms += 246; cCalls.length = 0; c.update(0.3, me);
  assert.deepEqual(cCalls, Array(4).fill(Math.min(FOE_MAX_FRAME_DT, 0.3 / 6)), 'the host\'s call and three extras: 30 ms, past the 25 ms share - not six calls');
  assert.ok(near(ticks.reduce((x, y) => x + y, 0), 4 * FOE_MAX_FRAME_DT - FOE_MAX_FRAME_DT), 'the brain carried to the last call made');
  // the dearest call prices the next frame: a frame of a 30 ms call and a 10 ms one affords nothing next
  const d0 = { ms: 0 }, dcost = [10, 30, 10], dCalls = [];
  const d = catchUpOwnerFoes({ update(dt) { dCalls.push(dt); d0.ms += dcost.shift() ?? 10; } }, { shared: () => true, clock: () => d0.ms, tick: () => {}, mark: () => {} });
  d0.ms += 250; d.update(0.1, me);
  d0.ms += 240; dCalls.length = 0; d.update(0.1, me);
  assert.deepEqual(dCalls, [0.05, 0.05], '10 ms forecast: one extra');
  d0.ms += 210; dCalls.length = 0; d.update(0.1, me);
  assert.deepEqual(dCalls, [0.1], 'the frame\'s dearest call (30 ms) prices it past the share');
});

test('OWNER-CLOCK the owner, executed on the real encounter pool: at 4 fps its foe\'s body takes six FIXED_DT steps a frame through the catch-up - the 0.1 s its owner\'s player takes - where FOE-CATCHUP alone gives it three (mutants: the plan unread)', async () => {
  const counts = [];
  for (const caught of [true, false]) {
    const owner = pool('aaa-0001');
    const rat = await owner.spawnFoe(0, [10, 0, 10], { feetGiven: true });
    assert.ok(rat, 'stood');
    let steps = 0;
    const step = rat.ai._step.bind(rat.ai);
    rat.ai._step = (...a) => { steps++; return step(...a); };
    const clock = { ms: 0 };
    const pe = playerEntity();
    if (caught) catchUpOwnerFoes(owner, { shared: () => true, clock: () => (clock.ms += 0.5), tick: () => {}, mark: () => {} });   // every read a half-millisecond on: a call is seen to cost
    for (let k = 0; k < 9; k++) { clock.ms += 250; owner.update(0.1, me, eye, senses(pe)); }
    counts.push(steps);
  }
  assert.ok(Math.abs(counts[0] - 3 - 8 * 6) <= 1, `caught up: ${counts[0]} steps (the first frame the host's own three, then six a frame)`);
  assert.equal(counts[1], 9 * 3, 'FOE-CATCHUP alone: three a frame');
});

test('OWNER-CLOCK the mode machine: a building\'s and a dungeon\'s foes are stepped in its frame - a frame that ran marks the clock at its `now`, one that did not (the street\'s) marks nothing, and the answer the host gates on is the frame\'s own (the MODAL CONTRACT) (mutants: the mark dropped; marked when the street ran; the answer replaced)', () => {
  const marks = [];
  let ran = true;
  const modes = markModalSteps({ frame: (dt, now) => (now > 0 ? ran : false) }, { mark: (m) => marks.push(m) });
  assert.equal(modes.frame(0.016, 100), true);
  ran = false;
  assert.equal(modes.frame(0.016, 200), false);
  assert.deepEqual(marks, [100]);
});

test('OWNER-CLOCK the wiring by source: the world host wires it once, beside the mode machine, with nobody-else-here as the street\'s test; the hosts\' own calls stand as they stood (the street\'s step, the modal frame, the streams); the session stamps at its two doors and holds the frame at its two deliveries; both pools copy the moment beside the feet; no pool reads `data.tm` itself (mutants: the dungeon\'s door drops the stamp)', () => {
  const w = rd('src/scenes/world.js');
  assert.equal((w.match(/wireOwnerClock\(/g) ?? []).length, 1);
  // PIN MOVED (HOST-CLOCK, test/scenes/fb1021b_hostclock.test.js): the street's watch rides the one statement beside its encounter pool
  assert.match(w, /\n {2}\}\);\n {2}wireOwnerClock\(\[exteriorFoes, cityGuards\], modes, \(\) => online\?\.status === 'open' && online\.othersHere > 0\);/, 'after the mode machine is made, with the streams\' own nobody-to-hear test (foesStream\'s `othersHere === 0`)');
  assert.match(w, /exteriorFoes\.update\(foeDt, _pf, cam\.pos, _foeSenses\(\)\);/, 'the street\'s step is the host\'s as it was');
  assert.match(w, /if \(modes\.frame\(dt, now\)\) \{/);
  assert.match(w, /if \(online\.othersHere === 0\) \{ _foesFullAt = -Infinity; return false; \}/);
  const o = rd('src/net/online.js');
  assert.match(o, /const s = stampedFrameText\('foes', data, this\._ownerTm\(\), FOES_FRAME_MAX\);/);
  assert.match(o, /const s = stampedFrameText\('own', data, this\._ownerTm\(\), FOES_FRAME_MAX\);/);
  assert.match(o, /this\._deliver\('foes', \(\) => applyingOwnerTm\(m\.data, \(\) => this\.onFoes\?\.\(m\.id, m\.data\)\)\);/);
  assert.match(o, /this\._deliver\('own', \(\) => applyingOwnerTm\(m\.data, \(\) => this\.onOwnFoes\?\.\(m\.id, m\.data\)\)\);/);
  const x = rd('src/scenes/exteriorFoes.js'), d = rd('src/scenes/dungeonContext.js');
  assert.match(x, /p\.wire = r\.f;\n\s*p\.tm = appliedOwnerTm\(\);/, 'the street\'s door: beside the feet');
  assert.match(d, /\{ p\.feet\[0\] = r\.f\[0\]; p\.feet\[1\] = r\.f\[1\]; p\.feet\[2\] = r\.f\[2\]; p\.tm = appliedOwnerTm\(\); \}/, 'the dungeon\'s door: beside the feet');
  for (const [f, t] of [['exteriorFoes', x], ['dungeonContext', d], ['puppetLead', rd('src/scenes/puppetLead.js')]]) assert.doesNotMatch(t, /data\.tm\b/, `${f} reads the frame's clock through net/ownerClock.js alone`);
  // the steps the catch-up takes are FOE-CATCHUP's own size, so its pins hold: the pools still hand their bodies foeFrameDt
  assert.match(x, /f\.ai\.update\(foeFrameDt\(dt\), playerFeet, _armed\(f, senses\), _fParalyzed, _fPaused\);/);
  assert.equal(FIXED_DT * 3, FOE_MAX_FRAME_DT);
});

test('OWNER-CLOCK the wiring, executed: wireOwnerClock - the world host\'s one statement - on a street pool and a mode machine, with the page\'s own owner clock, its own tactics clock and its own performance.now() (mocked): shared and slow, the street\'s frame is the host\'s 0.1 s in two calls and the brain is carried to the second\'s end; alone, the host\'s one call; every street call, and every modal frame that ran, marks the page\'s clock at its moment (mutants: `shared` not handed on; the street left unwrapped; the modal steps unmarked; the default mark dropped; the default tick dropped)', (t) => {
  let now = 50_000;
  t.mock.method(performance, 'now', () => now);
  const calls = [];
  const street = { update(dt) { calls.push(dt); now += 2; } };   // a call the page's clock sees cost 2 ms
  let ran = true, shared = true;
  const modes = { frame: () => ran };
  wireOwnerClock([street], modes, () => shared);   // PIN MOVED (HOST-CLOCK): the street's pools, a list (world.js hands the encounter pool and the watch)
  street.update(0.1, me);
  assert.deepEqual(calls, [0.1], 'the first frame: nothing measured, the host\'s one call');
  assert.equal(ownerClock.tm(), 50_000, 'the street\'s call marks the page\'s clock');
  const brain = tacticsNow();
  now += 248; calls.length = 0;
  street.update(0.1, me);
  assert.deepEqual(calls, [FOE_MAX_FRAME_DT, FOE_MAX_FRAME_DT], 'shared and a quarter-second frame: the host\'s 0.1 s in two');
  assert.ok(near(tacticsNow() - brain, 0.1 - FOE_MAX_FRAME_DT), `the page's brain carried past the host's tick: ${tacticsNow() - brain}`);
  assert.equal(ownerClock.tm(), 50_250);
  shared = false; now += 246; calls.length = 0;
  street.update(0.1, me);
  assert.deepEqual(calls, [0.1], 'nobody else in the room: the host\'s one call');
  assert.equal(modes.frame(0.1, 60_123.4), true, 'a modal frame that ran: its own answer');
  assert.equal(ownerClock.tm(), 60_123, 'and the page\'s clock marked at its `now`');
  ran = false;
  assert.equal(modes.frame(0.1, 70_000), false);
  assert.equal(ownerClock.tm(), 60_123, 'a frame that ran nothing marks nothing');
});
