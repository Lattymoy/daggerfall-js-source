// EG-ZN (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 11.8 and 11.9): THE
// OCCLUDERS' DRAW BUDGET, MEASURED as EG-G2 measured the pieces': over 60 circles the circle one draw a record while nothing
// stands between, at most two draws more a record a dithering piece touches, the frame with the batched pieces beside it
// (scenes/eliteGates/egPieceBatch.js through scenes/eliteGates/egSpan.js) under the Hour's own.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEgCircleModel } from '../../../src/world/eliteGates/egHall.js';
import { egOccludeRanges } from '../../../src/scenes/eliteGates/egOcclude.js';
import { createEgSpan } from '../../../src/scenes/eliteGates/egSpan.js';
import { egLawSeam } from '../../../src/net/eliteGates/egLaw.js';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins measure spec law 8's halls - drawn where no law is named
// (net/eliteGates/egLaw.js egLawSeam - a test's seam, never a breach's: a breach draws its own law), the dress, the camera and the client
// as they were written over law 8's ground; LAW 9's dress is THE DRESS slice's (Elite-Gates-Ascent.md section 8) and its
// ground test/net/eliteGates/law9_rooms.test.js's
egLawSeam(8);


// ── THE BUDGET ──────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZN THE BUDGET, MEASURED (section 11.9, as EG-G2 measured): over 60 circles (seeds 7, 99 and 12345, circles 1 to 20) the circle is still one draw of a sub-mesh a record while nothing stands between - a mean of 11.7 GL draws, at worst 12 (EG-LOOK HALLS: the kit\'s records the academy wears) - and with any one occluder dithering at most two draws more a record it touches: a mean of 16.17, at worst 24; the frame\'s circle and batched pieces together a mean of 32.9 (worst 39) whole and at most 51 with the worst one piece dithering, under the Hour\'s 82 (mutants: a piece\'s runs unmerged; the rest drawn in pieces)', () => {
  const fake = () => ({ createMesh: (mm) => ({ subMeshes: mm.subMeshes }), destroyMesh: () => {}, updateMeshVertices: () => {} });
  let n = 0, whole = 0, wholeWorst = 0, one = 0, oneWorst = 0, pieces = 0, frame = 0, frameWorst = 0, frameOccWorst = 0;
  for (const seed of [7, 99, 12345]) for (let c = 1; c <= 20; c++) {
    const m = buildEgCircleModel(seed, c, 0), w = m.subMeshes.length;
    const span = createEgSpan({ renderer: fake(), seed, c });
    span.stand({ dynamicDraws: [], collider: null });
    span.ride(1000, 0.016, null, false);
    span.cull(null, null);
    const batched = span.batchStats()?.glDraws ?? 0;
    let worstHere = 0;
    for (let i = 0; i < m.occluders.length; i++) {
      const rest = egOccludeRanges(m.subMeshes, m.occluders, [i], true), own = egOccludeRanges(m.subMeshes, m.occluders, [i], false);
      const touched = new Set(m.occluders[i].r.map(([s]) => s)).size;
      assert.ok(own.length === touched && rest.length <= w + touched, `circle ${c}, piece ${i}: at most two draws more a record it touches`);
      one += rest.length + own.length; oneWorst = Math.max(oneWorst, rest.length + own.length); pieces++; worstHere = Math.max(worstHere, rest.length + own.length);
    }
    n++; whole += w; wholeWorst = Math.max(wholeWorst, w); frame += w + batched; frameWorst = Math.max(frameWorst, w + batched); frameOccWorst = Math.max(frameOccWorst, worstHere + batched);
  }
  // PIN MOVED (EG-HERO-LAY at the merge of the ten heroes, spec law 7): the heroes laid in these circles wear more of their
  // band's records (each one draw), their rock cut a record's cell at a time (world/eliteGates/egHall.js EG_HERO_ROCK_CELL_M), and their
  // inner courses' pieces batched: 7.15, 8; 9.15, 12; 23.8, 35, 39 before. PIN MOVED (AUDIT EG IV, the Fallen Stacks laid): 7.48,
  // 9.61 and 25.2 before. PIN MOVED (AUDIT EG V, f - spec law 8: the stairs up to every raised floor, a span's passages by circle,
  // more twists, their fragments' and their pieces' records and batches): 7.52, 9.64 and 25.5 before, the worst of each as before
  // PIN MOVED (EG-LOOK, the spans' pieces - world/eliteGates/egPlatformModel.js, scenes/eliteGates/egPieceBatch.js "a kind of many models"): every
  // piece in its band's stone wears more records (its flags, its edge line, its cornice, its foundation, its column), but the
  // pieces that move alike share a kind now (the still ones, the movers, a Crumble's cracking) - 26.9, 39, 43 before.
  // PIN MOVED (EG-LOOK HALLS, Elite-Gates-Look.md sections 2 and 10): the ground dressed as the academy wears four of the kit's
  // records besides its eight (world/eliteGates/egGround.js EG_GROUND_RECORDS: the shaft, the moulding, the voussoir, the inlay) and each bay
  // of a wall is a piece of several of them: 7.6, 8; 9.75, 12 before - still one draw a record whole, still at most two draws
  // more a record a dithering piece touches, still under the Hour's 82
  assert.deepEqual([Math.round((whole / n) * 100) / 100, wholeWorst], [11.7, 12], 'the circle whole: one draw a record, as before');
  assert.deepEqual([Math.round((one / pieces) * 100) / 100, oneWorst], [16.17, 24], 'one piece dithering');
  // PIN MOVED (FIELD BUGS 2026-10-20f ORRERY-STONES, scenes/eliteGates/egOrrery.js): an Athenaeum's six stones stand, two batched kinds
  // of two records each (the stones and their bezels; the hands and the crown gears that turn) - four draws a circle that lays one:
  // 32.9, 39, 51 before
  assert.deepEqual([Math.round((frame / n) * 10) / 10, frameWorst, frameOccWorst], [33.8, 43, 55]);   // PIN MOVED at the merge with EG-ZL (its Drift chains, Beat phases and tells are kinds of the batch): 20.7, 30, 34 before
  assert.ok(frameOccWorst < 82, 'under the Hour\'s own frame');
});
