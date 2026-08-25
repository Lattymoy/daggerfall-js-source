// FA1 - ANIMATED FLATS (DaggerfallBillboard.cs AnimateBillboard
// :110-165, the AnimatedMaterial decision :282-285, TextureReader.cs
// :35-36). Every fire, brazier, candle and magic-effect flat in the
// world drew frame 0 for ever: the frames were always in the records
// and the ENEMY sprites already rode them, but nothing advanced a
// STATIC flat, so the most repeated moving thing in Daggerfall stood
// still in every dungeon, guild hall and lit street.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FlatAnim, FlatAnimator, armFlatAnim, flatFps, isAnimatedFlat,
  GENERAL_FPS, ANIMAL_FPS, LIGHT_FPS, MISSILE_FPS, IMPACT_FPS,
  ANIMALS_TEXTURE_ARCHIVE, LIGHTS_TEXTURE_ARCHIVE,
} from '../src/render/flatAnimation.js';

test('FA1: the three speeds and the two archives that claim them', () => {
  // DaggerfallBillboard.cs:38-39,:45 and the pick at :119-121.
  assert.deepEqual([GENERAL_FPS, ANIMAL_FPS, LIGHT_FPS], [5, 5, 12]);
  assert.deepEqual([ANIMALS_TEXTURE_ARCHIVE, LIGHTS_TEXTURE_ARCHIVE], [201, 210]);
  assert.equal(flatFps(210), 12, 'the LIGHTS archive is the fast one - the flames');
  assert.equal(flatFps(201), 5);
  assert.equal(flatFps(97), 5, 'everything else takes the general speed');
  // ANIMALS is 5 like the general case, so a mutation that deleted its
  // arm would be invisible on speed alone - pin the arm's EXISTENCE by
  // the constant it reads, which is the thing DFU could change.
  assert.equal(ANIMAL_FPS, GENERAL_FPS, 'equal today, and separately sourced');
});

test('FA1: a single-frame record explicitly does NOT animate', () => {
  // SetMaterial :282-285 - the else arm sets AnimatedMaterial false
  // rather than leaving it. A still flat must cost nothing per frame.
  assert.equal(isAnimatedFlat(1), false);
  assert.equal(isAnimatedFlat(0), false);
  assert.equal(isAnimatedFlat(-1), false, 'getFrameCount answers -1 for a bad record');
  assert.equal(isAnimatedFlat(2), true);
  const anim = new FlatAnimator();
  const batch = { frame: null };
  assert.equal(anim.add(batch, 210, 1), null);
  assert.equal(batch.frame, null, 'a still batch keeps the key it always had');
  assert.equal(anim.entries.length, 0);
});

test('FA1: the loop WRAPS FIRST, then displays, then advances', () => {
  // The order is the law: `if (CurrentFrame >= frameCount) CurrentFrame
  // = 0;` runs BEFORE the draw, and the increment AFTER it, so the
  // frame on screen is always the one before the advance. A modulo
  // would land the same frames here and differ on the tick a one-shot
  // ends, which is why it is reproduced rather than tidied.
  const a = new FlatAnim(210, 4);         // 12 fps -> 1/12 s a frame
  assert.equal(a.frame, 0, 'the coroutine runs its body BEFORE its first wait');
  const step = 1 / 12;
  assert.equal(a.tick(step), 1);
  assert.equal(a.tick(step), 2);
  assert.equal(a.tick(step), 3);
  assert.equal(a.tick(step), 0, 'and it wraps back round');
  assert.equal(a.tick(step), 1);
});

test('FA1: the clock is FIXED-STEP - the frame rate cannot change the speed', () => {
  // DFU waits 1/speed between frames; a per-frame lerp would run the
  // animation faster on a 144Hz host than a 30Hz one.
  const slow = new FlatAnim(97, 3);       // 5 fps
  const fast = new FlatAnim(97, 3);
  // half a second each, deliberately NOT on a period boundary: at 5fps
  // that is two whole advances either way. (Landing exactly on 1/fps
  // is a float coin-toss, not a behaviour - the first draft of this
  // pin sat on 0.2s and caught its own rounding.)
  for (let i = 0; i < 15; i++) slow.tick(1 / 30);     // 0.5s of 30Hz
  for (let i = 0; i < 72; i++) fast.tick(1 / 144);    // 0.5s of 144Hz
  assert.equal(slow.frame, fast.frame, 'the same wall time is the same frame');
  assert.equal(slow.frame, 2, 'and it is the frame the fixed step lands on');
  // and a partial tick advances nothing at all
  const held = new FlatAnim(97, 3);
  const before = held.frame;
  held.tick(0.1);   // half of 1/5
  assert.equal(held.frame, before, 'no interpolation, no partial advance');
  held.tick(0.1);
  assert.notEqual(held.frame, before, 'the whole tick lands it');
});

test('FA1: a long stall lands on the right frame instead of replaying the gap', () => {
  // A restored tab or a loaded interior hands the host one enormous
  // dt. Spinning the whole gap one frame at a time is wasted work; the
  // frame it lands on is what matters.
  const a = new FlatAnim(210, 4);
  const spent = a.tick(60);
  assert.ok(spent >= 0 && spent < 4, `landed on a real frame: ${spent}`);
  // and it keeps running normally afterwards
  const next = a.tick(1 / 12);
  assert.notEqual(next, spent);
});

test('FA1: a one-shot stops at the wrap instead of looping', () => {
  const a = new FlatAnim(97, 3, true);
  assert.equal(a.frame, 0);
  a.tick(1 / 5); a.tick(1 / 5);
  assert.equal(a.frame, 2, 'it played its frames');
  assert.equal(a.done, false);
  a.tick(1 / 5);
  assert.equal(a.done, true, 'OneShot ends at the wrap (:126-128)');
  const held = a.frame;
  a.tick(10);
  assert.equal(a.frame, held, 'and stays put for ever after');
});

test('FA1: the animator drives the batch the renderer reads', () => {
  const anim = new FlatAnimator();
  const brazier = { frame: null };
  const candle = { frame: null };
  anim.add(brazier, 210, 5);
  anim.add(candle, 210, 3);
  assert.equal(brazier.frame, 0, 'armed at frame 0, not left null');
  anim.tick(1 / 12);
  assert.deepEqual([brazier.frame, candle.frame], [1, 1]);
  anim.tick(1 / 12);
  anim.tick(1 / 12);
  assert.deepEqual([brazier.frame, candle.frame], [3, 0], 'each on its own count');
  // a batch dropped (a pixel evicted, a scene torn down) leaves no clock
  anim.remove(candle);
  const was = candle.frame;
  anim.tick(1 / 12);
  assert.equal(candle.frame, was);
  assert.equal(anim.entries.length, 1);
  anim.clear();
  assert.equal(anim.entries.length, 0);
});

test('FA1: the arming seam uploads EVERY frame and only for animated records', () => {
  const uploads = [];
  const anim = new FlatAnimator();
  const upload = (a, r, f) => uploads.push(`${a}_${r}#${f}`);
  const tf = (n) => ({ getFrameCount: () => n });

  const still = { frame: null };
  assert.equal(armFlatAnim(still, tf(1), 210, 4, anim, upload), false);
  assert.deepEqual(uploads, [], 'a still flat uploads no frames and costs no clock');
  assert.equal(still.frame, null);

  const fire = { frame: null };
  assert.equal(armFlatAnim(fire, tf(4), 210, 7, anim, upload), true);
  assert.deepEqual(uploads, ['210_7#0', '210_7#1', '210_7#2', '210_7#3'],
    'every frame up front - a texture upload inside the frame loop is the churn class this renderer deletes');
  assert.equal(anim.entries.length, 1);

  // NEVER TRAPS: a missing texture file or a host with no frame
  // uploader must not throw out of a scene build.
  assert.equal(armFlatAnim({}, null, 210, 7, anim, upload), false);
  assert.equal(armFlatAnim({}, tf(4), 210, 7, anim, null), false);
});

test('FA1: all FOUR static-flat sites arm, and every host that DRAWS them ticks', () => {
  // THE FOUR HOSTS RULE, the shape this project keeps re-learning: the
  // static flat batches are built at exactly four sites, and drawn from
  // five (worldModes draws both contexts). A site that builds without
  // arming is a room of frozen fires; a host that draws without ticking
  // is the same thing one layer down.
  const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  for (const host of ['scenes/exterior.js', 'scenes/world.js', 'scenes/interiorContext.js', 'scenes/dungeonContext.js']) {
    assert.match(read(host), /armFlatAnim\(batch, t, archive, record, flatAnims, uploadRecordFrame\)/,
      `${host} builds a static-flat batch without arming it`);
  }
  for (const [host, tick] of [
    ['scenes/exterior.js', /flatAnims\.tick\(dt\)/],
    ['scenes/world.js', /p\.flatAnims\.tick\(dt\)/],
    ['scenes/interior.js', /ctx\.flatAnims\.tick\(dt\)/],
    ['scenes/dungeon.js', /ctx\.flatAnims\.tick\(dt\)/],
    ['scenes/worldModes.js', /dungeonCtx\.flatAnims\.tick\(dt\)/],
    ['scenes/worldModes.js', /interiorCtx\.flatAnims\.tick\(dt\)/],
  ]) {
    assert.match(read(host), tick, `${host} draws flats it never ticks`);
  }
  // and the renderer must actually READ the frame the animator writes
  assert.match(read('render/renderer.js'),
    /b\.frame == null \? `\$\{b\.archive\}_\$\{b\.record\}` : `\$\{b\.archive\}_\$\{b\.record\}#\$\{b\.frame\}`/,
    'the draw ignores the frame');
});

// ---------------------------------------------------------------
// FA1 slice 2: the missile flats, and the FPS override's precedence
// ---------------------------------------------------------------
test('FA1: a missile carries its OWN speed, and the named archives still beat it', () => {
  // DaggerfallMissile.cs:44-45 - BillboardFramesPerSecond 5 for the
  // missile in flight, ImpactBillboardFramesPerSecond 15 for the
  // contact flash (:367-368, record 1 and ONE SHOT at :591-607).
  assert.deepEqual([MISSILE_FPS, IMPACT_FPS], [5, 15]);
  // AnimateBillboard reads `speed = FramesPerSecond` FIRST and then
  // lets the two named archives overwrite it, so the precedence runs
  // archive-over-billboard, not the other way round. A missile flat
  // that happened to live in the lights archive would take 12.
  assert.equal(flatFps(376, IMPACT_FPS), 15, 'an ordinary archive takes the billboard rate');
  assert.equal(flatFps(LIGHTS_TEXTURE_ARCHIVE, IMPACT_FPS), LIGHT_FPS, 'LIGHTS overrides it');
  assert.equal(flatFps(ANIMALS_TEXTURE_ARCHIVE, IMPACT_FPS), ANIMAL_FPS, 'and so does ANIMALS');
  assert.equal(flatFps(376), GENERAL_FPS, 'and with no rate given, the general one');
  // the rate reaches the clock
  const impact = new FlatAnim(376, 4, true, IMPACT_FPS);
  assert.equal(impact.fps, 15);
  assert.equal(impact.tick(1 / 15), 1, 'one tick at fifteen is one frame');
});

test('FA1: every host that MOUNTS a missile arms it and drops its clock on retire', () => {
  // Missile flats froze on frame 0 - a fireball was a photograph of a
  // fireball. Both mount sites are the same six lines in two files,
  // which is exactly how one of them gets fixed and the other does not.
  const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  for (const host of ['scenes/dungeonContext.js', 'scenes/hostMagic.js']) {
    const src = read(host);
    assert.match(src, /armFlatAnim\(m\.batch, t, archive, 0, flatAnims, uploadRecordFrame, \{ fps: MISSILE_FPS \}\)/,
      `${host} mounts a missile flat it never animates`);
    assert.match(src, /flatAnims\.remove\(m\.batch\)/,
      `${host} destroys a missile batch and leaves its clock running`);
    // and the ORPHAN window the arrow taught us about: the mount is
    // async, so a missile that retires while its texture warms must
    // not publish a batch afterwards.
    assert.match(src, /if \(m\.dead\) \{ m\.batch = null; return; \}/,
      `${host} can still publish a batch for a dead missile`);
  }
  // hostMagic is shared by three hosts, so its clock rides its OWN
  // update rather than each host's frame.
  // X11 added two arguments (the look direction and the capsule height,
  // for the Light effect's candle), which this pin's exact signature
  // caught. Relaxed to `function update(dt, playerFeet` - the part that
  // matters is that the tick lives in the module's OWN update, not that
  // nothing may ever be added after playerFeet.
  assert.match(read('scenes/hostMagic.js'), /function update\(dt, playerFeet[,)][^\n]*\{\n(?:.*\n)*?\s*flatAnims\.tick\(dt\);/,
    'the shared magic module ticks its own flats');
});

test('FA1 slice 3: no site hand-writes a frame into a record any more', () => {
  // The `#0` written INTO the record was the reason the loot and corpse
  // batches could not be armed at slice 2: appending a frame index to a
  // record that already ends in one reads `20#0#2`. The record is bare
  // and the frame is a field everywhere now, so the draw builds the key
  // exactly one way - and a REBUILT batch (the floating-origin
  // recenter destroys and recreates them) needs the frame carried too,
  // which is the half a refactor like this forgets.
  const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  for (const host of ['scenes/droppedLoot.js', 'scenes/cityGuards.js', 'scenes/exteriorFoes.js']) {
    const src = read(host);
    assert.ok(!/createBillboardBatch\([^,]+, `\$\{[^}]+\}#0`/.test(src),
      `${host} still writes a frame into the record it passes`);
    assert.match(src, /\.frame = 0;/, `${host} mounts a frame-keyed batch without saying which frame`);
  }
  // the recenter rebuilds
  for (const host of ['scenes/cityGuards.js', 'scenes/exteriorFoes.js']) {
    const src = read(host);
    const rebuild = src.match(/for \(const c of corpseBatches\)[\s\S]*?\n {4}}/)[0];
    assert.match(rebuild, /c\.batch\.frame = 0;/, `${host} rebuilds a corpse batch and loses its frame`);
  }
  // and the loot module drops the clock with the batch
  assert.match(read('scenes/droppedLoot.js'), /flatAnims\.remove\(p\.batch\);/);
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js']) {
    assert.match(read(host), /droppedLoot\.tickFlats\(dt\)/, `${host} draws loot flats it never ticks`);
  }
});
