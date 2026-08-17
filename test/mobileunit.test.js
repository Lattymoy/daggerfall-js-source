// C11: classic sprite mobiles - the DFU MobileUnit/EnemyBasics laws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOVE_ANIMS, PRIMARY_ATTACK_ANIMS, HURT_ANIMS, IDLE_ANIMS, RAT_IDLE_ANIMS,
  GHOST_WRAITH_MOVE_ANIMS, SLAUGHTERFISH_MOVE_ANIMS, stateAnims,
  mobileOrientation, rollAttackFrames, MobileUnit,
  MOBILE_RAT, MOBILE_GHOST, MOBILE_WRAITH, MOBILE_SLAUGHTERFISH, MOBILE_GIANT_SCORPION,
  MOVE_ANIM_SPEED, FLY_ANIM_SPEED, PRIMARY_ATTACK_ANIM_SPEED, HURT_ANIM_SPEED, IDLE_ANIM_SPEED,
} from '../src/characters/mobileUnit.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

test('mobile: the record layout tables verbatim (EnemyBasics)', () => {
  assert.deepEqual(MOVE_ANIMS.map((a) => a.record), [0, 1, 2, 3, 4, 3, 2, 1]);
  assert.deepEqual(MOVE_ANIMS.map((a) => a.flip), [false, false, false, false, false, true, true, true]);
  assert.deepEqual(PRIMARY_ATTACK_ANIMS.map((a) => a.record), [5, 6, 7, 8, 9, 8, 7, 6]);
  assert.deepEqual(HURT_ANIMS.map((a) => a.record), [10, 11, 12, 13, 14, 13, 12, 11]);
  assert.deepEqual(IDLE_ANIMS.map((a) => a.record), [15, 16, 17, 18, 19, 18, 17, 16]);
  // The rat idle flip INVERSION and the ghost/wraith pattern, verbatim quirks
  assert.deepEqual(RAT_IDLE_ANIMS.map((a) => a.flip), [false, true, true, true, false, false, false, false]);
  assert.deepEqual(GHOST_WRAITH_MOVE_ANIMS.map((a) => a.flip), [false, false, true, false, false, true, false, true]);
  assert.ok(SLAUGHTERFISH_MOVE_ANIMS.every((a) => a.bounce));
  assert.equal(MOVE_ANIM_SPEED, 6); assert.equal(PRIMARY_ATTACK_ANIM_SPEED, 10);
  assert.equal(HURT_ANIM_SPEED, 4); assert.equal(IDLE_ANIM_SPEED, 4);
  // GetStateAnims branch order: ghost/wraith idle = their move set;
  // rat idle = the inverted set; hasIdle=false idles on MOVE.
  assert.equal(stateAnims('idle', MOBILE_GHOST, true), GHOST_WRAITH_MOVE_ANIMS);
  assert.equal(stateAnims('idle', MOBILE_WRAITH, true), GHOST_WRAITH_MOVE_ANIMS);
  assert.equal(stateAnims('idle', MOBILE_RAT, true), RAT_IDLE_ANIMS);
  assert.equal(stateAnims('idle', MOBILE_SLAUGHTERFISH, false), SLAUGHTERFISH_MOVE_ANIMS);
  assert.equal(stateAnims('idle', 4, false), MOVE_ANIMS);
  assert.equal(stateAnims('idle', 4, true), IDLE_ANIMS);
});

test('mobile: the orientation law - signed angle, -round(angle/45) wrapped', () => {
  // Enemy facing +z; the camera dead ahead = orientation 0 (front),
  // behind = 4 (back), the flanks mirror through the same records.
  assert.equal(mobileOrientation(0, [0, 0, 0], [0, 0, 5]), 0);
  assert.equal(mobileOrientation(0, [0, 0, 0], [0, 0, -5]), 4);
  const east = mobileOrientation(0, [0, 0, 0], [5, 0, 0]);
  const west = mobileOrientation(0, [0, 0, 0], [-5, 0, 0]);
  assert.equal((east + west) % 8, 0);   // symmetric flanks (2 and 6)
  assert.equal(Math.abs(east - west), 4);
  // Yaw rotates the frame with the enemy: facing the camera again = 0.
  assert.equal(mobileOrientation(Math.PI / 2, [0, 0, 0], [5, 0, 0]), 0);
});

test('mobile: attack frames - the chance ladder, the -1 damage marker, the one-shot revert', () => {
  const basics = {
    hasIdle: true,
    primaryAttackAnimFrames: [0, 1, -1, 2],
    primaryAttackAnimFrames2: [9, 9],
    primaryAttackAnimFrames3: [7, 7],
    chanceForAttack2: 20, chanceForAttack3: 30,
  };
  // Dice100 ladder, verbatim ApplyEnemyState: roll <= 20 -> frames2;
  // then the remainder walks to chance3; else the base frames.
  assert.deepEqual(rollAttackFrames(basics, 15), [9, 9]);
  assert.deepEqual(rollAttackFrames(basics, 45), [7, 7]);     // 45-20=25 <= 30
  assert.deepEqual(rollAttackFrames(basics, 95), [0, 1, -1, 2]);
  // The unit: strike -> the sequence steps, -1 flags hitFrame and
  // skips, the iterator's end reverts to idle.
  const m = new MobileUnit(4, basics, () => 8, () => 0.99);   // roll 100 -> base frames
  m.update(1 / 60, { striking: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(m.state, 'attack');
  assert.equal(m.frame, 0);
  const seen = [];
  let hits = 0;
  for (let i = 0; i < 6 && m.state === 'attack'; i++) {
    m.update(1 / PRIMARY_ATTACK_ANIM_SPEED, {}, 0, [0, 0, 0], [0, 0, 5]);
    if (m.state === 'attack') seen.push(m.frame);
    if (m.hitFrame) hits++;
  }
  assert.equal(hits, 1);
  assert.deepEqual(seen, [1, 2]);   // -1 skipped straight to 2
  assert.equal(m.state, 'idle');
});

test('mobile: state transitions - hasIdle frame carry, the hurt one-shot, bounce', () => {
  // hasIdle=false: idle<->move keeps the frame (their idle IS the move loop)
  const noIdle = new MobileUnit(4, { hasIdle: false, primaryAttackAnimFrames: [0] }, () => 6, () => 0.5);
  noIdle.update(1 / MOVE_ANIM_SPEED, { moving: true }, 0, [0, 0, 0], [0, 0, 5]);
  noIdle.update(1 / MOVE_ANIM_SPEED, { moving: true }, 0, [0, 0, 0], [0, 0, 5]);
  const f = noIdle.frame;
  assert.ok(f > 0);
  noIdle.update(0, { moving: false }, 0, [0, 0, 0], [0, 0, 5]);   // -> idle, frame kept
  assert.equal(noIdle.frame, f);
  // hasIdle=true resets on the same switch
  const hasIdle = new MobileUnit(4, { hasIdle: true, primaryAttackAnimFrames: [0] }, () => 6, () => 0.5);
  hasIdle.update(1 / MOVE_ANIM_SPEED, { moving: true }, 0, [0, 0, 0], [0, 0, 5]);
  hasIdle.update(1 / MOVE_ANIM_SPEED, { moving: true }, 0, [0, 0, 0], [0, 0, 5]);
  hasIdle.update(0, { moving: false }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(hasIdle.frame, 0);
  // Hurt: a one-shot that runs its frames then reverts to idle
  const h = new MobileUnit(4, { hasIdle: true, primaryAttackAnimFrames: [0] }, () => 3, () => 0.5);
  h.update(1 / 60, { hurting: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(h.state, 'hurt');
  for (let i = 0; i < 5; i++) h.update(1 / HURT_ANIM_SPEED, {}, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(h.state, 'idle');
  // Bounce (slaughterfish): the loop reverses at n-2 instead of wrapping
  const s = new MobileUnit(MOBILE_SLAUGHTERFISH, { hasIdle: false, primaryAttackAnimFrames: [0] }, () => 4, () => 0.5);
  const frames = [];
  for (let i = 0; i < 8; i++) { s.update(1 / MOVE_ANIM_SPEED, { moving: true }, 0, [0, 0, 0], [0, 0, 5]); frames.push(s.frame); }
  assert.deepEqual(frames, [1, 2, 3, 2, 1, 0, 1, 2]);   // up then bounced back down
});

test('mobile: the leading -1 marker + the attack/hurt priority (audit 08-17)', () => {
  // ApplyEnemyState's up-front check: the Frost Daedra's 50% variant
  // [-1,4,5,0] STARTS with the hit frame - damage flags immediately
  // and the displayed frame advances to the second entry.
  const fd = {
    hasIdle: true,
    primaryAttackAnimFrames: [0, 1, -1, 2, 3, -1, 4, 5, 0],
    primaryAttackAnimFrames2: [-1, 4, 5, 0],
    chanceForAttack2: 50,
  };
  const m = new MobileUnit(25, fd, () => 8, () => 0.3);   // roll 31 <= 50 -> frames2
  m.update(1 / 60, { striking: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(m.state, 'attack');
  assert.equal(m.hitFrame, true);    // the leading -1 lands NOW
  assert.equal(m.frame, 4);          // displayed = the second entry
  let hits = 1;
  for (let i = 0; i < 5 && m.state === 'attack'; i++) {
    m.update(1 / PRIMARY_ATTACK_ANIM_SPEED, {}, 0, [0, 0, 0], [0, 0, 5]);
    if (m.hitFrame) hits++;
  }
  assert.equal(hits, 1);             // one damage moment per swing
  assert.equal(m.state, 'idle');
  // C16: the BASE sequence [0,1,-1,2,3,-1,4,5,0] strikes TWICE per
  // swing - each -1 is a damage moment (doMeleeDamage, verbatim).
  const m2 = new MobileUnit(25, fd, () => 8, () => 0.99);   // roll 100 -> base frames
  m2.update(1 / 60, { striking: true }, 0, [0, 0, 0], [0, 0, 5]);
  let hits2 = m2.hitFrame ? 1 : 0;
  for (let i = 0; i < 12 && m2.state === 'attack'; i++) {
    m2.update(1 / PRIMARY_ATTACK_ANIM_SPEED, {}, 0, [0, 0, 0], [0, 0, 5]);
    if (m2.hitFrame) hits2++;
  }
  assert.equal(hits2, 2, 'the Frost Daedra base swing lands two damage moments');
  // The DFU priority: the attack edge overrides hurt (ChangeEnemyState
  // at MeleeAnimation is unconditional)...
  const p = new MobileUnit(4, { hasIdle: true, primaryAttackAnimFrames: [0, 1] }, () => 8, () => 0.99);
  p.update(0, { hurting: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(p.state, 'hurt');
  p.update(0, { striking: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(p.state, 'attack');
  // ...while knockback-hurt never interrupts PrimaryAttack
  // (EnemyMotor gates on state != PrimaryAttack).
  p.update(0, { hurting: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(p.state, 'attack');
});

test('mobile: flying enemies move/idle on the FlyAnimSpeed clock', () => {
  // GetStateAnims' tail: Behaviour == Flying overrides Move/Idle to
  // 10 fps (the imp/harpy flap rate); attack/hurt keep their own.
  assert.equal(FLY_ANIM_SPEED, 10);
  const fly = new MobileUnit(1, { hasIdle: true, behaviour: 'Flying', primaryAttackAnimFrames: [0] }, () => 6, () => 0.5);
  const walk = new MobileUnit(4, { hasIdle: true, primaryAttackAnimFrames: [0] }, () => 6, () => 0.5);
  fly.update(0.1, { moving: true }, 0, [0, 0, 0], [0, 0, 5]);    // 0.1 >= 1/10 -> steps
  walk.update(0.1, { moving: true }, 0, [0, 0, 0], [0, 0, 5]);   // 0.1 < 1/6 -> holds
  assert.equal(fly.frame, 1);
  assert.equal(walk.frame, 0);
  // Idle rides the same override (4 -> 10 fps for flyers)
  const flyIdle = new MobileUnit(1, { hasIdle: true, behaviour: 'Flying', primaryAttackAnimFrames: [0] }, () => 6, () => 0.5);
  flyIdle.update(0.1, {}, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(flyIdle.frame, 1);
});

test('mobile: scorpion flip inversion + the orientation frame rescale', () => {
  // OrientEnemy: Giant Scorpion (20) animations are inverted - the
  // flip boolean NEGATES vs the table for every orientation.
  const basics = { hasIdle: true, primaryAttackAnimFrames: [0] };
  const scorp = new MobileUnit(MOBILE_GIANT_SCORPION, basics, () => 4, () => 0.5);
  const plain = new MobileUnit(4, basics, () => 4, () => 0.5);
  for (const camX of [5, -5]) {
    const a = scorp.update(0, {}, 0, [0, 0, 0], [camX, 0, 0.1]);
    const b = plain.update(0, {}, 0, [0, 0, 0], [camX, 0, 0.1]);
    assert.equal(a.record, b.record);
    assert.equal(a.flip, !b.flip);
  }
  // UpdateOrientation's Ancient Lich rescale: an orientation switch
  // maps the frame proportionally into the new record's count
  // (frame * newN / oldN, truncated) instead of overflowing.
  const counts = { 15: 8, 16: 4, 17: 4, 18: 4, 19: 4 };
  const lich = new MobileUnit(4, basics, (r) => counts[r] ?? 4, () => 0.5);
  lich.update(0, {}, 0, [0, 0, 0], [0, 0, 5]);         // front: record 15, 8 frames
  for (let i = 0; i < 5; i++) lich.update(1 / IDLE_ANIM_SPEED, {}, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(lich.frame, 5);
  lich.update(0, {}, 0, [0, 0, 0], [5, 0, 0.1]);       // swing to a flank: 4-frame record
  assert.equal(lich.frame, Math.floor((5 * 4) / 8));   // 2, in range - not 5
});

test('C14 spell state: the HasSpellAnimation route, the one-shot, and its interrupts', async () => {
  const { RANGED_ATTACK1_ANIMS } = await import('../src/characters/mobileUnit.js');
  // GetStateAnims' Spell branch: HasSpellAnimation -> records 20-24
  // (RangedAttack1Anims); everyone else casts over the primary
  // records - and NO ghost/wraith special (verbatim: ghosts cast on
  // PrimaryAttackAnims, not their own attack table).
  assert.deepEqual(RANGED_ATTACK1_ANIMS.map((a) => a.record), [20, 21, 22, 23, 24, 23, 22, 21]);
  assert.equal(stateAnims('spell', 21, true, true), RANGED_ATTACK1_ANIMS);
  assert.equal(stateAnims('spell', 32, true, false), PRIMARY_ATTACK_ANIMS);
  assert.equal(stateAnims('spell', MOBILE_GHOST, true, false), PRIMARY_ATTACK_ANIMS);
  // The one-shot: SpellAnimFrames play through and revert to idle
  // (the shaman's [0,0,1,2,3,3,3], verbatim).
  const basics = { hasIdle: true, hasSpellAnimation: true, spellAnimFrames: [0, 0, 1, 2, 3, 3, 3], primaryAttackAnimFrames: [0, 1] };
  const m = new MobileUnit(21, basics, () => 8, () => 0.99);
  m.update(1 / 60, { casting: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(m.state, 'spell');
  assert.equal(m.frame, 0);
  const seen = [];
  for (let i = 0; i < 8 && m.state === 'spell'; i++) {
    m.update(1 / 10, {}, 0, [0, 0, 0], [0, 0, 5]);
    if (m.state === 'spell') seen.push(m.frame);
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 3, 3]);
  assert.equal(m.state, 'idle');
  // Interrupts, verbatim: the attack edge overrides a cast
  // (ChangeEnemyState unconditional), and knockback-hurt CAN cut a
  // cast (the EnemyMotor gate is state != PrimaryAttack ONLY)...
  const c1 = new MobileUnit(21, basics, () => 8, () => 0.99);
  c1.update(0, { casting: true }, 0, [0, 0, 0], [0, 0, 5]);
  c1.update(0, { striking: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(c1.state, 'attack');
  const c2 = new MobileUnit(21, basics, () => 8, () => 0.99);
  c2.update(0, { casting: true }, 0, [0, 0, 0], [0, 0, 5]);
  c2.update(0, { hurting: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(c2.state, 'hurt');
  // ...while a cast never interrupts an attack in progress.
  const c3 = new MobileUnit(21, basics, () => 8, () => 0.99);
  c3.update(0, { striking: true }, 0, [0, 0, 0], [0, 0, 5]);
  c3.update(0, { casting: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(c3.state, 'attack');
});

test('C17 humanoids: the female-thief idle, the ranged one-shot, the class fields', async () => {
  const { FEMALE_THIEF_IDLE_ANIMS } = await import('../src/characters/mobileUnit.js');
  // FemaleThiefIdleAnims, verbatim: record 11 rides BOTH front
  // diagonals (the quirk), mirrored on the SE.
  assert.deepEqual(FEMALE_THIEF_IDLE_ANIMS.map((a) => a.record), [15, 11, 17, 18, 19, 18, 17, 11]);
  // The idle route: female + FemaleTexture 483 (Thief 138) takes the
  // special set; the male thief takes the plain idle.
  assert.equal(stateAnims('idle', 138, true, false, true), FEMALE_THIEF_IDLE_ANIMS);
  assert.equal(stateAnims('idle', 138, true, false, false), IDLE_ANIMS);
  // The ranged state: records 20-24, the shared class sequence
  // [3,2,0,0,0,-1,1,1,2,3] - the -1 is the shootArrow moment
  // (shootFrame, NOT hitFrame), one loose per draw, exhaust -> idle.
  const basics = { hasIdle: true, primaryAttackAnimFrames: [0], rangedAttackAnimFrames: [3, 2, 0, 0, 0, -1, 1, 1, 2, 3] };
  const m = new MobileUnit(135, basics, () => 8, () => 0.5);
  m.update(1 / 60, { rangedStriking: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(m.state, 'ranged');
  assert.equal(m.frame, 3);
  let shoots = 0, melees = 0;
  for (let i = 0; i < 12 && m.state === 'ranged'; i++) {
    m.update(1 / 10, {}, 0, [0, 0, 0], [0, 0, 5]);
    if (m.shootFrame) shoots++;
    if (m.hitFrame) melees++;
  }
  assert.equal(shoots, 1, 'one arrow per draw');
  assert.equal(melees, 0, 'the ranged -1 is a SHOOT marker, not melee');
  assert.equal(m.state, 'idle');
  // The class extraction: mage textures 486/485, the archer classes
  // carry the shared ranged frames, the corpse rides 380.
  assert.equal(ENEMY_BASICS['128'].maleTexture, 486);
  assert.equal(ENEMY_BASICS['128'].femaleTexture, 485);
  assert.deepEqual(ENEMY_BASICS['133'].rangedAttackAnimFrames, [3, 2, 0, 0, 0, -1, 1, 1, 2, 3]);
  assert.equal(ENEMY_BASICS['138'].femaleTexture, 483);   // the thief
  assert.equal(ENEMY_BASICS['129'].femaleTexture, 475);   // the 1.35 cast-scale class
  assert.deepEqual(ENEMY_BASICS['128'].corpseTexture, { archive: 380, record: 1 });
});

test('mobile: the extracted per-enemy anim fields (EnemyBasics regeneration)', () => {
  assert.deepEqual(ENEMY_BASICS['0'].primaryAttackAnimFrames, [0, 1, 2, -1, 3, 4, 5]);   // Rat, verbatim
  assert.equal(ENEMY_BASICS['0'].hasIdle, true);
  assert.deepEqual(ENEMY_BASICS['1'].primaryAttackAnimFrames, [0, 1, 2, -1, 3, 1]);      // Imp
  let withFrames = 0, withVariants = 0;
  for (const [k, v] of Object.entries(ENEMY_BASICS)) {
    if (Number(k) > 42) continue;
    if (v.primaryAttackAnimFrames) withFrames++;
    if (v.primaryAttackAnimFrames2) withVariants++;
  }
  assert.equal(withFrames, 42);        // every real monster carries its sequence
  assert.ok(withVariants >= 5, `chance-rolled variants exist (${withVariants})`);
  // Every -1 marker sits INSIDE a sequence (the damage frame law)
  for (const [k, v] of Object.entries(ENEMY_BASICS)) {
    if (Number(k) > 42 || !v.primaryAttackAnimFrames) continue;
    assert.ok(v.primaryAttackAnimFrames.includes(-1) || v.primaryAttackAnimFrames.length > 0, k);
  }
});
