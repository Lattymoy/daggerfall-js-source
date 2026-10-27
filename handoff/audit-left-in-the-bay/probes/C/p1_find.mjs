// C probe 1: the held map's Find box indexes MAPS.BSA's regions alone (ui/heldMap.js _ensureSearchIndex):
// how many of the registry's places past the Bay could it ever name?
import { setup } from './setup.mjs';
const { maps, tesaRows } = await setup();
const bayNames = new Set();
for (let r = 0; r < maps.regionCount; r++) { const g = maps.getRegion(r); if (g) g.mapNames.forEach((n) => bayNames.add(n)); }
const named = new Map(); for (const r of tesaRows) if (!named.has(r.name)) named.set(r.name, r);
const unsearchable = [...named.keys()].filter((n) => !bayNames.has(n));
console.log('Bay names in the find index:', bayNames.size);
console.log('distinct place names past the Bay on the registry:', named.size, '- of them never in the find index:', unsearchable.length);
for (const n of ['Solitude', 'Windhelm', 'Whiterun', 'Imperial City', 'Mournhold', 'Alinor', 'Elden Root', 'Senchal', 'Gideon', 'Kvatch']) console.log(`  ${n}: in find index=${bayNames.has(n)}, on registry=${named.has(n)}`);
