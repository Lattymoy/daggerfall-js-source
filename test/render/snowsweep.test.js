// SNOW-SWEEP (2026-10-23, after OW-HITCH's re-measure in the real game: "spread snowCoverHost's sweep across frames under
// the snow budget"; bible/07-Rendering/Performance-Priority.md SNOW-SWEEP) - THE SWEEP KEEPS THE SNOW'S FRAME BUDGET. The
// frame's sweep checked every flat of every standing pixel in one frame - 40-70 ms on an i9 at each lattice cell the
// window moved (every two map pixels), the most frequent hitch of a fast Overworld journey. Held here: the frame walks it
// a slice a frame within what the frame's snow budget has left, and marks what the whole sweep marks, in its order; a
// forest pixel's flats past the deadline are the next frame's; a window that moves holds the sweep until it stands again;
// a pixel built again meanwhile is checked from its first flat.
//
// The host's clock moves a fixed step at every read, so a budget is a count of the host's own reads - the same on every
// machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { latticeKey } from '../../src/systems/weather/snowpack.js';
import { createSnowCoverHost, SNOW_COVER } from '../../src/scenes/snowCoverHost.js';
import { SEASON } from '../../src/world/climateSwaps.js';
import { setAirGround } from '../../src/systems/weather/airTemperature.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';

/** an autumn's minute in the Woodlands (bare ground: the real lines dress nothing in winter) */
const T = (406 * 360 + 215) * 1440 + 30;
/** lines that lay no snow below 5 km, and lines that lay it whole from below the sea */
const BARE = [5000, 5000, 5000], WHOLE = [-800, -700, -600];
const READ_MS = 0.25;

/**
 * A window standing about pixel (200, 100) at T, over the stream's pixels `built`; `clk.ms` the host's clock, moved
 * READ_MS at every read. `setAll` lays one line on every lattice point about the stream (the `build` lines the sweep reads).
 */
async function rig(built) {
  const clk = { ms: 0, per: READ_MS }, marked = [];
  const state = { compensation: [0, 0, 0], current: { x: 200, y: 100 } };
  const host = createSnowCoverHost({
    renderer: { tileArrays: new Map() }, climateAt: () => CLIMATES.Woodlands, mapHeight: 500, stateOf: () => state, builtOf: () => built,
    owns: () => true, markReskin: (k) => marked.push(k), markRebuild: () => {}, now: () => T, place: () => ({ px: 200, py: 100 }),
    clock: () => (clk.ms += clk.per),
  });
  await host.settle({ left: () => Infinity, breathe: async () => {} });
  const setAll = (line) => {
    for (let j = 40; j <= 60; j++) {
      for (let i = 90; i <= 110; i++) {
        const l = host._lines.get(latticeKey(i, j));
        if (l) l.build = Float32Array.from(line);
      }
    }
  };
  /** a frame: the clock past the shared budget's window, then the tick; answers the clock the tick spent */
  const frame = (px = 200, py = 100) => { clk.ms += SNOW_COVER.frameMs + 1; const t0 = clk.ms; host.tick({ px, py, dt: 0 }); return clk.ms - t0; };
  return { host, marked, clk, setAll, frame };
}
/** pixel (px, py)'s kept decisions: its buildings' season at 100 m and its flats at `alts` (metres above the sea), each
 *  taken under BARE - so summer */
function standing(host, px, py, { alts = [], usesSeason = true } = {}) {
  const r = host.recorder(px, py);
  if (usesSeason) r.pixel(100, SEASON.Summer);
  for (let k = 0; k < alts.length; k++) r.flat((k * 37) % 800, (k * 53) % 800, alts[k], SEASON.Summer);
  return { px, py, _snow: r.done(usesSeason) };
}
const withGround = async (fn) => {
  setAirGround({ climateAt: () => CLIMATES.Woodlands, groundAt: () => 0, topAt: () => 900 });
  try { await fn(); } finally { setAirGround(null); }
};

test('SNOW-SWEEP the frame walks the sweep a slice a frame within the snow\'s budget, and marks what the whole sweep marks, every one, nearest first (mutants: the whole sweep in one frame)', () => withGround(async () => {
  // forty pixels about the player, stood in a scrambled order, each wearing summer buildings
  const coords = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -4; dx <= 3; dx++) coords.push([200 + dx, 100 + dy]);
  coords.sort((a, b) => ((a[0] * 7 + a[1] * 13) % 11) - ((b[0] * 7 + b[1] * 13) % 11));
  const sliced = new Map(), whole = new Map();
  const a = await rig(sliced), b = await rig(whole);
  for (const r of [a, b]) {
    r.setAll(BARE);
    for (const [px, py] of coords) (r === a ? sliced : whole).set(`${px},${py}`, standing(r.host, px, py));
    r.setAll(WHOLE);
  }
  const expected = b.host.sweep();
  assert.equal(expected.length, 40, 'the whole sweep: every one due');
  const spends = [];
  let frames = 0;
  do { spends.push(a.frame()); frames++; assert.ok(frames < 100, 'it ends'); } while (a.host.sweeping);
  assert.ok(frames >= 3, `walked over ${frames} frames`);
  assert.deepEqual(a.marked, expected, 'the same pixels, in the same order: nearest first');
  // a frame's tick spends its budget and a read or two past it at the most (the window's own reads beside it)
  for (const ms of spends) assert.ok(ms <= SNOW_COVER.budgetMs + 4 * READ_MS, `a frame spent ${ms} ms`);
}));

test('SNOW-SWEEP a forest pixel\'s flats past the deadline are the next frame\'s: its one flat that turns is its last, and the frame that reaches it is not the first (mutants: the deadline read only between pixels)', () => withGround(async () => {
  const built = new Map();
  const r = await rig(built);
  r.setAll(BARE);
  const alts = new Array(1000).fill(0);
  alts[999] = 3000;   // under [1000, 1500, 2000] the one flat above the snowline turns, every other stays bare
  built.set('200,100', standing(r.host, 200, 100, { alts, usesSeason: false }));
  r.setAll([1000, 1500, 2000]);
  const first = r.frame();
  assert.deepEqual(r.marked, [], 'the first frame stopped inside the pixel');
  assert.equal(r.host.sweeping, true);
  assert.ok(first <= SNOW_COVER.budgetMs + 4 * READ_MS, `the first frame spent ${first} ms`);
  let frames = 1;
  while (r.host.sweeping) { r.frame(); frames++; assert.ok(frames < 100, 'it ends'); }
  assert.deepEqual(r.marked, ['200,100'], 'its last flat found');
}));

test('SNOW-SWEEP a pixel built again while its sweep stands part-way is checked from its first flat (mutants: the flat it stopped before kept for the new build)', () => withGround(async () => {
  const built = new Map();
  const r = await rig(built);
  r.setAll(BARE);
  const alts = new Array(1000).fill(0);
  built.set('200,100', standing(r.host, 200, 100, { alts, usesSeason: false }));
  r.setAll([1000, 1500, 2000]);
  r.frame();
  assert.equal(r.host.sweeping, true, 'part-way through the pixel');
  // built again: two hundred flats, its tenth above the snowline - before the flat the sweep stopped at
  r.setAll(BARE);
  const again = new Array(200).fill(0);
  again[10] = 3000;
  built.set('200,100', standing(r.host, 200, 100, { alts: again, usesSeason: false }));
  r.setAll([1000, 1500, 2000]);
  let frames = 0;
  while (r.host.sweeping) { r.frame(); frames++; assert.ok(frames < 100, 'it ends'); }
  assert.deepEqual(r.marked, ['200,100'], 'its tenth flat found');
}));

test('SNOW-SWEEP two asks in one frame share its budget: a second tick inside the frame sweeps one pixel at the most (mutants: a budget of the sweep\'s own)', () => withGround(async () => {
  const built = new Map();
  const r = await rig(built);
  r.setAll(BARE);
  for (let dx = -10; dx < 10; dx++) for (let dy = -2; dy <= 2; dy++) built.set(`${200 + dx},${100 + dy}`, standing(r.host, 200 + dx, 100 + dy));
  r.setAll(WHOLE);
  r.frame();
  const after1 = r.marked.length;
  assert.ok(after1 > 0 && after1 < built.size, `the first frame ${after1} of ${built.size}`);
  r.host.tick({ px: 200, py: 100, dt: 0 });   // inside the same frame
  assert.ok(r.marked.length - after1 <= 1, `a second ask in the frame: ${r.marked.length - after1} more`);
}));

test('SNOW-SWEEP a window that moves holds the sweep until it stands again, then begins it again on the lines it reads (mutants: the sweep walked while the window catches up)', () => withGround(async () => {
  const built = new Map();
  const r = await rig(built);
  r.setAll(BARE);
  for (let dx = -10; dx < 10; dx++) for (let dy = -2; dy <= 2; dy++) built.set(`${200 + dx},${100 + dy}`, standing(r.host, 200 + dx, 100 + dy));
  r.setAll(WHOLE);
  r.frame();
  const before = r.marked.length;
  assert.ok(before > 0 && r.host.sweeping, 'a sweep part-way');
  // a lattice cell east: the window catches up its new edge's year (a read a point-step: the clock's step made small,
  // so the year is a few frames), and the lines it then reads are the autumn's own (bare)
  r.clk.per = 0.001;
  let frames = 0;
  do { r.frame(203, 100); frames++; assert.ok(frames < 2000, 'the window stands again'); } while (!r.host.ready);
  r.clk.per = READ_MS;
  assert.ok(frames > 1, `caught up over ${frames} frames`);
  assert.equal(r.marked.length, before, 'nothing marked off the kept lines while it caught up');
  while (r.host.sweeping) r.frame(203, 100);
  assert.equal(r.marked.length, before, 'begun again on the autumn\'s lines: nothing due');
}));
