import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Game/Entities/DaggerfallSkills.cs','utf8');
const skills = parseEnumsFile(D+'/API/DFCareer.cs').Skills;
function switchTable(methodSig) {
  const i = src.indexOf(methodSig);
  if (i<0) throw new Error('not found '+methodSig);
  let j = src.indexOf('{', i), d=0, s=j;
  for (; j<src.length; j++){ if(src[j]==='{')d++; else if(src[j]==='}'){d--; if(d===0)break;} }
  const body = src.slice(s+1,j);
  const out = {}; let pend=[];
  for (const line of body.split('\n')) {
    let m;
    if ((m=/case DFCareer\.Skills\.(\w+)\s*:/.exec(line))) pend.push(m[1]);
    else if ((m=/return\s+(?:DFCareer\.Stats\.(\w+)|(-?\d+))\s*;/.exec(line))) {
      const v = m[1] !== undefined ? m[1] : parseInt(m[2],10);
      for (const k of pend) out[k]=v; pend=[];
    }
  }
  return out;
}
const adv = switchTable('public static int GetAdvancementMultiplier(');
const A = await import('../../../src/systems/advancement.js');
let n=0, bad=[];
for (const [name, id] of Object.entries(skills)) {
  if (name==='None'||name==='Count') continue;
  n++;
  const cs = adv[name];
  const port = A.SKILL_ADVANCEMENT_MULTIPLIER[id];
  if (cs !== port) bad.push({skill:name, id, cs, port});
}
console.log('advancement multipliers compared:', n, 'mismatches:', bad.length); bad.forEach(b=>console.log(JSON.stringify(b)));

// skill -> primary stat
const prim = switchTable('public static DFCareer.Stats GetPrimaryStat(');
console.log('\nC# GetPrimaryStat entries:', Object.keys(prim).length);
fs.writeFileSync('cs_skill_primary_stat.json', JSON.stringify(prim,null,1));
console.log(JSON.stringify(prim));
