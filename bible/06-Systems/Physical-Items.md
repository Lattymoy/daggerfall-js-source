# Physical Items (demifiend000) - PI1

**Physical Items 0.1.29**, by **demifiend000**, Nexus mod 1411 - "Inventory-sprite
world items with shift-drop, corpse proxies, pickup, placement, and persistence."
Mac handed the shipped zip over on 2026-10-07: *"This is the next mod I would like
to integrate (permission has been granted). This should work for both morrowind and
the sprite system, and should also included the rarity treatment (like we do for the
world boss)"*. The upload came as a browser's partial download (`.zip.part`, no
central directory); its one entry, the bundle, was whole.

The vendored record is `vendor/physical-items/README.md` (the permission line is
open: `01-Overview/Mod-Registry.md`). The same author's Horse Cart and Cargo is
`06-Systems/Horse-Cart-And-Cargo.md`'s.

## What it is

An item in the world is drawn as ITSELF - its inventory picture on a billboard -
rather than as a loot bag:

- **A body's items.** When a foe dies, every item in its body whose category the
  settings show is thrown out of it and lands round it. The body keeps the item: the
  thing on the ground is a picture of one of the body's items (a *corpse proxy*).
  Pressing it takes that item out of the body; taking it through the body's own
  window takes the picture away.
- **A shift-drop.** Shift and a click on a pack item drops it - each item its own
  one-item container, laid out ahead of the player.
- **The press** takes an item straight into the pack. No window.
- **Physics.** A rigidbody: it falls, bounces, slides, stops; loose items shoulder
  each other apart.
- **Placement** (hold Activate): carry it, throw it, stand it flat, freeze it, scale
  and turn it with the wheel. A contact shadow under it. **Not ported** (below).

## The law is the assembly

The bundle carries the build, not the sources: `PhysicalItems.dll`, 224 methods,
34,596 bytes of IL, dumped by `tools/ilDump.py` into
`vendor/physical-items/il/PhysicalItems.il.txt`. Every `[IL_xxxx]` in the port names
an offset there. The pure law is `src/systems/physicalItems.js`; the scene half is
`src/scenes/physicalItemsLayer.js`.

### The categories and the size

- **GetItemCategory** `[IL_28e4]`: sixteen categories in `ItemCategories`' order
  (`.cctor [IL_7dac]`). A potion is Potions before its group is read; a Weapons
  arrow (template 131) is Arrows; a MiscItems map (template 287) is Maps; Drugs,
  UselessItems1/2, Furniture, Paintings and Deeds fall to Other Items.
- **The size** (`BuildVisual [IL_0982]`): the picture's VISIBLE texels
  (`GetVisibleArtworkUV [IL_0d39]`: alpha 128 and over; a picture with none is
  whole) are cut out, and the longer side is made the item's world height. The
  height is `GetWorldHeight [IL_2848]`: a weapon's or an armour piece's own override
  (the Weapon Sizes and Armor Sizes keys, by DFU enum name with `_` read as a space,
  both pauldrons the one "Pauldrons" key - `ApplySettings [IL_2f73]`), else the
  category's Item Sizes key, else `GetDefaultWorldHeight [IL_2a08]` - weapons 0.8 m,
  an arrow 0.32, armour 0.65, clothing 0.52, the rest 0.4. The settings' own text
  says "height for other categories"; the code is the longer side for every
  category, and the port follows the code.
- The press box's depth is `GetColliderDepth [IL_1a21]`: the width, or 0.4 of the
  height, whichever is more.

### The throw

- **Where it starts** (`RandomScatterOffset [IL_51d8]`): a direction in the disc,
  0.45 to 0.85 m out, 0.65 m up from the body's foot. The item is set 0.65 m over the
  body and moved out to that point through `ConstrainItemMovement` (`[IL_4fdc]`;
  the port's `constrainMove`): a wall on the way stops it short by its own half-width
  and the rest of the move slides along the face, so a body against a wall never
  throws its items through it.
- **How it leaves** (`CreateCorpseProxy [IL_4fe6]`): AT THE FALL, 0.75 to 1 of 0.85
  m/s out along its bearing plus a tenth of a disc, and 0.7 to 1.1 m/s up - all
  times Impulse Strength (shipped 200 percent: 2x; clamped 0 to 400 - `[IL_2e73]`).
  A body met LATER (a load, a return) has its items launched at 0.08 m/s along their
  bearing and 0.08 m/s up, unscaled. Both are the body's velocity at its start
  (`StartDynamic` sets it), never a force. The port knows the fall from DFU's own `OnEnemyDeath`
  (`HandleEnemyDeath [IL_4790]` - `scenes/corpseMarker.js raiseEnemyDeath`): the
  layer registers a handler that notes the entity, and a body first met within 4 s
  of its death is thrown.

### The body

The mod's item is a Unity Rigidbody (`BuildVisual [IL_0c2d]`): drag 0.9, rotation
frozen (constraints 112), mass from its weight. Its material
(`CreatePresentationResources [IL_2b21]`) bounces 0.35 under Maximum and grips 0.45
dynamic / 0.55 static under Average. The port has no physics engine, so it restates
the body as a fixed-step integrator (`stepBody`, Unity's 0.02 s step and 9.81 m/s²):

- the bounce is 0.35 of the landing speed, against Unity's default material (no
  bounce, so Maximum gives 0.35) - and none under PhysX's 2 m/s bounce threshold;
- the grip is the Average of the item's and the default material's 0.6: 0.525
  sliding, 0.575 holding;
- a wall stops the move across and takes the speed into it back at the bounce, and
  a ceiling over a rising item turns it back the same way;
- the floor is asked from 0.05 m over the item's foot, so an item rolling under a
  table stays on the floor rather than climbing onto the top;
- **it settles** (`Update [IL_1da7]`) once the ground is within 0.1 m and the speed
  has stayed under 0.05 m/s for half a second;
- **the shoulder** (`FixedUpdate [IL_1e94]`): a body by the ground (within 0.15 m
  of it) and slower than 0.65 m/s across and 0.5 m/s up or down eases toward 0.45
  m/s away from every box it overlaps (grown 0.04 m across, 0.08 m in height),
  settled neighbours included, at 1.5 m/s a second. It never restarts the settle
  clock. Two on one spot part by order: the lower index goes to -x.

The floor is the host's collider (the torch's own door); with no collider, or
nothing under the item, it is the floor the item came from. Any flight still moving
after 8 s stands where it is: that limit is the port's own (the gate spoils' spew
gives up after 6 s, `SPEW_FLIGHT_MAX_S`). A body that moves (a ship's deck) carries
the items lying round it, and the flights hold while the game is paused (`FixedUpdate`
returns on `IsGamePaused` `[IL_1eb6]`): each host hands its own pause answer.

### The shift-drop

- **The press** (`LocalItemLeftClickPrefix [IL_0528]`): either Shift and a left
  click on a pack row, not on a reward tray (ChooseOne). A Transportation item is
  refused with DFU's "cannotRemoveItem" (`[IL_0565]`).
- **The move** (`QueueInventoryPhysicalDrop [IL_34b8]`): DFU's own TransferItem onto
  a fresh container. The port's is `shiftDrop` - the pack's own ground guards,
  through the one transfer ladder (systems/itemTransfer.js planStore/applyTransfer):
  the lock (LOCK1), a pack-only piece (WALLET1), a bound one (SS3: the ground is
  "elsewhere"), a loaded Materials Bag (BAG1), the floor's own word (HOUSE-DROP), the
  quest arm, and a map read rather than dropped (F156). The whole stack moves (a drop
  onto the ground always fits; TransferItem's split asks only when it would not).
- **The layout** (`GetBatchSpreadCentre [IL_3fa4]`, `GetBatchDropPosition
  [IL_4028]`): the spiral's centre 1.1 m ahead of the player's feet (flat); point i
  is 0.78 * sqrt(i) out at i times the golden angle. A point is taken when:
  - there is a floor (`TryProjectBatchPointToFloor [IL_4104]`): a ray from 2 m over
    the feet's height and 5 m down, each face it meets with a normal at least 0.5 up,
    the one nearest the feet's height (a table over the spot is not the floor);
  - the way from the feet is clear (`HasClearBatchPath [IL_4248]`: lifted 0.2 m, a
    0.05 m skin);
  - no drop already placed overlaps it (`OverlapsPlacedDrop [IL_4338]`): across the
    ground (x and z), nearer than the two footprints and 0.1 m. A footprint is
    max(0.2, 0.6 x the item's size) (`FlushPendingDrops`).

  After 256 tries it falls back to the feet. Each lands 0.025 m above the floor and
  drops (`PhysicalizeIndependent [IL_46fc]`: StartDynamic(zero)).

### The press

`TryPickup [IL_847c]` is the mod's own logic, in this order:
1. a summoned item is refused ("cannotRemoveItem", `[IL_8494]`);
2. a map is read and spent (`RecordLocationFromMap`, then `RemoveItem`);
3. a quest item's click;
4. the WHOLE stack, or nothing (`CanCarryWholeStack [IL_858c]`: "cannotCarryAnymore");
5. gold goes into the purse.

The port's one door for one item is `systems/quickLoot.js takeOneItem`, quick
loot's own `takeThrough` with `wholeStack` set: planTake's summoned refusal, the
quest click, the carry check, the gold counter, then the pickup cards or the line.
Quick loot itself keeps taking the part that fits. A map goes to the host's reveal
(`world.js revealLocation('readMap')`, through worldModes into the dungeon): it is
spent, and "You have already discovered..." is said when there was nothing left to
find. The port adds guards the pack already keeps:
- a transformed lycanthrope's paws take nothing;
- a quick-loot key armed over the item is spent on that press (WB9's law for the
  spoils);
- a body's silver is rolled at its first take (SILVER-FINDS' door; the dungeon's by
  the room's name for the body);
- the room hears every take that moved anything.

The press reaches 3 m (`RaycastPhysicalItem [IL_5b54]`), whatever the host's own
pile reach.

The name under the crosshair is World Tooltips' own for a pile of one -
`lootPileName`: the long name, and the stack in brackets - which is the mod's
`FormatWorldTooltip [IL_5d7f]` "{0} ({1})" word for word.

## The two pictures

Mac: *"This should work for both morrowind and the sprite system."* The layer asks
for the item's **Morrowind** picture first - `combat/fpArm.js mountPicture`, the
item's Morrowind ground mesh face-on, the decor room's own door (MW-MOUNT) - while a
Morrowind build stands (attached data is the switch, MWA4), and the pack's
**classic** picture otherwise (`ui/itemIconColor32.js` - the classic TEXTURE art, a
replacement, the item's dye, for the wearer's gender and race). A build that lands
or goes (`mountPictureStamp`) has every item ask again. Either is cut to its visible
texels and sized by the mod's law above, under the pseudo-archive 38161.

The Morrowind picture is rendered 64 texels on its longer side (`PI_MW_PX`), the
classic icons' density, so the tier rim reads as a rim. Each cut picture's clear
edge is bled from its shown texels (`bleedEdges`), so the mips draw no dark fringe.
A render with nothing in it is a miss, and the classic picture stands instead. A
Morrowind miss while a build stands is asked again 5, 10 and 20 s on; so is a
picture that did not come at all. An item is PRESENTED only once its picture
stands: until then its pile keeps its bag and its press, and its body's line counts
it. A re-ask that fails keeps the picture already standing. A size or rim setting
moved re-dresses what stands.

The pictures are the renderer's, held across every layer: a dungeon's teardown frees
only what nothing else on that renderer still stands in (`heldTextureCount`).

## The rarity dress

Mac: *"the rarity treatment (like we do for the world boss)"*. The mod draws no
rarity. The port dresses each item in two ways:

- **the line** is the world boss's: a Rare-or-better item stands the loot line the
  boss's spoils stand (`11-Multiplayer/World-Bosses.md` section 12, WBX3) out of the
  top of its own picture (`scenes/lootLines.js`, LOOT11's pick and its eight-nearest
  cap). An item standing as itself is its own find, and the body or pile it lies for
  no longer counts it toward its own line (`isPresented`);
- **the rim** is the port's own, because the boss's spoils wear none: a
  Magic-or-better picture wears its tier's colour as an outline and a lift
  (`systems/hitFlash.js setBatchGlint` - the outline's own texel test), stronger up
  the ladder (`PI_RIM`: Magic 0.3, Rare 0.45, Legendary 0.6, Aetheric and Artifact
  0.7);
- with the rarity row off (LR5's switch), neither is drawn.

Nothing chimes as the items land. A Rare-or-better body already chimes at the kill
(`playRareDrop`).

## The seam

THE ONE CONSTRUCTION SEAM: the ground-pile pool every host builds
(`scenes/droppedLoot.js createDroppedLoot`) stands the layer for itself, so its draw
(`batches`), its ray (`lootTargets`, keys `droppedLoot:pi<n>` - the pool's own
vocabulary, so every host's reach, too-far line, name ladder and plaque read an item
as the pile of one it is), its contents, its lines (`lootFinds`), its recentre
(`offsetAll`), the ground's moves (`groundMoved`) and its clock (`tickFlats`) are
the doors each host already calls. A shift-drop is a pile of the pool's own
(`dropPhysical`, `physical: true`), saved and cached as every pile is, restored
lying where it came to rest; its bag stands only when the mod is off, or its
picture would not load.

Each of THE FOUR HOSTS attaches its half (`physical.attach`) and takes on the press:

| host | collider | bodies | map | the press |
|---|---|---|---|---|
| `scenes/world.js` | the world's | the encounter pool's and the watch's (`physicalCorpses`) | `revealLocation('readMap')` | the pile arm, after the too-far line |
| `scenes/exterior.js` | the town's | the encounter pool's and the watch's | none (no region index - useHooks' own note) | the pile arm, after the too-far line |
| `scenes/worldModes.js` (interiors) | the room's | the room's foes' and the watch called in | the outer host's | the `droppedLoot:` arm |
| `scenes/dungeonContext.js` | the dungeon's | its searchable bodies (`corpse:<i>`) whose room word this build can read | the outer host's (none on `?dungeon`) | `takeLoot` |

And each hands the pack its shift-drop (`physicalDrop` / `physicalDropOn`, beside
`onDrop`) onto its own pool - the interior's onto the room's, never the street's. The
fate window (a body's pack opened from the street host, indoors or underground too)
drops nothing. A dungeon's save keeps a shift-drop one, and it is restored lying.
A body comes from `scenes/corpseMarker.js physicalCorpseSources`, the one walk both
street pools share: a searchable body (not disabled) whose marker has landed, never
a peer's puppet.

## Online

The player's own (`systems/onlineLane.js ONLINE_PLAYERS_OWN_MODS`). A peer's body
shows no items (its list is its owner's - lootFinds' own rule); a shift-drop is a
pile like any drop. In the dungeon a body is the world room's container: an item
taken off one is published as the quick door's take is (`publishLoot`, WORLD4 /
LOOT-REGEN), so what any peer reads of a container is the same with the switch on
or off.

## Recorded departures

1. **Placement is not ported**: holding Activate to carry, the throw, billboard and
   flat placement, freeze, the wheel's scale and turn, the nearby labels while held,
   Character Item Collision and the contact shadow. A press takes the item. Their
   four settings (the Interaction section) are not declared - a key nothing reads is
   a switch that does nothing - and their save fields (placement mode, scale, the
   artwork's turn, frozen) have nothing to hold.
2. **The body is an integrator, not PhysX** (above): the numbers are the mod's and
   Unity's defaults; contact is the ground under the item and a wall across, with no
   rotation (the mod freezes it too) and no stacking on another item.
3. **A body's items are not saved where they lay.** The mod saves each proxy's place
   beside its body; the port's bodies already ride each host's save with their lists,
   and a body met after a load lays its items round it again (the nudge). A shift-drop
   IS saved where it lay, as a pile.
4. **SHIFT-STOW keeps its stores**: Shift on a pack row with the wagon or the
   player's own storage beside it deposits there (the port's own, 2026-10-04, here
   first); everywhere else it is the mod's shift-drop.
5. **Maps** with no host reveal (`?town` and `?dungeon`) come into the pack as the
   item; the mod reads every map. The reveal's message box (TEXT.RSC 499) is not
   shown on a press: the notebook's note is written and the location is marked. In
   the wilderness `revealLocation` has nothing to name, and the press says
   "readMapFail", as the pack's own Use does.
6. **The rarity dress and the Morrowind picture** are the port's own (Mac's asks):
   the mod draws every item from its inventory art and no rarity. Each Rare item
   stands its own line, and so takes one of LOOT11's eight slots; the rim's padding
   is not in the batch's bounding sphere (`batchSphere`), so a rim at the screen's
   edge can be culled a frame early. The Morrowind picture's framing on the ground
   is the wall mount's (MW-MOUNT), and needs an in-game look. `exterior.js`
   (`?town`) draws no loot lines at all (before this mod too), so its Rare items
   stand none there.
7. **The press box** is at least 0.2 m half-wide and 0.25 m tall
   (`PI_BOX_MIN_HALF`, `PI_BOX_MIN_H`), so a dagger lying flat is still a thing to
   aim at. The mod's hitbox is the picture's own box.
8. **A body is opened, not searched for its nearest item.** The mod's ray, landing
   on a body, takes the item standing nearest it (`FindNearestProxyForCorpse
   [IL_5bd3]`, within 3 m); the port's body keeps its own press (its window), and an
   item is taken by pressing the item.
9. **Every searchable body stands its items**, not only the bodies the mod saw die:
   the mod's groups are made at `OnEnemyDeath` and restored from its save, and the
   port reads each host's list of bodies.
10. **Shift and Control does not split.** TransferItem's split asks under Control;
    the shift-drop always moves the whole stack.
11. **Each click is laid at once**, clear of the shift-drops already lying. The mod
    queues a window's drops and lays them together at its close
    (`FlushPendingDrops`).
12. **"At the fall" is 4 s** (`PI_FRESH_MS`): a body first met within 4 s of its
    `OnEnemyDeath` is thrown. The mod throws inside the event itself; the port's
    layers meet a body on their next frame.
13. **A restored shift-drop lies settled** where it was saved. The mod restores it
    dynamic (`StartDynamic(zero)`), and it settles half a second later.
14. **Words, not message boxes.** The mod's refusals are message boxes; the port's
    are said on the host's line, and a take shows the pickup cards or the line, as
    quick loot's do.
15. **A load lays the bodies' items again** (3, above), so a player who saves beside
    a body sees its items land again after the load.

## Pins

`test/pi1_physicalitems.test.js` (15): the record (the manifest and every declared
key verbatim, the four undeclared ones named), the categories against `.cctor`'s
list and over every item producer, the sizes and clamps with the IL's constants,
the picture's box and cut, the scatter and the throw, the spiral (and its 0.1 m
margin), the body (no bounce under 2 m/s, 0.35 over it, the slide, the settle, the
port's floor), the shoulder (by the ground only, settled neighbours, the height
gate, the tie), the rarity rim, the bodies (thrown at the fall, nudged later, a
category off left in, presented once pictured, the window's take), the press (out
of the body, the gold to the purse, the room told of a take off a body), the pool
(one pile an item, presented, saved, restored lying, the bags back with the mod
off), the lines (a presented item's line is its own), the shift-drop law (the
refusals, the whole stack, the map), and the seams (one maker, the four hosts'
halves, both packs, both street pools).

`test/audit_pi1.test.js` (20) holds the audit's fixes, one test a finding group
(`01-Overview/Audit-PI1.md`). Mutants: `tools/mutants/pi1.json` (47) and
`tools/mutants/audit_pi1.json` (52), all dead.
