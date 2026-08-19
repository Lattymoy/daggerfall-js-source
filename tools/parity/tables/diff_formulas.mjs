import fs from 'fs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Game/Formulas/FormulaHelper.cs','utf8');
const F = await import('../../../src/combat/formulas.js');

function switchTable(methodName, enumPrefix) {
  // grab the method body, parse `case Weapons.X:` groups -> return N
  const i = src.indexOf('public static int '+methodName+'(');
  if (i<0) throw new Error('method not found '+methodName);
  let j = src.indexOf('{', i), d=0, s=j;
  for (; j<src.length; j++){ if(src[j]==='{')d++; else if(src[j]==='}'){d--; if(d===0)break;} }
  const body = src.slice(s+1, j);
  const out = {}; let pend=[];
  for (const line of body.split('\n')) {
    let m;
    if ((m=new RegExp('case '+enumPrefix+'\\.(\\w+)\\s*:').exec(line))) pend.push(m[1]);
    else if ((m=/return\s+(-?\d+)\s*;/.exec(line))) { const v=parseInt(m[1],10); for(const k of pend) out[k]=v; pend=[]; }
  }
  return out;
}
const nameOf = (k)=>k.replace(/_/g,' ').replace('Dai Katana','Dai-Katana');
let n=0, bad=[];
for (const [meth, portTable] of [['CalculateWeaponMinDamage',F.WEAPON_MIN_DAMAGE], ['CalculateWeaponMaxDamage',F.WEAPON_MAX_DAMAGE]]) {
  const cs = switchTable(meth, 'Weapons');
  const csn = {}; for (const [k,v] of Object.entries(cs)) csn[nameOf(k)] = v;
  const ck = Object.keys(csn).sort(), pk = Object.keys(portTable).sort();
  if (JSON.stringify(ck)!==JSON.stringify(pk)) bad.push([meth,'KEYSET', ck.filter(x=>!pk.includes(x)), pk.filter(x=>!ck.includes(x))]);
  for (const k of ck) { n++; if (csn[k]!==portTable[k]) bad.push({meth,weapon:k,cs:csn[k],port:portTable[k]}); }
}
console.log('weapon damage values compared:', n, 'mismatches:', bad.length); bad.forEach(b=>console.log(JSON.stringify(b)));

// bodyParts
const bp = /int\[\] bodyParts = \{([^}]*)\}/.exec(src)[1].split(',').map(s=>parseInt(s.trim(),10));
const pbp = [];
// probe port BODY_PARTS through calculateStruckBodyPart
for (let i=0;i<20;i++) pbp.push(F.calculateStruckBodyPart((i+0.5)/20));
console.log('\nbodyParts cs', JSON.stringify(bp));
console.log('bodyParts port(probed)', JSON.stringify(pbp), 'equal', JSON.stringify(bp)===JSON.stringify(pbp), 'len', bp.length);

// weapon material modifier
const wm = fs.readFileSync(D+'/Game/Items/DaggerfallUnityItem.cs','utf8');
const gi = wm.indexOf('GetWeaponMaterialModifier');
console.log('\nGetWeaponMaterialModifier body:\n', wm.slice(wm.indexOf('{', gi), wm.indexOf('}\n', wm.indexOf('{', gi))+1).slice(0,900));
