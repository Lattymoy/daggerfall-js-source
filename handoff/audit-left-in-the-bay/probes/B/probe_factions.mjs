const REPO = '/home/user/daggerfall-js-source';
const { readFileSync } = await import('node:fs');
const { FactionFile, FACTION_TYPES } = await import(`${REPO}/src/formats/factionFile.js`);
const { REGION_NAMES } = await import(`${REPO}/src/formats/mapsTables.js`);
const { getPeopleOfCurrentRegion, getCourtOfCurrentRegion, findFactions, findFactionByTypeAndRegion } = await import(`${REPO}/src/systems/talk/talk.js`);
const f = new FactionFile(); f.load(new Uint8Array(readFileSync('/home/claude/dfdata/arena2/FACTION.TXT')));
const d = f.factionDict;
const typeName = Object.fromEntries(Object.entries(FACTION_TYPES).map(([k, v]) => [v, k]));
const hi = [...d.values()].filter((x) => x.region >= 62);
console.log(`FACTION.TXT: ${d.size} factions; ${hi.length} carry a region >= 62:`);
for (const x of hi) console.log(`  ${x.id} ${x.name} type ${typeName[x.type] ?? x.type} region ${x.region} (now names ${REGION_NAMES[x.region] ?? '-'})`);
for (const r of [17, 62, 63, 64, 65, 66, 67, 68, 69, 70]) {
  const prov = findFactions(d, { type: FACTION_TYPES.Province, region: r })[0];
  console.log(`region ${r} ${REGION_NAMES[r]}: People ${getPeopleOfCurrentRegion(d, r)?.name ?? 'none'} | Court ${getCourtOfCurrentRegion(d, r)?.name ?? 'none'} | Province ${prov?.name ?? 'none'} (vam ${prov?.vam}) | %rn/%rt lookup(7) -> ${findFactionByTypeAndRegion(d, 7, r)?.name ?? 'none'}`);
}
