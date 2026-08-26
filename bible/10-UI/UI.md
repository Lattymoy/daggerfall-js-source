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
BANK'S HOUSE MARKET).
69 modules
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
U52 opened the first IN-GAME screen: the CHARACTER SHEET. The windows
still behind it - inventory, the spellbook, the travel map, the
journal, the HUD - are classic, and the sheet PUSHES three of them as
canvas children under its own DOM, which is the contract every screen
after it inherits. `enhanced.html` + `src/tools/enhancedUI.js` is the prototype
for those and is not mounted by anything.

AUDIT 18 rewrote this page: its opening paragraph declared the arc
unstarted through the whole U arc. See the note on
`06-Systems/Systems.md` for the pin that now holds both pages honest.
