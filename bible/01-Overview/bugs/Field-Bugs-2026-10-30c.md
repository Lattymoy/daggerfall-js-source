# FIELD BUGS 2026-10-30c - the deck over the road (DECK-ROAD)

The Discord, the "Outside area considered inside" thread, after YARD-DECK (`Field-Bugs-2026-10-30b.md` section 2): "The
issue got somewhat solved but now this happens, it's clearly not on the road, it's still on the balcony of the house",
and "even the middle area is considered road". Newcester, the decorator saying "That is the road. Keep the street and its
paths clear." on a house's deck. Read on main's `fc8754593` with the freeware's data (`tools/fetch-data.sh`). The pins
are `test/world/fb1030c_deckroad.test.js`, the mutants `tools/mutants/fb1030c_deckroad.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | A piece on a house's balcony refused as "the road" | ROAD-LOT read the road's tiles under a piece at any height, and the town's road runs under some houses | DECK-ROAD |

## 1. The deck over the road (DECK-ROAD)

FOUND. FB1001 ROAD-LOT refuses a piece whose ground meets a road tile of the town (`yardRoadsOf`, PlayerMotor.OnPathTile's
records 46, 47 and 55). It asks the ground under the piece, not what the piece stands on. Daggerfall lays some houses on
road tiles. Of Newcester's four residences with a deck, one stands it over the road: the house in ALCHAL00 (record 3,
ARCH3D 419, a House2), its deck at 3.22 m over a 6.4 m by 3.2 m strip of road (record 46). A piece in the deck's middle
that reaches 1.6 m toward the street meets the strip.

MEASURED. Over BLOCKS.BSA's town blocks: of 8,064 residences (a house for sale, House1 to House6), 1,114 stand a deck at
4 m or lower, and 175 of those stand part of it over road tiles. Past the Bay the capitals lay the same blocks: their
slices stand 30 such houses, in Solitude, Mournhold, Alinor, Falinesti, Torval and Helstrom.

FIXED. A piece whose foot stands on its house's deck (a deck its ground meets, at or under its foot) stands on a road
square only where its ground passes the house's own ground, the lot's `walls` (`scenes/homeYards.js` yardRoadsUnder). Its
ground is sampled as yardInHouse samples it. On the ground nothing changes: the street beside the house, a piece raised
over it, a lamp hung on the wall under the deck and a piece hanging past the deck's edge over the street are still
refused. The lot's marked edge still follows the road on the ground.

PINS. A synthetic house with a deck and a storey over two road squares, and the game's own houses through the producers
(`layoutLocation`, `setLocationTiles`, `convertTilemap`, `yardRoadsOf`): Newcester's, and past the Bay Solitude's in
BANKBL00 (record 0, ARCH3D 560). Both fail on main and pass with the fix. The law reads a lot's parts and road squares and
no place, so it stands the same in every province.

THE FOUR HOSTS: none touched. The decorator's verdict (`yardWhyNot`) is the yards module's own.
