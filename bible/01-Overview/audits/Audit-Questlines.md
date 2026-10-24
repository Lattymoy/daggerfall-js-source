# AUDIT QUESTLINES (2026-10-19) - the questline overhaul, audited whole

The owner, of the questline overhaul (pull request #1047, QL1-QL16 - `06-Systems/Questlines-Arc.md`): **"Audit
everything built. Ensure perfection"**. This page is the findings, each with its verdict. What the audit changed is
written into Questlines-Arc.md's sections as they now stand, each change marked AUDIT QUESTLINES with its finding; the
departures from DFU it made are the Port-Ledger's QUESTLINES rows.

## How it was run

Eight cold lanes on a frozen snapshot of the branch (fe033c256, a detached worktree; the diff against main's 9e00d52e9),
each an adversarial reader told to prove a finding by a repro (a node script over the snapshot's own modules, its output
pasted) or a trace, and a missing test only by a probe mutant the suite leaves alive. Then six fixers, each on files no
other held, in the live tree, and the author on the rest: every finding reproduced in the live tree before it was
fixed, and pinned by a test whose probe mutant dies. At the merge of main a seventh, VOICE, brought the overhaul's own
text into the game's voice (main's `10-UI/Voice.md`, VOICE1 and VOICE2, cut after this branch was - VOICE-QL below).

| Lane | Over | How |
|---|---|---|
| LAW | the layer's law - the switch, the stamp, the bindings, the latches, the settle - and every sheet | all 283 sheeted quests on the real bridge, 60 random walks each (16,879 walks, 16,608 ended); the record's claims as probe mutants |
| BRANCH | the 31 branch patches, the five actions, the `ask`'s box chain, the hand-in kit, a branched quest shared | every `ask`'s every answer (28 asks, 56 ways) and the three mends run to their ends through the real bridge; every patch's words measured against the classic skin |
| REWARD | what an outcome pays - the gold, the choice of three, the named pieces, standing - and what the window promises | 7,200 choices rolled twice; three players over 200 seeds each for the named pieces; every `give pc` in the pack read; the tiers measured against a dungeon's drops |
| LINES | the thirteen questlines, their 35 scripts, the runner, the guilds' ladders | every line run to its end through every last-step choice (24 runs) and its 41 failure paths in the real bridge and runner; the scripts' words read against the world they run in |
| SERVICE | the account service's claim, its witness SQL, migration 0133, the client's door | forged bodies, races (20 opens; 30 mixed claims and 20 keeps), a guest who registers mid-line, a five-minute outage, receipts held across an opening - over the Worker with the real migrations |
| ACTS | the acts feed: 23 kinds, 31 producer sites, the hosts | every kind swept both ways; a guest and an outage against the service; a probe mutant at every producer site |
| UI | the Quests tab's parts, the herald, the tracker, the lens, the Tutorials page | the real pause window in Chromium over a vite server of the snapshot (Playwright), 14 languages at four sizes, the classic logbook, the keyboard and the pad |
| DOC | the record, the pins, the mutant records, the pull request's notes, the locales, the tools | 35 probe mutants of the record's claims against 195 test files; every count in sections 0, 3 and 4 recounted |

| Fixer | Findings | Files |
|---|---|---|
| FLOW | BRANCH-1, -2, -3, -7, -9 and -10 (the code), -11, -12, -14, -19; REWARD-1, -2, -15 (the state); DOC-19, DOC-29 | `qlActions.js`, `qlState.js`, `shareActions.js`, `questShare.js`, `machine.js`, the bridge's choiceBoxes, `guildServiceWindows.js`, `questData.js`; `test/systems/questlines/ql4_flow.test.js` |
| PATCH | BRANCH-4, -5, -6, -8, -9 (the pin), -10 (the law), -13, -15, -16, -18; the law and the data of REWARD-5, -6, -12 and LAW-1, -3; LAW-7, -8, -9, -13; DOC-27, -32, -35 | `patches/`, `sheets/`, `qlPatches.js`, `tools/qlPatchKit.mjs`, `tools/qlSheetLaw.mjs`, `tools/qlCheck.mjs`, `tools/qlSheetDraft.mjs` |
| SCRIPTS | LINES-4 (the words and the gold), -8, -9, -10, -23, -24, -26, -27; the words of ACTS-4 and ACTS-7 | `quests/QL*.txt`, `sheets/questlines.json` |
| ACTS | ACTS-3 to ACTS-9 | `qlActs.js`, the producers, `src/systems/questlines/qlEliteFoe.js` (new) |
| REWARD | REWARD-3, -5, -6 and -12 (the code), -7, -9, -10, -11, -13, -15; LAW-6, LAW-10, LAW-11 (the layer); LINES-20; DOC-5 to DOC-14 | `qlRewards.js`, `qlLayer.js`, GivePc, `itemInfo.js`, `test/honestItems.mjs`; `test/systems/questlines/ql3_rewards.test.js` |
| UI | UI-4 (the window), UI-5, UI-6, UI-8 to UI-11, the rest of UI-12, UI-13, the rest of UI-14, UI-18, the rest of UI-19 | `qlJournal.js`, `enhancedMenu.js`, `enhancedChronicle.js`, `enhancedStyle.js`, `pauseDoor.js`, `notebook.js`, `tutorialCatalogue.js`, the qlLayer's tutorial site and the runner's refusal; `test/ui/questlines/ql2_pause.test.js` (new) |
| VOICE | VOICE-QL (the author's, at the merge) | the sheets' text, `quests/QL*.txt`, `qlLines.js`, the questlines' t() words; `test/systems/questlines/qlvoice.test.js` (new) |
| the author | SERVICE-1 to -9; ACTS-1, -2, -10, -11; LINES-1 to -3, -5 to -7, -11 to -22, -25; LAW-1 (the code), -12, -15; UI-1, -2, -7, -12 (witnessed), -14 (offline), -16, -19 (the titles), -20; DOC-15 to -18, -20, -21, -31; the hand-offs (REWARD-8's and REWARD-13's bridge doors, REWARD-14, LAW-11's look); the record | the service, the runner, the lines, the bridge; `test/systems/questlines/ql1_law.test.js` (new) |

Severity (the lanes' brief): **HIGH** a player can lose progress or pay, a quest or line cannot be finished, a stuck
state, an exploit that mints gear or titles, a wrong answer from the service; **MED** wrong behaviour in a reachable
case, text a player reads that is wrong, or a test gap a probe mutant proves; **LOW** an edge, a cosmetic flaw, a
record sentence the code contradicts; **NIT** a word, a dead line, a stale comment.

152 findings: 149 from the lanes (7 HIGH, 67 MED, 53 LOW, 22 NIT, by their tables) and three the author found applying
them (ACTS-10, ACTS-11) and merging main (VOICE-QL). Four of the HIGH are one defect read from three sides - a witnessed step's opening lost to a
guest's answer (LINES-1, SERVICE-1, ACTS-1) or to an outage (SERVICE-2), so its deed could never pay.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| LAW-1 | HIGH | A loyal M0B11Y18 run (the letter to the Queen, her hunt run out) settled `betrayed` - "You sold the dead man's letter", the Queen -5, K'avar +5, no gear: the catch-all's yield fell back on the first outcome that was no failure; 121 sheets had no `done`, and four paid a betrayal so | FIXED: the success fallback is the sheet's own - its `success`, else its `done`, never a guess (`qlLaw.js` fallbackOutcome); the sheet law requires one wherever the quest can end a success no row is sure to hold, and refuses a failure, a betrayal or a choice's task; `success` written on 66 sheets (55 of DFU's families', 11 of the questlines'); M0B11Y18 gains `outrun` (the Queen's hunt run out: standard, the Queen +2) |
| LAW-2 | MED | = REWARD-3, and record 2.3 wrong twice ("pays by the outcome it ends on") | FIXED with REWARD-3; record 2.3 restated |
| LAW-3 | MED | = REWARD-6, wider: 16 main-quest sheets `standard` over scripts that never pay; four outcomes `standard` on a path that pays by `get item` (N0B00Y17 searched, K0C00Y04 told, K0C00Y09 slain, S0000002 overtaken); 24 no-gear sheets still promised gear | FIXED in the data and the law: the main quest's steps whose scripts never pay are `none` or `own`, the four paths `own`; the sheet law refuses a gear outcome on a script with no payer, or on a task that ends the quest unpaid (unless the start-up pays). The row's `gear` and the window's promise with REWARD-6 and UI-4 |
| LAW-4 | MED | = REWARD-1 | FIXED with REWARD-1 |
| LAW-5 | MED | = BRANCH-12 | FIXED with BRANCH-12 |
| LAW-6 | MED | Four claims of the record held by no test - the catch-all's yield, the tombstone's settle, the ending's `moved` guard, the letter rule, the paid guard on gold (probes M1-M5 lived) | FIXED: each pinned through the real bridge on a quest of the pack (`ql1_layer.test.js`) - 40C00Y00 paid settles `done`, $CUREWER tombstoned settles `cured`, M0B00Y06 ended twice in its grace settles once, QLWR04's courier letter leaves it unpaid, a second gold reward is never scaled again; M1-M5 recorded (`ql3_rewards.json`). The new pin's flake mended: the tiger's `say` on the script's last task breaks the next tick (Quest.cs reads the break before each task) |
| LAW-7 | LOW | 40C00Y00's `both` unreachable, its `done` only through the yield | FIXED: `done` on `_bonk_`, `both` on all[`_S.17_`, `_bonk_`]; pinned |
| LAW-8 | LOW | A player cured at the temple was told by $CUREWER's outcome "a lycanthrope still" | FIXED: `healed` (ended, `_S.05_` never set; own) before `failed`; pinned |
| LAW-9 | LOW | An outcome bound to a mid-quest act settled as a success on a timeout: M0B40Y05's spriggan killed and never reported filed "The spriggan is dead" and struck it on the ladder | FIXED: M0B40Y05's `slain` on `_victory_`, `peace` on all[`_victory_`, `_notkill_`]; B0B81Y02's `artifact` and `refused` need `_success_`; pinned. DECIDED, left: N0C00Y11's map, K0C00Y07's freed, A0C00Y16's five and A0C01Y06's slain each pay the deed at once, and the driver filed no failure as a success |
| LAW-10 | LOW | 21 translation keys shared by two lines in 19 sheets (`QL.<quest>.<id>`, ids unique only within a list) | FIXED: keyed by kind - `QL.<QUEST>.o.<id>`, `.r.<id>`, `.b.<id>[.<choice>]` (`qlLayer.js` sheetTextKey); pinned. No pack ships them yet |
| LAW-11 | LOW | At 10 Hz the journal's walk rebuilt every stamped quest's row and every line's and ladder's | FIXED: a row kept while what it read stands, an ended quest's unread (`qlLayer.js` rowOf); the lens's look (`questLog({ windows: false })`) reads no line or ladder; pinned - 38 quests 0.83 to 0.07 ms a walk |
| LAW-12 | LOW | The vampire cure's sweep tombstoned the clan's quests without settling them | FIXED: the sweep tombstones `{ ended: true }` (`world.js`), as the werewolf's cure does. The settle is LAW-6's $CUREWER pin; the host's line has none of its own |
| LAW-13 | LOW | `tools/qlSheetDraft.mjs` missed a task linked to a global variable (S0000003's draft bound `_no_`) | FIXED; pinned (S0000003 binds `_S.10_`) |
| LAW-14 | NIT | = REWARD-15 | FIXED with REWARD-15 |
| LAW-15 | NIT | The bridge's deps read `questlines` before its `const` - `?.` cannot guard a temporal dead zone | FIXED: `let questlines = null` first (`questBridge.js`) |
| BRANCH-1 | MED | In a party the `ask` fired on every copy: the member's answer decided the sharer's copy under the sharer's own box, whose late answer then started the other way - the kept gold AND the standing for giving it up (R0C11Y26) | FIXED: a received copy kept in step with a party asks nothing - the sharer chooses, the copy takes it on the resync; with no party, or after a load, it asks its holder (`qlState.js` `received`, `qlActions.js` QlAsk); the latch the quest's, by the ask's place, so a resync's rebuilt ask never asks over the box; an answer counts only on the ask as it stands, unanswered, no choice set, the quest not ending; pinned (party of two: the member never asked, one way only). FIXED after (QUEST-AUDIT III SHARER-GONE, `Quest-Audit-III.md`): a copy shared on is its holder's to answer, and a copy whose sharer has gone quiet two minutes asks its holder |
| BRANCH-2 | MED | A step with `ql act` could not be shared once it had counted - every resync refused (`mismatch`): QlAct's `from` was in no share law (25 of 35 line scripts) | FIXED: `shareActions.js` holders - the count's start is the holder's own, checked, never taken from the partner; pinned. (A questline's step is never shared now - REWARD-2; the law holds any `ql act` that is) |
| BRANCH-3 | MED | An `ask` whose box went unanswered stuck until a reload: a pick step with no PICK00I0 art yet advanced past itself | FIXED: a pick the window cannot draw goes to its onCancel, told why (`PICK_UNSHOWN`); choiceBoxes settles the chain with null; QlAsk asks again ASK_AGAIN_TICKS (300, 30 s) later; pinned. LEFT, said: a host that abandons a window without closing it; the Enhanced Plus picker still waits on PICK00I0 |
| BRANCH-4 | MED | M0B50Y09: the fee waived lost DFU's map to a second dungeon (`_S.06_` reads `_victory_`, which only the fee's way sets); the kit never checked a reward task's readers (16 accepted pairs have one) | FIXED: M0B50Y09 re-cut by the kit (`--replace --readers copy`): the waived way's own `_qlaltS06_` reveals the map; the kit refuses a reward task another task reads, or with `--readers copy` gives the second answer a copy of each plain reader; of the 16, only M0B50Y09 shipped; pinned |
| BRANCH-5 | MED | Four knightly hand-ins (B0B40Y09, B0B40Y08, B0B60Y12, B0B80Y17): "take it" was DFU's `give pc nothing` - taking was strictly worse than refusing | FIXED: "take it" gives its gold - B0B40Y09's and B0B60Y12's own `_gold_`, B0B40Y08's and B0B80Y17's new `Item _qlgold_ gold` (DFU's formula); the flagship pin compares what each way GIVES (gold, an item, gear, a step, standing and legal, the script's own repute), never the pay's name; pinned |
| BRANCH-6 | MED | Every `ql paid` refusal dropped DFU's QuestComplete box where it was the story (L0A01L00's "full member of the Dark Brotherhood", P0A01L00's "Welcome to the family", B0B60Y12's walking dead) | FIXED: where DFU pays `give pc nothing` the refusal keeps it and its box (the four knights'); a story message of its own (1903) on the refusal of L0A01L00, P0A01L00, B0B70Y14, B0B70Y16, B0B50Y11 and A0C01Y03; the kit too; pinned |
| BRANCH-7 | MED | The question could come before the words that set it up (QlAsk's box in front): A0C41Y18's coward's way before the sage's 1025 | FIXED: the chain waits behind the boxes already up (`ServiceFlowWindow.push` `behind`); pinned |
| BRANCH-8 | MED | On the classic skin two questions ran off the box and seven answers off the pick list | FIXED: every row of a patch's words at most 50 characters, every answer one line of at most 30 - 61 rows and 44 answers over, now none; the kit wraps a question at 44; `tools/qlCheck.mjs` patchWidthProblems; pinned |
| BRANCH-9 | MED | An `ask` naming a missing message stranded its quest - it marked itself done and asked nothing, and the reward waited for ever | FIXED: QlAsk says so once as an error and asks with what it has, complete only on an answer; `tools/qlCheck.mjs` patchMessageProblems - every id a patch's lines name exists, and no patch word takes a script's own id; pinned |
| BRANCH-10 | MED | An `outcome _x_` its sheet lacks disabled the outcome: the quest ended a success with no standing, no gear, filed `done` | FIXED: QlOutcome writes only an outcome its sheet has (another is said, and the sheet's bindings settle); the sheet law refuses the line; pinned |
| BRANCH-11 | MED | choiceBoxes - the chain the player answers through - driven by no test | FIXED: driven through a real ServiceFlowWindow (the question, the pick, Escape, a second pick); pinned |
| BRANCH-12 | LOW | A flagship quest begun on DFU's script could not be shared to a receiver whose switch was on, and a shared one stopped syncing | FIXED: a copy's shape is read with its own stamp (`machine.js` parseQuestShape, the seam's `getQuestSourceLines(name, questlines)`); pinned |
| BRANCH-13 | LOW | A0C01Y13's `lawful`, K0C01Y10's `burned` and P0B01L02's `kept` ended as DFU failures | FIXED: A0C01Y13's lawful way `ql paid` (a success, legal +5); K0C01Y10's burned and P0B01L02's kept are the questor's failures by design, and their sheets say so (`failure`); pinned |
| BRANCH-14 | LOW | A questline's step restarted with the switch off stayed unstamped for life - its `ql act` deaf | FIXED: a stamped quest restarts read with its branch and stamped (`machine.js` restartQuest); pinned |
| BRANCH-15 | LOW | The kit's "already branched" guard read the script before the patches, so `--write` replaced a filed branch silently | FIXED: a quest with a filed branch is refused unless `--replace`; pinned |
| BRANCH-16 | LOW | Questions that repeat or run ahead of the questor's greeting (B0B70Y14's "she lied to us" before the rogue mage is named) | FIXED: the questions of P0B01L02, R0C11Y16, A0C01Y03, B0B70Y14, K0C01Y10, L0A01L00, L0B60Y10 and M0B21Y19 follow DFU's greeting |
| BRANCH-17 | LOW | Record 3: the mends "said in its family's file" - the files hold no such words; M0B50Y09's map and C0B00Y02's dropped `say 1025` recorded nowhere | FIXED in the record (section 3) and the Port-Ledger's QUESTLINES row |
| BRANCH-18 | NIT | QL_MESSAGE_BASE's comment: DFU's ids "never reach" 1900 - A0C01Y13 has 2000, 2001, 2005 | FIXED |
| BRANCH-19 | NIT | QlAsk's docblock (re-arming); a dead `showChoice` guard | FIXED |
| REWARD-1 | HIGH | A shared copy's reward tier was the sender's: a level-21's town errand paid a level-1 member a tier-4 choice; a hand-built envelope any tier | FIXED: a received copy arrives at tier 1 and the machine sets the holder's own as the layer's stamp reads it (`qlState.js` receivedState, `machine.js` receiveSharedQuest); pinned (21 to 1 is tier 1, 1 to 21 tier 4, a tier-4 envelope tier 1) |
| REWARD-2 | HIGH | A questline's last step could be shared, and paid its named piece and gear to members who never began the line | FIXED: a questline's step is refused for sharing at both ends, in the player's words (`questShare.js`, reason `questline`); pinned |
| REWARD-3 | MED | M0B00Y16 never paid its outcome's gold: GivePc scaled by the outcome holding then, before `rescued` (greater) settled | FIXED: GivePc's moment records what it paid (`{ base, factor, shares }`, kept in the layer's save); the ending pays what the settled outcome owes above it (`qlRewards.js` goldStillOwed - never taken back, nothing for a failure or `none`) through the quest's gold door, with a HUD line; pinned (both orders, a save between) |
| REWARD-4 | MED | = BRANCH-5 | FIXED with BRANCH-5 |
| REWARD-5 | MED | A named piece took whatever base the roll drew ("Oathkeeper's Dragon Helm" a pair of Gauntlets), the pack prefixing the metal | FIXED: `named: { name, kind, base }` - the card made FROM its base through the same fit, no metal before its name (`itemInfo.js` withholdsMaterialPrefix, the item's `qlNamed`), unnamed for a holder who cannot wear the base; the sheet law checks the base; pinned |
| REWARD-6 | MED | The Quests tab promised gear on 24 quests that can never pay it, and on 11 whose scripts never pay | FIXED in the data and the law (LAW-3) and the row: `rowOf`'s `gear` says whether the quest can still pay a choice of gear, and the window promises gear only then (UI-4); pinned |
| REWARD-7 | MED | Tier 4 made 15.6% of a choice's cards Legendary (39.7% of choices held one), and a social quest's tier is the level band - against the record's own measure, "ONE piece ... at Magic or Rare" | FIXED: tier 4 is Rare with no rung up (TIER_FLOORS) - tiers 3 and 4 always Rare, no quest's choice ever Legendary, a greater step's included; pinned |
| REWARD-8 | MED | A waiting reward dropped silently at the cap; a classic-skin player sent to a Quests tab the journal lacks | FIXED: an offer the cap cuts is said in the HUD (`ql.reward.dropped`); the Quests tab on either skin, and the HUD's way to it by skin (UI-6); pinned |
| REWARD-9 | MED | QL3's reward law unpinned - 8 probe mutants lived | FIXED: `ql3_rewards.test.js`; `test/honestItems.mjs` gains the choice of three (576 items, 141 named, 0 findings; the item law's sweep 87 to 88 producers); all 8 recorded |
| REWARD-10 | LOW | A class barred from every armour was offered two pieces of it | FIXED: a failed armour draw gives its place to a jewel; pinned |
| REWARD-11 | LOW | In a party the HUD named the share of the unscaled purse | FIXED: GivePc scales before the party's split; pinned |
| REWARD-12 | LOW | A standing name read an occupation's row (`Noble` moved Azura); a misspelt name moved nothing, unsaid | FIXED: an individual row only (`qlRewards.js` factionIdOf); the sheet law refuses another; pinned |
| REWARD-13 | LOW | Take cut the offer before the piece was given - the `?exterior` host, with no door, lost it | FIXED: no door, nothing listed and nothing cut (the offer kept in the save); with one, the piece first; the bridge hands the door only where the host has one; pinned |
| REWARD-14 | LOW | The record missed two departures: standing moves flat where DFU propagates; six failure outcomes cost standing online despite QFAIL-FREE | DECIDED: standing moves flat, each named faction once - a departure from DFU's propagation, named in the Port-Ledger. FIXED: a failure's standing obeys QFAIL-FREE online, and stands offline (`qlLayer.js` ending); pinned |
| REWARD-15 | NIT | `ql.offer` declared, read and reset, never written; the reward header's words | FIXED: no `offer` in the state; the header says the layer's offers and `moved` |
| LINES-1 | HIGH | = SERVICE-1, from the line: a witnessed step lost its title (and through the Burning Doors' breach, the Weir Key and Covenbane) | FIXED with SERVICE-1 and SERVICE-2 |
| LINES-2 | MED | Guests got the five service lines but could never finish a witnessed step - failed and offered again for ever, unsaid | FIXED: a line the service pays opens only for a registered account (`opens.account`, the door's `guest()`), and says so; THE COURT CRAFTER too (the Professions refuse a guest); pinned |
| LINES-3 | MED | THE BAY'S TROUBLES opens at level 6, but QLIW02 cannot finish below Renown 10 (no revenant rises online below it) | FIXED: QLIW02 needs `renown` - it waits, "Opens at Renown 10."; pinned |
| LINES-4 | MED | QLCH03's keep could pay nothing while "Ysolde slides the key across the table" - the key is the account's, once; an account that sealed first could never have it | FIXED: the keep pays the Guild's fee in gold as the seal does; 1030 and 1040 say a house has the key once; the service pays the key on the end's own `keep` while the account has none (a first character's `seal` bars nothing), and a keep that finds it given is answered `keyHeld` and told; pinned |
| LINES-5 | MED | The Mages Guild's and the knightly orders' ladders said "(not yet)" of rungs the guild already offers by level | FIXED: a rung is reached while the guild offers it (`guilds.js` questRankFor); pinned |
| LINES-6 | MED | An introduction began with its feature off and never finished (Loot rarity, The King's Gambit, the sea) | FIXED: a step's `needs` - it waits and says so ("Opens with Loot rarity on."); pinned |
| LINES-7 | MED | A step whose quest throws was started again every tick | FIXED: a step's quest gone without its end is offered again a day later (`qlLineRunner.js` dropped, by the bridge's onQuestEnded); pinned |
| LINES-8 | MED | QLIW02's letter was lost when the revenant knelt outside a town; "Wait in a town for word" untrue | FIXED: the purse and the end wait for the letter; the objective says to be in a town by day; pinned |
| LINES-9 | MED | "3E 406" and "eight years" in the Weir Road's words - the online calendar runs a game year a real month | FIXED: no line counts years or names the year it is; the drift said against decision 5 (the record); pinned |
| LINES-10 | MED | The introductions' givers change name and town between steps while the words treat them as one | FIXED: a later step introduces its giver as a new person sent on by the last; Corvane "keeps no room long"; pinned |
| LINES-11 | MED | Nothing checked that the end claim carries the outcome as its `choice` | FIXED: pinned through the real runner, door and Worker |
| LINES-12 | MED | A step whose script will not parse - its wait unpinned | FIXED: pinned with LINES-19 |
| LINES-13 | MED | ended()'s step guard unpinned | FIXED: pinned |
| LINES-14 | LOW | The knightly orders' ladders unpinned | FIXED: pinned |
| LINES-15 | LOW | A temple member's ladder left out its own divine's quest | FIXED: a temple's divine's rows on its ladder; pinned |
| LINES-16 | LOW | Adult member quests the list never offers by default stood "to come" for ever | FIXED: an adult row only while the setting allows one; pinned |
| LINES-17 | LOW | Every eligible line began on one tick - eleven letters in a level-12 character's first hour | FIXED: one new line an hour; pinned |
| LINES-18 | LOW | A running copy of a step was adopted without its opening | FIXED: its opening asked; pinned |
| LINES-19 | LOW | A step that cannot start showed only "waiting" | FIXED: "Its next step could not begin here: it will be offered again."; pinned |
| LINES-20 | LOW | A named piece was spent when rolled - an offer cut at the cap lost it for good | FIXED: spent when TAKEN; one waiting offer holds a line's name; the cap cuts the oldest unnamed first; pinned |
| LINES-21 | LOW | A claim answered after a load wrote into the newly loaded character | FIXED: a load's generation; pinned |
| LINES-22 | LOW | Record 5.3, "a title once a character" - titles and steps are the account's | DECIDED: once an account, as the service keys them; the record says so |
| LINES-23 | LOW | QLBD05 called the Order of the Hour "keepers of the Covenant" (the Covenant is Alessia's, the Emperors' blood) | FIXED: reworded; the named piece "Seal of the Hour" |
| LINES-24 | NIT | QLBD01 paid 150 to 250 in a tier-3 line | FIXED: 300 to 600 |
| LINES-25 | NIT | A line's `tutorial` read by nothing | FIXED: dropped |
| LINES-26 | NIT | Quest items show as "Holy Tome", "Talisman" (the Weir Key), "Parchment" | FIXED: every letter a line hands over ends on a one-line sign-off naming its sender, so the pack names it by who sent it; pinned. LEFT: "Holy Tome" (QLBD02) and "Talisman" (QLCH02's Weir Key) - DFU's Item grammar names no item, and the template that would name the key mints the Spire's real one |
| LINES-27 | NIT | QLIT01: "Ask me about it tomorrow" - the next step comes an hour later | FIXED |
| SERVICE-1 | HIGH | A guest who registers mid-line never gets that line's title: the guest's open answered `guest`, filed as opened, never asked again; the end then opened the step after the receipt | FIXED: an `open` writes the opening for any step of a paid line, a guest's too - it pays nothing and reads nothing; the runner files an open only on `opened`; pinned |
| SERVICE-2 | HIGH | An open the runner gave up on (five tries a minute apart) left a step no deed could witness; the Burning Doors' breach also took Covenbane and the Weir Key | FIXED: the witness's window is the LINE's first opening; every step of a paid line is opened at its start; a claim is never given up (CLAIM_SLOW_MS after CLAIM_TRIES, and at the next load); an end not witnessed yet is `unseen`, asked again; pinned |
| SERVICE-3 | MED | No test joined the runner, the door and the Worker - three probes lived (the load's re-asked open, the end's outcome, the route) | FIXED: three tests drive the real runner through the real door into the Worker; the probes die |
| SERVICE-4 | LOW | The Weir Key behind one plain breach, not the Burning Doors witnessed whole | FIXED: the Covens' Hoard's `after` is the Burning Doors' title held (Doorwarden); pinned |
| SERVICE-5 | LOW | "A receipt from before the line asked opens nothing" false: a held receipt counts for its life, and one receipt witnessed every open step | FIXED: one receipt, one step, in the line's order (`seen_at`); the record states the true bound; pinned |
| SERVICE-6 | LOW | Covenbane paid when QLCH03 STARTS (an opening asked again laid its `done_at`) | FIXED: a claim says its phase; only an `end` pays; pinned |
| SERVICE-7 | LOW | The pay's telling: (a) the answer's `keys` dropped; (b) no HONOUR-BANNER for a questline title; (c) a title answer lost to a timeout after the commit - the retry answers without `title`, never told | FIXED (a), (b): the balance restacks the pack's keys at once; a title is the HONOUR-BANNER and a HUD line; pinned. (c) FIXED: a title step's end answers the line's title HELD (`titleHeld`) when this claim did not lay it, and the runner tells it - banner and line - only for a claim an earlier attempt of which went unanswered (offline, a timeout, a 5xx), or one a load re-asks unanswered; an answer that arrived is never told twice, and another character of the account finishing the line again hears nothing; pinned through the real runner and Worker (QL12-held-title-never-told, -told-every-answer, QL12-restored-end-never-lost, QL12-service-answers-no-held-title) |
| SERVICE-8 | LOW | A title once an account, not a character; after a `seal` on one character a `keep` on another never paid, unsaid | FIXED: the record; the key on the end's own choice, `keyHeld` told (LINES-4) |
| SERVICE-9 | NIT | relayversion's comment "world222"; record 5.3's "Hourwitness"/"Satakalwitness" against the badge's words; accountQuestlines' docstring without `keys`; the refusals' words shown nowhere | FIXED: the record's words are the badge's; the docstring names `keys` and `keyHeld`. The refusals' words drawn on the step (UI-19). And relayversion's TITLES note, at the merges that numbered the relay world228 (`world222 on its branch`) |
| ACTS-1 | HIGH | = SERVICE-1/-2, from the act: the client counts a deed the service never witnesses, and the window tagged the step "witnessed" whatever the service said | FIXED with SERVICE-1 and SERVICE-2; the step's mark is the service's answer - "needs a witness", "witnessed", "not yet seen" - and a line's title waits on every deed seen; pinned |
| ACTS-2 | MED | Lines open whose only producer cannot fire: The King's Gambit off, Loot rarity off, the sea off, a guest's crafts | FIXED with LINES-2 and LINES-6 |
| ACTS-3 | MED | 19 of 31 producer sites driven by no test; 15 probes lived | FIXED: a driven case per site, through the real producer; the lane's 15 and 12 more die |
| ACTS-4 | LOW | `piece-crafted` heard for a dish cooked at a fire | FIXED: never a dish (`net/profBook.js` craftOne); QLIP03's words; pinned |
| ACTS-5 | LOW | `star-taken` farmed by toggling one star; a lost answer re-sent counted none | FIXED: each star once, counted by the book whose change took it, kept across a reload; pinned |
| ACTS-6 | LOW | `arena-won` counted bouts between players | FIXED: a ladder bout only - the relay's `pve` verdict, or this screen's own; pinned |
| ACTS-7 | LOW | `revenant-knelt` heard when someone else beat the player's revenant | DECIDED, left: one of the player's OWN revenants made to kneel, whoever struck - a revenant is the player's own and comes for them alone; QLIW02's words say so (record 4.5) |
| ACTS-8 | LOW | The hosts grew: the elite foe's whole condition in buildDungeonContext, acts in createNavalHost and createEgClient | FIXED: the elite foe's act its own module (`qlEliteFoe.js`), the dungeon host one line of wiring; the naval act one helper with the crew's win; the Redoubt's acts at module scope; pinned (the sweep). Left, said: bootWorld's and bootExterior's wiring, within their ceilings |
| ACTS-9 | NIT | Record 4.5: `gem-socketed` said by the Reforge alone | FIXED in the record: the Reforge and the pack's socket press |
| ACTS-10 | LOW | (the author's) Foraging's Basket counted an egg as a plant gathered | FIXED: an egg is no plant (`foragingInstall.js`); pinned |
| ACTS-11 | MED | (the author's) Online, a ship another captain stands, struck to the player's guns in her stander's word, said no `ship-struck` - a group's other captains could never finish THE HARBOURMASTER'S WORD | FIXED: both arms say it through one helper with the crew's win (`navalHost.js` struckToMe); pinned |
| UI-1 | MED | The tracker could name an OPTIONAL objective instead of the required one (23 sheets list one first) | FIXED: the first open objective the quest needs (`questLens.js` currentObjective); pinned |
| UI-2 | MED | The herald's "Objective done" lost its words when the script logged a tick later | FIXED: a kept objective notice keeps its words (`questHerald.js`); pinned |
| UI-3 | MED | = REWARD-5 | FIXED with REWARD-5 |
| UI-4 | MED | = REWARD-6, and the Tutorials' page made the same promise | FIXED: the objectives block promises a choice of gear only where the row's `gear` says the quest can pay one (`qlJournal.js` qlObjectivesBlock); the Tutorials' page promises gear only for the quests whose page says so (`tutorials.questlines.gearBody`); pinned |
| UI-5 | MED | The classic logbook no longer DFU's verbatim: every stamped quest's filed entry gained "Outcome: ..." | FIXED: the outcome is the filed entry's side record (`notebook.js` fileFinishedOutcome, saved port-only as `finishedQuestOutcomes`, restored with the notebook), drawn by the enhanced archive alone - the pause tab's Archived and the chronicle - and the classic logbook is DFU's verbatim again; pinned |
| UI-6 | MED | = REWARD-8 (the classic skin sent to a tab it lacks) | FIXED: the pause door's Quests landing (`pauseDoor.js` `at: 'quests'`) opens the enhanced pause on either skin, and the HUD's line says the way by skin (`ql.reward.waitingPause`, `ql.reward.waitingClassic`); pinned. LEFT, said: the classic skin has no one-press door to the Quests page - its line says the way, through the pause menu's Controls |
| UI-7 | MED | A questline's state words wrong: a failed step "Waiting"; a step not yet given "now"; a begun line offline "Opens online."; a shelved step "Under way"; "witnessed" on every done step | FIXED: the states `retry` and `shelved`; a step between steps still to come; "Continues online."; the step's mark from the service's answer (`qlLineRunner.js` rows, `qlJournal.js`); pinned |
| UI-8 | MED | An unlogged stamped quest's row: Hide did nothing, Track pinned a quest the lens never sees | FIXED: a row with no journal entry yet offers no Track, no Hide and no Abandon (abandoned, it was lost - neither unlogged nor shelved); Restart stays; pinned |
| UI-9 | MED | No test drew the Quests tab's new wiring - three probes lived | FIXED: `ql2_pause.test.js` mounts the real pause window's Quests tab; the three probes die |
| UI-10 | LOW | Take was one irreversible press, and the focus landed on the next reward's Take | FIXED: a Take arms on its first press ("Click again to take") and takes on the second, as Abandon, Remove and Clear do; each Take its own focus key (`take:<offer>:<index>`); pinned |
| UI-11 | LOW | The card did not say what a piece is | FIXED: its damage or armour, its hands and its weight, by the item's own readers (`qlJournal.js` pieceStatWords over `itemInfo.js`); pinned |
| UI-12 | LOW | "witnessed" and the ladder's "a choice" explained on hover only | FIXED: what a witness is, said once on the line's page, and what "a choice" marks, once on a ladder's page that has one; pinned |
| UI-13 | LOW | The Tutorials' Questlines page popped at character creation | FIXED: it pops for the first quest with objectives the player takes - never S0000977 or `_BRISIEN`, the quests a new character is started on (the bridge's GAME_START_QUESTS), nor a list's start-up quest (`qlLayer.js` stamp); pinned |
| UI-14 | LOW | Offline, the window drew lines that can never begin offline (decision 1); on a phone the first Take 1597 px down | FIXED: offline a line that can only begin online is not drawn, one begun shows "Continues online." (`qlLineRunner.js` rows); on a phone a row pressed brings its page into view; pinned |
| UI-15 | LOW | = LINES-15, LINES-16 | FIXED with them |
| UI-16 | LOW | A finished line's page printed its last step's outcome twice | FIXED: said once, under "How it ended"; pinned |
| UI-17 | LOW | = REWARD-13 | FIXED with REWARD-13 |
| UI-18 | NIT | Misplaced comments; qlObjectivesBlock's `{ended}` passed by no caller | FIXED: the comments beside their imports; `{ended}` dropped |
| UI-19 | NIT | The refusals' words drawn nowhere; an offer's title, a step's outcome and the "Outcome:" line saved in the language of the moment; the ladders' titles cached for the page's life | FIXED: the ladders' titles kept while the text stands, read again when a language or a pack moves it (`questBridge.js`); a claim the service refuses (`ql-closed`, `ql-body`) is said under its step in the service's words; pinned. And a waiting reward is named in the language of the page that draws it (the bridge's `offers`, the ladders' `questTitle`); pinned (AUDIT-QL-UI-19-reward-named-in-its-rolled-words). DECIDED: a step's outcome and the filed "Outcome:" line keep the words they were filed in, as DFU's notebook files its own entries - the quest whose resources expand them is gone by then, so nothing could read them again |
| UI-20 | NIT | bg's "Вземи" informal; pt-BR's "foi trocada"; id's introGear lead | FIXED in the locales (the author's) |
| DOC-1 | MED | = SERVICE-2 | FIXED with SERVICE-2 |
| DOC-2 | MED | The pull request's patch notes and record 5.3 name "Hourwitness" and "Satakalwitness" - the badge shows "Witness of the Hour" and "Satakal's Witness" | FIXED in the record. OPEN: pull request #1047's description (the release reads it) - the author's |
| DOC-3 | MED | = LINES-11 | FIXED with LINES-11 |
| DOC-4 | MED | accountQuestlines had no test (the route, a dead session, `account()` always truthy) | FIXED: pinned - the route, a refused session forgotten, no session no account, `guest()` |
| DOC-5 | MED | The lesser and greater gold factors unpinned | FIXED: pinned (75, 100, 125 and the bounds; a greater outcome's gold through the bridge) |
| DOC-6 | MED | A greater step's rung, tier 3's Rare floor (probed down to Magic) and QLWR04's sheet tier unpinned; a line's `tier` read by nothing | FIXED: pinned; every questline step's sheet tier is its line's |
| DOC-7 | MED | A betrayal paying gear unpinned | FIXED: every pay's profile; N0B00Y09's `sold` offers nothing |
| DOC-8 | MED | The class fit and the two best skills unpinned (every test a career with no bars) | FIXED: a restrictive career; LongBlade 90 and Axe 80 |
| DOC-9 | MED | The letter rule unpinned | FIXED with LAW-6 |
| DOC-10 | MED | A named piece once a character unpinned | FIXED with LINES-20 |
| DOC-11 | MED | The cap and the offer ids across a load unpinned | FIXED: thirteen endings keep twelve; a load continues the ids |
| DOC-12 | MED | Legal standing never moving unpinned | FIXED: moved once |
| DOC-13 | MED | The `moved` once-guard unpinned | FIXED with LAW-6 |
| DOC-14 | MED | A failed quest struck done on its ladder; the Order's ladder | FIXED: a failure never in the history; the Order's ladder (LINES-14) |
| DOC-15 | MED | A foe never placed read dead (nine `foeDead` bindings) | FIXED: pinned (`ql1_law.test.js`) |
| DOC-16 | MED | The catch-all's yield to DFU's success unpinned | FIXED: pinned with LAW-1 |
| DOC-17 | MED | A load's re-asked open and ended()'s step guard unpinned | FIXED: pinned (SERVICE-3, LINES-13) |
| DOC-18 | MED | The Weir Road's `after` unpinned | FIXED: every Cycle line's `after` pinned |
| DOC-19 | MED | `ql name`'s underscores ("Ysolde_Marnhel") unpinned | FIXED: pinned |
| DOC-20 | MED | The card naming a failed objective; a returning quest re-announced; a pack's sheet words unread | FIXED: pinned (the third through a pack laid on M0B00Y06's row) |
| DOC-21 | LOW | The named card's label unpinned | FIXED: pinned |
| DOC-22 | LOW | = SERVICE-8 | FIXED with SERVICE-8 |
| DOC-23 | LOW | = UI-14 | FIXED with UI-14 (the offline lines) |
| DOC-24 | LOW | = SERVICE-4 | FIXED with SERVICE-4 |
| DOC-25 | LOW | Record 2.3: the actions registered "after DFU's 82 and Jagget's four" | FIXED in the record: after DFU's 82, before Jagget's four |
| DOC-26 | LOW | = BRANCH-17 (the patterns and the mends named in no family file) | FIXED in the record (2.3, 3) |
| DOC-27 | LOW | `qlSheetDraft.mjs --family Mods` listed 53 quests (7 are the family's) | FIXED |
| DOC-28 | NIT | = REWARD-15 | FIXED with REWARD-15 |
| DOC-29 | NIT | "Three actions" left in three places | FIXED: five |
| DOC-30 | NIT | The pull request: "13 named pieces" (22 over 13 endings), "133 new strings" (135) | OPEN: pull request #1047's description - the author's |
| DOC-31 | NIT | Stale notes on re-aimed mutant records (acct157, world222) | FIXED: acct159, world224 - world228 since the merges that renumbered it past GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP |
| DOC-32 | NIT | The kit's header: the first patch uncounted, five filed patches hand-edited after it | FIXED: said |
| DOC-33 | NIT | Record 4: "A line the service pays waits, offline" - every online line does | FIXED in the record |
| DOC-34 | NIT | A line's `tier` dead data | FIXED: pinned to its sheets' |
| DOC-35 | NIT | qlFormat's `--file` unsaid; a dead `?? head[3]`; an unknown quest exits 0 | FIXED |
| VOICE-QL | MED | (the author's, merging main) Main's game voice (`10-UI/Voice.md`, VOICE1 and VOICE2 - American spelling, no dash aside in an instruction, no modern game word) arrived after the branch was cut, and the overhaul's own text broke it: British spelling in 96 lines (armour, harbourmaster, colours, favour, honour, grey...), 117 dash asides in the sheets' objectives, choices and outcomes, "an endgame place" in the witnessed step's words, "aren't" in the closed door's; and the Features row still promised "each one finished offers a piece of gear" though UI-4 had made it some | FIXED: every word in text only - never an id (`N0B00Y17`'s outcome `favour`), a symbol (`_harbour_`), a key (`ql.journal.armour`) or a monster's own name (Sabretooth); the 117 asides rewritten by hand, each meaning kept; the witnessed places named (a Dagon's Breach, an Elite Breach's Redoubts, the Abyss Dungeon's Shattered Hour, the Sea Serpent); the row's promise made true; the patches' own 19xx messages too (the scripts' and patches' speech keeps its dashes, as the voice page exempts spoken lines). The 13 languages: 11 keys' records moved (their meaning kept), four redrafted. `test/systems/questlines/qlvoice.test.js` holds the rules over every sheet, script, patch message and line. At the next merge PLAIN-SWEEP's rules (`10-UI/Plain-Words.md` 6.2: no developer talk, no "X, not Y", no dash aside, no AI-sounding prose) were read over the questlines' 161 strings: none broken |

### Measured, then and now

- **The driver** (LAW): all 283 sheeted quests on the real bridge, 60 random walks each - 16,879 walks, every ended quest
  with an outcome, none paid gear twice; fifteen walks filed a failure as a success (LAW-9), and the sheets that did it
  are bound again.
- **The rows** (LAW-11): a journal walk over 38 stamped quests 0.83 ms, now 0.07; with 30 ended quests 0.614, now 0.113.
- **The ladder** (REWARD-7): a tier-4 choice's cards 15.6% Legendary, 39.7% of choices holding one; now tiers 3 and 4
  are Rare, every card.
- **The classic skin** (BRANCH-8): 61 rows of the patches' words over 50 characters and 44 answers over 30; now none.
- **The hosts** (ACTS-8), logical lines over main at the ACTS fixer's hand-back: buildDungeonContext +1 (it was +3),
  createNavalHost +1 (+2), createEgClient +1 (+4), bootExterior +2, bootWorld +4 (one of them LAW-12's `{ ended: true }`);
  every ceiling held.
- **The choice of three** in `test/honestItems.mjs`: tiers 1 to 4, four classes, each named piece - 576 items, 141
  named, no finding of the item law.

### Left, and said

- LINES-26's "Holy Tome" and "Talisman": DFU's quest items have no naming form, and the template that would name the
  Weir Key mints the real one.
- LAW-9's four outcomes that pay a deed at once (N0C00Y11, K0C00Y07, A0C00Y16, A0C01Y06), reviewed and kept.
- ACTS-7: whoever strikes the player's own revenant down, it kneels to the player.
- BRANCH-1: a received copy shared on to a new party asks nobody until a reload. BRANCH-3: a host that abandons a
  window without closing it, and the Enhanced Plus picker's wait on PICK00I0.
- REWARD-5: a named weapon reaches only a player whose two best weapon skills include its base (the Tusk of the Sixth
  Stone, a War Axe, an axe-wielder's) - anyone else is offered the card unnamed.
- REWARD-14: standing moves flat - the Port-Ledger's departure.
- LINES-9: the online calendar reaches 3E 417, the Warp in the West, about October 2027; the Hour's premise - a Break
  still to come - is the owner's to settle before then (decision 5).
- ACTS-8: bootWorld's and bootExterior's wiring lines.
- UI-6: the classic skin's way to the Quests page is the pause menu's Controls, then Escape - no one-press door.
- REWARD-2: the receiver's refusal (`quest.share.questline.receiver`) stays English in every language - `world.js`
  splices it after an English "... but you", as its siblings are.
- REWARD-7: the measure of a played hour is still owed to the first week of play (record 5.2).

### Closed by the author after the lanes

SERVICE-7 (c), SERVICE-9's relayversion note and UI-19's waiting reward (above), and DOC-2 and DOC-30: pull request
#1047's description rewritten from the code - the badge's words, the named pieces and the strings counted again, a
title once an account, and pattern C's refusal as BRANCH-6 left it (`give pc nothing` where DFU pays nothing).

### Not this arc's

Run beside the fixes, two tests outside the questlines failed once under load and pass alone: egz_return's "the spans'
clock" and prof3_client. Named here for their own arcs.

## Checked clean

What each lane read and found holding:

- **LAW**: the switch forced online (its row locked) and the player's offline (on by default, Off kept); the switch off
  is DFU's - no stamp, the 31 patches read as shipped, no reward or ending added, the QL actions claiming no shipped
  line, registered after DFU's 82; all 283 sheets clean under the sheet law and `qlCheck`, every macro resolving, the
  catch-all last and paying nothing, no outcome shadowed, `settable()` matching the setters, every branch's choice the
  player's (138 by prompt, ask or promptmulti), every text at most 127 characters, `qlFormat` idempotent; settling once,
  a failure's clock to the catch-all, a save and load keeping the state, the offers, the history and the lines, a save
  from before the branches staying DFU's; flipping the switch never restamps; a removal or a restart pays nothing; a
  shelved quest keeps its state; a partner's finish settles once; a resync's GivePc scales once; observed once a tick
  per stamped quest, nothing per frame; gold within 0.75 to 1.5; the seed stable; a piece handed once; twelve offers
  kept.
- **BRANCH**: the 31 patches apply to DFU's and SHAM-TRAIL's text and parse, every line claimed; every `ask`'s every
  answer and the three mends end; every message id exists and every macro resolves; the switch off is DFU's array
  exactly, on stamped with its branch; an `ask` survives a save and a load; Escape and Cancel show the question again;
  patched quests share under the ask; `ql paid` is `give pc nothing` without its box; no shipped line of 16,429 claimed
  by a QL template; a broken patch fails loudly; 17 C + 11 D + 3 = 31.
- **REWARD**: scaleGold scales gold only, 0.75 to 1.5, once; a letter marks nothing paid; an ending once, through
  `end quest` or a tombstone; a double one piece; own, betrayal, none and failure no gear; every `give pc` read
  (M0B00Y16 the only late payer); every `outcome _x_` a sheet's; a choice taken once (two clicks, two windows, a reload);
  7,200 choices twice, no difference; the game's own makers, no item-law finding, no wire refusal; the class fit for a
  fighter, an archer, no skills, no weapons, a mage; 22 named pieces lawful, surviving load repairs, kept per character;
  107 standing entries resolving within -5 to +5, 15 legal moves; no account currency online; QLCH02's "Weir Key" a
  quest talisman; quest gear counted by the wealth budget; a shared copy's paid, moved and acts reset on receipt.
- **LINES**: all 13 lines complete through every last-step choice - a success, the sheet's outcome, gold in its tier,
  the choice of three (a rung up on greater), the named piece, the next step STEP_GAP_S later; 41 failure paths -
  QuestFail shown, unpaid, `failed`, no gear, offered again after RETRY_GAP_S; online a failure clock is a deadline and a
  courier's a delay; letters wait for a town; a place that cannot be found waits a day; a save and a load mid-step; a
  character switch replaces lines, history and offers; the gates the record's; offline nothing starts; a failed claim
  retried; `qlCheck Questlines` clean; standing names resolve; the message box wraps; `ql name` first in every endgame
  script; QLCH03's keep and seal the service's; the registry's words the scripts'; the lore canon (3E 398; nothing names
  3E 417; the Daedra, Akatosh, the Order of the Hour, Numidium, Kagrenac, the Mantella, Satakal, Ruptga, the Walkabout,
  the Guardian signs); the ladders - an expelled member none, the history's names, the flagships marked.
- **SERVICE**: forged bodies refused (`__proto__`, `constructor`, a step out of range, fractional or a string, a bad
  choice, an array; extras ignored; nothing written unpaid); another account's receipt refused by all four producers; a
  replay writes one row; 20 opens one row; 30 mixed claims and 20 keeps one Covenbane, one key, `eg_keys` +1; a guest
  paid nothing; a banned account 403 before the route; QUESTLINES_OPEN read as FIRMAMENT_OPEN, a misspelling shut; `dev`
  the developers; Rehearsals excluded through `eg_stakes.rh` and `eg_runs.rh`; no stake or receipt row deleted; the
  witness SQL matching claimGate, egRedoubtPay, claimSd and claimSerpent, and Valkynaz egValkRedoubt; every statement
  indexed; the key once an account, a seal never paying; titles - 45 unchanged, five appended (bits 1 to 16) with words
  and colours; version skew - world223 refuses a token with a new title; migration 0133 once, safe on 1,000 rows,
  CASCADE, dropping nothing; the route listed and session-gated; acct159 in `service.js` and `wrangler.toml`; refusals
  and honours in 13 languages.
- **ACTS**: 23 kinds declared, 23 waited on, none orphaned; every sheet's act a declared kind; the leaf - a refusal,
  flooring, no sink, a sink that throws, one sink a page, the online session after a load; `ql act` counts from the
  quest's first tick, survives a load, keeps counting with the switch flipped, two quests on one kind both count;
  shelved, complete and tombstoned quests hear nothing; shared copies arrive empty and a resync keeps the holder's
  counts; the witnessed producers agree with the service but for the opening's race; every other producer fires once,
  at the deed, the player's own (gathering, foraging, Deep Waters, crafts by the tab that lets them go, the reforge and
  socket after every refusal, the Gambit once a game, Hold'em at a confirmed chair, a port a quarter league of the
  player's own helm, a ship struck by the player's id, a raid cleansed with a blow of the player's, an elite foe of the
  player's blow, Arena practice and exhibitions excluded, the Firmament refused or unchanged no act).
- **UI**: every new row a button that lights, every page with text, the sections in the record's order, no page error;
  Tab reaches the rewards, the quests, the 13 lines, the ladder, the archive and every Take in visual order; focus stays
  on a line's row after Enter; the rows in the pad's set; no overflow in 14 languages at 360x640, 640x360, 800x600 and
  1280x720 (lines and ladders 168 of 168); the DFO Grimoire dress legible; the switch off draws no questline part, the
  rewards earned still show, the tracker and the lens as before; the herald once an objective; the tracker never a
  done, failed or hidden objective; Take drops the piece at the feet; closing keeps the offers; four hosts hand
  journalClean; `questJournal.js` untouched; the five titles QL_TITLES's and the relay's, colours apart; every word
  through `t()`; 135 keys in 13 languages, placeholders kept, plurals right; the tutorial once, never with the switch
  off.
- **DOC**: section 0 recounted (265 DFU scripts, 29 mod quests, 187 list rows, 34 `S0000*` and `_BRISIEN`, 21 demos, 82
  templates; 37 prompts, 90 prompt or pick); decision 3 and sections 3 and 9 (248 = 187 + 1 + 16 + 2 + 35 + 3 + 4; 283
  sheets, 15 families, 72 branched = 66 + 6; the flagship 66 by name; C 17, D 11, 3 mends); section 4's tables the
  registry's, the sheets' and the scripts'; sections 4.5, 5.1, 5.2 and 5.3 the code's but where this page says; every
  backticked file; Code-Map, UI.md, Systems.md, Active-Arcs, Page-Index; the Ledger A row; the patch notes' counts but
  DOC-30's; the 53 mutant records the branch carried, each applying once.

## Pinned

`test/systems/questlines/ql1_law.test.js` (2, new) - the law's own: a foe never placed, the catch-all's yield, the
success fallback; `test/systems/questlines/ql3_rewards.test.js` (18, new) - what an outcome pays, exact, and every
REWARD fix; `test/systems/questlines/ql4_flow.test.js` (12, new) - the `ask`'s flow and a shared copy;
`test/systems/questlines/ql1_layer.test.js` (16), `ql1_sheets.test.js` (27), `ql4_actions.test.js` (10),
`ql4_branches.test.js` (12), `ql11_acts.test.js` (29), `ql12_lines.test.js` (22), `ql12_ladders.test.js` (4),
`test/ui/questlines/ql2_journal.test.js` (17) and `test/server/ql12_claim.test.js` (13), each with the audit's pins
added and titled by the mutants they kill; `test/ui/questlines/ql2_pause.test.js` (6, new) - the Quests tab drawn
whole in the real pause window. Mutant records:
`tools/mutants/ql12_claim.json` (35, all dead - SERVICE-7 (c)'s four among them), `tools/mutants/ql11_acts.json` (35,
all dead), `tools/mutants/ql4_flow.json` (32, all dead), `tools/mutants/ql3_rewards.json` (51 - the REWARD
fixer's 44 and the author's: REWARD-14, the bridge's two doors, the lens's look twice, the ladders' titles, the waiting
reward's name; all dead) and `tools/mutants/ql2_ui.json` (25, all dead - the UI lane's three probes among them). The
PATCH, SCRIPTS and VOICE fixers' probes, recorded: `tools/mutants/ql1_patch.json` (33), `tools/mutants/ql12_scripts.json`
(15) and `tools/mutants/qlvoice.json` (15, the patches' own messages among them), all dead. Re-aimed by content and run
again: `tools/mutants/fb1017b.json` (10, all dead - the seam's second word), `tools/mutants/shipcrew.json` (40, all dead
- the one helper), `tools/mutants/questreset1.json` and `tools/mutants/share_mend.json` (the records FLOW's edits to
`machine.js` and `questShare.js` moved), and DOC-31's notes in nine records. Every questlines suite above, `test/systems/questlines/qlvoice.test.js` (3, new) and `ql12_claim.test.js` (14, SERVICE-7
(c) added) pass on the tree the record describes.
