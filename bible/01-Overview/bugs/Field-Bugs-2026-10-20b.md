# FIELD BUGS 2026-10-20b - no Abyss Dungeon at sea

> Renumbered at the merge of main: main's FIELD BUGS 2026-10-20 (QUEST-NAME-ONE) took the date; the test and the
> mutant record were renamed with it (`fb1020b_`), and the relay's version moved past main's `world229`-`world232`.

One report from the owner, read on the code as it stands at main's `6906e5672`. The Abyss Dungeon is the port's own
(`11-Multiplayer/Super-Dungeons.md`). DFU has no Super dungeon, so there is no DFU member to depart from. The region a
player stands in is DFU's own reading (`PlayerGPS.CurrentRegionIndex`, `formats/mapsFile.js` `getRegionIndexAt`), and
it is unchanged.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Mac: "Abyss Dungeons dont seem to be spawning anymore" | The census chose the region whose channel held the most accounts, and the sea is one region (31, High Rock sea coast) with no town. A crowd at sea raised a Hollow that no client could stand by any city, so it stood nowhere for its 48 hours | fixed (SD-SEA) |

## SD-SEA: a Hollow never rises where no town stands

`src/net/superDungeon/sdLaw.js` `pickSdRegion`, `src/scenes/superDungeon/sdHost.js` `hollowOf`.

THE REPORT. No Abyss Dungeon to be seen in the world.

READ FIRST. The relay was checked before the client. The live relay answers `world225` on `/health`. Over the pins'
fake objects the hub's alarm, its director and its fan behave as designed: a player's hello through a hub shard arms
the hub, the first beat and the rise come on time, and the record reaches the shard's socket. Every Super Dungeons test
passes. So the director does raise Hollows. The question was where.

FOUND. The director raises a Hollow in the region whose channel holds the most distinct verified accounts
(`pickSdRegion`, section 3 of the arc). A client's channel is the region of the pixel it stands on by the politic map.
On the freeware's data (`tools/fetch-data.sh`):

- politic 64 marks every water pixel of the Bay and the ocean, 180,215 of the map's 500,000 pixels, and
  `getRegionIndexAt` reads it as region 31, High Rock sea coast. Every player out on the water stands in region 31's
  channel.
- Region 31 has three places and no city, town or village. Of the 62 regions, 19 have no populated place: 31, Cybiades
  (61, one place) and seventeen with no place at all.
- Every client stands the Hollow by the record's region's cities (`systems/superDungeon/sdSite.js` `sdCities`). For
  region 31 that list is empty, so `findSdSite` finds nothing, and the host logs *"[sd] slot N: the world offers no
  Hollow (no site)"* and stands nothing.

Each region with a town placed a Hollow for every slot tried. So whenever the crowd at sea was the largest, the Hollow
the hub raised was in region 31 and stood nowhere: no omen, no rumour, no door. The Timers show no row for a Hollow
that has only risen, so the panel showed nothing for its 48 hours and then counted the 2-hour rest. The next rise
asked the same census. The more of the game took place at sea, the likelier that was.

CHANGED.

- **The census never chooses a region with no town.** `SD_TOWNLESS_REGIONS` lists the 19, and `pickSdRegion` qualifies
  only regions outside it. A crowd at sea is not counted. The fullest region with a town gets the Hollow, the last
  region's rest and the slot's tie roll as before, and with none the Hollow rises by the Bay's great cities (`-1`). The
  relay holds no map files, so the list is written in the law, and the ARENA2 pin holds it to MAPS.BSA.
- **A client stands a record that names such a region** as it stands `-1`: by the great cities, by the slot's roll,
  the same pixel on every client of this build. This covers a Hollow the old relay raised at sea before this one
  deploys.

Not changed: the Discord herald names the record's own region. A Hollow the old relay raised at sea is posted as
found, fallen or faded *in the High Rock sea coast*. This relay never raises another, so the post was not reworded
for one record.

The relay is `world233` (`world226` on its branch, renumbered past `world226`-`world232` at the merges), and no frame changes shape. The relay and the clients may deploy in either order.

Pins: `test/net/superDungeon/fb1020b_sdsea.test.js`; `tools/mutants/fb1020b_sdsea.json` (5, all dead). The arc's record is
`11-Multiplayer/Super-Dungeons.md` SD-SEA.
