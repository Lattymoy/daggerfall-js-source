# FIELD BUGS 2026-10-30b - the court, the yard, the zone's banks, the map's plates, the floor indoors, Torval

Seven Discord reports and the owner's own, handed over in a session. Read on main's `b793e26e1` with the freeware's data
(`tools/fetch-data.sh`). The owner chose three of the fixes when asked (sections 2, 3 and 5). Then read cold and
corrected (`../audits/Audit-FB1030.md`). The mutants are
`tools/mutants/fb1030_fieldbugs.json`. Relay world296 (`net/wire.js`; world293 on its branch, renumbered at the merge
of main). The name `Field-Bugs-2026-10-30.md` is main's CAPE-CARD page, which took it first.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Castle Daggerfall NPCs" - the Queen and Lord Bridwell have "strange hit-boxes for interacting/talking to them" | A person's own Dialogue action took the person's box and won every press within 3.2 m | CASTLE-TALK |
| 2 | "Unable to place decorations on exterior home walls, counted as inside home"; "Outside area considered inside" (a balcony) | A flat's ground was its picture's diagonal; the house's ground stands up to half a cell past its wall; every roof was the house | WALL-TOUCH, YARD-DECK |
| 3 | "Banker in IC referred to mountains" - "the banks in the IC should work, or they should be removed" | PVPDUNGEONS shut every bank in the zone, and the zone is Cyrodiil since WW-C2; its words were still the Wrothgarian Mountains' | ZONE-BANK |
| 4 | "Dungeon Titles stacked on top of each other" - "happens only to procedurally generated dungeons", "mainly in the new areas of the map" | Past the Bay a found spawn within the Overworld's grid stood two plates on one spot | SPAWN-PLATE |
| 5 | "Player models falling through floor" (Gothway Garden's Mages Guild), and players "floating over them ... due to z-axis misalignment" | A peer's height indoors was the sender's town ground's | INDOOR-FLOOR |
| 6 | "torval castle in game is ...": leaving "teleports you in the air", and the palace's records "say not implemented yet" | The way out landed at a 9 m door's middle; a new seat's Hall of Records said only "Nothing is written here yet." | TALL-DOOR, RECORDS-SAID |
| 7 | The owner: "the cape toggle in the inventory also toggles off your aura" | CAPE-TOGGLE hid the aura with the cloak, as asked on 2026-10-29 | main's AURA-STAYS |

## 1. The court that would not talk (CASTLE-TALK)

FOUND. Castle Daggerfall is a dungeon (S0000160.RDB, `dungeonContext.js`). Of its 21 people, 20 carry a Dialogue (29)
action record and one (TEXTURE.183 record 3) shows text. `registerFlatAction` gave each relay the person's own box, and
the relay stands first in the target list: two boxes met at one distance, and the first wins the tie. So within the
relay's 3.2 m a press named no one and did nothing (Dialogue has no delegate). Where the boxes' floats differ by a hair
the person won: 5 of the 20, King Gothryd among them (AUDIT FB1030, the record lane). DFU's PlayerActivate fires the
action and talks to the person on one hit.

MEASURED. The game's RDBs hold 85 person flats with actions: 79 Dialogue, 1 Activate, 5 that show text. No Dialogue or
Activate relay chains on; the three that chain show text. AUDIT FB1030 D2: DFU's Receive rang 28 of them as a sound
(the faction id's high byte read as the action's sound index); the port does not.

FIXED. A person's own relay takes no box unless the person shows text (`showsText`, the law `npcTargets` reads too), so
the person takes the press. Departure in Port-Ledger A. The capitals' castles copy the Bay's halls with their court
re-seated, so the same fix stands past the Bay. AUDIT FB1030 D1: the three copies of Castle Daggerfall dropped its foyer
guard, who opens the doors the court stands behind; the copy keeps a flat that starts a chain. Pinned through the real pick
(`test/scenes/fb1030_castletalk.test.js`): the Queen from two metres, and a noble of Torval's copy of Sentinel's halls.

## 2. The yard against the wall and on the roof (WALL-TOUCH, YARD-DECK)

FOUND. The lantern is a flat. The placer stands a flat off a wall by half its width (WALL-CLEAR), and the lot read its
ground as half its picture's diagonal, which reached a third of a metre into the wall. The house's ground is measured in
0.4 m cells, and a cell whose middle is inside the walls is wholly the house's, so the ground stands up to 0.2 m past the
wall. The balcony is the flat roof of a house's one-storey wing (ARCH3D 541, a deck at 3.22 m beside a 6.45 m storey).
Every roof inside the ground floor's walls was the house.

The owner, asked which flat roofs are decks: "Every flat roof".

FIXED. WALL-TOUCH: a flat's ground is the circle of half its width (`decorTool.js` footprintOf). Each model of a home
keeps its ground floor's wall lines (`modelFootParts` `walls`, a frame's `grounds`). A point of a piece's ground is in
the house only past those lines by more than the wall's clip; a cell past them is the yard's. Ground outside the walls
(a step, a post with none, a joined lot's other house) is judged by its cells, 5 cm in, as before. A lot with no parts
known (its box, an Imperial City door) is the house wherever met. A flat's turn is refused only for a reason it did not
stand in already (its ground is the same turned), so a lamp on a wall turns; a model's whenever its turned box is.

YARD-DECK: every level roof facing up inside the ground floor's walls is a deck (`decks`, the lowest in a cell). A piece
whose foot stands on one is the yard's, unless walls standing a metre over the deck enclose it (`storeys`, whatever
their foot - a storey's; a parapet is lower). Under it, the house's. A model's foot is its origin less its reach below
(`foot.bottom`). A deck under 4 m² (a stair's tread or landing) is none. The yard's 4 m height still holds, so a 6.45 m
roof is refused as too high.

Measured over BLOCKS.BSA's town blocks: of 8,058 residences (a house for sale, House1 to House6), 1,114 stand a deck
at 4 m or lower, 122 of them beside sloped roofs. Pinned on synthetic houses and on ARCH3D 541, 125, 606, 709 and 41902
(`test/world/fb1030_yarddeck.test.js`). Past the Bay the law reads a model's faces and no place. AUDIT FB1030 Y1-Y8
(`../audits/Audit-FB1030.md`) reworked both.

## 3. The banks of the zone (ZONE-BANK)

FOUND. The Imperial City is in the open zone, and PVPDUNGEONS refuses every bank there ("Players cant use banks in
zone"). The refusal said "There are no banks in the mountains." - the zone's place before WW-C2. The bank's own region
reads right (the province's, 70).

The owner, asked: banks "Work in settlements".

FIXED. A bank in a city, town or village of the zone serves (`zoneSafe.js` zoneBankOpen: the place its door's pixel
stands, a settlement's kind, ZONE-SAFE's law). Elsewhere in the zone the door says "In the open zone, banks serve only
cities, towns and villages." (`wild.bank.shut`, every language). Pinned with the Imperial City's slice as the producer
mints it (`test/systems/wild/fb1030_zonebank.test.js`).

## 4. The plates stacked (SPAWN-PLATE)

FOUND. The Overworld plates every known place within its grid (`travelViewPlaces`) and every known dungeon past it
(`nearDungeons`). On the Bay a spawn has no MAPS.BSA row, so it has the dungeons' plate alone. Past the Bay the place
summary reads the live index, so a found spawn within the grid stood both plates on one spot: one name, two second
lines ("Regular Dungeon, Small" and "... - 0.4 km").

FIXED. A spawned dungeon wears the dungeons' plate alone, as a zone hall does (HALL-PLATE). Its journey is unchanged:
`tvPlaceSummary` still answers it. Pinned on the report's pixel and on the Bay (`test/scenes/fb1030_spawnplate.test.js`).

## 5. The floor indoors (INDOOR-FLOOR)

FOUND. A building's rooms stand on its door's matrix, at the height each client builds its town's ground. A pose
indoors carried the sender's height alone, so two copies whose ground differs drew each other sunk or floating by that
much. GROUND-GATE (`Field-Bugs-2026-10-17f.md`) turns an older ground away once the relay runs it with its switch on;
GROUND_LAW 5 (world286) is not yet deployed. Gothway Garden's guild stands its doors on one model, so the door entered
is not a cause there.

The owner, asked: "Room-relative height".

FIXED. A pose indoors carries its room's origin, `fy` (`net/peer/indoorFloor.js`, kept by `validPose` from world296 and
by the eased pose). A reader indoors draws the peer as high over its own room's floor as over the sender's. A sender
without it, or a reader outdoors, reads the height as before. Foes indoors are still their owner's height.
`test/net/fb1030_indoorfloor.test.js`, on the Bay and in Torval.

## 6. Torval's castle (TALL-DOOR, RECORDS-SAID)

FOUND. The way out lands at the lowest dungeon door's centre less half a body (DFU's law). The Mane's palace door is
9 m tall, so the feet stood 3.6 m over the plaza; the capitals' castle doors are 4.5 to 19.2 m tall (the White-Gold
Tower's the tallest, 8.7 m up). On the Bay the tallest door a way out lands at is a crypt's, 3.2 m: 0.7 m up
(AUDIT FB1030 D3: ARCH3D's 19.2 m doors stand only inside a dungeon, S0000003). The palace's "records" are the Hall of Records' shelves; a new seat's book said only "Nothing is written
here yet."

FIXED. TALL-DOOR: the feet never stand over the floor before the door (`enterExit.js` dungeonExitFeet, the footprint's
floor or the terrain's). Departure in Port-Ledger A. `test/player/fb1030_talldoor.test.js`, with the Mane's own door.
RECORDS-SAID: an empty Hall says "No guild has held this seat yet. Its claims, sieges and holders are written here."

NOT FOUND. The screenshot's dark void with green blocks. `tools/torvalCastleProbe.mjs` walks the castle in the real
game; it never reached the castle here (SwiftShader's stream had not gone idle after an hour, then 30 minutes), and the
owner stopped the probes. Border blocks were checked: over all 4,232 MAPS.BSA dungeons each B block closes any
side, so the copy's borders are not the cause. The report's question of why there are few walled cities past the Bay
is a design question, left for the owner.

## 7. The cape and the aura

The owner, 2026-10-30, reporting CAPE-TOGGLE as built: "the cape toggle in the inventory also toggles off your aura".
Main fixed the same report first (AURA-STAYS, `25e654210`: the switch hides the worn cloak alone). This branch's own fix,
CAPE-AURA, also dropped the look's `hc` from the wire; it was withdrawn at the merge of main for AURA-STAYS
(`04-Characters/Cape-Toggle.md`), so the relay's world296 changes `fy` alone.
