// CSA-F (2026-09-27) - COME SAIL AWAY'S EFFECTS IN THE RUNTIME: systems/comeSailAway/comeSailAway.js's wake arm (Update 4737-4755),
// the two loops' play state and their fades (6527-6600), the rudder's drops at the helm, the wake and the oars' splashes
// carried by a floating-origin shift, LateUpdate's bob and flag, and RotateWind's rain and snow - over the vendored hulls
// (the real SpawnBoat and its real particle systems) and a scripted scene. Every expectation is worked out here from
// ComeSailAway.cs's own statements.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comeSailAwayModels } from '../../../src/systems/comeSailAway/comeSailAwayModels.js';
import { spawnBoat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, TIME_SCALES } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { quatRotate, quatLookRotation } from '../../../src/world/quat.js';
import { quatEuler } from '../../../src/world/unityAnimator.js';
import { evaluateMinMax, SPACE } from '../../../src/world/unityParticles.js';
import { PART_CUT_FS, PART_PREMUL_FS, CUBE_FS, CUBE_TRIANGLES, softParticleTexture } from '../../../src/render/comeSailAwayRender.js';

const DIR = new URL('../../../vendor/come-sail-away/Models/', import.meta.url);
const json = (p) => JSON.parse(readFileSync(new URL(p, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
const f = Math.fround;
const near = (a, b, eps = 1e-5, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);
const nearV = (a, b, eps = 1e-5, msg = '') => a.forEach((v, i) => near(v, b[i], eps, `${msg}[${i}]`));
const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }), particleRandom: () => 0.5 });

function terrain(x, y) {
  return { mapPixelX: x, mapPixelY: y, position: [(x - 10) * 819.2, 0, -(y - 20) * 819.2], tileMap: new Uint8Array(128 * 128), sampleHeight: () => 20 };
}

/** A scripted scene - Time.deltaTime a quarter second, the waves off unless asked (so no current), water everywhere. */
function scene(opts = {}) {
  const out = { forces: [], audio: [] };
  const player = { position: [1, 2, 3], yaw: 0, frozen: 0 };
  const terrains = [terrain(10, 20)];
  const world = { time: 0, dt: opts.dt ?? 0.25 };
  const deps = {
    pool: { models: MODELS, ready: () => true, spawnNow: (boat, p) => { spawnBoat(boat, ctxFor(p)); return boat; }, remove: () => {} },
    player: () => ({ position: [...player.position], rotation: [0, 0, 0, 1] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: 10, Y: 20 }),
    isPlayerInside: () => false,
    blockWaterLevel: () => NO_WATER_LEVEL,
    iliacPuddleNoMore: () => false,
    raycast: () => null,
    playerTerrain: () => terrains[0], terrainAt: () => terrains[0], terrains: () => terrains,
    heightMapValue: () => 255,
    worldCompensation: () => [0, 0, 0],
    hudText: () => {}, midScreenText: () => {}, log: () => {},
    random: { range: (min) => min, rangeFloat: (min) => min },
    time: () => world.time,
    hour: () => 12,
    weatherType: () => 0,
    persistentDungeonBoats: () => false,
    packedItems: { serialize: (i) => i, deserialize: (r) => r },
    dt: () => world.dt,
    setting: (k) => ({ 'Waves.Enable': false, ...opts.settings })[k],
    input: { has: () => false, started: () => false, horizontal: () => 0, vertical: () => 0, toggleAutorun: false },
    helm: { setPlayerPosition: (p) => { player.position = [...p]; }, setFacing: () => {}, turnPlayer: () => {}, freeze: (s) => { player.frozen = s; }, frozen: () => player.frozen > 0, stopRunning: () => {}, footsteps: () => {}, alignToGround: () => {} },
    transport: { isFoot: () => true, setFoot: () => {}, hasHorse: () => false, hasCart: () => false, isOnShip: () => false },
    ship: { owns: () => true, assign: () => {}, removePermanentScene: () => {} },
    entity: { isFemale: () => false, carriedWeight: () => 10, wagonWeight: () => 0, decreaseFatigue: () => {} },
    cargoWeight: () => 0, sphereCastAll: () => [], enemies: () => [], timeScale: () => 1, setTimeScale: () => {}, messageBox: () => {},
    precipitationForce: (v) => out.forces.push(v),
    audio: { play: (src) => out.audio.push(['play', src.clip]), stop: (src) => out.audio.push(['stop', src.clip]) },
  };
  const rt = createComeSailAwayRuntime(deps);
  const frame = () => { rt.endOfFrame(); rt.fixedUpdate(); rt.update(); rt.lateUpdate(); world.time = f(world.time + world.dt); };
  const place = (hull = 1) => rt.PlaceBoat([100, 34, 200], [0, 0, 1], hull, 0, terrains[0]);
  return { rt, out, player, world, frame, place, deps };
}

test('CSA-F: a boat placed plays its slow loop - PlaySlow without the crossfade: the fast one stopped, the slow faded in over a second (FadeAudioSource, the one `fading` every boat shares)', () => {
  const s = scene();
  const boat = s.place();
  assert.equal(boat.AudioSourceSlow.isPlaying, true);
  assert.equal(boat.AudioSourceFast.isPlaying, false);
  assert.equal(boat.AudioSourceSlow.volume, 0, 'the fade\'s first step: nought');
  for (let i = 0; i < 5; i++) s.rt.endOfFrame();
  assert.equal(boat.AudioSourceSlow.volume, 0.75, 'KEPT: the loop sets the volume before its clock steps, so it ends a step short of SoundVolume x the mod\'s (one each here) - 0, 0.25, 0.5, 0.75');
  assert.equal(boat.AudioSourceSlow.isPlaying, true, 'faded to something: never stopped');
});

test('CSA-F: the wake arm - under way past the threshold with the fast loop silent: the wake played and the loops crossfaded (both played, the slow stopped two seconds on); its life, size and drift set from the speed, the current and the wake\'s scale', () => {
  const s = scene();
  const boat = s.place();
  for (let i = 0; i < 5; i++) s.rt.endOfFrame();   // the placement's fade done
  boat.WakeEmitter.play();   // left playing: StartSailing's own Stop is what ends it
  s.rt.StartSailing(boat);
  assert.equal(boat.WakeEmitter.isEmitting, false, 'StartSailing stops the wake');
  assert.deepEqual(boat.RudderEmitters.map((e) => e.isPlaying), [true], 'and plays the rudder\'s drops');
  s.rt.state.MoveVectorCurrent = [0, 0, 1];
  s.rt.state.currentVector = [0.2, 0, -0.4];
  const heard = s.out.audio.length;
  s.rt.update();   // MoveTowards nought by moveAccel (the sail's 0.2) x 0.25: 0.95 left, over 0.5
  assert.equal(boat.WakeEmitter.isEmitting, true);
  assert.equal(boat.AudioSourceFast.isPlaying, true);
  assert.equal(boat.AudioSourceSlow.isPlaying, true, 'the crossfade plays its `from` too');
  assert.deepEqual(s.out.audio.slice(heard), [['play', boat.AudioSourceSlow.clip], ['play', boat.AudioSourceFast.clip]], 'both played at its head - the slow one again though it plays (AudioSource.Play)');
  const speed = s.rt.state.MoveVectorCurrent[2];
  assert.equal(boat.WakeEmitterMain.startLifetimeMultiplier, Math.min(10, Math.max(1, f(f(f(speed * f(0.2)) / 2) * 10))));
  assert.equal(evaluateMinMax(boat.WakeEmitterMain.startSize), f(f(speed * f(0.2)) / 2));
  const fo = boat.WakeEmitter.forceOverLifetime;
  assert.equal(fo.space, SPACE.World);
  assert.equal(evaluateMinMax(fo.x), f(f(f(0.2) * f(0.1)) / 10));
  assert.equal(evaluateMinMax(fo.z), f(f(f(-0.4) * f(0.1)) / 10));
  s.rt.state.MoveVectorCurrent = [0, 0, 6];
  s.rt.update();   // faster: the life is the wake's 10 times the speed's share, inside the clamp
  const life = f(f(f(s.rt.state.MoveVectorCurrent[2] * f(0.2)) / 2) * 10);
  assert.ok(life > 1 && life < 10, `${life}`);
  assert.equal(boat.WakeEmitterMain.startLifetimeMultiplier, life);
  for (let i = 0; i < 9; i++) s.rt.endOfFrame();   // the crossfade's two seconds at a quarter a frame
  assert.equal(boat.AudioSourceSlow.isPlaying, false, 'the crossfade stops its `from`');
  assert.equal(boat.AudioSourceFast.volume, 0.875, 'a step short, as the fade: 1.75 of its 2 seconds');
  // PlaySlow without the crossfade, as a reposition plays it: the fast loop stopped outright, the slow faded in
  s.rt.RepositionBoat(boat, [100, 34, 200], [0, 0, 1], s.deps.terrains()[0]);
  assert.equal(boat.AudioSourceFast.isPlaying, false, 'PlaySlow stops the fast loop');
  assert.equal(boat.AudioSourceSlow.isPlaying, true);
  assert.equal(boat.AudioSourceSlow.volume, 0);
  // exactly at the threshold (moveSpeedSail x 0.25): `>=` - the wake plays
  const t = scene();
  const b2 = t.place();
  for (let i = 0; i < 5; i++) t.rt.endOfFrame();
  t.rt.StartSailing(b2);
  t.rt.state.MoveVectorCurrent = [0, 0, f(0.5 + f(t.rt.properties.moveAccel() * f(0.25)))];
  t.rt.update();   // less one step of moveAccel x Time.deltaTime: the threshold itself
  assert.equal(t.rt.state.MoveVectorCurrent[2], 0.5);
  assert.equal(t.rt.properties.wakeThreshold(), 0.5);
  assert.equal(b2.WakeEmitter.isEmitting, true, 'at the threshold itself: played');
});

test('CSA-F: slowed under the threshold with the slow loop silent - the wake stopped and the loops crossfaded back; a crossfade asked while one runs is dropped (CrossfadeAudioSource only when `fading` is none)', () => {
  const s = scene();
  const boat = s.place();
  for (let i = 0; i < 5; i++) s.rt.endOfFrame();
  s.rt.StartSailing(boat);
  s.rt.state.MoveVectorCurrent = [0, 0, 1];
  s.rt.update();
  for (let i = 0; i < 9; i++) s.rt.endOfFrame();
  assert.equal(boat.AudioSourceSlow.isPlaying, false);
  s.rt.state.MoveVectorCurrent = [0, 0, 0.3];
  s.rt.update();
  assert.equal(boat.WakeEmitter.isEmitting, false);
  assert.equal(boat.AudioSourceSlow.isPlaying, true, 'crossfading back');
  // a second crossfade while the first runs: none started - the fast loop is still the one fading out
  boat.AudioSourceSlow.isPlaying = false;   // as though silenced: the arm asks again
  s.rt.update();
  assert.equal(boat.AudioSourceSlow.isPlaying, false, 'the ask dropped: `fading` still runs');
});

test('CSA-F: StopSailing stops the wake and the rudder\'s drops', () => {
  const s = scene();
  const boat = s.place();
  s.rt.StartSailing(boat);
  boat.WakeEmitter.play();
  s.rt.StopSailing();
  assert.equal(boat.WakeEmitter.isEmitting, false);
  assert.deepEqual(boat.RudderEmitters.map((e) => e.isEmitting), [false]);
});

test('CSA-F: OnPositionUpdate - the wake stopped and its living particles moved with the boat, the oars\' splashes too (their first sub-emitter\'s), the rudder\'s splashes not (kept); at the helm, under way, the wake played again', () => {
  const s = scene();
  const dinghy = s.place(0);   // the Dingy has oars
  dinghy.WakeEmitter.setParticles([{ position: [1, 2, 3], velocity: [0, 0, 0], startLifetime: 5, remainingLifetime: 5, startSize: [1, 1, 1], rotation: [0, 0, 0] }]);
  const splash = dinghy.OarParticles[0].subEmitters[0].system;
  splash.setParticles([{ position: [4, 5, 6], velocity: [0, 0, 0], startLifetime: 5, remainingLifetime: 5, startSize: [1, 1, 1], rotation: [0, 0, 0] }]);
  const skiff = s.place(1);
  const rudderSplash = skiff.RudderEmitters[0].subEmitters[0].system;
  rudderSplash.setParticles([{ position: [7, 8, 9], velocity: [0, 0, 0], startLifetime: 5, remainingLifetime: 5, startSize: [1, 1, 1], rotation: [0, 0, 0] }]);
  s.rt.StartSailing(skiff);
  s.rt.state.MoveVectorCurrent = [0, 0, 1];
  skiff.WakeEmitter.stop();
  dinghy.WakeEmitter.play();   // a boat not the helm's, its wake playing: the shift's Stop ends it
  s.rt.OnPositionUpdate([819.2, 0, -819.2]);
  assert.deepEqual(dinghy.WakeEmitter.getParticles()[0].position, [f(1 + 819.2), 2, f(3 - 819.2)]);
  assert.deepEqual(splash.getParticles()[0].position, [f(4 + 819.2), 5, f(6 - 819.2)]);
  assert.deepEqual(rudderSplash.getParticles()[0].position, [7, 8, 9], 'the rudder\'s splashes stay behind');
  assert.equal(dinghy.WakeEmitter.isEmitting, false);
  assert.equal(skiff.WakeEmitter.isEmitting, true, 'the helm\'s boat, under way: played again');
});

test('CSA-F: LateUpdate\'s bob - each active boat rocked by the wind (Time.time plus its index, over the time scale), the roll the helm\'s turn and the wind\'s sway, the pitch the wind\'s times modifierAnimation - the roll not (the C#\'s precedence, kept)', () => {
  const s = scene();
  const a = s.place(1), b = s.place(1);
  s.rt.state.windVectorCurrent = [1.2, 0, 1.6];   // magnitude 2
  s.world.time = 3;
  s.rt.lateUpdate();
  const mag = 2;
  for (const [i, boat] of [[0, a], [1, b]]) {
    const num2 = f(f(f(3) + i) / TIME_SCALES[0]);
    const roll = f(f(Math.sin(f(f(num2 * f(0.5)) * mag))) * mag);
    const pitch = f(f(f(Math.sin(f(num2 * mag))) * mag) * f(boat.modifierAnimation));
    nearV(boat.MeshObject.localRotation, quatEuler(pitch, 0, roll), 1e-6, `boat ${i}`);
  }
  // at the helm, turning, under way past the threshold: the roll leans into the turn by -5x, clamped to 30
  s.rt.StartSailing(a);
  s.rt.state.MoveVectorCurrent = [0, 0, 2];
  s.rt.state.TurnCurrent = 10;
  s.rt.lateUpdateBoats?.();
  s.rt.lateUpdate();
  const num = f(f(10 / 10) * f(f(2 * f(0.1)) / 2));
  const num2 = f(f(f(3) + 0) / 1);
  const roll = f(Math.min(30, Math.max(-30, f(f(0 - num) * 5))) + f(f(Math.sin(f(f(num2 * f(0.5)) * mag))) * mag));
  const rot = quatRotate(a.MeshObject.localRotation, [1, 0, 0]);
  const want = quatRotate(quatEuler(f(f(f(Math.sin(f(num2 * mag))) * mag) * f(a.modifierAnimation)), 0, roll), [1, 0, 0]);
  nearV(rot, want, 1e-5, 'the turn\'s lean');
});

test('CSA-F: LateUpdate\'s flag - its forward the wind less a tenth of the boat\'s way (in the world), its streamer\'s start speed half that vector\'s length', () => {
  const s = scene();
  const boat = s.place(1);   // the skiff's variant 0 has a flag
  assert.ok(boat.FlagObject, 'a flag');
  s.rt.state.windVectorCurrent = [1, 0, 0];
  s.rt.state.MoveVectorCurrent = [0, 0, 2];
  s.rt.lateUpdate();
  const v = [1, 0, f(-0.2)];
  const l = Math.hypot(...v);
  nearV(quatRotate(boat.FlagObject.rotation, [0, 0, 1]), v.map((c) => c / l), 1e-5);
  near(evaluateMinMax(boat.FlagEmitterMain.startSpeed), f(f(l) * f(0.5)), 1e-6);
  nearV(boat.FlagObject.rotation, quatLookRotation(v.map((c) => c / l)), 1e-6);
});

test('CSA-F: RotateWind sets the rain\'s and the snow\'s ForceOverLifetime each step - a random between ten and fifty times the wind for the rain, five and twenty-five for the snow, x and z', () => {
  const s = scene();
  s.rt.state.windVectorCurrent = [0, 0, 1];
  s.rt.state.windVectorTarget = [1, 0, 0];
  s.rt.OnNewHour();   // UpdateWind: a new target and one more RotateWind, run to its first yield
  assert.ok(s.out.forces.length >= 1);
  const [wx, , wz] = s.rt.state.windVectorCurrent;
  const last = s.out.forces[s.out.forces.length - 1];
  assert.deepEqual([last.rain.x.minScalar, last.rain.x.scalar, last.rain.z.minScalar, last.rain.z.scalar], [f(wx * 10), f(wx * 50), f(wz * 10), f(wz * 50)]);
  assert.deepEqual([last.snow.x.minScalar, last.snow.x.scalar, last.snow.z.minScalar, last.snow.z.scalar], [f(wx * 5), f(wx * 25), f(wz * 5), f(wz * 25)]);
  assert.equal(last.rain.x.minMaxState, 3, 'two constants');
});

test('CSA-F: the particle systems step at the head of LateUpdate - a boat under way at the helm lays its wake as the frames run, and a paused frame lays nothing', () => {
  const s = scene();
  const boat = s.place();
  for (let i = 0; i < 5; i++) s.rt.endOfFrame();
  s.rt.StartSailing(boat);
  s.rt.state.MoveVectorCurrent = [0, 0, 2];
  s.rt.state.MoveVectorTarget = [0, 0, 1];
  s.rt.state.velocityTarget = [0, 0, 2];
  for (let i = 0; i < 12; i++) s.frame();
  assert.ok(boat.WakeEmitter.particleCount > 0, `the wake: ${boat.WakeEmitter.particleCount}`);
  assert.ok(boat.particleSystems.length > 0);
  const n = boat.WakeEmitter.particleCount;
  const lives = boat.WakeEmitter.getParticles().map((q) => q.remainingLifetime);
  s.world.dt = 0;
  s.rt.lateUpdate({ paused: true });
  assert.equal(boat.WakeEmitter.particleCount, n);
  assert.deepEqual(boat.WakeEmitter.getParticles().map((q) => q.remainingLifetime), lives, 'a paused frame (Time.deltaTime nought) ages none');
});

test('CSA-F: the particles\' materials as the bundle\'s shaders draw them - WakeMaterial cut at half alpha and lit on its up-facing quad, Default-Particle premultiplied and unlit, the flag\'s cube orange and lit, its triangles wound out; the soft dot white premultiplied, clear at its rim', () => {
  assert.match(PART_CUT_FS, /if \(t\.a \* uColor\.a - uCutoff < 0\.0\) discard;/);
  assert.match(PART_CUT_FS, /uSunScale \* max\(uLightDir\.y, 0\.0\)/);
  assert.match(PART_PREMUL_FS, /outColor = texture\(uTex, vUv\) \* c \* c\.a;/);
  assert.match(CUBE_FS, /max\(dot\(normalize\(vNormal\), uLightDir\), 0\.0\)/);
  const src = readFileSync(new URL('../../../src/render/comeSailAwayRender.js', import.meta.url), 'utf8');
  assert.match(src, /gl\.uniform4f\(u\.uColor, 1, 0\.5, 0, 1\);   \/\/ FlagMaterial's _Color/);
  assert.match(src, /gl\.blendFunc\(gl\.ONE, gl\.ONE_MINUS_SRC_ALPHA\);   \/\/ Blend One OneMinusSrcAlpha/);
  assert.match(src, /gl\.depthMask\(false\);   \/\/ ZWrite Off/);
  assert.deepEqual(json('materials.json').FlagMaterial.colors._Color, [1, 0.5, 0, 1]);
  assert.equal(json('materials.json').WakeMaterial.floats._Cutoff, 0.5);
  assert.equal(CUBE_TRIANGLES.length, 36);
  for (let i = 0; i < 36; i += 3) {
    const [a, b, c] = CUBE_TRIANGLES.slice(i, i + 3).map((t) => t.p);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const n = CUBE_TRIANGLES[i].n;
    assert.ok(cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] > 0, `triangle ${i / 3} wound out`);
  }
  const dot = softParticleTexture(16);
  assert.deepEqual([...dot.data.subarray(0, 4)], [0, 0, 0, 0], 'the corner clear - and black, or One OneMinusSrcAlpha adds its white over the whole quad (NAV-B)');
  const mid = (8 * 16 + 8) * 4;
  assert.ok(dot.data[mid + 3] > 200, 'the middle nearly opaque');
  for (let i = 0; i < dot.data.length; i += 4) assert.ok(dot.data[i] === dot.data[i + 3] && dot.data[i + 1] === dot.data[i + 3] && dot.data[i + 2] === dot.data[i + 3], `texel ${i / 4}: white premultiplied, its colour its coverage`);
});
