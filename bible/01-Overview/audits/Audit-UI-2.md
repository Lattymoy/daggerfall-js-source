# AUDIT UI 2 - THE ENHANCED SURFACE, SECOND PASS (2026-08-27)

Mac: "lets do a comprehensive audit on the UI so far before
continuing."

Since AUDIT UI: **38 PX slices**, 91 modules, 8,855 lines across the
enhanced surface - the spellbook, the chronicle, the retirement of the
F5 sheet, the dial's north, Tab, and the two windows' centring.

## The method, and why it changed

The first UI audit swept for faults a stylesheet can have. This one is
shaped by **what actually went wrong since**, because the pattern is
unmistakable and it is mine:

| Slice | What shipped | How it was found |
|---|---|---|
| PX24 | the chronicle's door had ZERO callers | Mac, in play |
| PX26 (first try) | `openSheetPage` on 1 host of 4; north dead on three | my own run, before pushing |
| PX28 | Tab taught to the DIAL, which Tab never reached | Mac, in play |
| PX29 | both framed windows 260x140 off centre since PX23 | Mac, in play |
| PX29 | the doll's mask blanked the doll | Mac, in play |
| PX23/24/24c/29 | a shared part scoped to ONE shell, four times | Mac, and my own eyes |

Every one of those passed its own pins. The through-line is that **I
verified the thing I built and not the path a player takes to it** -
the door's behaviour but not its callers, the arm but not the key that
pulls it, the window's contents but not where it sits on screen. So
this audit asks reachability and placement questions, and turns the
two recurring ones into pins.

## The sweeps

| # | Sweep | Result |
|---|---|---|
| 1 | Every enhanced surface opened at **desktop / tablet / phone**: centring, scroll, targets, Tab, errors | 12 combinations, **clean** |
| 2 | **A part styled for one shell and left bare in another** | 0 - **pinned** |
| 3 | **Every enhanced window reachable from a host**, following DYNAMIC imports | 0 unreachable - **pinned** |
| 4 | Every **dial entry** on every host: does its arm exist | 15 entries, all defined |
| 5 | Every **pause section**: does it have a pane | 7 sections, all present |
| 6 | Redundant scoped CSS (the base rule already says it) | 1, removed |

## What sweep 1 measured

Four surfaces - spellbook, chronicle, sheet page, dial - at three
viewports. Every framed window sits **0px from the centre** on desktop
and tablet; the phone's sheet page is 11px off and scrolls, which is
PX13's own law for a 393px screen. Every surface closes on Tab. Zero
page or console errors anywhere. One control under 44px: the
chronicle's note-remove at 28px on a **mouse** desktop, which is
correct - the coarse-pointer rule raises it to 44 wherever a thumb can
reach it, and that was checked on the tablet.

## The two pins, and why they are the whole point

**No part styled for one shell and left bare in another.** This is the
fault that recurred four times, and each time it rendered as bare
running text until a human looked at it. The sweep reads every rule's
WHOLE selector list, excludes parts that have a bare base rule (which
covers every shell), and flags only a class one window styles and
another draws with no rule anywhere. Getting the exclusions right took
three passes - the first version reported 15 false alarms, the second
6, and the truth is 0.

**Every enhanced window reachable from a host.** PX24's fault as a law.
The chronicle's door and window were built, pinned and browser-verified
while nothing called the door - and every pin it wrote passed, because
all of them were about the door's own behaviour. Two details make this
sweep honest: it must follow **dynamic** imports, since the doors load
their windows with `import()` (the first version reported every window
as unreachable), and its roots must include **main.js**, since the
cursor and the crash line hang off boot rather than a scene (the first
version called them orphans).

Both pins were mutation-tested against the actual historical faults:
unhang the chronicle's door, or re-scope the chip to one shell, and
they fail.

## What this audit did NOT do

- **No ARENA2.** Every surface was driven with synthetic entities, so
  nothing here judges the enhanced UI over real game art - which is
  exactly the gap that let PX29's doll change ship.
- **No classic-side reading.** The rule that classic is untouched was
  verified separately and holds: zero lines changed in any classic
  window module since the arc began.
- **No contrast, screen-reader or performance work.** Named as gaps in
  the first UI audit and still open.
- **The live sweep is synthetic.** It opens windows through their
  doors, which is one step better than mounting them directly, but it
  is not a player walking in from the world.
