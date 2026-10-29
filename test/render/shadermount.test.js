// SHADER-EASE MOUNT-START and QUEUE-ORDER (2026-10-29; bible/07-Rendering/Performance-Priority.md SHADER-EASE
// MOUNT-START): in Chrome the game froze for the first 30-60 s in the world after each update. Every pass an outdoor
// host builds at mount read its link at once, a cold compile each, because nothing had started it. Each is listed now
// by render/mountPrograms.js and queued at page load; these pins hold each list to what its constructor builds, over a
// stub context that records every link and every LINK_STATUS read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateGl, E } from '../retroGl.mjs';
import { Renderer } from '../../src/render/renderer.js';
import { EL_LANE } from '../../src/render/enhancedLighting.js';
import { mountPrograms, startMountPrograms } from '../../src/render/mountPrograms.js';
import { bootPrograms, laneBootPrograms, startBootPrograms, SHADOW_PASS_VS, MOUNT_WAIT_TURNS, mountSettled } from '../../src/render/bootPrograms.js';
import { shadowDepthPrograms } from '../../src/render/shadowPass.js';
import { CLOUD_PROGRAMS } from '../../src/render/volumetricClouds.js';
import { CLOUD_NOISE_PROGRAMS } from '../../src/render/cloudNoise.js';
import { FarRingRenderer } from '../../src/render/farRing.js';
import { FarTreesBand } from '../../src/render/farTrees.js';
import { SkyRenderer } from '../../src/render/skyRenderer.js';
import { EnhancedSkyRenderer } from '../../src/render/enhancedSky.js';
import { WindWispsRenderer } from '../../src/render/windWisps.js';
import { DryFallRenderer } from '../../src/render/dryFall.js';
import { HeatHazeRenderer } from '../../src/render/heatHaze.js';
import { WindfallParticles } from '../../src/render/windfallParticles.js';
import { LightningBoltsRenderer } from '../../src/render/lightningBolts.js';
import { DuelWallRenderer } from '../../src/render/duelWall.js';
import { BannerRenderer } from '../../src/render/bannerPass.js';
import { ShipFlagRenderer } from '../../src/render/shipFlagPass.js';
import { RainCurtainsRenderer } from '../../src/render/rainCurtains.js';
import { SpoilsGlowRenderer } from '../../src/render/spoilsGlow.js';
import { NpcMarkRenderer } from '../../src/render/npcMarkPass.js';
import { NodeGlowRenderer, NODE_GLOW_PROGRAMS } from '../../src/render/nodeGlow.js';
import { NavalRenderer, NAVAL_PROGRAMS } from '../../src/render/navalRender.js';
import { playPrograms } from '../../src/render/playPrograms.js';
import { AURA_PROGRAMS } from '../../src/render/auraRing.js';
import { ARMORY_PROGRAMS } from '../../src/render/armoryPass.js';
import { AURORA_PROGRAMS } from '../../src/render/auroraPass.js';   // SKYRIM-AURORA: the sky's aurora, after them
import { getPref, setPref } from '../../src/systems/uiPrefs.js';

const COMPLETION_STATUS_KHR = 0x91B1;
const keyOf = ([vs, fs]) => `${vs}\0${fs}`;

/** stateGl's context with KHR_parallel_shader_compile, every link and every LINK_STATUS read recorded. */
function recordingGl({ complete = () => true } = {}) {
  const { canvas, gl: inner } = stateGl();
  const linked = [];
  const read = [];
  const gl = new Proxy(inner, {
    get(target, key) {
      if (key === 'getExtension') return (name) => (name === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR } : target.getExtension(name));
      if (key === 'linkProgram') return (p) => { linked.push(p); return target.linkProgram(p); };
      if (key === 'getProgramParameter') {
        return (p, name) => {
          if (name === COMPLETION_STATUS_KHR) return complete();
          if (name === E.LINK_STATUS) read.push(p);
          return target.getProgramParameter(p, name);
        };
      }
      return target[key];
    },
  });
  canvas.getContext = () => gl;
  const pair = (p) => keyOf([p.shaders[0]?.src, p.shaders[1]?.src]);
  /** The keys `fn` built - each program whose link it read. */
  const built = (fn) => { const from = read.length; fn(); return read.slice(from).map(pair); };
  return { canvas, gl, linked, built, pair };
}

/** Each pass's constructor (and the first body's shadow), what it built, on one context. */
function passBuilds(lane) {
  const rec = recordingGl();
  const gl = rec.gl;
  const paint = () => null;
  const compiling = recordingGl({ complete: () => false });   // the ash's door, started by its constructor, not built there
  const builds = {
    ring: rec.built(() => new FarRingRenderer(gl, { lane, flora: null })),
    trees: rec.built(() => new FarTreesBand(gl, { source: {}, lane })),
    sky: rec.built(() => new SkyRenderer(gl)),
    enhancedSky: rec.built(() => new EnhancedSkyRenderer(gl)),
    wisps: rec.built(() => new WindWispsRenderer(gl)),
    dryFall: compiling.built(() => new DryFallRenderer(compiling.gl)),
    haze: rec.built(() => new HeatHazeRenderer(gl)),
    windfall: rec.built(() => new WindfallParticles(gl, { random: Math.random })),
    bolts: rec.built(() => new LightningBoltsRenderer(gl)),
    duelWall: rec.built(() => new DuelWallRenderer(gl)),
    banner: rec.built(() => new BannerRenderer(gl, { paint })),
    flag: rec.built(() => new ShipFlagRenderer(gl, { paint })),
    curtains: rec.built(() => new RainCurtainsRenderer(gl)),
    spoils: rec.built(() => new SpoilsGlowRenderer(gl)),
    marks: rec.built(() => new NpcMarkRenderer(gl)),
  };
  const r = new Renderer(rec.canvas);
  r.setLightingLane(EL_LANE);
  builds.bodies = rec.built(() => r._shadowPass._ensureBodyPrograms());
  return builds;
}

/** Run `fn` under the prefs, put back after. */
function withPrefs(prefs, fn) {
  const kept = Object.fromEntries(Object.keys(prefs).map((k) => [k, getPref(k)]));
  try { for (const [k, v] of Object.entries(prefs)) setPref(k, v); return fn(); } finally { for (const [k, v] of Object.entries(kept)) setPref(k, v); }
}
const ALL_ON = { skin: 'enhanced', enhancedEnvironments: true, enhancedLighting: true };
const listed = (search, prefs = ALL_ON, renderer = {}) => withPrefs(prefs, () => mountPrograms(renderer, search).map(keyOf));

test('SHADER-EASE MOUNT-START: the mount list names exactly what the outdoor passes\' constructors build, the first body\'s shadow last - each key its constructor\'s own (mutants: a pass\'s pair drifted; a pass left out; the far ring off its lane)', () => {
  const builds = passBuilds(EL_LANE);
  for (const [pass, keys] of Object.entries(builds)) assert.ok(keys.length > 0, `${pass} built a program`);
  const want = [...new Set(Object.values(builds).flat())];
  assert.deepEqual(listed('?sky=enhanced'), want, 'in the hosts\' order, each once (the sand is the wisps\' own program)');
  const classic = passBuilds(null);
  const classicList = listed('?sky=enhanced', { ...ALL_ON, enhancedLighting: false });
  for (const pass of ['ring', 'trees']) {
    assert.notDeepEqual(classic[pass], builds[pass], `${pass}: the lane changes its source`);
    for (const k of classic[pass]) assert.ok(classicList.includes(k), `${pass}: the classic page lists the classic source`);
  }
  for (const k of builds.bodies) assert.ok(!classicList.includes(k), 'no lane, no shadow pass, no bodies');
});

test('SHADER-EASE MOUNT-START: each pass is listed by its host\'s own switch - the ring, the woods, the sky\'s lane, the mod\'s sky, the skin (mutants: each switch ignored)', () => {
  const builds = passBuilds(EL_LANE);
  const has = (list, pass) => builds[pass].every((k) => list.includes(k));
  const lacks = (list, pass) => builds[pass].every((k) => !list.includes(k));
  const ringOff = listed('?sky=enhanced&ring=off');
  assert.ok(lacks(ringOff, 'ring') && lacks(ringOff, 'trees') && has(ringOff, 'sky'), '?ring=off: no ring, no band');
  for (const door of ['fartrees=off', 'farflora=off']) {
    const l = listed(`?sky=enhanced&${door}`);
    assert.ok(has(l, 'ring') && lacks(l, 'trees'), `?${door}: the ring without its band`);
  }
  const classicSky = listed('?sky=classic');
  assert.ok(has(classicSky, 'sky') && has(classicSky, 'ring'), 'the panorama and the ring stand');
  for (const pass of ['enhancedSky', 'wisps', 'haze', 'windfall', 'bolts']) assert.ok(lacks(classicSky, pass), `?sky=classic: no ${pass}`);
  const noEnvironments = listed('?sky=enhanced', { ...ALL_ON, enhancedEnvironments: false });
  assert.ok(lacks(noEnvironments, 'wisps') && lacks(noEnvironments, 'enhancedSky'), 'the environments switch off: the sky\'s lane is off');
  const dynamic = listed('?sky=dynamic');
  assert.ok(lacks(dynamic, 'enhancedSky') && has(dynamic, 'wisps'), 'the mod\'s sky: no dome, the lane\'s passes stand');
  const noLighting = listed('?sky=enhanced', { ...ALL_ON, enhancedLighting: false });
  assert.ok(has(noLighting, 'wisps') && has(noLighting, 'haze'), 'the wisps ride the sky\'s lane, not the lighting lane');
  const classicSkin = listed('?sky=enhanced', { ...ALL_ON, skin: 'classic' });
  for (const pass of ['ring', 'trees', 'enhancedSky', 'wisps', 'curtains']) assert.ok(lacks(classicSkin, pass), `classic skin: no ${pass}`);
  const classicLane = passBuilds(null);   // the classic skin has no lighting lane: the ring's and the band's classic sources
  for (const pass of ['ring', 'trees']) assert.ok(classicLane[pass].every((k) => !classicSkin.includes(k)), `classic skin: no ${pass}, either source`);
  for (const pass of ['sky', 'duelWall', 'banner', 'flag', 'spoils', 'marks']) assert.ok(has(classicSkin, pass), `classic skin: ${pass} stands (every skin)`);
});

test('SHADER-EASE MOUNT-START: the fixed city lists the sky and the marks, never the world host\'s own passes; ?world beside it is the world host (mutants: the city lists the world\'s passes; ?world ignored)', () => {
  const builds = passBuilds(EL_LANE);
  const has = (list, pass) => builds[pass].every((k) => list.includes(k));
  const lacks = (list, pass) => builds[pass].every((k) => !list.includes(k));
  for (const door of ['exterior', 'region', 'loc']) {
    const city = listed(`?${door}&sky=enhanced`);
    for (const pass of ['ring', 'trees', 'duelWall', 'banner', 'flag', 'curtains', 'spoils']) assert.ok(lacks(city, pass), `?${door}: no ${pass}`);
    for (const pass of ['sky', 'wisps', 'marks']) assert.ok(has(city, pass), `?${door}: ${pass} stands`);
    const world = listed(`?world&${door}&sky=enhanced`);
    for (const pass of ['ring', 'duelWall', 'spoils']) assert.ok(has(world, pass), `?world&${door}: the world host's ${pass}`);
  }
});

test('SHADER-EASE MOUNT-START: an indoor door lists none of the mount\'s passes, and the bodies are not listed once built (mutants: an indoor door lists; a built body listed again)', () => {
  for (const search of ['?interior', '?dungeon', '?dungeon&world']) assert.deepEqual(listed(search), [], search);
  const rec = recordingGl();
  const r = withPrefs(ALL_ON, () => new Renderer(rec.canvas));
  r.setLightingLane(EL_LANE);
  const before = listed('?sky=enhanced', ALL_ON, r);
  r._shadowPass._ensureBodyPrograms();
  assert.equal(listed('?sky=enhanced', ALL_ON, r).length, before.length - 3, 'the three body programs, built, are not started again');
});

test('SHADER-EASE MOUNT-START: the shadow pass\'s depth programs are on the lane\'s list, and the boot hands over its blocking builds before the clouds\' door (mutants: the depth programs left out; the clouds first again)', () => {
  const rec = recordingGl();
  const r = new Renderer(rec.canvas);
  const lane = laneBootPrograms(r, EL_LANE).map(keyOf);
  const depth = shadowDepthPrograms(SHADOW_PASS_VS).map(keyOf);
  assert.equal(depth.length, 7);
  for (const k of depth) assert.ok(lane.includes(k), 'listed with the lane');
  const boot = withPrefs(ALL_ON, () => bootPrograms(r, '?sky=enhanced')).map(keyOf);
  const clouds = [...CLOUD_PROGRAMS, ...CLOUD_NOISE_PROGRAMS].map(keyOf);
  assert.deepEqual(boot.slice(-clouds.length), clouds, 'the clouds last: their door waits for its compile');
  assert.deepEqual(boot.slice(0, lane.length), lane, 'the lane\'s builds first');
});

test('SHADER-EASE MOUNT-START: the mount set is queued after the boot\'s batch, one at a time, and a constructor takes its started program (mutants: the mount set never started; all at once)', async () => {
  const rec = recordingGl();
  const r = withPrefs(ALL_ON, () => new Renderer(rec.canvas));
  let at = -1;
  const constructorLinks = rec.linked.length;
  const mounted = new Promise((res) => {
    assert.equal(withPrefs(ALL_ON, () => startBootPrograms(r, '?sky=enhanced', async () => { at = rec.linked.length; res(undefined); })), true);
  });
  const batch = withPrefs(ALL_ON, () => bootPrograms(r, '?sky=enhanced')).length;
  await mounted;
  assert.equal(at, constructorLinks + batch, 'the mount set\'s start called once the whole batch was handed over');
  let done = false;
  const rec2 = recordingGl({ complete: () => done });
  const r2 = new Renderer(rec2.canvas);
  const constructed = rec2.linked.length;
  const turns = [];
  const queue = withPrefs(ALL_ON, () => startMountPrograms(r2, '?sky=enhanced', () => new Promise((res) => turns.push(res))));
  const list = withPrefs(ALL_ON, () => mountPrograms(r2, '?sky=enhanced'));
  assert.ok(list.length > 10);
  assert.equal(rec2.linked.length - constructed, 1, 'one started, the rest queued');
  done = true;
  while (turns.length) { turns.shift()(); await new Promise((res) => setImmediate(res)); }
  await queue;
  assert.equal(rec2.linked.length - constructed, list.length, 'each started once');
  const sky = rec2.built(() => new SkyRenderer(rec2.gl));
  assert.equal(rec2.linked.length - constructed, list.length, 'the sky took its started program, no compile of its own');
  assert.equal(sky.length, 1);
});

test('SHADER-EASE MOUNT-START: the mount set waits for the batch ahead of the clouds, asking without a link, gives up waiting after its turns, and an indoor door starts none (mutants: no wait; the wait relinks; no cap; indoors mounts)', async () => {
  let done = false;
  const rec = recordingGl({ complete: () => done });
  const r = withPrefs(ALL_ON, () => new Renderer(rec.canvas));
  const turns = [];
  let mounts = 0;
  withPrefs(ALL_ON, () => startBootPrograms(r, '?sky=enhanced', async () => { mounts++; }, () => new Promise((res) => turns.push(res))));
  withPrefs(ALL_ON, () => r.setLightingLane(EL_LANE));   // the lane's build takes its started programs
  const linked = rec.linked.length;
  for (let i = 0; i < 5; i++) { await new Promise((res) => setImmediate(res)); turns.shift()?.(); }
  assert.equal(mounts, 0, 'not while the batch compiles');
  assert.equal(mountSettled(), false, 'the menu\'s bar is told the mount set is still to come');
  assert.equal(rec.linked.length, linked, 'asking links nothing');
  done = true;
  for (let i = 0; i < 3 && !mounts; i++) { turns.shift()?.(); await new Promise((res) => setImmediate(res)); }
  assert.equal(mounts, 1, 'started once the batch is done');
  await new Promise((res) => setImmediate(res));
  assert.equal(mountSettled(), true);
  const stuck = recordingGl({ complete: () => false });
  const r2 = withPrefs(ALL_ON, () => new Renderer(stuck.canvas));
  let asked = 0, stuckMounts = 0;
  withPrefs(ALL_ON, () => startBootPrograms(r2, '?sky=enhanced', async () => { stuckMounts++; }, async () => { asked++; }));
  for (let i = 0; i < MOUNT_WAIT_TURNS + 5 && !stuckMounts; i++) await new Promise((res) => setImmediate(res));
  assert.equal(stuckMounts, 1, 'a driver that never says done still gets the mount set');
  assert.equal(asked, MOUNT_WAIT_TURNS);
  const inside = recordingGl();
  const r3 = new Renderer(inside.canvas);
  let indoorMounts = 0;
  startBootPrograms(r3, '?dungeon', async () => { indoorMounts++; }, async () => {});
  for (let i = 0; i < 5; i++) await new Promise((res) => setImmediate(res));
  assert.equal(indoorMounts, 0, 'an indoor door mounts no outdoor pass');
  assert.equal(mountSettled(), true, 'and none is to come');
});

test('SHADER-EASE MOUNT-START: a pass the host built before the queue came is never started again (mutant: the queue relinks it)', async () => {
  const rec = recordingGl();
  const r = new Renderer(rec.canvas);
  const sky = rec.built(() => new SkyRenderer(rec.gl));   // the host mounted first: built cold
  const before = rec.linked.length;
  const list = withPrefs(ALL_ON, () => mountPrograms(r, '?sky=enhanced'));
  await withPrefs(ALL_ON, () => startMountPrograms(r, '?sky=enhanced', async () => {}));
  assert.equal(rec.linked.length - before, list.length - sky.length, 'each but the built sky started once');
});

test('SHADER-EASE QUEUE-ORDER: the play queue holds the nodes\' glow and the sea fight\'s effects, as their builds compile them, and ends with the auras\' and the armory\'s (mutants: the glow left out; the long ones first again; a pair drifted)', () => {
  const rec = recordingGl();
  const glow = rec.built(() => new NodeGlowRenderer(rec.gl));
  const naval = rec.built(() => new NavalRenderer({ gl: rec.gl })._ensure());
  assert.deepEqual(glow, NODE_GLOW_PROGRAMS.map(keyOf));
  assert.deepEqual(naval, NAVAL_PROGRAMS.map(keyOf));
  const play = playPrograms().map(keyOf);
  for (const k of [...glow, ...naval]) assert.ok(play.includes(k), 'queued');
  const tail = [...AURA_PROGRAMS, ...ARMORY_PROGRAMS, ...AURORA_PROGRAMS].map(keyOf);   // PIN MOVED (AUDIT SKYRIM-AURORA B5): the aurora's after them
  assert.deepEqual(play.slice(-tail.length), tail, 'the auras and the armory last, the aurora after them');
});
