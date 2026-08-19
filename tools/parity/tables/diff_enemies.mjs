import fs from 'fs';
const cs = JSON.parse(fs.readFileSync('cs_enemies.json','utf8'));
const port = JSON.parse(fs.readFileSync('port_enemies.json','utf8'));

// port field -> {cs: C# field name, kind}
const MAP = {
  maleTexture:['MaleTexture','int'], femaleTexture:['FemaleTexture','int'],
  behaviour:['Behaviour','enumName'], affinity:['Affinity','enumName'],
  corpseTexture:['CorpseTexture','corpse'],
  minMetalToHit:['MinMetalToHit','enumVal'],
  minDamage:['MinDamage','int'], maxDamage:['MaxDamage','int'],
  minDamage2:['MinDamage2','int'], maxDamage2:['MaxDamage2','int'],
  minDamage3:['MinDamage3','int'], maxDamage3:['MaxDamage3','int'],
  minHealth:['MinHealth','int'], maxHealth:['MaxHealth','int'],
  level:['Level','int'], armorValue:['ArmorValue','int'], weight:['Weight','int'],
  mapChance:['MapChance','int'],
  hasIdle:['HasIdle','bool'], hasRangedAttack1:['HasRangedAttack1','bool'],
  hasRangedAttack2:['HasRangedAttack2','bool'], hasSpellAnimation:['HasSpellAnimation','bool'],
  canOpenDoors:['CanOpenDoors','bool'], castsMagic:['CastsMagic','bool'],
  seesThroughInvisibility:['SeesThroughInvisibility','bool'],
  chanceForAttack2:['ChanceForAttack2','int'], chanceForAttack3:['ChanceForAttack3','int'],
  chanceForAttack4:['ChanceForAttack4','int'], chanceForAttack5:['ChanceForAttack5','int'],
  primaryAttackAnimFrames:['PrimaryAttackAnimFrames','arr'],
  primaryAttackAnimFrames2:['PrimaryAttackAnimFrames2','arr'],
  primaryAttackAnimFrames3:['PrimaryAttackAnimFrames3','arr'],
  primaryAttackAnimFrames4:['PrimaryAttackAnimFrames4','arr'],
  primaryAttackAnimFrames5:['PrimaryAttackAnimFrames5','arr'],
  rangedAttackAnimFrames:['RangedAttackAnimFrames','arr'],
  spellAnimFrames:['SpellAnimFrames','arr'],
  team:['Team','enumName'], lootTableKey:['LootTableKey','str'],
  moveSound:['MoveSound','int'], barkSound:['BarkSound','int'], attackSound:['AttackSound','int'],
};

function csEff(o, name, kind) {
  const v = o[name];
  if (v === undefined) {
    switch(kind){ case 'bool': return false; case 'int': return 0; case 'enumVal': return 0;
      case 'enumName': return '__DEFAULT0'; case 'arr': return null; case 'str': return null;
      case 'corpse': return null; }
  }
  switch(kind){
    case 'enumName': return v.name;
    case 'enumVal': return v.value;
    case 'corpse': return v.archive+':'+v.record;
    case 'arr': return v.join(',');
    default: return v;
  }
}
function portEff(o, kind) { return undefined; }

const byId = {}; for (const o of cs) byId[o.ID] = o;
const csIds = cs.map(o=>o.ID).sort((a,b)=>a-b);
const portIds = Object.keys(port).map(Number).sort((a,b)=>a-b);
console.log('C# ids:', csIds.length, 'port ids:', portIds.length,
  'id sets equal:', JSON.stringify(csIds)===JSON.stringify(portIds));

// enum defaults for name-typed fields
const DEF0 = { behaviour:'General', affinity:'None', team:'PlayerEnemy' };

let compared=0, mism=[];
for (const id of csIds) {
  const c = byId[id], p = port[String(id)];
  if (!p) { mism.push([id,'ENTIRE ENTRY MISSING']); continue; }
  for (const [pk,[ck,kind]] of Object.entries(MAP)) {
    let cv = csEff(c, ck, kind);
    if (cv === '__DEFAULT0') cv = DEF0[pk];
    let pv = p[pk];
    if (pv === undefined) {
      switch(kind){ case 'bool': pv=false; break; case 'int': pv=0; break; case 'enumVal': pv=0; break;
        case 'enumName': pv=DEF0[pk]; break; default: pv=null; }
    } else if (kind==='corpse') pv = pv.archive+':'+pv.record;
    else if (kind==='arr') pv = pv.join(',');
    compared++;
    if (cv !== pv) mism.push({id, field:pk, cs:cv, port:pv, csLine:c.__line});
  }
}
console.log('field values compared:', compared);
console.log('mismatches:', mism.length);
for (const x of mism) console.log(JSON.stringify(x));

// report fields present in C# but with no port counterpart
const unmapped = {};
for (const o of cs) for (const k of Object.keys(o)) {
  if (k==='__line'||k==='ID') continue;
  if (!Object.values(MAP).some(([ck])=>ck===k)) (unmapped[k]=unmapped[k]||[]).push(o.ID);
}
console.log('\nC# fields with NO port counterpart:');
for (const [k,v] of Object.entries(unmapped)) console.log(' ', k, '-> ids', v.join(','));
