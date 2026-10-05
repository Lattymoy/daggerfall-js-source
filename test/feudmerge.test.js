// FEUD's MERGE OF MAIN (2026-10-05, bible/12-Enhanced-AI/Feud-Arc.md THE MERGE OF MAIN): the laws the merge itself
// composed, where main's AUDIT ARENA-LADDER and the arc's TELL8 had each taught the brain a new mark - a bout-mate on
// the sand (judged here, where both fighters run) and a peer it hunts (judged on the peer's own screen). One aim law
// now (ai/tactics.js targetFeet, judgedHere), and the sand's draw range reaching AUDIT TELL's shards as it reaches the
// live marks.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { setTacticsClock, resetTactics, tacticsStep, noteLocalPlayer } from '../src/ai/tactics.js';
import { resetBlows, makeBlow, setLiveBlow, shatterBlow, drawableBlows, SAND_DRAW_RANGE } from '../src/ai/foeBlows.js';
import { setPlayerBout } from '../src/characters/enemyTargets.js';

let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); setPlayerBout(null); });

/** A fighter on the sand, of `bout` and `side`, at `feet` (arenaladder_audit's own fixture). */
function fighter({ feet, side, bout = 'b1', level = 12, type = M.Orc } = {}) {
  const body = { health: 100, maxHealth: 100, mobileType: type, level, bout: { id: bout, side } };
  const ai = { inSight: true, detected: true, _dist: 1.6, feet: [...feet], stopDistance: 2.25, yaw: 0, canAct: true, _armedTargeting: true, collider: new Collider(() => 0), vitals: () => body, flee() {} };
  return { ai, entity: body };
}
/** `ai` stepped at `target` until it winds up (the roll its), as the brain steps it. */
function windUpAt(ai, target) {
  ai.target = target;
  const rnd = Math.random;
  Math.random = () => 0;
  try {
    for (let i = 0; i < 40 && ai._tac?.state !== 'windup'; i++) {
      T += 1 / 16;
      const at = target.ai?.feet ?? target.feet;
      tacticsStep(ai, at[0] - ai.feet[0], at[2] - ai.feet[2]);
    }
  } finally { Math.random = rnd; }
  return ai._tac;
}
/** Step `ai` through its landing (no chain: the roll never takes one). */
function land(ai, at) {
  const rnd = Math.random;
  Math.random = () => 0.99;
  const until = ai._tac.blow.land + 0.02;
  try { while (T < until) { T += 1 / 16; tacticsStep(ai, at[0] - ai.feet[0], at[2] - ai.feet[2]); } } finally { Math.random = rnd; }
}

test('FEUD merge FM1: a wind-up broken on the sand shatters for the stands - its shard drawn to SAND_DRAW_RANGE as its live mark was, a street\'s within the plain range (mutant: the shards\' range the plain one)', () => {
  T = 1;
  const sand = makeBlow('lunge', [0, 0, 0], 0, T); sand.sand = true;
  const road = makeBlow('lunge', [0, 0, 0], 0, T);
  const ka = {}, kb = {};
  setLiveBlow(ka, sand); setLiveBlow(kb, road);
  T = 1.2;
  shatterBlow(ka, T); shatterBlow(kb, T);
  const far = drawableBlows(T + 0.05, [90, 0, 0]);
  assert.ok(SAND_DRAW_RANGE >= 90);
  assert.deepEqual(far.map((x) => x.blow), [sand], '90 m off, on the far tier: the sand\'s shard alone');
  assert.ok(far[0].phase.shatter > 0, 'drawn shattering, not landing');
  assert.equal(drawableBlows(T + 0.05, [30, 0, 0]).length, 2, 'within the street\'s 40 m: both');
});

test('FEUD merge FM2: ONE MARK, TWO JUDGES - a bout-mate\'s landing is judged here (its verdict, its weight, `_blowFor` its key) and drawn for the stands; a hunted peer\'s is the peer\'s own (no verdict here) and no sand\'s; what a landing does to ME is mine alone (mutants: a peer judged here; the sand on a peer\'s wind-up; the landing\'s effect for a bout-mate; no `_blowFor` on a judged landing)', () => {
  noteLocalPlayer([40, 0, 40], [0, 0, 1]);   // my player, far off
  // the sand: a fighter at its bout-mate, the mate standing in its shape at the landing
  const a = fighter({ feet: [0, 0, 0], side: 0 }), b = fighter({ feet: [0, 0, 1.6], side: 1 });
  const mate = { isPlayer: false, entity: b.entity, ai: b.ai, dead: false };
  const s = windUpAt(a.ai, mate);
  assert.equal(s.state, 'windup', 'it winds up at its bout-mate');
  assert.equal(s.blow.key, mate, 'marked for the mate (AUDIT TELL B8\'s key, main\'s tg)');
  assert.equal(s.blow.sand, true, 'drawn for the stands');
  land(a.ai, b.ai.feet);
  assert.equal(a.ai._blowVerdict, true, 'judged here: the mate stood in its shape');
  assert.ok(a.ai._blowMult > 1, 'its weight carried to the swing');
  assert.equal(a.ai._blowFor, mate, 'whose verdict it is (AUDIT ARENA-LADDER 2)');
  assert.equal(a.ai._blowFx ?? null, null, 'what a landing does is the local player\'s alone (TELL6e)');
  // the street online: a foe at the peer it hunts, the peer standing in its shape at the owner's view
  resetTactics(); resetBlows(); T = 0;
  const peer = { isPlayer: true, isPeer: true, id: 'p2', owner: 'p2', feet: [0, 0, 2] };
  const ent = { health: 100, maxHealth: 100, mobileType: M.Orc, level: 12 };
  const ai = { feet: [0, 0, 0], yaw: 0, _armedTargeting: true, _dist: 2, inSight: true, detected: true, canAct: true, stopDistance: 2.25, speed: 4, vitals: () => ent };
  const s2 = windUpAt(ai, peer);
  assert.equal(s2.state, 'windup', 'it winds up at the peer');
  assert.equal(s2.blow.sand, undefined, 'a peer\'s mark is no sand\'s');
  land(ai, peer.feet);
  assert.equal(ai._blowVerdict, null, 'the peer judges its own feet (TELL8 10.3): no verdict here');
  assert.equal(ai._blowMult, undefined);
  assert.equal(ai._blowFor, undefined);
});
