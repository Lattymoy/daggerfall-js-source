// SCALE3 (2026-10-08, Mac: "Do 1 2 and 3"): THE LOAD HARNESS's parts that stand without a toolchain
// (tools/loadHarness.mjs - the run itself needs wrangler and minutes, the account probe's reason for living outside the
// suite). What is pinned is what keeps the harness honest and harmless: it reaches its own two services and nothing
// else (the client falls back to the PRODUCTION account service for any base it does not take, so the bots' fetch
// refuses every other address before a byte leaves); a socket that failed to open closes as a browser closes it, or a
// fleet never comes back from a storm; the knobs refuse what they do not know; and the fleet stands where the relay's
// range puts every bot of a town beside every other. tools/mutants/scale3.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  parseArgs, KNOBS, LOAD_SERVICE, localFetch, localWebSocket, relayTally, percentile, townPixel, poseAt, saveText, botStorage,
  FIRE_MINUTE, FIRE_HOUR, reservoir, mergeFleets, POSE_SAMPLE_MAX,
} from '../tools/loadHarness.mjs';
import { CRON_MINUTE, CRON_HOUR } from '../server-account/src/cron.js';
import { pixelDistance, worldRoom, cellHaloFor, RANGE_PIXELS } from '../src/net/wire.js';
import { serviceBase, DEFAULT_ACCOUNT_SERVICE, SERVICE_KEY } from '../src/net/accountClient.js';
import { DEFAULT_SERVER } from '../src/net/online.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('SCALE3: the bots\' fetch reaches the local service and nothing else - the production service above all, which the client falls back to for any base it does not take; the base the bots hold is one the client takes (mutants: the refusal dropped, the production base mapped through)', async () => {
  // the client takes the bots' base as it stands - an https base it never rewrites to production
  assert.equal(serviceBase(botStorage({ [SERVICE_KEY]: LOAD_SERVICE })), LOAD_SERVICE);
  assert.match(LOAD_SERVICE, /\.invalid$/, 'a name that resolves nowhere, should anything ever ask the network for it');
  const asked = [];
  const request = (opts, onRes) => {
    asked.push(opts);
    const res = new (class { on(ev, fn) { if (ev === 'data') setTimeout(() => fn(Buffer.from('{"ok":true}')), 0); if (ev === 'end') setTimeout(fn, 1); return this; } })();
    res.statusCode = 200; res.headers = { 'content-type': 'application/json' };
    setTimeout(() => onRes(res), 0);
    return { on() { return this; }, write() {}, end() {}, destroy() {} };
  };
  const heard = [];
  const fetch = localFetch({ port: 8870, ip: '10.0.0.7', note: (...a) => heard.push(a), request });
  const r = await fetch(`${LOAD_SERVICE}/v1/account/played`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(asked.length, 1);
  assert.equal(asked[0].host, '127.0.0.1');
  assert.equal(asked[0].port, 8870);
  assert.equal(asked[0].path, '/v1/account/played');
  assert.equal(asked[0].headers['cf-connecting-ip'], '10.0.0.7', 'each bot its own address - the service bounds an address\'s sign-ups');
  assert.deepEqual(heard.map(([route, status]) => [route, status]), [['/v1/account/played', 200]]);
  for (const url of [`${DEFAULT_ACCOUNT_SERVICE}/v1/auth/token`, 'https://example.com/v1/health', `http://127.0.0.1:8870/v1/health`, `${LOAD_SERVICE}.evil.example/v1/health`]) {
    await assert.rejects(fetch(url, {}), /reaches its own services only/, url);
  }
  assert.equal(asked.length, 1, 'nothing left for a refused address');
});

test('SCALE3: the bots\' sockets open to the local relay alone, count every frame by type and every pose\'s age, and a socket that failed to open closes 1006 as a browser closes it - Node\'s fires the error alone, and the client\'s retry waits on the close (mutants: the guard dropped, the close never said, a close said for a socket that opened)', async () => {
  class Base extends EventTarget {
    constructor(url) { super(); this.url = url; this.sent = []; }
    send(d) { this.sent.push(d); }
  }
  const tally = relayTally();
  let now = 5000;
  const WS = localWebSocket({ port: 8871, tally, Base, now: () => now });
  for (const url of [`${DEFAULT_SERVER}/room/world:13,13`, 'ws://127.0.0.1:9999/room/world:1,1', 'ws://example.com:8871/room/x']) {
    assert.throws(() => new WS(url), /reaches its own relay only/, url);
  }
  const ws = new WS('ws://127.0.0.1:8871/room/world:13,13');
  const closes = [];
  ws.onclose = (ev) => closes.push(ev.code);
  ws.send(JSON.stringify({ t: 'pose', p: { x: 1, ts: 4990 } }));
  ws.send('{"t":"ping"}');
  assert.deepEqual(tally.outByType, { pose: 1, ping: 1 });
  ws.dispatchEvent(Object.assign(new Event('message'), { data: '{"t":"pose","id":"pbot","p":{"x":1,"ts":4970}}' }));
  ws.dispatchEvent(Object.assign(new Event('message'), { data: '{"t":"error","m":"the room is busy"}' }));
  assert.deepEqual(tally.inByType, { pose: 1, error: 1 });
  assert.deepEqual(tally.poseMs, [30], 'a pose heard 30 ms after its sender stamped it');
  assert.deepEqual(tally.refusals, { 'the room is busy': 1 });
  // a pose stamped just before the stamp's wrap (wire.js POSE_TS_MOD) is still 30 ms old
  now = 2 ** 24 + 10;
  ws.dispatchEvent(Object.assign(new Event('message'), { data: `{"t":"pose","id":"pbot","p":{"x":1,"ts":${2 ** 24 - 20}}}` }));
  assert.equal(tally.poseMs.at(-1), 30);
  // a connect refused: the error, then - as a browser - the close
  ws.dispatchEvent(new Event('error'));
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(closes, [1006]);
  assert.equal(tally.closes[1006], 1);
  assert.equal(tally.synthetic, 1);
  // one that opened is closed by its own runtime, never by this
  const up = new WS('ws://127.0.0.1:8871/room/chat:world');
  const upCloses = [];
  up.onclose = (ev) => upCloses.push(ev.code);
  up.dispatchEvent(new Event('open'));
  up.dispatchEvent(new Event('error'));
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(upCloses, []);
  assert.equal(tally.opened, 2);
});

test('SCALE3: the knobs - every one defaulted, typed as its default, an unknown or a malformed one refused; a town\'s bots all within the relay\'s range of one another and of no other town\'s cell, the middle of a cell holding no halo and its corner three (mutants: a knob taken untyped, a walk past the range, two towns a cell apart)', () => {
  const d = parseArgs([]);
  assert.deepEqual(Object.keys(d), Object.keys(KNOBS));
  assert.equal(d.bots, 50); assert.equal(d.scenario, 'steady');
  const o = parseArgs(['--bots', '200', '--scenario=storm', '--minutes', '0.5']);
  assert.equal(o.bots, 200); assert.equal(o.scenario, 'storm'); assert.equal(o.minutes, 0.5);
  assert.deepEqual(parseArgs(['--help']), { help: true });
  for (const bad of [['--bot', '5'], ['--bots', 'many'], ['--scenario', 'hurricane'], ['--bots'], ['--bots', '0'], ['stray']]) assert.throws(() => parseArgs(bad), Error, bad.join(' '));
  // the walk: every bot of a town within RANGE_PIXELS of every other at every moment, all in the town's cell
  const bots = Array.from({ length: 12 }, (_, n) => ({ n, town: townPixel(0), mover: n % 3 !== 0, phase: n, speed: 0.4 + n / 30, radius: 0.1 + (n % 5) / 25 }));
  for (const t of [0, 1.5, 30, 600]) {
    const poses = bots.map((b) => poseAt(b, t));
    for (const a of poses) for (const b of poses) assert.ok(pixelDistance(a, b) <= RANGE_PIXELS, `t=${t}`);
    for (const p of poses) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z) && (p.mv === 0 || p.mv === 1));
  }
  const stander = poseAt({ ...bots[0], mover: false }, 0);
  assert.deepEqual(poseAt({ ...bots[0], mover: false }, 999), stander, 'a stander stands');
  const { px, py } = townPixel(0);
  assert.equal(worldRoom(px, py), 'world:13,13');
  assert.deepEqual(cellHaloFor(px, py), [], 'a town in the middle of its cell holds no halo');
  const corner = townPixel(0, true);
  assert.equal(cellHaloFor(corner.px, corner.py).length, 3, 'its corner holds three more cells');
  // two towns never share a cell, and no town's halo reaches the next town's cell
  const next = townPixel(1, true);
  assert.notEqual(worldRoom(next.px, next.py), worldRoom(corner.px, corner.py));
  assert.ok(!cellHaloFor(corner.px, corner.py).includes(worldRoom(next.px, next.py)));
  assert.ok(!cellHaloFor(next.px, next.py).includes(worldRoom(corner.px, corner.py)), 'nor the next town\'s halo this one\'s');
});

test('SCALE3: a checkpoint\'s save is the size asked, a fresh character\'s shape with its place and its moment in it (every one a save that changed - a player at play, never an idle one), and the run is one the record can name: the npm script, the probe\'s buffer (mutants: the stamp left out)', () => {
  const bot = { n: 3, name: 'Load Bot 3', town: townPixel(0), mover: true, phase: 1, speed: 0.5, radius: 0.2 };
  const a = saveText(bot, 16, 1_000_000), b = saveText(bot, 16, 1_120_000);
  assert.ok(a.length >= 16 * 1024 && a.length < 20 * 1024, `${a.length}`);
  const sa = JSON.parse(a), sb = JSON.parse(b);
  assert.equal(sa.level, 1); assert.equal(sa.goldPieces, 100);
  assert.notEqual(a, b, 'two checkpoints two saves');
  assert.notDeepEqual(sa.place, sb.place);
  assert.equal(sb.at, 1_120_000);
  assert.match(JSON.parse(src('package.json')).scripts.load, /^node tools\/loadHarness\.mjs$/);
  // the clock the harness fires is the service's own two schedules (SCALE4b), written out so a tree before it loads
  assert.deepEqual([FIRE_MINUTE, FIRE_HOUR], [CRON_MINUTE, CRON_HOUR]);
  // the account probe's migrations ride a buffer past wrangler's summary, which grows with the square of their count
  assert.match(src('tools/accountProbe.mjs'), /maxBuffer: 64 \* 1024 \* 1024/);
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile([5, 1, 3, 2, 4], 0.5), 3);
  assert.equal(percentile([5, 1, 3, 2, 4], 1), 5);
});

test('SCALE3: a fleet spread over threads adds up - every route\'s calls, statuses and times, every frame count by type, every close and refusal summed across the fleets, the pose ages\' reservoirs pooled; a reservoir holds its bound however many it is offered, the first offered kept whole until it fills (mutants: a fleet\'s counts dropped, the bound outrun)', () => {
  const list = [];
  for (let i = 1; i <= 10; i++) reservoir(list, i, i, 4);
  assert.equal(list.length, 4, 'the bound held');
  assert.ok(list.every((v) => v >= 1 && v <= 10));
  const first = [];
  for (let i = 1; i <= 3; i++) reservoir(first, i * 10, i, 4);
  assert.deepEqual(first, [10, 20, 30], 'under its bound, every one kept');
  assert.ok(POSE_SAMPLE_MAX >= 50_000);
  const fleet = (k) => ({
    bots: 10 * k,
    account: [['/v1/heartbeat', { n: k, statuses: { 200: k }, ms: [k] }], ...(k === 2 ? [['/v1/auth/token', { n: 1, statuses: { 503: 1 }, ms: [9] }]] : [])],
    relay: { opened: k, synthetic: 0, inFrames: 100 * k, inBytes: 1000 * k, outFrames: 10 * k, outBytes: 50 * k, inByType: { pose: 90 * k, pong: 10 * k }, outByType: { pose: 10 * k }, closes: { 1006: k }, refusals: { busy: k }, poseMs: [k, k], poseSeen: 5 * k },
  });
  const m = mergeFleets([fleet(1), fleet(2)], () => 0);
  assert.equal(m.bots, 30);
  assert.deepEqual(m.account.byRoute.get('/v1/heartbeat'), { n: 3, statuses: { 200: 3 }, ms: [1, 2] });
  assert.deepEqual(m.account.byRoute.get('/v1/auth/token'), { n: 1, statuses: { 503: 1 }, ms: [9] });
  assert.deepEqual([m.relay.inFrames, m.relay.inBytes, m.relay.outFrames, m.relay.outBytes, m.relay.opened], [300, 3000, 30, 150, 3]);
  assert.deepEqual(m.relay.inByType, { pose: 270, pong: 30 });
  assert.deepEqual(m.relay.closes, { 1006: 3 });
  assert.deepEqual(m.relay.refusals, { busy: 3 });
  // PIN MOVED (AUDIT SCALE C9): the kept ages pooled in proportion to the poses each fleet heard - fleet 1 heard 5 for its
  // two kept, fleet 2 heard 10 for its two, so fleet 2's kept stand for twice as many and fleet 1 keeps one
  assert.deepEqual(m.relay.poseMs.slice().sort((a, b) => a - b), [1, 2, 2]);
  assert.equal(m.poseSeen, 15);
  // lane C's own case: a million poses heard at 10 ms beside 150,000 at a second, each fleet's reservoir full - over every
  // pose heard the 75th percentile is 10 ms (pooled unweighted it read a second)
  const full = (v, seen) => ({ ...fleet(1), relay: { ...fleet(1).relay, poseMs: Array(1000).fill(v), poseSeen: seen } });
  const uneven = mergeFleets([full(10, 1_000_000), full(1000, 150_000)]).relay.poseMs.sort((a, b) => a - b);
  assert.equal(percentile(uneven, 0.75), 10);
  assert.equal(percentile(uneven, 0.9), 1000);
});
