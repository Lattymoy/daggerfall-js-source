# FIELD BUGS 2026-10-10 - five Discord suggestions

Five threads from the Discord's suggestions, handed over as screenshots. One carried two asks; both are done. The other
four ask to change what the owner decided, or for art the tree does not carry, and each is set out below for the owner.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Add Regional NPCs" - Daggerfall Unity's Regional NPCs, "NPC races varies between regions" (TheHalfinStream) | the walkers are DFU's: three classic sets (Breton, Redguard, Nord), chosen by the climate's People | not taken up - the owner's call, below |
| 2 | "Bounty Board: Click order" - "if you spam click accept it just accepts the 4 in order. Focus moves to the cancel button so it just accepts - declines - accepts - declines the top one" (greazii) | a Take left the card on the notice it took, and Give up - one press - stood where Take had | fixed (SPAM-TAKE) |
| 3 | the same thread: "Also make 'Find me' the standard functionality on the world map when I first open it" (greazii) | the held map opened on the Bay at rest | done (FIND-FIRST) |
| 4 | "More spell icons please" - Spell Icon Overhaul, 148 icons (Harlander) | the picker's 69 are ICON00I0's; a pack is a third party's art | not taken up - needs its author's permission, below |
| 5 | "About rations..." - "limited to just 2 or 3 per shelf, and only available on general stores" (uselessKingh) | ENDLESS PROVISIONS, the owner's own call of 2026-10-04 | kept - the owner's to revert, below |
| 6 | "True cursed item experience" - a curse that cannot be lifted, "a super powerful sword that drains a ton of your hp every second" (uselessKingh) | LOOT16: every cursed piece is lifted at a temple, and its drawbacks are mild by design | not taken up - the owner's call, below |

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
reaches world.js's door and is refused there (DFU's cannotTravelIndoors). Not a departure from DFU (the held map is the port's, MAP1). There is no switch: a scroll or a
pinch is the way back to the Bay, and a switch is the owner's to ask for. Pinned by `test/fb1010_findfirst.test.js`
(3); `tools/mutants/fb1010.json` (13, all dead). Two source pins shaped the host's line: the map's
`onTravel` stays the first key of the build (fb0929d_toroads, partytravel), so the word is a call on the window built, as
`gotoPlace` is.

## The owner's calls

### Regional NPCs (1)

The walkers are DFU's (`systems/townPopulation.js` _randomiseNPC, `characters/mobilePerson.js` PERSON_TEXTURES): three
races by two genders by four classic archives, the race a town's climate's People (`formats/mapsFile.js`
getWorldClimateSettings: the deserts and the rainforest Redguard, the mountains Nord, every other climate Breton). A
walker's name and the talk's race read the region instead (`REGION_RACES`, FALL.EXE's: Breton or Redguard). No other
race has a walker's sprite in the tree: the Morrowind bodies (`formats/mwNpc.js`) need the player's own Morrowind data
and dress no townsfolk, and the voxel race rigs stand only behind `?voxelfolk`. The mod's page could not be read from
this environment (nexusmods.com does not resolve here), so what it ships, and on what terms, is not known. Two ways,
both the owner's:

- the three classic sets, re-read by region - a walker's body by the region's race rather than the climate's, so a
  Hammerfell town outside the desert walks Redguards. A small departure, nothing vendored;
- the mod's own sprites for the other races, which need its files and its author's permission, as every other pack
  had (`01-Overview/Mod-Registry.md`; `01-Overview/Port-Doctrine.md`'s art rule).

### Spell icons (4)

The picker offers ICON00I0's 69 icons (`ui/spellIconPickerWindow.js`; `ui/enhancedPorts.js` iconPickerView), and the spell
maker keeps every icon inside them (`systems/spellMaker.js` buildCustomSpell wraps the index by SPELL_ICON_COUNT).
Spell Icon Overhaul is new art and a reassignment of the classic spells' icons. It would be vendored as the port's other
packs are, with a Mod-Registry row and its author's permission handed over, and a spell's stored icon would need a number
space past 68 for the pack. Waiting on that permission.

### Rations (5)

ENDLESS PROVISIONS (`01-Overview/Integration-2026-10-04.md`; Port-Ledger A), the owner on 2026-10-04: "campfires should
be unlimited, rations should be available in stores where it makes sense and unlimited as well". A General Store's and
a Pawn Shop's counter shelf carries 99 Rations whatever its tier (`systems/survival/items.js` ensureEndlessProvisions,
`systems/shopStock.js` stockShopShelf), and online a purchase stands them again. The "2 or 3" the player remembers is
Climates & Calories' own shelf (`provisionsStock`: 2 to 5 on every General Store shelf, with the arc on), which still
stands under the counter's top-up. Reverting is the owner's: take the top-up off the counter (and the Pawn Shop's), and
Rations out of `isEndlessStock`, and the shelves are C&C's again.

### True cursed (6)

LOOT16 (`06-Systems/Loot-II-Arc.md` section 8): one Rare or Legendary in twelve is cursed - a bonus line from the top
of its band and one drawback, none of them a drawback that bites all the time - and a temple's Cure Disease priest lifts
it for a quarter of its value (300 at the least), the line kept. Taking the piece off ends the drawback. The ask is a
new kind of piece: a curse no temple lifts, its drawback a heavy health drain while it is worn, worth wearing for a
moment. How often it drops, what it pays, how hard it drains, and what the online item law (`systems/itemLaw.js`, which
already allows a lifted curse's extra line) must know of it are design, the owner's.
