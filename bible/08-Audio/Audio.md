# Audio

Sound effects: DAGGER.SND reader COMPLETE (`src/formats/sndFile.js`, 459
sounds, byte-exact RIFF headers) - see Readers-Arc. No runtime playback yet.

Music: HMI/XMI in MIDI.BSA has NO DFU reader (Unity synthesizes music); the
playback strategy is this arc's first decision (approved routing, see
Port-Ledger A). Also owned here: animal audio sources on flats, torch burning
sounds on dungeon flats (RDBLayout.AddTorchAudioSource) and action sounds
(action.index carries the sound id), the audio state machine, and iOS
AudioContext.resume discipline when a shell exists.
