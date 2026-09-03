// AUDIT 54, fix lane 3 (save and audio): the four laws whose fix
// touches more hosts than any single suite owns - the combat-voice
// pitch lift, PlayerFootsteps' FootstepVolumeScale on its three
// one-shots, the graveyard ambient layer's second exterior host, and
// the two volume scales a hit sound is played at.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AudioEngine } from '../src/systems/audio.js';
import { ENEMY_HIT_VOLUME, PLAYER_HIT_VOLUME, SOUND } from '../src/systems/soundClips.js';
import { FOOTSTEP_VOLUME } from '../src/systems/footsteps.js';
import { applyFallLanding } from '../src/scenes/shared.js';
import { AmbientEffects, EXTERIOR_AMBIENT_WAITS } from '../src/systems/ambientEffects.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/** A WebAudio graph that records what the engine set on it. The engine
 *  is otherwise untouched - `enabled` and a running context are all
 *  _ready() asks for, and a pre-seeded buffer skips the SND read. */
function riggedEngine() {
  const shots = [];
  const node = () => ({ connect(n) { return n; } });
  const param = () => ({ value: 0 });
  const ctx = {
    state: 'running',
    destination: node(),
    createGain: () => ({ gain: param(), connect(n) { return n; } }),
    createPanner: () => ({
      positionX: param(), positionY: param(), positionZ: param(), connect(n) { return n; },
    }),
    createBufferSource: () => {
      const src = { buffer: null, playbackRate: param(), connect(n) { return n; }, start() { shots.push(src.playbackRate.value); } };
      return src;
    },
  };
  const e = new AudioEngine();
  e.ctx = ctx;
  e.enabled = true;
  e._ensureCtx = () => {};
  e.buffers.set(42, { duration: 0.5 });
  return { e, shots };
}

test('AUDIT 54: the combat-voice pitch lift REACHES the source, flat and positional', () => {
  // EnemySounds.cs:172-175, FPSWeapon.cs:316-319 and PlayerFootsteps.cs
  // :359-362 are the same four lines three times: read the source's
  // pitch, add Random.Range(0, 0.3f), play the one shot, put it back.
  // A WebAudio source is born per shot and dies with it, so setting
  // playbackRate on it IS that save/restore. The port computed the lift
  // at both producers and dropped it at all thirteen play sites,
  // because neither one-shot entry point could take it.
  const { e, shots } = riggedEngine();
  e.playOneShot(42, 1);
  e.playOneShot(42, 1, 1.2);
  e.play3d(42, [0, 0, 0], 1);
  e.play3d(42, [0, 0, 0], 1, { maxDistance: 16, pitch: 1.3 });
  assert.deepEqual(shots, [1, 1.2, 1, 1.3], 'the default is 1 and a lift really lands on the source');
});

test('AUDIT 54: every combat-voice play site spends the lift it was handed', () => {
  // The value is produced in exactly two places (combatVoices.js's
  // combatVoice/playerVoice) and consumed at thirteen. A site that
  // takes the voice object and plays only `.clip` is the defect.
  const SITES = [
    ['src/scenes/hostCombat.js', 1],      // the ONE player seam, nine callers behind it
    ['src/scenes/dungeonContext.js', 3],
    ['src/scenes/exteriorFoes.js', 4],
    ['src/scenes/cityGuards.js', 4],
    ['src/combat/arrowFlight.js', 1],
  ];
  let total = 0;
  for (const [f, n] of SITES) {
    const src = rd(f);
    const lifts = src.split('\n').filter((l) => /pitch: 1 \+ [A-Za-z]+\.pitchLift|playOneShot\??\.?\(.*, 1 \+ [A-Za-z]+\.pitchLift|1 \+ \(voice\.pitchLift \?\? 0\)/.test(l));
    assert.equal(lifts.length, n, `${f}: ${lifts.length} voice sites carry the lift, expected ${n}`);
    total += lifts.length;
  }
  assert.equal(total, 13, 'all thirteen');
  // ...and the vampire override arm keeps its hard 0, which is DFU's:
  // PlayAttackVoice lifts only in the `customSound == None` arm
  // (FPSWeapon.cs:313-320); :323 is a bare PlayOneShot at the source's
  // own pitch.
  assert.match(rd('src/scenes/hostCombat.js'), /if \(vamp != null\) return \{ clip: vamp, pitchLift: 0 \};/);
});

test('AUDIT 54: fall damage, the hard fall and the large splash carry FootstepVolumeScale', () => {
  // PlayerFootsteps.cs:30 declares FootstepVolumeScale = 0.7f, and all
  // THREE of the component's non-stride one-shots pass it -
  // ApplyPlayerFallDamage (:307-311), HardFallAlert (:315-319) and
  // PlayLargeSplash (:323-326). It is a CHOSEN value on these, not an
  // inherited default: PlayWeaponHitSound in the same file (:331-337)
  // deliberately passes 1f. The port honoured it on the stride and
  // nowhere else, so its three siblings rang 43% too loud.
  assert.equal(FOOTSTEP_VOLUME, 0.7, 'PlayerFootsteps.cs:30');
  const heard = [];
  const sound = (id, vol) => heard.push([id, vol]);
  const entity = { health: 50, maxHealth: 50, stats: {}, items: [] };
  applyFallLanding(entity, 100, { sound, hurt: () => {} });          // ApplyPlayerFallDamage
  applyFallLanding({ ...entity }, 4, { sound, hurt: () => {} });     // HardFallAlert (> threshold/2, <= threshold)
  assert.deepEqual(heard, [[SOUND.FallDamage, FOOTSTEP_VOLUME], [SOUND.FallHard, FOOTSTEP_VOLUME]]);

  // ...and every host sink forwards the caller's volume rather than
  // swallowing it, in all four hosts. The dungeon host plays its own
  // three copies directly, the large splash among them.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    assert.match(rd(f), /sound: \(id, vol\) => audio\.playOneShot\(id, vol\)/, `${f} forwards the scale`);
  }
  const d = rd('src/scenes/dungeonContext.js');
  for (const clip of ['SOUND.FallDamage', 'SOUND.FallHard', 'SOUND.SplashLarge']) {
    assert.ok(d.includes(`audio.playOneShot(${clip}, FOOTSTEP_VOLUME)`), `the dungeon host scales ${clip}`);
  }
  // the ENEMY fall clips are a different component (EnemyMotor
  // .ApplyFallDamage) with no FootstepVolumeScale - they stay at 1.
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js']) {
    assert.equal(/EnemyFallDamage[^\n]*FOOTSTEP_VOLUME/.test(rd(f)), false, `${f} must not scale the enemy fall`);
  }
});

test('AUDIT 54: the graveyard ambient layer is armed in BOTH exterior hosts', () => {
  // AmbientEffectsPlayer.Start subscribes PlayerGPS.OnEnterLocationRect
  // on EVERY instance (:89) and the handler arms IsCemeteryNearby when
  // the entered location is a Graveyard and the player is outside
  // (:518-529). Only the streaming host armed it, so a graveyard opened
  // as ?exterior was silent while ?world howled.
  const a = new AmbientEffects(EXTERIOR_AMBIENT_WAITS);
  assert.equal(a.cemeteryNearby, false, 'a fresh player is not standing in a cemetery');
  a.setCemeteryNearby(LOCATION_TYPES.Graveyard === LOCATION_TYPES.Graveyard);
  assert.equal(a.cemeteryNearby, true);
  a.setCemeteryNearby(false);
  assert.equal(a.cemeteryNearby, false, 'and OnExitLocationRect disarms it');

  const w = rd('src/scenes/world.js'), x = rd('src/scenes/exterior.js');
  assert.match(w, /ambience\.setCemeteryNearby\(_musicLocationType\(\) === LOCATION_TYPES\.Graveyard\)/,
    'the streaming host arms it on the rect edge');
  assert.match(x, /ambience\.setCemeteryNearby\(_musicLocationType\(\) === LOCATION_TYPES\.Graveyard\)/,
    'and the fixed-city host arms it too - it never leaves its one location\'s rect');
  // the `!playerEnterExit.IsPlayerInside` guard (:154-162) reads the
  // host's own state rather than an absent dep in both.
  for (const src of [w, x]) assert.match(src, /ambience\.update\(dt, \{ playerPos: [A-Za-z.]+, inside: false \}\)/);
  // the two INTERIOR hosts must NOT arm it - DFU's handler sets it only
  // when the player is outside, so this is a law about all four hosts,
  // not an omission in two.
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.equal(rd(f).includes('setCemeteryNearby'), false, `${f} stands inside and must not arm it`);
  }
});

test('AUDIT 54: the blow that lands ON the player is PlayerFootsteps\' 1, not EnemySounds\' 1.1', () => {
  // Two scales through one signature (DaggerfallAudioSource.cs:188).
  // EnemySounds.PlayHitSound ends PlayOneShot(sound, 1, 1.1f) - the
  // PLAYER striking a foe. EnemyAttack.SendDamageToPlayer (:404-415)
  // SendMessages PlayWeaponHitSound / PlayWeaponlessHitSound to the
  // PLAYER object, and those are PlayerFootsteps.cs:330-344:
  // PlayOneShot(..., 0, 1f). The port used EnemySounds' constant at
  // every player-taking-hit site, so every blow rang 10% too loud.
  assert.equal(ENEMY_HIT_VOLUME, 1.1, 'EnemySounds.cs:125');
  assert.equal(PLAYER_HIT_VOLUME, 1, 'PlayerFootsteps.cs:334, :342');
  const players = [
    ['src/scenes/world.js', 3], ['src/scenes/exterior.js', 1],
    ['src/scenes/worldModes.js', 3], ['src/scenes/dungeonContext.js', 2],
  ];
  for (const [f, n] of players) {
    const src = rd(f);
    const hits = src.split('\n').filter((l) => /playOneShot\(hitSoundFor\([^)]*\), PLAYER_HIT_VOLUME\)/.test(l));
    assert.equal(hits.length, n, `${f}: ${hits.length} player-taking-hit sites at volumeScale 1, expected ${n}`);
    assert.equal(/hitSoundFor\([^)]*\), 1\.1\)/.test(src), false, `${f} still carries a bare 1.1 hit volume`);
  }
  // the genuinely enemy-side sites keep 1.1, through the named export.
  const enemy = ['src/scenes/hostCombat.js', 'src/scenes/dungeonContext.js', 'src/combat/arrowFlight.js',
    'src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js'];
  for (const f of enemy) {
    assert.match(rd(f), /hitSoundFor\([^)]*\)(, [^)]*)?, ENEMY_HIT_VOLUME/, `${f} keeps EnemySounds' scale where it belongs`);
  }
});
