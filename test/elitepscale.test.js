// ELITE x PSCALE1 (2026-09-25, Mac: "Can you ensure our elite mod integration doesnt break with the new party
// scaling implemented") - the EliteDungeons drop and main's party scaling meet on the same foes. Each holds its own
// half and the two MULTIPLY: elite at the foe's mint and in the blow's own tail, the party at the door where the
// damage lands. Nothing of either is lost, doubled or applied to the wrong side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { calculateAttackDamage, registerFormulaOverride } from '../src/combat/formulas.js';
import { partyFoeHits, partyFoeLoses, partyGroupMembers, partyToughness } from '../src/systems/partyScale.js';
import { ELITE_DAMAGE_SCALE, ELITE_HEALTH_SCALE, ELITE_FOE_MULTIPLIER } from '../src/world/spawnedDungeons.js';
import { FOES_FRAME_MAX, PARTY_MAX, FOE_HEALTH_MAX } from '../src/net/wire.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

test('ELITE x PSCALE1: an elite foe\'s blow on a party is elite\'s double, THEN the party\'s weight - the two multiply, neither is lost', () => {
  registerFormulaOverride('calculateAttackDamage', () => 10);   // the core pinned, so the test reads the two tails alone
  try {
    const me = { isPlayer: true, reflexes: 2, health: 100 };
    const eliteBlow = calculateAttackDamage({ isPlayer: false, damageScale: ELITE_DAMAGE_SCALE }, me);
    const plainBlow = calculateAttackDamage({ isPlayer: false }, me);
    assert.equal(eliteBlow, 10 * ELITE_DAMAGE_SCALE);
    for (const n of [1, 2, 4, PARTY_MAX]) {
      assert.equal(partyFoeHits(eliteBlow, n), Math.round(eliteBlow * (1 + 0.1 * (n - 1))), `${n} fighting it`);
      assert.equal(partyFoeHits(eliteBlow, n), ELITE_DAMAGE_SCALE * partyFoeHits(plainBlow, n), 'elite doubles what the party already weighs');
    }
  } finally {
    registerFormulaOverride('calculateAttackDamage', null);
  }
  // the dungeon weighs a shared foe's weapon and arrow hit AROUND the blow the formula returned - elite's tail inside it
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /function _weighHit\(f, dmg\) \{ return f && _sharedFoe\(f\) \? partyFoeHits\(dmg, fightN\(f\), playerEntity\) : dmg; \}/);
  assert.match(d, /const dmg = _weighHit\(f, foeDeps\.calculateAttackDamage\(f\.entity, foeDeps\.playerEntity, \{/, 'the melee hit');
  assert.match(d, /const dmg = foeDeps && shooter \? _weighHit\(shooter, foeDeps\.calculateAttackDamage\(shooter\.entity, playerEntity, \{/, 'the arrow');
});

test('ELITE x PSCALE1: an elite foe fights a party with elite\'s doubled health AND the party\'s toughness; its copies are shared foes like its original', () => {
  // the health: doubled at the mint (the one number every client agrees on), the party's toughness taken where damage lands
  const foe = {};
  const base = 60, health = base * ELITE_HEALTH_SCALE;
  let left = health, blows = 0;
  while (left > 0 && blows < 1000) { left -= partyFoeLoses(foe, 10, 4); blows++; }
  assert.equal(blows, Math.ceil((health * partyToughness(4)) / 10), 'four fighters take 2.5x the blows of the doubled pool');
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /entity\.maxHealth = Math\.max\(1, Math\.round\(entity\.maxHealth \* ELITE_HEALTH_SCALE\)\);/);
  assert.match(d, /foe\.entity\.health -= !bypassShield && !_whole && _sharedFoe\(foe\) \? partyFoeLoses\(foe, healthDamage, fightN\(foe\)\) : healthDamage;/);
  // the copies are the LAYOUT's: the expanded list is built before the load loop, and the layout's run is counted after it,
  // so every copy is `i < _layoutFoes` - shared, streamed by index, weighed by who fights it, the same on every client
  const expand = d.indexOf('const enemies = dfLocation?.elite');
  const layout = d.indexOf('const _layoutFoes = foes.length;');
  assert.ok(expand > 0 && layout > expand, 'expanded before the layout run is counted');
  // REST-SYNC re-aim: the layout's run, or a rest's shared encounter (test/restsync.test.js) - a copy is still the former
  // PSCALE-OWN re-aim: or a shared quest's foe on the own lane (test/pscaleown.test.js) - asked after the room's predicate;
  // SUMMON-SYNC: or a loose stand on it (ownRides, test/summonsync.test.js)
  assert.match(d, /function _sharedFoe\(f\) \{\n\s*if \(!f \|\| f\.entity\?\.team === 'PlayerAlly'\) return false;\n\s*return isRoomFoe\(f\) \|\| f\._ownFrom != null \|\| ownRides\(f\);/);
  assert.match(d, /const isRoomFoe = \(f, i = foes\.indexOf\(f\)\) => \(i >= 0 && i < _layoutFoes\) \|\| \(f != null && f\._encId != null\);/);
});

test('ELITE x PSCALE1: the host\'s full foes frame for the largest elite dungeon still fits the wire with party scaling\'s `n` and Renown\'s `l` on every record', () => {
  // the largest spawn template (Ruins of The Ashsley Cabin, 151 markers - the drops audit's real-data count) tripled
  const records = [];
  for (let i = 0; i < 151 * ELITE_FOE_MULTIPLIER; i++) {
    records.push({ i, t: 140 + (i % 10), f: [-1234.56, -123.45, -1234.56], y: 6.283, h: FOE_HEALTH_MAX, d: 1, a: 99, m: 9, g: 'k3j4h5g6f7d8', c: 99, s: 999, x: 1, l: 30, n: PARTY_MAX });
  }
  const frame = JSON.stringify({ t: 'foes', data: { n: 1e9, k: 'dungeon:4294967295', f: records } });
  assert.ok(frame.length < FOES_FRAME_MAX, `${frame.length} of ${FOES_FRAME_MAX} bytes`);
});

test('ELITE x AUDIT SET P-M3 (AUDIT FINAL F7): a joiner\'s name rides a death\'s record for KILLED_BY_MS alone, so the largest elite dungeon\'s full frame holds the worst records with sixty fresh deaths named by joiners - where every body naming its striker for as long as it lay broke the 64 KiB and the host\'s stream was refused whole (mutant: the name kept for as long as the body lies)', () => {
  const peer = 'k3j4h5g6f7d8a';   // a peer's id - 13 characters
  const records = [];
  for (let i = 0; i < 151 * ELITE_FOE_MULTIPLIER; i++) {
    const r = { i, t: 140 + (i % 10), f: [-1234.56, -123.45, -1234.56], y: 6.283, h: FOE_HEALTH_MAX, d: 1, a: 99, m: 9, g: 'k3j4h5g6f7d8', c: 99, s: 999, x: 1, l: 30, n: PARTY_MAX };
    if (i < 60) { r.h = 0; delete r.n; r.v = peer; }   // a fresh death's record: no fighters' count, its striker named
    records.push(r);
  }
  const frame = JSON.stringify({ t: 'foes', data: { n: 1e9, k: 'dungeon:4294967295', f: records } });
  assert.ok(frame.length < FOES_FRAME_MAX, `${frame.length} of ${FOES_FRAME_MAX} bytes`);
  // every body named, as it was: over the wire's cap - the window is what holds it
  const named = JSON.stringify({ t: 'foes', data: { n: 1e9, k: 'dungeon:4294967295', f: records.map((r) => ({ ...r, h: 0, n: undefined, v: peer })) } });
  assert.ok(named.length > FOES_FRAME_MAX, `every body named: ${named.length} bytes`);
  assert.match(rd('src/scenes/dungeonContext.js'), /if \(f\.dead && typeof f\._killedBy === 'string' && performance\.now\(\) - \(f\._killedAt \?\? -Infinity\) <= KILLED_BY_MS\) r\.v = f\._killedBy;/);
});

test('ELITE x PSCALE1 outdoors: a camp grows by the party it meets, and CAMP-RING\'s room is asked for the grown group', () => {
  assert.deepEqual(partyGroupMembers([1, 2, 3], 5), [1, 2, 3, 1, 2], 'five together: two more, drawn from its own');
  assert.match(rd('src/scenes/world.js'), /const size = partyGroupMembers\(h\.mobileTypes, partySize\(\)\)\.length;\n\s*if \(size > room\) continue;/);
  assert.match(rd('src/scenes/world.js'), /for \(const mobileType of partyGroupMembers\(hit\.mobileTypes, partySize\(\)\)\) \{/, 'the stand grows it the same way');
});
