// C probe 12: scenes/world.js carriageTown reads a map id as a Bay pixel id - `locationIndex.get(`${id % 1000},${Math.floor(id / 1000)}`)`
// with id = mapId & 0xfffff. For a place past the Bay that pixel is another place's, or none (the Overworld's plate wheel).
import { setup, imp } from './setup.mjs';
const { tesaRows, places } = await setup();
const { isCapitalPlaceId } = await imp('world/tamrielCapitals.js');
let none = 0, other = 0; const samples = [];
for (const r of tesaRows) {
  if (isCapitalPlaceId(r.mapId) && (r.mapId & 0x7ffff) >= 16) continue;   // a capital once
  const id = r.mapId & 0xfffff, x = id % 1000, y = Math.floor(id / 1000);
  const there = places.at(x, y);
  if (there && there.mapId !== r.mapId) { other++; if (samples.length < 4) samples.push(`${r.name} (${r.px},${r.py}) -> asks (${x},${y}): ${there.name}`); } else if (!there) none++;
  if (samples.length < 6 && !there && samples.length < 2) samples.push(`${r.name} (${r.px},${r.py}) -> asks (${x},${y}): nothing listed`);
}
console.log(`listed places past the Bay asked: ${none + other}; the aliased pixel holds no listed place: ${none}; another place: ${other}`);
for (const s of samples) console.log('  ', s);
