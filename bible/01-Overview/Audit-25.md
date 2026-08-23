# AUDIT 25 - THE COMPLETENESS AUDIT (2026-08-23)

Mac asked for "a comprehensive audit on what we need to complete the
1 to 1 port of DFU to Javascript". This page is the record.

AUDIT 23 and AUDIT 24 were PARITY audits. They read the port's own
modules against their C# originals and asked "is what we shipped
right?" - AUDIT 24 closed with 54 findings fixed and pinned across the
161 modules that cite a C# source. This audit asks the other question,
the one no previous audit has asked whole: **what has never been
ported at all?** The denominator here is not `src/`. It is the DFU
tree.

## The sweep

A real DFU checkout (`Interkarma/daggerfall-unity` master, 849 `.cs`
files, 261,659 lines) was cloned and the whole tree split into 27
subsystem groups by directory and theme, so that every non-Editor C#
file in the repository sat in exactly one group's manifest with its
line count and whether the port cites it by name. Each group went to a
surveyor told to read the behaviour-bearing C# properly - not the
headers - and classify every unit as SHIPPED / PARTIAL / MISSING /
N-A-by-doctrine with evidence on both sides. Each survey then went to
an adversarial refuter told to assume the port ALREADY SHIPS IT and to
refute by default: this project has been burned before by audit rows
that sent a slice to rebuild working code, and a false gap is more
expensive than a missed one. Four reconciliation passes ran over the
top - Port-Ledger drift, the open-flag list, cross-cutting gaps the
grouping could hide, and a playability pass walking the actual player
loop.

    27 groups   1,327 units judged   767 surviving gaps
    475 SHIPPED   238 PARTIAL   529 MISSING   85 N/A-by-doctrine

Refuters killed or corrected 84 of the claims they saw. Every number
below is post-refutation.

Baseline at the time of the sweep: `npm test` 2,492 tests, 0 fail, 180
skipped (all ARENA2 corpus gates - the audit container has no game
data, so no real-data claim in this page was re-verified against the
corpus); `npx eslint src/` clean.

## What "complete" excludes

The number is only honest if the exclusions are stated. 85 units were
judged N/A by Port-Doctrine and are NOT in any figure below:

- Unity engine scaffolding as such - MonoBehaviour lifecycle, prefabs,
  coroutines, Unity UI, Addressables. Only the behaviour Unity code
  expresses is in scope, never its plumbing.
- The mod / asset-injection tree (`Utility/AssetInjection`, 16 files,
  WorldDataReplacement, BuildingReplacement, TextureReplacement,
  ModManager) - Not planned, and already a Ledger row.
- `AudioSynthesis/*` (101 files, ~11k LOC): DFU vendors a general SF2
  MIDI synth. The port's hand-rolled FM synth is the approved
  departure and reproduces the output the game needs.
- The nine post-processing config pages (Bloom, Vignette, DoF,
  MotionBlur, AO, Dither, Antialiasing, ColorBoost, RetroMode) - they
  configure Unity's post stack, which we do not have.
- Billboard NPCs/enemies and the flat 2D paperdoll, rebuilt on the
  voxel system; TangentSolver and lightmap UVs; `Editor/`.

## The verdict

**The port is roughly two thirds of the way to 1:1, and the remaining
third is not spread evenly - it is concentrated in whole systems that
have never been started.**

The engine room is close to done. The format readers are ~93% with
real-data corpus gates. Quest core is ~97% translated - all 265
vendored quests parse and round-trip, 7,231 of 7,235 corpus action
lines resolve. Chargen is ~97% with all sixteen wizard windows built.
The enemy AI triad, the item model, the guild rank law, terrain and
streaming, block/dungeon assembly, the combat formula library, the
audio director and the talk ENGINE are all 80-95%.

What is missing is almost entirely **surface and services**: the
windows a player opens, the money they spend, the things they enchant,
the maps they read, and - in several places - the wire between a law
the port has already translated and a host that could call it.

Estimated remaining work: **~63,400 JS lines across 767 items**
(50,776 in 529 never-started items, 12,643 in 238 partials). That
estimate is the sum of 767 independent per-item guesses made while
reading the C#; treat it as a shape, not a budget. For scale, `src/`
is 88,640 lines today.

| Priority | Items | Est. JS LOC |
|---|---:|---:|
| P0 - blocks a playable/completable game | 7 | 1,180 |
| P1 - a whole named system a player would miss | 107 | 20,340 |
| P2 - a visible gap inside a shipped system | 267 | 23,308 |
| P3 - polish, quirks, residue | 367 | 18,169 |

## The seven blockers

These are the items where the port is not merely incomplete but
*unfinishable* - a player cannot get to the end of the thing.

**1. Quest foes never spawn.** `createFoeGameObjects`, `tryPlaceFoe`
and `standFoe` are consumed by `systems/quest/actions.js` (CreateFoe,
:2024-2101) and `systems/quest/sceneMount.js:177`, and **no host
supplies any of them**. Every hit in `src/` is a consumer or a
documented absence - `worldModes.js:232` "standFoe is absent",
`machine.js:162` "ABSENT createFoeGameObjects = the spawn law idles".
Consequence: no quest that requires killing or meeting a Foe resource
can be completed, and every `killed`/`injured` trigger is unreachable.
(~250 LOC for the host adapter + ~220 for the CreateFoe wave spawner.)

**2. The dungeon half of the quest scene mount does not exist.**
`Place.cs:302-360` (ConfigureFromPlayerLocation), `:511-533`
(AddQuestResourceObjects(SiteTypes.Dungeon)), `:539-556`
(IsPlayerHere). The interior adapter ships (`worldModes.js:286-298`,
~70 LOC); the dungeon one does not. Persons, Items and Foes placed at
a dungeon never stand, and `PcAt`/`IsPlayerHere` never see the player
as inside one - which is where the majority of the quest corpus sends
them. (~180 LOC.)

**3. `RespawnPlayer` / the respawn primitive is absent.**
`PlayerEnterExit.cs:430-556`. There is no host-level "put the player
*there*" - destroy the current context, set the map pixel and world
coords, re-enter as exterior / dungeon / building. Every teleport,
recall, arrest-release, load-into-a-dungeon and `TeleportPc` path
needs it. (~200 LOC.)

**4. The dungeon host's quicksave destroys quest and conversation
state.** `SaveLoadManager.cs:1113-1121, :1433-1449` save and restore
quest + conversation wherever the player stands. `world.js` fills
those slots; `dungeonContext.js` quickSave/quickLoad do not, because
`buildDungeonContext` is never handed the questBridge or the talk
trio. Save in a dungeon, load, and the quest machine and rumor mill
come back empty. (~90 LOC, and the fix should hoist ONE quicksave
composer both hosts call - two call sites of one envelope is exactly
how the halves drifted.)

**5-6. The talk window mounts one of its five pages.**
`nativeTalk.js:196` is explicit: "Tell me about / People / Things /
Work: INTERIM no-ops (pend)". Only Where-is/Location works. The
ENGINE underneath is ~95% ported across five modules and 3,000 JS
lines with mutation campaigns - so "Any news?", "Where am I?", quest
topics and organisation info are all *computed and thrown away*.
(~120 LOC for the Tell-me-about page, ~90 for People/Work.)

**7. The static-NPC conversation is never opened.**
`TalkManager.cs:2616-2663`. Every non-service static NPC and the guild
popup's TALK button route here; the port answers "You get no
response." (`worldModes.js:625`). Again the engine is complete - only
the window mount is missing. (~140 LOC.)

The shape of 4-7 is worth naming on its own: **the port has repeatedly
translated a law correctly and then not wired it to a host.** The
sharpest instance is `systems/mysticism.js`, which carries the whole
Mysticism school - `armOpen`, `triggerOpen`, `triggerLock`,
`dispelNearby`, `dispellableBundles`, `fillEmptyTrap` - and of which
**only `silenceBlocksCast` has a production consumer**. Every other
export is referenced solely by `test/mysticism.test.js`, which at
:224 actually *asserts* that the host does not call them. Open, Lock,
Dispel, Soul Trap, Create Item and Comprehend Languages are written,
tested, and unreachable.

## The systems at zero

Six named systems have no port at all. Together they are ~21,000 C#
lines and about a third of the remaining estimate.

**ENCHANTING - 0% (`Effects/Enchanting`, 24 files, 3,498 C# LOC).**
The single largest never-started system. Nothing ships: 0 of 24
payload classes, 0 of the 9 payload contexts, no
`EnchantmentSettings`/`EnchantmentParam` model, no
`DoItemEnchantmentPayloads` dispatcher, no CastWhenUsed (36 classic
spells), CastWhenHeld (25), or CastWhenStrikes (12), no
`SetEnchantments`, no item maker. `formats/magicDef.js` reads
MAGIC.DEF and `systems/loot.js` mints magic items carrying raw
`{type, param}` pairs that nothing ever fires. A magic item in this
port is a label. FormulaHelper agrees: `GetItemEnchantmentPower`,
`GetSpellEnchantPtCost` and both material enchantment multipliers are
among the methods with no trace in `src/`. (~3,700 LOC with the
core-side dispatcher.)

**BOTH AUTOMAPS - ~2% (`Automap.cs` 2,733 + `ExteriorAutomap.cs`
1,848 + the two windows 4,092, 8,779 C# LOC).** The dungeon automap
(a real 3D copy of the level revealed mesh-by-mesh by raycast, sliced
by a shader plane, with beacons, user note markers and teleporter
portals) and the town map (built from each RMB block's 64x64
AutoMapData bitmap, coloured by building type, with discovery-gated
nameplates and a collision solver). Neither exists; "automap" appears
in `src/` only in settings text and topic trees. The word does not
appear in Port-Ledger.md at all. (~4,800 LOC.)

**THE MAGIC CRAFTING WINDOWS - ~12% (7 windows, 4,581 C# LOC).** Six
of seven unbuilt: spell maker, effect settings editor, item maker,
potion maker, spell icon picker, colour picker. Only the spellbook has
a counterpart (`ui/inventory.js SpellbookWindow`), and its BUY mode is
missing. Behind all of them sits a shared unbuilt dependency: **the
effect template registry** (`RegisterEffectTemplate` /
`GetEffectTemplate` / the crafting-station catalogue), without which
no window can enumerate what a player may make. (~4,500 LOC.)

**BANKING - 0% (`DaggerfallBankManager` 690 + `LoanChecker` 73 + two
windows 1,017).** No accounts, no deposits, no loans, no letters of
credit, no house or ship ownership. The only trace in `src/` is the
constant `goldPieceWeightInKg`. `CalculateMaxBankLoan` and
`CalculateBankLoanRepayment` have no port. This also blocks the
Knightly Orders' ReceiveHouse service and the guild-promotion text
that branches on `OwnsHouse` (`guildVariants.js:189` already carries
the dead branch). (~1,600 LOC with the windows.)

**THE CLASSIC `.SAV` READER - 0% (`API/Save`, 13 files, 3,104 C#
LOC).** SAVETREE.DAT, SAVEVARS.DAT, CharacterRecord, ItemRecord,
DiseaseOrPoisonRecord, GuildMembershipRecord, TrappedSoulRecord,
SaveImage. Nothing loads an original Daggerfall save. This is the
fourteenth format reader the port owes, and the one gated system whose
absence a Daggerfall player notices immediately. (~1,330 LOC.)

**THE PAUSE MENU AND KEY REBINDING - 0%.**
`DaggerfallPauseOptionsWindow` (341) is the only in-game door to
settings/save/load/controls, and there is no `pause` anything in
`src/`. `DaggerfallControlsWindow`'s 38-action grid and the keybinding
registry behind it (`ControlsConfigManager`, 572) have no port
either - so keys cannot be rebound, and the launcher is the only way
to reach any setting. Already a Ledger row (AUDIT 24 F5) for the
pause half; the keybinding half is new. (~770 LOC.)

## Coverage by subsystem

Weighted by behaviour, as judged by the surveyor who read that group's
C# (not by item count - gaps get filed at a finer grain than shipped
work, which makes a naive item ratio misleading).

| Subsystem | Ported | Gaps (est. JS LOC) | DFU LOC in scope |
|---|---:|---:|---:|
| Quest core | ~97% law, ~65% reachable | 1,189 | 10,859 |
| Character creation | ~97% | 203 | 4,918 |
| Audio + music (game-logic half) | ~93% | 392 | 13,343 |
| Format readers / DaggerfallConnect | ~93% | 425 | 22,507 |
| Talk ENGINE | ~95% | (see window, below) | 9,324 |
| Combat formulas + weapons | ~88% | 1,270 | 6,532 |
| Utility layer (non-mod half) | ~88% | 1,540 | 31,910 |
| Block/dungeon/interior assembly | ~85% | 1,365 | 13,957 |
| Terrain + world streaming | ~85% | 359 | 4,009 |
| Enemies, NPCs, entity model | ~85% | 3,123 | 10,680 |
| Effects: Destruction/Restoration/Alteration | ~83% | 690 | 3,976 |
| Item model | ~80% | 1,283 | 7,155 |
| Quest actions | 74% (61 of 82) | 1,830 | 10,012 |
| Player motor + input | ~70% | 1,983 | 10,030 |
| Magic core | ~60-65% | 1,966 | 5,930 |
| UI toolkit + HUD | ~60% | 3,890 | 16,404 |
| Weather + lighting | ~55-60% | 985 | 2,510 |
| Scene hosts + transitions + activation | ~55-60% | 3,412 | 8,403 |
| Core windows (inventory/trade/travel/rest) | ~55% | 6,770 | 14,810 |
| Guilds, banking, transport | ~50% | 3,163 | 8,299 |
| Save + serialization | ~40% | 2,941 | 7,304 |
| Talk WINDOW | ~35% (1 of 5 pages) | 3,113 | (in talk) |
| Settings, controls, save/load UI | ~35% | 3,591 | 6,945 |
| Text resolution | ~24% by unit, ~85% by what an English player sees | 1,035 | 2,642 |
| Effects: Illusion/Myst/Thaum/Special/Disease | 29 of 67 classes live | 3,821 | 7,544 |
| Magic crafting windows | ~12% | 4,535 | 4,581 |
| Automaps | ~2% | 4,825 | 8,779 |
| Enchanting | 0% | 3,720 | 3,498 |

## Two exact accountings

Where a system has a countable surface, the audit counted it rather
than estimating.

**Quest actions: 61 of 82.** `defaultActionTemplates()`
(`actions.js:2604-2724`) mirrors `QuestMachine.cs:345-428`
slot-for-slot, and 21 of those slots are `PendingTrigger` guards
carrying the C# pattern verbatim so the line pends rather than being
mis-parsed by a later template. The 21: WhenSkillLevel,
WhenAttributeLevel, Season, Weather, Climate, RunQuest, CastEffectDo,
WorldUpdate, Enemies, ClickedFoe, KillFoe, PayMoney, JournalNote,
ChangeFoeInfighting, ChangeFoeTeam, PlaySong, SetPlayerCrime,
SpawnCityGuards, UnrestrainFoe, TrainPc, PromptMulti. The guard design
is right and should be kept; what it means is that a quest using any
of them silently does less than it says.

**The classic effect library: 60 of 82 keys land.** DFU carries 82
classic-keyed effect classes (153 effect classes in total; the other
71 are the diseases, the enchantment payloads and the Special folder,
which have no classic key). `applySpell` (`effects.js:416-763`) lands
60 and falls to `out.skipped++` for 22: CreateItem (2,255),
Disintegrate (5,255), the three Dispels (6,0-2), SoulTrap (12,255),
Light (15,255), Lock (16,255), Open (17,255), SpellAbsorption
(20,255), SpellReflection (21,255), SpellResistance (22,255), Jumping
(27,255), Climbing (28,255), MorphSelf (29,255), Charm (34,255),
Shield (35,255), the three Detects (39,0-2), Identify (40,255),
ComprehendLanguages (44,255). Ten of those 22 are the Mysticism school
whose laws are already written and unwired (above). Shield is the
sharpest of the rest: it mitigates ALL health damage in DFU and does
nothing here.

**FormulaHelper: ~80 of 97 public statics.** The 17 absent are not
scattered - they name the unbuilt services exactly:
`CalculateMaxBankLoan`, `CalculateBankLoanRepayment` (banking);
`CalculateItemRepairCost`, `CalculateItemRepairTime`,
`CalculateItemIdentifyCost` (the trade window's Repair/Identify
modes); `CalculateRoomCost` (the tavern); `CalculateShopliftingChance`,
`CalculateExteriorLockpickingChance` (crime);
`CalculateTempleBlessing`; `CalculateDaedraSummoningChance/Cost`;
`GetItemEnchantmentPower`, `GetSpellEnchantPtCost`,
`GetArmorEnchantmentMultiplier`, `GetWeaponEnchantmentMultiplier`
(enchanting); `AdjustWeaponHitChanceMod` and `GetResistanceModifier`
(whose home, `DaggerfallResistances.cs`, is likewise unported).

## What the Port-Ledger did not know

Section C of the Port-Ledger is this project's standing gap list. Of
the 767 surviving gaps, **137 map to an existing ledger row (~16,900
LOC) and 630 do not (~46,500 LOC)**. The ledger has been tracking
about a quarter of the remaining work.

That is not a failure of the ledger - it was built by parity audits,
which only see what the port already touches. But it means the ledger
cannot currently be read as "what is left". Rows worth adding first,
none of which the ledger mentions today: both automaps, the classic
`.SAV` reader, multi-slot save management, the banking system, the
keybinding registry, `RespawnPlayer`, the dungeon quest mount, the
effect template registry, HUDLarge, and the weather odds table.

## The remaining work as slices

In dependency order. Sizes are the summed per-item estimates.

**S-A. THE HOST SEAMS (~1,200 LOC, P0).** All seven blockers. Quest
foe spawning + the dungeon quest mount + `RespawnPlayer` + the dungeon
quicksave envelope + the four talk-window pages. This slice unblocks
the quest corpus, which is the largest already-built asset in the
repo, and it is small because in every case the law is already ported.
Do this first; nothing else changes as much per line.

**S-B. WIRE THE WRITTEN LAWS (~1,600 LOC, P1).** Mysticism's ten
effects to the cast engine (Open/Lock/Dispel/Soul Trap/Create
Item/Recall/Comprehend Languages), Shield, Elemental Resistance, the
three Detects, Identify, Spell Reflection/Resistance. Mostly host
adapters and effect-ladder arms over existing modules.

**S-C. ENCHANTING (~3,700 LOC, P1).** The 24 payload classes, the
settings model, `DoItemEnchantmentPayloads` and its eight call sites,
the four FormulaHelper power/multiplier methods. Depends on S-B's
bundle work. Makes every magic item in the game mean something.

**S-D. THE MONEY LAYER (~2,400 LOC, P1).** Banking core + window, the
tavern window and room rental, transport (horse/cart) + its window,
house and ship ownership, the trade window's Repair and Identify
modes, and the five FormulaHelper cost methods. Unblocks four guild
services and the ReceiveHouse promotion branch.

**S-E. THE MAGIC CRAFTING WINDOWS (~4,500 LOC, P1).** The effect
template registry first, then spell maker + effect settings editor,
item maker (needs S-C), potion maker + the twenty recipes, spellbook
buy mode, icon/colour pickers. Closes six of the seventeen unbuilt
guild service windows in one stroke.

**S-F. SAVE (~3,400 LOC, P1).** Multi-slot management with named
saves and screenshots, building-interior save, `SceneCache_v1` /
permanentScenes, the position/pose siblings, then the classic `.SAV`
reader as its own sub-slice.

**S-G. THE AUTOMAPS (~4,800 LOC, P1).** Discovery model + save first,
then the dungeon geometry build and raycast reveal, then the two
windows, then the exterior layout texture and nameplates.

**S-H. THE UI SURFACE (~10,700 LOC, P2).** HUDLarge and the active
spell icons, the window stack, the travel map's region pages and
location dots, the trade basket, the character sheet's information
dialogs, tooltips, the text box edit model, the scroll bars. Large,
parallelisable, low-risk.

**S-I. THE SPECIAL EFFECTS (~2,200 LOC, P1).** Vampirism and
lycanthropy end to end (infection -> curse -> the racial override
spine), the nine remaining Daedric artifact payloads,
PassiveSpecialsEffect. Depends on S-C for the artifact payloads.

**S-J. RESIDUE (~18,200 LOC, P3).** 367 items. Weather odds table,
EnablePlayerTorch, MacroHelper's full table (~900 on its own),
building open-hours and lock values, the interaction modes, the region
power/condition simulation (~700), RappelMotor/HangingMotor, dungeon
static NPCs, and the long tail of quirks.

## Caveats, stated plainly

- **The LOC figures are per-item guesses, 767 of them, made while
  reading the C#.** They are useful for ranking and comparing slices.
  They are not a schedule.
- **No real-data verification was possible.** ARENA2 is not in this
  container, so the 180 corpus-gated tests skipped and every claim
  about behaviour against real game data rests on the C# and on
  `src/`, not on a run.
- **"Ported" here means "the behaviour is present and reachable".**
  It does not re-litigate correctness - that was AUDIT 24's job, and
  this audit deliberately did not re-audit parity. A unit can be
  SHIPPED here and still carry a bug.
- **The refuters saw claims, not the whole survey.** They could kill a
  false gap and add gaps they met in passing, but a unit a surveyor
  wrongly marked SHIPPED was not systematically re-checked. The
  numbers therefore lean, if anything, optimistic.
