# AUDIT DRAGON-HIDDEN - the dragon's health and its secret, 2026-10-30

The owner: *"Audit this"*, of pull request #1445 - DRAGON-HARDER (`DRAGON_TTK_S` 720) and DRAGON-HIDDEN (a watch's rolls
the relay's secret, told at its landing; `11-Multiplayer/Dwarven-Dragon.md` section 2). Three lanes read it cold, each
with the repo read-only and its proof scripts in a scratch directory: the law and the server (A), the client (B), and
the records and the pins (C). No lane told a watch ahead or broke the seed: before a landing a dragon's watch and a quiet
one get the same answers, and the new health holds every bound. The findings were in where the relay lets a dragon
stand, in which rooms a player is told, in a test that failed by chance, and in the record. Every finding was re-run
against the tree before it was fixed.

Each fix is pinned in `test/net/dragon/dragonhiddenaudit.test.js` (8) or `dragonhidden.test.js` (5, two moved).
Mutation-proven: `tools/mutants/dragonhiddenaudit.json`, 17, and `dragonhidden.json`, 12 (one retired with the code it
cut, two written), all dead. Relay world293 (world292 until DELVE II took it at the merge of main), re-hashed in place.

Severity is the lanes' own: **bug** a wrong thing a player sees; **risk** one under a condition; **doc** the record says
what is not so; **test-gap** a pin that cannot fail; **nit** a word or a cost. A finding two lanes made is listed once.

## A - the law and the server

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | risk | **A modified client could stand a dragon anywhere in its own cell**, in any theatre and off any pixel's centre: the relay checked the cell alone. The hole predates DRAGON-HIDDEN (the serpent's AUDIT SERPENT S1 law). | `dragonLaw.js dragonSiteOk`: a pixel's centre on its omen's side of the Bay's edge, the most a relay with no map can judge; `dragonIn` refuses the rest (*gone*). A forged site inside that still stands a fight nobody else draws: recorded, and put to the owner. |
| A2 | doc | **The page lost the forged-site law** and still said "at most one dragon stands at once"; the law's comment cited section 4. | Restored with the new bound; "one true dragon"; section 2. |
| A3 | test-gap | **A party-mate's share takes its look from a dealer's receipt, and nothing read it.** (C2.) | Pinned through the hub's fell door: an Aetherbright dealer's party-mate stands with an Aetherbright's receipt. |
| A4 | risk | **A fight the deploy caught was stranded**: saved under the public salt, judged under the secret, its fighters told to reload and then refused the true dragon's fight that watch. | A cell waking lets go of an unslain fight a law older than `DRAGON_BRAIN_MIN` made; a slain one stays, for its receipts. |
| A5 | nit | **An `ask` before the relay's landing cost 15 seconds**: dropped, then asked again at the retry. (B2.) | Asked again after two seconds. |
| A6 | nit | `DRAGON_RELAY_MIN` was pinned as a number alone, so a renumbering past another's 292 would pass. | Pinned to its version's note naming DRAGON-HIDDEN. |

## B - the client

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | risk | **A siege's battle and a Royal Tourney drew no dragon**: the `ask` wanted the player's own cell's socket, which a battle room does not hold. A regression from the clock's dragon. | The `ask` goes down the primary socket whatever its room; the relay answers it in any room and the client hears its `omen` there. A fight's word still wants its cell. |
| B2 | nit | **A lost answer was never told again on its socket** (once a socket), and the once kept nothing secret. | The relay answers each `ask`; the dragon bucket bounds them. |
| B3 | test-gap | "Nothing drawn untold" read the frame's answer, which is false either way. | No site before the omen. |
| B4 | test-gap | **The omen word's route was a regex.** (C6.) | Driven through `createDragonSky`, and an `OnlineSession` in a battle room. |
| B5 | test-gap | **Four client mutants survived**: the maps' prune, an ask past the remains, an ask after a null omen, the sighting in brass. | Three pinned. The prune bounds memory alone - two entries an hour without it - and no behaviour reads it: held by review. |

Lanes B and C disagreed on a null omen. The code keeps it and asks no more; C's "asked every 15 s" was a probe mutant
that survived, now pinned.

## C - the records and the pins

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | bug | **`dragon2_relay` failed one run in twenty**: the tests' key is new each run, and its first dragon was the Aetherbright one time in twenty, against two pins that wrote brass. | `dragonOmenFrom` names the look and the theatre a test reads - brass, in the Bay, unless named. |
| C2 | test-gap | As A3, and the relay's look on a fight. | An Aetherbright omen's fight and receipt say 1. |
| C3 | doc | Sections 3 and 7 called the roost the clock's alone. | The clock's and its omen's. |
| C4 | doc | **Rotating `GATE_SIGNING_KEY` moves every dragon**, one standing too; nothing said so. | Said in section 2 and `dragonSeed.js`. |
| C5 | doc | The ledger's row left out the hidden dragon's tests. | Added, with the audit's. |
| C6 | test-gap | The seed's label was pinned as a string alone. | The lease key signs another number than the seed. |
| C7 | nit | Two test titles named mutants nobody wrote. | Written, dead. |
| C8 | nit | `DRAGON_RELAY_MIN`'s doc said "the first relay that keeps a fight"; the code map called `src/net/dragon/` the law both ends run. | Both say what is so. |
