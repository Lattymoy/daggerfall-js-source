// BLOOD5 (2026-09-30, Mac, with a shot of a corpse ringed by a starburst: "the blood splatter is too perfect of a
// circle ... more variety, and less perfect patterns ... make it where blood droplets emit and fall on the exact
// locations where the texture will be"). The drops fly - each lands on the very point its mark is laid at - the spray
// falls in lobes rather than on an even turn, and the atlas's shapes are grown from noise at 128 texels a cell.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createBloodMarks, dropArc, dropAt, DROP_GRAVITY, DROP_LAUNCH, DRIP_LAUNCH, DROP_CEILING_SPARE, MAX_FLYING, DROP_QUAD,
} from '../../src/combat/blood/bloodMarks.js';
import { SURFACE_LIFT, impactStretch, STREAK_MAX } from '../../src/combat/blood/bloodDecals.js';
import {
  buildBloodAtlas, atlasBuilder, bloodDropletArt, bloodNoise, smin, taperDist, mulberry32,
  ATLAS_SIZE, ATLAS_CELLS, ATLAS_KINDS, BLOOD_ATLAS_ARCHIVE, BLOOD_DROP_RECORD, DROP_ART_SIZE,
} from '../../src/combat/blood/bloodArt.js';
import { bloodDecalDeps } from '../../src/combat/blood/bloodSwitch.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('BLOOD5: a droplet\'s arc is SOLVED to end on its landing - down from a flick, up with room to spare', () => {
  const rng = mulberry32(5);
  for (let k = 0; k < 200; k++) {
    const from = [rng() * 4 - 2, 1 + rng(), rng() * 4 - 2];
    const to = [from[0] + rng() * 3 - 1.5, rng() * 0.5, from[2] + rng() * 3 - 1.5];
    const arc = dropArc(from, to, rng);
    assert.ok(arc && arc.T > 0, 'a floor below is always reachable');
    assert.ok(arc.vy >= DROP_LAUNCH.min && arc.vy <= DROP_LAUNCH.max, 'a flick upward');
    const f = { from, to, ...arc };
    const end = dropAt(f, arc.T);
    assert.deepEqual(end, to, 'at T it IS the landing, to the bit');
    assert.ok(close(from[1] + arc.vy * arc.T - 0.5 * DROP_GRAVITY * arc.T * arc.T, to[1], 1e-9), 'and the arc itself gets there - no jump onto the mark at the last frame');
    assert.deepEqual(dropAt(f, 0), from, 'at zero it is the wound');
    assert.deepEqual(dropAt(f, arc.T * 5), to, 'and never past it');
    // the vertical really is ballistic: the closed form, mid-flight
    const t = arc.T * 0.4, mid = dropAt(f, t);
    assert.ok(close(mid[1], from[1] + arc.vy * t - 0.5 * DROP_GRAVITY * t * t, 1e-9));
    assert.ok(close(mid[0], from[0] + (to[0] - from[0]) * 0.4, 1e-9), 'straight across in plan');
    // it rises first (a flick) and lands falling
    assert.ok(dropAt(f, Math.min(arc.T * 0.5, arc.vy / DROP_GRAVITY / 2))[1] > from[1], 'up first');
    assert.ok(arc.vy - DROP_GRAVITY * arc.T < 0, 'and falling when it lands');
  }
  // a CEILING: thrown hard enough to reach it, still rising when it lands
  const up = dropArc([0, 1, 0], [0.3, 3, 0], () => 0.5);
  const need = Math.sqrt(2 * DROP_GRAVITY * 2);
  assert.ok(up.vy >= need * DROP_CEILING_SPARE.min && up.vy <= need * DROP_CEILING_SPARE.max);
  assert.ok(up.vy - DROP_GRAVITY * up.T > 0, 'still rising');
  assert.ok(close(1 + up.vy * up.T - 0.5 * DROP_GRAVITY * up.T * up.T, 3, 1e-9), 'and it reaches the ceiling on its own arc');
  for (const u of [0, 0.3, 0.999]) { const a = dropArc([0, 1, 0], [0, 3.4, 0], () => u); assert.ok(close(1 + a.vy * a.T - 0.5 * DROP_GRAVITY * a.T * a.T, 3.4, 1e-9), `at every roll (${u})`); }
  assert.deepEqual(dropAt({ from: [0, 1, 0], to: [0.3, 3, 0], ...up }, up.T), [0.3, 3, 0]);
  // a wall's run starts at the wound's height: a flick up and back down
  const level = dropArc([0, 1, 0], [0.5, 1, 0], () => 0.5);
  assert.ok(close(level.T, 2 * level.vy / DROP_GRAVITY, 1e-12));
  assert.equal(dropArc([0, 1, 0], [0, NaN, 0]), null, 'a landing that is not a place is not an arc');
  // a launch of the caller's: a bleed's drip barely flicks
  for (const u of [0, 0.5, 0.999]) { const a = dropArc([0, 0.5, 0], [0.1, 0, 0], () => u, DROP_GRAVITY, DRIP_LAUNCH); assert.ok(a.vy >= DRIP_LAUNCH.min && a.vy <= DRIP_LAUNCH.max); }
  assert.ok(DRIP_LAUNCH.max < DROP_LAUNCH.min, 'less than any blow\'s flick');
});

test('BLOOD5: a flown drop\'s stain is as long as its impact was flat - one over the sine of the angle - so most land round', () => {
  assert.equal(impactStretch(0, 5), 1, 'straight down: round');
  assert.ok(close(impactStretch(5, 5), Math.SQRT2), 'forty-five degrees: root two');
  assert.equal(impactStretch(50, 1), STREAK_MAX, 'skimming: capped');
  assert.equal(impactStretch(1, 0), STREAK_MAX);
  assert.equal(impactStretch(NaN, 5), 1); assert.equal(impactStretch(-3, -4), 5 / 4, 'the speeds\' sizes, whichever way');
  // on a live pool: a drop's stretch and its kind are its arc's - most of an ordinary spray lands steep and round
  const { marks } = rig();
  marks.place(0, [0, 1.1, 0], { damage: 80, maxHealth: 40 });
  const fl = marks.flying();
  for (const f of fl) {
    if (f.land.opts.along == null) continue;   // a wall's run or a ceiling's - their own laws
    const across = Math.hypot(f.to[0] - f.from[0], f.to[2] - f.from[2]) / f.T;
    assert.ok(close(f.land.opts.stretch, impactStretch(across, f.vy - DROP_GRAVITY * f.T)), 'the arc\'s own angle');
    assert.equal(f.land.kind, f.land.opts.stretch > 1.5 ? 'streak' : 'spatter');
  }
  const floorDrops = fl.filter((f) => f.land.opts.along != null && close(f.to[1], 0));
  assert.ok(floorDrops.filter((f) => f.land.kind === 'spatter').length > floorDrops.length / 2, 'most land round - no wheel of spokes');
});

/** A floor at y = 0 and a ceiling at CEIL, over open ground; a wall at x = WALL for rays heading +x. */
const CEIL = 2.4, WALL = 1.2;
const room = () => ({
  surfaceHit: (from, dir, max) => (dir[1] > 0
    ? (CEIL - from[1] <= max ? { dist: CEIL - from[1], normal: [0, -1, 0] } : null)
    : (from[1] <= max ? { dist: from[1], normal: [0, 1, 0] } : null)),
  raycastHit: (from, dir, max) => {
    if (!(dir[0] > 0) || from[0] >= WALL) return { dist: Infinity, normal: null };
    const d = (WALL - from[0]) / dir[0];
    return d <= max ? { dist: d, normal: [-1, 0, 0] } : { dist: Infinity, normal: null };
  },
});
function rig({ flight = true, capacity = 512, rng = mulberry32(9) } = {}) {
  const log = { uploads: [], made: [], moved: 0, drawn: [], destroyed: [] };
  const renderer = {
    createDecalBatch: (cap) => ({ cap }),
    writeDecalSlot: () => true,
    drawDecals: () => {},
    uploadTexture: (archive, record, img, opts) => { log.uploads.push({ archive, record, w: img.width, opts }); return { key: `${archive}_${record}` }; },
    createBillboardBatch: (archive, record, size, centers, opts) => { const b = { archive, record, size, n: centers.length, opts, centers, noShadow: undefined }; log.made.push(b); return b; },
    moveBillboardBatch: (b, centers) => { log.moved++; b.centers = centers; return true; },
    drawBillboards: (batches) => { log.drawn.push(batches); },
    destroyBillboardBatch: (b) => { log.destroyed.push(b); },
  };
  let on = true;
  const settings = { enabled: () => on, capacity: () => capacity, density: () => 1, overkill: () => false, flight: () => flight };
  const marks = createBloodMarks({ renderer, collider: () => room(), settings, rng });
  return { marks, log, off: () => { on = false; } };
}
const TOP = { damage: 80, maxHealth: 40, fromPlayer: true, heavy: false, throw: [0.3, 0] };   // the ladder's top rung, thrown toward the wall

test('BLOOD5: the pool lands at once, every other drop FLIES - and lays its mark on the very point its arc ends', () => {
  const { marks, log } = rig();
  const pool = marks.place(0, [0, 1.1, 0], TOP);
  assert.ok(pool, 'the pool is laid with the blow - "a hit stains where it happened"');
  assert.equal(pool.uv.kind, 'pool');
  assert.equal(marks.count(), 1, 'and nothing else yet');
  const flying = marks.flying();
  assert.equal(flying.length, 23, 'the rest of the top rung is in the air');
  assert.ok(flying.every((f) => close(f.from[1], 1.1) && f.age === 0), 'from the wound');
  // landings: the floor, the ceiling (one drop in four looks up) and the wall at WALL
  assert.ok(flying.some((f) => close(f.to[1], 0)), 'some are headed for the floor');
  assert.ok(flying.some((f) => close(f.to[1], CEIL)), 'some for the ceiling');
  assert.ok(flying.some((f) => close(f.to[0], WALL)), 'some for the wall');
  // fly them in frames, and check every mark against the arc that laid it
  const byTo = new Map(flying.map((f) => [f.to, f]));
  const seen = new Set([pool]);
  let frames = 0;
  while (marks.flying().length && frames < 400) {
    marks.tick(1 / 60); frames++;
    for (const d of marks._pool().decals()) {
      if (seen.has(d)) continue;
      seen.add(d);
      // the mark sits at its landing, lifted off the surface along its normal - and a droplet ended exactly there
      const landing = [d.pos[0] - d.normal[0] * SURFACE_LIFT, d.pos[1] - d.normal[1] * SURFACE_LIFT, d.pos[2] - d.normal[2] * SURFACE_LIFT];
      const f = [...byTo.values()].find((x) => x.to.every((v, i) => close(v, landing[i], 1e-9)));
      if (!f) {
        // the one other thing that lays a mark here: a ceiling's DRIP, straight under where a droplet struck it
        assert.ok(flying.some((x) => close(x.to[1], CEIL) && close(x.to[0], landing[0]) && close(x.to[2], landing[2])),
          `a mark at ${landing.map((v) => v.toFixed(3))} is the end of a droplet's arc, or a ceiling's drip under one`);
        continue;
      }
      assert.ok(close(marks.clock(), Math.ceil(f.T * 60) / 60, 1 / 60 + 1e-9), 'laid the frame it arrived, not before');
      byTo.delete(f.to);
    }
  }
  assert.equal(marks.flying().length, 0, 'all landed');
  assert.ok(frames < 90, `inside a second and a half (${frames} frames)`);
  assert.equal(byTo.size, 0, 'every droplet laid its mark');
  assert.ok(marks.count() >= 24, 'the whole spray, in the end (and the drips the ceiling let go of)');
  assert.ok(marks.drips().length > 0, 'and a ceiling that took blood lets it go');
  // the batch: built once, on the first frame of flight, the droplet's own art uploaded with it
  assert.equal(log.made.length, 1, 'ONE batch for the pool\'s life');
  const b = log.made[0];
  assert.deepEqual([b.archive, b.record, b.n, b.size, b.opts], [BLOOD_ATLAS_ARCHIVE, BLOOD_DROP_RECORD, MAX_FLYING, DROP_QUAD, { dynamic: true }]);
  assert.equal(b.noShadow, true, 'a droplet casts no shadow');
  assert.ok(log.uploads.some((u) => u.record === BLOOD_DROP_RECORD && u.w === DROP_ART_SIZE && !u.opts?.smooth), 'the droplet, uploaded for the cutout pass');
  assert.ok(log.moved > 10, 'its centres rewritten as they fly');
});

test('BLOOD5: the droplets DRAW while they fly and not after; a spare quad sits on a live drop; the room, the switch and the frame take them', () => {
  const { marks, log, off } = rig();
  marks.place(0, [0, 1.1, 0], TOP);
  marks.tick(1 / 60);
  const b = log.made[0];
  const live = marks.flying().map((f) => f.pos);
  assert.ok(b.centers.slice(0, live.length).every((c, i) => c.every((v, j) => v === live[i][j])), 'the live drops, first');
  assert.ok(b.centers.slice(live.length).every((c) => c.every((v, j) => v === live[0][j])), 'every spare on the first live drop - a cutout drawn twice is the same pixels');
  assert.equal(marks.draw([1, 0, 0], [0, 1, 0]), true);
  assert.ok(log.drawn.some((batches) => batches.includes(b)), 'drawn over the marks');
  // a recentre carries the whole arc - so it still lands on its mark
  const before = marks.flying()[0];
  const to = [...before.to], from = [...before.from];
  marks.shiftOrigin([819.2, 0, -819.2]);
  const after = marks.flying()[0];
  assert.deepEqual(after.to, [to[0] + 819.2, to[1], to[2] - 819.2]);
  assert.deepEqual(after.from, [from[0] + 819.2, from[1], from[2] - 819.2]);
  // a room thrown away takes the drops in the air; the batch stays, the pool's for life
  marks.clear();
  assert.equal(marks.flying().length, 0);
  log.drawn.length = 0;
  marks.draw([1, 0, 0], [0, 1, 0]);
  assert.ok(!log.drawn.some((batches) => batches.includes(b)), 'nothing in the air, nothing drawn');
  // the switch off takes them too, and lays nothing
  marks.place(0, [0, 1.1, 0], TOP);
  const n = marks.count();
  off();
  marks.tick(2);
  assert.equal(marks.flying().length, 0);
  assert.equal(marks.count(), n, 'no mark laid by a drop that was in the air when blood went off');
  // dispose frees the batch
  marks.dispose();
  assert.deepEqual(log.destroyed, [b]);
});

test('BLOOD5: a wounded body\'s drip FALLS from the knee - it is carried, not flung', () => {
  const { marks } = rig();
  marks.drip(0, [0, 0, 0], 6);
  const fl = marks.flying();
  assert.ok(fl.length > 0, 'the drip flies too');
  assert.ok(fl.every((f) => f.vy >= DRIP_LAUNCH.min && f.vy <= DRIP_LAUNCH.max), 'with a drip\'s launch, not a blow\'s');
  assert.ok(fl.every((f) => f.land.opts.stretch === 1), 'and lands round - a drip does not streak');
});

test('BLOOD5: without flight (a pin\'s bag, a renderer that cannot fly them) every mark lands at once; past MAX_FLYING the rest land at once', () => {
  const still = rig({ flight: false });
  still.marks.place(0, [0, 1.1, 0], TOP);
  assert.equal(still.marks.count(), 24, 'the whole spray with the blow, as before this slice');
  assert.equal(still.marks.flying().length, 0);
  assert.equal(bloodDecalDeps.flight(), true, 'every host flies them');
  const busy = rig();
  let blows = 0;
  while (busy.marks.flying().length < MAX_FLYING - 10) { busy.marks.place(0, [blows * 0.01, 1.1, 0], TOP); blows++; }
  const laid = busy.marks.count();
  busy.marks.place(0, [0, 1.1, 0], TOP);
  assert.equal(busy.marks.flying().length, MAX_FLYING, 'the batch is full');
  assert.ok(busy.marks.count() > laid + 1, 'and the drops that had no room landed with the blow');
});

test('BLOOD5 art: 128-texel cells, the same sheet however it was stepped, and shapes that are not round', () => {
  assert.equal(ATLAS_SIZE / ATLAS_CELLS, 128, 'a cell is 128 texels');
  const whole = buildBloodAtlas();
  // stepped a cell at a time (the idle prewarm's way) it is the same picture to the byte
  const b = atlasBuilder();
  let steps = 0;
  while (!b.step()) steps++;
  assert.equal(steps + 1, ATLAS_CELLS * ATLAS_KINDS.length, 'a step a cell');
  assert.equal(Buffer.compare(Buffer.from(b.atlas.colors.buffer), Buffer.from(whole.colors.buffer)), 0);
  assert.equal(b.step(), true, 'and a finished builder stays finished');
  // NOT ROUND: perimeter squared over 4 pi area - a disc is about one; a
  // pool is ragged, a spatter throws tendrils, a streak is long
  const cell = ATLAS_SIZE / ATLAS_CELLS;
  const ratio = (row, col) => {
    const on = (x, y) => x >= 0 && y >= 0 && x < cell && y < cell && whole.colors[((row * cell + y) * ATLAS_SIZE + col * cell + x) * 4 + 3] > 128;
    let area = 0, edge = 0;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      if (!on(x, y)) continue;
      area++;
      if (!on(x + 1, y) || !on(x - 1, y) || !on(x, y + 1) || !on(x, y - 1)) edge++;
    }
    return edge * edge / (4 * Math.PI * area);
  };
  const floor = { pool: 1.2, spatter: 3.5, streak: 1.8 };
  for (const [kind, min] of Object.entries(floor)) {
    const row = ATLAS_KINDS.indexOf(kind);
    const rs = Array.from({ length: ATLAS_CELLS }, (_, col) => ratio(row, col));
    for (const r of rs) assert.ok(r > min, `${kind}: ragged (${r.toFixed(2)} > ${min})`);
    assert.ok(Math.max(...rs) - Math.min(...rs) > 0.3, `${kind}: and no two alike (${rs.map((r) => r.toFixed(2))})`);
  }
  // a disc of the same size, for the scale of that number
  const disc = (() => { let area = 0, edge = 0; const r = 40, on = (x, y) => (x - 64) ** 2 + (y - 64) ** 2 <= r * r; for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { if (!on(x, y)) continue; area++; if (!on(x + 1, y) || !on(x - 1, y) || !on(x, y + 1) || !on(x, y - 1)) edge++; } return edge * edge / (4 * Math.PI * area); })();
  assert.ok(disc < 1, `a disc scores under one (${disc.toFixed(2)})`);
});

test('BLOOD5 art: the noise, the melt and the run - and the droplet the flight wears', () => {
  const { n, fbm } = bloodNoise(mulberry32(1));
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < 2000; k++) { const v = fbm(k * 0.173, k * 0.071, 3); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(lo >= -1 && hi <= 1 && hi - lo > 0.6, 'fractal noise, bounded, and it moves');
  assert.ok(close(n(0.5, 0.5), n(64.5, 64.5), 1e-12), 'the lattice wraps');
  assert.ok(Math.abs(n(3.001, 2) - n(3, 2)) < 0.01, 'and it is smooth');
  // a smooth minimum is never above either, and melts two near things together
  assert.ok(smin(0.3, 0.5, 0.1) <= 0.3 && close(smin(0.3, 5, 0.1), 0.3), 'far apart, it is the minimum');
  assert.ok(smin(0.3, 0.3, 0.1) < 0.3, 'close together, it is less - the join fills');
  // a tapered run: its own half-widths at its two ends
  assert.ok(close(taperDist(0, 0.2, 0, 0, 0.2, 1, 0, 0.05), 0));
  assert.ok(close(taperDist(1, 0.05, 0, 0, 0.2, 1, 0, 0.05), 0));
  assert.ok(taperDist(0.5, 0, 0, 0, 0.2, 1, 0, 0.05) < 0, 'inside along its line');
  // the droplet: a cutout (alpha 0 or 255 only), red, darker at the rim, a glint
  const d = bloodDropletArt();
  assert.equal(d, bloodDropletArt(), 'made once');
  assert.deepEqual([d.width, d.height], [DROP_ART_SIZE, DROP_ART_SIZE]);
  let shown = 0, glint = 0;
  for (let k = 0; k < d.colors.length; k += 4) {
    const a = d.colors[k + 3];
    assert.ok(a === 0 || a === 255, 'a cutout - the billboard pass has no soft edge');
    if (!a) continue;
    shown++;
    assert.ok(d.colors[k] > d.colors[k + 1] && d.colors[k] > d.colors[k + 2], 'red');
    if (d.colors[k + 1] > 60) glint++;
  }
  assert.ok(shown > DROP_ART_SIZE * DROP_ART_SIZE * 0.25 && shown < DROP_ART_SIZE * DROP_ART_SIZE * 0.7, 'a bead with room round it');
  assert.ok(glint > 0 && glint < shown * 0.15, 'one small glint');
});
