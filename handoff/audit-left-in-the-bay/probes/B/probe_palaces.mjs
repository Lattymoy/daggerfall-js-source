// Lane B probe: the buildings a town past the Bay stands with - its palaces' and its other buildings' factions, as
// cloned from the Bay template (world/arenaLocations.js synthesizeArenaLocation keeps template.exterior.buildings).
const REPO = '/home/user/daggerfall-js-source';
await import(`${REPO}/test/modsOff.js`);
const ARENA2 = process.env.ARENA2_PATH ?? '/home/claude/dfdata/arena2';
const { standWorldPastBay } = await import(`${REPO}/test/systems/quest/r25World.mjs`);
const { REGION_NAMES } = await import(`${REPO}/src/formats/mapsTables.js`);
const { inBay } = await import(`${REPO}/src/world/tamriel/tamrielFrame.js`);
const world = await standWorldPastBay(ARENA2);
const { standAt } = world.places.provinceQuestPlaces;
const dict = world.factions.factionDict;
const rows = world.worldPlaces.all().filter((p) => !inBay(p.px, p.py) && p.type === 0);   // TownCity past the Bay
console.log(`${rows.length} cities past the Bay on the registry`);
const tally = new Map();
let palaces = 0, cities = 0, nobleHouses = 0;
for (const p of rows) {
  const loc = standAt(p.px, p.py);
  if (!loc?.exterior?.buildings) continue;
  cities++;
  for (const b of loc.exterior.buildings) {
    if (b.buildingType !== 16 && !(b.factionId > 0 && dict.get(b.factionId)?.region >= 0)) continue;
    const f = dict.get(b.factionId);
    if (b.buildingType === 16) palaces++; else nobleHouses++;
    const k = `${b.buildingType === 16 ? 'Palace' : `type ${b.buildingType}`}: faction ${b.factionId} ${f?.name ?? '(none)'} (region ${f?.region} ${REGION_NAMES[f?.region] ?? ''})`;
    const t = tally.get(k) ?? { n: 0, at: new Set() }; t.n++; t.at.add(`${loc.name} (${REGION_NAMES[loc.regionIndex]})`); tally.set(k, t);
  }
}
console.log(`${cities} stood: ${palaces} palaces, ${nobleHouses} other buildings carrying a region-bound faction`);
for (const [k, t] of [...tally].sort((a, b) => b[1].n - a[1].n).slice(0, 25)) console.log(`  ${t.n}x ${k} - e.g. ${[...t.at].slice(0, 3).join('; ')}`);
