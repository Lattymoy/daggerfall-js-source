# Overhauls

The **Overhauls** screen picks the game's look in three parts: textures, sounds and the interface. It is a door on
every menu rail (boot, classic, pause) and a pause System pane. The UI card offers four looks: Classic, Enhanced Plus,
GrimoireUI (a texture pack over the classic skin) and DFO Grimoire (the enhanced skin in GrimoireUI's dress).

## How it works

**The screen** (`src/systems/overhauls.js` `OVERHAUL_PANELS`, the registry and only writer; drawn by
`src/ui/enhanced/enhancedMenu.js` `paneOverhauls`). Three cards. The arrows (and Left/Right on a focused card) browse;
the button wears. A card reads the same rows it writes, so a mix made elsewhere reads "Custom".

- **Texture** - Classic, or Vanilla Enhanced (`07-Rendering/Vanilla-Enhanced.md`). Classic switches every texture mod
  off and keeps it registered. Vanilla Enhanced switches its Base on with Replace Game Artwork and the add-ons it was
  last worn with; its add-ons (Masked Roads, Snowless Swamps and Jungles) show as switches while it is worn. It is the
  look on a fresh game.
- **Sound** - Classic or Enhanced: the port's sound switches taken together (`enhanced-sounds`,
  `mod-immersive-footsteps`). Takes effect at once.
- **UI** - Classic, Enhanced Plus, GrimoireUI, DFO Grimoire. Wearing one reloads the game. A choice the prefs shelf
  refuses rides the URL (`uiChoiceUrl`).

**GrimoireUI** (LordSquacquerone's pack, `vendor/grimoire-ui/`, files in `public/art/grimoire-ui/`) is a loose-file
pack worn only over the classic skin. `src/systems/uiPack.js` answers a URL by the name DFU asks for (`Img/<NAME>.png`,
`CifRci/...`, `Fonts/FONT000N-SDF.ttf`). A replacement keeps the classic size as its logical size, so every layout and
hit rect stays classic. `src/ui/packArt.js` uploads its PNGs smooth with alpha. The native panel loader, the HUD loader,
chargen art, message box buttons, the save window and `src/ui/text.js` (DFU's SDF font arm) ask the pack first. Screens
the pack does not draw stay classic. `?uipack=grimoire` wears it for one page load.

**DFO Grimoire** is the enhanced skin with a dress: `plusDress: 'grimoire'` on the shelf,
`<html data-plus-dress="grimoire">` on the page. Every mount site still asks `isEnhanced()`; nothing forks.
- `src/ui/grimoireArt.js` cuts the pack's shipped pictures at run time (page, scroll, desk wood, frame, shelf box,
  marble, Exit press, vials, compass) onto Daggerfall's 320 x 200 grid (`toGameGrid`) and lays them on the root as
  `--grim-*` variables. Fixed-size windows draw at fixed whole-pixel scales; full-screen surfaces grow with the screen.
- `src/ui/grimoireDress.js` lays three sheets over every enhanced sheet: the face (the pack's Alagard, sizes snapped to
  its 16-unit em, never smoothed), the kit (every `FRAME_ROLES` surface as page, scroll, shelf box, plank or tab plate;
  `GRIMOIRE_KIT_CSS`), and the ink (light words on stone become brown ink on paper; set, rarity and sigil colors are
  mixed into the ink).
- Layout follows the pack: the front door is the Biography desk with its doors on the open book, the pack window keeps
  the pack's roster, list-beside-page windows are the desk's book, choice scrolls unroll (`markGrimoireUnroll`), the
  Tab dial's doors are symbols (`DIAL_ICONS`), bars are the pack's vials, and the vitals stand upright in Daggerfall's
  order.
- The card adds Pages (cream page or tan scroll), Backdrop (desk or map), Vitals (upright or in a row) and Spellbook
  (DFO's book or GrimoireUI's own, `grimoireSpellbook`). Under the dress the enhanced spellbook plays Daggerfall's
  OpenBook and PageTurn sounds (`markGrimoireBook`).
- While it is worn the Plus color stands at Slate; the player's own color stays on the shelf
  (`src/ui/enhanced/enhancedPlusStyle.js` `applyPlusTheme`).

**Online.** The skin is the player's online. The online panels (chat, names over heads, friends, party, profile,
player trade) mount on either skin with their own face. A party's rest is an online window too:
`src/ui/restDoor.js` `createRestWindow` opens the party card on either skin when the host says the rest is the party's
(`partyRestHere`: online, in a party, not in a tavern, temple or guild hall). A solo or offline rest on the classic skin
keeps Daggerfall's window.

## Rules

- Overhauls is a menu option with three large panels (Texture, Sound, UI) browsed by arrows; overhauls adapt to
  online, and online-only panels keep their own face (Mac).
- No over-explaining text at the top of the screen (Mac).
- Vanilla Enhanced ships in the repository under the doctrine's one recorded exception, and is on by default (Mac).
- A party's rest is never solo on another UI (Mac).
- DFO Grimoire keeps GrimoireUI's style, roster and vitals and offers everything Enhanced Plus has (Dudey).
- Grimoire stays pixelated and high quality; its scrollbars are quiet (Dudey).
- No new art is committed for the dress except three files, each with its doctrine row: the dial's chest
  (`public/art/grimoire-dial-chest.png`), the detailed desk (`public/art/grimoire-desk.jpg`, `grimoireDeskUrl`) and the
  soft wood tile (`public/art/grimoire-wood.jpg`, `WOOD_TILE`). The pack's own pictures stand in if a file cannot load.

## Daggerfall Unity

GrimoireUI is a DFU mod; we read it the way DFU's `TextureReplacement` and `ImageReader` do (name lookup, classic
logical size, SDF fonts per `DaggerfallFont`). DFU has no Overhauls screen and no enhanced skin; DFO Grimoire is ours.

## Code and tests

- `src/systems/overhauls.js` - the three cards and their options
- `src/systems/uiPack.js`, `src/ui/packArt.js` - GrimoireUI over the classic skin
- `src/ui/grimoireArt.js`, `src/ui/grimoireDress.js` - DFO Grimoire's art cuts and sheets
- `src/ui/restDoor.js` - the party rest on any skin
- `test/ui/overhauls.test.js` - the screen, browse versus wear, Custom
- `test/ui/grim1_dress.test.js` - the dress, grid, bars, ink, desk and wood
- `test/scenes/ovh4_partyrest.test.js` - the party rest on either skin
- `tools/overhaulsProbe.mjs`, `tools/grimoireDressProbe.mjs` - the screen and the dress in Chromium

## Open

- The desk's and the wood's doctrine rows (`test/tooling/doctrine.test.js`) await Mac's note of where the earlier
  build's painting came from.
