# AUDIT FB1018D (2026-10-18) - the 2026-10-18d field bugs, read cold

Mac, of pull request #1022 (`01-Overview/bugs/Field-Bugs-2026-10-18d.md` at 5362581de): **"Audit this"**. This page is
the audit: the eight threads' fixes on the branch (CRAFT-HOWTO, HITCH-KEEP, HOME-BENCH, TWIN-REKINDLE, DUEL-RING,
BANNER-SHAFT, WARD-BAR, SAYS-PAST-TWELVE, WINCH-PLATES, KEY-LOGBOOK, LEAP-SLOW, SEAT-LIVE), their pins, their mutants
and their records. Each finding has its verdict here. What it changed is written into the pages it touched, marked
`AUDIT FB1018D` with the finding's id, and in the code beside the fix.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN head (5362581de, detached worktrees - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING; each lane's worktree came up at main and was detached to the head before it read a line),
told to reproduce a finding before reporting it, to run its own one-site mutants with `tools/mutate.mjs`, and to end on
what it checked and found sound:

| Lane | Over | How |
|---|---|---|
| L1 | CRAFT-HOWTO, HOME-BENCH, KEY-LOGBOOK (reports 1, 3, 5) | 11 findings; the 53 recorded mutants, the real account service on node:sqlite and the client registry, the real Spire client and director at a rest, the Classic skin's pause door, a knight's house through the service, every whole language's tutorial wrapped |
| L2 | HITCH-KEEP, LEAP-SLOW (reports 2, 6) | 6 findings; the real counter over the real frame clock, the real runner, motor and collider on a 3 m platform, Chromium for the counter's box |
| L3 | the six Elite Breach slices (report 4) on the merged tree | 5 findings and 3 surviving mutants; the real director, fold and draw plan over the Armsmaster's, Garoth's, Ilthys's and the Winch's halls |
| L4 | SEAT-LIVE and the relay version (report 7) | 4 findings; the real Room and the real OnlineSession fed its frames, the session's own `_askSeat` ticks driven through five close timings |
| L5 | the pins, the mutants and the records across all twelve | 10 findings; every record re-run, 71 relay and seat test files around the change, each claim and cite in the record |

Every finding was verified against the code before anything was fixed. L2-1 by a 60 ms frame with 3 ms of script whose
line read "script 45" off a heavier neighbour; L4-2 by the real session staying `host` a gone socket in 3 of 5 timings;
L4-1 by a session at a `world219` welcome sending 28 unmoved poses a minute; L3-1 by a solo kill mid-duel; L1-6 by
`openPauseFlow` on the Classic skin answering DFU's pause window; the pin gaps by their surviving mutants.

## What it found, and what was done

| Id | Finding | Verdict |
|---|---|---|
| L1-1 | At a Spire rest N, NoteBook's default key, votes: the Spire reads `KeyN` raw, before the world's NoteBook arm - a no on Ready, or with only a decree open the decree's first option. Item 5's key clash named Y and the digits alone | RECORDED: added to item 5's clash, the owner's call - option (a), the Spire taking no key the world has bound, covers it. Whether the Notes window opens as well is unproven (worldModes' listener reads no `defaultPrevented`) |
| L1-2 | KEY-LOGBOOK's "(Classic)" half was held as a literal; a door opening classic N on Active Quests survived the pin and eight suites | FIXED: each host's arm mode goes through its building host's own call (`mode,` read) and the real door on the classic skin, and the window's mode is read - L on the logbook's quests, N on its Notebook page |
| L1-3 | "A visitor the door admits is refused" was pinned for a home open to anyone alone; a guildmate's and a tenant's station survived | FIXED: a guildmate (entry 'guild') and a tenant through the real service, refused at every accessor and the press |
| L1-4 | A knight's house still refuses the account's other character: its row reads `mine`, but its pieces are the buying character's save's and the service lists none | RECORDED: HOME-BENCH's Left; closing it needs a deed house's pieces on the service |
| L1-5 | The XP sentences were not held by the pin: four text mutants lived | FIXED: each XP clause matched whole, and a dish's track asked of the law |
| L1-6 | "Menu > Holdings > Stores" does not exist on the Classic skin - its Escape is DFU's pause, no tabs; the Professions key is the one door to the Stores there | FIXED: both pages name the key ("press {Professions} and open Holdings > Stores"); the Crafting body redrafted in the thirteen whole languages; `10-UI/Tutorials.md` |
| L1-7 | The Professions key's Controls row kept the claim CRAFT-HOWTO took out of the tutorial: "Open your Professions and Stores" - it lands on the Professions page | FIXED: "Open your Professions page (online)", in the registry and `10-UI/Controls.md`, pinned |
| L1-8 | The new journal labels read awkwardly inside the held-key prompt, and may overflow the classic replace box | RECORDED: KEY-LOGBOOK's Left; the overflow is unproven (FONT0003's widths; QuickSpell's row already overflows) |
| L1-9 | Linen is a furnisher's counter's too (FURNISHER_STOCK); CRAFT_HOW's comment and the pin's said the Weavers' alone | FIXED in both comments; the page's words leave the furnisher out, which is incomplete, not false - recorded |
| L1-10 | plusPad.js's L10N4 count fell 19 -> 18 only because the scanner does not read "Chronicle: Quests" as prose | RECORDED: KEY-LOGBOOK says nothing was routed through `t()` |
| L1-11 | fi, ja and pl still drafted the old ALCHEMY_HOW, their records on its old English | FIXED: redrafted through `tools/l10nInSession.mjs`, recorded on the current English |
| L2-1 | HIGH. The hitch's script line could be another frame's: it was `frameCpu`'s worst sample of the closing second, so a heavy frame that was no hitch spoke for the hitch | FIXED: each sample carries its frame's rAF stamp (`frameSampleAt`), and the counter asks for the frame before the second's longest gap; pinned beside a heavier frame that was no hitch, and for a gap that opens a second |
| L2-2 | `techFlight` outlived a parkour catch (it was cleared at `_pkLaunch`), and a clamber's exit sets Jumping again: the drop fell at full gravity under the spell | FIXED: cleared where a catch and a wall grab begin (`_parkourBegin`, `_wallBegin`); a flight caught in a hang, then its clamber, a wall grab and a direct mantle all glide |
| L2-3 | Two one-site mutants of recorded laws lived: the flight's fall never re-anchored (a Leap Strike down 3 m billed 3 m), and the gate's air refusal read off Jumping | FIXED: a leap down 3 m bills under 0.3 m, and a kick pressed while gliding off an edge is refused |
| L2-4 | Three hitch mutants lived: the hide's draws unreset, a 50-99 ms hitch never shown, the minute pruned 5 s early | FIXED: a 60 ms hitch kept at 58 s and gone at 61, the draws line after a hide, the age's rounding |
| L2-5 | The hitch line's "indent" cannot be seen in a right-aligned box | FIXED: no indent, and no claim of one |
| L2-6 | "Very likely the report's 0 FPS": nothing shows an alt-tab hid the page | FIXED: "possibly", with why |
| L3-1 | A company of one that killed the Armsmaster mid-duel was told "The challenge goes unmet." at the killing blow | FIXED: a duel the lord's fall ends says nothing of its own; the fall is told |
| L3-2 | The record's relay version was world219 after the merge (main's EG-PERFECT took it) | FIXED with L4-1 |
| L3-3 | "Warded" and the Conquest's new line are English literals | RECORDED: they wait on EG-L10N with the Spire's other words |
| L3-4 | Hall 25's court and balcony heights were the pre-merge reading | FIXED: both readings, each with the head it was read at |
| L3-5 | `egStacked` is a column test, not a line of sight; the pin's near shot crosses under the deck | RECORDED in the Ascent paragraph: the open air is the honest client's collider, and a crafted hit lands as one through a wall always has |
| L3-M1 | Garoth's words were unpinned: keyed on braziers, his ring was called and ended as the open duel | FIXED: his challenge and its end carry no `t` (`egaudit5_b`); two records |
| L3-M2 | Nothing pinned that a member with no feet in the fight sees the ring | FIXED: a frame with `feet` null draws it |
| L3-M3 | The plates before the trial were unpinned (possibly equivalent) | FIXED: not equivalent - the fight's state stands through the arrival; pinned there |
| L4-1 | SEAT_RELAY_MIN read 219, main's EG-PERFECT relay with no seat law; its pins read the constant symbolically | FIXED: 220, pinned against world219 and with RELAY_VERSION; three comments and the docs; world220 re-hashed in place (undeployed) |
| L4-2 | HIGH. A silent host whose socket closed with no farewell, inside the relay's bound, left the room never told who held the seat: the joiner kept a gone host and never streamed - the dupe again | FIXED: the leave says the seat when the leaver is the host last told (`_leaveMovesSeat`, a Room method of its own); the told host's presence guard is now unreachable, recorded equivalent |
| L4-3 | Most of seatTraffic's list was unpinned: the foes stream, the own lane, a ping, every frame | FIXED: each on the real Room |
| L4-4 | AUDIT ATTACH measured an interior room alone; a dungeon instance room's widest socket carries `hd` and `hi` (1086 bytes) | FIXED: measured, the fields listed (`SEAT_ATTACH_FIELDS`), under 1100 |
| L5-1 | HIGH (L4 rated the same defect MED). = L4-1, and the gate's pin could not fail | FIXED there |
| L5-2 | = L4-3's foes stream | FIXED there |
| L5-3 | "A building's room keeps the eldest" was pinned at one of its five sites, on an attachment with no `at` - a shape the runtime never mints | FIXED: the pin stamps `at` as Room.fetch does, and four building mutants die |
| L5-4 | A returner stamped now, and a host named counted as heard, were unpinned | FIXED |
| L5-5 | SAYS-PAST-TWELVE's third case: more than twelve lines between two frames, the last said folded out | FIXED: the twelve kept are said |
| L5-6 | WARD-BAR's flag mask was unpinned | FIXED: fury, stun and flight draw no cage |
| L5-7 | Two slices pointed at the wrong record (`Field-Bugs-2026-10-18.md`, "FIELD BUGS 2026-10-18") | FIXED: Testing.md's rows, both test headers, the counter's comment |
| L5-8 | Field-Bugs-2026-10-11b's sentence was not marked superseded | FIXED: marked |
| L5-9 | The ring's half-metre and the hide's draws were pinned only against themselves | FIXED: 0.5 as a literal; the draws with L2-4 |
| L5-10 | "law9_height's 27 still dead" - the record holds 70 | FIXED: 70 |

Found and left: under heavy load, with other lanes' mutants running, L5 saw one egFight-adjacent test file fail where a
clean rerun of the same files passed - not one of the `fb1018d` pins, and not found. Lane 5 also found the pull
request conflicting with main at 5362581de; main is merged in before the push meant to be verified.

## After

Tests: `fb1018d_crafthowto` 4, `fb1018d_hitchkeep` 4 (3), `fb1018d_homebench` 3 (2), `fb1018d_keylogbook` 2,
`fb1018d_leapslow` 9 (5), `fb1018d_seatlive` 11 (5), `fb1018d_duelring` 4 (2), `fb1018d_wardbar` 2 (1),
`fb1018d_saystwelve` 2 (1), `fb1018d_winchplates` 1, `auditattach` 4 (3); `egaudit5_b`'s Garoth loop asserts his
words. Mutants: 170 records, 169 dead and one recorded equivalent (129 before, all dead). Code: `frameClock.js` (each
sample's stamp, `frameSampleAt`) and `fpsCounter.js` (the gap's own frame); `motor.js` (the flight cleared at a catch
and a grab, not at the launch); `server/src/index.js` (`_leaveMovesSeat`, read by `_leave`); `seatLive.js` (220);
`egLords.js` (the fall's end); `tutorialCatalogue.js`, `inputActions.js` and the locales (the key's path, the
Professions row, sixteen drafts); `test/placeWidest.mjs` (any room's key). No host grew. Not checked here: a live game
(no ARENA2 data in the container) and the relay end to end on Cloudflare.
