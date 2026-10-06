# AUDIT LEGACY III - Project Legacy whole, server side too, 2026-10-06

Mac: *"Do a comprehensive audit on everything"*, of PR #631 at `30b5a1e86`: every slice of Project Legacy -
LEGACY1-LEGACY4, LEGACY-HOME, LEGACY5-LEGACY7 (the account service, the relay and the migration included),
LEGACY-SHEET and LEGACY-NAME - and both earlier audits' fixes (`01-Overview/Audit-Legacy.md`,
`01-Overview/Audit-Legacy-II.md`). Six lenses, each an independent reviewer over the pushed head, read-only, every claim
reproduced - headless drives of the real host over one shared storage page by page, the real account Worker over its
real migrations, the real relay Room, the real wedding managers against the real Worker, world.js's own text lifted out
and run, Chromium for the windows; the fidelity lens re-read Mac's 0.4.1 DLL's IL:

- **A - the family law and the host's state machine** (`systems/legacy/`, `scenes/legacyHost.js`);
- **O - online and the server** (`server-account/src/legacy.js` and its neighbours, the token, the relay, the client);
- **W - the world's wiring and runtime** (`scenes/world.js`, the Living World, the line's bodies);
- **U - the windows** (desktop, phone, keyboard; driven in Chromium);
- **P - persistence, performance and the tests' truth** (measured; 83 mutants written to find what no pin holds - 50
  survived, 47 of them real gaps);
- **F - fidelity and the records** (the mod's IL; every doc claim and patch note against the code).

Eighty-four findings by id (A1-A17, O1-O12, W1-W7, U1-U9, P1-P17, F1-F22), several the same defect seen by two or
three lenses - each pinned once, under its first id: U4 = A14, U5 = A10 = F8, U6 = A12 = F4, U7 = A11 = F10, P1 = O2,
P2 = A4, P3 = A3, P4 = A6, F1 = A5, F2 = A16, F9 = A9, W7 = F13; lens A's own unconfirmed U1-U3 were confirmed and are
A17, A2's realm half and P6. Every one was verified against the code before it was fixed, and every finding but the
record corrections (A16, F2, F5, F7, F12-F20, F22) is pinned by id in `test/auditlegacy3.test.js` (51 tests; the older
pins the fixes moved carry their PIN MOVED notes). Mutation-proven: `tools/mutants/auditlegacy3.json` - 204 records,
202 dead and 2 equivalent as recorded (each with its reason), after eight first-run survivors showed eight pins that
held nothing and were sharpened; the 35 earlier records the fixes moved (32 whose text changed, 3 the fixes gave a
second site) were re-aimed by content and all die (35 of 35).

## THE ROOTS - what the earlier audits' laws left open

- **A copy was stale by its own counter, not by what it was made from.** Each page bumps its own rev at every touch;
  a copy one rev behind that touched three times (a child born: childStep, addChild, the news) counted as "ahead", was
  written whole, and erased another tab's permadeath and its Succession - AUDIT LEGACY II A4's own case. The realm's
  line write had the same premise for two devices. NOW a write is judged by the stored rev it was made from - the
  store's (`store.js noteSeen`/`seenRevOf`, renewed by every write) and the realm's (`base`, asked IN the service's
  update) - and a copy that is not made from what stands merges what stands first (A2).
- **Ids were minted per copy, and the merge matched by id alone.** Two copies that each minted someone gave two people
  one id; the merge made them one - a member wed to another member's newborn, a spouse lost. NOW a person is one only
  when they ARE one (`samePerson`: kind, census id or union, birth minute, parents), and the clashing persons of the
  copy being written move to ids of their own first - the store's, and online the realm's, ids standing: its births
  name their person by id (A3/P3).
- **The record's reader dropped what its writers wrote.** A courtship's sex, race and face (every wedding after a load a
  male Breton with no face), and nothing pinned the LEGACY5 record across a load at all (A4/P2, P9).
- **Online, the line's route read 4 KiB** - every JSON route's bound - so a played founder's first save was refused:
  the realm held the founding copy for good, every write re-sent unsaid, the first heir refused a birth for a reason
  that was not the reason. NOW the route reads its own bound, a record past it gets its own word (413), and the device
  says a refusal once and never re-sends it (O2/P1, P8).
- **A wedding bound the other's ACCOUNT, and a yes outlived its word.** The other side could post as another of its
  characters after the yes; a half re-posted refreshed its life; nothing took a yes back when its player was told the
  wedding did not happen. NOW a half names the character the player saw (the token's `ci`, the relay's `sc` stamp),
  character for character; it is written once, and taken back whenever its player is told no (O1, O3, O11).
- **A tombstone left its online life standing**: its guild seat, its half, its place against the Renown bound; it could
  be deleted, and the person born again; a Bloodline's fall could say "retired" and keep its union; a member struck
  down in the street was never tombstoned at all (O5-O7, W2).
- **Every member keeps their own clock offline**, and the house's news was windowed against the clock of whoever
  stamped it - a parent's death lay in a born heir's future (A8); a union heard away counted its children from another
  page's clock (P6).
- **The boot emptied the Living World's rows before either index was built** (W1): every town and dungeon index empty -
  LW3's roads, LW6's deep, and the name of every online home of the line.

## Findings

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A2 | High | **A stale copy's write erased a permadeath** - its own counter ran past the store's (A4's own case); the realm's write the same for two devices of one account. | Stale by what it was made from: the store's rev each copy read (`noteSeen`, renewed at every write; a born page's from its birth's read), the realm's `base` (`putLineage`, asked in the update). A save's copy newer than the store's takes the store's facts in (`mergeFamily`). |
| A3/P3 | High | **Two copies' persons of one id merged into one** - a member wed to another's newborn, a spouse lost, remains rows collided. | `samePerson`; `rekeyClashes` moves the writing copy's clashing persons and every link naming them (parents, children, spouse, who is played, the waiting fall, remains, houses); the realm's ids stand in `mergeLines`. |
| O1 | High | **A wedding bound the other's account, not their character** - after the yes they could post as another of their characters: wed to one never seen. | The token vouches for the realm character (`ci`, beside `rc` 1); the relay attaches it in place rooms and stamps it on wed frames (`sc`); each half names it (`partner_char`); the union is character for character; an unstamped proposal or yes is refused. |
| O2/P1 | High | **The line's route read 4 KiB**: the realm froze at the founding copy, every write re-sent unsaid, the heir's birth refused for the wrong reason. | `LINEAGE_BODY_MAX`; `lineage-too-large` (413) its own word; the device keeps a record's refusal, says it once (`onRefused`), never re-sends it; `flush`/`unwrittenOf` say so; the birth door waits on the line standing and gives the line's reason. |
| A1 | High | **Two members wed one townsperson** - one census id, two spouses. | Nobody of the house courted, nor one another member is betrothed to; `wed` refuses one of the house and ends every member's courtship of them; a page still holding the other betrothal is told at the temple. |
| U1 | High | **A held Enter on Play as or Pass the mantle armed and fired** (AUDIT LEGACY II U1's class, reopened by its U6 fix). | The pause window's own capture: a repeated Enter or Space presses nothing. |
| A4/P2 | Medium | **Any load during a courtship minted the spouse a male Breton with no face** ("Your husband." to a Khajiit wife). | The reader keeps who the courtship is with. |
| A5/F1 | Medium | **The cadet branch never continued** - a lore-changed member's children took the house's name. | The line is the parent's (`lineSurnameOf`, the mod's `GetSurname(parent.Name)`); a child's own lore change said. |
| A6/P4 | Medium | **Houses that met LEGACY-NAME's bug were never named** - their seat already noted. | Named at the next load, or the next tick of a member born on the page; said once. |
| A7 | Medium | **A child of a house not named yet took a random surname**, which the house's name never reached. | They carry none, and take the house's. |
| A8 | Medium | **Offline, a parent's death lay in a born heir's future**: unsaid at the birth, told as fresh two hundred days on. | Each piece of news heard on the reader's own clock (`hearNews`, kept through loads and merges); its week runs from the hearing. |
| O3 | Medium | **A yes outlived its word** - a re-post refreshed the half's life; nothing took it back when its player was told no. | A half written once; `withdraw` (the union answered when it stood first); the client takes its yes back at every "it did not happen", and a late done after a withdraw that never landed asks again. |
| O4 | Medium | **The union's card carried the realm character's name** through no filter. | Word by word through `checkName`, else none. |
| O5 | Medium | **A tombstone kept its guild seat, its half and a Renown place.** | `afterTomb`: the guild place goes and the seat is handed on (`guildMemberDead`), a dead character acts in no guild, its half goes; `renownHeldSql` counts the living. |
| W1 | Medium | **Every Living World index was empty** (the rows emptied at the boot), so online homes reached the line unnamed. | The rows let go once both indices stand (`releaseHubRows`); a home named off `_townOfMapId`. |
| W2 | Medium | **A member struck down online died only in the line** - their realm character, union and roster slot stood. | The line's write that first carries a death tombstones the person's realm character (`entombLineDead`), by the realm's own binding. |
| W3 | Medium | **The wedding prompt stood over the temple's own windows, and a player lying dead could wed.** | `wedAsk` waits under `overlayHeld` and a death; `wedCan` answers busy while dead. |
| W4 | Medium | **The member met walked on the spot behind their card.** | The line's street held under a talk window, as the street is. |
| U2 | Medium | **The keyboard could not enter the pause window** from the body. | A Tab from outside lands on its first control; the window takes the focus as it mounts. |
| U3 | Medium | **From 721 px the tree was a keyhole** (74 px; its Zoom in clipped out of reach). | Stacked by the pane's width (`@container`), never the viewport's. |
| A14/U4 | Medium | **A member wed twice: the first marriage's children hung under the second spouse**, the first spouse cut off at the row's end. | Every spouse in the unit (earlier left, last right), each marriage's children beneath it; each couple's line left to right. |
| A10/F8/U5 | Medium | **In-laws were called blood kin** ("Brother! You're home."), a spouse handed the founder's siblings. | Blood words the blood's (`kinOf`, `siblingsOf`). |
| A12/F4/U6 | Medium | **Every spouse met read "Mage"**. | The meeting card reads the Family tab's `identityLine`. |
| P5 | Medium | **A stale copy kept its own word about other members** - a re-wedding lost, a member parked nowhere. | A member's own save's fields from the copy that saved them last (`savedAt`); a wedding made after this copy's spouse died stands. |
| P9-P14 | Medium (tests) | **50 mutants survived** - the LEGACY5 record across a load, the union doors, the wedding door, the merges' arms, the host's smaller doors, the marriage law's edges. | Each pinned through the real doors, and all fifty recorded in `auditlegacy3.json` - forty-nine under their own names, re-aimed where a fix moved their line (LP-child-clock-from-zero's line is P6's now, its law P6's record); of lens P's three "equivalent" ones, `LP-read-residentFace-dropped` is real since P17 reads the face and `LP-news-read-keeps-oldest` is pinned at the reader, and only `LP-wed-recorded-twice` stays equivalent, as recorded. |
| P6 | Low-Medium | **A union heard while its member was away counted children from another page's clock.** | Their first played day starts it. |
| O6 | Low | **A Bloodline's fall could say "retired"** and keep its union. | A retirement is an Enduring line's alone; the tombstone keeps its first word (`dead_why`), moved only from retired to fell. |
| O7 | Low | **A tombstone could be deleted or undone**, and the person born again. | Neither. |
| O8/O9 | Low | **Unions listed newest-wed first, fifty**; every read scanned the table. | The latest word first; read by its own indexes. |
| O10 | Low | **The dead kept their standing for good**; every played member a stock career whole. | `leanRecord` lets a dead member's standing go once no child can take it; a stock career is its index's. |
| O12 | Medium | **A tombstone's Stores went to its heir** - the record's last unconfirmed item, driven against the real Worker before the audit closed: a request naming a fallen Bloodline character read its Stores and WITHDREW them into the heir's pack, and wrote its tracks after its death; only the guilds' door asked (O5). | The service's one door asks it of every body that names a `character` (`index.js`, `legacy.js isTombstone`): one of the account's tombstones - an Enduring elder retired too - acts in nothing, refused `dead` (410) before any route; the token's mint alone is no act (it mints a tombstone no realm character, REALM-DOOR's `rc` 0); another account is told nothing; the guilds' own question folded into the door (O5's two records moved with it). |
| O11 | Low (latent) | **The mint and the relay's hello read two token bounds** - a house carried a token past the wire's 640, refused at every hello. | `TOKEN_BODY_MAX`, one bound, both. |
| W5 | Low | **The online homes read was unordered**, and a home the arena moved was never read again. | The last asked wins; a moved home read again. |
| W6 | Low | **The street's family layer was never released** indoors. | Cleared with the roads. |
| A9/F9 | Low | **Every first play was "a new child"**. | Born news for the Succession's newborn alone. |
| A11/F10/U7 | Low | **A spouse born on their wedding day, twenty for life; a newborn "23 of 90"; a gone player spouse's death day.** | No age for one wed in or a minor; no wedding-day birth; no death day for one gone. |
| A13/F17 | Low | **A member struck down was no news.** | Told. |
| A15/U9 | Low | **Living and Fallen counted different sets**; a death of years "Fell at". | Both the blood's; "Died at" unless a fall. |
| A17 | Low | **The past played back showed the head's sheet.** | None for the past. |
| P7 | Low | **An older save courted its days again.** | A day courted once. |
| P8 | Low | **A full device never wrote the realm.** | Online the realm's copy follows regardless. |
| P15 | Low | The realm queue kept an older record waiting; the service's own bounds unpinned. | The newest waits; pinned. |
| P16 | Low (tests) | The wedding handshake's guards unpinned (6 survivors). | Pinned. |
| P17 | Low | **A townsperson spouse wore head 0 of their race**; the news's order hung on merge order at the cap. | One pose for the tree and the meeting (`facePose`, CommonFaces); one order. |
| U8 | Low | **Online, the Bloodline answer stopped saying the line ends.** | Both lines. |
| F3/F11 | Low | "Ask the priest" (no priest step); "+3" at the blessing's cap; "The 2 children"; "your descendant" for a sibling; "retires to the seat". | The words say what happens. |
| F6 | Medium (records) | The House page did not name a fall's killer the notes said it did. | It does. |
| F21 | Low (records) | Testing.md claimed a child's quarter chance no pin held; the first audit's row said "online Enduring until LEGACY7". | Pinned; corrected. |
| A16/F2 | Records | LEGACY-NAME's "Ysolde Hlaalu Hlaalu, gone." never happened - the renderer fills `{who}` with the first name. | The arc, `lines.js`, `legacyname.test.js` (PIN MOVED) corrected. |
| F5/F7/F12 | Records | The patch notes: "the Mods pane" (it is the Features tile), the spouse's home, the child chance, the dead-load's offer. | Corrected in the PR description and the arc. |
| F13/W7 | Records | §10b said Play as is refused online; it is open. | Dropped; the test's title too. |
| F14-F20, F22 | Records | "Any living adult"; the model "on every card"; the elder's word "once"; the Ledger's partner field, title and files; Audit-Legacy's since notes and count; Audit-Legacy-II's "every one pinned"; two code comments. | Corrected; the Ledger's (20) and (21). |

## Not changed, and why

- **A spouse of another player's house never stands in this world** - they walk their own (section 9).
- **The adopt's `noteSeen`** is redundant with the store's own renewal at the adopt's write; it is kept as the plain
  statement of what the copy was made from, and has no record of its own.
- **Two of the 204 records are equivalent, as recorded**: the person's kind (a resident always carries its census id, a
  player its union's sid) and the wedding manager's own once (the house records a union once a sid whoever hands it on).

## Unconfirmed

- **"of <town>" house names for long town names** against the house name's 24 characters - needs the game's location
  table, which is not in the repository.
- **What only a screen shows** (no ARENA2 here): whether the Morrowind rig visibly strides at speed nought under a
  window (W4's body half), and how the Yes/No box stacks over the building's DOM pause window (W3) - the keyboard's
  routing is confirmed by source.
