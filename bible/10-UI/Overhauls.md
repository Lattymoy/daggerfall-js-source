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
writer; `ui/enhanced/enhancedMenu.js paneOverhauls` draws it (`.look-*` rules).

- **Texture** - the texture packs: a pack's door, not a second face on the
  Features switches (OVH1b - it stood empty, "No texture packs yet.", until
  the first). Classic and Vanilla Enhanced since VE3, shipped since VE4 (below).
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
  AUDIT RETRO1 J7 (its second pass, fixed 2026-09-24): on a lost context a
  browser on the old WebGL IDL hands back a null texture, and the flag's
  `WeakSet.add(null)` threw - every pack upload a TypeError that took over
  the context-lost notice, where a classic upload does nothing. The flag is
  set on a texture only (`test/ui/auditretro2.test.js`).
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

## VE3/VE4 - the first texture pack (2026-10-05)

Vanilla Enhanced (carademono) is the Texture card's first pack, beside
Classic. `07-Rendering/Vanilla-Enhanced.md` is its record.

**How VE3 and VE4 differ.** VE3 had the player bring the pack: its pictures
are Daggerfall's own remastered, so none of it could ship (Port-Doctrine),
and the card's button opened the `.dfmod` pick first. VE4 ships it, under
the one exception the doctrine records (Mac: "Put it in the codebase"). The
pick and its words (`needsFiles`, `attach`) are gone, and the button wears
the look at once.

**What each look does:**
- **Classic:** wearing it switches every texture mod off and keeps it
  registered; the shipped mods' off is the player's choice, kept after.
- **AUDIT VE (Mac: "Ensure this is on by default"):** Vanilla Enhanced is the
  look on a fresh game - its Base ships on, as Replace Game Artwork does.
- **Vanilla Enhanced:** wearing it switches the Base on with Replace Game
  Artwork, and the add-ons it was last worn with.
- **The add-ons** (Masked Roads, Snowless Swamps and Jungles, and any the
  player attached) stand on the card as On/Off switches while the look is
  worn (`addons`), in the PLUS rows' shape. Classic keeps the choice for the
  next wear.
- **A mix** (DREAM alone, a loose pack) reads Custom, with the card's own
  note (`custom`).

The card's options carry `apply` as the other two cards' do. `by` is a
getter, so the card names the version of the copy registered: the shipped
3.4.7, or a copy the player attached over it. `vendor` names the pack's
folder, which is how the credits reach it.

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

Pins: `test/scenes/ovh4_partyrest.test.js` (the real door under a fake document and a
real skin choice; the hosts' wiring by source). Mutants:
`tools/mutants/ovh4.json` (15, all dead).

Pins: `test/ui/overhauls.test.js`; the browser probe `tools/overhaulsProbe.mjs`
(26 checks):
- the three cards at a desktop and on a phone;
- browse vs wear, and Custom;
- GrimoireUI's art decoded, and the reload onto the classic skin wearing
  the pack;
- VE4's and AUDIT VE's seven, where OVH1b's empty card stood:
  - Vanilla Enhanced in use on a fresh game, the shipped version named
    (AUDIT VE);
  - its two add-ons on the card, off;
  - Masked Roads switched on there and kept;
  - a road tile served under the site root, the 302 set and a tree at the
    texture detail decoded by the pack's own worker (AUDIT VE P1);
  - Classic putting the pack away and keeping the add-on;
  - Vanilla Enhanced worn again with it.
- on a phone, the add-on rows spilling nothing.

## GRIM1 - DFO Grimoire, the enhanced skin in GrimoireUI's dress (2026-10-09)

Discord, the "This usually happens when someho" thread - CLEM: "Grimoir UI is almost amazing ... Sadly GrimUI doesn't
allow me pick up tents. sounds are missing ... No Hotbar ... I want some of the features of enhanced+ just not the
overall look of it"; Skibbster: "More support for grimoire and classic UI in general would be greatly appreciated".
Dudey: "Create a DFO Grimoir UI. Keep the style and soul of Grimoir UI and make it offer everything enhanced plus has
(means supports every window and ui ingame)", then "if it looks anything like enhanced plus ppl will hate it", "keep
the style and roster of grimoire ui", "healthbar/mana/stamina etc all have to stay true to grimoir ui".

**What it is.** The UI card's fourth look. GrimoireUI (OVH2) is the CLASSIC skin with the pack over it, so everything
the enhanced skin carries and the classic one does not - the hotbar, the camps and their tents, the enhanced rest, the
port's sounds, the maps, the world's enhanced lane - stays out of reach there. DFO Grimoire is the ENHANCED skin (every
mount site still asks `isEnhanced()`, nothing forks) with a DRESS over it: `plusDress: 'grimoire'` on the shelf,
`<html data-plus-dress="grimoire">` on the page. Wearing it reloads like every UI look; a refused shelf carries
`?dress=` on the URL (SKIN-CARRY's law). While it is worn the Plus colour stands at Slate on the page and the player's
own colour stays on the shelf for Enhanced Plus (`enhancedPlusStyle.js applyPlusTheme`).

**Nothing new is committed as art.** `ui/grimoireArt.js` cuts the pack's own shipped pictures at run time (a crop table,
a canvas, data URLs laid on the root as `--grim-*`): the cream page (TALK01I0) and the tan scroll (LGBK00I0) made
seamless by a half-shifted cross-fade, the desk's wood (INFO01I0), the window frame (the talk page's torn edge cut off
its board by its own brightness and laid on the wood), the inventory's shelf box, grey marble and red Exit press
(INVE00I0), the list picker's scroll (PICK00I0), the Biography desk's open book (BIOG00I0), and the three HUD vials
(MAIN03I0-05I0), each turned on its side both ways with a drained twin. The face is the pack's FONT0003-SDF.ttf
(Alagard). Until the cut lands, the dress stands in the same tones as flat colour.

**The three sheets** (`ui/grimoireDress.js`), all scoped to the attribute and laid last:
- THE FACE - Alagard over every family the enhanced sheets name; no capitals, no spaced tracking. The face is drawn on a
  16-unit em (every point on a multiple of 64 of its 1024), so every size is moved to 16, 32 or 48px (`snapSize`) and
  it is never smoothed or made bold - each of its pixels whole screen pixels, as hard-edged as the pack's own. A value
  keeps Daggerfall's yellow with its hard edge (the pack's sheet writes "Gold: 7579" so); a chosen line is its red.
- THE KIT - every `enhancedFrame.js FRAME_ROLES` surface repainted: a window is a torn page pinned on a board, a panel
  a sheet of the older scroll, a tile the shelf box, a band a plank, a tab the pack's wooden tab plate; a press on a
  page is WRITTEN in ink (the inventory's Wagon/Info/Equip strip), on wood in the pack's yellow, and the way out of a
  window (Close, Exit) wears the pack's own red Exit frame. Plus's diamonds go. AUDIT CARDS-PLUS (2026-10-13,
  `01-Overview/audits/Audit-Cards-Plus.md`): a tile's chosen, pointed-at and keyboard marks are an outline drawn above its box -
  they were inset shadows, and the shelf box's fill paints over every inset shadow, so on every dressed page a chosen
  tile looked as the rest (C2); a warn press answers the pointer and the keyboard, its red brighter and struck twice -
  its own red had outweighed the hover's (B1); and the card tables' states are re-said in the dress's own colours, as
  the HUD plate's levels are (B1, `11-Multiplayer/Tavern-Cards.md` section 39).
- THE INK - Plus writes light words on dark stone. Every rule of every enhanced sheet on the page (and every sheet
  injected later) is re-said once: inside a page a light word becomes the pack's brown ink (gold its red, a hue its
  hue in ink), a dark ground a faint wash, a stone edge a brown line; on wood and on the desk a grey word warms to the
  pack's tan. Which ground an element stands on is a mark the dress stamps as a surface lands (`data-grim`,
  `data-grim-desk`, and a press's `data-grim-on`), so the re-said rules stay short.

**The rosters** - where things stand, as the pack stands them (CSS only; every press, handler and hit stays Plus's):
- the front door is the Biography desk, its doors written on the open book's two pages ("Thy Journey", "The Realm");
- the pack: the tab plates in one row across the top, the jewellery down the left as pairs of shelf boxes named
  beneath, the body on the grey marble in the middle, the goods in shelf boxes on the right; the item's card a scroll;
- every list-beside-a-page window (the character and system window, the spellbook, the chronicle) is the desk's
  painted book, cut down its spine (`BOOK_SPINE`) so each column wears its own half;
- the rest window and the yes/no dialogs are the list picker's scroll, the three ways to rest across it in a row;
- the Ascend is the character book: the attributes a ledger down the left page, and on its foot one line - the points
  left in their box, then the chosen attribute between its - and + - the skills down the whole right page; the vials and
  the red Ascend on the plank at the foot;
- the talk window as the pack lays it: what you can ask down a scroll on the left, the conversation on the right, the
  speaker's words in yellow and yours in blue;
- the vitals are the pack's three vials standing in the corner in Daggerfall's order - health, fatigue, magicka -
  (or, the card's choice, lying in a row under the hotbar with their numbers on the glass).

The card offers DFO Grimoire's own rows beside the Plus ones it shares (cursor, item hover, controller): Pages (cream
page / tan scroll), Backdrop (the desk / the map) and Vitals (upright / in a row), each worn at once.

Pins: `test/ui/grim1_dress.test.js` (10). Mutants: `tools/mutants/grim1.json` (12, all dead). The browser half:
`tools/grimoireDressProbe.mjs` (8 checks, no ARENA2).

### GRIM3 - the polish (2026-10-10)

Dudey: "the scroll bar looks cheap the tab bar looks cheap ... the book look malformed ... in the ascend the life,stam
and mana bars are weird ... the background in the main menue looks blurry ... it needs to stay pixelated and keep the
soul of grimoire ui but it needs to be EXTREMELY HIGH QUALITY"; then "the book is in a window thats in a window", "the
topic ... i cant even read it", "the notification box is unreadable", "the wooden bars in the inventory look cheap", "the
compas needs to look more like a compass", "hp from enemies and all other bars ... should go down like a fuse", "keep the
style ... POLISH it". A player: "(optionallly) rettain the look of the original GrimoireUI spellbook".

- **One pixel grid.** `ui/grimoireArt.js` brings every crop back to Daggerfall's 320 x 200 grid (`toGameGrid`: each 3 x 3
  of the pack's pixels one pixel), sharpens it there (`SHARPEN`), and the root carries the scales
  (`layGrimoireGrid`): a WINDOW is a fixed size in CSS pixels, so its art is drawn at a fixed scale on every screen -
  `--gp` three CSS pixels to a game pixel, `--gq` two (the bars, the small presses), `--gk` one (the pack's own pixel),
  each in whole device pixels - and a FULL SCREEN grows with the screen: `--gs` (the screen read as 480 x 300 game
  pixels, 2..8) for the Ascend, `--gd` / `--gc` for the desk (Dudey, on a 1440p screen: "the ascend book is thiner
  now", "the healt staming and mana bar in the stats screen a pretty thick"). Every length a picture is drawn at is
  `px(n)` of them (`grimoireDress.js px`), and every element but a photo, a video and a canvas is `image-rendering:
  pixelated` - no surface is ever smoothed or scaled by a part of a pixel beside another. Seams repeat by a half-shifted
  cross-fade worked on the grid.
- **The front door** is the whole desk (candle, inkwell, quill) at `--gd`, the biggest whole scale it fits at, centred
  and falling away into the dark round it, its painted "Biography" lifted off (`DESK_WIPES`); it and its book are
  worked by `clarify` (two unsharp radii, each with a threshold so the smooth paper is never touched, and a slight
  contrast lift on the game's grid) - Dudey: "the main screen background looks like i have not glasses on", then
  "cause of all the filter ... the book looks worse now". Headings on a page are underlined with the pack's own rule
  (the spellbook's ink stroke, `rule`), never a dotted line.
- **The books** (the character and system window, the spellbook, the chronicle) are the pack's painted book lying on
  the desk board - no torn page, no leather slab, no plank between: each page a 9-slice of the painting
  (`BOOK_SLICE`, cut down the spine at `BOOK_SPINE_AT`), so the book keeps its depth and never deforms; each page scrolls
  within itself, down and never across (a long name wraps). The Ascend is the same two pages on its desk.
- **Tabs** are the pack's own inventory tab plate (`plate`, its lettering lifted off by `liftLetters`; the open one
  `plateOn`), at `--gk` - every tab strip of the enhanced kit, the pack's and the talk window's included.
- **Scrollbars** are quiet (Dudey: "less appearing"): three game pixels wide, a faint ruled line for a track and a
  half-clear stroke of ink for the thumb that firms up under the pointer (a pale one on wood).
- **A bar that stays put** while a list scrolls under it (the settings' search and filters, and the others the enhanced
  sheets make sticky) keeps a ground of its own - the page's paper on a page, the desk's wood on the desk.
- **Bars** are the vial at its own pixels - its cork, then a seamless run of its tube (`VIAL_CUT`, `tubeOf`) - never one
  vial stretched: the HUD's row, the foe, breath and grip, the sheet's and the Ascend's meters.
- **What a bar loses drains away** (Dudey, on the fuse this replaced: "we need a different fitting effect thats not
  too much"): the strip a blow, a spell or a sprint took stays a moment as the vial's own liquid gone dark and drains
  back at the game's own pace - no flame, no spark.
- **Planks** (a window's head and foot) are the desk's grain in a black outline, lit and shaded a pixel each, laid inside
  the torn page - never run on under it. **The notice** is written in ink alone (Plus's dark word shadow doubled every
  letter).
- **The compass** is the pack's own: its strip (COMPASS) under its gilded dome (COMPBOX), on the game's grid at `--gq`
  (Daggerfall's own size - "still a bit too big" at the pack's 3x), the box turned over to hang from the screen's top; the HUD says the heading (`--hud-heading`) and the strip slides by it.
- **The scrolls unroll** (`markGrimoireUnroll`): every choice scroll opens from their two rods together
  in the middle, the rods (`rodL`, `rodR`) landing on the scroll's own; closed, a likeness of the scroll rolls back up
  where it stood (`rollUpGrimoireScroll`) - a scroll re-drawn in the same beat is neither. The rods ride the clip's own
  edges, moved the same way it is (never one on the compositor and the other on the page, which drift apart while the
  game draws), and the writing fades with the parchment.
- **The spellbook's noises** (a player: "I REQUIRE the little book noises to stay INTACT", then with a video: "I was
  thinking mostly spellbook"): GrimoireUI rides the classic spellbook, which opens with Daggerfall's OpenBook and shuts
  with its PageTurn; the enhanced spellbook never did. Under the dress it plays both (`markGrimoireBook`, `bookSound`),
  choosing a spell silent as in the classic; no other book makes a sound.
- **Every choice scroll** (`UNROLL_SEL`): the rest window, the questions (yes or no, a line to type, a list to pick
  from), a service's short menu (a guild hall's, the coven's, the ships' and houses' for sale, the transport's) and a
  confirm inside a window are the pack's choice scroll, its words in ink - and each unrolls as it opens and rolls up as
  it closes.
- **The card's Spellbook row**: the DFO book, or GrimoireUI's own (`grimoireSpellbook`, `<html data-grim-spellbook>`) -
  the pack's spellbook picture (`spbk`, its foot words lifted, `SPBK_WIPES`) with every press of the enhanced book
  written where the pack writes it, and its spine's arrows turning the list (`markGrimoireSpellbook`); the layers laid
  over the picture let a press through, so its EXIT closes it.

### GRIM4 - readable, the same glass everywhere, and the dial's symbols (2026-10-10)

Dudey: "The compass looks blurry make better readable, the revenant window isnt readable. The lifebar of the enemy and
the boss are not looking like the lifebar of the player", "atrribute bars shuold look the same as skill bars", "the
numbers next to the filters are hardly readable, the + next to the speed multiplayers is too close to the boxes", "the
bars in the ascend and status screen also do not look like the player health/stam/mana bars", "make sure theres not so
much space left on the book pages when using different resolutions", and of the Tab dial: "instead of words give this
fitting symbols, all in the style of grimoire" ("not suiting at all ... this is not a happy pixel game" of a drawn set;
"PIXEL PERFECT please"). Pinned by `test/ui/grim1_dress.test.js` GRIM4, its mutants in `tools/mutants/grim1.json`.

- **The compass** draws the pack's own COMPASS and COMPBOX at the pack's resolution, smooth, at the compass's size
  (`--gcm`): the game-grid cut stretched pixel for pixel by two and a half smeared every letter.
- **The foe's and the boss's bars** are the player's own whole vial (`vialHealth` / `vialHealthEmpty`: cork, glass,
  light and bubbles), never a run of tube: the foe's at the HUD vial's size (`--gq`), the gate boss's the same vial at
  `--gp`, Plus's brass end caps gone; a sea boss's is the blue vial, a brass one's the red gilded.
- **The sheet's Health, Fatigue and Magicka and the Ascend's** are the HUD's vials at the HUD's size (rows stamped
  `data-grim-meter="vital"` by their word, `VITAL_WORD`); on the Ascend they stand centred under the book. **An
  attribute's bar** is a skill's thin gold bar (`data-grim-meter="attr"`, `ATTRIBUTE_WORD`), its rows the skill grid's
  pitch. The right page keeps two of the game's pixels inside its edge, so no bar's outline is clipped at its left.
- **The Ascend's skills**, fifteen and more, stay one ledger spread down the whole page (`minmax(min-content, 1fr)`
  rows), large where the page is tall enough, two columns only where it is short (the page a size container,
  `lvpage`) - never packed at the top with the page empty under them.
- **The revenant's card** is written flat in ink - the stack's dark word shadow doubled each letter on the paper - its
  name in ink, its kind in red, its rank in the softer ink. **The overworld's counts** are ink at the face's size; the
  block is wide enough that no word is cut and the waypoints' hint wraps. **The pace steps** are drawn bars of ink, the
  same breath either side of the number's well (a glyph sat wherever its face put it).
- **The Tab dial's doors are symbols** (`DIAL_ICONS`, cut at run time from the shipped pack, nothing derived committed):
  SKILLS the Empire's helm off the world map's banner (MAP100I0), MAGIC the spellmaker's glowing spellbook (INFO01I0)
  cut on the game's own grid pixel by pixel (`cells` / `rows`: each pixel wholly in or out, drawn one CSS pixel to each),
  MAP the painted map of Tamriel whole, ITEMS the Save Game chest (OPTN00I0; the pack paints no backpack) cut a
  part-pixel inside its plate (`inset`) and brought up in sharpened doublings (`lift`, `DIAL_LIFT`) to match the
  others. The door's word stays for a reader, unseen; the chosen symbol is lit and edged in the pack's yellow; the four
  stand at one distance from the knot.

### GRIM5 - the last pixels (2026-10-10)

Dudey: "the "of 5" my inner monk is killing me xD its not in the middle next ot the how many box", "remove those dotted
lines in the ascend screen under the attributes", "make sure that the points left in the box are centralized ... put
the points left under the last number of the attributes not too close", "The gold counter is also a bit misplaced",
"the vial bars are toooshort in the stat screen". Pinned by `test/ui/grim1_dress.test.js` GRIM5.

- **The sheet's vitals** are the HUD's vial drawn to the row's length: its own head (cork and lit shoulder, `head`), its
  body drawn out (`longBody`: each row's own course from shoulder to foot laid over the length, the row's bubbles laid
  back over it at the vial's spacing - so the glass darkens toward its foot as the HUD's does) and its own foot
  (`foot`) at the glass's end. The bar is a size container, so the liquid lays its foot at `100cqw` and is cut where
  it stops. The Ascend's three are a third of the plank's room each, up to 130 of the HUD's pixels.
- **How many** - its word, its field and its "of N" centred on one line (a note's re-said margin had lifted the last).
- **The pack's foot** - the purse's word and figure on the plank's middle line, as the carry weight's (they sat on the
  Drop press's baseline); the carry's bar the skill's thin gold groove at a length of its own (it had been squeezed
  to a sliver).
- **The Ascend's ledger** carries no rule under each attribute; the points stand on the ledger's own columns - the box
  in the figures' column, its right edge on theirs, its word before it - a line's breath under the last attribute,
  and the figure sits in the box's very middle (the face sets a digit high in its line, its spacing at the right).
- **TRADE-LOC** (Dudey: "when players trade in any ui the letter of credit doesnt show how many gold its worth when being
  clicked on it in the info box"): the player trade window - the one window every skin opens - says a letter of
  credit's worth (`systems/walletItem.js letterWorthLine`) in the detail a click opens and in the row's hover, for a
  letter of either side; its value rides the wire whole (`systems/loot/loot.js wireLootItem` floors, never drops it).
  Pinned by `test/systems/tradeinfo.test.js` TRADE-LOC. TRADE-LOC II (`01-Overview/bugs/Field-Bugs-2026-10-11d.md`): and on the
  row itself, under the letter's name - no hover on a phone, and two letters told apart without a click each - and as
  the pack's card's Worth (`letterWorthGold`).

### GRIM6 - the front door, the chest, the chat (2026-10-10)

Dudey: "the background around the book looks too pixelated washed out", "the chest is still not fitting and looks too
blurry and also badly cutout ... looks at this drawn style of the book and helmet it must match", "remove the find me
button in dungeon 3d handdrawn map", "When i press on retro look in main menu settings ... the menu misplaces", "The
bonus points left number is still quite big compared to the 47 and not in the same row and not under it", "The chat
fonts when i type in it are white", "make sure the blue event text is readable when the chat box is not open", "give
the main menu button presses the same sound as ingame", "box fonts leaving the box". Pinned by `test/ui/grim1_dress.test.js`
GRIM6 and `test/ui/snd.test.js` SND2.

- **The front door's desk** (and the loading screen's) is the pack's BIOG00I0 at its own resolution, drawn smooth.
- **The dial's chest** (GRIM7, Dudey: "here this chest chatgpt made is great make sure it fits the other symbols") is
  the painted chest Dudey supplied, cut from its dark ground along its outline and shipped
  (`public/art/grimoire-dial-chest.png`, its doctrine row in `test/tooling/doctrine.test.js`) - the one dial symbol shipped as
  a file (the pack paints its own chest at 35 pixels, too small for the dial); the dial draws it DOWN, as the helm and
  the book.
- **The settings never jump**: Plus's ground canvas (hidden under the dress, 1200 pixels tall in a 960 frame) let a
  press scroll the whole menu; it is out of the page. **The held map's Find me** is gone under the dress.
- **The points** are the ledger's own size (32), on their word's baseline, the last digit under the attributes' last
  digits, the box round them with as much room each side. **A slot's word** stays inside its shelf box.
- **The chat**: the typed word in ink, a name its colour deepened (a plain one ink), times and tags the softer ink, a
  herald's line blue ink; shut, its lines over the world wear the HUD's outline (a herald's light blue).
- **SND2**: the front door boots the click's sound bank from the player's stored data (`uiClickSound.js
  wakeUiClickSound`) - only when the bank is there, so a missing one never leaves the game's sound off. The reader is
  `main.js`'s data gate, handed in at the door: the HUD imports the click's module (through `enhancedStyle.js`), and a
  data module named there, even as a lazy import, put the quest machine in the HUD's reach (GUIDE3's and GUIDE4's walks).

### INK-TONES and PACK-ROOM - the page's coloured words, and the worn map's flanks (2026-10-10)

A player: "make the fonts better visible ... the blue and Mora's Mantle ones ... don't make them totally different".
A rarity's, a set's and the sigil's words are drawn in their own colour through a CSS variable (`--rar`, `--set`,
`--sigil`), which the ink cannot re-say, so on the page they kept Plus's pale glow (Mora's Mantle 1.4:1 on the cream
page). The dress now writes each deepened into the ink: the rarity's tone as the loot plaque already did
(`RARITY_INK`), a set's own colour mixed 40% into the ink (`SET_INK`, `color-mix`, so every set keeps its hue) and the
sigil's teal 35% (`SIGIL_INK`) - every set colour then reads at 4.5:1 or better. The set ribbon under the pack wears a
light wash of its colour with an inked edge and pips; a set's tier not yet awake is written in faint ink, no longer
faded to 55%. **PACK-ROOM**: with the worn map held to its column, the figure left each flank ~80px and a pair's names
broke a letter at a time; the goods' column is now `minmax(230px, 290px)` and the figure at most 210px wide. Pinned by
`test/ui/grim1_dress.test.js` INK-TONES.

### DESK-FILL - the front door's desk as big as the screen holds it (2026-10-10)

Mac, of the front door as an earlier build drew it: "it looks way better use this one". GRIM3 laid the desk (BIOG00I0,
320 x 200) at the biggest WHOLE number of screen pixels to each of its own, so its pixels stayed square; since GRIM6 the
desk is drawn smooth at its own resolution, and the rounding only shrank it - at 1985 x 947 four to one, 800 tall in a
dark room, where 4.7 fills the screen. `--gd` is now `grimoireArt.js deskScale`: the exact fit, the whole desk (candle,
inkwell, quill) touching two edges of the screen, the book and its doors following it (`--gbw`/`--gbh`). The wordmark
is untouched. Pinned by `test/ui/grim1_dress.test.js` DESK-FILL.

### DESK-HD - the detailed desk under the front door (2026-10-10)

Mac, after DESK-FILL: "the background is still blurry as hell". The pack's BIOG00I0 is a 960 x 600 copy of a 320 x 200
picture - blocks at any size, smooth or not. The front door Mac wanted (an earlier build's) stood on a far more detailed
painting of the same desk (the candle's drips, the inkwell's glass, the quill); it is not in the repository, so it was
lifted from Mac's screenshot of that build - the desk's rectangle at that build's own scale, 1515 x 947, the doors'
words inpainted from the paper round them, the wordmark replaced by the wood beside it, its edges feathered into the
room - and ships as `public/art/grimoire-desk.jpg` (`grimoireArt.js grimoireDeskUrl`). It already carries its room's
dark edges, so no vignette is laid over it; BIOG00I0 stands under it as the fallback. Its doctrine row awaits Mac's
note of where that build's painting came from. Pinned by `test/ui/grim1_dress.test.js` DESK-HD.

### WOOD-HD - every board in the soft desk wood (2026-10-10)

Mac: "can every board wood background in DFO Grimoire UI in ALL windows and frames look like this that has that blurred
wood?" - the character sheet's desk. Every board of the dress (a window's body and bars, a pane, a chip, a tab plate, a
plank, the window frame's rim) is the one `wood` tile, so the tile changed and nothing else: it is the Ascend's soft desk
wood, cut from the empty board beside the book in Mac's screenshot, its light flattened and made seamless
(`public/art/grimoire-wood.jpg`, `grimoireArt.js WOOD_TILE` 100 x 189 of the game's pixels - the size it was painted at
on three screen pixels to one). It is resampled once at the grid's own device pixels (`--gp`), so the kit's pixelated
drawing lays it one to one and it stays smooth; the frame, built at the game's own size, takes a copy at that size. The
INFO01I0 cut stands in only if the file cannot load. Pinned by `test/ui/grim1_dress.test.js` WOOD-HD.

### LOGO-MEND - the Daggerfall Online logo's torn rows and sliced tops (2026-10-10)

Mac: "you can see the logo being cutout a bit and also those weird lines in daggerfall have to be removed". Both were in
the picture itself (`src/assets/branding/daggerfall-online.png`), so every surface that draws it - the intro, the front
door, the section masthead - is mended at once: five 4-row strips of torn rows (78-81, 148-151, 258-261, 272-275,
368-371: dark streaks through DAGGERFALL and The Elder Scrolls) repaired from the rows round them, the letters' speckle
carried back in; and the art moved down 8 rows (into the 81 empty rows under the banner, so the file stays 2112 x 850
and `brandMark.js`'s size and the doors' `81 / 2112` pull are unchanged), the black outline closed over the tops of
T, E, l, d and S that the old top edge had sliced flat. The red scribble through ENHANCED is kept: the deliberate
strike-through. `test/ui/intro.test.js`'s hash of the file moves with it (`28b16729...`).
- **DESK-SEAM (2026-10-10)**: Mac, arrows at the wood left of the wordmark: the wordmark's place on the desk had been
  filled with a block of wood lifted from beside it, and its edges showed as a seam (a smooth box among the planks).
  The place is now filled row by row from the SAME row's wood on both sides (the planks run across: a few pixels
  mirrored at each edge, the wood beside it carried on through the middle, the light drawn straight across), so every
  plank meets itself and no edge is left; it fades into the wood under it over its last rows.

### GRIM-MERGE - the drop-in onto main, and the four gates it had not met (2026-10-10)

The GRIM pass arrived as a drop-in cut from main at #733 (`fadd7bda`); each file it changed was merged three ways onto
main's head, so nothing main had moved since was reverted (BAL4's `enhancedAI` default, PERF-HUD1's one sweep clock).
Four gates the drop-in's own tree did not pass were met here:
- **ONE DFU MEMBER, ONE EXPORT** (`test/systems/talk/audit24_onehome.test.js`): `grimoireArt.js` exported a `bayer` nothing called
  (the 4 x 4 dither `world/superDungeon/sdPixelKit.js` already exports) - deleted; and its `toNative`, the 3x crop brought back to
  the game's grid, shared a name with `mouseControlsWindow.js`'s rect offset - renamed `toGameGrid`.
- **THE HUD STAYS LIGHT** (`test/ui/quest/guide3_herald.test.js`, `test/ui/quest/guide4_tracker.test.js`): SND2 is wired through
  `main.js`'s data gate (above), never a data module named in the click's.
- **HUD-CLASS** (`test/ui/naval/hudclass_sheets.test.js`): the dress's sheet is built in functions, so the audit of the game's
  sheets could not read its selectors; it is exported evaluated (`GRIMOIRE_KIT_CSS`, the text `mountGrimoireDress`
  lays). Read, two of its rules styled the bare `.on` the HUD writes: a chosen press on the page and on wood. Each is
  now named by its own press root (`PRESS_ROOTS`, the only elements the dress stamps `data-grim-on` on), and holds only
  at rest - its added weight never beats the hover that won by order - and the wood's underline gives way to a
  disabled press, as it did.
- **The suite's count** (`test/bible/manifest.test.js`): the drop-in's `grim1_dress.test.js` row said 16 of its 20 tests.

### GRIM-FIELD - the bug thread's round (2026-10-11)

Two drop-ins on the DFO Grimoire bug thread - the readability-and-bars patch, then a cumulative round that carries it
whole - merged onto main's head (#779): every hunk applied as it stood but `Testing.md`'s Suite line, recounted on the
merged tree. Each fix's record is the comment over it in the dress; the pins are `test/ui/grim1_dress.test.js` (23 now)
and the files named below.

- **THE INK** (`ui/grimoireDress.js`). INK-VARS: a `var(--x, fallback)` is read as --x's colour - re-saying the fallback
  alone left the Social panel, the letters and the guild page in bone and grey on the parchment - and a var a sheet
  defines for itself is learned off the sheets (`learnSheetVars`); one defined as two colours (a rarity's `--rar`, a
  slot's `--hb-acc`) is the element's own and never pinned. INK-FIELDS: a field typed on a page in the page's ink.
  INK-DISABLED: a press that cannot be pressed in the softer ink, solid.
- **NO-LINES** (a player: "those weird lines everywhere, those are not needed"): a page of the pack is not ruled - the
  talk window's two pages part by the scroll's own shading, a profession is a line on its page and not a box, a career
  group of Master Skills its name in red over the pack's dotted rule.
- **THE BARS** (`ui/grimoireArt.js`, `ui/hud/hudLayout.js`). FOE-PLATE / VIAL-LONG: no drain on any bar, the foe's and the
  boss's glass drawn out at any length with nothing behind it, the upright vials lengthened as height. BAR-SCREEN: the
  two bars are the screen's size, not a pixel count (the foe's glass 1.75% of the view's height, never under 13; the
  boss's 1.4 times it). HUD-LEN: the HUD editor's (Alt+U) length handle follows the pointer by a measured step, never
  an assumed one - a stood bar's handle on its top edge (`--hm-len-axis`) - the boss bar takes a length, and a size or
  a length never carries a piece off the screen.
- **THE BOOK**. SETTINGS-SCROLL: the Controls head sticks as one line over the book's short scroll, and a key's row is a
  line where there is no thumb. SETTING-SCROLL: a setting's words are the item scroll held out BESIDE the book (out of
  the page column's clip, slid in only as far as the screen asks), and on the front door the same scroll in the detail
  column. CHOSEN-CHIP: a chosen chip's mark - the bright word underlined, a gold outline - stands over its shelf-box
  picture, which painted over the kit's inset line.
- **THE HELD MAP** (`ui/heldMap.js` FINDME-SHEET): its root says which sheet is up (`data-hm-sheet`), so the dress takes
  Find me off the dungeon's sheet alone and the world's and the town's keep it beside Close.
- **NOT THE DRESS'S, ON THE SAME THREAD**: HOTBAR-LAG (`ui/enhanced/enhancedHotbar.js`, `test/ui/enhanced/ui1_slots.test.js`) - a press plays
  the caption's fade through the browser's animation instead of a class off, a forced layout and the class back (two
  restyles a press, ~10 ms under the dress's wood); NOTE-KEYS (`ui/quest/questJournal.js`, `test/ui/audit26_uiwindows2.test.js`)
  - the journal's note field takes its letters by the native route, as a native window is handed raw codes, and the
  move/remove box its Y and N.

Two gates the drop-in's own tree did not pass were met on the merge:
- **THE ROSTER** (`test/ui/classicinputbox.test.js`, CM3-CM11): the drop-in's NOTE-KEYS typed the journal's note into the
  journal's own art through `typedChar` - the inline field CM3-CM11 retired everywhere else. EnterNote now PUSHES the
  one `InputMessageBoxWindow` (the prompt above `" > "`, MaxLineLenth 70, WidthOverride 318), which reads both hosts'
  spellings; the confirm box's Y and N read the shortcut table (`hotkeyHit`); the roster names the journal
  (`10-UI/UI-Arc.md` NOTE-KEYS).
- **DISC25-A A7** (`test/ui/disc25a_dungeon_map.test.js`): FINDME-SHEET's stamp stood between a sheet's mount and the foot's
  `_writeHint`, the pair the pin reads as one; it stands after them.
