// /usr/bin/env node
// WHERE THE SETTLEMENTS STAND. On the player's own files (the
// map picture traced and fitted as the world host does, WOODS.WLD past the Bay's seam), each province's settlement is laid
// out on pixel after pixel of its land that no place holds - no Arena town, capital, countryside place or lair on it or
// beside it - and the best one whose fit is ok is kept. The row written publishes inputs alone: the pixel as a point of
// the picture, the site, the structure the ground chose (fixed, so every client lays the same cells) and the key ledger.
// Nothing derived from the player's ground is written.
//  ARENA2_PATH=... node tools/settlementSites.mjs [--write] [--svg scratch/settlement-sites]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ImgFile } from '../src/formats/imgFile.js';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { PakFile } from '../src/formats/pakFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { MapsFile, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { traceTamrielPicture, paletteReader } from '../src/ui/tamrielTrace.js';
import { fitBayToPicture, setTamrielTrace } from '../src/world/tamriel/tamrielLand.js';
import { loadRelief } from '../src/world/tamriel/tamrielRelief.js';
import { setTamrielFit, inBay, BAY_W, bayToPicture } from '../src/world/tamriel/tamrielFrame.js';
import { isWaterPixel } from '../src/ui/overworldModel.js';
import { landAt } from '../src/ui/ink/inkMap.js';
import { groundWoods, groundClimateIndex, bayEdgeDistance } from '../src/world/tamriel/tamrielGround.js';
import { arenaPixels } from '../src/world/arenaPlaces.js';
import { capitalOnPixel } from '../src/world/tamrielCapitals.js';
import { isMainStoryDungeon } from '../src/world/dungeon/dungeonTextures.js';
import { countryTemplates, countryCounts, bayLand as bayLandOf, countryRates, countryMayStandAt } from '../src/world/tamrielCountry.js';
import { lairTemplates, lairMayStandAt, LAIR_TYPES } from '../src/world/tamrielDungeons.js';
import { WATER_BYTE } from '../src/world/roadsProducer.js';
import { theatreAt, THEATRE_KEYS } from '../src/world/worldWide/worldGrid.js';
import { generatePixelTerrain } from '../src/world/terrain/terrainGen.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { generateSettlement } from '../src/world/settlement/settlementGen.js';
import { sampleEnv } from '../src/world/settlement/settlementStand.js';
import { PAD_REACH, GROUND_EASE } from '../src/world/settlement/settlementGround.js';
import { settlementPlaceId } from '../src/world/settlement/settlementPlaces.js';
import { planSvg } from './settlementProbe.mjs';

/** One settlement a province: its kind, its style, its name and its map type (formats/mapsFile.js LOCATION_TYPES). */
export const SETTLEMENT_TARGETS = Object.freeze([
  { province: 'HighRock', archetype: 'fort', style: 'HighRock', name: 'Corvel Keep', type: LOCATION_TYPES.TownCity },
  { province: 'Hammerfell', archetype: 'oasis', style: 'Hammerfell', name: 'Sahr Waters', type: LOCATION_TYPES.TownVillage },
  { province: 'Skyrim', archetype: 'mining', style: 'Skyrim', name: 'Kolvar\'s Cut', type: LOCATION_TYPES.TownHamlet },
  { province: 'Morrowind', archetype: 'village', style: 'Morrowind', name: 'Velas Rest', type: LOCATION_TYPES.TownVillage },
  { province: 'Sumurset', archetype: 'river', style: 'Sumurset', name: 'Aleth Quay', type: LOCATION_TYPES.TownHamlet },
  { province: 'Valenwood', archetype: 'village', style: 'Valenwood', name: 'Thorn Canopy', type: LOCATION_TYPES.TownVillage },
  { province: 'Elsweyr', archetype: 'village', style: 'Elsweyr', name: 'Tasha\'s Bend', type: LOCATION_TYPES.TownVillage },
  { province: 'BlackMarsh', archetype: 'wetland', style: 'BlackMarsh', name: 'Hatchwater', type: LOCATION_TYPES.TownVillage },
  // the water a river town needs is the sea's until Cyrodiil's rivers stand as water: a village else
  { province: 'Imperial', archetype: 'river', style: 'Imperial', name: 'Corrol Ford', type: LOCATION_TYPES.TownHamlet, else: 'village' },
]);
const SITE = Object.freeze({ east: 409.6, north: 409.6, radius: 90 });
/** A river town's sites: toward each edge of its pixel, where a coast's water stands. */
const SHORE_SITES = Object.freeze([[230, 409.6], [589.2, 409.6], [409.6, 230], [409.6, 589.2]].map(([east, north]) => Object.freeze({ east, north, radius: 90 })));
/** Its pads and their ground's ease inside its own pixel, so no carve meets a neighbour's edge (settlementGround.js). */
const EASE_M = PAD_REACH + GROUND_EASE;
const inPixel = (plan) => plan.pads.every((p) => p.poly.every(([e, n]) => e > EASE_M && n > EASE_M && e < 819.2 - EASE_M && n < 819.2 - EASE_M));
/** How far from the Bay's edge a settlement keeps, pixels: past the seam's blended band. */
const SEAM_KEEP = 24;

async function main() {
  const A2 = process.env.ARENA2_PATH;
  if (!A2 || !existsSync(join(A2, 'MAPS.BSA'))) { console.error('settlementSites: ARENA2_PATH is not an ARENA2 folder (sh tools/fetch-data.sh)'); process.exit(2); }
  const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
  const file = (name) => { for (const n of [name, name.toLowerCase()]) { const p = join(A2, n); if (existsSync(p)) return readFileSync(p); } throw new Error(`${name} not in ${A2}`); };
  // the land, as the world host stands it
  const picture = new ImgFile(); picture.load(file('TMAP00I0.IMG'), 'TMAP00I0.IMG');
  const picker = new ImgFile(); picker.load(file('TAMRIEL2.IMG'), 'TAMRIEL2.IMG');
  const pal = new DFPalette(); pal.load(file(picture.paletteName || 'ART_PAL.COL'), picture.paletteName || 'ART_PAL.COL');
  const trace = traceTamrielPicture(picker.getDFBitmap(), picture.getDFBitmap(), paletteReader(pal));
  trace.relief = await loadRelief(trace);
  const woods0 = new WoodsFile(); woods0.load(file('WOODS.WLD'));
  const climatePak = new PakFile(); climatePak.load(file('CLIMATE.PAK'));
  const fit = fitBayToPicture({ bayLand: landAt({ heightBytes: woods0.heightMapBuffer, width: BAY_W, climateAt: (x, y) => climatePak.getValue(x + 1, y) }), trace });
  setTamrielTrace(trace);
  setTamrielFit({ ox: fit.ox * fit.ppu, oy: fit.oy * fit.ppu, ppu: fit.ppu });
  const woods = groundWoods(woods0), byte = (x, y) => woods.getHeightMapValue(x, y);
  const maps = new MapsFile(); maps.load(file('MAPS.BSA'), file('CLIMATE.PAK'), file('POLITIC.PAK'));
  // the places past the Bay a settlement keeps off: Arena's towns, the capitals, the countryside's and the lairs' rolls
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }   // BAY-OWN: the templates are the Bay's own rows
  const climateBay = (x, y) => maps.getClimateIndex(x, y);
  const land0 = bayLandOf(climateBay, (x, y, c) => isWaterPixel(c, woods0.getHeightMapValue(x, y)));
  const cT = countryTemplates(rows, isMainStoryDungeon), lT = lairTemplates(rows, isMainStoryDungeon);
  const ground = { climateAt: (x, y) => groundClimateIndex(x, y), heightAt: byte };
  const country = { ...ground, rates: countryRates(countryCounts(cT, climateBay), land0), templates: cT };
  const lair = { ...ground, rates: countryRates(countryCounts(lT, climateBay), land0, LAIR_TYPES), templates: lT };
  const arena = new Set(arenaPixels().stood.map((p) => `${p.bx},${p.by}`));
  const held = (x, y) => arena.has(`${x},${y}`) || capitalOnPixel(x, y) || countryMayStandAt(country, x, y) || lairMayStandAt(lair, x, y);
  const free = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (held(x + dx, y + dy)) return false; return true; };

  const out = [], taken = [];
  const svgDir = arg('--svg', null);
  if (svgDir) mkdirSync(svgDir, { recursive: true });
  for (const [ordinal, first] of SETTLEMENT_TARGETS.entries()) {
   for (const t of [first, ...(first.else ? [{ ...first, archetype: first.else, else: undefined }] : [])]) {
    const theatre = THEATRE_KEYS.indexOf(t.province);
    const cands = [];
    for (let y = -1600; y < 2400; y += 7) for (let x = -1800; x < 4200; x += 7) {
      if (inBay(x, y) || theatreAt(x, y) !== theatre || bayEdgeDistance(x, y) < SEAM_KEEP || byte(x, y) <= WATER_BYTE) continue;
      if (taken.some(([tx, ty]) => Math.abs(tx - x) + Math.abs(ty - y) < 40)) continue;
      cands.push([x, y]);
    }
    // a spread of the province's land, deterministically: every k-th candidate, free ones only
    const step = Math.max(1, Math.floor(cands.length / 90));
    let best = null;
    for (let i = 0; i < cands.length; i += step) {
      const [x, y] = cands[i];
      if (!free(x, y)) continue;
      // a river town only on a coast's pixel, its site toward the water; every other at the pixel's middle
      const river = t.archetype === 'river';
      if (river && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => byte(x + dx, y + dy) <= WATER_BYTE)) continue;
      const g = generatePixelTerrain({ woods, px: x, py: y, stride: 1, tilemap: new Uint8Array(128 * 128), climateType: CLIMATES.Woodlands, landform: true });
      const env = sampleEnv(g.samples);
      for (const site of river ? SHORE_SITES : [SITE]) {
        const made = generateSettlement({ place: settlementPlaceId(ordinal), origin: { px: x, py: y, east: 0, north: 0 }, seed: ordinal + 1, archetype: t.archetype, style: t.style, site, env });
        if (!made.report.ok || (river && !made.report.shore) || !inPixel(made.plan)) continue;
        const r = made.report, score = t.archetype === 'fort' ? r.relief : t.archetype === 'mining' ? r.relief - r.fit.cutMax : -r.fit.cutMax - r.relief / 4 + r.counts.buildings / 50;
        if (!best || score > best.score) best = { x, y, score, made, env, site };
      }
    }
    if (!best) { console.log(`${t.province}: no ${t.archetype} site fits`); continue; }
    taken.push([best.x, best.y]);
    const L = best.made.plan, rep = best.made.report;
    const fix = { layout: rep.layout, ...(rep.layout === 'ring' ? { centre: rep.centre.map((v) => Math.round(v * 100) / 100) } : {}) };
    if (rep.shore) fix.shore = { dir: rep.shore.dir.map((v) => Math.round(v * 1e6) / 1e6), at: rep.shore.at };
    const [ax, ay] = bayToPicture(best.x + 0.5, best.y + 0.5);
    out.push({ ordinal, name: t.name, province: t.province, type: t.type, archetype: t.archetype, style: t.style, seed: ordinal + 1,
      at: [Math.round(ax * 10000) / 10000, Math.round(ay * 10000) / 10000], site: best.site, fix,
      ledger: { next: best.made.ledger.next, keys: best.made.ledger.keys, retired: [...best.made.ledger.retired] } });
    console.log(`${t.province}: ${t.name} (${t.archetype}) at ${best.x},${best.y} - ${rep.counts.buildings} buildings, relief ${rep.relief} m, cut ${rep.fit.cutMax} m, ${L.pads.length} pads`);
    if (svgDir) writeFileSync(join(svgDir, `${ordinal}-${t.province}.svg`), planSvg(L, best.env, `${t.name} (${t.archetype}, ${t.style}) at ${best.x},${best.y}`));
    break;
   }
  }
  const json = `${JSON.stringify({ version: 1, settlements: out }, null, 1)}\n`;
  if (process.argv.includes('--write')) writeFileSync(new URL('../src/world/settlement/settlements.json', import.meta.url), json);
  else console.log(json.slice(0, 400));
}

await main();
