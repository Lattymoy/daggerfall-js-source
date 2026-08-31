import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LookFilter, frameRateScaledFraction, frameSmoothing, SMOOTHING_MAX, PITCH_LIMIT } from '../src/player/lookFilter.js';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';
import { NUMBER_LAW } from '../src/ui/settingsLaw.js';

// AUDIT 28 - W7: MOUSE LOOK SMOOTHING (PlayerMouseLook.cs:100-105,
// :154-166; StartGameBehaviour :215). The setting ships 0.5 - DFU's
// default look IS smoothed - and the port applied raw deltas straight
// to the camera on the event. The filter keeps the residual owed to the
// camera and pays a frame-rate-scaled fraction of it each frame: the
// same arithmetic as DFU's lookCurrent/lookTarget lerp, with the
// property that an external camera write needs no resync.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('AUDIT 28 W7: GetFrameRateScaledFractionOfProgression, verbatim - identity at 60fps, more per frame at 30, less at 120', () => {
  assert.ok(near(frameRateScaledFraction(0.5, 1 / 60), 0.5), 'at exactly 60fps the fraction is itself');
  assert.ok(near(frameRateScaledFraction(0.5, 1 / 30), 2 / 3), '30fps: c=1, 1 - 1/(2+1)');
  assert.ok(near(frameRateScaledFraction(0.5, 1 / 120), 1 / 3), '120fps: 1 - 1/(0.5+1)');
  assert.ok(near(frameRateScaledFraction(1, 1 / 30), 1), 'fraction 1 (no smoothing) is 1 at any rate');
  // The per-frame smoothing: 1 - G(1 - s). Smoothing 0 is instant.
  assert.ok(near(frameSmoothing(0, 1 / 30), 0));
  assert.ok(near(frameSmoothing(0.5, 1 / 60), 0.5));
  assert.ok(near(frameSmoothing(0.5, 1 / 30), 1 / 3), 'a slower frame keeps LESS of the old value');
  assert.equal(SMOOTHING_MAX, 0.9);
  assert.ok(near(frameSmoothing(5, 1 / 60), 0.9), 'the Smoothing setter clamps to SmoothingMax');
});

test('AUDIT 28 W7: the residual form IS DFU\'s lookCurrent lerp, frame for frame', () => {
  // DFU: current = current*s' + target*(1-s'). Drive both on the same
  // deltas at 60fps with smoothing 0.5 and compare every frame.
  const dt = 1 / 60;
  let target = 0, current = 0;
  const f = new LookFilter();
  const cam = { yaw: 0, pitch: 0 };
  const deltas = [0.1, 0.1, 0, 0, -0.05, 0, 0, 0, 0, 0];
  for (const d of deltas) {
    target += d; f.add(d, 0);
    const s = frameSmoothing(0.5, dt);
    current = current * s + target * (1 - s);
    f.tick(dt, cam, { smoothing: 0.5 });
    assert.ok(near(cam.yaw, current), `frame mismatch: ${cam.yaw} vs ${current}`);
  }
  assert.ok(near(cam.yaw + f.residualYaw, target), 'camera plus residual is the target');
  // Smoothing 0: the whole delta lands the same frame.
  const g = new LookFilter(); const c2 = { yaw: 0, pitch: 0 };
  g.add(0.3, 0.2); g.tick(dt, c2, { smoothing: 0 });
  assert.ok(near(c2.yaw, 0.3) && near(c2.pitch, 0.2));
  assert.equal(g.residualYaw, 0);
});

test('AUDIT 28 W7: the pitch clamp is on the TARGET (:142) - the camera never overshoots and the excess is forgotten', () => {
  const f = new LookFilter(); const cam = { yaw: 0, pitch: 1.4 };
  f.add(0, 0.5);   // target 1.9, clamped to 1.5
  f.tick(1 / 60, cam, { smoothing: 0 });
  assert.ok(near(cam.pitch, PITCH_LIMIT));
  assert.ok(near(f.residualPitch, 0), 'the excess above the clamp is not owed later');
  // And with smoothing on, the residual is measured to the clamped
  // target. MW-D30's merge made the limit the REFERENCE's
  // +/-(PI/2 - 1e-6) (one home in mwCamera), so the arithmetic here is
  // limit-relative rather than a re-minted 1.5.
  const h = new LookFilter(); const c = { yaw: 0, pitch: 1.4 };
  const owed = PITCH_LIMIT - 1.4;
  h.add(0, 0.5); h.tick(1 / 60, c, { smoothing: 0.5 });
  assert.ok(near(c.pitch, 1.4 + owed * 0.5));
  assert.ok(near(h.residualPitch, owed * 0.5));
});

test('AUDIT 28 W7: an external camera write rides along - the residual is a delta, no resync', () => {
  const f = new LookFilter(); const cam = { yaw: 0, pitch: 0 };
  f.add(1.0, 0); f.tick(1 / 60, cam, { smoothing: 0.5 });   // 0.5 paid, 0.5 owed
  cam.yaw = 3.0;   // a dungeon door's facing, a load, a teleport
  f.tick(1 / 60, cam, { smoothing: 0.5 });
  assert.ok(near(cam.yaw, 3.25), 'the owed 0.5 keeps paying out from the NEW yaw');
});

test('AUDIT 28 W7: the setting is the default source (0..0.9, ships 0.5), LIVE, and the screen\'s range is DFU\'s clamp', () => {
  resetToDefaults();
  const f = new LookFilter(); const cam = { yaw: 0, pitch: 0 };
  f.add(1, 0); f.tick(1 / 60, cam);
  assert.ok(near(cam.yaw, 0.5), 'the shipped default is 0.5 - DFU\'s look is smoothed out of the box');
  setValue('Controls', 'MouseLookSmoothingFactor', 0);
  const g = new LookFilter(); const c = { yaw: 0, pitch: 0 };
  g.add(1, 0); g.tick(1 / 60, c);
  assert.ok(near(c.yaw, 1), 'read live');
  resetToDefaults();
  assert.equal(LIVE['Controls/MouseLookSmoothingFactor'], 'src/player/lookFilter.js');
  assert.equal(NUMBER_LAW['Controls/MouseLookSmoothingFactor'].max, 0.9, 'range-equals-clamp: SmoothingMax');
});

test('AUDIT 28 W7: all four hosts route both look sites (mouse, touch) through the filter and tick it on the frame\'s dt before the camera is read', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/interior.js']) {
    const s = read(host);
    assert.equal((s.match(/lookFilter\.add\(/g) || []).length, 2, `${host}: two look sites through the filter`);
    assert.equal((s.match(/cam\.yaw \+= [^\n]*lookScale\(\)/g) || []).length, 0, `${host}: no raw delta reaches the camera`);
    // F-C1 moved the tick behind the paused gate; it still rides the
    // frame's dt, immediately after it.
    assert.match(s, /const dt = Math\.min\(0\.1, \(now - last\) \/ 1000\);\n(\s*\/\/[^\n]*\n)*\s*if \(!\([^\n]*\)\) \{\s*\n\s*if \([^\n]*\) lookFilter\.settle\(\);\s*\n\s*else lookFilter\.tick\(dt, cam\);/, `${host}: the tick rides the frame's dt`);
    assert.match(s, /const lookFilter = new LookFilter\(\);/, `${host}: one filter per camera`);
  }
});

test('AUDIT 28 F-C1/F-C2: settle drops the owed look (SetFacing -> Init), and every host answers Update\'s three cases - paused waits, a held swing drops, else pays', () => {
  const f = new LookFilter(); const cam = { yaw: 0, pitch: 0 };
  f.add(1, 0.5); f.tick(1 / 60, cam, { smoothing: 0.5 });
  f.settle();
  assert.equal(f.residualYaw, 0); assert.equal(f.residualPitch, 0);
  f.tick(1 / 60, cam, { smoothing: 0.5 });
  assert.ok(near(cam.yaw, 0.5), 'nothing more is paid after a settle');
  const gates = {
    'src/scenes/world.js': ["townTalk.overlayActive || (modes?.overlayHeld ?? false)", "rightHeld && walkMode && modeNow() === 'exterior' && !weaponRig.playerWeapon.machine?.isBow"],
    'src/scenes/exterior.js': ["townTalk.overlayActive || (modes?.overlayHeld ?? false)", "rightHeld && walkMode && modeNow() === 'exterior' && !weaponRig.playerWeapon.machine?.isBow"],
    'src/scenes/dungeon.js': ['ctx.uiOverlayActive', 'rightHeld && walkMode && !ctx.weaponIsBow'],
    'src/scenes/interior.js': ['false', 'false'],
  };
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [host, [paused, swing]] of Object.entries(gates)) {
    const s = read(host);
    assert.match(s, new RegExp(`if \\(!\\(${esc(paused)}\\)\\) \\{\\s*\\n\\s*if \\(${esc(swing)}\\) lookFilter\\.settle\\(\\);\\s*\\n\\s*else lookFilter\\.tick\\(dt, cam\\);`), `${host}: the three answers`);
    if (host !== 'src/scenes/interior.js') {
      // The raw button, tracked on the window and never gated - HasAction(SwingWeapon).
      assert.match(s, /addEventListener\('mousedown', \(e\) => \{ if \(e\.button === 2\) rightHeld = true;/, `${host}: down`);
      assert.match(s, /addEventListener\('mouseup', \(e\) => \{ if \(e\.button === 2\) rightHeld = false;/, `${host}: up`);
    }
  }
  assert.match(read('src/scenes/dungeonContext.js'), /get weaponIsBow\(\) \{ return !!playerWeapon\.machine\?\.isBow; \}/);
});
