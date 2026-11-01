# Foraging

Harbinger451's Foraging 1.7 for Daggerfall Unity, ported as its own mod with the author's permission: in the
wilderness, use a Wood-Axe to chop wood, a Pick-Axe to mine gems or metals, a Sickle to cut plants, a Spade to rob
graves, a Fishing-Net to fish, and a Basket to forage for food. Each use can also start one of the mod's short
activity quests. Online, five of the tools are the professions' tools (`06-Systems/Professions-Arc.md`). The player
meets it through the tools in the pack, General Store shelves, loot piles and the Features row `foraging`.

## How it works

**The mod.** One compiled script (`ForagingMain.cs`, shipped as `Foraging.dll` with no source), twelve item templates
(1600-1611), 22 quests with a quest list, and seven textures. It needs Jagget's Quest Actions Extension for four quest
actions, ported in `src/systems/quest/questActionsExtension.js`. The rules are the build's, read off its IL: every rule
names the IL offset it was read at. The build wins where the readme differs (the Pick-Axe reads Agility, not
Endurance). The rows, words, quests and pictures are our own; the release's record is in `01-Overview/Own-Work.md`.

**Our rows** (`src/systems/foraging/foragingItems.js`). The ids, group, names and pictures' archives are facts a save
or a quest names (`subclass 1604`), so they are kept. The rest is ours:

| What | Ours | Why |
|---|---|---|
| weight | Wood-Axe 3.0, Pick-Axe 3.5, Sickle 1.0, Fishing-Net 2.0, Spade 3.0, Basket 0.5, Wood Bundle 2.5, Fish 0.5, fruit 0.2, Mushroom and Egg 0.1 kg | what a person would carry; the bundle is ten arrows' wood (`src/systems/fletching.js` weighs a piece in arrows) |
| uses | the six tools 50, the goods 1 | a Standard tool of the professions (`src/net/recipeLaw.js` `TOOL_LIFE`) and the Skinning Knife; a good does not wear |
| price | Pick-Axe 110, Wood-Axe 90, Spade 80, Fishing-Net 70, Sickle 60, Basket 30, Wood Bundle 15, Fish 6, Mushroom 5, Orange and Egg 4, Apple 3 gold | near the Skinning Knife's 100, so a new character can buy a tool; the bundle as Firewood is priced |
| shelved | the tools and the Wood Bundle (rarity 10); never the five foods (100) | fresh food is found, not sold; a fetch quest's bundles can be bought |
| words | every refusal, yield, food and console line, the quests' messages and names, the list's notes | the game's voice (`10-UI/Voice.md`) |

**The pictures** are ours: the Wood-Axe, Pick-Axe, Sickle, Fishing-Net, Wood Bundle, Egg and Spade are recipes in
`src/systems/foraging/foragingArt.js` for our painter, at the archives 11600-11606, record 0, and the same sizes (64 x
64, the net 128 x 128). `installForaging` registers each as a built stand-in, painted the first time it is asked.

**The items** (group 9, UselessItems2; none stack): Wood-Axe 1600, Pick-Axe 1601, Sickle 1602, Fishing-Net 1603, Wood
Bundle 1604, Fish 1605, Spade 1606, Basket 1607, Apple 1608, Orange 1609, Mushroom 1610, Egg 1611. A tool lasts 50
uses; a break shows two notices, as in DFU.

**Using a tool** (`src/systems/foraging/foragingInstall.js` `useForagingTool`). Six checks in order, each failure a HUD
line: not inside; not in a settlement; daylight 07:00 to 17:59 (not the Spade); not at sea (Wood-Axe, Pick-Axe, Sickle,
Basket); no enemies near (DFU's rest test); not fully encumbered. Then the yield, the result box, the quest and the
wear. Yields roll on the average of two live attributes in four bands (39 and under, 40-59, 60-79, 80 and up)
(`src/systems/foraging/foragingCore.js`).

**The quests.** Eighteen activity quests start only from the tools; four Wood Bundle fetch quests are offered by the
social questors. The list and the 22 quests are our own files (`src/systems/foraging/quests/`), loaded as the starts'
quests are, in our words: Woodcutting, Fishing, Gathering Food, Gathering Plants, Mining, Grave Digging, Wood for the
Hearth, Laying in Firewood, Wood for the Pyre and Timber for the Gallows among them. Each keeps the build's tasks, ids,
macros and symbols, with the four quest mends written in; `test/systems/foraging/foragingAsBuilt.mjs` takes the mends
out again to pin each fault.

**Loot and shops.** After a shelf, house container or loot pile stocks, the mod may add one of seven items (the six
tools and the Wood Bundle), uniformly, at the mod's own rates per place and dungeon type. Corpses are hooked too.

**Online.** The shared clock is nobody's to move, so a quest's `raise time by` becomes a wait the player sits through
at 8 real seconds a game hour (`src/scenes/foragingWait.js` `WAIT_PER_HOUR`, `src/ui/waitWindow.js`); the quest's time
then passes on the character's own clock. A foe near ends the wait, forgiving the rest. The wait survives a reload,
and boxes held behind it come after it. The console command refuses online.

**The professions' tools.** Online, with the professions open, the Wood-Axe, Pick-Axe, Sickle, Basket and Fishing-Net
have one gesture: Use from the hotbar or a quick slot at a node of their kind starts the profession's act there, and
anywhere else it gives no Foraging yield, quest or wear and says where the profession is done. The Spade stays
Foraging's. Online, the six tools are on shelves whatever the Foraging switch says. Foraging's own yields are pack items
and never enter the Stores.

## Rules

- **Ported 1:1, as its own mod, both lanes** (Mac); its tools become the professions' tools (Mac).
- **The tools' Use online is the professions'** (Mac); offline and in a guest's lane they stay 1:1.
- **Six player-breaking bugs are mended** (Mac, "Your lead"): mining in desert or mountain fired all four tasks; the
  fetch quests asked the wrong item class and were filed under no social group; two summer plants vanished at the end;
  the Basket under Climates & Calories missed its Egg case; Quest Actions Extension's hand-over counted the pack twice
  and never took from the wagon. Everything else stays as the build has it.
- **The rules stay the build's; the rows, words, quests and pictures are ours** (OWN-WORK, the owner).
- **A mod, switched**: a Features row, on by default. The templates register whatever the switch says, so a saved tool
  never vanishes. With the switch off there is no console command.

## Daggerfall Unity

Foraging is a DFU mod, not DFU itself. The port reads DFU's own members where the mod calls them:
`PlayerGPS.IsPlayerInTown`, `GameManager.AreEnemiesNearby`, `LowerCondition`, `DaggerfallMessageBox`,
`QuestMachine.StartQuest`, and the two loot events `PlayerActivate.OnLootSpawned` and `LootTables.OnLootSpawned`.
Departures: the six mends above, our rows, words, quests and pictures, the online wait for `raise time by`, and the
professions' gesture online.

## Code and tests

- `src/systems/foraging/foragingLaw.js` - the tools' rules, yields and words
- `src/systems/foraging/foragingItems.js`, `src/systems/foraging/foragingArt.js`, `src/systems/foraging/quests/` - our
  rows, pictures and quests
- `src/systems/foraging/foragingCore.js` - attribute bands and pure rolls
- `src/systems/foraging/foragingInstall.js` - Use, shelves, loot hooks, the online gesture
- `src/scenes/foragingWait.js`, `src/ui/waitWindow.js` - the online wait
- `src/systems/quest/questActionsExtension.js` - Quest Actions Extension's actions
- `test/systems/quest/forage4_wait.test.js`, `test/systems/quest/foragefix.test.js` - the wait and the mends
- `test/net/prof2_client.test.js`, `test/net/gatherspeed.test.js` - the tools as professions' tools
- `test/systems/foraging/forage1_law.test.js`, `test/systems/ownwork4_pictures.test.js` - the law, the pictures

## Open

- The permission record for the ported rules is open (`01-Overview/Own-Work.md`); Mac's "Yes, permission" is recorded.
