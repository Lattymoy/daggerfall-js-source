import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const raw = fs.readFileSync(D+'/Utility/RandomEncounters.cs','utf8');
const mob = parseEnumsFile(D+'/DaggerfallUnityEnums.cs').MobileTypes;
// strip comments first (the source carries a commented-out Cemetery block)
const src = raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
const tables = [];
for (const m of src.matchAll(/new RandomEncounterTable\(\)\s*\{([\s\S]*?)\n            \},/g)) {
  const dt = /DungeonType = DFRegion\.DungeonTypes\.(\w+)/.exec(m[1]);
  const en = [...m[1].matchAll(/MobileTypes\.(\w+)/g)].map(x=>{ if(!(x[1] in mob)) throw new Error('unknown mobile '+x[1]); return mob[x[1]]; });
  tables.push({ dungeonType: dt && dt[1], enemies: en });
}
const { ENCOUNTER_TABLES } = await import('../../../src/characters/encounterTables.js');
console.log('C# tables:', tables.length, 'port tables:', ENCOUNTER_TABLES.length);
console.log('row lengths (C#):', [...new Set(tables.map(t=>t.enemies.length))]);
console.log('row lengths (port):', [...new Set(ENCOUNTER_TABLES.map(t=>t.length))]);
let n=0, bad=[];
for (let i=0;i<Math.max(tables.length, ENCOUNTER_TABLES.length);i++) {
  const c = tables[i], p = ENCOUNTER_TABLES[i];
  if (!c || !p) { bad.push([i, c?'MISSING IN PORT':'EXTRA IN PORT']); continue; }
  for (let j=0;j<Math.max(c.enemies.length,p.length);j++){ n++; if (c.enemies[j]!==p[j]) bad.push({table:i, type:c.dungeonType, slot:j, cs:c.enemies[j], port:p[j]}); }
}
console.log('encounter slots compared:', n, 'mismatches:', bad.length);
bad.slice(0,40).forEach(b=>console.log(JSON.stringify(b)));
console.log('\ndungeon types in order:', tables.map((t,i)=>i+':'+t.dungeonType).join(' '));
