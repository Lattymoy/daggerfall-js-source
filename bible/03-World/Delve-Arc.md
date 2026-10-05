# The Delve arc - dungeons a player can read

2026-10-05, the owner, of the dungeon block system: "How could we improve the dungeon block system? 1. removing
esoteric nature of dungeons 2. (no logical interaction moments) 3. way to detect interactables", then, of the proposal
answered: "Lets take all of this on".

The dungeon's LAYOUT stays Daggerfall's (`01-Overview/Port-Doctrine.md`: dungeon assembly is ported verbatim, and every
quest marker and treasure spawn hangs off the blocks), so nothing here touches block assembly but the one tier that
asks for it by name (DSIZE1). The rest is legibility: what is near and can be worked, what a lever did, the way back,
and - asked for - where a quest's thing is. Every slice but one is an Enhanced row on the Features home with its own
switch. Two things reach the classic skin, both rightly: DETECT-FINDS is SEARCH1's, ungated as SEARCH1 is; and a quest
frozen at the medium size keeps its dungeon whatever the skin, as DFU's frozen Enabled outlives its setting. Ledger A:
THE DELVE ARC row. AUDITED the same day (AUDIT DELVE, `01-Overview/Audit-Delve.md`), with MAPS.BSA and BLOCKS.BSA read
whole outside the repository; not yet seen in the game.

| Slice | What | Row | Default |
|---|---|---|---|
| SENSE1 | the look round - asking for Info mode lights what is near, in sight and named | `dungeon-sense` | On (secrets off) |
| ECHO1 | the chain's echo - which way a lever's work went, on the map until found, lit when reached - and the examine | `dungeon-echoes` | On |
| WAYOUT1 | the way out on the compass, along the walked trail | `dungeon-way-out` | On |
| GUIDE8 | the guidance tiers: Town rings the building the journal names, in its town; Exact marks a quest's resources in dungeons and buildings, map and compass | `quest-guidance` | Journal |
| DETECT-FINDS | Detect Treasure finds a searched object's find | (SEARCH1's, ungated) | - |
| DSIZE1 | medium dungeons - over eight blocks, two interior blocks closed by six | `medium-dungeons` | Off |

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
  dark. A flat (a loot pile, a body, an acting flat) has no face of its own (`senseFlat`). At most `SENSE_MAX` (the
  glow's own `NODE_GLOW_MAX`, 16), nearest first, the secrets merged with the rest (`senseRound`, a key once), for
  `SENSE_HOLD_S` (6 s), fading over the last 1.5. The ask is the PRESS (`!e.repeat`): a held key is one look round. A
  namer that throws costs the round, never the frame.
- **THE KINDS** (`SENSE_CSS`, `SENSE_FORM`): a thing to work, a way through (anything the plaque calls a door, and the
  exits), a find (piles, bodies, searchables), a secret - each its own colour AND its own form, because colour alone
  failed a protan or deutan eye: the halo and its shimmer; a steady halo; the motes; the shimmer with no body of light.
- **THE SECRETS TIER** (`With secrets`, the player's ask): the walls and doors only a chain moves - a mover or a special
  door no trigger of the player's reaches (`playerTriggers`, read off `TRIGGER_GATE`: None, or `Door` on anything but an
  action door) and which another object's chain reaches (`world/actionSystem.js chainTargets`), at rest where it began
  (`isSecretMover`). New knowledge, so opt-in.
- **THE GLOW** is the professions' own (`render/nodeGlow.js`): a mark may carry its own `rgb`, a `gain` (the fade) and a
  `form` (each part's share: `uForm`); a node carries none and is lit as it always was. The echo's found marks go first
  (`senseMarks`). The dungeon's pass is the context's own, drawn after `lateWorldDraw` (the last opaque flat) and FREED
  with the context (`NodeGlowRenderer.dispose`, the pass's `dispose`; an idle build still waiting builds nothing).
- **THE PLAQUE'S FIDELITY FIX** (`systems/worldTooltips.js actionObjectName`, both hosts' namers): the mod asks the
  ACTION band first (.cs:397, a Direct/Direct6/MultiTrigger object by model) and the door band (.cs:641-650) only when
  it said nothing, and the door band's `CheckComponent<DaggerfallActionDoor>` misses a DaggerfallActionDoorSpecial. Both
  hosts had the door band first for every `kind === 'door'`, so EVERY SECRET WALL UNDER THE CROSSHAIR SAID "Door", and a
  Direct-flagged action door said "Door" where the mod says "<Interact>". One function, the mod's order.
- `test/sense1_dungeonsense.test.js` (20); `tools/mutants/sense1.json` (44).

## ECHO1 - THE CHAIN'S ECHO, AND ITS EXAMINE (SHIPPED 2026-10-05)

`systems/dungeonEcho.js`, read by `scenes/dungeonContext.js` (`echoFrame`, the `act:`/`door:` arm of `_dungeonHoverName`).

- **WHAT WAS SET GOING.** `ActionSystem.onPlayed(o, triggerType)` - an observer called in `receive` after the gate
  passes, before Play; nothing reads back. The context keeps the ActionObject plays (the cascade - what a press, a plate
  or a blow set going, never the thing pressed) with what each mover was before it (`echoState`), and hears only what
  MOVED (`echoMoved`: a door a chain only unlocked says nothing); another player's change lands through `applyRemote`
  and is not heard. A load forgets the abandoned run's book, glow and plays (`forgetDelveRun`).
- **THE LINE.** A mover (`isEchoMover`: a model's tween, an acting flat, a door) set going farther than `ECHO_NEAR_M`
  (3 m) from the eye and out of plain sight is said ONCE A PRESS, the first such in chain order, on the popup line:
  "Stone grinds somewhere below you, to the west." (`echoLine`: the verb by kind - an action door swings, a secret wall
  grinds as the stone it is (`isActionDoorObject`); `wayWord`: above/below past `ECHO_VERT_M`, the compass way past
  `ECHO_FLAT_M`, in the compass's own frame - +x east, +z north - `systems/compassWords.js`, the angler's too).
- **THE MAP.** Each such mover goes in the echo book (`createEchoBook`, at most 8, the oldest out first) and on the held
  map's dungeon sheet as an echo mark (`ui/automapSheet.js` kind `echo`, `ui/inkAutomap.js`: a ring breaking into four
  rays, in the way-in's pen, named "Moved" in the names' pen), seen or not - the press said which way, and the mark is
  where it said. The sheet breathes while one stands on the sheet in view; on the solid map one off the floor in view
  names its floor.
- **FOUND.** A few times a second (`ECHO_LOOK_S`) an echo whose mover stands in plain sight within `ECHO_FIND_M` (12 m) is
  taken off the map and LIT for the look round's hold in the secrets' colour, where it is now. Switched off, the book is
  kept.
- **THE EXAMINE.** In Info mode the plaque over an action object adds the way its chain works ("Works something to the
  north-east", "Works something above it"), walked without playing it (`chainMovers` along `ActionSystem.nextOf`, loop-
  and depth-safe to IsPlaying's own `PLAY_DEPTH_MAX`), from the object's own box. On the World Tooltips label; never
  under the author's `HideDefaultInteractTooltip`.
- `test/echo1_dungeonecho.test.js` (11); `tools/mutants/echo1.json` (35).

## WAYOUT1 - THE WAY OUT ON THE COMPASS (SHIPPED 2026-10-05)

`systems/wayOut.js`, read by `scenes/dungeonContext.js wayOutMark`, drawn by `ui/enhancedHud.js drawWayOutMark`
(through `ui/hud.js drawHud`'s `wayOut`).

- **THE TRAIL WALKED BACK.** The held map keeps where the player has STOOD (`systems/automap.js automapTrailTick`, a
  one-metre grid at the scan's 5 Hz, saved) - and every cell between two samples up to `TRAIL_FILL_M` (3 m) apart, since
  a run's sample skips a cell (AUDIT DELVE B1; past it the player was carried). A breadth-first field from the way in
  (the start marker - the map's own beacon) over those cells: two side by side (or one over the other) within
  `WAY_STEP_DY` (1 m) of height are a step both ways unless the dungeon's own geometry stands across it (`stepClear`, a
  waist-high ray past doors and movers, a wall between the cells and not at either end - `stepHitCuts`,
  `WAY_STEP_END_M` - each step asked once, `WAY_STEP_ASKS` a build); a walked teleporter
  (`teleporters`) a step from its entrance to its exit only. The cells are parsed once and added to; the field is built
  again when the player stands off it (at most every `WAY_FIELD_S`), every `WAY_REFIELD_S` while the trail grows under
  them, and at once when the trail shrinks (another run's record), the way in moves or a teleporter is walked. A load
  forgets it.
- **WHERE IT POINTS.** The farthest cell along the field, within `WAY_LOOK_CELLS` (14), the eye can see - so it turns
  the corners the player turned and never points through a wall; never past a teleporter's jump (the mark stands on it
  until it is taken). With no walked way to the way in (a Recall into the level, a save older than the trail), the way in
  itself, as the crow flies. Gone within `WAY_HERE_M` (3 m) of the way in, and before the way in has been found.
- **THE MARK**: an arrow pointing up and out, a dark body (`WAY_BODY_CSS`) rimmed in the parchment's light
  (`WAY_MARK_CSS`), in its own band under the strip (clear of the quest's diamond and the letters), on the compass's
  bearing law, clamped; enhanced HUD only (the classic compass is DFU's).
- `test/wayout1_wayout.test.js` (13, the real tick at the motor's speeds among them); `tools/mutants/wayout1.json` (34).

## GUIDE8 - THE GUIDANCE TIERS (SHIPPED 2026-10-05; the Town tier and the Exact tier indoors at AUDIT DELVE)

`systems/questGuidance.js` (`GUIDANCE_TIERS`: Journal / Town / Exact). Underground, `scenes/worldModes.js
dungeonQuestMarksHere` (the host owns the stands and the quest foes) hands `questMarks` to `scenes/dungeonContext.js`,
which draws them on the held map (`quests`) and the compass (`questCompassMark`, `questCompassPick`); indoors,
`interiorQuestMarksHere` hands them to the interior's map and its compass; on the street, `scenes/world.js`.
`06-Systems/Quest-Guide-Arc.md` GUIDE8 and DECISIONS 3.

- **JOURNAL** is GUIDE5's law and the default.
- **TOWN**: in the town of the building a quest's latest entry NAMES (its `_p_`, `ui/questLens.js entryTarget`'s
  `building`), the held town map rings it, found or not (`townQuestBuildings`, `ui/townSheet.js`), and the compass points
  at it (`townQuestCompassMark` - the building's place in the town map's own frame, `townBuildingLocal`, turned back by
  the translation and the origin the map opens with). The place the journal already gave, found in its streets.
- **EXACT** holds the Town tier, and is the quest debugger's knowledge: every quest resource standing in the dungeon or
  the building - a stand that is active and not dead (an item not yet taken, a person), a live quest foe (a shared
  quest's foe a party mate's client owns too: `questFoeBehaviour`), a person of the place a quest has taken - never a
  hidden one (`dungeonQuestMarks`), named as the plaque names an item, a person or a foe by their own name.
- **THE MAP**: GUIDE5's own diamond (`ui/inkMap.js paintQuestMark` - gold edged in ink, the followed quest's filled),
  its name under the spot in the names' pen, on its own storey (on the solid map, one off the floor in view names its
  floor); the hover says what a filled diamond is ("Followed quest") and measures to the diamond as well as the spot;
  the quest's floor is LISTED on the strip before it is walked and wears the diamond there (`floorStripLayout`'s `quest`,
  the words standing in when the marks need the room).
- **THE COMPASS**: the followed quest's nearest mark, else the nearest (the enhanced compass's quest diamond); the
  tracker is fed while the Town or Exact tier is on (`followOn`).
- Exact is the one tier that can spoil a search: off by default, its own row, the enhanced skin only.
- `test/guide8_questguidance.test.js` (15, the echo's sheet mark with it); `tools/mutants/guide8.json` (34).

## DETECT-FINDS - A SEARCHED OBJECT'S FIND IS TREASURE (SHIPPED 2026-10-05)

`scenes/shared.js nearbyLootRecords`'s `searched` (`searchedNearbyRecord`), the dungeon's Detect walk. DFU's Detect
Treasure walks every DaggerfallLoot; SEARCH1's coffins, shelves, chests and crates hold the room's rolled find in
`items` until it is taken, so the one loot walk carries them, at the box's middle. Unsearched, a searchable holds
nothing yet (the find is rolled at the search), so GetLootFlags gives it no Treasure bit - as an empty corpse. The
street's searched headstones need nothing of their own: a grave's find is minted as a dropped pile (`scenes/world.js
activateGrave` -> `droppedLoot.dropPile`), and the street's Detect walk carries every pile (pinned).
`test/dsize1_mediumdungeons.test.js`.

## DSIZE1 - MEDIUM DUNGEONS (SHIPPED 2026-10-05; REDESIGNED at AUDIT DELVE against MAPS.BSA)

`world/smallerDungeons.js` (`dungeonSizeFor`, `generateMediumDungeon`, `MEDIUM_LAYOUT`, `MEDIUM_DUNGEONS_STATE`). The
size tier `10-UI/Features-Arc.md` FT1 left open. A dungeon of more than 8 blocks is regenerated by GenerateSmallerDungeon's
own law (`regenerateDungeon`, the one body both sizes draw through) - its own block list, GetRandomBlock's two pools,
DFRandom seeded on the MapId, so the same every visit - as two interior blocks side by side (the starting block first)
and the six border blocks that close them: the commonest shape MAPS.BSA has (every one of its 1,162 eight-block
dungeons). The first cut's cross of five over thirteen touched only the 159 dungeons over thirteen, every one of them
four interior blocks in a ring of ten - it made them bigger inside (`01-Overview/Audit-Delve.md`, the real data). Every
guard Smaller Dungeons keeps, Medium keeps (main story, the arena's undercroft, online, a quest's frozen size); Smaller
Dungeons wins when both are on; DFU's `useSmallerDungeon` stays DFU's, verbatim. The quest freeze and the save stamp
carry it as 3, APPENDED past DFU's NotSet/Disabled/Enabled (which stay verbatim); the load-time warp compares the stamp
whole, so a save made at any of the three sizes and loaded at another stands at the start - and its world record (a
layout's foes, piles and acts) is left unapplied (`otherLayout`). Online the stamp is the world's sizes (it was
Disabled: the room built every dungeon whole); a quest whose markers were chosen through another quest's link takes that link's
size where the medium size is either side (`adoptLinkedDungeonSize`, the machine's Start); and a quest frozen at another
size loaded online is RE-LAID on the room's build (`systems/quest/questRepair.js`: its markers enumerated again, its
placements put back, its stamp the room's). Its own row beside DFU's, which stays DFU's switch, whole.
`test/dsize1_mediumdungeons.test.js` (11, DETECT-FINDS' with it, MAPS.BSA's with ARENA2); `tools/mutants/dsize1.json`
(27).

**SD-ONLINE (2026-10-05, Mac: "So medium dungeons will be the new by default option thats on (online only)", then "On
second thought. Large, medium and small should all play into account online" - "World mixes sizes") - ONLINE EVERY
DUNGEON HAS THE WORLD'S OWN SIZE.** The first of the Super Dungeons arc's slices (`11-Multiplayer/Super-Dungeons.md`
section 13). Online the size law answers the world's size for the dungeon (`onlineDungeonSize`: one salted draw of the
port's seeded die on its map id - small, medium or large, half of them medium; it answered `'full'`, AUDIT WORLD34 B2's
one layout), whatever either switch or a quest's frozen copy says; the quest stamp online is ONLINE_DUNGEONS_STATE (4,
past the medium size's 3), so a quest started online builds its dungeons at their online sizes offline too; the re-lay
turned around (`relayOnlineDungeons`, it was `relayWholeDungeons`) and reads every other stamp, DFU's NotSet included,
keeping the stamp of a quest one of whose dungeons it could not read; a new row, *Dungeon sizes as online*
(`world-dungeon-sizes`), asks for the world's sizes offline and is forced on online, so the sync copies it home (the
medium row is forced off online). And A DUNGEON'S ROOM IS ITS LAYOUT'S, as a building's is (WD3): an older page lays
every dungeon whole and the relay keeps a room's memory for thirty days, so a re-laid dungeon stands in
`dungeon:m<id>.s` or `dungeon:m<id>.m` (`net/online.js roomKeyFor`, reading `world/smallerDungeons.js
builtDungeonSize` off the build through the mode machine's identity; `net/wire.js` WORLD_ROOM and DUNGEON_ROOM_TAGS -
the relay's `world171`), while a dungeon built whole - the main story's, the undercroft, one the world leaves large, one
no bigger than its size - keeps the room and the memory it always had. `test/sdonline.test.js` (10);
`tools/mutants/sdonline.json` (13).

## THE FOUR HOSTS

| Host | SENSE1 | ECHO1 | WAYOUT1 | GUIDE8 | DETECT-FINDS | DSIZE1 |
|---|---|---|---|---|---|---|
| `scenes/dungeonContext.js` | wired (the frame both dungeon hosts call) | wired | wired | wired (map, compass) | wired (its searchables) | the build it is handed; the load's world record |
| `scenes/worldModes.js` | FLAGGED - dungeons only, by scope (its interior namer takes `actionObjectName`) | FLAGGED - by scope | FLAGGED - by scope | wired (hands the dungeon its marks; the Exact tier indoors, map and compass) | wired - no searchables indoors | wired (`dungeonLocationFor`) |
| `scenes/world.js` | FLAGGED - by scope | FLAGGED | FLAGGED | wired (the Town tier: the town map's ring, the compass) | wired (the graves' finds are piles) | wired (the quest layer's sized locations; the re-lay at an online load, through the bridge) |
| `scenes/exterior.js` | FLAGGED, as the street | FLAGGED | FLAGGED | FLAGGED (the offline dev host) | wired - no searchables | wired (the quest layer's sized locations) |

The standalone dev host `scenes/dungeon.js` counts its mode keys' presses, so the look round answers there too.

## Open

- Seen in the game: the glow's card on a wall-mounted lever, the echo's line on a long chain, the medium size's blocks
  walked.
- Indoors, a shared quest's foe a party mate's client owns (a puppet of the interior pool) is not marked by the Exact
  tier; underground it is.
