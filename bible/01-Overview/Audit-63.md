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

(filled at integration from the seven lanes' returns)

## Integration

(filled at integration)

## What was left, and by whose decision

(filled at integration)

## The cost

(filled at integration)
