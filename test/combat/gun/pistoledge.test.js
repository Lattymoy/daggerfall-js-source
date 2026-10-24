// PISTOL-EDGE (2026-10-24; bible/05-Combat/Dwarven-Pistolet.md "PISTOL-EDGE"; the owner: "the pistolet doesnt match the
// test prototype 1:1 like you said it does. It still clips where you can see where the sprite isnt filled it"). The laws:
//   - THE ARM GOES ON PAST ITS CANVAS: every frame's forearm is carried past the strip's cut right and bottom edges, along
//     the arm's own lean off the rest frame (combat/gun/pistolStrip.js armLean, bleedArm) - the owner's pixels untouched,
//     each new texel an edge texel's colour, transparent where the edge is;
//   - ONE FRAME SET, BOTH ENDS: the lab's page and the game's loader draw pistolFrameSet's frames - the anchor the rest
//     frame's own box (the gun seated where it stood), the union the bled frames';
//   - THE CUT NEVER SHOWS: on the game's own rig at a real screen's size, through a shot, a walk, both strafes, a jump and
//     flicks of the head, no pistol's far side or bottom ever stands inside the screen;
//   - THE MOTION IS THE OWNER'S: holdToCorner moves nothing the bleed covers, and holds only what passes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPng } from '../../../tools/pngIO.mjs';
import { pistolRig, DT } from '../weapon/pistolRigHarness.js';
import { PISTOL_BLEED, ARM_LEAN_ROWS, EDGE_GAP, armLean, bleedArm, pistolFrameSet, cropImage, PISTOL_STRIP } from '../../../src/combat/gun/pistolStrip.js';
import { bledFrames } from '../../../src/combat/gun/pistoletArt.js';
import { holdToCorner } from '../../../src/combat/gun/pistolViewmodel.js';
import { createPistolet } from '../../../src/systems/pistolet.js';
import { pistolJumpClimb } from '../../../src/tools/pistolLab.js';
import { LookFilter } from '../../../src/player/lookFilter.js';
import { lookScale } from '../../../src/ui/lookSettings.js';

const strip = () => readPng(readFileSync(new URL('../../../public/art/pistol-frames.png', import.meta.url)));
const page = readFileSync(new URL('../../../pistol-proto.html', import.meta.url), 'utf8');
const img = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
const put = (im, x, y, rgba) => { const o = (y * im.width + x) * 4; for (let c = 0; c < 4; c++) im.data[o + c] = rgba[c]; };
const at = (im, x, y) => Array.from(im.data.slice((y * im.width + x) * 4, (y * im.width + x) * 4 + 4));

test('PISTOL-EDGE THE ARM\'S LEAN: off the rest frame\'s bottom rows, right and down along the forearm\'s own left edge, a unit direction; null for a frame with no arm there (mutants: the lean read vertical; the sign let back across the cut)', () => {
  const set = pistolFrameSet(strip());
  const [dx, dy] = set.lean;
  assert.ok(Math.abs(Math.hypot(dx, dy) - 1) < 1e-12, 'a unit direction');
  assert.ok(dx > 0.8 && dx < 0.95 && dy > 0.3 && dy < 0.6, `the forearm leaves right and down (${dx.toFixed(3)}, ${dy.toFixed(3)})`);
  assert.equal(armLean(img(10, 10)), null, 'no arm, no lean');
  // a synthetic arm: its left edge steps one right every two rows down - the lean is that slope, and never leftward
  const arm = img(40, ARM_LEAN_ROWS);
  for (let y = 0; y < ARM_LEAN_ROWS; y++) for (let x = 10 + (y >> 1); x < 40; x++) put(arm, x, y, [90, 60, 30, 255]);
  const [ax, ay] = armLean(arm);
  assert.ok(Math.abs(ax / ay - 0.5) < 0.02, `half a texel right per row down (${(ax / ay).toFixed(3)})`);
  const back = img(40, ARM_LEAN_ROWS);
  for (let y = 0; y < ARM_LEAN_ROWS; y++) for (let x = 30 - y; x < 40; x++) put(back, x, y, [90, 60, 30, 255]);
  assert.deepEqual(armLean(back), [0, 1], 'an edge leaning back is read straight down - the bleed never walks back across the cut');
});

test('PISTOL-EDGE A FRAME BLED PAST ITS CUT: PISTOL_BLEED larger right and below, the owner\'s pixels untouched, each new texel the edge texel its lean reaches - transparent where that is; no lean, nothing added (mutants: the new texels left empty; the frame shifted; the source walked the wrong way)', () => {
  const f = img(6, 5);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) put(f, x, y, [x * 40, y * 50, 7, x >= 2 ? 255 : 0]);
  const b = bleedArm(f, [Math.SQRT1_2, Math.SQRT1_2], { right: 4, bottom: 3 });
  assert.equal(b.width, 10);
  assert.equal(b.height, 8);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) assert.deepEqual(at(b, x, y), at(f, x, y), `(${x},${y}) the owner's own`);
  assert.deepEqual(at(b, 7, 2), at(f, 5, 0), 'right of the cut: the edge texel back along the lean');
  assert.deepEqual(at(b, 4, 6), at(f, 2, 4), 'below the cut: the bottom row\'s texel back along the lean');
  assert.deepEqual(at(b, 8, 7), at(f, 5, 4), 'past the corner: the corner texel');
  assert.deepEqual(at(b, 6, 7), at(f, 3, 4), 'past the corner, the walk back crossing the bottom row last: the bottom row\'s texel');
  assert.deepEqual(at(b, 1, 6), [0, 0, 0, 0], 'where the edge is transparent, so is the bleed');
  const none = bleedArm(f, null, { right: 4, bottom: 3 });
  for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) if (x >= 6 || y >= 5) assert.equal(at(none, x, y)[3], 0);
  assert.deepEqual(at(f, 5, 4), [200, 200, 7, 255], 'and the frame it read is untouched');
  // A NOTCH IN THE RIM IS THE ARM: a right edge opaque, then EDGE_GAP or fewer transparent, then opaque - the bleed past
  // the notch takes the nearer side's colour (the rest frame's two-texel notch drew a stripe of the world through the arm);
  // a gap wider than EDGE_GAP is a gap, and stays one
  const notch = (gap) => {
    const g = img(3, 4 + gap);
    for (let y = 0; y < 4 + gap; y++) put(g, 2, y, y < 2 ? [10, 0, 0, 255] : y < 2 + gap ? [0, 0, 0, 0] : [20, 0, 0, 255]);
    return bleedArm(g, [1, 0], { right: 2, bottom: 0 });
  };
  const n2 = notch(2);
  assert.deepEqual([at(n2, 4, 2), at(n2, 4, 3)], [[10, 0, 0, 255], [20, 0, 0, 255]], 'a notch of two: each texel its nearer side\'s');
  assert.equal(at(notch(2), 2, 2)[3], 0, 'the owner\'s notch itself untouched');
  const wide = notch(EDGE_GAP + 1);
  for (let y = 2; y < 2 + EDGE_GAP + 1; y++) assert.equal(at(wide, 4, y)[3], 0, `a gap of ${EDGE_GAP + 1}: still a gap (row ${y})`);
  assert.equal(EDGE_GAP, 4);
});

test('PISTOL-EDGE ONE FRAME SET, BOTH ENDS: the anchor the rest frame\'s own box, unbled; the union the bled frames\', reaching PISTOL_BLEED past the cut; every frame the owner\'s inside the cell; the game\'s loader and the lab\'s page draw this set (mutants: the anchor the bled box; the union unbled; the page cutting its own)', async () => {
  const s = strip();
  const set = pistolFrameSet(s, 128);
  assert.deepEqual(set.anchor, set.boxes[0], 'the gun seated where the owner drew it');
  assert.equal(set.union.x + set.union.w, PISTOL_STRIP.cellW + PISTOL_BLEED.right, 'the union reaches the bleed\'s width past the cut');
  // below, as deep as the arm reaches inside the bleed's width - the arm leans right, and leaves the bleed's right side
  // a few rows above its bottom; what it holds there is what the screen can ever show of it
  const bottom = set.union.y + set.union.h;
  assert.ok(bottom > PISTOL_STRIP.cellH + PISTOL_BLEED.bottom / 2 && bottom <= PISTOL_STRIP.cellH + PISTOL_BLEED.bottom, `and well below it (${bottom})`);
  for (let i = 0; i < PISTOL_STRIP.frames; i++) {
    const own = cropImage(set.bled[i], { x: 0, y: 0, w: PISTOL_STRIP.cellW, h: PISTOL_STRIP.cellH });
    assert.ok(own.data.every((v, k) => v === set.cells[i].data[k]), `frame ${i + 1}: the owner's pixels, as cut`);
  }
  // the arm past the cut is ONE piece: every column the bleed added holds its opaque texels in one run, every frame - no
  // stripe of the world through the sleeve
  for (let i = 0; i < PISTOL_STRIP.frames; i++) {
    const b = set.bled[i];
    for (let x = PISTOL_STRIP.cellW; x < b.width; x++) {
      let runs = 0, was = false;
      for (let y = 0; y < b.height; y++) { const on = b.data[(y * b.width + x) * 4 + 3] >= 128; if (on && !was) runs++; was = on; }
      assert.ok(runs <= 1, `frame ${i + 1}, column ${x}: the arm in ${runs} pieces`);
    }
  }
  const game = bledFrames(s, { cut: 128 });
  assert.deepEqual(game.union, set.union);
  assert.deepEqual(game.anchor, set.anchor);
  for (let i = 0; i < PISTOL_STRIP.frames; i++) {
    const want = cropImage(set.bled[i], set.union);
    assert.ok(game.frames[i].data.every((v, k) => v === want.data[k]), `frame ${i + 1}: the game draws the set's frame`);
  }
  assert.match(page, /pistolFrameSet\(/, 'the page draws the set');
  assert.match(page, /set\.bled\.map\(/, 'the bled frames, never the bare cells');
  assert.ok(!/function hardenAlpha|function cutCell/.test(page), 'and cuts no frame of its own');
  // AUDIT KETCH L5-1: every name the page imports is one the lab exports - a rename the page missed (cropTo) left the
  // owner's prototype on "loading art" and the build refusing the page; read off the page's own import list
  const block = /import \{([^}]*)\} from '\/src\/tools\/pistolLab\.js';/.exec(page);
  assert.ok(block, 'the page imports the lab');
  const names = block[1].replace(/\/\/[^\n]*/g, '').split(',').map((n) => n.trim()).filter(Boolean);
  const lab = await import('../../../src/tools/pistolLab.js');
  assert.deepEqual(names.filter((n) => !(n in lab)), [], 'every name the page imports, the lab exports');
});

test('PISTOL-EDGE THE MOTION IS THE OWNER\'S: holdToCorner moves nothing the bleed covers; past it, the picture is held so its far side and bottom stay on the screen\'s edges, the anchor moved with it - the left hand in the mirror (mutants: the clamp always on; the anchor left behind; the mirror\'s side the right\'s)', () => {
  const fr = (x, y, w = 300, h = 250) => ({ rect: { x, y, w, h }, anchorRect: { x: x + 10, y: y + 5, w: 100, h: 120 } });
  const past = holdToCorner(fr(1100, 600), 1280, 800);
  assert.deepEqual(past.rect, { x: 1100, y: 600, w: 300, h: 250 }, 'reaching past the corner: untouched');
  const inside = holdToCorner(fr(900, 500), 1280, 800);
  assert.deepEqual([inside.rect.x + inside.rect.w, inside.rect.y + inside.rect.h], [1280, 800], 'its far side and bottom held on the screen\'s');
  assert.deepEqual([inside.anchorRect.x, inside.anchorRect.y], [990, 555], 'the anchor carried with it');
  const left = holdToCorner(fr(-200, 600), 1280, 800, true);
  assert.equal(left.rect.x, -200, 'the mirror reaching past the left edge: untouched');
  const leftIn = holdToCorner(fr(40, 600), 1280, 800, true);
  assert.equal(leftIn.rect.x, 0, 'its far side - the left - held on the screen\'s');
  assert.equal(leftIn.anchorRect.x, 10);
});

test('PISTOL-EDGE THE CUT NEVER SHOWS: the game\'s own rig at 1280x800, a pair - through a shot, a walk, both strafes, a jump and flicks of the head no pistol\'s far side or bottom stands inside the screen; in a strafe, the owner\'s motion carries the cut past the screen\'s edge and the bleed fills it (mutants: no bleed; the union unbled; the rect never held)', async () => {
  const W = 1280, H = 800;
  const { r, frame, walk } = await pistolRig({ right: createPistolet(), left: createPistolet(), size: [W, H] });
  let worst = -Infinity, travelled = 0, frames = 0;
  const check = (q) => {
    for (const x of q) {
      const flip = !!x.uv, rc = x.rect;
      const side = flip ? rc.x : W - (rc.x + rc.w), bottom = H - (rc.y + rc.h);
      worst = Math.max(worst, side, bottom);
      // where the owner's canvas ends on the screen: the union is the cell and PISTOL_BLEED.right more
      const s = rc.w / (PISTOL_STRIP.cellW + PISTOL_BLEED.right);
      const cut = flip ? rc.x + rc.w - PISTOL_STRIP.cellW * s : rc.x + PISTOL_STRIP.cellW * s;
      travelled = Math.max(travelled, flip ? cut : W - cut);
      frames++;
    }
  };
  const head = new LookFilter();
  const turn = async (px, n) => { for (let i = 0; i < n; i++) { head.add(px * lookScale(), 0); check(await frame()); } };
  const settle = async (n = 60) => { for (let i = 0; i < n; i++) check(await frame()); };
  check(await frame());
  r.clickAttack(); await settle(30);
  walk.on = true; await settle(90); walk.on = false; await settle();
  walk.strafe = 1; await settle(); walk.strafe = 0; await settle();
  walk.strafe = -1; await settle(); walk.strafe = 0; await settle();
  let t = 0; walk.vertical = pistolJumpClimb(0);
  while (walk.vertical !== null) { check(await frame()); t += DT; walk.vertical = pistolJumpClimb(t); }
  await settle();
  await turn(400, 30); await settle(); await turn(-400, 30); await settle();
  walk.strafe = 1; await turn(30, 40); walk.strafe = 0; await settle();
  walk.strafe = -1; await turn(-30, 40); walk.strafe = 0;
  assert.ok(frames > 1500, `both pistols, every frame (${frames})`);
  assert.ok(worst <= 1e-6, `no far side or bottom inside the screen (worst ${worst.toFixed(2)} px)`);
  assert.ok(travelled > 60, `the motion carried the owner's cut ${travelled.toFixed(0)} px into the screen - and the bleed filled it`);
});
