# AUDIT SEASON-BOOK (2026-10-22) - the laurel and its window, audited before they merge

The owner, of SEASON-BOOK (`10-UI/UI-Arc.md` SEASON-BOOK, the answer to *"I think we need a new pause menu icon, like we
did for the timers and mail. A condensed place to see season related content and descriptions"*): **"Audit this and
ensure perfection"**. This page is the findings, each with its verdict. What the audit changed is written into the
record's section as it now stands, each change under its finding's id (AUDIT SEASON-BOOK R1 and on), and the code says
the same at every site.

## How it was run

Six lanes, each a cold adversarial reader of the change at 53d0fe21b (SEASON-BOOK, ca5ea342e, with main merged in), told
to reproduce every finding - a probe and its saved output - before reporting it, to cite the code by its text, and to fix
nothing. They read A FROZEN SNAPSHOT (a detached worktree of 53d0fe21b), never the working tree: Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING held - no fix was made until all six had reported.

| Lane | Over | How |
|---|---|---|
| L - the law | `systems/seasonBook.js`: the three clocks at their edges, every sentence the window shows, every standing line | 13 probes, several over the account service itself on node:sqlite (`test/accountDb.mjs`), and a test file of the findings: the clocks against the service's and the hourglass's at six instants, 134 fuzzed calls |
| R - the reads | `scenes/seasonBookHost.js` and its wiring, the service's cost, identity, the season's turn, guests, `/season` | 7 probes driving the real book, `seasonSource`, the arena online and the account doors over `call`, and the service's own board functions |
| U - the browser | the laurel and its window in Chromium over the real pause face | 19 probes and 107 screenshots at nine sizes, rotations, every Plus theme and the Grimoire dress, the keyboard, a pad, a touch, a screen reader's names, contrast off the drawn ground |
| W - the words | every word in English and in thirteen languages, and the record | 7 probes: the model rendered in fourteen languages, every plural at 1/2/5/21, the numbers beside the boards' own, the window laid out in each language |
| P - the pins | the tests and the mutants | 98 new mutants over the snapshot (77 survived), every survivor applied together over the 552 test files the change can move |
| S - the seams | the face around it, the hosts, the handoffs, the anchors, the cost of a tick, Host-Split and the bible | 12 probes on the test DOM (`test/chargenDom.mjs`) and 3 in Chromium |

**WHAT THEY FOUND.** 66 findings, 13 of them one defect met by a second or third lens (written `= R5` and so on): 53 in
all. One was a load on the account service any open window made: four boards asked from every open season window -
the arena's every twenty seconds and three more a minute, two of them uncached whole-season queries on the primary, on a
hidden page too and past BUSY-GATE's hold - some 31 times the timers window's load, for standings that cannot move
while the game is paused (R1). The rest: the last account's standings shown to the next (R2), last season's under the
new season (R3), guests told a rank would follow on boards no guest can enter (R4), the Arena row reading "the board"
for ever (R5); seven sentences that said less or other than the game does (L1-L7, L12); the window's numbers and dates
in English in every language (W1, L8); a focus lost on a rebuild (S2), a touch's release landing on the face under the
window (U1), a door that opened nothing never resuming (S3, at six doors); and tests that held a fraction of it (P1-P17).

## Findings

Severity: HIGH wrong for players in normal play, a request storm, a leak; MEDIUM wrong in a real but narrower case, an
accessibility or layout break at a common size, a misleading word; LOW polish, a fragile pin, the record. Every finding
is FIXED unless it says otherwise; every fix is pinned in `test/ui/enhanced/seasonbook.test.js` or
`test/ui/enhanced/seasonbook_face.test.js` unless it names its own.

### R - the reads

- **R1 HIGH** - an open window polled four boards (6.2 asks a minute against the timers window's 0.2), on a hidden page
  too, none behind BUSY-GATE. FIXED: a board is asked at the window's OPENING alone, once a minute at most however often
  it opens, never while it stays open; never hidden, never while the service has asked to be let be (`busyUntil`), never
  for a guest or no one signed in; the arena refreshed at the opening, the seats list asked at the opening (`seasonSource`'s
  `opening`). Ten minutes open: three asks, not sixty.
- **R2 MEDIUM** - the kept answers were no one's: signed out, the window kept showing the last account's lines; signed in
  as another, A's until the next ask. FIXED: every answer the account's that was signed in when it was asked (`me()`),
  dropped the moment the session changes; a no-session answer keeps nothing; the arena's board bound to the account it
  landed under.
- **R3 MEDIUM** (= L9) - at the season's turn last season's standings stood under the new season's title. FIXED: an answer
  of another season is no standing; the turn asks again at once, open or not.
- **R4 MEDIUM** (= L4) - every board answers a guest's `me`, so "Sign in to be ranked." was unreachable and a guest read
  "No rated games yet" on boards no guest can enter. FIXED: a guest is told *Add a username to be ranked.* (the game's own
  words) and asked nothing; the festival's rows tell a guest it is a registered account's.
- **R5 MEDIUM** (= S1, P3) - the Arena row read "Reading the board..." for ever when its board could not be had. FIXED: the
  arena's board a read like the others - asking (`fetchBoard`), the answer, or unread.
- **R6 LOW** (= W12) - `/season`'s refusal told a connected, signed-in player to connect and sign in (its only case is the
  relay's clock not yet heard). FIXED: *The world's clock hasn't been heard yet. Try again in a moment.*
- **R7 LOW** - an arena not live said "Open the Arena to read your standing", and opening it read nothing. FIXED: no line.

### L - the law

- **L1 MEDIUM** (= W4) - the foot's champion rule (10 games, 5 rivals, while first) stood under the Spire's row; Spire
  Champion is each bracket's top ten through the next season, and the arena counts bouts. FIXED: the foot names its three
  titles; its 10 and 5 held to all three boards' constants (L13/P16).
- **L2 MEDIUM** (= W3) - "Red Banner: N points" was the player's own points said as the banner's. FIXED: *12 points for the
  Red Banner*, as the Arena says them.
- **L3 MEDIUM** - "Deepest this season: Hall N" was the company's best Descent from Hall 1. FIXED: *Your best Descent: Hall
  N*, the Spire window's own words.
- **L5 MEDIUM** (= W10) - "a Tide a week in every kingdom" - five lands, and Calm 40 in 100. FIXED.
- **L6 MEDIUM** (= W10) - Soul Cakes "found on the dead and the summoned and in deeds" - any foe finds them, and gathering,
  crafting, loot and the sea. FIXED.
- **L7 MEDIUM** - "31 October" was the UTC day in a window that says every other time locally. FIXED: "(UTC)".
- **L8 MEDIUM** (= W2) - ratings grouped en-US in every language ("1,240" a decimal in twelve of thirteen), unlike every
  board. FIXED: ungrouped, as the boards print them.
- **L10 LOW** - before the epoch, or with no clock, the day wrapped to "Day 56 of 56". FIXED: the day holds at 1.
- **L11 LOW** - one clock, three names. FIXED in part: the window says "Season n" as the arena, the Spire, Iliac Hand, the
  Gambit and the sea do (W7). NAMED: the hourglass's row stays "The Spire's season n ends" - it is the Elite rows' own,
  whose door is the Spire's boards.
- **L12 LOW** - "a guild ... earns Keeper of its town": the guildmaster alone. FIXED.
- **L13 LOW** (= P16) - the foot's numbers tied to the arena's alone. FIXED: the test imports the service's Iliac and Gambit
  constants.

### W - the words

- **W1 MEDIUM** (= U8) - English in every translated section head: the seats' Season by townSeatLaw's English name, the
  moment in `localWhenText`'s English weekdays and months, the countdown's "d" and "h". FIXED: the Season by the months'
  own localized table (`seatSeasonTitle`), the moment by Intl on the text core's locale (`seasonWhenText`), the days'
  letters through the text core (`seasonLeftText`).
- **W5 MEDIUM** - "Runs on the real-world calendar" over rows timed by the sky (a Starfall night is every real hour).
  FIXED: no lead; the Starfall says "every in-game night, about once a real hour".
- **W6 MEDIUM** - "Marks" (the currency is "silver" everywhere a player reads) and "profession tracks" (the code's word).
  FIXED.
- **W7 LOW** - "Ranked Season", "The Season's Captains", "the trial Season" - unlike the game's "Season n", "the season's
  captains", "the beta". FIXED.
- **W8 LOW** - harbourmaster (the game: harbormaster), ranked bouts (rated), rivals (opponents), between accounts (registered
  accounts). FIXED.
- **W9 LOW** - the worn titles translated in some languages and rows, English in others; "Crowned in Season {n}" split
  the translators. FIXED: every language keeps the worn titles in English, quoted, as the name badge shows them.
- **W11 LOW** (= U9) - the laurel's name listed the seats and the festival, which the window may not hold. FIXED: "Season".
- **W13 LOW** - Indonesian named the Descent "Penurunan" (the catalogue's "runs"). FIXED: Kedalaman, the glossary's.
- **W14 LOW** - the "condensed place" ran to two screens, its longest rows lists of game terms. FIXED in part: the
  Once-a-Season row dropped, the beta's lead and the cakes' line cut, the label and `/help` plain. NAMED: on a phone the
  window still scrolls - each row's line is the description the owner asked for.
- **W15 LOW** - the record: "Daggerfall has no seasons", "the banner's points", "the three title boards share", "(660px)"
  read as the timers' width. FIXED in UI-Arc.md.

### S - the seams

- **S2 LOW** (= U2) - a board's answer rebuilt the list and a focused door's focus fell to the page. FIXED: every line
  rewritten in place; a rebuild (only when rows or doors change) keeps the focused door's focus.
- **S3 LOW** - "a door that opened nothing resumes" never ran: the handoff unmounts the face, whose unmount empties
  `onAction`, and the resume was asked of the emptied handler - the pointer left free under a running game. Pre-existing
  at every door that leaves the face (the sheet's, the hourglass's, the Fleet's, the Captain's, a Family page's, the
  Guide's); its pins had used a close that never unmounts. FIXED: one `handoff`, its handler read before the handoff;
  AUDIT 27h A4's test now unmounts as the real close does.
- **S4 LOW** - a window outlived its lost mark and came back unasked when the clock returned. FIXED for the season's, the
  hourglass's and the mailbox's windows.

### U - the browser

- **U1 MEDIUM** - a touch tap or the pad's A outside a window also pressed what the repaint put under it (the game
  resumed, a tab turned, the hourglass or the account window opened). Pre-existing on the hourglass's and the mailbox's
  windows. FIXED in the shared code: those three scrims swallow their own tap's click (`swallowTapClick`), once, never past
  a new press or 700 ms. The pause face's own scrim, whose tap resumes the game, asks for nothing.
- **U3 LOW** - every repaint of the face moved the focus to Close and scrolled the list to the top. Pre-existing on the
  hourglass's window. FIXED for both: the focus goes in at the opening alone, without scrolling.
- **U4 MEDIUM** - on portrait phones under about 686px the four marks covered the tops of the pause tabs (a tap on Growth
  opened the season window). FIXED: the pause window stands clear of them at phone width too.
- **U5 LOW** - with a pad connected, the prompt bar hid the window's last line on phone sizes. FIXED for every window on the
  hourglass's stage.
- **U6 LOW** - the laurel drawn at 2.5 screen pixels to the art's one. FIXED: 36px, 3x, as its neighbours.
- **U7 LOW** - in Russian and Bulgarian at 320px a section's title broke a word a line beside its clock. FIXED: the clock
  goes under its title.
- **U10 LOW** - a landscape phone's doors 40px. FIXED: 44px everywhere.

### P - the pins

P1 (the laurel's open and close never driven), P2 (the window's descriptions, names, subs, leads and foots and the Arena's
door never asserted), P4 (a moved pin matching the season branch's line in place of the mailbox's; the laurel's inert line
under the hourglass unheld), P5 (a broken stop hanging the run), P6 (the focus, aria-expanded and the dialog's name
untested), P7 (a counted Season's lead and the seats' end), P8 (the times: the default tick, the relay offset, a sub-hour
countdown), P9 (the minute, the `out` flag, the default clock), P10 (pins matching a commented-out line), P11 (the standing
edges), P12 (the never-throw nets), P13 (the anchor's teardown), P14 (the sheet's pins weaker than their words), P15 (the
`/season` anchor, the seats flag): FIXED - `seasonbook.test.js` rewritten (21 tests) and `seasonbook_face.test.js` (7
tests: the laurel on the real pause face mounted). **P17 NAMED**: `/season`'s refusal in world.js is held by its line's
text, its two halves (`pauseCommandOf`, `pauseCommandRefusal`) by behaviour - moving the one-line decision into a
function of its own would cost bootWorld logical lines it has not got.

## Known, named

- The arena online (`scenes/arena/arenaOnline.js`) never drops its board when the account changes - the Arena's own window
  shows the last account's board until its next ask. The season window binds the board to the account it landed under
  (R2), so it never shows it as the new one's; the Arena's window is ARENA4b's.
- L11's hourglass row and W14's phone scroll, above.
- At 320px the row of marks overlaps the pause window's top border by 11px, as the profile, the hourglass and the envelope
  did before the laurel (S's measurement); the tabs themselves are clear (U4).

## Pins moved

- `test/ui/enhanced/outsideTap.test.js` - the scrims' swallow (U1), and a unit test of `swallowTapClick`.
- `test/ui/enhanced/audit27h.test.js` (A4 now unmounts as the real close does), `test/ui/eliteGates/egz_ends_board.test.js`,
  `test/ui/levelNotice.test.js`, `test/ui/enhanced/enhancedPause.test.js`, `test/ui/escbook.test.js`,
  `test/systems/naval/captlog.test.js`, `test/systems/horse/holdings.test.js` - the doors through the one `handoff` (S3), and
  the hourglass's window's `focus` (U3).

## Mutants

`tools/mutants/seasonbook.json`: one record a behaviour - every finding's fix, every pin the PINS lane found unheld, the
re-aimed records of the first build. The handoff's own records re-aimed by content in `egz_ends.json`, `audit27h.json`,
`guide2.json` and `fieldbugs27h.json`.

The sweep (`node tools/mutate.mjs --jobs 4`, the 143 records and the 6 re-aimed): 146 dead, 3 survived. Each survivor was
a pin too loose, now tightened, and all three are dead on the second run:

- `an-unread-board-as-asking` changed the key and kept the English, which a test without a catalog cannot see. The record
  now swaps the whole line.
- `the-countdown-half-hour-late`: the window's countdown was only checked at a whole hour. It is now checked in the
  season's last minutes too, where it runs to the second.
- `the-head-squeezed`: the head's `flex-wrap: wrap` was checked for being there, not for being the only one. A later
  `nowrap` now fails it.

The near-suite run also caught `test/systems/enhancedMenu.test.js`'s door law: the handoff no longer spelled
`onAction('handoff')`, so the helper says it again and calls the captured handler only for the resume.

## What stands

The window asks the service at its opening and not again while it is open; says each player's own standing, of this
season, or that it cannot; says what each thing holds in the game's own words, in fourteen languages; keeps the focus
and the finger's tap where they belong; and every one of those is a test that fails without it.
