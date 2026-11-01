# Alternate Starts

A new character chooses where their story begins: the Iliac Bay (Privateer's Hold) or one of seven provinces past the
Bay, each with its own start dungeon near its capital and its own quest. Every start ends with the Emperor's sealed
commission. The main quest begins only when the player opens that letter and reaches the city of Daggerfall, so the
story starts on the player's watch. The player meets it as the "Where does your story begin?" page at the end of
character creation.

## How it works

### The registry and the contract

`src/systems/starts/starts.js` holds `STARTS` (the eight, in the page's order), `BAY_START_QUEST` (`_STARTIB`),
`HAND_START_QUEST` (`_STARTHD`), `START_QUESTS` and `MAIN_QUEST_OPENER` (`_BRISIEN`). Each start is a quest in DFU's
text form under `src/systems/starts/quests/`, run by DFU's machine. Every start keeps one contract:

1. It ends with the commission, a quest letter whose use is watched however it reached the pack.
2. Opening it is the player's act, at any time. Nothing of the main quest runs before it; a start runs no clock.
3. Opened, it orders the player to the city of Daggerfall. There it starts `_BRISIEN` and ends, and `_BRISIEN` runs
   as DFU wrote it.

The commission belongs to the main quest: it is filed on the main rail, never shared with a party, and protected from
being set aside or restarted.

### The starts

| Start | Quest | Homeland of |
|---|---|---|
| The Iliac Bay | `_STARTIB` | Bretons, Redguards |
| Skyrim | `_STARTSK` | Nords |
| Morrowind | `_STARTMW` | Dark Elves |
| The Imperial Province | `_STARTIC` | no race |
| Black Marsh | `_STARTBM` | Argonians |
| Elsweyr | `_STARTEL` | Khajiit |
| Valenwood | `_STARTVW` | Wood Elves |
| Sumurset Isle | `_STARTSU` | High Elves |

**The Bay's start** wakes the player in Privateer's Hold after a shipwreck. The commission lies at the Hold's quest item
marker; the compass and the Quests page point back to it if the player walks out without it. **A province's start**
puts the commission in a dungeon of that province near its capital, each with its own tie to the main story (the
Underking, Numidium, the Mantella, the Emperor's letter). **A character born at no start** (a family heir, the fixed
city bench, a dev boot) is handed the commission at once (`_STARTHD`).

### The page

`src/ui/startChoice.js` lists the eight, the race's homeland first and tagged, with the chosen start's story beside it.
It is put only by a host that can stand a start past the Bay (`src/scenes/startsHost.js`). A start the host cannot
stand is shut with its reason. Online the Imperial Province is shut: it is the open zone, and its dungeons are sealed.

### The way to Daggerfall

Past the Bay there is no fast travel. An opened province commission is a writ of passage: a friendly master at any
harbour sails the player to Daggerfall free (`src/scenes/naval/passageHost.js`; `bible/03-World/Passage.md`). The Bay's
own letter carries no writ. Long voyages from a province's port follow planned sea lanes
(`src/systems/travel/travelRoute.js` `planSeaLanes`).

### A quest's place past the Bay

A quest site keeps its world pixel (`src/systems/quest/place.js` `siteWorldPixel`), so the held map, the compass, the
tracker and the journal's find-place box can show a start dungeon or any quest place past the Bay, where MAPS.BSA has no
row.

### Online and saves

The start is each character's own, begun at birth and refused to and from a party. The Bay's commission stands in the
Hold's public room; a player who left without it returns through their own instance. A save made before the story
began is handed the commission and the curse on load; an older save that already holds `_BRISIEN` goes on as it was.

## Rules

- Keep Privateer's Hold and give it a new quest (the owner).
- The main quest begins with a letter the player opens (the owner).
- Every province has its own start, near its capital (the owner).
- The Bay's letter is "to be opened in the Iliac Bay and nowhere else" and carries no writ.
- No fast travel past the Bay; portal stones, the overworld and passage by sea (the owner).
- The hosts do not grow: the start is a quest, mounted and clicked as every quest's items are.

## Daggerfall Unity

DFU's `StartGameBehaviour` starts `_TUTOR__` and `_BRISIEN` on a new character, and `_BRISIEN` starts the main quest's
clock at once: a player who explores for two months is reported a traitor. The port starts a start quest in
`_BRISIEN`'s place (`GAME_START_QUESTS` in `src/scenes/quest/questBridge.js`) and runs `_BRISIEN` unchanged once the
commission is opened in Daggerfall. Its remote tavern is then drawn in Daggerfall's region, as DFU's start draws it.

## Code and tests

- `src/systems/starts/starts.js`, `src/systems/starts/quests/` - the registry and the start quests
- `src/scenes/startsHost.js` - the page's host, the writ, restored saves
- `src/ui/startChoice.js` - the start-choice page
- `src/systems/quest/place.js` - a site's world pixel past the Bay
- `test/systems/starts/start1_bay.test.js` - the contract for every start, and the Bay's start
- `test/systems/starts/start2_provinces.test.js` - the provinces' starts
- `test/systems/starts/start3_pastbay_marks.test.js` - quest places past the Bay on the map
- `test/systems/starts/auditstarts.test.js` - the edge cases: the open zone, a birth's reload, saves made before the story
