// AUDIT BANTHA1 (RISK, bible/01-Overview/audits/Audit-Bantha.md): WHERE THE JUNGLE STANDS ON THE MAP - read off the
// owner's own ARENA2, which this repository does not hold. BANTHA1 stood the jungle on a political region and found region
// 10 (Bantha) holds no pixel and no place - Daggerfall names it and never paints it - so it stood on Glenpoint. BANTHA2
// (2026-10-19, the owner: "The area is red in bantha and should be the jungle biome"): the jungle is the area the owner
// painted (world/jungle/banthaArea.js). This says how many map pixels it holds, its box, the regions and climates it
// covers (the jungle lays the rainforest's law over whatever they are) and its towns and cities (the names
// `SCENES=jungle LOC=<town> npm run perf` takes, with the town's region), beside Daggerfall's region for scale.
//
//   sh tools/fetch-data.sh && ARENA2_PATH=/home/claude/dfdata/arena2 node tools/jungleExtent.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MapsFile, REGION_NAMES } from '../src/formats/mapsFile.js';
import { BANTHA_AREA_ROWS, banthaAreaHas } from '../src/world/jungle/banthaArea.js';

const A = process.env.ARENA2_PATH;
if (!A) { console.log('jungleExtent: set ARENA2_PATH to the ARENA2 folder'); process.exit(0); }
const read = (f) => new Uint8Array(readFileSync(join(A, f)));
const maps = new MapsFile();
maps.load(read('MAPS.BSA'), read('CLIMATE.PAK'), read('POLITIC.PAK'));

/** Pixels `has(x, y)` holds on the 1000 x 500 map: their count, box, regions and climates. */
function extent(has) {
  let n = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  const climates = new Map(), regions = new Map();
  for (let y = 0; y < 500; y++) {
    for (let x = 0; x < 1000; x++) {
      if (!has(x, y)) continue;
      n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      const c = maps.getClimateIndex(x, y), r = REGION_NAMES[maps.getRegionIndexAt(x, y)];
      climates.set(c, (climates.get(c) ?? 0) + 1); regions.set(r, (regions.get(r) ?? 0) + 1);
    }
  }
  return { pixels: n, box: n ? [x0, y0, x1, y1] : null, climates: Object.fromEntries(climates), regions: Object.fromEntries(regions) };
}

/** The towns and cities (MapTable location type 0 and 1) whose pixel is in the area: [region, name, x, y]. */
function towns(regions) {
  const out = [];
  for (const name of regions) {
    const r = REGION_NAMES.indexOf(name);
    if (r < 0) continue;
    for (let i = 0; i < maps.baseLocationCount(r); i++) {
      const loc = maps.getLocation(r, i), t = loc?.mapTableData;
      if (!t || t.locationType > 1) continue;
      const x = Math.floor(t.longitude / 128), y = 499 - Math.floor(t.latitude / 128);
      if (banthaAreaHas(x, y)) out.push([name, loc.name, x, y]);
    }
  }
  return out;
}

const area = extent(banthaAreaHas);
const places = towns(Object.keys(area.regions));
console.log('the area (BANTHA_AREA_ROWS, %d rows):', BANTHA_AREA_ROWS.length, JSON.stringify(area));
console.log('its towns and cities: %d -', places.length, places.slice(0, 40).map((p) => `${p[1]} (${p[0]}, ${p[2]},${p[3]})`).join('; '));
console.log('region 17 (Daggerfall), for scale:', JSON.stringify(extent((x, y) => maps.getRegionIndexAt(x, y) === 17)));
