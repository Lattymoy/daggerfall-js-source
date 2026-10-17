# AUDIT EG IV - the Elite Gates arc through its ten heroes, as built

2026-10-13, of the Elite Gates arc in PR #800 (`11-Multiplayer/Elite-Gates.md`). It came after AUDIT EG III
(`01-Overview/audits/Audit-EG-III.md`) and after the hero wave merged earlier that day: the four EG-HERO records (the ten hero
fragments authored in code, a band at a time) and EG-HERO-LAY (spec law 7, the heroes laid in the halls). At least ten
cold lanes read the arc. The Fallen Stacks was laid first, and then three fix groups (the legion, the lords and the net)
fixed what the lanes had found.

**This page was written two days later, by AUDIT EG V (2026-10-15).** That audit found AUDIT EG IV recorded nowhere: no
page, no Active-Arcs line, no section-31 record and no bullet on the Accounts arc's page. Its lanes' findings list was not
saved anywhere in the repository. Everything below is read off what the audit left behind: its commits, its test files'
headers and titles (which name each finding by its lane and number), its mutant lists, the pages its groups rewrote and
the pull request's description. Where those sources are silent, this page says the thing is not known. AUDIT EG V
re-audited the whole arc cold, with EG IV's fixes in it.

Code paths are under `src/` unless they name `server/` or `server-account/`. A section number is the design page's. A
pin is named by its file's stem: `egaudit4_lords` is `test/net/eliteGates/egaudit4_lords.test.js`.

## What was recorded, and what was lost

- **The lanes.** The pins cite lanes 1, 2, 3, 4, 9 and 10, so there were at least ten. Nothing records:
  - what each lane read;
  - the snapshot the lanes read;
  - the findings' words, their severities or how many there were.

  The numbers the pins cite show the shortest length each list can have had: lane 1 at least 32 findings, lane 2 at least
  3, lane 3 at least 19, lane 4 at least 14, lane 9 at least 24, lane 10 at least 22.
- **What the groups fixed.** 64 findings are named by lane and number (the tables below). Each one is fixed, as its
  group's commit says, and each is pinned by a test whose title names it. No finding is recorded as refuted, declined or
  partial.
- **Unknown verdicts.** For every other finding, nothing records what happened to it:
  - lanes 5, 6, 7 and 8, whole;
  - lane 2, all but #3 (#1 and #2 at least);
  - lane 4, all but #14 (#1 to #13 at least);
  - lane 9, all but #16, #18 and #24 (#1 to #15, #17 and #19 to #23 at least);
  - lane 10, all but #1, #11 to #15, #17 and #22 (#2 to #10, #16 and #18 to #21 at least);
  - any finding past lane 1's #32 or lane 3's #19, and any lane past ten, if there were any.

  That is at least 50 findings in the lanes the pins cite, and the whole of lanes 5 to 8. Nothing says whether they were
  fixed by a group that never merged, declined, refuted, or never reached. The pull request's description headed its
  list "AUDIT EG IV (groups merged so far)", and no other group merged.
- **AUDIT EG V** (2026-10-15) re-audited the whole arc cold on the merged head (9a862e8d). That covers EG IV's fixes and
  whatever its lost findings named, so any EG IV finding that still stood would be found again there.

## The Fallen Stacks, laid first

Commit 7bb9ee3b1a was made under the audit's name before the groups branched. It finished what EG-HERO-LAY's merge had
left. THE LANDING ROOM had refused the Stacks' chamber at every slot, because its second shelf left THE SPAN BUILD's
landing 12 cm before its far edge. Nothing records whether a lane found this.

- **THE LANDING ROOM measured.**
  - The merge notes had offered a 1.8 m shelf, which leaves 32 cm. That passed the law's 20 cm, but the real motor still
    stood on the lip in 5 of 37 crossings (tools/egSpanSolve.mjs's pilot, 200 seeds). At 42 cm it stood there in none.
  - So `EG_HERO_LAND_ROOM_CM` rose from 20 to 40 (`net/eliteGates/egLaw.js`).
  - The second shelf was deepened from 1.6 m to 2.0 m and keeps its near edge: `course[1]` z 704 -> 724, d 160 -> 200,
    `after` 166 -> 126; shelf `b` of tools/egHeroStacksScene.mjs's `SHELVES` runs 6.24-8.24 m. That leaves 52 cm. The
    shelf was rebaked and is proven in 1.280 s (1.207 s before).
  - Every code-built landing that a piece launches onto leaves at least 0.44 m. Only a landing launched from still
    ground, after its run-up, leaves less (0.24 m).
  - All ten heroes fit. The Stacks is laid in 6 of the law pin's 800 halls, and the sweep crossed every course on all
    four bands.
- **A walker up a rim stair** (`net/eliteGates/egWalkGraph.js` `egRegionAt`). A body now keeps its hinted region within
  `EG_NODE_REACH_M` of it; the bound was 0.5 m. A Deepway champion chamber's stair top lies on its balcony's rim and is
  reached from that far off. Held any closer, the walker was told it stood in the floor's region, and it walked back down
  the stair for ever.
- **Pins moved** (each with a PIN MOVED note):
  - `eghero_lay`: law 7's 800 halls hash 2018192008 (1273544078 before), with the Stacks laid in 6, and THE FIT AT ITS
    SLOT's edge is at 40 cm;
  - `eghero_galleries`: the Stacks' course;
  - `eglook_pieces`: the Falling Walls' tenth, with one draw allowed for each hero piece beside it;
  - `egz_camera_budget`: 7.52, 9.64 and 25.5 (7.48, 9.61 and 25.2 before);
  - `egz_state` and `egz_telegraph`: their fixtures are now code-built halls, because the first hall with a stair (the
    Stacks') or with floors at two heights (a hero's) is now one whose floors are polygons.
- **Mutants.** Two records were re-aimed (`eghero_galleries`' EGHERO-GALLERIES-stacks-a-bookcase-past-the-reach and
  `eghero_lay`'s EGHL-landing-room-short) and one is new (`egz_state`'s AUDIT-EG-IV-region-hint-pad-short). The commit
  records no run. AUDIT EG V ran all three on 9a862e8d, and all three died.
- **Pages.** Sections 11.4 and 11.9, the Broken Galleries' record and EG-HERO-LAY's record changed, with one Testing.md
  row. `RELAY_VERSION` `world200`, unshipped, was re-hashed in place (`635ae6d1...` before). It was renumbered `world201`
  at the merge of main past PEER-ACTS that followed (f0be7e9883).

## The fix groups

Each group worked from f0be7e9883 (the Stacks and that merge of main) in its own worktree. The coordinator merged them in
the order of the table. Nothing records whether each finding was reproduced before it was fixed, as AUDIT EG III's groups
did. Each finding is pinned by a test whose title names it, built on the real producers: the director (`egBreachNew`,
`egEnter`, `egStep`, `egBlow`), the lords' kits, the relay's Room over `test/fakeRoom.mjs`, the account service's Worker
over node:sqlite, and the breach client.

| group | files | findings | commit, merged as | pins (tests) | mutants |
|---|---|---|---|---|---|
| legion | net/: `egBrain.js`, `egLegion.js`, `egLords.js`, `egRun.js`, `egVestige.js`; `scenes/eliteGates/egClient.js`, `systems/eliteGates/spireVestiges.js` | lane 1 #6, #12-#14, #16-#18, #22, #25, #27, #30, #31; lane 2 #3; lane 10 #11-#15, #22 | 82ab8c9504, d106f7d5ae | `egaudit4_legion` 9, `egaudit4_legion_run` 11 | 68 |
| net | server-account/: `eg.js`, `egHonours.js`, `index.js`, `accounts.js`, migration 0112 (0117 since); `server/src/index.js`; net/: `egBrain.js`, `egReceipt.js`, `wire.js`, `online.js`, `accountClient.js`; `scenes/eliteGates/egClient.js` | lane 3 #1-#19; lane 4 #14; lane 9 #24 | 461cef3486 and cc79f7bd1b (the page), 4c5a46ebba | `egaudit4_net_service` 7, `egaudit4_net_relay` 11, `egaudit4_net_client` 4 | 58 |
| lords | net/: `egLords.js`, `egBrain.js`, `egShape.js`, `egBodies.js`, `wire.js`; `scenes/eliteGates/egFight.js`, `ui/eliteGates/egSpireHud.js` | lane 1 #1-#5, #7-#11, #15, #19-#21, #23, #24, #26, #28, #29, #32; lane 9 #16, #18; lane 10 #1, #17 | 805105b516, 5c674367a9 | `egaudit4_lords` 17, `egaudit4_lords_errands` 5, `egaudit4_lords_page` 3 | 70; 68 after the merge |

Together the groups added 8 test files (67 tests) and 194 mutant records in three lists under tools/mutants/
(`egaudit4_<group>.json`). The Stacks' one record in `egz_state.json` makes 195. The legion's and the net's commits record
all of theirs dead; the lords' commit records no run. AUDIT EG V ran all 194 on 9a862e8d (`node tools/mutate.mjs --jobs
2` over the three lists): 194 dead, none survived.

`RELAY_VERSION` stayed the arc's `world201`, unshipped. Each group re-hashed it in place, and so did the net's and the
lords' merges (`bbf0ef90...` before the legion, `52e769e7...` after the lords). `ACCOUNT_VERSION` stayed the arc's
(`acct127` then, `acct136` since). The net group's launch letter went into the arc's own migration (0112 then, 0117
since). `EG_SPEC` and `EG_LAWS` did not change, and no group touched the hall law (`net/eliteGates/egLaw.js`). The Stacks' commit
moved law 7's halls, which had not shipped.

## The legion

Sections 8.1, 12, 15, 17.1, 18 and 21 were said as built. Each row gives the fix as its pin and its site name it. The
finding's own words are lost.

| id | the fix |
|---|---|
| lane1 #6 | A lord's summons (Moonfall's Divers, the Soul Burst's Wraiths, the Last Rites'), a Binder's raise and the Low Road's foes are held to the room under the legion's cap (`net/eliteGates/egLegion.js` `egLegionSummon`). A summons a mechanic needs (Morvayn's odd member's Wraith, the Night-Stalker's lone member's Blood Thrall) stands whatever the room holds, and counts against it after |
| lane1 #12 | A Binder's raise claims its body as the cast begins, so no two Binders raise one body. A broken raise is spent, and a cast begins only when there is room |
| lane1 #13 | An offer holds at most six cards (`EG_OFFER_MAX`). A card past that is refused and the Surplus is kept, and a reroll deals the offer again by its own law (The Hollow Offer's two, the bequest, the shards' card, the Lean - `net/eliteGates/egRun.js` `egSurplus`) |
| lane1 #14, lane2 #3, lane10 #12 | The strata are built as section 18 writes them. The Mingled Legion draws every body on its own among the lead kinds, with a Daedra Lord leading one wave in three (`egWaveKinds`). The Twin Court's second lord comes from another band (`egStrataSecond`). The Old Masters rise beside every Court's lord, with THE MASTERS' GROUND (`EG_MASTERS_LESSON_R`, `EG_MASTERS_RUNE_R`). The Molten Rim is a Court's alone |
| lane10 #11 (with lane2 #3) | The strata come in the order the arena season draws them (`egSeasonStrata`), and a breach that starts deeper begins with the strata it starts past (`egStrataTo`) |
| lane1 #16 | The gate's rows are read, never copied: the Caster's pool, the Daedra Lord's Cleave, the Harrier's numbers, and the Mother of Dusk's Hellfire with a pool under each mark |
| lane1 #17 | A Court's Sappers feed the lord by the gate's law: `SAP_HEAL` each, within `SAP_FEEDS_MAX` |
| lane1 #18 | ROLE READS holds over all sixteen kinds: a friend wears a human shape, the elites are the Dremora's, and the Ward-Bearer is a Frost Daedra and the Wraith a Wraith in every band |
| lane1 #22 | Section 12's Harrier row matches the code: in a Court the Harrier runs at the member farthest from the lord, elsewhere at the nearest |
| lane1 #25 | A host hit (Sweeping Arc, Spillover) counts on its member's hall and circle damage and on the recap's and the chart's tally |
| lane1 #27 | A Sapper's rift is the nearest closed one, opened again at a third of the Sapper's own health |
| lane1 #30 | Section 21's time law is said as built (EG-H1's), where it read "before enforcement" |
| lane1 #31 | Named at no site. The group's page pin also holds the census's Lifeline comment at 20 / 25 / 30% |
| lane10 #13 | Spotter is a verb: a long arrow cuts an add's wind-up and breaks a Binder's raise (`egSpotted`). Its 10% (`EG_SPOT_X`) is a second layer over Hunter's Mark, and either layer joins the other |
| lane10 #14 | Rallying Cry sounds at each of a Court's phase turns, as well as when a hall's door opens (`rallyingCry`, `spireRallyingCry`) |
| lane10 #15 | An offer shows no card that cannot act for its member (`egCardActs`, `EG_CARD_NEEDS`) |
| lane10 #22 | Three shards add a card of the member's own Vestige below III at its next rank, and a second pick |

## The net

The group's page commit (cc79f7bd1b) wrote sections 5, 6.1, 16.1, 20, 21, 22, 23 and 29 as built: the receipt table as
minted, the fallen witness, the entrants, Spire Champion's grace, THE HOLD as recorded, the lost open, the opener's end,
the hub's bucket, the Worker's live door, the restack's order, and the launch and stake-clock letters.

| id | the fix |
|---|---|
| lane3 #1 | An open whose answer was lost is asked again by its request id (`again`). The service answers with the stake that request took, its order signed as of the stake's own issue so that it opens nothing and only its void is minted. It answers `none` (404) where the request took no key. The client keeps the id on the device before it asks |
| lane3 #2 | The breach room's hello hands on only what the hub does not hold yet. A receipt the service counted is never claimed again (`EG_COUNTED_KEY`), and a re-claim's Marks and deed are never shown again |
| lane3 #3 | A healer's part in a hall needs a cast from that healer's own socket that the room relayed to the receiver within `EG_HEAL_CAST_MS` (server/src/index.js `_egCastSaw`). Section 16.1 says so |
| lane3 #4, lane9 #24 | The launch gift's letter (`EG_LAUNCH_POST`) is sent by the migration that adds the key, one piece of the server's post per account |
| lane3 #5 | The hub's own breach words (`open`, `void`, `claimed`) spend `egHubGate`. A void asked again is answered from the hub's held copy |
| lane3 #6 | A stake that the first breach's mercy held is spent by the clock with its own letter (`EG_STAKE_POST_HELD`) |
| lane3 #7 | Every receipt field is held to its own kind (`net/eliteGates/egReceipt.js` `egReceiptValid`) |
| lane3 #8, #15 | Section 23's receipt table is the mint's, and an end's `n` counts its entrants |
| lane3 #9 | The hub's sweep forgets a call past its open window (`sweep:egcall`) |
| lane3 #10 | The balance is applied in the order it was asked for, and *The key turns to rust.* is said |
| lane3 #11 | An opener the first wake finds outside is owed their end then (`'empty'`). The service reads that end as any other, so it clears their `eg_live` |
| lane3 #12 | A retried open calls the company the room froze |
| lane3 #13 | Spire Champion is kept only once a season's late ends are claimed, a receipt's life past the season's end |
| lane3 #14 | A fallen member returns as a witness, and section 6.1 says so |
| lane3 #16 | A gate kill's Weir Key is rolled in its claim's own batch (`server-account/src/eg.js` `egGateWeir`) |
| lane3 #17 | The public `/v1/eg/live` asks the hub once for asks that arrive together (one ask in flight per isolate) |
| lane3 #18 | The service's route comment names every field the open reads and every refusal it and the admission answer |
| lane3 #19 | THE HOLD is as recorded (EG-H2's departure 2): the deploy never asks a room to hold |
| lane4 #14 | The answer's refusals are checked again as the admission lands (section 29) |

## The lords

Sections 8.3, 8.5, 8.6, 12, 13.2-13.4, 14 and 18 were said as built.

| id | the fix |
|---|---|
| lane1 #1 | A Court of two lords (Clan Feud's champion beside the lord, the Twin Court, the Old Masters) is won when both fall, and the first fall takes no Redoubt (`egLordsPair`, `egLordsPairOf`). No Vigil champion stands beside a Deepway chamber's own |
| lane1 #2 | The Examination's held line stands strictly above the third phase's (`egHoldHp`, with the share's rescale), so the fight cannot softlock |
| lane1 #3 | A lord asleep takes no blow (`egLordHitX` is 0) |
| lane1 #4 | A mirror turns no phase and runs no kit |
| lane1 #5 | An errand's failure blow (the Chain Snaps, a Soul Burst, the Cage Closes) names its members (`on` - `net/eliteGates/egShape.js` `egBlowOf`, `egBlowOn`). It lands on them wherever they stand: in the census, on the struck screen, on the wire, and in its mark's draw |
| lane1 #7 | The Last Lesson's last ring stands until the fight ends |
| lane1 #8 | Grath lays no Gore along a bridge |
| lane1 #9 | The Haven Nova's route covers the whole court (`egHavenRouteM`), and section 13.3's numbers are the code's |
| lane1 #10, lane9 #16 | The signature Garoth borrows is his own: his own mirrors, no Eclipse in the Clan Pit, chains of two, and the card named (`EG_GAROTH_SIG_CARDS`) |
| lane1 #11 | A Proving Walk's or a Deepway chamber's champion sleeps until every member stands in its court's ring, or 20 s after the first does (`champRing`) |
| lane1 #15 | Errands are given by numeral: each kept while both the errand and its member stand, passed on when the member falls, and split at ceil(n/2) (`pg.as`). They are drawn as *III - Mira* |
| lane1 #19 | Counterstroke arms at the lord's blow, for its whole 0.6 s |
| lane1 #20 | When fury comes beside a Clan Feud champion, the lord is flagged and the champion never is |
| lane1 #21 | Garoth's Clan Muster is called at the phase turn and holds the next line until it resolves |
| lane1 #23, #32 | The Rivalry card is said once a fight, and the Twins' window is the Echoes' constant (`SD_ECHO_PAIR_MS`) |
| lane1 #24 | The Last Charge's fallen third rises as the next third falls |
| lane1 #26 | The Crossing and Burning Perch are lord blows, at their depth's share |
| lane1 #28, #29 | Sections 12 and 13.4 name what was built: the Valkynaz's brain is `net/eliteGates/egLords.js`, a Ward-Bearer holds a Rampart's portcullis, and the Conquest's banner is an errand's object |
| lane9 #18 | The lords' pronouns are the game's: Ilthys and Seyth "she", Grath "he", the Night-Stalker "it" |
| lane10 #1 | THE COVENANT'S PATIENCE applies at the felling blow: the Redoubt is taken, never a tear |
| lane10 #17 | THE MARCH HOLDS THE GATE: a Rampart's Ward-Bearers are warded while any of its march stands within `EG_GATE_HOLD_M` (20 m) of the portcullis (`gateheld`) |

## Pins moved and records re-aimed

Each pin moved carries its PIN MOVED note. Each group re-aimed by content the records whose quoted lines it moved
(test/tooling/mutantdrift.test.js).

- **The legion**: `l10n4_hardcoded`, where `net/eliteGates/egLegion.js` holds 10 hard-coded prose literals (it held 11). Re-aimed:
  `egaudit3_count` (4), `egaudit3_law` (1), `egaudit3_lords` (2), `egz_mastery` (4), `egz_relay` (1), `egz_vestiges` (1).
- **The lords**: `egaudit3_legion`, `egaudit3_legion_blows`, `egaudit3_lords`, `egfull_relay`, `egz_lords`, `egz_mastery`,
  `egz_mastery_accords`, `egz_recap`, `egz_state` and `l10n4_hardcoded`. Re-aimed: `eg5` (1), `egaudit3_lords` (1),
  `egaudit3_pres` (1), `egz_relay` (1).
- **The net**: `egaudit3_count`, `egdur_relay`, `egeco_board`, `egeco_honours`, `egeco_receipts`, `egplay_relay`,
  `egz_keys` and `wb5b_gate_claim`. Re-aimed: `audit28` (1), `egaudit3_count` (2), `egplay` (1), `egz_ends` (2),
  `egz_keys` (1), `wb5b` (1).
- Eight Testing.md rows were added, one for each test file, and the Suite was recounted at the net's and the lords'
  merges.

## At the merges

The coordinator merged the legion (d106f7d5ae), then the net (4c5a46ebba), then the lords (5c674367a9).

- **The net's merge** re-hashed `world201` with both groups' clauses and recounted the Suite (27904 tests across 3201
  files then).
- **The lords' merge** kept both groups' halves of the Courts of two:
  - the legion's strata stand the second lord (`egStrataSecond`, `F.mem.oldMasters`), and the lords' fall law reads it
    (`egLordsPairOf`);
  - the Soul Burst keeps the legion's summon under the cap and the lords' named member;
  - two lords mutants were dropped, because the legion's stand replaced their lines (70 to 68):
    EGA4-lords-twincourt-shrinks-champion (a twin of the legion's EGA4L-pair-champion-scaled) and
    EGA4-lords-oldmasters-unpaired (its case is held by EGA4-lords-oldmasters-word-unread);
  - section 12's Ward-Bearer row is the lords' job with the legion's sprites, and section 18's strata are the legion's,
    with the lords' fall law;
  - `world201` was re-hashed again.

## After the audit

- **The merge of main #880 to #899** (a43a033e63, 2026-10-14):
  - main's REVIVE took `acct132` and SEAT-FACTS took migration 0112, so the arc ships as `acct133` and
    `0113_elite_breach.sql`; the relay stays `world201`;
  - SCHOOLS3 and EG15 had both moved the one magicka gift into `systems/playerHeal.js`. Main's `manaMine` is its one
    home, and EG15's Battlemage's Discipline returns its magicka through it;
  - AOE-PERF draws a path's telegraph on its own strip. The Spire's per-floor draw now keeps a fight floor's own
    triangles for it, pinned in `egz_telegraph` with mutant EGZ-floor-no-strip dead.
- **What CI's whole gate found on the merged head** (9a862e8d, 2026-10-14). CI had not run the whole suite on the arc
  since AUDIT EG IV and EG-HERO-LAY, because the pushes in between conflicted with their base and ran no workflow. Its
  first run found three pins those slices had left unmoved:
  - the account deploy's path filter did not list `net/eliteGates/egHeroFrags.js` and its eleven law tables, which EG-HERO-LAY's
    `net/eliteGates/egLaw.js` brings into the account Worker's bundle;
  - the net group's `none` refusal ("The Spire took no key for that.") was missing from the English catalog and the
    thirteen whole catalogs;
  - `auditwbx2`'s M9 did not have the hub's eighth cursor, `sweep:egcall`, beside EG-ZA's `sweep:egrc` (PIN MOVED).
- **The audit's record** was never written, until AUDIT EG V wrote this page, the Active-Arcs line, the pointer in the
  design page's section 31 and the Accounts arc's bullet.

## What a player notices

From the groups' commits and the pull request's description:

- The Fallen Stacks now appears in the Galleries. Its second bookcase is deep enough to land on and leap again. Foes
  climbing a chamber's stair to its balcony no longer turn back down it.
- Summoned adds, a Binder's raise and the Low Road's foes keep to the legion's cap. Two Binders never raise one body.
  Sappers heal a lord by the gate's measure and only so many times, and reopen the nearest closed rift.
- Each kind of add keeps one look in a band, and a friend wears a human shape.
- The Wellhead's strata are the season's: every breach that season meets the same stratum at the same Redoubt. The
  Mingled Legion mixes every wave, the Twin Court brings a lord from another band, and the Old Masters stand beside every
  Court's lord.
- An offer never shows a card that cannot work for you, and holds at most six. Three shards rank up a Vestige you hold.
  Spotter's long arrow interrupts an add's attack. Rallying Cry sounds at a lord's phase turns.
- Courts of two lords are won when both fall. A sleeping lord takes no blow, and a champion wakes when the company
  reaches its ring. A failed errand's blow lands on the members it names, wherever they run. Errands are shown by
  numeral over the member who holds them, and Garoth's borrowed signatures are his own.
- The Covenant's patience takes the Redoubt when the lord falls, and a Rampart's Ward-Bearers stay warded while the march
  holds the gate.
- A key whose open answer was lost is never lost: the game asks again and gets the key back. The game never claims a
  receipt twice. Healing counts toward earning a Redoubt only when the room saw the spell cast. The launch gift and a
  held stake each send a true letter, and an old balance never overwrites a newer one (*The key turns to rust.*).
