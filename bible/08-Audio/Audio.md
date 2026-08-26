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

Music: SHIPPED at A5 (2026-08-19) - the section below. MIDI.BSA has no
DFU reader (DFU renders its own pre-converted .mid files with a vendored
synth and a SoundFont from Unity Resources), so `src/formats/hmiFile.js`
was written against the shipped bytes and the voice bank is ours -
reader, scheduler and bank all on Port-Ledger A. Also owned here: animal
audio sources on flats, torch burning sounds on dungeon flats
(RDBLayout.AddTorchAudioSource) and action sounds (action.index carries
the sound id), the audio state machine, and iOS AudioContext.resume
discipline when a shell exists.

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
  seams (P6/P7) - same routing.

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
- **RESIDUAL (honest)**: the cemetery howl/bird layer
  (IsCemeteryNearby) is UNPORTED - this file carries the flag comment
  and nothing else, clips 113/14 appear nowhere in `src/` and no rect
  arms the channel (the Ledger's live F089 row); lightning FLASH sync
  (PlayLightningEffect) is off in the scene serialization, verbatim
  skip. The other three clauses this bullet carried are closed:
  doNotPlayInCastle reads a live `deps.inCastle` (AUDIT 21 music F3,
  below), the RMB exterior animal sources landed at A4, music at A5.

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

Remaining on the queue at A4: transition stingers and music - both
closed below (the stingers as verbatim N/A 2026-08-17, music at A5
2026-08-19).

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
both are ours now - the second arrived with its mechanic rather than as
dead data, which is what AUDIT 18 parked it on the Ledger to wait for:
- `PlayerDoorBash = 7` (SoundClips.cs:38, PlayerActivate.cs:510) - OURS,
  `SOUND.PlayerDoorBash` in soundClips.js. This page previously mis-numbered
  it as 28.
- `ActivateLockUnlock = 316` (SoundClips.cs:386) - OURS SINCE R1. It is
  PlayerActivate.cs:556's successful exterior lockpick and
  DaggerfallActionDoor's PickedLockSound (:41/:229/:237), and it landed
  with the Ledger's door-lockpicking C row when R1 shipped
  `actionSystem.attemptLockpicking` (2026-08-23) - that row is struck.
  `SOUND.ActivateLockUnlock` sits in `soundClips.js:10` with
  three consumers: the ActionSystem's success arm
  (`world/actionSystem.js:244`), the exterior unlock flat one-shot
  (`worldModes.js:2302`) and the dungeon door, 3D from the door's own
  matrix (`dungeonContext.js:872`).

The audio queue today is the AUDIT 26 rows routed to this arc in
Port-Ledger C, and none of them is music: F088 THE EXTERIOR AMBIENCE LOOP
FOLLOWS THE PLAYER INDOORS - which corrects the struck rain-loop row, that
row read WeatherManager.Update's "do nothing if player inside" right and
stopped one component short of WeatherAmbientEffects being a child of the
Exterior object that DisableAllParents switches off; F089 the cemetery
ambient channel, unported (A3's residual above); and two nits - F215
`AudioEngine.ensure` guarding its await with a boolean, so a concurrent
second caller resolves while `enabled` is still false, and F090 the dungeon
water footstep hysteresis collapsed to one threshold (PlayerFootsteps
enters shallow water at `(y - 0.57) < waterY` and returns to stone only at
`(y - 0.95) >= waterY`).

## A5 (2026-08-19): MUSIC PLAYS - the arc's first decision, made

Mac's call ("you lead this"): the port makes music out of the user's own
MIDI.BSA. TWO HALVES with two different standards of proof, and keeping
them apart is the point.

- **The PORTED half** - `src/systems/songManager.js` is SongManager.cs:
  the playlists verbatim, in DFU's order and with DFU's duplicates (a
  duplicate doubles that song's odds, so it is data), and
  SelectCurrentSong arm by arm - taverns index gameDays directly and so
  walk in sequence day to day, dungeons seed DFRandom with
  `unknown2 ^ (region << 8)` (`dungeonKey`), everything else seeds on
  gameDays so a location's song is stable until midnight, and a list of
  ONE returns index 0 WITHOUT consuming the generator (if it seeded,
  entering a temple would shift every later roll in the session).
- **The OURS half** - `src/formats/hmiFile.js` reads MIDI.BSA: 131
  records of HMI Sound Operating System songs, signature
  "HMI-MIDISONG061595", 480 ticks per quarter and 120 BPM in every retail
  song. The slice was commissioned as "the XMI reader" and the bytes said
  otherwise - no FORM/XDIR/CAT/XMID chunk appears anywhere in the archive
  - so the file carries the format it actually reads and the Ledger
  records the correction. `src/systems/songPlayer.js` puts that event
  stream on the WebAudio clock by LOOKAHEAD rather than per-note timers
  (setTimeout jitter is tens of milliseconds and would be audible on every
  note); `src/systems/gmSynth.js` is the voice bank. DFU renders its own
  pre-converted .mid files with a vendored AudioSynthesis synth and a
  SoundFont from Unity Resources - both DFU's assets, not the user's
  ARENA2 - so there is neither a synth to port nor an instrument set to
  read, and reader, scheduler and bank are all Ledger A departures.
- **The synth specs are TASTE and are NOT pinned as truth.** A pin saying
  "program 48 is a sawtooth" asserts my own choices back at me - the
  vacuous-pin shape two audits have caught here - so the pins assert
  STRUCTURE: every GM program resolves, out-of-range clamps rather than
  throws, no percussion key is silent, nothing can put a NaN in the audio
  graph. The sound is proven by MEASUREMENT instead:
  `tools/musicProbe.mjs` taps an AnalyserNode in a real browser,
  `tools/musicRender.mjs` renders a WAV through the same production voice
  code so a human can listen.
- **One bootstrap, one context.** Music boots from the SAME seam as sound
  (`shared.ensureAudio`) for AUDIT 18 F6's reason - a second bootstrap is
  a second thing every host must remember - and `src/systems/music.js`
  rides the EXISTING AudioContext from `systems/audio.js`: browsers cap
  how many a page may have, and two contexts have two clocks, so a song
  scheduled on one and a sound effect on the other cannot be reasoned
  about together.

### A5b (same day): the FM bank, and all four hosts

The subtractive bank was replaced with TWO-OPERATOR FM, which is the
synthesis Daggerfall was scored for - AdLib/SoundBlaster OPL2/OPL3 - and
is why the archive carries an F*/FM* arrangement of nearly every song.
Checked for a real OPL patch bank first and there is none: it lived in
HMI's sound driver, ARENA2 has no .AD/.BNK/.OPL and no driver, and the
song headers carry a device/channel map and zeros where patches would be
(read byte by byte before writing it). The ratios stay ours on the same
terms; the METHOD is period-correct rather than arbitrary, and FM subsumes
the old bank - modulation index 0 is a bare carrier. AssignPlaylist's
outdoor arms ported verbatim: night overrides weather entirely, Fog folds
with Overcast and Thunder with Rain, an unrecognised weather falls to
Sunny by DFU's OWN default. THE CORPUS PIN EARNED ITS KEEP - it caught a
NIGHT_SONGS_FM list EXTRAPOLATED from the GM shape rather than read: DFU's
FM night array has SIX entries to the GM list's seven, and there is no
10FM record in MIDI.BSA at all.

### AUDIT 19: the sixteen playlists, then SongManager's engine

The first pass carried the outdoor and dungeon lists and stopped, so
SIXTEEN of DFU's playlists and fourteen of its fifteen AssignPlaylist arms
were simply absent - castle, court, shop, Mages Guild, plain interior,
fighter trainers, palace and the FM tavern, every one resolving to a real
MIDI.BSA record, which makes it music the player could never hear rather
than a missing asset. Entering ANY building now takes its own list where
only taverns did, and leaving any interior hands the street back its song.
The 1:1 pass then ported the ENGINE the port had never had: DFU is a
MonoBehaviour that rebuilds a CONTEXT every frame - environment, weather,
time, gameDays, locationIndex, arrested - and reacts to the difference,
where the port had hosts calling playFrom at moments they chose.
`createMusicDirector` (`scenes/shared.js`) is that loop, and all four
hosts feed ONE of them: `world.js`, `exterior.js`, `dungeon.js`, and
`worldModes.musicContext()` as the overlay half that wins over the base.
Both selection inputs two earlier passes had recorded as UNAVAILABLE were
sitting in readers the port already had - the dungeon seed in the dungeon
header's unknown2, the building faction id on the building record - and
are pinned on the real archive.

### AUDIT 21 (music lane) and the audio audit (2026-08-25)

AUDIT 21 found the director had ZERO behavioural coverage - only
source-regex sweeps over the host files - and three mutations that each
silence a large part of the game left the whole suite green
(`test/audit21_music.test.js`, 13 pins, sinks injectable so the real
director can be driven). Two findings land on this page. F3: CASTLE MUSIC
was unreachable because both call sites hardcoded
`insideDungeonCastle: false` behind a flag blaming "no castle-block
detection yet", while rdbLayout had computed castleBlock verbatim on every
block all along - `castleBlockAt` answers from the block the player stands
in now (`dungeonContext.js`), and the same hardcode is what left A3's
`doNotPlayInCastle` READ by ambientEffects and WRITTEN by nobody, so the
one-shot suppression was inert too. F4: an unresolved temple forced
Interior where SongManager.cs:494-518 has NO `else` and the environment
HOLDS - walk into an unresolvable temple from a city street and the city
track keeps playing.

THE AUDIO AUDIT (2026-08-25) came from the music being reported as
sounding wrong by ear, and it was, in three ways - all of them in the BANK
rather than the data path, which is the first thing it settled: hmiFile
decodes MIDI.BSA byte-exactly and songManager carries DFU's tables
verbatim, so none of it was a parity bug against DFU. (1) THE DRUM MAP
STOPPED AT NOTE 51 while percussionSpec resolves by nearest neighbour, so
every key above it played the ride cymbal - over the real archive that is
25 of the 30 drum notes in use and 14,000+ hits, because Daggerfall's
percussion is hand drums and bells rather than a rock kit (tambourine
3,364 hits, jingle bell 2,561, congas 3,874). The map runs 35..87 now,
each key owning itself, the nearest-neighbour fallback kept for keys
outside it because a silent key is worse than an approximate one.
(2) ARTICULATION BEATS FAMILY: `program >> 3` put harp and timpani in
`strings` and rendered them BOWED - one is plucked and rings, the other is
struck and thuds - so eight programs the archive plays override their
family, and only where the family is wrong about HOW the note is made.
(3) THE SUSTAIN PEDAL was dropped entirely - 593 CC64 events, the only
ignored controller that changes what is heard. Cleared with evidence so
nobody re-chases them: zero tempo meta events across all 131 songs, CC105
is a per-track marker, no RPN sets a bend range, and pan does reach a real
StereoPanner.

M-EXT / M-FM (2026-08-25) took the player-supplied half:
`systems/musicReplacement.js` answers DFU's `TryImportSong` shape behind
DFU's own `Settings.AssetInjection` gate and `MusicService.playSong` asks
it before it reaches MIDI.BSA, and `Audio/AlternateMusic` is read where the
director is BUILT rather than at three host call sites that could each
forget it. That arc's record lives in 06-Systems/Systems-Arc.md; the
Ledger row is the AssetInjection one.

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
