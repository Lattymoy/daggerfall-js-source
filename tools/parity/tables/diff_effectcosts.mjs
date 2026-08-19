import fs from 'fs';
import path from 'path';
const D='${DFU}/Assets/Scripts/Game/MagicAndEffects/Effects';
const files=[];
(function walk(p){ for(const f of fs.readdirSync(p)){ const q=path.join(p,f); if(fs.statSync(q).isDirectory()) walk(q); else if(f.endsWith('.cs')) files.push(q); } })(D);
const out={};
for (const f of files) {
  const s = fs.readFileSync(f,'utf8');
  // classicKey / SetProperties block
  const kt = /properties\.ClassicKey\s*=\s*MakeClassicKey\(\s*(\d+)\s*,\s*(-?\d+|255)\s*\)/.exec(s);
  const skl = /properties\.MagicSkill\s*=\s*DFCareer\.MagicSkills\.(\w+)/.exec(s);
  const costs = {};
  for (const m of s.matchAll(/properties\.(DurationCosts|MagnitudeCosts|ChanceCosts)\s*=\s*MakeEffectCosts\(([^)]*)\)/g)) {
    const a = m[2].split(',').map(x=>parseFloat(x.trim()));
    costs[m[1]] = a;
  }
  if (kt) out[`${kt[1]},${kt[2]}`] = { file: path.basename(f), skill: skl && skl[1], ...costs };
}
fs.writeFileSync('cs_effectcosts.json', JSON.stringify(out,null,1));
const MS = { Alteration:25, Restoration:23, Destruction:22, Mysticism:27, Thaumaturgy:26, Illusion:24 };
const { EFFECT_COST_TABLE } = await import('../../../src/systems/spellcost.js');
console.log('C# effect classes with a ClassicKey:', Object.keys(out).length);
console.log('port EFFECT_COST_TABLE rows:', Object.keys(EFFECT_COST_TABLE).length);
let n=0, bad=[];
for (const [k,p] of Object.entries(EFFECT_COST_TABLE)) {
  const c = out[k];
  if (!c) { bad.push([k,'NO C# CLASS FOUND']); continue; }
  n++; if (MS[c.skill]!==p.skill) bad.push({key:k, field:'skill', cs:c.skill+'='+MS[c.skill], port:p.skill, file:c.file});
  for (const [csName, pName] of [['DurationCosts','duration'],['MagnitudeCosts','magnitude'],['ChanceCosts','chance']]) {
    const cc = c[csName], pp = p[pName];
    if (!cc && !pp) continue;
    if (!cc || !pp) { bad.push({key:k, field:pName, cs:cc?JSON.stringify(cc):'absent', port:pp?JSON.stringify(pp):'absent', file:c.file}); continue; }
    // MakeEffectCosts(costA, costB, offsetGold = 0)
    const [A,B,off=0] = cc;
    n+=3;
    if (A!==pp.A||B!==pp.B||off!==pp.offset) bad.push({key:k, field:pName, cs:[A,B,off], port:[pp.A,pp.B,pp.offset], file:c.file});
  }
}
console.log('values compared:', n, 'mismatches:', bad.length); bad.forEach(b=>console.log(JSON.stringify(b)));
