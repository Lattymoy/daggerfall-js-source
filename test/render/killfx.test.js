// STOREFRONT (2026-10-29, the owner: "kill effects would be a brand new feature"; bible/06-Systems/Storefront.md sections
// 4, 5, 7 and 9). The effects' engine (render/killFx.js): every recipe - the kill looks, the portal skins' bursts and the
// mount looks' beats - a burst within its budget, the kills and the breaths under caps of their own, none begun past
// sight, flown, lit, shifted and cleared; a kill's place off a pool's foe (systems/playerKills.js killFxOf); the four
// hosts' engine wiring it; and the profile's stage trying one on (render/effectStage.js, the burn in its shaders).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  KillFx, KillFxPass, KFX_RECIPES, KILL_FX_LOOKS, KFX_GHOST_S, KILL_FX_EDGE, KFX_LIGHT, KFX_POOL_CAP, KFX_POOL_OF, KFX_FADE_S, KFX_FAR_M, KFX_MAX_INSTANCES,
  KFX_FLOATS, KFX_LAYER_BYTES, KILL_FX_PROGRAMS, KILL_FX_FS,
} from '../../src/render/killFx.js';
import { KILL_EFFECTS } from '../../src/net/effectLaw.js';
import { PORTAL_SKIN, dressPlace } from '../../src/scenes/portalSkins.js';
import { PORTAL_SIZE, PORTAL_MS, portalOpenAt } from '../../src/scenes/portalFx.js';
import { killFxOf } from '../../src/systems/playerKills.js';
import { createEffectStage, stageKillShare, stageTopAt, stageHoldS, STAGE_KILL_S, STAGE_PORTAL_MS, STAGE_PORTAL_TOP } from '../../src/render/effectStage.js';
import { STAGE_BURN_GLSL } from '../../src/render/characterStage.js';
import { ortho, lookAt, multiply } from '../../src/world/mat4.js';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';
import { ALLOC_CHILD_ARGS } from '../allocChild.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
/** A WebGL2 that answers every call and records it: a token for a create or a uniform's place, yes to every status. */
function recordingGl() {
  const calls = [];
  let made = 0;
  const gl = new Proxy({}, {
    get(_, name) {
      if (typeof name !== 'string') return undefined;
      if (/^[A-Z][A-Z0-9_]*$/.test(name)) return name;
      return (...args) => {
        calls.push([name, ...args]);
        if (name.startsWith('create')) return { made: ++made, kind: name.slice(6) };
        if (name === 'getUniformLocation') return { uniform: args[1] };
        if (name === 'getProgramParameter' || name === 'getShaderParameter') return true;
        return name === 'getExtension' ? null : undefined;
      };
    },
  });
  return { gl, calls };
}

test('STOREFRONT the recipes: a recipe a kill look, a portal skin\'s every burst and a mount look\'s beat; each a burst of parts within its budget, none past the instance cap together; the kills\' ghosts, edges and lights a look each (mutants: a look with no recipe; a burst past the cap)', () => {
  assert.deepEqual([...KILL_FX_LOOKS], [...KILL_EFFECTS]);
  for (const look of KILL_FX_LOOKS) {
    assert.ok(KFX_RECIPES.includes(look), look);
    assert.ok(KFX_GHOST_S[look] > 0.3 && KFX_GHOST_S[look] < 1.5, `${look}: its ghost burns in under a second and a half`);
    assert.equal(KILL_FX_EDGE[look].length, 3);
    assert.ok(KFX_LIGHT[look], `${look}: its light`);
  }
  for (const skin of Object.values(PORTAL_SKIN)) {
    assert.ok(KFX_RECIPES.includes(skin.open), skin.open);
    if (skin.ambient) assert.ok(KFX_RECIPES.includes(skin.ambient.recipe), skin.ambient.recipe);
  }
  for (const m of ['warhorse', 'spectral', 'dawnfire', 'automaton']) assert.ok(KFX_RECIPES.includes(`mount-${m}`), m);
  const fx = new KillFx({ rng: seeded() });
  assert.deepEqual(Object.keys(KFX_POOL_OF).sort(), [...KFX_RECIPES].sort(), 'every recipe its pool');
  for (const r of KFX_RECIPES) {
    fx.clear();
    assert.ok(KFX_POOL_CAP[KFX_POOL_OF[r]] > 0, `${r}: a pool with room`);
    const b = fx.start(r, [0, 0, 0], { h: 1.8, w: 0.8, dir: [0, 1], pace: 2 });
    assert.ok(b && b.parts.length > 0 && b.parts.length <= 260, `${r}: ${b?.parts.length} parts`);
    for (const p of b.parts) assert.ok(p.life > 0 && p.s0 >= 0 && p.p.every(Number.isFinite), `${r}: a whole part`);
  }
  // THE VISUAL PASS: a kill look's ground rings grow by the body's width, no wider than the Pyre's (its floor's least,
  // 2.4 m) - Tonal Shatter's fixed 4 to 5.6 m ran past a small foe's ground and off the shop's stage
  for (const look of KILL_FX_LOOKS) for (const w of [0.4, 0.8]) {
    fx.clear();
    const rings = /** @type {any} */ (fx.start(look, [0, 0, 0], { h: 1.8, w })).parts.filter((/** @type {any} */ p) => p.shape === 6);
    for (const p of rings) assert.ok(p.s1 <= Math.max(2.4, w * 3.75) + 1e-9, `${look} at width ${w}: a ring to ${p.s1} m`);
  }
  fx.clear();
  for (const look of KILL_FX_LOOKS) for (let i = 0; i < 3; i++) fx.start(look, [i, 0, 0], { h: 1.8 });
  assert.ok(fx.build() > 0);
  assert.ok(fx.nAlpha + fx.nAdd <= KFX_MAX_INSTANCES, 'every live kill within the cap');
  assert.equal(KILL_FX_PROGRAMS.length, 1);
});

test('STOREFRONT THE BUDGET (AUDIT STOREFRONT RENDER L8): a burst\'s pool is its recipe\'s, never its caller\'s word - a portal\'s opening and a fissure\'s waking never take a kill\'s room, a crowd of horses never takes the fissure\'s steam; a pool full, its oldest FADES out over KFX_FADE_S, drawn dimmer, never cut whole mid-life; nothing begun past KFX_FAR_M of the eye (mutants: one cap for every pool; an opening in the kills\' pool; the oldest spliced; the fade never drawn)', () => {
  assert.deepEqual(KILL_FX_LOOKS.map((l) => KFX_POOL_OF[l]), ['kill', 'kill', 'kill', 'kill']);
  for (const skin of Object.values(PORTAL_SKIN)) {
    assert.equal(KFX_POOL_OF[skin.open], 'event', skin.open);
    if (skin.ambient) assert.equal(KFX_POOL_OF[skin.ambient.recipe], 'place', skin.ambient.recipe);
  }
  assert.deepEqual(['fissure-wake', 'fissure-steam', 'tremor-dust', 'mount-warhorse'].map((r) => KFX_POOL_OF[r]), ['event', 'place', 'place', 'mount']);
  assert.equal(Object.values(KFX_POOL_CAP).reduce((a, n) => a + n, 0), 12 + 40, 'the same room as the kills\' 12 and a shared 40, split');
  const fx = new KillFx({ rng: seeded(3) });
  const live = (pool) => fx.bursts.filter((b) => b.pool === pool && b.fade < 0);
  for (let i = 0; i < KFX_POOL_CAP.kill; i++) fx.start('ashen', [i, 0, 0], { h: 1.8 });
  fx.start('fissure-steam', [0, 0, -5]);
  for (let i = 0; i < 4; i++) fx.start('portal-brass-open', [0, 0, 9 + i], { h: 2.5, w: 1.6 });
  fx.start('fissure-wake', [0, 0, 20], { h: 2, w: 6 });
  assert.equal(live('kill').length, KFX_POOL_CAP.kill, 'the openings and the waking took no kill\'s room');
  for (let i = 0; i < KFX_POOL_CAP.mount * 3; i++) fx.start('mount-warhorse', [0, 0, i], { pace: 2 });
  assert.equal(live('mount').length, KFX_POOL_CAP.mount);
  assert.equal(live('place').length, 1, 'the horses took nothing of the steam\'s');
  // a full pool: the oldest fades, drawn dimmer, and is gone once its fade is done (each 100 m apart, so each is told by place)
  const ev = new KillFx({ rng: seeded(8) });
  for (let i = 0; i < KFX_POOL_CAP.event; i++) ev.start('portal-daedric-open', [i * 100, 0, 0], { h: 2.5, w: 1.6 });
  ev.step(0.05); ev.step(0.05);
  const first = ev.bursts[0];
  const drawnFirst = () => { ev.build(); let a = 0; for (const [B, n] of [[ev.alpha, ev.nAlpha], [ev.add, ev.nAdd]]) for (let k = 0; k < n; k++) if (Math.abs(B[k * KFX_FLOATS]) < 50) a += B[k * KFX_FLOATS + 9]; return a; };
  const before = drawnFirst();
  ev.start('portal-daedric-open', [KFX_POOL_CAP.event * 100, 0, 0], { h: 2.5, w: 1.6 });
  assert.ok(ev.bursts.includes(first) && first.fade === 0, 'the oldest is fading, not cut whole');
  assert.equal(ev.bursts.filter((b) => b.fade < 0).length, KFX_POOL_CAP.event);
  for (let i = 0; i < 3; i++) ev.step(0.05);
  const fading = drawnFirst();
  assert.ok(ev.bursts.includes(first) && fading > 0 && fading < before * 0.6, `drawn dimmer as it fades (${fading.toFixed(2)} against ${before.toFixed(2)})`);
  for (let i = 0; i < 3; i++) ev.step(0.05);
  assert.ok(!ev.bursts.includes(first) && KFX_FADE_S <= 0.3, 'gone once faded');
  assert.equal(fx.start('pyre', [KFX_FAR_M + 1, 0, 0], { eye: [0, 0, 0] }), null, 'past sight');
  assert.equal(fx.start('nope', [0, 0, 0]), null);
});

test('STOREFRONT the flight: a burst flies, fades and is let go; its lights glow and die; a shift of the floating origin moves every part and light; a portal\'s opening lights its ground; less motion, a dimmer flash (mutants: a burst never let go; the shift forgetting the lights)', () => {
  const fx = new KillFx({ rng: seeded(5) });
  fx.start('pyre', [0, 0, 0], { h: 1.8 });
  assert.ok(fx.light(), 'the pyre lights the ground');
  fx.shift([10, 0, 0]);
  assert.ok(fx.bursts[0].parts.every((p) => p.p[0] > 5), 'every part with the origin');
  for (let i = 0; i < 400; i++) fx.step(0.05);
  assert.equal(fx.bursts.length, 0, 'let go');
  assert.equal(fx.light(), null);
  assert.ok(new KillFx().start('portal-daedric-open', [0, 0, 0], { h: 2.5, w: 1.6 }) && KFX_LIGHT['portal-daedric-open']);
  const light = (look, reduced) => new KillFx({ rng: seeded(9), reduced }).start(look, [0, 0, 0], { h: 1.8 }).parts.reduce((a, p) => a + p.a0, 0);
  for (const look of KILL_FX_LOOKS) assert.ok(light(look, true) < light(look, false), `${look}: less motion, a dimmer flash`);
});

test('STOREFRONT the kill\'s place: a pool\'s foe its feet, its height, its width and the body as drawn - none for a body cast only for its shadow, already freed or concealed; every pool tells it with its kill (mutants: a hidden body ghosted; a pool telling none)', () => {
  const f = { ai: { feet: [1, 2, 3], height: 2.2 }, batch: { size: { w: 0.9, h: 2 } } };
  assert.deepEqual(killFxOf(f), { at: [1, 2, 3], h: 2.2, w: 0.9, batch: f.batch });
  assert.equal(killFxOf({ ...f, batch: { ...f.batch, castOnly: true } }).batch, null);
  assert.equal(killFxOf({ ...f, batch: { ...f.batch, conceal: { mode: 2 } } }).batch, null);
  assert.equal(killFxOf({ ai: {} }), null);
  assert.match(rd('src/scenes/exteriorFoes.js'), /reportPlayerKill\(f\.entity, \{ kind, fx: killFxOf\(f\) \}\)/);
  assert.match(rd('src/scenes/exteriorFoes.js'), /reportPlayerKill\(f\.entity, \{ kind: 'remote', fx: killFxOf\(f\) \}\)/);
  assert.match(rd('src/scenes/dungeonContext.js'), /fx: killFxOf\(foe\)/);
  assert.match(rd('src/scenes/cityGuards.js'), /\{ kind: 'melee', fx: killFxOf\(g\) \}/);
  const m = rd('src/scenes/hostMagic.js');
  assert.match(m, /killFx: \(look, at, o\) => playKill\(look, at, o\),/, 'the engine\'s door to a kill effect');
  assert.match(m, /burst: \(recipe, at, o\) => !!killFx\.start\(recipe, at, \{ \.\.\.\(o \?\? \{\}\), eye: renderer\?\._camPos \?\? null \}\),/, 'and to a portal\'s and a horse\'s burst');
  assert.match(m, /playStorefrontSound\(audio, `storefront:kill-\$\{look\}`, at, 1, \{ maxDistance: 30 \}\);/, 'its own sound');
  assert.match(m, /const mw = drawKills\(\) \+ Number\(mwFx\.draw\(\)\) > 0;/, 'drawn with the impact sparks');
});

test('STOREFRONT the stage: a kill tried on burns the body away from the feet up in its look\'s time, keeps it gone, and gathers it back before the loop turns; the burn\'s shader eats nothing whole and everything gone, its edge in the look\'s colour; a portal is drawn as tall as the frame has room for (mutants: the body never back; the burn from the head down)', () => {
  assert.equal(stageKillShare('pyre', 0), 0);
  assert.ok(stageKillShare('pyre', KFX_GHOST_S.pyre * 0.5) > 0 && stageKillShare('pyre', KFX_GHOST_S.pyre * 0.5) < 1);
  assert.equal(stageKillShare('pyre', KFX_GHOST_S.pyre + 0.1), 1);
  assert.equal(stageKillShare('pyre', STAGE_KILL_S.whole), 0, 'whole again before the loop turns');
  assert.ok(STAGE_KILL_S.whole < STAGE_KILL_S.cycle);
  const at = (share, up) => {
    const f = glslFunctions(STAGE_BURN_GLSL, { uDissolve: [share, 1, 0.2, 0.05] });
    const c = { value: [0.5, 0.5, 0.5] };
    return { gone: f.burnt(up, [0.37, 0.61], c), c: c.value };
  };
  assert.equal(at(0, 0.1).gone, false, 'nothing burnt');
  assert.equal(at(1, 0.95).gone, true, 'everything gone');
  assert.ok(at(0.4, 0.02).gone && !at(0.4, 0.98).gone, 'from the feet up');
  const edge = Array.from({ length: 100 }, (_, i) => at(0.4, i / 100)).find((r) => !r.gone && r.c[0] > 0.9);
  assert.ok(edge, 'an edge in the look\'s colour');
  const vp = multiply(ortho(1.2, 1.6, 0.1, 8), lookAt([0, 1.4, 4], [0, 1.4, 0], [0, 1, 0]));
  assert.ok(Math.abs(stageTopAt(vp, -0.7) - (1.4 + 1.6 * 0.97)) < 1e-6, 'the screen\'s top over the stage');
});

// ── AUDIT STOREFRONT RENDER (2026-10-29, lane 3): the effects' geometry and engine, read cold and fixed ─────────────────

test('STOREFRONT A BURST TURNS WITH ITS PORTAL (AUDIT STOREFRONT RENDER L2): every burst a skin opens in and breathes, and a fissure\'s waking, is one burst on its own axes - its facing `dir` turns every part\'s place and flight about its feet, so a rim\'s glints ring the rim and an arch\'s embers rise at its feet from any side, never on one line through it (mutants: a rim on world X; a flight left unturned; a foot\'s embers on world X)', () => {
  const recipes = [...Object.values(PORTAL_SKIN).flatMap((s) => [s.open, ...(s.ambient ? [s.ambient.recipe] : [])]), 'fissure-wake'];
  const at = [3, 1, -2];
  for (const r of recipes) for (const dir of [[1, 0], [0, -1], [0.6, 0.8], [-0.8, 0.6]]) {
    const base = new KillFx({ rng: seeded(11) }).start(r, at, { h: 2.5, w: 1.6, dir: [0, 1] });
    const faced = new KillFx({ rng: seeded(11) }).start(r, at, { h: 2.5, w: 1.6, dir });
    assert.equal(faced.parts.length, base.parts.length);
    const turn = (x, z) => [dir[1] * x + dir[0] * z, dir[1] * z - dir[0] * x];   // across is (dir z, -dir x), through is dir
    base.parts.forEach((p, i) => {
      const q = faced.parts[i], [px, pz] = turn(p.p[0] - at[0], p.p[2] - at[2]), [vx, vz] = turn(p.v[0], p.v[2]);
      assert.ok(Math.abs(q.p[0] - at[0] - px) < 1e-9 && Math.abs(q.p[2] - at[2] - pz) < 1e-9 && q.p[1] === p.p[1], `${r} part ${i}: its place turned with it`);
      assert.ok(Math.abs(q.v[0] - vx) < 1e-9 && Math.abs(q.v[2] - vz) < 1e-9 && q.v[1] === p.v[1], `${r} part ${i}: its flight turned with it`);
    });
  }
  // seen from the east (the portal facing west, away from the eye): its rim and its feet across the view, along z
  for (const r of ['portal-runic-open', 'portal-brass-open', 'portal-daedric-embers', 'portal-brass-steam']) {
    const fx = new KillFx({ rng: seeded(5) }), xs = [], zs = [];
    for (let k = 0; k < 12; k++) for (const p of fx.start(r, [0, 0, 0], { h: 2.5, w: 1.6, dir: [-1, 0] }).parts) { xs.push(p.p[0]); zs.push(p.p[2]); }
    const along = (v) => Math.max(...v) - Math.min(...v);
    assert.ok(along(zs) > 0.6 && along(zs) > along(xs) * 2.5, `${r}: across the view (${along(zs).toFixed(2)} m along z, ${along(xs).toFixed(2)} along x)`);
  }
});

test('STOREFRONT THE KILL EFFECTS DRAWN ONCE THE OPAQUE WORLD IS WHOLE (AUDIT STOREFRONT RENDER L3): the pass writes no depth, so every host draws it - and the impact sparks sharing it - after its last opaque draw: the street\'s flats, the grass, the banners and the Windfall (world.js), the walkers, the watch and the foes (exterior.js), a building\'s foes, watch and characters (worldModes.js), the level\'s flats (dungeonContext.js) - and before what falls or is veiled (mutants: the old slot before the street\'s people in each host)', () => {
  const order = (file, needles) => {
    const s = rd(file);
    const at = needles.map((n) => { const i = s.indexOf(n); assert.ok(i >= 0, `${file}: ${n}`); assert.equal(s.indexOf(n, i + 1), -1, `${file}: one ${n}`); return i; });
    for (let k = 1; k < at.length; k++) assert.ok(at[k - 1] < at[k], `${file}: ${needles[k - 1].trim()} before ${needles[k].trim()}`);
  };
  order('src/scenes/world.js', ['    if (livePersonBatches.length) renderer.drawBillboards(livePersonBatches, camRight, bbUp);', '    frameGrass();', '    frameBanners();',
    '    if (windfall.particles && !tvf && windfall.draw(', '    frameHaze();', '    renderer.drawHeld(camRight, bbUp);', '    magic.drawFx?.();', '    drawFalling();   // RAIN-OVER-GRASS']);
  order('src/scenes/exterior.js', ['      if (personBatches.length) renderer.drawBillboards(personBatches, camRight, UP_Y);', '    if (windfall.particles && windfall.draw(',
    '      if (hz.visible && hazeGl.draw(', '    magic.drawFx?.();', '      precip.drawFall(precipShown,']);
  order('src/scenes/worldModes.js', ['      if (_foeBatches.length) renderer.drawBillboards(_foeBatches, camRight, UP_Y);', '      if (_guardBatches.length) renderer.drawBillboards(_guardBatches, camRight, UP_Y);',
    '      if (magic.batches().length) renderer.drawBillboards(magic.batches(), camRight, UP_Y);', '    for (const d of interiorCtx.charDraws) renderer.drawCharacter(d.mesh, d.matrix);', '    magic?.drawFx?.();', '    host.drawVeiledPeerBodies?.();']);
  order('src/scenes/dungeonContext.js', ['      renderer.drawBillboards([..._mobileBatches, ..._dropBatches, ..._spellBatches],', '    magic.drawFx?.();', '    _npcLane?.drawVeiled();']);
});

test('STOREFRONT no pow of a negative in the kill effects\' shader (AUDIT STOREFRONT RENDER L5): GLSL leaves pow(x < 0, y) undefined (a driver\'s exp2/log2 answers NaN, and the evaluator\'s Math.pow would hide it) - every shape, both layers, over the whole quad: the Daedric sigil\'s rings and eye and the Voidrend rim squared as products (SHADOW-CLOAK\'s pin; mutants: a ring, the eye or the rim squared by pow)', () => {
  const FS = KILL_FX_FS.replace(/\bpow\(/g, 'kfxPowChk(').replace('out vec4 o;', 'out vec4 o;\nfloat powNeg = 0.0;\nfloat kfxPowChk(float b, float e) { if (b < 0.0) powNeg = 1.0; return exp(e * log(max(abs(b), 1e-30))); }');
  assert.ok(FS.includes('kfxPowChk(') && FS.includes('float powNeg'), 'the guard took');
  const f = glslFunctions(FS, { vQ: [0, 0], vWorld: [0, 0, 0], vCA: [1, 0.5, 0.2, 1], vSQ: [0.37, 0.4, 0.5], vLen: 2, vShape: 0, uAdd: 0, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1],
    uCamPos: [0, 0, 5], uFocus: [0, 0, 0, 0], uJungleHaze: [[0, 0, 0, 0], [0, 0, 0, 0]] });
  let drawn = 0;
  for (let shape = 0; shape <= 10; shape++) for (const add of [0, 1]) for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
    Object.assign(f.globals, { vShape: shape, uAdd: add, vQ: [i / 20 - 1, j / 20 - 1], powNeg: 0 });
    try { f.main(); drawn++; } catch (e) { if (!(e instanceof GlslDiscard)) throw e; }
    assert.equal(f.globals.powNeg, 0, `shape ${shape}, layer ${add}, at ${f.globals.vQ}`);
  }
  assert.ok(drawn > 8000, `the sweep drew (${drawn})`);
});

test('STOREFRONT THE PASS WRITES EACH LAYER ONCE A FRAME (AUDIT STOREFRONT RENDER L7): the blended and the added layer each in a range of its own of the one buffer, drawn through a VAO that reads that range - never the blended range rewritten for the added draw after it was drawn (mutants: the added layer written over the blended; drawn through the blended layer\'s VAO)', () => {
  const { gl, calls } = recordingGl();
  const pass = new KillFxPass(gl);
  const base = new Map();
  let vao = null;
  for (const c of calls) { if (c[0] === 'bindVertexArray') vao = c[1]; if (c[0] === 'vertexAttribPointer' && c[1] === 1) base.set(vao, c[6]); }
  assert.equal(base.size, 2, 'a VAO a layer');
  assert.deepEqual(calls.filter((c) => c[0] === 'bufferData' && typeof c[2] === 'number').map((c) => c[2]), [2 * KFX_LAYER_BYTES], 'room for both');
  const fx = new KillFx({ rng: seeded(4) });
  fx.start('voidrend', [0, 0, 0]);
  for (let i = 0; i < 4; i++) fx.step(0.05);
  fx.build();
  assert.ok(fx.nAlpha > 0 && fx.nAdd > 0, 'both layers to draw');
  calls.length = 0;
  pass.draw(fx, ortho(2, 2, 0.1, 50), lookAt([0, 1, 5], [0, 1, 0], [0, 1, 0]), [0, 1, 5]);
  const writes = [];
  let written = null;
  for (const c of calls) {
    if (c[0] === 'bindVertexArray') vao = c[1];
    if (c[0] === 'bufferSubData') { written = c[2]; writes.push([c[2], c[2] + c[5] * 4]); }
    if (c[0] === 'drawArraysInstanced') assert.equal(base.get(vao), written, 'each layer drawn from the range just written');
  }
  assert.equal(writes.length, 2);
  assert.ok(writes[0][1] <= writes[1][0] || writes[1][1] <= writes[0][0], `no range written twice (${JSON.stringify(writes)})`);
  assert.ok(writes.every(([a, b]) => b - a <= KFX_LAYER_BYTES));
});

test('STOREFRONT THE STAGE\'S PORTAL IS THE WORLD\'S, FITTED ONCE (AUDIT STOREFRONT RENDER L9): where the frame is short the try-on stage draws the portal smaller about its foot - every piece stands where the world stands it, times the fit, so the Daedric arch\'s foot is on the floor and the Aetheric shards ring its middle (mutants: the fit taken twice on y)', () => {
  const look = (skin) => {
    const { gl, calls } = recordingGl();
    const stage = createEffectStage(gl);
    stage.set('portal', skin);
    for (let i = 0; i < 20; i++) stage.step(0.05, 1.8);
    const z = -0.7, top = 0.72 * STAGE_PORTAL_TOP, halfH = (top - 1.2) / 0.97;
    const vp = multiply(ortho(1.2, halfH, 0.1, 9), lookAt([0, 1.2, 4], [0, 1.2, 0], [0, 1, 0]));
    const fit = Math.max(0.45, Math.min(1, stageTopAt(vp, z) / STAGE_PORTAL_TOP));
    calls.length = 0;
    stage.drawBehind(vp, [1, 0, 0]);
    const feet = calls.filter((c) => c[0] === 'uniform3f' && c[1]?.uniform === 'uAt').map((c) => [c[2], c[3], c[4]]);
    const age = (stage.state().t % ((PORTAL_MS.open + STAGE_PORTAL_MS.hold + PORTAL_MS.close + STAGE_PORTAL_MS.pause) / 1000)) * 1000;
    const k = portalOpenAt(age, { holdMs: STAGE_PORTAL_MS.hold }).open;
    const d = PORTAL_SKIN[skin].dress[0];
    const world = Array.from({ length: d.count }, (_, i) => dressPlace(d, i, age / 1000, k, [0, PORTAL_SIZE.h * 0.5, z], [1, 0, 0], false).at[1]);
    return { fit, k, feet, world };
  };
  const arch = look('daedric');
  assert.ok(arch.fit < 0.8 && arch.k === 1, `a short frame (${arch.fit.toFixed(2)}), the portal open`);
  assert.ok(Math.abs(arch.feet[0][1] - arch.fit * arch.world[0]) < 1e-9 && Math.abs(arch.feet[0][1]) < 1e-9, `the arch's foot on the floor (${arch.feet[0][1].toFixed(3)})`);
  const shards = look('aetheric');
  const pieces = shards.feet.slice(1);   // the vortex first, then the shards in front of it
  assert.equal(pieces.length, shards.world.length);
  pieces.forEach((p, i) => assert.ok(Math.abs(p[1] - shards.fit * shards.world[i]) < 1e-9, `shard ${i}: ${p[1].toFixed(3)} where the world's, fitted, stands ${(shards.fit * shards.world[i]).toFixed(3)}`));
});

test('STOREFRONT LESS MOTION, FOLLOWED (AUDIT STOREFRONT RENDER L10): the try-on stage plays a kill or a portal ONCE to its hold - the body whole again, the portal wide open - and stands still, as the window\'s other previews stop; a try-on again plays it again; the setting is read every frame, so turning it off mid-session turns the loop again; the world\'s engine reads it at each burst, never once at its start (mutants: the loop turning under less motion; the setting read once; the engine handed a fixed answer)', () => {
  let calm = true;
  const cues = [];
  const stage = createEffectStage(recordingGl().gl, { reduced: () => calm, onCue: (s, k) => cues.push(`${s}:${k}`) });
  stage.set('kill', 'pyre');
  for (let i = 0; i < 200; i++) stage.step(0.05, 1.8);
  assert.deepEqual(cues, ['kill:pyre'], 'played once');
  assert.ok(Math.abs(stage.state().t - stageHoldS('kill')) < 1e-9 && stage.burn() === null, 'held with the body whole');
  stage.set(null, null); stage.set('kill', 'pyre');
  stage.step(0.05, 1.8);
  assert.equal(cues.length, 2, 'a try-on again plays it again');
  calm = false;
  for (let i = 0; i < 200; i++) stage.step(0.05, 1.8);
  assert.ok(cues.length >= 4, `the setting turned off, the loop turns again (${cues.length})`);
  calm = true;
  const held = recordingGl(), still = createEffectStage(held.gl, { reduced: () => calm, onCue: (s, k) => cues.push(`${s}:${k}`) });
  still.set('portal', 'brass');
  for (let i = 0; i < 200; i++) still.step(0.05, 1.8);
  assert.equal(cues.filter((c) => c === 'portal:brass').length, 1);
  assert.ok(Math.abs(still.state().t - stageHoldS('portal')) < 1e-9 && portalOpenAt(stageHoldS('portal') * 1000, { holdMs: STAGE_PORTAL_MS.hold }).open === 1, 'held wide open');
  held.calls.length = 0;
  still.drawFront(ortho(2, 2, 0.1, 50), lookAt([0, 1, 5], [0, 1, 0], [0, 1, 0]), [0, 1, 5]);
  assert.equal(held.calls.filter((c) => c[0] === 'drawArraysInstanced').length, 0, 'its opening done and no breath after it: nothing moves');
  const fx = new KillFx({ rng: seeded(9), reduced: () => calm });
  const flash = () => fx.start('pyre', [0, 0, 0], { h: 1.8 }).parts.reduce((a, p) => a + p.a0, 0);
  const dim = flash();
  calm = false;
  assert.ok(flash() > dim, 'the engine follows it at each burst');
  assert.match(rd('src/scenes/hostMagic.js'), /const killFx = new KillFx\(\{ reduced: \(\) => prefersReducedMotion\(\) \}\);/);
  assert.match(rd('src/render/characterStage.js'), /createEffectStage\(gl, \{ reduced: \(\) => prefersReducedMotion\(\), /);
});

test('STOREFRONT A FRAME OF THE EFFECTS ALLOCATES NOTHING (AUDIT STOREFRONT RENDER L6; dissolve.js\'s law): the kill effects\' build and light, a skinned portal\'s tick and its batches write their records in place - measured in a node of its own with the collector at hand against a control that allocates (mutants: a colour array a part; a light record a frame; a size a piece; the batches flat-mapped)', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const script = `
    const { KillFx } = await import(${JSON.stringify(`${root}src/render/killFx.js`)});
    const { createPortalSet } = await import(${JSON.stringify(`${root}src/scenes/portalFx.js`)});
    const { lookAt } = await import(${JSON.stringify(`${root}src/world/mat4.js`)});
    let s = 7; const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const fx = new KillFx({ rng });
    fx.start('pyre', [0, 0, 0], { h: 1.8 }); fx.start('voidrend', [3, 0, 0], { h: 1.8 });
    for (let i = 0; i < 6; i++) fx.step(0.05);
    const renderer = { uploadTexture() {}, createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: [0, 0, 0] }), destroyBillboardBatch() {},
      _view: lookAt([20, 1.6, 0], [0, 1.25, 0], [0, 1, 0]), _camPos: new Float32Array([20, 1.6, 0]) };
    let T = 0, sink = null;
    const set = createPortalSet({ renderer, now: () => T });
    set.open([0, 0, 0], { fixed: true, skin: 'brass', holdMs: 1e9 }); set.open([4, 0, 0], { fixed: true, skin: 'daedric', holdMs: 1e9 });
    T = 1000; set.tick();
    const fns = { build: () => fx.build(), light: () => fx.light(), tick: () => set.tick(), batches: () => set.batches(), control: () => { sink = { a: T, b: [T] }; } };
    const bytes = (fn) => {
      let least = Infinity;
      for (let r = 0; r < 5; r++) {
        for (let f = 0; f < 1000; f++) fn();
        globalThis.gc(); globalThis.gc();
        const h0 = process.memoryUsage().heapUsed;
        for (let f = 0; f < 1000; f++) fn();
        least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 1000);
      }
      return least;
    };
    const out = { built: fx.build(), lit: !!fx.light(), pieces: set.batches().length };
    for (const k of Object.keys(fns)) out[k] = bytes(fns[k]);
    console.log(JSON.stringify(out));
  `;
  const run = spawnSync(process.execPath, [...ALLOC_CHILD_ARGS, '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const m = JSON.parse(run.stdout.trim().split('\n').pop());
  assert.ok(m.built > 40 && m.lit && m.pieces === 2 + 6 + 1, `a frame with work in it (${m.built} instances, ${m.pieces} batches)`);
  assert.ok(m.control >= 20, `the control allocated ${m.control.toFixed(2)} bytes a call - the measure is blind`);
  assert.ok(m.build < 16, `the build: ${m.build.toFixed(2)} bytes a frame (was 2.7 KB)`);
  assert.ok(m.light < 16, `the light: ${m.light.toFixed(2)} bytes a frame (was 264)`);
  assert.ok(m.tick < 40, `the portals' tick: ${m.tick.toFixed(2)} bytes a frame (was 2 KB; a number the engine boxes is 16)`);
  assert.ok(m.batches < 16, `the portals' batches: ${m.batches.toFixed(2)} bytes a frame (was 940)`);
});
