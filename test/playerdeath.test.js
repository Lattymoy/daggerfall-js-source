// D1 - THE DEATH SEQUENCE (PlayerDeath.cs). The timed law between
// "health reached 0" and the title menu: the camera sinks a quarter
// of the capsule BELOW the feet at fallSpeed, the HUD fades black
// over FadeDuration, the classic death sound plays once, and
// TimeBeforeReset seconds in the run ends (DFU's
// StartMethods.TitleMenuFromDeath -> InitGame(ANIM0012.VID) -> the
// start menu, which is the host's onReset half).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PlayerDeathSequence, deathCameraTarget, playerDeathSound, raceGenderPain3Sound,
  DEATH_FALL_SPEED, DEATH_TIME_BEFORE_RESET, DEATH_FADE_DURATION, CLASSIC_PLAYER_DEATH_SOUND,
} from '../src/systems/playerDeath.js';
import { RACES } from '../src/systems/races.js';
import { combatVoicesEnabled } from '../src/combat/combatVoices.js';
import { DeathScreen } from '../src/ui/deathScreen.js';
import { SOUND } from '../src/systems/soundClips.js';
import { EYE_HEIGHT, CAPSULE_HEIGHT, CROUCH_EYE_HEIGHT, CROUCH_HEIGHT } from '../src/player/motor.js';
import { KEEP } from '../src/scenes/dataSource.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

test('death: the constants are PlayerDeath.cs verbatim', () => {
  assert.equal(DEATH_FALL_SPEED, 2.5);          // fallSpeed
  assert.equal(DEATH_TIME_BEFORE_RESET, 3);     // TimeBeforeReset
  assert.equal(DEATH_FADE_DURATION, 2);         // FadeDuration
  // classicPlayerDeathSound is WoodElfMalePain1 for EVERY race and
  // gender - the race/gender Pain3 table is DFU's CombatVoices option.
  assert.equal(CLASSIC_PLAYER_DEATH_SOUND, SOUND.WoodElfMalePain1);
  assert.equal(SOUND.WoodElfMalePain1, 405);
  // targetCameraHeight = height - height * 1.25: a quarter of the
  // capsule BELOW the feet, which is why the view sinks through it.
  assert.equal(deathCameraTarget(1.8), 1.8 - 1.8 * 1.25);
  assert.ok(deathCameraTarget(CAPSULE_HEIGHT) < 0, 'the target is below the feet');
});

test('death: the camera sinks at fallSpeed and rests at the target', () => {
  const played = [];
  const seq = new PlayerDeathSequence({ playSound: (c) => played.push(c) });
  assert.deepEqual(played, [CLASSIC_PLAYER_DEATH_SOUND], 'the death sound plays once, on death');
  assert.equal(seq.drop, 0);

  seq.tick(0.5);
  assert.ok(Math.abs(seq.drop - DEATH_FALL_SPEED * 0.5) < 1e-9, 'falls at 2.5/s');

  // The full sink is startCameraHeight -> target, and it never passes it
  for (let i = 0; i < 200; i++) seq.tick(1 / 60);
  assert.ok(Math.abs(seq.currentCameraHeight - deathCameraTarget(CAPSULE_HEIGHT)) < 1e-9);
  assert.ok(Math.abs(seq.drop - (EYE_HEIGHT - deathCameraTarget(CAPSULE_HEIGHT))) < 1e-9);
});

test('death: the fade ramps over FadeDuration and clamps at 1', () => {
  const seq = new PlayerDeathSequence({});
  assert.equal(seq.fade, 0);
  seq.tick(1);
  assert.equal(seq.fade, 0.5);
  seq.tick(1);
  assert.equal(seq.fade, 1);
  seq.tick(5);
  assert.equal(seq.fade, 1, 'the fade never overshoots');
});

test('death: the run ends ONCE, strictly after TimeBeforeReset', () => {
  let resets = 0;
  const seq = new PlayerDeathSequence({ onReset: () => resets++ });
  seq.tick(DEATH_TIME_BEFORE_RESET);
  assert.equal(resets, 0, 'C# compares with > - exactly 3s has not elapsed past it');
  seq.tick(0.01);
  assert.equal(resets, 1);
  // The sequence is spent: further ticks neither re-fire nor sink more
  const restingDrop = seq.drop;
  seq.tick(10);
  assert.equal(resets, 1, 'the reset fires once');
  assert.equal(seq.drop, restingDrop);
});

test('death: the screen drives the sequence and ENTER skips to the end', () => {
  let resets = 0;
  const screen = new DeathScreen({ onReset: () => resets++ });
  screen.tick(1);
  assert.ok(screen.drop > 0, 'the host reads drop to sink its camera');
  assert.equal(resets, 0);
  screen.input('confirm');
  assert.equal(resets, 1, 'ENTER ends the run rather than reloading the same scene');
});

test('death: the video is in the ingest diet and the hosts share ONE end-of-run seam', () => {
  // AUDIT 19's rule: a VID is named into the diet only when something
  // plays it - D1 is what wires ANIM0012.
  assert.equal(KEEP('ANIM0012.VID'), true);
  assert.equal(KEEP('ANIM0012.VID', true), true, 'the lean diet keeps it too');
  // The seam plays the video THEN returns to the bare URL (the menu),
  // and a missing video costs the video, not the return.
  const shared = code('scenes/shared.js');
  assert.match(shared, /ANIM0012\.VID/);
  assert.ok(shared.indexOf('playVideo(') < shared.indexOf('location.href = location.pathname'),
    'the video plays before the menu');
  // All four gameplay hosts route through it (the four-hosts rule)
  for (const h of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js']) {
    assert.match(code(h), /endRunToTitleMenu\(renderer\)/, `${h} ends the run through the shared seam`);
  }
});

test('death: every overlay slot TICKS, or the sequence stalls in that host alone', () => {
  // AUDIT D-C1: raising the screen and ending the run are not enough -
  // the sequence needs a clock, and each host owns its own overlay
  // slot. worldModes' interior arm DREW its overlay and never ticked
  // it, so dying inside a building froze the death sequence and the
  // run never ended. One pin over all three slots (world and exterior
  // share townTalk's).
  assert.match(code('scenes/townTalk.js'), /overlay\?\.tick\?\.\(dt\)/,
    'townTalk (world + exterior) must tick its overlay');
  assert.match(code('scenes/dungeonContext.js'), /activeOverlay\.tick\?\.\(dt\)/,
    'the dungeon context must tick its overlay');
  // S40: the interior arm CAPTURES the window before ticking, because
  // a window may now clear the slot from inside its own tick (the rest
  // window's death path does) and the draw below would then read null.
  assert.match(code('scenes/worldModes.js'), /const w = interiorOverlay;\n\s+w\.tick\?\.\(dt\);/,
    'the interior arm must tick its overlay');
});

// ---------------------------------------------------------------
// DC1: the camera sink is WIRED - the drop reaches cam.pos in all
// four hosts, and the sequence starts from the LIVE eye and capsule
// (PlayerEntity_OnDeath reads mainCamera.localPosition.y and
// playerController.height at the death, not the standing pair).
// ---------------------------------------------------------------
test('DC1: a crouched death sinks from the crouched eye toward the CROUCHED quarter-capsule', () => {
  const seq = new PlayerDeathSequence({ eyeHeight: CROUCH_EYE_HEIGHT, capsuleHeight: CROUCH_HEIGHT });
  assert.equal(seq.startCameraHeight, CROUCH_EYE_HEIGHT);
  assert.equal(seq.targetCameraHeight, deathCameraTarget(CROUCH_HEIGHT));
  assert.ok(Math.abs(deathCameraTarget(CROUCH_HEIGHT) - (0.9 - 0.9 * 1.25)) < 1e-9, '-0.225: a quarter of the CROUCHED capsule below the feet');
  for (let i = 0; i < 200; i++) seq.tick(1 / 60);
  assert.ok(Math.abs(seq.drop - (CROUCH_EYE_HEIGHT - deathCameraTarget(CROUCH_HEIGHT))) < 1e-9, 'the full crouched sink is 1.025, not the standing 2.15');
});

test('DC1: the three direct hosts pass the LIVE eye and capsule and sink cam.pos by the drop', () => {
  // The construction reads the motor at the death (PlayerEntity_OnDeath's
  // live reads), and the frame subtracts the drop AFTER the eye write -
  // off player.eye's fresh array, so it is per-frame, never cumulative.
  for (const [h, overlaySlot] of [
    ['scenes/world.js', 'townTalk.overlay'],
    ['scenes/exterior.js', 'townTalk.overlay'],
    ['scenes/worldModes.js', 'interiorOverlay'],
  ]) {
    const src = code(h);
    assert.match(src, /new DeathScreen\(\{ eyeHeight: player\.eye\[1\] - player\.pos\[1\], capsuleHeight: player\.height, onReset:/,
      `${h} constructs the death screen from the LIVE motor heights`);
    const sink = `if (${overlaySlot} instanceof DeathScreen) cam.pos[1] -= ${overlaySlot}.drop;`;
    assert.ok(src.includes(sink), `${h} sinks its camera by the sequence's drop`);
    // ORDER: the sink must follow the frame's eye write, or the eye
    // write undoes it. Find the sink, then the nearest eye write above.
    const at = src.indexOf(sink);
    const eyeWrite = src.lastIndexOf('cam.pos = player.eye;', at);
    assert.ok(eyeWrite !== -1 && at - eyeWrite < 500, `${h}: the sink rides immediately after the per-frame eye write`);
  }
});

test('DC1: the standalone dungeon sinks OUTSIDE the overlay-held walk branch, through the context seam', () => {
  // dungeon.js's whole walk branch is HELD while any overlay is up -
  // the death screen included - so a sink inside it would never run
  // during the one state it exists for. The sink is its own absolute
  // write off the motionless eye, after the branch closes.
  const scene = code('scenes/dungeon.js');
  assert.match(scene, /if \(walkMode && \(ctx\.deathDrop \?\? 0\) > 0\) \{\n\s+const _eye = player\.eye;\n\s+cam\.pos = \[_eye\[0\], _eye\[1\] - ctx\.deathDrop, _eye\[2\]\];\n\s+\}/,
    'the absolute sink write exists');
  const sinkAt = scene.indexOf('ctx.deathDrop ?? 0) > 0');
  const flyBranch = scene.indexOf("} else if (!overlayHeld) {");
  assert.ok(flyBranch !== -1 && sinkAt > flyBranch, 'the sink sits after the held walk/fly branches close');
  // The view matrix is built from cam.pos BELOW the sink, or the sink
  // writes a camera nobody renders.
  // MW-D25: the view is built from the camera machine's eye, and the
  // machine reads cam.pos as its first-person eye - so the sink still
  // flows into the frame through mwViewFrame's fpEye. Both halves of
  // that route are asserted, below the sink.
  const mwvAt = scene.indexOf('mwViewFrame({ fpEye: cam.pos', sinkAt);
  assert.ok(mwvAt !== -1, 'the sink lands before the machine reads the eye');
  const view = scene.indexOf('const view = lookAt(mwv.eye', mwvAt);
  assert.ok(view !== -1, 'the sink lands before the frame builds its view');
  // The seam's two halves: the context computes the drop off its own
  // overlay slot, and the scene binds the live motor for the start heights.
  const ctxSrc = code('scenes/dungeonContext.js');
  assert.match(ctxSrc, /get deathDrop\(\) \{ return activeOverlay instanceof DeathScreen \? activeOverlay\.drop : 0; \}/,
    'the context exposes the drop (zero outside a death)');
  assert.match(ctxSrc, /const _ms = opts\.motorState\?\.\(\) \?\? null;\n\s+activeOverlay = new DeathScreen\(\{ eyeHeight: _ms\?\.eyeLevel, capsuleHeight: _ms\?\.capsule, onReset:/,
    'the presenter takes the live heights through opts.motorState');
  assert.match(scene, /motorState: \(\) => \(_motorRef \? \{ eyeLevel: _motorRef\.eye\[1\] - _motorRef\.pos\[1\], capsule: _motorRef\.height \} : null\)/,
    'the scene passes the seam, late-bound like the F222 pose');
  assert.match(scene, /_motorRef = player;/, 'the slot binds once the motor exists');
});

// ---------------------------------------------------------------
// MERGE AUDIT: the CombatVoices arm of the death sound
// ---------------------------------------------------------------
test('merge audit: CombatVoices picks the character OWN race/gender Pain3, and it ships ON', () => {
  // PlayerEntity_OnDeath (:164-170): the classic clip is the arm DFU
  // takes when the setting is OFF; with it on - which is how it ships
  // - the clip is GetRaceGenderPain3Sound(race, gender). The port
  // played the classic clip for every character, which is DFU's
  // MINORITY path, not its default.
  const on = () => true, off = () => false;
  assert.equal(playerDeathSound(RACES.Breton, 'female', off), CLASSIC_PLAYER_DEATH_SOUND);
  assert.equal(playerDeathSound(RACES.Breton, 'female', on), 45);
  assert.equal(playerDeathSound(RACES.Nord, 'male', on), 398);
  // The whole switch, verbatim from SoundClips.cs. ARGONIAN MALE
  // PAIN3 IS 42 - the male block runs 390..412 and STOPS, and the
  // eighth male Pain3 sits alone in the low block ("// See 390-412").
  // Every other race allows Pain1 + 2; deriving this one that way is
  // off by 371, which is why the table is pinned whole.
  assert.deepEqual(
    [RACES.Breton, RACES.Redguard, RACES.Nord, RACES.DarkElf, RACES.HighElf, RACES.WoodElf, RACES.Khajiit, RACES.Argonian]
      .map((r) => [raceGenderPain3Sound(r, 'male'), raceGenderPain3Sound(r, 'female')]),
    [[392, 45], [395, 48], [398, 51], [401, 54], [404, 57], [407, 60], [410, 424], [42, 427]],
  );
  // NEVER TRAPS: an unknown race yields None in DFU; the port falls to
  // the classic clip rather than dying in silence.
  assert.equal(raceGenderPain3Sound(999, 'male'), -1);
  assert.equal(playerDeathSound(999, 'male', on), CLASSIC_PLAYER_DEATH_SOUND);
});

test('merge audit: the sequence plays the identity clip, and no identity keeps the classic one', () => {
  const played = [];
  const seq = new PlayerDeathSequence({
    race: RACES.Khajiit, gender: 'female', voices: () => true,
    playSound: (c) => played.push(c),
  });
  assert.deepEqual(played, [424], 'KhajiitFemalePain3');
  assert.equal(seq.deathSound, 424);
  // A host that dies before chargen wrote an identity: DFU cannot be
  // in that state, so there is no law to port - the classic clip is
  // the safe read, and it must not become silence.
  const bare = [];
  new PlayerDeathSequence({ playSound: (c) => bare.push(c), voices: () => true });
  assert.deepEqual(bare, [CLASSIC_PLAYER_DEATH_SOUND]);
});

test('merge audit: the death screen reads the LIVE character, not a host argument', () => {
  // Four hosts construct DeathScreen and none of them passes an
  // identity; the seam reads the shared player entity so the clip is
  // right in all four rather than in whichever one got edited.
  const played = [];
  const screen = new DeathScreen({ entity: { raceId: RACES.Argonian, gender: 'male' } });
  assert.equal(screen.sequence.deathSound,
    combatVoicesEnabled() ? 42 : CLASSIC_PLAYER_DEATH_SOUND);
  assert.ok(played.length === 0);
});
