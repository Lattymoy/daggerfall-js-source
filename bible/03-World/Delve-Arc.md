# The Delve arc - dungeons a player can read

2026-10-05, the owner, of the dungeon block system: "How could we improve the dungeon block system? 1. removing
esoteric nature of dungeons 2. (no logical interaction moments) 3. way to detect interactables", then, of the proposal
answered: "Lets take all of this on".

The dungeon's LAYOUT stays Daggerfall's (`01-Overview/Port-Doctrine.md`: dungeon assembly is ported verbatim, and every
quest marker and treasure spawn hangs off the blocks), so nothing here touches block assembly but the one tier that
asks for it by name (DSIZE1). The rest is legibility: what is near and can be worked, what a lever did, the way back,
and - asked for - where a quest's thing is. Every slice is an Enhanced row on the Features home with its own switch;
the classic skin is DFU's, untouched. Ledger A: THE DELVE ARC row. Not verified in the game (no ARENA2 here).

| Slice | What | Row | Default |
|---|---|---|---|
| SENSE1 | the look round - asking for Info mode lights what is near, in sight and named | `dungeon-sense` | On (secrets off) |
| ECHO1 | the chain's echo - which way a lever's work went, on the map until found, lit when reached - and the examine | `dungeon-echoes` | On |
| WAYOUT1 | the way out on the compass, along the walked trail | `dungeon-way-out` | On |
| GUIDE8 | the guidance tiers: Exact marks a quest's resources underground, map and compass | `quest-guidance` | Journal |
| DETECT-FINDS | Detect Treasure finds a searched object's find | (SEARCH1's, ungated) | - |
| DSIZE1 | medium dungeons - over thirteen blocks, a cross of five ringed by eight | `medium-dungeons` | Off |

## SENSE1 - THE LOOK ROUND (SHIPPED 2026-10-05)

`systems/dungeonSense.js`, read by `scenes/dungeonContext.js` (`senseLookRound`, `senseFrame`).

- **THE CUE IS INFO MODE.** Every letter key is spent (KB1), and Info is Daggerfall's examining stance, so an ASK for
  it underground - its key (F3 by default), the HUD's cycle, the pad's - is a look round. ChangeInteractionMode is a
  no-op on the mode in force, so the ask is COUNTED where the press is read (`player/interactionMode.js`
  `askInteractionMode`, called by `scenes/townTalk.js setMode` before its no-op and by `scenes/dungeon.js`'s mode keys)
  and the context reads the count each frame (`interactionModeAsks('info')`) - a count, not a listener, so there is
  nothing to unsubscribe.
- **WHAT LIGHTS: WHAT THE PLAQUE WOULD SAY.** The press's own list (`dungeonActivationTargets`, the race the button runs)
  through the plaque's own ladder (`_namer`; an action object by the mod's two bands, `actionObjectName`, asked as though
  World Tooltips were on, so a player who turned the plaque off still looks round), within `SENSE_M` (8 m, to the nearest
  point of the box) and IN PLAIN SIGHT (`inPlainSight`: a clear line to the box's middle or the top of it, past the
  thing's own bucket; a face met inside the box is the thing's own unless it is a flat - FIX-D's law). A pressure plate
  the mod silences (THE MULTITRIGGER RULE) and a main-quest puzzle the author hid (`HideDefaultInteractTooltip`) stay
  dark. At most `SENSE_MAX` (16, the glow's budget), nearest first, for `SENSE_HOLD_S` (6 s), fading over the last 1.5.
- **THE COLOURS** (`SENSE_CSS`): a thing to work, a way through (anything the plaque calls a door, and the exits), a
  find (piles, bodies, searchables), a secret - each clear of the professions' five.
- **THE SECRETS TIER** (`With secrets`, the player's ask): the walls and doors only a chain moves - a mover or a special
  door whose own trigger flag admits nothing of the player's (None) and which another object's chain reaches
  (`world/actionSystem.js chainTargets`), at rest where it began (`isSecretMover`). New knowledge, so opt-in.
- **THE GLOW** is the professions' own (`render/nodeGlow.js`): a mark may carry its own `rgb` and a `gain` (the fade); a
  node carries neither and is lit as it always was. The dungeon's pass is the context's own, drawn after `lateWorldDraw`
  (the last opaque flat) and FREED with the context (`NodeGlowRenderer.dispose`, the pass's `dispose`; an idle build
  still waiting builds nothing).
- **THE PLAQUE'S FIDELITY FIX** (`systems/worldTooltips.js actionObjectName`, both hosts' namers): the mod asks the
  ACTION band first (.cs:397, a Direct/Direct6/MultiTrigger object by model) and the door band (.cs:641-650) only when
  it said nothing, and the door band's `CheckComponent<DaggerfallActionDoor>` misses a DaggerfallActionDoorSpecial. Both
  hosts had the door band first for every `kind === 'door'`, so EVERY SECRET WALL UNDER THE CROSSHAIR SAID "Door", and a
  Direct-flagged action door said "Door" where the mod says "<Interact>". One function, the mod's order.
- `test/sense1_dungeonsense.test.js` (16); `tools/mutants/sense1.json` (31).

## ECHO1 - THE CHAIN'S ECHO, AND ITS EXAMINE (SHIPPED 2026-10-05)

`systems/dungeonEcho.js`, read by `scenes/dungeonContext.js` (`echoFrame`, the `act:`/`door:` arm of `_dungeonHoverName`).

- **WHAT WAS SET GOING.** `ActionSystem.onPlayed(o, triggerType)` - an observer called in `receive` after the gate
  passes, before Play; nothing reads back. The context keeps the ActionObject plays (the cascade - what a press, a plate
  or a blow set going, never the thing pressed); another player's change lands through `applyRemote` and is not heard.
- **THE LINE.** A mover (`isEchoMover`: a model's tween, an acting flat, a door) set going farther than `ECHO_NEAR_M`
  (3 m) from the eye and out of plain sight is said ONCE A PRESS, the first such in chain order, on the popup line:
  "Stone grinds somewhere below you, to the west." (`echoLine`: the verb by kind; `wayWord`: above/below past
  `ECHO_VERT_M`, the compass way past `ECHO_FLAT_M`, in the compass's own frame - +x east, +z north).
- **THE MAP.** Each such mover goes in the echo book (`createEchoBook`, at most 8, the oldest out first) and on the held
  map's dungeon sheet as an echo mark (`ui/automapSheet.js` kind `echo`, `ui/inkAutomap.js`: a ring breaking into four
  rays, in the way-in's pen, named "Moved"), seen or not - the press said which way, and the mark is where it said. The
  sheet breathes while one stands.
- **FOUND.** A few times a second (`ECHO_LOOK_S`) an echo whose mover stands in plain sight within `ECHO_FIND_M` (12 m) is
  taken off the map and LIT for the look round's hold in the secrets' colour, where it is now.
- **THE EXAMINE.** In Info mode the plaque over an action object adds the way its chain works ("Works something to the
  north-east", "Works something close by"), walked without playing it (`chainMovers` along `ActionSystem.nextOf`, loop-
  and depth-safe), from the object's own box. Never under the author's `HideDefaultInteractTooltip`.
- `test/echo1_dungeonecho.test.js` (10); `tools/mutants/echo1.json` (25).

## WAYOUT1 - THE WAY OUT ON THE COMPASS (SHIPPED 2026-10-05)

`systems/wayOut.js`, read by `scenes/dungeonContext.js wayOutMark`, drawn by `ui/enhancedHud.js drawWayOutMark`
(through `ui/hud.js drawHud`'s `wayOut`).

- **THE TRAIL WALKED BACK.** The held map keeps where the player has STOOD (`systems/automap.js automapTrailTick`, a
  one-metre grid, saved). A breadth-first field from the way in (the start marker - the map's own beacon) over those
  cells: two side by side within `WAY_STEP_DY` (1 m) of height are a step both ways, a walked teleporter
  (`teleporters`) a step from its entrance to its exit only. Rebuilt at most once a second while the trail grows, at
  once when it shrinks (another run's record) or the way in moves.
- **WHERE IT POINTS.** The farthest cell along the field, within `WAY_LOOK_CELLS` (14), the eye can see - so it turns
  the corners the player turned and never points through a wall; never past a teleporter's jump (the mark stands on it
  until it is taken). With no walked way to the way in (a Recall into the level, a save older than the trail), the way in
  itself, as the crow flies. Gone within `WAY_HERE_M` (3 m) of the way in, and before the way in has been found.
- **THE MARK**: an arrow pointing up and out in the parchment's light (`WAY_MARK_CSS`), on the compass's bearing law,
  clamped; enhanced HUD only (the classic compass is DFU's).
- `test/wayout1_wayout.test.js` (8); `tools/mutants/wayout1.json` (15).

## GUIDE8 - THE GUIDANCE TIERS, UNDERGROUND (SHIPPED 2026-10-05; the Town tier OPEN)

`systems/questGuidance.js`; `scenes/worldModes.js dungeonQuestMarksHere` (the host owns the stands and the quest foes)
hands `questMarks` to `scenes/dungeonContext.js`, which draws them on the held map (`quests`) and the compass
(`questCompassMark`). `06-Systems/Quest-Guide-Arc.md` GUIDE8 and DECISIONS 3.

- **JOURNAL** is GUIDE5's law and the default. **EXACT** is the quest debugger's knowledge: every quest resource
  standing in the dungeon - a stand that is active and not dead (an item not yet taken, a person), a live quest foe -
  never a hidden one (`dungeonQuestMarks`), named as the plaque names an item, a person or a foe by their own name.
- **THE MAP**: GUIDE5's own diamond (`ui/inkMap.js paintQuestMark` - gold edged in ink, the followed quest's filled),
  its name under the spot, on its own storey; the quest's floor is LISTED on the strip before it is walked and wears the
  diamond there (`floorStripLayout`'s `quest`).
- **THE COMPASS**: the followed quest's nearest mark, else the nearest (the enhanced compass's quest diamond).
- The one tier that can spoil a search: off by default, its own row, the enhanced skin only. The *Town* tier GUIDE8
  names (the building an entry names, marked in its town) is NOT built.
- `test/guide8_questguidance.test.js` (6, the echo's sheet mark with it); `tools/mutants/guide8.json` (15).

## DETECT-FINDS - A SEARCHED OBJECT'S FIND IS TREASURE (SHIPPED 2026-10-05)

`scenes/shared.js nearbyLootRecords`'s `searched` (`searchedNearbyRecord`), the dungeon's Detect walk. DFU's Detect
Treasure walks every DaggerfallLoot; SEARCH1's coffins, shelves, chests and crates hold the room's rolled find in
`items` until it is taken, so the one loot walk carries them, at the box's middle. Unsearched, a searchable holds
nothing yet (the find is rolled at the search), so GetLootFlags gives it no Treasure bit - as an empty corpse. The
street's searched headstones (`scenes/world.js activateGrave`) are FLAGGED: their finds live in the street's own
record, not on a searchable, and are not in its walk yet. `test/dsize1_mediumdungeons.test.js`.

## DSIZE1 - MEDIUM DUNGEONS (SHIPPED 2026-10-05)

`world/smallerDungeons.js` (`dungeonSizeFor`, `generateMediumDungeon`, `MEDIUM_LAYOUT`, `MEDIUM_DUNGEONS_STATE`). The
size tier `10-UI/Features-Arc.md` FT1 left open. A dungeon of more than 13 blocks is regenerated by GenerateSmallerDungeon's
own law - its own block list, GetRandomBlock's two pools, DFRandom seeded on the MapId, so the same every visit - as a
cross of five interior blocks (the starting block in the middle) ringed by the eight border blocks that close every open
side. Every guard Smaller Dungeons keeps, Medium keeps (main story, the arena's undercroft, online, a quest's frozen
size); Smaller Dungeons wins when both are on. The quest freeze and the save stamp carry it as 3, APPENDED past DFU's
NotSet/Disabled/Enabled (which stay verbatim); the load-time warp compares the stamp whole, so a save made at any of the
three sizes and loaded at another stands at the start. Its own row beside DFU's, which stays DFU's switch, whole.
UNVERIFIED AGAINST REAL BLOCKS: whether every border block reads well beside two interior arms (the cross's inner
corners) is a look the game's data has to answer. `test/dsize1_mediumdungeons.test.js` (8, DETECT-FINDS' with it);
`tools/mutants/dsize1.json` (16).

## THE FOUR HOSTS

| Host | SENSE1 | ECHO1 | WAYOUT1 | GUIDE8 | DSIZE1 |
|---|---|---|---|---|---|
| `scenes/dungeonContext.js` | wired (the frame both dungeon hosts call) | wired | wired | wired (map, compass) | the build it is handed |
| `scenes/worldModes.js` | its interior namer takes `actionObjectName`; a building has no chains to look round for - FLAGGED | FLAGGED (no chains indoors) | FLAGGED (a building is one room deep) | wired (hands the dungeon its marks); interiors FLAGGED | wired (`dungeonLocationFor`) |
| `scenes/world.js` | FLAGGED (the street has no action chains) | FLAGGED | FLAGGED | FLAGGED (the Town tier, unbuilt) | wired (the quest layer's sized locations) |
| `scenes/exterior.js` | FLAGGED, as the street | FLAGGED | FLAGGED | FLAGGED | wired (the quest layer's sized locations) |

The standalone dev host `scenes/dungeon.js` counts its mode keys' asks, so the look round answers there too.

## Open

- GUIDE8's Town tier; the Exact tier inside buildings.
- The street's searched headstones in the Detect walk.
- DSIZE1 seen with real blocks; SENSE1 and ECHO1 seen in real dungeons (the glow's card on a wall-mounted lever, the
  echo's line on a long chain).
