import fs from 'fs';
const impl = new Set();
for (const k of ['25,255','31,255','23,0','14,255','30,255','13,0','13,1','24,0','24,1','23,1','26,255',
                 '10,8','4,0','1,0','4,2','1,2','11,8','11,9','10,9','4,1','1,1','18,255','0,255','3,0','3,1','3,2']) impl.add(k);
for (let s=0;s<=7;s++) { impl.add(`9,${s}`); impl.add(`7,${s}`); impl.add(`10,${s}`); impl.add(`11,${s}`); }
const { readSpellsStd } = await import('../../../src/formats/spellsStd.js');
const { calculateCastCost, EFFECT_COST_TABLE } = await import('../../../src/systems/spellcost.js');
const spells = readSpellsStd(new Uint8Array(fs.readFileSync((process.env.ARENA2_PATH ?? '')+'/SPELLS.STD')));
let full=0, wrong=[];
const out = JSON.parse(fs.readFileSync('cs_effectcosts.json','utf8'));
for (const s of spells) {
  const keys = s.effects.filter(e=>e.type>-1).map(e=>`${e.type},${e.subType&0xff}`);
  if (!keys.every(k=>impl.has(k))) continue;
  full++;
  if (!keys.every(k=>k in EFFECT_COST_TABLE)) wrong.push({name:s.name, keys, missing:keys.filter(k=>!(k in EFFECT_COST_TABLE))});
}
console.log('SPELLS.STD spells whose every effect the PORT IMPLEMENTS:', full);
console.log('of those, spells with at least one MISSING cost row:', wrong.length);
for (const w of wrong) console.log(' ', w.name.padEnd(22), 'missing:', w.missing.join(' '));
const missingImpl = [...impl].filter(k=>!(k in EFFECT_COST_TABLE));
console.log('\nport-IMPLEMENTED classic keys with NO cost row:', missingImpl.length, missingImpl.join(' '));
