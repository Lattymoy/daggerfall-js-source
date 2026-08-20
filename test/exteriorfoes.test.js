// X-slice: the EXTERIOR MOBILE-FOE MOUNT - S32's above-ground spawn
// arms go live. The pool reuses the shared pieces (EnemyAI, the
// EnemyAttack cadence, MobileUnit, the entity/loot/equipment chain,
// CalculateAttackDamage both ways); these pin the pool's own laws
// and the world host's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_ACTIVE_ENCOUNTER_FOES, ENCOUNTER_CULL_DISTANCE } from '../src/scenes/exteriorFoes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, 'src/scenes', f), 'utf8');

test('exteriorfoes: the pool laws - cull AFTER fresh senses, the alert raise, the pooled caps', () => {
  const s = src('exteriorFoes.js');
  // the cull runs after ai.update so a just-spawned foe's Infinity
  // placeholder never culls it (the live probe caught the inversion)
  const upd = s.indexOf('f.ai.update(dt, playerFeet, senses, false);');
  const cull = s.indexOf('f.ai._dist > ENCOUNTER_CULL_DISTANCE');
  assert.ok(upd > 0 && cull > upd, 'senses first, cull second');
  assert.ok(s.includes('if (f.ai.inSight && f.ai.detected) setEnemyAlert(playerEntity, true'),
    'sight raises the enemy alert above ground too (EnemySenses:533-535)');
  assert.ok(s.includes('if (f.ai?.detected) setEnemyAlert(playerEntity, false)'), 'the targeting kill clears it');
  assert.equal(typeof MAX_ACTIVE_ENCOUNTER_FOES, 'number');
  assert.ok(ENCOUNTER_CULL_DISTANCE > 60, 'the relevance band outlives the senses radius');
  // no crime machinery: killing a wilderness wolf is not Murder
  assert.equal(s.includes('crimeCommitted'), false, 'the watch keeps the crime arms; this pool has none');
  // the archery/casting residue is explicit, not accidental
  assert.ok(s.includes('attack.rangedAttack = false;   // RESIDUE'), 'exterior enemy archery pends its arrow seam, loudly');
});

test('exteriorfoes: the world host - the cadence loop, the travel reset, the facade and the melee order', () => {
  const s = src('world.js');
  const i = s.indexOf('function runEncounterTick');
  assert.ok(i > 0);
  const fn = s.slice(i, i + 1400);
  assert.ok(fn.includes('intermittentEnemySpawn({'), 'the classic catch-up loop rolls per elapsed minute');
  assert.ok(fn.includes('inLocationRect: locationIndex.has(key)'), 'the town rect reads the location index');
  assert.ok(fn.includes('maps.getClimateIndex('), 'the climate feeds the table pick');
  assert.ok(fn.includes('Math.min(now - _lastEncMinutes, 1440)'), 'the catch-up is bounded');
  assert.ok(s.includes('_lastEncMinutes = Math.floor(playerTicker.classicMinutes);   // X-slice: PreventEnemySpawns parity'),
    'fast travel suppresses the traveled window, as DFU does');
  // encounter foes are spell targets and the sinks route by pool
  assert.ok(s.includes('[...cityGuards.guards, ...exteriorFoes.foes]'), 'magic.foes() sees both pools');
  assert.ok(s.includes("g._encounter ? exteriorFoes.damageFoe(g, n, player.pos) : cityGuards.hurtGuard(g, n, player.pos)"),
    'the spell sink routes to the right damage door');
  // the melee chain: the watch, then encounters, then civilians
  const watch = s.indexOf('cityGuards.resolvePlayerHit(weaponRig.playerWeapon');
  const enc = s.indexOf('exteriorFoes.resolvePlayerHit(weaponRig.playerWeapon');
  const civ = s.indexOf('cityGuards.resolveCivilianHit(weaponRig.playerWeapon');
  assert.ok(watch > 0 && enc > watch && civ > enc, 'watch -> encounters -> civilians');
  // the pool follows the floating origin
  assert.ok(s.includes('exteriorFoes.offsetAll(r.offset)'), 'a recenter shifts the pool');
});
