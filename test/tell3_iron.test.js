// TELL3 - IRON BLOWS (bible/12-Enhanced-AI/Feud-Arc.md section 5; Mac, 2026-10-04: "player's can easily stun these
// enemies", then "Go" on every call). TELL1 gave every telegraphed blow a poise to break; some must not break at all.
// Every blow now has a GUARD: 'poise' (amber, TELL1's meter) or 'iron' (red) - iron takes no poise, every blow holds
// it, and only a paralysis stops it (OPEN 4). The slam (and TELL6's ring) of a heavy or massive body is iron; so is one
// elite blow in three. Never by colour alone: the iron mark has a second rim a quarter-metre inside and a hatch across
// its fill; its wind-up runs 0.2 s longer.
// The law (the guard by shape and DFU's weight, the elite's third, the blow's length and colour); on the real motor (a
// giant's slam iron, every blow held and none weighed, landing where it was aimed, red on the body, a paralysis still
// breaking it; an elite's sweep iron, a plain orc's not); the door; the ground's second rim and hatch.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { setTacticsClock, resetTactics, noteLocalPlayer, windupStruck, windupHolds, foeGlint } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, makeBlow, BLOW, BLOW_COLOR, IRON_COLOR, blowShapesOf } from '../src/ai/foeBlows.js';
import { TELL_IRON_EXTRA } from '../src/ai/blowShapes.js';
import { TELL, blowGuard, windupSeconds } from '../src/ai/tells.js';
import { windupDoor } from '../src/scenes/hostCombat.js';
import { TELEGRAPH_STYLE_GLSL, IRON_INSET, IRON_HATCH } from '../src/render/telegraphStyle.js';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

// ── the law ─────────────────────────────────────────────────────────

test('TELL3: the iron numbers - red [1, 0.12, 0.08], 0.2 s longer, an elite\'s third, the slam and the ring (mutants: any moved)', () => {
  assert.deepEqual([...IRON_COLOR], [1.0, 0.12, 0.08]);
  assert.ok(Object.isFrozen(IRON_COLOR));
  assert.notDeepEqual([...IRON_COLOR], [...BLOW_COLOR]);
  assert.equal(TELL_IRON_EXTRA, 0.2);
  assert.equal(TELL.IRON_EXTRA, TELL_IRON_EXTRA, 'homed in the leaf');
  assert.equal(TELL.IRON_ELITE, 1 / 3);
  assert.deepEqual([...TELL.IRON_SHAPES], ['slam', 'ring']);
  assert.equal(IRON_INSET, 0.25);
  assert.equal(IRON_HATCH, 0.35);
});

test('TELL3: the guard - a heavy or massive body\'s slam and ring are iron, by DFU\'s own weight; its sweep and lunge, and a lighter body\'s slam, poise (mutants: the bound moved; any shape iron)', () => {
  assert.equal(blowGuard('slam', 699), 'poise');
  assert.equal(blowGuard('slam', 700), 'iron');
  assert.equal(blowGuard('slam', 3000), 'iron');
  assert.equal(blowGuard('ring', 1000), 'iron');
  assert.equal(blowGuard('ring', 600), 'poise');
  for (const k of ['sweep', 'lunge']) assert.equal(blowGuard(k, 3000), 'poise', `${k}: never iron by weight`);
  assert.equal(blowGuard('slam', NaN), 'poise');
  // the brutes, each by its own weight
  const iron = [], poise = [];
  for (const [name, t] of Object.entries(M)) {
    if (!blowShapesOf(t).includes('slam')) continue;
    (blowGuard('slam', ENEMY_BASICS[t].weight) === 'iron' ? iron : poise).push(name);
  }
  assert.deepEqual(iron.sort(), ['DaedraLord', 'FleshAtronach', 'Giant', 'IronAtronach', 'OrcWarlord']);
  assert.deepEqual(poise.sort(), ['Daedroth', 'Dreugh', 'Gargoyle']);
});

test('TELL3: an elite\'s blow is iron one time in three - whatever its shape, the gold\'s or an Elite Dungeon\'s; the roll drawn only for an elite (mutants: the share moved; every elite blow iron)', () => {
  const el = { eliteFoe: true };
  assert.equal(blowGuard('sweep', 600, el, 0.33), 'iron');
  assert.equal(blowGuard('lunge', 600, el, 0), 'iron');
  assert.equal(blowGuard('sweep', 600, el, 1 / 3), 'poise');
  assert.equal(blowGuard('sweep', 600, el, 0.9), 'poise');
  // PIN MOVED (TELL5, Feud-Arc.md section 9: "an elite (`elite`, `eliteFoe`)"): an Elite Dungeon's foe is an elite too
  assert.equal(blowGuard('sweep', 600, { elite: true }, 0), 'iron', 'an Elite Dungeon\'s foe is an elite');
  assert.equal(blowGuard('sweep', 600, { elite: true }, 0.5), 'poise');
  assert.equal(blowGuard('sweep', 600, null, 0), 'poise');
  const had = Math.random;
  let drawn = 0;
  Math.random = () => { drawn++; return 0.5; };
  try {
    blowGuard('sweep', 600, {});
    blowGuard('slam', 3000, el);
    assert.equal(drawn, 0, 'no roll for a plain foe, none where its shape already decides');
    blowGuard('sweep', 600, el);
    assert.equal(drawn, 1);
  } finally { Math.random = had; }
});

test('TELL3: an iron blow\'s wind-up is 0.2 s longer and says its guard; a poise blow is TACT4\'s (mutants: the extra dropped; the extra on poise)', () => {
  const p = makeBlow('slam', [1, 0, 2], 0.3, 10, BLOW_COLOR);
  assert.equal(p.guard, 'poise');
  assert.equal(p.land, 10 + BLOW.slam.windup);
  const i = makeBlow('slam', [1, 0, 2], 0.3, 10, IRON_COLOR, 'iron');
  assert.equal(i.guard, 'iron');
  assert.ok(Math.abs(i.land - (10 + BLOW.slam.windup + 0.2)) < 1e-12);
  assert.equal(i.color, IRON_COLOR);
  assert.equal(makeBlow('lunge', [0, 0, 0], 0, 0, null, 'nonsense').guard, 'poise', 'anything but iron is poise');
});

// ── on the real motor ───────────────────────────────────────────────

function foe({ level = 12, mobileType = M.Giant, at = [0, 0, 8], ent: extra = {} } = {}) {
  const c = new Collider(() => 0);
  const ent = { health: 300, maxHealth: 300, mobileType, level, ...extra };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => ent });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  return { ai, atk, ent, c, mobileType, entity: ent };
}
function run(foes, secs, player, each = null, paralyzed = false) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    for (const f of foes) { f.ai.update(DT, player, null, paralyzed); f.atk.update(DT, f.ai, player); }
    each?.(s);
  }
}
/** Run until `f` winds up, its rolls pinned at `r` (0.05: the blow's chance passes, the first shape, an elite's iron). */
function untilWindup(f, player, r = 0.05, secs = 60) {
  const had = Math.random;
  Math.random = () => r;
  try {
    for (let s = 0; s < Math.round(secs / DT); s++) {
      run([f], DT, player);
      if (f.ai._tac?.state === 'windup') return liveBlows().get(f.ai) ?? null;
    }
  } finally { Math.random = had; }
  return null;
}

test('TELL3: A GIANT\'S SLAM IS IRON - every blow holds it and none fills a meter; it lands where it was aimed, its wind-up the longer, red on its body (mutants: iron weighed; iron broken)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup(f, player);
  assert.ok(blow, 'it wound one up');
  assert.equal(blow.kind, 'slam');
  assert.equal(blow.guard, 'iron');
  assert.equal(blow.color, IRON_COLOR);
  // PIN MOVED (TELL5, Feud-Arc.md 7.1): its length drawn - the shape's times U(0.9, 1.25) on the pinned roll, iron's after
  assert.ok(Math.abs(blow.land - blow.start - windupSeconds(BLOW.slam.windup, f.ent, { guard: 'iron', roll: 0.05 })) < 1e-9);
  assert.ok(blow.land - blow.start > BLOW.slam.windup * TELL.WINDUP_VARY[0] + TELL.IRON_EXTRA - 1e-9, 'iron\'s extra on the drawn length');
  for (let i = 0; i < 6; i++) assert.equal(windupStruck(f.ai, f.ent, 3000, 1e9), 'hold', `blow ${i + 1}: held`);
  assert.equal(blow.taken, undefined, 'nothing weighed');
  assert.equal(blow.poise, undefined);
  assert.equal(f.ai._tac.state, 'windup');
  assert.equal(liveBlows().get(f.ai), blow, 'its mark stands');
  assert.equal(windupHolds(f.ai), true, 'and a door still withholds its knock');
  assert.deepEqual(foeGlint(f.ai, T).slice(0, 3), [...IRON_COLOR], 'its glint red');
  let verdict = null, at = null;
  run([f], blow.land - T + 0.3, player, () => { if (verdict == null && f.ai._blowVerdict != null) { verdict = f.ai._blowVerdict; at = T; } });
  assert.equal(verdict, true, 'it landed on the feet in its disc');
  assert.ok(at >= blow.land - 1e-9 && at - blow.land < 0.1, 'at its own, longer, landing');
  assert.equal(f.ai.staggered, false);
});

test('TELL3: a paralysis still stops an iron blow (OPEN 4: the spell is the answer to iron) - and staggers nothing (mutants: iron through a paralysis)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup(f, player);
  assert.equal(blow?.guard, 'iron');
  run([f], 0.2, player, null, true);
  run([f], 0.15, player);
  assert.notEqual(f.ai._tac.state, 'windup');
  assert.equal(liveBlows().has(f.ai), false);
  assert.equal(f.ai._blowHold, 'cancel', 'its held swing dropped');
  assert.equal(f.ai.staggered, false);
});

test('TELL3: an elite orc\'s sweep is iron on its third; a plain orc\'s, on the same rolls, is poise and breaks (mutants: the elite never iron)', () => {
  const e = foe({ mobileType: M.Orc, ent: { eliteFoe: true } });
  const player = [0, 0, 0];
  const eb = untilWindup(e, player);
  assert.equal(eb?.guard, 'iron');
  assert.equal(windupStruck(e.ai, e.ent, 600, 1e9), 'hold');
  resetTactics(); resetBlows();
  const o = foe({ mobileType: M.Orc });
  const ob = untilWindup(o, player);
  assert.equal(ob?.guard, 'poise');
  assert.equal(ob.color, BLOW_COLOR);
  assert.equal(windupStruck(o.ai, o.ent, 600, 1e9), 'stagger');
});

test('TELL3: through the door - an iron wind-up answers every blow "hold", so the door writes no knockback (mutants: the door weighs iron)', () => {
  const f = foe();
  const player = [0, 0, 0];
  assert.equal(untilWindup(f, player)?.guard, 'iron');
  const calls = [];
  const audio = { play3d: (clip) => calls.push(clip) };
  for (const opts of [{ kind: 'melee' }, { kind: 'arrow' }, { kind: 'spell' }, { kind: 'melee', from: [0, 0, 20] }]) {
    assert.equal(windupDoor(f, 400, { ...opts, weight: 3000 }, { audio }), 'hold', JSON.stringify(opts));
  }
  assert.equal(f.ai.knockbackSpeed ?? 0, 0);
  assert.equal(f.ai._tac.state, 'windup');
});

// ── the ground ──────────────────────────────────────────────────────

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('TELL3: the iron mark - a second rim a quarter-metre inside and a hatch across its fill, over the style; the pass says which blow is iron (mutants: the uniform never set; the rim or the hatch gone)', async () => {
  assert.match(TELEGRAPH_STYLE_GLSL, /vec4 telegraphIron\(vec4 o, float edge, float fin, vec2 p, vec3 col, float fogK\)/);
  assert.match(TELEGRAPH_STYLE_GLSL, /abs\(edge - 0\.250\)/, 'the second rim, IRON_INSET in');
  assert.match(TELEGRAPH_STYLE_GLSL, /float u = \(p\.x \+ p\.y\) \/ 0\.350;/, 'the diagonal hatch, IRON_HATCH apart');
  const P = rd('src/render/foeTelegraph.js');
  assert.match(P, /uniform float uIron;/);
  assert.match(P, /if \(uIron > 0\.5\) oColor = telegraphIron\(oColor, dist, inside \? 1\.0 : 0\.0, vec2\(across, along\), uColor, fogK\);/);
  const { FoeTelegraphPass } = await import('../src/render/foeTelegraph.js');
  const { gl, calls } = fakeGl();
  const pass = new FoeTelegraphPass(gl);
  calls.length = 0;
  const iron = makeBlow('slam', [0, 0, 0], 0, 0, IRON_COLOR, 'iron'), plain = makeBlow('slam', [0, 0, 0], 0, 0, BLOW_COLOR);
  pass.draw([{ blow: iron, phase: { t: 0.5, flash: 0 } }, { blow: plain, phase: { t: 0.5, flash: 0 } }], I, I);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uIron').map((c) => c[2]), [1, 0]);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uColor').map((c) => c.slice(2)).map((c) => c.map((x) => Math.round(x * 100) / 100)), [[1, 0.12, 0.08], [1, 0.42, 0.12]], 'and its red');
  assert.match(rd('tools/foeTelegraphProbe.mjs'), /TELL3: the iron mark hatches its fill/, 'the probe reads it off a real frame');
});
