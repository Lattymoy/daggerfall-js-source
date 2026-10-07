// FIELD BUGS 2026-10-07b CLIMB-TRAVEL (Shabalako on Discord, #feature-feedback, "Overworld Travel can be used to exploit
// climbing levelling": "There are many spots in cities where if you keep walking forward into a home can make your
// character climb and let go of the surface at an extremely fast rate, making levelling climbing a joke. An easy fix
// could be disabling climbing during overworld travel." - and Sahh, of House R'is: "disabling climbing during overworld
// travel would also reduce the mortality rate of travellers falling from mountains at 60x speed").
// `01-Overview/Field-Bugs-2026-10-07b.md`.
//
// At x60 the motor's fixed step is a second of game time (systems/timeScale.js: the step scales, the count does not),
// so the climb's 0.77 s start and 0.82 s checks fell due every step or two - a roll and a Climbing tally each - and a
// storey went by in a step. Nothing climbs while a journey or the keys' travel runs: the motor's `travelling` (the
// world host's wildTravelling) is a third thing that holds no wall, beside levitation and the saddle.
//
// Fixtures from the producers: a character from chargen, the motor the world host builds - motorStats, climbingDeps,
// parkourDeps - and the time scale the travel sets.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SKILLS } from '../src/systems/skills.js';
import { createCharacter } from '../src/systems/chargen.js';
import { buildCustomCareer } from '../src/systems/customClass.js';
import { PlayerMotor } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { motorStats, climbingDeps, parkourDeps } from '../src/scenes/shared.js';
import { playerEntity } from '../src/characters/playerEntity.js';
import { setTimeScale, resetTimeScale, TRAVEL_OPEN_RATE } from '../src/systems/timeScale.js';
import { travelWalkRate } from '../src/scenes/travelView.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const CLIMB = SKILLS.Climbing;
const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const career = buildCustomCareer({
  name: 'Traveller', hp: 12, stats: STATS,
  skills: [SKILLS.Climbing, SKILLS.Running, SKILLS.Jumping, SKILLS.Swimming, SKILLS.Dodging, SKILLS.Stealth,
    SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking],
});
function traveller() {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p.skills[CLIMB] = 40;   // under 100: every use the climb rolls is tallied
  return p;
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A street, and a wall across the way (+z, the walk's way) too tall to top in the walk - a climb that only holds or
 *  lets go, the loop the report met. */
function street() {
  const col = new Collider(() => 0);
  col.addMesh('floor', [-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40], [0, 1, 2, 0, 2, 3], I);
  col.addMesh('wall', [-20, 0, 1.5, 20, 0, 1.5, 20, 400, 1.5, -20, 400, 1.5], [0, 1, 2, 0, 2, 3], I);
  return col;
}
const FORWARD = { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false, crouch: false };
const onWall = (m) => !!(m.climb?.isClimbing || m.onWall || m.mantling);

/** The world host's motor, walking into the house for `seconds` real seconds at `scale` - the classic climb, or the
 *  enhanced one on - with the host's travel answering `travelling`. Every climb roll succeeds (the most a walk farms). */
function walkInto({ scale = 1, travelling = () => false, enhanced = false, seconds = 2, p = traveller() } = {}) {
  const m = new PlayerMotor(street(), motorStats(p), {
    climbing: { ...climbingDeps(p), rolls: () => 0 },
    parkour: { ...parkourDeps(p), enabled: () => enhanced },
    travelling,
  });
  m.spawn(0, 0.05, 0);
  setTimeScale(scale);
  let holds = 0, was = false, top = 0;
  try {
    for (let i = 0; i < seconds * 60; i++) {
      m.update(1 / 60, FORWARD, 0);
      const on = onWall(m);
      if (on && !was) holds++;
      was = on;
      top = Math.max(top, m.pos[1]);
    }
  } finally { resetTimeScale(); }
  return { m, p, holds, tallies: p.skillUses[CLIMB] ?? 0, top };
}

test('CLIMB-TRAVEL: walking into a wall at the open ground\'s x60 climbed it and rolled Climbing ten times and more as often as a walk does; while a journey or the keys\' travel runs, neither climb takes the wall - no hold, no roll, not a centimetre up', () => {
  assert.equal(TRAVEL_OPEN_RATE, 60);
  for (const enhanced of [false, true]) {
    const lane = enhanced ? 'the enhanced climb' : 'the classic climb';
    // the report, measured: the same two real seconds at walking pace and at x60, nothing holding the climb
    const walked = walkInto({ enhanced });
    const farmed = walkInto({ scale: TRAVEL_OPEN_RATE, enhanced });
    assert.ok(farmed.holds >= 1 && farmed.top > 2, `${lane}: at x60 the walk climbs the wall (${farmed.holds} holds, ${farmed.top.toFixed(1)} m up)`);
    assert.ok(farmed.tallies >= 10 * Math.max(1, walked.tallies), `${lane}: and rolls Climbing ${farmed.tallies} times in two real seconds, against ${walked.tallies} at walking pace`);
    // the law: the host's travel holds both climbs
    const held = walkInto({ scale: TRAVEL_OPEN_RATE, enhanced, travelling: () => true });
    assert.equal(held.holds, 0, `${lane}: no hold while travelling`);
    assert.equal(held.tallies, 0, `${lane}: no Climbing roll while travelling`);
    assert.ok(held.top < 0.1, `${lane}: the traveller stays on the street (${held.top.toFixed(2)} m)`);
  }
});

test('CLIMB-TRAVEL: off the journey the climb is the climb it was - at walking pace the walk into the wall climbs it, in both lanes', () => {
  for (const enhanced of [false, true]) {
    const walked = walkInto({ enhanced, seconds: 4 });
    assert.ok(walked.holds >= 1 && walked.top > 1, `${enhanced ? 'the enhanced' : 'the classic'} climb takes the wall at walking pace (${walked.top.toFixed(2)} m up)`);
    assert.ok(walked.tallies >= 1, 'and rolls Climbing as it always did');
  }
});

test('CLIMB-TRAVEL: a hold already on the wall when a journey begins lets go, as a hold does when its climber levitates or mounts - in both lanes', () => {
  for (const enhanced of [false, true]) {
    let travel = false;
    const p = traveller();
    const m = new PlayerMotor(street(), motorStats(p), {
      climbing: { ...climbingDeps(p), rolls: () => 0 },
      parkour: { ...parkourDeps(p), enabled: () => enhanced },
      travelling: () => travel,
    });
    m.spawn(0, 0.05, 0);
    let f = 0;
    while (!onWall(m) && f++ < 600) m.update(1 / 60, FORWARD, 0);
    for (let i = 0; i < 30; i++) m.update(1 / 60, FORWARD, 0);
    assert.ok(onWall(m) && m.pos[1] > 0.3, `${enhanced ? 'enhanced' : 'classic'}: on the wall`);
    travel = true;
    m.update(1 / 60, FORWARD, 0);
    assert.equal(onWall(m), false, `${enhanced ? 'enhanced' : 'classic'}: the journey's first step lets go`);
  }
});

test('CLIMB-TRAVEL: the world host wires its own travel to the motor - a journey on the panel, or the keys\' travel under the view - and the keys walk at walking pace while the hands hold a wall; exterior.js (no travel) and dungeonContext.js (no motor) need nothing', () => {
  const W = read('src/scenes/world.js');
  const motorLine = W.split('\n').find((l) => l.includes('const player = new PlayerMotor(collider, motorStats(playerEntity)'));
  assert.ok(motorLine, 'the world host builds one motor (the street\'s, the dungeon\'s and a building\'s)');
  assert.match(motorLine, /travelling: \(\) => wildTravelling\(\)/, 'its travelling is the host\'s');
  assert.match(W, /const wildTravelling = \(\) => \(!!travelControlUI\?\.isShowing && !!travelOptions\?\.state\?\.autopilot\) \|\| tvWalking > 0;/,
    'a journey on the panel, or the keys\' travel');
  assert.match(W, /onFoot: walkMode && playerSpawned && !player\.isPlayerSwimming && !csaBoatUnderMe\(\) && !\(player\.climb\?\.isClimbing \|\| player\.mantling \|\| player\.onWall\),/,
    'TV-WASD: hands on a wall are not on foot');
  assert.equal(travelWalkRate({ viewUp: true, moving: true, onFoot: false, travels: true }), 0, 'and a traveller not on foot walks at walking pace');
  assert.equal(travelWalkRate({ viewUp: true, moving: true, onFoot: true, travels: true }), TRAVEL_OPEN_RATE, 'on foot, the keys travel');
  // worldModes.js drives the world host's own motor indoors (it builds none); exterior.js builds one and has no travel
  assert.doesNotMatch(read('src/scenes/worldModes.js'), /new PlayerMotor\(/);
  assert.doesNotMatch(read('src/scenes/exterior.js'), /setTimeScale|setWorldTimeScale|wildTravelling|createTravelView/);
  assert.doesNotMatch(read('src/scenes/dungeonContext.js'), /new PlayerMotor\(/);
});
