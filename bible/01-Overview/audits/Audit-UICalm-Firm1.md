# AUDIT UICALM-FIRM1 (2026-10-14) - the quiet pass and the Firmament, audited

The owner, of the branch that brought UI-CALM (`10-UI/UI-Calm.md`, the front door, the walk, the HUD, the Settings
screen) and FIRM1 (`06-Systems/Firmament.md`, the passive tree, its service and its window) together: **"Lets do an
audit on everything"**. This page is the findings, each with its verdict. What the audit changed is written into the
design pages' sections as they now stand, each change marked AUDIT UICALM-FIRM1 and its id.

## How it was run

Five cold lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at c9cd12949, per Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), each told to prove a finding against the code - by running it or by rendering it -
before reporting it; then every finding reproduced again by the author before it was acted on, and every UI fix proven
again in Chromium on the fixed tree:

| Lane | Over | How |
|---|---|---|
| L1 - the law, the sky and the powers | `firmamentLaw.js`, `firmamentTree.js`, `firmamentPowers.js`, `firmamentLive.js`: every channel against its words and its cap, the prices, the carries, the duel and the mentor, the sail, the seat | the real law, fold and damage door driven in node (`verify1/*.mjs`: the budget, a keystone's price, the carries, the mentor, the orphans, the sail, the seat) |
| L2 - the service and the client book | `server-account/src/firmament.js` and its callers, `firmamentBook.js`, `accountClient.js`: the switch, the ids and repeats, the respec's gold, the retries, the delete, the trades' XP | the real Worker over node:sqlite with every migration applied (`test/accountDb.mjs`), the real book and door |
| L3 - the front door and the walk | UI-CALM sections 1, 2, 4 and 7: the two questions, the foot, the book, the class stage, the map, the confirm cards, the shell's rail | Chromium at eight sizes, both dresses, English and German (and a DFU translation pack's class names) - every door scrolled into view and tapped |
| L4 - the HUD, the saddle, the Firmament window and the words | UI-CALM sections 3, 5 and 6, `firmamentWindow.js`, every new English line and thirteen languages | Chromium at 360 and 1280 px, touch and mouse, both dresses; the l10n scan |
| L5 - pins and records | the gates, the committed mutants, what the pins cannot fail, the record against the code | scratch mutants of the arc's lines against its suite and wider ones, the lists the branch moved, the gates |

No lane found a way for the sky to act for anyone but its own holder, a change charged twice, or a refereed fight the
sky reached once the fixes landed. The findings are a budget that let raw points and shares stack past the design's
numbers, a keystone price a capped build never paid, a service whose switch did not reach the trades, a request id
reused for another tree, a respec that cost a non-realm character nothing, a front door whose foot stood over its own
doors, a Firmament no phone could use, and pins that held less than they said.

Severity: **High** loses play, a purse or the door for many; **Medium** a wrong outcome for some; **Low** a nit, a
cost or a word.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L1 H1 | HIGH | A key star's raw points and a small star's share were two channels with two caps: +21 Strength, +86 Health against the budget's "+15, +75" | FIXED: raw and share one budget a channel (`capAt` in `firmamentPowers.js`) |
| L1 M1 | MED | A mastered skill's share was of its raw stored value (200), not what the game reads (140): +53 for +15 | FIXED: held by the same budget |
| L1 M2 | MED | A battle keystone's price was summed into its channel before the cap, so a build past the cap paid nothing | FIXED: the gains capped, then the price paid - per channel (`treeStats`, `PRICES`) and per group at the blow and the cast (`blowPct`, `castCostPct`) |
| L1 M3 | MED | A siege and the Wrothgarian zone keep the sky against players; the headers said `sigilDueling` covered the siege | KEPT, recorded: they keep the pace and the price as the loot and the sets do; the headers corrected |
| L1 M4 | MED | One damage-taken carry was shared by blows and spells of opposite signs: a lighter spell landed harder | FIXED: one carry a channel |
| L1 L1 | LOW | The sail's star did nothing under the Classic helm | FIXED: `firmSail` under either helm (`comeSailAway.js`) |
| L1 L2 | LOW | The sky stayed awake the frame mentoring started (the fold, the layer, the windows) | FIXED: `setFirmamentMentoring` from the party frame - the whole sky sleeps at once |
| L1 L3 | LOW | Taking the seat back never read the book again | FIXED: `takeSeat` reads it |
| L1 L4 | LOW | A star cut from the start stayed in the row, with the stars that reached through it | FIXED: `unpackTree` drops every star no longer joined (`reachFrom`), free |
| L1 N1 | NIT | "302 combat stars" counted the seven free starts; the pin counts were stale | FIXED: 295 to buy; the counts recounted (L5 L1) |
| L1 N2 | NIT | Craft points pay the walk to combat stars through the r400 ring | KEPT, recorded in the design page: the ring alternates its gates by design |
| L2 M1 | MED | A change confirmed while a respec was on its way was parked and sent after the player's next one, laying the old plan over the new sign | FIXED: no change is taken during a respec (`firm-busy`); the window's Accept waits |
| L2 M2 | MED | `send()` reused a kept change's id for a newer tree - a kept change that had landed answered the new tree as its repeat | FIXED: an id names one tree on both ends (the book mints a new one; the service refuses another tree under a made id, `firm-rid`) |
| L2 M3 | MED | The Worker's own `rate` and `maintenance` refusals dropped a kept change | FIXED: kept and asked again (`UNHEARD`) |
| L2 M4 | MED | `FIRMAMENT_OPEN` shut `/state` alone: a closed sky still gave the trades their yield and XP | FIXED: the switch is the tree's whole hand (`firmStatsFrom`); a shut read leaves no tree in force |
| L2 M5 / L5 M2 | MED | `wrangler.toml` shipped `"on"` under its own "Shipped at dev" | FIXED: `"dev"`, as the record said - then opened at the merge, the owner's word ("switch it on for players"): `"on"`, the config, its comment and the design page saying it together (FIRMAMENT-ON) |
| L2 L1 / L5 H6 | LOW | `/respec` for a non-realm character charged nothing on the service | FIXED: `realm-needed` on both ends - online play is the realm's |
| L2 L2 | LOW | A realm character's delete left its sky's rows | FIXED: `deleteRealm` takes them |
| L2 L3 | LOW | The temper's XP took no hand of the tree | FIXED: `scaleXp` as the anvil's. KEPT, recorded: the motherlode's and a writ's XP (their own routes, unscaled by design) |
| L2 L4 | LOW | A kept change refused on its retry was dropped with no word | FIXED: the refusal said (`read()`) |
| L2 L5 / L4 L4 | LOW | Fifteen refusals read "The stars refused." | FIXED: the account's own words where the window has none (`accountRefusalText`) |
| L2 N1 | NIT | The Firmament migration's index is read by no statement | KEPT: the migration may already stand on a test server; a later migration may drop it. (Written as 0113, renumbered 0114 past main's `0113_lamp_title` at the merge - MIGRATION-PREFIX) |
| L3 H1 | HIGH | The foot's two new plaques wrapped it past the stage's fixed reserve: on phones, landscape, 1024x600 and a German desk, a tap on Offline, Load or Back opened Settings | FIXED: the foot says its height (`--px-foot-h`, measured) and the stage ends there; a phone's and a short screen's plaques share one row. 224 door checks take their own tap |
| L3 M1 | MED | The Grimoire book's leaves broke on short, wide screens ("Thine Own Tale" into "Offline", 932x430) | FIXED: the book wants 561px of height (`BOOK_MQ`) |
| L3 M2 | MED | A double click on Offline opened Load Game, drawn under the pointer | FIXED: a double click's second click is no door's |
| L3 M3 | MED | The class ways vanished under a translation pack (keyed on the shown name) | FIXED: by the career's own key |
| L3 M4 | MED | "Begin your life" ran off a phone's screen | FIXED: the bar wraps, the way on keeps no floor |
| L3 M5 | MED | A waiting way on was still greyed to nothing (1.46:1) | FIXED: an ink of its own (Plus), 0.85 (Grimoire) |
| L3 M6 | MED | The map's plates were laid once; a late face widened them and they left the map | FIXED: every plate watched, laid again as it grows |
| L3 M7 | MED | On a phone the confirm card's presses stood a screen below | FIXED: the sheet bounds the card |
| L3 M8 | MED | The Grimoire's phone rail was unreadable ("Main menu" 1.29:1) | FIXED: the rail is its page; its word the deep red whole |
| L3 L1 | LOW | Escape lost the keyboard's place | FIXED: back on the door it came from (`focusDoor`) |
| L3 L2 | LOW | "Health: up to N a level" undersold the roll | FIXED: "N/2-N a level, more with Endurance" |
| L3 L3 | LOW | Words under the 12px floor (All off, Reset, the pool heads, a phone's map names) | FIXED: 12px |
| L3 L4 | LOW | A phone's rail head took a door's slot | FIXED: a row of its own |
| L3 N1 | NIT | Settings and Overhauls backed out to the two questions from the offline level | FIXED: they keep the level they were opened from |
| L3 N2 | NIT | "Play as a Acrobat" (before this branch) | FIXED: an Acrobat, an Archer |
| L3 N3 | NIT | Tutorials and Screenshots were English in every language (before this branch) | FIXED: `RAIL_TEXT` |
| L3 N4 | NIT | The walk's "DFO Online" under "New Character" offline; the class stage's way on in its card; the Grimoire phone's "Back to the list" at 1.35:1 (before this branch); a class with no description chosen without drums | KEPT: "DFO Online" is the game's name, not the mode; the class card's press is its reading, not the stage's way on. OPEN: the "Back to the list" ink and the silent pick, small and older than the branch |
| L4 H1 | HIGH | The Firmament could not be used on a phone: its bar half the screen, the say box and hint over the sky, a finger's tap learning before it read | FIXED: the bar inside the gutters, the sky under it, the say box and hint take no taps, a finger's first tap reads |
| L4 M1 | MED | The saddle panel's setting was overridden by any earlier F2 | FIXED: an F2 press is kept with the choice it was made under |
| L4 M2 | MED | On touch the saddle covered the compass | FIXED: under the compass's band, held above the hotbar and vitals (`placeTouch`) |
| L4 M3 | MED | The calm HUD hid the vitals while the HUD was arranged (split bars) | FIXED: never while arranged (`hudArranging`) |
| L4 M4 | MED | The overlays' close (the QuickDial's key) threw unaccepted stars away unasked | FIXED: it asks, as Escape does. KEPT: Tab is the QuickDial's, not focus's |
| L4 M5 | MED | A birthsign alone could never be accepted | FIXED: a change |
| L4 M6 | MED | The pause window's tabs ran off it in several languages | FIXED: they wrap |
| L4 M7 / L5 M6 | MED | Three docs said the saddle panel shows while the mouse is free; the code reads the key | FIXED: the docs say the key's law |
| L4 M8 / L5 M1 | MED | New player-facing English bypassed `t()`; the L10N4 ratchet was raised with no marker | FIXED: the saddle's notes and the Renown rise translated (12 keys, 13 languages), the ratchet's rises written down. OPEN: the Firmament window's, tree's and law's English - the owner's translation pass |
| L4 L1 | LOW | The arrow keys pushed the sky out of sight | FIXED: held in sight |
| L4 L2 | LOW | Enter on a focused press was hijacked | FIXED: a press's own |
| L4 L3 | LOW | A respec with no answer said it would be resent | FIXED: it says to look again |
| L4 L5 | LOW | The Grimoire's saddle key labels at 1.09:1 | FIXED: a page press's key in page ink |
| L4 L6 | LOW | The Stable's stepper spilled past a Grimoire phone's card | FIXED |
| L4 N1 | NIT | One point lost at 300 kept the vitals asleep | FIXED: a whole point wakes them at any maximum |
| L4 N2 | NIT | The desk bar wrapped to three rows | FIXED with H1 |
| L4 N3 | NIT | French and Bulgarian mixed their registers | FIXED: formal |
| L5 H1-H6 | HIGH | The switch tested on `/state` alone; a strike at a player, the hosts' "offline no sky", the service's yield hand, the combat channels and the respec's charge unpinned | FIXED in the pins, by execution |
| L5 M3-M5, M7, M8, M11 | MED | The budget's numbers read back from the table; no line-through-a-star check (the probe named by `vite.config.js` absent); the saddle's DOM, the calm HUD's switches, the type floor and the service's guards unpinned | FIXED in the pins; `vite.config.js` names no probe the tree does not hold |
| L5 M9 | MED | The enhanced door's offline doors could go English with every test green | FIXED in the pins |
| L5 M10 | MED | A committed mutant record's pin was deleted, the record kept | FIXED: the retired temperature plate's CSS and its two records gone |
| L5 L1, L2 | LOW | Pin counts and Testing rows stale | FIXED: recounted |
| L5 L3 | LOW | Vacuous pins: tempui's corner, the 49-Star build that spent 35, uicalm's colour scope that read one property at a line's start - the class bars' dark and amber stood on the Grimoire's page | FIXED: the build walks the whole purse; the scope pin reads the sheet rule by rule; the bars each dress's own |
| L5 L4 | LOW | Comment and number drift | FIXED |

## Pinned

`test/systems/audit_uicalm_firm1.test.js` (33) - every FIXED finding above: L1, L2 and L5's service and powers by execution
through the real Worker, door, book, law, fold, damage door and ship scene; the saddle panel and the calm HUD driven;
the Firmament window, the front door and the walk as text pins (they want a canvas and a screen - each fix proven by a
Chromium probe on the fixed tree, none committed). Mutants: `tools/mutants/audit_uicalm_firm1.json` (133 - each fix
reverted, and the survivors lane 5 found re-aimed), every one dead but the saddle's early return while hidden, recorded
equivalent. PIN MOVED (AUDIT UICALM-FIRM1): `firm1_law`'s budget build, `uicalm`'s vitals rest, Escape and colour
scope, `tempui`'s retired plate, `l10n4_hardcoded`'s ratchet, `load1_loading`'s Screenshots plaque. Records re-aimed
where the fixes moved their lines: `craft4.json` (the temper's XP), `csa_wind.json` and `sailfree.json` (the sail's
`firmSail`), `firm1.json` (the blow group's gain and price), `uicalm.json` (the vitals rest) - each list re-run, dead;
`tempui.json` lost the two records of the retired plate.
