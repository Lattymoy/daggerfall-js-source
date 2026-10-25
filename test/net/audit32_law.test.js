// AUDIT 32 (2026-09-30, Mac: "Audit this") - PROF7'S LAW AS THE AUDIT FOUND IT (src/systems/traceAct.js,
// src/net/recipeLaw.js): the trace measured every quarter degree of its PROGRESS, its clock from its first move along the
// line - a press held still on the first point and one flick to the last was a clean pelt, and a hand's score hung on
// its frame rate (L1); a bearing that is not a number is none, and a chord across the world walks no further than the
// line (L5); every garment takes a dye - DFU's "unchangeable" shirts are its variant's word (L3). S1 (Mac: "Whatever
// you think is best"): a recipe made wholly of goods only a counter sells pays no first-craft bonus.
// bible/06-Systems/Online-Arc.md "AUDIT 32"; bible/06-Systems/Professions-Arc.md 29.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTraceAct } from '../../src/systems/traceAct.js';
import { TRACE_ACT, COUNTER_ONLY, STOCKS, stockOf } from '../../src/net/professionLaw.js';
import { OUTFITTING_RECIPES, RECIPES, recipeById, dyeOk, GARMENT_DYES, firstCraftPays } from '../../src/net/recipeLaw.js';

/** The line's own pitch at `yaw` (the zigzag's segment under it). */
function lineAt(points, yaw) {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    if (yaw <= x1) return y0 + ((y1 - y0) * (yaw - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

test('AUDIT 32 L1: a press held still on the first point and one flick to the last is never clean, however long the rest; the clock starts at the first move', () => {
  for (const restS of [0.6, 1, 3, 5.5]) {
    for (const r of [0.1, 0.5, 0.9]) {
      const act = createTraceAct({ tier: 1, rng: () => r });
      const [first, last] = [act.state.points[0], act.state.points.at(-1)];
      for (let t = 0; t < restS; t += 1 / 60) act.tick(1 / 60, { held: true, aim: { yaw: first[0], pitch: first[1] } });
      act.tick(1 / 60, { held: true, aim: { yaw: last[0], pitch: last[1] } });
      const rep = act.report();
      assert.ok(rep, `rest ${restS} s, line ${r}: the flick finished it`);
      assert.equal(rep.clean, false, `rest ${restS} s, line ${r}: ${JSON.stringify(rep)}`);
      assert.ok(rep.seconds < TRACE_ACT.minS, `the flick took one frame, not the rest: ${rep.seconds}`);
    }
  }
  // a second's rest, then a true hand along the line: clean, and timed from its first move (the last point is reached
  // within TRACE_ACT.startDeg of it, before the stroke's end - never counting the rest)
  const act = createTraceAct({ tier: 1, rng: () => 0.5 });
  const pts = act.state.points;
  for (let t = 0; t < 1; t += 1 / 60) act.tick(1 / 60, { held: true, aim: { yaw: pts[0][0], pitch: pts[0][1] } });
  const frames = 54;
  for (let i = 1; i <= frames; i++) {
    const yaw = pts[0][0] + ((pts.at(-1)[0] - pts[0][0]) * i) / frames;
    act.tick(1 / 60, { held: true, aim: { yaw, pitch: lineAt(pts, yaw) } });
  }
  const rep = act.report();
  assert.equal(rep.clean, true, JSON.stringify(rep));
  assert.ok(rep.seconds >= TRACE_ACT.minS && rep.seconds <= frames / 60 + 1e-9, `timed from the first move: ${rep.seconds}`);
});

test('AUDIT 32 L1: a hand\'s score is its line\'s, not its frame rate\'s - the same stroke at 30, 60 and 144 frames a second; a wiggle back over drawn ground adds nothing', () => {
  const stroke = (fps) => {
    const act = createTraceAct({ tier: 3, rng: () => 0.3 });
    const pts = act.state.points;
    act.tick(1 / fps, { held: true, aim: { yaw: pts[0][0], pitch: pts[0][1] } });
    const frames = Math.round(2 * fps);
    for (let i = 1; i <= frames; i++) {
      const yaw = pts[0][0] + ((pts.at(-1)[0] - pts[0][0]) * i) / frames;
      act.tick(1 / fps, { held: true, aim: { yaw, pitch: 0.8 } });   // a hand held level across the zigzag
    }
    return act.report().score;
  };
  const [a, b, c] = [stroke(30), stroke(60), stroke(144)];
  assert.ok(Math.abs(a - b) <= 0.01 && Math.abs(b - c) <= 0.01, `${a} ${b} ${c}`);
  // back and forth along the first segment for two seconds, then the stroke: the samples a plain stroke's
  const plain = createTraceAct({ tier: 1, rng: () => 0.5 }), wiggle = createTraceAct({ tier: 1, rng: () => 0.5 });
  const pts = plain.state.points;
  for (const act of [plain, wiggle]) act.tick(1 / 60, { held: true, aim: { yaw: pts[0][0], pitch: pts[0][1] } });
  for (let i = 0; i < 120; i++) {
    const yaw = pts[0][0] + (i % 2 ? 1 : 0.2);
    wiggle.tick(1 / 60, { held: true, aim: { yaw, pitch: lineAt(pts, yaw) } });
  }
  assert.ok(wiggle.state.devs.length <= 2 + Math.ceil(1 / TRACE_ACT.stepDeg), `two seconds of wiggle over one degree: ${wiggle.state.devs.length} samples`);   // the start, and one of the chords' rounding
  for (const act of [plain, wiggle]) {
    for (let i = 1; i <= 60; i++) {
      const yaw = pts[0][0] + ((pts.at(-1)[0] - pts[0][0]) * i) / 60;
      act.tick(1 / 60, { held: true, aim: { yaw, pitch: lineAt(pts, yaw) } });
    }
  }
  assert.ok(Math.abs(wiggle.state.devs.length - plain.state.devs.length) <= 1, `${wiggle.state.devs.length} against ${plain.state.devs.length}`);
});

test('AUDIT 32 L5: a bearing that is not a number is no bearing - a slip; a chord across the world walks no further than the line', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {   // NaN first: before it, an infinite bearing hung the walk
    const act = createTraceAct({ tier: 1, rng: () => 0.5 });
    const p0 = act.state.points[0];
    act.tick(0.05, { held: true, aim: { yaw: p0[0], pitch: p0[1] } });
    act.tick(0.05, { held: true, aim: { yaw: bad, pitch: 0 } });
    assert.deepEqual([act.state.tracing, act.state.slips], [false, 1], String(bad));
  }
  const act = createTraceAct({ tier: 1, rng: () => 0.5 });
  const p0 = act.state.points[0];
  act.tick(0.05, { held: true, aim: { yaw: p0[0], pitch: p0[1] } });
  act.tick(0.05, { held: true, aim: { yaw: 1e5, pitch: 0 } });
  const most = Math.ceil(TRACE_ACT.spanYawDeg / TRACE_ACT.stepDeg) + 2;
  assert.ok(act.state.devs.length <= most, `${act.state.devs.length} samples for a chord a hundred thousand degrees long`);
});

test('AUDIT 32 L3: every garment takes a dye - DFU\'s "unchangeable" shirts (178, 179, 214, 215) are its variant\'s word, and its shelf dyes them', () => {
  const garments = OUTFITTING_RECIPES.filter((r) => r.kind === 'garment');
  assert.equal(garments.length, 76 * 4);
  assert.deepEqual(garments.filter((r) => !GARMENT_DYES.every((d) => dyeOk(r, d))).map((r) => r.id), []);
  for (const t of [178, 179, 214, 215]) {
    const r = recipeById(`garment-${t}:linen`);
    assert.ok(dyeOk(r, 2), `${t}`);
    assert.match(r.name, /unchangeable$/);
  }
  assert.equal(dyeOk(recipeById('rug-237:wool'), 2), false, 'furniture takes none');
});

test('AUDIT 32 S1 (Mac: "Whatever you think is best"): a recipe made wholly of goods only a counter sells - the Weavers\' Linen and Wool, never gathered - pays no first-craft bonus; a boot\'s Cured Leather, Silk, the planks and every gathered good keep 3.2\'s 500', () => {
  // PIN MOVED (PROF12): and the Apothecaries' sixteen after them (Professions-Arc 4.5, 37) - never gathered either
  assert.deepEqual([...COUNTER_ONLY].slice(0, 2), ['cloth:linen', 'cloth:wool']);
  assert.ok(COUNTER_ONLY.slice(2).length === 16 && COUNTER_ONLY.slice(2).every((k) => k.startsWith('reagent:')));
  // the smith's stock is gathered too (PROF4, PROF7): no counter good but the Weavers' (and PROF12's Apothecaries') is counter-only
  assert.deepEqual(STOCKS.map((s) => s.key).filter((k) => COUNTER_ONLY.includes(k) && !k.startsWith('reagent:')).sort(), ['cloth:linen', 'cloth:linen', 'cloth:wool'], 'the furnisher\'s Linen and the Weavers\' two');
  const unpaid = RECIPES.filter((r) => !firstCraftPays(r));
  assert.deepEqual([unpaid.length, unpaid.filter((r) => r.kind === 'garment').length], [152, 144]);
  assert.ok(unpaid.every((r) => r.profession === 'outfitting' && r.inputs.length > 0 && r.inputs.every((i) => COUNTER_ONLY.includes(i.key))));
  for (const id of ['garment-141:linen', 'garment-141:wool', 'rug-237:wool', 'fishingnet:linen']) assert.equal(firstCraftPays(recipeById(id)), false, id);
  for (const id of ['garment-149:linen', 'garment-141:silk', 'leather-helm:cured', 'staff:pine', 'table-small:oak', 'bed-plain-single:pine', 'knife:iron']) {
    assert.equal(firstCraftPays(recipeById(id)), true, id);
  }
  assert.equal(firstCraftPays(null), false, 'no recipe, no bonus');
  assert.equal(firstCraftPays({ inputs: [] }), true, 'a recipe of nothing is no counter\'s');
  // what the counter could buy is what it no longer pays: 152 first crafts, 76,000 XP (Outfitting 87), all bought
  const marks = unpaid.reduce((sum, r) => sum + r.inputs.reduce((m, i) => m + i.n * stockOf(i.key).marks, 0), 0);
  // PIN MOVED (FIRST-BUDGET): the measure as it was taken, at the flat 500 a first paid then (recipeLaw firstCraftXp since)
  assert.deepEqual([unpaid.length * 500, Math.floor(Math.sqrt((unpaid.length * 500) / 10)), marks], [76_000, 87, 811]);
});
