# AUDIT FB1020d (2026-10-20) - LONE-HERALD, read cold

The owner asked, of the branch for `01-Overview/bugs/Field-Bugs-2026-10-20d.md` (pull request #1088, at d25d008a6):
**"Audit this"**. This page is the audit of LONE-HERALD: its law, its pins, its mutants, its records and its pull
request. Each finding has its verdict here. What the audit changed is written into the pages it touched, marked
`AUDIT FB1020d` with the finding's id, and into the code beside each fix.

## How it was run

Three lanes. Each was a cold adversarial reader of a FROZEN head, d25d008a6, in a detached worktree of its own
(`Home.md`'s DO NOT FIX WHILE THE VERIFIER IS READING; a mutant edits files in place, so no two lanes shared a tree).
Each was told to reproduce a finding before reporting it, and to end on what it checked and found sound. Nothing was
fixed until all three had reported.

| Lane | Over | How |
|---|---|---|
| L1 | The law: the news's count and lead name, every input the posts can take, stored state across a deploy, `n`'s two meanings, every other surface that counts a company | 5 findings. The pin's harness driven over every company shape; the pre-fix `egHerald.js` loaded beside the new one; `egHudModel` read on the relay's own state; 775 Elite Gates tests |
| L2 | The pins and the mutants: each pin against the pre-fix code, the committed mutants, 35 extra one-site mutants of the changed lines, the harness against the producer's real flow, the relay's room-to-hub path | 6 findings. Pre-fix: 0 of 4 pass. Committed: 175 dead, 0 survived. Extra: 23 dead, 12 survived (2 real, 10 equivalent); the real first wake driven beside the harness |
| L3 | The records, the words and the gates: every claim of the field-bug page, the arc's paragraph, the version notes, the pull request; each example post run through its builder | 13 findings. Every gate run: lint, types, cites, the bible gates, relayversion, 541 version-pin tests, 138 mutants |

Every finding was checked against the code before anything was fixed:

- a bug, by a pin that fails on d25d008a6 and passes at the fix (`fb1020d_loneherald.test.js` tests 1, 2 and 5 fail on
  the frozen head's `egBrain.js` and `egHud.js`);
- a gap, by its surviving mutant;
- a doc finding, by the line it misstates.

## What it found, and what was done

| Id | Finding | Verdict |
|---|---|---|
| L1-1 (= L2-1) | A company of two or more whose opener never stepped in was posted as the opener's: *M0's company is the first ever ... - M1 and M2*. The fix's own reason ("an opener who never stepped in is not the one who went") applied only to a company of one. L2's mutant of the lead (first entrant for opener) survived every pin | FIXED: `heraldCompany` leads with the opener only where the opener entered, else with the first entrant, for any size. Pinned: three called, two came, *M1's company*. Two mutants, dead |
| L1-2 | The opener entered and fell; another took the Redoubt alone; the post reads *M0's company*, with no name for the one who took it | LEFT, the arc's rule: the opener was of the company (section 20, "Who counts"), and the Descent ranks it the Few. Written into the field-bug page's NOT CHANGED |
| L1-3 (= L3-2) | The tracker counted the called company, not the entrants. *S of N standing* and a row a member, `E.co` frozen at the open, so a called member who never came read as one of the company all the way down (*1 of 2 standing*). The record had called it correct | FIXED: `egHudModel` counts and lists the whole called company until the first wake, then the entrants (the gather's rule, `egGatherOf`). Pinned on the relay's own state through the wire and the client's fold. Three mutants, dead. The record corrected |
| L1-4 | First of the Spire's letter said *Your company was the first ever...*, and its one addressee went alone | FIXED: *You were the first ever...*. `egz_recap.test.js` holds it (PIN MOVED); one mutant, dead. The EG-ZF record notes it |
| L1-5 | A name of punctuation alone is held to what is left of it (`@@-` posts as `-`) rather than *Someone* | LEFT: it is `heraldName`'s, shared by every herald (the gate's, the serpent's, the Abyss Dungeon's) and by `companyOf` before this slice; a fix is its own slice. Text only, pings nobody |
| L2-2 | Members gone home or forsaken are counted (the rule), but no pin held it: two mutants survived | FIXED: pinned. A forsaken companion, and one gone home at Redoubt 5's rest through `egHome` before the other takes Redoubt 10, both read `n` 2. Two mutants, dead |
| L2-3 | No committed test told a sized news through the relay's real room-to-hub path | FIXED: `egeco_herald.test.js`'s relay test tells a company of one's news through its room to the hub, and the post is *alone* |
| L2-4 | Ten extra mutants survive but cannot change behaviour (an empty company at a Redoubt, a name not a string, a fold default behind the hub's own read) | NOTED, equivalent; no code added for them |
| L2-5 (= L3-11) | The change edited an existing row of the relay's law table (`world233` lost a space). The table's rule: append, never edit | FIXED: the row restored byte for byte |
| L2-6 | Test 4's hand-built news lacked `ew` | FIXED: `ew: 0`, the producer's whole shape |
| L3-1 | THE ERRAND FLOOR was cited as section 14; it is 13.2 (14 is the decrees) | FIXED in the field-bug page, the arc's paragraph and the pull request |
| L3-3 | The record stated what nobody here could see as fact: that the player took Redoubt 20 alone, that the report came minutes after it, which channel | FIXED: *a player says*; the timing sentence deleted; no channel named |
| L3-4 | The repro's *in 3:19* came from a scratch harness, not the pin's (*20:08*). The arc's example *alone in 40:00.*, with no start, implies 100 halls in forty minutes | FIXED: the pin's breach and time; the example given its start |
| L3-5 | *n and co both taken from entrants(B)* (n counts `B.mem`); *held to letters* (and digits, spaces, apostrophes, hyphens); Wellhead-Walker *for everyone* (for every earner) | FIXED in the record |
| L3-6 | The player's handle stood once, in the owner's quoted message, and *a player* everywhere else, in a public repository; the player did not ask to be named | FIXED: the quote reads *<the player's>* |
| L3-7 | The table said *fixed* of a report whose first half asks for a reward | FIXED: the reward is the owner's call (NOT CHANGED) |
| L3-8 | The pull request did not say the posts wait on a hand deploy of the relay, nor name its files and docs | FIXED in the pull request's description |
| L3-9 | The patch notes offered First of the Spire's new words, which no player can see (said once ever, already said), and *on your own* where the rule is *the only one who entered* | FIXED in the patch notes |
| L3-10 | *542 tests* (541); the area run's result unsaid | FIXED in the pull request (1,522 of 1,522 passed) |
| L3-12 | The record's pins paragraph left out the `soc1.json` re-aim | FIXED |
| L3-13 | The EG-E3 record's list of posts reads in the present tense | LEFT: a dated record, history (`Port-Doctrine.md`, Scope); section 20's spec and `egHerald.js`'s header carry the change |

## What it checked and found sound

- **The count is the Descent's.** The news's `n` is `entrants(B)`. The end's news, the end receipt's `n` and `co`, and
  the account service's bracket (the larger of `n`, `co_n` and the claimers) count the same members. Nobody is admitted
  after the first wake (`egAdmitWord` > `egAdmits` > `egPhase`, `deep` once woken), `B.mem` is written only by
  `egEnter`, and nothing takes a member out. So no sequence makes the post and the board disagree.
- **The words.** Every example post was run through its builder, character for character. Every input shape was
  tried: `n` undefined, null, 0, 1, 2-8, 9, -1, `'1'`, 1.5, true, NaN. Only 1 is *alone*. Mentions, links and markdown
  are held out (`heraldName`), and every post pings nobody.
- **Across a deploy.** An old room's stored news reads `n` 0 and posts as a company. So does an old hub's owed queue,
  through the new `egHeraldPost`. A new room telling an old hub loses `n` harmlessly. Nothing crashes, and the room and
  the hub are one worker.
- **`n`'s two meanings.** A name on `lb` and a count on `rd` and `dc`. No reader confuses them: `egLonePost` alone
  reads `lb`'s, the hub's own counter is top-level, and `B.hq` never reaches a client.
- **The pins.** Each fails on the pre-fix code on an assertion, not a load. The times (`20:08`) are deterministic. The
  file passes in any order. Every *(mutants: ...)* claim in a title is a committed record that dies in that test.
- **The harness.** The real first wake, driven beside the harness for an opener who never stepped in, mints the same
  news (`n` 1, `o` M1) and owes the opener's *empty* end, which `heraldCompany` never reads.
- **The gates**: lint, types, cites, the bible gates, relayversion and every version pin.

## After the fixes

- `fb1020d_loneherald.test.js`: 5 tests.
- `tools/mutants/fb1020d_loneherald.json`: 22 mutants, all dead. With `soc1.json`, `egaudit5_a2.json`,
  `egeco_relay.json` and `egz_recap.json`: 281 dead, 0 survived, 1 equivalent as recorded (`soc1.json`'s S13, before
  this slice), 0 stale.
- The relay was still `world235` on its branch, never deployed. Its row was re-hashed in place for L1-1's change to
  `egBrain.js`, with the hash it carried before written beside it, as the table's undeployed rows are. Then the merge of
  main renumbered it `world236`, past the Witches' Festival and the Starfall's `world235`.
