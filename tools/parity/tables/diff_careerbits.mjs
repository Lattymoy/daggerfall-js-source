import { parseEnumsFile } from './csenum.mjs';
const D='${DFU}/Assets/Scripts';
const e = parseEnumsFile(D+'/API/DFCareer.cs');
const S = await import('../../../src/systems/specialAdvantages.js');
const cap = (s)=>s.charAt(0).toUpperCase()+s.slice(1);
const cases = [
  ['EFFECT_BITS', S.EFFECT_BITS, e.EffectFlags, (k)=>cap(k.replace(/^to/,''))],
  ['PROFICIENCY_BITS', S.PROFICIENCY_BITS, e.ProficiencyFlags, (k)=>({shortBlade:'ShortBlades',longBlade:'LongBlades',handToHand:'HandToHand',axe:'Axes',bluntWeapon:'BluntWeapons',missileWeapon:'MissileWeapons'})[k]],
  ['ARMOR_BITS', S.ARMOR_BITS, e.ArmorFlags, cap],
  ['SHIELD_BITS', S.SHIELD_BITS, e.ShieldFlags, (k)=>({buckler:'Buckler',roundShield:'RoundShield',kiteShield:'KiteShield',towerShield:'TowerShield'})[k]],
  ['MATERIAL_BITS', S.MATERIAL_BITS, e.MaterialFlags, cap],
  ['SPECIAL_ABILITY_BITS', S.SPECIAL_ABILITY_BITS, e.SpecialAbilityFlags, cap],
  ['ABSORPTION_FLAGS', S.ABSORPTION_FLAGS, e.SpellAbsorptionFlags, (k)=>({general:'Always',inDarkness:'InDarkness',inLight:'InLight'})[k]],
  ['REGENERATION_FLAGS', S.REGENERATION_FLAGS, e.RegenerationFlags, (k)=>({general:'Always',inDarkness:'InDarkness',inLight:'InLight',whileImmersed:'InWater'})[k]],
  ['RAPID_HEALING_FLAGS', S.RAPID_HEALING_FLAGS, e.RapidHealingFlags, (k)=>({general:'Always',inDarkness:'InDarkness',inLight:'InLight'})[k]],
];
let n=0, bad=[];
for (const [name, port, csEnum, mapKey] of cases) {
  if (!port) { bad.push([name,'MISSING EXPORT']); continue; }
  for (const [k,v] of Object.entries(port)) {
    const cn = mapKey(k); n++;
    if (csEnum[cn]!==v) bad.push({table:name, key:k, csName:cn, cs:csEnum[cn], port:v});
  }
}
console.log('career bit values compared:', n, 'mismatches:', bad.length); bad.forEach(b=>console.log(JSON.stringify(b)));
// SpellPointMultipliers
console.log('\nC# SpellPointMultipliers:', JSON.stringify(e.SpellPointMultipliers));
