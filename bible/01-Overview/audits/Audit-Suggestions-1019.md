# AUDIT SUGGESTIONS-1019 (2026-10-19) - the #suggestions batch, audited

Mac, of pull request #1036 (`01-Overview/bugs/Field-Bugs-2026-10-19b.md` - ASF-DEATH, METAL-RAMP, LEVEL-EVEN, SKILL-TICK,
GUILD-UX, SKILL-SWAP): **"Audit everything"**, then **"Audit everything built"**. This page is the findings, each with
its verdict. What the audit changed is written into the batch's record as it now stands, each change marked AUDIT
SUGGESTIONS-1019 (in the code, LEVEL-EVEN's as AUDIT LEVEL-EVEN) and its id.

## How it was run

Six cold lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at 18a0519ff, per Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), each told to prove a finding - by a node script over the real modules, the account
service driven in node, or Chromium - before reporting it; then every finding reproduced again on the live tree before
it was acted on:

| Lane | Over | How |
|---|---|---|
| L1 - the loot | ASF-DEATH and METAL-RAMP; every other minter of a rolled condition; a room's seeded body on two clients | `unleveledLoot.js` over seeded streams; the room's base raised as two clients would (`roomLootHost.js` terms) |
| L2 - the health floor | LEVEL-EVEN against every reader of the maximum: the limiter, the save, the Spire, mentor mode, the Firmament, both leveling lanes | made characters through the real layer; 10,000 magic rounds for drift; the seat off and on |
| L3 - the ticker | SKILL-TICK against raiseSkills itself; the HUD's per-frame cost; the Stats page at a phone's width | seeded passes compared skill for skill; Chromium over the Growth lab |
| L4 - the guild's storage | GUILD-UX's pages against the real account service; the vault card on a mouse, a finger and both skins | the real panel, writs book and Worker in node; Chromium with mobile emulation |
| L5 - the class skill swap | SKILL-SWAP's law and page against the level, the saves, the judge, the realm, legacy, the 95 lock; the words in thirteen languages | made characters, the judge and the realm in node; the page in Chromium at six sizes |
| L6 - the words, the records, the pins | every new English line against its code; the thirteen languages rendered with real fillers; every claim of the record; the pins under 34 mutants of the lane's own | `textManager.js` over each table; `tools/mutate.mjs --jobs` |

The scratch scripts are the session's (`scratchpad/audit/`); none is committed.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L1-1 | MED | A room's Orc or Daedra body with an armour drop came out different on each client: the drop's CreateRandomArmor reaches the mod's own RandomArmorMaterial override, which read the LOCAL player's Luck, so the draws, the condition and the gold after it disagreed (283 of 3,000 seeded bodies; 262 on main - older than the batch) | FIXED: while a corpse is raised the mod's Luck and level are the raiser's (`unleveledLoot.js` `_raiserLuck`, `_raiserLevel`); 0 of 3,000 disagree |
| L1-2 | LOW | The ramp's middle metal can be lighter plate than the random piece the armour drop's condition is read off: up to 135% of its own maximum at level 1, an online sale over whole | FIXED: never over the piece's own maximum (a departure from 1.1.2's bug for bug, named in `06-Systems/Unleveled-Loot.md`) |
| L1-3 | LOW | A bounty's reward rolled its condition (50-75%) and left no `foundCondition`, so online a mended one sold whole | FIXED: `bountyReward.js` marks it |
| L1-4 | LOW | The ramp's metal ignored the Mods pane's material switches (offline; online the mod is the room's whole) | FIXED: through `materialSwitch` |
| L1-5 | LOW | A kill's corpse reads the player's level, not a mentor's lowered one, for the ramp as for the gold | RECORDED: as the mod's gold does; said in Unleveled-Loot.md |
| L2-1 | MED | An online level-up rescaled current health against a maximum that stood for one line: a full-health character lost up to 7 on a high roll and gained on a low one | FIXED: the level-up's refresh keeps health as it stands (`renownLayer.js` refreshOnlineLayer `keepHealth`), both lanes |
| L2-2 | LOW | The Endurance a level-up spends (both skins' rollouts) and the Oghma Infinium's reached the floor only at the next magic round | FIXED: the refresh after the points, in the book's arm, and where the classic rollout writes its stats home |
| L2-3 | MED | Mentor mode sized the body off the stored maximum alone: an unlucky roller under the floor came out tougher mentored than an average one at the same maximum | FIXED: the layer keeps its floor share (`evenHp`) and `mentorMode.js` reads it |
| L2-4 | LOW | The Firmament's small health stars took their share of the stored body, not the floored one | FIXED: of the floored body (`firmamentPowers.js` firmamentLayer) |
| L2-5 | LOW | The fixed pool follows the page (`?online`), the floor the seat | RECORDED: they part only in a tab out of the seat, where 5 is the mean - nothing to gain |
| L3-1 / L6-12 | MED | The ticker and the strip said "Ready - rest or travel" while raiseSkills' 360-minute gate was shut: a rest on that advice raised nothing | FIXED: the reading takes the clock (`skillCheckWait`); gated, the line says when a rest or journey raises it, and the strip waits for the gate |
| L3-2 | LOW | A primary the pass takes from 99 to 100 locks a later 95-and-up skill in the same pass; the reading said that skill ready, and the pass threw its uses away | FIXED: the lock read in the pass's own order (`lockedBy`); the sweep now includes 99s |
| L3-3 | LOW | "At its limit" on an unmastered 100 a mastery is still open to; "Held at 95" on a locked 96 | FIXED: "At 100 - master it to climb further"; "Held while a primary skill is at 100" |
| L3-4 | LOW | The HUD counted the skills every frame, hidden or not, building 35 objects and an array | FIXED: `countReadyToImprove` builds nothing, and the strip counts only when it shows |
| L4-1 | MED | An empty Units out of the guild Stores asked past the room the service counts (gold-bought and loose units fill it too): refused whole | FIXED: the room read over every origin |
| L4-2 | MED | The vault card outlived the panel's close (and under a re-taken pointer lock no leave ever comes) | FIXED: the close and the teardown take it |
| L4-3 | MED | On a phone a tap fired enter, click and leave in one, and the card came and went at once; the hover setting switched off a phone's only preview | FIXED: a mouse's pointer alone brings and takes it; a press of the name toggles it, asked (`showItemHover` `asked`) |
| L4-4 | LOW | On the classic skin the card fell, unstyled, below the screen | FIXED: the card is the enhanced skin's |
| L4-5 | LOW | A Put in all the service stopped part way said only why, not what had gone in | FIXED: "1 material went in, then the guild Stores refused: ..." |
| L4-6 | LOW | A vault row and its search named an unidentified piece by its true name (the service's record name) beside a card that withheld it | FIXED: rows named as the pack names a piece (`vaultRowName`, itemInfo.js itemLongName) |
| L4-7 | LOW | A filter that hid every row said nothing | FIXED: "No piece in the vault matches." |
| L5-1 | MED | The page told a class no swap can help to swap, and the law let it pay: a class with no weapon skill and every mastery slot spent | FIXED: the hint only where one swap opens a path (`skillSwap.js` swapOpens); a swap into a spent group says, beside the picks and in the ask, that the skill could never be mastered (a warning, not a refusal - a swap can be wanted for leveling) |
| L5-2 | LOW | Offline with Master Skills off, a swap can start or end DFU's 95 lock at once, unsaid | FIXED: said beside the picks and in the ask |
| L5-3 | LOW | The swap's select pushed the pane sideways at 568x320 | FIXED: `max-width: 100%` |
| L5-4 | LOW | Legacy dropped a swapped stock class for an heir (the family keeps a career only when its name is not its index's) | FIXED: a swapped career is marked (`swapped`), kept whole by `family.js` careerFields and counted custom; its household still wears the class |
| L6-1 | HIGH | The swap's page had no pin: eight mutants of it survived | FIXED: `test/ui/growth/fb1019b_swappage.test.js` draws the real page over the fake document |
| L6-2 | MED | The swap's laws unpinned: the Empire's account online, the offline refusal's words, a major group's word, the fold | FIXED: pinned; the fold (`computeEntityMods`) removed - no fold reads the career's lists |
| L6-3 | MED | The HUD's count unpinned | FIXED: by source (the hosts do not run in Node) |
| L6-4 | MED | The tutorial sent the classic skin to a Stats page line it never draws | FIXED: that sentence on the enhanced skin alone |
| L6-5 | MED | "Raises the health of every level you have gained" - false for a body that rolled above the floor | FIXED: "...Online, your health never falls below your class's average for every level at the Endurance you have now." |
| L6-6 | LOW | "1 skill is ready - rest or travel to raise them", and its pronoun in twelve languages | FIXED: each plural arm says its own; the thirteen redrafted |
| L6-7 | LOW | The vault filter's rarity menu, its counts, the Stores' new words unpinned; Put in all's stop unsaid (= L4-5) | FIXED: pinned |
| L6-8 | LOW | The Orcish plate arm of the ramp unpinned | FIXED: pinned |
| L6-9 | LOW | The Firmament's Endurance read through a life-or-combat reader whose life arm could never answer for an attribute | FIXED: the combat channel read alone |
| L6-10 | LOW | Korean "재료 #종을(를)" | FIXED: "을" |
| L6-11 | LOW | A comment said a held skill's uses are spent by the pass in every case | FIXED: the docblock rewritten with the reading |
| L6-13 | LOW | No mutant named `levelingChoice.js`; Unleveled-Loot.md's headline and table row did not point at its departures; the specialisation pages said "the headline says so" of a line under it | FIXED |

Sound, in each lane's own words: the ramp's draws are the room's seed's and none at 20 and up; `foundCondition` rides
the wire, the save and a repair's re-pool; the floor never drifts over 10,000 rounds and neither the seat nor a passing
Fortify buys health; the save keeps the stored maximum and the health's share; the reading agrees with the pass in
every other case (past 100, the hard cap, Master Skills turned off after a mastery, missing progress, odd Reflexes); the
strip does not churn its DOM; Put in all's `own + bought` is exactly the service's spendable units, and the writs
book's guard never refuses its second deposit; the card throws for no record and stands above the panel; the swap
moves no level, no progress, no mastery, no mirror, and no save the judge refuses; every new key is in all thirteen
languages with its record, every placeholder present, every plural arm right.

## Pins

`test/systems/fb1019b_audit.test.js` (L1, L2, L3, L5, L6 laws), `test/ui/growth/fb1019b_swappage.test.js` (the page),
`test/net/guild/fb1019b_guildux.test.js` (six more: L4); the batch's own suites re-aimed where the words moved.
`tools/mutants/fb1019b_audit.json` (42); the batch's records and five older ones (`audit_uicalm_firm1.json`,
`auditlegacy3.json`, `wagons2_final.json`, `lv2.json`, `orl1.json`) re-aimed by content, each dead; `wagons2_final.json`
gains one for `vaultRowName`'s wagon read, and its pin of the row's name moved with it. One record fell equivalent:
`fb1019b_metalramp.json`'s corpse-level-dropped, since L1-1 makes a raise's default level the raiser's (marked so, with
L1-1's own records killing a raise that forgets it).
