# AUDIT FONT3 - the readable face, read before it merges (2026-10-02)

Mac: *"Audit this"*, of FONT3 (`64369501`, `10-UI/UI-Arc.md` FONT3 - the reading pair, the 11px floor, the lifted dim,
the body and the tokens on the pixel stack, the surfaces moved). Three lenses over that tree:

- **C** correctness and lifecycle - every new DOM line's way up and every way down, through the hosts that show it;
- **L** layout and the record - what a wider, heavier face and a higher floor do to fixed boxes, and every claim of
  the FONT3 record against the code;
- **B** the browser - the front door's panes measured in Chromium on the base tree (`53d46f0a`) and on FONT3, desktop
  1280x800 and phone 390x844, with the game's own font request fetched through the probe's route.

Every finding below was checked against the code before it was fixed. Pins: `test/ui/audit_font3.test.js`; each fix
carries an `AUDIT FONT3 <ID>` comment.

## What the browser said (B)

| Pane | Base (`53d46f0a`): text nodes by face | FONT3 |
|---|---|---|
| Features | 147 Pixelify, **299 Barlow, 1 Cormorant** | 447 Pixelify |
| Overhauls | 57 Pixelify, **10 Barlow, 6 Cormorant, 2 Grenze Gotisch** (never loaded - drawn in its fallback) | 73 Pixelify, 2 Jacquard 12 (the emblem, `--brand`) |
| Settings, Load Game, Online | all Pixelify | all Pixelify |

Same at 390x844. No text box clips that did not clip on the base (the phone Settings category strip scrolls sideways
on both). `tools/font1Probe.mjs` (the online surfaces, the 44px targets, the HUD's text surfaces) PASSES on FONT3.
`tools/enhancedMenuProbe.mjs` and `tools/featureRailProbe.mjs` FAIL - identically on the base tree: the boot's account
card (`.px-acctstage`) stands over the rail and takes the probe's clicks. Not FONT3's; recorded here, not fixed.

## Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F1 | med | Come Sail Away's map words stayed on screen after the map was put away in a dungeon or a building. The layer was hidden only by the window's `dispose`, and `csaMapClose` hands the window to `worldModes.closeSpellWindow`, whose interior arm nulls the slot and whose dungeon arm leaves the done-drain to `dungeonContext`, which nulls `activeOverlay` - neither disposes. The help lines and the marker colour then stood over the dungeon, and over the street after it. | `csaMapClose` hides the layer itself, and `csaUpdate` (every mode, every frame) hides it whenever no map is up; the hide is a no-op on a layer already down. |
| F2 | low | The held map's toolbar buttons lost their tracking: `.hmroot .hmtools button { ${PIXEL_FONT_CSS} }` (0,2,1) outranks `.hmroot .hmtool` (0,2,0), so the trio's new 0.5px replaced the tool's 0.12em while its balancing `text-indent: 0.12em` stayed - labels a pixel off centre. | `PIXEL_FACE_CSS`, the trio without the reading pair, for a rule on an element inside a surface that already wears it; that rule takes it. |
| F3 | low | With the quickslot diamond switched off and no hotbar up, a readied spell had no readout anywhere: the caption counted it as "doubled" by the spell chip, which `.nodiamond` hides. FONT3 took the dungeon's bitmap line, the only readout left in that setup underground (above ground there had been none). | "Doubled" only while the chip or the hotbar is naming the spell (`ui/enhanced/enhancedHud.js`). |
| F4 | low | The prison countdown was styled as a HUD line: `.hudmid` scales it by the HUD scale (7.5px at 0.5, under FONT3's own floor), it did not grow with the native panel the screen is drawn on (about 35px at 1080p in the classic face), and it wore the HUD's yellow, not the court window's. | `.hudmid.hudprison`: no HUD scale, the size off the panel (the 7-row cell at the panel's scale, a tenth under, never under 11px), `DAYS_LABEL_COLOR` and `DAYS_LABEL_SHADOW`. |
| F5 | low | `ENHANCED_PRISON_DAYS_ID` was inserted between `DAYS_LABEL_POS`'s doc block and its export; and a text layer honoured its document only on its first draw. | The id moved below the export; a layer is rebuilt in the document it is drawn into. |
| F6 | low | The body's trio is inherited by text that names another face: the FPS read-out, the boot error, the crash panel and the asset pickers' monospace arms drew unsmoothed (macOS) and tracked. The `injectEnhancedFonts` record still said the fallback was "Georgia and the system sans". | Those faces state `antialiased` and `letter-spacing: normal`; the record says monospace. |

**Layout and the record** (L - measured on the base tree and on FONT3 in Chromium with the real fonts, every text node
checked for clipping by an overflow ancestor, spill, a new ellipsis and its line count; the fixes measured again the
same way against the base, each now 0 regressions unless said)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| L1 | med | THE NAVAL PLATE'S BATTERIES. At the floor "STARBOARD" (11px, 0.12em, 500) measured 69.8px in a 62.7px box under `overflow: hidden` - its D on the border - and "12 great guns", "16 long guns", "2 chain shot" wrapped to two lines: each battery 29-30px -> 45px, the plate 256 -> 292px (161 -> 180px on a 740x360 phone, half the screen). | The rose's side margin 6 -> 3px and a battery's side padding 4 -> 1px; the side word tracks 0.04em; the count tracks none, at 400, its two spaces 2px tighter. All one line; the plate 267px (the larger text's own lines). |
| L2 | med | THE PARTY ROWS. `.dfparty-where` 9 -> 11px on a 1.2 line took an away seat's row 47 -> 50px and a seven-seat stack 343 -> 351px, past PARTY8's budget (`tools/partyHudProbe.mjs`: 48px a row, 350 a stack). | A 1.0 line and no tracking. A long name (`.dfparty-name`) tracks none too - it was cut before FONT3 and is cut 8px more by its row's own larger digits, not by the face. |
| L3 | med-low | THE HOTBAR ON A PHONE. The <=480px rule set the key and the count to 11px - no smaller than the desktop's - and in a 32px cell the corner labels' 13px line boxes covered 15-45% of the 24px face; the key letter sat on the icon in 5 of 10 slots (1 before). | In that rule the key, the count and the pip take a 1.0 line and no tracking. |
| L4 | low-med | Features: ten mod names ("Come Sail Away by RedRoryOTheGlen") wrapped to two lines at 1440x900 - Barlow to Pixelify - and the tile rows went uneven. | `.ft-tile-name` tracks none. The longest names still wrap at a phone's width, as they did. |
| L5 | low | Overhauls: the controller legend's one-line cells cut three more labels at 915x412; "Enhanced Plus" wraps. | Left: those cells already cut their longer labels on the base tree. Recorded. |
| L6 | low | The accessory shelves on a phone: "Amulets" newly cut (55 vs 52.3px), "Bracelets" and "Crystals" cut further. | Under 640px the shelf label tracks none; the rule stands AFTER the label's own, which the first cut of this fix did not (it lost on order). AMULETS and CRYSTALS whole; BRACELETS was cut on the base tree too. |
| L7 | low | The inherited 0.5px took two more chat roster names to an ellipsis and a five-digit Best 1px past the damage chart's 44px column. | The roster name and the chart's numbers track none. |
| C2 | low | `--dim` at FONT3's `#a39d8f` (6.40:1) was within a hair of the mid tone `#a89f88` (6.57:1): the dim and the mid read as one. | `#9a9486`, 5.72:1 - the pixel skin's dim word's level (`#9c937d`, 5.66:1), a step under the mid. Pinned: more than 0.5 under it. |
| C3 | low | "No text under 11px" was not true: the opening film's phone rules set its footer at 9px and Continue at 10px (the film was not one of the floor's sheets), and three 7px rules - the party card's effect word and rounds, the crew's - slipped under the pin's `v < 8` skip. | The film is a floor sheet, its two phone sizes 11px; the pin skips nothing by size, and names the 16px effect icon's own marks as the exception they are. The record says the floor is the declared size - a player's own scale under 1 draws under it. |
| C4 | low | FONT3's record said the in-game windows could not be seen in a browser without ARENA2. They can: this audit rendered them, as the repo's own probes do. | The record says so, and points here. |
| C5 | low | The patch notes said every Enhanced screen uses the pixel font; the book's pages and the map's lettering keep their serif on purpose and only the recovery code was named. | The notes name all three, and the fitted labels. |

**The probes.** `tools/font1Probe.mjs` PASSES on FONT3. `tools/partyHudProbe.mjs`'s stack check failed on FONT3 (351px) and passes with L2 (344px of 350); its three other checks (the 40px row, the digits, the place line) fail identically on the base tree. `tools/enhancedMenuProbe.mjs` and `tools/featureRailProbe.mjs` FAIL,
identically on the base tree (the account card over the rail) - not FONT3's, left for its own fix.

## Checked and fine (C)

The prison label's every way down disposes it (townTalk's done-drain, the font-less bail, `closeOverlay`,
`showOverlay`'s replacement, the death screen, `abandon()` on a quickload); nothing hides every label per frame; the
top is DFU's (`midTextTopPx(canvas, 165)`). The text layer's DPR arithmetic and z-order (6: under every dialog and the
death veil). The asset picker, the opening film (no new request on either skin - the front door made the same one),
the two inline cards (`pixelifyFive.js` is statically reachable from the entry bundle, so it cannot be the chunk that
failed), the pad prompt bar. No JS reads `--data` or `--display`; every canvas face names its family outright.
