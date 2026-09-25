# Warm Ashes - Ships 1.1 - Kamer (ported 1:1; his quests, his script's IL and his edits of the ship blocks vendored, the blocks rebuilt from the player's own data)

**Warm Ashes - Ships 1.1** for Daggerfall Unity 1.1.0+, by **Kamer**
(Nexus mod 985, "Warm Ashes: High Seas - Ship Encounters"; GUID
`5e2ce334-65ae-4ddd-ada6-00c6dd4344fd`; contact "DFU Discord"). The mod's
own description: "Encounters on Ships and Ocean Fast Travel."

Mac (Lattymoy) handed the shipped archive
(`Warm_Ashes_High_Seas_-_Ship_Encounters-985-1-1-1744179804.rar`) over on
2026-09-25, with five other sea mods: "All mods attached are to be
compatible and implemented 1:1."

**Permission: [Mac: record the author's permission, or the link to it,
here - Kamer's grant that brought his Windmills of Daggerfall and World
of Daggerfall into this tree is the likely cover, and the earlier mod
records carry theirs in this line.]** The archive carries no readme and
the manifest no licence.

## What the mod is

A compiled script (`Warm Ashes - Ships.dll` - the manifest names
`WarmAshesShips.cs` and `LeaveShip.cs`, and the bundle carries their
build, not the sources), four quests and a quest list, and six
world-data files: the two ship blocks (`SHIPAA00.RMB`, the small ship,
and `SHIPAA01.RMB`, the large) each in three variants.

- A fast travel that crosses the sea: three times in four, nothing.
  Otherwise, travelling by ship, the ambush is armed - a player without a
  ship is lent the large one - and both ship blocks take the `_smallraid`
  variant; travelling on foot, both take `_base`.
- A twentieth of a second after arriving, an armed ambush starts
  `WAQ_SHIP_SMALLRAID` and puts the player on the ship's deck (a lent
  ship is taken back at once). The quest musters the crew and one of
  three pirate crews, with reinforcements every five minutes; beating
  the boarders says the ship "continues to its destination" and runs
  the mod's own action, "Leave Ship", which sets the blocks back to
  `_base` and puts the player ashore where they boarded.
- `WAQ_SHIP_ATTACK_PIRATE` (its own name inside: `WAQ_SHIP_PIRATEATTACK`)
  is in the list and never started by the code; `WAQ_SHIP_RAID` and
  `WAQ_SHIP_BASE` are the manifest's loose quests, a `worldupdate` each
  (the small ship's block to `_raid`, and back).

| variant | what the author changed in the classic block |
|---|---|
| `_base` | nothing but the editor's round trip: two automap bytes of `0xFB` (a ground flat) written as `0` |
| `_smallraid` | one or two more ships - the classic small ship's own subrecord, copied - standing 40-140 m off in the water, turned; on the small ship's block also four small boats and six rocks (Daggerfall's own models 41501, 41504, 41715-41717) |
| `_raid` | the small ship's block: a second ship, a quest-site building (GuildHall, quality 15) of the author's own with its markers; the large ship's: a second large ship, the classic one's copy |

## What is here, and what deliberately is NOT

- `warm-ashes-ships.dfmod.json` - the shipped manifest, verbatim (the
  bundle names it `Warm Ashes - Ships.dfmod`).
- `Warm Ashes - Ships.dll` - the shipped assembly, byte for byte, and
  `il/Warm_Ashes_Ships.il.txt` - every method body as CIL, dumped by
  `tools/ilDump.py`. The port (`src/systems/warmAshesShips.js`) cites
  the IL offsets it restates.
- `Quests/` - `QuestList-WA_Ships.txt` and the four quests, the bundle's
  text assets verbatim (CRLF, as shipped). The quests are the author's
  own QBN/QRC.
- `WorldDataPatches/SHIPAA0x.RMB_<variant>.json` - **the author's edit of
  each ship block, and only the edit** (2 to 51 ops, 321 to 5,876 bytes
  against the shipped 184,961 to 189,778). A whole RMB block is
  Daggerfall's layout - game data, which this repository never carries
  (Port-Doctrine) - so `tools/worldDataPatch.mjs` took each shipped file
  against the classic block out of `BLOCKS.BSA` and kept the difference;
  where the author copied a classic ship subrecord, the patch carries a
  COPY op naming it (`ci`, block and path), never its content. Each patch
  records the sha256 of the author's file in canonical form, and the
  tool refuses to write one that does not rebuild it.
- **Not here:** the six shipped world-data files - the port rebuilds them
  at load from the player's own `BLOCKS.BSA` and serves them under their
  own names through the world-data door (`src/formats/worldDataPatch.js`,
  `src/scenes/modWorldData.js`), where DFU's `WorldDataVariants` finds
  them - and the C# sources, which the bundle does not carry.

To re-derive the patches from the shipped bundle's six text assets
(saved under their asset names with `.json`):

    node tools/worldDataPatch.mjs <arena2> vendor/warm-ashes-ships/WorldDataPatches \
      SHIPAA00.RMB_base.json SHIPAA00.RMB_raid.json SHIPAA00.RMB_smallraid.json \
      SHIPAA01.RMB_base.json SHIPAA01.RMB_raid.json SHIPAA01.RMB_smallraid.json

## With Detailed Ships

DFU serves a variant block and then lays the block's building files over
it (`ReplaceRmbBlockBuildingData`), so with both mods on the player's own
ship in `_smallraid` is Detailed Ships' ship, and the pirate vessels -
copies of the classic ship subrecord, record 1 and 2 of the block - stay
classic. The port's door does the same.

## Online

The player's own (`ONLINE_PLAYERS_OWN_MODS`): the ambush is my voyage's -
my quest, my crew and pirates (a spawner's foes, which a peer on the same
deck sees fight), my lent ship - and the pirate vessels are my blocks'
variant, standing off in open water where a peer without them sees sea.
