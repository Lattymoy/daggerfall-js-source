// EYE OF THE BEHOLDER'S SPRITES PLACED BY OUR OWN LAW (src/player/eyeOfTheBeholder/eotbAnchor.js). The law runs on
// made-up pictures here, each case aimed at a mutant in tools/mutants/ownaudit_eotb_anchors.json. With ARENA2_PATH
// set, eotbAnchors.json is held to what the law measures on the player's own frames, and the jitter it leaves is
// measured.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyLine, figureTall, standingTall, measureSet, anchorShift, anchorScale } from '../../../src/player/eyeOfTheBeholder/eotbAnchor.js';
import { SIZE_ON_FOOT, SIZE_RIDING_OR_TRANSFORMED } from '../../../src/player/eyeOfTheBeholder/eotbSprite.js';
import { ARCHIVE_LYCAN, RECORD_OFFSETS, MIRRORED } from '../../../src/player/eyeOfTheBeholder/eotbBillboard.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** A made-up figure, top-down RGBA: a head, a torso centred on `cx` (12 pixels wide at full size), two legs, its feet
 *  `float` rows above the picture's bottom. `arm` holds an arm out to the left at the waist, `staff` stands a staff apart
 *  on the left, `blade` holds a two-pixel blade over the head, `raise` lifts an arm above it. `tall` scales it. */
function figure({ w = 70, h = 120, cx = 30, tall = 110, float = 0, arm = false, staff = false, blade = false, raise = false } = {}) {
  const data = new Uint8Array(w * h * 4);
  const fill = (y0, y1, x0, x1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < w && y < h) data.set([180, 140, 90, 255], (y * w + x) * 4);
  };
  const u = tall / 110, feet = h - 1 - float, top = feet - tall + 1, r = (v) => Math.round(v * u);
  fill(top, top + r(11), cx - r(4), cx + r(4) - 1);   // the head
  fill(top + r(12), top + r(55), cx - r(6), cx + r(6) - 1);   // the torso
  fill(top + r(56), feet, cx - r(6), cx - r(2));   // the legs
  fill(top + r(56), feet, cx + r(1), cx + r(5));
  if (arm) fill(top + r(40), top + r(45), cx - r(22), cx - r(6));
  if (staff) fill(top + 10, feet - 4, 2, 4);
  if (blade) fill(0, top - 1, cx - 1, cx);
  if (raise) fill(top - 25, top + 30, cx + r(6), cx + r(11));
  return { width: w, height: h, data };
}
/** A body laid down: above the hips' rows but short of a chest, its own figure off its middle. */
const laid = (w = 70) => figure({ w, h: 50, tall: 48, cx: 20 });

test('OWN-AUDIT ANCHOR: the body\'s centre line is the torso\'s - past an arm held out, a staff held apart and the legs (mutants: ownaudit-eotb-anchor-mean, -first-run, -feet-rows)', () => {
  assert.equal(bodyLine(figure(), 110), 30, 'the plain figure');
  assert.equal(bodyLine(figure({ arm: true, staff: true }), 110), 30, 'an arm out and a staff apart move it nowhere');
  assert.equal(bodyLine(figure({ w: 90, cx: 61, arm: true }), 110), 61);
});

test('OWN-AUDIT ANCHOR: a body laid down keeps its own middle (mutant: ownaudit-eotb-anchor-laid-read)', () => {
  assert.equal(bodyLine(laid(), 110), 35);
  assert.equal(bodyLine(laid(51), 110), 25.5);
});

test('OWN-AUDIT ANCHOR: the figure\'s height is the head\'s top, never a blade over it (mutant: ownaudit-eotb-anchor-blade-counted)', () => {
  assert.equal(figureTall(figure({ blade: true }), 30, 110), 110);
  assert.equal(standingTall(figure({ blade: true, staff: true })), 110);
  assert.equal(figureTall(figure({ tall: 80 }), 30, 110), 80, 'a figure drawn small reads small');
});

/** A made-up set: five views a sheet, each view's figure at its own place on its own width of canvas. */
function madeSet() {
  const frames = new Map(), at = (v) => ({ w: 70 + 4 * v, cx: 30 + 3 * v });
  for (let v = 0; v < 5; v++) {
    const { w, cx } = at(v);
    frames.set(0 + v, [figure({ w, cx })]);   // Idle
    frames.set(5 + v, [figure({ w, cx, float: 2 }), figure({ w, cx: cx + 2, float: 2 })]);   // Move: drawn in the air, the body moving
    frames.set(10 + v, [figure({ w, cx }), laid(w + 10)]);   // Death: struck, then laid on a canvas of its own
    const ready = figure({ w: 90, cx: cx + 15, raise: true });
    frames.set(15 + v, [ready]);   // IdleMelee: an arm raised over the head
    frames.set(25 + v, [figure({ w: 90, cx: cx + 19 }), ready, figure({ w: 90, cx: cx + 22 })]);   // AttackMelee: the ready's canvas, lunging
    frames.set(45 + v, [figure({ w, cx, tall: 80 })]);   // IdleSpell: drawn small
  }
  return { frames, at, set: measureSet(frames, { Idle: 0, Move: 5, Death: 10, IdleMelee: 15, AttackMelee: 25, IdleSpell: 45 }) };
}

test('OWN-AUDIT ANCHOR: every facing and state stands its body\'s centre line on the spot and its lowest foot on the ground (mutants: ownaudit-eotb-anchor-ground-lost, -shift-sign)', () => {
  const { set, at } = madeSet();
  for (let v = 0; v < 5; v++) {
    const { w, cx } = at(v);
    assert.deepEqual(set.shift[0 + v], [w / 2 - cx, 0], `idle view ${v}`);
    assert.deepEqual(set.shift[5 + v], [w / 2 - cx, -2], `walk view ${v}: dropped to the ground, its frames one canvas`);
    assert.deepEqual(set.shift[15 + v], [45 - (cx + 15), 0], `ready view ${v}`);
  }
});

test('OWN-AUDIT ANCHOR: a family shares its canvas\'s shift - a swing keeps the ready\'s, its lunge as drawn - and a frame on another canvas takes its own (mutants: ownaudit-eotb-anchor-no-family, -frame-ignored)', () => {
  const { set } = madeSet();
  for (let v = 0; v < 5; v++) assert.deepEqual(set.shift[25 + v], set.shift[15 + v], `swing view ${v}`);
  const death = set.shift[10];
  assert.deepEqual(death, [[35 - 30, 0], [0, 0]], 'the struck body on its line, the laid one on its own middle');
  const table = { shift: { '9_10': death }, scale: {} };
  assert.deepEqual(anchorShift(table, 9, 10, 1), { right: 0, up: 0 });
  assert.deepEqual(anchorShift(table, 9, 10, 0), { right: 5, up: 0 });
  assert.deepEqual(anchorShift(table, 9, 10, 7), { right: 0, up: 0 }, 'past the last frame, the last');
  assert.equal(anchorShift(table, 9, 11), null, 'a record the law has not measured');
});

test('OWN-AUDIT ANCHOR: a sheet drawn short of its standing figure is scaled to it; a raised arm and a death are not (mutants: ownaudit-eotb-anchor-tall-scaled, -death-scaled)', () => {
  const { set, at } = madeSet();
  assert.deepEqual(Object.keys(set.scale).map(Number), [45, 46, 47, 48, 49]);
  for (let v = 0; v < 5; v++) {
    assert.deepEqual(set.scale[45 + v], [80, 110]);
    const { w, cx } = at(v);
    assert.deepEqual(set.shift[45 + v], [w / 2 - cx, 0], 'its centre line read at its own height');
  }
  const table = { shift: {}, scale: { '9_45': [80, 110] } };
  assert.equal(anchorScale(table, 9, 45), 80 / 110);
  assert.equal(anchorScale(table, 9, 46), 1);
});

const A2 = process.env.ARENA2_PATH;

test('OWN-AUDIT ANCHOR: eotbAnchors.json is what the law measures on the player\'s own frames (tools/eotbAnchors.mjs)', { skip: !A2 && 'ARENA2_PATH not set' }, async () => {
  const { buildAnchors, formatAnchors, ANCHORS_PATH } = await import('../../../tools/eotbAnchors.mjs');
  assert.equal(formatAnchors(await buildAnchors()), readFileSync(ANCHORS_PATH, 'utf8'));
  assert.ok(ANCHORS_PATH.startsWith(join(ROOT, 'src')));
});

// THE JITTER: where each picture's body stands in the world, in centimetres. Measured on 2026-11-01 under the author's
// retired table, the body jumped 38.4 cm on average turning from facing to facing and 5.8 cm changing state; under ours
// 0.7 and 0.3. The art's own motion inside a canvas (a lunge, a walk) is kept, so it is the same under both.
test('OWN-AUDIT ANCHOR: the body stays on its spot facing to facing and state to state (the jitter, measured)', { skip: !A2 && 'ARENA2_PATH not set' }, async () => {
  const { eotbPictures, eotbHas } = await import('../../../tools/lib/eotbPictures.mjs');
  const { sheetsOf, ANCHOR_ARCHIVES } = await import('../../../tools/eotbAnchors.mjs');
  const anchors = JSON.parse(readFileSync(join(ROOT, 'src/player/eyeOfTheBeholder/eotbAnchors.json'), 'utf8'));
  const pictures = eotbPictures();
  const facing = [], state = [];
  for (const archive of ANCHOR_ARCHIVES) {
    const m = archive >= ARCHIVE_LYCAN ? SIZE_RIDING_OR_TRANSFORMED : SIZE_ON_FOOT, sheets = sheetsOf(archive);
    const stand = [];
    for (let v = 0; v < 5; v++) stand.push(standingTall(await pictures.picture(`${archive}_${sheets.Idle + v}-0`)));
    /** The body's line in the world off the player's spot, frame 0 of a record, in centimetres. */
    const where = async (record, mirror) => {
      const p = await pictures.picture(`${archive}_${record}-0`), k = anchorScale(anchors, archive, record);
      const cm = ((bodyLine(p, stand[record % 5] * k) - p.width / 2 + anchorShift(anchors, archive, record).right) * m * 100) / k;
      return mirror ? -cm : cm;
    };
    for (const [name, base] of Object.entries(sheets)) {
      if (name === 'Death' || !eotbHas(`${archive}_${base}-0`)) continue;
      const wheel = [];
      for (let o = 0; o < 8; o++) wheel.push(await where(base + RECORD_OFFSETS[o], MIRRORED[o]));
      facing.push(Math.max(...wheel.map((x, o) => Math.abs(x - wheel[(o + 1) % 8]))));
      if (name !== 'Idle') for (let v = 0; v < 5; v++) state.push(Math.abs((await where(base + v, false)) - (await where(sheets.Idle + v, false))));
    }
  }
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  assert.ok(mean(facing) < 1, `facing to facing: ${mean(facing).toFixed(2)} cm on average`);
  assert.ok(Math.max(...facing) < 15, `facing to facing: ${Math.max(...facing).toFixed(1)} cm at most`);
  assert.ok(mean(state) < 1, `state to state: ${mean(state).toFixed(2)} cm on average`);
});
