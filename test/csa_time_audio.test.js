// CSA-G (2026-09-27) - COME SAIL AWAY'S TIME AND SOUNDS: systems/comeSailAway.js's time scale (the helm's three keys,
// IncreaseTimeScale, DecreaseTimeScale, the enemies' gates, Update's unpause reset and Travel Options' isTravelActive),
// the oars' three animation events through the rudder's listener, the two loops as Unity keeps them, UpdateAudioSource,
// the sails' and the door's DFU clips - over the vendored hulls - and world/unityAnimator.js's clip events,
// world/unityParticles.js's startDelay, the HUD's two message clocks and the bus's two laws. Every expectation is worked
// out here from ComeSailAway.cs, DFU and Unity's own statements.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comeSailAwayModels } from '../src/systems/comeSailAwayModels.js';
import { spawnBoat, TRIGGER_MODEL, animatorOf, AUDIO_CLIPS, goModelName } from '../src/systems/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, TIME_SCALES, BOAT_ACTIONS, BOAT_TIME_ACTIONS, HELM_TIME_LOCKED_TEXT, customModelOf, activationModelOf } from '../src/systems/comeSailAway.js';
import { helmButtons, helmPadGesture, helmPadPrompts, HELM_ACTIONS } from '../src/ui/enhancedHelm.js';
import { BED_MODELS } from '../src/systems/rrRealism.js';
import { createAnimator, pathHash } from '../src/world/unityAnimator.js';
import { PrefabNode, instantiatePrefab } from '../src/world/prefabNode.js';
import { instanceParticleSystems, constantCurve } from '../src/world/unityParticles.js';
import { MidScreenText } from '../src/ui/midScreenText.js';
import { HudText } from '../src/ui/hudText.js';
import { _setTimeScaleForTest } from '../src/systems/timeScale.js';
import { logarithmicRolloff, plainSourceGain } from '../src/systems/audio.js';

const DIR = new URL('../vendor/come-sail-away/Models/', import.meta.url);
const json = (p) => JSON.parse(readFileSync(new URL(p, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
const f = Math.fround;
const near = (a, b, eps = 1e-6, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b}`);
const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }), particleRandom: () => 0.5 });

function terrain(x, y) {
  return { mapPixelX: x, mapPixelY: y, position: [(x - 10) * 819.2, 0, -(y - 20) * 819.2], tileMap: new Uint8Array(128 * 128), sampleHeight: () => 20 };
}

/** A scripted scene - Time.deltaTime a quarter second, the waves off, water everywhere; the keys pressed per frame. */
function scene(opts = {}) {
  const out = { mid: [], hud: [], timeScales: [], audio: [] };
  const held = new Set(opts.held ?? []);
  const started = new Set();
  const player = { position: [1, 2, 3], yaw: 0, frozen: 0 };
  const terrains = [terrain(10, 20)];
  const world = { time: 0, dt: 0.25, inside: false, enemies: false, travelling: opts.travelling ?? null, timeScale: 1, online: !!opts.online };
  const settings = { 'Waves.Enable': false, ...opts.settings };
  const deps = {
    pool: { models: MODELS, ready: () => true, spawnNow: (boat, p) => { spawnBoat(boat, ctxFor(p)); return boat; }, remove: () => {} },
    player: () => ({ position: [...player.position], rotation: [0, 0, 0, 1] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: 10, Y: 20 }),
    isPlayerInside: () => world.inside,
    blockWaterLevel: () => NO_WATER_LEVEL,
    iliacPuddleNoMore: () => false,
    raycast: () => null,
    playerTerrain: () => terrains[0], terrainAt: () => terrains[0], terrains: () => terrains,
    heightMapValue: () => 255,
    worldCompensation: () => [0, 0, 0],
    hudText: (t) => out.hud.push(t), midScreenText: (t, s) => out.mid.push([t, s]), log: () => {},
    random: { range: (min) => min, rangeFloat: (min) => min },
    time: () => world.time,
    hour: () => 12,
    weatherType: () => 0,
    persistentDungeonBoats: () => false,
    packedItems: { serialize: (i) => i, deserialize: (r) => r },
    dt: () => world.dt,
    setting: (k) => settings[k],
    input: {
      has: (a) => held.has(a), started: (a) => started.has(a),
      horizontal: () => (held.has('MoveRight') ? 1 : 0) - (held.has('MoveLeft') ? 1 : 0),
      vertical: () => (held.has('MoveForwards') ? 1 : 0) - (held.has('MoveBackwards') ? 1 : 0),
      toggleAutorun: false,
    },
    helm: { setPlayerPosition: (p) => { player.position = [...p]; }, setFacing: () => {}, turnPlayer: () => {}, freeze: (s) => { player.frozen = s; }, frozen: () => player.frozen > 0, stopRunning: () => {}, footsteps: () => {}, alignToGround: () => {} },
    transport: { isFoot: () => true, setFoot: () => {}, hasHorse: () => false, hasCart: () => false, isOnShip: () => false },
    ship: { owns: () => true, assign: () => {}, removePermanentScene: () => {} },
    entity: { isFemale: () => false, carriedWeight: () => 10, wagonWeight: () => 0, decreaseFatigue: () => {} },
    cargoWeight: () => 0, sphereCastAll: () => [], enemies: () => [], messageBox: () => {},
    enemiesNearby: () => world.enemies,
    travelOptionsActive: () => world.travelling,
    timeLocked: () => !!world.online,   // HELM-TIME-ONLINE
    timeScale: () => world.timeScale,
    setTimeScale: (s) => { world.timeScale = s; out.timeScales.push(s); },
    soundVolume: () => opts.soundVolume ?? 1,
    audio: {
      play: (src) => out.audio.push(['play', src.clip]), stop: (src) => out.audio.push(['stop', src.clip]),
      oneShot: (src, node, clip, v) => out.audio.push(['oneShot', clip, v, node?.name]),
      dfOneShot: (node, i, blend, v) => out.audio.push(['dfOneShot', i, blend, v, node?.name]),
      dfClipAtPoint: (i, pos, v) => out.audio.push(['dfClipAtPoint', i, pos, v]),
    },
  };
  const rt = createComeSailAwayRuntime(deps);
  const frame = ({ press = [], paused = false } = {}) => {
    started.clear();
    for (const a of press) started.add(a);
    rt.endOfFrame(); rt.fixedUpdate({ paused }); rt.update({ paused }); rt.lateUpdate({ paused });
    started.clear();
    world.time = f(world.time + world.dt);
  };
  const place = (hull = 1, variant = 0) => rt.PlaceBoat([100, 34, 200], [0, 0, 1], hull, variant, terrains[0]);
  return { rt, out, world, held, settings, frame, place, deps };
}

// ── the time scale ─────────────────────────────────────────────────────────────

test('CSA-G: the helm\'s time keys - up walks 1, 5, 10, 15, 30 and stops at the fifth; down walks back to the first; reset puts it at one; each step sets Time.timeScale and says so for three seconds at its scale (3 x scale of them)', () => {
  const s = scene();
  assert.deepEqual([...TIME_SCALES], [1, 5, 10, 15, 30]);
  assert.deepEqual([BOAT_ACTIONS.timeScaleUp, BOAT_ACTIONS.timeScaleDown, BOAT_ACTIONS.timeScaleReset], ['BoatTimeScaleUp', 'BoatTimeScaleDown', 'BoatTimeScaleReset']);
  s.frame({ press: [BOAT_ACTIONS.timeScaleUp] });
  assert.deepEqual(s.out.timeScales, [], 'away from the helm the keys are not read');
  s.rt.StartSailing(s.place());
  for (let i = 0; i < 5; i++) s.frame({ press: [BOAT_ACTIONS.timeScaleUp] });
  assert.deepEqual(s.out.timeScales, [5, 10, 15, 30], 'the fifth press finds the last step');
  assert.equal(s.rt.state.timeScaleIndex, 4);
  assert.deepEqual(s.out.mid.slice(-4), [['Time scale set to 5.', 15], ['Time scale set to 10.', 30], ['Time scale set to 15.', 45], ['Time scale set to 30.', 90]]);
  s.frame({ press: [BOAT_ACTIONS.timeScaleDown] });
  assert.equal(s.world.timeScale, 15);
  s.frame({ press: [BOAT_ACTIONS.timeScaleReset] });
  assert.equal(s.rt.state.timeScaleIndex, 0);
  assert.equal(s.world.timeScale, 1);
  assert.deepEqual(s.out.mid[s.out.mid.length - 1], ['Time scale set to 1.', 3]);
  s.frame({ press: [BOAT_ACTIONS.timeScaleDown] });
  assert.deepEqual(s.out.timeScales.slice(-1), [1], 'down at the first step: nothing');
  s.frame({ press: [BOAT_ACTIONS.timeScaleReset] });
  assert.deepEqual(s.out.timeScales.slice(-1), [1], 'reset at one: nothing (timeScaleIndex 0 and Time.timeScale 1)');
});

test('CSA-G: enemies near - IncreaseTimeScale refuses ("There are enemies nearby..." for a second and a half); a raised scale at the helm with enemies near comes back to one unsaid', () => {
  const s = scene();
  s.rt.StartSailing(s.place());
  s.world.enemies = true;
  s.frame({ press: [BOAT_ACTIONS.timeScaleUp] });
  assert.deepEqual(s.out.mid[s.out.mid.length - 1], ['There are enemies nearby...', f(1.5)]);
  assert.equal(s.rt.state.timeScaleIndex, 0);
  assert.deepEqual(s.out.timeScales, []);
  s.world.enemies = false;
  s.frame({ press: [BOAT_ACTIONS.timeScaleUp] });
  assert.equal(s.world.timeScale, 5);
  const said = s.out.mid.length;
  s.world.enemies = true;
  s.frame();
  assert.equal(s.rt.state.timeScaleIndex, 0);
  assert.equal(s.world.timeScale, 1);
  assert.deepEqual(s.out.mid.slice(said), [['There are enemies nearby...', f(1.5)]], 'ResetTimeScale(message: false) says nothing of its own');
});

test('CSA-G: Update after a pause puts a scale that is not one back to one - unless Travel Options says its journey runs (isTravelActive, asked each LateUpdate; no mod, no answer, nothing changed)', () => {
  const s = scene();
  s.world.timeScale = 5;   // another mod's scale (a journey's), the helm's index at nought
  s.frame({ paused: true });
  s.frame();
  assert.deepEqual(s.out.timeScales, [1], 'wasPaused, Time.timeScale != 1, not travelling: reset');
  const t = scene({ travelling: true });
  t.frame();   // LateUpdate asks: travelling
  assert.equal(t.rt.state.isTravelling, true);
  assert.equal(t.rt.state.wasTravelling, true);
  t.world.timeScale = 20;
  t.frame({ paused: true });
  t.frame();
  assert.deepEqual(t.out.timeScales, [], 'a journey\'s scale is left to the journey');
  t.world.travelling = false;
  t.frame();
  assert.deepEqual([t.rt.state.isTravelling, t.rt.state.wasTravelling], [false, false]);
  const n = scene({ travelling: null });
  n.rt.state.isTravelling = true;
  n.frame();
  assert.equal(n.rt.state.isTravelling, true, 'TravelOptions == null: the message is never sent');
});

test('TRAVEL-X1 (Satranath: "the menu says 10x at the top but it\'s moving at 1x and when starting or resuming travel it\'s 1x"): a journey BEGUN in the pause - the travel map\'s Begin or its resume - keeps its scale on the first frame after it', () => {
  const s = scene({ travelling: false });
  s.frame();   // walking: LateUpdate latches "not travelling"
  s.frame({ paused: true });   // the travel map is up
  s.world.travelling = true;   // Begin: InitTravelUI's SetTimeScale and the panel pushed, between two frames
  s.world.timeScale = 10;
  s.frame();
  assert.deepEqual(s.out.timeScales, [], 'the journey the map began is running - its x10 is not put back to one');
  assert.equal(s.rt.state.isTravelling, true);
  assert.deepEqual(s.out.mid, [], 'and no "Time scale set to 1." over it');
  // the other side still holds: a scale nobody's journey stands behind, after a pause, comes back to one
  const u = scene({ travelling: false });
  u.frame();
  u.frame({ paused: true });
  u.world.timeScale = 10;
  u.frame();
  assert.deepEqual(u.out.timeScales, [1]);
});

// ── the Animator's events ────────────────────────────────────────────────────

/** A one-layer controller over a node: A a 1D blend of two looping clips (Ev1 and Ev2 by Mix), B a clip with a time-0 event. */
function eventToy() {
  const animation = {
    controllers: {
      Toy: {
        params: [{ name: 'Mix', type: 'Float', default: 0 }],
        layers: [{ name: 'Base Layer', defaultState: 'A', states: [
          { name: 'A', fullPath: 'Base Layer.A', speed: 1, motion: [{ type: 0, param: 'Mix', thresholds: [0, 1], children: [1, 2] }, { type: 0, clip: 'Ev1', children: [] }, { type: 0, clip: 'Ev2', children: [] }], transitions: [] },
          { name: 'B', fullPath: 'Base Layer.B', speed: 1, motion: [{ type: 0, clip: 'Ev0', children: [] }], transitions: [] },
        ] }],
      },
    },
    overrides: {},
    clips: {
      Ev1: { start: 0, stop: 1, loop: true, events: [{ time: 0.25, functionName: 'Hit' }, { time: 0.75, functionName: 'Miss' }], curves: [{ path: pathHash('Bone'), attribute: 'position', components: [{ constant: 0 }, { constant: 0 }, { constant: 0 }] }] },
      Ev2: { start: 0, stop: 1, loop: true, events: [{ time: 0.5, functionName: 'Two' }], curves: [] },
      Ev0: { start: 0, stop: 2, loop: false, events: [{ time: 0, functionName: 'Zero' }, { time: 1, functionName: 'Mid' }], curves: [] },
    },
  };
  const root = new PrefabNode('Root');
  new PrefabNode('Bone').setParent(root);
  const c = { type: 'Animator', m_Enabled: 1, m_Controller: { controller: 'Toy' } };
  root.addComponent(c);
  const heard = [];
  const listener = root.addComponent({ type: 'Listener', Hit: () => heard.push('Hit'), Miss: () => heard.push('Miss'), Two: () => heard.push('Two'), Zero: () => heard.push('Zero'), Mid: () => heard.push('Mid') });
  root.addComponent({ type: 'Other', Hit: () => heard.push('Hit, again') });   // SendMessage reaches every component with the method
  return { a: createAnimator(root, c, animation), heard, listener };
}

test('CSA-G: the Animator fires a clip\'s events as its time passes them - once each loop, only while the clip is weighed above nought, to every component on its node with the method; a state entered from its start fires its time-0 event, and a clip that does not loop fires its own once', () => {
  const { a, heard } = eventToy();
  a.update(0.125);   // 0 to 0.125: nothing (Ev2 weighs nought at Mix 0)
  assert.deepEqual(heard, []);
  a.update(0.125);   // to 0.25 exactly: Ev1's 0.25, reached
  assert.deepEqual(heard, ['Hit', 'Hit, again']);
  heard.length = 0;
  a.update(0.05);   // from 0.25: an event the last frame reached is not heard again
  assert.deepEqual(heard, []);
  a.update(1.0);   // to 1.3: Ev1's 0.75 and its next loop's 0.25
  assert.deepEqual(heard, ['Miss', 'Hit', 'Hit, again']);
  heard.length = 0;
  a.SetFloat('Mix', 0.5);
  a.update(0.3);   // to 1.6: Ev2's 0.5 (weighed a half now)
  assert.deepEqual(heard, ['Two']);
  heard.length = 0;
  a.SetFloat('Mix', 1);
  a.update(0.3);   // to 1.9: Ev1 weighs nought - its 0.75 is not heard
  assert.deepEqual(heard, []);
  // B from its start: its time-0 event on the frame it is entered, its 1 (of 2) once, and never again (it does not loop)
  a.CrossFade('B', 0);
  a.update(0.1);
  assert.equal(a.stateName, 'B');
  assert.ok(heard.includes('Zero'), `${heard}`);
  heard.length = 0;
  a.update(1.0);
  a.update(1.0);
  a.update(1.0);
  assert.deepEqual(heard, ['Mid']);
});

test('CSA-G: the oars\' events on the vendored Rowboat - rowing, its Rudder Rowing Forward sends OarEvent_Sweep, _Out and _In at a sixth, a third and thirteen fifteenths of each stroke; each plays both oars\' splashes after its start delay; the Rowboat\'s rudder carries no AudioSource, so no stroke is heard; away from the helm the listener does nothing', () => {
  const s = scene({ held: ['MoveForwards'] });
  const boat = s.place(0);
  const rudder = animatorOf(boat.RudderObject);
  const listener = boat.RudderObject.getComponent('RudderAnimationEventListener');
  assert.ok(listener && typeof listener.OarEvent_In === 'function', 'GetBoatTransforms\' listener, bound to the runtime');
  const calls = [];
  const delays = { OarEvent_In: new Set(), OarEvent_Sweep: new Set(), OarEvent_Out: new Set() };
  for (const n of ['OarEvent_In', 'OarEvent_Sweep', 'OarEvent_Out']) {
    const f0 = listener[n];
    listener[n] = () => { calls.push([n, rudder.current?.state.name === 'Rowing' ? rudder.current.time : rudder.next?.time]); f0(); if (s.rt.isSailing()) for (const p of boat.OarParticles) delays[n].add(p.main.startDelay.scalar); };
  }
  listener.OarEvent_Sweep();   // not sailing: nothing
  assert.ok(boat.OarParticles.every((p) => !p.isPlaying));
  calls.length = 0;
  s.rt.StartSailing(boat);
  for (let i = 0; i < 60; i++) s.frame(i ? {} : { press: ['MoveForwards'] });   // HELM-LADDER: a rung up, her oars pulling ahead
  const names = calls.map((c) => c[0]);
  assert.ok(names.length >= 6, `${names}`);
  const cycle = ['OarEvent_Sweep', 'OarEvent_Out', 'OarEvent_In'];
  names.forEach((n, i) => assert.equal(n, cycle[i % 3], `stroke order at ${i}`));
  for (const [n, t] of calls) {
    const u = t - Math.floor(t);
    const at = { OarEvent_Sweep: 1 / 6, OarEvent_Out: 1 / 3, OarEvent_In: 13 / 15 }[n];
    assert.ok(u >= at - 1e-6 && u < at + 0.25, `${n} passed at ${u}, its event at ${at}`);   // a frame's step past the event, never before it
  }
  assert.equal(boat.OarParticles.length, 2);
  assert.ok(boat.OarParticles.every((p) => p.isPlaying), 'both oars\' splashes played');
  assert.deepEqual([...delays.OarEvent_In], [f(0.4)], 'In: the splash after 0.4 s');
  assert.deepEqual([...delays.OarEvent_Sweep], [0], 'Sweep: at once');
  assert.deepEqual([...delays.OarEvent_Out], [f(0.1)], 'Out: after a tenth');
  assert.deepEqual(s.out.audio.filter((e) => e[0] === 'oneShot'), [], 'no AudioSource on this rudder');
});

test('CSA-G: the Trireme\'s strokes are heard - its rudder\'s own AudioSource (spatial 0.9, pitch 1.5) plays Oars_In, Oars_Sweep and Oars_Out as its clip\'s events pass - but only at the first time scale', () => {
  const s = scene({ held: ['MoveForwards'] });
  const boat = s.place(3);
  const src = boat.RudderObject.getComponent('AudioSource');
  assert.deepEqual([src.m_Volume, src.m_Pitch, src.MinDistance, src.MaxDistance], [1, 1.5, 1, 500]);
  assert.equal(src.panLevelCustomCurve.m_Curve[0].value, f(0.9), 'the spatial blend the port plays fully positional');
  s.rt.StartSailing(boat);
  for (let i = 0; i < 40; i++) s.frame(i ? {} : { press: ['MoveForwards'] });   // HELM-LADDER: a rung up, her oars pulling ahead
  const heard = s.out.audio.filter((e) => e[0] === 'oneShot');
  assert.ok(heard.length >= 3, `${heard.length}`);
  for (const e of heard) {
    assert.ok([AUDIO_CLIPS[2], AUDIO_CLIPS[3], AUDIO_CLIPS[4]].includes(e[1]), e[1]);
    assert.equal(e[2], 1);
    assert.equal(e[3], 'RudderObject');
  }
  heard.forEach((e, i) => assert.equal(e[1], ['Oars_In', 'Oars_Sweep', 'Oars_Out'][i % 3], `stroke ${i}: its clip (In at 0, Sweep at a quarter, Out at five eighths - the trireme's stroke opens on its time-0 event)`));
  const n = heard.length;
  s.rt.IncreaseTimeScale();
  for (let i = 0; i < 40; i++) s.frame();
  assert.equal(s.out.audio.filter((e) => e[0] === 'oneShot').length, n, 'timeScaleIndex above nought: silent strokes');
});

test('CSA-G: MainModule.startDelay - a fresh Play waits it out before its clock and its time-0 burst start; a Play while the system still plays is no new start', () => {
  const P = json('prefabs.json');
  const root = instantiatePrefab(P.prefabs['112410'], P.components);
  instanceParticleSystems(root, { random: () => 0.5 });
  const oar = root.find("Dingy/RudderObject/OarL/T'avaTriremeOar/OarEffect").getComponent('ParticleSystem').particleSystem;
  oar.main.startDelay = constantCurve(f(0.4));
  oar.play();
  oar.step(0.25);
  assert.equal(oar.particleCount, 0, 'a quarter second into its 0.4');
  assert.equal(oar.time, 0);
  oar.step(0.25);
  assert.equal(oar.particleCount, 1, 'the burst, past the delay');
  near(oar.time, 0.1, 1e-6, 'the clock started at the delay\'s end');
  oar.main.startDelay = constantCurve(3);
  oar.play();
  oar.step(0.1);
  near(oar.time, 0.2, 1e-6, 'still playing: Play started nothing, its delay unread');
});

// ── the sounds ───────────────────────────────────────────────────────────────

test('CSA-G: the boats\' DFU clips - raising and lowering the sails play 380 and 381 from BoatSFXOneShot at SoundVolume x the mod\'s own; TriggerDoor plays 94 opening a shut door and 93 closing an open one, at the trigger, at one', () => {
  const s = scene({ soundVolume: 0.8, settings: { 'Audio.SoundVolume': 0.5 } });
  const boat = s.place(1);
  s.rt.StartSailing(boat);
  s.rt.RaiseSails();
  s.rt.LowerSails();
  const v = f(f(0.8) * f(0.5));
  assert.deepEqual(s.out.audio.filter((e) => e[0] === 'dfOneShot'), [['dfOneShot', 380, 1, v, 'BoatSFXOneShot'], ['dfOneShot', 381, 1, v, 'BoatSFXOneShot']]);
  const galleon = s.place(2);
  const trigger = [...galleon.GameObject.walk()].find((n) => n.name === 'DaggerfallMesh [ID=112403] [Replacement]');
  s.rt.activate(TRIGGER_MODEL.door, { node: trigger, root: galleon.GameObject, distance: 2 }, 'grab');
  s.rt.activate(TRIGGER_MODEL.door, { node: trigger, root: galleon.GameObject, distance: 2 }, 'grab');
  const door = s.out.audio.filter((e) => e[0] === 'dfClipAtPoint');
  assert.deepEqual(door.map((e) => [e[1], e[3]]), [[94, 1], [93, 1]]);
  assert.deepEqual(door[0][2], [...trigger.position]);
});

test('CSA-G: a boat\'s two loops as Unity keeps them - both stop as its object goes inactive; as it comes back, AddComponent\'s playOnAwake plays both again from their starts, each at the volume it last had (the fast loop\'s never faded: its first, 1 - kept)', () => {
  const s = scene();
  const boat = s.place(1);
  const slow = boat.AudioSourceSlow, fast = boat.AudioSourceFast;
  assert.deepEqual([slow.isPlaying, fast.isPlaying], [true, false], 'placed: PlaySlow');
  const plays = slow.plays;
  s.world.inside = true;   // a building: the outdoor boat goes
  s.rt.UpdateBoatVisibility();
  assert.equal(boat.GameObject.activeSelf, false);
  assert.deepEqual([slow.isPlaying, fast.isPlaying], [false, false]);
  s.world.inside = false;
  s.rt.UpdateBoatVisibility();
  assert.equal(boat.GameObject.activeSelf, true);
  assert.deepEqual([slow.isPlaying, fast.isPlaying], [true, true], 'both, as their object comes back');
  assert.equal(slow.plays, plays + 1, 'a Play: from the clip\'s start');
  assert.equal(fast.volume, 1, 'the fast loop at its AudioSource\'s first volume');
});

test('CSA-G: UpdateAudioSource - on a change of the mod\'s Audio volume every loop still heard takes SoundVolume x the new one and a loop faded to nothing stays there; no change, no update', () => {
  const s = scene({ soundVolume: 0.8, settings: { 'Audio.SoundVolume': 1 } });
  const boat = s.place(1);
  for (let i = 0; i < 5; i++) s.rt.endOfFrame();   // the placement's fade run out
  boat.AudioSourceFast.volume = 0;
  const before = boat.AudioSourceSlow.volume;
  s.rt.checkSettings();
  assert.equal(boat.AudioSourceSlow.volume, before, 'unchanged since Start: nothing');
  s.settings['Audio.SoundVolume'] = 0.5;
  s.rt.checkSettings();
  assert.equal(boat.AudioSourceSlow.volume, f(f(0.8) * f(0.5)));
  assert.equal(boat.AudioSourceFast.volume, 0, 'a silent loop stays silent');
});

test('CSA-G: the HUD\'s message clocks count game time - the mid-screen text holds its delay in game seconds, the popup lines run out in them (DaggerfallHUD.cs:262, PopupText.cs:56-59: Time.deltaTime, which the time scale scales)', () => {
  try {
    _setTimeScaleForTest(30);
    const mid = new MidScreenText();
    mid.set('Time scale set to 30.', 90);
    for (let i = 0; i < 29; i++) mid.tick(0.1);
    assert.equal(mid.text, 'Time scale set to 30.', 'two point nine real seconds: 87 of the 90');
    mid.tick(0.2);
    assert.equal(mid.text, '', 'past three real seconds: gone');
    const hud = new HudText();
    hud.add('Sail raised!', 1.5);
    hud.tick(0.05);   // 1.5 game seconds
    hud.tick(0.04);   // and past the pop delay
    assert.equal(hud.lines.length, 0);
  } finally {
    _setTimeScaleForTest(1);
  }
  const mid = new MidScreenText();
  mid.set('x', 1.5);
  mid.tick(1);
  assert.equal(mid.text, 'x', 'at one, real seconds');
});

test('CSA-G: the bus\'s two laws - Unity\'s logarithmic rolloff (full inside minDistance, minDistance over the distance, no quieter past maxDistance), and a plain AudioSource\'s volume over the SoundVolume bus (divided out; silence at nought)', () => {
  assert.equal(logarithmicRolloff(0.5, 2, 4), 1);
  assert.equal(logarithmicRolloff(2, 2, 4), 1);
  assert.equal(logarithmicRolloff(3, 2, 4), 2 / 3);
  assert.equal(logarithmicRolloff(4, 2, 4), 0.5);
  assert.equal(logarithmicRolloff(400, 2, 4), 0.5, 'past maxDistance it stops attenuating - a boat\'s loop at half its volume however far off (kept)');
  assert.equal(plainSourceGain(0.6, 0.5), 1.2);
  assert.equal(plainSourceGain(0.6, 1), 0.6);
  assert.equal(plainSourceGain(0.6, 0), 0);
});

// ── the bed ────────────────────────────────────────────────────────────────────

test('CSA-G: the boat\'s bed is Roleplay Realism\'s - the Small Ship\'s and the Large Galley\'s DaggerfallMesh [ID=41000] (the other hulls\' BedObject is inactive in their prefabs) is one of BedActivation\'s three registrations and none of the mod\'s seven; the host\'s pick marks it only while bed sleeping is on, at DefaultActivationDistance, and its arm opens the mode\'s own rest door (indoors the window over the bed clicked), silent past that reach', () => {
  const beds = [0, 1, 2, 3, 4].map((hull) => scene().place(hull).BedObject?.name ?? null);
  assert.deepEqual(beds, [null, null, goModelName(41000), goModelName(41000), null]);
  assert.deepEqual([customModelOf(beds[2], BED_MODELS), activationModelOf(beds[2])], [41000, null]);
  assert.equal(customModelOf('DaggerfallMesh [ID=41002] [Replacement]', BED_MODELS), 41002, 'the name cut after its first ]');
  assert.equal(customModelOf('DaggerfallMesh [ID=41003]', BED_MODELS), null);
  assert.equal(customModelOf(goModelName(TRIGGER_MODEL.drive), BED_MODELS), null);
  // the host's pick and arm (scenes/world.js), the modes' door (scenes/worldModes.js)
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const pick = src.slice(src.indexOf('function csaActivationPick('), src.indexOf('const csaHoverName'));
  const own = src.slice(src.indexOf('function csaActivationPick('), src.indexOf('function csaPeerActivationPick('));   // CSA-K: my boats' own pick, before another's (which reads the bed the same way)
  assert.match(own, /const bed = modelId == null && bedSleepingOn\(\) && csaCustomModelOf\(best\.hit\.node\?\.name, BED_MODELS\) != null;/);
  // PIN MOVED (AUDIT PR478 C2): the helm's box under Steal keys its own ':steal' after the part - the bed's key unchanged
  assert.match(own, /:\$\{modelId \?\? \(bed \? 'bed' : 'hull'\)\}\$\{modelId === CSA_TRIGGER_MODEL\.drive && getInteractionMode\(\) === 'steal' \? ':steal' : ''\}`/);
  assert.match(own, /reach: bed \? DEFAULT_ACTIVATION_DISTANCE : CSA_ACTIVATION_DISTANCE,/);
  // CSA-J (the audit): the bed's press says it is one - BedActivation is the gate less its GiveOffer rung
  assert.match(pick, /if \(pick\?\.bed\) \{\s*if \(pick\.distance <= DEFAULT_ACTIVATION_DISTANCE\) \{ if \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior'\) \{ _restFromBed = true; try \{ toggleRest\(\); \} finally \{ _restFromBed = false; \} \} else modes\?\.restFromBed\?\.\(\); \}\s*return;\s*\}/);
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const at = wm.indexOf('    restFromBed() {');
  assert.ok(at > 0);
  const door = wm.slice(at, wm.indexOf('\n    },', at));
  assert.match(door, /if \(mode === 'interior' && interiorCtx\) restFromInteriorBed\(\);/);
  assert.match(door, /else if \(mode === 'dungeon' && dungeonCtx\) dungeonCtx\.restFromBed\(\);/);
  assert.match(wm, /const restFromInteriorBed = \(\) => \{ _restFromBed = true; try \{ interiorKeyCtx\.toggleRest\(\{ ignoreAllocatedBed: true \}\); \} finally \{ _restFromBed = false; \} \};/, 'the window told the bed is the one clicked, the offer rung skipped');
});

// ── the borrowed ship's scenes ─────────────────────────────────────────────────

test('CSA-G (the live probe): a crewed boat\'s helm borrows a ship (AssignShipToPlayer\'s two permanent scenes) and gives it back - through the lazy scene cache, since a fresh character has none until its first scene; the raw field threw on the street and left StartSailing half run', () => {
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const at = src.indexOf('  const shipPermanentScenes = (s) => {');
  assert.ok(at > 0);
  const body = src.slice(at, src.indexOf('\n  };', at));
  assert.equal((body.match(/addPermanentScene\(_sceneCache\(\), /g) ?? []).length, 2, 'the deck\'s and the hold\'s, each through the lazy cache');
  assert.ok(!/playerEntity\.sceneCache/.test(body), 'never the raw field');
  assert.match(src, /removePermanentScene: \(name\) => removePermanentScene\(_sceneCache\(\), name\),/);
  assert.match(src, /const _sceneCache = \(\) => \(playerEntity\.sceneCache \?\?= createSceneCache\(\)\);/);
});

// ── HELM-TIME-ONLINE (2026-10-04, Mac: "Remove the time dial from ships online") ──────────────────────────────────────

test('HELM-TIME-ONLINE: online the helm\'s time dial is retired - each of the three keys says why and moves nothing, and the panel\'s state says there is no dial; offline the keys walk the steps as ever (mutants: the gate dropped, the line unsaid, the state\'s flag wrong)', () => {
  assert.deepEqual([...BOAT_TIME_ACTIONS], [BOAT_ACTIONS.timeScaleUp, BOAT_ACTIONS.timeScaleDown, BOAT_ACTIONS.timeScaleReset]);
  const on = scene({ online: true });
  on.rt.StartSailing(on.place());
  for (const key of BOAT_TIME_ACTIONS) {
    const said = on.out.mid.length;
    on.frame({ press: [key] });
    assert.deepEqual(on.out.mid.slice(said), [[HELM_TIME_LOCKED_TEXT, f(1.5)]], `${key}: said why`);
  }
  assert.deepEqual([on.rt.state.timeScaleIndex, on.out.timeScales, on.world.timeScale], [0, [], 1], 'and nothing moved');
  assert.equal(on.rt.helmPanelState().timeDial, false, 'no dial to draw');
  const said = on.out.mid.length;
  on.frame();
  assert.equal(on.out.mid.length, said, 'no key, no new line');   // AUDIT-A1: counted - the last line alone was the same line said every frame
  const off = scene();
  off.rt.StartSailing(off.place());
  off.frame({ press: [BOAT_ACTIONS.timeScaleUp] });
  assert.deepEqual([off.world.timeScale, off.rt.helmPanelState().timeDial], [5, true], 'offline: the dial turns');
});

test('HELM-TIME-ONLINE: what ResetTimeScale is for besides the key stands online - another mod\'s scale (a journey\'s) is still put back when the helm\'s own reasons ask (mutant: the reset gated with the keys)', () => {
  const on = scene({ online: true });
  on.rt.StartSailing(on.place());
  on.world.timeScale = 60;   // a journey's x60 under the boat (RATE-LAW), set by another mod
  on.rt.ResetTimeScale(false);
  assert.equal(on.world.timeScale, 1, 'the reset itself is not the dial');
});

test('HELM-TIME-ONLINE: the enhanced helm drops its three time presses where the dial is retired, the pad\'s left and right step nothing (held, they only trim), and the prompt row says the trim alone; offline all as before (mutants: the presses kept online, the pad still stepping)', () => {
  const h = { hull: 1, hasSails: true, sailsUp: true, light: false, timeScaleIndex: 0, timeScale: 1, timeScaleMax: 4, manualTrim: false };
  const acts = (st) => helmButtons(st).map((b) => b.act);
  assert.ok(['slower', 'normal', 'faster'].every((a) => acts({ ...h, timeDial: true }).includes(a)), 'offline: the dial');
  assert.ok(!['slower', 'normal', 'faster'].some((a) => acts({ ...h, timeDial: false }).includes(a)), 'online: no dial');
  assert.ok(acts({ ...h, timeDial: false }).includes('leave') && acts({ ...h, timeDial: false }).includes('light'), 'the rest of the helm stands');
  const pressed = [], holds = [];
  const io = { press: (a) => pressed.push(a), hold: (a, v) => holds.push([a, v]) };
  for (const dir of ['left', 'right']) helmPadGesture(dir, 'tap', { ...h, timeDial: false }, io);
  helmPadGesture('left', 'hold', { ...h, timeDial: false }, io);
  assert.deepEqual(pressed, [], 'online: the pad steps nothing, nor puts the time back');
  assert.equal(helmPadGesture('right', 'hold', { ...h, timeDial: false, manualTrim: true }, io), true, 'held with the trim the player\'s: it trims');
  assert.deepEqual(holds, [[HELM_ACTIONS.trimRight, true]]);
  helmPadGesture('right', 'tap', { ...h, timeDial: true }, io);
  assert.deepEqual(pressed, [HELM_ACTIONS.faster], 'offline: right steps up');
  const rows = (st) => helmPadPrompts(st).map((r) => r[1]);
  assert.equal(rows({ ...h, timeDial: false }).length, 2, 'online, no trim: no left/right row');
  assert.deepEqual(rows({ ...h, timeDial: false, manualTrim: true }).at(-1), 'Trim (hold)');
  assert.deepEqual(rows({ ...h, timeDial: true }).at(-1), 'Slower / faster (hold left: normal time)');
});

test('HELM-TIME-ONLINE host: the world hands the runtime the shared clock as the lock (mutant: unwired)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /timeLocked: \(\) => sharedClockOn\(\),/);
});

