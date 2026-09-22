# UI

ACTIVE - see `UI-Arc.md` for the live record. U1-U43 SHIPPED (the classic
font and text layer, native window chrome, the message box, HUD and
crosshair, inventory, talk, trade with its mode flow, the paperdoll, the
rest window, the whole character-creation wizard through the custom-class
builder and the special advantages window, the settings screen and the
launcher, the pause options window and the rebindable controls grid, the
tooltip, the guild service windows, the spell maker, the tavern, the bank
teller, the classic TRAVEL MAP with its region pages and travel popup,
the SPELLBOOK with its icons and the guilds' buy mode, ONE
DISPATCH so those windows work in a building and not only outdoors,
and the classic LARGE HUD with its eleven clickable panels, and the
BANK'S HOUSE MARKET, and the WITCHES COVEN's four-button panel, and the pixel dial, and the
VITALS INDICATORS - HUDVitals' smoothed loss trails and instant gain
bars, with the health/fatigue colour swap - and the SPELL ICON PICKER
both icon clicks had been waiting on, and the COLOUR PICKER that makes
the settings screen's seven colour rows editable, and the HUD
ESCORTING FACES - the quest escorts' portrait column, FE1 - and the CREDITS TABLE the About pane renders, CR1 - and the NEAR-DEATH FLICKER, AUDIT 28 W2d - and the USE-MAGIC-ITEM WINDOW, UI1, the U key's list of everything you can use by magic - and the MERCHANT SERVICE POPUP, UI2, the panel a shopkeeper or bank teller puts in front of you - and the TRANSPORT WINDOW, TR3, the last of DFU's sixty - and the MESH STAMP, ROAD-C c2/S10, the pure top-down rasteriser the town map's player arrow and its dark stamp are cut from - and the FADE LAYER, D4, FadeBehaviour's one full-screen panel: the HUD parent's background colour, which the near-death flicker writes too - and the PENDING QUEST OFFER, AUDIT 58, DaggerfallUI's `lastPendingOfferSender` latch and the `GiveOffer()` the rest and fast-travel presses spend it through) - and the MERCHANT REPAIR POPUP, AUDIT 58, the four-button REPR01I0 panel an armorer, a general store or a weaponsmith puts in front of you, whose Talk and Sell rows the trade window never carried) - and the TARGET ICON PANEL, AUDIT 58, the container picture and the carried/max line both classic list windows draw over their two lists) - and the MID-SCREEN TEXT LABEL, AUDIT 64 F34, DaggerfallHUD's OTHER text surface: the single centred line at native y=146 that replaces itself, where popupText queues - and the HUD SHORTCUTS, AUDIT 64 F36/F37, DaggerfallHUD.Update's LargeHUDToggle and HUDToggle arms and the renderHUD flag its Draw override reads - and the QUEST RAIL, MAC-K2, the ONE walk from the machine's `{active, finished}` log to the rows a journal draws, shared by the pause window's Quests tab and the chronicle's, because the L key opening a window with no quests in it was how Mac found that the chronicle had been handed a `questMessages` it never read) - and the SOCIAL PANEL, SOC3, the friends list and the four-seat party interface the chat's Social button opens, with the invitation toast that works while it is shut) - and the SHOP UI REWORK's four DOORS and three ENHANCED SKINS, the merge of 2026-09-20: `tradeDoor.js`, `merchantServiceDoor.js`, `merchantRepairDoor.js` and `tavernDoor.js` fork each of those four windows the way `inventoryDoor.js` already forked the pack, so a host asks `tradeDoorReady()` rather than the classic `tradeArtLoaded()` - enhanced mode reads no ARENA2 at all, and gating it on the classic art flag is what kept the enhanced skin's own trade, tavern and merchant panels (`enhancedTrade.js`, `enhancedTavern.js`, `enhancedMerchantPanel.js`) from ever opening). and the MAP STRIP, EM1, the tab toggle Mac asked for inked on the held sheet itself, with the SLOT under it that says which sheet is live, keeps each sheet's own pan and zoom, and carries the contract whatever is inked answers - and the AUTOMAP'S INK, EM3, a dungeon storey drawn by the hand that drew the Iliac Bay - the wall the outline of what was revealed, the wash the floor walked this run, and the floor strip down the right edge in the tab strip's own hand - and, behind it, the AUTOMAP SHEET and its skin DOOR - the first sheet written to the held map's contract from OUTSIDE the window, and the seventh fork of the shape travelMapDoor.js opened - and the TOWN'S INK, its SHEET and its own skin door, EM4 - the FLD bytes TRACED rather than stamped, the built-up pixels an island whose sea is the street - and the TOWN QUARTERS, EM7, the one home BOTH town maps ask which quarter a byte belongs to and what colour classic paints it: the four byte groups and DFU's four defaults sat in `ui/inkTown.js` AND in `ui/exteriorAutomapWindow.js` at once, which is how the same building could have come to be drawn as a shop on one map and a house on the next, and the enhanced sheet now DERIVES its four washes and its four name inks from that one table rather than picking them by eye - and the ACCOUNT CARD, ACC1e, at the head of the Online pane: the FLOW (`accountFlow.js`) holds every stage, field and refusal and node can drive all of it, the CARD (`enhancedAccount.js`) walks what the flow says and makes DOM, which is `ChargenFlow`/`enhancedChargen.js` again - and it wears the skin rather than bringing one, because a screen that arrives with its own palette is the drift `enhancedStyle.js` exists to stop; building it is what found that `.fieldlabel` had been reading `var(--ash)`, a token nothing in the tree has ever declared, so every field label in the enhanced skin was inheriting `--bone` - - and TILE1's two: the SAVE TILE (`saveTile.js`, Mac: "a detailed tile based design for your saves... showing your portrait and character information" - one tile the Online, Load and Save panes all draw, which retired three hand-rolled copies of the same four lines) and the CHARACTER'S FACE (`facePortrait.js`, the race-and-gender FACE CIF as canvases, the one home the chargen wizard reads too). - and the STATUS READOUT, STATUS-LIVE, 2026-09-22 (kurkku: "would be nice if the info panel that comes up when you press i didn't pause the game, that way you could quickly check your status while walking around") - `statusBox.js`, DisplayStatusInfo's box with the pause and the chain taken off it: ONE composer where world.js, exterior.js, worldModes' interior arm and dungeonContext each wrote the record-22/health/survival chain out by hand, declaring DFU's own `pauseWhileOpen: false` because a READOUT is the player's (AUDIT-WH R8) and ENH-NOTICE1's panel stands at the EDGE of the screen, where the modality it inherited from the centred parchment stopped meaning anything. Its live half - which box is up, the host's own door back out of its slot, and the yield that hands that slot to any key which raises a window - is `systems/statusReadout.js`, a leaf, because `ui/input.js` owns the one door every window key comes through and is already inside this module's import ring - and the PLAYER TRADE WINDOW, TRADE1 (`enhancedPlayerTrade.js` behind `playerTradeDoor.js`, a DOM door in the enhanced skin alone) -
183 modules
live under `src/ui/`. Items still routed here are
collected in `01-Overview/Port-Ledger.md` section C; scope in
`01-Overview/Port-Doctrine.md` phase plan.

THE ENHANCED SKIN is the second lane on this page and its own thing:
`systems/uiSkin.js` chooses, ENHANCED BY DEFAULT, and `?skin=classic`
overrides for one page load without persisting (the 25 probes in
`tools/` pin classic geometry). Three surfaces wear it - U49 the front
door, U50 the character-creation wizard, U51 the PAUSE DOOR - and each
is the same `ui/enhancedMenu.js` or `ui/enhancedChargen.js` mounted by
the game and by its prototype page, never a second copy of the design.
U52 opened the first IN-GAME screen (the CHARACTER SHEET) and U53 the
second (the PACK, with the SLOT MAP). LV1 gave the LEVEL-UP its own face: THE
ASCENSION, which is not a framed panel but the whole
screen over the skin's own dithered night - the eight attributes as one
constellation, a point lighting a star - and which holds no law, driving
the rollout screen `ui/charSheetDoor.js` built through that screen's own
`input`. The windows still behind them -
the spellbook, the travel map, the journal, the HUD - are classic, and
the sheet PUSHES three of them as canvas children under its own DOM,
which is the contract every screen after it inherits. U54 gave the DOM
its own door to the TEXTURE archives (`ui/textureCanvas.js`), so the
pack draws real item icons - the middle link between the reader and
`ui/bitmapCanvas.js` that the port had been missing since U50 - and U55
added USE. U56 and U57 then took DFU's TRANSFER LADDER and its REMOTE
SIDE out of the classic inventory window into `systems/itemTransfer.js`
and `systems/inventorySession.js`, because a second screen needed them
and this port does not copy law; U58 spent that on the pack's REMOTE
PANE, which RETIRED the boundary this paragraph used to state - loot
piles, the wagon and the guild reward picker are the enhanced pane now,
and `CLASSIC_ONLY_MODES` is gone. U59 gave the pack the AVATAR, by
keeping the RGBA composite `ui/paperDoll.js` was already building and
throwing away, and turned the slot map's twenty-seven dots into a named
list of what is worn. `enhanced.html` + `src/tools/enhancedUI.js` is
the prototype for those and is not mounted by anything.

WHAT THIS LANE OWES NEXT is logged at the top of `UI-Arc.md` under THE
BOARD, with the site counts it was decided on - the spellbook first
(five construction sites, one of them hand-rolled), then the journal,
history, the travel map and the HUD, plus the three pieces of residue
on what has already shipped.

AUDIT 18 rewrote this page: its opening paragraph declared the arc
unstarted through the whole U arc. See the note on
`06-Systems/Systems.md` for the pin that now holds both pages honest.
