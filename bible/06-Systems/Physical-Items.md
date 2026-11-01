# Physical Items

A port of the DFU mod **Physical Items** 0.1.29 by demifiend000: an item in the world is drawn as itself, its
inventory picture on a billboard, not as a loot bag. When a foe dies its items are thrown out round its body; Shift and
a click on a pack item drops it on the ground; pressing an item takes it straight into the pack. The mod's IL is the
law, and an `[IL_xxxx]` names an offset in the 0.1.29 assembly. Our code is the record:
`test/systems/pi1_physicalitems.test.js` holds the shipped settings as a literal table, and the release's record is in
`01-Overview/Own-Work.md`.

## How it works

**A body's items.** Every item in a searchable body whose category the settings show is thrown out round it. The body
keeps the item; the thing on the ground is its picture (a corpse proxy). Pressing it takes that item out of the body;
taking it through the body's window removes the picture. A body met within `PI_FRESH_MS` (4 s) of its death is thrown
hard; one met later (a load, a return) has its items nudged out gently. Each item starts 0.45 to 0.85 m out from the
body and slides along a wall rather than through it (`constrainMove`).

**Categories and size.** Sixteen categories in the mod's order (`PI_CATEGORIES`, `itemCategory`): a potion is Potions,
an arrow is Arrows, a map is Maps, and drugs, useless items, furniture, paintings and deeds fall to Other Items. The
picture's visible texels (alpha 128 and over) are cut out and the longer side becomes the world height: a weapon's or
armour piece's own size key, else the category's, else `PI_DEFAULT_HEIGHT` (weapon 0.8 m, arrow 0.32, armour 0.65,
clothing 0.52, other 0.4).

**The body.** The port has no physics engine, so `stepBody` is a fixed-step integrator using the mod's and Unity's
numbers (`PI_BODY`): 0.02 s steps, 9.81 m/s², drag 0.9, bounce 0.35 of landing speed above 2 m/s, sliding grip 0.525
and holding grip 0.575. Walls and ceilings bounce it back. It settles once on the ground and nearly still for half a
second; a flight still moving after 8 s stops where it is. Items near the ground ease apart from overlapping
neighbours (`PI_SEPARATION`). A moving floor (a ship's deck) carries the items on it, and flights hold while paused.

**The shift-drop** (`shiftDrop`). Shift and a left click on a pack row, never on a reward tray. A Transportation item is
refused. The whole stack moves through the pack's transfer ladder, so every ground guard applies: the lock, pack-only
and bound pieces, a loaded Materials Bag, a floor that refuses drops, quest items, and a map that is read rather than
dropped. Drops lay out on a golden-angle spiral 1.1 m ahead of the player (`PI_SPIRAL`), each point needing a floor, a
clear path from the feet and no overlap with a drop already placed; after 256 tries it falls back to the feet. Each
click is laid at once.

**The press.** `src/systems/quickLoot.js` `takeOneItem` with `wholeStack`: a summoned item is refused, a quest item
clicks, the whole stack fits or nothing is taken, gold goes to the purse. A map is read and spent through the host's
reveal. A transformed lycanthrope takes nothing; an armed quick-loot key is spent; a body's silver is rolled at its
first take. The press reaches `PI_REACH` (3 m). The crosshair names the item as World Tooltips names a pile of one.

**Two pictures.** While a Morrowind build stands, an item shows its Morrowind ground mesh face-on (`PI_MW_PX` 64
texels); otherwise the classic inventory picture (art, replacement, dye, wearer). An empty render falls back to the
classic picture and is asked again later. Until its picture stands an item keeps its bag.

**Rarity dress.** A Rare-or-better item stands the world boss's loot line from its own picture
(`src/scenes/lootLines.js`); the item does not count toward its body's line. A Magic-or-better picture wears its
tier's colour as a rim (`PI_RIM`, via `src/systems/hitFlash.js` `setBatchGlint`). With the rarity row off, neither is
drawn.

**The seam.** The ground-pile pool every host builds (`src/scenes/droppedLoot.js` `createDroppedLoot`) stands the
layer, so draw, ray (keys `droppedLoot:pi<n>`), contents, lines and clock reuse the pool's doors. A shift-drop is a
pile of the pool's own, saved and restored lying where it rested. All four hosts attach their half: `world.js` and
`exterior.js` with the encounter pool's and watch's bodies, `worldModes.js` with the room's, `dungeonContext.js` with
its searchable bodies. Bodies come from `src/scenes/corpseMarker.js` `physicalCorpseSources`, never a peer's puppet.

## Rules

- It works for both the Morrowind and the sprite pictures, and wears the rarity treatment the world boss uses (Mac).
- The mod's IL is the law; the port follows its code where the mod's settings text disagrees (size is the longer side
  for every category).
- Online it is the player's own mod (`src/systems/online/onlineLane.js` `ONLINE_PLAYERS_OWN_MODS`). A peer's body shows
  no items. In a dungeon a take from a body is published as the quick door's is, so peers read a container the same
  with the switch on or off.
- The press box is at least `PI_BOX_MIN_HALF` (0.2 m) half-wide, so a flat dagger can be aimed at.

## Daggerfall Unity

The mod hooks DFU's `OnEnemyDeath`, the inventory's left click and `TransferItem`. Departures:

1. Placement (hold Activate to carry, throw, flat placement, freeze, scale and turn, contact shadow, character
   collision) is not ported; a press takes the item. Those four settings are not declared.
2. The body is an integrator, not PhysX: no rotation (the mod freezes it too) and no stacking on another item.
3. A body's items are not saved where they lay; they are thrown round it again after a load. A shift-drop is saved.
4. Shift on a pack row beside the wagon or the player's storage stows there (the port's own); elsewhere it drops.
5. With no host reveal (`?town`, `?dungeon`) a map comes into the pack. A press writes the notebook note and marks the
   place without the message box; in the wilderness it says "readMapFail".
6. The rarity dress and the Morrowind picture are the port's own. `exterior.js` draws no loot lines.
7. A body is opened with its own window; an item is taken by pressing the item, not the body's nearest.
8. Every searchable body stands its items, not only bodies seen dying.
9. Shift with Control does not split; the whole stack moves.
10. Refusals are said on the host's line, not in message boxes.

## Code and tests

- `src/systems/physicalItems.js` - categories, sizes, throw, `stepBody`, spiral, `shiftDrop`, `PI_RIM`
- `src/scenes/physicalItemsLayer.js` - pictures, presentation, the press box
- `src/scenes/droppedLoot.js` `createDroppedLoot` - the pool that stands the layer
- `src/scenes/corpseMarker.js` `physicalCorpseSources` - the bodies
- `src/systems/quickLoot.js` `takeOneItem` - the press
- `test/systems/pi1_physicalitems.test.js` - the manifest, categories, sizes, throw, spiral, body, rim, press, pool,
  shift-drop and the four hosts
- `test/systems/audit_pi1.test.js` - the audit's fixes

## Open

- The rim's padding is not in the batch's bounding sphere, so a rim at the screen edge can be culled a frame early.
- The Morrowind picture's ground framing needs an in-game look.
