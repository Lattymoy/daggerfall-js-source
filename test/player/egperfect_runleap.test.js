// EG-PERFECT (2026-10-18, Mac: "I want to ensure the boss attacks, the design of the halls, and everything is absolutely
// perfect. Traversing between sections should present a challenge, platforming should be detailed"; bible/11-Multiplayer/
// Elite-Gates.md section 10.5, THE TIMED SOLVER): THE RUNNING LEAP REFUSED ON THE PROVEN WAYS. The enhanced climb is forced on
// online (systems/features.js `enhanced-climbing`, scenes/shared.js parkourSwitchOn), and a running Jump with the floor ending
// within PARKOUR_RUNLEAP_EDGE became CLIMB3's running leap (player/motor.js _pkRunLeapSpeeds) - at Jumping 100 it flew over
// the platform the solver proved the plain jump lands on. The made level's law (systems/madeLevel.js `runLeap`) refuses it
// on the Spire and in the Hour, through the four hosts' one parkour deps (scenes/shared.js parkourDeps `leap`), at the motor's
// one door (_pkMayLeap - the leap at the edge and its late press); the wall run stays. Fixtures from the producers: a
// character from chargen, the deps the hosts hand the motor.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS } from '../../src/systems/skills.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { PlayerMotor, registerJumpForgiveness } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { parkourDeps } from '../../src/scenes/shared.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { registerMadeLevelHere, madeRuleHere, madeLevelRule } from '../../src/systems/madeLevel.js';

const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const career = buildCustomCareer({
  name: 'Leaper', hp: 12, stats: STATS,
  skills: [SKILLS.Jumping, SKILLS.Climbing, SKILLS.Running, SKILLS.Swimming, SKILLS.Dodging, SKILLS.Stealth,
    SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking],
});
/** A character from chargen at Jumping `jumping`. */
function leaper(jumping) {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p.skills[SKILLS.Jumping] = jumping;
  p.skills[SKILLS.Climbing] = 0;
  return p;
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A box's twelve triangles into bucket `key`. */
function box(col, key, x0, y0, z0, x1, y1, z1) {
  const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const out = [];
  for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) { const [a, b, c, d] = f.map((i) => P[i]); out.push(...a, ...b, ...c, ...a, ...c, ...d); }
  const pos = new Float32Array(out), idx = new Uint16Array(pos.length / 3);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  col.addMesh(key, pos, idx, I);
}
const here = (lv) => registerMadeLevelHere(() => lv);
/**
 * A SPAN'S PAIR on the real motor at THE SPAN BUILD's pace (Speed 10, Running 0 - section 10.2), the hosts' parkour deps on as
 * online forces them: a run-up ending at z 0, a gap of 2.4 m (THE ENVELOPE's least) and a 2.6 m platform after it (a Crumble's
 * depth). The run's Jump pressed `pressAt` metres short of the edge, or - `late` frames - after the feet left it. Answers
 * the bucket the body first stands on after the press (null: it fell past the platform) and how far it flew.
 */
function pair(p, { pressAt = 0, late = -1 } = {}) {
  const col = new Collider(() => -Infinity);
  box(col, 'runup', -1.5, -0.5, -12, 1.5, 0, 0);
  box(col, 'landing', -1.5, -0.5, 2.4, 1.5, 0, 5.0);
  const m = new PlayerMotor(col, { speed: 10, running: 0, swimming: 30 }, { parkour: { ...parkourDeps(p), enabled: () => true } });
  m.spawn(0, 0.05, -8);
  for (let k = 0; k < 30; k++) m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false }, 0, 0);
  let pressed = false, off = null, at = 0, maxZ = -Infinity;
  for (let k = 0; k < 600; k++) {
    if (off == null && !m.grounded && m.pos[2] > 0) off = k;
    const go = !pressed && (late < 0 ? m.pos[2] >= -pressAt : off != null && k >= off + late);
    m.update(1 / 60, { forward: pressed ? 0 : 1, strafe: 0, run: true, jump: go, up: false, down: false }, 0, 0);
    if (go) { pressed = true; at = k; }
    maxZ = Math.max(maxZ, m.pos[2]);
    if (pressed && m.grounded && k > at + 3) return { on: m.groundKey, flew: maxZ };
    if (m.pos[1] < -6) break;
  }
  return { on: null, flew: maxZ };
}

test('EG-PERFECT THE RUNNING LEAP REFUSED (section 10.5; systems/madeLevel.js `runLeap`): on the Spire and in the Hour a running Jump at a span\'s edge - pressed at the edge or 0.6 m short of it - is THE SPAN BUILD\'s plain jump and lands on the platform the solver proved, at Jumping 0 and at Jumping 100; with no made level (or the court) the enhanced climb\'s running leap flies on as CLIMB3 made it - at Jumping 100 clean over the platform; the deps every host hands the motor carry the law\'s word (mutants: the rule dropped from either row; the motor deaf to `leap`; the deps\' word inverted)', () => {
  assert.equal(madeLevelRule('spire', 'runLeap'), 'refused');
  assert.equal(madeLevelRule('hour', 'runLeap'), 'refused');
  assert.equal(madeLevelRule('court', 'runLeap'), null, 'the court has no course: the leap as the game has it');
  const fast = leaper(100), slow = leaper(0);
  try {
    for (const lv of ['spire', 'hour']) {
      here(lv);
      assert.equal(parkourDeps(fast).leap(), false, `${lv}: the deps say no leap`);
      for (const [p, name] of [[fast, 'Jumping 100'], [slow, 'Jumping 0']]) for (const pressAt of [0, 0.6]) {
        const r = pair(p, { pressAt });
        assert.equal(r.on, 'landing', `${lv}, ${name}, pressed ${pressAt} m short: the plain jump lands on the platform (flew to ${r.flew.toFixed(2)})`);
        assert.ok(r.flew < 2.6, `${lv}, ${name}: a plain jump's flight (${r.flew.toFixed(2)} m), never the leap's`);
      }
    }
    for (const lv of [null, 'court']) {
      here(lv);
      assert.equal(parkourDeps(fast).leap(), true, `${lv}: the deps leave the leap`);
      const r = pair(fast);
      assert.equal(r.on, null, `${lv}: the running leap at Jumping 100 flies clean over the platform (to ${r.flew.toFixed(2)} m)`);
      assert.ok(r.flew > 8, `${lv}: CLIMB3's leap, as it was (${r.flew.toFixed(2)} m)`);
      const s = pair(slow);
      assert.equal(s.on, 'landing');
      assert.ok(s.flew > 3.5, `${lv}: at Jumping 0 the leap still carries past the plain jump (${s.flew.toFixed(2)} m)`);
    }
  } finally { registerMadeLevelHere(null); }
});

test('EG-PERFECT THE LATE PRESS REFUSED WITH IT (section 10.8): a Jump a beat after running off a span\'s edge was CLIMB3\'s late press - the leap again; on the Spire it is no leap, and with the Spire\'s own forgiveness wired as the world host wires it (registerJumpForgiveness, the made level\'s `latePress`) it is the plain jump, and lands on the platform; with no made level the late press still leaps (mutants: the late press left to the leap; the forgiveness unread)', () => {
  const fast = leaper(100);
  try {
    registerJumpForgiveness(() => madeRuleHere('jumpBuffer'), () => madeRuleHere('latePress'));
    here('spire');
    const r = pair(fast, { late: 3 });
    assert.equal(r.on, 'landing', `the Spire: the late press is the forgiven plain jump (flew to ${r.flew.toFixed(2)})`);
    assert.ok(r.flew < 3.5, `a plain jump's flight from just past the edge (${r.flew.toFixed(2)} m)`);
    here(null);
    const w = pair(fast, { late: 3 });
    assert.equal(w.on, null, 'no made level: the late press leaps as CLIMB3 made it');
    assert.ok(w.flew > 8);
  } finally { registerJumpForgiveness(null, null); registerMadeLevelHere(null); }
});

test('EG-PERFECT THE WALL RUN KEPT (Elite-Gates-Ascent.md section 4, "Climbing is never asked" no longer): with the leap refused on the Spire a running Jump at a Riser\'s 2.3 m face still runs up it and stands on its top at Climbing 0 - the refusal touches the leap alone (mutant: the whole parkour lane refused)', () => {
  const p = leaper(0);
  try {
    here('spire');
    const col = new Collider(() => -Infinity);
    box(col, 'runup', -1.5, -0.5, -12, 1.5, 0, 0);
    box(col, 'riser', -1.5, -0.5, 0, 1.5, 2.3, 2.6);
    const m = new PlayerMotor(col, { speed: 10, running: 0, swimming: 30 }, { parkour: { ...parkourDeps(p), enabled: () => true } });
    m.spawn(0, 0.05, -6);
    let up = false;
    for (let k = 0; k < 6 * 60 && !up; k++) {
      const go = m.pos[2] >= -0.8;
      m.update(1 / 60, { forward: 1, strafe: 0, run: true, jump: go, up: false, down: false }, 0, 0);
      up = m.grounded && m.groundKey === 'riser' && m.pos[1] > 2.2;
    }
    assert.ok(up, 'run up the riser and stood on its top');
  } finally { registerMadeLevelHere(null); }
});
