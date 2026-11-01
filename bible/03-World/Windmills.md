# Windmills

A port of Kamer's mod **Windmills of Daggerfall** v2.0 (Nexus 33), with permission. Windmills stand on farms, turn
with the wind, hum, change with climate and season, and can be entered: inside, the machinery turns. Classic Daggerfall
stands no windmill. The player meets them on farm blocks on the enhanced skin.

## How it works

- **Placement.** Seven farm blocks stand one mill each: FARMAA00, 01, 02, 05, 06, 07 and 09 (`PLACEMENTS` in
  `src/world/windmillMesh.js`, read by `src/world/rmbLayout.js` `windmillsFor`). Each placement stands two models: the
  mill (41600, Kamer's id) and classic building 118, which carries the door. A block served from world data (a town
  mod's farm) stands only the mills its own records place (`WINDMILL_MODEL_ID`).
- **Mesh.** `scripts/bakeWindmill.mjs` bakes the mod's Collada exports into `src/world/windmillMesh.js`, byte-identical
  on re-bake: the body, the blade, machinery 41601 and its two children (the gear and the roller). Handedness is
  converted at the bake (X negated, normals mirrored, winding reversed). Body materials come from the mod's prefab;
  the 17 climate and season variants differ in walls and roof (`CLIMATE_SKINS`, `SKIN_SLOTS`, `skinnedBody`).
- **The sails.** `src/world/windmills.js` turns the rotor about its local Z (`ROTOR_AXIS`, `ROTOR_SIGN` -1) at the hub
  `ROTOR_HUB`. The rate follows the wind (`rotorRate`): 13 deg/s on the wind model's fair day
  (`CALM_ROTOR_DEG_PER_SEC`, anchored to `WIND_ROW_FAIR`), still at the model's calm floor (`STALL_WIND`), furled at
  40 deg/s (`FURL_DEG_PER_SEC`). Each mill has its own phase (`rotorPhase`), keyed on position so the floating origin
  cannot re-seed it.
- **Sound.** Each mill loops the `ArenaFireDaemon` clip (`MILL_SOUND`), silenced indoors; inside, only the gear hums.
- **Inside.** `src/world/windmillInterior.js` holds the mod's interior subrecord; the context build mounts the
  machinery, which turns at the mod's constant 13 deg/s (`advanceMachinery`).
- **Hosts.** Both exterior hosts read `sky.wind()` once a frame, advance every mill and cull only the draw.

## Rules

- Vendored mods are ported 1:1 with permission (Mac).
- The wind-driven rate is kept, on the enhanced lane only (Mac). The stall, the furl and the per-mill phase are the
  port's own skin.
- Mills draw only on the enhanced skin and with the Windmills switch on (`src/systems/features.js` `WINDMILLS_KEY`,
  `windmillsOn`). A switch cannot put a departure on the classic lane.
- The 21 PNG exports of classic archives are never carried: the mill wears Daggerfall's own textures.
- The mod's Desert fall, spring and winter prefabs are not carried: DFU's `MeshReplacement.GetName` never asks for
  them.
- The interior's header counts are rewritten to the arrays' lengths (16 models, 11 flats, 0 doors).
- The mill's building is not a named building: the building walk is bounded by the block's declared subrecord count,
  so the mill's door gets no discovery, summary, hours lock or nameplate.
- Tamriel: placements are keyed by block name (`windmillsFor`), never by a place or a pixel.

## Daggerfall Unity

The mod's `Spin_Up` turns the sails at -13 deg/s always, and `SpinTime_Roller` the roller at +13 deg/s. The port keeps
the sign, the hub, the materials, the seven placements, the machinery and the sound. Departure: the sails' rate follows
the wind.

## Code and tests

- `src/world/windmills.js` - rotor, machinery, sound and the switch
- `src/world/windmillMesh.js` - the baked meshes, materials, skins and placements
- `src/world/windmillInterior.js` - the interior subrecord
- `scripts/bakeWindmill.mjs` - the bake; `tools/windmillProbe.mjs` dumps any classic model id
- `test/world/windmills.test.js`, `test/world/windmillmesh.test.js`, `test/world/windmillwiring.test.js`,
  `test/world/windmillsound.test.js`, `test/world/windmillmachinery.test.js` - the law, the bake, the hosts, the hum
  and the machinery
- `test/tooling/vendorIntegrity.test.js` - the vendored exports' hashes

## Open

- The mill is not on the automap, and townsfolk path through its footprint: the mod's edit lives in each block's
  `AutoMapData`, which the port does not carry. Painting the footprint into the grid is a design call for Mac.
- The vendored interior declares 44 models, 12 flats and 10 doors over arrays of 16, 11 and 0. It may be a truncated
  copy; only the enter marker leads back out. Re-extracting it from the original archive would settle it.
- `vendor/windmills-kamer/` has no upstream URL or licence file, only the README's provenance and the hashes.
