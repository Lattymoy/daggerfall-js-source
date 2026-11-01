# Bounty Boards

Every settlement posts four monster hunts a day. Every player at a town reads the same four, scaled to the reader's
level tier. A hunt names a spot 4 to 10 map pixels out, or a nearby dungeon; the pack stands when the hunter arrives,
and the last kill pays gold and a piece of kit. Clears build a hunter's rank, with a weekly named beast, mounted
trophies and titles. The player opens the board from the **Bounty Board** button on the town panel under the compass
(`src/scenes/townPanelHost.js`), in every settlement of Tamriel. The port's own; DFU has no bounty boards.

## How it works

**The postings** (`src/systems/bounty/bountyBoard.js`). A posting is a pure function of the day, the town's world
pixel and the slot (`BOUNTIES_PER_DAY` 4): its spot, beast, count, story and poster. Notices turn over each game day.
The reader brings the tier: a level 2 reads "Rats" where a level 12 reads "Giants" on the same notice. A taken bounty
carries the taker's level in its id (`day.px.py.slot.level`, `BOUNTY_ID_RE`), so a party mate hunts the same pack for
the same purse. Ids use the world's pixel, so boards past the Bay work too.

**The tiers** (`BOUNTY_TIERS`): levels 1-3, 4-5, 6-10, 11-14, 15+. Each tier hunts the land's own wild in its band
(`src/systems/bounty/bountyQuarry.js` `landWildOf`): what the encounter law rolls on the town's pixel by day and night
(DFU's climate tables in the Bay, the zone's fauna past it, through any mod's selector), monsters only, weakest first.
Where the board knows no wild it falls back to a fixed ladder (Rats and Spiders up to Daedroths). Werebeasts and
vampires are never posted.

**The purse.** Tiers 1-4 pay a full pack of 8 `BOUNTY_FULL_PURSE` (50, 75, 90, 100), times 0.6 plus 0.1 for each beast
past four. Tier 5 pays 150, plus 10 for each beast past four, plus up to 10 for the beast's rank in its list. A dungeon
pack of 2, 3 or 4 pays as an open pack of 4, 6 or 8.

**The piece** (`src/systems/bounty/bountyReward.js`). One weapon or armour piece, never ammunition. Levels 1-3 white at
half condition; 4-5 three-quarter; 6 and up full; from level 4 an even chance of Magic (blue) through the loot
ladder's `applyRarity`, never higher, and white when Loot Rarity is off.

**Where.** An open-ground notice names a land pixel `BOUNTY_MIN_PX` to `BOUNTY_MAX_PX` (4-10) out, holding none of the
game's own locations and no spawned dungeon. Past the Bay, no place the build stands there either. Up to
`BOUNTY_DUNGEON_SLOTS_MAX` (2) slots go underground to a real dungeon in that ring (past the Bay, the land's lairs). A
dungeon pack of 2 to 4 lairs at one of the dungeon's quest spawn markers 25 to 90 m from the hunter. A held bounty is a
black circle on both maps (`src/ui/bounty/bountyMapMark.js`); green is the party's.

**A hunt** (`src/scenes/bountyHost.js`).
1. *Taken*: at most `BOUNTY_ACTIVE_MAX` (4) held; each lapses a game day after it is taken.
2. *Stood* the first time the hunter stands on its pixel: 4 to 8 of one beast, 60 to 110 m out, through the camp's own
   stand (off roads, out of towns and the sea, never in a rock), never saved. A line names how far and which way. A
   graveyard's hunt may stand inside its own location's rect.
3. *Counted* as bodies fall; a beast lost to a cull or a reload is no kill, and only what is left stands again.
4. *Two groups*: an open pack of 6 to 8 is hunted as two halves, the second at its own spot on the pixel once the
   hunter is within 150 m.
5. *Paid* on the last kill: gold, the piece, and a payday notice queued until no window holds the screen.
6. *In the journal* as a side quest with its clock, the kills, the place and the last way named; **Abandon** (pressed
   twice) and, in a party, **Share** (`src/systems/bounty/bountyJournal.js`).

**Farms** (`src/scenes/bountyFarms.js`). A notice naming a farm stands one of the game's HomeFarms farmsteads on its
pixel, climate-dressed and solid, on the flattest of sixteen rolls. The first group waits in its farmyard. Seen by its
holders and their whole party; never saved or sent; down when its pixel unloads.

**The party** (online). The pose carries `bq` (up to 8 bounty rows: id, shared, cleared, kills, pack standing, paid
minute) and `lv`. A share is taken up by every mate in its tier with a free slot; a mate in another tier is told why
and may still help, unpaid. Holders of one notice in one tier are one hunt: a mate whose pack stands owns it, else the
lowest living online account on the pixel. Kills are the party's. A mate's clear pays every holder who held it before
the clear; the board refuses a hunt the party has already cleared.

**The save.** `src/systems/modSaveData.js`'s slot `bountyBoard`: held rows, paid and given-up slots, their kills. Read
defensively. A dungeon pack is saved with the dungeon, so a load keeps it rather than standing a second.

**Hunter's rank.** The account service keeps a ledger of clears (`server-account/src/hunts.js`, `/v1/hunt/clear`,
`/v1/hunt/state`), one per notice slot per character. A clear is the client's word, bounded: the id's shape, a window
of recent days, the level at most two past what the realm trusts, at most `HUNT_CLEARS_DAY_MAX` (750) an account a UTC
day. Reports are kept on the device until answered (`src/net/huntBook.js`). Rungs (`src/net/huntLaw.js`
`HUNT_RUNGS`): Unblooded 0, Tracker 5, Hunter 15, Stalker 40, Slayer 100, Huntmaster 250 clears; shown on the board's
header and the Standing page, online and for registered accounts only.

**The named mark** (`src/scenes/huntersMark.js`). From Stalker, every board posts the week's named beast first: one
beast of the reader's tier, the same at every board, an elite raid leader with the week's two boss traits. Slain, it
pays three full packs' purse and a mounted trophy, never kit; one a week per character. Anyone who sees it reads its
name; only the hunter is paid.

**Trophies** (`src/net/trophyLaw.js` `TROPHY_TEMPLATE` 601). The beast's front frame on a dark wooden shield with a
brass plate, hung in a home as its own mount (`src/scenes/decor/trophyArt.js`).

**Seat influence.** A clear on a board in a region where the hunter's war-guild pledged counts `HUNT_INFLUENCE` (25),
at most `HUNT_WEEK_CAP` (250) an account a week (`src/net/townSeatLaw.js`).

**Marks of Mastery** (titles derived at every ask, never stored): Bloodhound, Beastbane, Grand Huntsman and Legend of
the Hunt at 25, 100, 300 and 750 board clears across the account; a profession's Master at rank 100; Serpent Hunter
and Bane of the Deep at 10 and 40 Sea Serpents.

## Rules

- A board gives a quest screen in the Enhanced Plus look; every player sees the same board quests and can share them
  (Mac).
- Spots 4 to 10 pixels around the town; dungeon bounties name a nearby dungeon; dungeon packs are 2 to 4 (Mac).
- A pack of 4 pays less (Mac).
- The piece: white with rising condition by level, from level 4 an even chance of blue, never more, to max level (Mac).
- Board circles are black on the map (Mac).
- Bounties show in the quest log and can be abandoned (Mac).
- Packs of 6 to 8 are split into two groups with a clue to the second (Mac).
- Farm notices stand a real farmstead that goes away again (Mac).
- Sharing is within a tier; others may still help and are told why (Mac).
- The hunt's progression is sideways: titles, a named beast, a trophy and some seat influence, never more power
  (the owner).
- Anyone who sees a named mark reads its name.
- TAMRIEL-WIDE: ids, rings, ground, dungeons, wild and the named mark use the world's pixel; every board in Tamriel posts.
- A mate's clear is a peer's word; a modified client can pay its own party, never a stranger, and nothing a server holds.

## Code and tests

- `src/systems/bounty/bountyBoard.js` - postings, tiers, purse, ids, stories
- `src/systems/bounty/bountyQuarry.js` - the land's wild
- `src/systems/bounty/bountyReward.js` - the piece
- `src/scenes/bountyHost.js`, `src/scenes/bountyFarms.js` - hunts, packs, farms, the journal entry
- `src/scenes/huntersMark.js`, `src/net/huntBook.js`, `src/net/huntLaw.js`, `server-account/src/hunts.js` - rank and
  the named mark
- `test/systems/bounty1.test.js` - the board, ladder, rings, hunts, farms, party and save
- `test/systems/auditbounty1.test.js`, `test/scenes/audit28_bounty.test.js` - the audits' fixes
- `test/scenes/fb0929h_bountylair.test.js` - dungeon lairs at quest markers
- `test/net/bayleftsea_bounty.test.js` - boards near the Bay's edge
- `test/systems/revenant/lairworld.test.js` - boards past the Bay
- `test/systems/quarryworld.test.js` - the land's wild per tier
- `test/server/huntersmark_service.test.js`, `test/scenes/huntersmark_client.test.js`,
  `test/systems/huntersmark_trophies.test.js`, `test/scenes/huntersmark2_wire.test.js` - rank, mark, trophies, wire

## Open

- FLAGGED: the fixed-city bench (`scenes/exterior.js`) stands no town panel, so it has no bounty board, rank or marks.
- Two mates who take the same week's mark each stand their own copy.
