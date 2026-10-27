// D1 probe: the living world's road trouble (scenes/world.js livingTroubleWorld.foesOf) past the Bay vs the zone's fauna.
import { setup, imp } from './base.mjs';
const { maps } = await setup();
const { rollGroupComposition } = await imp('systems/campEncounters.js');
const { faunaBandAt, installTamrielFauna } = await imp('systems/tamrielFauna.js');
const { enemyDisplayName } = await imp('characters/enemy/enemyBasics.js');
const { tamrielBiomeAt } = await imp('world/tamriel/tamrielBiomes.js');
const { lwRng } = await imp('systems/livingWorld/seed.js');
installTamrielFauna();
maps.getFaunaBand = faunaBandAt;
const pts = { 'Black Marsh (Helstrom 3355,1108)': [3355, 1108], 'Skyrim tundra (Whiterun 1891,-202)': [1891, -202], 'Elsweyr (Torval 1922,1705)': [1922, 1705], 'Morrowind (Mournhold 3293,550)': [3293, 550] };
for (const [name, [px, py]] of Object.entries(pts)) {
  const climateIndex = maps.getClimateIndex(px, py);
  const tally = (withFauna) => { const c = new Map(); for (let s = 1; s <= 400; s++) { const rng = lwRng(s * 7919 + px, py); const r = rollGroupComposition({ climateIndex, ...(withFauna ? { fauna: maps.getFaunaBand(px, py) } : {}), skyMinutes: (s * 97) % 1440, inLocationRect: false, playerLevel: 1 + (s % 15), size: 3 }, rng); for (const m of r?.mobileTypes ?? []) c.set(enemyDisplayName(m), (c.get(enemyDisplayName(m)) ?? 0) + 1); } return [...c].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, k]) => `${n} ${k}`).join(', '); };
  console.log(`${name}: climate ${climateIndex} zone ${tamrielBiomeAt(px, py)?.key}`);
  console.log('  host foesOf (no fauna):', tally(false));
  console.log('  with the zone\'s fauna :', tally(true));
}
