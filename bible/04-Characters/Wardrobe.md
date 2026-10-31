# The Wardrobe

A character collects the look of every armour piece, shield and weapon they hold, and can dress a worn piece in any
collected look of its kind. It is sideways progression: a look changes only how a piece is drawn, never its numbers.
The player meets it as a **Wardrobe** row on the popup of a Clothing Store, an Armorer or a Weaponsmith, and as the
Appearances part of Collections.

## How it works

- **A look** (`src/net/appearanceLaw.js`) is a template, a material and a style (DFU's variant): what every renderer
  draws a piece from. Two pieces drawn alike are one look. `ALL_LOOKS` holds every look a mint can make: 473, keyed
  `t.m.v`.
- **Kinds.** A piece takes only a look of its own kind (`APPEARANCE_KINDS`, `pieceKind`): each armour slot, shield,
  dagger, short blade, long blade, two-handed blade, one- and two-handed axe, mace, flail, warhammer, staff, bow. A
  weapon's kind matches its classic sheet, Morrowind group and hands, so a look never changes a swing.
- **Not looks.** An artifact's own art and a Gilded piece's gold are not collected (they can wear a look). Guns draw one
  picture and neither give nor take a look. Roleplay & Realism's templates are never looks, but its pieces take a
  classic look of their kind.
- **Collecting** (`src/systems/appearances.js` `noteHeldLooks`). The pack, wagon and Materials Bag are swept once a
  frame from the HUD and when the Wardrobe opens, so every way a piece arrives collects its look. The collection is the
  character's, saved as `entity.appearances`. It is cosmetic, so the client's word is enough.
- **The window** (`src/ui/wardrobe/wardrobeWindow.js`, wired by `src/scenes/wardrobeCounter.js` and
  `src/scenes/shopRows.js`). It lists worn pieces that can take a look (`wardrobePieces`); for the one picked it shows
  its own look (free) and every collected look of its kind with a fee and **Wear**. **Try** previews the character
  wearing it (`src/ui/wardrobe/wardrobePreview.js`): the Morrowind body on Enhanced Plus where one stands, else the
  paperdoll. Nothing is paid until **Wear**.
- **The fee** (`wardrobeFee`): a twentieth of the look's minted value (`WARDROBE_FEE_SHARE`), at least 25 gold
  (`WARDROBE_FEE_MIN`). The piece's own look back is free.
- **Drawing.** `drawnPiece(item)` is the piece as drawn: a copy in the look's template, material and style, its
  enchantments kept, never handed to a number. The paperdoll, the Morrowind body and arms, Layered Gearing, the classic
  first-person sheet and Diverse Weapons, the Weapon and Shield Widgets and the head portrait's helm all draw it. The
  Info box says the look ("Looks like Ebony Katana", `lookLine`).
- **Online.** A peer's item carries `ap` (`[t, m, v]`) only when it wears a look; the relay keeps it only when it is a
  real look of the piece's kind (`validWireAppearance`). A sworn revenant's kit carries its pieces' looks as `la`
  (`foeWireLook`, `src/characters/foeBodies.js`).

## Rules

- No look is stronger: horizontal progression, no gear treadmill (the owner).
- A look is the wearer's mark. Every hand-over (a trade, a death, the market, the guild vault) strips it; the
  collection keeps it, so only the fee is lost.
- The pack's pictures (grid, worn panel, hotbar, hand plaques), sounds and the profile card's names stay the piece's
  own. A weapon's glow is laid on the look.
- A shield's covered parts are its own numbers, whatever look it wears (`coverTemplate`, `isPartShielded` in
  `src/combat/shieldWidget.js`).
- `appearance` is a declared item field (`src/systems/item/itemFields.js`) and a receiver's mark
  (`RECEIVER_MARKS`, `src/net/realm/realmTradeLaw.js`), so the account service judges it but pays nothing.
- A held key's repeat is no press on the classic popups.

## Daggerfall Unity

DFU has no transmog. The row on DFU's classic popups is a port element drawn under the art, as the Portal Stone's row
is; DFU's art and rects are unchanged. Under Diverse Weapons a look copy is not an artifact, so it swings the look's
file: a departure from `WeaponBasics.GetModdedWeaponFilename` for a drawn copy.

## Code and tests

- `src/net/appearanceLaw.js` - looks, kinds, the catalogue, `drawnPiece`, wire validation
- `src/systems/appearances.js` - collecting, fees, wearing, names
- `src/scenes/wardrobeCounter.js`, `src/scenes/shopRows.js` - the counter and its rows
- `src/ui/wardrobe/` - window, door, preview
- `src/ui/collections/appearancesPart.js` - the Collections part
- `test/systems/appearances.test.js`, `appearances_audit.test.js` - the law, the kinds both ways
- `test/ui/wardrobe_window.test.js`, `test/ui/appearances2_preview.test.js` - the window and preview
- `test/net/appearances_wire.test.js`, `test/net/appearances2_kit.test.js` - online

## Open

- A sworn one's kit underground: a dungeon's lane streams no kit, so neither a given piece nor its look reaches another
  screen in a dungeon. `src/scenes/exterior.js` stands no sworn one.
