// TACT1 - COVER (bible/12-Enhanced-AI/Tactics-Arc.md; Mac, 2026-10-02: "Proper line of sight with billboard props";
// his call: billboards block "Sight and missiles"). With the Enhanced AI switch on, every solid flat - a tree, a rock,
// a crate, a statue - stands an upright cylinder of cover beside the collider: a foe's sight ray, its clear shot, a
// witness's eye and every missile stop at it. Walking is unchanged (the cover is never in the collider), and with the
// switch off nothing reads it.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createCoverIndex, rayCylinder, isCoverFlat, coverProxy, coverDistance, standCover,
  COVER_MIN_H, COVER_MIN_W, COVER_RADIUS_FRAC, COVER_HEIGHT_FRAC, NOT_COVER_ARCHIVES, COVER_CELL,
} from '../../src/ai/cover.js';
import { Collider } from '../../src/player/collider.js';
import { canSeeTarget, EnemyAI } from '../../src/characters/enemy/enemyMotor.js';
import { ArrowFlight } from '../../src/combat/arrowFlight.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const TREE = { w: 3, h: 5 };
const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
/** Open ground with one tree standing at (0, 0, 5), and the switch as asked. */
function field(on = true, at = [0, 0, 5]) {
  const c = new Collider(() => 0);
  c.cover = createCoverIndex({ enabled: () => on });
  c.cover.add('k', [coverProxy(at, TREE)]);
  return c;
}

// ── the law of one proxy ────────────────────────────────────────────

test('TACT1: what is cover - a flat as tall and as wide as the floors, never an editor marker, an animal, a light or treasure', () => {
  assert.equal(isCoverFlat(504, 12, { w: COVER_MIN_W, h: COVER_MIN_H }), true, 'the floors themselves are cover');
  assert.equal(isCoverFlat(504, 12, { w: COVER_MIN_W - 0.01, h: 3 }), false, 'a pole');
  assert.equal(isCoverFlat(504, 12, { w: 2, h: COVER_MIN_H - 0.01 }), false, 'grass, a bush, a bottle');
  for (const a of [199, 201, 210, 216]) {
    assert.ok(NOT_COVER_ARCHIVES.has(a));
    assert.equal(isCoverFlat(a, 0, { w: 3, h: 3 }), false, `archive ${a}`);
  }
  assert.equal(isCoverFlat(205, 0, { w: 1, h: 1.3 }), true, 'a stack of crates');
  assert.equal(isCoverFlat(205, 0, null), false);
  const p = coverProxy([1, 2, 3], TREE);
  assert.equal(p.r, TREE.w * COVER_RADIUS_FRAC);
  assert.equal(p.h, TREE.h * COVER_HEIGHT_FRAC);
});

test('TACT1: rayCylinder - the side, the caps, a miss over the top, the reach, and a ray that starts inside is never stopped by its own', () => {
  const cyl = { c: [0, 0, 5], r: 1, h: 4 };
  assert.ok(Math.abs(rayCylinder([0, 1, 0], [0, 0, 1], cyl, 20) - 4) < 1e-9, 'the near side at z = 4');
  assert.equal(rayCylinder([0, 1, 0], [0, 0, 1], cyl, 3.9), Infinity, 'short of it');
  assert.equal(rayCylinder([0, 5, 0], [0, 0, 1], cyl, 20), Infinity, 'over the crown');
  assert.equal(rayCylinder([0, -1, 0], [0, 0, 1], cyl, 20), Infinity, 'under its foot');
  assert.equal(rayCylinder([2, 1, 0], [0, 0, 1], cyl, 20), Infinity, 'beside it');
  assert.equal(rayCylinder([0, 1, 10], [0, 0, 1], cyl, 20), Infinity, 'behind the ray');
  const down = unit([0, -1, 1]);
  const s = rayCylinder([0, 8, 0.5], down, cyl, 20);
  assert.ok(Number.isFinite(s), 'a ray from above into the crown, through the top cap');
  assert.ok(Math.abs(0.5 + down[2] * s - 4.5) < 1e-6 && Math.abs(8 + down[1] * s - 4) < 1e-6, 'meets the top at y = 4');
  assert.equal(rayCylinder([0, 1, 5], [0, 0, 1], cyl, 20), Infinity, 'from inside: not its own cover');
  assert.equal(rayCylinder([0, 1, 5], [0, -1, 0], cyl, 20), Infinity, '...not through its own floor either');
  assert.equal(rayCylinder([0.5, 2, 5], unit([0, 1, 0.1]), cyl, 20), Infinity, '...nor out of its own crown');
  assert.equal(rayCylinder([0, 1, 0], [0, 1, 0], cyl, 20), Infinity, 'straight up beside it');
});

// ── the index ───────────────────────────────────────────────────────

test('TACT1: the index answers the nearest proxy, across cells, each once; a set moves with its frame; a felled tree sinks its cover', () => {
  const idx = createCoverIndex();
  const far = [0, 0, 30], near = [0, 0, 10];
  assert.equal(idx.add('a', [coverProxy(far, TREE), coverProxy(near, TREE)]), 2);
  assert.equal(idx.add('a', [{ c: [5, 0, 5], r: 0, h: 2 }, null]), 2, 'a degenerate proxy is not stood');
  const d = idx.hit([0, 1, 0], [0, 0, 1], 100);
  assert.ok(Math.abs(d - (10 - TREE.w * COVER_RADIUS_FRAC)) < 1e-9, `the near one (${d})`);
  assert.ok(Math.abs(idx.hit([0, 1, 20], [0, 0, 1], 100) - (30 - 20 - TREE.w * COVER_RADIUS_FRAC)) < 1e-9, 'many cells along: the far one');
  assert.equal(idx.hit([0, 1, 0], [0, 0, -1], 100), Infinity, 'the other way: nothing');
  assert.equal(idx.hit([0, 1, 0], [0, 0, 1], 0), Infinity);
  const one = createCoverIndex();
  one.add('c', [{ c: [0, 0, 7], r: 0.5, h: 3 }, { c: [0, 0, 5], r: 0.5, h: 3 }]);   // one cell, the far one filed first
  assert.ok(Math.abs(one.hit([0, 1, 0], [0, 0, 1], 20) - 4.5) < 1e-9, 'the nearest, not the first filed');
  // a set in a moving frame (a streamed pixel's) - the ray is taken into it
  const off = [100, 0, 0];
  idx.add('b', [coverProxy([0, 0, 5], TREE)], () => off);
  assert.ok(Number.isFinite(idx.hit([100, 1, 0], [0, 0, 1], 8)), 'found at its frame\'s place');
  off[0] = 200;
  assert.equal(idx.hit([100, 1, 0], [0, 0, 1], 8), Infinity, 'the frame moved: gone from the old place');
  assert.ok(Number.isFinite(idx.hit([200, 1, 0], [0, 0, 1], 8)), '...and found at the new');
  // Logging's felled tree is sunk in its batch - the centre is the batch's own array
  near[1] = -10;
  assert.ok(Math.abs(idx.hit([0, 1, 0], [0, 0, 1], 100) - (30 - TREE.w * COVER_RADIUS_FRAC)) < 1e-9, 'the felled one no longer stands');
  assert.equal(idx.size(), 3);
  idx.remove('a');
  assert.equal(idx.has('a'), false);
  assert.equal(idx.hit([0, 1, 0], [0, 0, 1], 100), Infinity);
  assert.ok(COVER_CELL > 0);
});

test('TACT1: the cover rides its collider - gone with its bucket, read only with the switch on, nothing without one', () => {
  const c = new Collider(() => 0);
  assert.equal(c.cover, null);
  assert.equal(coverDistance(c, [0, 1, 0], [0, 0, 1], 20), Infinity, 'no index: nothing');
  let on = true;
  c.cover = createCoverIndex({ enabled: () => on });
  c.cover.add('pixel:3:4', [coverProxy([0, 0, 5], TREE)]);
  assert.ok(Number.isFinite(coverDistance(c, [0, 1, 0], [0, 0, 1], 20)));
  on = false;
  assert.equal(coverDistance(c, [0, 1, 0], [0, 0, 1], 20), Infinity, 'the switch off: DFU sees through every flat');
  on = true;
  c.removeBucket('pixel:3:4');
  assert.equal(coverDistance(c, [0, 1, 0], [0, 0, 1], 20), Infinity, 'the pixel left, and its cover with it');
  // walking never meets it: the capsule walks through the trunk's place
  const feet = [0, 0, 0];
  c.cover.add('k', [coverProxy([0, 0, 2], TREE)]);
  c.move(feet, 0, 0, 4, 1.8, true);
  assert.ok(Math.abs(feet[2] - 4) < 1e-6, `walked through (${feet[2]})`);
  assert.equal(c.raycast([0, 1, 0], [0, 0, 1], 20), Infinity, 'and the collider\'s own ray never meets it');
});

test('TACT1: standCover stands a host\'s flat groups - the solid ones, by their drawn size', () => {
  const c = new Collider(() => 0);
  assert.equal(standCover(c, 'x', new Map(), () => TREE), 0, 'no index: nothing');
  c.cover = createCoverIndex();
  const groups = new Map([['504_12', [[0, 0, 5], [0, 0, 9]]], ['504_1', [[3, 0, 3]]], ['210_0', [[0, 0, 2]]]]);
  const sizes = { '504_12': TREE, '504_1': { w: 0.4, h: 0.4 }, '210_0': TREE };
  assert.equal(standCover(c, 'x', groups, (a, r) => sizes[`${a}_${r}`] ?? null), 2, 'the two trees; not the grass, not the lamp');
});

// ── sight ───────────────────────────────────────────────────────────

test('TACT1: a foe does not see the player behind a tree - with the switch on; off, it sees as DFU does; in the open, and with the tree behind the player, it sees', () => {
  const eyeLevel = (c) => canSeeTarget(c, [0, 0, 0], 0, 1.8, [0, 0, 10]);
  assert.equal(eyeLevel(field(true)), false, 'the tree between');
  assert.equal(eyeLevel(field(false)), true, 'the switch off');
  assert.equal(eyeLevel(field(true, [0, 0, 14])), true, 'the tree behind him');
  assert.equal(eyeLevel(field(true, [4, 0, 5])), true, 'beside the line');
  assert.equal(canSeeTarget(field(true), [0, 0, 0], 0, 1.8, [0, 0, 3.5]), true, 'in front of the tree');
  assert.equal(canSeeTarget(field(true), [0, 0, 0], 0, 1.8, [0, 0, 4.5]), true, 'IN its crown - seen there (AUDIT TACT B2: the law is two-way, no one-way hiding place)');
  // the door-opening arm (blockerOut) answers the same, and a tree is no door
  const out = { key: null };
  assert.equal(canSeeTarget(field(true), [0, 0, 0], 0, 1.8, [0, 0, 10], 1.8, out), false);
  assert.equal(out.key, null, 'cover is never a blocker to open');
  // a short shrub: seen over it
  const c = new Collider(() => 0);
  c.cover = createCoverIndex();
  c.cover.add('k', [coverProxy([0, 0, 5], { w: 2, h: 1.3 })]);
  assert.equal(canSeeTarget(c, [0, 0, 0], 0, 1.8, [0, 0, 10]), true, 'eye to eye over a waist-high stack');
});

test('TACT1: an archer\'s clear shot - a tree in the way is no shot, the switch off it is DFU\'s', () => {
  const shot = (c) => {
    const ai = new EnemyAI(c, [0, 0, 0], 0, {});
    ai.predictNextTargetPos = () => [0, 0.9, 12];
    return ai.hasClearPathToShootProjectile(25, 1, 0.15);
  };
  assert.equal(shot(field(true)), false);
  assert.equal(shot(field(false)), true);
  assert.equal(shot(field(true, [0, 0, 16])), true, 'a tree past the target');
});

// ── missiles ────────────────────────────────────────────────────────

test('TACT1: an arrow meets the tree and is lost; the switch off, it flies through', () => {
  const fly = (c) => {
    const f = new ArrowFlight({ getGpuMesh: () => null, collider: c });
    f.fire([0, 1, 0], [0, 0, 1], { enemy: true });
    let passed = false;
    for (let i = 0; i < 60 && !f.arrows[0].dead; i++) {
      f.update(1 / 60, {});
      if (f.arrows[0].pos[2] > 6) passed = true;
    }
    return { dead: f.arrows[0].dead, passed };
  };
  const on = fly(field(true));
  assert.equal(on.passed, false, 'never past the trunk');
  assert.equal(on.dead, true, 'lost on it');
  assert.equal(fly(field(false)).passed, true, 'DFU: through the sprite');
});

// ── the hosts ───────────────────────────────────────────────────────

test('TACT1: every host stands its cover on its collider, under the switch; every missile and the witnesses read it', () => {
  const sw = /collider\.cover = createCoverIndex\(\);/;   // the default: the switch, read in ai/cover.js alone
  for (const f of ['src/scenes/world.js', 'src/scenes/dungeonContext.js', 'src/scenes/interiorContext.js', 'src/scenes/exterior.js']) assert.match(rd(f), sw, f);
  const w = hostText('src/scenes/world.js');
  assert.match(w, /collider\.cover\.remove\(key\);\n(?:\s*\/\/[^\n]*\n)*\s*const coverT = \(\(o\) => \(\) => host\.state\.pixelTranslation\(px, py, o\)\)\(\[0, 0, 0\]\);\n\s*for \(let i = 0; i < coverItems\.length; i \+= COVER_SLICE\) \{\n\s*if \(i\) await breather\.breathe\(\);\n\s*collider\.cover\.add\(key, coverItems\.slice\(i, i \+ COVER_SLICE\), coverT\);/, 'the pixel\'s, in its frame, under its bucket key - in slices on the stream\'s clock (AUDIT BANTHA1 TREE-1)');
  assert.equal((w.match(/if \(isCoverFlat\(archive, record, (?:sib\.size|size|plain)\)\) for \(const c of centers\) coverItems\.push\((?:\.\.\.coverProxies|coverProxy)\(c, (?:sib\.size|size|plain)/g) ?? []).length, 4, 'the seasonal, the classic and the scaled groups, and (LPT1) a low-poly tree\'s far pictures - at the flat\'s own size, `plain` (AUDIT LPT D3)');
  assert.match(rd('src/scenes/dungeonContext.js'), /if \(isCoverFlat\(archive, record, size\)\) for \(const c of based\) coverItems\.push\(coverProxy\(c, size\)\);\n\s*\}\n\s*collider\.cover\.add\('tact1:flats', coverItems\);/, 'the dungeon\'s, at the BASE (an RDB flat\'s y is its centre)');
  assert.match(rd('src/scenes/interiorContext.js'), /if \(isCoverFlat\(archive, record, size\)\) collider\.cover\.add\('tact1:flats', centers\.map\(\(c\) => coverProxy\(c, size\)\)\);/);
  assert.equal((rd('src/scenes/exterior.js').match(/collider\.cover\.add\('tact1:flats'/g) ?? []).length, 3);   // the seasonal, the classic and (LPT1) a low-poly tree's far pictures - the flat's own size
  for (const f of ['src/scenes/hostMagic.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(f), /const _cs = flightStop\(collider, m\.pos, _unit, reach, step \* _len\);[^\n]*\n\s*const hitWall = _cs\.stop;/, `${f}: the bolts (AUDIT TACT B5: cover met by touch) - through the one flight law (AUDIT GROUND-BOLT C6)`);
    assert.match(rd(f), /const _adv = step \* _cs\.advance;/, `${f}: no further than cover's touch`);
  }
  assert.match(rd('src/scenes/hostMagic.js'), /const cs = coverStep\(coverDistance\(collider, pos, unit, reach\), collider\.raycast\(pos, unit, reach\), reach, radius, stepLen\);/, 'flightStop: cover met by touch (AUDIT TACT B5), the wall at the reach');
  assert.equal((rd('src/scenes/cityGuards.js').match(/coverDistance\(collider, eye, dir, dist, true\) < dist - 1e-3/g) ?? []).length, 2, 'the witness and the guard who sees him - lines of sight (AUDIT TACT B2)');
  assert.match(rd('src/player/collider.js'), /this\.cover\?\.remove\(bucketKey\);/);
});
