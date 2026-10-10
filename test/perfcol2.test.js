// PERF-COL2 (2026-10-10, the owner: "performance must be highest priority now ... prob caused by placed objects by
// players, crowded places and render range"): A STREAMED PIXEL'S BUCKETS ARE FILED BY PLACE (player/collider.js
// onFloatingFrame, BROAD_COARSE_CELL; bible/07-Rendering/Performance-Priority.md PERF-COL2).
//
// Every streamed pixel's collider bucket rides the floating origin (a translation provider), so FB0930-FRAME's broad
// phase asked every one of them on every ray and every sphere - and each spans its pixel, too wide for the fine cells
// besides. A capsule's move cost ~0.03 ms with one pixel streamed, ~0.14 at the default view (121 pixels) and ~0.2 at
// the widest (169): for the player and every foe, every step - the collider's bill grew with the render range. Now a
// provider marked as riding a floating frame is filed where it stands while its frame stands (one of its buckets asked
// where it stands each query - the frame's sentinel - and the filing made again the query after it moved), and a
// bucket too wide for the fine cells is filed on coarse ones.
//
// ONE: every answer is the old walk's - rays, casts, spheres, contacts and moves, over a streamed world of pixel
// buckets, standing wide ones, a turned rider and a plain mover, before and after the frame moves under them. TWO: the
// work - a short probe asks the buckets near it and the frame's one sentinel, where the old walk asked every one. THREE:
// the world host marks every streamed pixel's bucket as riding its state, and only those.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider, onFloatingFrame } from '../src/player/collider.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const at = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
function quads(list) {
  const pos = [], idx = [];
  for (const [a, b, c, d] of list) { const n = pos.length / 3; pos.push(...a, ...b, ...c, ...d); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); }
  return [new Float32Array(pos), new Uint32Array(idx)];
}
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
/** A pixel this wide - over the fine cells' 64, on four coarse ones. */
const PIXEL = 300;
/** A pixel's town, pixel-local: a floor and a dozen walled houses with a doorway each, laid by the seed. */
function town() {
  const list = [[[0, 0, 0], [0, 0, PIXEL], [PIXEL, 0, PIXEL], [PIXEL, 0, 0]]];
  for (let h = 0; h < 12; h++) {
    const x = 10 + rnd() * (PIXEL - 40), z = 10 + rnd() * (PIXEL - 40), w = 6 + rnd() * 10, y = rnd() * 2;
    list.push([[x, y, z], [x, y + 4, z], [x + w, y + 4, z], [x + w, y, z]]);
    list.push([[x, y, z + w], [x + w, y, z + w], [x + w, y + 4, z + w], [x, y + 4, z + w]]);
    list.push([[x, y, z], [x, y, z + w * 0.4], [x, y + 4, z + w * 0.4], [x, y + 4, z]]);   // the doorway's two jambs
    list.push([[x, y, z + w * 0.6], [x, y, z + w], [x, y + 4, z + w], [x, y + 4, z + w * 0.6]]);
    list.push([[x + w, y, z], [x + w, y + 4, z], [x + w, y + 4, z + w], [x + w, y, z + w]]);
    list.push([[x, y + 4, z], [x, y + 4, z + w], [x + w, y + 4, z + w], [x + w, y + 4, z]]);
  }
  return quads(list);
}
/** The streaming world's frame: a map origin and a compensation, as StreamingWorldState keeps them. */
function frameState() {
  return { ox: 0, oy: 0, comp: [0, 0, 0], at(px, py, out) { out[0] = (px - this.ox) * PIXEL + this.comp[0]; out[1] = this.comp[1]; out[2] = -(py - this.oy) * PIXEL + this.comp[2]; return out; } };
}
/** 5 x 5 streamed pixels riding `st` (marked, or as main left them), two standing wide buckets, a turned rider, a mover. */
function world(st, mark) {
  seed = 7;
  const c = new Collider(() => -Infinity);
  for (let px = -2; px <= 2; px++) for (let py = -2; py <= 2; py++) {
    const [p, ix] = town();
    const t = ((o) => () => st.at(px, py, o))([0, 0, 0]);
    c.addMesh(`${px},${py}`, p, ix, I, mark ? onFloatingFrame(st, t) : t);
  }
  const [wp, wi] = town();
  c.addMesh('wide-standing', wp, wi, at(-900, -3, -900));   // too wide for the fine cells, standing: the coarse ones
  c.addMesh('wide-standing-2', wp, wi, at(400, 1, -1000));
  const [dp, di] = quads([[[0, 0, -1], [120, 0, -1], [120, 3, -1], [0, 3, -1]], [[0, 0, 1], [0, 3, 1], [120, 3, 1], [120, 0, 1]]]);   // a long thin wall: turned, its footprint is another
  const turn = [0, 0, -1, 0, 1, 0, 1, 0, 0];
  const turnedT = [0, 0, 0];
  c.addMesh('turned-rider', dp, di, I, mark ? onFloatingFrame(st, () => st.at(0, 0, turnedT)) : () => st.at(0, 0, turnedT), () => turn);
  const moverT = [40, 0, -60];
  c.addMesh('mover', dp, di, I, () => moverT);
  return c;
}
/** The old walk: every box widened, so every bucket is asked by every query, in the Map's order. */
function widened(c) {
  for (const b of c._buckets.values()) { b.min = [-Infinity, -Infinity, -Infinity]; b.max = [Infinity, Infinity, Infinity]; }
  return c;
}
function probes(n, s) {
  seed = s;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = [(rnd() - 0.5) * 1500, 0.2 + rnd() * 4, (rnd() - 0.5) * 1500];
    const a = rnd() * Math.PI * 2, d = [Math.sin(a), (rnd() - 0.5) * 0.4, Math.cos(a)];
    const l = Math.hypot(...d);
    out.push({ p, d: d.map((v) => v / l), reach: [0.3, 2, 12, 60][i % 4], mv: [(rnd() - 0.5) * 0.8, -rnd() * 0.3, (rnd() - 0.5) * 0.8], r: 0.3 + rnd() });
  }
  return out;
}
/** Probes along the turned rider's wall where it stands turned (x near the frame's corner, z along its length). */
function probesAlongTurned(st, n, s) {
  const t = st.at(0, 0, [0, 0, 0]);
  return probes(n, s).map((q, i) => ({ ...q, p: [t[0] + (i % 2 ? 1.6 : -1.6), 0.5 + (i % 3), t[2] + ((i * 37) % 240) - 120] }));
}
function sameAnswers(real, old, list) {
  let hits = 0, contacts = 0;
  for (const { p, d, reach, mv, r } of list) {
    const ha = real.raycastHit(p, d, reach), hb = old.raycastHit(p, d, reach);
    assert.deepEqual(ha, hb, `the ray from ${p}`);
    if (Number.isFinite(ha.dist)) hits++;
    assert.deepEqual(real.capsuleCast(p, [p[0], p[1] + 0.8, p[2]], 0.3, d, reach), old.capsuleCast(p, [p[0], p[1] + 0.8, p[2]], 0.3, d, reach), 'the capsule cast');
    assert.deepEqual(real.sphereCast(p, 0.25, d, reach), old.sphereCast(p, 0.25, d, reach), 'the sphere cast');
    assert.equal(real.sphereOverlaps(p, r), old.sphereOverlaps(p, r), 'the overlap');
    const feet = [p[0], p[1] - 0.2, p[2]];
    const ca = real.capsuleContact(feet, 1.8, 0.1), cb = old.capsuleContact(feet, 1.8, 0.1);
    assert.deepEqual(ca, cb, 'the contact');
    if (ca) contacts++;
    const fa = [...feet], fb = [...feet];
    assert.deepEqual(real.move(fa, mv[0], mv[1], mv[2], 1.8, true, true), old.move(fb, mv[0], mv[1], mv[2], 1.8, true, true), 'what the move reported');
    assert.deepEqual(fa, fb, 'and where it left the feet');
  }
  return { hits, contacts };
}

test('PERF-COL2: a streamed world filed by place answers every ray, cast, sphere, contact and move as the old walk did - and again after its frame moves under it, a crossing and a vertical recentre (mutants: the sentinel unasked; the coarse cells unasked; a turned rider filed by its untuned box)', () => {
  const st = frameState();
  const real = world(st, true), old = widened(world(st, false));
  sameAnswers(real, old, probesAlongTurned(st, 120, 3));   // the turned rider's wall, where it stands turned
  let { hits, contacts } = sameAnswers(real, old, probes(500, 99));
  st.ox += 1; st.comp[0] -= PIXEL;   // a crossing east: the frame moves, every pixel with it
  ({ hits, contacts } = ((a) => ({ hits: hits + a.hits, contacts: contacts + a.contacts }))(sameAnswers(real, old, probes(500, 100))));
  st.ox -= 3; st.oy += 2; st.comp[1] -= 40; st.comp[2] += 2 * PIXEL;   // a teleport's re-anchor, and a vertical recentre
  ({ hits, contacts } = ((a) => ({ hits: hits + a.hits, contacts: contacts + a.contacts }))(sameAnswers(real, old, probes(500, 101))));
  assert.ok(hits > 80 && contacts > 15, `a real sweep: ${hits} hits, ${contacts} contacts`);
});

test('PERF-COL2: the work - a short probe asks the buckets round it and the frame\'s one sentinel, where the old walk asked every pixel (mutant: the provider\'s mark unread)', () => {
  const st = frameState();
  const real = world(st, true), old = widened(world(st, false));
  const count = (c) => { let n = 0; for (const b of c._buckets.values()) { const t = b.t; b.t = () => { n++; return t(); }; } return () => n; };
  const nReal = count(real), nOld = count(old);
  for (const { p, d } of probes(200, 5)) { real.raycastHit(p, d, 2); old.raycastHit(p, d, 2); }
  assert.ok(nOld() >= 200 * 27, `the old walk asked every bucket that moves: ${nOld()}`);
  assert.ok(nReal() <= 200 * 8, `a short probe asks a few - the pixel under it, the sentinel, the two that ride no frame or turn: ${nReal()} for 200 probes`);
  const moved = (c) => { const fa = [10, 0.1, 10]; c.move(fa, 0.3, -0.1, 0.2, 1.8, true, true); };
  const a0 = nReal(), b0 = nOld();
  moved(real); moved(old);
  assert.ok((nOld() - b0) > 3 * (nReal() - a0), `a capsule's move: ${nReal() - a0} asks, the old walk ${nOld() - b0}`);
});

test('PERF-COL2: the world host marks every streamed pixel\'s bucket as riding its state - the town\'s models, mills and boards, the gates, World of Daggerfall\'s pieces, Privateer\'s Hold, the ocean holes - and no mover\'s (mutant: a pixel\'s bucket unmarked)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(w.includes("import { onFloatingFrame } from '../player/collider.js';"), 'the mark imported');
  const lines = w.split('\n');
  const pix = lines.filter((l) => /\(\(o\) => \(\) => state\.pixelTranslation\(px, py, o\)\)\(\[0, 0, 0\]\)/.test(l) && !l.includes('collider.cover.add('));
  assert.equal(pix.length, 6, 'the six pixel-translation providers a bucket takes (the cover index is no bucket)');
  for (const l of pix) assert.ok(l.includes('onFloatingFrame(state, ((o) => () => state.pixelTranslation(px, py, o))([0, 0, 0]))'), `marked: ${l.trim().slice(0, 120)}`);
  assert.ok(w.includes('collider.addMesh(h.bucket, pos, idx, _ohIdentity, onFloatingFrame(state, () => state.pixelTranslation(entry.px, entry.py, o)));'), 'the ocean holes\' bucket marked');
  const marks = (w.match(/onFloatingFrame\(/g) ?? []).length;
  assert.equal(marks, 6 + 1, 'and nothing else marked (a boat, a wagon, a gate\'s own mover ride no pixel)');
});
