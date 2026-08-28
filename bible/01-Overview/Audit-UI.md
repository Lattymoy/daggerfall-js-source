# AUDIT UI - THE ENHANCED SURFACE (2026-08-27)

Mac: "let's do a comprehensive audit on all of our enhanced UI work so
far."

**The subject is the PX arc**: fifty-four slices, all landed on
2026-08-27, that rebuilt the enhanced interface as pixel art - the
home, the pause window, the journal, the stats and system pages, the
settings shell and its catalog, the new-game wizard, the compass dial,
the inventory, the world map, the loot window and its tooltip, the
hover plaque - across nine modules and 7,130 lines, plus the site that
wears the same face.

**And the method is LIVE, not static.** A sheet this size answers grep
questions with grep answers: a selector exists, a class is styled, a
rule is present. None of that is what a player meets. Every finding
below was measured in a real browser on a real surface, and the two
static sweeps that came back clean are reported as clean rather than
dressed up.

## The sweeps

| # | Sweep | Result |
|---|---|---|
| 1 | Every enhanced surface opened, **page and console errors** | 0 across home, settings, load, mods, pause (quests/stats/system), pack, loot - desktop and phone |
| 2 | **What can the user scroll**, computed overflow x real overflow, every element | 5 scrollers, all correct - see below |
| 3 | **Controls under 44px**, desktop / phone / **tablet** | **F401** - the one real fault |
| 4 | The cause of F401 | **F402** - inline styles defeat media queries |
| 5 | CSS classes **styled but never produced** | 0 |
| 6 | The `.packcol` collision shape, swept across the sheet | 24 flagged, all cosmetic (padding/background); the two that matter (`overflow`) were PX21f's, already fixed |
| 7 | PX1's **"states SNAP"** law: every `transition:` in the sheet | Clean. The only transitions are the deliberate entrances - the pack window, the dial, the detail sheet, the scrim - each a recorded slice |
| 8 | The pixel faces' **square corners** | Clean. Three `border-radius: 50%` remain and all three are the pre-pixel shell's status dot; every `.px-*` face sets 0 |
| 9 | The **tooltip** in both flows, with a card open | Clean since PX21f - no scroll, no clip, desktop and phone |
| 10 | The **loot window** at 3/8/9/14/18/24 items | Clean since PX21e - never scrolls, widens at 8, last row always 10px inside |
| 11 | The **journal's** three sections with four log shapes | Clean since PX22 - three headings always, empties marked, no kind tag |
| 12 | The **timer** at day/hour/minute/none | Clean since PX22b - both appearances conditional, urgent under a game day |

## The findings

**F401 - the 44px rule follows the SCREEN WIDTH, not the pointer.
FIXED.** Every touch-target rule in the sheet hangs off
`@media (max-width: 860px)`. That is a PROXY for "is a thumb pointing
at this", and it fails on exactly the device the proxy stands in for.
Measured on an iPad in landscape - 1080px wide, `pointer: coarse`
true, `ontouchstart` true - the skin switch drew at **28px**, the
settings steppers at **34px**, and the value buttons at **38px**. All
three are things a finger has to hit; two of them are the control Mac
asked to be prominent (U62) and the control every setting is changed
with.

The width query STAYS, because a narrow window wants the roomier
layout whatever is pointing at it. `(pointer: coarse)` joins it,
because that is the question actually being asked. Re-measured after:
iPad landscape 0 controls under 44px, phone 0, and a mouse desktop
still 5 - which is correct, since a mouse does not need a thumb's
target and the compact row is the denser, better layout for it.

**F402 - an inline style is unreachable by a media query. FIXED, and
this is the finding worth remembering.** When the coarse rule went in,
the value buttons stayed at 38px however the rule was written - because
their size was set in JAVASCRIPT, `b.style.minHeight = '38px'`, in
three separate places. No stylesheet rule of any specificity can raise
an inline style, so the responsive law could not have applied to them
at all. It was invisible to every static sweep, because grep sees a
number in a JS file and has no opinion about it; it was only findable
by measuring the rendered box and then asking why the fix did not
take. The size is a class in the sheet now (`.rowact`), which is the
only place a responsive law can see.

## What came back clean, and why that is worth saying

Four of the twelve sweeps looked for faults this arc has produced
before and did not find them again:

- **The class collision** (sweep 6) is this file's signature fault -
  `.detail`, `.packcol`, `.empty`, and the tooltip's `overflow`, four
  times across the arc. The sweep found twenty-four more instances of
  the shape and every one is a padding or background difference that
  is a design choice rather than a leak. The dangerous property is
  `overflow`, and both cases of it were already closed by PX21e/f.
- **Dead classes** (sweep 5): none. A sheet of this size with nothing
  styled that nothing draws is not an accident; it is what recording
  each slice buys.
- **The snap law** (sweep 7) and **square corners** (sweep 8) hold
  everywhere the pixel faces reach.

## The scrollers, judged

Five things in the enhanced UI can scroll, and all five should:

| Where | Why it is right |
|---|---|
| The settings catalog list | 171 settings; DFU's own window scrolls |
| The pause stage, on a phone | A 393px screen cannot hold a page |
| The loot list, on a phone | The frame is capped at 40dvh there and never widens (the `wide` class is overridden by the phone's `width: 100vw`), so a long pile scrolls **its list** while the head stays put. Honest limitation, recorded rather than clipped away |
| The journal rail and detail | Long quest trails |
| The pack dock | The bag |

## What this audit did NOT do

- **No ARENA2.** 189 corpus-gated tests skip; every surface was driven
  with synthetic entities and a synthetic paperdoll. Nothing here
  judges how the UI looks over real game art.
- **No contrast or screen-reader audit.** The sweep measured target
  size and scrollability, not colour ratios or announcement order.
  Both are real questions and neither was asked.
- **No performance measurement.** Render cost, repaint counts and the
  cost of the per-frame hover pick were reasoned about when they were
  written (PX19k, PX21c) but not profiled here.
- **One lane was moving under it**, as always; the counts are the
  merged tree's.
