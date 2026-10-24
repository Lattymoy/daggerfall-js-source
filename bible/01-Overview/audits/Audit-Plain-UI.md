# AUDIT PLAIN-UI (2026-10-12) - plain words, audited

The owner, of PLAIN-UI (`10-UI/Plain-Words.md`: the Seat tab's What this is, next step, guide and words; How chapters
work; the Family tab's How it works; the regard on the talk panel; the board's type a step larger - a1388898): **"Audit
this"**. This page is the findings, each with its verdict. What the audit changed is written into the record's sections
as they now stand, each marked AUDIT PLAIN-UI and its id.

## How it was run

Four lanes, each a cold adversarial reader of a FROZEN snapshot (a git worktree at a1388898 - Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), each told to verify a finding in the code before reporting it:

| Lane | Over | How |
|---|---|---|
| W - the words | every new sentence a player reads, against the law that enforces it - client and service | each claim traced to its enforcing function in `src/net/`, `src/systems/legacy/`, `src/systems/livingWorld/` and `server-account/src/` |
| C - the code | the commit's `src/` | a browser-shaped `toggle` simulated over the fake DOM; every door a living body carries; the import graph for cycles; edge values through the badge |
| T - the pins and the record | `test/systems/legacy/plainui.test.js`, the moved pins, the records, the bible | 13 scratch mutants of laws the commit added; every fixture against the shape its producer mints (`readStandings`, `meritAsks`, `listWrits`); every doc claim against the code |
| U - the render | the board on both skins, the Family page, the talk panel | Chromium at 390, 1280, 1920 and 2560 px; eight readers of the Seat tab; long names on the tree; the badge in every standing |

No lane found a crash, a mechanic moved, or silver or gold touched: PLAIN-UI is words and layout. The findings are
words that told a player something false or half-true, a feature that worked only in the street, a fold whose memory a
browser broke, pins that could be switched off, a record that overclaimed, and what the render showed still small or
hard to find.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| W1 | HIGH | How chapters work said Merit "raises" Strength "up to 10 a week" - the law raises it 1 a week's mark (60 Merit for every hundred players active), brings a chapter above 50 back 3 toward 50 in a week short of it, takes 2 more from a Failing chapter short of twice the mark, and a Rivalry and a Season's end move it too | FIXED: the whole rule, every number interpolated (`STRENGTH_TARGET`, `STRENGTH_SHORT`, `CHAPTER_FAILING_FALL`, `CHAPTER_FAILING_MEETS`, `CHAPTER_EVENT_EFFECTS.rivalrySwing`) |
| W2 | HIGH | The Family page said an heir inherits the blood, the hearth and the estate - the blood and the hearth are a NEWBORN's, at birth (`addChild`); a living member who carries on takes the estate alone | FIXED: "What carries on" says each |
| W3 | HIGH | "any living member of the blood can be played" - a child, a retired elder, anyone in a fight or while a Succession waits cannot (`switchRefusal`, `successors`) | FIXED: a grown, living member, never in a fight nor while a Succession waits; a child once the line passes to them |
| W4 | MED | The Seat word Pledge: "Only what its members earn at that seat counts" - Breaches and Renown anywhere in the region count at the pledged seat (`seatInfluence.js` `countsAt`) | FIXED: the Watch, a home and seat writs in the seat's town; Breaches and Renown anywhere in the region |
| W5 | MED | The next step told an Officer of a guild pledged in its five regions to pledge here - the tab offers no lever (`leversNode`) | FIXED: the step says the guild is at its most |
| W6 | MED | The badge rounded the number and not the standing: a regard of 39.5 (a half day's easing, reachable) read "Known +40" beside "A friend from +40", and Courtship stayed hidden | FIXED: the number toward nought (`Math.trunc`); the slain household named among what lowers it |
| W7 | LOW | Sellsword "a player from outside a guild" - one of NEITHER guild in the battle (a third guild's may be one) | FIXED |
| W8 | LOW | The Merit cap read as one per account - it is per account per chapter | FIXED |
| W9 | LOW | A patron's members "pay Thriving prices" - the better of Thriving and the chapter's own, on training and spells | FIXED |
| W10 | LOW | The Has an heir chip is a Bloodline house's; a retired elder takes no line; a mantle passed may always take a newborn | FIXED |
| W11 | LOW | Children every 30 days "while you both live" - on the married member's own clock, while played; a child is a minor | FIXED |
| W12 | LOW | Smaller: the toll's ageless (a vampire or a werebeast), the heirloom grown at its rest beside its carrier's remains, the remains' gold cap, Defence's other terms, Influence's carry none past a Season's end, the chairs' account age, Tribute's cap, a guest's guild needing an account | FIXED, each |
| C1 | MED | The board's folds kept the reader's choice from `toggle` - a browser fires `toggle` for an `open` the draw set, so the drawn default was kept as a choice (a guild that then pledged kept the guide open) and a redraw's queued echo could undo a fold | FIXED: `boardFold` - the choice is the press on the fold's line (a click, Enter or Space), before the browser flips it; no fold listens to `toggle` |
| C2 | HIGH | The regard badge showed for the street's residents alone - a body's `living.town` is the door it was minted with (`travellerSprites.js`), and the indoor and the roads' doors had no card: a resident at home (the one being courted), a traveller, a diver below - no badge | FIXED: `_livingIndoorsDoor.regardCard`, `livingRoads.regardCard` (a company's word its head's, as its refusal reads) on `_livingRoadsDoor`; the FOUR HOSTS paragraph, which claimed it, corrected |
| C3 / T3 | MED | How chapters work folded for any member - the service sends a Merit row for every membership (`npcMerit.js` `meritAsks`: merit 0, a week's wait), so the newest member, who needs it most, met it folded | FIXED: open for a reader with no Merit yet in any chapter here |
| C4 | LOW | A reader the standings refused or had not reached was told nothing of the seat - the explanations waited on the answer | FIXED: What this is, the guide and the words drawn before it; the next step alone waits |
| C5 | LOW | The badge's words could crush the conversation on a short landscape screen | FIXED: held to 4.4em, scrolling |
| C6 | LOW | How it works with Legacy on and no house said nothing of why | FIXED: the no-house line |
| T4 | MED | `bound` is null until an account's first influence, and every fixture said `'g1'`: an unbound account sent "elsewhere" was a mutant no pin killed | PINNED: a `bound: null` reader earns here |
| T5 | MED | 13 laws the commit added survived every pin (the words' fold, the dd, the chapters' fold, the toll setting read, five sizes the record claims, the badge's press, its mark, its reset) | PINNED, each (`test/ui/audit_plainui.test.js`) |
| T6 | LOW | "every name the tab uses" - the Works, Fealty and Pacts were not in the list; "A tenth" and "0 to 100" typed | FIXED: both entries; `SEAT_LEGACY_SHARE`, `STRENGTH_MIN`, `STRENGTH_MAX` |
| R1 | LOW | Plain-Words.md: the words "said nowhere" (they were used, defined nowhere); the cap "said only when it refused" (the Merit line showed it); a party member "at their town's pixel" (where they stand); "on the classic skin the Chronicle's People page" (that page is the enhanced Chronicle's) | FIXED |
| R2 | LOW | Stale: Legacy-Arc 11 "three pages on the rail", Professions-Arc 10.11's present-tense guide "folded under one line", `seatTab.js`'s header order, `enhancedMenu.js`'s `famSec` comment | FIXED |
| U2 | MED | The next step pointed an Officer two or three screens down ("under Your guild, below"), never named the seat a pledge elsewhere is for, and gave deadlines with no time left; the no-guild line read awkwardly | FIXED: the pledge's own lever beside the step (`seatMayPledgeHere`, through the window's one door), the seat by name, "(in 2d 1h)" |
| U3 | LOW | A fold's line a 22px target on a phone, with the browser's ring | FIXED: 44px with its padding, a dashed brass ring |
| U6 | LOW | Four long given names in seven cut on the tree's plates at 12px | FIXED: two lines, the whole name on hover |
| U7 | LOW | The card at 300px left the tree three plates at 1280 | FIXED: 268px beside the tree, the whole width stacked |
| U8 | LOW | How it works was the rail's last page and the tab opens on the tree | FIXED: "New to the family? How it works" on the tree |
| U9 | LOW | The badge's words ran 150 characters a line on a desktop | FIXED: 72ch |
| U10 | LOW | Nothing said the badge could be pressed | FIXED: a "?" after the number, the name underlined under a pointer |
| U11 | MED | An Enemy or a Hostile resident refuses before any panel opens, so their badge - the one a player with a broken friendship looks for - was never seen | FIXED: the refusal says where they stand ("Mara turns away from you. (Enemy, -52)") |
| U12 | - | "Known" on someone just met | DECLINED: the Chronicle's People page's word for the same standing (one word, one thing), and a resident the panel opens on has been met - the talk is noted before it opens |
| U1 | MED | "Tiny" is fixed to about 1080p: the board stays 1040px wide, and at 2560x1440 its 15px type is smaller against the screen than the old 13px at 1080p; the pause window and the talk panel do not scale either | OPEN, the owner's call: an Interface size row, MAP-SCALE's rule (`ui/map/mapScale.js`: Auto the screen's height over 1080, 1 to 2) laid over the board, the pause window and the talk panel - a new setting across windows, not a word |
| U4 | LOW | On a phone the board's Close takes a row of its own (the tabs end at y=181 of 760) | OPEN: BOARD-UI's header, older than PLAIN-UI |
| U5 | MED | The pixel face's B, C and 2 read as G, O and 8 at 12-15px ("Greton Gard", "UTO", "8,000" for "2,000") | OPEN: the face's, older than PLAIN-UI - FIX-D's Silkscreen five shows the way (`src/ui/pixelifyFive.js`); TEXT-FONT (`src/ui/textFont.js`, met at the merge) lets a player write every enhanced word in a plain face meanwhile |
| U13 | MED | On the classic skin regard is shown nowhere (the classic talk face is DFU's window; the People page is the enhanced Chronicle's) | OPEN, the owner's call: the classic skin's own surface for it |

## Proof

- `test/ui/audit_plainui.test.js` (11): a pin for every FIXED and PINNED finding above.
- `tools/mutants/audit_plainui.json`: 31 mutants, 31 dead; `tools/mutants/plainui.json`'s 20 (four re-aimed by
  content), `audit657.json`'s D4, `board_ui.json`'s guide and `lw2.json`'s two talk doors re-aimed and dead again.
- PINS MOVED in `test/systems/legacy/plainui.test.js` (the words that changed), `test/ui/audit657_board.test.js` (D4 by the press),
  `test/systems/livingWorld/lw6c_keepsake.test.js` (the refusal before the moment, U11).
- `tools/noticeBoardProbe.mjs` on both skins, desktop and phone: every tab inside the viewport, nothing spilling.
