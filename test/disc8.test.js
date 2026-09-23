// DISC8 (2026-09-23, Discord through Mac) - the second round of field
// reports, 01-Overview/Field-Bugs-2026-09-23.md. Pinned by execution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerMotor } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { applyFallLanding } from '../src/scenes/shared.js';
import * as PE from '../src/characters/playerEntity.js';
import { reviveForPlay } from '../src/systems/deathRespawn.js';
import { createAutomapSheet } from '../src/ui/automapSheet.js';
import * as cam from '../src/ui/automapCamera.js';
import * as m4 from '../src/world/mat4.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const STILL = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };

test('DISC8-G: a fatal fall is billed ONCE - the death screen and the respawn box hold the motor, and a held frame reports no landing, so the respawned player lives (Discord: "When I die from fall damage ... I spawn in the air, and fall down and die"; mutant: the held frame keeps the report)', () => {
  const col = new Collider(() => 100);
  col.addMesh('g', new Float32Array([-200, 100, -200, 200, 100, -200, 200, 100, 200, -200, 100, 200]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
  const player = new PlayerMotor(col);
  const entity = PE.playerEntity;
  const saved = { maxHealth: entity.maxHealth, health: entity.health, activeEffects: entity.activeEffects };
  entity.maxHealth = 100; entity.health = 100; entity.activeEffects = [];
  let overlay = null, deaths = 0, respawns = 0, bills = 0, teleport = null;
  const prevAvoid = PE.setAvoidDeathHook(() => false);
  const prevPresenter = PE.setDeathPresenter(() => {
    if (overlay?.kind === 'death') return;
    deaths++;
    overlay = { kind: 'death', t: 0, tick(dt) { this.t += dt; if (this.t > 3 && !this.fired) { this.fired = true; respawns++; reviveForPlay(entity, { force: true }); teleport = 20; } } };
  });
  try {
    player.spawn(0, 140, 0);   // a 40-unit drop, fatal at 100 HP
    const dt = 1 / 60;
    for (let f = 0; f < 60 * 30; f++) {
      overlay?.tick(dt); if (overlay?.done) overlay = null;
      if (teleport != null && --teleport <= 0) {   // the respawn lands on the ground and a text box pauses the game
        teleport = null; player.spawn(0, 100.01, 0);
        if (!(entity.health > 0)) reviveForPlay(entity);
        overlay = { kind: 'box', t: 0, tick(dt2) { this.t += dt2; if (this.t > 1.5) this.done = true; } };
      }
      // world.js's frame order: the held motor steps nothing and reports nothing; the reader is not gated
      if (overlay) player.holdFrame(); else player.update(dt, STILL, 0, 0);
      applyFallLanding(entity, player.landedFallDistance, { sound: () => { bills++; } });
    }
    assert.equal(bills, 1, 'the fall is billed once');
    assert.equal(deaths, 1, 'one death');
    assert.equal(respawns, 1, 'one respawn');
    assert.equal(entity.health, 50, 'the respawned player lives at half health');
  } finally {
    PE.setDeathPresenter(prevPresenter); PE.setAvoidDeathHook(prevAvoid);
    Object.assign(entity, saved);
  }
});

test('DISC8-G by source: every host that holds its motor clears the report on the held frame; a teleport or load clears it too', () => {
  const m = rd('src/player/motor.js');
  assert.match(m, /holdFrame\(\) \{\n\s*this\.jumped = false;\n\s*this\.landedFallDistance = 0;\n\s*\}/);
  assert.match(m, /this\._heightReset\(\);[^\n]*\n\s*this\.holdFrame\(\);[^\n]*\n\s*\}/, 'spawn clears the report');
  assert.match(rd('src/scenes/world.js'), /if \(_overlayHeld \|\| _seasonHeld\) player\.holdFrame\(\);[^\n]*\n\s*if \(!_overlayHeld && !_seasonHeld\) player\.update\(/);
  assert.match(rd('src/scenes/exterior.js'), /if \(_overlayHeld\) player\.holdFrame\(\);[^\n]*\n\s*if \(!_overlayHeld\) player\.update\(/);
});

test('DISC8-D: the Use Magic Item window closes the way DFU\'s Update does - the U key or Escape (the touch X, the pad Back) arms on the press and closes on the release, using nothing; the release of the press that opened it closes nothing (Discord: "I also get stuck on the use magic item window"; mutants: no keyup; the opening release closes)', async () => {
  const { createUseMagicItemWindow } = await import('../src/ui/useMagicItemWindow.js');
  const { TEMPLATES } = await import('../src/systems/useItem.js');
  const potion = { name: 'Potion', group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle };   // IsPotion (:352-355)
  const mk = () => {
    const log = { used: 0, closed: 0 };
    const win = createUseMagicItemWindow({ items: [potion], isEnchanted: () => false, onUse: () => log.used++, onClose: () => log.closed++ });
    return { win, log };
  };
  let { win, log } = mk();
  assert.ok(win, 'a potion opens the window');
  assert.equal(win.backdrop, 'none', ':33 Color.clear');
  win.keyup('KeyU');
  assert.ok(!win.done, 'the opening press\'s release closes nothing');
  win.input('KeyU'); assert.ok(!win.done, 'the press arms');
  win.keyup('KeyU');
  assert.ok(win.done && log.closed === 1 && log.used === 0, 'U closes it, using nothing');
  for (const [down, up] of [['Escape', 'Escape'], ['back', 'back']]) {
    ({ win, log } = mk());
    win.input(down); assert.ok(!win.done);
    win.keyup(up);
    assert.ok(win.done && log.closed === 1 && log.used === 0, `${down} closes it, using nothing`);
  }
  ({ win, log } = mk());
  win.input('KeyE'); win.keyup('KeyE');
  assert.ok(!win.done, 'another key does not close it');
});

const dmRow = (key, y, x0, z0, x1, z1) => ({ key, aabb: { min: [x0, y, z0], max: [x1, y, z1] },
  positions: new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]), matrix: null });
const dmRows = [dmRow('S', 0, 100, 200, 110, 210), dmRow('C', 0, 102, 210, 108, 230), dmRow('N', 0, 100, 230, 110, 240)];
const dmRec = () => ({ revealed: new Set(['S', 'C', 'N']), visitedThisRun: new Set(['S']), entranceDiscovered: false, notes: new Map(), teleporters: new Map() });
const recCtx = () => { const calls = []; return { calls, ctx: new Proxy({}, { get: (_, k) => (k === 'calls' ? calls : k === 'measureText' ? (t) => ({ width: t.length * 6 }) : (...a) => calls.push({ fn: k, args: a })), set: () => true }) }; };
test('DISC8-C: the dungeon sheet lays north UP the paper - walking north moves the caret the way the caret points, as the classic top view does, and the walked wash lands under its own walls (Discord: "The arrow is pointing in the right direction but when I go south on the map I go north"; mutants: the plan\'s y with +Z; the wash left in world units)', () => {
  let feet = [105, 0, 205];
  const s = createAutomapSheet({ record: dmRec, model: () => ({ rows: dmRows }), player: () => ({ feet, yaw: 0 }) });
  const view = { ox: 0, oy: 0, scale: 4 };
  const env = { model: s.ensure(), view, paperW: 400, paperH: 300, dpr: 1, pulse: 0 };
  const at = () => { const { ctx, calls } = recCtx(); s.paintOverlay(ctx, env); const m = calls.filter((c) => c.fn === 'moveTo'); return m[m.length - 1].args; };
  const south = at(); feet = [105, 0, 235]; const north = at();
  // the classic top view, through the same mirror the world pass wears
  let c = cam.resetCameraTransformViewFromTop(cam.createAutomapCamera([0, 1, 0]), [0, 1, 0]);
  const pv = m4.multiply(m4.mirrorProjectionX(m4.perspective(0.26, 1, 0.3, 1000)), m4.lookAt(c.pos, c.pos.map((v, i) => v + c.fwd[i]), c.up));
  const ndcY = (p) => (pv[1] * p[0] + pv[5] * p[1] + pv[9] * p[2] + pv[13]) / (pv[3] * p[0] + pv[7] * p[1] + pv[11] * p[2] + pv[15]);
  assert.ok(ndcY([0, 0, 5]) > ndcY([0, 0, 0]), 'classic: +Z is up the panel');
  assert.ok(north[1] < south[1], 'enhanced: walking north moves the caret UP the paper, like the classic map and the caret heading');
  // and the wash lands inside the wall it was cut with
  const { ctx, calls } = recCtx(); s.paintStatic(ctx, env);
  const r = calls.filter((c) => c.fn === 'rect').map((c) => c.args);
  const ys = r.flatMap(([, y, , h]) => [y, y + h]);
  // room S (z 200..210) is the SOUTH end: the bottom of the plan
  const planH = s.size().height;
  assert.ok(Math.max(...ys) <= planH * view.scale + 1e-6 && Math.min(...ys) >= (planH - 12) * view.scale - 1e-6, 'the walked south room is washed at the bottom of the plan');
});

// DISC8-B fixtures: a pool floor at y -3 and a way out of it, the water's surface at -0.3
const quad = (a, b, c, d) => ({ positions: new Float32Array([...a, ...b, ...c, ...d]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });
function pool(way) {
  const col = new Collider(() => -100);
  const add = (key, q) => col.addMesh(key, q.positions, q.indices, IDENTITY);
  add('floor', quad([-10, -3, -10], [10, -3, -10], [10, -3, 20], [-10, -3, 20]));
  if (way === 'stairs') {
    for (let i = 0; i < 10; i++) {   // ten 0.3 risers on 0.6 treads from z 2
      const zf = 2 + i * 0.6, yb = -3 + i * 0.3, yt = yb + 0.3;
      add('stairs', quad([-2, yb, zf], [2, yb, zf], [2, yt, zf], [-2, yt, zf]));
      add('stairs', quad([-2, yt, zf], [2, yt, zf], [2, yt, zf + 0.6], [-2, yt, zf + 0.6]));
    }
    add('stairs', quad([-2, 0, 8], [2, 0, 8], [2, 0, 14], [-2, 0, 14]));
  } else {   // a ramp rising 3 over `way` (6: 26.6 degrees; 3: 45)
    add('ramp', quad([-2, -3, 2], [2, -3, 2], [2, 0, 2 + way], [-2, 0, 2 + way]));
    add('ramp', quad([-2, 0, 2 + way], [2, 0, 2 + way], [2, 0, 8 + way], [-2, 0, 8 + way]));
  }
  return col;
}
/** Swim forward from the pool floor for `secs`; the swim toggle is the dungeon host's (dungeon.js). */
function swimOut(col, kg, secs) {
  const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 }, { carriedWeight: () => kg });
  m.spawn(0, -3, 0);
  const trace = [];
  for (let f = 0; f < 60 * secs; f++) {
    m.waterSurfaceY = -0.3;
    m.isPlayerSwimming = m.swimming = m.pos[1] + m.height / 2 + 50 * 0.025 - 0.95 < -0.3;
    m.update(1 / 60, { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false }, 0, 0);
    trace.push([m.pos[1], m.pos[2]]);
  }
  return trace;
}

test('DISC8-B: a swimmer too heavy to float climbs the pool\'s stairs and swims up a slope as fast as a light one - the collider\'s down pass stops at the ground (PhysX CCT\'s maxIterDown 1) instead of turning the over-encumbered sink into a shove back off the step or down the slope (Discord: "If there are stairs and you weigh too heavy to swim then you cant get out and slopes are super slow"; mutant: the down pass resolves by the normal)', () => {
  const out = swimOut(pool('stairs'), 80, 6);   // 80 kg x 4 > 250: LevitateMotor's sink (:81-84)
  assert.ok(out.some(([y, z]) => y > -1e-3 && z > 8), `the heavy swimmer reaches the landing: last ${out.at(-1)}`);
  const at = (t, tr) => tr[Math.round(t * 60) - 1];
  const heavy = swimOut(pool(6), 80, 3), light = swimOut(pool(6), 0, 3);
  assert.ok(Math.abs(at(3, heavy)[1] - at(3, light)[1]) < 1e-3, `26.6 degrees: the heavy swimmer keeps pace (${at(3, heavy)[1]} vs ${at(3, light)[1]})`);
  const steep = swimOut(pool(3), 80, 3);
  assert.ok(at(3, steep)[1] - at(1.5, steep)[1] > 0.5, `45 degrees: no dead stop (${at(1.5, steep)[1]} -> ${at(3, steep)[1]})`);
});

test('DISC9: indoors you hear the rain the street heard - the sim\'s word says rain, the front has not brought a drop to the player yet (a cloudy day to the street\'s ear), and Better Ambience\'s tavern rain stays silent; once it falls outside it falls inside; a load (a jump) lands under the sim\'s sky whole (Mac: "now it\'s not raining outside and you can hear it raining inside"; mutants: the mod reads the sim\'s word; the heard word outlives a jump)', async () => {
  const W = await import('../src/systems/weatherSim.js');
  const { createWeatherFront, soundWeather } = await import('../src/systems/weatherFront.js');
  const { createBetterAmbience, readBetterAmbienceSettings, BETTER_AMBIENCE_VENDOR } = await import('../src/systems/betterAmbience.js');
  const { MOD_SETTINGS } = await import('../src/systems/modSettings.js');
  W.resetWeatherSim();
  try {
    const store = Object.fromEntries(Object.entries(MOD_SETTINGS[BETTER_AMBIENCE_VENDOR].keys).map(([k, d]) => [k, d.default]));
    const loops = [];
    const audio = {
      registerSound: async () => true, playOneShot: () => {}, setReverb: () => true,
      loop: (k) => { const l = { k, stopped: false, stop() { this.stopped = true; } }; loops.push(l); return l; },
      loop3d: () => null,
    };
    // the mod as shipped: NO weather dep - its default is the ear's word
    const ba = createBetterAmbience({ audio, settings: () => readBetterAmbienceSettings(() => store), random: () => 0, fetchClip: async () => new Uint8Array([1]), snowFree: () => false });
    const entity = { items: [], activeEffects: [], maxHealth: 100 };
    const m = (o) => ({ entity, inside: false, inBuilding: false, inDungeon: false, grounded: true, standingStill: true, isRunning: false, movingLessThanHalfSpeed: true, levitating: false, swimming: false, motorSwimming: false, pos: [0, 0, 0], centreY: 0.9, waterSurfaceY: null, onExteriorWater: false, onExteriorWaterAny: false, onExteriorPath: false, onStaticGeometry: false, onFoot: true, winter: false, climateIndex: 231, loadInProgress: false, ...o });
    ba.frame(0, m({})); await ba.settle();
    // the street: the sim turns to rain, the cloud has not arrived - nothing falls, the street hears a cloudy day
    W.setWeather('rain');
    const front = createWeatherFront({ seed: 7 });
    let fx = null;
    for (let i = 0; i < 60; i++) { fx = front.tick({ dt: 1 / 60, weather: W.currentWeather(), arrival: 0, nowMinutes: 1000, tsec: i / 60, jump: false }); W.setHeardWeather(soundWeather(fx, W.currentWeather())); }
    assert.equal(W.currentWeather(), 'rain', 'the sim says rain');
    assert.notEqual(W.heardWeather(), 'rain', 'the street hears no rain - nothing is falling');
    // into the tavern
    ba.onTransition({ dungeon: null, building: true }); ba.settleTransition(); ba.frame(0.016, m({ inside: true, inBuilding: true }));
    assert.equal(loops.filter((l) => !l.stopped).length, 0, 'no rain in the tavern when none fell in the street');
    // back out, the shower arrives and falls; back in, the tavern hears it through the walls
    ba.onTransition({ dungeon: null, building: false }); ba.settleTransition(); ba.frame(0.016, m({}));
    for (let i = 0; i < 60 * 20; i++) { fx = front.tick({ dt: 1 / 60, weather: 'rain', arrival: 1, nowMinutes: 1000, tsec: 1 + i / 60, jump: false }); W.setHeardWeather(soundWeather(fx, 'rain')); }
    assert.equal(W.heardWeather(), 'rain', 'the rain is falling in the street');
    ba.onTransition({ dungeon: null, building: true }); ba.settleTransition(); ba.frame(0.016, m({ inside: true, inBuilding: true }));
    assert.equal(loops.filter((l) => !l.stopped).length, 1, 'and now the tavern hears it');
    // a load lands the player under the saved sky, whole: the word heard before it no longer stands
    W.setHeardWeather('cloudy');
    W.restoreWeather('sunny');
    assert.equal(W.heardWeather(), 'sunny', 'after a jump the ear takes the sim\'s word');
  } finally { W.resetWeatherSim(); }
});

test('DISC9 by source: both open-world hosts write the heard word where the street computes it, and read it indoors', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(f);
    assert.match(s, /ambientWord = enhancedFront \? soundWeather\(fx, weather\) : weather;\n\s*setHeardWeather\(ambientWord, enhancedFront \? fx\.intensity : 1\);/, f);
    assert.match(s, /ambience\.setPreset\(presetForExterior\(heardWeather\(\), isNight\(minuteNow\(\)\)\)\);/, f);
  }
  assert.match(rd('src/systems/betterAmbience.js'), /weather = heardWeather, rainLevel = heardRainGain, snowFree/);
});
