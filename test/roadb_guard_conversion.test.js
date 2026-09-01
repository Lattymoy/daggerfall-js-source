// ROAD-B (b2-hostility-model) - WHILE THE WATCH IS OUT, EVERY
// WANDERING GUARD IS THE WATCH.
//
// PlayerEntity.MakeNPCGuardsIntoEnemiesIfGuardsSpawned (:764-789) runs
// once per Update from inside the catch-up loop (:513-516) and, while
// any hostile Knight_CityWatch is standing, replaces EVERY wandering
// guard NPC in the location's population with a real one - no range
// test, no cap, no immediate/witness fork. The port had no caller for
// it, so a town whose watch was already out kept minting ordinary
// guard NPCs the player could walk straight past.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(root, rel), 'utf8');
const GUARDS = src('src/scenes/cityGuards.js');
const WORLD = src('src/scenes/world.js');

/** The source between two markers - the port's own idiom for pinning
 *  a member rather than a character count. */
const between = (text, from, to) => {
  const i = text.indexOf(from);
  assert.ok(i > 0, `missing ${from}`);
  const j = text.indexOf(to, i);
  assert.ok(j > i, `missing ${to}`);
  return text.slice(i, j);
};

test('ROAD-B: the standing-watch gate is HowManyEnemiesOfType\'s two live terms', () => {
  // GameManager.cs:740-762 - `includingPacified || (IsHostile && Team
  // != PlayerAlly)`. With includingPacified false (the default, and
  // what :766 passes) a pacified or charmed watchman does NOT count.
  const line = between(GUARDS, 'const anyWatchStanding = () =>',
    '/** PlayerEntity.MakeNPCGuardsIntoEnemiesIfGuardsSpawned');
  assert.match(line, /!g\.dead/, 'a dead guard is not in the active database');
  assert.match(line, /g\.ai\?\.isHostile/, 'a pacified one does not count');
  assert.match(line, /g\.entity\?\.team !== 'PlayerAlly'/, 'and neither does a charmed one');
});

test('ROAD-B: the conversion is gated, unranged, uncapped, and disables the mobile it replaces', () => {
  const fn = between(GUARDS, 'async function makeNpcGuardsIntoEnemies(', 'function angleDeg(');
  assert.match(fn, /if \(!anyWatchStanding\(\)\) return 0;/, ':766 - nothing happens with no watch out');
  assert.match(fn, /if \(!p\.guard\) continue;/, 'only guard NPCs convert (:782)');
  assert.match(fn, /spawnGuardAt\(p\.pos, p\.fwdYaw, playerFeet \?\? null\)/, 'at its own position and facing (:784)');
  assert.match(fn, /p\.disable\(\);/, 'and classic disables the NPC it came from (:785)');
  // The two things SpawnCityGuards has that this deliberately does not.
  assert.ok(!fn.includes('GUARD_NPC_SPAWN_RANGE'), 'no 77.5 range test - that is SpawnCityGuards\' law');
  assert.ok(!fn.includes('MAX_ACTIVE_GUARD_SPAWNS'), 'and no cap either');
  assert.ok(!fn.includes('immediate'), 'and no immediate/witness fork');
});

test('ROAD-B: the catch-up loop calls it once per Update, not once per minute', () => {
  const fn = between(WORLD, 'function runEncounterTick(playerFeet)', 'const _guardPool = ');
  // :484 - the latch is declared OUTSIDE the loop...
  const latch = fn.indexOf('let _updatedGuards = false;');
  const loop = fn.indexOf('for (let l = 0; l < span; l++) {');
  const call = fn.indexOf('cityGuards.makeNpcGuardsIntoEnemies({');
  assert.ok(latch > 0 && loop > latch, 'the latch is declared before the loop (:484)');
  assert.ok(call > loop, '...and the call is inside it (:513-516)');
  assert.match(fn, /if \(!_updatedGuards\) \{\n\s*_updatedGuards = true;/, 'and it fires at most once');
  // ...and it is the LAST of the minute's three statements, after the
  // two passive guard rolls (:498-511).
  assert.ok(fn.indexOf('passiveGuardSpawns({') < call, 'after the low-legal-rep and banished rolls');
  // ...and after the spawn roll's break, which leaves the loop first.
  assert.ok(fn.indexOf('intermittentEnemySpawn({') < call);
  assert.match(fn, /cityGuards\.makeNpcGuardsIntoEnemies\(\{ pool: _guardPool\(\), playerFeet \}\)/,
    'over the live street population, the same pool the witness arm reads');
});

test('ROAD-B: the pool exposes both members and the host is their only caller', () => {
  assert.match(GUARDS, /return \{ guards, spawnCityGuards, makeNpcGuardsIntoEnemies, anyWatchStanding,/);
  // the conversion belongs to the CATCH-UP loop, not to a frame path:
  // one call site, and it is the one above.
  assert.equal((WORLD.match(/makeNpcGuardsIntoEnemies\(/g) ?? []).length, 1);
});
