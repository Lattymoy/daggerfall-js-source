# Talk

Talk is the port of Daggerfall Unity's `TalkManager`: conversation with townsfolk and static NPCs. The player meets it
in the talk window (Tell me about, Where is, Any news, Any work), in rumours and news, in directions to buildings and
people, and in quest topics a running quest adds to what NPCs know. It is a 1:1 port; departures are named below.

## How it works

The engine is four modules, each a family of `TalkManager.cs`:

- **The rumour mill** (`src/systems/rumorMill.js`): rumour entries and their lifecycle - classic rumours imported from
  RUMOR.DAT (`src/formats/rumorFile.js`), non-quest rumours, the TTL sweep, valid rumours by region and faction, news for
  talk and for bulletin boards, and the quest seams (quest rumours, progress rumours, questor-post messages).
- **The topic tree** (`src/systems/topicTree.js`): the list model, the four assemblers (Tell me about, Location,
  Person, Thing), quest resources and their topics, dialog links, and whether an NPC can know a topic.
- **The answer pipeline** (`src/systems/answerPipeline.js`): question text, answer text for every question type,
  Where-is for regional buildings with the location key check, greeting ladders, honorifics and random text records.
- **The NPC session** (`src/systems/npcSession.js`): choosing whom the player talks to (mobile or static), the questor
  door and questor tracking (`buildQuestorPool`), portraits, the conversation save, and rebuilds on map-pixel change
  and transitions.

The older half lives in `src/systems/talk/`: factions, reaction to the player and pickpocketing (`talk.js`, including
`getCourtOfCurrentRegion`), the Where-is building pool and knowledge roll (`talkTopics.js`), the greeting ladder and
macros (`talkSession.js`, `talkMacros.js`). `src/scenes/townTalk.js` hosts a session: the modes, the tone cycle, the
Where-is chain and the native talk window. Dungeons and interiors talk through the world host's pipeline.

Text records read DFU's `Internal_RSC` string table before TEXT.RSC (`src/formats/rscTable.js`, from
`vendor/dfu-text/Internal_RSC.csv`), as DFU's `TextProvider` does, so directions read as one phrase.

### Past the Bay

The Regional rows (Any tavern, the guilds, the temples, the knightly orders) search the current region's location
table, the quest layer's, so a province's region answers from its own places
(`src/scenes/quest/questProvinceSites.js`). Each location's key is computed from its own buildings
(`src/world/locationKey.js` `locationKeyOf`), so capitals and Arena places carry a true key.

## Rules

- A law kept inside a C# method stays inside the matching port function; a seam in another module is reached from the
  same place C# reaches it, never copied.
- A fixture that cannot reach the state a line guards is no test of that line; every slice gets a mutation pass.
- Pins use DFU literals; a kept quirk is recorded against its C# member; a seam with no host idles loudly.

## Daggerfall Unity

`TalkManager.cs` is ported whole across the modules above, with `PlayerGPS.GetCourtOfCurrentRegion` in `talk.js`.
Departures: Where-is past the Bay reads the province's own location table, and the location key is computed from the
location's buildings where DFU only reads `MapTable.Key` (measured equal on every MAPS.BSA row).

## Code and tests

- `src/systems/rumorMill.js`, `src/systems/topicTree.js`, `src/systems/answerPipeline.js`, `src/systems/npcSession.js`
- `src/systems/talk/` - factions, reaction, Where-is buildings, greetings, macros
- `src/scenes/townTalk.js` - the session host
- `src/world/locationKey.js` - a location's key from its buildings
- `test/systems/talkengine.test.js` - the engine against DFU literals
- `test/systems/talk/` - sessions, news, questors, macros, directions
- `test/world/locationkey.test.js` - every MAPS.BSA row's key from its buildings
- `test/systems/quest/bayleftb_quest.test.js` - Where-is past the Bay

## Open

- The fixed city bench (`src/scenes/exterior.js`) reads MAPS.BSA alone, so its talk knows only the Bay.
