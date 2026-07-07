// Combat bows: the ranged attack gate + the recoverable-arrow rule
// shape (the flight geometry lives in the scene; the pure parts pin).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MELEE_DISTANCE } from '../src/characters/enemyMotor.js';
import { WEAPON_SKILL, SKILLS } from '../src/systems/skills.js';
import { addItem } from '../src/systems/inventory.js';

test('bows: ranged foes attack from sight; melee foes stay distance-gated', () => {
  // At liveSpeed 200 a full strike completes INSIDE one 66ms tick -
  // state snapshots miss it, so the pins are the EVENTS (and the
  // untouched melee timer for the gated foe).
  const mkAi = (dist) => ({ _dist: dist, feet: [0, 0, 0], yaw: 0, inSight: true });
  const player = [0, 0, 10];   // straight ahead (yaw 0 faces +z)
  const run = (ranged) => {
    const a = new EnemyAttack({ liveSpeed: 200, playerLevel: 1, reflexes: 2 });
    a.rangedAttack = ranged;
    a.meleeTimer = 0;
    const ai = mkAi(10);
    const events = [];
    for (let i = 0; i < 120; i++) events.push(...a.update(1 / 15, ai, player));
    return { a, events };
  };
  const melee = run(false);
  assert.equal(melee.events.filter((e) => e === 'hit').length, 0);   // 10 > MELEE_DISTANCE: never fires
  assert.equal(melee.a.meleeTimer, 0);                               // gate hit before the timer reset
  const archer = run(true);
  assert.ok(archer.events.includes('hit'));                          // ranged: strikes from sight
  assert.ok(archer.a.meleeTimer >= 0);                               // reset ran (a strike happened)
  assert.ok(MELEE_DISTANCE < 10);
});

test('bows: the weapon-skill mapping routes bows to Archery; landed arrows stack on the target', () => {
  assert.equal(WEAPON_SKILL['Short Bow'], SKILLS.Archery);
  assert.equal(WEAPON_SKILL['Long Bow'], SKILLS.Archery);
  const targetItems = [];
  addItem(targetItems, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });
  addItem(targetItems, { group: 'Weapons', name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1 });
  assert.equal(targetItems.length, 1);
  assert.equal(targetItems[0].stackCount, 2);           // BowDamage's recoverable arrows stack
});
