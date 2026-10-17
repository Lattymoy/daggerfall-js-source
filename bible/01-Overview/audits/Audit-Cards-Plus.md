# AUDIT CARDS-PLUS (2026-10-13) - the card tables in the Enhanced Plus kit, audited

The owner, of CARDS-PLUS (`11-Multiplayer/Tavern-Cards.md` section 38: the two card tables' panels and the Collections
page's card controls in the Enhanced Plus kit and the game's face, Iliac Hand's table redrawn, its new words in the
player's language - PR #869, the branch at a23c69cca): **"audit everything"**. This page is the findings, each with its
verdict. What the audit changed is written into the record's sections as they now stand (section 38, and section 39
for the audit's own), each marked AUDIT CARDS-PLUS and its id.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN snapshot (a git worktree at a23c69cca - Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), each told to reproduce every finding with a script or a browser before reporting it;
then every finding reproduced again on the LIVE tree before its fix:

| Lane | Over | How |
|---|---|---|
| A - the Iliac Hand model and painter | `ui/iliacTableHud.js` against real games, the host and the relay | 500 real offline games (873,367 checks, from both seats and a watcher's), the real host's presses through the DOM, the real relay Room through every online state; the card lab in Chromium at 1280x760 and 390x844 |
| B - the dress and the layout | the roles, the chrome, both panels' sheets, the Collections page's | Chromium over the card lab and the real Collections page: Enhanced Plus in all six colours, the classic skin, the DFO Grimoire dress; 390x844, 360x640, 844x390 and 640x360 touched; contrast sampled off the real grounds; every one of 16,870 UI rules matched against the panels |
| C - Hold'em, the binder, Collections, the lab, the probe | `ui/card/cardTableHud.js`, `cardBinderPage.js`, `collectionsPage.js`, `cardPanelKit.js`, `tools/cardPanelsProbe.mjs` | 984 model states and 2,394 presses compared against the base (57a214095); pixel ratios 1 to 3; an instrumented probe |
| D - the localization and the scan | the routed words, the thirteen languages' drafts, the meta records, `tools/l10nHardcoded.mjs` | every draft read in its UI context against its language's glossary and rows; the meta re-hashed with the pipeline's own hash; the scan run old and new over the whole tree and over adversarial strings |
| E - the pins, the mutants, the record | `test/ui/cardsplus.test.js`, the moved pins, `tools/mutants/cardsplus.json`, the bible, the PR's description | mutants written for every claim a test title makes, run against 59 card and kit suites; every doc line checked against the code |

Around the audit the branch took main twice: before its fixes #867, #860, #847 and #872 (the Localization arc's next
batches, the Eltheric Ocean, MENU-ORDER), and after them #866, #873 and #875 (RAIN-HOURS and RAIN-HEART,
QUEST-SHELF-MAIN, MINE-PERKS). The conflicts were the bible's running records (both sides kept, the counts taken again
on the merged tree), the warn role's list (main's two presses and the concession, all kept) and the locale tables -
the English catalog regenerated from the source, each language's rows and records merged key by key in the catalog's
order as the drafting tool writes them (no key changed on both sides), each glossary main's terms and then this
branch's; never by hand.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A1 | HIGH | A relay's garbled `turns` or `room` grew the painter's new rows without end: 2,000,000 places took 38 s to paint one board (the gems and the backs were capped; the pips and the empty places were not) | FIXED: the track at `ILIAC_TURNS` and a lane's places at `ILIAC_ROOM` at most, as the gems and the backs. RECORDED: the client's view check (`net/iliac/iliacTable.js` viewOk) still bounds neither - that module rides in the relay's bundle, so bounding it is a RELAY_VERSION of its own (SLAM8), the relay's next change's |
| A2 | MED | On a phone each card in a full lane or the tray covered the power of the one before it (7 of 17 badges, 5 of 6 printed shields) and the duel lost its side words ("21 - 22", nobody's) | FIXED: nothing overlaps - a lane is a grid as wide as its plate (two by two on a phone), the tray wraps; a number travels with its side's word, the two stacked on a phone, theirs over their lane |
| A3 | MED | AUDIT CARDS-6 E19 again: online, before a game was dealt, the panel drew a turn track at 1 of 6 and an empty opponent | FIXED: the model's `dealt`; no turn, opponent or board until a game is on the cloth |
| A4 | MED | In the folded panel a keyboard Clear (or an online Commit) handed the keyboard to a hidden card, so it fell to the page - where Space is the game's jump, and a jump stands the player up and concedes | FIXED: the keyboard goes only to a control that took it, the panel last; Space and Enter on the panel are the panel's |
| A5 | LOW | A game ended early lit all six pips under "2/6" | FIXED: the turns it reached |
| A6 | LOW | A watcher got the players' "No contest" banner | FIXED: a watcher's end is said in the line - turned away at the top of `iliacOutcome`, before the session's word is read; the result's own watcher check below it, unreachable then, was taken out (CARDS-PLUS's CP-watcher-end survived on the final tree: no pin could fail a check that could not fire) and its record retired, the law the new guard's (CP-A6-watcher-verdict, failing both the model's and lane A's tests) |
| A7 | LOW | A watcher's plates said yours and theirs | FIXED: no plate edge for a watcher; the duel's lit number says who leads |
| A8 | INFO | Your own face-down card was painted face up with no mark (the base painted its name, unmarked too) | FIXED: veiled - its text never runs, the other sees its back |
| A9 | INFO | A watcher of a game's last board reads the current sitters' names; a watcher's presses follow seat 0's commit | RECORDED: both before CARDS-PLUS (RemoteIliacTable.view, the actions) |
| B1 | HIGH | Under the DFO Grimoire dress every state the panels mark was erased - a target, who holds a holding, the power ahead, your seat, the one to act, the winner, a card's raised or lowered power, an empty place, the keyboard on a holding, the concession's hover, the binder's short card: the dress repaints the roles and re-says the panels' sheets in its ink, outweighing every state | FIXED: the dress re-says each in its own colours, as it re-says the HUD plate's levels - the chosen role's deep green for yours, the pack's red for theirs, a lead a bar inside the plate, a target a ring outside it, gold leaf on wood for the power ahead, the badges as printed, a hollow for an empty place, a red ring for the keyboard, the words on the page in its ink; and every warn press under the dress now answers the pointer and the keyboard |
| B2 | HIGH | On a landscape phone (the orientation the game locks to) the Hold'em panel stood its header and its fold off the top, 131 px; the touch-sized presses made it worse | FIXED: the chrome bounds both panels by the screen's height, scrolling inside |
| B3 | MED | On Stone the new red words fell under AA (4.01:1, worst 3.43) | FIXED: `--cp-red`, lifted to `STONE_RED` on Stone |
| B4 | LOW | Under the dress the torn page's frame ran off the screen's edges | FIXED: the panels are its small windows |
| B5 | LOW | A target's brass hid who held the holding | FIXED: a target is a ring outside the plate; the plate's top edge stays the lead's |
| B6 | LOW | The pot's own edge outweighed the kit's chip | FIXED with C3 |
| B7 | LOW | The winner's seat lost its brass ground on five of the six colours | FIXED: each colour re-says it after its panel ground (`ui/enhanced/enhancedFrame.js` themeCss) |
| B8 | LOW | A choice that could not be made still lit and sank under the pointer | FIXED: it takes no pointer |
| B9 | LOW | The keyboard on a staged card showed nothing (its dashed line outweighed the focus) | FIXED |
| B10 | LOW | Hold'em's fold title stayed English | FIXED with D5 |
| B11 | LOW | "Every press, slider and field takes the face" - a slider did not | FIXED: every field and slider takes it |
| B12 | INFO | Folded seats and a disabled box's reason under AA; the concession 4.34:1 under the dress; a press's active nudge under the dress with reduced motion | RECORDED: the first before CARDS-PLUS; the others the dress's own laws, every page's |
| C1 | MED | Hold'em's seat states lost under the dress and the winner's ground under five colours | FIXED with B1 and B7 |
| C2 | MED | Under the dress the Collections page's chosen filter and part and its short card looked as the rest - the base marked all three | FIXED: the dress draws a tile's marks ABOVE its cubby's fill (an outline; the fill painted over every inset shadow, so every dressed tile's chosen, pointed-at and keyboard marks were unseen), the short card a red ring |
| C3 | MED | On a phone the pot ran off the board and the panel at a full table's showdown, 31 px | FIXED: the board wraps its pot; an edge in the panels' sheets is a width and a style, the kit's colour |
| C4 | LOW | A full table's panel stood its title off the top of a short window | FIXED with B2 |
| C5 | LOW | The probe proved less than it said: 100 of its 314 checks ran over nothing, and a little card back on the bare `.card` passed it | FIXED: every part it reads counted present; a gold table's note, a friendly game's, a full table at the river and at the showdown; a 360 phone, a short window and a landscape touch phone; each state's mark read against its rest in every look; the fold by what is drawn; no card over another; under the dress the face read as the dress's own stack (the base skipped the dress, whose stack ends in Georgia) |
| C6 | INFO | A copied face is painted at the screen's ratio up to 2 (the binder's cap); on the classic skin a card table asks for the web fonts | FIXED (words): section 38 and the Ledger's F6 row |
| D1 | LOW | The scan's selector rule read "press [E] when ready", "[locked] needs more gold" and "rank #1 player wins" as CSS, letting English past the ratchet (none stood in the tree) | FIXED: every part a compound of CSS identifiers (never a digit first) and a class among them |
| D2 | LOW | "17 port keys under `cards.iliac.`" (15, and the fold's 2); the scan's pins described cases the rule did not hold | FIXED |
| D3 | LOW | Norwegian: the spoken genitive in the ranked box's words | FIXED |
| D4 | LOW | Romanian: "Joacă împotriva" read cut off | FIXED: "Adversar" |
| D5 | LOW | The fold's "Hide the table" said the reverse of what the player sees | FIXED: "Collapse the panel" and "Expand the panel", both panels', routed once (`cardPanelKit.js` foldWords), its name to a screen reader too |
| D6 | LOW | No glossary took the terms the drafts settled | FIXED: the deck, the hand, a card game's turn, a turn committed, a ranked game, the panel, in each of the thirteen |
| D7 | INFO | The track's Magicka is DFU's own key: English until a Daggerfall Unity pack is installed; the panel's older words are still English; the scan's first test is quadratic on a long run of letters | RECORDED: the routing law's own choice, the routing batches' words, before CARDS-PLUS |
| E1 | MED | The classic-skin pin never read Iliac Hand's own dressing (Hold'em always came first) | FIXED: each panel alone on its own page, and both in either order |
| E2 | MED | "The duel's holder lit" was checked on turn one's empty board, where nothing is lit | FIXED: at an end where each side holds a holding |
| E3 | MED | No press was read for its kind | FIXED: the commit's brass, the quiet stand, the concession's blood, Hold'em's deal |
| E4 | MED | "The newest in view" untested | FIXED: the log's scroll read |
| E5 | MED | The touch presses 40px, under the 44px coarse-pointer law, and unpinned | FIXED: 44px, pinned |
| E6 | LOW | The fold's "the line and the presses kept" was never read (the probe's check could not fail) | FIXED: each panel's rules, and the probe by what is drawn |
| E7 | LOW | Where the copied face is drawn, and a pixel ratio of 2, untested | FIXED |
| E8 | LOW | One verdict word read in French | FIXED: all four |
| E9 | LOW | Two stale numbers in the record | FIXED |
| E10 | LOW | Test titles claiming what nothing asserted (a filter's mutant, the cut, the sweep's phases) | FIXED: the filter's mutant written, the cut read, the sweep over every state |
| E11 | LOW | The patch notes: every new word translated (the Magicka is DFU's), the fold new (Hold'em had one) | FIXED: the PR's description |
| E12 | INFO | Some mutants die for narrower reasons than their names; a watcher's tray, the fixed panel, a drawn end's tone and a chosen filter's paint unpinned | FIXED: pinned |

## What held

500 real offline games against the rules' own result law, from both seats and a watcher's (873,367 checks); the real
host's presses; the relay through every online state; the Hold'em panel's DOM and presses identical to the base over
984 states but for its renames; no class either panel paints styled from outside it (16,870 rules matched in the
browser); the classic cut exactly the panels' rules; every word in the pixel face (the dress's under the dress); the
routing complete, its English byte for byte, nothing read at load, the language never changing under an open table;
the thirteen languages' drafts and their records the pipeline's own; the scan's rule taking out the same five
selectors and no prose; a repaint about 5 ms at a pixel ratio of 2, and only on an event.

## Pinned

`test/ui/cardsplus.test.js` (11 - the audit's two: lane A's, lanes B and C's; the others extended), the scan's own test
(`test/systems/l10n4_hardcoded.test.js`), `tools/cardPanelsProbe.mjs` (1,690 checks over 105 pages). Mutants
`tools/mutants/cardsplus.json`: 82, all dead, on the final tree (CP-watcher-end retired with the check it mutated - A6). Records re-aimed by content: `auditcards6_b` (AC6-B10-fallback-hand,
AC6-B10-tab-walk), `fb1011_cardskept` (CP-fold-forgotten), and `cardsplus`'s own. The 127 older records aimed at the
files the audit changed (`ui/card/cardTableHud.js` 41, `ui/grimoireDress.js` 33, `ui/enhanced/enhancedFrame.js` 26,
`ui/iliacTableHud.js` 18, `tools/l10nHardcoded.mjs` 9 - 25 lists), run on the live tree: 127 dead.
