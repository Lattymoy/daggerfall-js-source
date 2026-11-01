# Audio

Audio is everything the player hears: Daggerfall's own sound effects from DAGGER.SND, its music from MIDI.BSA played by
our own synthesiser, the ambience of towns, dungeons, wind, sea and wild, footsteps, horses, and the volume sliders that
control them. The data path follows DFU's call sites, clip indices and volumes; the engine that plays them is our own
WebAudio code.

## How it works

### The engine (`src/systems/audio.js`)

- `src/formats/sndFile.js` reads DAGGER.SND (459 sounds). Records decode lazily from 8-bit unsigned PCM
  (`pcm8ToFloat32`) and cache by index. `src/systems/soundClips.js` carries the SoundClips DFU uses, indices verbatim,
  with DFU's swing-pitch and hit-sound families.
- `AudioEngine` plays one-shots, positional sounds (HRTF `PannerNode`s with the camera as listener) and loops. The
  context starts suspended and resumes on the first pointer, key or touch; until then every play is a silent no-op.
- **Handedness.** The scene is DFU's left-handed frame and WebAudio is right-handed, so every listener and source
  position is turned once at the audio door (`audioFrame`, negating z). Callers speak scene coordinates.
- **Voice cap.** One-shots take one of `REAL_VOICES` (32). At the bound a positional shot plays only if it reaches the
  ear at least as loud as the quietest sounding one, which fades out over `VOICE_FADE_S`; a flat shot always plays. Every
  finished chain is let go (`releaseNodes`). Loops and beds are not counted.
- **Limiter.** Every bus reaches the speakers through one stage (`_limiter`): a compressor as a limiter (`LIMITER`, -3 dB,
  20:1), a trim that cancels its make-up gain, and a soft ceiling (`limitAmplitude`) so nothing passes 0.98. Everything
  under -3 dBFS plays exactly as before.

### Sound sources

- **Actions:** an RDB action plays its sound on every Play, from the mover's live position.
- **Torches and animals:** dungeon torch flats burn audibly; town animal flats (dogs, cats, pigs, cows) bark and call
  (`src/systems/animalAmbience.js`).
- **Scene ambience:** DFU's `AmbientEffectsPlayer` presets (dungeon drips and moans, bird calls by day, crickets at night,
  rain and thunder) are ported in `src/systems/ambientEffects.js` (`presetForExterior`).
- **Footsteps:** DFU's player footsteps by ground; Immersive Footsteps' surfaces (`src/systems/immersiveFootsteps.js`).
- **Foes:** DFU's EnemySounds attract loop and attack sounds, at the monster volume (`src/systems/monsterVolume.js`).
- **Better Ambience** (`src/systems/betterAmbience.js`): the mod's ambient layers, including rain through the walls.
- **The mods' clips are our own** (OWN-WORK, the owner): Better Ambience's, Immersive Footsteps', Windfall's and Come
  Sail Away's are made at runtime by our seeded synth (`src/audio/synth/`, `src/systems/windfall/windfallSynth.js`,
  `src/systems/comeSailAway/csaSynth/`), at each clip's name, length and rate. Each is set by its loudness
  (`src/audio/synth/dsp.js` `loudnessOf`) against Daggerfall's own sounds. A long bed is layered loops of different
  lengths (`src/audio/layeredLoop.js`), so it comes round only after hours.

### Music (`src/systems/music.js`, `src/systems/song/`)

- MIDI.BSA's HMI songs are decoded byte-exactly (`src/formats/hmiFile.js`; the HMI tick is 1/BPM of a second, sixty to
  the quarter) and scheduled on the WebAudio clock with a lookahead (`src/systems/song/songPlayer.js`).
- DFU renders its pre-converted MIDI with a vendored synth and SoundFont that are DFU's own assets, so the sound is ours:
  a synthesised voice bank (`src/systems/gmSynth.js`), with two-operator FM voices, the synthesis the game's songs were
  arranged for. `src/systems/song/songManager.js` carries DFU's playlists verbatim, FM lists included; the sandstorm
  plays DFU's default arm and the ashfall plays overcast's songs.
- A music replacement pack plays at its own level on the Music slider.
- Songs we make in code (the Warden's score, the Hour's, the arena's, the sea's) are registered by name, play on the
  same player and bank, and can be replaced by a pack. At a helm the sea's six songs play
  (`src/systems/soundscape/seaScore.js`); DFU's playlists know no ship.
- **MIDI out.** Settings, Audio, Music has a **MIDI out** row (`midiOut`): it asks the browser for MIDI only on the
  first click, then steps through connected devices and Off. Safari has no Web MIDI and the row says so.

### Enhanced sounds (`src/systems/enhancedSounds.js`)

Our own sounds on the enhanced skin, laid over DFU's ambience, never instead of it:

- **Wind** (`src/systems/wind/windAudio.js`): a bed made in code that rises and falls with the wind's strength and goes
  quiet indoors, not DFU's dungeon moan clips on a loop.
- **Soundscape** (`src/systems/soundscape/`): the sea under a deck with its bells and the shore's surf (`seaAir.js`),
  the wild by region and hour and a town's street, smithies and taverns (`worldAir.js`, `townBeds.js`), beds made in
  code (`soundBeds.js`, `bedDsp.js`) with CC0 recordings for animals and gulls.
- **Horse voice** (`src/systems/horse/horseVoice.js`): on DFU's own clock, each voice says the horse's mood (a whinny on
  mounting, an alarm snort with foes about, breath after a long gallop), and hooves change with the ground.
- A coin clink in the enhanced inventory, hands and boots when climbing, the tools when gathering, and another player's
  gathering heard at their act.

## Rules

- The data path stays 1:1 with DFU (indices, per-weapon and per-enemy clip choice, volumes); the WebAudio engine is an
  approved departure.
- One `AudioContext` for sound and music, so both run on one clock.
- A music switch fades: the old song fades out over `MUSIC_FADE_OUT_S` (1.5 s), then the next fades in over
  `MUSIC_FADE_IN_S` (1 s), one at a time (the owner). DFU cuts mid-note.
- Every sound is on a slider: Sound, Music, Monster (`monsterVolume`), Horse (`horseVolume`) and Animal
  (`animalVolume`), each 0 to 100%, applied live to sounds already playing.
- The soundscape uses recordings for what a synthesiser does badly and code for the rest (the owner).
- **Enhanced sounds** (`soundEnhancements`) is on by default, takes effect at once and is the player's own online.

## Daggerfall Unity

DFU plays SoundClips through Unity `AudioSource`s and renders music with a vendored synth and SoundFont. Departures,
each in the ledger: the WebAudio engine; synthesised music; music fades on a switch; the voice cap (DFU's 32 real voices
from Unity's `AudioManager`, but a shot with no voice never starts where Unity virtualises it); the limiter; MIDI out;
and the enhanced sounds above. DFU plays nothing on building and dungeon transitions, so there is nothing to port there.

## Code and tests

- `src/formats/sndFile.js`, `src/formats/hmiFile.js` - the two archives
- `src/systems/audio.js` - `AudioEngine`, `REAL_VOICES`, `LIMITER`, `audioFrame`, `releaseNodes`
- `src/systems/soundClips.js`, `src/systems/ambientEffects.js` - DFU's clips and presets
- `src/systems/music.js`, `src/systems/song/songPlayer.js`, `src/systems/song/songManager.js`, `src/systems/gmSynth.js`
- `src/systems/enhancedSounds.js`, `src/systems/wind/windAudio.js`, `src/systems/soundscape/`,
  `src/systems/horse/horseVoice.js`
- `src/systems/monsterVolume.js`, `src/systems/animalVolume.js` - the extra sliders
- `src/audio/synth/`, `src/audio/layeredLoop.js` - our clips and the layered loop; `test/audio/synth/ownsounds.test.js`
- `test/systems/audio.test.js`, `test/systems/audio3d.test.js`, `test/systems/music.test.js`,
  `test/systems/gatemix_limiter.test.js`, `test/systems/volume_sliders.test.js`, `test/systems/midiout1.test.js`,
  `test/systems/soundscape/soundbeds.test.js`, `test/systems/horse/horsevoice.test.js`,
  `test/scenes/soundscapehost.test.js`
