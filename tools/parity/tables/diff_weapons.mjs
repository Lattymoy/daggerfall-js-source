import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const e = parseEnumsFile(D+'/Game/Items/ItemEnums.cs');
const ib = fs.readFileSync(D+'/Game/Items/ItemBuilder.cs','utf8');
const W = await import('../../../src/characters/weapons.js');
let n=0, bad=[];
for (const [k,v] of Object.entries(W.WEAPONS)) { n++; if (e.Weapons[k]!==v) bad.push({k, cs:e.Weapons[k], port:v}); }
for (const k of Object.keys(e.Weapons)) if (!(k in W.WEAPONS)) bad.push({k, cs:e.Weapons[k], port:'ABSENT'});
console.log('Weapons enum compared:', n, 'mismatches:', bad.length, JSON.stringify(bad));
let mn=0, mbad=[];
for (const [k,v] of Object.entries(W.WEAPON_MATERIALS)) { mn++; if (e.WeaponMaterialTypes[k]!==v) mbad.push({k, cs:e.WeaponMaterialTypes[k], port:v}); }
console.log('WeaponMaterialTypes compared:', mn, 'mismatches:', mbad.length, JSON.stringify(mbad));
// multiplier arrays
for (const [csName, portArr] of [['weightMultipliersByMaterial',W.weightMultipliersByMaterial],
                                 ['valueMultipliersByMaterial',W.valueMultipliersByMaterial],
                                 ['conditionMultipliersByMaterial',W.conditionMultipliersByMaterial]]) {
  const m = new RegExp(csName+'\\s*=\\s*(?:new (?:short|int|byte)\\[\\]\\s*)?\\{([^}]*)\\}').exec(ib);
  if (!m) { console.log(csName, 'NOT FOUND in ItemBuilder.cs'); continue; }
  const cs = m[1].split(',').map(x=>parseInt(x.trim(),10)).filter(x=>!Number.isNaN(x));
  const eq = JSON.stringify(cs)===JSON.stringify([...portArr]);
  console.log(csName, 'cs', JSON.stringify(cs), 'port', JSON.stringify([...portArr]), 'equal', eq, '(', cs.length, 'values )');
}
