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
  recoilOffset, bobOffset,
} from '../src/tools/gunLab.js';
import { ALIGN as FPS_ALIGN } from '../src/combat/fpsWeapon.js';

test('the lab is a lab: nothing the game runs imports it, and it changes no weapon law', () => {
  const rg = readFileSync('src/combat/weaponRig.js', 'utf8');
  const fp = readFileSync('src/combat/fpsWeapon.js', 'utf8');
  assert.ok(!rg.includes('gunLab') && !fp.includes('gunLab'), 'the weapon rig and FPSWeapon know nothing about it');
  assert.ok(readFileSync('gun-proto.html', 'utf8').includes('/src/tools/gunLab.js'), 'the page is the only consumer');
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

test('the feel curves stay inside the frame and settle to nothing at rest', () => {
  assert.equal(muzzleLight('Idle', 1), 0);
  assert.equal(muzzleLight('Firing', 1), 1, 'the flash is brightest on the sheet’s frame 2');
  assert.equal(muzzleLight('Firing', 99), 0);
  for (let f = 0; f < FIRE_FRAMES; f++) {
    const l = muzzleLight('Firing', f);
    assert.ok(l >= 0 && l <= 1);
    if (f > 1) assert.ok(l < muzzleLight('Firing', f - 1), 'the light falls away over the smoke');
  }
  assert.deepEqual(recoilOffset('Idle', 0, 12), { x: 0, y: 0 });
  assert.deepEqual(recoilOffset('Firing', 0, 0), { x: 0, y: 0 });
  assert.ok(recoilOffset('Firing', 0, 12).y > recoilOffset('Firing', 4, 12).y, 'the kick settles');
  assert.deepEqual(bobOffset(1.2, 4, false), { x: 0, y: 0 });
  assert.ok(Math.abs(bobOffset(1.2, 4, true).x) <= 4);
});
