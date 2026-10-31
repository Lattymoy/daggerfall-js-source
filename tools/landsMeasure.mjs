// TESA-LANDS (bible/03-World/Tamriel-Lands.md, "The growth") - THE FOREST FIELD MEASURED: the quantiles a zone's `woods`
// is read on (world/tamriel/tamrielLands.js FOREST_QUANTILES), off the field itself (world/terrain/terrainNature.js
// forestCover) at world tiles drawn evenly over the continent's frame (world/tamriel/tamrielFrame.js tamrielFrameInBay,
// the Bay's coordinates: a pixel 128 world tiles, north up). Pure node: no game data, no browser.
//
// TESA-LANDS' second audit (lane D): the table had been measured every 5% and read in a straight line between - from the
// 95th to the field's highest, 0.638 to 0.824, where the field's own tail is far tighter (0.669 at 98%, 0.689 at 99%), so
// a zone asking two hundredths of its land in woods (the Ashlands, the Alik'r) stood six ten-thousandths, and the far views
// (which read the zone's number) stood half again as many trees as the ground under them. It is measured every 1% now,
// and test/world/tesalands_flora.test.js holds it to the field it is read on.
//
//     node tools/landsMeasure.mjs [samples] [--zones]
//
// Prints FOREST_QUANTILES' 101 values (4 places, ready to paste) and, with --zones, each named zone's share of the land
// in its woods by its own recipe (terrainNature.js recipeWood) against the share it asks.
import { forestCover, compileRecipe, recipeWood } from '../src/world/terrain/terrainNature.js';
import { LANDS } from '../src/world/tamriel/tamrielLands.js';
import { tamrielFrameInBay } from '../src/world/tamriel/tamrielFrame.js';

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 400000);
const zones = process.argv.includes('--zones');
const f = tamrielFrameInBay();
let seed = 0x5eed1e55;
const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const vals = new Float64Array(N);
for (let i = 0; i < N; i++) {
  const px = f.x0 + rnd() * f.w,
    py = f.y0 + rnd() * f.h;
  vals[i] = forestCover(Math.floor(px * 128), -Math.floor(py * 128));
}
const sorted = Float64Array.from(vals).sort();
const q = Array.from({ length: 101 }, (_, k) =>
  k === 0 ? sorted[0] : k === 100 ? sorted[N - 1] : sorted[Math.floor((k / 100) * N)],
);
const rows = [];
for (let k = 0; k < q.length; k += 10)
  rows.push(
    q
      .slice(k, k + 10)
      .map((v) => v.toFixed(4))
      .join(', '),
  );
console.log(
  `// ${N} world tiles of the continent's frame (x ${f.x0}..${f.x0 + f.w}, y ${f.y0}..${f.y0 + f.h}), every 1%:`,
);
console.log(`[${rows.join(',\n  ')}]`);
if (zones) {
  for (const [key, land] of Object.entries(LANDS)) {
    if (!land.flora) continue;
    const c = compileRecipe(land.flora);
    let m = 0;
    for (let i = 0; i < N; i++) m += recipeWood(c, vals[i]);
    console.log(
      `${key.padEnd(24)} asks ${(land.flora.woods * 100).toFixed(1).padStart(5)}%  stands ${((m / N) * 100).toFixed(2).padStart(6)}%`,
    );
  }
}
