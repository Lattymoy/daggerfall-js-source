// AUDIT TACT (2026-10-02, Mac: "Audit this and ensure perfection"): four lenses over TACT1-TACT4 - the brain (A), cover
// (B), the crowd and the door (C), the hosts, the ground and the records (D). Every finding reproduced on the TACT4
// head and pinned here red, then fixed. Driven on the real motor, attack component, collider and arrow flight.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI, canSeeTarget, MIN_RANGED_DISTANCE } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { ArrowFlight } from '../src/combat/arrowFlight.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import {
  TACT, setTacticsClock, resetTactics, tokensOut, LOCAL_TARGET, noteLocalPlayer, tacticsStep, releaseTactics,
  offsetTactics, boardsHeld, tacticsNow, tickTactics,
} from '../src/ai/tactics.js';
import { liveBlows, resetBlows, setLiveBlow, makeBlow, drawableBlows, windupNear, blowConnects, fitBlowToGround, BLOW_STALE } from '../src/ai/foeBlows.js';
import { createCoverIndex, coverProxy, coverProxies, coverStep, COVER_TRUNK_R } from '../src/ai/cover.js';
import { sinkFelled } from '../src/scenes/treeHost.js';
import { clearDoorways, actionDoorSpots, DOORWAY_DEPTH } from '../src/characters/foeSpacing.js';
import { indoorWatchSpot, GUARD_INDOOR_INSET } from '../src/scenes/cityGuards.js';
import { yieldsToDoor, hostileToMe } from '../src/player/mobileEnemyActivate.js';
import { liveFoeTargets, doorDistanceOf, peacefulFoePass, pickActivatableHit } from '../src/player/activate.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quad = (c, key, a, b, d, e) => c.addMesh(key, new Float32Array([...a, ...b, ...d, ...e]), new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]), I);
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

/** A foe of `type` at `at`, facing the origin, with its attack component and body. */
function foe({ at = [0, 0, 8], type = M.Orc, level = 5, bow = false, collider = null, health = 80 } = {}) {
  const c = collider ?? new Collider(() => 0);
  const body = { health, maxHealth: health, mobileType: type, level };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => body, hasBowAttack: bow });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  atk.rangedAttack = bow;
  return { ai, atk, body, c, swings: 0, shots: 0 };
}
/** Frames at `fps` against `player` (noted each frame, facing +z); `each(i)` after each. */
function run(foes, secs, player, { fps = 60, each = null } = {}) {
  const dt = 1 / fps;
  for (let i = 0; i < Math.round(secs * fps); i++) {
    T += Math.min(dt, 0.05);   // the foes' own time (the hosts' tick: foeFrameDt)
    noteLocalPlayer(player, [0, 0, 1]);
    for (const f of foes) {
      f.ai.update(dt, player);
      const s0 = f.atk.swingSeq;
      f.atk.update(dt, f.ai, player);
      if (f.atk.swingSeq !== s0) { if (f.atk.firedRanged) f.shots++; else f.swings++; }
    }
    each?.(i);
  }
}
const flat = (f, p = [0, 0, 0]) => Math.hypot(f.ai.feet[0] - p[0], f.ai.feet[2] - p[2]);

// ── A: the brain ────────────────────────────────────────────────────

test('AUDIT TACT A1: an archer inside the bow band\'s near edge backs out PAST it and shoots - never jittering on the edge without a shot or a blow', () => {
  assert.equal(TACT.KITE_IN, MIN_RANGED_DISTANCE, 'the kite band starts where DFU\'s bow band ends');
  const f = foe({ at: [0, 0, 5.5], type: M.Archer, bow: true });
  let reversals = 0, prev = null;
  run([f], 20, [0, 0, 0], { each: () => { const m = f.ai._tacDir ? 'B' : (f.ai.moving ? 'F' : '-'); if (prev && m !== prev && m !== '-' && prev !== '-') reversals++; prev = m; } });
  assert.ok(f.shots + f.swings > 0, `it fought (${f.shots} shots, ${f.swings} blows)`);
  assert.ok(reversals < 20, `no back-and-forth on the edge (${reversals})`);
});

test('AUDIT TACT A1: an archer kiting into a wall is cornered - it fights hand to hand rather than standing', () => {
  const c = new Collider(() => 0);
  quad(c, 'wall', [-5, 0, 4.6], [5, 0, 4.6], [5, 4, 4.6], [-5, 4, 4.6]);   // a wall at its back
  const f = foe({ at: [0, 0, 4], type: M.Archer, bow: true, collider: c });
  run([f], 15, [0, 0, 0]);
  assert.ok(f.swings + f.shots > 0, `it fought (${f.swings} blows)`);
});

test('AUDIT TACT A2: a shot hands the ranged token on at once - to the longest waiter - and a bow\'s shot is counted', () => {
  const st = (x) => ({ inSight: true, detected: true, _dist: 20, feet: [x, 0, -20], stopDistance: 2.25, yaw: 0, _armedTargeting: false, hasBowAttack: true, flee() {} });
  const [a, b, c] = [st(0), st(1), st(2)];
  for (const [t, who] of [[0, [a]], [0.5, [a, b]], [1, [a, b, c]]]) { T = t; for (const x of who) tacticsStep(x, 0, 1); }
  assert.equal(a._tacShoot, true); assert.equal(b._tacShoot, true); assert.equal(c._tacShoot, false);
  a._tacShot = 1;   // it loosed
  T = 1.1; tacticsStep(a, 0, 1); tacticsStep(b, 0, 1); tacticsStep(c, 0, 1);
  assert.equal(c._tacShoot, true, 'the waiter shoots next');
  assert.equal(a._tacShoot, false, 'the shooter waits its turn');
  // the attack component counts a bow's shot
  const f = foe({ at: [0, 0, 20], type: M.Archer, bow: true });
  run([f], 30, [0, 0, 0]);
  assert.ok(f.shots > 0 && (f.ai._tacShot ?? 0) >= f.shots, `counted (${f.ai._tacShot} for ${f.shots})`);
});

test('AUDIT TACT A2: the 2 ranged tokens hold - a shot hands the token on, so five archers take turns and never five at once', () => {
  const foes = [0, 1, 2, 3, 4].map((i) => foe({ at: [Math.sin(i * 1.2566) * 20, 0, Math.cos(i * 1.2566) * 20], type: M.Archer, bow: true }));
  let most = 0;
  run(foes, 40, [0, 0, 0], { each: () => { most = Math.max(most, tokensOut(LOCAL_TARGET, 'ranged')); } });
  assert.ok(most <= TACT.RANGED_TOKENS + 1, `never past the cap (save a patience turn): ${most}`);
  assert.ok(foes.filter((f) => f.shots > 0).length >= 4, `the turns go round (${foes.map((f) => f.shots)})`);
});

test('AUDIT TACT A3/D1: a wind-up lands at 20 fps, at 15 and at 10 - a slow frame is not a knock', (t) => {
  let seed = 7;   // a wind-up is a roll (tactics.js BLOW_CHANCE): seeded, so "it wound up" is never the dice's
  t.mock.method(Math, 'random', () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; });
  for (const fps of [20, 15, 10]) {
    resetTactics(); resetBlows();
    const f = foe({ level: 12, at: [0, 0, 6] });
    let started = 0, landed = 0, prev = null;
    run([f], 90, [0, 0, 0], { fps, each: () => {
      const st = f.ai._tac?.state;
      if (st === 'windup' && prev !== 'windup') started++;
      if (f.ai._blowVerdict != null) { landed++; f.ai._blowVerdict = null; f.ai._blowMult = undefined; }
      prev = st;
    } });
    assert.ok(started >= 2, `${fps} fps: it wound up (${started})`);
    const inFlight = f.ai._tac?.state === 'windup' ? 1 : 0;   // one still winding up as the run ends is not lost
    assert.equal(landed, started - inFlight, `${fps} fps: every one landed`);
  }
});

test('AUDIT TACT A3: a paralysed foe\'s wind-up is broken - the motor says when it could not act', () => {
  const f = foe({ level: 12, at: [0, 0, 6] });
  let wound = false;
  for (let i = 0; i < 60 * 60 && !wound; i++) { run([f], 1 / 60, [0, 0, 0]); wound = f.ai._tac?.state === 'windup'; }
  assert.ok(wound);
  for (let i = 0; i < 20; i++) { T += 1 / 60; f.ai.update(1 / 60, [0, 0, 0], null, true); }   // paralysed a third of a second
  let verdict = null;
  run([f], 1, [0, 0, 0], { each: () => { if (verdict == null && f.ai._blowVerdict != null) verdict = f.ai._blowVerdict; } });
  assert.equal(verdict, null, 'no blow landed out of it');
});

test('AUDIT TACT A4: a landing\'s swing the attack could not take at once is spent, never fired later off the clock', () => {
  const f = foe({ at: [0, 0, 2] });
  run([f], 0.5, [0, 0, 0]);
  Object.assign(f.ai, { _blowSwing: true, _blowVerdict: true, _blowMult: 1.5, _blowAt: T - 3 });
  const seq = f.atk.swingSeq;
  f.atk.meleeTimer = 99;
  run([f], 0.2, [0, 0, 0]);
  assert.equal(f.atk.swingSeq, seq, 'no late swing');
  assert.equal(f.ai._blowSwing, false);
  assert.equal(f.ai._blowVerdict ?? null, null, 'and its verdict spent');
});

test('AUDIT TACT A3/D10: the brain\'s clock is the foes\' own time - a held frame (dt 0) does not move it, and every host ticks it with the foes\' step', () => {
  setTacticsClock(null);
  const t0 = tacticsNow();
  tickTactics(0); tickTactics(-1); tickTactics(NaN);
  assert.equal(tacticsNow(), t0, 'held: nothing expires while nobody moved');
  tickTactics(0.05);
  assert.ok(Math.abs(tacticsNow() - t0 - 0.05) < 1e-12);
  setTacticsClock(() => T);
  assert.match(rd('src/scenes/world.js'), /tickTactics\(foeFrameDt\(_questBoxHoldsFoes\(\) \? 0 : dt\)\);/);
  assert.match(rd('src/scenes/exterior.js'), /tickTactics\(foeFrameDt\(_questBoxHoldsFoes\(\) \? 0 : dt\)\);/);
  assert.match(rd('src/scenes/dungeon.js'), /tickTactics\(foeFrameDt\(dt\)\);/);
  assert.doesNotMatch(rd('src/ai/tactics.js'), /performance\.now/, 'never the wall');
});

test('AUDIT TACT A4/D5: a bow foe mid-wind-up neither shoots nor casts; its landing swings at once though the target is now in the bow band - never parked for seconds on a stale verdict', () => {
  const f = foe({ at: [0, 0, 6], level: 12 });
  const player = [0, 0, 0];
  let wound = false;
  for (let i = 0; i < 60 * 60 && !wound; i++) { run([f], 1 / 60, player); wound = f.ai._tac?.state === 'windup'; }
  assert.ok(wound, 'it wound one up');
  // it carries a bow (a Spellsword's spells, an archer's bow) and the player steps back into the bow band
  f.ai.hasBowAttack = true; f.atk.rangedAttack = true;
  run([f], 1 / 60, player);
  assert.equal(f.ai._tacShoot, false, 'no shot, no spell mid-wind-up');
  const shots0 = f.shots;
  player[2] = f.ai.feet[2] - 8;
  let swungAt = null, landedAt = null;
  const seq0 = f.atk.swingSeq;
  run([f], 1.5, player, { each: () => {
    if (landedAt == null && f.ai._blowAt != null) landedAt = f.ai._blowAt;
    if (swungAt == null && f.atk.swingSeq !== seq0 && !f.atk.firedRanged) swungAt = T;
  } });
  assert.equal(f.shots, shots0, 'no shot while it stood its wind-up');
  assert.ok(swungAt != null && landedAt != null && swungAt - landedAt < 0.15, `the landing swung at once (${landedAt}, ${swungAt})`);
  assert.equal(f.ai._blowSwing, false, 'nothing parked');
});

test('AUDIT TACT A4/D6: a verdict is spent within a swing\'s length without a clock being passed, and a landing on a foe that turned on another leaves none', () => {
  const ai = { _blowVerdict: false, _blowMult: 1.5, _blowAt: 0 };
  T = 5;
  assert.equal(blowConnects(ai, true), true, 'stale (5 s): the classic reach - the hosts pass no clock and still get this');
  // a wind-up whose foe turned on another foe mid-way lands on no one here
  noteLocalPlayer([0, 0, 0], [0, 0, 1]);
  const mk = (target) => {
    const ai = { inSight: true, detected: true, _dist: 2, feet: [0, 0, 2], stopDistance: 2.25, yaw: Math.PI, canAct: true, _armedTargeting: !!target, target, flee() {} };
    T = 10;
    ai._tac = { key: null, kind: 'melee', state: 'windup', until: 0, slot: 0, hp: [], fled: false, seen: T, swung: 0, shot: 0, kiting: false, meleeUntil: 0, leased: 0, blow: makeBlow('slam', [0, 0, 2], Math.PI, T - 1) };
    tacticsStep(ai, 0, -1);
    return ai;
  };
  const mine = mk(null);
  assert.equal(mine._blowVerdict, true, 'on me: the verdict (my feet in its slam)');
  const turned = mk({ isPlayer: false });
  assert.equal(turned._blowVerdict ?? null, null, 'on another foe: no verdict');
  assert.ok(!turned._blowSwing && turned._blowMult == null, 'no weight, no forced swing');
});

test('AUDIT TACT A5: a foe backing off holds its own farther ring - no back-and-forth with the classic advance', () => {
  const f = foe({ at: [0, 0, 6] });
  run([f], 3, [0, 0, 0]);
  f.body.health -= f.body.maxHealth * 0.3;
  let reversals = 0, prev = null, far = 0;
  run([f], TACT.BACKOFF, [0, 0, 0], { each: () => {
    if (f.ai._tac?.state !== 'backoff') return;
    far = Math.max(far, flat(f));
    const m = f.ai._tacDir ? 'S' : (f.ai.moving ? 'F' : '-');
    if (prev && m !== prev && (m === 'F' || prev === 'F')) reversals++;
    prev = m;
  } });
  assert.ok(reversals <= 2, `steady (${reversals} reversals)`);
  assert.ok(far >= 2.25 + TACT.RING_GAP + TACT.BACKOFF_GAP - TACT.RING_SLACK - 0.1, `out to its own ring (${far.toFixed(2)})`);
});

test('AUDIT TACT A6: a committed wind-up is never walked off by a detour', () => {
  const f = foe({ level: 12, at: [0, 0, 6] });
  let wound = false;
  for (let i = 0; i < 60 * 60 && !wound; i++) { run([f], 1 / 60, [0, 0, 0]); wound = f.ai._tac?.state === 'windup'; }
  assert.ok(wound);
  const at = [...f.ai.feet];
  f.ai.avoidObstaclesTimer = 2; f.ai.detourDestination = [at[0] + 5, at[1], at[2]];
  let moved = 0;
  run([f], 0.6, [0, 0, 0], { each: () => { if (f.ai._tac?.state === 'windup') moved = Math.max(moved, flat(f, at)); } });
  assert.ok(moved < 0.02, `it stood its wind-up (${moved.toFixed(3)})`);
});

test('AUDIT TACT A7: a board for a target nobody fights any more is dropped - no dead foe held for the session', () => {
  const target = { isPlayer: false };
  const a = { inSight: true, detected: true, _dist: 3.4, feet: [0, 0, -3.4], stopDistance: 1.5, yaw: 0, _armedTargeting: true, target, flee() {} };
  tacticsStep(a, 0, 1);
  assert.equal(boardsHeld(), 1 + 0, 'the foe target\'s board');
  releaseTactics(a);
  assert.equal(boardsHeld(), 0, 'gone with its last fighter');
});

test('AUDIT TACT: an opportunist (no token, a turned back) strikes but never telegraphs - a blow is a token holder\'s', () => {
  // AUDIT ARENA-LADDER: the mark is blowAim's (me, or a bout-mate on the sand) - asked of a token holder alone
  assert.match(rd('src/ai/tactics.js'), /const aim = s\.state === 'engage' && b\.melee\.has\(ai\) \? blowAim\(ai, key\) : null;/);
});

// ── D: the hosts, the ground ────────────────────────────────────────

test('AUDIT TACT D2: the location host notes the player before its building\'s and dungeon\'s frames, as the world host does', () => {
  const x = rd('src/scenes/exterior.js');
  const note = x.indexOf('noteLocalPlayer(walkMode ? player.pos : cam.pos'), frame = x.indexOf('    if (modes.frame(dt, now)) {');
  assert.ok(note > 0 && frame > 0 && note < frame);
});

test('AUDIT TACT D3: a floating-origin recentre moves the noted player and every live wind-up with the world', () => {
  const a = {};
  const b = makeBlow('slam', [10, 0, 10], 0, 0);
  setLiveBlow(a, b);
  noteLocalPlayer([10, 0, 8], [0, 0, 1]);
  offsetTactics([-100, 0, 50]);
  assert.deepEqual(b.origin, [-90, 0, 60]);
  assert.match(rd('src/scenes/world.js'), /exteriorFoes\.offsetAll\(r\.offset\);[^\n]*\n\s*labGrassField\?\.shiftOrigin\(r\.offset\);[^\n]*\n\s*offsetTactics\(r\.offset\);/);
});

test('AUDIT TACT D4: a dead foe\'s wind-up goes with it - not drawn, and blocking no one', () => {
  const dead = { _tac: { seen: 0 } };
  const b = makeBlow('slam', [0, 0, 1], 0, 0); b.land = 100;
  setLiveBlow(dead, b);
  T = BLOW_STALE + 0.1;
  assert.equal(windupNear([0, 0, 0], T), false, 'it blocks no one');
  assert.equal(drawableBlows(T, [0, 0, 0]).length, 0, 'and is not drawn');
  assert.equal(liveBlows().has(dead), false);
});

test('AUDIT TACT D8: the mark lies on the ground it marks - fitted to a ramp under it', () => {
  const ramp = new Collider();
  quad(ramp, 'ramp', [-10, -5, -10], [10, -5, -10], [10, 5, 10], [-10, 5, 10]);   // rises 0.5 per metre toward +z
  const b = fitBlowToGround(makeBlow('lunge', [0, 0.3, 0], 0, 0), ramp);
  assert.ok(Math.abs(b.origin[1] - 0) < 1e-6, 'on the ground at its foot');
  assert.ok(Math.abs(b.slope[1] - 0.5) < 1e-6 && Math.abs(b.slope[0]) < 1e-6, `along the rise (${b.slope})`);
  const steep = new Collider();
  quad(steep, 's', [-10, -12, -10], [10, -12, -10], [10, 12, 10], [-10, 12, 10]);   // a 1.2 rise - a steep stair
  assert.equal(fitBlowToGround(makeBlow('lunge', [0, 0, 0], 0, 0), steep).slope[1], 1, 'clamped to 45 degrees');
  assert.equal(fitBlowToGround(makeBlow('lunge', [0, 0, 0], 0, 0), null).slope, undefined, 'no collider: flat, as before');
  assert.match(rd('src/ai/tactics.js'), /fitBlowToGround\(makeBlow\(/);
});

test('AUDIT TACT D9: the mark is fogged as the ground is - the renderer hands the pass its fog', () => {
  assert.match(rd('src/render/renderer.js'), /this\._foeTelegraph\.draw\(list, this\._proj, this\._view, \{ mode: this\._fogMode, density: this\._fogDensity, range: this\._fogRange, camPos: this\._camPos, focus: this\._focus \}\)/);
  assert.match(rd('src/render/foeTelegraph.js'), /a \*= fogFactorAt\(vWorld\);/);
});

// ── B: cover ────────────────────────────────────────────────────────

test('AUDIT TACT B1: a felled tree is no cover, and a regrown one is again - through the real felling path', () => {
  const idx = createCoverIndex();
  const centers = [[0, 0, 10]];
  idx.add('px', coverProxies(centers[0], { w: 3, h: 6 }, { tree: true }));
  assert.ok(Number.isFinite(idx.hit([0, 1, 0], [0, 0, 1], 20)));
  const forest = { groups: new Map([['504_12', { batch: {}, centers, size: { w: 3, h: 6 } }]]) };
  const renderer = { moveBillboardBatch: () => true };
  sinkFelled(forest, new Set(['504_12#0']), renderer);
  assert.equal(idx.hit([0, 1, 0], [0, 0, 1], 20), Infinity, 'felled');
  sinkFelled(forest, new Set(), renderer);
  assert.ok(Number.isFinite(idx.hit([0, 1, 0], [0, 0, 1], 20)), 'regrown with the day');
});

test('AUDIT TACT B2: no one-way hiding place - a tree is a trunk and a crown, and a line of sight that ENDS in cover is not hidden by it', () => {
  const [trunk, crown] = coverProxies([0, 0, 5], { w: 3, h: 6 }, { tree: true });
  assert.ok(trunk.r <= COVER_TRUNK_R && trunk.lift === 0, 'a body-wide trunk');
  assert.ok(crown.r > trunk.r && crown.lift > 1.8, 'a crown over the heads');
  const c = new Collider(() => 0);
  c.cover = createCoverIndex();
  c.cover.add('k', [trunk, crown]);
  // standing 0.5 m from the trunk's middle: beside it, never inside it
  assert.equal(canSeeTarget(c, [0, 0, 0], 0, 1.8, [0.5, 0, 5]), true, 'seen beside the trunk');
  assert.equal(canSeeTarget(c, [0, 0, 0], 0, 1.8, [0, 0, 10]), false, 'hidden behind it');
  // a one-column proxy holding the player: seen in it (the law is two-way)
  const fat = new Collider(() => 0);
  fat.cover = createCoverIndex();
  fat.cover.add('k', [coverProxy([0, 0, 5], { w: 3, h: 5 })]);
  assert.equal(canSeeTarget(fat, [0, 0, 0], 0, 1.8, [0, 0, 5]), true, 'in it: seen');
  assert.match(rd('src/scenes/world.js'), /coverProxies\(c, size, \{ tree: archive === natureArchive && isTreeRecord\(natureArchive, record\) \}\)/);
});

test('AUDIT TACT B3: people are no cover - a person flat is skipped wherever it stands', () => {
  const idx = createCoverIndex();
  const person = Object.assign([0, 0, 5], { noCover: true });
  assert.equal(idx.add('k', [coverProxy(person, { w: 1, h: 1.8 })]), 0);
  assert.equal(idx.hit([0, 1, 0], [0, 0, 1], 20), Infinity);
  assert.match(rd('src/scenes/dungeonContext.js'), /if \(pn\) at\.noCover = true;/);
  assert.match(rd('src/scenes/exterior.js'), /_people\.has\(flat\) \? \{ noCover: true \} : null/);
});

test('AUDIT TACT B5: an arrow meets cover by touch - at 20 fps it still strikes a player half a metre before a tree', () => {
  for (const gap of [0.1, 0.3, 0.6]) {
    const c = new Collider(() => 0);
    c.cover = createCoverIndex();
    c.cover.add('k', [coverProxy([0, 0, 10], { w: 3, h: 5 })]);   // skin at 8.95
    const feet = [0, 0, 8.95 - gap - 0.35];
    const f = new ArrowFlight({ getGpuMesh: () => null, collider: c });
    f.fire([0, 1, 0], [0, 0, 1], { enemy: true });
    let hit = false;
    for (let i = 0; i < 40 && !f.arrows[0].dead; i++) f.update(1 / 20, { playerFeet: feet, onPlayerHit: () => { hit = true; } });
    assert.equal(hit, true, `a ${gap} m gap at 20 fps`);
  }
  // ...and a shaft at nothing behind a trunk stops ON it at 20 fps - never jumping into it and out the far side
  const c = new Collider(() => 0);
  c.cover = createCoverIndex();
  c.cover.add('k', [coverProxy([0, 0, 10], { w: 1.2, h: 5 })]);   // a thin trunk: skin at 9.58
  const f = new ArrowFlight({ getGpuMesh: () => null, collider: c });
  f.fire([0, 1, 0], [0, 0, 1], { enemy: true });
  let past = false;
  for (let i = 0; i < 40 && !f.arrows[0].dead; i++) { f.update(1 / 20, {}); if (f.arrows[0].pos[2] > 10) past = true; }
  assert.equal(past, false, 'stopped on the trunk');
  assert.deepEqual(coverStep(5, Infinity, 2, 0.45, 1.55), { stop: Infinity, advance: 1 });
  assert.deepEqual(coverStep(0.3, Infinity, 2, 0.45, 1.55), { stop: 0.3, advance: 1 });
  assert.ok(Math.abs(coverStep(1.2, Infinity, 2, 0.45, 1.55).advance - 0.75 / 1.55) < 1e-9);
  assert.deepEqual(coverStep(1.2, 0.8, 2, 0.45, 1.55), { stop: 0.8, advance: 1 }, 'a wall first is a wall');
});

// ── C: the crowd and the door ───────────────────────────────────────

test('AUDIT TACT C1: another player\'s watch, streamed to me, passes my door click unless it is on ME', () => {
  const puppet = { puppet: 'bob', _pupMine: false, ai: { isHostile: true, feet: [1.5, 0, 0], height: 1.8 }, dead: false };
  assert.equal(hostileToMe(puppet), false);
  assert.equal(yieldsToDoor(puppet, 2.5), true, 'the door behind him opens');
  assert.equal(liveFoeTargets([puppet], 'g')[0].peaceful, true, 'and the plaque names it');
  puppet._pupMine = true;
  assert.equal(yieldsToDoor(puppet, 2.5), false, 'on me: he is the hit');
  assert.equal(hostileToMe({ ai: { isHostile: true } }), true, 'my own foe by its flag');
});

test('AUDIT TACT C2: a hostile guard whose quarry LEFT (a stale destination on the sill) does not hold the doorway', () => {
  const g = { ai: { feet: [0.6, 0, 0.2], height: 1.8, isHostile: true, destination: [0.1, 0, 0.1] }, dead: false };
  const ground = new Collider(() => 0);
  for (let i = 0; i < 120; i++) clearDoorways([g], [{ pos: [0, 0, 0], normal: [1, 0, 0] }], ground, 1 / 60);
  assert.ok(g.ai.feet[0] >= DOORWAY_DEPTH - 1e-6, `stepped out (${g.ai.feet[0]})`);
});

test('AUDIT TACT C3: the indoor watch spreads from a REAL door - whose centre stands over a metre above the sill', () => {
  const room = new Collider(() => -Infinity);
  quad(room, 'floor', [-6, 0, -1], [6, 0, -1], [6, 0, 8], [-6, 0, 8]);
  const at = [0, 1.2, 0.45];   // the door quad's middle, + the classic 0.45 in
  const spots = [0, 1, 2, 3, 4].map((i) => indoorWatchSpot(at, [0, 0, 1], i, room));
  for (const s of spots) assert.ok(Math.abs(s[1]) < 1e-6 && Math.abs(s[2] - GUARD_INDOOR_INSET) < 1e-6, `on the floor, past the sill: ${s}`);
  assert.equal(new Set(spots.map((s) => s[0].toFixed(2))).size, 5, 'five lanes');
});

test('AUDIT TACT C4: the street\'s doorways are mapped once a door generation, and not at all with nobody to clear', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(_tactDoorGen !== doorGeneration\) \{ _tactDoorGen = doorGeneration; _tactDoorWorld = doorSpotsNear\(buildingDoors, null, Infinity, shiftedDoor\); \}/);
  assert.match(w, /if \(cityGuards\.guards\.length \|\| exteriorFoes\.foes\.length\) clearDoorways\(/);
});

test('AUDIT TACT C5: my companion and a pickpocket\'s mark are asked of HIM; the pass is for a DOOR, never the shelf behind', () => {
  const peaceful = { ai: { isHostile: false } };
  assert.equal(yieldsToDoor({ ...peaceful, companion: 'me' }, 2), false, 'my companion\'s pack');
  assert.equal(yieldsToDoor(peaceful, 2, 'steal'), false, 'a pickpocket');
  assert.equal(yieldsToDoor(peaceful, 2, 'info'), true);
  const c = new Collider(() => -100);
  const eye = [0, 1, 0], dir = [1, 0, 0];
  const box = (x) => ({ min: [x - 0.2, 0, -1], max: [x + 0.2, 2, 1] });
  assert.equal(doorDistanceOf(eye, dir, [{ key: 'shelf:0', aabb: box(2), distance: 76.8 }], c), Infinity, 'a shelf is no door');
  assert.ok(Math.abs(doorDistanceOf(eye, dir, [{ key: 'shelf:0', aabb: box(2), distance: 76.8 }, { key: 'exit:0', aabb: box(3), distance: 76.8, door: true }], c) - 2.8) < 1e-6, 'the door behind it');
  const ft = liveFoeTargets([{ ai: { isHostile: false, feet: [1.5, 0, 0], height: 1.8 }, dead: false }], 'g');
  const hit = pickActivatableHit(eye, dir, ft, c);
  assert.equal(peacefulFoePass(hit, ft, 2.5, 'steal'), hit, 'the plaque names the mark');
});

test('AUDIT TACT C6/C7: inner swing doors and a dungeon\'s doors are doorways too - and every host\'s press and plaque pass a peaceful guard to them', () => {
  const objects = new Map([['act:door:1', { kind: 'door', base: I, cpu: { positions: new Float32Array([-0.6, 0, -0.05, 0.6, 0, 0.05, 0.6, 2.2, 0.05, -0.6, 2.2, -0.05]) } }], ['act:lever', { kind: 'action', base: I, cpu: { positions: new Float32Array([0, 0, 0]) } }]]);
  const spots = actionDoorSpots(objects, [0, 0, 0], 30);
  assert.equal(spots.length, 1, 'the door alone');
  assert.deepEqual(spots[0].normal, [0, 0, 1], 'across its thin axis');
  const g = { ai: { feet: [0.2, 0, 0.3], height: 1.8, isHostile: false }, dead: false };
  for (let i = 0; i < 120; i++) clearDoorways([g], spots, new Collider(() => 0), 1 / 60);
  assert.ok(Math.abs(g.ai.feet[2]) >= DOORWAY_DEPTH - 1e-6, 'out of the inner doorway');
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /\.\.\.actionDoorSpots\(interiorCtx\.actions\?\.objects, player\.pos, 30\)/);
  assert.match(m, /doorBehind: doorDistanceOf\(eye, dir, targets, dungeonCtx\.collider\),/);
  assert.match(rd('src/scenes/dungeonContext.js'), /clearDoorways\(foes, actionDoorSpots\(actions\.objects, playerFeet, 30\), collider, foeFrameDt\(dt\),/);
  assert.match(rd('src/scenes/dungeon.js'), /doorBehind: doorDistanceOf\(eye, dir, targets, ctx\.collider\),/);
  assert.match(rd('src/scenes/exterior.js'), /doorBehind: _race\.doorDistance,/);
});

// ── D: what the lens found untested ─────────────────────────────────

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}

test('AUDIT TACT D (coverage): the ground pass adds onto the frame, writes no depth, and puts every state back - blend off, depth written, culling on, the offset off', async () => {
  const { FoeTelegraphPass } = await import('../src/render/foeTelegraph.js');
  const { gl, calls } = fakeGl();
  const pass = new FoeTelegraphPass(gl);
  calls.length = 0;
  assert.equal(pass.draw([], I, I), 0);
  assert.equal(calls.length, 0, 'nothing touched for no blow');
  const b = makeBlow('sweep', [1, 2, 3], 0.5, 0);
  b.slope = [0.1, -0.2];
  pass.draw([{ blow: b, phase: { t: 0.5, flash: 0 } }], I, I, { mode: 2, density: 0.01, range: [0, 1], camPos: [0, 0, 0] });
  const names = calls.map((c) => c[0]);
  const draw = names.indexOf('drawArrays');
  assert.ok(draw > 0);
  assert.deepEqual(calls.filter((c) => c[0] === 'blendFunc').map((c) => c.slice(1)), [[gl.ONE, gl.ONE]]);
  assert.deepEqual(calls.filter((c) => c[0] === 'depthMask').map((c) => c[1]), [false, true], 'no depth written, then written again');
  assert.ok(calls.some((c, i) => i > draw && c[0] === 'disable' && c[1] === gl.BLEND), 'blend off after');
  assert.ok(calls.some((c, i) => i > draw && c[0] === 'enable' && c[1] === gl.CULL_FACE), 'culling back on after');
  assert.ok(calls.some((c, i) => i > draw && c[0] === 'disable' && c[1] === gl.POLYGON_OFFSET_FILL), 'the offset off after');
  assert.ok(calls.some((c) => c[0] === 'uniform2f' && c[1] === 'uSlope' && c[2] === 0.1 && c[3] === -0.2), 'the slope handed');
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uFogMode' && c[2] === 2), 'the fog handed');
});

test('AUDIT TACT D (coverage): the watch resolves a telegraphed blow through the verdict AND the weight', () => {
  const g = rd('src/scenes/cityGuards.js');
  assert.match(g, /const dmg = blowScaled\(g\.ai, calculateAttackDamage\(g\.entity, playerEntity, \{/);
  assert.match(g, /\}\)\);\n(?:\s*\/\/[^\n]*\n){4}\s*if \(dmg > 0\) \{ onPlayerHurt/, 'the weighed blow is what hurts him');
});

test('AUDIT TACT (mutation survivor): a turned back is an opening - the waiting foe it is turned on goes in without a token; faced, it waits', () => {
  const st = (x, z) => ({ inSight: true, detected: true, _dist: Math.hypot(x, z), feet: [x, 0, z], stopDistance: 2.25, yaw: 0, canAct: true, _armedTargeting: false, flee() {} });
  const [a, b, c] = [st(0, 2), st(2, 0), st(-3.5, 0)];
  noteLocalPlayer([0, 0, 0], [1, 0, 0]);   // facing +x: c, at -x, has my back
  for (const [t, who] of [[0, [a]], [0.5, [a, b]], [1, [a, b, c]]]) { T = t; for (const x of who) tacticsStep(x, -x.feet[0], -x.feet[2]); }
  assert.equal(c._tacStrike, true, 'my back is turned on it: it goes in');
  resetTactics();
  const [a2, b2, c2] = [st(0, 2), st(2, 0), st(-3.5, 0)];
  noteLocalPlayer([0, 0, 0], [-1, 0, 0]);   // facing it
  for (const [t, who] of [[0, [a2]], [0.5, [a2, b2]], [1, [a2, b2, c2]]]) { T = t; for (const x of who) tacticsStep(x, -x.feet[0], -x.feet[2]); }
  assert.equal(c2._tacStrike, false, 'faced, it waits its turn');
});
