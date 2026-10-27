// Lane B probe: a town past the Bay (Solitude) against a Bay town (Daggerfall) - the quest layer's %di, the talk's
// Regional "Where is", the map item / TG-DB reveal, the Mages Guild's scrying region, the legacy birth's boot start,
// and the market hubs. READ-ONLY: imports the repo's modules, writes nothing there.
const REPO = '/home/user/daggerfall-js-source';
await import(`${REPO}/test/modsOff.js`);
const { readFileSync } = await import('node:fs');
const ARENA2 = process.env.ARENA2_PATH ?? '/home/claude/dfdata/arena2';
const { standWorldPastBay, questLayerAt } = await import(`${REPO}/test/systems/quest/r25World.mjs`);
const { loadTables, questSource } = await import(`${REPO}/test/qlSources.mjs`);
const { REGION_NAMES } = await import(`${REPO}/src/formats/mapsTables.js`);
const { longitudeLatitudeToMapPixel } = await import(`${REPO}/src/formats/mapsFile.js`);
const { createProvinceWarm } = await import(`${REPO}/src/scenes/quest/questProvinceWarm.js`);
const { QUEST_REACH_TUNING } = await import(`${REPO}/src/systems/quest/questReach.js`);
const talk = await import(`${REPO}/src/systems/talk/talk.js`);
const { scryRows, scryRefusal } = await import(`${REPO}/src/systems/loot/lootScry.js`);
const { pickRegionHubs } = await import(`${REPO}/src/systems/region/regionHubs.js`);

loadTables();
const world = await standWorldPastBay(ARENA2);
const { standAt } = world.places.provinceQuestPlaces;
QUEST_REACH_TUNING.override = true;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };

async function offerAt(label, pixel, location, name, factionID) {
  const L = await questLayerAt(world, { pixel: { x: pixel[0], y: pixel[1] }, location });
  const r = world.maps.getRegionIndexAt(pixel[0], pixel[1]);
  if (L.questWorld.provinceSites) {
    const warm = createProvinceWarm({ provinces: L.questWorld.provinceSites, regionNow: () => r, origin: () => ({ x: pixel[0], y: pixel[1] }) });
    for (let n = 0; !warm.done() && n < 4000; n++) warm.tick();
  }
  L.machine.setLastNPCClicked({ hash: 1, mapID: location.mapTableData.mapId, nameSeed: 7, buildingKey: 0, factionID, gender: 0 });
  const quest = quiet(() => L.machine.parseQuestForLists(questSource(name, true), factionID, { rolls: seeded(name.length * 31 + pixel[0]) }));
  if (!quest) { console.log(`${label}: ${name} parsed to NO WORK`); return null; }
  quiet(() => { L.machine.startQuestImmediate(quest); quest.update(); });
  console.log(`\n== ${label} (${location.name}, region ${r} ${REGION_NAMES[r]}): ${name} ==`);
  for (const p of [...quest.resources.values()].filter((x) => x.isPlace)) {
    const sd = p.siteDetails;
    const di = L.questWorld.locationCompassDirection(p);   // the %di macro's remote arm, as the host wires it
    // the same law over the quest layer's own maps (the provinces' tables), its region bound the 71 - the fix's shape
    const fixedMaps = Object.create(L.questWorld.maps, { regionCount: { value: REGION_NAMES.length } });
    const diFixed = talk.locationCompassDirection({ playerMapPixel: () => ({ x: pixel[0], y: pixel[1] }), maps: fixedMaps }, sd?.locationName ?? '');
    console.log(`  ${p.symbol.name} [${p.scope}] -> ${sd?.locationName} (${sd?.regionName}) | %di as wired: "${di}" | over the quest layer's maps: "${diFixed}"`);
  }
  return L;
}

// THE BAY: Daggerfall's Fighters Guild
const bay = world.maps.getLocationByName('Daggerfall', 'Daggerfall');
const bayPx = longitudeLatitudeToMapPixel(bay.mapTableData.longitude, bay.mapTableData.latitude);
await offerAt('BAY', [bayPx.x, bayPx.y], bay, 'M0B00Y07', 41);
await offerAt('BAY', [bayPx.x, bayPx.y], bay, 'N0B00Y06', 40);
// PAST THE BAY: Solitude's Mages Guild and Fighters Guild
const sol = standAt(1569, -430);
await offerAt('PAST THE BAY', [1569, -430], sol, 'N0B00Y06', 40);
await offerAt('PAST THE BAY', [1569, -430], sol, 'M0B00Y07', 41);

// TALK'S "WHERE IS" > REGIONAL (scenes/world.js answer pipeline: currentRegion: () => maps.getRegion(_questRegionIndex()))
console.log('\n== Regional "Where is" / map reveal / scrying: the region table each host read gets ==');
for (const [label, px, loc] of [['BAY Daggerfall', bayPx, bay], ['PAST Solitude', { x: 1569, y: -430 }, sol]]) {
  const r = world.maps.getRegionIndexAt(px.x, px.y);
  const region = world.maps.getRegion(r);   // answer pipeline currentRegion, revealLocation (dfLoc.regionIndex), scryWhere
  const keyed = region ? region.mapTable.filter((row) => row.key).length : 0;
  const where = region ? { rows: scryRows(region), at: px } : null;
  console.log(`  ${label}: region ${r} (${REGION_NAMES[r]}) loc.regionIndex=${loc.regionIndex} | maps.getRegion -> ${region ? `${region.locationCount} rows, ${keyed} with a MapTable key` : 'NULL'} | scryWhere -> ${where ? `${where.rows.length} rows` : 'null'} -> scryRefusal('undead') = ${scryRefusal({ items: [] }, 'undead', where)}`);
}
{ const L = await questLayerAt(world, { pixel: { x: 1569, y: -430 }, location: sol }); const pr = L.questWorld.maps.getRegion(64);
  console.log(`  the quest layer's own table for Skyrim (questWorld.maps.getRegion(64)): ${pr ? `${pr.locationCount} rows; row[0] keys: ${Object.keys(pr.mapTable[0] ?? {}).join(',')}` : 'null'}`);
  console.log(`  Solitude's own mapTableData.key (the template's directory bits): ${sol.mapTableData?.key}`); }

// LEGACY: the boot start a birth at a seat past the Bay asks (scenes/world.js, the text between `let startLoc = null;` and its throw)
{
  const W = readFileSync(`${REPO}/src/scenes/world.js`, 'utf8');
  const from = W.indexOf("  let startLoc = null;\n  if (params.has('classic')) {");
  const to = W.indexOf('  if (!startLoc) throw new Error(`location not found: ${regionName}/${locationName}`);', from);
  const names = /const regionName = ([^;\n]+);\n\s*const locationName = ([^;\n]+);/.exec(W);
  const run = new Function('params', 'getInt', 'locationIndex', 'maps', `const regionName = ${names[1]}; const locationName = ${names[2]}; ${W.slice(from, to)} if (!startLoc) throw new Error('location not found: ' + regionName + '/' + locationName); return startLoc;`);
  for (const q of ['?world=1&legacyborn=4&region=Daggerfall&loc=Daggerfall', '?world=1&legacyborn=4&region=Skyrim&loc=Solitude']) {
    const params = new URLSearchParams(q);
    try { const l = run(params, () => 0, new Map(), world.maps); console.log(`\n== LEGACY birth boot ${q}: stands at ${l.name}`); }
    catch (e) { console.log(`\n== LEGACY birth boot ${q}: THROWS "${e.message}"`); }
  }
}

// HUB1: the hubs the client derives (scenes/world.js regionHubs over _hubRows, MAPS.BSA's own) - the market's courier ends
{
  const hubs = pickRegionHubs(world.rows, { regionNameOf: (r) => world.maps.getRegionName(r) });
  const keys = [...hubs.byRegion.keys()].sort((a, b) => a - b);
  console.log(`\n== HUB1 hubs derived: ${keys.length} regions, max ${Math.max(...keys)}; any of 62..70: ${keys.some((k) => k >= 62)}`);
}
