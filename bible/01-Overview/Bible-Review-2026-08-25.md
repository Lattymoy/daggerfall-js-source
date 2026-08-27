# THE BIBLE REVIEW (2026-08-25)

Mac asked for the bible to be reviewed. This page is the record.

AUDIT 24 read the port against its C# originals; AUDIT 25 read the DFU
tree against the port. This review reads the BIBLE against the tree:
all twenty pages (~25,900 lines), every checkable claim - file paths,
exported symbols, test files, counts, and every sentence that asserts
present-tense state ("pends", "absent", "INTERIM", "FLAGGED", "no
consumer", "0%") - verified against today's `src/`, `test/` and
`tools/`. Eight parallel reviewers, one per section, each told to
refute by default: a false finding is more expensive than a missed
one, so every finding below carries the evidence that survived.

Baseline at review time (HEAD 0fe3c09): `npm test` 3,382 tests, 0
fail, 188 skipped (all ARENA2 corpus gates - no game data in this
container, so no real-data claim was re-verified against the corpus);
`node tools/ledgerSweep.mjs` 33 unstruck rows, 93 struck, 20 suspect.
DFU C# citations (`*.cs`, line numbers) could NOT be verified - no DFU
checkout here - so this review checks the port side of every claim and
takes the C# side on trust.

## The verdict

**The histories are sound. The present tense is not.**

Of roughly six hundred concrete code references checked across the
twenty pages, the milestone bodies, slice records, deletion notes,
constants and pin counts verified against the tree with striking
accuracy - down to animation tables, band distances and per-file test
counts. The bible's weakness is one specific, systematic class: the
FLAGGED / RESIDUAL / queue / status sentences written before the
2026-08-23..25 sprint (B1-B7, X1-X11c, H1-H3, R1, G4-G7, M2/M4,
U33-U48, S39-S44, V1, P1, A5, W1, the automaps) were closed in code
and usually in the Port-Ledger, but never narrowed at their doc sites.
The result: **the bible now systematically understates the port.**
Nearly every stale sentence claims something is missing that ships.
That is exactly the failure Home.md legislates against - "a stale row
is worse than a missing one: it sends the next slice off to build what
already ships" - and two lanes already paid that price once (the
B1-B7 double-build recorded in Audit-25).

The proven fix direction is already in the repo: the only sections
that stayed true through the sprint are the ones a test regenerates or
pins (the Home open-flags list, 18/18 green; the Rendering module
list; the Ledger's Derived-figures block; Testing.md's manifest
table). Every hand-maintained status list rotted.

## Where the rot is worst, in order

**1. Audio.md never absorbed A5.** The largest event in its own arc -
music - is asserted absent or pending in five places (`Audio.md:21`
"HMI/XMI has NO DFU reader... the playback strategy is this arc's
first decision"; `:59`, `:110`, `:138`, `:166` "the audio queue is
MUSIC ONLY... Mac's strategy call stands"). `src/formats/hmiFile.js`,
`src/systems/music.js`, `gmSynth.js`, `songPlayer.js` all ship;
Port-Ledger row and Home both record A5/A5b SHIPPED and the 2026-08-25
FM-bank audit. Audio.md also still disowns `ActivateLockUnlock = 316`
(`:158` "NOT OURS... neither of which is ported") - it sits in
`soundClips.js:10` with three consumers (R1) - and still claims
`deps.inCastle` stays false (`:105`), live since AUDIT 21
(`dungeonContext.js:2078`). This is the one page whose live-queue
claims actively contradict the code, the Ledger, and the rest of the
bible at once.

**2. Audit-25's "systems at zero" was overtaken in five of six.** The
section (`Audit-25.md:210-273`) still reads ENCHANTING 0%, AUTOMAPS
~2% ("the word does not appear in Port-Ledger.md at all"), BANKING 0%,
PAUSE MENU + KEY REBINDING 0% - while the same page's own slice list
strikes S-C ("THE RUNTIME SHIPPED, E1+E2") and the tree carries
`systems/enchantments.js` (767 lines), `systems/automap.js` + both
automap windows, `systems/banking.js` (650 lines) + both bank windows,
`ui/pauseWindow.js`, `ui/controlsWindow.js` + `systems/inputActions.js`.
Only the classic `.SAV` reader is still genuinely at zero. The
FormulaHelper "17 absent" list (`:352`) is likewise ~7 stale
(bank loan/repayment, repair cost, identify cost, room cost, both
Daedra summoning methods all ship). The page updated its slice
sections and left its headline section standing.

**3. Home.md is two documents fighting in one file.** The mechanical
half is healthy - the 201-row open-flags list is regenerated and
pinned both ways (`audit18_bible_docs.test.js`, 18/18), every path it
names exists. The narrative half rotted: the "Active arcs" one-liners
have grown into 3-46KB single-line dumps that hand-duplicate the arc
docs, and they now omit roughly 25 shipped slices from 08-23..25
(U33-U47, B2, M2/M4, S39-S44, V1, M-TEX, U49-as-slice); the UI queue
still lists the spellbook retrofit U42 shipped (`:172`) and the music
strategy decision A5 made and Ledgered; the Audio line says music is
"Next: Mac's call" while line 172 itself records it shipped;
Audit-25's six-zeros summary stands unnarrowed at `:160`; the audits
register is missing AUDIT 19/21/22/24 entries and the audio audit
(`:605` still says "its Home.md entry has not [landed]", written
08-19). Small but telling: `:1815` "main.js is a thin scene router (37
lines)" - it is 244 lines and there is no terrain scene; `:1830` "Bible
is flat under bible/" - it is ten numbered directories; three
different files are called "the FOURTH host" across the page.

**4. Port-Ledger section C: the sweep is clean but three rows
contradict the same file.** All 20 ledgerSweep suspects verified as
VALID rows (the matcher is over-cautious - the right failure
direction). The real staleness is where the sweep cannot see:
- `:341` "**TWO LEFT**... only DaedraSummoning and ReceiveHouse are
  still null" - `guildServiceFlow.js:259/:262` maps both (G7, H1);
  the row contradicts the GATED derived figure fifteen lines above it
  ("still unbuilt: 0") and is on its FOURTH stale generation - the
  row's own title records the previous three.
- `:340` residue "a static NPC currently answers with the
  no-response line" - contradicts the same row's own head and row
  `:446` (B7); `worldModes.js:1013-1024` opens the real talk window.
- `:339` "house/ship PURCHASE popups... still out" - contradicts row
  `:441` ("this row is now CLOSED", H1-H3) and
  `ui/bankPurchaseWindow.js`.
- `:344` still lists DrinkPotion and RecordLocationFromMap among
  unbuilt UseItem destinations; row `:423` strikes both (S39/U45).
Also: `:329` (rain-loop row) physically breaks the markdown table -
it sits between the header and the `|---|` divider.

**5. The arc docs' open-flag lists - ~50 dead flags across five
arcs.** The slice histories close their own residuals properly in
prose; the standing lists were maintained inconsistently. The worst
per arc:
- *Systems-Arc*: `:1445-1454` (S27) "Open and Lock are still not
  wired" with a pin "that fails the moment either context calls
  triggerOpen" - both are called from `world/actionSystem.js:752-753`
  (X1) and the pin never fired because it greps only
  dungeonContext/interiorContext, not the file the wiring landed in
  (`mysticism.test.js:225-239`). The doc, the pin's design, and
  `mysticism.js:53`'s header are all wrong the same way. Also stale:
  S24 "the port has neither the [Spell Absorption] effect nor the
  state" (`effects.js:1037-1060` + `absorption.js:70-79` land it
  first-arm); S40's "house ledger is unported" flag
  (`banking.js:169 isHouseOwned` feeds the rest seam); S16's
  "monsters 0-42 still spawn as billboards" (C11 pivoted them to real
  foes, `dungeonContext.js:547-607`); the mid-file Queue
  (`:742-748`) still carries FreeAction / Create Item / enchantment
  value / rest-UI / "Later: guilds, shops, dialog, calendar" - all
  shipped, list actively maintained (it struck its fatigue line).
- *Quest-Arc*: the Q4-v RECORDED seams (`:1346-1360`) and the closing
  ARC'S REMAINDER (`:5022-5032`) both predate B1-B7 - dungeon mount,
  talk seams, dungeon popups, disease seams all still listed as
  pending against the Ledger's own re-swept row. Plus the one outright
  factual error found in the whole bible: `:798-805` claims "only %G
  has a capitalized handler" in DFU / "%G2/%G3 uppercase DO NOT
  EXIST" - refuted by the doc's own Wave 25 (`:2908`) and
  `questMacros.js:386-397` ("MacroHelper.cs:240-245 registers ALL SIX
  capitalized forms"); the early section was never corrected.
- *World-Arc / Player-Arc*: ~20 clauses closed by later slices still
  read "pends" - T3c's list (`:653`) has three clauses T3d/T3e/T3f
  closed in the same document (T3d literally says "the T3c flag
  clears"); guards/crime flags closed by G1-G4 stand at `:359`,
  `:445`, `:569`, `:731`; faction-rep-pends-the-clone at `:449`/`:572`
  /`:616` closed by S25; blood splash (`:802`), death screen
  (`:574`), prison day-skip (`:613`), Athleticism (`Player-Arc:576`),
  Invisibility-inert (`:689`/`:703`), jump boosts (`:734`), damage
  flash (`:764`) - all shipped elsewhere, never narrowed here. One
  WRONG flag: `World-Arc:570` "guard archers forced melee" - the flag's
  premise was refuted and retired in code (`cityGuards.js:28-30`),
  not in the doc. `World-Arc:44` cites `test-harness/
  stream-flight-probe.mjs` - no such directory exists.
- *UI-Arc*: a dozen closed flags stand (talk pages B5-6 at
  `:526-529`, bank purchase H2/H3 at `:3780`, Identify-spell X7 at
  `:3734`, guild-store arms G4 at `:3747`, controls grid U36 at
  `:3368`); `:4722` is now flatly false ("the interior host's
  char-sheet and inventory panels swallow their click and do
  nothing") and contradicts U43 in the same file
  (`worldModes.js:3690-3694` routes them). UI-Arc carries no records
  at all for H1-H3 - the banking windows exist only in the Ledger.
- *Combat.md*: the status head (first 51 lines) is the stale part -
  DrainMagicka "INTERIM no-op" (`:19`, real since S4a and
  Ledger-struck), "the equip UI pends" (`:30`), archers-fire-on-sight
  (`:32`, superseded by CH-C's 6..51.2m band), "queue is EMPTY"
  (`:47`, contradicted by the AUDIT 25 rows routed into the Ledger).
  The FP departures list holds two expired conditions (FlipHorizontal
  "until a settings surface" `:75` - Handedness ships in settings;
  weaponOffsetHeight 0 "no large HUD yet" `:76` - U45 shipped it, so
  this is now a REAL undocumented gap, the one place the rot points
  the other way). `:220-240` still presents the mirror un-mirroring as
  "a candidate slice, Mac's call" - it SHIPPED 08-23 as the handedness
  law (`mat4.js:86-110`, `test/handedness.test.js`), and the
  paragraph's mechanism account says the opposite of `mat4.js`'s.

**6. Status headers that contradict Home.** `Player-Arc.md:1`
"(COMPLETE)" vs Home "ACTIVE again"; `Characters.md:3` "PARKED" vs
Home "ACTIVE again at CH-C" and Characters-Arc's own "(ACTIVE)"
header; `World.md:3` still frames the finished T-series as the open
queue; `Systems.md:3` "S1-S22" (arc is at S44); `UI.md:3` "U1-U43"
(arc is at U50). This is the exact status-word drift AUDIT 18 was
written to correct, recurred in four places.

**7. Settings-Screen-Spec has outgrown its "ground truth" framing.**
Its §0 "Verified ground truth (do not re-derive)" tier counts read "8
live, 18 unavailable, 145 stored"; the tree says 46 / 17 / 108 - off
nearly 6x on live. ~38 keys the spec lists unmarked are now live;
AssetInjection moved from NA to LIVE. The built control also diverges
from the spec's interaction contract beyond the three deviations its
as-built header admits: enums WRAP (`settingsLaw.js:128-134`), there
is no TEXT_LAW / prompt / colour editor / Backspace-reset / digit
jumps / focus zones, and the two "required companion changes"
(`resetToDefaults` returning saveSettings; `dataSourceLabel`) were
never made. The page needs either a fresh as-built pass or demotion
from "ground truth" to "original design".

**8. Readers-Arc stopped being the registry it claims to be.** Its
post-close table ends at #12 FLATS.CFG; the tree carries VID, HMI and
BSS (each called "the tenth/eleventh/twelfth" reader by OTHER pages,
with three colliding numbering schemes between Home, Readers-Arc and
Testing.md) plus ~10 smaller readers (fntFile, bookFile, textRsc,
woodsFile, rumorFile, biogFile, classFile, factionFile, magicDef,
spellsStd) with no rows. Testing.md's prose tail has the same
disease: "805 pass / 120 skip" (today: 3,194 / 188), with the
retired "88 pass, 49 skip" figure still standing five lines above its
own AUDIT-18 correction.

## Found in passing: the code side

Doc review only, nothing fixed - but four code comments assert the
opposite of their own code and deserve a slice's attention:
- `src/ui/deathScreen.js:42-43` claims "`drop` is read by each host's
  frame" - no host reads it (the Ledger row `:361` is right, the
  comment is wrong).
- `src/systems/mysticism.js:53` header "OPEN AND LOCK ARE NOT WIRED" -
  they are (X1, `actionSystem.js:752-753`).
- `src/systems/regionPower.js` "alliance mutators... which the port
  does not have" - `factionRelations.js` ships them (S44).
- `src/combat/fpsWeapon.js:22` weaponOffsetHeight 0 - now a real gap
  (see Combat.md above), not a moot one.
- Systemic tool-name error: Combat.md `:117`, `.gitignore:37` and
  `public/README.md` all say the silver/steel galleries regenerate
  with `tools/fpProbe.mjs`; the shots come from
  `tools/fpsWeaponProbe.mjs` (fpProbe guards the PARKED voxel path).
- The S27 mysticism pin greps the wrong files (see above) - a pin
  that structurally cannot fire. A PIN MUST FAIL.

## Line-citation drift (low, batched)

`Port-Ledger.md:443` (save.js:27/:444/:453 → :28/:471/:501), `:450`
(world.js:1613 → :2409); `Quest-Arc.md:719`/`:2904`
(worldModes.js:451 → :903); `Player-Arc.md:947` (worldModes.js:596 →
:2764), `:304` (world.js "531 lines" → 3,564); `Characters-Arc.md:190`
(CHAR_PIXEL "7" - `renderer.js:401` ships 9, and the doc missed two
later revisions recorded in `paperdollViewer.js:138`), `:2114`
(interiorContext.js:131 → :199); `Rendering.md:37`
(CHAR_SPRITE_RT_SIZE "256" → 512).

## What checked out clean

So the next reader knows what does NOT need re-verifying: every named
module, test file, probe and deletion in Rendering-Arc, Testing.md's
manifest table (pinned live), Audit-24 (a historical fix log - checks
out completely), Port-Doctrine (fully consistent with the tree, its
non-negotiables genuinely test-enforced), the Quest-Arc and
Systems-Arc slice histories from S40 onward, Talk-Arc (two low count
drifts and one half-closed pending), the World/Player milestone
bodies M1-M9/P1-P18, the Characters data tables (42 monster attack
sequences, 13 casters, band constants - exact), and the ledger's
Derived-figures gate (`test/ledger.test.js`, 4/4, doing precisely
what it advertises).

## The recommendation

One narrowing pass, ordered by cost of a false "unported" claim:
Audio.md's five music sentences and the 316 row; Audit-25's zeros
section (+ Home `:160`); Ledger rows 339/340/341/344 (+ the `:329`
table break); the S27/S24/S40/S16 paragraphs and the Systems-Arc
queue; the Quest-Arc %G section and its two remainder lists; the
~20 World/Player flag clauses; the UI-Arc dozen (+ an H1-H3 record);
Combat.md's head; the five status headers. Then the structural fixes
the sprint proved necessary: shrink Home's arc lines back to the
one-line pointers Home itself says they are (or pin them the way the
open-flags list is pinned - the only doc discipline that survived
contact with a 25-slice sprint), give Readers-Arc its missing rows
under ONE numbering scheme, and re-baseline or demote
Settings-Screen-Spec §0. Fix the S27 pin so it greps the tree, not
two files - a pin must fail.

Every stale sentence above understates the port except one
(weaponOffsetHeight). The bible's histories can be trusted; its
open lists currently cannot, and the ledgerSweep + derived-figures
machinery is the template for making them trustworthy again.
