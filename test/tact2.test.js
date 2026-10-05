// TACT2 - THE TACTICS BRAIN (bible/12-Enhanced-AI/Tactics-Arc.md; Mac, 2026-10-02: "enemy tactics like backing off
// and knowing when to strike"; his calls: 2 melee + 2 ranged tokens; animals and cowardly humans flee, undead,
// daedra, constructs and guards never). Driven on the REAL motor and the REAL attack component over the real collider,
// on the brain's own clock: with the switch on, a crowd takes turns - two in, the rest on the ring, each blow followed
// by a step back and the token handed on, a wounded foe backing off, a coward running, an archer kiting, a back
// turned taken; with the switch off, DFU's pile-in to the bit.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import {
  TACT, setTacticsClock, resetTactics, tokensOut, LOCAL_TARGET, isCoward, noteLocalPlayer, tacticsStep, releaseTactics,
  targetKey, COWARD_CLASSES,
} from '../src/ai/tactics.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); T = 0; setPref('enhancedAI', true); });

/** N foes on a 10 m circle round the player at the origin, each with an attack component and a body. */
function crowd(n, { r = 10, mobileType = MOBILE_TYPES.Orc, health = 50, bow = false } = {}) {
  const c = new Collider(() => 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const feet = [Math.sin(a) * r, 0, Math.cos(a) * r];
    const body = { health, maxHealth: health, mobileType };
    const ai = new EnemyAI(c, feet, Math.atan2(-feet[0], -feet[2]), { vitals: () => body, hasBowAttack: bow });
    const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
    atk.rangedAttack = bow;   // as the hosts set it (hasBowAttack(basics))
    out.push({ ai, atk, body, swings: 0 });
  }
  return out;
}
const flat = (f) => Math.hypot(f.ai.feet[0], f.ai.feet[2]);
/** Run `secs` of frames against a player standing at `player`, a hook each frame. */
function run(foes, secs, { player = [0, 0, 0], each = null } = {}) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    for (const f of foes) {
      f.ai.update(DT, player);
      const before = f.atk.swingSeq;
      f.atk.update(DT, f.ai, player);
      if (f.atk.swingSeq !== before) f.swings++;
    }
    each?.(s);
  }
}

test('TACT2: who runs - animals and the cowardly classes; never the watch, undead, daedra or constructs', () => {
  assert.equal(isCoward(MOBILE_TYPES.Rat), true);
  assert.equal(isCoward(MOBILE_TYPES.GrizzlyBear), true);
  for (const n of ['Mage', 'Sorcerer', 'Healer', 'Bard', 'Burglar', 'Acrobat', 'Thief']) assert.equal(isCoward(MOBILE_TYPES[n]), true, n);
  for (const n of ['Knight_CityWatch', 'Warrior', 'Knight', 'Barbarian', 'SkeletalWarrior', 'Zombie', 'Lich', 'FireDaedra', 'DaedraLord', 'IronAtronach', 'Orc', 'Giant']) assert.equal(isCoward(MOBILE_TYPES[n]), false, n);
  assert.equal(COWARD_CLASSES.size, 7);
  assert.equal(TACT.MELEE_TOKENS, 2, 'Mac: 2 melee');
  assert.equal(TACT.RANGED_TOKENS, 2, '...and 2 ranged');
});

test('TACT2: five foes take turns - never more than two holding a melee token, the rest on the ring and not swinging, and every one of them gets its blows in', () => {
  const foes = crowd(5);
  let maxTokens = 0, ringBreaches = 0;
  run(foes, 25, {
    each: () => {
      maxTokens = Math.max(maxTokens, tokensOut(LOCAL_TARGET, 'melee'));
      for (const f of foes) {
        const st = f.ai._tac?.state;
        if (st === 'wait' && flat(f) < 2.25 + TACT.RING_GAP - TACT.RING_SLACK - 0.6) ringBreaches++;
      }
    },
  });
  assert.equal(maxTokens, TACT.MELEE_TOKENS, 'two out, never three');
  assert.equal(ringBreaches, 0, 'a waiting foe keeps off the player');
  for (const f of foes) assert.ok(f.swings >= 3, `each takes its turn (${foes.map((x) => x.swings)})`);
});

test('TACT2: the switch off - every foe piles in to reach and swings on DFU\'s clock; the brain leaves no state', () => {
  setPref('enhancedAI', false);
  const foes = crowd(5);
  run(foes, 15);
  for (const f of foes) {
    assert.ok(flat(f) <= 2.3, `in to reach (${flat(f).toFixed(2)})`);
    assert.equal(f.ai._tac ?? null, null);
    assert.equal(f.ai._tacDir, null);
    assert.equal(f.ai._tacStrike, undefined);
    assert.ok(f.swings >= 3);
  }
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 0);
});

test('TACT2: after its blow a holder stands it, steps back to the ring and hands the token on - the longest waiter goes next', () => {
  const foes = crowd(3);
  const order = [];
  let last = null;
  run(foes, 20, {
    each: () => {
      for (const f of foes) if (f.ai._tac?.state === 'engage' && last !== f) { order.push(foes.indexOf(f)); last = f; }
    },
  });
  const seen = new Set(order);
  assert.equal(seen.size, 3, `all three were sent in (${order})`);
  // a recovering foe steps out
  const f = foes[0];
  let recovered = false;
  run(foes, 10, { each: () => { if (f.ai._tac.state === 'recover' && flat(f) > 3) recovered = true; } });
  assert.ok(recovered, 'it backs out to the ring after its blow');
});

test('TACT2: patience - a foe kept waiting past its patience goes in whatever the tokens say', () => {
  const foes = crowd(4);
  run(foes, 3);
  // freeze two holders as holders forever (they never swing): the waiters must still get a turn
  const holders = foes.filter((f) => f.ai._tac?.state === 'engage' || f.ai._tac?.state === 'swing');
  assert.ok(holders.length >= 1);
  for (const h of foes) h.atk.update = () => 0;   // nobody's blow lands: tokens are never handed on
  let forced = 0;
  run(foes, TACT.PATIENCE + 3, { each: () => { forced = Math.max(forced, tokensOut(LOCAL_TARGET, 'melee')); } });
  assert.ok(forced > TACT.MELEE_TOKENS, `the patient ones went in anyway (${forced} out)`);
});

test('TACT2: a foe that loses a quarter of its health in a moment backs off and comes back later', () => {
  const foes = crowd(1);
  const f = foes[0];
  run(foes, 3);
  assert.ok(f.swings >= 1, 'in and fighting');
  f.body.health -= f.body.maxHealth * 0.3;
  run(foes, 0.3);
  assert.equal(f.ai._tac.state, 'backoff');
  run(foes, 1.2);
  assert.ok(flat(f) > 2.25 + TACT.RING_GAP, `out of reach (${flat(f).toFixed(2)})`);
  run(foes, TACT.BACKOFF + 2);
  assert.notEqual(f.ai._tac.state, 'backoff', 'and back in the fight');
});

test('TACT2: a coward near death runs; a guard, an orc and the undead fight on', () => {
  for (const [type, runs] of [[MOBILE_TYPES.Thief, true], [MOBILE_TYPES.Rat, true], [MOBILE_TYPES.Knight_CityWatch, false], [MOBILE_TYPES.Orc, false], [MOBILE_TYPES.Zombie, false]]) {
    resetTactics();
    const foes = crowd(1, { mobileType: type });
    run(foes, 2);
    foes[0].body.health = foes[0].body.maxHealth * 0.1;
    run(foes, 0.5);
    assert.equal(foes[0].ai.fleeLeft > 0, runs, `mobile ${type}`);
  }
});

test('TACT2: an archer with a token backs off a target closing inside its stand-off; without one it holds its shot', () => {
  const foes = crowd(1, { bow: true, r: 3.5 });
  const f = foes[0];
  run(foes, 1.5);
  assert.ok(flat(f) > 3.5, `it stepped back (${flat(f).toFixed(2)})`);
  assert.equal(tokensOut(LOCAL_TARGET, 'ranged'), 1);
  resetTactics();
  const three = crowd(3, { bow: true, r: 20 });
  // AUDIT PRE-MERGE 1003 (CI, #556): the law on EVERY frame of the two seconds, not the count at their last - a holder
  // hands its token on (its shot loosed, its target lost) and another takes it the next frame, so the count dips for a
  // frame by design, and one instant read it 1 in ~40 runs (the same 10 of 400 seeded runs on main's, the PR's and this
  // tree): never more than RANGED_TOKENS out, all of them taken, and while they are the third holds its fire
  // AUDIT PRE-MERGE 1003b M3: and the tokens STILL HELD at the end - the per-frame law alone let an archer that never took
  // a token again after its first shot pass (20 runs of 20); six seconds, and the last three frames' best is both
  // tokens out (a hand-on dips for one frame by design, so three frames tolerate it: 0 failures in 160 seeded runs)
  const outs = [];
  run(three, 6, { each: () => {
    const out = tokensOut(LOCAL_TARGET, 'ranged');
    assert.ok(out <= TACT.RANGED_TOKENS, `${out} ranged tokens out`);
    outs.push(out);
    if (out === TACT.RANGED_TOKENS) assert.equal(three.filter((x) => x.ai._tacShoot === false).length, 1, 'the third holds its fire');
  } });
  assert.equal(Math.max(...outs), TACT.RANGED_TOKENS, 'both tokens taken');
  assert.equal(Math.max(...outs.slice(-3)), TACT.RANGED_TOKENS, 'and held at the end');
});

test('TACT2: a turned back is an opening - a waiting foe within reach of the ring strikes', () => {
  const foes = crowd(4);
  run(foes, 4);
  let waiter = null;
  for (let i = 0; i < 600 && !waiter; i++) { run(foes, DT); waiter = foes.find((f) => f.ai._tac?.state === 'wait' && f.ai._tacStrike === false && flat(f) > 3) ?? null; }
  assert.ok(waiter, 'a foe waiting on the ring');
  // the player faces straight AWAY from the waiter
  const away = [-waiter.ai.feet[0], 0, -waiter.ai.feet[2]];
  noteLocalPlayer([0, 0, 0], away);
  let went = false;
  run(foes, 0.3, { each: () => { if (waiter.ai._tacStrike === true || waiter.ai._tac.state === 'swing') went = true; } });
  assert.ok(went, `the back is turned: it goes in (${waiter.ai._tac.state} at ${flat(waiter).toFixed(2)})`);
  noteLocalPlayer([0, 0, 0], [waiter.ai.feet[0], 0, waiter.ai.feet[2]]);
});

test('TACT2: the board - one key for the local player, its own for a foe target; a holder unseen goes stale, and release frees all', () => {
  const ai = { _armedTargeting: false, target: null };
  assert.equal(targetKey(ai), LOCAL_TARGET);
  const foeTarget = { isPlayer: false };
  assert.equal(targetKey({ _armedTargeting: true, target: foeTarget }), foeTarget);
  assert.equal(targetKey({ _armedTargeting: true, target: { isPlayer: true, isPeer: true, owner: 'p-2' } }), 'p-2');
  const foes = crowd(2);
  for (const f of foes) f.atk.update = () => 0;   // no blows: the tokens stay where they went
  run(foes, 3);
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 2);
  releaseTactics(foes[0].ai);
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 1);
  // the other stops being ticked (despawned) - the next foe's turn prunes it
  const third = crowd(1);
  T += TACT.STALE + 0.1;
  run(third, 0.2);
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 1, 'only the live one');
});

test('TACT2: the brain only steers a foe that sees its target in range - out of sight it leaves the pursuit to the motor', () => {
  const foes = crowd(1, { r: TACT.ENGAGE_RANGE + 6 });
  run(foes, 0.3);
  assert.equal(foes[0].ai._tacStrike, undefined);
  assert.equal(tacticsStep({ _dist: Infinity, inSight: false, feet: [0, 0, 0] }, 1, 0), false);
});

test('TACT2: the motor and the attack read the brain - the step, the stand, the gates; the hosts hand the vitals and the player\'s facing', () => {
  const m = rd('src/characters/enemyMotor.js');
  // PIN MOVED (TELL6, bible/12-Enhanced-AI/Feud-Arc.md 8.1): a charge's run is never the detour's either
  assert.match(m, /const _took = tacticsStep\(this, dx, dz\);\n\s*if \(_took && \(!detouring \|\| this\.fleeLeft > 0 \|\| this\._tac\?\.state === 'windup' \|\| this\._tac\?\.state === 'dash'\)\) return;[^\n]*\n\s*this\._tacDir = null;\n\s*\/\/ Ranged attacks/);
  assert.match(m, /if \(this\._tacDir\) \{ this\._tacDir = null; this\._tacBlocked = true; this\.moving = false; \}[^\n]*\n\s*else this\._findDetour\(dir2d\);/);
  const a = rd('src/characters/enemyAttack.js');
  assert.match(a, /if \(ai\._tacStrike === false\) continue;/);
  assert.match(a, /&& ai\._tacShoot !== false && this\.rolls\(\) < BOW_SHOT_CHANCE\)/);
  assert.match(a, /ai\._tacSwung = \(ai\._tacSwung \?\? 0\) \+ 1;/);
  const c = rd('src/characters/enemyCasting.js');
  assert.match(c, /if \(ai\._tacShoot === false\) continue;/);
  assert.match(c, /dist <= MELEE_DISTANCE && ai\._tacStrike !== false\)/);
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) assert.match(rd(f), /vitals: \(\) => entity,/, f);
  assert.equal((rd('src/scenes/dungeonContext.js').match(/vitals: \(\) => entity,/g) ?? []).length, 2);
  assert.match(rd('src/scenes/world.js'), /noteLocalPlayer\(walkMode && playerSpawned \? player\.pos : cam\.pos, fwd\);/);
});

/** A bare foe for the board's own law: in sight, at `d` from the target, ahead along +z. */
const stub = (d = 3.4) => ({ inSight: true, detected: true, _dist: d, feet: [0, 0, -d], stopDistance: 2.25, yaw: 0, _armedTargeting: false, flee() {} });

test('TACT2: a freed token goes to the foe that has waited longest, not to whoever asks first', () => {
  const [a, b, c, d] = [stub(), stub(), stub(), stub()];
  const live = [];
  for (const [t, who] of [[0, a], [1, b], [2, c], [3, d]]) {   // each joins in turn; the ones already there keep ticking
    T = t; live.push(who);
    for (const x of live) tacticsStep(x, 0, 1);
  }
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 2);
  assert.equal(a._tacStrike, true); assert.equal(b._tacStrike, true);
  assert.equal(c._tacStrike, false); assert.equal(d._tacStrike, false);
  releaseTactics(a);
  a.inSight = false;   // it has gone
  T = 4; tacticsStep(b, 0, 1); tacticsStep(d, 0, 1);
  assert.equal(d._tacStrike, false, 'd asks first, but c has waited longer');
  tacticsStep(c, 0, 1);
  assert.equal(c._tacStrike, true, 'c goes in');
});

test('TACT2: a foe that does not SEE its target - a wall between - is left to the motor\'s pursuit, holding no token', () => {
  const c = new Collider(() => 0);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  c.addMesh('wall', new Float32Array([-5, 0, 3, 5, 0, 3, 5, 4, 3, -5, 4, 3]), new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]), I);
  const body = { health: 50, maxHealth: 50, mobileType: MOBILE_TYPES.Orc };
  const ai = new EnemyAI(c, [0, 0, 6], Math.PI, { vitals: () => body });
  ai.makeHostileToPlayer();
  for (let i = 0; i < 60; i++) { T += DT; ai.update(DT, [0, 0, 0]); }
  assert.equal(ai.inSight, false, 'the wall hides him');
  assert.equal(ai._tacStrike, undefined);
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 0);
});

test('TACT2: a holder stands its blow where it struck - it does not back out mid-swing', () => {
  const foes = crowd(1);
  const f = foes[0];
  let at = null, drift = 0, stretch = 0, longest = 0;
  run(foes, 8, {
    each: () => {
      if (f.ai._tac?.state === 'swing') {
        if (!at) at = [...f.ai.feet];
        drift = Math.max(drift, Math.hypot(f.ai.feet[0] - at[0], f.ai.feet[2] - at[2]));
        longest = Math.max(longest, ++stretch);
      } else { at = null; stretch = 0; }
    },
  });
  assert.ok(f.swings >= 2);
  assert.ok(drift < 0.05, `stood its blow (drifted ${drift.toFixed(3)})`);
  assert.ok(longest * DT >= TACT.SWING * 0.8, `for the swing's length (${(longest * DT).toFixed(2)} s)`);
});

