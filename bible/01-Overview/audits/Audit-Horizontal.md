# AUDIT HORIZONTAL (2026-10-27) - the horizontal progression, audited before it merged

Pull request #1334 built a player's "Add more horizontal progression please!" in five slices and a law: CRAFT-HALL
with MASTER-ART, HUNTERS-MARK with MARKS-OF-MASTERY, POWER-CEILING, APPEARANCES and SEA-OPEN, then HUNTERS-MARK-II,
APPEARANCES-II and PLAIN-TEXT. Then the owner: **"Audit this"**. This page is the findings, each with its verdict. What
the audit changed is written into each slice's own section as it now stands, under its finding's id (AUDIT HORIZONTAL
A1 and on), and the code says the same at each site.

## How it was run

Seven lanes, each a cold reader of a FROZEN SNAPSHOT of the branch at `37a7bd3a0` (Home.md's DO NOT FIX WHILE THE
VERIFIER IS READING), told to prove every finding with a probe on the real code and to cite the code by its text. A
fixing agent per lane then worked in its own worktree: each finding reproduced first, fixed, pinned by a test that fails
on the snapshot's code and passes on the fix, and given a mutant record that dies. The author merged each lane, drafted
its words in the 13 whole languages, and kept the record (lane G).

| Lane | Over | How |
|---|---|---|
| A - the crafting page and the law | CRAFT-HALL, PLAIN-TEXT | every rank 0-100 against the acts' own tables; the tool run against its own history |
| B - the Master's work | MASTER-ART | a band moved under a signed record; the judge, the box and the book through the real Worker; two builds in one room |
| C - the sea | SEA-OPEN | the Veil party left and rejoined; 36 crew asks at once; 240 tows past a headland; an older build's door |
| D - the ceiling | POWER-CEILING, SET-CATCHUP | each registry run with its power really active; the walk's literals; the import graph's order |
| E - the wardrobe | APPEARANCES, APPEARANCES-II | a peer re-dressed, the first-person shield, every mint's look against the catalogue |
| F - the hunt | HUNTERS-MARK, MARKS-OF-MASTERY, HUNTERS-MARK-II | the ledger's laws through the real Worker over node:sqlite; a guest; the real map ridden |
| G - the record | versions, merges, counts, the pull request's words | the branch against main; every stated number against its code |

**WHAT THEY FOUND.** Two HIGH, both at sea: a Veil party dragged a member who had left the ship across the Veil (C1),
and parallel crew asks signed past the day's 24 (C2). Twenty-four MEDIUM, among them a Master's work judged against
today's tables (B1), an older build dropping a Master's work it held (B7), a quay tow through land (C3) and a main the
branch could not merge onto (G1). One LOW was worse than it read: the cut fell on whichever registry the import graph
asked last (D4). Each is FIXED below, or LEFT and said.

## A - the crafting page and the law (CRAFT-HALL, PLAIN-TEXT)

- **A1 MEDIUM - What raises was read at the rank's top grade**, past the highest grade an act's table holds: rank 90
  Outfitting said "140 XP at grade 7", the loom stops at 5. Also a clean herb pick below rank 10, gems on a Court writ,
  the stars on writs and Smithing's ingot. FIXED: each row held to its act's table (`craftHall.js` GATHER_TOPS,
  benchTop). Pinned over every rank (crafthall A1).
- **A2 MEDIUM - a craft at its limit still offered its owed firsts** and the First-time bonus badge. FIXED on the client:
  a closed craft (the limit, or Master) shows none, and says it can rise no further. The service spends such a first
  at 0 XP: no loss while the limit holds, pinned as it stands, and a question for the owner.
- **A3 MEDIUM - nothing pinned that `made` is a character's.** FIXED: pinned through the Worker.
- **A4-A7 LOW** - Craft x N kept its old count after typing (FIXED); a patch note said every station has filters (the PR's
  words, corrected); section 56.4's counts (FIXED); the Professions key's label and an option glued from English
  (FIXED: `t()`, `stationActLabel`).
- **The lane's suspected item - a held state read applied after a craft rolled it back** (its first, its iron, its XP).
  FIXED: every answer moves the book's state generation (`profBook.js` stateGen), and an overtaken read is read again.
- **PT1 MEDIUM - the law counted long blocks, not their size**, so a page grew unseen (Professions-Arc section 8 by 116
  words; section 56.5 takes 80 back). FIXED: the baseline holds each entry's excess. **PT2-PT4 LOW** - a blank line ended
  a comment block; a plural's branches were miscounted; `--seed` took a ref that already held the law. FIXED.
- **PT5 (at the merge) - an index page is one list**, so under PT1 its next entry read as its last one grown. FIXED: a
  top-level list item is a paragraph of its own (`plainText.mjs` paragraphExcess). PT6: a version log's entry (`// world271:`) is a comment block of its own, so a bump grows nothing. Dropping the log's oldest lines instead had cut text that older pins read (`chap3a_merit`, `chap3b_strength`: red on CI), and those lines are back as main has them.
- **LEFT, named:** Building's grade note implies a quarter rate for mason's cuts that `masonXp` does not apply; "Esc -
  close" is still glued English across `worldModes.js` (before this change).

## B - the Master's work (MASTER-ART)

- **B1 MEDIUM - a Master's work was judged against today's tables.** The record signed the keys and the seed, and every
  reader rolled the values again, so any band moved (even widened) made every honest piece a `provenance` finding.
  FIXED: the service rolls once and signs the values (`masterLaw.js` masterRecordLines; the record bound 704).
- **B2, B3 MEDIUM - laws without a pin**: the judge's plain-craft clause, the goods held, the recipe's own craft. FIXED:
  pinned through the Worker.
- **B4-B6 LOW** - the box listed the stand-in's goods with the Heartwood ticked; a work answered past midnight marked
  today's; a Pearl jewel's own Pearl was asked as a catalyst. FIXED.
- **B7 MEDIUM - an older build dropped a Master's work it held** (the lane's suspected item, proven with each peer on its
  own tree). Main's law refuses the piece but its wire reads the shape, so it goes silently, not as AUDIT SETS M2's
  newer word; once an older build holds a room's seat, every peer lands its word without it. A Mounted Trophy can be
  lost the same way. FIXED: LOOT-DOOR - a loot room's hello (a world room or a cell) says the loot its build reads
  (`wire.js` LOOT_HELLO_LAW, `ll`), and while the relay setting `lootDoor` is on, a hello that says less is refused
  with GROUND-GATE's words (`server/src/index.js` `_lootDoorRefusal`). Pinned (`lootdoor`, 4), `lootdoor.json` (17).

## C - the sea (SEA-OPEN)

- **C1 HIGH - the Veil party took a member who had left the ship** within its 60 s window: three days on their clock, no
  ship there. FIXED: a member follows only from where the ship left them (`veilParty.js`, within one pixel).
- **C2 HIGH - crew asks in parallel signed past 24 a day** (36 at once held 36). FIXED: the cap and the hold are one
  statement (`crewSigns.js`).
- **C3 MEDIUM - the quay's tow swept through land** (a Carrack 21.4 m into a headland). FIXED: a way planned over water
  clear of her beam, followed along the way, a step over land held.
- **C4 MEDIUM - an older build refused a newer peer's whole naval word** for a fishing boat in it. FIXED: the new classes
  ride their own keys (`navalWire.js` `h`, `j`).
- **C5 MEDIUM - a member past 60 s of wall time was left at sea.** FIXED: the window counts stepped frames. A member on an
  older build does not follow (named).
- **C6-C9 LOW** - a fleeing fisher marked the pirate engaged (FIXED, `navalDirector.js` directorShips, `createNavalHost`
  9 logical lines lighter); the refusal's words (FIXED); a recruit held per account (FIXED: per character, the cap per
  account); a beached boat kept its way (FIXED).
- **The lane's suspected items** - a captain sailing off before a member landed sent them to open water (FIXED).
- **C10 MEDIUM - a ship under way gave the quay up** (the lane's second suspected item): a navy cutter leaving the next
  berth at 0.5 m/s held a passage 40 s, and she landed 30 m short. FIXED: a hull making way is waited on up to
  TOW_WAIT_S (120 s); a still hull keeps TOW_FOUL_S (40 s) (`passageQuay.js`, `seaClearance.js` ahead).

## D - the ceiling (POWER-CEILING)

- **D1 MEDIUM - SET-CATCHUP's reach read carried pieces**: a lent pair carried for one kill made a reach for good. FIXED
  before the lanes ran: worn pieces only (`sigilSets.js` wornSetRanks).
- **D2 MEDIUM - the source sweep checked that a registry asks for its room, never that it spends it.** FIXED: every
  registry run with its power built by its own producers (`powerceiling_rooms`), and the sweep reads inline bodies.
- **D4 LOW, FIXED IN CODE - the cut fell on the last registry asked**, so a loot power past its top cut a player's martial
  path in `world.js` and the sky in `exterior.js`. Each registry now names itself and is held at its own top first
  (`powerCeiling.js`).
- **D3, D5-D8 LOW** - the walk's rung check could not fail (FIXED); the patch notes overstated the ceiling (corrected); a
  translated pace inside an English line (FIXED: English, as the line); mastery's row arithmetic (FIXED); the paths' and
  the sky's numbers unwalked (FIXED, `tools/powerCeiling.mjs`).
- **The lane's suspected item - the sets' +200 is a blow in play** (True Invisibility keeps a foe unaware). Pinned. No top
  moved.

## E - the wardrobe (APPEARANCES)

- **E1-E3 MEDIUM** - a peer's re-dressed weapon was not drawn again and its glow went out; the first-person shield showed
  the piece; chain boots style 2 is never minted (474 looks became 473). FIXED.
- **E4-E8, E10 LOW** - "Hold a ..." said false past style 1; a light flail listed with no looks; the doll dyed from the
  piece; a held W opened the Wardrobe; the account service must deploy first (recorded); stale records. FIXED.
- **E9 LOW - LEFT:** a look is stripped with every receiver's mark when a record leaves a save. The collection keeps the
  look; only the fee is lost.

## F - the hunt (HUNTERS-MARK)

- **F1, F2, F6 MEDIUM/LOW - laws without a pin**: the day's ceiling an account's, markDone's week, influence once a clear.
  FIXED: pinned through the Worker.
- **F3 MEDIUM - clears past 48 a day were dropped silently**, and 48 was not past an honest player. FIXED: measured over
  the real map (`tools/huntPace.mjs`: 706 a day with the carriage), the ceiling 750, a day-full report kept and sent
  again after the day turns. A modified client can now reach 750 clears in a day (named).
- **F4 MEDIUM - a guest read "Reading..." forever.** FIXED: the book closes on `hunt-need-account` and says why.
- **F5, F7-F10 LOW** - the Marks of Mastery missing on letters and notes (FIXED; seat and chapter titles LEFT, their
  readers one account at a time); `no-session` not kept (FIXED); stale cites (FIXED); the PR's words (corrected); a
  mark's rung read now, not in its week (FIXED).
- **The lane's suspected items** - a track with no realm row counted as a living Master (FIXED); the mastery read grew
  with every clear (FIXED: it stops at 750). `huntStateOf` still counts every row (LEFT: it needs a counter column).

## G - the record

- **G1 MEDIUM - main shipped `world270`** (CHAT-POST): the branch could not merge and ran no checks. FIXED: main merged
  and main's own red ported here. Main moved three times more during the audit (FIELD BUGS 2026-10-26d, TITLE-DOOR,
  FIELD BUGS 2026-10-26r), and each merge renumbered this branch past it: `world273`, `acct199`-`acct203`, migrations
  0179-0182, a Master's work's mint version 5.
- **G2, G3 MEDIUM** - the PR's "What changed" was stale after HUNTERS-MARK-II; Seats-Arc 4.2 named migration 0179 (0181).
  FIXED.
- **G4-G7, G9 LOW** - off-by-one counts; a test read the wall clock; a card glued "{traits}" with " and "; the patch notes'
  rank and influence; stated numbers unpinned. FIXED. **G8 LOW - LEFT:** main's old version chains name three wrong
  changes (acct119, acct105, acct148), main's since #1163.
- **G10 LOW - `AUDITMWNPC2-K1` survived, on main as here**: an empty look passed `wornByRole`. FIXED: the pin asks the
  robes be there.
- **G11 NOTE - LEFT: two of main's tests settle by counting timer turns** (`partyloot_wire`, `auditrealm2_client`): each
  failed once while three suites ran at once, and passed alone and six at a time. Unchanged here; main's own.

## Versions and deploy

Account: `acct203` takes the audit's service changes, one release with the slices (B1, C2, C8, F3, F5, F10); the
service deploys before the site (E8). Relay: `world273`, re-hashed in place for B7's door; it deploys first. Once the
site serves this build, a developer turns the door on (`/relay lootDoor on`); from then an older copy, a desktop copy
included, is told to update before it enters a dungeon, a building or an open-world cell.

## Pins

Each slice's lists, run again on the merged tree: `masterart.json` (59: 58 dead, one recorded equivalent),
`crafthall.json` (53), `plaintext.json` (22), `power-ceiling.json` (79), `seaopen.json` (130), `huntersmark.json`
(102), `huntersmark2.json` (13), `appearances.json` (88) and `appearances2.json` (40), every record dead but the
recorded equivalents (923 dead, 2 equivalent, none surviving), with `lootdoor.json` (17) and the lists the lanes
re-aimed.
