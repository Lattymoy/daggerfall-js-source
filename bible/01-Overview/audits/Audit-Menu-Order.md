# AUDIT MENU-ORDER (2026-10-13) - the menus' pictures, audited

The owner, of MENU-ORDER (`10-UI/Menu-Order.md`: pictures before words on the decorator, the shop counter, the Stores
page, the board's Market and Vendors, the Reforge, the shipyards and a merchant's popup; MENU-ORDER g's refused presses
that say why, a model's and a ship's own picture, and a portrait phone's placing bar - the branch at e173414f): **"Lets
do a comprehensive audit and ensure perfection"**. This page is the findings, each with its verdict. What the audit
changed is written into the record's sections as they now stand, each marked AUDIT MENU-ORDER and its id.

## How it was run

Three lanes, each a cold adversarial reader of a FROZEN snapshot (a git worktree at e173414f - Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), each told to prove a finding against the code, a test or a browser before reporting it;
then the author's own lane, and every finding read again against the code by the author before it was acted on:

| Lane | Over | How |
|---|---|---|
| C - the code | every changed function in `src/` | line by line; ten repro scripts over the real modules and the pins' fakes (`toolRig`, the Stores provider) |
| R - the render and the runtime | the two picture passes, the panel bracket, the GPU's holds, the frame's order | the real `Renderer` in headless Chromium (SwiftShader): a world, a picture, a world draw after it, in seven render configurations (classic, a docked HUD, render scale 0.5 with and without, the lighting lane and its air with and without, lane and scale); timings of the pass, the copy and the encode |
| U - the screen and the record | every surface at 1440x900, 390x844, 360x640, 844x390, 932x430, 740x360 and 1024x768, both skins; the bible's claims, the pins, the mutants | Chromium over a scratch copy against the base (7d08de4b, `git archive`); computed styles at rest, hovered, held and focused; keyboard and touch; 43 scratch mutants |
| The author | the fixes | lane R's probe and lane U's probes run again over the fixed tree; every pin and mutant below |

Nothing harmed a save, a sale or a refusal: no refused press acted, no picture was ever committed. The findings are a
panel pass whose ground was the world behind it (since the bracket's birth: the bank's and the decorator's previews
too), passes drawn amid the world's that left their camera for the world's last draws, a picture encoded on the main
thread's wait, a GPU hold the phones' fix was built to end, pictures lost or drawn again for good, a landscape phone's
catalogue a sliver, refused presses that looked live under the keys, and pins that held less than they said.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| R1 | HIGH | `renderer.js` beginPanelFrame drew its clear quad under the panel's own viewport - a screen quad's rect is the canvas's pixels, so it was squeezed into a patch rect/canvas of its size: every panel's ground was the world behind it, and a frame's second picture held the first's model (probe: 0 clear pixels, 2,460 of the world's; the second 12,738 of the first model's). Older than MENU-ORDER: the bank's preview and the decorator's had it | FIXED: the clear drawn under beginFrame's whole-canvas viewport, the scissor keeping it to the rect, the panel's viewport after it (the probe again: 2,460 clear and 0 world; 15,484 clear and 0 ghost) |
| U1 | HIGH | A landscape phone's decorator catalogue a sliver: the filters folded on a narrow screen only, and every line stood open on a short one (844x390: 36px of list, the base's 107; 740x360: 14px; 932x430: Place below the side's edge) | FIXED: a short screen (`max-height: 500px`) folds them too - 136, 106 and 214px, Place in view at 932x430 |
| R2 | MED | The world drew the ships' pictures (and the yard decorator's preview, since HOME-YARD) amid its own pass: a panel pass is its own beginFrame, which alone uploads the mesh program's camera and light, so every world draw after it (the arrows, the banners) drew through the picture's camera; under the lighting lane or a render scale it resolved the world's image early and the rest drew with no depth; a screenshot taken after held the picture | FIXED: both drawn after the frame is shown and its shots are taken. KEPT: the bracket gives the program's uniforms back to no one - the law is that a panel comes after the world's last draw, pinned for world.js; the interior's preview already follows the room's last 3D draw (the hand's) |
| R3 | MED | `toDataURL` waited on the GPU for the whole frame's work, a stall each picture (8.7 s in SwiftShader with ten draws queued; the encode alone 2 ms) | FIXED: the copy taken in the frame, the encode the browser's (`toBlob`, a blob's URL); a canvas with none encodes at once |
| R4 | MED | A tile's model loaded through the pinned door: every model of a catalogue scrolled through stayed on the GPU for the session, past PLACE-LRU (the phones' memory fix) | FIXED: through a place's hold of the panel's own (`thumbHold`, `holdPlace('decor-thumbs', ...)`), let go when the panel goes; a model the preview already holds is drawn as it stands |
| C1 / R5 | MED | An ask aged by the wall's clock while the panel was down (a piece placed for half a minute), and its null was kept for the session: those tiles a glyph for good | FIXED: nothing ages while the panel is down; one asked under a room since left is let go then |
| C2 | MED | The Stores page read "Here" off a press in the section: at a forge with nothing to temper the temper said Away, and the word a last piece tempered or disenchanted left there was hidden | FIXED: Here is the provider's own word (`STATION_AT` - its station here, or none) |
| U2 / U3 | MED | A refused press sank when held and lit when focused, as a live one (the kit's held and focused presses outweighed its grey, on both skins) | FIXED: the grey under the window's own frame, at rest, hovered, held and focused; focused, a ring of its own grey (computed in Chromium, both skins, desktop and phone) |
| U4 | MED | Pressing a refused press dropped the keys' focus to the page: its window drew itself again | FIXED: the note alone drawn again; where the Reforge must draw again (an ask let go), the press is found by its name and focused |
| U5 | MED | Four of the Reforge's nine refusals (imprint, extract, unset, set) had no pin that pressed them: dropping their `refusePress` let the press act | FIXED: each pressed refused in `loot10_codex` and `loot20_sockets` - nothing done, the whole reason said; mutants |
| U6 | MED | A model's picture sat 7px right of its tile and was cut: the letters the tile keeps pushed it in its flow | FIXED: laid over the whole tile |
| U7 | MED | The counter's List / Pictures switch squeezed a phone's title to 94px - the shop's name six lines, the lists 80px shorter | FIXED: on a phone the title has the header's first row; the switch and Close the second (title 342px, two lines) |
| U8 | MED | The glyphs rode the Plus sheet alone: the classic skin's Reforge tabs wore none; the sheet was unpinned | FIXED: in the base enhanced sheet every enhanced window lays; pinned |
| C3 | LOW | A house entered again builds its texture table anew, so every model's picture was drawn again and the last visit's kept: memory grew a visit at a time | FIXED: a table is named by the law it is built in (`markRemapLaw`, climate and season - world/texRemap.js); the pictures are kept by that name |
| R6 | LOW | A picture was lit by the world's lanterns, moon and walls - and kept for the session (a ship drawn by night stood blue) | FIXED: the pass's own studio, none of the world's lights; the bracket gives them back |
| R7 / U12 | LOW | Pictures drawn at half the size they are shown | FIXED: a tile's 152px (its 76 at twice), a ship's 480x240 |
| C4 | LOW | Images waited on a picture there was none of, a list grown at every redraw; the shipmaster's likewise with no host to ask | FIXED: an image waits only on a picture in flight; a refusal empties the list as an answer does |
| C5 | LOW | The vendor board asked each row's picture with a closure of its own: a picture landing woke the board up to eight times | FIXED: one wake |
| U9 | LOW | The refused grey's pin read its selector alone | FIXED: its colour, border, ground, band and stillness read |
| U10 | LOW | The Port-Ledger row said 47 mutants and "never kept anywhere else" | FIXED: the count, and kept for the session by the host that drew it, never committed |
| U11 | LOW | A portrait phone's view tabs scrolled - "Your things" and "Built in" off the screen | FIXED: they wrap again; the rooms scroll |
| U13 | LOW | CSS the record claimed, unpinned (a phone's page tabs two by two, the empty strip's hint, a ship picture not yet come) | FIXED: pinned, mutants |
| U14 | LOW | The switch and the Market's views under a finger's 44px | FIXED: 44px on a coarse pointer |
| U15 | LOW | A refused press's name dropped the word it shows (WCAG label in name); the away tiles and the Filters fold said nothing of their state | FIXED: its name starts with its word; `aria-expanded` on both |
| R8 | LOW | The ships' portrait boats are never torn down | KEPT: five boats a session at most, never on the water; the pool's own meshes are kept the same |
| A1 | LOW | The author's own: C4's first fix read "in flight" off the waiting list, which a redraw empties - a picture asked before a redraw never landed | FIXED before it left the branch (MENU-ORDER's pin caught it): an explicit in-flight set |
| A2 | LOW | A yard's model is put in its town's climate (`prepareModel`) through the pinned upload door - its preview's since AUDIT 05b, its pictures' now: those swapped textures (the town's own keys) outlive the town | OPEN, not MENU-ORDER's alone: the yard's prepare through its pixel's hold, its own slice |

## Pinned

`test/ui/menuorder.test.js` (12): AUDIT MENU-ORDER the passes (R1 a recorded GL; R2 world.js's order; R3 and R6 the
studio and the browser's encoding; R4 and C1 a hold of the panel's own, let go, and an ask that waits out a closed panel;
C3 one law, one picture) and the screens (C2, C4, C5, U1, U7, U8, U11, U13, U14, U15); test 8 rewritten for U2-U4,
U9, U15. `test/systems/loot10_codex.test.js` and `test/systems/loot20_sockets.test.js` press the four refusals (U5). PINS MOVED: a
refused press's name (`set7_broker`, `fb1012d_salvageclassic`), the model picture's rule (menuorder 9), WM3's import
of the remap seam (`windmillclimate`). Mutants: `tools/mutants/menuorder.json` - the audit's 39 records and 12 re-aimed by
content, 51 run, 51 dead (one survived its first run - C3's pin read a commented line as the line; anchored, dead); the
whole file, 135, run again and dead.
