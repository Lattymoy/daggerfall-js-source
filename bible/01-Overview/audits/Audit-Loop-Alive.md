# AUDIT LOOP-ALIVE - FIELD BUGS 2026-10-28 read cold, 2026-10-28

The owner: *"Audit this"*, of `8f4f33e2f` - LOOP-ALIVE (`../bugs/Field-Bugs-2026-10-28.md`). Three cold lanes read the
commit at its head, each given the files and one brief, never a conclusion. No browser was run (the owner's word).
Every finding was proven by a node drive of the real modules, a test or mutant run at the head, or quoted lines.

| Lane | Read | Found |
|---|---|---|
| A | the frame loop guard in the hosts: every arm, a throw's leftovers, the report, the build and the tools | 9 |
| B | the gathering act's fault mark: every path through `tick`, the drop, the real thrower past the Bay | 7 |
| C | the pins, the mutants and the record | 16 |

No blocker. The fixes carry an `AUDIT LOOP-ALIVE <id>` comment. The pins are in `fb1028_loopalive.test.js` (5 tests
became 12). Its mutants are in `tools/mutants/fb1028_loopalive.json` (8 became 32, all dead, every survivor a lane
found among them). One older record moved by content: `gatherfeel2.json` GF2-BLOWSHAKE, still dead.

## Lane A - the frame loop

- **A1, fixed.** A thrown value with no string (a null-prototype object) threw inside the report, before the re-arm,
  and the loop died. The loop is armed first, and the fault's key is read in a `try`.
- **A2, A3, fixed.** The report was keyed by message for the whole page. A message that changed every frame was said
  every frame, and the Dismiss button was rebuilt under the click. The same words from another line were never said
  again. Now each loop keeps its own faults, keyed by message and the line that threw, at most `SAID_MAX` (8).
- **A4, pinned.** The `frameAbort()` in the catch was unpinned. A test now holds the clock with no frame open.
- **A5, fixed.** A pass that throws mid-draw leaves its GL state (the depth mask off, blending on), and the next
  frame now comes. A host's world frame begins on RW1's baseline, before its clear (`_drawBaseline`). A bracket's
  frame is left alone: the fix's first cut set it there too and wiped a panel's depth-only clear (`roadc_panelframe`).
- **A6, recorded.** A throw in a host's kill branch (`destroyWorldPlaque`) would re-arm a killed loop. Every call
  there is guarded today, so nothing changed.
- **A7, fixed.** Five comments said a throw still ended the loop: `main.js` (two), `worldPlaque.js`, `world.js` and
  `travelOptions.js`. The report still reads CRASH for a fault the game survives, as for every other non-fatal throw
  since RPT1026-CLIENT.
- **A8, fixed.** Where `reportError` is missing, the fault is thrown from a timer (`frameCap.js`'s way).
- **A9, fixed.** `interior.js`, the fourth frame host, now arms through the guard. The title menu's loops do not.

## Lane B - the gathering act

- **B1, fixed.** The mark covered the whole top of `tick`. A throw there that passed ended a healthy act - for
  example a finished act's last swing landing. A finished act's swing is now caught by itself. And an act ends only when
  its frame throws `ACT_FAULTS_MAX` (2) ticks in a row, so one passing throw is stepped over, as before LOOP-ALIVE (C7).
- **B2, pinned** (C2 below).
- **B3, fixed.** A kind that threw every frame warned every frame. The host says each fault once (`warnOnce`).
- **B4, B6, fixed.** The drop ends the machine before it lets the act go, each in its own `try`. The meter and the
  line come before the pointer.
- **B5, recorded.** The first press after a fault can still go to the faulted act. With two faults now needed,
  that is two frames.
- **B7, recorded.** No real thrower was found past the Bay. A drive with the tree kind's real renderer, forest groups
  and jungle trees ran marks, pictures, the plaque, a chop, the fall and the logs with no throw. A fault outside `tick`
  (the press, the plaque, the marks) is the frame loop's to survive, not the act's.

## Lane C - the pins and the record

- **C1, pinned.** A host could arm around the guard (`globalThis.requestAnimationFrame`, or an arrow whose identity is
  new each frame) and every pin stayed green. A test now reads every arm in the four hosts.
- **C2, C5, pinned.** The drop's meter, cancel, letting go, line and slot order were unpinned.
- **C3, C4, pinned.** The mark at the tick's head and after the step, and each kind's frame on its own, were pinned
  at one throw site only.
- **C6, C12, C13, pinned.** The clock, a thrown value with no words, and the running callback forgotten.
- **C7, fixed** (B1).
- **C8, fixed.** The record's sweep was not committed and claimed every climate. It is a test now: regions 62 to 70,
  the seven climates that stand trees (226 to 232), both grounds, at Logging 100 - 126 chops. The record says what was
  not checked.
- **C9, fixed.** The pins' pixel is Valenwood (region 67, Rainforest), not Skyrim's woods.
- **C10, C11, fixed** (A7, A9), and the wording: a loop's first frame still throws.
- **C14** is A2. **C15, fixed:** the pins' page runs every callback a frame, as a browser does. **C16, recorded:** the
  drop's `syncPointer` is near-equivalent - the tick's foot syncs the pointer in the same frame.
