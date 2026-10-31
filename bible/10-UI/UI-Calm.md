# UI Calm

A pass over Enhanced Plus and DFO Grimoire that makes the interface quieter: the front door asks Online or Offline
first, character creation shows a class before its text, menus have a hierarchy, the default type is readable, and
HUD pieces show when they are relevant. The style sheet is `src/ui/uiCalmStyle.js`, laid after Plus's by
`src/ui/enhanced/enhancedStyle.js` `injectEnhancedStyle`.

## How it works

**The front door** (`src/ui/enhanced/enhancedMenu.js` `drawDoors`). The first screen is two doors, **Online** first,
then **Offline**, each with a line saying what lies behind it. Offline opens Continue, New Game, Load Game and the
Test Room (`HOME_OFFLINE`) and a way back. Settings and Overhauls (`HOME_LINKS`) are plaques in the foot beside
Screenshots and About (`appendPxFoot`). Every visit opens on the two questions; Escape backs out one level. A double
click counts once (`doorBtn`). DFO Grimoire writes the two questions on the book's two leaves, *The Realm* and *Thine
Own Tale*. The classic skin keeps its one list.

**Character creation** (`src/ui/enhanced/enhancedChargen.js`). Classes stand under Magic, Stealth and Combat
(`CLASS_WAYS`, found by the career's key, not its shown name), each row naming its two leading attributes
(`leadingAttributes`). The card shows the class's profile from its CLASS*.CFG numbers: attribute bars, primary and
major skills, and hit points a level. **Begin your life** is the action bar's far end, Start over beside Back
(`stageSecondary`). Reading a class is quiet (`classCalm`): the drums sound when the class is chosen, not when it is
read. Province names on the map are plates in screen pixels, moved apart up and down where they would touch
(`untangleLabels`).

**Menus.** The Stable card (`src/ui/holdingsPages.js`) puts care first, stats under a small head and the look last,
behind a **Change look** press that opens swatches (`LOOK_SWATCHES`) and steppers. The pause window's tabs stand on
one row where the window is wide.

**Readability.** The dim ink is lighter under Plus (`--dim`), and words a player must read have a 12 px floor. Every
color the sheet sets is Plus's alone, so DFO Grimoire inks its own. Grimoire draws no dotted rules
(`src/ui/grimoireDress.js` `RULE_UNDER`).

**The HUD.**
- The saddle panel (`src/ui/enhanced/enhancedSaddle.js` `saddleShown`) is a block in the bottom-right corner, lifted
  over the vitals and hotbar only where it would cover them (`placeBar`, `placeTouch` on touch). **F2** shows and hides
  it (`SaddlePanel`, rebindable) and the choice is kept (`saddlePanelOpen`). Hidden, it shows one line when the rider
  must act (`saddleAlert`) and the horse's name for the first six seconds in the saddle (`SADDLE_HELLO_MS`). The
  Horse care row's **Saddle panel** part chooses When needed (default), Always or Off.
- The temperature is the caption of the quick block in the bottom-left (`src/ui/enhanced/enhancedHud.js`), a HUD
  piece of its own (`temp` in `src/ui/hud/hudLayout.js`). Comfortable, it shows the glyph and the number alone.
- **Calm HUD** (Features `calm-hud`, pref `hudCalm`, on by default): the health, fatigue and magicka bars fade while
  all three are full and no foe is targeted, after `VITALS_REST_S` (4 s), and return at the first point lost. They
  never fade while the HUD is being arranged.

**The Firmament window** says why a read failed (`src/ui/firmamentWindow.js` `readFailText`): no Firmament on the
service, a closed switch, no session, or the status, instead of showing empty purses as if they were the answer.

## Rules

- Online first, Offline second on the front door; Continue, New Game and Load Game live under Offline.
- The default must be readable without font or size settings.
- Information shows when it is relevant: the saddle panel and the vitals hide when there is nothing to act on.

## Code and tests

- `src/ui/uiCalmStyle.js` - the sheet: `CHARGEN_CSS`, `SETTINGS_CSS`, the type floor
- `src/ui/enhanced/enhancedMenu.js` - the two-question front door
- `src/ui/enhanced/enhancedChargen.js` - class ways, the class card, quiet browsing
- `src/ui/enhanced/enhancedSaddle.js` - the saddle panel
- `src/ui/enhanced/enhancedHud.js` - Calm HUD and the temperature caption
- `test/ui/enhanced/uicalm.test.js` - all of the above

## Open

- The spellbook, travel map and journal windows, and the online character list's cards, keep their older look; the type
  floor reaches them only where they share the skin's classes.
