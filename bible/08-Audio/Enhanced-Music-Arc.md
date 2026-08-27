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

## THE PIVOT (2026-08-27): THE PLACES COMPOSE - EM2c/EM4's tracks retired

Mac: "So one thing I was hoping we could do for the dungeon tracks ...
really hone in on the stem system instead of just using full tracks.
The tracks themselves from beginning to end are just one long song
which isn't what I'm going for." And then, asked where stems would
come from: "let's forget this entirely and completely focus on the
procedural audio system."

Recorded as his: the imported-track direction for the PLACES is
retired. dungeon.mp3 and danger.mp3 are out of the repo and off the
allow-list; PLACE_SCORES and EXTRA_SCORES are empty BY DECISION, not by
absence; the record shape, the streamed player and the crossfade stay
for the one track that is a song and should be - the door's theme -
and for any day a place scores one again (the key-following mechanism
is pinned, unused). The diagnosis was right and the stem idea was
right: a place wants a STATE, not a story - the same piece present the
whole time with more or less of it audible. The place to build that,
without stems that would have had to be separated from finished mixes
(the thing project-final built and ripped out), is the composer, whose
layers are separate parts by construction. So:

## EM4b (2026-08-27): DANGER AS LAYERS - the stem system over composed material - SHIPPED

THE TENSION LAYERS. The dungeon palette grew two: TENSION - a low pulse
(timpani) on one and three of every bar with a pickup on the and-of-
four every other bar, and a sustained dissonant pair in the strings,
the chord's second against its root, held for the chord - and DRIVE, an
eighth-note ostinato on the root and fifth in a synth bass. Both are
COMPOSED for the whole loop on the grid the piece was written on, in
the mode, in their registers (the 200-seed sweep now proves the pulse
on one and three of every bar and eighths the whole loop), and both
are SILENT AT REST: their mix floor is zero.

THE MIX LAW is data on the palette (`layers.<name>.mix = { floor, full,
from, to }`) and one pure function, `layerMix(palette, level)`: a
layer sits at `floor` at or below `from`, at `full` at or above `to`,
and eases (smoothstep) between; a layer without a record is always 1.
Today: tension 0->1 over 0.2..0.7, drive 0->1 over 0.5..1 (it waits for
real danger), the motif 1->0.3 over 0.3..0.8 (it THINS), the bed
1->0.75 (it darkens), bass and bell untouched. Monotone in the level,
pinned.

THE MIX DOOR is the scheduler's: a MIX gain per channel between the
song's own CC7 volume and the master, owned by the runtime - the song
never touches it and it never touches CC7 - with `setLayerMix(mix)`
ramping each channel over 0.3 s and CHANGE-GUARDED: a channel whose
target moved under 0.005 schedules nothing, so the per-frame report
costs nothing while nothing moves (project-final's overlapping-curve
freeze, avoided by construction). `resetLayerMix` puts every layer
back to 1 on a new place.

THE DRIVER is the meter from EM4, unchanged: `reportDanger` now hands
the meter's continuous, slewed LEVEL to the law and the law's gains to
the door, every frame - so a foe seeing you brings the strings up over
a few hundred milliseconds, two in your face bring the drive, a foe
behind a pillar changes nothing for six seconds, and the fight's end
is a slow fall back to the bed and the motif, on the beat the piece
was always on. No crossfade, no second song, no sync, no memory: it is
the synth, mixed.

HEARD: dungeon-calm-danger-calm.wav - Privateer's Hold's piece, 90 s,
with a danger episode from 25 s to 55 s driven through the REAL meter
(stepped at 30 Hz), the real law and the real mix door on the offline
clock; the spectrogram shows the eighths and the sustained pair come
in at the first mark and go out, on the meter's fall, a beat after the
second. Pins: 21 in enhancedMusic.test.js now - the sweep for the
tension grid; the law (rest floors, top fulls, monotone, the drive
waiting); the scheduler's door (a ramp per channel, the change guard
scheduling nothing under epsilon, the reset); the service turning the
level into the mix, inert without a composed place, at rest on a new
one, the paired strings riding the tension mix. The retired pins are
gone with the tracks.

## The board

The focus is the procedural system - all of it.

1. **EM3 - THE OTHER PLACES.** A palette record for each of the
   director's environments: the city by day and by night, wilderness
   with the weather folded in as the director folds it, taverns (the
   one place that wants percussion at rest), shops, temples, the Mages
   Guild, castles and palaces, graveyards and dungeon exteriors, the
   court. Each with its own layers and mix law; the composer stays as
   it is unless a palette needs a device it lacks.
2. **EM5 - THE LAB.** A page that composes a palette live, with every
   record field as a control, the danger level on a slider, and a
   render button - Mac's tuning surface, the one thing from
   project-final's arc worth carrying whole.
3. **EM6 - THE COMPOSER'S CRAFT.** Counter-melody, ornaments, a second
   form, harmonic rhythm that breathes, a percussion vocabulary for the
   places that want it, and the danger law reaching the composition
   itself (a motif variant under danger, not only a thinning).
4. **EM7 - HEALTH AND THE REST.** The second slow scalar (health) into
   the mix law; day into night as a crossfade of palettes; the pause
   and the death screen.
