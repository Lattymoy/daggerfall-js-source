import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Game/MagicAndEffects/Effects/Poisons/PoisonEffect.cs','utf8');
const e = parseEnumsFile(D+'/Game/Items/ItemEnums.cs');
const P = await import('../../../src/systems/poisons.js');
let n=0, bad=[];
for (const [k,v] of Object.entries(P.POISONS)) { n++; if (e.Poisons[k]!==v) bad.push({k, cs:e.Poisons[k], port:v}); }
for (const k of Object.keys(e.Poisons)) if (!(k in P.POISONS)) bad.push({k, cs:e.Poisons[k], port:'ABSENT'});
console.log('Poisons enum compared:', n, 'mismatches:', bad.length, JSON.stringify(bad));
let tn=0, tbad=[];
for (const [name, portArr] of [['MinMinutesToPoison',P.MIN_MINUTES_TO_POISON],['MaxMinutesToPoison',P.MAX_MINUTES_TO_POISON],
                               ['MinRoundsOfPoison',P.MIN_ROUNDS_OF_POISON],['MaxRoundsOfPoison',P.MAX_ROUNDS_OF_POISON]]) {
  const m = new RegExp('ushort\\[\\] '+name+' =\\s*\\{([^}]*)\\}').exec(src);
  const cs = m[1].split(',').map(x=>parseInt(x.trim(),10));
  for (let i=0;i<cs.length;i++){ tn++; if (cs[i]!==portArr[i]) tbad.push({table:name,i,cs:cs[i],port:portArr[i]}); }
  if (cs.length!==portArr.length) tbad.push([name,'length',cs.length,portArr.length]);
}
console.log('poison timing values compared:', tn, 'mismatches:', tbad.length, JSON.stringify(tbad));

// Per-variant IncrementPoisonEffects switch: extract each case's calls
const i = src.indexOf('protected virtual void IncrementPoisonEffects()');
let j = src.indexOf('{', i), d=0, s=j;
for(;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){d--; if(d===0)break;} }
const body = src.slice(s+1,j);
const cases = {}; let cur=null;
for (const line of body.split('\n')) {
  let m;
  if ((m=/case Poisons\.(\w+)\s*:/.exec(line))) { cur=m[1]; cases[cur]=[]; continue; }
  if (!cur) continue;
  if (/^\s*break;/.test(line)) { cur=null; continue; }
  const t = line.trim(); if (t) cases[cur].push(t);
}
console.log('\n--- C# per-variant poison effects ---');
for (const [k,v] of Object.entries(cases)) console.log(' ', k, '::', v.join(' | '));
console.log('\nIsDrugType cs:', [...src.matchAll(/case Poisons\.(\w+):\s*\n\s*case Poisons\.(\w+):/g)].length);
const dt = /protected virtual bool IsDrugType\(\)[\s\S]*?return true;/.exec(src)[0];
console.log('drug types cs:', [...dt.matchAll(/case Poisons\.(\w+)/g)].map(x=>x[1]).join(','));
console.log('port isDrugType over all 12:', Object.entries(P.POISONS).filter(([k,v])=>v>=0&&P.isDrugType(v)).map(([k])=>k).join(','));
