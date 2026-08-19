import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const e = parseEnumsFile(D+'/Game/Items/ItemEnums.cs');
const { GROUP_TEMPLATE_INDICES } = await import('../../../src/systems/itemTemplatesData.js');
const groups = Object.keys(GROUP_TEMPLATE_INDICES);
let cnt=0, bad=[];
console.log('C# enums in ItemEnums.cs:', Object.keys(e).join(', '));
for (const g of groups) {
  const en = e[g];
  if (!en) { bad.push([g,'NO SUCH C# ENUM']); continue; }
  const vals = Object.values(en);
  const p = GROUP_TEMPLATE_INDICES[g];
  if (vals.length !== p.length) bad.push([g,'length', vals.length, p.length, JSON.stringify(Object.keys(en))]);
  for (let i=0;i<Math.min(vals.length,p.length);i++){ cnt++; if (vals[i]!==p[i]) bad.push({group:g, i, name:Object.keys(en)[i], cs:vals[i], port:p[i]}); }
}
// C# enums that the port has no group for
const skip = new Set(['ItemGroups','WeaponMaterialTypes','ArmorMaterialTypes','ArmorTypes','Poisons','Skills','BodyParts','WeaponTypes','ItemTemplates']);
console.log('port groups:', groups.length, 'values compared:', cnt, 'mismatches:', bad.length);
bad.forEach(b=>console.log(JSON.stringify(b)));
