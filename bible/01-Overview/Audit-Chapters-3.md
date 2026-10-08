# AUDIT CHAP3 - the Chapters arc read again, end to end, 2026-10-08

Mac, of everything the Chapters arc holds - CHAP0 (`11-Multiplayer/Chapters-Arc.md`, the design record), CHAP1 to
CHAP3c and the two audits before this one (`01-Overview/Audit-Chapters.md`, `01-Overview/Audit-Chapters-2.md`): *"Let's
audit everything we have so far before we continue"*. Six lenses read the tree at `c296b165`, each on its own and each
told to prove what it reported, and none edited the tree while any of them was reading (Home.md, DO NOT FIX WHILE THE
VERIFIER IS READING):

- **the service** (S): `server-account/src/npcRoll.js`, `npcHalls.js`, `npcReceipts.js`, `npcMerit.js`,
  `npcChapters.js`, the Chapters' parts of `professions.js`, the routes, migrations `0091` to `0095` (today's `0092` to `0096`, renumbered past SCALE4's `0091` at the merge of main);
- **the economy and its abuse** (E): a modified client, alts and rings, the bounds of Merit and Strength, the bands;
- **the client** (C): `src/net/chapterSheet.js`, `npcRollTracker.js`, `npcHallBook.js`, the board, the hosts' wiring,
  CHAP3c's prices in the hall;
- **Daggerfall's law** (D): the twenty-two, rank and join, a hall's guild, the prices and stock CHAP3c lays a band over -
  against DFU's C#;
- **the record** (R): the arc's page, both audits' pages, the ledger, the indexes, the comments;
- **the pins** (T): the eight test files and the eight mutation lists - flakes, weak pins, wrong equivalences, gaps.

Every finding was re-read here before a line moved. Each fix carries an `AUDIT CHAP3 <ID>` comment and a pin in
`test/audit_chap3.test.js` (18), and is mutated in `tools/mutants/audit_chap3.json`: **45 records, 40 dead, 5 equivalent
as recorded** (each with its reason). Thirty older records the fixes moved were re-aimed by content and run again: all
dead - AUDIT CHAP2's `T-LAW-ADOPT-BASE-HAS` and CHAP3c's `CHAP3C-SHEET-BUSY` among them, no longer called equivalent (T6,
T7). The service stayed `acct95` (`acct96` since, renumbered past SCALE4's at the merge of main): none of the arc has shipped, so migrations `0092` to `0095` (today's `0093` to `0096`) grew in place.

Decided at Mac's standing word ("You make the best decisions"; "You can decide whatever is best"), each his to overrule:
E1's gate agreement, E3's one writ a guild a day, S2's forgetting of the developers' weeks, S3's computed regions. E4,
recorded at first, was decided after (Mac: "Your decision").

## Fixed

**The service** (`server-account/src/npcHalls.js`, `npcChapters.js`, `professions.js`, `npcReceipts.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 | low | A credit stamped with its week from its own clock, landing after a reader had settled that week, was counted by no Turning (a member writ's six round trips straddling the boundary). | A week settles `CHAPTER_TURNING_GRACE_S` (300 s) after its boundary. |
| S2 | low | `CHAPTERS_OPEN` stopped neither the hall writs nor the Turning: at `off` a board read still posted hall writs nobody could see, and every week's -3 ran; at `dev` every chapter the developers did not tend reached Failing before the Chapters opened. | Hall writs and every settle only while the switch is not `off`; each week records the switch it settled under (`npc_chapter_weeks.open`), and the first week settled `on` after a `dev` week starts every chapter from 50. |
| S3 | low-medium | Every read of a region's chapters read every report of its towns, and the sheet every report there is, once a minute an isolate - a read that grows with accounts x towns. | `npc_hall_regions`: a witness that changed something and a strike move the version of every region its town's reports name; a region's chapters are computed once a change and written under the version read; every other read is its one row (62 at most). |
| S4 | low | A region's hall writs were a statement a writ, in the Court's own batch: at a busy realm's scale over a thousand statements, and a refused batch took the Court's writs down with it. | One `INSERT ... FROM json_each(?)`, in a batch of its own after the Court's. |
| S5 = T10 | low | A strike landing between a witness's check and its write let the report land on a struck town; a strike left the sheet's kept chapters standing a minute. | The strike asked inside the witness's insert (answered `hall-struck`); a strike moves its regions' versions, so every reader hears it at once. |
| S (notes) | low | A character's receipt lines and Merit lines were read by id against keys that lead elsewhere - each read scanned every line it ever earned. | Indexes `(char_id, ref)` on `npc_receipt_credits`, `(char_id, source, ref)` on `npc_chapter_merit`. |

**The economy** (`npcReceipts.js`, `npcChapters.js`, `professions.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | medium | A gate's region was its client's word: one gate paid 50 Merit to every chapter of the character's guilds wherever it named (400 with eight memberships), and a week of receipts banked and claimed in one paid a week's Merit at once. | A gate of another seat week counts for no chapter (`old-week`, the seats' `creditGate`'s law); at the Turning a gate's Merit counts only where three of its day's claims agree on the region (the seats' `agreedGateRegions`). |
| E3 | low | A member reading every region's board had one private writ a region a guild a day - the shared writs' race AUDIT CHAP2 E4 closed, opened again a region at a time (and ~500 rows a character a day). | One a member a GUILD a UTC day, the first board of the day with a chapter of its guild - asked again inside the write. |
| E4 | low | DECIDED after the audit (Mac: "Your decision"). In a quiet realm one account at its 600 made a chapter Ascendant in about five weeks and held it with a single receipt a week (any Merit froze it); a receipt paid 50 to every chapter of the character's guilds where it stood (400 with eight). | A week short of its target moves a chapter above 50 three back toward 50, never past it (`STRENGTH_SHORT`); a receipt's 50 is shared among the chapters it reached (`meritOfReceipt`). |

**The client** (`src/scenes/world.js`, `worldModes.js`, `src/net/chapterSheet.js`, `src/ui/noticeWindow.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | medium | The spellbook priced Buy and charged Yes against the live sheet: a sheet landing between them charged another price than it showed (a Failing hall's quarter more, the purse overdrawn). | Each window reads the hall's factor once as it opens - the spellbook and the spellmaker as training's flow already did. |
| C2 | medium-low | A sheet stopped by `chapters-closed` kept what it held: the halls kept their bands for the page. | A stop forgets the sheet: every hall is DFU's own again. |
| C3 | low-medium | A kept gate receipt was claimed on the page's first frame, before the gate's scan named its region - so the seats and the chapters lost it for good. | A kept gate claim waits for the scan, 90 seconds at most (`GATE_SCAN_WAIT_MS`), and wakes it. The credit goes to the character playing when the claim lands (a gate is the account's, one a day) - recorded. |
| C4 | low | A kept raid claim landing under another character said "The X will remember it" and refreshed the Roll on that character's page. | Said, and refreshed, only on the fighting character's page. |
| C5 | low | A writ filled after the board closed lost its line - a Renown rise's announcement with it. | Said in the chat (`sayLate`). |
| C6 | low | The hall's chapter was read in the location record's region; the chapters are keyed by the politic map's. | The host reads the politic map's region at the player's pixel, as the halls' witness and the board do. |
| C7 | low | A Take refused `no-writ` or `chapters-closed` left its card's Take standing. | The list read again. |
| C8 | low | A receipt's Merit was never said; a member's own writ promised Merit where its Merit line said it could earn none. | `hallRememberLine` says the Merit; the card promises Merit only where it can earn. |
| C9 | low | A build too old for the service stopped the Roll silently. | `roll-seed` and `roll-claim` stops said, as Renown's are. |

**Daggerfall's law** (`src/net/npcChapterLaw.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D2 | low (latent) | The shelf's quality was clamped to 1-20 even where the band moved nothing - offline too: a world-data pack's hall past 20 stocked fewer items than DFU's. | A band that moves nothing returns the quality as DFU reads it; a move never takes a hall past 20 below its own. |
| D1, D3, D4 | low | "A tier deeper" overpromised (DFU reads quality for the shelf's count alone); a band reaches only what a hall sells (the orders' halls sell nothing it touches); RefinedTraining's five-day upkeep is RR's, unbanded. | Recorded in Chapters-Arc 5.2. |

**The pins**

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | medium | The Season's end was pinned only by a direct call: either route passing `null` for Season 0's week was green. | Both routes pinned with `SEASON_ZERO_WEEK` set. |
| T2 | medium | A member writ's day and region were in its dice unpinned (the day dropped: every assertion held). | Its draws pinned across days and regions. |
| T3 | medium-low | A character dying between the membership read and the credit's write had no pin. | Pinned: `busy`, the reputation unmoved. |
| T4 | low-medium | The halls' isolate cache leaked between tests (a test's first read was the previous test's database). | A stood service forgets it (`test/accountDb.mjs`). |
| T5 | low-medium | The audit list's disputed arm was unpinned. | Pinned on a town four agree on and three dispute. |
| T6, T7 | low | Two `equivalent` records' reasons were wrong: a partial kept record reaches the adoption's base check; a read out past a clock jump reaches the sheet's busy guard. | Both killed by pins; neither equivalent. |
| T8 | low | AUDIT CHAP2 S1's no-ground pin could pass with a spy that saw nothing. | A positive control first. |
| T9 | low | A character's guilds came in the index's order, which the pins assumed. | `ORDER BY faction_id`. |

**The record** - R1 to R14: law 7 and section 10 (the Chapters' own Turning); section 11 (`npc_chapters` built, the law
modules, the sheet's reader) and 13 (the sheet's hosts); the status header's migration range; AUDIT CHAP2's page's
migration numbers; Testing's chap1 row's version; the Page-Index line; Merit of shared writs (none); 3.3's first row; the
record's replay; `standings`' reader; `chapterPriced` imported by both windows (R12); Appendix A's hall book key and
bound; three stale comments.

## Recorded

- **E2**: a raid's cap is six a game day of two real hours - up to seventy-two raids a UTC day, each a witnessed act
  whose +1 stands outside the 15 a day; Merit is bounded by the 600. Recorded in 3.3, as DECIDED.
- **A receipt's character** is the request's word, as a hall writ's is (AUDIT CHAP2 S5): an account may name any of its
  living characters; a gate's credit goes to the character playing when its claim lands.
