const REPO = '/home/user/daggerfall-js-source';
const { getMacroValue } = await import(`${REPO}/src/systems/quest/questMacros.js`);
const { REGION_RACES, REGION_NAMES } = await import(`${REPO}/src/formats/mapsTables.js`);
for (const r of [17, 20, 62, 63, 64, 65, 66, 67, 68, 69, 70]) {
  const world = { currentRegionRace: () => REGION_RACES[r] + 1 };   // questWorld.currentRegionRace, as wired
  console.log(`region ${r} ${REGION_NAMES[r]}: %lp -> ${getMacroValue('%lp', null, { world })}`);
}
