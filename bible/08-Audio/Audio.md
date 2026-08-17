# Audio

Sound effects: DAGGER.SND reader COMPLETE (`src/formats/sndFile.js`, 459
sounds, byte-exact RIFF headers) - see Readers-Arc.

A1 (2026-08-14) SHIPPED - runtime playback: `src/systems/audio.js`
(WebAudio engine - Ledger A row; lazy 8-bit PCM -> AudioBuffer,
PannerNode 3D with the camera as listener, gesture-gated context for
mobile) + `src/systems/soundClips.js` (the consumed SoundClips subset,
indices verbatim; GetSwingSound pitch table; PlayHitSound families).
Consumers live in the dungeon: door open/close (DungeonDoor clips on
the ActionSystem onDoorState seam), player swing on Strike-state
entry (FPSWeapon shape), landed hits at the struck foe / whiffs
(Hit2/Parry6), the player taking hits (PlayerFootsteps families),
enemy attack sounds (50%, humans silent), and the EnemySounds attract
loop verbatim (radius 16, delay Range(3,10) always stepping, 80/20
bark/move, humans silent). Enemy Move/Bark/AttackSound columns
restored into enemyBasics.js via the generator (C3 parity asserted,
61/62 rows carry sounds).

Music: HMI/XMI in MIDI.BSA has NO DFU reader (Unity synthesizes music); the
playback strategy is this arc's first decision (approved routing, see
Port-Ledger A). Also owned here: animal audio sources on flats, torch burning
sounds on dungeon flats (RDBLayout.AddTorchAudioSource) and action sounds
(action.index carries the sound id), the audio state machine, and iOS
AudioContext.resume discipline when a shell exists.

## A2 (action + ambient sources): SHIPPED (2026-08-16)

The Ledger C rows "Torch audio sources", "Animal audio sources", and
the action-PlaySound half of "Transition + activation sounds".
Verbatim from RDBLayout/GameObjectHelper/DaggerfallAudioSource/
DaggerfallAction:

- **Action sounds**: DaggerfallAction.Play plays the RDB soundIndex
  (action.index > 0) on EVERY Play, movers and effect actions alike -
  the ActionSystem grew an onActionSound seam; the scene speaks from
  the mover's live matrix or the effect object's origin through the
  default min1/max500 3D profile. (The soundIndex doubles as data on
  some flags - Hurt21's damage bound, CastSpell's spell id - and DFU
  plays those as sounds too; preserved.)
- **Torches** (RDBLayout.AddTorchAudioSource + IsTorchFlat): lights
  archive 210 records {0,1,6,16,17,18,19,20} loop Burning (420) with
  LINEAR rolloff at maxDistance 5 and volume 0.7 ("or the burning
  sound is audible almost everywhere"). LoopIfPlayerNear: the engine
  grew loop3d (linear panner + stop handle); the scene keeps a live
  source ONLY while the player is inside 5m, so a torch-heavy dungeon
  carries no idle nodes. Sources free on context destroy.
- **Animals** (GameObjectHelper.AddAnimalAudioSource): archive 201
  flats - records 0/1 horse (99), 3/4 cow (103), 5/6 pig (102),
  7/8 cat (101), 9/10 dog (100), gap records silent - at maxDistance
  768*GlobalScale = 19.2. PlayRandomlyIfPlayerNear verbatim: per
  CLASSIC UPDATE in range, DFRandom.rand() <= 100 plays (~once per
  ~20s of proximity).
- **Scope (honest)**: dungeon scene only - the exterior/interior
  scenes carry no audio engine wiring yet (their RMB animals/torches
  join when audio reaches those scenes; rows stay in Ledger C).
  Ladder-climb and enter/exit stingers ride the interior transition
  seams (P6/P7) - same routing. Music (HMI/XMI) still pends its
  strategy decision.

2 tests (audio.test.js 4 -> 6). Suite 310/75, ARENA2 corpus 310/310
green pre-commit.

### A2 audit note (2026-08-16c): the bash sound lands

AttemptBash's onDoorBash seam (routed by the bash slice before A2's
engine existed) is now wired: PlayerDoorBash (7) plays from the door
through the standard 3D profile on every bash attempt, open or
closed, exactly where DFU's DaggerfallAudioSource sits.

## A3 (scene ambience - AmbientEffectsPlayer): SHIPPED

Verbatim from AmbientEffectsPlayer.cs + WeatherManager.
SetAmbientEffects, with the wait windows from the scene's SERIALIZED
components (they override the script defaults 4/35): the Dungeon
object 5/28, the exterior WeatherAmbientEffects 5/25.

- **The player** (src/systems/ambientEffects.js): a preset picks the
  set - dungeon (the 14 one-shots 63..76: drips/wind moans/door
  creaks/grind/strumming/wind blows/monster roar/gold pieces/bird/
  door close) played "somewhere around" (onUnitSphere x
  sqrt(Range(10^2, 20^2)), min 13/max 104; distribution-equivalent
  sphere sampling, no consumer replays it); storm (lightning short/
  thunder/roll 348-350) on the horizon ring (a random yaw at +20deg,
  min 3000) OVER the rain loop; rain (AmbientRaining 389 loop only);
  sunnyDay (BirdCall1/2 437-438); clearNight (AmbientCrickets 6 loop
  only). One-shots share ONE ambient channel (isPlaying skips - the
  busy clock rides the clip duration returned by the engine); the
  wait re-rolls System.Random.Next(min, max) EXCLUSIVE-max seconds;
  preset switches stop loops (the wanted one restarts next update).
- **Water** (dungeon deps, the classic-update cadence): with a block
  water level, rand() < 50 plays WaterGentle (439) AT the surface
  beside the player (x/z +- Range(-3,3), min 8/max 64); submerged
  (the P12 head-under flag), rand() < 100 adds AmbientWaterBubbles
  (114) flat - both through the shared channel, verbatim.
- **Wiring**: dungeonContext drives the dungeon preset per frame
  (both hosts - worldModes delegates); world.js + exterior.js drive
  presetForExterior(weather, isNight(minute)) - the verbatim
  WeatherManager mapping (rain -> Rain, thunder -> Storm, everything
  else folds to SunnyDay/ClearNight) - and now own audio.setListener.
  Building interiors carry NO ambient player in DFU - interior.js
  stays silent, verbatim. The engine grew loop() (2D looping source)
  and play3d/playOneShot now return the clip duration.
- **RESIDUAL (honest)**: doNotPlayInCastle pends castle-block
  detection (deps.inCastle stays false); the cemetery howl/bird
  layer (IsCemeteryNearby) pends locations - routed; the RMB
  exterior animal/torch sources still pend (Ledger C row unchanged);
  lightning FLASH sync (PlayLightningEffect) is off in the scene
  serialization, verbatim skip; music still pends Mac's strategy
  decision.

6 tests (ambient.test.js). Suite 357/81, ARENA2 corpus 357/357
green pre-commit; the exterior shot probe runs clean with the
ambience live.

## A4 (2026-08-17): exterior RMB animal sources - towns bark SHIPPED

The queue's named row (the A3 residual's "exterior animal/torch
sources") closes at its verbatim scope: DFU's RMBLayout adds
AddAnimalAudioSource to every archive-201 flat and NOTHING else -
the Burning torch loop is RDBLayout-only, so exterior torches are
silent in DFU and stay silent here (checked, recorded).

- systems/animalAmbience.js: A2's inline dungeon cadence extracted
  as THE shared PlayRandomlyIfPlayerNear pass - per CLASSIC UPDATE
  (16 Hz), each source within animalSoundMaxDistance (768 units =
  19.2) rolls the classic DFRandom stream, rand() <= 100 barks. The
  range gates BEFORE the roll (sequence preservation, pinned). One
  implementation, three consumers: dungeonContext (folded - the
  inline A2 block and its timer retired), exterior.js (static
  source list from the flat build), world.js (per-pixel animal
  lists with pixel-LOCAL positions, translated through the floating
  origin at roll time - recenters are free).
- The record table verbatim (GameObjectHelper): 0/1 horse, 3/4 cow,
  5/6 pig, 7/8 cat, 9/10 dog, record 2 and 11+ silent.

Remaining on the queue: transition stingers; music (Mac's strategy
call stands).

Suite 412/90 (animalambience.test.js x2: the table + constants, the
16Hz cadence with the range-before-roll law).
