// OW-RISE (2026-10-17, the player: "the overworld travel randomly slows down from speed multiplier even without enemies
// nearby"). A journey whose view has come down walks on the ground at x1 until the view rises again (world.js
// travelViewGovern, AUDIT OW4 J5), and tvJourneyUp - the rise - asked every hostile foe in classic spawn reach, where the
// view's own `danger` asks only the ones WILD-ALERT lets through (wildSeen: never a foe that has not noticed a fast
// traveller). So an unaware camp beside the road held the journey at x1 with no enemy coming. Pinned: the rise MOUNTED
// from its own source over the real areEnemiesNearby - an unaware foe in reach lets the view up, the same foe alerted
// keeps it down - and the rise and the danger counting one pool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { areEnemiesNearby } from '../../../src/systems/encounters.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');

test('OW-RISE: the Overworld rises over an unaware foe in reach (WILD-ALERT), not over an alerted one - the rise counts the foes the view\'s danger counts', () => {
  const at = WORLD.indexOf('  function tvJourneyUp(');
  assert.ok(at >= 0, 'world.js declares tvJourneyUp');
  const src = WORLD.slice(at, WORLD.indexOf('\n  }\n', at) + 4);
  const foe = { ai: { isHostile: true, wouldBeSpawned: true, feet: [0, 0, 0] }, entity: {} };   // hostile, in classic spawn reach, not seen
  let alerted = false;
  const view = { state: 'off', enter() { view.state = 'up'; } };
  const env = {
    tvOwnsJourneys: () => true, travelView: view, travelOptions: { isTravelActive: true, state: { autopilot: {} } },
    gamePaused: () => false, modes: { modalWindowUp: () => false }, duelEnemyNear: () => false, navalHostileNear: () => false,
    travelViewAllowed: () => ({ ok: true }), areEnemiesNearby, exteriorFoePool: () => [foe],
    wildSeen: (foes) => foes.filter(() => alerted),   // the gate holds an unaware foe off a fast traveller
  };
  const names = Object.keys(env);
  const rise = new Function(...names, `${src}\nreturn tvJourneyUp;`)(...names.map((k) => env[k]));
  assert.equal(areEnemiesNearby([foe]), true, 'the foe is an enemy nearby by DFU\'s sweep - the old rise refused on it');
  alerted = true;
  rise();
  assert.equal(view.state, 'off', 'alerted, it keeps the view down');
  alerted = false;
  rise();
  assert.equal(view.state, 'up', 'unaware, the view rises and the journey runs at its multiplier again');
  const POOL = 'areEnemiesNearby(wildSeen(exteriorFoePool()))';
  assert.ok(/\n\s*danger: \(\) => [^\n]*areEnemiesNearby\(wildSeen\(exteriorFoePool\(\)\)\)/.test(WORLD), 'the view\'s danger asks the gated pool');
  assert.ok(src.includes(POOL), 'and the rise asks the same');
});
