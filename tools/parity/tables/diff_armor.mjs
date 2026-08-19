import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const e = parseEnumsFile(D+'/Game/Items/ItemEnums.cs');
const A = await import('../../../src/systems/armorMaterials.js');
let n=0, bad=[];
for (const [k,v] of Object.entries(A.ARMOR_MATERIAL)) { n++; if (e.ArmorMaterialTypes[k]!==v) bad.push({k, cs:e.ArmorMaterialTypes[k], port:v}); }
for (const k of Object.keys(e.ArmorMaterialTypes)) if (!(k in A.ARMOR_MATERIAL)) bad.push({k, cs:e.ArmorMaterialTypes[k], port:'ABSENT'});
console.log('ArmorMaterialTypes compared:', n, 'mismatches:', bad.length); bad.forEach(b=>console.log(JSON.stringify(b)));
// BodyParts
let bn=0, bbad=[];
for (const [k,v] of Object.entries(A.BODY_PARTS)) { bn++; if (e.BodyParts[k]!==v) bbad.push({k,cs:e.BodyParts[k],port:v}); }
console.log('BodyParts compared:', bn, 'mismatches:', bbad.length, JSON.stringify(bbad));
console.log('C# BodyParts:', JSON.stringify(e.BodyParts), 'port NUMBER_BODY_PARTS', A.NUMBER_BODY_PARTS);

// GetMaterialArmorValue
const item = fs.readFileSync(D+'/Game/Items/DaggerfallUnityItem.cs','utf8');
function methodBody(sig){ const i=item.indexOf(sig); if(i<0) throw new Error('nf '+sig); let j=item.indexOf('{',i),d=0,s=j;
  for(;j<item.length;j++){ if(item[j]==='{')d++; else if(item[j]==='}'){d--; if(d===0)break;} } return item.slice(s+1,j); }
const mav = methodBody('public int GetMaterialArmorValue()');
console.log('\n--- GetMaterialArmorValue ---\n'+mav.replace(/\n\s*\n/g,'\n'));
const sav = methodBody('public int GetShieldArmorValue()');
console.log('--- GetShieldArmorValue ---\n'+sav.replace(/\n\s*\n/g,'\n'));
const spb = methodBody('public BodyParts[] GetShieldProtectedBodyParts()');
console.log('--- GetShieldProtectedBodyParts ---\n'+spb.replace(/\n\s*\n/g,'\n'));
