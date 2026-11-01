# Menu order: pictures before words

How the enhanced trade and crafting surfaces show what a thing is before they say it: a glyph a kind, a picture a
press, tiles where columns of lines would stand. It covers the decorator's panel and placing bar, the shop counter,
the Stores and Crafting pages' stations, the Notice Board's Market and Vendors, the Reforge, the shipmaster's window
and a merchant's presses. No price, fee or refusal is decided here: each surface reads the same producers as before.

## How it works

**Glyphs** (`src/ui/menu/menuGlyphs.js`). A 12x12 pixel glyph each for the decorator's kinds, views and sizes, the
stations and the presses, typed as rows of `#`. An element asks for one with `data-dficon`; `DFICON_CSS` draws it as a
CSS mask over `currentColor`, so it takes the word's color in every theme and state.

**Item pictures** (`src/ui/menu/menuPicture.js` `materialPicture`, `itemPicture`). A Market row, a supplier's row, a
trader's piece and a Stores card show the game's own item picture before the name. The tabs read no game law, so the
host hands the picture over through the provider; with no data the row is its words.

**The decorator** (`src/ui/decorPanel.js`). The catalogue, the room's pieces, built-in pieces and "Your things" lay as
tiles (`DECOR_GRID_MODES`): picture, name, price and badges for what a piece does. **Pictures / List** switches the
lay. Filters stand under their names (Sort, Type, Size, Show only); on a phone they fold behind **Filters**, which
counts what it hides (`decorFiltersText`). A placed piece's presses are tiles in named groups (`DECOR_ACT_GROUPS`),
Remove alone in the warn role. The placing bar's keys are folded behind **Keys** (`decorBarKeys`). A model's tile
shows its own picture once drawn (`modelPicture`): `src/scenes/decor/decorTool.js` `drawThumbs` renders a few a frame
(`DECOR_THUMBS_A_FRAME`) through `src/scenes/panelPicture.js`, in the room's own textures, and gives up after
`DECOR_THUMB_WAIT_MS`, leaving the glyph.

**The shop counter** (`src/ui/enhanced/enhancedTrade.js`). Every row carries its price (`rowPrice`, the same quote a
click gives). **List / Pictures** lays both lists as tiles. The player's column is named "Your pack", the footer's
figures each stand under a name (`TRADE_COST_WORD`), Steal is set apart in the warn role, and a magic-only counter is
titled "Sell magic items" (`TRADE_TITLE`).

**Stations** (`src/ui/professions/profPages.js`). The Stores and Crafting pages show a row of station tiles
(`STATION_TILES`): glyph, short name, and Here or Away. A station worked here is drawn below and its tile scrolls to it.
An away station's section is kept hidden until its tile is pressed. Works and patterns are cards in a grid.

**The rest.** The Market's views are pictured chips (`MARKET_VIEW_ICONS`, `src/ui/marketTab.js`). The Reforge's pages
(`REFORGE_PAGE_ICONS`), the shipmaster's tabs (`SHIPYARD_TAB_ICONS`) and a merchant's presses (`MERCHANT_ICONS`) wear
glyphs. A ship's card shows the ship drawn at her size: `src/scenes/shipPortraits.js` renders each hull once a session
from the boat pool's `portrait`.

**A refused press says why** (`src/ui/brokerWindow.js` `refusePress`). The Reforge's and Sigil Broker's refused
presses are `aria-disabled`, not `disabled`: hover shows the reason, and a press writes the whole reason in the note
line and does nothing else, so a touch screen gets it too. A press in flight stays `disabled`.

## Rules

- Organize the decoration, store and crafting menus so they are readable; text lists are too much, so pictures come
  first and words only where a picture cannot say it (the owner).
- A kind, a view and a press show a picture before their words; the words stay for readers and hover.
- The glyphs are ours, typed in `menuGlyphs.js`. A piece's own picture is made from the player's data at runtime,
  never a committed raster.
- A price stands on its own row or tile and equals what a click quotes.
- What is not here waits one press away (an away station, the bar's keys, a phone's filters); nothing is dropped.
- The classic windows (DFU's trade window, potion maker and item maker) keep DFU's own layout; no pictures are added
  there.

## Code and tests

- `src/ui/menu/menuGlyphs.js` - the glyphs and `DFICON_CSS`
- `src/ui/menu/menuPicture.js` - item and material pictures
- `src/ui/decorPanel.js`, `src/scenes/decor/decorTool.js` - the decorator and model pictures
- `src/ui/enhanced/enhancedTrade.js` - the counter
- `src/ui/professions/profPages.js` - station tiles
- `src/scenes/shipPortraits.js`, `src/scenes/panelPicture.js` - ship and model portraits
- `test/ui/menuorder.test.js` - glyphs, tiles, prices, stations, refused presses, portraits
- `tools/noticeBoardProbe.mjs` - the board's tabs in Chromium at desktop and phone sizes

## Open

- A ship's crew and lantern flames are billboards and stand in no portrait.
- Model and ship pictures are tested over fakes; they have not been photographed on a real install.
- A shipyard's climate swap goes through the pinned upload door; its preview's own handling is not done.
