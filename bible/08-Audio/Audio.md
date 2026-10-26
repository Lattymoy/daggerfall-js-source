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
(Hit2/Parry6), the player taking hits (PlayerFootsteps families, at
volumeScale 1 - EnemySounds' 1.1 is the PLAYER-STRIKING side, AUDIT 58),
enemy attack sounds (50%, humans silent), and the EnemySounds attract
loop verbatim (radius 16, delay Range(3,10) always stepping, 80/20
bark/move, humans silent). Enemy Move/Bark/AttackSound columns
restored into enemyBasics.js via the generator (C3 parity asserted,
61/62 rows carry sounds).

Music: HMI/XMI in MIDI.BSA has NO DFU reader (Unity synthesizes music); the
playback strategy is this arc's first decision (approved routing, see
Port-Ledger A). Also owned here: animal audio sources on flats, torch burning
sounds on dungeon flats (RDBLayout.AddTorchAudioSource) and action sounds
(action.index carries the sound ID, resolved through the engine's ID door -
see A2), the audio state machine, and iOS
AudioContext.resume discipline when a shell exists.

## A2 (action + ambient sources): SHIPPED (2026-08-16)

The Ledger C rows "Torch audio sources", "Animal audio sources", and
the action-PlaySound half of "Transition + activation sounds".
Verbatim from RDBLayout/GameObjectHelper/DaggerfallAudioSource/
DaggerfallAction:

- **Action sounds**: DaggerfallAction.Play plays the RDB action's
  sound field (action.index > 0) on EVERY Play, movers and effect
  actions alike - the ActionSystem grew an onActionSound seam; the
  scene speaks from the mover's live matrix or the effect object's
  origin through the default min1/max500 3D profile. (The field
  doubles as data on some flags - Hurt21's damage bound, CastSpell's
  spell id - and DFU plays those as sounds too; preserved.)
  AUDIT 58: it is a DAGGER.SND record **ID**, not a record index, and
  the port played it as one. RDBLayout names the parameter
  `int soundID_and_index` (:951) and DaggerfallAction.cs:42's own
  comment calls it "the raw sound index", but the wiring settles it:
  `AddActionAudioSource(go, (uint)action.Index)` (:1075) casts to uint
  so `SetSound(id)` binds the UINT overload (DaggerfallAudioSource.cs
  :170-181), the only one of the three that runs GetSoundIndex. The
  dungeon host's seam now plays through `audio.play3dId`, so every RDB
  action rings the clip its block asked for.
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
  layer (IsCemeteryNearby) is wired in BOTH exterior hosts (AUDIT 58 -
  world.js arms it on the rect edge, exterior.js once at load, since
  that host never leaves its one location's rect); the RMB
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

## Transition stingers: CLOSED as verbatim N/A (2026-08-17, corrected at AUDIT 18)

The TRANSITION half of the queue row deflates the same way the exterior
torches did: DFU plays NOTHING on building/dungeon enter-exit transitions
(PlayerEnterExit.cs contains no PlayOneShot and no SoundClips reference at
all) and DaggerfallLadder has no climb sound. That half was A1-era
speculative naming; there is no source law to port.

The ACTIVATION half did NOT deflate, and AUDIT 18 corrected this section for
claiming it had. PlayerActivate's door path plays two clips, not one, and
they are not both ours:
- `PlayerDoorBash = 7` (SoundClips.cs:38, PlayerActivate.cs:510) - OURS,
  `SOUND.PlayerDoorBash` in soundClips.js. This page previously mis-numbered
  it as 28.
- `ActivateLockUnlock = 316` (SoundClips.cs:386) - NOT OURS. It is
  PlayerActivate.cs:556's successful exterior lockpick and
  DaggerfallActionDoor's PickedLockSound (:41/:229/:237); 316 appears in
  neither soundClips.js nor any consumer. It rides
  DaggerfallActionDoor.AttemptLockpicking and the steal-mode unlock, neither
  of which is ported, so it has moved onto the Ledger's door-lockpicking C
  row rather than being added as dead data.

The audio queue is MUSIC ONLY once that clip is accounted for at its own
mechanic (Mac's strategy call stands).

## A6 (2026-08-20): PLAYER FOOTSTEPS - the world gets a floor SHIPPED

The FS-slice; the wts-4 residue closes. PlayerFootsteps.cs whole, in
two halves. systems/footsteps.js owns the LAWS pure: the sound-SET
decision - outside walks the Outside pair, winter turns it to Snow
unless IsSnowFreeClimate says the climate never snows (the gate
weather.js had carried DEAD since it shipped finally has its
consumer), buildings walk on Wood, dungeons on Stone, with DFU's
override write order on top (exterior water Submerged, exterior
paths ringing like the dungeon set, dungeon water Submerged
swimming / Shallow wading at the capsule-center-0.57 line) - and
the STRIDE machine: 2.5 units per step, walking and running alike
("Matched to classic"), two clips alternating at 0.7 volume, halved
when moving less than half speed; losing the ground silences the
stride and regaining it lands ONE immediate step, except the very
first landing after boot, which is swallowed (ignoreLostGrounding).
The set pick is STATELESS per frame, so DFU's leave-the-water reset
falls out for free.

All FOUR hosts drive it off their live motors (grounded, swimming,
levitating, movingLessThanHalfSpeed - the motor already carried
every flag): world and exterior feed the season + the location's
raw CLIMATE.PAK index into the snow gate, worldModes splits wood
and stone by mode with the dungeon water arms off the block water
line, and the standalone dungeon page mirrors it. Flat 2D playback,
as PlayerFootsteps' customAudioSource is. RESIDUE on the struck
row: the exterior path/water TILE arms (no tile-under-player lookup
yet - the same flag the fall-damage exemption rides) and the mount
gate (transport arc). The fall/splash/pain one-shots that share the
C# file were already home (P14, combat) - but AUDIT 58 found them
playing at FULL volume: `FootstepVolumeScale` (PlayerFootsteps.cs:30)
is 0.7 and all THREE non-stride one-shots pass it -
ApplyPlayerFallDamage (:307-311), HardFallAlert (:315-319) and
PlayLargeSplash (:323-326) - where PlayWeaponHitSound in the same
component deliberately passes 1f. The port honoured it on the stride
alone, so its three siblings rang 43% too loud in every host. They
carry it now, single-sourced from `systems/footsteps.js`'s
FOOTSTEP_VOLUME so the four cannot drift apart again.

4 pins (the set decision with the gate and the override order, the
stride at its boundaries, the ground-loss laws, the four-host
sweep); 3 mutations run, 3 killed. Walked live in the dungeon and
the world with zero page errors.

## A5c FROM PLAY (2026-08-27): THE HMI CLOCK - every song was eight times too fast

Mac: "music continuously loops with short tracks". The reader took the
u16 at 0x0D2 (480 in every song) for ticks-per-quarter and the u16 at
0x0D4 (120) for BPM: 1/960 s per tick. DUNGEON.HMI's 26,675 ticks made
28 seconds, and then the loop - which is the "short track" that loops.
The HMI sequencer's tick is 1/BPM of a second: SIXTY ticks per quarter
at the header's BPM, 8.33 ms at 120. Two independent readers say so -
WildMIDI's f_hmi.c (bpm from byte 212, division fixed at 60, with the
author's own FIXME that it is "the only offset that plays the files at
what appears to be the right speed") and foo_midi's
midi_processor_hmi.cpp (192 ppqn at 1,605,632 us, the same 8.36 ms) -
and DFU's shipped conversions were made with the latter: its
dungeon.mid is 223 s at 192 ppqn / 1,605,566 us, which is exactly this
archive's 26,675 ticks at 8.36 ms, not 28 s; d1.mid 216 s against the
reader's 28.048. So `secondsPerTick` is 1/BPM (HMI_TICKS_PER_QUARTER =
60), the 0x0D2 field is kept as `headerResolution` - what it is, not
the time base - and the corpus pins say 224.383 s where they said
28.048. The comments that called the songs "4-44 s cues" were
describing the bug; the songs are 30 s to 4 min, and the player's loop
is DFU's own end-of-song arm (SongManager.UpdateSong:229 replays the
same song when the context has not moved). Mutant dead.

THE SUNNYDAY RESIDUE, CLOSED THE SAME DAY (Mac: "if it needs fixing,
fix it"). Read against a copy of MIDI.BSA in a scratch directory
(never the repo): track 5 of SUNNYDAY.HMI ends `87 5e 45 01 33 | c8 e4
70 | b5 5b 4c | 00 b0 69 00 | 00 ff 2f 00` - the last note, then a
three-byte VLQ delta of 1,192,560 ticks before a reverb-send
controller (CC91 = 76) and the closing marker, where its nine sibling
tracks end `34 | b0 69 00 | 00 ff 2f 00` at tick 6802. Not a misparse:
the reader had read it right and recorded it as a corpus quirk
"preserved verbatim" - and preserving it parked the loop 2.76 hours
out. The reference reader knows the case: foo_midi's
midi_processor_hmi.cpp SHUNTS any HMI delta over 0xFFFF ("Large HMI
delta detected, shunting") - the event lands on the track's last
timestamp instead of advancing - which is exactly why DFU's shipped
sunnyday.mid is 54.8 s. `HMI_MAX_DELTA` (0xFFFF, inclusive) does the
same here; SUNNYDAY ends at 6802 like its siblings, 57 s, and the
whole archive re-read shows no other track with a non-musical tail.
Pinned synthetically (a miniature of track 5, plus the boundary:
65,535 advances, 65,536 shunts) and in the corpus pins, which were
re-run against the real archive: D1 at 224.383 s, SUNNYDAY at 57 s,
every checksum but SUNNYDAY's unchanged.

## FROM PLAY (2026-08-27): THE MUSIC SLIDER, LIVE - and a replacement pack at its own level

Two fixes that had shipped inside the Enhanced Music arc and were
reverted with it, re-landed alone at Mac's word ("we can reimplement
the true fixes").

THE SLIDER. `Controls/MusicVolume` was LIVE in the registry's tier and
read once per player, at `_ensureMaster`, and never again - so the
slider was heard at the NEXT song, and a song that loops (every
Daggerfall song does) never heard it at all. `settings.setValue` now
PUBLISHES every write (`onSettingChange`: a small subscriber set - the
section, the key, the string as stored, the default's string when the
override is dropped; a throwing listener is warned and skipped so a bad
listener cannot fail a write), and MusicService subscribes: on
MusicVolume it re-levels both of its players with a 50 ms ramp on each
master, so a slider drag is not a zipper. Every writer already goes
through setValue (the enhanced pane, the classic settings window, the
pause window), so nothing else had to learn the door - and any other
LIVE consumer can take it instead of polling.

THE PACK. MUSIC_GAIN (0.22) is the FM bank's trim: raw oscillators sum
hot and the classic songs are mixed under it. The M-EXT replacement
player - a user's own music files, mastered with their own headroom -
took the same trim on top of the setting, "deliberately shared" when
that feature shipped, and played at a fifth of itself (0.22 x the 0.5
default). It reads `trackGain()` now, the setting alone, beside the
scheduler's `musicGain()`; one setting still moves both through the
service's resync, so the mixer cannot drift. The header that recorded
the shared law records the split.

Pins: `test/systems/settings/musicvolume.test.js`, 4 tests - the publish (once, the
default's string on a drop, unsubscribe, a throwing listener skipped
with the write landing), the service re-levelling exactly its two
players on exactly that key and stopping when torn down, each player's
ramp (the scheduler to MUSIC_GAIN x the setting, the pack to the
setting alone, within 60 ms, and no throw before a master exists), and
every writer going through setValue. The replacement suite's shared-law
pin re-aimed at the split. 3 mutants, 3 dead.


## AUDIT 64 F4 - the dungeon shallow-water threshold restated a constant (2026-09-08)

`PlayerFootsteps`' two dungeon-water arms compare the player against the
block water line at a fixed offset:

    else if (... && (playerMotor.transform.position.y - 0.57f) < (blockWaterLevel * -1 * GlobalScale))   // :189, enter
    ... || (playerMotor.transform.position.y - 0.95f) >= (...)                                           // :201, leave

`playerMotor.transform.position` is the LIVE CharacterController capsule
CENTRE - `controller.center` is never assigned anywhere in DFU, and
`ControllerHeightChange` (`PlayerHeightChanger.cs:473-478`) sets
`controller.height` and then moves `controller.transform.position` by
`heightChange / 2f`, so the FEET stay planted and the centre tracks the
live height: standing 1.8 gives feet+0.9, crouched 0.9 gives feet+0.45,
riding 2.6 gives feet+1.3.

`footsteps.js`'s own contract said exactly that ("`centreY` is the
capsule CENTRE, which is DFU's transform.position on a
CharacterController; the hosts pass feet + half-height") and both
dungeon hosts passed `player.pos[1] + 0.9` - the STANDING half-height,
baked as a literal - while the swim toggle a few lines above each
already read the live value. Crouched in a dungeon block with water, DFU
enters the splash at `feet - 0.12 < waterY` and the port waited for
`feet + 0.33 < waterY`: 0.45 units of water crossed on the stone pair,
with the exit threshold wrong in the other direction (`feet - 0.5`
against the port's `feet - 0.05`). Both hosts pass `player.pos[1] +
player.height / 2` now; `motor.js`'s `height` getter IS
`controller.height` and answers crouch, the sunk swim capsule (plus the
horse displacement), the ride height and `standingHeightAdjustment`.

REVIEW ROUND (2026-09-08): the section first claimed the same error
"again during `DoSinking`/`DoUnsinking`'s 0.30 capsule - i.e. exactly
while surfacing from a dungeon swim", and both host comments listed
"sunk 0.15" among the stances the arm answers. That stance cannot reach
this arm. `PlayerFootsteps`' two water arms are inside
`IsPlayerInsideDungeon && blockWaterLevel != 10000` (`:178`), while
`DecideHeightAction` arms `DoSinking`/`DoUnsinking` only from `onWater =
(PlayerMotor.OnExteriorWater == OnExteriorWaterMethod.Swimming)`
(`PlayerHeightChanger.cs:127`, `:147-158`) - and
`GetOnExteriorWaterMethod` returns `None` the moment
`GetOnExteriorGroundMethod` fails, which it does on
`PlayerEnterExit.IsPlayerInside` (`PlayerMotor.cs:505-514`, `:582-587`).
A dungeon swimmer is force-crouched to 0.9 instead
(`PlayerHeightChanger.cs:193-199`), so the centre there is feet+0.45,
never feet+0.15. The crouch case is the whole (and sufficient) defect;
the ride height 1.3 is the other stance the arm can see. Claim and
comments corrected; the fix and its pins are unchanged, since they were
written against the crouched 0.45 case all along.

The project had already ruled on this defect class in the other
direction: AUDIT 24 took the identical hardcoded `feet + 0.9` out of
LevitateMotor's swim-rise clamp citing `PlayerHeightChanger.cs:477-478`.
The footstep hosts were never brought along.

The pin that stood here was a pin that restated the port - it asserted
the literal source text `waterStep(player.pos[1] + 0.9,` in both hosts,
so it would have revert-protected the bug. It asserts the live centre
now, refuses the baked constant outright, and gains a machine-level case
the old form could not express: with the feet at 0 and the surface at
-0.05, the crouched centre 0.45 enters the splash (0.45 - 0.57 < -0.05)
where the standing centre 0.9 does not. Pins: 2 in
`test/systems/audit26_audio.test.js`. Mutant: `+ 0.9` restored in one host; 1
killed.

## AUDIT 64 F40 - the damage trap wounds you in silence (2026-09-08)

`RemoveHealth` has exactly three SENDERS in Daggerfall Unity, and all
three reach both of its receivers, because Unity's `SendMessage`
delivers to every component on the object: `EnemyAttack.cs:406` (a blow
or an arrow) and `DaggerfallAction.cs:739` (DrainHealth21, action flag
21) and `:768` (DrainHealth, flags 22-25) - the damage traps.
The receivers are `PlayerHealth.cs:36-44` (the screen flash and
`DecreaseHealth`) and `PlayerFootsteps.cs:348-364`, whose body is the
`CombatVoices` gate, `Dice100.SuccessRoll(40)`, `GetRaceGenderPainSound`
with `heavyDamage = amount >= MaxHealth / 4`, and a `Random.Range(0,
0.3f)` pitch lift.

The port played the cry on the EnemyAttack path in every host and on
neither trap arm. `world/actionSystem.js` models the FLASH half of the
message (its two Hurt arms already cited `:739` and `:768`), and the one
host that supplies the damage sink - the dungeon - passed `hurtPlayer`
bare, so a dungeon damage trap took health, flashed the screen and said
nothing.

The cry is on the SINK, not inside `hurtPlayer`, and that is the whole
subtlety: the same function carries FALL damage, and a fall is the one
damaging path DFU leaves silent - `PlayerHealth.cs:57` CALLS its own
`RemoveHealth` in C# rather than sending it, so PlayerFootsteps never
hears it. The roll rides the RAW damage too: PlayerFootsteps knows
nothing of the shield pool or of death, and its `heavyDamage` test is on
the amount the message carried.

Pins: `test/systems/audit64_audio.test.js` (the three senders and the two
receivers read out of the reference; the port's sink carrying both
halves; `hurtPlayer` still voiceless) and the wave-46 census, whose
dungeon cry count moves from two to three and whose "RECORDED as owed"
comment is retired.

## AUDIT 64 F41 - a full-screen VID played over the music and the rain (2026-09-08)

`DaggerfallVidPlayerWindow` raises two GLOBAL events -
`RaiseOnVideoStartGlobalEvent` at `:93` (the custom-video arm) and
`:112` (after `video.Open(...); video.Playing = true;`), and
`RaiseOnVideoEndGlobalEvent` at `:134` and `:150`, the two close paths -
and exactly two components subscribe:

  - `DaggerfallSongPlayer.cs:76-77`, whose handlers are `:356-362`
    (`oldGain = Gain; Gain = 0; IsMuted = true;`) and `:364-369`
    (`Gain = oldGain; IsMuted = false;`). The song KEEPS RUNNING and keeps
    advancing; only its level goes to zero, and `:106` re-asserts
    `audioSource.volume = IsMuted ? 0f : MusicVolume` every Update.
  - `AmbientEffectsPlayer.cs:92-93`, whose handlers are `:536-548` (null
    `rainLoop`/`cricketsLoop`, `loopAudioSource.Stop()`, clear clip and
    loop, `IsMuted = true`) and `:551-554` (`IsMuted = false;` alone).
    `Update`'s FIRST statement is `if (IsMuted) return;` (`:108-110`).

The port raised nothing and nothing listened, so the current song plus
the exterior rain or cricket loop played on top of every video - the
vampire and lycanthropy dreams, a quest `play video`, and ANIM0012 on
death. Holding or claiming the frame does not help: the music scheduler
is its own `setInterval` and `audio.loop` is a WebAudio buffer source,
both independent of the host's frame loop, and the quest-video seam
holds no frame at all.

THE MUSIC HALF IS A FLAG, NOT A RAMP. Three writers set the master gain
independently (`SongPlayer._ensureMaster`, `SongPlayer.resyncGain`, and
`AudioSongPlayer`'s per-start `trackGain()`), so a one-shot ramp to zero
would be undone by the next `playSong` - which is exactly what DFU's
per-Update re-assertion prevents. The flag lives beside the two gain
accessors in `systems/song/songPlayer.js` and both read it;
`MusicService.setMuted(v)` sets it and resyncs, so a SOUNDING song drops
at once and a song STARTED under the video is silent too. It is
deliberately not `music.stop()`: that clears `_current`/`_pending` and
would restart the song from the top, where DFU resumes mid-song.

THE AMBIENT HALF IS FOUR-HOSTS. Three hosts each own an `AmbientEffects`
privately (`dungeonContext.js`, `exterior.js`, `world.js`) and the video
player can reach none of them; DFU gets the fan-out free from a static
event with a subscription per instance. So the module carries a
live-instance registry - joined in the constructor, left in `dispose()`
- and `muteAmbientForVideo()`/`unmuteAmbientForVideo()` are the two
events. The mute stops and nulls both loop handles; `update()` gained
DFU's `if (this.isMuted) return;` as its first statement, without which
the lazy loop starts would re-open the rain on the very next tick. The
unmute clears the flag alone: the nulled handles ARE the retry. The
dungeon host now disposes its scene ambience with the context, which is
both the unsubscribe and the loop free.

THE SEAM'S ORDER MATTERS. The mute is raised on the line AFTER
`player.play(bytes)` succeeds, because that guard's early return does
not go through `finish()` - a mute raised before it would never be
lifted and one undecodable VID would silence the game for good. DFU
raises the start event only after `video.Open` for the same reason. The
unmute heads `finish()`, the one door all three exits take: end of file,
any key/back, and the AUDIT 19 error boundary.

The header quirk note that argued FROM `IsMuted` while the port did not
carry the flag now says that it does.

Pins: `test/systems/audit64_audio.test.js` - the reference's five raise sites and
both handler pairs read out of DFU; the accessors going to zero and back
without a stop; a muted instance whose loop is stopped, NOT re-opened by
two further ticks, and re-opened on unmute; two live instances both
reached and a disposed one not; and `playVideo` driven headlessly, muted
for every frame, restored at the close, and never muted by bytes that
would not open.

REVIEW ROUND (2026-09-08). Three of those pins passed under mutations
that revert the fix, and all three now die:

  - THE MUSIC PIN HAD NO SOUNDING SONG. It asserted only the two
    accessors and the flag, all three of which `setMusicMuted(v)` alone
    satisfies - so deleting the `resyncGain()` from `MusicService
    .setMuted` (which is the F41 bug itself: `_ensureMaster` writes the
    master ONCE at the song's start, so without the resync an
    already-playing song keeps full gain for the whole video, where
    `DaggerfallSongPlayer.cs:106` re-asserts the level every Update)
    left the suite green, and so did replacing it with `this.stop()` -
    the exact shape the code comment says it rejects. The pin now drives
    a `MusicService` with a live `SongPlayer` and `AudioSongPlayer` on a
    fake context, in a playing state with a `_current`, and reads the
    master gain BACK after the mute: zero on both live players, the
    starting level again on unmute, `_current` and `playing` untouched
    across the pair. Both mutants are red.
  - THE AMBIENT HALF WAS WIRED INTO `playVideo` AND UNPINNED. The two
    ambient tests called `muteAmbientForVideo()`/`unmuteAmbientForVideo()`
    directly, so nothing tied `ui/videoPlayer.js` to the ambient
    subscriber at all; swapping the two calls - or deleting both -
    passed, and would have left `isMuted` true on every live
    `AmbientEffects` for the rest of the session (`update()` returns at
    its first statement, so the rain, the crickets, the wilderness
    one-shots, the cemetery layer and the water arms go silent for good
    after one VID). The `playVideo` pin now holds a live instance and
    records `isMuted` beside `music.muted` on every frame, asserts both
    restored at the close, and asserts a video that never opened left
    the ambience hearing.
  - THE HOST DOOR WAS UNPINNED. `sceneAmbience.dispose()` in
    `dungeonContext.js`'s `destroy()` is the port's stand-in for Unity's
    `OnDisable`/`OnDestroy` unsubscribe, and deleting it passed the whole
    suite while reinstating the leak (`buildDungeonContext` runs once per
    dungeon entry and the registry is a strong `Set`, so each entry
    retains a dead instance for every later mute to walk). A pin now
    names it, and carries the four-hosts check with it: `exterior.js`
    and `world.js` build exactly one instance each and expose no
    teardown at all, so there is no repeated build to leak there, and
    `dungeon.js`, `worldModes.js` and `interior.js` own none.

## AUDIT 64 F43 - the use-magic-item pick had no click (2026-09-08)

`DaggerfallUseMagicItemWindow.cs:123` `MagicItemPicker_OnItemPicked`
HEADS with `DaggerfallUI.Instance.PlayOneShot(SoundClips.ButtonClick)`
(`:125`), before `CloseWindow()` and before the item is used. The port's
`onPick` closed and used with no sound.

The click belongs to this handler and not to the shared picker: neither
`ListBox` nor `DaggerfallListPickerWindow` plays a clip, so every DFU
route into this window (double click, Return, the picker's own use)
sounds exactly once and from here - and the other consumers of the
port's `ListPickerWindow` (guild training, the item and potion makers,
the teleport list) stay silent, as DFU's base window is.

Pins: `test/systems/audit64_audio.test.js` - the reference's ordering, then a
pick over a stubbed sink recording exactly one `ButtonClick` BEFORE the
close and the use, plus `listPicker.js` still carrying no `playOneShot`.

## AUDIT 64 F44 - the classic load window was the one silent window in the menu (2026-09-08)

`DaggerfallLoadClassicGameWindow.cs` sounds three handlers and only
three: `LoadGameButton_OnMouseClick` (`:213-217`),
`SaveGame_OnMouseClick` (`:219-223`) and `SaveGame_OnMouseDoubleClick`
(`:225-230`), each headed with `PlayOneShot(SoundClips.ButtonClick)`.
The exit button is `DaggerfallUI.AddButton(..., WindowMessages.
wmCloseWindow, ...)` (`:162`) - no handler at all, and so no clip.

The port's window answered the same clicks and imported no audio; its
sibling in the same menu host (`ui/saveWindow.js`) has clicked since it
shipped, which is what made the omission audible. The clip is played
INSIDE the window, the shape every other ported native window uses, on
the slot arm and on the Load arm. The exit arm and the dead rects stay
silent, and the start window - `DaggerfallStartWindow.cs`, whose three
handlers play nothing - was left alone.

A DOUBLE CLICK ON A SLOT SOUNDS TWICE (review round, 2026-09-08). The
first cut played one clip per pointer event, "whichever of the two the
click is". That is not what the reference does.
`BaseScreenComponent.cs:681-692` raises the double click IN ADDITION to
the single one, on the very same press:

    if (mouseOverComponent && leftMouseDown)
    {
        MouseClick(scaledMousePosition);            // :684, unconditional
        ...
        if (leftClickTime - lastLeftClickTime < doubleClickDelay)
            MouseDoubleClick(scaledMousePosition);  // :692
    }

Both raisers (`:903-912`, `:943-947`) are silent themselves, and a slot
button carries BOTH handlers (`:132-133` on the image button, `:139-140`
on the text button) - each headed with its own
`PlayOneShot(SoundClips.ButtonClick)` at `:221` and `:227`. So the
second press of a double click sounds two clips in DFU (three across the
whole gesture), and the port sounded one. `LoadClassicWindow.click` now
plays the `MouseClick` clip on every slot press and a second one when
`isDouble`, before returning the load. `SelectSaveGame` running twice on
the same index (`:222` then `:228`) is idempotent, so only the clip is
observable.

Pins: `test/systems/audit64_audio.test.js` - the three sounded reference lines,
the soundless exit button, and the two slot subscriptions read out of
DFU; `BaseScreenComponent`'s unconditional `MouseClick` and its nested
`MouseDoubleClick` read out of DFU beside them; then a slot click, a
double click and a Load recording FOUR clips across those three presses,
a lone double click recording two, and Exit, an unmounted slot and bare
background recording none.

## AUDIT 64 F45 - the foe-vs-foe parry rang ten percent quiet (2026-09-08)

`EnemyAttack.cs:366-375`'s zero-damage fork picks between two sounds,
and they do NOT share a volume: `EnemySounds.PlayMissSound` (`:143-156`)
ends `PlayOneShot(weapon.GetSwingSound())`, taking `PlayOneShot`'s
default `volumeScale = 1f` (`DaggerfallAudioSource.cs:188`), while
`PlayParrySound` (`:134-141`) ends `PlayOneShot(sound, 1, 1.1f)`. The
shared host law played both arms at 1.

`PARRY_VOLUME = 1.1` gets its own name beside `PARRY_1` rather than
borrowing `ENEMY_HIT_VOLUME`: that constant is `EnemySounds.cs:130`
(`PlayHitSound`), a different line of the reference that happens to
share the value, and AUDIT 58's pin holds it to the `hitSoundFor` sites.

The player-side copies pass 1.1 on BOTH of their arms and are right to:
the player's miss arm is `FPSWeapon.PlaySwingSound`
(`FPSWeapon.cs:304`, `PlayOneShot(SwingWeaponSound, 0, 1.1f)`), not
`EnemySounds.PlayMissSound`. The asymmetry is the whole finding.

Pins: `test/systems/audit64_audio.test.js` - the two reference lines and
`PlayOneShot`'s default read out of DFU, then a parried arrow ringing at
the target at 1.1 and a whiff ringing at the attacker at 1.

## AUDIT 64 F46 - the footstep stride anchor was rebased where DFU leaves it stale (2026-09-08)

`PlayerFootsteps.FixedUpdate` writes `lastPosition` in exactly two
places - `:245`, inside the lost-grounding landing reset, and `:270`,
after the accumulation - plus the one-time seed in `Start` (`:89`). Its
three early returns write NOTHING: the on-foot/levitation gate
(`:221-225`, `distance = 0f; return;`), the lost-grounding arm
(`:232-238`, distance and the flag only) and `if (IsStandingStill)
return;` (`:264-265`).

That staleness is load-bearing. The whole horizontal delta covered under
a gate lands on the first frame the gate opens, `:269` runs it past the
2.5-unit threshold, and one footstep fires immediately. Concretely:

  - DISMOUNTING. DFU shrinks the controller to dismount, so the player
    stays grounded and the `:245` reset never runs; the first walking
    frame after a ride plays a step. Both exterior hosts feed the port's
    `onFoot` flag from the live transport mode, so this is ordinary play.
  - LEVITATION ENDING AT FLOOR LEVEL, the same shape.
  - A FALL THAT ENDS IN WATER. `if (!IsSwimming)` (`:230`) skips the
    whole grounding block, so `lostGrounding` is never cleared and the
    landing reset never runs - `:269` bills the fall's horizontal travel
    into the first swimming frame.

The port rebased in all three arms and could therefore never produce any
of those steps. All three writes are gone. What stays: the lazy seed
(DFU's `Start`), the landing reset, the accumulation, and `rebase()`
with its single caller in the streaming host - the floating-origin
recentre, which has no DFU counterpart because DFU's world does not move
under the player.

Pins: `test/systems/audit64_audio.test.js` - the reference's own write census
(`lastPosition` assigned at 89, 245, 270 and at no line of the three
early returns), then a six-stride ride whose dismount frame plays, a
fall into water whose first swimming frame plays with `lostGrounding`
still up, and a standing-still frame that leaves the anchor where it was
while `rebase()` still re-seeds.

## DISC20-B (2026-09-24): a music switch fades - a recorded departure

Mac: *"Sometimes when music tracks switch, its very abrupt instead of
seamlessly fading in between tracks."*

DFU cuts. `DaggerfallSongPlayer.Play` calls `Stop` first, and `Stop` is
`audioSource.Stop()` or the sequencer's `NoteOffAll`: the old song goes
mid-note and the next starts at full level. That happens at every switch
SongManager makes: a weather ring crossed, dawn, a door, a new location,
a quest's PlaySong. The port did the same. A song that ended on its own
before the next one was the smooth case, hence "sometimes".

The port departs, at Mac's word (Port-Ledger A, DISC20-B):

- **The fader.** Each player (`SongPlayer`, `AudioSongPlayer`) runs its
  song through a gain of its own, `_fader`, into its master. The synth's
  channel gains and a pack's buffer source connect to it. The master
  stays the VOLUME: MusicVolume's live resync and the video mute (AUDIT
  64 F41) write it, and neither cancels a fade. `rampFader` holds the
  fader where it stands (`cancelAndHoldAtTime`, or by hand where a
  browser lacks it) and ramps from there, so a fade turned round half way
  turns round where it is.
- **The switch.** `MusicService.playSong`, asked for another song while
  one sounds, fades the sounding one out over `MUSIC_FADE_OUT_S` (1.5 s),
  stops it at silence, then starts the next at nothing and fades it in
  over `MUSIC_FADE_IN_S` (1 s).
  - One synth voices one song, so the two play in turn, never on top of
    each other. A pack's decode gap sits between them, as before.
  - The latest request during a fade is the one that plays. The song
    fading out, asked for again, turns round without a stop or a restart.
  - `playing` stays up through the fade, so the director reads no ended
    song.
  - A song that will not start leaves nothing claimed.
  - `stop()` cancels a switch in flight.
- **The start.** A first song, and a song after one that ended, rise in
  at once, from the MIDI.BSA path and a music pack's alike.

Pins: `test/systems/disc20.test.js` (B), `tools/mutants/disc20.json`.

## WB7 (2026-09-25): a song made in code - the Warden's score

Mac: "Proper boss audio during the boss fight." Daggerfall has no fight music - its dungeon tracks are made to be
walked through - so the Burning Court's is WRITTEN, as notes, in `systems/gate/gateScore.js`: four songs in the shape an
HMI song decodes to (tick-ordered events, one tempo, notes carrying their own durations), on the FM bank's own
articulations (pizzicato strings, timpani, orchestra hit, brass, choir, church organ, tubular bells, the kit). The
music service takes them by a door of its own, `MusicService.registerSong(name, song)`: a made song answers for its
name before MIDI.BSA is asked, and from there it is any song - the same player, the same DISC20-B fades, the same
MusicVolume, and a music pack replaces it by name as it replaces any song (M-EXT). The court holds the music while it
stands (world.js `gateScoreFrame`, ahead of the music director: the director is not fed then) and lets it go stopped
the frame it is gone, so the director's next frame hears its song ended and plays its own. What plays and when is
`courtScoreFor` - see `11-Multiplayer/World-Bosses.md` section 5. `tools/gateScoreProbe.mjs` plays each song through
the real song player into an OfflineAudioContext and measures it (every second sounding, no clipping, the war growing
with his phases, the fall rung out in its time), and can write the renders as WAV for a person to hear.

AUDIT WB (2026-09-25): the war songs are `seamless` - `SongPlayer` begins a seamless song's next pass on its bar line,
to the tick, where DFU's rewind rings a second past a song's end first (the classic songs keep it); the fanfare is
timed from when it began on this machine (`createCourtScore`) and ended by `MusicService.fadeOut` - DISC20-B's fade
and then a stop, where `stop()` is a cut; and his grunt counts the loss since his last one.

WB10a (2026-09-30, Mac: "make it more loud, just feel like its too quite, and I feel like the music is too jolly"): A
SONG'S OWN PRESS - a port departure with no DFU member behind it (DFU's music has no dynamics; the port's made songs
are the only ones that ask). WBX9 had given a song its own level (`songLevel`, one gain between the channels and the
fader), and the score had spent it: its drums peaked 15 to 19 dB over its body, a decibel under the clip at the highest
MusicVolume. A song may now carry `press` (`songPress`: threshold, knee, ratio, attack and release held to the Web Audio
compressor's ranges, `out` to (0, PRESS_OUT_MAX], a `ceiling` in dBFS at the highest MusicVolume to [-24, 0], the clip
itself when none is named). `SongPlayer` builds the press once - a DynamicsCompressor, a gain carrying the drive into
a WaveShaper's [-1, 1], the shaper on `ceilingCurve` (tanh(CEILING_DRIVE u), 4x oversampled), a gain out at the
ceiling's amplitude (`ceilingAmplitude`: over MUSIC_GAIN) - and routes the level through it for a song that carries one
and straight to the fader for a song that does not, as before; a context without a compressor or a shaper plays the
song unpressed. The ceiling is a bound by construction: nothing leaves the curve past its ends. Every song MIDI.BSA holds
carries none. The court's four carry `SCORE_PRESS` and read -15.8 / -15.4 / -14.2 dBFS at war and -15.6 at his fall
(from -25.6 / -22.1 / -21.5 / -22.9), every peak under -1 dBFS at the highest MusicVolume - `tools/gateScoreProbe.mjs`,
which also plays one player through the whole fight and the song after it. See `11-Multiplayer/World-Bosses.md` section
15; `test/systems/gate/wb10a_gate_score.test.js`.

SD13 (2026-10-07): THE SCORE OF THE HOUR (`systems/superDungeon/sdScore.js`) - the Hollow's and the Shattered Hour's nine songs by
the same door and the same law's shape: made notes registered by name, seamless, pressed (`HOUR_PRESS`, a ceiling a
decibel under the clip), held by the world host's `hourScoreFrame` ahead of the court's and the arena's. See
`11-Multiplayer/Super-Dungeons.md` section 7 and its SD13 record; `tools/sdScoreProbe.mjs`; `test/systems/superDungeon/sd13_score.test.js`.

EG-G2 (2026-10-12): THE SCORE OF THE SPIRE (`systems/eliteGates/egScore.js`) - an Elite Breach's songs by the same door: the band's
halls (96 bars, three variants in the seed's order), a trial's fight, a set piece's cue, a lord's wake, the three Courts
(each lord's own four bars in the bed), a Valkynaz, the Redoubt's hymn, THE COUNT's last two minutes and the end, in E
Phrygian, made for their context (the band, the lord) and registered under their names when it changes; held by the
world host's `hourScoreFrame` first (`createSpireScoreHost`). THE SPIRE MIX (`systems/eliteGates/egMix.js`): a personal sting for a
blow on my feet, a critical bus that ducks the score 6 dB for 300 ms through `SongPlayer.duck` (the song's own level -
the fader and the volume untouched), the legion's barks four a kind, nearest first. See `11-Multiplayer/Elite-Gates.md`
section 26 and its EG-G2 record; `tools/egScoreProbe.mjs`; `test/systems/eliteGates/eglook_score.test.js`.

EG-ROAR (2026-10-18, Mac: "the music and ambience of the elite breach needs to be insanely better. Its way too tame"): A
SONG'S OWN VOICES - a port departure with no DFU member behind it (the FM bank is the port's own, A5b). The bank plays one
oscillator pair a note and one sine or one band of noise a drum, and a made score's section was one thin player. A song
may now carry `voices` (`songVoices`: per channel, gmSynth.js `fmSpec`'s fields over the program's own, each held to
`VOICE_RANGE`, a field that is not a number dropped) and `kit` (`songKit`: per GM key, `percussionSpec`'s over the kit's,
held to `KIT_RANGE`). A voice may be a UNISON - `unison` pairs (1-4) `cents` apart either side of the note
(`unisonCents`), begun a share of a period apart, the peak over the square root of the copies so it is as loud as the
one pair; a `spread` lays its copies in turn in two envelopes either side of the channel's place - with a SUB (`sub`, a
sine an octave under in the note's own envelope); a bend reaches every copy with its spread kept. A drum may carry a
CLICK (`click`, the beater's noise, 3.2 kHz, gone in 15 ms) and a BODY (`body` Hz, a skin's tone under a noise's crack).
INTRO3c (2026-10-24) gave a voice a second source and a channel a chain: a BOWED voice (`saw` - sawtooth copies, the
bowed string's own waveform, into a low-pass a side at `cutoff` times the note under the bow's pressure, `cutQ`; `_bow`),
a BODY, AIR and ENSEMBLE a channel (`body`, up to four resonances [Hz, dB, Q]; `air`, a shelf at 5 kHz; `ensemble`,
three slow-swept delays - the string machine's circuit; `_insert`), a VIBRATO (`vibrato` cents at `vibRate` Hz, a sine LFO
a copy, each copy's rate its own - since INTRO3d the channel's, into each oscillator's frequency in Hz; `_vibrato`), a BITE (`noise` - a band of noise as the note starts,
fading to a sixteenth; `_breath`), the BOW'S ARC (`arc` - a held note's dip, crest and ease) and the SWAY (`sway` at
`swayRate` - each copy's level breathing slowly, apart, on the channel's sine since INTRO3d; `_sway`), an INDEX FLOOR (`idxFloor`, the share an FM index settles to) and a song's TONE
(`tone` - bands and shelves between the fader and the master, a mix's match to a reference; `songTone`, `_routeTone`).
`10-UI/UI-Arc.md` INTRO3c.
A song that carries voices is high-passed at `SONG_FLOOR_HZ` (30 Hz) before its press - THE FLOOR: a 1:1 FM pair's first
lower sideband lands on 0 Hz, an offset no speaker plays that the press answers by pressing the whole song (a quarter of
the Spire's spiccato's energy stood under 40 Hz). Every song MIDI.BSA holds carries neither and plays the bank exactly as
it always has, through no floor. The Spire's score is the first to carry them (`SPIRE_VOICES`, `SPIRE_KIT`). See
`11-Multiplayer/Elite-Gates.md` section 26 and its EG-ROAR record; `test/systems/eliteGates/egroar_score.test.js`.

## FIELD-WIND1 (2026-09-29): the wind was a moan - a bed the port makes

The Discord through Mac: "A repetitive moaning sound in the open world." The port's wind (WIND3, `systems/wind/windAudio.js`;
its record is `07-Rendering/Rendering.md` WIND3) played DAGGER.SND's AmbientWindMoan and AmbientWindBlow1 on the riding
loop's shape (`setLoop`: a non-looping source started again each time it ends - TransportManager's `if (!isPlaying)
Play()`, right for a hoofbeat). They are DFU's dungeon one-shots (A3: AmbientEffectsPlayer plays one every 5 to 28 s):
the moan is 1.96 s that swells from nothing and falls back with a voice's pitch in it, so end to end it was a moan every
1.97 s under every breeze. Daggerfall has no continuous wind to loop, so the port makes one: `windBedSamples`, eight
seconds of seeded white noise under a band-pass (500 Hz, Q 0.6) and a low-pass (1.8 kHz), run through them twice so the
bed is the filters' periodic answer and the native loop has no seam, levelled to the moan's RMS (0.0349) so WIND3's gain
law means what it meant. Two doors on the engine for it: `registerSamples(key, samples, rate)` - a buffer the port
MAKES, under a string key, as `registerSound` registers a decoded WAV, so every entry point takes the key - and
`setPitch` on `loop`'s handle (playbackRate, live, beside WX2's `setVolume`). The wind rides `loop`: one source for the
whole blow, its gain and pitch set live. The riding loop is unchanged - its clips are made to be replayed.
`01-Overview/bugs/Field-Bugs-2026-09-29e.md`; `test/systems/field_wind1.test.js`.

## AUDIT SD III, SD20d (2026-10-07): a named bed - a loop the engine runs

The Hour's beds (`scenes/superDungeon/sdAir.js`) and the Deadlands' (`scenes/deadlandsAir.js`) rode the riding loop's shape
(`setLoop`, `setLoop3d`: a non-looping source re-armed from its `ended` - DFU's `if (!isPlaying) Play()`, right for a
hoofbeat's swap): at every pass of a bed a gap of the main thread's dispatch, the Hour's void every 5.8 s, its works
every 2. Two doors on the engine (`systems/audio.js`): `setBed(name, clip, { volume, pitch })` and `setBed3d(name, clip,
pos, opts)` - a NAMED bed, one buffer looping in the engine itself (`src.loop`), its volume and pitch live, moved each
call; the same call each frame keeps the one source; it rises from nothing as it begins and fades to nothing as it is
let go (`clip` null) or swapped for another clip, over 0.4 s (the arena's crowd bed's `BED_FADE_S` - a bed cut at its
level pops). `loop3d`'s handle fades as `loop`'s does (`fadeStop` - the Rift's bell was cut as its dungeon went). The
riding loop keeps its shape. A made loop is darkened as a loop (`systems/arena/arenaSound.js` `lowpassLoop`: the one-pole run
on from the state the loop's end leaves - begun from nought, it stepped at its seam each pass; FIELD-WIND1's wind ran its
filters twice for the same reason). Two song writers merge a note laid where the same voice already strikes it into one
note, its loudest and longest (`systems/superDungeon/sdScore.js`, `systems/gate/gateScore.js`: thirty-three doubled note-ons in the Hour's
nine songs, twenty-five in the Warden's war). Every score is let go by a fade (`music.fadeOut`), never a cut: the Hour's,
the court's and the arena's. See `11-Multiplayer/Super-Dungeons.md` section 16's SD20d; `test/scenes/superDungeon/sd20d_audio.test.js`.

## MIDI-OUT1 (2026-10-11): the music on a MIDI device - a recorded departure

A player asked for MIDI out. Settings > Audio > Music has a **MIDI out** row (`port:midiOut`, the uiPrefs shelf's
`midiOut`: the output's name, '' for none). The button names the device and a click steps to the next one connected,
then Off. The first click is the one that asks the browser for MIDI (`requestMIDIAccess`, no sysex), so a player who
never touches the row is never asked. Safari has no Web MIDI and the row says so. The desktop app's permission handler
already grants the game page every permission, so it needs nothing.

THE SAME SONGS, ANOTHER VOICE. `MidiOutSongPlayer` (`systems/midiOut.js`) IS a SongPlayer. It overrides only the
methods that touch the audio graph and hands the device each event instead, timestamped on the Web MIDI clock
(performance.now, which the player keeps as its clock). The lookahead pump, the loop and its seam, the stall skip and
the channel state stay the one scheduler's. `SongPlayer` grew two seams for it: `_origin(lead)`, where a song or a
loop's next pass begins, and `_skip(toTick)`, the stall's fold. `noteSeconds` is the voice's note length, exported so
both voices keep it. `MusicService` builds this player when a device is picked and connected (`adoptMidiOut`: at boot,
at every pick, when a device is plugged in or pulled out). A MIDI.BSA song that is sounding moves across from its top.
The latest pick wins, and a pick the player has already moved past never sounds. A pulled device hands the music back
to the synth and is left silent. A replacement pack is audio and plays as it did.

WHAT THE DEVICE IS SENT, AND WHAT IS OURS:
- **Channel events as their bytes**, clamped to seven bits: note-ons, controllers (the sustain pedal among them),
  program changes, pitch bend and both pressures. The court's score adds accents past 127, and a data byte with bit 7
  set is a status byte to a device. HMI's own events, meta events and sysex are not sent.
- **The note-offs are the player's.** It releases each note at the length the synth gives it, a window at a time, and
  ignores the stream's releases. The songs made in code carry lengths and no note-offs. Chrome has never had
  `MIDIOutput.clear()`, so a release queued seconds ahead could not be taken back and would cut the next song's note.
  A key struck again while it still sounds is released at the strike, just before it, and the earlier note's own
  release is dropped: a note-off ends whichever note holds the key. That covers a re-strike on the release's own tick
  too, where origin + tick + length can round 1.8e-15 s past origin + (tick + length) and a device orders by timestamp.
- **The volume is CC7.** MusicVolume and the video mute (`trackGain`: the setting alone, as a pack has it, because
  MUSIC_GAIN is the FM bank's trim), a song's own level (WBX9) and the switch's fade (DISC20-B) make one gain, and
  every channel's CC7 is multiplied by its SQUARE ROOT: General MIDI's CC7 law is 40 log10(v/127) dB, amplitude
  (v/127)^2 - the synth's own `volumeGain` - so CC7 x sqrt(g) sounds g. A device has no headroom past 127, so a
  song's level over 1 tops out once volume x level passes 1. It is re-sent when one moves: the slider and the mute at once, a fade each pump. A re-level is
  never queued under a CC7 the window already holds. The press (WB10a) belongs to the synth and is not applied.
- **A clean device per song.** A song starts as `freshChannelState` starts the synth: CC121, program 0, pan and bend
  centred, volume full and scaled, a millisecond before its origin. A stop releases every note it struck (a note-on
  still queued is answered just after itself), then sends the pedal up and all-notes-off on every channel, now and
  again after the last message queued. The next song begins after that.
- **A stalled tab** skips its gap as the synth does, and tells the device each control's last value past it, in the
  order those last values came (a bank select before the program it selects).

AUDIT MIDI-OUT1 (2026-10-11, the owner: "Audit this"). A high-effort review of the slice found ten candidates; eight
were real and are fixed. (1) CC7 was scaled LINEARLY, so the default volume played at -12 dB where the synth plays -6,
and every fade ran along the square - now the square root, above. (2) A key struck again while it sounded was cut by
the earlier note's release. (3) A fresh song's first window was queued inside `play()` at whatever fade the player
held, so a player whose fade stood at 1 struck the opening notes at full before `_playBuiltIn` dropped it for the rise -
`_playBuiltIn` now takes a fresh song's fade down BEFORE the play too (on the synth the order changes nothing). (4) A
tab's Restore wrote the pick to Off on the shelf alone and the music stayed on the device - it goes through
`setMidiOut`. (5) The row walked the outputs by index, so two devices sharing a name trapped it - `nextMidiOut` walks
distinct names - and (6) a pulled pick stepped to Off rather than to the device that is there. (7) The stall re-sent
controls in the order each was first seen. (8) A song asked for before the first gesture waited for an AudioContext
a device does not need - adopting a device plays it. And a stop on a player with nothing sounding sends nothing. Not
taken: a song's level clamping at CC7 127 (no device has headroom past it; at the default volume every level the
scores carry fits) and the cost of a switch's quiet bursts (both stops now quiet once). With (2) in, the release-slack
of the first cut was dead code - the overlap release covers the rounded re-strike - and went, with its two mutants.

Port-Ledger A: THE MUSIC ON A MIDI DEVICE. Pins: `test/systems/midiout1.test.js`, 15 tests; `tools/mutants/midiout1.json`,
28 mutants, all dead.

## GATHER-FEEL (2026-10-13): the gathering heard - the port's own clips, a blow as it lands

Mac: "I want to improve gathering, add gathering sounds and overall make the experience more palatable." The record is
`06-Systems/Professions-Arc.md` section 44; what it is to this page:

- **Thirty-six clips the port makes**, the climb's way (CLIMB4): `tools/gatherSfx.mjs` synthesises them from noise and
  sine on the shared kit, `tools/sfxSynth.mjs` (which now holds the climb's pieces - its eleven clips byte for byte), and
  bakes them to DAGGER.SND's 11025 Hz unsigned 8-bit mono (`tools/sndify.mjs`) into `public/sfx/gather-*.wav`, each with
  its row in `public/sfx/SOURCES.md`. Deterministic: every noise seeded, so the tool writes the shipped bytes. A struck
  body is modal synthesis (damped sines - wood's few and quickly gone, stone's brief and bright, ore's long and
  shimmering), a groan and a rip a stick-slip pulse train through resonant bands, water rising-pitch bubbles under
  splashes whose top falls away, leaves short grains through a leaf's band. `--measure` prints each clip's attack,
  crest, tail and brightness (`tools/sfxBake.mjs` measure).
- **One ear** (`systems/gatherSounds.js`), registered on the bus under string keys (`registerSound`, MW-D40's door), the
  first frame the port's own sounds are on (ES1). Positional through `play3d` at the node (a node in reach - DFU's
  activation distance - at its full volume) or where the net landed; a hand's and a chime flat through `playOneShot`. A
  blow is held for its machine to land it (AUDIT GATHER-FEEL F3: the machine's count of blows landed - one clock with the
  view's kick, the chunks and the node's going; the ear's own clock keeps the rest). A node's going is kept by its key
  while it sounds (the bus's `play3dVoice`, a positional shot whose stop fades over VOICE_FADE_S): a refused harvest's
  tree stood again is heard falling no more (AUDIT GATHER-FEEL F7). The floating origin's shift carries the places the
  ear holds (AUDIT GATHER-FEEL). The classic skin keeps `systems/professions/profSounds.js`'s DFU clips, said by the ear on the same
  beats.
- **Levels** are each clip's measured loudness (its loudest 50 ms) set against the others: a blow near -15 dB at the
  bus, the fall near -8, the water's plip near -28 - a first mix, set on numbers; no clip here has been heard by ear.

## GATHER-FEEL II (2026-10-13): another player's gathering, heard at their act

Mac: "Do the not done." The record is `06-Systems/Professions-Arc.md` section 45 (PEER-ACTS); what it is to this page:

- **The same clips, the same beats.** A peer's act rides their pose (RELAY_VERSION world200: the act, its beats, the
  net's throw), and the beats the pose counts are the gatherer's own ear's law (`actBeats`) - so the others hear what
  the gatherer hears. `net/peer/peerGather.js` PeerGatherSounds says them positional through `play3d`, with the peers' own
  falloff (`net/remotePlayers.js` PEER_SOUND_PROFILE - full inside 6 m, silent past 30), at the act's place: a metre
  before the body at the hands' height, the net's sounds where it landed (the throw's metres along the way the body
  faces).
- **On the blow's time.** A tool's swing sounds as its beat arrives; its blow is held for DFU's melee hit frame of the
  swing (PEER_BLOW_DELAY_S - the acts' own `landsIn` at the press), as the gatherer's own lands. The water keeps its own
  clock on the listener's side: a plip every 2.2-5.5 s while the net waits, the catch fighting every 0.5-1.1 s while it
  hauls.
- **The skins.** The port's clips on the enhanced skin (ES1), each at its `GATHER_SAY` volume, pitch and variety; on the
  classic skin the DFU cue the gatherer's ear says for that beat (`systems/professions/profSounds.js`), positional too.
- **The switch and the floor.** Behind the swings' switch (`peerAttackSounds`, "Attack sounds" - a tool's blow is a
  swing) and the earshot; the law is told every change while silent, so turning it back on replays nothing; one cue a
  peer every 100 ms (one pose at the pose's top rate, POSE_HZ - AUDIT GATHER-FEEL R7: no floor of the climb's); a peer
  gone forgotten; the floating origin's shift carries a blow in the air and the net's place with the land (AUDIT
  GATHER-FEEL W1). A blow the gatherer took back (Escape, walked off, a window, the dungeon left, the switch shut) rides
  the pose as its `stop`, and is dropped before it lands, under the floor too (AUDIT GATHER-FEEL W2); the net's water is
  heard at the net however its landing was missed (W1).
- **Not heard here**: the creak, the fall, the logs, a vein's rubble and its chunks are the node's, and the node is each
  character's own - another's tree still stands for you.

## GATE-MIX (2026-10-20): the limiter - every bus to the speakers through one stage

The owner: "in oblivion gates ... while performance is overall good, the game hitches, audio becomes super loud and even
distorts". Nothing stood between the mix and the speakers: the listener's bus (DW-D) went straight to `ctx.destination`,
and a sum past full scale was cut square by the browser. The Burning Court reaches it easily - the boss's own clips peak
at full scale in DAGGER.SND (measured: his bark and attack, records 208 and 209, a body's fall, 15, the fire's cast, 84,
all at 0 dBFS; the burning loop, 420, at -8.9), his cues play them at 1.3 to 2.2 (`gateBoss.js:"export const BOSS_CUES = Object.freeze({"`),
a landing sounds two of them in one frame (the slam's land and the quake), and the court's score is pressed to a decibel
under the clip (WB10a). At the default SoundVolume of 0.5 a single cue at 2.2 already passed 1; at a higher one, most of
his heavy blows did. The per-target copies that made it worse, and the other players' sounds now 4 dB down in the
court as in the Spire, are `11-Multiplayer/World-Bosses.md` section 28.

- **The stage** (`audio.js:"  _limiter() {"`): the listener's bus into a DynamicsCompressorNode run as a limiter (LIMITER:
  -3 dB, no knee, 20:1, 1 ms in, 120 ms out), a trim, and a soft ceiling - a WaveShaper whose curve (`limitAmplitude`) is
  the signal itself up to LIMIT_LINEAR (0.75) and a tangent's shoulder over it toward LIMIT_CEILING (0.98), reaching 12 dB
  over full scale (LIMIT_RANGE 4). The compressor holds a loud moment down cleanly; the ceiling rounds off what its attack
  lets through, so nothing reaches the speakers past 0.98 by construction.
- **Unity under the threshold.** The Web Audio compressor applies its own make-up gain - (1 / full-range gain)^0.6, the
  spec's - which would have raised the whole mix 1.7 dB; `limiterTrim` takes it back out, so everything under -3 dBFS
  plays exactly as before (the curve is straight there and the shaper is not oversampled, so it is exact).
- **Every bus.** The effects master, the reverb's wet and the music's master all reach the listener's bus already
  (DW-D), so all of them reach the limiter; the underwater low-pass (`setListenerLowPass`) hangs before it and comes off
  back onto it. A context with no compressor or no shaper plays straight through, as before.
- **Not a DFU member.** Unity's mixer clips the same way; this is the port's own stage, past DFU on purpose, and moves no
  DFU volume - every call site's level is as it was.

Pins: `test/systems/gatemix_limiter.test.js` (4: the ceiling's law; the curve as the WaveShaper reads it; the trim
against the spec's make-up; the graph - the listener into the limiter, the low-pass before it, an old context straight
through). `tools/mutants/gatemix.json` (with section 28's: 36 dead, one equivalent as recorded).

## SOUNDSCAPE (2026-10-24): the sea under a deck, the shore, the wild and the town - SEA-AIR and WORLD-AIR

The owner: "I want to talk about enhancing sound and ambience, different music and ambience sounds for sailing, more
varied horse sounds, amd whatever else we could improve"; then, asked, the owner chose recordings for what a synthesiser
does badly and code for the rest (a mix: CC0 recordings for the animals and the gulls, the beds made in code), and all
four parts. Four slices: SEA-AIR and WORLD-AIR here, SEA-SCORE and HORSE-VOICE below. Each is the port's own, behind
Enhanced Sounds (ES1) on the enhanced skin, laid over DFU's ambience and never instead of it: the classic skin and the
switch off hear exactly what DFU and the mods play. Ledger A (SOUNDSCAPE, SEA-SCORE, HORSE-VOICE).

THE HOST HALF (`scenes/soundscapeHost.js`, HOST-SPLIT's shape). The world host builds it once beside the Deadlands' air,
handed its own doors and objects as they are: the boat I sail or ride, the naval host's deck test (any ship's deck - a
boat of mine at anchor off her helm, a sea ship's, a peer's - is the sea's: AUDIT SOUNDSCAPE S2), her heading's law
(world.js boatForward, off her own rotation: S3), Come Sail Away's runtime, the naval host's battle word (the watch's own:
M2), the map's open sea (world.js openSea - never a lake the map draws: W8), Deep Waters' player, PlayerGPS's own town
test (`_isPlayerInTownStrict` - never a dungeon's, a graveyard's or a coven's rect: W1), the living towns' index and
the building doors. It is called three times: `frame` on the exterior frame after the listener is set (its ear and its
forward are the engine's `listenerPose`; the game's pause handed it), `stop` on every modal frame beside the wind's (a
building, a dungeon, a cabin: silent, nothing left looping), and `scoreFrame` in the music's chain after the gate's, the
Hour's and the arena's. What is dear to ask it keeps on its own clock (twice a second, or at once past 15 m walked):
THE SHORE'S EDGE (`shoreEdge` - where the water changes, the sea deeper than 0.3 m meeting the shallows or the land,
found from either side of it: a swimmer far out is at no edge, where the first cut had them "standing in it" with the
surf at full - W3; asked on twelve bearings at each of seven rings out to 200 m, nearest ring first, every bearing that
meets the change placed by halvings and the nearest kept; the edge a point at the sea's own surface, which stands while
I walk - W9, W10), land near a map pixel for the gulls, the sea beside one for a far surf where Deep Waters is not
standing, a port near, the town's size, and the smithies' and taverns' doors within 70 m - each at its own doorway, its
door's centre 1.2 m out along its face (`foeSpacing.js` doorSpotsNear, the one home of a door's place: its building's
placement was the building's middle, 7 to 13 m inside it - W2), its type off its block's own building list. The clips'
loader is asked every frame and its own backoff decides (S7). THE FOUR HOSTS: world.js wires it; exterior.js FLAGGED
(the fixed-city bench: no sea, no boats, no streamed shore); worldModes.js and dungeonContext.js silence it by the modal
frame's return.

THE BEDS THE PORT MAKES (`systems/soundscape/soundBeds.js`) - the swell, the wash past a hull, the wind in the rigging,
the surf, the lap at a sand's edge and a marsh's insects - are FIELD-WIND1's way: seeded noise cut by chains of the wind
bed's own sections (`systems/soundscape/bedDsp.js` `section` and `mulberry32`, moved out of `windAudio.js` for them,
with a high-pass arm beside the two - the wind's bed byte for byte as before), each chain run twice and the second pass
kept so the native loop has no seam, the layers summed and levelled to an RMS. A bed with nothing over 2.5 kHz is made
at DAGGER.SND's 11025. None ships a file. They are MADE OFF THE MAIN THREAD (`systems/soundscape/soundJobs.js`, a module
worker `soundWorker.js` spelled the way Vite bundles one, as the nav and the terrain workers are - AUDIT SOUNDSCAPE W4,
S5): a bed is 15 to 50 ms of work warm and 70 to 170 ms cold, and the first cut made it in an idle callback, which on a
busy page runs as one ordinary task and stalls the frame all the same - and a page with no idle callbacks made all
three of a deck's inside its first frame. Where no worker can be had it is made in idle time, and with none of that at
once; one at a time always; a maker that throws is given up for the session; the samples are let go once the engine
holds its buffer. A town's two beds (`townBeds.js`) go the same door, their voices handed to the worker.

SEA-AIR (`systems/soundscape/seaAir.js`), while I stand on any ship's deck in the open - over Come Sail Away's own two
hull loops and its oars, never instead of them:
- **The sea state** (`seaState`): a floor of 0.15 in a flat calm, seven tenths of the wind over it, a rain's 0.12, a
  storm's 0.35, snow's 0.06. The wind is the sky's (windDrive's `strength01`) - the ear hears one wind, the one WIND3's
  bed and the trees already say; her sailing reads Come Sail Away's own rolled wind (AUDIT SOUNDSCAPE S11, a choice).
- **The beds**: the SWELL (0.15 in a calm to 0.78 in a gale, 0.55 of it riding the swell's own clock - `seaSwellAt`, three
  long waves of 8.3, 12.7 and 5.1 s summed, so no two swells are alike); the WASH, nothing under 0.4 m/s of way and all
  of 0.6 by 7, riding the swell a beat behind; the RIGGING, nothing below a 0.5 wind (a storm adds 0.3), all of 0.42 in
  a full gale, breathing with the gust. AUDIT SOUNDSCAPE S6: the first cut's levels, a third of these, sat 16 to 24 dB
  under the mod's own hull loops on the same bus, under 500 Hz where both live; now a moderate sea reads about -38 dBFS
  at the ear and a gale about -34, beside DFU's rain loop's -40, still well under the mod's loops (-24 at the helm).
- **Her way**: my helm's word at my helm; a boat I ride and do not steer - another player's - says it by her own going
  (her root's speed, eased over 0.6 s, a step past 40 m/s a recentre or a snap, never her way - S4: a passenger heard
  her lying still at six knots); a deck off any helm lies still.
- **The events**: GULLS by day out of rain, storm and snow while land is within two map pixels, one every 7 to 26 s 25
  to 70 m off over the water, three calls in ten followed by a second; and THE WATCH BELLS (`watchBells`): each half hour of the world's
  clock crossed at its own pace, one bell at the half hour after a watch begins (the watches turning at 0, 4, 8, 12, 16
  and 20 o'clock), one more each half hour, eight as it ends, struck in pairs (0.42 s within a pair, 1.15 s between) on
  Daggerfall's own bell (DAGGER.SND 107, the arena's call and the naval host's struck colours) at 1.22, on her deck 3 m
  ahead of me along her bow. The pace is read off the clock itself - its minutes a real second, eased over 3 s - never
  a dial (S9: online a crossing's dial moves no shared clock, and its bells fell silent at a pace the clock never ran):
  none past 0.5 (two and a half times DFU's 12 to 1, so Come Sail Away's x5 rings none), none for a jump of the clock (a
  load, a rest, a journey), never twice within a minute of real time, and midnight's eight across the minute's wrap.
- **DECK-QUIET** (2026-10-26, the owner: "Remove all deck at sea"): the deck's own one-shots are gone - a wave slapping
  her hull at a crest, the timbers working, the ropes in their blocks, the canvas luffing and the spray over her bow -
  with their eleven clips and the laws that timed them (S8's luff gap and S10's ropes with them). The beds, the gulls
  and the bells stay; Come Sail Away's own loops and oars are untouched.
- Her bell is HERS, off her heading, never the camera's (S3: the bell turned with the head); with no heading to be had,
  the ear's forward. Every event aboard is played
  `far` (`audio.js` play3d), its offset from the ear held while it sounds, so it rides with the deck. The first frame
  aboard plays nothing: every clock is seeded a gap away. A pause holds every clock - the bells' strokes due across one
  fall at their own spacing after it, where the first cut rang them all on the unpause frame, 15 dB over one (S1).

WORLD-AIR (`systems/soundscape/worldAir.js`), on land outdoors - over WeatherManager.SetAmbientEffects' four presets
(`ambientEffects.js` presetForExterior: rain, a storm, a sunny day's two birds, a clear night's crickets, the same in
the Alik'r as in a Wrothgarian pass), never instead of them:
- **The shore.** The SURF a bed AT the water's edge (`setBed3d`, inverse from 12 m) - the host's own point at the sea's
  surface, standing while I walk, its distance measured live - where its bearing is known, flat where it is not, never
  both; out to 220 m, the last 40 eased to nothing; its waves on a breaker's clock - a period of 7 to 11 s, a third
  shorter in a heavy sea, each curling up over 1.0 s from the surf's floor of 0.22, crashing and running back. The crash
  is a one-shot of the port's own at the edge while it is within 90 m, once a wave, started so its own loudest (0.83 s
  and 1.0 s into its two takes) falls on the bed's crash, where the first cut played it as the wave began and again a
  second late (W5); its loudness the sea's alone, the distance the panner's, never both (W6). Close in (14 m) on a quiet
  sea (under 0.45), a LAP under it.
- **The wild**, by the climate under me (`WILD`, CLIMATE.PAK's) and the hour: the woods' crows by day and owls (18 to
  55 m off, at 0.2 to 0.32 - a pure tone is louder than its peak says, and the first cut's owl sat 8 dB over the crow's
  caw: W12) and a far wolf (160 to 420 m) by night; the mountains' wolves more often; the haunted woods' crows often;
  the swamp's and the rainforest's frogs (a chorus of up to three at night) over a marsh's insects; the desert's far
  howl at night, pitched up (1.25 to 1.45); nothing over the ocean (`wildVoicesFor`). Rain quiets the crows and the owls
  and makes the frogs croak twice as often, the wolf still howling; a storm leaves only the frogs; snow and the winter
  (where the climate has one - `soundscapeHost.js` winterIn) take the frogs; inside a town no wolf and no frog, the
  rest three times further between and 1.6 times further off (far and seldom: W14).
- **The town**, inside PlayerGPS's own town: its MURMUR by day (6.5 to 21.5 o'clock, rising to the busy hours 10 to 17),
  as loud as the root of the town's size (16 blocks its whole), quieter in the rain (0.45), a storm (0.2) and snow
  (0.6) - a bed built from the player's own DAGGER.SND people (AmbientPeople1-10, `arenaSound.js` synthBed on its own
  seed, its top eased off: a square heard, not a crowd at the ear), never shipped, played as two loops of it, the
  second a little lower and so a little longer, each at the whole's power over the root of two (W13: one 8 s loop of the
  same fragments was a loop an ear finds); its SMITHIES at the anvil from 7 to 19, bouts of 3 to 9 blows at the
  armourer's or the weaponsmith's door within 45 m with rests of 5 to 16 s; its TAVERNS' noise at the door within 35 m,
  the same people darker through the wood, louder from 17 to 2 o'clock and asleep from 2 to 10 (0.03 - W13: four in the
  morning was as loud as noon). A smith's queued run is let go the moment the smith stops - the evening, the door out of
  reach.
- A pause holds every clock - the wild's voices, the waves, the smith's bouts and every call queued (W7).

THE CLIPS. Six of the port's own (`tools/soundscapeSfx.mjs` -> `public/sfx/{shore,wild}-*.wav`: a wave breaking, two
owls, two wolves - eleven more, the deck's, went with DECK-QUIET - the gathering's pieces moved into the shared kit for
them, `tools/sfxSynth.mjs`, the gathering's thirty-six clips byte for
byte as before); and thirteen CC0 recordings from OpenGameArt baked by `tools/soundscapeSfxInstall.mjs` (six gulls by
Rango Mango, a crow by fvcalderan, four frogs by EZduzziteh - each croak, cut out of its take mid-sound, eased in over
4 ms and out over 15 so neither edge clicks (W12, `tools/sndify.mjs` bake `edges`) - two anvils by VishwaJai and
themightyglider; Freesound, the gun lab's source, is not reachable from this session's network). The decoder's door
takes `CHROMIUM` as the probes do (`tools/sfxBake.mjs` withDecoder). Every row is in `public/sfx/SOURCES.md` and the
doctrine allow-list. ONE LOADER (`systems/soundscape/clipInstall.js`) for these and the horse's: a first load that
failed is asked again at 2 s, 8 s, 30 s and 2 min, then not at all; a file the server refuses is never asked for
again; asked every frame with nothing to do it makes nothing (S7, H2, H6). Levels are set on numbers (the bake's
peaks, the laws' gains, the levels measured through the engine); none of these sounds has been heard by ear.

Pins: `test/systems/soundscape/seaair.test.js` (10), `soundbeds.test.js` (3), `soundjobs.test.js` (5),
`worldair.test.js` (10), `test/scenes/soundscapehost.test.js` (10); `tools/mutants/soundscape.json` (126, all dead).
The audit: `01-Overview/audits/Audit-Soundscape.md`.

## SEA-SCORE (2026-10-24): a helm heard - the sea's own songs

SEA-SCORE (the owner: "different music and ambience sounds for sailing"): THE SEA'S MUSIC (`systems/soundscape/seaScore.js`)
- six songs for a helm by the same door as the Warden's, the Hour's and the arena's: made notes registered by name,
seamless, played by the game's own player and FM bank, faded by DISC20-B and replaceable by a music pack. Daggerfall
has none: SongManager's playlists know a dungeon, a building and the sky, never a ship, so a voyage heard the overland
weather songs. SEACALM (6/8, D Dorian, the harp rolling under the flute), SEAOPEN (a shanty in G with the flat seventh
borrowed - its F chord, F natural over it, G major elsewhere: AUDIT SOUNDSCAPE M7, where the first cut called it
Mixolydian - the fiddle over the accordion's off-beats and a bodhran), SEASTORM (D Aeolian, the low strings driving,
timpani, open-fifth brass, the choir - the weather, not a villain), SEANIGHT (3/4, A Dorian, sparse), SEAPORT (a jig in
D, landfall) and SEAFIGHT (the swashbuckler's i - VII - VI - V and the minor iv under a snare's march; a sea fight had
no music at all). They carry their own voices (EG-ROAR: the accordion's reeds tuned apart, a bowed fiddle on the
violin's program - GM's fiddle is plucked in this bank - and THE DRIVE, the storm's and the fight's bowed eighths and
the storm's sixteenths on a cello that speaks and stops inside its note: on the cello's own envelope every strike still
sounded under the next three of its key, and copies of one pitch cancel and swell, so the storm's drive was quietest,
with holes 18-20 dB deep inside each eighth, on its own tonic - M5). A key struck again ends the note before it there
(`makeSong`). NO press: they stand where the day songs stand, never at a boss's level - each song's `level` set so,
measured over the whole of each song through the same player (`tools/seaScoreProbe.mjs`, which renders MIDI.BSA's
outdoor songs beside them, whole, when the player's ARENA2 is at hand - M4: the first cut measured each song's first
30 s, 11 to 26 bars of 32 to 64, and never heard the storm's stabs or the fight's tutti), the open sea and landfall read
-29.6 dBFS beside the day songs' -29.4 (SUNNYDAY -30.2), the storm -29.9, the fight -28.7, the still sea -31.4, the night
-36.1 - inside Daggerfall's outdoor songs' -43.4 (GEERIE) to -28.2 (RAINING) - every peak at least 6.6 dB under the
clip at the highest MusicVolume. On a MIDI device (MIDI-OUT1) each song's level rides the channels' CC7, which tops out
at 127: past a MusicVolume of about 0.58 the still sea's loudest channels clamp and its mix flattens (the others from
0.67 to 0.77), at the default 0.5 every level fits - FLAGGED (M6), as MIDI-OUT1 records for the made scores. THE LAW
(`seaScore.js:"export function seaScoreFor(ctx) {"`): no helm, no score - but aboard in a sea fight, the fight's still
(M1: "Grapples away!" and "Repel boarders!" let the helm go, and the deck fight, a sea fight's climax, played the
overland song); a sea fight as the watch knows it (the naval host's `battle`: her guns run out, the crew called to them
by WK-W2's alarm - by night only a ship the night's law shows, or one that comes for me - or a boarding; M2: the
first cut's hostileNear started the fight's song for a dark pirate the watch had not sighted at 500 m), then a
thunderstorm, then a port's approach, then the night, then a drift under SEA_CALM_WAY (2.5 m/s) or a fog, else the open
sea - rain and snow at sea are the open sea's. THE HOLD (`seaScore.js:"export function createSeaScore() {"`): a song
plays whole - its own length, never under SEA_SCORE_HOLD_MS (90 s) - and the law must have wanted another for
SEA_SCORE_SETTLE_MS (20 s) on end before it changes (M3: a 90 s timer alone changed on the dot, at the calm line every
90 s from the top, and the still sea's choir and the shanty's last tutti were never heard); a fight or a storm comes in
at once; a fight's song outlives it by SEA_FIGHT_TAIL_MS (20 s, from its last word - at 12 s a ship at the edge of a
hostile's reach restarted the fight's song seventeen times in five minutes), aboard off the helm too; a helm let go
ashore lets the music go at once. THE HOST (`scenes/soundscapeHost.js` scoreFrame): the songs registered the first time a
helm is taken; held before the director, after the gate's, the Hour's and the arena's; standing on a deck at no helm
and in no fight is the director's; let go by a fade, never a cut. A GM device plays real patches: the fight's timpani
fifth reaches G1 and the night's flute answer B3, under those instruments' own compass - the FM bank plays any key
(M8, a NOTE). None has been heard by ear. `test/systems/soundscape/seascore.test.js` (6); `tools/mutants/seascore.json`
(38, all dead).

## HORSE-VOICE (2026-10-24): the horse heard - its moods, its breath, the ground under its hooves

The owner: "more varied horse sounds". DFU's TransportManager gives a horse one voice, AnimalHorse (99), on a clock that re-rolls to 2-39 s and to 1-4 s on a mount, and one ground: HorseClop (97) slow, HorseClop2 (298) fast, HorseAndCart (104), whatever the hooves come down on (`systems/riding.js` RidingAnimator, every arm kept). Behind ES1 the horse is heard in that place (`systems/horse/horseVoice.js`); off, `player/mountRig.js` plays the classic two as it always has, its own lines as the else arm (`mountRig.js:"if (r.neigh) audio.playOneShot(SOUND.AnimalHorse, RIDING_VOLUME_SCALE * horse);"`). That arm is the port's older line kept verbatim, and it is not DFU's in two places this change leaves alone (AUDIT SOUNDSCAPE H5, FLAGGED for a change of its own): it neighs at a constant 0.6 through a Travel Options journey, where DFU's neigh rides RidingVolumeScale (TransportManager.cs:282), and under a pause, where DFU's `Time.time` stops. A departure with no DFU member behind it; Ledger A (HORSE-VOICE).

- **The voices.** DFU's clock stays the clock: each moment it rolls says a voice of the horse's MOOD then. The first after a mount is a whinny (the neigh at 1.08). Foes in sight are the alarm, blown is tired, then the gallop, the walk (calm) and riding on, each mood's weights over the neigh (at one of 0.94, 1, 1.05 and 1.1) and the port's snorts and blows, never a clip twice running. Beside the clock, three of the port's own:
  - **The gallop's breath:** past 8 s of gallop, or galloping with horse care's breath short, an exhale once a stride, a little uneven, harder as it runs on. The stride is the clop's: 0.52 s at pitch 1 over the loop's own pitch, so 0.43 s at the gallop's 1.2 (AUDIT SOUNDSCAPE H3).
  - **The blown horse:** after a long gallop, or with horse care's breath under 0.4 (`upkeepRuntime.js` `bar`), heavy breaths at the walk and standing, every 2.2-3.4 s, a blow among them.
  - **The spook:** foes about (`encounters.js` areEnemiesNearby, DFU's own question: a foe that sees the rider, or one unseen inside the classic spawn band - AUDIT SOUNDSCAPE H9; asked four times a second) give the alarm snort and, on its heels, a high neigh, never again within 30 s.
  - A pause holds them all, and a moment of DFU's clock that falls inside one is said on the first frame after it, as DFU's `Time.time` would bring it (AUDIT SOUNDSCAPE H4). A ride heard on DFU's sounds a while (the switch off, the classic skin) owes nothing when the voices come back: no whinny for a mount long gone, no spook's neigh, no blowing for an old gallop (the rig's `hush`, H1). Each plays at DFU's RidingVolumeScale, which Travel Options' journey zeroes, so a journey silences them too.
- **The hooves.** The ground is the stride's own answer, `footsteps.js` pickFootstepKind (the world host's PEER-FS1 cache; the fixed city takes the kind off its set's own ctx). Stone (a path, a road, a street, a bridge) keeps DFU's clop; the open ground is a duller fall in the grass, snow a crunch, the water's two arms a splash. The gait and its volume and pitch are DFU's. Each of the port's loops is cut to the classic clop's own length and falls (`tools/horseSfx.mjs` HOOF_CADENCE, measured off records 97 and 298), so a ride's beat is the game's on every ground. The cart keeps its rattle; a loop not loaded plays DFU's. Another player's hooves take their ground off their pose's `fk` (`net/remotePlayers.js`).
- **The clips.** Fifteen of the port's own, the climb's way (`tools/horseSfx.mjs` -> `public/sfx/horse-*.wav`, DAGGER.SND's 11025 Hz 8-bit). Each is baked to a loudness target set against the classic clips it plays beside: HorseClop -18.3, HorseClop2 -11.0 and AnimalHorse -8.6 dBFS (loudest 50 ms), so grass sits a shade under the road and a snort well under the neigh. A first mix, set on numbers; none has been heard by ear. Loaded by the soundscape's loader (`systems/soundscape/clipInstall.js`): a clip the bus would not take is asked again at 2 s, 8 s, 30 s and 2 min, then not at all (AUDIT SOUNDSCAPE H2). The CC0 trot recording offered (OpenGameArt's "Horse Trotting") was not used: its falls overlap unevenly and no clean loop on DFU's beat could be cut from it.

Pins: `test/systems/horse/horsevoice.test.js` (13); `tools/mutants/horsevoice.json` (49, all dead).

## INTRO3 (2026-10-14): the main theme, written as notes - the film's and the menu's

**Reverted 2026-10-25 (INTRO-REVERT, `10-UI/UI-Arc.md`).** The film and the menu play the recording again
(`src/assets/intro/theme.mp3`). The score below is no longer heard.

The owner: "With the main menu music, is there anyway to recreate it using the sound system daggerfall's music uses",
then "you do it and it's for both". The front door's theme was a recording decoded by a session of its own; it is now
a song made in code (`systems/introScore.js`, `DFOTHEME.HMI`) - the fourth after the Warden's score (WB7), the Arena's
and the Hour's - transcribed from that recording bar by bar and played by `SongPlayer` and the FM bank for the film
and the menu (`systems/introTheme.js`).

- **Its tempo is the film's**: one tempo (128.76 BPM, 68 ticks of lead) that puts the cue sheet's cloud break (11.712 s)
  and the logo's beat (19.168 s) on its bar lines, within 0.2 ms.
- **Its volume is the player's own law**: MUSIC_GAIN under MusicVolume and the video mute, followed live; the session's
  gain is the film's level (0.82) or the menu's (0.26) alone.
- **Its loudness is the recording's**: a light press (`INTRO_PRESS`, 3:1 from -14 dB, ceiling -1 dBFS) at level 1 -
  about -22 dBFS through the body at MusicVolume 0.5, the recording's rise and fall kept. Measured through the real
  player: `tools/introScoreProbe.mjs`.
- **Not here**: a music pack's replacement by name and MIDI-OUT1's device - the session plays before the music service
  exists, on the FM bank. `10-UI/UI-Arc.md` INTRO3.

**INTRO3b (2026-10-23, the owner: "too flat"): the theme is the second song to carry its own voices and kit**
(`systems/introScore.js` `INTRO_VOICES`, `INTRO_KIT` - EG-ROAR's `songVoices`, `songKit`, after the Spire's). Measured
against the recording's first 27 s, the dry render's spectral centre stood at 305 Hz to the recording's 521, its share
from 2 kHz up 13 dB under, and its two channels all but one (L/R correlation 0.985 to 0.33). Now: the bowed sections
ensembles (unison copies spread either side of their place, the FM index higher and slower to settle), the choir and the
pad on odd harmonics, a halo of four tremolo violins on the choir's chord an octave up, the taiko and the toms with their
beaters' clicks and the snare a crack over a skin, a suspended cymbal's wash, the low brass's braams, snare rolls and a
CC7 swell into every turn - and THE HALL: the intro session hangs a concert hall's convolver under the player's master
(`systems/introTheme.js` `introSpace`, its impulse from I3DL2 numbers through `reverbPresets.js` `reverbImpulse`, the
first use of that builder outside the engine's zones), through the session's own gain so MusicVolume and the mute reach
it. The film's 27 s measured after: 483 Hz, -14.7 dB from 2 kHz up, correlation 0.61, both landmarks at 0.0 ms, the peak
-3.1 dBFS at the highest MusicVolume - the hall sums over the press, so the ceiling is measured there, not held by
construction; the whole song as loud as the recording (-22.6 dBFS to its -22.4), correlation 0.63, 436 Hz, -15.0 dB, 9/9. `tools/introScoreProbe.mjs` pins the width and the presence beside the landmarks. The whole record is
`10-UI/UI-Arc.md` INTRO3b.

**INTRO3c (2026-10-24, the owner: "I dont like the high pitch whine"; "Its not natural"; "Now it just sounds like
static. Stop band aid fixing"): the whine was the model.** Measured over the opening's held chord against the recording:
two-operator FM at 1:1 put the chord's 4th and 6th harmonics as loud as its fundamentals with the 7th and the 9th 50 dB
under them - isolated pure lines 6-12 cents wide, where a string section has a dense series with a plateau from the 5th
and every partial 20-50 cents wide - and the render had no body (315-630 Hz 5-7 dB short) and no presence (2-3 kHz 8-10
short). A vibrato widened the lines; a breath of noise under the notes was the static. So the intro's bed is BOWED
(above): sawtooths under the bow's low-pass, each section through its body (the strings' bridge hill at 2.7 kHz, the
choir's vowel at 650, 1050 and 2500), an air shelf and an ensemble, with a vibrato and a bite at most; the horn and the
brass stay FM, the horn's index settling to half; the mix through THE TONE, the recording's third-octave curve against
the render's. After: the chord's harmonics 0, -10, -21, -13, -17, -18, -18, -22, -25 dB, its partials 18-47 cents wide,
the film within 3 dB of the recording's curve from 80 Hz to 10 kHz (a mean of 1.2), 483 Hz and -13.3 dB from 2 kHz up.
The riser into each landmark (the owner: "still a high pitch whine in the build up leading to the title drop") was the
Spire's inharmonic FM shimmer, its sidebands 14-17 dB over their surroundings through both build-ups; it is a suspended
cymbal's roll on the kit now (`swellInto`, the ride under soft mallets), a band of noise with no line in it. The hum
("too constant ... too overpowering") was the contrabass's pedal and the pad, flat sawtooths 7 dB over the recording's
bass: every held voice has the bow's arc now (`arc`) and the bed sways (`sway`), the bass plays at the bank's gain with
the low end's weight in the drums, and the opening's bass sits at the recording's (-16.3 dB to its -17.1).
`tools/introScoreProbe.mjs` pins the chord's shape (`chordShape`), the build-up (`riserShape`) and the bass (`bassShape`) beside the width and the presence. The whole song: as loud as the recording (-22.9 dBFS to its -22.4), correlation 0.62,
502 Hz, -13.1 dB, 11/11. The
record is `10-UI/UI-Arc.md` INTRO3c.

**INTRO3d (2026-10-24, the owner: "Intro music is broken"): the theme could not keep time.** INTRO3c's graph cost more
than real time: in a live context the theme fell behind its film from the cloud break and was 5.9 s behind by 40 s
(`bab97c18e` on, bisected; INTRO3b's held to 0.03 s) - the music stuttering and dropping out under the film. Two
causes, traced per node type on Chromium's `webaudio.audionode` category. A FINISHED NOTE WAS NEVER LET GO: Chromium does
not disable a chain whose nodes take more than one input (a bow's low-pass a side, the bite into both), so every finished
note stayed on its channel and was pulled every quantum - 440 dead filters and 520 dead panners a quantum by 40 s, the
cost climbing as the song went on. Now a note's outputs leave the channel as its oscillators end (`oscs[0].onended`).
AND EVERY COPY RAN ITS OWN SINES: a vibrato LFO and a sway LFO a copy a note, 360 oscillators at the densest. Now
`_channelLfo` holds one a channel a copy (each copy's rate as before; the vibrato's depth still the note's own, set in
over the attack), the vibrato in Hz into each oscillator's frequency (an a-rate detune costs an exp2 a sample), and the
bow's low-pass and a bowed pitch read once a render quantum (`slow`, k-rate). Offline load over the first 60 s 1.1x real
time to 0.51x (INTRO3b's 0.48x); live, 0.05 s behind at most over 60 s. The probe, the same 11/11 at 30 s.

## HORSE-VOL, ANIMAL-VOL, SOUND-LIVE (2026-10-23): two more Volume rows, and every sound on a slider

travddm: "add an ability to disable horse neighing"; then "Add both animal volume & horse volume (since you use horses
to travel, but not other animals, so you're around them a lot more). Also, there are reportedly some sounds in the game
which are not tied to any volume sliders at all - let's try to surface these and make sure they're tied to sliders."

- **Horse Volume** (`systems/animalVolume.js` horseVolume, uiPrefs `horseVolume`, 0-100%). Every horse heard: the
  mount's neigh and its riding loop (`player/mountRig.js`), a mounted peer's loop and neigh (`net/remotePlayers.js`), a
  town's horse flat (`systems/animalAmbience.js`), and the team the Wagon Warden lifts (`scenes/world.js` WARDEN_CLIPS
  `heave`; the throw and the landing are the guard's sounds, not a horse's). With the port's own sounds on, HORSE-VOICE's
  voices (the mount's whinny, the snorts, the breath, a spook) and its hooves on the ground, mine and a peer's, are on
  the row too. At 0 no horse is heard.
- **Animal Volume** (uiPrefs `animalVolume`): every other archive-201 animal flat - the dog, the cat, the pig and the
  cow (`soundClips.js` ANIMAL_SOUND_BY_RECORD, GameObjectHelper.AddAnimalAudioSource's table). A horse flat answers to
  Horse Volume alone, so one row silences every neigh. The ambience's birds, crickets and the cemetery's howl
  (`systems/ambientEffects.js`) are on neither row.
- Both rows sit in the Audio tab's Volume section after Monster Volume and Companion Idle Volume, and each scales its
  sounds under Sound Volume, as Monster Volume does. At 100% every level is DFU's. The rows share one builder
  (`enhancedMenu.js` volumeRow) and one reader (`monsterVolume.js` shelfVolume).
- The four hosts: `world.js` and `exterior.js` reach the mount and the animal flats through `mountRig.js` and
  `animalAmbience.js`, and `dungeonContext.js` its animal flats through `animalAmbience.js`. `worldModes.js` (interiors)
  plays no horse and no animal. A peer's mount and the Wagon Warden stand in `world.js` alone (`exterior.js` runs no
  town watch, `wagonWardenHost.js`).

THE AUDIT. Every sound the game plays reaches the speakers through a slider. Each door of the engine (`playOneShot`,
`play3d`, `play3dVoice`, the loops, the beds, `source()`) connects through the master that Sound Volume levels
(`_out`). The music's two players and the intro theme follow Music Volume, and a VID reads Sound Volume for each
clip of its sound.
Three sounds did not follow their slider:

1. **Sound Volume itself, while a sound played.** The master read the setting only when a NEW sound started. A slider
   moved on the Options page over a quiet world left every sound already going (the rain, the wind, a torch, the ride, a
   ship's loops) at the old level until something new played. The master now subscribes to the setting
   (`onSettingChange`) and ramps to the new level over 50 ms (`audio.js:"  _relevel() {"`), as the music's resync does.
   This is the port's own engine, not a DFU member.
2. **The Trireme's oar stroke** (Come Sail Away, `comeSailAway.js` oarEvent). The mod plays it with the rudder's plain
   `AudioSource.PlayOneShot`, which reads neither Sound Volume nor the mod's own boat volume. The host divides Sound
   Volume out of the bus for a plain source (`plainSourceGain`), so the stroke played at one level whatever either
   slider said. It now plays at Sound Volume x the mod's own, as the boat's loops do.
3. **A boat's loops.** They took Sound Volume x the mod's volume when a loop started or crossfaded, and were re-levelled
   only when the MOD's setting changed (LoadSettings' Audio arm). A change of the game's Sound Volume mid-voyage left
   them where they were. `checkSettings` now watches the product, so either slider re-levels them.

Items 2 and 3 depart from the mod: Port-Ledger section A, SOUND-LIVE.

Pins: `test/systems/volume_sliders.test.js` (8: the readers; the animal flats; my own mount with DFU's sounds and with
the port's own; a peer's; the Warden's heave; the rows; the live master), and
`test/systems/comeSailAway/csa_time_audio.test.js` (the stroke at both volumes; the loops after a Sound Volume change).
`tools/mutants/volume_sliders.json`: 15 dead.
