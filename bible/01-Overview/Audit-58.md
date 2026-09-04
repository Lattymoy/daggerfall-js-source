# AUDIT 58 (it ran as 54; main's other lane published that number first) - THE WHOLE TREE AFTER THE CAMPAIGN, 2026-09-03

The question: the Road-to-1:1 campaign closed on 2026-09-02 with its own
record (`Audit-53.md`), 118 confirmed findings and a green suite. What is
still wrong with the tree that nobody has been looking for? Not the
campaign's own work this time - the whole of `src/`, measured against the
whole of DFU, by lenses chosen for the fault SHAPES this port keeps
producing rather than for the systems it happens to have shipped last.

**Sixteen finder lenses, 112 findings judged, 96 confirmed and 16 killed;
two adversarial review rounds over the fixes and over the Wave F lane
added 46 more findings judged, 41 confirmed. Eighteen fix lanes in
isolated worktrees. Nothing here has been seen in a browser.**

## On the number

This audit ran under the working label **AUDIT 54** for its whole life -
every comment, pin, test title, Testing.md row and Ledger note it wrote
said 54 - because when its first lane opened, 54 was the next free number
on this branch. It was not: main's other lane had published its own
`Audit-54.md` (PUBLISHED HERE, READ THERE) at 10:24 the same morning, and
`Audit-55.md`, `Audit-56.md` and `Audit-57.md` landed on main while this
audit's fix batches were still merging. Two lanes numbering audits out of
one shared sequence, on two branches, on the same day: the same collision
`Audit-52.md` and `Audit-53.md` record for 49, and the same one
`Audit-48.md` records for 48.

The renumber is `877916e`, and it is a rename only: **every tag this
branch wrote now reads AUDIT 58** - comments, pins, the six
`audit58_*.test.js` files, the Testing.md rows, the Ledger notes - and
main's `Audit-54.md` and its Home.md row are untouched. Nothing in either
record was merged into the other; they are two different audits that
briefly shared a name.

**Why the findings are numbered from F3.** The tree cites `AUDIT 58 F3`,
`F4` and `F5` by number **37 times across 14 files** - `src/world/terrainGenClient.js:135`,
`src/world/terrainGenWorker.js:45`, `src/world/terrainHelper.js:2`,
`src/world/roadsCache.js:17`, `src/scenes/world.js:85`,
`src/formats/woodsFile.js:93`, `test/modsettings.test.js`,
`test/audit58_terrainhelper.test.js`, `test/ledger.test.js:242`,
`test/citedrift.test.js`, `Port-Ledger.md:82-83`, `Testing.md` - and
there is no F1 or F2 anywhere. That is the collision fossilised: the
first lane minted its numbers as a CONTINUATION of main's Audit-54.md
F1-F2 (the two grass uniforms nothing reads, and `textScale`). The
renumber kept the numbers rather than re-cutting fifteen citations, so:

- **F3** - `SmoothRoads` cannot cross the seam: the switch was dropped by
  every rebuild of the network object on the vendored-data path while
  `water` survived them, so the kernel read `undefined`, `undefined !== false`
  ran the smoother anyway, and `world.js` logged ", smoothing off" on the
  exact path where it still ran. Four rebuilds in the end; the review
  found the fourth.
- **F4** - `TerrainHelper.DilateCoastalClimate` and
  `SmoothLocationNeighbourhood` had no port at all. Both are runtime data
  repairs DFU runs once at `StreamingWorld.ReadyCheck`
  (`StreamingWorld.cs:1676-1685`); `src/world/terrainHelper.js` is now a
  digit-for-digit translation of `TerrainHelper.cs:383-441` and `:443-479`
  (ocean climate 223, two passes, gradient threshold 20, the 3x3 mean
  under C#'s truncating `(byte)` cast), and the review then found that it
  rewrites the very heightmap the road bake caches over -
  `GENERATOR_VERSION` 19 -> 20.
- **F5** - the re-integrated road system shipped in the CLASSIC lane with
  no Port-Ledger section A row, and the only ROADS row on the page still
  said the system had been removed whole.

Every later lane used its lane name instead - `f2/hosts`, `f3/talk`,
`f4/pins`, `(hosts-consistency)`, `(records)` - which is why the tree
reads that way and not F6, F7, F8.

## Why the audit took this shape

**The lenses are fault shapes, not subsystems.** AUDIT 44's standing
result is that the law layer is near-verbatim and the wiring is where the
bugs live; AUDIT 53's is that the largest defect class in a fleet-built
tree is the pin that cannot fail. So the sixteen lenses were pointed at
those: one per band of behaviour (world/terrain, the four hosts, combat,
magic, talk, the native windows, the keyboard, save/load, the ear, the
classic render lane, items/economy/banking, quests), plus three that
measure the port rather than the game - **test-quality** (name the mutant
and run it), **record** (a citation is a claim), and **perf-regressions**.

**Three rules, inherited and enforced.** Every finding had to produce the
exact wrong value, not a suspicion. A remainder disclosed at its own site
or in the Ledger is a ledger entry and not a finding. And every finding
was **adversarially verified by a second agent that was told to kill it** -
the verdicts in this record are the refuters', not the finders'.

**And then the whole set was re-verified at HEAD after the fixes landed.**
That last pass is why this record's numbers need explaining, and the
explanation is below.

## The count

112 findings raised by the lenses and judged: **96 confirmed, 16 refuted.**
By fix batch:

| Batch | lanes | confirmed | major | minor |
|---|---|---|---|---|
| 1 - trees/terrain, the interior host | 2 | 9 | 6 | 3 |
| 2 - combat, gold, the host seams | 3 | 14 | 7 | 7 |
| 3 - magic, talk, windows, input, save+audio, render | 6 | 40 | 13 | 27 |
| 4 - the unpinned laws, the stale records | 2 | 22 | 12 | 10 |
| 5 - the tail | 2 | 11 | 1 | 10 |
| **total** | **15** | **96** | **39** | **57** |

By lens, and this is the audit's real shape:

| Lens | raised | confirmed | refuted |
|---|---|---|---|
| test-quality | 21 | 20 | 1 |
| record | 15 | 12 | 3 |
| ui-windows | 10 | 10 | 0 |
| world-terrain | 7 | 6 | 1 |
| hosts-consistency | 7 | 7 | 0 |
| audio-music | 7 | 7 | 0 |
| perf-regressions | 7 | 1 | 6 |
| magic-effects | 6 | 5 | 1 |
| talk-npcs | 6 | 6 | 0 |
| items-economy-banking | 6 | 6 | 0 |
| classic-render-lane | 6 | 3 | 3 |
| input-stack | 5 | 5 | 0 |
| combat-formulas | 4 | 4 | 0 |
| save-load | 3 | 3 | 0 |
| quests | 2 | 1 | 1 |
| **total** | **112** | **96** | **16** |

Fifteen lenses are named; the sixteenth returned nothing that reached
judgement. Where they landed: **84 findings cite a file in `src/`, 10
cite `bible/`, one `test/`, one `tools/`.** The most-found file is
`src/scenes/worldModes.js` with **7** - the mode machine three of the four
hosts route through - then `src/scenes/world.js` and
`Port-Status-2026-09-02.md` with 6 each and `src/ui/nativeTalk.js` with 5.

Two adversarial review rounds ran over the work itself and are counted
separately: the **review of fix batch 1** (23 agents) judged 18 and
confirmed 16, and the **Wave F exterior-host review** (32 agents) judged
28 and confirmed 25, one of them critical. **158 judgements in all: 137
confirmed, 21 refuted.**

## What was broken

### The world and the terrain

**The road height smoother wrote the transposed heightmap index.** The
port's heightmap is x-major with z fastest - `data[x * hDim + y]`
(`src/world/terrainSampler.js:139`, DFU's `JobA.Idx(y, x, hDim)` at
`TerrainSampler.cs:123`) - and every consumer in the tree obeys it.
`smoothRoadHeights` read its tile correctly at `tilemap[y * tDim + x]` and
then wrote the four corner samples from `y * hDim + x`, the mirror. A
north-south road down columns 63/64 smoothed an east-west strip at rows
63/64: road beds unsmoothed, unrelated terrain flattened. What makes it
the audit's sharpest terrain finding is the record beside it -
**`Audit-51.md` recorded a departure for exactly this transposition and
recorded it on the wrong index**, on the tile read, where `y*tDim + x` IS
the mod's own `Idx(x, y, tDim)` and there was nothing to correct. The
correction is at `src/world/roadPainter.js:300` now, with the layout
spelled out at `:273-281`, and the Audit-51 row says so.

F3, F4 and F5 above are the rest of this band.

### The four hosts

The campaign's structural class - a correct law whose host does not
deliver it - is still the largest source of shipped defects here, and it
now has a name per host.

**The interior host's active enemy database is two pools and three
readers asked one.** `interiorFoes` and `interiorGuards` are both live
inside a building; the senses feed, the enchant pool and the rest refusal
each walked only the first, so the indoor city watch was invisible to all
three (`src/scenes/worldModes.js:753-821`). **The exterior host mounted no
enchant ctx at all** - the session has ONE, and that host set none, so
every enchantment payload that needs a foe idled in the host a player
spends most of their time in (`setDefaultEnchantCtx` is imported at
`src/scenes/exterior.js:40` now, and the pool it answers with is the
live one). **`scenes/interior.js` registered a keydown listener and never
called `swallowBrowserKey`**, so F5 inside a building reloaded the page
and destroyed the session - against `src/ui/input.js:369-383`'s own law,
"one list, because there is one keyboard, and every host has to use it."
**The large HUD's sheath panel answered only in the dungeon**, three
hosts inert. The interior ray had no quest-foe click arm, so `clicked foe`
could not fire indoors; the interior rest refusal dropped
`SetEnemyAlert(true)`, the one term of the open gate the other three
carry.

### Combat

Four laws, each measured against a named line of the reference, each
reproduced numerically from the port's own modules.

- **`EnemyAttack.MeleeDamage` nulls the weapon when the target refuses
  its metal** (`EnemyAttack.cs:192-194`) BEFORE the reach test, so
  `CalculateAttackDamage`'s own material gate can never fire foe-vs-foe
  and the striker falls back to hand-to-hand. All three of the port's
  foe-vs-foe arms resolved the weapon with `chooseEnemyWeapon` alone: a
  metal-immune target took **0 forever**.
- **`DamageEquipment`'s struck-side arm could never run against an
  enemy.** DFU fills a foe's `ItemEquipTable` in
  `AssignEnemyStartingEquipment` (`ItemHelper.cs:1382-1435`); the port's
  `equipEnemy` wrote `armorValues` and a loose `weapon` and never placed
  anything in an equip table, so `FormulaHelper.cs:1095/:1113` read an
  empty one and no foe's shield or armour ever took condition damage.
- **A connecting zero-damage swing never ran the aggro pair.**
  `WeaponManager.WeaponDamage`'s damage fork ENDS at `:615`;
  `DecreaseHealth` and `HandleAttackFromSource` run unconditionally for
  any entity the swing reached, damage 0 included, and the pair inside it
  (`DaggerfallEntityBehaviour.cs:249-260`) is what turns the room. The
  port routed both through `damageFoe` alone, so a swing that connected
  for nothing left a pacified foe pacified.
- **Enemy-vs-enemy poison consumed its dose and inflicted nothing.**
  `FormulaHelper.cs:692-696` inflicts and then clears; the port hoisted
  the inflict onto an injected hook and kept the clear unconditional, and
  the foe-vs-foe payload supplies no hook.

And the **Ring of Namira billed itself in condition** where
`FormulaHelper.cs:707-716` passes a null item and discards the callback's
`durabilityLoss` - a case where the port did MORE than the reference and
that was the defect.

### Magic

**The Shield damage pool was applied only at the player's door.** DFU
mitigates in `DaggerfallEntity.DecreaseHealth`
(`Assets/Scripts/Game/Entities/DaggerfallEntity.cs:312-328`), the base
class every entity passes through, with DFU's own comment "from all
sources"; the port consumed the pool only in `hurtPlayer`
(`src/characters/playerEntity.js:150`) and the three foe doors subtracted
raw, so a Shield cast on a foe absorbed nothing. Beside it: `CastReadySpell`
had grown a magicka-sufficiency refusal DFU does not have and re-priced
the spell at click time, the six concealment effects lost DFU's
`DisplayName` override so the spell maker's slots read the wrong words,
and `GivePc`'s pending-offer law could not run.

### Talk and the NPCs

**Info mode on a static NPC ran the whole `StaticNPCClick` routing
instead of `PresentNPCInfo`.** Changing the talk tone never re-ran
`UpdateQuestion`, so the player-says panel showed the previous tone's
sentence and the Work question the player actually asked was not the one
displayed. The native talk window **never loaded TALK02I0/TALK03I0**, so
all six mode and category buttons had no highlighted or pressed state.
The topic list had no horizontal pan and no arrows. The random-name
fallback hardcoded Male where `MacroHelper.GetRandomFullName` draws the
gender from `DFRandom`.

### The native windows

**Three of the potion maker's four "Internal_Strings, recovered" messages
were invented prose.** `POTION_MIXED` read "You have successfully mixed a
potion." where `Internal_Strings.csv:853` says "Your potion has been
mixed."; `potionFailed` and `noRecipes` likewise. A comment claiming a
string was RECOVERED from the reference, standing over a string somebody
wrote, is the anti-lie law's exact failure mode, and it shipped with a
pin. **The classic inventory and trade windows never drew the two
target-icon panels** (`DaggerfallInventoryWindow.cs:49-50`, `:424-439`,
`:857-890`), so the classic lane had no encumbrance readout at all - the
rects were named in a header comment and nothing else. A repair-shop
merchant skipped `DaggerfallMerchantRepairPopupWindow` entirely; the bank
purchase list's arrows were never drawn; `ListPickerWindow` hardcoded 9
rows and the default font; the quest journal carried none of DFU's five
tooltips; the character sheet's eight attribute buttons were not
hit-tested in a file whose own header claims every DFU button is; and the
inventory transfer refusals had lost DFU's wording.

### The keyboard

**`ActivateCursor` was double-bound in both outdoor hosts** - once by the
host, once by the mode machine it builds - and `bindCursorToggle` installs
a listener per call over a module-global flag, so one Enter press flipped
twice and netted zero. **Key combos never reached the keydown dispatch:**
`actionOf(e, keys)` resolves a combo only when a held-keys Set is handed
in (`src/ui/input.js:156-177`) and no production call site supplied one,
so every rebind to a combo was dead in every host. `townTalk`'s F1-F4
interaction-mode branch sat ABOVE its own overlay gate, so the mode
changed under an open window, and the four modes were dispatched off
hardcoded F1-F4 literals that the controls window could not rebind.

### Save and load

**`cacheScene()` discarded `droppedPiles`.** `currentSceneState()` builds
three fields, `restoreInteriorScene()` reads three back, and the store
between them destructured two (`src/systems/sceneCache.js:110-114`), so
`restorePiles(undefined)` killed every live pile and restored nothing:
interior dropped loot never cached, never rode the save, and was
destroyed on every exit. **The Ledger recorded the opposite** - the
interior-dropped-piles row is struck as CLOSED ID1. Beside it, the
enhanced front door read a save's gold from `snap.items`, a place E4
emptied, so the Gold stat never rendered on any save card, and the
classic import dropped `AssignShipToPlayer`'s permanent-scene half.

### The ear

The audit's cleanest class, and the one a green suite is most blind to:
**three doors feed DAGGER.SND record IDs into index-typed entry points.**
DFU's five cast-sound constants are IDs (`EntityEffectManager.cs:44-48`)
and `PlayOneShot((uint)castSoundID)` resolves them through
`SoundReader.GetSoundIndex` -> `GetRecordIndex`; the port stored the same
five numbers (`src/systems/enemySpells.js:69`) and handed them straight to
`playOneShot`/`play3d`, which index. RDB action sounds did the same
(`RDBLayout.cs` resolves the ID once at layout), and quest `play sound`
did too - and there the Ledger records the departure as "the index/clip
lookup rides the playSound hook at play time", where **the hook performs
no lookup at all**: the recorded departure's compensating half does not
exist, so the seam is broken rather than relocated. That one is the
audit's model of a recorded departure that is not one.

Three smaller ones: the combat-voice pitch lift is computed at both
producers and read by nobody; fall damage, hard falls and large splashes
dropped `FootstepVolumeScale` (0.7) and played at full volume; the blow
that lands ON the player used EnemySounds' 1.1 scale where DFU uses
PlayerFootsteps' 1.0; and the graveyard ambient layer was armed in
`world.js` and in no other host.

### The classic lane

`OverworldRenderer.dispose()` leaked ROADS 25's road chains - the file's
own AUDIT 17e law. WX1 orphaned EE8's enhanced precipitation profile,
leaving unreachable arms and a 26,000-particle buffer the classic lane
pays for. `worldRenderGate`'s `--ground` knob became a vacuous door when
no reader of `?ground` survived the EE ground revert. And both exterior
hosts parsed the page URL every frame while precipitation was drawing.

### The pins

Twenty of the 96, and the largest single lens: laws that ship CORRECTLY
and cannot be seen to stop. Each was confirmed by running the mutant in
an isolated mirror of the tree, not by reading the test.

The two that matter most are in advancement. **The reflexes use-scale
`>> 16`** (`src/systems/advancement.js:121`) was unpinned: change it and
every skill in the game advances twice as fast, with the suite green.
**`GetAdvancementMultiplier` is a 35-row DFU table pinned at four rows**,
so Jumping and CriticalStrike floated free. Then `LootTables`' per-level
split, named in a test title and never asserted; `SavingThrow`'s
career-tolerance fold and its 5..95 clamp, reachable only from an
ARENA2-gated test; the 20% condition-damage floor roll; `AABB_TOLERANCE`
pinned against itself so the automap's containment skin could be changed
tenfold under 29 automap tests; `Random.Range(min, max + 1)` - the port's
most-repeated C# idiom - unpinned in hand-to-hand damage and in the loot
gold roll; `CalculateCost`'s second floor-of-1; `CalculateTradePrice`'s
SELL branch, pinned by inequalities only; `NormalizeReputations`'
propagation asymmetry, the one its own docblock spells out; and
`VAMPIRE_SKILL_MOD` pinned against itself beside a twin pinned against
DFU's literal.

### The record

Twelve confirmed, and they are the reason this audit's own numbering
story exists. **`Audit-54.md` carried F1-F2 while F3, F4 and F5 were
cited by number across `src/`, `test/`, the Ledger and the status page** -
a reader chasing "AUDIT 54 F4" from `terrainHelper.js:2` reached a record
that had never heard of it. Six records cited `Audit-49.md` as the
Road-to-1:1 campaign audit, which is `Audit-53.md`. **Home.md's index
listed `Audit-48.md` twice under two unrelated audits**, and `Audit-49.md`
carried a byte-identical copy of `Audit-53.md`'s description, so the
campaign had two entries and the lab-grass audit's real subject had none -
which is now pinned: `test/audit18_bible_docs.test.js`'s "names every
record" test asserts **one entry per record**, the other half of a law
that a duplicate had always satisfied. Port-Status stated three different
open-flag remainders on one page, in a paragraph that forbids exactly
that; three of its list-1 entries stood as blocked after the tree closed
them; `pauseWindow.js` cited a "Ledger A" VersionInfo row that exists
nowhere; and `windmills.js` and `dataSource.js` still rested on "the road
system was removed whole".

## The trees, and the revert that made three findings moot

Three findings in the world-terrain lens were about the 3D trees (TR1-TR6):
tree instances drawn in pixel-local coordinates with no floating-origin
translation, tree batches keyed `archive_record` globally so each new map
pixel destroyed the previous pixel's trees, and a `size[1]` read off a
`{w,h}` object that would have made every tree base and scale NaN. Two of
them were confirmed and handed to fix batch 1; the third was raised late.

**None was ever fixed, and none needs to be: main reverted the 3D trees
whole.** `6c06a28` reverted TR1-TR5, TR6 brought them back, and `585c3e2`
reverted the arc entirely; `src/render/treeModels.js` is DELETED - it
does not exist at HEAD, and `grep -rn treeModels src/ test/` returns
nothing. The batch-1
lane recorded them as CANNOT BE FIXED IN THIS TREE rather than closing
them, and the final re-verification refuted all three on the ground that
their subject is gone. They are recorded here so that if the arc returns,
its three known defects return with a record instead of a surprise -
**the pixel-local coordinates and the global batch key are properties of
the design, not of the code that was deleted.**

## Wave F, under the same umbrella

The Wave F exterior-host lane (`road/f-exterior-host`, QX1/TP2 - the
fixed-city host taking the quest bridge and the Recall arms it can) was
reviewed under this audit rather than its own: 32 agents, 28 findings
judged, **25 confirmed, 3 refuted, one critical**, all closed in one lane
with **39 mutants driven and 39 dead**.

The critical and the major beside it are one defect seen twice: **the
quest layer read the faction dictionary it does not write.**
`getFactionData` reached the raw FACTION.TXT dict while every reputation
write went to the persistent store's clone - two different Maps, so
`change repute` could never satisfy `when repute` - and the whole Person
chain's faction-store seams were unmounted three lines below a
`_questStore()` that was already defined, so `factiontype` Persons threw
and `group Resident1-4` fell to the zero faction. Then:
`makeEnemiesHostile` walked the narrowed dungeon-only pool where
`GameManager.MakeEnemiesHostile` walks the whole active database; the
bridge's `isPlayerInTown` was the loose variant where DFU's callers pass
`IsPlayerInTown(true, true)` (`GivePc.cs:84`); `makeJournalWindow` asked
`chronicleDoorReady()` BEFORE the preload that satisfies it, so L, N and
the pause Chronicle were permanently dead on the classic skin; and
`CreateFoe`'s spawn seams idled although the inside placement producer
existed. Six of the 25 are pins: the 4000 box's "two arms" passed with
the KeyA and KeyT actions swapped, a re-aim pinned a substring that
occurs twice in the file, and the questWorld read pins asserted the same
values their own stubs returned.

## What was refuted, and why 75 is not 75

The final pass re-verified **every** finding against HEAD after the fix
batches had landed, and it returned 37 confirmed and 75 refuted. Read
naively that is a 40% kill rate. It is not, and the distinction is the
most important number in this record.

**59 of those 75 refutations are findings this audit had already
confirmed and fixed.** They were judged CONFIRMED by an adversarial
refuter at their own round, handed to a fix lane, closed with a pin, and
then re-read at a HEAD where the defect no longer exists - so the
re-verifier, doing its job correctly, could not reproduce them and killed
them. "REFUTED - the defect does not exist at HEAD; it was already fixed
in-tree by commit `33ef939`" is the fix lane landing, not the finder
being wrong. By batch: 8 from batch 1, 6 from batch 2, 25 from batch 3,
20 from batch 4.

**16 findings died on first judgement, and those are the audit's real
refutations.** They sort into four shapes:

1. **The subject is gone** (1). The `size[1]` tree finding, whose module,
   test and call sites were all reverted off main - "the alleged buggy
   lines, the module they call, and the test that pins them are all
   fabricated relative to this repo."
2. **No defect against the reference** (6). The vampire clan spells' '!'
   strip, where the finding's EXPECTED value is wrong - DFU does not show
   a leading '!' on a granted spell either, so the port's strip produces
   the same string. ROADS 25's map-line alpha, whose load-bearing claim
   ("the travel map draws in both skins") is false -
   `overworldRenderer.js` never runs in the classic lane. The automap
   picker's behind-the-ray guard, contradicted by a pin that already
   kills the mutant. GR1/GR4's ground scans, whose centrepiece cost is
   imaginary. And two whose citations do not resolve on either side.
3. **The facts are right and there is no wrong value** (5). Every one of
   these is `perf-regressions`: two dead cloud uniforms WIND2 left in the
   terrain program, the target machine's per-foe candidate list, the
   interior hosts' per-light range array (which is animation state, not a
   cache), the senses context spread per foe, and two per-frame walks in
   `world.js`. No changed behaviour, no violated law, and in one case the
   site REQUIRES the allocation.
4. **The gap is disclosed, or the record already carries the
   correction** (4). `Quest.tombstone()`'s missing residence-undiscover
   sweep is an explicitly declared pend. Port-Status' list-1 citation
   property is recorded three lines below the list. `UI-Arc.md` is an
   append-only dated log that already carries the correction further
   down. And `worldModes.js`'s quest-bridge comment had been fixed by the
   Wave F review the day it was filed.

**The perf lens is the audit's negative result and should be reported as
one: 7 findings raised, 1 confirmed.** Six of the seven were accurate
observations of code that costs something and breaks nothing. That is
what happens when a lens is pointed at a property the audit has no
threshold for. The next audit that wants performance findings needs a
measured budget first, or it will spend its verification on the same six
shapes.

The two review rounds killed 5 more between them, in the same shapes: two
batch-1 review findings about interior foe pins that were not vacuous,
and three Wave F findings whose premises did not hold.

## What was closed, and what was left

**Every confirmed finding except the three trees was closed.** Batch 1's
two lanes shipped 9 repairs; the review of batch 1 (16 confirmed, folded
to 14 canonical - the same Ledger cite was found three times and the same
network rebuild twice) shipped 14 across two lanes; batch 2's three lanes
15; batch 3's six lanes 42; batch 4's two lanes 23; the Wave F lane 20.

**The final batch's eleven are closed by two lanes running as this record
is written**, and their subjects are recorded here rather than their
pins: the talk topic listbox's missing empty/null-caption fallback (DFU's
"...never mind..." row); eight unpinned laws -
`SCALED_OCEAN_ELEVATION` pinned only against itself, `specialInfectionChance`
and the lycanthrope disease-immunity term, `MobilePersonMotor`'s two
behaviour probabilities, `CalculateEffectCosts`' magnitude average
rounding, five strict/non-strict comparison boundaries across the
campaign's own arcs, a `waitCounter >= 0` assertion that cannot fail, the
BOOKS 10000->5 alias pinned on two of its four readers, and
`chooseEnemyWeapon`'s tie-break; and two records - eight `src` files
declaring a RECORDED DEPARTURE that Port-Ledger section A does not row
(the doctrine gate satisfied vacuously), and Home.md's Active-arcs index
missing the live Enhanced Environments arc. Both lanes landed after this record was written: the eight laws are pinned in `test/audit58_pins2.test.js` (squashed as 1bd7c60, 27 mutants driven, 27 dead), and the seams lane (242d2f8) shipped the talk listbox's "...never mind..." repair through `_repairCaptions` in `src/ui/nativeTalk.js`, eight owed section A rows (Port-Ledger section A stands at 77 rows, 70 standing) with a second-tier doctrine gate that resolves a RECORDED-departure claim against a row naming the file, and the Enhanced Environments arc's index row with a pin over every `*-Arc.md` in the bible.

Left, deliberately, each recorded at its site or here:

- The three tree findings, above.
- ~~`createCityGuards` takes no `makeAreaHostile` dep at all, so striking a
  passive WATCHMAN turns nobody - symmetric in `world.js` and in the
  interior host, and therefore not a one-host fix.~~ **SHIPPED (ROAD-G G1,
  2026-09-04)**, and as the whole aggro block rather than the one dep:
  DaggerfallEntityBehaviour.cs:250-261 in C#'s own order - the
  `!IsHostile` read and `MakeEnemiesHostile()` first, then
  `MakeEnemyHostileToAttacker` (which flips this guard, so reading after
  it would make the walk unreachable for the only case it exists for),
  then the ally TEAM reset - inside `damageGuard`'s existing `fromPlayer`
  gate (:203) and ahead of the Knight_CityWatch murder tally (:265-269).
  All THREE minting hosts hand in their own area: `world.js`'s
  `_makeEnemiesHostile`, `exterior.js`'s (whose hand-spelled quest-door
  join was lifted to `_liveEnemyDatabase`, so its two arms cannot walk
  different databases), and `worldModes.js`'s `interiorEnemyDatabase`.
  Pinned RUNNING against the live pool in `test/roadg_pools.test.js`.
  **G1's review closed the arm the lane missed**: an ARROW reaches a pool
  through two seams, and only `dealDamage` (inside `arrowFlight`'s own
  `dmg > 0` fork) had been wired - the unconditional `onAttackFromPlayer`
  seam, which is where :630 actually lives (`arrowFlight.js:195`), still
  excluded the guards in all three hosts that resolve a player shaft. So
  a zero-damage arrow into a pacified watchman turned nobody while the
  identical SWING turned the area. `handleAttackFromPlayer` is on the
  pool's public surface now (as the encounter pool's has always been,
  `exteriorFoes.js:940`) and all three seams route by pool membership.
- ~~The indoor WATCH refuses the Wabbajack: DFU transforms any
  `EnemyEntity` and `Knight_CityWatch` is one, but the guard pool exposes
  no remove/spawn pair. The refusal and its reason are written into the
  code rather than left as a flag.~~ **SHIPPED (ROAD-G G1, 2026-09-04)**.
  `cityGuards.removeGuard` is WabbajackEffect.cs:86's `SetActive(false)`
  - off the scene, batch freed, no corpse and no death chain - and both
  the indoor arm (`worldModes.insideReplaceFoe`) and the STREET arm
  (`world.js`'s `enchantReplaceFoe`) route by pool membership through it.
  The street half was not a leak, and this bullet does not claim one:
  that arm handed a struck watchman to the ENCOUNTER pool's `removeFoe`,
  which never looks a record up in `foes` and shares the host's one
  renderer, so the watchman got exactly what `removeGuard` gives it -
  batch freed, `dead = true`, no corpse, pruned by the next `update()`
  pass. Routing by pool membership is an OWNERSHIP law: each removal now
  goes through the pool that owns the billboard, so the two teardowns can
  diverge safely and `removeFoe`'s `questBehaviour?.notifyDestroyed()`
  stays an encounter-pool term. The re-stand is the encounter
  pool's either way, because `careerIDs` is seventeen monsters and no
  watch (:24-44). `exterior.js` still refuses, on the true premise: that
  route mounts no encounter pool above ground, so CreateEnemy has nowhere
  to mint the new career - written at the site, not flagged.
- ~~(not on this list, but the same shape and closed with them)~~ **ROAD-G
  G1 also retired EC1's last refusal**: `world.js`'s `_standLooseFoe`
  refused INTERIOR mode on the premise "interiors have no foe pool to
  stand one in", which died the day `interiorFoes.spawnFoe` went live and
  nothing went back to read it - so SoulBound's break release and the
  Sanguine Rose's Daedroth stood NOWHERE in a building. CreateFoe has no
  mode gate at all (CreateFoe.cs:195-212) and PlaceFoeBuildingInterior
  (:219-233) is PlaceFoeFreely over the building, the same member the
  dungeon arm gets; `worldModes.standInteriorLooseFoe` is that member,
  and both hosts that mount the mode machine reach it.
- `exterior.js`'s `createPlayerMagic` still carries the interior arm that
  `world.js` lost, so a player-cast spell in a building reached by that
  host sees no foes.
- ~~`UpdateRemoteTargetIcon`'s drop-icon arms and the bank purchase list's
  scroll bar - both named in the findings as optional, both left rather
  than widen a lane.~~ **SHIPPED (ROAD-G G5, 2026-09-04).** Both arms of
  `UpdateRemoteTargetIcon` (:875-884), the three cycling handlers with
  `CanChangeDropIcon` (:2104-2146) over `dropIconIdxs`, and OnPop's
  re-mint (:689-712) are built: the port's loot hook carries
  DaggerfallLoot's `playerOwned`/`TextureArchive`/`TextureRecord`/position
  now, through one shape all four hosts take, and the chosen icon rides
  the pile through `snapshotWorld`, `restorePiles`, the interior scene
  cache and the save envelope. `DaggerfallLootDataTables` went back to
  its own module (`systems/lootDataTables.js`) on the way, because
  reading its table off `systems/loot.js` built an import cycle through
  `potions.js`. `DaggerfallBankPurchasePopUp.SetupScrollBar` (:303-314)
  is drawn and hit-tested in `ui/bankPurchaseWindow.js` on ROAD-A7's
  shared `VerticalScrollBar`, beside the arrows this audit's windows
  lane drew. A corpse marker reaches the second arm too, with
  `ReverseCorpseTexture`'s own archive/record
  (`GameObjectHelper.cs:812-828`, written onto the container at
  :697-698) - the Wave G review-fix closed that arm's one loot kind, and
  made the pins behind both halves of this row behavioural. Pinned by
  `test/road_g5_dropicons.test.js` (18) and four new tests in
  `test/bankpreview.test.js`; 53 mutants driven, 53 dead.
  Recorded in `bible/10-UI/UI-Arc.md`.
- Roughly two dozen stale `exterior.js:NNN` citations across `src/`
  comments, bible pages and test headers, already stale before Wave F
  opened. A separate sweep.
- The doctrine gate's own widening: scanning every `src/` file matching
  /Ledger A/ rather than only DEPARTURE-token files reddens 17 files
  immediately. Measured, not written; the eight-file half of it is in the
  final batch.

## What this audit could not do

**Nothing in this record has been seen in a browser.** Every finding was
reproduced from code, from the reference, or by running the shipped
module or the mutant in an isolated mirror of the tree - and the classes
this audit is proudest of (the three sound-ID doors, the missing target
icons, the six unhighlighted talk buttons) are precisely the classes a
green suite cannot see and a screenshot can. The port's standing rule
since the 2026-09-01 incident still holds and still binds: **the owner's
eyes remain the only oracle for a path that has never rendered.**

## The cost

Twenty-two commits of the audit's own, between `293bdd5` and `877916e`
on 2026-09-03, from 17:13 to 23:02 UTC - **under six hours of wall clock
for the fix and review work**, on top of the finder and verification
fleets that ran before it. Those 22 commits touch **202 files,
+9,953/-1,821**: 85 in `src/`, 84 in `test/`, 18 in `bible/`, 15 in
`tools/`, 16 of them new files.

The suite went from **6,252 tests across 603 files** to **6,359 across
614** - +107 tests, +11 files, six of them `audit58_*.test.js`. Fail 0 at
every lane's gate and at the merge.

## Lessons

1. **Re-verifying at HEAD after the fixes land inverts the meaning of
   "refuted", and a record that does not separate the two lies about the
   audit.** 75 refutations, 59 of which are this audit's own repairs
   working. Any audit that runs a final pass over its whole finding set
   must report the split, or its kill rate reads as finder incompetence
   and its next round gets budgeted accordingly.
2. **The pin lens is now the biggest lens and it should be.** 21 of 112
   findings and 20 confirmed - a higher confirm rate than any behavioural
   lens in the audit. AUDIT 53 named the vacuous pin as the campaign's
   novel defect class; pointing a lens at it directly, with "name the
   mutant and run it" as the acceptance test, produced the two findings
   in this audit that could have changed every character's progression
   with the suite green.
3. **A recorded departure is only a departure if its compensating half
   exists.** The quest `play sound` Ledger row said the index lookup
   "rides the playSound hook at play time" and the hook does no lookup;
   the road smoother's Audit-51 note recorded a correction on the index
   that never needed one. Both read as disclosure and neither was. When a
   row says the port compensates elsewhere, the audit's job is to go to
   elsewhere.
4. **Numbering is shared state and nothing arbitrates it.** Two lanes
   took 54 on the same day, as two took 49 two days earlier and two took
   48 before that, and the cost was fifteen citations to `AUDIT 58 F3-F5`
   that will always start at three. The record layer has mechanical pins
   for citations, flags and index rows now; the one thing it has no pin
   for is the number on the front.
5. **A lens without a threshold spends its budget and returns nothing.**
   The perf lens: seven accurate observations, one defect. Measure first
   or do not point it.
