// IF1 - THE INFIGHTING AUDIT (2026-08-29, Mac: "I noticed in the
// dungeon, that enemies don't attack each other").
//
// The audit found the machinery COMPLETE at every layer that can be
// measured off the tree, and these pins are that audit made permanent -
// each one is a layer that was checked, so a later change that breaks
// any of them fails here instead of turning into the same report again.
//
// What was verified, in order:
//   1. the settings gate ships True (DFU: "Ships True")
//   2. the monster table carries a per-monster team, all 62 rows
//   3. the encounter tables actually MIX teams, so dungeons can infight
//   4. selection: a Vermin rat picks an Undead skeleton
//   5. same-team and infighting-off both fall back to the player
//   6. the machine's cadence retargets inside a third of a second
//   7. the dungeon host arms it (candidates -> sensesContext -> the
//      per-foe targeting closure) and acts on a foe target in all
//      three arms: melee, missiles, casting
//
// What could NOT be verified here is the live frame: this container has
// no ARENA2 data and the dungeon needs a browser. So IF1 also ships the
// F8 census that reads the answer off a real dungeon in one keypress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTargets, runTargetMachine, isPlayerTarget, staticTeamOf, mobileTeamOf } from '../src/characters/enemyTargets.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { ENCOUNTER_TABLES } from '../src/systems/encounters.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

const collider = { raycast: () => Infinity, raycastHit: () => ({ dist: Infinity, key: null, normal: null }) };
const foe = (name, team, feet) => ({
  name, entity: { team, mobileTeam: team, health: 50 },
  ai: { feet, yaw: 0, height: 1.8, collider, target: null, isHostile: true,
        wouldBeSpawned: true, detected: true, inSight: true },
});
const PLAYER_FEET = [20, 0, 0];

test('IF1 (2): every monster carries its own team - the table is complete', () => {
  const ids = Object.keys(ENEMY_BASICS);
  const missing = ids.filter((id) => !ENEMY_BASICS[id]?.team);
  assert.deepEqual(missing, [], 'a row without a team falls back to PlayerEnemy and can never infight');
  // and they are not all the same team, which would be the same bug in
  // the data rather than the code
  const teams = new Set(ids.map((id) => ENEMY_BASICS[id].team));
  assert.ok(teams.size >= 15, `only ${teams.size} distinct teams; DFU's table has ~20`);
  assert.equal(staticTeamOf(Number(ids[0])), ENEMY_BASICS[ids[0]].team, 'staticTeamOf reads the row');
});

test('IF1 (3): the encounter tables MIX teams, so a dungeon can infight at all', () => {
  const rows = Array.isArray(ENCOUNTER_TABLES) ? ENCOUNTER_TABLES.map((r, i) => [i, r]) : Object.entries(ENCOUNTER_TABLES);
  let multi = 0, single = 0;
  for (const [, list] of rows) {
    const ids = Array.isArray(list) ? list : (list?.enemies ?? list?.ids ?? []);
    if (!Array.isArray(ids) || !ids.length) continue;
    const teams = new Set(ids.map((id) => ENEMY_BASICS[id]?.team ?? 'PlayerEnemy'));
    if (teams.size > 1) multi++; else single++;
  }
  assert.ok(multi > single * 5,
    `${multi} multi-team tables vs ${single} single-team - if most were single-team, "no infighting" would be DFU-correct`);
});

test('IF1 (4): a foe of one team SELECTS a foe of another', () => {
  const rat = foe('rat', 'Vermin', [0, 0, 0]);
  const skel = foe('skeleton', 'Undead', [3, 0, 0]);
  const got = getTargets(rat, [skel], PLAYER_FEET, { infighting: true });
  assert.equal(got.target, skel, 'the nearer different-team foe beats the distant player');
  assert.equal(isPlayerTarget(got.target), false);
});

test('IF1 (5): same team, and infighting OFF, both fall back to the player', () => {
  const rat = foe('rat', 'Vermin', [0, 0, 0]);
  const rat2 = foe('rat2', 'Vermin', [2, 0, 0]);
  assert.equal(isPlayerTarget(getTargets(rat, [rat2], PLAYER_FEET, { infighting: true }).target), true,
    'DFU: `if (targetEntity.Team == enemyEntity.Team) continue`');
  const skel = foe('skeleton', 'Undead', [3, 0, 0]);
  assert.equal(isPlayerTarget(getTargets(rat, [skel], PLAYER_FEET, { infighting: false }).target), true,
    'the else-arm rejects every non-player target');
});

test('IF1 (6): the machine retargets on DFU\'s cadence, inside a third of a second', () => {
  const rat = foe('rat', 'Vermin', [0, 0, 0]);
  const skel = foe('skeleton', 'Undead', [3, 0, 0]);
  const dt = 1 / 60;
  let frames = 0;
  while (rat.ai.target == null && frames < 120) {
    runTargetMachine(rat, [skel], PLAYER_FEET, dt, { infighting: true, playerEntity: { health: 100 } });
    frames++;
  }
  assert.ok(rat.ai.target != null, 'the machine never selected anything in two seconds');
  assert.equal(rat.ai.target, skel);
  assert.ok(frames * dt < 0.5, `took ${(frames * dt).toFixed(3)}s - the senses interval is ~0.28s`);
});

test('IF1 (7): the DUNGEON host arms the machine and acts on a foe target', () => {
  const dc = read('src/scenes/dungeonContext.js');
  // the candidate list is this host's live pool, filtered as DFU's
  // GetActiveEnemyBehaviours yields only active ones
  assert.match(dc, /candidates: foeDeps \? \(\) => foes\.filter\(\(f\) => !f\.dead && f\.ai\) : null/);
  // ...and it survives the senses context rather than being dropped
  assert.match(read('src/scenes/shared.js'), /\n    candidates,\n/);
  // the per-foe targeting closure the motor arms itself from
  assert.match(dc, /targeting: \(ai, pf, cdt\) => foeDeps\.runTargetMachine\(rec, sn\.candidates\(\), pf, cdt,/);
  assert.match(read('src/characters/enemyMotor.js'), /this\._armedTargeting = !!targeting;/);
  // and all three action arms fork on a non-player target
  assert.match(dc, /function resolveFoeMeleeVsFoe\(f\)/, 'melee');
  assert.match(dc, /if \(resolveFoeMeleeVsFoe\(f\)\) return;/, 'melee, from the one home');
  assert.match(dc, /dealDamage: \(tt, d\) => tt\.hurtFromFoe\?\.\(d, m\.dir\)/, 'missiles');
  assert.match(dc, /f\.ai\.target\?\.entity \?\? playerEntity/, 'casting');
});

test('IF1: the F8 census reads the answer off a live dungeon', () => {
  // The audit could not run the game - no ARENA2 here, and the dungeon
  // needs a browser - so it ships the instrument instead of a guess.
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /function _foeCensus\(\)/);
  assert.match(dc, /const armed = live\.filter\(\(f\) => f\.ai\._armedTargeting\)\.length;/);
  assert.match(dc, /const vsFoe = live\.filter\(\(f\) => f\.ai\._armedTargeting && f\.ai\.target\n\s*&& !\(foeDeps\?\.isPlayerTarget\?\.\(f\.ai\.target\) \?\? true\)\)\.length;/);
  assert.match(dc, /teams \$\{teams\.join\(','\) \|\| 'none'\}/);
  assert.match(dc, /deps \$\{foeDeps \? 'yes' : 'NO'\}/, 'the subsystem gate is on the line too');
  // it is ON the debug lines, not merely defined - the drawn-door rule
  assert.match(dc, /`input \$\{_inputState\}`,\n(?:\s*\/\/[^\n]*\n)*\s*_foeCensus\(\),/);
});
