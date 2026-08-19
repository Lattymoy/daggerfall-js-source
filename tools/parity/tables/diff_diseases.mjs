import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Game/MagicAndEffects/Effects/Diseases/DiseaseEffect.cs','utf8');
const rows = [...src.matchAll(/new DiseaseData\(([^)]*)\)/g)].map(m=>m[1].split(',').map(x=>{
  const t=x.trim(); return /^0x/i.test(t)?parseInt(t,16):parseInt(t,10);
})).filter(r=>r.length===15);
const P = await import('../../../src/systems/diseases.js');
const COLS = ['STR','INT','WIL','AGI','END','PER','SPD','LUC','HEA','FAT','SPL','minDamage','maxDamage','daysOfSymptomsMin','daysOfSymptomsMax'];
console.log('C# DiseaseData rows:', rows.length, 'port DISEASE_DATA rows:', P.DISEASE_DATA.length);
let n=0, bad=[];
for (let i=0;i<rows.length;i++) {
  const p = P.DISEASE_DATA[i];
  for (let c=0;c<COLS.length;c++){ n++; if (rows[i][c]!==p[COLS[c]]) bad.push({row:i, col:COLS[c], cs:rows[i][c], port:p[COLS[c]]}); }
}
console.log('disease field values compared:', n, 'mismatches:', bad.length); bad.forEach(b=>console.log(JSON.stringify(b)));
// Diseases enum
const en = parseEnumsFile(D+'/Game/MagicAndEffects/MagicAndEffectsEnums.cs');
let dn=0, dbad=[];
for (const [k,v] of Object.entries(P.DISEASES)) { dn++; if (en.Diseases[k]!==v) dbad.push({k, cs:en.Diseases[k], port:v}); }
for (const k of Object.keys(en.Diseases||{})) if (!(k in P.DISEASES)) dbad.push({k, cs:en.Diseases[k], port:'ABSENT'});
console.log('Diseases enum compared:', dn, 'mismatches:', dbad.length, JSON.stringify(dbad));
// disease lists in FormulaHelper.OnMonsterHit
const fh = fs.readFileSync(D+'/Game/Formulas/FormulaHelper.cs','utf8');
for (const [name, portArr] of [['diseaseListA',P.DISEASE_LIST_A],['diseaseListB',P.DISEASE_LIST_B],['diseaseListC',P.DISEASE_LIST_C]]) {
  const m = new RegExp('Diseases\\[\\] '+name+' = \\{([\\s\\S]*?)\\};').exec(fh);
  const cs = [...m[1].matchAll(/Diseases\.(\w+)/g)].map(x=>en.Diseases[x[1]]);
  console.log(name, 'cs len', cs.length, 'port len', portArr.length, 'equal', JSON.stringify(cs)===JSON.stringify([...portArr]));
  if (JSON.stringify(cs)!==JSON.stringify([...portArr])) console.log('  cs', JSON.stringify(cs), 'port', JSON.stringify([...portArr]));
}
