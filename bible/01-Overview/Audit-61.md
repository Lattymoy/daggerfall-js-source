# AUDIT 61 - THE TWO MODS, 1:1 ON MAIN (2026-09-07)

Mac: "lets do an audit and ensure 1:1 integration." Dynamic Skies
2.3.4 (DS1, `997c80a`) and Seasons of the Iliac Bay 1.1 (SIB1,
`8a5e660`) had both merged to main; this audit read the merged tree
against the mods' own sources and against Daggerfall Unity's, with the
port's enhanced environments (the ease, the front, the wind, EV4's
distance, EV5's moonlight, the far ring, the sun strobe) as the third
party in the room. Six finder lenses, every finding judged by two
adversarial skeptics, the eight the rate limit left unjudged re-run
under a second pass (Mac: "ensure any agents are opus and not fable").

## What was checked, and how it came out

| # | Lens | What it read | Result |
|---|---|---|---|
| 1 | DS1 script fidelity | `BLBSkybox.cs`, `Scripts/*.cs` whole against `systems/dynamicSkies.js` and `dynamicSkiesRuntime.js` whole - every method, every quirk | **F1, F2**; one refuted |
| 2 | DS1 shader fidelity | `BLBProceduralSkybox.shader` and its includes against `render/dynamicSkiesRenderer.js` line by line - stages, keywords, sampling, colour space, uniform defaults | **F3**; one refuted |
| 3 | DS1 against DFU's own systems | WeatherManager's fog, SunlightManager's curve and scale, RenderSettings.fogColor, AmbientEffectsPlayer, the snow renderer - against `world/weather.js`, `render/renderer.js`, `worldClock.js`, `systems/ambientEffects.js`, `render/precipitation.js`, the DS1 host hunks | **F4, F5**; two refuted |
| 4 | DS1 on the enhanced environments | `createSkyController` whole, the dome's interface, WIND1/WIND2/WX2, EV4, EV5, the far ring, the strobe, the hosts' every `sky.` read | **F6, F7, F8, F9**, and F4 and F5 again by another route |
| 5 | SIB1 fidelity and hosts after the merge | the DLL's IL whole against `systems/seasonsIliacBay.js`, the five seams in the MERGED hosts (main gained ROAD-G, TI1 and two review rounds after SIB1 was written), the flats consumer against `DaggerfallBillboardBatch` | **F10, F11**; one recorded |
| 6 | The two together, and the classic lane | the season flags, the Mods pane, `modSettings.js`, the credits, the vendor trees and the doctrine allow-list, every DS1 gate on the classic lane, SIB1's reach | **F12**; F2 and F6 again; two refuted |

52 agents in the first pass, 16 in the second (1.3 million tokens of
reading): 23 findings judged, 12 confirmed and fixed (10 DS1, 2 SIB1),
1 recorded as a translation, 8 refuted with the reference in hand (2
of them the same defects as F2 and F6, raised again by lens 6 and
refuted against the tree that already carried the fix), 2 duplicates
(F4/F7 and F5/F9 were one defect each, seen from two lenses).

## The findings, and what changed

**F1 - the lightning listener was a boolean; the mod's is a multicast
delegate** (`dynamicSkiesRuntime.js`). `LightningFlashListener.Start
Listening` is a bare `+=` on the static `OnPlayEffect` event: C#
keeps duplicates, and `-=` removes one. BLBSkybox subscribes from two
places (the coroutine's start and `ExteriorTransitionEvent`) and
unsubscribes from two (the coroutine's end and `InteriorTransition
Event`), so a Thunder outdoors -> door -> outside -> forced weather
re-apply round trip leaves the mod at TWO subscriptions - two flashes
per clap - and a later clear weather leaves one that never goes away.
The port modelled one bit and could neither double nor leak. It is a
count now (`lightningSubscriptions`, distinct from the
`lightningCoroutine` flag, as the mod's two fields are), and
`onAmbientEffect` rolls the flash once per subscription. The leak is
the mod's and is kept; the page names it.

**F2 - `setInside` had no caller** (`world.js`, `exterior.js`).
`InteriorTransitionEvent` stops the listener and every flash in
flight; `ExteriorTransitionEvent` restarts the listener. The runtime
ported both and no host called either, so the mod never heard a door.
Both hosts now call `sky.setInside(true)` on the modal edge (the frame
that hands to an interior or dungeon) and `sky.setInside(false)`
before the first exterior sky frame after it.

**F3 - `_CloudTopColorBoost` painted the top layer pink**
(`dynamicSkiesRenderer.js`). The shader declares a `float3` the mod
writes with `SetFloat`; the port had guessed `(boost, 0, 0)`, which
divides only red and turns Sunny's `C7C7C7` top layer to about
(1.0, 0.78, 0.78) every clear day. The mod's own readme records the
answer: "Color boost - broken on the top layer for some reason". The
uniform is uploaded as zero (the boost inert), the value still read
and forwarded as the mod does.

**F4 - the flash followed the sim's word, the clips followed the
front's** (both hosts). In DFU one `SetWeather(Thunder)` starts the
listener and switches the ambience to the Storm preset in the same
frame, so every one-shot the listener hears is a storm clip. The port
starts the listener on the sim's word but, under the enhanced front,
plays the ambience on `soundWeather(fx, weather)` - the SHOWN word -
which is 'cloudy' for the whole three-hour lead and 'thunder' for the
whole drain. Bird calls flashed; thunder rolled dark. The hosts now
hand the listener the word the ambience is actually playing
(`sky.onAmbientEffect(playerPos, ambientWord === 'thunder')`), so the
flash accompanies the clap it heard, as it does in DFU.

**F5 - EV4's distance scale stretched the mod's fog row**
(`world.js`). `scaleFogForDistance` multiplies a linear row's `end` by
TerrainDistance/3 - the law tuned for DFU's 0..2400 Sunny row. The
mod's FogSunny is 2000..3600, written verbatim into WeatherManager's
struct, and nothing in DFU or the mod rescales it; the port drew
2000..4800 at Land View Distance 4 while `?exterior` drew 2000..3600.
Under the mod the row installs verbatim in both hosts (`weatherFogRow`
in `world.js`; the scale stays the port's own row's).

**F6 - the ?season pin reached the ground and not `_LightColor0`**
(`shared.js`). The hosts' `weatherSun` (WeatherManager's ScaleFactor)
takes the ?season pin and the fast-travel latch; the DS1 pass
re-derived the winter arm from the calendar. One SunlightManager feeds
both in DFU; the hosts now pass the ONE scale the ground takes -
`wxNow.sun`, WX2's front blend of their own `weatherSun`, the raw row
under `?front=off` and on the classic path - in `extra.sun`, and the
controller uses it. (The first cut passed the raw `weatherSun`; WX2's
own pin, that no frame consumer reads the raw scale, caught it.)

**F7 - two lightnings** (both hosts). AUDIT 39's sun strobe is the
port's enhanced-skin rendering of DFU's unreachable
`PlayLightningEffect`; DS1 adds the mod's point flash. Both ran under
the mod on independent cadences - neither DFU+mod nor the port before
DS1. The strobe stands down while `sky.dynamic` is the sky.

**F8 - EV5's moonlight ignored the mod's clouds** (`shared.js`). The
dome's moon visibility is cloud-dimmed by the eased cover; the mod's
was `1 - day`, so a full Masser under the mod's Overcast lit the
ground through solid cloud. The mod's clouds are textures the CPU
cannot sample; the eased row's `cover` is the stand-in
(`vis * (1 - cover * 0.35)`), and the ledger row says so.

**F9 - the far ring's ramp assumed the fog starts at zero**
(`render/farRing.js`, `world.js`). `clamp(vDist / uFogEnd)` equals the
terrain's linear ramp only when start is 0 - DFU's rows; the mod's
Sunny starts at 2000, so terrain at 3000 was 62% fogged and the ring
beside it 83%. The ring takes `uFogStart` now and ramps
`(d - start) / (end - start)`.

**F10 - the seasonal flats carried a mip chain the mod's atlas does
not** (`world.js`, `exterior.js`, `render/renderer.js`). The mod
builds its atlas `new Texture2D(size, size, RGBA32, mipChain: false)`,
`Apply(updateMipmaps: false)`, Point; DFU's own nature atlas is
mipped, so only the mod's records lose the chain. The port's upload
gate mipped every numeric archive, and the one opt-out re-keyed the
upload to `#ui` where the batch draw could not find it. The un-mipped
upload can keep the plain batch key now (`variant: ''`; the item icons
keep `#ui`), and both hosts ask for it.

**F11 - a pixel's install stamp was read at publish, not at its
lookups** (`world.js`). A pixel's flats are chosen from the cache
before its texture fetches yield; `generation` was stamped at
`built.set`, after them. A forced apply that lands in between - a
quickload whose save's pixel is the one in flight, a teleport whose
destination ring keeps it - published a pixel of the OLD install
stamped as the new, and `refresh`'s scan (which cannot see a pixel not
yet published) never tore it down: mixed-season flats until the
streamer happened to unload it. The mod's
`RefreshLoadedNatureBatches` walks EVERY batch after every apply, the
just-built included. The stamp is captured at the lookups, and a
pixel that publishes across an install raises the re-skin itself -
the same publish-time re-check the terrain ring class already runs.
Both skeptics disagreed on the finder's route (the month turn is
structurally covered: `refresh` returns on the FIRST older pixel and
the pump is single-flight) and agreed on the reachable one above.

**F12 - `MaxParticles`' description was not the mod's**
(`systems/modSettings.js`). The module promises the descriptions
"exactly as its modsettings ships them" and the pane shows them
verbatim; this one row carried a port sentence after the author's.
The sentence is a comment now, and the pin asks for equality, not a
prefix.

## Refuted, with the reference in hand

- **The first-tick load arm on a new game** - DFU's own outcome there
  is undefined: whether WeatherManager's climate event lands before or
  after BLBSkybox clears its Init pending flag is Unity's unordered
  Update between two priority-0 behaviours; the port's outcome is one
  of the two DFU can show.
- **Cloudy's divide by zero** (`ColorBoost 1.0`) - x/0 for x > 0 is
  +inf on every WebGL backend and `clamp` makes it 1, which is the
  D3D11 result the mod relies on; the 0/0 case needs a zero channel
  with boost 1 and no preset has one.
- **`OnPlayEffect` raised at the clip's start, not after the flash
  train and the 1.7 s roll delay** - that arm is
  `PlayLightningEffect`, which DFU's scene serialises `0` on both
  players and nothing sets; DFU raises the event inline after
  `PlaySomewhereOnHorizon`, where the port raises it.
- **`_LightColor0` missing DFU's storm flicker** - the same
  unreachable arm; the mod's lightning is its own point light and
  never writes the sun.
- **The OnPlayEffect bullet naming the wrong arm** (`:361/:396`) -
  raised a third time from the strobe's side and refuted a third time:
  the coroutine arm is dead in shipped DFU (one skeptic fetched the
  scene file to check the serialised `0` again), and the page's "both
  arms" are the two reachable ones.
- **SIB1's switch unreachable on the classic lane** - the classic
  settings screen's skin button reaches the Enhanced menu in two
  presses, and the pane's home was already on the page.
- **`setInside` never wired** and **the winter flag ignoring the
  ?season pin** (lens 6) - the same defects as F2 and F6, judged
  against the working tree that already carried both fixes.

## Recorded, not changed

**DFU's refresh reaches the ACTIVE batches, over a substrate that
never re-skins a standing terrain.** The two skeptics split on the
finder's framing and agreed on the facts, which are now translation 4
on `07-Rendering/Seasons-Iliac-Bay.md`: `RefreshLoadedNatureBatches`
walks `FindObjectsOfType` (inactive batches skipped), a pooled batch
keeps a stale material through every unforced recycle, a month turn
taken indoors refreshes nothing until the town's own flats re-skin on
the first exterior frame - and the streamed terrain around them keeps
its season because DFU never re-skins a standing terrain at all, mod
or no mod. The port's grid rebuild on a season change is the ROAD A1
law, older than the mod and pinned; the port never shows DFU's split,
and the page says so rather than inventing a batch pool to paint
wrong-season flats.

## Not seen

No ARENA2, no mod bundle in the container: nothing here rendered a
world. The sky lab probes (`tools/dynamicSkiesProbe.mjs` 11/11,
`tools/enhancedSkyProbe.mjs` 10/10) and the suite are the evidence.
