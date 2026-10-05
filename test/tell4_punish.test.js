// TELL4 - THE PUNISH WINDOW AND THE PERFECT DODGE (bible/12-Enhanced-AI/Feud-Arc.md section 6; Mac, 2026-10-04:
// "breath more depth into it", then "Go" on every call). Before it a telegraphed blow that missed cost its foe nothing:
// it walked back into the fight. Now a blow that lands on no feet leaves its foe OVERREACHED for its shape's window -
// locked as a stagger locks, its swing's follow-through standing, every blow it takes x1.3, and the first blow that
// lands staggering it (STAGGER_IMMUNE kept). A dodge made late - the feet inside the shape a quarter-second before the
// landing and out at it - is PERFECT: the window half again, a bright parry ring.
// The law (the windows, iron's and the perfect one's, the bound); on the real motor (a miss overreaches - locked, the
// token kept, the spent pose, then RECOVER and the token on; a hit does not; a late dodge is perfect, an early one not;
// the first blow staggers, inside the guard it does not; its place gone ends it); the x1.3; the sprite's spent pose on
// the real frame lists and end to end; the door; the ear.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MobileUnit, PRIMARY_ATTACK_ANIM_SPEED } from '../src/characters/mobileUnit.js';
import { MOBILE_TYPES as M, KNIGHT_CITY_WATCH } from '../src/characters/mobileTypes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { SOUND } from '../src/systems/soundClips.js';
import { setTacticsClock, resetTactics, noteLocalPlayer, windupStruck, releaseTactics, overreachOpen, overreachedNow, tokensOut, LOCAL_TARGET } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, inBlow } from '../src/ai/foeBlows.js';
import { TELL, punishSeconds, staggerSeconds } from '../src/ai/tells.js';
import { blowTakenScale, blowTakenNames, blowTaken } from '../src/systems/blowTaken.js';
import { windupDoor, tellCues } from '../src/scenes/hostCombat.js';

const DT = 1 / 60;
const STEP = 1 / PRIMARY_ATTACK_ANIM_SPEED;
const CAM = [0, 1.6, -5];
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

// ── the law ─────────────────────────────────────────────────────────

test('TELL4: the windows - lunge 1.0, sweep 0.8, slam 1.2, ring 1.0, charge 1.4, leap 1.2 s; iron 0.3 s longer; a perfect dodge half again; x1.3 taken (mutants: any moved)', () => {
  assert.deepEqual({ ...TELL.PUNISH_S }, { lunge: 1.0, sweep: 0.8, slam: 1.2, ring: 1.0, charge: 1.4, leap: 1.2 });
  assert.equal(TELL.PUNISH_IRON, 0.3);
  assert.equal(TELL.PUNISH_TAKEN, 1.3);
  assert.equal(TELL.TELL_LATE, 0.25);
  assert.equal(TELL.PERFECT_WINDOW, 1.5);
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(near(punishSeconds('lunge'), 1.0));
  assert.ok(near(punishSeconds('sweep', 'poise', true), 1.2));
  assert.ok(near(punishSeconds('slam', 'iron'), 1.5));
  assert.ok(near(punishSeconds('charge', 'iron', true), 2.55));
  assert.ok(near(punishSeconds('nonsense'), 1.0), 'a shape with no row: the lunge\'s');
  // the bound: the longest lock one missed blow buys - a perfect dodge of an iron charge, then a light foe's stagger
  const longest = Math.max(...Object.keys(TELL.PUNISH_S).map((k) => punishSeconds(k, 'iron', true))) + Math.max(...Object.values(TELL.STAGGER_S));
  assert.ok(near(longest, 3.95), `${longest}`);
});

// ── on the real motor ───────────────────────────────────────────────

function foe({ level = 12, mobileType = M.Orc, at = [0, 0, 8], health = 100 } = {}) {
  const c = new Collider(() => 0);
  const ent = { health, maxHealth: health, mobileType, level };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => ent });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  const mobile = new MobileUnit(mobileType, ENEMY_BASICS[mobileType], () => 8, () => 0.99);
  return { ai, atk, ent, c, mobile, mobileType, entity: ent, _seq: 0, hits: [] };
}
/** The host's frame: brain, attack, the sprite on the strike edge and the hold, the -1 consumed. */
function run(foes, secs, player, each = null) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    for (const f of foes) {
      f.ai.update(DT, player);
      f.atk.update(DT, f.ai, player);
      const edge = f.atk.swingSeq !== f._seq;
      f._seq = f.atk.swingSeq;
      f.mobile.update(DT, { striking: edge && !f.atk.firedRanged, hold: f.ai._blowHold, hurting: f.ai.hurtKnock || f.ai.staggered }, f.ai.yaw, f.ai.feet, CAM);
      if (f.mobile.doMeleeDamage) { f.hits.push(T); f.mobile.doMeleeDamage = false; }
    }
    each?.(s);
  }
}
function untilWindup(f, player, secs = 60) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    run([f], DT, player);
    if (f.ai._tac?.state === 'windup') return liveBlows().get(f.ai) ?? null;
  }
  return null;
}
/** Stand at `player` until `until`, then step to `out` (a point outside the blow) and run on to `end`. */
function dodge(f, blow, player, until, out, end) {
  run([f], Math.max(0, until - T), player);
  assert.equal(inBlow(blow, out[0], out[2]), false, 'the step is out of it');
  player[0] = out[0]; player[2] = out[2];
  run([f], Math.max(0, end - T), player);
}
/** A step out of the blow, 3.5 m from its foot and 55 degrees off its aim: out of every shape (the lunge's lane, the
 *  sweep's 3.2 m, the slam's disc), still before the foe's eyes and in the fight. */
const SIDE = (f) => {
  const b = liveBlows().get(f.ai), y = b?.yaw ?? 0, o = b?.origin ?? f.ai.feet, a = (55 * Math.PI) / 180;
  const fx = Math.sin(y), fz = Math.cos(y), px = -fz, pz = fx;
  return [o[0] + 3.5 * (Math.cos(a) * fx + Math.sin(a) * px), 0, o[2] + 3.5 * (Math.cos(a) * fz + Math.sin(a) * pz)];
};

test('TELL4: A MISS OVERREACHES - its shape\'s window, locked (the motor\'s CanAct), its token kept, its follow-through standing; then RECOVER, the token on, the pose let go (mutants: no window; the token handed at once; the lock missing)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup(f, player);
  assert.ok(blow, 'it wound one up');
  assert.ok(inBlow(blow, player[0], player[2]), 'I stood in it');
  dodge(f, blow, player, blow.land - 0.45, SIDE(f), blow.land + 0.1);   // out early: a plain dodge
  const s = f.ai._tac;
  assert.equal(s.state, 'overreach');
  assert.ok(Math.abs(s.until - (f.ai._blowLandedAt + punishSeconds(blow.kind))) < 1e-9, 'its shape\'s window');
  assert.equal(f.ai.overreachUntil, s.until);
  assert.equal(f.ent.overreachUntil, s.until);
  assert.equal(f.ai._perfectAt, undefined, 'an early step is no perfect dodge');
  assert.ok(overreachOpen(f.ai));
  run([f], 0.1, player);
  assert.equal(f.ai.canAct, false, 'locked');
  assert.equal(f.ai.overreached, true);
  assert.equal(f.ai.staggered, false, 'not staggered - no Hurt asked');
  assert.equal(f.ai.moving, false);
  assert.equal(f.ai._blowHold, 'spent');
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 1, 'it keeps its token through the window');
  const at = [...f.ai.feet];
  run([f], s.until - T - 0.05, player);
  assert.ok(Math.hypot(f.ai.feet[0] - at[0], f.ai.feet[2] - at[2]) < 0.02, 'it stood its window');
  for (let i = 0; i < 60 && f.ai._tac.state === 'overreach'; i++) run([f], DT, player);
  assert.equal(f.ai._tac.state, 'recover', 'the window shut: the beat after a blow');
  assert.ok(T - s.until < 1 / 16 + DT, 'on the brain\'s next tick');
  assert.equal(f.ai.overreached, false);
  assert.equal(f.ai._blowHold, 'cancel', 'the spent pose let go');
  assert.equal(f.ai.overreachUntil, 0);
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 0, 'and its token handed on (TACT2\'s RECOVER)');
});

test('TELL4: a blow that LANDS opens no window - it recovers as TACT4\'s does (mutants: every landing overreaches)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup(f, player);
  assert.ok(blow && inBlow(blow, 0, 0));
  let verdict = null;
  run([f], blow.land - T + 0.1, player, () => { if (verdict == null && f.ai._blowVerdict != null) verdict = f.ai._blowVerdict; });   // past the brain's next tick
  assert.equal(verdict, true, 'it landed');
  assert.notEqual(f.ai._tac.state, 'overreach');
  assert.equal(f.ai.overreachUntil, 0);
  assert.equal(f.ai._blowHold, false);
});

test('TELL4: A PERFECT DODGE - inside at the late sample, out at the landing: the window half again, the moment stamped (mutants: the sample never taken; taken at the landing; the window unstretched)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup(f, player);
  assert.ok(blow && inBlow(blow, 0, 0));
  dodge(f, blow, player, blow.land - 0.12, SIDE(f), blow.land + 0.1);
  assert.equal(blow.lateIn, true, 'my feet inside a quarter-second out');
  const s = f.ai._tac;
  assert.equal(s.state, 'overreach');
  assert.ok(Math.abs(s.until - (f.ai._blowLandedAt + punishSeconds(blow.kind, blow.guard, true))) < 1e-9, 'half again');
  assert.equal(f.ai._perfectAt, f.ai._blowLandedAt, 'stamped at the landing (the tag, the ring)');
  const g = foe();
  resetTactics(); resetBlows();
  const p2 = [0, 0, 0];
  const b2 = untilWindup(g, p2);
  assert.ok(b2);
  dodge(g, b2, p2, b2.land - 0.4, SIDE(g), b2.land + 0.1);
  assert.equal(b2.lateIn, false, 'already out at the sample');
  assert.ok(Math.abs(g.ai._tac.until - (g.ai._blowLandedAt + punishSeconds(b2.kind, b2.guard))) < 1e-9, 'a plain window');
});

test('TELL4: the first blow on an overreached foe STAGGERS it - its weight\'s length, the window shut, the token on, its Hurt asked; inside the stagger\'s guard it is a plain blow (mutants: the punish never staggers; the guard ignored)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup(f, player);
  dodge(f, blow, player, blow.land - 0.45, SIDE(f), blow.land + 0.1);
  assert.equal(f.ai._tac.state, 'overreach');
  assert.equal(windupStruck(f.ai, f.ent, 600, 0), 'stagger', 'any blow - no meter');
  assert.equal(f.ai._tac.state, 'staggered');
  assert.ok(Math.abs(f.ai.staggerUntil - (T + staggerSeconds(600))) < 1e-9);
  assert.equal(f.ent.staggerUntil, f.ai.staggerUntil);
  assert.equal(f.ai.overreachUntil, 0, 'the window shut');
  assert.equal(f.ent.overreachUntil, 0);
  assert.equal(f.ai._blowHold, 'cancel', 'the swing let go - the Hurt may take it');
  assert.equal(tokensOut(LOCAL_TARGET, 'melee'), 0, 'its token on');
  run([f], 0.1, player);
  assert.equal(f.ai.staggered, true);
  assert.equal(f.mobile.state, 'hurt', 'the stagger\'s Hurt');
  // inside the guard: a plain blow, and the window runs on
  resetTactics(); resetBlows();
  const g = foe();
  const p2 = [0, 0, 0];
  const b2 = untilWindup(g, p2);
  dodge(g, b2, p2, b2.land - 0.45, SIDE(g), b2.land + 0.1);
  g.ai._tac.staggerReady = T + 5;
  assert.equal(windupStruck(g.ai, g.ent, 600, 0), null);
  assert.equal(g.ai._tac.state, 'overreach');
  assert.ok(overreachOpen(g.ai));
});

test('TELL4: an overreached foe takes 30% more from every blow - the registry the formulas\' tail and a spell\'s landing read (mutants: the fold unregistered)', () => {
  assert.ok(blowTakenNames().includes('tell-overreach'));
  T = 4;
  assert.equal(blowTakenScale(null, { overreachUntil: 5 }), 1.3);
  assert.equal(blowTakenScale(null, { overreachUntil: 4 }), 1, 'shut at its end');
  assert.equal(blowTakenScale(null, {}), 1);
  assert.equal(overreachedNow({ overreachUntil: 5 }), true);
  assert.equal(blowTaken(10, null, { overreachUntil: 5 }, null, { kind: 'melee' }), 13);
});

test('TELL4: its place gone ends the window; the switch off opens none (mutants: the release keeps the lock)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup(f, player);
  dodge(f, blow, player, blow.land - 0.45, SIDE(f), blow.land + 0.1);
  assert.equal(f.ai._tac.state, 'overreach');
  releaseTactics(f.ai);
  assert.equal(f.ai._tac.state, 'wait');
  assert.equal(f.ai.overreachUntil, 0);
  assert.equal(f.ent.overreachUntil, 0);
  assert.equal(f.ai._blowHold, 'cancel');
  resetTactics(); resetBlows();
  const g = foe();
  const p2 = [0, 0, 0];
  const b2 = untilWindup(g, p2);
  dodge(g, b2, p2, b2.land - 0.45, SIDE(g), b2.land + 0.1);
  setPref('enhancedAI', false);
  assert.equal(overreachOpen(g.ai), false, 'the switch off: nothing open');
  assert.equal(windupStruck(g.ai, g.ent, 600, 0), null);
});

// ── the sprite ──────────────────────────────────────────────────────

const unit = (type = M.Orc, roll = 0.99) => new MobileUnit(type, ENEMY_BASICS[type], () => 8, () => roll);
function play(m, secs, intent = {}, first = {}) {
  const out = [];
  for (let s = 0; s < Math.round(secs / DT); s++) {
    m.update(DT, { ...intent, ...(s === 0 ? first : {}) }, 0, [0, 0, 0], CAM);
    out.push([m.state, m.frame, m.doMeleeDamage]);
    m.doMeleeDamage = false;
  }
  return out;
}
const struck = (tr) => tr.filter((r) => r[2]).length;

test('TELL4: the spent pose - the held swing strikes once, then its follow-through STANDS (never the list\'s later strike or its rest pose); the word gone, the swing is over (mutants: the pose not held; the second strike played)', () => {
  for (const [type, roll, frame] of [[M.Orc, 0.99, 3], [25, 0, 4], [KNIGHT_CITY_WATCH, 0.99, 2]]) {
    const m = unit(type, roll);
    play(m, 1, { hold: true }, { striking: true });
    const tr = play(m, 2, { hold: 'spent' });
    assert.equal(struck(tr), 1, `${type}: the missed strike, once`);
    assert.equal(m.state, 'attack');
    assert.equal(m.frame, frame, `${type}: the frame after its strike stands`);
    const after = play(m, DT, { hold: false });
    assert.equal(after[0][0], 'idle', `${type}: let go, the swing is over`);
  }
  const h = unit();
  play(h, 1, { hold: true }, { striking: true });
  play(h, 1, { hold: 'spent' });
  play(h, DT, { hold: false, hurting: true });
  assert.equal(h.state, 'hurt', 'a stagger\'s Hurt takes the same frame');
  const d = unit();   // a DFU swing never stands spent
  play(d, DT, {}, { striking: true });
  assert.equal(struck(play(d, 2, { hold: 'spent' })), 2);
});

test('TELL4: END TO END on the real sprite - a miss strikes once, its follow-through stands through the window, no second strike in it (mutants: the window\'s second strike)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup(f, player);
  const h0 = f.hits.length;
  dodge(f, blow, player, blow.land - 0.45, SIDE(f), blow.land + 0.3);
  const until = f.ai._tac.until;
  assert.equal(f.hits.length - h0, 1, 'the missed strike');
  const frame = f.mobile.frame;
  let moved = false;
  run([f], until - T - 0.05, player, () => { if (f.mobile.frame !== frame || f.mobile.state !== 'attack') moved = true; });
  assert.equal(moved, false, 'the pose stood');
  assert.equal(f.hits.length - h0, 1, 'no second strike in the window');
});

// ── the door and the ear ────────────────────────────────────────────

test('TELL4: through the door - an overreached foe answers the first blow "stagger" with its clang (mutants: the door shut to an overreach)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup(f, player);
  dodge(f, blow, player, blow.land - 0.45, SIDE(f), blow.land + 0.1);
  const played = [], sparks = [];
  const word = windupDoor(f, 3, { kind: 'melee', weight: () => 600 }, { audio: { play3d: (c) => played.push(c) }, hitEffects: { showMissEffect: (k) => sparks.push(k) } });
  assert.equal(word, 'stagger');
  assert.ok(played.includes(SOUND.Hit2) && sparks.includes('clang'));
  assert.equal(windupDoor(f, 3, { kind: 'melee', weight: 600 }), null, 'staggered now: the door is DFU\'s');
});

test('TELL4: the ear - a miss still LANDs at its strike; a perfect dodge rings Parry6 bright at the landing, once (mutants: the miss silent; the ring missing or twice)', () => {
  const R = ENEMY_BASICS[M.Orc];
  const mk = () => ({ mobileType: M.Orc, mobile: { meleeSeq: 0 }, ai: { feet: [0, 0, 0], _tac: { state: 'windup', blow: { start: 10, land: 10.8 } }, _blowHold: true } });
  const ear = () => { const calls = []; return { calls, play3d: (clip, at, vol, o) => calls.push({ clip, pitch: o.pitch }) }; };
  const f = mk(), a = ear();
  tellCues(f, a, 1, 10);
  tellCues(f, a, 1, 10.6);
  Object.assign(f.ai, { _tac: { state: 'overreach', blow: null }, _blowLandedAt: 10.8, _blowHold: 'spent', _perfectAt: 10.8 });
  assert.deepEqual(tellCues(f, a, 1, 10.81), [SOUND.Parry6]);
  assert.equal(a.calls.at(-1).pitch, TELL.PERFECT_PITCH);
  f.mobile.meleeSeq++;
  assert.deepEqual(tellCues(f, a, 1, 10.9), [R.attackSound], 'the missed strike still lands in the ear');
  assert.deepEqual(tellCues(f, a, 1, 11.2), []);
  const g = mk(), b = ear();
  tellCues(g, b, 1, 10);
  Object.assign(g.ai, { _tac: { state: 'overreach', blow: null }, _blowLandedAt: 10.8, _blowHold: 'spent', _perfectAt: 3 });
  assert.deepEqual(tellCues(g, b, 1, 10.81), [], 'an older perfect dodge is not this one');
});
