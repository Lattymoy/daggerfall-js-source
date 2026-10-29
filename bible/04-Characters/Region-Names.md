# Region Names - each people named by its own customs, each region its own families

`src/characters/regionNames.js` (the customs, pure) + `src/characters/personNames.js` (the game's doors to a name)
(REGION-NAMES, the owner, 2026-10-29)

> "Introduce new dynamic namegen for each region to be hugely diverse and lore accurate"

Pinned by `test/characters/regionnames.test.js`; `tools/mutants/regionnames.json`. Ledger: `01-Overview/Port-Ledger.md`
section A, REGION-NAMES.

## What DFU does

DFU names a person from NAMEGEN.DBN (NameHelper.cs FullName): eight banks, one a Bay people (Breton, Redguard, Nord,
Dark Elf, High Elf, Wood Elf, Khajiit, Imperial), each a few hundred parts. A Breton of Wayrest and a Breton of
Daggerfall draw from one bank. There are no Orc, Argonian or Reach names: an Argonian draws the Imperial bank. Past the
Bay, after PROVINCE-FOLK, every province's people drew the same eight banks, so a Nord of Solitude and a Nord of
Daggerfall had the same kind of name.

## What we do

Each person still draws DFU's own FullName first, exactly as DFU draws it. DFRandom then stands where DFU leaves it,
and every draw after it is DFU's. Then the person is named by their culture's customs, off a seed mixed from the
stream's state after the draw and the drawn name (`personNames.js` personName). DFU's draw is one of those customs on
the Bay, so the Bay still hears Daggerfall's names about a third of the time; past the Bay it is seldom heard.

Eleven peoples, each with its own shapes:

| People | Customs (each a share) | Lore |
|---|---|---|
| Breton | Daggerfall's draw; an anglic given name and a place name (Holtmore, Kingswell); a frankish name, sometimes "de" (Aublieu); a Celtic one or "Le" and an epithet (Le Du) | UESP Lore:Breton Names |
| Redguard | Daggerfall's draw; one name, or "at-" a direct forebear (Hosni at-Tura); a family name; "al-" the place one comes from in Hammerfell (al-Rihad) | Lawrence Schick, UESP General:ZOS_Correspondence |
| Nord | Daggerfall's draw; a father's name and -sen, -son or -sdottir; a clan of two words (Battle-Born); an epithet (the Bold) | UESP Lore:Nord Names |
| Dunmer | Daggerfall's draw; a family name most of all; rarely the old style, the house before the person (Hlaalu Helseth, Indoril Nerevar); an Ashlander's one name, in Morrowind only | UESP Lore_talk:Names |
| Altmer | Daggerfall's draw; a family name; "of" a city of the Isles (of Cloudrest) | UESP Lore:Altmer Names |
| Bosmer | Daggerfall's draw; a family name, elvish most of all, or of the wood (Briarsong); one name alone | UESP Lore:Bosmer Names |
| Khajiit | Daggerfall's draw; an honorific before the apostrophe (Ri'saad, J'zargo); a plain name, sometimes a family | UESP Lore:Khajiit Names |
| Argonian | DFU's Imperial draw (its own quirk, kept as one custom); a Jel name, sometimes a tail (Jalus-Sa); its gloss (Hides-In-Mud, Mends-Her-Heart) | UESP Lore:Argonian Names |
| Imperial | Daggerfall's draw; a Colovian praenomen and family (Fausto Belianus); a Nibenese name (Leyawiin's Blackwood the most) | UESP Lore:Imperial Names |
| Orc | One given name and gro- (a son) or gra- (a daughter) of a forebear | UESP Lore:Orc Names |
| Reachman | One name, an epithet (the Grey) or a clan (Bloodtooth); a Breton of the Reach is a Reachman 70% of the time | UESP Lore:Reachmen |

**Each region its own.** A region keeps 24 families of each people (`regionFamilies`), and about 45% of its people
are of one of them, so a clan or a house is heard again in its own country. A region also has its own fashion: a
third of each list of parts is favoured three to one, chosen by the region (`pick`, `fashionOf`), and each custom's
share is the region's own taste, half to one and a half times the people's. Two regions of one people sound
different. A zone of PROVINCE-FOLK (the Reach, Reaper's March, Gloomire, Blackwood) keeps its province's customs.

**The seams.** Names are made of parts, never listed whole. Two consonant sounds met by a consonant are drawn again
(no Astrdra, no Ogrga), then the end is one that opens on a vowel. A letter or a vowel met at a seam stands once
(no Iliias). No letter stands three times.

**Diverse.** Two thousand people of one people make at least 1,400 names, for each of the eleven.

## The keys

A name is also a key. A static NPC's name and a quest Person's are compared by the topic tree (TalkManager.cs:3159),
and two readers of one seed must name one person. So a key name is named by its bank's culture alone, never its
region or home: `personName(bank, gender)` with nothing else. Every key reader holds the bank in common. A name that
is no key - the census's resident, the street's walker, a crew, a keeper, an outlaw - is named by its race, its
region and its home as well.

## The doors

`personName` (the stream as it stands), `seededPersonName` (census.js residentName's frame: the person's own seed,
the stream put back), `randomPersonName` (MacroHelper.GetRandomFullName: the gender's coin, then the person). The
census, the street, a standing NPC, a quest Person and foe, the macros (%n, %fn, %mn, %pqn), the crews, the yards'
keepers, the crew halls, the outlaws, the tavern's regulars, the ships' captains and the arena's fighters all name
through them.

## A name between sessions

The census's residents and the street's walkers are not saved by name: each is minted again from its seed. So a
person met before this change has a new name after it, as a translation pack renames them (L10N3f, the accepted
precedent). A quest's Person is named when the quest starts and saved with it (person.js `displayName`), and a spouse
keeps the name the family saved, so a quest under way and a family keep their names.
