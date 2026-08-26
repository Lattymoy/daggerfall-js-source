// AUDIT 26 follow-up: the two WeaponManager laws the earlier wave left
// open because they belonged in files it was not holding.
//
// F023 - EVERY WEAPON MADE THE SAME DRAW SOUND. The port played one
// record (78) off every sheathe toggle. In DFU 78 is nothing but the
// FIELD INITIALIZER of FPSWeapon.DrawWeaponSound (FPSWeapon.cs:62):
// WeaponManager.ApplyWeapon runs from Update and hands the screen
// weapon to either SetMelee (:760-766, DrawWeaponSound = None) or
// SetWeapon (:768-781, DrawWeaponSound = weapon.GetEquipSound()), so
// by the time ToggleSheath (:1115-1128) calls PlayActivateSound
// (FPSWeapon.cs:290-297) the field holds THAT WEAPON's equip clip.
// 78 therefore survives only on the fists path - which is exactly the
// path ToggleSheath's `WeaponType != Melee && != None` gate refuses to
// sound - and is unreachable from a sheathe toggle in DFU.
//
// F025 - THE WEAPON STAYED DRAWN DURING THE EQUIP COUNTDOWN.
// WeaponManager.Update hides the weapon while the used hand's
// EquipCountdown runs (:276-280) and while the player is paralyzed or
// CLIMBING (:236-239); the port's shown() carried neither. (It did
// carry an INVENTED bow-cooldown hide, which a sibling finding removed:
// :230's `return` sits above every ShowWeapons call, so DFU leaves the
// bow drawn for the cooldown. These are the real legs, not that one.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUND, equipSoundFor } from '../src/systems/soundClips.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';

const rig = (over = {}) => {
  const audio = { played: [], playOneShot(id) { audio.played.push(id); } };
  const r = createWeaponRig({
    renderer: {}, canvas: { clientWidth: 1000, clientHeight: 800 },
    fetchBytes: () => { throw new Error('no art in tests'); },
    palette: null, audio, entity: { items: [] }, ...over,
  });
  r._audio = audio;
  return r;
};

// ---------------------------------------------------------------
// F023: GetEquipSound, the whole weapon arm
// ---------------------------------------------------------------

test('audit26 equip: the SoundClips ids are the DFU records, byte-exact', () => {
  // SoundClips.cs:466-469 and :512-515 - two separate runs of the enum,
  // which is why the eight ids are not contiguous.
  assert.deepEqual({
    EquipShortBlade: SOUND.EquipShortBlade,
    EquipLongBlade: SOUND.EquipLongBlade,
    EquipTwoHandedBlade: SOUND.EquipTwoHandedBlade,
    EquipStaff: SOUND.EquipStaff,
    EquipMaceOrHammer: SOUND.EquipMaceOrHammer,
    EquipFlail: SOUND.EquipFlail,
    EquipAxe: SOUND.EquipAxe,
    EquipBow: SOUND.EquipBow,
    None: SOUND.None,
  }, {
    EquipShortBlade: 377,
    EquipLongBlade: 378,
    EquipTwoHandedBlade: 379,
    EquipStaff: 380,
    EquipMaceOrHammer: 413,
    EquipFlail: 414,
    EquipAxe: 415,
    EquipBow: 416,
    None: -1,          // SoundClips.cs:24
  });
});

test('audit26 equip: equipSoundFor = GetEquipSound over EVERY weapon template', () => {
  // DaggerfallUnityItem.cs:838-869, case by case. All eighteen weapon
  // templates, none omitted, so a family that silently fell through to
  // a neighbour's clip would show up here.
  const W = WEAPONS;
  assert.deepEqual(
    Object.fromEntries(Object.entries(W).map(([n, i]) => [n, equipSoundFor({ templateIndex: i })])),
    {
      Dagger: 377, Tanto: 377, Wakazashi: 377, Shortsword: 377,          // EquipShortBlade
      Broadsword: 378, Longsword: 378, Saber: 378, Katana: 378,          // EquipLongBlade
      Claymore: 379, Dai_Katana: 379,                                    // EquipTwoHandedBlade
      Staff: 380,                                                        // EquipStaff
      Mace: 413, Warhammer: 413,                                         // EquipMaceOrHammer
      Flail: 414,                                                        // EquipFlail
      Battle_Axe: 415, War_Axe: 415,                                     // EquipAxe
      Short_Bow: 416, Long_Bow: 416,                                     // EquipBow
      Arrow: -1,   // an Arrow is in ItemGroups.Weapons but hits the switch's `default: return SoundClips.None`
    },
  );
  // The switch's default arm for everything else - and the eight ids
  // are DISTINCT, which is the whole point of the finding.
  assert.equal(equipSoundFor(null), SOUND.None);
  assert.equal(equipSoundFor(undefined), SOUND.None);
  assert.equal(equipSoundFor({ templateIndex: 102 }), SOUND.None, 'Armor.Cuirass is not the weapon arm');
  assert.equal(equipSoundFor({ name: 'Dagger' }), SOUND.None, 'the switch is on TemplateIndex, not the name');
  assert.equal(new Set(Object.values(WEAPONS).map((i) => equipSoundFor({ templateIndex: i }))).size, 9,
    'eight distinct equip clips plus None - not one sound for every weapon');
});

test('audit26 equip: the rig sounds the weapon in hand, per family, on the unsheathe only', () => {
  // ToggleSheath -> PlayActivateSound -> DrawWeaponSound, which
  // SetWeapon (:780) rewrote for whatever ApplyWeapon last handed it.
  const FAMILIES = [
    ['Dagger', WEAPONS.Dagger, SOUND.EquipShortBlade],
    ['Katana', WEAPONS.Katana, SOUND.EquipLongBlade],
    ['Dai-Katana', WEAPONS.Dai_Katana, SOUND.EquipTwoHandedBlade],
    ['Staff', WEAPONS.Staff, SOUND.EquipStaff],
    ['Warhammer', WEAPONS.Warhammer, SOUND.EquipMaceOrHammer],
    ['Flail', WEAPONS.Flail, SOUND.EquipFlail],
    ['War Axe', WEAPONS.War_Axe, SOUND.EquipAxe],
    ['Long Bow', WEAPONS.Long_Bow, SOUND.EquipBow],
  ];
  for (const [name, templateIndex, clip] of FAMILIES) {
    const r = rig();
    r.playerWeapon.weapon = { name, templateIndex, material: 0 };
    r.toggleSheath();                                  // unsheathe: sounds
    assert.deepEqual(r._audio.played, [clip], `${name} unsheathes on ${clip}`);
    r.toggleSheath();                                  // sheathe: silent (:1117 `if (!Sheathed)`)
    assert.deepEqual(r._audio.played, [clip], `${name} sheathes silently`);
  }
  // Fists: WeaponType Melee, so SetMelee's None is never even reached -
  // ToggleSheath's own gate returns first. Nothing plays, and in
  // particular NOT record 78.
  const bare = rig();
  bare.playerWeapon.weapon = null;
  bare.toggleSheath();
  assert.deepEqual(bare._audio.played, [], 'barehanded unsheathing is silent');
});

// ---------------------------------------------------------------
// F025: WeaponManager.Update's remaining ShowWeapons legs
// ---------------------------------------------------------------

test('audit26 shown: the EQUIP COUNTDOWN hides the weapon (:276-280)', () => {
  // `if ((usingRightHand && EquipCountdownRightHand != 0) ||
  //     (!usingRightHand && EquipCountdownLeftHand != 0))
  //  { ShowWeapons(false); return; }`
  // The port already refused the swing for the countdown (attackInput /
  // clickAttack) but kept drawing the weapon through it.
  const entity = { items: [], equipCountdown: 0 };
  const r = rig({ entity });
  r.toggleSheath();
  assert.equal(r.shown(), true, 'unsheathed with no countdown: drawn (:290)');
  entity.equipCountdown = 3400;                  // EQUIP_DELAY_TIMES katana
  assert.equal(r.shown(), false, 'the swap pause hides it');
  // It comes back the instant the countdown drains to zero - the leg is
  // `!= 0`, nothing latches.
  for (let f = 0; f < 600 && entity.equipCountdown > 0; f++) r.frame(1 / 60);
  assert.equal(entity.equipCountdown, 0);
  assert.equal(r.shown(), true, 'and returns when the pause ends');
  // Sheathed still wins after the countdown clears (:284-287).
  r.toggleSheath();
  assert.equal(r.shown(), false);
});

test('audit26 shown: CLIMBING hides the weapon (:236-239)', () => {
  // `if (PlayerEntity.IsParalyzed || ClimbingMotor.IsClimbing)
  //  { ShowWeapons(false); return; }` - one leg, two halves. Paralysis
  // rides the hosts' per-frame flag into draw(); climbing is a dep.
  let climbing = false;
  const r = rig({ climbing: () => climbing });
  r.toggleSheath();
  assert.equal(r.shown(), true);
  climbing = true;
  assert.equal(r.shown(), false, 'a climbing player shows no weapon');
  climbing = false;
  assert.equal(r.shown(), true, 'and gets it back at the top of the wall');
  // A host that passes no climbing dep keeps DFU's default answer.
  const plain = rig();
  plain.toggleSheath();
  assert.equal(plain.shown(), true);
});

test('audit26 shown: all four hide legs, and the cooldown is still NOT one of them', () => {
  // The whole predicate in one table, so a leg that goes missing or a
  // fifth leg that gets invented both fail here.
  const cases = [
    ['nothing set', {}, true],
    ['climbing', { climbing: true }, false],
    ['spell readied', { spell: true }, false],
    ['equip countdown', { countdown: 500 }, false],
    ['sheathed', { sheathed: true }, false],
  ];
  for (const [name, on, want] of cases) {
    const entity = { items: [], equipCountdown: on.countdown ?? 0 };
    const r = rig({ entity, climbing: () => !!on.climbing, spellArmed: () => !!on.spell });
    if (!on.sheathed) r.toggleSheath();
    assert.equal(r.shown(), want, name);
  }
  // The bow cooldown (:230's bare `return`) hides nothing - the sibling
  // finding's law, re-pinned here so this table stays honest.
  const r = rig();
  r.playerWeapon.weapon = { name: 'Long Bow', templateIndex: WEAPONS.Long_Bow, material: 0 };
  r.toggleSheath();
  r.frame(1 / 60);
  r.playerWeapon.machine.cooldownUntil = r.playerWeapon.machine.now + 1.3;
  assert.equal(r.shown(), true, 'the bow stays drawn for the whole cooldown');
});
