# AUDIT EG III - the Elite Gates arc, as built

2026-10-13, of the Elite Gates arc in PR #800 (`11-Multiplayer/Elite-Gates.md`). The owner asked: *"I want to finish
the entire arc"*. The coordinator built the slices still open (EG-ZO to EG-ZS, after the waves merged earlier in the
same pull request - section 31's records), then ran this audit on the merged tree: six cold lanes, then seven fix
groups and a bible pass on what the lanes found.

Code paths are under `src/` unless they name `server/` or `server-account/`. A section number is the design page's. A
pin is named by its file's stem: `egaudit3_lords` is `test/net/eliteGates/egaudit3_lords.test.js`.

## Method

The audit ran six cold lanes, each a separate reader, on a FROZEN snapshot of the merged branch: commit 6b86b534. Each
lane read CLAUDE.md, Home.md's Process, Port-Doctrine, AUDIT EG II and the design page whole - sections 1-30 as the
spec, section 31's records as what shipped and where it departs - then its own share of the tree. A finding is code
that does not do what the page or a record says; a record's departure or "not built" gone stale, or a departure never
recorded; two places that contradict each other; a broken Process rule; or a real bug (a crash, a wrong number, a leak,
an exploit, a desync, a stuck state). Each lane verified every finding itself, against the file and the symbol, with a
probe where one was cheap; the probes stayed in the scratchpad, never in the repository. HIGH is a player-visible bug,
an exploit, a crash, lost data or a desync; MEDIUM a disagreement between the page and the code that a player or a
later slice would hit, or a broken Process rule; LOW wording, a stale sentence or a cosmetic gap. No edit was made
until every lane had returned (Home.md's 17l: *DO NOT FIX WHILE THE VERIFIER IS READING*).

| lane | reads | findings |
|---|---|---|
| 1. code truth | every claim of sections 1-30 and the records against the tree; the lords' kits, the legion's cap, the decrees, the Vigil and the Accords driven headless | 24 (5 HIGH, 14 MEDIUM, 5 LOW) |
| 2. numbers and consistency | every number recomputed; the count's law mutated (17 survivors); the versions and the migration | 19 (1 HIGH, 7 MEDIUM, 11 LOW) |
| 3. netcode, failure, integrity and the service | the breach's room and the hub, the stakes, the receipts and the admission; a void after a Redoubt, the mercy's race, absence at the rest, THE HOLD's give-back and a forged Lifeline driven | 19 (4 HIGH, 8 MEDIUM, 7 LOW) |
| 4. the client: hosts, allocations, performance | the four hosts' seams, the swap, every free and the frame's allocations; a witness's ride, the title card and another law's rebuild driven | 13 (3 HIGH, 3 MEDIUM, 7 LOW) |
| 5. records, flags, the ledger and prose | section 31's records against the tree, Home.md's rules, the Port-Ledger row, Active-Arcs, Testing.md, the mutant counts | 22 (1 HIGH, 10 MEDIUM, 11 LOW) |
| 6. the player's experience | what a player sees, hears and is told in the Spire; the pull request's description | 15 (2 HIGH, 6 MEDIUM, 7 LOW) |

There were **112 findings**: 16 HIGH, 48 MEDIUM and 48 LOW. Seven restate another lane's and share its verdict
(Spirebridge was found four times, Counterstroke three, the Accords' pair rule and Spillover with Spotter's wake twice
each).

The findings went by file to eight groups, so that no two groups edited one function: seven fix groups, and group F,
the bible pass. Every group REPRODUCED a finding on its own tree before changing anything - a failing test where it
could, and that test became the pin - then fixed it to the page's spec (or the page to the code, where the code was
right), pinned it with a test that fails before the fix and passes after (A PIN MUST FAIL; fixtures from the real
producers), and killed a mutant of every fix. The verdicts:

- **FIXED**: reproduced, fixed and pinned;
- **PARTIAL** (the part named): fixed in part, the rest recorded on the page;
- **PARTIAL/page**: the code was right and the page wrong, so the page was fixed;
- **REFUTED** (it did not reproduce) and **DECLINED** (its cost above its worth, recorded on the page);
- **FIXED-BY-** a group (FIXED-BY-A2, say): owned by one group, already closed by that group's fix;

In all: 105 FIXED, 3 PARTIAL, 2 PARTIAL/page, 1 FIXED + PARTIAL/page, 1 FIXED-BY-C. The eight groups refuted none and
declined none.

## The fix groups

Each fix group worked in its own worktree from the pull request's head (0251b468). The coordinator merged them in the
order below, then origin/main (1f5325be: #842, #861 and #862, three conflicts). Group F worked from 1f5325be.

| group | files | findings | commit, merged as | pins (tests) | mutants |
|---|---|---|---|---|---|
| E, presentation | ui/: `egHud.js`, `egBeats.js`, `egSpireHud.js`, `egBoardWindow.js`; `scenes/eliteGates/egClient.js`, `systems/eliteGates/spireVestiges.js`, `systems/eventTimers.js`, `player/mwView.js`; two says in `net/eliteGates/egBrain.js` and `net/wire.js` | L6-4, L6-5, L6-6, L6-9 to L6-15 | b61a1149, 5745b13c | `egaudit3_pres` 7, `egaudit3_pres_beats` 5 | 56 |
| A1, lords | `net/eliteGates/egLords.js`, `net/eliteGates/egShape.js` | L1-1, L1-2, L1-4 (the relay's half), L1-10 (the lords' half), L1-11, L1-12 (the census's half), L1-18, L1-23 | 5bca45e3, 0ed3951b | `egaudit3_lords` 8 | 46 |
| A2, legion | net/: `egBrain.js`, `egLegion.js`, `egRun.js`, `egVestige.js`, `egShape.js`; a line of `scenes/eliteGates/egClient.js` | L1-3, L1-6, L1-8, L1-9, L1-10 (the legion's half), L1-13, L1-15 to L1-17, L1-19 to L1-21, L1-24; L2-4, L2-16; L3-2, L3-7, L3-12, L3-13; L5-2, L5-3 | 53e4c07a, 2c6e0f9a | `egaudit3_legion` 10, `egaudit3_legion_blows` 11 | 71; 67 after the merge |
| B, service | `server-account/src/eg.js`, `server-account/src/egHonours.js`, `server/src/index.js`; net/: `egDurable.js`, `egReceipt.js`, `egBrain.js` (`oweEnd`) | L3-1, L3-3 to L3-6, L3-8, L3-9, L3-14, L3-15, L3-18, L3-19 | 994a7a05, db6310cd | `egaudit3_service` 6, `egaudit3_service_relay` 6 | 39 |
| C, client | scenes/: `egClient.js`, `egFight.js`, `egSpan.js`, `egOcclude.js`, `egLookDraw.js`, `world.js`, `worldModes.js`; render/: `egLinePass.js`, `sdStepsPass.js`; `systems/eliteGates/spireVestiges.js`, `ui/eliteGates/egStartWindow.js`, `ui/gate/gateVeil.js`, `world/eliteGates/egLook.js`; the `tonic` word | L4-1 to L4-13, L6-1, L1-5, L1-4 and L1-12 (the screen's halves) | d33dee08, c6dbf73e | `egaudit3_client` 13, `egaudit3_client_fight` 3, `egaudit3_client_tonic` 2 | 82 |
| D, law and Spirebridge | net/: `egLaw.js`, `egSpanLaw.js`, `egVestige.js`, `egFair.js`, `egDurable.js`, `egLink.js`; `scenes/eliteGates/egSpan.js`, `scenes/eliteGates/egClient.js`, `ui/eliteGates/egSpireHud.js`, `ui/eliteGates/egBeats.js`; the `mast` and `ebridge` words | L1-14; L1-7 (with L3-10, L5-1, L6-2) | c4b0e0d5, 1d01388a | `egaudit3_law` 4, `egaudit3_law_bridge` 6 | 55 |
| G, count and rewards | net/: `egBrain.js`, `egLaw.js`, `egRun.js`, `egVestige.js`, `egLink.js`; `systems/eliteGates/egSpoils.js`, `ui/eliteGates/egHud.js`, `scenes/eliteGates/egClient.js`, `scenes/world.js` (`egSpoilsPaid`); the `wkpaid` word | L2-1 to L2-3, L2-5, L2-6, L2-8, L2-11, L2-18 | deca4951, 09ab9d26 | `egaudit3_count` 16, `egaudit3_count_spoils` 5 | 95 |
| F, the bible pass | the design page, Active-Arcs, Port-Ledger, Testing.md, Accounts-And-Cloud-Saves-Arc, Sigil-Sets; `net/wire.js` `EG_END_WORDS` | L1-22; L2-7, L2-9, L2-10, L2-12 to L2-15, L2-17; L3-11, L3-16, L3-17; L5-4 to L5-22; L4-11 verified | ad903255 (from 1f5325be) | `egaudit3_bible` (1) | 1 |

Together the fix groups added 14 test files (102 tests) and 440 mutant records in seven lists under tools/mutants/
(`egaudit3_<group>.json`), every one dead; the bible pass added one of each (`egaudit3_bible`). Each group re-judged the existing records aimed near the text it moved,
re-aimed by content those whose text had moved (test/tooling/mutantdrift.test.js), and moved a pin only with a PIN MOVED note.
`RELAY_VERSION` stays the arc's (`world199` then, `world200` since the merge of main past AUDIT ETHER-OW, `world201` past PEER-ACTS), unshipped,
its hash re-taken in place in `test/net/relayversion.test.js`; `ACCOUNT_VERSION` stays the arc's (`acct124` then, `acct133`
since), and migration 0112 (0117 since the merges past SEAT-FACTS, LAMP-KEEPER II, FIRMAMENT-ON, KG6 and POI-1) needed no change. The one law change is D's spec law 6
(`EG_DECREE_LAW`; `EG_LAWS` holds 4, 5 and 6, and laws 4 and 5 keep their 800-hall hashes): the 25-seed sweep with the
golden courses and a 100-seed sweep crossed every course in all four bands. Lane 2 #19 lay outside the arc: the
coordinator fixed it on its own (9bdbe722).

## Lane 1 - code truth

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L1-1 | HIGH | the Mother of Dusk re-grounds in a loop; Moonfall never lifts her | FIXED | A1: dragged down only when her anchors are broken, once a grounding; they rise 20 s later (40 s in the Moonfall); the feat needs two groundings (`net/eliteGates/egLords.js`); `egaudit3_lords` |
| L1-2 | HIGH | the Wellhead Wyrm stays grounded once its perch breaks; Burning Perches never erupts | FIXED | A1: the grounding's end is tested before a new landing, so it perches again; Burning Perches erupts at the pillar it leaves (`egObjBroken`); `egaudit3_lords` |
| L1-3 | HIGH | the legion's cap (8.1) passed: each rift's wave takes the whole room; holding a wave not built | FIXED | A2: the room read live for every wave, fury, Muster-Call, Hunting Pack and the Kynval squads (`egLegionRoom`, `egWaveKinds`, `net/eliteGates/egLegion.js`); a held wave comes one body larger, once; `egaudit3_legion` |
| L1-4 | HIGH | the Twins' Fire-touched and Frost-touched never minted | FIXED | A1: a twin's landed blow marks 2 (Vael) or 3 (Isk) for 12 s, said on `emk`, +25% dealt to the other twin; C: the struck screen takes x1.25 from the twin whose mark it bears (`EG_TOUCH_X`); the census counts no element share, so the +25% taken is the screen's (13.3); `egaudit3_lords`, `egaudit3_client_fight` |
| L1-5 | HIGH | a Spire Tonic can never be drunk; Long Step does nothing | FIXED | C: `tonic` in `EG_KINDS` and `/breach tonic` - a 25% `eheal` through the census and 25% magicka; Long Step +0.5 s on one span's crumble wait; `egaudit3_client_tonic` |
| L1-6 | MED | the beat throws in a Scriptorium under Wellhead Sparks (no fight floor) | FIXED | A2: Sparks raise none in a hall with no fight floor; `egaudit3_legion` |
| L1-7 | MED | Spirebridge applied nowhere and still offered, unflagged; no `mast` word | FIXED | D: built - `mast` and `ebridge` on the wire, the room's rule `egSpirebridge` (`net/eliteGates/egVestige.js`), the plank's one law `egBridgeOf` and `egBridgeAhead` (`net/eliteGates/egSpanLaw.js`), ground on the fair trail, drawn and collided 6 s (`scenes/eliteGates/egSpan.js`); `egaudit3_law_bridge` |
| L1-8 | MED | Spillover applied nowhere | FIXED | A2: a host hit in `hostHits` - a spell's overkill on an add to the nearest add within 6 m, within the blow's cap, out of the purse; `egaudit3_legion_blows` |
| L1-9 | MED | Spotter's wake applied nowhere; a struck dormant Lurker never wakes | FIXED | A2: any landed blow wakes a dormant Lurker (`egLurkerWake`), so Spotter's arrows wake at any range; `egaudit3_legion` |
| L1-10 | MED | Chained Blows and fury's chained shape drop the floor + 0.3 s term | FIXED | A1 and A2: one rule, `egChainGapMs` (`net/eliteGates/egShape.js`) = max(wind-up, floor + 0.3 s, 1.0 s), read by `net/eliteGates/egLords.js` and `net/eliteGates/egLegion.js`; `egaudit3_lords`, `egaudit3_legion` |
| L1-11 | MED | the lords' state weights multiply (Scorched x1.95, Breakdown x2.25); the half route and Grath's solo Gore not built | FIXED | A1: a lord's weight is its largest state's, never a product; the Colossus walks the half of its route it knelt in; Gore's weight doubled at *n* = 1; `egaudit3_lords` |
| L1-12 | MED | Morvayn's "a blow on one is shared with the other" not built | FIXED | A1 (the census, `egChainShared` in the boss seam's judge) and C (the struck screen): a counted blow split 1/k over the chain, Wraith links and elemental blows sharing nothing; `egaudit3_lords`, `egaudit3_client_fight` |
| L1-13 | MED | Kyn's Vigil stands its champion with no escort at either rank | FIXED | A2: section 8.5's escort, doubled at rank II; none in a Proving Walk, a Court, the Scriptorium, a span or a Brink (`EG_VIGIL_NONE`, section 14); `egaudit3_legion` |
| L1-14 | MED | Gale-Swept and Crumbling Halls never reach the Proving Walk or the Low Road; rank II lays one section | FIXED | D: spec law 6 (`EG_DECREE_LAW`, `EG_SPEC` 6) - a section a rank on every span's road, both roads of a fork and the Proving Walk's second span; every hall within `EG_HALL_LEN_MAX`; `egaudit3_law` |
| L1-15 | MED | Fade fools only Harriers; the Kynval's Unshaken read by nothing | FIXED | A2: Fade fools every kind's pick but an Unshaken elite's; `egaudit3_legion` |
| L1-16 | MED | Far Watch and No Quarter break the Accords' pair rule | FIXED | A2: both read through `egAccordMates`; `egWatchOf` exported; `egaudit3_legion_blows` |
| L1-17 | MED | Counterstroke arms only when the lord's blow hit its holder | FIXED | A2: armed for every member within 6 m of the blow at its landing; `EG_COUNTER_MS`, `EG_COUNTER_X`, `EG_COUNTER_M` in `net/eliteGates/egVestige.js`; `egaudit3_legion_blows` |
| L1-18 | MED | the Valkynaz's aspects are fixed; Garoth never turns | FIXED | A1: `egLordAspect` - Garoth Burning, Rime-Wrought, Storm-Crowned and Venom-Blooded at Redoubts 20, 25, 30 and 35, a lord met in a later band takes its aspect, the Meteor renamed to it; `egaudit3_lords` |
| L1-19 | MED | Sweeping Arc never splashes off a blow on a lord, and measures stale places | FIXED | A2: a host hit off any landed melee blow, lords' included, measured where each body stands now; `egaudit3_legion_blows` |
| L1-20 | LOW | the Wellhead's Sapper and Lurker share sprite 36 (ROLE READS) | FIXED | A2: the Sapper a Fire Atronach (35); `egaudit3_legion` |
| L1-21 | LOW | Cantrips refused at the rest; the shield test reads one Twin; unrecorded | FIXED | A2: used at the rest, refused under any lord's shield; Sight kept while no fight stands (17.2 says so); `egaudit3_legion_blows` |
| L1-22 | LOW | sections 6.2 and 7 name constants and homes the code does not have | FIXED | F: sections 6.2 and 7 name the `_MS` constants and their homes (`net/eliteGates/egLaw.js`, the respite's in `net/eliteGates/egBrain.js`) |
| L1-23 | LOW | `net/eliteGates/egLords.js` copies the gate's `ATTACKS` rows; its Meteor drops the burning pool | FIXED | A1: `ATTACKS` and `POOLS` read from `net/gate/gateBrain.js` (a source sweep pins that no copy remains); the Meteor leaves the gate's burning ground; `egaudit3_lords` |
| L1-24 | LOW | the Binder's raise sums claimed damage | FIXED | A2: it counts what lands, never the claim; `egaudit3_legion_blows` |

## Lane 2 - numbers and consistency

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L2-1 | HIGH | Reliquaries open to nothing; the week's sealing rule not built | FIXED | G: each opened Reliquary rolled at its own depth on its own seed, twice the Panoply chance (`egReliquaryList`, `egReliquaryGrant`, `systems/eliteGates/egSpoils.js`), through `egSpoilsPaid`'s pool; a circle the service paid already turns each into 20 lumen (`wkpaid`, `EG_REL_LUMEN`); seal and void ends count; the rest shows the stake; `egaudit3_count`, `egaudit3_count_spoils` |
| L2-2 | MED | the count's gains and holds are unpinned, and the pinned law is a dead duplicate | FIXED | G: the director calls `egCountRedoubt` (`net/eliteGates/egLaw.js`), its duplicate gone; director-level pins for the gain, the cap, the last word, Press, the Covenant, the Surplus, THE GOLD RUN, the respite, the closing's and the pull's holds; `egaudit3_count` |
| L2-3 | MED | the earner rule is looser than 16.1: a member who only walks to each door earns | FIXED | G: `egActiveIn` - 1/(8n) of the hall's damage or healing, 1.5 s in an errand's mark, or a span crossed fairly; a door's step no longer counts; `egaudit3_count` |
| L2-4 | MED | Counterstroke arms only on a hit; its numbers literals; no pin | FIXED | with L1-17 (A2) |
| L2-5 | MED | Lifeline III's 40% can never apply under the 30% cap | FIXED | G: 20 / 25 / 30% (`net/eliteGates/egVestige.js`, section 15's table); `egaudit3_count` |
| L2-6 | MED | section 21's 12 m rule for Hunter's Mark and Spotter not built, and against section 15 | FIXED | G: both mark only on an arrow from beyond 12 m (`egMarkFoe`'s distance); section 15 and the cards say so; `egaudit3_count` |
| L2-7 | MED | section 23's migrations sentence stale: every EG table is in 0112 | FIXED | F: section 23's Migration 0112 paragraph lists every table and column of the arc |
| L2-8 | MED | the stake's and `eg_live`'s until is 3 h 20 min; the page says 3 h 10 | PARTIAL/page | G: the code's 3 h 20 min from the order's issue is right; sections 22 and 23 corrected; no code changed |
| L2-9 | LOW | the current versions misstated (world196, acct114, migration 0111) | FIXED | F: the slice table, section 23's Versions and Active-Arcs say world199, acct124, 0112 |
| L2-10 | LOW | the EG-E1, EG-E2 and EG-E3 records half renumbered | FIXED | F: EG-E1, EG-E2 and EG-E3 say their versions and migration as renumbered |
| L2-11 | LOW | the door's reach: 3 m on the page, 5 m at the relay, 4 m at the client | FIXED | G: one `EG_DOOR_REACH_M` (3 m) at both ends, `down` re-sent each second; `egaudit3_count` |
| L2-12 | LOW | the page names constants the code does not have (the respite's, the absence's, the Valkynaz's keys) | FIXED | F: the respite's `_MS` constants with its 120 s step and 30 s floor; `EG_ABSENT_TRIAL_MS`; the Valkynaz's key `EG_VALK_KEY_ODDS` and `players.eg_valk_wk` |
| L2-13 | LOW | the stake's 14-day clock is in EG-ZM's record, not in section 23's sentence | FIXED | F: section 23's clock is `EG_STAKE_CLOCK_S`, 14 days past a stake's `until` |
| L2-14 | LOW | EG-ZJ's 16 KiB argument does not apply | FIXED | F: EG-ZJ's sentence says `MAX_FRAME_BYTES` bounds what a client sends, and the rows' eighteen fields |
| L2-15 | LOW | the Falling Wall's "tenth" is not a tenth (21/208) | FIXED | F: EG6a's record and `test/net/eliteGates/eglook_pieces.test.js`'s title say the bound as asserted (a tenth, and one) |
| L2-16 | LOW | the Standard's, Counterstroke's, the marks' and Sweeping Arc's numbers duplicated as literals | FIXED | A2: declared in `net/eliteGates/egVestige.js` and imported; `egMarkFoe`'s 8000 became `EG_MARK_MS` at the merge; `egaudit3_legion_blows` |
| L2-17 | LOW | section 11.9's "Budgets. None are documented" stale | FIXED | F: section 11.9's budgets are law (`EG_FRAG_BUDGET`) and measured (EG-G2, EG-ZL, EG-ZN) |
| L2-18 | LOW | the gather cut short by the 30 s wait; `EG_STAIR_HOLD_MS` can never bind | FIXED | G: a gather begun before the wait ends runs its 8 s; `EG_STAIR_HOLD_S`/`_MS` deleted, section 6.2 says at most 38 s; `egaudit3_count` |
| L2-19 | LOW | Systems.md states BAL9's `spellPower.js` sentence twice (outside the arc) | FIXED | the coordinator, 9bdbe722 |

## Lane 3 - netcode, failure, integrity and the service

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L3-1 | HIGH | a void after any Redoubt never gives the key back | FIXED | B: a void (`v`, or an `x` with why `'void'`) returns a stake held or spent by a Redoubt, never one returned (`server-account/src/eg.js`); `egaudit3_service` |
| L3-2 | HIGH | absence outside a trial counts toward the 180 s trial fall | FIXED | A2: absence in a trial counted from the hall's wake; `egaudit3_legion_blows` |
| L3-3 | HIGH | a closed socket is never counted by the census: a tab closed dodges a blow | FIXED | B: trails kept by account; a member with no socket holds its last pose for `EG_ABSENT_TRIAL_MS` (`egTrailHeld`, `server/src/index.js`); `egaudit3_service_relay` |
| L3-4 | HIGH | the recap's board line never names the Descent for a real end receipt (`co` ignored) | FIXED | B: the standing keys a company as the Descent does (`companyKeyOf`, `server-account/src/egHonours.js`); egz_recap's fixture carries a real `co`; `egaudit3_service` |
| L3-5 | MED | ended breaches hold the hub's `EG_LIVE_MAX` slots until their last word | FIXED | B: at the cap the hub asks each listed room and drops the ended before refusing; `egaudit3_service_relay` |
| L3-6 | MED | the first breach's mercy pays on the opener's early end though the company takes Redoubt 1 | FIXED | B: "first" enforced; the relay puts `nr: 1` on the end receipts of a breach that ended with no Redoubt (`net/eliteGates/egReceipt.js`), and the service pays the mercy on it alone; `egaudit3_service`, `egaudit3_service_relay` |
| L3-7 | MED | 1-point heal words keep a receiver's Lifeline on for good | FIXED | A2: a window needs a heal believed at `EG_LIFELINE_MIN` (a twentieth of a reference body); the client asks the same (`lifelineSaid`); `egaudit3_legion_blows` |
| L3-8 | MED | instants stamped during THE HOLD pushed into the future at its release | FIXED | B: a hold records the instants it found, and its release moves only those (`net/eliteGates/egDurable.js`); `egaudit3_service_relay` |
| L3-9 | MED | the room never checks an egadmit order's `ew` | FIXED | B: the room refuses an `ew` not the breach's; `/v1/eg/admit` refuses a breach with no stake; `egaudit3_service`, `egaudit3_service_relay` |
| L3-10 | MED | Spirebridge offered and does nothing; no `mast` word | FIXED | with L1-7 (D) |
| L3-11 | MED | EG-E2's closed departures still stand in section 20 | FIXED | F: EG-E2's closed departures deleted; one stands |
| L3-12 | MED | a Soul-Pool from a player's kill is pushed into the last beat's sent frames | FIXED | A2: said in that blow's own frames; `egaudit3_legion_blows` |
| L3-13 | LOW | the 'gone' end can never happen | FIXED | A2: no living member at a rest ends 'gone', in a hall 'wipe'; `egaudit3_legion_blows` |
| L3-14 | LOW | a void consumes the day's Rehearsal | FIXED | B: a voided Rehearsal frees that day's again, if it is still that day; `egaudit3_service` |
| L3-15 | LOW | `/v1/eg/admit` locks out a member who never stepped in, to request + 3 h 20 min, unrecorded | FIXED + PARTIAL/page | B: admission only within `EG_ADMIT_WINDOW_S` (20 min) of the open and while the stake is held; `eg_live` ends at the stake's own until; section 23 corrected to the request + 3 h 20 min; recorded in 23: an order taken and never used holds its member to that breach until then; `egaudit3_service` |
| L3-16 | LOW | section 23's drift: the frame table, `eglive`, `/v1/eg/live`'s home, the migrations, the prefix gate | FIXED | F: section 23's frame table as the wire carries it; `eglive` and `egcall:<sub>`; `/v1/eg/live` the relay's; the prefix gate's 404 |
| L3-17 | LOW | stale numbers: migration 0112's header (acct116, world195), the slice table's world196 | FIXED | F: migration 0112's header says acct124 and world199; the slice table's EG-PLAY row world199 |
| L3-18 | LOW | the boards read whole tables on every call | PARTIAL | B: the rankings kept 60 s per Worker, shared by readers, dropped on any claim; recorded in section 20: an end claim reads its season fresh, and the Deepest board reads every Redoubt at a rebuild; `egaudit3_service` |
| L3-19 | LOW | the public `/v1/eg/live` fans out to every live room, unbounded | FIXED | B: the hub's answer kept 2 s (`EG_LIVE_SAID_MS`), shared, dropped when a breach opens; `egaudit3_service_relay` |

## Lane 4 - the client: hosts, allocations, performance

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L4-1 | HIGH | a witness's held body is cast back by the spans every frame: no host supplies `egWitness` | FIXED | C: `scenes/world.js`'s mode host supplies `egWitness`, and the cast-back refuses a witness; `egaudit3_client` |
| L4-2 | HIGH | after a session's first breach the Burning Court's title card never shows | FIXED | C: the breach fight's leave does nothing once it holds nothing, and hides only a card it drew; `egaudit3_client_fight` |
| L4-3 | HIGH | THE LAW PIN's rebuild through the swap never runs; the worker builds by the local law | FIXED | C: under another law no worker build is asked; the main thread rebuilds from the halls given, counted once its step ran; EG-H2's departure 4 narrowed; `egaudit3_client` |
| L4-4 | MED | the Beats' tell pictures stay up for the session | FIXED | C: `egBeatTellDown` (`scenes/eliteGates/egSpan.js`), called by `egBandsDown` at the breach's end; EG-ZL narrowed; `egaudit3_client` |
| L4-5 | MED | THE EDGE LINE and the spans' gold ghosts ignore the danger palette | FIXED | C: the palette's safety colour at a fixed luminance for the line and the ghosts, its hazard colour for tracks and streamers; Standard unchanged; `egaudit3_client` |
| L4-6 | MED | the look draws the company's circle, not the level standing | FIXED | C: the look follows the circle standing and the seed it was built from; `egaudit3_client` |
| L4-7 | LOW | the swap worker and its circle freed only by the walk out | FIXED | C: dropped on every way out of the Spire; `egaudit3_client` |
| L4-8 | LOW | `refused()` returns mixed types (THE MODAL CONTRACT); the retry says "The breach is closed." | FIXED | C: a boolean from every exit; the retry says nothing; `egaudit3_client` |
| L4-9 | LOW | a receipt heard mid-flush waits for the 60 s retry | FIXED | C: claimed as that flush ends (ASYNC NEVER DROPS); `egaudit3_client` |
| L4-10 | LOW | allocations every frame across the breach client | PARTIAL | C: none now in the idle occlusion pass, the fight's leave, Iron Footing's check, the batches, the errand objects, the Vestige holder and world.js's light list; recorded in section 11.9: the slag lanes' arrays, `egAccessNow`'s object, `extraBillboards`' join, the dither's Map entries; `egaudit3_client` |
| L4-11 | LOW | section 29 describes overlays built another way | PARTIAL/page | C: section 29 rewritten - the offer, vote and recap one DOM panel on both skins (a departure), no rest window, the confirm a second press; group F verifies; `egaudit3_client` |
| L4-12 | LOW | the start window can end with no callback | FIXED | C: its question through `egStartAsk` - a box displaced unanswered ends the window as a cancel; a key turned meanwhile says so; `egaudit3_client` |
| L4-13 | LOW | `gateVeil.cover` keeps the old look when asked while opening | FIXED | C: takes the new look in 'opening' too; `egaudit3_client` |

## Lane 5 - records, flags, the ledger and prose

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L5-1 | HIGH | Spirebridge offered, does nothing, unflagged | FIXED | with L1-7 (D) |
| L5-2 | MED | No Quarter and Far Watch skip the pair rule | FIXED | with L1-16 (A2) |
| L5-3 | MED | Counterstroke arms only on a hit | FIXED | with L1-17 (A2) |
| L5-4 | MED | EG-PLAY's departures stand after later slices closed them (RETIRING A FLAG) | FIXED | F: EG-PLAY's list keeps its three that stand, and names what closed the rest |
| L5-5 | MED | EG-FULL's three layers keep closed departures and owed lists | FIXED | F: layer one keeps its one that stands; layer two's owed list and layer three's closed departures deleted |
| L5-6 | MED | EG-G1's and EG-G2's closed departures, some kept with "(EG-ZF added them)" appended | FIXED | F: EG-G1's list keeps seven, with no appended closures; EG-G2's "not built" list closed |
| L5-7 | MED | EG-H2's, EG-H3's, EG-E's and EG-ZH's closed departures | FIXED | F: EG-H2's intro and departures 4 to 6, EG-H3's departure 4, EG-E's feats departure and EG-ZH's "not built" said as built |
| L5-8 | MED | host wiring FLAGGED that is wired (EG-ZF, EG-E1, EG-E2, EG-E3; Sigil-Sets' EG15) | FIXED | F: EG-ZF's heal word and world.js line (wired at its merge), EG-E1 and EG-E3's host lines, Sigil-Sets' EG15 flags |
| L5-9 | MED | four EG-E commits have no record naming the four hosts (THE FOUR HOSTS RULE) | FIXED | F: a new record, "EG-E (the rest)" - the pay law, the spoils, the lords' arms and cards and the host wiring, with the four hosts |
| L5-10 | MED | cross-references after renumbering: EG-ZP's departures 6 and 8, EG-H3's list | FIXED | F: section 31 says a record names a departure by its number when it closed; EG-ZP's departures 6 and 8 and its mapping corrected; EG-H3's list renumbered |
| L5-11 | MED | sections 28 and 29 name things never built | FIXED | F: sections 7, 9, 11.6, 12, 28 and 29 name the hosts and seams as built |
| L5-12 | LOW | section 31's table and intro: `EG_OPEN=false`, world196, deleted files, "every mutant dead" | FIXED | F: section 31's intro - every band open (`EG_OPEN`), the table as the plan with the names never built, the recorded equivalents |
| L5-13 | LOW | the Port-Ledger row omits the account service's files and names a dead seam | FIXED | F: the Ledger row names the service files the arc widened, and `gateHost.js`'s `centre` as a seam no caller passes |
| L5-14 | LOW | Active-Arcs' EG-PLAY line stale; no line for EG-FULL to EG-ZS | FIXED | F: Active-Arcs' EG-PLAY line renumbered, and a line for EG-FULL to EG-ZS |
| L5-15 | LOW | Testing.md's rows say migration 0111; egz_lords' row lists one seam hit | FIXED | F: Testing.md's rows say 0112; `egz_lords`' row names its two hits |
| L5-16 | LOW | Accounts-And-Cloud-Saves-Arc.md's EG sections | FIXED | F: the Accounts arc gains the Elite Breach's account section; EG-E2's heading says its version |
| L5-17 | LOW | records' versions and migrations (acct122, 0111) with no renumber note | FIXED | F: section 31 says once how a record's versions read (world199, acct124, 0112 since the merges) |
| L5-18 | LOW | the arch's archive block moved from 38231 to 38281-38289, unrecorded | FIXED | F: section 25.1 says the harbour took 38231 and the arch's block is 38281-38289, the arch's skin `GATE_ARCHIVE` 5-7 |
| L5-19 | LOW | section 23's frame table and sections 12 and 13.2 list words the wire does not carry | FIXED | F: sections 7, 12, 13.2 and 23 name the words the wire carries; `here` is read off the pose |
| L5-20 | LOW | EG-ZL's departure reason stale | FIXED-BY-C | C: the Beats' pictures freed with the band dress (`egBeatTellDown`), and EG-ZL's reason with them |
| L5-21 | LOW | prose and structure: the gap audit's rows, misplaced records, missing blank lines, 495 long lines | PARTIAL | F: the gap-audit pointers, the economy line, EG-H1's host line, EG-ZE's painted underside, the renumber sentence, EG6a's non-departure, the missing blank lines and layer three's bullet fixed; the page's older lines over 120 columns are not rewrapped, only the lines this pass touched |
| L5-22 | LOW | mutant counts drifted (eglook, egpres_hud, egz_stair) | FIXED | F: eglook (85 with its merge's three) and egpres_hud (68); egz_stair's 85 was right at its slice |

## Lane 6 - the player's experience

| id | sev | finding | verdict | resolution |
|---|---|---|---|---|
| L6-1 | HIGH | in the live Spire the witness view and THE FALL's camera never run, and a fallen member is cast back every frame | FIXED | C: `scenes/world.js` supplies `egWitness` and `egWitnessEye`, and the dungeon frame (the Spire's) applies the eye; section 16.5's 0.35 s damped orbit and its collision built; `egaudit3_client` |
| L6-2 | HIGH | Spirebridge offered, built nowhere | FIXED | with L1-7 (D) |
| L6-3 | MED | Spillover's and Spotter's cards promise effects that do not exist | FIXED | with L1-8 and L1-9 (A2): the cards' lines are true now |
| L6-4 | MED | Resonance and its five capstones are invisible | FIXED | E: a card completing a family says so, in blue (`egCardCompletes`); a beat when a capstone is first reached; the recap lists them; `egaudit3_pres` |
| L6-5 | MED | the last wave's effects have no sight, sound or words (27.5) | FIXED | E: eleven `EG_BEATS` rows on THE SPIRE MIX's critical bus; blue chips for Lifeline, Shield-Hymn, Spellweave and each Accord standing; the relay tells a Bladestorm's and a Deadeye's striker; departures in 27.5; `egaudit3_pres_beats` |
| L6-6 | MED | on the Plus skin a pad cannot drive or close the board panel | FIXED | E: the panel is `enhanced-egboard`, on the enhanced doors' stack, closed by Back; `egaudit3_pres` |
| L6-7 | MED | the pull request's patch-note bullets untrue | FIXED | PR #800's description rewritten against the tree: the engines once in 30 s and the Shelf once (net/eliteGates/egBrain.js `use`), the count chip's three tones and its pulse (ui/eliteGates/egSpireHud.js egCountChip), the potion count on the desktop HUD alone, the witness's camera as the client group built it; the last-five-breaches, Iron Footing and never-lost-key lines gone |
| L6-8 | MED | the pull request's description lacks the last wave's notes; its "Not yet built" stale | FIXED | PR #800's description carries every wave's notes and the audit's fixes ("Lords, Vestiges and rewards in detail"); its "Not yet built" names only the owner's items and the kept departures |
| L6-9 | LOW | under reduced motion the shaft camera snaps | FIXED | E: `spireShaftEase` lays no bias under reduced motion; EG-ZN and section 11.8 amended; `egaudit3_pres` |
| L6-10 | LOW | a return with no record shows Hall 1 and the Galleries' fall | FIXED | E: the plain veil over *The Spire*; `egaudit3_pres` |
| L6-11 | LOW | the silent line tells a touch or pad player to type | FIXED | E: *"The Spire does not answer. Try the return again."*; `egaudit3_pres` |
| L6-12 | LOW | the toll's and the cast-back's words say the share, not what was taken | FIXED | E: what was taken, as a share of the health bar; a toll that takes nothing says nothing; `egaudit3_pres` |
| L6-13 | LOW | the Timers season row is ungrammatical | FIXED | E: "hold the title Spire Champion through the next season"; `egaudit3_pres` |
| L6-14 | LOW | the Shelf's subtitle contradicts itself | FIXED | E: "Work it"; EG-ZJ narrowed; `egaudit3_pres` |
| L6-15 | LOW | the offer card never says what an Accord does | FIXED | E: each Accord's name and line, once a card; section 15 updated; `egaudit3_pres` |

## At the merges

The coordinator merged the seven fix groups in the order of the table above, then origin/main. Where two groups had
built the same thing one was kept, and where two had built halves of one rule both were kept:

- **The chained gap.** A1 and A2 each wrote a helper; A1's `egChainGapMs(wu, stamps)` (`net/eliteGates/egShape.js`) is the one
  kept, the legion's call passing `[s]`. A2's duplicate helper and its four mutants were dropped (its list: 71 to 67).
- **The Twins' touch.** C's struck-screen weight and marks (`EG_TOUCHED_X`, `TOUCHED_BY` in `scenes/eliteGates/egFight.js`) were
  retired for A1's `EG_TOUCH_X`, `EG_MARK_FIRE` and `EG_MARK_FROST` (`net/eliteGates/egLords.js`): one home. C's and A1's split of
  a blow over Morvayn's soul-chain already agreed (1/k, Wraith links excluded).
- **The holder.** C's holder memo was renamed `holderMade` beside E's `holdMemo` (`scenes/eliteGates/egClient.js`);
  `spireHolderStep` keeps C's made-once and E's news.
- **The Masteries and the words.** D's `EG_SPIREBRIDGE_ID` reads A2's `EG_M_ID`; `objs()` keeps C's memo and D's
  planks; `EG_KINDS` carries `tonic` (C), `mast` (D) and `wkpaid` (G).
- **Lifeline.** G's 20 / 25 / 30% stands with A2's `EG_LIFELINE_MIN` (a heal worth a window), both halves kept in the
  pins and on the page.
- **The marks.** `egMarkFoe`'s literals became `EG_MARK_MS` and `EG_M_ID.spotter`, as A2 asked.
- **A flake.** `test/net/eliteGates/egz_keys.test.js`'s forged order now changes a whole signature character: the old last two, 'AA',
  were the same bytes one key in 256 (seen once, in the run after C's merge).
- **The sweep.** After D and G, the 25-seed sweep with the golden courses crossed every course in all four bands.

Two things group G saw that no group fixed went to group F, which fixed both: `EG_END_WORDS` in `net/wire.js` lacked
`'seal'`, which `EG_END_WHYS` (`net/eliteGates/egReceipt.js`) and `EG_OPEN_ENDS` (`net/eliteGates/egLaw.js`) carry, so a director's `'seal'`
end frame would have been refused (latent: no breach ends at a seal today) - now carried, pinned by
`test/net/eliteGates/egaudit3_bible.test.js` (1 mutant, dead), world199 re-hashed in place; and G's own page note that Spotter's wake
of Lurkers is not built, which A2's `egLurkerWake` had made false - sections 15 and 21 now say it.

Group F's agent was stopped part way (an API session limit); the coordinator finished its pass from the agent's
uncommitted work (sections 6 to 23, the seal and its pin), as one commit on its branch.

## Still owed

- **The authored hero fragments**: the owner's to model in Blender (section 11.6; EG6c built their bake, its reader
  and a reference fragment); laying them in the halls waits for them.
- **EG21's tuning in the field**: the budgets, the count and the pace measured with real companies, and whether the
  crossing's bound becomes a gate.
- **A browser with the game's data**: nothing here was seen running; this environment has no Daggerfall data. Every
  fix is tested headless, against the director's own frames, the wire and the real player motor.
- **What the groups left PARTIAL**, each recorded on the page: an admission order taken and never used holds its
  member to that breach until the stake's until (L3-15, section 23); an end claim reads its season fresh and the
  Deepest board reads every Redoubt at a rebuild (L3-18, section 20); the slag lanes' arrays, `egAccessNow`'s object,
  `extraBillboards`' join and the dither's Map entries still allocate (L4-10, section 11.9).
- **Departures the fixes recorded**: a screen reloaded mid-span may offer a Spirebridge already raised, and the room
  refuses it silently (section 15); Kindled Steel's splash is shown by its Accord's chip, never blow by blow, and an
  Accord's forming and lapsing are said once a hall (27.5); the census counts no element share, so the Twins' +25%
  taken is the struck screen's (13.3); a way back with no record keeps the first band's tint (EG-ZM).
- **Group F's 31 findings** and the two items above, filled from its report before the push; **PR #800's
  description** (L6-7, L6-8), the coordinator's.
- **CI's whole gate on the pushed head**: B and D left the tests that name `server/src/index.js` and `net/wire.js` -
  most of the suite - to CI.

No fix group declined a finding.

## What a player notices

The groups' patch notes, in short:

- The Mother of Dusk and the Wellhead Wyrm take to the air again after a grounding, and the Wyrm's pillar erupts in
  its second phase. Garoth changes element at each of his Redoubts, a lord met in a deeper band fights with that
  band's element, and the Valkynaz's Meteor leaves burning ground.
- Twin Lords: a blow from Vael or Isk marks you Fire- or Frost-touched for 12 s - you deal 25% more to the other twin
  and take 25% more from the one who marked you. Morvayn's soul-chains split a blow between the chained.
- Legions keep to their cap, fury waves, Hunting Pack and Kynval squads included; a rift with no room holds its wave
  and pours one body more next time. Fade hides you from every add but an Unshaken Kynval, and a struck Lurker wakes.
- Spillover works, Sweeping Arc splashes off blows on lords, Counterstroke arms when a lord's blow lands within 6 m,
  Kyn's Vigil's champion brings its escort, and Cantrips work at the rest.
- The Spirebridge Mastery works: B, the pad's up, the touch button or `/breach bridge` near a gap raises a gold bridge
  for the company for 6 s, once a span. Spire Tonics can be drunk (`/breach tonic`: 25% health and magicka), and Long
  Step gives your crumbles an extra half second for a span.
- Gale-Swept and Crumbling Halls reach every span, the Low Road and the Proving Walk's span to the door included, and
  lay two sections at rank II.
- Reliquaries pay out at their Redoubt's depth with twice the Panoply chance; a Redoubt already paid this week turns
  each into 20 lumen, and the rest shows your stake.
- Earning a Redoubt needs a real part in three halls - damage, healing, an errand's mark or a span crossed; walking
  through doors no longer counts. Lifeline is 20 / 25 / 30%; Hunter's Mark and Spotter mark from beyond 12 m; the
  door takes a step only inside its 3 m ring; a late company's gather keeps its 8 s.
- A Weir Key comes back when a deploy voids a breach, even after a Redoubt, and a voided Rehearsal gives the day's
  back. The first breach's mercy waits for the breach to end. Closing the tab no longer dodges a blow. The recap names
  your company's Descent rank, and answering a call late no longer locks you out for three hours.
- A fallen companion's camera follows the member you watch (Q/E), smoothly and clear of rock, and the void no longer
  drags a fallen player back. The Burning Court's title card shows again after a breach, and the high-contrast and
  colour-blind palettes recolour the edge lines and the ghost steps.
- Vestige effects are seen and heard (Second Wind, Rally, Lifeline, Shield-Hymn, Spellweave, Rallying Cry,
  Bladestorm, Deadeye, the Accords); blue chips show timed protections and the Accords standing; a card says when it
  completes a capstone and what an Accord does; the recap lists the capstones.
- The toll and the cast-back show what they took; with a controller on the Plus skin the boards open and close; the
  shaft camera no longer swings under reduced motion.
