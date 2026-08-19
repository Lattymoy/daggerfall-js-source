import fs from 'fs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Game/Items/LootTables.cs','utf8');
// 1. LootChanceMatrix rows
const rows = {};
let order=[];
for (const m of src.matchAll(/new LootChanceMatrix\(\)\s*\{([^}]*)\}/g)) {
  const f={};
  for (const kv of m[1].split(',')) {
    const mm=/^\s*(\w+)\s*=\s*(?:"([^"]*)"|(-?\d+))\s*$/.exec(kv); if(!mm) { if(kv.trim()) throw new Error('bad kv '+kv); continue; }
    f[mm[1]] = mm[2]!==undefined ? mm[2] : parseInt(mm[3],10);
  }
  rows[f.key]=f; order.push(f.key);
}
const { LOOT_MATRICES, DUNGEON_LOOT_KEYS } = await import('../../../src/systems/loot.js');
console.log('C# matrix rows:', order.length, 'port rows:', Object.keys(LOOT_MATRICES).length);
console.log('key order identical:', JSON.stringify(order)===JSON.stringify(Object.keys(LOOT_MATRICES)));
const FIELDS=['MinGold','MaxGold','P1','P2','C1','C2','C3','M1','AM','WP','MI','CL','BK','M2','RL'];
let n=0, bad=[];
for (const k of order) {
  const p = LOOT_MATRICES[k];
  if (!p) { bad.push([k,'MISSING IN PORT']); continue; }
  for (const f of FIELDS) { n++; if (rows[k][f]!==p[f]) bad.push({key:k, field:f, cs:rows[k][f], port:p[f]}); }
  for (const f of Object.keys(p)) if (!FIELDS.includes(f)) bad.push([k,'EXTRA PORT FIELD',f]);
}
console.log('matrix values compared:', n, 'mismatches:', bad.length); bad.forEach(b=>console.log(JSON.stringify(b)));

// 2. lootTableKeys (dungeon type -> key)
const lk = /string\[\] lootTableKeys = \{([\s\S]*?)\};/.exec(src)[1];
const keys = [...lk.matchAll(/"([A-Z])"/g)].map(m=>m[1]);
console.log('\nC# lootTableKeys:', keys.length, JSON.stringify(keys));
console.log('port DUNGEON_LOOT_KEYS:', DUNGEON_LOOT_KEYS.length, JSON.stringify(DUNGEON_LOOT_KEYS));
console.log('identical:', JSON.stringify(keys)===JSON.stringify([...DUNGEON_LOOT_KEYS]));

// 3. mapChances
const mc = /int\[\] mapChances = \{([^}]*)\}/.exec(src);
console.log('\nC# mapChances:', mc && mc[1].trim());
