# AUDIT 54 - PUBLISHED HERE, READ THERE (2026-09-03)

Mac: "do a deep comprehensive audit."

## Why this shape

The last two days produced a fault class the suite is blind to, twice
over. GR3: the enhanced sky published `cloudShadow` on the DOME, and
three readers in world.js read it off the CONTROLLER, which never
carried it - the grass wind, the enhanced rain and the ground's cloud
shadows all dead from one missing key, with 6,000 tests green. PX30d:
fatigue has no `maxFatigue` FIELD, it has a LAW, and a bar that read the
field showed 576000%. Both are the same shape: **a value produced in
one place and consumed from another, with nothing pinning the
handoff.** So this audit sweeps for that shape systematically, in every
form it takes here, and reports the clean sweeps as clean.

Nine sweeps. Two findings. Neither is in a path a player has seen.

## The sweeps

| # | Sweep | Result |
|---|---|---|
| 1 | Every property a HOST reads off the sky controller, against the keys its return object carries | **clean** (one false alarm: `sky.setPanorama` at shared.js:339 is the classic renderer inside the factory, not the controller) |
| 1b | The same for `magic` (createPlayerMagic's return), `precip` and `labGrass` (class members), `hudCtx` (each host's literal), across all four hosts | **clean**, once shorthand keys (`readySpell,`) were counted - the first pass reported five misses that were my regex |
| 2 | Every shader uniform in src/render: declared but never set, set but never declared | 167 declarations, **clean** |
| 2b | Declared AND set, but never READ by any shader body | **F1** |
| 3 | Every optional-chain read in scenes+ui whose property name is defined NOWHERE in the tree (the general form of GR3's fault) | 528 reads, 28 candidates, **all 28 shorthand keys** the scan missed (`fnt,` in makeFont, `compassBox,` in the HUD art, `flatPosition,` on the quest marker). Clean |
| 4 | `window.__X` probe surfaces a tool or test reads that src never sets | 155 read, 36 unset - **every one probe-local**, set by the tool's own `page.evaluate`. Not findings; a limit of the scan |
| 5 | `getPref` keys against PREF_DEFAULTS, both directions | 7 keys, all defaulted; `proceduralSky` unread by design (a documented migration key); **F2** |
| 6 | GR3's other two revived consumers: does the value chain past the new getter go anywhere | **yes, both** - the terrain shader reads all five deck uniforms (`uShadowAmt/uCloudCover/uCloudSoft/uCloudTime/uCloudWind`, renderer.js:422-498) and `precip.enhanced` gates the lab rain path (`drawLab`). **Corrected by f3/render, below:** this row also claimed it gates `uEnh`, and that was FALSE - `draw()` returns into `drawLab` on its first line, so `uEnh` was uploaded as 0 on every frame the classic lane drew and never once as 1. Sweep 2b's own question, asked one level up: a uniform declared, set and READ by a shader body that no draw can reach |
| 7 | Every enhanced door has a host that calls it | pinned since AUDIT UI 2; holds |
| 8 | Line-cited Ledger rows resolve to the rows they name | pinned (CD1-5); holds after WIND1's renumbering |
| 9 | The suite on today's tree | 6,225 green, with WIND1 on its branch |

## The findings

**F1 - two grass uniforms nothing reads.** `labGrass.js` declares and
uploads `uWind` (a scalar) and `uWindDir` every frame, and **no shader
body reads either** - the blade's lean has always been driven by
`uWindV` alone. This matters for the record more than the frame: GR2's
"one wind mapping, in both hosts" rescaled `uWind` to the lab's 70 and
documented it as the fix, and AUDIT 49 F4 wrote a paragraph beside the
upload about the difference between the two - and neither noticed that
one of them goes nowhere. The upload costs a null location write, so it
is harmless at runtime, and the shared shader text is the lab's byte
for byte (the lab declares them too), so the cleanup belongs in the lab
first. **Left as recorded; not fixed here**, because a change to the
shared text for a no-op is not worth a slice on a day the wind itself
is still unseen.

**F2 - `textScale` is a setting nothing can set.** `uiPrefs` gives it a
default, the classic settings window reads it (`settingsWindow.js:99`,
scaling its metrics by it), and **no code path writes it** - no
`setPref('textScale')` and no variable-key writer with that key. The
classic settings screen has a text-scale value it will honour and no
control that changes it. That is a dead setting in the classic lane;
recorded here for that lane rather than touched, since the classic UI
is untouched by this arc and the fix is a control, not a plumbing
change.

## The fix lanes

**f3 - render and perf (2026-09-03).** Four defects, all in paths the
enhanced arcs left behind them, none of them a classic-lane pixel:

- **The travel map's road chains had no owner.** `OverworldRenderer.dispose()`
  is headed "Every allocation has an owner (AUDIT 17e)" and freed the
  terrain, the markers, the route, the cloud deck and the backdrop - and
  not the ROADS 25 road layer, which is the largest of them: one VAO and
  one buffer PER CHAIN, ~5,800 chains for roads and tracks alone on
  Hazelnut's arrays, re-traced by every travel-map window and orphaned on
  the session-long shared context by every close. `_freeRoads()` existed
  and had exactly two callers, both inside `setRoads`. It is called from
  `dispose()` now, and overworldmap.test.js drives the renderer on a
  handle-holding Proxy-GL: five chains in, zero live handles out.

- **WX1 orphaned EE8's precipitation profile, and the classic lane paid
  for it.** WX1 gave the enhanced lane the lab's own program and made
  `draw()` return into it on its first line - which left every later
  `this.enhanced` test in that function unreachable: the RAIN_ENH /
  STORM_ENH / SNOW_ENH profiles could not be chosen, `?rain=<n>` could
  not cap anything there, and `uEnh` (with every `mix(..., uEnh)` term it
  gated in both classic stages) was pinned at 0 forever. The cost was not
  only tidiness: the classic program's buffers were still sized
  `PRECIP_ENHANCED_MAX` = 26,000 - a 26,000-iteration build and ~2.7 MB
  of GPU buffers for a program whose only reachable counts are 1000
  (DFU's `Rain_Particles_Splash` cap) and 800 - and the lab's program plus
  its 26,000-instance VAO were compiled and uploaded in the constructor on
  the CLASSIC skin, where `drawLab` can never run. The dead arms and the
  orphaned profiles are gone, the classic stages are their pre-EE8 text
  byte for byte, the classic buffer is `Math.max(RAIN.count, SNOW.count)`,
  and the lab's program is built for the lane that draws it - the enhanced
  hosts pass `sky.enhanced` at construction, so a shader fault is still a
  constructor fault the boot probe sees. The enhanced look is untouched:
  it was always `drawLab`.

- **The world render gate's `--ground` knob read nothing.** EE3's kill
  switch outlived the ground arc's revert (8256ae2: "no reader of
  tileArrayFor, enhancedGround or groundMode remains anywhere"). The gate
  still appended `&ground=<mode>` to the URL and still printed
  `ground=<mode>` in its PASS line - a door that could neither fail nor
  act, and that would have claimed it gated a mode that no longer exists.
  Removed; doctrine.test.js now counts the knobs out of the gate's own
  URL line and requires a live reader in `src/` for each.

- **Both exterior hosts re-parsed the page URL every frame that rain
  drew.** `precip.countCap = Number(new URLSearchParams(location.search).get('rain'))`
  sat inside the per-frame precipitation block in world.js and
  exterior.js - a URLSearchParams construction and a full query-string
  parse per frame, for a gate-only dial that cannot change during a page
  load, one step above the pass EV2 swept four small Float32Arrays out of
  for exactly this reason; and it ran in the CLASSIC lane, which then
  discarded the value. Both hosts read it once at boot off the `params`
  they already carry, and hand it (with the lane) to the constructor.

## What this audit could not do

- **See anything.** No ARENA2 here. GR3 (the wind, the enhanced rain,
  the ground shadows), GR4 (the root blend on real tiles) and WIND1
  (every wind consumer at once) are all never-rendered paths, and the
  Incident's law says each goes to Mac's eyes before it is trusted.
  Every sweep above is static or headless; a clean sweep says the value
  reaches the place, not that the place looks right.
- **Judge the probe-local surfaces.** Sweep 4's 36 are almost certainly
  the tools' own scratch, but "almost certainly" is what this audit
  exists to remove, and I did not open all 36 tools to confirm each.
- **Cover the classic windows' internals.** Sweep 3 ran over scenes and
  ui; the systems and formats were the DEFINITION side only.

## The general lesson, again

Three of the last four real faults were a handoff nobody pinned. The
sweeps here catch the STATIC form - a name read that no object carries.
They cannot catch the LIFETIME form (PX29's doll mask, published before
the composite it described) or the SEMANTIC form (PX30d's field-versus-
law), which only a value assertion or a pair of eyes finds. The rule
that follows: when a slice adds a read across a seam, its pin asserts
the VALUE that arrives, not that the line exists. GR3's own pin is the
model - "sunny is 70, not 0."
