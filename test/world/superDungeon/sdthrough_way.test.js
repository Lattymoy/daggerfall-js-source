// SD-THROUGH (2026-10-21, the owner: "So the abyss dungeon. When someone finds and enters the portal. I want a portal to
// show up for anyone in the dungeon and anyone entering that automatically leads them there."; bible/11-Multiplayer/
// Super-Dungeons.md section 6, SD-THROUGH and AUDIT SD-THROUGH): THE WAY THROUGH. Once the first soul has stepped through
// a Hollow's Rift (the hub's record's `inAt` - its relay half is test/net/superDungeon/sdthrough_relay.test.js), a second
// Rift stands beside everyone in the Hollow and everyone who enters it, and leads to the Shattered Hour through the Rift's
// own door - pressed, never walked into. Here: the law of when it stands (world/superDungeon/sdDungeon.js sdThroughStands)
// and where (sdThroughPlace - over model halls and over the freeware's own Hollows), the module that stands it
// (scenes/superDungeon/sdThrough.js), the veil's pivot and the two windows' order, and the hosts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  sdThroughStands, sdThroughPlace, SD_THROUGH_TEXT, SD_THROUGH_SIZE_M, SD_THROUGH_AHEAD_M, SD_THROUGH_NEAR_RIFT_M, SD_THROUGH_PASS_M, SD_RIFT_MIN_M, SD_RIFT_AIR_M,
  SD_END_TEXT, sdRiftWord, sdReturnStands, sdRiftCount, riftLook,
} from '../../../src/world/superDungeon/sdDungeon.js';
import { createSdThrough, sdVeilModelOf, sdRingsFarFirst, SD_THROUGH_KEY, SD_THROUGH_ASK_MS, SD_THROUGH_LIGHT_M } from '../../../src/scenes/superDungeon/sdThrough.js';
import { SD_RIFT_KEY, sdProbeOf } from '../../../src/scenes/superDungeon/sdEnd.js';
import { riftCentreY } from '../../../src/world/superDungeon/sdRiftModel.js';
import { sdRise, sdFind, sdEnter, sdFell, SD_NO_FALLEN } from '../../../src/net/superDungeon/sdLaw.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const closeV = (a, b, eps = 1e-6) => !!a && !!b && a.length === b.length && a.every((x, i) => close(x, b[i], eps));
const S = Math.SQRT1_2 * SD_THROUGH_AHEAD_M;   // a half quarter-turn's three metres, along either axis

/** An axis-aligned hall - x in [x0, x1], z in [z0, z1], its floor at y0, its ceiling `h` above - as the collider answers
 *  it (test/world/superDungeon/sd4b_rift.test.js's own); `pits` floors of another height inside it. */
function hall({ x0 = 0, x1 = 10, z0 = 0, z1 = 10, y0 = 0, h = 8, pits = [] } = {}) {
  const inside = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  return {
    floor: (at) => {
      if (!inside(at[0], at[2])) return null;
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
/** A renderer that keeps only what was asked of it. */
function fakeRenderer() {
  const r = { made: [], freed: [] };
  r.uploadTexture = () => {}; r.uploadEmissionTexture = () => {};
  r.createMesh = (m) => { const g = { m }; r.made.push(g); return g; };
  r.destroyMesh = (g) => r.freed.push(g);
  return r;
}

test('SD-THROUGH the law: the Way Through stands once the first soul went through - the record\'s `inAt` - while the Hollow is found and its boss stands, for its own slot alone; its three words the player\'s language\'s (mutants: stood before anyone went through; stood after the kill; another slot\'s)', () => {
  const risen = sdRise(null, T0, 3);
  const found = sdFind(risen, T0 + 60_000, 'Mara');
  const entered = sdEnter(found, T0 + 120_000);
  assert.equal(entered.inAt, T0 + 120_000);
  assert.equal(sdThroughStands(null, risen.s, T0), false, 'no record heard');
  assert.equal(sdThroughStands(risen, risen.s, T0), false, 'risen: nobody can have gone through');
  assert.equal(sdThroughStands(found, found.s, T0 + 130_000), false, 'found, nobody through yet');
  assert.equal(sdThroughStands(entered, entered.s, T0 + 130_000), true, 'one went through');
  assert.equal(sdThroughStands(entered, entered.s + 1, T0 + 130_000), false, 'another slot\'s');
  assert.equal(sdThroughStands(sdFell(entered, T0 + 200_000, { top: 'Ann', n: 2 }), entered.s, T0 + 200_001), false, 'the kill: out with the Return');
  assert.equal(sdThroughStands(entered, entered.s, entered.until), false, 'faded unbeaten');
  // its words: its own title, its own row (AUDIT SD-THROUGH B10: keyed, so the plaque is one language), its line
  assert.deepEqual(SD_THROUGH_TEXT, { title: 'The Way Through', to: 'To the Shattered Hour', opens: 'The Rift stands open. The Way Through opens beside you.' });
  assert.equal(SD_THROUGH_TEXT.to, SD_END_TEXT.riftTo, 'in English the Rift\'s own row');
  const D = read('src/world/superDungeon/sdDungeon.js');
  for (const k of ['sd.through.title', 'sd.through.to', 'sd.through.opens']) assert.match(D, new RegExp(`t\\('${k.replace(/\./g, '\\.')}', `), k);
  assert.equal(SD_THROUGH_SIZE_M, SD_RIFT_MIN_M, 'the Rift\'s least ring - it stands in a corridor');
});

test('SD-THROUGH the place (AUDIT SD-THROUGH B2, B5): beside the way I look - a half quarter-turn off it, three metres on, its face turned to me - then ahead, then round; a ring that would cross a wall, the ceiling or the only way past waits; a dry floor, my own; my feet off it is not yet (mutants: the heading dropped; the bearings mirrored; ahead first; the disc unswept; the ceiling unasked; no way past asked; the water unasked; the half-way pass gone; off the floor stood in the air)', () => {
  const big = hall({ x1: 40, z1: 40, h: 12 });
  const a = sdThroughPlace([20, 0, 20], 0, big);
  assert.ok(closeV(a.at, [20 + S, 0, 20 + S]) && a.size === SD_THROUGH_SIZE_M, JSON.stringify(a));
  assert.ok(closeV(a.face, [-Math.SQRT1_2, 0, -Math.SQRT1_2]), 'its face turned to me');
  const b = sdThroughPlace([20, 0, 20], Math.PI / 2, big);
  assert.ok(closeV(b.at, [20 + S, 0, 20 - S]), `turned with my heading: ${JSON.stringify(b)}`);
  // a wall a metre and a half ahead: never through it - round to the first bearing whose ring stands whole, the
  // first of its pair (the beside bearings' order, every client the same)
  const w = sdThroughPlace([20, 0, 38.5], 0, big);
  assert.ok(closeV(w.at, [20 + S, 0, 38.5 - S]), JSON.stringify(w));
  assert.ok(close(w.face[0] * (20 - w.at[0]) + w.face[2] * (38.5 - w.at[2]), SD_THROUGH_AHEAD_M), 'its face turned to me');
  // a small hall: every three metres walled - half that, straight ahead, where a way past it stands either side
  const r = sdThroughPlace([2.5, 0, 2.5], 0, hall({ x1: 5, z1: 5 }));
  assert.ok(closeV(r.at, [2.5, 0, 2.5 + SD_THROUGH_AHEAD_M / 2]), JSON.stringify(r));
  // a corridor 5 m wide: down its middle, a body's way past either side; 3 m wide (its ring and its air are 3.2): not yet
  assert.ok(closeV(sdThroughPlace([2.5, 0, 5], 0, hall({ x1: 5, z1: 40 })).at, [2.5, 0, 5 + SD_THROUGH_AHEAD_M]));
  assert.equal(sdThroughPlace([1.5, 0, 5], 0, hall({ x1: 3, z1: 40 })), null, 'a corridor its ring would block: not yet');
  // the ceiling over its axis - its top a hand's breadth over its size and its air: 2.9 m stands none, 3.1 m stands it
  const top = riftCentreY(SD_THROUGH_SIZE_M) + SD_THROUGH_SIZE_M / 2 + SD_RIFT_AIR_M;
  assert.ok(top > 2.9 && top < 3.1, String(top));
  assert.equal(sdThroughPlace([20, 0, 20], 0, hall({ x1: 40, z1: 40, h: 2.9 })), null, 'through the ceiling');
  assert.ok(sdThroughPlace([20, 0, 20], 0, hall({ x1: 40, z1: 40, h: 3.1 })));
  // the way past: a corridor 3.4 m wide stands its ring clear only square across it, leaving a body's way on neither
  // side - not yet (its diagonals' rings cross the walls)
  assert.ok(SD_THROUGH_SIZE_M + 2 * SD_RIFT_AIR_M <= 3.4 && SD_THROUGH_SIZE_M / 2 + SD_RIFT_AIR_M + SD_THROUGH_PASS_M > 1.7);
  assert.equal(sdThroughPlace([1.7, 0, 5], 0, hall({ x1: 3.4, z1: 40 })), null, 'its ring across the only way');
  // the water: a spot under its block's surface is passed over for the next
  const wet = { ...big, water: (x) => (x > 21 ? 0.5 : null) };
  assert.ok(closeV(sdThroughPlace([20, 0, 20], 0, wet).at, [20 - S, 0, 20 + S]), 'the dry side');
  // a pit where it would stand: the next bearing, never the other floor
  const p = sdThroughPlace([20, 0, 20], 0, hall({ x1: 40, z1: 40, h: 12, pits: [{ x0: 21, x1: 23.5, z0: 21, z1: 23.5, y: -3 }] }));
  assert.ok(closeV(p.at, [20 - S, 0, 20 + S]), JSON.stringify(p));
  // my feet: off their floor (a jump, a fall, a swim) not yet; within a step, the floor under them
  assert.equal(sdThroughPlace([20, 1.0, 20], 0, big), null, 'in the air');
  assert.equal(sdThroughPlace([20, 0.4, 20], 0, big).at[1], 0, 'on the floor under me');
  assert.equal(sdThroughPlace([50, 0, 50], 0, big), null, 'no floor under me');
  // a closet: not yet - never at my feet, never a ring through its walls
  assert.equal(sdThroughPlace([1, 0, 1], Math.PI / 2, hall({ x1: 2, z1: 2 })), null);
  // the same answer every time
  assert.deepEqual(sdThroughPlace([20, 0, 38.5], 0, big), w);
  // the end's one probe over a collider: its floor from a metre over a point, its ray's clear distance
  const probe = sdProbeOf({ raycast: (o, d, max) => (d[1] < 0 ? 1.25 : max > 5 ? 4 : Infinity) });
  assert.equal(probe.floor([0, 2, 0]), 1.75);
  assert.equal(probe.ray([0, 0, 0], [1, 0, 0], 12), 4);
  assert.equal(probe.ray([0, 0, 0], [1, 0, 0], 3), null);
});

test('SD-THROUGH the module: asked once a second, it stands beside me the first time the word says one went through and the Rift admits me, by my heading - its line said once, its key in the ray YIELDING to anything firm, its own name and row on the plaque; PRESSED, NEVER WALKED INTO (AUDIT SD-THROUGH B1, B3, B10); out with the Return when the boss falls, for good (mutants: never asked; asked every frame; stood for one the Hour refused; never taken out; stood again; the Rift\'s key; the Rift\'s title; walked into; its press firm; the heading dropped)', () => {
  let clock = 1000, asks = 0, steps = 0;
  const said = [];
  let w = { word: null, returns: true, through: false, count: 'Fades in 3:00:00' };
  const r = fakeRenderer(), draws = [];
  const th = createSdThrough({ renderer: r, now: () => clock, word: () => { asks++; return w; }, onStep: () => { steps++; return true; }, say: (t) => said.push(t), probe: hall({ x1: 40, z1: 40, h: 12 }), riftOf: () => ({ at: [5, 0, 5] }), dynamicDraws: draws });
  const frame = (feet = [20, 0, 20], yaw = Math.PI / 2) => { clock += 16; return th.frame(feet, yaw, null); };
  frame();
  assert.equal(asks, 1, 'the first frame I stand here');
  for (let k = 0; k < 10; k++) frame();
  assert.equal(asks, 1, 'once a second, never every frame');
  assert.equal(th.stands, false, 'nobody through yet');
  w = { ...w, through: true };
  clock += SD_THROUGH_ASK_MS;
  frame();
  assert.equal(asks, 2);
  assert.equal(th.stands, true, 'one went through: beside me');
  assert.ok(closeV(th.rift.at, [20 + S, 0, 20 - S]), `beside my heading: ${JSON.stringify(th.rift)}`);
  assert.equal(th.rift.size, SD_THROUGH_SIZE_M);
  assert.deepEqual(said, [SD_THROUGH_TEXT.opens]);
  assert.ok(draws.length > 0 && draws.length === r.made.length, 'its meshes among the level\'s draws');
  const t = th.targets();
  assert.deepEqual(t.map((x) => [x.key, x.yields]), [[SD_THROUGH_KEY, true]], 'its press yields - the door behind it answers first');
  assert.equal(SD_THROUGH_KEY.startsWith('sdrift:') && SD_THROUGH_KEY !== SD_RIFT_KEY, true, 'the press ladder\'s Rift arm, its own key');
  assert.deepEqual(th.hoverName(SD_THROUGH_KEY), { title: 'The Way Through', subs: ['To the Shattered Hour', 'Fades in 3:00:00'] });
  assert.equal(th.hoverName(SD_RIFT_KEY), null, 'the Rift\'s key is the Rift\'s');
  assert.equal(th.press(SD_RIFT_KEY), false);
  assert.equal(th.press(SD_THROUGH_KEY), true);
  assert.equal(steps, 1, 'pressed: the Rift\'s own step');
  // walked into: nothing - out, then in, then standing in it
  const at = th.rift.at;
  for (const k of [3, 2, 1, 0.6, 0.2, 0]) frame([at[0] - k * Math.SQRT1_2, 0, at[2] + k * Math.SQRT1_2]);
  assert.equal(steps, 1, 'never walked into');
  // stood once: the word asked again moves nothing while its boss stands
  clock += SD_THROUGH_ASK_MS;
  frame([0.5, 0, 0.5]);
  assert.ok(closeV(th.rift.at, at), 'never moved');
  assert.deepEqual(said, [SD_THROUGH_TEXT.opens], 'said once');
  // the boss falls: out, for good
  w = { ...w, returns: false };
  clock += SD_THROUGH_ASK_MS;
  frame();
  assert.equal(th.stands, false);
  assert.deepEqual(th.targets(), []);
  assert.equal(r.freed.length, r.made.length, 'every mesh freed');
  assert.deepEqual(draws, [], 'and out of the draws');
  w = { ...w, returns: true, through: true };
  clock += SD_THROUGH_ASK_MS;
  const n = asks;
  frame();
  assert.equal(th.stands, false, 'never again this visit');
  assert.equal(asks, n, 'and never asked again');
  // the Hour refused me for good: none opens
  const refused = createSdThrough({ renderer: fakeRenderer(), now: () => clock, word: () => ({ word: SD_NO_FALLEN, returns: true, through: true }), probe: hall({ x1: 40, z1: 40 }) });
  refused.frame([20, 0, 20], 0);
  assert.equal(refused.stands, false, 'one the Hour will not take back');
  // no feet, no ask; no probe, no stand
  let quietAsks = 0;
  const unplaced = createSdThrough({ renderer: fakeRenderer(), now: () => clock, word: () => { quietAsks++; return { word: null, returns: true, through: true }; } });
  unplaced.frame(null, 0);
  assert.equal(quietAsks, 0, 'no feet: nothing asked');
  unplaced.frame([1, 0, 1], 0);
  assert.equal(unplaced.stands, false, 'no collider: nowhere to stand it');
  // gone with the dungeon
  const g = createSdThrough({ renderer: fakeRenderer(), now: () => clock, word: () => ({ word: null, returns: true, through: true }), probe: hall({ x1: 40, z1: 40 }) });
  g.frame([20, 0, 20], 0);
  assert.equal(g.stands, true);
  g.clear();
  assert.equal(g.stands, false);
  clock += SD_THROUGH_ASK_MS;
  g.frame([20, 0, 20], 0);
  assert.equal(g.stands, false, 'cleared: never stood again');
});

test('SD-THROUGH NOT YET IS NEVER NONE (AUDIT SD-THROUGH B2, B5, B6): where it stands no whole ring, off my floor, or by the Hollow\'s Rift, it is asked again as I move - and stands, its line said then, once; a floor far below the Rift is not by it; its light let go past SD_THROUGH_LIGHT_M (B9) (mutants: by the Rift decided for the visit; not yet decided for the visit; the Rift never asked; asked across the floor plan alone; its light held far off)', () => {
  let clock = 1000;
  const said = [];
  const word = () => ({ word: null, returns: true, through: true });
  const big = hall({ x1: 80, z1: 80, h: 12 }), low = hall({ x1: 80, z1: 80, h: 2.9 });
  // a hall low at its west end (x < 10): no ring stands under it
  const two = { floor: big.floor, ray: (o, d, m) => (o[0] < 10 ? low : big).ray(o, d, m) };
  const th = createSdThrough({ renderer: fakeRenderer(), now: () => clock, word, say: (t) => said.push(t), probe: two, riftOf: () => ({ at: [60, 0, 60] }) });
  const at = (feet) => { clock += SD_THROUGH_ASK_MS; th.frame(feet, 0); };
  at([5, 0, 20]);
  assert.equal(th.stands, false, 'under the low ceiling: not yet');
  at([30, 1.0, 20]);
  assert.equal(th.stands, false, 'mid-jump: not yet');
  at([60, 0, 60 + SD_THROUGH_NEAR_RIFT_M - 0.5]);
  assert.equal(th.stands, false, 'by the Rift: not yet');
  assert.deepEqual(said, [], 'nothing said yet');
  at([30, 0, 20]);
  assert.equal(th.stands, true, 'on my floor, in the open, away from the Rift: it stands');
  assert.deepEqual(said, [SD_THROUGH_TEXT.opens], 'its line, then, once');
  assert.equal(th.lights().length, 1, 'near it: its light');
  th.frame([30 + SD_THROUGH_LIGHT_M + 5, 0, 20], 0);
  assert.equal(th.lights().length, 0, 'far off: its light let go');
  th.frame([30, 0, 22], 0);
  assert.equal(th.lights().length, 1, 'and back');
  // a floor far below the Rift is not by it
  const below = createSdThrough({ renderer: fakeRenderer(), now: () => clock, word, probe: big, riftOf: () => ({ at: [10, 40, 10] }) });
  below.frame([10, 0, 12], 0);
  assert.equal(below.stands, true, 'the Rift a floor far above: not right there');
});

test('SD-THROUGH the two rings drawn: the veil\'s pivot the nearer to the eye - the Way Through\'s window or the Rift\'s (else its Return\'s window home); the windows drawn farther first, the nearer last over it (AUDIT SD-THROUGH B8) - one kept pair, nothing made a frame (mutants: always the Rift\'s; the farther; drawn in a fixed order)', () => {
  const m = (x, y, z) => { const a = new Float32Array(16); a[12] = x; a[13] = y; a[14] = z; return a; };
  const through = { window: { model: m(0, 1, 3) } }, end = { window: { model: m(0, 1, 30) } }, bay = { window: null, bay: { model: m(0, 1, 2) } };
  assert.equal(sdVeilModelOf([0, 1.6, 0], through, end), through.window.model, 'the Way Through, beside me');
  assert.equal(sdVeilModelOf([0, 1.6, 29], through, end), end.window.model, 'at the Rift');
  assert.equal(sdVeilModelOf([0, 1.6, 0], through, bay), bay.bay.model, 'the Return\'s window, nearer');
  assert.equal(sdVeilModelOf([0, 1.6, 0], null, end), end.window.model, 'no Way Through: the Rift\'s, as before');
  assert.equal(sdVeilModelOf([0, 1.6, 0], through, null), through.window.model);
  assert.equal(sdVeilModelOf(null, through, end), through.window.model, 'no eye: the Way Through\'s');
  assert.equal(sdVeilModelOf([0, 0, 0], null, null), null);
  const near = sdRingsFarFirst([0, 1.6, 0], through, end);
  assert.deepEqual([...near], [end, through], 'the Way Through nearer: drawn last');
  const far = sdRingsFarFirst([0, 1.6, 29], through, end);
  assert.equal(far, near, 'one kept pair');
  assert.deepEqual([...far], [through, end], 'the Rift nearer: drawn last');
  assert.deepEqual([...sdRingsFarFirst([0, 0, 0], null, end)], [null, end], 'no Way Through: the Rift alone');
  const T = read('src/scenes/superDungeon/sdThrough.js');
  const body = T.slice(T.indexOf('export function sdVeilModelOf('), T.indexOf('const _pair = [null, null];'));
  assert.ok(body.length > 300);
  assert.doesNotMatch(body, /new |[=(,:]\s*\[|=>|\.\.\./, 'nothing made: no array, no closure, no spread');
});

test('SD-THROUGH the word from the world host\'s own text: sdRiftOf says `through` off the hub\'s record - one went through, found, this slot - beside the Rift\'s word (AUDIT SD-THROUGH C12: the producer\'s own shape, not a hand-built word) (mutant: the word without it)', () => {
  const W = read('src/scenes/world.js');
  const at = W.indexOf('\n  const sdRiftOf = ');
  assert.ok(at > 0);
  const body = W.slice(at + 1, W.indexOf('\n  };\n', at) + 5);
  const found = sdFind(sdRise(null, T0, 3), T0 + 1000, 'Mara'), entered = sdEnter(found, T0 + 2000);
  let rec = found;
  const env = { sdHost: { record: () => rec }, _sharedOffsetMs: 0, sdRiftWord, sdReturnStands, sdThroughStands, sdRiftCount, riftLook, _sdEntered: new Set(), _sdFallen: new Set(), sdEnterRealm: () => true };
  const sdRiftOf = new Function(...Object.keys(env), `${body}\nreturn sdRiftOf;`)(...Object.values(env));
  const realNow = Date.now;
  Date.now = () => T0 + 3000;
  try {
    assert.equal(sdRiftOf(found.s).through, false, 'found, nobody through');
    rec = entered;
    const w = sdRiftOf(found.s);
    assert.equal(w.through, true, 'one went through');
    assert.equal(w.word, null, 'and the Rift admits');
    assert.equal(sdRiftOf(found.s + 1).through, false, 'another slot\'s');
  } finally { Date.now = realNow; }
});

test('SD-THROUGH the hosts by source: the dungeon host makes the Way Through for a Hollow alone - the Rift\'s step, word and look, the Hour\'s voice, its collider and the block\'s water - one named closure each with the Rift and the hall (AUDIT SD-THROUGH C13); frames it beside the Rift with my heading, offers it to the ray, names it, presses it, draws and lights it and frees it; the world host draws the two windows farther first, its veil on the nearer; the mode machine forwards the look and its press arm takes its key (mutants: the Hour stands one; never framed; never freed; never drawn; the look unforwarded)', () => {
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /const sdThrough = _superTier \? createSdThrough\(\{ renderer, audio, word: \(\) => sdEndWord\(\), look: sdRiftLookNow, clock: sdEndClock, onStep: \(\) => sdRiftStep\(\), say: sdSayHere, probe: \{ \.\.\.sdProbeOf\(collider\), water: waterSurfaceYAt \}, riftOf: \(\) => sdEnd\.rift, dynamicDraws \}\) : null;/);
  assert.match(D, /sdEnd\.frame\(playerFeet \?\? null, playerFeet \? _sdEye : null\);\n\s*sdThrough\?\.frame\(playerFeet \?\? null, _fpYaw, playerFeet \? _sdEye : null\);/, 'framed beside the Rift, my heading latched this frame');
  assert.match(D, /if \(sdThrough\) targets\.push\(\.\.\.sdThrough\.targets\(\)\);/);
  assert.match(D, /\(key\) => sdEnd\?\.hoverName\(key\) \?\? sdThrough\?\.hoverName\(key\) \?\? null,/);
  assert.match(D, /sdPress\(key\) \{ return !!sdEnd\?\.press\(key\) \|\| !!sdThrough\?\.press\(key\) \|\| !!sdHall\?\.press\(key\); \},/);
  assert.match(D, /sdThroughLook: sdThrough \? \(eye, sky, hour\) => sdThrough\.look\(eye, sky, hour\) : undefined,/);
  assert.match(D, /sdEndWith\(sdEnd\.halos\(\), sdHall\?\.halos\(\) \?\? sdThrough\?\.halos\(\), _sdEndHalos\)/);
  assert.match(D, /sdEndWith\(sdEnd\.lights\(\), sdHall\?\.lights\(\) \?\? sdThrough\?\.lights\(\), _sdEndLights\)/);
  assert.match(D, /sdEnd\?\.clear\(\);[^\n]*\n\s*sdThrough\?\.clear\(\);/);
  assert.equal(D.match(/look: sdRiftLookNow/g)?.length, 2, 'the Rift and the Way Through ask one look');
  assert.equal(D.match(/say: sdSayHere/g)?.length, 2, 'the hall and the Way Through say one way');
  const W = read('src/scenes/world.js');
  assert.match(W, /through: sdThroughStands\(rec, s, now\),/);
  assert.match(W, /const through = end\.sdThroughLook\?\.\(eye, sky \? _sdRiftSky : null, minuteNow\(\) \/ 60\) \?\? null;/);
  assert.match(W, /sdVeilAim\(proj, view, sdVeilModelOf\(eye, through, look\)\);/);
  assert.match(W, /for \(const l of sdRingsFarFirst\(eye, through, look\)\) if \(l && pass\?\.draw\(proj, view, l, fog, renderer\.lightingLane \? SD_SKY_STEPS\.lane : SD_SKY_STEPS\.classic\)\) drew = true;/);
  const M = read('src/scenes/worldModes.js');
  assert.match(M, /if \(key\.startsWith\('sdrift:'\)/, 'its key rides the Rift\'s arm');
  assert.match(M, /superRiftLook: \(s\) => host\.superRiftLook\?\.\(s\) \?\? null,/, 'the look forwarded (B4)');
  const T = read('src/scenes/superDungeon/sdThrough.js');
  assert.match(T, /createSdEnd\(\{ renderer, audio, now, onRift: onStep, riftKey: SD_THROUGH_KEY, riftTitle: \(\) => SD_THROUGH_TEXT\.title, riftTo: \(\) => SD_THROUGH_TEXT\.to, riftCount: \(\) => word\(\)\?\.count \?\? null, look, clock, walkIn: false, riftYields: true \}\);/);
});

// ── on the freeware's own Hollows ──────────────────────────────────────────────────────

const A = process.env.ARENA2_PATH;
const HAVE = !!A && existsSync(join(A, 'MAPS.BSA')) && existsSync(join(A, 'BLOCKS.BSA')) && existsSync(join(A, 'ARCH3D.BSA'));

test('SD-THROUGH on the freeware\'s Hollows (AUDIT SD-THROUGH B2): at each of forty Hollow templates\' entries, facing away from the way out as the host stands a player there, the Way Through stands whole or waits - never through a wall or the ceiling, never across the only way, never under water - and most stand at once (mutants: the disc unswept; the ceiling unasked; no way past asked; nothing ever stood)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const R = '../../../src/';
  const { MapsFile } = await import(`${R}formats/mapsFile.js`);
  const { BlocksFile } = await import(`${R}formats/blocksFile.js`);
  const { Arch3dFile } = await import(`${R}formats/arch3dFile.js`);
  const { dfMeshToModel, GLOBAL_SCALE } = await import(`${R}world/meshReader.js`);
  const { customModelFor, emptyModel } = await import(`${R}world/customModels.js`);
  const { layoutDungeon, isDungeonExitDoor } = await import(`${R}world/dungeon/dungeonLayout.js`);
  const { trs, multiply } = await import(`${R}world/mat4.js`);
  const { Collider } = await import(`${R}player/collider.js`);
  const { ActionSystem, classifyPlacementAction } = await import(`${R}world/actionSystem.js`);
  const { floorLanding, closestDoorTo } = await import(`${R}player/enterExit.js`);
  const { patchSeams } = await import(`${R}world/arch3dSeams.js`);
  const { isMainStoryDungeon } = await import(`${R}world/dungeon/dungeonTextures.js`);
  const { sdTemplates } = await import(`${R}systems/superDungeon/sdSite.js`);
  const { RDB_SIDE } = await import(`${R}world/rdbLayout.js`);
  const rd = (f) => new Uint8Array(readFileSync(join(A, f)));
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(rd('BLOCKS.BSA'));
  const arch = new Arch3dFile(); arch.load(rd('ARCH3D.BSA'));
  const locs = [];
  for (let r = 0; r < maps.regionCount; r++) { const region = maps.getRegion(r); if (!region) continue; for (let l = 0; l < region.locationCount; l++) { const L = maps.getLocation(r, l); if (L) locs.push(L); } }
  const models = new Map();
  const model = (id) => {
    if (!models.has(id)) { const c = customModelFor(id); const i = c ? -1 : arch.getRecordIndex(id); models.set(id, c ?? (i === -1 ? null : dfMeshToModel(patchSeams(id, arch.getMesh(i)), () => ({ width: 1, height: 1 })))); }
    return models.get(id);
  };
  const R2 = SD_THROUGH_SIZE_M / 2;
  let entries = 0, stood = 0;
  for (const loc of sdTemplates(locs, isMainStoryDungeon).slice(0, 40)) {
    const dungeon = layoutDungeon(loc, blocks, (id) => model(id) ?? emptyModel());
    const collider = new Collider(() => -Infinity), actions = new ActionSystem(collider, {});
    const exits = [];
    for (const [bi, b] of dungeon.blocks.entries()) {
      const origin = trs(b.originX, 0, b.originZ, 0, 0, 0);
      for (const pl of b.layout.placements) {
        const cpu = model(pl.modelIdNum); if (!cpu) continue;
        const m = multiply(origin, pl.matrix), cls = pl.action ? classifyPlacementAction(pl.action.actionFlag, false) : null;
        if (cls === 'move') { actions.addAction(bi, pl.position, cpu, m, pl.action); continue; }
        if (cls === 'specialDoor') { actions.addSpecialDoor(bi, pl.position, cpu, m, pl.action); continue; }
        collider.addMesh('dungeon', cpu.positions, cpu.indices, m);
      }
      for (const d of b.layout.actionDoors) { if (d.disabled) continue; const cpu = model(d.modelIdNum); if (cpu) actions.addDoor(cpu, multiply(origin, d.matrix), { ns: bi, positionKey: d.position, action: d.action, startingLockValue: d.startingLockValue, loadID: d.loadID }); }
      for (const door of b.layout.exitDoors) if (isDungeonExitDoor(door)) exits.push({ ...door, matrix: multiply(origin, door.matrix) });
    }
    // the host's own water: the block's surface (dungeonContext.js waterSurfaceYAt), 10000 none
    const water = (x, z) => { const b = dungeon.blocks.find((q) => x >= q.originX && x < q.originX + RDB_SIDE && z >= q.originZ && z < q.originZ + RDB_SIDE); const lv = b?.layout?.waterLevel; return lv == null || lv === 10000 ? null : -lv * GLOBAL_SCALE; };
    const probe = { ...sdProbeOf(collider), water };
    const mk = dungeon.startMarker; if (!mk) continue;
    const feet = floorLanding(collider, [mk.x, mk.y + 1.08, mk.z]);
    const near = closestDoorTo(feet, exits); if (!near) continue;
    const yaw = Math.atan2(near.normal[0], near.normal[2]);   // the host's entry facing: away from the way out
    entries++;
    const p = sdThroughPlace(feet, yaw, probe);
    if (!p) continue;
    stood++;
    // asked again here, by the collider itself: its disc in its plane, its top under the ceiling, a way past, dry
    const c = [p.at[0], p.at[1] + riftCentreY(p.size), p.at[2]];
    for (let k = 0; k <= 8; k++) {
      if (k === 4) continue;
      const a = (k * Math.PI) / 8, dir = [-p.face[2] * Math.cos(a), Math.sin(a), p.face[0] * Math.cos(a)];
      assert.equal(probe.ray(c, dir, R2 + SD_RIFT_AIR_M), null, `${loc.name}: its disc clear at ${k}/8`);
    }
    assert.equal(probe.ray(c, [0, 1, 0], R2 + SD_RIFT_AIR_M), null, `${loc.name}: under its ceiling`);
    const chest = [p.at[0], p.at[1] + 1.2, p.at[2]], past = R2 + SD_RIFT_AIR_M + SD_THROUGH_PASS_M;
    assert.ok(probe.ray(chest, [-p.face[2], 0, p.face[0]], past) == null || probe.ray(chest, [p.face[2], 0, -p.face[0]], past) == null, `${loc.name}: a way past it`);
    const wl = water(p.at[0], p.at[2]);
    assert.ok(wl == null || p.at[1] >= wl, `${loc.name}: dry`);
  }
  assert.equal(entries, 40, 'every template\'s entry asked');
  assert.ok(stood >= 25, `most stand at once: ${stood} of ${entries}`);
});
