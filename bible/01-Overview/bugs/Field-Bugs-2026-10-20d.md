# FIELD BUGS 2026-10-20d - a company of one, posted as one

One report from a player on the Discord, handed on by the owner ("Look at <the player's> complaint"). It is read on
the code as it stands at main's `d883d3778`. The Elite Breach is the port's own (`11-Multiplayer/Elite-Gates.md`).
Daggerfall Unity has no other players and no Discord, so there is no DFU member to depart from. Ledger A (ELITE-GATES)
already covers the herald. Audited cold before its merge: `01-Overview/audits/Audit-Field-Bugs-2026-10-20d.md`
(AUDIT FB1020d). Its changes are marked here with the finding's id.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "A reward for making it to redoubt 10 solo (yeah, they still did it first). I JUST HIT REDOUBT 20 SOLO AND BECAUSE I DID IT WRONG ITS SEEN AS COMPANY." | Every tenth Redoubt (10, 20, 30...) the herald posts names "<opener>'s company", and the news it is built from carried no company size. So one member got the words eight do. Inside the breach, the tracker also counted a called member who never came (AUDIT FB1020d L1-3) | fixed (LONE-HERALD). The reward asked for is the owner's call (NOT CHANGED) |

## LONE-HERALD: a Redoubt taken alone is posted alone

`src/net/eliteGates/egBrain.js` `heraldCompany` and `redoubt`; `src/net/eliteGates/egHerald.js` `validEgHeraldTell`,
`egHeraldFold`, `egRedoubtPost`, `egFirstPost`, `egSealPost`; `src/ui/eliteGates/egHud.js` `egHudModel` (AUDIT FB1020d
L1-3); `server-account/src/egHonours.js` `EG_FIRST_POST` (AUDIT FB1020d L1-4).

THE REPORT. A player says they took Redoubt 20 (Hall 100) of the Battlespire alone, and that the Spire counted the run
as a company. The first company to take Redoubt 10 also went alone, and the owner granted that player First of the
Spire (`Elite-Gates.md` section 19, SPIRE-FIRST).

READ FIRST. The run is not in this repository. This session cannot read the Discord channel or the account service's
boards. So the report was read against each place a company's size is said, and each was driven with a breach of one:

- **The boards** (`server-account/src/egHonours.js` `egDescentCompanies`, `egBracketOf`). A breach ranks by its
  entrants: every member admitted, earning or not (section 20, "Who counts"). The end receipt counts them twice. Its
  `n` counts the members admitted (`B.mem`). Its `co` is `entrants(B)`. The board takes the larger of those and the
  accounts that claimed. One member is the Alone bracket. Correct as designed.
- **The herald.** The tenth Redoubt's post was *<opener>'s company took Redoubt N of the Battlespire (Hall H) in T.*
  whatever the company. A Redoubt's news (`k: 'rd'`) carried the opener's name and the earners' names, but not the
  company's size. The hub had no way to word one member differently. The pin's breach, played with one member and with
  three, gave the same Redoubt post: *M0's company took Redoubt 10 of the Battlespire (Hall 50) in 20:08.* First of the
  Spire and a seal's post were built the same way. Only the Descent's top post calls a run Alone (*A new top of the
  Descent (Alone): ...*), and that comes at the breach's end, only for a breach begun at Hall 1. So when the Redoubt
  fell, the channel said "company".
- **The tracker** (AUDIT FB1020d L1-3; the first reading of this record called it correct). The call card says
  *Company of N* for the company called at the open. Inside the breach, the tracker said *S of N standing* over that
  same called company and drew a row for each member, whether or not they stepped in. A player whose party was called
  but never came read *1 of 2 standing* and a row for the absent member, all the way down. That is a second reading of
  "seen as company", and the herald and the Descent both disagree with it.

CHANGED.

- **The news carries the company.** A Valkynaz Redoubt's news says the company's entrants (`n`). That is the Descent's
  own count, so the post and the board never disagree about one member: nobody is admitted after the first wake
  (`egAdmits`), and nothing takes a member out of `B.mem`. The news leads with an entrant's name: the opener's where
  the opener entered, else the first who did (`heraldCompany`). An opener who never stepped in (AUDIT EG IV lane3 #11)
  is not of the company that went. A company of one is led by its member. AUDIT FB1020d L1-1: a company of two or more
  is led by its first entrant too, never an opener who stayed out (*M0's company ... - M1 and M2* was the post before).
- **The hub keeps it.** `validEgHeraldTell` reads `n` from 1 to 8. Anything else reads 0, which means unsaid: news a
  room stored before this relay posts with the company's words, as it always did. `egHeraldFold` hands `n` to the tenth
  Redoubt's post, First of the Spire and a seal's post.
- **The words.** A company of one is named by its member, alone:
  - *Mara took Redoubt 20 of the Battlespire (Hall 100) alone in 40:00, from Redoubt 10.*
  - *First of the Spire: Mara is the first ever to take Redoubt 10 of the Battlespire (Hall 50), alone, in 1:17:40.*
    No list of names follows, since it would be the one name again.
  - *The way below the Galleries is open. Mara is the first through, alone.*

  Two or more keep *<first entrant>'s company*: the opener's where the opener came. A name is held to letters, digits,
  spaces, apostrophes and hyphens, as every name the herald says is (`heraldName`). A name that says nothing is
  *Someone*.
- **The tracker counts who came** (AUDIT FB1020d L1-3). Until the breach's first wake, the tracker counts the whole
  called company, since any of them may still answer. After the wake, the door is shut, and it counts and lists the
  entrants: the gather's own rule (`egLink.js` `egGatherOf`). A called member who never came is no company. A company of
  one shows no company line. The recap still lists them as *was not there*.
- **First of the Spire's letter** (AUDIT FB1020d L1-4) said *Your company was the first ever...* to a player who went
  alone. It says *You were the first ever...* now, words for a company or for one. The letter is sent once, at its
  account's next balance read. So it reaches the one account on the list only if that read comes after this deploys.

NOT CHANGED, AND THE OWNER'S TO DECIDE.

- **The boards.** The report's "because I did it wrong" may also mean the run did not begin at Hall 1. A breach begun
  at a deeper Redoubt ranks on the Depths, never on the Descent's Alone bracket (section 20; AUDIT EG0 A12: the start
  ratchet cannot buy a Descent row). And a companion who answered the call, then fell, forsook or went home, still
  counts toward the company ("every member admitted, earning or not"). That puts a run in the Few, and its tenth
  Redoubt's post reads *<opener>'s company*, with no name for the one who took it (AUDIT FB1020d L1-2). Both are the
  arc's rules, so neither was changed. If either is what the player meant, their Depths and Deepest Redoubts rows stand.
  This session could not read which it was.
- **The reward.** No honour is for going alone. First of the Spire is for the first company to take Redoubt 10, and
  that company happened to be one. A Redoubt 20 holds Wellhead-Walker and The Burning Stair for every earner of it
  (section 19's table). An honour for a solo Redoubt 20, or for the first to reach it, is a grant only the owner makes.
- **The law.** A company of one is still a company to the Spire's law (section 13.2, THE ERRAND FLOOR: "a party of one
  is a company, and the Alone board is real"; section 6.1). Only the words and the tracker's count changed.

The relay is `world236` (`world235` on its branch, renumbered past the Witches' Festival and the Starfall's `world235` at the merge of main). The room-to-hub tell gains one field (`n`). No frame a client reads changes shape, so the
relay and the clients may deploy in either order. A tell with no size is posted with the company's words, as before.
The herald runs on the relay, so the posts change once the relay is deployed by hand. The tracker and the letter ship
with the client and the account service.

Pins: `test/net/eliteGates/fb1020d_loneherald.test.js` (5) plays breaches to their Courts and reads each through the
hub's read and reckoning to the words:

- one member, and three;
- a pair with one member fallen, forsaken, or gone home at Redoubt 5's rest;
- an opener who never stepped in, with one or two going in their place.

It also reads the tracker from the relay's own state, through the wire and the client's fold. `egeco_herald.test.js`
tells a company of one's news through the relay's room to its hub (AUDIT FB1020d L2-3), and `egz_recap.test.js` holds
the letter's words. `tools/mutants/fb1020d_loneherald.json` holds 22 mutants, all dead. `egaudit5_a2.json`'s two herald
records and `soc1.json`'s version record were re-aimed by content. The arc's record is `11-Multiplayer/Elite-Gates.md`
section 20, LONE-HERALD.
