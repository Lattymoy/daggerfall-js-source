import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const e = parseEnumsFile(D+'/API/DFCareer.cs');
console.log('DFCareer enums:', Object.keys(e).join(', '));
const { SKILLS, SKILL_COUNT, MAGIC_SKILLS } = await import('../../../src/systems/skills.js');
let n=0, bad=[];
for (const [k,v] of Object.entries(SKILLS)) { n++; if (e.Skills[k]!==v) bad.push([k,e.Skills[k],v]); }
console.log('SKILLS compared:', n, 'mismatches:', bad.length, JSON.stringify(bad));
console.log('SKILL_COUNT', SKILL_COUNT, 'C# Skills.Count', e.Skills.Count);
const magic = Object.entries(e.MagicSkills).filter(([k])=>k!=='None').map(([,v])=>v);
console.log('MagicSkills cs', JSON.stringify(magic), 'port', JSON.stringify([...MAGIC_SKILLS]), 'equal', JSON.stringify(magic)===JSON.stringify([...MAGIC_SKILLS]));
// Stats
const sm = await import('../../../src/systems/statMods.js');
console.log('statMods exports:', Object.keys(sm).join(', '));
