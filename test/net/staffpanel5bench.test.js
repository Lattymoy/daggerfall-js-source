// STAFF-PANEL5-FOLLOW (2026-10-22, design doc "DFO Staff Panel: design", Invisible follow; the weak spot "Follow can't
// learn the target's next room": "Measure the bus cost first") - WHAT THE WHERE NOTE AND A FOLLOW COST THE BUS, measured
// on the fake hub (test/fakeRoom.mjs) through the bus's own party arm, end to end. A bench on this machine, not live:
// the numbers print, and the bounds asserted are loose (the machine is shared).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { SOCIAL_ROOM } from '../../src/net/wire.js';
import { mintToken } from '../../src/net/identityToken.js';
import { noteOf, followJoined, followLeft } from '../../server/src/staffFollow.js';
import { WHERE_NOTE_MOVING_MS } from '../../src/net/staffFollow.js';

const { subtle } = globalThis.crypto;
/** A where note - the party pose (net/wire.js validPartyPose) - standing in `rk`. */
const note = (rk = 'world:100,100', more = {}) => ({ px: 100, py: 100, in: 0, loc: 'Daggerfall', h: 50, hm: 60, f: 40, fm: 40, m: 10, mm: 20, rk, ...more });
const fol = (ws, k) => ws.sent.filter((m) => m.t === 'fol' && (!k || m.k === k));

/** A spectator's hello: its token says `hd` 1 and the account it follows (`fo`), as server-account/src/staffFollow.js mints it. */
async function spectator(r, id, fo, extra = {}) {
  const kp = await r.signer();
  const tok = await mintToken({ s: `hd-${id}`, n: 'Spectator', k: 'guest', hd: 1, fo }, kp.privateKey, { subtle, nowS: Math.floor(r.now() / 1000) - 1 });
  const ws = r.connect();
  await r.hello(ws, id, extra.pose ?? null, { name: 'Spectator', tok, ...extra });
  return ws;
}

/** The hub, on a clock of its own: `join` a player's hub link (an account's), `party` a where note from it. */
async function hub(fn) {
  let now = 1e12;
  const realNow = Date.now; Date.now = () => now;
  const r = fakeRoom(SOCIAL_ROOM, { now: () => now });
  const tick = (ms = 1000) => { now += ms; };
  const join = async (id, name = id, glyphs = []) => { const ws = r.connect(); await r.hello(ws, id, null, { name, glyphs, acct: `acct-${id}`, asecret: `secret-${id}` }); tick(); return ws; };
  const party = (ws, p) => r.raw(ws, JSON.stringify({ t: 'party', p }));
  try { await fn({ r, tick, join, party, now: () => now }); } finally { Date.now = realNow; }
}

test('STAFF-PANEL5-FOLLOW bench: what the where note and the follow cost the bus, measured', () => hub(async ({ r, tick, join, party, now }) => {
  // the hub with ONLINE accounts on it, every one sending its note; then the same with a follow standing - the bus's own
  // party arm, end to end through webSocketMessage (the frame's parse, the meter, the attachment, the follow's look)
  const ONLINE = 400, NOTES = 4000;
  const links = [];
  for (let i = 0; i < ONLINE; i++) links.push(await join(`peer-n${i}`, `Walker${i}`));
  const time = async (n, fn) => { const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) await fn(i); return Number(process.hrtime.bigint() - t0) / 1e6 / n; };
  // each note a moved one (a fresh pixel), so every follow's look runs in full
  const msNote = await time(NOTES, (i) => { if (i % ONLINE === 0) tick(1000); return party(links[i % ONLINE], note(`world:${i % 900},${(i / 900) | 0}`, { px: i % 900, py: (i / 900) | 0 })); });
  assert.equal(noteOf(r.room, `acct-peer-n${NOTES % ONLINE + 5}`, now())?.p.px, (NOTES - ONLINE + 5) % 900, 'every note was taken, none metered away');
  const spies = [];
  for (let i = 0; i < 16; i++) spies.push(await spectator(r, `peer-spy${i}`, `acct-peer-n${i}`));
  const msFollowed = await time(NOTES, (i) => { if (i % ONLINE === 0) tick(1000); return party(links[i % ONLINE], note(`world:${(i + 1) % 900},${(i / 900) | 0}`, { px: (i + 1) % 900, py: (i / 900) | 0 })); });
  assert.ok(fol(spies[3], 'note').length >= NOTES / ONLINE - 1, 'and each follow heard its target\'s every room');
  // a leave and a join where nobody follows: one look-up each (followLeft/followJoined on their own)
  const fake = { _follows: new Map(), _fol: new Map(), _bySub: () => new Map(), _attach: () => ({}), _dead: new Set(), _gone: new Set() };
  const msLeave = await time(100_000, () => followLeft(fake, {}, { id: 'x', sub: 'acct-nobody', key: 'world:1,1' }));
  const msJoin = await time(100_000, () => followJoined(fake, {}, { id: 'x', sub: 'acct-nobody', key: 'world:1,1' }));
  const read = await time(10_000, (i) => noteOf(r.room, `acct-peer-n${i % ONLINE}`, now()));
  // the scale: 10,000 online outside a party, each moving (a note every WHERE_NOTE_MOVING_MS) - 2,000 notes a second
  const perSecond = (10_000 / (WHERE_NOTE_MOVING_MS / 1000));
  const line = `bus bench (fake hub, this machine): a note ${msNote.toFixed(4)} ms (${msFollowed.toFixed(4)} ms with 16 follows standing); `
    + `2,000 notes/s (10,000 online, all moving) = ${(msNote * perSecond).toFixed(1)} ms of each second; `
    + `a staff read of a note ${read.toFixed(4)} ms; a room's leave/join where nobody follows ${(msLeave * 1000).toFixed(3)}/${(msJoin * 1000).toFixed(3)} us`;
  console.log(line);
  // loose bounds - the machine is shared; the numbers above are the measurement
  assert.ok(msNote < 5, line);
  assert.ok(msFollowed < msNote * 3 + 1, line);
  assert.ok(msLeave < 0.01 && msJoin < 0.01, line);
  void spies;
}));

// STAFF-PANEL5-FEEDS-FIX (the relay flaw review, findings 9 and 12; mob: features only "if it wont affect server") - WHAT
// THE FEEDS' FIXES COST A FRAME: a pose read by two open episodes (the teleport check one compare), and a quiet sender's
// full foes frame (no row made now). A bench on this machine, not live: the numbers print, the bounds are loose.
test('STAFF-PANEL5-FEEDS-FIX bench: a pose read by open episodes and a quiet foes frame stay a few microseconds, and quiet senders hold no memory', async (t) => {
  const { staffReactAsk, staffReactPose, staffFoesSeen, staffFeedsStop } = await import('../../server/src/staffFeeds.js');
  const room = { env: { REACTION_FEED_URL: 'https://a.example/r', STAFF_NET_FEED_URL: 'https://a.example/n' }, _all: () => [], _meters: new Map(), _receiptKeyOf: async () => null };
  t.after(() => staffFeedsStop(room));   // a failed assert must not leave the feed's timer holding the file open
  const ws = {}, now0 = 1e12, pose = { x: 100, y: 60, z: 100, yaw: 0, pitch: 0 };
  for (let i = 0; i < 2; i++) staffReactAsk(room, ws, { key: 'world:1,1', sub: 'acct-bench-01', pose }, { k: 'enc', n: 1 }, now0);
  const time = (n, fn) => { const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) fn(i); return Number(process.hrtime.bigint() - t0) / 1e3 / n; };
  const usPose = time(100_000, (i) => staffReactPose(room, ws, { ...pose, x: 100 + (i % 7), yaw: i % 3 }, now0 + i * 0.5));   // 50 s of poses, inside the episodes' length
  const frame = { full: 1, f: Array.from({ length: 24 }, (_, i) => ({ i: i + 1, t: 5 })) };
  const usFoes = time(100_000, (i) => staffFoesSeen(room, { key: 'world:1,1', sub: `acct-q${String(i % 256).padStart(4, '0')}` }, frame, now0));
  staffFeedsStop(room);
  const line = `feeds bench (this machine): a pose with 2 open episodes ${usPose.toFixed(3)} us; a quiet 24-monster foes frame ${usFoes.toFixed(3)} us; quiet senders' rows ${room._staffNet.foes.size}`;
  console.log(line);
  assert.equal(room._staffNet.foes.size, 0, line);
  assert.ok(usPose < 50 && usFoes < 50, line);
});

// STAFF-PANEL5-MONSTERS (2026-10-23; mob wants all three feed pages working with grantStrip off, and "it need to not hurt
// server performance") - WHAT COUNTING MONSTERS WITH grantStrip OFF COSTS A FOES FRAME: staffFoesSeen on every fanned
// frame (the feed's URL unset, one compare; set, a delta two; a full frame one pass over its records), against the fan it
// rides - a full cell's frame to 31 listeners through the Room's own _foesFan, its parse included, every send a no-op (so
// the fan is cheaper than live and the share an upper bound). A bench on this machine, not live: the numbers print, the
// bounds are loose. On a shared machine the fan's pair swings by more than the count costs, so the count timed alone is
// the measure: an honest frame mix adds about 0.9 x a delta's + 0.1 x a full frame's to each frame's fan.
test('STAFF-PANEL5-MONSTERS bench: the monster count on every fanned foes frame with grantStrip off, against the fan', async (t) => {
  const { staffFoesSeen, staffFeedsStop } = await import('../../server/src/staffFeeds.js');
  const { cellRoomOfWire, PIXEL_UNITS, FOES_FULL_MS } = await import('../../src/net/wire.js');
  const { FOES_MS } = await import('../../src/net/online.js');
  const URL_ON = 'https://a.example/n';
  const P = { x: 402 * PIXEL_UNITS + 100, y: 60, z: (499 - 151) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 };
  const CELL = cellRoomOfWire(P.x, P.z);
  let now = 1.8e12;
  const realNow = Date.now; Date.now = () => now;
  try {
    const r = fakeRoom(CELL, { now: () => now });
    const socks = [];
    for (let i = 0; i < 32; i++) { now += 1000; const ws = r.connect(); await r.hello(ws, `sock-b${String(i).padStart(3, '0')}`, P); socks.push(ws); }   // the room's hello gate
    for (const ws of socks) ws.send = () => {};   // the fan's sends a no-op: the fan's own work alone
    const rec = (i) => ({ i, t: i % 9, h: 40, k: 40, x: P.x + i, y: 60, z: P.z + i, yw: i / 10, f: [1, 2, 3] });
    const text = (n, full) => JSON.stringify({ t: 'foes', data: { n: 1, k: CELL, full, f: Array.from({ length: n }, (_, i) => rec(i + 1)) } });
    const delta = text(24, 0), full24 = text(24, 1), full64 = text(64, 1);
    const fullEvery = FOES_FULL_MS / FOES_MS;   // an honest sender's one full frame in ten
    const room = r.room;
    t.after(() => staffFeedsStop(room));   // a failed assert must not leave the feed's timer holding the file open
    /** Microseconds a frame through the fan: `frames(i)` the i-th frame's text, the senders in turn, the clock at the room's budget. */
    const fan = (frames, n = 2000) => {
      const sends = room._metrics.c.sends, t0 = process.hrtime.bigint();
      for (let i = 0; i < n; i++) {
        const ws = socks[i % socks.length], message = frames(i);
        now += 50;   // within the room's budget at 64 records: every frame fans
        room._roomFoes = room._foesFan(ws, room._attach(ws), 'foes', JSON.parse(message).data, message, true, room._roomFoes, now);
      }
      const us = Number(process.hrtime.bigint() - t0) / 1e3 / n;
      assert.equal(room._metrics.c.sends - sends, n * (socks.length - 1), 'every frame fanned to every listener');
      return us;
    };
    const honest = (i) => (Math.floor(i / socks.length) % fullEvery === 0 ? full24 : delta);
    const median = (xs) => [...xs].sort((x, y) => x - y)[xs.length >> 1];
    const worstFrames = () => full64;   // a client that calls every frame full, at the cell's 64 records, every one over the limit
    const runs = { honestOff: [], honestOn: [], worstOff: [], worstOn: [] };
    const as = (url, frames) => { if (url) r.env.STAFF_NET_FEED_URL = url; else delete r.env.STAFF_NET_FEED_URL; return fan(frames); };
    fan(honest); fan(worstFrames);   // warm
    for (let round = 0; round < 6; round++) {   // each pair in both orders, so neither side is always first
      const first = round % 2 ? URL_ON : undefined, second = round % 2 ? undefined : URL_ON;
      for (const [frames, off, on] of [[honest, runs.honestOff, runs.honestOn], [worstFrames, runs.worstOff, runs.worstOn]]) {
        (first ? on : off).push(as(first, frames));
        (second ? on : off).push(as(second, frames));
      }
    }
    staffFeedsStop(room);
    assert.ok(socks.every((ws) => room._attach(ws).id && !ws.closed), 'every sender stood');
    // the count alone, the same frames
    const a = room._attach(socks[0]), d24 = JSON.parse(delta).data, f24 = JSON.parse(full24).data, f64 = JSON.parse(full64).data;
    const alone = (data, env) => { room.env.STAFF_NET_FEED_URL = env; const t0 = process.hrtime.bigint(); for (let i = 0; i < 100_000; i++) staffFoesSeen(room, a, data, now); return Number(process.hrtime.bigint() - t0) / 1e3 / 100_000; };
    const usUnset = alone(f24, undefined), usDelta = alone(d24, URL_ON), usFull24 = alone(f24, URL_ON), usFull64 = alone(f64, URL_ON);
    staffFeedsStop(room);
    const [hOff, hOn, wOff, wOn] = [runs.honestOff, runs.honestOn, runs.worstOff, runs.worstOn].map(median);
    const pct = (x, base) => `${x >= base ? '+' : ''}${(((x - base) / base) * 100).toFixed(1)}%`;
    const line = `monsters bench (this machine, medians of 6): a foes frame through _foesFan to 31 listeners, one full in ${fullEvery} of 24 monsters, `
      + `${hOff.toFixed(2)} us with the feed's URL unset, ${hOn.toFixed(2)} us set (${pct(hOn, hOff)}); every frame full of 64 over the limit ${wOff.toFixed(2)} us unset, `
      + `${wOn.toFixed(2)} us set (${pct(wOn, wOff)}); the count alone: unset ${(usUnset * 1000).toFixed(0)} ns, a delta ${(usDelta * 1000).toFixed(0)} ns, `
      + `a full 24 ${usFull24.toFixed(3)} us, a full 64 over the limit ${usFull64.toFixed(3)} us`;
    console.log(line);
    // loose bounds - the machine is shared; the numbers above are the measurement
    assert.ok(usUnset < 1 && usDelta < 1, line);
    assert.ok(usFull24 < 50 && usFull64 < 100, line);
  } finally { Date.now = realNow; }
});

// STAFF-PANEL5-MONSTERS REVIEW (2026-10-23) - THE ONE LANE WITHOUT A RECORD CAP: a world room's host `foes` frame is held
// by FOES_FRAME_MAX bytes alone (a cell's and the own lane's by CELL_FRAME_RECORDS_MAX), so at the door's cap it carries
// about 6,000 records and the count's walk of it costs about what the frame's own parse does. So the count walks one full
// frame each FOES_FIRST_MS on a sender's lane. Timed here: one walk of the host's frame at the cap, against its parse and
// the fan's stringify; a host saying full on every frame at FOES_HZ_MAX, through the count with its lane and through the
// Room's own _foesFan to one listener (the count's share is largest where the fan is smallest), the feed's URL unset and
// set; and an honest dungeon host's 150 monsters. A bench on this machine, not live: the numbers print, the bounds are loose.
test('STAFF-PANEL5-MONSTERS REVIEW bench: a world room host\'s uncapped foes frame, every one full at FOES_HZ_MAX - one walked a second - against its parse and fan', async (t) => {
  const { staffFoesSeen, staffFeedsStop } = await import('../../server/src/staffFeeds.js');
  const { FOES_FRAME_MAX, FOES_HZ_MAX, FOES_FIRST_MS } = await import('../../src/net/wire.js');
  const URL_ON = 'https://a.example/n', ROOM = 'interior:m123456.7', POS = { x: 3, y: 1, z: 4, yaw: 0, pitch: 0 }, STEP = 1000 / FOES_HZ_MAX;
  let now = 1.8e12;
  const realNow = Date.now; Date.now = () => now;
  t.after(() => { Date.now = realNow; });
  const r = fakeRoom(ROOM, { now: () => now });
  const room = r.room;
  t.after(() => staffFeedsStop(room));
  const host = r.connect(); await r.hello(host, 'sock-host-01', POS);
  now += 1000;   // the room's host is its longest in
  const guest = r.connect(); await r.hello(guest, 'sock-guest-01', POS);
  guest.send = () => {};   // the fan's send a no-op: the fan's own work alone
  const a = room._attach(host);
  const mk = (n) => `{"t":"foes","data":{"n":1,"k":"${ROOM}","lc":1,"f":[${Array.from({ length: n }, (_, i) => `{"i":${i}}`).join(',')}]}}`;
  let n = 7000;
  while (mk(n).length > FOES_FRAME_MAX) n -= 10;
  const atCap = mk(n), data = JSON.parse(atCap).data;
  const dungeon = JSON.parse(`{"lc":1,"f":[${Array.from({ length: 150 }, (_, i) => JSON.stringify({ i, t: i % 30, h: 40, k: 40, x: 1000 + i, y: 60, z: 2000 + i, yw: 0.5, f: [1, 2, 3] })).join(',')}]}`);
  const us = (k, fn) => { const t0 = process.hrtime.bigint(); for (let i = 0; i < k; i++) fn(i); return Number(process.hrtime.bigint() - t0) / 1e3 / k; };
  const median = (xs) => [...xs].sort((x, y) => x - y)[xs.length >> 1];
  const five = (k, fn) => median([0, 1, 2, 3, 4].map(() => us(k, fn)));
  r.env.STAFF_NET_FEED_URL = URL_ON;
  const parse = five(50, () => JSON.parse(atCap)), str = five(50, () => JSON.stringify({ t: 'foes', id: a.id, data }));
  const walk = five(50, () => staffFoesSeen(room, a, data, now));   // no lane: every call walked
  assert.equal(room._staffNet.foes.get(a.sub || a.id)?.h, data.f.length, 'the frame counted');
  const lane = {}, frames = 600;
  let walks = 0;
  const gated = five(frames, () => { now += STEP; const was = lane.counted; staffFoesSeen(room, a, data, now, lane); if (lane.counted !== was) walks++; });
  assert.ok(walks <= Math.ceil((5 * frames * STEP) / FOES_FIRST_MS) + 1, `one walk each FOES_FIRST_MS on the lane (${walks} of ${5 * frames})`);
  const honest = five(1000, () => staffFoesSeen(room, a, dungeon, now));
  // the host's every frame through the fan, the URL unset and set, each pair in both orders
  const fan = (url) => {
    if (url) r.env.STAFF_NET_FEED_URL = url; else delete r.env.STAFF_NET_FEED_URL;
    const sends = room._metrics.c.sends;
    const x = us(120, () => { now += STEP; room._roomFoes = room._foesFan(host, a, 'foes', JSON.parse(atCap).data, atCap, false, room._roomFoes, now); });
    assert.equal(room._metrics.c.sends - sends, 120, 'every frame fanned');
    return x;
  };
  fan(); fan(URL_ON);   // warm
  const off = [], on = [];
  for (let k = 0; k < 6; k++) for (const url of k % 2 ? [undefined, URL_ON] : [URL_ON, undefined]) (url ? on : off).push(fan(url));
  const [fOff, fOn] = [off, on].map(median);
  const pct = (x, base) => `${x >= base ? '+' : ''}${(((x - base) / base) * 100).toFixed(1)}%`;
  const line = `world host bench (this machine, medians): a host's foes frame at FOES_FRAME_MAX, ${data.f.length} monsters (${atCap.length} B): one walk ${walk.toFixed(1)} us `
    + `(its parse ${parse.toFixed(1)} us, the fan's stringify ${str.toFixed(1)} us; walked on every frame at FOES_HZ_MAX it was ${(walk * FOES_HZ_MAX / 1000).toFixed(2)} ms of each second); `
    + `every frame full at FOES_HZ_MAX through the count with its lane ${gated.toFixed(2)} us a frame, ${(gated * FOES_HZ_MAX / 1000).toFixed(3)} ms of each second (${walks} walks of ${5 * frames} frames); `
    + `parse + _foesFan to 1 listener ${fOff.toFixed(1)} us unset, ${fOn.toFixed(1)} us set (${pct(fOn, fOff)}); an honest dungeon host's 150 ${honest.toFixed(2)} us a walk`;
  console.log(line);
  // loose bounds - the machine is shared; the numbers above are the measurement
  assert.ok(gated < walk / 4 && honest < 100 && walk < 20_000, line);
});
