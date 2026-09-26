// DW-F (2026-09-26) - ILIAC PUDDLE NO MORE 1.2.2's CLOSING AUDIT (jet082), PINNED: the four readers' findings against
// the assembly, each fixed here or recorded as a Port-Ledger departure (bible/03-World/Deep-Waters.md, "The close").
// The expectations are the IL's, spelled out here.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as L from '../src/world/underwaterLoot.js';
import { createDecorTextureSource } from '../src/scenes/deepWatersDecor.js';
import { createRandomWeapon } from '../src/systems/loot.js';
import { createDeepWatersPlayer } from '../src/scenes/deepWatersPlayer.js';
import { surfaceLook, underwaterFogColor, lookSettings } from '../src/world/deepWaterLook.js';
import { loadStarted, loadFinished, teleported, canRunLightRuntimeWork, canRunHeavyRuntimeWork, resetDeepWaterRuntime } from '../src/world/deepWaterRuntime.js';
import { trySpawnTreasureGuards } from '../src/scenes/deepWatersEncounters.js';
import { Renderer, BB_SURFACE_UNIT } from '../src/render/renderer.js';
import { EL_BB_FS } from '../src/render/enhancedLighting.js';
import { COLUMN_GLSL } from '../src/render/columnGlsl.js';
import { identity } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
const tick = () => new Promise((r) => setTimeout(r, 0));

test('AUDIT DW-F E5-2: the replacement cache waits for the file - a record asked before its archive loads is not held to its classic picture for the session (mutants: the empty answer cached; the warm deciding the kind before the file)', async () => {
  let arrive;
  const file = { recordCount: 50, getFrameCount: () => 1, getSize: () => ({ width: 8, height: 8 }), getDFBitmap: () => ({}), getColor32: () => ({ width: 8, height: 8, colors: new Uint8ClampedArray(256) }) };
  const src = createDecorTextureSource({
    getTexture: (() => { const once = new Promise((r) => { arrive = () => r(file); }); return () => once; })(),   // the loader keeps its file
    scaledSize: () => ({ w: 1, h: 1 }), replacementSize: () => ({ w: 2, h: 3 }),
    replacementsOn: () => true, hasReplacement: (a, r, f) => f === 0,
    loadReplacement: async () => ({ width: 8, height: 8, colors: new Uint8ClampedArray(256) }),
    createTexture: (frames) => ({ tex: {}, frames: frames.length }),
  });
  const rec = { archive: 216, record: 3 };
  assert.equal(src.kindOf(rec), 'archive', 'before the file: the classic answer - and not kept');
  const spawn = { positions: [rec], warm: 0 };
  assert.equal(src.warm(spawn), true, 'the warm waits on the file');
  arrive();
  await tick(); await tick();
  assert.equal(src.texture(rec, 'archive'), null, 'no classic picture was built for it meanwhile');
  assert.equal(src.kindOf(rec), 'replacement', 'the file in: the replacement a texture pack registered');
  assert.deepEqual(src.replacement(rec).size, { w: 2, h: 3 });
  for (let i = 0; i < 20 && src.warm(spawn); i++) await tick();
  assert.ok(src.texture(rec, 'replacement'), 'and its picture built');
  assert.equal(src.visualHeight(rec) > 0, true, 'DW-E2\'s authored height reads the replacement too');
});

test('AUDIT DW-F E5-3: CreateRandomWeapon draws RandomMaterial for every slot before the arrow test - an arrow\'s stack is the THIRD draw (mutant: the arrow arm skipping the material draw)', () => {
  // slot 18 (0.95 of 19), RandomMaterial's Range(0, 256) at 0.99, the stack's Range(1, 21) at 0.5 -> 11
  const arrows = createRandomWeapon(1, seq(0.95, 0.99, 0.5));
  assert.equal(arrows.templateIndex, 131);
  assert.equal(arrows.stackCount, 11, 'the stack reads the third value, not the material\'s');
  assert.equal(arrows.material, 0, 'and the material drawn is thrown away (nativeMaterialValue = 0)');
  assert.match(rd('src/systems/loot.js'), /const material = randomMaterial\(playerLevel, rolls\);\n\s+if \(groupIndex >= 19\) return \{ group: 'Weapons', \.\.\.createWeapon\(customs\[groupIndex - 19\], material\) \};\n[\s\S]{0,1500}?if \(groupIndex === 18\) return createWeapon\(ARROW_TEMPLATE, 0, rolls\);/);
});

test('AUDIT DW-F E5-6: the loot\'s unordered compares are the C#\'s own forms - a NaN takes the branch the IL\'s .un takes (mutants: an ordered negation back)', () => {
  const col = (depth, oceanY = 100, floor = 50) => ({ depth, oceanY, renderedSeafloorY: floor, entry: {} });
  // ResolveSeafloorAt: bge.un past `depth < 2` and `ocean - floor < 2` - a NaN goes on
  assert.ok(L.resolveSeafloorAt(col(NaN)), 'a NaN depth is no "under 2 m"');
  assert.ok(L.resolveSeafloorAt(col(10, NaN)), 'nor a NaN sea');
  assert.equal(L.resolveSeafloorAt(col(1.9)), null);
  assert.equal(L.resolveSeafloorAt(col(10, 51.5, 50)), null);
  // IsDeepEnoughForWreck: clt.un; ceq - `depth >= threshold`, false for a NaN
  assert.equal(L.isDeepEnoughForWreck({ depth: NaN }, 200), false);
  assert.equal(L.isDeepEnoughForWreck({ depth: 100 }, 200), true);
  assert.equal(L.isDeepEnoughForWreck({ depth: 99.9 }, 200), false);
  // TryPickFogAheadPoint: blt.un past `reveal >= max` - a NaN reveal is not "past the fog's reach"
  assert.ok(L.tryPickFogAheadPoint([0, 0, 0], 130, [0, 0, 1], NaN, () => 0.5), 'the IL goes on past the test');
  assert.equal(L.tryPickFogAheadPoint([0, 0, 0], 130, [0, 0, 1], 128, () => 0.5), null, 'a reveal of 130 is the reach');
  // ShouldSpawnTreasureCluster / RollStrayLootCount: bgt.un past `rate <= 0`; CanRunLootPulse the same twice
  const lootSrc = rd('src/world/underwaterLoot.js'), spawner = rd('src/scenes/deepWatersLoot.js');
  assert.equal((lootSrc.match(/if \(rate <= 0\) return (false|0);/g) || []).length, 2);
  assert.match(spawner, /if \(s\.rate <= 0 && s\.clusterRate <= 0\) return null;/);
  assert.doesNotMatch(lootSrc + spawner, /!\((rate|s\.rate|s\.clusterRate|reveal|column\.depth|column\.oceanY)[^)]*[<>]=?[^)]*\)/, 'no ordered negation left in their place');
});

test('AUDIT DW-F E5-1/E5-4: the view the loot and the guards test is the one the frame is about to draw, and the velocity is the motor\'s - rebased at a crossing, let go across a door, a teleport, a load (pins)', () => {
  const w = rd('src/scenes/world.js');
  const view = w.slice(w.indexOf('  function dwSpawnView() {'), w.indexOf('  /** The frame\'s CharacterController.velocity'));
  assert.match(view, /const V = lookAt\(eye, \[eye\[0\] \+ forward\[0\], eye\[1\] \+ forward\[1\], eye\[2\] \+ forward\[2\]\], UP_Y\);/, 'this frame\'s camera');
  assert.match(view, /const worldAspect = largeHudWorldAspect\(canvas\.clientWidth, canvas\.clientHeight\);[^\n]*\n\s+const P = mirrorProjectionX\(perspective\(fieldOfView\(\), worldAspect, 0\.2, 6000\)\);/, '...through the frame\'s own lens');
  assert.doesNotMatch(view, /renderer\._view|renderer\._proj/, 'not the last pass\'s matrices');
  assert.match(w, /const proj = mirrorProjectionX\(perspective\(fieldOfView\(\), worldAspect, 0\.2, 6000\)\);/, 'the frame draws through the same lens');
  assert.match(w, /for \(let i = 0; i < 3; i\+\+\) _dwEyeOffset\[i\] = mwv\.eye\[i\] - cam\.pos\[i\];/, 'the camera machine\'s eye, relative (a crossing moves cam.pos, not the offset)');
  assert.match(w, /if \(_dwLootVel\.last\) for \(let i = 0; i < 3; i\+\+\) _dwLootVel\.last\[i\] \+= r\.offset\[i\];/, 'FloatingOrigin moves the player by transform: no velocity');
  assert.match(w, /dwLoot\?\.pump\(f\);[^\n]*\n\s+dwLootLetGoVelocity\(\);/, 'indoors: the way out is a reposition');
  assert.match(w, /onTransientReset\(\(\) => \{ dwLoot\.reset\(\); dwLootLetGoVelocity\(\); \}\);/, 'a teleport or a load');
});

test('AUDIT DW-F E5-5: the port\'s own rebuilds keep the rubble where it lay; an unload and a sweep take it (pins)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(collectLoose\) for \(const r of \[\.\.\.\(_dwRubble\.get\(p\) \?\? \[\]\)\]\) dwFreeRubble\(r\);[^\n]*\n\s+else if \(_dwRubble\.has\(p\)\) \{ _dwRubbleCarry\.set\(key, _dwRubble\.get\(p\)\); _dwRubble\.delete\(p\); \}/);
  assert.match(w, /const dwRubbleKept = _dwRubbleCarry\.get\(key\);[^\n]*\n\s+if \(dwRubbleKept\) \{ _dwRubbleCarry\.delete\(key\); const e = built\.get\(key\); for \(const r of dwRubbleKept\) r\.entry = e; _dwRubble\.set\(e, dwRubbleKept\); \}/, 'adopted by the entry that stands next');
  assert.match(w, /for \(const list of _dwRubbleCarry\.values\(\)\) for \(const r of list\) dwFreeRubble\(r\);[^\n]*\n\s+_dwRubbleCarry\.clear\(\);/, 'a sweep carries nothing');
});

/** A sea of one column kind: x in [0, 100] is 24 m deep (a floor at 10), the rest dry (dwc_fog's). */
const OCEAN = 34;
function fakeSwimmer() {
  const col = (entry, lx) => (lx >= 0 && lx <= 100 ? { oceanY: OCEAN, seafloorY: 10, renderedSeafloorY: 10, depth: OCEAN - 10, entry } : null);
  const host = { waterColumn: col, rawWaterColumn: col };
  return createDeepWatersPlayer({
    host, locate: (x, z) => ({ entry: {}, lx: x, lz: z, baseY: 0 }), seaY: () => OCEAN, terrainGroundAt: () => -Infinity,
    collider: { raycastHit: () => null }, settings: () => ({ fogStrength: 0.5, fogDistance: 0.3 }),
  });
}

test('AUDIT DW-F CD-4: behind a pausing window the underwater presentation is none - TryGetUnderwaterPresentation asks IsPlayingGame first; the stroke, the low-pass and the splash stand down too (mutant: the playing test dropped)', () => {
  const p = fakeSwimmer();
  assert.deepEqual(p.fogPresentation({ camera: [50, 20, 0], centre: [50, 20, 0], swimming: true, playing: false }), { under: false, oceanY: 0 }, 'false, and the out height 0 (IL_12020)');
  assert.equal(p.fogPresentation({ camera: [50, 20, 0], centre: [50, 20, 0], swimming: true }).under, true, 'absent reads as playing');
  const w = rd('src/scenes/world.js');
  assert.match(w, /_dwFogP = dwPlayer\.fogPresentation\(\{[^\n]*, playing: dwPlaying\(\) \}\);/);
  const block = w.slice(w.indexOf('const _dwNowPlaying = dwPlaying();'), w.indexOf('else _dwSwimSound.reset();\n        }'));
  assert.match(block, /const _dwOutdoor = _dwNowPlaying && !player\.waterWalking && /, 'IsOutdoorSwimming asks IsPlayingGame');
  assert.match(block, /loadGrace: loadGraceActive\(performance\.now\(\) \/ 1000, _dwNowPlaying\),/, 'IsLoadGraceActive: no light work while not playing');
  assert.match(block, /anySwimming: _dwOutdoor \|\| \(_dwNowPlaying && !player\.waterWalking && !!player\.swimming\),/, 'IsAnySwimming too');
  assert.match(block, /audio\.setListenerLowPass\(_dwNowPlaying && dwPlayer\.swim\.presentationUnderwater\(/, 'UpdateAudioFilter');
  assert.match(block, /if \(_dwNowPlaying && player\.isPlayerSwimming && !player\.waterWalking\) \{ if \(_dwSwimSound\.step\(_dwCentre\)\)/, 'UpdateSwimSfxAndWeather');
  assert.match(w, /const gamePaused = \(\) => townTalk\.overlayActive \|\| \(modes\?\.overlayHeld \?\? false\);\n\s+_dwOverlayUp = \(\) => gamePaused\(\);/, 'IsPlayingGame over every stack');
});

test('AUDIT DW-F CD-1/CD-6: the breath drains only while the game runs its FixedUpdate, and the frame runs the mod\'s execution order - the stroke beside the motor, then the after phase, each on the camera the move left (mutants: the breath ungated; the stroke after the after phase; last frame\'s camera)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(!_overlayHeld\) _dwBreathTimer \+= dt;/, 'Time.timeScale 0 runs no FixedUpdate');
  const block = w.slice(w.indexOf('const _dwNowPlaying = dwPlaying();'), w.indexOf('else _dwSwimSound.reset();\n        }'));
  const stroke = block.indexOf('dwSwimMove.update({'), after = block.indexOf('dwPlayer.afterMove({'), flush = block.indexOf('dwFlushStateChange();   // OutdoorSwimDriverAfter');
  assert.ok(stroke > 0 && after > stroke && flush > after, 'OutdoorSwimMovementController (0), OutdoorSwimDriverAfter (32000), its flush');
  assert.match(block, /dwPlayer\.afterMove\(\{ now: now \/ 1000, player, cameraY: player\.eye\[1\],/, 'the camera after this frame\'s move');
  assert.match(block, /lookDir: fwd, cameraY: player\.eye\[1\],/);
  assert.doesNotMatch(block, /cam\.pos\[1\]/, 'never last frame\'s render eye');
});

test('AUDIT DW-F CD-3: a dungeon swimmer splashes every 2.5 m - UpdateSwimSfxAndWeather has no IsPlayerInside test, and DFU\'s dungeon arm raises IsPlayerSwimming (mutant: the inside splash dropped)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const sw = modes\.mode === 'dungeon' \? modes\.dungeonCtx\?\.swimmer\?\.\(\) \?\? null : null;\n\s+if \(sw && dwPlaying\(\) && sw\.swimming && !sw\.waterWalking\) \{ if \(_dwSwimSound\.step\(centreFromFeet\(sw\.feet, sw\.height\)\)\) audio\.playOneShot\(SWIM_SOUND_CLIP, SWIM_SOUND_VOLUME\); \}\n\s+else _dwSwimSound\.reset\(\);/);
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /swimmer\(\) \{\n\s+return lastPlayerFeet \? \{ feet: lastPlayerFeet, height: lastPlayerHeight, swimming: !!_activity\.swimming, waterWalking: hasActiveEffect\(playerEntity, 'waterWalking'\) \} : null;/);
});

test('AUDIT DW-F CD-2: OutdoorSwimDriver.OnSaveLoad on both load events - the state cleared, the forge dropped WITHOUT Restore, and a crouched save stands (mutants: the stand dropped; a Restore in its place; the OnLoad call dropped)', () => {
  const p = fakeSwimmer();
  const player = { pos: [50, 20, 0], height: 1.8, crouching: true, heightAction: null, isInWaterTile: false, isPlayerSwimming: true, swimming: true, forcedSwimCrouch: true, levitateMotorEnabled: true,
    forceStand() { this.stood = true; }, forceUnsink() { this.unsunk = true; } };
  p.swim.forged = true;
  p.saveLoad(player);
  assert.equal(p.forged, false, 'currentlyForged = false');
  assert.equal(p.exteriorContext, false);
  assert.equal(player.stood, true, 'RequestStandAfterWaterExit: HeightAction = DoStanding while crouching');
  assert.equal(player.forcedSwimCrouch, false);
  assert.equal(player.isPlayerSwimming, true, 'no Restore - the flags are not the reset\'s to lower');
  const w = rd('src/scenes/world.js');
  assert.match(w, /dwLoadStarted\(\);[^\n]*\n\s+if \(dwPlayer\) \{ dwPlayer\.saveLoad\(player\); dwFlushStateChange\(\); \}/, 'OnStartLoad');
  assert.match(w, /dwLoadFinished\(performance\.now\(\) \/ 1000\);[^\n]*\n\s+if \(dwPlayer\) \{ dwPlayer\.saveLoad\(player\); dwFlushStateChange\(\); \}/, 'OnLoad, after the pose');
});

test('AUDIT DW-F CD-7: the underside\'s _UnderwaterFogColor is latched - configured at a settings change and at every surface built, never by the frame\'s refresh (mutants: the latch recomputed each frame; the surface build not re-latching)', () => {
  const s = lookSettings(() => undefined);
  assert.deepEqual(surfaceLook(s, { daylight: 0.3, undersideFogColor: [0.1, 0.2, 0.3, 1] }).fogColor, [0.1, 0.2, 0.3, 1], 'the latched colour');
  assert.deepEqual(surfaceLook(s, { daylight: 0.3 }).fogColor, underwaterFogColor(0.3), 'absent: this frame\'s');
  assert.deepEqual(surfaceLook(s, { daylight: 0.3, undersideFogColor: [0.1, 0.2, 0.3, 1] }).undersideColor, surfaceLook(s, { daylight: 0.3 }).undersideColor, 'the tint is the dynamic refresh\'s, every frame');
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(!_dwUnderFogLatch \|\| _dwSurfaceBuilt\) \{ _dwUnderFogLatch = underwaterFogColor\(daylight\); _dwSurfaceBuilt = false; \}/);
  assert.match(w, /_dwLook = lookSettings\(\(k\) => modSetting\(DEEP_WATERS_VENDOR, k\)\); _dwUnderFogLatch = null; \}/, 'LoadSettings: ApplyMaterialSettings');
  assert.match(w, /if \(h\.surface\) _dwSurfaceBuilt = true;/, 'EnsureVisibleSurface: ApplyMaterialSettings');
  assert.match(w, /surfaceLook\(_dwLook, \{ daylight, columnDepth: col \? col\.depth : null, undersideFogColor: _dwUnderFogLatch \}\)/);
});

test('AUDIT DW-F E-2: a load\'s own teleport does not open the work mid-load - SaveLoadManager.LoadInProgress holds light work shut until OnLoad (mutant: the load read off the clock again)', () => {
  resetDeepWaterRuntime();
  loadStarted();
  assert.equal(canRunLightRuntimeWork(true), false, 'OnStartLoad');
  teleported(100);   // SaveLoadManager.cs:1475 -> Respawner -> OnTeleportToCoordinates, in the middle of the load
  assert.equal(canRunLightRuntimeWork(true), false, 'the load is still in progress');
  assert.equal(canRunHeavyRuntimeWork(200, true), false);
  loadFinished(300);
  assert.equal(canRunLightRuntimeWork(true), true, 'OnLoad');
  assert.equal(canRunHeavyRuntimeWork(301, true), false, 'the grace');
  assert.equal(canRunHeavyRuntimeWork(301.5, true), true);
  assert.equal(canRunLightRuntimeWork(false), false, 'a window up is no work either');
  resetDeepWaterRuntime();
});

test('AUDIT DW-F E-3: a treasure guard lives with its column\'s terrain - the request names the pixel, the world keeps the guard against it and an unload takes it (mutants: the entry dropped; the unload leaving the guards)', () => {
  const entry = { px: 7, py: 9 };
  const f = { time: 0, dt: 0.1, frame: 0, roll: () => 0.4, playerPos: [0, 0, 0], column: () => ({ oceanY: 34, seafloorY: -26, depth: 60, entry }), renderedSeafloorY: (c) => c.seafloorY, visibleDistance: 70, raycast: () => null };
  const stood = [];
  const n = trySpawnTreasureGuards({ f, centre: [100, 0, 100], settings: { on: true, frequency: 0.3, waterDepth: 200 }, canRunHeavy: true, playerPos: [0, 0, 0], vision: 70, view: null, spawnGuard: (o) => { stood.push(o); return {}; } });
  assert.ok(n > 0 && stood.every((o) => o.entry === entry), 'SpawnTreasureGuardEnemy: the column\'s Parent');
  const w = rd('src/scenes/world.js');
  assert.match(w, /spawnGuard: \(req\) => dwStandGuard\(req\),/);
  assert.match(w, /const k = `\$\{req\.entry\.px\},\$\{req\.entry\.py\}`;/, 'keyed by the pixel: a rebuild the port makes keeps them');
  assert.match(w, /if \(collectLoose && _dwGuards\.has\(key\)\) \{ for \(const h of _dwGuards\.get\(key\)\) h\.destroy\(\); _dwGuards\.delete\(key\); \}/, 'the unload takes them');
});

/** A renderer over a GL that answers everything and records the uniform uploads (by name) and the texture binds (by unit). */
function recordingRenderer(log) {
  let active = 0;
  const TEXTURE0 = 33984;
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (['createTexture', 'createBuffer', 'createVertexArray', 'createProgram', 'createShader', 'createFramebuffer'].includes(k)) return () => ({});
      if (k === 'activeTexture') return (u) => { active = u - TEXTURE0; };
      if (k === 'bindTexture') return (t, tex) => log.push({ fn: 'bind', unit: active, tex });
      if (k === 'drawElements') return () => log.push({ fn: 'draw' });
      if (typeof k === 'string' && k.startsWith('uniform')) return (loc, ...a) => log.push({ fn: k, name: loc, args: a });
      if (k === 'TEXTURE0') return TEXTURE0;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  return new Renderer({ getContext: () => stub, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
}

test('AUDIT DW-F E-1: a foe under the carved sea takes the water column\'s share - DFU\'s Daggerfall/Billboard writes the depth texture the top reads; the flat\'s share is the floor\'s, on both lanes\' programs (mutants: the share dropped from either program; after the underwater fog)', () => {
  // one column law, three programs: the floor, the decorations, and both lanes' flats
  const renderSrc = rd('src/render/renderer.js');
  const bb = renderSrc.slice(renderSrc.indexOf('const BB_FS = `'), renderSrc.indexOf('// Dungeon water: one horizontal quad'));
  assert.match(bb, /\$\{FOG_GLSL\}\n\$\{COLUMN_GLSL\}\nvoid main\(\)/, 'the classic flats declare it after the fog block');
  assert.match(bb, /outColor = vec4\(dwWaterFog\(dwColumn\(mix\(uFogColor, lit, fogFactorAt\(vBBWorld\)\), vBBWorld\), vBBWorld\), alpha\);/, 'the world fog, the share, the sea\'s fog - the floor\'s own order');
  assert.ok(EL_BB_FS.includes(COLUMN_GLSL), 'the lane\'s flats too');
  assert.match(EL_BB_FS, /outColor = vec4\(dwColumn\(elFinish\(lit, vBBWorld\), vBBWorld\), alpha\);/, 'on the finished display colour (the sea\'s fog is off whenever the share is on)');
});

test('AUDIT DW-F E-1: the renderer hands the column to the flats the host flagged and to no other - the switch per batch, the surface on its own unit, a frame\'s (mutants: every flat switched; the surface on the picture\'s unit; the frame kept)', () => {
  const log = [];
  const r = recordingRenderer(log);
  const surf = { surface: true };
  const flat = (x) => { const b = r.createBillboardBatch(5, 1, { w: 1, h: 2 }, [[x, 0, 0]]); r.textures.set('5_1', { t: 1 }); return b; };
  const a = flat(0), b = flat(1);
  a.dwColumn = true; b.dwColumn = false;
  r.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  r.setWaterColumn({ seaY: 34, topColor: [0.1, 0.3, 0.35, 0.42], topVision: 18, surfaceScroll: [0.2, 0.1], surfaceTexture: surf, origin: [0, 0, 0] });
  log.length = 0;
  r.drawBillboards([a, b], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  const on = log.filter((e) => e.name === 'uColumnOn').map((e) => e.args[0]);
  assert.deepEqual(on, [0, 1, 0], 'off, on for the flagged flat, off again for the other');
  assert.ok(log.some((e) => e.fn === 'bind' && e.unit === BB_SURFACE_UNIT && e.tex === surf), 'the surface texture on its reserved unit');
  assert.ok(log.some((e) => e.name === 'uSurfaceTex' && e.args[0] === BB_SURFACE_UNIT));
  assert.notEqual(BB_SURFACE_UNIT, 0); assert.notEqual(BB_SURFACE_UNIT, 1);
  assert.deepEqual(log.find((e) => e.name === 'uSeaY').args, [34]);
  // the next frame, none set: nothing switched on, nothing bound there
  r.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  log.length = 0;
  r.drawBillboards([a, b], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  assert.ok(log.filter((e) => e.name === 'uColumnOn').every((e) => e.args[0] === 0), 'beginFrame clears it');
  assert.ok(!log.some((e) => e.fn === 'bind' && e.unit === BB_SURFACE_UNIT));
});

test('AUDIT DW-F E-1: the host flags the flats that STAND in a carved column - a foe\'s feet or a pile\'s spot, under the sea\'s line, over a carved point - and draws them flagged (pins)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(c && dwPlayer && b\._quads === 1\) \{[^\n]*\n\s+const o = b\.origin, x = b\.bounds\[0\] \+ \(o \? o\[0\] : 0\), y = b\.bounds\[1\] \+ \(o \? o\[1\] : 0\), z = b\.bounds\[2\] \+ \(o \? o\[2\] : 0\);\n\s+on = y < c\.seaY && !!dwPlayer\.rawColumnAt\(x, z\);/);
  assert.match(w, /if \(deepWaters && livePersonBatches\.length\) dwFlagColumnFlats\(livePersonBatches\);[^\n]*\n\s+if \(livePersonBatches\.length\) renderer\.drawBillboards\(livePersonBatches, camRight, UP_Y\);/);
  assert.match(w, /_dwColumnNow = cf\.columnOn && cf\.surfaceTexture \? \{/, 'on while the top is drawn over the sea');
  assert.match(w, /renderer\.setWaterColumn\(_dwColumnNow\);/);
});
