// WG2 THE CONTINENT AND THE BASINS (bible/03-World/World-2-Canon.md, "Water"): the whole of Tamriel's drainage from the
// canon - a region learns the rivers that enter it from past its edge, an edit learns how far downstream its water
// reaches (and not upstream), and inside a closed basin the water runs down the real ground to its lake, so no river
// crosses a flood's flat in a straight line. Pins mutation-checked (tools/mutants/wg2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonReady } from '../../../src/world/gen2/canon.js';
import { continent, regionInflow, downstreamOf, continentCell } from '../../../src/world/gen2/continent.js';
import { basinNet } from '../../../src/world/gen2/hydrology.js';
import { route, hollowsOf } from '../../../src/world/gen2/drainage.js';
import { Field } from '../../../src/world/gen2/field.js';
import { staleAfter } from '../../../src/world/gen2/stageGraph.js';
import { TEST_REGIONS, testRegion } from '../../../src/world/gen2/testRegions.js';
import { readBake, BAKE_DIR } from '../../../tools/wg2Bake.mjs';
import { decodeBake } from '../../../src/world/gen2/bakeCodec.js';

await canonReady();
const H = testRegion('hammerfell-test'), fit = H.fit;

test('WG2 CONTINENT: every land cell drains to the sea or a closed basin, the great rivers gather thousands of cubic metres a second, and rivers enter the Dragontails region from past its edge, past the Bay as in Black Marsh (mutants: the inflow\'s side, the runoff)', () => {
  const c = continent(fit);
  let land = 0, wet = 0, top = 0;
  for (let k = 0; k < c.Q.length; k++) { if (!c.theatre[k]) continue; land++; if (c.Q[k] > 0) wet++; if (c.Q[k] > top) top = c.Q[k]; }
  assert.equal(wet, land, 'every land cell gives and passes water');
  assert.ok(top > 2000, `the greatest river ${top}`);
  const inflow = regionInflow(H);
  const total = inflow.reduce((a, v) => a + v, 0);
  assert.ok(total > 2, `${total} m3/s enters`);
  const w = H.rect.w * H.res;
  for (let k = 0; k < inflow.length; k++) if (inflow[k] > 0) {
    const i = k % w, j = (k / w) | 0;
    assert.ok(i <= 2 || j <= 2 || i >= w - 3 || j >= H.rect.h * H.res - 3, 'laid one cell in from the edge');
  }
  assert.ok(regionInflow(testRegion('blackmarsh-test')).length === 96 * 2 * 96 * 2);
});

test('WG2 BASIN SCOPE: a change reaches downstream to the sea and not upstream - the stages\' hydrology goes stale over its own river, not the province (mutants: the walk downstream)', () => {
  const r = { x: H.rect.x + 60, y: H.rect.y + 60, w: 4, h: 4 }, d = downstreamOf(fit, r), c = continent(fit);
  assert.ok(d.x <= r.x && d.y <= r.y && d.x + d.w >= r.x + r.w && d.y + d.h >= r.y + r.h, 'it holds the change');
  let k = continentCell(c, r.x + 2, r.y + 2), steps = 0;
  while (c.rcv[k] >= 0 && steps < 1e5) { k = c.rcv[k]; steps++; }
  assert.equal(c.theatre[k], 0, 'the walk ends at the sea');
  assert.ok(d.w * d.h < 6000 * 3750 / 20, 'a river, not the continent');
  const bounds = { x: H.rect.x, y: H.rect.y, w: H.rect.w, h: H.rect.h };
  const stale = staleAfter('erosion', r, bounds, { basinOf: (q) => downstreamOf(fit, q) });
  assert.ok(stale.get('hydrology').w < bounds.w || stale.get('hydrology').h < bounds.h, 'not the whole region');
});

test('WG2 BASINS: inside a closed basin each cell drains down the real ground to the basin\'s lake node, the network has no cycle, and the shipped rivers keep no straight run longer than 16 cells (mutants: the flood\'s flat kept, the graded fill)', () => {
  // a bowl: the floor at its middle, a spill on its east rim
  const f = new Field(21, 21, { x0: 0, y0: 0, res: 1 });
  for (let j = 0; j < 21; j++) for (let i = 0; i < 21; i++) f.set(i, j, i >= 17 && j === 10 ? 62 - (i - 17) * 3 : 50 + ((i - 10) * (i - 10) + (j - 10) * (j - 10)) * 0.5);
  const rt = route(f, 100), hollows = hollowsOf(rt, f).filter((h) => h.deep > 1), net = basinNet(rt, f, hollows, 100);
  assert.equal(hollows.length, 1);
  const floor = 10 * 21 + 10;
  assert.equal(net.rcv[floor], f.data.length, 'the floor drains to the lake node');
  for (const c of hollows[0].cells) {
    let k = c, n = 0;
    while (k < f.data.length && n < 100) { const r = net.rcv[k]; if (r < f.data.length) assert.ok(f.data[r] < f.data[k], 'downhill on the real ground'); k = r; n++; }
    assert.equal(k, f.data.length, 'every cell of the bowl reaches its lake');
  }
  assert.equal(net.up.length, f.data.length + 1, 'each node once: no cycle');
  for (const spec of TEST_REGIONS) {
    const d = decodeBake(readBake(`${BAKE_DIR}/${spec.id}.wg2.gz`));
    let worst = 0;
    for (const r of d.header.rivers) {
      let run = 1, last = '';
      for (let i = 1; i < r.raw.length; i++) {
        const dir = `${Math.sign(Math.round((r.raw[i][0] - r.raw[i - 1][0]) * 8))},${Math.sign(Math.round((r.raw[i][1] - r.raw[i - 1][1]) * 8))}`;
        run = dir === last ? run + 1 : 1; last = dir; worst = Math.max(worst, run);
      }
    }
    assert.ok(worst <= 16, `${spec.id}: a straight run of ${worst} cells`);
  }
});
