import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Game/Entities/RaceTemplate.cs','utf8');
const races = parseEnumsFile(D+'/Game/Entities/EntityEnums.cs').Races;
const cs = {};
for (const m of src.matchAll(/public class (\w+) : RaceTemplate\s*\{\s*public \1\(\)\s*\{([\s\S]*?)\n        \}/g)) {
  const o = {};
  for (const kv of m[2].matchAll(/(\w+)\s*=\s*([^;]+);/g)) {
    let v = kv[2].trim();
    if (/^"(.*)"$/.test(v)) v = v.slice(1,-1);
    else if (/^\d+$/.test(v)) v = +v;
    o[kv[1]] = v;
  }
  cs[m[1]] = o;
}
const R = await import('../../../src/systems/races.js');
console.log('C# race classes:', Object.keys(cs).join(', '));
const FIELDS = [
  ['ID','id',(v)=>races[v.replace('(int)Races.','')] ?? v],
  ['DescriptionID','descriptionId',v=>v],
  ['ClipID','clipId',v=>v],
  ['PaperDollBackground','background',v=>v],
  ['PaperDollBodyMaleUnclothed', (r)=>r.bodyMale[0], v=>v],
  ['PaperDollBodyMaleClothed', (r)=>r.bodyMale[1], v=>v],
  ['PaperDollBodyFemaleUnclothed', (r)=>r.bodyFemale[0], v=>v],
  ['PaperDollBodyFemaleClothed', (r)=>r.bodyFemale[1], v=>v],
  ['PaperDollHeadsMale','headsMale',v=>v],
  ['PaperDollHeadsFemale','headsFemale',v=>v],
];
let n=0, bad=[];
for (const [name, o] of Object.entries(cs)) {
  const p = R.raceByKey(name);
  if (!p) { bad.push([name,'MISSING IN PORT']); continue; }
  for (const [ck, pk, conv] of FIELDS) {
    n++;
    const cv = conv(o[ck]);
    const pv = typeof pk === 'function' ? pk(p) : p[pk];
    if (cv !== pv) bad.push({race:name, field:ck, cs:cv, port:pv});
  }
}
console.log('race field values compared:', n, 'mismatches:', bad.length);
bad.forEach(b=>console.log(JSON.stringify(b)));
// flag columns present in C# but absent from the port table
const flagFields = ['ResistanceFlags','ImmunityFlags','LowToleranceFlags','CriticalWeaknessFlags','SpecialAbilities'];
const present = {};
for (const [name,o] of Object.entries(cs)) for (const f of flagFields) if (o[f]!==undefined) (present[f]=present[f]||[]).push(name+'='+o[f]);
console.log('\nC# race flag columns set (and absent from the port table):', JSON.stringify(present));
console.log('port race keys:', Object.keys(R.raceByKey('Breton')).join(','));
