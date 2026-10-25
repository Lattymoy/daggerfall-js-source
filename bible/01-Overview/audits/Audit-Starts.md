# AUDIT STARTS - the alternate starts read cold, 2026-10-25

The owner: *"Audit this and ensure its perfect"*, of pull request #1216 whole - START1 (the Bay's start and the main
quest on the player's watch), START2 (the seven provinces' starts, the start page, the commission in hand, the writ and
the sea lanes) and START3 (a quest's place past the Bay on the map, the compass and the journal;
`06-Systems/Alternate-Starts-Arc.md`). Five cold lanes read a frozen head (`92020fc8fe`, against its base `bf98d29f8d`),
each given the owner's asks and the files and never the record's conclusions, each reproducing what it found with a
scratch script before it was reported:

| Lane | Read | Found |
|---|---|---|
| Q | the quest layer: the scripts, the patches, the sheets, the machine's seams, saves | 6 - 1 HIGH, 3 MED, 2 LOW |
| W | the world host and its sequencing: the start host, the boot, online, the load doors | 8 - 2 HIGH, 1 MED, 4 LOW, 1 NOTE |
| V | the voyages: the writ at the passage, the sea lanes on the freeware's Tamriel both ways | 8 - 1 HIGH, 2 MED, 3 LOW, 2 NOTE |
| U | the start page's two faces, the thirteen languages, START3's map faces | 12 - 3 MED, 7 LOW, 2 NOTE |
| P | the pins themselves: every committed mutant re-run, seventeen adversarial ones written | 17 - 1 HIGH, 3 MED, 7 LOW, 6 NOTE |

51 reported, six the same defect from two lanes (W1 = V1 = P1 = Q1, the writ; Q4 = W3, the online wake; P13 = U11, the
tutorial's quote; P17 = V8, the debug lines): 45 defects. Every one was re-run against the head before it was fixed;
each fix is pinned by a test that fails on the code as it stood (`test/systems/starts/auditstarts.test.js`, and the start
suites' own tests where the fix is theirs), with a mutant in `tools/mutants/auditstarts.json` the pin kills. Each fix in
code carries an `AUDIT STARTS <id>` comment. Two were found in the fixing and are below with their findings (V4's first
cut, U2's second door). Nothing is left open; three parts of fixes are answered rather than built, with their reasons
(Q6's re-resolve, V6's plan off the frame, Q3 under a translation pack the player installs).

## The quest layer (Q)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| Q1 | HIGH | **The writ never sailed.** `writ()` read `tasks.get('_opened_')`; the machine files a task under its symbol's inner name (`opened`), so every province's "Any master in a harbor of the Empire will carry you to Daggerfall at Our expense" was charged full fare - 1,300 to 3,300 gold to a character of about 100. The pin built the quest's tasks by hand in the shape no Quest mints, so the right key failed the suite. | Asked as a Symbol (`getTask(OPENED)`), the name the machine files it under. | `start2_provinces` (the writ played on the machine, into a harbor's list) |
| Q2 | MED | `_BRISIEN`'s Quests page opened with "Find a way out of the cave you washed up in" - done at its first look in Daggerfall's streets, the herald's news of a cave the player was never in. | The objective goes; the start's own sheet tells the way there. | `auditstarts` Q2, `start1_bay` (the sheet) |
| Q3 | MED | `_BRISIEN`'s journal (1010) and Lady Brisienna's first letter (1020) told the shipwreck as every player's. | Two patches more (`questPatches.js`): the entry's wreck paragraph goes; the letter opens true of every start. Under a translation pack the player installs, its own `-LOC` words for the two are the pack's, as for every patch over DFU's text (L10N3c). | `start1_bay` (the patch) |
| Q4 | MED | = W3, from the quest's side: the wake read in a public room that, online, holds none of a quest's things. | As W3. The birth session itself joins no relay (`realmNew`), and reloads into the save at once. | as W3 |
| Q5 | LOW | A load during a province start's wait was overrun: the loaded character moved into the lair and a second start begun over a running `_BRISIEN`. | The machine counts its restores (`machine.js` `restores`); `begin` drops its move and its quest once one has landed. | `start2_provinces` (the host), `auditstarts` Q5 |
| Q6 | LOW | A trace that never landed let the host pick a lair on the authored shape - one no lair stands on once it lands - and a start its Place refused after the move left the character with none. | No dungeon is asked for until the trace has landed (else the Bay's, said); a start not running after `then` hands the commission in its place. | `start2_provinces` (the host) |

Q6's third part, a re-resolve on load of a start whose lair no longer stands, is answered: with the wait above no start
names a lair the trace does not stand, and a save outlives that only if the trace or the lairs' law changes - when every
TESA8 lair moves, a matter for that change, not for the starts.

## The world host (W)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| W1 | HIGH | = Q1. | | |
| W2 | HIGH | **The Imperial start online woke in the open zone**, where every dungeon but the day's halls is sealed: the reload put the character outside a dungeon they could never enter again, the commission in it. | A character born online is not offered it - shut on the page with why, "the open zone online" (`startsHost.js` zoneShut, `page.why`, `chargenSession.js`); offline the start stands. | `auditstarts` W2, U8/W2 (the row fits in every language) |
| W3 | MED | **A birth online's reload woke at the door.** Its first checkpoint is the character in their start's dungeon; online ONLINE-UNDERGROUND-LOAD1 wakes every load at the door but the Hold's, told they slept underground, then re-enters the public room - laid at the world's size, none of the quest's things in it. | A load at a running province start's own dungeon, its commission still in it (`resumesAt`), stands inside through the quest's own entry (`instanceDoor.js` entryFor: its instance, whole); both `world.js` doors ask. | `auditstarts` W3 |
| W4 | LOW | A failed move left the player anywhere, and a province's quest was begun for a dungeon they were not in. | The commission in hand, true wherever they stand. | `start2_provinces` (the host) |
| W5 | LOW | The move into the dungeon was unlatched (a load, save, journey or Recall could land while it built); a save made before the story began loaded with no way into it. | The quest layer's latched move (`questWorld.js` respawnLatched); at both load doors a story never begun is handed the commission and the curse (`startsHost.js` restored). | `auditstarts` P11/W5, W5 |
| W6 | LOW | StartInDungeon off, the door's landing was the pixel's middle - inside a model. | The pixel's start marker (`REPOSITION.RandomStartMarker`), the death respawn's door landing. | `start2_provinces` (the host) |
| W7 | NOTE | `starts.js`'s header said "the test room's presets" are handed the commission; only its outdoor two drop `?classic`. | Said so. | |
| W8 | LOW | The dev door `?start=` rode every later address: an heir born from it was moved into a province dungeon. | Dropped by the online page's boot keys, a birth's and a load's address, and both front doors' choices (`main.js`; MAC-N3 holds the boot keys to what it decides). | `auditstarts` W8 |

## The voyages (V)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| V1 | HIGH | = Q1, from the harbor: every province's master asked the fare. | | |
| V2 | MED | Behind V1: an ended start's tombstone stays a week with its seal broken - the writ would have sailed free for a week after "while the start runs". | `writ` skips an ended start. | `start2_provinces` (the writ) |
| V3 | LOW | Behind V1: the Bay's letter, "to be opened in the Iliac Bay and nowhere else", would have been a writ. | Only a commission that is one (`starts.js` carriesWrit). | `start2_provinces` (the writ) |
| V4 | MED | **The voyage back from Daggerfall failed for six of the 28 ports**, each refusal a freeze of 2.8 to 13 seconds while the box's ladder ran to the whole map: four ports stand on water every neighbour of which is water, and the landfall's box stopped at an off-table port's own row and column. (The lane named a third cause, only the one shore tried; measured once the box was padded, no voyage needed another.) | Ashore at the port's own pixel or, where the coast stands it on water, the nearest dry ground within reach; the landfall's box padded past an end beyond the table (`endPad`); a voyage the lanes cannot sail said at once, no ladder. **Found in the fixing:** the first cut also tried every other water about the port, each at the port's own pixel before dry ground - 4 to 5.6 seconds a plan at Lillandril, Firsthold and Skywatch; measured on the freeware, no voyage either way (28 ports, each of Daggerfall's 22 water pixels, and every open water by each port) ever needed a shore but the lane's own, so the other shores went (its mutant survived every pin), and the plans are 0.2 to 0.35 s. | `auditstarts` V4 (two synthetic seas), V4/V7 (with ARENA2: Daggerfall to every port and back) |
| V5 | LOW | The lanes' box was too small north to south round a province (Solitude to Haven: none either way). | A lane the first box misses is asked over LANE_MARGIN_WIDE (2,400). | `auditstarts` V5 |
| V6 | LOW | A crossing from the helm of the player's own boat ran the box's full ladder first - 2 to 17 seconds - where the lanes answer in a fifth of one. | Any helm's crossing with an end past the table sails the lanes first. | `auditstarts` V6 |
| V7 | NOTE | The record: Rihad's first water is no pond; Solitude is one of the nine ports the box routes, not the nineteen; "about half a second at most" was 740 ms cold under a 3,000 ms pin; the real-data pin took any water within 3 pixels, nine ports' ponds among them. | Corrected (`Travel-View.md` LONG-VOYAGE, the arc's section 10); the pin takes the nearest open water and holds every plan under 1.5 s. | `auditstarts` V4/V7 |
| V8 | NOTE | `if (globalThis.__LANEDBG) console.log(...)` shipped three times in `planSeaLanes`. | Removed. | |

V6's other half, moving the plan off the frame, is answered: with V4's and V6's fixes every voyage on the freeware plans
in under a second cold (most under half of one), on the same frame the box's own journeys always have.

## The page and the map (U)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| U1 | MED | **The travel map offered a journey past the Bay** - a quest's place there showed "Travel here", a billed trip of 124,592 minutes, which TESA-NO-FAST removed. | No journey: the card offers none, and the panel's one gate refuses it whatever door asks. | `auditstarts` U1/U2 |
| U2 | MED | Any quest's place past the Bay became a portal's end, the start dungeon itself among them - where TESA13 keeps a portal's ends to the cities. **Found in the fixing:** the confirm could still be reached by a second door. | A portal's end only where it is a city's (`portal`, TESA2's); the confirm refuses any other. | `auditstarts` U1/U2 |
| U3 | MED | **On a phone a tap committed a start before its story was ever shown** (the hover and the press are one gesture), on both faces. | A press answers only for the start whose story a face drew; else it selects, and the next frame tells it. | `auditstarts` U3/U10, U3/P3/U10, `start2_provinces` (the page) |
| U4 | LOW | On the zone map, whose card is down, a quest's diamond inside the zone did nothing visible (on the armed map, an invisible confirm). | The zone's own journey, as a hall's is (PVPJOURNEY); the armed map opens none (no portal into the zone). | `auditstarts` U4 |
| U5 | LOW | Standing in the start dungeon with the continent off, or the classic map, the quest said "Not on your map yet. Ask around for directions." | Past the Bay AUDIT GUIDE W2's premise fails: a site with its own pixel is here by its name; off the map, "Beyond the Iliac Bay, past the edge of your map." | `auditstarts` U5 |
| U6 | LOW | French: "Le {ship} fait voile" - an article before a name that carries its own. | "{ship} fait voile vers {port}." | `auditstarts` U6/U7 |
| U7 | LOW | Bulgarian wrote Daggerfall, the Iliac Bay and Sentinel in Cyrillic where its catalog keeps them in Latin. | In Latin. | `auditstarts` U6/U7 |
| U8 | LOW | The classic passage list's writ row ran 189 FONT0003 pixels, under the scroll bar and off the picker's art. | "{port} - {wind}, by writ" (147), redrafted in every language within the art's 174. | `auditstarts` U8/W2, `start2_provinces` |
| U9 | LOW | The welcome page said "Find them" (false in hand) and "The main story begins when you do" (it begins in the city). | "When you hold them, open them from your pack: they name the city where the main story begins." | `start1_bay` (the welcome) |
| U10 | LOW | Neither face of the page was drawn by any test. | Both drawn: the classic's rows where its hit test reads them; the Plus face's rows, aria, shut rows, release and watchdog. | `auditstarts` U3/U10, U3/P3/U10 |
| U11 | NOTE | `Tutorials.md` quoted the welcome's old words. | Quoted as they stand. | |
| U12 | NOTE | START3's fixture gave Skyrim's lair region 63 (Hammerfell). | 64. | `start3_pastbay_marks` |

## The pins (P)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| P1 | HIGH | = Q1, from the pins: the writ's pin blocked its own fix. | | |
| P2 | MED | The bridge's start handed on was unpinned (`gameStartQuests(start)` -> `()` survived). | Pinned on the commission in hand. | `auditstarts` P2 |
| P3 | MED | The Plus face had no test (a row picking the cursor, a face kept for a new page survived). | Pinned. | `auditstarts` U3/P3/U10 |
| P4 | MED | The chargen door's two laws were vacuous: a Breton's homeland is the fallback, and with the mod off the page is the only question. | A Nord walked; the leveling question on. | `auditstarts` P4 |
| P5 | LOW | The lanes' corner rule and the voyage-first rule were unpinned; four records survived without ARENA2. | A wall whose halves meet at a corner; a helm's crossing and a voyage that cannot sail, the ladder watched. | `auditstarts` P5, V6 |
| P6 | LOW | The door's pixel and the land's wait were unpinned. | Pinned (the pixel, the marker, a trace that never lands). | `start2_provinces` (the host) |
| P7 | LOW | "No Questlines page for a start" was pinned for the Bay's alone. | Every one of START_QUESTS. | `auditstarts` P7 |
| P8 | LOW | Up and a hover on a shut row were unpinned; the shut state was unreachable, and in de/es/fr its rows overflowed. | Pinned; the state is reachable now (W2), and its row - "the open zone online" - measured in FONT0003 in every Latin-script language (the Cyrillic and Hangul rows in the system faces, at most 213 of 304). | `auditstarts` U3/U10, U8/W2 |
| P9 | LOW | The goto's glide was unpinned. | Pinned. | `auditstarts` P9 |
| P10 | LOW | The doorstep's value was unpinned (the test derived it from the constant). | A lair two pixels off the capital. | `auditstarts` P10 |
| P11 | LOW | The quest layer's start seam was pinned by source alone. | Built over stand-ins: a start's id, another's, the weighing. | `auditstarts` P11/W5 |
| P12 | NOTE | Port-Ledger said start2.json held 42; it holds 45. | Corrected. | |
| P13 | NOTE | = U11. | | |
| P14 | NOTE | Rihad and Solitude, as V7. | As V7. | |
| P15 | NOTE | Five suites moved by START1 and START2 were in no "moved with it" list. | Listed (the arc's section 11). | |
| P16 | NOTE | START3 was missing from the arc's title and Status, the Page-Index and Active-Arcs. | Added. | |
| P17 | NOTE | = V8. | | |

## The mutants

`tools/mutants/auditstarts.json` - 61 records over the fixes above, all dead. One first survived - V4's other shores,
which no voyage on the freeware needed - and the code it guarded went. The records whose pins are the start suites' own
name them. Fifteen older records the fixes moved were re-aimed by content and re-run dead (`audit_guide`, `fb1009_beyond`,
`fieldbugs27h`, `guide2`, `legacy1`, `map3`, `start1`, `start2`).
