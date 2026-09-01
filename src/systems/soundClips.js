// SoundClips: enum values = DAGGER.SND record indices, verbatim from
// DFU SoundClips.cs. Only the consumed subset lives here; grow it
// with the consumers (the full 400+ enum stays in the source).
export const SOUND = {
  None: -1,                 // SoundClips.None (:24) - "no clip", and no valid record index

  // WM4c: the mill. Kamer's Spin_Up.cs loops SoundClips.ArenaFireDaemon
  // on the sail and on the machinery's plank gear (SoundClips.cs:40).
  ArenaFireDaemon: 11,
  // The MASTERY fanfare (SoundClips.cs:64) - PlayerEntity.RaiseSkills
  // :1406 plays it the moment a PRIMARY skill lands on 100. Not the
  // level-up chime below (96); this is the Arena tune.
  ArenaFanfareLevelUp: 32,
  MakeItem: 364,            // M4: the enchanter's chime (SoundClips.cs:448)
  MakePotion: 365,          // M2: the cauldron's chime on a matched recipe (SoundClips.cs:449)
  ArrowShoot: 3,            // SoundClips.ArrowShoot - the bow loose (frame 4)
  BodyFall: 15,             // AUDIT 24 wave 38: EnemyDeath plays it at the corpse, every death
  PlayerDoorBash: 7,
  ActivateLockUnlock: 316,  // R1: the picked-lock chime (AttemptLockpicking + exterior success)
  // AUDIT 26 F023: FPSWeapon.DrawWeaponSound's declared default (78)
  // is DEAD in DFU - WeaponManager.SetWeapon overwrites the field with
  // `weapon.GetEquipSound()` on every applied weapon (:780) and
  // ToggleSheath plays THAT (FPSWeapon.cs:295). Kept for the
  // barehanded/claws arms, which have no item to ask.
  DrawWeapon: 78,
  // DaggerfallUnityItem.GetEquipSound's weapon arm (:839-867), by
  // DAGGER.SND index (SoundClips.cs:466-469, :512-515).
  EquipShortBlade: 377,
  EquipLongBlade: 378,
  EquipTwoHandedBlade: 379,
  EquipStaff: 380,
  EquipMaceOrHammer: 413,
  EquipFlail: 414,
  EquipAxe: 415,
  EquipBow: 416,
  DungeonDoorClose: 24,
  DungeonDoorOpen: 25,
  NormalDoorClose: 93,
  NormalDoorOpen: 94,
  HorseClop: 97,          // TR2: the riding loop below half speed
  AnimalHorse: 99,
  AnimalDog: 100,
  AnimalCat: 101,
  AnimalPig: 102,
  AnimalCow: 103,
  HorseAndCart: 104,      // TR2: the cart's own loop
  HorseClop2: 298,        // TR2: the riding loop at speed
  SwingLowPitch: 105,
  SwingHighPitch: 106,
  EnemyWerewolfMove: 142,    // LM1: the transformed MOVE sound (SoundClips.cs:213, :233)
  EnemyWerewolfBark: 143,    // V4: the lycanthrope's own attack voices (SoundClips.cs:214-215, :234-235)
  EnemyWerewolfAttack: 144,
  EnemyWereboarMove: 157,
  EnemyWereboarBark: 158,
  EnemyWereboarAttack: 159,
  EnemyFemaleVampireBark: 199,   // V5: the vampire player's own gendered attack voices (SoundClips.cs)
  EnemyFemaleVampireAttack: 200,
  EnemyVampireBark: 205,
  EnemyVampireAttack: 206,
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

/** GetSwingSound verbatim (DaggerfallUnityItem.cs:878-908): pitch by
 *  TEMPLATE INDEX; barehanded swings ride SwingHighPitch (WeaponManager).
 *
 *  AUDIT 39: this keyed on `weapon.name`, and a name is not the template
 *  - the same trap already fixed in equip.js's weaponProficiencyFlag and
 *  hostCombat's isBowWeapon. loot.createRegularMagicItem RENAMES an
 *  enchanted weapon to its MAGIC.DEF name (the templateIndex survives,
 *  the display name does not), so every magic Warhammer/Battle Axe/
 *  Katana/Claymore/Dai-katana/Flail lost the low pitch and every magic
 *  Dagger/Tanto/Shortsword the high one; itemTemplates.json's own
 *  spelling "Dai-katana" missed the set even unenchanted. The indices
 *  are inline because this module is a LEAF - characters/weapons.js
 *  imports SOUND from here. */
const SWING_LOW = new Set([126, 127, 121, 122, 123, 125]);      // Warhammer, Battle Axe, Katana, Claymore, Dai-Katana, Flail
const SWING_MEDIUM = new Set([118, 120, 119, 117, 128, 115, 124]); // Broadsword, Longsword, Saber, Wakazashi, War Axe, Staff, Mace
const SWING_HIGH = new Set([113, 114, 116]);                    // Dagger, Tanto, Shortsword
const SWING_BOWS = new Set([129, 130]);                         // Short Bow, Long Bow -> ArrowShoot
export function swingSoundFor(weapon) {
  if (!weapon) return SOUND.SwingHighPitch;
  if (weapon.werecreatureClaws) return SOUND.SwingHighPitch;   // V4: SetFPSWeapon's SwingWeaponSound (:339)
  const t = weapon.templateIndex;
  if (SWING_LOW.has(t)) return SOUND.SwingLowPitch;
  if (SWING_MEDIUM.has(t)) return SOUND.SwingMediumPitch;
  if (SWING_HIGH.has(t)) return SOUND.SwingHighPitch;
  if (SWING_BOWS.has(t)) return SOUND.ArrowShoot;
  return SOUND.None;   // DFU's `default:` - anything that is not a weapon rings nothing
}

/** PlayHitSound verbatim (EnemySounds.cs): weapon -> Hit1 + [0,5),
 *  barehanded -> Hit1 + [2,4). Same families for the player taking
 *  hits (PlayerFootsteps.cs). */
export function hitSoundFor(weapon, rolls = Math.random) {
  return SOUND.Hit1 + (weapon
    ? Math.floor(rolls() * 5)
    : 2 + Math.floor(rolls() * 2));
}
