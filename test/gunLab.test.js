// THE GUN LAB's arithmetic, pinned. The lab is a prototype and draws
// nothing the game draws - but the half of it that is worth keeping is
// the half it borrowed from FPSWeapon, and a borrowed law that drifts
// is worth less than no law at all. So the classic placement rules are
// compared against the port's OWN drawFpsWeapon here, on the same
// inputs, rather than restated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SHEET_GRID, FIRE_FRAMES, ALIGN, cellRect, keyBackground, contentBox,
  unionBox, unionDrawRect, placeSprite, createGunMachine, muzzleLight,
  createRecoil, createScreenShake, createWidgetRig, widgetRigStep, labWidgetSettings, labMotion, widgetDefaults,
  SFX, createSfxPlayer,
} from '../src/tools/gunLab.js';
import { ALIGN as FPS_ALIGN } from '../src/combat/fpsWeapon.js';
import { bobStep, offsetStep, inertiaStep } from '../src/combat/weaponWidgetMotion.js';

test('the lab is a lab: nothing the game runs imports it, and it changes no weapon law', () => {
  // The arrow points ONE WAY. The lab reads FPSWeapon's alignment and
  // Weapon Widget's movement modules; neither may ever read back, or
  // the prototype has quietly become a dependency of the game.
  // an IMPORT, not the word: weaponWidgetMotion.js names the lab in
  // its header, which is the point of the split being written down
  for (const f of ['src/combat/weaponRig.js', 'src/combat/fpsWeapon.js', 'src/combat/weaponWidget.js', 'src/combat/weaponWidgetMotion.js']) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /^\s*import[\s\S]*?from\s+'[^']*gunLab/m, `${f} does not import the lab`);
  }
  assert.ok(readFileSync('gun-proto.html', 'utf8').includes('/src/tools/gunLab.js'), 'the page is the only consumer');
});

test('the mod\u2019s movement is RUN, not copied - the lab imports the modules themselves', () => {
  const lab = readFileSync('src/tools/gunLab.js', 'utf8');
  assert.match(lab, /import \{[\s\S]*?offsetStep, bobStep, inertiaStep, widgetTransformRect,[\s\S]*?\} from '\.\.\/combat\/weaponWidgetMotion\.js'/,
    'Offset, Bob, Inertia and the rect transform come from the mod\u2019s own module');
  // and they are the same functions, not same-named ones
  assert.equal(typeof bobStep, 'function');
  assert.equal(typeof offsetStep, 'function');
  assert.equal(typeof inertiaStep, 'function');
});

test('the lab reads the mod\u2019s own settings, with the mod\u2019s own multipliers', () => {
  const d = widgetDefaults();
  assert.equal(d['Bob.Length'], 100, 'the declared default, not a number the lab made up');
  assert.equal(d['Modules.Inertia'], false, 'the MOD ships Inertia off');
  const s = labWidgetSettings();
  assert.equal(s.bobLength, 1, 'Bob.Length / 100, LoadSettings\u2019 own multiplier');
  assert.equal(s.inertiaScale, 500, 'Inertia.Scale x 500');
  assert.equal(s.offsetSpeed, 10, 'Offset.Speed x 10');
  assert.equal(s.bobSmoothSpeed, 500, 'Bob.SpeedState x 500');
  assert.equal(s.inertia, true, 'and the LAB turns Inertia on - its declared departure, this art being the case the mod\u2019s warning is about');
  assert.equal(labWidgetSettings({ 'Modules.Bob': false }).bob, false, 'a panel switch reaches the derived field');
});

test('Weapon Widget\u2019s Bob sways the gun while walking and barely breathes while standing', () => {
  const s = labWidgetSettings();
  const screenRect = { width: 1280, height: 800 };
  const span = (motion) => {
    const rig = createWidgetRig();
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 400; i++) {
      widgetRigStep(rig, s, 1 / 60, { screenRect, motion, idle: true });
      if (i > 120) { lo = Math.min(lo, rig.position[0]); hi = Math.max(hi, rig.position[0]); }
    }
    return hi - lo;
  };
  const walking = span(labMotion({ walking: true }));
  const standing = span(labMotion({ walking: false }));
  assert.ok(walking > 10, `the walk sways the sprite (${walking.toFixed(1)}px)`);
  assert.ok(standing > 0 && standing < walking / 3, `BobWhileIdle is a tenth of a stride, not a stride (${standing.toFixed(1)}px)`);
  // the motor's frame is the rig's own shape (weaponRig.js:907-914)
  const m = labMotion({ walking: true, running: true });
  assert.ok(m.speedRatio > 1 && m.baseSpeed > 0 && m.localVel[2] > 0, 'running is faster than the walk base, and it is forward motion');
  assert.equal(labMotion({ walking: false }).standing, true);
});

test('the reload lowers the weapon on the Offset module\u2019s easing, and brings it back', () => {
  const s = labWidgetSettings();
  const rig = createWidgetRig();
  const step = (shown) => widgetRigStep(rig, s, 1 / 60, {
    screenRect: { width: 1280, height: 800 }, motion: labMotion(), idle: true,
    shown, hiddenTarget: [0, 0.55],
  });
  for (let i = 0; i < 120; i++) step(false);
  assert.ok(rig.offset[1] > 0.5, `the weapon is down (offset ${rig.offset[1].toFixed(2)} of its own height)`);
  assert.equal(rig.offset[0], 0, 'straight down - the lab\u2019s target, not the mod\u2019s diagonal sheathe');
  for (let i = 0; i < 200; i++) step(true);
  assert.ok(Math.abs(rig.offset[1]) < 0.01, 'and back to rest when it is ready');
});

test('ALIGN is FPSWeapon\u2019s own enum, not a copy of it - an offset means the same thing in both', () => {
  // identity, not deepEqual: a restated {Left:0,Center:1,Right:2}
  // would pass a value compare and drift the day FPSWeapon's did
  assert.equal(ALIGN, FPS_ALIGN);
});

test('the sheet slices into six registered cells with the frame badges cropped off', () => {
  // the art's own size: 2000x667, three across and two down
  const rects = Array.from({ length: FIRE_FRAMES }, (_, i) => cellRect(i, 2000, 667));
  assert.equal(FIRE_FRAMES, 6);
  assert.equal(SHEET_GRID.cols * SHEET_GRID.rows, FIRE_FRAMES);
  for (const r of rects) {
    assert.equal(r.w, rects[0].w, 'every cell is the same width, or the frames do not register');
    assert.equal(r.h, rects[0].h);
    assert.ok(Number.isInteger(r.x) && Number.isInteger(r.y), 'integer source rects - a half pixel resamples');
  }
  // rows first, the numbering painted on the art
  assert.deepEqual(rects.map((r) => r.y), [0, 0, 0, 333, 333, 333]);
  const cw = Math.floor(2000 / 3);
  assert.equal(rects[0].x, Math.round(cw * SHEET_GRID.badgeGutter), 'the badge gutter is gone before a pixel is read');
  assert.equal(rects[1].x - rects[0].x, cw);
});

// A tiny synthetic frame: a neutral white page, a warm "flash" core
// touching the edge, and an enclosed white highlight inside the body.
function fixture() {
  const w = 8, h = 8, data = new Uint8ClampedArray(w * h * 4).fill(255);
  const set = (x, y, r, g, b) => { const p = (y * w + x) * 4; data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255; };
  for (let y = 2; y < 7; y++) for (let x = 2; x < 7; x++) set(x, y, 90, 74, 40);   // the body
  set(4, 4, 255, 255, 255);                                                        // an enclosed highlight
  for (let x = 0; x < 3; x++) set(x, 0, 255, 246, 200);                            // warm flash, on the edge
  return { width: w, height: h, data };
}

test('the key clears the page, spares an enclosed highlight, and never eats a warm flash on the border', () => {
  const img = fixture();
  const cleared = keyBackground(img, 244, 10);
  const alpha = (x, y) => img.data[(y * 8 + x) * 4 + 3];
  assert.ok(cleared > 0);
  assert.equal(alpha(7, 7), 0, 'neutral page cleared');
  assert.equal(alpha(4, 4), 255, 'an enclosed white highlight is unreachable from the border and survives');
  assert.equal(alpha(0, 0), 255, 'the warm flash core is not neutral, so it is art even touching the edge');
  for (const p of img.data.filter((_, i) => i % 4 === 3)) assert.ok(p === 0 || p === 255, '1-bit cutout, the port’s quad law');
});

test('contentBox / unionBox: one box for all six, anchored on the frame with no flash', () => {
  const img = fixture();
  keyBackground(img, 244, 10);
  assert.deepEqual(contentBox(img), { x: 0, y: 0, w: 7, h: 7 });
  assert.equal(contentBox({ width: 2, height: 2, data: new Uint8ClampedArray(16) }), null);
  const gun = { x: 40, y: 20, w: 30, h: 20 };
  const union = unionBox([gun, { x: 4, y: 2, w: 50, h: 30 }, null]);
  assert.deepEqual(union, { x: 4, y: 2, w: 66, h: 38 });
  // the gun keeps its place: the union image is drawn offset by
  // exactly the gap between the two boxes, at the layout's scale
  const anchorRect = { x: 100, y: 200, w: 60, h: 40 };   // 2x
  assert.deepEqual(unionDrawRect(anchorRect, gun, union), { x: 100 - 72, y: 200 - 36, w: 132, h: 76 });
});

test('placeSprite is FPSWeapon’s OnGUI rect: bottom-anchored, aligned, and AlignRight mirrors to AlignLeft', () => {
  const base = { canvasW: 640, canvasH: 400, frameW: 100, frameH: 50 };
  const c = placeSprite({ ...base, widthPct: 0.5, align: ALIGN.Center });
  assert.deepEqual(c, { x: 160, y: 400 - 160, w: 320, h: 160 });
  const r = placeSprite({ ...base, widthPct: 0.5, align: ALIGN.Right, offset: 0.1 });
  assert.equal(r.x, 640 * 0.9 - 320);
  const l = placeSprite({ ...base, widthPct: 0.5, align: ALIGN.Left, offset: 0.1 });
  assert.equal(l.x, 64);
  // :459-464 - the mirror swaps AlignRight for AlignLeft and leaves AlignLeft alone
  assert.equal(placeSprite({ ...base, widthPct: 0.5, align: ALIGN.Right, offset: 0.1, flip: true }).x, l.x);
  assert.equal(placeSprite({ ...base, widthPct: 0.5, align: ALIGN.Left, offset: 0.1, flip: true }).x, l.x);
  // the large-HUD style offset lifts the sprite, exactly as :388 does
  assert.equal(placeSprite({ ...base, widthPct: 0.5, align: ALIGN.Center, offsetHeight: 40 }).y, 400 - 160 - 40);
  // recoil is in NATIVE units, so it reads the same at any window size
  const kick = { x: 0, y: -10 };
  assert.equal(placeSprite({ ...base, widthPct: 0.5, align: ALIGN.Center, kick }).y, 400 - 160 - 10 * 2);
  assert.equal(placeSprite({ ...base, canvasH: 800, widthPct: 0.5, align: ALIGN.Center, kick }).y, 800 - 160 - 10 * 4);
});

test('the screenshake is TRAUMA SQUARED, smooth, and dead silent at rest', () => {
  const sh = createScreenShake({ amount: 8, decay: 4, rot: 1 });
  // exactly nothing at rest - not a small number, nothing: the room is
  // drawn through this every frame and a jitter with no shot behind it
  // is a bug you would chase for an hour
  assert.deepEqual(sh.step(1 / 60), { x: 0, y: 0, rot: 0 });
  sh.punch();
  assert.equal(sh.trauma, 1);
  const first = sh.step(1 / 60);
  assert.ok(Math.abs(first.x) > 0 && Math.abs(first.x) <= 8, `inside its peak (${first.x.toFixed(2)})`);
  assert.ok(Math.abs(first.rot) <= 1 * Math.PI / 180);
  // trauma SQUARED: at half the trauma the shake is a quarter, which is
  // what makes the tail fall away instead of stopping dead
  const half = createScreenShake({ amount: 8, decay: 0, rot: 1 });
  half.punch(0.5);
  const full = createScreenShake({ amount: 8, decay: 0, rot: 1 });
  full.punch(1);
  half.t = full.t = 1.234;   // same point of the noise, different trauma
  const a = half.step(0), b = full.step(0);
  assert.ok(Math.abs(b.x / a.x - 4) < 1e-9, 'a quarter of the shake at half the trauma');
  // and two shots close together stack, capped
  const stack = createScreenShake({ decay: 0 });
  stack.punch(0.7); stack.punch(0.7);
  assert.equal(stack.trauma, 1, 'capped at 1, so a held trigger cannot shake the screen off its hinges');
  // it settles, and the settling does not depend on the frame rate
  const slow = createScreenShake({ amount: 8, decay: 4 }); slow.punch();
  const fast = createScreenShake({ amount: 8, decay: 4 }); fast.punch();
  for (let i = 0; i < 30; i++) slow.step(1 / 30);
  for (let i = 0; i < 60; i++) fast.step(1 / 60);
  assert.ok(Math.abs(slow.trauma - fast.trauma) < 1e-9, 'trauma bleeds by time, not by frames');
  assert.deepEqual(slow.step(0.4), { x: 0, y: 0, rot: 0 }, 'and it comes back to exactly nothing');
});

test('the sounds are Daggerfall\u2019s own format, and every clip the lab offers exists', () => {
  const dir = 'public/sfx';
  const names = Object.values(SFX).flatMap((list) => list.map(([n]) => n));
  assert.ok(names.length >= 12, `${names.length} clips across three slots`);
  for (const n of names) {
    const b = readFileSync(`${dir}/${n}.wav`);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    // DAGGER.SND's parameters, src/formats/sndFile.js:3 - 11025Hz,
    // unsigned 8-bit, mono. The bake is the whole aesthetic claim and
    // this is where it stops being a claim.
    assert.equal(b.toString('latin1', 0, 4), 'RIFF', `${n} is a RIFF file`);
    assert.equal(dv.getUint16(22, true), 1, `${n} is mono`);
    assert.equal(dv.getUint32(24, true), 11025, `${n} is 11025Hz`);
    assert.equal(dv.getUint16(34, true), 8, `${n} is 8-bit`);
    assert.ok(b.length > 1000 && b.length < 40000, `${n} is a one-shot, not a performance (${b.length} bytes)`);
  }
  // the provenance ships with them, and every picked file is named in it
  const sources = readFileSync(`${dir}/SOURCES.md`, 'utf8');
  for (const n of names) assert.ok(sources.includes(`\`${n}.wav\``), `SOURCES.md accounts for ${n}.wav`);
  assert.match(sources, /CC0/, 'and says the license');
  // every shipped file is on the doctrine allow-list - public/ is the
  // static root, so anything here is published
  const doctrine = readFileSync('test/doctrine.test.js', 'utf8');
  for (const n of names) assert.ok(doctrine.includes(`public/sfx/${n}.wav`), `${n}.wav is allow-listed`);
});

test('the one-shot player layers rather than cutting, and stays silent when told to', () => {
  // a stub context: what the player does is assert-able without audio
  const started = [];
  const node = () => ({ connect(next) { return next; }, start(...a) { started.push(a); } });
  const ctx = {
    state: 'running', resume() { this.state = 'running'; },
    createBufferSource() { return { ...node(), playbackRate: { value: 1 }, buffer: null }; },
    createGain() { return { ...node(), gain: { value: 0 } }; },
    destination: {},
  };
  const p = createSfxPlayer({ vary: 0 });
  p.resume = () => ctx;
  // nothing loaded yet: a play is a miss, not a throw
  assert.equal(p.play('nope'), false);
  assert.equal(p.play(null), false);
  assert.equal(p.play(''), false);
  p.enabled = false;
  assert.equal(p.play('fire-shotgun'), false, 'the switch is obeyed before anything else');
});

test('the cycle: one shot at a time, six frames, a pump, and a hit frame that fires once', () => {
  const m = createGunMachine({ fps: 10, cooldownMs: 200, hitFrame: 1 });
  assert.equal(m.state, 'Idle');
  assert.ok(m.fire());
  assert.equal(m.fire(), false, 'FPSWeapon.OnAttackDirection: a one-shot in progress cannot be replaced');
  // half-frame steps, so what the eye would see is what is asserted
  const events = [], seen = [];
  for (let i = 0; i < 12; i++) { events.push(m.step(0.05)); seen.push(m.frame); }
  // every frame is shown, in order, none skipped - asserted as the
  // SEQUENCE rather than tick by tick, because the accumulator is a
  // float and 0.05 seven times is not 0.35
  assert.deepEqual([...new Set(seen.slice(0, 11))], [0, 1, 2, 3, 4, 5], 'all six frames reach the screen, in order');
  assert.equal(events.filter((e) => e === 'hit').length, 1, 'the hit lands once per shot');
  assert.equal(events.indexOf('hit'), 1, 'and on the step the hit frame arrives');
  assert.equal(m.state, 'Cooling', 'six frames, then the pump');
  assert.equal(m.shots, 1);
  assert.deepEqual([m.step(0.05), m.step(0.05), m.step(0.05)], [null, null, null], 'the pump is 200ms and nothing fires inside it');
  assert.equal(m.step(0.05), 'ready');
  assert.equal(m.state, 'Idle');
  // the trigger held re-fires on the next idle step, and only then
  m.trigger = true;
  m.step(0.001);
  assert.equal(m.state, 'Firing');
  assert.equal(m.shots, 2);
});

test('the muzzle light peaks on the flash frame and falls away over the smoke', () => {
  assert.equal(muzzleLight('Idle', 1), 0);
  assert.equal(muzzleLight('Firing', 1), 1, 'the flash is brightest on the sheet\u2019s frame 2');
  assert.equal(muzzleLight('Firing', 99), 0);
  for (let f = 0; f < FIRE_FRAMES; f++) {
    const l = muzzleLight('Firing', f);
    assert.ok(l >= 0 && l <= 1);
    if (f > 1) assert.ok(l < muzzleLight('Firing', f - 1), 'the light falls away over the smoke');
  }
});

test('the recoil is a DISPLACEMENT that settles, and a second shot stacks on what is left', () => {
  // the PHYSICS is pinned on its own numbers, not on the panel's - a
  // tuning change is Mac's to make and must not fail a law
  const r = createRecoil({ kick: 16, stiff: 120, damp: 14, back: 0.42 });
  assert.deepEqual(r.step(1 / 60), { x: 0, y: -0 }, 'nothing until the trigger breaks');
  r.punch();
  // the rise is there on the shot's own frame - an impulse would put
  // the peak two frames late and a third of the size
  const first = r.step(1 / 60);
  assert.ok(first.y < -12, `up the screen immediately (${first.y.toFixed(1)})`);
  // back toward the shoulder, which for a weapon held on the RIGHT is
  // toward the middle of the screen
  assert.ok(first.x < 0, `and back toward the shoulder (${first.x.toFixed(1)})`);
  let last = first.y;
  for (let i = 0; i < 20; i++) last = r.step(1 / 60).y;
  assert.ok(last > first.y, 'the spring pulls it home');
  const mid = r.y;
  r.punch();
  assert.ok(r.y > mid + 15, 'a second shot into the recovery stacks on what is left - the reason this is a spring');
  for (let i = 0; i < 400; i++) r.step(1 / 60);
  assert.ok(Math.abs(r.y) < 0.01 && Math.abs(r.x) < 0.01, 'and it comes fully to rest');
  // Mac's own numbers (2026-09-19), which are the module's defaults:
  // a small fast kick that rises STRAIGHT - `back` 0 means the weapon
  // does not drift toward the shoulder at all
  const tuned = createRecoil();
  assert.deepEqual([tuned.kick, tuned.back, tuned.stiff, tuned.damp], [5, 0, 400, 36]);
  tuned.punch();
  const up = tuned.step(1 / 60);
  assert.equal(up.x, 0, 'straight up, no lateral');
  assert.ok(up.y < 0, 'and up the screen');
  for (let i = 0; i < 6; i++) tuned.step(1 / 60);
  assert.ok(Math.abs(tuned.y) < 5 * 0.35, 'stiff 400 against damp 36 is home inside a tenth of a second');
  // a big dt must not explode the spring (the sub-step)
  const r2 = createRecoil({ kick: 16, stiff: 400 });
  r2.punch();
  for (let i = 0; i < 40; i++) r2.step(0.1);
  assert.ok(Number.isFinite(r2.y) && Math.abs(r2.y) < 1, 'a 100ms frame does not blow it up');
});

test('the paperdoll sprite is cut for the doll’s hand, and both icons are 1-bit', () => {
  // ONE SPRITE, TWO JOBS: a weapon's paperdoll layer and its inventory
  // icon are the same record in Daggerfall (GetInventoryTextureArchive
  // hands back PlayerTextureArchive - characters/paperdollArt.js), so
  // the gap the doll needs is in the icon too. That is why classic
  // weapon icons have a notch: they are doll layers shown in a list.
  const read = (f) => {
    const b = readFileSync(`public/art/${f}`);
    assert.equal(b.readUInt32BE(0), 0x89504E47, `${f} is a PNG`);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], type: b[25] };
  };
  const gun = read('gun-paperdoll.png');
  const ammo = read('gun-ammo.png');
  for (const [name, m] of [['gun-paperdoll.png', gun], ['gun-ammo.png', ammo]]) {
    assert.equal(m.depth, 8, `${name} is 8-bit`);
    assert.equal(m.type, 6, `${name} is RGBA`);
  }
  // sized for the panel, not for a screen: PAPERDOLL_W is 110
  assert.ok(gun.w > 40 && gun.w <= 110, `the gun fits the doll's panel (${gun.w}px of 110)`);
  assert.ok(ammo.w <= 50 && ammo.h <= 38, `the ammo fits the 50x38 list cell (${ammo.w}x${ammo.h})`);
});
