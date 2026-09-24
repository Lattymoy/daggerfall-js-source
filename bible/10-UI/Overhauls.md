# The Overhauls (OVH1-OVH3, 2026-09-24)

Mac: "A new option on the main menu that opens to show 3 large panels. These
panels will have directional arrows allowing you to switch being different
feature sets ... 1. Texture Overhaul 2. Sound Overhaul 3. UI Overhaul. These
overhauls need to adapt to online with ease. Online specific UI's will need to
remain as these cannot be adapted (unless you find a way). Our first overhaul
option will be the file attached. Along with this classic options and enhanced
options should be in." Then: "Remove the unneeded overexplaining text at the
top" and "Currently there are no texture packs, it should be empty."

## OVH1 - the screen

`Overhauls` is a rail door on every menu (boot, classic, pause) and a pause
System pane. Three cards, one look each; the arrows (and Left/Right on a
focused card) BROWSE, the button WEARS - a look that reloads the game is never
worn by a stray arrow. `systems/overhauls.js` is the registry and the only
writer; `ui/enhancedMenu.js paneOverhauls` draws it (`.look-*` rules).

- **Texture** - the texture packs. None ships yet, so the card stands empty
  ("No texture packs yet."): it is a pack's door, not a second face on the
  Features switches (OVH1b).
- **Sound** - Classic / Enhanced: the port's own sound switches taken together
  (`enhanced-sounds`, `mod-immersive-footsteps`), set as Daggerfall has them or
  as the port adds them. The card reads the SAME Features rows it writes, so a
  mix made on Features reads back as "Custom", never as a lie.
- **UI** - Classic / Enhanced / GrimoireUI: the skin, and on the classic skin
  the UI pack worn over it. Wearing one reloads (the two skins are two hosts);
  the choice rides the URL when the shelf refuses the write (SKIN-CARRY's law,
  `uiChoiceUrl`).

## OVH2 - GrimoireUI, the first UI pack

GrimoireUI 1.2 (LordSquacquerone, Nexus mod 1222) is a LOOSE-FILE pack -
`vendor/grimoire-ui/` (README, the archive's own listing) and
`public/art/grimoire-ui/` (the files, byte for byte). `systems/uiPack.js` reads
the listing and answers a URL by the name DFU asks for (TextureReplacement.cs:
`Img/<NAME>.png`, `CifRci/<FILE>_<r>-<f>.png`, the save window's colour
textures, `Fonts/FONT000N-SDF.ttf`). It is worn only over the classic skin and
never under a URL skin override (the probes' door); `?uipack=grimoire` wears it
for one page load.

THE SIZE LAW (ImageReader.cs:306/321): a replacement keeps the CLASSIC size as
its logical size, so every layout, hit rect and sub-rect stays classic over the
pack's pixels. The doors:

- `ui/packArt.js` - the pack's PNG on the GPU, uploaded smooth (a 3x picture
  at an integer screen scale is a non-integer ratio) and `alpha` - the
  renderer's per-texture law (`uploadTexture(..., { alpha: true })`,
  `screenQuadBlends`'s `alphaArt`): the pack is soft-edged where the classic
  art was a 1-bit cutout, and the texture carries that to every draw of it.
- `nativePanel.loadImg`, `hud.js`'s loader and `chargenArt.loadOne` ask it
  first (the raw classic bitmap is still read: the size, the fallback, and
  TAMRIEL2's click mask and CHGN00I0's palette cycle, which the pack lacks).
- The paper doll composes without its SCBG when the pack carries it and draws
  the pack's backdrop under the composite; the HM1 masks hole through to it.
- `messageBox.buttonTex` - BUTTONS.RCI 0-37 (its 21-37 are Roleplay &
  Realism's labels redrawn; the pack wins them).
- `saveWindow` - TryImportTexture's panels and buttons over their colours.
- `text.js` - DFU's SDF arm (DaggerfallFont.IsSDFCapable, when
  GUI/SDFFontRendering is on): the face's advance x GlyphHeight/45, spacing 0,
  the baseline at GlyphHeight - 2, UTF-32 with '?' for a missing code, and the
  shadow at 0.4 of its offset (`nativePanel.shadowText`). The face is
  rasterised once into a white alpha atlas the renderer blends.

Not in the pack, so classic: MAIN00/01 (the large HUD), the travel map's
TRAV0I01 mask, and every screen the pack never drew. Nine of its pictures
(GNRC00I0, INVE02/05/09/13/15, LAMP00I0, MAP100I0, TMPL00I0) are screens the
port never draws.

## OVH3 - online

The skin is the PLAYER'S online (`onlineLane.js ONLINE_FORCED_PREFS` no longer
holds it). It was forced to 'enhanced' only because the online panels were
built under that skin; they mount on EITHER skin now - the chat and the names
over heads (`scenes/world.js chatStart`, `nameLayer.nameLayerWanted`), the
friends and party panels, the F-menu, the profile and the page, and player
trade (`playerTradeDoor.playerTradeReady`) - and keep their own face over the
classic screens, so the UI Overhaul a player chose is the one they play online.
The world's enhanced lane is unchanged: the outdoors, water, combat visuals,
loot rarity and the room's mod switches stay the room's.

## OVH4 - the party rest on any UI

Mac: "How do we make it where it's not solo rest for other UI's" - and chose
"A". Until OVH4 a classic-skin rest in a party was a solo rest (ONLINE-REST1's
classic arm): world.js gated the vote, the reset, the tally, the mirror and the
broadcast rest on the enhanced skin, because classic's `RestWindow` carries none
of the party's arms - a follower's Stop that stops the rester (`onManualStop`),
the unrested close that frees the next vote (`onClosedUnrested`, PARTY-REST29)
and the stack's Tab close (`stopOrClose`). With OVH3 letting a player wear
Classic or GrimoireUI online, that player's party slept apart.

A party's rest is an ONLINE window now, like the chat and the player trade: the
rest door (`ui/restDoor.js createRestWindow`) opens the party card on either
skin when the host says the rest is the party's (`deps.partyRest()`). The host's
one question is world.js `partyRestHere` - online, in a party, and not in a
tavern, temple or guild hall (TAVERN-REST1/GUILD-REST1) - the gate's own two;
the outdoor rest, the building's (`worldModes.js interiorRestDeps`), the
dungeon's (`dungeonContext.js _restDeps`, through the mode machine) and every
mirror ask it. The five skin gates are gone. A solo or offline rest on the
classic skin keeps Daggerfall's own window, byte for byte.

Pins: `test/ovh4_partyrest.test.js` (the real door under a fake document and a
real skin choice; the hosts' wiring by source). Mutants:
`tools/mutants/ovh4.json` (15, all dead).

Pins: `test/overhauls.test.js`; the browser probe `tools/overhaulsProbe.mjs`
(20 checks: the three cards at a desktop and a phone, browse vs wear, Custom,
GrimoireUI's art decoded, the reload onto the classic skin wearing the pack).
