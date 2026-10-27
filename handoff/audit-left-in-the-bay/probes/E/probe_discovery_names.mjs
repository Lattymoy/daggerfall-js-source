// LANE E probe: the building-discovery key `${regionIndex}:${name}` (scenes/world.js discoveryLocationId) past the Bay,
// where a province is ONE region (WW-R) and a countryside hamlet's name is one stem of its province's bank
// (world/tamrielCountry.js countryName, TownHamlet/TownVillage '%t'). How many hamlets of Skyrim share a key?
const R = '/home/user/daggerfall-js-source';
const { countryName, countryNameSeed } = await import(`${R}/src/world/tamrielCountry.js`);
const { BANK_TYPES } = await import(`${R}/src/characters/nameHelper.js`);
const { LOCATION_TYPES } = await import(`${R}/src/formats/mapsFile.js`);
const disc = await import(`${R}/src/systems/discovery.js`);
const names = new Map();
let n = 0;
for (let py = -900; py < -500; py += 4) for (let px = 1400; px < 2400; px += 4) {
  const name = countryName(LOCATION_TYPES.TownHamlet, BANK_TYPES.Nord, countryNameSeed(px, py));
  names.set(name, (names.get(name) ?? 0) + 1); n++;
}
const top = [...names].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(`hamlet names over ${n} Skyrim pixels: ${names.size} distinct; most common`, top);
// the store: a building discovered (and a lock failed) in one "Hjall" is the same record in every other
const [name] = top[0];
const key = `64:${name}`;
disc.discoverBuilding(key, { buildingKey: 0x10203, name: 'The Frosty Flagon', factionId: 0, quality: 5, buildingType: 15 });
disc.setLastLockpickAttempt(key, 0x10203, 37);
console.log('another hamlet named', JSON.stringify(name), 'in Skyrim: hasDiscoveredBuilding', disc.hasDiscoveredBuilding(key, 0x10203), '| name', JSON.stringify(disc.getDiscoveredBuilding(key, 0x10203)?.displayName), '| last lockpick', disc.getLastLockpickAttempt(key, 0x10203));
