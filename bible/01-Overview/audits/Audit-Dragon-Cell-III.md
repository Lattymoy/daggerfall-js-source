# AUDIT DRAGON-CELL III - the dragon's budget and its rewards read cold, 2026-10-31

The owner: *"Audit amd open up the rewards"*. DRAGON-EACH opened the rewards first (`11-Multiplayer/Dwarven-Dragon.md`
DRAGON-EACH); then three lanes read it and DRAGON-BUDGET cold, read-only, their mutants judged in copies: the relay and
the law (A), the account service and the client (B), the records, the pins and the mutants (C). The worst finding was
the deploy's own order: CI deploys the relay before the service, so a receipt the old service counted could be paid
again by the new one. Every finding was re-read against the tree before it was fixed, and no fix began until all three
lanes had reported.

Pinned in `test/net/dragon/dragoncellaudit3.test.js` (8), with `dragonbudget.test.js` moved to the new law.
Mutation-proven: `tools/mutants/dragoncellaudit3.json`, 29, all dead; every dragon list run again. Relay world299 (world298 on its branch, renumbered past LITANY-STAND at the merge),
never deployed, re-hashed in place; acct233 (acct231 on its branch, renumbered past main's at the merge) and migration 0203 unshipped, changed in place.

Severity as in the first audit: **bug**, **risk**, **doc**, **test-gap**, **nit**.

| ID | Lanes | Sev | Finding | Fix |
|---|---|---|---|---|
| G1 | C1 | bug | **CI red.** The receipt now imports `dragonLaw.js`, which the account deploy's path filter did not name (ACC1-CI): a change to DRAGON_CELLS would redeploy the relay and not the service. | Named in `account-deploy.yml`. |
| G2 | B1, B2 | risk | **One receipt paid twice.** CI deploys the relay first, so acct232 counts a placed receipt at place -1, and acct233 then counts it again at its place: a second hoard and tame roll. A rollback of the service does the same. The records said "the service first". | A placed receipt is refused where its watch holds a -1 row written after it was minted (`dragons.js` BEFORE_EACH): it may be that receipt. A second dragon in the deploy's watch can lose its reward. The real order and two rollback floors are written in the version notes. |
| G3 | A1, C3 | risk | **Guests cost nothing.** The budget is an account's, and a guest is minted at 240 an hour from one address, so a few hundred guests sweep the ground cells every watch. The hub's count is lost when it sleeps. | Open, put to the owner: tell guests no omen, count by address, or keep the count in the hub's storage. |
| G4 | A2, C3 | risk | **One charged cell told a 3x3 block.** A socket re-posed to its cell's edges was told its neighbours' omens, 216 cells an account a watch. | An ask is charged every cell its pose could be told of (`dragonReachCells`, one to four); the count is 48. |
| G5 | A3, C2 | risk | **The budget became hub load.** A refusal was not kept, so a socket past its count asked the one hub at 8 Hz; two asks at once both called; a grant could overwrite another's; each call walked every key. | A full budget is kept in the room for the watch; one call a cell set is in flight; grants are re-read after the call; the hub keeps its counts by watch and lets a watch go whole. |
| G6 | A4 | bug | **Told, but never fought.** A player told from their last cell walked to the site and every `in` was dropped: its pose's cells were new. | An `in` is judged by its site's cell alone, which its telling charged. |
| G7 | A5 | risk | **A fight's words went around the budget.** Any socket within 4 km heard a live or fallen dragon's site, never stood, past its budget. | A passer-by hears once its account is granted the fight's cell, asked of the hub after its wait in the room. |
| G8 | A6 | risk | **Two dragons in one node room** (the cell tree's coarse nodes): the second was `full` to an account in the first, a blow went to the newest fight, and three forged sites at one turned the other away. | Counted by place; a blow goes to the fight its socket joined. |
| G9 | A7 | risk | **A dragon in a cell with no ground** is never seen by an honest screen, but a forger told its omen can fight it; DRAGON-EACH pays four a watch, not one. | Open, put to the owner with G3: the budget bounds who is told. |
| G10 | A8, C6 | risk | **A rollback to world297 lost the hub's keep**, which it reads as `r` and `e`. A spent receipt handed, or a spent keep kept, had no pin. | The keep says its newest receipt as world297 reads one. Pinned. |
| G11 | A9, B5 | risk | **A fall from before, told after, was dropped:** the tell worked the place out from the site, and its receipts carry none. | The place is kept on the fight when its receipts are minted, and told as minted. |
| G12 | A10, C4, C5, B3, B4 | test-gap | No pin read the room's grant by watch and account, a socket not yet stood asking nothing, an `in` at a live fight waiting, 0203's carry of old rows, or a guest's hoard a place. | Each pinned; 0203 run on rows the old service wrote. |
| G13 | B6 | nit | 0203 added its column last, so a run outside the ledger rewrote every row before it failed. | The column first. |
| G14 | C7 | test-gap | AUDIT DRAGON-CELL II E14 dropped `at` from the widest attachment's fixture. | The fixture stamps it as `Room.fetch` does: 1723 and 1778 bytes. |
| G15 | A11, B7, C8-C12 | doc | Comments that said one receipt an account; the DRAGON-EACH record's counts; DRAGON-BUDGET's record without its moved pins; the first audit's D3 not closed; the ledger's pins. | Each written as it stands. |

Re-aimed by content and run, dead: eleven records the fixes moved (DRAGON2's fan and hub, AUDIT DRAGON's cache, the
first audit's D2 two and D6, the second's E2 and E3, DRAGON-EACH's tell, kill and hoard) and every DRAGON-BUDGET record.
PINS MOVED: `dragon2_relay`'s watcher asks; `dragonaudit_relay`'s state line; `dragonbudget`'s count, word and sweep;
`auditattach`'s two widths.
