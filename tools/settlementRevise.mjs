// A REVISION ASKED OF WHAT PLAYERS HOLD. Lays
// every published settlement and every grown town a protected key names on the player's own ground, dressed by this
// tree's generator, and refuses (exit 1) where a protected key would move or go: a published row through its ledger, a
// grown town where its key's building is gone. `--dump` writes the plans before a generator change; `--published` reads
// them after, so a protected building moved, renamed or retyped is named in either. `--write` records the published rows'
// ledgers when nothing refuses.
//  ARENA2_PATH=... node tools/settlementRevise.mjs --protected homes.json [--dump plans.json] [--published plans.json] [--write]
// homes.json: the account service's /v1/homes/town answers (an array, one a town), or { "<mapId>": [keys] }.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { loadWorldAtlas } from './atlasMeasure.mjs';
import { ImgFile } from '../src/formats/imgFile.js';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { PakFile } from '../src/formats/pakFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { traceTamrielPicture, paletteReader } from '../src/ui/tamrielTrace.js';
import { fitBayToPicture, setTamrielTrace } from '../src/world/tamriel/tamrielLand.js';
import { loadRelief } from '../src/world/tamriel/tamrielRelief.js';
import { setTamrielFit, BAY_W } from '../src/world/tamriel/tamrielFrame.js';
import { landAt } from '../src/ui/ink/inkMap.js';
import { groundWoods } from '../src/world/tamriel/tamrielGround.js';
import { generatePixelTerrain } from '../src/world/terrain/terrainGen.js';
import { setLocationTiles } from '../src/world/terrain/terrainTiles.js';
import { buildRoadsFromArchives } from '../src/world/roadsProducer.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { SETTLEMENT_ROWS, settlementInput, settlementPixel, settlementPlaceId } from '../src/world/settlement/settlementPlaces.js';
import { growthJobAt } from '../src/world/settlement/townGrowthJob.js';
import { dressSettlement } from '../src/world/settlement/settlementGen.js';
import { protectedOfTown, revisionConflicts, protectedGone } from '../src/world/settlement/settlementPublish.js';

/** The protected keys by map id, from either shape of homes.json. @param {any} json @returns {Map<number, number[]>} */
export function protectedByTown(json) {
  const out = new Map();
  if (Array.isArray(json)) for (const a of json) { const t = protectedOfTown(a); if (t.keys.length) out.set(t.place, t.keys); }
  else for (const [k, v] of Object.entries(json ?? {})) if (Array.isArray(v)) out.set(Number(k) >>> 0, v.filter((x) => Number.isSafeInteger(x)));
  return out;
}

/** What `--dump` keeps of a plan: each building's key and what moves it. @param {any} plan */
const kept = (plan) => plan.buildings.map((b) => ({ key: b.key, anchor: b.anchor, pad: b.pad, at: b.at, yaw: b.yaw, lift: b.lift, footprint: b.footprint, type: b.type, access: b.access }));

async function main() {
  const A2 = process.env.ARENA2_PATH;
  if (!A2 || !existsSync(join(A2, 'MAPS.BSA'))) { console.error('settlementRevise: ARENA2_PATH is not an ARENA2 folder (sh tools/fetch-data.sh)'); process.exit(2); }
  const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
  const guarded = protectedByTown(arg('--protected') ? JSON.parse(readFileSync(arg('--protected'), 'utf8')) : []);
  const before = arg('--published') ? JSON.parse(readFileSync(arg('--published'), 'utf8')) : {};
  const file = (name) => readFileSync(join(A2, name));
  // the land past the Bay as the world host traces it (settlementSites.mjs's own steps)
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
  const woods = groundWoods(woods0);
  const log = console.log;
  console.log = () => {};
  const world = await loadWorldAtlas(A2, { served: true });
  console.log = log;
  // the network the archives give (roadsProducer.js) - the game's own, until Basic Roads' download replaces it
  const roads = buildRoadsFromArchives(world.maps, woods0);
  const bayLoc = new Map();
  for (let r = 0; r < world.maps.regionCount; r++) {
    if (!world.maps.getRegion(r)) continue;
    for (let l = 0; l < world.maps.baseLocationCount(r); l++) { const loc = world.maps.getLocation(r, l); if (loc?.mapTableData) bayLoc.set(loc.mapTableData.mapId >>> 0, loc); }
  }
  const dump = {}, refused = [], ledgers = new Map();
  // the published rows, each against its ledger
  const published = new Set();
  for (const row of SETTLEMENT_ROWS) {
    const place = settlementPlaceId(row.ordinal), [px, py] = settlementPixel(row);
    published.add(place);
    const g = generatePixelTerrain({ woods, px, py, stride: 1, tilemap: new Uint8Array(128 * 128), climateType: CLIMATES.Woodlands, landform: true, roads });
    if (!g.settlement) { refused.push(`${row.name}: no longer stands on its pixel`); continue; }
    const input = settlementInput(row, px, py);
    const conflicts = revisionConflicts(input, g.settlement.layout, guarded.get(place) ?? [], before[place] ?? []);
    for (const c of conflicts) refused.push(`${row.name} (${place}): ${c.code} ${c.key ?? ''} ${c.why}`);
    const made = dressSettlement(input, g.settlement.layout);
    if (!made.report.ok) refused.push(`${row.name}: no longer fits its ground (${made.report.counts.buildings} buildings, cut ${made.report.fit.cutMax} m)`);   // A row that stands empty is refused
    dump[place] = kept(made.plan);
    ledgers.set(row.ordinal, made.ledger);
  }
  // the grown towns a protected minted key names
  for (const [place, keys] of guarded) {
    if (published.has(place) || !keys.some((k) => k >= 0x800000)) continue;
    const where = world.places.all().find((p) => p.mapId === place);
    const loc = where && (bayLoc.get(place) ?? world.tamriel?.provinceQuestPlaces.standAt(where.px, where.py));
    if (!loc) { refused.push(`${place}: a protected minted key in a town this world does not hold`); continue; }
    const pixel = { x: where.px, y: where.py };
    const tilemap = new Uint8Array(128 * 128), rect = setLocationTiles(loc, world.maps, world.blocks, tilemap);
    const g = generatePixelTerrain({ woods, px: pixel.x, py: pixel.y, stride: 1, tilemap, locationRect: rect, hasLocation: true, climateType: CLIMATES.Woodlands, landform: true, roads, growth: growthJobAt(loc, pixel.x, pixel.y) });
    const plan = g.settlement?.growth ? dressSettlement(g.settlement.input, g.settlement.layout).plan : { buildings: [] };
    for (const k of protectedGone(plan, keys, before[place] ?? [])) refused.push(`${loc.name} (${place}): protected key ${k} - its building is gone, changed or moved`);
    dump[place] = kept(plan);
  }
  if (arg('--dump')) writeFileSync(arg('--dump'), `${JSON.stringify(dump)}\n`);
  for (const r of refused) console.log('REFUSED', r);
  if (refused.length) { process.exitCode = 1; return; }
  console.log(`settlementRevise: ${SETTLEMENT_ROWS.length} published, ${guarded.size} towns with protected keys - ${guarded.size ? 'nothing moves' : 'no protected keys given (--protected)'}`);
  if (process.argv.includes('--write')) {
    const path = new URL('../src/world/settlement/settlements.json', import.meta.url), json = JSON.parse(readFileSync(path, 'utf8'));
    for (const s of json.settlements) {
      const l = ledgers.get(s.ordinal);
      if (l) s.ledger = { next: l.next, keys: l.keys, retired: [...l.retired] };
    }
    writeFileSync(path, `${JSON.stringify(json, null, 1)}\n`);
  }
}

if (isMain(import.meta.url)) await main();
