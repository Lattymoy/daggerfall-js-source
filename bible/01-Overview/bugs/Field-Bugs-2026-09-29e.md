# FIELD BUGS 2026-09-29 (e) - the wind that moaned (FIELD-WIND1)

(Written as page (d); main's own 29d page - BOOK-SPLIT, WW-LID, MERC-RISE, TO-ROADS, AC-COMPARE and MAP-KEY - took the
name first, so this one is (e).)

One report, through Mac, from the Discord: *"A repetitive moaning sound in the open world"* - a sound that had been
there a while, not one the day's merges brought.

## FIELD-WIND1: the wind was a two-second moan, over and over

**Found first, live.** A headless Chromium over the real game and the retail data (the enhanced skin, every switch
at its default, the page's autoplay allowed), standing outdoors at Daggerfall (207, 213): every clip the audio engine
started was traced for two minutes. One stood out - AmbientWindMoan, DAGGER.SND record 65: 45 starts in 120 s, the
gap never under 1.97 s (the clip's own length at the loop's pitch), every one of them through one named loop,
`wind`. Nothing else in the open world repeats at anything like that rate; DFU's own ambient one-shots wait 5 to 25 s
outdoors (`EXTERIOR_AMBIENT_WAITS`).

**Why.** WIND3 (2026-09-14, Mac: "wind audio without being too loud or overbearing") gave the port's wind a voice:
one loop whose gain follows the wind's strength and breathes with its gust (`systems/wind/windAudio.js`). It played
DAGGER.SND's own wind clips - AmbientWindMoan under 0.62 of the strength, AmbientWindBlow1 above - on the riding
loop's shape (`audio.setLoop`: a non-looping source started again from its beginning each time it ends;
TransportManager's `if (!isPlaying) Play()`, which is right for a hoofbeat). Those clips are DFU's dungeon ONE-SHOTS
(AmbientEffectsPlayer plays one every 5 to 28 s, `DUNGEON_AMBIENT_WAITS`) - short, shaped and pitched. Measured on
the retail DAGGER.SND, with the bed that replaces them:

| | length | a voice in it? (the autocorrelation's peak over the lags of a 60-600 Hz pitch, per 0.2 s) | its level (RMS per 0.25 s) |
|---|---|---|---|
| AmbientWindMoan (65) | 1.96 s | 0.53 to 0.78 - a pitch wandering from 100 to 613 Hz | 0.01, rising to 0.05, falling to 0.02 |
| AmbientWindBlow1 (70) | 5.02 s | 0.39 to 0.88 - most of it at 550 to 613 Hz, a whistle | 0.00, rising to 0.03, falling to 0.01 |
| the bed (FIELD-WIND1) | 8 s, looped | 0.06 to 0.13 - none | 0.033 to 0.037, steady |

A voice that swells from nothing and falls back, started again the moment it ends, is a moan every 1.97 s - and
under every breeze, since a sunny day's wind (about 0.35) never reaches the blow. WIND3 was written with no ARENA2
to hear it (its record, `07-Rendering/Rendering.md` WIND3, says so), and its tests pinned which clip played, not what
it sounded like.

**The fix.** Daggerfall has no continuous wind to loop, so the port makes one. `systems/wind/windAudio.js`
`windBedSamples`: eight seconds at 22050 Hz of seeded white noise (mulberry32 - the same bed every boot) under a
band-pass (500 Hz, Q 0.6) and a low-pass (1.8 kHz) - a soft whoosh with no hiss. The noise runs through the two
filters twice and the second pass is kept, so the bed is the filters' periodic answer to it and its last sample runs
into its first as any sample into the next: the engine's native loop has no seam. It is levelled to
AmbientWindMoan's own RMS (0.0349), so WIND3's gain law - the smoothstep of the strength, the gust's fifth, the slew,
the 0.18 ceiling, the floor - means what it meant, and stands untouched. Two doors on the engine (`systems/audio.js`):
`registerSamples(key, samples, rate)`, a buffer the port MAKES, under a string key, as `registerSound` registers a
decoded WAV; and `setPitch` on `loop`'s handle, beside WX2's `setVolume`. The driver (`createWindAudio`) registers
the bed when the wind is wanted, starts ONE native loop at the slewed gain, sets its gain and pitch live each frame,
and stops it on the floor and on every modal frame, as before. The gusts are the gain's; nothing in the bed swells or
repeats. The bed is made once a page, the first time the wind blows (a few tens of milliseconds), and kept: 690 KB of
floats, and the engine's buffer of them.

**Seen live**, one probe over the base (a worktree of main) and over the fix, side by side: every
AudioBufferSourceNode the page started, from boot, standing at Daggerfall (207, 213) in the exterior, 90 s after the
intro's window was put away.

| | the base | the fix |
|---|---|---|
| the wind at the mark | the riding loop `wind` | the bed registered, no `wind` riding loop |
| AmbientWindMoan (1.965 s at 11025 Hz) started in the 90 s | 20 times, the gap never under 1.97 s | never |
| the wind's sources since boot | a new one at every replay | ONE - the bed, 8 s at 22050 Hz, `loop` true, still playing, its pitch 0.993 (the wind's strength 0.45) |

The riding loop re-arms on the page's `onended`, on the main thread, and two headless worlds on one machine ran it
late - hence 20 starts in 90 s (a mean gap of 5.5 s) where the first probe, alone, had 45 in 120 s. The shortest gap
is the clip's own length either way: at a player's frame rate, the moan came back every 1.97 s.

**Not changed, and why.**
- The riding loop (`setLoop`) is untouched: the clop and the cart are made to be replayed, and DFU replays them.
- The five wind clips keep their names and their DFU use, the dungeon's one-shots (`AMBIENT_SOUNDS.dungeon`).
- The Deadlands' air (`scenes/deadlandsAir.js`, WB6b) plays AmbientWindMoanDeep on the riding loop's shape too - a
  3.21 s moan at pitch 0.74, one every 4.3 s under its breathing gain - but only inside the Burning Court, and a moan
  is its design ("the deep moan of the wind over the fire"). It is not the open world; left as it is, and named for
  Mac below. The gate's veil plays the same clip once, as it closes.
- The gain law, its ceiling and the pitch law are WIND3's, unchanged; so are the row, the pref and the kill door.

## For Mac

- **The deploy.** A client change (`src/`): the site on the push to main, the desktop app with its next release. The
  relay and the account service are untouched.
- **The level.** The bed stands at the moan's RMS, so a breeze sounds at the level the moan played. Above 0.62 the old
  loop had swapped to the blow, a quieter clip (RMS 0.0199), so a gale is now 4.9 dB fuller than the whistle was -
  still 4.4 dB under the rain loop (AmbientRaining, RMS 0.0104 at gain 1) at the wind's ceiling. `WIND_GAIN_MAX`
  (0.18) is the one number to turn if it wants to sit lower; it is your ear's call, as WIND3's record says.
- **The Deadlands' deep moan** (above) is the same mechanism in the court. If players hear it as this fault, the bed at
  a low pitch would carry it; it is your design, so it is yours to call.

## Records

- Tests: `test/systems/field_wind1.test.js` (5) - the bed is a wind, not a moan (no voice in any fifth of a second, a steady
  level, no hiss, eight seconds at 22050 Hz, at 0.0349, the same every boot); the loop has no seam (across the wrap no
  step and no bend larger than the largest inside the bed, over nine beds); the driver over a recording engine (the
  bed registered, one `audio.loop` for the whole blow at the slewed gain, gain and pitch live, the riding loop never
  asked, an engine not running yet asked again the next frame, stopped once on the floor and at once on a modal
  frame); the engine's two doors over a rigged context; and on the retail DAGGER.SND (ARENA2_PATH) the moan a voice
  that swells, the blow a whistle, the bed at the moan's level. All five red before the fix.
- Mutants: `tools/mutants/field_wind1.json` (16: the driver back on the riding loop, restarting every frame, the bed
  never registered, the pitch not live; the bed filtered once from rest, without its low-pass, narrow as a whistle,
  unlevelled, at the blow's level, unseeded, a second long; the engine's pitch dead, the bed remade, made at the SND's
  rate, left silent, claimed with no context) - all dead.
- Re-aimed by content, never loosened: `test/systems/wind3_windworld.test.js`'s loop test - the gain law's pins as they were,
  the driver's from the clip swap on the riding loop to the one native loop of the bed.
- Beside it, on Mac's word: `test/ui/audit18_ui_native.test.js`'s stub renderer answers `endUiRun`. 5ad5b481 (Texture Mods)
  made PERF-2D's close the talk window draw's last call, and the file's two pins that draw it over the ARENA2 art (F8/F9,
  F10b) threw on the stub from then on - on main too, unseen, since CI runs without the data. 17 of 17 with it now.
- The live probes were scratch, not committed: a vite server over the tree and over a worktree of main, Playwright's
  Chromium on SwiftShader with autoplay allowed, `?world&shot&play&class=16&novideo`, the intro's window put away by
  its keys; the first traced `audio._buffer` and `audio.setLoop`, the second wrapped
  `AudioBufferSourceNode.prototype.start` before the page loaded. The clips' measures are the page's table above,
  read with `SndFile` and the engine's own `pcm8ToFloat32`.
- Docs: `07-Rendering/Rendering.md` (WIND3's loop corrected in place), `08-Audio/Audio.md` (FIELD-WIND1),
  `01-Overview/Port-Ledger.md` (the wind's row), `10-UI/Features-Arc.md` (WIND3's rows), `09-Testing/Testing.md`,
  `01-Overview/Active-Arcs.md`; the Enhanced sounds row's note on the Features home; the Customs, hoods and field fixes
  patch notes.
