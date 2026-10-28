# AUDIT PROVINCE-FOLK - PROVINCE-FOLK read cold, 2026-10-28

The owner: *"Audit this"*, of `bb9ceb0d0` - PROVINCE-FOLK (`../../03-World/World-Wide.md` PROVINCE-FOLK): each province
past the Bay lived in by its own people. Three cold lanes read the commit at its head against its base `c9651c3c8`, each
in its own worktree, each given the files and one brief (what to hunt, how to prove it), never a conclusion. Each
finding was proven on the real code - a probe on both trees, a test that fails at the head, or quoted lines - before it
was reported, and proven again here.

| Lane | Read | Found |
|---|---|---|
| A | the runtime law: every population that stands a person, past the Bay and on it, head against base; one person's body, picture, portrait, name and record; caches; the place seam in every mode | 12 |
| B | the player's view and the room: the lore, what a player sees and reads of one person, two machines in one room, the servers' bundles, the frame's cost | 8 |
| C | the pins, the mutants and the record: what each assertion holds, new mutants (24 run), every claim against the code, the gates | 15 |

Thirty-five found, six of them twice: A5 is B1 and C2, A3 is B2 and C3, A4 is B4, A12 is B5. Every defect is fixed or
its record corrected. Each fix in code carries an `AUDIT PROVINCE-FOLK <id>` comment and is pinned by a test that fails on
the code as it stood (`test/scenes/audit_provincefolk.test.js`, 6; `test/characters/provincefolk.test.js`, 10, its pins
tightened), with mutants the pins kill in `tools/mutants/audit_provincefolk.json` (43: 42 dead and one equivalent, as
recorded) and `tools/mutants/provincefolk.json` (29 of 29 dead, ten re-aimed by content).

## Lane A - the runtime law

**A1 (bug). A revenant born past the Bay rose as another race.** Its killer was drawn as the province's people off its
seed, and the revenant, whose person is that seed, as the Bay's (its own person's law, ALLY-RACE). A Dark Elf killed the
player in Morrowind and came back a Redguard - 362 of 400 there. Now the revenant's record keeps the race its body was
drawn in (`revenant.js` `race`, through `foeBodies.js bodyRaceOf`); its stamp carries it, the save keeps it (a race no
people has is dropped), its sworn self carries it to the companion layer (`revenantCompanions.js` `m.folk`, stamped by
`crewAshore.js`), and `foeBodies.js ownRace` draws it wherever it stands.

**A2 (bug; at the base too). Indoors no standing person read their race.** The room's look (`worldModes.js`
standingLook) built the person's record from the quest scene's context, which carries no faction table and no region's
race. So a factioned person stood a Nord - a miss reads FactionRaces 0 - and a factionless one had no body at all
(14,174 interior records: 11,194 bodiless, 2,763 Nords), on the Bay too. The room's person is read as the street's is
now (`peopleBodies.js standingPersonLook`: the faction table and the building's region's race - GetRaceFromFaction's
two doors). A DFU law restored, on the Bay as past it: more of a building's people stand in a body, under the lanes'
one frame budget (MWNPC11).

**A3 (should-fix; B2, C3). A ship's crew changed people with where the viewer stood.** `rosterLook` read the player's
place, and a crew's sprites are stood again at every sight, so one ship's hands were Wood Elves at sea and Dark Elves
in a Morrowind port, and two machines disagreed. A roster names its people now (`home`): a sea ship's crew are her
waters' people - the area or region her names were drawn in, which her word already carries (`navalHost.js`
watersFolkKey, on her crew entry; `navalCrew.js`); a crew with no waters (the player's own, a peer's) are the Bay's draw
wherever she sails. The naval host's ceiling rose by one for the entry, its reason beside it
(`test/scenes/hostceiling.test.js`).

**A4 (should-fix; B4). A spouse was Breton in the line and Imperial in the world.** Marriage records a race the line
can carry (the eight playable races - an Imperial is recorded a Breton, `marriage.js`'s own fallback), and the
household stood the spouse off the census's race. The spouse stands in the line's race now (`legacyHost.js`
spousesOf), as their face on the Family page and their children have it. An Imperial courted in Cyrodiil is a Breton
from the wedding on - the line's limit, recorded.

**A5 (bug; B1, C2). One foe was two races on two machines.** `bayPerson` drew from where the viewer stood, and a world
room is a 16-pixel cell: across a border, 1,564 of 2,000 shared foes came out another race, and a foe re-dressed after
the player crossed a border re-raced. A foe is drawn where it stands now - the pixel under its feet outdoors, the
player's own pixel indoors and underground, where both stand in one place (`provinceFolk.js` folkWhere, through the
world host's two doors, `setFolkPlace(pixelOf, regionAt)`) - and its race is drawn once a seed (`foeBodies.js`
placeRace). What stays: two machines that first see one foe on either side of a border, because it crossed between,
draw it each by its own first sight.

**A6 (minor). Cyrodiil's quest people stood as Bretons.** Their race was the region's Breton stand-in, and the body kept
it. A quest's person follows the standing people's rule now (below): one whose race is the region's is the place's own.
The quest's record keeps its Breton - the oath and the quest's words read it.

**A7 (minor). The Bay's walkers were dressed off another seed.** The spawn's key gained the race and the dress was seeded
off the key; every walker's clothes and head changed, unseen (walkers re-roll at each spawn). The dress is seeded off the
roll alone again; the race is in the key (`folkBodies.js` spawnOf).

**A8 (minor; record-only). A Bay family member of a beast race now wears their picture's outfit.** `folkVariant` reads
any race's picture now; a Khajiit or an Argonian of the line, drawn in a Redguard's picture (`household.js`
outfitRaceOf), wore variant 0's role and cut and wears their own variant's. A fix on the Bay, kept.

**A9 (minor). The tavern's regulars asked the place every frame.** `regularLook` asked `nativeHere` once a regular a
frame. A table's regulars ask it once a frame now, and only for the Imperial bank's (`cardRegulars.js` regularsToStand).
The King's Gambit's chairs (`worldModes.js` cardRegularsNow) still ask once a regular, in Cyrodiil and Black Marsh alone:
the card block's ten harnesses evaluate it with a closed scope, and a new name there is ten test edits for four reads.

**A10 (record-only; at the base too, behind A2). A region's faction kept its Bay race past the Bay.** The Royal Guard of
Daggerfall, the People of Wayrest and the knightly orders stand in the blocks the towns past the Bay are built of. Past
the Bay a person of a region's faction - a Bay town's, a province's court (Cyrodiil's is recorded Breton, WW-R) - is
the place's own people now (`peopleBodies.js standingRace`). A named one keeps theirs: an Individual faction's lord of
Sentinel standing in a Skyrim tavern (Lord Khane, Thaik, Lord Kilbar) is that lord, a Redguard.

**A11 (record-only). At sea past the Bay the region is 0.** The politic map answers the Alik'r Desert for the sea past the
Bay (`tamrielGround.js`, `mapsFile.js` getRegionIndexAt's clamp), so a foe at sea there is the Bay's draw, and a ship's
decor figures and Come Sail Away's crews at sea are Redguards (REGION_RACES[0]). A ship's crew of the sea's own traffic
is her waters' (A3). Recorded; the sea's region is WW-R's.

**A12 (record-only; B5). The update renamed and re-raced people past the Bay a save knows.** Each is named from their own
people's bank now: 15-37% of residents and 21-29% of keepers past the Bay have new names (Cyrodiil's most), and
residents past the Bay re-race. A courtship keeps the name and race it began with (`marriage.js` court), and the wedding
uses them. Recorded: the provinces' people are four days old.

## Lane B - the player's view and the room

**B3 (should-fix; recorded). A peer's copy of a companion past the Bay is another race than its owner's.** The owner
draws a person of their own as born; the wire carries the seed alone (`ls`), so a peer's copy, which knows no person, is
drawn where it stands. Fixing it needs the race on the record - a field beside `ls` in `net/wire.js` validFoeRecord and a
relay version - which is the relay's next release's, not this audit's. The ALLY-RACE comment that said the room sees
the same man is corrected (`foeBodies.js` ownPerson).

**B6 (minor; lore). The zones the game names a people in were flattened.** The Reach's Reachmen (`tamrielBiomes.js`
skyrimReach: "the Reachmen and their hagravens"; UESP Lore:Reachmen, of Breton blood) stood as Skyrim's Nords. The zones
whose people are their own stand them now (`provinceFolk.js` ZONE_FOLK): the Reach Breton-led, Reaper's March half
Khajiit (Lore:Reaper's March), Black Marsh's Blackwood about Gideon a third Imperial (Lore:Gideon), and Cyrodiil's
Blackwood about Leyawiin Argonians and Khajiit (Lore:Leyawiin). Read off the pixel by the walkers and the keepers (a
location's row, `folkOfLocation`), the census (`withZone`), a port's hands (their keeper's `home`), the foes and the
standing people.

**B7 (record-only). The reason for no Orcs was wrong.** DFU's banks do name Orcs - Monster1, for their lairs - but give no
Orc a full name, and Wrothgar's Orcs stand as its foes (`tamrielFauna.js`). Restated in `provinceFolk.js` and the record.

**B8 (record-only; at the base too). The talk engine's oath reads the region, not the walker.** `npcSession.js` reads a
mobile's `race`, and a walker's own race is `folk`; the oath falls to the region's people, and the Imperial bank's region
read (`world.js` raceOfCurrentRegion over RACE_BY_NAME_BANK) answers 'Imperial', which the oath table sends to the Nord's.
Recorded for the talk's own slice.

## Lane C - the pins, the mutants and the record

**C1 (bug). A gate was red.** `cards4b.json` C4b-race-ignored named the regulars' line the commit rewrote; re-aimed by
content, dead. Twelve more records re-aimed by the fixes (below) die.

**C4-C13 (the pins).** The shares within half a point and every race drawn (C4: a race of weight 1 could vanish); the
whole table against the record's (C5); a keeper's name (C6); a port's people's bodies and pictures and a yard keeper's
picture (C7); a census town whose people are the Nords (C8: Ebonheart's, a Dark Elf there in a Nord's picture); a guard's
face (C9); a port's hands of one trade two people (C10); a placed figure in Cyrodiil (C11); a sworn revenant's person
(C12); the draws, the census and the keepers as they shipped, literal (C13). Lane C's 17 mutants run again: 16 dead, one
equivalent (the variant search's order - the pictures' lists are disjoint).

**C14, C15 (record-only).** The names claim narrowed to the walkers, the residents and the keepers (a ship's hands are
named by her waters' bank, a foe by none). Five statements the commit made false are amended: World-Wide.md's WW1 line on
a resident, WW-R's "Imperials as Bretons", Shipyards.md's keepers, the Port-Ledger's REGIONAL-FOLK row, and the
record's own Mournhold sentence (Mournhold's people are the Bretons' by its climate; Ebonheart's walked Nords).

## Re-aimed (by content, all dead)

`cards4b.json` C4b-race-ignored; `dex7.json` DEX7-the-lizard-a-breton; `fb1012d_allyrace.json`
FB1012d-the-stamp-without-its-person; `legacy5.json` LEGACY5-spouse-not-in-household; `merchantyards1.json`
MERCHANT-YARDS-the-keepers-off-the-climate-alone; `merchantyards1_audit.json` AUDIT-MERCHANT-YARDS-R4-the-towns-region-unread;
`mwnpc10b.json` MWNPC10b-roster-unkept and MWNPC10b-crew-one-look; `mwnpc10c.json` MWNPC10c-race-unkept; `mwnpc12.json`
MWNPC12-orc-a-breton; `mwnpc8a.json` MWNPC8a-host-before-table; `rvn5.json` RVN5-stand-unstamped; `shipyards1.json`
SHIPYARDS-the-crewmaster-the-shipmaster; and `provincefolk.json`'s ten (PFOLK-a-quest's-person-lifted is
PFOLK-the-named-one-lifted: a quest's person is lifted now).

PINS MOVED: `test/world/merchantyards1.test.js` (the town's const holds its people, `folk`), `test/scenes/hostceiling.test.js`
(the naval host's ceiling, 6,125).
