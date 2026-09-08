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

Pins: `test/musicvolume.test.js`, 4 tests - the publish (once, the
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
`test/audit26_audio.test.js`. Mutant: `+ 0.9` restored in one host; 1
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

Pins: `test/audit64_audio.test.js` (the three senders and the two
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
accessors in `systems/songPlayer.js` and both read it;
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

Pins: `test/audit64_audio.test.js` - the reference's five raise sites and
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

Pins: `test/audit64_audio.test.js` - the reference's ordering, then a
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

Pins: `test/audit64_audio.test.js` - the three sounded reference lines,
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

Pins: `test/audit64_audio.test.js` - the two reference lines and
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

Pins: `test/audit64_audio.test.js` - the reference's own write census
(`lastPosition` assigned at 89, 245, 270 and at no line of the three
early returns), then a six-stride ride whose dismount frame plays, a
fall into water whose first swimming frame plays with `lostGrounding`
still up, and a standing-still frame that leaves the anchor where it was
while `rebase()` still re-seeds.
