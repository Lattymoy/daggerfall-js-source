# Enhanced Music Arc - the port's own score, behind the enhanced toggle

**Mac's call (2026-08-27):** "for the enhanced version I'd like to put my
own twists on things - implementing a procedural music system in
addition to my own custom tracks." Decided the same conversation: the
tracks are FULL PIECES, his, crossfaded, with the generative layer
underneath; they ship in the repo (they are his); the whole thing is
switched by the ENHANCED SKIN TOGGLE and nothing else. The first place
to score was left to Fable: the dungeon, because Privateer's Hold is
the first thing every game is heard in, because its danger dynamics are
the richest, and because DFU's own dungeon-song law already seeds on
the dungeon's key, which is exactly the seed a composed piece wants.

## Where it sits

This is OURS. Daggerfall has no generative music and DFU has nothing to
translate, which is the whole reason it lives behind the enhanced gate
and touches the classic path by construction not at all: under the
classic skin the door returns null and the director does what it did
before this arc existed. The Port-Ledger's departure rules do not
apply - nothing is being ported - and the pins are about STRUCTURE and
LAW, never taste: a piece is deterministic, in its mode, in its
registers, in the scheduler's own event shape. What it sounds like is
Mac's ear and the palette record, which is the tuning surface.

The lesson carried from project-final's stem arc (built end to end,
reverted twice - "audio was better before", then "rip it out"): the
FAILURES there were specific. Source-separated stems (coupled,
artifacted layers), whole stems decoded to PCM at boot (240-509 MB, a
six-second freeze), and a mix driven by per-frame threat jitter that
fluttered and threw inside the audio graph. What survived is worth
keeping and will be: the pure director, persistent voices that resume
on their own timeline, the change-guarded mix with its AudioParam
lesson, the SFX sidechain duck, the lab as a tuning surface. So here:
ONE brain (DFU's SongManager, deciding the cue from slow, meaningful
state), full tracks streamed rather than decoded, dynamics from slow
scalars smoothed rather than a frame-rate number, and a generative
layer that is a new axis rather than a rebuilt old one.

## The shape

- **ONE BRAIN, TWO ANSWERS.** SongManager (verbatim) decides the cue -
  environment, weather, night, the day, the location, the dungeon -
  and when it changes. The director's `play` sink asks the enhanced
  side first (`enhancedMusic/index.js: enhancedScore(context)`); a
  null answer means the classic song plays as it always has. The
  manager grew one getter, `currentContext`, so the sink can see what
  it is answering for.
- **RECORDS, NOT MODULES.** `enhancedMusic/palettes.js` (MUSIC_PALETTES) holds one
  record per place, keyed by the director's own MUSIC_ENV names: tempo
  range, weighted modes, a root window, the form, bars per chord, the
  progressions per mode, and four layers (channel, GM program,
  register, velocity, volume, pan, and each layer's own knobs). The
  composer knows no place by name - pinned - so a new place is a new
  record, never a new branch.
- **THE SCHEDULER'S OWN SHAPE.** The composer emits `{ events,
  secondsPerTick, durationTicks }` exactly as the HMI reader does, on
  the HMI clock (sixty ticks a quarter, one tick 1/BPM), so a piece
  plays through SongPlayer and the FM bank with no second audio path,
  and `sustainIntervals` / `eventsInWindow` take it as they take an
  archive song. `MusicService.playScore(song)` is the one new door on
  the service, pending like `playSong` when the page has no context
  yet, and it does NOT consult MIDI.BSA - a composed piece needs no
  archive.
- **THE SEED IS DFU'S.** A dungeon composes on its own key - the header
  field SongManager.cs:353-356 seeds its song with - so a dungeon keeps
  its piece across visits and days; everywhere else composes on the
  place and the day (:367-371, the daily song). Same seed, same piece,
  note for note.

## EM1 (2026-08-27): THE DUNGEON PALETTE, THE COMPOSER, THE DOOR - SHIPPED

The piece: sections of eight bars in the palette's form (A A B A2 for
the dungeon: 32 bars, 132 s at 58 bpm), each section a progression from
the mode's table at two bars a chord, and four layers written against
the chords - the BED (a warm pad, the chord voice-led from the last
one and held for its bars), the BASS (the chord root on every downbeat
for three beats, mostly resting after, a fifth or the octave on beat
four now and then), the MOTIF (a seeded cell of four to six notes,
mostly steps with one leap, spoken over the odd chords of A, inverted
and lifted an octave in B, and given a two-note tail home to the root
in A2 - and SILENT on the even chords, because in a dungeon the
silence is a layer), and the COLOR (one bell on the tonic at the turn
of B and of the last section). Modes weighted phrygian and aeolian over
locrian and harmonic minor; the tonic sits in E2..B2; 52-64 bpm.

Found on the way: the bass's "octave on beat four" clamped to the
register's top edge, which is a pitch outside the mode - caught by the
first 200-seed sweep (8 notes off), fixed as "the octave only when the
register has room, else the root". Levels: the first render was eight
times quieter than the archive songs (peak 0.033); velocities lifted
across the record to peak 0.095 / rms 0.020 - still sparse by design,
and Mac tunes from there.

Verified by RENDER, not by "nothing threw": `tools/enhancedMusicRender.mjs`
composes a place and a seed and renders it offline through the real
production voice code, the way A5's render tool renders an archive
song, and writes a WAV a human can play; the spectrogram of Privateer's
Hold's piece shows the form (the bed under everything, the bass every
bar, the motif in alternate eight-second blocks and silence between).
Pins: `test/enhancedMusic.test.js`, 7 tests - the theory (seeded PRNG,
modes, triads, voice leading), the palette as a record, determinism and
a pinned key/tempo, a 200-seed sweep for the scheduler's shape and the
musical law (every note in the mode and in its layer's register, the
bass on every downbeat, one voicing per chord, the motif resting, the
bell on the tonic), the door under both skins and the seed law, the
director's sink with the manager's context, and the service's new
door. 4 mutants, 4 dead.

## EM2a (2026-08-27): THE TITLE THEME - Mac's first track, on the door - SHIPPED

Mac: "This is the main theme that should play on startup." A 2:50 WAV
(48 kHz stereo, peak 0.72), encoded to MP3 at VBR ~155 kbps (3.3 MB)
because MP3 is the one format every browser on the site's list plays -
iOS Safari does not play Ogg Vorbis - and shipped at
public/music/enhanced/main-theme.mp3 with an OURS row on the doctrine
allow-list: his composition, nothing of the game's in it.

THE PLAYER STREAMS. `enhancedMusic/trackPlayer.js` is an <audio>
element through a MediaElementSource into a gain node into the music
bus: project-final's stem arc decoded every track to PCM at boot and
paid 240-509 MB and a six-second freeze for it, and a three-minute
theme decoded is 60 MB of float a phone does not need to hold. Fades
ride the gain node's AudioParam (setValueAtTime + linearRamp), never
the element's volume and never a curve that can throw over itself.
`MusicService.playTrack(record)` is the door on the service: it needs a
CLOCK and nothing else - `audio.ensureClock()`, new, is ensure()'s two
archive-free halves (the context, the gesture resume) made idempotent -
so the enhanced front door can ask before any folder pick exists. The
browser's gesture rule may refuse the first play; then the request is
PENDED and the service's gesture hook (which now knows a name from a
song from a track) replays it on the first pointer or key. THE ONE
RULE FOR THE OTHER DOORS: when the game's own music takes over - a
composed piece, an archive song, a replacement - the track is FADED
UNDER over three seconds, never cut; `stop()` stops it too; a sounding
track counts as `playing` for the director.

THE WIRING is one line in main.js's enhanced branch, un-awaited, before
`runEnhancedMenu()` - the "title moment" the boot's own note had named
as its own slice. So the theme plays on the door, carries through the
folder pick and the wizard, and fades as Privateer's Hold's piece
begins.

FOUND ON THE WAY: eleven probes opened /play/ with `waitUntil:
'networkidle'`, and a page with a streaming media element never lets
the network idle - Chromium holds the media request open - so every one
of them hung at goto. They wait for `load` now (module scripts delay
the load event; each probe then waits for its own selector as it
always did). The wait was the wrong one all along; the theme was only
the first thing that made it matter.

Proof: tools/enhancedMenuProbe.mjs, launched without the gesture rule
as the render tools are, reads the track through the service after the
first click - mounted on Mac's file, playing, looped, the service's
current, and SIGNAL MEASURED on the track's own bus through an
AnalyserNode (peak 0.055) - on desktop and Pixel 5: 22/22. Pins: three
more in test/enhancedMusic.test.js (the score record tracked,
allow-listed and reachable from /play/; the player through a fake
context - one media source, the ramped gain, the fade as a ramp to
zero, the refused play left armed; the service needing a clock and no
archive, every other door fading the track under, main.js asking
before the menu).

## EM2b (2026-08-27): THE LEVEL, AND THE SETTING THAT MOVES IT - SHIPPED

Mac, on the menu: "the menu music is too low with audio and needs to
work with the settings option." Two roots.

THE TRIM. The track player took `musicGain()` - MUSIC_GAIN (0.22) times
the setting - which exists because the FM bank's raw oscillators sum
hot and the classic songs are mixed under it. A MASTERED track has its
own headroom (the theme peaks at 0.72), and under the trim it played at
a ninth of itself: 0.22 x the 0.5 default. `trackGain()` is the setting
alone, times the record's own gain; the synth keeps its trim. Measured
on the door's bus: peak 0.055 before, 0.251 after, at the same setting.
(M-EXT's replacement player, the user's own music packs, still takes
the trimmed law - deliberately shared at the time; the same argument
applies to it and it is Mac's call.)

THE SETTING. `Controls/MusicVolume` was LIVE in the registry's tier and
read once per player - at `_ensureMaster` - and never again, so a theme
that loops for the whole session had no next occasion to hear the
slider. `settings.setValue` now PUBLISHES every write (`onSettingChange`,
a small subscriber set: the section, the key, the string as stored;
a throwing listener is warned and skipped so a bad listener cannot
fail a write), and MusicService subscribes: on MusicVolume it re-levels
all three of its players - the scheduler, the replacement player and
the track - each with a 50 ms ramp on its master so a slider drag is
not a zipper. Every writer already goes through setValue (the enhanced
pane, the classic settings window, the pause window), so nothing else
had to learn the door; any other LIVE consumer can take it instead of
polling. Proof: the door probe writes 0.5, 1 and 0.1 through setValue
and reads the track's gain node at 0.5, 1 and 0.1 - live, untrimmed -
on desktop and Pixel 5, 24/24. Pins: three more in enhancedMusic.test.js
(the level law and where the service builds on it; the publish - once,
the default's string on a drop, unsubscribe, a throwing listener
skipped, and the service re-levelling exactly its three players on
exactly that key; each player's resyncGain ramping its master to the
setting now).

## EM2c (2026-08-27): THE DUNGEON TRACK, THE UNDERSCORE, THE CROSSFADE - SHIPPED

Mac: "Fix it also. Here is also the new dungeon track. I have the
danger and death tracks to follow."

FIX IT ALSO: the M-EXT replacement player - the user's own music packs
- took the FM trim too, a mastered file at a fifth of itself (0.22 x
the default 0.5 = 0.11). It reads `trackGain()` now, the setting alone,
beside the scheduler's `musicGain()`; one setting still moves both
through the service's resync. The header that had recorded the shared
law records the split.

THE TRACK: 3:09, 48 kHz, peak 0.64; MP3 at VBR ~155 kbps (3.7 MB) at
public/music/enhanced/dungeon.mp3, OURS. It is the first PLACE_SCORES
record, and it carries a KEY: measured off the file's pitch-class
energy (B 1.00, F# 0.42, D 0.32, C# 0.28, E 0.24 - a B minor triad with
the aeolian second), root 47 (B2), aeolian, and MAC'S TO CONFIRM; no
tempo named, so the piece keeps the palette's own.

THE UNDERSCORE: `enhancedScore` answers `{ track, song }` now. A place
with a score and a palette gets both, and the piece is composed IN THE
TRACK'S KEY (the record's root and mode, and its tempo when named); a
record that names no key plays alone rather than clash. The service's
`playEnhanced` plays the track, then the piece UNDER it at
UNDERSCORE_TRIM (0.35) on the scheduler's new master trim - felt more
than heard: -19 dB under the track at the default setting, measured on
the offline mix - and a piece alone plays at full trim through
playScore's own door, which fades any track under. The dungeon seed law
holds under a track: the same dungeon, the same piece, in B.

THE CROSSFADE: the track player grew a LAYER gain per play under ONE
master. A new track fades in over three seconds while the old layer
fades out on its own timer and is then paused and released; the master
carries the setting alone, so re-levelling never fights a fade. Fades
ride AudioParams, never the element's volume.

Heard: dungeon-with-underscore.wav, the track at the default setting
with the B-aeolian piece under it at the trim, rendered offline through
the real voice code - the balance is Mac's to move (UNDERSCORE_TRIM is
one number). Pins: three more (the door composing in the track's key
with every underscore note in it and the seed law under a track; the
service - track then trimmed piece, idempotent, the piece never fading
the track it sits under, a piece alone fading the track and playing at
full trim, a track alone stopping the scheduler; the crossfade - the
old layer to 0 and still playing, the new to its record gain, the
master untouched, the old element paused when its timer fires). The
replacement pin re-aimed at the split. 4 mutants, 4 dead.

TO FOLLOW: the danger and death tracks. `EXTRA_SCORES` is their home -
cues beyond DFU's, the enhanced side's own - and their doors are EM4
(danger from the enemy-senses law, crossfading the dungeon track into
its danger variant and back) and the death screen.

## EM4 (2026-08-27): DANGER - SHIPPED

Mac: "This is danger." 2:43, MP3 (3.5 MB) at
public/music/enhanced/danger.mp3, OURS; key measured off the file
(C 1.00, G 0.72, D 0.45, D# 0.45, F 0.25, G# 0.21 - C minor), a
semitone off the dungeon track's B, which decides one thing below.
Mac's to confirm.

THE SIGNAL IS DFU'S. "An enemy that can see the player" is
AreEnemiesNearby's own line - `detected && inSight` on the foe's AI,
the law that refuses a rest (encounters.areEnemiesNearby) - and
`dangerRaw` reads exactly those fields off exactly those records: every
living foe that can see you counts, nearer counting more (a distant
watcher a quarter, two in your face saturate). A foe that has only
HEARD you does not count, as it does not for the rest law.

THE METER IS OURS, and it is project-final's lesson made structural:
that arc drove its mix from a per-frame threat number and the music
fluttered. `DangerMeter` is a slew - it rises fast (0.35 s to most of
a step: a foe seeing you is news), HOLDS six seconds after the raw
signal drops (a foe behind a pillar does not end the fight), then falls
slowly (5 s), and the decision has hysteresis (on at 0.5, off at 0.15).
Pinned: seen for 0.3 s is ON; a two-second blink does not flip; the
fight's end is OFF well after the last sighting; a 50/50 flicker around
the threshold flips at most once.

THE DOOR is on the service: `reportDanger(dt, foes)` from the hosts,
inert unless the enhanced side is scoring the place (there is nothing
to return to otherwise - the classic skin never crossfades). When the
meter switches ON, the place's track CROSSFADES into the danger track
and the composed underscore - written in the PLACE's key, not
danger's - fades to silence under it rather than play a semitone
wrong; OFF crossfades the place's own track back and lifts the
underscore to its trim. A place that composes alone gets the danger
track over its piece and the piece back alone after. A NEW CUE RESETS
the meter and the flag: whatever danger the last place was in does not
follow the player through a door.

THE HOSTS report from the frame functions they already share: the
dungeon context's drawFoes (both dungeon hosts call it - the splash
clock's reasoning), and the exterior host's foe tick, over both of its
pools, the watch and the encounter foes, exactly as it asks
areEnemiesNearby. Pins: three (the raw law against the rest law's own
answers; the meter's temper; the service's door - ON, OFF, the reset,
the alone-piece arm - and both hosts' reports). 3 mutants, 3 dead.

TO FOLLOW: death. `EXTRA_SCORES.death` when the track lands, its door
the death screen.

## The board

1. **EM2 - MAC'S TRACKS FOR THE PLACES.** The machinery is whole
   (EM2a-c): a record per place with the track's key, the piece under
   it, the crossfade. What remains is the records, one per track as it
   arrives, each with an OURS row - and the danger and death cues in
   EXTRA_SCORES with their doors (EM4, the death screen).
2. **EM3 - THE OTHER PLACES.** Palettes for the city by day and by
   night, wilderness with the weather folded in as the director folds
   it, taverns (the one place that wants percussion), temples, the
   Mages Guild. Each is a record; the composer stays as it is.
3. **EM4 - DYNAMICS.** Danger SHIPPED as a track crossfade on the
   rest law's own signal through a slew (above). Health, and the finer
   per-layer dynamics of the composed piece (the motif thinning, the
   bed darkening), remain.
4. **EM5 - THE LAB.** A page that composes a palette live, with every
   record field as a control and a render button - the tuning surface,
   for Mac's ear.
