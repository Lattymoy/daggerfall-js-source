import fs from 'fs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Game/UserInterfaceWindows/CreateCharSpecialAdvantageWindow.cs','utf8');
const body = /difficultyDict = new Dictionary<string, int> \{([\s\S]*?)\n            \};/.exec(src)[1];
const cs = {}; let order=[];
for (const m of body.matchAll(/\{\s*((?:HardStrings\.\w+\s*\+?\s*)+),\s*(-?\d+)\s*\}/g)) {
  const parts = [...m[1].matchAll(/HardStrings\.(\w+)/g)].map(x=>x[1]);
  const key = parts.join('');
  if (key in cs) throw new Error('dup '+key);
  cs[key] = parseInt(m[2],10); order.push(key);
}
console.log('C# difficultyDict entries:', order.length);
const { DIFFICULTY, LABELS } = await import('../../../src/systems/specialAdvantages.js');
console.log('port DIFFICULTY entries:', Object.keys(DIFFICULTY).length);
let n=0, bad=[];
for (const k of order) { n++; if (DIFFICULTY[k]!==cs[k]) bad.push({key:k, cs:cs[k], port:DIFFICULTY[k]}); }
for (const k of Object.keys(DIFFICULTY)) if (!(k in cs)) bad.push({key:k, cs:'ABSENT', port:DIFFICULTY[k]});
console.log('compared:', n, 'mismatches:', bad.length); bad.forEach(b=>console.log(JSON.stringify(b)));
console.log('key order identical:', JSON.stringify(order)===JSON.stringify(Object.keys(DIFFICULTY)));

// HardStrings values -> labels
const hs = fs.readFileSync(D+'/Game/UserInterfaceWindows/HardStrings.cs','utf8');
const strs = {};
for (const m of hs.matchAll(/public const string (\w+) = "([^"]*)"/g)) strs[m[1]] = m[2];
let ln=0, lbad=[];
for (const [k,v] of Object.entries(LABELS)) { if (k in strs) { ln++; if (strs[k]!==v) lbad.push({key:k, cs:strs[k], port:v}); } else lbad.push({key:k,cs:'NO HardStrings member',port:v}); }
console.log('\nLABELS compared against HardStrings:', ln, 'mismatches:', lbad.length); lbad.forEach(b=>console.log(JSON.stringify(b)));
