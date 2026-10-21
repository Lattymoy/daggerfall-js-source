# CODE MAP - where things live, and where a new file goes

Opened 2026-10-16 (TIDY1). A teammate's read of the tree: the directories are not documented and do not make sense,
things are placed where they lie, and nobody knows where anything is. Mac: *"Well I wanna take this on"*, then
*"Do everything"*.

This page is the map. `test/tooling/tidy1_codemap.test.js` holds it to the tree both ways: every directory under `src/` that
holds code is in the table below, and the table names no directory that is gone. A change that adds a directory
adds its row here.

## Why

Measured 2026-10-16 on main (f87572c5):

| Where | Files | Loose (not in a subfolder) |
|---|---|---|
| `src/systems/` | 651 | 530 |
| `src/ui/` | 371 | 369 |
| `src/world/` | 214 | 214 |
| `src/net/` | 174 | 174 |
| `src/scenes/` | 141 | 141 |
| `test/` | 3,349 | 3,282 |
| `tools/` | 2,500 | 414 |

Before this page there was no map. `Home.md`'s "Repo layout" named four of the fourteen `src/` directories, no
folder under `src/` had a README, and `01-Overview/` held 274 pages, 263 of them dated records (field bugs, audits, handoffs),
so "Overview" is a log rather than an overview. `src/systems/` holds features that obviously belong together and
were never put together: 19 `travel*` modules, 16 `arena*`, 13 `item*`, 9 `loot*`. It also holds app plumbing
(`appStorage.js`, `appRoot.js`, `audio.js`) beside the game's law.

Host splitting (`Host-Split.md`) does not fix this, and it can make it worse. It takes code out of the four hosts,
and what it takes out lands loose in `src/scenes/` or `src/systems/`.

## The map

### The repository

| Directory | What lives there |
|---|---|
| `src/` | The game client. Everything the browser and the desktop app run. |
| `server/` | The relay (a Cloudflare Worker, one Durable Object `Room` per room): the wire's authority. `server/src/index.js` is its host. |
| `server-account/` | The account service (a Cloudflare Worker): accounts, and what the realm keeps between sessions - guilds, boards, ladders. `migrations/` are D1 migrations - applied, never edited. |
| `app/` | The desktop app's Electron shell (`main.cjs`, preloads, packaging). |
| `bible/` | The design record, one folder a section (`01-Overview/` to `12-Enhanced-AI/`). `Home.md` is the index and its Process rules bind every change. `01-Overview/` holds the overview pages - this map, `Port-Doctrine.md`, `Port-Ledger.md`, `Host-Split.md` - and files its dated records by kind: `audits/` (every audit and review), `bugs/` (the field-bug passes, the bug lists, the incident), `handoffs/` (hand-offs, integrations, the dated asks and status snapshots). |
| `test/` | Every test, in the folder of the layer it tests and, there, its feature's folder (`test/systems/arena/`) - mapped below. `bible/09-Testing/Testing.md` has one row per file, by its name. |
| `tools/` | Developer tools run by hand or by the suite: probes, bakes, gates, the mutation lists (`tools/mutants/`). |
| `scripts/` | Build, release and bake scripts run by npm and CI (`buildTag`, `desktopRelease`, `updateNumber`, the `bake*` scripts). |
| `public/` | Vite's static root, copied into the build as-is: art, sound, fonts, the mods' assets. No game data (`Port-Doctrine.md`). |
| `vendor/` | Daggerfall Unity mods' published files, kept as handed over, for reference and for the bakes. |
| `locales/` | Translations: one folder per language, string tables in DFU's format (`locales/README.md`). |
| `play/`, `privacy/`, `terms/` | Static pages served beside the game. |
| `*.html` at the root | The game's entry (`index.html`) and the labs: one page per prototype or viewer, each registered in `vite.config.js`. |

### The game client, `src/`

| Directory | What lives there |
|---|---|
| `src/` | `main.js`, the entry point and scene router; `buildTag.js`, written by the build. |
| `src/ai/` | Enemy behaviour: tactics, blows, the navmesh. |
| `src/characters/` | People and creatures: bodies and rigs, outfits and dyes, enemies, NPC builders. |
| `src/combat/` | Combat law: FormulaHelper's port, weapons, hits, spells in the hand. |
| `src/formats/` | The readers for Daggerfall's (and Morrowind's) file formats. Exact to DFU's (`Port-Doctrine.md`, Scope). |
| `src/net/` | Online: the client's link to the relay, the wire, and the law both ends run. The relay imports from here. |
| `src/player/` | The player's body in the world: motor, camera, first-person views, seats. |
| `src/poi/` | Points of interest: the editor's document, its import and export, and the feed the game stands. |
| `src/render/` | The WebGL2 renderer: programs, passes, meshes, textures, sky. |
| `src/scenes/` | The four hosts (`world.js`, `worldModes.js`, `dungeonContext.js`, `exterior.js`), loose, and the modules they wire (`*Host.js` - `Host-Split.md`). |
| `src/systems/` | Game law that is not combat or online: items, quests, guilds, travel, time, saving, sound. |
| `src/tools/` | The labs' code: the modules the root `*.html` lab pages load, and two they share. |
| `src/ui/` | Every window, menu and HUD element, classic and Enhanced. |
| `src/world/` | The world's assembly: terrain, blocks, locations, dungeons, buildings, water, the world's set pieces. |
| `src/assets/` | Source art the code imports (meshes, textures and their `source/` originals). Not mapped further. |

### Where is a feature?

A feature lives in a folder of its own name in each layer it has three or more modules in - its law in
`src/systems/`, what both ends run online in `src/net/`, its models in `src/world/`, its windows in `src/ui/`, its
wiring in `src/scenes/`. A feature with one or two modules in a layer keeps them loose there; grep the name.

| Feature | Its folders under `src/` |
|---|---|
| Abyss Dungeon (super dungeons) | `systems/superDungeon/`, `net/superDungeon/`, `world/superDungeon/`, `render/superDungeon/`, `scenes/superDungeon/`, `ui/superDungeon/` |
| Arena | `systems/arena/`, `net/arena/`, `world/arena/`, `scenes/arena/`, `ui/arena/` |
| Automap | `systems/automap/`, `ui/automap/` |
| Blood | `combat/blood/` |
| Bounty board | `systems/bounty/`, `ui/bounty/` |
| Card table (Hold'em) | `systems/card/`, `net/card/`, `world/card/`, `ui/card/` |
| Cities | `world/city/` |
| Climbing | `player/climb/` |
| Combat techniques | `combat/technique/` |
| Come Sail Away (boats) | `systems/comeSailAway/`, `scenes/comeSailAway/` |
| Deep Waters | `systems/deepWater/`, `world/deepWater/`, `scenes/deepWater/` |
| Diverse Weapons | `combat/diverseWeapons/` |
| Duels | `net/duel/` |
| Dungeons | `systems/dungeon/`, `world/dungeon/` |
| Dynamic Skies | `systems/dynamicSkies/` |
| Elite Gates (the Elite Breach) | `systems/eliteGates/`, `net/eliteGates/`, `world/eliteGates/`, `render/eliteGates/`, `scenes/eliteGates/`, `ui/eliteGates/` |
| Enemies | `characters/enemy/` |
| Enhanced Plus | `ui/plus/` |
| Enhanced skin | `ui/enhanced/` |
| Eye Of The Beholder | `player/eyeOfTheBeholder/` |
| Factions | `systems/faction/` |
| Festival (the Witches' Festival, a live event) | `systems/festival/` - and loose: `net/festivalLaw.js`, `scenes/witchesHost.js`, `world/witchesDecor.js`, `world/festivalArt.js`, `ui/wyrdDoor.js`, `ui/wyrdWindow.js`, `ui/profileIcons.js` |
| Firmament | `net/firmament/` |
| First-person weapon | `combat/weapon/` |
| Foraging | `systems/foraging/` |
| Grammar (translations) | `systems/grammar/` |
| Guilds | `systems/guild/`, `net/guild/` |
| Guns | `combat/gun/` |
| Home decorating | `systems/decor/`, `scenes/decor/` |
| Horses | `systems/horse/` |
| HUD (classic) | `ui/hud/` |
| Iliac Hand | `systems/iliac/`, `net/iliac/` |
| Ink maps | `ui/ink/` |
| Interiors | `world/interior/` |
| Intro | `ui/intro/` |
| Items | `systems/item/`, `ui/item/` |
| King's Gambit | `systems/gambit/`, `net/gambit/` |
| Level up | `ui/levelUp/` |
| Living world | `systems/livingWorld/`, `scenes/livingWorld/` |
| Loot | `systems/loot/` |
| Map | `systems/map/`, `ui/map/` |
| Menu | `ui/menu/` |
| Merchant yards | `world/merchantYards/` |
| Merchants | `ui/merchant/` |
| Mobile units | `characters/mobile/` |
| Morrowind formats | `formats/morrowind/` |
| Music | `systems/song/` |
| Native windows (classic) | `ui/native/` |
| Naval (ships and the sea) | `systems/naval/`, `scenes/naval/`, `ui/naval/` |
| Navmesh | `ai/nav/` |
| Oblivion Gate (world boss) | `systems/gate/`, `net/gate/`, `world/gate/`, `render/gate/`, `scenes/gate/`, `ui/gate/` |
| Online save | `systems/online/` |
| Other players | `net/peer/` |
| Own 3D models | `characters/ownModels/` |
| Paperdoll | `characters/paperdoll/`, `tools/paperdoll/` |
| Party | `systems/party/` |
| Points of interest | `ui/poi/` |
| Professions | `systems/professions/`, `ui/professions/` |
| Project Legacy | `systems/legacy/`, `ui/legacy/` |
| Quests | `systems/quest/`, `scenes/quest/`, `ui/quest/` |
| Raids | `net/raid/` |
| Realm | `net/realm/` |
| Regions | `systems/region/` |
| Resting | `systems/rest/` |
| Revenant | `systems/revenant/`, `ui/revenant/` |
| Rewrite Engine rig | `characters/rewrite/` |
| Roads | `world/road/` |
| Roleplay Realism | `systems/roleplayRealism/` |
| Roleplay Realism: Items | `systems/roleplayRealismItems/` |
| Saves | `systems/save/`, `formats/save/` |
| Sea serpent (world boss) | `systems/serpent/`, `net/serpent/` |
| Settings | `systems/settings/`, `ui/settings/` |
| Ships (models) | `world/ships/` |
| Sieges | `net/siege/` |
| Sigil Sets | `systems/sigil/` |
| Starfall (the Witches' Festival's fallen stars) | `systems/starfall/`, `net/starfall/`, `world/starfall/`, `render/starfall/`, `scenes/starfall/`, `ui/starfall/` |
| Spells | `systems/spell/`, `ui/spell/` |
| Studio art (the artists' folder) | `systems/studioArt/` |
| Survival | `systems/survival/` |
| Talk | `systems/talk/` |
| Tamriel (the continent) | `world/tamriel/` |
| Terrain | `world/terrain/` |
| Touch controls | `ui/touch/` |
| Towns | `systems/town/`, `ui/town/` |
| Travel | `systems/travel/`, `ui/travel/` |
| Underwater | `world/underwater/` |
| Unity bundles | `formats/unity/` |
| Upkeep (horse care, wagon wear) | `systems/upkeep/` |
| UV editing | `poi/uv/` |
| Vanilla Enhanced | `systems/vanillaEnhanced/` |
| Vendors | `ui/vendor/` |
| Voxel pieces | `characters/pieces/` |
| Wagons | `systems/wagon/`, `scenes/wagon/` |
| Water | `world/water/` |
| Weather | `systems/weather/` |
| Wind | `systems/wind/` |
| World of Daggerfall | `world/worldOfDaggerfall/` |
| WorldData | `formats/worldData/` |
| Wrothgarian zone (open PvP) | `systems/wild/`, `net/wild/`, `ui/wild/` |

### The feature folders, layer by layer

#### `src/ai/`

| Folder | What lives there |
|---|---|
| `src/ai/nav/` | The navmesh: its bake, worker and client. |

#### `src/characters/`

| Folder | What lives there |
|---|---|
| `src/characters/bodyMotion/` | The Morrowind body's own motion in third person (`04-Characters/Body-Motion.md`): the body measured, the gait, the carry, the blows, the solve, one per rig. |
| `src/characters/enemy/` | Enemies: entity, motor, attacks, casting, sounds. |
| `src/characters/mobile/` | DFU's mobile units: types, persons, factions. |
| `src/characters/ownModels/` | The port's own 3D models: heads, armour, clothing, weapons. |
| `src/characters/paperdoll/` | The paperdoll. |
| `src/characters/pieces/` | The voxel pieces a character is built from (heads, bodies, armour, weapons). |
| `src/characters/rewrite/` | project-final's Rewrite Engine rig, vendored byte for byte (`test/characters/rig.test.js`). |

#### `src/combat/`

| Folder | What lives there |
|---|---|
| `src/combat/blood/` | Blood: bleeding, decals, gibs, marks. |
| `src/combat/diverseWeapons/` | The Diverse Weapons mod. |
| `src/combat/gun/` | Guns. |
| `src/combat/technique/` | Combat techniques. |
| `src/combat/twoHands/` | Two hands (`05-Combat/Two-Hands.md`): the hands' law, the mirrored rig, both hands seen and animated. |
| `src/combat/weapon/` | The first-person weapon: rig, alignment, the widget. |

#### `src/formats/`

| Folder | What lives there |
|---|---|
| `src/formats/morrowind/` | Morrowind's formats: NIF, ESM, BSA, DDS, the body. |
| `src/formats/save/` | Saving and loading. |
| `src/formats/unity/` | Unity asset bundles, for the mods that ship them. |
| `src/formats/worldData/` | DFU's WorldData JSON and its patches. |

#### `src/net/`

| Folder | What lives there |
|---|---|
| `src/net/arena/` | The Arena: bouts, the ladder, the league (`11-Multiplayer/Arena.md`) - online - the law both ends run. |
| `src/net/card/` | The tavern's card table: Hold'em and the regulars (`11-Multiplayer/Tavern-Cards.md`) - online - the law both ends run. |
| `src/net/duel/` | Duels between players - online - the law both ends run. |
| `src/net/eliteGates/` | The Elite Breach, the Battlespire's torn halls (`11-Multiplayer/Elite-Gates.md`, `Elite-Gates-Look.md`, `Elite-Gates-Ascent.md`) - online - the law both ends run: the director and the halls' law, the spans and the fragments, the legion, the lords and the run, the route and its proofs, the pay and the receipts. |
| `src/net/firmament/` | The Firmament (`06-Systems/Firmament.md`) - online - the law both ends run. |
| `src/net/gambit/` | The King's Gambit (`11-Multiplayer/Kings-Gambit.md`) - online - the law both ends run. |
| `src/net/gate/` | The Oblivion Gate, the world boss on the shared clock (`11-Multiplayer/World-Bosses.md`) - online - the law both ends run. |
| `src/net/guild/` | The guilds online: the guild book, the guild law and powers, the vault's law - the law both ends run. |
| `src/net/iliac/` | Iliac Hand, the tavern's other card game - online - the law both ends run. |
| `src/net/peer/` | Other players: their bodies, riders, effects and pace - online - the law both ends run. |
| `src/net/raid/` | Town raids - online - the law both ends run. |
| `src/net/realm/` | The realm's gold, trade and save codec - online - the law both ends run. |
| `src/net/safety/` | The chat's safety: the relay's stamp on a line, its feed to the reviewer, a report's law and the code of conduct (`11-Multiplayer/Chat-Safety-Arc.md`) - online - the law both ends run. |
| `src/net/serpent/` | The sea serpent, the sea's world boss (`11-Multiplayer/Sea-Serpent.md`) - online - the law both ends run. |
| `src/net/siege/` | Sieges of a seat - online - the law both ends run. |
| `src/net/starfall/` | The Starfall, the Witches' Festival's fallen stars (`11-Multiplayer/Starfall.md`) - online - the law both ends run: the night and its stars, the defense's ledger, the receipt. |
| `src/net/superDungeon/` | The Abyss Dungeon, the super dungeons (`11-Multiplayer/Super-Dungeons-Look.md`) - online - the law both ends run. |
| `src/net/wild/` | The Wrothgarian open zone (`11-Multiplayer/Wild-Zone.md`) - online - the law both ends run. |

#### `src/player/`

| Folder | What lives there |
|---|---|
| `src/player/climb/` | Climbing: its feel, pose and sounds. |
| `src/player/eyeOfTheBeholder/` | The Eye Of The Beholder mod: the billboard body. |

#### `src/poi/`

| Folder | What lives there |
|---|---|
| `src/poi/uv/` | The POI editor's UV editing. |

#### `src/render/`

| Folder | What lives there |
|---|---|
| `src/render/eliteGates/` | The Elite Breach (`11-Multiplayer/Elite-Gates.md`, `Elite-Gates-Look.md`, `Elite-Gates-Ascent.md`) - its passes: the sky, the mist, the motes, the lines, the lamps and the stairs. |
| `src/render/gate/` | The Oblivion Gate, the world boss on the shared clock (`11-Multiplayer/World-Bosses.md`) - its passes. |
| `src/render/starfall/` | The Starfall (`11-Multiplayer/Starfall.md`) - its sky: the omen, the fall, the landing and the beacon. |
| `src/render/superDungeon/` | The Abyss Dungeon, the super dungeons (`11-Multiplayer/Super-Dungeons-Look.md`) - its passes. |

#### `src/scenes/`

| Folder | What lives there |
|---|---|
| `src/scenes/arena/` | The Arena: bouts, the ladder, the league (`11-Multiplayer/Arena.md`) - the hosts' wiring. |
| `src/scenes/comeSailAway/` | Come Sail Away's boats (`03-World/Come-Sail-Away.md`) - the hosts' wiring. |
| `src/scenes/decor/` | Decorating a home in the hosts: the base, the room, the tool. |
| `src/scenes/deepWater/` | Deep Waters in the hosts: the host, swimming, the player, the fish, encounters, decor and loot. |
| `src/scenes/eliteGates/` | The Elite Breach (`11-Multiplayer/Elite-Gates.md`, `Elite-Gates-Look.md`, `Elite-Gates-Ascent.md`) - the hosts' wiring: the client, the call and the arch, the fight, the spans, the circle's host and its swap, the look drawn. |
| `src/scenes/gate/` | The Oblivion Gate, the world boss on the shared clock (`11-Multiplayer/World-Bosses.md`) - the hosts' wiring. |
| `src/scenes/livingWorld/` | The living world in the hosts (`06-Systems/Living-World-II.md`): indoors, the roads, the watch, the deep's remains. |
| `src/scenes/naval/` | Ships and the sea in the hosts: the naval host, the crew, the flames. |
| `src/scenes/quest/` | Quests - the hosts' wiring. |
| `src/scenes/starfall/` | The Starfall (`11-Multiplayer/Starfall.md`) - the hosts' wiring: the stars on a screen, their defense on the camp law, and a held star's rewards. |
| `src/scenes/superDungeon/` | The Abyss Dungeon, the super dungeons (`11-Multiplayer/Super-Dungeons-Look.md`) - the hosts' wiring. |
| `src/scenes/wagon/` | Wagons in the hosts (`06-Systems/Wagons.md`): the riders and the warden. |

#### `src/systems/`

| Folder | What lives there |
|---|---|
| `src/systems/arena/` | The Arena's law (`11-Multiplayer/Arena.md`): the bout, its fighters and moves, the ladder and the league, the board and score, the herald, the crowd and the replay. |
| `src/systems/automap/` | The automap's law: the model, its floors, and what a click picks. |
| `src/systems/bounty/` | The bounty board's law: the board, the journal and the reward. |
| `src/systems/card/` | The card table's law (`11-Multiplayer/Tavern-Cards.md`): the regulars, the session at a table, a remote table, where the cards come from. |
| `src/systems/comeSailAway/` | Come Sail Away's boats: the boat itself, its hulls, models, items and waves, the helm's actions, the map, the wire's words and the boat's menu (`03-World/Come-Sail-Away.md`). |
| `src/systems/decor/` | Decorating a home: the catalogue, placing, the rooms - the law. |
| `src/systems/deepWater/` | Deep Waters' law: the swimmer, the fish as items and as rows. |
| `src/systems/dungeon/` | A dungeon's state: its respawn, tier, echo and sense. |
| `src/systems/dynamicSkies/` | The Dynamic Skies mod - the law. |
| `src/systems/eliteGates/` | The Elite Breach's law on this screen (`11-Multiplayer/Elite-Gates.md`, `Elite-Gates-Look.md`, `Elite-Gates-Ascent.md`): the Weir Key and its find, the Spire's kit and Vestiges, the lords' arms, the spoils, the score and its mix and echo. |
| `src/systems/enemyExpansion/` | Daggerfall Enemy Expansion (Kamer & Kab), the mod's own (`04-Characters/Enemy-Expansion.md`): its CSV reading, its tables and art index as generated text, the tables read as BestiaryMod reads them, its pictures on the texture door, its encounter tables as it picks them, its equipment as its copy of RRI's class arm reads a class (`dexEquipment.js`), and its install - the fifty enemies on DFU's custom-enemy doors. |
| `src/systems/faction/` | The factions' relations, reputation and standing - the law. |
| `src/systems/festival/` | The Witches' Festival on this screen (`06-Systems/Witches-Festival.md`): the Soul Cakes and the Hearth Offering, the finds, the Wyrd Sister's sales, the wearing, the offerings' moves and every word. |
| `src/systems/foraging/` | The Foraging mod - the law. |
| `src/systems/gambit/` | The King's Gambit (`11-Multiplayer/Kings-Gambit.md`) - the law. |
| `src/systems/gate/` | The Oblivion Gate's law (`11-Multiplayer/World-Bosses.md`): the site, the omen, the score and the spoils. |
| `src/systems/grammar/` | Language grammar for the translations (`06-Systems/Localization-Arc.md`). |
| `src/systems/guild/` | The guilds' law: their factions and variants, services and how a service flows, the hall's reveal. |
| `src/systems/horse/` | The horse and cart, the horses' coats, a horse that follows - the law. |
| `src/systems/iliac/` | Iliac Hand, the tavern's other card game - the law. |
| `src/systems/item/` | Items: templates, the item law, ids, kinds, fields, powers, binding, locks, the lists a character holds, dye, junk and transfer. |
| `src/systems/legacy/` | Project Legacy: age, family, heirs, the realm line (`06-Systems/Legacy-Arc.md`). |
| `src/systems/livingWorld/` | The living world: its people, towns, caravans, outlaws and trips (`06-Systems/Living-World-II.md`). |
| `src/systems/loot/` | Loot: its tables, powers, rarity, curses, the codex - the law. |
| `src/systems/map/` | The map's tabs, directory and waypoints. |
| `src/systems/naval/` | Ships and the sea: naval combat, crews, ship life, harbours, trade goods. |
| `src/systems/online/` | The online save: checkpoints, homes, the lane, the sync - the law. |
| `src/systems/party/` | A party: travelling, resting and walking together - the law. |
| `src/systems/professions/` | The professions' law (`06-Systems/Professions-Arc.md`): their items, templates and sounds. |
| `src/systems/quest/` | The quest machine: the parser, its tables, actions and conditions. |
| `src/systems/questlines/` | The questlines over the quest machine (`06-Systems/Questlines-Arc.md`): the objective sheets and branch patches by family, the actions, the rewards, the acts feed and the elite foe's act (`qlEliteFoe.js`, which the dungeon host hands its place - AUDIT QUESTLINES ACTS-8), the questlines, their runner and the guilds' ladders - the law. |
| `src/systems/region/` | A region's conditions, hubs and power - the law. |
| `src/systems/rest/` | Resting: the rest window, its supplies and its warning - the law. |
| `src/systems/revenant/` | The Revenant: the feud, its companions (their kit, their errands abroad, their stars), its art, personality, voice, trophy and fate. |
| `src/systems/roleplayRealism/` | The Roleplay Realism mod - the law. |
| `src/systems/roleplayRealismItems/` | The Roleplay Realism: Items mod - the law. |
| `src/systems/save/` | Saving and loading - the law. |
| `src/systems/serpent/` | The sea serpent, the sea's world boss (`11-Multiplayer/Sea-Serpent.md`) - the law. |
| `src/systems/settings/` | The settings: the store, its defaults and its words. |
| `src/systems/sigil/` | Sigil Sets (`11-Multiplayer/Sigil-Sets.md`) - the law. |
| `src/systems/song/` | Music: the songs, their player and manager - the law. |
| `src/systems/spell/` | Spells: effects, the spell maker, power and the impact's sound. |
| `src/systems/starfall/` | The Starfall (`11-Multiplayer/Starfall.md`) - the law: the covens and the night's coven, the night's stars over the gate's scan, the Witches' Night; the coven's waves, masters and circles, the star's law on a player's screen, every word it says and its sounds; Starfall Glass and a held star's spoils. |
| `src/systems/studioArt/` | The studio (`07-Rendering/Studio-Art.md`): the game's artists' own pictures (`public/art/studio/`) on the texture door, and the slots they paint. |
| `src/systems/superDungeon/` | The Abyss Dungeon's law (`11-Multiplayer/Super-Dungeons-Look.md`): the site, the omen, the score, the spoils, the rift's sound and the slots kept on the device. |
| `src/systems/survival/` | Survival: needs, camping, food, rest, exposure. |
| `src/systems/talk/` | Talking to people: topics, sessions, macros - the law. |
| `src/systems/town/` | A town's population, seats and watch. |
| `src/systems/travel/` | Travel's law: the trip, routes and paths, pace, the autopilot, ports, far places and the dungeons on the way. |
| `src/systems/upkeep/` | Upkeep: a horse's care and a wagon's wear (`06-Systems/Horse-Care.md`, `06-Systems/Wagon-Upkeep.md`) - the law. |
| `src/systems/vanillaEnhanced/` | The Vanilla Enhanced texture pack (`Port-Doctrine.md`, its exception) - the law. |
| `src/systems/wagon/` | Wagons: kinds, looks, seats, ropes, the town watch (`06-Systems/Wagons.md`) - the law. |
| `src/systems/weather/` | Weather: fronts, the field, the sim, the map - the law. |
| `src/systems/wild/` | The Wrothgarian open zone's law (`11-Multiplayer/Wild-Zone.md`): the zone, its dungeons and giants, the cart, the drop, death and the waypoint home. |
| `src/systems/wind/` | Wind, its drive and its sound - the law. |

#### `src/tools/`

| Folder | What lives there |
|---|---|
| `src/tools/enhanced/` | The Enhanced skin's labs: the UI, the menu, the character generator and the visuals (`enhanced.html`, `menu.html`, `chargen.html`). |
| `src/tools/paperdoll/` | The paperdoll viewer (`viewer.html`) and its skin. |

#### `src/ui/`

| Folder | What lives there |
|---|---|
| `src/ui/arena/` | The Arena's windows: the door, the window, the HUD and the session button. |
| `src/ui/automap/` | The automap's window: the sheet, its camera, chrome, markers and words, and its door. |
| `src/ui/bounty/` | The bounty board's window, its door and its mark on the map. |
| `src/ui/card/` | The card table's HUD, its panel kit and the binder's page. |
| `src/ui/eliteGates/` | The Elite Breach on screen (`11-Multiplayer/Elite-Gates.md`, `Elite-Gates-Look.md`, `Elite-Gates-Ascent.md`): the start window, the boards, the HUD and the party, the beats, the arch's map mark, the access settings. |
| `src/ui/enhanced/` | The Enhanced skin's windows and HUD - its windows. |
| `src/ui/gate/` | The Oblivion Gate on screen: the banner, the boss bar, the damage chart, the ground view, the marks and the title card. |
| `src/ui/growth/` | The pause window's Growth tab (`10-UI/Growth.md`): its rail and landings, the specialisations' guide, and the stage that draws the Firmament, the captain's stars and the Ascension in its pane. |
| `src/ui/hud/` | The classic HUD: vitals, compass, crosshair, active spells - its windows. |
| `src/ui/ink/` | The ink maps: town, dungeon, automap - its windows. |
| `src/ui/intro/` | The intro: its screen, map, landscape and cue - its windows. |
| `src/ui/item/` | Items on screen: the icons, the item maker and the scroller. |
| `src/ui/legacy/` | Project Legacy: heirs and the realm line (`06-Systems/Legacy-Arc.md`) - its windows. |
| `src/ui/levelUp/` | Levelling up: the notice, the view - its windows. |
| `src/ui/map/` | The map's scale, skin and strip. |
| `src/ui/menu/` | The menu's glyphs, pad and pictures - its windows. |
| `src/ui/merchant/` | A merchant's repair and service windows - its windows. |
| `src/ui/native/` | The classic native windows: inventory, talk, trade, panel - its windows. |
| `src/ui/naval/` | Ships on screen: the naval HUD, plunder and the yard's window. |
| `src/ui/plus/` | Enhanced Plus: the pad, its binds, the cursor - its windows. |
| `src/ui/poi/` | Points of interest: the editor's panels - its windows. |
| `src/ui/professions/` | The professions on screen: the HUD, the reticle, the pages and their styles. |
| `src/ui/quest/` | Quests - its windows. |
| `src/ui/questlines/` | The Quests tab's questline parts: objectives, rewards waiting, a questline's and a ladder's page (`06-Systems/Questlines-Arc.md` section 6). |
| `src/ui/revenant/` | The Revenant on screen: its card, its page and its fate. |
| `src/ui/settings/` | The settings window's law, its map of rows and its copy. |
| `src/ui/spell/` | Spells on screen: the icons, the icon picker and the spell maker's window. |
| `src/ui/starfall/` | The Starfall on screen: a fallen star's tracker, the master's bar and the star's colours. |
| `src/ui/superDungeon/` | The Abyss Dungeon on screen: the title card, the Remnant's bar, the marks and the map mark. |
| `src/ui/touch/` | The touch layer: buttons, gestures, look - its windows. |
| `src/ui/town/` | A town on screen: its sheet, its quarters, its marks and the door to its map. |
| `src/ui/travel/` | Travel's windows: the travel map, its options, paths and junctions, pace, the pop-up and the HUD. |
| `src/ui/vendor/` | A vendor's page, tab and map mark - its windows. |
| `src/ui/wild/` | The open zone on screen: its map, ink and marks. |

#### `src/world/`

| Folder | What lives there |
|---|---|
| `src/world/arena/` | The Arena's place: the city, the floor, the undercroft, the plaques and the model. |
| `src/world/card/` | The card table in the world: the tables, the scene, the regulars, a hand and its motion. |
| `src/world/city/` | A city's gates, lights and navigation - its models and assembly. |
| `src/world/deepWater/` | Deep Waters in the world: the sea floor and its bathymetry, the surface, swimming, the look and the bake. |
| `src/world/dungeon/` | A dungeon's build: its layout, lights, textures, fires, label and end. |
| `src/world/eliteGates/` | The Elite Breach in the world (`11-Multiplayer/Elite-Gates.md`, `Elite-Gates-Look.md`, `Elite-Gates-Ascent.md`): the halls, the ground, the ruin, the vista and the underside, the platforms, the rooms, the kit and its art, the air and the lamps - its models and assembly. |
| `src/world/gate/` | The Oblivion Gate in the world: the arena, the art, the boss, the model, the clearance and the spew. |
| `src/world/interior/` | Interiors: layout, lights, glass - its models and assembly. |
| `src/world/jungle/` | Bantha's jungle (`03-World/Bantha-Jungle.md`): where it is (the owner's area, `banthaArea.js`, and its field), the owner's trees and their measures, and its haze's law. |
| `src/world/merchantYards/` | A town's Stable and Wagon Yard (`03-World/Merchant-Yards.md`) - its models and assembly. |
| `src/world/road/` | Roads: the network, its painter, verges and clearance - its models and assembly. |
| `src/world/ships/` | The port's own ships: the galleon, the carrack, the large boat - its models and assembly. |
| `src/world/starfall/` | The Starfall in the world: the star's art, its crater and stone, and Starfall Glass's picture. |
| `src/world/superDungeon/` | The Abyss Dungeon in the world: the halls, the steps, the rift, the realm and its sky, the Remnant, and their art. |
| `src/world/tamriel/` | The continent's ground: geography, frame, raster - its models and assembly. |
| `src/world/terrain/` | Terrain generation, its worker and sampler - its models and assembly. |
| `src/world/underwater/` | Under the water: its look, decorations, enemies and loot - its models and assembly. |
| `src/world/water/` | The water's bed, corners and ripples - its models and assembly. |
| `src/world/worldOfDaggerfall/` | The World of Daggerfall mod: the entry (`worldOfDaggerfall.js`), its locations' data, loader, pack and objects, Privateer's Hold, the spawner. |

### The tests, `test/`

TIDY5 filed the suite as the code is filed: a test goes in the folder of the layer whose code it tests most - what it
imports, three to one over what it reads - and, where that layer has the feature's folder, in the same folder there.
`test/systems/arena/` holds the arena's law tests beside `src/systems/arena/`; `test/net/arena/` its wire's. Five
folders are not a layer of `src/`:

| Folder | What lives there |
|---|---|
| `test/server/` | The relay's and the account Worker's own tests (`server/`, `server-account/`, their migrations). |
| `test/tooling/` | The tools, the scripts, the desktop shell and CI's workflows: the move tool (`tidy1_movetool.test.js`; the tree it left, `tidy1_codemap.test.js`), the shards, the release, the installers. |
| `test/bible/` | The bible's own laws: `manifest.test.js` (unique test names, and Testing.md's closed file table, LEGIBLE 1b), `audit18_bible_docs.test.js` (the docs' cites, counts and index), and the D1-NEAR record's pins. The other gates CLAUDE.md names run from the folder of what they read: `test/tooling/` (citeanchor, mutantdrift), `test/scenes/` (citedrift), `test/systems/` (ledger). |
| `test/tree/` | Laws over the whole tree: every module loads, no temporal dead zone, the shaders evaluate. |
| `test/fixtures/` | Data the tests read. Not tests. |

The shared helpers stay at the root - `test/*.mjs` (`importGraph.mjs`, `fakeRoom.mjs`, `bibleIndex.mjs`, ...) and
`test/modsOff.js` - one import away from every folder. A file's NAME is unique across the tree
(`test/bible/manifest.test.js` holds it): the bible names a test by its file name alone, so a mention does not move
with its test; `tools/testTimes.json` and the bible's paths spell its folder, and the move tool rewrites them.

**A new test** goes in the folder of what it tests, by the same rule as a new module (below): its layer, then its
feature's folder if the layer has one. Every list of tests - `npm test`, a CI shard, `test:changed`, the manifest, the
mutation tables - walks `test/` recursively, so a new folder needs nothing registered.

## Where a new file goes

1. **By layer first.** Law that both ends run goes in `src/net/`; drawing goes in `src/render/`; a window goes in
   `src/ui/`; game law goes in `src/systems/` (or `src/combat/`, `src/ai/`). The layer is what the relay's and the
   account Worker's bundles depend on: they import law and never UI, so a feature's law and its window live apart
   on purpose.
2. **Then by feature.** A feature with three or more modules in one layer gets a folder in that layer, named for
   the feature in camelCase (`src/systems/comeSailAway/`, `src/systems/livingWorld/`). Its fourth module goes in the
   folder, not beside it.
3. **Loose is for shared things.** A file left loose in a layer is either used across features or one of a
   feature's first two modules.
   Two folders older than this map hold fewer than three: `src/systems/grammar/` (a language's grammar - French
   alone so far) and `src/tools/paperdoll/` (a lab and its skin).
4. **A new folder takes its row** in its layer's table ("The feature folders, layer by layer") in the same change. The
   test fails until it does.
5. **A new record** - an audit, a field-bugs pass, a hand-off - goes in its kind's folder under `01-Overview/`
   (`audits/Audit-X.md`, `bugs/Field-Bugs-<date>.md`, `handoffs/`), and the index names it by that path.
   `test/bible/audit18_bible_docs.test.js` finds a record by its name in any of them, so a name is one page.

## How a file moves

`node tools/moveModule.mjs <destination> <file>...` (or `--plan moves.json` for many at once) moves files with
`git mv` and rewrites every address of them: the relative imports to and from them (`from`, `import()`, `require`,
`createRequire`, `require.resolve`, `import.meta.resolve`, `new URL(..., import.meta.url)`), the paths the tests read
(`rd('src/systems/x.js')`), an import a pin quotes from another file (`'../systems/x.js'`), either path escaped for a
pattern (`src\/systems\/x\.js`), a root path after a host (`http://localhost:5241/src/...`), the bible's paths and
cites, the mutation lists' `file` and the source their records quote, the workflows' `paths:`, the parity scripts.
A file that moves to another depth keeps its roots: its own folder (`dirname(fileURLToPath(import.meta.url))`, its
`path.` and `.pathname` forms, `import.meta.dirname`), a folder URL (`'../'`), a root concatenated into a URL
(`new URL('../' + p, ...)`), a template's folder, an `import.meta.glob` pattern's folder. `--dry-run` says what it
would change. The rules:

- **A move changes the directory, never the name.** The bible's cites by file name alone (CITE-ANCHOR's basename form) keep
  resolving, and `git log --follow` keeps the history.
- **One feature a change.** A move is reviewable when it is one cluster; the diff is mechanical and should read as
  such.
- **Read the BLIND lines.** What the tool cannot rewrite, it names; read each one and fix it by hand, or confirm it
  needs nothing:
  - a sweep that does not recurse (`readdirSync('src/systems')`): it stops seeing a file that leaves and passes on
    what is left - make it recurse. A sweep behind a helper or a constant (`jsIn('src/net')`) the tool cannot see: grep
    for `readdirSync` over the old directory too (AUDIT TIDY found five);
  - a negative pin quoting a spelling its moved subject no longer has (`!src.includes("from './x.js'")`): it passes on
    anything - spell it at any depth, `from '(?:\.\.?\/)+(?:[\w-]+\/)*x\.js'`;
  - a quoted `./x.js` outside the folder `x.js` moved to, or one the files a pin names spell two ways;
  - an import or a URL built from a template into the old folder (`import(`../systems/${name}.js`)`), and a URL
    built from a variable (`new URL(p, import.meta.url)` behind a `read('../src/x.js')`) - the paths its callers
    hand it are spelled from where it stood;
  - a path that named nothing where its file stood, in a folder that stands: a gone file a negative pin names
    (`!existsSync(new URL('../src/ui/gone.js', ...))`) is re-based by hand, a fixture's text is left;
  - a glob a move empties: a workflow's `paths:` (`src/ui/intro*.js` lost the intro modules to `src/ui/intro/`), an
    `import.meta.glob` in a module that stays;
  - a file that finds the tree from its own folder and moved up, or reads `import.meta.dirname` with no `join` to
    raise it.
- **What it does not follow, the gate does.** `tidy1_codemap.test.js` looks for every gone path as a word in every
  text the tool writes - a link to a file on GitHub (`.../blob/main/src/x.js`) is one such form - and every relative
  import and glob in the code must resolve.
- **It refuses** a renamed file, two moves to one place or of one file, a re-based import that names nothing
  (BROKEN), and a `--fixup` over an old path that is tracked again beside the file it moved to (REVIVED: a merge kept
  both).
- **A move does not touch the relay on its own.** The relay's version is the bytes of its bundle
  (`test/net/relayversion.test.js`): a moved file in it, a re-based import, even a path in one of its comments is a new
  `RELAY_VERSION`, forty-odd pins moved, and a deploy on merge that drops every connected player. The tool prints a
  RELAY line for each such file and refuses to write unless told `--relay`. A cluster that touches the relay waits
  for a slice that bumps the version anyway, and rides it. (The relay's bundle names files in 28 of `src/systems/`'s 49
  folders, so most clusters do.) The account Worker is not like this: it holds no sockets, its deploy restarts
  nothing a player is on, and the tool rewrites its deploy filter's `paths:` with everything else.
- **After a merge of main**, a branch written before a move still names the old paths: `node tools/moveModule.mjs
  --fixup` rewrites each to where the ledger (`tools/moveLedger.json`) says the file went.
- **The gates run as for any change** (CLAUDE.md, "Before a push").

## The plan

Proposed as six steps, one pull request each. Mac: *"Do everything"* - and the steps that touch the relay became one
change, because each would have been its own `RELAY_VERSION` and its own deploy that drops every connected player:
one bump (world211 - world209 on the branch, renumbered past main's at the merge) for all of them is one reconnect, not five.

| Step | What | Status |
|---|---|---|
| TIDY1 | This map, its test, the move tool, and the pilot: Come Sail Away's ten modules (`comeSailAway*` and `csaBoatMenu.js`) into `src/systems/comeSailAway/` - a cluster the relay's bundle does not touch. | Done |
| TIDY2 | Every layer of `src/` into feature folders - what was proposed as TIDY2, TIDY2b, TIDY3 and TIDY4 - 762 modules into 134 folders, each a feature's three or more modules in one layer (the tables above). First every test that swept a `src/` folder without recursing was made to recurse, and the module counts count the folders. The relay's files moved under one `RELAY_VERSION`, world211. | Done |
| TIDY5 | `test/`: the 3,242 test files (3,234, and the 8 main added before the merge) out of one folder into the layers' and the features' folders (`### The tests`, above). Every list of tests walks `test/` recursively; the manifest keys a file by its name, and holds the names unique. | Done |
| TIDY6 | `01-Overview/`'s dated records apart from its overview pages - 265 at the time: `audits/` (149), `bugs/` (108), `handoffs/` (8). The overview pages are 13: this map, the doctrine, the ledger and the host split among them, and Home.md's three index pages (`Page-Index.md`, `Active-Arcs.md`, `Audit-Log.md` - AUDIT TIDY DOC-11 put the log back beside the other two). The root's lab pages stay where they are: GitHub Pages serves each at its path (`/sky.html`), with no redirects, and the labs are deployed to be opened on a phone - moving them would break every link to one. | Done |

**Layer first, then feature** - the question the plan left open, settled by doing it. The arena's code spans five
layers (16 modules in `src/systems/`, 6 in `src/net/`, 5 in `src/world/`, 3 in `src/scenes/`, 4 in `src/ui/`). A
feature-first tree (`src/features/arena/` holding all of them) puts a feature in one place, but the bundles that
must never pull UI in (the relay, the account Worker) would then need a rule inside every feature folder instead of
one at the layer. Layer first is what the tree already did (`src/systems/naval/`, `src/systems/quest/`), and the
tool makes a later change of mind cheap.
