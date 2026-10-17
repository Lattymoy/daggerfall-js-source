# AUDIT EG V - the Elite Gates arc, whole, on nine cold lanes

2026-10-14 to 2026-10-15, of the Elite Gates arc in PR #800 (`11-Multiplayer/Elite-Gates.md`). Mac: *"Run the audit.
This entire thing needs to be perfection"*. It came after AUDIT EG IV (`01-Overview/audits/Audit-EG-IV.md` - written by this
audit, because EG IV left no record) and after the two commits that followed EG IV: the merge of main #880 to #899
(a43a033e63) and what CI's whole gate found on the merged head (9a862e8d). Both are recorded in the design page's
section 31 note "After AUDIT EG IV".

Nine cold lanes read the whole arc on a frozen snapshot of 9a862e8d. Eight fix groups then worked what the lanes found -
seven on the code, one on the records - and the coordinator merged them. Main was merged next (84 commits, through the
host split #907 and #909). A second round worked from that head: group H closed the followups the first round left.
Group L (EG-L10N, the arc's words through the text core) was briefed and not run: Mac, 2026-10-15, *"Lets just skip
localization for now"*.

Code paths are under `src/` unless they name `server/`, `server-account/` or `tools/`. A section number is the design
page's. A pin is named by its file's stem: `egaudit5_b` is `test/net/eliteGates/egaudit5_b.test.js`.

## Method

The snapshot was a copy of the merged branch at 9a862e8d, called eg5snap, outside the repository, with `node_modules`
linked in. Each lane read CLAUDE.md, Home.md's Process, Port-Doctrine, AUDIT EG III and the design page - sections 1-30
as the spec and section 31's records as what shipped and where it departs - in full for its scope. It also read the
`egaudit4_*` pins that touch its scope, so it knew what EG IV had already pinned. A lane re-reported an EG III finding
only where its fix had regressed or did not hold, citing the EG III id.

A finding is any of:

- code that does not do what the page or a record says;
- a record's departure or "not built" gone stale, or a departure never recorded;
- two places that contradict each other;
- a broken Process rule;
- a real bug: a crash, a wrong number, a leak, an exploit, a desync, a stuck state, a softlock, a lost key or reward,
  or a race.

HIGH is a player-visible bug, an exploit, a crash, lost data, keys or rewards, a desync or a softlock. MEDIUM is a
disagreement between the page and the code that a player or a later slice would hit, a broken Process rule, or a pin
that cannot fail. LOW is wording, a stale sentence or a cosmetic gap.

Each lane verified every finding itself, against the file and the symbol. Where it was cheap, a lane drove the real
producers headless: the director (`egBreachNew`, `egEnter`, `egStep`, `egBlow`, `egWord`), the real law tables, the
wire's projection, the relay's Room and the account Worker. Its probes stayed in its own scratch directory and imported
the snapshot by absolute path. No lane wrote to the snapshot or the repository, ran more than two test files at once, or
ran `tools/mutate.mjs`, which edits sources in place. A finding a lane could not settle went to that lane's UNVERIFIED
list. Because the lanes read a frozen snapshot, the fix groups' worktrees could not move what a lane was reading
(Home.md's 17l, *DO NOT FIX WHILE THE VERIFIER IS READING*).

| lane | reads | probes | findings |
|---|---|---|---|
| 1. the lords and the courts | sections 7, 8, 12-14, 18, 19's feats and 27.5; `net/eliteGates/egLords.js`, `egShape.js`, `egBodies.js`, `egFeats.js`, `egFloor.js`, `bossSeam.js`, `systems/eliteGates/egLordArms.js`; the Courts' branches of `net/eliteGates/egBrain.js` | 17: the director with real kits - Garoth beside the Armsmaster for ten minutes, the Kynreeve's yaw against the screen's fold, Morvayn's chain after a fall, a sweep of THE UNION FLOOR | 30 (6 HIGH, 13 MED, 11 LOW) |
| 2. the legion, Vestiges, decrees, offers, Accords, what every hall pays | sections 6.2, 8, 12, 14-18; `net/eliteGates/egVestige.js`, `egRun.js`, `egLegion.js`, `egBrain.js`, `systems/eliteGates/spireVestiges.js`, `spireKit.js` | 9 over the director: the Bargain, Stillness, a member gone home, the Kynval's shield, the Lurkers' cap, the Wellspring, Ready and the decrees | 16 (3 HIGH, 8 MED, 5 LOW) |
| 3. the run: the company, the count, the halls, the twists, Redoubts, one life, the witness | sections 1, 6, 7, 8, 9, 16, 22, 27.2-27.7; the director end to end, `net/eliteGates/egRun.js`, `egClock.js`, `egTally.js`, `egAnnals.js`, `egDurable.js`, `egStartLaw.js` | 18: the twists counted over 2,000 seeds, the Orrery at circle 56, the Winch short a member, the plate skipped, a solo fall | 22 (8 HIGH, 5 MED, 9 LOW) |
| 4. netcode, integrity, failure and recovery, durability, the account service | sections 5, 6, 10.8, 16.1, 21-23; `server/src/index.js`, `server-account/src/eg.js`, the hub, the receipts | 13 over the relay's Room (EG IV's harness): a silent socket, a ride claimed, an admit order reused, a call that wipes, THE HOLD woken twice, a restart | 14 (4 HIGH, 5 MED, 5 LOW) |
| 5. the spans, the solver, the fragments, the heroes, the made level | sections 8.2, 8.5-8.9, 9, 10, 11, 24, 25.2; `net/eliteGates/egSpanLaw.js`, `egFragLaw.js`, `egHeroFrags.js`, `egFloor.js`, `egLaw.js`, `world/eliteGates/egHall.js` | 28: the walk graph's reach of 1,700 pillars, the Cairn's Brink over 1,800 draws, the lights of 1,200 circles, a one-ulp nudge over 6,000 halls | 18 (2 HIGH, 7 MED, 9 LOW) |
| 6. the client: the four hosts, lifecycle, allocations, performance, rendering | sections 11.9, 25, 28-30; `scenes/eliteGates/egClient.js`, `egSwap.js`, `egCall.js`, `egLookDraw.js`, `world/eliteGates/egCircleWorker.js`, `egCircleParts.js`, `egTelegraph.js`, the passes | 9: a counting GL over two breaches, the floor plan's allocations, the plank's bucket, the swap's tick, a stuck witness | 10 (2 HIGH, 5 MED, 3 LOW) |
| 7. what the player sees, hears and is told; PR #800's patch notes | sections 4, 6, 16.4-16.5, 25-30; every `ui/eg*` file, `scenes/eliteGates/egClient.js`, `/breach`, the score | 12: the `/breach` parse, the rest's votes, the absent ring, the cards, the palettes, the localization | 23 (2 HIGH, 11 MED, 10 LOW) |
| 8. rewards, the economy, honours, boards, every number | sections 5, 15, 16, 18-20; `net/eliteGates/egPay.js`, `systems/eliteGates/egSpoils.js`, `server-account/src/egEconomy.js`, `egHonours.js`, the herald | 7: the spoils, the tiers, the Reprieve, the Reliquary, the seed shop | 9 (3 HIGH, 2 MED, 4 LOW) |
| 9. records, the bible, pins, mutant lists | sections 29-31, Active-Arcs, Port-Ledger, the Accounts arc, Sigil-Sets, Testing.md, the `egaudit4_*` headers | 6: every identifier in 31, every constant, every count, every `eg*` mutant record's reach (3,454) | 16 (0 HIGH, 9 MED, 7 LOW) |

## Totals

There were **158 findings**: 30 HIGH, 65 MEDIUM and 63 LOW. Five restate another lane's finding and share its verdict
(L2-4 and L3-5, L2-10 and L3-8, L3-3 and L8-3, L3-16 and L7-4, L4-14 and L8-8), so 153 are distinct.

Ten touch an earlier audit's fix:

- **AUDIT EG III**:
  - L3-13 - L2-18's gather did not reach the first hall;
  - L4-1 - L3-3's held body only for a closed socket;
  - L4-9 - L3-8's give-back did not survive a second wake;
  - L6-4 - L4-10's record of what still allocates;
  - L6-7 - lane 4 #4's freed pictures, still called the session's;
  - L7-15 - L6-8's description;
  - L9-8 - L2-3's earner, against EG-ZF.
- **AUDIT EG IV**:
  - L1-9 - lane 1 #5's pin reads the marks, not the count;
  - L1-17 - lane 1 #7's fight-long constant, unused by two zones;
  - L4-3 - lane 4 #14 pinned the order's reuse.

The verdicts:

- **FIXED**: the code changed, and a pin that fails without the change holds it. For a finding about a pin, it means
  the pin now fails under the mutation.
- **FIXED (words)**: the page, a record or a comment was wrong and now says what is built. No behaviour changed.
- **PARTIAL**: fixed in part. The rest is recorded on the page, as the row says.
- **RECORDED**: the code stands as it is, and the decision is recorded on the page with its reason.

In all: 123 FIXED, 30 FIXED (words), 2 PARTIAL and 3 RECORDED. No group refuted or declined a finding. The two
PARTIAL are L4-6 (the arch's site, recorded in 6.3) and L7-10 (the Spire's English: EG-L10N, skipped at Mac's word).

## What was recorded

Every lane's report (a table of findings with the evidence and the probe, an UNVERIFIED list and its coverage) and every
fix group's report (each finding's verdict, its pin, its mutants, the pins it moved and the NEW items it found) was kept
by the coordinator outside the repository, with the lanes' probes. This page carries every finding by its id, so the
list cannot be lost as EG IV's was. Each fix is named in its pin's test title by the same id.

## Lane 1 - the lords and the courts

| id | sev | finding | verdict | where |
|---|---|---|---|---|
| L1-1 | HIGH | Garoth's Court beside the Last Armsmaster (THE OLD MASTERS, an even circle) can never be won: the master's kit ends Garoth's Clan Muster duel, and his held line is never freed | FIXED | B: each duel belongs to its lord (`L.duelAt`) and only that lord's kit ends it; a lord's fall ends its ring; `egaudit5_b`; 13.4 |
| L1-2 | MED | a Court's second lord overwrites the fight's aspect: Garoth at Redoubt 25 fights Burning, the Twins throw frost as fire | FIXED | B: an aspect per lord (`L.asp`), and a mirror takes its lord's; `egaudit5_b`; 13.3, 13.4 |
| L1-3 | MED | the Markynaz's Grand Duke's Decree is dropped from the fight's law when a second lord is stood after him | FIXED | B: the fight's law folds every decree any lord laid (`F.mem.lawD`); `egaudit5_b`; 8.5 |
| L1-4 | MED | Hearts Stilled is granted with no Breakdown, because a second lord's phase words count as the Colossus's | FIXED | B: it needs the Colossus's own Breakdown (`kneelUntil`); `egaudit5_b`; 19 |
| L1-5 | MED | No Ground Conceded counts any object's `broken` word, so three Wellhead Sparks earn it | FIXED | B: breaks counted per kind (`F.mem.broke`), and the feat reads banners alone; `egaudit5_b`; 19 |
| L1-6 | LOW | the Twins' Together is refused when another lord outlives them, and is measured to the Redoubt's beat | FIXED | B: the twins' own falls (`net/eliteGates/egFeats.js` `egTwinsTogether`); `egaudit5_b`; 19 |
| L1-7 | HIGH | the Kynreeve's Shield-Wall is judged on a facing no screen sees: a lord's yaw is not on the wire | FIXED | B: a body's facing on the wire (the row's 19th field, the walk's 10th, bounded by `EG_YAW_WIRE_MAX`) and drawn; `egaudit5_b`; 8.5, 23 |
| L1-8 | HIGH | after a chained member falls, Morvayn's shared blow takes the whole share in the census and half on the screen | FIXED | B: the census divides over the whole chain, and a fallen member is unchained at the seam (`egUnchain`); `egaudit5_b`; 13.4 |
| L1-9 | HIGH | an errand's failure blow that names its members is counted where its mark lies, not on the members it names | FIXED | B: a blow with `on` counts only those members, by their trails at its landing (`net/bossRef.js`); `egaudit5_b`; 13.2 |
| L1-10 | MED | THE UNION FLOOR leaves out the lords' own place hazards and zones | FIXED | B: the Burning Bridge and the Floor Falls are in the set, a told burn lands at its onset and a void is no ground to flee to (`net/eliteGates/egFloor.js` `egZoneLandings`, `egFloorLess`); H (item 10): a ground burning as it lands is no ground to flee to either (`egBurnsIn`), lane 1's sweep 0 violations; `egaudit5_b`, `egaudit5_h`; 13.2 |
| L1-11 | MED | the Kynmarcher's standards can all be broken before he wakes | FIXED | B: planted at his wake; `egaudit5_b`; 8.5 |
| L1-12 | MED | the Night-Stalker's true shadow is read off the wire, and no screen draws its glint | FIXED | B: the umbras said alike, his row kept where he vanished, the true one glinting 2 s before he rises (`EG_UMBRA_GLINT_MS`); `egaudit5_b`, `egaudit5_b_client`; 13.3 |
| L1-13 | MED | Gutterdark, the Long Night and the Colossus's Rails are said by the relay and drawn by no screen | FIXED | B: the dark and the Long Night drawn, the Rails drawn as two gold lanes (`egRailsAt`); the Rails' climb, never said by the relay, RECORDED not built with its reason by H (item 8); `egaudit5_b_client`; 13.3 and 30 |
| L1-14 | MED | the phase card is never drawn, and five lords' turns give no order | FIXED | B: `EG_LORD_PHASES` names and orders every turn, and the card is drawn once a turn (`egPhaseCard`); `egaudit5_b_client`; 13.2, 27.5 |
| L1-15 | MED | Morvayn's Chain Snaps keep one clock for every chain | FIXED | B: each link has its own clock; `egaudit5_b`; 13.4 |
| L1-16 | MED | Every Challenge Met cannot be earned at *n* = 1, so no lone player holds *Master of the Galleries* | FIXED | B: at *n* = 1 the Armsmaster's Challenge is an open duel; `egaudit5_b`; 13.2, 19 |
| L1-17 | LOW | Both Courts Burn and the Long Night last 600 s, not the fight-long `EG_ZONE_FIGHT_MS` EG IV made | FIXED | B: both are `EG_ZONE_FIGHT_MS`; `egaudit5_b`; 13.3 |
| L1-18 | LOW | a chained second shape fills from the first shape's word, never from its landing | FIXED | B: its own `wu` and an outline lead `ol` (bounded by `EG_OUTLINE_WIRE_MAX`), drawn dim until the first lands; `egaudit5_b`, `egaudit5_b_client`; 13.2, 14, 23 |
| L1-19 | LOW | the Rampart's walkway is 5 m wide and 90-120 m long, not as 8.3 says, unrecorded | FIXED (words) | F: 8.3 says 90-120 m by 5 m |
| L1-20 | LOW | the Proving Walk's first span is 5-7 pieces, not 6-10, unrecorded | FIXED (words) | F: 8.5 says 5-7 |
| L1-21 | HIGH | THE MOLTEN RIM widens every Wellhead Court's way in past the span build's reach: no company without flight can step on | FIXED | F: gold causeways where the way in, the bridges and the stairs cross the rim (`net/eliteGates/egLaw.js` `egMoltenRim`, `egRimCastsBack`; the director's `moltenRimKeep`), under every law; `egaudit5_f_rim`; 18 |
| L1-22 | MED | a Court of two shows the first lord's bar alone, held at 0 once that lord falls | FIXED | B: a bar for each standing lord, up to two (`ui/eliteGates/egSpireHud.js` `egLordBars`); `egaudit5_b_client`; 27.1 |
| L1-23 | LOW | Paired Hearts reads the first lord's phase, not the Colossus's | FIXED | B: the Colossus's own phase; `egaudit5_b`; 13.3 |
| L1-24 | LOW | 13.2 names "the Clan Muster's third duel"; there are two | FIXED (words) | B: 13.2 says the duel at his third phase's turn holds his fall; `egaudit5_b` drives both duels |
| L1-25 | LOW | the Twins' marks are laid by the next beat's poses, not by the census's | FIXED | B: laid from the census's own hits at the seam's judge (`egLordsJudged`); `egaudit5_b`; 13.3 |
| L1-26 | HIGH | THE ERRAND FLOOR is broken under THE OLD MASTERS: the Spellmaster's havens are laid about the ground's first disc alone | FIXED | B: the Haven Nova measured over the whole fight floor, with havens added up to `EG_HAVENS_MAX` (`egHavenFloor`); `egaudit5_b`; 13.2, 13.3. The same class for the runes and the Last Lesson is OWED to H (item 1) |
| L1-27 | LOW | 13.3 calls the Night-Stalker's thrall a Harrier body; it is its own kind | FIXED (words) | B: 13.3; `egaudit5_b` asserts `EG_KIND.thrall` |
| L1-28 | MED | the Armsmaster's "two Challenges at once" is one ring with one tally | FIXED (words) | B: said as built - two members challenged into the one ring, braziers clamp(n - 2, 1, 3); `egaudit5_b`; 13.3 |
| L1-29 | LOW | under THE OLD MASTERS, Garoth's Mirrorcourt and the Spellmaster's images block each other | FIXED | B: each lord counts its own mirrors (`mirrorsOf`); `egaudit5_b`; 13.4 |
| L1-30 | LOW | Grath is Scorched on a bridge that is only told | FIXED | B: a bridge burns from its landing; `egaudit5_b`; 13.3 |

## Lane 2 - the legion, Vestiges, decrees, offers, Accords

| id | sev | finding | verdict | where |
|---|---|---|---|---|
| L2-1 | HIGH | the company's chosen decrees never reach the next circle: only the Proclamation and the Wager bite | FIXED | A1: the choice folded into the next circle as its ask closes (`net/eliteGates/egRun.js` `egDecreesAsk`); `egaudit5_a1`; 14 |
| L2-2 | HIGH | a member gone home, or posed in an earlier hall, still lends Vestiges to blows | FIXED | A1: `egPosedHere` (the living, posed in this hall) for `egBlow` and `egWatchOf`; Fallen's Due counts only holders who are not home; `egaudit5_a1_legion`; 15 |
| L2-3 | HIGH | dormant Lurkers are raised past the cap, and counted against it they stop the waves | FIXED | A1: a statue counts toward the room once it wakes; `egaudit5_a1_legion`; 12 |
| L2-4 | MED | Dagon's Bargain with no free family still asks, then gives nothing (= L3-5) | FIXED | A1: asked only while a family is free (`egBargainFams`), and the shrine's line is hidden (`egTwistShown`); `egaudit5_a1`; 8.7 |
| L2-5 | MED | a Bargain or a Wager can bring Swarm-Mother's Binders into the Galleries | FIXED | A1: the Bargain's pool goes through `decreeOpen` at its circle; the Wager is recorded as the company's own choice, any decree from Hall 1; `egaudit5_a1`; 14 |
| L2-6 | MED | Stillness does nothing in a Rampart, Athenaeum, Court or Proving Walk, and is spent anyway | FIXED | A1: added to every first wave (`standFight`) and kept past a hall that pours none (`egStillHolds`); `egaudit5_a1_legion`; 17.2 |
| L2-7 | MED | the relay's host hits bypass a Shielded Kynval's shield | FIXED | A1: `net/eliteGates/egLegion.js` `egShieldTurns` and `egShieldSoak`, read by `egBlow` and `hostStrike`; `egaudit5_a1_legion`; 8.7 |
| L2-8 | MED | a Wellspring never raises Sappers, so a broken anchor never relights | FIXED | A1: a Sapper on the great rift's cadence while an anchor is broken; `egaudit5_a1_legion`; 8.1, 12 |
| L2-9 | MED | a rest that heals less than full (Ashen Vigil, Hungering Dark) restores no magicka or fatigue | FIXED | C: the same share of each (`scenes/eliteGates/egClient.js` `egRestVitals`), and the rest card says so; `egaudit5_c`, `egaudit5_c_hud`; 16.3, 17.4 |
| L2-10 | MED | The Fraying is never drawn (= L3-8) | FIXED | A1: built - decree 19 `fraying`, drawn only for a circle with an Athenaeum, its fray min(48, 36 + 2k) (`egFrayOf`) - a recorded departure from a flat 36; `egaudit5_a1`; 8.4, 14 |
| L2-11 | MED | the beacon never names the next circle's decrees or its lord | FIXED | A1: `nx` on the state (`egNextOf`), said as *The next circle bears: ...* and *The next Court: ...* (`ui/eliteGates/egHud.js` `egNextCircleText`); `egaudit5_a1`; 16.3, 23 |
| L2-12 | LOW | Swarm-Mother's Binder rides only the director's own waves | FIXED | A1: `egWaveKinds` reads the decree by default; the span shadows and the Hunting Pack stay their own (14 says so); `egaudit5_a1_legion`; 14 |
| L2-13 | LOW | the Lean applies only at Redoubt 1, and leans Blade for a member who landed nothing | FIXED | A1: at the breach's first Redoubt, and none with no blow (`egLeanOf`); `egaudit5_a1`; 15 |
| L2-14 | LOW | reloading the page refills the hall's two potions | FIXED | C: the count kept on the device by breach, hall and stage; `egaudit5_c`; 17.4 |
| L2-15 | LOW | a second pick outlives the rest | FIXED | A1: `egPicksClose` takes every pick left, and a pick or a Surplus outside the rest is refused; `egaudit5_a1`; 15 |
| L2-16 | LOW | the Honour Horn's Kynval is raised outside the legion's cap | FIXED | A1: raised through `egLegionSummon`, and named among section 12's mechanic bodies; `egaudit5_a1_legion`; 12 |

## Lane 3 - the run

| id | sev | finding | verdict | where |
|---|---|---|---|---|
| L3-1 | HIGH | an Athenaeum from circle 56 hangs the breach's room for good: the Orrery's start can never be far enough | FIXED | A2: the turns' range rises until its top reaches 36, then stops (`egOrreryTurns`, `EG_ORRERY_REACH`); `egaudit5_a2`; 8.4 |
| L3-2 | HIGH | the Winch softlocks once the living company is short of `min(2, n)` | FIXED | A2: the need is `min(2, living)`; `egaudit5_a2`; 8.3 |
| L3-3 | HIGH | a recalled member earns the next Redoubt without lifting a finger (= L8-3) | FIXED | A2: a Redoubt begins every entered member's part again; `egaudit5_a2`; 16.1 |
| L3-4 | HIGH | a Kynval Squad on a Rift-Yard never stands | FIXED | A2: four elites about the yard's heart, the first wave held for `EG_SQUAD_HOLD_MS`; `egaudit5_a2`; 8.7 |
| L3-5 | HIGH | Dagon's Bargain is offered with no free family, passes, and gives nothing (= L2-4) | FIXED | with L2-4 (A1); `egaudit5_a1` |
| L3-6 | HIGH | a member who never stands on the arrival plate is never judged, and opens a span's door at once | FIXED | A2: the fair trail needs the member here in this hall; a recall counts as here; `egaudit5_a2`; 7, 21 |
| L3-7 | MED | under THE LAW PIN a client keeps its own law's edge lines, streamers and mist | FIXED | A2: the look is remade when its halls are not the ones it was built from, and the fight re-reads a given hall; `egaudit5_a2_client`; 22 |
| L3-8 | MED | The Fraying is never drawn (= L2-10) | FIXED | with L2-10 (A1) |
| L3-9 | MED | the first circle is fixed for every breach, not only while a member has never taken Redoubt 1 | RECORDED | F: section 7 says the first circle is fixed for every breach, veterans' included, and why |
| L3-10 | MED | the gather ring, THE TRAIL's gold ribbon and allies at 60% on traversal ground are unbuilt and unrecorded | FIXED | C: (a) built - `here` as the company row's 11th field, *1 of 2 here*, a gold ring over the plate (`net/eliteGates/egLink.js` `egGatherOf`, `world/eliteGates/egLights.js`); (b) and (c) built by H (item 9): THE TRAIL and the allies at 60%; `egaudit5_c_hud`, `egaudit5_h`, `egaudit5_h_client`; 7, 8.2 |
| L3-11 | LOW | "about one hall in four" carries a twist; it is one trial hall in five | FIXED | F (law 8): a twist is rolled for one trial hall in four; `egaudit5_f`; 8.7 |
| L3-12 | MED | the spec digest is said and never read: section 9's same-law safety net is unbuilt | FIXED | A2: the client compares the room's `dg` with its own draw and builds the rest of the breach from the relay's bytes; a mismatch is logged, not carried on a receipt (a recorded departure); `egaudit5_a2_client`; 9, 23 |
| L3-13 | LOW | the first hall's gather is cut short at the open window's end | FIXED | A2: the window's end wakes the hall only when no gather has begun; `egaudit5_a2`; 7 |
| L3-14 | LOW | a Rehearsal's Court never adds its lord's page | FIXED | A2: the page is given before the Rehearsal ends; `egaudit5_a2`; 11.10, 20 |
| L3-15 | LOW | a solo member's first fall promises a recall, and the breach ends on the same beat | FIXED | A2: a fall that leaves nobody living says `fin` 1 and lays no Memento; `egaudit5_a2`; 16.5 |
| L3-16 | LOW | the absent ring drains from when the screen lost the member, not from the trial's wake (= L7-4) | FIXED | with L7-4 (C) |
| L3-17 | LOW | the respite is asked once a rest | FIXED | A1: asked again after each yes while 30 s of the budget is left; Ready beside a respite ends the rest 3 s after it (`EG_READY_MS`); `egaudit5_a1`; 6.2, 16.4 |
| L3-18 | HIGH | the Reliquary Vault pays almost never: no Proving Walk's ever stands, and a fork lays none | FIXED | F: the Proving Walk's vault is stood and taken (`vaultStand`, `vaultStep`) under every law, and a fork lays one under law 8; `egaudit5_f`, `egaudit5_f_rim`; 8.7 |
| L3-19 | HIGH | the Ghost and the Captive never stand on a Span; the Captive hangs one chain in every Rampart and most Deepways | FIXED | A2: the span stands both, and the chains are three on the fight ground (`egCaptiveSpots`); `egaudit5_a2`; 8.7 |
| L3-20 | LOW | the Athenaeum's pressure is a mixed wave, not Harriers | FIXED | A1: ceil(n/4) Harriers a wave (`egWaveKinds` with `only`); `egaudit5_a1_legion`; 8.4 |
| L3-21 | LOW | 8.4 says the Orrery's rights hold back a griefing turner; EG-H3 says the Spire judges with none | RECORDED | A2: decided - no rights, and a snap lashes the whole company (a company is the opener's own party, frozen at the open); 8.4 now agrees with EG-H3 |
| L3-22 | LOW | a fall by absence, or by a word with no pose, leaves no Memento | FIXED | A2: laid at the member's last pose in that hall; `egaudit5_a2`; 16.5 |

## Lane 4 - netcode, integrity, failure, durability, the account service

| id | sev | finding | verdict | where |
|---|---|---|---|---|
| L4-1 | HIGH | the relay's count never counts a member whose socket is open but sends no poses - every player standing still | FIXED | D: every living member's trail held at its newest pose (`server/src/index.js` `egTrailHeld`); `egaudit5_d_relay`; 6.1, 21 |
| L4-2 | HIGH | a pose can claim any ridden piece, and the relay moves the body onto it | FIXED | D: `net/eliteGates/egFair.js` `egRideHolds` checks the pose's own feet on the piece; `egaudit5_d_relay`; 10.8 |
| L4-3 | HIGH | an admit order is reused past its 60 s life, and once refused it is never asked again | FIXED | D: asked again past half its life (`EG_ADMIT_FRESH_MS`); a refused order is dropped and asked again, at most `EG_ADMIT_ASKS` times a breach; `egaudit5_d_client`; 6.1 |
| L4-4 | HIGH | a call to another breach wipes the breach a member stands in, mid-trial | FIXED | D: the client keeps such a call as the call alone (`egLiveHeld`); that the hub still calls the whole frozen company is recorded in 6.1; `egaudit5_d_client`; 6.1 |
| L4-5 | MED | a stake's open order is re-signed fresh until the stake's until | FIXED | D: a re-signed order carries the stake's own issue; `egaudit5_d_service`; 23 |
| L4-6 | MED | the arch's site, and refusals 2-5 and 8, are checked only on the opener's screen | PARTIAL | D: only my own company's arch gets a collider; the site and those refusals stay the opener's word, recorded in 6.3; `egaudit5_d_client`; 6.3 |
| L4-7 | MED | a heal word with no relayed cast still mends the member's count | FIXED | D: `egHeal` mends only on heals from healers the room saw cast, each counted once; `egaudit5_d_relay`; 16.1, 21 |
| L4-8 | MED | `EG_RELAY_MIN` is still 197, and its pin checks the constant against itself | FIXED | D: 201, and 203 since the merge of main; `egaudit5_d_relay`; 23 |
| L4-9 | MED | THE HOLD's give-back (EG III L3-8) does not survive a second wake inside the hold | FIXED | D: the finding kept on the breach (`net/eliteGates/egDurable.js` `holdFind`); `egaudit5_d_relay`; 22 |
| L4-10 | LOW | the held body is lost across a mid-trial restart | FIXED | D: each member's last pose saved with the breach, and the held body rebuilt from it; `egaudit5_d_relay`; 22 |
| L4-11 | LOW | section 5's refusal 6, "a stake unsettled", is enforced nowhere | RECORDED | D: section 5 says what is enforced (the call or the Spire held, and the service's `eg_live`); enforcing a stake unsettled broke the empty end's law |
| L4-12 | LOW | sections 6.4 and 23 describe call and cell shapes the wire does not carry | FIXED (words) | D: 6.4 and 23 |
| L4-13 | LOW | `test/net/relayversion.test.js` names `egBeatAt` for the tick, which is `egTickAt` | FIXED (words) | D: the row says `egTickAt` |
| L4-14 | LOW | the herald's comment says "earning entrants" (= L8-8) | FIXED (words) | D: "entrants" (`net/eliteGates/egHerald.js`) |

## Lane 5 - the spans, the solver, the fragments, the heroes, the made level

| id | sev | finding | verdict | where |
|---|---|---|---|---|
| L5-1 | HIGH | the Eclipse Vault's two galleries are cut off from the legion's walk graph: a safe perch | FIXED | F: a hero's stair joined at its own edges (`net/eliteGates/egWalkGraph.js`), under every law; `egaudit5_f_ways`; 11.7 |
| L5-2 | MED | the timed solver decides with float trigonometry, and no source sweep covers `net/eliteGates/egSpanLaw.js` | FIXED | F (law 8): an integer sine (`egLawSin`) and a squared-distance reach, with the sweep over `net/eliteGates/egSpanLaw.js`; `egaudit5_f`; 9 |
| L5-3 | MED | the span Vent's tell is drawn in fire orange, not the place's white | FIXED | E: every vent and fragment hazard in the place's white (`PEND_COLOR`), recoloured by every danger palette, the element shown by the hatching; `egaudit5_e_look`; 25.2 |
| L5-4 | LOW | the Low Road is 1.16-1.33 times the High Road, not "half as long again" | FIXED (words) | F: 11.4 gives the median, 1.22 by length and 1.34 by time |
| L5-5 | MED | the Brink into the Cairn falls to the solver's last resort in 13.5% of draws, and loses its Sinking Stair | FIXED | F (law 8): the sinking island lowered (`EG_SINK_LOW_CM`); `egaudit5_f`; 8.9, 11.3 |
| L5-6 | MED | the set pieces are proven with no 25% margin, and the Forge Line's hammers are in no proof | FIXED | F (law 8): the set kits' margin in the solver, and a way clear of the hammers (`egForgeLineClear`); `egaudit5_f`; 10.5, 11.3 |
| L5-7 | LOW | section 24's table still has the Burning Court refusing Recall | FIXED (words) | F: 24 - the Mark refused, Recall as everywhere in the Court |
| L5-8 | LOW | a hero's seam alcove gets its false wall where a code-built niche's would stand, not in its doorway | FIXED | F (the client, every law): `world/eliteGates/egHall.js` `egHeroDoor`; `egaudit5_f_ways`; 11.10 |
| L5-9 | MED | a code-built Eclipse Vault's balcony floor stands past the moonlight's 6 s reach | FIXED | F (law 8): `net/eliteGates/egFragLaw.js` `egEclipseHolds` and the balcony-to-arch rule; `egaudit5_f`; 11.2 |
| L5-10 | LOW | a Brink is 132-151 m, crossed in about 25-35 s, and drawn per seed - not "a fixed traversal of about 60 s" | FIXED (words) | F: 8.9 |
| L5-11 | MED | every span carries exactly one passage, and from circle 2 it is the Low Road's | FIXED | F (law 8): a passage on the trunk from circle 3, and a third from circle 11 at one chance in two; `egaudit5_f`; 11.4 |
| L5-12 | LOW | the proving court's chamber comes from its band's kits, not always the Fallen Stacks | FIXED (words) | F: 8.5 and 11.4 |
| L5-13 | LOW | EG-HERO-LAY's laying table still says the Stacks is laid in none of its heads | FIXED (words) | F: the table re-measured, with a law 7 and a law 8 column |
| L5-14 | MED | the Council Rotunda's three balconies have no stairs, so a melee company cannot reach Ilthys's banners | FIXED | F (law 8): two stairs a balcony; `egaudit5_f`; 13.4 |
| L5-15 | HIGH | a raised disc reached by a side span (a Rampart's caster pillar, the Wyrm's perch) is unreachable and a fall-through | FIXED | F (law 8 and the collider): ramps up to raised discs, with rim faces as deep as `SD_LIP` (`world/eliteGates/egHall.js`); the real motor's pin; `egaudit5_f`, `egaudit5_f_ways`; 8.3, 13.3 |
| L5-16 | LOW | nothing holds a circle to 12 lights within 40 m; 338 of 1,200 circles break it | FIXED | E: `EG_LAMP_BUDGET` enforced in `egCircleLights` (338 to 0); `egaudit5_e_look`; 11.9 |
| L5-17 | LOW | THE LANDING ROOM excepts a Drift, which moves across the course, not along it | FIXED | F (law 8): `EG_HERO_ALONG` - Rails and Drums alone; `egaudit5_f`; EG-HERO-LAY |
| L5-18 | LOW | a Span lays 4-18 platforms in 3-5 sections, not 12-28 in two to four | FIXED (words) | F: 8.2 |

## Lane 6 - the client

| id | sev | finding | verdict | where |
|---|---|---|---|---|
| L6-1 | HIGH | a witness whose socket goes terminal walks out of the Spire still a witness: every blow in the open world is zeroed | FIXED | C: every way out clears the witness and gives the body its health; `egaudit5_c`; 16.5 |
| L6-2 | MED | AOE-PERF's overdraw cut never reaches the Spire's tether, chain and aura ring | FIXED | E: `telegraphStrip` covers the tether and the chain, the floor plan is clipped to the strip, and the ring is its own quad (the tether's shaded area 360 to 12 m2); `egaudit5_e_look`; 25.4 |
| L6-3 | MED | THE EDGE LINE is sized in the canvas's pixels, not the world image's (Retro Picture Mode) | FIXED | E: `drawOver` takes the world image's viewport; `egaudit5_e`; 25.3 |
| L6-4 | MED | the breach's frame allocates far more than 11.9 records | FIXED | E: the hot paths keep their lists (the floor plan ~49 KB to ~0.7 KB a frame, the fight's frame 23 to 6 KB); what still allocates is listed in 11.9; `egaudit5_e_alloc`; 11.9 |
| L6-5 | MED | the fight's telegraph and crystal renderers are never freed, and no pin counts meshes and textures after every exit | FIXED | E: `destroy()` on both, with the slots emptied first; every GL object back to baseline after ten halls and every kind of exit; `egaudit5_e`; 11.9, 29 |
| L6-6 | LOW | the start window's preflight is not judged again when it lands, and `away()` closes before it empties the slot | FIXED | C: judged again on landing, and the slot is emptied first; `egaudit5_c`; 29 |
| L6-7 | LOW | egSpan's clear says the Beat's pictures are the session's | FIXED (words) | E: the comment names `egBeatTellDown`; `egaudit5_e` |
| L6-8 | LOW | THE SWAP lays the new circle's halls again on the main thread | FIXED | E: the worker's build carries the five specs (`egCircleBuild`), given one a rest frame (`egSpecGive`); the swap's mean 33.2 to 4.7 ms; `egaudit5_e_swap`; 7 |
| L6-9 | MED | the next band's dress is painted on the main thread in one rest frame (150-270 ms) | FIXED | E: painted in the worker and uploaded one record a frame (`egBandRec`); `egaudit5_e_swap`; 7, EG-ZN |
| L6-10 | HIGH | a Spirebridge's plank never leaves the collider, because the dungeon host's wrapper has no `removeBucket` | FIXED | E: `scenes/eliteGates/egSpan.js` `egSpanCollider` forwards both; the pin is on the host's real wrapper; `egaudit5_e`; 15 |

## Lane 7 - what the player sees, hears and is told

| id | sev | finding | verdict | where |
|---|---|---|---|---|
| L7-1 | HIGH | no `/breach` command with an argument reaches the client | FIXED | C: `net/chatCommands.js` `breachCommandOf`, read by `scenes/world.js`'s send (the one host with a chat send path); `egaudit5_c` |
| L7-2 | HIGH | at every rest, Y votes yes on the respite, not Ready | FIXED | C: Y and *vote yes* mean Ready; the respite has its own word (R, `/breach respite`, *vote respite*); `egaudit5_c`; 16.4 |
| L7-3 | MED | the pad cannot vote Ready or most decrees | FIXED | C: the pad's focus reaches every card, Surplus button and open ask's option; `egaudit5_c`; 27.8 |
| L7-4 | MED | the absent ring drains from when this screen lost the pose, not from the trial's wake (= L3-16) | FIXED | C: counted from the later of the silence and the hall's wake; `egaudit5_c_hud`; 6.1, 27.4 |
| L7-5 | MED | Annals pages kept on the account can never be read | FIXED | C: readable anywhere (`annalsSay`); no journal door exists, and 11.10 says so; `egaudit5_c`; 11.10 |
| L7-6 | MED | a Rehearsal's fallen are promised a recall that never comes | FIXED | A2: a Rehearsal's members have no recall; the fallen card, the witness's line and the first-time line follow; `egaudit5_a2`, `egaudit5_a2_client`; 27.7 |
| L7-7 | MED | the witness HUD of 16.5 is not built, and not recorded | FIXED | C: the watched member's name and health (`egWatchLine`), a tap on a party row, a ping from the pad's up and from touch with its cooldown (`EG_PING_MS`), Q/E and the shoulders; `egaudit5_c`, `egaudit5_c_hud`; 16.5 |
| L7-8 | MED | the recap's strip marks only the viewer's own fall, and loses earlier circles on a reload | FIXED | C: the room's falls marked, and the log kept on the device (`logFrame`); `egaudit5_c_hud`; 27.6 |
| L7-9 | MED | on touch the recap cannot be closed | FIXED | C: a Close button; `egaudit5_c_hud`; 27.6 |
| L7-10 | MED | the whole Spire UI is hard-coded English, and the debt is recorded nowhere it is cited | PARTIAL | C: the Accessibility rows and the palettes' names through `t()`, the ratchet lowered, and EG-L10N's owed record in section 31; the rest OWED to L; `egaudit5_c_hud`; 27.9, 31 |
| L7-11 | LOW | `egRefusalText` keeps a second copy of four catalog sentences | FIXED | C: it reads the account's `REFUSALS`; `egaudit5_c` |
| L7-12 | MED | the lord's-wake drum swell plays at the hall's wake, not the lord's | FIXED | C: ambience while the lord sleeps, SPIRWAKE at the room's wake (`systems/eliteGates/egScore.js` `spireScoreKey`); `egaudit5_c_hud`; 26 |
| L7-13 | LOW | SPIREEND never plays for a fall | FIXED | C: it plays on my own fall; `egaudit5_c_hud`; 26 |
| L7-14 | MED | the patch note "No key yet? Choose Rehearse" is untrue: the start window opens only from a key | FIXED | C: `/breach` with no call of mine opens the start window with Rehearse (`startOpen`); `egaudit5_c`; 27.7 |
| L7-15 | MED | PR #800's description has regressed from AUDIT EG III L6-8 ("Lords, Vestiges and rewards in detail" gone; Spirebridge, Tonics, Reliquaries, the lords' marks and more omitted; the l10n debt missing from "Not yet built") | FIXED (words) | the coordinator: PR #800's description rewritten at the push - the detailed lords, Vestiges and rewards restored, every omission named, the l10n debt under "Not yet built" |
| L7-16 | LOW | smaller untruths in the notes: no falls on the party rows, no line at the lord's wake, a silent toll, "the Dusk-Warden", THE COVENANT'S PATIENCE, `/breach home` given twice | FIXED | C: falls on the party rows, the lord's wake named in chat, the toll's bell; `egaudit5_c_hud`; 27.4, 27.5. The notes' own words (c to e) corrected in PR #800's description at the push |
| L7-17 | LOW | reduced motion misses the gate's own cards in the Spire | FIXED | C: the gate's title cards and the Spire's arrival and fall cards are still; `egaudit5_c_hud`; 25.7 |
| L7-18 | LOW | `EG_LAYOUTS.lordH` is pinned but drawn by nothing | FIXED | C: the lord bar's height comes from it; `egaudit5_c_hud`; 27.1 |
| L7-19 | LOW | "the last five runs are kept" is write-only | FIXED | C: the boards' runs tab (`ui/eliteGates/egBoardWindow.js` `egRunsLines`); `egaudit5_c_hud`; 27.6 |
| L7-20 | LOW | lines tell a touch or pad player to type | FIXED | C: no line tells a touch player to type; `egaudit5_c_hud`; 27.8 |
| L7-21 | LOW | the `/breach` usage is incomplete, and an unknown word outside the Spire answers the call | FIXED | C: every word in the usage, `/breach help` and a `/help` line; an unknown word outside gives the usage; `egaudit5_c` |
| L7-22 | LOW | 27.1's decrees in the pause sheet on a sideways phone are half built | FIXED | C: folded to a press beside each arrival card, and 27.1 says so; `egaudit5_c_hud`; 27.1 |
| L7-23 | LOW | a first-time line whose answer was lost repeats after a reload | FIXED | C: first-time bits kept per account on the device (`ui/eliteGates/egBeats.js` `egFirstKey`), OR'd with the account's; `egaudit5_c`; 27.7 |

## Lane 8 - rewards, the economy, honours, boards, every number

| id | sev | finding | verdict | where |
|---|---|---|---|---|
| L8-1 | HIGH | the Panoply's 6-piece Reprieve never triggers inside the Spire | FIXED | D: a Spire blow is marked a foe's, and `setHurt`'s Spire branch runs Shed Skin and the Reprieve (`systems/sigil/sigilSetPowers.js`); `egaudit5_d_client`; 15, Sigil-Sets 6e |
| L8-2 | HIGH | the Deadlands embers a Redoubt pays never reach the player | FIXED | D: thrown as one sigil-stone stack the Broker counts (`systems/eliteGates/egSpoils.js` `egEmberStack`); `egaudit5_d_client`, `egaudit5_d_service`; 19 |
| L8-3 | HIGH | a member who falls and is recalled carries the old circle's earning state (= L3-3) | FIXED | with L3-3 (A2); `egaudit5_a2` |
| L8-4 | MED | holding back Redoubt receipts lets a player open a circle's Reliquary in every breach of the week | FIXED | D: a circle's Reliquaries open once per account per arena week (`eg_reliqs`, `egReliquariesOf`); `egaudit5_d_service`; 16.3 |
| L8-5 | MED | a player holding several receipts for one Redoubt can choose which one the week pays | FIXED | D: the spoils' seed mixes in a draw the service keeps on the row (`net/eliteGates/egPay.js` `egSpoilsSeed`), answered with the claim; `egaudit5_d_client`, `egaudit5_d_service`; 16.1, 19 |
| L8-6 | LOW | section 5's Weir Key line is never shown, and 5's item paragraph is stale | FIXED | C: the info card's Weir Key arm (`systems/item/itemInfo.js`); 5 rewritten; `egaudit5_c_hud`; 5 |
| L8-7 | LOW | the herald times a deeper start's posts from its first wake as if from Hall 1 | FIXED | A2: the news carries the start, and the post says *from Redoubt 9*; `egaudit5_a2`; 20 |
| L8-8 | LOW | the herald's comment says "earning entrants" (= L4-14) | FIXED (words) | with L4-14 (D) |
| L8-9 | LOW | a Depths row shows "wagered", not the Wager | FIXED | D: `eg_runs.wgs` keeps the Wager's decrees, and the board names them; `egaudit5_d_client`, `egaudit5_d_service`; 18, 20 |

## Lane 9 - records, the bible, pins, mutant lists

| id | sev | finding | verdict | where |
|---|---|---|---|---|
| L9-1 | MED | AUDIT EG IV is recorded nowhere | FIXED (words) | G: `01-Overview/audits/Audit-EG-IV.md`, its Active-Arcs line, section 31's pointer and the Accounts arc's bullet |
| L9-2 | MED | EG-HERO-LAY's record is stale since EG IV laid the Stacks, and contradicts itself | FIXED (words) | F: the hash note (2018192008, and 1273544078 at its merge), the laying table and the refusals |
| L9-3 | MED | four hero records say the relay never reaches the hero registry | FIXED (words) | G: the Cairn's, the Shade's, the Galleries' and the Wellhead's relay lines say "at this slice" |
| L9-4 | MED | EG-FULL's layers two and three and EG-E's first part name no host | FIXED (words) | G: a four-hosts paragraph on each, `exterior.js` flagged |
| L9-5 | MED | the pay law (`net/eliteGates/egPay.js`) has no mutants, though `egeco_pay`'s titles claim six | FIXED | D: those six and three more in `egaudit5_d.json`, against `test/net/eliteGates/egeco_pay.test.js`; `egaudit5_d_service` |
| L9-6 | MED | the Weir Key's odds are checked by nothing | FIXED | D: the odds pinned at their edges (1/6, 1/4, 1/3), with 5 mutants; `egaudit5_d_service`; 5 |
| L9-7 | MED | `assert.ok(EG_CHAMP_RING_M > 4)` pins a constant that is 13, and no test reaches the no-floor branch | FIXED | B: the constant pinned exactly, and `champRing` driven on a spot on no floor; `egaudit5_b` |
| L9-8 | MED | EG-ZF's record says a heal buys no share of a Redoubt's earners | FIXED (words) | G: EG-ZF narrowed, pointing to 16.1 |
| L9-9 | MED | departures of EG-ZG, EG-ZB and EG-ZI stale since EG-HERO-LAY | FIXED (words) | G: narrowed to code-built halls |
| L9-10 | LOW | EG-H2's departure 4 names laws 4-6 alone; EG-G1's departure 4 gives a stale reason | FIXED (words) | G |
| L9-11 | LOW | records' mutant counts disagree with their lists (`egz_state`, `egz_telegraph`, `egz_stair`) | FIXED (words) | G: 97, 75 and 84; AOE-PERF's floor strip recorded in EG-ZG |
| L9-12 | LOW | Testing.md rows say migration 0111 and `drawAuras` | FIXED (words) | G: 0113 (0117 since), and `auraFrame` |
| L9-13 | LOW | section 31's intro says `net/egHost.js` and `net/egLord.js` were never built | FIXED (words) | G: built by EG-PLAY and retired by layer one |
| L9-14 | LOW | Active-Arcs has no line for the EG-HERO wave or EG-HERO-LAY, and the Page-Index line lags | FIXED (words) | G |
| L9-15 | LOW | the Accounts arc misses AUDIT EG IV's account half | FIXED (words) | G: a bullet for it |
| L9-16 | LOW | two later commits (9a862e8d and a43a033e63) are recorded nowhere | FIXED (words) | G: section 31's note "After AUDIT EG IV", EG-ZA's PIN MOVED (eight cursors), and Sigil-Sets' EG15 naming `manaMine` |

## The fix groups

Each group worked in its own worktree, branched from 9a862e8d. Its brief was AUDIT EG III's groups' method:

- re-verify each finding first, its lane's probe re-run against the worktree (one that did not reproduce would be
  REFUTED);
- fix it at the root, to the page's spec - or correct the page, where the code was right;
- pin it with a test that fails without the fix, built from the real producers;
- write a mutant of every law line it changed, and run `tools/mutate.mjs --jobs 2` until each one died or was
  recorded equivalent, with its reason;
- re-aim by content the earlier records whose lines it moved;
- before committing, pass lint, types, the bible's gates and every `test/eg*.test.js`.

Only group F could change how halls are laid. The tests are in `test/egaudit5_<group>*.test.js`, each test's title
naming its finding, and the mutants in `tools/mutants/egaudit5_<group>.json`. The coordinator merged the groups in the
order of the table.

| group | final commit | merged as | findings | pins (tests) | mutants |
|---|---|---|---|---|---|
| G, the records | 7253f813a3 | 02606cf870 | 12 | none (the page and records) | none (re-ran EG IV's 197) |
| C, the client | 1db6bb0918 | 92afffb4a4 | 28 | `egaudit5_c` 13, `egaudit5_c_hud` 15 | 110 |
| A2, the director's run | 7dc34bb27b | 1e924f2818 | 16 | `egaudit5_a2` 11, `egaudit5_a2_client` 4 | 43 |
| A1, the director's company | 25f69d5a59 | 7981c31129 | 18 | `egaudit5_a1` 8, `egaudit5_a1_legion` 8 | 77 (2 equivalent) |
| D, the net | ca6ae33806 | 24dd4eab58 | 22 | `egaudit5_d_relay` 10, `egaudit5_d_client` 7, `egaudit5_d_service` 6 | 73 (1 equivalent) |
| B, the lords | 35a53e7b39 | 86e3d2895a | 28 | `egaudit5_b` 25, `egaudit5_b_client` 5 | 83 |
| E, render | ecc299e39d | b72cccadc2 | 10 | `egaudit5_e` 6, `egaudit5_e_look` 3, `egaudit5_e_alloc` 3, `egaudit5_e_swap` 3 | 88 (87, and one at the merge) |
| F, the law | a397bf8984 | 278c2d2352 | 23 | `egaudit5_f` 10, `egaudit5_f_ways` 3, `egaudit5_f_rim` 3 | 73 (2 equivalent) |

Together the first round's groups added 18 test files (143 tests) and 547 mutant records in seven lists, each file with
its Testing.md row; group H (below) brought the audit to 20 files (156 tests) and 573 records in eight. Between C and A2
the coordinator committed b0995aaf44, which joins C's EG-L10N record and G's note on it into one record below section
31's table, with a pointer in the intro. L7-15 fell to no group: the coordinator rewrote PR #800's description at the
push.

**G, the records** (no code). Lane 9's records findings:

- AUDIT EG IV's page (`01-Overview/audits/Audit-EG-IV.md`), written from what that audit left: its commits, its pins' titles,
  its mutant lists and the pull request's description;
- the four-hosts paragraphs;
- the stale hero relay lines;
- the departures EG-HERO-LAY had outdated;
- the mutant counts;
- Testing.md's rows;
- Active-Arcs, Page-Index and the Accounts arc;
- the note "After AUDIT EG IV".

G re-ran EG IV's 194 mutants and the Fallen Stacks' 3 on 9a862e8d: all dead. Its NEW items:

- **NEW-1**: the EG-L10N debt (848 hard-coded literals across 33 `eg*` files) recorded in section 31. Joined with C's
  record at b0995aaf44.
- **NEW-2**: `egaudit4_lords_page`'s title denies that `net/egLord.js` was ever built. Went to H (item 6).
- **NEW-3**: the design page's header blockquote names AUDIT EG III's page and no later audit's. Still owed.

**C, the client** (net/: `chatCommands.js`, `egBrain.js`, `egLink.js`, `wire.js`; `scenes/eliteGates/egClient.js`;
`scenes/world.js`; systems/: `egScore.js`, `itemInfo.js`; ui/: `egAccess.js`, `egBeats.js`, `egBoardWindow.js`,
`egHud.js`, `egParty.js`, `egSpireHud.js`, `enhancedMenu.js`, `gateTitleCard.js`, `partyPanel.js`; `world/eliteGates/egLights.js`).
Lane 7's doors, words and sounds, and these from other lanes:

- the witness's way out (L6-1) and the start window (L6-6);
- the rest's vitals (L2-9) and the potions (L2-14);
- the gather ring (L3-10) and the absent ring (L3-16);
- the Weir Key's line (L8-6).

`/breach` reaches the client only through `scenes/world.js`, the one host with a chat send path. `scenes/exterior.js`,
`scenes/worldModes.js` and `scenes/dungeonContext.js` were checked and have none. Its pins are `egaudit5_c` (13) and
`egaudit5_c_hud` (15), and `egaudit5_c.json` holds 110 records, all dead. Pages: sections 5, 7, 8.2, 11.10, 16.3-16.5,
17.4, 25.7, 26, 27.1, 27.4-27.9, 29 and 30, and the EG-L10N record. `world201` was re-hashed in place for the `here`
field and the `EG_PING_MS` export. Its NEW items, both fixed:

- **NEW-1**: the rest card's stake was never drawn on the Spire HUD (`egRestLine`);
- **NEW-2**: the recap's log was not reset between two breaches in one session.

**A2, the director's run** (net/: `egBrain.js`, `egHerald.js`, `egLegion.js`, `egLink.js`; scenes/: `egClient.js`,
`egFight.js`, `egLookDraw.js`). It took:

- lane 3's run: the Orrery, the Winch, the earner after a recall, the yard's squad, the plate, THE LAW PIN, the
  digest, the first gather, the Rehearsal's page, the solo fall, the Ghost and the Captive, the Orrery's rights, the
  absent Memento;
- the Rehearsal's one life (L7-6);
- the herald's start (L8-7).

Its pins are `egaudit5_a2` (11) and `egaudit5_a2_client` (4). `egaudit5_a2.json` holds 43 records, all dead; one record
was dropped because its line was reverted. It re-judged 19 existing records, all dead. Pages: 7, 8.3, 8.4, 8.7, 9, 16.1,
16.5, 20, 22, 23 and 27.7. Its NEW items:

- **NEW-1**: a Rampart's Kynval Squad stands 3 of its 4 elites when the legion's cap is short (seed 19, Hall 16, a
  company of three). Went to H (item 4).
- **NEW-2**: `egBlow` stored a pose without its hall. Fixed with L3-22.

**A1, the director's company** (net/: `egBrain.js`, `egLaw.js`, `egLegion.js`, `egLink.js`, `egRun.js`, `egStartLaw.js`,
`egVestige.js`, `wire.js`; ui/: `egHud.js`, `egSpireHud.js`; `world/eliteGates/egLights.js`). It took:

- lane 2's legion, Vestiges, decrees and offers (all but L2-9 and L2-14);
- lane 3's Bargain, Fraying, respite and Athenaeum Harriers.

It built The Fraying as decree 19, with its fray deepening by the circle, a recorded departure from a flat 36, without
which a deep Orrery cannot be solved. It decided the Wager as the company's own choice from Hall 1 (section 14). Its
pins are `egaudit5_a1` (8) and `egaudit5_a1_legion` (8). `egaudit5_a1.json` holds 77 records: 75 dead and 2 equivalent:

- EGA5A1-nx-sg-check, redundant with the circle's check;
- EGA5A1-bargain-pool-empty, because every family keeps a decree a Bargain can draw.

Pages: 6.2, 8.1, 8.4, 8.7, 12, 14, 15, 16.3, 16.4, 17.2 and 23's `st` row. Its NEW items, both owed to H:

- **NEW-1**: `engineWork`'s `here` reads a pose of any hall - L2-2's root. Item 2.
- **NEW-2**: the Redoubt-3 Mastery is offered only at the absolute third Redoubt, so a breach started deeper sees none
  until a Valkynaz. Item 3.

**D, the net** (`server/src/index.js`; `server-account/src/eg.js`, `server-account/src/egEconomy.js`, `server-account/src/egHonours.js`, migration
0113, 0117 since; net/: `bossRef.js`, `egBrain.js`, `egDurable.js`, `egFair.js`, `egHerald.js`, `egLink.js`, `egPay.js`,
`wire.js`; scenes/: `egArch.js`, `egClient.js`, `egFight.js`, `world.js`; systems/: `egSpoils.js`, `sigilSetPowers.js`;
`ui/eliteGates/egBoardWindow.js`). It took:

- lane 4 whole;
- lane 8's Reprieve, embers, Reliquary week, seed, herald comment and Wager row;
- lane 9's pay mutants and key odds.

The migration gained `eg_runs.nonce`, `eg_runs.wgs` and the `eg_reliqs` table, with `test/server/accountworker.test.js`'s table
pin. Its pins are `egaudit5_d_relay` (10, against the real Room), `egaudit5_d_client` (7) and `egaudit5_d_service` (6,
over the real Worker). `egaudit5_d.json` holds 73 records: 72 dead and 1 equivalent (EG5D-L4-9-everything-found). It
also re-aimed 20 records of earlier lists. It settled two of lane 4's unverified items:

- `EG_RC_KEEP` was real: `egRcFold` now bounds unclaimed receipts and spent marks separately, 16 of each;
- the fight's blows stay under the wire's bound: `EG_BLOWS_MAX` (32) at `egAim`, under 40.

Pages: 5, 6.1, 6.3, 6.4, 10.8, 15, 16.1, 16.3, 19-23, and Sigil-Sets 6e and 8. Its NEW items:

- **NEW-1**: EG-E (the rest)'s "world197 re-hashed with net/eliteGates/egPay.js in its graph" - `net/eliteGates/egPay.js` is in no relay
  graph. Went to H (item 7).
- **NEW-2**: the hub still calls a whole frozen company. Recorded in 6.1.
- **NEW-3**: a receiver still believes a hub-signed arch's site within 40 m, though the collider is withheld. Recorded
  in 6.3 with L4-6.
- **NEW-4**: `admitAsks` held one entry per breach a session. Built after the third merge ("The two small items, built").

**B, the lords** (net/: `bossRef.js`, `egBodies.js`, `egFeats.js`, `egFloor.js`, `egLegion.js`, `egLink.js`,
`egLords.js`, `egShape.js`, `wire.js`; `scenes/eliteGates/egFight.js`; `ui/eliteGates/egSpireHud.js`). It took lane 1, all but the hall law's
L1-19 to L1-21, and `EG_CHAMP_RING_M`'s pin (L9-7). A body's facing went onto the wire: rows of 19 fields, walks of 10.
Its pins are `egaudit5_b` (25) and `egaudit5_b_client` (5). `egaudit5_b.json` holds 83 records, all dead. It re-judged
79 records near its lines: 3 survivors and 1 record that would not parse were fixed, and now die. It re-aimed 33
records. Lane 1's sweep of section 13.2 (`p11_sweep`) found no violation after the fix. Pages: 8.5, 13.2-13.4, 18, 19,
and 23's `yw` and `ol`. Its NEW items:

- **NEW-1**: a member standing inside a lord's body gave a negative gap, every `minGap` blow was refused, and the lord
  froze. Fixed: the gap is clamped to 0.
- **NEW-2**: `egz_keys`' heavier-hand fixture moved; the freeze had been holding it.
- **NEW-3**: the Spellmaster's Examination runes and the Armsmaster's Last Lesson are still laid about the ground's
  first disc under THE OLD MASTERS - L1-26's class. Went to H (item 1).

**E, render** (render/: `courtCrystals.js`, `egMistPass.js`, `gateTelegraph.js`, `glProgram.js`; scenes/:
`dungeonContext.js`, `egArch.js`, `egClient.js`, `egFight.js`, `egLookDraw.js`, `egSpan.js`, `egSwap.js`,
`worldModes.js`; `ui/eliteGates/egHud.js`; world/: `egCircleParts.js`, `egCircleWorker.js`, `egHall.js`, `egLook.js`,
`egTelegraph.js`). It took:

- lane 6's rendering, lifecycle and performance;
- the place's white (L5-3) and the lamp budget (L5-16).

It also confirmed lane 6's unverified shader item and fixed it outside the arc: `render/glProgram.js` now deletes a
program's two shaders after the link, and the program on a failed link (Rendering.md says so). The two hosts it touched
are `scenes/dungeonContext.js` (the spans' collider) and `scenes/worldModes.js` (the swap's feed, the band's records and
the eye's cast). Its pins:

- `egaudit5_e` (6);
- `egaudit5_e_look` (3);
- `egaudit5_e_alloc` (3): object identity and V8's sampling heap profiler;
- `egaudit5_e_swap` (3).

`egaudit5_e.json` holds 88 records, all dead. It re-aimed about 22 records of earlier lists. No file in the relay's
graph moved. Pages: 7, 11.9, 15, 25.2-25.4 and 29, the records EG-H3, EG-ZG, EG-ZN and EG-ZP, and Rendering.md's
glProgram line. Its NEW items:

- **NEW-1**: `egSpecForget` is never called, so the given halls (up to 32) stay for the session, against its doc. Went
  to H (item 5).
- **NEW-2**: the worker built only under the build's own law, and an older law took the old step. Built after the third
  merge ("The two small items, built").

**F, the law** (net/: `egBrain.js`, `egDurable.js`, `egFragLaw.js`, `egLaw.js`, `egSpanLaw.js`, `egWalkGraph.js`;
scenes/: `egFight.js`, `egSpan.js`; `world/eliteGates/egHall.js`; `tools/egSpanSolve.mjs`). It took lane 5's law, the walk graph
and the words, the Molten Rim (L1-21), the Reliquary Vault (L3-18), the twist roll (L3-11), the first circle (L3-9), the
walkway's and the first span's words (L1-19, L1-20) and EG-HERO-LAY's record (L9-2).

It made hall laying **spec law 8, "THE WAYS LAID"**: `EG_SPEC` 8, and `EG_LAWS` 8 dated 2026-10-15. Every change to
hall laying is gated on `EG_WAYS_LAW`. The walk graph, the director and the client changes apply under every law. Laws 4
to 7 keep their 800-hall hashes (1228307904, 1301097644, 201408482 and 2018192008), and law 8's 800 halls hash
3066462283. The real motor's span sweep crossed every course on all four bands under law 8. Its pins are `egaudit5_f`
(10), `egaudit5_f_ways` (3) and `egaudit5_f_rim` (3). `egaudit5_f.json` holds 73 records: 71 dead and 2 equivalent:

- EGA5F-third-past-room: the room's guard never bound, over 200 seeds by 9 grounds for Halls 51-100 and 60 seeds by 3
  for Halls 101-200. It is kept as `EG_HALL_LEN_MAX`'s guard.
- EGA5F-by-dropped: no crossing moved over 120 law-8 Brinks, and the crossing is a measure, never a gate.

It re-aimed 15 records, all dead. Pages: 1, 7, 8.2, 8.3, 8.5, 8.7, 8.9, 9, 10.5, 11.3, 11.4, 11.7, 11.10, 13.3, 13.4,
18 and 24, with notes on EG-FULL and EG-HERO-LAY. Its NEW items:

- **NEW-1**: the director's zones keep only their last 24, so a long Court fight pushed out the Molten Rim. Fixed:
  `moltenRimKeep` stands it again.
- **NEW-2**: a span's vault could be taken in the closing. Fixed: it is taken in the trial alone.
- **NEW-3**: the Masters' last lesson ring, a fight-long zone, sits under the same cap. Went to H (item 1).

## At the merges of the groups

The coordinator merged G, then C, then A2, A1, D, B, E and F (the table's order), and re-hashed `world201` in place at
each merge whose files were in the relay's graph. Where two groups had built halves of one thing, both halves were kept:

- **The company's row.** `net/eliteGates/egBrain.js` `egCompanyOf` keeps C's `here` (the gather) and A2's recall (a Rehearsal's
  members, none).
- **The squad and Stillness.** A Rampart's Kynval Squad holds the march's first wave for `EG_SQUAD_HOLD_MS` and then
  Stillness's 10 s (`standFight`: A2's hold, A1's Stillness).
- **Who is here.** `egBlow` reads `egPosedHere` (A1's L2-2), whose poses carry their hall (A2's L3-22).
- **The panel.** `ui/eliteGates/egHud.js`'s `panelSame` (E's compare by words) gained `touch` (C's pad focus). The new mutant
  EGA5E-panel-touch-unread is pinned in `egaudit5_e_alloc`: E's list, 87 to 88.
- **A clash of names.** At the join of C and E, `egaudit5_e_alloc` held a test variable `p3` twice, and 32 of E's
  records reported that they did not apply. Renamed `pFocus`, all 88 died.
- **Law 8 against the earlier pins.** F's law moved four of the earlier groups' fixtures, and each was re-fixtured
  under law 8:
  - A2's L3-7 compares law 6;
  - A2's L3-19 strikes a chain at the chain's own height, the Ghost's test walks island by island, and the span's chains
    are asserted on island and plate floors;
  - B's L1-22 strikes its blow from the walker's own height;
  - E's L6-4 mist reads `risenAt ?? 12`.
- **A survivor.** After law 8, EGA5A2-captive-span-air (a span's chains not laid on its islands) survived: the chains
  laid without the span's branch still passed the pin. It died once the pin asserted that every chain stands on an
  island's or a plate's floor.
- **Records re-aimed by content after the joins**: EGA5A2-rehearsal-row-recall, EGA5A1-nx-spire-hud,
  EGA5A1-still-squad, EGA5A2-orrery-wake-range and E's panel records.

All seven lists were then run on the merged head (`tools/mutate.mjs --jobs 2`, all 547 in three workspaces): 541 dead, 1
survived (EGA5A2-captive-span-air, killed as above), 5 equivalent as recorded, none stale and none that did not apply.

## Pins moved and records re-aimed

Each pin moved carries its `PIN MOVED (AUDIT EG V, <group>: <why>)` note. Each group re-aimed by content the records
whose quoted lines it moved (test/tooling/mutantdrift.test.js), and re-judged the lists aimed at its lines.

- **A1**:
  - pins moved: `egfull_relay` (it now fails without the decrees' fix), `eg5_profile` (the Fraying's name is the
    omen's; `EG_DECREES`' length), `egfull_law` (twenty decrees), `egarch_client` (Wager rows 20 to 21) and
    `egaudit3_law_bridge` (Spirebridge through `egPick`); `l10n4_hardcoded`: `net/eliteGates/egLaw.js` 189 to 191, `ui/eliteGates/egHud.js`
    37 to 39;
  - re-aimed: EGA3-count-respite-floor, EGA3L-wave-room-default, EGA3L-room-friend, EGA3L-wave-partial-unheld,
    EGA4L-host-past-health, EGPRES-the-twist-dropped, EGZ-the-first-wave-at-the-wake, EGZS-strike-add-half,
    EGZR-hymn-other-hall.
- **A2**:
  - pins moved: `egplay_relay`'s EG-PLAY ONE LIFE (a solo fall says `fin` 1); `l10n4_hardcoded`: `net/eliteGates/egHerald.js` 13
    to 14;
  - re-aimed: EGA3C-law-foreign-own-law, EGLOOK-draw-remade-every-frame, EGMADE-the-spec-never-asked,
    EGFRAG-a-page-given-twice.
- **B**:
  - pins moved: `egz_state` (rows of 19, walks of 10, `egObSay` 7 to 8), `egz_relay`, `egplay_relay`, `egz_stair`,
    `egz_telegraph` (the rim's pattern), `egeco_feats`, `egaudit3_lords`, `egz_keys`, `egaudit4_lords` and
    `relayversion`; `l10n4_hardcoded`: `net/eliteGates/egLords.js` 55 to 89, the phases' names;
  - re-aimed: 33 records.
- **C**:
  - pins moved: `egplay_client`, `egpres_hud`, `egaudit3_law_bridge`, `egaudit3_pres_beats`, `egeco_board`,
    `egz_ends_board`, `egz_recap` and `chatchan`; `l10n4_hardcoded` lowered: `scenes/eliteGates/egClient.js` 63 to 58,
    `ui/enhanced/enhancedMenu.js` 64 to 58, `ui/eliteGates/egAccess.js` gone from the list;
  - re-aimed: 24 records.
- **D**:
  - pins moved: `egint_relay`, `egaudit3_legion_blows`, `egz_debts`, `egz_mastery`, `egz_rules`, `egz_recap`,
    `egeco_service`, `egplay_service`, `accountworker` (`eg_reliqs`) and `relayversion`;
  - re-aimed: 20 records.
- **E**:
  - pins moved: `audit68_render_b`, `egaudit3_client`, `egaudit3_law_bridge` (onto the host's real collider wrapper),
    `egz_telegraph` (`egShapeYs` retired), `eglook_hosts`, `eglook_art`, `egswap_client`, `egz_camera_host` and
    `egz_debts_circle`;
  - re-aimed: about 22 records in `egz_telegraph`, `fb1013e_aoeperf`, `wb13a`, `eglook`, `egz_camera`, `egz_recap` and
    `egaudit4_lords`.
- **F**:
  - pins moved: `egaudit3_law`, `egdur_relay`, `egz_frag`, `eghero_lay`, `egfrag_law`, `egz_state`, `egz_camera`,
    `egz_camera_budget` (7.6 and 8, 9.75 and 12, 26.9, 39 and 43), `eg6a_sweep` and `relayversion`;
    `l10n4_hardcoded`: `net/eliteGates/egSpanLaw.js` 12 to 16, the solver's refusals;
  - re-aimed: 15 records.
- **G** moved no pin.
- **At the joins**: the four law-8 fixtures, the five records and the new mutant named above.
- **Testing.md**: eighteen rows, one for each new test file, and the Suite line recounted at each merge.

`RELAY_VERSION` stayed the arc's `world201`, unshipped, with its hash re-taken in place by A1, A2, B, C, D and F and at
their merges; E and G moved no file in its graph. `ACCOUNT_VERSION` stayed `acct133`, and D's tables went into the
arc's own migration. Both were renumbered at the merge of main.

## At the merge of main

The coordinator then merged main: 84 commits, through 366f9d836b (#909), the host split #907 and #909 among them.

- **Versions**:
  - the arc renumbered to `RELAY_VERSION` `world203`, past main's CHAT-TRADE (`world201`) and FIVE-ASKS (`world202`);
  - `ACCOUNT_VERSION` to `acct134`, past LAMP-KEEPER II (`acct133`);
  - its migration to `0114_elite_breach.sql`, past LAMP-KEEPER II's `0113_lamp_title.sql`;
  - `EG_RELAY_MIN` to 203.

  Every version pin, the wrangler line and the mutant records aimed at the version lines moved with them.
- **Titles.** The Spire's thirteen titles follow main's I Love Lamp in `TITLES` (`net/identityToken.js`, 42 titles).
  `acc3titles`' whole list moved, and so did the six title-slice pins - `aegis`, `chap4c_titles`, `chap6e_titles`,
  `crystalfist`, `hoursfirst` and `primarch` - each by 13 places, each with a PIN MOVED note.
- **One FBX writer.** Main had moved MW-FOLK1's cut pins' writer to test/fixtures/fbxWrite.mjs (DELETED by this merge), and the arc had its
  own `tools/fbxWrite.mjs` for EG6c's reference fragment. They became one home, `tools/fbxWrite.mjs`, which gained
  main's `blender` footer (ONE DFU MEMBER, ONE EXPORT). `tools/fbxMesh.mjs` keeps the arc's `cornerWelder` and main's
  `materialReader` and `objectMaterials` (MW-HEADS1).
- **The catalogs.** The thirteen whole languages' locale tables were merged key by key, and the English catalog was
  regenerated.
- **What the merged suite found.** The whole suite on the merged tree failed four tests, and the coordinator fixed
  three of them:
  - main's `LAMP_ARCHIVE` (`systems/lampKeeper.js`, LAMP-KEEPER II) was 38241, the Spire's Broken Galleries
    (`world/eliteGates/pseudoArchives.js` `EG_BAND_ARCHIVES`). EG-G2's registry sweep refused it. The lamp's key is a runtime
    upload that nothing stores, so it moved to 38232, the first free number after the harbour's, and was registered.
    The mutant EGLOOK-lamp-on-the-galleries (`tools/mutants/eglook.json`) puts it back and dies. `lampkeeper2` and
    `eglook_registry` carry PIN MOVED notes, and `01-Overview/handoffs/Five-Asks-2026-10-14.md` names the new number;
  - `lampkeeper2`'s "the vocabulary, last" now reads `TITLES.at(-14)`, because a shipped title's index never moves;
  - `chattrade1`'s version pin moved to `world203`.

  The fourth, `csstarget`, failed only because the local install still had Vite 5. Main's AUDIT DEPS1 had moved the
  game to Vite 8, and the test passed after `npm ci`. CI's `verify` was green on the merge commit (62eeb8d923). The
  seven AUDIT EG V mutant lists were run again on the merged tree: 542 dead, 0 survived, 5 equivalent as recorded.
- **The hosts.** Main brought HOST-SPLIT (`01-Overview/Host-Split.md`, `test/scenes/hostceiling.test.js`): from here on, new
  behaviour goes into a module a host wires, not into a host's own function. The second round works under it.

## The second round

Group H branched from the merged head after the merge of main (62eeb8d923). It pins its work in
`test/egaudit5_h*.test.js`, with mutants in `tools/mutants/egaudit5_h.json`, and re-hashes `world203` (`world205` since the second merge of main) in place if the
relay's graph moves. Group L was briefed beside it and not run (below).

### Group H - the followups

What it was asked to do:

1. Under THE OLD MASTERS, lay the Spellmaster's Examination runes and the Armsmaster's Last Lesson over the master's own
   fight floor, measured against THE ERRAND FLOOR (B NEW-3, the class of L1-26). Keep the Last Lesson's fight-long ring
   under the zones' last-24 cap, as `moltenRimKeep` keeps the Rim (F NEW-3).
2. `engineWork`'s `here` through `egPosedHere` (A1 NEW-1).
3. The Redoubt-3 Mastery for a breach started deeper: page and code to agree per section 15 (A1 NEW-2).
4. A Kynval Squad that stands all four under the cap (`egLegionSummon`, need 4), named in section 12 (A2 NEW-1).
5. `egSpecForget` called at the breach's end on every way out, pinned (E NEW-1).
6. `egaudit4_lords_page`'s title about `net/egLord.js` made true (G NEW-2).
7. EG-E (the rest)'s sentence on `net/eliteGates/egPay.js` and `world197` narrowed (D NEW-1).
8. THE RAILS' CLIMB: the Colossus's hearts reached from its Rails as ridden pieces - or recorded why not in 13.3 and
   section 30 (L1-13's open half).
9. The first-across gold ribbon on a span and allies at 60% on traversal ground - or their section-30 lines kept with
   their reasons (L3-10 (b) and (c)).
10. Live burning ground no ground to flee to under THE UNION FLOOR (`egFloorLess`), with lane 1's `p11_sweep` re-run
    (L1-10's limit).

What it did. Its agent stopped after three commits (b47b2043bb and the two before it); the coordinator finished the
group from that tree (e453f8587c) and merged it (96b62ba692).

| item | verdict | what changed | where |
|---|---|---|---|
| 1 (B NEW-3, F NEW-3) | FIXED | On another lord's ground of many pieces a master lays its errands and its court's blows about the disc it stands on, the nearest by its edge (`net/eliteGates/egLords.js` mainDisc); the Examination's window is never under THE ERRAND FLOOR of its route walked over the fight floor (`egRuneRouteM`, a walker on the havens' grid); the Last Lesson keeps the court it turned on, its last ring (r 12, r 17 on THE MASTERS' GROUND) stands to the fight's end, and one keep holds every zone laid to the fight's end (`egZonesKeep`: the Molten Rim, the Lesson's ring, Both Courts Burn), in place of the Rim's own | `egaudit5_h`; section 18 |
| 2 (A1 NEW-1) | FIXED | `engineWork`'s `here` is `egPosedHere(B)`: an engine's blow is aimed at the company by its poses of this hall | `egaudit5_h` |
| 3 (A1 NEW-2) | FIXED | the Mastery is offered at the breach's third Redoubt, a deeper start's too (`net/eliteGates/egRun.js` egOffers hands `w` as the Redoubt's place in the breach, as THE LEAN counts) | `egaudit5_h`; section 15 |
| 4 (A2 NEW-1) | FIXED | a Kynval Squad stands its four elites whatever the room, a mechanic's body, and counts against the room after (`net/eliteGates/egLegion.js` egSquad through `egLegionSummon`, need 1 each) | `egaudit5_h`; sections 8.7 and 12 |
| 5 (E NEW-1) | FIXED | the halls given are forgotten on every way out - the walk out, the frame's way out, away (`scenes/eliteGates/egClient.js` lawForget: `egSpecForget`, what was asked and given, the trail) | `egaudit5_h_client`; section 22 |
| 6 (G NEW-2) | FIXED (words) | `egaudit4_lords_page`'s title no longer says `net/egLord.js` never existed | the test's title |
| 7 (D NEW-1) | FIXED (words) | EG-E (the rest): `net/eliteGates/egPay.js` is in no relay's graph - the account service and the client import it | section 31 |
| 8 (L1-13) | RECORDED | the climb on the Colossus's Rails is not built: a ridden piece today is a span's, laid by the hall's law on the fight's clock (`net/eliteGates/egFair.js` egRideAt), and a Rail on a body walking its own route is a new kind of piece the motor, THE FAIR TRAIL and the solver would each have to learn | sections 13.3 and 30 |
| 9 (L3-10 b, c) | FIXED | THE TRAIL: the door's word names its first across; each screen keeps every living member's route (`world/eliteGates/egLook.js` egRibbonPush, a point a metre at most, a point on a moving piece kept on it) and draws the first across's for the others in the closing as THE EDGE LINE's gold at 40% (`render/eliteGates/egLinePass.js`, its own buffer). Allies on traversal ground draw at 60% with their names kept (`scenes/eliteGates/egClient.js` allyVeil through the host's every-peer veil; `net/remotePlayers.js`); their Sigil auras are not drawn there, as a concealed peer's are not | `egaudit5_h`, `egaudit5_h_client`; section 8.2, both lines gone from section 30 |
| 10 (L1-10's limit) | FIXED | a ground burning as a landing comes is no ground to flee to under THE UNION FLOOR (`net/eliteGates/egFloor.js` egBurnsIn). Lane 1's `p11_sweep`, run again on the merged tree after the second round: 0 violations over every lord, for one and four members | `egaudit5_h`; section 13.2 |
| 11 (seen while drafting) | FIXED | a Rift-Yard's Kynval Squad holds its first wave Stillness's 10 s past its 30, one law with the Rampart's (`net/eliteGates/egBrain.js` squadTwist) | `egaudit5_h`; section 17.2 |

Pins: `egaudit5_h` (8 tests) and `egaudit5_h_client` (5). E NEW-1's pin walks out too (a forsake): the walk out's
forgetting was the one way no pin held, and its mutant survived until it did. Mutants: `tools/mutants/egaudit5_h.json`,
26, every one dead. Records H's edits moved, re-aimed by content and run, every one dead: 22, in `egaudit3_client`,
`egaudit3_legion` (PIN MOVED: the squad whole - its mutant now holds the squad to the room), `egaudit4_legion`,
`egaudit4_lords`, `egaudit5_a1`, `egaudit5_a2`, `egaudit5_b`, `egaudit5_e`, `egaudit5_f` (EGA5F-rim-keep-live now aims at
`egZonesKeep` in `net/eliteGates/egLords.js`), `eglook`, `invislook` and `slam15`. Pins moved: `egaudit3_client` (`drawOver`'s
signature), `egaudit3_legion`, `egaudit5_b` L1-26 (the master's own court, the havens' measure), and `invislook`'s two
source pins (a veil that keeps the name shows it; the host's veil an ally's too). `RELAY_VERSION` `world203` re-hashed
in place.

### Group L - EG-L10N: not run

Group L was briefed to route the arc's player-facing English through the text core (`t(key, en, args)`), lower the L10N4
ratchet, and draft the thirteen whole languages. Mac stopped it on 2026-10-15: *"Lets just skip localization for now"*.
Its partial work was not merged. EG-L10N stays owed as section 31 records it ("### EG-L10N - owed"): the Spire's own
words reach every player in English, whatever language they chose, and the L10N4 ratchet holds their counts where the
arc arrived.

## At the second merge of main

After group H and this page were pushed (b94c6a3dd6), main had moved 59 commits more - UI-CALM, FIRM1 and FIRMAMENT-ON,
REL-FAST, MW-HEADS3, and The King's Gambit's KG-SET, KG5 and KG6 among them - and the pull request conflicted again, so
the coordinator merged it once more:

- **Versions**:
  - `RELAY_VERSION` `world205`, past KG-SET (`world203`) and KG5 (`world204`); `EG_RELAY_MIN` 205;
  - `ACCOUNT_VERSION` `acct135`, past KG6 (`acct134`);
  - the migration `0116_elite_breach.sql`, past FIRMAMENT-ON's `0114_firmament.sql` and KG6's `0115_gambit_ladder.sql`.

  The relay's graph pin holds both arcs' files, and every version pin, the wrangler line and the mutant records aimed at
  the version lines moved again.
- **Titles.** The Spire's thirteen follow KG6's Grandmaster in `TITLES` (43). `acc3titles`' list, the six title-slice
  pins and `lampkeeper2`'s I Love Lamp moved with PIN MOVED notes.
- **The lords' cards.** KG-SET took the Iliac set's words out of the relay's catalog (`net/iliac/iliacCards.js`, which the
  relay carries and which never shows a word) into `systems/iliac/iliacCardWords.js`, read through the text core. The thirteen
  lords' cards lost their `text` and `flavor` there and gained their words in `iliacCardWords.js`
  (`cards.iliacSet.eg*`), drafted for the thirteen whole languages as KG-SET drafted the set's (recorded as
  `claude-in-session`). `cards8_catalog`'s counts and its catalog hash moved.
- **The honours.** A board, a box and an account's row lay the Spire Champion and the Grandmaster both
  (`withEgHonours`, then `withGambitHonours`, in `server-account/src/board.js`, `boardNames.js`, `letters.js` and
  `index.js`).
- **The account's clock.** The stake clock's hourly job stands beside KG6's minute job: nine statements a minute and
  twenty-three an hour on a quiet world (`auditscale` D7).
- **What the merged suite found**, each fixed:
  - group H's ribbon push and THE FAIR TRAIL's shared a name, `egTrailPush`, in two modules (`audit24_onehome`): the
    ribbon's is `egRibbonPush` (`world/eliteGates/egLook.js`);
  - KG5's string archive `'kings-gambit'` (`render/gambitTableDraw.js`) was in no row of EG-G2's registry: registered;
  - the lords' pronouns pin read a card's flavor from the catalog, where it no longer stands: it reads `cardFlavor`;
  - `kg5_relay`'s version pin moved to `world205`; and the card words' rows for the thirteen languages (`kgset_cards`,
    L10N1b, L10N6b), merged through `tools/l10nInSession.mjs`.
- **The hosts' ceilings.** HOST-SPLIT's ceilings were measured on main, without the arc's own wiring: +226 code lines
  in `bootWorld` and +191 in `createWorldModes`, written before HOST-SPLIT. With main's growth since (+38 and +153),
  the merged hosts stood 14 and 98 lines over. Host-Split.md names the case - two branches that each fit, landing
  together - and its two fixes, a move or a raise with its reason. The coordinator raised each ceiling by the arc's
  own lines (to 21,921 and 7,350), with the reason beside it in `test/scenes/hostceiling.test.js`, and records the move as
  owed: `tools/hostMove.mjs` refuses the circle's group (its state is `let`s), and the method's last step - Mac plays
  the slice and runs `npm run perf` - is his.

## At the third merge of main

Main moved once more before the push could be verified: POI-1 and AUDIT POI (the POI editor's store) took `acct135` and
migration `0116_poi.sql`, and the relay stayed `world204`. The arc's account half renumbered past them -
`ACCOUNT_VERSION` `acct136`, the migration `0117_elite_breach.sql` - with every account pin chain, the wrangler line,
the tables pin and the mutant records on the version lines; `RELAY_VERSION` stays `world205`. POI-3's editor lines joined
the world host's foreign passes beside the arc's two (30 call sites; 37 host call sites across the passes), and the held
map's legend reads the arch and the POIs both. CI's whole gate found POI-1's `POI_TEXTURE_ARCHIVE` (600000,
`poi/poiRuntime.js`) in no row of EG-G2's registry: registered.

## The two small items, built

After the third merge, the two items this page left owed as small were built (2026-10-15):

- **D NEW-4, the asks are the one breach's.** `scenes/eliteGates/egClient.js` counted the asks my hall made of the service in a map
  by breach: an entry for every breach a session stood in. It holds the one breach's count now (`admitAsks` `{ b, n }`,
  read through `admitAsked`), begun again by the next breach. Pinned in `egaudit5_d_client` (D NEW-4: each breach its own
  EG_ADMIT_ASKS). Mutant `EG5D-NEW4-the-count-carried` is dead, and the two L4-3 records on the changed lines were
  re-aimed.
- **E NEW-2, the worker builds under another law.** Under another law the client asked the room for a circle's halls only
  once it stood in that circle, and offered the swap's worker nothing (its module holds no hall the page was given), so
  every circle of such a breach stepped the old way: out and in again, the circle built on this thread. Now:
  - the next circle's halls are asked while the Court rests (the room gives this circle's or the next's);
  - once all five are given they go to the worker with the ask (`scenes/eliteGates/egSwap.js` `want`'s `given`, through the mode
    machine's egPrebuild), and `world/eliteGates/egCircleParts.js` egCircleBuild takes them as given before anything is laid; a
    build asked with them is another build of the circle than one asked without;
  - a hall given is counted under its own ground (`b:h:geo`): a next circle whose span decrees move its ground has its
    halls asked again under it, and steps the old way meanwhile;
  - a circle stood from its five given halls is the breach's own and is never built again.

  Section 22's THE LAW PIN and EG-H2's departure 4 say so. Pins: `egaudit3_client` (lane4 #3, PIN MOVED: the worker under
  another law builds from the halls given; E NEW-2: the halls given are their ground's), `egaudit5_e_swap` (E NEW-2: the
  worker builds from the halls given, and the swap and the mode machine hand them on), and `egswap_client`'s pin of the
  rest's ask (PIN MOVED). Mutants: eight new (four in `egaudit3_client.json`, four in `egaudit5_e.json`) and six re-aimed (two in each of
  those and in `egseam.json`), all dead; the six lists around the touched lines ran 418 dead and 1 equivalent as recorded.

## At the fourth merge of main

Main moved 49 commits more (FIELD BUGS 2026-10-14's PVP-LOOT + QUEST-HOME, SUMMON-REPAIR and PVP-ESCROW, PARTY-LOOT,
LIGHT-ID, HORSE-TIERS and the rest) and took `world205`, `acct136` and migrations 0117 and 0118. The arc renumbered past
them once more:

- **Versions**: `RELAY_VERSION` `world206` (its law row re-hashed with `src/net/homeLaw.js` in the graph), `EG_RELAY_MIN`
  206; `ACCOUNT_VERSION` `acct137` in `service.js` and `wrangler.toml`; the migration `0119_elite_breach.sql`. Every
  relay and account pin chain took the arc's entry over main's, and the mutant records on the version lines moved. The
  account history line (`renown_char`) keeps main's newest entry, as the earlier merges kept it.
- **The orders**: `ORDER_KINDS` holds QUEST-HOME's `home` and the arc's `egopen` and `egadmit`; a home order carries no
  breach's fields and a breach's order no home's.
- **The account's clock**: PVP-ESCROW's sweep beside EG-ZM's stake clock - nine statements a minute and twenty-four an
  hour on a quiet world (`auditscale` D7).
- **The gate's lights**: LIGHT-ID adopts the gate's fire by its gate; EG-F's arches' lights stand beside it.
- **The dungeon's find under PARTY-LOOT**: main made a dungeon body the room's base, its death raised inside the base on
  every client in the room and not at the kill. Taken as it stood, an elite's Weir Key find would be asked by every client
  in the room and thrown onto a copy nobody sees. The find now ignores the base's raise (marked `room`), the kill asks it
  at the host (`egFindKill`) and the joiner's door as before, and a key found on a room's body goes to the pack whole.
  Section 5 says so. Pinned in `egeco_find` (EG-E3 x PARTY-LOOT); 8 mutants in `egeco_relay.json`, and the 80 of that
  list's EGECO3 family, all dead.

## Still owed

- **EG-L10N**: the arc's own words through the text core, skipped at Mac's word (group L, above).
- **What the groups RECORDED instead of building**, each on the page with its reason:
  - the first circle is fixed for every breach (L3-9, section 7);
  - the Spire's Orrery judges with no rights (L3-21, 8.4);
  - refusal 6 as enforced (L4-11, 5);
  - the hub calls a whole frozen company (L4-4, D NEW-2, 6.1);
  - the arch's site and refusals 2-5 and 8 are the opener's word, and a receiver believes a hub-signed site within 40 m
    with no collider (L4-6, D NEW-3, 6.3);
  - a digest mismatch is logged, not carried on a receipt (L3-12, 9);
  - the Fraying's fray deepens with the circle (L2-10, 8.4 and 14);
  - the Wager is the company's own choice from Hall 1 (L2-5, 14);
  - two Challenges share one ring (L1-28, 13.3);
  - the climb on the Colossus's Rails (L1-13, 13.3 and 30).
- **What still allocates in a frame** (E, section 11.9):
  - `egHolderNow` and `egBeatWatch`;
  - `egSpireHudModel`;
  - the client's presence, feet and panel options;
  - `egShapeOrder` and the Map and Set clear tables;
  - `telegraphField`'s answers and the tethers' looks.
- **The lanes' unverified items no group settled**:
  - lane 1:
    - whether a held absent body can be a lord's target or Scent;
    - a lord's run setting its body down after the recovery (a 22 m pop at the Charge's end);
    - a Court of two that is no pair saying nothing at its first fall;
  - lane 2: the Tonic's Living Wall bonus against EG-ZS's departure 8;
  - lane 3:
    - the Holdfast, the Winch and the engine counting 250 ms a beat on a late alarm;
    - the Rampart's march leaving a weak company a window;
  - lane 4: a deploy inside the open window;
  - lane 5:
    - the Mist Stair's false wall, never drawn;
    - fragment lights' shadows;
    - JavaScriptCore against V8 for halls laid under laws 4 to 7 (law 8 decides in integers);
  - lane 6:
    - a Ward-Bearer's tether (the law holds no ward link);
    - a witness leaving by a teleport or an item;
  - lane 7:
    - the classic pickers' row width;
    - the pad's A answering the call on the Plus skin;
    - the rule sweep under reduced motion;
  - lane 8:
    - Discipline in the Spire;
    - a second device handed a held Redoubt receipt;
    - *You find a Weir Key* said twice on a re-claim;
  - lane 9: `EG_LONG_STEP_LOOK` (10) against section 17.2's "for one span".
- **The arc's cut out of the hosts** (HOST-SPLIT): the circle's group in `createWorldModes` - PAID (EG-LOOK, 2026-10-15):
  `standEgHall`, the band's dress, the look, the gates, the swap and the occluders moved verbatim to
  `scenes/eliteGates/egCircleHost.js` (`egCircleHost.js:"export function createEgCircleHost("`), the mode machine's `mode`,
  `dungeonCtx` and `dungeonLoc` read live through `wm`; `createWorldModes` 7,263 -> 7,131 code lines and its ceiling down
  by the 132 it moved (7,350 -> 7,218). Still owed: the arc's wiring in `bootWorld`, its ceiling lowered with it.
- **A browser with the game's data**: nothing here was seen running. Every fix is tested headless, against the
  director's own frames, the relay's Room, the account Worker and the real player motor.
- **EG21's tuning in the field**, still the owner's.

## What a player notices

From the groups' patch notes, in short:

- **Courts of two lords:**
  - Garoth's Court beside the Last Armsmaster can be won;
  - each lord keeps its own element, mirrors and decree, and the HUD shows a bar for each lord standing;
  - signature feats are earned on their own lord, and a lone player can earn Every Challenge Met.
- **The lords:**
  - the Kynreeve faces where he guards on every screen;
  - Morvayn's chains drop a fallen member and snap link by link;
  - the Chain Snaps, a Soul Burst and the Cage Closes strike only the members they name;
  - burning bridges and falling floors can be dodged like any blow;
  - the Night-Stalker's true shadow glints 2 s before it rises;
  - every lord's phase shows its card;
  - a chained follow-up blow is drawn dim until the first lands.
- **Decrees and the Bargain:**
  - the decrees a company votes now shape the next circle, and the beacon names them and the next Court;
  - Dagon's Bargain is offered only when it has a decree to give;
  - a new decree, The Fraying;
  - Stillness holds back the first wave of any hall that has one.
- **Companions and the legion:**
  - a companion gone home or left behind no longer strengthens your blows;
  - sleeping Lurker statues no longer stop the waves;
  - splash hits respect a Shielded Kynval's front;
  - the Athenaeum sends Harriers;
  - a respite can be asked for again after each one, and Y readies up.
- **The halls:**
  - a deep Athenaeum no longer freezes the breach;
  - a company short a member can still raise the Winch;
  - Kynval Squads hold Rift-Yards;
  - the Ghost and the Captive stand on Spans, and the Captive hangs three chains everywhere;
  - Reliquary Vaults pay in Proving Walks and on forked spans;
  - about one trial hall in four carries a twist.
- **Climbing and crossing:**
  - stairs climb to the Rampart's caster pillars, the Wyrm's perches and the Council Rotunda's balconies;
  - the Molten Rim leaves gold causeways;
  - the Brink into the Cairn always carries its Sinking Stair;
  - deeper spans carry more passages;
  - the Forge Line always leaves a way clear of the hammers.
- **Fair counting:**
  - standing still or a tab in the background still takes a lord's blow;
  - a late step through the arch admits you;
  - a call to another breach no longer wipes yours;
  - a recalled member no longer earns a Redoubt idle;
  - a heal mends your standing only when the room saw it cast.
- **Rewards:**
  - Reprieve and Shed Skin work in the Spire;
  - Redoubt embers reach your pack;
  - a circle's Reliquaries open once per account a week;
  - the spoils are decided when the claim is made;
  - the Depths board names a run's Wager;
  - Ashen Vigil restores magicka and fatigue by its share;
  - a reload no longer refills potions.
- **Controls:**
  - `/breach` takes all its words (`/breach help`);
  - the pad reaches every panel choice;
  - a fallen player sees who they watch, taps a row, and pings from the pad or touch;
  - the recap marks every fall, survives a reload and has a Close button;
  - the Annals can be read anywhere.
- **Look and sound:**
  - a drum swell at the lord's wake, and the end theme on your fall;
  - the toll rings;
  - reduced motion stills the title cards;
  - the edge line keeps its width in Retro picture modes;
  - vents and fragment hazards show in the place's white;
  - steadier frames, and no stutter stepping into a new circle;
  - a Spirebridge plank no longer stays solid after it fades.
