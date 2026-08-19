import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Utility/ImageProcessing.cs','utf8');
const i = src.indexOf('public static byte[] GetMetalColorTable(');
let j = src.indexOf('{', i), d=0, s=j;
for(;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){d--; if(d===0)break;} }
const body = src.slice(s+1,j);
const cs = {}; let cur=null;
for (const line of body.split('\n')) {
  let m;
  if ((m=/case MetalTypes\.(\w+)\s*:/.exec(line))) cur=m[1];
  else if (/default\s*:/.test(line)) cur='None';
  else if ((m=/indices = new byte\[\] \{([^}]*)\}/.exec(line))) { cs[cur]=m[1].split(',').map(x=>parseInt(x.trim(),16)); cur=null; }
}
const dy = await import('../../../src/characters/dyes.js');
const en = parseEnumsFile(D+'/DaggerfallUnityEnums.cs');
let n=0, bad=[];
for (const [k,v] of Object.entries(cs)) {
  const p = dy.METAL_TABLES[k];
  if (!p) { bad.push([k,'MISSING IN PORT']); continue; }
  if (p.length!==v.length) bad.push([k,'length',v.length,p.length]);
  for (let x=0;x<v.length;x++){ n++; if (v[x]!==p[x]) bad.push({metal:k, i:x, cs:v[x], port:p[x]}); }
}
console.log('metal color table values compared:', n, '(tables:', Object.keys(cs).length, 'port:', Object.keys(dy.METAL_TABLES).length, ') mismatches:', bad.length);
bad.forEach(b=>console.log(JSON.stringify(b)));
// DyeColors enum
let dn=0, dbad=[];
for (const [k,v] of Object.entries(dy.DYE_COLORS)) { dn++; if (en.DyeColors[k]!==v) dbad.push({k, cs:en.DyeColors[k], port:v}); }
for (const k of Object.keys(en.DyeColors)) if (!(k in dy.DYE_COLORS)) dbad.push({k,cs:en.DyeColors[k],port:'ABSENT'});
console.log('DyeColors compared:', dn, 'mismatches:', dbad.length, JSON.stringify(dbad));
// clothing start ranges: ChangeDye's switch
const ci = src.indexOf('public static DyeColors');
const cd = /GetDyeColorTable\(DyeColors dye, DyeTargets target\)/.test(src);
const startBlock = src.slice(src.indexOf('DyeTargets.Clothing'), src.indexOf('DyeTargets.Clothing')+3000);
console.log('\n--- clothing branch (first 2200 chars) ---');
console.log(startBlock.slice(0,2200));
