# Slots, the hotbar and the status widget

How the enhanced skin draws item pictures in slots, what the hotbar holds and does, the status widget of effect
tiles at the left edge, the XP numbers in the Renown bar, and the pack's armor figures and wear comparison. The
classic skin keeps DFU's inventory paper, its HUD's spell icon rows and no hotbar.

## How it works

**The fit law** (`src/ui/iconFit.js`, pure). A picture is fitted to its slot's box in device pixels. The record is
trimmed to its opaque pixels; its longest side is scaled to the box, never past `ICON_CAP` (4) CSS pixels a source
pixel, so a gem does not become a boulder. A whole-number scale is drawn nearest-neighbour, and a scale is snapped down
to a whole number when that keeps `SNAP` (three quarters) of the size. Other scales over one are nearest-neighbour up
then smooth down; a scale under one is a smooth reduction. The picture is made at the exact device size it is drawn
at (`src/ui/textureCanvas.js` `requestFittedPicture`, `fittedImg`), so the page resamples nothing. Each surface's box
is in `SLOT_BOX`.

**The slot is the frame.** A pack grid slot's border is the rarity tier's frame, with the sprite standing on the slot's
ground. Corners: the hotbar key top left, a sigil or set rune top right, tier pips bottom left, the stack count bottom
right, the wear bar along the foot. Worn panels, shelf sockets, hotbar slots and the drag ghost follow the same law;
only list rows (loot, shop, player trade) keep the frame on the picture.

**The hotbar** (`src/ui/enhanced/enhancedHotbar.js`, model `src/systems/quickslots.js`). Ten slots on keys 1 to 0.
- A spell's slot shows its ICON00I0 icon (`src/ui/enhanced/enhancedArt.js` `spellIconPicture`), fitted whole. The
  entry stores the icon, so a spell that left the book keeps its picture, dimmed.
- Any item goes on the bar (`hotbarKindOf`); the press is the pack's own primary act. A consumable is used, a weapon
  readied, a light lit, a shield strapped on. Armor, clothing and jewelry are worn or taken off, unless the piece has
  Cast When Used, in which case it is used (cast). A piece worth wearing as well (armor, another power) is put on
  first and cast once worn (`wornForMore`). Anything else is used through the host's quick use; an item with no use
  says so.
- The lycanthrope's Lycanthropy spell readies free from the bar, as from the book (`freeReady`).
- With the pack or spellbook open, a slot key puts the item or spell under the mouse on that slot, else the window's
  selection (`setHotbarPick`).

**Quick slots row** (Features `quick-slots`, pref `quickbarStyle`, default `hotbar`): Hotbar, Diamond (the same bar
showing slots 1 to 4 in d-pad order at the bottom left; `HOTBAR_STYLES`), Diamonds (the ten-slot bar with
diamond-clipped slots, `hotbarShape: 'diamond'`), and Off (hidden, keys still work). Rim colors are variables each
dress sets on `.hb`.

**The status widget** (`src/ui/hud/hudStatus.js`, drawn by `src/ui/enhanced/enhancedHud.js`). Square tiles at the left
edge, standing on the quick slots block's caption and growing up. One tile an effect:
- a spell: its own icon, framed green when cast on self and red when by another, dashed for an item's held magic,
  rounds at its foot, blinking as it ends (DFU's `HUDActiveSpells` laws);
- a set power: its sigil rune in the set's color (`src/ui/sigilRune.js` `sigilRuneTileSrc`);
- a Climates & Calories need: a pixel glyph framed amber when felt, red when it costs, its stage at the foot
  ("2/3"); a boon is a green tile;
- poison: one "Poisoned" tile; a disease: a tile named by its contracted message once incubation is over, and one
  unnamed "Unwell" tile while it incubates (`src/systems/diseases.js` `diseaseIncubating`).

Its room is measured twice a second, up to whatever stands above (the chat, an escort's portraits, touch presses);
where the band is too short it stands beside the diamond, or steps aside (`stat-side`, `stat-tight`, `stat-noroom`).
Extra tiles fold into "+N". The widget takes no pointer; the Status box (I) and the sheet say every effect in words.

**The Renown bar** is the vitals' height and shows the level's XP inside it ("5,420 / 13,800 XP", "Highest" at the
cap). On a phone the vitals show their numbers alone.

**Armor at a glance** (`src/ui/armourCard.js`). Each worn panel carries its body part's armor number, the classic
doll's own label. A plaque shows the armor a blow meets on average: each part's number weighted by the struck-part
table of the combat core in force (`src/combat/formulas.js` `struckBodyPartTable`). The item card shows what a wear
would replace (`src/systems/equip.js` `wearLeavers`, the same list `equipItem` runs), a weapon's damage against the one
it replaces, and each affected part before and after, green for better and red for worse.

**Under a window in a dungeon**, the HUD's hide door (`src/ui/hud/hud.js` `hideHudTextSurfaces`) calls
`hideEnhancedHud`, so the bar gives the digit keys to the window.

## Rules

- Inventory slots wear the rarity frame with sprites enlarged properly; the rarity outline is the slot's own border
  (Mac).
- The hotbar shows sprite icons and holds spells and any item (Mac).
- Effects move to their own widget of square glyph tiles, climates and calories included, freeing the bar for XP
  numbers (Mac).
- The hotbar is the default quick slots style (Mac).
- A disease incubating shows one unnamed "Unwell" tile (Mac); the classic skin keeps DFU's (no disease icon).
- A sprite is never rotated to fit a slot.
- Poison minutes and disease days are not shown, as DFU shows neither.

## Daggerfall Unity

- DFU draws spell effects as icon rows (`HUDActiveSpells`); we keep its icons and blink rule and move them to tiles.
- DFU's armor is seven per-part numbers on the paper doll (`PaperDoll.cs` `RefreshArmourValues`) with no total. Our
  plaque is a weighted average, because each blow meets one part drawn from `FormulaHelper`'s struck-part table.
- DFU names a disease only once incubation is over (`CreateHealthStatusBox`) and hides classic disease icons
  (`ShowSpellIcon = false`). The "Unwell" tile is our departure.
- No DFU spell icon pack (`SpellIconCollection`) is read; the 69 classic icons alone.

## Code and tests

- `src/ui/iconFit.js` - the fit law and slot boxes
- `src/ui/enhanced/enhancedHotbar.js`, `src/systems/quickslots.js` - the hotbar
- `src/ui/hud/hudStatus.js` - the status widget's tiles
- `src/ui/armourCard.js` - armor figures and comparison
- `test/ui/enhanced/ui1_slots.test.js` - the fit law and slots
- `test/ui/enhanced/ui3_status.test.js` - the status widget
- `test/ui/enhanced/diamondhb_hotbar.test.js` - Diamond, Diamonds, hover + key
- `test/systems/hb_lycfree.test.js` - the free lycanthropy cast and the default
- `test/systems/fb0929d_accompare.test.js` - armor figures and wear comparison
- `test/ui/hud/fb1018f_dungeondigits.test.js` - dungeon windows get their digits
- `test/ui/fb1019f_unwell.test.js` - the Unwell tile
- `tools/uiSlotsProbe.mjs`, `tools/uiHotbarProbe.mjs`, `tools/uiStatusProbe.mjs`, `tools/renownBarProbe.mjs` - Chromium
  probes

## Open

- Between a key that opens a window and the next frame, the bar still holds the last frame's paused state.
- The dungeon context's own HUD reads its own overlay slot alone, so a street-slot window over the world's dungeon arm
  leaves the bar its keys.
- An unidentified piece's affixes are left out of its comparison; DFU's Strengthens / Weakens Armor channels are read
  as they stand, not re-run for the wear. The shop and player trade draw no comparison.
