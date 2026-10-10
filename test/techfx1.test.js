// TECH-FX (bible/05-Combat/Weapon-Techniques.md THE FEEL; 2026-10-10, the owner: "lets do code driven design for each
// technique, like real detail and ensure performance remains in tact"): WHAT A TECHNIQUE FEELS LIKE. The table read as
// the peaks the player sees, the springs settling to exact rest at any frame rate, the comfort setting, each moment
// cued on the real runner in the rig's own frame order - a swing's hit on the machine's own hit frame, each Volley
// arrow where and when its line meets the ground - the climb's view step folding the camera's channel in first person
// only, the rig's dip of the classic layer put back however it leaves, the impact engine's thirteen recipes under its
// own caps, the four hosts' doors, and the frame's allocation measured, at rest and with every spring in flight. The
// motor's feet are a Float32Array (player/motor.js `pos`), and every runner test here hands it one.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setPref, _resetForTests, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { setUiSkin } from '../src/systems/uiSkin.js';
import { SOUND } from '../src/systems/soundClips.js';
import { MISSILE_SPEED } from '../src/systems/spellcast.js';
import * as LR from '../src/systems/lootRarity.js';
import * as T from '../src/combat/techniques.js';
import * as FX from '../src/combat/techniqueFx.js';
import { TECHNIQUES } from '../src/combat/techniqueRoster.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { setSigilDueling } from '../src/systems/sigil.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { createClimbFeelHost } from '../src/player/climbFeel.js';
import { SpellImpactFx, TECH_FX_LOOK, TECH_FX_RECIPES, FX_MAX_PARTS } from '../src/render/spellImpactFx.js';
import { CATEGORIES } from '../src/ui/settingsMap.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
/** A file's text with its comments out - a pin on code reads code. */
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
/** The argument bag of a host's createWeaponRig call (test/tech1_hosts.test.js's). */
const rigBag = (src, open) => { const i = src.indexOf(open); assert.ok(i >= 0, open); let d = 0, j = src.indexOf('({', i) + 1; const s = j; for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (d === 0) break; } } return src.slice(s, j + 1); };

const DEG = Math.PI / 180;
const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const stats = () => ({ strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = (o = {}) => ({ isPlayer: true, level: 8, items: [], stats: stats(), skills: new Array(35).fill(50), fatigue: 6400, health: 100, maxHealth: 100, equip: { slots: [] }, career: {}, activeEffects: [], ...o });
const foeAt = (x, z) => ({ entity: { ...player({ isPlayer: false }), health: 100, maxHealth: 100 }, ai: { feet: [x, 0, z], height: 1.8, yaw: 0 } });
const piece = (make, id, value = 20) => {
  const it = LR.applyRarity(make(), 'rare', lcg(7));
  it.isIdentified = true;
  LR.addTechniqueLine(it, () => 0.5, { id });
  LR.techniqueLineOf(it).value = value;
  return it;
};
const arrows = (n) => ({ ...createWeapon(ARROW_TEMPLATE, 0), stackCount: n });
/** The ground at height `y0`, rising `grade` metres a metre along +z - a look's ray, a fall's cast and the terrain's
 *  height, all three the one plane. */
const ground = (y0 = 0, grade = 0) => {
  const hitAt = (o, d, max) => { const den = d[1] - grade * d[2]; if (!(den < 0)) return Infinity; const t = (y0 + grade * o[2] - o[1]) / den; return t >= 0 && t <= max ? t : Infinity; };
  return {
    raycast: hitAt,
    surfaceHit: (o, d, max) => { const t = hitAt(o, d, max); return Number.isFinite(t) ? { dist: t, normal: [0, 1, -grade] } : null; },
    heightAt: (x, z) => y0 + grade * z,
  };
};
/** The motor's feet: a Float32Array, as player/motor.js keeps them - moved IN PLACE as the body moves. */
const feet = (x, y, z) => new Float32Array([x, y, z]);
const weaponOf = (it) => { const pw = new PlayerWeapon({ weapon: it, liveSpeed: 50 }); pw.sheathed = false; pw.update(0); return pw; };
/** The host's technique door with THE FEEL's three ends logged in the order they came (and the TECH1 door's own). */
function feelDoor(extra = {}) {
  const log = [];
  const door = {
    fx: (recipe, at, o) => log.push({ k: 'fx', recipe, at: [...at], o: { ...o, ...(o?.to ? { to: [...o.to] } : {}) } }),
    shake: (n) => log.push({ k: 'shake', n }),
    sound: (clip, volume, pitch) => log.push({ k: 'sound', clip, volume, pitch }),
    ...extra,
  };
  return { log, door, bursts: () => log.filter((e) => e.k === 'fx').map((e) => e.recipe), shakes: () => log.filter((e) => e.k === 'shake').map((e) => e.n), sounds: () => log.filter((e) => e.k === 'sound') };
}
/** A rig over a fake host, stepped in THE RIG'S OWN ORDER (combat/weaponRig.js frame): the runner, then the machine,
 *  then the frame's events handed back (claimShot) - `frame(held)` answers that frame's events. */
function rig({ pw, entity, door, cam = { pos: [0, 1.7, 0], yaw: 0, pitch: -0.2, feet: feet(0, 0, 0) }, collider = ground() }) {
  const started = [];
  const ctx = (held) => ({
    rig, entity, pw, cam, collider, held, ready: true, cancel: false,
    startSwing: (s) => { if (!pw.techniqueStrike(s)) return false; started.push(s); return true; },
    door, say: () => {}, noteShot: () => {},
  });
  const frame = (held = false, dt = 1 / 60) => { T.stepTechnique(dt, ctx(held)); return T.claimShot(pw.update(dt), ctx(held)); };
  return { started, ctx, cam, frame };
}
const reset = () => { _resetForTests(); setPref('lootRarity', true); setUiSkin('enhanced'); setPref('soundEnhancements', true); T._resetTechniquesForTests(); setSigilDueling(false); setPlayerDoor(null); };
/** Every channel's furthest reach from rest over `s` seconds at `hz` (signed: the larger magnitude), and when. */
function peaks(s = 1.5, hz = 240) {
  const v = FX.techniqueView(), h = FX.techniqueHands();
  const out = { pitch: 0, roll: 0, eye: 0, fov: 0, y: 0 }, when = { pitch: 0, roll: 0, eye: 0, fov: 0, y: 0 };
  const take = (k, x, t) => { if (Math.abs(x) > Math.abs(out[k])) { out[k] = x; when[k] = t; } };
  for (let i = 1; i <= s * hz; i++) {
    FX.stepTechniqueFx(1 / hz);
    take('pitch', v.pitch, i / hz); take('roll', v.roll, i / hz); take('eye', v.eye[1], i / hz); take('fov', v.fov, i / hz); take('y', h.y, i / hz);
  }
  out.when = when;
  return out;
}
const near = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel + 1e-12, `${msg}: ${a} against ${b}`);

// ── the table ─────────────────────────────────────────────────────

test('TECHFX1 THE TABLE: every technique of the roster has its moments - a swing\'s and a leap\'s and a dash\'s release and hit, a Piercing Shot\'s release and loose, a Volley\'s release, loose, shaft and close; every burst one the impact engine draws, every sound a clip of the game\'s own table, every number a channel\'s; the hands only ever dip, a roll never past 3 degrees, a bow\'s loose no sound of its own; every row frozen through (mutants: a moment dropped; a recipe unknown; a sound misnamed; a hand lifted)', () => {
  assert.deepEqual(Object.keys(FX.TECH_FX).sort(), Object.keys(TECHNIQUES).sort(), 'one row a technique, none extra');
  const want = { swing: ['hit', 'release'], leap: ['hit', 'release'], dash: ['hit', 'release'], pierce: ['loose', 'release'], rain: ['close', 'loose', 'release', 'shaft'] };
  for (const [id, t] of Object.entries(TECHNIQUES)) {
    assert.deepEqual(Object.keys(FX.TECH_FX[id]).sort(), want[t.mech], `${id} (${t.mech}): its moments`);
    for (const [moment, row] of Object.entries(FX.TECH_FX[id])) {
      const where = `${id}.${moment}`;
      assert.ok(row.cam || row.hands || row.shake || row.burst || row.sound, `${where}: does something`);
      for (const k of Object.keys(row)) assert.ok(['cam', 'hands', 'shake', 'burst', 'r', 'sound'].includes(k), `${where}: ${k}`);
      for (const [k, v] of Object.entries(row.cam ?? {})) { assert.ok(['pitch', 'roll', 'eye', 'fov'].includes(k), `${where}: cam ${k}`); assert.ok(Number.isFinite(v) && v !== 0); }
      if (row.cam?.roll != null) assert.ok(Math.abs(row.cam.roll) <= 3, `${where}: a roll the level sky can stand (${row.cam.roll})`);
      if (row.hands) { assert.deepEqual(Object.keys(row.hands), ['y'], `${where}: the hands only dip`); assert.ok(row.hands.y > 0 && row.hands.y <= 0.15, `${where}: down, and a dip the screen holds`); }
      if (row.shake != null) assert.ok(row.shake > 0 && row.shake <= 4, `${where}: shake`);
      if (row.burst != null) assert.ok(TECH_FX_RECIPES.includes(row.burst), `${where}: ${row.burst} a recipe`);
      if (row.r != null) assert.ok(row.burst && row.r > 0, `${where}: a radius for a burst`);
      if (row.sound != null) {
        const [name, volume, pitch] = row.sound;
        assert.equal(typeof SOUND[name], 'number', `${where}: ${name} in SOUND`);
        assert.ok(volume > 0 && volume <= 1 && pitch >= 0.5 && pitch <= 1.5, `${where}: volume ${volume}, pitch ${pitch}`);
      }
      for (const part of [row, row.cam, row.hands, row.sound]) if (part) assert.ok(Object.isFrozen(part), `${where}: frozen through`);
    }
  }
  assert.equal(FX.TECH_FX.volley.loose.sound, undefined, 'the host\'s bowSound is the loose\'s - a second ArrowShoot only doubled it');
  assert.equal(FX.TECH_FX.pierce.loose.sound, undefined, '...and a Thunderlock\'s loose is its own shot');
  // a ring's radius is the technique's own reach, so the burst draws the blow's true size
  assert.equal(FX.TECH_FX.slam.hit.r, TECHNIQUES.slam.reach);
  assert.equal(FX.TECH_FX.whirlwind.hit.r, TECHNIQUES.whirlwind.reach);
  assert.equal(FX.TECH_FX.cleave.hit.r, TECHNIQUES.cleave.reach);
  assert.equal(FX.TECH_FX.leap.hit.r, TECHNIQUES.leap.radius);
  assert.equal(FX.TECH_FX.kick.hit.r, TECHNIQUES.kick.radius);
  assert.deepEqual(FX.FX_CH, { pitch: 0, roll: 1, eye: 2, fov: 3, hands: 4 });
});

// ── the springs ───────────────────────────────────────────────────

test('TECHFX1 THE SPRINGS: a moment\'s numbers ARE the peaks the screen reaches - every row of the table, every channel, to 1%, each at its own stiffness\'s time (1/k); then each settles to EXACTLY rest from a sub-pixel, and the step stops; the same curve at 30, 60 and 144 frames a second; a roll kicked into the camera\'s own frame, mirrored (mutants: the kick\'s e; a stiffness; the closed form\'s sign; the rest snap coarsened)', () => {
  reset();
  for (const [id, rows] of Object.entries(FX.TECH_FX)) {
    for (const [moment, row] of Object.entries(rows)) {
      FX.resetTechniqueFx();
      assert.equal(FX.techniqueCue(id, moment), true);
      const p = peaks();
      const c = row.cam ?? {};
      const want = { pitch: (c.pitch ?? 0) * DEG, roll: -(c.roll ?? 0) * DEG, eye: c.eye ?? 0, fov: c.fov ?? 0, y: row.hands?.y ?? 0 };
      for (const k of Object.keys(want)) near(p[k], want[k], 0.01, `${id}.${moment} ${k}`);
      const K = { pitch: FX.FX_K[0], roll: FX.FX_K[1], eye: FX.FX_K[2], fov: FX.FX_K[3], y: FX.FX_K[4] };
      for (const k of Object.keys(want)) if (want[k]) assert.ok(Math.abs(p.when[k] - 1 / K[k]) <= 1 / 240 + 1e-9, `${id}.${moment} ${k} peaks at 1/k (${p.when[k]} against ${1 / K[k]})`);
    }
  }
  assert.deepEqual([...FX.FX_K], [17, 11, 14, 9, 15]);
  // the slam lands: the look DOWN (pitch up positive), the eye down, the hands down
  FX.resetTechniqueFx();
  FX.techniqueCue('slam', 'hit');
  FX.stepTechniqueFx(1 / 60); FX.stepTechniqueFx(1 / 60);
  assert.ok(FX.techniqueView().pitch < 0 && FX.techniqueView().eye[1] < 0 && FX.techniqueHands().y > 0);
  // settled: exact rest from below a pixel, and the step does nothing after
  const v = FX.techniqueView(), h = FX.techniqueHands();
  let frames = 0, lastY = 0, lastPitch = 0;
  while (FX.techniqueFxLive() && frames < 600) { lastY = h.y; lastPitch = v.pitch; FX.stepTechniqueFx(1 / 60); frames++; }
  assert.equal(FX.techniqueFxLive(), false, 'at rest');
  assert.ok(frames < 180, `settled in ${frames} frames`);
  assert.ok(Math.abs(lastY) * 2160 < 0.05 && Math.abs(lastPitch) < 1e-4, `the snap is below a pixel: ${lastY} screen heights, ${lastPitch} rad`);
  assert.deepEqual([v.pitch, v.roll, v.eye[0], v.eye[1], v.eye[2], v.fov, h.y], [0, 0, 0, 0, 0, 0, 0], 'every channel exactly 0');
  // any frame rate, the one curve
  const at = (hz, s) => { FX.resetTechniqueFx(); FX.techniqueCue('slam', 'hit'); FX.techniqueCue('whirlwind', 'release'); for (let i = 0; i < Math.round(s * hz); i++) FX.stepTechniqueFx(1 / hz); return [v.pitch, v.roll, v.eye[1], v.fov, h.y]; };
  const a = at(30, 1 / 3), b = at(60, 1 / 3), d = at(144, 1 / 3);
  for (let i = 0; i < a.length; i++) { near(b[i], a[i], 1e-9, `60 against 30 (${i})`); near(d[i], a[i], 1e-9, `144 against 30 (${i})`); }
  // a frame of nothing is nothing; a kick on a kick adds
  const before = [...at(60, 0.1)];
  FX.stepTechniqueFx(0); FX.stepTechniqueFx(NaN); FX.stepTechniqueFx(-1);
  assert.deepEqual([v.pitch, v.roll, v.eye[1], v.fov, h.y], before);
  FX.resetTechniqueFx();
  FX.techniqueCue('crush', 'hit'); FX.techniqueCue('crush', 'hit');
  near(peaks().pitch, -4.4 * DEG, 0.01, 'two blows, twice the dip');
  assert.equal(FX.techniqueCue('crush', 'loose'), false, 'no such moment');
  assert.equal(FX.techniqueCue('nothing', 'hit'), false, 'no such technique');
});

test('TECHFX1 COMFORT: "Technique camera motion" (techniqueMotion, 100% by default) scales the camera\'s springs, the shake and the hands\' dip - at Off nothing on the screen moves; the burst and the sound are never scaled, and the sound follows Sound Enhancements and the skin (mutants: the motion unread; the motion unclamped; the shake unscaled; the burst scaled; the sound ungated)', () => {
  reset();
  assert.equal(PREF_DEFAULTS.techniqueMotion, 1);
  assert.equal(FX.techniqueMotion(), 1);
  for (const [v, want] of [[0.5, 0.5], [0, 0], [2, 1], [-1, 0], ['x', 1]]) { setPref('techniqueMotion', v); assert.equal(FX.techniqueMotion(), want, `${v}`); }
  const place = { at: [0, 0, 0], ground: 0, yaw: 0 };
  const run = (m) => {
    setPref('techniqueMotion', m);
    FX.resetTechniqueFx();
    const d = feelDoor();
    FX.techniqueCue('slam', 'hit', d.door, place);
    return { d, p: peaks() };
  };
  const full = run(1), half = run(0.5), off = run(0);
  assert.deepEqual(full.d.shakes(), [3.2]);
  assert.deepEqual(half.d.shakes(), [1.6]);
  assert.deepEqual(off.d.shakes(), [], 'Off: no shake');
  near(half.p.pitch, full.p.pitch / 2, 1e-9, 'half: half the dip of the look');
  near(half.p.y, full.p.y / 2, 1e-9, 'half: half the hands\' dip');
  assert.deepEqual([off.p.pitch, off.p.roll, off.p.eye, off.p.fov, off.p.y], [0, 0, 0, 0, 0], 'Off: nothing moves');
  for (const r of [full, half, off]) {
    assert.deepEqual(r.d.bursts(), ['shock'], 'the burst whatever the motion');
    assert.equal(r.d.log.find((e) => e.k === 'fx').o.r, 3.5);
    assert.deepEqual(r.d.sounds().map((s) => [s.clip, s.volume, s.pitch]), [[SOUND.FallHard, 1, 0.7]], 'the sound whatever the motion');
  }
  setPref('techniqueMotion', 1);
  setPref('soundEnhancements', false);
  const quiet = feelDoor(); FX.techniqueCue('slam', 'hit', quiet.door, place);
  assert.deepEqual(quiet.sounds(), [], 'Sound Enhancements off: no layer');
  setPref('soundEnhancements', true); setUiSkin('classic');
  const classic = feelDoor(); FX.techniqueCue('slam', 'hit', classic.door, place);
  assert.deepEqual(classic.sounds(), [], 'the classic skin plays what DFU plays');
  setUiSkin('enhanced');
  // no place: no burst; no door: the springs alone, nothing thrown
  const bare = feelDoor(); FX.techniqueCue('slam', 'hit', bare.door, null);
  assert.deepEqual(bare.bursts(), []);
  FX.resetTechniqueFx();
  assert.doesNotThrow(() => FX.techniqueCue('volley', 'close', null, { at: [0, 0, 0] }));
  assert.ok(FX.techniqueCue('volley', 'shaft', {}, { at: [0, 0, 0] }), 'a door with no ends');
});

// ── the moments on the real runner ────────────────────────────────

test('TECHFX1 THE SWING\'S MOMENTS: in the rig\'s own frame order, a Whirlwind\'s press is its release (the lean into the spin, the whoosh) and its hit is ON the machine\'s own hit frame - once - with the sweep at the motor\'s feet (a Float32Array) to its 3 m, spun the way a StrikeLeft carries the blade, and the hands\' dip; Ground Slam\'s shock and thud on raised ground, Skull Crack\'s star, Headsman\'s Chop\'s and the Haymaker\'s in front at the blow\'s height (mutants: the release uncued; the hit at the press; the hit twice; the hit never; the hit off the machine; a burst off the feet; the spin; the chop and the punch at the feet)', () => {
  reset();
  const fd = feelDoor();
  const pw = weaponOf(piece(() => createWeapon(120, 1), 'whirlwind'));
  const r = rig({ pw, entity: player(), door: fd.door, cam: { pos: [2, 1.7, 3], yaw: 0.4, pitch: 0, feet: feet(2, 0, 3) } });
  r.frame(true);
  assert.deepEqual(r.started, ['StrikeLeft']);
  assert.deepEqual(fd.sounds().map((s) => [s.clip, s.volume, s.pitch]), [[SOUND.SwingMediumPitch, 1, 0.75]], 'the release\'s whoosh');
  assert.deepEqual(fd.bursts(), [], 'nothing in the world at the press');
  FX.stepTechniqueFx(1 / 60);
  assert.ok(FX.techniqueView().roll > 0, 'leaning left on the screen - the camera\'s own roll, positive, under the hosts\' mirrored lens (techfx1_audit)');
  let iHit = -1, iCue = -1;
  for (let i = 0; i < 240 && T.techniqueState().act; i++) {
    const n = fd.bursts().length;
    const evs = r.frame(false);
    if (iHit < 0 && evs.includes('hit')) iHit = i;
    if (iCue < 0 && fd.bursts().length > n) iCue = i;
  }
  assert.ok(iHit > 3, `the machine's hit (${iHit})`);
  assert.equal(iCue, iHit, 'the moment ON the machine\'s hit frame - the frame\'s own event, not a clock of its own');
  const sweep = fd.log.find((e) => e.k === 'fx');
  assert.equal(sweep.recipe, 'sweep');
  assert.deepEqual(sweep.at, [2, 0, 3], 'at the feet');
  assert.deepEqual([sweep.o.r, sweep.o.spin, sweep.o.ground, sweep.o.yaw], [3, 1, 0, 0.4], 'its 3 m, spun as a StrikeLeft carries the blade (to the left)');
  assert.deepEqual(fd.shakes(), [0.9]);
  assert.equal(fd.bursts().length, 1, 'once');
  FX.resetTechniqueFx(); FX.techniqueCue('whirlwind', 'hit'); FX.stepTechniqueFx(1 / 60);
  assert.ok(FX.techniqueHands().y > 0, 'the hands dip on the hit');
  // the others: on ground 5 m up, so a burst's floor is the feet's own
  const cases = [
    ['slam', () => createWeapon(124, 1), 'shock', [SOUND.FallHard, 1, 0.7], 3.2, 'feet'],
    ['crush', () => createWeapon(124, 1), 'star', null, 1.6, 'front'],
    ['execute', () => createWeapon(127, 1), 'chop', null, 2, 'front'],
    ['haymaker', null, 'punch', null, 1.4, 'front'],
  ];
  for (const [id, make, recipe, sound, shake, where] of cases) {
    reset();
    const d = feelDoor();
    const me = player();
    if (id === 'haymaker') me.equip.slots[EQUIP_SLOTS.Gloves] = piece(() => mintCondition(setItemFields({ group: 'Armor', templateIndex: 103, material: 0x0201 })), 'haymaker');   // bare-handed: the Gauntlets' (tech1_runner's)
    const w = weaponOf(id === 'haymaker' ? null : piece(make, id));
    const rr = rig({ pw: w, entity: me, door: d.door, cam: { pos: [0, 6.7, 0], yaw: Math.PI / 2, pitch: 0, feet: feet(0, 5, 0) } });
    rr.frame(true);
    assert.equal(rr.started.length, 1, id);
    for (let i = 0; i < 240 && T.techniqueState().act; i++) rr.frame(false);
    assert.deepEqual(d.bursts(), [recipe], id);
    assert.deepEqual(d.shakes(), [shake], id);
    const b = d.log.find((e) => e.k === 'fx');
    assert.equal(b.o.ground, 5, `${id}: the feet's floor`);
    if (where === 'front') {
      assert.ok(Math.abs(b.at[0] - 1.2) < 1e-6 && Math.abs(b.at[1] - 6.1) < 1e-6 && Math.abs(b.at[2]) < 1e-6, `${id}: in front at the blow's height: ${b.at}`);
      assert.ok(Math.abs(b.o.dir[0] + 1) < 1e-9, `${id}: facing the one who struck`);
    } else { assert.deepEqual(b.at, [0, 5, 0], `${id}: at the feet`); assert.equal(b.o.r, 3.5); }
    if (sound) assert.deepEqual([d.sounds().at(-1).clip, d.sounds().at(-1).volume, d.sounds().at(-1).pitch], sound, id);
  }
});

test('TECHFX1 THE LEAP\'S AND THE DASH\'S MOMENTS: a Leap Strike leaves the ground (the field widens, the whoosh) and its hit is the landing - the ring at its 2.5 m where the body came down, the thud, the heavy shake; a Lunge\'s hit lays its trail from where it began to where it struck, the motor\'s own feet moving in place (mutants: the leap\'s release uncued; the landing\'s ring off the feet; the trail\'s start forgotten; the start aliased to the moving feet)', () => {
  reset();
  const target = foeAt(0, 7);
  setPlayerDoor({ foes: () => [target] });
  const fd = feelDoor({ motor: () => ({ grounded: true, techniqueLaunch() { this.grounded = false; return true; } }) });
  const pw = weaponOf(piece(() => createWeapon(120, 1), 'leap'));
  const body = feet(0, 0, 0);
  const r = rig({ pw, entity: player(), door: fd.door, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: -0.02, feet: body } });
  r.frame(true);
  r.frame(false);
  assert.equal(T.techniqueState().act, 'flight');
  assert.deepEqual(fd.sounds().map((s) => s.clip), [SOUND.SwingLowPitch], 'the leap\'s whoosh');
  FX.stepTechniqueFx(1 / 30);
  assert.ok(FX.techniqueView().fov > 0, 'the field widens as you leave');
  body[2] = 6;   // the body comes down before the foe - the motor's own array, moved in place
  for (let i = 0; i < 240 && T.techniqueState().act; i++) r.frame(false);
  assert.deepEqual(r.started, ['StrikeDown']);
  const land = fd.log.find((e) => e.k === 'fx');
  assert.equal(land.recipe, 'land');
  assert.deepEqual(land.at, [0, 0, 6], 'where the body landed');
  assert.equal(land.o.r, 2.5);
  assert.deepEqual(fd.shakes(), [2.6]);
  assert.deepEqual(fd.sounds().map((s) => s.clip), [SOUND.SwingLowPitch, SOUND.FallHard], 'and the thud');
  // the Lunge: its trail from the start of the run to the feet at the strike
  reset();
  const ld = feelDoor({ motor: () => ({ grounded: true, techniqueLaunch() { this.grounded = false; return true; } }) });
  const lpw = weaponOf(piece(() => createWeapon(116, 1), 'lunge', 10));
  const run = feet(1, 0, 1);
  const lr = rig({ pw: lpw, entity: player(), door: ld.door, cam: { pos: [1, 1.7, 1], yaw: Math.PI / 2, pitch: 0, feet: run } });
  lr.frame(true);
  lr.frame(false);
  run[0] = 6;   // the dash carries the same feet along
  for (let i = 0; i < 240 && T.techniqueState().act; i++) lr.frame(false);
  assert.equal(lr.started.length, 1);
  const trail = ld.log.find((e) => e.k === 'fx');
  assert.equal(trail.recipe, 'trail');
  assert.deepEqual(trail.at, [1, 0, 1], 'from where the run began - its own copy, not the feet that moved on');
  assert.deepEqual(trail.o.to, [6, 0, 1], 'to where it struck');
});

test('TECHFX1 THE SHOTS\' MOMENTS: a bow\'s release kicks its springs; a Piercing Shot\'s loose kicks the look up, shakes, flares at the bow (0.9 m down the look, a hand below the eye) and lays a tracer down the look AT THE LOOSE to the first thing it meets; a Volley\'s loose flares, each of its arrows puffs where its own line meets the ground and when (its loose plus its flight at the cast engine\'s speed, in order, after its own arrow is loosed), and the circle closes over the disc with the last - once; neither adds a sound to the bow\'s own (mutants: the shot\'s release uncued; the tracer\'s lane the aim\'s; the flare at the feet; a landing off its line; the landings at the loose; the close twice)', () => {
  reset();
  const me = player(); me.items.push(arrows(3));
  const pw = weaponOf(piece(() => createWeapon(129, 1), 'pierce', 10));
  const fired = [];
  const fd = feelDoor({ fireArrow: (from, dir, o) => fired.push({ from, dir, o }) });
  const wall = { raycast: (o, d, max) => { if (!(d[2] > 1e-9)) return Infinity; const t = (4 - o[2]) / d[2]; return t >= 0 && t <= max ? t : Infinity; }, surfaceHit: () => null, heightAt: () => NaN };
  const cam = { pos: [0, 1.7, 0], yaw: Math.PI / 2, pitch: -0.2, feet: feet(0, 0, 0) };   // aimed into the open (+x)
  const r = rig({ pw, entity: me, door: fd.door, cam, collider: wall });
  r.frame(true);
  r.frame(false);
  FX.stepTechniqueFx(1 / 60);
  assert.ok(FX.techniqueView().fov < 0, 'the draw\'s own kick: the field narrows as the string comes back');
  assert.deepEqual(fd.bursts(), [], 'the draw: no burst yet');
  cam.yaw = 0;   // turned on the wall before the string goes
  for (let i = 0; i < 120 && !fired.length; i++) r.frame(false);
  assert.equal(fired.length, 1);
  const tr = fd.log.find((e) => e.k === 'fx');
  assert.equal(tr.recipe, 'tracer');
  const look = [0, Math.sin(-0.2), Math.cos(-0.2)];
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(tr.o.dir[k] - look[k]) < 1e-9, 'down the look the shaft flies');
  assert.ok(Math.abs(tr.o.len - 4 / Math.cos(0.2)) < 1e-6, `to the wall it meets at the loose: ${tr.o.len}`);
  const at = [look[0] * 0.9, 1.7 + look[1] * 0.9 - 0.15, look[2] * 0.9];
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(tr.at[k] - at[k]) < 1e-6, `the flare at the bow: ${tr.at}`);
  assert.deepEqual(fd.shakes(), [0.8]);
  assert.deepEqual(fd.sounds(), [], 'the bow\'s own twang is the loose\'s');
  // the Volley, on a slope: 0.25 m up for every metre ahead
  reset();
  const v = player(); v.items.push(arrows(10));
  const bow = weaponOf(piece(() => createWeapon(130, 1), 'volley', 20));
  const log = [];
  let now = 0;
  const vd = feelDoor({ fireArrow: (from, dir) => log.push({ t: now, from: [...from], dir: [...dir] }) });
  const slope = ground(0, 0.25);
  const vr = rig({ pw: bow, entity: v, door: vd.door, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: 0.05, feet: feet(0, 0, 0) }, collider: slope });
  vr.frame(true);
  const aim = T.techniqueState().aim.point;
  assert.ok(aim && Math.abs(aim[1] - 0.25 * aim[2]) < 0.05, `the disc on the slope: ${aim}`);
  vr.frame(false);
  FX.stepTechniqueFx(1 / 60);
  assert.ok(FX.techniqueView().pitch > 0 && FX.techniqueHands().y > 0, 'the release\'s kick: the look lifts as the bow comes up, the hands take its weight');
  for (let i = 0; i < 120 && !vd.bursts().length; i++) { now += 1 / 60; const k = vd.log.length; vr.frame(false); for (const ev of vd.log.slice(k)) ev.t = now; }
  assert.deepEqual(vd.bursts(), ['flare'], 'the loose\'s flare');
  assert.deepEqual(vd.sounds(), [], 'no second ArrowShoot over the bow\'s');
  const n0 = vd.log.length;
  for (let i = 0; i < 300 && T.techniqueState().act; i++) {
    now += 1 / 60;
    const k = vd.log.length;
    vr.frame(false);
    for (const ev of vd.log.slice(k)) ev.t = now;
  }
  const shafts = vd.log.slice(n0).filter((x) => x.k === 'fx' && x.recipe === 'shaft');
  assert.equal(log.length, 6);
  assert.equal(shafts.length, 6, 'a puff an arrow');
  for (const f of log) {
    // where this arrow's line meets the slope (solve from[1] + dir[1] s = 0.25 (from[2] + dir[2] s))
    const s = (0.25 * f.from[2] - f.from[1]) / (f.dir[1] - 0.25 * f.dir[2]);
    const p = [f.from[0] + f.dir[0] * s, f.from[1] + f.dir[1] * s, f.from[2] + f.dir[2] * s];
    const mine = shafts.find((x) => Math.hypot(x.at[0] - p[0], x.at[2] - p[2]) < 0.05);
    assert.ok(mine, `a puff where the arrow from ${f.from.map((x) => x.toFixed(2))} meets the slope (${p.map((x) => x.toFixed(2))})`);
    assert.ok(Math.abs(mine.at[1] - p[1]) < 0.05 && Math.abs(mine.o.ground - mine.at[1]) < 1e-9, `on the ground under it: ${mine.at[1]} against ${p[1]}`);
    const due = f.t + s / MISSILE_SPEED;
    assert.ok(mine.t >= f.t && Math.abs(mine.t - due) <= 1 / 60 + 1e-6, `when it lands: ${mine.t.toFixed(3)}, due ${due.toFixed(3)}`);
  }
  for (let i = 1; i < shafts.length; i++) assert.ok(shafts[i].t >= shafts[i - 1].t, 'in order');
  const close = vd.log.filter((x) => x.k === 'fx' && x.recipe === 'close');
  assert.equal(close.length, 1, 'the circle closes once');
  assert.deepEqual(close[0].at, [...aim], 'over the disc');
  assert.equal(close[0].o.r, TECHNIQUES.volley.radius);
  assert.ok(vd.log.indexOf(close[0]) > vd.log.indexOf(shafts.at(-1)), 'with the last arrow');
  assert.deepEqual(vd.shakes(), [0.5]);
});

test('TECHFX1 A LOAD: no spring of the moment before a load or a teleport still moves the view after it - the climb host\'s reset (the hosts\' load and teleport) clears them at once, and the runner\'s own load check after (mutants: the load\'s reset of the feel dropped; the climb host\'s reset without it)', () => {
  reset();
  const me = player();
  const pw = weaponOf(piece(() => createWeapon(120, 1), 'whirlwind'));
  const r = rig({ pw, entity: me, door: null });
  r.frame(false);
  FX.techniqueCue('slam', 'hit');
  FX.stepTechniqueFx(1 / 60);
  r.frame(false);
  assert.equal(FX.techniqueFxLive(), true, 'no load: it moves on');
  assert.notEqual(restorePlayer(me, snapshotPlayer(me)), null, 'a load lands');
  r.frame(false);
  assert.equal(FX.techniqueFxLive(), false);
  assert.deepEqual([FX.techniqueView().pitch, FX.techniqueView().eye[1], FX.techniqueHands().y], [0, 0, 0]);
  // the host's own reset - its load and teleport call it before the frame draws
  FX.techniqueCue('slam', 'hit'); FX.stepTechniqueFx(1 / 60);
  const host = createClimbFeelHost(() => ({ climbEvents: [], climbMove: null, pos: [0, 0, 0], onWall: false }), { yaw: 0, pitch: 0, pos: [0, 0, 0] }, null);
  host.reset();
  assert.equal(FX.techniqueFxLive(), false, 'the host\'s reset rests the feel too');
  assert.deepEqual([FX.techniqueView().pitch, FX.techniqueHands().y], [0, 0]);
});

// ── the camera's channel, the hands' dip ──────────────────────────

test('TECHFX1 THE CAMERA\'S CHANNEL: the climb\'s view step folds the technique\'s pitch, roll and eye into the view FIRST PERSON ONLY (the look dips with a slam: the forward\'s height is the pitch\'s sine), its field-of-view kick is every lens\'s, the sky takes its pitch; the springs step with every frame - a held one too, so a window or the death screen never keeps a blow\'s tilt - while the climb\'s own feel stands under the hold; at rest the view is the matrix it was (mutants: the view unapplied; first person ignored; the lens unadded; the sky\'s pitch dropped; held with the body)', () => {
  reset();
  const motor = { climbEvents: [], climbMove: null, pos: [0, 0, 0], onWall: false };
  const host = createClimbFeelHost(() => motor, { yaw: 0, pitch: 0, pos: [0, 0, 0] }, null);
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  host.frame(1 / 60);
  const rest = new Float32Array(I);
  host.view(rest, true);
  assert.deepEqual([...rest], I, 'at rest: untouched');
  assert.equal(host.fovRad(), 0);
  assert.equal(host.pitch(), 0);
  FX.techniqueCue('slam', 'hit');
  for (let i = 0; i < 3; i++) host.frame(1 / 60);
  const tv = FX.techniqueView();
  assert.ok(tv.pitch < 0 && tv.eye[1] < 0 && tv.fov < 0, 'the springs stepped with the body\'s frame');
  const fp = host.view(new Float32Array(I), true);
  assert.ok(Math.abs(-fp[6] - Math.sin(tv.pitch)) < 1e-6, `the look dips: forward's height ${-fp[6]}, the pitch's sine ${Math.sin(tv.pitch)}`);
  assert.ok(-fp[6] < 0, 'down');
  assert.ok(Math.abs(fp[13]) > 1e-4, 'the eye moved');
  assert.ok(Math.abs(host.pitch() - tv.pitch) < 1e-12, 'the sky takes the pitch the view took');
  assert.ok(Math.abs(host.fovRad() - tv.fov * DEG) < 1e-12, 'the lens takes the kick');
  const third = new Float32Array(I);
  host.view(third, false);
  assert.deepEqual([...third], I, 'third person: never the camera\'s channel');
  assert.equal(host.pitch(), 0, 'nor the sky\'s pitch');
  assert.ok(Math.abs(host.fovRad() - tv.fov * DEG) < 1e-12, 'the lens\'s kick any view, as the climb\'s');
  // a held frame: the climb's feel stands, the technique's springs settle
  const climbFx = JSON.stringify(host.fx), p0 = tv.pitch;
  host.frame(1 / 60, true);
  assert.equal(JSON.stringify(host.fx), climbFx, 'the climb\'s own feel stands under a held frame');
  assert.notEqual(tv.pitch, p0, 'the technique\'s springs step on');
  for (let i = 0; i < 240; i++) host.frame(1 / 60, true);
  assert.equal(FX.techniqueFxLive(), false, 'and come to rest under the hold');
  host.reset();
  assert.equal(host.tech, null);
  // the host's source: the step first, the fold after the climb's
  const src = code('src/player/climbFeel.js');
  assert.match(src, /frame\(dt, held = false\) \{\s*stepTechniqueFx\(dt\);\s*const m = player\(\);\s*if \(!m \|\| held\) return;/);
  assert.match(src, /if \(this\.applied\) applyClimbView\(view, this\.applied\);\s*this\.tech = firstPerson \? techniqueView\(\) : null;\s*if \(this\.tech\) applyClimbView\(view, this\.tech\);\s*return view;/);
});

test('TECHFX1 THE HANDS\' DIP: the rig lowers its classic layer by the spring through the renderer\'s screen offset (screen heights of its own canvas, down only), over whatever offset stood, and puts it back however the layer leaves; at rest it touches nothing; the Morrowind arm takes the dip through its own screen transform instead (mutants: the dip dropped; the offset not restored; the dip off the canvas\'s width; the arm on the renderer\'s offset)', () => {
  reset();
  const calls = [];
  const renderer = { _o: [3, 4], get screenOffset() { return this._o; }, setScreenOffset(x, y) { calls.push([x, y]); this._o = [x, y]; } };
  const audio = { playOneShot() {} };
  const rg = createWeaponRig({ renderer, canvas: { width: 1000, height: 800, clientWidth: 1000, clientHeight: 800 }, fetchBytes: () => { throw new Error('no art in tests'); }, palette: null, audio, entity: { items: [] }, say: () => {} });
  rg.draw();
  assert.deepEqual(calls, [], 'at rest: the offset untouched');
  FX.techniqueCue('slam', 'hit');
  FX.stepTechniqueFx(1 / 30);
  const dy = FX.techniqueHands().y;
  assert.ok(dy > 0);
  rg.draw();
  assert.equal(calls.length, 2, 'set and put back');
  assert.ok(calls[0][0] === 3 && Math.abs(calls[0][1] - (4 + dy * 800)) < 1e-9, `dipped, never across: ${calls[0]}`);
  assert.deepEqual(calls[1], [3, 4], 'and back');
  assert.deepEqual(renderer.screenOffset, [3, 4]);
  // the source: the arm through its transform, the classic lane through the offset, restored in a finally
  const src = code('src/combat/weaponRig.js');
  assert.match(src, /function drawInner\(o\) \{\s*const dy = techniqueHands\(\)\.y;\s*if \(!\(dy > 0\)\) return drawLayer\(o\);\s*if \(fpArm\.active\(\)\) \{ _armDip = dy; try \{ return drawLayer\(o\); \} finally \{ _armDip = 0; \} \}/);
  assert.match(src, /_dipPx = dy \* \(cv\(\)\?\.height \?\? 0\);\s*renderer\.setScreenOffset\(ox, oy \+ _dipPx\);\s*try \{ return drawLayer\(o\); \} finally \{ renderer\.setScreenOffset\(ox, oy\); _dipPx = 0; \}/);
  assert.match(src, /if \(_armDip > 0\) \{ const armsBase = fpArm\.screenTransform\(\); fpArm\.setScreenTransform\(\(base\) => techniqueDipRect\(armsBase \? armsBase\(base\) : base, _armDip, base\.h\)\); \}/);
  assert.match(src, /try \{ return onUiScreen\(renderer, cv\(\), \(\) => drawInner\(\{ paralyzed \}\)\); \} finally \{/);
});

// ── the world's burst ─────────────────────────────────────────────

test('TECHFX1 THE BURSTS: each of the thirteen recipes draws in the technique\'s blue and its stone-dust - its own count of sparks (Ground Slam\'s 39 the most), a ring or two, one light at most - from Arrays or typed arrays alike, every number finite, and all of it gone in five seconds; a thousand slams stay under the engine\'s caps; a ring\'s reach clamped; an arc its own half-angle; a lost facing faces ahead; a bad place, an unknown recipe, a trail with no length draw nothing (mutants: a recipe dropped; a count raised; a cap ignored; the reach unclamped; the guard; the typed array refused)', () => {
  assert.deepEqual([...TECH_FX_LOOK.energy.main], [...T.TECH_COLOR], 'the marks\' and the chip\'s blue');
  const o = { ground: 0, yaw: 0.3, r: 3, dir: [0, 0, 1], len: 12, to: [1, 0, 7], spin: -1 };
  const COUNTS = { shock: 39, land: 25, sweep: 24, arc: 21, star: 14, chop: 14, punch: 12, vanish: 15, trail: 14, tracer: 11, flare: 7, shaft: 5, close: 0 };
  assert.deepEqual(Object.keys(COUNTS).sort(), [...TECH_FX_RECIPES].sort());
  for (const recipe of TECH_FX_RECIPES) {
    for (const typed of [false, true]) {
      const fx = new SpellImpactFx({ rng: lcg(3) });
      const at = typed ? new Float32Array([1, 0.5, 2]) : [1, 0.5, 2];
      const oo = typed ? { ...o, dir: new Float32Array(o.dir), to: new Float32Array(o.to) } : o;
      assert.equal(fx.technique(recipe, at, oo), true, `${recipe}${typed ? ' (typed)' : ''}`);
      assert.equal(fx.parts.length, COUNTS[recipe], `${recipe}: its sparks`);
      assert.ok(fx.decals.length <= 3 && fx.lights.length <= 1, `${recipe}: ${fx.decals.length} rings, ${fx.lights.length} lights`);
      assert.ok(fx.parts.length + fx.decals.length > 0, `${recipe}: draws`);
      for (const p of fx.parts) {
        assert.ok(p.look === TECH_FX_LOOK.energy || p.look === TECH_FX_LOOK.stone, `${recipe}: its looks`);
        assert.ok([...p.p, ...p.v, p.life, p.w].every(Number.isFinite), `${recipe}: finite`);
      }
      for (const d of fx.decals) assert.ok([...d.at, d.r0, d.r1, d.life].every(Number.isFinite) && d.look === TECH_FX_LOOK.energy, recipe);
      for (let i = 0; i < 100; i++) fx.step(0.05);
      assert.equal(fx.live, false, `${recipe}: gone in five seconds`);
    }
  }
  const many = new SpellImpactFx({ rng: lcg(5) });
  for (let i = 0; i < 1000; i++) many.technique('shock', [1, 0.5, 2], o);
  assert.ok(many.parts.length <= FX_MAX_PARTS && many.decals.length <= 161 && many.lights.length <= 8, `${many.parts.length}, ${many.decals.length}, ${many.lights.length}`);
  const wide = new SpellImpactFx({ rng: lcg(4) });
  wide.technique('shock', [0, 0, 0], { r: 60 });
  assert.ok(Math.max(...wide.decals.map((d) => d.r1)) <= 6, 'a ring\'s reach clamped to the engine\'s 6 m');
  const narrow = new SpellImpactFx({ rng: lcg(4) });
  narrow.technique('arc', [0, 0, 0], { yaw: 0, r: 3, half: 0.4 });
  for (const p of narrow.parts.filter((q) => q.look === TECH_FX_LOOK.energy && q.age < 0 || q.age === 0)) {
    const ang = Math.atan2(p.p[0], p.p[2]);
    if (Math.hypot(p.p[0], p.p[2]) > 0.5) assert.ok(Math.abs(ang) <= 0.4 + 1e-9, `the arc's own half-angle: ${ang}`);
  }
  const lost = new SpellImpactFx({ rng: lcg(4) });
  assert.equal(lost.technique('arc', [0, 0, 0], { yaw: NaN }), true);
  assert.ok(lost.parts.every((p) => [...p.p, ...p.v].every(Number.isFinite)), 'a lost facing faces ahead, never NaN');
  const fx = new SpellImpactFx({ rng: lcg(9) });
  assert.equal(fx.technique('nothing', [1, 0.5, 2], o), false);
  assert.equal(fx.technique('shock', [NaN, 0, 0], o), false);
  assert.equal(fx.technique('shock', null, o), false);
  assert.equal(fx.technique('trail', [1, 0.5, 2], { ...o, to: null }), false);
  assert.equal(fx.technique('trail', [1, 0.5, 2], { ...o, to: [1.1, 0, 2.1] }), false, 'a trail too short to see');
  assert.equal(fx.live, false, 'none of them drew');
  // the sweep turns the way its spin says: +1 carries the sparks in front to the left (the right axis is [cos, 0, -sin])
  for (const [spin, sign] of [[1, -1], [-1, 1]]) {
    const sw = new SpellImpactFx({ rng: lcg(2) });
    sw.technique('sweep', [0, 0, 0], { r: 3, spin, yaw: 0.6 });
    const ahead = sw.parts.filter((p) => (p.p[0] * Math.sin(0.6) + p.p[2] * Math.cos(0.6)) > 1.5);
    assert.ok(ahead.length > 0);
    for (const p of ahead) assert.ok(Math.sign(p.v[0] * Math.cos(0.6) - p.v[2] * Math.sin(0.6)) === sign, `spin ${spin}: the spark ahead moves ${sign < 0 ? 'left' : 'right'}`);
  }
});

// ── the hosts, the setting ────────────────────────────────────────

test('TECHFX1 THE FOUR HOSTS\' DOORS: each hands its rig the burst (its cast engine\'s impact pass), the shake (the one shaker - the dungeon\'s its outer host\'s) and the sound (its audio bus); the cast engine draws a technique\'s burst in the pass it already draws (mutants: a host\'s end dropped; another shaker; the pass)', () => {
  const hosts = {
    'src/scenes/exterior.js': { open: 'const weaponRig = createWeaponRig({', fx: 'magic.techniqueFx?.', shake: 'shake: (k) => betterAmbience.weaponKick(k),' },
    'src/scenes/world.js': { open: 'const weaponRig = createWeaponRig({', fx: 'magic.techniqueFx?.', shake: 'shake: (k) => betterAmbience.weaponKick(k),' },
    'src/scenes/worldModes.js': { open: 'const interiorWeapon = createWeaponRig({', fx: 'magic?.techniqueFx?.', shake: 'shake: (k) => betterAmbience.weaponKick(k),' },
    'src/scenes/dungeonContext.js': { open: 'const weaponRig = createWeaponRig({', fx: 'magic.techniqueFx?.', shake: 'shake: (k) => opts.shakeCamera?.(k),' },
  };
  for (const [file, h] of Object.entries(hosts)) {
    const bag = rigBag(code(file), h.open);
    const door = bag.slice(bag.indexOf('technique: {'));
    assert.ok(door.includes(`fx: (recipe, at, o) => ${h.fx}(recipe, at, o),`), `${file}: the burst`);
    assert.ok(door.includes(h.shake), `${file}: the shake`);
    assert.ok(door.includes('sound: (clip, volume, pitch) => audio.playOneShot(clip, volume, pitch),'), `${file}: the sound`);
  }
  assert.match(code('src/scenes/dungeon.js'), /shakeCamera: \(k\) => betterAmbience\.weaponKick\(k\),/, 'the dungeon\'s shaker is its host\'s');
  const magic = code('src/scenes/hostMagic.js');
  assert.match(magic, /techniqueFx: \(recipe, at, o\) => fx\.technique\(recipe, at, o\),/);
  assert.match(magic, /if \(!fx\.live \|\| fxBroken/, 'one pass, drawn while anything lives');
});

test('TECHFX1 THE SETTING: "Technique camera motion" is a port row under Game (Full, 75%, Half, Low, Off), found by its key, and Settings > Accessibility > Motion lists it after the recoil\'s strength (mutants: the row unbuilt; unmapped; the default off)', () => {
  const menu = code('src/ui/enhancedMenu.js');
  assert.match(menu, /return \[row, techniqueMotionRow\(\)\];/);
  assert.match(menu, /choiceRow\('techniqueMotion', 'Technique camera motion',[^;]*\[\[1, 'Full'\], \[0\.75, '75%'\], \[0\.5, 'Half'\], \[0\.25, 'Low'\], \[0, 'Off'\]\]\);/);
  assert.match(menu, /row\.dataset\.opt = 'techniqueMotion';/);
  const motion = CATEGORIES.find((c) => c.id === 'accessibility').sections.find((s) => s.id === 'motion').items;
  assert.equal(motion[motion.indexOf('Controls/CameraRecoilStrength') + 1], 'port:techniqueMotion');
});

// ── the frame's allocation ────────────────────────────────────────

test('TECHFX1 THE FRAME MAKES NOTHING (L2 F9\'s measure, in a child with a 64 MB young space, the least of six windows): at rest - the springs\' step, the view fold, the lens, the sky\'s pitch, the hands, the marks (the hosts\' own call, and the exported one), the chip with no technique, the runner\'s step with a technique in hand and with its cooldown running, the chip ready and recovering, the technique key\'s held poll - and with all five springs in flight the step, the fold and the hands, none past 2 bytes a frame, against a control of three numbers into a fresh list a frame, which must show (mutants: the marks\' fresh empty list; the hosts\' clock read at rest; the chip\'s fresh list; an output copied a frame; the view fold\'s eye destructured; the cooldowns a Map; the poll walking the dicts)', () => {
  const url = (p) => JSON.stringify(pathToFileURL(join(ROOT, p)).href);
  const script = `
    await import(${url('test/modsOff.js')});
    const FX = await import(${url('src/combat/techniqueFx.js')});
    const T = await import(${url('src/combat/techniques.js')});
    const LR = await import(${url('src/systems/lootRarity.js')});
    const { createClimbFeelHost } = await import(${url('src/player/climbFeel.js')});
    const { setPref } = await import(${url('src/systems/uiPrefs.js')});
    const { PlayerWeapon } = await import(${url('src/combat/playerWeapon.js')});
    const { createWeapon } = await import(${url('src/combat/enemyEquipment.js')});
    const { held } = await import(${url('src/ui/input.js')});
    setPref('lootRarity', true);
    const bytes = (fn) => {
      for (let f = 0; f < 20000; f++) fn();
      let least = Infinity;
      for (let w = 0; w < 6; w++) {
        globalThis.gc(); globalThis.gc();
        const h0 = process.memoryUsage().heapUsed;
        for (let f = 0; f < 5000; f++) fn();
        least = Math.min(least, (process.memoryUsage().heapUsed - h0) / 5000);
      }
      return least;
    };
    const pos = [1, 2, 3], out = {}, sink = [];
    out.control = bytes(() => { sink[0] = [pos[0] + 0.5, pos[1] + 0.5, pos[2] + 0.5]; });
    const motor = { climbEvents: [], climbMove: null, pos: [0, 0, 0], onWall: false };
    const host = createClimbFeelHost(() => motor, { yaw: 0, pitch: 0, pos: [0, 0, 0] }, null);
    host.frame(1 / 60);
    const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), V = new Float32Array(16), ent = { items: [] };
    // the frame's numbers kept where the host keeps its own: a typed array (a closure's number would box a frame itself)
    const lens = new Float64Array(3);
    FX.resetTechniqueFx();
    out.rest = bytes(() => {
      FX.stepTechniqueFx(1 / 60); V.set(I); host.view(V, true); lens[0] = host.fovRad(); lens[1] = host.pitch(); lens[2] = FX.techniqueHands().y;
      sink[1] = T.techniqueMarksNow(); sink[2] = T.techniqueHudChips(ent, null); sink[5] = T.techniqueMarks(0);
    });
    // a technique in hand: the runner's frame at rest, the chip ready (its key a word the host caches), and recovering
    const it = LR.applyRarity(createWeapon(120, 1), 'rare', () => 0.3); it.isIdentified = true;
    LR.addTechniqueLine(it, () => 0.5, { id: 'whirlwind' });
    const pw = new PlayerWeapon({ weapon: it, liveSpeed: 50 }); pw.sheathed = false; pw.update(0);
    const me = { isPlayer: true, level: 8, items: [], stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(50), fatigue: 6400, health: 100, maxHealth: 100, equip: { slots: [] }, career: {}, activeEffects: [] };
    const tcam = { pos: [0, 1.7, 0], yaw: 0, pitch: 0, feet: new Float32Array(3) }, R = {};
    const ctx = { rig: R, entity: me, pw, cam: tcam, collider: null, held: false, ready: true, cancel: false, paralyzed: false, blocked: false, holding: false, startSwing: () => false, door: null, say: () => {}, noteShot: () => {} };
    const key = () => 'MOUSE3';
    out.inHand = bytes(() => { T.stepTechnique(1 / 60, ctx); sink[3] = T.techniqueHudChips(me, pw, key); sink[4] = T.techniqueMarksNow(); });
    ctx.startSwing = (s) => pw.techniqueStrike(s);
    ctx.held = true; T.stepTechnique(1 / 60, ctx); ctx.held = false;
    for (let i = 0; i < 240 && T.techniqueState().act; i++) { pw.update(1 / 60); T.stepTechnique(1 / 60, ctx); }
    const waiting = T.techniqueWait('whirlwind') > 0;
    ctx.startSwing = () => false;
    out.cooling = bytes(() => { T.stepTechnique(1e-5, ctx); sink[3] = T.techniqueHudChips(me, pw, key); });
    const keys = new Set(['KeyW']);
    let down = false;
    out.poll = bytes(() => { down = held(keys, 'WeaponTechnique'); });
    FX.techniqueCue('slam', 'hit'); FX.techniqueCue('whirlwind', 'release');
    // in flight: what THE FEEL writes in place - the springs, the fold into the view, the hands. (The lens's two numbers
    // are returned as numbers: at rest 0, which is free, and the rest measure above calls them; while a spring moves, a
    // call the JIT does not inline boxes its non-integer answer - the climb's own kick since CLIMB4, every number a
    // function returns.)
    out.flight = bytes(() => { FX.stepTechniqueFx(1e-6); V.set(I); host.view(V, true); lens[2] = FX.techniqueHands().y; });
    lens[0] = host.fovRad(); lens[1] = host.pitch();
    const v = FX.techniqueView(), h = FX.techniqueHands();
    console.log(JSON.stringify({ out, live: FX.techniqueFxLive(), waiting, down, moving: [v.pitch, v.roll, v.eye[1], v.fov, h.y].every((x) => x !== 0), acc: lens.every((x) => Number.isFinite(x) && x !== 0) && V[6] !== 0 }));
  `;
  const run = spawnSync(process.execPath, ['--expose-gc', '--min-semi-space-size=64', '--max-semi-space-size=64', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const r = JSON.parse(run.stdout.trim().split('\n').pop());
  assert.ok(r.live && r.moving && r.acc, 'every spring in flight through the last measure, and the view and the lens moved by it');
  assert.ok(r.waiting, 'the cooldown measure ran with the cooldown running');
  assert.equal(r.down, false);
  const m = r.out;
  assert.ok(m.control >= 40, `the control made ${m.control.toFixed(2)} bytes a frame - the measure is blind`);
  for (const [path, b] of Object.entries(m)) if (path !== 'control') assert.ok(b < 2, `${path}: ${b.toFixed(2)} bytes a frame (the control ${m.control.toFixed(2)})`);
});
