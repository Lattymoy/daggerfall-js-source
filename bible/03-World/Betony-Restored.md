# Betony Restored (BET1, 2026-10-05)

Cliffworms' **Betony Restored 1.1.3** (Nexus 515), ported 1:1 - the owner,
2026-10-05: "This is the next mod I would like to integrate". Provenance and
permission are `vendor/betony-restored/README.md` (the author's readme: "The
mod may be distributed/translated without my authorization as long as I am
credited as the author"); the pack's format is
`02-Formats/World-Data-Patches.md` (WD3, and the two things BET1 added to it).

## What it does

The places of Daggerfall's Betony demo, on the island of Betony (region 19):

- **25 new locations** (`locationnew-<name>-19.json`): Betony City - 6 x 6
  blocks, 311 buildings, Lord Mogref's palace, the marketplace, every guild
  hall and the Knights of the Dragon's - three hamlets and a village
  (Chestercester, Westtale, Westbury, Waterborne), seven dungeons (the readme
  counts six), and ten homes and farms, a tavern, a temple and a shrine. They
  take region 19's indices 25-49 after its own 25, in the manifest's order;
  Betony City is 34, at map pixel (119, 259).
- **Fourteen new blocks**, each Daggerfall's block of the name with the
  author's edits: `WALLAA00Betony` to `WALLAA11Betony` (the city's walls and
  gates, Betony's and Daggerfall's banners on them), `PALAAA00Betony` (the
  palace: a hall where Lord Mogref hears pleas, a council room, a kitchen, a
  bedroom) and `MARKAA00Betony` (the marketplace: stalls under canopies, three
  taverns, the bank's clerks behind their counters, the shops).
- **A script**: Lord Mogref's faction; the marketplace's traders and peddlers
  set up at dawn, pack up at dusk and go in out of the rain.
- **Pictures**, **Basic Roads' arrays** with the island's roads drawn in, and
  six rules for **Flat Replacer** - the custom people's talk portraits.

One switch, `Enabled`, on by default (`systems/modSettings.js`
`betony-restored`; the Features row under World: "Takes effect when the game
is next started ... Offline it also needs Replace Game Artwork"). Online it is
the room's (`systems/onlineLane.js` `ONLINE_ROOM_MOD_KEYS`): a player without
the island would stand on open hillside where the others see a city.

## How the port carries it

### The world data: a WD3 pack, and two things it lacked

`vendor/betony-restored/WorldDataPack/betony-restored.pack.json.gz` - 39 files
in 111 nodes, 58,812 bytes gzipped from 6,290,798 bytes of JSON in the bundle
(AUDIT D5: not "the bundle's 4.4 MB" - one of its two files), written by
`tools/betonyRestoredAssets.mjs` (which refuses a pack one of whose files does
not rebuild the author's sha256) and loaded as WD3's are
(`scenes/modWorldData.js`: globbed, fetched only when the mod is loaded for
the game, latched loaded only once the pack is on the door).

- **A new place is built on nothing** (`['n']`): a `locationnew-` file is no
  classic location's edit but the author's own record, every key set on an
  empty object. The 25 rebuild with no MAPS.BSA asked.
- **The manifest's order** (`order`): DFU's `ModManager.FindAssets` walks a
  mod's files in its manifest's `Files` order (`Mod.FindAssetNames`,
  Mod.cs:428-460), and that is the order a region's new places take their
  indices in. The pack keeps it, `names()` answers it, and a pack whose order
  misses a file, names one twice or names a stranger is refused.
- **The door is case-blind where DFU's is.** `ModManager.TryGetAsset` asks
  `AssetBundle.Contains`, and a bundle keeps its names lowercased: Betony
  City's grid spells `WALLAA00Betony.RMB`, the bundle's file is
  `wallaa00betony.rmb.json`, and the exact-case door served Daggerfall's
  `WALLAA00` there. Every name is keyed through `assetKey` now
  (`formats/worldDataReplacement.js`). FindAssets is NOT case-blind in DFU -
  `FindAssetNames` compares the suffix ordinal against the manifest's own
  spelling, and the region reader asks the asset's own name
  `StartsWith("locationnew-")` - so each entry keeps the name as its mod
  spells it, and `findAssets` reads that. Under one case-blind key (AUDIT
  C3) a registration naming no mod (a loose file, WD1's) replaces one of its
  own spelling only, and FindAssets takes the first LIVE entry whose own
  spelling ends so - a higher-priority mod's `.JSON` hides no lower mod's
  `.json` place.
- **A pack of new places is no TOWN pack** (AUDIT C1, C2). WD3's gates are
  the layout packs' (`isLayoutPack`, the layout pins' own `LAYOUT_MODS`):
  online, a client whose Betony pack did not land buys homes as before
  (`worldDataPacksMissing` - counted with the town packs, it refused every
  home, hall and yard in every town for the session), the town mods'
  stand-ins are on only while a town pack serves, and the 25 places are
  said as any location is.

### The script (`systems/betonyRestored.js`, off `il/BetonyRestored.il.txt`)

`Betony Restored.dll` is a TextAsset in the bundle; it is vendored byte for
byte and its every method dumped as CIL (`tools/ilDump.py`). The module cites
the offsets it restates.

- **Init** (`installBetonyRestored`, from every host's boot -
  `scenes/shared.js` - and the world-data loader): the mod loaded for the
  game is the loader's latch (a pack that did not land, or a closed door, is
  a mod not loaded), and Init WAITS for it (AUDIT B3) - a host that reaches
  Init first (the classic skin's splash boots the audio, and every Init with
  it, before any world is read) is answered nothing, and the loader calls it
  again once every pack is latched; before, that host latched the switch and
  registered Lord Mogref into a game whose pack then did not land. Then,
  while the mod is loaded, "Begin mod init: BetonyRestored", the faction,
  "Finished mod init: BetonyRestored", the pictures and the portraits.
- **Lord Mogref's faction** (RegisterFactionIds, IL_0308-038d): the IL calls
  `RegisterCustomFaction(1432, data)` with `data.id = 1532`. DFU keys the
  dictionary by the argument and keeps the record as given, so the palace's
  Lord Mogref (183_4, faction 1432) is found, and his parent (203) lists 1532
  among its children - RelinkChildren pushes the record's id. The port kept
  overwriting the record's id with the key; `registerCustomFaction` stores the
  record as given now, a record naming no id taking its key.
- **UpdateExteriorNPCs** (IL_03a4-04b0): nothing unless `IsPlayerInTown(false,
  true)` - a town's location type and the player outside. The type is
  `PlayerGPS.currentLocationType` as DFU keeps it (AUDIT A1,
  `createBetonyLocationType`): TownCity before any location, written only on a
  map pixel that has one (PlayerGPS.cs:627) and never cleared - so the update
  runs in the wilderness after a town, and not after a dungeon's pixel. Then
  every street StaticNPC with a faction takes the law below
  (`betonyNpcShown`). DFU walks
  `ExteriorParent.GetComponentsInChildren<Billboard>(true)` - every location
  the streaming world holds - so world.js hands in every built pixel's people
  and stands again the pixels whose people changed: ONE STAND AT A TIME over a
  pixel's batches (AUDIT B7, `npcStandTurn` - two at once drew both stands'
  people, the trader dusk took down standing on until the next edge), a group
  whose people are the same keeping its batch (AUDIT B4, `planNpcBatches` -
  every edge freed and built a market of a hundred anew).

  | flags | day, dry | day, rain | night, dry | night, rain |
  |---|---|---|---|---|
  | none | shown | shown | shown | shown |
  | 1 (hide by day) | - | - | shown | shown |
  | 2 (hide by night) | shown | shown | - | - |
  | 4 (hide in the rain) | shown | - | shown | - |
  | 1 + 4 | - | - | shown | - |
  | 2 + 4 | shown | - | - | - |

  (1 + 2 is the day bit's: the IL tests it first.) Of Daggerfall's own 76
  street people with a faction one carries a bit - `SENT7.RMB`'s `210_0`,
  flags 81: with the mod loaded DFU hides it by day, and so does the port.
  The law reads every town's street people, not Betony's alone: while the
  mod is loaded Beautiful Villages' markets (279 flagged street people) and
  Beautiful Cities' (71) keep its hours too - as DFU does for a player of all
  three (AUDIT B5).
- **Its events** (InitMod, IL_029a-02d9): `PlayerGPS.OnEnterLocationRect`,
  `WorldTime.OnDawn`, `WorldTime.OnDusk`, `WeatherManager.OnWeatherChange`.
  Dawn and dusk are an hour's EDGE into 6 and 18 (WorldTime.cs:84-95) - a
  jump past them raises none (`createBetonyEvents`); world.js asks each
  frame above its modal gate, where its other clock edges are, and on the
  rect's entry edge - and as a pixel's people stand and on the way out of a
  building (BET-FIX 2, below).
- **BET-FIX, a recorded departure** (Port-Ledger A): the mod's
  `SetActive(true)` also stands back up an individual a live quest has placed
  somewhere else - the away arm of `SetupIndividualStaticNPC` set that home
  copy inactive at layout - so after the next dawn the questor stands twice in
  the world. The port keeps the quest's word: world.js marks `questAway` on a
  person whose quest host sets it inactive, and an away person stays down
  whatever the hour. DEFENSIVE (AUDIT A5): the away arm acts on individuals
  alone (a faction of type 4), and no street person of Daggerfall's, of this
  mod's or of the town mods' carries one - a block a later mod lays may.
- **BET-FIX 2, a recorded departure** (Port-Ledger A, AUDIT B2): THE STATE,
  NOT THE HISTORY. DFU's market is what the last dawn, dusk, rain or rect
  entry left it - a dawn passed indoors leaves it as it was until the next
  edge - and DFU runs the update on every load (`WeatherManager.OnLoad` ->
  `SetWeather` -> `OnWeatherChange`). The port builds and rebuilds pixels
  where DFU keeps its GameObjects (a season's flip, the roads arriving, a
  pin's town), and a rebuilt street stood every trader up at any hour - two
  players in one room saw two markets. A pixel's people take the mod's hours
  and rain as they stand (after the quest's pass: its word stands), and the
  street takes them again on the way out of a building.

### The pictures (`installBetonyArt`)

Measured by the tool's `classifyPicture`, each kept as the doctrine says
("a render of game data is game data"):

| what | how many | carried as |
|---|---|---|
| the author's own: Kamer's sitting patrons (`1200_53` 31 frames, `1200_54` 32 - a drink lifted and set down), Cliffworms' two bottle shelves (`1210_14`, `_15`), the Mara statue (`1230_11`, scale 0.70) | 66 | PNG, his pixels |
| Daggerfall's own records: the smokeless pot (`218_5`, which replaces Daggerfall's own wherever it stands while the mod is loaded, as in DFU), ten of Ralzar's extinguished lights (`540_2` to `540_20`), two shelves stood with classic bottles and goblets (`1210_13`, `_16`) | 13 | WD2 specs (`Textures/derived.json`), rebuilt from the player's TEXTURE files |
| re-shaded whole (`540_0`, `_21`, `_22`, `_24` to `_27`) | 7 | NOT carried (`reshaded.json`): the player's own attached copy of the mod answers; else the classic record each re-shades stands in |
| Detailed Ships' (`1210_8` to `_12`, `_17` to `_20`), identical pixel for pixel | 9 | that mod's, shared (`shareDetailedShipsArt`) |
| the RMB Resource Pack's people the blocks place (`1200_13`, `_14`, `_19`) | 3 | Daggerfall's own people of the kind (`183_10`, `183_5`, `182_45`), yielding to the player's own pack |

89 entries on the texture door, all behind the mod's latch. The tool writes
its listing of `Textures/` (`betony-restored.files.json`), which the
doctrine's gate holds the directory to both ways (AUDIT D1: the integration's
head carried the 66 with no row, and that gate was red on it). Three seams
BET1 found on the way:

1. **A record rebuilt off its own archive deadlocked the archive.** `218_5`
   is built from `218_5`; the pipeline decodes an archive's replacements
   while that archive loads, and the build's `classicRgba` awaited
   `getTexture(218)` - the very promise in flight. The pipeline reads the
   file in hand now (`scenes/dataPipeline.js` `textureLoading`).
2. **A mod's animated flat stood still.** A vendor archive's stand-in
   answered one frame for every record; it answers the frames any tier
   answers - the port's, a loose file's, an attached mod's (AUDIT C4) - 0, 1,
   2 ... to the first missing one (`vendorFrameCount`), as DFU imports a
   billboard's `<archive>_<record>-<frame>` pictures until one is missing
   (TextureReplacement.cs:537-546).
3. **A rebuilt picture of several records** - the shelves are a classic
   bottle and a goblet stood on the author's plank: WD2's spec takes `also`,
   further records laid over the first at their own spots, opaque pixels
   only, before the edits (`formats/derivedTexture.js`).

### Flat Replacer's portraits

Six rules for Numidium3rd's Flat Replacer, each a flat that replaces itself
so that its one effect is `FlatPortrait`. The port has no Flat Replacer; the
face is FLATS.CFG's door (`characters/staticNpc.js` `setFlatFaceOverride`,
which takes a function now - a face asked when it is read). Kamer's patrons
talk with Daggerfall's own faces 360 and 243 while the mod is loaded; the
RMB Resource Pack's four (`TFAC00I0.RCI_1200014` ...) only while an attached
mod carries the picture (`systems/dfmodTextures.js` `hasDfmodCifRci`), else
the face is DFU's own pick.

### Betony's roads

The mod ships Basic Roads' `roadData` and `trackData` with the island's roads
drawn in. Basic Roads reads them through `ModManager.TryGetAsset`
(BasicRoadsTexturing.cs:126-139), which answers from the mod loaded LAST -
and Basic Roads is no dependency of this mod's (AUDIT A3): by DFU's default
order (the mods folder's listing, `basicroads.dfmod` before `betony
restored.dfmod`) the island's arrays answer, as the readme expects; a player
who loads Basic Roads after it gets Hazelnut's. The port takes the default.
`roads.json` carries the
7 road and 24 track map pixels that differ (x 111-126, y 256-270) and each
array's sha256 before and after; world.js lays them over Basic Roads' own
while the mod is loaded (`withBetonyRoads`). The bundle's travel-map picture
(`BasicRoads-paths.png`) is not carried - the port draws the paths off the
arrays.

## The DET and RMB Resource Pack pieces

The mod requires Daggerfall Expanded Textures 1.2.0 and the RMB Resource
Pack 0.3.0; the port carries neither and stands its own pieces in - the same
stand-in for an id whichever mod places it (`world/detStandIns.js`, on while
any mod that places DET's pieces is loaded). Of the 437 distinct models the
fourteen blocks place, 411 are Daggerfall's, 24 stood in and two stand
nothing (below); of the 343 distinct flat records, 71 are the mod's, Detailed
Ships' or stood in (AUDIT D6). Read off DET's catalogue (the RMB
Resource Pack's) and the placements:

| ids | what the catalogue names | read off the placements | the stand-in |
|---|---|---|---|
| `45012`, `45048` | Betony (Tapestries, Banners) | on the city's walls and gates and in the palace, hanging from their origin | the port's own arms of Betony - teal, silver, three waves (`townPictures.js` records 48 and 49, appended) |
| `45078`, `45104`, `45105`, `45131` | Canopy Level | origin 23.5 units out from every wall (eight buildings measured to the wall's plane), 84 apart side by side, stretched along x over the market's tables, two back to back 47 apart closing a stall's roof; the thin wooden posts (`45082`, 85 units) reach 30 over the origin | cloth 84 wide and 47 deep, its back edge 30 up, a valance and a rod at the front |
| `45079`, `45106`, `45107`, `45132` | Canopy Mid Slope | the same | the front fallen 24 |
| `45080`, `45108` | Canopy Sloped | the same | the front fallen 44 |
| `45117` | Hanging Hedge | two rows of three, 42 apart, on a marketplace house's front, the lower row's foot on the ground, the origin 3 out from the wall | a slab of leaves 6 x 44 x 42, three clumps proud of it |
| `10010_0` | Brown Glen Pony | | the brown horse (`201_0`) at three quarters |
| `10010_2`, `_32` | Grazing / Tacked Alcaire Cart Horse | | the brown horse |
| `10010_26`, `_29` | Wayrest Charger, Resting | | the black horse (`201_1`) |
| `10010_8`, `_9` | Gray Rooster, Gray Chicken | | drawn (`standInSprites.js`) |
| `10010_37`, `_39`, `_41` | Resting Brown Rat, Brown Rat | | drawn |
| `10025_1` | Wood Ad Stand (`1025.1`, DET's old number) | | drawn - and so for the town mods too, which listed it as uncatalogued |
| `10027_2` | Bread Pan | the palace kitchen | drawn |

DET's four canopy cloths are not known; each set (by the catalogue's order:
`45078`-`80`, `45104/06/08`, `45105/07`, `45131/32`) wears one of
Daggerfall's own awning cloths (TEXTURE.049 - red, blue, gold, green - the
cloth its stalls wear). The rest of the DET pieces the blocks place
(chimneys, pillars, tapestries, vanes, food) are WD3's and Detailed Ships'
stand-ins already.

### Not stood in

| id | placed | why |
|---|---|---|
| `45187` | 9 | a DET piece no catalogue names, placed only in the palace's interior, at 0.9: each 33-34 units out from one of its ten fireplaces, behind the room's wall - six above theirs (46 to 299 units up), three 248 units below the upper floor's three. What it is is not known (AUDIT D8: "the chimney behind the wall" was a guess the three below do not carry); nothing was known to make |
| `52991` | 23 | the RMB Resource Pack's winter-smoke marker: an effect, no mesh (as WD3) |

## The four hosts

`scenes/world.js` WIRED: the street people's update on the frame's edges
(above the modal gate, and the location rect's entry), as a pixel's people
stand and on the way out of a building (BET-FIX 2), the quest's away arm
marked on its people, Betony's roads on its terrain. `scenes/worldModes.js`
and `scenes/dungeonContext.js` stand no street - the update walks
ExteriorParent's people alone. `scenes/exterior.js` (the bench) FLAGGED: it
stands every street person of a record in one batch for the whole city, up
front, and cannot set one down (`systems/betonyRestored.js` carries the flag;
`bible/Home.md` lists it). The faction, the pictures, the stand-ins and the
portraits are doors every host reads.

## Pins

`test/bet1_betony.test.js` (32): the vendored files against the manifest (the
author's 66 pictures by hash, the tool's listing the doctrine reads); the pack (its 39 files, `['n']`, the order and
its refusals; every new place rebuilt sha256 for sha256 with no MAPS.BSA); the
door (case-blind TryGetAsset, ordinal FindAssets, the region's indices in the
manifest's order); the faction; Init and the latch; the law's every flag, day
and night, dry and rain; the street update (town, outside, faction, BET-FIX);
the events; the pictures (89, gated, yielding where they stand in); the
patrons' frames; the `also` layers; the pipeline's own-archive build; the
portraits; the roads (sha256 for sha256 over Hazelnut's); the DET pieces and
flats; the switch, room and credit; the hosts' wiring; and AUDIT BET1's -
the sticky location type, the stand's plan, one stand at a time and the
hours as a pixel stands (both on world.js's own stand, run over a test host),
a pack of new places no town pack, the door's spellings, the frames of any
tier, the portrait file and the producer's records - and with
`ARENA2_PATH`, every pack file rebuilt from the player's BSA files, the
region off the player's MAPS.BSA, the thirteen rebuilt pictures the author's
(hashes pinned), and every placement classic, stood in or one of the two
above. `tools/mutants/bet1.json`: 74 mutants, 74 dead. Audited the same day:
`01-Overview/Audit-Betony-Restored.md` (AUDIT BET1).
