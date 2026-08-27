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
C# file were already home (P14, combat).

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

RESIDUE, found on the way, needs ARENA2: SUNNYDAY.HMI's durationTicks
pins at 1,199,310 - 9,994 s at the true clock - while DFU's sunnyday.mid
is 54.8 s (~6,600 ticks). One track's end tick is ~180x the music; a
mis-decoded delta somewhere in its stream, most likely around one of
the HMI-specific events. Its notes play; its LOOP would wait 2.7 hours
in silence. `tools/dumpMidi.mjs` on that one song is the way in.
