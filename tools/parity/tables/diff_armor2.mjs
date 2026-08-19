import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const e = parseEnumsFile(D+'/Game/Items/ItemEnums.cs');
const A = await import('../../../src/systems/armorMaterials.js');
const item = fs.readFileSync(D+'/Game/Items/DaggerfallUnityItem.cs','utf8');
function body(sig){ const i=item.indexOf(sig); let j=item.indexOf('{',i),d=0,s=j;
  for(;j<item.length;j++){ if(item[j]==='{')d++; else if(item[j]==='}'){d--; if(d===0)break;} } return item.slice(s+1,j); }
// material armor value
const mav = body('public virtual int GetMaterialArmorValue()');
const csMav = {}; let pend=[];
for (const line of mav.split('\n')) {
  let m;
  if ((m=/case \(int\)ArmorMaterialTypes\.(\w+)\s*:/.exec(line))) pend.push(m[1]);
  else if ((m=/result = (\d+);/.exec(line))) { for (const k of pend) csMav[k]=+m[1]; pend=[]; }
}
let n=0, bad=[];
for (const [k,v] of Object.entries(csMav)) { n++; const pv = A.materialArmorValue(e.ArmorMaterialTypes[k]); if (pv!==v) bad.push({mat:k,cs:v,port:pv}); }
console.log('GetMaterialArmorValue entries compared:', n, 'mismatches:', bad.length, JSON.stringify(bad));
// shield values
const sav = body('public virtual int GetShieldArmorValue()');
const csSav = {}; pend=[];
for (const line of sav.split('\n')) { let m;
  if ((m=/case \(int\)Armor\.(\w+)\s*:/.exec(line))) pend.push(m[1]);
  else if ((m=/return (\d+);/.exec(line))) { for (const k of pend) csSav[k]=+m[1]; pend=[]; } }
let sn=0, sbad=[];
for (const [k,v] of Object.entries(csSav)) { sn++; const idx=e.Armor[k]; const pv=A.SHIELD_VALUES.get(idx); if (pv!==v) sbad.push({shield:k, idx, cs:v, port:pv}); }
console.log('GetShieldArmorValue compared:', sn, 'mismatches:', sbad.length, JSON.stringify(sbad));
// shield protected parts
const spb = body('public virtual BodyParts[] GetShieldProtectedBodyParts()');
const csSpb = {}; pend=[];
for (const line of spb.split('\n')) { let m;
  if ((m=/case \(int\)Armor\.(\w+)\s*:/.exec(line))) pend.push(m[1]);
  else if ((m=/return new BodyParts\[\] \{([^}]*)\}/.exec(line))) {
    const parts=[...m[1].matchAll(/BodyParts\.(\w+)/g)].map(x=>e.BodyParts[x[1]]);
    if (parts.length) { for (const k of pend) csSpb[k]=parts; pend=[]; } else pend=[]; } }
let pn=0, pbad=[];
for (const [k,v] of Object.entries(csSpb)) { pn+=v.length; const idx=e.Armor[k]; const pv=A.SHIELD_PARTS.get(idx);
  if (JSON.stringify(v)!==JSON.stringify(pv)) pbad.push({shield:k, idx, cs:v, port:pv}); }
console.log('GetShieldProtectedBodyParts values compared:', pn, 'mismatches:', pbad.length, JSON.stringify(pbad));
console.log('C# Armor enum:', JSON.stringify(e.Armor));
