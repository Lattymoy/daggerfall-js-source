// SoundClips: enum values = DAGGER.SND record indices, verbatim from
// DFU SoundClips.cs. Only the consumed subset lives here; grow it
// with the consumers (the full 400+ enum stays in the source).
export const SOUND = {
  ArrowShoot: 3,            // SoundClips.ArrowShoot - the bow loose (frame 4)
  PlayerDoorBash: 7,
  DrawWeapon: 78,     // ToggleSheath's unsheathe sound (FPSWeapon.DrawWeaponSound default)
  DungeonDoorClose: 24,
  DungeonDoorOpen: 25,
  NormalDoorClose: 93,
  NormalDoorOpen: 94,
  AnimalHorse: 99,
  AnimalDog: 100,
  AnimalCat: 101,
  AnimalPig: 102,
  AnimalCow: 103,
  SwingLowPitch: 105,
  SwingHighPitch: 106,
  FallDamage: 91,     // P14: PlayerFootsteps on ApplyPlayerFallDamage
  FallHard: 92,       // P14: PlayerFootsteps on HardFallAlert
  Hit1: 108,          // Hit1..Hit5 = 108..112; DFU rolls Hit1 + Range
  Hit2: 109,
  SplashLarge: 342,
  SwingMediumPitch: 347,
  Burning: 420,
  Parry6: 433,
};

// ---- A2 ambient sources, verbatim data ----
/** RDBLayout.IsTorchFlat: lights archive 210 records that burn. */
export const TORCH_ARCHIVE = 210;
export const TORCH_RECORDS = new Set([0, 1, 6, 16, 17, 18, 19, 20]);
export const TORCH_MAX_DISTANCE = 5;      // RDBLayout torchMaxDistance
export const TORCH_VOLUME = 0.7;          // RDBLayout torchVolume

/** GameObjectHelper.AddAnimalAudioSource: archive 201 record ->
 *  SoundClips (0/1 horse, 3/4 cow, 5/6 pig, 7/8 cat, 9/10 dog). */
export const ANIMALS_ARCHIVE = 201;
export const ANIMAL_SOUND_BY_RECORD = Object.freeze({
  0: SOUND.AnimalHorse, 1: SOUND.AnimalHorse,
  3: SOUND.AnimalCow, 4: SOUND.AnimalCow,
  5: SOUND.AnimalPig, 6: SOUND.AnimalPig,
  7: SOUND.AnimalCat, 8: SOUND.AnimalCat,
  9: SOUND.AnimalDog, 10: SOUND.AnimalDog,
});
export const ANIMAL_MAX_DISTANCE = 768 * 0.025;   // animalSoundMaxDistance (19.2)
/** PlayRandomlyIfPlayerNear: per CLASSIC UPDATE in range,
 *  DFRandom.rand() <= 100 plays (~0.3% per 16Hz tick). */
export const AMBIENT_RANDOM_PLAY_MAX = 100;

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
