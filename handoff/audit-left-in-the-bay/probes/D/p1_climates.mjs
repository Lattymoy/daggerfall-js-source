import { setup, imp } from './base.mjs';
const { maps, rawMaps, woods, g } = await setup();
const tc = await imp('world/tamrielCapitals.js');
const { getWorldClimateSettings } = await imp('world/terrain/terrainHelper.js').catch(() => ({}));
const { theatreAt } = await imp('world/worldWide/worldGrid.js');
const { tamrielBiomeAt } = await imp('world/tamriel/tamrielBiomes.js');
const pts = {};
tc.CAPITALS.forEach((c, k) => { pts[c.key] = tc.capitalCentrePixel(k); });
Object.assign(pts, { bayDaggerfall: { px: 207, py: 213 } });
for (const [k, p] of Object.entries(pts)) {
  const ci = maps.getClimateIndex(p.px, p.py), raw = rawMaps.getClimateIndex(p.px, p.py), reg = maps.getRegionIndexAt(p.px, p.py), rawReg = rawMaps.getRegionIndexAt(p.px, p.py);
  console.log(k.padEnd(14), JSON.stringify(p), 'climate', ci, 'raw', raw, 'region', reg, 'rawRegion', rawReg, 'theatre', theatreAt(p.px, p.py), 'zone', tamrielBiomeAt(p.px, p.py)?.key, 'h', woods.getHeightMapValue(p.px, p.py));
}
