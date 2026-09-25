// AUDIT WB (2026-09-25, Mac: "A proper audit on everything"): THE LOOK AND THE SOUND, pinned - the fanfare cut by a
// clock that was not its own (D2), a Warden who never grunted in a big fight (D3), war songs silent a second at every
// loop (D4), a veil that counted its own ticks (D5) and flashed a frame late (D6), a sky clock that drifted after a sleep
// (D7), falls of fire that jumped at the wrap (D8), ridges worked out at the zenith (D9), and what the court made every
// frame (D10). Design: bible/11-Multiplayer/World-Bosses.md section 11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCourtScore, courtScoreFor, gateScoreSongs, GATE_SONGS, SCORE_SILENCE, SCORE_STING_MS } from '../src/systems/gateScore.js';
import { MusicService, MUSIC_FADE_OUT_S, MUSIC_FADE_IN_S } from '../src/systems/music.js';
import { SongPlayer } from '../src/systems/songPlayer.js';
import { createGateCourt } from '../src/scenes/gateCourt.js';
import { createSpoilsPool } from '../src/scenes/spoilsPool.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { courtToDungeon, courtLights } from '../src/world/gateArena.js';
import { BOSS_CUES, HURT_SHARE, HURT_GAP_MS } from '../src/world/gateBoss.js';
import { createGateVeil, VEIL_OPEN_WAIT_TICKS } from '../src/ui/gateVeil.js';
import {
  anchoredClock, DEAD_SKY_FS, FALL_TURNS, FALL_SLIDE, DEAD_CLOCK_PERIOD, RIDGES_TOP, RIDGES, SIGIL_TOWER, LESSER_TOWERS,
} from '../src/render/deadlands.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const fight = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 1000, max: 1000, fighters: 3, wrathAt: 10_000_000, ...over });

test('AUDIT WB D2 the fanfare begun here plays whole, from its own start - a kill heard late is not cut short - and a late arrival hears quiet; another day starts fresh', () => {
  const sc = createCourtScore();
  const fell = { at: 100_000, top: [], n: 3 };
  assert.equal(sc.want(fight({ phase: 2 }), 90_000), GATE_SONGS.war2);
  // the kill's word comes 4 s late: the law (from his fall) would cut the fanfare at 8.5 s of it
  assert.equal(sc.want(fight({ fell, hp: 0 }), 104_000), GATE_SONGS.fell);
  assert.equal(courtScoreFor(fight({ fell, hp: 0 }), 104_000 + SCORE_STING_MS - 4001), GATE_SONGS.fell);
  assert.equal(courtScoreFor(fight({ fell, hp: 0 }), 104_000 + SCORE_STING_MS - 1), SCORE_SILENCE, 'the law alone cuts it 4 s short');
  assert.equal(sc.want(fight({ fell, hp: 0 }), 104_000 + SCORE_STING_MS - 1), GATE_SONGS.fell, 'played whole here');
  assert.equal(sc.want(fight({ fell, hp: 0 }), 104_000 + SCORE_STING_MS), SCORE_SILENCE);
  // a player who comes to the court long after his fall hears no fanfare at all
  const late = createCourtScore();
  assert.equal(late.want(fight({ fell, hp: 0 }), fell.at + SCORE_STING_MS + 60_000), SCORE_SILENCE);
  // the next day's fight
  assert.equal(sc.want(fight({ day: 701, phase: 1 }), 200_000), GATE_SONGS.war1);
  assert.equal(sc.want(fight({ day: 701, fell: { at: 210_000, top: [], n: 1 }, hp: 0 }), 210_500), GATE_SONGS.fell, 'its own fanfare');
  assert.equal(sc.want(null, 1), null, 'no fight, no score');
});

/** A MusicService on fake players (test/disc20.test.js's harness). */
function fadingService() {
  const log = [];
  const songs = ['DAY', 'NIGHT', 'GATEFELL'].map((name) => ({ name, events: [1] }));
  const player = () => ({
    playing: false, song: null,
    play(song) { if (this.playing && this.song === song) return true; this.stop(); this.song = song; this.playing = true; log.push(`play ${song.name}`); return true; },
    stop() { if (this.song) log.push('stop'); this.playing = false; this.song = null; },
    fadeTo(level, s) { log.push(`fade ${level} ${s}`); },
  });
  const svc = new MusicService();
  svc._unsubscribe();
  svc.enabled = true;
  svc.archive = { getSongIndex: (n) => songs.findIndex((s) => s.name === n), getSong: (i) => songs[i] };
  svc.player = player();
  const timers = [];
  svc._later = (fn, ms) => timers.push({ fn, ms, off: false });
  svc._cancelLater = (id) => { timers[id - 1].off = true; };
  const flush = () => { for (const t of timers.splice(0)) if (!t.off) t.fn(); };
  return { svc, log, timers, flush };
}

test('AUDIT WB D2 fadeOut is an ending, not a cut: the song fades over MUSIC_FADE_OUT_S and then stops; a song asked for during it follows; the same one asked back turns round; nothing sounding is a stop', () => {
  const { svc, log, timers, flush } = fadingService();
  svc.playSong('GATEFELL'); log.length = 0;
  svc.fadeOut();
  assert.deepEqual(log.splice(0), [`fade 0 ${MUSIC_FADE_OUT_S}`], 'it fades - nothing stops yet');
  assert.equal(svc.current, null, 'the court\'s music is let go at once');
  assert.equal(timers[0].ms, MUSIC_FADE_OUT_S * 1000);
  flush();
  assert.deepEqual(log.splice(0), ['stop'], 'stopped at silence, nothing after it');
  assert.equal(svc.playing, false);
  // a song asked for during the fade follows it
  svc.playSong('DAY'); log.length = 0;
  svc.fadeOut();
  svc.playSong('NIGHT');
  flush();
  assert.deepEqual(log.splice(0), [`fade 0 ${MUSIC_FADE_OUT_S}`, 'stop', 'play NIGHT', 'fade 0 0', `fade 1 ${MUSIC_FADE_IN_S}`]);
  // the same one asked back turns round where the fade stands
  svc.fadeOut();
  svc.playSong('NIGHT');
  assert.equal(svc.current, 'NIGHT');
  flush();
  assert.deepEqual(log.splice(0), [`fade 0 ${MUSIC_FADE_OUT_S}`, `fade 1 ${MUSIC_FADE_IN_S}`], 'never stopped');
  // a fade asked during a switch: nothing starts after it
  svc.playSong('DAY'); svc.fadeOut(); flush();
  assert.equal(svc.current, null); assert.equal(svc.playing, false);
  const w = read('src/scenes/world.js');
  assert.match(w, /const _courtScore = createCourtScore\(\);/);
});

test('AUDIT WB D3 his grunt counts the loss since his last one: many small blows add up to a share and he grunts; none closer than HURT_GAP_MS; a heal starts the count again', () => {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const sounds = [];
  const c = createGateCourt({
    renderer: null, gl: null, audio: { play3d: (clip, p, v, o) => sounds.push([clip, o.pitch]), play3dId: () => {} },
    link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), feet: () => null, player: () => null, rng: () => 0.5,
  });
  const grunts = () => sounds.filter(([clip, pitch]) => clip === BOSS_CUES.hurt.clip && pitch === BOSS_CUES.hurt.pitch).length;
  const share = HURT_SHARE * 1000, q = share / 4;   // a quarter of a share a word
  const at = (hp, dt) => { clock.t += dt; link.st = fight({ hp }); c.frame(); };
  let hp = 1000;
  at(hp, HURT_GAP_MS);
  for (let i = 0; i < 4; i++) at(hp -= q, HURT_GAP_MS);
  assert.equal(grunts(), 1, 'four small blows make a share - counted a word at a time, he never grunted');
  at(hp -= share, 10);
  assert.equal(grunts(), 1, 'a share more, but too soon after the last');
  at(hp -= q, HURT_GAP_MS);
  assert.equal(grunts(), 2, 'and the loss is still counted when the gap has passed');
  // a heal (a newcomer's share) raises him: the count starts from there
  at(hp += 200, HURT_GAP_MS);
  for (let i = 0; i < 3; i++) at(hp -= q, HURT_GAP_MS);
  assert.equal(grunts(), 2, 'three quarters since the heal');
  at(hp -= q, HURT_GAP_MS);
  assert.equal(grunts(), 3);
});

test('AUDIT WB D4 a war song loops on its bar line: the next pass\'s first note is scheduled at the end of this one to the tick - a classic song still rings a second first; the war songs are the seamless ones, the fanfare not', () => {
  const songs = gateScoreSongs();
  for (const k of ['war1', 'war2', 'war3']) assert.equal(songs[k].seamless, true, k);
  assert.equal(GATE_SONGS.fell, songs.fell.name);
  const run = (seamless) => {
    const ctx = { currentTime: 0, destination: {}, createGain() { return { gain: { value: 1, setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {}, cancelAndHoldAtTime() {} }, connect(x) { return x; } }; } };
    const sp = new SongPlayer(ctx);
    const voiced = [];
    sp._voice = (e, t) => voiced.push([e.tick, t]);
    sp._control = () => {};
    const song = { name: 'T', secondsPerTick: 0.01, durationTicks: 400, events: [{ tick: 0, type: 'noteOn', channel: 0, note: 60, velocity: 100, duration: 50 }, { tick: 200, type: 'noteOn', channel: 0, note: 62, velocity: 100, duration: 50 }], seamless };
    sp.play(song);
    clearInterval(sp._timer);
    for (let t = 0; t <= 9; t += 0.05) { ctx.currentTime = t; sp._pump(); }
    sp.stop();
    return voiced.filter(([tick]) => tick === 0).map(([, t]) => +t.toFixed(6));
  };
  const seam = run(true);
  assert.ok(seam.length >= 3, `${seam}`);
  for (let i = 1; i < seam.length; i++) assert.ok(Math.abs(seam[i] - seam[i - 1] - 4) < 1e-9, `a pass is its 4 s, to the tick: ${seam}`);
  const classic = run(false);
  assert.ok(classic[1] - classic[0] > 4.9, `the classic rewind rings a second first: ${classic}`);
});

function fakePage() {
  const calls = [];
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4, COLOR_BUFFER_BIT: 5, VERTEX_SHADER: 6, FRAGMENT_SHADER: 7 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const canvases = [];
  const doc = {
    body: { appendChild: (c) => { c.inPage = true; } },
    createElement: (tag) => { const c = { tag, style: {}, width: 0, height: 0, setAttribute() {}, remove() {}, getContext: () => gl }; canvases.push(c); return c; },
  };
  let frames = [];
  let t = 1000;
  const step = (ms = 16) => { t += ms; const f = frames; frames = []; for (const g of f) g(); };
  return { doc, raf: (f) => { frames.push(f); }, now: () => t, engine: { soundIndexForId: () => -1, playOneShot() {} }, win: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 }, calls, canvases, step };
}

test('AUDIT WB D5 the veil holds shut on the frames the host has DRAWN since the reveal, not its own ticks - a capped or held frame is no frame of the new place; no word from the host, its ticks as before', () => {
  const p = fakePage();
  const veil = createGateVeil(p);
  veil.cover();
  for (let i = 0; i < 90; i++) p.step(16);
  assert.equal(veil.phase, 'shut');
  veil.frameDrawn();   // the host counts - a frame drawn before the reveal is the old place's
  veil.reveal();
  for (let i = 0; i < 10; i++) p.step(16);
  assert.equal(veil.phase, 'shut', 'ten ticks and no frame drawn: held');
  for (let k = 0; k < VEIL_OPEN_WAIT_TICKS - 1; k++) { veil.frameDrawn(); p.step(16); }
  assert.equal(veil.phase, 'shut');
  veil.frameDrawn(); p.step(16);
  assert.equal(veil.phase, 'opening', 'opened on the new place\'s frames');
  assert.equal(veil.warm(), true, 'built ahead: the same veil');
  assert.equal(p.canvases.length, 1);
  const w = read('src/scenes/world.js');
  assert.equal((w.match(/gateVeil\?\.frameDrawn\(\);   \/\/ AUDIT WB D5/g) ?? []).length, 2, 'the exterior\'s frame and the modal one both say it');
  assert.match(w, /try \{ if \(gatePool\?\.frame\(dt\)\) warmGateVeil\(\); \}/);
  assert.match(w, /idle\(\(\) => \{ try \{ gateVeil\.warm\(\); \} catch \{/);
});

test('AUDIT WB D6 the flash is the fire in the call itself - never a frame of what it covers', () => {
  const p = fakePage();
  const veil = createGateVeil(p);
  veil.flash();
  assert.ok(p.calls.some((c) => c[0] === 'drawArrays'), 'drawn before any tick');
  assert.equal(p.canvases[0].style.display, 'block');
});

test('AUDIT WB D7 the Deadlands\' clock runs on the page\'s clock from an anchor on the wall - after a sleep that stopped the page\'s clock it is the wall\'s again; a jitter under the slack never steps it back', () => {
  let perf = 1000, wall = 5_000_000;
  const s = anchoredClock({ perf: () => perf, wall: () => wall });
  assert.equal(s(), 5000);
  perf += 500; wall += 500;
  assert.equal(s(), 5000.5);
  perf += 100; wall += 40;   // the wall jitters behind: not an anchor
  assert.equal(s(), 5000.6, 'the page\'s clock: never back');
  wall += 60 * 60_000; perf += 16;   // an hour asleep: the page's clock stood
  assert.ok(Math.abs(s() - (wall / 1000)) < 1e-9, 'anchored again on the wall');
  const offset = { ms: 0 };
  const t = anchoredClock({ perf: () => perf, wall: () => wall + offset.ms });
  const a = t();
  offset.ms = 5000;   // the relay's offset moved
  assert.ok(Math.abs(t() - a - 5) < 1e-9);
});

test('AUDIT WB D8 the falls\' grain slides a whole number of times a period, each layer faded out where it wraps - the clock\'s wrap is one more wrap', () => {
  assert.ok(Number.isInteger(FALL_TURNS));
  assert.match(DEAD_SKY_FS, new RegExp(`float fph = fract\\(t \\* ${(FALL_TURNS / DEAD_CLOCK_PERIOD).toFixed(6)}\\);`));
  assert.match(DEAD_SKY_FS, /float fk = 1\.0 - abs\(2\.0 \* fph - 1\.0\);/);
  assert.match(DEAD_SKY_FS, /float pour = 0\.55 \+ 0\.45 \* fg;/);
  assert.doesNotMatch(DEAD_SKY_FS, /e \* 260\.0 \+ t \*/, 'never the grain read at the clock\'s radians');
  // the law in numbers: the weights, each layer's at its own wrap, and the period's end
  const fph = (t) => (t * FALL_TURNS / DEAD_CLOCK_PERIOD) % 1;
  const fk = (p) => 1 - Math.abs(2 * p - 1);
  assert.equal(fk(0), 0, 'layer one wraps at nothing');
  assert.equal(1 - fk(0.5), 0, 'layer two wraps at nothing');
  assert.ok(Math.abs(fph(DEAD_CLOCK_PERIOD - 1e-9) - 1) < 1e-6 || fph(DEAD_CLOCK_PERIOD - 1e-9) < 1e-6, 'the period ends on a slide\'s end');
  assert.equal(fph(DEAD_CLOCK_PERIOD), 0);
  assert.ok(Math.abs(FALL_SLIDE * FALL_TURNS / DEAD_CLOCK_PERIOD - (FALL_TURNS / DEAD_CLOCK_PERIOD) * 2 * Math.PI) < 1e-12, 'the pour\'s old speed');
});

test('AUDIT WB D9 no ridge and no tower stands above RIDGES_TOP, and the sky skips their noise there', () => {
  assert.ok(RIDGES_TOP > SIGIL_TOWER.top + 0.03, 'the great tower\'s crown and its crest\'s margin');
  for (const t of LESSER_TOWERS) assert.ok(RIDGES_TOP > t.top + 0.03);
  for (const r of RIDGES) assert.ok(RIDGES_TOP > r.base + r.rise + 0.03);
  assert.match(DEAD_SKY_FS, new RegExp(`if \\(e < ${RIDGES_TOP.toFixed(4)}\\) \\{\\n\\s+\\{\\n\\s+float hgt = `));
});

test('AUDIT WB D10 what the court asks for every frame is made once: its lists refilled, an empty floor\'s the same frozen one, the braziers\' lights and places, the fog one object', () => {
  const link = { st: fight(), state() { return this.st; } };
  const spoils = createSpoilsPool({ ray: () => null, now: () => 0, take: () => {} });
  const c = createGateCourt({ link, now: () => 0, spoils });
  assert.equal(c.lights(), c.lights(), 'one list');
  assert.equal(c.batches(), c.batches());
  assert.equal(spoils.batches(), spoils.batches());
  assert.equal(spoils.lights(), spoils.lights());
  assert.ok(Object.isFrozen(spoils.lights()) && spoils.lights().length === 0);
  assert.equal(courtLights(), courtLights());
  const m = read('src/scenes/worldModes.js');
  assert.match(m, /renderer\.setLighting\(courtEquatorOf\(_ct\), 0, undefined, _ct\);/);
  assert.doesNotMatch(m, /new Float32Array\(_ct\.equator\)/);
  const w = read('src/scenes/world.js');
  assert.match(w, /const _courtBeds = courtBraziers\(\)\.map\(\(\[, p\]\) => p\);/);
  assert.doesNotMatch(w, /drawLife\(proj, view, courtToDungeon\(/);
});
