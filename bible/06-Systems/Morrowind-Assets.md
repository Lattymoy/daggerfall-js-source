# Morrowind assets

An opt-in 3D layer. With the player's own Morrowind data attached, the game draws the first-person arms, hands and
weapons, and a third-person body, from it: `Morrowind.bsa`, the expansions' archives, the `.esm` masters, and any
loose `meshes/` or `textures/` a mod ships. None of it is in the repo (Morrowind is not freeware). The player attaches
it through the Features home's assets card (**Attach** and **Remove data**); it is kept in the browser's IndexedDB
(`morrowind` store). What OpenMW does, with cites, is in `02-Formats/Morrowind-Rules.md`.

## How it works

1. **Attach** (`src/scenes/dataSource.js` `storeMorrowindFiles`). Files matching `.bsa`, `.esm`, `.esp` or a loose
   asset extension are stored as the Blobs they arrived as, keyed by basename (archives, masters) or data-files path
   (loose). The attached files are the switch: attaching builds the body for the character in play, and every later
   character made or loaded while files are attached gets one. **Remove data** turns it off.
2. **Count** (`registerMorrowindData`): counts the set and stamps an attach fingerprint, built from names and sizes,
   that the rig's caches key on. Re-attaching a different file under the same name invalidates them.
3. **Open** (`loadMorrowindArchives`). Archives are ranked: one loose archive first, then Weapon Sheathing's vendored
   scabbards (`src/systems/weaponSheathingAssets.js`, fetched on first ask), then expansion and mod `.bsa` files, then
   `Morrowind.bsa`. `MwBsaFile.open(blob)` reads only the header and directory by range. An entry's bytes are read
   by range when a reader `load`s it and cached; a second load of an entry in flight joins the first. `get` stays
   synchronous and throws, by name, for an entry nobody loaded.
4. **Records**. One pass over each master (`extractArmRecords`) reads the races, body parts, armour, clothing, weapons
   and GMSTs. The result is kept in a derived store (`loadMorrowindArmRecords`) under a key naming the reader version,
   the file, its size and a stamp over its first and last 64 KB. A later boot reads it back without touching the
   master. A stale envelope is refused and re-extracted.
5. **Build** (`src/combat/fpArm.js` `buildFpArm`). Loads the skeleton, body parts, weapon and animations (NIF, KF),
   then the textures they name. Texture decoding (DDS to RGBA8) runs in a pool of module Workers
   (`src/formats/morrowind/mwTextureClient.js`, one fewer than the cores, at most `TEXTURE_WORKERS_MAX` 4), idle
   workers closing after `TEXTURE_IDLE_MS`. With no Worker, or `?texturethread=off`, the same decoder runs on the main
   thread. The build logs `[mw] arm built in N ms` with stage timings.
6. **Early start**. The world's boot knows which save it will restore, so `src/combat/weapon/weaponRig.js`
   `prebuildArmsForSave` starts the build from that snapshot during the world's own loading. When the restore's
   `autoBuildArms` arrives, `armsStandFor` counts a build under way for the same race, sex, face and form as
   standing, so no second body is queued. A different identity queues the right body.
7. **Swap**. A change of equipment rebuilds the pieces from the same caches.

The face match (`matchFaceFor`) picks the playable head and hair nearest the classic portrait, decoding only mip level
0. Garment colour probes are measured in the pool, eight at a time, each garment once.

**Weapon shape.** The weapon picker keeps the item's own shape (dagger, tanto, longsword, katana, mace...) within the
available material pool, falling back as before when no match exists. `src/formats/morrowind/mwFirstPerson.js`
`dfWeaponShape` maps Daggerfall's names onto Morrowind's: Wakazashi to wakizashi, and the two axes cross (a Battle Axe
is Morrowind's war axe shape). First-person preload, both weapon views and the item icon all pass the shape.

## Rules

- Nothing from Morrowind is in the repo; it comes only from the player's attached files.
- The attached files are the switch; there is no separate pref.
- A player's loose copy of a path outranks every archive, and expansions and mods outrank `Morrowind.bsa`.
- Every synchronous archive read is covered by an earlier `load`; `findLoaded` names a read that outran its load.
- The item icon is a two-phase read on a lazy archive: the first ask starts a load and returns null (the classic sprite
  stands), then the pack repaints.
- All four hosts share the weapon rig; none has its own Morrowind geometry.

## Code and tests

- `src/scenes/dataSource.js` - the store, `storeMorrowindFiles`, `loadMorrowindArchives`, `loadMorrowindArmRecords`
- `src/formats/morrowind/mwBsaFile.js` - range-read archive with lazy entry loads
- `src/formats/morrowind/mwFirstPerson.js` - `extractArmRecords`, `dfWeaponShape`
- `src/formats/morrowind/mwTextureClient.js`, `src/formats/morrowind/mwTextureWorker.js` - the decode pool
- `src/combat/fpArm.js` - `buildFpArm`, texture preload, face match
- `src/combat/weapon/weaponRig.js` - `prebuildArmsForSave`, `autoBuildArms`, `armsStandFor`
- `test/formats/morrowind/mwload_fparm.test.js` - every synchronous archive read has its covering load
- `test/formats/morrowind/mwload_records.test.js` - the one-pass records and their kept envelope
- `test/formats/morrowind/mwtexthread.test.js` - the decode pool and its fallback
- `test/systems/mwearly.test.js` - the early build and the single body

## Open

- Load times are not measured on retail data here (the container has no Morrowind). The `[mw] arm built` line on a
  real set is the measurement.
- The third-person body is built with the arm, not on the first switch to third person.
- The weapon shape fix chooses meshes; authored grip transforms and scale are not adjusted.
