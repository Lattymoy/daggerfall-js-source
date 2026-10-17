# FIELD BUGS 2026-10-11e - "Card Table blocking", again

One Discord thread, handed over as screenshots: the "Card Table blocking" thread FIELD BUGS 2026-10-09c answered with
WALK-WHOLE, and two posts under it the day after WALK-WHOLE merged.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "another one at Dancing Castle in Pilliweyn" (æther, the thread's author: "This table is oddly placed, it's in 'The Gold Dungeon' in Menakat. I've seen this in other locations aswell. (same tavern layout)") | WALK-WHOLE moved neither: the Gold Dungeon stood its table by WALK-WHOLE's own fallback, and the Dancing Castle's gold table in an opening the building went round | fixed (WAY-ROUND) - read on the player's own taverns, below |
| 2 | the same thread: "The red tables (where u can bet Gold) aint working at all. U cant Build Decks for Illiac Hand. U cant Read the cards in illiac Hand" (Shortstori) | not a placement report: the gold tables are CARDS-KEPT's (`Field-Bugs-2026-10-11.md`, the same day) | below |

## WAY-ROUND: a card table never stands in the way (1)

`11-Multiplayer/Tavern-Cards.md` section 28; `world/placedCardTable.js`.

READ ON THE PLAYER'S OWN TAVERNS. WALK-WHOLE was pinned on built rooms, with no ARENA2 here. This time the freeware
data (`tools/fetch-data.sh`) and both town packs at their load priorities (`test/fb1004dArena.mjs` `openTowns`) laid
every town, and every tavern's room was built through the real `buildInteriorContext` with the real ARCH3D: 254
layouts behind 18,164 taverns with the packs, 199 behind 18,469 without. The yardstick was the player's own capsule
(`CAPSULE_RADIUS`, 0.35 m - the walk's body is 0.2875) flooded from the room's entrance on a 10 cm grid, knees and
head clear, with the tables stood and without: floor reached bare and not with them, outside the props and a body's
width round them, is floor the tables cut off.

- **The Gold Dungeon** (Menakat, Beautiful Cities' GENRGL00 #7). The front hall's two pillars, and the markers and
  flats the walk keeps clear of, leave the ring no floor there; the only floor that holds it is the corridor the inn's
  two halves meet by - seven spots, every one cutting the back half off the walk. WALK-WHOLE's fallback ("a room with no
  such spot stands it where it stood - no tavern loses a table") stood it at the first of them: the corridor's corner,
  a stool 0.38 m off the wall, the doorway of the room beside it - the screenshot. Its walk for the gold table, with
  the first stood, reached 350 cells of 739. WALK-WHOLE moved nothing there: the walk before it and WALK-WHOLE stand
  it in the same place, to the millimetre.
- **The Dancing Castle** (Pilliweyn, GEMSAM01 #1). The chips table stands in the hall, two metres in from the door
  (unchanged). The gold table's six spots all cut the walk, so the fallback stood it at the first: across the mouth of
  the 3 m opening between the hall and the corridor east, its end stool in the opening, 0.34 m left by its north end
  and 0.64 m by its south - each less than a body. The building goes round a core, so the player is shut out of
  nothing; the way east is the long way round.
- **Everywhere.** With the packs, 96 layouts (3,629 taverns) stood a table by the fallback; 79 of them cut the
  player's floor by more than a fifth of a square metre, and DARKAB00 #1 (The Beaver and Rascal, and 28 taverns more)
  lost 7,228 of 10,934 cells - two thirds of the ground floor behind a card table. And WALK-WHOLE passed spots it should
  not have: GENRAL03 #2's chips table (132 taverns, 227 with its two twins) stood square in the doorway between its two
  rooms, cutting the player off 2,148 cells, because the walk found the rooms joined again another way - one the
  walk's narrower body fits and the player's does not. 82 layouts (1,982 taverns) in all lost more than a fifth of a
  square metre.

THE LAW. A spot is passed over when the walked cells round its table, ring and lane, out to `PLACE_ROUND_CELLS` (two
cells, a metre) past them, fall apart with those cells taken out: two cells joined within that window before - through
where the table would stand - and joined within it no more go on only by another way through the building, or by
none. That is the doorway, the opening and the corridor; WALK-WHOLE's cut is one case of it (a cell the walk reached
past the table and reaches no more is cut off from the cells round the table it was reached by), so WALK-WHOLE's walk
again from the entrance is gone, its question asked by this one. A table already stood that the window meets is taken
into the window whole, lane and all, so the way round the gold table may go round the pair. And THE FALLBACK IS
GONE: a room with no spot left whole stands no table - the chips table first, so a room with floor for one keeps
that one. The host says so in the console ("no clear floor near the entrance out of the way").

WHAT IT COSTS. A tavern whose only floor for the table is a corridor, a doorway or the mouth of an opening has none
now. With the packs (the game as shipped): two tables in 13,298 taverns (15,246 before), one in 2,931 (2,891), none in
1,935 (27 before - those have no floor at all). Without them: 7,555, 5,749 and 5,165 (9,494, 8,975 and none). Of the
chips tables that stood before, 15,849 stand where they stood, 380 moved and 1,908 are gone; of the gold tables 12,954
stand where they stood, 344 moved and 1,948 are gone. The ones read by eye stood in a corridor or across an opening -
TVRNAS00 #9's design (274 taverns with the packs, 2,326 without) at the T where its entry hall meets the corridor
south, its stools 0.28 m off both walls. A smaller table for the cramped inns, or one of the room's own tables given
over to cards, would put a table back in them; both are the owner's call, and neither is built.

PINS. `test/world/fb1011e_wayround.test.js` (6): the law's constant; the Dancing Castle's shape (a hall whose openings lead
round a core - the chips table in the hall, no gold table, the player walking straight through the opening WALK-WHOLE's
gold table shut); GENRAL03's (the table in the hall, not on the doorway WALK-WHOLE's stood on); two tables in a room
7 by 6, and a lane apart in two rooms with a pillar (the window taking the first in whole, its lane with it); and,
gated on ARENA2_PATH, every tavern the towns lay with the packs and without - no layout cuts the player's capsule off
more than a quarter of a square metre (eight classic layouts of one hall keep a 22-cell sliver behind a stool, by a
wall), the Gold Dungeon stands none, the Dancing Castle its chips table where it stood, and the counts above. PIN
MOVED: `test/world/fb1009c_walkwhole.test.js`'s second test, which held the fallback - its room stands none now, and stands
the table once its far corridor is gone. `tools/mutants/fb1011e_wayround.json` (8, all dead);
`tools/mutants/fb1009c_walkwhole.json` re-aimed by content (4, all dead) - WALK-WHOLE-no-table-when-every-spot-cuts
RETIRED with the law it pinned, and its cut and its every-spot-cuts records aimed at the window's test;
`taverntables.json`'s TTS-ctx-silent re-aimed by content at the console's words ("... out of the way").

DEPLOY. A client on an older build stands its tables where they stood until it reloads, as WALK-WHOLE's note says of a
moved table: where this one stands fewer, a peer on the older build may be seen seated where its table stood, and the
relay holds its stake as before (TAVERN-TABLES: the gold table is an index, not a place). A save or Recall anchor
made where a table stood lands on open floor now.

## The other post (2)

"The red tables (where u can bet Gold) aint working at all", "U cant Build Decks for Illiac Hand", "U cant Read the
cards in illiac Hand" - three claims about the card games themselves, with no screenshot and no steps, and none a
placement report. The first is the reporter's own thread of the same day, "I would love to Poker but...", answered by
CARDS-KEPT (`Field-Bugs-2026-10-11.md` #1): the stakes book was handed the device's bare Storage, and every gold
table refused every first buy-in. The other two are CARDS7, CARDS8 and CARDS10's (`11-Multiplayer/Tavern-Cards.md`
sections 26 and 33) and are not answered here: each needs a reproduction from the reporter - which character, which
client, what the screen says - before it is a bug.
