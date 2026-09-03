# Port Status 2026-09-02 - 1:1 against Daggerfall Unity, re-measured

- ~~**`src/systems/skills.js:164`** - "AUDIT 18: the +10% used to be
  INTERIM 0 behind a flag blaming a decode that had ALREADY
  SHIPPED".~~ **CLOSED (ROAD-F GS2, 2026-09-03).** *The work was
  already done - D9 shipped `AcrobatMotor.cs:96-101`'s nested
*The state of the tree at the campaign's closing head (the commit that carries this page; the figures below were first taken at `c3c12ee` and re-taken at the close), after the Road-to-1:1
campaign (`Road-To-1-1.md`; audited in `Audit-49.md`). Supersedes
`Port-Status-2026-09.md`, which measured `6881171` - the tree AUDIT 44
found, before its 166-defect fix wave and before the campaign. Every
figure below was re-derived by running a command against this tree and
against the reference clone at `/home/user/openmw/dfu`; where a figure
in the superseded page does not reproduce, the new number is given with
the method and the old one is named as corrected.*

**How to read this page.** It is a MEASUREMENT, not a plan. The
superseded page was written as an audit's evidence file and carried its
166 confirmed defects inline; this one carries none, because they are
closed and their record is `Audit-44.md`. What this page is for is the
three lists at the bottom: the **19 open flags** (10 after Wave E's seven
closures and QX1's eighth - list 1 marks them) with the blocker the
closeout triage assigned each, the **Port-Ledger section C rows still
routed and not struck**, and the **deliberate departures that are not on
the road**. Everything above those lists is the measurement that makes
them readable. `Port-Completion-Analysis.md` (snapshot 2026-08-22) stays
superseded for volume figures.

---

## The one-sentence version

The law is still the strongest thing in the tree and the campaign did
not need to touch it; what the campaign moved was the **wiring** - the
class AUDIT 44 named - and what remains is no longer a list of defects
but a list of **nineteen sites with a named blocker, fourteen ledger
rows that still owe work - six of them stale under the campaign that
ran past them - and a set of departures that were never on the road.**
Wave E then worked that list down to **twelve sites and six rows**,
which is what lists 1 and 2 now record; the paragraph above is the
measurement as taken, kept because the two lists are read against it.

---

## The measurement

| | at `6881171` (superseded page) | at the close (this page) | method |
|---|---|---|---|
| `src/` modules | 477 | **501** | `git ls-tree -r <sha> --name-only \| grep -c '^src/.*\.js$'` |
| `src/` lines | 164,220 | **186,438** | same list, concatenated through `wc -l` |
| test files | 529 | **588** | `git ls-tree -r <sha> --name-only \| grep -c '^test/.*\.test\.js$'` |
| suite | 5,110 tests | **6,050 tests, 5,841 pass, 0 fail, 208 data-gated skips** | `node --test` at the close |
| open flags | 151 | **7** | `node tools/regenOpenFlags.mjs --check` answers 7 ("7 entries, up to date"). It answered 19 when this table was taken - 17 at `c3c12ee`, plus the two the closeout tail's spell-hand port added - Wave E then retired six, named in list 1, the ship landing a seventh, ROAD-F three more (GS1 `scenes/worldModes.js`, GS2 `systems/skills.js`, DR1 `scenes/dungeonContext.js`), and QX1 the next (`scenes/exterior.js`'s PX3, struck in list 1); the same grep over `git show 6881171:bible/Home.md` returns 151 |
| ARENA2-gated tests | 199 | **207** | the runner's own `# skipped` line |

Both volume figures reproduce the superseded page exactly at its own
commit, which is what makes the delta trustworthy: the method is the
same command. Between the two commits sit **207 commits, 451 files
changed, +55,758/-3,999** (`git rev-list --count 6881171..HEAD`, `git
diff --shortstat`) - `src/` 212 files `+24,781/-3,102`, `test/` 202
files `+26,737/-616`, `bible/` 22 files `+1,369/-263`. The suite grew
faster than the source, which is the campaign's signature and also its
largest defect class (`Audit-49.md`: 37 of 118 confirmed findings are a
pin that cannot fail).

`bible/09-Testing/Testing.md:4` says 6,016 tests across 588 files - one
behind the runner, and the smallest stale record in the tree.

---

## Coverage against DFU's surface

The superseded page judged coverage lane by lane from 32 finder
reports. This page derives it mechanically instead, from the port's own
citation discipline: **every ported law names the C# class it comes
from**, so a DFU class whose name appears nowhere in `src/` is a class
the port has not read. The sweep is
`for f in <dir>/*.cs; do grep -rqlF "$(basename $f .cs)" src/; done`,
run over every non-Unity directory of `Assets/Scripts`. It is a LOWER
BOUND, and the bound has to be said out loud: a law ported under the
port's own name and cited only in prose reads as a miss. Every miss
below was therefore opened by hand, and most of them close that way.

| DFU directory | cited / total | what the misses are |
|---|---|---|
| `API` | **46/50** | `DFValidator` (206 lines), `PowerOfTwo` (72), `DFSound` (41), `PatchList` (50) |
| `API/Save` | **14/14** | - |
| `Game` | **53/63** | `FPSSpellCasting` (324) is the one that matters; the rest are Unity glue (`PlayerCollision`, `PlayerCollisionHandler`, `ConstrainRotation`), superseded widgets (`FPSCrosshair`, `PlayerCompass`), the localisation layer (`StringTableCSVParser`, `StringTablePatcher`), `DaggerfallUIMessages`, `NewLocationAlert` |
| `Game/Entities` | **9/12** | `CivilianEntity` (30), `DaggerfallResistances` (178), `DaggerfallStatsMCP` |
| `Game/Formulas` | **1/1** | - |
| `Game/Guilds` | **11/11** | - |
| `Game/Items` | **9/9** | - |
| `Game/MagicAndEffects` | **9/11** | `EntityEffectMCP`, `MagicAndEffectsStructs` |
| `Game/Player` | **16/16** | - |
| `Game/Questing` | **15/15** | - |
| `Game/Questing/Actions` | **82/82** | - |
| `Game/Serialization` | **8/9** | `PrintScreenManager` |
| `Game/UserInterface` | **45/55** | DFU's retained widget toolkit: `Paginator`, `MultiTextBox`, `ImageLabel`, `ScreenComponentCollection`, `HUDPlaceMarker`, `HUDQuestDebugger`, `FolderBrowser`, `UserInterfaceRenderTarget`, `VideoPlayerDrawer`, `Enumerations` |
| `Game/UserInterfaceWindows` | **67/85** | see "The windows" below |
| `Game/Utility` | **12/12** | - |
| `Game/Weather` | **1/1** | - |
| `Terrain` | **8/11** | `SimpleTerrainSampler`, `NoiseTerrainSampler` (alternate samplers DFU does not ship as default), `JobHelpers` |
| `Utility` | **24/35** | Unity presentation and text infrastructure: `ModelCombiner`, `TextureAtlasBuilder`, `TerrainAtlasBuilder`, `RetroRenderer`, `RetroPresentation`, `CameraClearManager`, `FastColorPalette`, `DefaultTextProvider`, `FallbackTextProvider`, `EnhancedKeyedCollection`, `Tuple` |
| `Utility/AssetInjection` | **5/9** | `BookReplacement`, `TextAssetReader`, `VideoReplacement`, `XMLManager` - the mod system, a departure |
| `Localization` | **3/4** | `LocalizationEnums` |
| `Assets/Scripts` root | **11/15** | `DaggerfallUnityApplication`, `DaggerfallUnityInterfaces`, `DaggerfallUnityStructs`, `GenerateDiagLog` |

The effect tree, by school:

| school | cited / total | what the misses are |
|---|---|---|
| Alteration | **7/7** | - |
| Destruction | **12/28** | 15 per-attribute `Drain*`/`Transfer*`, plus the abstract `VampiricFortifyEffect` |
| Diseases | **22/22** | - |
| Enchanting | **24/24** | - |
| Illusion | **10/10** | - |
| Mysticism | **10/10** | - |
| Poisons | **1/1** | - |
| Restoration | **13/27** | 12 per-attribute `Fortify*`/`Heal*`, plus the abstract `FortifyEffect` and `HealEffect` |
| Special | **12/13** | `RingOfNamiraEffect` |
| Thaumaturgy | **10/11** | the abstract `DetectEffect` |

**Not one effect class is a gap.** The 27 uncited per-attribute classes
are the method's blind spot working as designed: DFU writes one class
per attribute and the port writes one data-driven family per group -
`SPELL_MAKER_EFFECTS` carries `Drain` 8 rows, `Transfer` 10, `Fortify
Attribute` 8 and `Heal` 10, 36 rows over 27 classes, the four extra
rows being the Health and Fatigue variants DFU also has. Four of the
remaining five misses are abstract bases with no concrete counterpart
to port (`VampiricFortifyEffect`, `FortifyEffect`, `HealEffect`,
`DetectEffect`). The fifth, `RingOfNamiraEffect`, is ported under its
in-game name: `combat/formulas.js:677` runs it at DFU's own dispatch
site and `systems/artifactEffects.js` owns the reflection, wired at
`systems/worldTick.js:33`.

The same hand-check disposes of the loudest-looking misses elsewhere.
`DaggerfallResistances` is `spellcast.js:88`'s `elementalResistanceChance`;
`NewLocationAlert` is `systems/discovery.js:123`'s `discoverLocation`;
`CivilianEntity` and `MobilePersonNPC` are `characters/mobilePerson.js`
(whose `SetPerson` face tables D10 took at `:42`); `PlayerCompass` is
`ui/hud.js`'s HUDCompass port. Exactly two misses survive the check:
the pair of input-config windows in the next section, and this one.

**`FPSSpellCasting.cs` (324 lines) is uncited in `src/`, and the miss is
real.** Its `OnReleaseFrame` semantics are ported and live
(`scenes/hostMagic.js` consumes the release frame at four sites,
`scenes/hitEffects.js:60` cites it), but `PlayOneShot`, `SetCurrentAnims`, `AlignLeftHand` and
`AlignRightHand` - the five element hand animations classic draws over
the view when a spell fires - have no port. `combat/fpArm.js` draws a
spellcast in the Morrowind lane (MW-D39) and nothing draws one in the
classic lane.

---

## The windows

`ls Assets/Scripts/Game/UserInterfaceWindows/*.cs | wc -l` is **85**.
Three are not windows (`UIWindowFactory`, `WindowMessages`,
`HardStrings`), three are abstract bases (`DaggerfallBaseWindow`,
`DaggerfallPopupWindow`, `DaggerfallQuestPopupWindow` - all three cited
anyway), eleven are the Unity post-processing config pages plus
`GameEffectsConfigWindow`, two are DFU's own demos, and one is DFU's
first-run setup wizard. That leaves **65 concrete game windows**, of
which **63 are cited in `src/`**.

The two that are not: **`DaggerfallJoystickControlsWindow`** and
**`DaggerfallUnityMouseControlsWindow`**. Both are recorded pending in
the same place - `Port-Ledger.md:568`, the struck keybinding-registry
row, whose surviving clause reads "STILL PENDING: the mouse/advanced and
joystick sub-windows (both answer with a note - no gamepad layer)". The
other half of that clause, key combos, shipped at ROAD-A A8.

Two windows the campaign built are the reason this figure moved at all.
The superseded page listed "the multi-slot save/load window and the
native automap windows (AMAP00I0/TOWN00I0: the 3D view, render modes,
note markers, teleporter portals)" as "the two largest genuinely-unbuilt
reference surfaces". Both ship: `ui/saveWindow.js` (782 lines, ROAD-C
C1) and the automap pair - `ui/automapWindow.js` 1,504,
`ui/exteriorAutomapWindow.js` 1,072, over `systems/automapModel.js` 282,
`ui/automapCamera.js` 606, `ui/automapChrome.js` 349,
`ui/automapMarkers.js` 530 and `systems/automapPick.js` 399 (ROAD-C C2,
ten stages in two flights). 5,524 lines of window that did not exist
when the superseded page was written.

~~One window is drawn in a different idiom and says so: the spell maker.~~
**CLOSED (E-group, 2026-09-02): the spell maker is native too.**
`ui/spellMakerWindow.js` is DaggerfallSpellMakerWindow on INFO01I0.IMG
with the MASK01I0 selected-state marks and
DaggerfallEffectSettingsEditorWindow on MASK05I0 beside it - DFU's hit
rects digit for digit, its tip label and lock quirk, the eighteen
SpellMaker* shortcut bindings, and the classic 1702-1708 boxes. The
departure that had no Ledger row is retired rather than given one.

---

## The effect library

`SPELL_MAKER_EFFECTS` is **91 rows across 39 groups, 0 inert**
(`node -e` over `src/systems/spellEffects.js`; the same two numbers are
gated against `Port-Ledger.md`'s derived-figures block by
`test/ledger.test.js:43`). The inert count was already 0 at the
superseded page and stays 0: nothing the spell maker offers cannot fire.

`SERVICE_DESTINATION` is **20 guild services, 0 with a null
destination** (`systems/guildServiceFlow.js`, gated by
`test/ledger.test.js:54`).

The superseded page's two magic gaps are closed and verified here:
`minimumCastingCost` is live at `systems/spellcost.js:181` and is
written by both curses (`systems/vampirism.js:151`,
`systems/lycanthropy.js:199`), so vampire clan spells price at the
floor; and the 24-effect enchantment catalogue reads
`ENCHANTMENT_COSTS` **24** with `ITEM_MAKER_EFFECT_FLAGS` 24 beside it.

---

## The quest actions

`defaultActionTemplates()` returns **82** templates.
`ls Assets/Scripts/Game/Questing/Actions/*.cs | wc -l` is **82**, and
the citation sweep over that directory is **82/82**. The vendored pack
is **265 quests** (`find vendor/dfu-quests/Quests -name '*.txt' | wc -l`).

The superseded page's risk note - "the DFU-extension actions no
vendored quest exercises" - had one survivor recorded rather than
closed, and the Ledger row said so at its tail: `playSound`'s busy-skip,
because the port's one-shot audio engine had no busy state. The E-group
gave it one (`systems/audio.js`'s `QuestAudioSource`, the
DaggerfallAudioSource the QuestMachine carries) and struck the clause.

---

## The formats

`src/formats/` is **53 modules**. DFU's `Assets/Scripts/API` is 50
classes, **46 cited**, and `API/Save` is **14/14** - the classic `.SAV`
reader that the superseded page's `formats-game` row called a "broken
consumer" is whole on the reader side and its consumer is fixed.

The four uncited API classes are the same shape they were: `DFValidator`
(206 lines - DFU's ARENA2 install checker, which a browser build that
ingests the user's own files does not have a use for), `PowerOfTwo`
(72), `DFSound` (41, a struct) and `PatchList` (50).
`GetFireWallColors32`, listed as missing on the superseded page,
now has a named consumer decision at `src/world/emissiveTextures.js:47`:
the Mantellan Crux fire walls take that arm instead of "reuse the
albedo" and only with a reference texture present, so the archive is
skipped by the upload arm rather than mis-lit.

**The auto-emissive table, re-measured.** The superseded page called it
"`MaterialReader`'s 157-record auto-emissive table (verified absent)".
It is present and it is not 157 records. `src/world/emissiveTextures.js`
carries **24 archives / 182 records**; `TextureReader.cs:809-1023`
carries **182 live entries across 24 distinct archives** plus 3
commented out, and the port keeps all three commented out at the same
places. The table is byte-exact; the old figure is corrected to 182.

Two more of the superseded page's data figures re-measure differently
and the correction is the port's, not the audit's:
- **`ENEMY_BASICS` is 62 rows, not 63.** `test/audit24_enemytable.test.js:52`
  asserts 62 against the C# source itself and `:168` asserts the enum
  still names 62 mobiles; `grep -c "new MobileEnemy()"` over
  `EnemyBasics.cs` returns 64, which counts the array's own template
  rows. 62 is the gated number.
- **`SOUND` carries 76 named clips, not 74** (`systems/soundClips.js`),
  against 374 entries in `SoundClips.cs` - the port names the subset it
  plays, and the subset grew by two.

Everything else re-measures unchanged: `ARCH3D_PATCH` **905**,
`BORDER_REGIONS` **682**, `LOOT_MATRICES` **22**, `SETTINGS_DEFAULTS`
**13 sections / 171 keys**, `SONG_FILES` **133** with **39** playlists,
`ENCOUNTER_TABLES` **45**, `DISEASE_DATA` **17**, `ANSWER_TABLE`
**120**, `RACE_TEMPLATES` **8**, `SKILL_ADVANCEMENT_MULTIPLIER` **35**,
`DIFFICULTY` **50**, and 13 building-name tables in
`world/buildingNames.js`.

---

## The systems

The superseded page's per-area table is reproduced below with each
verdict re-derived. The vocabulary is unchanged: **Verbatim** = law and
data match, residue only · **Near-1:1** = law matches, small or
ledgered divergences · **Law 1:1 / seam broken** = the ported law is
correct but a caller does not deliver it · **Partial** = meaningful
reference surface absent · **Departure** = deliberate, ledgered.

| Area | then | now | what moved, and what is left |
|---|---|---|---|
| **formats-core** | Verbatim | **Verbatim** | 46/50 API classes cited, `API/Save` 14/14. The malformed-CIF runaway parse was in the AUDIT-44 wave. Residue: `DFValidator`, `PowerOfTwo`. |
| **formats-game** | Verbatim readers / broken consumer | **Verbatim** | The `ItemRecord` conversions were in the wave; ROAD-A A4 took the classic-import stragglers (building-level MAPSAVE, the native bank record, `LegacyArtifactIndexBitfieldCheck`). Ledger row 562's one residue is the phone path - no zip arm in the saves picker, a desktop-first charter call. |
| **formats-mw** | Departure lane, faithful within it | **Departure lane, now consumed** | `clipSweepTimes` has a production caller: `combat/fpArm.js:1215` runs the whole-clip reach sweep the superseded page said had never run in the game. 17 modules / 8,842 lines. |
| **world-terrain** | Near-1:1 | **Near-1:1** | ROAD-A A1 moved the texture season onto `DaggerfallDateTime.SeasonValue` - climate swaps, the winter sunlight term and sky selection - and demoted `?season` to a debug override. The lightning flash stays a recorded enhanced-lane departure. |
| **world-layout** | Near-1:1 | **Near-1:1** | `rmbLayout`'s shared-block mutation is gated: `attachWindmillRecord` runs only when `enhanced` is true, is idempotent by a `subs.findIndex(r => r?.windmill)` guard, and the header names `subRecords.length` as the count three subsystems bind on (`world/rmbLayout.js:123-131` the gated call, `:170` the guard). |
| **scenes-world** | Law 1:1 / seams broken | **Near-1:1** | `currentWeatherKey` reads a live getter (`world.js:4169`). Region identity, the quest region/vampire faction seams and `CleanupUntrackedObjects` were the wave; `world.js:2494` carries the sweep and `hostMagic.js:592` its missile half. |
| **scenes-modes** | Solid, pause parity broken | **Near-1:1** | ROAD-B B1 put `UserInterfaceManager`'s real stack under this host's slot (`ui/windowStack.js`, 295 lines, imported at `worldModes.js:56`). See "the pause primitive" below - the stack exists, its `paused()` member has no reader. |
| **scenes-dungeon** | Deep, one lifecycle leak | **Near-1:1** | The three process-global seams return on destroy. ROAD-D D8 made this the fourth caller of `playerArrowHitFoe`, moved its action flats, mounted the enchant ctx off the shared `scenes/hostEnchant.js`, and routed its chargen through the one construction seam. |
| **scenes-support** | Near-1:1 | **Near-1:1** | ROAD-D D9 stood the city-watch fallback through `FoeSpawner.PlaceFoeFreely` on its own collider. Court reads the live region. |
| **render-core** | Partial (presentation) | **Near-1:1** | The auto-emissive table is present and byte-exact at 182 records / 24 archives. Fog pass-space was the wave. |
| **render-modules** | Verbatim (classic) / Partial (enhanced) | **unchanged, and still un-oracled** | The port-original modules (frustum, far ring, precipitation, enhanced sky) have no parity oracle by construction. This is the one structural verification hole the campaign did not touch. |
| **player** | Near-1:1 / one lethal seam | **Near-1:1** | `cancelMovement` is a real motor field set on the mode edges (`player/motor.js:331,:439,:447`). ROAD-A A6 took the -0.28 doorway head-dip, `PlayerMoveScanner`'s three probes, `controllerSwimHeight` 0.30 with Do(Un)Sinking, and `FreezeMotor` on teleports. |
| **combat** | Math exact / wiring broken | **Verbatim** | Four hosts resolve a player arrow. ROAD-A A12 shipped the left-hand weapon (ToggleHand/SwitchHand/`usingRightHand`, the classic import's `usingLeftHandWeapon`, the mirrored draw). |
| **characters-ai** | Verbatim | **Verbatim** | `stopDistance` picks `CLASSIC_MELEE_DISTANCE_VS_AI` per pass (`enemyMotor.js:1142`, `enemyAttack.js:177`). ROAD-A A5 took enemy levitation, invisibility/Shade as live sources, foe fall damage and the Seducer transform pair. |
| **characters-voxel** | Departure (deliberate) | **Departure, still editor-only** | 86 designs across seven tables - 42 of the 43 monster mobiles, 19 class, 25 villager. The rig is 1,791 lines across 7 modules and is still gated: `worldModes.js:3702` passes `voxelfolk`, `scenes/interiorContext.js:384` consumes it. |
| **sys-entity** | Law byte-exact / three dead seams | **Verbatim** | ROAD-A A11 took the "master of" box (TEXT.RSC 4020) with `ArenaFanfareLevelUp`, `skillsRecentlyRaised` and the sheet's own leveling arm. |
| **sys-magic** | Near-complete | **Verbatim** | 91 keys, 0 inert; `minimumCastingCost` live; ROAD-D D9 took the held-bundle instant re-fire and the caster block's `BundleType == Spell` test on all three gates. |
| **sys-quests** | Verbatim | **Verbatim** | 82/82 action templates, 265 quests. `playSound`'s busy-skip was the one recorded delta and the E-group closed it (`systems/audio.js`'s `QuestAudioSource`). |
| **sys-guilds** | Law exact / two structural holes | **Verbatim** | ROAD-D D9 shipped `KnightlyOrder.RestoreGuildData`'s flag migration through the one load door. `SERVICE_DESTINATION` 20/20. |
| **sys-items** | Law exact / live money bugs | **Verbatim** | ROAD-A A2 took the daily `stockedDate` restock, book prices off `BookFile`, condition-0 shelf arrows and `SplitStack`'s fresh mint; ROAD-D D7 took the live pack, native Repair, the recipe panel and item tooltips. |
| **sys-talk** | Engines verbatim / six host seams unfilled | **Verbatim** | `getQuestorName()` is the seeded name bank (`systems/npcSession.js:588-595`) - the last of the superseded page's empty reads. ROAD-A A9 also mounted bulletin boards and the `GrammarManager.ProcessGrammar` pass. |
| **sys-sim** | Law line-for-line / clock seam broken | **Near-1:1** | `preventEnemySpawns` is live on the fast-travel path (`world.js:1598`, `:1667`). Ledger row 511's residue list is spent - see list 2. |
| **sys-audio** | Data verbatim / engine risk | **Verbatim** | 133 songs, 39 playlists, 76 named clips. |
| **sys-save** | Broad / three features silently dropped | **Verbatim** | ROAD-A A4 took the envelope stragglers (resistances, `skillsRecentlyRaised`, `minMetalToHit`, `previousVampireClan`, `timeToBecomeVampireOrWerebeast`, `playerTeleportedIntoDungeon`); ROAD-C C1 built the multi-slot window over the store. |
| **ui-core** | Verbatim | **Verbatim** | ROAD-A A7 built a real `VerticalScrollBar` with a draggable thumb, the item scroller's arrow states, the list picker's double-click law and the message box's scrolling variant with its image panel - and with it, paintings. |
| **ui-hud** | Verbatim (classic) / Partial (enhanced default) | **Verbatim on both skins** | The skin fork moved BELOW the game-state seams: `ui/hud.js:451` runs `updateHudVitals` and `:457` `drawNearDeathFlicker`, both above the enhanced branch at `:460` and above the `!art` return, and the enhanced HUD takes the Detect markers at `:471`. `lastHealthLost()` is no longer pinned at 0, so `CameraRecoiler` lives in all three hosts. |
| **ui-windows-a** | Rect parity excellent / two crash doors | **Verbatim** | ROAD-D D2 shipped both scroll thumbs (`chargenArt.js:759` over `RECTS.pickScroll`, `spellbookWindow.js:887` over the 7-wide rail). |
| **ui-windows-b** | Broadly ported | **Verbatim** | Both automaps are native windows. ROAD-D D6 built the ship purchase over the shared bank-market mount and gave `buildingIsUnlocked` the `ownsShip` key its last arm needed. |
| **ui-enhanced** | Departure lane | **Departure lane, scoped** | `ui/lootHover.js:64` puts the skin gate above `ensure()`, so the unscoped `*`/`html`/`body`/`button`/`#app` rules never reach the classic page. 9 modules / 8,940 lines. |
| **xcut-seams** | Clean, with one block | **Clean** | The quest machine's region-faction block was the wave. |
| **xcut-async** | Disciplined / one missing sweep | **Disciplined** | `CleanupUntrackedObjects` has a counterpart in both halves. |
| **xcut-tests-docs** | Gated half exact / ungated half rotting | **Gated half exact / one line stale** | The 17-entry flag list is byte-identical to `regenOpenFlags --check`; `Testing.md:4` is one test behind the runner. |

**The pause primitive, precisely.** ROAD-B B1 built the stack DFU's
`UserInterfaceManager` has, with `PauseWhileOpen` as a real latch
(`ui/windowStack.js:85`, `:101`, `:274`). It is mounted in the two hosts
that own overlay slots - `worldModes.js:56` and `dungeonContext.js:34` -
and `world.js:171` reaches it by mounting `worldModes`. But `grep -rn
"paused()" src/` returns exactly one hit, the definition at
`windowStack.js:219`: **no host reads the primitive.** Every host still
gates on its own `overlayHeld`/depth expression. The class is narrowed,
not retired, and it is narrowed by a member that is itself a dead seam
of the shape this port keeps finding.

---

## What the campaign moved

Twelve ranked gaps stood at the superseded page's measurement. All
twelve were closed by the AUDIT-44 wave the same day; the campaign then
ran four waves and a closeout against what the wave left. Against the
superseded page's own closing list of what remained open:

| what remained open on 2026-09-01 | state at `c3c12ee` |
|---|---|
| the multi-slot save/load window | **built** - `ui/saveWindow.js`, 782 lines (ROAD-C C1) |
| the native automap windows (3D view, render modes, note markers, teleporter portals) | **built** - 4,742 lines across seven modules (ROAD-C C2) |
| `GetQuestorName`'s name bank | **built** - `systems/npcSession.js:588` (ROAD-A A9) |
| the pause architecture | **narrowed** - a real window stack with a `PauseWhileOpen` latch; no host reads `paused()` |
| the voxel rig is editor-only | **unchanged** - a departure, not on the road |
| the 151 FLAGGED/INTERIM sites | **19** |
| no parity oracle for the port-original render modules | **unchanged** - structural |

The campaign's own arithmetic, from its machine records: Wave A 12
groups, **34 slices done, 14 not-a-gap, 24 recorded**; Wave B 4 groups
plus B5, **11 done, 12 not-a-gap, 11 recorded**; Wave C two arcs - the
save window, and the automap pair's **ten judged stages in two
flights**; Wave D 10 groups, **39 of 42 slices shipped, 16 recorded**. Five adversarial rounds judged 145 findings, 118 confirmed
(`Audit-49.md`). The flag front ran separately: **145 flag sites
triaged - 69 stale, 42 closable, 24 not-a-gap, 10 blocked** - six
retirement lanes retired 96 sites and kept 2, and the 42 closable
became Wave D's 42 slices.

---

# What remains

## 1. The nineteen open flags this was measured over - TWELVE STAND

The list is `bible/Home.md`'s "Open flags", regenerated from `src/` by
`tools/regenOpenFlags.mjs` and pinned both ways by
`test/audit18_bible_docs.test.js`. It cannot be edited into agreement.
Ten carry a **blocked** verdict from the closeout triage
(`closeout-audit.json`, `triage` rows with `verdict: "blocked"`); six
are the **narrowed remainders** Wave D recorded rather than shipped
(`wave-d-reports.json`, `recorded`); one is neither; two were recorded by the closeout tail's port of `FPSSpellCasting.cs` (the classic spell-hand animations, `src/combat/fpsSpellCasting.js`) and are listed last.

**Blocked - no 1:1 target.**

- **`src/scenes/dungeonContext.js:1673`** - the two window seams this
  host cannot mount (`onTeleport`'s INTERIM shape). *There is no
  standalone dungeon scene in DFU to port from; `?dungeon` is the
  port's own dev route. The shipped `bootWorld` path carries Identify
  and Dispel on the `worldModes` host. Closing it means porting the
  trade window and bundle picker into a dev-only route - an owner
  decision, not a parity defect.* This is also Ledger row 574's
  adjudication.
- **`src/ui/enhancedMenu.js:1722`** - the rest of the keyboard; the
  wizard walks to `done` with no pointer. *The enhanced menu is the
  enhanced skin, a Ledger A departure, so no C# line is owed. The flag
  names its own blocker: focus order across a rail, a settings list and
  a help sheet. Escape already routes through the shared
  `overlayAction` table at `:1744`, so the seam is in place whenever the
  design is decided.*
- **`src/ui/pauseWindow.js:58`** - `PauseOptionsDropdown`. *Its two
  fixed rows are `ModSettingsWindowOption_OnClick`, which lists
  `ModManager.Instance.Mods`, and `GameEffectsWindowOption_OnClick`,
  which opens `GameEffectsConfigWindow`; the port has neither, and
  everything else in DFU's list is mod-registered. The port's settings
  home is the launcher menu. Not blocked on art - the icon is in the
  reference tree.*

**Blocked - host scope.**

- **`src/scenes/exterior.js:1031`** - Recall pends here; the anchor
  machinery lives in the streaming `?world` host. **NARROWED (TP2,
  2026-09-03).** *The triage's verdict was true of ONE arm and wrong as
  a refusal - the same mistake A10 found in the dungeon context. Set-anchor
  (`Teleport.cs:100-117`) needs a position and a context, both of which
  this host has in every mode; the same-interior arm (:129-134) is a bare
  move; and the whole cross-context arm INSIDE the loaded pixel runs on
  this route's own mode machine (`forceExitToExterior`, `restoreInterior`,
  `startInDungeon`, `setPlayerLocalPosition`). All of that ships. What
  stays flagged, at its own line inside `recallToAnchor`, is the ONE arm
  named exactly: a jump to an anchor on ANOTHER map pixel, which is
  `_teleportToPixel`'s - the streamer's - and there is no streamer here.
  Its refusal names the reason instead of eating the cast.*
- ~~**`src/scenes/exterior.js:1283`** - PX3: this test host mounts no
  quest bridge, so the pause window's Quests tab says so.~~ **SHIPPED
  (QX1, 2026-09-03).** *The triage's premise - "this file has no bridge
  at all and constructs no quest machine" - was a missing construction,
  not a missing target. `createQuestBridge` is built here over the
  route's ONE loaded city (every `PlayerGPS` read in its world adapter
  answers `dfLocation` outright, which is the whole difference from the
  streaming host), and the eight surfaces that had each recorded the
  absence separately now read the machine: the pause window's Quests
  tab and the interior pause's, the character sheet's LOGBOOK button,
  `TickRest`'s per-hour `QuestMachine.Tick`, the Status box's macro
  context, a quest letter's display name, the exterior automap's
  residence plates, and the mode machine's own `mountScene` over every
  building and dungeon it opens.*

**Blocked - data, an asset, or a layer the port does not have.**

- ~~**`src/scenes/world.js:2662`** - the port's default landing stands
  in for `GetPlayerTravelPosition`, flagged for the first session with
  ARENA2.~~ **SHIPPED (ship landing, 2026-09-03).** *The owner supplied
  the real MAPS.BSA and the claim it rested on was FALSE: map pixel
  (2,2) carries region 31 ("High Rock sea coast") index 1, "Your Ship",
  mapId 1050578, `LocationTypes.HomeYourShips` (14), 1x1, block
  SHIPAA00.RMB, and pixel (5,5) carries region 31 index 2, "Your Ship",
  mapId 2102157, block SHIPAA01.RMB - the two `SHIP_INTERIOR_MAP_IDS`
  exactly, and nothing else in the 62 regions stands on either pixel.
  So the terrain-origin fallback never runs: the boarding is an
  ORDINARY location arrival and takes StreamingWorld's
  `PositionPlayerToLocation` (:1437-1467) like any other pixel with a
  location, landing on the ship's deck. `world/locationEntrance.js`
  gained `locationArrivalLanding` (the outer overload), the teleport
  core gained the `reposition` argument DFU's `TeleportToMapPixel`
  stores (:1076-1095) and applies once the destination pixel is built
  (:266-295), and the court release now reaches the same seam. Pinned
  by `tr4_ship.test.js`'s TR4-SHIPLAND trio, two of them a MAPS.BSA
  data gate that runs the moment `ARENA2_PATH` holds that one file -
  the file itself stays out of the repo, as Port-Doctrine requires.*
- **`src/systems/playerTorch.js:12`** and
  **`src/systems/playerTorch.js:51`** - the else-arm's range and the
  base `torchIntensity`. *Both live in `PlayerTorch.prefab`.
  `EnablePlayerTorch.cs:47-48` reads brightness off the prefab's Light
  component and the else arm never sets a range; the reference tree
  holds 43 `.prefab` files, all under Standard Assets, and none is
  PlayerTorch. The CONDITION is portable and ported; only the radius is
  unknowable, so closing it needs an owner-chosen number. The ON arm
  needs none of it - it re-reads range from the item template every
  frame, which is what ships.*
- ~~**`src/systems/talkMacros.js:268`** - `GetValue`'s
  `symbolStr + "[undefined]"` sentinel.~~ SHIPPED (E-group E7,
  2026-09-02): *the blocker was the table, so the table was finished.
  `questMacros.js`'s HANDLERS carries all 217 `macroHandlers` rows
  (M-X's thirty-seven ELSEWHERE records consolidated, plus the bare
  `%`), `talkMacros.js` carries none - it is the MCP: TalkManagerMCP's
  thirteen overrides over the one GameManager the host hands in - and
  all four sentinels are reachable and pinned.*
- **`src/systems/inputActions.js:465`** - STILL FLAGGED: axes and
  joystick. *The port has no gamepad input layer, so `AxisActions` and
  `JoystickUIActions` have no source to bind and `loadKeyBinds`
  deliberately ignores those blocks in a DFU-written file; the matching
  sub-windows are recorded pending at `Port-Ledger.md:568`. The flag's
  second bullet - the port's own key departures - was retired as stale
  by I2 and the table now carries DFU's defaults.*

**Narrowed by Wave D, recorded rather than shipped.**

- ~~**`src/characters/enemyCasting.js:91`** - now exactly one term
  wide: `HasClearPathToShootProjectile`.~~ **SHIPPED (E-group,
  2026-09-02).** *EnemyMotor.HasClearPathToShootProjectile (:698-741)
  is ported at `characters/enemyMotor.js` beside the collider it needs,
  with EnemySenses.PredictNextTargetPos (:541-616) - the lead solved as
  a cone/line intersection, its mid-interval divisor quirk included -
  under it. The caster asks it as CanCastRangedSpell's last term
  (:786-788, speed 25 / DaggerfallMissile.ArmLength / radius 0.45,
  every constant reused from the home that already declared it), so a
  blocked caster gets no selection and therefore neither casts nor
  stands off. Both foe pools get it from the `ai` they already hand the
  caster. D9 had shipped the other half - the `EffectsAlreadyOnTarget`
  veto reaching the stand-off band, and the ranged branch reordered
  into DFU's own order so `DoRangedAttack`'s band condition selects
  before the 1/40 roll fires, where the port rolled first and picked
  second.*
- **`src/scenes/worldModes.js:1617`** - above ground only:
  `QuestMachine.SetupIndividualStaticNPC`. *Multi-host. The law is
  ported and idle at `systems/quest/machine.js:716` including the
  away arm's `setActive(false)`, but there is no moment to run it: both
  exterior hosts lay their RMB blocks out before the quest bridge
  exists, and the away arm has to take the billboard out of the batch
  AT layout, so click time is the wrong moment. Closing it means
  deferring the exterior NPC pass or re-running one pass when the
  bridge lands, in two files.*
- ~~**`src/systems/inventory.js:48`** - gold as a bag stack.~~ **SHIPPED
  (E-group, 2026-09-02).** *Gold is `PlayerEntity.GoldPieces`, a
  counter, and `PlayerEntity.Items` can never hold Currency.
  `DoTransferItem`'s interception (`:1562-1571`) is
  `itemTransfer.applyTransfer`'s `toPlayer` arm and runs at both doors;
  every producer writes the counter as DFU's does; `CarriedWeight`
  (`:184`) came back whole as `inventory.carriedWeight` and reaches its
  four DFU readers. The wagon, loot piles and quest gold KEEP the
  stack, because DFU's do. The envelope carries `goldPieces`, and a
  pre-slice save's stack is absorbed on restore. D9's correction stood
  and is why nothing was added to `filterByTab`.*
- **`src/ui/chargenArt.js:731`** - the picker's scroll bar has no HIT.
  *D2 shipped the DRAW: `drawPickerScrollThumb` lays DFU's three
  carried strips over `RECTS.pickScroll`. The hit is not a one-function
  change - it needs a scroll-index hit result threaded through
  `ui/chargen.js`'s flow for all three pickers plus a held-button frame
  the chargen host never polls.*
- ~~**`src/ui/exteriorAutomapWindow.js:96`** - `map_revealbuildings` /
  `map_hidebuildings`.~~ **CLOSED (E-group, 2026-09-02: E1 narrowed the
  header and moved the site, E3 built the console host and REGISTERED
  both verbs on it).** *Narrowed to exactly itself.
  `ExteriorAutomap.cs:1796-1830` registers these as CONSOLE commands
  and the port has no console host. The flag they set,
  `revealUndiscoveredBuildings`, is live and pinned in both states by
  `test/automap_ext.test.js`; what is missing is the console seam
  alone, the same stance `ui/travelMapWindow.js` already records for
  `map_reveallocations`. D5 shipped the other two thirds of this
  header - the residence-with-active-quest plates and the eight button
  tooltips.*
- ~~**`src/ui/hudLarge.js:75`** - the docked bar occludes, it does not
  shrink.~~ **SHIPPED (E-group, 2026-09-02, E5): the docked bar SHRINKS
  the world pass now - `ViewportChanger.cs:52-67`'s camera rect and
  `HUDCrosshair.cs:43-52`'s re-centring both landed.** *Multi-host and
  the largest of the six.
  `Utility/ViewportChanger.cs:52-61` and `HUDCrosshair.cs:43-52` are a dozen
  lines each; the cost is the seam. `gl.viewport` is set full-canvas at
  four sites inside the renderer's own frame brackets
  (`render/renderer.js:1188, :1206, :1688, :1863`) and the 2D passes
  need the full canvas back. D10 withdrew one clause as stale with
  evidence: there are no screen-to-ray conversions to fix, because the
  port's activation ray is the camera's forward vector, not a pixel
  unprojected through the projection matrix, so a reduced viewport
  would move no pick. D10 shipped the other half of this file's flag -
  `LargeHUDOffsetHorse` and `LargeHUDUndockedOffsetWeapon`, one home
  and two call sites.*

**Neither, and the list cannot tell.**

- **`src/systems/skills.js:164`** - "AUDIT 18: the +10% used to be
  INTERIM 0 behind a flag blaming a decode that had ALREADY SHIPPED".
  *The work is done. D9 shipped `AcrobatMotor.cs:96-101`'s nested
  `ImprovedAthleticism` term at `skills.js:189-201`, over the two
  constants named from `AcrobatMotor.cs:14-15` - and the sentence the
  list quoted was a past-tense retirement record that happened to
  contain the marker. `tools/flagSites.mjs` deliberately does not try
  to read tense (its own header says why: a wrong count is worse than
  a known-incomplete one), so the fix is the one this entry named -
  Home.md's law that RETIRING A FLAG DELETES THE SENTENCE
  (`Home.md:116-119`), applied to a retirement record rather than to a
  live flag. The sentence now reads "a hard 0 behind a placeholder
  flag" and says exactly what it said. Pinned in
  `test/flagsweep.test.js` - the record's own words, the shipped term
  it records, and `flagLines()` answering empty over the file -
  mutation-checked by putting the token back.*
  constants named from `AcrobatMotor.cs:14-15`, and the sentence the
  list quotes is a past-tense retirement record that happens to contain
  the word INTERIM. `tools/regenOpenFlags.mjs` matches
  FLAGGED/INTERIM per line and cannot read tense, so this is a false
  positive of the only part of the record that could not otherwise lie.
  Home.md's own law - RETIRING A FLAG DELETES THE SENTENCE
  (`Home.md:116-119`) - is the fix, applied to a retirement record
  rather than to a live flag.*

**The arithmetic.** 10 blocked + 6 narrowed + 1 false positive = 17
when this was measured, over the 19 the list then held. **As of Wave E, the ship
landing, ROAD-F (GS1, GS2, DR1) and QX1/TP2, `node tools/regenOpenFlags.mjs --check` answers 7**,
and no count in
this file or in `Road-To-1-1.md` may state another figure: the tool is
the measurement, and `test/citedrift.test.js` holds both documents to
it. The E-group retired SIX flags, not two - one per lane, and no lane
could see the others' closures until the squash, which is how "leaving
17" came to be written three times over a tree that answers 13:

- `combat/fpsSpellCasting.js:178` (the release is not the spell) and
  `characters/enemyCasting.js:91` (the clear-path term) - **E6**, which
  closed section C's `playSound` row with them;
- `systems/inventory.js:48` (gold as a bag stack) - **E4**;
- `systems/talkMacros.js:268` (`GetValue`'s empty-string arm) - **E7**;
- `ui/hudLarge.js:75` (the docked bar occludes) - **E5**;
- `ui/exteriorAutomapWindow.js:96` (the two console verbs) - **E1**
  narrowed the header and **E3** built the console host they needed.

Five of the twelve survivors only MOVED, and `Home.md` was
regenerated onto the new sites: `exterior.js:1073` -> `:1089`,
`exterior.js:1325` -> `:1344`, `world.js:2819` -> `:2932`,
~~`worldModes.js:1659` -> `:1687`~~ (**CLOSED at ROAD-F GS1**, below),
`pauseWindow.js:58` -> `:61`. The
`worldModes.js:1659` -> `:1687`, `pauseWindow.js:58` -> `:61`. The
entries in the two lists above still quote the line numbers of the
measurement, which is older still; `Home.md` is the live list.
**ROAD-F (2026-09-03) took the last two this page still owed.**
- ~~**`src/scenes/worldModes.js:1687`** - above ground only: the GUILD
  SERVICE popup.~~ **SHIPPED (GS1).** *`StaticNPCClick` pushes the
  popup on `Services.HasGuildService` ALONE
  (`PlayerActivate.cs:1552-1568`) - the `BuildingDiscoveryData` beside
  it supplies the guild GROUP, and `:1543-1546` has already answered
  `GuildGroups.None` for a player who is not inside a building - so a
  street NPC carrying a guild-service faction opens it in C# too, into
  DFU's ONE `UserInterfaceManager` stack. The port's departure was
  never the routing (`staticNpcRoute` has answered `guildService`
  outdoors since G8) but the SLOT. The flag named the honest shape and
  GS1 built it: `mountServiceWindow`, the REPLACE-mode sibling of
  `mountSpellWindow` (which refuses an occupied interior slot on
  purpose, while every site in this chain is a dispatch out of the
  popup already in it - DFU's own `CloseWindow(); PushWindow(next);`,
  `DaggerfallGuildServicePopupWindow.cs:340-450`), whose exterior arm
  is townTalk's slot, the one the outdoor talk window, the outdoor
  quest offer and the outdoor refusals already use. `closeSpellWindow`
  needed no sibling - it was already mode-general - so the ~24 identity
  guards became calls to it. The sweep is `openGuildService`,
  `openWitchesCoven` (a coven is an exterior location, so its popup was
  outdoor-only from the start), `popupTalkToStaticNpc`, every arm of
  `openServiceFlow` and the `openRepairService` subtree under it; and
  `guildServiceRepair`, which answered `return interiorOverlay` and so
  read null above ground, hands back the window the opener mounted.
  NARROWED to one sentence: outdoors the guild's Repair opens the KEYED
  list, not the native INVE12I0 screen, because `openTradeWindow`
  prices and stages against a building record the street does not have
  - and DFU's own arm (`:353-356`) reads quality off
  `PlayerEnterExit.BuildingDiscoveryData`, stale or zero for a player
  who is not inside one. Pinned in `test/audit26_extnpcs.test.js` (the
  routing law outdoors, the lifted door's three arms run for real, the
  chain swept), mutation-checked by removing the outdoor arm.*

**Recorded by the closeout tail - the spell-hand port.**

- ~~**`src/combat/fpsSpellCasting.js:178`** - THE RELEASE IS NOT THE
  SPELL.~~ **SHIPPED (E-group, 2026-09-02).** *And the premise needed
  one correction on the way in: DFU spends the magicka at the CAST, not
  at the release - `DecreaseMagicka` is CastReadySpell.cs:423-425,
  BEFORE `PlayOneShot` at :434. So the split shipped is DFU's own:
  `hostMagic.castInput` runs the silence gate, the new `castInProgress`
  gate (:408, and :315's twin on SetReadySpell - nothing can be readied
  for the 0.2 s either), the touch-range gate and the spend, then
  starts the hands through a new `startCastAnim` dep and parks the rest
  on `SpellCastAnim`'s release frame, where
  PlayerSpellCasting_OnReleaseFrame (:2098-2143) tallies, sounds,
  assigns or launches, raises OnCastReadySpell and clears the ready. A
  cast aborted inside the window reaches the `readySpell == null` return
  and is not refunded; a host with no rig, or an element with no CIF
  archive, takes DFU's no-animation arm and resolves on the spot. The
  release reads the LIVE aim, because that is where DFU's missile
  spawns.*
- **`src/combat/fpsSpellCasting.js:101`** - TextureReplacement's
  loose-file CIF override (`TryImportCifRci`) is not consulted, the same
  gap `combat/fpsWeapon.js` has for WEAPON*.CIF: the replacement
  registry covers archive textures only. *Mod infrastructure - a
  departure not on the road (Ledger A), recorded here for the count.*

## 2. Port-Ledger section C rows still routed and not struck

Row numbers below are resolved against `Port-Ledger.md` AT THIS SHA and
held there by `test/citedrift.test.js` - the wave that wrote this
section moved every one of them by inserting rows above section C, and
a line number nobody re-resolves is a pointer at a stranger.

Section C's table is **247 rows** between `Port-Ledger.md:454` and
`:700` (`awk '/^\|/ && !/^\|---/'`). **226 are struck.** Of the 21 that
are not, four are VidFile quirks filed under the wrong section
(ported-as-is, no route), three carry a **Kept** verdict (the climate
swap dimensions, the secondary picker's cancel path, the rep window's
stale-bar quirk), two are **Not planned** (`TangentSolver`/lightmap UVs;
AssetInjection's texture, model and world-data halves), three are
declared departures (the two Morrowind judgement rows, the settings
taxonomy), two are audit preambles, one is RESERVED by the owner
(smaller-dungeon generation, to the enhanced lane), and two say inside
their own text that they are closed (`RegionPowerAndConditionsUpdate`,
vampirism/lycanthropy).

That accounts for 17 of the 21, leaving **4 unstruck rows that carry a
route** - plus `:571`, struck at its head but carrying a live PENDING
clause in its tail, for **six rows that still owe work: items 1-6
below** (item 7 was the seventh, and DR1 struck it). The measurement this section was first written over read 246
rows, 216 struck and fourteen still owing; what closed the gap is the
work the entries themselves argued for - the closeout tail struck the
six STALE rows (items 9-14), E8 struck item 8, and E4 added one new
section-C row of its own, already struck. A stale row here is worse
than a missing one: it sends the next slice to build what already
ships, which is the warning the section's own preamble opens with.

*Genuinely open:*

1. **`:489` FaceUVTool's 1,803-UV residual at matched precision** ->
   Readers arc. **NARROWED (E-group, 2026-09-02), not closed.** The
   surface is fenced from DFU's own sources: `API/Vector3.cs` is double
   throughout, so the whole basis walk was already matched and cannot
   carry it; points 0-2 are pure Int32 delta sums, so all of it lives at
   point index >= 3; and the one genuinely single-precision half is
   `df3duvparams_lt`/`df3duvmatrix_t` and `l_ComputeDFUVMatrixXY`, whose
   float rounding flips the final truncation on 0.019% of random
   four-point faces (`test/faceuvresidue.test.js` pins one). And the
   harness was NOT re-runnable as the row claimed: the float->double
   widening the measurement was taken against was never a committed
   patch. It is one now (`tools/parity/patches/FaceUVTool.cs.patch`).
   The 1,803 itself still needs ARENA2 plus mono to re-measure.
2. **`:502` the custom builder's hidden `ResetBonusPool` control** (STRUCK at E2, landing after this list was written: the control is live) ->
   UI arc (a keybinding slice). **Its stated blocker is now retired**:
   the row says "the port has no keybinding registry to hang it on", and
   `systems/dialogShortcuts.js:194`/`:311` carries `ResetBonusPool` with
   its `Ctrl-U` default since A8. Nothing in `ui/chargen.js`,
   `ui/chargenArt.js` or `systems/customClass.js` consumes it. This is
   the smallest open row in the section.
3. **`:472` remainder: the overlay mouse-UP seam** -> UI arc. A7 shipped
   the thumb drag and the picker's double-click law; the port has no
   overlay mouse-up seam, so the latch drops on the first hover after
   the button comes up (`ListPickerWindow.release()`,
   `ui/listPicker.js:263`, exists and is unwired). The spellbook's own
   drag stays the F159/F170/F180 departure; the closeout narrowed its
   superseded REASON without removing the departure.
4. ~~**`:515` the quest machine** -> `playSound`'s busy-skip, the one
   recorded delta, because the port's one-shot engine has no busy
   state.~~ **CLOSED (E-group, 2026-09-02):** `systems/audio.js` grew
   the `QuestAudioSource` DFU's QuestMachine carries, IsPlaying reading
   the end time of the clip `playOneShot` already reported, and the
   world host's hook is PlaySound.cs:110-116 line for line.
5. **`:568` the classic `.SAV` reader** -> the phone path: no zip arm in
   the saves picker, a desktop-first charter call.
6. **`:571` (struck, with a live clause) the keybinding registry** ->
   the mouse/advanced and joystick sub-windows, the two of DFU's 65
   game windows the port does not cite.
7. ~~**`:580` the standalone dungeon host has no trade window** -> a
   dungeon-host lane. **Adjudicated by the closeout as BLOCKED** (see
   list 1): there is no DFU original for a standalone dungeon scene, so
   this is an owner decision about a dev route, not a routed gap.~~
   **CLOSED (DR1, 2026-09-03), and the adjudication was the wrong one.**
   "No DFU original for the scene" is true and does not decide the
   question, because the two WINDOWS have DFU originals and the seam
   they hang off is the port's own - which is exactly the case the
   four-hosts rule is written for: build DFU's law verbatim where DFU
   has one, the port's existing seam where the host is the port's own.
   `scenes/dungeonContext.js` now mounts `NativeTradeWindow` in
   Identify mode (Identify.cs:71-76, DoModeAction's spell arm
   :954-995) and the Dispel Magic bundle picker, both through
   `mountSpellWindow` -> `pushDungeonWindow`, with INVE00I0/SHOP00I0
   warmed at boot beside PICK00I0. Nothing was blocked: every hook the
   mount omits is one of DFU's own Buy/Repair/Sell mode gates, named in
   the struck row. Three DR1 pins in `x11b.test.js`, each red when its
   arm's mount is reverted to the PR1 refusal.
8. ~~**`:581` three stale probes**~~ **CLOSED (E-group, 2026-09-02).**
   `tools/shopProbe.mjs` is RETIRED - it drove the keyed browse window
   U8c/U40 replaced, and its subject is covered twice over by
   `tradeModeProbe`/`nativeTradeProbe`. `tools/toneProbe.mjs` and
   `tools/worldWhereIsProbe.mjs` were ported: the first onto the native
   talk window's own `native`/`tone`/`topicMode` state (it hunted a
   text tone row the art window does not draw), the second onto the
   boot-box drain `firstHourProbe` runs - a modal holds the motor, so
   its "NO LIVE WALKER" was a frozen world rather than a missing
   walker. Neither ported probe has been RUN here (no ARENA2, no
   browser); each is verified against the live seam it reads.

*Stale - the row is a claim the tree has outrun:*

9. **`:467` UseItem's unbuilt destinations.** Every arm the row names is
   built: `DrinkPotion` (`systems/useItem.js:167`, `:245-255`),
   `RecordLocationFromMap`/`DiscoverRandomLocation`
   (`ui/nativeInventory.js:570`, `:608`, `scenes/world.js:2083`), the
   quest-item click (`useItem.js:199`, `:212-213`) and
   `DoItemEnchantmentPayloads(Used)` (already struck at E2). D10 closed
   the last residue in the row's book-reader clause - the fixed 10px row
   is now `LayoutBookLabels` in each label's own face.
10. **`:517` fast-travel residue.** Its three named survivors are spent:
    the horse and cart mint on the general store's own shelf
    (`systems/shopStock.js:10`, "general stores always shelve a Horse
    and a Small Cart"), the ship purchase shipped at D6
    (`ui/bankWindow.js` + the ships arm of `ui/bankPurchaseWindow.js`
    over the shared `openBankMarket` mount, with `purchaseShip` finally
    having a caller), and `PreventEnemySpawns`-on-arrival is live at
    `scenes/world.js:1598` and `:1667`.
11. **`:522` `PatchRegionIndex` legacy-save fix.** Ported verbatim at
    `src/formats/mapsFile.js:104`, with the C# line range cited.
12. **`:566` the magic crafting windows.** The row's FLAGGED residue is
    three items and all three are answered: spell icons ship and are
    drawn (`ui/spellIcons.js`, imported at
    `ui/spellbookWindow.js:135-137`, drawn at `:921`), the icon picker
    ships (`ui/spellIconPickerWindow.js`), and the
    inert-catalogue count is gated at 0. What survives is not residue
    ~~but a **departure with no Ledger row**: DFU's native INFO01I0 art
    window is a keyed text window here.~~ **THAT SHIPPED TOO (E-group,
    2026-09-02): the window is native, and the row's last unstruck
    clause goes with it.**
13. **`:516` the talk manager.** The row's own tail already says both
    named PENDING gaps closed at TK-vi; A9 then took the questor name
    bank behind `%pqn`, which the row's parent list still implies is
    owed. `AddNonQuestRumor`'s producer - the regional faction sim -
    shipped at S41-S44/RS1.
14. **`:546` the small-residue trio** (biography GP arm, arrow roll
    notes, the faceUV zero-length guard) -> their arcs. The biography GP
    arm has a Ledger A row of its own and is inert on all 18 shipping
    `BIOG*.TXT` files; the faceUV guard rides row `:489`.

## 3. The deliberate departures, which are not on the road

`Road-To-1-1.md` names these at its head so nobody re-opens them, and
`Port-Ledger.md` section A carries **67 rows, 7 struck - 60 standing
approved departures** (the 65th is WIND1, 2026-09-02, added after this page's measurement and counted here so the tally follows the tree; the 67th is the re-integrated road system, added by AUDIT 54 F5) plus the slot-0 reroll bullet and the
houses-for-sale A-note. They are design choices, each internally
faithful to whatever reference it does have, and none of them is a gap.

- **The voxel character engine** (Mac's system, Port-Doctrine). 86
  designs across seven tables - 42 of the 43 monster mobiles, 19 class,
  25 villager - and a 1,791-line rig across 7 modules. Still not shipped
  by a game host: `worldModes.js:3702` passes `voxelfolk`,
  `scenes/interiorContext.js:384` gates on it, and no default route sets
  it. The departure is faithful and is not in the player's hands.
- **The enhanced skin and visuals** - 9 `ui/enhanced*.js` modules, 8,940
  lines, plus `render/enhancedSky.js` (ES1-ES1f), the foe target frame
  (PX30), the HUD scale (PX30c), the turning windmills (WM1) and the
  skin's web fonts, which are the port's only third-party request. It
  ships as the DEFAULT, which is why the superseded page's second theme
  was presentation drift on the default configuration; the campaign's
  answer was to move the game-state seams above the skin fork rather
  than to change the default.
- **The Morrowind lane** - 17 `mw*` modules, 8,842 lines, with two
  judgement rows declared and awaiting the owner's read (the
  Daggerfall->Morrowind weapon mapping, MW-D9; the uncharged Daggerfall
  swing, MW-D12). `combat/fpArm.js` is the lane's first-person arm.
- **Mod-injection infrastructure** - `WorldDataReplacement`,
  `BuildingReplacement`, texture/mesh replacement, custom
  guild/item/effect registries, quest-pack discovery. The citation sweep
  reads `Utility/AssetInjection` **5/9**: the SOUND half ships behind
  DFU's own `Settings.AssetInjection` gate
  (`systems/musicReplacement.js`), the rest is Not planned.
  `BookReplacement`, `TextAssetReader`, `VideoReplacement` and
  `XMLManager` are the four uncited.
- **`AdvancedClimbing` / rappel / hanging** - the corner wraps,
  `WallEject` and overhang bumps stay with their setting, on the
  `EnhancedCombatAI` doctrine. The classic climbing path shipped whole
  at M3.
- **The SoundFont / Melody synth** - there is no asset to port. DFU
  renders 133 pre-converted `.mid` files with a vendored synth and a
  SoundFont out of Unity Resources, none of it the user's ARENA2, so
  there is neither a reader to port nor a reusable asset; the port reads
  MIDI.BSA itself (`formats/hmiFile.js` - no DFU source exists) and
  synthesises the voice bank with two-operator FM
  (`systems/gmSynth.js`).
- **Shadow maps and SDF fonts** - neither has a classic original.
- **The presentation layer itself** - hand-rolled WebGL2 with no Unity
  concepts, billboards as vertex-shader expansion batched per
  (archive, record), bytes-in/objects-out data access with no
  FileProxy. This is what the `Utility` 24/35 and `Game/UserInterface`
  45/55 misses are: `ModelCombiner`, `TextureAtlasBuilder`,
  `TerrainAtlasBuilder`, `RetroRenderer`, `CameraClearManager`,
  `UserInterfaceRenderTarget`, `VideoPlayerDrawer` are Unity's problems
  and not the port's.
- **The engine-PRNG rule and its substitutions** - a `UnityEngine.Random`
  draw rides an injectable uniform roll, a `DFRandom` or
  `System.Random` draw does not; Ken Perlin's reference noise in place
  of `Mathf.PerlinNoise`, `umRandom` in place of `UnityEngine.Random`
  for nature scatter; the houses-for-sale seed, which cannot reproduce a
  CLR identity hash and should not want to.
- **`FaceUVTool` arithmetic** - JS doubles for C# float mix, `Math.trunc`
  for `(Int32)`. The float half is exactly `df3duvparams_lt`,
  `df3duvmatrix_t` and `l_ComputeDFUVMatrixXY`; `API/Vector3.cs` is
  already double, so the basis walk is not part of this departure at
  all. Measured once against stock DFU over the whole ARCH3D corpus:
  52,505 of 1,917,087 UVs (2.74%) differ. The 1,803 that survive matched
  precision are ledger row `:489`, narrowed at E8 and the only part of
  this that is still open work.
- **Removed, then re-integrated (AUDIT 54 F5 corrects this bullet):** the
  port's own road system was removed whole on 2026-08-29 (~5,200 lines),
  which retired the only departure that ever touched the travel law -
  `systems/travel.js` is the verbatim port again and `byRoad` is a
  permanent false. But on 2026-09-02 Hazelnut gave permission and ROADS
  22-25 brought roads BACK on the ground and on both maps: his four
  vendored arrays with the port's own generated network as the fallback,
  painted in the shared terrain kernel, ALWAYS ON IN BOTH LANES by Mac's
  call. It has its own Port-Ledger section A row; the travel half is
  still gone.

---

## Overall

The superseded page's structural claim was that the port's LAW is at or
very near 1:1 and its WIRING is not. The law half is unchanged and
re-measured: 905 `Arch3dPatch` entries, 682 `borderRegions` cells, 171
`defaults.ini` keys, 133 songs and 39 playlists, 45 encounter tables,
120 class questions, 91 effect keys with none inert, 82 quest actions in
declaration order matched one-for-one against 82 C# classes, and an
auto-emissive table that diffs 182-for-182 against `TextureReader.cs`
including the three entries DFU comments out. Three of the superseded
page's own figures did not survive re-measurement and are corrected here
(182 not 157 emissive records, 62 not 63 MobileEnemy rows, 76 not 74
named sound clips) - all three from the port's side, all three gated.

The wiring half has moved further than any single wave in this repo's
history: 207 commits, +24,781 lines of `src/`, +907 tests measured from
AUDIT 44's commit (`Audit-49.md` counts +676 over the campaign's own
narrower window), and the two largest genuinely-unbuilt reference
surfaces built. What it did not do is retire the class. `Audit-49.md`
measured 43 of 61 code defects in the campaign as a missing caller or a
missing clause - the same shape, found in a tree the campaign had just
rewritten 40,000 lines of - and this page's own sweep turns up the
newest instance inside the primitive built to narrow it:
`windowStack.paused()` is defined and read by nobody. The seam is not a
backlog that drains; it is what porting a component-and-event engine
into a module-and-host one costs.

What is genuinely left is small, and it is now named to the line.

**Nine sites carry a blocker.** Four cannot move at all while the
surrounding decisions stand: there is no standalone dungeon scene in
DFU to port `?dungeon`'s window seams from, there is no
`PlayerTorch.prefab` anywhere in the reference tree (twice), and there
is no mod system for `PauseOptionsDropdown` to list. The fifth - the
ship pixels no one could check without MAPS.BSA - closed on 2026-09-03
when the owner supplied the file; the data gate that reads it lives in
the suite and skips itself when it is absent. Two were host scope on
the port's own dev routes, and QX1/TP2 (2026-09-03) read both again:
`?exterior`'s PX3 was a missing construction rather than a missing
target and SHIPPED whole, and its Recall NARROWED to the single
cross-LOCATION jump a route with no streamer cannot arrive at - so ONE
host-scope sentence stands where two did, plus the standalone dungeon's.
One is an owner's design call - focus order across the
enhanced menu's rail. One is a layer the port does not have, the
gamepad, and it takes the two input-config windows with it. One - the
~300-entry macro handler table - is effort, and the largest single
piece of effort named on this page.

**Six sites are multi-host wires** whose shape is written down at the
site: an exterior NPC pass that has to run after the quest bridge
exists, a Currency interception at the transfer door, a scroll-index
hit threaded through the chargen flow, a console host, a
renderer-owned viewport rect, and one veto term.

**One is not a flag at all** - a retirement record the grep cannot read
the tense of, which is the price of the only part of the record that
could not otherwise lie.

**Eight ledger rows still owe work and six more have gone stale under
the campaign that ran past them**, which is the same rot section C's own
preamble warns about, arriving again.

**One classic presentation surface has no port and, until this page, no
record**: `FPSSpellCasting`'s five element hand animations. And the
port-original render modules still have no parity oracle by
construction, which is the one hole no amount of wave work closes.
