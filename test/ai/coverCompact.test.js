// COVER-COMPACT (2026-10-26, bible/07-Rendering/Performance-Priority.md): the cover index's sets became typed columns and
// sorted cell lists. Not one answer may move: this fills the index as it stood before (test/ai/fixtures/
// coverIndexBefore.mjs) and the live one from one fixture, the same calls in the same order, and holds every `hit`, every
// `near` visit (the body, its foot, the order) and every count equal - and `hit` to a brute-force reading of every proxy.
// Mutants: tools/mutants/coverCompact.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCoverIndex, coverProxy, coverProxies, rayCylinder, FELLED, COVER_CELL } from '../../src/ai/cover.js';
import { flatBodies, jungleBody } from '../../src/world/propBodies.js';
import { jungleCover } from '../../src/world/jungle/jungleModels.js';
import { createCoverIndexBefore } from './fixtures/coverIndexBefore.mjs';

/** A seeded stream, so a failure names the same ray every run. */
function seeded(seed) {
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
}

/** One set's worth of proxies around `at`: props, trees (trunk and crown), a crowded corner, jungle trees whose crowns
 *  are wider than a cell (the wide grid), people (`noCover` from birth) and bodies. */
function setFixture(rnd, at, n) {
  const items = [];
  const bases = [];
  const base = (x, z) => {
    const b = [at[0] + x, at[1] + rnd() * 6, at[2] + z];
    bases.push(b);
    return b;
  };
  for (let i = 0; i < n; i++) {
    const size = { w: 0.5 + rnd() * 8, h: 1.2 + rnd() * 10 };
    if (rnd() < 0.5) items.push(...coverProxies(base(rnd() * 300, rnd() * 300), size, { tree: true }));
    else items.push(coverProxy(base(rnd() * 300, rnd() * 300), size));
  }
  for (let i = 0; i < 60; i++) items.push(coverProxy(base(150 + rnd(), 150 + rnd()), { w: 2, h: 2 }));
  for (let i = 0; i < 80; i++) items.push(...jungleCover(base(rnd() * 300, rnd() * 300), i % 3, 1 + rnd()));
  for (let i = 0; i < 30; i++) items.push(...jungleCover(base(40 + rnd() * 4, 40 + rnd() * 4), 0, 1));
  for (let i = 0; i < 20; i++) items.push(coverProxy(Object.assign(base(rnd() * 300, rnd() * 300), { noCover: true }), { w: 1, h: 2 }));
  items.push({ c: base(10, 10), r: 0, h: 2, lift: 0 }, { c: base(12, 12), r: 1, h: 0, lift: 0 }, null, { r: 1, h: 1 });
  const feet = bases.slice(0, 400);
  items.push(...flatBodies(null, 504, 3, { w: 3, h: 9 }, feet, { tree: true }));
  for (let i = 0; i < 40; i++) items.push(jungleBody(base(60 + rnd() * 8, 60 + rnd() * 8), i % 3, 1));
  const order = items.map((it) => [rnd(), it]).sort((a, b) => a[0] - b[0]).map(([, it]) => it);
  return { items: order, bases };
}

/** Both indexes, driven by one script: `run(idx)` gets each index in turn. */
function both(run) {
  const before = createCoverIndexBefore({ enabled: () => true });
  const after = createCoverIndex({ enabled: () => true });
  run(before);
  run(after);
  return { before, after };
}

/** A ray within or around the sets: from a proxy's base or the open, at any slope, now and then straight up or down. */
function ray(rnd, bases) {
  const from = rnd() < 0.3 ? bases[Math.floor(rnd() * bases.length)] : null;
  const o = from ? [from[0] + (rnd() - 0.5) * 2, from[1] + rnd() * 4, from[2] + (rnd() - 0.5) * 2] : [rnd() * 900 - 100, rnd() * 20 - 4, rnd() * 900 - 100];
  let d;
  if (rnd() < 0.05) d = [0, rnd() < 0.5 ? 1 : -1, 0];
  else {
    const yaw = rnd() * Math.PI * 2, pitch = (rnd() - 0.5) * 1.2;
    d = [Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)];
  }
  return { o, d, max: rnd() < 0.05 ? 0 : 1 + rnd() * 120, sight: rnd() < 0.5 };
}

const nearList = (idx, p, reach) => {
  const out = [];
  idx.near(p, reach, (it, x, y, z) => out.push([it, x, y, z]));
  return out;
};

test('COVER-COMPACT: the columns answer as the proxy objects did - every hit, every near visit in its order, every count; filled whole, in slices with reads between, staged and placed, appended to, taken away; felled, regrown and made a person after filing (mutants: tools/mutants/coverCompact.json)', () => {
  const rnd = seeded(11);
  const frames = [[0, 0, 0], [819.2, 0, 0], [0, 0, -819.2], [-300, 2, 400]];
  const fixtures = frames.map((at, k) => setFixture(rnd, k === 3 ? [0, 0, 0] : at, 1500));
  const allBases = fixtures.flatMap((f) => f.bases);
  const worldBases = fixtures.flatMap((f, k) => f.bases.map((b) => [b[0] + frames[k][0], b[1] + frames[k][1], b[2] + frames[k][2]]));
  const tOf = (k) => () => frames[k];
  const qrnd = seeded(23);
  const rays = Array.from({ length: 6000 }, () => ray(qrnd, worldBases));
  const points = Array.from({ length: 1500 }, () => {
    const b = worldBases[Math.floor(qrnd() * worldBases.length)];
    return { p: [b[0] + (qrnd() - 0.5) * 3, b[1], b[2] + (qrnd() - 0.5) * 3], reach: qrnd() * 0.6 };
  });
  let compared = 0, hits = 0, visits = 0;
  const nearSame = (idx2, label) => {
    for (const { p, reach } of points) {
      const a = nearList(idx2.before, p, reach), b = nearList(idx2.after, p, reach);
      assert.deepEqual(b, a, `${label}: near ${p} by ${reach}`);
      visits += a.length;
    }
  };
  /** Every ray and every point, asked of both - equal to the last bit and the last visit. `nearFirst`: the bodies asked
   *  before any ray, so a body query is a set's first read (the read builds what a fill left waiting). */
  const same = (idx2, label, nearFirst = false) => {
    if (nearFirst) nearSame(idx2, label);
    for (const r of rays) {
      const a = idx2.before.hit(r.o, r.d, r.max, r.sight), b = idx2.after.hit(r.o, r.d, r.max, r.sight);
      assert.ok(Object.is(a, b), `${label}: hit from ${r.o} along ${r.d} within ${r.max}${r.sight ? ' (sight)' : ''}: ${a} before, ${b} after`);
      compared++;
      if (Number.isFinite(a)) hits++;
    }
    if (!nearFirst) nearSame(idx2, label);
    for (const k of ['size', 'refs', 'bodies']) assert.equal(idx2.after[k](), idx2.before[k](), `${label}: ${k}()`);
  };
  const idx = both((ix) => {
    ix.add('a', fixtures[0].items, tOf(0));   // whole
    const staged = ix.staged(tOf(1));
    for (let i = 0; i < fixtures[1].items.length; i += 700) ix.fill(staged, fixtures[1].items.slice(i, i + 700));
    ix.place('b', staged);   // staged and placed
  });
  same(idx, 'whole and staged');
  // in slices with reads between (a read builds what a slice left waiting), and a set appended to after it was read
  const sliced = fixtures[2].items;
  for (let i = 0; i < sliced.length; i += 997) {
    for (const ix of [idx.before, idx.after]) ix.add('c', sliced.slice(i, i + 997), tOf(2));
    same(idx, `sliced to ${i + 997}`, (i / 997) % 2 === 1);
  }
  // group by group, as a host adds a flat group a call (a fill too small to build what it leaves waiting)
  const groups = fixtures[3].items.slice(900, 1500);
  for (let i = 0; i < groups.length; i += 40) for (const ix of [idx.before, idx.after]) ix.add('d', groups.slice(i, i + 40), tOf(3));
  same(idx, 'group by group', true);
  for (const ix of [idx.before, idx.after]) ix.add('a', fixtures[3].items.slice(0, 900));
  same(idx, 'appended');
  // the bases changed under the index: felled, made a person, moved (a sunk tree), then regrown
  const felled = allBases.filter((_, i) => i % 7 === 0), people = allBases.filter((_, i) => i % 11 === 3);
  for (const b of felled) { FELLED.add(b); b[1] -= 6; }
  for (const b of people) b.noCover = true;
  same(idx, 'felled and people');
  for (const b of felled) { FELLED.delete(b); b[1] += 6; }
  for (const b of people) delete b.noCover;
  same(idx, 'regrown');
  // a set traded in place and one taken away
  for (const ix of [idx.before, idx.after]) {
    const s = ix.staged(tOf(3));
    ix.fill(s, fixtures[3].items.slice(900));
    ix.place('a', s);
    ix.remove('b');
  }
  same(idx, 'traded and removed');
  assert.ok(compared > 30000 && hits > 3000 && visits > 1000, `the fixture reaches the answers (${compared} rays, ${hits} hits, ${visits} visits)`);

  // and every hit is the nearest of every proxy standing, read one by one (no grid at all)
  const brute = createCoverIndex({ enabled: () => true });
  const proxies = [];
  fixtures.forEach((f, k) => {
    const items = f.items.filter((it) => it && !it.body && it.r > 0 && it.h > 0 && it.c && !it.c.noCover);
    brute.add(k, items, tOf(k));
    for (const it of items) proxies.push([it, frames[k]]);
  });
  for (const r of rays.slice(0, 1500)) {
    if (!(r.max > 0)) continue;
    let best = Infinity;
    for (const [it, t] of proxies) {
      const s = rayCylinder([r.o[0] - t[0], r.o[1] - t[1], r.o[2] - t[2]], r.d, it, Math.min(r.max, best), r.sight ? r.max : null);
      if (s < best) best = s;
    }
    assert.ok(Object.is(brute.hit(r.o, r.d, r.max, r.sight), best), `the nearest of all from ${r.o} along ${r.d}`);
  }
  assert.ok(proxies.some(([it]) => it.r > COVER_CELL), 'wide crowns among them');
});
