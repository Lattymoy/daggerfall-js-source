# AUDIT EVENTS1 - the event board, 2026-10-23

The owner: *"Audit this"*, of EVENTS1 (`10-UI/Event-Board.md`, commits `f76654ac3`, `993680071`, `754eb63c7`) - the
event board on the HUD, its news, the one door every shared event's line goes through, and the star's earlier warning.
Four lanes read it cold, each with the repo read-only and its proof scripts in a scratch directory: the law and its clocks
(A); the HUD and its DOM, measured in Chromium (B); the seams and the behaviour change (C); and the records, the pins and
the words (D, its words findings W). Every finding was re-run against the tree before it was fixed. None was the owner's
to decide.

Each fix is pinned in the two EVENTS1 files, rewritten for it - `test/systems/events1_board.test.js` (13, the law: its
fixtures now minted by the producers themselves, starTimerRows and raidTimerList over a restored raid day) and
`test/ui/events1_board_ui.test.js` (9, the plate and the seams) - or in the pin it moved (`star6_words`, `sd2c_omen`,
`timers1`). Mutation-proven: `tools/mutants/events1.json`, 101 records (27 before; the stale ones re-aimed, one for every
mutant a test's title names - D8), every one dead; `star6.json`'s two records the audit moved re-aimed, its 25 dead.
Measured: `tools/eventBoardProbe.mjs`, 22 cases (both skins, eleven screens and settings each), 138 checks, all clear.

Severity is the lanes' own: **bug** a wrong thing a player sees; **risk** one that happens under a condition the
first cut did not meet; **doc** the record says what is not so; **test-gap** a pin that cannot fail; **nit** a word or a
cost. A finding several lanes made is listed once, under the first, with the others' ids.

## A - the law and its clocks

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | bug | **A news showed the wrong event.** A line that ends its event (a star's hold, a raid's cleansing or withdrawal) removes that event's row before the board takes it, so the news found its row by the town the line named, failed, and fell back to its kind's one row - another star's, another raid's. The town match was a substring, too: 20+ raidable towns share their region's name, 503 sit inside another town's name. (B4, C2.) | **A line carries its event's id** (`eventNotice(kind, text, id)`: a star's `star:<night>.<k>`, a raid's `raid:<raidKey>`), and joins only that event's news; a gate's, a serpent's, an Abyss Dungeon's or the festival's needs none (`EVENT_SINGLE_KINDS`: one event at a time). A line whose event has gone stands alone - its row never another's (`newsRowOf`). |
| A2 | bug | **The Abyss Dungeon's row never said how far or which way**: the host never handed its site, so the branch that measures it was dead. (C1, D4.) | The source hands `site: sdHost.hollow()?.site` (the line's own text changed, the host's ceiling kept); the row's way is measured off it. |
| A3 | bug | **Two stars in three were named 7.5 minutes before they fell, not 10**: starTimerRows named only the soonest coming star, and the night's falls are 7.5 minutes apart. (D3.) | **Every star** within `STAR_WARN_MS` of its fall is named with its town and pixel; the soonest beyond it without. Pinned through starTimerRows itself, two warned at once. |
| A4 | doc | **About one raid in eight came onto the board under 15 minutes before it started** (153 of 1,297 in 60 rolled days): a day's raids are rolled when the day turns, and those in its first quarter hour came with less notice than the record said. | raidTimerList **looks ahead**: within `EVENT_SOON_MS` of the day's turn it lists the next day's roll too (the roll is the day's own generator, so the day it rolls is the same). |
| A5 | risk | **A page opened mid-event announced what stood before it**: the board seeded its memory on the first read, but the stars' scan, the omens' places, the hub's Abyss Dungeon and the raids' roll all fill in later, and each looked new. (C3, D1.) | **The board watches from its first read**: every row says when its event came onto the board (`since`), and a row is news only if that is no earlier than `EVENT_SEED_GRACE_MS` (5 s) before the first read - however late the source fills in. |
| A6 | risk | **Rows for events no one can join stood as live with a distance**: the gate sealed (10 real minutes a day) and the Abyss Dungeon collapsing (3), each taking a row from a reachable star or raid. | The Timers window's rows say `shut` (the gate's `closed`, the Hollow's `fell`); the board leaves them out. |
| A7 | bug | **Lines joined news by kind alone**: a raid's line rode another raid's news, an announcement took a news holding another event's line, and a line joining a news near its end was shown for a frame. | Joined by event (A1's id); a line joining a showing news has `EVENT_NOTE_MIN_MS` (5 s) of its own. |
| A8 | nit | **The raids' region was the map's**, so a captain past the Veil was announced every Betony raid - AUDIT CAPTAIN'S SEA G7's bug, reopened. (C7.) | `raidRegionNow()` - the raids' own host's region (none at sea past the Veil) - is the source's `region`. |
| A9 | nit | **"N more in Timers" counted the event the news showed** (a region raid past the nearest two). (B10.) | The count is every event less the rows and the news's own. |
| A10 | nit | **The km had a seam at ten**: 9,966 m printed "10.0 km", a pixel further "10 km". | Tenths decided by the rounded value. |

## B - the HUD and its DOM

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | bug | **The news made the player's buffs vanish**: the status widget measured the board above it, and a news (twice a row's height) squeezed it to `stat-noroom` - at 1024x700 with six buffs, every news. | **The status widget never makes way for it** (`.evboard` out of `STAT_ABOVE`; `ui3.json`'s record re-aimed back). The board measures instead (B3). |
| B2 | bug | **The board never wore the HUD's scale**: `--hud-scale` is set on `.hud`, and the board, a body child, read nothing - at 1.5 the quick slots and the hotbar grew into it. | Copied off `.hud` each layout, as the loot banners do. |
| B3 | bug | **Windows 501 to about 620 px tall: the plate covered the quick slots, the hotbar and the vitals** - a fixed three rows plus news from a fixed top. | **The plate's place is measured** (`eventBoardPlace`): under whatever stands above its edge (the chat as it stands), never above its home; its room down to whatever crosses its span below (a bar reaching past its top included - found by the probe, a phone on its side); on the classic skin, over the canvas vitals' foot. A row fewer until it fits; where not even its news fits, the news is said on the HUD's line and the plate stands down. The fixed short-screen rule is gone. |
| B5 | bug | **The chat covered the plate, or the plate the chat**: a widened peek, an open chat, the short-screen news drawn over an open chat's input. | Part of B3: the open chat and an open Social panel are what stands above it. |
| B6 | bug | **The HUD editor's piece could not be seen once an event had come and gone**: the plate stayed on the page as a 300x0 box, so the editor made no ghost. | The plate is off the page while nothing stands on it (its memory kept), so the preview stands in; the preview's words in the player's language. |
| B7 | risk | **The news's clock was read out every second** (it sat in the polite live region), and the first news was likely not spoken at all (the region was made with it). (D2.) | A visually hidden, atomic live region made once, written once a news (and again only when a line joins it); the plate `aria-hidden`. |
| B8 | risk | **The editor's X lost every line**: a plate hidden there still took the lines. | The piece put away under Enhanced Plus counts as the board off: the lines go where they went before. |
| B9 | nit | **Switching the board off forgot only a board that had built its plate.** | Off always forgets. |
| B11 | nit | **Under the Grimoire dress the text was smeared**: the shadow sat on the wrapper the inker does not read. | The ink and its shadow on `.evboard`, the surface a dress inks. |
| B12 | nit | **The retro pillarbox on the classic skin**: `--ui-pillar` is written by the enhanced HUD alone, so the board (and the chat) stand over the black bar. | **Recorded, not fixed** - the chat's gap too; a skin-agnostic writer is its own change (`Event-Board.md` section 6). |
| B13 | test-gap | **The probe proved less than the record said**: no buffs (their box 0x0, so "clear of the buffs" could not fail), no scale, no widened or open chat, no 501-650 px screens. | The probe rewritten: buffs (two and six), the scale 1.5, a widened and an open chat, 1280x600 and 1024x560; a stand-down must have reached the HUD's line; a desk must show the board. |

## C - the seams and the behaviour change

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C4 | risk | **Event lines could be lost**: their only home was a 9 s news - six kept behind a window, the short screen's later notes hidden, a line in flight dropped when the board was switched off. | **Every line is filed in the journal** (the host's `townTalk.hudMessageSink`, the Messages page); a line taken in the frame the board goes off goes where it went before. |
| C5 | doc | **The raids' departure was misdescribed**: AddHUDText is the HUD's line (PopupText), not the middle of the screen, and it filed every line in the journal - which the board had stopped. | The journal (C4) keeps the raids' lines; the record and the Ledger name the HUD's line and the journal. |
| C6 | doc / risk | **The rite's broken line stayed in the chat**, and the Motherlodes' lines were named nowhere. | The rite's line through the door (`gate`); the Motherlodes listed as staying in the chat. |
| C8 | test-gap | **A raid's line back to the HUD's line was pinned by nothing.** | Pinned through a registered presenter, law and UI; mutant `EVENTS1-the-raid-to-the-chat-off`. |
| C9 | doc | **"A link dropped reads as none" and "a raid's line on a bench opens the news"** were both false: the source never turns null once the clock is heard, and every event producer runs in `world.js` alone. (D6, D10.) | Both sentences rewritten (`Event-Board.md` section 5); the UI test's "a link lost" (a source the host cannot produce) removed. |
| C10 | nit | Stale comments (gateOmen's `say`, world.js's sdHost block); the feature note wrong for raids and offline; the festival offline was never said (its "before" was not the chat there); the host ceiling's note said -3 where it was -2. | Each corrected; the note rewritten (W5); the door's table says "offline nowhere"; the ceiling's note 36,283 -> 36,281. |

## D - the records, the pins and the words

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D5 | test-gap | **Laws whose one-character mutation survived**: the region rule, the reach (its expectation computed from the constant under test), the kinds filter, the constants used only by name, the serpent's way, the boundaries (the raid horizon, a raid live at its start, the tall screen), the "more" count. | Each pinned by value: the numbers literally, a raid in the region 49 km off, 30 px within the reach and 31 past it, a reset a minute before midnight, a serpent's site, the horizon to the ms, a raid at its start minute, 900 px. A mutant for each. |
| D6 | test-gap | **Fixtures were hand-built** - raidTimerList had no test, and the star rows were not starTimerRows'. | The law tests mint their rows through raidTimerList (over `restoreRaidSaveData`) and starTimerRows; the producer's shape pinned. |
| D7 | test-gap | **Mutants killed only by a source regex**; the serpent's and the Abyss Dungeon's doors had no mutant. | Behavioural pins where a behaviour exists (the raid's door, the journal); every door, the seat and the draw with a mutant. |
| D8 | doc | **Test titles named mutants that were not recorded.** | Every mutant a title names is a record. |
| D9 | doc | **Other pages made false**: World-Bosses section 2, Sea-Serpent section 2, Starfall sections 3 and 8 (a STAR6 sentence under the EVENTS1 note it contradicted), Witches-Festival, Raiding-Parties. | Each carries an EVENTS1 note; Starfall's STAR6 sentence rewritten. |
| D11 | nit | The door's table left out the portents line; the festival's colour is the board's own, not the Timers window's; `EVENT_TOASTS_SHOWN = 2` against "one at a time". | The table, the colours' sentence, and `EVENT_TOASTS_SHOWN = 1`. |
| W1 | bug | **The French and Italian raid counts broke at 0 and 1** ("1 pillards abattus"). | Every language's count in the label form (*Raiders down: {n} of {of}*). |
| W2 | risk | **{party} was always English** ("Orcs собираются..."), and the Korean read as an attack on the party. | `events.party.*` in each language; the Korean's party the subject (`무리가`). |
| W3 | risk | **The gate's, the serpent's and the Abyss Dungeon's rows were English on the HUD**, and the km was handed preformatted. | The board words its own rows (`events.gate.*`, `events.serpent.*`, `events.super.*`, `events.where.*`); the language formats its number (`{km, number}`). |
| W4 | nit | The drafts drifted from the glossaries: de "Dagons Riss", it "Assalto", pt-BR "Ataque", bg "Нападение". | "Riss Dagons", "Incursione", "Incursão", "Набег". |
| W5 | doc | **The feature note was wrong** (off sends a raid's line to the HUD's line, not the chat) and broke WB13b (a dash aside, two rhythms of three). | Rewritten, in all fourteen languages. |
| W6 | nit | The drafts translated "Timers", a name the window never shows (its title is the literal *Timers*). | "Timers" in every language. |
| W7 | nit | ro "vestile" for "veștile"; bg's list in full articles. | Fixed; the bg note's list is gone with W5. |

## Found while fixing

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F1 | bug | **The journal held a line twice where the board had no room**: the door files each line, and the HUD's line it was then said on (townTalk's PopupText, DFU's AddHUDText) files every line it says. The same for a raid's line in hand when the board was switched off. | `eventHudLine`: a line the door filed is said on the HUD's line with the journal's door held aside for that one call; the board's own summary line is never filed. |
| F2 | risk | **The look ahead cached an empty roll** when asked before the picker's art was read (a page's first seconds), and named no next-day raid until the day turned. | A roll is made only once the regions are read; until then it is asked again each read. |
| F3 | bug | **A bar starting a pixel above the plate's top and reaching past it was not counted** (a phone on its side: the hotbar at 300 px, the plate at 301), so the plate stood over it - the probe's own find. | Whatever reaches below the plate's top within its span ends its room. And a plate with nothing left on it (a title over "more in Timers") stands down. |

## Checked and sound

Each lane's own list, in short: every row's clock is the relay's and every id is stable across reads and clock
corrections (75,600 cases); the gate's omen and the serpent's bells stand exactly `EVENT_SOON_MS` before they open, so
each comes on at its omen with its place; the way's bearing and scale; the lines moved off the chat are every shared
event's and none of a player's own (claims, rewards, refusals and errors stay); the board off sends each kind exactly
where it went before; raidTimerList gives the Timers window what it had; the four hosts draw it through drawHud and
`hideHudTextSurfaces`; the 500 ms read has no side effects; per frame it costs about 8 us; the classic kit copy is cut to
`body .evboard`; the relay's Discord herald reads no client line.

## Rerun

After the fixes: `npm run lint`, `npm run types`, the bible gates (manifest, citeanchor, citedrift, mutantdrift,
audit18_bible_docs, ledger), the host ceiling (bootWorld 36,281), the l10n tests and `l10nExtract --check`, and the
change's own tests and the pins it moved - all green; the mutation lists and the probe as above. The whole suite (33,558 tests): every one passes but two, `it1_worlddata` and `wd1_worlddata`'s rebuild of `WALLAA08.RMB` against the fetched ARENA2, which fail the same on the tree before this audit - not this change's.
