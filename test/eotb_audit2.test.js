// ═══ AUDIT-EOTB2 (2026-09-16): THE BODY WAS A STATUE ═══════════════
//
// Mac: "Do an audit on eye of the beholder. Ensure its integrated 1:1.
// No half assed work." A player, the same day: "scrolling the mouse
// wheel down during regular gameplay makes some wacky stuff happen."
//
// The assembly is NOT in the tree and cannot be fetched from the
// container (Nexus gates the bundle behind a login), so this audit is
// two things and says which is which: the INTEGRATION of what EOTB2-5
// read off the IL, driven end to end and repaired; and the sixteen
// members the arc left "NOT DONE", ported from the settings' own names,
// descriptions and option labels [SETTINGS] with the state table the
// IL gave us. Every [SETTINGS] law is pinned here so that the day the
// assembly is read, a wrong reading fails a test rather than a player.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEotbBody, bodyState, CLIP_FRAMES } from '../src/player/eotbBody.js';
import { eotbBody } from '../src/player/eotbBody.js';
import { eotbCamera, createEotbCamera, readCameraSettings } from '../src/player/eotbCamera.js';
import {
  attackString, clipFrames, turnsToView, autoToggleSituation, deathTable, ATTACK_STRINGS, TURN_TO_VIEW,
  AUTO_TOGGLE_ROWS, AUTO_TOGGLE, frameTime, FOOTSTEP_FRAMES,
} from '../src/player/eotbBillboard.js';
import { spriteFor, SIZE_ON_FOOT, SIZE_RIDING_OR_TRANSFORMED } from '../src/player/eotbSprite.js';
import {
  mwViewFrame, mwViewFootstep, mwViewHides, mwViewTransition, mwViewLoadPose, mwViewPendingClicks,
  setEotbBodyReady, setEotbDrawBody, setEotbPlayerState, eotbLane,
} from '../src/player/mwView.js';
import { mwCamera } from '../src/player/mwCamera.js';
import { FootstepMachine, FOOTSTEP_VOLUME } from '../src/systems/footsteps.js';
import { setModSetting, _resetModSettings, MOD_SETTINGS } from '../src/systems/modSettings.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { domCodeForKeyCode } from '../src/systems/keyCodes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const MOD = 'eye-of-the-beholder';

const renderer = () => ({
  uploads: [], batches: [],
  uploadTexture(archive, rec, img) { this.uploads.push({ archive, rec, img }); },
  createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; this.batches.push(b); return b; },
  drawBillboards() {},
});
/** A body with art present and an instant decode - the shape a browser has. */
async function liveBody(over = {}) {
  const r = renderer();
  const b = createEotbBody({
    count: () => 3035, urlFor: (k) => `/art/${k}.png`,
    decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }),
    ...over,
  });
  b.attach(r, () => ({}));
  await Promise.resolve(); await Promise.resolve();
  return { b, r };
}
const tickSeconds = (b, seconds, state, step = 1 / 60) => { for (let t = 0; t < seconds; t += step) b.tick(step, state); };

/** The seam as a fresh session has it (eotb_view.test.js's reset), the lane OPEN. */
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
const closeLane = () => { setEotbBodyReady(null); setEotbPlayerState(null); eotbCamera.toggleOffset(false); _resetModSettings(); };

// ─────────────────────────────────────────────────────────────────
// THE STATE - one home, and the seam carries it whole
// ─────────────────────────────────────────────────────────────────

test('AUDIT-EOTB2: bodyState reads the rig\'s record and the hosts\' motion bag - the fields chooseTable was starving for', () => {
  const walking = bodyState({ weaponReady: true, motion: { forward: 1, strafe: 0, running: false, riding: false, standing: false } });
  assert.equal(walking.stopped, false, 'a move axis is not stopped');
  assert.equal(walking.sheathed, false, 'weaponReady is the rig\'s word for unsheathed');
  assert.equal(walking.galloping, false);
  const galloping = bodyState({ motion: { forward: 1, running: true, riding: true, standing: false } });
  assert.deepEqual([galloping.riding, galloping.galloping], [true, true], 'the saddle at a run gallops');
  const still = bodyState({ motion: { forward: 0, strafe: 0, standing: true } });
  assert.equal(still.stopped, true);
  assert.equal(bodyState({}).stopped, true, 'no record at all stands still - the shape the statue had');
  assert.equal(bodyState({ stopped: false, motion: { standing: true } }).stopped, false, 'a host\'s explicit word wins over the bag');
  assert.deepEqual(bodyState({ died: true, transformed: true, lycanthropyType: 2, spellcasting: true, usingBow: true }),
    { died: true, transformed: true, lycanthropyType: 2, riding: false, stopped: true, galloping: false, sheathed: true, spellcasting: true, usingBow: true, forward: 0, strafe: 0 });
});

test('AUDIT-EOTB2: THE STATUE WALKS - through the seam, the rig\'s record drives the table, the death and the saddle', () => {
  openLane();
  try {
    const eye = { fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: 1 / 60 };
    setEotbPlayerState(() => ({ sheathed: false, motion: { forward: 1, standing: false } }));
    mwViewFrame(eye);
    assert.equal(eotbBody.state().table, 'MoveMelee', 'walking with a drawn weapon: the MoveMelee table, not Idle');
    setEotbPlayerState(() => ({ sheathed: true, motion: { forward: 0, standing: true } }));
    mwViewFrame(eye);
    assert.equal(eotbBody.state().table, 'Idle');
    setEotbPlayerState(() => ({ motion: { forward: 1, running: true, riding: true, standing: false } }));
    mwViewFrame({ ...eye, riding: true });
    assert.equal(eotbBody.state().table, 'GallopHorse', 'the hosts\' riding and the bag\'s run: a gallop');
    setEotbPlayerState(() => ({ died: true }));
    mwViewFrame(eye);
    assert.equal(eotbBody.state().table, 'Death', 'dead: the Death table');
    assert.ok(eotbBody.state().clip?.death, 'as a held one-shot');
    setEotbPlayerState(() => ({ transformed: true, motion: { forward: 1, standing: false } }));
    mwViewFrame(eye);
    assert.equal(eotbBody.state().table, 'MoveLycan', 'alive again and transformed: the lycan walk, the death clip gone');
    assert.equal(eotbBody.state().clip, null);
  } finally { closeLane(); }
});

test('AUDIT-EOTB2: the rig registers the WHOLE record, off the motion bag its camera thunk already carries - no host grew a line', () => {
  const rig = rd('src/combat/weaponRig.js');
  const reg = /eotbBody\.attach\(renderer, \(\) => \(\{([\s\S]*?)\}\)\);/.exec(rig);
  assert.ok(reg, 'the one registration');
  for (const f of ['weaponReady:', 'sheathed: playerWeapon.sheathed', 'spellcasting: spellArmed()', 'usingBow: !!playerWeapon.machine.isBow',
    'transformed: !!entity && isTransformedLycanthrope(entity)', 'lycanthropyType:', 'died: !!entity && (entity.health ?? 1) <= 0', 'motion: camera?.()?.move ?? null']) {
    assert.ok(reg[1].includes(f), `the record carries ${f}`);
  }
  // and every host's camera thunk hands the rig the ONE motion bag (WW2's law), which is where `motion` comes from
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(h), /move: (?:motionBagOf\(player\)|_fpMove)/, `${h}: the thunk carries the bag`);
  }
});

// ─────────────────────────────────────────────────────────────────
// THE ONE-SHOTS [SETTINGS]
// ─────────────────────────────────────────────────────────────────

test('AUDIT-EOTB2 [SETTINGS]: AttackStrings by its own labels - None forward, PingPong turned at n-1-offset, Mirror flipped, Mixed one of the two', () => {
  assert.deepEqual([...ATTACK_STRINGS], ['None', 'Mirror', 'PingPong', 'Mixed'], 'modsettings.json\'s options, in order');
  assert.equal(attackString(0), 'None');
  assert.equal(attackString(1), 'Mirror');
  assert.equal(attackString(2), 'PingPong');
  assert.equal(attackString(3, () => 0.2), 'Mirror');
  assert.equal(attackString(3, () => 0.7), 'PingPong');
  assert.equal(attackString(9), 'None', 'off the table is None');
  assert.deepEqual(clipFrames(5), [0, 1, 2, 3, 4]);
  assert.deepEqual(clipFrames(5, { pingPong: true, pingPongOffset: 1 }), [0, 1, 2, 3, 2, 1, 0], 'the shipped offset turns one frame early');
  assert.deepEqual(clipFrames(5, { pingPong: true, pingPongOffset: 0 }), [0, 1, 2, 3, 4, 3, 2, 1, 0]);
  assert.deepEqual(clipFrames(5, { pingPong: true, pingPongOffset: -3 }), [0, 1, 2, 3, 4, 3, 2, 1, 0], 'past the end clamps to the last frame');
  assert.deepEqual(clipFrames(5, { pingPong: true, pingPongOffset: 3 }), [0, 1, 0]);
  assert.deepEqual(clipFrames(5, { pingPong: true, pingPongOffset: 9 }), [0], 'past the start is the first frame alone');
  assert.deepEqual(clipFrames(0), [0], 'an empty clip is one frame, never nothing');
});

test('AUDIT-EOTB2 [SETTINGS]: an attack plays its table ONCE at the frame clock and the loop resumes; the drawn bow HOLDS its last frame until released', async () => {
  _resetModSettings();
  setModSetting(MOD, 'Graphics.AttackStrings', 0);   // None: the plain forward clip
  const { b } = await liveBody();
  b.reload();
  const walking = { sheathed: false, motion: { forward: 1, standing: false } };
  b.tick(1 / 60, walking);
  assert.equal(b.state().table, 'MoveMelee');
  const clip = b.attack('StrikeDown');
  assert.equal(clip.table, 'AttackMelee', 'the swing: the stance\'s attack table');
  assert.deepEqual(clip.frames, [0, 1, 2, 3, 4]);
  b.tick(0, walking);
  assert.equal(b.state().table, 'AttackMelee', 'drawn over the loop');
  assert.equal(b.state().frame, 0);
  const step = frameTime(false, 1);
  b.tick(step * 2.5, walking);
  assert.equal(b.state().frame, 2, 'two frames on, at get_frameTime\'s step');
  b.tick(step * 3, walking);
  assert.equal(b.state().clip, null, 'past the last frame the clip is gone');
  assert.equal(b.state().table, 'MoveMelee', 'and the loop is back');

  // the bow: hold on the last frame while the string is drawn
  const bow = { sheathed: false, usingBow: true, motion: { forward: 0, standing: true } };
  b.tick(0, bow);
  const drawn = b.attack('StrikeUp', { hold: true });
  assert.equal(drawn.table, 'AttackRanged');
  b.tick(step * 10, bow);
  assert.equal(b.state().frame, 4, 'held on the last frame');
  assert.ok(b.state().clip?.done && b.state().clip?.hold, 'done, and holding');
  b.release();
  assert.equal(b.state().clip, null, 'released: the clip ends');
  b.tick(0, bow);
  assert.equal(b.state().table, 'IdleRanged');

  // the spell, and the lycan's claws
  b.tick(0, { spellcasting: true });
  assert.equal(b.cast().table, 'AttackSpell');
  b.tick(0, { transformed: true, sheathed: false });
  assert.equal(b.attack().table, 'AttackMeleeLycan');
  assert.equal(b.cast().table, 'AttackMeleeLycan', 'a transformed caster has claws, not hands');
  // and a dead body swings nothing
  b.tick(0, { died: true });
  assert.equal(b.attack(), null);
  assert.equal(b.cast(), null);
  _resetModSettings();
});

test('AUDIT-EOTB2 [SETTINGS]: Mirror alternates the whole clip\'s flip swing by swing, MirrorTime reverts it, and the flip reaches the sprite KEY', async () => {
  _resetModSettings();
  setModSetting(MOD, 'Graphics.AttackStrings', 1);   // Mirror
  setModSetting(MOD, 'Graphics.MirrorTime', 2);
  const { b } = await liveBody();
  b.reload();
  const st = { sheathed: false, motion: { forward: 0, standing: true } };
  b.tick(0, st);
  assert.equal(b.attack().mirror, true, 'the first swing flips');
  assert.equal(b.state().attackMirror, true);
  b.tick(0.5, st);
  assert.equal(b.attack().mirror, false, 'the second swings back');
  assert.equal(b.attack().mirror, true, 'the third flips again');
  tickSeconds(b, 2.1, st);
  assert.equal(b.state().attackMirror, false, 'MirrorTime reverts the state');
  // the flip lays over the wheel's own mirror: a flipped left-facing frame is the right-facing pixels
  const plain = spriteFor('AttackMelee', 1, 0, {});
  const flipped = spriteFor('AttackMelee', 1, 0, {}, { flip: true });
  assert.equal(plain.mirror, true, 'orientation 1 draws flipped on the wheel');
  assert.equal(flipped.mirror, false, 'and the Mirror string cancels it');
  assert.notEqual(plain.rec, flipped.rec, 'two different uploads, two keys');
  assert.equal(spriteFor('AttackMelee', 0, 0, {}, { flip: true }).rec, '25-0m', 'a front frame flipped is the mirrored upload');
  // "Set to 0 to disable", says the description - and the bundle's own
  // slider is Min 1.0 (modsettings.json), so the disable is unreachable
  // from the pane in DFU too. The port declares the bundle's range,
  // verbatim quirk kept, and the revert arm still honours a 0 a future
  // reader of the assembly may find another way to set.
  assert.equal(MOD_SETTINGS[MOD].keys['Graphics.MirrorTime'].min, 1, 'the bundle\'s own floor');
  _resetModSettings();
});

test('AUDIT-EOTB2 [SETTINGS]: PingPong reorders the clip by the offset, and Mixed rolls between the two', async () => {
  _resetModSettings();
  setModSetting(MOD, 'Graphics.AttackStrings', 2);
  setModSetting(MOD, 'Graphics.PingPongOffset', 2);
  const { b } = await liveBody();
  b.reload();
  b.tick(0, { sheathed: false });
  assert.deepEqual(b.attack().frames, [0, 1, 2, 1, 0]);
  const rolls = [0.1, 0.9];
  const { b: mixed } = await liveBody({ rolls: () => rolls.shift() });
  setModSetting(MOD, 'Graphics.AttackStrings', 3);
  mixed.reload();
  mixed.tick(0, { sheathed: false });
  assert.equal(mixed.attack().mirror, true, 'the low roll is Mirror');
  assert.equal(mixed.attack().mirror, false, 'the high roll is PingPong - and it does not flip');
  assert.deepEqual(mixed.state().clip.frames, [0, 1, 2, 1, 0]);
  _resetModSettings();
});

test('AUDIT-EOTB2 [SETTINGS]: the death clip plays once, HOLDS its last frame for as long as the entity is dead, and goes on a load', async () => {
  const { b } = await liveBody();
  const dead = { died: true };
  b.tick(0, dead);
  assert.equal(b.state().table, 'Death');
  assert.equal(deathTable({ transformed: true }), 'DeathLycan');
  tickSeconds(b, 3, dead);
  assert.equal(b.state().frame, CLIP_FRAMES - 1, 'held on the last frame');
  assert.ok(b.state().clip?.death && b.state().clip?.done);
  b.release();
  assert.ok(b.state().clip, 'a release is the bow\'s, not death\'s');
  b.tick(0, { died: false });
  assert.equal(b.state().clip, null, 'alive: the clip is gone');
  assert.equal(b.state().table, 'Idle');
});

// ─────────────────────────────────────────────────────────────────
// THE FACING, THE SIZE, THE STRIDE, THE HIDES [SETTINGS]
// ─────────────────────────────────────────────────────────────────

test('AUDIT-EOTB2 [SETTINGS]: TurnToView - the sprite faces the view when the option says, and its own heading otherwise', async () => {
  assert.deepEqual([...TURN_TO_VIEW], ['Never', 'OnlyWhenAnimating', 'WhenWeaponReadied', 'Always']);
  assert.equal(turnsToView(3), true);
  assert.equal(turnsToView(2, { readied: true }), true);
  assert.equal(turnsToView(2, { readied: false }), false);
  assert.equal(turnsToView(2, { animating: true }), true, 'a swing in flight faces the view under WhenWeaponReadied too');
  assert.equal(turnsToView(1, { animating: true }), true);
  assert.equal(turnsToView(1, { readied: true }), false);
  assert.equal(turnsToView(0, { animating: true, readied: true }), false);

  _resetModSettings();
  const { b } = await liveBody();
  const view = [0, 0, 1];            // the camera looks down +z
  const behind = [0, 0, -1];         // and stands behind the player
  // shipped: WhenWeaponReadied. Unarmed and backing away, the sprite faces the way it walks - toward the camera
  b.tick(0, { sheathed: true, motion: { forward: -1, strafe: 0, standing: false } });
  assert.equal(b.face(view, behind), 0, 'walking backwards: the FRONT view (facing the camera)');
  b.tick(0, { sheathed: true, motion: { forward: 0, strafe: 0, standing: true } });
  assert.equal(b.face(view, behind), 0, 'stopped: keeps the heading it had');
  b.tick(0, { sheathed: true, motion: { forward: 1, strafe: 0, standing: false } });
  assert.equal(b.face(view, behind), 4, 'walking away: the BACK view');
  b.tick(0, { sheathed: false, motion: { forward: -1, strafe: 0, standing: false } });
  assert.equal(b.face(view, behind), 4, 'a weapon readied: the sprite turns to the view whichever way it walks');
  setModSetting(MOD, 'Graphics.TurnToView', 3);
  b.reload();
  b.tick(0, { sheathed: true, motion: { forward: -1, standing: false } });
  assert.equal(b.face(view, behind), 4, 'Always: the view');
  setModSetting(MOD, 'Graphics.TurnToView', 0);
  b.reload();
  b.tick(0, { sheathed: false, motion: { strafe: 1, forward: 0, standing: false } });
  const o = b.face(view, behind);
  assert.ok(o === 2 || o === 6, `Never, strafing: a side view (${o})`);
  _resetModSettings();
});

test('AUDIT-EOTB2: the sprite is sized for the state it is IN - the saddle and the wolf take the larger arm (it passed false, false)', async () => {
  _resetModSettings();
  const { b, r } = await liveBody();
  eotbCamera.toggleOffset(true);
  try {
    const f = { eye: [0, 1.6, -2], feet: [0, 0, 0], yaw: 0 };
    b.tick(0, { motion: { standing: true } });
    b.draw(null, f); await Promise.resolve(); await Promise.resolve(); b.draw(null, f);
    const foot = r.batches.at(-1);
    assert.ok(foot, 'a batch was built');
    assert.equal(foot.size.h, 6 * SIZE_ON_FOOT);
    b.tick(0, { riding: true, motion: { standing: true, riding: true } });
    b.draw(null, f); await Promise.resolve(); await Promise.resolve(); b.draw(null, f);
    assert.equal(r.batches.at(-1).size.h, 6 * SIZE_RIDING_OR_TRANSFORMED, 'mounted: the rider\'s size');
    b.tick(0, { transformed: true, motion: { standing: true } });
    b.draw(null, f); await Promise.resolve(); await Promise.resolve(); b.draw(null, f);
    assert.equal(r.batches.at(-1).size.h, 6 * SIZE_RIDING_OR_TRANSFORMED, 'transformed: the same arm');
    // Graphics.Enable off: the camera stays out, the body does not draw
    setModSetting(MOD, 'Graphics.Enable', false);
    b.reload();
    assert.equal(b.draw(null, f), false);
  } finally { eotbCamera.toggleOffset(false); _resetModSettings(); }
});

test('AUDIT-EOTB2 [SETTINGS]: SyncFootsteps - the sprite owns the stride on foot in third person, a foot lands on frames 2 and 4 of a MOVE table', async () => {
  _resetModSettings();
  const { b } = await liveBody();
  const walk = { motion: { forward: 1, standing: false } };
  b.tick(0, walk);
  assert.deepEqual(b.footstep(), { owns: false, fell: false }, 'first person: DFU\'s stride');
  eotbCamera.toggleOffset(true);
  try {
    b.tick(0, walk);
    assert.equal(b.footstep().owns, true, 'third person, the body ready, on foot: the picture\'s stride');
    const step = frameTime(false, 1);
    const fell = [];
    for (let i = 1; i <= 10; i++) { b.tick(step, walk); if (b.footstep().fell) fell.push(b.state().frame); }
    assert.deepEqual([...new Set(fell)].sort(), [...FOOTSTEP_FRAMES], 'a footfall on frames 2 and 4, no others');
    assert.equal(fell.length, 4, 'two strides in ten frames');
    b.tick(step, { motion: { forward: 0, standing: true } });
    assert.equal(b.footstep().fell, false, 'standing: no foot lands');
    b.tick(step, { riding: true, motion: { forward: 1, riding: true, standing: false } });
    assert.equal(b.footstep().owns, false, 'the saddle keeps DFU\'s hoofbeats');
    setModSetting(MOD, 'Animation.SyncFootsteps', false);
    b.reload();
    b.tick(step, walk);
    assert.equal(b.footstep().owns, false, 'the switch off hands the stride back');
  } finally { eotbCamera.toggleOffset(false); _resetModSettings(); }
});

test('AUDIT-EOTB2 [SETTINGS]: the stride machine yields to the sprite\'s word - no distance piles up under it, the clips alternate, half speed halves', () => {
  const fm = new FootstepMachine();
  const set = ['A', 'B'];
  const m = { grounded: true, standingStill: false, swimming: false, levitating: false };
  // owned and no footfall: nothing, and the anchor follows so nothing accumulates
  for (let i = 0; i < 20; i++) assert.equal(fm.update([i * 0.5, 0, 0], { ...m, spriteStep: { owns: true, fell: false } }, set), null);
  assert.equal(fm.distance, 0, 'no walked distance under the sprite');
  assert.deepEqual(fm.update([10, 0, 0], { ...m, spriteStep: { owns: true, fell: true } }, set), { clip: 'A', volume: FOOTSTEP_VOLUME });
  assert.deepEqual(fm.update([10, 0, 0], { ...m, spriteStep: { owns: true, fell: true }, halfSpeed: true }, set), { clip: 'B', volume: FOOTSTEP_VOLUME * 0.5 });
  // handed back: the vanilla stride from the anchor it left, not from where it started
  assert.equal(fm.update([10.1, 0, 0], { ...m, spriteStep: { owns: false, fell: false } }, set), null, 'a tenth of a unit is not a stride');
  assert.equal(fm.update([10.1, 0, 0], m, set), null, 'and no word at all is the vanilla stride');
  // the seam: off the lane the sprite owns nothing
  closeLane();
  assert.deepEqual(mwViewFootstep(), { owns: false, fell: false });
  // and every host hands its machine the word
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    const s = rd(h);
    const calls = [...s.matchAll(/_?footsteps\.update\(player\.pos, \{[\s\S]*?\}, /g)];
    assert.ok(calls.length >= 1, `${h} drives a stride machine`);
    for (const c of calls) assert.match(c[0], /spriteStep: mwViewFootstep\(\)/, `${h}: the machine hears the sprite`);
  }
});

test('AUDIT-EOTB2 [SETTINGS]: ToggleBillboard\'s two hides - the FPV weapon and horse go while the sprite is on screen, each behind its Compatibility key', async () => {
  _resetModSettings();
  const { b } = await liveBody();
  assert.deepEqual(b.hides(), { weapon: false, horse: false }, 'first person hides nothing');
  eotbCamera.toggleOffset(true);
  try {
    assert.deepEqual(b.hides(), { weapon: true, horse: true });
    setModSetting(MOD, 'Compatibility.Don\'tHideWeapon', true);
    b.reload();
    assert.deepEqual(b.hides(), { weapon: false, horse: true });
    setModSetting(MOD, 'Compatibility.Don\'tHideHorse', true);
    b.reload();
    assert.deepEqual(b.hides(), { weapon: false, horse: false });
  } finally { eotbCamera.toggleOffset(false); _resetModSettings(); }
  // a body with no art hides nothing however the camera stands - the lane is shut
  const bare = createEotbBody({ count: () => 0, urlFor: () => null, decode: async () => { throw new Error('none'); } });
  bare.attach(renderer(), () => ({}));
  eotbCamera.toggleOffset(true);
  try { assert.deepEqual(bare.hides(), { weapon: false, horse: false }); } finally { eotbCamera.toggleOffset(false); }
  // the seam: off the lane, nothing hides
  closeLane();
  assert.deepEqual(mwViewHides(), { weapon: false, horse: false });
  // the rig: the widget's and the torch hand's third-person gate ask the sprite too, and the draw returns before the arm
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /const eotbHidesWeapon = \(\) => !fpArm\.canThirdPerson\(\) && eotbBody\.hides\(\)\.weapon;/);
  assert.equal((rig.match(/thirdPerson: fpArm\.thirdActive\(\) \|\| eotbHidesWeapon\(\)/g) ?? []).length, 2, 'the widget and the torch hand');
  assert.match(rig, /if \(eotbHidesWeapon\(\)\) return;\s*\n\s*if \(fpArm\.active\(\)\) \{ fpArm\.draw\(c\); return; \}/, 'the picture goes before any first-person draw');
  // and the mount rig's horse
  assert.match(rd('src/player/mountRig.js'), /if \(art && isRiding\(player\.transportMode\) && !ridePaused && !mwViewHides\(\)\.horse\) \{/);
});

// ─────────────────────────────────────────────────────────────────
// THE CAMERA'S OTHER HALF [SETTINGS]
// ─────────────────────────────────────────────────────────────────

test('AUDIT-EOTB2 [SETTINGS]: AutoTogglePerspective - a row is applied when the SITUATION changes, never every frame, and ToggleInput arms it', () => {
  assert.deepEqual([...AUTO_TOGGLE_ROWS], ['OnFoot', 'OnFootMelee', 'OnFootRanged', 'OnFootSpell', 'OnHorse', 'OnHorseReady', 'OnLycan']);
  assert.equal(autoToggleSituation({ sheathed: true }), 'OnFoot');
  assert.equal(autoToggleSituation({ sheathed: false }), 'OnFootMelee');
  assert.equal(autoToggleSituation({ sheathed: false, usingBow: true }), 'OnFootRanged');
  assert.equal(autoToggleSituation({ sheathed: true, spellcasting: true }), 'OnFootSpell');
  assert.equal(autoToggleSituation({ riding: true, sheathed: true }), 'OnHorse');
  assert.equal(autoToggleSituation({ riding: true, sheathed: false }), 'OnHorseReady');
  assert.equal(autoToggleSituation({ riding: true, spellcasting: true, sheathed: true }), 'OnHorseReady');
  assert.equal(autoToggleSituation({ transformed: true, riding: true, sheathed: false }), 'OnLycan', 'the form outranks the saddle');

  const rows = { 'AutoTogglePerspective.OnFootMelee': AUTO_TOGGLE.ThirdPerson, 'AutoTogglePerspective.OnFoot': AUTO_TOGGLE.FirstPerson,
    'AutoTogglePerspective.OnTransitionInterior': AUTO_TOGGLE.FirstPerson, 'AutoTogglePerspective.OnTransitionExterior': AUTO_TOGGLE.ThirdPerson,
    'Camera.StartInThirdPerson': false };
  const cam = createEotbCamera();
  cam.loadSettings((v, k) => rows[k]);
  cam.start();
  assert.equal(cam.thirdPerson(), false);
  cam.tick({ sheathed: true });
  assert.equal(cam.thirdPerson(), false, 'the first frame seeds the situation - it is not a change');
  cam.tick({ sheathed: false });
  assert.equal(cam.thirdPerson(), true, 'a weapon drawn: OnFootMelee says third');
  // THE SAME SITUATION AGAIN APPLIES NOTHING - proven where it bites: the
  // player scrolls all the way back into their head (the wheel's own
  // ladder, in past MinimumDistance), and a row re-applied every frame
  // would drag them straight back out
  for (let i = 0; i < 12 && cam.thirdPerson(); i++) { cam.wheel(1); cam.tick({ sheathed: false }); }
  assert.equal(cam.thirdPerson(), false, 'scrolled back into the head');
  cam.tick({ sheathed: false }); cam.tick({ sheathed: false });
  assert.equal(cam.thirdPerson(), false, 'and the unchanged situation leaves it there');
  cam.tick({ sheathed: true }); cam.tick({ sheathed: false });
  assert.equal(cam.thirdPerson(), true, 'a CHANGE back into the situation applies its row again');
  cam.tick({ sheathed: true });
  assert.equal(cam.thirdPerson(), false, 'sheathed: OnFoot says first');
  // AND THE FIRST FRAME IS A SEED, proven where it bites: a game that
  // opens in third person (StartInThirdPerson) under an OnFoot row that
  // says first must not be dropped into first on its first frame
  const seeded = createEotbCamera();
  seeded.loadSettings((v, k) => (k === 'Camera.StartInThirdPerson' ? true : rows[k]));
  seeded.start();
  assert.equal(seeded.thirdPerson(), true);
  seeded.tick({ sheathed: true });
  assert.equal(seeded.thirdPerson(), true, 'the first frame seeds OnFoot and applies nothing');
  seeded.tick({ sheathed: false }); seeded.tick({ sheathed: true });
  assert.equal(seeded.thirdPerson(), false, 'the first CHANGE back to OnFoot applies its row');
  // DontChange leaves the view
  cam.tick({ sheathed: false });
  cam.tick({ sheathed: false, usingBow: true });
  assert.equal(cam.thirdPerson(), true, 'OnFootRanged is DontChange: still third');
  // the doors
  assert.equal(cam.transition('Interior'), false, 'stepping in: first');
  assert.equal(cam.transition('Exterior'), true, 'stepping out: third');
  // disarmed, nothing moves
  assert.equal(cam.toggleAuto(), false);
  cam.tick({ sheathed: true });
  assert.equal(cam.thirdPerson(), true, 'disarmed: OnFoot\'s FirstPerson row is ignored');
  assert.equal(cam.transition('Interior'), true, 'and so is the door');
  assert.equal(cam.toggleAuto(), true);
  // shipped: every row DontChange, so a fresh camera never moves by itself
  const shipped = readCameraSettings(null);
  assert.deepEqual(Object.values(shipped.auto), new Array(9).fill(AUTO_TOGGLE.DontChange), 'nine rows, all Don\'tChange as the bundle ships');
  // the seam and the mode machine: the two doors
  closeLane();
  assert.equal(mwViewTransition('Interior'), false, 'off the lane the door does nothing');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /mode = 'interior';\s*\n\s*host\.unlockOn\?\.\(\);[^\n]*\n\s*mwViewTransition\('Interior'\);/);
  assert.match(wm, /mode = 'exterior';\s*\n\s*host\.unlockOn\?\.\(\);[^\n]*\n\s*mwViewTransition\('Exterior'\);/);
});

test('AUDIT-EOTB2 [SETTINGS]: StartInThirdPerson - shipped ON, taken at the rig\'s attach (a new game) and at the load door (the mod\'s OnLoad)', () => {
  assert.equal(readCameraSettings(null).startInThird, true, 'the bundle ships it on');
  const cam = createEotbCamera();
  cam.loadSettings(null);
  assert.equal(cam.start(), true, 'a new game opens in third person');
  cam.loadSettings((v, k) => (k === 'Camera.StartInThirdPerson' ? false : undefined));
  assert.equal(cam.start(), false);
  // the rig: loadSettings then start, once, beside the attach
  assert.match(rd('src/combat/weaponRig.js'), /eotbCamera\.loadSettings\(modSetting\);[\s\S]{0,700}?eotbCamera\.start\(\);/);
  // the load door restores BOTH lanes, and world.js takes it where it restored the Morrowind camera alone
  openLane();
  try {
    eotbCamera.toggleOffset(false);
    mwViewLoadPose(null);
    assert.equal(eotbCamera.thirdPerson(), true, 'a load re-seeds the sprite camera from the setting');
    assert.match(rd('src/scenes/world.js'), /mwViewLoadPose\(pose\.camera\);/);
    assert.doesNotMatch(rd('src/scenes/world.js'), /mwCamera\.restore\(pose\.camera\)/, 'the Morrowind-only restore is gone from the host');
  } finally { closeLane(); }
});

test('AUDIT-EOTB2 [SETTINGS]: the SwitchShoulder and ToggleInput keys, DOWN-edge off the hosts\' raw set - driven through a real rig', () => {
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
    assert.equal(eotbCamera.mirrored(), !before, 'one press held over three frames switches the shoulder ONCE');
    keys.delete('KeyB');
    rig.frame(1 / 60);
    keys.add('KeyB');
    rig.frame(1 / 60);
    assert.equal(eotbCamera.mirrored(), before, 'released and pressed again: back');
    keys.add('NumpadAdd');
    rig.frame(1 / 60); rig.frame(1 / 60);
    assert.equal(eotbCamera.autoArmed(), !armed, 'ToggleInput arms or disarms the table, once per press');
    keys.delete('NumpadAdd'); rig.frame(1 / 60); keys.add('NumpadAdd'); rig.frame(1 / 60);
    assert.equal(eotbCamera.autoArmed(), armed);
  } finally {
    keys.clear(); rig.frame(1 / 60);
    eotbCamera.toggleOffset(false);
    _resetModSettings();
    eotbCamera.loadSettings(null);
  }
});

// ─────────────────────────────────────────────────────────────────
// THE RECORD
// ─────────────────────────────────────────────────────────────────

test('AUDIT-EOTB2: every [SETTINGS] law is marked in the module that carries it, and the page says the assembly is not in the tree', () => {
  const arc = readdirSync(join(root, 'src/player')).filter((f) => /^eotb/.test(f)).map((f) => rd(`src/player/${f}`)).join('\n');
  for (const law of ['attackString', 'clipFrames', 'turnsToView', 'autoToggleSituation', 'SyncFootsteps', 'ToggleBillboard', 'StartInThirdPerson']) {
    const sites = [...arc.matchAll(new RegExp(law, 'g'))].map((m) => m.index);
    assert.ok(sites.length > 0, `${law} is in the arc`);
    assert.ok(sites.some((i) => /\[SETTINGS\]/.test(arc.slice(Math.max(0, i - 1200), i + 400))), `${law} is marked with its evidence`);
  }
  const page = rd('bible/06-Systems/Eye-Of-The-Beholder.md');
  assert.match(page, /AUDIT-EOTB2/);
  assert.match(page, /not in the tree/i, 'the page says where the assembly is not');
  assert.match(page, /\[SETTINGS\]/, 'and what the sixteen were read from');
});
