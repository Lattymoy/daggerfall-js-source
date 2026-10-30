# QUEST-AUDIT IV - the quests read again, the new ones first, 2026-10-30

The owner: *"Please do a comprehenseive quest audit including all of.our new quests. Go deep and be throgough and fix any
bugs/issues"*. QUEST-AUDIT III (`Quest-Audit-III.md`) read the whole quest system on 2026-10-23. Since then the
alternate starts (START1-START3), the Sky-Ketch's rewritten line, MAIN-SPINE, QUEST-FABRIC and the provinces' quest
sites (R2-5) have landed. The standard is QUEST-AUDIT III's: a finding is a defect a player can hit, and a difference
from Daggerfall Unity is not one by itself (SCOPE1).

**How.** A static lint first, over every questline script, every start and every DFU quest the port patches, as the
game reads them (patched, the branch on): each symbol declared, each message named written, each line claimed by a
template, each clock started. It found nothing in our scripts, and the patches add nothing to DFU's own. Then five
read-only lanes, each driving its quests on the real bridge with the freeware ARENA2:

| Lane | Read | Found |
|---|---|---|
| L1 | the starts: the nine scripts, the start host, the hand-off to `_BRISIEN`, saves | 6 - 2 BLOCKER, 1 MAJOR, 3 MINOR |
| L2 | the story lines: the Burning Doors, the Covens' Hoard, the Weir Road, the Hour, the Old Coil | 6 - 1 MAJOR, 5 MINOR |
| L3 | the Sky-Ketch, the Thirteenth of Frostfall and the eight introductions | 4 - 2 MAJOR, 2 MINOR |
| L4 | the questlines' runtime: the runner, the layer, the rewards, the 31 patched quests, the service | 3 - 1 MAJOR, 2 MINOR |
| L5 | the quest core's changes since 2026-10-26: places, the mount, MAIN-SPINE, the journal past the Bay | 5 - 1 BLOCKER, 2 MAJOR, 2 MINOR |

24 reported; L1 and L5 found the same two (the backbone, the restored start): 22 defects. Each was reproduced with a
script before it was fixed. Each fix is pinned by a test that fails on the code before it
(`test/systems/quest/questaudit4.test.js`, `test/systems/questlines/questaudit4_lines.test.js`), with a mutant in
`tools/mutants/questaudit4.json` (36, all dead). Each fix carries a `QUEST-AUDIT IV <id>` comment, a script's in a header line (AUDIT QA4 D13).

## The starts and the main story (A)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | BLOCKER | **The backbone began before the commission was opened, then twice.** MAIN-SPINE read the Curse on a saved table as the opener's trace. Since START1 the Curse begins beside a start, so every save while a start ran recorded the opener begun. A load scheduled S0000999 within 30 ticks: Morgiah's letter at level 3 with the seal unbroken, and `_BRISIEN`'s own `start quest 999 999` a second backbone. Every online birth reloads its first save. | The Curse is the opener's trace only with no start on the table, and a start on the table owes no backbone (`mainSpine.js` spineRecord, spineOwed). A second backbone never starts while one runs or waits (`machine.js` scheduleQuestByName), so a save the old law already broke sends its letters once. |
| A2 | BLOCKER | **A load handed a second commission to a story that had run.** AUDIT STARTS W5's `restored()` read a story begun only from `storyStarted`, which leaves out the protected quests. Once the start and `_BRISIEN` ended and were removed (a week each), any load before the courts' first quest started the Curse and the hand start again: a second `_BRISIEN`, its letters and its failure clock. | Begun also by the Curse or the backbone on the table, the spine's record, an ended story step (`startsHost.js` storyBegun). The W5 pin's fixture said the Curse was in `storyStarted`; it never is, and the fixture now names a court step. |
| A3 | MAJOR | **A classic import got the commission at its first load.** Its saved table is empty by design (`classicLoadBoot` starts no quests). | A classic game's globals say its story began: any global set leaves it alone (storyBegun). One with none set was never begun, and is handed the commission as a new game is. |
| A4 | MINOR | **A start ended even when `_BRISIEN` did not parse.** StartQuest swallows a parse that throws (the faction records not landed on a cold page), and the start's `end quest` ran in the same tick: nothing ever started the opener. | A start whose `start quest _BRISIEN` ran, with no opener on the table or waiting, has it started again at the backbone's check (`mainSpine.js` openerOwed, `machine.js` keepOpener). The opener outlives the start's tombstone week, so its absence is the proof. |
| A5 | MINOR | **The commission could be dropped with Drop Quest Items on**, and nothing hands a lost one back. | Refused, whatever the setting (`item/itemTransfer.js` questTransferRefused). |
| A6 | MINOR | **The Imperial start woke the player "on the floor of a cell"** where Start In The Dungeon off stands them at the prison's door. | Its 1020 is true at both: a cell unlocked before dawn, a note in the hand. |

Left: `_STARTIB` 1021 ("it may lie somewhere in this cave") and its DFU waking (1020) under a custom start cell are
DFU's own words wherever they are read, as AUDIT STARTS left them.

## The quest core (A, continued)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A7 | MAJOR | **Online, no quest asking for a remote dungeon could be given in Cyrodiil.** QUEST-ZONE seals the open zone's dungeons from a quest's draw. Since WW-C2 the zone is Cyrodiil, and since R2-5 a province's table holds its own lairs alone: every lair sealed, the parse threw, and DFU's one roll answered "no work". The Arcane University's Mages Guild gave work 0 times in 12 online. | A questor's draw sets aside a quest that will not stand and draws another, `SELECT_TRIES` (4) at most (`questLists.js` selectQuest; a departure, Port-Ledger A). Measured: 11 in 12. |
| A8 | MINOR | **In the Imperial City the journal never said "(you are here)"** and the talk's same-building check never matched: the host handed the slice's own name, the quest sites carry its quest name (R2-5b). | The journal's, the HUD card's and the talk tree's place name is the quest view's (`world.js` `_questName`). The talk's "Where am I" keeps the slice's own name. |
| A9 | MINOR | **Past the Bay a held dungeon was found by its name as a nearer lair of that name.** The province's table is the questor's nearest, and from another pixel the name was another lair's: a re-lay or a reveal read the wrong dungeon. | The name lookup asks the held sites first, and a held row joins a new table by its id (`questProvinceSites.js` HeldNames, getRegion). |

Open, the owner's to decide (asked): whether a questor in Cyrodiil online may send the player into the zone's sealed
dungeons. That needs the zone's gate to open a quest's dungeon and an instance there, where today a sealed dungeon's
room is built smaller and the zone keeps no instance. Drawing outside the zone instead sends an Imperial City questor
some 270 map pixels away. Until then a quest that needs a dungeon is set aside by A7's draw.

## The questlines' scripts (B, C)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | MAJOR | **The Old Coil looped for ever online with Come Sail Away off**: no berth reported, no Serpent fought, QLOC02 failed at 60 days and came back a day later. | QLOC02 and QLOC03 need `naval`, as the sea's introduction's steps do. |
| B2 | MINOR | **A deed done late failed its step**: QLOC03's Serpent slain on day 55, QLHR02's Hour broken on day 50, QLBD02's book or QLCH02's key in the pack - the 60-day clock ran on and its words denied the deed. | The deed starts a 30-day return; the step ends at the later of the 60 days and the deed plus 30 (AUDIT QA4 C5), on the sheet's own `late` end (C1), whose words (1050) say the step comes again (C2). A return that lapses still fails the step, offered again a day later. |
| B3 | MINOR | **Thirteen answers ran past the classic pick list**, five past the screen's edge. | Each one line of at most 30 characters; the pin applies BRANCH-8's answer rule to every line's script. |
| B4 | MINOR | **Two couriers spoke of a meeting that never happened** (QLBD02 "again", QLWR03 "the same boy"): since QL-OFFERED the first letter is taken in hand. | Worded as first meetings. |
| B5 | MINOR | **A named blade the ending hands over was never offered** to a class whose two best weapon skills it does not use (Corvane's Spire-Blade 0 of 50 to an archer). | The named card skips the skill filter; a class barred from it still is. |
| B6 | MINOR | **The Hour broken before the Prior was met** filed "Now I must reach the Hour" after it, and paid only at a second click nothing asked for. | The road's entry only while the Hour stands, and the first click kept: the answer pays. |
| C1 | MAJOR | **The Thirteenth of Frostfall stuck for good when the Festival closed**: QLTF01 was set aside after its star was held, though the walk to Glenmoril needs no Festival, and no next Festival is listed. The last night's star, held past the close, was heard by nothing. | A step names its seasonal deed (`deed: '_held_'`); once done it needs nothing and is never set aside. A running step keeps the Festival's need while the last star landed before the close still lives (`NEED_TAILS`); the line itself opens on the Festival's days alone. |
| C2 | MAJOR | **The Herald's Call could never end for a guest, or an account that beat the Grand Champion**: the ladder online refuses both, and the line was offered and taken. | The line is a registered account's, and each step needs a bout the Herald still offers: the climb's end as the account's Arena board last said, kept by account on the device (`arena/arenaClimbSeen.js`, AUDIT QA4 B1). A device that never heard the board offers the line until the Arena is visited. |
| C3 | MINOR | **Imrah's two books left the pack when each step ended** - `get item` keeps them the quest's. | Each made permanent where it is handed over. |
| C4 | MINOR | **The Tonal Warden's act went to whoever stood when the share was answered** - a switch before a retry spent the voyage on the wrong character. | The receipt keeps the character it came to; one not standing is owed the act, said when they stand (`net/ketch/ketchClaims.js`, the stars' AUDIT STARFALL 7 law). |

Left: the Festival list (`net/festivalLaw.js`) names 2026 alone, so a Frostfall step set aside unfinished waits for a
Festival the code does not list yet. Its row says so ("Opens during the Witches' Festival"); the next row is the live
event's own decision.

## The questlines' runtime (D)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | MAJOR | **A line's step started unstamped could not count.** The stamp was read at the start the machine's next tick runs: a take in a pause with the switch then turned off, or a later step saved in the invoke queue and loaded with it off, started unstamped. Its acts were never heard and its end moved no line: a step done again and paid twice. | A line's step is stamped whatever the switch says; a save's unstamped step is stamped at the next look; an unstamped step's end still moves its line (`qlLayer.js`). |
| D2 | MINOR | **The Covens' Hoard's page said its title earned while the service held it back** (paid only once the Burning Doors are witnessed whole). | A step the service pays for a title or a key marks `waits` until the service answers it witnessed, and the page says the title waits - naming the line before, where the step is paid by it (AUDIT QA4 B4). |
| D3 | MINOR | **The witnessed steps' explanation left out the Sky-Ketch**, whose Tonal Warden is one. | Named, in all thirteen drafted languages. |

## The pins

`test/systems/quest/questaudit4.test.js` (12) and `test/systems/questlines/questaudit4_lines.test.js` (14), over
`test/qlStepRig.mjs`, a questline step on the real bridge. Pins moved: `ql12_lines` ACTS-2 (the needs, the Old Coil's
and the Herald's), `auditstarts` W5 (its fixture), `guide4_tracker` and `guide2_wayThere` (the street's place name), `ql2_journal` (the
witnessed places). Mutants: `tools/mutants/questaudit4.json`, 36, and `tools/mutants/auditqa4.json`, 37, all dead; 19
records of older lists re-aimed by content at the change, and 18 more at its audit, each re-judged dead.

## AUDIT QA4 - the change read cold, 2026-10-30

The owner: *"Audit this"*. Four cold lanes read a frozen snapshot of the change (`a321c4cb1`), none given this page:

| Lane | Read | Found |
|---|---|---|
| A | the starts, the backbone, the quest core | 6 - 1 HIGH, 1 MED, 4 LOW |
| B | the questlines' runtime, the ladder's flag, the Ketch's claims | 5 - 1 MED, 1 LOW-MED, 3 LOW |
| C | the scripts and the words, in every language | 7 - 2 MED, 5 LOW |
| D | this record, the pins, 25 adversarial mutants | 14 - 3 HIGH, 6 MED, 3 LOW-MED, 2 LOW |

32 reported; B1 and D2 (the ladder's flag) are one. Every one is fixed or its record corrected, pinned by the two
files above and `tools/mutants/auditqa4.json`.

| ID | Found | Fixed |
|---|---|---|
| A1 | Saves the old A1 law broke kept their early backbone - every character born online since the starts. | A load mends at its first tick: a live backbone beside a start not handed off, no opener and no story step, goes, its `ran` with it (`mainSpine.js` storyMends, `machine.js` mendStory). The opener starts it in order. |
| A2 | The old `restored()` had handed a second Curse and commission to stories that ran. | The same mend: the later Curse goes, with any start begun beside it that has not handed off. |
| A3 | The opener's retry lasted the start's tombstone week; after it the Curse read as the opener's trace. | The hand-off is recorded (`spine.handed`, saved) until the opener begins: owed after the start is gone, and no Curse read as a trace beside it. |
| A4 | The retry said its failure every check. | Parsed in a try, said once (keepSpine's law). |
| A5 | Two held lairs of one name past the Bay read each other by order. | `place.js` siteRowIndex reads a site by its map id where a row of its name has it; every held site of a name is joined; a pixel that stood nothing is not stood again. |
| A6 | Three comments false. | Corrected. |
| B1 = D2 | The ladder's flag was page memory, unknown at a page's start and read across accounts. | Kept by account on the device (`arena/arenaClimbSeen.js`); the runner asks for the signed-in account. Pinned through the Arena's own client. |
| B2 | A star counted after its step was set aside out of season was dropped. | An act a step set aside for its season waits on takes the step back (`qlLineRunner.js` wakeAside); the player's own aside stays theirs. |
| B3, B5 | Comments false; owed Warden acts kept for ever. | Corrected; an owed act lapses in a week. |
| B4 | The Covens' Hoard's title gave the wrong reason. | The row names the line before; the page says the title waits on its deeds, in the 13 drafted languages too. |
| C1, C2 | The return's end filed "failed" words, and 1050 said the matter closed while the line sends the step again. | A `late` outcome on `_gone_`, before `failed`, in each sheet; 1050 says the step may come again. |
| C3 | Imrah's guide doubled on a retaken step and shut Restart. | Made permanent at the pay, not the take. |
| C4 | The Old Coil's walk back was set aside with Naval Combat off. | QLOC03's `deed: '_slain_'`. |
| C5 | An early deed shortened the 60 days. | `_wait_` and `_meet_` are flags; `_lapsed_` ends an undone step at 60, `_gone_` a done one at the later clock. Empty clock tasks parse and fire (driven). |
| C6, C7 | "Ladder" said as a staircase in nine languages; "the Abyss's" the wild sea's word, the sentence long. | Each language's ranking word; "an Abyss Dungeon's Shattered Hour", in three short sentences. |
| D1, D3-D5, D8-D10 | Pins that held their law by source text alone, or survived a mutant. | Driven on the producer: the Ketch's claims with a minted receipt, `keepOpener` through the tick, the commission's take, the paid title rendered, all four scripts' clocks, the tail on a waiting step, the draw that throws. |
| D6, D7, D11 | Decision 1 changed unsaid; the MAIN-SPINE row and two departures unrecorded; the Questlines arc not amended. | `06-Systems/Questlines-Arc.md` section 11; Port-Ledger's MAIN-SPINE row amended and two rows added. |
| D12-D14 | This page's counts and claims. | Corrected above. |

Left: the Arena climb's answer reaches the flag through a source pin alone (a ladder receipt's answer); a device that
never heard an account's board offers the Herald's Call until the Arena is visited; the Abyss Dungeon's place names
in each language are the drafts' own.

