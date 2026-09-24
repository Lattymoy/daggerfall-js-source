// HT-WAIST-BACK (2026-09-24). Mac, looking at screenshots of the Eye Of The Beholder sprite with HT-WAIST's lantern
// hung at the right hip - visible from the front, the side, walking and behind: "Just have it show on the back of the
// sprite, not all angles. Make sure all the eye of the Beholder sprites get this change."
//
// THE LAW. The lantern's picture is drawn only while the viewer sees the sprite's BACK: the three views of EOTB's
// eight whose record is a back - orientation 4 (the camera straight behind, record +4) and the back diagonals 3 and
// 5 (record +3, the one mirrored) - and never from the front, the front diagonals or the sides (0, 1, 2, 6, 7). The
// numbering is orientationFor's (0 the camera in front, 4 behind) through the wheel [0, 1, 2, 3, 4, 3, 2, 1]; which
// record is a back was read off the vendored art (112364 idle 0-4, walk 5-9, armed walk 20-24; 112372 idle 0-4).
// Unseen, it still HANGS: it swings on, and the local player's light stays at the hip.
//
// EVERY SPRITE: the local body in every on-foot set (player/eotbBody.js) and every other player drawn as the set
// they chose (DISC23-B's walkers, net/peerRiders.js) off their pose's `hl` (HT-WAIST-NET). One home for what the two
// share: player/eotbLantern.js - the rule, the art, the hang, the swing's drive, the batch. The rider and the beast
// hang none (the local sprite's own rule; a walker is never either). A peer's lantern lights nothing.
//
// Driven through the real body (createEotbBody, the eotb_body harness's renderer, an injected art door) and the real
// walker layer (createPeerWalkers over createEotbArt with fakes). The new module is imported dynamically so that on
// the base - where it does not exist - every pin runs and fails at its own assertions rather than at the import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createEotbBody } from '../src/player/eotbBody.js';
import { RECORD_OFFSETS, ORIENTATIONS, orientationFor, stateFor } from '../src/player/eotbBillboard.js';
import { createPeerWalkers, createEotbArt } from '../src/net/peerRiders.js';
import { playerWaistLightOverride, setPlayerWaistLightOverride } from '../src/systems/playerTorch.js';

const L = await import('../src/player/eotbLantern.js').catch(() => ({}));
const KEY = L.LANTERN_ART_KEY ?? 'htwaist-lantern';
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = (ms = 5) => new Promise((res) => setTimeout(res, ms));
const ART = { width: 10, height: 20, colors: new Uint8ClampedArray(800) };
const EIGHT = [0, 1, 2, 3, 4, 5, 6, 7];

function recordingRenderer() {
  return {
    uploads: [], batches: [], draws: [], destroyed: [],
    uploadTexture(archive, rec, img) { this.uploads.push({ archive, rec, img }); },
    createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; this.batches.push(b); return b; },
    destroyBillboardBatch(b) { this.destroyed.push(b); },
    drawBillboards(batches, right, up) { this.draws.push({ list: batches, batch: batches[0], right, up: [...up], origin: [...batches[0].origin], size: { ...batches[0].size } }); },
  };
}
const lanternDraws = (r) => r.draws.filter((d) => d.batch?.archive === KEY);
const lanternBatches = (r) => r.batches.filter((b) => b.archive === KEY);
const lanternFrees = (r) => r.destroyed.filter((b) => b.archive === KEY);

/** The camera for view `o` of a figure facing +Z at `feet`: 2 m out along [sin 45o, 0, cos 45o] (orientationFor's
 *  own wheel - 0 in front, 4 behind), looking back at it. */
function cameraFor(o, feet) {
  const a = o * Math.PI / 4, tc = [Math.sin(a), 0, Math.cos(a)];
  const yaw = Math.atan2(-tc[0], -tc[2]);
  return { eye: [feet[0] + 2 * tc[0], feet[1] + 1.5, feet[2] + 2 * tc[2]], yaw, right: [Math.cos(yaw), 0, -Math.sin(yaw)] };
}

// ── the local body ────────────────────────────────────────────────────────────────────────────────────────────────
async function liveBody() {
  const r = recordingRenderer();
  const b = createEotbBody({
    count: () => 3035, urlFor: (k) => `/art/${k}.png`,
    decode: async () => ({ width: 53, height: 110, colors: new Uint32Array(53 * 110) }),
    loadLantern: async () => ART,
  });
  b.attach(r, () => ({}));
  await settle();
  b.toggle(true, false);
  return { b, r };
}
const bodyState = (cam, extra = {}, motion = {}) => ({ motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8, ...motion }, feet: [0, 0, 0], yaw: cam.yaw, cameraPos: cam.eye, ...extra });
const ticks = (b, n, s, dt = 1 / 60) => { for (let i = 0; i < n; i++) b.tick(dt, s); };
/** a step away from a camera behind (the body faces +Z, sheathed - the IL keeps that facing), then the lantern lit */
async function facingAwayLit(b) {
  const behind = cameraFor(4, [0, 0, 0]);
  ticks(b, 12, bodyState(behind, {}, { forward: 1, standing: false, speed: 5 }));
  ticks(b, 12, bodyState(behind, { hipLantern: true }));
  for (let i = 0; i < 4; i++) { b.draw(null, { eye: behind.eye, feet: [0, 0, 0], yaw: behind.yaw }); await settle(2); }
}
/** stand the camera at view `o` long enough for the orientation clock and the delayed repaint, then draw */
function viewFrom(b, o, extra = {}, motion = {}) {
  const cam = cameraFor(o, [0, 0, 0]);
  ticks(b, 12, bodyState(cam, { hipLantern: true, ...extra }, motion));
  return b.draw(null, { eye: cam.eye, feet: [0, 0, 0], yaw: cam.yaw });
}

test('HT-WAIST-BACK rule: the rear views are 3, 4 and 5 - the three whose record is the sprite\'s back (+3, +4) on EOTB\'s wheel; 0, 1, 2, 6, 7 are not, and nothing that is not an orientation is (mutants: a side view let in; a back diagonal left out)', () => {
  assert.equal(typeof L.isRearView, 'function', 'player/eotbLantern.js isRearView - the one rule every EOTB sprite asks');
  assert.deepEqual(EIGHT.filter((o) => L.isRearView(o)), [3, 4, 5], 'straight behind and the two back diagonals');
  // the rule IS the wheel's: a view is a rear view exactly when the record it draws is +3 or +4
  for (const o of EIGHT) assert.equal(L.isRearView(o), RECORD_OFFSETS[o] >= 3, `orientation ${o} draws record +${RECORD_OFFSETS[o]}`);
  assert.deepEqual(EIGHT.map((o) => stateFor('Move', o).record - stateFor('Move', 0).record), [0, 1, 2, 3, 4, 3, 2, 1], 'the wheel, as the tables draw it');
  assert.equal(L.REAR_RECORD, 3, 'the back three-quarter is the first back record');
  // and orientationFor's numbering, the geometry the rule is read against: a figure facing +Z, the camera round it
  const facing = [0, 0, 1];
  const at = (deg) => [Math.sin(deg * Math.PI / 180), 0, Math.cos(deg * Math.PI / 180)];
  assert.equal(orientationFor(facing, at(0)), 0, 'the camera in front: 0');
  assert.equal(orientationFor(facing, at(180)), 4, 'the camera straight behind: 4');
  assert.deepEqual([orientationFor(facing, at(135)), orientationFor(facing, at(225))], [3, 5], 'the back diagonals');
  assert.deepEqual([orientationFor(facing, at(90)), orientationFor(facing, at(270))], [2, 6], 'the sides');
  for (const junk of [undefined, null, NaN, 3.5, '4']) assert.equal(L.isRearView(junk), false, `${String(junk)}: not a view`);
  assert.equal(L.isRearView(12), true, 'the wheel wraps (12 is 4)');
  assert.equal(ORIENTATIONS, 8);
});

test('HT-WAIST-BACK (your sprite): the camera swung round the body - the lantern is DRAWN from 3, 4 and 5 and from none of 0, 1, 2, 6, 7; from the front and the side it still hangs and lights you from the hip, and its batch is kept, never re-minted per turn (mutants: the body never asks the rule; the light and the batch dropped off the back)', async () => {
  setPlayerWaistLightOverride(null);
  try {
    const { b, r } = await liveBody();
    await facingAwayLit(b);
    const drawnAt = [];
    for (const o of [...EIGHT, 4, 0, 4]) {
      const before = lanternDraws(r).length;
      viewFrom(b, o);
      assert.equal(b.state().shown.orientation, o, `the sprite is painted from view ${o}`);
      const drew = lanternDraws(r).length > before;
      if (drew && !drawnAt.includes(o)) drawnAt.push(o);
      assert.equal(b.state().lantern?.shown, drew, `view ${o}: the seam says what was drawn`);
      assert.equal(b.state().lantern?.hangs, true, `view ${o}: it hangs whatever the view`);
      assert.ok(playerWaistLightOverride(), `view ${o}: and lights you from where it hangs`);
      if (!L.isRearView?.(o)) assert.equal(drew, false, `view ${o} is not the back: no lantern`);
    }
    assert.deepEqual(drawnAt.sort(), [3, 4, 5], 'the back, and only the back');
    assert.equal(lanternBatches(r).length, 1, 'one batch, minted at the first rear view - kept while the lantern hangs, not re-minted each time the sprite turns its back');
    assert.equal(lanternFrees(r).length, 0, 'and never freed by a turn to the front');
  } finally { setPlayerWaistLightOverride(null); }
});

test('HT-WAIST-BACK (your sprite): unseen, it SWINGS ON - walking toward the camera (the front view) nothing is drawn but the swing runs, and turning the back to the eye shows it already swinging, not snapped plumb (mutant: the swing reset whenever it is not drawn)', async () => {
  const { b, r } = await liveBody();
  await facingAwayLit(b);
  // walk toward the camera: the sprite faces it (view 0), the lantern lags behind the walk
  const front = cameraFor(4, [0, 0, 0]);
  const before = lanternDraws(r).length;
  ticks(b, 20, bodyState(front, { hipLantern: true }, { forward: -1, standing: false, speed: 5 }));
  b.draw(null, { eye: front.eye, feet: [0, 0, 0], yaw: front.yaw });
  assert.equal(b.state().shown.orientation, 0, 'walking at the camera: the front');
  assert.equal(lanternDraws(r).length, before, 'from the front: not drawn');
  const sw = b.state().lantern.swing;
  assert.ok(Math.abs(sw.fore) > 0.05 || Math.abs(sw.side) > 0.05, `but it swings (${JSON.stringify(sw)})`);
  // turn round and walk away: the first rear frame shows a lantern in mid-swing
  ticks(b, 12, bodyState(front, { hipLantern: true }, { forward: 1, standing: false, speed: 5 }));
  b.draw(null, { eye: front.eye, feet: [0, 0, 0], yaw: front.yaw });
  assert.equal(b.state().shown.orientation, 4);
  const d = lanternDraws(r).at(-1);
  assert.ok(d && lanternDraws(r).length > before, 'seen from behind again: drawn');
  assert.ok(d.size.h < L.HIP_LANTERN_SPRITE.height - 1e-3 || Math.abs(d.up[0]) > 1e-3, 'still swinging - not a plumb, full-length lantern');
});

// ── the peers ─────────────────────────────────────────────────────────────────────────────────────────────────────
function peerRig() {
  const renderer = recordingRenderer();
  let asked = 0;
  const art = createEotbArt({
    renderer, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }),
    loadLantern: async () => { asked++; return ART; },
  });
  return { renderer, art, asked: () => asked };
}
const FEET = [4, 0, 9];
const toScene = (p) => [p.x, p.y, p.z];
const pose = (o = {}) => ({ x: FEET[0], y: FEET[1], z: FEET[2], yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, ...o });
const walker = (o = {}, id = 'p1') => ({ id, look: { eo: 2 }, shown: pose(o) });
/** one frame of the layer from view `o`, the host's two calls: the sync, then the lanterns in the bodies' hook */
function frame(w, peers, o, dt = 1 / 60) {
  const cam = cameraFor(o, FEET);
  w.sync(peers, toScene, { eye: cam.eye, right: cam.right, dt });
  return w.drawLanterns?.() ?? 0;
}

test('HT-WAIST-BACK (the others): a walker whose pose says `hl` hangs THE SAME lantern - Daggerfall\'s picture through the same loader, uploaded once under the same key, hung by the same law - DRAWN from their back only (3, 4, 5), each on its own tilted basis; it lights nothing; without `hl`, nothing at all (mutants: the walker never hangs it; the rule not asked; the bit ignored; the picture asked twice)', async () => {
  setPlayerWaistLightOverride(null);
  try {
    const { renderer, art, asked } = peerRig();
    const w = createPeerWalkers({ art });
    // no lantern at the waist: nothing of it runs
    frame(w, [walker()], 4); await settle(); frame(w, [walker()], 4); await settle();
    assert.equal(w.isWalking('p1'), true, 'the walker stands');
    assert.equal(asked(), 0, 'no `hl`: the picture is not asked for');
    assert.equal(lanternBatches(renderer).length, 0, 'and no batch minted');
    // lit at the waist: three frames while the picture is on its way - one ask, coalesced (ASYNC NEVER DROPS)
    for (let i = 0; i < 3; i++) frame(w, [walker({ hl: 1 })], 4);
    await settle(); frame(w, [walker({ hl: 1 })], 4);
    assert.equal(asked(), 1, 'the picture asked once, through the loader the local body takes - not once a frame while it loads');
    const drawnAt = [];
    for (const o of [...EIGHT, 4]) {
      const before = lanternDraws(renderer).length;
      const n = frame(w, [walker({ hl: 1 })], o);
      if (lanternDraws(renderer).length > before) { if (!drawnAt.includes(o)) drawnAt.push(o); assert.equal(n, 1); }
    }
    assert.deepEqual(drawnAt.sort(), [3, 4, 5], 'from their back, and only their back - the local sprite\'s rule');
    assert.equal(asked(), 1, 'asked once, however many frames (ASYNC NEVER DROPS - coalesced, never re-asked)');
    assert.deepEqual(renderer.uploads.filter((u) => u.archive === KEY).map((u) => [u.rec, u.img.width, u.img.height]), [[0, 10, 20]], 'uploaded once, under the local body\'s key');
    // the hang is the local body's law: the same function, fed this walker's sprite
    frame(w, [walker({ hl: 1 })], 4);
    const d = lanternDraws(renderer).at(-1);
    const r = w.walkers.get('p1');
    const cam = cameraFor(4, FEET);
    const same = L.hangSpriteLantern(L.createSpriteLantern(), r.batch.origin, r.size.h, 0, 1, cam.eye, FEET, cam.yaw, 1, { w: 10, h: 20 });
    assert.deepEqual(d.origin.map((v) => +v.toFixed(9)), same.origin.map((v) => +v.toFixed(9)), 'hung where the local body\'s law hangs it');
    assert.deepEqual(d.size, { w: same.w, h: same.h });
    const top = [d.origin[0] + d.up[0] * d.size.h, d.origin[1] + d.up[1] * d.size.h];
    assert.ok(top[0] > r.batch.origin[0] + 0.15, 'at the sprite\'s right hip (+X, facing +Z)');
    assert.ok(Math.abs(top[1] - (r.batch.origin[1] + r.size.h * 0.5)) < 1e-9, 'half the sprite up');
    assert.equal(playerWaistLightOverride(), null, 'a peer\'s lantern lights nothing - the waist light is the local player\'s alone');
    // put out: gone
    const drawn = lanternDraws(renderer).length;
    assert.equal(frame(w, [walker()], 4), 0);
    assert.equal(lanternDraws(renderer).length, drawn, 'put out: not drawn');
  } finally { setPlayerWaistLightOverride(null); }
});

test('HT-WAIST-BACK (the others): the lantern swings off the WALKER\'s own motion - its pace off the drawn feet (MWBODY1\'s law, net/peerPace.js), its yaw\'s turn, its walk clip: walking off it lags back as the local body\'s does, a jump is not a sprint, standing it hangs plumb, and a swing across the view is drawn as a tilt on its own basis (mutants: the pace not measured; the swing not stepped; drawn untilted)', async () => {
  const { art } = peerRig();
  const w = createPeerWalkers({ art });
  const p = walker({ hl: 1 });
  frame(w, [p], 4); await settle(); frame(w, [p], 4);
  const r = w.walkers.get('p1');
  assert.ok(r.lantern, 'the walker hangs a lantern of its own');
  assert.deepEqual([r.lantern.swing.fore, r.lantern.swing.side], [0, 0], 'standing: plumb');
  // walking off along its facing at 5 m/s, the pose's move bit set: the drawn feet move
  p.shown.mv = 1;
  let fore = 0;
  for (let i = 0; i < 20; i++) {
    p.shown.z += 5 / 60;
    frame(w, [p], 4);
    fore = Math.min(fore, r.lantern.swing.fore);
  }
  assert.ok(r.pace > 1, `the pace measured off the drawn pose (${r.pace})`);
  assert.ok(fore < -0.05, `a walk begun: it lags back (${fore})`);
  // a jump (a snap, a recenter missed) resets the pace rather than reading as a sprint - MWBODY1's own rule
  p.shown.z += 50;
  frame(w, [p], 4);
  assert.equal(r.pace, 0, 'a jump: the pace resets');
  assert.equal(typeof (await import('../src/net/peerPace.js').catch(() => ({}))).stepPeerPace, 'function', 'the pace law is net/peerPace.js\'s');
  // turning on the spot swings it outward
  p.shown.mv = 0;
  for (let i = 0; i < 400; i++) frame(w, [p], 4);
  assert.ok(Math.abs(r.lantern.swing.fore) < 0.01 && Math.abs(r.lantern.swing.side) < 0.01, 'stood a while: plumb again');
  let side = 0;
  for (let i = 0; i < 20; i++) { p.shown.yaw += 4 / 60; frame(w, [p], 4); side = Math.max(side, Math.abs(r.lantern.swing.side)); }
  assert.ok(side > 0.01, `a turn on the spot pulls it outward (${side})`);
  // a swing across the view plane is DRAWN as a tilt - the quad on the lantern's own basis, as the local body's is
  p.shown.yaw = 0;
  for (let i = 0; i < 400; i++) frame(w, [p], 4);
  r.lantern.swing.side = 0.3;
  frame(w, [p], 4);
  const d = lanternDraws(art.renderer).at(-1);
  assert.ok(Math.abs(d.up[0]) > 0.1, `seen from behind, a sideways swing tilts the quad (${d.up})`);
  assert.deepEqual(d.up, [...r.lantern.up], 'on the basis the hang wrote');
});

test('HT-WAIST-BACK (the others): EVERY ALLOCATION HAS AN OWNER - the lantern\'s batch is freed when it is put out, when the walker goes, when the walker stops being one (the saddle, a Morrowind body here) and when the layer is destroyed; the recentre carries it; the draw path builds nothing (mutants: the drop leaks it; put out, left minted; the recentre leaves it behind; a list built per draw)', async () => {
  const { renderer, art } = peerRig();
  const w = createPeerWalkers({ art });
  const lit = walker({ hl: 1 });
  frame(w, [lit], 4); await settle(); frame(w, [lit], 4);
  const minted = () => lanternBatches(renderer).length, freed = () => lanternFrees(renderer).length;
  assert.equal(minted(), 1, 'minted at the first sight of their back');
  // the draw path: the same one-element list and the same basis arrays, frame after frame
  frame(w, [lit], 4);
  const [a, b2] = lanternDraws(renderer).slice(-2);
  assert.equal(a.list, b2.list, 'one list, kept'); assert.equal(a.right, b2.right, 'one basis, written in place');
  // seen from the front: kept, not freed
  frame(w, [lit], 0);
  assert.equal(freed(), 0, 'turned to face me: undrawn, still owned');
  // the recentre carries it with the sprite
  const r = w.walkers.get('p1');
  const o0 = [...r.lantern.batch.origin];
  w.offsetAll([10, 0, -3]);
  assert.deepEqual(r.lantern.batch.origin.map((v) => +v.toFixed(9)), [o0[0] + 10, o0[1], o0[2] - 3].map((v) => +v.toFixed(9)), 'the origin shift moves it as it moves the sprite');
  // put out
  frame(w, [walker()], 4);
  assert.equal(freed(), 1, 'put out: freed'); assert.equal(r.lantern, null);
  // lit again, then the walker gone from the room
  frame(w, [lit], 4);
  assert.equal(minted(), 2);
  frame(w, [], 4);
  assert.equal(freed(), 2, 'the walker gone: its lantern with it');
  // lit again, then in the saddle (the riders' layer's, not a walker)
  frame(w, [lit], 4); frame(w, [lit], 4);
  frame(w, [walker({ hl: 1, rd: 1 })], 4);
  assert.equal(freed(), 3, 'mounted: no longer a walker, no lantern');
  // lit again, then standing in a Morrowind body on this screen
  frame(w, [lit], 4); frame(w, [lit], 4);
  w.sync([lit], toScene, { eye: cameraFor(4, FEET).eye, right: cameraFor(4, FEET).right, dt: 1 / 60, skip: () => true });
  assert.equal(freed(), 4, 'a Morrowind body stands for them: the sprite\'s lantern goes');
  // lit again, then the layer destroyed
  frame(w, [lit], 4); frame(w, [lit], 4);
  w.destroy();
  assert.equal(freed(), 5, 'the layer destroyed: every lantern freed');
  assert.equal(w.drawLanterns(), 0, 'and nothing left to draw');
  assert.equal(minted(), freed(), 'every batch minted was freed');
});

test('HT-WAIST-BACK: ONE HOME - your sprite and the walkers hang it through player/eotbLantern.js and neither keeps its own rule, hang, swing drive or art door; the host draws the walkers\' lanterns in the hook every mode\'s pass calls after your body; the pace is net/peerPace.js\'s (mutants: a second copy; the host never draws them)', () => {
  const lantern = rd('src/player/eotbLantern.js');
  const body = rd('src/player/eotbBody.js');
  const riders = rd('src/net/peerRiders.js');
  for (const [name, src] of [['eotbBody.js', body], ['peerRiders.js', riders]]) {
    assert.match(src, /from '(?:\.|\.\.\/player)\/eotbLantern\.js';/, `${name} takes the lantern from its one home`);
    for (const fn of ['isRearView', 'createLanternArt', 'createSpriteLantern', 'stepSpriteLantern', 'spriteStride', 'hangSpriteLantern', 'mintSpriteLantern', 'dropSpriteLantern']) {
      assert.match(src, new RegExp(`\\b${fn}\\(`), `${name} calls ${fn}`);
    }
    for (const copy of [/lanternSwingDown\(/, /stepLanternSwing\(/, /HIP_LANTERN_SPRITE\s*=/, /RECORD_OFFSETS\[/, /\.uploadTexture\(LANTERN_ART_KEY/, /templateByIndex\(LANTERN_TEMPLATE\)/]) {
      assert.doesNotMatch(src, copy, `${name} carries no copy of the shared law (${copy})`);
    }
  }
  for (const once of [/export function isRearView\(/, /export const HIP_LANTERN_SPRITE = /, /lanternSwingDown\(/, /export async function loadLanternArt\(/]) {
    assert.equal(lantern.match(new RegExp(once.source, 'g'))?.length, 1, `eotbLantern.js states ${once} once`);
  }
  // the host: the bodies' hook - world.js's exterior pass calls it, and worldModes' dungeon and interior passes reach it
  const world = rd('src/scenes/world.js');
  assert.match(world, /const drawPeerBodies = \(proj, view, eye\) => \{ if \(peerBodies\) peerBodies\.draw\(canvas, \{ proj, view, eye \}\); peerWalkers\?\.drawLanterns\(\); \};/);
  assert.match(world, /mwViewDrawBody\([^\n]*\n\s*drawPeerBodies\(proj, view, mwv\.eye\);/, 'the exterior pass: right after the player\'s own body');
  assert.equal(rd('src/scenes/worldModes.js').match(/mwViewDrawBody\([^\n]*\n\s*host\.drawPeerBodies\?\.\(\{ proj, view, eye: mwv\.eye \}\);/g)?.length, 2, 'the dungeon and the interior passes: the same hook');
  // the pace: one law, two readers
  const pace = rd('src/net/peerPace.js');
  assert.match(pace, /export const JUMP_UNITS = 5;/);
  for (const [name, src] of [['peerBodies.js', rd('src/net/peerBodies.js')], ['peerRiders.js', riders]]) {
    assert.match(src, /stepPeerPace\(/, `${name} reads the pace through net/peerPace.js`);
    assert.doesNotMatch(src, /\* 0\.8 \+ \(d \/ dt\) \* 0\.2/, `${name} keeps no copy of it`);
  }
});

test('HT-WAIST-BACK: recorded - the HT-WAIST sections of Handheld-Torches.md and Eye-Of-The-Beholder.md carry the dated HT-WAIST-BACK note (the rear views, the peers, the one home), and the Ledger A row\'s EOTB clause says the back; the all-angles sentence is gone (mutant: the record left saying it hangs in every view)', () => {
  const ht = rd('bible/06-Systems/Handheld-Torches.md');
  const hts = ht.slice(ht.indexOf('## HT-WAIST - THE LANTERN AT THE WAIST'));
  assert.match(hts, /HT-WAIST-BACK \(2026-09-24/);
  assert.match(hts, /orientation 4[^.]*3[^.]*5|3, 4 (?:and|or) 5/);
  assert.match(hts, /player\/eotbLantern\.js/);
  assert.match(hts, /createPeerWalkers|walkers/);
  const eo = rd('bible/06-Systems/Eye-Of-The-Beholder.md');
  const eos = eo.slice(eo.indexOf('## HT-WAIST (2026-09-24)'));
  assert.match(eos, /HT-WAIST-BACK \(2026-09-24/);
  assert.match(eos, /isRearView/);
  assert.match(eos, /112364/, 'the numbering verified against the vendored art, and said where');
  assert.doesNotMatch(eos, /\*\*Only\*\* in third person, on foot, alive and in your own form - the rider/, 'the old "only" line, which said nothing of the view, is rewritten');
  const row = rd('bible/01-Overview/Port-Ledger.md').split('\n').find((l) => l.startsWith('|') && /\(HT-WAIST, 2026-09-24/.test(l));
  assert.ok(row, 'HT-WAIST\'s Ledger A row');
  assert.match(row, /HT-WAIST-BACK/);
  assert.match(row, /from behind|its back/);
  assert.match(row, /test\/htwaistback\.test\.js/);
});
