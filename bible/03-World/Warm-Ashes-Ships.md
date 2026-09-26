# Warm Ashes - Ships (WA1, 2026-09-25)

Kamer's **Warm Ashes - Ships 1.1** (Nexus 985, "Warm Ashes: High Seas -
Ship Encounters"), ported 1:1 - Mac, 2026-09-25: "All mods attached are to
be compatible and implemented 1:1." Provenance is
`vendor/warm-ashes-ships/README.md` (its permission line is RECORD OPEN);
the world-data mechanism is `02-Formats/World-Data-Patches.md`.

## What it does

"Encounters on Ships and Ocean Fast Travel." A fast travel whose route
crosses the sea (the journey's `OceanPixels`, which the travel popup and
the held map already count) rolls `Random.Range(0, 100) < 75` - peace
three times in four. Otherwise, sailing (the popup's ship toggle), the
ambush is armed; a player who owns no ship is lent the large one; both
ship blocks take the `_smallraid` world-data variant, which stands one or
two more ships - the pirates' - 40 to 140 m off the player's. Not sailing,
both take `_base`.

A twentieth of a second after the arrival, an armed ambush starts
`WAQ_SHIP_SMALLRAID` and puts the player on the ship's deck, the arrival
remembered as the place to come back to; a lent ship is taken back at
once. The quest spawns five of the crew (Warriors, team 1) and one of
three boarding parties - eight Rogues, eight Barbarians, or six Orcs with
two sergeants - infighting on, more pirates every five minutes and more
crew as the crew falls; with eight of the boarders dead (the Orcs: all
six and both sergeants), it says "The attackers have been fought off.
The ship continues to its destination." and runs **Leave Ship**: the
blocks back to `_base`, and the player ashore where they boarded - a
lent ship lent again for exactly as long as it takes to leave it. The
quest itself ends on its one-hour clock.

One switch, `Enabled`, on by default (`systems/modSettings.js`
`warm-ashes-ships`; the Features row under World, "Takes effect on your
next sea voyage").

## How the port carries it

`systems/warmAshesShips.js` is the mod's script, read off its IL
(`vendor/warm-ashes-ships/il/`) - `onPreFastTravel` [IL_03dc],
`onPostFastTravel` (CheckforEncounters [IL_0384]), the coroutine's clock
`frame(dt)` and its body [IL_0617-IL_0675], `resetShipVariants`
[IL_03aa], the `LeaveShip` action [IL_0540] and the save record's three
members. The world host (`scenes/world.js`) is its GameManager:

- **the travel events** - `fastTravelTo` raises the Pre after the fare is
  taken and before the teleport (DaggerfallTravelPopUp.cs:328), and the
  Post as its last statement (:383), where DFU raises them;
- **the coroutine's clock** - `WaitForSeconds` is scaled time: the host
  hands the frame's `dt`, held by a pause and scaled with the world, in
  every mode, beside Horse Cart and Cargo's LateUpdate;
- **the bank** - `ownsShip`, `assignShipToPlayer` (with the ship's two
  permanent scenes, one helper now shared with the classic-save import)
  and `banking.js resetShip` (DaggerfallBankManager.ResetShip, new here:
  the ship and nothing else - the permanent scenes stay listed, as DFU
  leaves them);
- **the quests** - `QuestListsManager.GetQuest` and the machine's
  immediate `StartQuest`; the `WA_Ships` list registers at the scene boot
  (as a loaded mod's does) and the four quests ride the pack loader's
  mod glob (`scenes/questData.js`), so `GetQuest` finds them by name, as
  DFU's `AnyModContainsQuest` does;
- **TransportMode = Ship** - `boardOrDisembark`, UpdateMode's ship arm.

The six variants are the author's edits over the player's own
`BLOCKS.BSA` (`WorldDataPatches/`), served under their DFU names; the
copies of the classic ship subrecord are COPY ops. With Detailed Ships on
too, DFU lays the building file over the variant block
(`ReplaceRmbBlockBuildingData`) - the player's ship is the detailed one,
the pirates' stay classic - and so does the port's door.

### What WA1 changed outside the mod

1. **The world host's quest tick holds while the world moves and while
   the HUD fades.** QuestMachine.Update refuses to tick "while HUD fading
   or load in progress ... to prevent quest popups or other actions while
   player/world unavailable" (:310-316); the port's gate carried the load
   and the overlay but not the fade, and its world moves are awaited
   where DFU's are one frame. The ambush starts its quest on the eve of
   the boarding teleport - ticking through the build, its first wave
   was placed around a player the world was still being built under.
   The gate is now `!overlayActive && !worldMoveBusy() &&
   !hudFade.fadeInProgress`, for every quest the world host runs.
2. **The ship's fade.** UpdateMode's ship arm opens with
   `SmashHUDToBlack` and closes with `FadeHUDFromBlack`
   (TransportManager.cs:364, :401); the port's boarding had neither. It
   has both now - the picker's Ship row takes them too.
3. **Setting the transport to Ship from code leaves a building first.**
   The picker's Ship row is outdoors-only, so `boardOrDisembark` was only
   ever asked from the street; "Leave Ship" can run below decks (the
   quest's reinforcements spawn where the player is). DFU's UpdateMode
   would teleport the streaming world out from under a player still
   inside; the port leaves the building (`forceExitToExterior`, as every
   teleport here does) and then sails (`shipTransportMode`).
4. **"Leave Ship" registers whatever the switch says.** DFU registers
   it only while the mod is loaded, and a disabled mod raises no ambush.
   Here the switch can go off mid-voyage, or a save carrying the quest
   can load with the mod off; only the mod's own quests say "Leave Ship",
   so the template is inert without them, and the voyage can always end.
5. **DFU's per-mod save slot is a registry** (`systems/modSaveData.js`):
   a save writes every registered mod's record beside HCC's, a load hands
   each back or its `NewSaveData`, and a dungeon save carries them too.
   A new game starts every registered mod from its `NewSaveData` - a
   recorded DEPARTURE: DFU calls nothing on a new game, so the mod's
   static `tempShip` would carry from one character to the next within a
   session.

### The mod's own behaviour, kept

- An ambush whose quest ends on its clock before the boarders are beaten
  never runs "Leave Ship": the player stays aboard (the travel map takes
  them off, as in DFU), and a lent ship's `tempShip` stays set - which
  keeps every later voyage peaceful until a "Leave Ship" runs. That is
  the IL's own arithmetic, ported as it stands.
- `WAQ_SHIP_ATTACK_PIRATE` is registered and never started; it names
  messages (1016, 1017, 1022, 2025-2029) its QRC does not carry.

## Online

The player's own (`ONLINE_PLAYERS_OWN_MODS`): the ambush is the player's
voyage - their quest, their crew and pirates (a spawner's foes: a peer
standing on the same deck sees them fight), their lent ship - and the
pirate vessels are their blocks' variant, standing off in open water where
a peer without them sees sea. Online a trip spends no world time (WORLD5);
the ambush is rolled all the same.
