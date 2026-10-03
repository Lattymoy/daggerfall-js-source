# AUDIT WD3 - Beautiful Villages and Beautiful Cities audited, 2026-10-02

Mac, of WD3 (`03-World/Beautiful-Towns.md`, carademono's two town mods ported 1:1): *"Can you do a comprehensive audit
on this and ensure its perfection"* - and, of what it found, *"Fix anything. This needs to be perfect"*. Six commits:

- `3c5ac244d` - the first pass: castle dungeons, the door's latch, the online layout refusal, questors, temple doors;
- `1ef806523` - its follow-up: the sale ungated, cites shifted, mutants re-aimed;
- `ace134b8a` and `c1476174b` - round 3: online pins, held visits, sleeping deeds, the market, the packs; town scenery
  is not people; inside saves by key;
- `6fe8d0c76` and `cbd307e98` - round 4: the curation, records honoured across layouts, the online gates; six source
  pins re-aimed to the changed lines.

No commit is titled round 2.

**This page was written after the fact** (AUDIT PRE-MERGE 1003 D18, 2026-10-03). The audit's 38 finding IDs were cited
in `src/`, `server-account/`, the tests, `09-Testing/Testing.md` and the Ledger's WD3 row, but no page said what each
one was. Everything below comes from those six commits' messages and diffs, the comments each ID stands on, and the
tests that pin them. Where those sources say nothing, this page says nothing either:

- **Severities.** The audit never recorded them, so the Sev column is "-" throughout.
- **The letters.** What the letters (B, G, H, O, P, R, S, T) stand for is not recorded. The tables group the IDs by
  what they touched.
- **P4.** No P4 is cited anywhere in the tree, and the commits do not say whether one was raised.
- **Reused IDs.** An ID can carry fixes from more than one round (B4 rounds 3 and 4; H1 rounds 3 and 4; T2 rounds 1
  and 4). Each row says which round did what.

Each fix carries an `AUDIT WD3 <ID>` comment. The mutants are `tools/mutants/auditwd3.json`, recorded at each round:

| Round | Mutants | Result |
|---|---|---|
| The first pass | 14 | 14 dead |
| Round 3, first commit | 20 | 19 dead, 1 equivalent |
| Round 3, second commit | 22 | 21 dead, 1 equivalent |
| Round 4 | 36 | 35 dead, 1 equivalent as recorded |

Re-run at AUDIT PRE-MERGE 1003 on PR #545's head, without ARENA2: the same 35 dead and 1 equivalent.

## Fixed

**The packs and the door** (`src/formats/worldDataReplacement.js`, `src/formats/worldDataPack.js`,
`src/scenes/modWorldData.js`, `src/systems/layoutPins.js`, `src/systems/features.js`, `tools/worldDataPackBuild.mjs`,
`tools/worldDataPackNames.mjs`; the pins in `test/wd3_door.test.js`, `test/wd3_pack.test.js`,
`test/wd3_layoutPins.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| P1 | - | A town served from a pack dropped its dungeon's `RecordElement` (the reader set it null), and every dungeon reader asks its header's `LocationId`. Under Beautiful Cities, Castle Daggerfall, Sentinel and Wayrest crashed on entry. | The first pass: `dungeonFromJson` reads `LocationDungeon.RecordElement` as DFU keeps it (DFLocation.cs). The castles are entered and saved in as in Daggerfall. |
| P2 | - | With Replace Game Artwork off (the door closed), a town mod switched on was latched loaded and its pack fetched all the same, and a save's pin still let a pack in. Records were stamped with a layout the closed door does not show. | The first pass: a closed door loads no pack (no 26 MB fetched for nothing), latches no mod loaded and honours no pin (`ensureWorldDataPack`). A house bought behind it is stamped with the Daggerfall town it stands in. |
| P3 | - | The door's gate (Replace Game Artwork; online, the room) was read at every ask. DFU reads AssetInjection once, at startup, and the boot's location index keeps a pack's grids, whose new blocks only the door can serve: a gate turned shut mid-game would stand holes in every town. | The first pass: `latchWorldDataDoor` reads it once for the game, beside the mods' switches. |
| P5 | - | A pack's `$c` reference (a node of a classic block) named its block by index alone. On a BLOCKS.BSA in another order, a file read another block's pieces. | Round 4: every `$c` index is named (`classicNames`), checked by name as a `b` base is, and refused by name. `tools/worldDataPackNames.mjs` laid the names into both vendored packs, and the builder writes them. |
| P6 | - | Two asks at once for one pinned pack (the online layouts' retries) fetched it twice. | The first pass: the two asks share one fetch. |
| B1 | - | A town mod switched on whose pack did not load (the network; a browser without DecompressionStream, where the reader reached for `node:zlib`) was latched loaded all the same. Its towns stood as Daggerfall's while records were stamped with the mod. Online, a home could be bought keyed in another layout than the room's. | Round 3: a mod is latched loaded only once its pack is on the door. One whose pack did not load is a mod not loaded: its towns are Daggerfall's and stamped so, the game says so (`worldDataPacksMissing`), and online no home is bought ("Reload the game to buy a home", `home-towns`). The reader asks for `node:zlib` only under node. |
| B4 | - | The packs' cost. They were fetched one after another with no timeout, so a stalled fetch held the boot. Every block was hashed against the author's file the first time it was served, each hash a hitch on a phone. Memory was unbounded: the door kept every block it served and a pack every node it decoded, and a walk over every block of both packs grew the heap by 259 MB. | Round 3: the packs are fetched side by side under `PACK_FETCH_TIMEOUT_MS` (120 s), and one block in 8 is spot-checked. Round 4: the door keeps the 192 blocks most recently served (`BLOCK_CACHE_MAX`) and a pack the 1,024 nodes most recently read (`DECODED_NODES_MAX`). The same walk now grows the heap by 84 MB. |
| B5 | - | Two stamps are one layout whatever versions they name, which holds only while each mod ships one version. Nothing held the vendored packs to the versions the stamps were made against: a pack of another version could move buildings under every stamped record with nothing to say so. | Round 4: `LAYOUT_MOD_VERSIONS` (1.4.2 and 0.5.0). `test/wd3_layoutPins.test.js` holds the vendored packs to them until a layout migration is written. |
| B9 | - | The two switches' Features row said "Takes effect when the game next loads". But the switch is latched for the game, so an in-game Load keeps the towns the game started with, and offline the towns also need Replace Game Artwork. | Round 4: the row says "Takes effect when the game is next started (an in-game Load keeps the towns it started with). Offline it also needs Replace Game Artwork." |

**Online homes and rooms** (`server-account/src/homes.js`, `server-account/src/index.js`, `src/net/accountClient.js`,
`src/net/online.js`, `src/world/interiorShared.js`, `src/systems/onlineHomes.js`, `src/scenes/world.js`,
`src/scenes/worldModes.js`, `src/scenes/homeYards.js`; the pins in `test/wd3_online.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| O1 | - | A claim from a client whose town stood in another layout than the town's homes was stored under the town's layout. Its building key names a building of the town that client sees, so the buyer was handed a stranger's house. | The first pass: such a claim is refused with 409 `home-layout`, naming the layout the town keeps (`homeLayoutsMatch`). The client hears the layouts again (`hearHomeLayouts`) and builds the town as the room's. |
| O2 | - | Online, the client asked for the homes' towns' layouts a few times and then gave up ("each stands as the room's mods lay it out"), and dropped the first ask's late answer. A home could be bought or furnished before they were heard, its building key naming a building of the town's layout, which may not be the one standing. | The first pass: until the layouts are heard no home is bought and no home's room is furnished (`homeLayoutsHeard`). The asking never stops (at the longest wait once the first few asks have passed), and the first ask's late answer is still heard. The follow-up (`1ef806523`): a stray copy of the gate had gated the sale too; it now stands only on the purchase. |
| B2 | - | A claim naming no layout (a build from before the town mods, whose town may stand in another layout than the room's) could not be told from a classic claim. Round 3 recorded this as a known limit. | Round 4: every build says its layout (`null` for Daggerfall's own). A claim that names none is refused with 426 `home-update` ("This game is out of date. Reload it to buy a home."). |
| B3 | - | An interior's relay room was keyed by building alone. Two players whose town stood in two layouts shared one room from two buildings (its doors, its chests, its memory), and a memory the relay kept from before the mods landed on another building of the same key. Round 3 recorded this as a known limit. | Round 4: `layoutRoomKey` puts the layout mods serving the town in the room key's high bits. Daggerfall's own town keeps the rooms it always had. |
| B7 | - | The client's re-ask of the layouts (after a claim refused for its town's layout) had no throttle: a door pressed again and again asked each time. | Round 4: one ask at a time, and none again within `HOME_LAYOUTS_WAIT_MS`. |
| B8 | - | A claim refused for its town's layout counted against the hour's claims, so a client that heard the town again and claimed once more could find itself rate-limited. | Round 4: the service checks the layout before it counts the hour's claims. |
| R2 | - | "Heard" meant the service's answer had arrived. A home could be bought before its pins stood (the packs they let in fetched, the towns rebuilt). | Round 3: heard means APPLIED (`_homeLayoutsApplied`), with every town pack of the room's loaded here (B1). |
| R3 | - | With two `applyLayoutPins` calls in flight, an older one that finished after a newer one set its stale pins. | Round 3: each call carries a generation (`_pinsGen`), and an overtaken call sets nothing. |
| R5 | - | The service checked a town's layout before the claim's write, so two first claims at once in two layouts could both be seated. | Round 3: the claim's own write keeps a town in one layout (`LAYOUT_MATCH_SQL`). The check before it stays as the fast refusal (below). |
| R6 | - | A home's yard was laid out and furnished before the layouts were heard. | Round 3: the yard waits on `heard` (`homeYards.js`). |
| R7 | - | When the player stood in a home's room while the layouts were unheard, its pieces stayed unasked after the layouts landed. | Round 3: `homeLayoutsLanded` asks for them the moment the layouts land. |

**The housing promise: records kept in their layout** (`src/systems/layoutPins.js`, `src/systems/sceneCache.js`,
`src/systems/banking.js`, `src/systems/realmCustoms.js`, `src/systems/repairService.js`, `src/systems/tavern.js`,
`src/systems/quest/person.js`, `src/systems/quest/machine.js`, `src/systems/quest/place.js`, `src/scenes/world.js`,
`src/scenes/worldModes.js`; the pins in `test/wd3_layoutPins.test.js`, `test/audit68_worldmodes.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 | - | A permanent scene (a house, a rented room) held back for its own layout was written over when a visit in another layout left: the other layout's empty chests replaced the house's. | The first pass: the held scene is never written over by the visit's leaving. |
| R1 | - | After S1, what a visit in another layout of a house's town left (its chests, its floor) was not kept at all. | Round 3: it is kept BESIDE the house's scene for that layout (`layoutSceneName`), permanent too, and given back on a visit in that layout. It goes with the scene when the house is sold or the room expires. |
| R4 | - | A visit's scene was stamped with the town's layout when the visit ended, so a pin landing mid-visit changed the stamp, though the room stood in the layout the visit began in. | Round 3: the visit is stamped with the layout it began in (`_visitLayout`). |
| S2 | - | A deed that came back through customs lost its town's layout, and its key names a building only in that layout. | The first pass: the layout crosses with the deed (`realmCustoms.js`). |
| S3 | - | A questor met indoors was not stamped. The return to them (QuestMachine.IsNPCDataEqual, by building) asked a building of whatever layout the town stood in now, and the questor pinned nothing. | The first pass: the questor's data is stamped with their town's layout (`quest/person.js`), and the active quests' questors are among the records that pin a town (`getAllActiveQuestors`). |
| S4 | - | Online, a town's discovered buildings were forgotten where its layout had moved before the service had said the homes' towns' layouts. | The first pass: online, nothing is forgotten until the service has answered. |
| S5 | - | A record whose town stood in another layout all the same (offline, a pack that could not be loaded for its pin; online, a realm character's own record from before WD3, since only homes pin online) was read by its building key. A smith's ticket was handed over at a stranger's counter, a room was rented at another building, an inside save or anchor walked the player through a stranger's door, and a quest's building site was another building. Round 3 recorded these as known limits. | Round 4: the record is honoured, never misread (`recordStands`). A ticket is handed over at any smith of its town and a room honoured at any inn of it. An inside save or anchor stands the player outside. A quest's building site is chosen again by the place's own P2/P3 (`Place.reseatMovedSite`, `QuestMachine.reseatMovedSites`). One record is not mended (below). |
| H1 | - | A deed whose town stood in another layout all the same named, by its key, a stranger's house, a shop, a temple or nothing (over the real data: 58% a stranger's house, 31% nothing, 11% a shop or hall). The deed was still honoured there: its door, cupboards, bed, furniture and the bank's sale. | Round 3: the deed SLEEPS (`banking.js deedStands`, in `isHouseOwned` and the bank's sale) until its town stands in its layout again. Round 4 made it the law of every keyed record (`recordStands`, H1/S5). |
| H2 | - | The bank's market could sell a house with no model of its own: two of Beautiful Cities' House2 (DABOOKBL02 13, DAGENRBL03 4), with no door and priced 0. | Round 3: a house with no model of its own is never sold (`housesForSale` `stands`). Every house of Daggerfall's own stands on its model, so no classic market changes. |
| B6 | - | A town a save's records hold that could not be stood in their layout (its pack did not load for the pin) was dropped silently. | Round 4: the game says so once a game: "Some of your places could not be shown as you left them. Switch on Replace Game Artwork, or check your connection, then reload." (`PINS_DROPPED_LINE`) |
| G3 | - | An inside save (and a Recall anchor set indoors) found its building's door by the block's index. A block a world-data mod ADDS is numbered past BLOCKS.BSA in the order a session first reads it, so another session, or a town pinned in again, numbers it anew, and the saved index named nothing or another added block. | Round 3: the door is found by the building's key, with the index only preferred. |

**Daggerfall's own laws the mods meet** (`src/scenes/worldModes.js`, `src/systems/layoutPins.js`, `src/scenes/world.js`,
`src/systems/talkTopics.js`; the pins in `test/wd3_standins.test.js`, `test/wd3_layoutPins.test.js`,
`test/wd3_door.test.js`, and the climate's source pins in `test/windmillwiring.test.js`, `test/seasoncalendar.test.js`,
`test/wod4_privateershold.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| G1 | - | Every street flat with a faction id was taken for a person. The mods' lamps, food and animals carry faction ids (43,181 flats in 1,371 towns), so they opened a talk window, were theft targets and stole a click from a door. | Round 3: only a flat in a person archive (334, 346, 357, 175-184) carries the trigger collider the ray meets. This is DFU's FlatTypes.NPC, and the same `isNpcFlat` the dungeons ask. |
| G2 | - | Beautiful Villages rebuilds TVRNAS00 and TVRNAS06 as houses (the classic blocks hold three taverns each) and leaves the 274 roadside taverns standing on them (142 and 132; their location files are not replaced) with no tavern: no room, no innkeeper, no tavern quest. DFU serves them so, and round 3 recorded them as the author's blocks. | Round 4: THE PORT'S CURATION. The mod is kept out of a Tavern location whose grid names one of them (`CURATED_CLASSIC`, a standing pin no save holds). Its records are stamped classic, and a save's own pin wins. The 301 village cells laying those blocks out among their own are the author's. A departure (Ledger, WD3 (7)). |
| G4 | - | Four of Beautiful Villages' villages write faction 1000 (the Archaeologists Guild's, its own mod's) on a guild hall entry. DFU without that mod hands the entry to the grid's first hall, so Bubandanis' Mages Guild and Tulaedax's Fighters Guild answered "You get no response", and Tulaedax's Mages hall took the Fighters' faction. | Round 4: an entry naming a guild this game carries none of draws for no hall (`UNCARRIED_GUILD_FACTIONS`), and each hall takes its own guild's entry. A departure (Ledger, WD3 (7)). |
| G5 | - | A town's buildings wore its terrain pixel's climate. DFU's DaggerfallLocation (ClimateUse.UseLocation) dresses them in the location's own climate. That is the same for every classic town, but 81 of Beautiful Villages' towns name another. | Round 4: the buildings wear the location's climate and the terrain the pixel's (`world.js` `townClimateBase`). |

**The stand-ins** (`src/world/townStandIns.js`, `src/world/detStandIns.js`, `src/scenes/modWorldData.js`,
`src/systems/textureReplacement.js`, `src/render/renderer.js`, `src/scenes/dataPipeline.js`; the pins in
`test/wd3_standins.test.js`, `test/wd3_door.test.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | - | The foundation stand-in (53170) stood centred on its origin, as the pack's mesh does. Beautiful Villages stands it only under two temples (TEMPASF1, TEMPASH4), whose floors are 1.55-1.6 m above that origin, so its top walled up their front doors. | The first pass: its top is the temples' floor, 1.6 m up, and the rest goes into the ground. With ARENA2, a sweep finds no stand-in over any exterior door of either pack's towns. |
| T2 | - | The first pass: the stand-ins, installed by the first pack to open, answered whether or not a town pack served any town. Round 4: a stand-in answered over the player's own picture of its record, a loose file or an attached `.dfmod` (the real DET or RMB Resource Pack it only stands in for). | The first pass: the stand-ins are on only while a town pack is loaded for the game or a pin lets one in (`townPacksLive`). Round 4: a stand-in YIELDS, so the player's own pick answers first with Replace Game Artwork on, and a picture already decoded is decided again. |
| T3 | - | A stand-in's clear placeholder (no picture at the time: a fetch that failed, a gate shut) held its key for good, so a real picture asked under that key later was never drawn. | Round 4: the renderer marks placeholders (`_placeholders`). A real picture replaces one, and a placeholder never displaces a real picture. |

## Not changed, and why

- **The service's layout check before the claim's batch** (`AWD3-CLAIM-OVER-LAYOUT`, equivalent as recorded). Since R5,
  the claim's own write refuses a town's other layout and answers `home-layout`. The check before it is kept as the
  fast refusal, with no record prepared, and removing it changes no answer.
- **A questor met indoors before the mods, online** (S5's one record not mended, `03-World/Beautiful-Towns.md`). The
  return to them asks for an NPC who no longer stands in that layout. The patch notes (the pull request's, REL6)
  say so since AUDIT PRE-MERGE 1003 D17.
- **Unnumbered in the commits.** The first pass also corrected the record's counts, the windmills, the pieces shared
  with Detailed Ships and the offline gate. The follow-up and `cbd307e98` shifted cites and re-aimed mutants and
  source pins to lines the fixes had moved.
