// SNOW-TELL (FIELD BUGS 2026-10-11d #1, the Discord's "Can't see any boss ground attack overlays with heavy snow": "I
// have been hit 5 times and died twice with zero warning or feedback while fighting revenants outdoors in heavy snow,
// all due to invisible attack indications (ranged AoE circle)"). A foe's telegraph is fitted to the BARE ground (the
// colliders know no snow - ai/foeBlows.js fitBlowToGround) and drawn 0.06 m over it, depth-tested; Snowfall's deep
// snow stands 0.4-0.8 m over that same ground in the wild, drawn first and depth-written - so every mark outdoors in
// winter was buried. The renderer keeps the frame's snow height (drawSnow, render/snowfallGlsl.js snowSurfaceRise) and
// the telegraph pass lies that much higher (render/foeTelegraph.js telegraphLift). bible/01-Overview/bugs/Field-Bugs-2026-10-11d.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { snowSurfaceRise } from '../../src/render/snowfallGlsl.js';
import { telegraphLift, BLOW_LIFT, FoeTelegraphPass } from '../../src/render/foeTelegraph.js';
import { SnowfallRuntime, SNOW_SURFACE_OFFSET, snowUniforms } from '../../src/systems/snowfallRuntime.js';
import { snowfallSettings } from '../../src/systems/snowfall.js';
import { makeBlow } from '../../src/ai/foeBlows.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const tier = (depths, limits, offset = SNOW_SURFACE_OFFSET) => ({ depths, limits, radius: [32, 0, offset, 2] });

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

test('SNOW-TELL: the snow\'s height over its ground is snowResolve\'s highest answer - the deeper of the wild\'s and the settlement\'s depth, a road\'s berm over it, and the surface offset; nothing below the ground (mutants: the settlement\'s depth unread; the berm dropped; the offset dropped)', () => {
  const f = Math.fround;
  // the wild deeper than the town (the mod's own order): its depth, the berm and the 8 mm offset
  assert.equal(f(snowSurfaceRise(tier([0.6, 0.3, 0.2, 0.1], [0.05, 0.8, 0.4, 0.1]))), f(0.6 + 0.05 + SNOW_SURFACE_OFFSET));
  // a town deeper than the wild (a settlement depth dialled over the wild's): the town's
  assert.equal(f(snowSurfaceRise(tier([0.2, 0.5, 0.1, 0.1], [0, 0.8, 0.6, 0.1]))), f(0.5 + SNOW_SURFACE_OFFSET));
  // the caps and the path only pull the snow down - they are never its height
  assert.equal(f(snowSurfaceRise(tier([0.4, 0.2, 0.9, 0.9], [0, 0.8, 0.4, 0.1]))), f(0.4 + SNOW_SURFACE_OFFSET));
  assert.equal(snowSurfaceRise(tier([-1, -1, 0, 0], [-1, 0, 0, 0], 0)), 0, 'no snow is no height');
});

test('SNOW-TELL: the runtime\'s own uniforms, at the mod\'s defaults and its deepest dial, give the telegraph a height over every depth the snow can draw at (mutants: the lift not the snow\'s)', () => {
  const s = snowfallSettings();
  const rt = new SnowfallRuntime({ world: { toGlobal: (x, z) => [x, z] }, coverage: null, settings: s });
  for (const d of [0.1, s.wildernessMaximumDepth, 1]) {
    rt.snowpack.wildernessDepth = d; rt.snowpack.settlementDepth = Math.min(d, s.settlementMaximumDepth);
    const u = rt.localUniforms(rt.depthUniforms(snowUniforms()));
    const rise = snowSurfaceRise(u);
    assert.ok(rise >= d + SNOW_SURFACE_OFFSET - 1e-6, `the rise ${rise} under the snow's ${d}`);
    assert.ok(telegraphLift(rise) > rise, 'the mark lies over the snow, by its own lift');
  }
});

test('SNOW-TELL: the pass lies its marks BLOW_LIFT over the ground without snow and over the frame\'s snow with it - a negative or missing word is no snow (mutants: the lift the bare BLOW_LIFT; the snow\'s rise unread)', () => {
  assert.equal(telegraphLift(), BLOW_LIFT);
  assert.equal(telegraphLift(0), BLOW_LIFT);
  assert.equal(telegraphLift(-0.5), BLOW_LIFT);
  assert.equal(telegraphLift(0.808), BLOW_LIFT + 0.808);
  const lifts = (opts) => {
    const { gl, calls } = fakeGl();
    const pass = new FoeTelegraphPass(gl);
    calls.length = 0;
    pass.draw([{ blow: makeBlow('pyre', [1, 2, 3], 0, 0), phase: { t: 0.5, flash: 0 } }], I, I, null, opts);
    return calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uLift').map((c) => c[2]);
  };
  assert.deepEqual(lifts({ contrast: false }), [BLOW_LIFT], 'no snow: as it always lay');
  assert.deepEqual(lifts({ contrast: false, snowRise: 0.66 }), [BLOW_LIFT + 0.66], 'a revenant\'s pyre over 0.66 m of snow');
});

test('SNOW-TELL: the renderer keeps the frame\'s snow height - cleared each frame, the deepest tier drawn, handed to the foes\' telegraphs - and both snowy hosts draw their snow before the telegraphs read it (mutants: the height never cleared; never recorded; never handed)', () => {
  const r = src('src/render/renderer.js');
  const begin = r.slice(r.indexOf('  beginFrame(proj, view, lightDir, opts = null) {'));
  assert.match(begin.slice(0, begin.indexOf('\n  }\n')), /this\._snowRise = 0;/, 'a frame starts with no snow under its marks');
  assert.match(r, /this\._snowU4\(L\.uSnowDepths, u\.depths\); this\._snowU4\(L\.uSnowLimits, u\.limits\);\n\s+this\._snowRise = Math\.max\(this\._snowRise, snowSurfaceRise\(u\)\);/, 'each tier drawn says its height');
  assert.match(r, /const n = this\._foeTelegraph\.draw\(list, this\._proj, this\._view, \{[^\n]*\}, \{ snowRise: this\._snowRise \}\);/, 'and the telegraphs read it');
  // THE FOUR HOSTS: world.js and exterior.js draw the snow, before their telegraphs; the interiors (worldModes.js) and
  // the dungeons (dungeonContext.js) draw none, so their frames' height stays 0 and their marks lie as they always lay
  for (const [host, snow, tell] of [
    ['src/scenes/world.js', 'if (!tvf) snowfall.draw(cullOn ? snowOutside : null);', 'renderer.drawFoeTelegraphs?.(drawableBlows(tacticsNow(), walkMode && playerSpawned ? player.pos : cam.pos));'],
    ['src/scenes/exterior.js', '    snowfall.draw();   // SNOWFALL1', 'renderer.drawFoeTelegraphs?.(drawableBlows(tacticsNow(), walkMode ? player.pos : cam.pos));'],
  ]) {
    const t = src(host), a = t.indexOf(snow), b = t.indexOf(tell);
    assert.ok(a > 0 && b > a, `${host}: the snow drawn before the telegraphs`);
  }
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(src(host), /snowfall\.draw\(/, `${host} draws no snow`);
});
