// D4 probe: LANDFORM4's site pull (world/landforms.js landformSites / sitesAbout) is the Bay's 1000 x 500 alone - a town
// past the Bay is never a site, so the shaped land is not pulled toward its level. Measured: the ground's departure from its
// own mean over a town's pixel (the rise DFU's/TS2's blend must then take inside the pixel), with the landforms on.
import { setup, imp, bytes } from './base.mjs';
const { maps, woods } = await setup();
const { generateSamples } = await imp('world/terrain/terrainSampler.js');
const { createLandforms, landformSites, landformClimates } = await imp('world/landforms.js');
const { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT } = await imp('world/terrain/terrainSampler.js');
const { longitudeLatitudeToMapPixel } = await imp('formats/mapsFile.js');
const { arenaTemplates, arenaTemplateOf } = await imp('world/arenaLocations.js');
const { arenaPixels } = await imp('world/arenaPlaces.js');
const { pastBayPlaceRows } = await imp('world/pastBayRows.js');
const { LOCATION_TYPES } = await imp('formats/mapsFile.js');
const rows = [];
for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) rows.push(loc); } }
const sites = landformSites(rows.map((loc) => { const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude); return { px: p.x, py: p.y, loc }; }));
const climates = landformClimates((x, y) => maps.getClimateIndex(x, y));
const withSites = createLandforms({ woods, sites, climates }), noSites = createLandforms({ woods, sites: null, climates });
const D = HEIGHTMAP_DIMENSION, M = MAX_TERRAIN_HEIGHT * 1.25;
// the town's level (mean of the middle half) against its pixel's edge ring: the rise the blend takes inside the pixel
const rise = (lf, px, py) => {
  const s = generateSamples(woods, px, py, D, lf);
  let c = 0, n = 0; for (let y = 32; y < 96; y++) for (let x = 32; x < 96; x++) { c += s[y * D + x]; n++; }
  c /= n; let worst = 0;
  for (let i = 0; i < D; i++) for (const [x, y] of [[i, 0], [i, D - 1], [0, i], [D - 1, i]]) worst = Math.max(worst, Math.abs(s[y * D + x] - c));
  return worst * M;
};
const stats = (a) => { a.sort((x, y) => x - y); const q = (f) => a[Math.min(a.length - 1, Math.floor(f * a.length))].toFixed(1); return `n=${a.length} median ${q(0.5)} m, p90 ${q(0.9)} m, max ${q(1)} m`; };
// Bay towns (cities and towns), a sample
const bay = rows.filter((l) => l.mapTableData.locationType === LOCATION_TYPES.TownCity || l.mapTableData.locationType === LOCATION_TYPES.TownHamlet).filter((_, i) => i % 7 === 0).slice(0, 80)
  .map((loc) => longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude));
const bw = [], bn = [];
for (const p of bay) { bw.push(rise(withSites, p.x, p.y)); bn.push(rise(noSites, p.x, p.y)); }
console.log('Bay towns, LANDFORM4 sites (as the game):', stats(bw));
console.log('Bay towns, the same with no sites       :', stats(bn));
// past the Bay: Arena's places standing on the trace (TESA's), not the capitals
const t = arenaTemplates(rows), px = arenaPixels();
const prow = pastBayPlaceRows({ pixels: px, templateOf: (p) => arenaTemplateOf(t, p), capitals: false }).filter((r) => r.type === LOCATION_TYPES.TownCity || r.type === LOCATION_TYPES.TownHamlet).filter((_, i) => i % 3 === 0).slice(0, 80);
const pw = [];
for (const r of prow) pw.push(rise(withSites, r.px, r.py));   // the game hands the same table: no site past the Bay is in it
console.log('Past-the-Bay towns (the game: no site)  :', stats(pw));
let anySite = 0; for (const r of prow) { if (r.px >= 0 && r.py >= 0 && r.px < 1000 && r.py < 500 && sites[4 * (r.py * 1000 + r.px)]) anySite++; }
console.log('past-the-Bay towns with a site in the table:', anySite, 'of', prow.length);
