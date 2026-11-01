# The enhanced maps: one window, three sheets

On the enhanced skin the dungeon automap, the town map and the world map are one window, the held parchment
(`10-UI/Held-Map-Arc.md`), with a tab per sheet. Which tabs show depends on where the player stands. The automap is a
floor-based plan (or 3D, `10-UI/Dungeon-Map-3D.md`), and the town plan is traced and colored in our hand. The classic
skin keeps DFU's three windows.

## How it works

**Tabs** (`src/systems/map/mapTabs.js`). The place is derived from the flags every host keeps, never declared by a host
(`mapContextOf`): inside a dungeon, inside a building, in a town (the map pixel holds a location), or the wilderness.

| where | tabs |
|---|---|
| dungeon | automap |
| building | automap |
| town | town, world |
| wilderness | world |

The AutoMap key opens the map wherever the player is. On the enhanced skin the TravelMap key is a second door into the
same window, landing on the world tab. In a town the travel key's window also holds the streets
(`src/scenes/exteriorAutomapToggle.js` `townHere`, both keys' streets from `src/ui/town/townMapDoor.js`
`townSheetBag`). The town key does not hand the world sheet over, because DFU's travel guards (enemies near, a pending
offer, sunlight, a racial block) run when the bay opens. Either key closes the window on every sheet.

**The sheet contract** (`src/ui/map/mapStrip.js` `SHEET_MEMBERS`): the space (`size`), the ink (`ensure`, `staticKey`,
`paintStatic`, `paintOverlay`), the pointer (`pickAt`, `hoverLabel`, `mark`), keys, and optional `findMe` and `me`.
The window keeps the parchment, hands, pan, zoom and closing, asks the sheet for the rest and never asks which sheet is
up. The tab strip is inked in paper space, so it follows the paper on the Morrowind arms. A window holds a sheet only
where it was given data to ink it; a place with none answers `empty` at the door.

**Floors** (`src/systems/automap/automapFloors.js`). Daggerfall has no floor field, so storeys are derived from the
revealed rows' triangles. Triangles within `LEVEL_NY` of flat vote for a storey; triangles the player can walk
(`FLOOR_NY`, the motor's slope limit) are drawn. A gap wider than `FLOOR_MIN_GAP` starts a new storey, and each
storey's height is the area-weighted mean of its voters. A ramp is drawn on both storeys it joins. Each storey's plan
is the outline of its covered cells, traced by the same functions that ink the bay's coast. The save is unchanged.

**The automap sheet** (`src/ui/automap/automapSheet.js`, ink `src/ui/ink/inkAutomap.js`). Walls are the outline of
what was revealed, the wash is the floor walked this run, a caret shows the player's facing, a beacon marks the way in,
and the floor strip runs down the right edge. Stairs are drawn and a click takes them.

**The town sheet** (`src/ui/town/townSheet.js`, ink `src/ui/ink/inkTown.js`). Built-up pixels are traced as islands in
the street, in four quarters with classic's own hues as watercolor washes (`src/ui/town/townQuarters.js`, the one home
both skins ask). Names are lettered in their quarter's ink with a tick on the building; a plate the layout solver gives
up on is lettered `STAR_PLATE` ("*"), with the name on hover, as DFU does. Marks:
- online homes: "Your home" in the player's ink, another player's in parchment; the bank house the character bought
  is "Your house" in its own town (`src/ui/town/townMapMarks.js`, `paintHomeMark`);
- a house with a player's trader is filled blue (`src/systems/vendorHouses.js`, read once in `VENDOR_HOUSES_READ_S`
  per region, keyed by MapId and house key, past the Bay too);
- quest rings and the party.

**Find me** asks the sheet that is up (`findMe`): the bay zooms to the player's pixel, a town to the player's caret at
street zoom, a dungeon back to the player's floor. The cross is the window's, painted through the sheet's `me`, and
holds the paper's edge when the player stands outside the town's blocks. A sheet with no player answers null and
nothing moves.

**The Imperial City** (`src/ui/town/imperialSheet.js`). Where the host hands a capital slice, the town sheet is the
whole city from `src/world/imperialCity.js`'s plan: Lake Rumare, the walls and gates, the roads, districts and
landmarks. Zoomed in near the player it draws the district's own fabric, built a cell a tick, and the slice's own
Daggerfall blocks. A capital's closed byte (`CAPITAL_CLOSED_BYTE`) paints nothing on either skin.

## Rules

- One map window with a tab toggle instead of three keybinds; the world map is not reachable from a dungeon, and the
  town map not from inside (Mac).
- The automap is 2D and floor based (Mac); the 3D sheet is the default view of it (`10-UI/Dungeon-Map-3D.md`).
- Keep our own version of classic's colored buildings, and enhance the location names (Mac).
- Mark player housing on the town plan, on the building, no bigger than the player's caret (Mac).
- A trader's house is blue on the town plan (Mac).
- A sheet lays no word under the tab strip or the thumbs; colors on the plan come from classic's data, measured to
  stay apart on the parchment.
- `MAP_SHEETS` and `AVAILABLE` move together; `test/systems/map/maptabs.test.js` fails one added without the other.

## Daggerfall Unity

DFU's automap is a 3D view with a cut plane the player slides (`Automap.cs`); its town map paints FLD bytes in four
colors under a rotating camera (`ExteriorAutomap.cs`, `DaggerfallExteriorAutomapWindow.cs`); its travel map holds no
town plan. On the enhanced skin we replace all three with sheets on one window, keep classic's quarter colors and the
"*" plate, and add the streets to the travel key's window. The classic skin keeps DFU's windows, which also paint the
capital closed byte as nothing.

## Code and tests

- `src/systems/map/mapTabs.js` - which tabs a place offers
- `src/ui/map/mapStrip.js` - the sheet contract and tab strip
- `src/systems/automap/automapFloors.js` - derived storeys
- `src/ui/automap/automapSheet.js`, `src/ui/ink/inkAutomap.js` - the dungeon sheet
- `src/ui/town/townSheet.js`, `src/ui/ink/inkTown.js`, `src/ui/town/townQuarters.js` - the town sheet
- `src/ui/town/townMapMarks.js`, `src/systems/vendorHouses.js` - homes and traders on the plan
- `src/ui/town/imperialSheet.js` - the Imperial City
- `test/systems/map/maptabs.test.js` - the tab law
- `test/ui/town/town_marks.test.js` - homes, traders
- `test/ui/town/fb1020c_streetstab.test.js`, `test/ui/ink/fb1020c_starplate.test.js` - streets on the travel key, "*"
- `test/ui/town/fb1019f_findme_town.test.js` - Find me per sheet
- `test/ui/town/ic_townmap.test.js`, `test/ui/town/ic_citymap.test.js` - the Imperial City
- `tools/enhancedMapProbe.mjs` - real windows in Chromium over fixtures

## Open

- Whether the town plan is the right way up against the world is for a real city's eye; tests show the plan and names
  agree.
- The bay tab from the town key waits on moving DFU's travel guards from open time to commit time (Mac's call).
