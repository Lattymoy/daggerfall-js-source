// ═══ AUDIT-EOTB2 (2026-09-16) → EOTB-IL (2026-09-17): THE INTEGRATION ═══
//
// Mac: "Do an audit on eye of the beholder. Ensure its integrated 1:1.
// No half assed work." Then, with the shipped archive in hand: "it
// needs to be 1:1 with the uploaded file. No exceptions."
//
// AUDIT-EOTB2 wired the body through the only path a player has
// (`mwViewFrame`) and, with the assembly out of reach, read sixteen
// members off the settings' labels and marked them [SETTINGS]. EOTB-IL
// read the assembly. Every [SETTINGS] law is gone from the tree; the
// pins below drive the same integration against the IL's own laws,
// and the ones AUDIT-EOTB2 got wrong say so where they are corrected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEotbBody, eotbBody, MATERIAL, FOOTSTEP_VOLUME_SCALE } from '../src/player/eotbBody.js';
import { eotbCamera, createEotbCamera, readCameraSettings, AUTO_TOGGLE_MESSAGES } from '../src/player/eotbCamera.js';
import { STRING, frameCount, AUTO_TOGGLE, TABLE_FRAMES } from '../src/player/eotbBillboard.js';
import { getMeleeWeaponAnimTime } from '../src/characters/weaponStates.js';
import { worldOrderColors, flipRows } from '../src/player/eotbSprite.js';
import { toColor32 } from '../src/formats/color32Order.js';
import {
  mwViewFrame, mwViewFootstep, mwViewHides, mwViewTransition, mwViewLoadPose, mwViewNewGame, mwViewRebase, mwViewPendingClicks,
  setEotbBodyReady, setEotbDrawBody, setEotbPlayerState, eotbLane,
} from '../src/player/mwView.js';
import { mwCamera } from '../src/player/mwCamera.js';
import { FootstepMachine, FOOTSTEP_VOLUME } from '../src/systems/footsteps.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { domCodeForKeyCode } from '../src/systems/keyCodes.js';
import { motionBagOf } from '../src/player/motor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const MOD = 'eye-of-the-beholder';

const renderer = () => ({
  uploads: [], batches: [],
  uploadTexture(archive, rec, img) { this.uploads.push({ archive, rec, img }); },
  createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; this.batches.push(b); return b; },
  destroyBillboardBatch() {},
  drawBillboards() {},
});
/** A body with art present and an instant decode, active in third person. */
async function liveBody(over = {}) {
  const r = renderer();
  const b = createEotbBody({
    count: () => 3035, urlFor: (k) => `/art/${k}.png`,
    decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }),
    ...over,
  });
  b.attach(r, () => ({}));
  await new Promise((res) => setTimeout(res, 5));
  b.toggle(true, false);
  return { b, r };
}
const walk = (extra = {}) => ({ motion: { forward: 1, standing: false, speed: 3, grounded: true, height: 1.8 }, feet: [0, 0, 0], yaw: 0, cameraPos: [0, 1.5, -2], liveSpeed: 50, ...extra });
const still = (extra = {}) => ({ motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 0, 0], yaw: 0, cameraPos: [0, 1.5, -2], liveSpeed: 50, ...extra });
const ticks = (b, n, state, dt = 1 / 60) => { for (let i = 0; i < n; i++) b.tick(dt, state); };
const tickSeconds = (b, seconds, state, step = 1 / 60) => { for (let t = 0; t < seconds; t += step) b.tick(step, state); };

/** The seam as a fresh session has it, the lane OPEN. */
function openLane() {
  _resetModSettings();
  setEotbBodyReady(() => true);
  setEotbDrawBody(null);
  setEotbPlayerState(null);
  mwCamera.restore({ firstPerson: true, baseDistance: mwCamera.baseDistance() });
  eotbCamera.loadSettings(null);
  eotbCamera.toggleOffset(false);
  for (let i = 0; i < 4 && mwViewPendingClicks(); i++) mwViewFrame({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0 });
  assert.equal(eotbLane(), true, 'the lane is open for these pins');
}
const closeLane = () => { setEotbBodyReady(null); setEotbPlayerState(null); eotbCamera.toggleOffset(false); eotbBody.attach(null, null); _resetModSettings(); };

// ─────────────────────────────────────────────────────────────────
// THE STATE - one home, and the seam carries it whole
// ─────────────────────────────────────────────────────────────────

test('EOTB-IL: THE STATUE WALKS - through the seam, the rig\'s record drives the table, the death and the saddle', () => {
  openLane();
  try {
    const rend = renderer();
    eotbBody.attach(rend, () => ({}));
    // attach re-arms the gate on the body's own `ready()` (the first
    // sprite's decode, a fetch here) - hold the lane open for the pin
    setEotbBodyReady(() => true);
    eotbCamera.toggleOffset(true);
    const eye = { fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1 / 60 };
    setEotbPlayerState(() => ({ sheathed: false, motion: { forward: 1, standing: false, speed: 3, grounded: true } }));
    mwViewFrame(eye);
    assert.equal(eotbBody.state().table, 'MoveMelee', 'walking with a drawn weapon: the MoveMelee table, not Idle');
    setEotbPlayerState(() => ({ sheathed: true, motion: { forward: 0, standing: true } }));
    mwViewFrame(eye);
    assert.equal(eotbBody.state().table, 'Idle');
    setEotbPlayerState(() => ({ motion: { forward: 1, running: true, riding: true, standing: false, speed: 12 } }));
    mwViewFrame({ ...eye, riding: true });
    assert.equal(eotbBody.state().table, 'GallopHorse', 'the hosts\' riding and a horse\'s speed: a gallop');
    setEotbPlayerState(() => ({ motion: { forward: 1, riding: true, standing: false, speed: 7.6 } }));
    mwViewFrame({ ...eye, riding: true });
    assert.equal(eotbBody.state().table, 'MoveHorse', 'the cart\'s speed: a walk');
    setEotbPlayerState(() => ({ died: true }));
    mwViewFrame(eye);
    assert.equal(eotbBody.state().clip?.table, 'Death', 'dead: the Death clip, frozen');
    assert.equal(eotbBody.state().died, true);
    // the camera handed the body the frame's eye
    assert.deepEqual(eotbBody.state().last.stopped, true);
  } finally { closeLane(); }
});

test('EOTB-IL: the rig registers the WHOLE record - the motion bag and what LateUpdate polls off DFU - and the bag carries what PlayerMotor is read for', () => {
  const rig = rd('src/combat/weaponRig.js');
  const reg = /const eotbState = \(\) => \(\{([\s\S]*?)\}\);\s*\n\s*const bindBody = \(\) => eotbBody\.attach\(renderer, eotbState\);/.exec(rig);   // MAC-O3: the thunk is named so the frame can re-claim it
  assert.ok(reg, 'the one registration');
  for (const f of ['weaponReady:', 'sheathed: playerWeapon.sheathed', 'spellcasting: spellArmed()', 'usingBow: !!playerWeapon.machine.isBow',
    'transformed: !!entity && isTransformedLycanthrope(entity)', 'lycanthropyType:', 'died: !!entity && (entity.health ?? 1) <= 0', 'motion: camera?.()?.move ?? null',
    'attacking: playerWeapon.machine.state !== \'Idle\'', 'castPlaying: !!fpsSpellCasting.isPlayingAnim', 'bowDrawback: getBool(\'Controls\', \'BowDrawback\')',
    'swingHeld: _held', 'liveSpeed: entity ? liveStat(entity, \'speed\') : 50', 'concealment: entity ? concealmentFlags(entity) : null']) {
    assert.ok(reg[1].includes(f), `the record carries ${f}`);
  }
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(h), /move: (?:motionBagOf\(player\)|_fpMove)/, `${h}: the thunk carries the bag`);
  }
  // the bag: the sneak, FreezeMotor, OnExteriorWater == Swimming, the live capsule height
  const bag = motionBagOf({ moveForward: 1, isSneaking: true, freezeMotor: 0.2, onExteriorWater: true, height: 0.9, grounded: true });
  assert.equal(bag.sneaking, true);
  assert.equal(bag.freeze, 0.2);
  assert.equal(bag.onExteriorWater, true);
  assert.equal(bag.height, 0.9);
});

// ─────────────────────────────────────────────────────────────────
// THE ONE-SHOTS [IL]
// ─────────────────────────────────────────────────────────────────

test('EOTB-IL: a swing plays the six-frame AttackMelee at GetMeleeAnimTickTime, started by IsAttacking, once, and the loop resumes', async () => {
  _resetModSettings();
  setModSetting(MOD, 'Graphics.AttackStrings', STRING.None);
  const { b } = await liveBody();
  ticks(b, 12, walk({ sheathed: false }));
  assert.equal(b.state().table, 'MoveMelee');
  b.tick(1 / 60, walk({ sheathed: false, attacking: true }));
  const clip = b.state().clip;
  assert.ok(clip, 'IsAttacking starts the clip (IL_3eee-IL_3f3b)');
  assert.equal(clip.table, 'AttackMelee');
  assert.deepEqual(clip.frames, [0, 1, 2, 3, 4, 5], 'the art\'s six frames, forward');
  const animTime = getMeleeWeaponAnimTime(50);
  assert.equal(clip.interval, animTime * 5 / 6, 'the weapon\'s own frame time, five over six');
  assert.equal(b.state().shown.frame, 0, 'the first frame paints in the same LateUpdate');
  b.tick(1 / 60, walk({ sheathed: false, attacking: true }));
  assert.equal(b.state().clip.i, 0, 'no second clip while one is in flight');
  tickSeconds(b, animTime * 5 + 0.1, walk({ sheathed: false, attacking: false }));
  assert.equal(b.state().clip, null, 'past the last frame and its wait the clip is gone');
  assert.equal(b.state().table, 'MoveMelee', 'and the loop is back');
  // a dead body swings nothing; a rider swings nothing
  b.tick(0, walk({ died: true, attacking: true }));
  assert.equal(b.state().clip?.table, 'Death');
  const { b: rider } = await liveBody();
  ticks(rider, 3, walk({ riding: true, attacking: true, motion: { forward: 1, riding: true, standing: false, speed: 12, grounded: true } }));
  assert.equal(rider.state().clip, null, 'PlayMeleeAttackAnimation returns in the saddle (IL_5050-IL_5060)');
  _resetModSettings();
});

test('EOTB-IL: the loose, the cast and the claw at an eighth of a second; the drawn bow is the HOLD coroutine - down to 0, held, released forward', async () => {
  _resetModSettings();
  const { b } = await liveBody();
  ticks(b, 12, still({ sheathed: false, usingBow: true }));
  assert.equal(b.state().table, 'IdleRanged');
  b.tick(1 / 60, still({ sheathed: false, usingBow: true, attacking: true }));
  let c = b.state().clip;
  assert.equal(c.table, 'AttackRanged');
  assert.equal(c.interval, 0.125);
  assert.deepEqual(c.frames, [0, 1, 2, 3], 'BowDrawback off: PlayRangedAttackAnimation, forward');
  tickSeconds(b, 0.6, still({ sheathed: false, usingBow: true }));
  assert.equal(b.state().clip, null);
  // BowDrawback on: the hold coroutine
  const drawn = still({ sheathed: false, usingBow: true, attacking: true, bowDrawback: true, swingHeld: true });
  b.tick(1 / 60, drawn);
  c = b.state().clip;
  assert.equal(c.kind, 'hold');
  assert.deepEqual(c.frames, [2, 1, 0], 'drawn DOWN from n-2 to 0 (IL_5fa5-IL_6020)');
  assert.equal(b.state().shown.frame, 2);
  tickSeconds(b, 0.4, drawn);
  assert.equal(b.state().clip.phase, 'hold', 'held on 0 while the swing is held');
  assert.equal(b.state().shown.frame, 0);
  tickSeconds(b, 1, drawn);
  assert.equal(b.state().clip.phase, 'hold', 'for as long as it is held');
  b.tick(1 / 60, { ...drawn, swingHeld: false });
  assert.equal(b.state().clip.phase, 'release', 'let go: the release plays forward');
  assert.deepEqual(b.state().clip.frames, [0, 1, 2, 3]);
  tickSeconds(b, 0.6, { ...drawn, swingHeld: false, attacking: false });
  assert.equal(b.state().clip, null);
  // the cast: FPSSpellCasting.IsPlayingAnim
  b.tick(1 / 60, still({ spellcasting: true, castPlaying: true }));
  c = b.state().clip;
  assert.equal(c.table, 'AttackSpell');
  assert.equal(c.interval, 0.125);
  assert.deepEqual(c.frames, [0, 1, 2, 3]);
  tickSeconds(b, 0.6, still({ spellcasting: true }));
  // the claw
  b.tick(1 / 60, still({ transformed: true, attacking: true }));
  c = b.state().clip;
  assert.equal(c.table, 'AttackMeleeLycan');
  assert.equal(c.interval, 0.125);
  assert.deepEqual(c.frames, [0, 1, 2]);
});

test('EOTB-IL: Mixed is a ping-pong on the first swing and every fourth, Mirror alternates the count and flips 0/4 alone, MirrorTime reverts', async () => {
  _resetModSettings();
  const { b } = await liveBody();   // AttackStrings ships at Mixed
  const swing = async () => {
    b.tick(1 / 60, still({ sheathed: false, attacking: true }));
    const c = b.state().clip;
    tickSeconds(b, c.interval * (c.frames.length + 1) + 0.05, still({ sheathed: false }));
    assert.equal(b.state().clip, null);
    return c;
  };
  const kinds = [];
  for (let i = 0; i < 6; i++) kinds.push((await swing()).kind);
  assert.deepEqual(kinds, ['pingpong', 'forward', 'forward', 'forward', 'pingpong', 'forward'], 'pingpongCount % 4 == 0 (IL_507c-IL_509f)');
  assert.equal(b.state().pingpongCount, 6, 'every clip under Mixed bumps the count');
  // the mirror count: a melee clip under Mirror/Mixed bumps it (the ping-pong does not)
  assert.equal(b.state().mirrorCount, 4, 'four forward swings');
  // the flip: front and back only, while the count is odd
  const { b: m } = await liveBody();
  setModSetting(MOD, 'Graphics.AttackStrings', STRING.Mirror);
  setModSetting(MOD, 'Graphics.MirrorTime', 2);
  m.toggle(true, false);
  ticks(m, 12, still({ sheathed: false }));
  assert.equal(m.state().shown.flip, false);
  m.tick(1 / 60, still({ sheathed: false, attacking: true }));
  let c = m.state().clip;
  tickSeconds(m, c.interval * 7 + 0.05, still({ sheathed: false }));
  assert.equal(m.state().mirrorCount, 1);
  ticks(m, 12, still({ sheathed: false }));
  assert.equal(m.state().shown.orientation, 4);
  assert.equal(m.state().shown.flip, true, 'the back view (4) is drawn flipped while the count is odd');
  ticks(m, 12, still({ sheathed: false, cameraPos: [2, 1.5, 0] }));
  assert.equal(m.state().shown.orientation, 2);
  assert.equal(m.state().shown.flip, false, 'a side view keeps the wheel\'s own flip');
  ticks(m, 12, still({ sheathed: false }));
  m.tick(1 / 60, still({ sheathed: false, attacking: true }));
  c = m.state().clip;
  tickSeconds(m, c.interval * 7 + 0.05, still({ sheathed: false }));
  assert.equal(m.state().mirrorCount, 2, 'the second swing: even');
  ticks(m, 12, still({ sheathed: false }));
  assert.equal(m.state().shown.flip, false);
  m.tick(1 / 60, still({ sheathed: false, attacking: true }));
  c = m.state().clip;
  tickSeconds(m, c.interval * 7 + 0.05, still({ sheathed: false }));
  assert.equal(m.state().mirrorCount, 3);
  tickSeconds(m, 2.2, still({ sheathed: false }));
  assert.equal(m.state().mirrorCount, 0, 'MirrorTime reverts the count (IL_3d11-IL_3d2c)');
  _resetModSettings();
});

test('EOTB-IL: the death plays the two-frame table at half a second, FROZEN, and holds until the player is alive again', async () => {
  const { b } = await liveBody();
  ticks(b, 12, still());
  b.tick(1 / 60, still({ died: true }));
  const c = b.state().clip;
  assert.equal(c.table, 'Death');
  assert.equal(c.interval, 0.5);
  assert.equal(c.freeze, true, 'no UpdateOrientation when it ends');
  assert.deepEqual(c.frames, [0, 1]);
  tickSeconds(b, 3, still({ died: true }));
  assert.equal(b.state().shown.frame, 1, 'the last frame stays');
  assert.equal(b.state().clip, null);
  assert.equal(b.state().died, true);
  // DEATH-BODY1 - AND THIS IS WHERE THIS PIN USED TO DEFEND THE BUG.
  // It read `ticks(b, 12, walk({ died: false }))` and then asserted the
  // table was STILL 'Idle', on the IL's own authority: LateUpdate does
  // return while `died` holds, and Initialize is the only thing that
  // lowers it. That is faithful to the mod and it is exactly why three
  // players ended up walking around as corpses - because the mod CANNOT
  // have this bug. In Daggerfall Unity a death ends the run, so the
  // only way back is a load, and a load rebuilds the scene and the
  // billboard object with it. The port revives a LIVING module-level
  // body instead - a quickload straight back into play, the online
  // respawn, a prison release - and none of those is an Initialize.
  //
  // So the port diverges here, deliberately: the body follows the
  // ENTITY. While the player is dead the latch holds exactly as the IL
  // says; the moment they are alive again it lowers itself, wherever
  // that life came from.
  ticks(b, 12, walk({ died: false }));
  assert.equal(b.state().died, false, 'alive again lowers the latch - a load must not leave a corpse walking');
  assert.equal(b.state().table, 'Move', 'and the loop runs again');
  assert.equal(b.state().clip, null, 'with no death clip left in flight');

  // ...and the IL's own door still works, unchanged.
  const { b: b2 } = await liveBody();
  b2.tick(1 / 60, still({ died: true }));
  tickSeconds(b2, 3, still({ died: true }));
  assert.equal(b2.state().died, true, 'while they are dead it holds (IL_3ea6-IL_3eae)');
  ticks(b2, 12, walk({ died: true }));
  assert.equal(b2.state().table, 'Idle', 'LateUpdate returns for as long as they are dead');
  b2.toggle(true, false);   // Initialize clears it (IL_3b60)
  assert.equal(b2.state().died, false);
  // a transformed death is the lycan table
  const { b: wolf } = await liveBody();
  wolf.tick(1 / 60, still({ transformed: true, died: true }));
  assert.equal(wolf.state().clip.table, 'DeathLycan');
  assert.equal(frameCount('DeathLycan'), 2);
});

// ─────────────────────────────────────────────────────────────────
// THE FACING, THE ORIENTATION CLOCK, THE STRIDE, THE HIDES [IL]
// ─────────────────────────────────────────────────────────────────

test('EOTB-IL: UpdateOrientation runs ten times a second, keeps the last FACING while stopped, and turns to the view with a weapon up', async () => {
  const { b } = await liveBody();
  // walking toward +z with the camera behind: the back
  ticks(b, 20, walk());
  assert.equal(b.state().shown.orientation, 4);
  // backing away (forward -1) unarmed: the sprite faces the way it walks - toward the camera
  ticks(b, 20, walk({ motion: { forward: -1, standing: false, speed: 3, grounded: true } }));
  assert.equal(b.state().shown.orientation, 0, 'walking backwards: the front (TurnToView 2, unarmed, moving: moveDir)');
  // stopped: the last facing holds whatever the camera does
  ticks(b, 20, still({ cameraPos: [2, 1.5, 0] }));
  assert.equal(b.state().shown.orientation, 6, 'stopped: the facing kept is the last one (-z); the camera on +x reads index 6');
  // a weapon up: the camera's forward
  ticks(b, 20, still({ sheathed: false, cameraPos: [0, 1.5, -2] }));
  assert.equal(b.state().shown.orientation, 4, 'readied: the sprite faces the view, the camera behind sees the back');
  // the throttle: a camera swung round is not read for a tenth of a second
  ticks(b, 20, still({ sheathed: false, cameraPos: [0, 1.5, -2] }));
  b.tick(1 / 60, still({ sheathed: false, cameraPos: [0, 1.5, 2] }));
  const t0 = b.state().orientationTimer;
  let painted = null;
  for (let i = 1; i <= 12; i++) { b.tick(1 / 60, still({ sheathed: false, cameraPos: [0, 1.5, 2] })); if (b.state().shown.orientation === 0 && painted === null) painted = i; }
  assert.ok(painted !== null && painted >= 6, `the turn lands after the tenth of a second and the three delayed frames (${painted})`);
  assert.ok(t0 >= 0);
  // floating: the camera forward, whatever the option
  setModSetting(MOD, 'Graphics.TurnToView', 0);
  try {
    const { b: f } = await liveBody();
    ticks(f, 20, walk({ motion: { forward: -1, standing: false, speed: 3, grounded: true, levitating: true } }));
    assert.equal(f.state().shown.orientation, 4, 'levitating and backing away: still the view\'s forward, the back');
  } finally { _resetModSettings(); }
});

test('EOTB-IL: SyncFootsteps through the seam - the picture\'s stride at twice the volume, the machine yields, and DFU\'s clip choice', () => {
  const fm = new FootstepMachine();
  const set = ['A', 'B'];
  const m = { grounded: true, standingStill: false, swimming: false, levitating: false };
  for (let i = 0; i < 20; i++) assert.equal(fm.update([i * 0.5, 0, 0], { ...m, spriteStep: { owns: true, fell: false, volumeScale: 2 } }, set), null);
  assert.equal(fm.distance, 0, 'no walked distance under the sprite');
  assert.deepEqual(fm.update([10, 0, 0], { ...m, spriteStep: { owns: true, fell: true, volumeScale: 2 } }, set), { clip: 'A', volume: FOOTSTEP_VOLUME * 2 });
  assert.deepEqual(fm.update([10, 0, 0], { ...m, spriteStep: { owns: true, fell: true, volumeScale: 1 }, halfSpeed: true }, set), { clip: 'B', volume: FOOTSTEP_VOLUME }, 'the first-person billboard at once, and NO half-speed halving under the sprite');
  assert.equal(fm.update([10.1, 0, 0], { ...m, spriteStep: { owns: false, fell: false } }, set), null, 'handed back: a tenth of a unit is not a stride');
  assert.deepEqual(FOOTSTEP_VOLUME_SCALE, { thirdPerson: 2, firstPerson: 1 });
  closeLane();
  assert.deepEqual(mwViewFootstep(), { owns: false, fell: false, volumeScale: 1 });
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    const s = rd(h);
    const calls = [...s.matchAll(/_?footsteps\.update\(player\.pos, \{[\s\S]*?\}, /g)];
    assert.ok(calls.length >= 1, `${h} drives a stride machine`);
    for (const c of calls) assert.match(c[0], /spriteStep: mwViewFootstep\(\)/, `${h}: the machine hears the sprite`);
  }
});

test('EOTB-IL: the hides - the FPV weapon and horse behind their keys, the spell hands with none, all while the sprite camera is out', async () => {
  _resetModSettings();
  const { b } = await liveBody();
  eotbCamera.setBillboard(null);
  eotbCamera.toggleOffset(false);
  assert.deepEqual(b.hides(), { weapon: false, horse: false, spellHands: false }, 'first person hides nothing');
  eotbCamera.toggleOffset(true);
  try {
    assert.deepEqual(b.hides(), { weapon: true, horse: true, spellHands: true });
    setModSetting(MOD, 'Compatibility.Don\'tHideWeapon', true);
    b.reload();
    assert.deepEqual(b.hides(), { weapon: false, horse: true, spellHands: true });
    setModSetting(MOD, 'Compatibility.Don\'tHideHorse', true);
    b.reload();
    assert.deepEqual(b.hides(), { weapon: false, horse: false, spellHands: true }, 'spellCasting.enabled = false has no key (IL_22f9)');
  } finally { eotbCamera.toggleOffset(false); _resetModSettings(); }
  closeLane();
  assert.deepEqual(mwViewHides(), { weapon: false, horse: false, spellHands: false });
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /const eotbHidesWeapon = \(\) => !fpArm\.canThirdPerson\(\) && eotbBody\.hides\(\)\.weapon;/);
  assert.match(rig, /const eotbHidesSpellHands = \(\) => !fpArm\.canThirdPerson\(\) && eotbBody\.hides\(\)\.spellHands;/);
  // the hide folds into the frame's texture read, so the gate keeps the
  // shape fpsspellcasting.test.js pins (WeaponManager.cs:247)
  assert.match(rig, /const c = eotbHidesSpellHands\(\) \? null : \(cv\(\)\);/, 'the hands\' picture goes in third person');
  assert.match(rig, /if \(c && !fpArm\.active\(\)\) \{\s*\n\s*drawSpellCastHands\(/, 'and the draw gate is unchanged');
  assert.equal((rig.match(/thirdPerson: fpArm\.thirdActive\(\) \|\| eotbHidesWeapon\(\)/g) ?? []).length, 2, 'the widget and the torch hand');
  assert.match(rig, /if \(eotbHidesWeapon\(\)\) return;\s*\n\s*if \(fpArm\.active\(\)\) \{ fpArm\.draw\(c\); return; \}/, 'the picture goes before any first-person draw');
  assert.match(rd('src/player/mountRig.js'), /if \(art && isRiding\(player\.transportMode\) && !ridePaused && !mwViewHides\(\)\.horse\) \{/);
});

// ─────────────────────────────────────────────────────────────────
// THE CAMERA'S OTHER HALF [IL]
// ─────────────────────────────────────────────────────────────────

test('EOTB-IL: AutoTogglePerspective ships DISARMED - the sum of nine Don\'tChange rows - and armed it applies the IL\'s blocks, an arming forcing the fan-out', () => {
  const shipped = readCameraSettings(null);
  assert.deepEqual(Object.values(shipped.auto), new Array(9).fill(AUTO_TOGGLE.DontChange));
  assert.equal(shipped.autoPOVSwitch, false, 'autoPOVSwitch is derived from the rows (IL_10e1-IL_112d): all Don\'tChange, disarmed');
  const rows = { 'AutoTogglePerspective.OnFootMelee': AUTO_TOGGLE.ThirdPerson, 'AutoTogglePerspective.OnFoot': AUTO_TOGGLE.FirstPerson,
    'AutoTogglePerspective.OnTransitionInterior': AUTO_TOGGLE.FirstPerson, 'AutoTogglePerspective.OnTransitionExterior': AUTO_TOGGLE.ThirdPerson,
    'AutoTogglePerspective.OnFootSpell': AUTO_TOGGLE.ThirdPerson, 'Camera.StartInThirdPerson': false };
  const cam = createEotbCamera();
  cam.loadSettings((v, k) => rows[k]);
  assert.equal(cam.autoArmed(), true, 'a row set arms it');
  cam.start();
  assert.equal(cam.thirdPerson(), false);
  cam.tick({ sheathed: true });
  assert.equal(cam.thirdPerson(), false, 'the first frame: the sheath "changed" from the all-false fields and OnFoot says first - already there');
  cam.tick({ sheathed: false });
  assert.equal(cam.thirdPerson(), true, 'a weapon drawn: OnFootMelee says third');
  for (let i = 0; i < 12 && cam.thirdPerson(); i++) { cam.wheel(1); cam.tick({ sheathed: false }); }
  assert.equal(cam.thirdPerson(), false, 'scrolled back into the head');
  cam.tick({ sheathed: false }); cam.tick({ sheathed: false });
  assert.equal(cam.thirdPerson(), false, 'an unchanged frame applies nothing');
  cam.tick({ sheathed: true }); cam.tick({ sheathed: false });
  assert.equal(cam.thirdPerson(), true, 'a CHANGE back applies the row again');
  cam.tick({ sheathed: true });
  assert.equal(cam.thirdPerson(), false, 'sheathed: OnFoot says first');
  // the spell block is its own: a readied spell says OnFootSpell even in the saddle
  cam.tick({ sheathed: true, riding: true, spellcasting: true });
  assert.equal(cam.thirdPerson(), true, 'OnFootSpell: third, riding or not');
  // disarmed by the key: nothing moves; re-armed: the fan-out fires this frame (IL_1814)
  assert.equal(cam.toggleAuto(), false);
  cam.tick({ sheathed: true });
  assert.equal(cam.thirdPerson(), true, 'disarmed: OnFoot\'s FirstPerson row is ignored');
  assert.equal(cam.transition('Interior'), true, 'and so is the door');
  assert.equal(cam.toggleAuto(), true);
  cam.tick({ sheathed: true });
  assert.equal(cam.thirdPerson(), false, 'arming forces the fan-out: OnFoot applied at once');
  // the doors
  cam.tick({ sheathed: false });
  assert.equal(cam.transition('Interior'), false, 'stepping in: first');
  assert.equal(cam.transition('Exterior'), true, 'stepping out: third');
  // the popups
  const said = [];
  cam.setPopup((l) => said.push(l));
  cam.toggleAuto(); cam.toggleAuto();
  assert.deepEqual(said, [AUTO_TOGGLE_MESSAGES.disarmed, AUTO_TOGGLE_MESSAGES.armed]);
  // the seam and the mode machine: four doors now, the dungeon's too
  closeLane();
  assert.equal(mwViewTransition('Interior'), false, 'off the lane the door does nothing');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /setMode\('interior'\);\s*\n\s*host\.unlockOn\?\.\(\);[^\n]*\n\s*mwViewTransition\('Interior'\);/);   // AUDIT-WH2 L1-F5: the flip is setMode now - the ORDER this pin holds is unchanged
  assert.match(wm, /setMode\('dungeon'\);\s*\n\s*host\.unlockOn\?\.\(\);[^\n]*\n\s*mwViewTransition\('Interior'\);/, 'OnTransitionDungeonInterior (IL_06bf)');
  assert.equal((wm.match(/mwViewTransition\('Exterior'\)/g) ?? []).length, 2, 'the building\'s exit and the dungeon\'s (IL_06e1)');
});

test('EOTB-IL: OnNewGame and OnLoad - a transition row when armed and nothing else; StartInThirdPerson through ToggleOffset when not', () => {
  const cam = createEotbCamera();
  cam.loadSettings(null);
  assert.equal(cam.start(), true, 'Start: ToggleOffset(StartInThirdPerson), shipped on');
  cam.toggleOffset(false);
  assert.equal(cam.onLoad(false), true, 'disarmed: OnLoad takes StartInThirdPerson');
  cam.toggleOffset(false);
  assert.equal(cam.onNewGame(true), true, 'and OnNewGame the same');
  const armed = createEotbCamera();
  armed.loadSettings((v, k) => ({ 'AutoTogglePerspective.OnTransitionInterior': AUTO_TOGGLE.FirstPerson, 'AutoTogglePerspective.OnTransitionExterior': AUTO_TOGGLE.DontChange })[k]);
  armed.toggleOffset(false);
  assert.equal(armed.onLoad(false), false, 'armed, outside: the exterior row is Don\'tChange and StartInThirdPerson is NOT consulted (IL_0a72-IL_0abb)');
  armed.toggleOffset(true);
  assert.equal(armed.onLoad(true), false, 'armed, inside: the interior row says first');
  // the two doors in the world host
  const w = rd('src/scenes/world.js');
  assert.match(w, /mwViewLoadPose\(pose\.camera, \(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\);/, 'the load door hands IsPlayerInside');
  assert.match(w, /if \(!_loadedGame\) mwViewNewGame\(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\);/, 'a boot that loaded nothing is a new game');
  assert.match(w, /mwViewRebase\(r\.offset\);/, 'and the floating origin re-seeds the camera');
  openLane();
  try {
    eotbCamera.toggleOffset(false);
    mwViewLoadPose(null, false);
    assert.equal(eotbCamera.thirdPerson(), true, 'the load door re-seeds the sprite camera from the setting');
    eotbCamera.toggleOffset(false);
    mwViewNewGame(false);
    assert.equal(eotbCamera.thirdPerson(), true);
    // the rebase moves the smoothing with the world
    mwViewFrame({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1000, raycast: () => null });
    const before = mwViewFrame({ fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 0, raycast: () => null }).eye;
    mwViewRebase([100, 0, 0]);
    const after = mwViewFrame({ fpEye: [100, 1.6, 0], feet: [100, 0, 0], yaw: 0, pitch: 0, dt: 0, raycast: () => null }).eye;
    assert.equal(Number((after[0] - before[0]).toFixed(6)), 100, 'the eye moved with the origin, not swept across the jump');
  } finally { closeLane(); }
});

test('EOTB-IL: the SwitchShoulder and ToggleInput keys on their RELEASE edge (GetKeyUp) - driven through a real rig', () => {
  _resetModSettings();
  setModSetting(MOD, 'Camera.FrontalPlaneOffset', [0.5, 0.5]);   // "if it is non-zero" - the shipped X of 0 makes the switch a no-op
  assert.equal(domCodeForKeyCode('B'), 'KeyB');
  assert.equal(domCodeForKeyCode('KeypadPlus'), 'NumpadAdd');
  const keys = new Set();
  const audio = { playOneShot: () => 0, play3d: () => 0, setLoop: () => {} };
  const rig = createWeaponRig({
    renderer: {}, canvas: { width: 320, height: 200 }, fetchBytes: () => { throw new Error('no art'); }, palette: null,
    audio, entity: { items: [], health: 50 }, keyDown: (c) => keys.has(c),
  });
  try {
    const before = eotbCamera.mirrored();
    const armed = eotbCamera.autoArmed();
    keys.add('KeyB');
    rig.frame(1 / 60); rig.frame(1 / 60); rig.frame(1 / 60);
    assert.equal(eotbCamera.mirrored(), before, 'held: nothing yet - the mod reads GetKeyUp');
    keys.delete('KeyB');
    rig.frame(1 / 60);
    assert.equal(eotbCamera.mirrored(), !before, 'released: the shoulder switches ONCE');
    rig.frame(1 / 60); rig.frame(1 / 60);
    assert.equal(eotbCamera.mirrored(), !before, 'and stays');
    keys.add('NumpadAdd'); rig.frame(1 / 60); keys.delete('NumpadAdd'); rig.frame(1 / 60);
    assert.equal(eotbCamera.autoArmed(), !armed, 'ToggleInput arms or disarms the table, once per release');
    keys.add('NumpadAdd'); rig.frame(1 / 60); keys.delete('NumpadAdd'); rig.frame(1 / 60);
    assert.equal(eotbCamera.autoArmed(), armed);
  } finally {
    keys.clear(); rig.frame(1 / 60);
    eotbCamera.toggleOffset(false);
    _resetModSettings();
    eotbCamera.loadSettings(null);
    eotbBody.attach(null, null);
  }
});

// ─────────────────────────────────────────────────────────────────
// THE RECORD
// ─────────────────────────────────────────────────────────────────

test('EOTB-IL: no [SETTINGS] law is left in the arc, every law is marked [IL] with an offset, and the page says the assembly is read', () => {
  const files = readdirSync(join(root, 'src/player')).filter((f) => /^eotb/.test(f));
  const arc = files.map((f) => rd(`src/player/${f}`)).join('\n');
  assert.ok(!/\[SETTINGS\]/.test(arc), 'AUDIT-EOTB2\'s evidence mark is gone: the assembly is in the tree');
  assert.ok((arc.match(/\[IL\]/g) ?? []).length >= 30, 'the laws carry the IL mark');
  assert.ok((arc.match(/IL_[0-9a-f]{4}/g) ?? []).length >= 60, 'and cite their offsets');
  const page = rd('bible/06-Systems/Eye-Of-The-Beholder.md');
  assert.match(page, /EOTB-IL/);
  assert.match(page, /the assembly is in the tree|Eye Of The Beholder\.dll` is vendored/i, 'the page says where the assembly is');
  assert.ok(!/THE ASSEMBLY IS NOT IN THE TREE/.test(page), 'and no longer says it is not');
});

// ─────────────────────────────────────────────────────────────────
// EOTB-FLIP (2026-09-16, Mac, off a GPU at last: "The character is
// upside down (classic sprite)")
// ─────────────────────────────────────────────────────────────────

test('EOTB-FLIP: a decoded PNG is turned into the world billboard\'s row order ONCE, through the tree\'s one converter - the top row lands last', () => {
  const w = 2, h = 3;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; data[i] = x; data[i + 1] = y; data[i + 2] = 0; data[i + 3] = 255; }
  const out = worldOrderColors({ width: w, height: h, data });
  assert.equal(out.width, w); assert.equal(out.height, h);
  assert.ok(out.colors instanceof Uint32Array, 'a Uint32 a pixel - the shape the mirror reads');
  const px = (i) => [out.colors[i] & 0xff, (out.colors[i] >> 8) & 0xff];
  assert.deepEqual(px(0), [0, 2], 'row 0 of the upload is the picture\'s BOTTOM row (y = 2)');
  assert.deepEqual(px(w * (h - 1)), [0, 0], 'and the raster\'s top row is last');
  const m = flipRows(out.colors, w, h);
  assert.deepEqual([m[0] & 0xff, (m[0] >> 8) & 0xff], [1, 2], 'mirrored: x swapped, y kept');
  assert.deepEqual([...out.colors], [...new Uint32Array(toColor32({ width: w, height: h, data }).colors.buffer)], 'toColor32, byte for byte');
});

test('EOTB-FLIP: the body\'s decode is the dropped torch\'s door - decodePng, then the converter - and never a canvas of its own', () => {
  const body = rd('src/player/eotbBody.js');
  assert.match(body, /export async function decodeSprite\(url\) \{\s*const res = await fetch\(url\);\s*if \(!res\.ok\) throw new Error\([^)]*\);\s*return worldOrderColors\(await decodePng\(new Uint8Array\(await res\.arrayBuffer\(\)\)\)\);\s*\}/,
    'fetch, decodePng, worldOrderColors - the same three the dropped torch takes');
  assert.ok(!/getImageData|new Image\(|OffscreenCanvas/.test(body), 'no canvas door of its own');
  assert.match(rd('src/player/eotbSprite.js'), /import \{ toColor32 \} from '\.\.\/formats\/color32Order\.js';/, 'the converter is the tree\'s');
  assert.match(rd('src/scenes/droppedTorches.js'), /return toColor32\(await decodePng\(new Uint8Array\(await res\.arrayBuffer\(\)\)\)\);/, 'and the torch still takes it too');
  assert.deepEqual(MATERIAL.shade, { mode: 4, alpha: 0.6 });
  assert.equal(TABLE_FRAMES.Death, 2);
});
