import fs from 'fs';
const D='${DFU}/Assets/Scripts';
const src = fs.readFileSync(D+'/Utility/EnemyBasics.cs','utf8');
const speeds = {};
for (const m of src.matchAll(/public static int (\w+) = (\d+);/g)) speeds[m[1]] = +m[2];
const cs = {};
for (const m of src.matchAll(/public static MobileAnimation\[\] (\w+) = new MobileAnimation\[\]\s*\{([\s\S]*?)\n        \};/g)) {
  const name = m[1];
  const rows = [];
  for (const r of m[2].matchAll(/new MobileAnimation\(\)\s*\{([^}]*)\}/g)) {
    const f = {};
    for (const kv of r[1].split(',')) {
      const mm = /^\s*(\w+)\s*=\s*(.+?)\s*$/.exec(kv); if(!mm) continue;
      let v = mm[2];
      if (v==='true') v=true; else if(v==='false') v=false;
      else if (/^\d+$/.test(v)) v=+v;
      else if (v in speeds) v=speeds[v];
      else throw new Error('bad anim val '+v);
      f[mm[1]] = v;
    }
    rows.push({record:f.Record, fps:f.FramePerSecond, flip:f.FlipLeftRight, bounce:f.BounceAnim ?? false});
  }
  cs[name] = rows;
}
const port = await import('../../../src/characters/mobileUnit.js');
const MAP = {
  MoveAnims:'MOVE_ANIMS', PrimaryAttackAnims:'PRIMARY_ATTACK_ANIMS', HurtAnims:'HURT_ANIMS',
  IdleAnims:'IDLE_ANIMS', RangedAttack1Anims:'RANGED_ATTACK1_ANIMS',
  FemaleThiefIdleAnims:'FEMALE_THIEF_IDLE_ANIMS', RatIdleAnims:'RAT_IDLE_ANIMS',
  GhostWraithMoveAnims:'GHOST_WRAITH_MOVE_ANIMS', GhostWraithAttackAnims:'GHOST_WRAITH_ATTACK_ANIMS',
  SlaughterfishMoveAnims:'SLAUGHTERFISH_MOVE_ANIMS',
};
console.log('C# anim tables found:', Object.keys(cs).join(', '));
let rows=0, vals=0, bad=[];
for (const [ck,pk] of Object.entries(MAP)) {
  const c = cs[ck], p = port[pk];
  if (!c) { bad.push([ck,'MISSING IN C# PARSE']); continue; }
  if (!p) { bad.push([pk,'MISSING IN PORT']); continue; }
  if (c.length !== p.length) bad.push([ck,'length', c.length, p.length]);
  for (let i=0;i<Math.min(c.length,p.length);i++){
    rows++;
    for (const f of ['record','fps','flip','bounce']) {
      vals++;
      const pv = f==='bounce' ? (p[i].bounce ?? false) : p[i][f];
      if (c[i][f] !== pv) bad.push({table:ck, idx:i, field:f, cs:c[i][f], port:pv});
    }
  }
}
console.log('anim rows compared:', rows, 'values:', vals, 'mismatches:', bad.length);
bad.forEach(b=>console.log(JSON.stringify(b)));
// speeds
console.log('speeds C#:', JSON.stringify(speeds));
const ps = {MoveAnimSpeed:port.MOVE_ANIM_SPEED, FlyAnimSpeed:port.FLY_ANIM_SPEED, PrimaryAttackAnimSpeed:port.PRIMARY_ATTACK_ANIM_SPEED, HurtAnimSpeed:port.HURT_ANIM_SPEED, IdleAnimSpeed:port.IDLE_ANIM_SPEED, RangedAttack1AnimSpeed:port.RANGED_ATTACK1_ANIM_SPEED};
for (const [k,v] of Object.entries(ps)) if (speeds[k]!==v) console.log('SPEED MISMATCH', k, speeds[k], v);
console.log('speeds compared:', Object.keys(ps).length);
