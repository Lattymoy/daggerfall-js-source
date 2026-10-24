# MENU ORDER - pictures before words: the decorator, the shop counter and the Stores page's stations (MENU-ORDER, 2026-10-12)

The port's own. Three enhanced surfaces that worked and read as walls of text - the decorator's panel and its placing
bar, the shop counter, and the Stores page with every crafting station on it - each made to show what it is before it
says it: a picture a kind, a picture a press, tiles where columns of lines stood. No law moved: every price, fee,
refusal and act is the one the surface drew before, read off the same producers.

## Asked

The owner (2026-10-12): "I want to really organize and enhance the decoration menu/buttons. Making it for palatable,
readable and easy to understand. I want to do the same for stores, crafting menus, etc."

A first pass grouped and labelled the text (named filter rows, named groups of presses). The owner, of it: "I just feel
like text lists are too much. Why cant you try something else" - so the pass that stands is pictures first, words
where a picture cannot say it (a price, a name).

## 1. What a player met (FACT, at 2617d0ba)

- **The decorator** (`src/ui/decorPanel.js`, DECOR1d onward): one row of unlabelled chips - eighteen kinds, three sizes,
  two "has" chips and three sorts - under a tab row that held the views and a house's rooms alike; a catalogue of text
  lines, a model's picture two letters of its kind ("Be", "Fu"); a placed piece's eight presses in one wrapping row
  (Move, Turn left, Turn right, Light, Holds things, the station's craft, its licence, Remove), Remove dressed as any
  other; the placing bar's keys one run-on sentence over its buttons. On a phone the filters took the card and the list
  was gone.
- **The shop counter** (`src/ui/enhanced/enhancedTrade.js`): the player's column unnamed under the shop's "On the shelf"; one
  footer span "Cost: 0   Gold: 1840", its spaces collapsed; a price only after a row was clicked; Steal beside Clear;
  a magic-only counter titled "Sell"; the empty strip's hint in #7d745f, under FONT3's dim; four page tabs four rows
  deep on a phone.
- **The Stores page** (`src/ui/professions/profPages.js`): every station drawn one after another whether the player stood at it or
  not - at a smith's forge, eleven Smelt rows (nine of them "(0)") and fifteen Anvil patterns, each a full-width line;
  away from a station, its "is done at..." paragraph, so a player at no bench read nine of them.

## 2. What changed

- **MENU-ORDER a, the pictures** (`src/ui/menu/menuGlyphs.js`, new). A 12x12 pixel glyph each for the catalogue's kinds
  (every `DECOR_KINDS` key), the views, the sizes, the stations and the presses, typed as rows of `#` - the port's own
  art, no ARENA2 pixel (Port-Doctrine, A RENDER OF GAME DATA IS GAME DATA). An element asks for one by `data-dficon`;
  `DFICON_CSS` draws it as the element's `::before` through a CSS mask over `currentColor`, so it takes the word's own
  colour - a chosen chip's brass, a disabled press's grey, every Plus theme.
- **MENU-ORDER b, the decorator.** The catalogue, the room's pieces, the built-in pieces and "Your things" lay as
  **tiles** (`DECOR_GRID_MODES`; a room to rent and a part to paint stay lines): a picture 76px, the name, the price,
  and badges for what a piece does (holds things, gives light, serves a craft); a model's tile its kind's glyph, the two
  letters kept under it for a reader. **Pictures / List** beside the views switches the lay (`DECOR_LAYOUT_WORDS`).
  Every view tab, kind chip, size and has-filter wears its glyph; the views are a tab bar of their own, a house's rooms a
  row of their own ("Room"). The filters stand under their names - Sort beside the search, then Type, Size and Show only
  - and a phone folds all but the search and the sort behind **Filters**, which counts what it hides
  (`decorFiltersText`). A piece's presses are picture tiles in named groups (`DECOR_ACT_GROUPS`: Arrange; Light and
  storage; Crafting station; then Remove alone, in the kit's warn role); a long-worded press lies flat beside its glyph.
  The placing bar is its pictured presses (Place, the turns, Raise and Lower, Smaller and Bigger, Grid, Back) and a
  **Keys** press that unfolds the keys' legend - a name and what presses it, a pair a line (`decorBarKeys`) - folded
  until asked. The caravan's paint row, hidden by an attribute `display: flex` outweighed, hidden in fact.
- **MENU-ORDER c, the shop counter.** Every shelf row carries its price (`rowPrice` - the strip's own quote, so the row
  and the click agree); where the counter buys, repairs or identifies, the player's rows carry theirs. **List /
  Pictures** in the header lays both lists as tiles, a picture the pack grid's box (`SLOT_BOX.grid`) - lines first, the
  player's choice kept. The player's column is named ("Your pack") over its tabs; the footer's two figures stand each
  under its name (`TRADE_COST_WORD`: To pay, or You get; Your gold); Steal is set apart in the warn role; a magic-only
  counter's title says "Sell magic items" (`TRADE_TITLE`); a phone's four pages lie two by two; the empty strip's hint
  in the dim.
- **MENU-ORDER d, the Stores page.** Under the Stores, a row of **station tiles** (`STATION_TILES`): a glyph, a short
  name, and Here (lit) or Away. A station worked here is drawn below as it always was, and its tile takes the player to
  it; one the player is away from keeps its section - every word it says - hidden under the tiles until its tile is
  pressed, and a second press puts it away (`_stores.awayPick`). A section is "worked here" when it draws a press - a
  button, a field, a choice (`stationWorkable`); a station a press asked the page to land on (STATION-DOOR) is shown. A
  station's works (smelt, burn, saw, cure, weave, transmute) and its patterns are **cards** in a grid (`.prof-works`,
  `.prof-recipes`), a dark one still drawn where it stood. The material chips a step larger (12px).
- **MENU-ORDER e, the Notice Board's Market and Vendors, and the Stores' materials** (the owner, of the next surfaces:
  "Continue"). A Market material row, a supplier's row (the Weavers', the Apothecaries'), a pack piece listed for gold, a
  trader's piece and a Stores card each wear the game's own item picture before their name: the item the Stores would
  hand the material out as (systems/professions/profItems.js `mintMaterialItem`), or the piece itself, read off its inventory record
  and fitted to a row's box (`src/ui/menu/menuPicture.js`, new: `materialPicture`, `itemPicture` - the pack's and the shop's
  own door, `requestFittedIcon`). The tabs read no game law, so the host hands the picture over (`picture`,
  `itemPicture` on the board's market, `picture` on its traders, a stall's and the Stores page's provider) and the tab
  draws it (`pictureNode`, `ui/menu/menuGlyphs.js`); with no data there is none and the row is its words. The Market's views
  are pictured chips (`MARKET_VIEW_ICONS`: ore, hammer, gavel, pack, list, coin, chart), never a second row of the
  board's tabs. FOUND on the way: on a phone the views' row scrolled sideways inside the tab's column and took no height
  at all (`overflow-x` makes `min-height: auto` nought) - a phone's Market showed Materials and nothing to switch to;
  it is `flex: none` now.

- **MENU-ORDER f, the rest** (the owner: "Dont report back until everything is finished"). The pause menu's Vendor page
  pictures a trader's pieces (`picture` on its provider); the Market's crafted pieces and auctions their own (the piece
  their record mints, minted once by its provenance - world.js `marketPiecePicture`). The Reforge's pages each wear a
  glyph (`REFORGE_PAGE_ICONS`), and a row with no press of its own gives its name the press's column (SCRY-FIT sized the
  price and the press to their words and kept the press's column on every row, so the Reforge page cut every name to
  "Warrior..."); a name runs to two lines rather than an ellipsis. The shipmaster's pages each wear a glyph
  (`SHIPYARD_TAB_ICONS`), and a ship's card leads with a ship drawn her size - a Rowboat small, a Large Galley great; its
  figures a step larger (12px). The naval yard's three pages (Shipwright, Harbourmaster, Exchange) and a merchant's
  presses (Repair item, Talk, Sell or Banking, Exit - `MERCHANT_ICONS`; a service's own word, none) each wear theirs.

- **MENU-ORDER g, the four left open** (the owner: "Finish the not done").
  - **A refused press says why when pressed** (Plain-Words law 5, A FINGER HAS NO HOVER). The Reforge's nine refusals
    (salvage, reforge, hone, imprint, extract, unset, set, scry, lift) and the Sigil Broker's Buy and an insignia's are
    never `disabled` now: `refusePress` (`ui/brokerWindow.js`) marks one `aria-disabled`, keeps its title for the
    pointer, and a press of it says the whole reason in the window's note line and does nothing else - on the Reforge
    it lets a pending ask go with it (AUDIT LOOT II B4). It reads refused on both skins (`BROKER_CSS`, at rest, under
    the pointer, held and focused - AUDIT MENU-ORDER U2/U3), its word in the dim bone rather than faded, since that word
    is the reason shortened; its name starts with that word (U15); pressed, the note alone is drawn again and the keys
    stay on it (U4). A press in flight (an insignia being bought) stays `disabled`: it has nothing to say.
  - **A model's own picture in its tile.** The panel asks for a model's picture as it asks for a flat's (when its tile
    comes into view; `modelPicture`, `ui/decorPanel.js` - the catalogue's, a placed piece's and a built-in one's), and
    shows it over its kind's glyph, which stands until it lands. The host (`scenes/decor/decorTool.js` `drawThumbs`) draws a few
    a frame (`DECOR_THUMBS_A_FRAME`) at the preview's own turn of the frame: the model loaded through a hold of the
    panel's own and let go with it (AUDIT MENU-ORDER R4), drawn in the host's law (AUDIT 05b A5), in the room's own
    textures (a picture is kept under the law its room's table was built in - its climate and season, `markRemapLaw`: a
    house entered again knows its pictures, another climate asks again - C3), with the preview's own second camera and
    copy (`scenes/panelPicture.js`, new - `panelPicture`, `canvasBoxUnder`, lit by its own studio alone - R6 - and
    encoded by the browser later - R3) into a square of the canvas under the panel's card, at twice the tile's size (R7),
    seen a quarter turned from a little above. An ask ages only while the panel stands (C1); one for a model that never
    comes is let go after `DECOR_THUMB_WAIT_MS`, and its tile keeps the glyph.
  - **A ship's own picture.** The boat pool builds each hull once, standing at the origin and never on the water, its
    sails baked as they stand (`scenes/comeSailAway/comeSailAwayPool.js` `portrait`): her parts - every mesh the pool's own draw
    would draw for her, at its own matrix - and her box. `scenes/shipPortraits.js` (new) draws her one a frame at the
    world's frame's end (world.js, beside the yard decorator's preview, after the frame is shown and its shots are
    taken - AUDIT MENU-ORDER R2), under the shipmaster's window, from off her beam and a little above, at 480x240 (R7),
    and copies her out once a hull for the session; the card (`ui/shipyardWindow.js`) shows her at
    her size still (a Rowboat's picture the card's half, a Large Galley's its width) over her glyph. Ports are the
    streaming world's, so world.js is the one host that opens the window and the one that draws her.
  - **A portrait phone's placing bar** stands under the touch layer's two top-left presses (16px down, 48px tall,
    `ui/touch/touch.js`) at the screen's width; a 390px phone had given it 118px beside them. A landscape screen keeps its
    clearance.

THE FOUR HOSTS (Home.md, 17e): the decorator, the counter and the pages are each one surface every host opens through
its one door (`scenes/decor/decorTool.js`, `ui/tradeDoor.js`, the pause menu's pages). MENU-ORDER e's pictures are handed by
the providers that stand them: `src/scenes/world.js` WIRED - the Stores page's (`setProfessionsPages`), the board's
market and traders (`showNoticeWindow`'s `market`, `vendorBoardHost`), a trader's stall (`openHomeVendorWindow`) and the
Vendor page's (`setVendorPage`), the only places those providers are built; `src/scenes/worldModes.js` (the interiors), `src/scenes/dungeonContext.js` and
`src/scenes/exterior.js` build none of them (the board is the streaming world's, its stall opens through world.js's
door), so there is nothing there to wire.

## 3. The laws

1. **A PICTURE BEFORE A WORD.** A kind, a view and a press show what they are before their words do; the words stay,
   for a reader and a hover.
2. **THE PICTURES ARE OURS.** Every glyph is typed in `menuGlyphs.js`; a piece's own picture is the player's data at
   runtime, never a committed raster.
3. **A PRICE WHERE THE THING IS.** What a piece costs or brings stands on its own row or tile, the same figure a click
   quotes.
4. **WHAT IS NOT HERE WAITS TO BE ASKED.** A station the player is away from, the bar's keys and a phone's filters are
   one press away - kept, never dropped.

## 4. Not done, and why

- **The classic windows** - DFU's trade window (INVE00I0/SHOP00I0), the potion maker (MASK00I0) and the item maker
  (ITEM00I0) - draw DFU's rects (THE NATIVE-WINDOW RULE, Home.md): no picture is added there.
- **The Work tab** is cards already (the writs pinned on the cork), and **the Sigil Broker** pictures its offers in their
  frames already: neither changed.
- **The four left open by MENU-ORDER f** - a refused press's reason on a touch screen, a ship's own picture, a model's
  own picture in a tile and a portrait phone's placing bar - are MENU-ORDER g's (section 2), CLOSED.
- **AUDIT MENU-ORDER** (`01-Overview/audits/Audit-Menu-Order.md`): 28 findings (the lanes' two doubles counted once), 26 FIXED; KEPT R2's renderer half (the panel
  bracket gives the mesh program's uniforms back to no one - a panel comes after the world's last draw, pinned for
  world.js) and R8 (five portrait boats a session, never torn down); OPEN A2 (a yard's climate swaps through the pinned
  upload door, its preview's since AUDIT 05b - its own slice).
- **A ship's crew and lanterns' flames** are billboards and stand in no picture (`portrait` takes her meshes alone); a
  model's or a ship's picture is seen in no real ARENA2 in this repository's checks - its math, its hand-over and every
  pass and copy are pinned over fakes, and the pool's portrait of every hull is read off the vendored models (the pass
  itself is the decorator's preview's, which the game draws already). OPEN: a photograph of both on a real install.

## 5. Proof

- `test/ui/menuorder.test.js` (12): the glyphs (twelve by twelve, a rect a lit pixel, a mask each, every kind and station
  pictured); the decorator's tiles, its kind glyphs and letters, its badges, the Pictures / List switch, the tabs' and
  chips' glyphs, the switch after the tabs; a placed piece's pictured presses, Remove warned, the bar's legend folded
  behind Keys, the legend's pairs, the fold's count; the counter's title, its named column, its two figures, a price on
  every shelf row equal to the strip's quote, Steal apart, the switch; the Stores page's tiles, Here and Away, an away
  station's words hidden until pressed and again, a section with a button read as worked, the works and patterns as
  cards; the board's rows pictured - a Market material row, a supplier's and a trader's piece, none without a picture,
  a Stores card - the Market's views their glyphs, a phone's row of them its height; the rest - the Vendor page's pieces
  and the Market's crafted pieces pictured, the Reforge's, the yard's and a merchant's glyphs, the Reforge's buttonless
  row, the ships' sizes in the yard's order, the host's hand-over in world.js (`test/systems/shipyards1_host.test.js`'s window:
  each page its glyph, a ship on every card). PINS MOVED: the bar's keys read whole (`decor1e`, `decorfigure`), DECOR-FLIP reads the legend's own pair
  (`decorflip`), PLUS-DRESS's warn literals carry the decorator's Remove and the counter's Steal (`plusdress1`), the
  stations' order read in the tiles' list (`prof9_client`, `prof10_client`, `prof11_client`, `prof12_client`).
  MENU-ORDER g: a refused press (`refusePress` itself; the Reforge's nine and the Broker's two its calls, no Reforge press
  `disabled`; the grey on both skins), the portrait phone's bar, a model's picture (the catalogue's, a placed piece's and
  a built-in one's tiles asking and wearing it; the camera centred and looking down; a few a frame, under the card,
  copied from that square, in the room's textures, never another room's, given up on, only once the law answered), and
  a ship's (the pool's portrait of a hull equal to its own draw of her standing - every mesh, her sails baked, at its
  matrix - built once and never on the water; one a frame under the window, copied out, once a hull, moved under the
  window that asks last, given up on and asked again; off her beam and from above; world.js's hand-over; her size on the
  card). PINS MOVED: a refused press reads `aria-disabled` and says why when pressed (`loot9_reforge`, `loot16_curses`,
  `loot17_hone`, `loot19_scry`, `fb1010_truecurse`, `fb1012d_salvageclassic` - which now also lets an ask go -
  `set7_broker`, `wb9g_insignia`); a model's row is watched as a flat's is (`decor1d`); the shipmaster's window asks her
  picture and wears it (`shipyards1_host`).
- `tools/mutants/menuorder.json`: 135 mutants, 135 dead (MENU-ORDER g's 49 run on their own; MENU-ORDER a-f's 47 before;
  AUDIT MENU-ORDER's 39 and its 12 re-aimed - `01-Overview/audits/Audit-Menu-Order.md` Pinned).
  MENU-ORDER g re-aimed by content and dead again: `set7.json`'s SET7-a-refused-offers-buy-pressable, `audit_wb9.json`'s
  AUDIT-WB9-the-wares-pressable-mid-sale, `loot16.json`'s LOOT16-a-refusal-pressable, `loot17.json`'s
  LOOT17-a-refused-press-pressable and `loot19.json`'s LOOT19-a-refusal-pressable (each now the `refusePress` call gone);
  `nudedecor.json`'s NUDEDECOR-thumb-born (the flat's line of thumbOf, reworded) and `ows2.json`'s OWS2-rig-bounds (its
  guard read whole with hullRig's next line - `portrait` opens with the same guard). Re-aimed by content and dead again: `decorfigure.json`'s
  DECOR-FIGURE-buttons-kept, `craft4.json`'s CRAFT4-pages-no-loom, `prof10.json`'s PROF10-pages-no-bench,
  `prof11.json`'s PROF11-pages-bench-undrawn, `prof12.json`'s PROF12-pages-alchemy-undrawn and
  PROF12-pages-enchant-undrawn.
- MERGED WITH L10N4 (main's localization arc, `06-Systems/Localization-Arc.md`): MENU-ORDER's own words go through the
  text core - the decorator's group names, paint rows, filter names, badges, search and keys' legend (`decor.panel.*`,
  `decor.bar.keys.*`), the counter's title, column and figures (`trade.counter.*`), the station tiles' Here, Away and
  hint (`prof.page.tile.*`) - as getters where a table is exported, so a test reading `DECOR_ACT_GROUPS.use` still reads
  English; the view tabs take their glyph from `chip`'s own argument, never read back off their (now translatable)
  words. The ratchet (`test/systems/l10n4_hardcoded.test.js`) holds `decorPanel.js` at 96. The thirteen whole languages hold
  the 36 new keys, drafted in-session (`tools/l10nInSession.mjs`). Re-aimed by content and dead again: `basehide.json`'s
  BASEHIDE-the-tab-uncounted, `decor1e.json`'s DECOR1e-the-tabs-idle, `decor2b.json`'s DECOR2b-the-tab-unpressed-in-a-look,
  and `menuorder.json`'s MENUORDER-decor-tab-icons-one, MENUORDER-trade-figures-together, MENUORDER-trade-magic-title.
- Photographed in Chromium over the real enhanced sheet, at 1440x900 and a 390px phone: the decorator's catalogue,
  room, pack and bar; the counter's Buy and Sell in both lays; the Stores page at a smith's and away from every bench,
  an away tile pressed; the board's Market and Vendors (`tools/noticeBoardProbe.mjs`, its every tab inside the viewport
  at a desktop and a phone, and a copy handed stand-in pictures); the Reforge, the shipmaster's window and a merchant's
  popup over the real sheet; MENU-ORDER g's placing bar on a 390x760 phone.
