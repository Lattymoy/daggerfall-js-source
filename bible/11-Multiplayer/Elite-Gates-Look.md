# The Fractured Battlespire: the Elite Breach's look, rebuilt (EG-LOOK)

STATUS (2026-10-15): the plan of EG-LOOK. Mac, having seen the halls: *"I am very very saddened that the detail is very
poor. The Abyss Dungeon went above and beyond with visuals. I really really want to go deep and make this something truely
different and immersive, and true to the fractured battlespire"*, then *"Literally everything, and no band aids. Dont
return until this is perfection. No exceptions. Bosses should also be oversized sprites. Not modeled like the abyss
dungeon"*. It lands inside PR #800. What shipped of it, piece by piece, is recorded in `Elite-Gates.md` section 31
(EG-LOOK) and that record wins where the two differ.

This page is to the Spire what `Super-Dungeons-Look.md` (SD-LOOK) is to the Hour, and it keeps SD-LOOK's laws: the void
is dark, structure does not glow, light appears only where it means something (`Elite-Gates.md` section 25.2's five
lights), every surface reads as Daggerfall pixel art (SD-LOOK's pixel law: painted in code through ramps, about 32
texels a metre, NEAREST, features 4-8 texels wide, every texel quantized). Nothing here touches the law: the hall spec
(`net/eliteGates/egLaw.js`), the collider (`world/eliteGates/egHall.js` `egCircleColliderTris`), the clamps and the relay are as they were, so
no relay or account version moves for the look.

## What was wrong (the lab, 2026-10-15, `spire.html`, before)

The Spire was the Hour's island kit in four colours. Measured on the built circles and seen in the lab:

- **Every band breathed the same air.** One fog (`EG_HALL_FOG`, brown exp 0.006), one trilight with an orange up-light,
  the Hour's grade, in all four. The bands differed only in their textures' hue.
- **Discs in a haze.** Plates and courts were the Hour's `realmIsland`: a 48-gon with the Hour's brass gear teeth on its
  rim (55-60% of a circle's triangles) and a 0.5 m lip. Nothing hung under them, nothing stood near them, nothing drifted
  past them. The Spire's underside model (`world/eliteGates/egUnderside.js`) drew only during the stair's fall.
- **Box halls.** Passages were axis-aligned slabs with a flat lid; the kits' dress 2-5 boxes; a chamber's ring wall 32
  one-sided quads; the end plate's door two posts and a lintel.
- **The Hour's motifs.** The span pieces wore the Steps' clock faces; the textures were the Hour's painters (flags, ashlar,
  rivets, cobble) in new ramps, at 64 px.
- **Empty air.** A gradient sky with a painted disc for the underside; mist only on two set pieces; no motes, no halos.
- **Detail only by chance.** The ten hero fragments were the only authored places, at most one a hall on a coin's toss.

## The idea

**Every hall is a piece of the Battlemages' academy, torn off and falling down the road the legions came.** You stand on
the academy's own floors - marble and inlay in the Galleries, the ossuary's slate in the Cairn, Nocturnal's black glass in
the Shade, the Kyn's basalt and iron in the Wellhead - with the academy's foundations hanging under them like a torn root.
Around you the rest of the academy is still breaking apart: colonnades standing out of the void, arches with nothing
behind them, statues of Battlemages on broken plinths, banners still hanging. Beyond them other torn wings drift in the
haze. Above, far up, the sealed Spire's underside hangs like a dark continent, smaller each band. Below, the realm the
halls have fallen into: the Deadlands' fire-sea, the Soul Cairn's sea of mist, the Evergloam's dark under its great
moon, the Havoc Wellhead's magma and its eruptions.

Five layers, near to far, each its own module and its own budget:

| layer | what | where it is built | drawn |
|---|---|---|---|
| **1 THE GROUND** | the law's floors, walls and vaults, dressed as the academy: cornices for rims, architecture for passages and chambers | `world/eliteGates/egHall.js` (the circle's mesh, as today) | the circle's one mesh, occluders as today |
| **2 THE RUIN** | everything that is the academy but not the law: the foundations hanging under every floor, column rings and arches round the courts and plates, statues, banners, the brazier-columns that carry the lamps, a stone bridge's arches under every way | `world/eliteGates/egRuin.js` (new, pure - built in the swap's worker with the circle) | one mesh a hall, `noShadow`, culled a hall at a time |
| **3 THE WRECK** | the torn wings drifting 120-450 m out from each hall; the sealed Spire overhead | `world/eliteGates/egVista.js` (new, pure) | one mesh a band (`noShadow`), placed about the hall the eye stands in |
| **4 THE AIR** | motes (embers, soul-motes, moon-dust, sparks and ash), the halos of the lamps and fixtures | `render/eliteGates/egMotes.js` (new), `render/superDungeon/sdHalo.js` (reused) | one draw each |
| **5 THE SKY** | each band's realm painted into an octahedral map: its horizon, its deep, its landmarks | `render/eliteGates/egSkyMap.js` (new, SD5b's law) | one triangle at the far plane |

The **air and light** (fog, trilight, key, grade, the lamps' tint) become a table a band (`world/eliteGates/egAtmos.js`), and the
**lords** are drawn oversized (section 9).

## 1. The bands

Each band is one art direction carried through every layer. The ramps are section 25.1's (`world/eliteGates/egBandArt.js`
`EG_BAND_RAMPS`); the forms below are the kit's (`world/eliteGates/egKit.js` `EG_KIT_STYLE`).

### 1.1 The Broken Galleries (circles 1-5) - the academy's upper halls, still over the Deadlands

- **Ground:** white marble flags veined grey, a running border of Battlemage-blue and gold inlay a metre in from every
  rim; the courts a great mosaic - the Battlemages' sigil (an eight-pointed star in a ring) in blue and gold on marble,
  quiet enough that the telegraphs own it; walkways in small blue-grey tesserae.
- **Rims:** a carved marble cornice under every edge (a fillet, an egg-and-dart moulding, a gold band, a cavetto down to
  the torn stone), never teeth.
- **Ruin:** fluted marble columns with gold-leaf capitals ringing the courts at the rim's distance plus 2.5 m, rising
  from the void below and broken at different heights, the tallest carrying an entablature fragment; bronze tripod
  braziers on the columns' tops carry the court's lamps; round arches standing alone beyond the plates; statues of robed
  Battlemages with staves raised on broken plinths; long blue banners with the gold star hanging from the entablatures;
  under every floor the academy's foundations - marble courses stepped inward like an inverted ziggurat, then rubble, then
  the Deadlands' red rock, then spires of it into the haze, with iron tie-rods and a hanging chandelier under the courts.
- **Wreck:** a domed rotunda broken in half; a bell tower leaning; a long arcade; a spiral stair hanging in the air; all
  marble, their undersides lit red from below.
- **Sky:** the Deadlands - a blood-red sky under a lid of ash cloud lit from beneath, the fire-sea below the horizon with
  its slow bright currents, volcano spires black against it, and the Spire's underside overhead.
- **Air:** embers rising from below, ash flakes drifting down.
- **Atmosphere:** fog the dark red of the Deadlands' ash, the up-light the fire-sea's orange, the key a pale cool white
  from above (the Spire's lost sky), lamps gold.

### 1.2 The Soul Cairn (circles 6-10) - the halls fallen into the Ideal Masters' realm of the dead

- **Ground:** slate-violet flags, bone inlay in their borders, soul-light hairlines in the joints of the courts (the
  band's own light, L2), the courts' mosaic a soul-gem's facets.
- **Rims:** a slate cornice with a row of carved skulls in its frieze.
- **Ruin:** the academy's columns wrapped in bone, their capitals skulls; black obelisks of stacked stones (the cairns)
  standing out of the mist round the courts; soul-gem lanterns hung on chains from iron gallows (the lamps); hooded
  mourners in stone; grey shrouds as banners, torn; under every floor the foundations giving way to packed bone, roots
  of black stone, and hanging cages with soul-gems.
- **Wreck:** floating tombs, a crypt's facade, giant soul-gem crystals in the mist, broken columns half-sunk in it.
- **Sky:** violet-black, thick with soul-stars (cold white and cyan points), a pale soul-aurora, and below, a sea of mist
  rolling in slow banded swells to the horizon.
- **Air:** soul-motes drifting slowly up; low mist sheets under every rim.
- **Atmosphere:** violet-grey fog a little denser, cold ambient, the up-light the mist's pale violet, lamps soul-light.

### 1.3 The Shade Perilous (circles 11-15) - the halls fallen into Nocturnal's dusk

- **Ground:** black glass flags split by moon-silver hairlines; the courts' mosaic a crescent in silver tracery.
- **Rims:** a faceted black-glass cornice, its arrises silver.
- **Ruin:** the academy's columns turned half to obsidian, their capitals crescents; thickets of black-glass thorns
  growing from below round the courts; tall silver moon-lamps on thin posts (the lamps - the band's "light only where
  braziers burn"); ravens in stone on broken plinths (Nocturnal's birds); black banners with a silver crescent; under every
  floor clusters of black-glass stalactites with silver veins.
- **Wreck:** towers wrapped in glass thorns, great shards of black glass turning slowly, a broken observatory.
- **Sky:** the Evergloam - near-black, a huge low moon with its craters and a cold halo, a scatter of stars, a thin silver
  aurora, and below, darkness with silver mist glinting in it.
- **Air:** moon-dust drifting down, silver.
- **Atmosphere:** near-black blue fog, a cold silver key from the moon's bearing, almost no ambient, lamps silver-white.

### 1.4 The Havoc Wellhead (circles 16 and on) - the muster-ground of 3E 398

- **Ground:** basalt flags bound in riveted iron, the courts' mosaic Dagon's war-sigil in iron and molten seams (the
  molten capped at L2 where it meets a fight floor).
- **Rims:** a heavy basalt cornice with iron straps and spikes pointing down.
- **Ruin:** the Kyn's fortification over the academy's bones: hexagonal basalt pillars, iron pylons with chains, iron fire
  baskets on spiked poles (the lamps), Dremora war-statues, red-and-black war banners; under every floor basalt prism
  clusters, iron girders bent through the rock, slag drips.
- **Wreck:** siege towers, a broken war-gate, floating basalt crags with forges glowing in them.
- **Sky:** the Wellhead's crater - a red-orange sky under heavy ash lit from below, eruption columns glowing on the
  horizon, the crater's basalt cliffs, the magma lake below with crust plates.
- **Air:** sparks rising thick, heavy ash falling.
- **Atmosphere:** dark smoky red fog, the densest, a hot orange up-light, a dim key, lamps molten.

### 1.5 The Brink halls

A Brink hall (circles 6, 11 and 16, slot 1 - `Elite-Gates.md` section 8.9) tears loose from one band into the next: its
first third wears the band above's dress, its last third the band below's, and the middle mixes them by the hall's own
seed, piece by piece (a column of the one beside a thorn of the other). The atmosphere and sky are the new band's.

## 2. THE GROUND (`world/eliteGates/egHall.js`)

The law's surfaces exactly where they are; only how they are dressed changes.

- **Rims:** `realmIsland` gains an option (`teeth: false`, the Hour's default unchanged) and the Spire's discs lose the
  gear teeth. The cornice (section 3.2) is THE RUIN's.
- **Passages** (`caveModel`): each wall run becomes the academy's wall, displaced OUTWARD only from the collider's plane
  (`Elite-Gates.md` section 11.6): a plinth course, pilasters every 3 m standing 0.3 m proud, round-arched windows between
  them opening onto the void (the window's reveal 0.6 m deep - the wall's thickness), a string course and a cornice; the
  vault a barrel of voussoir ribs over the pilasters with coffers between, broken open to the sky in one or two bays a
  passage. The kits keep their own forms (the Caverns' basalt walls displaced by noise, the Stacks' bookcases, the
  Colonnade's drums, the Ossuary's ribs, the Mist Stair's pit, the Thicket's trunks, the Forge's pipes), each rebuilt with
  the mesh kit rather than boxes.
- **Chambers** (`decoModel`): a ring wall becomes an arcade - pilasters, arches, a parapet - outward of its collider ring,
  open at the course's gaps; tiers become stepped stone benches; a hall's long walls the academy's wall above.
- **The door** (`plateModel` end): a real doorway - two pilasters on plinths, a round arch of voussoirs with a keystone
  carrying the band's sigil, the door's gold beam inside it as today.
- **The arrival plate**: the gold ring inset as today, inside a compass of inlay pointing down the course.
- **Vignettes**: rebuilt with the kit at the same footprints (the barricade of lecterns, the broken staves, the Kyn
  shrine, the fallen shelf, the rack).
- Every new drawn piece outside the floors is marked as an occluder (EG-ZN's law - the camera dithers it); nothing new
  rises unmarked on a floor; no vertex inside the collider's proxy.

## 3. THE RUIN (`world/eliteGates/egRuin.js`, new, pure)

`buildEgRuinParts(seed, c, geo, { lite })` answers one `{ h, model, sphere }` a hall of the circle: a mesh of
everything the academy is that the law is not. Built in the swap's worker beside the circle (`world/eliteGates/egCircleParts.js`
`egCircleBuild` carries `ruins`), on the main thread for the first stand, byte for byte the same. **None of it is a
collider; all of it stands outside every floor's footprint in plan, or below every floor's top** (no visual larger than
the law), and nothing of it pokes through another floor of the hall (a test against every disc, band, lane and ramp).

### 3.1 The foundations (under every floor)

- Under every disc: the floor's slab (0.6 m), then the academy's foundations as an inverted stepped mass - each course
  set in by its band's step, its strata by depth in the foundation record (EG_KIT `found`), giving way to the band's deep
  stone and breaking into 3-6 spires (the Hour's `islandRoot` law - `sdIslandModel.js` `hangPlan`, driven with the band's
  shape: SD_SPIRE's numbers a band), and the band's hanging things: the Galleries' chandeliers on iron rods under the
  courts, the Cairn's soul-gem cages, the Shade's glass stalactites, the Wellhead's chains and girders.
- Under every band and lane: a stone bridge - an arch of voussoirs every 6-8 m springing from piers that fall into the
  void, the spandrels filled - so every way reads as a bridge of the academy, not a plank.
- The tops of all of it at or under the floor's lip (`SD_LIP`), inside its disc or band in plan.

### 3.2 The cornices

Under every edge of every disc, band and lane: the band's cornice profile (section 1) swept along the rim, its top 0.02 m
under the edge line's strip, outside the floor by at most 0.35 m (the Hour's teeth's reach). It never stands above the
floor, so it never lies about where the floor ends.

### 3.3 The column rings and the brazier-columns

- Round every court and isle: columns on a ring at the rim plus 2.5 m, one each 6-9 m of arc, never within 4 m of a way
  onto the disc (the ways' ends: `net/eliteGates/egLaw.js` `egMoltenRim`'s `ends`, the passages' mouths, the ring walls' gaps),
  rising from 20-40 m below to heights the seed draws (broken drums at their tops; one in three whole, carrying an
  entablature fragment to its neighbour).
- **The lamps move onto them.** `egCircleLights` stands each court's and plate's lamps on a column of its ring, at the
  column's top (the floor plus 2.6-3.4 m), so a lamp is a fixture you see - a brazier, a soul-gem lantern, a moon-lamp, a
  fire basket - and never a light in the air over the floor. The lamps' budget (`EG_LAMP_BUDGET`) is unchanged.
- Round the plates: two arches standing out of the void beyond the plate's sides, framing the way on.

### 3.4 Statues, banners, the place's things

- Statues (the band's figure) on broken plinths on the column rings, one or two a court, facing in; banners from the
  entablatures; the Cairn's obelisks and the Shade's thorns among the columns; the Wellhead's pylons and chains.
- Nothing of it is a foe and nothing moves (the banners hang still: a still banner is the frozen moment the Spire tore).

### 3.5 Lite (phones)

One spire a foundation, columns every 12 m, no statues or banners, bridges' arches every 12 m.

### 3.6 Cost

At most 20,000 triangles a hall and 14 records (14 draws) for the hall the eye stands in; the other halls culled by
sphere (they stand 500 m apart). Built in the worker in under 40 ms a circle.

## 4. THE WRECK (`world/eliteGates/egVista.js`, new, pure)

- A band's set of torn wings (section 1's), each a low-poly model (200-1,500 triangles), placed on a ring 120-450 m
  from each hall's centre, 30-160 m above or below its floors, never inside the cone from any floor to the door or the
  Court's lord, turning slowly about its own axis (a turn a few minutes), drawn `noShadow` with the hall's fog
  (they melt into the haze with distance - that is the depth).
- **The sealed Spire overhead**: `world/eliteGates/egUnderside.js`'s model, stood in the hall at the band's angular size
  (`EG_SKIES` `underside`), scaled so it stands inside the far plane, its rim's light the band's deep. The sky's painted
  disc goes (one underside, never two).
- One mesh a band (its wings) plus the underside, made once a band (when the band's dress goes up), freed with it.
- Lite: four wings, no turning. Cost: at most 8,000 triangles and 6 draws.

## 5. THE AIR

- **`render/eliteGates/egMotes.js`** (new, SD14c's motion law made a generator of a layout and its colours): a band's motes about
  the hall the eye stands in (the hall's centre handed each frame): the Galleries' embers rising and ash falling, the
  Cairn's soul-motes rising slow, the Shade's moon-dust falling, the Wellhead's sparks and ash; 600-1,000 points, one
  draw, additive, depth-tested, fogged, the band's own colours under L2 except the embers' and sparks' hottest (L3,
  small). Nothing over a fight floor's telegraphs: the motes fade within 3 m of a floor's top (the telegraphs keep their
  floor - section 25.6). THE QUIET COMPANY does not touch them (they are the place, not a player's).
- **Halos** (`render/superDungeon/sdHalo.js`, reused): every lamp's fixture and the door's beam's foot, at most 48 a frame, the
  classic set's bloom.
- **The Cairn's mist sheets**: the band's mist under every rim, below the cornice's foot (EgMistPass's sheet, held still).

## 6. THE SKY (`render/eliteGates/egSkyMap.js`, new)

SD5b's law: a 512 x 512 octahedral map painted a quadrant a frame by a band's painter (its own fragment shader, every
texel through `SD_PIXEL_GLSL`), fetched by one triangle at the far plane with the band's gain against its fog. Each band's
painter: its void in dithered bands, its realm's deep (the fire-sea's currents, the mist's swells, the Evergloam's dark,
the magma lake's crust) below the horizon meeting the fog's colour, its landmarks (volcano spires, the ash lid lit from
below; soul-stars and the aurora; the moon with its craters and halo; the eruption columns and the crater's cliffs), its
stars. Live over the map: only slow drifts (the ash, the aurora, the currents) on whole cycles of a period, so the sky
never jumps. The Spire's underside is the wreck's model (section 4), not painted.

## 7. THE ATMOSPHERE (`world/eliteGates/egAtmos.js`, new, pure)

A table a band: `fog` (mode, density, colour), `trilight` (sky, equator, ground), `key` (direction, colour, scale), the
lane's `grade` (`setSceneGrade` - adaptKey, adaptMax, bloom, vignette, contrast), the lamps' tint, the motes' and the
sky's colours. `EG_HALL_FOG` and `egHallLighting` answer the band's (the circle's band handed in); the dungeon arm's two
lines that read them (`scenes/worldModes.js`) read them by band, the host's line count unchanged. Telegraphs, edge lines
and white hazards keep their fog floor (section 25.6) under every band's fog.

| band | fog (exp) | up-light | key | lamps |
|---|---|---|---|---|
| Galleries | 0.0050, `[0.16, 0.05, 0.03]` | the fire-sea's orange, strong | pale cool white from above | gold |
| Cairn | 0.0075, `[0.10, 0.09, 0.14]` | the mist's violet-grey | cold, dim | soul-light |
| Shade | 0.0060, `[0.022, 0.026, 0.044]` | almost none | the moon's silver, from its bearing | silver-white |
| Wellhead | 0.0090, `[0.14, 0.05, 0.02]` | molten orange, strongest | dim, smoky | molten |

THE SHADED FACE READS (the lab, 2026-10-16): under the lane the trilight reaches a face at a third of its value
(`EL_DUNGEON_AMBIENT_SCALE`) and the eye opens at most to the grade's `adaptMax`, so the first air left the Shade's black
glass and the Wellhead's basalt black wherever the key did not fall - the architecture vanished into the void. Each band's
ambient is set from its stone's own brightness (the three dark bands' stone lifted a step - `Elite-Gates.md` section
25.1), its eye let open wider (the Cairn 1.45, the Shade 2.0, the Wellhead 1.6; the Galleries the Hour's 1.15), and the
law pinned: a face of a band's middle stone turned from its key, lit by the equator alone at the eye's widest, reads over
0.012 linear (`test/world/eliteGates/eglook_atmos.test.js`).

## 8. THE KIT'S RECORDS (`world/eliteGates/egBandArt.js`, `world/eliteGates/egKit.js`)

Each band paints the same records in its own archive (`EG_BAND_ARCHIVES`), so every builder names a record and the band's
dress picks the picture. The records the ground wears today (`EG_DRESS`: floor 0, metal 1, root 2, arena 4, walk 31, edge
32, molten 33, wall 56) are repainted as the academy's (section 1), and the kit adds:

| record | name | what |
|---|---|---|
| 60 | `shaft` | a column's shaft, its fluting (or bone wrap, facets, hex faces) running v, 2 m a repeat |
| 61 | `moulding` | the cornice's and the capitals' profile, across v: fillet, egg-and-dart or skulls or facets or straps, the band's metal band |
| 62 | `voussoir` | an arch's and a vault rib's blocks, radial joints |
| 63 | `relief` | a frieze panel: Battlemages in procession, a row of skulls, thorn tracery, Kyn war-reliefs |
| 64 | `banner` | cloth with the band's sigil, its tattered edge a cutout |
| 65 | `coffer` | a vault's coffers, the undersides of entablatures |
| 66 | `statue` | weathered stone for the figures, their folds painted |
| 67 | `fixture` | the lamp's fixture: bronze, iron, bone or silver, its flame the band's light (the only emissive in the ruin) |
| 68 | `found` | the foundations' strata, top to tip: courses, rubble, the band's deep stone, the haze |
| 69 | `wreck` | the far wings' stone: the band's stone a step darker, its windows dark |
| 70 | `crystal` | soul-gem (the Cairn's own light), black glass, basalt prisms |
| 71 | `inlay` | the courts' sigil mosaics and the rims' borders: tesserae in the band's accent and metal, laid IN the floor (the floor's own top cut into regions - never a decal over it) |
| 81 | `chain` | the band's metal in links (the Hour's record 81, the band's own) |

## 9. THE LORDS, OVERSIZED (`scenes/eliteGates/egFight.js`)

The lords and champions stay Daggerfall's own sprites (never a model - Mac). Each is drawn at its PRESENCE: its body's
scale (`EG_LORDS` - the relay's `bodyR` and the client's hit target, both unchanged) times `EG_LORD_PRESENCE` (1.6 a lord,
1.8 a Valkynaz, 1.4 a champion, the twins and the mirrors theirs), so a Court's lord stands 8-14 m tall over the company.
The sprite's feet stay on its body's place; its hit target's reach (its radius - the relay's `bodyR`) stays the body's and its height is the drawn sprite's (the relay judges no height: a bolt at the head you see meets him); its shadow is off (OW-BIG's law - a giant's
billboard casts nothing); a flying lord's hover rises with its height so its feet clear the company's heads. The drawn
size is the client's alone: nothing on the wire moves. A felled lord falls at that size (EG-FALL,
`scenes/eliteGates/egLordFall.js` - `Elite-Gates.md` EG-FALL): the gate's fall, its sink and its corpse grown by its drawn
size over the Warden's.

## 10. Budgets (the hall the eye stands in, desktop lane)

| part | triangles | draws |
|---|---|---|
| THE GROUND (today's mesh, rebuilt) | at most 30,000 a circle | its records (8-10) |
| THE RUIN | at most 20,000 | at most 14 |
| THE WRECK and the Spire overhead | at most 8,000 | at most 6 |
| THE AIR | 1,000 points, 48 halos | 2 |
| THE SKY | 1 triangle | 1 |

GL draws a frame stay at or under the Hour's 82 (`Elite-Gates.md` section 11.9 - measured mean 25.5 today). Lights are
unchanged (the lamps' budget). Textures: the thirteen kit records a band at 64 px (128 under Vanilla Enhanced), about
200 KB a band. The ruin and the wreck are built off the main thread or once a band, never in a frame.

## 11. The lab (`spire.html`, `tools/spireLabProbe.mjs`)

Every piece is judged in the lab before it is called built, every band, both lanes:

- views `plate`, `course`, `court`, `over`, `sky`, and new `under` (from a span, looking at a floor's foundations), `wide`
  (the wreck and the Spire overhead), `lord` (a Court's lord at its presence);
- `?law` draws the law's floors and walls as wire over the frame: no ruin stands inside them;
- `?grey` and the CVD filters: the five lights still told apart, the telegraphs still the brightest thing on a fight floor;
- the sheets before and after, every band, every view, kept with the record.

## 12. What it does not do, said so

- No model for a lord or a foe (Mac: sprites).
- No moving geometry in the ruin (banners still, chains still): motion is danger (SD-LOOK's motion law), and the wreck's
  slow turning is the one exception, far beyond any floor.
- No change to any floor, wall, collider, clamp, telegraph or lamp count. A player stands, fights and falls where they did.
