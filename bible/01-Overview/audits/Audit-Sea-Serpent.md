# AUDIT SERPENT - the sea serpent, Sethrakul, the Old Coil, 2026-10-04

Mac: *"I definitely want to do a conprehensive audit on this and ensure its absolute perfection"*, of PR #592's
SERPENT1 (`11-Multiplayer/Sea-Serpent.md`, `038007c0c`). Four lenses read it: the relay and the brain (A); the client
on its real host - the host, the naval host, Come Sail Away, the world (B); the play and the words, with the fight
simulated against the relay's own brain (C); and the books, the rewards and the pins' own honesty (D). Every finding
was re-run before it was fixed. Three were Mac's to decide, and Mac chose:

- **Balance: the validated rebalance** (T1-T3, below) - every blow lighter, the coil fought by the ships fighting it.
- **Earning: "Must be in the fight"** (E1/E2) - a tenth of one's own share dealt, or half the fight stood near it.
- **Schedule: every four hours**, as it stood (T10).

Each fix is pinned in one of four new files - `test/net/serpent/serpent1_audit.test.js` (12, the brain),
`test/net/serpent/serpent1_auditrelay.test.js` (6, the relay and the hub), `test/net/serpent/serpent1_auditclient.test.js` (7, the client,
the books on the device, the words and the wiring), `test/net/serpent1_auditbooks.test.js` (6, the books lens's own) - or
in the SERPENT1 pin it moved. Mutation-proven: `tools/mutants/serpent1_audit.json`, 155 records (117 of the fixes, 38
of the books lens's), and SERPENT1's own 43 run again over the fixed tree, five re-aimed where the audit moved their
code - 198, every one dead. One record of another list (`auditonline2.json` F3) re-aimed at the line it moved.

Severity: **High** loses the fight, a reward or the Bay's word for many; **Medium** a wrong outcome for some;
**Low** a nit, a cost or a word. A finding two lenses made is listed once, under the first, with the other's id.

## A - the relay and the brain

| ID | Sev | Finding | Fix |
|---|---|---|---|
| S1 | High | **A forged first `in` stood the cell's one fight wherever it said** - anywhere in the true site's 13 km cell more than 1.5 km off. Every honest ship was then refused "too far", and the forger's kill was told to the whole Bay: every client's ring read slain. (C's E5.) | **One fight a site** (`serpentSiteKey` - the native point to the whole unit), at most `SERPENT_SITES_MAX` (3) a day in a cell, each under its own key (`serpent:<day@site>`, the ids under `serpents`). An account fights at one site a day in a cell. A fourth site stands only in the place of a fight over and told, or one nobody has a part in and at most one ship keeps. A socket hears the fight its `in` named, else its account's, else the one fight about its pose (never two folded into one); a client folds a whole state of its own site alone. The hub keeps and says each site's kill (`serpentfells`), and a client hears its own site's (`fellAt(day, site)`, the chat line). Bound left: three sites each kept by two accounts or a part refuse a fourth that day in that cell. |
| S2 | High | **The body diverged between the relay and its clients.** A word said now while legs or modes still to come stood (a kill during a breach's wind-up, a dive during a surfacing, a stray surfacing asked every beat, a phase's turn nulling an attack in flight) left the relay's track and every client's fold different - measured up to tens of metres, the blows judged against a body the screens did not draw. | **The timeline's one rule** (`supersede`): a leg or mode said at a moment removes every one after it, on the relay as it pushes and in every client's fold; a mode it took away is said even when the ride it keeps is the same. A stray surfacing is asked once; a phase's turn waits for the attack in flight. Pinned by a divergence harness: ten seeds of 1,600 beats, the relay against the link's fold, worst gap under 1 cm. |
| S3 | High | **The coiled ship's word raced the beat.** She says `held`/`esc` at the landing on her own clock; the relay winds the coil on its first beat after it, so the word found no coil and was dropped - 86% at 30 ms latency, 65% at 80, 39% at 150. A dropped `esc` wound a coil round empty sea for 24 s and then said "The coil crushes a ship!". (C's B1.) | A word for the coil attack in flight, from its target, up to `COIL_WORD_EARLY_MS` (1 s) before its landing, is kept on the attack and heard as the coil winds. |
| S4 | Medium | **A coil kept gripping after the kill** (and after the dive) on the held ship's screen: the brain let go without a word. (B's M1.) | The kill and the dive let a holding coil go and say so (`cx`); the client's fold lets go on `fell` and `gone` too, its word heard or not. |
| S5 | High | **An earner away from the cell at the kill lost the receipt** - handed only to sockets in the cell, and again only at an `in` there while the cell kept the fight. (D's D1.) | The cell tells the hub every receipt, and which accounts it handed one to. The hub keeps each account's latest (`serpentrc:<account>` - never over a newer day's, a receipt not its account's or day's kept for nobody), hands it to the newest socket of each earner the cell did not, and to the account's every hello while good; its hello and the sweep forget an expired one. `online.js` takes `rcpt` from the hub. |
| S6 | Low | An attack's bearing was said unwrapped - a head on its ninth turn of an arc said a yaw the wire refused, and the attack never reached a client. | Wrapped (`serpentWrapYaw`) in `serpentAtkFrame`. |
| S7 | Medium | **A ship refused at the seal was disconnected for firing at what it could see.** It is sent the state, so the serpent is drawn and targetable; every `hit` word was junk, and after 100-200 volleys the socket was refused. (B's H1, C's B3.) | The relay does not hear a word from an account no fight counts - never junk; the client stops its volleys and its wreck after a refusal that holds for the day (`SERPENT_BARS`, the link's `onRefused` routed to the host). |
| S8 | Medium | **An `in` said from 1400 m off kept a ship's share in the fight** - "being at the fight" was any `in`. | Only an `in` from within `ENGAGE_R` refreshes a fighter's place (`joinSerpentFight`'s `near`). |
| S9 | Medium | **A woken cell numbered its attacks again from its checkpoint**, so a client that had lived through attack 41 took the new attack 41 for it and never judged it. | Read back from storage, a fight's attack numbers go on `SERPENT_WAKE_SEQ` (50) past the checkpoint's (`serpentWoke`). |
| S10 | Medium | **The coil could go at a hand** aboard another's ship when no ship of anyone's own stood near - a coil on nobody's hull. | The turn's coil picks ships alone (`pickSerpentTarget`'s `shipOnly`). |
| S11 | Low | A dead wire constant (`SERPENT_OTHER_KEY`), and the design page's mismatches (C's Doc 1-13, below). | Removed; the page corrected. |
| S12 | Low | **The hub said a stale kill**: a cell that told it late (its hub down) overwrote a newer day's kill and said an old one to everyone. | The hub keeps the latest day's kills and never an older day's; a kill whose day is over is not said - its receipts are kept all the same. |

## B - the client on its real host

| ID | Sev | Finding | Fix |
|---|---|---|---|
| H2 | Medium | **The hull claim was locked at the first `in`**: a captain who sighted it off her wheel, or as a hand, or from her rowboat, brought nothing and dealt nothing for the whole fight, unsaid. (C's B4.) | The `in` claims her own ship's hull at her helm or on her deck; a later, bigger claim takes the old share out and brings the new one in at the fraction it stands at, its bucket empty (the late ship's law); the level stays the first claim's. |
| H3 | High | **A second serpent day's fight was half unjudged**: the host's memory of attacks was by number, and every fight numbers from one, so its first attacks were taken for the last day's. | The memory is the day's: a new day forgets the last one's. (Left and come back the same day, it holds - an attack is never judged twice.) |
| M2 | Medium | **Its throes and its dive were never said** - the brain changed the body at the kill and the dive without a word, so every screen drew it swimming on. | Said (`dv`, `sw`) as every other turn of its body. |
| M3 | Medium | **The ram's wake was handed two numbers** for a point: every one a NaN splash, filling the sea fight's 900-particle budget. | A point in the scene, its height the sea's. |
| M4 | Medium | **With the sea fight switched off, a ship was untouchable and still earned** - no naval host, no blows on her, her `in` said all the same. | No `in` without the sea fight (`online.ready` asks `navalOn()`). |
| M5 | Medium | **A fight whose cell went quiet was drawn for ever** (a lost socket, a relay restarted). | A fight alive whose cell says nothing for `SERPENT_HEARD_MS` (12 s) is left, and the `in` asks for it again; a slain one is not left for its silence - its throes play out. |
| L1 | Low | The coil's hold kept her place in scene metres - a world re-centred under her carried her off. | Kept in the site's frame. |
| L2 | Low | The volley's tally counted every ball in its hide as a miss. | A hit. |
| L3 | Low | A gathered `hit` word the socket would not take was dropped. | Said with the next. |
| L4 | Low | Offline, the omen's ring and compass mark stood as they last were. | `reset()` - nothing stands until it is ready again; its lines stay said. |
| L5 | Low | **Its cost a frame**: the body's tube made some ten thousand small arrays a frame; `drift` asked the naval host for the boat before it knew a fight stood; `mine()` read the account each call; the first site's lane walk can take a frame. | The tube writes through a buffer kept frame to frame - the same mesh, byte for byte, in half the time (0.45 ms against 0.91); `drift` asks for a fight first; the account read once a frame. The first walk is recorded, below. |

## C - the play and the words

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B2 | Medium | **MOVE never warned of the ram**: the bar tested its lane where its head was as it wound - nowhere - so the one blow a helm can sail out of was never called. | The ram's lane is tested whole (`a.at + active`). |
| B5 | Medium | **The coil's ring was laid on her helm and tested at her middle**, up to half her length off - a carrack inside it "slipped". | Any of her inside it (bow, middle, stern). |
| B6 | Medium | **Bracing did nothing against it.** | Braced, her hull and canvas take `BRACE_TAKEN` (half) of a serpent's blow, as of any ball. |
| B7 | Low | "N ships in its waters" counted every account that ever joined, hands and wrecks too. | The ships afloat at the fight now (`f.ships`). |
| B8 | Low | A ship come after the kill was told "The serpent is gone into the deep." | *"The serpent is already slain."* (`it is already slain`). |
| B9 | Low | The rising said "rises in 0:00" for its twelve seconds. | The rising counts to the storm. |
| B10 | Low | The hoard said it was in her hold; it goes into the pack. | *"Sethrakul's hoard is yours - it is in your pack."* |
| B11 | Low | The serpent's name was written into the coil's line and the books' words. | From the table (`serpentBossById`). |
| B12 | Low | `serpents.js` cited migration 0069 for its key. | 0078 (0081 since AUDIT SERPENT 2's merge renumbered it). |
| T1 | High | **Every blow too heavy**: a ship it focused was wrecked in 36-80 s; a full coil crushed 108-212% of any hull; the eye ground a carrack to a wreck in 31 s; no fleet of eight won at the gunnery measured (38% of balls striking). | Mac chose the validated rebalance: lash 6% + 6, ram 14% + 12 (the heaviest - the one a helm can sail out of), breach 7% + 8, spit 1.5% + 2 (its pool 2% + 1), roar 5% + 5; the crush 25% + 15, the grip 0.8% + 1, the eye 1.2% + 1. Simulated against the relay's own brain at `SERPENT_TTK_S` 180: at 38%, five or eight ships win every time in about 13.5 minutes and three ships half the time; at 60%, every fleet of three or more wins in six to seven minutes; one ship alone never does. |
| T2 | Medium | **A wreck's share stayed in its health**, and it went on going at her. | Her machine says her wreck (`wr`); her share leaves while she is one, and it goes at her no more. |
| T3 | Medium | **The coil was too hard and its fire wasted**: six seconds of EVERY fighter's broadside held 35-40% of phases II and III, and no coil broke at the gunnery measured. | `COIL_TEAM_S` 4 seconds of the ships fighting it (afloat, with threat on it); a blow on it takes `SERPENT_COIL_PASS` (half) of itself off the serpent too. |
| T4 | Medium | **Its head was hard to strike, and its body unled**: the head was the jaw's segment alone, reared at 24 m over every broadside's arc, and the guns laid on a body swimming 11 m/s with no lead. | The head is its first two segments; reared at 14 m; each segment carries its way and the guns lead it as a ship. |
| T5 | Medium | A forged hull claim's bucket refilled at three times its reference - a 12-20 times ceiling over honest fire (0.25-0.4 of it). | 1.5 times. |
| T6 | Low | The Large Boat's reference broadside (5) assumed a crew she does not have. | 3.6. |
| T7 | Low | The venom bit for 5% of a player's health a second. | 2% + 1. |
| T8 | Medium | **The maelstrom trapped what it caught**: at a pull of 1.2-5 m/s a rowboat or a Large Boat in it never sailed out; and it formed unseen. | 1-3.8 m/s; its waters laid on the sea through its five-second wind-up. |
| T9 | - | Time to kill. | Kept at 180 s, with T1-T3. |
| T10 | - | The schedule (six a day) spreads players thin. | Mac kept every four hours: with T1-T3 a fleet of three can win. |
| E1 | High | **AFK `stood`**: a boat parked 800-900 m off - where nothing of it reaches - stood the fight and earned full Renown, a Magic-or-better piece and 60% of the gold; it decoyed 40% of the serpent's picks. | Standing counts within `SERPENT_STAND_R` (450 m) of its body; it goes only at what it can reach (`SERPENT_TARGET_R`, 600 m); a receipt earned by standing pays half the Renown (`SERPENT_STOOD_RENOWN`). |
| E2 | Medium | **One volley earned a dealer's hoard**: 2% of a carrack's share was 43 points. | `SERPENT_RECEIPT_SHARE` 10%; a ship's share leaves after 90 s with no fire (`SERPENT_IDLE_RETIRE_MS`), back with her next blow. |
| E3 | Medium | A hull claim never backed by fire made it tougher for everyone. | E2's idle retire. |
| E4 | Medium | **The level claim was free** - the hoard rolled at whatever level the client said. | Never above the token's own character level (`cl`, now on every cell's attachment). |
| E5 | Medium | A forged site. | S1. |
| E6 | Low | Guest accounts each take a hoard. | The raid's law, kept; E1/E2 bound what one earns. |
| Words | Low | "sounds in" read as a noise; "in 15:00" read as an hour; "Stunned 9" had no unit; "The sea gives up its hoard" was said to the whole Bay; "no ship can reach the fight" - she could. | *"dives in"*; *"14m 48s"* and *"9s"*; *"Its hoard goes to the ships that fought it."*; *"no ship can join the fight now"*. |
| Phase | Low | A ship sailing in mid-fight was told the phase it found as if it had just turned. | Only a phase turned while she fights is said. |

**Doc 1-13** (the design page): the place named with its province twice; the ring's radius called its width; the head
"thrown up" without its coil; legs and modes "never pruned by count"; the table's spit and roar; "a rowboat and a carrack
feel each blow alike"; "the ship it hates most" (60% of the time); the Large Boat's 5; "keeps its head within
`ARENA_R`" (its aim; the head swims to about 550 m); "the ships in its waters"; "it buys no faster kill"; the coil
"closes onto her" (S3); the migration's cite. Each corrected in `11-Multiplayer/Sea-Serpent.md`, with the audit's law.

## D - the books, the rewards and the pins

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D2 | Medium | **The hoard's level was not bounded** by the level the fight admitted. | `spoilsLevel` - never past the receipt's `l`, nor the standing character's own. |
| D3 | Medium | **A guest's hoard could be given again**: its receipts are kept and offered again and again (a guest is answered "keep"), up to 48 - past the 32 spent receipts the spoils pool remembers. | `SERPENT_CLAIMS_MAX` 24. |
| D4 | Low | The serpents slain were in the service's answers and never in the game. | The account card's *Serpents slain* row and the inspect card's line. |
| D5 | Medium | **A slot loaded never let the hoard's crash records go** - the gate's and the raid's pools were told, the serpent's not. | `serpentSpoils.loaded` in `onSlotLoaded`. |
| D6 | Medium | **A receipt was settled before its hoard was given**: a grant that failed (the lock, the pack) lost the hoard for good. | The grant is awaited; a receipt is settled only once it resolved, so the next offer gives it (the pool's spent mark keeps it once). |
| D7/D8 | Medium | **The pins' own gaps**: 37 of 38 further mutants of the books, the rewards and the relay paths lived. | `test/net/serpent1_auditbooks.test.js` - all 38 dead (re-aimed where the audit moved the code). |
| D9 | Low | Stale comments in the books' files. | Corrected (B12 among them). |

## Recorded, not fixed

- **The first site's lane walk** may run up to 24 bounded lane searches in one frame at the sighting (the walks are
  kept for the session after). Not measured here - no map data in Node; a one-frame hitch at most, once a session.
- **A video that holds the frame leaves the boss bar as it was** - the court's own gap, shared through the gate's bar
  and pinned in three places; left for the gate's next audit.
- **Sounds above full volume have no limiter on the bus** - the game's, not the serpent's.
- **A squat of all three sites** (S1's bound; AUDIT SERPENT 2 F6, below, says what it now costs).

# AUDIT SERPENT 2 - the second pass, 2026-10-04

The owner, of PR #592 after AUDIT SERPENT: *"Just want to audit it and make sure it's perfect"*, then *"fix everything
and merge"*. A whole-PR review at its head (`999fc4a1`) found sixteen things; the first two were reproduced against the
real Room and the brain before any fix. Main had moved on under it (#600-#604: PARTY-LEAD's `world164`, KNIGHT-HOUSE's
`acct77` and migration 0079, HOME-VENDOR's 0080), so the branch was merged first and SERPENT1 renumbered past them -
relay `world165`, account `acct78`, migration `0081_serpent_kills.sql` - and the fixes were made on the merged tree.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F1 | High | **A forged site in the NEXT cell made an honest player's serpent read as slain.** Her halo's socket in that cell had no `in` there, so the relay fanned her the forged fight by her pose; the cell's own kill word named no site and was filed under her site's key - the omen went to slain, the chat said it, her client stopped drawing and fighting the real one, and the forged fight's swim, blows and health were folded into hers in her site's frame. S1's guards held a whole state and the hub's kill alone. | **Every word a fight says names its site** (`server/src/index.js` `_serpentFan` stamps `sx`/`sz`; `net/wire.js` `validSerpentOut` projects them on every fight kind), and **the link folds its own site's alone** (`net/serpent/serpentLink.js` - a word of no site, another site, or none this machine knows is nothing to its fight; a kill of any site is still kept by its own key). The relay's "no other fight about the pose" rule - which could not see another cell - is gone: a socket about two fights hears both, each naming its own. |
| F2 | High | **The client kept a mode the relay had dropped.** A woken fight with its head strayed said "deep now" and "surface at +2.7 s"; a breach begun the same beat said "deep now" again - the relay dropped the surfacing and kept a SECOND identical entry; every client took the word for one it had (the check ran before the rule) and kept the surfacing: up to 5 s of a serpent drawn and aimed at above the sea while the relay held it under and refused the hits. Reproduced in 178 of 400 seeds. | **One timeline rule for both sides** (`net/serpent/serpentBody.js` `onTimeline`): supersede what is still to come, then keep the entry unless the track already ends on it. The relay's `pushLeg`/`pushMode` and the link's fold call it alike, so neither keeps a word twice and both drop what the other drops. |
| F3 | Medium | **One refusal muted a ship all day.** `SERPENT_BARS` held 'the serpent is gone', which the relay also says to an `in` that comes a moment before the rising (a clock offset run ahead): the client barred itself for the day, and its next `in` - which joined - fired and wrecked unheard. | **The bar is gone.** The relay hears the words of an account its fight counts alone (`_serpentFrame`), so a refused ship is never heard and one let in since is; the world no longer hands refusals to the host. (S7's own law - a refused ship is never junked for firing - stands on the relay.) |
| F4 | Medium | **A blow that had already landed was judged on my ship where she is now.** A ship sailing in on a state whose breach had landed 2.5 s before (its recovery still in the state), or a tab whose frame stalled past a landing, took a blow she never saw. | `LAND_JUDGE_MS` (500): a landing is judged on its own moment or not at all; one seen later plays for its venom alone (a spit's pool still lies on the water). The coil's word keeps its own late law. |
| F5 | Medium | **S8 held only a known fighter to `ENGAGE_R`.** A newcomer's first `in` from 1,400 m brought her whole share into its health with a seen time of now, and kept it for 45 s - a string of guests anchored off made it tougher for the ships fighting it. | A newcomer from past `ENGAGE_R` joins with her share out of its health and unseen; the first beat that finds her at the fight brings it in (`serpentShareWanted`). |
| F6 | Medium | **The cell let an honest fight go for a forged one, and a slain one too soon.** A fight with no part yet and at most one body about it was "idle" - a lone honest ship's first half-minute, given way to a third forged site, then born again by her next `in` at full health, over and over; and a slain, told fight was "over" before the storm sealed its waters - any `in` that missed the hub's word bore it again at full health. | A slain serpent is never let go while its waters stand open (after the seal no fight is born at all); a fight is idle only with nobody about its waters. |
| F7 | Low | **The ram was chosen at ships its lane could not reach**: `range` 240 m against a reach of 171 m (the wind-up's 21.6 m crawl and the 149.6 m run) - 9.8 s spent on a blow that could not land. | `range` 170, within `ramReach()`. A balance shift - between 170 and 240 m it now breaches or spits instead - not re-simulated here. |
| F8 | Low | **Every kept fight was written to storage every 2 s** while any fight in the cell beat - a slain fight's ~100 KB again and again for two hours. | A fight is checkpointed as it is stepped, its sounding at once; a slain or sounded one is still, its kill and its hub's answer saved as they come. |
| F9 | Low | **The shots' targets were made at every ask** - the shots' field, the look and the aim each asked, at its own millisecond, and each rebuilt the body twice (25 spine walks) and 24 boxes. | Made once a frame, at the frame's moment (`live.t`); a ball's zone read off the same body. |
| F10 | Low | `_serpentBodies` and the hub's receipt hand-off were the third and fourth copies of AUDIT SOC B9's newest-socket loop. | Both read the roll call's `_siegeSockets()`. |
| F11 | Low | Re-made helpers: `serpentStrike.js`'s `wrap` (the brain's `serpentWrapYaw`), `SERPENT_PIXEL_M` (gateLaw's `PIXEL_M` - its comment cited a gateLaw export that never existed), `SITE_PIXEL` (wire's `PIXEL_UNITS`), `6 * 819.2`. | Imported. |
| F12 | Low | Dead code: the brain's `bodyOf`, `SEGMENTS`, `SEGMENT_LEN`, `coilOn`, `headOf` and its `legAt` re-export; the host's `lastIn.answered`. | Removed. |
| F13 | Low | Two relay pins patched `Date.now` before their `try`: a setup that threw left every later pin on the fake clock. | Patched inside it. |
| F14 | High | **The branch could not merge or run CI**: 119 files conflicted with main, and its relay, account and migration numbers had been taken by main. `SERPENT_RELAY_MIN` 164 would have sent `serpent` frames to PARTY-LEAD's relay, which closes the socket on them. | Merged (cites by `tools/citeMerge.mjs`, 175 moved); renumbered `world165`, `acct78`, `0081`; every live-version pin moved and composed. |

Pinned in `test/net/serpent/serpent1_audit2.test.js` (9) - each run against the pre-fix tree first, and each failed there at its own
assertion - and in the earlier suites the laws moved (S1's hearing and eviction pins in
`serpent1_auditrelay.test.js`, the link and host rigs fed the relay's stamped words). Mutation-proven:
`tools/mutants/serpent1_audit2.json` (14); `serpent1_audit.json` re-aimed by content where the code moved (eleven
records) and five retired whose law this pass reversed or deleted (S7's three bar records and the world's refusal
wiring - F3; S1's "over" eviction - F6), with S1's fold-site record retired with the redundant check it named (F1's
one rule took it).

**Recorded, not fixed (this pass).** A squat of all three sites: three accounts that each stand at a forged site in
the cell before the rising, and stay, refuse the true one ('the waters are full') - F6 chose that over letting a lone
honest fight be torn down and reborn. The relay holds no map, so it cannot tell the true site from a forged one.

See also: `11-Multiplayer/Sea-Serpent.md` (the design and the law), `11-Multiplayer/World-Bosses.md` (the gate it
follows at sea).
