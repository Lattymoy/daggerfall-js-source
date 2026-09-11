// MAC1 (2026-09-10) - MAC'S PLAY REPORT, the fixes with a mechanism.
//
// The ledger's own note on yield: "Mac playing the game" finds the bugs
// no audit finds, because each looks correct from its own module. Ten
// items came in off three streams; seven had a mechanism in the tree
// and are here, each pinned on the seam that was wrong:
//   A. the boot menu's Morrowind card read a store nobody had counted
//   B. the pointer lock took the OS's accelerated deltas
//   C. the camera could look straight down (the owner's floor)
//   D. every small flat of every far pixel was a draw call
//   H. "standing still" was measured on the bobbing camera
//   I. the step ladder popped the render eye a rung at a time
//   J. the pointer came back on the click AFTER a resume, not with it
// E (a new game, then a save) had no mechanism in the tree and was
// reported back for a repro; F (the reflexes Continue) the owner
// withdrew on retest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestLook } from '../src/player/pointerLock.js';
import { LookFilter, PITCH_FLOOR, PITCH_LIMIT } from '../src/player/lookFilter.js';
import { farFlatVisible, FAR_FLAT_RING, TALL_FLAT_HEIGHT } from '../src/world/flatDistance.js';
import { PlayerMotor, STEP_OFFSET, STEP_SMOOTH_TAU } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(root, rel), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ── A ────────────────────────────────────────────────────────────
test('MAC1 A: the boot door counts the Morrowind store itself and repaints when the count lands', () => {
  const menu = src('src/ui/enhancedMenu.js');
  assert.match(menu, /import \{[^}]*\bregisterMorrowindData\b[^}]*\} from '\.\.\/scenes\/dataSource\.js'/, 'the menu imports the register');
  // Inside mount, after the hooks land and before any pane renders: the
  // count is kicked when nothing has counted (the fingerprint is null
  // until registerMorrowindData has run) and the SAME host repaints.
  assert.match(menu, /hooks = h \?\? \{\};[\s\S]{0,1200}if \(morrowindDataFingerprint\(\) == null\) \{\s*registerMorrowindData\(\)\.then\(\(\) => \{ if \(app === host && host\.isConnected\) render\(\); \}\)\.catch\(\(\) => \{\}\);/,
    'mount counts an uncounted store and repaints the mounted host, never a torn-down one');
  // The hosts still count on boot (scenes/shared.js) - this is a second
  // caller, not a move.
  assert.match(src('src/scenes/shared.js'), /const morrowind = registerMorrowindData\(\)\.catch\(\(\) => 0\);/);
});

// ── B ────────────────────────────────────────────────────────────
test('MAC1 B: the lock asks for unadjusted movement, and falls back on NotSupportedError alone', async () => {
  const calls = [];
  // a platform that has it
  const has = { requestPointerLock: (opts) => { calls.push(opts); return Promise.resolve(); } };
  requestLook(has);
  assert.deepEqual(calls, [{ unadjustedMovement: true }], 'the first request asks for raw device counts');
  // a platform without it: NotSupportedError -> the plain request follows
  calls.length = 0;
  let settled;
  const lacks = { requestPointerLock: (opts) => { calls.push(opts); if (opts) { const e = new Error('no raw input'); e.name = 'NotSupportedError'; return (settled = Promise.reject(e)); } return Promise.resolve(); } };
  requestLook(lacks);
  await settled.catch(() => {});
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls, [{ unadjustedMovement: true }, undefined], 'NotSupportedError retries bare, once');
  // any other refusal stays the no-op it was (focus, cooldown, pending)
  calls.length = 0;
  let cool;
  const cooldown = { requestPointerLock: (opts) => { calls.push(opts); const e = new Error('cooldown'); e.name = 'SecurityError'; return (cool = Promise.reject(e)); } };
  requestLook(cooldown);
  await cool.catch(() => {});
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls, [{ unadjustedMovement: true }], 'a cooldown refusal does not retry - the next gesture does');
});

// ── C ────────────────────────────────────────────────────────────
test('MAC1 C: the pitch floor is 75 degrees down, the ceiling the reference\'s; the clamp is on the target', () => {
  assert.ok(near(PITCH_FLOOR, (75 * Math.PI) / 180));
  assert.ok(PITCH_FLOOR < PITCH_LIMIT, 'the floor is inside the reference range');
  const f = new LookFilter();
  // looking down past the floor: the target clamps, the excess is forgotten
  const cam = { yaw: 0, pitch: -1.0 };
  f.add(0, -1.0);
  f.tick(1 / 60, cam, { smoothing: 0 });
  assert.ok(near(cam.pitch, -PITCH_FLOOR), `down stops at the floor (${cam.pitch})`);
  assert.ok(near(f.residualPitch, 0), 'nothing past the floor is owed');
  // up is untouched: the reference's own +-(PI/2 - e)
  const up = { yaw: 0, pitch: 1.4 };
  const g = new LookFilter();
  g.add(0, 1.0);
  g.tick(1 / 60, up, { smoothing: 0 });
  assert.ok(near(up.pitch, PITCH_LIMIT));
  // a pitch restored from a save BELOW the floor glides up to it over
  // the smoothing rather than snapping (the clamp is on the target)
  const low = { yaw: 0, pitch: -1.5 };
  const h = new LookFilter();
  h.tick(1 / 60, low, { smoothing: 0.5 });
  assert.ok(low.pitch > -1.5 && low.pitch < -PITCH_FLOOR, 'one tick pays part of the way up');
  for (let i = 0; i < 200; i++) h.tick(1 / 60, low, { smoothing: 0.5 });
  assert.ok(near(low.pitch, -PITCH_FLOOR, 1e-4), 'and settles on the floor');
});

// ── D ────────────────────────────────────────────────────────────
test('MAC1 D: the far rings draw the trees and the flats that move, and nothing small', () => {
  assert.equal(FAR_FLAT_RING, 2);
  assert.equal(TALL_FLAT_HEIGHT, 2.5);
  // the two nearest rings draw everything
  for (const ring of [0, 1]) {
    assert.equal(farFlatVisible({ ring, height: 0.4 }), true, `ring ${ring}: a small plant draws`);
    assert.equal(farFlatVisible({ ring, height: 6 }), true);
  }
  // beyond them: tall or moving, else skipped
  for (const ring of [2, 3, 4]) {
    assert.equal(farFlatVisible({ ring, height: 0.4 }), false, `ring ${ring}: a small plant is skipped`);
    assert.equal(farFlatVisible({ ring, height: 1.8 }), false, 'a walker-sized flat is skipped');
    assert.equal(farFlatVisible({ ring, height: TALL_FLAT_HEIGHT }), true, 'a tree draws');
    assert.equal(farFlatVisible({ ring, height: 0.4, animated: true }), true, 'a flat that moves (a fire, a torch, any smoke) marks the village');
  }
  // the wire: the streaming host's flat walk asks it per batch, with the
  // batch's own height and the animator's frame as the "moves" bit
  const w = src('src/scenes/world.js');
  assert.match(w, /import \{ farFlatVisible \} from '\.\.\/world\/flatDistance\.js'/);
  assert.match(w, /const ring = Math\.max\(Math\.abs\(p\.px - state\.current\.x\), Math\.abs\(p\.py - state\.current\.y\)\);\s*\n\s*for \(const b of p\.batches\) \{\s*\n[^\n]*EV3\s*\n\s*if \(!farFlatVisible\(\{ ring, height: b\.size\?\.h \?\? 0, animated: b\.frame != null \}\)\) continue;/,
    'the ring is Chebyshev from the player\'s pixel and the rule runs after the frustum test');
});

// ── H ────────────────────────────────────────────────────────────
test('MAC1 H: the politeness gate reads PlayerMotor.IsStandingStill, not the camera', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(host);
    assert.match(s, /_playerStill = walkMode(?: && playerSpawned)? \? !!player\.standing : \(_lastPlayerPos/, `${host}: the walker's gate is the motor's standing`);
  }
  // and standing IS DFU's IsStandingStill: grounded over a zero move
  const m = new PlayerMotor(new Collider(() => 0));
  m.pos = [0, 0, 0]; m.grounded = true;
  m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false }, 0);
  assert.equal(m.standing, true);
  m.update(1 / 60, { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false }, 0);
  assert.equal(m.standing, false);
});

// ── I ────────────────────────────────────────────────────────────
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
  return { positions: [ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz], indices: [0, 1, 2, 0, 2, 3] };
}
function stairs() {
  const col = new Collider(() => 0);
  const floor = quad(-10, 0, -10, 10, 0, -10, 10, 0, 20, -10, 0, 20);
  col.addMesh('floor', floor.positions, floor.indices, I4);
  const run = 0.6, riser = 0.3, count = 8, hw = 2, z0 = 2;
  for (let i = 0; i < count; i++) {
    const zf = z0 + i * run, yb = i * riser, yt = (i + 1) * riser;
    const r = quad(-hw, yb, zf, hw, yb, zf, hw, yt, zf, -hw, yt, zf);
    col.addMesh('s', r.positions, r.indices, I4);
    const t = quad(-hw, yt, zf, hw, yt, zf, hw, yt, zf + run, -hw, yt, zf + run);
    col.addMesh('s', t.positions, t.indices, I4);
  }
  const topY = count * riser, topZ = z0 + count * run;
  const land = quad(-hw, topY, topZ, hw, topY, topZ, hw, topY, topZ + 30, -hw, topY, topZ + 30);
  col.addMesh('s', land.positions, land.indices, I4);
  return { col, topY, topZ };
}
const walkInput = { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false };
function climb(dt, smooth) {
  const { col, topY, topZ } = stairs();
  const m = new PlayerMotor(col);
  m.pos = [0, 0, 0]; m.grounded = true;
  if (!smooth) m._eyeSmoothing = false;
  let maxEyeRise = 0, prevE = m.eyeAt()[1], frames = 0;
  while (m.pos[2] < topZ + 3 && frames < 2000) {
    m.update(dt, walkInput, 0);
    const e = m.eyeAt()[1];
    maxEyeRise = Math.max(maxEyeRise, e - prevE);
    prevE = e; frames++;
  }
  return { m, topY, maxEyeRise };
}

test('MAC1 I: the render eye pays a grounded step out over STEP_SMOOTH_TAU; the simulation eye and a jump are untouched', () => {
  assert.equal(STEP_SMOOTH_TAU, 0.06);
  // the same staircase, the same walk, at a 60Hz and a 144Hz display:
  // the smoothed eye's worst single-frame rise is well under the bare
  // one's, and the climb itself is bit-identical (only eyeAt changed)
  for (const dt of [1 / 60, 1 / 144]) {
    const bare = climb(dt, false), smooth = climb(dt, true);
    assert.ok(near(bare.m.pos[1], smooth.m.pos[1]) && near(bare.m.pos[2], smooth.m.pos[2]), 'the feet take the same path');
    assert.ok(near(smooth.m.pos[1], smooth.topY, 1e-3), `the stairs are climbed (${smooth.m.pos[1]} of ${smooth.topY})`);
    assert.ok(smooth.maxEyeRise < bare.maxEyeRise * 0.6, `dt ${dt}: worst eye pop ${smooth.maxEyeRise.toFixed(3)} vs bare ${bare.maxEyeRise.toFixed(3)}`);
    // standing at the top the owed step is paid: eyeAt settles on eye
    for (let i = 0; i < 120; i++) smooth.m.update(dt, { ...walkInput, forward: 0 }, 0);
    assert.ok(near(smooth.m.eyeAt()[1], smooth.m.eye[1], 1e-4), 'the eye settles on the simulation eye');
  }
  // the simulation's own eye never carries it
  const { m } = climb(1 / 60, true);
  m.update(1 / 60, walkInput, 0);
  assert.ok(near(m.eye[1], m.pos[1] + m._eyeLevel() + m.bobOffset[1]), 'eye = feet + level + bob, exactly');
  // a jump is not a step: while it is up the render eye follows the raw
  // interpolated height exactly - the arc is not lagged
  const flat = new PlayerMotor(new Collider(() => 0));
  flat.pos = [0, 0, 0]; flat.grounded = true;
  for (let i = 0; i < 10; i++) flat.update(1 / 60, { ...walkInput, forward: 0 }, 0);
  flat.update(1 / 60, { ...walkInput, forward: 0, jump: true }, 0);
  let airborne = 0;
  for (let i = 0; i < 30; i++) {
    flat.update(1 / 60, { ...walkInput, forward: 0 }, 0);
    if (flat.jumping) {
      airborne++;
      const raw = flat._prevPos[1] + (flat.pos[1] - flat._prevPos[1]) * flat._alpha;
      assert.ok(near(flat._eyeFeetY, raw), `a jump is followed raw (${flat._eyeFeetY} vs ${raw})`);
    }
  }
  assert.ok(airborne > 5, 'the jump was airborne long enough to test');
  // a placement primes the filter afresh (the snap guard)
  const placed = climb(1 / 60, true).m;
  placed.pos[2] += 50;   // a teleport-sized span
  placed.eyeAt();
  assert.equal(placed._eyeFeetY, null);
  // and the world's own shift moves the smoothed height with it
  const shifted = climb(1 / 60, true).m;
  const before = shifted._eyeFeetY;
  shifted.offsetOrigin([0, 10, 0]);
  assert.ok(near(shifted._eyeFeetY, before + 10));
});

test('MAC1 I: a hill is walked with no backstep and no airborne frame - the hills\' jitter is presentation, not the motor', () => {
  // The measurement that decided the fix's shape: on a mesh ramp with a
  // matching heightAt the feet climb monotonically at 10, 20 and 30
  // degrees, so what the eye showed on hills was the faceted terrain's
  // small steps, which the smoothing above now pays out.
  for (const deg of [10, 20, 30]) {
    const slope = Math.tan((deg * Math.PI) / 180);
    const col = new Collider((x, z) => Math.max(0, z) * slope);
    const r = quad(-10, 0, 0, 10, 0, 0, 10, 40 * slope, 40, -10, 40 * slope, 40);
    col.addMesh('ramp', r.positions, r.indices, I4);
    const m = new PlayerMotor(col);
    m.pos = [0, 0, -2]; m.grounded = true;
    let prev = m.pos[1], back = 0, air = 0;
    for (let f = 0; f < 240; f++) {
      m.update(1 / 60, walkInput, 0);
      if (m.pos[1] < prev - 1e-4) back++;
      if (!m.grounded) air++;
      prev = m.pos[1];
    }
    assert.equal(back, 0, `${deg} degrees: no backstep`);
    assert.equal(air, 0, `${deg} degrees: never airborne`);
    assert.ok(m.pos[1] > 1, `${deg} degrees: climbed (${m.pos[1].toFixed(2)})`);
  }
});

// ── J ────────────────────────────────────────────────────────────
/** AUDIT 65 HP-1: the brace-balanced body of the object literal that
 *  follows `opener`, skipping strings and comments, so a `{` inside a
 *  note or a quote cannot end the scan. */
function literalBody(text, opener) {
  const i = text.indexOf(opener);
  assert.ok(i >= 0, `could not find ${opener}`);
  const open = text.indexOf('{', i + opener.length);
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    const c = text[k];
    if (c === '/' && text[k + 1] === '/') { k = text.indexOf('\n', k); continue; }
    if (c === '/' && text[k + 1] === '*') { k = text.indexOf('*/', k) + 1; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c;
      for (k++; k < text.length; k++) { if (text[k] === '\\') k++; else if (text[k] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(open, k + 1);
  }
  assert.fail(`unbalanced literal after ${opener}`);
  return '';
}

/** ...and MOUNT it. The roadb_host_pause idiom (test/roadb_host_pause
 *  .test.js:53-66): nothing is retyped here, the object that gets built
 *  IS the one in src/, so a deleted key is a MISSING key in these
 *  assertions rather than a regex that quietly stops matching something
 *  nearby. Free identifiers resolve through a `with` scope proxy to
 *  inert stubs, except the ones handed in - which is how `host.relock`
 *  can be asked the question that matters: does the bag the REAL host
 *  hands over actually carry it? */
const STUB = new Proxy(function stub() {}, {
  get: (t, k) => (typeof k === 'symbol' ? Reflect.get(t, k) : STUB),
  apply: () => STUB,
});
function mountLiteral(text, opener, env = {}) {
  const scope = new Proxy({ ...env }, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : STUB)),
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { return (${literalBody(text, opener)}); }`)(scope);
}

/** A host's createWorldModes bag, built - the `host` object worldModes'
 *  interior pause reads its doors off. */
const hostBagOf = (text) => mountLiteral(`x(${literalBody(text, 'var modes = createWorldModes(')})`, 'x(');

test('MAC1 J: the pause door relocks the pointer inside the resume gesture, and every host hands it the canvas', () => {
  const door = src('src/ui/pauseDoor.js');
  assert.match(door, /const act = \(action\) => \{\s*\n\s*close\(\);[\s\S]{0,1400}if \(action !== 'exit'\) hooks\.relock\?\.\(\);\s*\n\s*if \(action === 'save'\) hooks\.quickSave\?\.\(\);/,
    'close first (the overlay-hold law), then relock for every exit but the one to the menu, then the hook');
  const w = src('src/scenes/world.js');
  assert.match(w, /quickLoad: worldQuickLoad,\s*\n\s*relock: \(\) => requestLook\(canvas\),/, 'the world host\'s pause hooks relock through its canvas');
  assert.match(w, /quickLoad: \(\) => worldQuickLoad\(\),\s*\n\s*relock: \(\) => requestLook\(canvas\),/, '...and the host bag the interior arm rides');
  assert.match(src('src/scenes/worldModes.js'), /quickLoad: host\.quickLoad,\s*\n\s*relock: host\.relock,/, 'the interior arm passes the host\'s relock through');

  // AUDIT 65 HP-1: ...AND THE OTHER THREE HOOK LITERALS, which this
  // test's own title has always claimed and never read. MAC1 wired
  // three of five and the source regexes above could not see it -
  // worse, the worldModes regex PASSES while `host.relock` resolves to
  // undefined, which is precisely what the ?exterior host did. So the
  // five bags are BUILT and asked, not matched.
  const modes = src('src/scenes/worldModes.js');
  const ext = src('src/scenes/exterior.js');
  const OUT = [['src/scenes/world.js', w], ['src/scenes/exterior.js', ext]];

  // (1)+(2) the two OUTDOOR pause doors, each relocking its own canvas.
  for (const [file, text] of OUT) {
    const hooks = mountLiteral(text, 'openPauseFlow((w) => townTalk.showOverlay(w), ', { opts: {} });
    assert.equal(typeof hooks.relock, 'function', `${file}: its own pause door hands pauseDoor.js:165 a relock`);
  }

  // (3) the INTERIOR pause door - ONE literal fed by TWO host bags, and
  // the bag is where MAC1's miss actually lived.
  for (const [file, text] of OUT) {
    const hooks = mountLiteral(modes, 'openPauseFlow((w) => { interiorOverlay = w; }, ', { opts: {}, host: hostBagOf(text) });
    assert.equal(typeof hooks.relock, 'function',
      `${file}: worldModes' interior pause reads host.relock, so THIS host's createWorldModes bag must carry it`);
  }

  // (4) the DUNGEON pause door - the most-played one of the six
  // (world.js gates its own Escape ladder on exterior mode, so
  // underground the key falls to routeKey -> ui/input.js's Escape case
  // -> dungeonContext.togglePause). That context owns no canvas, so its
  // hook is a forward and the pin follows it all the way out.
  let reached = 0;
  const hooks = mountLiteral(src('src/scenes/dungeonContext.js'), 'openPauseFlow((w) => { activeOverlay = w; }, ',
    { opts: { relock: () => { reached++; } } });
  assert.equal(typeof hooks.relock, 'function', 'dungeonContext\'s pause door hands over a relock');
  hooks.relock();
  assert.equal(reached, 1, '...and it is the one its HOST threaded in (this context owns no canvas of its own)');
  for (const [file, text] of [['src/scenes/dungeon.js', src('src/scenes/dungeon.js')], ['src/scenes/worldModes.js', modes]]) {
    let fired = 0;
    const opts = mountLiteral(text, 'dfLocation.climate.climateType, ', { host: { relock: () => { fired++; } } });
    assert.equal(typeof opts.relock, 'function', `${file}: this dungeon host hands buildDungeonContext a relock`);
    opts.relock();
    // the standalone host closes over its OWN canvas; the world-hosted
    // crawl forwards the outer host's (worldModes owns no requestLook)
    assert.equal(fired, file === 'src/scenes/worldModes.js' ? 1 : 0, `${file}: ...through this host's own look seam`);
  }

  // The law the whole item rides on: NEVER on the way to the menu.
  assert.ok(!/if \(action === 'exit'\)[^\n]*relock/.test(door), 'the exit has no world to relock into');
});
