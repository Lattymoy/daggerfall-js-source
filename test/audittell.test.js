// AUDIT TELL (bible/12-Enhanced-AI/Feud-Arc.md, the AUDIT TELL record; Mac, 2026-10-04: "Let's do a comprehensive audit
// over everything ensuring perfection"). TELL1-TELL9 read whole, every finding verified and fixed; this file pins each
// fix (the online ones - O2, O4, O6, B8's wire - stand in test/tell8_online.test.js, beside the wire they keep):
//   the brain (B1-B11), the landing on the player (L1-L9), the hosts (H1, H5/L6, H6, P1), the screen (U1-U10), the arc's
//   own promises built at last (the shatter, 3.2; the bleed's drips, 8.2; the dungeon stream's gap FLAGGED, 10.1/32),
//   section 28's duel harness and the massive poise floor it tuned, and section 29's two missing pins (P from the real
//   street pool's foes by weight class; a push stopped by a wall).
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { PlayerMotor } from '../src/player/motor.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { enemyWeightClassicUnits } from '../src/combat/formulas.js';
import { setTacticsClock, resetTactics, releaseTactics, breakWindup, windupHolds, windupStruck, foeGlint, poiseTrack, tacticsStep, noteLocalPlayer, targetKey, PUPPET_HELD_UNTIL, LOCAL_TARGET } from '../src/ai/tactics.js';
import { hitClassField, hitClassOf, HIT_CLASS_K_MAX } from '../src/net/wire.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { makeBlow, setLiveBlow, liveBlows, resetBlows, drawableBlows, shatterBlow, offsetBlows, BLOW_SHATTER, BLOW_STALE, BLOW_VERDICT_LIFE } from '../src/ai/foeBlows.js';
import { puppetGapLanded } from '../src/ai/puppetBlows.js';
import { TELL, poiseOf, kindHealth, weightClass, poiseSpecial, blowK } from '../src/ai/tells.js';
import { BLOW_EFFECT, blowEffectOf, queueBlowEffect, drainBlowEffects, knockedDown, startBleed, tickBleed, resetBlowEffects, _resetBlowEffectsForTests } from '../src/systems/blowEffects.js';
import { createBleedLedger, WOUND_SHARE, WOUND_WAIT, BLEED_THRESHOLD } from '../src/combat/bloodBleed.js';
import { setBatchGlint } from '../src/systems/hitFlash.js';
import { tellCues } from '../src/scenes/hostCombat.js';
import { markFoeStruck, markFoeThreat, foeTarget, clearFoeTarget, tickFoeTarget, THREAT_YIELD_S } from '../src/ui/hudFoeTarget.js';
import { TELEGRAPH_STYLE_GLSL, TELEGRAPH_BAND_CAP, CONTRAST_BAND_CAP } from '../src/render/telegraphStyle.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); _resetBlowEffectsForTests(); clearFoeTarget(); T = 10; setPref('enhancedAI', true); });

/** A brain state winding up at me, seen now. */
function windingUp(kind = 'lunge', extra = {}) {
  const b = makeBlow(kind, [0, 0, 0], 0, T - 0.1);
  const ai = { feet: [0, 0, 0], canAct: true, vitals: () => ({ health: 50, maxHealth: 50, mobileType: M.Orc, level: 12 }), _tac: { state: 'windup', blow: b, seen: T, key: 'me' }, ...extra };
  setLiveBlow(ai, b);
  return { ai, b };
}

// ── the brain ───────────────────────────────────────────────────────

test('AUDIT TELL B1: a wind-up nobody stepped tells nothing and holds nothing - no hold, no glint, an empty track; a foe that cannot act holds nothing; breakWindup ends a wind-up, a run or a chain (never a puppet\'s) with its cooldown, its held swing dropped and no verdict left (mutants: the unseen test gone; a puppet broken)', () => {
  const { ai, b } = windingUp();
  assert.equal(windupHolds(ai), true);
  assert.ok(foeGlint(ai, T) !== null || foeGlint(ai, b.land - 0.05) !== null, 'it glints while seen');
  ai._tac.seen = T - BLOW_STALE - 0.01;
  assert.equal(windupHolds(ai), false, 'not stepped: it holds nothing');
  assert.equal(foeGlint(ai, T), null, 'and glints nothing');
  assert.deepEqual(poiseTrack(ai), { state: 'empty', fill: 0, word: '' });
  ai._tac.seen = T; ai.canAct = false;
  assert.equal(windupHolds(ai), false, 'a foe that cannot act holds nothing');
  ai.canAct = true; ai._blowVerdict = true; ai._blowMult = 1.3;
  assert.equal(breakWindup(ai), true);
  assert.equal(ai._tac.state, 'engage');
  assert.equal(ai._tac.blow, null);
  assert.ok(ai._tac.blowReady > T, 'its cooldown begun');
  assert.equal(liveBlows().has(ai), false, 'its mark gone');
  assert.equal(ai._blowHold, 'cancel', 'its held swing dropped');
  assert.equal(ai._blowVerdict, null, 'no verdict for a later swing');
  assert.equal(breakWindup({ _tac: { state: 'windup', puppet: true } }), false, 'a puppet\'s is its owner\'s');
  assert.equal(breakWindup({ _tac: { state: 'engage' } }), false, 'nothing to break');
  for (const st of ['dash', 'chain']) assert.equal(breakWindup({ feet: [0, 0, 0], vitals: () => null, _tac: { state: st, dash: {}, seen: T } }), true, `a ${st}`);
  const em = rd('src/characters/enemyMotor.js');
  assert.match(em, /if \(!this\.canAct && this\._tac\?\.state && !locked\) breakWindup\(this\);/, 'the motor breaks it where the foe cannot act');
  assert.match(em, /flee\(fromFeet, seconds\) \{\n\s*breakWindup\(this\);/, 'and where it routs');
  assert.match(rd('src/ai/tactics.js'), /const skipped = !!ai\._tacSkipped \|\| unseen\(s, now\);/, 'a gap on the foes\' clock is a step it did not decide');
});

test('AUDIT TELL B4: a released place takes the archer\'s aimed shot with it - DFU\'s bow roll whole again (mutants: the shot kept)', () => {
  const ai = { _tac: { state: 'engage', key: null }, _aimReady: true, _wantAimed: true, _blowShot: { fired: true, at: T } };
  releaseTactics(ai);
  assert.deepEqual([ai._aimReady, ai._wantAimed, ai._blowShot], [false, false, null]);
  const off = { _aimReady: true, _wantAimed: true, _blowShot: { at: T } };
  setPref('enhancedAI', false);
  tacticsStep(off, 0, 1);
  assert.deepEqual([off._aimReady, off._wantAimed, off._blowShot], [false, false, null], 'the switch off too');
});

test('AUDIT TELL B5: a puppet handed to me thinks afresh - its owner\'s held swing, verdict, effect and the stagger or overreach it said stood go with its state; a stagger of my own stays (mutants: the held arm kept; the x1.25 kept for good)', () => {
  const pe = { health: 30, maxHealth: 30, mobileType: M.Orc, level: 12, staggerUntil: PUPPET_HELD_UNTIL, overreachUntil: 0 };
  const ai = { feet: [0, 0, 0], vitals: () => pe, _tac: { puppet: true, state: 'windup' }, _blowHold: true, _blowWind: true, _blowVerdict: true, _blowFx: { kind: 'lunge' }, _perfectAt: 3, _blowLandedAt: 3, _dist: 20, inSight: false, detected: false };
  tacticsStep(ai, 0, 1);
  assert.equal(ai._tac.puppet, undefined);
  assert.deepEqual([ai._blowHold, ai._blowWind, ai._blowVerdict, ai._blowFx, ai._perfectAt, ai._blowLandedAt], [false, false, null, null, null, null]);
  assert.equal(pe.staggerUntil, 0, 'the owner\'s held stagger gone');
  const own = { health: 30, maxHealth: 30, mobileType: M.Orc, level: 12, staggerUntil: T + 1, overreachUntil: PUPPET_HELD_UNTIL };
  const ai2 = { feet: [0, 0, 0], vitals: () => own, _tac: { puppet: true }, _dist: 20 };
  tacticsStep(ai2, 0, 1);
  assert.deepEqual([own.staggerUntil, own.overreachUntil], [T + 1, 0], 'a real stagger kept, the held overreach gone');
});

test('AUDIT TELL B3: a leap lands on its disc only where its foe got to - a jump a ledge or a wall stopped whiffs on the player standing at its point; arrived, it lands (mutants: the leap judged by its point alone)', () => {
  noteLocalPlayer([0, 0, 3], [0, 0, -1]);
  const leap = (feet) => {
    const b = makeBlow('leap', [0, 0, 0], 0, T - 1.05); b.ahead = 3;
    const ai = { feet, canAct: true, vitals: () => ({ health: 50, maxHealth: 50, mobileType: M.Orc, level: 12 }), _tac: { state: 'windup', blow: b, seen: T, key: LOCAL_TARGET } };
    setLiveBlow(ai, b);
    tacticsStep(ai, 0, 1);
    return ai;
  };
  assert.equal(leap([0, 0, 3])._blowVerdict, true, 'arrived: it lands on me at its point');
  resetTactics(); resetBlows();
  noteLocalPlayer([0, 0, 3], [0, 0, -1]);   // (the reset forgets where I stand)
  assert.equal(leap([0, 0, 0.4])._blowVerdict, false, 'stopped short: it whiffs, though I stand in its disc');
});

test('AUDIT TELL O5: a perfect dodge is the dodger\'s own - a miss at a peer opens the owner\'s window but stamps no perfect here (the tag and the bright ring are the peer\'s screen\'s); a miss at me stamps it (mutants: every perfect stamped)', () => {
  const was = Math.random;
  Math.random = () => 0.99;   // no chain after the landing
  try {
    const miss = (target) => {
      const b = makeBlow('lunge', [0, 0, 0], 0, T - 1); b.lateIn = true;   // inside at the late sample, out at the landing
      const ai = { feet: [0, 0, 0], canAct: true, vitals: () => ({ health: 50, maxHealth: 50, mobileType: M.Orc, level: 12 }), _armedTargeting: !!target, target, _tac: { state: 'windup', blow: b, seen: T } };
      b.key = targetKey(ai);
      setLiveBlow(ai, b);
      tacticsStep(ai, 0, 1);
      return ai;
    };
    noteLocalPlayer([3, 0, 3], [0, 0, 1]);
    const atPeer = miss({ isPeer: true, isPlayer: true, id: 'bob', peerId: 'bob', feet: [3, 0, 3] });
    assert.equal(atPeer._tac.state, 'overreach', 'the peer\'s dodge opens the window on the owner');
    assert.equal(atPeer._perfectAt ?? null, null, 'and no perfect of mine');
    resetTactics(); resetBlows();
    noteLocalPlayer([3, 0, 3], [0, 0, 1]);
    const atMe = miss(null);
    assert.equal(atMe._tac.state, 'overreach');
    assert.equal(atMe._perfectAt, T, 'mine');
  } finally { Math.random = was; }
});

test('AUDIT TELL O7: the wire carries the heaviest K there is - a two-handed blunt weapon\'s, 1.5 x 1.15 - and refuses past it (mutants: the cap under a warhammer)', () => {
  const k = blowK({ kind: 'melee', weapon: createWeapon(WEAPONS.Warhammer, 1, () => 0.5) });
  assert.ok(near(k, 1.725), `a warhammer's K ${k}`);
  assert.equal(HIT_CLASS_K_MAX, 175);
  const wc = hitClassField({ k, back: true });
  assert.ok(near(hitClassOf({ wc }).k, 1.73, 1e-9), 'carried whole');
  assert.equal(hitClassOf({ wc: 176 }), null, 'past it, refused');
});

test('AUDIT TELL O6: a puppet\'s gap-closer that landed on me lets its one blow through inside a verdict\'s life, once - never later, never an onlooker\'s (mutants: forever; any landing)', () => {
  const gap = (l) => ({ _tac: { puppet: true, landed: { kind: 'charge', at: T, mine: true, used: false, ...l } } });
  assert.equal(puppetGapLanded(gap({}), T + BLOW_VERDICT_LIFE + 0.01), false, 'past its life');
  const g = gap({});
  assert.equal(puppetGapLanded(g, T + 0.1), true);
  assert.equal(puppetGapLanded(g, T + 0.2), false, 'once');
  assert.equal(puppetGapLanded(gap({ mine: false }), T + 0.1), false, 'an onlooker\'s');
  assert.equal(puppetGapLanded(gap({ kind: 'sweep' }), T + 0.1), false, 'a blow of reach');
});

test('AUDIT TELL B2/B3/B6/B7/B8/B9/B10/B11 by source: the run breaks as the wind-up does; a leap lands only where its foe got to; no feint on a gap closer; the wind-up aimed at its target\'s feet; a turn on another breaks it and a chain fires at its own target; a chain waits for the first verdict; a recentre moves the run\'s head; a plain shot drops a stale aimed one (mutants: each line gone)', () => {
  const t = rd('src/ai/tactics.js');
  assert.match(t, /function dashTurn\(ai, s, now, skipped = false\) \{/, 'B2: the run hears the skipped step');
  assert.match(t, /if \(s\.state === 'dash'\) return dashTurn\(ai, s, now, skipped\);/);
  assert.match(t, /\/\/ AUDIT TELL B3: a leap lands on its disc only where its foe got to/);
  // PIN MOVED (RVN5: a signature and a pyre never feint either - bible/12-Enhanced-AI/Feud-Arc.md 16.1)
  assert.match(t, /if \(chain === 0 && !sig && shape !== 'aimed' && shape !== 'pyre' && !GAP_CLOSERS\.includes\(shape\) && feints\(/, 'B6: a charge and a leap never feint');
  assert.match(t, /\/\/ AUDIT TELL B7: aimed at its TARGET's feet/);
  assert.match(t, /b\.key = targetKey\(ai\);   \/\/ AUDIT TELL B8/);
  assert.match(t, /tf = ck === s\.chainKey \? targetFeet\(ai, ck\) : null;/, 'B8: the chain at its own target');
  assert.match(t, /if \(now < s\.chainAt \|\| \(ai\._blowVerdict != null && now < s\.chainAt \+ CHAIN_SPEND_MAX\)\)/, 'B9');
  assert.match(t, /const CHAIN_SPEND_MAX = 0\.6;/);
  assert.match(rd('src/characters/enemyMotor.js'), /const head = this\._tac\?\.dash\?\.head;   \/\/ AUDIT TELL B10/);
  assert.match(rd('src/characters/enemyAttack.js'), /ai\._tacShot = \(ai\._tacShot \?\? 0\) \+ 1; ai\._blowShot = null; \}/, 'B11');
});

// ── the shatter (3.2, built at last) ────────────────────────────────

test('AUDIT TELL (3.2): a wind-up its poise broke SHATTERS - drawn BLOW_SHATTER more, its fill frozen, going out; never a live blow; a cut feint or a landed one has nothing to break; a recentre moves it; the reset forgets it (mutants: the shatter never drawn; it never ends; it counts as live)', () => {
  assert.equal(BLOW_SHATTER, 0.25);
  const { ai, b } = windingUp();
  const ent = { maxHealth: 20, health: 20 };
  ai._tac.blow.guard = 'poise';
  assert.equal(windupStruck(ai, ent, 600, 100), 'stagger');
  assert.equal(liveBlows().has(ai), false, 'no longer live');
  const d = drawableBlows(T, null);
  assert.equal(d.length, 1);
  assert.equal(d[0].blow, b);
  assert.ok(near(d[0].phase.shatter, 1) && d[0].phase.flash === 0 && near(d[0].phase.t, 0.1 / (b.land - b.start)), JSON.stringify(d[0].phase));
  assert.ok(near(drawableBlows(T + 0.2, null)[0].phase.shatter, 0.2, 1e-9));
  offsetBlows([5, 0, 0]);
  assert.equal(b.origin[0], 5, 'carried by a recentre');
  assert.equal(drawableBlows(T + 0.26, null).length, 0, 'gone after it');
  const c = makeBlow('lunge', [0, 0, 0], 0, T); c.cut = T;
  setLiveBlow(ai, c); shatterBlow(ai, T);
  assert.equal(drawableBlows(T, null).length, 0, 'a cut feint has nothing to break');
  const l = makeBlow('lunge', [0, 0, 0], 0, T - 5);
  setLiveBlow(ai, l); shatterBlow(ai, T);
  assert.equal(drawableBlows(T, null).length, 0, 'nor one already landed');
  setLiveBlow(ai, makeBlow('lunge', [0, 0, 0], 0, T)); shatterBlow(ai, T);
  resetBlows();
  assert.equal(drawableBlows(T, null).length, 0, 'the reset forgets it');
  const P = rd('src/render/foeTelegraph.js');
  assert.match(P, /uniform float uShatter;/);
  assert.match(P, /gl\.uniform1f\(U\.uShatter, phase\.shatter > 0 \? phase\.shatter : 0\);/);
  assert.match(P, /if \(uShatter > 0\.0\) \{[^}]*oColor = telegraphStyle\(dist, inside \? 1\.0 : 0\.0, edge, 1\.0, 0\.0, 0\.0, vec3\(1\.0\), fogK\) \* \(uShatter \* shard\);/, 'white, whole-filled, cracked');
  assert.match(rd('src/ai/puppetBlows.js'), /if \(r\.ws === 1\) shatterBlow\(ai, now\); else setLiveBlow\(ai, null\);/, 'a puppet its owner staggered shatters too');
});

// ── the landing on the player ───────────────────────────────────────

const STILL = { forward: 0, strafe: 0, jump: false };
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function motorOn(col = new Collider(() => 0)) {
  const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 });
  m.spawn(0, 0, 0);
  for (let i = 0; i < 30; i++) m.update(1 / 60, STILL, 0);
  return m;
}
function fakeMotor(accept = true) {
  const calls = [];
  return { calls, blowPush: (x, z) => calls.push(['push', x, z]), blowRattle: (s, k) => calls.push(['rattle', s, k]), blowKnockDown: (s, d) => { calls.push(['down', s, d]); return accept; }, isDown: () => accept };
}

test('AUDIT TELL L1: a dead body takes nothing - no bleed begun, a running one ends, the queue dropped (a tick on a corpse was a second death: two revenants for one) (mutants: the corpse bleeds)', () => {
  const dead = { health: 0 };
  startBleed(dead, 9, { id: 'orc' }, T);
  assert.equal(dead.bleed, undefined, 'none begun');
  const ent = { health: 30 };
  startBleed(ent, 9, { id: 'orc' }, T);
  ent.health = 0;
  let hurt = 0;
  assert.equal(tickBleed(ent, () => { hurt++; }, T + 5), 0);
  assert.equal(ent.bleed, null);
  assert.equal(hurt, 0);
  const mo = fakeMotor();
  queueBlowEffect(blowEffectOf('lunge'), 10, [1, 0], null);
  drainBlowEffects({ motor: mo, entity: { health: 0 } });
  drainBlowEffects({ motor: mo, entity: { health: 20 } });
  assert.deepEqual(mo.calls, [], 'the queue went with the death');
});

test('AUDIT TELL L2: a load forgets the last game\'s landings - the queue, the knockdown, its guard, the bleed; restorePlayer asks it; a placement stands the body up and stills it (mutants: a bleed loaded into the next game; a knockdown through a load)', () => {
  const ent = { health: 30 };
  startBleed(ent, 9, null, T);
  queueBlowEffect(blowEffectOf('slam', true), 10, [1, 0], null);
  drainBlowEffects({ motor: fakeMotor(), entity: ent });
  assert.equal(knockedDown(T + 0.1), true);
  queueBlowEffect(blowEffectOf('lunge'), 10, [1, 0], null);
  resetBlowEffects(ent);
  assert.equal(ent.bleed, null);
  assert.equal(knockedDown(T + 0.1), false);
  const mo = fakeMotor();
  drainBlowEffects({ motor: mo, entity: ent });
  assert.deepEqual(mo.calls, [], 'the queue forgotten');
  queueBlowEffect(blowEffectOf('slam', true), 10, [1, 0], null);
  drainBlowEffects({ motor: mo, entity: ent });
  assert.deepEqual(mo.calls[0], ['down', 0.9, 0.6], 'and the guard: a knockdown at once');
  assert.match(rd('src/systems/save.js'), /for \(const k of ENTITY_FIELDS\) entity\[k\] = snap\[k\];\n\s*resetBlowEffects\(entity\);/);
  const m = motorOn();
  m.blowPush(5, 0); m.blowRattle(0.6, 0.6); m.blowKnockDown(0.9, 0.6);
  m.spawn(3, 0, 3);
  assert.deepEqual([m._pushX, m._pushZ, m._downLeft, m._rattleLeft, m.isDown()], [0, 0, 0, 0, false]);
});

test('AUDIT TELL L3/L4: a body the motor or the hands hold takes no push, and nothing knocks down a climber, a swimmer or a levitator - refused, the guard stands and the blow pushes instead; a push is snapped to the ground only from it (mutants: a push stored for the hold\'s end; a swimmer knocked down)', () => {
  const m = motorOn();
  m.freezeMotor = 1;
  m.blowPush(5, 0);
  m._pushStep(1 / 60);
  assert.deepEqual([m._pushX, m._pushZ], [0, 0], 'a teleport\'s settle drops it');
  m.freezeMotor = 0;
  for (const [k, v] of [['levitating', true], ['swimming', true]]) {
    const b = motorOn();
    b[k] = v;
    assert.equal(b.blowKnockDown(0.9, 0.6), false, `${k}: refused`);
    assert.equal(b.isDown(), false);
  }
  const w = motorOn();
  w._wall = { mode: 'hang', normal: [0, 0, 1], lipY: 2 };
  assert.equal(w.blowKnockDown(0.9, 0.6), false, 'on the wall: refused');
  w.blowPush(5, 0); w._pushStep(1 / 60);
  assert.deepEqual([w._pushX, w._pushZ], [0, 0], 'and no push stored for the let-go');
  w._wall = null;
  const mo = fakeMotor(false);
  queueBlowEffect(blowEffectOf('charge', true), 10, [1, 0], null);
  drainBlowEffects({ motor: mo, entity: { health: 30 } });
  assert.deepEqual(mo.calls, [['down', 0.9, 0.6], ['push', 5, 0]], 'refused, it pushes');
  assert.equal(knockedDown(T + 0.1), false);
  const ok = fakeMotor(true);
  queueBlowEffect(blowEffectOf('charge', true), 10, [1, 0], null);
  drainBlowEffects({ motor: ok, entity: { health: 30 } });
  assert.deepEqual(ok.calls, [['down', 0.9, 0.6]], 'the guard was not spent by the refusal');
  assert.match(rd('src/player/motor.js'), /this\.collider\.move\(this\.pos, dx, 0, dz, this\.height, this\.grounded && !this\.jumping && !this\.swimming && !this\.levitating\);/);
});

test('AUDIT TELL L5: the bleed deals its whole and no more - each tick its share of what is left, rounded, the rest carried; a tick of nothing hurts nothing (mutants: three ticks of 1 for a bleed of 1)', () => {
  for (const [total, want] of [[1, 1], [4, 4], [9, 9], [2, 2], [0.4, 0]]) {
    const ent = { health: 100 };
    const hurts = [];
    startBleed(ent, total, null, 0);
    for (let s = 1; s <= 3; s++) tickBleed(ent, (n) => { hurts.push(n); ent.health -= n; }, s);
    assert.equal(hurts.reduce((a, b) => a + b, 0), want, `${total}: ${JSON.stringify(hurts)}`);
    assert.ok(hurts.every((n) => n > 0), 'no tick of nothing');
  }
});

test('AUDIT TELL L8: the pools ask with what reached health - after the hurt (the court\'s word, a shield), never the roll; the guard\'s after the arrest\'s interception (mutants: the roll asked)', () => {
  for (const [p, v] of [['src/scenes/exteriorFoes.js', 'f'], ['src/scenes/dungeonContext.js', 'f'], ['src/scenes/cityGuards.js', 'g']]) {
    const s = rd(p);
    const at = s.indexOf(`landBlowEffect(${v}, hp0 - playerEntity.health, playerFeet);`);
    const hp = s.lastIndexOf('const hp0 = playerEntity.health;', at);
    assert.ok(at > 0 && hp > 0 && at - hp < 1200, `${p}: asked with the health's fall`);
    const hurt = s.slice(hp, at);
    assert.ok(/onPlayerHurt\?\.\(|hurtPlayer\(dmg\)/.test(hurt), `${p}: after the hurt`);
  }
});

test('AUDIT TELL L9: the swing and the cast are barred while the body is down - a placement that stood it up frees them; the clock alone still bounds it (mutants: knockedDown on the clock alone)', () => {
  const mo = fakeMotor(true);
  let down = true;
  mo.isDown = () => down;
  queueBlowEffect(blowEffectOf('slam', true), 10, [1, 0], null);
  drainBlowEffects({ motor: mo, entity: { health: 30 } });
  assert.equal(knockedDown(T + 0.1), true);
  down = false;
  assert.equal(knockedDown(T + 0.1), false, 'stood up (a load, a rise, a teleport)');
  down = true;
  assert.equal(knockedDown(T + 5), false, 'a body a host left is never down for good');
});

test('AUDIT TELL H1/L6/H6/P1 by source: the foes\' clock held under a dungeon\'s window in every host; the building\'s blow frame runs under a window as the street\'s; the stagger\'s kick reaches every pool and host - the watch, the exterior route, its modes, the standalone dungeon - for my own blow alone; a peer\'s blow on my watch carries its kind (mutants: any one unwired)', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(h), /tickTactics\(foeFrameDt\(_questBoxHoldsFoes\(\) \|\| \(_mode\(\) === 'dungeon' && !!modes\?\.dungeonCtx\?\.uiOverlayActive\) \? 0 : dt\)\);/, h);
  assert.match(rd('src/scenes/dungeon.js'), /tickTactics\(foeFrameDt\(ctx\.uiOverlayActive \? 0 : dt\)\);/);
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /playerBlowFrame\([^\n]*\n\s*if \(!overlayHeld\) \{/, 'L6: above the window gate');
  assert.match(wm, /playerEntity, audio, shake: \(k\) => host\.shakeCamera\?\.\(k\),/, 'H6: the building\'s watch');
  const ex = rd('src/scenes/exterior.js');
  assert.match(ex, /const exteriorFoes = createExteriorFoes\(\{\n[^\n]*\n\s*shake: \(k\) => betterAmbience\.weaponKick\(k\),/, 'H6: the exterior route\'s street pool');
  assert.match(ex, /var modes = createWorldModes\(\{\n\s*climbFeel,[^\n]*\n\s*shakeCamera: \(k\) => betterAmbience\.weaponKick\(k\),/, 'H6: and its modes');
  assert.match(rd('src/scenes/dungeon.js'), /shakeCamera: \(k\) => betterAmbience\.weaponKick\(k\),   \/\/ AUDIT TELL H6/);
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(h), /shake: \(k\) => betterAmbience\.weaponKick\(k\),   \/\/ AUDIT TELL H6: my blow that staggers a watchman/, `${h}: the watch`);
  const cg = rd('src/scenes/cityGuards.js');
  assert.match(cg, /\n\s*shake = null,   \/\/ AUDIT TELL H6/);
  for (const p of ['src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(p), /shake: fromPlayer && !peer && !striker \? (?:opts\.shakeCamera|shake) : null/, `${p}: my own blow's kick alone`);
    assert.match(rd(p), /from: striker\?\.ai\?\.feet \?\? playerFeet, wc, fromPlayer,/, `${p}: U6 - whose blow, to the door`);
  }
  // PIN MOVED (RVN1: one `mine` for the tag and the fight's ledger)
  assert.match(rd('src/scenes/hostCombat.js'), /const mine = fromPlayer && !peer && !striker;[\s\S]*if \(mine\) \{ windupTag\(word, f, true\);[\s\S]*if \(mine\) \{ windupTag\(word, f, false\);/, 'U6: a foe\'s own spell, a SetHealth(0), raises no word of mine (RVN1: one `mine` for the tag and the ledger)');
  assert.match(wm, /hurt: \(g, dmg, at, dir, wc = null, kind = 'melee'\) => interiorGuards\?\.hurtGuard\(g, dmg, at, dir, \{ fromPlayer: false, peer: true, wc, kind \}\)/, 'P1: the building\'s watch as the street\'s');
  // PIN MOVED (AUDIT FEUD: the blow's weakness rides after its feet - blowClassOf's fourth argument; AUDIT FEUD 2: a blow that landed)
  assert.match(rd('src/scenes/dungeonContext.js'), /blowClassOf\(foe\.ai, \{ kind, weapon, claws: !weapon && !!playerEntity\?\.isInBeastForm, round \}, playerFeet, !round && damage > 0 && feudWeakBlow\(/, 'the back judged from the blow\'s own feet, as the local door judges it');
});

// ── the screen ──────────────────────────────────────────────────────

test('AUDIT TELL U1/U2/U8/U10: the bands metres-capped inside the 0.5 m the pass draws; the contrast\'s dark band between its line and its white keyline; the sweep\'s rear disc outlined; nothing past 0.5 m drawn without a discard ahead of the derivatives (mutants: a band uncapped; the dark band gone; the discard back)', () => {
  assert.equal(TELEGRAPH_BAND_CAP, 0.1);
  assert.equal(CONTRAST_BAND_CAP, 0.0625);
  assert.ok(TELEGRAPH_BAND_CAP * 5 <= 0.5 && CONTRAST_BAND_CAP * 7.5 <= 0.5, 'every band ends inside what is drawn');
  const S = TELEGRAPH_STYLE_GLSL;
  assert.equal((S.match(/float aa = min\(max\(fwidth\(edge\), 1e-4\), 0\.1000\);/g) ?? []).length, 2, 'the style and iron');
  assert.equal((S.match(/float aa = min\(max\(fwidth\(edge\), 1e-4\), 0\.0625\);/g) ?? []).length, 1, 'the contrast');
  assert.match(S, /float kd = \(1\.0 - fin\) \* smoothstep\(4\.0 \* aa, 4\.4 \* aa, edge\) \* \(1\.0 - smoothstep\(5\.0 \* aa, 5\.4 \* aa, edge\)\);/);
  assert.match(S, /float kw = \(1\.0 - fin\) \* smoothstep\(5\.0 \* aa, 5\.4 \* aa, edge\) \* \(1\.0 - smoothstep\(7\.0 \* aa, 7\.5 \* aa, edge\)\);/);
  const P = rd('src/render/foeTelegraph.js');
  assert.doesNotMatch(P, /discard/, 'U10');
  assert.match(P, /bool beyond = !inside && dist > 0\.5;[\s\S]*if \(beyond\) oColor = vec4\(0\.0\);[^\n]*\n\}`;/, 'last, after every look');
  assert.match(P, /dist = inside \? \(d < 0\.5 && ang > uP\.y \? 0\.5 - d : min\(uP\.x - d, d >= 0\.5 \? \(uP\.y - ang\) \* d : 1e3\)\) : min\(max\(d - uP\.x, \(ang - uP\.y\) \* d\), d - 0\.5\);/, 'U8');
  const probe = rd('tools/foeTelegraphProbe.mjs');
  for (const n of ['AUDIT TELL U2: contrast - a dark band', 'AUDIT TELL U8: the sweep', 'AUDIT TELL (3.2): the shatter is white and cracked']) assert.ok(probe.includes(n), `the browser probe: ${n}`);
});

test('AUDIT TELL U3/U4/U5: the poise word centred under the track, the quest card clearing it; the flash on THIS foe\'s break alone; the card re-measured when the track comes or goes (mutants: the flash on a target switch; the card blind to the track)', () => {
  const css = rd('src/ui/enhancedStyle.js');
  assert.match(css, /\.hud-poiseword \{ position: absolute; left: 50%; top: calc\(100% \+ 3px\); transform: translateX\(-50%\);/);
  assert.match(css, /body:has\(\.hud-foe\.on\.blade\.poised\) \.qtrack \{ --qt-clear: calc\(18px \+ 28px \* var\(--hud-scale, 1\) \+ 30px \+ 104px \* var\(--hud-scale, 1\)\); \}/);
  assert.match(css, /\.hud-foepoise\.staggered\.flash \.hud-poisefill \{ animation: hud-poise-flash/);
  const hud = rd('src/ui/enhancedHud.js');
  assert.match(hud, /const flash = pk === 'staggered' && last\.foePoiseRef === ref && last\.foePoise !== 'staggered';/);
  assert.match(hud, /parts\.foePoise\.className = `hud-foepoise\$\{p \? ` \$\{p\.state\}` : ''\}\$\{flash \? ' flash' : ''\}`;/);
  assert.match(rd('src/ui/questTracker.js'), /\$\{foe\?\.classList\?\.contains\?\.\('poised'\) \? '\|poised' : ''\}`;/);
});

test('AUDIT TELL U7: no foe\'s wind-up takes the bar from my duel\'s opponent; another foe\'s still yields after THREAT_YIELD_S (mutants: the duel bar stolen)', () => {
  const duel = { entity: { name: 'Bram', health: 10, maxHealth: 20 }, dead: false, duel: true };
  const orc = { entity: { name: 'Orc', health: 30, maxHealth: 30 }, dead: false };
  markFoeStruck(duel);
  tickFoeTarget(THREAT_YIELD_S + 1);
  markFoeThreat(orc);
  assert.equal(foeTarget().name, 'Bram');
  clearFoeTarget();
  const rat = { entity: { name: 'Rat', health: 5, maxHealth: 5 }, dead: false };
  markFoeStruck(rat);
  tickFoeTarget(THREAT_YIELD_S + 0.5);
  markFoeThreat(orc);
  assert.equal(foeTarget().name, 'Orc');
  assert.match(rd('src/scenes/world.js'), /_duelFoe = \{ entity: \{ name: peerName\(d\.peer\) \?\? 'Your opponent', health: 1, maxHealth: 1 \}, dead: false, duel: true \};/);
});

test('AUDIT TELL U9: nothing allocated a frame for a foe with nothing telegraphed, nor for a glint that changes (mutants: a cue list a frame; a glint array a frame)', () => {
  const f = { ai: { feet: [0, 0, 0], _tac: { state: 'engage' } }, mobileType: M.Orc };
  const a = tellCues(f, null, 1, T), b2 = tellCues(f, null, 1, T + 1);
  assert.equal(a, b2, 'the one frozen empty list');
  assert.ok(Object.isFrozen(a) && a.length === 0);
  const { ai } = windingUp();
  const g1 = foeGlint(ai, T), g2 = foeGlint(ai, T + 0.05);
  assert.ok(g1 && g1 === g2, 'the one array, refilled');
  const batch = {};
  setBatchGlint(batch, [1, 0, 0, 0.5]);
  const held = batch.glint;
  setBatchGlint(batch, [1, 0, 0, 0.7]);
  assert.equal(batch.glint, held);
  assert.deepEqual(batch.glint, [1, 0, 0, 0.7]);
});

// ── the arc's promises ──────────────────────────────────────────────

test('AUDIT TELL (8.2, built at last): a sweep\'s bleed drips the player\'s blood whatever the health - at least WOUND_SHARE, every WOUND_WAIT; the hosts\' view says so (mutants: a full-health bleed dry)', () => {
  assert.deepEqual([WOUND_SHARE, WOUND_WAIT], [0.5, 1]);
  const ledger = createBleedLedger({ rng: () => 0.99 });
  const body = {};
  let wound = true;
  const view = () => ({ feet: [0, 0, 0], health: 100, maxHealth: 100, bloodIndex: 0, dead: false, corpse: false, strides: false, wound });
  const drips = [];
  for (let i = 0; i < 180; i++) for (const x of ledger.tick(1 / 60, [body], view)) if (x.kind === 'drip') drips.push(x);
  assert.ok(drips.length >= 2 && drips.length <= 3, `drips a second apart (${drips.length} in 3 s)`);
  assert.ok(drips.every((d) => d.count === 3 && near(d.share, WOUND_SHARE)), JSON.stringify(drips.map((d) => d.count)));
  wound = false;
  const after = [];
  for (let i = 0; i < 600; i++) for (const x of ledger.tick(1 / 60, [body], view)) if (x.kind === 'drip') after.push(x);
  assert.equal(after.length, 0, `healed past ${BLEED_THRESHOLD} and no wound: dry`);
  assert.match(rd('src/scenes/hitEffects.js'), /strides: false, wound: !!entity\.bleed \}\);/);
});

test('AUDIT TELL (10.1/32): the dungeon stream\'s gap is FLAGGED where FEUD writes its fields, and listed with the open flags', () => {
  const d = rd('src/scenes/dungeonContext.js');
  // PIN MOVED (RVN13: the flag names a band follower's `rt` too - no name rides this stream)
  assert.match(d, /\/\/ FLAGGED \(bible\/12-Enhanced-AI\/Feud-Arc\.md 10\.1, section 32\): this stream carries none of the street record's z, nm, yd, ex or sp - FEUD adds its own fields alone \(RVN13: so no band follower's rt either\)\n\s*if \(!f\.dead && f\.ai\._tac && !f\.ai\._tac\.puppet\) Object\.assign\(r, blowWire\(/);
  assert.ok(rd('bible/Home.md').includes('FEUD adds its own fields alone'), 'bible/Home.md\'s open flags');
});

// ── section 28: the duel harness, and the floor it tuned ────────────

test('AUDIT TELL (section 28): the massive floor - no single front blow in the game (every heavy and long weapon, steel and daedric, the reference player and the strongest) breaks the weakest giant DFU rolls; the duel harness says so (mutants: the floor gone; the floor under the largest blow)', async () => {
  assert.equal(TELL.POISE_FLOOR_MASSIVE, 60);
  assert.equal(poiseOf({ maxHealth: ENEMY_BASICS[M.Giant].minHealth }, 3000), 60);
  assert.equal(poiseOf({ maxHealth: 200 }, 3000), 100, 'above the floor, the law');
  assert.equal(poiseOf({ maxHealth: 100 }, 1000), 40, 'a heavy one has none');
  const { massive, TARGETS, fight } = await import('../tools/tellDuel.mjs');
  assert.deepEqual({ ...TARGETS }, { LIGHT_MAX: 0.15, HEAVY_MIN: 0.6, FAIR_TO_70: 0.7 });
  const m = massive(1500);
  assert.equal(m.rows.length, 36);
  const worst = m.rows.reduce((a, x) => (x.share > a.share ? x : a));
  assert.ok(worst.share < 1, `the largest: ${JSON.stringify(worst)}`);
  assert.ok(worst.maxV > 50, 'the strongest daedric warhammer is in it');
  const r = fight({ type: M.Orc, weapon: null, mode: 'dodge', seconds: 20, seed: 7 });
  assert.ok(r.windups + r.iron > 0, 'a fight winds up at me');
  assert.equal(r.hitsOut70, 0, 'FAIR: out of its shape by 70%, never struck');
});

// ── section 29's missing pins ───────────────────────────────────────

const _store = new Map();
globalThis.localStorage ??= {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};
/** The crafted MONSTER.BSA (test/tell1_poise.test.js's) with one career, for `mobileType`. */
function careersFor(mobileType) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  const NAME_FIELD = 14, ENTRY = 18, out = new Uint8Array(4 + b.length + ENTRY), dv = new DataView(out.buffer);
  dv.setInt16(0, 1, true); dv.setUint16(2, 0x0100, true); out.set(b, 4);
  const name = `ENEMY${String(mobileType).padStart(3, '0')}.CFG`;
  for (let i = 0; i < name.length; i++) out[4 + b.length + i] = name.charCodeAt(i);
  dv.setInt32(4 + b.length + NAME_FIELD, b.length, true);
  return out;
}
async function streetPool(mobileType) {
  const { createExteriorFoes } = await import('../src/scenes/exteriorFoes.js');
  const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20, getFrameCount: () => 5 };
  const careers = careersFor(mobileType);
  const me = { isPlayer: true, name: 'Ayla', level: 10, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, health: 100, maxHealth: 100 };
  return createExteriorFoes({
    renderer: { createBillboardBatch: (archive, record, size) => ({ archive, record, size }), destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map(), uploadTexture: () => ({}), uploadEmissionTexture: () => ({}) },
    collider: Object.assign(new Collider(() => 0), { heightAt: () => 0 }),
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return careers; throw new Error(`no ${n} here`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 1000, currentPixelKey: () => '3,12', inLocation: () => true,
    playerEntity: me, audio: { play3d: () => {}, playOneShot: () => {} }, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
    hitEffects: { showMissEffect: () => {}, showBloodSplash: () => {}, bleed: () => {} }, shake: () => {},
  });
}

test('AUDIT TELL (section 29, TELL1): P from the REAL street pool\'s foes - a light, a medium, a heavy and a massive kind, and an elite through its own producer: the class off the door\'s own weight, the kind\'s rolled health with the elite\'s multiplier taken off, the massive floor (mutants: an elite\'s x health in its poise; the floor gone)', async () => {
  const rows = [];
  for (const [type, cls, elite] of [[M.Rat, 'light', false], [M.Orc, 'medium', false], [M.Centaur, 'heavy', false], [M.Giant, 'massive', false], [M.Orc, 'medium', true]]) {
    const pool = await streetPool(type);
    const f = await pool.spawnFoe(type, [0, 0, 0], { feetGiven: true, champion: null, eliteFoe: elite });
    assert.ok(f?.entity, `${type}: spawned`);
    const basics = ENEMY_BASICS[type];
    const w = enemyWeightClassicUnits(f.mobileType >= 128, f.gender, basics.weight ?? 0, f.entity.items);   // the door's own weight (exteriorFoes.js damageFoe)
    assert.equal(weightClass(basics.weight ?? 0), cls, `${type}: the kind is ${cls}`);
    assert.ok(w >= (basics.weight ?? 0), 'its kit only adds (a rolled orc\'s armour can make it heavy)');
    const c = weightClass(w);   // the door's class, kit and all
    const h0 = kindHealth(f.entity);
    if (elite) assert.ok(f.entity.healthMult > 1 && f.entity.maxHealth > h0, 'the elite\'s multiplier written and taken off');
    assert.ok(h0 >= basics.minHealth - 1e-9, `${type}: the kind's own roll (${h0}) at least ${basics.minHealth}`);
    const want = Math.max(h0 * TELL.POISE_W[c], c === 'massive' ? TELL.POISE_FLOOR_MASSIVE : 0) * poiseSpecial(f.entity);
    assert.ok(near(poiseOf(f.entity, w), want, 1e-9), `${type}: P ${poiseOf(f.entity, w)} = ${want}`);
    rows.push(cls);
  }
  assert.deepEqual(rows, ['light', 'medium', 'heavy', 'massive', 'medium']);
});

test('AUDIT TELL (section 29, TELL6e): a push is stopped by a wall - along the collider, never through it (mutants: the push moves raw)', () => {
  const col = new Collider(() => 0);
  col.addMesh('floor', [-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40], [0, 1, 2, 0, 2, 3], I);
  col.addMesh('wall', [0.6, 0, -3, 0.6, 0, 3, 0.6, 3, 3, 0.6, 3, -3], [0, 1, 2, 0, 2, 3], I);
  const m = motorOn(col);
  m.blowPush(5, 0);
  for (let i = 0; i < 60; i++) m.update(1 / 60, STILL, 0);
  assert.ok(m.pos[0] < 0.6, `stopped short of the wall (${m.pos[0].toFixed(3)})`);
  assert.ok(m.pos[0] > 0.1, 'but pushed up to it');
});
