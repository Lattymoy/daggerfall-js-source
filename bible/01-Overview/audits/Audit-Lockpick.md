# AUDIT LOCKPICK - the lock, the Lockpick and the gathering's fixes read cold, 2026-10-26

The owner: *"Audit this"*, of the branch that built LOCKPICK (`06-Systems/Lockpicking.md`), RESOURCE-HIGHLIGHTS
(`06-Systems/Professions-Arc.md` section 54) and AUDIT GATHER (section 55), and with it *"Also ensure this is enhanced ui
plus"*. Four cold lanes read the branch at `81ff3671f`, each in its own worktree, each given the ask, its files and the
record, never a conclusion, and each had to prove a finding with a probe on the real code before reporting it:

| Lane | Read | Found |
|---|---|---|
| A | the tumblers, the host and the doors (the real `tryEnter` at a locked house in Steal mode, the real door and window over a DOM shim, the machine swept at every chance and Agility band) | 10 |
| B | the Lockpick (the item law headless, the counters online and offline, the save, the loot chain run 3,000 seeds, the thirteen languages) | 8 |
| C | every surface the branch shows, judged against Enhanced UI Plus in Chromium (six Plus colours, the Grimoire, the classic skin; a desk, two phones, two phones on their side; a faked pad through the real poller) | 14, and 3 suspected |
| D | AUDIT GATHER's ten fixes and the resource highlights (the real Worker over node:sqlite, the gather rig, a real WebGL2) | 6 |

38 reported, and one suspected proven since (S1). C8 is B2 seen from the card. Every defect is fixed or its record is
corrected; each fix is pinned by a test that fails on the code as it stood, with a mutant in
`tools/mutants/auditlockpick.json` that the pin kills (48 records - 47 dead, one recorded equivalent, below). Each fix in
code carries an `AUDIT LOCKPICK <id>` comment.

The one that mattered most was the first: **no locked building could be picked.** The front door's arm called
`lockpick.frontDoor`, and inside the Steal-mode ladder `lockpick` is the skill (DFU's own name for it), so every press at a
locked front door threw. The pins held the site by its source text alone and stayed green. The second was the owner's
UI ask: the lock's window was a box that painted itself - Georgia, its own stone - which no Plus colour, no Grimoire
dress and no pad prompt reached, and on a phone on its side its presses were off the screen.

## Fixed - the lock (A)

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| A1 | **Every front-door pick threw**: the steal ladder's own `lockpick` (the skill) shadowed the host. | The host is `lockHost` (`scenes/worldModes.js`). | `test/systems/lockpick/lockpick_door.test.js` (the real `tryEnter` at a locked House1: the window, CG2's tally, the line, the door entered) |
| A2 | **The tumblers did not carry DFU's chance**: at rise 0.16 s +-30%, grace 50 ms and a 0.18 s hang at 5%, every delay from 0.167 to 0.3 s after a lift set every pin at every chance - a blind rhythm opened a 5% lock six times in ten. | Rise 0.2 s +-45%, grace 30 ms, the 5% hang 0.08 s: the rise's spread (0.18 s) outspans what a press can set in at 5% (0.164 s), so no one delay sets every rise. A watching hand still beats DFU's odds - named as a departure (Lockpicking.md section 6). | `lockpick_audit.test.js` A2 (every delay at every Agility band) |
| A3 | **A death in the opened lock's 650 ms hold ran the success tail** - a corpse walked into the house. | The tail runs only when the window shut itself or by the player's hand (`onClose(self)`); a replacement in the slot is no self-close; the window's own frame takes it down when its player dies under a slot that is overwritten, never disposed. | `lockpick_door.test.js` A3 (death, Leave, dead mid-pick) |
| A4 | **A building's door a Lock spell locked could never be picked**, silently; DFU's ActivateActionDoor picks it. | `lockHost.wire(ctx.actions, ...)` - the interior's graph wired as the dungeon's is, opened through `lockpicked`, DFU's line and chime said where the graph has no result hook. | `lockpick_audit.test.js` A4 (a real ActionSystem; the interior's and the dungeon's wire) |
| A5 | The front door and CG2 had no behavioural pin; the CG2 pin was vacuous. | Pinned through the real door (A1's test). | `lockpick_door.test.js` |
| A6 | The machine's timing after the rise was unpinned. | Pinned: the hang ends at the chance's window, the fall's grace, past it a slip, the fall resting. | `lockpick_audit.test.js` A6 |
| A7 | "A snap drops every pin" was pinned at one of its three sites. | Pinned at all three: a forced free pin, a slip's snap, a failed Auto; no spool keeps a false set. | `lockpick_audit.test.js` A7 |
| A8 | The window's laws were unpinned. | Pinned: Gentle work's timing presses inert, the door closing once with `done` before `onClose`, the last pick's `out` ending the machine. | `lockpick_door.test.js` A8 |
| A9 | Weak pins in the host and the action graph. | Pinned: the host hands the machine Lockpicking and Agility, the opened lock turns before its window shuts, a moving door is never swung for a pick. | `lockpick_audit.test.js` A9 |
| A10 | Record wording: "4% to 60%" (the chance floors at 5, so 52.25% at most); Grab mode opens a chest's window too; DFU's "You fail to pick the lock." is never said for a played lock, unnamed. | Lockpicking.md sections 2, 3 and 6. | - |

## Fixed - the Lockpick (B)

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| B1 | **The account service was not deployed ahead of the site**, and the branch's own deploy-filter test was red: during the gap an honest Lockpick was judged a forgery. | acct195; the account deploy's filter names `lockpickRow.js`; the service before the site. | the deploy-filter and version pins (PIN MOVED: acct195) |
| B2 | **The Lockpick's card lines reached no card** (= C8): the classic Info box, the enhanced card and the stat rows each gated on a list it was not in. | `isLockpick` in all three gates (`itemInfo.js`, `enhancedInventory.js`). | `lockpick_audit.test.js` B2 |
| B3 | "{count} left" ungrammatical at one pick in Spanish, Italian, Portuguese and Bulgarian, and at two to four in Czech. | An ICU plural in the English and in every language. | `lockpick_ui.test.js` B3 (through the real `t()` over each real table) |
| B4 | **Online, a shoplift then one pick bought put the stolen picks back** - the counter stood whole on any purchase. | `restockLockpicks`: stood back by what the purchase took, never past the stack - ENDLESS-ARROWS' law. | `lockpick_audit.test.js` B4 |
| B5 | The rogue rates overstated what a body holds (PLAIN-LOOT's keep runs after the extras), and a Bard's is three in twenty, not one in seven. | Lockpicking.md section 2: carried and left on the body, both. | - |
| B6 | Grab mode picks a chest or crate too; the item's words say Steal mode. | Named in Lockpicking.md section 2; the words left (Steal mode picks all three). | - |
| B7 | The translation brief not followed: no glossary terms, French without non-breaking spaces before `: ; ! ?`, French's Gentle work not its table's own words, Portuguese's crate not "caixote", an Italian straight apostrophe. | All five, in the thirteen languages' tables and glossaries. | `l10n1b` (the tables cover the catalog) |
| B8 | Weak pins: the save's gift by source text alone; the law "headless" judged from the in-process registry. | A real save round trip through five loads; the item law judged in a process of its own. | `lockpick_audit.test.js` B8 (2) |

## Fixed - Enhanced UI Plus (C)

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| C1 | **The window was outside the kit on every look**: its own stone and Georgia; 0 pixels changed across the six Plus colours, no Grimoire dress, on the classic skin neither the classic look nor the kit's. | The kit's roles (FRAME_ROLES: window, header, well, button, warn, chip); the layout in the Plus sheet's `LOCK_CSS`, the pixel face; on the classic skin `lockSkinCss` - the layout and the kit cut to `.lk-` selectors, the Broker's U1 way. Re-probed: 129,988 px change from slate in each colour, Alagard under the Grimoire (its Auto the dress's warn word, its Leave the Exit plate). | `lockpick_ui.test.js` C1 |
| C2 | **On a phone on its side the window could not be used or left** - its head off the top, 2 to 20 px of its presses at the bottom, the touch layer's way out hidden under it. | Never past the screen: it scrolls, the canvas alone takes the drag; under 520 px tall the lock stands beside its words and presses. Re-probed at 844 x 390 and 640 x 360: whole, presses on screen. | `lockpick_ui.test.js` C2 |
| C3 | **No pad prompts, the d-pad left the lock, and the recorded pad path was dead.** | Under Plus the lock's arm (`plusPad.js` registerLockArm): the d-pad moves the pick and the cursor to its chamber, A presses that pin, X the Auto attempt, the prompt bar the lock's own row; the classic pad's d-pad and X read as keys (`LOCK_KEYS`); the door reads a host's raw code. | `lockpick_ui.test.js` C3 (2 - the real poller) |
| C4 | The window's capture took Enter and Space from its own focused presses (Enter on Leave snapped a pick). | A key on a focused press is the press's. | `lockpick_ui.test.js` C4 |
| C5 | Presses 34 px on a phone on its side; a tap off every chamber pressed the pin under the pick. | 44 px under a coarse pointer; a chamber's target its whole pitch; a tap off every chamber presses nothing. | `lockpick_ui.test.js` C5 |
| C6 | Leave wore the blood edge; the Auto attempt, which costs a pick, did not. | The Auto attempt the kit's warn, its title saying a failed roll snaps a pick; Leave plain. | `lockpick_ui.test.js` C6 |
| C7 | Refusals silent or merely `disabled` (3.78:1): Gentle work's presses said nothing; the gentle line promised the lock; the binding pin lit where none can be pressed. | `aria-disabled` and the reason said when pressed; Gentle work's press says why; the gentle line says a failed roll snaps a pick; no light under it. | `lockpick_ui.test.js` C7 |
| C8 | = B2. | | |
| C9 | Dash asides; "binding pin" and "spool" never explained; "colour"; "(Q)" and "(Esc)" told to a finger and a pad; "1-6" for any lock. | Plain words, each term said where it is met; "color"; the keys the keys line's alone, hidden to a finger and a pad; "1-{n}". | `lockpick_ui.test.js` C9 |
| C10 | DFU's look-at line at 14 px italic. | 15 px, a reading line. | - |
| C11 | The window jumped as three-line words shrank to two on a phone. | Three lines held under 420 px. | - |
| C12 | The canvas soft at DPR 3. | The backing store at the screen's density. | `lockpick_ui.test.js` C12 |
| C13 | Off the port's sounds a slip and a snap were silent. | DFU's own: Parry6 for a snap, EquipShortBlade for a slip. | `lockpick.test.js` (the ear) |
| C14 | The day's turn stopped a gathering with "stopped early" and no reason, in English alone. | `ACT_GONE_LINE` through `t()`: the spot is gone for now, nothing taken. | `auditgather.test.js` F5 |
| S1 | The window's capture ate a text field's W, A, D, Q and digits (proven; the chat's own reach not traced). | A field's typing is the field's. | `lockpick_ui.test.js` S1 |
| S3 | The pad's prompt bar over the presses on a short screen (not measured). | The window stands above the bar (`--plus-pad-clearance`, the pack's way). | `lockpick_ui.test.js` C2 |

## Fixed - the gathering's fixes (D)

| ID | Finding | Fix | Pinned by |
|---|---|---|---|
| D1 | F1 kept a seat refusal on the FIRST ask, told the player it "will be counted", and asked it again on the pump's quick steps for good. | Kept only once an earlier ask went unanswered; asked again five minutes apart. | `auditgather.test.js` F1 |
| D2 | **F3 bounded hauls, not schools**: an honest angler's first school after forty plain hauls earned nothing. | The bound counts schools - a haul says so on its row (migration 0176, acct195). | `auditgather_service.test.js` F3 |
| D3 | F5 never reached a Motherlode (its key is no node key): a strike played past the close wore the Pick-Axe for a refusal. | The act ends as its lode sinks, the going said. | `auditgather.test.js` D3 |
| D4 | The ring's GL state and uniforms were unpinned in node. | Asserted, each node its own rectangle and tile. | `resourcehighlights.test.js` |
| D5 | Weak pins on the fixes: F2's bound tested a minute past the rise, F5 without its meter, the Basket's glints in the rain. | A second past the rise; the meter down; the Basket's glints stand. | `auditgather_service.test.js`, `auditgather.test.js` |
| D6 | F8's "every honest beat heard at any refresh" holds only at steady play-out: a peer caught up at x1.5 or x2 hears 100 of 199. | The record says "at steady play-out" (section 55); not changed - a catching-up pose is already behind its beat. | - |

## Left, with reasons

- **A watching hand beats DFU's odds** (A2's second half): the chance is the tolerance, not the odds, by design; the
  Auto attempt keeps the odds. A departure, named in Lockpicking.md section 6 and Ledger A.
- **S2**, the classic skin in a real dungeon host with a pad, was not driven: the classic pad's codes are read at the
  window's own capture (C3's pin), which every host's keys pass first.
- **One mutant recorded equivalent**: the pad arm left registered after its window (AUDITLOCK-C3-arm-left) - the arm
  answers `up` false once its window is gone, so nothing reads it; the unregister is the owner law's. And in
  `tools/mutants/lockpick.json`, `!dead` in the tail's guard (LOCKPICK-dead-host-tail) is now behind `self`: a host's
  dispose closes its window as a replacement.

## The test the lanes did not have

`test/systems/lockpick/lockpick_door.test.js` stands the real worldModes over a stub host and picks a locked House1's
front door through `tryEnter` - the press a player makes. A1 shipped green because no test made that press. The host's
roll is read at the roll (`rolls = () => Math.random()`), so a test's dice reach a host built before them.

## Patch notes corrected

The branch's patch notes (the pull request's description) said Intelligence and Agility "widen" the Fishing-Net's tug
window - their band narrows it too (x0.85 below 40, to x1.30); that the Outline rings "each gathering spot" - a Hunting
body, drawn as a 3D character, keeps its glow (section 54's departures); and that a school's fish counts on "your first 40
hauls" - schools now (D2). Corrected in the description, with the audit's own lines (the front door, the Lock spell's door,
the pad, the phone on its side).
