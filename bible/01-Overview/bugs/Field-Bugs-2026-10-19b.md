# FIELD BUGS 2026-10-19b - the suggestions: the metals and their price, the one weapon skill, the guild's storage, the body a level gives, the lens and the ticker

From the Discord's #suggestions, through Mac: thirteen screenshots and no words, the rule for a batch like it
(`Field-Bugs-2026-09-29d.md`) - every thread read on the real modules (six read-only lanes, one a thread), the port's
own faults fixed and pinned, and every design ask put to Mac before anything was built. Four were asked at once; the
answers are each row's. The level rolls' answer was *"Your opinion"*, and the opinion is recorded where it was built
(LEVEL-EVEN). Then Mac: *"Audit everything built"* - `01-Overview/audits/Audit-Suggestions-1019.md`, six cold lanes; what
it changed is written below as it now stands, marked with its finding's id. Renumbered 19b: main took
`Field-Bugs-2026-10-19.md` (the patreon chat), so this batch's record is this page, its pins `fb1019b_*` and its
mutants `fb1019b_*.json`.

| | Thread | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "Weapon/Armor Materials": orcs on the overworld drop Orcish "right from the get-go", "Newbies are skipping 90% of the gear material progression", "the lower end materials are harder to find than the higher end materials" | (the thread's opener) | Unleveled Loot's AddOrcish and AddDaedric read no level: an Orc Warlord's 19.8% at Luck 50 was Orcish at level 1 as at 40, a Daedroth's 19.8% Daedric, while the mod's own world roll gave Mithril or better under 0.2% of the time | asked: Mac, "Level ramp" - built (METAL-RAMP) |
| 2 | the same thread: "individual pieces of Daedric and Orcish armor are worth 10x as much as their equivalent weapons ... get tens of thousands of gold by vendoring off the daedric armor" | (the same) | the prices are Daggerfall's (one material multiplier, ItemTemplates' armour base prices 50-100 against weapons' 1-50: a Daedric cuirass 153,600, a longsword 23,040); the farm was the port's - the mod's death drops never left a `foundCondition`, so online a mended drop sold whole | fixed (ASF-DEATH); the prices asked: Mac, "Leave DFU prices" |
| 3 | "With the addition of arcane and martial specialisations": "change one of our skills out or allow some of these specializations to work with just the one weapon skill" - the window: "Your class can't master two weapon skills, so no martial path is available." | Brother Frank | a career's lists are fixed at creation; a path is a pair of masterable weapon skills (martialPaths.js martialPossible); only class skills can be mastered (masterSkills.js) | asked: Mac, "Paid skill swap" - built (SKILL-SWAP) |
| 4 | "Guild Hall Storage Improvements": no preview of a vault piece (a legendary's base, a rare's mods), no filter, the Stores' form under every stored row, the amount typed by hand, "a 'transfer all' button" - and containers in the hall | Alkfay | the vault's rows were text (the service already sends each piece's record "for the picture and the card"); the Stores' page drew every row before its form and its Units was required | built (GUILD-UX); the hall's own containers recorded, not built - every hall chest IS the vault (Guild-Overhaul.md, Seats-Arc 8.2), and a second shared store is the service's |
| 5 | "Make Health from Endurance retroactive": "people are not penalized dozens or possibly hundreds of hp for not investing in endurance as early as possible", "class health per level apply as an average", "consistently give 5 attribute points per level" | (the thread's opener) | one stored maximum, each level's roll added (advancement.js applyLevelUp, DFU verbatim): nothing past is paid back; Fortify, items and the Firmament never reach it (permanent Endurance); the pool is BonusPool's 4-6 | asked: Mac, "Your opinion" - built online (LEVEL-EVEN) |
| 6 | "Can we get panini projection as a graphics setting?" | Georgi | nothing in the tree; the renderer's "world drawn smaller and shown" present (`render/renderer.js` _retroBegin) is the seam a warp would take, and every screen-to-world read (`player/tapRay.js`) and lens sum outside the matrices would have to follow it | recorded - a renderer slice of its own (below) |
| 7 | "Add Gloves/Gauntlet materials assisting with hand to hand +to hit" (Accepted, Finished on the Discord) | NOPper | what shipped is BAL6-GAUNTLETS (`05-Combat/Balance-Arc.md`): a beast's claws take its plate gauntlets' metal as DAMAGE, the owner's choice of three; a man's fist takes no metal and no to-hit | recorded - the human fist's to-hit is not built; Mac's call |
| 8 | "Show current XP towards skill/next skill level up ticker, QoL": "20/100 ... how close you are", "explain exactly how one gains xp", "'your skills can be improved' notification ... since XP does not hang over" | Cruor | nothing read `skillUses`; a raise lands only at a rest or a journey more than 360 game minutes after the last check (raiseSkills), and below 100 the whole tally goes on a raise (DFU verbatim) | built (SKILL-TICK); carrying the overflow is a DFU departure not asked for |

## ASF-DEATH: a death drop sells as it fell (2)

`src/systems/unleveledLoot.js` dropWeapon and dropArmor.

**Found on the real modules.** SELL-AS-FOUND (AUDIT ECON O1, Port-Ledger A) marks every piece Roleplay & Realism: Items'
rolls hand over worn with `foundCondition`, and online the Sell arm reads a piece no higher (`tradeModes.js`
saleConditionPercentage). Unleveled Loot's death drops roll their own condition (30-75%, the armour's off the RANDOM
piece's smaller maximum) on the corpse after the body's roll has run (`hostCombat.js` spawnEnemyLoot, then
`corpseMarker.js` raiseEnemyDeath), so they carried no mark: a Daedric piece off a Daedra Lord or a Daedroth, mended at a
smith, sold whole online. The thread's "tens of thousands of gold" is that.

**The fix.** Both drops leave the condition they rolled as `foundCondition`. The mod's rolls and draws are unchanged; offline
nothing reads the mark. The armour's condition, read off the random piece, is never over its own piece's maximum (AUDIT
L1-2: the ramp's lighter plate could stand at 135% of its own, a departure from 1.1.2 named in `06-Systems/Unleveled-Loot.md`),
and a bounty's reward, which rolls its condition too, is marked as found (`bountyReward.js`, AUDIT L1-3). `test/systems/fb1019b_deathdropfound.test.js` (2, red on the code before);
`tools/mutants/fb1019b_deathdropfound.json` (3, 3 dead).

## METAL-RAMP: the top metals come with the level (1)

`src/systems/unleveledLoot.js` (`METAL_RAMP_FULL`, `rampMetal`, addOrcish and addDaedric's `level`, unlevelDroppedLoot).

A drop the mod's roll grants is its race's metal on a draw of `Range(0, 20)` under the killer's level - one draw more,
taken only under 20 and only once the mod's roll has granted the drop - and otherwise the level's rung of the middle
metals: Elven at 1-4, Dwarven 5-8, Mithril 9-12, Adamantium 13-16, Ebony 17-19 (plate of the same metal for the armour
arm). At 20 and up the mod stands exactly as it was, stream and all. The level is the raiser's: a room's base rolls at
the room's (`roomLootHost.js`), a kill at the player's - and for the whole raise the mod's Luck and level are the
raiser's, so an armour drop's own CreateRandomArmor, which reaches the mod's RandomArmorMaterial, rolls the same on every
client of a room (AUDIT L1-1; a fault older than the batch). The middle metal goes through the Mods pane's material
switches as the race's does (AUDIT L1-4). So a level-1 character's Warlord gives Orcish on 1 kill in 20 of
the mod's 19.8%, and Elven on the rest - the top two later, the ones under them more often, which is the thread's ask
in both halves. The odds of a drop at all, the gold's division and the Mods pane's switches are the mod's.

`test/systems/fb1019b_metalramp.test.js` (4); `tools/mutants/fb1019b_metalramp.json` (7: 6 dead, and one - the corpse's
level dropped - equivalent since AUDIT L1-1, the raise's default level being the raiser's). PIN MOVED:
`unleveledLoot.test.js`'s corpse test takes the ramp's draw into its four granted drops' streams (at level 10, under the
ramp's full level); what it pins of the mod is unchanged.

## LEVEL-EVEN: the body a level gives, evened online (5)

`src/systems/levelEven.js`, `src/systems/renownLayer.js` (the floor a term of the online layer; `refreshOnlineLayer`),
`src/systems/firmamentPowers.js` (the stars' Endurance handed to the layer each round), `src/systems/advancement.js`
(`bonusPoolFor`'s online 5; the refresh after a level), `src/systems/oblivionLeveling.js` (the refresh),
`src/ui/levelingChoice.js`, `src/ui/levelUp/levelUpView.js` (the words).

**Mac's answer was "Your opinion".** The opinion, built:

- **The floor, retroactive.** Online the maximum health is never below `25 + h + (level - 1) * max(1, avg + HitPointsModifier(END))`
  - RollMaxHealth's level 1, then every level at the class's average CalculateHitPointsPerLevelUp roll with the
  Endurance the character has NOW. So raising Endurance pays every level back (the thread's ask), a run of low rolls is
  lifted to the class's average (the averaged roll's ask, without taking the high rolls away), and nobody's health falls.
  Endurance there is the permanent one with the Firmament's stars in it (awake online alone), not a spell's or a ring's:
  those come and go mid-fight and no stored health reads them, and with no service checking health a fortified body
  would be a lever. The thread's "+1 hp/lvl for each 10 over 50" is already the rule (`floor(END / 10) - 5`).
- **On the online layer, never in the save.** The floor's health rides `renownHp` with Renown's and the Firmament's
  (`renownLayer.js`), so the save keeps the stored maximum and the health at its share (`offlineVitals`), offline is
  Daggerfall's own, the lycanthrope's limiter caps Daggerfall's maximum beneath it as it does Renown's (AUDIT RENOWN1
  GAME-4), and it is read again at every magic round, and at every level-up on both leveling lanes once its points are
  spent (the Oghma Infinium's and the classic rollout's too) with health kept as it stands, not rescaled (AUDIT L2-1,
  L2-2). Mentor mode sizes its body off the stored maximum and the floor's share (`evenHp`, AUDIT L2-3); the
  Firmament's small health stars take their share of the floored body (AUDIT L2-4).
- **Five points a level, online.** BonusPool's Range(4, 7) has a mean of 5; online every level hands out 5, drawn from no
  stream. A level already pending keeps its drawn pool.
- **Not built: the averaged roll itself.** With the floor, an unlucky roll is lifted and a lucky one kept; replacing the
  roll would take the lucky one away.

Balance: BAL11's threat table (`05-Combat/Balance-Arc.md` section 17) was tuned on the rolled health; the floor raises a
below-average body to the average and nothing above it. `test/systems/fb1019b_leveleven.test.js` (7);
`tools/mutants/fb1019b_leveleven.json` (13, 13 dead).

## SKILL-TICK: how close a skill is, and when it will rise (8)

`src/systems/advancement.js` (`skillAdvanceProgress`, `skillsReadyToImprove`), `src/ui/enhanced/enhancedCharSheet.js`
(the model's `progress`), `src/ui/enhanced/enhancedMenu.js` (`skillTickText`, the Stats page's line under each bar),
`src/ui/levelUp/levelNotice.js` (`NOTICE_IMPROVE`, the strip's standing line), `src/systems/tutorialCatalogue.js`.

- **The ticker** is raiseSkills' own test read ahead of the pass: the uses as Reflexes scales them against
  GetSkillAdvancementRequirement's number (the class's multiplier and the level in it), and past 100 a mastered skill's
  banked progress against the ladder's price (MOVE-BANK's units). Under every skill bar on the enhanced Stats page:
  *12 / 40 uses to the next point*, *Ready - rest or travel to raise it* - or, while raiseSkills' 360-minute gate is
  shut, *Ready - a rest or journey raises it once 3 more hours have passed* (AUDIT L3-1) - or why it will not: *At its
  limit*, *At 100 - master it to climb further*, *Held while a primary skill is at 100* (AUDIT L3-3), the held ones
  saying their uses are not kept, which is the thread's "does not hang over". The 95 lock is read in the pass's own
  order, so a primary the pass takes from 99 to 100 holds a later skill (AUDIT L3-2). A seeded sweep of 160 characters,
  99s among them, pins the reading to the pass's own result.
- **The notice**: while any skill is ready and the gate open, the HUD strip carries a standing *Skills can be improved*
  line (*1 skill is ready - rest or travel to raise it*, *N skills are ready - ... them*), just above a level's row,
  counted only while the strip shows and building nothing (`countReadyToImprove`, AUDIT L3-4).
- **The how**: the tutorial's character page says when a used skill rises (a rest or a journey, at most once every 6
  hours), and on the enhanced skin alone where to look (AUDIT L6-4). The thread's point-for-point table of every skill's uses is not written: it is 35 skills'
  worth of the game's own call sites (`hostCombat.js`, `hostMagic.js`, `worldTick.js` and the rest), and the ticker shows
  the number each of them moves.
- Classic skin: nothing drawn (THE NATIVE-WINDOW RULE; DFU's sheet has no such line).

`test/systems/fb1019b_skilltick.test.js` (6); `tools/mutants/fb1019b_skilltick.json` (11, 11 dead).

## GUILD-UX: the vault's cards and filter, the Stores' form first (4)

`src/ui/socialPanel.js` (guildVaultNodes, guildStoresNodes; `vaultRowAccepts`, `guildPutAll`; the panel's `itemCard`).

- **The vault's card.** Each row with a record carries the pack's own card (`enhancedInventory.js` showItemHover, the
  SHOP-HOVER card - stats, affixes, set, against what is worn): a mouse's pointer brings it and takes it, a press of the
  name toggles it, asked past the hover setting (a finger's only preview); it goes at every repaint, the panel's close
  and its teardown (AUDIT L4-2, L4-3). The enhanced skin's alone (AUDIT L4-4). Rows and their search name a piece as
  the pack does - an unidentified one by its kind (`vaultRowName`, AUDIT L4-6).
- **The vault's filter.** The stores' own (`storeFilter.js`): a search over the name the row shows, the pack's pages and
  the rarities, each listing what this vault holds with counts. Rows are hidden in place, so the search keeps its focus as
  it is typed; the filter holds across a repaint and is let go with another vault; a filter that hides every row says so
  (AUDIT L4-7).
- **The Stores' form first**, the stored rows after the acts; **Units left empty is all of it** (the vault's How many
  already was) - all held that the guild has room for on the way in, all you may take that your Stores have room for on
  the way out, the character's room read over every origin the service counts (AUDIT L4-1).
- **Put in all**: every material of the character's Stores, each to the guild's room for it, one deposit after another
  through the writs book's own door, so every check the service makes and the writs' hour budget stand. A refusal stops
  the run and says what went in and why (AUDIT L4-5); what went in stays in.
- Not built: the hall's own containers (row 4). The sluggishness is the vault's three round trips a piece (a checkpoint,
  the act, a read again); a remote pane in the pack with its own act would cut it, and is a slice of its own.

`test/net/guild/fb1019b_guildux.test.js` (10, six of them AUDIT L4's); `tools/mutants/fb1019b_guildux.json` (12, 12 dead). PIN MOVED:
`prof6_client.test.js` and `audit31_client.test.js` find the Units field by its new label.

## SKILL-SWAP: a class skill changed, for gold (3)

`src/systems/skillSwap.js` (`SKILL_SWAP_GOLD` 100,000, `swapOutChoices`, `swapInChoices`, `skillSwapRefusal`, `swapSkill`),
`src/ui/growth/specGuide.js` (the model's `swap`, `drawSkillSwap`, the never-headline's hint).

One class skill the character has not mastered is given up, and one miscellaneous skill takes its place in that same
group - so the 2/2/1 masteries and every slot spent stand. A mastered skill never leaves (a mastery is permanent; a held
path is two of them). Values do not move. The career becomes the character's own copy (the save keeps it whole); its
name and every other term stay. **The level does not move**: the classic sum is the class's skills', and the stored one is
the sum the level stands on - a trained skill brought in moves both sums by its rise above it and pays no levels, an
untrained one moves neither, and its ground is the class's skills' to make up before the next level comes closer
(SWAP-CYCLE, `Field-Bugs-2026-10-20g.md`: both sums had moved by a drop too, and a class cycled through every skill
reached level 223). The progress to the next level stands. Paid as SPEC-RESET is (coins, letters, online the Empire's account), at half its price; the
price is a first setting, one constant. On the Growth tab's Specialisations page, under the paths: the two picks and the
swap, asked first. Brother Frank's class (Blunt mastered, no other weapon in it) gives up a minor skill for Long Blade and
the Blunt-and-Long-Blade paths open. The never-headline's hint shows only where one swap opens a path (`swapOpens`, AUDIT
L5-1); a swap into a group whose slots are spent, or one that starts or ends DFU's 95 lock, is said beside the picks and
in the ask - a warning, not a refusal (AUDIT L5-1, L5-2). The swapped career is marked (`swapped`), so an heir keeps it
(`legacy/family.js`, AUDIT L5-4). No fold reads the career's lists, so the swap folds nothing (AUDIT L6-2).

`test/systems/fb1019b_skillswap.test.js` (5); `tools/mutants/fb1019b_skillswap.json` (10, 10 dead). The page is pinned
drawn (`test/ui/growth/fb1019b_swappage.test.js`, AUDIT L6-1); the audit's laws, every lane's, in
`test/systems/fb1019b_audit.test.js` (19) and `tools/mutants/fb1019b_audit.json` (42, 42 dead).

## Recorded, not built

- **Panini projection (6).** A third frame kind beside retro and render scale in `Renderer._retroBegin`: the world drawn
  at a wider lens into the image and presented through the Panini mapping, the 2D pass, the HUD and the hands after it
  unwarped. Everything that reads the screen through the rectilinear lens has to follow it - `player/tapRay.js` (taps, the
  travel view's picks, the lock-on dot, the card table's cursor), the nameplates (`net/remotePlayers.js`, `ui/nameLayer.js`),
  `ui/worldPlaque.js` reticleAnchor, the climb hands' lens and the thunderlock's muzzle - while the centre ray holds. A
  graphics row of its own (`systems/features.js`, Off and strengths), five hosts' projections. A slice for the renderer.
- **The gauntlets' to-hit for a man's fist (7).** BAL6-GAUNTLETS measured the to-hit shapes for the beast and the owner
  chose damage alone; the human fist was never asked.
- **The hall's containers (4)** and **a point-for-point skill table (8)**: above.
