# Diverse Weapons

Diverse Weapons gives each weapon template a first-person sprite set of its own, where the classic art has one per
weapon class: eighteen weapons in ten metals, plain and enchanted, every record and frame; Weapon Widget's
double-scale idles; inventory and paperdoll icons in every metal; the Wabbajack's own set. The feature and its names
come from RealAKP's DFU mod Diverse Weapons 1.7.3 (its script by RealAKP and Kirk.O, MIT). Every frame is our own,
built at runtime from the player's classic WEAPON*.CIF and TEXTURE records; no picture ships. It is on by default in
the Mods pane.

## How it works

- **The mod is one line**: it sets DFU's `FPSWeapon.moddedWeaponHUDAnimsEnabled`. Everything that switches on is DFU's
  own, so the feature is DFU's law gated on the mod's switch (`moddedWeaponHUDAnimsEnabled`,
  `src/combat/diverseWeapons/diverseWeapons.js`).
- **The file name** (`moddedWeaponFilename`) is DFU's `WeaponBasics.GetModdedWeaponFilename`: the named artifact
  CIFs, `<NAME>MAGIC.CIF` while enchanted, `<NAME>.CIF`; a custom template answers none. `atlasFileName` is DFU's
  `GetWeaponTextureAtlas` choice. Each frame is asked by DFU's `<FILE>_<record>-<frame>_<Metal>` spelling and drawn
  into the classic record's box. A miss draws the classic frame.
- **Two lanes, one law.** The classic sprite (`src/combat/fpsWeapon.js`, `loadFpsWeaponArt`) and the Weapon Widget
  clone both ask the same functions.
- **Our frames** (`src/combat/diverseWeapons/diverseWeaponsArt.js` `ownWeaponArt`). `LOOKS` in
  `src/combat/diverseWeapons/diverseWeaponsIndex.js` names each weapon's classic file (plain and magic) and its rule:
  a blade reshaped by length, width, curve, a chiselled tip and a fuller (the dagger's redrawn behind the hand), the
  war axe single-bitted, the staff and the Wabbajack ringed with metal. Each metal is our own ramp (`METAL_RAMPS`); the
  hand and arm stay Daggerfall's. An enchanted weapon is built from the magic file, so it fills its own box.
- **The shapes hold across frames.** The war axe's bit is read off the haft (its wood, never a glow), so a swing
  keeps one bit. A widened blade moves what hugs its edge out whole, and a pixel the move strands goes (`unspeckle`).
  A fuller is a groove: its wall on the light's side in shadow, a darker floor, the far wall lit (`FULLER`).
- **The idles and icons.** The double-size idles are Scale2x (`scale2x`), edges kept. Weapon icons (archives 233 and
  234 by metal, 432 and 433 for the Wabbajack) are the classic records in our metals, asked by DFU's `GetItemImage`
  name with the item's dye; Silver asks the bare name.
- **A player's own copy** of the mod, attached through the textures pick, still answers first: its bundle by GUID, or
  a loose PNG of a name (`src/combat/diverseWeapons/diverseWeaponsAssets.js`), as DFU's `TryImportCifRci` reads one.
- **The Weapon Widget preset** (`DIVERSE_WEAPONS_WIDGET_PRESET`, `withDiverseWeaponsPreset`): the mod's recommended
  Weapon Widget settings as a literal table, laid over the player's own while the mod's `WeaponWidgetPreset` switch is
  on, so turning it off gives theirs back. Weapon Widget's `Enabled` is never in it. Under the preset, the doubled
  idle's offset applies only where the box is really doubled (DoubleScaleTextures without TrueTextureSize, on a `w_`
  hit).

## Rules

- Our own set (OWN-WORK, the owner): built from the player's files, no outside author's pixel read. It answers only
  while the mod is on.
- The preset is off by default, so the frames move with Weapon Widget's own defaults (Mac).
- A drawn copy wearing a Wardrobe look is no artifact: it swings the look's file (`04-Characters/Wardrobe.md`).

## Daggerfall Unity

The asking is DFU's own law (`FPSWeapon`, `WeaponBasics`, `TextureReplacement`, `ItemHelper.GetItemImage`).
Departures: the frames are ours, built from the classic records; the preset is laid over rather than overwriting; a
look copy swings the look's file; the icon key carries the dye.

## Code and tests

- `src/combat/diverseWeapons/diverseWeapons.js` - the switch, file names, preset
- `src/combat/diverseWeapons/diverseWeaponsIndex.js` - the names we answer and each weapon's look
- `src/combat/diverseWeapons/diverseWeaponsArt.js` - our frames and icons, from the player's records
- `src/combat/diverseWeapons/diverseWeaponsAssets.js` - the door: ours, or a player's attached copy
- `test/combat/weapon/dw1_diverseweapons.test.js`, `test/combat/weapon/auditdw.test.js` - the law, both lanes
- `test/combat/weapon/ownwork4_dwart.test.js` - our frames; mutants `tools/mutants/ownwork4dw.json`
- `test/tooling/dw2_shipped.test.js`, `test/systems/dw3_icons.test.js` - the set's names, the icons

## Open

- Archives 513 and 514 (Roleplay & Realism: Items' custom items) are not asked for; a few `w_` names misspelt in the
  mod's file list are dead.
- Opening an attached bundle takes about 10 s once, in a worker; our frames draw meanwhile.
