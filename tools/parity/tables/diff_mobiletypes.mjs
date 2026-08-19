import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const en = parseEnumsFile(D+'/DaggerfallUnityEnums.cs');
const M = await import('../../../src/characters/mobileTypes.js');
console.log('port exports:', Object.keys(M));
const t = M.MOBILE_TYPES;
let n=0, bad=[];
for (const [k,v] of Object.entries(t)) { n++; if (en.MobileTypes[k]!==v) bad.push({k, cs:en.MobileTypes[k], port:v}); }
for (const k of Object.keys(en.MobileTypes)) if (!(k in t)) bad.push({k, cs:en.MobileTypes[k], port:'ABSENT'});
console.log('MobileTypes compared:', n, '(C# has', Object.keys(en.MobileTypes).length, ') mismatches:', bad.length);
bad.forEach(b=>console.log(JSON.stringify(b)));
