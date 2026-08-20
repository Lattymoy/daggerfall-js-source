// Combat bows: the ranged attack gate + the recoverable-arrow rule
// shape (the flight geometry lives in the scene; the pure parts pin).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MELEE_DISTANCE } from '../src/characters/enemyMotor.js';
import { WEAPON_SKILL, SKILLS } from '../src/systems/skills.js';
import { addItem } from '../src/systems/inventory.js';

test('bows: the 6..51.2 band owns the archer - 1/32 cadence inside, melee fallback at reach, nothing between', () => {
  // C-slice (AUDIT 23 combat-3): EnemyMotor.DoRangedAttack:570-614.
  // At liveSpeed 200 a full strike completes INSIDE one 66ms tick -
  // state snapshots miss it, so the pins are the EVENTS.
  const mkAi = (dist, yaw = 0) => ({ _dist: dist, feet: [0, 0, 0], yaw, inSight: true });
  const player = [0, 0, 10];   // straight ahead (yaw 0 faces +z)
  const run = (ranged, dist, { yaw = 0, rolls = () => 0.0 } = {}) => {
    const a = new EnemyAttack({ liveSpeed: 200, playerLevel: 1, reflexes: 2, rolls });
    a.rangedAttack = ranged;
    a.meleeTimer = 0;
    const ai = mkAi(dist, yaw);
    const events = [];
    for (let i = 0; i < 120; i++) events.push(...a.update(1 / 15, ai, player));
    return { a, events, fired: events.includes('hit') };
  };
  const melee = run(false, 10);
  assert.equal(melee.fired, false, '10m > MELEE_DISTANCE: a melee foe never fires');
  assert.equal(melee.a.meleeTimer, 0, 'gate hit before the timer reset');
  // in the band: fires on the 1/32 roll, NO melee timer involved
  const archer = run(true, 10, { rolls: () => 0.0 });
  assert.equal(archer.fired, true, 'in band, in yaw, roll passes: the bow fires');
  assert.equal(archer.a.firedRanged, true, 'the swing is marked RANGED');
  assert.equal(archer.a.meleeTimer, 0, 'the band cadence never touches the melee timer');
  // the roll IS the cadence: forced high, an in-band archer never fires
  assert.equal(run(true, 10, { rolls: () => 0.99 }).fired, false, 'the 1/32 gate holds');
  // facing away: no shot (DoRangedAttack turns instead)
  assert.equal(run(true, 10, { yaw: Math.PI }).fired, false, 'the 22.5deg yaw gate holds');
  // the DEAD ZONE: closer than 6m but beyond melee reach - nothing
  assert.equal(run(true, 4).fired, false, 'inside 6m the bow is silent; 4m is beyond melee reach');
  // beyond 51.2m: silent
  assert.equal(run(true, 60).fired, false, 'beyond the band the bow is silent');
  // the MELEE FALLBACK: an archer at reach swings like anyone
  const close = run(true, 2.0);
  assert.equal(close.fired, true, 'an archer at 2m fights melee');
  assert.equal(close.a.firedRanged, false, 'the swing is marked MELEE');
  assert.ok(close.a.meleeTimer > 0 || close.events.length > 0, 'the melee timer reset ran');
  assert.ok(MELEE_DISTANCE < 6, 'the fallback reach sits inside the band floor');
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
