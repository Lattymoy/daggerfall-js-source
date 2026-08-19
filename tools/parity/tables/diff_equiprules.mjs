import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Game/Items/ItemEquipTable.cs','utf8');
const en = parseEnumsFile(D+'/Game/Items/ItemEnums.cs');
function body(sig){ const i=src.indexOf(sig); if(i<0) throw new Error('nf '+sig); let j=src.indexOf('{',i),d=0,s=j;
  for(;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){d--; if(d===0)break;} } return src.slice(s+1,j); }
function slotTable(sig, enumName) {
  const b = body(sig); const out={}; let pend=[];
  for (const line of b.split('\n')) {
    let m;
    if ((m=new RegExp('case \\('+enumName+'\\)?\\)?\\s*$').exec(line))) {}
    if ((m=new RegExp('case '+enumName+'\\.(\\w+)\\s*:').exec(line))) { pend.push(m[1]); continue; }
    if ((m=/return GetFirstSlot\(EquipSlots\.(\w+),\s*EquipSlots\.(\w+)\)/.exec(line))) { for(const k of pend) out[k]={pair:[m[1],m[2]]}; pend=[]; continue; }
    if ((m=/return EquipSlots\.(\w+)/.exec(line))) { if (pend.length) { for(const k of pend) out[k]={slot:m[1]}; pend=[]; } continue; }
  }
  return out;
}
const cs = {
  Armor: slotTable('EquipSlots GetArmorSlot(', 'Armor'),
  Jewellery: slotTable('EquipSlots GetJewellerySlot(', 'Jewellery'),
  MensClothing: slotTable('EquipSlots GetMensClothingSlot(', 'MensClothing'),
  WomensClothing: slotTable('EquipSlots GetWomensClothingSlot(', 'WomensClothing'),
};
const { SLOT_RULES, WEAPON_HANDS, SHIELD_INDICES, ITEM_GROUPS } = await import('../../../src/characters/equipRules.js');
let n=0, bad=[];
for (const [g, table] of Object.entries(cs)) {
  const p = SLOT_RULES[g] || {};
  const seen = new Set();
  for (const [name, rule] of Object.entries(table)) {
    const idx = en[g][name];
    seen.add(String(idx));
    const pr = p[String(idx)];
    n++;
    if (!pr) { bad.push({group:g, name, idx, cs:rule, port:'ABSENT'}); continue; }
    if (JSON.stringify(rule)!==JSON.stringify(pr)) bad.push({group:g, name, idx, cs:rule, port:pr});
  }
  for (const k of Object.keys(p)) if (!seen.has(k)) bad.push({group:g, idx:k, cs:'ABSENT', port:p[k]});
}
console.log('equip slot rules compared:', n, 'mismatches:', bad.length);
bad.forEach(b=>console.log(JSON.stringify(b)));
// ITEM_GROUPS
let gn=0, gbad=[];
for (const [k,v] of Object.entries(ITEM_GROUPS)) { gn++; if (en.ItemGroups[k]!==v) gbad.push({k,cs:en.ItemGroups[k],port:v}); }
console.log('ItemGroups compared:', gn, 'mismatches:', gbad.length, JSON.stringify(gbad));
// GetItemHands weapon map
const gih = body('public static ItemHands GetItemHands(');
console.log('\n--- GetItemHands ---\n'+gih.replace(/\n\s*\n/g,'\n'));
console.log('port WEAPON_HANDS:', JSON.stringify(WEAPON_HANDS), 'SHIELD_INDICES', JSON.stringify(SHIELD_INDICES));
