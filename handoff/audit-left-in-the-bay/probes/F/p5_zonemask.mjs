// NIBEN-SEA: the Cyrodiil zone's mask (the boot's) - its cost, and what provinceWaterAt adds
import { setup, imp } from './setup.mjs';
await setup({ maps: false });
const z = await imp('src/systems/wild/cyrodiilZone.js');
let t = performance.now();
const m = z.cyrodiilMask();
console.log(process.env.SRC_ROOT ? 'BASE' : 'HEAD', 'cyrodiilMask ms', (performance.now() - t).toFixed(0), 'size', m?.width, m?.height);
if (z.provinceWaterAt) {
  // the Imperial City's lake pixels and the Niben's: zone's?
  const { inCyrodiil } = z;
  const pts = [[2069, 669], [2069, 672], [2069, 680], [2069, 646], [2057, 658], [2081, 658]];
  for (const [x, y] of pts) console.log(x, y, 'theatre-in', inCyrodiil(x, y), 'provinceWater', z.provinceWaterAt(x, y), 'wildInside?', z.inCyrodiilZone?.(x, y));
}
