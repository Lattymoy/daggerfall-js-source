// Extract the DFU EnemyBasics.Enemies MobileEnemy[] table into normalised JSON.
import fs from 'fs';
import { parseEnumsFile, parseEnums } from './csenum.mjs';

const D='${DFU}/Assets/Scripts';
const sound = parseEnumsFile(D+'/SoundClips.cs').SoundClips;
const uenums = parseEnumsFile(D+'/DaggerfallUnityEnums.cs');
const ienums = parseEnumsFile(D+'/Game/Items/ItemEnums.cs');
const enumTables = { ...uenums, ...ienums, SoundClips: sound };

const src = fs.readFileSync(D+'/Utility/EnemyBasics.cs','utf8');
// find the Enemies array body by brace matching
const anchor = src.indexOf('public static MobileEnemy[] Enemies = new MobileEnemy[]');
if (anchor < 0) throw new Error('anchor not found');
let i = src.indexOf('{', anchor), depth=0, start=i;
for (; i<src.length; i++){ if(src[i]==='{')depth++; else if(src[i]==='}'){depth--; if(depth===0)break;} }
const body = src.slice(start+1, i);
const bodyLineOffset = src.slice(0, start+1).split('\n').length; // line of '{'

// split into `new MobileEnemy() { ... }` blocks
const entries = [];
const re = /new MobileEnemy\(\)\s*\{/g;
let m;
while ((m = re.exec(body)) !== null) {
  let j = body.indexOf('{', m.index + m[0].length - 1), d=0, s=j;
  for (; j<body.length; j++){ if(body[j]==='{')d++; else if(body[j]==='}'){d--; if(d===0)break;} }
  const blk = body.slice(s+1, j);
  const line = bodyLineOffset - 1 + body.slice(0, m.index).split('\n').length;
  entries.push({ blk, line });
  re.lastIndex = j;
}

function splitTop(s){
  const parts=[]; let d=0, cur='', inStr=false;
  for (let k=0;k<s.length;k++){
    const c=s[k];
    if (inStr){ cur+=c; if(c==='"'&&s[k-1]!=='\\') inStr=false; continue; }
    if (c==='"'){ inStr=true; cur+=c; continue; }
    if (c==='{'||c==='('||c==='[') d++;
    if (c==='}'||c===')'||c===']') d--;
    if (c===','&&d===0){ parts.push(cur); cur=''; continue; }
    cur+=c;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function evalVal(raw){
  let v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return parseInt(v,10);
  if (/^-?\d*\.\d+f?$/.test(v)) return parseFloat(v);
  if (/^".*"$/s.test(v)) return v.slice(1,-1);
  let mm;
  if ((mm=/^CorpseTexture\(\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(v))) return { archive:+mm[1], record:+mm[2] };
  if ((mm=/^\(int\)\s*(\w+)\.(\w+)$/.exec(v))) {
    const t=enumTables[mm[1]]; if(!t||!(mm[2] in t)) throw new Error('unknown enum '+v);
    return t[mm[2]];
  }
  if ((mm=/^(\w+)\.(\w+)$/.exec(v))) {
    const t=enumTables[mm[1]];
    if (t && mm[2] in t) return { __enum: mm[1], name: mm[2], value: t[mm[2]] };
    throw new Error('unknown enum ref '+v);
  }
  if ((mm=/^new int\[\]\s*\{([\s\S]*)\}$/.exec(v))) {
    return mm[1].split(',').map(x=>x.trim()).filter(x=>x.length).map(x=>{
      if(/^-?\d+$/.test(x)) return parseInt(x,10);
      // C# integer constant expression (e.g. the "4 -1" typo at EnemyBasics.cs:1066)
      if(/^[-+*\/\s0-9()]+$/.test(x)) { const r = Function('"use strict";return ('+x+')')(); if(Number.isInteger(r)) return r; }
      throw new Error('bad int '+x);
    });
  }
  if ((mm=/^new Color\(([^)]*)\)\s*(?:\*\s*([\d.]+)f?)?$/.exec(v))) {
    const k = mm[2]===undefined?1:parseFloat(mm[2]);
    return { __color: mm[1].split(',').map(x=>parseFloat(x.trim())*k) };
  }
  throw new Error('unparsed value: '+JSON.stringify(v));
}

const out = [];
for (const {blk,line} of entries) {
  const clean = blk.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const obj = { __line: line };
  for (const part of splitTop(clean)) {
    const t = part.trim(); if(!t) continue;
    const eq = t.indexOf('=');
    const key = t.slice(0,eq).trim();
    const val = t.slice(eq+1);
    if (!/^\w+$/.test(key)) throw new Error('bad key '+JSON.stringify(t.slice(0,60)));
    if (key in obj) throw new Error('dup key '+key);
    obj[key] = evalVal(val);
  }
  out.push(obj);
}
console.error('entries parsed:', out.length);
let fieldCount=0; for(const o of out) fieldCount += Object.keys(o).length-1;
console.error('field assignments parsed:', fieldCount);
fs.writeFileSync('cs_enemies.json', JSON.stringify(out,null,1));
