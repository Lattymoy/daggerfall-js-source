// AUDIT 26 - the audio cluster (F023, F088 REFUTED, F089, F090, F184).
//
// F023: ToggleSheath plays the WEAPON's GetEquipSound, not the dead 78
//       default (WeaponManager.SetWeapon :780 overwrites the field).
// F088: REFUTED - see the ambientEffects.js note. DFU's ambient player
//       is NOT disabled indoors; its dungeon-only water arm proves it.
// F089: the graveyard ambient layer - a second channel on its own
//       1-80s window, armed by the location rect.
// F090: the dungeon water footstep HYSTERESIS (enter 0.57, leave 0.95).
// F184: the door close sound is OnCompleteClose's, after the swing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { equipSoundFor } from '../src/characters/weapons.js';
import { SOUND } from '../src/systems/soundClips.js';
import { FootstepMachine } from '../src/systems/footsteps.js';
import {
  AmbientEffects, CEMETERY_AMBIENT_SOUNDS, CEMETERY_AMBIENT_WAITS, EXTERIOR_AMBIENT_WAITS,
} from '../src/systems/ambientEffects.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ── F023 ──────────────────────────────────────────────────────────

test('F023: the equip clips are DFU\'s eight indices, by weapon type', () => {
  // SoundClips.cs:466-469, :512-515 - pinned as LITERALS so the
  // roster cannot drift.
  assert.equal(SOUND.EquipShortBlade, 377);
  assert.equal(SOUND.EquipLongBlade, 378);
  assert.equal(SOUND.EquipTwoHandedBlade, 379);
  assert.equal(SOUND.EquipStaff, 380);
  assert.equal(SOUND.EquipMaceOrHammer, 413);
  assert.equal(SOUND.EquipFlail, 414);
  assert.equal(SOUND.EquipAxe, 415);
  assert.equal(SOUND.EquipBow, 416);
  // GetEquipSound's own grouping (:839-867) - NOT the port's
  // weaponTypeForItem, which folds the two-handers in with the long
  // blades. Every weapon template, so a mis-grouped case shows.
  const g = (t) => equipSoundFor({ templateIndex: t });
  assert.equal(g(113), SOUND.EquipShortBlade, 'Dagger');
  assert.equal(g(114), SOUND.EquipShortBlade, 'Tanto');
  assert.equal(g(116), SOUND.EquipShortBlade, 'Shortsword');
  assert.equal(g(117), SOUND.EquipShortBlade, 'Wakizashi');
  assert.equal(g(118), SOUND.EquipLongBlade, 'Broadsword');
  assert.equal(g(119), SOUND.EquipLongBlade, 'Saber');
  assert.equal(g(120), SOUND.EquipLongBlade, 'Longsword');
  assert.equal(g(121), SOUND.EquipLongBlade, 'Katana');
  assert.equal(g(122), SOUND.EquipTwoHandedBlade, 'Claymore - TWO-HANDED, not long');
  assert.equal(g(123), SOUND.EquipTwoHandedBlade, 'Dai-katana - likewise');
  assert.equal(g(115), SOUND.EquipStaff, 'Staff');
  assert.equal(g(124), SOUND.EquipMaceOrHammer, 'Mace');
  assert.equal(g(126), SOUND.EquipMaceOrHammer, 'Warhammer shares it');
  assert.equal(g(125), SOUND.EquipFlail, 'Flail is its own');
  assert.equal(g(127), SOUND.EquipAxe, 'Battle Axe');
  assert.equal(g(128), SOUND.EquipAxe, 'War Axe');
  assert.equal(g(129), SOUND.EquipBow, 'Short Bow');
  assert.equal(g(130), SOUND.EquipBow, 'Long Bow');
  assert.equal(g(131), null, 'an Arrow hits GetEquipSound\'s default (SoundClips.None)');
  // The explicit claws guard is DOCUMENTARY, not load-bearing:
  // WERECLAWS_ITEM carries no templateIndex, so it reaches the same
  // `default:` anyway (an EQUIVALENT mutant, recorded not contorted).
  // DFU's own SetMelee forces DrawWeaponSound = None (:764).
  assert.equal(equipSoundFor({ werecreatureClaws: true }), null, 'the claws draw silently (V4)');
  assert.equal(equipSoundFor(null), null);
});

// ── F088 ──────────────────────────────────────────────────────────

test('F088 REFUTED: the carry-over stands, and the reason is written down', () => {
  // The row argued the ambient component is disabled indoors with
  // ExteriorParent. That hierarchy claim is not in DFU's scripts at
  // all, and the code refutes it - so the port keeps the carry-over
  // and records WHY, because this is the second challenge to the same
  // decision. The note must name the decisive evidence, not the weak
  // cemetery-guard argument the row correctly attacked.
  const a = src('systems/ambientEffects.js');
  assert.ok(a.includes('CHALLENGED by AUDIT 26 F088'), 'the challenge is recorded');
  assert.ok(a.includes('blockWaterLevel != 10000'), 'and refuted by the dungeon-only water arm');
  assert.ok(a.includes('isPlayerInsideDungeon'), 'which is assigned only inside a dungeon');
  // and the behaviour is unchanged: no interior transition clears it
  assert.equal(a.includes("setPreset('none') on the interior"), true, 'the departure is still named as one');
});

// ── F089 ──────────────────────────────────────────────────────────

test('F089: the graveyard layer is a SECOND channel on its own window', () => {
  // cemeteryAmbientSounds (:45-50) - the bird twice, so two draws in
  // three; CemeteryMin/MaxWaitTime (:28-29) = Next(1, 80).
  assert.deepEqual([...CEMETERY_AMBIENT_SOUNDS], [113, 14, 14]);
  assert.deepEqual({ ...CEMETERY_AMBIENT_WAITS }, { minWait: 1, maxWait: 80 });
  assert.notDeepEqual({ ...CEMETERY_AMBIENT_WAITS }, { ...EXTERIOR_AMBIENT_WAITS },
    'it does NOT share the ordinary wilderness window');

  const played = [];
  const engine = { play3d: (id) => played.push(id), playOneShot: (id) => played.push(id), loop: () => ({ stop() {} }) };
  const a = new AmbientEffects(EXTERIOR_AMBIENT_WAITS, engine, () => 0);   // rng 0 -> the shortest waits, first clip
  a.preset = 'sunnyDay';
  // unarmed: nothing from the graveyard list however long we tick
  for (let i = 0; i < 200; i++) a.update(1, { playerPos: [0, 0, 0] });
  assert.equal(played.includes(113), false, 'no howl outside a graveyard');

  played.length = 0;
  a.setCemeteryNearby(true);
  for (let i = 0; i < 10; i++) a.update(1, { playerPos: [0, 0, 0] });
  assert.ok(played.includes(113), 'armed, the howl plays on its own counter');

  // ...and the INSIDE gate: `IsCemeteryNearby && !IsPlayerInside` (:154)
  played.length = 0;
  for (let i = 0; i < 200; i++) a.update(1, { playerPos: [0, 0, 0], inside: true });
  assert.equal(played.includes(113), false, 'the layer is silent indoors');

  // disarming stops it
  played.length = 0;
  a.setCemeteryNearby(false);
  for (let i = 0; i < 200; i++) a.update(1, { playerPos: [0, 0, 0] });
  assert.equal(played.includes(113), false, 'the exit event clears it');
});

test('F089: RE-entering a graveyard restarts the countdown (StartCemeteryWaiting on the edge)', () => {
  // DFU calls StartCemeteryWaiting from OnEnterLocationRect (:527),
  // so each entry re-rolls Next(1, 80) and zeroes the counter - a
  // partly-elapsed wait does not carry across a visit.
  const played = [];
  const engine = { play3d: (id) => played.push(id), playOneShot: (id) => played.push(id), loop: () => ({ stop() {} }) };
  // rng 0.5 -> cemetery wait = 1 + floor(0.5 * 79) = 40s
  const a = new AmbientEffects(EXTERIOR_AMBIENT_WAITS, engine, () => 0.5);
  a.preset = 'sunnyDay';
  a.setCemeteryNearby(true);
  for (let i = 0; i < 35; i++) a.update(1, { playerPos: [0, 0, 0] });
  assert.equal(played.includes(113), false, '35s of a 40s wait: not yet');
  a.setCemeteryNearby(false);
  a.setCemeteryNearby(true);           // leave and come back
  played.length = 0;
  for (let i = 0; i < 10; i++) a.update(1, { playerPos: [0, 0, 0] });
  // ANY of the three clips, not just the howl - at this rng the draw
  // lands on the bird, and watching one entry let the mutation hide.
  const cemetery = () => played.some((id) => CEMETERY_AMBIENT_SOUNDS.includes(id));
  assert.equal(cemetery(), false,
    'the clock RESTARTED - without the edge reset 35+10 would have passed 40 and sounded');
  // and it does still sound once the fresh 40s elapses
  for (let i = 0; i < 40; i++) a.update(1, { playerPos: [0, 0, 0] });
  assert.equal(cemetery(), true, 'the restarted countdown still fires');
});

test('F089: the location rect arms it, on the same edge the crime clear rides', () => {
  const w = src('scenes/world.js');
  assert.ok(w.includes('ambience.setCemeteryNearby(_musicLocationType() === LOCATION_TYPES.Graveyard);'),
    'OnEnterLocationRect (:518-529) - a Graveyard, entered from outside');
  assert.ok(w.includes('ambience.setCemeteryNearby(false);'), 'OnExitLocationRect (:531-534)');
});

// ── F090 ──────────────────────────────────────────────────────────

test('F090: the dungeon water footsteps HYSTERESE - in at 0.57, out at 0.95', () => {
  // PlayerFootsteps :189 vs :199-208 - between the two thresholds the
  // current sound STICKS. Both hosts used to recompute from the ENTER
  // threshold alone, so wading out went back to stone 0.38 early.
  const m = new FootstepMachine();
  const surf = 0;
  assert.equal(m.waterStep(1.0, surf, false), false, 'well above the line: stone');
  // entering: centre - 0.57 < 0  =>  centre < 0.57
  assert.equal(m.waterStep(0.6, surf, false), false, 'not yet - 0.6 - 0.57 is still above');
  assert.equal(m.waterStep(0.5, surf, false), true, 'entered the shallows');
  // THE LATCH: between 0.57 and 0.95 the splash holds while rising
  assert.equal(m.waterStep(0.6, surf, false), true, 'still splashing on the way out');
  assert.equal(m.waterStep(0.94, surf, false), true, '...right up to 0.95');
  assert.equal(m.waterStep(0.95, surf, false), false, 'and only then back to stone');
  // a cleared water level drops it at once (blockWaterLevel == 10000)
  m.waterStep(0.5, surf, false);
  assert.equal(m.dungeonShallow, true);
  assert.equal(m.waterStep(0.5, null, false), false, 'no water level, no splash');
  // swimming leaves the flag alone - the submerged arm owns that frame
  m.waterStep(0.5, surf, false);
  assert.equal(m.waterStep(5.0, surf, true), true, 'a swimmer does not reset it');
});

test('F090: both dungeon hosts drive the LATCH, not the raw threshold', () => {
  for (const f of ['scenes/dungeon.js', 'scenes/worldModes.js']) {
    const s = src(f);
    assert.ok(s.includes('waterStep(player.pos[1] + 0.9,'), `${f} asks the machine`);
    assert.equal(/dungeonShallow: [^\n]*0\.57\) </.test(s), false, `${f} no longer recomputes the enter threshold`);
  }
});

// ── F184 ──────────────────────────────────────────────────────────

test('F184: the door close sound fires at the END of the swing', () => {
  const a = src('world/actionSystem.js');
  // Close() plays nothing (:311-332)
  const close = a.slice(a.indexOf('_closeDoor(o, byPlayer = false)'));
  assert.equal(close.slice(0, 700).includes('this.onDoorState?.(o, false)'), false,
    'Close() itself is silent');
  // OnCompleteClose does (:339-346), before MakeTrigger(false)
  assert.ok(a.includes('if (closing) this.onDoorState?.(o, false);'), 'the completion plays it');
  const i = a.indexOf('if (closing) this.onDoorState?.(o, false);');
  const after = a.slice(i, i + 400);
  assert.ok(after.includes('_settleDoorBucket(o)'), 'sound, THEN the collider solidifies - DFU\'s order');
  // the OPEN side still fires at the START (:296-302), which is what
  // made this a defect rather than a convention
  assert.ok(a.includes('this.onDoorState?.(o, true);'), 'open still sounds at the start');
});
