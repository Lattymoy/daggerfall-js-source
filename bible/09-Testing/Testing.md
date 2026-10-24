# Testing

Runner: `node --test` (bare - a trailing `test/` path breaks discovery on
Node 22). The suite counts itself: `node --test` reports what ran, and the landing page counts the declared tests
(top-of-line `test(` calls) from the tree when it builds. This page carried a row for every test file and a total
until 2026-10-19; that table is closed and kept as `Testing-Rows-2026-10-19.md` (LEGIBLE 1b,
`01-Overview/Readability-Arc.md`). A test file says what it covers in its own titles and header comment.
PROBE (no suite row - it needs `npx wrangler`): `npm run account` (tools/accountProbe.mjs) stands `server-account/` up in a REAL workerd, applies the real migrations to a real D1 through wrangler's ledger, and drives the whole account lifecycle AND (AUDIT-312 F4) a whole cloud-save round trip against workerd's own R2 - 36 checks. IT EXISTS BECAUSE THE SUITE WAS GREEN OVER A WORKER THAT COULD NOT BOOT: a module Worker reads every named export of its entrypoint as an entrypoint, `server-account/src/index.js` exported four constants, and workerd refused to start - while `test/server/accountworker.test.js` passed BECAUSE it imported those very names. Importability is not deployability. It also measures what the suite can only assume: Ed25519 exists in that runtime (it is not in every WebCrypto and the token design rests on it), PBKDF2 at 210,000 costs 36ms there, and a token the Worker SIGNS verifies against the key the Worker PUBLISHES, with a stranger's key and a bent byte as the negative controls. AUDIT-312 F4 ADDED ACC2's HALF, and the reason is the same one: ACC2 declared a new BINDING (`SAVES`, an R2 bucket) and seven routes, and nothing in this tree asked whether that binding is really bound - a binding that is ABSENT does not crash, it answers `no-storage`, which reaches a player as "Cloud saves are unavailable right now" with a green suite and a green deploy behind it. It drives the guest wall, a blob refused without a card, the card, the bytes back BYTE FOR BYTE as an octet-stream, the shot bounded apart from the save, another account refused a read and a delete, and the player's own delete taking the object as well as the row. AND IT WAS ONLY EVER CORRECT ONCE: `wrangler --local` REUSES its state, so run two registered a username run one had taken and logged in with a password run one's recovery check had changed - six failures about the last run rather than about the service, and a migration check reading "no migrations to apply" as "no migrations". It stands on a fresh `--persist-to` directory now, and two runs back to back are 36/36 twice. AND IT HAS BEEN MUTATED AT LAST (AUDIT-PW, tools/mutants/acctprobe.json, 4, 4 dead) - AUDIT-ACC named this tool as never-mutated beside password.js and it stayed that way for a day. The question a campaign asks of a PROBE is the inverse of the usual one: break the SERVICE, and does the probe go red? All four do, and TWO OF THEM THE SUITE CANNOT SEE AT ALL - a named value export back on the entrypoint (the original bug: workerd refuses to start over a constant while the suite stays green BECAUSE it imports those very names) and the R2 binding renamed in wrangler.toml (the suite hands the Worker its own env and never reads that file). The other two are a hash cost that leaves a Worker's CPU budget, which only a real runtime can time, and a migration that stops applying through wrangler's own ledger, which is the thing the deploy runs. `--local` is workerd, not Cloudflare: no network, no D1 limit, no cold start. Set ACCOUNT_PROBE_PORT if a previous run left an orphan. PROBE (no suite row - it needs a browser): `node tools/quickLootStatsProbe.mjs` draws the quick-loot plaque AND its stat panel through `showWorldPlaque` - the same seam the four hosts call - over the real ENHANCED_CSS in Chromium, at desktop, narrow and phone widths, walking the highlight down a pile of four, and photographs each. It exists because a player asked for the stats "next to the quickloot window" and NEXT TO is a thing about pixels: the suite can say the side was COMPUTED right and never that the panel reads as one surface with the list beside it. CHARGEN-REFLEX's lesson is built in - the markup is the real `paint`'s, not the probe's, because a harness that writes its own markup measures its own artefact. IT PAID FOR ITSELF ON THE FIRST RUN, TWICE, on faults no pin in the suite could have failed on: a Condition reads "Slightly Used (75%)" and the panel is deliberately narrow, so that row WRAPS - and the value was only pushed right by an auto margin, so its second line sat hard against the LABEL and read as a different row; and the survival SENTENCE rows ("Nourishes for 180 minutes") inherited the fix's right alignment and read as a value with no name. The rows were right, the side was right, the markup was right, and the box looked wrong. 12 shots. PROBE (no suite row - it runs 600 frames of the real rig): `node tools/peerBodiesProbe.mjs` drives the REAL PeerBodies over the REAL `createFpArm` rig on the arm fixtures with a counting renderer - 1, 4 and 8 peers walking out from 4 m to 50 m, a pose every sixth frame - and reports poses+uploads and sprite renders a body a frame. It exists because PERF-ON2 measured the online frame and never the peer bodies, which are its one real cost; it read 1.00 poses a body a frame at every count before PEER-CADENCE and 0.74 / 0.52 / 0.43 after, and still 1.00 sprite renders, which is the open item. The fixture rig is four small pieces, so its milliseconds are not a retail body's; the counts are exact. PROBE (no suite row - it needs a browser): `node tools/mailProbe.mjs` mounts the REAL friends panel over the real enhanced sheet in Chromium with a REAL MailBox whose fetch answers the service's shapes. It runs at 1440x900, 480x800 and a 390x700 phone on the touch skin, with the widest content the letter's law allows: a full box of fifty, a sender at the handle's bound with every glyph, a subject at its bound, and a letter of one 200-letter word and forty lines. It reads back the panel on the screen; three tabs and Close in one bar; nothing in the box, the letter or the form spilling or scrolling sideways; Reply and Delete reached at a letter's foot; the letter's field tall enough; a finger's 44px and a phone's 16px fields; a refusal said in the form with the draft kept; and a friend's row of Invite, Letter and Remove beside the widest name. IT FOUND ONE DEFECT: on the phone the three acts squeezed a guest friend's name to one letter a line, and the acts are one group that wraps below the name now. 36 checks, 12 shots. PROBE (no suite row - it needs a browser): `node tools/journalProbe.mjs` stands JOURNAL1's real surfaces over the real enhanced sheet in Chromium at 1440x900, 480x800 and a 390x700 phone on the touch skin, at the widest content the law allows: the chronicle's Share strip under a note with six readers at the name's bound and the letter, and what a press said, all inside the note's card with nothing scrolling sideways; the reader's window at the widest page (a head at PAGE_HEAD_MAX, PAGE_LINES_MAX lines, one a single unbroken word at PAGE_LINE_MAX) inside the screen, its page scrolling inside the card with Keep and Put it away on screen at its foot, and kept; the Letters tab's Keep beside Reply and Delete, and kept; and the F-menu's "Read their page" after Inspect on a player at the name's bound. A finger's 44px on the phone. IT FOUND ONE DEFECT: a note's line of one long word ran out of its card and the Notes section scrolled sideways (672px in 624 at a desktop, 652 in 315 on a phone) - the chronicle's text breaks a word too long for its column now. 35 checks, 15 shots. PROBE (no suite row - it needs a browser): `node tools/lootStackProbe.mjs` draws the REAL plaque through the real seam the four hosts call (ui/worldPlaque.js worldHoverFrame) over the real sheet in Chromium, with three bodies in one pile under the reticle, at 1440 and 480: the pile's mark ONE line inside the plaque beside the body's name and list, a turn landing the next frame with the next body's name and list and DFU's mid-screen line, a long body name, the back of the pile turning to its front. IT FOUND TWO DEFECTS IN THE PLAQUE IT DRAWS ON, both older than the pile, which only a picture could: the divider was the TITLE's foot, so every sub-line of a plaque with a list drew under it as the list's first row (a locked chest's lock level always had); and the list's height cap clipped ACROSS as well as down, cutting quick loot's highlight band off at the list's edges and the lit name's first letter with it - on the narrow sheet the band's fixed margin also ran 2px into the border, and its left padding stood the lit name 2px left of the rest. So it measures the lit row too (band edge to edge, name whole and unmoved) and the cap still clipping a six-row pile downward at a 360px window. 18 checks, 3 shots. PROBE (no suite row - it needs a browser): `node tools/chatChanProbe.mjs` mounts the REAL chat panel over the real sheet in Chromium, on the desktop skin and the touch skin, at the sheet's 440px box and the narrowest a phone gives (352px), and reads back what a fake cannot: World, Region, Party, Local and the Social button in ONE bar inside the box with no tab's name cut; every tab's hover; the field's placeholder following the tab and the Region tab's by the region's name; an aside in `(( ))` drawn leaning and dimmed beside a line in character; the peek's Party mark in the party's green and a notice with none; a roll in its own colour and the dice's words beside a typed line that only reads like one (DICE1); `/help`'s 'read' answer clearing the field with the chat left open; and EMOTE1's - the form row at every width with the field never under the narrowest the chat had before the emoji button (the touch skin's 115px at a 320px phone), the picker's round trip, the edge where the button gives way (the smallest box a drag makes keeps it, a pixel under does not), an action's face, and a joined family drawn as ONE glyph after the wire's sanitizer. IT FOUND TWO DEFECTS: four tabs and the Social button asked 373px of a 350px bar, pushing Social past the box's edge; and with three tabs unread they asked 468px of the sheet's own 440 - where the first fix (tabs shrinking to an ellipsis) MEASURED as fitting and a screenshot showed "PARTY..." beside a clipped smear of badge. Its judges now read what the eye does: a label whole inside its button (the text's own box, not scrollWidth, which clip does not move), every unread dot whole, Social always in the box. The tabs stand in a strip of their own that never squeezes a tab (a phone's scrolls sideways), an unread count is a dot with the number as the tab's spoken name, and a box under 400px (a container query - CHAT-SIZE lets the box be narrow on a wide screen) closes the labels up. At 440, 352 and a 320px phone's 292, on both skins, bare and with three tabs unread - 75 checks. EMOTE1's own run found two more: the button took a touch field to 67px at 320 (the touch skin has no button now - a phone keyboard has an emoji key) and a desktop one to 93px in a box the screen forced below the drag's minimum; and the first cut of the rule that yields it there asked the drag's width of a container query, which measures inside the box's border, and hid the button at the smallest box a drag makes. PROBE (no suite row - it needs a browser): `node tools/chatSizeProbe.mjs` drags the REAL grip with the real mouse over the chat's and the friends panel's real sheets in Chromium, at 1440x900 and 900x900, and reads the layout back - the box's width, the list's height, a line's and a roster row's computed size, Send's (a thumb's, unscaled), the grip against the Close button, the friends panel's rectangle against the box's (beside at 1440, under at 900, over it at neither), after a reload, and after a double click. IT FOUND TWO DEFECTS ON ITS FIRST RUN that the fake could not: the grip stood at the end of the form's row, which is the conversation column's corner and not the box's (the roster stands beyond it), and the list grew 132px for a 120px drag (its clientHeight carries its own padding, which the height the sheet sets does not). 24 checks. PROBE (no suite row - it needs a browser): `node tools/chatScrollProbe.mjs` drives the REAL chat panel over the real sheet in Chromium and reads the list's own scrollTop against its range after each thing a player does - the first open, an open after lines came in while closed, an open after reading history and closing, a line under a reader at the bottom, three under a reader who scrolled up (not yanked, the bar says 3), the bar's click - plain and with every line wearing a badge that wraps it. It exists because Starempire42's report is about a real scroll box, which node cannot lay out; Chromium keeps a hidden scroller's offset, so the engines that drop it are test/ui/chatscroll.test.js's half. 12 checks. PROBE (no suite row - it needs a browser): `node tools/chatFitProbe.mjs` stands the REAL chat panel (createChatPanel over a real ChatLog, CHAT_CSS over the enhanced sheet) in Chromium at a desktop and a phone-landscape viewport with twenty-four long names wearing titles and glyphs, and MEASURES: the box is 299 px with three names and 299 px with twenty-four, the column exactly as tall as the conversation, 437 px of list in 235, every row one line (16-17 px against a 16.2 px line), eight names cut with an ellipsis, and the chat lines wearing their authors' badges. It exists because Mac's report was a screenshot and every one of its three sentences is about pixels: a pin can say a rule reads `nowrap` and a column is `absolute`, and only a layout engine can say the box stopped growing. 12 checks, 2 shots. PROBE (no suite row - it needs a browser): `node tools/noticeFitProbe.mjs` draws the enhanced NOTICE PANELS through `drawEnhancedNotice` - the entry every box and every toast goes through - over the real ENHANCED_CSS in Chromium, at desktop, narrow and phone widths, and MEASURES each one's border-box width: a one-line notice, the status readout, a long quest box and a toast come back 210 / 450 / 520 / 339 px at 1280 wide, four widths where NOTICE-FIT found one. It exists because kurkku asked for "the sizing of the boxes to properly adjust for the text" and width is a thing about pixels - a pin can say the rule reads `max-width` and still not say that "You are healthy." hugs its line while a four-paragraph box still wraps at the cap. IT LIED ON ITS FIRST RUN and the picture is how it was caught: the panels photographed 46px off the right edge with a live transform, because NOTICE_WATCHDOG_MS had correctly swept a panel nobody was drawing - a harness that does not do what the host does measures its own artefact, so it PUMPS the draw on rAF the way a host does. 12 measurements, 3 shots. PROBE (no suite row - it needs a browser): `npm run blood` (tools/bloodProbe.mjs) drives `createHitEffects` and `drawBillboards` over a texture whose colour is known, in a real WebGL2 context, and reads the pixel back at five lighting states. MAC-BUG W6: and then installs the Enhanced Lighting lane and reads a sprite and a mark side by side at four more - the rows where the mark came back at 25 against 69 and 2 against 17 while every classic row was green. 26 checks (AUDIT BLOOD3 F10: and the MENISCUS is drawn now - the same mark against a uniform-thickness one under a grazing sun, the difference banded by radius, which is the one law this arc took to main with no picture; the film's own rows, banded by RADIUS inside the mark's silhouette rather than by brightness, which was sorting the alpha-faded rim into the thin bucket and measuring the blend). It exists because MAC-BUG W4 ("Also blood is black") could not be settled by reading: it clears the pool, the texture KEY (`380_0#0` is minted in scenes/dataPipeline.js and asked for in render/renderer.js, and nothing had ever checked the two agree), the shader's emission arm, and anything specific to blood - a plain sprite in the same dungeon light comes back the same 20,2,2. 9 checks. PROBE (no suite row - it needs a browser): `node tools/setUiProbe.mjs` draws the REAL pack (`createInventoryWindow`, the enhanced skin) and the REAL HUD with a kit worn through the game's own equip - six of Dagon's Brand and its sword, two of Ruhn's Regalia, a Mora helm and a Nocturnal cuirass carried - online at Renown 12, at a desktop, a laptop and a phone: the doll's strip (two lines, "7/9" and "2/9", their pips and stages, inside the column and clear of the shelf), every set piece's frame marked and its corner rune in its set's colour, a worn Dagon piece's card (seven places lit, three tiers awake, the stage line left-aligned at its own size), a Mora helm's ("0/9", "Wear two pieces to wake it", the sigil block's "A set's sigil"), the strip's press, the offline card asleep and dimmed, and the four powers driven through their real doors to their HUD chips in their sets' colours (a recovery dashed). 156 checks, every state photographed. PROBE (no suite row - it needs a browser): `node tools/renownBarProbe.mjs` draws the REAL HUD (`drawEnhancedHud` over the real sheets, the enhanced skin) with a Renown handed through `ui/hud/hudRenown.js`'s own seam, over the real web faces (`NOFONTS=1` for the fallback, offline), at 1440x900, 1024x700, a 390x844 phone and an 844x390 one, for a level part-way with a ghost, a level's start, a level's last XP, the cap and a level with no total, and reads: no words in the row, the bar's middle within 1px of the vitals', RENOWN4's thin 8px bar, the box clear of the bar and the row on the screen. It exists because RENOWN-BAR is a thing about pixels - where the bar's middle is. Before the change it read the bar 42px left of the vitals' middle (57px at the widest numbers) with the numbers beside it; after, 0.0px everywhere. 128 checks, 20 shots. PROBE (no suite row - it needs a browser): `node tools/languageProbe.mjs` (L10N1b) boots the game with no ARENA2 in Chromium as a French, an English and a Japanese reader and reads: the first-run offer asked in French with its machine-made note, the account window waiting until it is answered, Yes switching the rail to French at once and No keeping English, each answer remembered across a reload, only the chosen language's file fetched (none for an English reader), the Settings > Interface row holding every language the build does and switching French to German to English at once, `?lang=ja` for one visit, the pseudo-locale, and no page errors. 36 checks. PROBE (no suite row - it needs a browser): `node tools/classicTextProbe.mjs` (L10N2) draws a line of French, German, Polish, Vietnamese, Russian, Greek, Japanese, Simplified and Traditional Chinese and Korean through `ui/text.js` drawText on a REAL WebGL renderer, over a stand-in FONT0003 with blank glyphs and no ARENA2, and reads the pixels back: each language a face over its script's fonts (Han by region), every character a glyph grown on demand, ink where the line is and ending where its measured advance does, a full-width character one GlyphHeight wide, and English - left to Daggerfall's own glyphs - drawing no face. 45 checks, one picture (`PROBE_SHOTS`). PROBE (no suite row - it needs a browser and a DFU translation pack on disk, which is never committed): `PACK_DIR=... node tools/translationPackProbe.mjs` (L10N3b) installs the pack through Settings > Interface's Translation pack row in Chromium - its folder, then its .zip - and reads the game's tables back: its Internal_Strings and TEXT.RSC rows live, the language told its pack, its FONT0003 the face drawn, all of it still there after a reload, and gone after Remove. 13 checks with the French pack (354 files; 352 from its zip). PROBE (no suite row - it needs a browser): `node tools/lootBannerProbe.mjs` draws the REAL loot banners (`drawLootBanners` handed a player entity, as drawHud hands it) over the real enhanced HUD and a real notice toast in Chromium at 1440x900, 1024x700 and a 390x844 phone, the pieces minted by the game's own producers (a Rare, an Exalted Legendary, a Legendary card; an Aetheric, an Artifact and the Hourlock; a burst of six), and reads: every banner at the right edge and on the screen, none over the notices, none scrolling sideways, every name in its tier's colour, the top tiers big and taller than the rest, the best of a burst standing first, never more than three. 183 checks, 9 shots. PROBE (no suite row - it needs a browser): `node tools/cardPanelsProbe.mjs` (CARDS-PLUS, `11-Multiplayer/Tavern-Cards.md` section 38) mounts the REAL Hold'em and Iliac Hand panels over the card lab's table through their own painters and models - Iliac Hand's setup (a friendly game), a turn with a card staged and one picked, its end; Hold'em's buy-in at a gold table, a hand at the flop with four chairs, a full table's river and its showdown - on Enhanced Plus, the classic skin and the DFO Grimoire dress, at 1280x760, a 1000x560 window, 390x844 and 360x740 phones and an 844x390 phone under a finger (AUDIT CARDS-PLUS C5), with the launcher's own Pixelify Sans laid (the probe's browser has no route to the game's font request), and reads: the panel's words, title and presses in the game's face (the dress's under the dress) and no face of the panel's own - no serif, and under the dress exactly the dress's own stack (AUDIT CARDS-PLUS C5: the base skipped the dress, whose stack ends in Georgia); the kit's carved frame; the panel on the screen and nothing wider than it, no lane past its holding; no lane, little card or note wearing the enhanced sheet's bare `.row`, `.card` or `.note`; the hand painted at its 80px tile face; the log at its newest standing on a whole line; the fold on the screen to press, putting the table's words away and back with the line and the presses still drawn; and (AUDIT CARDS-PLUS C5, which found 100 of its first 314 checks running over nothing) every part a check reads counted there, the pot inside its board, each state either panel marks drawn apart from its rest in every look, no card over another. IT FOUND TWO DEFECTS BEFORE IT WAS WRITTEN DOWN, as the scratch harness it grew from: the log's top line half cut when scrolled (a scrolling padding, and a line holding a 5 grown a pixel by the five's own face - the lines are fixed boxes now, the gap their first's margin), and a regular's tile and a seat's name cut to an ellipsis (they wrap). 1,690 checks, 105 shots.
PROBE (no suite row - it needs `npx wrangler`): `npm run account` (tools/accountProbe.mjs) stands `server-account/` up in a REAL workerd, applies the real migrations to a real D1 through wrangler's ledger, and drives the whole account lifecycle AND (AUDIT-312 F4) a whole cloud-save round trip against workerd's own R2 - 36 checks. IT EXISTS BECAUSE THE SUITE WAS GREEN OVER A WORKER THAT COULD NOT BOOT: a module Worker reads every named export of its entrypoint as an entrypoint, `server-account/src/index.js` exported four constants, and workerd refused to start - while `test/server/accountworker.test.js` passed BECAUSE it imported those very names. Importability is not deployability. It also measures what the suite can only assume: Ed25519 exists in that runtime (it is not in every WebCrypto and the token design rests on it), PBKDF2 at 210,000 costs 36ms there, and a token the Worker SIGNS verifies against the key the Worker PUBLISHES, with a stranger's key and a bent byte as the negative controls. AUDIT-312 F4 ADDED ACC2's HALF, and the reason is the same one: ACC2 declared a new BINDING (`SAVES`, an R2 bucket) and seven routes, and nothing in this tree asked whether that binding is really bound - a binding that is ABSENT does not crash, it answers `no-storage`, which reaches a player as "Cloud saves are unavailable right now" with a green suite and a green deploy behind it. It drives the guest wall, a blob refused without a card, the card, the bytes back BYTE FOR BYTE as an octet-stream, the shot bounded apart from the save, another account refused a read and a delete, and the player's own delete taking the object as well as the row. AND IT WAS ONLY EVER CORRECT ONCE: `wrangler --local` REUSES its state, so run two registered a username run one had taken and logged in with a password run one's recovery check had changed - six failures about the last run rather than about the service, and a migration check reading "no migrations to apply" as "no migrations". It stands on a fresh `--persist-to` directory now, and two runs back to back are 36/36 twice. AND IT HAS BEEN MUTATED AT LAST (AUDIT-PW, tools/mutants/acctprobe.json, 4, 4 dead) - AUDIT-ACC named this tool as never-mutated beside password.js and it stayed that way for a day. The question a campaign asks of a PROBE is the inverse of the usual one: break the SERVICE, and does the probe go red? All four do, and TWO OF THEM THE SUITE CANNOT SEE AT ALL - a named value export back on the entrypoint (the original bug: workerd refuses to start over a constant while the suite stays green BECAUSE it imports those very names) and the R2 binding renamed in wrangler.toml (the suite hands the Worker its own env and never reads that file). The other two are a hash cost that leaves a Worker's CPU budget, which only a real runtime can time, and a migration that stops applying through wrangler's own ledger, which is the thing the deploy runs. `--local` is workerd, not Cloudflare: no network, no D1 limit, no cold start. Set ACCOUNT_PROBE_PORT if a previous run left an orphan. PROBE (no suite row - it needs a browser): `node tools/quickLootStatsProbe.mjs` draws the quick-loot plaque AND its stat panel through `showWorldPlaque` - the same seam the four hosts call - over the real ENHANCED_CSS in Chromium, at desktop, narrow and phone widths, walking the highlight down a pile of four, and photographs each. It exists because a player asked for the stats "next to the quickloot window" and NEXT TO is a thing about pixels: the suite can say the side was COMPUTED right and never that the panel reads as one surface with the list beside it. CHARGEN-REFLEX's lesson is built in - the markup is the real `paint`'s, not the probe's, because a harness that writes its own markup measures its own artefact. IT PAID FOR ITSELF ON THE FIRST RUN, TWICE, on faults no pin in the suite could have failed on: a Condition reads "Slightly Used (75%)" and the panel is deliberately narrow, so that row WRAPS - and the value was only pushed right by an auto margin, so its second line sat hard against the LABEL and read as a different row; and the survival SENTENCE rows ("Nourishes for 180 minutes") inherited the fix's right alignment and read as a value with no name. The rows were right, the side was right, the markup was right, and the box looked wrong. 12 shots. PROBE (no suite row - it runs 600 frames of the real rig): `node tools/peerBodiesProbe.mjs` drives the REAL PeerBodies over the REAL `createFpArm` rig on the arm fixtures with a counting renderer - 1, 4 and 8 peers walking out from 4 m to 50 m, a pose every sixth frame - and reports poses+uploads and sprite renders a body a frame. It exists because PERF-ON2 measured the online frame and never the peer bodies, which are its one real cost; it read 1.00 poses a body a frame at every count before PEER-CADENCE and 0.74 / 0.52 / 0.43 after, and still 1.00 sprite renders, which is the open item. The fixture rig is four small pieces, so its milliseconds are not a retail body's; the counts are exact. PROBE (no suite row - it needs a browser): `node tools/mailProbe.mjs` mounts the REAL friends panel over the real enhanced sheet in Chromium with a REAL MailBox whose fetch answers the service's shapes. It runs at 1440x900, 480x800 and a 390x700 phone on the touch skin, with the widest content the letter's law allows: a full box of fifty, a sender at the handle's bound with every glyph, a subject at its bound, and a letter of one 200-letter word and forty lines. It reads back the panel on the screen; three tabs and Close in one bar; nothing in the box, the letter or the form spilling or scrolling sideways; Reply and Delete reached at a letter's foot; the letter's field tall enough; a finger's 44px and a phone's 16px fields; a refusal said in the form with the draft kept; and a friend's row of Invite, Letter and Remove beside the widest name. IT FOUND ONE DEFECT: on the phone the three acts squeezed a guest friend's name to one letter a line, and the acts are one group that wraps below the name now. 36 checks, 12 shots. PROBE (no suite row - it needs a browser): `node tools/journalProbe.mjs` stands JOURNAL1's real surfaces over the real enhanced sheet in Chromium at 1440x900, 480x800 and a 390x700 phone on the touch skin, at the widest content the law allows: the chronicle's Share strip under a note with six readers at the name's bound and the letter, and what a press said, all inside the note's card with nothing scrolling sideways; the reader's window at the widest page (a head at PAGE_HEAD_MAX, PAGE_LINES_MAX lines, one a single unbroken word at PAGE_LINE_MAX) inside the screen, its page scrolling inside the card with Keep and Put it away on screen at its foot, and kept; the Letters tab's Keep beside Reply and Delete, and kept; and the F-menu's "Read their page" after Inspect on a player at the name's bound. A finger's 44px on the phone. IT FOUND ONE DEFECT: a note's line of one long word ran out of its card and the Notes section scrolled sideways (672px in 624 at a desktop, 652 in 315 on a phone) - the chronicle's text breaks a word too long for its column now. 35 checks, 15 shots. PROBE (no suite row - it needs a browser): `node tools/lootStackProbe.mjs` draws the REAL plaque through the real seam the four hosts call (ui/worldPlaque.js worldHoverFrame) over the real sheet in Chromium, with three bodies in one pile under the reticle, at 1440 and 480: the pile's mark ONE line inside the plaque beside the body's name and list, a turn landing the next frame with the next body's name and list and DFU's mid-screen line, a long body name, the back of the pile turning to its front. IT FOUND TWO DEFECTS IN THE PLAQUE IT DRAWS ON, both older than the pile, which only a picture could: the divider was the TITLE's foot, so every sub-line of a plaque with a list drew under it as the list's first row (a locked chest's lock level always had); and the list's height cap clipped ACROSS as well as down, cutting quick loot's highlight band off at the list's edges and the lit name's first letter with it - on the narrow sheet the band's fixed margin also ran 2px into the border, and its left padding stood the lit name 2px left of the rest. So it measures the lit row too (band edge to edge, name whole and unmoved) and the cap still clipping a six-row pile downward at a 360px window. 18 checks, 3 shots. PROBE (no suite row - it needs a browser): `node tools/chatChanProbe.mjs` mounts the REAL chat panel over the real sheet in Chromium, on the desktop skin and the touch skin, at the sheet's 440px box and the narrowest a phone gives (352px), and reads back what a fake cannot: World, Region, Party, Local and the Social button in ONE bar inside the box with no tab's name cut; every tab's hover; the field's placeholder following the tab and the Region tab's by the region's name; an aside in `(( ))` drawn leaning and dimmed beside a line in character; the peek's Party mark in the party's green and a notice with none; a roll in its own colour and the dice's words beside a typed line that only reads like one (DICE1); `/help`'s 'read' answer clearing the field with the chat left open; and EMOTE1's - the form row at every width with the field never under the narrowest the chat had before the emoji button (the touch skin's 115px at a 320px phone), the picker's round trip, the edge where the button gives way (the smallest box a drag makes keeps it, a pixel under does not), an action's face, and a joined family drawn as ONE glyph after the wire's sanitizer. IT FOUND TWO DEFECTS: four tabs and the Social button asked 373px of a 350px bar, pushing Social past the box's edge; and with three tabs unread they asked 468px of the sheet's own 440 - where the first fix (tabs shrinking to an ellipsis) MEASURED as fitting and a screenshot showed "PARTY..." beside a clipped smear of badge. Its judges now read what the eye does: a label whole inside its button (the text's own box, not scrollWidth, which clip does not move), every unread dot whole, Social always in the box. The tabs stand in a strip of their own that never squeezes a tab (a phone's scrolls sideways), an unread count is a dot with the number as the tab's spoken name, and a box under 400px (a container query - CHAT-SIZE lets the box be narrow on a wide screen) closes the labels up. At 440, 352 and a 320px phone's 292, on both skins, bare and with three tabs unread - 75 checks. EMOTE1's own run found two more: the button took a touch field to 67px at 320 (the touch skin has no button now - a phone keyboard has an emoji key) and a desktop one to 93px in a box the screen forced below the drag's minimum; and the first cut of the rule that yields it there asked the drag's width of a container query, which measures inside the box's border, and hid the button at the smallest box a drag makes. PROBE (no suite row - it needs a browser): `node tools/chatSizeProbe.mjs` drags the REAL grip with the real mouse over the chat's and the friends panel's real sheets in Chromium, at 1440x900 and 900x900, and reads the layout back - the box's width, the list's height, a line's and a roster row's computed size, Send's (a thumb's, unscaled), the grip against the Close button, the friends panel's rectangle against the box's (beside at 1440, under at 900, over it at neither), after a reload, and after a double click. IT FOUND TWO DEFECTS ON ITS FIRST RUN that the fake could not: the grip stood at the end of the form's row, which is the conversation column's corner and not the box's (the roster stands beyond it), and the list grew 132px for a 120px drag (its clientHeight carries its own padding, which the height the sheet sets does not). 24 checks. PROBE (no suite row - it needs a browser): `node tools/chatScrollProbe.mjs` drives the REAL chat panel over the real sheet in Chromium and reads the list's own scrollTop against its range after each thing a player does - the first open, an open after lines came in while closed, an open after reading history and closing, a line under a reader at the bottom, three under a reader who scrolled up (not yanked, the bar says 3), the bar's click - plain and with every line wearing a badge that wraps it. It exists because Starempire42's report is about a real scroll box, which node cannot lay out; Chromium keeps a hidden scroller's offset, so the engines that drop it are test/ui/chatscroll.test.js's half. 12 checks. PROBE (no suite row - it needs a browser): `node tools/chatFitProbe.mjs` stands the REAL chat panel (createChatPanel over a real ChatLog, CHAT_CSS over the enhanced sheet) in Chromium at a desktop and a phone-landscape viewport with twenty-four long names wearing titles and glyphs, and MEASURES: the box is 299 px with three names and 299 px with twenty-four, the column exactly as tall as the conversation, 437 px of list in 235, every row one line (16-17 px against a 16.2 px line), eight names cut with an ellipsis, and the chat lines wearing their authors' badges. It exists because Mac's report was a screenshot and every one of its three sentences is about pixels: a pin can say a rule reads `nowrap` and a column is `absolute`, and only a layout engine can say the box stopped growing. 12 checks, 2 shots. PROBE (no suite row - it needs a browser): `node tools/noticeFitProbe.mjs` draws the enhanced NOTICE PANELS through `drawEnhancedNotice` - the entry every box and every toast goes through - over the real ENHANCED_CSS in Chromium, at desktop, narrow and phone widths, and MEASURES each one's border-box width: a one-line notice, the status readout, a long quest box and a toast come back 210 / 450 / 520 / 339 px at 1280 wide, four widths where NOTICE-FIT found one. It exists because kurkku asked for "the sizing of the boxes to properly adjust for the text" and width is a thing about pixels - a pin can say the rule reads `max-width` and still not say that "You are healthy." hugs its line while a four-paragraph box still wraps at the cap. IT LIED ON ITS FIRST RUN and the picture is how it was caught: the panels photographed 46px off the right edge with a live transform, because NOTICE_WATCHDOG_MS had correctly swept a panel nobody was drawing - a harness that does not do what the host does measures its own artefact, so it PUMPS the draw on rAF the way a host does. 12 measurements, 3 shots. PROBE (no suite row - it needs a browser): `npm run blood` (tools/bloodProbe.mjs) drives `createHitEffects` and `drawBillboards` over a texture whose colour is known, in a real WebGL2 context, and reads the pixel back at five lighting states. MAC-BUG W6: and then installs the Enhanced Lighting lane and reads a sprite and a mark side by side at four more - the rows where the mark came back at 25 against 69 and 2 against 17 while every classic row was green. 26 checks (AUDIT BLOOD3 F10: and the MENISCUS is drawn now - the same mark against a uniform-thickness one under a grazing sun, the difference banded by radius, which is the one law this arc took to main with no picture; the film's own rows, banded by RADIUS inside the mark's silhouette rather than by brightness, which was sorting the alpha-faded rim into the thin bucket and measuring the blend). It exists because MAC-BUG W4 ("Also blood is black") could not be settled by reading: it clears the pool, the texture KEY (`380_0#0` is minted in scenes/dataPipeline.js and asked for in render/renderer.js, and nothing had ever checked the two agree), the shader's emission arm, and anything specific to blood - a plain sprite in the same dungeon light comes back the same 20,2,2. 9 checks. PROBE (no suite row - it needs a browser): `node tools/setUiProbe.mjs` draws the REAL pack (`createInventoryWindow`, the enhanced skin) and the REAL HUD with a kit worn through the game's own equip - six of Dagon's Brand and its sword, two of Ruhn's Regalia, a Mora helm and a Nocturnal cuirass carried - online at Renown 12, at a desktop, a laptop and a phone: the doll's strip (two lines, "7/9" and "2/9", their pips and stages, inside the column and clear of the shelf), every set piece's frame marked and its corner rune in its set's colour, a worn Dagon piece's card (seven places lit, three tiers awake, the stage line left-aligned at its own size), a Mora helm's ("0/9", "Wear two pieces to wake it", the sigil block's "A set's sigil"), the strip's press, the offline card asleep and dimmed, and the four powers driven through their real doors to their HUD chips in their sets' colours (a recovery dashed). 156 checks, every state photographed. PROBE (no suite row - it needs a browser): `node tools/renownBarProbe.mjs` draws the REAL HUD (`drawEnhancedHud` over the real sheets, the enhanced skin) with a Renown handed through `ui/hud/hudRenown.js`'s own seam, over the real web faces (`NOFONTS=1` for the fallback, offline), at 1440x900, 1024x700, a 390x844 phone and an 844x390 one, for a level part-way with a ghost, a level's start, a level's last XP, the cap and a level with no total, and reads: no words in the row, the bar's middle within 1px of the vitals', RENOWN4's thin 8px bar, the box clear of the bar and the row on the screen. It exists because RENOWN-BAR is a thing about pixels - where the bar's middle is. Before the change it read the bar 42px left of the vitals' middle (57px at the widest numbers) with the numbers beside it; after, 0.0px everywhere. 128 checks, 20 shots. PROBE (no suite row - it needs a browser): `node tools/languageProbe.mjs` (L10N1b) boots the game with no ARENA2 in Chromium as a French, an English and a Japanese reader and reads: the first-run offer asked in French with its machine-made note, the account window waiting until it is answered, Yes switching the rail to French at once and No keeping English, each answer remembered across a reload, only the chosen language's file fetched (none for an English reader), the Settings > Interface row holding every language the build does and switching French to German to English at once, `?lang=ja` for one visit, the pseudo-locale, and no page errors. 36 checks. PROBE (no suite row - it needs a browser): `node tools/classicTextProbe.mjs` (L10N2) draws a line of French, German, Polish, Vietnamese, Russian, Greek, Japanese, Simplified and Traditional Chinese and Korean through `ui/text.js` drawText on a REAL WebGL renderer, over a stand-in FONT0003 with blank glyphs and no ARENA2, and reads the pixels back: each language a face over its script's fonts (Han by region), every character a glyph grown on demand, ink where the line is and ending where its measured advance does, a full-width character one GlyphHeight wide, and English - left to Daggerfall's own glyphs - drawing no face. 45 checks, one picture (`PROBE_SHOTS`). PROBE (no suite row - it needs a browser and a DFU translation pack on disk, which is never committed): `PACK_DIR=... node tools/translationPackProbe.mjs` (L10N3b) installs the pack through Settings > Interface's Translation pack row in Chromium - its folder, then its .zip - and reads the game's tables back: its Internal_Strings and TEXT.RSC rows live, the language told its pack, its FONT0003 the face drawn, all of it still there after a reload, and gone after Remove. 13 checks with the French pack (354 files; 352 from its zip). PROBE (no suite row - it needs a browser): `node tools/lootBannerProbe.mjs` draws the REAL loot banners (`drawLootBanners` handed a player entity, as drawHud hands it) over the real enhanced HUD and a real notice toast in Chromium at 1440x900, 1024x700 and a 390x844 phone, the pieces minted by the game's own producers (a Rare, an Exalted Legendary, a Legendary card; an Aetheric, an Artifact and the Hourlock; a burst of six), and reads: every banner at the right edge and on the screen, none over the notices, none scrolling sideways, every name in its tier's colour, the top tiers big and taller than the rest, the best of a burst standing first, never more than three. 183 checks, 9 shots.

## How the suite runs (FLOW1-FLOW4, 2026-09-26)

Mac: *"Weve accumulated a lot of tests and I feel like its slowed down our ability to iterate. If they help, I dont want
things removed but is there a way to really ensure we have a faster workflow with the same standards?"* Nothing was
removed and nothing weakened: every file runs on every PR and before every deploy. Measured before: the PR's check ~7
minutes, and on the merge the deploy ran the same check again (6 min 45 s of its 7 min 24 s) - a change ~15 minutes from
its push to the site; the suite alone ~6 minutes on a four-core runner, two whole-world files a fifth of it.

- **CI-FAST (2026-10-19, Mac: "Do both and whatever else could speed up everything").** A run was the slowest of four
  shards, ~13.6 minutes of a suite grown to 30,606 tests in 3,557 files, and the shards were uneven (6.7 to 13.6
  minutes) because 1,327 files had no recorded time and each weighed the median. Now: eight shards; the times recorded
  by CI on every run (CI-TIMES, below - the local re-take was stopped at 500 of 3,557 files after an hour); every job
  restores `node_modules` from the cache keyed by
  `package-lock.json` and runs `npm ci` only on a miss (verify.yml's jobs and the course sweep's); and a red shard names
  its failures - `tools/failSummary.mjs`, a second reporter beside the runner's own in every runner `runTests` starts,
  writes each failing test's file, line, name and first line of why at the end of the log, and on GitHub Actions as an
  annotation on the check and a table in the job's summary (a red shard's log had said `# fail 2` and no more). Nothing
  run less: every file, every shard, every part. Pinned by `test/tooling/cifast_failsummary.test.js`,
  `fastsuite.test.js` and `flow1_ci.test.js`.
- **CI-TIMES (2026-10-19, Mac: "Do it" - the shards' times recorded by CI, not re-taken by hand).** Every shard records
  each of its files' wall time in that run (`node tools/testShards.mjs i/8 --record <file>`: the runner's own
  `test:complete` for a file, its process from start to end, kept by the summary's reporter - `tools/fileTimes.mjs`)
  and keeps the record as an artifact. After a green run `.github/workflows/test-times.yml` - which `check.yml` and
  `deploy.yml` call beside their result, so neither the check nor the publish waits on it - merges the eight onto the
  times the run was split by (`node tools/testTimes.mjs --merge <dir>`: a recorded time replaces the old, a file not
  timed keeps its own, a file gone from the suite is dropped) and saves them in the Actions cache, and keeps them as the
  `test-times` artifact for a commit of `tools/testTimes.json` when one is wanted. verify.yml's `times` job finds the
  newest saved times - a lookup, nothing downloaded, one small job ahead of the shards - and every shard restores THAT ONE key
  (`fail-on-cache-miss`), so all eight split by the same times and every file is still in exactly one shard; with
  none saved, the committed file, as before. A runner a test starts of its own never writes into a shard's record (the
  reporter takes the path out of the environment as it loads). A pull request's saved times are its own (the cache
  keeps a branch's to it); main's, saved by the deploy, are everyone's. Pinned by `test/tooling/citimes.test.js`.
- **CI, in parallel (FLOW1).** `.github/workflows/verify.yml` is the one check - lint and the types, the suite in eight
  shards (four until CI-FAST, below), the build - as jobs that run at once. `check.yml` (the PR) calls it, and its `check` job passes only when all
  of it did (it runs `always()` and reads the result: a required check SKIPPED because its need failed would pass).
  `deploy.yml` pins main's head once, verifies that commit with the same jobs beside the site's own build of it, and
  publishes only after both passed. `release-desktop.yml`'s `gate` calls it too, on the release's own commit, and every
  OS leg waits for it (REL-FAST, 2026-10-15, Mac: "Yes, thats insanely slow" - the gate was `npm run check` in series,
  27.4 of a release's 33 minutes); none of its checkouts keeps a token (AUDIT INSTALL L1-1). The shards: `tools/testShards.mjs` splits the files by their recorded times - the
  longest first, each onto the lightest shard - so the four finish together (~245 s of recorded time each, ~80 s a
  job); EVERY FILE IS IN EXACTLY ONE SHARD, and a file with no recorded time weighs the median.
- **The times (FLOW1).** `npm run test:times` re-times every file into `tools/testTimes.json`. Stale times only
  balance the shards less well - they never leave a file out. CI keeps its own current (CI-TIMES, above); the
  committed file is what a machine of one's own and a run with no saved times split by.
- **The loop (FLOW3).** `npm run test:changed` runs the tests a change can move (`tools/testChanged.mjs`): the files
  that import a changed file through any depth of modules, the ones whose text names it (the source pins read files by
  path), the ones that changed; a change to package.json, the lockfile or tsconfig runs everything. A change to one
  module is seconds (spoilsPool.js: 10 files). `npm run lint` keeps a content-keyed cache: ~1 s warm, ~35 s cold.
  Before a push (FAST-SUITE, 2026-10-04 - CLAUDE.md says it): lint, the types, the bible's gates (manifest, citeanchor,
  citedrift, mutantdrift, audit18_bible_docs, ledger - ALWAYS: the audit found test:changed picks none of them for a one-module
  change, and this very slice's road edit moved a mutant record and a cite only they catch) and `npm run test:changed`;
  when that is most of the suite (a change to a host the source pins read), the change's own files and CI the rest. A
  pull request that conflicts with its base runs no workflow at all - the base is merged in before the push that is to
  be verified (the audit found this one's FAST-SUITE head never verified: main had moved under it). The whole `npm run check` (lint, types, the
  suite, the build, in series - ~15 minutes on four cores) is for when CI cannot run it; CI runs it all either way.
- **Longest first, every core (FAST-SUITE, 2026-10-04, Mac: "Our workflow is extremely slow").** `npm test` is
  `tools/testShards.mjs 1/1` - the whole suite as one shard - and every list of tests (a CI shard, `test:changed`) runs
  through the one `runTests`: the files longest first by the recorded times, and `--test-concurrency` at the machine's
  cores. `node --test "test/*.test.js"` took them in NAME order, so roadsReal, slam7, slam8 and weather3a started near
  the end and ran on alone; and Node's default leaves a core idle (measured over every twelfth file, 185 files: 140 s at
  three, 126 s at four). The same files, each in its own process, every test in it (`test/tooling/fastsuite.test.js`;
  audit68's X2 holds `testFiles` to exactly the glob's list). Ruled out, measured: V8's compile cache across the
  processes (`NODE_COMPILE_CACHE`, ~5%, within the noise) - the time is in the tests' own work, not in loading.
  The times were taken again (`tools/testTimes.json`: every file, where it had held 1,329 and the ~900 since stood at the
  median - they are taken on a quiet machine, `npm run test:times` with nothing else running: the first re-take ran
  under other work and read ~1.8x the old, which balances the shards all the same but compares with nothing). And the
  ROAD PAINTER (`world/road/roadPainter.js` paintRoads, roadsReal's whole cost and every streamed terrain pixel's) skips the
  tiles no painter can reach - off the centre cross (x or y within MID_LO-1..MID_HI+1), the two diagonals (within 2)
  and the location rect - and keeps ONE context a pixel where it minted one a tile: ~5x (2.8 -> 0.5 ms a call), the
  same bytes, proven against the ladder alone - `node tools/roadGuardProof.mjs` takes the ladder from the commit before
  the guard and runs both over every road, track, river and stream pixel of the shipped map with water on and off, with
  rects and location tiles (103,487 real-map cases, 113,727 with its synthetic sweep, none differing; the audit's own
  independent run, ~147,000, agreed) - and pinned by the roads suites
  (`tools/mutants/fastsuite_roads.json`, 5, all dead - the band one tile narrower on either axis among them).
  Not taken, and why: the next slowest files (weather3a's calibration sample, the naval captains and lanes) spend their
  time across the weather draws, the animator, the sea's step and the particles - no one hot spot, an engine's worth of
  work rather than a test's.
- **The mutants (FLOW4).** `node tools/mutate.mjs --jobs N` judges N mutants at once, each worker in a workspace copy
  of the tree (node_modules and the data directories linked; its own TMPDIR), the source here never touched. The same
  verdicts, in list order: each test a record names is first run UNMUTATED in a workspace, and a record whose tests do
  not pass there (one that needs the repository's own git) is judged in place, as a serial run judges it. 57 mutants
  over the weather map and the loader: 408 s at `--jobs 4`, against about an hour serially. Without `--jobs` nothing
  changed. AUDIT SCALE M1 (`01-Overview/audits/Audit-Scale.md`): a death is the mutant's only where its tests pass without
  it. A test that failed in a workspace is run unmutated here as well, and a serial run first runs every test its
  records name, unmutated. A record any of whose tests fails is no verdict, and the run fails. A test file that did
  not parse had read twenty "dead" in place.
- **The two slowest files (FLOW2)** were made fast by making the game's own code fast, the same answers: ROADS-CLEAR's
  whole-world sweep 136 s -> 1 s (world/worldOfDaggerfall/wodLocationLoader.js walks a tile's own pixel - `pickLocationsScan`, the
  verbatim loop, is its law and was proven equal on every pixel), WEATHER3a ~104 s -> ~58 s (the weather map's
  allocations; the same bits, by snapshot and by goldens taken before).

**THE ARENA2-GATED PINS ARE HALF-BLIND, AND THAT IS A KNOWN COST.** A
pin behind `{ skip: skipReal }` never runs on CI, so a law change that
contradicts it goes unnoticed until someone runs the suite WITH game
data. Two did (2026-08-23, found while merging the input arc):
audit18_hosts_dungeon's swing-fatigue pin still asserted the drain
AUDIT 24 wave 42 had deliberately moved to the hosts, and
cityguards.test.js's stub renderer lacked the `destroyBillboardBatch`
wave 6's batch-free calls - it THREW rather than failed. Both are
fixed, and both by making the pin say MORE, not less. When you change
a law, grep the ARENA2-gated files for it too.

**AND THEY ARE ENGLISH-RETAIL-LOCKED, WHICH NOTHING SAID.** 2026-08-25:
the gated pins ran in a working environment for the first time, against
a real ARENA2 pulled from the DaggerfallSetup installer. 35 of them
failed, and NONE of the 35 is a port defect. 8 fail on FILENAME CASE
alone - retail data was written on a filesystem that did not care, and
that install carries `INVE00I0.img` beside `INVE04I0.IMG` and
`ANIM0001.vid` beside `ANIM0002.VID`, 76 lowercase names among 1,598.
The shipping data path already knew (`dataSource.normalizeName`
uppercases on both ingest and lookup, so the browser is fine); the test
harness and the vite dev middleware read the folder case-sensitively,
so `npm run dev` 404'd against files that were sitting right there.
The dev server is case-insensitive now; the pins still read the folder
literally and a mixed-case corpus still reddens them.

The other 27 are LOCALISATION. That install is the German edition, and
these pins encode the English retail corpus by value: FACTION.TXT has
374 records against the pinned 366 and names faction 41 Kriegergilde,
the map directory has no location called "Privateer's Hold" so five
dungeon pins dereference null, SPELLS.STD's indices move, CLASS*.CFG
carries different career flags (a Mage there CAN wear plate), and the
IMG corpus is 198 files against 263. Every one of those is the data
being legitimately different, not the port being wrong.

Two port-relevant facts fell out of the same run and are recorded
rather than fixed, because both change shipped behaviour: the
CLASS*.CFG NAME FIELD IS ENCIPHERED in that edition (CLASS00 reads
"vfu", CLASS15 reads "dfhdfh" - a repeated three-gram where German's
Barbar is a repeated three-gram, so the record parses correctly and
only the name is coded) and `chargenSession` falls back to
CLASS_CAREERS only when the name is EMPTY, so a non-English install
shows gibberish in the class list; and the port's font maps the
high-bit range to punctuation, so every umlaut renders as `#` or `}`
("St#rke", "W}ste"). Neither can be caught by any pin the suite has,
because the suite has never had non-English data.

### ALLOC-RACE - A MEASURE THAT RACED THE COMPILER (2026-10-14)

AUDIT DEPS1's full run failed one pin that passed alone: sd25_arena S7, THE
ARENA'S WATCH MAKES NOTHING - "marks: 17.32 bytes a frame", one boxed number.
Ten suites measure a frame's bytes the same way (L2 F9's measure: a child
with a 64 MB young space, a warm-up, the least of several windows), and the
measure is only true of OPTIMISED code - V8 optimises on a background thread,
and four shards on four cores, each spawning children, can starve that thread
past the whole warm-up. The windows then count the lower tier's boxing. Proved,
not supposed: `--concurrent-recompilation-delay=5000` (V8's own switch for a
late compiler) turns S7 red at 2452 bytes a frame.

The child now WAITS for the compiler instead of racing it. `test/allocSettle.mjs`,
preloaded into every measuring child, makes the `gc()` that opens each window
first finish the optimising queue (`%FinalizeOptimization`, under
`--allow-natives-syntax`): the code is compiled the browser's own way -
concurrently - and read only once it is in. The flags live in ONE place,
`test/allocChild.mjs` (`ALLOC_CHILD_ARGS`); `test/tooling/allocchild.test.js` holds
them to their purpose (with the compiler held back three seconds, a frame that
makes nothing measures under 2 bytes through them, against a control - the
measure without the settle - that must show the boxing) and the suites to them
(each imports the list and takes it whole). All ten suites, 120 tests, pass as
they run and with the compiler held back five seconds.

AUDIT ALLOC-RACE (2026-10-15) found the first fix wrong.
`--no-concurrent-recompilation` compiled each function on the main thread the
moment it turned hot - a caller before its callees, a different shape of
optimised code from the one the browser runs. SD11A-L2F9-a-still-body-posed-again
(a still body's matrix made again every frame) measured 1 byte a frame that way
and 48 concurrently (its call's boxed numbers): the flag had read the mutant as
garbage-free, and ALLOC1 gave it a work pin on that reading. Under
the settle it measures 48 bytes, three runs of three, and L2 F9's measure kills
it again; sd11a_scenes's L2 F10/F11 test keeps the work pin as well (the still
body's matrix stamped and held through a frame), because the pose's bytes are
the call's and an engine that inlines it boxes nothing - the work is the law.
The 35 allocation mutants over the ten suites and ALLOC-RACE's own three
(`tools/mutants/allocrace.json`: the settle dropped from the list, the settle
that waits for nothing, a suite's own list again): 38 dead.

Two tiers per module:
1. **Synthetic fixtures** - in-memory data built inside the test. Always run;
   CI stays green with no game data (88 pass, 49 skip).
2. **Real-data validation** - gated on `ARENA2_PATH`; skip cleanly when
   absent. Pin observed counts, names, ids, checksums, and structural
   closure invariants.

Without game data the suite runs 805 pass / 120 skip (AUDIT 18 corrected
the long-stale "88 pass, 49 skip", which described a 137-test suite that
has not existed for many milestones). Those 75 skipped pins DO NOT RUN
IN THE DEPLOY GATE - CI has no ARENA2 - so a real-data pin is a local
gate only. (Measured on main at the AUDIT 18 merge; recount by hand
when the split moves.) Nothing guards this line; recount it by hand when the split moves.

Sourcing data in a fresh session: `sh tools/fetch-data.sh`, then
`ARENA2_PATH=/home/claude/dfdata/arena2 npm test`.

Visual proof: `npm run shot [out.png]` boots vite in-process and drives the
provisioned Chromium (playwright@1.56.0 <-> /opt/pw-browsers chromium-1194;
bump both together). CONTRACT: the scene query rides the SHOT_QUERY env
var, NOT argv (`SHOT_QUERY='shot&world&tod=22:00' npm run shot out.png`) -
argv[2] is only the output path. SHOT_TIMEOUT overrides the 30s ready
wait (streaming world wants 90000); SHOT_EVAL runs a JS snippet in-page
after ready (promise-returning expressions are awaited - top-level
`await` fails). Shot-mode probe hooks in the dungeon and world scenes:
window.__move(dx, dy, dz), window.__pose(x, y, z, yaw, pitch),
window.__player {pos, warp}, and in the dungeon __activate/__activateKey/
__ray/__actions. SwiftShader renders heavy scenes at ~7 fps headless -
time-based proofs must poll state, never trust wall-clock. `?shot` in main.js fixes the vantage and raises
`window.__shotReady`. Manual proof, not a suite gate.

Playing the game: `ARENA2_PATH=... npm run firsthour` drives ONE character
through one continuous session on the real hosts - chargen, the starting
dungeon, a fight, the loot, the way out, the road, a town, a shop, a
purchase, a bed - asserting the player is alive and the state coherent at
each step, with a screenshot per stage (`SHOTS=<dir>`, default
`firsthour-shots/`). A failing stage does NOT stop the walk; its dependents
are marked skipped and the run continues, because the output is a MAP of
what a first hour hits rather than the first pothole. `ONLY_CHARGEN=1` stops
after the wizard - a four-minute run instead of twenty-five, which is how
the modal-ownership fix was red-proofed. It is a TOOL, not a suite gate: it
needs game data and about twenty-five minutes of SwiftShader. Run it when a
host, a window or the boot path changes - `tools/nativeTradeProbe.mjs` sat
red for months because nothing did.

PX31 (2026-08-31) found the same rot ACROSS THE FLEET, and one line up
from any assertion: NINE probes waited on `#enhanced-menu .railbtn` at
their front door. `railbtn` is the SHELL rail's class and the boot door
has not carried one since PX1 replaced it with the pixel home, whose
buttons were classless - so every one of them timed out before its
first check, and had since 2026-08-27. The fix is a hook rather than
nine text selectors: the door's buttons carry `doorbtn door-<id>` and
the probes select on that, because matching on the visible words would
be the same bug waiting on a relabel. Opening the door then showed the
rot goes deeper in at least two of them - `enhancedPackProbe` and
`enhancedDollProbe` still assert the U53 slot map (`.node`,
`.node.filled`) that PX19d and PX20a replaced with the worn map. Those
bodies are a repair of their own and are NOT done, which is why PX31's
own pin is a new file (`tools/enhancedPackLayoutProbe.mjs`) rather than
more checks bolted to a probe that cannot reach them.

THE STANDING LESSON IS SHARPER THAN "RUN THE PROBES": a probe that
cannot reach its first check fails identically to a probe nobody ran,
and neither shows up anywhere. A red probe is evidence; an unreachable
one is silence wearing evidence's clothes.

Pre-push gate: lint, the types, the bible's gates and `npm run test:changed`; CI's sharded `verify` is the whole gate, and `npm run check` (test + build, in series) is for when CI cannot run it (FAST-SUITE - CLAUDE.md, and "How the suite runs" above).

`test/bible/manifest.test.js` holds three things: no test file shares its name with another (the bible names tests by
name alone), this page carries no file table again, and `Testing-Rows-2026-10-19.md` stays closed at the 3,571 rows
it closed with.

## PY1 - THE PARITY PINS WERE BLIND (2026-08-28)

**Fourteen pins across eight files were reporting green by never
running.** They are not remembered-value pins - they REGENERATE a port
table from Daggerfall Unity's own C# and compare it cell for cell:
ENEMY_BASICS off `EnemyBasics.cs`, LOOT_MATRICES off `LootTables.cs`,
the ingredient ITEM_GROUPS and artifact rows off `ItemEnums.cs`,
MAGIC_ONLY_KEYS off the effect classes, the race templates,
PlayerActivate's ladder, the two enemy-motor waves,
`DaggerfallInterior`, and MacroHelper's whole %-table. They are the
ONLY pins that can catch the port drifting from a DFU nobody re-read.

Every one resolved the checkout as a hardcoded `'../tools/parity/dfu/'`
and skipped when it was absent - which is every environment where the
reference tree lives somewhere else, including the one this project is
developed in (the clone sits outside the repo). The suite printed
`# skipped 14`, which at a glance reads exactly like `# pass 14`.

`tools/parity/prepare.sh` has honoured `DFU_PATH` since AUDIT 18 ("Point
it at a checkout you already have"); the tests simply never learned the
convention. `test/dfuRoot.mjs` is the one home now - env var first, the
in-tree sparse clone second, prepare.sh's own precedence - and with no
checkout at all the pins still skip, correctly: Port-Doctrine keeps DFU
an EXTERNAL reference, never vendored, so CI's shape is unchanged.

**All fourteen pass against the live checkout**, so the tables had not
drifted - the pins were right and blind, not wrong. Run them with:

```sh
DFU_PATH=/path/to/daggerfall-unity npm test
```

THE LESSON, and it is why this got its own slice: a skip is not a pass,
and a suite that cannot tell you which it printed is lying by omission.
The campaign taught the second half - the first version of the
env-var pin GREPPED the helper for `process.env.DFU_PATH`, and the
mutant that disabled the arm with `false ?` left the matched text
intact and survived. The pin spawns a child with the variable set and
asks where the root actually landed. **A pin that greps for a mechanism
does not test the mechanism.**

Pins: 3 in `test/tooling/parityroot.test.js` (a SOURCE SWEEP so no future test
re-hardcodes the path - the shape R6's bare-`this` sweep takes - plus
the behavioural precedence pin and the still-skips-cleanly arm).
Campaign: 5 mutants, 5 killed.

## EF1 - A COVERAGE CLAIM MUST BE MEASURED FROM BOTH SIDES (2026-08-28)

PY1's sibling, and the same failure one level up: PY1 was a pin that
never ran, this is a measurement that never asked the second question.

The effect library's `out.skipped++` had carried "the library grows one
family at a time" since the port's first magic slice, and it was picked
as the next slice on the strength of that one sentence. Three
measurements later there was no gap - and a defect the gap question
could not see.

**The first measurement used a proxy.** `effectActiveIdentity` was
asked which families it could name and answered "65 reached, 17
skipped". It is the ACTIVE-ENTRY classifier - an instant family handled
inline has no active identity by design - so Open, SpellAbsorption,
CreateItem and fourteen others were counted absent while sitting in the
file. A grep found all 17 in the port. The number was never reported as
a finding, because a number that measures the wrong thing is not a
weaker finding than the right one, it is not a finding.

**The second used the right instrument against the wrong corpus.** The
real counter, driven per key - but over a key set built by grepping
`MakeClassicKey(g, s)` for literals: 82 of DFU's 91.
`ElementalResistance.cs:194` and `PacifyEffect.cs:111` build theirs
from a loop variable, and nine real families are invisible to that
grep. Zero gaps against an incomplete corpus is not zero gaps, and the
mutation campaign now carries an arm that removes a single loop-keyed
variant (8,4) so a corpus that quietly loses them again fails.

**The third asked the other direction, and that is where the bug was.**
Sweeping all 65,536 classic keys through the real dispatcher, the port
answered 346 where DFU defines 91. The 255 extras were group 43,
subgroups 0-254: the Teleport arm tested `e.type === 43` and never its
subgroup, where DFU keys the class `MakeClassicKey(43, 255)`. Its own
comment read "(43,255)" the whole time.

THE LESSON: **"nothing is missing" and "nothing extra is answered" are
two claims, and a coverage pin that only makes the first will pass
forever on code that fails the second.** It was true on the broken
code. Whenever a pin asserts that some set is covered, ask what it says
about the things OUTSIDE the set - usually the answer is nothing, and
usually that is where the defect is.

The control arm is the other half of the discipline and costs four
lines: keys outside the classic space must REACH the counter. A
coverage pin whose measurement cannot report a miss proves nothing, and
the campaign's second mutant (delete `out.skipped++`) is exactly the
vacuous-measurement case it exists to catch.

Pins: 4 in `test/systems/effectcoverage.test.js`. Two are UNGATED and catch the
defect in CI where no checkout exists; two REGENERATE DFU's key set
through `test/dfuRoot.mjs` (PY1's one home), so they run wherever the
tree is - and were verified against the live checkout, not left to
print a skip. Campaign: 5 mutants, 5 killed.
