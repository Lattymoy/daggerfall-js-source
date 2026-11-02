// IIL1 - Improved Interior Lighting (ShortBeard 1.0.5) on the classic lane, and GROUND1-W - a mod tile set's puddles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  IIL_MOD, IIL_SETTINGS, IIL_FIREPLACE_MODELS, IIL_LIGHT_ARCHIVE, isIilMod, iilActive, setIilAttachedSource,
  stepFlicker, iilInteriorLights, iilDungeonLights, iilTorch, _resetIilForTests, setIilPrefSource,
} from '../../src/systems/improvedInteriorLighting.js';
import { carryPuddleMask, PUDDLE_RECORDS } from '../../src/world/puddleMask.js';

const src = (rel) => readFileSync(new URL(`../../src/${rel}`, import.meta.url), 'utf8');

test('IIL1 the mod: its GUID and shipped defaults, verbatim from its modsettings.json', () => {
  assert.equal(IIL_MOD.guid, '55d7c31a-c571-45ea-bb72-fb5aa359e106');
  assert.deepEqual([...IIL_SETTINGS.Interiors.InteriorLightsColor], [255, 147, 41]);
  assert.equal(IIL_SETTINGS.Interiors.InteriorLightsIntensity, 0.5);
  assert.equal(IIL_SETTINGS.Interiors.LightFlickerStrength, 0.5);
  assert.equal(IIL_SETTINGS.Dungeons.LightFlickerStrength, 1.5);
  assert.equal(IIL_SETTINGS.FirePlaces.FireplaceIntensity, 1.0);
  assert.equal(IIL_SETTINGS.Torch.PlayerTorchChanged, true);
  assert.ok(IIL_FIREPLACE_MODELS.has(41116) && IIL_FIREPLACE_MODELS.has(41117));
  assert.equal(IIL_LIGHT_ARCHIVE, 210);
});

test('IIL1 when it runs: attached AND the classic lane - Enhanced Lighting on leaves it alone', () => {
  assert.ok(isIilMod({ guid: IIL_MOD.guid }) && isIilMod({ title: 'Improved Interior Lighting' }) && !isIilMod({ title: 'DREAM' }));
  setIilAttachedSource(() => true);
  setIilPrefSource(() => undefined);   // the rows' defaults: on, no shadows
  assert.equal(iilActive(null), true);
  assert.equal(iilActive({ lane: 'enhanced' }, ''), false, 'Enhanced Lighting on: the lane is untouched');
  assert.equal(iilActive({ lane: 'enhanced' }, '?iil=shadows'), true, 'IIL1-T: the test door runs the mod on the lane, for its shadows');
  setIilPrefSource((k) => (k === 'moddedLighting' ? 'off' : undefined));
  assert.equal(iilActive(null), false, 'IIL1-T: the row off: the lighting you had');
  setIilPrefSource((k) => (k === 'moddedLighting' ? false : undefined));
  assert.equal(iilActive(null), false, 'an older boolean off reads as Off');
  setIilPrefSource((k) => (k === 'moddedLighting' ? 'shadows' : undefined));
  assert.equal(iilActive({ lane: 'enhanced' }, ''), false, 'IIL2: With shadows does NOT borrow Enhanced Lighting - its lane is its own');
  assert.equal(iilActive(null, ''), true, '...the mod lights where Enhanced Lighting is off, its own shadow lane included (the renderer answers null for it)');
  setIilPrefSource(() => undefined);
  setIilAttachedSource(() => false);
  assert.equal(iilActive(null), false, 'not attached: classic');
  _resetIilForTests();
});

test('IIL1 LightFlicker: a lerp toward a random target in [base - MaxReduction, base + MaxIncrease] by Strength x dt, every RateDamping, never below zero', () => {
  const st = { intensity: 0.5, wait: 0 };
  stepFlicker(st, 0.5, [1.5, 2.5, 0], 0.5, 1, () => 1);   // target 3, t = 0.5
  assert.equal(st.intensity, 1.75);
  const low = { intensity: 0.1, wait: 0 };
  stepFlicker(low, 0.5, [1.5, 2.5, 0], 10, 1, () => 0);   // target -1, t clamped to 1
  assert.equal(low.intensity, 0, 'a light cannot go negative');
  const slow = { intensity: 1, wait: 0 };
  stepFlicker(slow, 1, [3, 4.5, 0.02], 1, 0.01, () => 1);
  const once = slow.intensity;
  stepFlicker(slow, 1, [3, 4.5, 0.02], 1, 0.005, () => 0);
  assert.equal(slow.intensity, once, 'inside RateDamping the light holds');
});

test('IIL1 the lights: rooms warm at range 10, a light per fireplace at range 15, dungeon lights on the 210 billboards, the torch recoloured', () => {
  const room = [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }];
  const it = iilInteriorLights(room, [{ x: 9, y: 9, z: 9 }]);
  assert.equal(it.lights.length, 3);
  assert.deepEqual(it.ranges, [10, 10, 15]);
  const c = it.colorOf(it.lights[0]);
  assert.ok(c[0] > c[1] && c[1] > c[2], 'warm: red over green over blue');
  assert.equal(iilInteriorLights(room, []).lights, it.lights, 'one set of lights (and flicker states) per room list, built once');
  const dg = iilDungeonLights([{ x: 0, y: 0, z: 0 }]);
  assert.deepEqual(dg.ranges, [10]);
  const t = iilTorch({ x: 0, y: 0, z: 0, range: 8 });
  assert.equal(t.range, 8);
  assert.deepEqual(t.color.map((v) => Math.round(v * 255)), [255, 147, 41]);
  assert.equal(iilTorch(null), null);
});

test('IIL1 wiring: the hosts ask it on the classic lane, the contexts keep the fireplaces and the light billboards', () => {
  const wm = src('scenes/worldModes.js');
  assert.match(wm, /const _iilIt = _iilOnIt \? iilInteriorLights\(interiorCtx\.lights, interiorCtx\.iilFireplaces \?\? \[\]\) : null;/);
  assert.match(wm, /const _iilDg = _iilOn \? iilDungeonLights\(dungeonCtx\.iilLightFlats \?\? \[\]\) : null;/);
  assert.match(src('scenes/interiorContext.js'), /if \(IIL_FIREPLACE_MODELS\.has\(p\.modelIdNum\)\) iilFireplaces\.push/);
  assert.match(src('scenes/dungeonContext.js'), /if \(f\.archive === IIL_LIGHT_ARCHIVE\) iilLightFlats\.push/);
  assert.match(src('systems/dfmodTextures.js'), /guid: index\.guid \?\? null,/);
});

test('GROUND1-W a mod tile set takes each puddle record\'s shape from the classic mask, stretched to its size', () => {
  const layer = (w, h, a) => ({ width: w, height: h, colors: new Uint8ClampedArray(w * h * 4).fill(a) });
  const rec = PUDDLE_RECORDS[0];
  const classic = []; const mod = [];
  for (let r = 0; r <= rec; r++) { classic.push(layer(2, 2, 255)); mod.push(layer(4, 4, 255)); }
  const cb = classic[rec].colors;
  cb[3] = 255; cb[7] = 0; cb[11] = 0; cb[15] = 255;   // wet dry / dry wet
  const out = carryPuddleMask(mod, classic);
  const a = (x, y) => out[rec].colors[(y * 4 + x) * 4 + 3];
  assert.deepEqual([a(0, 0), a(3, 0), a(0, 3), a(3, 3)], [255, 0, 0, 255]);
  assert.equal(out[rec - 1 >= 0 ? 0 : rec], out[0], 'a record that is not a puddle is left as the mod paints it');
  // PIN MOVED (AUDIT PRECIP GROUND-2): the streaming host's layers are made in one home (groundLayersOf - the set and its
  // twin's winter both), the puddles marked there
  // PIN MOVED (OW-HITCH): that home is scenes/groundSets.js (HOST-SPLIT), the classic marked once, a mod's set carried from it - a record a breath
  assert.match(src('scenes/groundSets.js'), /const marked = await stepsBreathing\(markPuddleWaterSteps\(classic\), breathe\);[\s\S]{0,200}?layers: modLayers \? await stepsBreathing\(carryPuddleMaskSteps\(modLayers, marked\), breathe\) : marked \};/, 'scenes/groundSets.js');
  assert.match(src('scenes/exterior.js'), /const layers = modLayers \? carryPuddleMask\(modLayers, markPuddleWater\(classic\)\) : classic;/, 'scenes/exterior.js');
});

test('IIL2 the mod\'s own shadows: a classic-look lane - the lane shaders with Daggerfall\'s look put back - put on inside, taken off outside, never over Enhanced Lighting', async () => {
  const { classicShadowLane, classicLook, replaceGlslFunction, syncClassicShadowLane } = await import('../../src/render/classicShadowLane.js');
  const L = classicShadowLane();
  assert.equal(L.key, 'classic-shadows'); assert.equal(L.classicLook, true); assert.equal(L.shadows, true); assert.equal(L.air, false);
  for (const k of ['meshFs', 'bbFs', 'terrainFs', 'charFs', 'decalFs', 'farRingFs']) {
    assert.match(L[k], /vec3 elDecode\(vec3 c\) \{\n {2}return c;\n\}/, `${k}: display-space colour`);
    assert.match(L[k], /vec3 elTonemapRGB\(vec3 c\) \{\n {2}return clamp\(c, 0\.0, 1\.0\);\n\}/, `${k}: no tonemap`);
    assert.match(L[k], /float elAttenuation\(float d, float range\) \{\n {2}float a = clamp\(1\.0 - d \/ max\(range, 1e-4\), 0\.0, 1\.0\); return a \* a;\n\}/, `${k}: the classic falloff`);
    assert.ok(L[k].includes('casterShadowAt') || k === 'farRingFs', `${k}: the shadow compare stays`);
  }
  assert.match(L.meshFs, /float elSpecLobe\(float x\) \{\n {2}return 0\.0;\n\}/, 'no highlight');
  const out = new Float32Array(3);
  assert.deepEqual([...L.decode3([0.5, 0.25, 1], out)], [0.5, 0.25, 1], 'no colour decode on the CPU either');
  assert.throws(() => replaceGlslFunction('void main() {}', 'float gone()', 'return 0.0;'), /is not in the shader/);
  assert.equal(classicLook('vec3 elDecode(vec3 c) { return c; }\nvec3 elEncode(vec3 c) { x; }\nvec3 elTonemapRGB(vec3 c) { y; }\nfloat elAttenuation(float d, float range) { z; }\nfloat elAdapt() { w; }').includes('return 1.0;'), true);
  // the switch
  const calls = [];
  const r = { installedLaneKey: null, setLightingLane(l) { calls.push(l?.key ?? null); this.installedLaneKey = l?.key ?? null; }, setExposure: (e) => calls.push(`exp${e}`), setAir: () => {}, setContact: () => {}, setVolumetrics: () => {}, setHaze: () => {} };
  syncClassicShadowLane(r, true);
  assert.deepEqual(calls, ['classic-shadows', 'exp1']);
  syncClassicShadowLane(r, true); assert.equal(calls.length, 2, 'already on: nothing');
  syncClassicShadowLane(r, false); assert.equal(r.installedLaneKey, null, 'outside: off');
  r.installedLaneKey = 'enhanced-lighting'; calls.length = 0;
  syncClassicShadowLane(r, true); syncClassicShadowLane(r, false);
  assert.deepEqual(calls, [], 'Enhanced Lighting\'s lane is never touched');
  const rend = readFileSync(new URL('../../src/render/renderer.js', import.meta.url), 'utf8');
  assert.match(rend, /get lightingLane\(\) \{ return this\._lane\?\.classicLook \? null : this\._lane; \}/, 'the hosts keep their classic colours under it');
  assert.match(src('scenes/world.js'), /iilSyncLane\(renderer, false\);/, 'outdoors it comes off');
  assert.equal((src('scenes/worldModes.js').match(/iilSyncLane\(renderer, true\);/g) ?? []).length, 2, 'the interior and dungeon arms put it on');
});

test('IIL3 the lighting mod has its own section and button - it is listed there and not among the texture packs, and the button refuses anything else', () => {
  const menu = src('ui/enhanced/enhancedMenu.js');
  assert.match(menu, /c\.append\(el\('h3', null, t\('menu\.packs\.lighting', 'Lighting mod'\)\)\);/);
  assert.match(menu, /const lighting = mods\.filter\(isIilMod\);\n\s+mods = mods\.filter\(\(m\) => !isIilMod\(m\)\);/, 'not listed twice');
  assert.match(menu, /label: t\('menu\.packs\.attachLighting', 'Attach lighting mod'\), primary: true, onClick: async \(\) => \{ const ds = await import\('\.\.\/\.\.\/scenes\/dataSource\.js'\); await ds\.pickLightingModFiles\(\); render\(\); \}/);
  const ds = src('scenes/dataSource.js');
  assert.match(ds, /export async function pickLightingModFiles\(\)/);
  assert.match(ds, /if \(!isIilMod\(\{ guid: manifest\?\.guid, title: manifest\?\.title \}\)\) \{\n\s+await deleteAssets\(TEXTURE_STORE, \[key, dfmodIndexKey\(key\)\]\);/, 'a texture pack picked here is taken back out');
});
