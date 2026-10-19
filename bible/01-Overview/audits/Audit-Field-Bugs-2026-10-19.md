# AUDIT FB1019 (2026-10-19) - the 2026-10-19 field bugs, read cold

The owner, of the patreon chat's four threads (`01-Overview/bugs/Field-Bugs-2026-10-19.md`): **"fix anything not fixed
and audit. No band aids"**. This page is the audit: the five fixes on the branch (WALLET-WEIGHT, LAIR-REACH, LAIR-HOME,
LAIR-WALK, RAID-WON) as they stood at `56e31f045`, their pins, their mutants and their records. Each finding has its
verdict here; what it changed is written into the pages it touched, marked `AUDIT FB1019` with the finding's id, and in
the code beside the fix.

## How it was run

Four lanes, each a cold adversarial reader of the frozen head (Home.md's DO NOT FIX WHILE THE VERIFIER IS READING - the
tree was not touched until all four had answered; the mutation runs in isolated workspaces, `tools/mutate.mjs --jobs`),
told to reproduce a finding against the real modules before reporting it and to end on what it checked and found sound:

- **A** - WALLET-WEIGHT (`254f91ae5`): the figure against the carry weight, every surface that draws the wallet, the
  layout at 1280, 360 and 320 px in Chromium, the pins and the record.
- **B** - LAIR-REACH and LAIR-WALK: the frame's order, the bake and the wait, the walk on real bakes, its cost, the rest
  roll, the pins and the record.
- **C** - LAIR-HOME: every place a revenant body is made or ended, the claims, the pools' withdrawals, online, the fate
  flow, saves.
- **D** - RAID-WON: every route into the win on the real naval host and the real quest machine running Warm Ashes' own
  raids, the pirate attack's reward, the withdraw's pools, the legend's second wave, online and saves.

## Findings and verdicts

| | Finding | Verdict |
|---|---|---|
| A1 | should-fix: the shop's hover card read the pack's module model - never let go at the unmount - so its wallet card said a closed pack's figure (30.90 kg over 9 shards), and even a live one counted the pieces the shop lists on their own rows twice | FIXED: the model let go at the unmount; another window's card (`showItemHover`, `own: false`) says each piece where it lies. Pinned through the real shop (`wallet_weight.test.js`, the pack shut and the pack open) |
| A2 | nit: the `.wallet-kg` rule's last two properties unpinned | FIXED: the whole rule pinned |
| A3 | nit: no space between a holding's name and its weight - "Letters of credit0.50 kg" read aloud or copied | FIXED: the weight carries its own space (the pack's test DOM has no text nodes, and is not taught half of them), `white-space: pre` keeping it, the margin halved |
| A4 | nit: Wallet.md said the classic window's rows each show a weight; they show none - a piece's Info says it | FIXED: the record and `walletLedger`'s comment |
| B1 | should-fix: six failed path searches fell back to the very marker the walk refused - the normal case in a dungeon split by locked doors or one-way drops - and the six ran in the frame (~23 ms each on 11k polys) | FIXED: one flood of the way in's floor (`navmesh.js reachableFrom`, the port's own query in the file's head - the digest-pinned body untouched - over the body's locate), every candidate answered off it with no cap; the farthest of SD-REACH's candidates on it, else of every layout marker on it; SD-REACH's end only with no navmesh or none on the floor (past a locked door or a drop - a player's own means). Pinned on the auditor's split hall (`lair_walk.test.js`) |
| B2 | nit: a low sealed room stacked over the hall - its floor never made the mesh - was located onto the hall under it | FIXED: a point is on the walk's floor only within `REACH_LEVEL_M` of that floor's surface under it. Pinned on the auditor's stacked rooms |
| B3 | nit: the walk checked the marker, never the spot the revenant is set on about it (up to 4 m, a ledge's drop below) | FIXED: the spot on the walk's floor, else the marker itself |
| B4 | nit: the record said a door "stands open" in the bake (only an unlocked one); "where the player came in" is the first frame's feet; Revenants.md had no qualifier for the no-walk case; a rest in the bake's window now stands a due revenant over the player, unrecorded | FIXED: all four in the record |
| C1 | BLOCKER: staleness was read off the registry, so the lair's body slain, fled from or routed made the road's body it had left the revenant again - its loot twice, the player's taken pieces twice, a second escape and rank, a third body on the road | FIXED: a body a later stand replaces is LEFT for good (`_left`); a load and a new game forget the bodies. Pinned for all three ends (`lair_home.test.js`) |
| C2 | should-fix: a left body could still do a deed (a death no blow names, credited to its struck mark 31-119 s on) and take the registry back, the lair's body withdrawn for it | FIXED: a left body does nothing in its revenant's name - no deed, fall, kneel or oath |
| C3 | should-fix: "in a fight with me" read only the revenant's harm on the player - a beaten one chased home was made whole by its lair | FIXED: the player's on it too (its feud ledger open) |
| C4 | pins: the pending claim over a body, a dead record in the pool, the withdrawal's alert - unpinned | FIXED: each pinned; two records no change can fail now (a getaway's and a fallen record's body, never read once the record is not out) dropped from the list |
| D1 | should-fix: the small raid's one way to a win (its Leave Ship) let go of the raid's uid before the win, so its grace's waves took the open ground's ring and the record's main claim was false; a wave landing past both sweeps (an online grant's wait) stood on the deck again | FIXED: the uid the sea fight's until the quest ends (`raidEnded`), her ship gone or a raid a load carried ended as won all the same; a wave landing after its raid is over withdrawn as it lands (`raidAshore.late`, the deck's landing). Pinned on the real naval host and machine (`raidwon.test.js`) |
| D2 | should-fix: her ship gone under the fight tombstoned the raid with its crew left on the deck - the bug again, by another road | FIXED: its crew goes home (`raidAshore.crew`), her stranded boarders fight on |
| D3 | nit: `won` broke the quest from outside a tick, cutting the grace tick the pirate attack's victory gong rides | FIXED: `endQuest` alone - the gong rings (pinned) |
| D4 | nit: the legend's branch pinned only by text; the host's deps comment stale | FIXED: the legend's two waves run on the real host; the comment |
| D5 | should-fix, found writing this record after the four lanes had answered: D1's `late` stood at the deck's landing alone - a raid's wave standing up on the open ground's ring (a raid thrown back ashore) or below deck when its raid ended landed past both sweeps all the same | FIXED: `late` asked at all three landings (world.js tryPlaceFoe's ring; worldModes.js tryPlaceInteriorQuestFoe through the host's `raidLate`), a raid's foe alone (`WA_RAID_QUESTS`) - another quest's foe landing after its quest ended stands, as DFU's CreateFoe stood it in the tick it placed it. Pinned (`raidwon.test.js`) |

## Checked and found sound (the lanes' own words, shortened)

- A: the figure is the encumbrance's own (`itemWeight` - an instance weight, water, `hasNoEncumbrance`, `stackCount ??
  1`), worn crystals aside; the template weights; two-decimal agreement; every pack surface; the layout at three widths
  with 12,309 shards (every row one line, nothing spilling).
- B: a failed or dead-worker bake settles the wait; the bound caps a stuck cache read; re-entry and loads (the bake's
  key carries the anchor's cell); online forces the Enhanced AI; the Rift's `dungeonEnd()`; the PvP zone; the tie order.
- C: the dungeon loop's index (its door never splices); grants and the stream on a withdrawal; puppets carry `id: null`;
  sworn companions; the betrayal; the release after a lair claim; no deed while a body kneels; no record stuck out.
- D: no tombstone mid-tick; the machine tombstones before telling the host; raid quests carry no faction; the pools at
  sea (the deck, below deck); the legend's second wave its own raid; DFU's GameManager :710 reads the static team, so the
  `_ally_` count as enemies near in DFU too - `areEnemiesNearby` left as it is.

## Pins and mutants after

`wallet_weight.test.js` (3), `lair_walk.test.js` (4), `lair_home.test.js` (6), `raidwon.test.js` (8); moved:
`nav_h_host.test.js` (a won raid's uid kept till its end; a voyage's quest by its own uid), `navaudit_boarding.test.js`
(her ship gone: the crew home; endRaid's `crew` arm). `tools/mutants/wallet_weight.json` (12: 11 dead, 1 equivalent as
recorded - the model let go is memory once no other window reads it), `lair_walk.json` (16), `lair_home.json` (26),
`raidwon.json` (22), all dead. Re-aimed by content, each dead again: `auditfeud.json` AF-R6-load-keeps,
`revenantaudit.json` AUDIT-A2-the-load-keeps-the-mark and `rvn10.json` RVN10-load-ends-nothing (the load's line now
forgets the bodies, C1), `nav_h.json` NAV-H-the-gate-sailing-home (the Leave Ship's win, D1) and `navaudit_boarding.json`
NAVB-B4-the-stranded-raid-left-running (its crew home, D2). The broad run (`npm run test:changed`, 27,008 tests) moved
two more pins: `test/scenes/fb1012d_allyrace.test.js` (its fixture stood three returns, then swore the first body - left
for good under C1 and C2, it swears nothing now; the oath is the latest body's) and `test/systems/dw3_icons.test.js`
(`infoCard`'s `own`, A1); `fb1012d_allyrace.json`, `dw1.json` and `ui1.json` run again, all dead. `ui1.json`'s
AUDIT-UI-A3-a-repaint-on-every-resize did not parse (its `if` taken, its `else` left - older than this branch) and was
re-aimed by content to what it names: dead.
