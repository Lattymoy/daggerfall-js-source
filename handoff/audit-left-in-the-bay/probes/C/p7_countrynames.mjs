// C probe 7: the countryside's place names past the Bay (world/tamrielCountry.js countryName - the name the place's
// building book is filed under with its province's region) - how often one name repeats over a province's pixels.
import { imp, bytes } from './setup.mjs';
const { countryName, countryNameSeed } = await imp('world/tamrielCountry.js');
const { LOCATION_TYPES } = await imp('formats/mapsFile.js');
const { BANK_TYPES } = await imp('characters/nameHelper.js');
try { const nh = await imp('characters/nameHelper.js'); if (nh.loadNameBanks) nh.loadNameBanks(bytes('NAMEGEN.DAT')); } catch (e) { /* the base banks */ }
for (const [label, type] of [['farm', LOCATION_TYPES.HomeFarms], ['village', LOCATION_TYPES.TownVillage], ['temple', LOCATION_TYPES.ReligionTemple], ['tavern', LOCATION_TYPES.Tavern]]) {
  const seen = new Map(); let n = 0;
  for (let y = -600; y < -300; y += 3) for (let x = 1400; x < 2300; x += 3) { const nm = countryName(type, BANK_TYPES.Nord, countryNameSeed(x, y)); if (!nm) continue; n++; seen.set(nm, (seen.get(nm) ?? 0) + 1); }
  const rep = [...seen.values()].filter((c) => c > 1);
  console.log(`${label}: ${n} pixels drawn, ${seen.size} distinct names, ${rep.length} names on 2+ pixels (${rep.reduce((a, b) => a + b, 0)} pixels); top: ${[...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} x${v}`).join(', ')}`);
}
