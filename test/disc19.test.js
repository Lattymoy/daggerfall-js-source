// DISC19 (2026-09-24, Mac, five in one message). bible/01-Overview/Field-Bugs-2026-09-23.md, DISC19.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { modSetting, setModSetting, _resetModSettings, SWITCH_RESETS, KEY_MIGRATIONS, MOD_SETTINGS } from '../src/systems/modSettings.js';
import { diverseWeaponsPresetOn } from '../src/combat/diverseWeapons.js';
import {
  LAB_GRASS_HEAD, LAB_GRASS_FS, GAME_GRASS_FS, GAME_GRASS_VS, GRASSPX_FS_EDITS, GRASSFOG_FS_EDITS, GRASSFOG_VS_EDITS,
  FOG_FACTOR_GLSL, applyGrassEdits,
} from '../src/render/labGrass.js';
import { glslFunctions } from './glsl.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── DISC19-A: "Grass isnt affected by fog" ──
/** The grass fragment stage's colour for a blade `d` metres from the eye under `fog` (mode 0 none, 1 linear, 2 exp,
 *  3 exp2), run on the stage's own text through test/glsl.mjs - smooth (uPixel 0) or the pixel tuft (uPixel 1, a
 *  solid tip texel from the sheet). */
function bladeColour(fs, { d, fog = { mode: 0, density: 0, range: [0, 1] }, pixel = 0 }) {
  const binds = {
    vT: 0.8, vTint: 0.5, vFade: 1, vLam: 0.6, vSnow: 0, vWet: 0, vGround: [0.3, 0.28, 0.2], vMoonLam: 0,
    vUV: [0.5, 0.5], vVar: 0, vWorld: [0, 0, d],
    uAmb: [0.4, 0.4, 0.45], uSunCol: [1, 0.95, 0.85], uMoonCol: [0.2, 0.2, 0.3], uDim: 1, uSunScale: 1, uMoonScale: 0,
    uPixel: pixel, uPxSteps: 8, uPxVariants: 4, uPxTintBands: 4,
    uFogColor: [0.6, 0.62, 0.66], uFogMode: fog.mode, uFogDensity: fog.density, uFogRange: fog.range, uCamPos: [0, 0, 0],
    gl_FragCoord: [3, 5, 0.5, 1], o: [0, 0, 0, 0],
    texture: () => [3 / 4, 0.9, 0.5, 1],
  };
  const f = glslFunctions(LAB_GRASS_HEAD + fs, binds);
  f.main();
  return f.globals.o.slice(0, 3);
}
const near = (a, b, e) => a.every((v, i) => Math.abs(v - b[i]) <= e);

test('DISC19-A: a blade fogs as the ground under it does - heavy fog swallows it at 100 m, rain thins it, a clear day barely touches it; smooth and pixel alike, and with no fog the picture is the unfogged stage\'s own (mutants: the blend dropped; the blend before the pixel ramp; the world point not handed down)', () => {
  const unfogged = applyGrassEdits(LAB_GRASS_FS, GRASSPX_FS_EDITS);   // the stage as it compiled before DISC19
  for (const pixel of [0, 1]) {
    const clear = bladeColour(unfogged, { d: 100, pixel });
    assert.deepEqual(bladeColour(GAME_GRASS_FS, { d: 100, pixel }), clear, `${pixel ? 'pixel' : 'smooth'}: no fog, the same picture`);
    // heavy fog, exp 0.05: e^-5 of the blade is left at 100 m - the fog's colour to a percent
    const heavy = bladeColour(GAME_GRASS_FS, { d: 100, pixel, fog: { mode: 2, density: 0.05, range: [0, 0] } });
    assert.ok(near(heavy, [0.6, 0.62, 0.66], 0.01), `${pixel ? 'pixel' : 'smooth'}: 100 m into heavy fog is the fog (${heavy.map((v) => v.toFixed(3))})`);
    // the blend is exactly the terrain's: mix(fog, lit, e^-(density d))
    for (const [fog, d] of [[{ mode: 2, density: 0.003, range: [0, 0] }, 60], [{ mode: 1, density: 0, range: [0, 2400] }, 150], [{ mode: 3, density: 0.01, range: [0, 0] }, 80]]) {
      const k = fog.mode === 1 ? (2400 - d) / 2400 : fog.mode === 3 ? Math.exp(-((0.01 * d) ** 2)) : Math.exp(-fog.density * d);
      const lit = bladeColour(unfogged, { d, pixel });
      const want = lit.map((c, i) => [0.6, 0.62, 0.66][i] * (1 - k) + c * k);
      assert.ok(near(bladeColour(GAME_GRASS_FS, { d, pixel, fog }), want, 1e-9), `${pixel ? 'pixel' : 'smooth'}, mode ${fog.mode} at ${d} m`);
    }
  }
});

test('DISC19-A: the grass\'s fog is the terrain\'s - its fogFactorAt is TERRAIN_FS\'s text, its five uniforms looked up and set from the frame\'s fog, the world point handed down, and the world host hands the ground\'s fog from the view\'s eye (mutant: the host hands no fog)', () => {
  const terrain = rd('src/render/renderer.js');
  const at = terrain.indexOf('float fogFactorAt(vec3 worldPos) {', terrain.indexOf('const TERRAIN_FS = `'));
  const body = terrain.slice(at, terrain.indexOf('\n}\n', at) + 3);
  assert.equal(FOG_FACTOR_GLSL, body, 'the terrain\'s own function, verbatim');
  assert.ok(GAME_GRASS_VS.includes('out vec3 vWorld;') && GAME_GRASS_VS.includes('  vWorld = p;'), 'the world point handed down');
  assert.equal(GRASSFOG_VS_EDITS.length, 2); assert.equal(GRASSFOG_FS_EDITS.length, 2);
  const blend = GAME_GRASS_FS.indexOf('  c = mix(uFogColor, c, fogFactorAt(vWorld));');
  assert.ok(blend > GAME_GRASS_FS.indexOf('GRASS-PX: the ramp') && blend < GAME_GRASS_FS.indexOf('  o = vec4(c,'), 'after the pixel ramp, right before the colour is written');
  const grass = rd('src/render/labGrass.js');
  for (const n of ['uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) assert.ok(grass.includes(`'${n}'`), `${n} is looked up`);
  assert.match(grass, /gl\.uniform1i\(u\.uFogMode, fog \? fog\.mode : 0\);/, 'no fog handed, mode 0 - the lab\'s picture');
  assert.match(rd('src/scenes/world.js'), /\{ fog: \{ mode: renderer\._fogMode, density: renderer\._fogDensity, range: renderer\._fogRange, color: renderer\._fogColor, camPos: renderer\._camPos \},/);
});

// ── DISC19-E: "The weapon widget default toggle under diverse weapons should be set to off by default" ──
test('DISC19-E: Diverse Weapons\' Weapon Widget Preset ships off, and a value saved before this reset is let go once - the shipped off applies - while a choice made after it is kept across reloads (mutants: no reset; the reset every load; the stamp never written)', () => {
  const prevLs = globalThis.localStorage;
  const K = 'dfjs-mod-settings', V = 'diverse-weapons', P = 'WeaponWidgetPreset';
  try {
    let store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    assert.equal(MOD_SETTINGS[V].keys[P].default, false, 'the shipped default is off');
    // a file from before the reset: the preset saved on (DW-CLIP shipped it on), the mod's own switch beside it
    _resetModSettings();
    store.set(K, JSON.stringify({ [V]: { [P]: true, Enabled: true }, pcaao: { Enabled: false } }));
    assert.equal(modSetting(V, P), false, 'the saved on is let go: the shipped off applies');
    assert.equal(diverseWeaponsPresetOn(), false, 'and the weapon reads it off');
    assert.equal(modSetting(V, 'Enabled'), true, 'the mod\'s own switch is the player\'s');
    const written = JSON.parse(store.get(K));
    assert.deepEqual(written[V], { Enabled: true }, 'written back without it');
    assert.deepEqual(written.pcaao, { Enabled: false }, 'every other mod untouched');
    // the player turns it on AFTER the reset: stamped, and kept through a reload
    setModSetting(V, P, true);
    const saved = store.get(K);
    _resetModSettings(); store.set(K, saved);   // a reload: the memory dropped (the reset clears the fake's key, so the file is laid back)
    assert.equal(modSetting(V, P), true, 'a choice made after the reset stands');
    assert.equal(diverseWeaponsPresetOn(), true);
    const after = JSON.parse(store.get(K));
    assert.equal(after[V][P], true); assert.equal(after[V][SWITCH_RESETS[0].stamp], true, 'the stamp rides with it');
    // and off again, still the player's
    setModSetting(V, P, false);
    const saved2 = store.get(K);
    _resetModSettings(); store.set(K, saved2);
    assert.equal(modSetting(V, P), false);
    // a file that never mentioned the mod is not grown one
    _resetModSettings();
    store = new Map([[K, JSON.stringify({ pcaao: { Enabled: false } })]]);
    assert.equal(modSetting(V, P), false);
    assert.deepEqual(Object.keys(JSON.parse(store.get(K))), ['pcaao']);
    // the one entry, beside the value migrations
    assert.deepEqual(SWITCH_RESETS.map((r) => `${r.vendor}/${r.key}`), [`${V}/${P}`]);
    assert.equal(KEY_MIGRATIONS.length, 3, 'the value migrations are untouched');
  } finally {
    _resetModSettings();
    if (prevLs === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLs;
  }
});
