# AUDIT 65 - THE DELTA SINCE AUDIT 62, BY FAULT SHAPE (the shape turn), 2026-09-10

**CLOSED (2026-09-11), in two rounds.** The finder and refuter phases
were complete and every verdict final before the fix lanes ran. Round
one reviewed, fixed up and merged eight of the fourteen lanes and went
to main as PR #84 while the Opus session limit held the other six;
round two - the five remaining reviews, the activation lane's resume and
its own review - landed the same day when the limit lifted early. RS-10
closed under it (PERF2 put every sky pass at the far plane), and the
Home.md row closes with this record.

The question: AUDIT 63 read ten classic systems whole and AUDIT 64 the
other ten, and 63's own lesson said alternate - shape, then depth, then
shape. The shape turn was owed, over a delta the fault-shape lenses had
never read: since AUDIT 62 closed (2026-09-07) main took 83 commits and
199 `src/` files (+13,159 / -1,833) - AUDIT 63's seven lanes and AUDIT
64's nine, WATER1 and its audit, the Clock arc, TL3 + CG2, SIB2, the
MODS AUDIT with FIX-C/D/E/F and DS2, MW-LOAD, and the 2026-09-10 slices
(OT1, MAC1, CS1). Each piece was reviewed on its own branch against its
own reference; nobody had asked what the pieces do to each other, or
swept them for the shapes this port keeps producing: the missing
caller, the four-hosts miss, the constant where DFU reads a value, the
pin that restates the port, the seam one lane built and another lane's
fix bypassed.

**Nine fault-shape lenses over the delta with the DFU reference on disk,
50 findings judged by two Opus refuters each, 33 confirmed (two
duplicates folded) and 15 refuted. Fourteen fix lanes in isolated
worktrees - grouped by the FILES they touch - each followed by its own
adversarial reviewer and a fixup round; integration through
`tools/citeShift.mjs`.**

## Why the audit took this shape

A depth audit reads one system against one C# file and finds the
members nobody ported. A shape audit reads ACROSS the slices for the
faults that live between them - and the delta since AUDIT 62 was
eighty-three commits from seventeen lanes and a dozen solo slices, each
correct on its own branch. The lenses were the port's own recurring
fault shapes, the ones AUDIT 62 and 64 named in their lessons:

| # | Lens | What it read | Judged | Confirmed |
|---|---|---|---|---|
| 1 | missing-caller | every export, hook, option and field the delta added, grepped for a feeder and a reader; the four-hosts sweep over the delta's per-frame laws | 6 | 5 |
| 2 | hosts-parity | the delta's host wiring across `world.js`, `exterior.js`, `worldModes.js`, `dungeonContext.js` and the standalone scenes | 3 | 3 |
| 3 | constants-vs-reads | every numeric literal the delta added against the C# member that owns it - live vs permanent, restated vs imported | 4 | 3 |
| 4 | pins | 57 mutants run against the delta's own tests: which pins cannot redden | 8 | 3 |
| 5 | cross-lane | pairs of slices that touch one seam (OT1 x AUDIT 64 F0, MAC1 x SIB, MAC1 x MW-D25, MAC1 A x MW-LOAD...) | 6 | 4 |
| 6 | reference-cites | 312 `File.cs:N` cites on the delta's added lines resolved line by line against DFU master 81e89e9 | 3 | 3 |
| 7 | saveload-delta | every member the delta added to or read from the save envelope, the classic import and the four hosts' restore paths | 4 | 4 |
| 8 | ui-input | the delta's windows and the hosts' click, key, wheel and pointer-lock seams against `BaseScreenComponent.cs` and the window classes | 5 | 5 |
| 9 | render-state | the delta's GL passes: state brackets, texture units, framebuffer restores, allocations, pass order | 11 | 3 |

Two findings were the same defect seen from three lenses (MAC1 J's
relock hook missing from the dungeon and fixed-city hosts: `ui-input`,
`cross-lane`, `hosts-parity`) and two lenses filed the water scroll
literal (`constants-vs-reads`, `missing-caller`); both fold to one row.
Every finding went to two adversarial refuters prompted to REFUTE it
with the reference open; a finding survived only if both upheld it, and
each refuter's corrections travelled into the lane brief verbatim. Where
the two disagreed on a fix's SHAPE, the shape that kept the tree's own
recorded law won (the large HUD consumes an unbound button rather than
falling through, per `hudLarge.js`'s own header; the classic pause
window relocks on its two resume exits and not in the shared close the
save arm also takes).

## What was refuted, and why

Refuted by both:

- **Seasons of the Iliac Bay's 3.1x flats defeat MAC1's far-flat rule
  for three seasons of four** (cross-lane) - one refuter upheld it and
  the other did not, and the second was right on the law: the rule is
  a WORLD-UNIT size test ('a tree, at or above 2.5 units'), and under
  the mod those plants really are five to eight units tall and subtend
  the pixels a tree does. The rule answers its own criterion; what
  changed is the world. The mod is opt-in and the cost is the mod's.
  Recorded as a sentence in `Seasons-Iliac-Bay.md`, not a fix; if Mac
  reports fps with SIB installed, the lever is a screen-size criterion
  applied uniformly, not a season-conditional height.
- **The closed-building line is an invented sentence** (constants) -
  `Internal_Strings.csv:36-37` (read from the reference's object store)
  are `Store is closed. Open from %d1:00 to %d2:00.` and `Guild is
  closed. ...`, differing only in the first word; the port's one
  template with the noun swapped produces both byte for byte, and the
  docblock four lines above already cites the two csv lines.
- **`farFlatVisible`'s options object per batch per frame** (render) -
  measured at 0.2 ns per call over five million calls; V8 scalar-
  replaces a destructured literal that never escapes. EV2's law is
  about `Float32Array`s that escape into a model's matrix.
- **`drawWaterSurface` re-uploads pass constants per pixel** (render) -
  the counts are real (34 uniform calls a surface) but the host comment
  the finding read as a law ('one uniform set a frame') describes the
  `waterUniforms()` object built once outside the loop, which is what
  the code does; `drawTerrain` has the same shape and always has.
- **Per-frame scratch objects in the deck chain** (render) - eight
  small objects a frame, and the proposed `gen` counter would have
  replaced the identity stamp `setCloudShadow` depends on with a second
  source of truth in the seam RS-3 shows is already fragile.
- **The cloud passes leave `blendFuncSeparate` standing** (render) -
  every `enable(BLEND)` in `src/` sets its own func within two lines,
  and leaving BLEND off on exit IS the renderer's baseline, not a
  missing restore.
- **`_shiftShadowMap` uploads in-frame and clobbers the active unit**
  (render) - 16 KB once per 819.2 m at the default tier; the active
  unit is TEXTURE0 on every path into it and the next pass rebinds.

Refuted by one (a split is a refutation; the surviving half is recorded
here so the next slice through the file can take it):

- **`withTarget` restores nothing on a throw** (render) - true, and
  latent: every closure handed to it is two GL calls, and GL does not
  throw. The `try/finally` is a one-line hardening for whoever next
  opens `renderTarget.js`.
- **`VolumetricClouds` has no `dispose`** (render) - true, and there is
  no path that ends its life short of the page: `exitToTitleMenu` is a
  navigation, and a host boots once per page. AUDIT 17e's law is about
  teardown reachable from the path that ends the object; here none
  exists.
- **The march loop ceilings 96 and 8 are unpinned** (render) - true and
  zero-consequence at HEAD; a two-line interpolation and a pin for
  whoever next opens the file.
- **Four AUDIT 63/64 pins compute their expected value from the module
  under test** (pins: `EXTRA_DISTANCE`, the shoplifting chance, the
  too-far call count, `rebuildRoadless`'s callers) - all four mutants
  are killed by an older file in the full suite (`prisonrelease`,
  `theft`, `audit23_ui`, `roads`), so the number cannot ship wrong.
  Duplicate coverage is a locality note, not a hole. The second refuter
  wrote and verified a literal form for each; they sit in the audit's
  verdict files.
- **The death-video watchdog is held by a 15-60 s band** (pins) - the
  test never promised the number; both halves of its claim (the hold,
  the release) are pinned behaviourally with an injected value.

## What was broken

Thirty-three confirmed findings landed in fourteen lanes, grouped by the
files they touch. Each lane ran in its own worktree from the stub, was
read by its own adversarial reviewer, and took a fixup round; the review
findings are recorded under each lane, because the reviewers found the
half the lanes' own mutation tallies could not see.

### The save envelope and the weather (saveload-core: SL-1, SL-4)

- **SL-1** `restoreWeather` lowered `_evolveHour` but not
  `_climateWeathersValid`, so an IN-SESSION load (F12, the pause
  window's Load) left the outgoing session's boot-roll flag standing
  over the outgoing session's six zones; CLK2's hourly evolution turned
  a zone, raised DFU's own drain flag, and `tickWeather` applied the
  player's slot from a stale array - the restored sky was gone by hour
  five. `WeatherManager.cs:538-542`'s else arm is not "at boot", it is
  "in case of loaded savegame", every time. One line at
  `weatherSim.js:334`; no envelope change. The CLK4 pin stayed green
  under this bug for a whole audit because it opens with
  `resetWeatherSim()` - a restore pin that starts from a fresh module
  tests the boot load only, and the boot load was never the broken
  case.
- **SL-4** The envelope carried `reactionMods` under a comment citing
  `SerializablePlayer.cs:152-162`, a range that writes the eleven
  `sGroupReputations` and nothing else; `PlayerEntity.cs:128-129` says
  of `reactionMods` "do not serialize, set by live effects". A pre-F6
  five-wide snapshot restored five-wide and `ClearReactionMods`'
  `fill(0)` kept the length forever, so the Masque of Clavicus buffed
  five social groups instead of eleven for the life of that character.
  DROPPED, not padded: `REP_ARRAYS = ['sGroupReputations']`, and the
  entity is now BUILT with the eleven zeros DFU's field initializer
  gives (`playerEntity.js`, the third field of the U24/A4 kind). This
  reverses AUDIT 63 F6's `classicSave.js` half; its Talk-Arc sentence
  is struck, and the UI-Arc and Home.md paragraphs that named
  `reactionMods` as persisted are narrowed to the reputations. No
  Ledger A row - the departure is retired, not recorded.
- *Review round:* the Talk-Arc sentence describing the deleted line was
  the block; the constructor line and the producer-minted pin were the
  shoulds. Four mutants, four red.

### The large HUD (hudlarge: UI-4)

- `HUDLarge` binds `OnMouseClick` and `OnRightMouseClick` on all eleven
  panels and no `OnMiddleMouseClick`; `BaseScreenComponent.cs:679-724`
  dispatches the three buttons in independent blocks with no fallback.
  The port sent every non-right button to the LEFT action, so a middle
  or aux click on the bar opened the pack, the spellbook, the sheath or
  the pause door, silently, in all four hosts. The fall-through line is
  AUDIT 54's; AUDIT 64 F42 recorded the two-button law and applied it
  to the CLIP alone. The gate now sits in `routeLargeHudClick` and
  answers TRUE (the bar consumes an unbound button and runs nothing -
  the module's own consumption law), not null. A pin certified the bug
  (`at('map', 1).action === 'AutoMap'`, "a middle click takes the left
  handler") and would have blocked its own fix.
- *Review round:* the gate's PLACEMENT was unpinned - hoisting it above
  the hit test or above `IsLargeHUDInteractable` survived the whole
  suite; two lines hold it now. Five mutants, five red. Three stale
  `IsLargeHUDInteractable (:392-395)` cites corrected to `:388-391`.

### The rebinding pane and the classic pause window (ui-pause-controls: UI-3, UI-2)

- **UI-3** FIX-F's enhanced rebinding pane had no `waitingForInput`
  guard - `DaggerfallControlsWindow` heads all seven handlers with one
  (:281 :290 :299 :321 :338 :361 :371-372), and the port's classic grid
  carries it in one line. CONTINUE under an armed capture saved and
  re-staged, leaving the capture live for the next keystroke anywhere;
  the Primary/Secondary toggle flipped the dict a pending capture
  writes to. One `act` wrapper over the six click surfaces; the
  right-click keeps `preventDefault` outside the guard. Six mutants,
  six red.
- **UI-2, the classic half** MAC1 J's `hooks.relock` was read only by
  the enhanced pause door; the classic window relocked on nothing. It
  now relocks on every RESUME exit - CONTINUE, the deferred Escape
  keyup, the two quick-verb save/load fallbacks (live on `exterior.js`'s
  LOAD arm today) and `popToHUD`'s drain of a COMPLETED pushed save or
  load - and on no exit that hands over a window.
- *Review round:* the first cut's save/load pin drove a `{ quickSave(){}
  }` bag no host mints (every pause host passes saveAs + loadKey +
  pushWindow, so the door PUSHES and `_closeWith` is never reached), and
  two resume exits were still cold. The pin now drives the producer's
  bag and the replace fallback - the one `_closeWith` caller that is not
  a resume, and the only arm that tells the two candidate fixes apart.
  Six mutants, six red. The four hosts: `world.js` wired on both arms;
  `worldModes.js`'s `relock: host.relock` was undefined on the ?exterior
  route; `exterior.js` and `dungeonContext.js` unwired - the host-seams
  lane's.

### The water constants, the dead exports and three pin files (water-pins: CV-3, MC-6, PN-1, PN-2, PN-3)

- **CV-3** The classic water scroll rate was spelled three times in two
  names across three modules; `render/waterSurface.js` is the one home
  and both dungeon hosts import it. The two `[1, 1, 1, 0.82]` quad
  alphas are NOT merged with `WATER_OPACITY` - a flat alpha for
  `drawWater`, not the surface's Fresnel floor.
- **MC-6** `tilemapHasWater` had no caller (superseded by
  `tilemapRectHasWater` and `buildWaterIndices`) and is deleted;
  `waterCoverage` also had none but is the only executable statement of
  the corner-bit order, so it stays and its test is now an oracle
  against the module's own GLSL `coverage()`.
- **PN-1, PN-2, PN-3** Seven WATER constants (one, `WATER_TINT`, held
  nowhere at all), the three cloud tiers with all seven `VC_PROFILE`
  rows, and all seven ECV1 concealment constants were pinned only
  against themselves or by inequalities - the whole 7047-test suite
  stayed green with the water lifted ten times and a chameleon drawn
  solid. Literals beside reasons now, with the identity lines kept as
  wiring pins. `SHADE_DARK` only reddened because the billboard shader
  restated 0.12 as a second GLSL literal; the FS interpolates the
  export now, from `systems/concealDraw.js` - a LEAF, because importing
  it from `combatVisuals.js` took the renderer's static closure from 13
  modules to 69.
- *Review round:* four table-behaviour assertions were dropped with the
  retired export instead of moved to the surviving gate (a shore-only
  town would have lost its water pass with CI green); the FS pin read
  the string after its own substitution, so a bare `0.12` slipped back
  in silently; the import edge. 55 mutants run by the reviewer, 49 red,
  the six survivors all closed.

### The renderer (renderer: RS-2, RS-3)

- **RS-2** `renderCharacterSprite`'s VC5 try/finally guarded the JS
  caches and left the three GL restores - the sprite FBO's unbind,
  `_restoreWorldViewport()`, the clear colour - below it. The throw path
  is reachable (`drawCharacter` dereferences the mesh) and SWALLOWED
  (`fpArm.js`'s `catch { img = null; }`), and because `setClearColor` is
  idempotent against the `_clearColor` shadow, GL stayed at transparent
  black for the rest of the session while the shadow read sky blue -
  AUDIT 26 F034's bug back, permanently, off one caught exception. All
  three restores are inside the finally now, GL-first.
- **RS-3** The cloud-shadow map lived on texture unit 7, the unit the
  Dynamic Skies pass writes `_MoonTex` into, and `markForeignPass()`
  reset the program and VAO shadows but not the upload stamps - a key
  uploaded before the sky kept a stamp claiming unit 7 held the shadow
  map while it held the moon. Live in `exterior.js` (which draws the
  body before the sky), latent in `world.js`. `markForeignPass()` and
  `beginFrame()` empty the stamps; the unit is `CLOUD_SHADOW_UNIT = 15`,
  above the mod's nine under WebGL2's sixteen-unit guarantee.
- *Review round:* clean; nits applied.

### The exterior swimmer (swim: XL-1, the critical one)

- DFU has TWO swim members - `PlayerEnterExit.isPlayerSwimming` (the
  host flag; kept on tile 0 outdoors, `:415-421`) and
  `levitateMotor.IsSwimming` == `PlayerMotor.IsSwimming` (cleared
  outdoors with no tile test). The port had one, `player.swimming`,
  whose setter arms `CancelMovement`. OT1 wired `exteriorSwimming()`'s
  result into it AFTER `applyMotorEffectFlags` wrote false, so every
  frame was two edges and the fixed step spent the cancel and returned:
  MEASURED on the real motor over a real Collider floor, the exterior
  swimmer travelled nothing at every ordinary frame rate (0.10 units in
  the two frames before the latch closed, then zero for six hundred
  steps), with the swim speed sitting unused in `speed`. The finder
  measured it, both refuters re-measured it, and the lane's pin
  measures it from the C# constants: 1.772 units a second again.
- The motor carries both members now: `isPlayerSwimming` is a plain
  field the hosts write; ten `IsPlayerSwimming` readers moved to it
  (the fatigue band, the encounter roll, the exhaustion collapse, the
  rest refusal, HeadBobber's style and bounce - which the finder had
  backwards); the `IsSwimming` readers (the zero-and-return, the
  forced-swim crouch, the footstep stride, PassiveSpecials) stayed. Both
  dungeon arms write both from one block-water test. `UpdateSpeed`'s
  gate stays on `sunk`, AUDIT 64 F0's pinned proxy - re-pointing it is
  a slice of its own.
- *Review round:* the standalone dungeon's HeadBobber repoint was
  unpinned (reverting it survived the suite); the seam's docstring named
  the wrong member; the motor pin forbade the READ DFU's own UpdateSpeed
  has. Twelve mutants, eleven red before the fixup, twelve after.

### The double-click clock (ui-windows: UI-1)

- Every overlay slot dispatches `click(vx, vy, right, middle)`; OT1 gave
  the spellbook `click(vx, vy, now)`, so `now` was `e.button === 2`,
  `false ?? Date.now()` kept the boolean, and every second click in the
  spell list cast or bought - any row, any distance in time. The nested
  path proved it: `charsheet.js` forwards two arguments, so the
  spellbook opened from the sheet timed correctly while the same window
  from the dial did not. `listPicker.js`'s fourth slot and
  `nativeTalk.js`'s carried the same shape from AUDIT 54 (the bare
  mounts: useMagicItem through three hosts, the bookshelf picker). Each
  window times on its OWN `_now()` seam now; and `BaseScreenComponent.cs
  :687-688` stores the stamp UNCONDITIONALLY, so the clear on a double
  is gone from all three - click/double/DOUBLE, as DFU.
- *Review round:* the new spellbook seam itself was unpinned (deleting
  `_now()` left 255 tests green and would throw on the first click in
  the game), and a fifth suite still minted the old shape. Flagged, not
  fixed: `chargen.js:987` and `:1927` still spend the stamp.

### Three small seams (small-seams: MC-3, MC-4, XL-6)

- **MC-3** `dynamicMoonlight` had no caller; `shared.js` carried its
  body inline. Wired, not deleted.
- **MC-4** FIX-F's keyboard-look arm was absent from the fourth
  `LookFilter` owner, the standalone `?interior` fly-cam. Not one of THE
  FOUR HOSTS - the set this seam owes is every filter owner - and the
  audit28 pin had been given an "interior has 2 sites" exception by
  FIX-F itself to keep its own miss green.
- **XL-6** MAC1 A's boot-menu `registerMorrowindData()` ran MW-LOAD's
  size fingerprint, whose sizes went through `assetBlob` - which
  structured-clones a pre-MW-LOAD ArrayBuffer whole and PUTS it back.
  Measured with a counting IndexedDB: N value gets AND N readwrite puts
  over the stored set, on the title screen. The sizes read through a
  plain get now; the boot door counts names (one `getAllKeys`); the
  fingerprint stays on the host bootstrap.
- *Review round, the block:* a names-only count left the print null, so
  the MW-D9g guard read the NEXT `registerMorrowindData` - the attach -
  as "learning a set" and never dropped the swap caches: MWFIX's bug by
  a new road, with no pin to see it. The count remembers the names it
  saw; the guard compares them while the print is null. And the Build
  first-person arms button now measures the set before it spends
  seconds, so fpArm's kept face verdict is a lookup. Thirteen mutants,
  thirteen red; the block's own fourteenth red.

### The skills page and the player's body (constants: CV-1, CV-2)

- `TextProvider.GetSkillSummary` (`TextProvider.cs:489-529`) formats
  its value token as `GetLiveSkillValue(skill)` at `:503`, and
  `ShowSkillsDialog` builds EVERY row from that one member
  (`DaggerfallCharacterSheetWindow.cs:288/:296/:301`) - the permanent
  value is never read on that path. The port drew the row off the
  permanent `entity.skills` array while the hand-to-hand damage row four
  lines below it (AUDIT 63 F34) already read live, so a lycanthrope read
  `Hand-to-Hand 30%` on one line and a damage range computed from 60 on
  the next. `charsheet.js:659` and `enhancedCharSheet.js:126` read
  `skillValue` now, which moves the enhanced skin's meter with its
  number (`enhancedMenu.js:1547-1548`) - correctly, since the attribute
  bars beside it were already live. The art-less `_drawFallback` pane
  still prints `''` for an absent skill (both refuters: decide the
  blank case first); DFU has no such pane.
- DFU's area and contact queries meet whatever collider each entity
  wears (`DaggerfallMissile.cs:481`, `:339`), and the two prefabs
  differ: `PlayerAdvanced.prefab:81-85` is 1.8 / 0.35 / 0.06 against the
  enemy's 1.8 / 0.4 / 0.05, and neither `PlayerHeightChanger` nor
  `SetupDemoEnemy` ever writes a radius. One module constant measured
  both bodies, so the player carried a body 0.10 wider than DFU's on
  every missile, arrow and blast. `sphereOverlapsCapsule` /
  `missileHitsCapsule` take a `bodyRadius` - at the axis inset as well
  as the compare - defaulting to the foe's; `PLAYER_BODY_RADIUS` is
  `player/motor.js`'s own `CAPSULE_RADIUS`, imported not restated (skin
  width is PhysX's penetration allowance; DFU casts at the raw
  `controller.radius`). Five player sites pass it. THIS STRIKES
  `Characters-Arc.md`'s "sweeps the player's own capsule ... exactly as
  the foe arm does" and narrows `Testing.md`'s arrowfoes row to each
  body's own radius. The foe's 0.45 stays: the refuters split on it (A:
  skin-inflated, the query radius is 0.40; B: AUDIT 62's record pins
  it), and a split is a refutation.
- *Review round:* clean. Thirteen mutants, thirteen red - the motor.js
  import is load-bearing (0.35 -> 0.36 reddens three CV-2 tests), and
  the axis inset is pinned separately from the compare, the half the
  finder warned could be missed. The reviewer's own sweep found the two
  doc sentences above and one more thing left (below).

### The reference cites (cites: RC-1, RC-2, RC-3)

- Comment-only and line-count-neutral in every file: RC-1's one wrong
  FILE copied to four sites (the ReservedKeys law is
  `InputManager.cs:73`'s empty array, exposed `:174-177` and consulted by
  `DaggerfallControlsWindow.cs:410`, whose own `:73` is a brace - both
  files carry something at :73, which is how the slip survived); RC-2's
  invented member (`IsAlreadyPlaced` is not DFU's name for anything -
  the double-injection guard is `IsAlreadyInjected`,
  `GameObjectHelper.cs:978`, called `:950`, over the list at `:926`,
  where worldModes cited a BLANK `:917` at both of its collectors while
  dungeonContext already had `:926` - two siblings on one list,
  disagreeing); RC-3's five single-line cites that QUOTE the line they
  name, each one digit off (`StaticNPC.cs:155`, `:158`;
  `DaggerfallStartNewGameWizard.cs:571-572`, `:574`;
  `SerializableEnemy.cs:116`). The pin is in two parts, as both
  refuters required: a text half that holds without a checkout (the
  invented name is walked for; the ReservedKeys wording at all four
  sites) and a resolve half behind its OWN `missingDfu` gate, so a
  missing `.cs` cannot silently skip ROAD-G G4's slice either.
- *Review round:* the lane's own record row had the RC-2 evidence wrong
  ("both hosts cited a blank :917"), and the residue it did not sweep
  was in the file it edited (`Testing.md`'s audit64_layout and
  audit24_scenes rows, and RC-3's own `:149-154` for `:149-155`) - fixed
  at integration with the test and arc residue the lane had listed, and
  the pin's walk widened from `src/` to `src/`, `test/` and `bible/`,
  with the records that QUOTE the retired name (this file, `Testing.md`,
  the pin) the only files allowed to carry it. Eighteen mutants,
  eighteen red; a CI simulation without the DFU clone reddens the text
  halves and lets a resolve-only mutant through, which is the gate
  working as designed.

### The wheel (wheel: UI-5)

- AUDIT 64 F52 routed the classic pack's wheel by what the pointer is
  OVER, which is right - `BaseScreenComponent.Update`'s scroll block
  (`:725-736`) is guarded by `mouseOverComponent`, which `Update`
  recomputes from the live scaled mouse position at `:577-594` - but it
  routed by a REMEMBERED point: `nativeInventory._mouse`, seeded
  `[-1,-1]` (`:354`) and written by `hover()` alone (`:1055`), while
  every host seam handed the window a bare `wheel(dir)`. Opening the
  pack with the Inventory key releases the lock without moving the
  cursor, so the browser fires no mousemove and the first notch hit no
  rect; the same notch after a one-pixel nudge worked. The point rides
  the notch now: `wheel(dir, vx = this._mouse[0], vy = this._mouse[1])`,
  the remembered point only the fallback for a caller with none.
- THE FOUR HOSTS: `world.js` and `exterior.js` own no wheel arithmetic
  and hand the raw event on, so both are WIRED through `townTalk.js`'s
  seam and `worldModes.js`'s (BOTH arms - the interior slot and
  `dungeonCtx.overlayWheel`); `dungeonContext.js` takes
  `overlayWheel(dir, vx = -1, vy = -1)`; the standalone `dungeon.js` and
  `interior.js` are wired directly. Each host computes the point with
  its own hover arm's arithmetic, so a notch outside the letterbox now
  routes nothing - which is `mouseOverComponent == false`.
- STRUCK: `UI-Arc.md`'s F52 record ("each call
  `overlay.wheel?.(Math.sign(e.deltaY))`"), `ui/controlsWindow.js`'s
  quote of the same, `ui/saveWindow.js`'s RECORDED structural departure
  ("the port's host channel delivers a bare sign" - the hosts carry the
  point now, and that window still ignores it, having one list), and
  the three "the overlay wheel seam carries no position" sentences in
  `ui/automapWindow.js` and `ui/mouseControlsWindow.js`. FLAGGED, same
  shape, not wired: `ui/automapWindow.js`, `ui/mouseControlsWindow.js`,
  `ui/nativeTalk.js` and `ui/itemMakerWindow.js` each route a notch by
  a point seeded before the first mousemove and now discard the live
  one the hosts hand them; they seed `[0,0]`, not the leave sentinel -
  the finder's "same seeded sentinel" was wrong, and this is no
  sentinel retirement.
- *Review round:* fixup. The record row's two `nativeInventory` cites
  were wrong in every frame and the `automapWindow` feed cite had been
  moved by the lane's own comment; the wheel-block range was attached
  to the wrong verb at eight sites; the tooltip half of
  `ItemListScroller.cs:346-347`'s repoint was unpinned (a `_mouse` read
  in `_wheelRehover` survived the suite) and is pinned now; the two
  siblings the refuters named by name were flagged 2 of 4. Eleven valid
  mutants at review, ten red; the survivor is the pin added since.

### The motor's view and its climb (motor-view: XL-4, XL-5)

- The third-person focal (MW-D25) rode `player.pos`, the collider,
  while the first-person eye rode `eyeAt()` - the interpolated, then
  low-passed position MAC1 I gave the eye against the stair-step
  quantisation. So the body camera climbed each step raw: 0.1531 of
  rise per step at 60 Hz where the eye showed 0.0514, and at 144 Hz a
  horizontal quantisation the eye no longer had. `feetAt(alpha)` sits
  beneath `eyeAt` with the same span lerp, the same snap guard and the
  same `_eyeFeetY` substitution, WITHOUT `_eyeLevel()` and WITHOUT the
  bob (the focal supplies `FOCAL_HEIGHT` itself); all nine `mwView`
  call sites in the four hosts hand it over. This is the port's own
  presentation law (EV1 / MAC1 I) applied to one camera and not the
  other - MW-D25 has no C# counterpart, so no C# line is cited for the
  defect itself. The filter's worst lag on MAC1's staircase is 0.212,
  inside `STEP_OFFSET` 0.5; `mwCamera.js` is untouched.
- `this.standing` and `movingLessThanHalfSpeed` are a port-side CACHE
  of what `PlayerMotor.cs:113-125` and `:168-181` answer live, and
  `_step`'s climb return sat above both remaining writers, so a
  grounded forward climb start carried the pre-climb `standing = false`
  into the footstep gate, MAC1 H's politeness gate and the stealth
  senses in all four hosts. `_climbStep` now writes the swim branch's
  own two lines before its `return true` - the climb is the other
  disjunct of the very statement that zeroes `moveDirection`
  (`PlayerMotor.cs:322-326`) - with the mirrored half-speed line, not a
  constant (`:168-181` still compares against the stale `UpdateSpeed`
  field). No departure is claimed: DFU refreshes `grounded` at the top
  of the next `FixedUpdate` (`PlayerMotor.cs:278`) from the
  `collisionFlags` `ClimbingMotor.cs:767` writes after the climb's own
  `controller.Move`, so the port's live `grounded` IS DFU's answer, one
  step lagged on both sides. The `freezeMotor` return stays bare on
  purpose and is asserted bare: `PlayerMotor.cs:296-306` does not zero
  `moveDirection`, so a write there would be the divergence. The
  finding's headline fatigue-band consequence was FALSE and is not
  repeated - `worldTick.js:493-494` is climb-first, matching
  `PlayerEntity.cs:406-408`.
- *Review round:* fixup. The "without the bob" half of the `feetAt`
  pin was vacuous - the fixture minted no bob, so both bob mutants
  survived - and mints one now; the lane's in-file "KNOWING DEPARTURE"
  (DFU returns at `:326` without refreshing `grounded`) was a false DFU
  claim adopted from one refuter against the other's correction, and
  is replaced by the refresh above; the refuters' census over the three
  `moveDirection`-zeroing returns is pinned (deleting the swim branch's
  write reddens the climb file now, not only AUDIT 64's swimmer pin).
  Thirteen mutants at review, two survived, both dead now.

### The host seams (host-seams: HP-1, MC-1, SL-2, SL-3)

- **HP-1 (= UI-2's host half = XL-3).** MAC1 J's `hooks.relock`
  reached three of the FIVE pause-hook literals, and `ui/pauseDoor.js`
  optional-chains it, so the other two failed silently and still
  relocked a frame late through the look gate - outside the transient
  activation the browser requires, which is the double-click itself.
  Three edits: `exterior.js`'s own `togglePause` literal;
  `exterior.js`'s `createWorldModes` bag, so worldModes' `relock:
  host.relock` stops resolving `undefined` on ?exterior; and
  `dungeonContext.js`'s literal, which OWNS NO CANVAS and so takes the
  relock through `opts` the way `hudMessageSink` does, handed in by
  both dungeon hosts. The dungeon door is the most-played of the six
  flows - `world.js` gates its Escape ladder on exterior mode, so
  underground the key falls to `routeKey` -> `ui/input.js`'s Escape
  case. `openPauseFlow` hands the same hooks to the classic window, so
  the three new sites feed both skins. The standalone `interior.js`
  viewer owns no pause door, no townTalk, no weapon rig and no foe
  pool, and is out of all four seams by name.
- **MC-1.** `exterior.js` never set `townTalk.hudMessageSink` - only
  `world.js` did - so on ?exterior every `PopupText` line the street
  and its shops spoke was dropped from the Notebook's Messages page, a
  page that host wires up and can open. DFU files off the
  `GameManager.Instance.PlayerEntity` GLOBAL in both tails
  (`PopupText.cs:123`, `DaggerfallHUD.cs:371`), where no host can fail
  to file. One line, same post-questBridge block and same order as
  `world.js`. The mid-screen half was never permanently dead -
  `midScreenText` is a module singleton that `dungeonContext` re-points
  on the first dungeon entry - and that is the second half of this
  item: EVERY ALLOCATION HAS AN OWNER, so the borrow is read first and
  handed BACK in `destroy()` beside the four other `_prev*` restores.
  Handed back, not nulled (one refuter said null): the previous holder
  is the outer host's own townTalk sink, set once at boot before
  `createWorldModes`, so a bare null would have re-opened MC-1 above
  ground from the first dungeon exit onward. The lane flagged the
  deviation; the reviewer upheld it and a mutant pins it.
- **SL-2.** DFU has ONE `WeaponManager` for every `WorldContext`
  (`SerializablePlayer.cs:175-176` writes the pair, `:420-421` restores
  it); the port has four rigs and IS1 routes the inside-a-building save
  to `world.js`'s composer, which read its own EXTERIOR rig
  unconditionally - so an F9 pressed in a shop recorded the street's
  sheath and hand and the load wrote them back into the street's rig,
  while the rig actually in the player's hands was in no envelope at
  all. `worldModes` gains `weaponPose()` - interior mode ONLY, null in
  exterior AND dungeon mode, where dungeonContext owns the whole pair
  already - and `applyWeaponPose(pose)`, presence-gated, flag-only (the
  rig's per-frame `syncWorn` is DFU's `UpdateHands` + `ApplyWeapon`,
  `WeaponManager.cs:699`) and deliberately UNGATED by mode, because
  `worldQuickLoad` exits to the exterior first and re-enters the
  building after. `exterior.js`'s fourth rig is named and not wired:
  that host has no save path at all (its charter). LEDGER A carries the
  row the refuters conditioned this on: the four rigs never share state
  at a transition - walking into a shop with a drawn weapon still finds
  the interior rig sheathed and right-handed, no save involved - and
  SL-2 closes the save half only.
- **SL-3.** `entity.pickpocketAttempted` is recorded in its own module
  header as living on the live foe and dying with the pool "as DFU's
  does" (`player/mobileEnemyActivate.js:44-47`), and it does for the
  re-minting pools - `exteriorFoes.js`'s `restoreWorld` goes through
  `spawnFoe`, and the interior pool is the same factory.
  `dungeonContext.applyWorld` patches the LIVE foes in place, so a
  same-dungeon reload kept a raised latch and a failed pickpocket could
  never be retried, falsifying the header. DFU's load re-instantiates
  every enemy (`SerializableStateManager.cs:404-425`, `InstantiatePrefab`
  per record), so `EnemyEntity`'s default is the loaded truth for all of
  them. The fix is a PRE-PASS over the WHOLE live pool at the top of
  `applyWorld`, not a line in the per-record loop - that loop visits
  only the indices the record carries, and a quest foe spawned after
  the save would have kept its latch. The pin mounts `applyWorld` over a
  pool longer than the record and asserts both a recorded and an
  unrecorded foe come back pickpocketable.
- *Review round:* fixup. The three NEW relock hooks were pinned for
  presence only - `relock: () => {}` survived at all three - and are
  pinned by what they relock now (each hook is called through the
  mounted literal and must reach `requestLook` with its host's canvas);
  six cite-only edits from the lane's reverted mapper pass were still on
  disk and went back to base for the one mapper run; the Ledger A row
  was a promise in the draft and is written. Twenty-five mutants at
  review, three survived, all dead now.

### The activation ladders (activation: HP-2, HP-3, MC-2)

- **HP-2.** The world-hosted dungeon's `ActivateMobileEnemy` arm mounted
  its pickpocket MessageBox into `mountInterior`, the INTERIOR window
  slot, which that host's dungeon frame never draws, ticks, keys or
  clicks; an `ActionTextBox` has no timer, so the box orphaned there and
  surfaced on the next building entry (the refuters' correction - not
  "for the rest of the session"). It goes to `dungeonCtx.hudBox` now -
  `pushDungeonWindow`, the stack the standalone `dungeon.js` already
  calls and the port's spelling of `DaggerfallUI.MessageBox`'s
  `uiManager.TopWindow` (`PlayerActivate.cs:1640/:1646` ->
  `DaggerfallUI.cs:1328-1330`), which underground is the dungeon's. One
  refuter's `mountServiceWindow` would also have worked (the same push);
  the other's named door was taken under ONE DFU MEMBER, ONE EXPORT.
  Pinned by RUNNING the shipped arm off the source with spies on all
  four candidate sinks, plus the standing rule that no `mountInterior(`
  appears in the dungeon ladder at all.
- **HP-3.** The same arm's HUD half was `say(t)`, townTalk's outdoor
  PopupText queue, so the Info line and "You are not successful." opened
  a second seven-row column over the dungeon's own - both queues paint
  on a world-hosted dungeon frame. It is `dungeonCtx.hudSay(t)` now, the
  one queue `dungeon.js` speaks to; DFU has one PopupText per HUD.
  Unconditional, no `?.` and no `??`: the refuter's correction is law
  here, and the pin asserts the townTalk spy records ZERO, which is what
  kills the `??` form (`hudText.add` is void, so the fallback fires both
  columns - and the lane's own first spy returned a value and let that
  mutant live, until mutation found it). Not pixel-verified: both
  columns are the same `HudText` class drawn at different scale seams,
  so the overprint is near-certain rather than observed.
- **MC-2.** `midScreenText.js` names eleven DFU `youAreTooFarAway`
  sites and the port could reach five, because `activate.js` pre-gated
  the PICK: a target past its own reach was dropped before any host saw
  it, so a door, action door, shelf, ladder, chest, pile or body at five
  units answered with silence and let the click fall through. DFU rays
  once to `RayDistance` and gates inside each handler. Each family now
  competes for that one ray carrying its handler's `reach`, and every
  ladder speaks the refusal and consumes - `:503`, `:688`, `:852`, `:872`
  and `:940` are ported; `:330` stays the recorded delta, and an action
  RECORD keeps the narrow pre-gate because `:380-383` is silent (levers
  and platforms gain no line). No new export: the refuters' correction
  against `pickActivatableHitFar` is followed. The mandatory companion
  landed with it: F33's near/far pair is ONE call at the ray's reach
  against the ladder's winner, since the far half ran with `nearerThan`
  Infinity. And the lane's own first draft had a regression the finished
  lane caught: the outdoor hosts kept `_dropPick = _lootPick ? null :
  pick(piles)`, inert while each pick dropped its own out-of-reach
  target, wrong once both reach for the ray - a body across the room
  suppressed a pile at arm's length; the two picks are decided by
  distance now. LEDGER A: the corpse's Info arm is still absent
  (`youSeeADead` is unported), so in Info mode a body past 3.75 now
  speaks the refusal where DFU speaks "You see a dead X" - silence
  replaced by the wrong line, not invented behaviour.
- THE FOUR HOSTS: `world.js`, `exterior.js`, `worldModes.js` (tryEnter's
  static door and both ladders), `dungeonContext.js` (its piles and
  bodies, and the hover plaque, which applies the reach itself so it
  cannot name a chest the click will refuse) and the standalone
  `dungeon.js` wired; the standalone `interior.js` flagged by name - it
  runs no activation ray at all, and a pin says so.
- *Review round:* fixup. `:503` had been ported for one of three
  static-door ladders - the interior and dungeon EXIT doors are the same
  `ActivateStaticDoor` (`:364-369`, gated `:501-504`) and reach for the
  ray too now (the refuters' own scope miss; the untrue sentence was the
  lane's); the collapse's rival was pinned by prefix, so `Infinity` in
  any ladder stayed green - the full call text is pinned in every host
  now; the body/pile tie, the shelf cite (both C# shelves) and the
  standalone refusal's return (consumed, no key) followed. Twenty-six
  mutants at review, five survived, all dead now. And the Ledger A row
  the brief conditioned MC-2 on - the corpse's Info arm - is written.

## Integration

Two rounds, because the Opus session limit fell in the middle of the
review round and reset sixteen hours later. Round one (2026-09-11) merged
the eight lanes whose reviews and fixups were complete - saveload-core,
hudlarge, ui-pause-controls, water-pins, renderer, swim, ui-windows,
small-seams - onto the stub; `tools/citeShift.mjs --base 583346e3
--apply --struck` moved 198 cites over 58 targets in one run, and the 19
it left for a person were resolved by content: four `pauseWindow.js`
cites that were already wrong at the base (the mapper renumbers a wrong
number onto a differently wrong line), the renderer's `setClearColor`
self-cite (a bare `:N` inside its own file, which the mapper does not
spell), and two escaped-regex cites in tests (`dungeon\.js:451`,
`worldModes\.js:474`), which the mapper cannot see - the CS1 edge AUDIT
64's integration hit first. The Suite line restamped once; the full
suite green over the merged tree. Round two (after the reset) took the
five remaining reviews and the activation lane, merged onto round one's
commit as the mapper's next base, and put RS-10's reorder in by hand
once the motor-view lane's edit to the same call had landed.

Main moved under the audit while round one was in review: TI2 (the
touch layer), MWA1+FPS1 (the Morrowind arms at boot, the FPS counter)
and main's own cite commit landed as PR #80 and #81. Merging them into
round one's commit met the mapper's one-base rule from the other side:
the merged tree carried lines at main's numbers and lines at ours in
the same files, and no `--base` fits both. Normalising both sides back
to the stub and mapping once was tried twice and double-shifted what
the pair tables could not see (the `/:N` and `` `:N` `` continuations,
the hand-resolved cites, the `autoBuildArms` import once); the third
pass mapped each line from the side it came from - `tools/citeMerge.mjs`
(CS2, pinned in `citemerge.test.js`), which reads a line's provenance
(verbatim in main's file, else in ours), maps it with citeShift's own
hunks, spellings and content check, and moves the bare continuations
citeShift only reports, up to the next cite of any file. 68 cites
moved; four held, all four right where they stood (a row whose own
cites had moved, a C# `:1270` after a port cite). Thirteen conflict
hunks, all in bible rows, took main's block. One code reconciliation:
MWA1's `autoBuildArms` runs at every door a made character arrives
through, and XL-6 had taken the sizes out of the boot count that gated
it - so the rig measures the store first (`registerMorrowindData`) when
no fingerprint is down, as the pane's Build button does, and MWA1's pin
follows the new signature. PERF1-3 (#82, #83) landed on main an hour
later and merged the same way, one run: 107 cites moved, the same two
held. Full suite green over the merged tree; that commit is round two's
base.

Three fixups were done by hand between the rounds, from the reviewers'
exact findings, because the lanes that owned them had died at the
limit: the ui-pause-controls fixup that was half on disk, the
small-seams block (the counted-then-attached set), and the ui-windows
seam pin. Each was mutation-checked the way the lane would have been.

Round two's six lanes were merged onto the stub in a worktree of their
own, each with its reviewer's fixups applied there by hand and
mutation-checked (the wheel lane's four, the host-seams lane's six and
the activation lane's twenty-six hand-bumped cites first put back to
the stub's spellings), and the union mapped ONCE - not with
`citeShift`'s one base, which a six-lane union has none of, but by
provenance over seven sides: a pre-existing line is the stub's (a lane
that shifted a target without touching the line leaves it stale in its
own tree, and the map from there is content-preserving and still
wrong), a line a lane wrote is that lane's, and a line written at
integration is its commit's. 203 cites moved, two held and right; the
bare continuations and escaped literals no mapper sees were resolved by
content, as in round one. Two Ledger A rows landed there (the four
weapon rigs; the corpse's Info arm), with the section 2 identifiers and
both tallies following them. Main had moved four more times under round
two (PERF7-9 and the mobile experience, #88-#90), so the union merged
into main through `citeMerge` as round one had: 319 cites moved,
fourteen held and read - the deleted-seam clause a mapper cannot know
is historical put back by hand, which is what CD4's `NO_LINE_LEFT` pin
is for. RS-10's reorder was not made: PERF2 draws every sky pass at the
far plane, depth-tested and without depth writes, in all three sky
renderers, so the body drawn before it is no longer overdrawn - the
finding closed under the audit.

## What was left, and by whose decision

- **The four weapon rigs never share state at a transition** (saveload,
  found beside SL-2): drawing a weapon outside and walking into a shop
  finds the interior rig sheathed and right-handed with no save
  involved. SL-2 narrows the SAVE half; the Ledger A row is written,
  and the transition half is open by decision - the one-manager shape is
  the next slice through `worldModes.js`.
- **The enemy's obstacle cast is measured at the PLAYER's radius**
  (constants, found beside CV-2 at review): `enemyMotor.js` derives
  `ObstacleCheck`'s distance and cast radius from `CAPSULE_RADIUS` 0.35
  where `EnemyMotor.cs:1144/:1154` read the enemy's own
  `controller.radius`. Left with the foe-0.45 question it belongs to.
- **Two more invented member names over correct law** (cites, found at
  review): `CollapseFromExhaustion` in `exterior.js` and `world.js` -
  DFU's handler is `PlayerEntity_OnExhausted` (`PlayerEntity.cs:2380`;
  the cited `:2397` is exact) - and `PlayerGPS.SetWorldLocationRect` in
  `streamingWorld.js`, whose member is `CalculateWorldLocationRect`
  (`PlayerGPS.cs:633-659`). RC-2's shape twice more; a follow-up.
- **Four windows route a notch by a point seeded before the first
  mousemove** (wheel): `automapWindow`, `mouseControlsWindow`,
  `nativeTalk` and `itemMakerWindow`, flagged in place and not wired -
  the live point the hosts hand them is discarded.
- **The skills dialog draws two tokens where DFU draws three**
  (constants, found beside CV-1): `TextProvider.cs:505-508` adds the
  primary stat's abbreviation at +112. A follow-up, not this audit's.
- **The foe capsule's 0.45 is skin-inflated** (constants, found beside
  CV-2): the enemy prefab's query radius is 0.40; the recorded 0.45
  adds `m_SkinWidth`, which Unity does not. Left standing because AUDIT
  62's record pins it; a separate finding against that record.
- **`biography.js:200/:264` cite `BiogFile.cs` one line early** (cites)
  - consistent drift, and the sentence between them says 'one line
  after' where the gap is three; a decision for the biography slice.
- **`townTalk.js`'s person arm takes no collider** (activation, found
  beside MC-2): MC-2 made it better, not worse - the door at arm's
  length wins on distance now over an unoccluded person beyond it - and
  the residual is `rayPersonDistance` itself, so a townsperson genuinely
  nearer, behind a wall, still eats the click.

## The cost

The audit fleet: nine finders and fourteen refuters, about five million
tokens of reading. The fix fleet: fourteen lane passes (the activation
lane twice - the first died at the limit), fourteen reviews and three
Opus fixups, about 6.3 million tokens, with the rest of the fixups done
by hand from the reviewers' exact findings - three in round one while
the fleet was paused, six in round two because each was a page of
findings and not a lane's worth. Fifty-three agents, all Opus, about
11.3 million tokens. Integration solo: four merges of main, two mapper
tools written on the day, and one union mapper still in scratch.

## Lessons

- **The refuter pair is the brief.** Fourteen refuter reports rewrote
  the fix for eleven of the thirty-three confirmed findings: the
  spellbook clock as a seam, not a reordered signature (five nested
  callers pass a font in that slot); the relock hook threaded through
  `dungeonContext`'s deps because that context owns no canvas; the
  too-far refusal as the bulletin board's one-pick idiom, not a second
  pick that would have let a far door pre-empt a near foe; `hudSay`
  unconditional, because `?? say(t)` would have fired both queues.
- **A finder measures; a refuter re-measures.** The critical finding
  (the frozen exterior swimmer) was measured by the finder at dz 0.000
  and by both refuters at 0.103 and 0.000 - the same defect, three
  harnesses, and the first two frames explain the difference. The
  number in the record is the refuters'.
- **Give each refuter its own worktree.** Two pins refuters mutated the
  one checkout at once and each saw the other's mutants as a red HEAD.
  One of them moved to a worktree on its own; the rule is written down
  now.
- **Two mapped sides need a provenance map, not a common base.** The
  mapper's "run once per base" rule has a mirror: a merge of two
  branches that each ran it is two bases in one tree, and the only
  question that resolves a line is which side wrote it. Three passes
  and one tool (`citeMerge.mjs`) to learn that; the next merge under an
  open audit runs the tool once.
- **A union of lanes has no one base.** citeShift's contract is a tree
  where every cite was right at the base; six lanes on one stub give
  seven trees where different lines were right. The rule that held:
  the stub owns the lines it carries, a lane owns the lines it wrote,
  integration owns the rest - and a lane's own tree is NOT a base for a
  line it left stale, however content-preserving the map from it looks.
- **A reviewer reads the record, not only the diff.** Four of the six
  round-two fixups were words: a row that misstated its own evidence, a
  false DFU departure adopted from one refuter against the other, a
  claim that `:503` was ported where two ladders still mint without a
  reach, a standing sentence quoting a seam that had just changed shape.
  The lanes' code was right where their sentences were not, and the
  sentences are what the next reader reads.
- **Escaped literals and historical numbers are not cites.** CD4's
  `(\d+)-2270` range ends, the deleted-seam clause, the citeShift
  fixtures - each moved (or had to be un-moved) at every one of the
  day's four merges, because no mapper can tell a number that names a
  line from a number that names a memory. The pins that catch them
  earned their keep four times over.
- **A split verdict is a refutation, and the surviving half still has a
  home.** Eight findings split; each is recorded above with the half
  that stood, so the next slice through that file takes it without a
  new audit.
