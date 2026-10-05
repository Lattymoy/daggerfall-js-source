// TELL6d - THE AIMED SHOT (bible/12-Enhanced-AI/Feud-Arc.md section 8.1; Mac, 2026-10-04: "breath more depth into
// it", then "Go" on every call). A class archer of the whole set (an elite, a champion, a revenant - section 9's table:
// an ordinary archer of the tier keeps DFU's plain shot) aims one shot in three at the local player while it holds a
// ranged token: the line from it to its target is drawn on the ground and LOCKED (0.6 s, 0.5 m wide); at the landing
// the arrow leaves along it x1.3 as fast, and strikes for x1.4. No blowConnects - the arrow's own flight
// decides: stepping off the line is the dodge. No held swing, no feint, no window.
// The law (its numbers, its line and the ground's mirror, the locked bearing, the arrow's speed and weight end to end
// through the formulas); ON THE REAL MOTOR an elite archer's aimed shot - wound up instead of a plain one, its line
// locked, its draw at the landing, its loose taken once - and an ordinary one's never; the pools and the hosts wired.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { setTacticsClock, resetTactics, noteLocalPlayer, aimsShots, foeGlint } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, makeBlow, inBlow, BLOW } from '../src/ai/foeBlows.js';
import { TELL } from '../src/ai/tells.js';
import { blowField, quadHalf, BLOW_KIND } from '../src/render/foeTelegraph.js';
import { takeAimedShot, aimedDirection, aimedArrowMeta, aimedBlowInfo, tellCues } from '../src/scenes/hostCombat.js';
import { blowTakenScale, blowTakenNames } from '../src/systems/blowTaken.js';
import { calculateAttackDamage } from '../src/combat/formulas.js';
import { ArrowFlight } from '../src/combat/arrowFlight.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

// ── the law ─────────────────────────────────────────────────────────

test('TELL6d: the aimed shot - 0.6 s, a line 0.5 m wide to its target, x1.4, x1.3 as fast; one shot in three; the ground draws its line its own length (mutants: any number moved; the line not its length)', () => {
  assert.deepEqual({ ...BLOW.aimed }, { windup: 0.6, halfW: 0.25, mult: 1.4, speed: 1.3 });
  assert.equal(TELL.AIMED_SHARE, 1 / 3);
  const b = makeBlow('aimed', [0, 0, 0], 0, 0);
  b.ahead = 20;
  assert.equal(inBlow(b, 0, 19.9), true);
  assert.equal(inBlow(b, 0, 20.1), false, 'to its target, no further');
  assert.equal(inBlow(b, 0.26, 10), false);
  const H = quadHalf('aimed', 20);
  assert.ok(near(H, 20.6), 'its quad its own length');
  for (let along = -3; along <= 22; along += 0.37) {
    for (let across = -1; across <= 1; across += 0.07) assert.equal(blowField('aimed', across, along, 20).inside, inBlow(b, -across, along));
  }
  assert.equal(BLOW_KIND.aimed, BLOW_KIND.lunge, 'the lane\'s branch');
  assert.match(rd('src/render/foeTelegraph.js'), /else if \(b\.kind === 'aimed'\) gl\.uniform4f\(U\.uP, b\.ahead \?\? 0, P\.halfW, 0, 0\);/);
});

test('TELL6d: the loose - the arrow\'s pitch kept, its heading the line\'s; x1.3 as fast in flight; x1.4 where it strikes, end to end through the formulas (mutants: the bearing unlocked; the speed or the weight lost)', () => {
  const dir = [0.6, -0.2, 0.7746];   // DFU's aim at my live transform (a dip and all)
  const shot = { yaw: Math.PI / 2, fired: true };
  const d = aimedDirection(dir, shot);
  assert.ok(near(d[1], -0.2), 'its pitch');
  assert.ok(near(Math.hypot(d[0], d[2]), Math.hypot(dir[0], dir[2])) && near(d[2], 0, 1e-9) && d[0] > 0, 'its heading the locked line\'s');
  assert.equal(aimedDirection(dir, null), dir, 'a plain shot untouched');
  const drawing = { _blowShot: { yaw: 1, at: 0, fired: false } };
  assert.equal(takeAimedShot(drawing), null, 'not before its bow is drawn');
  assert.ok(drawing._blowShot, 'and left for the draw');
  assert.deepEqual(aimedArrowMeta(shot), { aimed: true, speedScale: BLOW.aimed.speed });
  assert.equal(aimedArrowMeta(null), null);
  assert.deepEqual(aimedBlowInfo({ aimed: true }), { aimed: true });
  assert.equal(aimedBlowInfo({}), null);
  // its flight, x1.3 as fast
  const fl = new ArrowFlight({ getGpuMesh: () => null });
  fl.fire([0, 1, 0], [0, 0, 1], { enemy: true });
  fl.fire([0, 1, 0], [0, 0, 1], { enemy: true, speedScale: 1.3 });
  fl.update(0.05, {});
  assert.ok(near(fl.arrows[1].pos[2] / fl.arrows[0].pos[2], 1.3, 1e-6), `${fl.arrows[0].pos[2]} -> ${fl.arrows[1].pos[2]}`);
  // its weight
  assert.ok(blowTakenNames().includes('tell-aimed'));
  assert.equal(blowTakenScale(null, {}, null, { kind: 'arrow', aimed: true }), 1.4);
  assert.equal(blowTakenScale(null, {}, null, { kind: 'arrow' }), 1);
  const STATS = { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
  const attacker = { isPlayer: false, isClass: true, level: 20, skills: 60, stats: STATS, career: { attackModifierFlags: 0 } };
  const target = { isPlayer: false, isClass: false, level: 5, stats: STATS, skills: 20, armorValues: new Array(7).fill(60) };
  const opts = { weapon: { templateIndex: WEAPONS.Long_Bow, material: 1, flags: 0 }, toHitMod: 1000, rolls: () => 0.5, dfRand: () => 0.5 };
  const plain = calculateAttackDamage(attacker, { ...target }, opts);
  assert.ok(plain > 0, `an arrow that lands (${plain})`);
  assert.equal(calculateAttackDamage(attacker, { ...target }, { ...opts, blowInfo: aimedBlowInfo({ aimed: true }) }), Math.max(1, Math.round(plain * 1.4)));
});

// ── on the real motor ───────────────────────────────────────────────

function archer(extra = { eliteFoe: true }) {
  const c = new Collider(() => 0);
  const ent = { health: 80, maxHealth: 80, mobileType: M.Archer, level: 12, ...extra };
  const ai = new EnemyAI(c, [0, 0, 14], Math.PI, { vitals: () => ent, hasBowAttack: true });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2, rolls: () => 0.01 });   // the bow's roll and the aimed third pass
  atk.rangedAttack = true;
  return { ai, atk, ent, mobileType: M.Archer, mobile: { meleeSeq: 0 } };
}
function run(f, secs, player, each = null) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    f.ai.update(DT, player); f.atk.update(DT, f.ai, player);
    each?.();
  }
}
function pinned(r, fn) { const had = Math.random; Math.random = () => r; try { return fn(); } finally { Math.random = had; } }

test('TELL6d: ON THE MOTOR an elite archer aims - its shot wound up instead of loosed, its line to me locked, no held swing; at the landing it draws, and the loose takes the shot once (mutants: never aimed; the line unlocked; the draw missing)', () => {
  const f = archer();
  const player = [0, 0, 0];
  assert.equal(aimsShots(f.ai, f.ent), true);
  let b = null;
  pinned(0.05, () => { for (let i = 0; i < 1200 && !b; i++) { run(f, DT, player); if (f.ai._tac?.state === 'windup') b = liveBlows().get(f.ai); } });
  assert.equal(b?.kind, 'aimed', 'its shot aimed');
  assert.ok(near(b.ahead, Math.hypot(player[0] - b.origin[0], player[2] - b.origin[2]), 0.05), 'its line to me');
  assert.equal(f.ai._blowHold, false, 'no held swing');
  assert.equal(b.feint, undefined, 'never a feint');
  assert.ok(foeGlint(f.ai, T), 'it glints');
  const yaw = b.yaw, seq0 = f.atk.swingSeq;
  player[0] += 3;   // I step off its line - it holds
  let drawnAt = null;
  pinned(0.05, () => run(f, b.land - T + 0.2, player, () => { if (drawnAt == null && f.atk.swingSeq !== seq0) drawnAt = T; }));
  assert.equal(b.yaw, yaw, 'locked');
  assert.ok(drawnAt != null && drawnAt >= b.land - 1e-9 && drawnAt - b.land < 0.15, 'it drew at the landing');
  assert.equal(f.atk.firedRanged, true);
  assert.notEqual(f.ai._tac.state, 'overreach', 'no window - its arrow decides');
  const shot = takeAimedShot(f.ai);
  assert.ok(shot && shot.fired && shot.yaw === yaw, 'the loose takes it');
  assert.equal(takeAimedShot(f.ai), null, 'once');
});

test('TELL6d: an ordinary archer of the tier never aims; the switch off, nothing asks (mutants: every archer aims)', () => {
  const f = archer({});
  assert.equal(aimsShots(f.ai, f.ent), false);
  pinned(0.05, () => run(f, 20, [0, 0, 0], () => { assert.notEqual(f.ai._tac?.state, 'windup'); }));
  assert.equal(f.ai._aimReady, false);
  assert.ok((f.ai._tacShot ?? 0) > 0, 'it shot, plainly');
  assert.equal(aimsShots(f.ai, { mobileType: M.Orc, eliteFoe: true }), false, 'a monster is no class archer');
});

test('TELL6d: the pools loose it and the hosts weigh it - the locked bearing and the arrow\'s word at both loose arms, the four hosts\' arrow hits (mutants: any arm unwired)', () => {
  const ex = rd('src/scenes/exteriorFoes.js');
  assert.match(ex, /const shot = takeAimedShot\(f\.ai\);[^\n]*\n\s*const dir = aimedDirection\(arrowAimDirection\(/);
  assert.match(ex, /onArrow\(from, dir, f, _atPlayer \? null : _at, aimedArrowMeta\(shot\)\);/);
  const dg = rd('src/scenes/dungeonContext.js');
  assert.match(dg, /fireArrow\(from, dir, f\.entity\.weapon, false, f, _atPlayer \? null : _at, null, aimedArrowMeta\(shot\)\);/);
  assert.match(dg, /const step = MISSILE_SPEED \* \(m\.speedScale \?\? 1\) \* dt;/);
  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(host), /blowInfo: m\.aimed \? aimedBlowInfo\(m\) : null,/, `${host}: its arrow's weight`);
  }
  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/worldModes.js']) {
    assert.match(rd(host), /onArrow: \(from, dir, f, aimFoe = null, extra = null\) => \{/, host);
    assert.match(rd(host), /aimFoe, \.\.\.\(extra \?\? \{\}\) \}\);/, host);
  }
  // the ear: a shot strikes nothing - no LAND waits on a later swing
  const g = { mobileType: M.Archer, mobile: { meleeSeq: 0 }, ai: { feet: [0, 0, 0], _blowHold: false, _tac: { state: 'windup', blow: { start: 1, land: 1.6, kind: 'aimed' } } } };
  const a = { play3d: () => {} };
  tellCues(g, a, 1, 1);
  Object.assign(g.ai, { _tac: { state: 'wait', blow: null }, _blowLandedAt: 1.6 });
  tellCues(g, a, 1, 1.61);
  assert.equal(g._tellCue.land, false, 'nothing waits to land (a person is mute - the word is what is pinned)');
  g.mobile.meleeSeq++;
  assert.deepEqual(tellCues(g, a, 1, 5), [], 'a later swing is no LAND');
});
