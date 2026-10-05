// TELL2 - THE TELL: BODY, EAR AND GROUND (bible/12-Enhanced-AI/Feud-Arc.md section 4; Mac, 2026-10-04: "breath more
// depth into it", then "Go" on every call). Before it a telegraphed blow's wind-up was a mark on the ground and a foe
// standing still; its swing began at the landing. Now THE WIND-UP IS THE SWING, HELD: the sprite raises its arm as the
// wind-up begins and stands there (`MobileUnit` `hold`); the landing releases it, and its strike frame is the blow. A
// break drops it. The body GLINTS in the blow's colour (both billboard shaders), the ear hears it WIND, RELEASE and
// LAND, and the ground's mark takes the world boss's readable line (a keyline, a brighten "now", a near floor through
// the fog).
// The sprite on the real frame lists (an orc's, a head -1 variant, a DFU swing never held); the attack component and the
// brain on the real motor (the swing begun once, released once, dropped on a break); end to end on the real sprite (no
// strike in the wind-up, the strike within a frame step of the landing); the cues (each once, a person's, a feint's, a
// break's); the glint's curve, its colour and its batch; the shaders, the ground's pass and the three pools, pinned.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MobileUnit, PRIMARY_ATTACK_ANIM_SPEED } from '../src/characters/mobileUnit.js';
import { MOBILE_TYPES as M, KNIGHT_CITY_WATCH } from '../src/characters/mobileTypes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { ATTRACT_RADIUS } from '../src/characters/enemySounds.js';
import { SOUND } from '../src/systems/soundClips.js';
import { setTacticsClock, resetTactics, noteLocalPlayer, windupStruck, releaseTactics, foeGlint } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, setLiveBlow, makeBlow, drawableBlows, BLOW, BLOW_COLOR } from '../src/ai/foeBlows.js';
import { TELL_NOW, TELL_NEAR_M, TELL_NEAR_FLOOR } from '../src/ai/blowShapes.js';
import { TELL, glintStrength } from '../src/ai/tells.js';
import { tellCues } from '../src/scenes/hostCombat.js';
import { GLINT_GLSL, TELL_GLINT_PAD, setBatchGlint, prefersReducedMotion } from '../src/systems/hitFlash.js';
import { nowShare } from '../src/render/foeTelegraph.js';
import { TELEGRAPH_STYLE_GLSL } from '../src/render/telegraphStyle.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
const STEP = 1 / PRIMARY_ATTACK_ANIM_SPEED;   // one attack frame
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

// ── the sprite ──────────────────────────────────────────────────────

const CAM = [0, 1.6, -5];
/** An orc's sprite: `roll` 0.99 its base list [0,1,2,-1,3,4,-1,5,0], 0 its second [4,-1,5,0]. */
const orc = (roll = 0.99, type = M.Orc) => new MobileUnit(type, ENEMY_BASICS[type], () => 8, () => roll);
/** Step `m` for `secs` under `intent` (striking only on the first frame); answers each frame's [frame, damage]. */
function play(m, secs, intent = {}, first = {}) {
  const out = [];
  for (let s = 0; s < Math.round(secs / DT); s++) {
    m.update(DT, { ...intent, ...(s === 0 ? first : {}) }, 0, [0, 0, 0], CAM);
    out.push([m.state, m.frame, m.doMeleeDamage]);
    m.doMeleeDamage = false;   // the host's consume
  }
  return out;
}
const struck = (trace) => trace.filter((r) => r[2]).length;

test('TELL2: a held swing plays to the frame before its first strike and STANDS there - no strike however long (mutants: the -1 consumed under hold)', () => {
  const m = orc();
  const tr = play(m, 3, { hold: true }, { striking: true });
  assert.equal(m.state, 'attack', 'still in its swing');
  assert.equal(m.frame, 2, 'the raised arm: the frame before the -1 of [0,1,2,-1,...]');
  assert.equal(struck(tr), 0, 'no strike while held');
  assert.equal(m.meleeSeq, 0);
  assert.deepEqual([...new Set(tr.map((r) => r[1]))], [0, 1, 2], 'its frames up to the raised arm, in order');
});

test('TELL2: the release strikes on the next frame step - the first -1 the blow\'s, the second a plain DFU strike unheld (mutants: the strike late; the second held)', () => {
  const m = orc();
  play(m, 1, { hold: true }, { striking: true });
  const tr = play(m, 2, { hold: false });
  const firstHit = tr.findIndex((r) => r[2]);
  assert.ok(firstHit >= 0 && (firstHit + 1) * DT <= STEP + 1e-9, `struck within one frame step of the release (${firstHit})`);
  assert.equal(tr[firstHit][1], 3, 'and drew the frame after the -1');
  assert.equal(m.meleeSeq, 2, 'both strikes of the list - the second plain');
  assert.equal(struck(tr), 2);
  assert.equal(m.state, 'idle', 'and the swing ran out');
  const m2 = orc();
  play(m2, 1, { hold: true }, { striking: true });
  play(m2, STEP + DT, { hold: false });
  assert.equal(m2.meleeSeq, 1);
  const tr2 = play(m2, 2, { hold: true });   // a new wind-up's word cannot hold the rest of a released swing
  assert.equal(m2.meleeSeq, 2, 'the second -1 is never held');
  assert.equal(struck(tr2), 1);
});

test('TELL2: a cancel drops the held swing to idle with no strike, and a stagger\'s Hurt takes the same frame (mutants: the cancel ignored; the cancel to anything but idle)', () => {
  const m = orc();
  play(m, 1, { hold: true }, { striking: true });
  const tr = play(m, 2, { hold: 'cancel' });
  assert.equal(struck(tr), 0, 'nothing struck');
  assert.equal(m.meleeSeq, 0);
  assert.equal(tr[0][0], 'idle', 'dropped at once');
  const h = orc();
  play(h, 1, { hold: true }, { striking: true });
  play(h, DT, { hold: 'cancel', hurting: true });
  assert.equal(h.state, 'hurt', 'the Hurt gate refuses an attack - the cancel opened it');
});

test('TELL2: a list that STARTS with its strike holds frame 0 under hold, and strikes at the release; unheld it is DFU\'s up-front strike (mutants: the head -1 struck under hold)', () => {
  const T25 = 25;
  assert.deepEqual(ENEMY_BASICS[T25].primaryAttackAnimFrames2, [-1, 4, 5, 0], 'the variant this pins');
  const m = orc(0, T25);
  const tr = play(m, 1.5, { hold: true }, { striking: true });
  assert.equal(struck(tr), 0);
  assert.equal(m.frame, 0, 'frame 0 held');
  const rel = play(m, 1, { hold: false });
  const i = rel.findIndex((r) => r[2]);
  assert.ok(i >= 0 && (i + 1) * DT <= STEP + 1e-9, 'struck at the next step');
  assert.equal(rel[i][1], 4);
  assert.equal(m.meleeSeq, 1);
  const u = orc(0, T25);
  const tu = play(u, DT, {}, { striking: true });
  assert.equal(struck(tu), 1, 'DFU: flagged at the start, verbatim');
  assert.equal(u.frame, 4);
});

test('TELL2: a DFU swing is never held or dropped - only a swing that began under the hold answers it; unheld the sprite is DFU\'s frame for frame (mutants: any swing held; any swing dropped)', () => {
  const base = play(orc(), 2, {}, { striking: true });
  const asFalse = play(orc(), 2, { hold: false }, { striking: true });
  assert.deepEqual(asFalse, base, 'hold false is no hold at all');
  const held = play(orc(), 2, { hold: true }, { striking: false });
  assert.equal(held[0][0], 'idle', 'a hold with no swing starts none');
  // a plain swing, then the brain's word changes under it
  const m = orc();
  play(m, DT, {}, { striking: true });
  const tr = play(m, 2, { hold: true });
  assert.equal(struck(tr), 2, 'held: no - both strikes land');
  const c = orc();
  play(c, DT, {}, { striking: true });
  const tc = play(c, 2, { hold: 'cancel' });
  assert.equal(struck(tc), 2, 'cancelled: no - both strikes land');
  assert.deepEqual(tc.slice(0, -1), base.slice(1), 'and frame for frame DFU\'s');
});

test('TELL2: a wind-up\'s swing REPLACES a DFU swing in flight, as the attack machine\'s restart does - its strike is the landing\'s, never the old one\'s (mutants: the old swing kept)', () => {
  const m = orc();
  play(m, DT, {}, { striking: true });
  play(m, STEP * 1.5, {});
  assert.equal(m.state, 'attack');
  const tr = play(m, 2, { hold: true }, { striking: true });
  assert.equal(struck(tr), 0, 'the old swing struck nothing');
  assert.equal(m.frame, 2, 'the new one stands at its raised arm');
  assert.equal(m._underHold, true);
  const rel = play(m, 1, { hold: false });
  assert.ok(struck(rel) >= 1 && rel.findIndex((r) => r[2]) * DT < STEP, 'the landing strikes');
});

// ── the attack component and the brain ──────────────────────────────

function foe({ level = 12, mobileType = M.Orc, at = [0, 0, 8] } = {}) {
  const c = new Collider(() => 0);
  const ent = { health: 100, maxHealth: 100, mobileType, level };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => ent });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  const mobile = new MobileUnit(mobileType, ENEMY_BASICS[mobileType], () => 8, () => 0.99);
  return { ai, atk, ent, c, mobile, mobileType, entity: ent, _seq: 0, hits: [] };
}
/** The host's frame, as each pool runs it: brain, attack, the sprite on the strike edge and the hold, the -1 consumed. */
function run(foes, secs, player, each = null) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    for (const f of foes) {
      f.ai.update(DT, player);
      f.atk.update(DT, f.ai, player);
      const edge = f.atk.swingSeq !== f._seq;
      f._seq = f.atk.swingSeq;
      f.mobile.update(DT, { striking: edge && !f.atk.firedRanged, hold: f.ai._blowHold }, f.ai.yaw, f.ai.feet, CAM);
      if (f.mobile.doMeleeDamage) { f.hits.push(T); f.mobile.doMeleeDamage = false; }
    }
    each?.(s);
  }
}
function untilWindup(foes, f, player, secs = 60) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    run(foes, DT, player);
    if (f.ai._tac?.state === 'windup') return liveBlows().get(f.ai) ?? null;
  }
  return null;
}

test('TELL2: the wind-up begins the swing once and holds it; the landing releases it - the brain sees its blow then, never a second swing (mutants: no swing at the start; a second at the landing; the machine idle after it)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup([f], f, player);
  assert.ok(blow, 'it wound one up');
  const seq0 = f.atk.swingSeq, tac0 = f.ai._tacSwung ?? 0;
  assert.equal(f.ai._blowHold, true);
  assert.equal(f.atk._held, true, 'the swing is in flight, held');
  assert.equal(f.mobile.state, 'attack');
  assert.equal(f.mobile._underHold, true);
  let landed = null;
  run([f], 2, player, () => {
    if (T < blow.land) { assert.equal(f.atk.swingSeq, seq0, 'no swing begun mid-wind-up'); assert.equal(f.ai._tacSwung ?? 0, tac0); }
    if (landed == null && T >= blow.land + 0.15) landed = { seq: f.atk.swingSeq, tac: f.ai._tacSwung ?? 0, hold: f.ai._blowHold, held: f.atk._held, swinging: f.atk.machine.state !== 'Idle' };   // released by the attack component's next classic tick
  });
  assert.deepEqual(landed, { seq: seq0, tac: tac0 + 1, hold: false, held: false, swinging: true }, 'released: counted, no second swing - and a swing in flight again (it holds the bow roll, as the forced swing did)');
});

test('TELL2: a broken wind-up drops its swing - the sprite to idle, the attack machine reset, no strike ever (mutants: dropSwing gone; the machine left swinging)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup([f], f, player);
  assert.ok(blow);
  run([f], 0.2, player);
  assert.equal(windupStruck(f.ai, f.ent, 600, 1e6), 'stagger');
  assert.equal(f.ai._blowHold, 'cancel');
  assert.equal(f.ai._blowWind, false);
  const hits0 = f.hits.length;
  run([f], 0.1, player);   // the attack component's classic tick (16 Hz)
  assert.equal(f.atk._held, false);
  assert.equal(f.atk.machine.state, 'Idle', 'the machine\'s swing reset with it');
  assert.notEqual(f.mobile.state, 'attack', 'the sprite let it go');
  run([f], blow.land - T + 0.5, player);
  assert.equal(f.hits.length, hits0, 'nothing struck - not at the landing, not after');
});

test('TELL2: a foe whose place goes mid-wind-up drops its swing too (releaseTactics), and a hold never outlives its wind-up (mutants: the release keeps the hold)', () => {
  const f = foe();
  const player = [0, 0, 0];
  assert.ok(untilWindup([f], f, player));
  releaseTactics(f.ai);
  assert.equal(f.ai._blowHold, 'cancel');
  assert.equal(f.ai._tac.state, 'wait');
});

test('TELL2: END TO END on the real sprite - no strike while it winds up, its strike within a frame step of the landing, at its raised arm the whole stand (mutants: the strike early; late; the arm lowered)', () => {
  for (let k = 0; k < 3; k++) {
    resetTactics(); resetBlows(); T = 0;
    const f = foe();
    const player = [0, 0, 0];
    const blow = untilWindup([f], f, player);
    assert.ok(blow, 'it wound one up');
    const start = T;
    const hits0 = f.hits.length;
    let lowered = false;
    run([f], 1.5, player, () => {
      if (T > start + 0.35 && T < blow.land - 1e-9 && f.mobile.frame !== 2) lowered = true;
    });
    const after = f.hits.slice(hits0);
    assert.ok(after.length >= 1, 'it struck');
    assert.ok(after[0] >= blow.land - 1e-9, `never before the landing (${after[0]} < ${blow.land})`);
    // the brain hears its landing on its next classic tick (16 Hz); the sprite strikes on its next frame step after that
    assert.ok(after[0] - f.ai._blowLandedAt <= STEP + DT + 1e-9, `within a frame step of it (${(after[0] - f.ai._blowLandedAt).toFixed(3)})`);
    assert.ok(f.ai._blowLandedAt - blow.land < 1 / 16 + DT + 1e-9, 'heard on the brain\'s next tick (its 16 Hz, inside a frame)');
    assert.equal(lowered, false, 'the raised arm stood');
  }
});

test('TELL2: END TO END in the ear - on the real motor and sprite, WIND as it winds up, RELEASE before the landing, LAND at its strike, each once and in order (mutants: the landing unstamped)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const a = { calls: [], play3d: (clip) => a.calls.push({ clip, at: T }) };
  const blow = untilWindup([f], f, player);
  assert.ok(blow);
  tellCues(f, a, 1, T);
  const hits0 = f.hits.length;
  run([f], blow.land - T + 0.6, player, () => tellCues(f, a, 1, T));
  const R = ENEMY_BASICS[M.Orc];
  assert.deepEqual(a.calls.map((c) => c.clip), [R.barkSound, SOUND.SwingLowPitch, R.attackSound]);
  assert.ok(a.calls[1].at >= blow.land - TELL.RELEASE_LEAD - 1e-9 && a.calls[1].at < blow.land, 'the release before the landing');
  assert.equal(a.calls[2].at, f.hits[hits0], 'LAND in the strike\'s own frame');
});

// ── the ear ─────────────────────────────────────────────────────────

/** A pool's foe, bare: its brain's wind-up, its sprite's strike count, its kind. */
function cueFoe(mobileType = M.Orc) {
  return { mobileType, mobile: { meleeSeq: 0 }, ai: { feet: [3, 0, 4], _tac: { state: 'engage', blow: null }, _blowHold: false } };
}
function ear() {
  const calls = [];
  return { calls, play3d: (clip, at, vol, o) => calls.push({ clip, at, vol, ...o }) };
}
const windUp = (f, start = 10, land = 10.8, extra = {}) => { f.ai._tac = { state: 'windup', blow: { start, land, ...extra } }; f.ai._blowHold = true; };
const landIt = (f, at = 10.8) => { f.ai._tac = { state: 'engage', blow: null }; f.ai._blowLandedAt = at; f.ai._blowHold = false; };

test('TELL2: the three cues, each once - WIND the bark at 0.85, RELEASE the low swing 0.25 s before, LAND the attack sound at the strike (mutants: any cue twice, early, or at the wrong pitch)', () => {
  const f = cueFoe(), a = ear();
  const R = ENEMY_BASICS[M.Orc];
  windUp(f);
  assert.deepEqual(tellCues(f, a, 1, 10), [R.barkSound]);
  assert.deepEqual(a.calls[0], { clip: R.barkSound, at: [3, 1, 4], vol: 1, maxDistance: ATTRACT_RADIUS, distanceModel: 'linear', pitch: TELL.WIND_PITCH });
  assert.deepEqual(tellCues(f, a, 1, 10.3), [], 'once');
  assert.deepEqual(tellCues(f, a, 1, 10.54), [], 'not before the lead');
  assert.deepEqual(tellCues(f, a, 1, 10.55), [SOUND.SwingLowPitch]);
  assert.equal(a.calls[1].pitch, TELL.RELEASE_PITCH);
  assert.deepEqual(tellCues(f, a, 1, 10.7), [], 'once');
  landIt(f);
  assert.deepEqual(tellCues(f, a, 1, 10.81), [], 'the landing frame - its strike not yet drawn');
  f.mobile.meleeSeq++;
  assert.deepEqual(tellCues(f, a, 1, 10.9), [R.attackSound], 'LAND at the strike');
  assert.equal(a.calls[2].pitch, 1);
  f.mobile.meleeSeq++;
  assert.deepEqual(tellCues(f, a, 1, 11.2), [], 'the list\'s second strike is DFU\'s, not a cue');
  const g = cueFoe(), b = ear();
  windUp(g);
  tellCues(g, b, 2, 10);
  assert.equal(b.calls[0].maxDistance, ATTRACT_RADIUS * 2, 'acute hearing reaches it as it reaches every foe sound');
});

test('TELL2: a strike in the landing\'s own frame still LANDs; a break plays no RELEASE and no LAND (mutants: the land read off a stale stamp; a break\'s strike cued)', () => {
  const f = cueFoe(), a = ear();
  windUp(f);
  tellCues(f, a, 1, 10);
  tellCues(f, a, 1, 10.6);
  landIt(f);
  f.mobile.meleeSeq++;   // the sprite stepped past the release before this call
  assert.deepEqual(tellCues(f, a, 1, 10.82), [ENEMY_BASICS[M.Orc].attackSound]);
  const g = cueFoe(), b = ear();
  g.ai._blowLandedAt = 5;   // an earlier blow's landing
  windUp(g);
  tellCues(g, b, 1, 10);
  g.ai._tac = { state: 'staggered', blow: null }; g.ai._blowHold = 'cancel';
  assert.deepEqual(tellCues(g, b, 1, 10.3), []);
  g.mobile.meleeSeq++;
  assert.deepEqual(tellCues(g, b, 1, 10.9), [], 'no LAND for a broken wind-up');
  assert.deepEqual(b.calls.map((c) => c.clip), [ENEMY_BASICS[M.Orc].barkSound], 'its WIND alone');
});

test('TELL2: a person (muted by DFU) winds up with a quiet low swing and lands silent; the watch keeps its voice; a feint never WINDs (mutants: the mute ignored; a feint\'s WIND)', () => {
  const p = cueFoe(128), a = ear();
  windUp(p);
  assert.deepEqual(tellCues(p, a, 1, 10), [SOUND.SwingMediumPitch]);
  assert.equal(a.calls[0].pitch, TELL.WIND_CLASS_PITCH);
  assert.equal(a.calls[0].vol, TELL.WIND_CLASS_VOLUME);
  tellCues(p, a, 1, 10.6);
  landIt(p); p.mobile.meleeSeq++;
  assert.deepEqual(tellCues(p, a, 1, 10.9), [], 'DFU keeps a person mute');
  const w = cueFoe(KNIGHT_CITY_WATCH), b = ear();
  windUp(w);
  assert.deepEqual(tellCues(w, b, 1, 10), [ENEMY_BASICS[KNIGHT_CITY_WATCH].barkSound], 'the watch is never muted');
  const x = cueFoe(), c = ear();
  windUp(x, 10, 10.8, { feint: true });
  assert.deepEqual(tellCues(x, c, 1, 10), []);
  assert.deepEqual(tellCues(x, c, 1, 10.6), [SOUND.SwingLowPitch], 'its RELEASE still comes');
  assert.equal(tellCues(null, c), null);
  assert.deepEqual(tellCues(cueFoe(), null, 1, 0), [], 'no audio, no throw');
});

// ── the glint ───────────────────────────────────────────────────────

test('TELL2: the glint\'s curve - a flare to 0.9 falling to a 0.2 rim over 0.15 s, a rise to 1 through the last 0.2 s; reduced motion a steady 0.45 (mutants: any leg moved)', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(near(glintStrength(0, 0.8), 0.9));
  assert.ok(near(glintStrength(0.075, 0.7), 0.55));
  assert.ok(near(glintStrength(0.15, 0.6), 0.2));
  assert.ok(near(glintStrength(0.4, 0.3), 0.2));
  assert.ok(near(glintStrength(0.6, 0.2), 0.2));
  assert.ok(near(glintStrength(0.7, 0.1), 0.6));
  assert.ok(near(glintStrength(0.8, 0), 1));
  assert.ok(near(glintStrength(0.05, 0.05), 0.2 + 0.8 * 0.75), 'a short wind-up: the greater of the two');
  assert.equal(glintStrength(0.3, 0.3, true), TELL.GLINT_REDUCED);
  assert.equal(glintStrength(0, 0.8, true), 0.45, 'no flare');
  assert.equal(glintStrength(-0.01, 0.8), 0);
  assert.equal(glintStrength(0.3, -0.01), 0, 'past the landing: none');
  assert.equal(glintStrength(NaN, 0.5), 0);
  assert.equal(TELL.TELL_NOW, TELL_NOW, 'the ground\'s numbers homed in the leaf');
  assert.equal(TELL.NEAR_M, TELL_NEAR_M);
  assert.equal(TELL.NEAR_FLOOR, TELL_NEAR_FLOOR);
});

test('TELL2: a foe\'s glint is its blow\'s colour at the curve\'s strength - none out of a wind-up, none for a feint (mutants: a feint glints; the colour lost)', () => {
  const ai = { _tac: { state: 'windup', blow: { start: 2, land: 2.8, color: [1, 0.12, 0.08] } } };
  assert.deepEqual(foeGlint(ai, 2), [1, 0.12, 0.08, 0.9]);
  assert.deepEqual(foeGlint(ai, 2.4), [1, 0.12, 0.08, 0.2]);
  assert.deepEqual(foeGlint(ai, 2.4, true), [1, 0.12, 0.08, 0.45]);
  ai._tac.blow.color = null;
  assert.deepEqual(foeGlint(ai, 2.4).slice(0, 3), [...BLOW_COLOR]);
  assert.equal(foeGlint(ai, 2.9), null, 'past its landing');
  ai._tac.blow.feint = true;
  assert.equal(foeGlint(ai, 2.4), null, 'a feint never glints');
  assert.equal(foeGlint({ _tac: { state: 'engage', blow: ai._tac.blow } }, 2.4), null);
  assert.equal(foeGlint({}, 0), null);
  assert.equal(foeGlint(null, 0), null);
});

test('TELL2: the glint on the batch - written only when it changes, cleared at none; reduced motion read at most once a second, false with no window (mutants: rewritten each frame; never cleared)', () => {
  const b = {};
  setBatchGlint(b, [1, 0.4, 0.1, 0.5]);
  const g = b.glint;
  assert.deepEqual(g, [1, 0.4, 0.1, 0.5]);
  setBatchGlint(b, [1, 0.4, 0.1, 0.5]);
  assert.equal(b.glint, g, 'the same glint is not rewritten');
  setBatchGlint(b, [1, 0.4, 0.1, 0.6]);
  assert.deepEqual(b.glint, [1, 0.4, 0.1, 0.6]);   // PIN MOVED (AUDIT TELL U9): rewritten in place, no array a frame
  assert.equal(b.glint, g, 'the same array');
  setBatchGlint(b, [1, 0.4, 0.1, 0]);
  assert.equal(b.glint, undefined, 'strength 0 is none');
  setBatchGlint(b, [1, 0.4, 0.1, 0.6]);
  setBatchGlint(b, null);
  assert.equal(b.glint, undefined);
  setBatchGlint(null, [1, 1, 1, 1]);
  assert.deepEqual(TELL_GLINT_PAD, [0.001, 0.001, 0.001, 0.001]);
  assert.ok(Object.isFrozen(TELL_GLINT_PAD));
  const had = globalThis.matchMedia;
  let asked = 0, reduce = true;
  globalThis.matchMedia = (q) => { asked++; assert.equal(q, '(prefers-reduced-motion: reduce)'); return { matches: reduce }; };
  try {
    assert.equal(prefersReducedMotion(1e12), true);
    reduce = false;
    assert.equal(prefersReducedMotion(1e12 + 999), true, 'cached');
    assert.equal(asked, 1);
    assert.equal(prefersReducedMotion(1e12 + 1000), false, 'read again after a second');
    globalThis.matchMedia = () => { throw new Error('no'); };
    assert.equal(prefersReducedMotion(1e12 + 3000), false, 'a throw is no');
    delete globalThis.matchMedia;
    assert.equal(prefersReducedMotion(1e12 + 5000), false, 'no window, no');
  } finally { if (had) globalThis.matchMedia = had; else delete globalThis.matchMedia; }
});

test('TELL2: both billboard shaders take the glint - the outline in its colour by the elite rim\'s texel test, the body lifted toward it; the renderer uploads it, resets it, and widens the quad for it (mutants: any wire cut)', () => {
  assert.match(GLINT_GLSL, /vec3 glintRimColor\(vec4 g\)/);
  assert.match(GLINT_GLSL, /return mix\(lit, c, clamp\(g\.a, 0\.0, 1\.0\) \* 0\.45\);/);
  const R = rd('src/render/renderer.js'), EL = rd('src/render/enhancedLighting.js');
  for (const [name, src] of [['BB_FS', R], ['EL_BB_FS', EL]]) {
    assert.match(src, /uniform vec4 uGlint;/, name);
    assert.match(src, /\$\{GLINT_GLSL\}/, name);
    assert.match(src, /if \(uGlint\.a > 0\.0 && uConceal\.x == 0\.0 && uDissolve\.x <= 0\.0 && eliteRim\(uTex, uv\) > 0\.0\)/, `${name}: the rim, never round a concealed or burning body`);
    const gl = src.indexOf('lit = glintLit('), hf = src.indexOf('lit = hitFlashLit(lit, albedo + emission, uHitFlash)');
    assert.ok(gl > 0 && hf > gl, `${name}: the glint under the hit's red`);
  }
  assert.match(EL, /glintLit\(lit, albedo \+ emission, vec4\(elDecode\(uGlint\.rgb\), uGlint\.a\)\)/, 'the lane decodes it');
  assert.match(R, /this\.bbUGlint = gl\.getUniformLocation\(this\.bbProgram, 'uGlint'\)/);
  assert.match(R, /gl\.uniform4f\(this\.bbUGlint, 0, 0, 0, 0\);[^\n]*\n\s*this\._bbGlintOn = false;/, 'reset with the frame');
  assert.match(R, /if \(gt \|\| this\._bbGlintOn\) \{ gl\.uniform4f\(this\.bbUGlint/);
  assert.match(R, /const ep = eg !== 0 \? b\.elitePad : \(gt \? TELL_GLINT_PAD : null\);/, 'the outline\'s room');
  assert.match(R, /elitePad: undefined, glint: undefined,/, 'a batch born without one');
});

// ── the ground ──────────────────────────────────────────────────────

test('TELL2: the ground\'s mark takes the boss\'s line from a leaf - premultiplied over the floor, "now" through its last 0.2 s, never lost near me (mutants: the blend additive; the floor dropped)', () => {
  assert.doesNotMatch(rd('src/render/telegraphStyle.js'), /^import /m, 'a leaf');
  assert.match(TELEGRAPH_STYLE_GLSL, /vec4 telegraphStyle\(float edge, float fin, float s, float t, float nowK, float flash, vec3 col, float fogK\)/);
  assert.match(TELEGRAPH_STYLE_GLSL, /keyl \* 0\.55/, 'the dark keyline');
  assert.match(TELEGRAPH_STYLE_GLSL, /return vec4\(rgb \* fogK, clamp\(a, 0\.0, 1\.0\) \* fogK\);/, 'premultiplied');
  const P = rd('src/render/foeTelegraph.js');
  assert.match(P, /import \{ TELEGRAPH_STYLE_GLSL \} from '\.\/telegraphStyle\.js';/);
  assert.match(P, /gl\.blendFunc\(gl\.ONE, gl\.ONE_MINUS_SRC_ALPHA\)/);
  assert.doesNotMatch(P, /blendFunc\(gl\.ONE, gl\.ONE\)/);
  assert.match(P, /float fogK = max\(fogFactorAt\(vWorld\), uNearFloor\);/);
  assert.match(P, /gl\.uniform1f\(U\.uNow, phase\.flash > 0 \? 0 : nowShare\(b, phase\)\);/);
  const b = makeBlow('lunge', [0, 0, 0], 0, 0);
  const w = BLOW.lunge.windup;
  assert.equal(nowShare(b, { t: 0 }), 0);
  assert.equal(nowShare(b, { t: 1 - TELL_NOW / w }), 0);
  assert.ok(Math.abs(nowShare(b, { t: 1 - TELL_NOW / 2 / w }) - 0.5) < 1e-9);
  assert.equal(nowShare(b, { t: 1 }), 1);
  // the near floor: within 6 m of me, at 0.6; past it, the fog's own
  const ai1 = {}, ai2 = {};
  setLiveBlow(ai1, makeBlow('slam', [0, 0, 5], 0, 0));
  setLiveBlow(ai2, makeBlow('slam', [0, 0, 7], 0, 0));
  const d = drawableBlows(0.1, [0, 0, 0]);
  assert.deepEqual(d.map((x) => x.nearFloor), [TELL_NEAR_FLOOR, 0]);
  assert.deepEqual(drawableBlows(0.1, null).map((x) => x.nearFloor), [0, 0], 'no player, no floor');
});

// ── the pools ───────────────────────────────────────────────────────

test('TELL2: all three pools wire it - the hold into the sprite, the strike clip held for the WIND, the cues after the sprite, the glint beside the hit flash (mutants: any pool unwired)', () => {
  const pools = [
    ['src/scenes/exteriorFoes.js', 'f', 'hold: f.ai._blowHold,'],
    ['src/scenes/dungeonContext.js', 'f', 'hold: _puppet ? (_pb?.hold ?? false) : f.ai._blowHold,'],   // PIN MOVED (TELL8: a puppet's on its host's word)
    ['src/scenes/cityGuards.js', 'g', 'hold: g.ai._blowHold,'],
  ];
  for (const [file, v, hold] of pools) {
    const src = rd(file);
    assert.ok(src.includes(hold), `${file}: the hold`);
    assert.ok(src.includes(`${v}.ai._blowHold !== true`), `${file}: the strike clip held`);
    const upd = src.indexOf(hold), cue = src.indexOf(`tellCues(${v}, audio, acuteHearingMultiplier(playerEntity));`, upd);   // PIN MOVED (TELL8: a puppet's cues stand in its own branch too - the owner's are the first after its sprite)
    assert.ok(cue > upd && cue - upd < 400, `${file}: the cues right after the sprite`);
    assert.ok(src.includes(`setBatchGlint(${v}.batch, foeGlint(${v}.ai, undefined, prefersReducedMotion())`), `${file}: the glint`);   // PIN MOVED (RVN4: else phase two's rim, after it)
  }
  // PIN MOVED (TELL8: a puppet's cues are its own - its owner's wind-up rides the wire, ai/puppetBlows.js)
  assert.ok(!/if \(!_puppet\) tellCues\(f, audio/.test(rd('src/scenes/dungeonContext.js')), 'a puppet\'s cues play here');
  assert.match(rd('src/scenes/exteriorFoes.js'), /const _pb = f\.ai\._tac\?\.puppet \? puppetBlowTurn\(f\.ai, playerFeet\) : NO_PUPPET_BLOW;[\s\S]{0,4000}tellCues\(f, audio, acuteHearingMultiplier\(playerEntity\)\);   \/\/ TELL8/);
});
