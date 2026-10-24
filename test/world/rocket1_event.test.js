// ROCKET1 — A LIVE EVENT, STAGED FOR EVERYONE ONLINE: THE ROCKET (2026-10-23).
//
// The ask (the owner): "when I type /event rocket I want mounds to appear and shoot poop up from the ground and a horse to
// fart across the sky neighing and then smaller horses farting across the sky. At some point the poop subsides and
// daggerfall erupts into a giant diarrhea frenzy". EVENT1's door with a third word on it (`/event rocket`, the dev glyph,
// online players only), and a show of its own (world/rocketEvent.js, render/rocketPass.js, scenes/rocketHost.js).
//
// THE PINS, BY THE DOOR THEY GUARD:
//   the wire     - the word appended; the relay that first knows it (world253) - an older one CLOSES the socket on it
//   the relay    - a REAL Room: a dev stages the rocket in the hub, kept and said on a late joiner's welcome
//   the session  - the word staged only on a relay that knows it; the command
//   the cycle    - the phases on the shared clock, the jets, the frenzy, the lines owed
//   the world    - the mounds on the world's own grid; the horses' flights, their place, their clouds and their sounds
//   the fart     - made, whole and in bounds
//   the pass     - nothing to draw, nothing touched; each part drawn, every state put back, every allocation freed; the
//                  colours from the tables
//   the host     - the weight, the line, the mounds anchored through a recentre, the neigh and the farts; world.js's
//                  four lines
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from '../fakeRoom.mjs';
import { parseClient, LIVE_EVENTS, LIVE_EVENT_RELAY_MIN, EVENT_KEY, relayKnowsLiveEvent, validLiveEvent, RELAY_VERSION, CHAT_WORLD_ROOM } from '../../src/net/wire.js';
import { OnlineSession } from '../../src/net/online.js';
import { parseEventCommand } from '../../src/net/chatCommands.js';
import { SOUND } from '../../src/systems/soundClips.js';
import {
  ROCKET_EVENT, ROCKET_FADE_S, ROCKET_PHASES, ROCKET_CYCLE_S, ROCKET_CUES, ROCKET_LINES, ROCKET_FRENZY_JET, ROCKET_BROWN_W,
  ROCKET_MOUND_CELL_M, ROCKET_MOUND_CHANCE, ROCKET_MOUND_REACH_M, ROCKET_GREAT, ROCKET_FOALS, ROCKET_HERD, ROCKET_SKY_R,
  ROCKET_PUFF_S, ROCKET_PUFFS, ROCKET_FART_RATE, ROCKET_FART_VARIANTS, ROCKET_POOP, ROCKET_MOUND, ROCKET_GAS, ROCKET_FRENZY_ZENITH,
  ROCKET_FRENZY_HORIZON, ROCKET_COATS, ROCKET_MANES, ROCKET_HORSE_GIRTH, ROCKET_HORSE_LEGS,
  createRocket, rocketPhase, rocketCue, rocketJetScale, rocketMounds, rocketFlights, rocketHorseAt, rocketSky, rocketSounds, rocketFartSamples,
} from '../../src/world/rocketEvent.js';
import { RocketPassRenderer, ROCKET_PROGRAMS, ROCKET_SKY_FS, ROCKET_MOUND_FS, ROCKET_SPRITE_FS, ROCKET_HORSE_FS, moundMesh } from '../../src/render/rocketPass.js';
import { createRocketHost, ROCKET_FART_KEYS } from '../../src/scenes/rocketHost.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const stage = (kind) => JSON.stringify({ t: 'stage', kind });
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const unit = (v) => close(Math.hypot(...v), 1, 1e-9);
const AT = 1_700_000_000_000;

// ── THE WIRE ─────────────────────────────────────────────────────────

test('ROCKET1 wire: the rocket is the third live event word, appended after the sun baby - a stage frame takes it and a live event names it; it is staged only on a relay at world253 or past (mutants: the word dropped; the row at world252)', () => {
  assert.equal(ROCKET_EVENT, 'rocket', 'the show draws the word the relay carries');
  assert.deepEqual(LIVE_EVENTS, ['dread', 'sunbaby', 'rocket'], 'appended, never reordered');
  assert.deepEqual(parseClient(stage('rocket'), { hasHello: true }), { t: 'stage', kind: 'rocket' });
  assert.deepEqual(parseClient(stage('ROCKET'), { hasHello: true }), { error: 'bad stage' });
  assert.equal(validLiveEvent({ kind: 'rocket', at: AT }), true);
  assert.deepEqual(Object.keys(LIVE_EVENT_RELAY_MIN), [...LIVE_EVENTS], 'one row a word, in the words\' order');
  assert.equal(LIVE_EVENT_RELAY_MIN.rocket, 253);
  assert.equal(relayKnowsLiveEvent('world252', 'rocket'), false, 'world252 (DECK-POSE) answers the word "bad stage" and closes the socket');
  assert.equal(relayKnowsLiveEvent('world253', 'rocket'), true);
  assert.equal(relayKnowsLiveEvent(RELAY_VERSION, 'rocket'), true, 'the relay this build ships knows it');
});

test('ROCKET1 relay: a dev stages the rocket in the hub - kept, fanned to everyone, and said whole on a late joiner\'s welcome; a player cannot', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const dev = r.connect(), one = r.connect();
  await r.hello(dev, 'peer-0001', null, { glyphs: ['dev'] });
  await r.hello(one, 'peer-0002');
  await r.raw(one, stage('rocket'));
  assert.equal(r.store.has(EVENT_KEY), false, 'a player is ignored');
  await r.raw(dev, stage('rocket'));
  const kept = r.store.get(EVENT_KEY);
  assert.equal(kept?.kind, 'rocket');
  for (const ws of [dev, one]) assert.deepEqual(ofType(ws, 'event').at(-1), { t: 'event', kind: 'rocket', at: kept.at });
  const late = r.connect();
  await r.hello(late, 'peer-0003');
  assert.deepEqual(ofType(late, 'welcome')[0].ev, { kind: 'rocket', at: kept.at });
});

// ── THE SESSION AND THE COMMAND ──────────────────────────────────────

test('ROCKET1 session and command: /event rocket [on|off] is parsed off LIVE_EVENTS and sent only to a relay that knows the word - a world252 hub knows the sun baby but would close on this (mutants: the word gate dropped)', () => {
  const session = (v) => {
    const s = new OnlineSession({ url: 'wss://example.test', name: 'Mac', id: 'peer-0001', secret: 'x'.repeat(32), presence: false });
    s.room = CHAT_WORLD_ROOM;
    const out = [];
    s._send = (f) => { out.push(f); return true; };
    s._receive(JSON.stringify({ t: 'welcome', id: 'peer-0001', peers: [], n: 1, v, now: Date.now() }));
    return { s, out };
  };
  const old = session('world252');
  assert.equal(old.s.sendStage('rocket'), false, 'not the word');
  assert.deepEqual(old.out, []);
  assert.equal(old.s.sendStage('sunbaby'), true, 'the sun baby it knows');
  const now = session(RELAY_VERSION);
  assert.equal(now.s.sendStage('rocket'), true);
  assert.deepEqual(now.out, [{ t: 'stage', kind: 'rocket' }]);
  assert.deepEqual(parseEventCommand('/event rocket'), { kind: 'rocket' });
  assert.deepEqual(parseEventCommand('/Event Rocket ON'), { kind: 'rocket' });
  assert.deepEqual(parseEventCommand('/event rocket off'), { kind: '' });
  assert.match(parseEventCommand('/event poop').error, /\/event <dread\|sunbaby\|rocket> \[on\|off\]/);
});

// ── THE CYCLE ────────────────────────────────────────────────────────

test('ROCKET1 cycle: rise, erupt, lull, frenzy, ebb - 125 s on the shared clock, wrapping (mutants: a phase reordered or resized)', () => {
  assert.deepEqual(ROCKET_PHASES.map((p) => [p.phase, p.s]), [['rise', 6], ['erupt', 54], ['lull', 12], ['frenzy', 45], ['ebb', 8]]);
  assert.equal(ROCKET_CYCLE_S, 125);
  const at = (s) => rocketPhase(s);
  assert.deepEqual([at(0).phase, at(5.9).phase, at(6).phase, at(59.9).phase, at(60).phase, at(72).phase, at(117).phase, at(124.9).phase], ['rise', 'rise', 'erupt', 'erupt', 'lull', 'frenzy', 'ebb', 'ebb']);
  assert.deepEqual([at(125).phase, at(125).cycle, at(250.5).cycle], ['rise', 1, 2], 'it wraps while the event stands');
  assert.equal(at(-5).t, 0, 'a time before the stage is its first moment');
  assert.equal(at(NaN).t, 0);
});

test('ROCKET1 cycle: the mounds rise and sink, the jets come up and SUBSIDE in the lull, the sky browns before the frenzy and the frenzy is whole 2 s in (mutants: the lull kept the jets; the frenzy never browned first)', () => {
  const p = (s) => rocketPhase(s);
  assert.deepEqual([p(0).rise, p(3).rise, p(6).rise], [0, 0.5, 1], 'out of the earth over the rise');
  assert.deepEqual([p(6).jet, p(7.5).jet, p(9).jet, p(40).jet], [0, 0.5, 1, 1], 'the jets come up over 3 s');
  assert.deepEqual([p(60).jet, p(63).jet, p(66).jet, p(70).jet], [1, 0.5, 0, 0], 'the poop subsides over 6 s');
  assert.deepEqual([p(60).frenzy, p(67.9).frenzy, p(70).frenzy], [0, 0, ROCKET_BROWN_W / 2], 'the sky browns over the lull\'s last 4 s');
  assert.ok(close(p(71.999).frenzy, ROCKET_BROWN_W, 1e-5) && p(72).frenzy === ROCKET_BROWN_W, 'and the frenzy takes it from there, unbroken');
  assert.deepEqual([p(74).frenzy, p(100).frenzy, p(100).jet], [1, 1, 1], 'Daggerfall erupts');
  assert.deepEqual([p(117).rise, p(121).rise, p(125 - 1e-9).rise > 0.999 ? 'up' : 'down'], [1, 0.5, 'down'], 'and the mounds sink back over the ebb');
  assert.equal(rocketJetScale(1, 0), 1);
  assert.equal(rocketJetScale(1, 1), ROCKET_FRENZY_JET, 'every mound a geyser in the frenzy');
  assert.equal(rocketJetScale(0, 1), 0);
  assert.equal(ROCKET_FRENZY_JET, 2.6);
});

test('ROCKET1 lines: one a cue, through the text core, in the WB13b voice - said when a cue changes under a player watching, the stage\'s own on a live stage, nothing to a joiner (mutants: a joiner told; a live stage silent; the line said every frame)', () => {
  assert.deepEqual(ROCKET_CUES.map((c) => [c.cue, c.at]), [['rise', 0], ['erupt', 6], ['great', 14], ['foals', 30], ['lull', 60], ['frenzy', 72], ['ebb', 117]]);
  assert.deepEqual(Object.keys(ROCKET_LINES), ROCKET_CUES.map((c) => c.cue));
  assert.equal(ROCKET_LINES.frenzy(), 'Daggerfall erupts into a giant diarrhea frenzy!');
  assert.equal(ROCKET_LINES.great(), 'A great horse gallops across the sky, neighing and farting!');
  for (const k of Object.keys(ROCKET_LINES)) assert.ok((ROCKET_LINES[k]().match(/!/g) ?? []).length <= 1 && !/ - /.test(ROCKET_LINES[k]()), k);
  assert.equal(rocketCue(13.9), 1);
  assert.equal(rocketCue(14), 2);
  const src = rd('src/world/rocketEvent.js');
  for (const c of ROCKET_CUES) assert.match(src, new RegExp(`${c.cue}: \\(\\) => t\\('rocket\\.${c.cue}', '`), `${c.cue} through t()`);
  const live = createRocket();
  live.set({ kind: 'rocket', at: AT }, { live: true });
  assert.equal(live.frame(AT + 100).line, ROCKET_LINES.rise(), 'a player watching it staged is told');
  assert.equal(live.frame(AT + 200).line, null, 'once');
  assert.equal(live.frame(AT + 6100).cue, 'erupt');
  assert.equal(live.frame(AT + 6200).cue, null);
  const joiner = createRocket();
  joiner.set({ kind: 'rocket', at: AT }, { live: false });
  assert.equal(joiner.frame(AT + 20_000).line, null, 'a joiner is told nothing of what they never saw');
  assert.equal(joiner.frame(AT + 30_100).cue, 'foals');
  joiner.set(null, { live: true });
  assert.equal(joiner.frame(AT + 60_100).line, null, 'nothing once it has ended');
});

test('ROCKET1 fade: a change the player watched walks over ROCKET_FADE_S each way, a welcome is whole, the other words are not this event - and `on` is the word at once (mutants: live snapped; any word taken)', () => {
  assert.equal(ROCKET_FADE_S, 4);
  const r = createRocket();
  r.set({ kind: 'rocket', at: AT }, { live: true });
  assert.equal(r.on, true);
  assert.equal(r.tick(1), 0.25);
  assert.equal(r.tick(10), 1);
  r.set(null, { live: true });
  assert.equal(r.on, false);
  assert.equal(r.tick(2), 0.5, 'and out');
  r.set({ kind: 'rocket', at: AT }, { live: false });
  assert.equal(r.weight, 1, 'a welcome is whole');
  for (const kind of ['dread', 'sunbaby']) { r.set({ kind, at: AT }, { live: false }); assert.equal(r.weight, 0, kind); }
});

// ── THE WORLD ────────────────────────────────────────────────────────

test('ROCKET1 mounds: on the world\'s own grid - the same mounds from any point that reaches them, none past the reach, about ROCKET_MOUND_CHANCE of the cells (mutants: placed round the eye; the reach ignored)', () => {
  assert.deepEqual([ROCKET_MOUND_CELL_M, ROCKET_MOUND_CHANCE, ROCKET_MOUND_REACH_M], [22, 0.42, 150]);
  const a = rocketMounds(10_000, -4_000), b = rocketMounds(10_000 + 37, -4_000 - 11);
  assert.deepEqual(rocketMounds(10_000, -4_000), a, 'pure');
  for (const m of a) assert.ok(Math.hypot(m.x - 10_000, m.z + 4_000) <= ROCKET_MOUND_REACH_M);
  const key = (m) => `${m.x},${m.z}`, bs = new Set(b.map(key));
  const shared = a.filter((m) => Math.hypot(m.x - 10_037, m.z + 4_011) <= ROCKET_MOUND_REACH_M);
  assert.ok(shared.length > 20 && shared.every((m) => bs.has(key(m))), 'two players near each other see the same mounds');
  const cells = Math.PI * ROCKET_MOUND_REACH_M ** 2 / ROCKET_MOUND_CELL_M ** 2;
  assert.ok(Math.abs(a.length / cells - ROCKET_MOUND_CHANCE) < 0.12, `${a.length} of ~${cells.toFixed(0)} cells`);
  for (const m of a) assert.ok(m.r >= 1.6 && m.r <= 3.2 && m.h >= 1.2 && m.h <= 2.4 && m.jetH >= 10 && m.jetH <= 20 && m.flight >= 2.2 && m.flight <= 3.4);
  assert.deepEqual(rocketMounds(NaN, 0), []);
});

test('ROCKET1 horses: the great horse at 14 s, its six foals from 30 s on its own way, then the frenzy\'s herd a horse every 1.1 s - every client the same sky for one stage, another stage another sky (mutants: the foals scattered; the herd outside the frenzy; seeded by the clock\'s ms)', () => {
  assert.deepEqual(ROCKET_GREAT, { at: 14, s: 16, len: 210 });
  assert.deepEqual(ROCKET_FOALS, { at: 30, n: 6, every: 2.2, s: 12, len: 75 });
  const f = rocketFlights(AT, 0);
  assert.deepEqual(rocketFlights(AT + 400, 0), f, 'a relay ms either side reads the same sky');
  assert.notDeepEqual(rocketFlights(AT + 60_000, 0), f, 'another stage, another sky');
  assert.notDeepEqual(rocketFlights(AT, 1), f, 'another cycle, another sky');
  const great = f.filter((x) => x.kind === 'great'), foals = f.filter((x) => x.kind === 'foal'), herd = f.filter((x) => x.kind === 'herd');
  assert.equal(great.length, 1);
  assert.deepEqual([great[0].start, great[0].s, great[0].len], [14, 16, 210]);
  assert.deepEqual(foals.map((x) => Math.round(x.start * 10) / 10), [30, 32.2, 34.4, 36.6, 38.8, 41]);
  for (const x of foals) assert.ok(Math.sign(x.sweep) === Math.sign(great[0].sweep) && Math.abs(x.bearing - great[0].bearing) <= 0.15, 'they follow it');
  assert.ok(herd.length >= 40 && herd.every((x) => x.start >= 72 && x.start < 117), 'the herd flies in the frenzy');
  for (const x of herd) assert.ok(x.len >= ROCKET_HERD.len[0] && x.len <= ROCKET_HERD.len[1] && x.s >= ROCKET_HERD.s[0] && x.s <= ROCKET_HERD.s[1]);
  for (const x of f) assert.ok(x.farts.length > 0 && x.farts.every((t) => t > 0 && t < x.s), `${x.kind} farts on its way`);
  for (const x of f) assert.ok(x.coat >= 0 && x.coat < ROCKET_COATS.length);
});

test('ROCKET1 horses: a flight sets out on its bearing and crosses its sweep, a unit way to it and a unit way on, its rump behind it (mutants: the sweep dropped; the rump ahead)', () => {
  const fl = { bearing: 0.5, sweep: 2.6, elev: 0.4, len: 200, seed: 7 };
  for (const k of [0, 0.3, 1]) { const h = rocketHorseAt(fl, k); assert.ok(unit(h.dir) && unit(h.forward) && unit(h.rump), `${k}`); }
  const az = (d) => Math.atan2(d[0], d[2]);
  assert.ok(close(az(rocketHorseAt(fl, 0).dir), 0.5, 1e-9), 'out of its bearing');
  assert.ok(close(az(rocketHorseAt(fl, 1).dir), 0.5 + 2.6, 1e-9), 'across its sweep');
  const h = rocketHorseAt(fl, 0.5), back = [h.rump[0] - h.dir[0], h.rump[1] - h.dir[1], h.rump[2] - h.dir[2]];
  assert.ok(back[0] * h.forward[0] + back[1] * h.forward[1] + back[2] * h.forward[2] < 0, 'it farts from behind');
});

test('ROCKET1 sky: a horse is drawn ROCKET_SKY_R out while it crosses, its clouds hang ROCKET_PUFF_S behind it and fade; the neigh as it sets out, the farts on their seconds (mutants: drawn before it sets out; the clouds never fade)', () => {
  const f = rocketFlights(AT, 0), eye = [100, 20, -50];
  assert.equal(rocketSky(f, 13.9, eye).horses.length, 0, 'nothing before the great horse');
  const s = rocketSky(f, 20, eye);
  assert.equal(s.horses.length, 1);
  assert.ok(close(Math.hypot(s.horses[0].at[0] - 100, s.horses[0].at[1] - 20, s.horses[0].at[2] + 50), ROCKET_SKY_R, 1e-6));
  assert.ok(s.puffs.length > 0 && s.puffs.length % ROCKET_PUFFS === 0 && s.puffs.every((p) => p.fade > 0 && p.fade <= 1 && p.size > 0));
  const after = rocketSky([f[0]], 14 + f[0].farts.at(-1) + ROCKET_PUFF_S * 0.9, eye);   // the great horse's alone (its foals are on their way by then), its last fart's cloud near its end
  assert.equal(after.horses.length, 0, 'gone across');
  assert.ok(after.puffs.length > 0 && after.puffs.every((p) => p.fade < 0.2), 'its last clouds fading');
  const heard = rocketSounds(f, 13.9, 14.1);
  assert.deepEqual(heard.map((x) => [x.kind, x.who]), [['neigh', 'great']]);
  const g = f[0], firstFart = rocketSounds(f, 14 + g.farts[0] - 0.01, 14 + g.farts[0]);
  assert.deepEqual(firstFart.map((x) => [x.kind, x.who]), [['fart', 'great']]);
  assert.deepEqual(rocketSounds(f, 20, 20), []);
  assert.equal(rocketSounds(f, 29.9, 30.1).filter((x) => x.kind === 'neigh' && x.who === 'foal').length, 1, 'a foal neighs as it sets out');
});

// ── THE FART ─────────────────────────────────────────────────────────

test('ROCKET1 fart: made, not decoded - each variant its own length at ROCKET_FART_RATE, peaking at 0.9, finite, the same every time (mutants: unnormalised; NaN)', () => {
  assert.equal(ROCKET_FART_RATE, 22050);
  assert.equal(ROCKET_FART_VARIANTS.length, 3);
  for (let v = 0; v < ROCKET_FART_VARIANTS.length; v++) {
    const s = rocketFartSamples(v);
    assert.ok(s instanceof Float32Array);
    assert.equal(s.length, Math.round(ROCKET_FART_VARIANTS[v].s * ROCKET_FART_RATE));
    let peak = 0;
    for (const x of s) { assert.ok(Number.isFinite(x)); peak = Math.max(peak, Math.abs(x)); }
    assert.ok(close(peak, 0.9, 1e-6), `${v} peaks at 0.9`);
    assert.deepEqual(rocketFartSamples(v), s);
  }
  assert.deepEqual(rocketFartSamples(4), rocketFartSamples(1), 'a variant past the last wraps');
});

// ── THE PASS ─────────────────────────────────────────────────────────

/** A WebGL2 that records every call (constants answer their own names). */
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

test('ROCKET1 pass: nothing to draw, NOTHING touched; the frenzy\'s sky at the far plane over the cleared depth alone, the mounds and the jets depth written, the clouds blended over them unwritten - every state put back and every allocation freed (mutants: drawn at nothing; the blend left on; a buffer leaked)', () => {
  const { gl, calls } = fakeGl();
  const p = new RocketPassRenderer(gl);
  p.setMounds([{ x: 1, y: 2, z: 3, r: 2, h: 1.5, jetH: 12, flight: 3, pulse: 0.5, seed: 1234 }], 28);
  assert.deepEqual([p.moundN, p.jetN], [1, 28]);
  p.setRain(10, [14, 22]);
  calls.length = 0;
  assert.equal(p.draw({ rise: 0, jet: 0, frenzy: 0, horses: [], puffs: [] }, I4, I4, [0, 0, 0], 1), 0);
  assert.deepEqual(calls, [], 'no show, no pass');
  const n = p.draw({ rise: 1, jet: 1, frenzy: 0.5, horses: [{ at: [0, 100, 900], forward: [1, 0, 0], len: 200, coat: 2, gallop: 1 }], puffs: [{ at: [10, 100, 900], size: 30, fade: 0.5 }] }, I4, I4, [0, 0, 0], 1);
  assert.equal(n, 7, 'the sky, the mounds, the jets, the falling poop, the horses, the clouds, the wash');
  const at = (k, ...a) => calls.findIndex((c) => c[0] === k && a.every((v, i) => c[i + 1] === v));
  const draws = calls.map((c, i) => [c[0], i]).filter(([k]) => k === 'drawArrays' || k === 'drawArraysInstanced').map(([, i]) => i);
  assert.ok(at('depthFunc', 'LEQUAL') < draws[0] && at('depthMask', false) < draws[0], 'the sky only where nothing nearer drew');
  assert.ok(calls.slice(draws[0], draws[1]).some((c) => c[0] === 'depthMask' && c[1] === true), 'the mounds write depth');
  const puffDraw = draws[5];
  assert.ok(calls.slice(draws[4], puffDraw).some((c) => c[0] === 'depthMask' && c[1] === false) && calls.slice(draws[4], puffDraw).some((c) => c[0] === 'enable' && c[1] === 'BLEND'), 'the clouds blended, unwritten');
  const after = calls.slice(draws.at(-1));
  for (const [k, ...a] of [['disable', 'BLEND'], ['enable', 'CULL_FACE'], ['depthFunc', 'LESS'], ['depthMask', true], ['bindVertexArray', null]]) assert.ok(after.some((c) => c[0] === k && a.every((v, i) => c[i + 1] === v)), `${k} ${a} put back`);
  calls.length = 0;
  p.dispose();
  const del = (k) => calls.filter((c) => c[0] === k).length;
  assert.deepEqual([del('deleteProgram'), del('deleteBuffer'), del('deleteVertexArray')], [4, 8, 6], 'every allocation has an owner');
});

test('ROCKET1 GLSL: every colour generated from world/rocketEvent.js\'s tables, the four programs the constructor builds, the mound\'s mesh closed over its skirt (mutants: a colour hand-written in the shader)', () => {
  const v3 = (c) => `vec3(${c.map((v) => v.toFixed(4)).join(', ')})`;
  assert.ok(ROCKET_SPRITE_FS.includes(v3(ROCKET_POOP)) && ROCKET_SPRITE_FS.includes(v3(ROCKET_GAS)));
  assert.ok(ROCKET_MOUND_FS.includes(v3(ROCKET_MOUND)));
  assert.ok(ROCKET_SKY_FS.includes(v3(ROCKET_FRENZY_ZENITH)) && ROCKET_SKY_FS.includes(v3(ROCKET_FRENZY_HORIZON)));
  assert.match(ROCKET_HORSE_FS, new RegExp(`uniform vec3 uCoat\\[${ROCKET_COATS.length}\\];\\s*uniform vec3 uMane\\[${ROCKET_MANES.length}\\];`));
  assert.equal(ROCKET_COATS.length, ROCKET_MANES.length, 'a mane for every coat');
  assert.deepEqual([ROCKET_HORSE_GIRTH, ROCKET_HORSE_LEGS], [1.7, 0.6], 'FATASS: every horse a barrel on stubby legs');
  assert.match(ROCKET_HORSE_FS, new RegExp(`float G = ${ROCKET_HORSE_GIRTH.toFixed(4)}, jig = `), 'the girth from the table');
  assert.match(ROCKET_HORSE_FS, new RegExp(`L = 0\\.21 \\* ${ROCKET_HORSE_LEGS.toFixed(4)}`), 'and the legs');
  for (const [vs, fs] of ROCKET_PROGRAMS) for (const s of [vs, fs]) assert.ok(s.startsWith('#version 300 es'));
  for (const fs of [ROCKET_MOUND_FS, ROCKET_SPRITE_FS, ROCKET_HORSE_FS]) assert.match(fs, /fogFactorAt\(vWorld\)/, 'fogged as the land is');
  const mesh = moundMesh(7, 16);
  assert.equal(mesh.length, 7 * 16 * 6 * 3);
  let low = Infinity, high = -Infinity;
  for (let i = 1; i < mesh.length; i += 3) { low = Math.min(low, mesh[i]); high = Math.max(high, mesh[i]); }
  assert.ok(close(low, -0.6, 1e-6) && close(high, 1, 1e-6), 'a skirt under the ground to its crown');
});

// ── THE HOST ─────────────────────────────────────────────────────────

const host = ({ origin = [0, 0] } = {}) => {
  const { gl } = fakeGl();
  const said = [], played = [], registered = [], passes = [];
  let marked = 0;
  const renderer = { gl, _lightDir: [0, 1, 0], _ambient: [0.5, 0.5, 0.5], _sunScale: 0.5, _fogMode: 0, _fogDensity: 0, _fogRange: [0, 1], _fogColor: [0.5, 0.5, 0.5], _camPos: [0, 0, 0], _focus: new Float32Array(4), _haze: new Float32Array(8), markForeignPass: () => { marked++; } };
  const o = [...origin];
  const state = { worldCoords: (p) => ({ x: (o[0] + p[0]) * 2.5, z: (o[1] + p[2]) * 2.5 }) };
  class Pass {
    constructor() { this.mounds = null; this.draws = []; this.rain = null; passes.push(this); }
    setMounds(m, c) { this.mounds = m; this.chunks = c; }
    setRain(n) { this.rain = n; }
    draw(s) { this.draws.push(s); return 3; }
    dispose() { this.disposed = true; }
  }
  const audio = { registerSamples: (k) => { registered.push(k); return true; }, play3d: (clip, pos, vol, opt) => { played.push({ clip, pos, vol, ...opt }); } };
  const h = createRocketHost(renderer, () => 5, state, { audio, Pass });
  return { h, said, played, registered, passes, o, talk: { say: (l) => said.push(l) }, marks: () => marked };
};

test('ROCKET1 host: no event, nothing - no show, no pass, no sound; staged live, the line said, the pass built once on the first draw and handed the mounds round the traveller on the ground, the renderer told its programs moved (mutants: drawn with no event; the line unsaid; the pass built every frame)', () => {
  const { h, said, played, passes, talk, marks } = host();
  h.frame(1 / 60, AT, [0, 5, 0], talk);
  assert.equal(h.showing(), false);
  assert.equal(h.draw(I4, I4, [0, 5, 0]), false);
  assert.deepEqual([passes.length, played.length, said.length], [0, 0, 0]);
  h.set({ kind: 'rocket', at: AT }, { live: true });
  h.frame(1, AT + 1000, [0, 5, 0], talk);
  assert.deepEqual(said, [ROCKET_LINES.rise()]);
  assert.equal(h.showing(), true);
  assert.equal(h.draw(I4, I4, [0, 5, 0]), true);
  assert.equal(h.draw(I4, I4, [0, 5, 0]), true);
  assert.equal(passes.length, 1, 'built once');
  assert.ok(passes[0].mounds.length > 20 && passes[0].mounds.every((m) => m.y === 5), 'on the ground the host read');
  assert.equal(passes[0].chunks, 28);
  assert.equal(marks(), 2);
  const s = passes[0].draws[0];
  assert.ok(s.rise > 0 && s.rise < 1 && s.jet === 0 && s.frenzy === 0, 'rising, under the fade');
  h.dispose();
  assert.equal(passes[0].disposed, true);
});

test('ROCKET1 host: the mounds are the world\'s - a recentre moves the scene\'s origin and every mound with it, the same mounds standing where they stood in the world (mutants: placed in scene metres)', () => {
  const a = host({ origin: [1000, 2000] }), b = host({ origin: [1100, 1950] });
  for (const x of [a, b]) { x.h.set({ kind: 'rocket', at: AT }, { live: false }); }
  a.h.frame(1, AT + 10_000, [0, 5, 0], a.talk);
  b.h.frame(1, AT + 10_000, [-100, 5, 50], b.talk);   // the same place in the world, read from another origin
  a.h.draw(I4, I4, [0, 5, 0]); b.h.draw(I4, I4, [-100, 5, 50]);
  const world = (m, o) => `${(m.x + o[0]).toFixed(6)},${(m.z + o[1]).toFixed(6)}`;
  assert.deepEqual(a.passes[0].mounds.map((m) => world(m, a.o)), b.passes[0].mounds.map((m) => world(m, b.o)));
});

test('ROCKET1 host: the great horse neighs as it sets out (DAGGER.SND AnimalHorse, pitched down) and farts on its way - a made fart, registered under its key; a mound splashes near the traveller while the jets are up (mutants: no neigh; the fart never registered)', () => {
  const { h, played, registered, talk } = host();
  h.set({ kind: 'rocket', at: AT }, { live: false });
  for (let ms = 13_000; ms <= 21_500; ms += 100) h.frame(0.1, AT + ms, [0, 5, 0], talk);   // to before its neigh at its crossing's middle
  const neigh = played.filter((p) => p.clip === SOUND.AnimalHorse);
  assert.equal(neigh.length, 1);
  assert.ok(neigh[0].pitch < 1, 'the great horse\'s deep neigh');
  assert.ok(played.some((p) => p.clip === ROCKET_FART_KEYS[1]), 'its farts');
  assert.ok(registered.includes(ROCKET_FART_KEYS[1]));
  assert.ok(played.some((p) => p.clip === SOUND.SplashLarge), 'a mound\'s splash');
  assert.deepEqual(ROCKET_FART_KEYS, ['rocket:fart0', 'rocket:fart1', 'rocket:fart2']);
});

test('ROCKET1 world.js: the host built beside the Starfall\'s, the hub\'s word handed to it with the dread\'s and the sun baby\'s, framed after the sun baby\'s fire round the traveller, drawn after the Starfall\'s sky (mutants: the word unheard; never framed; never drawn)', () => {
  const world = rd('src/scenes/world.js');
  assert.match(world, /import \{ createRocketHost \} from '\.\/rocketHost\.js';/);
  assert.match(world, /const rocket = createRocketHost\(renderer, sunbabyGround, state\);/);
  assert.match(world, /link\.onEvent = \(ev, o\) => \{ dread\.set\(ev, o\); sunbaby\.set\(ev, o\); rocket\.set\(ev, o\); \};/);
  assert.match(world, /magic\.skyFire\(fb\);\n\s*rocket\.frame\(dt, Date\.now\(\) \+ _sharedOffsetMs, tvStand, townTalk\);/);
  assert.match(world, /starfall\.drawSky\(proj, view, new Float32Array\(mwv\.eye\), now \/ 1000\)\) renderer\.markForeignPass\(\);\n\s*rocket\.draw\(proj, view, mwv\.eye\);/);
  assert.ok(world.indexOf('const rocket = createRocketHost(') > world.indexOf('const state = new StreamingWorldState('), 'built after the streaming world it anchors to');
});
