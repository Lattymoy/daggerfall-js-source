// SoundClips: enum values = DAGGER.SND record indices, verbatim from
// DFU SoundClips.cs. Only the consumed subset lives here; grow it
// with the consumers (the full 400+ enum stays in the source).
export const SOUND = {
  MakePotion: 365,          // M2: the cauldron's chime on a matched recipe (SoundClips.cs:449)
  ArrowShoot: 3,            // SoundClips.ArrowShoot - the bow loose (frame 4)
  BodyFall: 15,             // AUDIT 24 wave 38: EnemyDeath plays it at the corpse, every death
  PlayerDoorBash: 7,
  ActivateLockUnlock: 316,  // R1: the picked-lock chime (AttemptLockpicking + exterior success)
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
  WoodElfMalePain1: 405,   // D1: PlayerDeath.classicPlayerDeathSound - EVERY race/gender in classic
  // ---- D1 / merge audit: the race/gender PAIN3 set ----
  // PlayerDeath.GetRaceGenderPain3Sound (:179-201) - DFU's own
  // comment: "There are 3 pain-like sounds for each race/gender. The
  // third one, used here, sounds like it may have been meant for when
  // the player dies." Verbatim from SoundClips.cs; note ARGONIAN MALE
  // PAIN3 IS 42, not 413 - the male block runs 390..412 and stops, and
  // the eighth male Pain3 sits alone down in the low block with the
  // source's own "// See 390-412" beside it. Deriving it as Pain1 + 2,
  // which every other race allows, would be off by 371.
  BretonMalePain3: 392,
  RedguardMalePain3: 395,
  NordMalePain3: 398,
  DarkElfMalePain3: 401,
  HighElfMalePain3: 404,
  WoodElfMalePain3: 407,
  KhajiitMalePain3: 410,
  ArgonianMalePain3: 42,
  BretonFemalePain3: 45,
  RedguardFemalePain3: 48,
  NordFemalePain3: 51,
  DarkElfFemalePain3: 54,
  HighElfFemalePain3: 57,
  WoodElfFemalePain3: 60,
  KhajiitFemalePain3: 424,
  ArgonianFemalePain3: 427,
  // ---- The UI one-shots (the windows' own calls, per DFU window) ----
  Ignite: 16,               // CreateCharClassQuestions.AnswerAndPlayAnim
  LevelUp: 96,              // DaggerfallCharacterSheetWindow.UpdatePlayerValues
  DiceRoll: 300,            // StatsRollout.Reroll (chargen attribute roll)
  ButtonClick: 360,         // DaggerfallMessageBox buttons + every assigned Button.ClickSound
  GoldPieces: 361,          // gold transfers / deal concluded
  PageTurn: 362,            // spellbook close + edits
  ParchmentScratching: 363, // letter-of-credit deal
  SelectClassDrums: 374,    // CreateCharClassSelect confirm
  OpenBook: 384,            // spellbook OnPush
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
