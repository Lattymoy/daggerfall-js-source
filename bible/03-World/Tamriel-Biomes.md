# Tamriel's biomes - each province its own country, and its own wild (TESA-BIOME, 2026-10-24)

**The owner's call (2026-10-24): "Each region recieves its own biome. Cyrodil receives the unique jungle biome we
developed. Every biome must be lore accurate and have lore accurate fauna attached. As detailed as possible."** And
after it: "Lets do a comprehenaive audit and ensure this is perfect" - AUDIT TESA-BIOME
(`01-Overview/audits/Audit-Tesa-Biome.md`), whose findings this page now states; the owner's two calls in it are
the Nibenay Valley's grassland ringed by the jungle, and Colovia's jungle with the Gold Coast deciduous.

TAMRIEL2 laid each province past the Bay on one of Daggerfall's climates (`world/tamriel/tamrielGeography.js`
PROVINCES `climate`): all of Skyrim Mountain, all of Elsweyr Desert2, Cyrodiil Woodlands, Black Marsh Swamp. The wild
took its foes from DFU's climate tables (`systems/encounters.js` CLIMATE_TABLE), and Swamp, MountainWoods and
Woodlands share one family there, so Black Marsh and Morrowind rolled High Rock's orcs, centaurs and wereboars.

TESA-BIOME splits every province into the zones its lore names - forty-three, three to nine a province
(`world/tamriel/tamrielBiomes.js`) - gives each zone its own ground, air and jungle, and gives each its own fauna
(`systems/tamrielFauna.js`): three encounter tables a zone, read off a roster of what the lore sets there. Cyrodiil is
the Bantha jungle's (`03-World/Bantha-Jungle.md`): the Pocket Guide's ring of rain forest round the Nibenay Valley's
grassland, the Colovian uplands and Blackwood stand the jungle's four storeys under its haze.

Scope: DFO is its own game (Port-Doctrine, Scope - SCOPE1). Daggerfall shows none of these provinces; the lore is the
reference, and every choice that departs from it is named below (Recorded choices).

## The era, and the sources

Daggerfall stands in 3E 405. No source describes these provinces in that year. The **Pocket Guide to the Empire, first
edition** - a booklet in the manual of *Redguard* (1998), dated in the world 2E 864, some 440 years earlier - was
written in Daggerfall's own years, and is the nearest the series came then to describing the provinces' country. The
later games (Morrowind 3E 427, Oblivion 3E 433, Skyrim 4E 201) and ESO (2E 582) name the plants and the beasts it does
not. Where they disagree, this table follows the Pocket Guide's country and the games' beasts, and says so. UESP's own
summaries are quoted as UESP's, never as a book's. The Sources section, below, names each province's.

## Where a zone is (`world/tamriel/tamrielBiomes.js`)

- **The province** is the land's (`tamrielLand.js` provinceKeyBeyondBay - the player's own trace once it lands, the
  authored rings before it or with `?tamrieltrace=off`). A zone never crosses its province's border.
- **The seeds stand on the land in use** (`standSeeds`). A zone's SEEDS are the lore's places - its cities (by name,
  `tamrielGeography.js` CITIES) and the hearts of its regions (picture points). A seed off its province's land - the
  trace's coasts are not the rings' - moves onto the nearest of it within `SEED_SNAP` (18 picture units); one with none
  that near is left out. The seeds are stood again whenever the land moves.
- **A city's own ground** (`CITY_GROUND`, 1.5 units): within it of a stood city a point is that city's zone, before the
  peaks and the wander. A region's heart that stands within it of another zone's city gives way (on the freeware
  trace, the Alik'r's western heart stood on Gilane's shore).
- **The peaks, by range.** A zone that names its ranges (`peaks: ['Red Mountain']`) takes every point they lift past
  `PEAKS_LIFT` (0.62 of the snowline - `tamrielGeography.js` rangeLiftBy, the height law's own band); a province's
  `peaks: true` zone takes the lift of the rest. So Red Mountain is its own zone and never the Velothi's snow; the
  Jerall, the Throat of the World, the Velothi, the Wrothgarians, the Dragontail and Eton Nir are their provinces'
  peaks; the Colovian Highlands (gain 0.6) and the Tenmar Hills (0.4) never reach the line. A peaks zone with seeds is
  a country of its own besides (Wrothgar; the Jerall's Bruma).
- **The zone** is the one whose stood seed is nearest the point - moved first by two octaves of value noise
  (`BIOME_WANDER`: cells of 9 and 3 units, 2.4 and 0.7 units of wander, each axis its own), so a border bends through
  the land as a coast or a river would and never runs as a straight bisector.
- Pure and deterministic, read by the terrain worker (world/ and formats/ alone - TAMRIEL2-WORKER). A Bay pixel reads
  its zone at its centre, cached (`BIOME_CACHE_MAX` 262,144 pixels, dropped whole past it); the cache is the land's
  and the fit's, and `biomeStamp` moves when either does - the fit by its numbers, so a fit installed again the same
  moves nothing. What keeps zones of its own keys them by that stamp: the jungle's field (`scenes/jungleHost.js`), the
  air's tiles (`systems/weather/airGround.js` `version`), and the roads' regions (`tamrielRoads.js` inputsPrint carries
  `BIOMES_VERSION`, so a region cached under an older law is built again).

**The ground** past the Bay is the zone's climate (`tamrielGround.js` tamrielClimateAt): its textures, its nature
flats, the countryside's and the lairs' rates (TESA7, TESA8 - the Bay's own count of each kind on that climate), the
weather's table at the player's pixel, and the weather map's field past the Bay's edge (`systems/weather/weatherMap.js`
climateOfField reads a land climate there, the edge's own at sea). Two zones meet as the Bay's climates do - **the
ecotone** blends across their border (`scenes/world.js` climates3x3 reads a neighbour past the Bay through
`tamrielGround.js` climateNeighbourIn, where it read none). **The air** is the zone's `air` climate where the lore's air
is not its ground's (`tamrielGround.js` groundAirClimateIndex, the air law's map - `systems/weather/airGround.js`):
Morrowind's grey volcanic ground reads Mountain and its air the warm south's, because Morrowind's climate is "mild,
though often hot" and "mostly free from snow and ice" (UESP, Lore:Morrowind - its summary, not a book's). Its snow is
the Velothi's.

**Snow.** On the enhanced lane (the default - `weatherSim.js` precipLawOn) snow lies where the air law makes it fall
(`snowCoverHost.js`, `systems/weather/snowpack.js`), so Morrowind's warm air keeps its ash country snowless below its
own height, and the Velothi wear it. On the classic lane (`?biomeprecip=off`) the ground wears DFU's winter set on the
calendar, every climate but a Desert's (`climateSwaps.js` groundIsSnowy) - past the Bay as on the Bay, where DFU's own
swamps and rain forests wear it (Bantha-Jungle, "Winter, as DFU's rainforest").

## The zones

| Province | Zone (`key`) | Climate | Air | Jungle | Seeds | The lore |
|---|---|---|---|---|---|---|
| Skyrim | the Frozen Coast (`skyrimFrozenCoast`) | Mountain | - | - | Dawnstar, Winterhold, 168,20, 196,22 | the Pale's and Winterhold's shore on the Sea of Ghosts - snowfields, tundra and drift ice |
| Skyrim | the Tundra Plains (`skyrimTundra`) | MountainWoods | - | - | Whiterun, Windhelm, Morthal, 172,46 | Whiterun's plains, Hjaalmarch's marsh about Morthal and Eastmarch's hot springs about Windhelm - tundra grass, stone and lichen |
| Skyrim | the Pinewoods (`skyrimPinewood`) | MountainWoods | - | - | Falkreath, Riften, Solitude, 180,58 | Haafingar's Karth forest under Solitude's cliffs, Falkreath's pine and the Rift's aspens |
| Skyrim | the Reach (`skyrimReach`) | Mountain | - | - | Markarth, 127,36 | Markarth's crags on the High Rock border - karst, gorges, the Reachmen and their hagravens |
| Skyrim | the High Peaks (`skyrimPeaks`) | Mountain | - | - | the peaks | the Throat of the World, the Druadach, the Jerall's north face and the Velothi's west - snow the year round |
| High Rock | the Wrothgarian Mountains (`highRockWrothgar`) | Mountain | - | - | the peaks; 108,44, 112,36 | Wrothgar, where Gortwog raises Orsinium again in Daggerfall's day - snowfields, granite, Orc holds, the dragonlings of its crags |
| High Rock | Bangkorai (`highRockBangkorai`) | MountainWoods | - | - | Evermore, 98,60 | Evermore's march on the passes to Hammerfell - pine and scrub over red canyons |
| High Rock | the Rivenspire Moors (`highRockRivenspire`) | HauntedWoodlands | - | - | Shornhelm, Farrun, Jehanna | Shornhelm's bleak uplands over the Sea of Ghosts - peat moor and wind-bent trees, a country of old houses and their dead |
| High Rock | the Northpoint Coast (`highRockNorthpoint`) | Woodlands | - | - | Northpoint, 50,40, 56,46 | Northpoint's shore on the open western ocean - oak and beech over green turf, the Bay's own kind of country |
| Hammerfell | the Alik'r Desert (`hammerfellAlikr`) | Desert | - | - | Skaven, 76,96, 96,100, 62,102 | the Alik'r - dunes and sandstorms over the Yokudan tombs |
| Hammerfell | Craglorn (`hammerfellCraglorn`) | Desert2 | - | - | Dragonstar, Elinhir, 116,78 | Dragonstar's and Elinhir's red mesas and canyons toward Skyrim and Cyrodiil - Dwemer ruins and Nedic tombs |
| Hammerfell | the Abecean Coast (`hammerfellCoast`) | Subtropical | - | - | Taneth, Gilane, Rihad, Hegathe | Taneth, Rihad, Gilane and Hegathe on the Abecean Sea - palms and white beaches |
| Hammerfell | the Dragontail Mountains (`hammerfellDragontail`) | Mountain | - | - | the peaks | the Dragontail's spine over the desert, snow on its crowns |
| Sumurset Isle | the Vine Coast (`summersetVineCoast`) | Subtropical | - | - | Alinor, Dusk, Sunhold, Lillandril, Shimmerene, Cloudrest | Alinor's coasts: vineyards, golden meadows, the gold and crimson groves |
| Sumurset Isle | Auridon (`summersetAuridon`) | Woodlands | - | - | Firsthold, Skywatch | the sister isle, more forest than vine |
| Sumurset Isle | Eton Nir (`summersetEtonNir`) | Mountain | - | - | the peaks | Eton Nir, the isle's highest peak - snow on its summit alone |
| Valenwood | Grahtwood (`valenwoodGrahtwood`) | Rainforest | - | - | Falinesti, Elden Root, 128,150 | Falinesti's and Elden Root's country - the graht-oaks that hold cities, lianas, little light on the floor |
| Valenwood | Malabal Tor (`valenwoodMalabal`) | Rainforest | - | - | Silvenar, 108,132, 120,128 | the deep northern canopy about Silvenar: the densest forest, its rivers, its Wood Orcs |
| Valenwood | Greenshade (`valenwoodGreenshade`) | Swamp | - | - | Woodhearth, Southpoint, Haven, 84,146 | the western and southern coasts - Woodhearth, Haven and Southpoint among the mangrove swamps |
| Valenwood | Reaper's March (`valenwoodReapersMarch`) | Subtropical | - | - | Arenthia, 142,140 | Arenthia's march on the border with Elsweyr, the forest giving way to plains |
| Elsweyr | the Anequina Badlands (`elsweyrAnequina`) | Desert2 | - | - | Riverhold, Dune, 150,140 | Riverhold's and Dune's canyons - red clay, mesas and cracked hardpan |
| Elsweyr | the Anequina Plains (`elsweyrPlains`) | Subtropical | - | - | Rimmen, Orcrest, 180,142 | Rimmen's and Orcrest's steppes - the north's dry savanna |
| Elsweyr | the Pellitine Coast (`elsweyrPellitine`) | Subtropical | - | - | Torval, Senchal, 170,172 | Torval's and Senchal's shore on Topal Bay - white beaches, saltrice and sugar |
| Elsweyr | the Tenmar Forest (`elsweyrTenmar`) | Rainforest | - | - | Corinthe, 166,162, 172,158 | the Tenmar between Torval and Senchal - jungle, moon-sugar cane growing wild, senche-tigers |
| Black Marsh | the Hist Swamps (`blackMarshHist`) | Swamp | - | - | Helstrom, Blackrose, 246,136 | the interior: black peat, standing water, the Hist in their groves |
| Black Marsh | the Shadowfen (`blackMarshFens`) | Swamp | - | - | Stormhold, Thorn, 264,112 | Stormhold's and Thorn's north - raised bog and reed beds toward Morrowind |
| Black Marsh | Murkmire (`blackMarshMurkmire`) | Rainforest | - | - | Lilmoth, Soulrest, Archon, 264,148 | the southern and eastern coasts - Lilmoth, Soulrest and Archon in swamp-jungle and mangrove |
| Black Marsh | Blackwood (`blackMarshGloomire`) | Swamp | - | yes | Gideon, 222,140 | Gideon's flooded hillscape - Blackwood across the border from Leyawiin, the jungle under its canopy |
| Morrowind | the Ashlands (`morrowindAshlands`) | Mountain | Desert2 | - | Ald'ruhn, 246,34, 242,40 | Ald'ruhn's grey country about Red Mountain - ash, pumice and basalt under the ash storms |
| Morrowind | Red Mountain (`morrowindRedMountain`) | Mountain | Desert2 | - | Red Mountain's peaks | the volcano at Vvardenfell's heart - ash and blighted rock, never snow |
| Morrowind | the Ascadian Isles (`morrowindAscadian`) | Woodlands | Subtropical | - | Vivec, 258,46 | Vivec's farmlands, lakes and woods on the Inner Sea |
| Morrowind | the Bitter Coast (`morrowindBitterCoast`) | Swamp | Subtropical | - | 240,46, 245,50 | Vvardenfell's south-west shore - swamp, mangrove and smugglers' coves |
| Morrowind | Stonefalls (`morrowindStonefalls`) | Mountain | Desert2 | - | Ebonheart, 236,70 | Ebonheart's and Kragenmoor's mainland coast across from Vvardenfell - lava fields and ash |
| Morrowind | Deshaan (`morrowindDeshaan`) | MountainWoods | Subtropical | - | Mournhold, Tear, 268,80 | Mournhold's and Tear's lowlands - fungal valleys and plantations, warm and wet |
| Morrowind | the Telvanni Peninsula (`morrowindTelvanni`) | MountainWoods | Subtropical | - | Necrom, 288,40 | the peninsula to Necrom on the Padomaic coast - giant mushrooms, the wizards' towers |
| Morrowind | the Velothi Foothills (`morrowindVelothiFoot`) | Mountain | Subtropical | - | Blacklight, 212,48 | Blacklight's country under the range: grey and red rock, scree, scrub |
| Morrowind | the Velothi Mountains (`morrowindVelothi`) | Mountain | - | - | the peaks | the wall against Skyrim and Cyrodiil - Morrowind's snow is here alone |
| Imperial Province | the Nibenay Valley (`cyrodiilNibenayValley`) | Woodlands | - | - | Imperial City | the grassland at the centre, round Lake Rumare and the Imperial City |
| Imperial Province | the Nibenay Jungle (`cyrodiilNibenay`) | Rainforest | - | yes | Cheydinhal, Bravil, 168,98, 180,86, 192,98, 188,108, 172,106 | the equatorial rain forest enclosing the valley - the Great Forest, Cheydinhal's and Bravil's country |
| Imperial Province | Blackwood (`cyrodiilBlackwood`) | Swamp | - | yes | Leyawiin, 192,130, 204,126 | Leyawiin's country on Topal Bay - flooded forest and mangrove under the canopy |
| Imperial Province | the Colovian Jungle (`cyrodiilColovia`) | Rainforest | - | yes | Chorrol, Skingrad, 136,96, 150,96 | Chorrol's and Skingrad's uplands, the jungle climbing the Colovian Highlands |
| Imperial Province | the Gold Coast (`cyrodiilGoldCoast`) | Woodlands | - | - | Anvil, Kvatch, 136,110 | Anvil and Kvatch: the deciduous forest and mangroves, becoming sparser towards the ocean |
| Imperial Province | the Jerall Highlands (`cyrodiilJerall`) | MountainWoods | - | - | the peaks; Bruma, 196,78, 150,80 | Bruma's cloud forest under the Jerall and the Valus - the province's snow |

## Cyrodiil's jungle

The Pocket Guide (2E 864): Cyrodiil "is the largest region of the continent, and most is endless jungle". "Its
center, the grassland of the Nibenay Valley, is enclosed by an equatorial rain forest and broken up by rivers."
"Between its western coast and its central valley there are all manner of deciduous forest and mangroves, becoming
sparser towards the ocean."

So the table stands the Pocket Guide's Cyrodiil, as the owner chose it (Recorded choice 1):

- **the Nibenay Valley** (the Imperial City) is the grassland at the centre - Woodlands, not jungle;
- **the Nibenay Jungle** (Cheydinhal, Bravil, and five hearts round the valley) is the rain forest that encloses it;
- **the Colovian Jungle** (Chorrol, Skingrad) climbs the Colovian uplands - the owner's call over the Pocket Guide's
  "deciduous forest" there;
- **Blackwood** is one country on both sides of the border, as ESO's is - Leyawiin's on Topal Bay and Gideon's in Black
  Marsh (`blackMarshGloomire`) - flooded forest and mangrove, the jungle under its canopy, one roster;
- **the Gold Coast** (Anvil, Kvatch) is the Pocket Guide's deciduous forest sparser toward the ocean - Woodlands;
- **the Jerall Highlands** (Bruma) are the province's peaks and its cloud forest - its snow.

**How it stands.** The jungle's field (`world/jungle/jungleRegion.js` jungleField) reads a pixel past the Bay through
`beyond` - its zone's `jungle` - where it read every pixel off the Bay's map as outside. Those pixels' sides and
distances are kept in maps (`JUNGLE_BEYOND_MAX` of each, dropped whole past it and read again - the answers are pure),
each distance the same float32 the Bay's typed arrays keep. Every Bay pixel's distance is as before, to the bit; the
terrain job's 3x3 along the Bay's eastern edge now reads its off-map neighbours' own distances (Bantha's last column, 88
pixels), so the jungle runs to the map's edge where it had faded inside its last pixel (AUDIT TESA-BIOME J). The host
makes its field again when the zones' stamp moves (`scenes/jungleHost.js` `version`). Everything else is Bantha's,
unchanged: the four storeys and their numbers, the floor's carpet, the roadside pairs and the trails, the haze and its
cull, the rainforest's air leaned over the jungle (PRECIP1). Where the jungle meets the valley, the Gold Coast and the
Jerall, its edge is its own ecotone - the stands, the wandering line, the haze drifting out past the last trees.

## The fauna (`systems/tamrielFauna.js`)

**The tables.** DFU picks a wild foe from a table of twenty mobile ids in the order of their level: ChooseRandomEnemy
(RandomEncounters.cs :1471-1507) reads the slots about the player's level. Each zone has DFU's three - the town at
night, the wild by day, the wild by night - at its own indices (`BIOME_TABLE_BASE` 100 and up, three a zone in BIOMES'
order), made from its ROSTER by `faunaTable`:

- a roster entry is a mobile id and its rarity there - C common, U uncommon, R rare, V very rare (one slot at most) -
  and, where it has one, its own classic stand-in (below);
- **no aquatic creature** stands on a land table (`isAquatic`, MobileBehaviour.Aquatic): the Dreugh, the Lamia and the
  Slaughterfish never move on dry ground, and DFU keeps them to its underwater table (19). The walking Land Dreugh is
  Daggerfall Enemy Expansion's;
- slot i is met by players about level i + 1, so it draws, by a hash of the zone and the slot, from the roster's
  monsters within `SLOT_REACH` (4) levels of i + 1 - each weighed by its rarity (`RARITY` C 4, U 2, R 1, V 0.5), over
  one plus half its distance in levels, over one plus the times it stands already - and from the roster's people (class
  enemies, who stand at the player's level) from `CLASS_FROM` (slot 3) up;
- **the window**: no one creature stands more than `WINDOW_MAX` (2) times in any `WINDOW_SLOTS` (6) slots running - a
  roster with one people's class and no strong beast had filled ten high slots with it;
- a slot nothing reaches takes the nearest monster within twice the reach that the window and a used V allow, else the
  nearest a used V does not bar, else the nearest; a person only from `CLASS_FROM`;
- **the cover**: each common and uncommon beast the draw left out takes the nearest slot in its reach whose creature
  stands twice or more - the commons first;
- a creature's level is the game's as it loaded (`faunaLevelIn`): Daggerfall's own, or as Daggerfall Enemy Expansion's
  ClassicMonsterReplacement (and Meaner Monsters beside it) edits it, read off the frozen vanilla table and the mod's own
  read (`enemyExpansion/dexInstall.js` dexClassicRow) - so a table is its roster and the two switches, nothing else;
- the town table is the province's (`TOWN_ROSTERS`): its vermin, its own thieves, its night things.

Every table stays within DFU's own band through the real roll (the pins: no one creature past 42% of a level's
meetings; a level-1 player's monsters of level 9 and up at most 30%).

**Daggerfall Enemy Expansion.** Main carries DEX (`04-Characters/Enemy-Expansion.md`), and its creatures are the lore's
where Daggerfall has none: its Wolf and Snow Wolf, Troll, Goblin, Minotaur (Cyrodiil's own - Morihaus's kin), Mudcrab,
Boar, Mountain Lion, Land Dreugh, Ogre, Will-o'-wisp, Scamp, Blood Spider, Lizard Man and Lizard Warrior, the Dwemer's
Centurion Sphere, its necromancers, riders, druids and witches. While DEX is not loaded each stands as its classic
stand-in or is left out. `STANDIN` gives one only where it reads true - the Mountain Lion as the Sabretooth, the Scamp
as the Imp, the Will-o'-wisp and the Faded Ghost as the Ghost, the Sphere as the Iron Atronach, the riders and witches as
their classes - and none for the Wolf, the Troll, the Ogre, the Goblin, the Minotaur, the Boar, the Dog, the Mudcrab, the
Lizard Men or the Land Dreugh (the classic Dreugh is aquatic). A roster may name its own: Skyrim's wolves stand as the
sabre cat it also hunts, its trolls as its giants. Both variants are made; the selector answers the one the game loaded
(`dexLoaded`, `mudexLoaded`), the same on every machine of a game.

**The door.** One selector on DFU's encounter-table door (`characters/encounterTableDoor.js`) answers the zone indices
(`FAUNA_SELECTOR`, stood once by `installTamrielFauna`). The encounter law's ctx carries the pixel's band as `fauna`
(`faunaBandAt` - null on the Bay and at sea), and `resolveEncounterTableIndex` reads it before the climate's.

**The hosts.** `scenes/world.js` WIRED - the wild's minute roll (IntermittentEnemySpawn) and a camp's group carry the
player's or the camp's pixel's band; a roaming band's make carries it too, latent while no band is born past the Bay;
the online grants' species law (`scenes/grantHost.js` `faunaAt`, `grantDiceRefusal`) reads the grant's zone, and a grant
may name any pixel of the world (`net/grantLaw.js` validGrant - `worldPixelOk`, where it held the Bay's 1000 by 500).
`scenes/exterior.js` FLAGGED - the fixed city stands on the Bay's map alone. `scenes/worldModes.js` FLAGGED - an
interior rolls no wild foe (`encounters.js`: inside, only a dungeon's rest rolls). `scenes/dungeonContext.js` FLAGGED - a
dungeon rolls its type's table, DFU's: a lair past the Bay is a Daggerfall dungeon type (TESA8), and its table is DFU's,
not the zone's (Recorded choice 10).

## The rosters

Each entry is the creature and its rarity (C common, U uncommon, R rare, V very rare - one slot at most); a * marks
Daggerfall Enemy Expansion's (its stand-in, or none, while that mod is not loaded). The tables these make are the
module's `biomeTable` - read them there, they are made, not written.

| Zone | By day | By night |
|---|---|---|
| the Frozen Coast (Skyrim) | Rat C, Snow Wolf* C, Wolf* U, Sabretooth Tiger U, Grizzly Bear U, Mudcrab* U, Troll* U, Giant R, Spriggan R, Ice Atronach V, Barbarian U, Warrior U, Archer R, Ranger R | Giant Bat C, Rat U, Snow Wolf* C, Skeletal Warrior U, Mummy U, Ghost U, Werewolf R, Wraith R, Vampire R, Ice Atronach R, Frost Daedra V, Ancient Lich V, Barbarian U, Nightblade R |
| the Tundra Plains (Skyrim) | Rat C, Wolf* C, Mudcrab* U, Sabretooth Tiger U, Grizzly Bear U, Spider U, Giant U, Spriggan R, Troll* R, Barbarian U, Warrior U, Archer U, Bard R | Giant Bat C, Wolf* C, Skeletal Warrior U, Mummy U, Ghost U, Werewolf U, Wraith R, Vampire R, Lich V, Ancient Lich V, Barbarian U, Nightblade R |
| the Pinewoods (Skyrim) | Rat C, Wolf* C, Grizzly Bear C, Spider U, Sabretooth Tiger U, Spriggan U, Mudcrab* U, Troll* R, Giant R, Archer U, Ranger U, Rogue R, Thief R, Barbarian R | Giant Bat C, Wolf* C, Werewolf U, Skeletal Warrior U, Ghost U, Will-o'-wisp* U, Mummy U, Vampire R, Wraith R, Lich V, Thief U, Assassin R, Nightblade R |
| the Reach (Skyrim) | Rat C, Wolf* C, Sabretooth Tiger U, Grizzly Bear U, Harpy U, Troll* U, Spriggan R, Giant R, Centurion Sphere* V, Barbarian C, Archer U, Ranger U, Witch Defender* R | Giant Bat C, Wolf* C, Harpy U, Skeletal Warrior U, Mummy U, Ghost U, Wraith R, Vampire R, Werewolf R, Lich V, Barbarian U, Witch Defender* R |
| the High Peaks (Skyrim) | Snow Wolf* C, Wolf* U, Troll* U, Sabretooth Tiger U, Rat R, Giant R, Ice Atronach R, Barbarian U, Warrior R, Archer R | Snow Wolf* C, Wolf* U, Rat U, Troll* U, Mummy U, Ghost R, Wraith R, Ice Atronach R, Frost Daedra V, Ancient Lich V, Barbarian R, Nightblade R |
| the Wrothgarian Mountains (High Rock) | Orc C, Orc Sergeant U, Orc Shaman U, Orc Warlord R, Grizzly Bear U, Wolf* U, Snow Wolf* R, Harpy U, Goblin* U, Troll* R, Ogre* R, Dragonling R, Barbarian U, Archer R, Warrior R | Giant Bat C, Wolf* C, Grizzly Bear U, Werewolf U, Orc U, Snow Wolf* R, Ghost R, Wraith R, Vampire R, Troll* R, Dragonling V, Barbarian R, Nightblade R |
| Bangkorai (High Rock) | Rat C, Wolf* C, Grizzly Bear U, Harpy U, Goblin* U, Spriggan R, Orc R, Dragonling V, Knight U, Archer U, Ranger U, Barbarian R, Rogue Rider* R | Giant Bat C, Rat U, Wolf* U, Werewolf U, Skeletal Warrior U, Zombie U, Ghost U, Wraith R, Vampire R, Lich V, Rogue U, Nightblade R |
| the Rivenspire Moors (High Rock) | Rat C, Wolf* C, Grizzly Bear U, Spriggan U, Harpy U, Boar* U, Gargoyle R, Imp R, Dog* R, Dragonling V, Archer U, Rogue U, Knight R, Witch Defender* R, Necromancer Acolyte* R | Giant Bat C, Rat U, Wereboar U, Werewolf U, Zombie U, Skeletal Warrior U, Ghost U, Wraith U, Vampire U, Ghoul* U, Gargoyle R, Ancient Vampire V, Lich V, Nightblade R, Thief U |
| the Northpoint Coast (High Rock) | Rat C, Wolf* U, Boar* U, Grizzly Bear U, Spriggan U, Mudcrab* U, Nymph R, Centaur R, Harpy R, Imp R, Dragonling V, Knight U, Archer U, Ranger U, Druid* R, Spellsword R, Witch Defender* R | Giant Bat C, Rat U, Wereboar U, Werewolf U, Skeletal Warrior U, Zombie U, Ghost U, Wraith R, Vampire R, Will-o'-wisp* R, Lich V, Thief R, Rogue U |
| the Alik'r Desert (Hammerfell) | Rat C, Giant Scorpion C, Sabretooth Tiger U, Harpy U, Giant R, Dragonling R, Warrior C, Barbarian U, Archer U, Spellsword R, Rogue Rider* R, Archer Rider* R | Giant Bat C, Rat U, Giant Scorpion C, Mummy C, Skeletal Warrior U, Skeletal Soldier* U, Ghost U, Wraith R, Vampire R, Fire Atronach V, Rogue U, Assassin R |
| Craglorn (Hammerfell) | Rat C, Giant Scorpion C, Harpy U, Sabretooth Tiger U, Giant U, Ogre* R, Goblin* R, Troll* R, Centurion Sphere* V, Warrior U, Barbarian U, Archer R, Rogue R | Giant Bat C, Rat U, Giant Scorpion U, Mummy U, Skeletal Warrior U, Ghost U, Wraith R, Fire Atronach R, Vampire R, Lich V, Rogue U, Assassin R |
| the Abecean Coast (Hammerfell) | Rat C, Dog* U, Giant Scorpion U, Sabretooth Tiger U, Harpy U, Mudcrab* U, Nymph R, Centaur R, Dragonling R, Warrior U, Rogue U, Thief U, Spellsword R, Bard R | Giant Bat C, Rat U, Skeletal Warrior U, Zombie U, Mummy U, Ghost U, Werewolf R, Wraith R, Vampire R, Thief U, Assassin R |
| the Dragontail Mountains (Hammerfell) | Harpy C, Giant Scorpion U, Sabretooth Tiger U, Giant U, Rat R, Ogre* R, Troll* R, Grizzly Bear R, Barbarian U, Warrior U, Archer R | Giant Bat C, Rat U, Harpy U, Skeletal Warrior U, Ghost U, Wraith R, Vampire R, Fire Atronach V, Barbarian R, Rogue R |
| the Vine Coast (Sumurset Isle) | Rat C, Mudcrab* U, Spider R, Nymph R, Spriggan R, Mage U, Spellsword U, Battlemage U, Knight U, Archer U, Sorcerer R, Healer R, Bard R, Rogue R | Giant Bat C, Rat U, Skeletal Warrior U, Ghost U, Faded Ghost* U, Will-o'-wisp* U, Wraith R, Vampire R, Lich V, Daedra Seducer V, Nightblade R, Sorcerer R |
| Auridon (Sumurset Isle) | Rat C, Spider U, Spriggan U, Mudcrab* U, Nymph R, Mage U, Spellsword U, Archer U, Knight U, Battlemage R, Ranger R | Giant Bat C, Spider U, Skeletal Warrior U, Ghost U, Will-o'-wisp* U, Faded Ghost* U, Wraith R, Vampire R, Lich V, Nightblade R, Thief R |
| Eton Nir (Sumurset Isle) | Rat U, Spider U, Harpy U, Mage U, Battlemage U, Archer R, Sorcerer R | Giant Bat C, Rat U, Ghost U, Skeletal Warrior U, Wraith R, Lich V, Sorcerer R, Nightblade R |
| Grahtwood (Valenwood) | Rat C, Spider C, Blood Spider* U, Spriggan U, Sabretooth Tiger U, Centaur R, Wolf* R, Ogre* R, Archer C, Ranger U, Acrobat U, Thief U, Druid* R, Rogue Druid* R | Giant Bat C, Spider C, Werewolf U, Will-o'-wisp* U, Skeletal Warrior U, Zombie U, Ghost U, Wraith R, Vampire R, Lich V, Nightblade R, Assassin R |
| Malabal Tor (Valenwood) | Rat C, Spider C, Spriggan U, Wolf* U, Sabretooth Tiger U, Grizzly Bear R, Orc R, Ogre* R, Orc Shaman V, Archer U, Ranger U, Thief R, Acrobat R | Giant Bat C, Spider C, Werewolf U, Will-o'-wisp* U, Skeletal Warrior U, Ghost U, Wraith R, Vampire R, Lich V, Nightblade R, Thief R |
| Greenshade (Valenwood) | Rat C, Mudcrab* C, Spider U, Land Dreugh* R, Spriggan R, Sabretooth Tiger R, Archer U, Rogue U, Acrobat U | Giant Bat C, Rat U, Land Dreugh* U, Zombie U, Ghost U, Skeletal Warrior U, Will-o'-wisp* U, Werewolf R, Vampire R, Thief U, Rogue U |
| Reaper's March (Valenwood) | Rat C, Sabretooth Tiger C, Spider U, Centaur R, Archer U, Monk R, Acrobat U, Thief U, Warrior R | Giant Bat C, Sabretooth Tiger U, Werewolf R, Skeletal Warrior U, Zombie U, Ghost U, Wraith R, Vampire R, Thief U, Assassin R |
| the Anequina Badlands (Elsweyr) | Rat C, Giant Scorpion C, Sabretooth Tiger U, Harpy U, Troll* R, Dragonling R, Monk U, Acrobat U, Thief U, Warrior U, Rogue Rider* R, Archer Rider* R | Giant Bat C, Giant Scorpion U, Sabretooth Tiger U, Mummy U, Skeletal Warrior U, Ghost U, Wraith U, Werewolf R, Vampire R, Fire Atronach V, Nightblade R, Assassin R |
| the Anequina Plains (Elsweyr) | Rat C, Sabretooth Tiger C, Spider U, Harpy U, Giant Scorpion R, Warrior U, Archer U, Monk U, Acrobat U, Rogue Rider* R, Archer Rider* R | Giant Bat C, Sabretooth Tiger U, Skeletal Warrior U, Zombie U, Ghost U, Werewolf R, Wraith R, Vampire R, Thief U, Assassin R |
| the Pellitine Coast (Elsweyr) | Rat C, Sabretooth Tiger C, Mudcrab* U, Spider U, Spriggan R, Thief C, Acrobat U, Monk U, Rogue U, Bard R | Giant Bat C, Sabretooth Tiger U, Zombie U, Ghost U, Wraith R, Vampire R, Werewolf R, Thief U, Assassin U |
| the Tenmar Forest (Elsweyr) | Rat C, Sabretooth Tiger C, Spider C, Blood Spider* U, Spriggan U, Monk U, Acrobat U, Archer U, Ranger R | Giant Bat C, Spider C, Sabretooth Tiger U, Will-o'-wisp* U, Zombie U, Ghost U, Werewolf R, Wraith R, Vampire R, Nightblade R, Thief U |
| the Hist Swamps (Black Marsh) | Rat C, Lizard Man* C, Spider U, Mudcrab* U, Lizard Warrior* U, Spriggan R, Giant Scorpion R, Will-o'-wisp* R, Nightblade U, Rogue U, Acrobat U, Assassin R, Healer R | Giant Bat C, Rat U, Zombie C, Skeletal Warrior U, Ghost U, Wraith U, Will-o'-wisp* U, Ghoul* U, Vampire R, Lich V, Nightblade U, Assassin R |
| the Shadowfen (Black Marsh) | Rat C, Spider U, Mudcrab* U, Lizard Man* U, Giant Scorpion R, Lizard Warrior* R, Rogue U, Nightblade R, Archer R, Warrior R | Giant Bat C, Rat U, Zombie C, Skeletal Warrior U, Ghost U, Wraith U, Will-o'-wisp* U, Vampire R, Lich V, Nightblade R, Assassin R |
| Murkmire (Black Marsh) | Rat C, Mudcrab* C, Spider U, Blood Spider* U, Lizard Man* U, Land Dreugh* U, Lizard Warrior* R, Spriggan R, Rogue U, Acrobat U, Nightblade R | Giant Bat C, Rat U, Zombie U, Land Dreugh* U, Ghost U, Will-o'-wisp* U, Wraith R, Vampire R, Nightblade R, Assassin R |
| Blackwood (Black Marsh) | Rat C, Mudcrab* C, Land Dreugh* U, Spider U, Lizard Man* U, Imp U, Spriggan R, Mountain Lion* R, Rogue U, Thief U, Nightblade R, Archer R | Giant Bat C, Rat U, Spider U, Zombie U, Will-o'-wisp* U, Land Dreugh* U, Ghost U, Skeletal Warrior U, Wraith R, Vampire R, Lich V, Thief U, Nightblade R |
| the Ashlands (Morrowind) | Rat C, Scamp* U, Fire Atronach R, Daedroth R, Centurion Sphere* V, Barbarian U, Nightblade U, Battlemage U, Archer U, Monk R, Sorcerer R | Rat C, Scamp* U, Ghost C, Skeletal Warrior U, Mummy R, Zombie R, Wraith R, Daedroth R, Fire Atronach R, Vampire R, Daedra Seducer V, Lich V, Nightblade U, Assassin R |
| Red Mountain (Morrowind) | Rat U, Scamp* U, Daedroth R, Fire Atronach R, Fire Daedra V, Centurion Sphere* V, Barbarian R, Nightblade R, Battlemage R | Ghost C, Rat U, Scamp* U, Skeletal Warrior U, Wraith U, Daedroth R, Fire Atronach R, Vampire R, Ancient Lich V, Nightblade R, Barbarian R |
| the Ascadian Isles (Morrowind) | Rat C, Mudcrab* C, Scamp* R, Nightblade U, Rogue U, Archer U, Healer R, Knight R, Battlemage R | Rat C, Mudcrab* U, Scamp* R, Ghost U, Skeletal Warrior U, Zombie U, Wraith R, Vampire R, Nightblade U, Thief U, Assassin R |
| the Bitter Coast (Morrowind) | Rat C, Mudcrab* C, Scamp* R, Nightblade U, Rogue U, Thief U, Archer R, Healer R, Battlemage R | Rat C, Mudcrab* U, Scamp* R, Ghost C, Skeletal Warrior U, Zombie U, Mummy R, Wraith R, Vampire R, Lich V, Nightblade U, Assassin R |
| Stonefalls (Morrowind) | Rat C, Scamp* U, Mudcrab* U, Daedroth R, Fire Atronach R, Barbarian U, Nightblade U, Battlemage U, Archer U, Knight R | Rat C, Scamp* U, Mudcrab* R, Ghost C, Skeletal Warrior U, Zombie U, Wraith R, Daedroth R, Vampire R, Lich V, Nightblade U, Assassin R |
| Deshaan (Morrowind) | Rat C, Spider U, Blood Spider* U, Mudcrab* U, Scamp* U, Goblin* R, Daedroth R, Nightblade U, Battlemage U, Healer R, Knight R, Assassin R, Sorcerer R | Rat C, Scamp* U, Spider U, Ghost C, Skeletal Warrior U, Zombie U, Mummy R, Wraith R, Vampire R, Daedroth R, Daedra Seducer V, Lich V, Assassin U, Nightblade R |
| the Telvanni Peninsula (Morrowind) | Rat C, Mudcrab* U, Scamp* U, Spider R, Mage U, Sorcerer U, Battlemage U, Nightblade R, Archer R | Rat C, Scamp* U, Mudcrab* R, Ghost U, Skeletal Warrior U, Zombie U, Wraith R, Daedroth R, Vampire R, Lich R, Daedra Seducer V, Sorcerer U, Nightblade R |
| the Velothi Foothills (Morrowind) | Rat C, Goblin* U, Scamp* U, Barbarian U, Archer U, Nightblade R, Warrior R | Rat C, Scamp* U, Goblin* U, Ghost C, Skeletal Warrior U, Mummy R, Wraith R, Vampire R, Nightblade R, Barbarian R |
| the Velothi Mountains (Morrowind) | Goblin* U, Rat R, Wolf* R, Snow Wolf* R, Grizzly Bear R, Troll* R, Barbarian U, Archer U, Warrior R | Goblin* U, Rat U, Scamp* U, Ghost U, Skeletal Warrior U, Wraith U, Troll* R, Snow Wolf* R, Vampire R, Barbarian R, Nightblade R |
| the Nibenay Valley (Imperial Province) | Rat C, Mudcrab* U, Imp U, Wolf* U, Boar* U, Mountain Lion* R, Goblin* R, Grizzly Bear R, Land Dreugh* R, Troll* R, Spriggan R, Rogue U, Thief U, Archer U, Warrior U, Knight U, Bounty Hunter* R, Battlemage R | Giant Bat C, Rat U, Wolf* U, Skeletal Warrior U, Zombie U, Ghost U, Wraith R, Vampire R, Werewolf R, Lich V, Thief U, Nightblade R, Assassin R |
| the Nibenay Jungle (Imperial Province) | Rat C, Imp C, Spider C, Blood Spider* U, Mountain Lion* U, Sabretooth Tiger U, Spriggan U, Minotaur* U, Goblin* U, Boar* U, Mudcrab* U, Land Dreugh* R, Ogre* R, Troll* R, Centaur R, Rogue U, Thief U, Archer U, Warrior U, Bounty Hunter* R, Necromancer Acolyte* R, Knight R, Battlemage R | Giant Bat C, Spider C, Mountain Lion* U, Will-o'-wisp* U, Skeletal Warrior U, Zombie U, Ghost U, Wraith U, Vampire U, Lich R, Werewolf R, Daedroth V, Nightblade R, Necromancer Glaivier* R, Assassin R |
| Blackwood (Imperial Province) | Rat C, Mudcrab* C, Land Dreugh* U, Spider U, Lizard Man* U, Imp U, Spriggan R, Mountain Lion* R, Rogue U, Thief U, Nightblade R, Archer R | Giant Bat C, Rat U, Spider U, Zombie U, Will-o'-wisp* U, Land Dreugh* U, Ghost U, Skeletal Warrior U, Wraith R, Vampire R, Lich V, Thief U, Nightblade R |
| the Colovian Jungle (Imperial Province) | Rat C, Mountain Lion* C, Imp U, Wolf* U, Grizzly Bear U, Boar* U, Spider U, Spriggan U, Goblin* U, Minotaur* R, Ogre* R, Troll* R, Rogue U, Archer U, Warrior U, Knight R, Bounty Hunter* R, Necromancer Acolyte* R | Giant Bat C, Wolf* C, Mountain Lion* U, Skeletal Warrior U, Zombie U, Ghost U, Wraith U, Vampire U, Lich R, Werewolf R, Will-o'-wisp* R, Nightblade R, Necromancer Glaivier* R |
| the Gold Coast (Imperial Province) | Rat C, Mountain Lion* C, Mudcrab* C, Imp U, Boar* U, Wolf* U, Land Dreugh* U, Spriggan R, Goblin* R, Minotaur* R, Rogue U, Thief U, Archer U, Warrior U, Bard R, Knight R | Giant Bat C, Wolf* U, Mountain Lion* U, Skeletal Warrior U, Zombie U, Ghost U, Wraith R, Vampire R, Land Dreugh* R, Lich V, Thief U, Nightblade R |
| the Jerall Highlands (Imperial Province) | Wolf* C, Snow Wolf* U, Mountain Lion* U, Grizzly Bear U, Troll* U, Goblin* U, Rat R, Ogre* R, Minotaur* R, Imp R, Spriggan R, Barbarian U, Archer U, Rogue R | Giant Bat C, Rat U, Wolf* C, Troll* U, Snow Wolf* U, Skeletal Warrior U, Ghost U, Wraith U, Vampire R, Werewolf R, Lich V, Frost Daedra V, Barbarian R, Rogue R |

| Province | The town at night |
|---|---|
| Skyrim | Rat C, Dog* U, Giant Bat U, Thief U, Burglar U, Barbarian U, Ghost R, Werewolf R, Vampire R, Nightblade R |
| High Rock | Rat C, Dog* U, Giant Bat U, Thief U, Burglar U, Rogue U, Wereboar R, Ghost R, Vampire R, Assassin R |
| Hammerfell | Rat C, Dog* U, Giant Bat U, Thief U, Rogue U, Burglar R, Ghost R, Vampire R, Assassin R |
| Sumurset Isle | Rat C, Giant Bat U, Thief R, Burglar R, Mage U, Nightblade R, Ghost R, Vampire R |
| Valenwood | Rat C, Giant Bat U, Thief U, Acrobat U, Burglar U, Werewolf R, Ghost R, Vampire R |
| Elsweyr | Rat C, Giant Bat U, Thief C, Acrobat U, Burglar U, Assassin R, Ghost R, Vampire R |
| Black Marsh | Rat C, Giant Bat U, Thief U, Nightblade U, Assassin R, Zombie R, Ghost R, Vampire R |
| Morrowind | Rat C, Scamp* U, Thief U, Nightblade U, Assassin U, Ghost R, Vampire R |
| Imperial Province | Rat C, Dog* U, Giant Bat U, Thief U, Burglar U, Rogue U, Vampire R, Ghost R, Assassin R |

## Sources

The country of each zone, and the creatures its roster stands. "UESP" is UESP's own summary of a province's lore, not a
book. Daggerfall's creatures stand in every province it draws them in (its climates' tables); the list names where the
lore sets one past that.

- **Skyrim.** Country: TES V's holds (the Pale, Winterhold, Haafingar's Karth forest, Whiterun, Hjaalmarch, Eastmarch,
  Falkreath, the Rift, the Reach); "the wet climate produces thick, verdant pine forests" is UESP's of Falkreath Hold.
  Beasts: TES V (wolves, snow wolves, sabre cats, bears, mudcrabs, trolls, giants, spriggans, frost atronachs, hagravens
  - the Reach's harpies stand for them); ESO's Reach and Eastmarch (Dwemer spheres, rare).
- **High Rock.** Country: ESO's Wrothgar, Bangkorai, Rivenspire and the Northpoint coast; Daggerfall's own Wrothgarian
  Mountains and Gortwog's Orsinium. Beasts: Daggerfall's (orcs, harpies, centaurs, nymphs, wereboars, gargoyles,
  dragonlings - its mountain, woodland and desert tables stand them), ESO's (goblins, ogres, trolls
  in Wrothgar; Rivenspire's ghouls and witches).
- **Hammerfell.** Country: the Pocket Guide (the Alik'r, the Dragontail, its coasts); UESP's "coasts are especially vibrant
  with plantlife"; ESO's Craglorn. Beasts: Daggerfall's Hammerfell (giant scorpions, harpies, mummies, and the dragonlings its
  desert tables stand), ESO's Craglorn (ogres, goblins, trolls, Dwemer spheres).
- **Sumurset Isle.** Country: the Pocket Guide, UESP's of Alinor ("rows of vineyards" - ESO's 2E 582 Alinor), ESO's Auridon
  and Eton Nir. Beasts: few - the isle's wild is tame (spriggans, nymphs, spiders, mudcrabs); its people mages and
  battlemages; its night the old houses' dead.
- **Valenwood.** Country: the Pocket Guide and TES III's dialogue ("coasts... dominated by mangrove swamps", "temperate
  inland rain forests"), ESO's Grahtwood, Malabal Tor, Greenshade and Reaper's March. Beasts: sabre cats (senche), spiders
  and blood spiders, spriggans, the Wood Orcs of Malabal Tor, wolves, ogres; the Green Pact's archers and druids.
- **Elsweyr.** Country: the Pocket Guide (Anequina's dry north, Pellitine's fertile south), ESO's Anequina, Rimmen and the
  Tenmar between Torval and Senchal. Beasts: sabre cats, giant scorpions, harpies, dragonlings (Elsweyr's dragons are
  ESO's; the dragonling is Daggerfall's own), trolls in the badlands; its riders.
- **Black Marsh.** Country: the Pocket Guide, ESO's Shadowfen, Murkmire and Blackwood. Beasts: Arena's lizard men (DEX's
  art), mudcrabs, land dreugh, spiders, will-o'-wisps; its undead nights.
- **Morrowind.** Country: TES III's Vvardenfell (the Ashlands, Red Mountain, the Ascadian Isles, the Bitter Coast) and
  ESO's mainland (Stonefalls, Deshaan, the Telvanni Peninsula). Beasts: scamps, daedroths, fire atronachs (Red Mountain's
  daedric ruins), Dwemer spheres (rare), mudcrabs; no bears, big cats, wolves or spiders on Vvardenfell (TES III); the
  Velothi's goblins, trolls and snow wolves.
- **Cyrodiil.** Country: the Pocket Guide (above). Beasts: TES IV's (imps, mountain lions, wolves, bears, boars, goblins,
  minotaurs, trolls, ogres, land dreugh, mudcrabs, will-o'-wisps, spriggans) and Arena's and Daggerfall's (centaurs,
  sabre cats in the jungle); its necromancers and bounty hunters.

## Creatures the lore names that no model stands

Morrowind's wild is mostly beasts no art stands yet - guar, netch, kagouti, alit, nix-hounds, cliff racers, shalk,
kwama, scribs; Black Marsh's crocodiles, wamasu and hackwings; Skyrim's mammoths, horkers, chaurus and ice wraiths;
the camel and the jackal of the deserts; Summerset's gryphons and indriks; the echatere of Wrothgar; the critters every
province has (deer, elk, goats, foxes, hares). Each roster stands the lore's creatures that DO have art, and none of
these is faked by a stand-in that reads wrong (no Harpy for a cliff racer, no Rat for a guar). They are the next art.

## Recorded choices

1. **Cyrodiil, jungle in 3E 405 - a named departure.** The jungle is the Pocket Guide's 2E 864 Cyrodiil and the Ayleids'
   Cyrod. The lore's own later accounts make Septim-era Cyrodiil temperate: UESP's Lore:Cyrodiil has Tiber Septim reshape
   it at the onset of his reign, "and after that Cyrodiil was known to have remained temperate"; Lady Cinnabar's
   *Subtropical Cyrodiil: A Speculation* has the White-Gold Tower suit the climate to its rulers, and Men brought a
   cooler one. The owner chose the jungle (2026-10-24); the audit's two calls (2026-10-24) keep the Pocket Guide's
   grassland at the centre and its deciduous Gold Coast, and Colovia's uplands jungle. ESO's Dawnwood is a jungle the
   Recollection's rituals grew, not a natural one, and is not cited for it.
2. **Hammerfell's jungles** near Lainlyn and the rainforest of Tigonus are the Bay's own, Bantha's; past the Bay
   Hammerfell is the Alik'r, Craglorn, the Abecean coast and the Dragontail.
3. **Morrowind** is before the Red Year and the Nerevarine: ash storms in the Ashlands, no blight past the Ghostfence, no
   horses, and no bears, big cats, wolves or spiders on Vvardenfell; the Giant Bat is not its night's (its rats and
   scamps are), and Red Mountain is its own zone, never snow.
4. **Black Marsh** stands no Orc, Centaur or Wereboar (its old share of the Woodlands' tables); its Lizard Men are Arena's
   monsters and DEX's art - the wild tribes, not the Argonian people.
5. **Elsweyr** is split as the lore splits it - Anequina's badlands and plains, the Pellitine coast, the Tenmar jungle
   between Torval and Senchal - where it was all Desert2. The Khajiit's furstocks are people; the senche-cats of the wild
   are the Sabretooth.
6. **Summerset's** "tropical" (Lady Cinnabar) and "warm, temperate" (ESO) both fit DF's Subtropical on the Vine Coast;
   Auridon is its forest, Woodlands.
7. **Arena's** ground palette (Temperate, Mountain, Desert) is its engine's limit, not the lore's, and is not copied.
8. **Dragons and dragonlings.** Dragons are gone in this era (they return in 4E 201): no table stands one. The
   Dragonling is not a dragon - Daggerfall stands it, and it lives on the Wrothgarian crags and in the dry south's wilds
   (Wrothgar, Bangkorai, Rivenspire and Northpoint very rare; the Alik'r, the Abecean coast and the Anequina badlands rare).
9. **The Dwemer's constructs** are their ruins' guardians, not the open country's: the Sphere stands very rare in the Reach,
   Craglorn, the Ashlands and on Red Mountain, where the ruins are; the Steam Centurion and the golems stand in no wild.
10. **A lair past the Bay rolls DFU's dungeon tables** (its Daggerfall dungeon type - TESA8): an Orc stronghold's orcs, a
    dragon's den's dragonling, a coven's witches, wherever it stands. The zone's tables are the open country's.
11. **The Reach's harpies** stand for its hagravens (no art); Skyrim's other zones have none. "The Forsworn" are the Reach's
    later name - its people here are the Reachmen.
12. **The Mummy** keeps its Daggerfall nights in the deserts, Skyrim's barrows and Morrowind's ancestral tombs, and
    stands in none of Black Marsh's.

## Pins

`test/world/tesabiome_biomes.test.js` (12) - the zones split every province, forty-three, each a land climate; on the
authored rings every city in its own zone and every zone holding land; Cyrodiil's valley ringed by its jungle, Colovia and
Blackwood jungle, the Gold Coast deciduous; the peaks by range, Red Mountain its own, the Colovian Highlands and the Tenmar
Hills never; a city's own ground, and a heart that gives way to another zone's city (a synthetic trace that makes it);
the wander on both axes, golden, the border off the seeds' bisectors; the seeds stood on the land in use (a synthetic
trace); a pixel's zone at its centre, the Bay's own none, the cache and the stamp with the land and the fit's numbers,
the cache's cap and key; the ground's climate and the air's; the air's kept tiles and the roads' print following the
zones; the jungle field past the Bay - the Bay's own to the bit, the far distances float32, a capped field's answers pure
- and the host's field made again when the stamp moves; with ARENA2, on the player's own trace every zone holding land
and every city's stood place in its own zone.
`test/systems/tesabiome_fauna.test.js` (13) - every zone a roster and every province a town, every creature one the game
can stand (no dragon, no horse, no aquatic); DEX_LEVELS the vendored file's; the table law (twenty slots, the reach where
any reaches, the people's slot, a V once, the window, the cover); every table within DFU's band through the real roll; a
creature's level as the game loaded it; a table golden in either variant; the classic stand-ins; the slot law and its
fallbacks (a used V barred, the commons covered first); the lore; the band at a pixel and the law's read of it; the
selector on the door, stood once; the online grants' reader and set by zone, a grant past the Bay valid; the world host's
wiring. Moved with it: `test/net/grant1_law.test.js`, `test/systems/ecotone1.test.js`,
`test/systems/weather/weather3a_weathermap.test.js`, `test/world/tamriel3.test.js`, `test/tesa7_country.test.js`.
Mutants: `tools/mutants/tesabiome.json` - 83, all dead.
