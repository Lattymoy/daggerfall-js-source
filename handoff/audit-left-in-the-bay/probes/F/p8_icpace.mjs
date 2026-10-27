import { setup, imp } from './setup.mjs';
await setup({ maps: false });
const { paceAt } = await imp('src/scenes/townWalkHost.js');
const tc = await imp('src/world/tamrielCapitals.js');
const k = tc.CAPITALS.findIndex((c) => c.key === 'imperial-city'), at = tc.capitalCentrePixel(k);
let in60 = 0, ring5 = 0, other = 0;
for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
  const p = paceAt(at.px + dx, at.py + dy), inside = Math.abs(dx) <= 12 && Math.abs(dy) <= 12;
  if (inside && p === 60) in60++; else if (!inside && p === 5) ring5++; else other++;
}
console.log({ centre: at, in60, ring5, other });
const caps = tc.CAPITALS.map((c, i) => [c.name, tc.capitalCentrePixel(i)]).filter(([, p]) => p).map(([n, p]) => [n, paceAt(p.px, p.py)]);
console.log(caps);
