# AUDIT DRAGON-CELL II - the first audit's fixes read cold, 2026-10-31

The owner: *"Audit"*, again, of AUDIT DRAGON-CELL's two commits (`Audit-Dragon-Cell.md`). Three lanes read them cold,
read-only, their mutants judged in copies while the full suite ran: the relay and the law (A), the client and the Find box
(B), the records, the pins and the mutants (C). The worst finding was in the first audit's own fix: its 20 s wait was the
socket's, not the place's, so one socket in a room that holds any pose swept every cell in minutes. Every finding was
re-read against the tree before it was fixed, and no fix began until all three lanes had reported.

Pinned in `test/net/dragon/dragoncellaudit.test.js` (12, three more) and `test/ui/findfound.test.js` (one assertion more).
Mutation-proven: `tools/mutants/dragoncellaudit2.json`, 12, all dead; every dragon and find list run again, 140 dead and
one recorded equivalent. Relay world299, never deployed, re-hashed in place again.

Severity as in the first audit: **bug**, **risk**, **doc**, **test-gap**, **nit**.

| ID | Lanes | Sev | Finding | Fix |
|---|---|---|---|---|
| E1 | A1, C1 | bug | **One socket swept every cell.** The wait was the socket's age, and a private room (an owned interior, a boat, a caravan - any account opens one) holds any pose its socket posts: stand 20 s once, then re-pose and ask at eight a second. A battle's pose moves freely too. | The wait is the cell's: a socket's clock starts again when it is judged in another cell (`stood`). A private room judges no pose. A battle's pose is judged, under the same clock. |
| E2 | A2 | bug | **An `in` had no wait.** A socket 0 ms old learned from `st` against `gone` whether its cell held a landed dragon, and stood a fight at a forged site. | An `in` from a socket not yet stood in its cell hears nothing; a fighter already in the fight is heard. |
| E3 | A3, B1 | risk | **A player who arrived after minute 20 was told a minute late.** A new socket was told null, and the client keeps a null a minute. | A socket not yet stood hears nothing, near or far, and asks again in 15 s. |
| E4 | B2 | risk | **A square was read before the land past the Bay was laid** when the countryside registered first, and its site kept for the watch. | `groundIn` waits for the land's first install (`land()`) too. |
| E5 | B3, C5 | doc | **D7 overstated.** 94 cells cross the Bay's edge on the freeware: 20 hold Bay ground, where a land-off screen now agrees; 41 hold ground past the Bay alone, which a land-off screen never sees; 33 hold none. | Recorded as by design: a screen with the land past the Bay off sees no dragon whose site is past it. The first audit's figures corrected. |
| E6 | B4, B5 | test-gap | No pin read the square's read let go when the places move mid-read, nor kept across asks - restarted, a square never finishes on a busy page. | Pinned, against a whole read's count. |
| E7 | B6 | risk | **The Bay's scan never warmed on a page with no idle callback** (Safari), so a dragon in a Bay cell stayed unseen there. Older than DRAGON-CELL. | `warmGateScan` slices on `pageIdle`'s timer where the page has none, as the theatres' scans do. |
| E8 | B7 | nit | A Bay homonym had no way; an empty region showed a lone comma. | Every homonym its way; the parts joined only where they stand. |
| E9 | C2 | doc | Section 2, `judgedPixel`'s comment and the version's note named the rooms wrongly, and the note still said "a watch's seed". | Each states the law as it stands. |
| E10 | C4, C10 | doc | The first audit counted nine re-aimed records of `dragoncell.json` (eight) and fifteen dead (fourteen, one equivalent); D12 read as if it had changed A1-the-theatre-unchecked (DRAGON-CELL did). | Corrected. |
| E11 | A5, C6 | test-gap | `dragonWatchSeed` was dead in the relay, and two records and a pin held only it. | Retired; its pin and records read `dragonOmenSeeds`. |
| E12 | C3, C7 | test-gap | The D2 pin's far site lay in the dragon's own cell, so a faithful reorder of the reach check survived; its two records deleted rather than moved; the moved B1 pin's title said a battle holds no pose. | The far site in a cell no omen holds; both records faithful reorders; B1 retitled. |
| E13 | C8, C9, C11, C12, C13, A4 | nit | Titles naming mutants no record held; "22 dead" where the audit retired two; the ledger's pins; two comments misplaced; the attachment's figures; the law row's replaced hash. | Records added, figures and notes written. |
| E14 | - | test-gap | **The first audit's fake socket made three relay tests flaky.** It wrote `at` at connect, so under a parallel run a test's hello that came late was closed as "no hello" (GRANT3, EG-ZM, STAFF-PANEL5: each passes alone; on main, under the same load, none failed). | The fake writes no `at` again; the fight's tests age their own sockets (`test/dragonOmen.mjs` aged). |

Still open, as the first audit left it: a quest's reveal by name. Closed after this audit: many sockets at once (D3), by
DRAGON-BUDGET (the owner: "Do it"), an account's cells a watch on the hub - guest accounts, which cost nothing, are
AUDIT DRAGON-CELL III G3; one reward a watch (D4), by DRAGON-EACH (the owner: "open up the rewards"), a kill keyed by
watch, place and account.

Re-aimed by content and run, dead: AUDIT-DRAGON-the-cache-unbounded, DRAGON-CELL-the-cover-unread, seven of
`dragoncellaudit.json` (the two D2 records as reorders), and DRAGON-HIDDEN-the-watch-unread and -the-bytes-shortened.
PINS MOVED: `dragoncellaudit`'s D2, D3 and D6; `dragonhiddenaudit`'s B1; `dragonhidden`'s seed; `auditwb_world`'s warm;
`dragonaudit_relay`'s cache. The fight's tests stand players who have stood (`test/dragonOmen.mjs` aged).
