// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag") - THE HELM: the aim a look lays (its reach on the
// sea, a ship under the crosshair), the aim's red as the truth of where each gun stops, why a battery will not fire yet,
// the zone stood up and the strikes marked, and the broadside camera. The law is bible/03-World/Naval-Combat.md
// "AUDIT NAV1 - The helm".
import { byClass, keydown, Node_ } from './chargenDom.mjs';   // the suite's minimal DOM: the plate's Brace under a finger, the shipwright's window
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AIM_SLOPE, lookReach, aimSolution } from '../src/systems/naval/navalGunnery.js';
import { HULL, batteryOf, hullBuild } from '../src/systems/naval/navalShips.js';
import { SHIP_STATES, BRACE_TAKEN, BARE_POLES, WRECKED_OARS, STRUCK_AT } from '../src/systems/naval/navalDamage.js';
import { BOARD_RANGE, BOARD_SPEED } from '../src/systems/naval/navalBoarding.js';
import { NAVAL_DEG, shotPosition, segmentBoxEntry } from '../src/systems/naval/navalBallistics.js';
import { hullBoxOf, rigBoxesOf, AIM_CAM_OUT, AIM_CAM_UP, AIM_CAM_AFT, AIM_CAM_TAU, AIM_CAM_CLEAR, RAM_REACH, RAM_MEMORY_S, RAM_DAMAGE, RAM_RECOIL, BOW_RECOIL, GALLEY_RAM, RAM_SPEED, RAM_COOLDOWN_S, HEAVE_TO_DECEL, HEAVE_TO_S, COMPASS_SHIP_RANGE, PLAYER_SKILL, PLAYER_SKILL_THIN } from '../src/scenes/navalHost.js';
import { drawShipCompassMarks, SHIP_MARK_COLORS, compassMarkerLerp, DETECT_MARKER_W, DETECT_MARKER_H } from '../src/ui/hud.js';
import { navalHudText, drawNavalHud, destroyNavalHud, navalTouchBrace, NAVAL_BRACE_H, NAVAL_HUD_CSS } from '../src/ui/navalHud.js';
import { NavalRenderer, NAVAL_STRIDE, aimTone, AIM_TONES, AIM_POST_HALF_W, AIM_POST_HALF_H, AIM_STRIKE_HALF, flatAcross } from '../src/render/navalRender.js';
import { yardOffer, yardAll, fieldMend, YARD_PRICE, BARREL_PRICE, FIELD_QUIET_S, FIELD_MEND_PER_S, FIELD_MEND_ALONE, FIELD_MEND_CAP, FIELD_REFLOAT } from '../src/systems/naval/navalYard.js';
import { REPAIR_PRICE } from '../src/systems/naval/navalDamage.js';
import { yardText, yardNote, mountNavalYardWindow } from '../src/ui/navalYardWindow.js';
import { createNavalYardOverlay, navalYardOpen, closeNavalYard } from '../src/ui/navalPlunderDoor.js';
import { WARM_CHUNKS } from '../src/ui/enhancedChunk.js';
import { sea } from './navalSea.mjs';
import { mendScaleOf, MORALE_START } from '../src/systems/naval/shipCrew.js';   // SHIP-CREW: the mending by her crew's spirits

// the suite's DOM, a step nearer a browser for a window that greys its presses (test/nav_f_ui.test.js's own)
{
  const proto = Node_.prototype;
  const setAttr = proto.setAttribute;
  proto.setAttribute = function (k, v) { setAttr.call(this, k, v); if (k === 'disabled' || k === 'hidden') this[k] = true; };
  proto.removeAttribute = function (k) { delete this.attrs[k]; if (k === 'disabled' || k === 'hidden') this[k] = false; };
  proto.closest = function (sel) {
    for (let n = this; n; n = n.parentNode) if (typeof n.className === 'string' && n.className.split(/\s+/).includes(sel.replace(/^\./, ''))) return n;
    return null;
  };
}

const DEG = NAVAL_DEG;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const ID = [0, 0, 0, 1];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const toward = (from, to) => unit([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
const r3 = (v) => Math.round(v * 1000) / 1000;
/** The helm's eye in the sea harness: over my Small Ship's quarterdeck at the origin, heading +z (starboard +x). */
const EYE = [0, 5, 0];

/** A sea with my Small Ship at the helm and a merchantman launched far off (she never fires unprovoked). */
async function helm(o = {}) {
  const h = await sea({ hull: HULL.SmallShip, ...o, settings: { ShipsAtSea: 'off', Boarders: false, ...(o.settings ?? {}) } });
  if (o.save) h.host.restoreSaveData(o.save);
  const e = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 900 }));
  return { ...h, e };
}
/** Frames with each ship held where the test put her - her way and heading its own, her turn none. */
function frames(h, held, n = 1, opts = {}) {
  for (let i = 0; i < n; i++) {
    for (const [e, p] of held) { e.ship.pos = [...p.pos]; e.ship.yaw = p.yaw ?? 0; e.ship.speed = p.speed ?? 0; e.ship.yawRate = 0; }
    h.host.frame(0.1, opts);
  }
}
const boxOf = (h, e) => hullBoxOf(e.boat, h.pool.models);

// ── the aim a look lays ─────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 H1 the look\'s reach: where it meets the sea while that point moves out less than AIM_SLOPE a degree of pitch - the zone under the crosshair - and past it straight on at AIM_SLOPE, through the horizon and over it, meeting the first law in its value and its rate (mutants: the slope a radian\'s, the root dropped, the ramp turned back, the laws swapped)', () => {
  const h = 6;
  for (const d of [20, 45, 70]) near(lookReach(-Math.atan2(h, d), h), d, 1e-9, `the sea ${d} m out`);
  // the seam: sin^2(p0) = h / slope
  const slope = AIM_SLOPE / DEG;
  const p0 = Math.asin(Math.sqrt(h / slope));
  const e = 1e-7;
  const rate = (p) => (lookReach(p + e, h) - lookReach(p - e, h)) / (2 * e);
  near(lookReach(-(p0 + 1e-9), h), lookReach(-(p0 - 1e-9), h), 1e-5, 'one value either side of the seam');
  near(rate(-(p0 + 1e-4)), slope, slope * 0.01, 'the sea\'s rate at the seam');
  near(rate(-(p0 - 1e-4)), slope, slope * 1e-4, 'the ramp\'s');
  near(lookReach(-(p0 - DEG), h) - lookReach(-p0, h), AIM_SLOPE, 1e-6, 'a degree past the seam, AIM_SLOPE further');
  assert.ok(lookReach(DEG, h) > lookReach(0, h) && lookReach(0, h) > lookReach(-p0, h), 'on through the horizon and over it');
  for (let p = -40 * DEG; p < 5 * DEG; p += 0.25 * DEG) assert.ok(rate(p) <= slope * 1.0001, `never more than AIM_SLOPE a degree (at ${(p / DEG).toFixed(2)})`);
  // at the default mouse (0.286 degrees a pixel) the long shot moves under 9 m a pixel - the sea's own law threw it 37
  assert.ok(AIM_SLOPE * 0.286 < 9);
  assert.ok(lookReach(-Math.asin(Math.sqrt(10 / slope)), 10) > lookReach(-p0, h), 'a higher eye: its seam further out');
  assert.ok(Number.isFinite(lookReach(-0.2, 0)), 'an eye at the sea still answers');
});

test('AUDIT NAV1 H2 a look on a ship lays the guns for its very point - its range out along the fire and its own height, the middle gun\'s arc through it; a look on the sea lays its reach out along the look\'s own bearing, measured along the fire (mutants: the point\'s height ignored, the slant taken for the range)', () => {
  const ship = { position: [0, 0, 0], rotation: ID, velocity: [0, 0, 0], hull: HULL.SmallShip };
  const bat = batteryOf(HULL.SmallShip, 'starboard');
  assert.deepEqual(bat.muzzles[2], [8.1, 4.5, -4.5]);
  const at = [85, 6, -4.5];   // on her side, 6 m over the sea, abeam my middle gun
  const aim = aimSolution(ship, 'starboard', { origin: EYE, dir: [1, 0, 0], at }, 0);
  assert.deepEqual(aim.lookPoint, at);
  const mid = aim.launches[2];
  near(shotPosition(mid.p0, mid.v0, (at[0] - mid.p0[0]) / mid.v0[0])[1], at[1], 0.15, 'through her point, at its height');
  // the sea: 30 degrees forward of the beam, 40 m out on the flat from an eye 6 m up
  const eye = [0, 6, 0], d = 40, b = 30 * DEG;
  const sea = aimSolution(ship, 'starboard', { origin: eye, dir: [Math.cos(b) * d, -eye[1], Math.sin(b) * d] }, 0);
  near(sea.lookPoint[0], Math.cos(b) * d, 1e-9); near(sea.lookPoint[2], Math.sin(b) * d, 1e-9);
  assert.equal(sea.lookPoint[1], 0, 'on the sea');
  const cx = bat.muzzles.reduce((s, m) => s + m[0], 0) / bat.muzzles.length;
  near(sea.landings[2].point[0] - bat.muzzles[2][0], Math.cos(b) * d - cx, 0.05, 'out along the fire, from the guns');
});

// ── the aim's red: where each gun stops ─────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 H3 the crosshair on her hull lays the broadside into her side: every gun\'s arc ends at her planking - its strike marked where the ball meets her, none on to the sea behind her - and the aim reads red; the same ray on to the sea met it past her, over her; laid, the card is the ship the guns strike, wherever the look is (mutants: the look on a ship ignored, the strikes never walked, the card by the look alone)', async () => {
  const h = await helm();
  const her = { pos: [90, 0, 0], yaw: 0 };
  frames(h, [[h.e, her]], 3);
  const box = boxOf(h, h.e);
  const side = [box.c[0] - box.h[0], 1.2, 0];   // her near side abeam my guns, 1.2 m over the sea
  const dir = toward(EYE, side);
  h.view.look = { origin: EYE, dir };
  h.host.attackInput(true);
  frames(h, [[h.e, her]]);
  const m = h.host.hudModel();
  assert.deepEqual([m.aim.side, m.aim.state, m.aim.hot], ['starboard', 'ready', true], 'laid, loaded and red');
  const d = h.host.drawFrame().aim;
  assert.equal(d.strikes.length, 6, 'all six guns into her');
  assert.equal(d.zone.length, 0, 'none on to the sea');
  assert.equal(d.hot, true);
  for (const p of d.strikes) { near(p[0], side[0], 0.5, 'at her side'); near(p[1], side[1], 0.5, 'at the height the crosshair is on'); }
  for (let i = 0; i < 6; i++) assert.deepEqual(d.arcs[i].at(-1).map(r3), d.strikes[i].map(r3), 'each arc ends where its ball strikes');
  const s = EYE[1] / -dir[1];
  assert.ok(EYE[0] + dir[0] * s > box.c[0] + box.h[0], 'where the look met the sea lay beyond her far side');
  assert.equal(navalHudText(m, {}).aim.target, ' - on target');
  assert.equal(m.target?.name, h.e.ship.names.name, 'her card');
  // the look on the sea 26 degrees forward of her, the broadside still square on her: red, and her card
  h.view.look = { origin: EYE, dir: toward(EYE, [box.c[0] - box.h[0], 1, 40]) };
  frames(h, [[h.e, her]]);
  const fwd = h.host.hudModel();
  assert.equal(fwd.aim.hot, true, 'a broadside\'s zone lies forward of the look');
  assert.equal(fwd.target?.name, h.e.ship.names.name, 'the card is the ship the guns strike');
  h.host.cancelAim();
  frames(h, [[h.e, her]]);
  assert.equal(h.host.hudModel().target, null, 'put down: the look\'s own card, and the look is off her');
});

test('AUDIT NAV1 H4 the crosshair on her canvas: round shot is laid for her hull - her centre at her box\'s middle height, never the sail a ball flies on through - and the Small Ship\'s chain chasers for the canvas itself, the rig their mark (mutants: round shot laid for the canvas, chain laid for the hull, the rig never asked)', async () => {
  const h = await helm();
  const abeam = { pos: [90, 0, 0], yaw: 0 };
  frames(h, [[h.e, abeam]], 3);
  const box = boxOf(h, h.e), rig = rigBoxesOf(h.e.boat)[0];
  const sail = [rig.c[0] - rig.h[0] - 0.05, 22, 0];
  assert.ok(sail[0] > box.c[0] - box.h[0], 'her canvas stands inboard of her side');
  h.view.look = { origin: EYE, dir: toward(EYE, sail) };
  h.host.attackInput(true);
  frames(h, [[h.e, abeam]]);
  let d = h.host.drawFrame().aim;
  assert.equal(d.strikes.length, 6, 'the broadside into her hull');
  const top = box.c[1] + box.h[1];
  for (const p of d.strikes) { near(p[0], box.c[0] - box.h[0], 0.6, 'through her side'); assert.ok(p[1] < top - 1, `under her top (${p[1].toFixed(2)})`); }
  assert.equal(h.host.hudModel().aim.hot, true);
  h.host.cancelAim();
  // dead ahead and broadside on: the chasers (chain) on her canvas, 14 m up
  const ahead = { pos: [0, 0, 90], yaw: Math.PI / 2 };
  frames(h, [[h.e, ahead]], 2);
  const rig2 = rigBoxesOf(h.e.boat)[0], box2 = boxOf(h, h.e);
  const canvas = [0, 14, rig2.c[2] - rig2.h[0] - 0.05];
  const dir = toward(EYE, canvas);
  const atSide = (box2.c[2] - box2.h[0] - EYE[2]) / dir[2];
  assert.ok(EYE[1] + dir[1] * atSide > box2.c[1] + box2.h[1], 'the look clears her hull to meet her canvas');
  h.view.look = { origin: EYE, dir };
  h.host.attackInput(true);
  frames(h, [[h.e, ahead]]);
  const m = h.host.hudModel();
  assert.deepEqual([m.aim.side, m.aim.gun, m.aim.hot], ['bow', 'chain', true]);
  d = h.host.drawFrame().aim;
  assert.equal(d.strikes.length, 2, 'both chasers into her rig');
  for (const p of d.strikes) near(p[1], 14, 1, 'at the canvas the crosshair is on');
});

test('AUDIT NAV1 H5 the red is where she WILL be: each arc is walked against her box moved on by her way over the ball\'s time aloft - a stern that will have sailed clear of the foremost gun\'s line is no strike, the same stern lying still is; and the aim reads the hulls as this frame stands them (mutants: her way ignored, the aim read off the last frame\'s hulls)', async () => {
  const h = await helm();
  const bat = batteryOf(HULL.SmallShip, 'starboard').muzzles;
  const fore = bat.at(-1)[2];   // my foremost gun's line (z 6)
  // her stern 2.5 m aft of that line, way on 6 m/s ahead: 1.2 s aloft carries her 7 m on
  const still = { pos: [90, 0, 0], yaw: 0 };
  frames(h, [[h.e, still]], 3);
  const b0 = boxOf(h, h.e);
  const sternOff = b0.c[2] - b0.h[2] - 0;   // her stern, from her position (z)
  const z = fore - 2.5 - sternOff;
  const lying = { pos: [90, 0, z], yaw: 0 };
  frames(h, [[h.e, lying]], 2);
  const box = boxOf(h, h.e);
  const side = [box.c[0] - box.h[0], 1.2, fore - 1];
  h.view.look = { origin: EYE, dir: toward(EYE, side) };
  h.host.attackInput(true);
  frames(h, [[h.e, lying]]);
  let d = h.host.drawFrame().aim;
  assert.equal(d.strikes.length, 1, 'lying still: the foremost gun strikes her stern');
  near(d.strikes[0][2], fore, 0.05);
  assert.equal(h.host.hudModel().aim.hot, true);
  const sailing = { pos: [90, 0, z], yaw: 0, speed: 6 };
  frames(h, [[h.e, sailing]]);
  const now = boxOf(h, h.e);
  assert.ok(now.c[2] - now.h[2] < fore, 'her stern still across that line as the aim is read');
  d = h.host.drawFrame().aim;
  assert.equal(d.strikes.length, 0, 'under way: she is clear of it when the ball gets there');
  assert.equal(h.host.hudModel().aim.hot, false);
  // this frame's hulls: moved out of the fire, she is out of it the same frame
  frames(h, [[h.e, lying]]);
  assert.equal(h.host.hudModel().aim.hot, true);
  frames(h, [[h.e, { pos: [90, 0, 400], yaw: 0 }]]);
  assert.equal(h.host.hudModel().aim.hot, false, 'the frame she moves');
  // a ship going down is struck by nothing
  frames(h, [[h.e, lying]]);
  assert.equal(h.host.hudModel().aim.hot, true);
  h.e.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  frames(h, [[h.e, lying]]);
  assert.equal(h.e.ship.damage.state, SHIP_STATES.sinking);
  assert.equal(h.host.drawFrame().aim.strikes.length, 0, 'going down');
  assert.equal(h.host.hudModel().aim.hot, false);
});

// ── why the guns will not fire yet ─────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 H6 why the guns will not fire yet - loading (the seconds left), braced, no barrels, crippled: each the aim line\'s tail, dimmed; the zone grey; never red however true the lay; the arcs still where it would go (mutants: red while loading, the state unread, the seconds dropped)', async () => {
  const h = await helm();
  const her = { pos: [90, 0, 0], yaw: 0 };
  frames(h, [[h.e, her]], 3);
  const box = boxOf(h, h.e);
  h.view.look = { origin: EYE, dir: toward(EYE, [box.c[0] - box.h[0], 1.2, 0]) };
  h.host.attackInput(true);
  frames(h, [[h.e, her]]);
  assert.equal(h.host.hudModel().aim.hot, true);
  h.host.attackInput(false);   // the broadside
  h.host.attackInput(true);
  frames(h, [[h.e, her]]);
  let m = h.host.hudModel();
  assert.equal(m.aim.state, 'reloading');
  assert.ok(m.aim.left > 0 && m.aim.left < 13);
  assert.equal(m.aim.hot, false, 'never red while loading');
  let t = navalHudText(m, {}).aim;
  assert.deepEqual([t.target, t.dim, t.hot], [` - reloading ${m.aim.left.toFixed(1)}\u00a0s`, true, false]);   // AUDIT NAV1 (the presentation): the seconds and their unit kept whole in a wrapped line
  let d = h.host.drawFrame().aim;
  assert.deepEqual([d.ready, d.hot], [false, false]);
  assert.ok(d.strikes.length > 0, 'the arcs still end at her side');
  assert.deepEqual(aimTone(d), AIM_TONES.idle, 'grey');
  frames(h, [[h.e, her]], 5);
  assert.ok(h.host.hudModel().aim.left < m.aim.left, 'counting down');
  // braced: the port side is loaded
  h.view.look = { origin: EYE, dir: [-1, -0.05, 0] };
  frames(h, [[h.e, her]], 1, { brace: true });
  m = h.host.hudModel();
  assert.deepEqual([m.aim.side, m.aim.state], ['port', 'braced']);
  assert.equal(navalHudText(m, {}).aim.target, ' - braced');
  // no barrels: four rolled off the stern
  h.host.cancelAim();
  h.view.look = { origin: EYE, dir: [0, -0.3, -1] };
  for (let i = 0; i < 4; i++) { h.host.attackInput(true); frames(h, [[h.e, her]]); h.host.attackInput(false); frames(h, [[h.e, her]], 13); }
  h.host.attackInput(true);
  frames(h, [[h.e, her]]);
  m = h.host.hudModel();
  assert.deepEqual([m.aim.side, m.aim.state, m.aim.barrel], ['stern', 'empty', true]);
  t = navalHudText(m, {}).aim;
  assert.deepEqual([t.target, t.dim], [' - no barrels', true]);
  assert.equal(h.host.drawFrame().aim.ready, false);
  // crippled
  const w = await helm({ save: { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] } });
  w.view.look = { origin: EYE, dir: [1, -0.05, 0] };
  w.host.attackInput(true);
  frames(w, []);
  m = w.host.hudModel();
  assert.equal(m.aim.state, 'crippled');
  assert.equal(navalHudText(m, {}).aim.target, ' - guns silent');
  // loaded and laid on the sea: the plain line
  const f = navalHudText({ ...m, aim: { ...m.aim, state: 'ready', hot: false } }, {}).aim;
  assert.deepEqual([f.target, f.dim], ['', false]);
});

// ── the aim drawn ───────────────────────────────────────────────────────────────────────────────────────────────────

function recordingGl() {
  const consts = { ARRAY_BUFFER: 'ARRAY_BUFFER', TRIANGLES: 'TRIANGLES', ONE: 'ONE', ONE_MINUS_SRC_ALPHA: 'ONE_MINUS_SRC_ALPHA', BLEND: 'BLEND', DEPTH_TEST: 'DEPTH_TEST', CULL_FACE: 'CULL_FACE', TEXTURE_2D: 'TEXTURE_2D', LEQUAL: 'LEQUAL', LESS: 'LESS' };
  let ids = 0;
  return new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
}
function standInRenderer() {
  const view = new Float32Array(16); view[0] = 1; view[5] = 1; view[10] = 1; view[15] = 1;
  return {
    gl: recordingGl(), _proj: new Float32Array(16), _view: view, _camPos: [0, 5, 0], _ambient: [0.3, 0.3, 0.3], _sunColor: [1, 1, 1], _sunScale: 1,
    _lightDir: [0, 1, 0], _fogColor: [0.5, 0.5, 0.6], _fogMode: 1, _fogDensity: 0.001, _fogRange: [10, 900], _dwFog: new Float32Array(4), _focus: new Float32Array(4), markForeignPass() {},
  };
}
/** Quad `q`'s six vertices' positions, and its first vertex's colour. */
const quad = (pass, q) => Array.from({ length: 6 }, (_, k) => [...pass.data.slice((q * 6 + k) * NAVAL_STRIDE, (q * 6 + k) * NAVAL_STRIDE + 3)]);
const colour = (pass, q) => [...pass.data.slice(q * 6 * NAVAL_STRIDE + 5, q * 6 * NAVAL_STRIDE + 9)].map(r3);

test('AUDIT NAV1 H7 the aim drawn: each ball\'s fall stood up as a post of light over its mark and turned to the eye, a strike marked where it meets her, brass laid, red on her, grey when the battery cannot fire (mutants: the posts never laid, the post lying flat, the grey ignored)', () => {
  const pass = new NavalRenderer(standInRenderer());
  const zone = [[0, 0, -60], [3, 0, -60]];
  pass.draw({ aim: { arcs: [], zone, strikes: [], hot: false, ready: true, radius: 2, posts: true } });
  assert.equal(pass.drawn, 4, 'two marks on the sea, two posts over them');
  const post = quad(pass, 2);
  const ys = post.map((p) => p[1]);
  near(Math.min(...ys), 0, 1e-6, 'standing on the sea'); near(Math.max(...ys), 2 * AIM_POST_HALF_H, 1e-5, 'its height');
  const xs = post.map((p) => p[0]), zs = post.map((p) => p[2]);
  near(Math.max(...xs) - Math.min(...xs), 2 * AIM_POST_HALF_W, 1e-5, 'across the eye\'s line');
  near(Math.max(...zs) - Math.min(...zs), 0, 1e-5, 'turned square to it');
  assert.deepEqual(colour(pass, 0), AIM_TONES.laid.zone.map(r3));
  assert.deepEqual(colour(pass, 2), AIM_TONES.laid.post.map(r3));
  pass.draw({ aim: { arcs: [], zone, hot: false, radius: 2 } });
  assert.equal(pass.drawn, 2, 'no posts asked, none stood');
  pass.draw({ aim: { arcs: [], zone: [], strikes: [[0, 4, -50]], hot: true, ready: true, posts: true } });
  assert.equal(pass.drawn, 1, 'the strike');
  const s = quad(pass, 0);
  near(Math.max(...s.map((p) => p[1])) - Math.min(...s.map((p) => p[1])), 2 * AIM_STRIKE_HALF, 1e-5);
  assert.deepEqual(colour(pass, 0), AIM_TONES.hot.strike.map(r3), 'red on her');
  pass.draw({ aim: { arcs: [], zone: [zone[0]], hot: true, ready: false, radius: 2, posts: true } });
  assert.deepEqual(colour(pass, 0), AIM_TONES.idle.zone.map(r3), 'grey, however true the lay');
  assert.deepEqual(colour(pass, 1), AIM_TONES.idle.post.map(r3));
  assert.deepEqual(aimTone({ hot: true, ready: true }), AIM_TONES.hot);
  assert.deepEqual(aimTone({ hot: false }), AIM_TONES.laid);
  const f = flatAcross([10, 0, 0], [0, 5, 0], 0.5);
  assert.deepEqual([r3(f[0]) + 0, f[1] + 0, r3(Math.abs(f[2]))], [0, 0, 0.5]);
});

// ── the broadside camera ─────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 H8 the broadside camera: while a broadside is laid the eye eases over AIM_CAM_TAU to AIM_CAM_OUT past that battery\'s ports, AIM_CAM_UP over them and AIM_CAM_AFT toward her stern - smoothstepped - and home again on the release, the eye its own once there; AIM_CAM_CLEAR short of a ship alongside; never for the chasers, never crippled, never with the Broadside camera off (mutants: the setting unread, the ease, the smoothstep, the guard, the chasers taken)', async () => {
  const h = await helm();
  frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]], 2);
  const own = [0, 5, 0];
  assert.equal(h.host.aimEye(own, 0.1), own, 'nothing laid: the eye its own');
  h.view.look = { origin: own, dir: [1, -0.05, 0] };
  h.host.attackInput(true);
  frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]]);
  const bat = batteryOf(HULL.SmallShip, 'starboard').muzzles;
  const c = bat.reduce((s, m) => [s[0] + m[0] / bat.length, s[1] + m[1] / bat.length, s[2] + m[2] / bat.length], [0, 0, 0]);
  const want = [c[0] + AIM_CAM_OUT, c[1] + AIM_CAM_UP, c[2] - AIM_CAM_AFT];
  const k = 1 - Math.exp(-0.1 / AIM_CAM_TAU), s = k * k * (3 - 2 * k);
  const first = h.host.aimEye(own, 0.1);
  for (let i = 0; i < 3; i++) near(first[i], own[i] + (want[i] - own[i]) * s, 1e-9, 'eased, smoothstepped');
  let eye = null;
  for (let i = 0; i < 40; i++) eye = h.host.aimEye(own, 0.1);
  for (let i = 0; i < 3; i++) near(eye[i], want[i], 1e-6, 'over her ports');
  h.host.cancelAim();
  frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]]);
  const back = h.host.aimEye(own, 0.1);
  assert.ok(back[0] < eye[0] && back[0] > own[0], 'on its way home');
  for (let i = 0; i < 60; i++) eye = h.host.aimEye(own, 0.1);
  assert.equal(eye, own, 'home: the eye its own again');
  // a ship alongside: the way out stops AIM_CAM_CLEAR short of her side
  const alongside = { pos: [20, 0, 0], yaw: 0 };
  frames(h, [[h.e, alongside]], 2);
  h.host.attackInput(true);
  frames(h, [[h.e, alongside]]);
  for (let i = 0; i < 40; i++) eye = h.host.aimEye(own, 0.1);
  const entry = segmentBoxEntry(c, want, boxOf(h, h.e), AIM_CAM_CLEAR);
  assert.ok(entry && entry.t > 0 && entry.t < 1, 'her side across the camera\'s way');
  for (let i = 0; i < 3; i++) near(eye[i], entry.point[i], 1e-6, 'short of her side');
  // the chasers: no broadside camera
  h.host.cancelAim();
  h.view.look = { origin: own, dir: [0, -0.05, 1] };
  h.host.attackInput(true);
  frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]]);
  assert.equal(h.host.hudModel().aim.side, 'bow');
  for (let i = 0; i < 60; i++) eye = h.host.aimEye(own, 0.1);
  assert.equal(eye, own, 'over the bow the eye stays');
  // the Broadside camera off
  const off = await helm({ settings: { AimCamera: false } });
  off.view.look = { origin: own, dir: [1, -0.05, 0] };
  off.host.attackInput(true);
  frames(off, []);
  assert.equal(off.host.hudModel().aim.side, 'starboard');
  assert.equal(off.host.aimEye(own, 0.1), own, 'switched off');
  // crippled
  const w = await helm({ save: { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] } });
  w.view.look = { origin: own, dir: [1, -0.05, 0] };
  w.host.attackInput(true);
  frames(w, []);
  assert.equal(w.host.hudModel().aim.state, 'crippled');
  assert.equal(w.host.aimEye(own, 0.1), own, 'a crippled ship\'s guns are silent - no camera for them');
});

test('AUDIT NAV1 H9 the world wires it: the broadside camera\'s eye is the frame\'s - the view built from it, the look\'s ray started from it through _dwEyeOffset - never the travel view\'s; the Broadside camera is a part of the Naval Combat row, each player\'s own, read as AimCamera (mutants: the eye unwired, the part unread)', () => {
  const w = src('scenes/world.js');
  assert.match(w, /renderer\.setFocus\(tvf \? cam\.pos : null, !!tvf && tvf\.blend >= 0\.5\);[^\n]*\n(\s*\/\/[^\n]*\n)+\s*if \(naval && !tvf\) mwv\.eye = naval\.aimEye\(mwv\.eye, dt\);\n(\s*tvBandSpritesStep\(dt, tvf, mwv\.eye\);[^\n]*\n)?\s*const view = betterAmbience\.view\(lookAt\(mwv\.eye,/);   // THE MERGE (OW-FOES): the bands' sprites stepped between, off the view's eye as it stands
  assert.match(w, /for \(let i = 0; i < 3; i\+\+\) _dwEyeOffset\[i\] = mwv\.eye\[i\] - cam\.pos\[i\];/);
  assert.match(w, /origin: \[cam\.pos\[0\] \+ _dwEyeOffset\[0\], cam\.pos\[1\] \+ _dwEyeOffset\[1\], cam\.pos\[2\] \+ _dwEyeOffset\[2\]\]/);
  assert.match(w, /key === 'AimCamera' \? getPref\('naval-aim-camera'\) !== false/);
  const f = src('systems/features.js');
  assert.match(f, /Object\.freeze\(\{ store: 'prefs', key: 'naval-aim-camera', initial: true, online: 'player' \}\)/);
  assert.match(f, /Object\.freeze\(\{ key: 'naval-aim-camera', label: 'Broadside camera' \}\)/);
});

// ── the brace ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 H10 the brace is the brace and nothing else: at the helm the Crouch key never reaches the motor\'s stance (a brace left the player crouched, the lay 6 m short) nor its descent; under a finger the plate\'s own Brace, held, braces - named in the hint and the warning, shown only at an armed helm, let go when the plate goes (mutants: the stance fed at the helm, the finger\'s press unread, a press surviving its plate)', () => {
  const w = src('scenes/world.js');
  assert.match(w, /const helmBrace = navalOn\(\) && csaRuntime\.isSailing\(\);\n\s*const crouchHeld = !helmBrace && held\(keys, 'Crouch'\);[^\n]*\n\s*const crouchPress = !helmBrace && pressed\(latch\.edge, keys, 'Crouch'\);/);
  assert.match(w, /brace: csaRuntime\.isSailing\(\) && \(held\(keys, 'Crouch'\) \|\| navalTouchBrace\(\)\) \}\);/);
  // the words: a finger's hint and warning name the plate's press
  const model = (o = {}) => ({ ship: { name: 'Small Ship', hull: 1, sail: 1, crew: 1 }, armed: true, aiming: false, aim: null, board: null, batteries: [], notoriety: { crown: 'Daggerfall', level: 0 }, incoming: null, ...o });
  const keys = { aim: 'RIGHT CLICK', board: 'E', brace: 'C' };
  let t = navalHudText(model({ incoming: { name: 'x' } }), keys, { touch: true });
  assert.deepEqual([t.plate.hint, t.warn.key, t.plate.brace], ['Hold and drag to aim - hold Brace', 'Brace', true]);   // AUDIT NAV1 (the presentation): the warning names the press
  t = navalHudText(model({ incoming: { name: 'x' } }), keys);
  assert.deepEqual([t.plate.hint, t.warn.key, t.plate.brace], ['Hold RIGHT CLICK to aim - C: brace', 'C: brace', false]);
  assert.equal(navalHudText(model({ armed: false }), keys, { touch: true }).plate.brace, false, 'no guns, no brace to hold');
  // the press
  destroyNavalHud();
  drawNavalHud(model(), { keys, touch: true });
  const [btn] = byClass(globalThis.document.body, 'dfnaval-brace');
  assert.ok(btn, 'the plate\'s Brace');
  assert.equal(btn.style.display, '');
  assert.equal(navalTouchBrace(), false);
  let stopped = 0;
  const ev = () => ({ preventDefault() {}, stopPropagation() { stopped++; } });
  btn.dispatch('touchstart', ev());
  assert.equal(navalTouchBrace(), true, 'held');
  assert.equal(stopped, 1, 'the finger never reaches the look beneath');
  drawNavalHud(model(), { keys, touch: true });
  assert.equal(btn.className, 'dfnaval-brace down');
  btn.dispatch('touchend', ev());
  assert.equal(navalTouchBrace(), false, 'let go');
  btn.dispatch('touchstart', ev());
  drawNavalHud(model(), { keys, touch: true, covered: true });
  assert.equal(navalTouchBrace(), false, 'the plate covered: the press let go');
  drawNavalHud(model(), { keys, touch: true });
  btn.dispatch('touchstart', ev());
  drawNavalHud(model(), { keys });
  assert.equal(btn.style.display, 'none', 'a mouse\'s screen has no such press');
  assert.equal(navalTouchBrace(), false);
  drawNavalHud(model(), { keys, touch: true });
  assert.equal(navalTouchBrace(), false, 'shown again: nothing held');
  btn.dispatch('touchstart', ev());
  destroyNavalHud();
  assert.equal(navalTouchBrace(), false);
  assert.ok(NAVAL_BRACE_H >= 44, 'a finger\'s height');
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-brace \{[^}]*pointer-events: auto; touch-action: none;/, 'pressable through the readout\'s own none');
});

// ── the ram ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Her broadside across my bow (my boat at the origin heading +z), her near side `gap` past my stem: her place. */
function across(h, gap, hull = HULL.SmallShip) {
  frames(h, [[h.e, { pos: [0, 0, 90], yaw: Math.PI / 2 }]]);
  const b = boxOf(h, h.e);
  const ext = Math.abs(b.ax[2]) * b.h[0] + Math.abs(b.ay[2]) * b.h[1] + Math.abs(b.az[2]) * b.h[2];
  return { pos: [0, 0, 90 + hullBuild(hull).bowZ + gap - (b.c[2] - ext)], yaw: Math.PI / 2 };
}

test('AUDIT NAV1 H11 the ram lands: from her own stem (bowZ) within RAM_REACH of the other\'s box, at the way she came in with - the most of the last RAM_MEMORY_S, the collider having taken it at the planking - less the other\'s own way along her course; RAM_DAMAGE a metre a second, BOW_RECOIL times RAM_RECOIL back (half braced); once a stretch; a galley\'s ram from her stem, GALLEY_RAM times, a GALLEY_RAM-th back (mutants: the old point, the way forgotten, her way ignored, the recoil, the cooldown)', async () => {
  const h = await helm();
  const hullOf = () => h.e.ship.damage.hull;
  const mine = () => h.host.hudModel().ship.hull * hullBuild(HULL.SmallShip).hullHp;
  const way = (v) => { h.runtime.state.velocityCurrent = [0, 0, v]; };
  // at her side, lying still: nothing
  const touching = across(h, RAM_REACH / 2);
  way(0);
  frames(h, [[h.e, touching]], 2);
  const full = hullOf();
  assert.equal(hullOf(), full);
  // coming in at 6 m/s, the stem 30 m off her: the way remembered
  way(6);
  frames(h, [[h.e, across(h, 30)]]);
  assert.equal(hullOf(), full, 'not yet');
  // the collider takes the way at her planking - the ram is the way she came in with
  way(0.1);
  frames(h, [[h.e, touching]]);
  const dealt = Math.round(6 * RAM_DAMAGE);
  assert.equal(full - hullOf(), dealt, 'RAM_DAMAGE a metre a second of the way she came in with');
  near(mine(), hullBuild(HULL.SmallShip).hullHp - Math.round(dealt * RAM_RECOIL * BOW_RECOIL), 0.01, 'BOW_RECOIL x RAM_RECOIL back');
  // the way is spent on her: another hull met the next moment is not rammed with it
  const other = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 900 }));
  frames(h, [[h.e, { pos: [0, 0, 400], yaw: 0 }], [other, { pos: [0, 0, 500], yaw: 0 }]], 2);
  frames(h, [[h.e, { pos: [0, 0, 400], yaw: 0 }], [other, touching]]);
  assert.equal(other.ship.damage.hull, other.ship.damage.maxHull, 'the way spent on the first');
  way(6);
  frames(h, [[h.e, touching], [other, { pos: [0, 0, 500], yaw: 0 }]], Math.floor(RAM_COOLDOWN_S * 10) - 5);
  assert.equal(full - hullOf(), dealt, 'once a stretch');
  // just out of reach: nothing
  const h2 = await helm();
  const short = across(h2, RAM_REACH + 0.6);
  h2.runtime.state.velocityCurrent = [0, 0, 6];
  frames(h2, [[h2.e, short]], 3);
  assert.equal(h2.e.ship.damage.hull, h2.e.ship.damage.maxHull, 'her planking out of the stem\'s reach');
  // the way remembered only RAM_MEMORY_S
  h2.runtime.state.velocityCurrent = [0, 0, 6];
  frames(h2, [[h2.e, across(h2, 30)]]);
  h2.runtime.state.velocityCurrent = [0, 0, 0.1];
  frames(h2, [[h2.e, across(h2, 30)]], Math.ceil(RAM_MEMORY_S * 10) + 1);
  frames(h2, [[h2.e, across(h2, RAM_REACH / 2)]]);
  assert.equal(h2.e.ship.damage.hull, h2.e.ship.damage.maxHull, 'a way long spent is no ram');
  // her own way along my course: a ship sailing on ahead takes the difference
  const h3 = await helm();
  frames(h3, [[h3.e, { pos: [0, 0, 90], yaw: 0 }]]);
  const b3 = boxOf(h3, h3.e);
  const ahead = { pos: [0, 0, 90 + hullBuild(HULL.SmallShip).bowZ + RAM_REACH / 2 - (b3.c[2] - b3.h[2])], yaw: 0, speed: 5 };
  h3.runtime.state.velocityCurrent = [0, 0, 6];
  frames(h3, [[h3.e, ahead]], 3);
  assert.ok(6 - 5 < RAM_SPEED);
  assert.equal(h3.e.ship.damage.hull, h3.e.ship.damage.maxHull, 'closing at 1 m/s: a bump');
  // braced, half the recoil
  const h4 = await helm();
  const t4 = across(h4, RAM_REACH / 2);
  h4.runtime.state.velocityCurrent = [0, 0, 6];
  frames(h4, [[h4.e, t4]], 1, { brace: true });
  near(h4.host.hudModel().ship.hull * hullBuild(HULL.SmallShip).hullHp, hullBuild(HULL.SmallShip).hullHp - Math.round(dealt * RAM_RECOIL * BOW_RECOIL * BRACE_TAKEN), 0.01, 'braced for it');
  // a galley's ram, from her own stem 51 m out
  const g = await helm({ hull: HULL.LargeGalley });
  const tg = across(g, RAM_REACH / 2, HULL.LargeGalley);
  g.runtime.state.velocityCurrent = [0, 0, 6];
  frames(g, [[g.e, tg]], 1);
  const gd = Math.round(6 * RAM_DAMAGE * GALLEY_RAM);
  assert.equal(g.e.ship.damage.maxHull - g.e.ship.damage.hull, Math.min(gd, g.e.ship.damage.maxHull), 'GALLEY_RAM times');
  near(g.host.hudModel().ship.hull * hullBuild(HULL.LargeGalley).hullHp, hullBuild(HULL.LargeGalley).hullHp - Math.round(gd * RAM_RECOIL / GALLEY_RAM), 0.01, 'a GALLEY_RAM-th back');
  assert.ok(hullBuild(HULL.LargeGalley).bowZ > 50, 'her stem, where the old point stood 29 m inside it');
});

// ── her hurts in her handling ──────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 H12 her hurts in her handling: Come Sail Away\'s way is the host\'s share of it - under sail BARE_POLES and the rest by the canvas left, under oars full and a wreck\'s WRECKED_OARS; a wreck or a rig shot away refuses the sail with its word, and a rig lost with the canvas set strikes it once, not a line a frame (mutants: the canvas unread, the oars unread, the refusal unsaid, a line a frame)', async () => {
  const h = await helm();
  frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]]);
  assert.equal(h.host.wayScale(true), 1, 'a whole rig, her whole way');
  assert.equal(h.host.wayScale(false), 1);
  assert.equal(h.host.sailRefused(), null);
  // half her canvas shot away
  const bat = { delay: 0, p0: [0, 20, -60], v0: [0, 0, 120], gun: 'chain', index: 0 };
  const rig = rigBoxesOf(h.boat)[0];
  assert.ok(rig, 'her rig');
  let hud = h.host.hudModel();
  const tear = (n) => { for (let i = 0; i < n; i++) h.host._shots.fireVolley({ id: `t${i}${Math.random()}`, shooter: 'x', launches: [{ ...bat, p0: [rig.c[0], rig.c[1], rig.c[2] - 60] }] }); frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]], 12); };
  tear(4);
  hud = h.host.hudModel();
  assert.ok(hud.ship.sail < 1 && hud.ship.sail > 0, `torn (${hud.ship.sail})`);
  near(h.host.wayScale(true), BARE_POLES + (1 - BARE_POLES) * hud.ship.sail, 1e-9, 'the canvas left');
  assert.equal(h.host.wayScale(false), 1, 'the oars pull whatever the rig');
  // the last of it, with the sails set: struck once
  h.runtime.state.sailPosition = 1;
  let lowered = 0;
  h.runtime.LowerSails = () => { lowered++; h.runtime.state.sailPosition = 0; };
  while (h.host.hudModel().ship.sail > 0) tear(4);
  near(h.host.wayScale(true), BARE_POLES, 1e-9, 'bare poles');
  assert.equal(h.host.sailRefused(), 'The rigging is shot away - no sail will set.');
  assert.equal(lowered, 1, 'struck down once');
  const said = h.log.say.filter((t) => t === 'The rigging is shot away - no sail will set.').length;
  frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]], 20);
  assert.equal(h.log.say.filter((t) => t === 'The rigging is shot away - no sail will set.').length, said, 'and never again while they stay down');
  // a wreck: no sail at all, the oars at WRECKED_OARS
  const w = await helm({ save: { v: 1, boats: { 42: { hull: 0, sail: 160, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] } });
  frames(w, []);
  assert.equal(w.host.wayScale(false), WRECKED_OARS);
  assert.equal(w.host.wayScale(true), 0);
  assert.equal(w.host.sailRefused(), 'The ship is crippled - no sail will set.');
  // off the helm, the mod's own
  w.runtime.sailing = false;
  assert.equal(w.host.wayScale(false), 1);
  assert.equal(w.host.sailRefused(), null);
  // the world hands both to Come Sail Away
  const world = src('scenes/world.js');
  assert.match(world, /wayScale: \(underSail\) => naval\?\.wayScale\(underSail\) \?\? 1,/);
  assert.match(world, /sailRefused: \(\) => naval\?\.sailRefused\(\) \?\? null,/);
});

// ── the shipwright, and the mending at sea ─────────────────────────────────────────────────────────────────────────

const hurt = (o = {}) => ({ hull: 262, maxHull: 420, sail: 80, maxSail: 160, crew: 18, maxCrew: 24, ...o });
const SAVE = (boat) => ({ v: 1, boats: { 42: { fire: 0, state: 'afloat', barrels: 4, ...boat } }, notoriety: {}, day: 1, raids: [] });
/** A helm lying at a port's quay: nearPort, the purse and its payments recorded, the yard's window caught. */
async function atPort(o = {}) {
  const h = await helm(o);
  const at = { port: true, purse: o.purse ?? 5000, paid: [], opened: [] };
  const w0 = h.deps.where;
  h.deps.where = () => ({ ...w0(), nearPort: at.port });
  h.deps.gold = () => at.purse;
  h.deps.pay = (n) => { at.paid.push(n); at.purse -= n; };
  h.deps.openYard = (model) => { at.opened.push(model); return true; };
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }]]);
  return { ...h, at };
}

test('AUDIT NAV1 H13 the shipwright: a port\'s yard sells hull, canvas, hands and fire barrels by the piece - as much of each as the purse pays for, never past her whole; MAKE HER WHOLE the four in that order as far as the purse goes; he stands at the helm in a port\'s waters, her way under YARD_SPEED and no hostile near, Activate his door and the plate\'s hint naming him (mutants: a row past her whole, the purse unread, the order, the port unread, her way unread, a hostile unread)', async () => {
  assert.deepEqual(YARD_PRICE, { hull: REPAIR_PRICE.hull, sail: REPAIR_PRICE.sail, crew: REPAIR_PRICE.crew, barrels: BARREL_PRICE });
  // PIN MOVED (TOUGHER-SHIPS): a hull point 7 gold and a yard of canvas 4 (12 and 6 before) - the purse 723, short of her hull
  assert.deepEqual([REPAIR_PRICE.hull, REPAIR_PRICE.sail], [7, 4]);
  const o = yardOffer(hurt(), 1, 723);
  assert.deepEqual(o.rows.map((r) => [r.id, r.missing, r.whole, r.afford, r.cost]), [
    ['hull', 158, 158 * 7, 103, 103 * 7], ['sail', 80, 320, 80, 320], ['crew', 6, 180, 6, 180], ['barrels', 3, 120, 3, 120],
  ]);
  assert.equal(o.whole, 158 * 7 + 320 + 180 + 120);
  assert.deepEqual(yardAll(hurt(), 1, 723), [{ id: 'hull', n: 103, cost: 721 }], 'the hull first, and the purse spent there');
  assert.deepEqual(yardAll(hurt(), 1, 3000).map((p) => p.id), ['hull', 'sail', 'crew', 'barrels']);
  assert.equal(yardAll(hurt(), 1, 3000).reduce((sum, p) => sum + p.cost, 0), o.whole, 'whole, and the change kept');
  assert.deepEqual(yardAll(hurt({ hull: 420, sail: 160, crew: 24 }), 4, 9999), [], 'nothing wanting, nothing bought');
  assert.equal(yardOffer(hurt({ hull: 419.2 }), 4, 100).rows[0].missing, 1, 'a part-mended point is a point bought');
  // the host: at the quay
  const h = await atPort({ save: SAVE({ hull: 120, sail: 60, crew: 20, barrels: 1 }) });
  let m = h.host.hudModel();
  assert.deepEqual(m.board, { name: 'the shipwright', kind: 'yard' });
  assert.equal(navalHudText(m, { board: 'E' }).plate.hint, 'E: the shipwright');
  assert.equal(h.host.activate(), true);
  const model = h.at.opened.at(-1);
  assert.ok(model, 'his window');
  // one row, as far as the purse goes
  h.at.purse = 71 * 7 + 4;   // PIN MOVED (TOUGHER-SHIPS): the yard's prices 7 and 4 a piece
  const hull0 = model.ship().hull;   // her hands have been at it since she came in
  let r = model.buy('hull');
  assert.deepEqual([r.ok, r.n, r.cost], [true, 71, 71 * 7]);
  assert.deepEqual(h.at.paid, [497]);
  near(model.ship().hull, hull0 + 71, 1e-9);
  r = model.buy('sail');
  assert.deepEqual([r.ok, r.n, r.cost], [true, 1, 4], 'the change: one yard of canvas');
  h.at.purse = 3;
  r = model.buy('sail');
  assert.deepEqual([r.ok, r.short], [false, 4], 'short: said, nothing paid');
  assert.deepEqual(h.at.paid, [497, 4]);
  // make her whole
  h.at.purse = 99999;
  r = model.buyAll();
  assert.equal(r.ok, true);
  assert.equal(r.whole, true);
  assert.deepEqual([h.at.paid.length, h.at.paid.at(-1)], [3, r.cost], 'one payment for the whole of it');
  // PIN MOVED (SEA-REPAIR, SHIP-CREW): her stores in the hold and her crew's spirits beside her hurts
  const b2 = hullBuild(HULL.SmallShip);   // PIN MOVED (TOUGHER-SHIPS): her toughened build
  assert.deepEqual(model.ship(), { hull: b2.hullHp, maxHull: b2.hullHp, sail: b2.sailHp, maxSail: b2.sailHp, crew: 24, maxCrew: 24, barrels: 4, wrecked: false, stores: 0, morale: MORALE_START });
  assert.equal(yardOffer(model.ship(), 4, 99999).whole, 0);
  assert.equal(model.hasBarrels, true, 'a Small Ship rolls barrels off her stern');
  // not at a port, under way, or with a hostile near: no yard
  h.at.port = false;
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }]]);
  assert.equal(h.host.hudModel().board, null);
  assert.equal(h.host.activate(), false);
  h.at.port = true;
  h.runtime.state.velocityCurrent = [0, 0, 4];
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }]]);
  assert.equal(h.host.hudModel().board, null, 'under way: she has not lain to his quay');
  h.runtime.state.velocityCurrent = [0, 0, 0];
  const pirate = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 900 }));
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }], [pirate, { pos: [0, 0, 400], yaw: 0 }]]);
  assert.equal(h.host.hudModel().board, null, 'not with a pirate in the offing');
  // the wreck's way out, said
  const w = await atPort({ save: SAVE({ hull: 0, sail: 160, crew: 24, state: 'wrecked' }) });
  w.at.port = false;
  frames(w, [[w.e, { pos: [0, 0, 1500], yaw: 0 }]]);
  assert.equal(navalHudText(w.host.hudModel(), {}).plate.hint, 'Crippled - make port for a shipwright');
  // the world wires the purse, the payment and his window
  const world = src('scenes/world.js');
  assert.match(world, /gold: \(\) => totalGoldAmount\(playerEntity\),\n\s*pay: \(n\) => \{ deductGold\(playerEntity, n\); surfacePlayer\(\); \},\n\s*openYard: \(model\) => navalOpenYard\(model\),/);
  assert.match(world, /const navalClear = \(\) => \{[^\n]*closeNavalYard\(\);/, 'a transition shuts his window');
});

test('AUDIT NAV1 H14 her hands mend her at sea: no hostile ship near and nothing struck her for FIELD_QUIET_S, her hull and canvas come back FIELD_MEND_PER_S of their whole a second times her crew\'s share (FIELD_MEND_ALONE with no crew) up to FIELD_MEND_CAP and never past it, never the hands, never while she burns; a wreck floats again past FIELD_REFLOAT; the plate says MENDING (mutants: the cap, the quiet, a hostile unread, the crew\'s share, the refloat)', async () => {
  // the pure rate
  near(fieldMend(hurt({ hull: 100, sail: 20 }), 1, { crewed: true, crewShare: 1 }).hull, 420 * FIELD_MEND_PER_S, 1e-12);
  near(fieldMend(hurt({ hull: 100, sail: 20 }), 1, { crewed: true, crewShare: 0.5 }).sail, 160 * FIELD_MEND_PER_S * 0.5, 1e-12);
  near(fieldMend(hurt({ hull: 100 }), 1, { crewed: false, crewShare: 0 }).hull, 420 * FIELD_MEND_PER_S * FIELD_MEND_ALONE, 1e-12);
  near(fieldMend(hurt({ hull: 209.9 }), 10, { crewed: true, crewShare: 1 }).hull, 420 * FIELD_MEND_CAP - 209.9, 1e-9, 'to the cap');
  assert.equal(fieldMend(hurt({ hull: 300 }), 10, { crewed: true, crewShare: 1 }).hull, 0, 'past it, nothing');
  // the host: a hurt Small Ship, full crew, nobody near
  const h = await atPort({ save: SAVE({ hull: 84, sail: 16, crew: 24 }) });
  h.at.port = false;
  h.boat.crewed = true;
  const d0 = h.host.hudModel().ship;
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }]], 100);
  const d1 = h.host.hudModel().ship;
  // PIN MOVED (SHIP-CREW): a crewed boat's mending by her crew's spirits (a new crew's, MORALE_START)
  near((d1.hull - d0.hull) * 420, 420 * FIELD_MEND_PER_S * 10 * mendScaleOf(MORALE_START), 0.2, 'ten seconds of mending');
  near((d1.sail - d0.sail) * 160, 160 * FIELD_MEND_PER_S * 10 * mendScaleOf(MORALE_START), 0.1);
  assert.equal(d1.crew, 1, 'hands are hired, not mended');
  assert.equal(d1.mending, true);
  assert.ok(navalHudText(h.host.hudModel(), {}).plate.chips.includes('mend'), 'MENDING on the plate');
  // a pirate in the offing: nothing
  const pirate = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 900 }));
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }], [pirate, { pos: [0, 0, 400], yaw: 0 }]], 20);
  const d2 = h.host.hudModel().ship;
  near(d2.hull, h.host.hudModel().ship.hull, 0);
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }], [pirate, { pos: [0, 0, 400], yaw: 0 }]], 20);
  assert.equal(h.host.hudModel().ship.hull, d2.hull, 'not with a pirate in the offing');
  assert.equal(h.host.hudModel().ship.mending, false);
  // a ball in her: quiet FIELD_QUIET_S first
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }], [pirate, { pos: [0, 0, 5000], yaw: 0 }]], 2);
  const box = hullBoxOf(h.boat, h.pool.models);
  h.host._shots.fireVolley({ id: 'hit', shooter: 'x', launches: [{ delay: 0, p0: [box.c[0] - 30, box.c[1], box.c[2]], v0: [120, 0, 0], gun: 'swivel', index: 0 }] });
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }], [pirate, { pos: [0, 0, 5000], yaw: 0 }]], 5);
  const hitAt = h.host.hudModel().ship.hull;
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }], [pirate, { pos: [0, 0, 5000], yaw: 0 }]], Math.floor(FIELD_QUIET_S * 10) - 20);
  assert.equal(h.host.hudModel().ship.hull, hitAt, 'still quiet');
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }], [pirate, { pos: [0, 0, 5000], yaw: 0 }]], 40);
  assert.ok(h.host.hudModel().ship.hull > hitAt, 'and mending after it');
  // a fire aboard (a save's): never mended while she burns
  const f = await atPort({ save: SAVE({ hull: 200, sail: 60, crew: 24, fire: 10 }) });
  f.at.port = false;
  f.boat.crewed = true;
  frames(f, [[f.e, { pos: [0, 0, 1500], yaw: 0 }]], 5);
  assert.equal(f.host.hudModel().ship.fire, true);
  assert.equal(f.host.hudModel().ship.mending, false, 'the fire first');
  // a wreck: afloat past FIELD_REFLOAT, not before
  const w = await atPort({ save: SAVE({ hull: 0, sail: 160, crew: 24, state: 'wrecked' }) });
  w.at.port = false;
  w.boat.crewed = true;
  const secs = (FIELD_REFLOAT * 420) / (420 * FIELD_MEND_PER_S * mendScaleOf(MORALE_START));   // PIN MOVED (SHIP-CREW): her crew's spirits
  frames(w, [[w.e, { pos: [0, 0, 1500], yaw: 0 }]], Math.floor(secs * 10) - 10);
  assert.equal(w.host.hudModel().ship.wrecked, true, 'a wreck, mending');
  frames(w, [[w.e, { pos: [0, 0, 1500], yaw: 0 }]], 20);
  assert.equal(w.host.hudModel().ship.wrecked, false, 'afloat again');
});

test('AUDIT NAV1 H15 the shipwright\'s window: his words for her - each row what she has, what is wanting at what a piece, its press for all of it or what the purse pays, greyed when it pays for none or she is whole; MAKE HER WHOLE or what the purse pays; the press\'s word under the title; the back key leaves; one window through his own door, warmed (mutants: a row\'s press unwired, the whole press unwired, the note unsaid, a crewless boat\'s hands shown)', async () => {
  let purse = 723;   // PIN MOVED (TOUGHER-SHIPS): short of her hull at 7 gold a point
  const st = { hull: 262, maxHull: 420, sail: 80, maxSail: 160, crew: 18, maxCrew: 24, barrels: 1, wrecked: false };
  const bought = [];
  const model = {
    name: 'Small Ship', hasBarrels: true,
    ship: () => ({ ...st }),
    offer: () => yardOffer(st, st.barrels, purse),
    buy: (id) => { bought.push(id); const r = yardOffer(st, st.barrels, purse).rows.find((x) => x.id === id); if (!r.afford) return { ok: false, id, n: 0, cost: 0, short: r.price }; purse -= r.cost; if (id === 'barrels') st.barrels += r.afford; else st[id] += r.afford; return { ok: true, id, n: r.afford, cost: r.cost }; },
    buyAll: () => { bought.push('all'); const plan = yardAll(st, st.barrels, purse); let cost = 0; for (const p of plan) { cost += p.cost; if (p.id === 'barrels') st.barrels += p.n; else st[p.id] += p.n; } purse -= cost; return { ok: cost > 0, cost, bought: plan, whole: yardOffer(st, st.barrels, purse).whole === 0 }; },
  };
  let t = yardText(model);
  assert.equal(t.title, 'The shipwright');
  assert.equal(t.sub, 'Small Ship - your purse: 723 gold');
  assert.equal(t.lede, 'He will make her whole for 1,726 gold.');
  assert.deepEqual(t.rows.map((r) => [r.label, r.state, r.press, r.can]), [
    ['Hull', '262 of 420 - 158 wanting at 7 gold', 'Mend 103 - 721 gold', true],
    ['Canvas', '80 of 160 - 80 wanting at 4 gold', 'Mend all - 320 gold', true],
    ['Hands', '18 of 24 - 6 wanting at 30 gold', 'Hire all - 180 gold', true],
    ['Fire barrels', '1 aboard - 3 wanting at 40 gold', 'Buy all - 120 gold', true],
  ]);
  assert.equal(t.whole, 'Make good what your purse pays - 721 gold');
  assert.deepEqual(yardNote({ ok: true, id: 'crew', n: 6, cost: 180 }), { text: 'Hands hired: 6 men for 180 gold.', warn: false });
  assert.deepEqual(yardNote({ ok: false, id: 'hull', short: 12 }), { text: 'Not enough gold - 12 gold a piece.', warn: true });
  assert.deepEqual(yardNote({ ok: true, cost: 2676, bought: [{}], whole: true }), { text: 'She is made whole for 2,676 gold.', warn: false });
  // a crewless boat with no stern barrels: no hands, no barrels
  const lb = yardText({ ...model, hasBarrels: false, ship: () => ({ ...st, maxCrew: 0, crew: 0 }) });
  assert.deepEqual(lb.rows.map((r) => r.label), ['Hull', 'Canvas']);
  // mounted
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  let exits = [];
  const view = mountNavalYardWindow(host, { model, onExit: (why) => exits.push(why) });
  const rows = byClass(host, 'dfnaval-yardrow');
  assert.equal(rows.length, 4);
  const buyOf = (id) => byClass(rows.find((r) => r.getAttribute('data-row') === id), 'dfnaval-yardbuy')[0];
  buyOf('crew').dispatch('click', { stopPropagation() {} });
  assert.deepEqual(bought, ['crew']);
  assert.equal(byClass(host, 'dfnaval-note')[0].textContent, 'Hands hired: 6 men for 180 gold.');
  const rows2 = byClass(host, 'dfnaval-yardrow');
  assert.equal(byClass(rows2.find((r) => r.getAttribute('data-row') === 'crew'), 'dfnaval-yardbuy')[0].textContent, 'Whole');
  assert.equal(byClass(rows2.find((r) => r.getAttribute('data-row') === 'crew'), 'dfnaval-yardbuy')[0].disabled, true, 'whole: nothing to press');
  byClass(host, 'dfnaval-whole')[0].dispatch('click', { stopPropagation() {} });
  assert.deepEqual(bought, ['crew', 'all']);
  assert.match(byClass(host, 'dfnaval-note')[0].textContent, /^The yard made good what your purse paid: /);
  keydown('Escape');
  assert.deepEqual(exits, ['close'], 'the back key leaves');
  view.unmount();
  host.remove();
  // his door: one at a time, shut by the host, warmed
  assert.equal(navalYardOpen(), false);
  const a = createNavalYardOverlay({ model });
  assert.ok(a && navalYardOpen());
  const b = createNavalYardOverlay({ model });
  assert.equal(a.done, true, 'one at a time');
  assert.equal(closeNavalYard(), true);
  assert.equal(b.done, true);
  assert.equal(navalYardOpen(), false);
  assert.ok(WARM_CHUNKS.some((f) => String(f).includes('navalYardWindow.js')), 'warmed');
});

// ── heave to, the compass, my own deck afire, my crews' hands ───────────────────────────────────────────────────────

/** A struck merchantman abeam to starboard, within BOARD_RANGE of my Small Ship's side. */
function struckAbeam(h) {
  const beams = hullBuild(HULL.SmallShip).beam * 2;
  const at = { pos: [beams + BOARD_RANGE / 2, 0, 0], yaw: 0 };
  frames(h, [[h.e, at]], 2);
  h.e.ship.damage.apply({ hull: Math.ceil(h.e.ship.damage.maxHull * (1 - STRUCK_AT)) + 1, sail: 0, crew: 0 }, 0);
  assert.equal(h.e.ship.damage.state, SHIP_STATES.struck);
  return at;
}

test('AUDIT NAV1 H16 heave to: a struck ship in reach with the helm too fast to board - the card and the hint say so, and Activate strikes the sails and takes her way off at HEAVE_TO_DECEL (Come Sail Away\'s `brake`, m/s^2 - HELM-WAY: its own number, never a multiple of a rate the Ship handling moves), nothing driving her on, until she is under BOARD_SPEED - then the grapples are the key\'s; HEAVE_TO_S at most, and never for a ship no longer struck (mutants: the refusal silent, the brake unwired, the sails left set, the heave-to held past its end)', async () => {
  const h = await helm();
  const at = struckAbeam(h);
  const name = h.e.ship.names.name;
  h.runtime.state.sailPosition = 1;
  let lowered = 0;
  h.runtime.LowerSails = () => { lowered++; h.runtime.state.sailPosition = 0; };
  h.runtime.state.velocityCurrent = [0, 0, 6];
  frames(h, [[h.e, at]]);
  let m = h.host.hudModel();
  assert.deepEqual(m.board, { name, kind: 'heave', heaving: false });
  const keys = { board: 'E' };
  let t = navalHudText({ ...m, target: { ...m.target, name, state: 'struck' } }, keys);
  assert.equal(t.plate.hint, `E: heave to beside ${name}`);
  assert.equal(t.card.state, 'Colours struck - E: heave to');
  assert.equal(h.host.brake(), 0);
  // the press
  assert.equal(h.host.activate(), true);
  assert.equal(lowered, 1, 'the sails struck');
  assert.match(h.log.say.at(-1), /^Heave to!/);
  assert.equal(h.host.brake(), HEAVE_TO_DECEL, 'her way comes off hard');
  assert.deepEqual([h.host.wayScale(true), h.host.wayScale(false)], [0, 0], 'nothing driving her on');
  frames(h, [[h.e, at]]);
  m = h.host.hudModel();
  assert.equal(m.board.heaving, true);
  t = navalHudText({ ...m, target: { ...m.target, name, state: 'struck' } }, keys);
  assert.equal(t.plate.hint, `Heaving to beside ${name}`);
  assert.equal(t.card.state, 'Colours struck - heaving to');
  // under BOARD_SPEED: done, and the grapples are the key's
  h.runtime.state.velocityCurrent = [0, 0, BOARD_SPEED - 0.5];
  frames(h, [[h.e, at]]);
  assert.equal(h.host.brake(), 0, 'heaved to');
  assert.equal(h.host.hudModel().board.kind, 'board');
  // HEAVE_TO_S at most
  h.runtime.state.velocityCurrent = [0, 0, 6];
  frames(h, [[h.e, at]]);
  h.host.activate();
  frames(h, [[h.e, at]], Math.floor(HEAVE_TO_S * 10) - 2);
  assert.equal(h.host.brake(), HEAVE_TO_DECEL, 'still heaving to');
  frames(h, [[h.e, at]], 4);
  assert.equal(h.host.brake(), 0, 'past HEAVE_TO_S');
  // she is gone from the struck: the heave-to with her
  h.host.activate();
  assert.equal(h.host.brake(), HEAVE_TO_DECEL);
  h.e.ship.damage.scuttle();
  frames(h, [[h.e, at]]);
  assert.equal(h.host.brake(), 0, 'nothing to heave to for');
  // the world hands the brake to Come Sail Away
  assert.match(src('scenes/world.js'), /brake: \(\) => naval\?\.brake\(\) \?\? 0,/);
});

test('AUDIT NAV1 H17 the sea\'s ships on the compass: within COMPASS_SHIP_RANGE, afloat or struck, each marked by what she is to me - hostile, a ship, struck - on the classic box a triangle turned up (never the party\'s or a Detect\'s) in SHIP_MARK_COLORS, on the enhanced strip a pooled mark; none going down, none far, none with the arc off (mutants: the range unread, the kinds merged, the marks never drawn, the triangle the party\'s)', async () => {
  const h = await helm();
  const pirate = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 900 }));
  const struck = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 900 }));
  const far = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 900 }));
  const held = [[h.e, { pos: [300, 0, 0], yaw: 0 }], [pirate, { pos: [0, 0, 500], yaw: 0 }], [struck, { pos: [-400, 0, 0], yaw: 0 }], [far, { pos: [0, 0, -COMPASS_SHIP_RANGE - 50], yaw: 0 }]];
  frames(h, held, 2);
  struck.ship.damage.apply({ hull: Math.ceil(struck.ship.damage.maxHull * (1 - STRUCK_AT)) + 1, sail: 0, crew: 0 }, 0);
  frames(h, held);
  const marks = h.host.compassShips();
  const byPos = (x, z) => marks.find((m) => Math.abs(m.x - x) < 1 && Math.abs(m.z - z) < 1)?.kind;
  assert.equal(byPos(300, 0), 'ship', 'a merchantman');
  assert.equal(byPos(0, 500), 'hostile', 'a pirate');
  assert.equal(byPos(-400, 0), 'struck');
  assert.equal(marks.length, 3, 'the far one is not on it');
  struck.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  frames(h, held);
  assert.equal(h.host.compassShips().length, 2, 'going down: off the compass');
  h.host.setEnabled(false);
  assert.equal(h.host.compassShips(), null);
  // the classic box
  const quads = [];
  const renderer = { drawScreenQuad: (tex, rect, uv, col) => quads.push({ rect, col }) };
  const box = { bx: 500, by: 400, bw: 100, s: 2 };
  assert.equal(drawShipCompassMarks(renderer, [{ x: 0, z: 50, kind: 'hostile' }, { x: 50, z: 0, kind: 'struck' }], [0, 0], 0, box), 2);
  assert.equal(quads.length, 6);
  assert.deepEqual(quads.slice(0, 3).map((q) => q.rect.w), [1 * box.s, 3 * box.s, 5 * box.s], 'the point up: a bow');
  assert.equal(quads[0].col, SHIP_MARK_COLORS.hostile);
  assert.equal(quads[3].col, SHIP_MARK_COLORS.struck);
  const mw = DETECT_MARKER_W * box.s;
  assert.equal(quads[2].rect.x, box.bx + (box.bw - mw) * compassMarkerLerp([0, 50], [0, 0], 0));
  assert.equal(quads[0].rect.y, box.by - DETECT_MARKER_H * box.s, 'over the box\'s top edge');
  assert.equal(drawShipCompassMarks(renderer, null, [0, 0], 0, box), 0);
  const H = src('ui/hud.js');
  assert.match(H, /drawShipCompassMarks\(renderer, ships, playerXZ, heading01, \{ bx, by, bw, s \}\);/);
  assert.match(H, /ships: ships \?\? null,/);
  assert.match(src('scenes/world.js'), /ships: navalOn\(\) && _mode\(\) === 'exterior' \? naval\?\.compassShips\(\) \?\? null : null,/);
  // the enhanced strip
  const mk = () => ({
    className: '', textContent: '', id: '', children: [], dataset: {}, attrs: {},
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(a) { delete this.attrs[a]; }, remove() {},
    append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, replaceChildren(...c) { this.children = c; }, addEventListener() {},
  });
  const findAll = (n, cls, out = []) => { if (String(n.className ?? '').split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) findAll(c, cls, out); return out; };
  const prev = globalThis.document;
  globalThis.document = { createElement: mk, createElementNS: () => mk(), getElementById: () => null, head: mk(), body: mk() };
  const { drawEnhancedHud, destroyEnhancedHud, SHIP_MARK_CSS } = await import('../src/ui/enhancedHud.js');
  const me = { health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null };
  try {
    const frame = (ships) => drawEnhancedHud(me, 0, 0, { weapon: null, weaponSheathed: true, playerXZ: [0, 0], ships });
    frame([{ x: 0, z: 50, kind: 'hostile' }, { x: 50, z: 0, kind: 'ship' }]);
    const root = globalThis.document.body.children.find((n) => n.className === 'hud');
    let ms = findAll(root, 'hud-ship');
    assert.equal(ms.length, 2);
    assert.equal(ms[0].style.borderBottomColor, SHIP_MARK_CSS.hostile);
    assert.equal(ms[1].style.borderBottomColor, SHIP_MARK_CSS.ship);
    assert.ok(ms[0].style.cssText.includes('border-bottom:5px solid'), 'a bow, pointing up');
    assert.equal(ms[0].style.left, `${(compassMarkerLerp([0, 50], [0, 0], 0) * 100).toFixed(1)}%`);
    frame([{ x: 0, z: 50, kind: 'struck' }]);
    ms = findAll(root, 'hud-ship');
    assert.equal(ms.length, 2, 'pooled');
    assert.equal(ms[1].style.display, 'none');
    assert.equal(ms[0].style.borderBottomColor, SHIP_MARK_CSS.struck);
  } finally {
    destroyEnhancedHud();
    globalThis.document = prev;
  }
});

test('AUDIT NAV1 H18 my own deck afire is seen and heard: the flames along her deck with her, the burning loop, the glow among the host\'s lights - put out with the fire; and my gun crews lay by what is left of them: PLAYER_SKILL at a full crew or my own hand, down to PLAYER_SKILL_THIN at none (mutants: my fire unshown, the loop unheard, my glow unlit, the flames left burning, the crew\'s skill fixed)', async () => {
  const flames = [];
  const loops = [];
  const h = await helm();
  h.deps.flame = (pos) => { const f = { pos: [...pos], retired: false, move(p) { this.pos = [...p]; }, retire() { this.retired = true; } }; flames.push(f); return f; };
  h.deps.audio.loop3d = (k, p) => { const l = { k, p: [...p], stopped: false, move(q) { this.p = [...q]; }, stop() { this.stopped = true; } }; loops.push(l); return l; };
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }]]);
  // a fire aboard - a ball's
  const box = hullBoxOf(h.boat, h.pool.models);
  const d = () => h.host.hudModel().ship;
  let tries = 0;
  while (!d().fire && tries++ < 60) {
    h.host._shots.fireVolley({ id: `f${tries}`, shooter: 'x', launches: [{ delay: 0, p0: [box.c[0] - 30, box.c[1] + 2, box.c[2]], v0: [120, 0, 0], gun: 'heavy', index: 0 }] });
    frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }]], 3);
  }
  assert.equal(d().fire, true, 'she burns');
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }]]);
  assert.equal(flames.length, 3, 'a Small Ship burns in three places');
  const deckY = h.boat.GameObject.position[1] + hullBuild(HULL.SmallShip).deck + 1;
  for (const f of flames) near(f.pos[1], deckY, 1e-6, 'on her deck');
  assert.ok(loops.some((l) => l.k === 420 && !l.stopped), 'the burning loop');
  const lit = h.host.lights().filter((l) => l.color && l.range > 0 && Math.abs(l.y - (h.boat.GameObject.position[1] + hullBuild(HULL.SmallShip).deck + 2)) < 1e-6);
  assert.equal(lit.length, 1, 'her glow');
  // she moves: the flames with her
  h.boat.GameObject.position = [5, h.boat.GameObject.position[1], 0];
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }]]);
  assert.ok(flames.every((f) => Math.abs(f.pos[0] - 5) < 1e-6), 'carried');
  // put out
  frames(h, [[h.e, { pos: [0, 0, 1500], yaw: 0 }]], 200);
  assert.equal(d().fire, false);
  assert.ok(flames.every((f) => f.retired), 'the flames out with the fire');
  assert.ok(loops.every((l) => l.stopped), 'and the loop');
  // the crews' hands
  const skillAt = async (crew, crewed) => {
    const g = await helm({ save: SAVE({ hull: 420, sail: 160, crew }) });
    g.boat.crewed = crewed;
    g.view.look = { origin: EYE, dir: [1, -0.05, 0] };
    g.host.attackInput(true);
    frames(g, [[g.e, { pos: [0, 0, 1500], yaw: 0 }]]);
    g.host.attackInput(false);
    return g.host.volleyWire.at(-1).skill;
  };
  assert.equal(await skillAt(24, true), PLAYER_SKILL, 'a full crew');
  near(await skillAt(12, true), PLAYER_SKILL_THIN + (PLAYER_SKILL - PLAYER_SKILL_THIN) * 0.5, 1e-9, 'half of them');
  assert.equal(await skillAt(0, true), PLAYER_SKILL_THIN, 'none left');
  assert.equal(await skillAt(0, false), PLAYER_SKILL, 'a boat that carries none: my own hand');
});
