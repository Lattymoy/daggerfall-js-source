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
where it stood and a run of presses takes the board in order - Enter as well, the focus carried to the next Take. With
none open (four taken, or hands full) the card stays on the last taken. Give up asks twice, as the journal's Abandon
does ("Click again to give up"; a notice picked elsewhere disarms it), and stands first in the row, at the card's left
(`.bounty-acts .bounty-drop { margin-right: auto; }`), so the press after the fourth take lands on nothing. The board is
the port's (BOUNTY1, Port-Ledger A; DFU has none) and the fix is inside its window, so every host that mounts it (world.js,
worldModes.js) has it; the fixed city keeps DFU's board. Pinned by `test/fb1010_spamtake.test.js` (4, on the real host's
board); `tools/mutants/fb1010.json`.

## FIND-FIRST: the world map opens on me (3)

`ui/heldMap.js` `_findsMeFirst`. FINDME (`11-Multiplayer/Wild-Zone.md`) put a button left of Close: the view glides to
my pixel at the find's zoom and a red cross blinks over it for three seconds. The player's own world map now opens as
that press. On the opening's first laid-out tick, beside ZONE-FIRST (which still wins in the zone), `_findMe` runs when
the host asked (`openOnMe`, said by `world.js:"_travelMap.openOnMe?.();"` alone, in toggleTravelMap - the key and
the journal's door) and the open is for nothing else:

- a journal's place (`gotoPlace`): the map is on the place;
- a journey Travel Options centres (MAP2, at the open's zoom), or one it asks to resume;
- a teleport's pick (the Mages Guild's, a portal stone's): the whole Bay;
- a driver's map (Immersive Travel's carriage or ship).

The Bay's fit (TAMRIEL1) is still the sheet's home, and the glide starts there. The classic skin's map is DFU's
TravelMapWindow, has no `openOnMe`, and keeps DFU's open (the province, my region flashing). THE FOUR HOSTS: world.js
wired; exterior.js mounts no travel map; worldModes.js and dungeonContext.js open none of their own - indoors the key
reaches world.js's door and is refused there (DFU's cannotTravelIndoors). Not a departure from DFU (the held map is the
port's, MAP1). There is no switch: a scroll or a pinch is the way back to the Bay, and a switch is the owner's to ask for. Pinned by `test/fb1010_findfirst.test.js`
(3); `tools/mutants/fb1010.json` (13, all dead). Two source pins shaped the host's line: the map's
`onTravel` stays the first key of the build (fb0929d_toroads, partytravel), so the word is a call on the window built, as
`gotoPlace` is.

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
exterior.js), the living world's census (`systems/livingWorld/census.js` mintResident), and Roleplay & Realism's house
residents (`systems/rrVariants.js` rrVariantPerson, handed the region by worldModes.js's interior). dungeonContext.js
stands no townsfolk. The body and the talk portrait follow the race (the face tables are the race's), the name and the
talk's race already read the region. No new art: the three classic sets, which the other races still lack in this tree
(the Morrowind bodies dress no townsfolk; Khajiit, Argonians and elves on the street need sprites and their author's
permission). Port-Ledger A, REGIONAL-FOLK. Pinned by `test/fb1010_regionalfolk.test.js` (4); `tools/mutants/fb1010.json`.

## TRUE-CURSE: a damned Legendary weapon, which no temple lifts (6)

`systems/lootRarity.js` (DAMNED_IN, DAMNED_DRAWBACK, isDamned, cursePiece), `systems/lootCurse.js` liftRefusal. One
cursed Legendary weapon in four is DAMNED, decided by the curse's last draw (so every other curse is drawn as LOOT16
drew it):

- its curse line is at the very top of its band, where a curse's is anywhere in the top half;
- its drawback is DFU's own Health Leech: Whenever Used - 8 health from the wielder at every strike, 16 at every use
  (HealthLeech.cs:84-89; `scenes/hostEnchant.js` bills it in all four hosts since AUDIT 39). It is the catalogue's row
  that bites all the time, which LOOT16 left out of its table, so no other curse draws it and it marks the piece;
- no temple lifts it: known, the priest's row says "Damned - no temple can lift this curse". Unknown, it is said to be
  nothing (the refusal comes after Identify's, as the tier word does);
- known, its tier reads "Damned Legendary".

Taking it off ends the bite, as any curse's: a blade for a fight's few blows - a boss wounded - then put away. A
Regenerate Health spell or piece eases the bill, as the player asked. The item law (`systems/itemLaw.js`, the account
service's too - it bundles `lootRarity.js` and deploys itself when it changes) stands behind a damned curse on a
Legendary weapon and nowhere else (validCurse). No new field: a damned curse is a curse whose drawback is the damned
row. The Test Room lays one, known, last (Wyrmbane, `systems/testRoom.js`); its cursed Legendary stays LOOT16's.
LOOT16's own drawback sweep moved with the law (`test/loot16_curses.test.js`, PIN MOVED: a damned one is a Legendary
weapon's, at the top of its band). Port-Ledger A, TRUE-CURSE. Pinned by `test/fb1010_truecurse.test.js` (5);
`tools/mutants/fb1010.json`.

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
Spell Icon Overhaul is a third party's art. Every pack this tree carries came with its author's permission, handed over
(`01-Overview/Mod-Registry.md`), and none has come for this one, so nothing is vendored. With it, the pack ships as the
others do (a registry row, `public/art/`), and a spell's stored icon needs a number space past 68 for the pack's.
