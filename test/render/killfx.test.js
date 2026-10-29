// STOREFRONT (2026-10-29, the owner: "kill effects would be a brand new feature"; bible/06-Systems/Storefront.md sections
// 4, 5, 7 and 9). The effects' engine (render/killFx.js): every recipe - the kill looks, the portal skins' bursts and the
// mount looks' beats - a burst within its budget, the kills and the breaths under caps of their own, none begun past
// sight, flown, lit, shifted and cleared; a kill's place off a pool's foe (systems/playerKills.js killFxOf); the four
// hosts' engine wiring it; and the profile's stage trying one on (render/effectStage.js, the burn in its shaders).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  KillFx, KFX_RECIPES, KILL_FX_LOOKS, KFX_GHOST_S, KILL_FX_EDGE, KFX_LIGHT, KFX_MAX_LIVE, KFX_MAX_AMBIENT, KFX_FAR_M, KFX_MAX_INSTANCES, KILL_FX_PROGRAMS,
} from '../../src/render/killFx.js';
import { KILL_EFFECTS } from '../../src/net/effectLaw.js';
import { PORTAL_SKIN } from '../../src/scenes/portalSkins.js';
import { killFxOf } from '../../src/systems/playerKills.js';
import { stageKillShare, stageTopAt, STAGE_KILL_S } from '../../src/render/effectStage.js';
import { STAGE_BURN_GLSL } from '../../src/render/characterStage.js';
import { ortho, lookAt, multiply } from '../../src/world/mat4.js';
import { glslFunctions } from '../glsl.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

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
  for (const r of KFX_RECIPES) {
    fx.clear();
    const b = fx.start(r, [0, 0, 0], { h: 1.8, w: 0.8, dir: [0, 1], pace: 2, ambient: r.startsWith('mount') });
    assert.ok(b && b.parts.length > 0 && b.parts.length <= 260, `${r}: ${b?.parts.length} parts`);
    for (const p of b.parts) assert.ok(p.life > 0 && p.s0 >= 0 && p.p.every(Number.isFinite), `${r}: a whole part`);
  }
  fx.clear();
  for (const look of KILL_FX_LOOKS) for (let i = 0; i < 3; i++) fx.start(look, [i, 0, 0], { h: 1.8 });
  assert.ok(fx.build() > 0);
  assert.ok(fx.nAlpha + fx.nAdd <= KFX_MAX_INSTANCES, 'every live kill within the cap');
  assert.equal(KILL_FX_PROGRAMS.length, 1);
});

test('STOREFRONT the caps: at most KFX_MAX_LIVE kills and, apart, KFX_MAX_AMBIENT breaths - a crowd of horses never takes a kill\'s place, the oldest of its own kind giving way; nothing begun past KFX_FAR_M of the eye (mutants: one cap for both; the newest dropped)', () => {
  const fx = new KillFx({ rng: seeded(3) });
  for (let i = 0; i < KFX_MAX_LIVE + 3; i++) fx.start('ashen', [i, 0, 0], { h: 1.8 });
  const first = fx.bursts[0].at[0];
  assert.equal(fx.bursts.length, KFX_MAX_LIVE);
  assert.equal(first, 3, 'the three oldest gave way');
  for (let i = 0; i < KFX_MAX_AMBIENT * 2; i++) fx.start('mount-warhorse', [0, 0, i], { ambient: true, pace: 2 });
  assert.equal(fx.bursts.filter((b) => !b.ambient).length, KFX_MAX_LIVE, 'the kills all still there');
  assert.equal(fx.bursts.filter((b) => b.ambient).length, KFX_MAX_AMBIENT);
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
