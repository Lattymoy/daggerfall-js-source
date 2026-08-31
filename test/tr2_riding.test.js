import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CfaFile, CFA_HEADER_SIZE } from '../src/formats/cfaFile.js';
import {
  RidingAnimator, ridingTextureName, ridingLoopClip, ridingRect,
  nextNeighDelay, mountNeighDelay, RIDING_SOUND, ANIM_FRAME_TIME,
  RIDING_VOLUME_SCALE, SCALE_FACTOR_X, STOP_RIDING_DELAY, HORSE_TEXTURE, CART_TEXTURE,
} from '../src/systems/riding.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';
import { SOUND } from '../src/systems/soundClips.js';

// TR2 - THE RIDING SPRITE AND ITS AUDIO: TransportManager's Update
// (:210-280) and OnGUI (:285-318) halves, plus CfaFile.cs - the fifth
// classic image format the port reads.

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

/** A CFA by hand: 2x2, three frames, RLE-packed. */
function makeCfa({ width = 2, height = 2, frames = 3, compressedWidth = 2 } = {}) {
  // Frame k is filled with the byte (k + 1), as one RLE run each.
  const runs = [];
  for (let f = 0; f < frames; f++) runs.push(127 + width * height, f + 1);   // code>127: run of (code-127)
  const bytes = new Uint8Array(CFA_HEADER_SIZE + runs.length);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, width, true); v.setInt16(2, height, true); v.setInt16(4, compressedWidth, true);
  v.setInt16(6, 0, true); v.setInt16(8, 0, true);
  bytes[10] = 8; bytes[11] = frames;
  v.setInt16(12, CFA_HEADER_SIZE, true);
  bytes.set(runs, CFA_HEADER_SIZE);
  return bytes;
}

test('TR2: CfaFile - the 14-byte header, one record, N frames, and each frame its own slice', () => {
  assert.equal(CFA_HEADER_SIZE, 14);
  const cfa = new CfaFile();
  cfa.load(makeCfa(), 'TEST00I0.CFA');
  assert.equal(cfa.recordCount, 1, 'a CFA is one record');
  assert.equal(cfa.getFrameCount(0), 3);
  assert.deepEqual(cfa.getSize(0), { width: 2, height: 2 });
  assert.equal(cfa.header.bitsPerPixel, 8);
  for (let f = 0; f < 3; f++) {
    const bmp = cfa.getDFBitmap(0, f);
    assert.equal(bmp.width, 2); assert.equal(bmp.height, 2);
    assert.deepEqual([...bmp.data], [f + 1, f + 1, f + 1, f + 1], `frame ${f}`);
  }
  // Out of range answers the empty bitmap, as GetDFBitmap's guard does.
  assert.equal(cfa.getDFBitmap(0, 3).data, null);
  assert.equal(cfa.getDFBitmap(1, 0).data, null);
  assert.equal(cfa.getFrameCount(1), -1);
  assert.deepEqual(cfa.getSize(-1), { width: 0, height: 0 });
});

test('TR2: the RLE run length is measured in COMPRESSED widths while the buffer is UNCOMPRESSED-sized - verbatim, tail and all', () => {
  // ReadImageData (:129-137) allocates widthUncompressed * height *
  // frameCount and decodes widthCompressed * height * frameCount bytes
  // into it, and GetDFBitmap then reads rows of the UNCOMPRESSED width.
  // For the shipped files the two widths agree, so the buffer fills;
  // when they do not, DFU stops short and the tail stays zero. The
  // port copies that arithmetic rather than "fixing" it, because a
  // guess about which width is right would be a guess about art nobody
  // here can open.
  const cfa = new CfaFile();
  cfa.load(makeCfa({ width: 4, height: 2, frames: 2, compressedWidth: 2 }), 'T.CFA');
  assert.deepEqual(cfa.getSize(0), { width: 4, height: 2 });
  assert.equal(cfa.imageData.length, 4 * 2 * 2, 'the buffer is uncompressed-sized');
  const written = 2 * 2 * 2;
  assert.ok(cfa.imageData.slice(0, written).every((b) => b !== 0), 'the decode fills the compressed length');
  assert.ok(cfa.imageData.slice(written).every((b) => b === 0), 'and stops there');
});

test('TR2: the textures and the loop clips, by mode (:148-155, :343-345)', () => {
  assert.equal(ridingTextureName(TRANSPORT_MODES.Horse), HORSE_TEXTURE);
  assert.equal(ridingTextureName(TRANSPORT_MODES.Cart), CART_TEXTURE);
  assert.equal(HORSE_TEXTURE, 'MRED00I0.CFA'); assert.equal(CART_TEXTURE, 'MRED01I0.CFA');
  assert.equal(ridingLoopClip(TRANSPORT_MODES.Horse), RIDING_SOUND.horseFast, 'a horse starts on the FAST clop');
  assert.equal(ridingLoopClip(TRANSPORT_MODES.Cart), RIDING_SOUND.cart);
  // The three clips are in the port's roster at DFU's ids.
  assert.equal(SOUND[RIDING_SOUND.neigh], 99);
  assert.equal(SOUND[RIDING_SOUND.horseSlow], 97);
  assert.equal(SOUND[RIDING_SOUND.horseFast], 298);
  assert.equal(SOUND[RIDING_SOUND.cart], 104);
});

test('TR2: the frame clock - 0.125s, wrapping 3 to 0, frozen at 0 while standing, airborne or paused', () => {
  const a = new RidingAnimator();
  a.mount(TRANSPORT_MODES.Horse, { rolls: () => 0 });
  const moving = { mode: TRANSPORT_MODES.Horse, standingStill: false, movingLessThanHalfSpeed: false };
  // The first moving frame only STARTS the clock (lastFrameTime === 0).
  assert.equal(a.update(1 / 60, moving).frame, 0);
  let f = a.frameIndex, steps = 0;
  while (a.update(1 / 60, moving).frame === f && steps++ < 100) { /* wait for the tick */ }
  assert.equal(a.frameIndex, 1);
  assert.ok(steps >= 7 && steps <= 9, `0.125s at 60fps is ~7.5 frames, took ${steps}`);
  // Wrap: 3 -> 0, not 4.
  a.frameIndex = 3; a.lastFrameTime = 0;
  a.update(1 / 60, moving);
  for (let i = 0; i < 10; i++) a.update(1 / 60, moving);
  assert.equal(a.frameIndex, 0);
  // Standing still resets to frame 0 and starts the stop timer.
  a.frameIndex = 2;
  const still = { mode: TRANSPORT_MODES.Horse, standingStill: true, movingLessThanHalfSpeed: true };
  const r = a.update(1 / 60, still);
  assert.equal(r.frame, 0);
  assert.equal(a.lastFrameTime, 0, 'the clock is reset, not paused');
  for (const gate of [{ grounded: false }, { paused: true }]) {
    const b = new RidingAnimator(); b.mount(TRANSPORT_MODES.Horse, { rolls: () => 0 }); b.frameIndex = 2;
    assert.equal(b.update(1 / 60, { mode: TRANSPORT_MODES.Horse, movingLessThanHalfSpeed: false, ...gate }).frame, 0, JSON.stringify(gate));
  }
  assert.equal(ANIM_FRAME_TIME, 0.125);
});

test('TR2: the loop stops 0.2s AFTER you stop (:203-209), so a step-pause-step does not chop it', () => {
  const a = new RidingAnimator();
  a.mount(TRANSPORT_MODES.Horse, { rolls: () => 0 });
  const moving = { mode: TRANSPORT_MODES.Horse, standingStill: false, movingLessThanHalfSpeed: false };
  const still = { mode: TRANSPORT_MODES.Horse, standingStill: true, movingLessThanHalfSpeed: true };
  a.update(1 / 60, moving);
  assert.equal(a.update(1 / 60, moving).playing, true);
  const stoppedAt = a.now;
  assert.equal(a.update(0.1, still).playing, true, 'still playing 0.1s after the stop');
  assert.ok(near(a.stopAt, stoppedAt + 0.1 + STOP_RIDING_DELAY), 'the 0.2s runs from the frame the stop was noticed');
  assert.equal(a.update(0.15, still).playing, true, 'still inside the window');
  assert.equal(a.update(0.1, still).playing, false, 'and stopped past it');
  assert.equal(STOP_RIDING_DELAY, 0.2);
  // Moving again inside the window cancels the stop.
  const b = new RidingAnimator(); b.mount(TRANSPORT_MODES.Horse, { rolls: () => 0 });
  b.update(1 / 60, moving); b.update(1 / 60, moving);
  b.update(0.1, still);
  b.update(1 / 60, moving);
  assert.equal(b.stopAt, null, 'the pending stop is cancelled');
  assert.equal(b.update(0.3, moving).playing, true);
});

test('TR2: the clop swaps on the half-speed EDGE; volume halves below half speed; the pitch is the running one', () => {
  const a = new RidingAnimator();
  a.mount(TRANSPORT_MODES.Horse, { rolls: () => 0 });
  assert.equal(a.clip, RIDING_SOUND.horseFast, 'UpdateMode set it');
  // Starting state is wasMovingLessThanHalfSpeed = true, so the first
  // FAST frame flips to the fast clop; a slow frame after it flips back.
  a.update(1 / 60, { mode: TRANSPORT_MODES.Horse, movingLessThanHalfSpeed: false });
  assert.equal(a.clip, RIDING_SOUND.horseFast);
  assert.equal(a.wasMovingLessThanHalfSpeed, false);
  const slow = a.update(1 / 60, { mode: TRANSPORT_MODES.Horse, movingLessThanHalfSpeed: true });
  assert.equal(a.clip, RIDING_SOUND.horseSlow, 'the edge into half speed');
  // THE EDGE, not the state: setting the clip by hand and staying slow
  // must NOT re-set it, because DFU only assigns on the transition.
  a.clip = 'SomethingElse';
  a.update(1 / 60, { mode: TRANSPORT_MODES.Horse, movingLessThanHalfSpeed: true });
  assert.equal(a.clip, 'SomethingElse', 'no re-assign while the state holds');
  assert.ok(near(slow.volume, RIDING_VOLUME_SCALE * 0.5), 'halved below half speed');
  const fast = a.update(1 / 60, { mode: TRANSPORT_MODES.Horse, movingLessThanHalfSpeed: false, soundVolume: 0.5 });
  assert.ok(near(fast.volume, RIDING_VOLUME_SCALE * 0.5), 'and scaled by the sound setting');
  assert.equal(a.update(1 / 60, { mode: TRANSPORT_MODES.Horse, movingLessThanHalfSpeed: false, running: true }).pitch, 1.2);
  assert.equal(a.update(1 / 60, { mode: TRANSPORT_MODES.Horse, movingLessThanHalfSpeed: false }).pitch, 1);
  // A CART never swaps clips - the edge block is inside the horse arm.
  const c = new RidingAnimator(); c.mount(TRANSPORT_MODES.Cart, { rolls: () => 0 });
  c.update(1 / 60, { mode: TRANSPORT_MODES.Cart, movingLessThanHalfSpeed: false });
  c.update(1 / 60, { mode: TRANSPORT_MODES.Cart, movingLessThanHalfSpeed: true });
  assert.equal(c.clip, RIDING_SOUND.cart);
});

test('TR2: the neigh - 1..4s on mounting, then 2..39s, and a CART neighs too (:274-278 is outside the horse arm)', () => {
  assert.equal(mountNeighDelay(() => 0), 1);
  assert.ok(near(mountNeighDelay(() => 0.999), 4), 'Random.Range(1,5) is max-exclusive');
  assert.equal(nextNeighDelay(() => 0), 2);
  assert.equal(nextNeighDelay(() => 0.999), 39, 'Random.Range(2,40) is max-exclusive');
  const a = new RidingAnimator();
  a.mount(TRANSPORT_MODES.Horse, { rolls: () => 0 });   // neigh at now + 1
  const moving = { mode: TRANSPORT_MODES.Horse, movingLessThanHalfSpeed: false, rolls: () => 0 };
  assert.equal(a.update(0.5, moving).neigh, false);
  assert.equal(a.update(0.6, moving).neigh, true, 'past the mount delay');
  assert.equal(a.update(0.5, moving).neigh, false, 're-armed for 2s');
  // Standing still does not stop the neigh - the block is outside the
  // moving/standing fork entirely.
  const c = new RidingAnimator(); c.mount(TRANSPORT_MODES.Cart, { rolls: () => 0 });
  assert.equal(c.update(1.5, { mode: TRANSPORT_MODES.Cart, standingStill: true, rolls: () => 0 }).neigh, true);
});

test('TR2: the draw rect - bottom-centre, 200-line scale, 0.8 horizontal (:300-315)', () => {
  assert.equal(SCALE_FACTOR_X, 0.8);
  const art = { width: 100, height: 50 };
  const r = ridingRect({ width: 640, height: 400 }, art);
  const scaleY = 400 / 200, scaleX = scaleY * 0.8;
  assert.ok(near(r.w, 100 * scaleX)); assert.ok(near(r.h, 50 * scaleY));
  assert.ok(near(r.x, 320 - r.w / 2), 'centred');
  assert.ok(near(r.y, 400 - r.h), 'bottom-anchored');
  // The large-HUD offset lifts it (:304-309).
  assert.ok(near(ridingRect({ width: 640, height: 400 }, art, 40).y, 400 - r.h - 40));
});

test('TR2: on foot the animator answers nothing - no frame, no loop', () => {
  const a = new RidingAnimator();
  a.mount(TRANSPORT_MODES.Horse, { rolls: () => 0 });
  a.update(1 / 60, { mode: TRANSPORT_MODES.Horse, movingLessThanHalfSpeed: false });
  const r = a.update(1 / 60, { mode: TRANSPORT_MODES.Foot });
  assert.equal(r.playing, false); assert.equal(r.frame, 0); assert.equal(r.neigh, false);
});
