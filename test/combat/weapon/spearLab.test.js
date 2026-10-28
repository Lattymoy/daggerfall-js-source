// THE SPEAR LAB's laws, pinned (bible/05-Combat/Spear-Lab.md): the owner's five frames as they were given, the arms
// carried past the cut, every strike frame drawn from the five with no colour of its own, the strikes' shapes, and that
// what the lab borrows - the game's machine, swing law, drag and frame - it runs rather than restates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readPng } from '../../../tools/pngIO.mjs';
import {
  SPEAR_STRIP, SPEAR_POSE, SPEAR_BLEED, SPEAR_STRIKES, SPEAR_STRIKE_OF, SPEAR_STAGE, SPEAR_REST_AT, SPEAR_AIM, SPEAR_IDLE,
  SPEAR_ITEM, SPEAR_HANDLING_OF, SPEAR_NUM_FRAMES, SPEAR_SWING_SFX, SPEAR_OPENING, spearFrameSet, drawSpearFrames, spearFrameSeconds,
  createSpearMachine, spearAttack, spearStep, spearFrameOf, spearScrubFrame, spearScreenPoint, spearReleaseFrame,
  createSpearGesture, spearGestureStep, spearPageRect, spearPageState, stageAnchor, createGunRig, gunRigStep, gunMotion,
  gunWidgetSettings, DIRECTION_TO_STRIKE, CLICK_ATTACK_DIRECTIONS, createSfxPlayer,
} from '../../../src/tools/spearLab.js';
import { bleedArms, edgeRuns, runLean, rearLean, REAR_LEAN, REAR_REACH } from '../../../src/combat/spearStrip.js';
import { surfacePoint, HEAD_REACH, SMEAR_GHOSTS } from '../../../src/combat/spearStrikes.js';
import { cutCell } from '../../../src/combat/gun/pistolStrip.js';
import { rotSprite, scale2x, drawTurned, rotSpriteUp } from '../../../src/formats/rotSprite.js';
import * as PISTOLET_ART from '../../../tools/pistoletArt.mjs';
import * as GUN_VIEW from '../../../src/combat/gun/gunViewmodel.js';
import * as STATES from '../../../src/characters/weaponStates.js';
import { DIRECTION_TO_STRIKE as GAME_DIRECTIONS } from '../../../src/characters/anims.js';
import { createSfxPlayer as GUN_LAB_SFX } from '../../../src/tools/gunLab.js';
import { PlayerWeapon } from '../../../src/combat/playerWeapon.js';

const strip = readPng(readFileSync(`public/art/${SPEAR_STRIP.file}`));
const set = spearFrameSet(strip);
let drawnOnce = null;
const drawn = () => (drawnOnce ??= drawSpearFrames(set));
const page = () => readFileSync('spear-proto.html', 'utf8');
const KEYS = Object.keys(SPEAR_STRIKES);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('SPEAR-LAB the lab is a lab: nothing the game runs imports it, and the page is its consumer', () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : (/\.m?js$/.test(n) ? [p] : []);
  });
  const importers = walk('src').filter((f) => !f.startsWith(join('src', 'tools'))
    && /^\s*import\s+(?:[\s\S]*?from\s+)?'[^']*spearLab/m.test(readFileSync(f, 'utf8')));
  assert.deepEqual(importers, []);
  assert.ok(page().includes("from '/src/tools/spearLab.js'"));
});

test('SPEAR-LAB what it borrows is RUN, by identity: the guns\' frame and Widget rig, the game\'s directions, the click roll, the sound player', () => {
  assert.equal(createGunRig, GUN_VIEW.createGunRig);
  assert.equal(gunRigStep, GUN_VIEW.gunRigStep);
  assert.equal(gunMotion, GUN_VIEW.gunMotion);
  assert.equal(gunWidgetSettings, GUN_VIEW.gunWidgetSettings);
  assert.equal(DIRECTION_TO_STRIKE, GAME_DIRECTIONS);
  assert.equal(CLICK_ATTACK_DIRECTIONS, STATES.CLICK_ATTACK_DIRECTIONS);
  assert.equal(createSfxPlayer, GUN_LAB_SFX);
  const html = page();
  assert.match(html, /spearPageRect\(rig, art\.set, canvas, state\)/);
  for (const step of ['placeSprite(', 'widgetTransformRect(', 'unionDrawRect(', 'gunFrameRect(', 'machineStep(', 'gestureDirection(']) {
    assert.ok(!html.includes(step), `the page calls ${step} itself`);
  }
});

test('SPEAR-LAB RotSprite has one home: the Pistolet\'s doll tool reads it from formats/rotSprite.js', () => {
  assert.equal(PISTOLET_ART.rotSprite, rotSprite);
  assert.equal(PISTOLET_ART.scale2x, scale2x);
  assert.doesNotMatch(readFileSync('tools/pistoletArt.mjs', 'utf8'), /function (rotSprite|scale2x)\b/);
});

test('SPEAR-LAB the strip is the one picture the fifth exception carries: the listing names it and its bytes', () => {
  const listing = JSON.parse(readFileSync('public/art/spear/spear.files.json', 'utf8'));
  assert.equal(SPEAR_STRIP.file, 'spear/spear-frames.png');
  assert.deepEqual(listing.Files, ['spear-frames.png', 'spear.files.json']);
  assert.deepEqual(readdirSync('public/art/spear').sort(), listing.Files);
  assert.equal(createHash('sha256').update(readFileSync(`public/art/${SPEAR_STRIP.file}`)).digest('hex'), listing.Sha256['spear-frames.png']);
  assert.match(readFileSync('bible/01-Overview/Port-Doctrine.md', 'utf8'), /\*\*THE FIFTH EXCEPTION - THE SPEAR'S FRAMES[^\n]*`public\/art\/spear\/`/);
});

test('SPEAR-LAB the strip is the owner\'s five 187x189 frames, side by side, cut to 1 bit', () => {
  assert.deepEqual([strip.width, strip.height], [SPEAR_STRIP.cellW * SPEAR_STRIP.frames, SPEAR_STRIP.cellH]);
  assert.deepEqual([SPEAR_STRIP.frames, SPEAR_STRIP.cellW, SPEAR_STRIP.cellH], [5, 187, 189]);
  assert.deepEqual(SPEAR_POSE, { rest: 0, chamber: 1, drive: 2, extend: 3, full: 4 });
  assert.equal(set.soft, 78, 'the soft texels the 1-bit cut clears across the five');
  assert.deepEqual(set.anchor, { x: 38, y: 37, w: 149, h: 152 }, 'the rest frame\'s own box: its corner on the canvas\'s');
  assert.deepEqual(set.tips, [[38, 37], [0, 0], [11, 30], [29, 45], [53, 50]], 'the point of each - the chamber\'s at its canvas\'s corner');
  for (const c of set.cells) for (let p = 3; p < c.data.length; p += 4) assert.ok(c.data[p] === 0 || c.data[p] === 255);
});

test('SPEAR-LAB the arms go on past the cut: the owner\'s pixels untouched, every new texel an edge texel\'s, the rear arm down and out', () => {
  for (const [i, c] of set.cells.entries()) {
    const b = set.bled[i], [ox] = b.origin;
    const edge = new Set();
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const s = (y * c.width + x) * 4, d = (y * b.width + x + ox) * 4;
      assert.deepEqual([...b.data.slice(d, d + 4)], [...c.data.slice(s, s + 4)], `pose ${i} texel ${x},${y}`);
      if ((y === c.height - 1 || x === 0 || x === c.width - 1) && c.data[s + 3]) edge.add(c.data.slice(s, s + 3).join());
    }
    let added = 0;
    for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
      if (x >= ox && x < ox + c.width && y < c.height) continue;
      const d = (y * b.width + x) * 4;
      if (!b.data[d + 3]) continue;
      added++;
      assert.ok(edge.has(b.data.slice(d, d + 3).join()), `pose ${i}: a new texel at ${x},${y} is no edge texel's colour`);
    }
    assert.ok(added > 2000, `pose ${i} carries its arms on (${added} texels)`);
  }
  assert.equal(rearLean([0, 1]), REAR_LEAN, 'a cuff read straight down is carried at the least lean');
  assert.deepEqual(rearLean([0.8, 0.6]), [0.8, 0.6], 'one read further out keeps its own');
  const rest = set.cells[SPEAR_POSE.rest], runs = edgeRuns((x) => rest.data[((rest.height - 1) * rest.width + x) * 4 + 3] >= 128, rest.width);
  assert.deepEqual(runs, [[43, 91], [149, 186]], 'at rest, the sleeve and the rear cuff');
  assert.ok(runs[0][1] < rest.width - 1 - REAR_REACH && runs[1][1] >= rest.width - 1 - REAR_REACH, 'the sleeve is the front arm, the cuff the rear');
  const k = runLean(runs[0], (line, x) => rest.data[((rest.height - 1 - line) * rest.width + x) * 4 + 3] >= 128, rest.width);
  assert.ok(k < -0.5, `the sleeve goes on down and to the LEFT (${k.toFixed(2)} a row)`);
});

/** Where an arm ENDS in a bled picture: an opaque texel on its own border, or on the owner's canvas's cut edge (its
 *  right column, bottom row or left column) with nothing past it within three texels along the edge - an arm leaving
 *  on a lean goes on beside it, not straight out (LEAN_MAX 2.5). Each, on the surface, under every frame: a cut that
 *  shows. */
const cutsShown = (bleed, slack) => {
  const bled = set.cells.map((c) => bleedArms(c, bleed));
  const shown = [];
  for (const [key, s] of Object.entries(SPEAR_STRIKES)) [SPEAR_IDLE, ...s.frames].forEach((f, k) => {
    const b = bled[SPEAR_POSE[f.pose]], { width: W, height: H, data } = b, [ox] = b.origin, w = SPEAR_STRIP.cellW, h = SPEAR_STRIP.cellH;
    const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] >= 128;
    const ends = [...Array.from({ length: W }, (_, x) => [x, H - 1]), ...Array.from({ length: H }, (_, y) => [0, y]), ...Array.from({ length: H }, (_, y) => [W - 1, y])];
    const past = (x, y, dx, dy) => [-3, -2, -1, 0, 1, 2, 3].some((j) => on(x + dx + (dx ? 0 : j), y + dy + (dy ? 0 : j)));
    // the left edge cuts an arm only low down (the chamber's sleeve); at its top it touches the chamber's point
    for (let y = 0; y < h; y++) { if (!past(ox + w - 1, y, 1, 0)) ends.push([ox + w - 1, y]); if (y > h / 2 && !past(ox, y, -1, 0)) ends.push([ox, y]); }
    for (let x = 0; x < w; x++) if (!past(ox + x, h - 1, 0, 1)) ends.push([ox + x, h - 1]);
    for (const [x, y] of ends) {
      if (!on(x, y)) continue;
      const [sx, sy] = surfacePoint([x - b.origin[0], y - b.origin[1]], f, s.pivot, b);
      if (sx > -slack && sx < 320 + slack && sy > -slack && sy < 200 + slack) { shown.push(`${key} ${k - 1}`); break; }
    }
  });
  return shown;
};

test('SPEAR-LAB THE CUT NEVER SHOWS: on every strike frame the arms\' far ends stay 24 texels off the screen - and a short bleed would show them', () => {
  assert.deepEqual(SPEAR_BLEED, { side: 96, bottom: 96 });
  assert.deepEqual(cutsShown(SPEAR_BLEED, 24), []);
  assert.ok(cutsShown({ side: 0, bottom: 0 }, 0).length > 10, 'unbled, the cuts are on the screen at rest and in the blows');
  assert.deepEqual(cutsShown({ side: 80, bottom: 80 }, 24), [], 'the measured floor the record names');
  assert.ok(cutsShown({ side: 64, bottom: 48 }, 16).length > 0, 'the bleed is what hides them');
});

test('SPEAR-LAB at rest the idle IS the owner\'s rest frame, texel for texel, its corner on the screen\'s', () => {
  const { img } = drawn().idle, rest = set.cells[SPEAR_POSE.rest];
  assert.deepEqual(SPEAR_REST_AT, [133, 11]);
  for (let y = 0; y < rest.height; y++) for (let x = 0; x < rest.width; x++) {
    const s = (y * rest.width + x) * 4, d = ((SPEAR_STAGE.y + SPEAR_REST_AT[1] + y) * SPEAR_STAGE.w + SPEAR_STAGE.x + SPEAR_REST_AT[0] + x) * 4;
    if (rest.data[s + 3]) assert.deepEqual([...img.data.slice(d, d + 4)], [...rest.data.slice(s, s + 4)], `${x},${y}`);
  }
});

test('SPEAR-LAB no colour that is not the owner\'s: every texel of every strike frame, smeared or not', () => {
  const own = new Set();
  for (let p = 0; p < strip.data.length; p += 4) if (strip.data[p + 3] >= 128) own.add((strip.data[p] << 16) | (strip.data[p + 1] << 8) | strip.data[p + 2]);
  const d = drawn();
  for (const f of [d.idle, ...KEYS.flatMap((k) => d[k])]) {
    for (const img of [f.img, f.smeared].filter(Boolean)) {
      for (let p = 0; p < img.data.length; p += 4) {
        if (!img.data[p + 3]) continue;
        assert.equal(img.data[p + 3], 255);
        assert.ok(own.has((img.data[p] << 16) | (img.data[p + 1] << 8) | img.data[p + 2]), 'a colour of the strip\'s');
      }
    }
  }
});

test('SPEAR-LAB the strikes: left sweeps right to left across the aim, right the other way, the thrust lands on the crosshair; each ends at rest', () => {
  const d = drawn(), rest = d.idle.tip;
  assert.deepEqual(KEYS, ['left', 'right', 'thrust']);
  assert.deepEqual(KEYS.map((k) => [SPEAR_STRIKES[k].frames.length, SPEAR_STRIKES[k].hit]), [[12, 5], [12, 5], [11, 5]]);
  for (const k of KEYS) {
    const tips = d[k].map((f) => f.tip), hit = SPEAR_STRIKES[k].hit;
    assert.ok(dist(tips.at(-1), rest) < 15, `${k} ends near rest, so the idle does not jump`);
    assert.ok(dist(tips[0], rest) < 70, `${k} begins from rest`);
    assert.ok(dist(tips[hit], SPEAR_AIM) < (k === 'thrust' ? 8 : 36), `${k}'s hit lands at the aim (${tips[hit].map(Math.round)})`);
    for (let i = 1; i < tips.length; i++) assert.ok(dist(tips[i], tips[i - 1]) < 60, `${k} ${i}: no frame jumps`);
  }
  const xs = (k) => d[k].map((f) => f.tip[0]);
  // the wind-up's top (frames 1-3: frame 0 is the chamber pose, whose point the owner drew further left) against the
  // follow-through
  assert.ok(Math.min(...xs('left').slice(1, 4)) > SPEAR_AIM[0] && Math.max(...xs('left').slice(6, 10)) < SPEAR_AIM[0], 'left: from the right of the aim to its left');
  assert.ok(Math.max(...xs('right').slice(0, 5)) < SPEAR_AIM[0] && Math.min(...xs('right').slice(6, 10)) > SPEAR_AIM[0], 'right: from the left of the aim to its right');
  assert.ok(d.thrust[2].tip[1] < 30 && d.thrust[SPEAR_STRIKES.thrust.hit].tip[1] > 90, 'thrust: drawn back high, then driven down the line to the aim');
});

test('SPEAR-LAB the smear: on the fastest frames only, the head alone, every other texel, behind the frame', () => {
  const d = drawn();
  for (const k of KEYS) {
    const hit = SPEAR_STRIKES[k].hit;
    SPEAR_STRIKES[k].frames.forEach((f, i) => {
      assert.equal(!!d[k][i].smeared, f.smear, `${k} ${i}`);
      if (f.smear) assert.ok(Math.abs(i - hit) <= 1, `${k} ${i}: a smear sits at the blow's fastest`);
    });
    assert.equal(spearReleaseFrame(k), SPEAR_STRIKES[k].frames.findIndex((f) => f.smear));
    const f = d[k][hit], { width: W } = f.img;
    let ghosts = 0;
    for (let p = 0; p < f.img.data.length; p += 4) {
      if (f.img.data[p + 3]) { assert.deepEqual([...f.smeared.data.slice(p, p + 4)], [...f.img.data.slice(p, p + 4)], 'the frame drawn over its smear'); continue; }
      if (!f.smeared.data[p + 3]) continue;
      ghosts++;
      const X = (p / 4) % W, Y = Math.floor(p / 4 / W);
      assert.equal((X + Y) & 1, 0, 'a checkerboard - one bit of alpha has no half');
      assert.ok(dist([X - SPEAR_STAGE.x, Y - SPEAR_STAGE.y], f.tip) < 140, 'near the head, not the hands');
    }
    assert.ok(ghosts > 40, `${k}'s hit frame has a smear (${ghosts})`);
  }
  assert.deepEqual([SMEAR_GHOSTS, HEAD_REACH], [2, 70]);
});

test('SPEAR-LAB three blows for six strikes: a sideways drag sweeps that way (its low diagonal too), up or down thrusts', () => {
  assert.deepEqual(SPEAR_STRIKE_OF, {
    StrikeLeft: 'left', StrikeDownLeft: 'left', StrikeRight: 'right', StrikeDownRight: 'right', StrikeUp: 'thrust', StrikeDown: 'thrust',
  });
  assert.deepEqual(SPEAR_NUM_FRAMES, { Idle: 1, StrikeDown: 11, StrikeDownLeft: 12, StrikeLeft: 12, StrikeRight: 12, StrikeDownRight: 12, StrikeUp: 11 });
});

test('SPEAR-LAB the swing law\'s time: a frame is the law\'s classic frame for 4 kg in two hands, the blow five of them', () => {
  assert.deepEqual(SPEAR_ITEM, { minDamage: 2, maxDamage: 15, weightKg: 4, price: 60, skill: 'Axe', twoHanded: true });
  assert.equal(SPEAR_HANDLING_OF, 2, 'the Staff\'s handling');
  for (const [speed, strength] of [[50, 50], [90, 30], [20, 100]]) {
    const classic = STATES.swingFrameSeconds(speed, { heft: STATES.swingHeft(4, strength), handling: STATES.swingHandling(2, true) });
    for (const st of ['StrikeLeft', 'StrikeUp']) {
      const t = spearFrameSeconds(st, { speed, strength });
      assert.ok(Math.abs(t * SPEAR_NUM_FRAMES[st] - classic * 5) < 1e-12, `${st} at ${speed}/${strength}`);
    }
  }
});

test('SPEAR-LAB the game\'s machine plays each strike: every frame once, the hit once on the table\'s frame, in the law\'s time; one blow at a time', () => {
  for (const st of Object.keys(SPEAR_STRIKE_OF)) {
    const m = createSpearMachine(), key = SPEAR_STRIKE_OF[st];
    assert.ok(spearAttack(m, st));
    assert.ok(!spearAttack(m, 'StrikeRight'), 'a blow in the air cannot be replaced');
    const seen = [m.frame], hits = [];
    let t = 0, done = false;
    while (!done && t < 5) {
      const ev = spearStep(m, 1 / 240);
      t += 1 / 240;
      if (ev.includes('hit')) hits.push(m.frame);
      if (ev.includes('done')) done = true;
      else if (seen.at(-1) !== m.frame) seen.push(m.frame);
      const fake = { idle: { img: 'idle' }, [key]: SPEAR_STRIKES[key].frames.map((_, i) => ({ img: i })) };
      assert.equal(spearFrameOf(fake, m).img, m.state === 'Idle' ? 'idle' : m.frame, 'the picture is the machine\'s frame');
    }
    assert.ok(done && m.state === 'Idle');
    assert.deepEqual(seen, Array.from({ length: SPEAR_STRIKES[key].frames.length }, (_, i) => i), st);
    assert.deepEqual(hits, [SPEAR_STRIKES[key].hit], st);
    assert.ok(Math.abs(t - spearFrameSeconds(st) * SPEAR_NUM_FRAMES[st]) < 2 / 240, `${st} took ${t.toFixed(3)} s`);
  }
  assert.ok(!spearAttack(createSpearMachine(), 'Idle'), 'Idle is no blow');
});

test('SPEAR-LAB the drag answers what the game\'s PlayerWeapon answers for the same drags', () => {
  // the last three bend: the TRAIL crosses the threshold (6.4 px of 1280) while the summed motion has not
  const drags = [[[-30, 0]], [[30, 2]], [[0, -30]], [[0, 30]], [[-25, 20]], [[25, 20]], [[3, -1], [3, -1]], [[-60, 0], [50, 0]], [[20, -40]],
    [[4, 0], [-4, 0], [4, 0]], [[0, -4], [0, 3], [1, -2]], [[-5, 0], [3, 1]]];
  const dim = 1280;
  for (const path of drags) {
    const pw = new PlayerWeapon({ weapon: null });
    const g = createSpearGesture();
    let game = null, lab = null;
    for (const [dx, dy] of path) {
      game ??= pw.gesture(dx, dy, true, 1 / 60, dim, { attackThreshold: 0.005, swingMode: 0 });
      lab ??= spearGestureStep(g, dx, dy, 1 / 60, true, dim, 0.005);
    }
    assert.equal(lab, game, JSON.stringify(path));
  }
  const g = createSpearGesture();
  assert.equal(spearGestureStep(g, 40, 0, 0.016, false, dim), null, 'nothing without the button held');
});

test('SPEAR-LAB placement: the owner\'s rest frame at FPSWeapon\'s rect, native size, its corner on the view\'s; the stage around it', () => {
  const canvas = { width: 1280, height: 800 };
  const { rect, anchorRect } = spearPageRect(createGunRig(), set, canvas);
  assert.deepEqual(stageAnchor(set), { x: 64 + 133 + 38, y: 48 + 11 + 37, w: 149, h: 152 });
  assert.ok(Math.abs(anchorRect.w - 149 * 4) < 1e-9 && Math.abs(anchorRect.x + anchorRect.w - 1280) < 1e-9 && Math.abs(anchorRect.y + anchorRect.h - 800) < 1e-9);
  assert.ok(Math.abs(rect.w - SPEAR_STAGE.w * 4) < 1e-9 && Math.abs(rect.x + 64 * 4) < 1e-9 && Math.abs(rect.y + 48 * 4) < 1e-9, 'the screen is the stage\'s 320x200');
  assert.deepEqual(spearScreenPoint(rect, SPEAR_AIM).map((v) => Math.round(v)), [640, 400], 'the aim at the view\'s middle');
  const big = spearPageRect(createGunRig(), set, canvas, { scale: 1.5 });
  assert.ok(Math.abs(big.anchorRect.w - 149 * 6) < 1e-9 && Math.abs(big.anchorRect.x + big.anchorRect.w - 1280) < 1e-9, 'size scales about the corner');
});

test('SPEAR-LAB 2 the panel opens on the owner\'s numbers, and every control on the page has an opening value', () => {
  assert.deepEqual(SPEAR_OPENING, { scale: 0.95, offset: 0, raise: -12, speed: 52, strength: 100, smear: false });
  const state = spearPageState();
  for (const [k, v] of Object.entries(SPEAR_OPENING)) assert.equal(state[k], v, k);
  const controls = JSON.parse(page().match(/const CONTROLS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.ok(controls.length > 15);
  for (const id of controls) {
    assert.ok(id in state, `the page's ${id} has no opening value - it would open at the markup's guess`);
    assert.match(page(), new RegExp(`id="${id}"`), `the page has a control ${id}`);
  }
  assert.deepEqual([state.sfxOn, state.sfxVol], [true, 0.7], 'the swing is heard');
});

test('SPEAR-LAB a scrubbed frame and a played one are the same picture; the swing\'s voice is ours', () => {
  const d = drawn();
  for (const k of KEYS) {
    assert.equal(spearScrubFrame(d, k, 5, false).img, d[k][5].img);
    assert.equal(spearScrubFrame(d, k, SPEAR_STRIKES[k].hit, true).img, d[k][SPEAR_STRIKES[k].hit].smeared);
    assert.equal(spearScrubFrame(d, k, 99).tip, d[k].at(-1).tip, 'past the end holds the last');
  }
  const sources = readFileSync('public/sfx/SOURCES.md', 'utf8');
  for (const name of SPEAR_SWING_SFX) assert.match(sources, new RegExp(`\\| \`${name}\\.wav\` \\|[^\\n]*\\| ours \\|`));
});

test('SPEAR-LAB drawTurned with no turn copies the source texel for texel (the composer\'s sampling has no drift)', () => {
  const src = set.cells[SPEAR_POSE.full];
  const out = drawTurned({ width: src.width, height: src.height, data: new Uint8ClampedArray(src.data.length) }, rotSpriteUp(src));
  for (let p = 0; p < src.data.length; p += 4) if (src.data[p + 3]) assert.deepEqual([...out.data.slice(p, p + 4)], [...src.data.slice(p, p + 4)]);
  assert.deepEqual([...cutCell(strip, 4, 128, SPEAR_STRIP).data], [...src.data], 'the cell is cutCell\'s, on the spear\'s layout');
  const soft = { width: 2, height: 1, data: new Uint8ClampedArray([9, 9, 9, 100, 7, 7, 7, 255]) };
  const two = drawTurned({ width: 2, height: 1, data: new Uint8ClampedArray(8) }, rotSpriteUp(soft));
  assert.deepEqual([...two.data], [0, 0, 0, 0, 7, 7, 7, 255], 'a texel under half alpha is not drawn; one over is, whole');
});

test('SPEAR-LAB the picture and its point agree: every frame is drawn where its point is said to be', () => {
  const d = drawn();
  for (const f of [d.idle, ...KEYS.flatMap((k) => d[k])]) {
    const X = Math.round(f.tip[0] + SPEAR_STAGE.x), Y = Math.round(f.tip[1] + SPEAR_STAGE.y);
    let near = false;
    for (let y = Y - 2; y <= Y + 2 && !near; y++) for (let x = X - 2; x <= X + 2; x++) if (f.img.data[(y * SPEAR_STAGE.w + x) * 4 + 3]) { near = true; break; }
    assert.ok(near, `the head drawn at ${f.tip.map(Math.round)}`);
  }
});
