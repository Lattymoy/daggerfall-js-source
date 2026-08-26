// AUDIT 26 follow-up: GetSwingSound, the last name-keyed weapon switch.
//
// The port keyed swingSoundFor on the item's DISPLAY NAME (two Sets of
// name strings) and fell through to SwingMediumPitch for everything
// else. DaggerfallUnityItem.GetSwingSound (DaggerfallUnityItem.cs
// :878-906) switches on TEMPLATE INDEX and has four arms plus a
// default, so the port was wrong three ways at once:
//
//   * BOWS. DFU answers SoundClips.ArrowShoot for Short_Bow/Long_Bow;
//     the port's default gave them the medium melee whoosh.
//   * THE DEFAULT. DFU answers SoundClips.None - silence - for anything
//     that is not one of the eighteen weapons (an Arrow is in
//     ItemGroups.Weapons and still lands there); the port whooshed.
//   * RENAMED WEAPONS. A name is not immutable:
//     loot.createRegularMagicItem renames every enchanted weapon to its
//     MAGIC.DEF name, and itemTemplates.json spells 117/123
//     "Wakizashi"/"Dai-katana" against the port table's
//     "Wakazashi"/"Dai-Katana". This is the same rot AUDIT 24 wave 29
//     found in GetWeaponSkillUsed, where a renamed magic weapon hit
//     Skills.None and was refused by every restricted career.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOUND, swingSoundFor } from '../src/systems/soundClips.js';
import { WEAPONS } from '../src/characters/weapons.js';

test('audit26 swing: the SoundClips ids are the DFU records, byte-exact', () => {
  // SoundClips.cs:30, :157-158, :425 - four separate runs of the enum.
  assert.deepEqual({
    ArrowShoot: SOUND.ArrowShoot,
    SwingLowPitch: SOUND.SwingLowPitch,
    SwingHighPitch: SOUND.SwingHighPitch,
    SwingMediumPitch: SOUND.SwingMediumPitch,
    None: SOUND.None,
  }, {
    ArrowShoot: 3,
    SwingLowPitch: 105,
    SwingHighPitch: 106,
    SwingMediumPitch: 347,
    None: -1,          // SoundClips.cs:24
  });
});

test('audit26 swing: swingSoundFor = GetSwingSound over EVERY weapon template', () => {
  // DaggerfallUnityItem.cs:880-905, case by case. All eighteen weapon
  // templates plus Arrow, none omitted, so a family that silently fell
  // through to a neighbour's clip would show up here.
  assert.deepEqual(
    Object.fromEntries(Object.entries(WEAPONS).map(([n, i]) => [n, swingSoundFor({ templateIndex: i })])),
    {
      Warhammer: 105, Battle_Axe: 105, Katana: 105, Claymore: 105,       // SwingLowPitch
      Dai_Katana: 105, Flail: 105,
      Broadsword: 347, Longsword: 347, Saber: 347, Wakazashi: 347,       // SwingMediumPitch
      War_Axe: 347, Staff: 347, Mace: 347,
      Dagger: 106, Tanto: 106, Shortsword: 106,                          // SwingHighPitch
      Short_Bow: 3, Long_Bow: 3,                                         // ArrowShoot - NOT a melee whoosh
      Arrow: -1,   // an Arrow is in ItemGroups.Weapons but hits the switch's `default: return SoundClips.None`
    },
  );
  // Four distinct clips plus None - the port's name table could only
  // ever answer three, and answered the middle one for everything else.
  assert.equal(new Set(Object.values(WEAPONS).map((i) => swingSoundFor({ templateIndex: i }))).size, 5);
});

test('audit26 swing: the default arm is SILENCE, and the key is the template not the name', () => {
  // `default: return SoundClips.None` (:904-905).
  assert.equal(swingSoundFor({ templateIndex: 102 }), SOUND.None, 'Armor.Cuirass is not a weapon template');
  assert.equal(swingSoundFor({ templateIndex: 999 }), SOUND.None);
  assert.equal(swingSoundFor({}), SOUND.None, 'no template index at all');
  // The name is inert: a bare name answers the default, and a RENAMED
  // weapon keeps the family its template gives it.
  assert.equal(swingSoundFor({ name: 'Warhammer' }), SOUND.None, 'the switch is on TemplateIndex, not the name');
  assert.equal(swingSoundFor({ name: 'Longsword' }), SOUND.None);
  for (const [name, templateIndex, clip] of [
    ['Wyrd Bludgeon', WEAPONS.Warhammer, SOUND.SwingLowPitch],
    ['Wakizashi', WEAPONS.Wakazashi, SOUND.SwingMediumPitch],          // itemTemplates.json's own spelling
    ['Dai-katana', WEAPONS.Dai_Katana, SOUND.SwingLowPitch],           // idem
    ['Auriel\'s Bow', WEAPONS.Long_Bow, SOUND.ArrowShoot],
    ['Shadow Sting', WEAPONS.Dagger, SOUND.SwingHighPitch],
  ]) {
    assert.equal(swingSoundFor({ name, templateIndex }), clip,
      `${name} keeps its template's swing clip after createRegularMagicItem renames it`);
  }
});

test('audit26 swing: the barehanded arm is the CALLERS\' SwingHighPitch, not this switch', () => {
  // GetSwingSound never sees a null item. Both callers supply the
  // barehanded default themselves, and both pick SwingHighPitch:
  // WeaponManager.SetMelee (:760-766) writes it into
  // FPSWeapon.SwingWeaponSound, and EnemySounds.PlayMissSound's else
  // arm (EnemySounds.cs:151-154) plays it directly.
  assert.equal(swingSoundFor(null), SOUND.SwingHighPitch);
  assert.equal(swingSoundFor(undefined), SOUND.SwingHighPitch);
  assert.notEqual(swingSoundFor(null), SOUND.None, 'fists are NOT the silent default arm');
});

test('audit26 swing: SoundClips.None is inert at the audio layer, so no caller can play it', () => {
  // DFU's PlayOneShot resolves the clip first and plays nothing when it
  // is null (DaggerfallAudioSource.cs:188-198). The port's equivalent
  // is sndFile.isValidIndex, which refuses a negative record, so both
  // playOneShot and play3d drop -1 before they build a source - the
  // hosts that play swingSoundFor's result directly need no guard.
  assert.equal(SOUND.None, -1);
  const src = readFileSync(new URL('../src/formats/sndFile.js', import.meta.url), 'utf8');
  assert.match(src, /isValidIndex\(sound\)\s*\{\s*return sound >= 0 && sound < this\.count;/,
    'sndFile.isValidIndex refuses a negative record');
  assert.match(readFileSync(new URL('../src/systems/audio.js', import.meta.url), 'utf8'),
    /if \(!this\.isValidIndex|const buf = this\._buffer\(index\);\n\s*if \(!buf\) return undefined;/,
    'playOneShot drops an unresolvable record instead of building a source');
});
