// THE NEW ERA - a live event staged for everyone online: a horse-headed gunship drops atomic bombs, the ground and the
// sky crack, the picture peels away to a white canvas and a deep voice speaks.
//
// THE PINS, BY THE DOOR THEY GUARD:
//   the wire     - the word appended; the relay that first knows it - an older one CLOSES the socket on it
//   the relay    - a REAL Room: a dev stages it in the hub, kept and said on a late joiner's welcome
//   the session  - the word staged only on a relay that knows it; the command
//   the show     - its phases on the shared clock, once; the lines owed; the gunship's orbit; the drops; the shake
//   the cloud    - the mushroom cloud's parts; the dome; the sky's cracks; the shards
//   the sounds   - made, whole and in bounds; the engines loop without a seam
//   the pass     - nothing to draw, nothing touched; each part drawn, every state put back, every allocation freed
//   the canvas   - nothing to draw, nothing made; the peel's shapes; it hides itself
//   the host     - the line, the sounds, the shake, the voice, a blast pinned through a recentre; world.js's lines
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from '../fakeRoom.mjs';
import { parseClient, LIVE_EVENTS, LIVE_EVENT_RELAY_MIN, EVENT_KEY, relayKnowsLiveEvent, validLiveEvent, RELAY_VERSION, CHAT_WORLD_ROOM } from '../../src/net/wire.js';
import { OnlineSession } from '../../src/net/online.js';
import { parseEventCommand } from '../../src/net/chatCommands.js';
import { SOUND } from '../../src/systems/soundClips.js';
import {
  NEWERA_EVENT, NEWERA_PHASES, NEWERA_SHOW_S, NEWERA_AT, NEWERA_CUES, NEWERA_LINES, NEWERA_VOICE, NEWERA_PLANE,
  NEWERA_DROPS, NEWERA_FALL_S, NEWERA_SHOCK_SPEED, NEWERA_BLAST_R, NEWERA_CLOUD, NEWERA_SKY_CRACKS, NEWERA_SHARD_GRID,
  NEWERA_PEEL_EACH, NEWERA_RATE, NEWERA_FIRE, NEWERA_SMOKE, NEWERA_BURN, NEWERA_HULL, NEWERA_COAT, NEWERA_BLAZE,
  createNewEra, newEraPhase, newEraCue, newEraPlane, newEraDrops, newEraBombAt, newEraFlash, newEraShake, newEraCloud,
  newEraDome, newEraSkyCracks, newEraShards, newEraPeelOf, newEraSpoken,
  newEraRumbleSamples, newEraBoomSamples, newEraEngineSamples, newEraWhistleSamples, newEraCrackSamples, newEraTearSamples, newEraDroneSamples,
} from '../../src/world/newEraEvent.js';
import { NewEraPassRenderer, NEWERA_PROGRAMS, NEWERA_SKY_FS, NEWERA_MESH_FS, NEWERA_PUFF_FS, NEWERA_GROUND_FS, gunshipMesh, bombMesh, domeMesh, newEraModel, newEraFrameOf, NEWERA_MESH_STRIDE } from '../../src/render/newEraPass.js';
import { createNewEraCanvas, newEraPeelShape, NEWERA_CANVAS_CSS } from '../../src/ui/newEraCanvas.js';
import { createNewEraHost, speakDeep, newEraVoiceOf, NEWERA_SOUNDS, NEWERA_ENGINE_BED } from '../../src/scenes/newEraHost.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const ofType = (ws, type) => ws.sent.filter((m) => m.t === type);
const stage = (kind) => JSON.stringify({ t: 'stage', kind });
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const AT = 1_700_000_000_000;
const NEW = Number(/^world(\d+)$/.exec(RELAY_VERSION)[1]);

// ── THE WIRE ─────────────────────────────────────────────────────────

test('NEW ERA wire: the fourth live event word, appended after the rocket - a stage frame takes it and a live event names it; staged only on a relay that knows it (mutants: the word dropped; the row early)', () => {
  assert.equal(NEWERA_EVENT, 'newera', 'the show draws the word the relay carries');
  assert.deepEqual(LIVE_EVENTS, ['dread', 'sunbaby', 'rocket', 'newera'], 'appended, never reordered');
  assert.deepEqual(parseClient(stage('newera'), { hasHello: true }), { t: 'stage', kind: 'newera' });
  assert.deepEqual(parseClient(stage('NEWERA'), { hasHello: true }), { error: 'bad stage' });
  assert.equal(validLiveEvent({ kind: 'newera', at: AT }), true);
  assert.deepEqual(Object.keys(LIVE_EVENT_RELAY_MIN), [...LIVE_EVENTS], 'one row a word, in the words\' order');
  assert.equal(LIVE_EVENT_RELAY_MIN.newera, 303);
  assert.equal(relayKnowsLiveEvent('world302', 'newera'), false, 'world302 answers the word "bad stage" and closes the socket');
  assert.equal(relayKnowsLiveEvent('world303', 'newera'), true);
  assert.ok(NEW >= 303 && relayKnowsLiveEvent(RELAY_VERSION, 'newera'), 'the relay this build ships knows it');
});

test('NEW ERA relay: a dev stages it in the hub - kept, fanned to everyone, and said whole on a late joiner\'s welcome; a player cannot', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const dev = r.connect(), one = r.connect();
  await r.hello(dev, 'peer-0001', null, { glyphs: ['dev'] });
  await r.hello(one, 'peer-0002');
  await r.raw(one, stage('newera'));
  assert.equal(r.store.has(EVENT_KEY), false, 'a player is ignored');
  await r.raw(dev, stage('newera'));
  const kept = r.store.get(EVENT_KEY);
  assert.equal(kept?.kind, 'newera');
  for (const ws of [dev, one]) assert.deepEqual(ofType(ws, 'event').at(-1), { t: 'event', kind: 'newera', at: kept.at });
  const late = r.connect();
  await r.hello(late, 'peer-0003');
  assert.deepEqual(ofType(late, 'welcome')[0].ev, { kind: 'newera', at: kept.at });
});

// ── THE SESSION AND THE COMMAND ──────────────────────────────────────

test('NEW ERA session and command: /event newera [on|off] off LIVE_EVENTS, sent only to a relay that knows the word (mutants: the word gate dropped)', () => {
  const session = (v) => {
    const s = new OnlineSession({ url: 'wss://example.test', name: 'Mac', id: 'peer-0001', secret: 'x'.repeat(32), presence: false });
    s.room = CHAT_WORLD_ROOM;
    const out = [];
    s._send = (f) => { out.push(f); return true; };
    s._receive(JSON.stringify({ t: 'welcome', id: 'peer-0001', peers: [], n: 1, v, now: Date.now() }));
    return { s, out };
  };
  const old = session('world302');
  assert.equal(old.s.sendStage('newera'), false, 'not the word');
  assert.deepEqual(old.out, []);
  assert.equal(old.s.sendStage('rocket'), true, 'the rocket it knows');
  const now = session(RELAY_VERSION);
  assert.equal(now.s.sendStage('newera'), true);
  assert.deepEqual(now.out, [{ t: 'stage', kind: 'newera' }]);
  assert.deepEqual(parseEventCommand('/event newera'), { kind: 'newera' });
  assert.deepEqual(parseEventCommand('/Event NewEra ON'), { kind: 'newera' });
  assert.deepEqual(parseEventCommand('/event newera off'), { kind: '' });
  assert.match(parseEventCommand('/event apocalypse').error, /\/event <dread\|sunbaby\|rocket\|newera> \[on\|off\]/);
});

// ── THE SHOW ─────────────────────────────────────────────────────────

test('NEW ERA show: rumble, fly in, bombs, crack, peel, canvas, dawn - 106 s on the shared clock, played ONCE (mutants: a phase reordered or resized; the show wrapping)', () => {
  assert.deepEqual(NEWERA_PHASES.map((p) => [p.phase, p.s]), [['rumble', 6], ['flyin', 12], ['bombs', 30], ['crack', 14], ['peel', 16], ['canvas', 18], ['dawn', 10]]);
  assert.equal(NEWERA_SHOW_S, 106);
  assert.deepEqual(NEWERA_AT, { rumble: 0, flyin: 6, bombs: 18, crack: 48, peel: 62, canvas: 78, dawn: 96 });
  const at = (s) => newEraPhase(s);
  assert.deepEqual([0, 5.9, 6, 18, 48, 62, 78, 96, 105.9].map((s) => at(s).phase), ['rumble', 'rumble', 'flyin', 'bombs', 'crack', 'peel', 'canvas', 'dawn', 'dawn']);
  assert.equal(at(105.9).done, false);
  assert.equal(at(106).done, true, 'it ends');
  assert.equal(at(500).done, true, 'and never comes round again');
  assert.equal(at(500).white, 0);
  assert.equal(at(-5).t, 0, 'a time before the stage is its first moment');
  assert.equal(at(NaN).t, 0);
});

test('NEW ERA show: the world\'s part stands until the canvas; the cracks grow over the crack, the screen cracks from 59 s, the peel runs its 16 s, the white is whole through the canvas and gone by the end of the dawn (mutants: the white held past the dawn; the world drawn under the canvas)', () => {
  const p = (s) => newEraPhase(s);
  assert.deepEqual([p(10).world, p(77.9).world, p(78).world, p(100).world], [true, true, false, false]);
  assert.deepEqual([p(47).crack, p(55).crack > 0.4 && p(55).crack < 0.6, p(62).crack], [0, true, 1]);
  assert.deepEqual([p(58.9).screenCrack, p(61.5).screenCrack, p(64).screenCrack], [0, 0.5, 1]);
  assert.deepEqual([p(61.9).peel, p(70).peel, p(77.99).peel > 0.99], [0, 0.5, true]);
  assert.deepEqual([p(77).white, p(78).white, p(95.9).white, p(101).white, p(105.99).white < 0.01], [0, 1, 1, 0.5, true]);
  assert.ok(p(30).burn > 0 && p(20).burn === 0, 'the sky burns once the first bomb lands');
  assert.deepEqual(p(79).caption, [0, 0]);
  assert.ok(p(82).caption[0] === 1 && p(82).caption[1] === 0, 'IT IS DONE. first');
  assert.ok(p(90).caption.every((c) => c === 1), 'then WE BEGIN A NEW ERA.');
  assert.ok(p(101).caption.every((c) => c === 0), 'and both go as the world comes back');
});

test('NEW ERA lines: one a cue, through the text core, one exclamation at most - said when a cue changes under a player watching, the stage\'s own on a live stage, nothing to a joiner, nothing after the end (mutants: a joiner told; a line after the show)', () => {
  assert.deepEqual(NEWERA_CUES.map((c) => [c.cue, c.at]), [['rumble', 0], ['plane', 7], ['bombs', 21], ['crack', 48], ['peel', 62], ['voice', 80], ['dawn', 96]]);
  assert.deepEqual(Object.keys(NEWERA_LINES), NEWERA_CUES.map((c) => c.cue));
  assert.equal(NEWERA_LINES.voice(), 'IT IS DONE. WE BEGIN A NEW ERA.', 'the voice, word for word');
  assert.equal(NEWERA_LINES.plane(), 'A giant AC-130 with a horse head flies into view!');
  assert.deepEqual(NEWERA_VOICE.map((v) => [v.at, v.line()]), [[80, 'IT IS DONE.'], [84.5, 'WE BEGIN A NEW ERA.']]);
  for (const k of Object.keys(NEWERA_LINES)) {
    const line = NEWERA_LINES[k]();
    assert.ok((line.match(/!/g) ?? []).length <= 1 && !/ - /.test(line), k);
    assert.ok(!/Daggerfall|Iliac/.test(line), `${k}: the show stands wherever a player is`);
  }
  const src = rd('src/world/newEraEvent.js');
  for (const c of NEWERA_CUES) assert.match(src, new RegExp(`${c.cue}: \\(\\) => t\\('newera\\.${c.cue}', '`), `${c.cue} through t()`);
  assert.equal(newEraCue(6.9), 0);
  assert.equal(newEraCue(7), 1);
  const live = createNewEra();
  live.set({ kind: 'newera', at: AT }, { live: true });
  assert.equal(live.frame(AT + 100).line, NEWERA_LINES.rumble(), 'a player watching it staged is told');
  assert.equal(live.frame(AT + 200).line, null, 'once');
  assert.equal(live.frame(AT + 7100).cue, 'plane');
  const joiner = createNewEra();
  joiner.set({ kind: 'newera', at: AT }, { live: false });
  assert.equal(joiner.frame(AT + 30_000).line, null, 'a joiner is told nothing of what they never saw');
  assert.equal(joiner.frame(AT + 48_100).cue, 'crack', 'but is told what comes next');
  const late = createNewEra();
  late.set({ kind: 'newera', at: AT }, { live: true });
  assert.equal(late.frame(AT + 200_000).line, null, 'nothing after the end');
  assert.equal(late.weight, 0);
  late.tick(1.5);
  assert.equal(late.weight, 0.5, 'a live stage fades in over 3 s');
  joiner.set(null, { live: true });
  assert.equal(joiner.on, false);
});

test('NEW ERA gunship: unseen before 6 s; in along the orbit\'s tangent; round a banked left-hand orbit 950 m out and 420 m up, its port side to the middle; out and climbing, gone by 62 s (mutants: the orbit turned the other way; no bank)', () => {
  assert.equal(newEraPlane(5.9, AT).on, false);
  assert.equal(newEraPlane(6, AT).on, true);
  assert.equal(newEraPlane(62, AT).on, false);
  const far = newEraPlane(6, AT).pos;
  assert.ok(Math.hypot(far[0], far[2]) > 3500, 'first seen far off');
  for (const s of [20, 30, 45]) {
    const p = newEraPlane(s, AT);
    assert.ok(close(Math.hypot(p.pos[0], p.pos[2]), NEWERA_PLANE.orbitR, 1e-6) && close(p.pos[1], NEWERA_PLANE.alt, 1e-6), `${s}: on its orbit`);
    const middle = [-p.pos[0] / NEWERA_PLANE.orbitR, 0, -p.pos[2] / NEWERA_PLANE.orbitR];
    assert.ok(p.left[0] * middle[0] + p.left[2] * middle[2] > 0.9, `${s}: its guns to the middle`);
    assert.ok(p.left[1] < -0.2, `${s}: the inner wing low`);
    assert.ok(close(p.bank, (NEWERA_PLANE.bankDeg * Math.PI) / 180, 1e-9));
    for (const v of [p.forward, p.up, p.left]) assert.ok(close(Math.hypot(...v), 1, 1e-9));
  }
  const entry = newEraPlane(17.95, AT).pos, orbit = newEraPlane(18.05, AT).pos;
  assert.ok(Math.hypot(entry[0] - orbit[0], entry[1] - orbit[1], entry[2] - orbit[2]) < 20, 'it meets its orbit smoothly');
  const out = newEraPlane(60, AT).pos;
  assert.ok(out[1] > NEWERA_PLANE.alt + 300 && Math.hypot(out[0], out[2]) > 3000, 'out and up');
  assert.notDeepEqual(newEraPlane(30, AT).pos, newEraPlane(30, AT + 86_400_000).pos, 'another stage, another quarter of the sky');
  assert.deepEqual(newEraPlane(30, AT + 400).pos, newEraPlane(30, AT).pos, 'a relay ms either side agrees');
});

test('NEW ERA drops: five bombs, each from the gunship as it lets go, landing 2-3.1 km out, the boom arriving with the shock (mutants: the boom with the flash)', () => {
  const drops = newEraDrops(AT);
  assert.deepEqual(drops.map((d) => d.dropAt), [...NEWERA_DROPS]);
  assert.deepEqual(NEWERA_DROPS, [21, 26, 31.5, 37, 42.5]);
  for (const d of drops) {
    assert.deepEqual(d.from, newEraPlane(d.dropAt, AT).pos);
    assert.equal(d.landAt, d.dropAt + NEWERA_FALL_S);
    assert.ok(d.dist >= NEWERA_BLAST_R[0] && d.dist <= NEWERA_BLAST_R[1]);
    assert.ok(close(Math.hypot(...d.to), d.dist, 1e-6));
    assert.ok(close(d.boomAt, d.landAt + d.dist / NEWERA_SHOCK_SPEED, 1e-9) && d.boomAt > d.landAt + 4);
  }
  assert.deepEqual(newEraDrops(AT), drops, 'every client reads the same');
  const fall = newEraBombAt([0, 400, 0], [1000, 0, 0], 0.5);
  assert.deepEqual(fall.pos, [500, 300, 0], 'across at its pace, down ever faster');
  assert.ok(newEraBombAt([0, 400, 0], [1000, 0, 0], 0.95).dir[1] < fall.dir[1], 'nose ever lower');
  assert.ok(close(newEraFlash(drops, drops[0].landAt), 0.92, 1e-9), 'the flash at the landing');
  assert.equal(newEraFlash(drops, drops[0].landAt - 0.01), 0);
});

test('NEW ERA shake: the rumble swells, each shock kicks hard as it arrives, the cracking grows, a thud at each phrase; still in the canvas between, nothing after (mutants: no boom)', () => {
  const drops = newEraDrops(AT);
  assert.ok(newEraShake(1, drops) > 1 && newEraShake(5, drops) > newEraShake(1, drops), 'the rumble swells');
  assert.ok(newEraShake(drops[0].boomAt + 0.01, drops) > 8.5, 'a boom');
  assert.ok(newEraShake(61, drops) > newEraShake(49, drops), 'the cracking grows');
  assert.ok(newEraShake(80.05, drops) > 2.5, 'the voice');
  assert.equal(newEraShake(83, drops), 0);
  assert.equal(newEraShake(200, drops), 0);
  for (let s = 0; s < 106; s += 0.25) assert.ok(newEraShake(s, drops) <= 10, 'never past the shaker\'s top');
});

test('NEW ERA cloud: the fireball, a stem, the cap\'s rolling ring and crown, a skirt of dust; it climbs and cools; the dome passes the eye and is gone (mutants: the fire never cools; the cap never climbs)', () => {
  const C = NEWERA_CLOUD;
  assert.deepEqual(newEraCloud(-1, 1), []);
  assert.equal(newEraCloud(1, 1).length, 1 + C.stem + C.cap + C.crown + C.skirt, 'with the fireball');
  assert.equal(newEraCloud(5, 1).length, C.stem + C.cap + C.crown + C.skirt, 'the fireball gone into the cap');
  const top = (age) => Math.max(...newEraCloud(age, 1).map((p) => p.at[1]));
  assert.ok(top(2) < top(10) && top(10) < top(30) && top(30) <= C.h * 1.4, 'it climbs');
  const heat = (age) => Math.max(...newEraCloud(age, 1).map((p) => p.heat));
  assert.ok(heat(0.5) > 0.8 && heat(20) < 0.01, 'and cools to smoke');
  for (const p of newEraCloud(8, 77)) assert.ok(p.at.every(Number.isFinite) && p.size > 0 && p.alpha >= 0 && p.alpha <= 1);
  assert.deepEqual(newEraDome(-1, 2000), { radius: 0, alpha: 0 });
  assert.ok(newEraDome(1, 2000).alpha > 0.4);
  assert.equal(newEraDome(10, 2000).alpha, 0, 'past the eye, gone');
});

test('NEW ERA sky and shards: the sky cracks from three seeded starts; the picture breaks into 35 cells that tile it, sky first, each peeling in its own 0.3 of the peel (mutants: the land peeled first)', () => {
  const sky = newEraSkyCracks(AT);
  assert.equal(sky.from.length, NEWERA_SKY_CRACKS);
  for (const way of sky.from) assert.ok(close(Math.hypot(...way), 1, 1e-9) && way[1] > 0.2, 'up in the sky');
  assert.deepEqual(newEraSkyCracks(AT), sky);
  const shards = newEraShards(1234);
  assert.equal(shards.length, NEWERA_SHARD_GRID.cols * NEWERA_SHARD_GRID.rows);
  const area = (poly) => Math.abs(poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  assert.ok(close(shards.reduce((a, s) => a + area(s.poly), 0), 1, 1e-9), 'they tile the picture');
  for (const s of shards) {
    assert.ok(s.start >= 0 && s.start <= 1 - NEWERA_PEEL_EACH);
    assert.equal(newEraPeelOf(s, s.start), 0);
    assert.equal(newEraPeelOf(s, s.start + NEWERA_PEEL_EACH), 1);
    assert.equal(newEraPeelOf(s, 1), 1, 'every shard gone by the peel\'s end');
  }
  const mean = (list) => list.reduce((a, s) => a + s.start, 0) / list.length;
  assert.ok(mean(shards.filter((s) => s.centre[1] < 0.3)) < mean(shards.filter((s) => s.centre[1] > 0.7)), 'the sky\'s layer first');
  assert.equal(newEraSpoken('IT IS DONE. WE BEGIN A NEW ERA.'), 'It is done. We begin a new era.', 'spoken as words, not letters');
});

// ── THE SOUNDS ───────────────────────────────────────────────────────

test('NEW ERA sounds: each made sound whole, in bounds and not silent; the engines a 2 s loop with no seam (mutants: a sound left loud)', () => {
  const sounds = { rumble: newEraRumbleSamples(), boom: newEraBoomSamples(), engine: newEraEngineSamples(), whistle: newEraWhistleSamples(), crack: newEraCrackSamples(), tear: newEraTearSamples(), drone: newEraDroneSamples() };
  assert.deepEqual(Object.keys(sounds), Object.keys(NEWERA_SOUNDS));
  for (const [name, samples] of Object.entries(sounds)) {
    let peak = 0;
    for (const v of samples) { assert.ok(Number.isFinite(v)); peak = Math.max(peak, Math.abs(v)); }
    assert.ok(peak > 0.5 && peak <= 0.95 + 1e-6, `${name} at ${peak}`);
  }
  assert.equal(sounds.engine.length, 2 * NEWERA_RATE);
  const step = Math.abs(sounds.engine[0] - sounds.engine.at(-1));
  let most = 0;
  for (let i = 1; i < sounds.engine.length; i++) most = Math.max(most, Math.abs(sounds.engine[i] - sounds.engine[i - 1]));
  assert.ok(step <= most, 'the wrap is no bigger a step than any other');
  assert.deepEqual(newEraRumbleSamples(), sounds.rumble, 'made the same every time');
});

// ── THE PASS ─────────────────────────────────────────────────────────

function fakeGl() {
  const calls = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      if (/^[A-Z0-9_]+$/.test(k)) return k;
      return (...a) => {
        calls.push([k, ...a]);
        if (k === 'getShaderParameter' || k === 'getProgramParameter') return true;
        if (k === 'getUniformLocation') return a[1];
        if (k.startsWith('create')) return { k };
        return undefined;
      };
    },
  });
  return { gl, calls };
}
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('NEW ERA pass: nothing to draw, NOTHING touched; the sky over the cleared depth alone, the meshes depth written, the ground offset and blended, the domes and clouds blended unwritten - every state put back and every allocation freed', () => {
  const { gl, calls } = fakeGl();
  const p = new NewEraPassRenderer(gl);
  p.setGround(new Float32Array(18));
  calls.length = 0;
  assert.equal(p.draw({}, I4, I4, [0, 0, 0], 1), 0);
  assert.deepEqual(calls, [], 'no show, no pass');
  const n = p.draw({
    burn: 0.5, glows: [{ dir: [0, 0, 1], k: 1 }], sky: { crack: 0.5, from: [[0, 1, 0]], offset: [0, 0, 0] },
    ground: { crack: 0.5, anchor: [0, 0], origin: [0, 0], reach: 150, cell: 12 },
    plane: newEraModel([0, 400, 900], [1, 0, 0], [0, 1, 0], [0, 0, 1], 5), bombs: [newEraModel([0, 100, 900], [1, 0, 0], [0, 1, 0], [0, 0, 1], 9)],
    domes: [{ at: [0, 0, 2000], radius: 500, alpha: 0.4 }], puffs: [{ at: [0, 300, 2000], size: 100, heat: 0.5, alpha: 1 }, { at: [0, 300, 1000], size: 100, heat: 0.5, alpha: 1 }],
  }, I4, I4, [0, 0, 0], 1);
  assert.equal(n, 6, 'the sky, the gunship, a bomb, the ground, the domes, the clouds');
  const draws = calls.map((c, i) => [c[0], i]).filter(([k]) => k === 'drawArrays' || k === 'drawArraysInstanced').map(([, i]) => i);
  const at = (k, ...a) => calls.findIndex((c) => c[0] === k && a.every((v, i) => c[i + 1] === v));
  assert.ok(at('depthFunc', 'LEQUAL') < draws[0] && at('depthMask', false) < draws[0], 'the sky only where nothing nearer drew');
  assert.ok(calls.slice(draws[0], draws[1]).some((c) => c[0] === 'depthMask' && c[1] === true), 'the meshes write depth');
  assert.ok(calls.slice(draws[2], draws[3]).some((c) => c[0] === 'enable' && c[1] === 'POLYGON_OFFSET_FILL'), 'the ground offset over the land');
  assert.ok(calls.slice(draws[2], draws[5]).some((c) => c[0] === 'depthMask' && c[1] === false), 'the blended parts unwritten');
  const after = calls.slice(draws.at(-1));
  for (const [k, ...a] of [['disable', 'BLEND'], ['enable', 'CULL_FACE'], ['depthFunc', 'LESS'], ['depthMask', true], ['bindVertexArray', null]]) assert.ok(after.some((c) => c[0] === k && a.every((v, i) => c[i + 1] === v)), `${k} put back`);
  calls.length = 0;
  p.dispose();
  const del = (k) => calls.filter((c) => c[0] === k).length;
  assert.deepEqual([del('deleteProgram'), del('deleteBuffer'), del('deleteVertexArray')], [5, 8, 6], 'every allocation has an owner');
});

test('NEW ERA GLSL and meshes: every colour from world/newEraEvent.js\'s tables; the five programs; the gunship\'s parts and its horse\'s head; a model\'s axes (mutants: a colour hand-written)', () => {
  const v3 = (c) => `vec3(${c.map((v) => v.toFixed(4)).join(', ')})`;
  assert.ok(NEWERA_PUFF_FS.includes(v3(NEWERA_FIRE[0])) && NEWERA_PUFF_FS.includes(v3(NEWERA_SMOKE)));
  assert.ok(NEWERA_SKY_FS.includes(v3(NEWERA_BURN)));
  assert.match(NEWERA_SKY_FS, new RegExp(`uniform vec3 uFrom\\[${NEWERA_SKY_CRACKS}\\];`));
  for (const fs of [NEWERA_MESH_FS, NEWERA_PUFF_FS, NEWERA_GROUND_FS]) assert.match(fs, /fogFactorAt\(vWorld\)/, 'fogged as the land is');
  for (const [vs, fs] of NEWERA_PROGRAMS) for (const s of [vs, fs]) assert.ok(s.startsWith('#version 300 es'));
  const plane = gunshipMesh();
  assert.equal(plane.length % NEWERA_MESH_STRIDE, 0);
  const colours = new Set();
  let props = 0, nose = -Infinity, span = 0;
  for (let i = 0; i < plane.length; i += NEWERA_MESH_STRIDE) {
    colours.add(Array.from(plane.slice(i + 6, i + 9), (v) => v.toFixed(3)).join(','));
    if (plane[i + 9] < 5) props++;
    nose = Math.max(nose, plane[i + 2]);
    span = Math.max(span, Math.abs(plane[i]));
  }
  for (const c of [NEWERA_HULL, NEWERA_COAT, NEWERA_BLAZE]) assert.ok(colours.has(c.map((v) => v.toFixed(3)).join(',')), `${c} on it`);
  assert.equal(props, 4 * 6, 'four propellers');
  assert.ok(nose > 22 && span === 20, 'a horse\'s head for a nose; a 40 m wing');
  assert.equal(bombMesh().length % NEWERA_MESH_STRIDE, 0);
  assert.equal(domeMesh(8, 24).length, 8 * 24 * 6 * 3);
  const axes = newEraFrameOf([0, -1, 1]);
  for (const v of Object.values(axes)) assert.ok(close(Math.hypot(...v), 1, 1e-9));
  const m = newEraModel([1, 2, 3], [1, 0, 0], [0, 1, 0], [0, 0, 1], 2);
  assert.deepEqual(Array.from(m), [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 1, 2, 3, 1]);
});

// ── THE CANVAS ───────────────────────────────────────────────────────

const fakePage = () => {
  const ops = [];
  const ctx = new Proxy({ letterSpacing: '0px' }, {
    get(target, k) { if (k in target) return target[k]; return (...a) => { ops.push(k); return { addColorStop() {} }; }; },
    set(target, k, v) { target[k] = v; return true; },
  });
  const made = [];
  const doc = { createElement: () => { const el = { style: {}, width: 0, height: 0, getContext: () => ctx, setAttribute() {}, remove() { el.gone = true; } }; made.push(el); return el; }, body: { appendChild() {} } };
  const timers = [];
  return { doc, made, ops, timers, win: { innerWidth: 1280, innerHeight: 720 }, setTimer: (fn) => { timers.push(fn); return timers.length; }, clearTimer() {} };
};

test('NEW ERA canvas: nothing to draw, nothing made; over the HUD and under the chat, no pointer; the white held is one fill; it hides itself when no frame draws it (mutants: the canvas left white indoors)', () => {
  const page = fakePage();
  const canvas = createNewEraCanvas(page);
  assert.equal(canvas.draw({ weight: 1, flash: 0, screenCrack: 0, peel: 0, white: 0, caption: [], seed: 1 }), false);
  assert.equal(page.made.length, 0, 'nothing made');
  assert.equal(NEWERA_CANVAS_CSS, 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:4;pointer-events:none;');
  assert.equal(canvas.draw({ weight: 1, flash: 0, screenCrack: 0, peel: 0, white: 1, caption: [{ text: 'IT IS DONE.', alpha: 1 }], seed: 1 }), true);
  assert.equal(page.made.length, 1);
  assert.equal(page.made[0].style.cssText, NEWERA_CANVAS_CSS);
  assert.deepEqual([page.made[0].width, page.made[0].height], [1280, 720]);
  assert.ok(page.ops.includes('fillRect') && page.ops.includes('fillText'), 'the white and the words');
  assert.equal(canvas.visible, true);
  page.timers.at(-1)();
  assert.equal(canvas.visible, false, 'no frame for a moment: hidden');
  assert.equal(page.made[0].style.display, 'none');
  canvas.draw({ weight: 1, flash: 0.5, screenCrack: 0, peel: 0, white: 0, caption: [], seed: 1 });
  assert.equal(page.made[0].style.display, '', 'back with the next frame');
  canvas.dispose();
  assert.equal(page.made[0].gone, true);
});

test('NEW ERA peel: a shard\'s revealed part grows from its fold\'s side; its flap folds back over the rest, curled short (mutants: the flap unfolded)', () => {
  const square = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const none = newEraPeelShape(square, [0, 1], 0);
  assert.ok(none.revealed.length === 0 || none.revealed.every((p) => p[1] <= 1e-9), 'nothing peeled');
  const half = newEraPeelShape(square, [0, 1], 0.5);
  assert.equal(half.fold, 50);
  assert.ok(half.revealed.every((p) => p[1] <= 50 + 1e-9), 'the top half peeled');
  assert.ok(half.flap.every((p) => p[1] >= 50 - 1e-9 && p[1] <= 50 + 0.55 * 50 + 1e-9), 'folded down over the rest, short');
  const all = newEraPeelShape(square, [0, 1], 1);
  assert.equal(all.revealed.length, 4);
});

// ── THE HOST ─────────────────────────────────────────────────────────

const host = ({ origin = [0, 0] } = {}) => {
  const { gl } = fakeGl();
  const said = [], played = [], registered = [], passes = [], kicks = [], spoken = [], beds = [], canvases = [];
  let marked = 0;
  const renderer = { gl, _lightDir: [0, 1, 0], _ambient: [0.5, 0.5, 0.5], _sunScale: 0.5, _fogMode: 0, _fogDensity: 0, _fogRange: [0, 1], _fogColor: [0.5, 0.5, 0.5], _camPos: [0, 0, 0], _focus: new Float32Array(4), _haze: new Float32Array(8), markForeignPass: () => { marked++; } };
  const o = [...origin];
  const state = { worldCoords: (p) => ({ x: (o[0] + p[0]) * 2.5, z: (o[1] + p[2]) * 2.5 }) };
  class Pass {
    constructor() { this.draws = []; this.ground = null; passes.push(this); }
    setGround(g) { this.ground = g; }
    draw(s) { this.draws.push(s); return 3; }
    dispose() { this.disposed = true; }
  }
  const Canvas = () => { const c = { draws: [], hidden: 0, draw(s) { c.draws.push(s); return true; }, hide() { c.hidden++; }, dispose() { c.disposed = true; } }; canvases.push(c); return c; };
  const audio = {
    registerSamples: (k) => { registered.push(k); return true; },
    play3d: (clip, pos, vol, opt) => { played.push({ clip, pos, vol, ...opt }); },
    playOneShot: (clip, vol, pitch) => { played.push({ clip, vol, pitch }); },
    setBed3d: (name, clip) => { beds.push([name, clip]); },
  };
  const h = createNewEraHost(renderer, () => 5, state, { audio, Pass, Canvas, shake: (k) => kicks.push(k), speak: (t) => { spoken.push(t); return true; }, speech: null });
  return { h, said, played, registered, passes, kicks, spoken, beds, canvases, o, talk: { say: (l) => said.push(l) }, marks: () => marked };
};
const run = (x, fromMs, toMs, stepMs = 100) => { for (let ms = fromMs; ms <= toMs; ms += stepMs) { x.h.frame(stepMs / 1000, AT + ms, [0, 5, 0], x.talk); x.h.draw(I4, I4, [0, 6.7, 0]); } };

test('NEW ERA host: no event, nothing; staged live, the line said; the gunship drawn from 6 s, the pass built once, the renderer told; the show over, nothing drawn and the canvas hidden (mutants: the world drawn under the canvas)', () => {
  const x = host();
  x.h.frame(1 / 60, AT, [0, 5, 0], x.talk);
  assert.equal(x.h.showing(), false);
  assert.equal(x.h.draw(I4, I4, [0, 5, 0]), false);
  assert.deepEqual([x.passes.length, x.played.length, x.said.length, x.canvases.length], [0, 0, 0, 0]);
  x.h.set({ kind: 'newera', at: AT }, { live: true });
  run(x, 100, 10_000);
  assert.equal(x.said[0], NEWERA_LINES.rumble());
  assert.equal(x.said[1], NEWERA_LINES.plane());
  assert.equal(x.passes.length, 1, 'built once');
  const last = x.passes[0].draws.at(-1);
  assert.ok(last.plane instanceof Float32Array && last.plane.length === 16, 'the gunship');
  assert.ok(x.marks() > 0);
  run(x, 10_100, 79_000, 200);
  assert.equal(x.h.showing(), false, 'the canvas phase: the world\'s part drawn no more');
  const drawsAt = x.passes[0].draws.length;
  run(x, 79_200, 110_000, 500);
  assert.equal(x.passes[0].draws.length, drawsAt, 'nothing drawn under the white');
  assert.ok(x.canvases[0].draws.some((s) => s.white === 1 && s.caption[1].alpha === 1 && s.caption[1].text === 'WE BEGIN A NEW ERA.'), 'the white held and the words on it');
  assert.ok(x.canvases[0].hidden > 0, 'the canvas hidden once the show is over');
  x.h.dispose();
  assert.equal(x.passes[0].disposed, true);
  assert.equal(x.canvases[0].disposed, true);
});

test('NEW ERA host: the gunship neighs (DAGGER.SND AnimalHorse, deep) and its engines hum while it flies; each bomb whistles and booms with Daggerfall\'s own thunder; the ground cracks aloud; the shards tear; the voice speaks; the camera kicked through its shaker (mutants: no boom; no voice)', () => {
  const x = host();
  x.h.set({ kind: 'newera', at: AT }, { live: true });
  run(x, 0, 90_000);
  const of = (clip) => x.played.filter((p) => p.clip === clip);
  assert.equal(of(SOUND.AnimalHorse).length, 3);
  assert.ok(of(SOUND.AnimalHorse).every((p) => p.pitch < 1), 'a deep neigh');
  assert.equal(of(NEWERA_SOUNDS.whistle.key).length, 5);
  assert.equal(of(NEWERA_SOUNDS.boom.key).length, 5);
  assert.equal(of(349).length, 5, 'LightningThunder, pitched down');
  assert.ok(of(NEWERA_SOUNDS.crack.key).length >= 5);
  assert.ok(of(NEWERA_SOUNDS.tear.key).length >= 10);
  assert.ok(x.beds.some(([name, clip]) => name === NEWERA_ENGINE_BED && clip === NEWERA_SOUNDS.engine.key), 'the engines');
  assert.deepEqual(x.beds.at(-1), [NEWERA_ENGINE_BED, null], 'let go once it is gone');
  assert.deepEqual(x.spoken, ['It is done.', 'We begin a new era.']);
  assert.equal(of(NEWERA_SOUNDS.drone.key).length, 2);
  assert.ok(x.kicks.length > 100 && Math.max(...x.kicks) > 8);
  for (const key of ['rumble', 'boom', 'engine', 'whistle', 'crack', 'tear', 'drone']) assert.ok(x.registered.includes(NEWERA_SOUNDS[key].key), key);
});

test('NEW ERA host: a blast is the world\'s - pinned where the eye stood when it fell, it stays put through a recentre; the ground\'s cracks are laid on the ground the host reads (mutants: the cloud moved with the eye)', () => {
  const x = host({ origin: [1000, 2000] });
  x.h.set({ kind: 'newera', at: AT }, { live: false });
  run(x, 26_000, 30_000);
  const zero = (s) => s.puffs[0].at;
  const before = zero(x.passes[0].draws.at(-1));
  x.o[0] += 100;   // the floating origin moves 100 scene metres east
  x.h.frame(0.1, AT + 30_100, [-100, 5, 0], x.talk);
  x.h.draw(I4, I4, [-100, 6.7, 0]);
  const after = zero(x.passes[0].draws.at(-1));
  assert.ok(Math.abs(after[0] - (before[0] - 100)) < 30, 'the same place in the world, read from the new origin');
  run(x, 50_000, 51_000);
  const groundShow = x.passes[0].draws.at(-1).ground;
  assert.ok(groundShow && groundShow.crack > 0);
  assert.ok(x.passes[0].ground instanceof Float32Array && x.passes[0].ground.length > 1000);
  for (let i = 1; i < x.passes[0].ground.length; i += 3) assert.equal(x.passes[0].ground[i], 5.25, 'on the ground, a hair over');
});

test('NEW ERA voice: the deepest English voice the browser has, as low and slow as speech goes, at the Sound Volume; nothing where there is no speech', () => {
  assert.equal(newEraVoiceOf([{ name: 'Samantha', lang: 'en-US' }, { name: 'Daniel', lang: 'en-GB' }]).name, 'Daniel');
  assert.equal(newEraVoiceOf([{ name: 'Samantha', lang: 'en-US' }]).name, 'Samantha');
  assert.equal(newEraVoiceOf([{ name: 'Thomas', lang: 'fr-FR' }]), null);
  const voices = [{ name: 'Daniel', lang: 'en-GB' }, { name: 'Anna', lang: 'de-DE' }, { name: 'Luciana', lang: 'pt_BR' }];
  assert.equal(newEraVoiceOf(voices, 'de').name, 'Anna', 'the player\'s language, not English');
  assert.equal(newEraVoiceOf(voices, 'pt-BR').name, 'Luciana');
  assert.equal(newEraVoiceOf(voices, 'ja'), null, 'none for it: the engine\'s own for that language');
  const spoken = [];
  class Utterance { constructor(text) { this.text = text; } }
  assert.equal(speakDeep('It is done.', { speech: { speak: (u) => spoken.push(u), getVoices: () => [] }, Utterance, volume: 0.4, lang: 'en' }), true);
  assert.deepEqual([spoken[0].text, spoken[0].pitch, spoken[0].rate, spoken[0].volume, spoken[0].lang], ['It is done.', 0, 0.62, 0.4, 'en']);
  speakDeep('Es ist vollbracht.', { speech: { speak: (u) => spoken.push(u), getVoices: () => voices }, Utterance, volume: 1, lang: 'de' });
  assert.deepEqual([spoken[1].lang, spoken[1].voice.name], ['de', 'Anna'], 'spoken in the language the line is in');
  assert.equal(speakDeep('It is done.', { speech: undefined, Utterance, volume: 1 }), false);
});

test('NEW ERA world.js: the host built after the Rocket\'s, the hub\'s word handed to it with the others\', framed after the Rocket\'s, drawn after the Rocket\'s (mutants: the frame call dropped)', () => {
  const world = rd('src/scenes/world.js');
  assert.match(world, /import \{ createNewEraHost \} from '\.\/newEraHost\.js';/);
  assert.match(world, /const newEra = createNewEraHost\(renderer, sunbabyGround, state\);/);
  assert.match(world, /rocket\.set\(ev, o\); newEra\.set\(ev, o\); \};/);
  assert.match(world, /rocket\.frame\(dt, Date\.now\(\) \+ _sharedOffsetMs, tvStand, townTalk\);[^\n]*\n\s*newEra\.frame\(dt, Date\.now\(\) \+ _sharedOffsetMs, tvStand, townTalk\);/);
  assert.match(world, /rocket\.draw\(proj, view, mwv\.eye\);[^\n]*\n\s*newEra\.draw\(proj, view, mwv\.eye\);/);
  assert.ok(world.indexOf('const newEra = createNewEraHost(') > world.indexOf('const rocket = createRocketHost('), 'built after the Rocket, after the streaming world');
});
