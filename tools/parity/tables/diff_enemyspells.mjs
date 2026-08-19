import fs from 'fs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Game/Entities/EnemyEntity.cs','utf8');
const lists = {};
for (const m of src.matchAll(/static byte\[\] (\w+)\s*=\s*\{([^}]*)\}/g))
  lists[m[1]] = m[2].split(',').map(x=>parseInt(x.trim(),16));
const cls = /static byte\[\]\[\] EnemyClassSpells\s*=\s*\{([^}]*)\}/.exec(src)[1].split(',').map(x=>x.trim());
const E = await import('../../../src/systems/enemySpells.js');
// monster assignment chain
const chain = {};
for (const m of src.matchAll(/careerIndex == \(int\)MonsterCareers\.(\w+)\)\s*\n\s*SetEnemySpells\((\w+)\)/g)) chain[m[1]] = m[2];
console.log('C# spell lists:', Object.keys(lists).length, 'EnemyClassSpells len:', cls.length);
let n=0, bad=[];
// class ladder
for (let i=0;i<cls.length;i++){
  const c = lists[cls[i]], p = E.ENEMY_CLASS_SPELLS[i];
  if (!p) { bad.push([i,'MISSING']); continue; }
  if (JSON.stringify(c)!==JSON.stringify([...p])) bad.push({rung:i, name:cls[i], cs:c, port:[...p]});
  n += c.length;
}
console.log('ENEMY_CLASS_SPELLS values compared:', n, 'mismatches:', bad.length, JSON.stringify(bad));
// monster lists
const { parseEnumsFile } = await import('./csenum.mjs');
let mc=null; for (const f of ['/API/DFCareer.cs','/DaggerfallUnityEnums.cs','/Game/Entities/EnemyEntity.cs','/Game/Entities/DaggerfallEntity.cs','/API/DFRegion.cs']) { try { const t=parseEnumsFile(D+f); if (t.MonsterCareers) { mc=t.MonsterCareers; break; } } catch(e){} }
if (!mc) { const fs2=await import('fs'); const path=await import('path'); const walk=(p,acc=[])=>{for(const f of fs2.readdirSync(p)){const q=path.join(p,f); if(fs2.statSync(q).isDirectory())walk(q,acc); else if(f.endsWith('.cs'))acc.push(q);} return acc;};
  for (const f of walk(D)) { const t=parseEnumsFile(f); if (t.MonsterCareers) { mc=t.MonsterCareers; console.log('MonsterCareers found in', f); break; } } }
console.log('MonsterCareers enum found:', !!mc);
let mn=0, mbad=[];
for (const [career, listName] of Object.entries(chain)) {
  const id = mc[career];
  const p = E.MONSTER_SPELL_LISTS[id];
  const c = lists[listName];
  if (!p) { mbad.push([career, id, listName, 'MISSING IN PORT']); continue; }
  if (JSON.stringify(c)!==JSON.stringify([...p])) mbad.push({career, id, cs:c, port:[...p]});
  mn += c.length;
}
console.log('monster spell chain entries:', Object.keys(chain).length, 'values:', mn, 'mismatches:', mbad.length, JSON.stringify(mbad));
console.log('C# chain:', JSON.stringify(chain));
console.log('port list keys:', Object.keys(E.MONSTER_SPELL_LISTS).join(','));
