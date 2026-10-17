# Field bugs 2026-10-13: TALL-TOUCH

Discord #bug-reports, "Interface issue on small screens", a player on an ASUS ROG Xbox Ally X (written through a
translator): *"it's impossible to configure the game settings because of a huge game logo that won't minimize or go
away. I wouldn't be complaining about this if there weren't specific settings in the main menu."* Two screenshots: the
DFO Online mark filling the screen, the rail along the bottom, and Settings' tabs a strip between them.

## TALL-TOUCH: any landscape screen keeps the two columns

**The cause.** The front door stacks into one column wherever `(max-width: 860px), (pointer: coarse)` holds
(`ui/enhanced/enhancedStyle.js`, PHONE): the brand on top, the pane, the rail at the bottom. In that stack the mark is sized by
the screen's WIDTH - 59.5% of it, at its 1.63:1 - so a screen held sideways gives it at least half its height, whatever
the height is. The Ally X is a 1080p touch screen; at Windows' 150% the page is 1280x720, its pointer coarse, and the
mark stood about 762x467 px of 720, the Settings pane what was left. SHORT-TOUCH (Field-Bugs-2026-09-27e) had given a
landscape touch screen the desk's two columns back, but only under 560 px tall (the AYN Thor's 411): the Ally, taller,
was missed. A window narrowed under 860 px on a mouse took the same stack and the same strip.

**The fix.** SHORT-TOUCH's override reads every landscape screen 600 px wide or more that the stack would take - a
coarse pointer at any height, or a window under 860 px - and keeps the two columns there: the rail down the side, the
mark at the side column's width, the pane the whole height. A phone held upright (narrower than 600, or portrait) keeps
its stack, which is right for it. Nothing else in the rule changed.

**Measured.** `tools/shortTouchProbe.mjs` gains the Ally X's two screens (1280x720 at Windows' 150%, and 853x480 at
225%), touch on. Before: every door's pane at 1280x720 showed 166 px - the screenshot's strip - 6 checks failed. After:
every pane the full 720, every first button on the screen; every screen the probe holds passes.

**Pinned.** `test/ui/enhanced/shorttouch.test.js` +1 (TALL-TOUCH: both halves landscape, at least 600 wide, no height ceiling, the
narrow window's half bounded at 860); `tools/mutants/short_touch.json` +2 (the 560 ceiling back; the narrow window's
half dropped), 7/7 dead.
