# AUDIT TIMEFREE - online quests that are not time, and the wear, read before they merge (2026-10-02)

> **REVERTED (quest half) by QCLOCK-WORLD, 2026-10-02** (Mac: "go back to the quest timer tied to the online world
> clock"; `06-Systems/Online-Time-Arc.md` 6.3c). The quest reading below - deadlines, delays, the short wait - is
> no longer the code; its pins and campaigns are DELETED. WEAR-ONE stands.
>
> **ITS DELAY HALF RESTORED by REST8, 2026-10-03** (`06-Systems/Rest-Arc.md` section 8, Mac's OPEN 12, option A;
> `06-Systems/Online-Time-Arc.md` 6.3d). The reading below is the code again, every classification as this audit left
> it (T1-T6; 262 deadlines, 137 delays; the main quest's 30 deadlines) but two: REST8 R1 found T3's `alone` reading
> stopped short of the reward, and K0C00Y02's gold ("you only have =2mondung_ days") and S0000502's Direnni tower ("will
> wait inside for =towertime_ days") - read as delays here, each ended its quest unpaid two minutes in - are deadlines
> (264 and 135; the main quest's 31 - 266 and 133 since AUDIT REST-PARTY D1/D2, `06-Systems/Rest-Arc.md`). Online a delay lands on the short wait, and a
> deadline is no longer frozen - it runs on QCLOCK-WORLD's played time and fires as DFU's. So T7 (the frozen guard) is
> retired with the freeze, and the run-time half (T1, T5) now decides whether a task-started deadline closes on the
> short wait or keeps its played days. The seams below that read "no clock online" are a delay's now: a deadline keeps
> its "Time remains" and the herald. The bounties' never-lapse and the any-hour letter stay reverted. Pins:
> `test/rest8_audit_timefree.test.js` (this audit's, re-aimed) and `test/rest8_questwaits.test.js` (TIMEFREE's);
> campaigns `tools/mutants/rest8_audit_timefree.json` (14) and `tools/mutants/rest8.json` (22), all dead.

Mac: *"Audit this and ensure its perfect"*, of TIMEFREE (`06-Systems/Online-Time-Arc.md` 6.3b - a quest clock online
is a deadline that never runs out or a delay that lands on the short wait) and WEAR-ONE (`05-Combat/Physical-Combat-Overhaul.md`
- the port's wear back to DFU's amount). Two lenses:

- **R** the reading - every one of the 399 vendored clocks classified, every flip read against its script by hand, the
  main quest's whole (S0000*, `_BRISIEN`); what each clock's end does, what starts it, who reads it and how;
- **S** the seams - every reader of a clock's time (the journal walk, the lens, the herald, the rail, the tracker, the
  marks), every machine the hosts build, the party resync, the save, the curse arms' walk, the crime guilds' clock,
  the bounties' board and party share, the letter's town hold, the words in the quest texts, the wear's callers.

Every finding was checked against the script and the code before it was fixed. Pins: `test/audit_timefree.test.js` [DELETED by QCLOCK-WORLD; restored as `test/rest8_audit_timefree.test.js` by REST8]
(and `test/timefree.test.js`'s split); each fix carries an `AUDIT TIMEFREE <ID>` comment. Campaign [DELETED by QCLOCK-WORLD]
`tools/mutants/audit_timefree.json`: 14, all dead; `tools/mutants/timefree.json` re-aimed, 10, all dead. [DELETED by QCLOCK-WORLD; restored by REST8 as `tools/mutants/rest8_audit_timefree.json` and `tools/mutants/rest8.json`]

## Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | high | **CLOSINGS NEVER CLOSED.** A clock whose end only ends the quest read as a deadline and froze online - but many are the script closing a quest a while after its outcome: M0B40Y05/M0B50Y09/N0C00Y11's `_end_` (`00:00`, started by `give pc _gold_`), Brisienna's `_oneday_` (started by meeting her, whose `start task` starts the main quest, and by her fortnight running out), the main quest's S0000007 and S0000988 `_delay_`, A0C01Y06, 40C00Y00, R0C10Y01. Each of those quests would have stood open in the journal for ever, its questor held. | A clock a task (not the start-up block) starts after SETTLING the quest (and, since BODYGUARD-CLOSE - FIELD BUGS 2026-10-03, `01-Overview/Field-Bugs-2026-10-03.md` - a START-UP clock whose end is a quiet close, in a quest whose start-up block settles nothing: A0C01Y01 pays and never closes, its one `end quest` the start-up `_timer_`, and it stood paid and open for ever online; at run time it closes on the short wait once the quest is a success) - by what the starter does: a `give pc` that marks the success, `train pc`, `start quest` - or that a lost deadline starts, is a closing: a delay. At run time, once the quest is a success, a task-started deadline closes on the short wait too (S0000009's two days after the contact, whose reward a `when` on the same click pays). One closing after a failure the reading cannot see is a delay by hand (`ONLINE_CLOSINGS`: R0C11Y03). |
| T2 | high | **LETTERS AND ARRIVALS FROZE ON A CONDITIONAL.** "Costs a standing" and "shuts a reward" read the whole chain of later `when`s: K0C00Y05's letter (a few hours) read as a deadline because `when _S.09_ and _S.04_` - the player's own misstep - costs the knight; M0B11Y18's traitor (3-14 days) because a "not yet" line led, many `when`s on, to a reward. Neither would ever have come. | A standing counts by what the end itself does (its task and what it starts); a reward by what the `not _clock_` reader itself settles. |
| T3 | high | **THE MAIN QUEST'S ENDINGS NEVER PLAYED.** S0000016's one-minute `_delay_` gates the endings (`when _S.01_ and _S.02_ and _delay_` - play video, `end quest`); its `end quest` read as a loss. S0000011's Chapter 6 (laid out six days on) and S0000106's start-up favour (`Clock _delay_ 00:00`) froze the same way. | `end quest` is a loss only when the end ALONE sets it off - the engine's own reading of the `when` (WhenTask._checkEvals) with what the end has set true and every other task not set: `when _firsttimer_ and not _S.03_` is a loss, `when _S.01_ and _S.02_ and _delay_` a beat after the story. A clock declared at an explicit zero with no travel arm is "at once", never a deadline. |
| T4 | med | **LETTER43.** S0000002's Eadwyre path hands the player letter43 and its item three to seven days on (`get item`), then closes - the main quest's next page; with no `give pc` it read as a deadline. | `get item` is progress. A reward a "not run out" reader settles outranks it (O0B00Y11 pays the heist only `when ... not _S.01_`; its end, which hands the haul back as the posse comes, is still the loss of that pay). |
| T5 | med | **A LIMIT TAKEN AFTER THE REWARD.** T1's run-time half closed any task-started deadline once the quest was a success - and M0B11Y18 pays for the raid, then offers the traitor's hunt ("I will wait =gettraitor_ days"): the hunt would have ended two minutes after it was taken. | A clock started once the quest was already a success is a new limit and stays frozen (`startedAfterSuccess`, set at StartTimer, saved; a save before it reads false). |
| T7 | med | **A FROZEN DEADLINE ARMED AT NOTHING STILL FIRED.** The freeze charged nothing, but the end's `<= 0` check stood: a travel clock whose places cannot be found answers 0 seconds (DFU's own sum, `travelTimeSeconds`), and online it ended the quest on its first tick. | A frozen deadline never fires (`frozen` guards the end). |
| T6 | low | **"YOU ARE LATE", TWO MINUTES IN.** Brisienna's month (`_remindpc_`) does nothing but send a reminder and start her fortnight - the first half of her deadline - and read as a delay: the reminder came two minutes after the invitation. | A deadline by hand (`ONLINE_DEADLINES`). Not a rule: S0000011's `_S.11_` has the same shape (a letter, a long clock) and its letter40 is the main quest's next page - the rule, tried, froze it. |

The split moved from 279 deadlines / 120 delays to 262 / 137; nineteen clocks changed, each read. The main quest's 30
remaining deadlines - each a lost limit, a trip, a lifetime or a long-stop - are listed in the pin.

## Checked and fine (S)

- **Every machine is told.** Both hosts' bridges (`world.js`, `exterior.js`) pass `sharedClock`; the machine's hooks
  carry it to every quest; the dungeon rides the world's bridge.
- **The readers.** `liveRemainingSeconds` and `remainingTimeInSeconds` are read only by the bridge's walk, which reads
  no clock online - the journal, the lens's urgent herald, the rail, the tracker and the marks all see `null`.
- **The party resync** keeps each holder's own remainder and sample; a deadline frozen on one copy is frozen on all.
- **The curse arms** start their quest synchronously (`machine.quests.set`), so a long rest's walk of many 24-minute
  marks sees the first and starts no second. The crime guilds' stamp and the tick read the same clock (the
  character's minutes online).
- **The bounties**: the board, the party share (`bountyClearPays` reads `takenAt` only for ordering) and the pack
  spawner keep no other day; a bounty held online and played offline lapses on the offline clock, as it did.
- **The words**: every `=clock_` in the vendored texts reads whole with "a few" - "within a few days", "you only have a
  few days", "before the day has dawned a few times".
- **The letter's hold**: only the notify and silently forms wait; online they wait for town alone.
- **The wear**: `DFU_WEAR_MULTIPLE` has two callers (DFU's member, a duel's blade); the mods' modules keep their own
  amounts; the pins that ran DFU's amount through the seam at 1 are unchanged. WEAR-TWICE's two records that
  multiplied by it are retired (at 1 they are the source itself).

## AUDIT TIMEFREE II - the real machine, and what ships (2026-10-02, Mac: "One more audit")

The first pass read the scripts; this one RAN them - the quest machine ticked online and offline over the scripts'
own clocks, tasks and `when`s (headless, each script read without its map placements, which want a loaded world) -
and read what ships beside main.

- **Brisienna online**: the invitation lands inside half an hour of play; her month and her fortnight stand through
  sixty days (no "you are late", no "stop the main quest"); meeting her closes her quest within the short wait.
- **K'avar's letter** (31-93 days) lands on the short wait online, and offline the same half hour lands nothing.
- **Online, then offline**: a deadline frozen through fifty game hours online resumes offline where it stood, charged
  only the offline hour.
- **Main merged in** (#533, #534 - the Seats audit, Ships of the Bay): no semantic overlap - main's only edit to a
  touched file is a cite in `equip.js`; cites mapped by citeMerge, CD4 re-aimed, the Suite line recounted.
- **The words**: the wear note said wear was doubled "earlier today" - WEAR-TWICE shipped in app-v0.1.5646, so it
  says "the last update"; the curse quests' "within a few minutes" was a promise the cure's roll (22-30% a mark)
  does not keep - "after a few minutes of play (a cure can take ten or so)".
- **Checked again and fine**: the bounty's time left has one reader (the board window, which drops the line when it is
  null); main's new tests pass beside TIMEFREE (the full suite, below).

Pins: `test/audit_timefree.test.js` (the three ticked runs). [DELETED by QCLOCK-WORLD; re-aimed in `test/rest8_audit_timefree.test.js` by REST8]

## Left, said so

- `daily from` windows stay on the sky (6.3b says why); the guild's guard keeps GUARD-ONLINE's arrival window.
- A delay cut online stays cut if the character later plays offline - the remainder is the save's.
