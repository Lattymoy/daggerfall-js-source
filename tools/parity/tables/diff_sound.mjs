import fs from 'fs';
const sc = JSON.parse(fs.readFileSync('soundclips.json','utf8'));
const src = fs.readFileSync('../../../src/systems/soundClips.js','utf8');
const body = /export const SOUND = \{([\s\S]*?)\n\};/.exec(src)[1];
let n=0, bad=[];
for (const line of body.split('\n')) {
  const m = /^\s*(\w+):\s*(-?\d+)\s*,/.exec(line);
  if (!m) continue;
  n++;
  const name = m[1], val = parseInt(m[2],10);
  if (!(name in sc)) bad.push([name, val, 'NOT-IN-DFU-ENUM']);
  else if (sc[name] !== val) bad.push([name, val, sc[name]]);
}
console.log('SOUND entries compared:', n, 'mismatches:', bad.length);
console.log(bad);
