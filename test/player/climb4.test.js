// CLIMB4 (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md; Mac: "I reallty want go to go all in with the
// detai. Liike proer feel to climbing"): THE FEEL. The motor's climb events (motor.js _pkEmit), the camera's law over
// them (player/climb/climbFeel.js - the catch's dip, the sway, the shimmy's and the free climb's rhythm, the pull-up's look,
// the lower's and the corner's and the eject's turn, the leap's kick, the grip's tremble), its view half
// (applyClimbView), the look filter's turn, and every host that draws a first-person view applying it. And THE
// SOUNDS (player/climb/climbSounds.js, F9-F15): the eleven clips of our own (tools/climbSfx.mjs), registered once; the catch,
// the hands and boots on the wall, every move's cues on its own clock, the grip failing and gone, the effort's voice
// (hostCombat.playerClimbStrain) - and the port's own sounds' switch over all of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PlayerMotor } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { ClimbFeel, applyClimbView, FEEL, bump, tremble, createClimbFeelHost } from '../../src/player/climb/climbFeel.js';
import { ClimbSounds, CLIMB_SFX, CLIMB_SFX_FILES, CLIMB_SOUND, installClimbSounds, _resetClimbSounds, moveCues } from '../../src/player/climb/climbSounds.js';
import { enhancedSoundsOn } from '../../src/systems/enhancedSounds.js';
import { playerClimbStrain, playerAttackGrunt } from '../../src/scenes/hostCombat.js';
import { getBool, setValue, resetToDefaults } from '../../src/systems/settings/settings.js';
import { createWeaponRig, climbLowerStep, climbDrop, climbLowerRect, CLIMB_LOWER_TAU, CLIMB_LOWER_GONE } from '../../src/combat/weapon/weaponRig.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { motionBagOf } from '../../src/player/motor.js';
import { LookFilter, takeFrameLook } from '../../src/player/lookFilter.js';
import { lookAt } from '../../src/world/mat4.js';
import { PARKOUR_GRIP_LOW } from '../../src/player/parkour.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const blank = { forward: 0, strafe: 0, run: false, jump: false, crouch: false };
const DEG = Math.PI / 180;
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;
function world() {
  const col = new Collider(() => 0);
  let n = 0;
  const box = (...b) => col.addMesh(`b${n++}`, new Float32Array([b[0], b[1], b[2], b[3], b[1], b[2], b[3], b[4], b[2], b[0], b[4], b[2], b[0], b[1], b[5], b[3], b[1], b[5], b[3], b[4], b[5], b[0], b[4], b[5]]), BOX_IDX, I);
  return { col, box };
}
function climber(col, skill = 50) {
  return new PlayerMotor(col, { speed: 50, running: 30 }, {
    parkour: { enabled: () => true, inputs: () => ({ climbing: skill, jumping: skill }), say: () => {}, tally: () => {} },
  });
}
/** A stand-in motor for the law alone: its state set by the test. */
function fake(over = {}) {
  return { climbEvents: [], pos: [0, 0, 0], onWall: false, hanging: false, climbMove: null, wallNormal: null, grip: 1, ...over };
}
const frames = (feel, m, n, yaw = 0, each = null) => {
  const outs = [];
  for (let i = 0; i < n; i++) { each?.(i, m); outs.push({ ...feel.update(1 / 60, m, yaw), eye: [...feel.out.eye] }); m.climbEvents = []; }
  return outs;
};

test('CLIMB4 F1: the motor tells the frame its climb - a hold taken and let go, a move begun (its kind, time, rise, the speed it came at), a corner\'s turn, a leap\'s launch, the grip failing', () => {
  const w = world();
  w.box(-3, 0, 1, 3, 2.3, 4);
  const m = climber(w.col);
  m.spawn(0, 0.02, 0.4);
  const seen = [];
  for (let i = 0; i < 120; i++) { m.update(1 / 60, { ...blank, jump: i > 5 && i < 40 }, 0); for (const e of m.climbEvents) seen.push(e); }
  const move = seen.find((e) => e.type === 'move');
  assert.ok(move && move.kind === 'catch' && move.speed >= 0 && Number.isFinite(move.dur) && move.normal, 'a catch: its kind, its time, the speed it came at, the wall');
  assert.ok(seen.some((e) => e.type === 'hold' && e.mode === 'hang'), 'the hold it ends in');
  // the frame's events are the frame's: cleared at the next update
  m.update(1 / 60, blank, 0);
  assert.deepEqual(m.climbEvents, [], 'cleared each update');
  // Crouch lets go: the release
  m.update(1 / 60, { ...blank, crouch: true }, 0);
  m.update(1 / 60, blank, 0);
  assert.ok(seen.concat(m.climbEvents).some((e) => e.type === 'release') || !m.onWall, 'let go');
});

test('CLIMB4 F2: a catch dips the eye and pitches the view down, harder the faster the body came to the lip, and springs back; nothing on the wall, nothing at all', () => {
  const dip = (speed) => {
    const feel = new ClimbFeel();
    const m = fake({ onWall: true, hanging: true, wallNormal: [0, 0, -1], climbMove: { t: 0 } });
    m.climbEvents = [{ type: 'move', kind: 'catch', dur: 0.15, rise: 0.3, speed, way: [0, 0], normal: [0, 0, -1] }];
    const outs = frames(feel, m, 90, 0, (i, mm) => { if (i > 9) mm.climbMove = null; });
    return { low: Math.min(...outs.map((o) => o.eye[1])), pitch: Math.min(...outs.map((o) => o.pitch)), end: outs[outs.length - 1] };
  };
  const soft = dip(0), hard = dip(10);
  assert.ok(soft.low < -0.005, `a catch from a standstill dips the eye (${soft.low.toFixed(3)} m)`);
  assert.ok(hard.low < soft.low * 1.5, `a fall caught at 10 m/s dips it harder (${hard.low.toFixed(3)} m)`);
  assert.ok(hard.pitch < 0, 'and pitches the view down');
  assert.ok(Math.abs(hard.end.eye[1]) < 0.01 && Math.abs(hard.end.pitch) < 0.01, 'sprung back within a second and a half');
  const rest = frames(new ClimbFeel(), fake(), 30);
  assert.ok(rest.every((o) => o.pitch === 0 && o.roll === 0 && o.eye[1] === 0 && o.fov === 0 && o.yaw === 0), 'off the wall with nothing in flight: nothing');
});

test('CLIMB4 F3: on the wall - hanging sways a little, the shimmy rolls toward its way with each hand, the free climb bobs hand over hand, the hands taking turns; a failing grip trembles', () => {
  // hanging still: a slow sway, small
  const sway = frames(new ClimbFeel(), fake({ onWall: true, hanging: true, wallNormal: [0, 0, -1] }), 600);
  const rolls = sway.map((o) => o.roll);
  assert.ok(Math.max(...rolls) > 0.1 * DEG && Math.min(...rolls) < -0.1 * DEG && Math.max(...rolls.map(Math.abs)) <= FEEL.SWAY_ROLL_DEG * DEG * 1.05, 'a sway both ways, under its bound');
  // the shimmy (the wall's normal -z: facing it, the hands' right is +x - motor.js _wallStep's `along`): the roll leans
  // the way the hands go
  for (const [dx, sign] of [[0.02, 1], [-0.02, -1]]) {
    const sh = fake({ onWall: true, hanging: true, wallNormal: [0, 0, -1] });
    const shim = frames(new ClimbFeel(), sh, 60, 0, (i, mm) => { mm.pos = [dx * i, 0, 0]; });
    const peak = shim.reduce((a, o) => (Math.abs(o.roll) > Math.abs(a) ? o.roll : a), 0);
    assert.ok(Math.sign(peak) === sign && Math.abs(peak) > 0.5 * DEG, `the shimmy ${sign > 0 ? 'right' : 'left'} rolls that way (${(peak / DEG).toFixed(2)} degrees)`);
    assert.ok(shim.some((o) => o.eye[1] > 0.004), 'and lifts a little with each reach');
  }
  // the free climb: one reach every FEEL.REACH, the eye bobbing, the roll swapping sides each reach
  const fc = fake({ onWall: true, hanging: false, wallNormal: [0, 0, -1] });
  const climb = frames(new ClimbFeel(), fc, 240, 0, (i, mm) => { mm.pos = [0, 0.01 * i, 0]; });
  const ys = climb.map((o) => o.eye[1]);
  assert.ok(Math.max(...ys) > FEEL.CLIMB_BOB * 0.5 && Math.min(...ys) < -FEEL.CLIMB_BOB * 0.5, 'hand over hand: the eye bobs up and down');
  const rollSigns = climb.slice(30).map((o) => Math.sign(o.roll));
  assert.ok(rollSigns.includes(1) && rollSigns.includes(-1), 'the roll swaps from one hand to the other');
  // the grip failing: a tremble that grows as it runs out
  const shake = (grip) => {
    const outs = frames(new ClimbFeel(), fake({ onWall: true, hanging: true, wallNormal: [0, 0, -1], grip }), 300);
    let tv = 0;
    for (let i = 101; i < outs.length; i++) tv += Math.abs(outs[i].roll - outs[i - 1].roll);
    return tv;
  };
  assert.ok(shake(PARKOUR_GRIP_LOW * 0.2) > shake(1) * 3, 'a failing grip trembles far more than a fresh one sways');
  assert.ok(Math.abs(tremble(1.234)) <= 1, 'the tremble is bounded');
});

test('CLIMB4 F4: the moves - a pull-up looks up at the lip then down over it, a vault pitches down over the top, a lower looks down over the edge and turns the view to face the wall, a corner turns it with the wall', () => {
  const curve = (kind, extra = {}) => {
    const feel = new ClimbFeel();
    const m = fake({ climbMove: { t: 0 } });
    m.climbEvents = [{ type: 'move', kind, dur: 1, rise: 1.5, speed: 0, turn: 0, way: [0, 0], normal: null, ...extra }];
    let yaw = 0;
    const outs = frames(feel, m, 70, 0, (i, mm) => { mm.climbMove = i < 60 ? { t: i / 60 } : null; });
    for (const o of outs) yaw += o.yaw;
    return { outs, yaw };
  };
  const mantle = curve('mantle').outs.map((o) => o.pitch);
  assert.ok(Math.max(...mantle.slice(0, 25)) > 1 * DEG, 'the pull-up looks up at the lip first');
  assert.ok(Math.min(...mantle.slice(30, 60)) < -2 * DEG, 'then down over it as the body crests');
  assert.ok(Math.min(...curve('vault').outs.map((o) => o.pitch)) < -2 * DEG, 'a vault pitches down over the top');
  const lower = curve('lower', { normal: [0, 0, -1] });
  assert.ok(Math.min(...lower.outs.map((o) => o.pitch)) < -4 * DEG, 'a lower looks down over the edge');
  // facing +z (yaw 0) and lowering onto a wall whose normal is -z... the wall is at +z: already faced
  assert.ok(near(lower.yaw, 0, 1e-3), 'facing the wall already: no turn');
  const back = curve('lower', { normal: [0, 0, 1] });   // the wall at -z: the view turns half round to face it
  assert.ok(near(Math.abs(back.yaw), Math.PI, 0.02), `the view turned to face the wall (${(back.yaw / DEG).toFixed(1)} degrees)`);
  const corner = curve('corner', { turn: Math.PI / 2 });
  assert.ok(near(corner.yaw, Math.PI / 2, 0.02), `a corner turns the view with the wall (${(corner.yaw / DEG).toFixed(1)} degrees)`);
  assert.ok(near(bump(0.5, 0, 1), 1) && bump(0, 0, 1) === 0 && bump(1.2, 0, 1) === 0, 'the bump');
});

test('CLIMB4 F5: leaps - a launch kicks the field of view and the eject turns the view the way it flew; a side leap rolls toward its side', () => {
  const feel = new ClimbFeel();
  const m = fake();
  m.climbEvents = [{ type: 'launch', dir: [0, 0, -1], along: 4.5, up: 3.75 }];
  let yaw = 0;
  const outs = frames(feel, m, 90, 0);
  for (const o of outs) yaw += o.yaw;
  assert.ok(Math.max(...outs.map((o) => o.fov)) > 2, `the field of view kicked (${Math.max(...outs.map((o) => o.fov)).toFixed(1)} degrees)`);
  assert.ok(Math.abs(outs[outs.length - 1].fov) < 0.3, 'and settled');
  assert.ok(near(Math.abs(yaw), Math.PI, 0.02), `the view turned the way it flew (${(yaw / DEG).toFixed(1)} degrees)`);
  // a side leap to the hands' right (the wall's normal -z: +x) rolls right, to the left left
  for (const [wx, sign] of [[1.5, 1], [-1.5, -1]]) {
    const side = new ClimbFeel();
    const s = fake({ climbMove: { t: 0 } });
    s.climbEvents = [{ type: 'move', kind: 'leap', dur: 0.5, rise: 0, speed: 0, turn: 0, way: [wx, 0], normal: [0, 0, -1] }];
    const so = frames(side, s, 30, 0, (i, mm) => { mm.climbMove = { t: i / 30 }; });
    const peak = so.reduce((a, o) => (Math.abs(o.roll) > Math.abs(a) ? o.roll : a), 0);
    assert.ok(Math.sign(peak) === sign && Math.abs(peak) > 1 * DEG, `a leap ${sign > 0 ? 'right' : 'left'} rolls that way (${(peak / DEG).toFixed(2)})`);
  }
});

test('CLIMB4 F6: the view half - pitch up tilts the forward up, roll right lowers the right, the eye offset moves the camera and nothing else; zero effects leave the view untouched', () => {
  const v = lookAt([0, 1.7, 0], [0, 1.7, 1], [0, 1, 0]);
  const base = Float32Array.from(v);
  applyClimbView(v, { pitch: 0, roll: 0, eye: [0, 0, 0], fov: 0, yaw: 0 });
  assert.deepEqual([...v], [...base], 'no effect, no change');
  const fwd = (m) => [-m[2], -m[6], -m[10]];   // the camera's forward in the world: -(the view's third row)
  const right = (m) => [m[0], m[4], m[8]];
  const up = applyClimbView(Float32Array.from(base), { pitch: 10 * DEG, roll: 0, eye: [0, 0, 0] });
  assert.ok(fwd(up)[1] > 0.15, `pitch up tilts the forward up (${fwd(up)[1].toFixed(3)})`);
  const rr = applyClimbView(Float32Array.from(base), { pitch: 0, roll: 10 * DEG, eye: [0, 0, 0] });
  assert.ok(right(rr)[1] < -0.15, `roll right lowers the right (${right(rr)[1].toFixed(3)})`);
  const off = applyClimbView(Float32Array.from(base), { pitch: 0, roll: 0, eye: [0, -0.1, 0] });
  // the camera's position: -R^T t
  const pos = (m) => [-(m[0] * m[12] + m[1] * m[13] + m[2] * m[14]), -(m[4] * m[12] + m[5] * m[13] + m[6] * m[14]), -(m[8] * m[12] + m[9] * m[13] + m[10] * m[14])];
  assert.ok(near(pos(off)[1], 1.6, 1e-5) && near(pos(off)[0], 0) && near(pos(off)[2], 0), `the eye 10 cm down (${pos(off).map((x) => x.toFixed(3))})`);
  assert.deepEqual(fwd(off).map((x) => +x.toFixed(6)), fwd(base).map((x) => +x.toFixed(6)), 'and the look unchanged');
});

test('CLIMB4 F7: the look filter takes the climb\'s turn as owed look - paid out under its smoothing - and never as the frame\'s mouse look (the weapon widget does not sway to it)', () => {
  const f = new LookFilter();
  const cam = { yaw: 0, pitch: 0 };
  takeFrameLook();
  f.turn(1.0);
  assert.deepEqual(takeFrameLook(), [0, 0], 'not latched as the frame\'s look');
  for (let i = 0; i < 120; i++) f.tick(1 / 60, cam, { smoothing: 0.5 });
  assert.ok(near(cam.yaw, 1.0, 1e-3), `paid out (${cam.yaw.toFixed(4)})`);
});

test('CLIMB4 F8: every host that draws a first-person view frames the feel after its motor and lays its view half on the view - first person only - and the climb\'s kick and pitch on every lens of the frame', () => {
  const read = (f) => readFileSync(new URL(`../../src/scenes/${f}.js`, import.meta.url), 'utf8');
  const w = read('world');
  assert.match(w, /const climbFeel = createClimbFeelHost\(\(\) => player, cam, lookFilter[,)]/, 'world: one per body, the look filter its turn\'s');
  assert.ok(w.indexOf('climbFeel.frame(dt') > w.lastIndexOf('cam.pos = player.eyeAt();', w.indexOf('climbFeel.frame(dt')), 'world: framed after the eye');
  assert.match(w, /const view = betterAmbience\.view\(lookAt\(mwv\.eye[^\n]*\n\s*climbFeel\.view\(view, !tvf && !mwv\.thirdPerson\);/, 'world: the view half, first person, never the travel view');
  assert.match(w, /perspective\(fieldOfView\(\) \+ climbFeel\.fovRad\(\), worldAspect/, 'world: the kick on the lens');
  // PIN MOVED (SPYGLASS): the captain's glass narrows the world's lens past the kick - the sky and the far ring take the
  // same narrowed lens the world does (world.js glassFov), the kick still inside it
  assert.match(w, /sky\.draw\([^;]*cam\.pitch \+ climbFeel\.pitch\(\), glassFov\(fieldOfView\(\) \+ climbFeel\.fovRad\(\), spyglass\.lens\)/, 'world: the sky takes the pitch and the kick');
  assert.match(w, /fovY: glassFov\(fieldOfView\(\) \+ climbFeel\.fovRad\(\), spyglass\.lens\)/, 'world: so does the far ring');
  assert.match(w, /createWorldModes\(\{\n\s*climbFeel,/, 'world: the modal frames take the one handle');
  const wm = read('worldModes');
  assert.match(wm, /host\.climbFeel\?\.frame\(dt, overlayHeld\);/, 'worldModes: framed (PIN MOVED, AUDIT CLIMB-ARC F2: held while the motor is)');
  assert.ok(wm.indexOf('host.climbFeel?.frame(dt') > wm.indexOf('cam.pos = player.eyeAt();   // EV1: the interpolated render eye\n    // DC1'), 'worldModes: after its eye');
  assert.match(wm, /const view = betterAmbience\.view\(lookAt\(mwv\.eye[^\n]*\n\s*const aimView = view\.slice\(\);[^\n]*\n\s*host\.climbFeel\?\.view\(view, !decorTool\.flying\(\) && !mwv\.thirdPerson\);/, 'worldModes: the view half (PIN MOVED, AUDIT CLIMB-ARC F10: the aim kept before it), never the decorator\'s free camera');
  assert.match(wm, /perspective\(fieldOfView\(\) \+ \(host\.climbFeel\?\.fovRad\(\) \?\? 0\)/, 'worldModes: the kick');
  const ex = read('exterior');
  assert.match(ex, /const climbFeel = createClimbFeelHost\(\(\) => player, cam, lookFilter[,)]/);
  assert.match(ex, /climbFeel\.view\(view, walkMode && !riding && !mwv\.thirdPerson\);/, 'exterior: first person, never the ride view');
  assert.match(ex, /fieldOfView\(\) \+ climbFeel\.fovRad\(\),/);
  assert.match(ex, /sky\.draw\(Math\.atan2\(dx, dz\), Math\.atan2\(dy, horiz\) \+ climbFeel\.pitch\(\), fieldOfView\(\) \+ climbFeel\.fovRad\(\)/);
  const dg = read('dungeon');
  assert.match(dg, /const climbFeel = createClimbFeelHost\(\(\) => player, cam, lookFilter[,)]/);
  assert.match(dg, /climbFeel\.view\(view, walkMode && !mwv\.thirdPerson\);/, 'dungeon: first person, never the fly-cam');
  assert.match(dg, /perspective\(fieldOfView\(\) \+ climbFeel\.fovRad\(\)/);
  for (const [f, s] of [['world', w], ['exterior', ex], ['dungeon', dg]]) {
    assert.ok(s.indexOf('climbFeel.frame(dt') > s.lastIndexOf('cam.pos = player.eyeAt();', s.indexOf('climbFeel.frame(dt')), `${f}: framed after the eye`);
  }
});

// ---- THE SOUNDS ----------------------------------------------------------------------------------------------------

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), '..');
/** A WAV's header, read as DAGGER.SND's bake writes it. */
function wavHeader(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o) => String.fromCharCode(...bytes.subarray(o, o + 4));
  return { riff: tag(0), wave: tag(8), fmt: tag(12), format: dv.getUint16(20, true), channels: dv.getUint16(22, true), rate: dv.getUint32(24, true), bits: dv.getUint16(34, true), data: tag(36), dataLen: dv.getUint32(40, true) };
}
/** The bus as a pin hears it: every one-shot, [key, volume, pitch]. */
function bus() {
  const shots = [];
  return { shots, playOneShot: (k, v = 1, p = 1) => { shots.push([k, v, p]); } };
}
/** A dice that answers `v` (0: every chance taken, a key's first pick; 0.99: none). */
const dice = (v) => () => v;
/** The law on a pin's bus: on, no loading, its dice and its effort voice set by the test. */
function ear({ rand = dice(0.5), strain = null, on = () => true } = {}) {
  const audio = bus();
  return { audio, law: new ClimbSounds({ audio, rand, strain, on, install: false }) };
}
const kind = (k) => (k ? String(k).replace(/^climb:/, '').replace(/-\d$/, '') : k);
const heard = (audio) => audio.shots.map(([k]) => (typeof k === 'number' ? `voice:${k}` : kind(k)));
const step = (law, m, ev = [], dt = 1 / 60) => { m.climbEvents = ev; law.update(dt, m); m.climbEvents = []; };

test('CLIMB4 F9: the eleven clips - one file a key, each shipped as DAGGER.SND\'s own (PCM, mono, 8-bit, 11025 Hz), whole, on the provenance page, and baked deterministically: tools/climbSfx.mjs writes the shipped bytes (mutants: a key without a file, an unseeded noise)', () => {
  const keys = Object.values(CLIMB_SFX).flat();
  assert.equal(keys.length, 11, 'eleven clips');
  assert.deepEqual(Object.keys(CLIMB_SFX_FILES).sort(), keys.slice().sort(), 'a file for every key');
  assert.equal(new Set(Object.values(CLIMB_SFX_FILES)).size, keys.length, 'one file a key');
  const sources = readFileSync(join(ROOT, 'public/sfx/SOURCES.md'), 'utf8');
  for (const file of Object.values(CLIMB_SFX_FILES)) {
    const bytes = readFileSync(join(ROOT, 'public/sfx', file));
    const h = wavHeader(bytes);
    assert.deepEqual([h.riff, h.wave, h.fmt, h.data], ['RIFF', 'WAVE', 'fmt ', 'data'], file);
    assert.deepEqual([h.format, h.channels, h.rate, h.bits], [1, 1, 11025, 8], `${file}: DAGGER.SND's format`);
    assert.equal(h.dataLen, bytes.length - 44, `${file}: whole`);
    assert.ok(h.dataLen > 11025 * 0.05, `${file}: a sound, not a click`);
    assert.ok(sources.includes(`\`${file}\``), `${file}: its provenance row`);
  }
  const dir = mkdtempSync(join(tmpdir(), 'climbsfx-'));
  try {
    execFileSync(process.execPath, [join(ROOT, 'tools/climbSfx.mjs')], { cwd: dir, stdio: 'pipe' });
    for (const f of Object.values(CLIMB_SFX_FILES)) {
      assert.ok(readFileSync(join(dir, 'public/sfx', f)).equals(readFileSync(join(ROOT, 'public/sfx', f))), `${f}: the bake's bytes`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLIMB4 F10: the clips register on the bus once - under their keys, a clip that will not load is silence and the rest still take, and a bus with no door loads nothing', async () => {
  _resetClimbSounds();
  const regs = [];
  const audio = { registerSound: async (k) => { regs.push(k); return k !== 'climb:pull'; } };
  const fetchBytes = async (file) => { if (file === 'climb-whoosh.wav') throw new Error('404'); return new Uint8Array(8); };
  assert.equal(await installClimbSounds(audio, { fetchBytes }), 9, 'nine took: one the decoder refused, one never came');
  assert.equal(regs.length, 10, 'each key offered once (the one that never came, never)');
  assert.ok(regs.every((k) => k in CLIMB_SFX_FILES));
  assert.equal(await installClimbSounds(audio, { fetchBytes }), 9, 'once: the second call answers the first');
  assert.equal(regs.length, 10, '...and offers nothing again');
  _resetClimbSounds();
  assert.equal(await installClimbSounds({}, { fetchBytes }), 0, 'no registerSound, no load');
  _resetClimbSounds();
});

test('CLIMB4 F11: a catch - both hands and the body, louder the faster it came (to its most); a hard one (a fall caught) wrings the player\'s effort, spent with its lift, a soft one never - and never two within STRAIN_GAP_S (mutants: the speed ignored, the gap dropped)', () => {
  const C = CLIMB_SOUND;
  for (const [speed, vol] of [[0, C.CATCH_BASE], [4, C.CATCH_BASE + 4 * C.CATCH_PER_SPEED], [30, C.CATCH_MAX]]) {
    const { audio, law } = ear();
    step(law, fake({ climbMove: { t: 0 } }), [{ type: 'move', kind: 'catch', speed, split: 1, dur: 0.15 }]);
    assert.equal(audio.shots.length, 1, `speed ${speed}: one sound`);
    const [k, v, p] = audio.shots[0];
    assert.equal(k, 'climb:catch');
    assert.ok(near(v, vol, 1e-9), `speed ${speed}: volume ${v} (want ${vol})`);
    assert.ok(Math.abs(p - 1) <= C.PITCH_JITTER + 1e-9, 'its pitch moved no more than the jitter');
  }
  const voices = [];
  const strain = (rolls) => { voices.push(rolls); return { clip: 77, pitchLift: 0.2 }; };
  const { audio, law } = ear({ rand: dice(0), strain });
  const m = fake({ climbMove: { t: 0 } });
  step(law, m, [{ type: 'move', kind: 'catch', speed: 3, split: 1 }]);
  assert.deepEqual(heard(audio), ['catch'], 'a soft catch: no effort');
  step(law, m, [{ type: 'move', kind: 'catch', speed: 8, split: 1 }]);
  assert.deepEqual(heard(audio), ['catch', 'catch', 'voice:77'], 'a hard one: the effort');
  assert.deepEqual(audio.shots[2].slice(1), [C.STRAIN, 1.2], 'at the effort\'s volume, its lift spent (AUDIT 58)');
  step(law, m, [{ type: 'move', kind: 'catch', speed: 8, split: 1 }]);
  assert.equal(heard(audio).filter((h) => h.startsWith('voice')).length, 1, 'never two within the gap');
  for (let i = 0; i < Math.ceil(C.STRAIN_GAP_S * 20); i++) step(law, m, [], 1 / 20);
  step(law, m, [{ type: 'move', kind: 'catch', speed: 8, split: 1 }]);
  assert.equal(heard(audio).filter((h) => h.startsWith('voice')).length, 2, 'and again once the gap has passed');
  // a chance, not a certainty - and a failing grip raises it (a hard catch's 0.5 doubled toward 0.9 at no grip)
  const roll = (die, grip) => {
    const e = ear({ rand: dice(die), strain: () => ({ clip: 5, pitchLift: 0 }) });
    step(e.law, fake({ climbMove: { t: 0 }, grip }), [{ type: 'move', kind: 'catch', speed: 8, split: 1 }]);
    return heard(e.audio).includes('voice:5');
  };
  assert.equal(roll(0.99, 1), false, 'a high die: no grunt');
  assert.equal(roll(0.6, 1), false, 'a fresh grip: 0.6 misses a 0.5 chance');
  assert.equal(roll(0.6, 0), true, '...and a spent grip\'s 0.9 takes it');
});

test('CLIMB4 F12: hand over hand - a hand at every reach the camera rolls with, a boot half a reach after, never the same clip twice running; the shimmy a hand per span along the lip and none for the body going up or down; a teleport is no travel (mutants: the reach, the boots, the repeat)', () => {
  const C = CLIMB_SOUND;
  {
    const { audio, law } = ear({ rand: dice(0) });
    const m = fake({ onWall: true, hanging: false, wallNormal: [0, 0, -1], pos: [0, 1, 0] });
    step(law, m);
    for (let i = 0; i < 200; i++) { m.pos = [0, 1 + 0.01 * (i + 1), 0]; step(law, m); }   // 2.0 m up
    const hands = audio.shots.filter(([, v]) => v === C.STEP), feet = audio.shots.filter(([, v]) => v === C.FOOT);
    assert.equal(hands.length, Math.floor(2.0 / FEEL.REACH + 1e-9), `a hand every ${FEEL.REACH} m: ${hands.length}`);
    assert.equal(feet.length, Math.floor(2.0 / FEEL.REACH - 0.5 + 1e-9) + 1, 'a boot half a reach after each');
    assert.ok(feet.every(([, , p]) => Math.abs(p - C.FOOT_PITCH) <= C.FOOT_PITCH * C.PITCH_JITTER + 1e-9), 'the boots lower');
    assert.ok(audio.shots.every(([k]) => CLIMB_SFX.step.includes(k)), 'the step clips');
    for (let i = 1; i < audio.shots.length; i++) assert.notEqual(audio.shots[i][0], audio.shots[i - 1][0], 'never the clip just heard');
    const n = audio.shots.length;
    m.pos = [0, 9, 0]; step(law, m);
    assert.equal(audio.shots.length, n, 'a teleport: no travel, no hands');
  }
  {
    const { audio, law } = ear();
    const m = fake({ onWall: true, hanging: true, wallNormal: [0, 0, -1], pos: [0, 2, 0] });
    step(law, m);
    for (let i = 0; i < 100; i++) { m.pos = [0.01 * (i + 1), 2, 0]; step(law, m); }   // 1.0 m along
    assert.equal(audio.shots.length, Math.floor(1.0 / FEEL.SHIMMY_SPAN + 1e-9), 'a hand every span along the lip');
    assert.ok(audio.shots.every(([, v, p]) => v === C.SHIMMY && Math.abs(p - C.SHIMMY_PITCH) <= C.SHIMMY_PITCH * C.PITCH_JITTER + 1e-9));
    const n = audio.shots.length;
    for (let i = 0; i < 100; i++) { m.pos = [1, 2 + 0.01 * (i + 1), 0]; step(law, m); }
    assert.equal(audio.shots.length, n, 'hanging, up and down is no shimmy');
  }
});

test('CLIMB4 F13: every move sounds on its own clock - a pull-up\'s haul (the hands already on the lip from a hang, onto it from the ground) and the boots over the sill at its split, a step-up a hand and a scuff, the vault, the lower, the corner, the wall run; a leap\'s push and rush at the launch and its grab only at its arrival, with no second grab for the hold; a move chained on pays what the last still owed (mutants: the cues all at once, the arrival\'s double grab)', () => {
  const C = CLIMB_SOUND;
  // a pull-up from a hang, on its clock
  {
    const { audio, law } = ear({ rand: dice(0), strain: () => ({ clip: 5, pitchLift: 0 }) });
    const m = fake({ climbMove: { t: 0 } });
    step(law, m, [{ type: 'release', mode: 'hang' }, { type: 'move', kind: 'mantle', rise: 1.5, split: 0.6, dur: 0.8 }]);
    assert.deepEqual(heard(audio), [], 'from a hang the hands hold the lip already - nothing at t 0, and no let-go');
    m.climbMove.t = 0.3; step(law, m);
    assert.deepEqual(heard(audio), ['pull', 'voice:5'], 'the haul, and its effort');
    assert.equal(audio.shots[0][1], C.PULL, 'the whole haul');
    m.climbMove.t = 0.59; step(law, m);
    assert.equal(audio.shots.length, 2, 'the sill not yet');
    m.climbMove.t = 0.61; step(law, m);
    assert.deepEqual(heard(audio), ['pull', 'voice:5', 'scrape'], 'the boots over the sill at the split');
    m.climbMove = null; step(law, m);
    assert.equal(audio.shots.length, 3, 'onto the top: the stride\'s step is the stride\'s');
  }
  const play = (ev, ts, { arrive = null } = {}) => {
    const { audio, law } = ear({ rand: dice(0) });
    const m = fake({ climbMove: { t: 0 } });
    step(law, m, ev);
    for (const t of ts) { m.climbMove.t = t; step(law, m); }
    m.climbMove = null;
    step(law, m, arrive ? [arrive] : []);
    return audio;
  };
  assert.deepEqual(heard(play([{ type: 'move', kind: 'mantle', rise: 1.5, split: 0.6 }], [0.3, 0.7])), ['grab', 'pull', 'scrape'], 'from the ground the hands go onto the lip first');
  assert.deepEqual(heard(play([{ type: 'move', kind: 'mantle', rise: 0.5, split: 0.5 }], [0.3, 0.7])), ['grab', 'scrape'], 'a step-up: a hand and a scuff, no haul');
  const vault = play([{ type: 'move', kind: 'vault', rise: 0.9, split: 0.4 }], [0.2, 0.3, 0.5]);
  assert.deepEqual(heard(vault), ['grab', 'whoosh'], 'the vault: a hand on the top, the body over it');
  assert.deepEqual(heard(play([{ type: 'move', kind: 'lower', rise: -1.5, split: 0.4 }], [0.1, 0.5, 0.95])), ['scrape', 'grab', 'step'], 'the lower: over the edge, the hands take it, the boots meet the wall');
  assert.deepEqual(heard(play([{ type: 'move', kind: 'corner', split: 0.5 }], [0.3, 0.8])), ['step', 'step'], 'a corner: two hands round it');
  assert.deepEqual(heard(play([{ type: 'move', kind: 'wallrun', rise: 1.5, split: 0.5 }], [0.2, 0.4, 0.6], { arrive: { type: 'hold', mode: 'hang' } })),
    ['whoosh', 'step', 'step', 'step', 'grab'], 'the wall run: boots up the wall, the hands at the top');
  // a leap: the push and the rush at once, the grab only at the arrival - and only the one
  {
    const { audio, law } = ear({ rand: dice(0.99) });
    const m = fake({ climbMove: { t: 0 } });
    step(law, m, [{ type: 'release', mode: 'hang' }, { type: 'move', kind: 'leap', rise: 0.2, split: 0.3 }]);
    assert.deepEqual(heard(audio), ['step'], 'the push');
    m.climbMove.t = 0.5; step(law, m);
    assert.deepEqual(heard(audio), ['step', 'whoosh'], 'the rush');
    m.climbMove.t = 0.97; step(law, m);
    assert.equal(audio.shots.length, 2, 'no grab in the air');
    m.climbMove = null; step(law, m, [{ type: 'hold', mode: 'hang' }]);
    assert.deepEqual(heard(audio), ['step', 'whoosh', 'grab'], 'the hands take the far hold - once');
    assert.equal(audio.shots[2][1], C.GRAB * 1.2);
  }
  // a hold with no move (the free climb begun from the ground) is a hand on the wall
  {
    const { audio, law } = ear();
    step(law, fake({ onWall: true }), [{ type: 'hold', mode: 'climb' }]);
    assert.deepEqual(heard(audio), ['grab']);
  }
  // a move chained on: the last one's owed cues first
  {
    const { audio, law } = ear();
    const m = fake({ climbMove: { t: 0 } });
    step(law, m, [{ type: 'move', kind: 'mantle', rise: 1.1, split: 0.8 }]);
    m.climbMove.t = 0.5; step(law, m);
    m.climbMove = { t: 0 };
    step(law, m, [{ type: 'move', kind: 'lower', rise: -1.4, split: 0.4 }]);
    assert.deepEqual(heard(audio), ['grab', 'pull', 'scrape', 'scrape'], 'the parapet\'s sill, then over the edge');
  }
  // the cue table itself: sorted, every time within the move
  for (const k of ['catch', 'mantle', 'vault', 'lower', 'corner', 'leap', 'wallrun']) {
    const cues = moveCues({ kind: k, rise: 1.5, split: 0.5, speed: 6 }, null);
    assert.ok(cues.length > 0 && cues.every(([t], i) => t >= 0 && t <= 1 && (i === 0 || t >= cues[i - 1][0])), `${k}: cues in order, within the move`);
  }
});

test('CLIMB4 F13b: the motor tells every move it makes - the release says the hold it let go (hang or climb), a move its split, and a move chained on (over a parapet, down into the hang) is told as its own, so the camera looks down over the edge and does not look up a second sill', () => {
  // the tower and the climb over its parapet (CLIMB-DOWN T7's)
  const col = new Collider(() => 0);
  let n = 0;
  const box = (...b) => col.addMesh(`b${n++}`, new Float32Array([b[0], b[1], b[2], b[3], b[1], b[2], b[3], b[4], b[2], b[0], b[4], b[2], b[0], b[1], b[5], b[3], b[1], b[5], b[3], b[4], b[5], b[0], b[4], b[5]]), BOX_IDX, I);
  const H = 8, ph = 1.0, pw = 0.25;
  box(-3, 0, -3, 3, H, 3);
  box(-3, H, -3, 3, H + ph, -3 + pw); box(-3, H, 3 - pw, 3, H + ph, 3); box(-3, H, -3, -3 + pw, H + ph, 3); box(3 - pw, H, -3, 3, H + ph, 3);
  const m = climber(col);
  m.spawn(0, 8.02, 0);
  const feel = new ClimbFeel();
  const seen = [];
  let lowerPitch = 0, inLower = false;
  for (let i = 0; i < 300; i++) {
    m.update(1 / 60, { ...blank, forward: m.pos[2] > -2.25 && !m._pkMove && !m._wall ? 1 : 0, jump: m.pos[2] <= -2.25 && !m._pkMove && !m._wall }, Math.PI);
    for (const e of m.climbEvents) seen.push(e);
    const fx = feel.update(1 / 60, m, Math.PI);
    if (m._pkMove?.kind === 'lower') { inLower = true; lowerPitch = Math.min(lowerPitch, fx.pitch); }
    if (inLower && m.hanging) break;
  }
  const moves = seen.filter((e) => e.type === 'move');
  assert.deepEqual(moves.map((e) => e.kind).slice(0, 2), ['mantle', 'lower'], 'the chained lower told as its own move');
  assert.ok(moves.every((e) => Number.isFinite(e.split) && e.split >= 0 && e.split <= 1), 'each with its split');
  assert.ok(lowerPitch < -2 * DEG, `the lower looks down over the edge (${(lowerPitch / DEG).toFixed(1)} deg)`);
  assert.ok(m.hanging, 'into the hang');
  // Crouch lets the hang go: the release says it was a hang
  const rel = [];
  for (let i = 0; i < 5 && m.onWall; i++) { m.update(1 / 60, { ...blank, crouch: true }, Math.PI); rel.push(...m.climbEvents); }
  assert.ok(rel.some((e) => e.type === 'release' && e.mode === 'hang'), 'the release names the hold let go');
});

test('CLIMB4 F14: the grip failing - grit coming away, and again every few seconds while it holds on the wall, none off it; the grip gone - the boots scrabbling, the stone giving, the effort; a let-go the hands leaving the stone; a release into a move nothing of its own (mutants: the trickle\'s clock, the slip\'s cry)', () => {
  const C = CLIMB_SOUND;
  {
    const { audio, law } = ear();
    const m = fake({ onWall: true, hanging: true, grip: PARKOUR_GRIP_LOW - 0.05, wallNormal: [0, 0, -1] });
    step(law, m, [{ type: 'gripLow' }]);
    assert.deepEqual(audio.shots.map(([k, v]) => [k, v]), [['climb:crumble', C.CRUMBLE]], 'the grit coming away');
    for (let i = 0; i < 600; i++) step(law, m);   // ten seconds held
    const trickles = audio.shots.slice(1);
    assert.ok(trickles.length >= Math.floor(10 / C.TRICKLE_MAX_S) && trickles.length <= Math.ceil(10 / C.TRICKLE_MIN_S), `again every ${C.TRICKLE_MIN_S}-${C.TRICKLE_MAX_S} s: ${trickles.length} in ten`);
    assert.ok(trickles.every(([k, v]) => k === 'climb:crumble' && v === C.TRICKLE));
    const k = audio.shots.length;
    m.onWall = false; m.hanging = false;
    for (let i = 0; i < 600; i++) step(law, m);
    assert.equal(audio.shots.length, k, 'off the wall, none');
  }
  {
    const { audio, law } = ear({ rand: dice(0), strain: () => ({ clip: 9, pitchLift: 0.1 }) });
    step(law, fake({ grip: 0 }), [{ type: 'release', mode: 'hang' }]);
    assert.deepEqual(heard(audio), ['scrape', 'crumble', 'voice:9'], 'the grip gone');
    assert.equal(audio.shots[0][1], C.SLIP);
  }
  {
    const { audio, law } = ear({ rand: dice(0), strain: () => ({ clip: 9, pitchLift: 0 }) });
    step(law, fake({ grip: 0.6 }), [{ type: 'release', mode: 'hang' }]);
    assert.deepEqual(audio.shots.map(([k, v]) => [kind(k), v]), [['step', C.LET_GO]], 'let go: the hands leaving the stone, no cry');
  }
  {
    const { audio, law } = ear();
    step(law, fake({ grip: 0.6, climbMove: { t: 0 } }), [{ type: 'release', mode: 'hang' }, { type: 'move', kind: 'corner', split: 0.5 }]);
    assert.deepEqual(heard(audio), [], 'a release into a move: the move\'s sounds alone');
  }
  // the launch (the eject, the running leap): the push, the rush, the effort
  {
    const { audio, law } = ear({ rand: dice(0), strain: () => ({ clip: 3, pitchLift: 0 }) });
    step(law, fake(), [{ type: 'launch', dir: [0, 0, 1], along: 4, up: 3 }]);
    assert.deepEqual(heard(audio), ['step', 'whoosh', 'voice:3']);
  }
});

test('CLIMB4 F15: the port\'s own sounds\' switch (ES1) is over all of it, the clips load the first frame it is on, every host sounds its climb through the feel\'s handle with the player\'s effort voice, and the voice rides the attack grunt\'s gates (mutants: the switch ignored, a host unwired)', async () => {
  // off: nothing at all, whatever the motor says
  {
    const { audio, law } = ear({ on: () => false, rand: dice(0), strain: () => ({ clip: 1, pitchLift: 0 }) });
    const m = fake({ onWall: true, climbMove: { t: 0 }, grip: 0 });
    step(law, m, [{ type: 'move', kind: 'catch', speed: 9 }, { type: 'launch' }, { type: 'gripLow' }, { type: 'release', mode: 'hang' }]);
    for (let i = 0; i < 60; i++) { m.pos = [0, 0.02 * i, 0]; step(law, m); }
    assert.deepEqual(audio.shots, [], 'silent');
  }
  assert.equal(new ClimbSounds().on, enhancedSoundsOn, 'the switch is the port\'s own sounds\'');
  // the first frame on loads the clips, once - and off, never
  const realFetch = globalThis.fetch;
  const urls = [], regs = [];
  try {
    globalThis.fetch = async (url) => { urls.push(String(url)); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
    const audio = { playOneShot() {}, registerSound: async (k) => { regs.push(k); return true; } };
    _resetClimbSounds();
    const off = new ClimbSounds({ audio, on: () => false });
    off.update(1 / 60, fake());
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(urls.length, 0, 'off: nothing loaded');
    const law = new ClimbSounds({ audio, on: () => true });
    law.update(1 / 60, fake());
    law.update(1 / 60, fake());
    for (let i = 0; i < 50 && regs.length < 11; i++) await new Promise((r) => setTimeout(r, 0));
    assert.equal(urls.length, 11, 'the frame itself loaded them - no other call asked');
    assert.equal(await installClimbSounds(audio), 11, 'on: the eleven');
    assert.equal(urls.length, 11, '...fetched once each');
    assert.ok(urls.every((u) => /\/sfx\/climb-[a-z]+(-\d)?\.wav$/.test(u)), 'from public/sfx');
    assert.deepEqual(regs.slice().sort(), Object.keys(CLIMB_SFX_FILES).sort(), '...registered under their keys');
  } finally { globalThis.fetch = realFetch; _resetClimbSounds(); }
  // the handle frames the sounds with the camera
  {
    const a = bus();
    const host = createClimbFeelHost(() => ({ ...fake({ climbMove: { t: 0 } }), climbEvents: [{ type: 'move', kind: 'catch', speed: 2 }] }), { yaw: 0 }, null, { audio: a });
    host.sounds.on = () => true; host.sounds.install = false;
    host.frame(1 / 60);
    assert.deepEqual(heard(a), ['catch'], 'framed with the eye');
    assert.equal(createClimbFeelHost(() => null, { yaw: 0 }, null).sounds, null, 'no bus, no sounds');
  }
  const read = (f) => readFileSync(new URL(`../../src/scenes/${f}.js`, import.meta.url), 'utf8');
  for (const f of ['world', 'exterior', 'dungeon']) {
    assert.match(read(f), /const climbFeel = createClimbFeelHost\(\(\) => player, cam, lookFilter, \{ audio, strain: \(r\) => playerClimbStrain\(playerEntity, r\) \}\);/, `${f}: its climb sounded, the player's effort its voice`);
  }
  // the voice: the attack grunt's own clip, under its gates - and none without a body
  const breton = { race: 'Breton', gender: 'male', maxHealth: 40 };
  const v = playerClimbStrain(breton, dice(0));
  assert.ok(v && v.clip >= 0 && v.pitchLift >= 0, 'a Breton\'s effort');
  assert.equal(v.clip, playerAttackGrunt(breton, false, dice(0))?.clip, 'the attack grunt\'s clip');
  assert.equal(playerClimbStrain({ ...breton, activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true }] }, dice(0)), null, 'a transformed lycanthrope is silent');
  assert.equal(playerClimbStrain(null, dice(0)), null);
  const was = getBool('Enhancements', 'CombatVoices');
  try {
    setValue('Enhancements', 'CombatVoices', false);
    assert.equal(playerClimbStrain(breton, dice(0)), null, 'the CombatVoices switch off: silent');
  } finally { setValue('Enhancements', 'CombatVoices', was); }
});

// ---- THE HANDS ON THE WALL -----------------------------------------------------------------------------------------

/** WEAPON09.CIF: one WeaponAnim record, 7 frames of 100x80 (ARROW2's synthetic bow). */
function bowCif() {
  const W = 100, H = 80, head = 12 + 31 * 2 + 2;
  const runs = Math.ceil((W * H) / 128);
  const b = new Uint8Array(head + runs * 2);
  const v = new DataView(b.buffer);
  v.setUint16(0, W, true); v.setUint16(2, H, true);
  for (let f = 0; f < 7; f++) v.setUint16(12 + f * 2, head, true);
  for (let k = 0; k < runs; k++) b[head + k * 2] = 255;
  v.setUint16(12 + 62, b.length, true);
  return b;
}

test('CLIMB4 F16: the hands on the wall - WeaponManager\'s climbing return (no swing, no weapon) for the enhanced climb\'s hold and moves as for the classic climb, the picture easing down out of the screen and back up after; the torch, the shield and the dungeon\'s bag read the hold as a climb (mutants: the hold not a climb, the cut, the swing on the wall)', async () => {
  // the law: down quick, up slower, home exactly
  let x = 0;
  for (let i = 0; i < 6; i++) x = climbLowerStep(x, true, 1 / 60);
  assert.ok(x > 0.6 && x < 1, `a tenth of a second in, mostly down (${x.toFixed(2)})`);
  for (let i = 0; i < 30; i++) x = climbLowerStep(x, true, 1 / 60);
  assert.equal(x, 1, 'and gone - snapped home');
  let up = x, down = 0;
  for (let i = 0; i < 6; i++) { up = climbLowerStep(up, false, 1 / 60); down = climbLowerStep(down, true, 1 / 60); }
  assert.ok(1 - up < down, 'it comes back slower than it went');
  assert.ok(CLIMB_LOWER_TAU.up > CLIMB_LOWER_TAU.down);
  assert.equal(climbLowerStep(0, false, 1 / 60), 0, 'never climbing, never lowered');
  assert.equal(climbDrop(0, 600), 0, 'unlowered: DFU\'s rect');
  assert.equal(climbDrop(1, 600), 600, 'lowered: the whole screen down');
  for (let k = 1; k <= 10; k++) assert.ok(climbDrop(k / 10, 600) >= climbDrop((k - 1) / 10, 600), 'monotonic');
  assert.deepEqual(climbLowerRect({ x: 3, y: 0, w: 800, h: 600 }, 1), { x: 3, y: 600, w: 800, h: 600 }, 'the arms\' rect the same way');

  // the rig: a bow in the hand, the camera's climb flag the test's
  resetToDefaults(); _resetModSettings();
  setModSetting('weapon-widget', 'Enabled', false);
  const quads = [];
  const renderer = { uploadTexture: (_k, name) => name, drawScreenQuad: (tex, rect) => quads.push({ tex, rect }) };
  const canvas = { width: 320, height: 200, clientWidth: 320, clientHeight: 200 };
  const entity = {
    items: [{ name: 'Arrow', templateIndex: 131, stackCount: 20 }],
    equip: { slots: { [EQUIP_SLOTS.RightHand]: { name: 'Long Bow', templateIndex: 130, material: 0 } } },
    stats: { speed: 50 },
  };
  let climbing = false;
  const r = createWeaponRig({
    renderer, canvas, entity, audio: { playOneShot() {} }, palette: { get: () => ({ r: 0, g: 0, b: 0 }) },
    fetchBytes: async () => bowCif(), camera: () => ({ pos: [0, 1.7, 0], yaw: 0, pitch: 0, climbing, move: { grounded: !climbing } }),
  });
  r.toggleSheath();
  for (let i = 0; i < 90; i++) { r.frame(1 / 60); r.draw(); }
  await new Promise((res) => setTimeout(res, 0));
  for (let i = 0; i < 5; i++) { r.frame(1 / 60); r.draw(); }
  const frame = () => { const evs = r.frame(1 / 60); quads.length = 0; r.draw(); return { evs, q: quads.find((z) => typeof z.tex === 'string' && z.tex.startsWith('fpw:')) }; };
  const rest = frame().q;
  assert.ok(rest && rest.rect.y < canvas.height, 'the bow in the hand');
  climbing = true;
  const ys = [];
  for (let i = 0; i < 6; i++) { const { q } = frame(); ys.push(q ? q.rect.y : Infinity); }
  assert.ok(ys[0] > rest.rect.y && ys.every((y, i) => i === 0 || y >= ys[i - 1]), `eased down, not cut (${ys.map((y) => (Number.isFinite(y) ? y.toFixed(0) : 'gone')).join(' ')})`);
  for (let i = 0; i < 40; i++) frame();
  assert.equal(r.climbLower(), 1);
  assert.equal(frame().q, undefined, 'lowered: no weapon drawn');
  // no swing on the wall
  // (watched every frame: the climbing return empties a swing's events (AUDIT CLIMB-ARC F7), so the machine is the witness)
  r.attackInput(0, 0, true);
  const states = [];
  for (let i = 0; i < 60; i++) { frame(); states.push(r.playerWeapon.machine.state); }
  r.attackInput(0, 0, false);
  assert.deepEqual([...new Set(states)], ['Idle'], 'no swing while climbing');
  r.clickAttack();   // the touch button's door, too
  states.length = 0;
  for (let i = 0; i < 60; i++) { frame(); states.push(r.playerWeapon.machine.state); }
  assert.deepEqual([...new Set(states)], ['Idle'], 'no swing off the touch button either');
  // off the wall: back up, to exactly where it was
  climbing = false;
  for (let i = 0; i < 90; i++) frame();
  const back = frame().q;
  assert.ok(back && back.rect.y === rest.rect.y && r.climbLower() === 0, 'back in the hand, where DFU draws it');
  _resetModSettings(); resetToDefaults();

  // the hosts: a hold on the wall is a climb for the hands (the weapon, the torch, the shield), and the dungeon's bag says so
  const read = (f) => readFileSync(new URL(`../../src/scenes/${f}.js`, import.meta.url), 'utf8');
  for (const f of ['world', 'exterior', 'worldModes']) {
    assert.match(read(f), /camera: \(\) => \(\{ pos: player\.eyeAt\(\),[^\n]*climbing: !!\(player\.climb\?\.isClimbing \|\| player\.mantling \|\| player\.onWall\)/, `${f}: the hold is a climb`);
  }
  const w = world();
  w.box(-3, 0, 1, 3, 2.3, 4);
  const m = climber(w.col);
  m.spawn(0, 0.02, 0.4);
  for (let i = 0; i < 120 && !m.hanging; i++) m.update(1 / 60, { ...blank, jump: i > 5 && i < 40 }, 0);
  assert.ok(m.hanging && !m.mantling, 'hanging, no move in flight');
  assert.equal(motionBagOf(m).climbing, true, 'the motion bag says climbing on the wall');
});

test('CLIMB4 F17: the handle and the view half, whole - the turn the feel owes is paid into the look filter, the view half is first person\'s alone, the effort voice is handed on; the wall run looks UP the wall; and the view\'s roll spins about the look whatever the pitch (the mutation run\'s own findings)', () => {
  // the corner's turn, paid into the look filter by the handle
  let paid = 0;
  const m = fake({ climbMove: { t: 0 } });
  m.climbEvents = [{ type: 'move', kind: 'corner', dur: 0.5, rise: 0, speed: 0, turn: 0.8, way: [0, 0], normal: [0, 0, -1] }];
  const host = createClimbFeelHost(() => m, { yaw: 0 }, { turn: (y) => { paid += y; } });
  for (let i = 0; i < 90; i++) { m.climbMove = i < 30 ? { t: i / 30 } : null; host.frame(1 / 60); m.climbEvents = []; }
  assert.ok(Math.abs(paid - 0.8) < 0.01, `the corner's turn reached the view (${paid.toFixed(3)})`);
  // the view half: first person only - never the travel view, a ride, a free camera or third person
  const c = fake({ climbMove: { t: 0 } });
  c.climbEvents = [{ type: 'move', kind: 'catch', dur: 0.2, rise: 0, speed: 6, turn: 0, way: [0, 0], normal: [0, 0, -1] }];
  const h2 = createClimbFeelHost(() => c, { yaw: 0 }, null);
  for (let i = 0; i < 4; i++) { h2.frame(1 / 60); c.climbEvents = []; }
  assert.ok(Math.abs(h2.fx.pitch) > 1e-4, 'the catch pitched the view');
  const v = lookAt([0, 1.7, 0], [0, 1.7, 1], [0, 1, 0]);
  const before = Array.from(v);
  h2.view(v, false);
  assert.deepEqual(Array.from(v), before, 'not first person: the view untouched');
  assert.equal(h2.pitch(), 0, '...and no pitch for the sky');
  h2.view(v, true);
  assert.notDeepEqual(Array.from(v), before, 'first person: applied');
  // the effort voice is handed on
  const strain = () => null;
  assert.equal(createClimbFeelHost(() => c, { yaw: 0 }, null, { audio: { playOneShot() {} }, strain }).sounds.strain, strain);
  // the wall run looks up the wall
  const feel = new ClimbFeel();
  const w = fake({ climbMove: { t: 0 } });
  w.climbEvents = [{ type: 'move', kind: 'wallrun', dur: 1, rise: 1.5, speed: 0, turn: 0, way: [0, 0], normal: [0, 0, -1] }];
  const outs = frames(feel, w, 60, 0, (i, mm) => { mm.climbMove = { t: i / 60 }; });
  assert.ok(Math.max(...outs.map((o) => o.pitch)) > 2 * DEG, 'up the wall');
  assert.ok(Math.min(...outs.map((o) => o.pitch)) > -0.5 * DEG, 'never down it');
  // pitch and roll together: the roll spins about the look - the forward is the pitch's alone
  const fwd = (fx) => { const m4 = applyClimbView(lookAt([0, 0, 0], [0, 0, -1], [0, 1, 0]), { eye: [0, 0, 0], ...fx }); return [-m4[2], -m4[6], -m4[10]]; };
  const a = fwd({ pitch: 10 * DEG, roll: 0 }), b = fwd({ pitch: 10 * DEG, roll: 10 * DEG });
  for (let k = 0; k < 3; k++) assert.ok(near(a[k], b[k], 1e-9), `the forward with the roll is the pitch's (${a} vs ${b})`);
});

test('CLIMB4 F18: the motor tells what the feel and the ear only heard by hand in F1-F16 - a fall caught carries its speed, an eject its launch, and the grip running low its warning, once (the mutation run\'s own findings)', () => {
  // a fall onto a lip: the move carries the speed the body came at
  {
    const w = world();
    w.box(-3, 0, 1, 3, 2.3, 4);
    const m = climber(w.col);
    m.spawn(0, 4.5, 0.4);
    const seen = [];
    for (let i = 0; i < 120 && !m.mantling && !m.hanging; i++) { m.update(1 / 60, { ...blank, jump: true }, 0); seen.push(...m.climbEvents); }
    const mv = seen.find((e) => e.type === 'move');
    assert.ok(mv && mv.speed > 5, `the fall's speed (${mv?.speed})`);
  }
  // the eject: Jump with Back off a hang launches
  {
    const w = world();
    w.box(-3, 0, 1, 3, 2.3, 4);
    const m = climber(w.col);
    m.spawn(0, 0.02, 0.4);
    for (let i = 0; i < 120 && !m.hanging; i++) m.update(1 / 60, { ...blank, jump: i > 5 && i < 40 }, 0);
    for (let i = 0; i < 20; i++) m.update(1 / 60, blank, 0);
    const seen = [];
    for (let i = 0; i < 10; i++) { m.update(1 / 60, { ...blank, jump: i < 3, forward: i < 3 ? -1 : 0 }, 0); seen.push(...m.climbEvents); }
    const launch = seen.find((e) => e.type === 'launch');
    assert.ok(launch && launch.dir[2] < -0.9, 'the eject launches away from the wall');
  }
  // the grip running low: said once
  {
    const w = world();
    w.box(-3, 0, 1, 3, 2.3, 4);
    const m = climber(w.col);
    m.spawn(0, 0.02, 0.4);
    for (let i = 0; i < 120 && !m.hanging; i++) m.update(1 / 60, { ...blank, jump: i > 5 && i < 40 }, 0);
    let n = 0, at = null;
    for (let i = 0; i < 1800; i++) { m.update(1 / 60, blank, 0); for (const e of m.climbEvents) if (e.type === 'gripLow') { n++; at = m.grip; } }
    assert.equal(n, 1, 'once');
    assert.ok(at <= PARKOUR_GRIP_LOW && at > PARKOUR_GRIP_LOW - 0.01, `as it crossed the line (${at})`);
  }
});
