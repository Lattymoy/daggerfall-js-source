# The Elite Breach's Look

How the Fractured Battlespire looks (`Elite-Gates.md`). Every hall is a piece of the Battlemages' academy, torn off and
falling down the road Dagon's legions came: the academy's own floors underfoot, its foundations hanging under them, the
rest of it breaking apart around the company, other torn wings drifting in the haze, the sealed Spire overhead, and the
realm the halls have fallen into below. The look moves no law: floors, walls, colliders, clamps, telegraphs and lamp
counts are the hall spec's, and no relay or account version moves for it.

## How it works

**Five layers**, near to far, each its own module:

| Layer | What | Where |
|---|---|---|
| The ground | the law's floors, walls and vaults dressed as the academy: cornices for rims, inlay laid in the floor | `src/world/eliteGates/egHall.js` |
| The ruin | foundations under every floor, column rings and arches, statues, banners, the lamps' fixtures | `src/world/eliteGates/egRuin.js`, one `noShadow` mesh a hall |
| The wreck | torn wings 120-450 m out, turning slowly; the sealed Spire's underside overhead | `src/world/eliteGates/egVista.js`, `src/world/eliteGates/egUnderside.js` |
| The air | motes and lamp halos | `src/render/eliteGates/egMotes.js`, `src/render/superDungeon/sdHalo.js` |
| The sky | each band's realm painted into an octahedral map | `src/render/eliteGates/egSkyMap.js` |

**The bands.** Each band is one art direction through every layer: its ramps (`src/world/eliteGates/egBandArt.js`
`EG_BAND_RAMPS`), its kit's forms (`src/world/eliteGates/egKit.js` `EG_KIT_STYLE`), its skies (`EG_SKIES`,
`src/world/eliteGates/egLook.js`) and its air (`src/world/eliteGates/egAtmos.js` `EG_ATMOS`: fog, trilight, key, grade,
lamp tint).

| Band | Ground and ruin | Sky and air |
|---|---|---|
| The Broken Galleries | white marble, blue-and-gold inlay, fluted columns, Battlemage statues | the Deadlands' red sky and fire-sea; embers up, ash down |
| The Soul Cairn | slate-violet flags, bone, cairns, soul-gem lanterns | violet-black with soul-stars over a sea of mist; soul-motes |
| The Shade Perilous | black glass split by silver, glass thorns, moon-lamps | the Evergloam's huge low moon; silver moon-dust |
| The Havoc Wellhead | basalt bound in iron, Kyn pylons, fire baskets | a crater sky over a magma lake; sparks and ash |

A Brink hall wears the band above's dress at its start, the band below's at its end, and mixes them between; its sky
and air are the new band's. Each band's ambient is set from its stone's brightness so architecture never vanishes into
the void.

**The kit's records.** Each band paints the same records in its own archive (`EG_BAND_ARCHIVES`,
`src/world/eliteGates/pseudoArchives.js`): shafts, mouldings, voussoirs, reliefs, banners, coffers, statues, fixtures,
foundations, wreck stone, crystal, inlay and chain. The fixture's flame is the only emissive in the ruin.

**The lords, oversized** (`src/scenes/eliteGates/egFight.js`). Lords and champions stay Daggerfall's sprites, drawn at
their body's scale times `EG_LORD_PRESENCE` (a lord, a Valkynaz, a champion), so a Court's lord stands 8-14 m over the
company. The hit target's reach stays the relay's body radius; the drawn size is the client's alone and casts no shadow.
A felled lord falls at that size (`src/scenes/eliteGates/egLordFall.js`).

## Rules

- Go deep and true to the Fractured Battlespire, past the Abyss Dungeon's visuals, with no band aids (Mac).
- Bosses are oversized sprites, never models like the Abyss Dungeon's (Mac).
- The Abyss Dungeon's look laws hold (`Super-Dungeons-Look.md`): the void is dark, structure does not glow, light only
  where it means something (`Elite-Gates.md`'s five lights), every surface Daggerfall pixel art.
- No moving geometry in the ruin; the wreck's slow turn, far beyond any floor, is the one exception.
- Motes fade within 3 m of a floor's top, so telegraphs keep their floor.
- The ruin and the wreck are built off the main thread or once a band, never in a frame.
- Budgets in the hall the eye stands in: the ground at most 30,000 triangles a circle, the ruin 20,000 and 14 draws, the
  wreck 8,000 and 6 draws, the air 2 draws, the sky 1; GL draws a frame at or under the Hour's 82.

## Daggerfall Unity

DFU has no Elite Breach. The art is painted in code to Daggerfall's pixel-art law; the lords are Daggerfall's own
mobile sprites.

## Code and tests

- `src/world/eliteGates/` `egHall.js`, `egRuin.js`, `egVista.js`, `egAtmos.js`, `egBandArt.js`, `egKit.js`, `egLook.js` -
  the layers, the bands and their art
- `src/render/eliteGates/` `egSkyMap.js`, `egMotes.js` - the sky and the air
- `src/scenes/eliteGates/egFight.js`, `src/scenes/eliteGates/egLordFall.js` - the lords at their presence
- `test/world/eliteGates/eglook_atmos.test.js` - a band's shaded face still reads
- `spire.html`, `tools/spireLabProbe.mjs` - the lab: every band and view, `?law`, `?grey` and colour-blind filters
