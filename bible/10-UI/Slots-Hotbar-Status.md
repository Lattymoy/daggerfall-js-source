# Slots, the hotbar and the status widget - the Plus UI pass (UI)

## What Mac asked for

> "I want to find a way to make the actual inventory plots have the rarity frame with sprites enlarged properly,
> instead of the inventory icon just plopping into a slot, if that makes sense. The hotbar also is missing sprite icons
> like spells, and you should be able to slot spells and different items. For the UI, I want to move buffs/debuffs/etc
> to their own widget space somewhere on the side of the screen, where it doesn't interact with other UI elements, and
> use square icons with glyphs for each effect (climates and calories included) which then gives more space for the XP
> bar and being able to fit the XP amounts inside. This needs to be a detailed adjustment after all current work is
> finalized"

Three slices, each shippable alone: UI1 the slots, UI2 the hotbar, UI3 the status widget and the XP bar. The
enhanced skin only - Plus is its only dress (`isEnhancedPlus === isEnhanced`); the classic skin keeps DFU's own
inventory paper, its HUD's ICON00I0 rows and no hotbar.

## UI0 - the ground truth (2026-09-27)

Read with the real ARENA2 through the dev server's mount (a scratch probe drew the pack with its real records).

**The pictures.** Every enhanced item picture is an `<img>` holding a PNG data URL, made on a canvas at a fixed
whole-number scale - 2 for a tile, 4 for the card (`requestIcon`, `ui/textureCanvas.js`) - and then CAPPED by CSS:
`.tile img { max-width: 30px; max-height: 30px }` (`ui/enhancedStyle.js`). The pack's grid slot is 56px; its picture is
at most 30. The real records, measured over the 282 templates the game mints (their longest side):

| group | median | range |
|---|---|---|
| weapons | 86 | 27-141 (a staff 102x141, a longsword 88x29) |
| armour | 57 | 42-112 |
| clothing | 62-63 | 29-149 |
| jewellery | 37 | 5-88 |
| ingredients | 12-23 | 11-61 |
| gems | 11 | 9-12 |

So a longsword's 2x canvas (176x58) was drawn at 30x10 - crushed nearly six times under `image-rendering: pixelated`,
which at a ratio like that DROPS pixels unevenly - and a gem's 2x canvas stood at 18px in a 56px slot. Nothing
computed a scale that fits the slot. The grid also never showed a stack's count (`itemRow` never made the element its
sheet has a rule for).

**The hotbar** (`ui/enhancedHotbar.js`, the model `systems/quickslots.js` HB1): ten slots (sixteen on the pad's
crossbar). A spell's slot shows the spell's INITIALS - "A spell has no ARENA2 icon this skin reads" - though the art is
there: ICON00I0.IMG, 69 spell icons of 16px (`ui/spellIcons.js`), and a DOM door already cuts them
(`ui/enhancedArt.js spellIconUrl`). Items: four KINDS alone - a consumable, a light, a shield, a weapon
(`hotbarKindOf`, and again in the save's restore) - and a press of any other kind would fall to the light's arm.

**The status row** (`ui/enhancedHud.js`): the HUD's effects are TEXT chips - "Wrath 10s" - in one row at the foot of the
centred column, under the vitals and the Renown row: spells (`effectRows` - their ICON00I0 index dropped on the
way), the sets' powers, and the survival needs ("Hungry", "Freezing" - `survivalHudChips`). A poison, a disease and an
infection never show there at all (they carry no bundle). The Renown bar is an 8px track with no words: the numbers
went inside a 16px bar once (RENOWN-BAR) and came out ("Actually lets just keep the other bar and remove the xp"),
because the row under it was the chips' and the column had no room. On a phone the vitals' words run into their
numbers ("MAGICKA70%").

## UI1 - the slots: a framed plate, the sprite fitted (2026-09-27)

**THE FIT LAW** (`ui/iconFit.js`, pure). A picture is fitted to its slot's box in DEVICE pixels:
- the record is TRIMMED to its opaque pixels first (a sprite's transparent margin is not the sprite; a replacement
  PNG's fringe under alpha 8 is not either - `bitmapCanvas.js TRIM_ALPHA`);
- its longest side is scaled to the box (`floor(box x devicePixelRatio)`, the ratio - the screen's times the HUD's
  scale where it rides one - clamped to 0.5..8), never past `cap`
  (4) CSS pixels a source pixel, so a gem does not become a boulder (an 11px ruby stands 44px in a 48px box);
- a WHOLE-number scale is drawn by nearest neighbour alone - every source pixel exactly `k` device pixels - and the
  scale is SNAPPED down to the whole number under it whenever that keeps three quarters of the size (`SNAP`): a 20px
  ring in a 48px box is 40px of whole pixels, not 48 of resampled ones;
- any other scale over one is "sharp bilinear": nearest neighbour up to the next whole number (`prescale`), then a
  smooth resample down to the size - crisp pixels, no uneven drops;
- a scale under one (a 141px staff in a 48px box) is a smooth reduction, halving while it is twice too big, then one
  pass to the size (`bitmapCanvas.js fitCanvas`) - never a pixelated one.

The picture is made at exactly the device size it is drawn at, so the page resamples nothing: an `<img>` carrying its
own width and height (`textureCanvas.js fittedImg`), never past its box (a slot the page draws smaller shrinks it
whole, smoothly). The door is `textureCanvas.js requestFittedPicture`: the picture's own door at scale 1 is its source
(the record through `requestIcon` - its vendored arm, its replacement by the dye, the classic record with the mask
stripped - or the cart's model bake), the fitted picture cached by the picture, the box, the ratio and the cap, every
screen waiting on it told once when it lands. `requestIcon` itself now tells EVERY screen that asked while a record was
in flight - the first asker's `onReady` had been the only one heard, and a slot asking second kept its initials.

**THE BOXES** (`SLOT_BOX`): each surface's well inside its frame, less two pixels a side, so a sprite never touches its
frame - the pack's grid 48 (40 on a phone), a worn panel 28 below a desktop and 48 on one (a half panel 22 and 38),
a loot row 30, the shop's and a player trade's rows 26, the shelf's socket 32, the hover card and the detail card 96,
the Sigil Broker's offer 32. Measured with the real ARENA2 (`tools/uiSlotsProbe.mjs`): every grid picture fills three
quarters of its box or more (a gem stands at the cap), none past it, none resampled by the page, at 1x, 1.25x, 2x and
a phone's 2.625x.

**THE SLOT IS THE FRAME** (UI1b - Mac, mid-pass: "rarity outlines actually [on] the UI/Hotbar border itself instead
of it being an icon within an icon"). The pack's grid slot is 64px (it was 56) round a 52px room for the picture - a
room, not a box: the tier's frame is the slot's own border (its colours, lit from the top left), its glow on the slot's
ground, and the sprite stands straight on it in no second box. Its corners: the hotbar's key top left, the sigil's or
the set's rune top right, the tier's pips bottom left, the stack's COUNT bottom right (new; stepping off the padlock's
corner for a locked stack and over the wear bar), the wear bar along the foot. A Common piece wears the kit's stone.
On a phone the slot is 56 round a 44px room, so a 393px screen keeps six a row; a desktop's dock keeps five. The same
law everywhere a slot stands: a WORN PANEL is its piece's frame (the tier on the panel's border and its glow behind the
picture, the rune and the padlock at the panel's corners - it had been a small framed tile inside the big panel), a
shelf socket, a hotbar slot, a diamond cell and the carried ghost were their own frames already. Only a LIST's row (the
loot window, the shop, a player trade) keeps the frame on its picture: a list has no slot.

**THE BODY'S PICTURES.** On a desktop (the pack's `min-width: 1000px` layout, where the worn map's rows stand 64px and
more) a worn panel's picture has a room up to 56px - the grid's own 48px box, so the pack's slot and the body's are
one picture - and a half panel's (a chest, arms or legs pair) up to 44 over its name; a short window's row shrinks the
room with it. The phone's map keeps its compact rows (34px tiles, 28 a half).

**EVERY OTHER SURFACE** fits its picture to its own box by the same law, through the same door: the accessory shelf,
the loot window's rows (a stack says its count in its name there, which the row shows), the shop's and a player
trade's rows and detail strips, the hover card and the Info box, the Sigil Broker's offers. THE DRAG GHOST lifts the
slot's own picture - the grid's box, so a carry starts with its picture already made; one carried off the body (whose
panel's box is smaller below a desktop) takes its picture the moment it lands - and its tile is 56px, bigger than the
52px well it lifts from.

## UI2 - the hotbar: every spell's icon, every item (2026-09-27)

**A SPELL'S SLOT SHOWS ITS ICON** - the ICON00I0 tile its record names (SPELLS.STD's `icon` byte, a made spell's
SetIcon), cut from the real sheet (`ui/enhancedArt.js spellIconPicture`) and fitted to the slot by UI1's law, whole and
untrimmed (a spell icon is a square tile, its dark border part of it), to the spell face's own 34px box inside its
ring: whole pixels at every ratio - 32px at 1x, 1.5x, 2x and 3x, and where 32 is not whole the whole size under it
that keeps three quarters of the box (25.6px at 1.25x, 27.4 at 1.75x, 30.5 at a phone's 2.625x; AUDIT UI B2). The
element's rim and the range's pip stay; the initials show only while the sheet loads. The entry STORES the icon
(`hotbarEntryForSpell`, the save with it), so a spell that has left the book keeps the picture it was slotted with,
dimmed as a ghost. The spellbook's drag carries the icon; the diamond's spell chip wears it before its name. The sheet
cutter now tells every screen that waited on it (`sheetCutUrl`'s `onReady`).

**ANY ITEM GOES ON THE BAR** (`systems/quickslots.js hotbarKindOf`), its press the pack's own primary act
(`localPrimaryAct`, the pad's quick act):
- a consumable used, a weapon readied, a light lit, a shield strapped on - as before;
- a piece a slot of the body takes - armour, clothing, jewellery, a gem's crystal (the equip table's own answer) - is
  WORN: put on, or taken off when it is on, in its own words ("You put on your Steel Cuirass." / "You take off...";
  a shield keeps SHIELD1's), the equip delay billed as the swap bills it, broken and forbidden refused;
- everything else is USED through the host's own quick use, which is the pack's Use: a book OPENED in the reader, the
  spellbook item opening the book, a map read, food eaten, a tent or a fire placed on the host's ground - every host
  (`scenes/world.js`, `exterior.js`, `dungeonContext.js`) now hands its quick use the pack's three window doors, one bag
  (`packDoors`) with the pack's own - and an item with no use at all SAYS so ("You cannot use your Prayer Beads."),
  flashing the refusal, where the pack's click is silent (DFU's catch-all).
The save carries the two new kinds and refuses a kind it does not know.

**THE SLOT'S PICTURE IS FITTED** (UI1's law) at a MEASURED box: the slot's face less two a side, at the ratio its
pixels land at - the screen's times the HUD's own scale, which the bar rides in play - read again every second and on
any layout change (the crossbar, the bar carried under a window). A stack shows its COUNT on any slot (a consumable
always); a worn piece its WEAR - a weapon, a shield, a light, armour, anything enchanted - and never a gem, a ring or a
book. The diamond's cells are fitted too (40px, 28 on a narrow screen), at the HUD's scale. The drop hint says any item.

Measured with the real ARENA2 (`tools/uiHotbarProbe.mjs`): three spell icons (one a ghost) and seven items on the row,
every picture fitted and unresampled, the counts, the diamond's cells and its spell chip, at 1x, 2x and a phone's 2.625x.

## UI3 - the status widget, and the XP in the bar (2026-09-27)

**THE EFFECTS LEAVE THE FOOT** (`ui/hudStatus.js`, drawn by `ui/enhancedHud.js`). The row of text chips under the
vitals and the Renown row is gone from the HUD's bottom column; what it said is a column of SQUARE tiles at the left
edge, standing on the quickslot block's caption - the block's first child, so it rides the block's corner and scale,
grows UP from the caption and can never meet the diamond. One tile an effect, in the foot row's old order:
- a SPELL: its own ICON00I0 icon (`enhancedArt.js spellIconPicture`, fitted by UI1's law into the tile's 32px), framed
  green when I cast it on myself and red when another did (a debuff), dashed for an item's held magic; its rounds on a
  plate at its foot; blinking as it ends - DFU's own two laws (`hudActiveSpells.js`): under two rounds, and never an
  item's, a quarter second off and on (still, and framed gold, for reduced motion);
- a SET POWER: the sigil's rune in its set's colour (`sigilRune.js sigilRuneTileSrc`), the frame its set's light and
  shade, its window or its recovery at its foot, a recovery dashed and dimmed;
- a NEED (Climates & Calories, `survivalHudChips`): the port's own pixel glyph - a drumstick, a drop, a moon, a
  raincloud, a sun (warm, hot, scorching), a snowflake (cold, freezing, deadly cold), a bone, a tankard - framed amber
  while it is felt and red while it costs (the chips' own two levels: red means it costs);
- a POISON and a DISEASE, shown at last (a skull, a spore), on the Status box's own law (`systems/healthStatus.js`):
  ONE tile, "Poisoned", once any poison has left its waiting and until its damage has healed (the game names no poison:
  "You have been poisoned."); a tile a disease once its incubation is over, by the name its own contracted message
  gives it (`diseases.js DISEASE_NAMES`, TEXT.RSC 100-116); nothing for a poison still waiting, a disease still
  incubating, or an infection (DFU says nothing of one until the dream).

The ten glyphs are drawn on the classic spell icons' 16px grid, each pixel a letter in the module, every lit pixel
outlined in the kit's black so it reads over any ground (made from shapes, outlined by a machine, then looked at). The
name stands beside a tile where there is room for it.

**THE BAND.** The widget must meet nothing, so its room is MEASURED, twice a second, not assumed: from the caption it
stands on up to whatever stands above its corner - the chat's box (its peek lines, or the open box), a quest escort's
portrait column (`hudEscortFaces.js escortFacesBottom`, handed on by the host in window pixels), a touch screen's
top-left presses - less eight pixels of air, over the HUD's scale. The grid's rows are the tiles that band holds (never
more than there are tiles); a longer list wraps into the next column rather than growing into the chat. Where the band
above holds one row or none - a phone on its side, where the diamond reaches the top; the chat opened tall on a
laptop; an escort's face down to the caption - the widget stands BESIDE the diamond instead, from under what stands
above to the diamond's foot; where neither holds a tile (the chat open over the whole left edge of a phone on its side)
it steps aside until there is room again. Its columns stop short of the screen's middle, where the reticle is; what
does not fit folds into one more tile, "+N" (the Status box and the sheet say them all). The names go where there is no
room for them: on a phone, on a short screen, in a band under three rows, past two columns, and beside the diamond. A
short screen (a phone on its side) draws smaller tiles: 28px, the picture at one and a half (the diamond shrinks there
too).

**THE XP IS IN THE BAR.** With the foot free, the Renown row's bar is the vitals' own 20px (it was RENOWN4's 8px) and
says its numbers inside it, as the vitals say theirs: the level's credit over its span - "5,420 / 13,800 XP" - and
"Highest" at the cap; nothing while the service has not said the total (the box alone). The credit alone: what is
earned and not yet answered stays the ghost's to say, faint after the fill. The row keeps its three columns (the bar on
the vitals' middle) and its 22px, which the quickslot block's lifts count; Plus bands the gold at the vitals' own
stops. RENOWN-BAR had taken the numbers off ("Actually lets just keep the other bar and remove the xp") while the
status row stood under the bar; this puts them back, as asked.

**THE PHONE'S VITALS** say their numbers alone (Plus, under 640px): a 23vw track holds "MAGICKA" or "70%" but not both,
and the two ran into one word ("MAGICKA70%"); the three colours name the bars, in the reference's own order.

Measured in Chromium with the real ARENA2 (`tools/uiStatusProbe.mjs`, 1134 checks): a character under three spells,
a set power, a poison, a disease and seven needs, with the chat's own sheet and five peek lines at its corner, at a
desktop, two laptops, a desktop at HUD scale 1.5 and a phone both ways up - at rest, with the chat open, and with an
escort's face at the classic's own scale: every tile square at the HUD's scale, every picture loaded and every spell
icon unresampled; nothing met (the caption, the diamond, the chat, the escort's band, the touch presses, the vitals, the
Renown row); on the screen, and at rest short of its middle; at rest above the caption on every screen but a phone on
its side, where it stands beside the diamond under the chat's lines. `tools/renownBarProbe.mjs` (160 checks): the words
in the bar, the bar 20px and on the vitals' middle to 0.0px, at a desktop, a laptop and a phone both ways up.

## AUDIT UI - UI1 to UI3 read end to end (2026-09-27)

Three readers, one for each slice, each against the code and a browser. Every finding is fixed, each with its test
and its mutant.

**THE SLOTS (A).**
- A1: a fitted picture carried an inline `image-rendering: auto`. Made at its device size and centred in its slot, it
  lands between device pixels, and `auto` blended every one of them (13 of 13 pictures at 1.25x, 1.5x, 1.75x and a
  phone's 2.625x). Now no inline rule: the sheets' `img.fit` draws it pixelated, lossless at 1:1 whatever the offset.
  The one picture the page shrinks on purpose, a phone's accessory socket, is smoothed by its own rule. Re-probed:
  nothing resampled at any desktop ratio.
- A2: a tiered worn panel lost its glow under the Stone theme (the theme's tile texture at equal weight). The rule
  now stands at `:root` weight, after the theme's.
- A3: a pack left open over a resize, a phone turned or a zoom kept its old boxes. It listens for a resize and
  repaints when its boxes or the screen's ratio change, and not otherwise.
- A4: the fitted pictures were kept without end (every zoom and HUD scale is a new set). Now 600 at the most, the
  oldest asked going first.
- A6: the ratio was clamped to 4, and a 3x phone at HUD scale 1.5 draws at 4.5. Now clamped to 0.5..8.

**THE HOTBAR (B).**
- B1: a quest item pressed from a slot said "You cannot use" after its popup had shown and its quest had heard the
  use. A quest item is used, as the pack's press is.
- B2: every picture on the bar took the box of whatever slot 1 held. Each kind is now measured off a slot of its own
  kind: a spell's face stands further in, inside its ring (34px).
- B3: the ratio was read off a slot, which the crossbar's held set scales by 1.06 (its other set by 0.94). Holding
  a bumper refitted all sixteen pictures and blanked them for a frame. The ratio is now read off the bar.
- B4: a camp the ground refuses (a town, a boat) flashed gold under the refusal's words. It is refused.
- B5: the diamond's cells kept their pictures at the old HUD scale until a count changed (at 2x, 1x pictures drawn
  at twice their size). The block's signature carries the scale, the ratio and the narrow sheet's box.
- B6: an enchanted thing to use (the Sanguine Rose's kind) spends its condition, and the pack draws its wear. The
  bar now draws it too.
- B7: a book, the spellbook or a camp on a host with no door said nothing and flashed gold. The stand-in now says
  why nothing opened, and the slot flashes the refusal.

**THE STATUS WIDGET (C).**
- C1: offline, nothing bounded the band, and a long list climbed into the compass. The band is now measured against
  everything that stands above it between its left edge and the screen's middle: the HUD's own top block (the
  compass and a foe's bar), the chat, the Social panel open, the gate boss's bar, the journey bar, the online status
  line and the touch presses.
- C2: two named columns ran 45px past the middle at 1.5x on a 1024px screen. The names now stand only where their
  columns also fit short of the middle.
- C3: a party mate's gift was framed as a debuff. ALLY-CAST lets a mate lay only what helps, so it is a buff.
- C4: the touch presses were taken at 16px down; a notched phone puts them below its safe area. They are measured
  where they stand, and a press past the middle stands over no part of the band.
- C5: each tile now reads its own bundle's rounds. They had been looked up by name, so my Heal beside a mate's Heal
  wore the mate's count. An item's held magic has no time at its foot: its rounds count down to nothing, and it runs
  on while the item is held.
- A new window size or HUD scale measures the band on the frame it comes; a rotation had left the old band for half
  a second. A new screen ratio (a zoom, another monitor) fits the spell icons again.
- Beside the diamond, the band is scanned for what crosses the diamond's own rows: on a phone on its side, the chat's
  lines start below the caption's top, and the scan above alone let the widget stand under them.

Re-measured: `tools/uiStatusProbe.mjs` 1513 checks, `tools/uiHotbarProbe.mjs` at 1x, 1.25x, 2x and a phone's
2.625x, `tools/renownBarProbe.mjs` 160. Mutants: `tools/mutants/ui1.json` (38, 40 since the merge below), `ui2.json` (35) and
`ui3.json` (57).
UI1's "pixelated" mutant is retired: A1 reversed its law. Eight records whose text the fixes moved were re-aimed by
content.

## The merge with main, and AUDIT FINAL (2026-09-27)

- **DYE-ICON THROUGH THE FITTED DOOR.** Main keys an item's picture by its dye AND the swatch the classic arm dyes by it
  (a silver blade, dye 18 with no name, is not the base one). The fitted door named its pictures by the dye alone, so
  the two would have shared one fitted picture: `iconName` and `requestFittedIcon` carry `dyeTarget`, and every fitted
  caller hands it (the hotbar's slot, the diamond's cell, the pack's `linePicture`, the Broker's offer).
- **A garment's slot drew another garment's colour (F2).** A hotbar slot keyed its picture by its quickslot kind, and Blue
  Straps and Red Straps are one kind; with DYE-ICON dyeing the cloth, the slot kept whichever dye it drew first. The key
  is the picture's own name now, and the bar's signature reads the shown item's dye.
- **The set strip against GOLD-DROP (F1).** Main keeps one floater at a time - the gold field or an item's card; the doll's
  set line picked a piece and left the field standing under the card. It puts the field away, as every pick does.
- **The floor's pictures (F3)** - a piece lying in the world (the gate court's spoils) asks the swatch too, as the pack does.
- `fittedImg`'s own comment said a shrunk picture is drawn smoothly; since A1 it is pixelated but in the phone's socket.

Mutants: `tools/mutants/ui1.json` 40 (the merge's two), `auditfinal.json` (the final audit's, with the Sigil Sets'), all
dead.

## What it does not do, said so

- The classic skin is untouched: DFU's inventory paper, its HUD's spell rows, no hotbar.
- No icon pack (DFU's SpellIconCollection packs) is read: the 69 classic icons alone.
- A sprite is never rotated to fit a slot: a longsword is long.
- A phone's accessory shelf keeps its compact row: six pairs across a 393px screen leave a 23px socket, and the
  picture is shrunk into it (smoothly) rather than the shelf growing (UI1).
- Below a desktop the worn map keeps its compact rows and their 34px tiles; the 56px wells are the desktop's (UI1).
- A phone on its side has no free band at the left edge: the chat's peek lines already cross the quickslot diamond
  there (they did before UI3). The widget keeps out from under them - beside the diamond, below the lines - and steps
  aside while the chat is open over the whole edge (UI3).
- The status widget takes no pointer: a tile is not pressed and has no hover card (the HUD is a readout, and a
  pointer-locked player has no cursor). The Status box (the I key) and the sheet say every effect in words (UI3).
- The game's own timings stay unsaid: a poison's minutes and a disease's days have no foot, as DFU shows neither (UI3).

## AC-COMPARE - the character's armour at a glance, and what a wear would change (FIELD BUGS 2026-09-29d)

> SylviaBun on the Discord (#suggestions, "Total AC counter and comparison features for hovering items"), Althea's
> idea: "when in the player inventory we should be able to see the total AC of equipped items on our characters.
> Hovering our cursor over an item (maybe with a modifier like alt) should also allow us to see comparative stats, maybe
> just two tooltips side-by-side or a straight up + or - stat next to the items stats in green and red so we can quickly
> see what is better or worse."

The enhanced pack alone (`ui/armourCard.js`, composed by `ui/enhancedInventory.js`); the classic window keeps DFU's doll
and its seven labels. NOTHING IN IT IS A NEW LAW: every number is one the port already computed, read through the member
that computes it.

**THE PARTS WHERE THE BODY IS.** DFU's armour is seven numbers, one a body part, and the classic doll labels each where
it draws the part (RefreshArmourValues, PaperDoll.cs:154-173: `(100 - ArmorValues[part]) / 5` plus the armour modifier).
The enhanced pack draws the parts as the worn map's panels, so the panel for each part's slot (GetBodyPartForEquipSlot,
`equip.js bodyPartForSlot`: the head, each arm, the chest armour, the gloves, the leg armour, the feet) carries the
part's number in its top-right corner - the classic label's own (`nativeInventory.armorLabelValue` over
`entityMods.entityArmorDisplayMod`, so an armour affix's and a set's points are in it), filled or empty, a bare part 0
and dimmed. A shield's share stands on the parts it covers, as the doll's does. The corner steps off a sigil's rune.

**ONE FIGURE, AND WHY THIS ONE.** DFU keeps no total, and every blow meets ONE of the seven: CalculateAttackDamage draws
the struck part (FormulaHelper.cs:616, the table at :869) and CalculateArmorToHit adds that part's value alone to the
chance to hit (:808, :1158). So the pack's figure is the armour a blow meets ON AVERAGE - each part's number weighed by
how often a blow lands there, by the struck-part table of the combat core in force (`formulas.js struckBodyPartTable`:
FormulaHelper's twenty - the head 2, each arm 3, the chest 4, the hands 4, the legs 3, the feet 1 - or the combat
overhaul's own 1/3/3/4/3/4/2, which it now registers beside its core on the core's own switch). Under FormulaHelper it
is a fifth of the armour term a blow's hit chance takes on average; a sum would count a kite shield three times, a plain
mean would weigh the feet like the chest. The overhaul turns a player's armour into a cut in the damage, so the figure
claims only what is true under both cores. It stands on a plaque at the top-left of the figure's column, to a tenth
("Armour 6.1"), and its hover says how the parts are weighed.

**THE CARD COMPARES, AND THE WEAR DOES WHAT IT SAID.** The item card - the hover's and the pick's, the pack's one way of
showing an item, so no modifier key and nothing for KB1's registry - carries under its stats what wearing the piece
would change: what it replaces (EquipItem's three unequip arms, ItemEquipTable.cs:117-137, as `equip.js wearLeavers` -
ONE export, which `equipItem` itself now runs: a two-hander clears both hands, a shield bumps a held two-hander, the
occupant swaps out), then a weapon's Damage row against the weapon in the hand it takes (DFU's `%wdm`,
`itemInfo.weaponDamageRange`), the overall figure, and each part the piece covers or the wear moves - the doll's number
now and after, with the difference in the wear bar's green where it is better and red where it is worse. The after is
DFU's table with each leaver given back and the piece taken off (UpdateEquippedArmorValues, on a copy) plus every
`entityMods` fold run over the table the wear would leave, on a stand-in for the wearer. A two-hander over a sword and a
shield says both halves: the damage it adds and the three parts the shield leaves bare. Pinned by the wear itself: for
a Magic cuirass (its affix counted), an ebony one, a tower shield over a kite, a two-hander over a sword and shield and
over two weapons, a shield over a two-hander and clothing boots over iron ones, what the card replaces is what
`equipItem` takes off, and every part and the overall figure after it are the doll's once worn.

**What it does not do.**
- An UNIDENTIFIED piece's affixes are left out of its comparison (its card says "Unidentified" and no affix); worn, they
  work and the doll shows them, as DFU's doll shows an unidentified item's powers.
- DFU's enchantment channels (Strengthens / Weakens Armor, BadReactionsFrom) are read as they stand, not re-run for the
  wear - they are the magic round's, and one of them waits on the foes nearby.
- A broken piece, one the wearer's career forbids and one no slot takes have no comparison; a ring or a shirt, with no
  stat to set against another, draws none.
- A weapon's rarity damage affix stays its own line on both cards: the Damage delta compares the Damage rows.
- The shop's and a player trade's detail strips draw no comparison.

Pinned: `test/fb0929d_accompare.test.js` (5), `tools/mutants/fb0929d_accompare.json` (35 mutants, 35 dead). Seen in
Chromium with the real ARENA2's icons at 1366x768 and on a phone (a scratch probe, not committed).
