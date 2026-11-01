// THE PICTURES PAINTED AHEAD, NEVER IN THE FRAME THAT ASKS. The shield widget's slots and the deep's fish are painted
// a few milliseconds at a time in the page's idle slices (systems/idleWork.js over art/ownPainter.js paintSteps): an
// ask queues its slot and returns at once, the widget warms a shield's slots as it takes it, and the draw shows
// nothing until a picture is up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdleWork, IDLE_SPARE_MS, FORCED_SLICE_MS } from '../../src/systems/idleWork.js';
import { createPainter, paintSteps, rect, RAMP, QUEUE_ROWS } from '../../src/art/ownPainter.js';
import { paintShieldFace } from '../../src/combat/shieldFaces.js';
import { shieldWidgetImage, shieldWidgetSize, warmShieldSlots, shieldWidgetTextures, _setShieldPaintWorkForTests } from '../../src/combat/shieldWidgetAssets.js';
import { createShieldWidget, readShieldWidgetSettings, SHIELD_TEMPLATES } from '../../src/combat/shieldWidget.js';
import { toScreenOrder } from '../../src/formats/color32Order.js';
import { createFishPictures } from '../../src/scenes/deepWater/deepWatersFish.js';
import { fishPicture } from '../../src/systems/deepWater/fishArt.js';
import { MOD_SETTINGS } from '../../src/systems/modSettings.js';

/** A page's idle callback held by hand: `run(left)` gives the next slice `left()` ms of idle time (0: its wait ran out). */
function heldIdle() {
  const asks = [];
  const idle = (fn) => asks.push(fn);
  const run = (left = null) => {
    const fn = asks.shift();
    if (fn) fn({ didTimeout: !left, timeRemaining: left ?? (() => 0) });
    return !!fn;
  };
  return { idle, run, get waiting() { return asks.length; } };
}
const settle = async () => { for (let i = 0; i < 5; i++) await null; };
/** A clock past FORCED_SLICE_MS at each read: a forced slice takes exactly one step. */
const stepClock = () => { let t = 0; return () => (t += FORCED_SLICE_MS + 1); };

test('the idle queue: a forced slice works FORCED_SLICE_MS (one step at least), an idle one steps while time is left, a job asked for goes first, and a throw ends its job alone', () => {
  const page = heldIdle();
  const work = createIdleWork({ idle: page.idle, now: stepClock() });
  const ran = [];
  const job = (name, n) => (function* () { for (let i = 0; i < n; i++) { ran.push(`${name}${i}`); yield; } return name; })();
  const done = [];
  work.add('a', job('a', 3), (v) => done.push(v));
  work.add('b', job('b', 2), (v) => done.push(v));
  assert.deepEqual(ran, [], 'nothing runs where it is queued');
  page.run();
  assert.deepEqual(ran, ['a0'], 'its wait ran out: one step');
  work.hurry('b');
  page.run();
  assert.deepEqual(ran, ['a0', 'b0'], 'the job asked for goes first');
  let left = 12;
  page.run(() => (left -= 2));
  assert.deepEqual(ran, ['a0', 'b0', 'b1', 'a1', 'a2'], 'an idle slice steps on while more than its spare is left');
  assert.ok(left <= IDLE_SPARE_MS + 2 && left > 0);
  assert.deepEqual(done, ['b', 'a']);
  assert.equal(page.waiting, 0, 'and asks no more once the queue is empty');
  const clock = { t: 0 };
  const timed = createIdleWork({ idle: page.idle, now: () => clock.t });
  const cheap = [];
  timed.add('z', (function* () { for (let i = 0; i < 10; i++) { cheap.push(i); clock.t += 0.5; yield; } })(), () => {});
  page.run();
  assert.equal(cheap.length, FORCED_SLICE_MS / 0.5, 'a forced slice works its few milliseconds, not one step alone');
  while (page.run());
  const ends = [];
  work.add('x', (function* () { yield; throw new Error('broke'); })(), (v, e) => ends.push([v, e?.message]));
  work.add('y', job('y', 1), (v) => ends.push([v]));
  for (let i = 0; i < 4; i++) page.run();
  assert.deepEqual(ends, [[null, 'broke'], ['y']]);
});

test('a queued painter lays a fill a band of rows a step, and the steps paint what the painter paints at once', () => {
  const queue = [];
  const later = createPainter(16, 64, { queue });
  later.fill(rect(0, 0, 16, 64), RAMP.wood, { rough: 0.3, seed: 4 });
  later.outline();
  assert.equal(queue.length, 64 / QUEUE_ROWS + 1, 'eight bands of the fill, then the outline');
  assert.ok(later.data.every((v) => v === 0), 'nothing laid while it is queued');
  const now = createPainter(16, 64);
  now.fill(rect(0, 0, 16, 64), RAMP.wood, { rough: 0.3, seed: 4 });
  now.outline();
  for (const call of queue) call();
  assert.deepEqual([...later.data], [...now.data]);
});

test('a shield slot is painted in idle slices, never in the frame that asks, to the same picture; an ask goes first; a warmed shield queues its frames and its other wear tiers', async () => {
  const page = heldIdle();
  _setShieldPaintWorkForTests(createIdleWork({ idle: page.idle, now: stepClock() }));
  try {
    let got = null;
    shieldWidgetImage(302).then((img) => (got = img));
    await settle();
    assert.equal(got, null, 'nothing painted where it was asked');
    let slices = 0;
    while (!got && page.run()) { slices++; await settle(); }
    assert.ok(slices > 20, `painted over ${slices} slices, a step each`);
    const whole = toScreenOrder(paintShieldFace(302, shieldWidgetSize(302)));
    assert.deepEqual([got.width, got.height], [whole.width, whole.height]);
    assert.ok(got.colors.every((v, i) => v === whole.colors[i]), 'the picture the painter makes at once');
    assert.equal(await shieldWidgetImage(302), got, 'painted once');
    // a kite of group 2, worn (record 12, slots 360-364): its frames, then the pristine and battered tiers'
    const asked = [];
    const counting = createIdleWork({ idle: page.idle, now: stepClock() });
    _setShieldPaintWorkForTests({ add: (key, steps, done) => { asked.push(key); counting.add(key, steps, done); }, hurry: (k) => counting.hurry(k), get pending() { return counting.pending; } });
    warmShieldSlots(362);
    assert.deepEqual(asked, [360, 361, 362, 363, 364, 410, 411, 412, 413, 414, 310, 311, 312, 313, 314], 'its own tier first');
    warmShieldSlots(361);
    assert.equal(asked.length, 15, 'a slot is queued once');
    let first = null;
    shieldWidgetImage(413).then((img) => (first = img));
    while (!first && page.run()) await settle();
    assert.ok(first, 'the slot asked for');
    assert.equal(counting.pending, 14, 'painted before the fourteen warmed ahead of it');
  } finally { _setShieldPaintWorkForTests(); }
});

test('the widget warms a shield\'s slots as it takes it - before any frame of it is drawn', () => {
  const RAW = Object.fromEntries(Object.entries(MOD_SETTINGS['shield-widget'].keys).map(([k, d]) => [k, d.default]));
  const warmed = [];
  const widget = createShieldWidget({
    settings: () => readShieldWidgetSettings(() => RAW), audio: null, rolls: () => 0.5, handedness: () => false,
    textures: { ...shieldWidgetTextures, image: () => Promise.resolve(null), warm: (i) => warmed.push(i) },
  });
  const item = { templateIndex: SHIELD_TEMPLATES.Kite, nativeMaterialValue: 513, conditionPercentage: 100, isShield: true };
  widget.lateUpdate({
    dt: 1 / 60, time: 0, screenRect: { x: 0, y: 0, width: 640, height: 400 }, largeHudHeight: 0, item, attacking: false,
    sheathed: true, castingAnim: false, hasReadySpell: false, equipCountdownLeftHand: 0, isClimbing: false, isPaused: false,
    loadInProgress: false, entity: { stats: { speed: 50 } },
    motor: { speed: 0, baseSpeed: 3, isGrounded: true, isCrouching: false, isRiding: false, isStandingStill: true, moveDirectionLocal: [0, 0, 0] },
    look: { x: 0, y: 0, cursorActive: false, swingAction: false },
  });
  assert.deepEqual(warmed, [widget.indexCurrent], 'taken while sheathed: warmed, with nothing drawn yet');
});

test('the fish are painted in idle slices, none in the frame that starts them, each the picture the painter makes at once', async () => {
  const page = heldIdle();
  const made = [];
  const pics = createFishPictures({
    picture: fishPicture, clean: () => true, createTexture: (frames) => { made.push(frames[0]); return { tex: made.length, frames: 1 }; },
    work: createIdleWork({ idle: page.idle, now: stepClock() }),
  });
  pics.start();
  await settle();
  assert.equal(made.length, 0, 'none where they were started');
  let slices = 0;
  while (page.run()) { slices++; await settle(); }
  assert.equal(made.length, 7);
  assert.ok(slices > 7 * 10, `seven fish over ${slices} slices`);
  const want = fishPicture('longnose_butterflyfish');
  const got = made.find((f) => f.width === want.width && f.height === want.height);
  assert.ok(got, 'the butterflyfish');
  const rows = new Uint8Array(want.data.length);
  for (let y = 0; y < want.height; y++) rows.set(want.data.subarray((want.height - 1 - y) * want.width * 4, (want.height - y) * want.width * 4), y * want.width * 4);
  assert.ok(made.some((f) => f.data.length === rows.length && f.data.every((v, i) => v === rows[i])), 'one of them is it, row for row');
});
