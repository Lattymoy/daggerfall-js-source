# FIELD BUGS 2026-10-10 - five Discord suggestions

Five threads from the Discord's suggestions, handed over as screenshots. One carried two asks, and both are done. The
other four were set out for the owner, who handed them back: "You make the best decisions". Two are built
(REGIONAL-FOLK, TRUE-CURSE). The rations stay as the owner made them six days before, and the spell icons wait on their
author's permission.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Add Regional NPCs" - Daggerfall Unity's Regional NPCs, "NPC races varies between regions" (TheHalfinStream) | the walkers are DFU's: three classic sets (Breton, Redguard, Nord) by the climate's People, named by the region - so Sentinel and the Dragontail Mountains walked Breton and Nord bodies under Redguard names | done (REGIONAL-FOLK), a departure |
| 2 | "Bounty Board: Click order" - "if you spam click accept it just accepts the 4 in order. Focus moves to the cancel button so it just accepts - declines - accepts - declines the top one" (greazii) | a Take left the card on the notice it took, and Give up - one press - stood where Take had | fixed (SPAM-TAKE) |
| 3 | the same thread: "Also make 'Find me' the standard functionality on the world map when I first open it" (greazii) | the held map opened on the Bay at rest | done (FIND-FIRST) |
| 4 | "More spell icons please" - Spell Icon Overhaul, 148 icons (Harlander) | the picker's 69 are ICON00I0's; a pack is a third party's art | waiting on its author's permission (below) |
| 5 | "About rations..." - "limited to just 2 or 3 per shelf, and only available on general stores" (uselessKingh) | ENDLESS PROVISIONS, the owner's own call of 2026-10-04 | kept (below) |
| 6 | "True cursed item experience" - a curse that cannot be lifted, "a super powerful sword that drains a ton of your hp every second" (uselessKingh) | LOOT16: every cursed piece is lifted at a temple, and its drawbacks are mild by design | done (TRUE-CURSE), a departure |

## SPAM-TAKE: Take takes the board's notices in order (2)

`ui/bountyWindow.js` mountBountyBoard. A Take left the card on the notice it took, now held, and the held card's row
drew Give up - one press - in Take's place: the row is right-aligned (`BOUNTY_CSS` `.bounty-acts`), so the press after
a take gave the notice back, the next took it again, and a run of presses see-sawed on the top notice. It was not the
focus: the board keeps the focused act's class through a repaint (AUDIT 28 B11), and the Take it kept was gone.

Now a take moves the card on to the next open notice below it, around to the top (`nextOpenNotice`), so Take stands
where it stood and a run of presses takes the board in order - Enter as well, the focus carried to the next Take (read
before the host's own repaint inside the press, AUDIT FB1010 A2). With none open to move to (four taken, or hands full)
the card stays on the last taken and says `LANDED_LINE` - "Taken. Pick it on the left to share it or give it up." -
where its presses stood, so the press after the last take lands on words: never Give up, and never Share with party,
which in a party stood exactly where Take had and handed the bounty to every mate's ledger (AUDIT FB1010 A1). A pick of
the notice brings its presses back. Give up asks twice, as the journal's Abandon does ("Click again to give up"; a
notice picked elsewhere disarms it), and stands first in the row, at the card's left (`.bounty-acts .bounty-drop {
margin-right: auto; }`). And the window is one height (`min(600px, 92vh)`): the notice reads in its own scrolling page
with its presses at the card's foot, and the list scrolls beside it (on a phone, above it), so Take stays put however
long the story or the list (AUDIT FB1010 A3). Seen in Chromium: six presses at Take's first place, on both skins, at
1280x720, 1920x1080, 375x812 and 820x1180, alone and in a party, holding none or two already - every run took the open
notices in order and touched nothing else, and four Enters took four.

The board is the port's (BOUNTY1, Port-Ledger A; DFU has none) and the fix is inside its window, so every host that
mounts it has it: world.js's `openBoardWindow`, which worldModes.js reaches through `bountyHost.openBoard`; exterior.js
(the fixed city) keeps DFU's board, and dungeonContext.js stands none. Pinned by `test/fb1010_spamtake.test.js` (5, on
the real host's board, attached as `ui/bountyDoor.js` attaches it); `tools/mutants/fb1010.json`.

## FIND-FIRST: the Enhanced world map opens on me (3)

`ui/heldMap.js` `_findsMeFirst`. FINDME (`11-Multiplayer/Wild-Zone.md`) put a button left of Close: the view glides to
my pixel at the find's zoom and a red cross blinks over it for three seconds. The player's own world map now opens as
that press. On the opening's first laid-out tick, beside ZONE-FIRST (which still wins in the zone), `_findMe` runs when
the host asked (`openOnMe`, said by `world.js:"_travelMap.openOnMe?.();"` alone, in toggleTravelMap - the door of every
open of the player's own: the map key, the journal's Find Place, the Party tab's Map, the Overworld block's and the
travel controls' Map, PARTY-TRAVEL's) and the open is for nothing else:

- a journal's place (`gotoPlace`): the map is on the place;
- a journey Travel Options centres (MAP2, at the open's zoom), or one it asks to resume;
- a teleport's pick (the Mages Guild's, a portal stone's): the whole Bay;
- a driver's map (Immersive Travel's carriage or ship).

The Bay's fit (TAMRIEL1) is still the sheet's home, and the glide starts there. A paper that changes size under the
open - the Morrowind arm taking the sheet a few ticks late, or giving it back unfitted (MAP-FIT1) - keeps the map point
at its middle (`_layout`); it kept its top-left, and the glide landed 224 by 137 paper pixels off me (AUDIT FB1010 B1 -
MAP2's journey centring and a journal's place shared the root and are mended with it). The held map is the Enhanced
skin's with the Enhanced map on (`ui/mapSkin.js` heldMapChosen); the classic map is DFU's TravelMapWindow, has no
`openOnMe`, and keeps DFU's open (the province, my region flashing). THE FOUR HOSTS: world.js wired; exterior.js mounts
no travel map; worldModes.js and dungeonContext.js open none of their own - indoors the map key is not offered, and the
journal's and the Party tab's doors are refused at world.js's (DFU's cannotTravelIndoors). Not a departure from DFU (the
held map is the port's, MAP1). There is no switch: a scroll or a pinch is the way back to the Bay, and a switch is the
owner's to ask for. Pinned by `test/fb1010_findfirst.test.js` (5); `tools/mutants/fb1010.json`. Two source pins shaped
the host's line: the map's `onTravel` stays the first key of the build (fb0929d_toroads, partytravel), so the word is a
call on the window built, as `gotoPlace` is.

## REGIONAL-FOLK: a Redguard region's walkers are Redguards (1)

`characters/mobilePerson.js` walkerRace. DFU dresses a town's walkers by the climate's People (PopulationManager.cs:94:
the deserts and the rainforest Redguard, the mountains Nord, every other climate Breton) and names them by the region
(MobilePersonNPC.cs:214, FALL.EXE's `REGION_RACES`: Breton or Redguard). Where the two disagree the walker's body and its
name disagree: Sentinel's temperate streets and the Dragontail Mountains walked Breton and Nord bodies under Redguard
names (the mismatch Vanilla Enhanced's makers noted, and the reason DFU's race replacers exist). The mod's page could
not be read from this environment (nexusmods.com does not resolve here), so this is the port's own reading of the ask,
not the mod's code: the race FALL.EXE gives the region wins where it is Redguard, and every other region keeps the
climate's, as DFU's - High Rock's mountains still walk Nords.

One rule, asked by every population (ONE DFU MEMBER, ONE EXPORT - the climate's table was written three times, now
once, `RACE_OF_PEOPLE` beside the sprite tables): the street's TownPopulation in both exterior hosts (world.js,
exterior.js), the living world's census (`systems/livingWorld/census.js` mintResident), and - with Roleplay & Realism's
Variant Residents on, its default - its house residents (`systems/rrVariants.js` rrVariantPerson asks walkerRace,
handed the region by worldModes.js's interior; R&R's GetClimateRace, `rrClimateRace`, reads the one table - AUDIT
FB1010 C3). dungeonContext.js stands no townsfolk. The body and the talk portrait follow the race (the face tables are
the race's); the name and the talk's race already read the region. No new art: the three classic sets, which the other
races still lack in this tree (the Morrowind bodies dress no townsfolk; Khajiit, Argonians and elves on the street need
sprites and their author's permission).

THE RESIDENTS ARE RE-DRESSED, ONCE. The census mints a resident again from their seed whenever it is asked, so a
Redguard region's residents a save already knew keep their names, their days and their regard, and change body and
portrait at this update - the Living World's "identity for life" (`06-Systems/Living-World.md` decision 4) bends here
once. A courtship begun before it kept the old look in its copy; the wedding asks the census for the resident as they
are now (`residentNow`, world.js's census through `scenes/legacyHost.js` weddingNow; the copy only where no town can be
minted - AUDIT FB1010 C1). A spouse already wed keeps the look they wed with: they are the line's, not the census's.
Port-Ledger A, REGIONAL-FOLK. Pinned by `test/fb1010_regionalfolk.test.js` (5); `tools/mutants/fb1010.json`.

## TRUE-CURSE: a damned Legendary weapon, which no temple lifts (6)

`systems/lootRarity.js` (DAMNED_IN, DAMNED_DRAWBACK, isDamned, damnPiece, damnPass), `systems/lootCurse.js`
liftRefusal. One cursed Legendary weapon in four is DAMNED, in its own pass after every draw a door makes - the curse's,
the socket's and the late finds' (`damnPass`, both doors: `rollLootRarity` and `foeLootCap.js` rollCorpseKit;
Loot-II-Arc law 9), so every other curse and socket draws as it drew (AUDIT FB1010 E3: the damning was drawn inside the
curse's pass at first, and every later curse and socket of the door drew one place on). `damnPiece`:

- raises the curse's own line to the very top of its band, its worth on the price with it, where a curse's is anywhere
  in the top half;
- puts DFU's own Health Leech: Whenever Used in the drawback's place - 8 health from the wielder at every strike, 16 at
  every use (HealthLeech.cs:84-89; `scenes/hostEnchant.js` bills it in all four hosts since AUDIT 39). It is the
  catalogue's row that bites all the time, which LOOT16 left out of its table, so no other curse draws it and it marks
  the piece.

Known, its tier reads "Damned Legendary", and the temple will not lift it: its row on the temple's page shows no price
and its Lift press reads "Damned" (its title: "Damned - no temple can lift this curse"; AUDIT FB1010 D2). Unknown, it is
said to be nothing (the refusal comes after Identify's, as the tier word does). Taking it off ends the bite, as any
curse's: a blade for a fight's few blows - a boss wounded - then put away. A Regenerate Health spell or piece eases the
bill, as the player asked. On the arena's sand the bite holds the wielder at 1, as every blow there: the floor's dungeon
mounts no enchantment context of its own (`enchantCtx: false`), so both exterior hosts' enchantment sinks hand the
bout's spare to the damage door (`arenaBouts.playerSpare`; AUDIT FB1010 D1 - before, a Health Leech blade, made or
found, could kill on the sand, and a Legacy character's fall there was a permadeath).

The item law (`systems/itemLaw.js`, the account service's too - it bundles `lootRarity.js` and deploys itself when it
changes) stands behind a damned curse on a Legendary weapon and nowhere else (validCurse). No new field: a damned curse
is a curse whose drawback is the damned row. The Test Room lays one, known, last (Wyrmbane, `systems/testRoom.js`); its
cursed Legendary stays LOOT16's. LOOT16's own law and its pins stand as they were; LR3's count of the Test Room grew by
the damned blade (`test/lr1_lootrarity.test.js`, PIN MOVED). Port-Ledger A, TRUE-CURSE. Pinned by
`test/fb1010_truecurse.test.js` (8); `tools/mutants/fb1010.json`.

## Kept: the rations (5)

ENDLESS PROVISIONS (`01-Overview/Integration-2026-10-04.md`; Port-Ledger A), the owner on 2026-10-04: "campfires should
be unlimited, rations should be available in stores where it makes sense and unlimited as well". A General Store's and
a Pawn Shop's counter shelf carries 99 Rations whatever its tier (`systems/survival/items.js` ensureEndlessProvisions,
`systems/shopStock.js` stockShopShelf), and online a purchase stands them again. Kept: the owner's own call is six days
old and was made for the online game, the thread's two votes split one for and one against, and the shelves the player
remembers are still there - Climates & Calories' 2 to 5 Rations on every General Store shelf behind the counter. If it
is ever reverted: take the top-up off the counter (and the Pawn Shop's) and Rations out of `isEndlessStock`, and the
shelves are C&C's again.

## Waiting: Spell Icon Overhaul (4)

The picker offers ICON00I0's 69 icons (`ui/spellIconPickerWindow.js`; `ui/enhancedPorts.js` iconPickerView), and the
spell maker keeps every icon inside them (`systems/spellMaker.js` buildCustomSpell wraps the index by SPELL_ICON_COUNT).
Spell Icon Overhaul is a third party's art. Every pack this tree carries was handed over by the owner, nearly all on his
word of their authors' permission (`01-Overview/Mod-Registry.md`; some authors' own words are still RECORD OPEN there),
and none has been handed over for this one, so nothing is vendored. With it, the pack ships as the
others do (a registry row, `public/art/`), and a spell's stored icon needs a number space past 68 for the pack's.

## AUDIT FB1010 (2026-10-10, the owner: "Audit everything")

Five cold lanes on a frozen snapshot of the branch (037d209a): the bounty board, the held map, the walkers, the damned
curse, and the records. Each finding was traced from a real caller before it was fixed; the lanes reproduced the
behaviour ones with node against the real modules and, for the board, in Chromium with the real sheet.

| | Lane | Finding | Done |
|---|---|---|---|
| A1 | board | HIGH: in a party, the press after the last take landed on Share with party, which stood exactly where Take had - the bounty handed to every mate's ledger | the last take's card says a line where its presses stood; a pick brings them back |
| A2 | board | MED: in the game the focus was not carried to the next Take - the host's own repaint inside the press blurred it, and the pin passed on a path without the door's `attach` | the press reads its focus first; the tests attach as the door does |
| A3 | board | MED: Take moved as the window grew (the note, the list) and, on a phone, as the card's text did | one window height; the notice's page scrolls above its presses |
| B1 | map | MED: the open's glide landed off me when the Morrowind arm took the sheet late or gave it back (MAP-FIT1); MAP2's centring and a journal's place shared the older root | a re-laid paper keeps its middle |
| B2 | map | MED: the record's mutant count was wrong, and the driver's guard had no pin | counted; pinned |
| C1 | walkers | MED: a courtship an older version saved wed a Breton where the street showed a Redguard | the wedding asks the census |
| C2 | walkers | MED: Living-World and Roleplay-Realism still said the climate's alone, and the re-dress was recorded nowhere | amended, here and there |
| C3 | walkers | LOW: R&R wrote the rule again | it asks walkerRace; its GetClimateRace reads the one table |
| D1 | curse | HIGH, older (a made Health Leech blade had it since AUDIT 39), reached by found loot now: the bite could kill on the arena's sand, a Legacy permadeath | both exterior hosts' enchantment sinks carry the bout's spare |
| D2 | curse | LOW: the temple's page priced a curse it will not lift | no price |
| E3 | records | the damning drew inside the curse's pass, so every later curse and socket of the door drew one place on (law 9) | its own pass, after every draw a door makes |
| E | records | "every pack came with its author's permission"; the indoors key; the Lift press's words; the hosts' line; Tamriel, Held-Map-Arc, Living-World, Roleplay-Realism, Loot-II-Arc and Testing.md's audit23 row stale; the patch notes' caveats (the Enhanced map; R&R's Variant Residents); two code comments | corrected |

The other lists aimed at the files this branch touched were run on it as well: loot16, rr2, auditloot, auditloot2,
audit28, em1 and auditmap (281 dead), then the 42 more aimed at the board, the legacy host, the census, the corpse kit,
the Test Room, the Reforge window, the lifting, the walkers' tables and R&R (1,488 dead, 3 equivalent as recorded).
Pre-existing survivors met on the way, each judged again alone on main and surviving there the same, left as they stand
- none is in a file or a test this branch touches but the first two: `loot16.json` LOOT16-a-row-of-nothing (Bad
Reactions From fits every piece, so the curse's row filter is never empty), `auditmap.json` glide-unclamped,
`audit625.json` AUDIT625-D3-a-range-the-tools-cannot-read, `auditsetc.json` AUDIT-SET-the-card-never-fitted,
`loot18.json` LOOT18-the-counter-at-a-buy, `loot15.json` LOOT15-the-minute-drops-the-host, `legacy7.json`
LEGACY7-model-rewritten and `legacy7wed.json` LEGACY7W-partner-dead-or-lineless; and `auditlegacy3.json`
AUDIT-LEGACY-III-A2-newer-save-drops-the-stores-facts does not parse on main either. Records this branch's lines moved,
re-aimed by content: `loot16.json` LOOT16-wire-uncarried, -the-curse-said-unknown, -the-curse-never-said, -lift-unknown
and -the-line-worthless; `rr2.json` RR2-7 (R&R's Nord arm, now the one table's). Pins moved: LR3's Test Room count
(`test/lr1_lootrarity.test.js`), AUDIT 23's People map (`test/audit23_hosts.test.js`). `tools/mutants/fb1010.json`: 50,
all dead.
