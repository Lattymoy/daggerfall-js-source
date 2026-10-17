// TACT5 - THE FIRST FIELD REPORT ON THE TACTICS BRAIN (bible/12-Enhanced-AI/Tactics-Arc.md, 2026-10-02 - lumin: "New
// monster AI is painful... a little too hard. The archers that just keep kiting you in a circle"; maya: "They keep
// walking backwards"). Driven on the REAL motor and attack component over the real collider, on the brain's own clock,
// with a player who CHASES - the case the TACT2 pins never drove (their player stood still): a waiting foe walked up to
// fights instead of backpedalling ahead of him; the step back after a blow is a hop; a hurt foe and a kiting archer
// turn and walk the way they face, once a cooldown; caught, the archer fights hand to hand; a shooter without a token
// stands off and never circles.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { Collider } from '../../../src/player/collider.js';
import { EnemyAI } from '../../../src/characters/enemy/enemyMotor.js';
import { EnemyAttack } from '../../../src/characters/enemy/enemyAttack.js';
import { MOBILE_TYPES as M } from '../../../src/characters/mobile/mobileTypes.js';
import { TACT, setTacticsClock, resetTactics, tokensOut, LOCAL_TARGET, tacticsStep } from '../../../src/ai/tactics.js';

const DT = 1 / 60;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); T = 0; setPref('enhancedAI', true); });

function foe(c, at, { type = M.Orc, bow = false, health = 80 } = {}) {
  const body = { health, maxHealth: health, mobileType: type };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => body, hasBowAttack: bow });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  atk.rangedAttack = bow;
  return { ai, atk, body, swings: 0, shots: 0, backpedal: 0, longestBack: 0, run: 0, faceWrong: 0, circled: 0, bursts: 0, wasKiting: false };
}
const flat = (f, p) => Math.hypot(f.ai.feet[0] - p[0], f.ai.feet[2] - p[2]);

/** Frames against a player at `player` (moved by `move(player, i)` each frame, if given), tallying each foe's blows
 *  and shots, its BACKPEDALLING (a brain step away from the player while facing him) and any retreat's step whose
 *  facing is more than 46 degrees off its way. */
function run(foes, secs, player, { move = null, each = null } = {}) {
  const cosFace = Math.cos(46 * Math.PI / 180);   // the law's own bound (45 degrees, and a degree's slack) - not the table's
  for (let i = 0; i < Math.round(secs / DT); i++) {
    T += DT;
    move?.(player, i);
    for (const f of foes) {
      f.ai.update(DT, player);
      const s0 = f.atk.swingSeq;
      f.atk.update(DT, f.ai, player);
      if (f.atk.swingSeq !== s0) { if (f.atk.firedRanged) f.shots++; else f.swings++; }
      const d = f.ai._tacDir;
      const tx = player[0] - f.ai.feet[0], tz = player[2] - f.ai.feet[2], tl = Math.hypot(tx, tz) || 1;
      const fx = Math.sin(f.ai.yaw), fz = Math.cos(f.ai.yaw);
      if (d && f.ai.moving) {
        const away = (d[0] * tx + d[1] * tz) / tl < -0.5;
        if (away && (fx * tx + fz * tz) / tl > 0) { f.backpedal += DT; f.run += DT; f.longestBack = Math.max(f.longestBack, f.run); } else f.run = 0;
        if (away && fx * d[0] + fz * d[1] < cosFace && (f.ai._tac?.kiting || f.ai._tac?.state === 'backoff')) f.faceWrong++;
        if (!away && f.ai._tac?.kind === 'ranged') f.circled++;
      } else f.run = 0;
      const k = !!f.ai._tac?.kiting;
      if (k && !f.wasKiting) f.bursts++;
      f.wasKiting = k;
    }
    each?.(i);
  }
}
/** The player walks at `speed` toward `f`, stopping `near` short of it. */
const chase = (f, speed, near = 1.6) => (p) => {
  const dx = f.ai.feet[0] - p[0], dz = f.ai.feet[2] - p[2], l = Math.hypot(dx, dz);
  if (l <= near) return;
  const k = Math.min(speed * DT, l - near) / l;
  p[0] += dx * k; p[2] += dz * k;
};

test('TACT5: a waiting foe the player walks up to fights him - it does not backpedal ahead of him round the room', () => {
  const c = new Collider(() => 0);
  const foes = [0, 1, 2].map((i) => foe(c, [Math.sin(i * 2.094) * 10, 0, Math.cos(i * 2.094) * 10]));
  for (const f of foes) f.atk.update = () => 0;   // the two holders never swing: their tokens stay out, the third waits
  const player = [0, 0, 0];
  run(foes, 4, player);
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), TACT.MELEE_TOKENS);
  const waiter = foes.find((f) => f.ai._tac?.state === 'wait');
  assert.ok(waiter, 'a foe waiting on the ring');
  delete waiter.atk.update;   // the waiter's own blows are real
  const start = flat(waiter, [0, 0, 0]);
  waiter.backpedal = 0;
  let first = null;
  run(foes, 4, player, { move: chase(waiter, 4), each: (i) => { if (first == null && waiter.swings > 0) first = (i + 1) * DT; } });
  assert.ok(waiter.swings >= 1, `walked up to, it fought (${waiter.swings} blows)`);
  assert.ok(first < 1.2, `at once - not on its patience clock (${first?.toFixed(2)} s)`);
  assert.ok(waiter.backpedal <= TACT.RECOVER_HOP * (waiter.swings + 1) + 0.1, `no retreat ahead of him (${waiter.backpedal.toFixed(2)} s backing for ${waiter.swings} blows)`);
  assert.ok(flat(waiter, [0, 0, 0]) < start + 3, `it held its ground (${start.toFixed(1)} -> ${flat(waiter, [0, 0, 0]).toFixed(1)} m from where he stood)`);
});

test('TACT5: after its blow a holder hops out - pressed, it never backs off longer than the hop, and keeps fighting', () => {
  const c = new Collider(() => 0);
  const f = foe(c, [0, 0, 6]);
  const player = [0, 0, 0];
  run([f], 12, player, { move: chase(f, 5, 1.8) });
  assert.ok(f.swings >= 3, `it kept fighting (${f.swings} blows)`);
  assert.ok(f.longestBack <= TACT.RECOVER_HOP + 0.07, `a hop, not a retreat (longest ${f.longestBack.toFixed(2)} s)`);
});

test('TACT5: a hurt foe turns and walks away the way it faces - and backs off at most once a cooldown', () => {
  const c = new Collider(() => 0);
  const f = foe(c, [0, 0, 6]);
  const player = [0, 0, 0];
  run([f], 3, player);
  f.body.health -= f.body.maxHealth * 0.3;
  run([f], 0.2, player);
  assert.equal(f.ai._tac.state, 'backoff');
  f.backpedal = 0;
  run([f], TACT.BACKOFF, player);
  assert.ok(flat(f, player) > 2.25 + TACT.RING_GAP, `it got out (${flat(f, player).toFixed(2)})`);
  assert.equal(f.faceWrong, 0, 'it walked the way it faced');
  assert.equal(f.backpedal, 0, 'never backwards');
  // hurt again inside the cooldown: it fights on
  run([f], 1, player);
  f.body.health -= f.body.maxHealth * 0.3;
  run([f], 0.3, player);
  assert.notEqual(f.ai._tac.state, 'backoff', 'once a cooldown');
  // ...and past it, it may back off again
  run([f], TACT.BACKOFF_COOLDOWN, player);
  f.body.health -= f.body.maxHealth * 0.3;
  run([f], 0.3, player);
  assert.equal(f.ai._tac.state, 'backoff', 'the cooldown spent');
});

test('TACT5: a kiting archer turns its back and walks; chased down, it fights hand to hand and does not kite again inside its cooldown', () => {
  const c = new Collider(() => 0);
  const f = foe(c, [0, 0, 5], { type: M.Archer, bow: true });
  const player = [0, 0, 0];
  run([f], 7, player, { move: chase(f, 6, 1.6) });
  assert.equal(f.bursts, 1, `one burst in the cooldown (${f.bursts})`);
  assert.equal(f.faceWrong, 0, 'it walked the way it faced');
  assert.ok(f.swings >= 1, `caught, it fought hand to hand (${f.swings} blows)`);
  assert.ok(f.backpedal <= TACT.RECOVER_HOP * f.swings + 0.1, `backwards only for the hop after a blow (${f.backpedal.toFixed(2)} s for ${f.swings} blows)`);
  assert.equal(f.ai._tac.kind, 'melee', 'inside its bow band, its kite spent, it is a melee fighter');
  // the player out past the band again (a sprint, a blink): it is an archer again
  player[2] -= 12;
  run([f], 0.3, player);
  assert.ok(flat(f, player) >= TACT.KITE_IN);
  assert.equal(f.ai._tac.kind, 'ranged');
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 0, 'its melee token handed back');
});

test('TACT5: an archer stands off - with a token or without, walked up to or not, it never circles the player', () => {
  const c = new Collider(() => 0);
  const foes = [0, 1, 2].map((i) => foe(c, [Math.sin(i * 2.094) * 20, 0, Math.cos(i * 2.094) * 20], { type: M.Archer, bow: true }));
  const player = [0, 0, 0];
  run(foes, 2, player);
  const waiter = foes.find((f) => f.ai._tacShoot === false);
  assert.ok(waiter, 'one archer holds no token');
  // its ring slot (TACT2's, a random angle) a quarter turn round from where it stands - the case that circled
  waiter.ai._tac.slot = Math.atan2(waiter.ai.feet[0] - player[0], waiter.ai.feet[2] - player[2]) + Math.PI / 2;
  run(foes, 8, player, { move: chase(waiter, 4, 5.6) });   // he walks up to just inside its bow band's near edge, and stays
  for (const f of foes) assert.equal(f.circled, 0, `no step round the player (${foes.map((x) => x.circled)})`);
  run(foes, 20, player);
  assert.ok(foes.filter((f) => f.shots > 0).length >= 2, `and they take their shots (${foes.map((x) => x.shots)})`);
});

test('TACT5: a shooter turned melee fighter hands back its melee token the moment it is an archer again', () => {
  const ai = { inSight: true, detected: true, _dist: 3, feet: [0, 0, -3], stopDistance: 2.25, yaw: 0, _armedTargeting: false, hasBowAttack: true, flee() {} };
  tacticsStep(ai, 0, 1);
  assert.equal(ai._tac.kiting, true, 'inside the band, its kite ready: it kites');
  ai._tac.kiting = false; ai._tac.kiteReady = T + TACT.KITE_COOLDOWN;   // its kite spent
  T += 0.1; tacticsStep(ai, 0, 1);
  assert.equal(ai._tac.kind, 'melee');
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 1);
  ai._dist = 20; ai.feet = [0, 0, -20];
  T += 0.1; tacticsStep(ai, 0, 1);
  assert.equal(ai._tac.kind, 'ranged');
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 0, 'no melee token held by an archer');
  assert.equal(tokensOut(LOCAL_TARGET, 'ranged'), 1);
});

test('TACT5: an archer whose walk out meets a wall is cornered at once - it fights, not walking into the wall out its burst', () => {
  const c = new Collider(() => 0);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  c.addMesh('wall', new Float32Array([-5, 0, 4.6, 5, 0, 4.6, 5, 4, 4.6, -5, 4, 4.6]), new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]), I);
  const f = foe(c, [0, 0, 4], { type: M.Archer, bow: true });
  const player = [0, 0, 0];
  let cornered = null, slid = 0;
  run([f], TACT.KITE_MAX, player, { each: (i) => {
    if (cornered == null && f.ai._tac?.kind === 'melee') cornered = (i + 1) * DT;
    slid = Math.max(slid, Math.abs(f.ai.feet[0]));
  } });
  assert.ok(cornered != null && cornered < TACT.KITE_MAX * 0.6, `cornered by the wall, not the clock (${cornered?.toFixed(2)} s)`);
  assert.ok(slid < 0.2, `it turned to fight - no classic detour along the wall (${slid.toFixed(2)} m)`);
});

test('TACT5: left alone, an archer inside its bow band\'s near edge walks out PAST the edge, turns, and shoots', () => {
  const c = new Collider(() => 0);
  const f = foe(c, [0, 0, 5.5], { type: M.Archer, bow: true });
  const player = [0, 0, 0];
  let far = 0;
  run([f], 3, player, { each: () => { far = Math.max(far, flat(f, player)); } });
  assert.ok(far >= TACT.KITE_OUT - 0.05, `out past the edge (${far.toFixed(2)} m)`);
  assert.equal(f.faceWrong, 0, 'it walked the way it faced');
  run([f], 15, player);
  assert.ok(f.shots > 0, `and shot (${f.shots})`);
  assert.equal(f.swings, 0, 'from its stand-off, never walking back in to swing');
});
