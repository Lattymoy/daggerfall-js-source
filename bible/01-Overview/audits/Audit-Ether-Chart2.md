# AUDIT ETHER-CHART2 (2026-10-12) - the chart of the Eltheric Ocean, audited

The owner, of ETHER-CHART2 (`03-World/Eltheric-Ocean.md` ETHER-CHART2: the chart's words in the enhanced face, a shape
for each kind's mark, the depths as waters, the haunts washed and named, the ship ringed and pointed to, the isle named,
the key - 3b2fcf551, merged with main in 0ef7d2cf9, PR #847): **"Audit and ensure absolute perfection and detail"**.
This page is the findings, each with its verdict. What the audit changed is written into the record's section as it now
stands, each change marked with its finding's id.

## How it was run

Four lanes. Three were cold adversarial readers, each working on a FROZEN snapshot (a git worktree at 0ef7d2cf9, per
Home.md's DO NOT FIX WHILE THE VERIFIER IS READING), and each told to verify a finding before reporting it. The fourth,
the render, was the author's, in Chromium:

| Lane | Over | How |
|---|---|---|
| C - the code | `ui/etherChartWindow.js`, its host's door, its producer's word | the model run in node over every corner and edge of the sea's box, the Veil, x1 - x16 and three canvas sizes; a captain of 4,096 isles timed; the window driven in Chromium (listeners counted, the fonts' promises after unmount, taps, drags, the zoom's ends) |
| T - the pins | `test/ui/etherchart2.test.js`, the moved pins in `test/systems/naval/auditcaptsea.test.js`, the mutant lists | the 49 committed records run; 109 scratch mutants of the laws the change added, 32 survivors re-run against 11 more suites; every fixture against `etherHost.chart`'s word; every existence assertion against a mutant |
| D - the record | the bible's lines, the module's comments, the commit and PR #847 | every number and name checked against the code and the tests; the old chart rebuilt to check what the record says it replaced; the doc gates run |
| U - the render | the chart at x1 - x16; 390 and 844 px phones, 1280, 1280x600 and 2560 desktops; the world's edge, the Veil at x16, the Abyss, every legend, an empty captain and one of 2,856 isles; the fonts' stylesheet held back | screenshots read by eye; WCAG contrast of every word and mark on every water; deuteranopia and protanopia simulated (Machado); repaints timed |

No lane found a crash, a leak, or a window left open: the listeners are added and removed in pairs, `draw` is guarded
once the window is gone, and the model is total over the sea's box. The findings are layout that let one thing stand
over another, a face that could stay the fallback, a window that did not fit a phone held sideways, pins that could be
switched off, and a record that overclaimed.

**The one restructure.** Three lanes met the same root from three sides: the chart's own words - the band names, the
Veil's, the scale - lived ON the map, so they fought the isles' names for room. In a crowded chart every band's name
gave way to a port's, a band whose bound lay off the chart was named nowhere, the Veil's name ran across the ship, the
scale's plate hid isles, and port names ran across it. The fix took them off the map (U2, U4): a DEPTH RULER over the
chart names each water in view, and the scale stands in the key. C3, C6, C9 and D1 were closed by that move, not by
patching each one.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| U1 | MED | The chart was a fixed `min(64vh, 640px)`: on a phone held sideways (844x390) the window's body scrolled 99 px, putting the key, the zoom and Ship under the fold | FIXED: the window is `min(92vh, 900px)` tall and the chart takes the room left (`ETHER_CHART_CSS`); the hint is set down under 520 px; no scroll at any of five sizes (`tools/etherChartProbe.mjs`) |
| U2 | MED | Band names and the Veil's lived on the map: in dense charts every band's name gave way to a port's, a band whose bound was off the chart (the Deep Aether beside the Abyss) was named nowhere, and the Veil's name ran down the middle of its strip | FIXED: THE DEPTH RULER (`ruler`, `paintRuler`, `RULER_WORDS`) names every water in view, west to east, centred in its own, the longest word that fits |
| U3 | LOW | At the world's edge the Abyss's water and the void were one black | FIXED: the edge drawn (`EDGE_LINE`) and the ruler names it |
| U4 | LOW | The scale's plate hid isles, and port names ran across it | FIXED: the scale bar is in the key (`paintScale`) |
| U5 | MED | The key's scale said "5 leagues" at x1 and x2: every zoom's bar is near 118 px, and the key was drawn again on its length alone | FIXED: its words are part of the key it is drawn again on |
| U6 | LOW | A haunt's plate took its first clear corner even when that corner hid isles (the Pale Regent's hid a ruin) | FIXED: of the clear corners, the one over the fewest marks |
| U7 | LOW | The ship's pointer's words covered the names of the cluster it pointed into | FIXED: six spots (inward, above, below, further in), the first clear, else the one over the fewest; laid before the lesser names (C4) |
| U8 | LOW | On a narrow screen a named isle's line wrapped to two, and the chart slid under the finger after all | FIXED: one line, its height held, cut short with an ellipsis |
| U9 | LOW | The named isle's card took one spot whatever stood there | FIXED: above to the east, then the west, then below; never over its isle; clear of names where a spot is |
| U10 | MED | A window opened before the fonts' stylesheet came stayed in the fallback face: `load` and `ready` answered at once with nothing to load. This was ETHER-CHART2's own defect. Reproduced by holding the stylesheet back 1.5 s | FIXED: painted again on every `loadingdone` while open; the late window's canvas is pixel for pixel a fresh one's (the probe) |
| U11 | LOW | The key's words were set after the chart was measured; a reflow drew it stretched until the next paint | FIXED: the key first; a `ResizeObserver` on the chart's room |
| C1 / T1 | HIGH | With every corner of her square taken, a haunt's plate went to the first corner anyway, over a port's name (25 of 594 phone-width views; 396 of 3,000 views of a full captain), against X14's "never a name over another" | FIXED: no clear corner, and her name alone over the square, or none |
| C2 | MED | Haunt plates (78% opaque) hid charted isles (725 of 2,288 views) | FIXED, in part: the clear corner over the fewest marks (U6). A plate may still stand over a mark where every clear corner does; the square's wash and the key say a haunt is there. DECLINED to drop the plate in that case: the name and the state are the plate's reason |
| C3 | MED | The Veil's name ran across the ship lying in the Veil on any chart under ~416 px | FIXED by U2: the Veil's name is the ruler's |
| C4 | MED | The pointer's words covered names in 16% of the views where she was off the chart, and fell under the scale | FIXED: U7; laid before the lesser names, which keep off its words and its arrow; the scale is off the map |
| C5 | MED | The held note line held one line; on a phone a long one wrapped and moved the chart 15 px | FIXED: U8 |
| C6 | LOW | A port's name, and the card, could stand under the scale | FIXED by U4 |
| C7 | LOW | The fallback side ignored the chart's edge: Aelishaven's name was cut to its "A" with its other side free | FIXED: a side on the chart before a cut one |
| C8 | LOW | A far haunt's lone name, held to the canvas, stood below or beside her square, in open water or in another legend's square (530 of 46,170 views) | FIXED: over her own square, or none |
| C9 | LOW | The Veil's name's spots were not checked against the canvas, the band plates or the scale | FIXED by U2 |
| C10 | LOW | The label pass scanned every isle's mark for every name: x1 with 4,096 charted ran 11-15 ms in node | FIXED: each mark's box made once, a port's name against the ports' marks alone; measured in Chromium, 2,856 isles charted, a repaint at x1 7.1 ms (9.7 before it) and 2-3 ms from x2 (the probe) |
| C11 | LOW | `repaint` refreshed the card but not the note line: with the ship moved, the two would give different leagues | FIXED: the note said again on every repaint |
| T2 | HIGH | The painter was almost unpinned: every mark grey, rocks in ink, one water for every band, the ship undrawn or turned the wrong way, the pointer mirrored, Veilhaven's ring, the bearing, the rings, the card, the washes and dashes, names drawn off their boxes, the key's marks - all survived | PINNED: a stateful stub watches `paintChart`, `paintRuler`, `paintScale`, `paintMark` and `paintKey` draw for draw (`test/ui/audit_etherchart2.test.js`) |
| T3 | MED | Nothing in node could see the model measuring in another face, case or tracking than the painter's | PINNED: a width that tells face, case and tracking apart; every name, plate, card, pointer and ruler word as wide as it is drawn |
| T4 | MED | A name's box was not held to its name (a west box 8 px short survived) | PINNED: every lettered box its name's width, on its isle's row, beside its isle |
| T5 | MED | The haunts' floor was never met in the fixture, and an unfiltered haunt off the chart would be named at its edge | PINNED: views that meet both floors; x16 about Veilhaven names none |
| T6 | MED | The layers' order and the side preference were mostly unpinned (a name over the ship's ring, a name cut off the chart) | PINNED: the haunts placed by the ports alone; each name where the law puts it, given what stood before it, over eleven views; Veilhaven's name west of the ship's ring |
| T7 | LOW | The card's title was not checked for X17's capital - the fixture named Veilhaven | PINNED: an isle named "the ..." |
| T8 | LOW | A mark's size by the zoom was checked at x4 alone | PINNED: every zoom |
| T9 | LOW | The X12 pin allowed a band's name past its bound; LABEL_CHAR_PX pinned a number, not its measurement; two assertions repeated others | FIXED: X12 holds each band's water bound to bound; the probe measures the constant and fails it. The repeats stand: they cost nothing and read as the law |
| T10 | LOW | The 44 px presses, their own size, the chart's role and name for a screen reader, the key's sharpness on a dense screen were unpinned | PINNED |
| T11 | MED | The record claimed more than the pins held (the colour on screen, the key's painter, Veilhaven's ring, the haunts' floor, "none over another") | FIXED: each is pinned now (T1-T8), and the rows say what is |
| D1 | MED | "the Veil's tries the bottom of its strip first" - it tried the top | MOOT: the Veil's name is the ruler's (U2) |
| D2 | MED | "every port of Veilhaven's waters is lettered at x2" - true only of the old 40-pixel view | FIXED: "every port within 40 pixels of Veilhaven", in the bible, the test's comment and the PR |
| D3 | MED | "the first corner that no name or plate takes" and the patch note's "always shown inside" - the plate fell back over a name, and at a far zoom her name stands above alone | FIXED: T1 in the code; the words say what is |
| D4 | MED | "Every word is drawn LAST ... under a hard halo" - the pointer, the card and the scale were painted after the names and placed nowhere; only names wore a halo | FIXED: the pointer and the card are laid with the names (U7, U9, C4), the scale is off the map (U4), and the words say "painted after every mark - each isle's name under a hard halo, the rest on plates" |
| D5 | LOW | "a ruin's disc stood in the middle of Old Nymuond" - it was a rock's, Halanth Teeth's, at x8 | FIXED |
| D6 | LOW | "stretches the Close and zoom buttons to a row each" - the Close took half the header, the zoom buttons shared their row | FIXED |
| D7 | LOW | "A NINE-PIXEL ARROW IN THE PORTS' GOLD" - sixteen pixels, a gold beside the ports' | FIXED |
| D8 | LOW | The patch note said band names, the scale and the Veil's label sat on plates and never met port names | FIXED: the patch notes rewritten to the chart as it now stands |
| D9 | LOW | The ETHER-CHART paragraph's band names "each on its own deeper side" and "LABEL_CHAR_PX, LABEL_H" held only in part | FIXED: the bands named on the ruler, each in its own water; each name as wide as its face draws it |
| D10 | LOW | The module's comments: "`paintChart` the one function that draws", the words' order, a band box "null where it gave way" | FIXED |
| D11 | LOW | 6.7 was the mean name by name (6.689; letter by letter 6.642), the sample unnamed, and no probe re-ran it | FIXED: the sample and both means in the record; `tools/etherChartProbe.mjs` measures them |
| D12 | LOW | The PR's "auditcaptsea 67" was 67 passed and one skipped of 68 | FIXED |
| D13 | LOW | The Port-Ledger's ELTHERIC OCEAN row lists no ETHER-CHART2; the four hosts unsaid | DECLINED for the row: it records the sea's departure, which the chart's presentation does not move, and no section C row concerns the chart. FIXED for the hosts: the section says no host is touched |
| D14 | INFO | FONT1: is the chart the held map's kind (its ink a recorded exception)? | KEPT, said: the chart is chrome in the naval sheet, which wears the pixel trio, not lettering on an inked sheet; a clause in the section says so |
| D15 | INFO | Testing.md's auditcaptsea row said 327 mutants; the list holds 331 (5 equivalent) - before this change | FIXED: the row says 331 |
| - | - | Contrast | SOUND: every word 6.9:1 or more on its halo or plate; every mark 3:1 or more on every band's water (a ruin's red on the Shallows, 3.48:1, the least), each in an ink outline |
| - | - | Colour-blind | SOUND: under deuteranopia a ruin's and a wild isle's colours fall to 1.36:1 - the shapes tell them apart, as the record claims |
| - | - | The surviving scratch mutants lane T judged decoration | DECIDED, not pinned: the void's tone, the halo's width, a plate's padding, the port's dot threshold, the land under a mark smaller than it, the band line drawn under the Veil's own, the tracking reset |

## The pins and the probe

`test/ui/audit_etherchart2.test.js` (16) and `tools/mutants/audit_etherchart2.json` (56 records). The records aimed at
`ui/etherChartWindow.js` across the four lists - auditcaptsea's 17, ethercross's 11, etherchart2's 24 and the audit's
56, 108 in all - all die. `tools/etherChartProbe.mjs` runs in Chromium what node cannot see, and exits 1 on a failure:
the mean letter, the window fitting at five sizes, the late face's canvas against a fresh one's, and a full captain's
repaint.
