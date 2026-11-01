# Region Names

Names for the people of Tamriel, made by each culture's own customs and each region's own families, so names are
diverse and lore-accurate everywhere. The player hears them on townsfolk, residents, standing NPCs, quest people and
foes, crews, keepers, outlaws, regulars, captains and arena fighters.

## How it works

- **DFU's draw first.** Each person still draws DFU's own `FullName` first (`src/characters/nameHelper.js`), so the
  random stream stands where DFU leaves it and every later draw is DFU's. The person is then named by their culture's
  customs, off a seed mixed from the stream's state and the drawn name (`personName`,
  `src/characters/personNames.js`). DFU's draw is one of those customs on the Bay, so the Bay still hears Daggerfall's
  names about a third of the time.
- **Eleven peoples** (`NAME_CULTURES`, `regionName` in `src/characters/regionNames.js`), each with its own customs,
  each a share:

| People | Customs (each a share) | Lore |
|---|---|---|
| Breton | Daggerfall's draw; an anglic given name and a place name; a frankish name, sometimes "de"; a Celtic one or "Le" and an epithet | UESP Lore:Names |
| Redguard | Daggerfall's draw; one name, or "at-" a direct forebear (Hosni at-Tura); a family name; "al-" the place one comes from in Hammerfell (al-Rihad) | Lawrence Schick, UESP General:ZOS_Correspondence |
| Nord | Daggerfall's draw; a father's name and -sen, -son or -sdottir; a clan of two words (Battle-Born); an epithet (the Bold) | UESP Lore:Names |
| Dunmer | Daggerfall's draw; a family name most of all; rarely the old style, the house before the person (Hlaalu Helseth, Indoril Nerevar); an Ashlander's one name, in Morrowind only | UESP Lore_talk:Names |
| Altmer | Daggerfall's draw; a family name; "of" a city of the Isles (of Cloudrest) | UESP Lore:Names |
| Bosmer | Daggerfall's draw; a family name, elvish most of all, or of the wood; one name alone | UESP Lore:Names |
| Khajiit | Daggerfall's draw; an honorific before the apostrophe (Ri'saad, J'zargo); a plain name, sometimes a family | UESP Lore:Names |
| Argonian | DFU's Imperial draw (its own quirk, kept as one custom); a Jel name, sometimes a tail; its gloss (Hides-In-Mud, Mends-Her-Heart) | UESP Lore:Names |
| Imperial | Daggerfall's draw; a Colovian praenomen and family; a Nibenese name (Leyawiin's Blackwood the most) | UESP Lore:Names |
| Orc | One given name and gro- (a son) or gra- (a daughter) of a forebear | UESP Lore:Names |
| Reachman | One name, an epithet (the Grey) or a clan; a Breton of the Reach is a Reachman 70% of the time | UESP Lore:Reachmen |

- **Each region its own.** A region keeps `REGION_FAMILIES` (24) families of each people (`regionFamilies`), and about
  `REGION_FAMILY_SHARE` (45%) of its people belong to one, so a clan or house is heard again in its own country. A
  region also favours a third of each list of parts three to one, and weighs each custom by its own taste
  (`customWeights`), so two regions of one people sound different.
- **Seams.** Names are built from parts, never listed whole. Clashing consonant runs are redrawn, a doubled letter or
  vowel at a seam stands once, and no letter stands three times.
- **Keys.** A static NPC's and a quest Person's names are compared by the topic tree, so two readers of one seed must
  agree: a key name is named by its bank's culture alone (`personName(bank, gender)`). A name that is no key (a
  resident, a walker, a crew, a keeper, an outlaw) also reads its race, region and home.
- **Doors.** `personName` (the stream as it stands), `seededPersonName` (a person's own seed, the stream put back) and
  `randomPersonName` (DFU's `MacroHelper.GetRandomFullName`). The macros `%n`, `%fn`, `%mn` and `%pqn` name through
  them.

## Rules

- Each region's namegen is hugely diverse and lore accurate (the owner): two thousand people of one people make at
  least 1,400 names, for each of the eleven.
- Pure: one seed, culture, region, home and gender make one name on every machine.
- Residents and walkers are not saved by name; each is minted from its seed. A quest's Person is named when the quest
  starts and saved with it, and a spouse keeps the name the family saved.

## Tamriel

Past the Bay a person is named by their province's people (`PROVINCE_FOLK`, `src/characters/provinceFolk.js`). A zone
(the Reach, Reaper's March, Gloomire, Blackwood) keeps its province's customs; a Breton of the Reach is a Reachman 70%
of the time (`cultureAt`). Dunmer Ashlander names occur in Morrowind only.

## Daggerfall Unity

DFU names a person from its name banks (`NameHelper.FullName`): eight banks, one a Bay people, shared by every region;
no Orc, Argonian or Reach names (an Argonian draws the Imperial bank). The port keeps DFU's draw and its stream, then
names by culture and region: a departure for diversity and for the provinces DFU never reaches.

## Code and tests

- `src/characters/regionNames.js` - cultures, customs, region families and fashion, `regionName`
- `src/characters/personNames.js` - the game's doors to a name
- `test/characters/regionnames.test.js` - customs, regions, seams, diversity, keys, DFU's stream kept
