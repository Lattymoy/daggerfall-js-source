# Warm Ashes - Ships

A port of Kamer's mod **Warm Ashes - Ships 1.1** (Nexus 985): pirate encounters on sea voyages. A fast travel that
crosses the sea may end in an ambush on the player's ship deck. On the enhanced lane's Overworld the raiders are ships
the player can see coming. Provenance is `vendor/warm-ashes-ships/README.md`; the world-data mechanism is
`02-Formats/World-Data-Patches.md`.

## How it works

- A fast travel whose route crosses ocean pixels rolls `Random.Range(0, 100) < 75`: three in four pass in peace
  (`WA_PEACEFUL_PERCENT`). Otherwise, when sailing, the ambush is armed. A player who owns no ship is lent the large
  one. Both ship blocks take the `_smallraid` world-data variant, which stands one or two pirate ships 40 to 140 m off.
  Not sailing, both take `_base`.
- A twentieth of a second after arrival (`WA_BOARD_DELAY_S`), an armed ambush starts `WAQ_SHIP_SMALLRAID` and puts the
  player on deck. A lent ship is taken back at once. The quest spawns five crew and one of three boarding parties
  (eight Rogues, eight Barbarians, or six Orcs with two sergeants), with reinforcements on both sides. When the
  boarders are beaten the quest runs **Leave Ship**: the blocks go back to `_base` and the player goes ashore where
  they boarded. The quest ends on its one-hour clock.
- A raid fought where the player stands off the sea region (a bank cabin's ship at her quay, or land) ends there: its
  crew and raiders withdrawn, the blocks back to `_base`. A raid that the sea fight starts and wins ends the same way.
  A voyage made while a raid's quest runs arms no second ambush.
- Overworld raiders (`src/systems/seaRaiders.js`): seeded ships on the open sea, the same for every player at the
  shared minute. One that sights a traveller gives chase; one that comes alongside starts the same raid through
  `raidAtSea` and `armRaid`. It is refused while an ambush is armed or boarding, or while a lent ship is out.

## Rules

- Mods attached are made compatible and implemented 1:1 (Mac).
- One switch, `Enabled`, on by default (`src/systems/modSettings.js` `warm-ashes-ships`; the World features row).
  With it off there are no raiders.
- The world host's quest tick holds while the world moves and while the HUD fades, for every quest it runs.
- Boarding from code leaves a building first, then sets the transport to Ship.
- **Leave Ship** is registered whatever the switch says, so a voyage can always end.
- Mod save data is a registry (`src/systems/modSaveData.js`): a save writes every registered mod's record, and a new
  game starts each from its `NewSaveData`.
- Online the ambush is the player's own (`src/systems/online/onlineLane.js` `ONLINE_PLAYERS_OWN_MODS`): their quest,
  crew, pirates and lent ship. A peer on the same deck sees the foes fight; a peer elsewhere sees open sea where the
  pirate ships stand.

## Daggerfall Unity

`src/systems/warmAshesShips.js` is the mod's script read off its IL (`vendor/warm-ashes-ships/il/`):
`onPreFastTravel`, `onPostFastTravel`, the coroutine's clock `frame`, `resetShipVariants`, the `LeaveShip` action and
the save record. The world host raises the travel events where `DaggerfallTravelPopUp` does and hands the coroutine
scaled `dt`. Kept as the mod has it: an ambush whose quest times out before the boarders are beaten never runs Leave
Ship, and a lent ship's `tempShip` stays set, which keeps later voyages peaceful. `WAQ_SHIP_PIRATEATTACK` is listed with
the raid quests (`WA_RAID_QUESTS`). Departures:

- DFU calls nothing on a new game, so the mod's static `tempShip` would carry between characters. The port resets every
  registered mod's save data.
- DFU's quest machine refuses to tick during a HUD fade; the port's gate also holds while a world move is awaited.

## Code and tests

- `src/systems/warmAshesShips.js` - the mod's script
- `src/systems/seaRaiders.js` - the Overworld's raider ships
- `src/systems/modSaveData.js` - the per-mod save registry
- `test/systems/wa1_warmAshesShips.test.js` - the encounter, the variants, Leave Ship and the save record
