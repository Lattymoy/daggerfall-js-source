import fs from 'fs';
import path from 'path';
const D='${DFU}/Assets/Scripts/Game/MagicAndEffects/Effects';
const files=[];
(function walk(p){ for(const f of fs.readdirSync(p)){ const q=path.join(p,f); if(fs.statSync(q).isDirectory()) walk(q); else if(f.endsWith('.cs')) files.push(q); } })(D);
const cs={};
for (const f of files) {
  const s = fs.readFileSync(f,'utf8');
  const kt = /properties\.ClassicKey\s*=\s*MakeClassicKey\(\s*(\d+)\s*,\s*(-?\d+|255)\s*\)/.exec(s);
  if (!kt) continue;
  const skl = /properties\.MagicSkill\s*=\s*DFCareer\.MagicSkills\.(\w+)/.exec(s);
  const rec = { file: path.basename(f), skill: skl && skl[1] };
  for (const m of s.matchAll(/properties\.(DurationCosts|MagnitudeCosts|ChanceCosts)\s*=\s*MakeEffectCosts\(([^)]*)\)/g))
    rec[m[1]] = m[2].split(',').map(x=>parseFloat(x.trim()));
  for (const m of s.matchAll(/properties\.(SupportDuration|SupportChance|SupportMagnitude)\s*=\s*(true|false)/g))
    rec[m[1]] = m[2]==='true';
  cs[`${kt[1]},${kt[2]}`] = rec;
}
const MS = { Alteration:25, Restoration:23, Destruction:22, Mysticism:27, Thaumaturgy:26, Illusion:24 };
const trunc=Math.trunc;
const comp=(c,starting,increase,per)=>trunc((c[2]??0) + c[0]*starting + c[1]*trunc(increase/per));
function dfuEffectCost(e, skillOf) {
  const k = `${e.type},${e.subType & 0xff}`;
  const r = cs[k];
  if (!r) return null;   // effect DFU itself has no class for
  const skill = skillOf(MS[r.skill] ?? 22);
  let gold=0, active=false;
  if (r.SupportDuration) { active=true; gold += comp(r.DurationCosts||[0,0,0], e.durationBase, e.durationMod, e.durationPerLevel||1); }
  if (r.SupportChance)   { active=true; gold += comp(r.ChanceCosts||[0,0,0], e.chanceBase, e.chanceMod, e.chancePerLevel||1); }
  if (r.SupportMagnitude){ active=true;
    const base=trunc((e.magnitudeBaseHigh+e.magnitudeBaseLow)/2), plus=trunc((e.magnitudeLevelHigh+e.magnitudeLevelBase)/2);
    gold += comp(r.MagnitudeCosts||[0,0,0], base, plus, e.magnitudePerLevel||1); }
  if (!active) gold = comp([60,100,160],1,1,1);
  return { gold, sp: trunc(gold*(110-skill)/400), skillId: MS[r.skill] ?? 22 };
}
const TM = {0:1.0,1:1.0,2:1.5,3:2.0,4:2.5};
const { readSpellsStd } = await import('../../../src/formats/spellsStd.js');
const { calculateCastCost } = await import('../../../src/systems/spellcost.js');
const spells = readSpellsStd(new Uint8Array(fs.readFileSync((process.env.ARENA2_PATH ?? '')+'/SPELLS.STD')));
const entity = { skills: 50 };
let compared=0, diff=[], unknown=0;
for (const s of spells) {
  let gold=0, sp=0, ok=true;
  for (const e of s.effects) { if (e.type<=-1) continue;
    const c = dfuEffectCost(e, ()=>50); if (!c) { ok=false; break; } gold+=c.gold; sp+=c.sp; }
  if (!ok) { unknown++; continue; }
  const m = TM[s.rangeType] ?? 1.0;
  gold=trunc(gold*m); sp=trunc(sp*m); if (sp<5) sp=5;
  const p = calculateCastCost(s, entity);
  compared++;
  if (p.sp!==sp || p.gold!==gold) diff.push({name:s.name, dfu:{gold,sp}, port:{gold:p.gold,sp:p.sp}, keys:s.effects.filter(e=>e.type>-1).map(e=>`${e.type},${e.subType&0xff}`)});
}
console.log('SPELLS.STD records:', spells.length, 'costed against DFU effect classes:', compared, '(skipped, no DFU class:', unknown, ')');
console.log('spells whose PORT cost differs from DFU:', diff.length);
for (const d of diff) console.log(` ${d.name.padEnd(24)} dfu sp=${String(d.dfu.sp).padStart(4)} gold=${String(d.dfu.gold).padStart(5)} | port sp=${String(d.port.sp).padStart(4)} gold=${String(d.port.gold).padStart(5)} | ${d.keys.join(' ')}`);
