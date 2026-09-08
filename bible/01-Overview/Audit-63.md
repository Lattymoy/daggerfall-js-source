# AUDIT 63 - THE SYSTEMS THE FAULT-SHAPE AUDITS UNDER-SAMPLED, 2026-09-08

The question: AUDIT 58 read the whole tree by fault SHAPE - the missing
caller, the four-hosts miss, the constant where DFU reads a value, the
pin that restates the port. AUDIT 62 read the fifteen-thousand-line
delta since. Neither read a SUBSYSTEM against the whole of its DFU
counterpart - every public member of the C# class, every arm of every
switch, every table value - and the classic systems that no incident,
no mod and no arc had touched since the campaign closed had not been
opened in that way at all. This audit opened ten of them.

**Ten subsystem lenses, 52 findings judged by two Opus refuters each, 50
confirmed and 2 refuted. Seven fix lanes in isolated worktrees, each
followed by its own adversarial reviewer and a fixup round.**

## Why the audit took this shape

The fault-shape audits find what they are shaped to find. Three
audits running the same lenses over a tree that had already been
fixed for them were reporting diminishing returns (AUDIT 62 confirmed
39 over a delta; the whole-tree AUDIT 58 confirmed 96), and the
subsystems with the largest DFU surface - the quest machine, TalkManager,
the guilds and the court, the effect library, ItemBuilder and the loot
tables, the save envelope, FormulaHelper, DaggerfallAction, the classic
windows - had each been ported in slices over weeks and reviewed slice
by slice, never whole. So each lens took ONE subsystem and its ONE C#
counterpart and read both end to end, with a tenth lens sweeping all of
them mechanically for exports without callers, writes without readers
and cited members with missing arms.

| # | Lens | What it read | Judged | Confirmed |
|---|---|---|---|---|
| 1 | quests | `systems/quest/*` against `Questing/*.cs` - every action class, resource type, timer and the tombstone | 4 | 3 |
| 2 | talk | `talk.js`, `talkMacros.js`, `townTalk.js`, `nativeTalk.js` against `TalkManager.cs` whole | 5 | 5 |
| 3 | guilds-court | the guild, faction, reputation and court modules against `Guilds/*.cs`, `PlayerEntity.cs`, `DaggerfallCourtWindow.cs` | 5 | 5 |
| 4 | effects | `effects.js` and the enchantment modules against `EntityEffectManager.cs` and `Effects/*.cs` | 5 | 5 |
| 5 | items-loot | the item, loot, inventory, equip and potion modules against `Items/*.cs` and the loot tables | 7 | 6 |
| 6 | saveload | every serialize/restore seam against `Serialization/*.cs` and the classic-save loader | 8 | 8 |
| 7 | formulas-entities | `formulas.js`, `enemyBasics.js`, the player entity and advancement against `FormulaHelper.cs`, `EnemyEntity.cs`, `PlayerEntity.cs` | 4 | 4 |
| 8 | world-actions | `world/actionSystem.js` and its host seams against `DaggerfallAction.cs`, `DaggerfallActionDoor.cs`, `RDBLayout.cs` | 6 | 6 |
| 9 | windows-classic | the twelve largest classic windows not reviewed in the last two audits against their `UserInterfaceWindows/*.cs` | 4 | 4 |
| 10 | missing-caller | the mechanical sweep over `systems/`, the action system and the windows | 4 | 4 |

Every finding went to two adversarial verifiers prompted to REFUTE it
with the reference open; a finding survived only if both upheld it, and
each verifier's corrections to the finder's proposed fix travelled into
the lane brief - several of the fixes below are the verifier's shape,
not the finder's, and the lanes' notes record where the two disagreed.
114 agents, 12 million tokens of reading, four hours wall-clock at two
agents abreast.

## What was refuted, and why

- **JournalNote / AddFinishedQuest draw their message variant off
  Math.random, not the quest's roll stream** (quests) - `Message.cs:160`
  draws the variant from `UnityEngine.Random`, the engine-wide unseeded
  stream, and both C# callers call `GetTextTokens()` bare; the Ledger's
  engine-PRNG rule maps exactly that to an injectable uniform roll. The
  port is the recorded shape and the difference is unobservable.
- **Enemy weapons are never poisoned** (items-loot) - the finding's
  central claim, that no site writes a poison onto a weapon, was false:
  `ItemHelper.cs:1459-1477`'s arm is ported verbatim as
  `poisons.rollEnemyWeaponPoison` one level up the spawn chain (the
  level-1 gate, the class and Orc/Centaur arms, the assassin's 60
  against 5, the eight weapon poisons). Only the comment the finder read
  was stale.

## What was broken

The detail lives on the arc pages under dated "AUDIT 63 F<n>" headings;
this is the map. Finding numbers are the fleet's (F0-F49); the lanes
are the seven the fixes ran in.

### Quests, talk and the NPCs (11)

- **F0 - a quest's residences were never un-discovered.** `Quest.cs:649-656`'s
  tombstone sweep over every Place had been replaced by a stale "no
  Places resolve to buildings yet" comment. It runs verbatim now, through
  a hook both bridge hosts fill, unfiltered as C# sweeps (the store makes
  the three refusals). The review round found the lane had ARMED the
  matchName gate for a fixed Building Place where DFU leaves it
  disarmed, and corrected it.
- **F1, F2 - the questor's behaviour.** `AddQuestor`'s individual-NPC
  scene relink (`:481-497`) and `DropQuestor`'s component destroy
  (`:519-523`) had no port - and nothing TICKED a static NPC's
  `QuestResourceBehaviour` at all, so its first clause never ran. Both
  hosts tick them now, outside the pause gate as the flats' loop is.
- **F3 - talk refusals were HUD lines.** `TalkToNpc`'s rejection and
  no-response boxes ran no macro pass and were not message boxes. They
  go through `SetTextTokens`' shape now (the whole record, no draw; the
  null-MCP macro pass `MacroHelper.cs:502-527` gives, so `%oth` is the
  sentinel DFU shows).
- **F4 - the reaction tier read base Personality** where
  `TalkManager.cs:665` reads `LivePersonality`.
- **F5 - the talk window had no Copy-to-logbook.** `DaggerfallTalkWindow.cs:725-737`'s
  button, the selection and copy marks, the `OnPop` builder into the
  Notebook. The review round found a fresh window selecting the greeting
  where `ListBox.SelectNone` selects nothing.
- **F6 - `reactionMods` was minted five long** where `socialGroupCount`
  is 11, so the Masque of Clavicus Vile's walk and `TalkManager.cs:558`'s
  unclamped term dropped social groups 5-10.
- **F7 - the popup Talk button dropped the questor door**, so in a
  Fighters Guild hall (whose NPCs never reach `talkToStaticNPC` by the
  other route) the button did nothing.
- **F46, F47 - two writes with no reader**: `personWantsToStop`'s
  `inBeastForm` term (townsfolk idled politely for a werewolf), and the
  racial-override door on `talkToNpc` (`TalkManager.cs:2618-2628`, the
  FIRST door) whose `suppressTalk` dep nobody supplied.
- **F49 - `DiscoverBuilding`'s quest name-override arm** was cut whole:
  `isOverrideName` had no writer, so a discovered quest residence drew no
  plate. Two lanes reached this member at once (F9 below wrote the
  override form too); the fuller port, with the quest consult, is the one
  kept.

### Guilds, factions and the court (6)

- **F8 - the classic-save import wrote the FACTION.TXT name into
  `membership.guild`**, so every guild consumer read an import that
  matched nothing. `ImportMembershipData` rebuilds the guild object.
- **F9 - `RevealGuildHallOnMap`** (Thieves Guild, Dark Brotherhood) had no
  port, and neither had the override form of `DiscoverBuilding` it needs.
- **F10, F11 - the court's not-guilty roll and the temple's cure price
  read PERMANENT Personality**; `CalculateTradePrice` reads the live stat
  at seven call sites the lane rewired.
- **F12 - `MakeSpells` opened the spell maker for a player with no
  spellbook**; the popup's gate (`DaggerfallGuildServicePopupWindow.cs:389-395`)
  boxes "You have no spellbook!" first.
- **F33 - `ActivateMobileEnemy` had no port at all**, so
  `CalculatePickpocketingChance`'s enemy arm had no caller. Wired into
  all five activation ladders; the review round found the new NEAR call
  dispatched foe-first rather than nearest-hit and fixed the order.

### The classic windows (7)

- **F42 - the potion maker's RECIPES button was permanently dead**: it read
  a field nothing in `src/` wrote. It reads the recipe ITEMS in pack and
  wagon now, as `DaggerfallPotionMakerWindow.cs:143-172` does.
- **F43 - its ingredient grid omitted the wagon**; the review round
  found the lane's inline stack-finder had dropped `IsStackable`'s
  quest-item/summoned/equipped disqualifiers.
- **F44 - the guild service popup closed itself on TALK**, the one
  sibling DFU leaves standing under the conversation; the interior
  restore the review found unpinned and lost through the fallback's
  re-mounts is wired and pinned.
- **F45 - the bank's Escape** cancelled the amount field instead of the
  window (`DaggerfallPopupWindow.cs:65-75`).
- **F48 - `DaggerfallTradeWindow.DoSteal` was unported**: the shop
  screen's STEAL button was a no-op. `shopliftAttempt` is
  `privatePropertyTheft`'s sibling, wired through six steal hooks the
  review round then pinned.
- **F34, F35 - the character sheet's skills dialog** omitted the
  hand-to-hand damage line and truncated each group to nine rows, hiding
  14 of the 23 Miscellaneous skills. The review round found the new
  centred panel covering the attribute buttons and moved it.

### The effect library (5)

- **F13 - `SyntheticTimeIncrease` was absent.** Fast travel, prison time
  and a long rest ran the whole catch-up through `ItemDeteriorates`,
  `HealthLeech` and every other per-round effect where DFU raises the
  broker's flag and those arms return. A new `effectBroker.js` leaf holds
  the flag and its Update-tail lifecycle; three arms early-return on it
  at DFU's own positions. The forced `RerollItemEffects` pass at the
  window's tail is recorded, not built (below).
- **F14 - Soul Bound offered all 43 souls without a filled trap** and
  enchanting consumed none. Both halves ported; the review round found
  the only host wiring unpinned and the label/param alignment guard
  untested, and pinned both.
- **F15 - `MakePcDiseased` bypassed `IsEntityImmuneToDisease`**, so a
  vampire caught a quest-inflicted plague.
- **F16, F17** - Silence never printed "You are silenced."; Create Item's
  conjured lifetime was one classic minute long (the pre-initial-round
  duration).

### Items and loot (7)

- **F18/F32 - `GetMaterialArmorValue`'s artifact halving** was unported:
  Lord's Mail and Ebony Mail gave double DFU's protection. One law, seen
  from two lenses.
- **F19 - the `%mod` macro ignored the shield delegation**, so every
  shield reported its plate or leather rating.
- **F20, F21 - the icons.** `PotionRecipeKey`'s texture-record side
  effect was unported (all twenty potions drew one bottle), and the
  inventory icon never read the item's own texture fields (every artifact
  drew its base template's icon).
- **F22 - interior Treasure markers spawned no loot**: taverns and the
  two guild hideouts had no random-treasure pile
  (`DaggerfallInterior.cs:879-901`). The review round pinned the host
  wiring three mutations had walked past.
- **F23 - the broken-item gate** sat on the equip table instead of the
  inventory window, and leaked into the classic-save import (a worn
  0-condition piece would not relink).

### Save and load (8)

- **F24 - interior foes and interior guards were in NO save envelope**
  (the fourth host's enemy half); `SerializableEnemy.cs:236-243` has an
  explicit Interior arm. The review round found the quest-link revival
  never wired into the exterior pool while the arc page said it was.
- **F25 - `WeaponManager.UsingRightHand` was never saved**: every load
  came back right-handed. And **F31** - the classic-save import dropped
  `UsingLeftHandWeapon` (the helper had had no production caller).
- **F26 - an enemy's TEAM and ally status were dropped by both foe
  snapshots**: a quest ally reverted to hostile on load.
- **F27 - a Daedra Seducer's completed transformation was not saved**;
  restored through the setter, never a raw field.
- **F28 - load never ran `RemoveAllOrphanedItems`**. The review round
  found the lane's sweep deleting every port item with no `name` -
  alchemist potions, treasure maps, recipes - on every load, and fixed
  the predicate to DFU's (quest gone or tombstoned, else empty
  shortName).
- **F29, F30** - `WabbajackActive` and `PlayerTeleportedIntoDungeon` rode
  no envelope.

### The RDB action system (6)

- **F36 - the enemy door seams tested the action-FLAG family instead of
  the door COMPONENT**, so no foe ever opened an ordinary dungeon door
  (`EnemyMotor.cs:1159` and `EnemySenses.cs:913-918` both
  `GetComponent<DaggerfallActionDoor>()`). One shared helper at all three
  sites; **F40** - the pin that had asserted the port's wrong predicate
  is behavioural now, over a real `ActionSystem`. The review round
  refuted the lane's deferral of the building-interior mount and closed
  it too; the open-street half stays open (below).
- **F37 - a moved action model kept its at-rest activation box**; the
  activate and attack rays test a live box now (a third reader, the
  interior ray, found by the review).
- **F38 - action DOORS were excluded from the collision-trigger pass**.
  The lane departed from BOTH verifiers here, more faithfully: the pass
  MEASURES a door live, since DFU's `BoxCollider` rides the transform.
- **F39, F41** - DoorText's HUD delay is 2.0 s (`DaggerfallAction.cs:875`);
  an armed Lock is checked before an armed Open (`PlayerActivate.cs:693-695`),
  without the finder's bare inversion the verifiers refuted.

### The record

Seven new test files (`audit63_*.test.js`), 27 review findings all
applied, and every touched Testing.md row extended. Two lanes converged
on one member (`discoverBuilding`), two lanes on one Ledger row (the
classic `.SAV` reader): both reconciled at integration, keeping every
edit.

## Integration

Seven lanes squashed one commit each onto the audited commit, then main
(which had taken the Volumetric Clouds arc, PR #66, meanwhile) merged
in: 31 hunks across the lanes (all doc unions or the two overlaps above)
and two against main. Every cite re-resolved by provenance across the
base, the seven lane tips, main and the squash - 510 moved - with four
re-resolved by content, one slash-pair and one wrapped route cite set
by hand, and hudlarge's D10 window widened to the ladder AUDIT 63 F33
grew. Home.md's open-flags block regenerated; Testing.md recounted.

## What was left, and by whose decision

- **F13's forced reroll.** `OnEndSyntheticTimeIncrease` runs
  `RerollItemEffects` at the tail of a synthetic window
  (`EntityEffectBroker.cs:244-245`); the lane ported the flag and its
  three early-returns and left the reroll pass, on the verifiers' own
  reading that it is a separate member with its own pin.
- **F36's open-street half.** The street mounts construct `EnemyAI` with
  no `isActionDoor` dep because nothing above ground registers an
  `ActionSystem` door; the reviewer agreed the seam is inert there and
  the lane left it unbuilt rather than wired to nothing.
- **F9's FACTION.TXT wait** in `world.js`'s reveal (the reviewer's one
  uncertain finding) - the exterior host waits, the world host does not;
  recorded on the arc page for the next hosts round.
- Nothing here has been seen in a browser. The surfaces that want eyes
  first: the potion maker's RECIPES and wagon ingredients, the talk
  window's logbook button and the copied notes, the skills dialog's new
  panel, the shop's STEAL, a Thieves Guild hall on the town map, and a
  dungeon foe opening a door.

## The cost

The audit fleet: 114 agents, 12 million tokens, four hours. The fix
fleet: 21 agents (seven lanes, seven reviewers, seven fixups), 5.4
million tokens, 2,606 tool calls, four and a half hours at two lanes
abreast. Integration was solo. Gate at the merge: see the PR.

## Lessons

- **Subsystem depth found what fault shape could not.** Fifty confirmed
  from ten lenses, against 39 from the delta audit's ten - and the
  findings are of a different kind: whole members missing
  (`ActivateMobileEnemy`, `DoSteal`, `RevealGuildHallOnMap`,
  `SyntheticTimeIncrease`, the Treasure markers), not clauses drifted.
  The next audit should alternate: shape, then depth, then shape.
- **Two lanes reaching one member is a merge decision.** `discoverBuilding`
  was ported twice, differently, in one fleet. Assigning findings by
  FILE rather than by lens would have put F9 and F49 in one lane.
- **The review rounds earned their cost again**: 27 findings, five of
  them high - a load that wiped potions from the pack, the foe-first
  dispatch that ate clicks on doors, the unpinned host wirings.
