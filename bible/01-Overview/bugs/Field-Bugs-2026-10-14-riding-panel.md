# FIELD BUGS 2026-10-14 - the riding panel and the horse care switch

One Discord thread from the bug-reports channel, 2026-10-14, handed over with its screenshot and read on the code as
it stands at main's `7c291d36`: "Riding Window is not able to be edited in the HUD Editor (Alt+U)" - "(also the horse
care toggle in the settings menu doesn't seem to work)". The screenshot is the HUD editor open: dashed frames, names,
corner squares and X presses on the compass, the boss bar, the target bar and the temperature plate - and the riding
panel under the compass ("Riding", Breath 100%, Hunger Fed 8h, Bond, Feed oats (16), Stable, View MOUSE4, Dismount)
with no frame at all.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Riding Window is not able to be edited in the HUD Editor (Alt+U)" | the saddle panel (STEED-UI, 2026-10-11) never joined HUD-MOVE's list of pieces (2026-10-01): the editor frames only what the list names - nor did its twin, the helm panel | fixed (HUD-SADDLE; the helm, HUD-HELM, Mac's word) |
| 2 | "the horse care toggle in the settings menu doesn't seem to work" | off the line the switch worked at every door it governed; online the row was forced on and locked - the design as it stood | Mac's word: three tiers on the one key, each the player's own online (HORSE-CARE-SWITCH, HORSE-TIERS) |

## HUD-SADDLE: the riding panel is a HUD piece (1)

`src/ui/hud/hudLayout.js` HUD_PIECES, ghostOf, buildGhost; `src/ui/enhanced/enhancedSaddle.js` drawEnhancedSaddle,
buildSaddlePreview.

FOUND. HUD-MOVE finds every piece it moves by a selector in one list
(`hudLayout.js:"export const HUD_PIECES = Object.freeze(["`) - "ONE SEAM, NO HOST EDITS": the modules that build the
pieces tell it nothing, so a piece the list does not name is never marked, framed, moved, sized or turned off. The
saddle panel (`ui/enhanced/enhancedSaddle.js`, `10-UI/Controls.md` THE SADDLE PANEL) shipped ten days after the list and was never
given a row in it. It stands in a layer of its own over the whole screen (`.saddlepanel`, pointer-blind), its bar
(`.saddlepanel-bar`) under the compass inside it. So Alt+U framed every listed piece around the panel and left the
panel as its sheet stands it: nothing could move it off the compass's foot, size it, or turn it off. The panel's own law
was never wrong; it was simply not one of the pieces.

FIXED.

- **The bar is a piece**: `hudLayout.js:"{ id: 'saddle', sel: '.saddlepanel .saddlepanel-bar'"` - "Riding panel" over
  its corner, moved by a drag, sized by its corner square, turned off and on by its X, put back by a double-click,
  saved with the rest of the layout and put back by Reset, as every piece is. The piece is the bar, not its layer - the
  layer is the whole screen. No `dummy`: the panel is built only when there is a ride to show, and a window over the HUD
  covers it as it covers the HUD.
- **Placed from its first frame**: the panel is built anew each time its rider mounts (`hideEnhancedSaddle` takes it
  down at the dismount, a door, the skin), and the editor's sweep runs on a 250 ms clock (PERF-HUD1). So the builder asks
  for a sweep the moment it puts the panel on the page, through the leaf MOVED-NOTICE built for the notice stack
  (`enhancedSaddle.js:"placeHudPieces(doc);   // HUD-SADDLE"`): a moved panel never stands a frame at the sheet's place,
  and one turned off never shows. The leaf, not `ui/hud/hudLayout.js` itself - the editor's previews reach the gate's, the
  party's and the codex's hosts.
- **A preview while nobody rides** (HUD-PREVIEW's law, Mac: "show in unlocked mode all notification popups and everything
  else that can pop up"): `buildSaddlePreview` builds and paints the panel's own nodes - the live panel's one builder and
  one painting, split into `build` and `paintSaddle` for it - on a sample read named "Riding panel (preview)", and never
  touches the live panel's slot. On a touch device it stands at a finger's place, where the hosts' own panel does
  (`isTouchDevice`, the very question `ui/touch/touch.js` attachTouch asks). Its stand-in is the layer and its piece the bar
  inside it, so HUD-MOVE's test for a stand-in reads a node's layer as well as the node
  (`hudLayout.js:"const ghostOf = (n) =>"`): the whole stand-in leaves when a rider mounts or the HUD is locked, and the
  next sweep never mistakes the preview's bar for a real panel.
- **A fake that lied, told the truth** (`test/invdrag.mjs`, the pack's suites' document): its selector reader took an id
  and an attribute (`#fps-counter`, `[data-hm-ghost]`) for nothing at all, so either matched every node - and the
  notice stack's builder runs HUD-MOVE's sweep, so under ghostOf the locked sweep took the whole fake page for its
  stand-ins and took it down (five of the pack's pins red; a browser was never touched by it). It reads both as a
  browser does now, and every suite on it (74 files) passes.
- **Its two words go through t()** (L10N4's ratchet - no file holds more hard-coded English than it did):
  `menu.hud.piece.saddle` and `menu.hud.preview.saddle`, drafted in-session for the 25 languages
  (`tools/l10nInSession.mjs`).

THE FOUR HOSTS. `scenes/world.js` and `scenes/exterior.js`, the hosts that ride, draw the panel only through
`scenes/saddleHost.js` createSaddleHost into `ui/enhanced/enhancedSaddle.js` drawEnhancedSaddle - the one builder, and it places
itself; the sweep that frames it is started by the enhanced HUD every host draws (`ui/enhanced/enhancedHud.js` tickHudLayout).
`scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` (dungeons) stand no transport - a building or a dungeon
puts the rider on foot (`systems/transport.js` dismountOnTransition) - and draw no panel: named, not wired. No host was
edited.

THE HELM PANEL (HUD-HELM, 2026-10-15, Mac: "Yes, same branch"). The helm panel (`ui/enhanced/enhancedHelm.js`, CSA-L) is the
saddle panel's twin - the same whole-screen layer, its bar at the same place under the compass - and stood outside
HUD_PIECES as the saddle did. Recorded here as not changed, and Mac's word was to change it on this branch. It is the
saddle's fix to the letter: the piece (`hudLayout.js:"{ id: 'helm', sel: '.helmpanel .helmpanel-bar'"`, "Helm panel"),
placed on build (`enhancedHelm.js:"placeHudPieces(doc);   // HUD-HELM"`), and a preview while nobody is at a helm
(`buildHelmPreview`, its own nodes AND its own holds - a trim held on the live panel is the live panel's). Its build and
its painting split the saddle's way (`build`, `paintHelm`); the live panel's frame is the same frame. THE SEA'S TARGET
CARD (`ui/naval/navalHud.js`) stands under the bar wherever it is moved: it measured the bar's foot for its head already (NAV-F
- a moved bar's box carries the move), and now its centre stands on the bar's centre too (`cardCentreUnder`, held so the
card at its scale stays on the screen) - it had stood at the screen's centre whatever the bar did. A bar turned off in
play keeps its box with its visibility hidden, so the card asks whether the bar is seen (`standing`) and, where it is
not, stands at the compass's foot as with no helm. The four hosts: `scenes/world.js`, the only host with a sea, draws
the helm and the card; `scenes/exterior.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` draw neither. No host
was edited. The panel reads its keys' names from a leaf, `systems/comeSailAway/comeSailAwayActions.js` (the sea's module re-exports
it), and its hulls' from INT1's, `systems/comeSailAway/comeSailAwayHulls.js`: the editor's preview reaches the panel's module, and
the names read from `systems/comeSailAway/comeSailAway.js` carried the sea's whole law onto the HUD's graph, as far as the quest
machine's `place.js` that AUDIT GUIDE O6 keeps off it. Pinned by `test/ui/enhanced/hudhelm.test.js` (5); mutants
`tools/mutants/hudhelm.json` (10, all dead). The fake page the
two suites share is `test/hudPage.mjs` (one home: it was this file's own).

Pinned by `test/ui/enhanced/fb1014_ridingpanel.test.js` over a page that answers the selectors HUD-MOVE asks, descendants among them,
with the real sweep, the real panel and the real editor's key and X: a panel built at a mount stands at its saved
place and size, or off, with no sweep between; Alt+U frames it with its name and its X saves it off and on; the preview
stands while nobody rides, leaves whole for the real one and at the lock, and stands at a finger's place on a phone;
one builder, the two riding hosts through the one glue, the other two drawing none. Mutants
`tools/mutants/fb1014_ridingpanel.json` (7: no piece, the build's placing dropped, no preview, the stand-in read as a
real panel, the preview mounted as the live one, the preview never a finger's, the X saving nothing - all dead).

## HORSE-CARE-SWITCH: the toggle traced, and Mac's word on it (2)

`src/systems/features.js` 'horse-care'; `src/systems/upkeep/upkeepSwitch.js` horseCareRules; `src/systems/upkeep/upkeepTiers.js`.

THE REPORT. "(also the horse care toggle in the settings menu doesn't seem to work)" - no more is said, and the
screenshot shows horse care on (Breath, Hunger, Bond and Feed oats are its).

TRACED, on every arm the toggle could fail on. Off the line the switch took effect at once at every door it governed:
the key the tile wrote was the key the switch read, read live on every call, and every door asked it - the upkeep's
keep and breath, the gallop's gate, the walk, the ride's pace, the HUD's breath bar, the Stable card, the saddle
panel's read, and Feed and the oats' Use. Online the lane forced the row on and the tile was locked, so a player online
who pressed it saw nothing change. That was the design as it stood, not a fault with a root to fix, and turning it
into a player's choice online was Mac's call. The panel itself is the ride's (its title, gait and pace, Stable, View,
Dismount), not horse care's (`10-UI/Controls.md`, THE SADDLE PANEL), and its X now turns it off (HUD-SADDLE).

MAC'S WORD (HORSE-TIERS, 2026-10-15): "Allow turn off. Rework this system to be more in line with how we handle
climates and calories boons." So the switch is three tiers on its one key, as Climates & Calories' is: Off (DFU's
horse), Boons - the default - (care earns, neglect costs nothing, never below DFU's horse) and Hard (the system as it
stood), each player's own online as every Climates & Calories tier is. A stored Off stays Off, a stored On lands on
Hard, and a player who never touched it plays Boons. Every door asks the tier through one accessor
(`upkeepSwitch.js:"export const horseCareRules = () =>"`). `06-Systems/Horse-Care.md`, The tiers; pinned by
`test/systems/horsetiers.test.js` (7) and `tools/mutants/horsetiers.json` (20, all dead).
