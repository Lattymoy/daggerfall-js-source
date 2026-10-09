// SD27 (2026-10-09, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16): AUDIT SD V - Mac: "let's
// audit everything", cut short after six of its eight lenses found; the findings two or more lenses met and the highs
// verified and fixed, with Mac's own ask beside them ("disable levitation inside the rift"). A Levitate lifted a body over
// the Steps (the ward reached the street's flags alone); the bridge was walked on before it was drawn; a fresh Hour showed
// its End in red; the way back tolled the way home's bell on every arrival and lit the void past the Threshold's rim; the
// Drift's rods stood through anyone at a deck's edge; the arrival exhale was spent under the veil and lost after the first
// visit; and the Hollow's and the Hour's frames made kilobytes of garbage the L2 F9 measure never ran.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createSdEnd } from '../src/scenes/sdEnd.js';
import { RIFT_BELL_RECORDS } from '../src/systems/sdRiftSound.js';
import { sdHourClockOf, sdArenaGlowAt } from '../src/render/sdArenaGlow.js';
import { SD_SKY_MODE } from '../src/render/sdSky.js';
import { SD_FIGHT_EMPTY } from '../src/net/sdFightLink.js';
import { SD_THRESHOLD, realmToDungeon } from '../src/net/sdBrain.js';
import { SD_THRESHOLD_RIM, SD_WAY_BACK_Z, SD_WAY_BACK_SIZE } from '../src/world/sdRealm.js';
import { riftLook, SD_RIFT_OPEN_LOOK } from '../src/world/sdDungeon.js';

const ROOT = join(import.meta.dirname, '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const fakeRenderer = () => ({ createMesh: (m) => ({ m }), destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {} });
const fakeAudio = () => {
  const log = [];
  return {
    log,
    samplesOf: (i) => (i === RIFT_BELL_RECORDS.bell || i === RIFT_BELL_RECORDS.bubbles ? new Float32Array(4000).map((_, k) => Math.sin(k / 9)) : null),
    registerSamples: () => true,
    play3d: (key, at) => { log.push(['toll', key, at]); return 6.5; },
    loop3d: () => ({ stop() {} }),
  };
};

test('AUDIT SD V (L1, Mac: "disable levitation inside the rift"): NO LEVITATE IN THE HOUR - the dungeon arm, which draws the Hour, writes the motor\'s flag through the same ward the street\'s does (a siege\'s room, the Shattered Hour): SD7b\'s ward reached the street\'s flags alone, so a Levitate lifted a body over the Steps; the staff\'s /fly is never warded (mutants: the dungeon arm unwarded; the Hour out of the ward)', () => {
  const D = read('src/scenes/dungeonContext.js'), W = read('src/scenes/world.js'), M = read('src/scenes/worldModes.js');
  assert.match(D, /playerLevitating: \(\) => hasActiveEffect\(playerEntity, 'levitate'\) && !levitateWarded\(\) \|\| staffFly\(\),/);
  assert.match(D, /import \{[^}]*\blevitateWarded\b[^}]*\} from '\.\.\/characters\/playerEntity\.js';/);
  assert.match(W, /registerLevitateWard\(\(\) => inSiegeRoom\(\) \|\| modes\?\.sdRealmSlot\?\.\(\) != null\);/, 'the Hour is warded');
  assert.match(M, /player\.levitating = dungeonCtx\.playerLevitating\(\);/, 'the dungeon arm reads it');
});

test('AUDIT SD V (S1): NO FIGHT HEARD IS NO END - the sky\'s fight clock and the arena\'s floor read nothing from the empty fight (its `ends` 0 made every fresh Hour\'s sky red, its rim and fissures red and its pillars\' dials red while the Remnant waited); a live fight still reads its own (mutants: the sky blind to the empty fight; the floor blind to it)', () => {
  const out = new Float64Array(4), memo = {};
  assert.equal(sdHourClockOf(SD_FIGHT_EMPTY, 1e6, out)[0], SD_SKY_MODE.none, 'no clock on the sky');
  assert.equal(sdArenaGlowAt(SD_FIGHT_EMPTY, 1e6, memo).end, 0, 'no End on the floor');
  const live = { fi: 1, op: 0, ends: 1000, ph: 1, rem: { atk: null }, ec: [], clk: null };
  assert.equal(sdHourClockOf(live, 10_000, out)[0], SD_SKY_MODE.end, 'a fight past its time: its End');
});

test('AUDIT SD V (S2, R2): THE WAY BACK STANDS AS THE THRESHOLD\'S - no reveal (the way home\'s bell tolled on every arrival, under the veil\'s chime, with the way back behind the player), while the Hollow\'s Rift still tolls once at the first clear sight; its floor light stops at the Threshold\'s rim (no probe lit eight metres about it, five over the void) and reaches no further than before (mutants: the way back revealed; the floor light past the rim; the way back unprobed)', () => {
  let ms = 1000;
  const a = fakeAudio(), back = createSdEnd({ renderer: fakeRenderer(), audio: a, now: () => ms });
  back.stand({ rift: { at: realmToDungeon(0, 0, SD_WAY_BACK_Z), size: SD_WAY_BACK_SIZE }, retAt: null, dynamicDraws: [], hollow: true, probe: SD_THRESHOLD_RIM });
  const eye = realmToDungeon(0, 1.6, 1);
  for (let k = 0; k < 40; k++) { ms += 100; back.frame(null, eye); }
  assert.equal(a.log.filter((x) => x[0] === 'toll').length, 0, 'the way back: no toll');
  const b = fakeAudio(), hollow = createSdEnd({ renderer: fakeRenderer(), audio: b, now: () => ms });
  hollow.stand({ rift: { at: [0, 0, 0], size: 4 }, retAt: null, dynamicDraws: [] });
  for (let k = 0; k < 40; k++) { ms += 100; hollow.frame(null, [0, 1.6, 8]); }
  assert.equal(b.log.filter((x) => x[0] === 'toll').length, 1, 'the Hollow\'s Rift: once');
  // the rim: every bearing's reach inside the Threshold's disc, the near side as before
  const at = realmToDungeon(0, 0, SD_WAY_BACK_Z), c = realmToDungeon(SD_THRESHOLD.x, 0, SD_THRESHOLD.z);
  for (let k = 0; k < 16; k++) {
    const t = (k / 16) * Math.PI * 2, d = [Math.cos(t), 0, Math.sin(t)], r = SD_THRESHOLD_RIM.ray([at[0], at[1] + 0.3, at[2]], d);
    const px = at[0] + d[0] * r - c[0], pz = at[2] + d[2] * r - c[2];
    assert.ok(Math.hypot(px, pz) <= SD_THRESHOLD.r + 1e-6 && r <= 1.6 * SD_WAY_BACK_SIZE + 1e-9, `bearing ${k}: ${r.toFixed(2)} m`);
  }
  const behind = SD_THRESHOLD_RIM.ray([at[0], at[1] + 0.3, at[2]], [0, 0, -1]);
  assert.ok(Math.abs(behind - (SD_THRESHOLD.r + SD_WAY_BACK_Z)) < 1e-6, `behind it: ${behind.toFixed(2)} m to the rim`);
  assert.match(read('src/scenes/dungeonContext.js'), /hollow: true, probe: SD_THRESHOLD_RIM \}\); return; \}/, 'the dungeon host stands it so');
});

test('AUDIT SD V (L2): THE CONCORD\'S EDGE WAITS FOR ITS BRIDGE - the world host opens the edge onto the bridge only as the hall says it stands drawn (S10 laid the plates 1.2 s after the word, and the floor stood under nothing); with no hall to ask, as before (mutants: the edge from the word alone; the hall unasked)', () => {
  const W = read('src/scenes/world.js'), D = read('src/scenes/dungeonContext.js');
  assert.match(W, /const sdConcordHere = \(\) => !!sdHallWord\(\)\?\.ok && modes\?\.dungeonCtx\?\.sdHallBridgeLaid\?\.\(\) !== false;/);
  assert.match(D, /sdHallBridgeLaid: sdHall \? \(\) => sdHall\.bridgeLaid : undefined,/);
});

test('AUDIT SD V (L5, S5): THE ARRIVAL EXHALE, HOSTED - the world host hands the blows\' sparks the veil (an arrival is seen once it opens) and tells them every frame out of the Hour (the latch fell only with a fight\'s leave) (mutants: under the veil; the latch kept)', () => {
  const W = read('src/scenes/world.js');
  assert.match(W, /ready: \(\) => !gateVeil\?\.busy,/);
  assert.match(W, /if \(!inRealm\) sdFx\?\.away\(\);/);
});

test('AUDIT SD V (P1): THE RIFT\'S LOOK IS A FRAME\'S, NEVER MADE - the open Rift\'s look one record an hour of studs, made once; the collapse\'s one kept record; the dungeon host asks the world host\'s look door alone (sdRiftOf made the word, the count and the step\'s door four times a frame for it) (mutants: the open look made a call; the host asking the whole word)', () => {
  const rec = { s: 7, rose: 0, foundAt: 1, until: 5 * 3600000, ph: 'found' };
  const a = riftLook(rec, 7, 0), b = riftLook(rec, 7, 0);
  assert.equal(a.state, 'open'); assert.equal(a, b, 'the same record, call after call'); assert.ok(Object.isFrozen(a));
  assert.deepEqual({ ...a, studs: 0 }, { ...SD_RIFT_OPEN_LOOK, studs: 0 }); assert.equal(a.studs, 5, 'five hours left, five studs');
  const D = read('src/scenes/dungeonContext.js'), W = read('src/scenes/world.js');
  assert.match(D, /look: \(\) => \(opts\.superRiftLook \? opts\.superRiftLook\(dfLocation\?\.sdSlot\) : sdEndWord\(\)\?\.look\) \?\? null/);
  assert.match(W, /superRiftLook: \(s\) => sdRiftLookOf\(s\),/);
});

test('AUDIT SD V (P1-P4, P6): THE HOLLOW\'S AND THE HOUR\'S FRAMES MAKE NOTHING - measured as L2 F9 measures (a child, a 64 MB young space, the least of six windows, a control that must show): the end\'s look, halos and lights in the Hollow and as the way back, its `hasRet`; the sky map\'s paint and the halo pass on a GL that makes nothing; the Orrery\'s hands into their matrices; the Hour\'s air - none past 2 bytes a frame (they made 0.15 to 9 KB a frame) (mutants: the look made a frame; the halos\' list let go; the sky\'s key a string; the halo\'s corners made; the hands made; the air asked a frame)', (t) => {
  const url = (p) => JSON.stringify(pathToFileURL(join(ROOT, p)).href);
  const script = `
    const { createSdEnd } = await import(${url('src/scenes/sdEnd.js')});
    const { SdSkyMap, SD_SKY_STEPS } = await import(${url('src/render/sdSky.js')});
    const { SdHaloRenderer } = await import(${url('src/render/sdHalo.js')});
    const { handMatrix } = await import(${url('src/world/sdHall.js')});
    const { createSdAir } = await import(${url('src/scenes/sdAir.js')});
    const { realmToDungeon } = await import(${url('src/net/sdBrain.js')});
    const { SD_THRESHOLD_RIM } = await import(${url('src/world/sdRealm.js')});
    const renderer = { createMesh: () => ({}), destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {} };
    const bytes = (fn) => {
      for (let f = 0; f < 20000; f++) fn();
      let least = Infinity;
      for (let w = 0; w < 6; w++) {
        globalThis.gc(); globalThis.gc();
        const h0 = process.memoryUsage().heapUsed;
        for (let f = 0; f < 5000; f++) fn();
        least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 5000);
      }
      return least;
    };
    // a WebGL2 whose calls make nothing: every name the passes ask learnt once, then a plain object of fixed answers
    const names = new Set(), learn = new Proxy({}, { get: (t, k) => { names.add(k); return typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 1 : () => ({}); } });
    new SdSkyMap(learn); new SdHaloRenderer(learn);
    const gl = { drawingBufferWidth: 1280, drawingBufferHeight: 720 }, OBJ = {};
    const fixed = (k) => (k === 'getShaderParameter' || k === 'getProgramParameter' ? () => true : () => OBJ);
    for (const k of ['uniform1f', 'uniform1i', 'uniform2fv', 'uniform3fv', 'uniform4fv', 'uniformMatrix4fv', 'viewport', 'drawArrays', 'bufferSubData', 'enable', 'disable', 'depthMask', 'blendFunc', 'useProgram', 'bindVertexArray', 'bindBuffer', 'bindFramebuffer', 'framebufferTexture2D', 'activeTexture', 'bindTexture', ...names]) {
      if (typeof k !== 'string' || k in gl) continue;
      gl[k] = /^[A-Z_0-9]+$/.test(k) ? 1 : fixed(k);
    }
    const out = {}, sink = [], feet = realmToDungeon(0, 0, 42);
    out.control = bytes(() => { sink[0] = [feet[0] + 0.5, feet[1] + 0.5, feet[2] + 0.5]; });
    let ms = 0;
    const end = createSdEnd({ renderer, now: () => (ms += 16) });
    end.stand({ rift: { at: [0, 0, 0], size: 5 }, retAt: [6, 0, 0] });
    const eye = [0, 1.6, 8], sky = { map: {}, seconds: 1, gain: 1, clock: null };
    out.hollowLook = bytes(() => { end.look(eye, sky, 12); });
    out.hollowLists = bytes(() => { end.halos(); end.lights(); sink[1] = end.hasRet; });
    const back = createSdEnd({ renderer, now: () => (ms += 16) });
    back.stand({ rift: { at: realmToDungeon(0, 0, -5), size: 5 }, retAt: null, hollow: true, probe: SD_THRESHOLD_RIM });
    out.backLook = bytes(() => { back.look(eye, sky, 12); back.halos(); back.lights(); });
    const map = new SdSkyMap(gl), vp = [0, 0, 1280, 720], look = { steps: SD_SKY_STEPS.lane, ending: [0.4, 0.8, 0.5], endingIdx: 2 }, haze = new Float32Array([0.05, 0.04, 0.03]);
    out.skyPaint = bytes(() => map.paint(1, haze, look, vp));
    const halo = new SdHaloRenderer(gl), proj = new Float32Array(16).fill(0.5), view = new Float32Array(16).fill(0.25), halos = [{ at: [0, 1, 2], size: 1, color: [0.5, 0.4, 0.1] }];
    // the fog's density a whole number: a double read off an object's field and handed to a call is boxed afresh (16 B) -
    // the caller's number, the same for every pass, not the pass's
    const fog = { mode: 1, density: 1, range: new Float32Array([10, 100]), camPos: new Float32Array(3) };
    out.haloDraw = bytes(() => halo.draw(proj, view, halos, fog, 1));
    const m = new Float32Array(16), hours = Array.from({ length: 4096 }, (_, k) => (k / 97) % 12); hours.push('tagged');
    let h = 0;
    out.hands = bytes(() => { for (let i = 0; i < 6; i++) handMatrix(i, hours[(h = (h + 1) & 4095)], m); });
    const engine = { registerSamples() { return true; }, samplesOf() { return new Float32Array(8); }, setBed() {}, setBed3d() {}, play3d() {}, fadeFar() {} };
    const air = createSdAir(engine), ear = realmToDungeon(0, 1.7, 42);
    // the clock's seconds as the host hands them, numbers already made (a list of doubles boxes each one read, 16 B), on
    // and on: a period's turn passed, its events played
    const secs = Array.from({ length: 60000 }, (_, k) => 100000 + k / 60); secs.push('tagged');
    let s = 0;
    out.air = bytes(() => air.frame(secs[s++], ear));
    console.log(JSON.stringify(out));
  `;
  const run = spawnSync(process.execPath, ['--expose-gc', '--min-semi-space-size=64', '--max-semi-space-size=64', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const m = JSON.parse(run.stdout.trim().split('\n').pop());
  t.diagnostic(Object.entries(m).map(([k, b]) => `${k} ${b.toFixed(2)}`).join(', '));
  assert.ok(m.control >= 40, `the control made ${m.control.toFixed(2)} bytes a frame - the measure is blind`);
  for (const [path, b] of Object.entries(m)) if (path !== 'control') assert.ok(b < 2, `${path}: ${b.toFixed(2)} bytes a frame (the control ${m.control.toFixed(2)})`);
});
