import fs from 'fs';
import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const sc = parseEnumsFile(D+'/SoundClips.cs').SoundClips;
// independent line-based extraction
const lines = fs.readFileSync(D+'/SoundClips.cs','utf8').split('\n');
const alt = {}; let bad=0;
for (const l of lines) {
  const m = /^\s*([A-Za-z_]\w*)\s*=\s*(-?\d+)\s*,?\s*(\/\/.*)?$/.exec(l);
  if (m) alt[m[1]] = parseInt(m[2],10);
}
let n=0, diff=[];
for (const [k,v] of Object.entries(alt)) { n++; if (sc[k]!==v) diff.push([k,v,sc[k]]); }
console.log('line-extracted members:', n, 'parser members:', Object.keys(sc).length);
console.log('mismatches:', diff.length, diff.slice(0,10));
console.log('parser-only:', Object.keys(sc).filter(k=>!(k in alt)));
fs.writeFileSync('soundclips.json', JSON.stringify(sc,null,1));
