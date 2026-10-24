# Tamriel's biomes - each province its own country, and its own wild (TESA-BIOME, 2026-10-24)

**The owner's call (2026-10-24): "Each region recieves its own biome. Cyrodil receives the unique jungle biome we
developed. Every biome must be lore accurate and have lore accurate fauna attached. As detailed as possible."**

TAMRIEL2 laid each province past the Bay on one of Daggerfall's climates (`world/tamriel/tamrielGeography.js`
PROVINCES `climate`): all of Skyrim Mountain, all of Elsweyr Desert2, Cyrodiil Woodlands, Black Marsh Swamp. The wild
took its foes from DFU's climate tables (`systems/encounters.js` CLIMATE_TABLE), and Swamp, MountainWoods and
Woodlands share one family there, so Black Marsh and Morrowind rolled High Rock's orcs, centaurs and wereboars.

TESA-BIOME splits every province into the zones its lore names (`world/tamriel/tamrielBiomes.js`), gives each zone
its own ground, air and jungle, and gives each its own fauna (`systems/tamrielFauna.js`) - three encounter tables a
biome, read off a roster of what the lore sets there. Cyrodiil is the Bantha jungle's (`03-World/Bantha-Jungle.md`):
its Nibenay, its Colovian uplands and Blackwood stand the jungle's four storeys under its haze.

Scope: DFO is its own game (Port-Doctrine, Scope - SCOPE1). Daggerfall shows none of these provinces; the lore of
Daggerfall's day is the reference, the later games where it is silent, and every choice is named below.

## The era, and the sources

Daggerfall stands in 3E 405. The **Pocket Guide to the Empire, first edition** (2E 864, shipped with Arena) is the
lore of the provinces closest to that day, and where it describes a province's country this table follows it. The
later games (Morrowind 3E 427, Oblivion 3E 433, Skyrim 4E 201, ESO 2E 582) name the plants and the beasts the Pocket
Guide does not; where they contradict the early lore, the early lore stands and the contradiction is recorded
(Recorded choices, below). Dragons are gone in this era (they return in 4E 201): no table stands one.

## Where a zone is (`world/tamriel/tamrielBiomes.js`)

- **The province** is the land's (`tamrielLand.js` provinceKeyBeyondBay - the player's trace where it is loaded, the
  authored rings else). A zone never crosses its province's border.
- **The zone** is the one whose SEEDS stand nearest - picture units (15.36 km each), the lore's own places: a
  province's cities (`tamrielGeography.js` CITIES) and the hearts of its regions. The point is first moved by two
  octaves of value noise (`BIOME_WANDER`: cells of 9 and 3 units, 2.4 and 0.7 units of wander) so a border between two
  zones bends through the land as a coast or a river would, and never runs as a straight bisector.
- **The peaks.** A province's peaks zone takes every point a mountain range lifts past `PEAKS_LIFT` (0.62 of the
  snowline - `tamrielGeography.js` rangeLift, the height law's own band). The Jerall, the Throat of the World, the
  Velothi, the Wrothgarians, the Dragontail and Eton Nir have peaks zones; the Colovian Highlands (gain 0.6) and the
  Tenmar Hills (0.4) never reach the line - they are their zones' own uplands. A peaks zone with seeds is a country of
  its own besides (Wrothgar; the Jerall's Bruma).
- Pure and deterministic, read by the terrain worker (world/ and formats/ alone - TAMRIEL2-WORKER), cached a pixel
  and dropped whenever the land's trace or the fit moves.

**The ground** past the Bay is the zone's climate (`tamrielGround.js` tamrielClimateAt): its textures, its nature
flats, the weather's table and the countryside's and the lairs' rates (TESA7, TESA8 - the Bay's own count of each
kind on that climate). **The air** is the zone's `air` climate where the lore's air is not its ground's
(`tamrielGround.js` groundAirClimateIndex, the air law's map - `systems/weather/airGround.js`): Morrowind's grey
volcanic ground reads Mountain, its air the warm south's, because the lore's Morrowind is "mild, though often hot, and
mostly free from snow and ice" - its snow falls on the Velothi alone.

## The zones

| Province | Zone (`key`) | Climate | Air | Jungle | Seeds | The lore |
|---|---|---|---|---|---|---|
| Skyrim | the Frozen Coast (`skyrimFrozenCoast`) | Mountain | - | - | Solitude, Dawnstar, Winterhold, 196,23 | Haafingar's shore, the Pale and Winterhold: barren tundra between the mountains and the Sea of Ghosts |
| Skyrim | the Tundra Plains (`skyrimTundra`) | MountainWoods | - | - | Whiterun, Morthal, 182,38 | Whiterun's plains, Hjaalmarch's marsh and Eastmarch's hot springs - tundra grass, stone and lichen |
| Skyrim | the Southern Pinewoods (`skyrimPinewood`) | MountainWoods | - | - | Falkreath, Riften, 174,58 | Falkreath and the Rift: "the wet climate produces thick, verdant pine forests", the Rift's aspens |
| Skyrim | the Reach (`skyrimReach`) | Mountain | - | - | Markarth, 127,36 | Markarth's crags on the High Rock border - karst, gorges, the Forsworn and their hagravens |
| Skyrim | the High Peaks (`skyrimPeaks`) | Mountain | - | - | the peaks | the Throat of the World, the Jerall's north face, the Velothi's west - snow the year round |
| High Rock | the Wrothgarian Highlands (`highRockWrothgar`) | Mountain | - | - | the peaks; 108,44, 112,36, 110,50 | Wrothgar, where Gortwog raises Orsinium again in Daggerfall's day - snow fields, granite, Orc holds |
| High Rock | the Rivenspire Moors (`highRockRivenspire`) | HauntedWoodlands | - | - | Shornhelm, Farrun, Jehanna | Shornhelm's bleak uplands over the Sea of Ghosts - peat moor and wind-bent trees, a country of old houses and their dead |
| High Rock | Glenumbra (`highRockGlenumbra`) | Woodlands | - | - | Northpoint, 50,40, 56,46 | the western peninsula: oak and beech over green turf, the Druids' Systres seaward |
| Hammerfell | the Alik'r Desert (`hammerfellAlikr`) | Desert | - | - | 76,96, 96,100, 62,102 | "a vast sea of sand and dunes", Yokudan tombs under it, sandstorms over it |
| Hammerfell | Craglorn (`hammerfellCraglorn`) | Desert2 | - | - | Dragonstar, Elinhir, 116,78 | red-rust mesas and canyons toward Skyrim and Cyrodiil, Dwemer ruins and the vents of the Dragontail's fire |
| Hammerfell | the Abecean Coast (`hammerfellCoast`) | Subtropical | - | - | Taneth, Rihad, Gilane, Hegathe | Taneth, Rihad, Gilane and Hegathe: "coasts are especially vibrant with plantlife" - palms, white beaches |
| Hammerfell | the Dragontail Heights (`hammerfellDragontail`) | Mountain | - | - | the peaks | the Dragontail's spine, snow on its peaks over the desert |
| Sumurset Isle | the Vine Coast (`summersetVineCoast`) | Subtropical | - | - | Alinor, Dusk, Sunhold, Lillandril, Shimmerene | Alinor's "temperate south-west coast... rows of vineyards", golden meadows and the gold and crimson groves |
| Sumurset Isle | Auridon (`summersetAuridon`) | Subtropical | - | - | Firsthold, Skywatch | the sister isle, more forest than vine |
| Sumurset Isle | Eton Nir (`summersetEtonNir`) | Mountain | - | - | the peaks | the isle's highest peak, Cloudrest on its crown - snow on the summit alone |
| Valenwood | the Graht-Oak Forest (`valenwoodGrahtwood`) | Rainforest | - | - | Falinesti, Elden Root, 140,146 | Falinesti's and Elden Root's country - the graht-oaks that hold cities, lianas, little light on the floor |
| Valenwood | Malabal Tor (`valenwoodMalabal`) | Rainforest | - | - | 108,132, 120,128 | the deep northern canopy: the densest forest, its rivers, its Wood Orcs |
| Valenwood | the Mangrove Coast (`valenwoodCoast`) | Swamp | - | - | Woodhearth, Haven, Southpoint, 84,146 | "coasts... dominated by mangrove swamps": Woodhearth, Haven, Southpoint |
| Valenwood | Reaper's March (`valenwoodReapersMarch`) | Subtropical | - | - | Arenthia, 142,138 | the north-east border with Elsweyr, jungle giving way to plains |
| Elsweyr | the Anequina Badlands (`elsweyrAnequina`) | Desert2 | - | - | Riverhold, Rimmen, Orcrest, Dune | Riverhold's canyons, Rimmen's steppes and Orcrest - red clay, mesas, cracked hardpan |
| Elsweyr | the Pelletine Savanna (`elsweyrPelletine`) | Subtropical | - | - | Torval, Senchal, 168,156 | Torval and Senchal: moon-sugar cane, saltrice, "pristine white beaches" |
| Elsweyr | the Tenmar Forest (`elsweyrTenmar`) | Rainforest | - | - | 146,164, 148,172 | the jungle against Valenwood, where the moon-sugar cane grows wild |
| Black Marsh | the Hist Swamps (`blackMarshHist`) | Swamp | - | - | Helstrom, Blackrose, 246,136 | the interior: black peat, standing water, the spore-trees "that grow only in the swamp interior" |
| Black Marsh | the Shadowfen (`blackMarshFens`) | Swamp | - | - | Stormhold, Thorn, Gideon, 264,112 | Stormhold, Thorn and Gideon - raised bog and reed beds toward Morrowind and Cyrodiil |
| Black Marsh | Murkmire (`blackMarshMurkmire`) | Rainforest | - | - | Lilmoth, Soulrest, Archon, 264,148 | the southern coasts, Lilmoth and Soulrest: swamp-jungle and mangrove on Topal Bay |
| Morrowind | the Ashlands (`morrowindAshlands`) | Mountain | Desert2 | - | Ald'ruhn, 253,40, 242,34, 258,32, 236,70 | Red Mountain's grey country - ash, pumice, basalt; "mild, though often hot, and mostly free from snow and ice" |
| Morrowind | the Bitter Coast (`morrowindBitterCoast`) | Swamp | Subtropical | - | Vivec, Ebonheart, 242,45, 258,48 | Vvardenfell's green rim - the Bitter Coast's swamps, the Ascadian Isles' paddies, Vivec and Ebonheart |
| Morrowind | Deshaan (`morrowindDeshaan`) | MountainWoods | Subtropical | - | Mournhold, Tear, Necrom, 268,80 | the mainland's lowlands: Mournhold, Tear, Necrom - fungal valleys and plantations, warm and wet |
| Morrowind | the Velothi Mountains (`morrowindVelothi`) | Mountain | - | - | the peaks | the wall against Skyrim and Cyrodiil - Morrowind's snow is here alone |
| Morrowind | the Velothi Foothills (`morrowindVelothiFoot`) | Mountain | Subtropical | - | Blacklight, 212,48 | Blacklight's country under the range: grey and red rock, scree, scrub |
| Imperial Province | the Nibenay Jungle (`cyrodiilNibenay`) | Rainforest | - | yes | Imperial City, Cheydinhal, Bravil, 186,104, 188,86 | the heartland round Lake Rumare and the Niben - the rain forest the Pocket Guide says encloses the valley |
| Imperial Province | Blackwood (`cyrodiilBlackwood`) | Swamp | - | yes | Leyawiin, 192,130, 204,126 | Leyawiin's country on Topal Bay - flooded forest and mangrove under the canopy |
| Imperial Province | the Colovian Jungle (`cyrodiilColovia`) | Rainforest | - | yes | Chorrol, Skingrad, 164,94, 150,96 | Chorrol and Skingrad's uplands, the jungle climbing the Colovian Highlands |
| Imperial Province | the Gold Coast (`cyrodiilGoldCoast`) | Subtropical | - | - | Anvil, Kvatch, 140,104 | Anvil and Kvatch: "deciduous forest and mangroves, becoming sparser towards the ocean" |
| Imperial Province | the Jerall Highlands (`cyrodiilJerall`) | MountainWoods | - | - | the peaks; Bruma, 196,78, 150,80 | Bruma's cloud forest under the Jerall and the Valus - the province's snow |

## Cyrodiil's jungle

The Pocket Guide (2E 864): Cyrodiil "is the largest region of the continent, and most is endless jungle". "Its
centre, the grassland of the Nibenay Valley, is enclosed by an equatorial rain forest and broken up by rivers."
"Between its western coast and its central valley there are all manner of deciduous forest and mangroves, becoming
sparser towards the ocean." The Ayleid sources UESP gathers under Lore:Cyrod read the same, and Lady Cinnabar's theory
that the White-Gold Tower shapes the climate to its ruler gives the world its own reason.

So the Nibenay (the Imperial City, Cheydinhal, Bravil), the Colovian uplands (Chorrol, Skingrad) and Blackwood
(Leyawiin, on Topal Bay) stand the jungle - `jungle: true` on their zones - and the Gold Coast (Anvil, Kvatch) is the
Pocket Guide's sparser country toward the ocean, the Jerall highlands (Bruma) its cloud forest and snow.

**How it stands.** The jungle's field (`world/jungle/jungleRegion.js` jungleField) reads a pixel past the Bay through
`beyond` - its zone's `jungle` - where it read every pixel off the Bay's map as outside; those pixels' sides and
distances are kept in maps (the Bay's in its typed arrays as before, byte for byte), and the field is made again when
the land's trace or the fit moves (`scenes/jungleHost.js` `version`). Everything else is Bantha's, unchanged: the
four storeys and their numbers, the floor's carpet, the roadside pairs and the trails, the haze and its cull, the
rainforest's air leaned over the jungle (PRECIP1). The jungle's edge with the Gold Coast and the Jerall is its own
ecotone - the stands, the wandering line, the haze drifting out past the last trees.

## The fauna (`systems/tamrielFauna.js`)

**The tables.** DFU picks a wild foe from a table of twenty mobile ids, in the order of their level: ChooseRandomEnemy
(RandomEncounters.cs :1471-1507) reads the slots about the player's level (80% of rolls level - 3 to level + 3). Each
biome has DFU's three - the town at night, the wild by day, the wild by night - at its own indices (`BIOME_TABLE_BASE`
100 and up, three a biome in BIOMES' order), made from its ROSTER:

- a roster entry is a mobile id and its rarity there - C common, U uncommon, R rare, V very rare (one slot at most);
- slot i is met by players about level i + 1, so it draws, by a hash of the biome and the slot, from the roster's
  monsters within `SLOT_REACH` (4) levels of i + 1 - each weighed by its rarity (`RARITY` C 4, U 2, R 1, V 0.5), over one
  plus half its distance in levels, over one plus the times it stands already - and from the roster's people (class
  enemies, who stand at the player's level) from `CLASS_FROM` (slot 3) up. A slot nothing reaches takes the roster's
  monster nearest its level;
- the town table is the province's (`TOWN_ROSTERS`): its vermin, its own thieves, its night things.

**Daggerfall Enemy Expansion.** Main carries DEX (`04-Characters/Enemy-Expansion.md`), and its creatures are the lore's
where Daggerfall has none: its Wolf and Snow Wolf, Troll, Goblin, Minotaur (Cyrodiil's own - Morihaus's kin), Mudcrab,
Boar, Mountain Lion, Land Dreugh, Ogre, Will-o'-wisp, Scamp, Blood Spider, Lizard Man and Lizard Warrior, the Dwemer's
Centurion Sphere and Steam Centurion, its necromancers, riders, druids and witches. A roster names them; while DEX is not
loaded each stands as its classic stand-in (`STANDIN`: the Wolf as the Sabertooth, the Troll and the Ogre as the Giant,
the Mudcrab as the Rat, the Sphere as the Iron Atronach...) or, with none fair (the Lizard Men), is left out. Both
variants are made; the selector answers the one the game loaded (`dexLoaded`), the same on every machine of a game.

**The door.** One selector on DFU's encounter-table door (`characters/encounterTableDoor.js`) answers the biome
indices (`FAUNA_SELECTOR`, stood by `installTamrielFauna`). The encounter law's ctx carries the pixel's band as
`fauna` (`faunaBandAt` - null on the Bay and at sea), and `resolveEncounterTableIndex` reads it before the climate's.

**The four hosts.** `scenes/world.js` WIRED - the wild's minute roll (IntermittentEnemySpawn), a roaming band's make, a
camp's group, the online grant's species law (`scenes/grantHost.js` `faunaAt`). `scenes/exterior.js` FLAGGED - the
fixed city stands on the Bay's map alone. `scenes/worldModes.js` FLAGGED - an interior rolls its building's table.
`scenes/dungeonContext.js` FLAGGED - a dungeon rolls its type's table (a lair past the Bay is a Daggerfall dungeon
type, TESA8).

## The rosters

Each entry is the creature and its rarity (C common, U uncommon, R rare, V very rare - one slot at most); a * marks Daggerfall
Enemy Expansion's, which stands as its classic stand-in while that mod is not loaded (`STANDIN`). The tables these make are
the module's `biomeTable` - read them there, they are made, not written.

| Zone | By day | By night |
|---|---|---|
| the Frozen Coast | Rat C, Snow Wolf* C, Wolf* U, Sabretooth Tiger U, Grizzly Bear U, Mudcrab* U, Troll* U, Ice Golem* R, Giant R, Spriggan R, Dreugh R, Ice Atronach V, Barbarian U, Warrior U, Archer R, Ranger R | Giant Bat C, Snow Wolf* C, Skeletal Warrior U, Mummy U, Ghost U, Werewolf R, Wraith R, Vampire R, Ice Atronach R, Frost Daedra V, Ancient Lich V, Barbarian U, Nightblade R |
| the Tundra Plains | Rat C, Wolf* C, Mudcrab* U, Sabretooth Tiger U, Grizzly Bear U, Spider U, Giant U, Spriggan R, Troll* R, Harpy R, Centurion Sphere* R, Steam Centurion* V, Barbarian U, Warrior U, Archer U, Bard R | Giant Bat C, Wolf* C, Skeletal Warrior U, Mummy U, Ghost U, Werewolf U, Wraith R, Vampire R, Lich V, Ancient Lich V, Barbarian U, Nightblade R |
| the Southern Pinewoods | Rat C, Wolf* C, Grizzly Bear C, Spider U, Sabretooth Tiger U, Spriggan U, Mudcrab* U, Troll* R, Giant R, Archer U, Ranger U, Rogue R, Thief R, Barbarian R | Giant Bat C, Wolf* C, Werewolf U, Skeletal Warrior U, Ghost U, Will-o'-wisp* U, Mummy U, Vampire R, Wraith R, Lich V, Thief U, Assassin R, Nightblade R |
| the Reach | Rat C, Wolf* C, Sabretooth Tiger U, Grizzly Bear U, Harpy U, Troll* U, Centurion Sphere* U, Spriggan R, Giant R, Steam Centurion* R, Barbarian C, Archer U, Ranger U, Witch Defender* R | Giant Bat C, Wolf* C, Harpy U, Skeletal Warrior U, Mummy U, Ghost U, Wraith R, Vampire R, Werewolf R, Lich V, Barbarian U, Witch Defender* R |
| the High Peaks | Snow Wolf* C, Troll* U, Sabretooth Tiger U, Ice Golem* U, Giant R, Harpy R, Ice Atronach R, Barbarian R | Snow Wolf* C, Troll* U, Ice Golem* U, Mummy U, Ghost R, Wraith R, Ice Atronach R, Frost Daedra V, Ancient Lich V |
| the Wrothgarian Highlands | Orc C, Orc Sergeant U, Orc Shaman U, Orc Warlord R, Grizzly Bear U, Wolf* U, Snow Wolf* R, Harpy U, Giant U, Goblin* U, Troll* R, Ogre* R, Ice Golem* V, Barbarian U | Giant Bat C, Wolf* C, Grizzly Bear U, Werewolf U, Orc U, Snow Wolf* R, Ghost R, Wraith R, Vampire R, Troll* R |
| the Rivenspire Moors | Rat C, Wolf* C, Grizzly Bear U, Spriggan U, Harpy U, Boar* U, Gargoyle R, Imp R, Dog* R, Archer U, Rogue U, Knight R, Witch Defender* R, Necromancer Acolyte* R | Giant Bat C, Wereboar U, Werewolf U, Zombie U, Skeletal Warrior U, Ghost U, Wraith U, Vampire U, Ghoul* U, Gargoyle R, Ancient Vampire V, Lich V, Nightblade R |
| Glenumbra | Rat C, Wolf* U, Boar* U, Grizzly Bear U, Spriggan U, Mudcrab* U, Nymph R, Centaur R, Harpy R, Imp R, Dreugh R, Lamia R, Knight U, Archer U, Ranger U, Druid* R, Spellsword R, Witch Defender* R | Giant Bat C, Wereboar U, Werewolf U, Skeletal Warrior U, Zombie U, Ghost U, Wraith R, Vampire R, Will-o'-wisp* R, Lich V, Thief R |
| the Alik'r Desert | Rat C, Giant Scorpion C, Sabretooth Tiger U, Harpy U, Lamia R, Giant R, Nymph V, Warrior C, Barbarian U, Archer U, Spellsword R, Rogue Rider* R, Archer Rider* R | Giant Bat C, Giant Scorpion C, Mummy C, Skeletal Warrior U, Skeletal Soldier* U, Ghost U, Wraith R, Lamia R, Vampire R, Fire Atronach V, Rogue U, Assassin R |
| Craglorn | Rat C, Giant Scorpion C, Harpy U, Sabretooth Tiger U, Giant U, Centurion Sphere* U, Ogre* R, Steam Centurion* R, Goblin* R, Troll* R, Warrior U, Barbarian U, Archer R | Giant Bat C, Giant Scorpion U, Mummy U, Skeletal Warrior U, Ghost U, Wraith R, Fire Atronach R, Vampire R, Lich V, Rogue U |
| the Abecean Coast | Rat C, Dog* U, Giant Scorpion U, Sabretooth Tiger U, Harpy U, Lamia U, Dreugh U, Mudcrab* U, Nymph R, Centaur R, Warrior U, Rogue U, Thief U, Spellsword R, Bard R | Giant Bat C, Lamia U, Dreugh U, Skeletal Warrior U, Mummy U, Ghost U, Werewolf R, Wraith R, Vampire R, Thief U, Assassin R |
| the Dragontail Heights | Harpy C, Giant Scorpion U, Sabretooth Tiger U, Giant U, Ogre* R, Troll* R, Grizzly Bear R, Barbarian U | Giant Bat C, Harpy U, Skeletal Warrior U, Ghost U, Wraith R, Vampire R, Fire Atronach V |
| the Vine Coast | Rat C, Mudcrab* U, Dreugh U, Spider R, Nymph R, Spriggan R, Mage U, Spellsword U, Battlemage U, Knight U, Archer U, Sorcerer R, Healer R, Bard R, Rogue R | Giant Bat C, Skeletal Warrior U, Ghost U, Faded Ghost* U, Will-o'-wisp* U, Wraith R, Vampire R, Lich V, Daedra Seducer V, Nightblade R, Sorcerer R |
| Auridon | Rat C, Spider U, Spriggan U, Mudcrab* U, Dreugh U, Nymph R, Mage U, Spellsword U, Archer U, Knight U, Battlemage R, Ranger R | Giant Bat C, Spider U, Skeletal Warrior U, Ghost U, Will-o'-wisp* U, Faded Ghost* U, Wraith R, Vampire R, Lich V, Nightblade R |
| Eton Nir | Rat U, Spider U, Harpy U, Stone Golem* R, Mage U, Battlemage U | Giant Bat C, Ghost U, Skeletal Warrior U, Wraith R, Lich V, Sorcerer R, Nightblade R |
| the Graht-Oak Forest | Rat C, Spider C, Blood Spider* U, Spriggan U, Sabretooth Tiger U, Centaur R, Wolf* R, Ogre* R, Archer C, Ranger U, Acrobat U, Thief U, Druid* R, Rogue Druid* R | Giant Bat C, Spider C, Werewolf U, Will-o'-wisp* U, Skeletal Warrior U, Zombie U, Ghost U, Wraith R, Vampire R, Lich V, Nightblade R, Assassin R |
| Malabal Tor | Rat C, Spider C, Spriggan U, Wolf* U, Sabretooth Tiger U, Grizzly Bear R, Orc R, Ogre* R, Orc Shaman V, Archer U, Ranger U | Giant Bat C, Spider C, Werewolf U, Will-o'-wisp* U, Skeletal Warrior U, Ghost U, Wraith R, Vampire R, Lich V |
| the Mangrove Coast | Rat C, Mudcrab* C, Spider U, Lamia U, Dreugh U, Spriggan R, Sabretooth Tiger R, Archer U, Rogue U, Acrobat U | Giant Bat C, Lamia U, Dreugh U, Zombie U, Ghost U, Skeletal Warrior U, Werewolf R, Vampire R, Thief U |
| Reaper's March | Rat C, Sabretooth Tiger C, Spider U, Centaur R, Archer U, Monk R, Acrobat U, Thief U | Giant Bat C, Sabretooth Tiger U, Werewolf R, Skeletal Warrior U, Zombie U, Ghost U, Wraith R, Vampire R, Thief U |
| the Anequina Badlands | Rat C, Giant Scorpion C, Sabretooth Tiger C, Harpy U, Wolf* R, Troll* R, Monk U, Acrobat U, Thief U, Warrior U, Rogue Rider* R, Archer Rider* R | Giant Bat C, Giant Scorpion U, Sabretooth Tiger U, Mummy U, Skeletal Warrior U, Ghost U, Wraith U, Werewolf R, Vampire R, Fire Atronach V, Nightblade R, Assassin R |
| the Pelletine Savanna | Rat C, Sabretooth Tiger C, Spider U, Dreugh U, Mudcrab* U, Lamia R, Spriggan R, Thief C, Acrobat U, Monk U, Bard R | Giant Bat C, Sabretooth Tiger U, Spider U, Zombie U, Ghost U, Wraith R, Vampire R, Werewolf R, Thief U, Assassin U |
| the Tenmar Forest | Rat C, Sabretooth Tiger C, Spider C, Blood Spider* U, Spriggan U, Lamia R, Monk U, Acrobat U, Archer U | Giant Bat C, Spider C, Sabretooth Tiger U, Will-o'-wisp* U, Zombie U, Ghost U, Werewolf R, Wraith R, Vampire R |
| the Hist Swamps | Rat C, Lizard Man* C, Spider U, Lamia U, Mudcrab* U, Lizard Warrior* U, Spriggan R, Giant Scorpion R, Will-o'-wisp* R, Nightblade U, Rogue U, Acrobat U, Assassin R, Healer R | Giant Bat C, Zombie C, Skeletal Warrior U, Mummy U, Ghost U, Wraith U, Will-o'-wisp* U, Lamia U, Ghoul* U, Vampire R, Lich V, Nightblade U, Assassin R |
| the Shadowfen | Rat C, Spider U, Mudcrab* U, Lizard Man* U, Lamia U, Giant Scorpion R, Rogue U, Nightblade R, Archer R, Warrior R | Giant Bat C, Zombie C, Skeletal Warrior U, Ghost U, Wraith U, Will-o'-wisp* U, Lamia U, Vampire R, Lich V, Nightblade R |
| Murkmire | Rat C, Mudcrab* C, Spider U, Blood Spider* U, Lamia U, Dreugh U, Lizard Man* U, Lizard Warrior* R, Spriggan R, Rogue U, Acrobat U, Nightblade R | Giant Bat C, Zombie U, Lamia U, Dreugh U, Ghost U, Will-o'-wisp* U, Wraith R, Vampire R |
| the Ashlands | Rat C, Scamp* U, Centurion Sphere* U, Steam Centurion* R, Fire Atronach R, Daedroth R, Barbarian U, Nightblade U, Battlemage U, Archer U, Monk R, Sorcerer R | Giant Bat C, Ghost C, Skeletal Warrior U, Mummy U, Zombie R, Wraith R, Daedroth R, Fire Atronach R, Vampire R, Daedra Seducer V, Lich V, Nightblade U |
| the Bitter Coast | Rat C, Mudcrab* C, Dreugh U, Scamp* R, Centurion Sphere* R, Nightblade U, Rogue U, Archer R, Healer R, Battlemage R | Giant Bat C, Ghost C, Skeletal Warrior U, Zombie U, Dreugh U, Mummy R, Wraith R, Vampire R, Lich V, Nightblade U, Assassin R |
| Deshaan | Rat C, Spider U, Blood Spider* U, Mudcrab* U, Scamp* U, Goblin* R, Daedroth R, Nightblade U, Battlemage U, Healer R, Knight R, Assassin R, Sorcerer R | Giant Bat C, Ghost C, Skeletal Warrior U, Mummy U, Zombie U, Wraith R, Vampire R, Daedroth R, Daedra Seducer V, Lich V, Assassin U |
| the Velothi Mountains | Goblin* U, Wolf* R, Snow Wolf* R, Grizzly Bear R, Troll* R, Centurion Sphere* R, Barbarian U, Archer U | Giant Bat C, Ghost U, Skeletal Warrior U, Wraith U, Troll* R, Vampire R |
| the Velothi Foothills | Rat C, Goblin* U, Scamp* U, Centurion Sphere* R, Barbarian U, Archer U, Nightblade R | Giant Bat C, Ghost C, Skeletal Warrior U, Mummy U, Wraith R, Vampire R |
| the Nibenay Jungle | Rat C, Imp C, Spider C, Blood Spider* U, Mountain Lion* U, Sabretooth Tiger U, Spriggan U, Minotaur* U, Goblin* U, Boar* U, Mudcrab* U, Land Dreugh* R, Ogre* R, Troll* R, Centaur R, Lamia R, Rogue U, Thief U, Archer U, Warrior U, Bounty Hunter* R, Necromancer Acolyte* R, Knight R, Battlemage R | Giant Bat C, Spider C, Mountain Lion* U, Will-o'-wisp* U, Skeletal Warrior U, Zombie U, Ghost U, Wraith U, Vampire U, Lich R, Werewolf R, Daedroth V, Nightblade R, Necromancer Glaivier* R, Assassin R |
| Blackwood | Rat C, Mudcrab* C, Land Dreugh* U, Spider U, Lizard Man* U, Lamia U, Imp U, Spriggan R, Mountain Lion* R, Rogue U, Thief U, Nightblade R, Archer R | Giant Bat C, Zombie U, Will-o'-wisp* U, Lamia U, Land Dreugh* U, Ghost U, Skeletal Warrior U, Wraith R, Vampire R, Lich V |
| the Colovian Jungle | Rat C, Mountain Lion* C, Imp U, Wolf* U, Grizzly Bear U, Boar* U, Spider U, Spriggan U, Goblin* U, Minotaur* R, Ogre* R, Troll* R, Rogue U, Archer U, Warrior U, Knight R, Bounty Hunter* R, Necromancer Acolyte* R | Giant Bat C, Wolf* C, Mountain Lion* U, Skeletal Warrior U, Zombie U, Ghost U, Wraith U, Vampire U, Lich R, Werewolf R, Will-o'-wisp* R, Nightblade R, Necromancer Glaivier* R |
| the Gold Coast | Rat C, Mountain Lion* C, Mudcrab* C, Imp U, Boar* U, Wolf* U, Dreugh U, Land Dreugh* R, Spriggan R, Goblin* R, Minotaur* R, Rogue U, Thief U, Archer U, Warrior U, Bard R, Knight R | Giant Bat C, Wolf* U, Mountain Lion* U, Skeletal Warrior U, Zombie U, Ghost U, Wraith R, Vampire R, Dreugh R, Lich V, Thief U, Nightblade R |
| the Jerall Highlands | Wolf* C, Snow Wolf* U, Mountain Lion* U, Grizzly Bear U, Troll* U, Goblin* U, Ogre* R, Minotaur* R, Imp R, Ice Golem* R, Spriggan R, Barbarian U, Archer U, Rogue R | Giant Bat C, Wolf* C, Troll* U, Snow Wolf* U, Skeletal Warrior U, Ghost U, Wraith U, Vampire R, Werewolf R, Lich V, Frost Daedra V |

| Province | The town at night |
|---|---|
| High Rock | Rat C, Dog* U, Giant Bat U, Thief U, Burglar U, Rogue U, Wereboar R, Ghost R, Vampire R, Assassin R |
| Hammerfell | Rat C, Dog* U, Giant Bat U, Thief U, Rogue U, Burglar R, Ghost R, Vampire R, Assassin R |
| Skyrim | Rat C, Dog* U, Giant Bat U, Thief U, Burglar U, Barbarian U, Ghost R, Werewolf R, Vampire R, Nightblade R |
| Morrowind | Rat C, Giant Bat U, Thief U, Nightblade U, Assassin U, Ghost R, Vampire R |
| Imperial Province | Rat C, Dog* U, Giant Bat U, Thief U, Burglar U, Rogue U, Vampire R, Ghost R, Assassin R |
| Black Marsh | Rat C, Giant Bat U, Thief U, Nightblade U, Assassin R, Zombie R, Ghost R, Vampire R |
| Elsweyr | Rat C, Giant Bat U, Thief C, Acrobat U, Burglar U, Assassin R, Ghost R, Vampire R |
| Valenwood | Rat C, Giant Bat U, Thief U, Acrobat U, Burglar U, Werewolf R, Ghost R, Vampire R |
| Sumurset Isle | Rat C, Giant Bat U, Thief R, Burglar R, Mage U, Nightblade R, Ghost R, Vampire R |

## Creatures the lore names that no model stands

Morrowind's wild is mostly beasts no art stands yet - guar, netch, kagouti, alit, nix-hounds, cliff racers, shalk,
kwama, scribs; Black Marsh's crocodiles, wamasu and hackwings; Skyrim's mammoths, horkers, chaurus and ice wraiths;
the camel and the jackal of the deserts; Summerset's gryphons and indriks; the echatere of Wrothgar; the critters every
province has (deer, elk, goats, foxes, hares). Each roster stands the lore's creatures that DO have art, and none of
these is faked by a stand-in that reads wrong (no Harpy for a cliff racer, no Rat for a guar). They are the next art.

## Recorded choices

1. **Cyrodiil, jungle against temperate.** The jungle is the Pocket Guide's (2E 864), the Ayleid texts', ESO's
   Blackwood and Dawnwood; Oblivion's temperate Cyrodiil (3E 433) and Phrastus of Elinhir's *The Heartland of Cyrodiil*
   ("endless jungle" a miscopy of "extensive uplands") are the later reading. The owner chose the jungle; the Gold
   Coast and the Jerall keep the Pocket Guide's own exceptions, so Oblivion's mountain lions, wolves, bears, goblins,
   minotaurs and trolls live on at the edges as well as in it.
2. **Hammerfell's jungles** near Lainlyn and the rainforest of Tigonus (the Alik'r's shrinking, UESP-Lore) are the
   Bay's own, Bantha's; past the Bay Hammerfell is the Alik'r, Craglorn and the Abecean coast.
3. **Morrowind** is before the Red Year and the Nerevarine: ash storms in the Ashlands, no blight past the Ghostfence,
   no ash over the whole province, no horses, and no bears, big cats or spiders on Vvardenfell.
4. **Black Marsh** stands no Orc, Centaur or Wereboar (its old share of the Woodlands' tables); its Lizard Men are
   Arena's monsters and DEX's art - the wild tribes, not the Argonian people.
5. **Elsweyr** is split as the lore splits it - Anequina's badlands, Pelletine's savanna, the Tenmar jungle - where it
   was all Desert2. The Khajiit's furstocks (senche-raht and the rest) are people; the senche-cats of the wild are the
   Sabertooth.
6. **Summerset's** "tropical" (Lady Cinnabar) and "warm, temperate" (ESO) both fit DF's Subtropical.
7. **Arena's** ground palette (Temperate, Mountain, Desert) is its engine's limit, not the lore's, and is not copied.

## Pins

`test/world/tesabiome_biomes.test.js` (8) - the zones split every province, each a land climate, their seeds on their
own province; the lore's places stand in the lore's zones (fifty-odd cities); Cyrodiil's jungle zones and their climates; the
peaks' line and its two ranges that never reach it; the wander on both axes, the border off the seeds' bisectors; a pixel
past the Bay reads its zone at its centre and the Bay's own none, the cache and the stamp moved with the land; the ground's
climate and the air's; the jungle field past the Bay, the Bay's own to the bit, and the host's field made again when the
stamp moves.
`test/systems/tesabiome_fauna.test.js` (10) - every zone a roster and every province a town, every creature one the game can
stand (no dragon, no horse); DEX_LEVELS the vendored file's; the table law (twenty slots, the reach, the people's slot, a V
once, the classic variant free of DEX); the classic roster's stand-ins at the commonest rarity; the slot law on a
two-creature roster; the lore (Black Marsh and Vvardenfell rid of High Rock's woods, Cyrodiil's Imp and Minotaur, Skyrim's
wolves and trolls, the Alik'r's scorpions); the band at a pixel and the law's read of it; the selector on the door, stood
once; the online grants' species law and set by zone; the world host's wiring, the jungle's `beyond` among it.
Mutants: `tools/mutants/tesabiome.json` - 37, all dead.
