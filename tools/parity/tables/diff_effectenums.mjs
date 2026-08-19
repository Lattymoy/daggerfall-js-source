import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const e = parseEnumsFile(D+'/API/DFCareer.cs');
const me = parseEnumsFile(D+'/Game/MagicAndEffects/MagicAndEffectsEnums.cs');
const SC = await import('../../../src/systems/spellcast.js');
let n=0, bad=[];
for (const [k,v] of Object.entries(SC.EFFECT_FLAGS)) { n++; if (e.EffectFlags[k]!==v) bad.push({k, cs:e.EffectFlags[k], port:v}); }
console.log('EFFECT_FLAGS compared:', n, 'mismatches:', bad.length, JSON.stringify(bad));
// TARGET_TYPES order
const tt = me.TargetTypes;
console.log('C# TargetTypes:', JSON.stringify(tt));
console.log('port TARGET_TYPES:', JSON.stringify([...SC.TARGET_TYPES]));
const ok = Object.entries(tt).every(([k,v]) => SC.TARGET_TYPES[v]===k);
console.log('TargetTypes order match:', ok, '(', Object.keys(tt).length, 'values )');
// TARGET_COST_MULT
const { TARGET_COST_MULT } = await import('../../../src/systems/spellcost.js');
console.log('TARGET_COST_MULT:', JSON.stringify(TARGET_COST_MULT), '(cs: CasterOnly/ByTouch 1.0, SingleTargetAtRange 1.5, AreaAroundCaster 2.0, AreaAtRange 2.5)');
// ElementTypes / missileArchive
console.log('C# ElementTypes:', JSON.stringify(me.ElementTypes));
console.log('port missileArchive(0..4):', [0,1,2,3,4].map(SC.missileArchive));
