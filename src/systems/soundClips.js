// SoundClips: enum values = DAGGER.SND record indices, verbatim from
// DFU SoundClips.cs. Only the consumed subset lives here; grow it
// with the consumers (the full 400+ enum stays in the source).
export const SOUND = {
  PlayerDoorBash: 7,
  DungeonDoorClose: 24,
  DungeonDoorOpen: 25,
  NormalDoorClose: 93,
  NormalDoorOpen: 94,
  SwingLowPitch: 105,
  SwingHighPitch: 106,
  Hit1: 108,          // Hit1..Hit5 = 108..112; DFU rolls Hit1 + Range
  Hit2: 109,
  Parry6: 433,
  SwingMediumPitch: 347,
};

/** GetSwingSound verbatim (DaggerfallUnityItem): pitch by weapon
 *  name; barehanded swings ride SwingHighPitch (WeaponManager). */
const SWING_LOW = new Set(['Warhammer', 'Battle Axe', 'Katana', 'Claymore', 'Dai-Katana', 'Flail']);
const SWING_HIGH = new Set(['Dagger', 'Tanto', 'Shortsword']);   // Wakazashi rides MEDIUM in DFU
export function swingSoundFor(weapon) {
  if (!weapon) return SOUND.SwingHighPitch;
  if (SWING_LOW.has(weapon.name)) return SOUND.SwingLowPitch;
  if (SWING_HIGH.has(weapon.name)) return SOUND.SwingHighPitch;
  return SOUND.SwingMediumPitch;
}

/** PlayHitSound verbatim (EnemySounds.cs): weapon -> Hit1 + [0,5),
 *  barehanded -> Hit1 + [2,4). Same families for the player taking
 *  hits (PlayerFootsteps.cs). */
export function hitSoundFor(weapon, rolls = Math.random) {
  return SOUND.Hit1 + (weapon
    ? Math.floor(rolls() * 5)
    : 2 + Math.floor(rolls() * 2));
}
