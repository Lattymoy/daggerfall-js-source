// FIT-BITS (2026-10-20, the owner: "do your own performance pass ... go deep"; bible/07-Rendering/Performance-Priority.md
// FIT-BITS) - THE BAY'S FIT ON THE PICTURE, COUNTED 32 CELLS A WORD. The boot fits the Bay's land on the player's own
// picture of Tamriel (world/tamriel/tamrielLand.js fitBayToPicture) at its first world frame - 25 scales, 49 x 49
// offsets, up to 2,178 cells each, a cell at a time: ~0.8 s of the frame in the profile of a boot into the world. The
// inside's score is counted a word at a time now, off two bitsets of the picture (its 1s and its 0s). Every answer is
// the old one: the old law is restated here and the two compared over random pictures - values the mask never takes
// among them - masks, spans and scales, ties included. Over the real data (the record and tamriel4's ARENA2 pin): the
// Bay at (38, 57) x15.5, 1,537 of 2,048 inside and 190 of 192 along the seam, 707 -> 157 ms in node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitBayToPicture, FIT_PPUS, FIT_AREA_WEIGHT } from '../../src/world/tamriel/tamrielLand.js';
import { BAY_W, BAY_H } from '../../src/world/tamriel/tamrielFrame.js';

/** The law as it stood (tamrielLand.js fitBayToPicture before FIT-BITS): the inside counted a cell at a time. */
function fitAsItWas({ bayLand, trace, around = { ox: 46, oy: 52 }, span = 24, ppus = FIT_PPUS }) {
  let best = null, bestValue = -Infinity;
  const { w, land } = trace;
  for (const ppu of ppus) {
    const cols = Math.floor(BAY_W / ppu), rows = Math.floor(BAY_H / ppu);
    const mask = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let n = 0;
      for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) if (bayLand(Math.floor((i + dx) * ppu), Math.floor((j + dy) * ppu))) n++;
      mask[j * cols + i] = n >= 2 ? 1 : 0;
    }
    const edge = 2 * (cols + rows);
    for (let oy = around.oy - span; oy <= around.oy + span; oy++) {
      if (oy < 1 || oy + rows + 1 > trace.h) continue;
      for (let ox = around.ox - span; ox <= around.ox + span; ox++) {
        if (ox < 1 || ox + cols + 1 > w) continue;
        let score = 0;
        for (let j = 0; j < rows; j++) { const row = (oy + j) * w + ox, mrow = j * cols; for (let i = 0; i < cols; i++) if (mask[mrow + i] === land[row + i]) score++; }
        let seam = 0;
        for (let i = 0; i < cols; i++) { if (mask[i] === land[(oy - 1) * w + ox + i]) seam++; if (mask[(rows - 1) * cols + i] === land[(oy + rows) * w + ox + i]) seam++; }
        for (let j = 0; j < rows; j++) { if (mask[j * cols] === land[(oy + j) * w + ox - 1]) seam++; if (mask[j * cols + cols - 1] === land[(oy + j) * w + ox + cols]) seam++; }
        const value = seam / edge + (FIT_AREA_WEIGHT * score) / (cols * rows);
        if (value > bestValue) { bestValue = value; best = { ox, oy, ppu, score, cells: cols * rows, seam, edge }; }
      }
    }
  }
  return best;
}

/** A seeded draw. */
const draw = (seed) => () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

test('FIT-BITS the fit is the cell-at-a-time law\'s - over random pictures (a value the mask never takes among them), Bays, offsets, spans and scales, every answer the same (mutants: the last word\'s tail counted; the zeros not counted; another value counted as 0; a word not joined across its boundary; the popcount wrong)', () => {
  const rnd = draw(11);
  let fits = 0;
  for (let trial = 0; trial < 40; trial++) {
    const w = 100 + Math.floor(rnd() * 120), h = 50 + Math.floor(rnd() * 80);
    const land = new Uint8Array(w * h), odd = trial % 3 === 0;
    for (let i = 0; i < land.length; i++) land[i] = rnd() < 0.5 ? 1 : odd && rnd() < 0.15 ? 2 : 0;
    const f = 0.01 + rnd() * 0.05, g = rnd() * 6;
    const bayLand = (x, y) => Math.sin(x * f + g) + Math.cos(y * f * 1.3) > 0.2;
    const o = { bayLand, trace: { w, h, land }, around: { ox: Math.floor(rnd() * w), oy: Math.floor(rnd() * h) }, span: Math.floor(rnd() * 20), ppus: [15 + Math.floor(rnd() * 25) / 4, 18 + rnd() * 6] };
    const was = fitAsItWas(o);
    assert.deepEqual(fitBayToPicture(o), was, `trial ${trial}`);
    if (was) fits++;
  }
  assert.ok(fits > 20, `fits found (${fits})`);
});

test('FIT-BITS a tie goes where it went - the first offset of the first scale in the walk\'s order, on a picture every offset reads alike (mutant: a later tie taken)', () => {
  const w = 160, h = 90, land = new Uint8Array(w * h);
  const o = { bayLand: () => false, trace: { w, h, land }, around: { ox: 40, oy: 30 }, span: 6, ppus: [17, 16] };
  const best = fitBayToPicture(o);
  assert.deepEqual(best, fitAsItWas(o));
  assert.deepEqual([best.ox, best.oy, best.ppu], [34, 24, 17]);
  assert.equal(best.score, best.cells, 'every cell agrees');
});
