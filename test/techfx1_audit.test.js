// AUDIT TECH-FX (2026-10-10, the owner: "Please audit everything and ensure perfection"; bible/05-Combat/Weapon-Techniques.md
// AUDIT TECH-FX) - one test a finding, on the real classes: the bursts the motor's own feet dropped, the hands' dip and the
// Morrowind arm's frame window, the roll through the hosts' mirrored lens, the hit off the machine's own event (and not
// under a climb that swallows it), a recentre in a Lunge or a Volley, the chip's key and the bindings' index, the
// renderer's offset in place, and the one MISSILE_SPEED.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { setUiSkin } from '../src/systems/uiSkin.js';
import * as LR from '../src/systems/lootRarity.js';
import * as T from '../src/combat/techniques.js';
import * as FX from '../src/combat/techniqueFx.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { techniqueDipRect } from '../src/combat/weaponRig.js';
import { fpFrameWindow } from '../src/combat/fpArm.js';
import { setSigilDueling } from '../src/systems/sigil.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { createClimbFeelHost } from '../src/player/climbFeel.js';
import { PlayerMotor } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { perspective, mirrorProjectionX, lookAt, multiply } from '../src/world/mat4.js';
import { held, bindings } from '../src/ui/input.js';
import { setBinding, clearBindingByCode } from '../src/systems/inputActions.js';
import { Renderer } from '../src/render/renderer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const stats = () => ({ strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = (o = {}) => ({ isPlayer: true, level: 8, items: [], stats: stats(), skills: new Array(35).fill(50), fatigue: 6400, health: 100, maxHealth: 100, equip: { slots: [] }, career: {}, activeEffects: [], ...o });
const piece = (make, id, value = 20) => {
  const it = LR.applyRarity(make(), 'rare', lcg(7));
  it.isIdentified = true;
  LR.addTechniqueLine(it, () => 0.5, { id });
  LR.techniqueLineOf(it).value = value;
  return it;
};
const flat = () => ({
  raycast: (o, d, max) => { if (!(d[1] < 0)) return Infinity; const t = -o[1] / d[1]; return t <= max ? t : Infinity; },
  surfaceHit: (o, d, max) => (d[1] < 0 && o[1] >= 0 && o[1] <= max ? { dist: o[1], normal: [0, 1, 0] } : null),
  heightAt: () => 0,
});
const weaponOf = (it) => { const pw = new PlayerWeapon({ weapon: it, liveSpeed: 50 }); pw.sheathed = false; pw.update(0); return pw; };
const reset = () => { _resetForTests(); setPref('lootRarity', true); setUiSkin('enhanced'); setPref('soundEnhancements', true); T._resetTechniquesForTests(); setSigilDueling(false); setPlayerDoor(null); };
function feelDoor(extra = {}) {
  const log = [];
  return { log, door: { fx: (recipe, at, o) => log.push({ recipe, at: [...at], o: { ...o, ...(o?.to ? { to: [...o.to] } : {}) } }), shake() {}, sound() {}, ...extra } };
}
function rig({ pw, entity, door, cam }) {
  const started = [];
  const ctx = (held, extra = {}) => ({
    rig, entity, pw, cam, collider: flat(), held, ready: true, cancel: false,
    startSwing: (s) => { if (!pw.techniqueStrike(s)) return false; started.push(s); return true; },
    door, say: () => {}, noteShot: () => {}, ...extra,
  });
  return { started, ctx };
}

test('AUDIT TECH-FX THE MOTOR\'S FEET: the player\'s feet are a Float32Array (player/motor.js `pos`) and every host hands the rig exactly that - so a burst placed only for an Array never drew in any host; now a swing\'s burst stands on the motor\'s own feet (mutant: Array.isArray on the feet)', () => {
  reset();
  const motor = new PlayerMotor(new Collider(() => 0));
  assert.ok(motor.pos instanceof Float32Array, 'the motor\'s feet');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) assert.match(code(host), /camera: \(\) => \(\{ pos: player\.eyeAt\(\), yaw: cam\.yaw, pitch: cam\.pitch, sneaking: !!player\.isSneaking, feet: player\.pos,/, `${host}: the rig's feet are the motor's`);
  motor.pos[0] = 4; motor.pos[1] = 0; motor.pos[2] = -2;
  const fd = feelDoor();
  const pw = weaponOf(piece(() => createWeapon(124, 1), 'slam'));
  const r = rig({ pw, entity: player(), door: fd.door, cam: { pos: [4, 1.7, -2], yaw: 0, pitch: 0, feet: motor.pos } });
  T.stepTechnique(1 / 60, r.ctx(true));
  for (let i = 0; i < 240 && T.techniqueState().act; i++) { T.stepTechnique(1 / 60, r.ctx(false)); T.claimShot(pw.update(1 / 60), r.ctx(false)); }
  assert.deepEqual(fd.log.map((e) => e.recipe), ['shock'], 'the slam\'s shock - on the motor\'s own feet');
  assert.deepEqual(fd.log[0].at, [4, 0, -2]);
});

test('AUDIT TECH-FX THE ARM\'S DIP: the Morrowind arm\'s frame window covers the screen exactly, so an offset laid on after it opened a bare band; through the arm\'s own screen transform the window grows over the edge the dip opens, at any dip and size, and the arm sits where the dip puts it (mutants: the dip on the renderer\'s offset; the window off the dipped rect)', () => {
  for (const [W, H, pw, ph] of [[1600, 900, 533, 300], [1920, 1080, 640, 360], [800, 1280, 267, 427]]) {
    for (const dip of [0.02, 0.07, 0.11, 0.15]) {
      const base = { x: 0, y: 0, w: W, h: H };
      const win = fpFrameWindow(techniqueDipRect(base, dip, H), W, H, pw, ph);
      const d = win.dst;
      assert.ok(d.x <= 1e-9 && d.y <= 1e-9 && d.x + d.w >= W - 1e-9 && d.y + d.h >= H - 1e-9, `${W}x${H} dip ${dip}: the window covers the screen (${JSON.stringify(d)})`);
      const pitch = H / ph;   // the frame's pixel on the screen
      assert.ok(Math.abs((d.y - win.r0 * pitch) - dip * H) < 1e-6, `${W}x${H} dip ${dip}: the lens's own top row sits the dip below the screen's top`);
      // the old way: the window of the undipped rect, then the renderer's offset - a band the height of the dip, bare
      const old = fpFrameWindow(base, W, H, pw, ph).dst;
      assert.ok(old.y + dip * H > 1, `the offset after the window left ${(old.y + dip * H).toFixed(1)} px bare at the top`);
    }
  }
});

test('AUDIT TECH-FX THE ROLL ON THE SCREEN: through the hosts\' own lens (mirrorProjectionX(perspective)) and the climb\'s view step, a Whirlwind\'s release leans the view LEFT - into its leftward spin: the horizon\'s left end rises - and a Cleave\'s hit leans it RIGHT, as the table says (mutant: the roll kicked unmirrored)', () => {
  reset();
  const host = createClimbFeelHost(() => ({ climbEvents: [], climbMove: null, pos: [0, 0, 0], onWall: false }), { yaw: 0, pitch: 0, pos: [0, 0, 0] }, null);
  const P = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.1, 100));
  const eye = [0, 1.7, 0];
  const ndc = (M, p) => { const x = M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], y = M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], w = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15]; return [x / w, y / w]; };
  const horizon = (lean) => {
    FX.resetTechniqueFx();
    lean();
    for (let i = 0; i < 4; i++) host.frame(1 / 60);
    const V = host.view(lookAt(eye, [0, 1.7, 1], [0, 1, 0]), true);
    const M = multiply(P, V);
    const a = ndc(M, [1, 1.7, 5]), b = ndc(M, [-1, 1.7, 5]);
    const [left, right] = a[0] < b[0] ? [a, b] : [b, a];   // which is which on the SCREEN, from the lens itself
    return { left, right };
  };
  const level = horizon(() => {});
  assert.ok(Math.abs(level.left[1] - level.right[1]) < 1e-9, 'level at rest');
  const ww = horizon(() => FX.techniqueCue('whirlwind', 'release'));
  assert.ok(ww.left[1] > ww.right[1] + 0.01, `the Whirlwind leans left: the left end ${ww.left[1].toFixed(3)} over the right ${ww.right[1].toFixed(3)}`);
  const cl = horizon(() => FX.techniqueCue('cleave', 'hit'));
  assert.ok(cl.right[1] > cl.left[1] + 0.01, `the Cleave lands leaning right: the right end ${cl.right[1].toFixed(3)} over the left ${cl.left[1].toFixed(3)}`);
});

test('AUDIT TECH-FX THE HIT IS THE MACHINE\'S: the swing\'s hit moment is cued from the frame\'s own events - so a climb that swallows the hit (the rig hands no events while the hands are on the wall) cues none, and a window that holds the runner but not the machine cues it on the machine\'s hit, not after (mutants: a clock of the runner\'s own; the events unread)', () => {
  reset();
  const fd = feelDoor();
  const pw = weaponOf(piece(() => createWeapon(124, 1), 'slam'));
  const r = rig({ pw, entity: player(), door: fd.door, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: 0, feet: new Float32Array(3) } });
  T.stepTechnique(1 / 60, r.ctx(true));
  let sawHit = false;
  for (let i = 0; i < 240 && T.techniqueState().act; i++) {
    T.stepTechnique(1 / 60, r.ctx(false));
    const evs = pw.update(1 / 60);
    sawHit ||= evs.includes('hit');
    T.claimShot([], r.ctx(false));   // AUDIT CLIMB-ARC F7: the rig drops a climbing frame's events
  }
  assert.ok(sawHit, 'the machine hit');
  assert.deepEqual(fd.log, [], 'a swallowed hit sounds and shows nothing');
  // a window over the swing: the runner held, the machine and the claim on
  reset();
  const wd = feelDoor();
  const w2 = weaponOf(piece(() => createWeapon(124, 1), 'slam'));
  const r2 = rig({ pw: w2, entity: player(), door: wd.door, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: 0, feet: new Float32Array(3) } });
  T.stepTechnique(1 / 60, r2.ctx(true));
  let hitAt = -1, cueAt = -1;
  for (let i = 0; i < 240 && hitAt < 0; i++) {
    T.stepTechnique(1 / 60, r2.ctx(false, { blocked: i >= 2 }));
    const evs = w2.update(1 / 60);
    if (evs.includes('hit')) hitAt = i;
    T.claimShot(evs, r2.ctx(false, { blocked: i >= 2 }));
    if (cueAt < 0 && wd.log.length) cueAt = i;
  }
  assert.ok(hitAt > 2 && cueAt === hitAt, `under the window the moment is the machine's (hit ${hitAt}, cue ${cueAt})`);
});

test('AUDIT TECH-FX A RECENTRE IN FLIGHT: the floating origin\'s shift moves where a Lunge began (its trail) and where every falling Volley shaft lands - each its own point, moved once (mutants: the start unmoved; the landings unmoved; a landing aliased to its queue)', () => {
  reset();
  const ld = feelDoor({ motor: () => ({ grounded: true, techniqueLaunch() { this.grounded = false; return true; } }) });
  const lpw = weaponOf(piece(() => createWeapon(116, 1), 'lunge', 10));
  const feet = new Float32Array([1, 0, 1]);
  const lr = rig({ pw: lpw, entity: player(), door: ld.door, cam: { pos: [1, 1.7, 1], yaw: Math.PI / 2, pitch: 0, feet } });
  T.stepTechnique(1 / 60, lr.ctx(true));
  T.stepTechnique(1 / 60, lr.ctx(false));
  const off = [-819.2, 0, 409.6];
  T.offsetTechniques(off);
  feet[0] = 6 + off[0]; feet[2] = 1 + off[2];   // the host shifts the body with the world
  for (let i = 0; i < 240 && T.techniqueState().act; i++) { T.stepTechnique(1 / 60, lr.ctx(false)); T.claimShot(lpw.update(1 / 60), lr.ctx(false)); }
  const trail = ld.log.find((e) => e.recipe === 'trail');
  assert.ok(trail, 'the trail');
  assert.deepEqual(trail.at, [1 + off[0], 0, 1 + off[2]], 'from where the run began, in the shifted world');
  assert.ok(Math.hypot(trail.o.to[0] - trail.at[0], trail.o.to[2] - trail.at[2]) < 6, 'a few metres long, not a kilometre');
  // the Volley: two shafts already loosed when the world shifts
  reset();
  const v = player(); v.items.push({ ...createWeapon(ARROW_TEMPLATE, 0), stackCount: 10 });
  const bow = weaponOf(piece(() => createWeapon(130, 1), 'volley', 20));
  let fired = 0;
  const vd = feelDoor({ fireArrow: () => { fired++; } });
  const vr = rig({ pw: bow, entity: v, door: vd.door, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: -0.2, feet: new Float32Array(3) } });
  T.stepTechnique(1 / 60, vr.ctx(true));
  const aim = [...T.techniqueState().aim.point];
  T.stepTechnique(1 / 60, vr.ctx(false));
  for (let i = 0; i < 120 && !vd.log.length; i++) T.claimShot(bow.update(1 / 60), vr.ctx(false));
  for (let i = 0; i < 120 && fired < 2; i++) T.stepTechnique(1 / 60, vr.ctx(false));
  assert.equal(fired, 2);
  T.offsetTechniques(off);
  for (let i = 0; i < 300 && T.techniqueState().act; i++) T.stepTechnique(1 / 60, vr.ctx(false));
  const puffs = vd.log.filter((e) => e.recipe === 'shaft');
  assert.equal(puffs.length, 6);
  for (const p of puffs) assert.ok(Math.hypot(p.at[0] - (aim[0] + off[0]), p.at[2] - (aim[2] + off[2])) <= 3.5 + 0.05, `every puff on the shifted disc: ${p.at.map((x) => x.toFixed(1))}`);
  const close = vd.log.find((e) => e.recipe === 'close');
  assert.deepEqual(close.at, [aim[0] + off[0], aim[1] + off[1], aim[2] + off[2]]);
});

test('AUDIT TECH-FX THE CHIP AND THE KEY: the HUD\'s chip asks the key\'s word only when ready and is one list filled in place; the world host looks the word up once a binding change; the bindings\' held poll reads an index rebuilt on the store\'s rev, so a rebind is held at once and the old key no longer is (mutants: the word asked every frame; a fresh chip a frame; the hand\'s memo blind to a value; the index never rebuilt)', () => {
  reset();
  const me = player();
  const pw = weaponOf(piece(() => createWeapon(120, 1), 'whirlwind'));
  let asked = 0;
  const key = () => { asked++; return 'MOUSE3'; };
  const a = T.techniqueHudChips(me, pw, key), b = T.techniqueHudChips(me, pw, key);
  assert.equal(a, b, 'one list, filled in place');
  assert.deepEqual(a.map((c) => ({ ...c })), [{ key: 'technique', set: 'technique', name: 'Whirlwind', text: 'MOUSE3', state: 'active' }]);
  assert.equal(asked, 2, 'asked when ready');
  T.stepTechnique(1 / 60, rig({ pw, entity: me, door: null, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: 0, feet: new Float32Array(3) } }).ctx(true));
  const c = T.techniqueHudChips(me, pw, key);
  assert.equal(asked, 2, 'never while recovering');
  assert.deepEqual([c[0].text, c[0].state], ['10s', 'recovering']);
  assert.equal(T.techniqueHudChips(me, pw, key)[0].text, c[0].text);
  assert.equal(T.techniqueHudChips(me, pw, 'K')[0].state, 'recovering', 'a word handed as a string still reads');
  // the hand's memo follows its piece: a reforged value, an unknown piece named as the card names it
  const line = LR.techniqueLineOf(pw.weapon);
  const before = T.techniqueInHand(me, pw);
  assert.equal(T.techniqueInHand(me, pw), before, 'nothing moved: the same answer');
  line.value = 27;
  assert.equal(T.techniqueInHand(me, pw).value, 27, 'a reforged value read at once');
  pw.weapon.isIdentified = false;
  assert.equal(T.techniqueHudChips(me, pw, key)[0].name, T.UNKNOWN_TECHNIQUE, 'unknown: "Your technique"');
  pw.weapon.isIdentified = true;
  const w = code('src/scenes/world.js');
  assert.match(w, /setHudTechniqueChips\(\(e\) => techniqueHudChips\(e, [^;]*, techniqueKeyWord\)\);/);
  // the held poll's index, rebuilt on a rebind
  const store = bindings();
  const keys = new Set(['KeyJ']);
  assert.equal(held(keys, 'WeaponTechnique'), false, 'J holds nothing of it');
  setBinding(store, 'KeyJ', 'WeaponTechnique', false);
  try {
    assert.equal(held(keys, 'WeaponTechnique'), true, 'bound to J: held at once');
    clearBindingByCode(store, 'KeyJ', false);
    assert.equal(held(keys, 'WeaponTechnique'), false, 'unbound: no longer');
  } finally { clearBindingByCode(store, 'KeyJ', false); }
  assert.equal(held(new Set(['Mouse3']), 'WeaponTechnique'), true, 'its own key still holds it');
});

test('AUDIT TECH-FX THE OFFSET IN PLACE AND THE ONE SPEED: the renderer\'s screen offset is its own pair moved in place (every reader copies it out) with one frozen pair before any is set; a shaft\'s flight is MISSILE_SPEED, imported - never a second literal; the gun\'s muzzle is measured where the dip drew it (mutants: a fresh pair a set; a literal 25; the muzzle undipped)', () => {
  const r = {};
  const set = Renderer.prototype.setScreenOffset;
  const get = Object.getOwnPropertyDescriptor(Renderer.prototype, 'screenOffset').get;
  const zero = get.call(r);
  assert.deepEqual([...zero], [0, 0]);
  assert.ok(Object.isFrozen(zero), 'one frozen pair before any is set');
  set.call(r, 3, 4);
  const pair = get.call(r);
  set.call(r, 5, 6);
  assert.equal(get.call(r), pair, 'the same pair');
  assert.deepEqual([...pair], [5, 6], 'moved in place');
  for (const f of ['src/ui/uiScreen.js', 'src/ui/chargenArt.js']) assert.match(code(f), /const \[ox, oy\] = renderer\.screenOffset \?\? \[0, 0\];/, `${f} copies it out`);
  const tq = code('src/combat/techniques.js');
  assert.match(tq, /import \{ MISSILE_SPEED \} from '\.\.\/systems\/spellcast\.js';/);
  assert.doesNotMatch(tq, /\/ 25\b|TECH_ARROW_MPS/, 'no second literal of the shaft\'s speed');
  assert.doesNotMatch(code('src/combat/techniqueFx.js'), /= 25;/);
  assert.match(code('src/combat/weaponRig.js'), /_tlDrawn = \{ rect: \{ \.\.\.rect, x: rx, y: ry \},[^\n]*\n\s*if \(_dipPx\) _tlDrawn\.rect\.y \+= _dipPx;/, 'the muzzle where the dip drew the gun');
});
