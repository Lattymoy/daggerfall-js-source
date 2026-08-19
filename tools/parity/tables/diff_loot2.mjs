import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const e = parseEnumsFile(D+'/Game/Items/ItemEnums.cs');
const { ITEM_GROUPS, RANDOM_TREASURE_ICONS, RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_MARKER_RECORD, BOOK_TEMPLATE } = await import('../../../src/systems/loot.js');
let n=0, bad=[];
for (const [g,arr] of Object.entries(ITEM_GROUPS)) {
  const vals = Object.values(e[g]||{});
  if (vals.length !== arr.length) bad.push([g,'length',vals.length,arr.length]);
  for (let i=0;i<Math.min(vals.length,arr.length);i++){n++; if(vals[i]!==arr[i]) bad.push({g,i,cs:vals[i],port:arr[i]});}
}
console.log('loot.js ITEM_GROUPS: groups', Object.keys(ITEM_GROUPS).length, 'values', n, 'mismatches', bad.length); bad.forEach(b=>console.log(JSON.stringify(b)));
// treasure icons
const dl = fs.readFileSync(D+'/Internal/DaggerfallLootDataTables.cs','utf8');
console.log('--- DaggerfallLootDataTables randomTreasureIconIndices:');
const m = /randomTreasureIconIndices\s*=\s*(?:new int\[\]\s*)?\{([^}]*)\}/.exec(dl);
const cs = m[1].split(',').map(s=>parseInt(s.trim(),10)).filter(x=>!Number.isNaN(x));
console.log('cs', cs.length, JSON.stringify(cs));
console.log('port', RANDOM_TREASURE_ICONS.length, JSON.stringify([...RANDOM_TREASURE_ICONS]));
console.log('identical:', JSON.stringify(cs)===JSON.stringify([...RANDOM_TREASURE_ICONS]));
const ma = /randomTreasureArchive\s*=\s*(\d+)/.exec(dl); console.log('archive cs', ma&&ma[1], 'port', RANDOM_TREASURE_ARCHIVE);
console.log('BOOK_TEMPLATE port', BOOK_TEMPLATE, 'C# Books enum:', JSON.stringify(e.Books));
