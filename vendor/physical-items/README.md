# Physical Items 0.1.29 - demifiend000 (ported off the IL; no art - the world draws each item's own picture)

**Physical Items 0.1.29** for Daggerfall Unity 1.1.1, by **demifiend000**
(Nexus mod 1411; GUID `8764ae71-a464-4a5e-b646-fbc464670137`; the
manifest's ContactInfo is `romansoldier98@gmail.com`). The mod's own
description: "Inventory-sprite world items with shift-drop, corpse
proxies, pickup, placement, and persistence." Its one required dependency
is `daggerfall.harmony`. The same author's Horse Cart and Cargo is
`vendor/horse-cart-and-cargo/`.

Mac (Lattymoy) handed the shipped zip
(`Physical_Items_1411_1_2026-10-07T03-53Z_k855tuXe51`, one file,
`physical-items.dfmod`) over on 2026-10-07: "This is the next mod I would
like to integrate (permission has been granted). This should work for both
morrowind and the sprite system, and should also included the rarity
treatment (like we do for the world boss)". The upload arrived as a
browser's partial download (`.zip.part`, 44,705 bytes, no central
directory); its one local entry, the bundle, was whole - 52,372 bytes,
inflated to the end of its deflate stream.

**Permission: [Mac: record the author's permission, or the link to it,
here - Mac confirmed on 2026-10-07 that it was given ("permission has been
granted"); the earlier mod records carry the author's own words or a link
in this line.]**

## What the mod is

One assembly, `PhysicalItems.dll` (82,944 bytes; 224 methods, 34,596
bytes of IL), its settings and its manifest. No textures, no models: an
item in the world wears its own INVENTORY picture
(`ItemHelper.GetInventoryImage`), cropped to its visible texels (alpha 128
and over), on a DFU billboard, at a world size its category sets.

- **Corpse proxies.** At an enemy's death (`OnEnemyDeath`) every item in
  its corpse - of a category the settings show - is thrown out of the body
  as a physical item and lands round it. The corpse KEEPS its contents: a
  proxy is a picture of one of them, and taking the proxy takes that item
  out of the corpse. Taking it through the corpse's window takes its
  proxy away.
- **Shift-drop.** Shift-clicking a pack item (any remote target, not a
  reward tray) drops it as its own loot container, presented as itself and
  laid out round the spot 1.1 m ahead of the player on a golden-angle
  spiral. A Transportation item is refused ("cannotRemoveItem").
- **Pickup.** Activate on an item, from 3 m, takes it into the pack by the
  mod's own TryPickup: a summoned item refused, a map read and spent, a
  quest item's click, the whole stack or nothing ("cannotCarryAnymore"),
  gold into the purse. Activate on a body takes the item standing nearest
  it.
- **Physics.** A Unity Rigidbody under gravity, drag 0.9, rotation frozen,
  a box collider; the material bounces 0.35 (Maximum) and grips 0.45 /
  0.55 (Average). At rest - the ground within reach, the speed under 0.05
  m/s for half a second - it settles. Loose items shoulder each other
  apart.
- **Placement** (hold Activate 0.25 s): carry, throw, billboard or flat,
  freeze, scale and rotate by the wheel; a contact shadow; nearby labels.
- **Persistence.** Its own save data: each item's placement (a body's
  items beside it, a dropped container's where it lies), keyed by its
  container's LoadID and the scene.

## What is here

- `physical-items.dfmod.json` - the shipped manifest, verbatim (the bundle
  names it `physical-items.dfmod`).
- `modsettings.json` - the six sections as the bundle ships them (Enemy
  Loot, Enemy Categories, Item Sizes, Interaction, Weapon Sizes, Armor
  Sizes). `src/systems/modSettings.js` restates every key the port reads
  under the vendor key `physical-items`, section and name joined with a
  dot, with the port's own `Enabled` in front.
- `PhysicalItems.dll` - the shipped assembly, byte for byte, and
  `il/PhysicalItems.il.txt` - every method body as CIL, dumped by
  `tools/ilDump.py`. The port (`src/systems/physicalItems.js`,
  `src/scenes/physicalItemsLayer.js`) cites the IL offsets it restates.

## The port

`bible/06-Systems/Physical-Items.md` is the record: what is ported, the
two pictures (the pack's classic picture, or the item's Morrowind one
while a Morrowind build stands), the rarity dress (the world boss's loot
line and the port's own tier rim), and what is not yet ported (placement -
the hold, the throw, the freeze, the wheel - the contact shadow, and a
body's items' saved places: they are laid round it again after a load,
while a shift-drop is saved where it lies, as any pile is). Its fifteen
departures are listed there; `bible/01-Overview/Audit-PI1.md` is the
audit.
