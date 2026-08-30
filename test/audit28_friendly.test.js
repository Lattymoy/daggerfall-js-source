import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PlayerWeapon, friendlyProtected } from '../src/combat/playerWeapon.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';

// AUDIT 28 - W2b: MELEE FRIENDLY PROTECTION (WeaponManager.cs:930-944 +
// the :1057-1064 fallback), a default-ON DFU law the port's swing did
// not have: the bounding-box pass strikes every foe in reach EXCEPT a
// PlayerAlly, a pacified (non-hostile) foe and a townsperson, and only
// when nothing was struck does the vanilla SphereCast take the one
// thing in front of the player - so a pacified NPC can be hit only when
// it is alone. Before this, a pacified foe standing beside a hostile one
// took the swing like any other, whatever the setting said.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const SABER = { name: 'Saber', templateIndex: WEAPONS.Saber, material: 0 };
const entity = () => ({ level: 1, skills: new Array(35).fill(30), stats: { strength: 50, agility: 50, luck: 50 }, items: [], isPlayer: true });
const foe = (over = {}, ai = {}) => ({ entity: { ...entity(), isPlayer: false, ...over }, ai: { isHostile: true, ...ai } });
const seeAll = () => ({ dist: 1, inView: true, losClear: true });

test('AUDIT 28 W2b: friendlyProtected - a PlayerAlly, a pacified motor; nothing else; nothing at all with the setting off', () => {
  resetToDefaults();
  assert.equal(friendlyProtected(foe({ team: 'PlayerAlly' })), true);
  assert.equal(friendlyProtected(foe({}, { isHostile: false })), true);
  assert.equal(friendlyProtected(foe({ team: 'PlayerEnemy' }, { isHostile: true })), false);
  assert.equal(friendlyProtected(foe({ team: 'Undead' })), false, 'the team read is the LIVE team, not "any team"');
  assert.equal(friendlyProtected(foe({ team: 'PlayerAlly' }), { protection: false }), false);
  setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', false);
  assert.equal(friendlyProtected(foe({ team: 'PlayerAlly' })), false, 'read live');
  resetToDefaults();
});

test('AUDIT 28 W2b: the box pass skips the protected and strikes the rest - a pacified foe beside a hostile one is not hit', () => {
  resetToDefaults();
  const pw = new PlayerWeapon({ weapon: SABER, liveSpeed: 50 });
  const hostile = foe(), pacified = foe({}, { isHostile: false }), ally = foe({ team: 'PlayerAlly' });
  const hits = pw.resolveHit([pacified, hostile, ally], entity(), seeAll, () => 0.5);
  assert.equal(hits.length, 1);
  assert.ok(hits[0].foe === hostile);
});

test('AUDIT 28 W2b: the vanilla arm - a protected foe ALONE in reach is struck, the nearest of them, once', () => {
  resetToDefaults();
  const pw = new PlayerWeapon({ weapon: SABER, liveSpeed: 50 });
  const near = foe({}, { isHostile: false }), far = foe({}, { isHostile: false });
  const see = (f) => ({ dist: f === near ? 1 : 1.8, inView: true, losClear: true });
  const hits = pw.resolveHit([far, near], entity(), see, () => 0.5);
  // Identity, not deepEqual: near and far are structurally identical
  // fixtures, and a deepEqual passed a mutant that picked the FARTHEST.
  assert.equal(hits.length, 1, 'one strike');
  assert.ok(hits[0].foe === near, 'the nearest protected foe');
  // Out of reach is out of reach for the fallback too.
  const none = pw.resolveHit([foe({}, { isHostile: false })], entity(), () => ({ dist: 9, inView: true, losClear: true }), () => 0.5);
  assert.deepEqual(none, []);
});

test('AUDIT 28 W2b: with protection off the box pass strikes everyone in reach, as before', () => {
  resetToDefaults();
  const pw = new PlayerWeapon({ weapon: SABER, liveSpeed: 50 });
  const hostile = foe(), pacified = foe({}, { isHostile: false });
  const hits = pw.resolveHit([pacified, hostile], entity(), seeAll, () => 0.5, () => 0, null, null, { protection: false });
  assert.equal(hits.length, 2);
});

test('AUDIT 28 W2b: the key is LIVE, and the three foe pools all resolve through the one resolveHit', () => {
  assert.equal(LIVE['MeleeAttacks/MeleeAttackFriendlyProtection'], 'src/combat/playerWeapon.js');
  for (const host of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    assert.match(read(host), /playerWeapon\.resolveHit\(live, playerEntity, canSee,/, `${host} does not resolve through resolveHit`);
  }
  // The civilian arm stays behind the pools - :1057's fallback order.
  const world = read('src/scenes/world.js');
  const guards = world.indexOf('cityGuards.resolvePlayerHit(weaponRig.playerWeapon');
  const civil = world.indexOf('cityGuards.resolveCivilianHit(weaponRig.playerWeapon');
  assert.ok(guards > 0 && civil > guards, 'civilians are struck only after the pools miss');
});
