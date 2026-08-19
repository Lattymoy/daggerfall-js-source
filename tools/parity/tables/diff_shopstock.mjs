import fs from 'fs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Internal/DaggerfallLootDataTables.cs','utf8');
const cs = {};
for (const m of src.matchAll(/public static byte\[\] itemGroups(\w+) = new byte\[\]\s*\{([^}]*)\}/g))
  cs[m[1]] = m[2].split(',').map(s=>parseInt(s.trim(),16));
const { SHOP_ITEM_GROUPS } = await import('../../../src/systems/shopStock.js');
const { BUILDING_TYPES } = await import('../../../src/world/buildingNames.js');
const inv = Object.fromEntries(Object.entries(BUILDING_TYPES).map(([k,v])=>[v,k]));
console.log('C# itemGroups* tables:', Object.keys(cs).join(', '));
console.log('port shop keys:', Object.keys(SHOP_ITEM_GROUPS).map(k=>inv[k]||k).join(', '));
let n=0, bad=[];
for (const [k,arr] of Object.entries(SHOP_ITEM_GROUPS)) {
  const name = inv[k];
  const c = cs[name];
  if (!c) { bad.push([name,'NO C# TABLE']); continue; }
  if (c.length!==arr.length) bad.push([name,'length',c.length,arr.length]);
  for (let i=0;i<Math.min(c.length,arr.length);i++){n++; if(c[i]!==arr[i]) bad.push({shop:name,i,cs:c[i],port:arr[i]});}
}
console.log('byte pairs compared:', n, 'mismatches:', bad.length); bad.forEach(b=>console.log(JSON.stringify(b)));
console.log('C# tables with no port row:', Object.keys(cs).filter(k=>!Object.keys(SHOP_ITEM_GROUPS).some(pk=>inv[pk]===k)));
