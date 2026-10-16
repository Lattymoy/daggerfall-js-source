# AUDIT LIVED1b - your own time online, the comprehensive second audit, 2026-09-29

Mac: *"Lets do a comprehensive audit on this"*. The subject is LIVED1 (`06-Systems/Lived-Time.md`) together with the
first audit's fixes (`Audit-Lived1.md`): commit `322b1735` on `ccr-db2623d6-6g44d6`. Eleven lanes read that FROZEN
tree (nothing was fixed while a lane read - Home.md, 17l; the fixes were built in a worktree of their own and landed
after the last lane), each reproducing what it reported by driving the real modules:

- **K** the clock core, adversarially (`worldTick.js`, the ticker);
- **R** a census of every reader and stamp of game time in `src/` and the services - 604 sites;
- **S** the save, the load, the lifecycle and the copy doors;
- **P** party, realm, the relay and exploits;
- **U** the words and the UI in both skins, and the patch notes;
- **T** the record, the pins and systematic new mutants over every changed line;
- **M** a trial merge with `origin/main` (57c7d8fcb, 49 commits: the Overworld, VAMP-HOOD, CUSTOMS-CARRY, SHIP-SAIL);
- **D** fidelity to DFU's C# for every mechanism LIVED1 re-clocked and every first-audit fix;
- **O** offline parity against the branch point `f4dc60ce`, byte for byte;
- **F** a seeded property fuzzer, performance and tampered saves;
- **A** the first audit's fixes A-V: correct, complete, and their siblings.

**What held.** Offline is still DFU's, byte for byte: O ran 22 scenarios on `f4dc60ce` and `322b1735` under one
recorded random stream (frames, an 8-hour rest, the 7-, 38- and 112-day crossings, a year, both journeys, both
collapses, jail with its 251 days, training through the real bridge, a mixed run, a werewolf's moon, a vampire's
fortnight and feeding, spawns at the day's edges, the UI strings, and saves both ways) - rolls equal in count, value
and consumer, state identical but for one label (U4 below); F's 40 sequences of 1,640 steps agreed too, and every
first-audit change was shown inert offline. F's fuzzer drove 217,280 steps (frames, raises to 1,000 days, corrections,
ten-year absences, deaths, saves, both doors) under ten invariants: only F1 and S1 broke them. The doors keep every
world stamp's distance over 20,000 random envelopes. R's census classified 604 sites (239 world, 310 the character's,
55 in offline-only hosts); its ten mismatches are fixed below. D matched DFU for twenty-five mechanisms (the rounds'
cap, diseases, poisons, both curses, the letters, rooms, loans, repairs, rank waits, training, the cures' holidays, the
court, the journey, the spawn cadence, every holiday reader). Nothing online blocks near a second (a year's rest is
52,560 sub-ticks at 0.03 ms). The merge composes: M resolved it (below) and the merged tree passed 142 files.
T wrote 237 new mutants over every line the two commits changed in `src/` and ran each against every test that
imports, reads or (by coverage) executes the mutated text - worldTick.js alone is reached by 891: 164 died, 20 are
equivalent (a re-walked world day re-applies the same flags and zones; spawn keys are strings; an unfloored end is
sub-minute or floored by every reader; a default no caller reads; a guard no caller reaches), and 53 survived - T1-T11
below. The old lists held (lived1 and auditlived1: 93 dead), and so did the record: the Testing.md rows, the re-aim
counts, every listed fix's comment and every SUPERSEDED stamp but one (T14).

## Fixed

Every finding was reproduced against the frozen tree before it was fixed, pinned in `test/systems/auditlived1b.test.js` (17
tests; lane T's in `test/systems/auditlived1b_t.test.js`, 15), and mutation-proven: `tools/mutants/auditlived1b.json`, 118
records, all dead - 65 for the fixes and lane T's 53 survivors, re-aimed onto the fixed tree (and the 33 older
records the fixes moved, re-aimed by content: all dead). Each fix carries an `AUDIT LIVED1b <ID>` comment; a finding more than one lane
found carries its first ID and the table lists them all.

| ID | Lanes | Sev | Finding | Fix |
|---|---|---|---|---|
| K1 | K1, K2 | high | THE FIRST AUDIT'S J MADE A DRAINING POISON COLLAPSE THE PLAYER AGAIN AND AGAIN. J (a raise from inside a tick is a bare move) left the collapse's hour to the next tick, and the collapse's own box holds the tick: the hour was walked only after the box went, the handler's latch long down, so every remaining round of the drain that emptied the pool was a collapse of its own - a Somnalius dose 6.8 of them against DFU's 3 (up to 11), a sixty-round fatigue drain 59 collapses and 59.5 hours of the character's clock in half an hour of play. And a checkpoint under the box wrote the hour without its walk (K2). | The ticker walks J's raise the moment the window in hand is done - a second tick in the same `tick()` call, never inside the first (`_raiseWaiting`) - and the world host's and the interior's handlers take DFU's popup guard online (`displayingExhaustedPopup`, PlayerEntity.cs:2385-2391; the dungeon's has had it since AUDIT 68): the hour's rounds fall under the box, as in DFU. A dose collapses 3 times online, as offline. |
| S1 | S1, F2, K2 | med | A SAVE TAKEN WHILE A RAISE WAITED FOR ITS WALK LOST THE WALK. Online the sentence, the fortnight, a cure's minute, TrainPc's hours and the dungeon rest's calendar move the character's clock barely; the next unpaused tick walks it, and a window stands between. The two-minute checkpoint and the page's hiding wrote the moved clock under that window; the load re-anchored every marker to it and the span was never walked (a sentence's 5,000-round spell survived it, its 112-day drift was lost; a dungeon rest's loan reminder). | The online checkpoint waits while a raise waits (`worldTick.ownWalkWaiting`, `onlineCheckpoint.checkpointAllowed`'s `walkWaiting`): the last checkpoint stands and the next is written once the walk has been. |
| P3 | P3, A4, K3 | med | THE FIRST AUDIT'S I MARK COUNTED AS WALKED MINUTES NO WALK HAD COVERED. The boot reads this machine's clock until the relay's welcome; one running fast walked the world's arms ahead and raised the mark, the welcome stepped the reading back, and the true world's next boundary fell under the mark and was walked by nobody - a 7-day faction power lost (1 boot in 12 at ten minutes fast), the six zones kept yesterday's sky for the world's day. A correction forward then back lost its gap the same way, and a correction back across a walked midnight (the arrival re-rolls the day before) held the true midnight's roll off. | The walks are kept as the SPANS they covered (`worldArmsPieces`: sorted, disjoint, joined where they touch, eight at most): a reading walks exactly the parts of its window no span holds - no world minute twice (I's law, T1 and T2 still pinned), none lived lost. The six zones - a function of the shared day alone - roll on every midnight the reading crosses (`rollWorldZonesAcross`). |
| P4 | P (the first audit's recorded S suspect) | high | THE BOOT PAID THE ABSENCE ON THIS MACHINE'S CLOCK - AN EXPLOIT. The load pays TM-1's recovery and SURV7's fresh start before the socket opens, so an OS clock set eleven months fast at each boot bought recovery for months that never passed: a legal reputation of -80, then -44, -8 and 0 in three boots, fed and rested each time. | The load hands its absence to `payAbsenceWhenHeard`; the world host's `onClock` hears the relay's clock (`hearSharedClock`) and it is paid then, over [left, the corrected now); until then an online save keeps the minute the character left at (`worldMinutesToSave`), so no save on the machine's clock moves the next absence either. |
| P2 | P2 | med | BRING ONLINE STAMPED THIS MACHINE'S CLOCK - AN EXPLOIT. AUDIT LIVED1 G's copy says it joined at the world's minute, read at the menu, which has no relay: an OS clock set a year back there bought a year of TM-1 at the first join (-80 came in at -41, two years -2; every negative faction cleared). | The copy says it joins fresh (`onlineCopyOf` `joinFresh`); its first load pays no absence, whatever the stamp. The flag rides that envelope alone. |
| P1 | P1 | med | THE FIRST AUDIT'S H SKIPPED THE FOLLOWER'S OWN WATCH. H moved the encounter loop's marker past a mirrored night, and the loop's minutes are not the wanderers' alone: its second arm is the watch (PlayerEntity.cs:498-511 - below -10 a 5% conspiracy and the guards each minute, banished 10%). A hated member slept in town untouched by mirroring a clean partner: 0 of 200 nights watched, against 200 alone. | The mirror walks each sub-tick through the loop with the wanderers' roll left out (`runEncounterTick(..., { spawns: false })`) - the rester's roll is the party's (PSCALE1 COUNT-1). |
| R1 | R1, A2, O3, S3 | med | COPY TO OFFLINE CARRIED THE WORLD'S RAID SCHEDULE. World Events - Raiding Parties' record is the shared day's roll (`lastSelectedDay`, every raid's day and minutes, on the world's clock), and offline the mod rolls only on a LATER day: a copy 150 days behind the world met no raid for 151 days. | The copy drops the record (`RAID_RECORD_VENDOR`); the load hands the mod its NewSaveData and the offline game rolls its own from its first frame. |
| R3 | R3, O2 | med | THE JOURNAL'S STEP DATES MISSED BOTH DOORS. `activeLogMessages[].time` is the world's second a step was logged (DFU's LogEntry, WorldTime.Now); the doors moved `questStartTime` and not it, so `%qdt` (250 of 265 shipped quests print it) dated each step on the other lane's calendar - 154 days after its quest began. | `shiftQuestSeconds` moves a step's `time` with its quest (never a bare `time`). |
| A3 | A3 | med | A BACKWARD STEP OF THE WORLD'S CLOCK RE-ROLLED THE RAIDS AND RESTOCKED THE GUILD SHELF (older than LIVED1, a sibling of I). RAID2's online "any other day rolls afresh" rolled yesterday's list on a step back across midnight and today's afresh a frame later: a cleansed town was attacked again, said so again, and paid its reputation twice (5, then 10). GUILD-SHELF's day swept today's bought-out shelf the same way (five potions, all bought, five again). | RAID2's rule is the save's record's alone - its first online check (`_dayFromSave`); past it a LATER day rolls. A guild shelf THIS session minted for a later day stands while the reading is behind it (`dayShelf`'s `shelfStands`). Offline nothing reads differently. |
| D1 | D1, A1, O6 | low | THE FIRST AUDIT'S D NEVER REACHED THE GAME. `createQuestBridge` builds the machine's deps key by key and had no `ownMinutes`: world.js's member was dropped, TrainPc still stamped the world's minute (84 days behind: refused 84 days; 3 days ahead: no cooldown). D's pin built a machine by hand and passed. | The bridge forwards `ownMinutes` (and the contract lists it; the offline exterior host wires it too); the pin goes through the real bridge to TrainPc. |
| D2 | D2, R2, O4, S3 | low | A CACHED BUILDING'S STOCK DAYS MISSED BOTH DOORS. A shelf's `stockedDate` is the world's day online (DFU's `year*1000 + dayOfYear`); after a copy, a shelf dated months ahead of the new calendar never restocked (`stockedDate < today`) until the pixel was left - 151 offline days, 501 world days the other way. | The doors move `stockedDate` and `openedOn` by whole days (0, "never stocked", and an owned house's 1 stay). |
| F1 | F1 | low | THE LOAD RE-ANCHORED ON THE FLOORED WORLD MINUTE, so the first frame billed up to a minute of the absence (0.96 minutes lived for 0.01 played). | The re-anchor takes the reading itself. |
| S5 | S5 | low | THE LOAD RECAST HELD ENCHANTMENTS BEFORE IT RESTORED THE CHARACTER'S CLOCK, so a Cast-When-Held item with no reroll stamp took the world's minute - 3,606 hours of no reroll. | The character's clock is restored first. |
| F3 | F3, S4 | low | A TAMPERED CLOCK FROZE OR RESET A LOAD: `classicMinutes` at 2^53 stood the calendar loop's `i++` still (the page froze), a `worldMinutes` of -1e308 walked the absence's normalise ~1e300 times, a string left the broker's marker NaN, a null loaded an online character at minute 0 (a disease read 311 days), 1e14 stood the clock still in play. | The envelope's clocks are read once (`saneSaveClock`: an unsigned count below 2^31, or none - the clock that stands is taken, and the world's stamp is absent); backstops: the normalise walks at most 200 times, the marker refuses a non-number, an online raise refuses Infinity. |
| R4 | R4 | low | A CHARACTER BORN ONLINE WAS STAMPED ON THE CLASSIC START (older than LIVED1): its skill check's six-hour gate was open at birth (DFU's AssignCharacter stamps Now). | Born online, the stamp is the character's own minute. |
| U1 | U1 | low | THE CLASSIC TRAVEL POPUP'S ONLINE LINE LOST ITS FIRST LETTERS: about 348 native px on a 320-px screen, "Onli" off the canvas at 16:10 and 5:4 (the first audit's suspect, reproduced). | Two rows, one sentence each (`ONLINE_TRAVEL_ROWS`). |
| U2 | U2 | low | THE SMITH'S ROW AND ITS DETAIL COUNTED ONE JOB TWO WAYS online: "Ready in 2 days" over "Ready in 1 day of your time" (the first audit's suspect, reproduced). | Online the row floors as the detail does (`repairRowText`); offline it is DFU's. |
| U3 | U3 | low | THE CLASSIC PARCHMENT READ "Loan due by: due now". | The short form says "now" after the painted label. |
| U4 | U4, O1 | low | THE FIRST AUDIT'S S RELABELLED THE OFFLINE CARD: the default skin's bank read "Loan due" offline where it always read "Loan due by" (the one offline word that changed). | "Loan due" online, "Loan due by" offline. |
| U5 | U5 | low | "(N hours of play)" ROUNDED to the nearest from two days of play, so it could say less than the most play (48 for 48h 29m). | Never rounded down. |
| U6 | U6 | low | `realTimeText` and `sharedRealTimeText` had no reader left (the first audit's suspect). | Removed; OL3's pin reads `sharedWallMs`. |
| U7 | U7 | low | THE DEFAULT SKIN'S REST CLOCK LINE BORROWED THE VITALS' DRESS: a flex row with wide word spacing wrapped "clock" onto a row of its own, flush against the readouts. | Its own class, `clock-line` (and gone offline, where it is empty). |
| U8 | U8 | low | THE WORDS SAID TIME AWAY IS FREE ("time away does not", "while you are away", the patch notes) - a hidden tab is charged (For Mac 5 of the first audit). | "logging off" / "logged off", measured to the parchment the old note fitted. |
| D3 | D3 | low | "THE CURE'S HOUR" is DFU's one minute (`RaiseTime(60)` is seconds). | Reworded. |
| R | R | low | Stale comments: `gameDate` was "the date the rank gate reads" (it is the world's; the gate is `ownDate`'s), a week's rest "expires what a week of walking would" in the spawned-dungeon ledger and "ages the torches" on the ground - both only offline. | Reworded. |
| T1 | T | high | THE TICK'S ONLINE ANSWER HAD NO PIN, and the dungeon writes it straight back into the character's clock (`dungeonContext.js` `classicMinutesRef.value = _tick.classicMinutes`): answering the world's minute reset the character's clock to the world's every dungeon frame; answering the entry clock, or nothing, erased a collapse's hour underground. | Pinned: an hour raised inside the tick survives the write-back. |
| T2 | T | high | NOTHING PINNED THE WORLD'S DAY BLOCK TO ITS HALF, OR THAT IT RAN. Walked with `DAY_ARMS.all`, every world midnight in play swept the character's rooms and called their loans on the world's minute (a character behind the world lost the room and defaulted); with `own`, or deleted, the zones stopped rolling online and the price flags stood. | Pinned: the world's midnight sweeps no room and calls no loan, rolls the day's zones, and lifts a price flag the world's fair day no longer bears (the zones alone roll again since K3, so they cannot say it). |
| T3 | T | high | THE WORLD ARMS' PINS READ WHOLE NUMBERS, the wire fractions (a fifth of a game minute a real second): an unfloored start or end walked from a fraction, and no power or conditions minute fired online. | Pinned: a power minute crossed at eight fractional readings walks the powers once, as whole readings do (both ends of the walked spans). |
| T4 | T | high | NINETEEN HOST READS LIVED1 RE-POINTED BEYOND THE FIRST AUDIT'S SIXTEEN HAD NO PIN: the journey's encounter marker (the only guard fast travel has - on the world's clock it rolled up to a day of encounters on arrival), the smith's list, jobs, collection, commit and enhanced booking (MAC-BUG3's again), the player's poison clock, the party rest's vampire gate, a guild join and its rank steps, the tavern room's clock, the dungeon's music day, and exterior.js's six (a drink, the rest gate, MorphSelf, the quest day, the spawn table's hour, a guard's poison clock). | Pinned by source, each a mutant that flips its clock. |
| T5 | T | high | LIVED1'S BY-SOURCE TEST NAMED THE CURES AND A QUEST'S RAISETIME AND ASSERTED NEITHER; the lycanthropy cure's stamp and minute were pinned by nothing. | lived1's body asserts both cures and the quest hook; lane T's pins hold them too. |
| T6 | T | med | THE CHARACTER'S WINDOW REACHING WORLD STATE HAD NO PIN: a rest across their own midnight walking their price table with `Math.random`, or across their own 38-day minute walking the wars, plagues and rulers (the first audit's T1 pinned the 7-day minute alone). | Pinned: neither moves a price, a flag, a power or a condition. |
| T7 | T | med | A SAVE FROM BEFORE LIVED1 COULD BE READ AS NEVER AWAY (`left = at` survived: every existing player's first online load would lose TM-1's recovery and SURV7's fresh start), and the legacy clamp's `startingDay`, `lastTimeFed` and `lastKilledInnocent` caps were unpinned. | Pinned, through the real save door and the relay's clock (P4). |
| T8 | T | med | THE ENHANCED FACES OF L, P AND Q AND THE ENHANCED TAVERN'S CALENDAR WERE PINNED ON THE CLASSIC SIDE ALONE: the bank's enhanced row, the ports' row, the sheet's "in now", the enhanced tavern's offer, meal holiday and kitchen, the HUD's needs. | Pinned: the bank window, the ports and the sheet by behaviour; the DOM-mounted tavern and HUD by source. |
| T9 | T | med | `playerWeaponKillReported`'s default clock - the one exteriorFoes uses - was unpinned: on the world's clock a werewolf's kill of an innocent missed their own. | Pinned by behaviour. |
| T10 | T | low | THE WORDS' ROUNDING AND BOUNDARIES WERE UNPINNED ("19.6 minutes" from a fractional clock; 1 day, 1 hour, 60 and 2,880 play minutes; the nightfall's ceiling). | Pinned. |
| T11 | T | low | THE FEEDING AND TRAINPC STAMPS WERE WHOLE MINUTES ONLY THROUGH AN UNPINNED FLOOR (DFU's are a uint). | Pinned. |
| T12 | T | low | Testing.md's lived1 row said "SURV7's two-day kindness"; the grace is one world day (`needs.js ALIGN_GRACE_MINUTES`). | Corrected. |
| T13 | T | low | The card fix's cites read "AUDIT LIVED1 T (R8/S5/U4)" (`enhancedMenu.js`, twice) and "AUDIT LIVED1 T" (Lived-Time.md): the first audit has no row T and no lane R8 - the card is E's. | Re-cited to E. |
| T14 | T | low | Field-Bugs' TM-1 line still said the dead span "pays both halves", unstamped, beside the stamped TM-3 and TM-4. | Stamped. |

The first audit's own record is corrected where this one found its fixes short (`Audit-Lived1.md`, each row marked).

## Recorded, not fixed

- **S2 (Mac's call): F's clamp does not undo the RESTX2 night.** It lowers a disease's day to the restored clock, and the
  restored clock then lives the save's rest night again - one extra roll per simulated midnight, once, for a save from
  before LIVED1 (an offline copy of one is not clamped at all). The honest alternative restores the character's clock at
  the latest marker ahead of it; that trusts markers from an old save's session counter, so it is Mac's.
- **O5 (Mac's call):** a save from before LIVED1 written mid-rest online carried MAC-LVL1's `restSimMinutes`; the base
  spent it at the next rest's end offline, LIVED1 retired it (its skill check lands 120 minutes later, once).
- **An owned foe takes its owner's raises (P, older than LIVED1, widened by it):** a partner's 30-round Paralyze on a foe
  the owner holds ends in the owner's collapse hour (and training, a hunt, a meal); the first audit recorded the rest
  window's case.
- **K3's load after a correction** walks nothing the correction left unwalked; in-session loads are refused online
  (ONLINE-LOAD1) and a new session is a page, so it cannot be reached.
- **The merge (M).** `origin/main` is 49 commits past the branch point and not merged by this audit. A naive merge
  breaks: the map door's sun rung (take LIVED1's `sayWithNightfall` AND main's hood hint: `sayWithNightfall(ftb.text);
  if (ftb.hint) townTalk.say(ftb.hint);`), the online arrival block (LIVED1's three lines AND main's
  `online.onOverworld`; main's side alone calls an undefined `shiftSurvival` on a correction), main's VAMP-HOOD pins and
  three `vamphood.json` records (re-aim by content: `vampireStatMod(skyMinutes)`, the door's regex, the party's), the
  `audit64_travel`/`econ1` pins (main's `{ text, hint }` and `world128`, LIVED1's regexes), and Testing.md's and
  Systems.md's counts. 196 of 206 conflicting hunks are cites: `tools/citeMerge.mjs origin/main HEAD --apply`, then
  `--apply --struck`, and two by hand. One hazard has no conflict: SHIP-SAIL's Overworld passage says no days online
  (`sharedClockOn() ? 0 : travelDays`) while the voyage bills the character's clock - say "The voyage takes N days of
  your time." (Mac: For Mac 6). VAMP-HOOD composes with LIVED1 (the refusal, the nightfall, the hood: three rows) and
  CUSTOMS-CARRY with G (the preview runs first on a raw copy; the rebase is kept). [MERGED after the audit, at Mac's
  word ("Merge"): `origin/main` 90fd9a0f5, 84 commits by then (PRs #418, #428-#433, #435-#438). 129 files conflicted,
  279 hunks: 267 cite-only (ours taken, then `citeMerge --apply` and `--apply --struck`, 539 cites moved, four
  re-aimed by hand); M's ten real hunks resolved as above, and two more Testing.md rows unioned (to1's count and U1's
  note; REALM2's customs row and S1's note). M's post-merge fixes applied - the VAMP-HOOD pins and records, the
  SHIP-SAIL passage's "N days of your time" (the wording stays For Mac 6) - and four survtiers cite records re-aimed.
  M8's records corrected: the patch note and Lived-Time say a hood opens the map by day, OPEN 2 is answered. Main's
  commits after M's trial add no time reader. The merged tree: 15,063 tests, 0 failures; lint, types and the build
  clean; 614 mutants (the three LIVED1 lists, VAMP-HOOD's, SHIP-SAIL's, and main's records within 15 lines of a line
  this branch brought): 608 dead, 4 equivalent as recorded, 2 survived. `AUDITDISC28-TM1-the-dead-span-is-taken-for-
  an-absence` survived on this branch since LIVED1 - its one named test's dead-span arm no longer reaches the drift -
  and dies to `audit23_hosts.test.js` C4 (the 112-day boundary through the tick), which it now names: its list is 10
  of 10 dead. `ARENA2-TRIAGE-4-release-costs-three-hours` survives on main alone as well - main's own, carried for
  its pass. Main moved on while that merge was checked, and #439 (FIELD BUGS 2026-09-29d, 16 commits) was merged
  after it: 40 files, 71 hunks - 69 cite-only (79 cites moved by `citeMerge`) and two real, Active-Arcs' rows and the
  Suite line. It adds no time reader. Its merged tree ran 15,096 tests with one failure, main's own: #439's TO-ROADS
  gave `travelViewWalkTo` a `roads` option, and `tv6_dungeons.test.js`'s OW4 D1/D6 pin finds the walk by its old
  signature (red on main as well). The pin now reads the signature as it stands: 20 of 20, here and on main's tree.
  211 mutants on it (the three LIVED1 lists and #439's records near this branch's lines): all dead. Then every older
  record whose tests this branch changed in code - 1,190: 1,180 dead, 9 equivalent as recorded, one survivor,
  `DISC10-E-V9-a-hole-is-read-as-a-curse` (dead on main): its only kill was WORLD5's arrival shift, which LIVED1
  retired. `auditlived1b_t.test.js` pins the accessor stepping over a hole, as main pins liveVampirism's, and the
  record names it: dead. Then #441 (SPAWN-SHORE, and main's own fix of the same `tv6_dungeons` pin, identical): 62
  files, 130 hunks - 129 cite-only (179 cites moved) and the Suite line; two survtiers3 cite records re-aimed. It adds
  no time reader.]
- **Process (T15, beside the first audit's T13):** `test/net/auditworld34.test.js`'s "A1 executed" waits a fixed 25 ms
  between its async steps and failed 2 of 3 unmutated runs under `--jobs` load; a list that names it reads those
  failures as deaths (39 false deaths in lane T's second stage, hiding two real survivors). No list here names it. A lane
  that picks its tests by coverage drops the timing-bound ones, or re-runs a death without them. The same held for
  `auditrealm2_client.test.js`'s "C2 in the host" (a 30-turn settle): it failed once while this audit's mutants ran
  beside the suite, and passes alone and on an idle run.
- **Lane T's suspects:** the dungeon writes the tick's answer back into the character's clock (`dungeonContext.js`), so
  a regression answering the world's minute would wipe the character's clock underground (T1's pin guards it now); the
  dungeon's save composer writes `classicMinutes` unfloored where world.js floors it (older than LIVED1, as at
  `f4dc60ce`; the online load floors it); the heaviest host reads (the smith, the journey's marker) are pinned by
  source, and a behavioural harness for the hosts would outlast the pins.
- **Suspects not reproduced, carried for their own passes:** a checkpoint between a journey's teleport and its advance
  (world.js), and a logout in the prison countdown (older; the sentence is not saved); a boot load before the faction
  store attaches pays TM-1 to legal reputation alone (older); the dungeon re-entry at the boot may re-run a few minutes;
  RESTX2-era item reroll stamps are not clamped; a V guard for a peer's `null` poison minute; a rumour limit rebased to
  exactly 0 would read "no limit"; the Hard tier's blackout wakes at the character's 06:00 while the kitchen keeps the
  world's hours; a born character's bare raise before its first tick (no reachable caller); the tavern's row B at the
  350-day ceiling is 281 of 288 native px on the estimated font (the real FONT0003 is not in the container);
  Cast-When-Held rerolls inside the round every six hours of any time where DFU drains its queue only on a long rest's
  end (older); diseases and poisons read each round's own minute where DFU applies a catch-up at the window's end
  (totals equal, order differs; older).

## For Mac

1. **The sky of a rest online.** Every rested hour takes the world's current sky (Rapid Healing's light or dark, the
   spawn table's day or night): a night's rest begun at the world's 17:00 heals and rolls as daylight for all eight
   hours. It follows from "the sky is the world's". Keep?
2. **A fire's warmth.** Campfires and dropped torches burn on the world's clock, so online a rest of any length beside a
   fire with minutes left stays warm the whole rest; offline the fire dies mid-rest. Keep, or burn a fire on the
   character's rest?
3. **The first audit's For Mac 5, wider.** A machine clock set forward or a laptop's resume bills the whole jump to
   the character, as a hidden tab does. Cap one frame's world window (say at SURV7's day of grace) and treat the rest
   as absence?
4. **A clock out of range** now loads at the clock that stands (the world's online, the host's offline). Refuse the
   load instead, and say so?
5. **The Overworld's walked journey** (the default enhanced journey on main) charges the character's clock 1x online and
   Nx offline - the first audit's For Mac 2, now for every walked trip. [ANSWERED with it: FIELD BUGS 2026-09-29h
   WALK-CLOCK charges it Nx online too, on the character's own clock.]
6. **At the merge:** VAMP-HOOD answers Lived-Time's OPEN 2 (reword it and the patch note); the door says DFU's line,
   the nightfall, then the hood (or the hood first?), and should the party's and the passage's refusals give the hint;
   the Overworld passage's "N days of your time".
7. **The classic parchment's future due** reads "Loan due by: in 359 days of your time" - words after "due by" for a
   time left, if you want other ones. And the smith now floors online, as its detail line does (DFU ceils offline).
