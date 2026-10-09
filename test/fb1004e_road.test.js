// FIELD BUGS 2026-10-04e - WILD-ROAD (bible/01-Overview/Field-Bugs-2026-10-04e.md, report 4; its HUNT-ROAD went with
// HUNT-OUT's text hunt, removed on main).
//
// Discord (Private Joker, "Wilderness Encounter Chances"): "perhaps encounters can be scaled with player level or some
// other metric. having to completely halt my travel because 1 rat chose today to die can be quite the interruption.
// That as well as the random hunting y/n prompts that stop you completely. If I'm going to be stopped on the road, let
// it be for something important or dangerous. a roving orc patrol, a bandit holdup ... This shouldn't be every
// encounter of course. A level 1 leaving privateers hold can take care of the rat problems lol."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { trivialOnRoad, roadCompany, wandererCount, TRIVIAL_LEVEL_RATIO, ROAD_PARTY_MAX } from '../src/systems/roadEncounters.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { SOLITARY_TYPES } from '../src/characters/mobileFactions.js';
import { amGroupRollOwner } from '../src/systems/campEncounters.js';
import { partyExtraFoes } from '../src/systems/partyScale.js';
import { FEATURES } from '../src/systems/features.js';
import { WILD_GIANT } from '../src/systems/wildZone.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const mount = (src, scope, tail) => { const k = Object.keys(scope); return new Function(...k, `${src}\n${tail}`)(...k.map((x) => scope[x])); };

test('WILD-ROAD law: a monster a third of the traveller\'s level or less is passed by on the road - a rat from level 3, an imp from 6, an orc from 15, a giant from 30; a class foe never (mutants: the ratio loosened; class foes trivial)', () => {
  assert.equal(TRIVIAL_LEVEL_RATIO, 3);
  assert.equal(trivialOnRoad(M.Rat, 2), false, 'a level 2 is stopped by a rat - "a level 1 ... can take care of the rat problems"');
  assert.equal(trivialOnRoad(M.Rat, 3), true);
  assert.equal(trivialOnRoad(M.Orc, 14), false);
  assert.equal(trivialOnRoad(M.Orc, 15), true);
  assert.equal(ENEMY_BASICS[130].level, undefined, 'a class foe has no level of its own - it is built at the traveller\'s');
  assert.equal(trivialOnRoad(130, 99), false, 'so it is never passed by');
  // a SOLITARY kind is solitary in company (never part of a camp, PSCALE1), not in danger: an Imp is level 2
  assert.ok(SOLITARY_TYPES.has(M.Imp));
  assert.equal(trivialOnRoad(M.Imp, 5), false);
  assert.equal(trivialOnRoad(M.Imp, 6), true, 'an imp from level 6');
  assert.equal(trivialOnRoad(M.Giant, 29), false);
  assert.equal(trivialOnRoad(M.Giant, 30), true, 'a giant from 30');
  assert.equal(trivialOnRoad(M.Lich, 59), false, 'a lich stops anyone short of 60');
  assert.equal(trivialOnRoad(-1, 40), false);
  assert.equal(trivialOnRoad(M.Rat, NaN), false);
});

test('WILD-ROAD law: company on the road - none below level 5 or for a solitary kind; a chance of level/50 (two in five at most) of one more, one more each six levels past five; never past four with the party\'s own (mutants: the chance inverted; the size unbounded; the party cap gone)', () => {
  assert.equal(roadCompany(M.Orc, 4, 0), 0, 'below level 5');
  assert.equal(roadCompany(M.Orc, 10, 0.19), 1, 'level 10: one in five, one more');
  assert.equal(roadCompany(M.Orc, 10, 0.2), 0, 'the roll past the chance');
  assert.equal(roadCompany(M.Orc, 17, 0.1), 3, 'level 17: three more');
  assert.equal(roadCompany(M.Orc, 40, 0.39), 3, 'never past three');
  assert.equal(roadCompany(M.Orc, 40, 0.4), 0, 'two in five at most');
  assert.equal(roadCompany(M.Imp, 40, 0), 0, 'a solitary kind comes alone');
  assert.equal(wandererCount(M.Orc, 0, 0), 1);
  assert.equal(wandererCount(M.Orc, 3, 3), ROAD_PARTY_MAX, 'the party\'s extras and the road\'s company together, at most four');
  assert.equal(wandererCount(M.Orc, 3, 0), 1 + 3, 'PSCALE1 unchanged off the road');
  assert.equal(wandererCount(M.Imp, 3, 3), 1);
});

/** auditpscale1's mount of runEncounterTick's head (test/auditpscale1.test.js `stands`), with the road's words. */
function stands(over = {}) {
  const W = read('src/scenes/world.js');
  const a = W.indexOf('let _updatedGuards = false;'), b = W.indexOf('// CAMP1 - GROUP ENCOUNTERS', a);
  assert.ok(a > 0 && b > a, 'the tick\'s head is found');
  const out = [];
  mount(strip(W.slice(a, b)), {
    modes: { mode: 'exterior' }, span: 1, amGroupRollOwner, online: null, player: { feetAt: () => [0, 0, 0], isPlayerSwimming: false },
    partyNear: () => [], walkMode: true, playerSpawned: true, intermittentEnemySpawn: () => ({ mobileType: over.mobileType ?? M.Rat }), _lastEncMinutes: 0,
    playerEntity: { isResting: false, level: over.level ?? 10 }, _musicInLocationRect: () => false, maps: { getClimateIndex: () => 0 }, playerTravelPixel: () => ({ x: 0, y: 0 }),
    SOLITARY_TYPES, partyExtraFoes, partySize: () => 1, effectiveLevel: (e) => e?.level ?? 1,
    _standEncounterFoe: (hit) => out.push(hit.mobileType), playerFeet: [0, 0, 0],
    revenantToReturn: () => null, now: 0, sharedClockOn: () => false, worldMinutes: () => 0, spawns: true,
    wildHere: () => false, WILD_GIANT,   // WILD3/ZONE-GIANTS: not in the open zone here (the slice's own two names - test/auditpscale1.test.js)
    getPref: (k) => (k === 'roadEncounters' ? over.pref : undefined), onTheRoad: () => !!over.road, trivialOnRoad, roadCompany, wandererCount,
    Math: Object.create(Math, { random: { value: () => over.roll ?? 0.99 } }),
    ...over.scope,
  }, '}');
  return out;
}

test('WILD-ROAD mounted: on the road a level 10 rides past a rat and stands an orc patrol now and then; off the road, or with the switch off, DFU\'s wanderer as it was (mutants: the road never asked; the switch ignored; no company stood)', () => {
  const row = FEATURES.find((f) => f.id === 'road-encounters');
  assert.equal(row?.control.key, 'roadEncounters', 'the World switch the arm reads');
  assert.equal(row.control.initial, true, 'on by default');
  assert.deepEqual(stands({ road: true }), [], 'on the road: the rat passed by');
  assert.deepEqual(stands({ road: false }), [M.Rat], 'off the road: the rat stands');
  assert.deepEqual(stands({ road: true, pref: false }), [M.Rat], 'the switch off: DFU\'s wanderer');
  assert.deepEqual(stands({ road: true, level: 2 }), [M.Rat], 'a level 2 meets its rat');
  assert.deepEqual(stands({ road: true, mobileType: M.Orc }), [M.Orc], 'an orc, alone most rolls');
  assert.deepEqual(stands({ road: true, mobileType: M.Orc, roll: 0 }), [M.Orc, M.Orc], 'and now and then a patrol');
  assert.deepEqual(stands({ road: false, mobileType: M.Orc, roll: 0 }), [M.Orc], 'never off the road');
  const seq = (...ids) => { let i = 0; return () => ({ mobileType: ids[i++] }); };
  assert.deepEqual(stands({ road: true, scope: { span: 2, intermittentEnemySpawn: seq(M.Rat, M.Orc) } }), [M.Orc], 'the rat\'s minute passes and the next minute still rolls - the loop goes on');
  const W = read('src/scenes/world.js');
  assert.match(W, /const onTheRoad = \(\) => !playerEntity\.isResting && \(!!\(travelOptions\?\.isTravelActive && travelOptions\.state\?\.autopilot\) \|\| !!travelView\?\.active\);/, 'the road: a journey under way, or the Overworld up - never a rest');
});

test('WILD-ROAD: the road is a journey under way or the Overworld up, never a rest (mutants: the window alone the road; a rest the road)', () => {
  const W = read('src/scenes/world.js');
  const at = W.indexOf('const onTheRoad = ');
  const onTheRoad = (o) => new Function('playerEntity', 'travelOptions', 'travelView', `${W.slice(at, W.indexOf('\n', at))}\nreturn onTheRoad();`)(o.playerEntity ?? { isResting: false }, o.travelOptions ?? null, o.travelView ?? null);
  assert.equal(onTheRoad({}), false, 'standing in the wild');
  assert.equal(onTheRoad({ travelOptions: { isTravelActive: true, state: { autopilot: null } } }), false, 'the Travel Options window up, no journey steering');
  assert.equal(onTheRoad({ travelOptions: { isTravelActive: true, state: { autopilot: {} } } }), true, 'a journey under way');
  assert.equal(onTheRoad({ travelView: { active: true } }), true, 'the Overworld up');
  assert.equal(onTheRoad({ travelView: { active: true }, playerEntity: { isResting: true } }), false, 'resting: a camp, not the road');
});
