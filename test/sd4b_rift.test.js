// SD4b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 6): A SUPER DUNGEON'S END -
// THE RIFT AND THE RETURN. The end is the enemy or start marker farthest from the entrance (world/dungeonEnd.js, RVN7d's
// lair law lifted so both read one law); the Rift - a ring of brass light about a black-gold membrane, its bell heard
// under water - stands there as wide as its hall lets it (world/sdDungeon.js), the Return of pale light beside it until
// the boss falls (scenes/sdEnd.js). Pressed or walked into: the Rift asks its own word off the hub's record (through to
// the Shattered Hour where it admits and the realm's door takes you, else its refusal); the Return carries you to the way in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dungeonEndOf } from '../src/world/dungeonEnd.js';
import {
  sdEndMarks, sdRiftFit, sdRiftPlace, sdReturnPlace, sdRiftWord, sdReturnStands, inSdPortal,
  SD_RIFT_SIZE_M, SD_RIFT_MIN_M, SD_RIFT_AIR_M, SD_RETURN_GAP_M, SD_RETURN_SIZE, SD_RIFT_REACH_M, SD_RETURN_REACH_M, SD_END_TEXT,
} from '../src/world/sdDungeon.js';
import { createSdEnd, ensureSdEndArt, SD_RIFT_KEY, SD_RETURN_KEY, SD_RIFT_PRESS_M } from '../src/scenes/sdEnd.js';
import { sdRiftArt, SD_RIFT_RECORD, SD_RIFT_ATLAS } from '../src/world/sdRiftArt.js';   // SD-LOOK: the astrolabe's art (its billboard frames retired)
import { riftCentreY } from '../src/world/sdRiftModel.js';
import { SD_REALM_ARCHIVE } from '../src/world/sdRealm.js';
import { buildRiftBell, startRiftBell, RIFT_BELL_KEY, RIFT_BELL_RATE, RIFT_BELL_SECONDS, RIFT_BELL_RMS, RIFT_BELL_RECORDS, RIFT_BELL_LOWPASS_HZ, RIFT_BELL_RANGE } from '../src/systems/sdRiftSound.js';
import { rms } from '../src/systems/arenaSound.js';
import { sdFirst, sdRise, sdFind, sdFell, sdGone, SD_COLLAPSE_MS, SD_NO_RIFT, SD_NO_CLOSED } from '../src/net/sdLaw.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../src/player/activate.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const M = 60_000, H = 3_600_000, T0 = 1_800_000_000_000;
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/** An axis-aligned hall - x in [x0, x1], z in [z0, z1], its floor at y0, its ceiling `h` above - as the collider answers
 *  it; `pits` are floors of another height inside it ({ x0, x1, z0, z1, y }) the rays never meet, `beyond` floors behind
 *  its walls (the next room's) that a ray down finds and no ray across the hall reaches. */
function hall({ x0 = 0, x1 = 10, z0 = 0, z1 = 10, y0 = 0, h = 8, pits = [], beyond = [] } = {}) {
  const inside = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  return {
    floor: (at) => {
      if (!inside(at[0], at[2])) return beyond.find((q) => at[0] >= q.x0 && at[0] <= q.x1 && at[2] >= q.z0 && at[2] <= q.z1)?.y ?? null;
      const p = pits.find((q) => at[0] >= q.x0 && at[0] <= q.x1 && at[2] >= q.z0 && at[2] <= q.z1);
      return p ? p.y : y0;
    },
    ray: (o, dir, max) => {
      let t = Infinity;
      if (dir[0] > 0) t = Math.min(t, (x1 - o[0]) / dir[0]); else if (dir[0] < 0) t = Math.min(t, (x0 - o[0]) / dir[0]);
      if (dir[2] > 0) t = Math.min(t, (z1 - o[2]) / dir[2]); else if (dir[2] < 0) t = Math.min(t, (z0 - o[2]) / dir[2]);
      if (dir[1] > 0) t = Math.min(t, (y0 + h - o[1]) / dir[1]); else if (dir[1] < 0) t = Math.min(t, (o[1] - y0) / -dir[1]);
      return t <= max ? t : null;
    },
  };
}

test('SD4b the end: the marker farthest from the entrance across the floor plan - its height never asked, the first of a tie, the first with no entrance, none with no marker; the lair\'s stand reads the same law (mutants: the nearest; the height asked; the last of a tie)', () => {
  const from = { x: 0, z: 0 };
  const a = { x: 3, y: 0, z: 4 }, b = { x: -6, y: 0, z: 8 }, c = { x: 10, y: -40, z: 0 }, d = { x: 0, y: 99, z: -10 };
  assert.equal(dungeonEndOf(from, [a, b, c]), b, 'b at 10 beats c at 10 by the list\'s order - and a at 5');
  assert.equal(dungeonEndOf(from, [a, c, b]), c, 'the first of a tie');
  assert.equal(dungeonEndOf(from, [a, d]), d, 'across the floor plan: a mark far above is no nearer');
  assert.equal(dungeonEndOf(from, [{ x: 0, y: 0, z: 99 }, { x: 0, y: 500, z: 1 }]).z, 99, 'its height never asked');
  assert.equal(dungeonEndOf(null, [a, b]), a, 'no entrance: the first');
  assert.equal(dungeonEndOf(from, []), null);
  assert.equal(dungeonEndOf(from, null), null);
  assert.equal(dungeonEndOf(from, [{ x: NaN, z: 1 }, a]), a, 'a mark without a place is none');
  // the end's candidates: the layout's enemy markers (an Elite copy left out). SD-REACH (PIN MOVED, test/sd22_reach.test.js):
  // no block's start markers beside them - those only with no enemy marker at all, placed by their block's origin
  const ends = [{ originX: 100, originZ: 200, layout: { startMarkers: [{ x: 1, y: 3, z: 1 }] } }, { originX: 0, originZ: 0, layout: {} }];
  const marks = sdEndMarks([{ x: 1, y: 0, z: 2 }, { x: 1.5, y: 0, z: 2, eliteCopy: true }, { x: NaN, y: 0, z: 0 }], ends);
  assert.deepEqual(marks, [{ x: 1, y: 0, z: 2 }]);
  assert.deepEqual(sdEndMarks([], ends), [{ x: 101, y: 3, z: 201 }]);
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /const far = dungeonEndOf\(from, marks\);/, 'RVN7d\'s lair stand');
  assert.match(D, /const end = dungeonEndOf\(dungeon\.enterMarker \?\? dungeon\.startMarker \?\? null, sdEndMarks\(_layoutEnemies, dungeon\.blocks\)\);/, 'a Super dungeon\'s end, from the same entrance');
});

test('SD4b the Rift\'s size: 7 m at most, the hall\'s own less its air, never under 2.6 m - and in a cramped corner it moves a step or two to the widest hall on the end\'s own floor (mutants: the ring never fitted; never moved; moved through a wall; moved onto another floor)', () => {
  assert.equal(sdRiftFit(20, 20), SD_RIFT_SIZE_M);
  assert.equal(sdRiftFit(5, 20), 5 - SD_RIFT_AIR_M, 'a low hall: its ceiling');
  assert.equal(sdRiftFit(20, 2), 2 * (2 - SD_RIFT_AIR_M), 'a narrow one: its nearest wall either side');
  assert.equal(sdRiftFit(1, 1), SD_RIFT_MIN_M, 'never under the least');
  assert.equal(sdRiftFit(undefined, Infinity), SD_RIFT_SIZE_M, 'an unmeasured side asks nothing');
  // a great hall: the end itself, the whole ring
  assert.deepEqual(sdRiftPlace([20, 0, 20], hall({ x1: 40, z1: 40, h: 12 })), { at: [20, 0, 20], size: 7, face: [Math.cos(Math.PI / 4), 0, Math.sin(Math.PI / 4)] });   // SD-LOOK (PIN MOVED): and its face - a square hall's longest line, its first diagonal
  // a corner: the diagonal three metres out, where its walls stand furthest
  const r = sdRiftPlace([1, 0, 1], hall());
  const s = 1 + 3 * Math.SQRT1_2;
  assert.ok(close(r.at[0], s) && close(r.at[2], s) && r.at[1] === 0, JSON.stringify(r));
  assert.ok(close(r.size, 2 * (s - SD_RIFT_AIR_M)), String(r.size));
  // ...never onto another floor: a pit where it would stand, and the nearer diagonal takes it
  const p = sdRiftPlace([1, 0, 1], hall({ pits: [{ x0: 2.5, x1: 4, z0: 2.5, z1: 4, y: -3 }] }));
  const n = 1 + 1.5 * Math.SQRT1_2;
  assert.ok(close(p.at[0], n) && close(p.at[2], n), JSON.stringify(p));
  // ...never through a wall: every spot it takes is inside the hall it stands in
  for (const foot of [[0.5, 0, 0.5], [9.5, 0, 0.5], [5, 0, 9.6], [0.4, 0, 5]]) {
    const q = sdRiftPlace(foot, hall());
    assert.ok(q.at[0] >= 0 && q.at[0] <= 10 && q.at[2] >= 0 && q.at[2] <= 10, JSON.stringify(q));
    assert.ok(q.size >= SD_RIFT_MIN_M && q.size <= SD_RIFT_SIZE_M);
  }
  // the same answer every time - every client's collider is the same
  assert.deepEqual(sdRiftPlace([1, 0, 1], hall()), r);
});

test('SD4b the Return stands beside the Rift - past its rim on the first clear bearing, east first; nearer in a tight hall; on the ring\'s foot with nowhere else (mutants: inside the ring; through a wall)', () => {
  const big = hall({ x1: 40, z1: 40, h: 12 });
  assert.deepEqual(sdReturnPlace({ at: [20, 0, 20], size: 7 }, big), [20 + 3.5 + SD_RETURN_GAP_M, 0, 20]);
  // its east is a wall, and its north-east: the next bearing round - north
  const w = sdReturnPlace({ at: [38, 0, 20], size: 7 }, big);
  assert.ok(close(w[0], 38) && w[1] === 0 && close(w[2], 20 + 3.5 + SD_RETURN_GAP_M), JSON.stringify(w));
  // a closet: a metre and a half out, on the diagonal its walls allow
  const c = sdReturnPlace({ at: [1.5, 0, 1.5], size: 2.6 }, hall({ x1: 3, z1: 3 }));
  assert.ok(close(c[0], 1.5 + 1.5 * Math.SQRT1_2) && close(c[2], 1.5 + 1.5 * Math.SQRT1_2), JSON.stringify(c));
  assert.deepEqual(sdReturnPlace({ at: [1, 0, 1], size: 2.6 }, hall({ x1: 2, z1: 2 })), [1, 0, 1], 'nowhere beside it: its foot');
  // the next room's floor stands at the same height behind the wall east of it: never through the wall
  const next = hall({ beyond: [{ x0: 10, x1: 30, z0: 0, z1: 10, y: 0 }] });
  const t = sdReturnPlace({ at: [8, 0, 5], size: 2.6 }, next);
  assert.ok(t[0] <= 10, `not in the next room: ${JSON.stringify(t)}`);
  const q = sdRiftPlace([9.5, 0, 5], next);
  assert.ok(q.at[0] <= 10, `nor the Rift: ${JSON.stringify(q)}`);
});

test('SD4b the Rift\'s word: not yet found - "will not take you yet"; found - through; after the kill only one who went in before; gone, or another slot - "The Hour has closed"; no record heard - not yet. The Return stands until the boss falls (mutants: a newcomer through after the kill; the Return after the kill; through before the find)', () => {
  const r = sdRise(sdFirst(T0 - 3 * H), T0 - 10 * M, 0);
  const s = r.s;
  assert.equal(sdRiftWord(r, s, T0), SD_NO_RIFT);
  assert.equal(sdReturnStands(r, s, T0), true);
  const f = sdFind(r, T0, 'Mara');
  assert.equal(sdRiftWord(f, s, T0 + M), null);
  assert.equal(sdReturnStands(f, s, T0 + M), true);
  const k = sdFell(f, T0 + H, { top: 'Mara', n: 3 });
  assert.equal(sdRiftWord(k, s, T0 + H + M), SD_NO_CLOSED, 'a newcomer after the kill');
  assert.equal(sdRiftWord(k, s, T0 + H + M, { entered: true }), null, 'one who went in before, for the spoils');
  assert.equal(sdReturnStands(k, s, T0 + H + M), false, 'it goes out with the kill');
  const g = sdGone(k, T0 + H + SD_COLLAPSE_MS);
  assert.equal(sdRiftWord(g, s, T0 + H + SD_COLLAPSE_MS, { entered: true }), SD_NO_CLOSED);
  assert.equal(sdReturnStands(g, s, T0 + H + SD_COLLAPSE_MS), false);
  assert.equal(sdRiftWord(f, s + 1, T0 + M), SD_NO_CLOSED, 'another slot\'s record: this Hour is over');
  assert.equal(sdReturnStands(f, s + 1, T0 + M), false);
  assert.equal(sdRiftWord(null, s, T0), SD_NO_RIFT, 'nothing heard: not yet');
  assert.equal(sdReturnStands(null, s, T0), true, 'nothing says it fell');
  assert.equal(sdRiftWord(f, s, f.until + 1), SD_NO_CLOSED, 'faded unbeaten');
  assert.deepEqual(SD_END_TEXT, { rift: 'The Rift', riftTo: 'To the Shattered Hour', ret: 'The Return', retTo: 'To the way in' });
});

test('SD4b the art - SD-LOOK (PIN MOVED: the billboard frames retired for the astrolabe): one atlas painted three times - lit (its numerals\' bevels and the blocks\' gap lips alight in gold), cold (darker, no light of its own) and red (a crack across, alight) - every numeral face its glyph; uploaded once a renderer, as albedo and as its own emission, with the realm\'s records it wears beside it (a Hollow is no realm) (mutants: the cold record alight)', () => {
  const art = sdRiftArt(), S = SD_RIFT_ATLAS.size;
  assert.deepEqual(art.map(([r]) => r), [SD_RIFT_RECORD.lit, SD_RIFT_RECORD.cold, SD_RIFT_RECORD.red]);
  for (const [, a] of art) assert.ok(a.albedo.width === S && a.emission.width === S && a.albedo.colors.length === S * S * 4);
  const lit = (img, [x0, y0, w, h]) => { let n = 0; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (img.colors[(y * S + x) * 4] > 0) n++; return n; };
  for (let i = 0; i < 12; i++) assert.ok(lit(art[0][1].emission, SD_RIFT_ATLAS[`n${i}`]) > 20, `numeral ${i}: its glyph alight`);
  assert.equal(lit(art[1][1].emission, [0, 0, S, S]), 0, 'cold: no light of its own');
  assert.ok(lit(art[2][1].emission, SD_RIFT_ATLAS.leaf) > 10, 'red: the crack across the leaves alight');
  const red = art[2][1].emission.colors, at = red.findIndex((v, k) => k % 4 === 0 && v > 0);
  assert.ok(red[at] > 2 * red[at + 2], 'and red');
  const up = [], em = [];
  const rr = { uploadTexture: (a, k) => up.push(`${a}/${k}`), uploadEmissionTexture: (a, k, c32, o) => em.push(`${a}/${k}/${o?.white}`) };
  ensureSdEndArt(rr); ensureSdEndArt(rr);
  assert.equal(up.length, 7, 'its three records and the four of the realm\'s it wears');
  assert.equal(em.length, 7);
  assert.ok(up.every((u) => u.startsWith(`${SD_REALM_ARCHIVE}/`)) && em.every((e) => e.endsWith('/true')));
});

/** A renderer and an engine that only keep what was asked of them. */
function fakes({ archive = true } = {}) {
  const r = { made: [], freed: [] };
  r.uploadTexture = () => {}; r.uploadEmissionTexture = () => {};
  r.createMesh = (m) => { const g = { m }; r.made.push(g); return g; };   // SD-LOOK (PIN MOVED): meshes, not batches
  r.destroyMesh = (g) => r.freed.push(g);
  const bell = new Float32Array(6000).map((_, i) => Math.sin(i / 2.3) * Math.exp(-i / 2500));
  const a = {
    reg: [], loops: [],
    samplesOf: (i) => (!archive ? null : i === RIFT_BELL_RECORDS.bell ? bell : i === RIFT_BELL_RECORDS.bubbles ? new Float32Array(900).map((_, k) => Math.sin(k)) : null),
    registerSamples(key, x, rate) { this.reg.push({ key, n: x.length, rate }); return true; },
    loop3d(key, at, vol, o) { const h = { key, at, vol, o, stopped: false, stop() { this.stopped = true; } }; this.loops.push(h); return h; },
  };
  return { r, a };
}

test('SD4b the Rift and the Return stood: two batches at their feet, the ring its size, the bell looped at the ring\'s middle through the engine\'s low-pass; their keys in the ray at a door\'s reach and their names on the plaque; gone with the dungeon (mutants: the bell unrung; the Return\'s box the Rift\'s)', () => {
  const { r, a } = fakes();
  const end = createSdEnd({ renderer: r, audio: a });
  const draws = [];
  assert.ok(end.stand({ rift: { at: [10, 0, 5], size: 6 }, retAt: [15, 0, 5], dynamicDraws: draws }));
  assert.equal(end.stand({ rift: { at: [0, 0, 0], size: 3 }, retAt: null }), false, 'once');
  // SD-LOOK (PIN MOVED): its parts among the draws - the static part (the one that casts) stood at its foot, every part
  // that turns about its centre, a hand's breadth over the floor; the Return's arch at its own
  assert.equal(draws.length, r.made.length);
  const casts = draws.filter((d) => !d.noShadow);
  assert.deepEqual(casts.map((d) => [...d.object.matrix.slice(12, 15)]), [[10, 0, 5], [15, 0, 5]], 'the crater and the Return\'s arch cast, at their feet - nothing that turns does');
  const turned = draws.filter((d) => d.noShadow && Math.abs(d.object.matrix[13] - riftCentreY(6)) < 1e-6);
  assert.ok(turned.length >= 3, 'the gear, the hour-ring and the iris about its centre');
  assert.equal(end.batches().length, 0, 'no billboard');
  assert.deepEqual(a.reg.map((x) => [x.key, x.rate]), [[RIFT_BELL_KEY, RIFT_BELL_RATE]]);
  assert.equal(a.loops.length, 1);
  assert.deepEqual(a.loops[0].at, [10, riftCentreY(6), 5], 'heard from the ring\'s middle');   // SD-LOOK (PIN MOVED): its middle a hand's breadth higher - it hovers
  assert.equal(a.loops[0].o.lowpass, RIFT_BELL_LOWPASS_HZ, 'under water');
  assert.equal(a.loops[0].o.maxDistance, RIFT_BELL_RANGE.maxDistance);
  const t = end.targets();
  assert.deepEqual(t.map((x) => [x.key, x.distance, x.reach]), [[SD_RIFT_KEY, RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE], [SD_RETURN_KEY, RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE]]);
  // PIN MOVED (AUDIT SD IV F33): the Rift is pressed at its ring - a box turned with it, SD_RIFT_PRESS_M either side of
  // its plane, its gear's span across, foot to top - never its sweep's 6 m cube, which took the presses at the bodies
  // and the floor before it (test/sd26_dungeon.test.js)
  assert.deepEqual(t[0].aabb, { min: [7, 0, 5 - SD_RIFT_PRESS_M], max: [13, riftCentreY(6) + 3, 5 + SD_RIFT_PRESS_M] });
  assert.deepEqual(t[0].obb.box, [-3, 0, -SD_RIFT_PRESS_M, 3, riftCentreY(6) + 3, SD_RIFT_PRESS_M]);
  assert.deepEqual(t[1].aabb, { min: [15 - SD_RETURN_SIZE.w / 2, 0, 5 - SD_RETURN_SIZE.w / 2], max: [15 + SD_RETURN_SIZE.w / 2, SD_RETURN_SIZE.h, 5 + SD_RETURN_SIZE.w / 2] });
  assert.deepEqual(end.hoverName(SD_RIFT_KEY), { title: 'The Rift', subs: ['To the Shattered Hour'] });
  assert.deepEqual(end.hoverName(SD_RETURN_KEY), { title: 'The Return', subs: ['To the way in'] });
  assert.equal(end.hoverName('loot:0'), null);
  assert.equal(end.hoverName(7), null, 'a namer is handed every key');
  end.clear();
  assert.equal(r.freed.length, r.made.length, 'every mesh freed');
  assert.deepEqual(draws, [], 'and out of the draws');
  assert.ok(a.loops[0].stopped);
  assert.equal(end.targets().length, 0);
  // no archive yet (or no engine): it stands, silent
  const quiet = fakes({ archive: false });
  const e2 = createSdEnd({ renderer: quiet.r, audio: quiet.a });
  assert.ok(e2.stand({ rift: { at: [0, 0, 0], size: 3 }, retAt: null }));
  assert.equal(quiet.a.loops.length, 0);
  assert.ok(createSdEnd({ renderer: quiet.r, audio: null }).stand({ rift: { at: [0, 0, 0], size: 3 }, retAt: null }));
});

test('SD4b the step: walking INTO either hands it to the host once - standing in it asks nothing more, leaving and coming back asks again, a jump into it (a door, a teleport) asks nothing; a press hands it over too; the Return goes out with its boss and never asks again (mutants: every frame inside; the step\'s latch lost; the Return\'s step kept after it went out)', () => {
  let clock = 1000;
  const got = [];
  const { r } = fakes();
  const end = createSdEnd({ renderer: r, audio: null, now: () => clock, onRift: () => got.push('rift'), onReturn: () => got.push('return') });
  end.stand({ rift: { at: [0, 0, 0], size: 7 }, retAt: [6, 0, 0] });
  const walk = (feet) => { clock += 16; return end.frame(feet); };
  // from outside, step by step into the Rift
  assert.equal(walk([0, 0, 3]), null);
  assert.equal(walk([0, 0, 2]), null);
  assert.equal(walk([0, 0, 1.3]), null);
  assert.equal(walk([0, 0, 1.0]), 'rift');
  assert.equal(walk([0, 0, 0.5]), null, 'standing in it asks once');
  assert.equal(walk([0, 0, 0.2]), null);
  assert.deepEqual(got, ['rift']);
  walk([0, 0, 1.3]); walk([0, 0, 2]);
  assert.equal(walk([0, 0, 1.1]), 'rift', 'out and in again');
  // a jump into it - a teleport - is no step
  walk([0, 0, 9]);
  assert.equal(walk([0, 0.1, 0]), null, 'a jump of nine metres');
  // a gap in the frames forgets the step - PIN MOVED (AUDIT SD IV F3): a host held for seconds, never a slow frame (a
  // second's gap was "not ticked" here, and below 4 frames a second no walk-in was ever taken - test/sd26_dungeon.test.js)
  walk([0, 0, 2]);
  clock += 2500;
  assert.equal(end.frame([0, 0, 1]), null, 'a host held');
  // the Return, from beside it
  walk([6, 0, 1.5]); walk([6, 0, 1.0]);
  assert.equal(walk([6, 0, 0.6]), 'return');
  assert.deepEqual(got, ['rift', 'rift', 'return']);
  // within its reach, below its top, above its foot less a step
  assert.ok(inSdPortal([0.5, 2, 0], [0, 0, 0], SD_RIFT_REACH_M, 7));
  assert.ok(!inSdPortal([0.5, 8, 0], [0, 0, 0], SD_RIFT_REACH_M, 7), 'above it');
  assert.ok(!inSdPortal([0.5, -2, 0], [0, 0, 0], SD_RIFT_REACH_M, 7), 'a floor below it');
  assert.ok(!inSdPortal([SD_RETURN_REACH_M + 0.01, 0, 0], [0, 0, 0], SD_RETURN_REACH_M, 2.3));
  assert.ok(!inSdPortal(null, [0, 0, 0], 1, 1));
  // a press
  assert.equal(end.press(SD_RIFT_KEY), true);
  assert.equal(end.press(SD_RETURN_KEY), true);
  assert.equal(end.press('exit:0'), false);
  assert.deepEqual(got.slice(-2), ['rift', 'return']);
  // the Return goes out
  end.returnOut();
  assert.equal(r.freed.length, 2, 'its arch and its hand');
  assert.deepEqual(end.targets().map((x) => x.key), [SD_RIFT_KEY]);
  assert.equal(end.hoverName(SD_RETURN_KEY), null);
  assert.equal(end.press(SD_RETURN_KEY), false);
  walk([6, 0, 3]); walk([6, 0, 1]);
  assert.equal(walk([6, 0, 0.3]), null, 'its step gone with it');
  assert.equal(end.ret, null);
  assert.deepEqual(end.rift, { at: [0, 0, 0], size: 7, face: [0, 0, 1] });
  // a narrow ring's step is a quarter of its size across, not more
  const small = createSdEnd({ renderer: r, audio: null, now: () => clock, onRift: () => got.push('small') });
  small.stand({ rift: { at: [50, 0, 50], size: 2.6 }, retAt: null });
  clock += 16; small.frame([50, 0, 51]);
  clock += 16; assert.equal(small.frame([50, 0, 50.8]), null, 'at 0.8 m: outside a 2.6 m ring\'s 0.65');
  clock += 16; assert.equal(small.frame([50, 0, 50.5]), 'rift');
});

test('SD4b the bell under water: one toll a loop, levelled, darker than the bell it is made of; nothing to make it of, silence (mutants: the bell undarkened)', () => {
  const bell = new Float32Array(8000).map((_, i) => (Math.sin(i * 1.7) + Math.sin(i * 0.31)) * Math.exp(-i / 3000));
  const out = buildRiftBell(bell, null);
  assert.equal(out.length, Math.round(RIFT_BELL_RATE * RIFT_BELL_SECONDS));
  assert.ok(out.every(Number.isFinite));
  assert.ok(Math.abs(rms(out) - RIFT_BELL_RMS) < RIFT_BELL_RMS * 0.25, `levelled: ${rms(out)}`);
  // dark: a sample's step to the next is small beside the level - the high bell's ring taken off
  let step = 0;
  for (let i = 1; i < out.length; i++) step += Math.abs(out[i] - out[i - 1]);
  step /= out.length - 1;
  assert.ok(step < rms(out) * 0.09, `dark: ${step} against ${rms(out)}`);   // 0.07 of its level; the same toll undarkened steps 0.11
  assert.ok(buildRiftBell(null, null).every((v) => v === 0), 'nothing to make it of');
  const { a } = fakes();
  const h = startRiftBell(a, [1, 2, 3]);
  assert.ok(h && a.reg[0].key === RIFT_BELL_KEY && a.reg[0].n === Math.round(RIFT_BELL_RATE * RIFT_BELL_SECONDS));
  assert.equal(a.loops[0].o.distanceModel, 'linear');
  assert.equal(startRiftBell(null, [0, 0, 0]), null);
  assert.equal(startRiftBell({ ...a, loop3d: () => { throw new Error('no context'); } }, [0, 0, 0]), null, 'a sound that cannot stand never costs the Rift');
});

test('SD4b the host\'s steps, run from its own text: into the Rift its word first - through where the realm\'s door takes me, else its refusal said mid-screen; into the Return, the start marker\'s landing through the dungeon\'s own teleport door (mutants: the word unasked; the refusal unsaid; the Return to the enter marker)', () => {
  const D = read('src/scenes/dungeonContext.js');
  const fn = (name) => { const at = D.indexOf(`\n  function ${name}(`); assert.ok(at > 0, name); return D.slice(at + 1, D.indexOf('\n  }\n', at) + 4); };
  const body = `${fn('sdRiftStep')}\n${fn('sdReturnStep')}\nreturn { sdRiftStep, sdReturnStep };`;
  const make = (host) => {
    const said = [], tp = [];
    const f = new Function('sdEndWord', 'setMidScreenText', 'SD_NO_RIFT', 'api', 'actions', 'opts', body)(   // AUDIT SD II (SD11d, PIN MOVED): `opts` - a host with no voice, the label itself
      () => host, (t) => said.push(t), SD_NO_RIFT,
      { startSpawn: (o) => (o?.preferEnterMarker === false ? [1, 2, 3] : [9, 9, 9]) }, { onTeleport: ({ pos }) => tp.push(pos) }, {});
    return { ...f, said, tp };
  };
  const through = make({ word: null, returns: true, enter: () => true });
  through.sdRiftStep();
  assert.deepEqual(through.said, [], 'the realm took me');
  const noRealm = make({ word: null, returns: true, enter: () => false });
  noRealm.sdRiftStep();
  assert.deepEqual(noRealm.said, [SD_NO_RIFT], 'admitted, and no door yet (SD5): not yet');
  const closed = make({ word: SD_NO_CLOSED, returns: false, enter: () => { throw new Error('never asked'); } });
  closed.sdRiftStep();
  assert.deepEqual(closed.said, [SD_NO_CLOSED]);
  const offline = make(null);
  offline.sdRiftStep();
  assert.deepEqual(offline.said, [SD_NO_RIFT]);
  through.sdReturnStep();
  assert.deepEqual(through.tp, [[1, 2, 3]], 'the start marker\'s landing - the way in');
});

test('SD4b the hosts by source: the dungeon stands them for a Super dungeon alone, the first frame I stand there; the Return asked about once a second; the ray, the plaque, the drops\' pass, the press and the destroy; the mode machine\'s press arm and its forward; the world host\'s word off the hub\'s record (mutants: stood in every dungeon; the press unrouted; the forward lost; the word off no record)', () => {
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /const sdEnd = _superTier \? createSdEnd\(\{ renderer, audio, onRift: \(\) => sdRiftStep\(\), onReturn: \(\) => sdReturnStep\(\), riftCount: \(\) => sdEndWord\(\)\?\.count \?\? null, look: \(\) => sdEndWord\(\)\?\.look \?\? null, clock: sdEndClock \}\)[^\n]*\n\s*: _sdRealm \? createSdEnd\([^\n]*\) : null;/);   // SD5a (PIN MOVED): the Shattered Hour stands its way back with the same set; AUDIT SD II (SD11f, L6 F5, PIN MOVED): the Hollow's plaque counts its Hour
  assert.match(D, /const sdEndWord = \(\) => opts\.superRift\?\.\(dfLocation\?\.sdSlot\) \?\? null;/);
  assert.match(D, /const rift = sdRiftPlace\(floorLanding\(collider, \[end\.x, end\.y \+ 0\.2, end\.z\]\), probe\);\n\s*_sdRetAt = sdReturnPlace\(rift, probe\);\n\s*_sdLanding = sdLandingPlace\(rift, _sdRetAt, probe\);\n\s*sdEnd\.stand\(\{ rift, retAt: _sdRetAt, dynamicDraws, probe \}\);/);   // SD5a (PIN MOVED): the Return's place kept - the way back from the Hour stands a player there; AUDIT SD II (L6 F18, PIN MOVED): past it, never on its foot
  assert.match(D, /if \(playerFeet && !_sdEndAsked\) \{ _sdEndAsked = true; standSdEnd\(\); \}/);
  assert.match(D, /if \(sdEnd\.ret && t >= _sdEndCheckAt\) \{ _sdEndCheckAt = t \+ 1000; const w = sdEndWord\(\); if \(w && !w\.returns\) sdEnd\.returnOut\(\); \}/);
  assert.match(D, /if \(playerFeet && !_lairAsked\) \{[^\n]*\n {4}if \(sdEnd\) sdEndFrame\(playerFeet\);/, 'the frame, beside the lair\'s stand');
  assert.match(D, /const _dropBatches = [^\n]*\n {4}if \(sdEnd\) _dropBatches\.push\(\.\.\.sdEnd\.batches\(\)\);/);
  assert.match(D, /targets\.push\(\.\.\.camps\.targets\(\)\);[^\n]*\n {4}if \(sdEnd\) targets\.push\(\.\.\.sdEnd\.targets\(\)\);/);
  assert.match(D, /\(key\) => sdEnd\?\.hoverName\(key\) \?\? null,/);
  assert.match(D, /sdPress\(key\) \{ return !!sdEnd\?\.press\(key\) \|\| !!sdHall\?\.press\(key\); \},/);   // SD6c (PIN MOVED): and the Orrery's hall's
  assert.match(D, /portals\.clear\(\);[^\n]*\n {6}sdEnd\?\.clear\(\);/);
  const W = read('src/scenes/worldModes.js');
  const arm = W.indexOf("if (key.startsWith('sdrift:') || key.startsWith('sdreturn:') || key.startsWith('sdstone:') || key.startsWith('sdplaque:')) { dungeonCtx.sdPress?.(key); return true; }");   // SD6c (PIN MOVED): and the Orrery's handles and plaques
  assert.ok(arm > 0 && arm < W.indexOf("    if (!key.startsWith('exit:')) {\n      dungeonCtx.actions.activate(key"), 'before the press falls through to the action objects');
  assert.match(W, /superRift: \(s\) => host\.superRift\?\.\(s\) \?\? null,/);
  const w = read('src/scenes/world.js');
  assert.match(w, /const seen = \{ entered: _sdEntered\.has\(s\), fallen: _sdFallen\.has\(s\) \};\n\s*return \{ word: sdRiftWord\(rec, s, now, seen\), returns: sdReturnStands\(rec, s, now\), count: sdRiftCount\(rec, s, now\), look: riftLook\(rec, s, now, seen\), enter: \(\) => sdEnterRealm\(s\) \};/);   // SD5a (PIN MOVED): the realm's door - the step through to the Shattered Hour; SD-ONELIFE (PIN MOVED): and the Hours I died in
  assert.match(w, /const rec = sdHost\.record\(\), now = Date\.now\(\) \+ _sharedOffsetMs;/, 'the hub\'s record, on the shared clock the Hollow\'s host reads');
  assert.match(w, /superRift: \(s\) => sdRiftOf\(s\),/);
  assert.match(read('bible/11-Multiplayer/Super-Dungeons.md'), /### SD4b - shipped 2026-10-07/);
});
