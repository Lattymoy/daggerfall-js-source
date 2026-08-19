import fs from 'fs';
const { readSpellsStd } = await import('../../../src/formats/spellsStd.js');
const { calculateCastCost, effectCost } = await import('../../../src/systems/spellcost.js');
const spells = readSpellsStd(new Uint8Array(fs.readFileSync((process.env.ARENA2_PATH ?? '')+'/SPELLS.STD')));
const cs = JSON.parse(fs.readFileSync('cs_effectcosts.json','utf8'));
console.log('spells read:', spells.length);
// which classic keys appear in real spells?
const keys = new Map();
for (const s of spells) for (const e of s.effects) if (e.type > -1) {
  const k = `${e.type},${e.subType & 0xff}`;
  keys.set(k, (keys.get(k)||0)+1);
}
const { EFFECT_COST_TABLE } = await import('../../../src/systems/spellcost.js');
const missing = [...keys.entries()].filter(([k])=>!(k in EFFECT_COST_TABLE));
console.log('distinct effect keys used by real SPELLS.STD:', keys.size);
console.log('keys with NO port cost row:', missing.length);
console.log(missing.map(([k,c])=>`${k}(${c}) cs=${cs[k]?cs[k].file:'-'}`).join(' '));
// Levitate spells
const lev = spells.filter(s=>s.effects.some(e=>e.type===14));
console.log('\nLevitate spells:', lev.map(s=>s.name).join(', '));
for (const s of lev) {
  const e = s.effects.find(x=>x.type===14);
  const skillOf = () => 50;
  const port = effectCost(e, skillOf);
  // DFU: Thaumaturgy skill, DurationCosts (60,100), offset 0
  const dfuGold = Math.trunc(0 + 60*e.durationBase + 100*Math.trunc(e.durationMod/Math.max(1,e.durationPerLevel)));
  const dfuSp = Math.trunc(dfuGold*(110-50)/400);
  console.log(` ${s.name}: durBase=${e.durationBase} durMod=${e.durationMod} perLevel=${e.durationPerLevel} | port gold=${port.gold} sp=${port.sp} | DFU gold=${dfuGold} sp=${dfuSp} | record cost field=${s.cost}`);
}
