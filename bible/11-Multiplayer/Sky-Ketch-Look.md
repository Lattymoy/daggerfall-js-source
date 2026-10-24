# The Sky-Ketch, polished: her look, her sound and her presence (KETCH-LOOK)

STATUS (2026-10-24): the plan of KETCH-LOOK, the polish phase the owner asked for once AUDIT KETCH closed. Four directors
proposed (A, cinematic, "The Brass Whale"; B, Daggerfall-faithful; C, systems; D, sound and presence), the lead ruled
how the four combine, and the owner ruled four calls the same day (The owner's calls, below). It is a PLAN: what ships
of it, and how, is recorded slice by slice in `Sky-Ketch.md` section 16 (KETCH-LOOK, a new section the first slice opens), and that record wins where the two
differ. Every cite names a file and a symbol at the tree the directors read (`b5f286182`); the numbers marked *measured*
were taken from the lab's frames of that tree (`ketch.html`, every view at noon, dusk and night) and the live run's.

The owner, 2026-10-24: *"After this audit is done and finalized, the goal is going to be to do a deep polish ohase of
every element, like weve done in the past with other world events, enhancing the ambience, the detail and everything to
be a AAA experience. This even needs to surpass what weve done with the abyss dungeon"*.

This page is to the Ketch what `Super-Dungeons-Look.md` (SD-LOOK) is to the Hour and `Elite-Gates-Look.md` (EG-LOOK) to
the Spire, and it keeps their laws: structure does not glow, light appears only where it means something, every surface
reads as Daggerfall pixel art, nothing blinks faster than `TELEGRAPH_THROB_MAX_HZ` (3 Hz), and the telegraphs keep their
pinned shapes, colours and grains (`render/gate/gateTelegraph.js` `TELEGRAPH_STYLE`). It goes past them in four ways
the Hour never had to: she is seen and heard by the whole city; her palette is Daggerfall's own index space; one pure law
holds every state the eye, the ear and the HUD read; and her score keeps the law's own clock.

**What does not move.** No number the relay judges, no collider a body stands on, no blow's shape, no timing. The ship's
collider stays byte-equal (`world/ketch/ketchModel.js` `ketchColliderOf(buildKetchShip())`, and every part's `hit`, pinned
equal to today's). No relay version moves and no file the relay bundles changes: walking `server/src/index.js`'s imports
reaches eight Ketch files - `net/ketch/ketchBrain.js`, `ketchConstructs.js`, `ketchDeck.js`, `ketchHerald.js`,
`ketchJudge.js`, `ketchLaw.js`, `ketchReceipt.js`, `ketchWarden.js` - and this plan changes none of them. The two
page-side files under `net/ketch/` (`ketchLink.js`, `ketchClaims.js`) are outside the relay's bundle, and this plan
changes neither: A asked the link to keep the stage turn's moment for the engine's waking, and it already does - the
link's state carries it as `sga`, folded from the room's `sg` word and from its hello (`ketchLink.js` `KT_EMPTY`, the `sg`
case). The one relay ask any director made (the herald's portrait or fall card) is the owner's call 5, off.

**Daggerfall Unity is the reference** where the Ketch touches the world - the exterior night ambient floor
(`PlayerAmbientLight.ExteriorNightAmbientLight` 0.25, `world/worldClock.js` `EXTERIOR_NIGHT_AMBIENT`), the sky, the
weather (`WeatherManager`), the song player (`DaggerfallSongPlayer`, `systems/song/songPlayer.js`), DAGGER.SND
(`SoundClips.cs`, `systems/soundClips.js`), the dye (`ImageProcessing.ChangeDye`, `characters/dyes.js`), the sprite's
record layout (five facings mirrored to eight) and the exterior automap's block grid (`ExteriorAutomap`, the RMB's
`autoMapData`). Everything else departs from DFU, because Daggerfall has no airship, no raid and no score that follows a
fight; it sits in Ledger A, KETCH, as the arc already does, and each slice names its departures.

| Element | Built on | Grafted from the others | Left out, and why |
|---|---|---|---|
| 1. Her coming and going | D (she is heard before she is seen: the keel's hum, her horn, the watch bells, the city's peal, the chain, the beacon at night, the ring that follows her) | A: the whale-shape far picture past the haze, the dusk glint, her departure over the rooftops. B: the lamp ladder on a chain of real links, the running lights. C: the map's ring as her station's gauge. A and C: her shadow by the world's own law (owner: yes) | The compass mark at the lift (D): a new key in `bootWorld`'s compass object is a logical line in a host with none to spare. A bob or sway at station (A, B): her collider stands while she keeps station. Rotating fans (B, C): a fan turned about its spar sweeps through the main top and the jackstay (A). The sighting sting beyond her lift (D): the owner's ruling 2. The herald's portrait or fall card (A, B, D): a relay version, the owner's call 5 |
| 2. The ride up and the arrival | B (a 3 s lift-off in the world and an arrival cage) - the owner's ruling 1 | A: her cloud and the city falling away, carried inside the step's veil. C: the veil's program and the way down reversed. D: the chain heard, the music held through the step, the voyage's card. A: the tutorial page held past the first look | A's 12 s ride through the world: the owner's ruling 1. B's veil as a plain dither: the cloud passage fills the same time |
| 3. Her body whole | A's lifting body (the whale: curved belly, rorqual grooves, sweeping keel, breathing stacks, feathering vanes, port shutters) in B's metal and grain | B: the ornament kit (the ram, the hawse discs, the script band, fin crests, Dwemer lanterns), the engine house in Dwemer stone. C: the rigging drawn as lines that never thin under 1.5 px, the ports' day glass. One breath for all of it (Motion) | Pennants (A, C): no cloth - the Dwemer built in metal (B); brass-leaf vanes carry the wind. A's blued-steel ramp and C's tonal brass: one metal, B's. Lit hawse discs: nothing organic (A) |
| 4. The open decks | B (plates in courses, rigging not a fence, lanterns on chains, Dwemer capstans, the quarter wall's façade) | C: the ship's board (the tracker in brass) on the quarter wall, the furniture inside the bulwarks, the way-on lamp. B and C: the spheres' cradles and drop-lines. B: the Sentries' iris hatches. D: "all hands" on the bell | Anything on the walkable floor (`net/ketch/ketchConstructs.js` `KT_OBSTACLES` is the law's). A's separate Watch lanterns: the board's three Watch lamps are the one count. C's lift-plates for the Sentries: a plate sinking under a body is hidden by the body it carries, where an iris opening round its spot reads from across the deck 1.2 s before the rise, and is the Dwemer's own round door |
| 5. Below decks | B (light where it means something: lamps over the lanes and down the hold; the drop-hammers and their counterweight wheels; the coherer spheres) and C (the hammers merged, the port shafts, the arc pass, the vents' breath predicted, the housing dials) | A: steam as walls of dithered steam, the Wardens asleep. D: every hazard heard on the law's clock, the rooms' reverb, the Gallery's song locked to the hammers | B's steam in the halo pass: one steam law for all steam (A). B's arcs kept at 16.7 Hz as "motion": the flash law (slice KL0) |
| 6. The cells and the engine waking | C (the cradle a charger with a sight-glass; fills; the engine's band ring and eye; the state law) | A: the waking's timeline (aether up the pipes, the lamps stepping up, the tower's chase, the ship-wide beat). B: the carry in view, in both hands; one dip and one surge of the lamps. D: each cell gives the engine back one partial; KETCHWAK, five catching six | C's carried cell drawn in the world below the eye: B's view-space carry reads first-person. A's "each cell plays the next note" as a sting: the partial joining the engine's hum is the one law |
| 7. The mast-lift, the top, the yard | C (the lift's dials and gate lamps, the counterweight, the head sheave, the dead cage's lamp out, the cage casting nothing) | B: lit ports every 4 m up the tower. A: the tower's chase at the waking, the view out of the shaft. D: the chain's run and the wind rising with the cage | A's slit windows: one ports record (B) |
| 8. The Sailwalk | B's dress (spars on blocks along the jackstay, tonal plates that ring, a ratline riser, gratings that are mended, torn net-strips, the catch-net) | A: the net's billow, the chunks falling the whole way, lanterns on the tops. C: the haul burst, the line drawn at 1.5 px. D: the Ketch's sounds in place of the Hour's, KETCHSAL locked to the Beat | A's louvres and C's edge-on blades: a plate tilted or opened while the law still holds it flat is a visual larger than the law. The Hour's clock-hands, waystones and vane: the Hour's meaning, not a ship's |
| 9. The bridge | C (`ktBridgeGlow`: burning seams, ghosts with needles, spokes to the resonators, the Discord's mark, the end in red; the helm's board) | B: a steel floor and the Keel-Note's sigil inlaid; resonators of a 2.4 m crystal in a brass cage. A: the pipe-forks as the Keel-Song's clock, the wheel spun free, the lodestone turning to the city. B: the sections winched home on their chains, the armillary | C's twelve floor rays: the pipe-forks are the count. C's TONAL light (see Light). A's sections hanging under the rim: those over her stern would hang through her hull; the ghost and its needle carry the read |
| 10. The Tonal Warden | B (a model in code baked into an oversized Daggerfall-layout sprite - five facings mirrored to eight and a tell layer, committed and gated byte for byte, the owner's ruling 4; until it lands, the Iron Atronach dyed Dwarven) | C: the crown of floating tines that carries its state, the ward's four plates, its mark, the Tonal Wave as a wall. D: its voice tuned to the keel, the Keel-Song sung, the Discord heard. A: moments 7-10 | A's model on the Remnant's rig: the owner, for the Spire: "Bosses should also be oversized sprites. Not modeled like the abyss" (`Elite-Gates-Look.md`). The runtime bake: the owner's ruling 4. A's ward shell: the plates show which resonator is false and a 7 m shell would hide the tells |
| 11. The constructs | B (the sprites recoloured by ramp, the Dwarven Spider baked, hatches that iris, corpses) | C: drop-lines, aim lines, marks under the Wardens and the Captain, the spheres' vapour where a row has no corpse. A: the Wardens' and the Captain's presence (EG-LOOK section 9's law). D: their voices | Bodies rising through solid deck and sinking through it (today's `ktBodyAct` lift) |
| 12. The blows and hazards seen | C (`ketchFx`, `ketchRead`; every blow told by its source, its floor and its sound) | D: the shakes, the landing flashes under 2.5 Hz, the wave heard arriving. A and B: every landing seen | The read's way out over the Gallery's hazards (A, D): the owner's call 6, default off (C) |
| 13. The cabin and the reward | A (a Rourken captain's cabin: stern windows, the empty Ketchmaster, the chest's lid, a gun on its cradle) | B: the puzzle-chest's three rings (yours), the stern gallery showing the real sky, the chart table and her course on it. C: the lamps lit from the door inward, the lock burning when a share waits. D: the spill up her scale, KETCHGLD's one D major, the Gilded card | Telling the crew of a Gilded (A): the spoils are each player's own seed and never sent (`scenes/spoilsPool.js`). B's chart painted from the player's own map: the chart is the port's own engraving of the Bay (A), the same with no data, and engraved brass where a resampled map would be a picture in a frame |
| 14. Sky, light and air | B's hour table and zone grades, C's trilight and the land from the world's data | A: the city in relief from its blocks' `autoMapData`, windows lit at night, the cloud deck, she comes about. B: the anchor's slow swing. C: lit clouds, the passing banks. D: the motes on the Spire's generator. A and B: rain and snow on her decks | B's capture of the world at boarding: admitted only if strictly better than the data, and it is not - see 14. Volumetric clouds at her height: the lane's frame (A, B, C) |
| 15. Sound | D (the keel's overtone series on A, 55 Hz; six, five, five catching six, seven; seventeen songs; the law of where; the clock lock; the live detune) | B: the beds made from DAGGER.SND, the plates ringing partials. A, B, C, D: the Gallery's bar on the hammers' 3.0 s, each cell or resonator set restoring a voice. C: every machine's wind-up heard before its landing | B's F Lydian, A's B-flat and C's D Lydian (D's A is the one source of pitch). B's written channel bends (the live detune is the one mechanism). The sighting sting KETCHSGT (the owner's ruling 2) |
| 16. The words and the HUD | C (the tracker in the ship's gauges; the beats on a title card; the crew card) | B: the six stage studs. D: the beats' words, the voyage's number, the banner at the lift, the taverns' rumours, the Timers' line. A: "She wakes", "Silenced" | New words past the few the moments need |
| 17. The lab | C (state knobs, `?bill`, `?grey`, `ketchLabProbe.mjs` with the value, contrast, flash and shadow probes) | A: the world-side views and a sky. B: the ladder probe, the palette test, `?lite`. D: `?score`, `?ear`, `?voice`, `?bells` and the sound probes | - |

---

## The owner's calls

Four were ruled on 2026-10-24 and are built on below; two stand open, each a switch with a default.

| # | Call | Ruled / default | The alternative | What each costs |
|---|---|---|---|---|
| 1 | **The ride up** | **RULED: about 3 s, the cloud inside** - B's lift-off (`KT_LIFTOFF_MS` 3000: the cage lifts 14 m with the body in it, the fields falling away under its grating) and B's arrival cage (1.6 s), with A's passage through her cloud and the city falling away carried inside the step's veil, which covers the mode change that already takes its time | A's 12 s ride through the world before the ship loads - **left out by the owner's ruling** | The ruling: 3.35 s more on the boarder's own screen (3 s lift-off, 0.35 s to close the veil); the veil's program runs while the level builds (~230k fragments at 1080p). The relay sees none of it. The alternative would have cost 12 s at every boarding and every re-boarding after a fall, and a world streamed 150-260 m up |
| 2 | **Her music beyond the ship** | **RULED: yes, near her lift on the fields and as she leaves only; everywhere else the region's music as now** - KETCHSKY outdoors within `KT_SCORE_LIFT_M` (450 m) of the lift's foot while she keeps station; KETCHDEP outdoors within `KT_SCORE_DEPART_M` (2,500 m) of her while she weighs anchor | (none past the ruling) | Two songs registered on the first time she is near; the regional director yields only inside those two reaches. The sighting sting (D's KETCHSGT) is left out by the ruling; her horn at first sight is a sound, not music, and stays |
| 3 | **Her shadow over Daggerfall's east quarter** | **RULED: yes, soft, by the world's own shadow law** - her silhouette an occluder in the cloud-shadow field's march (`render/volumetricClouds.js` `SHADOW_FS`), so the one number that dims the ground, a body and the air's sun shafts (`render/cloudShadow.js` `cloudShadowAt`) dims them under her | - | Lane only, where the world draws its cloud shadow: one 256x64 R8 silhouette and one ray-plane test a marched texel. At 25.6 m a texel (12.8 m at the high tier) it is soft by the field's own grain. Each morning it lies across the east quarter inside the wall (sun at 30 degrees: 450 m west of her middle; the wall stands about 410 m from the centre, she 700 m) - every player there stands in it. The classic set has no shadow field and draws none |
| 4 | **The Warden's sheets** | **RULED: COMMITTED (~2 MB)**, written by `bakeKetchSprites.mjs` (deterministic) and gated byte for byte as the Thunderlock's bake is (`tools/bakeThunderlock.mjs`, `test/formats/morrowind/fieldgunmw.test.js`): the gate regenerates every frame from the model in code and compares | The runtime bake on idle frames - **left out by the owner's ruling** | About 2 MB in the repository and the download (body and tell sheets; the Spider's about 150 KB); nothing baked on a player's machine. **Doctrine, checked**: Port-Doctrine's "A RENDER OF GAME DATA IS GAME DATA" asks whether a picture's pixels came from ARENA2. These do not: each pixel is an ART_PAL *index* (a number, as `characters/dyes.js` `METAL_TABLES` is code) chosen from the Ketch's own paint over a model built in code; the bake reads no game file and resolves nothing through a palette. The file is an 8-bit greyscale PNG (colour type 0) whose grey value is the index - no PLTE, no colour - written by a new `tools/pngIO.mjs` `writeIndexGreyPng` (the existing `writeIndexedPng` writes a PLTE of a picture's own colours and is not used). The page reads the indices and resolves them through the player's own `ART_PAL.COL` at load (`formats/dfPalette.js`, as every TEXTURE record is), the lab through the Ketch's own fallback colours. Each committed file takes an "OURS" row in `test/tooling/doctrine.test.js` (the Pistolet's and the Thunderlock's precedent), and its gate also fails a sheet that carries a PLTE chunk |
| 5 | **The herald's portrait, or its fall card** (A, B, D) | **Open - default OFF** (no relay version) | A thumbnail of her on the sighted card (A, B), or D's fourth card "the helm taken" (the first crew's names and time) with a count on the departing card | Off: nothing. On: a relay version (the hub's `_ktHeraldBeat` and its stored state; `net/ketch/ketchHerald.js` and `net/herald/heraldCard.js` ride the relay's bundle), shipped only beside a relay version that ships anyway |
| 6 | **The read's way out over the Gallery's hazards** (A, D) | **Open - default OFF**: the ground read (element 12) names and points the way out of the Warden's and the constructs' blows and the Tonal Wave; the hammers, the steam and the arcs keep their telegraphs, their sound and their source's tell, and no arrow | A's and D's read over the hazards too ("Hammer - step out!" with the arrow to the nearest clear lane) | Off: the Gallery stays a timing the crew learns (the law's "one lane of every row stands clear two seconds in three"). On: the same read at no further cost; it names the clear lane and eases the stage, as SD-LOOK's safe wedges would have eased the Remnant |

---

## The language

### The idea

**The Mzunthar is a brass whale asleep in Daggerfall's sky, and the raid wakes her.** The game already says it - her
sighting line is *"A shape like a brass whale hangs in the east sky over Daggerfall. The Ketch is coming."*
(`systems/ketch/ketchWords.js` `KT_WORDS.sighted`) - and nothing on screen shows it: today she is a long box with two
pinwheels (`side`, `bow`, `below`). She is a 240 m Rourken lifting body cast in Daggerfall's own Dwarven metal, her belly
grooved like a rorqual's, her vanes folded like fins, and she is an instrument: everything aboard sounds one chord, the
overtones of her keel's low A, and everything tells you whether that chord is whole. The crew carries light into her
starving heart and she **wakes**; at her helm the thing that steers her **sings**, its song is the fight, and the crew
puts it in tune by hand. Every piece shows its state on the piece itself - a sight-glass, a needle, a plume, a lamp - from
across the ship, and the ship's state from across the city.

### Her three states

One pure law (`world/ketch/ketchStates.js` `ketchStatesOf`, The shared kit) answers which she is in, and every pass,
sound, song and HUD line reads that answer.

| State | When (the law as it stands) | The ship shows | From the street | She sounds |
|---|---|---|---|---|
| **ASLEEP** | On a crew's ship, from the hello until the engine is fed (`sg` before `KT_STAGE.sailwalk`). In the world, always while she keeps station: the street sees one ship and every crew boards its own (`11-Multiplayer/Instances.md`) | Dark brass; the vanes feathered edge-on (70 degrees); the ports' shutters half shut; one slow breath of steam from her two stacks every 12.5 s; the hold's lamps at 40%; the engine coughing in five | A dark shape over the fields, one breath at a time; by night her lamps and her keel-light; the anchor-lift's beacon while she boards | The keel's hollow fifth (A1, A2, E3); the engine missing its sixth stroke; KETCHENG in five below |
| **AWAKE** | On a crew's ship from the engine's waking (`sga` once `sg` reaches the Sailwalk) until the Warden wakes (`ws.op`), and again after its fall. In the world, from the moment she weighs anchor | The vanes biting at 20 degrees; the shutters open; a breath every 6 s; every lamp at full; the keel-lights running bow to stern; the mast-lift's tower lit | She draws her lift up, blasts her stacks, unfeathers, sounds her horn twice and turns west over the city | The whole A7 overtone chord, the piston on every stroke; the score in six |
| **SINGING** | While the Tonal Warden's fight lives (`ws`, `now >= ws.op`, neither `fell` nor `lost`) | The bridge's eight pipe-forks and the Warden's crown in their state; a breath every 3 s | (the street never sees it - one crew's fight) | The war in six, the Discord in seven and out of tune, the Keel-Song sung by the Warden over the forks |

After the fall she is AWAKE and at peace: the bridge's inlay turns from ember to lamp-gold, every resonator rings true, and
the keel's hum loses its seventh (A major, `KT_KEEL_TRUE`) - the one time she sounds resolved. The one D major chord in
her score is a Gilded gun in your hands (KETCHGLD).

### Palette: Daggerfall's index space (B's contract)

Daggerfall's textures are 8-bit indices into `ART_PAL.COL`. The Ketch paints the same way: every texel is a **ramp step
that names an ART_PAL index**, resolved at upload through the player's own palette (`formats/dfPalette.js`, the reader the
dungeon host already uses for every TEXTURE it loads). The indices are code, as `characters/dyes.js` `METAL_TABLES` is.
Where there is no player data (the lab, a test, a data-less boot) each step resolves through its **fallback colour**: the
port's own, painted near the entry and never read from the file - taken from today's ramps (`world/ketch/ketchArt.js`
`KT_RAMP`, `world/superDungeon/sdLook.js` `SD_RAMP`) where one stands within 24 (sRGB distance) of the entry, painted fresh
where none does. No palette byte enters the repository (Port-Doctrine, A RENDER OF GAME DATA IS GAME DATA).

**Her metal is Daggerfall's Dwarven.** `METAL_TABLES.Dwarven` is indices 144-159, the olive gold every Dwarven blade and
cuirass in the Iliac Bay has worn since 1996 (DFU's `GetMetalColorTable`, `DYE_COLORS.Dwarven` 20), and the band Daggerfall
Enemy Expansion painted its Centurions in (B sampled DEE's Centurion Sphere and Steam Centurion: their main colours stand
within 4-10 of indices 191, 158, 155, 152, 150 and 18). So the ship, her crew and the player's own Dwarven armour are one
metal. The Hour's orange brass (`SD_RAMP.brass`) leaves her.

| Ramp (`world/ketch/ketchLook.js` `KT_PAL`) | ART_PAL indices, dark to light | Where | Replaces |
|---|---|---|---|
| **Dwarven** | 159 158 156 154 152 150 148; rubbed 18; glint 145 (the table's own order, `METAL_TABLES.Dwarven` read from it, never re-typed) | hull plates, trim, rails, posts, masts' collars, the helm, every construct, the Warden | `SD_RAMP.brass` |
| **Burnished** (the Dwarven ramp's light end, no verdigris) | 150 148 146 145 | the bridge's instruments: pipe-forks, resonator cages, the crown, the forks | C's tonal brass (one metal) |
| **Rust** | 191 190 189 187 | the Dwarven ramp's two darkest seams, oil under vents | `SD_RAMP.bronze` |
| **Copper** | 189 187 185 181 183 176 (B's order corrected: 181 stands darker than 183 in the palette) | pipes, coils, the arc-coils' windings | `KT_RAMP.copper` |
| **Verdigris** | 143 141 139 137 135 133 | brass recesses; weeping below seams, never on a walked face | `SD_RAMP.verdigris` |
| **Dwemer steel** | 223 220 95 93 91 89 87 85 (the palette's two darkest greys under `METAL_TABLES.Iron`'s blue-greys, 87-95, and 85) | machinery, gun barrels, the deck plates' bed, the bridge's floor, the belly's grooves | `KT_RAMP.iron` |
| **Dwemer stone** | 79 77 75 73 71 69 67 (the palette's warm sand row) | the engine house, the quarter wall's façade, the cabin | `KT_RAMP.stone` (cool grey: Daggerfall's dungeon brick) |
| **Aether** | 108 105 102 100 98 96 80 | cells, true resonators, the fed engine's eye, the keel-light, the beacon's foot | `KT_RAMP.aether` (its hue kept) |
| **Ember** | 251 247 243 240 237 234 231 | false resonators, the forks, the crown in phases 2 and 3, a warned seam, a bleeding cell | `KT_RAMP.ember` |
| **Lamp** | 15 13 10 5 2 1 | lamp glass, lit ports by night, the edge line | the Hour's brass as glass |
| **Gilt** | 21 18 13 9 4 1 | the helm's pedestal, the chest, the Gilded guns' moment | `ketchGiltArt` on the Hour's brass |
| **Cloud and steam** | 118 116 114 112, and the blue-grey 83 81 80 | cloud sheets, puffs, steam | `KT_RAMP.cloud` |
| **Fields, soil, water** (the painted land, the fallback only) | 207-196 and 172-164; 79-71; 108-104 | the land below where no data stands | `KT_RAMP.field`, `.soil`, `.water` |

**The test of the contract** (`kt_look_palette.test.js`, new): every record `ketchArt()` paints holds only
`KT_PAL` steps (the kit's `offPalette` over its index image is 0); every index is 0-255 and the Dwarven and Iron rows
equal `METAL_TABLES`' own; and, with `ARENA2_PATH` set (`tools/fetch-data.sh` puts the freeware at
`/home/claude/dfdata/arena2`), every fallback stands within 24 of its entry and every ramp rises in the palette's own
luminance - the lab looks like the game. The kit's last step moves from "the nearest colour of a ramp list" to "the
nearest step of the record's ramps, kept as an index image beside the colours" (`world/superDungeon/sdPixelKit.js` gains
`quantizeIndexed`; the Hour's `quantize` is untouched).

### Light: four meanings, the world's own, and the beat

Emission and point-light colours are linear RGB, as the renderer takes them. **Every one is a constant that already
exists**, imported by `world/ketch/ketchLook.js` from its home and pinned equal; nothing pinned is re-pointed.

| Light | Colour (its home) | Means | Where |
|---|---|---|---|
| **LAMP** | `world/ketch/ketchModel.js` `KT_LAMP.color` [1.0, 0.8, 0.5], below decks `KT_LAMP.below` [1.0, 0.7, 0.4] | **The made way: she holds you here, the way on is open, it is yours** | caged lamps, the gold edge line (`realmEdgeArt`), the way-on lamp over an opened hatch, the lift's gate lamp, the bosun's post, your checkpoint's lantern, your chest's rings, a Beat plate that holds |
| **AETHER** | `scenes/ketch/ketchDeckHost.js` `KT_GLOWS.cell` [0.5, 0.85, 1.0], `KT_GLOWS.resTrue` [0.55, 0.9, 1.0] | **Her soul, true: carry it, set it; it works** | a charged cell, a set socket, a true resonator, the fed engine's eye, the lodestone, the keel-light, the beacon, the running lift's cage, the Warden's crown while it keeps her song true (the Steersman) |
| **EMBER** | `KT_GLOWS.resFalse` [1.0, 0.4, 0.15] | **Out of tune, wanting, about to fail: put it right, or break it** | a false resonator, a risen fork, the crown in the Discord and the Last Note, the pipe-forks' count through the Keel-Song, a warned section's seams, a bleeding cell's last 5 s, an empty socket while the engine starves, a vent about to pour |
| **RED** | `SD_LIGHT.red` [1.0, 0.32, 0.26] (`world/superDungeon/sdLook.js`); on the HUD `ui/ketch/ketchHud.js` `KT_BAR_CSS.west` | **Refused, or the end** | the turn west, a lost fight, a refusal |
| **The world's sun and moon** | `world/worldClock.js` `sunDirection`, `daylightScale`; the world's sky (the dungeon arm's `host.drawSky`) | **The hour, and nothing else** | she makes no light of her own outside her lamps; she is lit by the real sky |
| *white-gold* (the beat) | `SD_LIGHT.moment` [1.0, 0.92, 0.62] (= `render/superDungeon/sdBeam.js` `SD_BEAM_CORE`) | **A beat lands - once** (at most 0.25 s) | a cell set, a resonator put right, the engine's eye waking, a fork broken, the stun, the Keel-Song landing, the fall, the chest opening |

**C's TONAL light is left out.** Its colour [1.0, 0.94, 0.72] has a display luminance of 0.94, within 0.02 of the beat's
0.92 and 0.12 of LAMP's 0.82: under `?grey` it would be told apart by motion and place alone, a meaning with no value of
its own. EMBER already means "the Warden's wrong: put it right or break it", and its luminance (0.51) stands far from
AETHER's (0.83) and LAMP's - so the Warden's false song is EMBER (its crown, its forks, the pipe-forks' count), its true
steering is AETHER, and the moment it is silenced is the beat.

**Never by hue alone.** Every meaning also has a shape, a place and a motion: **lamp** lives in cages and edge lines and is
still; **aether** lives in glass (cells, crystals, the keel strip, the eye) and swirls slowly (0.25 Hz); **ember** lives in
glass and in seams and falters (two dips at 2.5 Hz at most) or beats (2 Hz at most); **red** lives on the floor's inlay and
the gauges' red sectors and never moves; **the beat** happens once. The shock telegraph's near-blue lives on the floor and
between two coils. The lab's `?grey` separates every pair on every view, both lanes.

### The value ladder

Display luma (Y' = 0.2126R' + 0.7152G' + 0.0722B' over the encoded colour), measured in the lab on both lanes. *Today* is
measured on the lab's frames of `b5f286182` (A, B and C measured; the rows marked so were measured again for this page).

| Rung | Target | Today (*measured*) |
|---|---|---|
| **L0 the deep** - the land 260 m down | by day at most 0.40 and under the hull's mean; by night at most 0.06, its lit windows on L2 | 0.51-0.58 by day (`bow`, `side`: whole-frame p50 0.53-0.56, re-measured), brighter than her hull (0.25) |
| **L1 structure, open decks** | at noon floor mean at most 0.22, p95 at most 0.30, nothing over 0.5; dusk p50 at least 0.10; night mean at least 0.06 | noon floor (the frame's lower 30%) mean 0.20-0.23, p95 0.36-0.47, rivet glints to 0.71; dusk and night floor mean 0.02 (re-measured, `waist`, `bridge`, `helm`, `arrive`) |
| **L1 structure, below decks** | p50 at least 0.08 between the lamps at every hour; lamp pools at most 0.30; a telegraph floor at most 0.25 under every lamp | `gallery`, `hold`, `engine` whole-frame p50 0.003-0.005 at every hour - black, the void's rung (re-measured) |
| **L1 the cabin** | p50 0.15-0.35 | 0.137 at noon, 0.029 at night (re-measured) |
| **L2 ambient light** | 0.30-0.45: lamp cages, edge lines, gauge faces, ports by night | ports about 0.65 at noon (`ketchGlassArt`'s emission ignores the hour) |
| **L3 signals** | 0.5-0.8: aether and ember glass, needles, lit bands, the eye | the engine's only read is a point light (0.25 to 1 by `bk / nd`) |
| **L4 critical** | at least 0.7, peaking at or above 0.85 (`render/airPass.js` `AIR_BRIGHT_THRESHOLD`): telegraph cores, a tell at its hottest, the beat | the live run's telegraphs p99 0.81-0.90 |

Only L3 and L4 bloom; nothing on L1 or L2 passes 0.5. The sky is the world's and stands off the ladder (about 0.6 at
noon): the ship reads darker than it.

### Materials and grain

SD-LOOK's pixel law stands, restated in Daggerfall's own grain, which B read from TEXTURE.155 (Orsinium's riveted iron)
and TEXTURE.371 (the Mantella's gold): **big bevelled panels framed by 2-3 px border strips with rivets, the faces mottled
in blotches 4-8 texels across, never single-texel noise.** Today's Ketch paints fine noise (`noiseField(seed, 16)`) and a
uniform tread lattice, which reads as cloth from 5 m and a carpet of squares down the waist.

- **Dwarven plate** is structure. Hull plates run in courses 1 m tall (32 texels) and 2 m long, lapped (a 2-px shadow line
  under each lap), riveted along the laps every 8 texels, butt joints staggered a plate apart; emission at most 0.04, on
  worn edges only (`realmBrassArt`'s rule).
- **Dwemer steel** is the machine and the floor under a fight: the darker metal, so telegraphs own the floor.
- **Dwemer stone** is warm sand ashlar in courses 1 m by 0.5 m, a Dwarven string course every metre, the Rourken script band
  at door height.
- **Verdigris** only in recesses and below seams: it weeps down.
- **Glass** (aether, ember, lamp) is the only self-lit material, and **glass shows a level**: a sight-glass fills from its
  foot, a cell drains.
- **Brass cord** for every net and shroud, cut out between the cords (alpha 0, `KT_CUTOUT_RECS`).
- **No wood and no cloth.** The Dwemer built in metal and dressed stone (`ketchArt.js` says so; no Dwemer ruin has a
  banner). Vanes are pierced brass leaf.
- **Steam and cloud** are shader surfaces under the pixel law: Bayer-dithered alpha, posterized, never an alpha-tested
  hexagon (`e2e/gallery_1.png`'s grey blobs are `puffArt`'s two-step rim cut by the billboard pass).

### Ornament (B's kit, the canon's motifs)

`world/ketch/ketchOrnament.js` (new, pure, over `world/ketch/ketchKit.js`): each motif 40-300 triangles, laid where the
dress says, never inside a footprint the law reads.

| Motif | Canon | On the Ketch |
|---|---|---|
| **Gear-glyph boss** - interlocking rings and radiating spokes | the round doors and wall bosses of Morrowind's and Skyrim's ruins | her two hawse discs at the bow (unlit), the quarter wall's sealed door, the engine house's and the cabin's doors, the capstans' tops, the hammers' faces, the vents' irises, the chest's rings |
| **Fin crest** - a swept blade along a ridge | the fins on Dwemer pillars, lamp posts and centurion helms | the engine house's ridge, the stern, the mastheads, the pipe-forks' feet |
| **Rourken script band** - a 64x16 strip of glyphs drawn in the manner of the Dwemer's (the port's own glyphs) | the Dwemer script on doors and lexicons | her name at bow and stern, the bulwarks' inner face, the helm's column, the cabin's frieze |
| **Tuning-fork** | Kagrenac's tools struck the Heart with tone | the eight pipe-forks, the Warden's crown, the resonators' cages |
| **Coherer sphere** | the brass spheres on Morrowind's conduits | the arc-coils' heads: the arc leaps sphere to sphere |
| **Dwemer lantern** - glass in a brass cage with a fin | Skyrim's Dwarven lanterns | every lamp aboard (`ketchLampSpots` keeps their places) |
| **Pipe flange** - a banded collar every 2 m | every Dwemer ruin's pipe runs | every pipe; the masts' bands |
| **Keel-light** - a strip of aether glass along her keel's foot | the aetherium's blue | her sign from below, by day and night |

### Motion: one breath, one swell, one wind

A's breath, B's sway, C's ship's beat and D's wind are one law, `world/ketch/ketchLook.js` `ketchMotionAt(states, t,
out)` - pure, on the shared clock (the client's relay seconds), so every crewmate's screen moves together - with three
clocks:

1. **The stroke and the breath (her engine).** `ktStroke`: STARVED, a bar of five beats at 120 BPM (2.5 s; two bars are
   `KT_ARCS.cycle`, 5.0 s), the strokes on beats 0 and 2.5 and the stroke on beat 4 missing (0.8 Hz); FED, a bar of six at
   120 BPM (3.0 s, `KT_HAMMER.cycle`), the strokes on beats 0, 1.5, 3 and 4.5 (1.33 Hz) - the score's piston, the same
   beat. The flywheel, the pistons, the drum's glow (a pulse a stroke, at most 1.33 Hz) and the socket pipes' pulses read
   it. `ktBreath`: a breath of steam from her stacks every 12.5 s ASLEEP (five starved bars), 6.0 s AWAKE (two fed bars),
   3.0 s SINGING (one); the vanes breathe +-6 degrees and the lamps' glow +-8% with it (0.08-0.33 Hz - never a blink).
2. **The swell (everything that hangs).** `ktSwell`: one period, `scenes/ketch/ketchSky.js` `KT_SKY.bobMs` (9 s, the bob
   she already has in the sky). Lamps on their chains, the cradles in the rigging, the cage's chain and the hanging
   sections swing on it together - 1 degree plus 2 degrees by the wind's strength (3 at most), lagging 0.03 s a metre aft of
   her middle so the swell runs along her - never a phase per thing. The land below heaves +-0.6 m on the same swell, and
   at station swings +-1.5 degrees about the anchor over 40 s (B). No collider moves, and the camera never rolls.
3. **The wind (D's).** `ktWindAt(n, t)`: the voyage's wind, its bearing and strength (0.25-0.9) seeded per real hour from
   the voyage, its gusts the world's own law (`systems/wind/wind.js` `gustEnvelope(strength, tsec)`), on the relay's clock:
   every crewmate meets the same gust at the same moment. It drives together the rigging's sound, the hull's creak (0.4 s
   behind it), the vapour motes' streak, the clouds' drift (`KT_CLOUDS.drift` 2.4 m/s its floor), the brass-leaf
   weathervanes and the swell's amplitude. The Sailwalk's Rotten Rigging gust (`gustAt`, the law's) rides on top where the
   Steps read it. Outside she carries the same wind at 260 m; the street keeps its own.

And SD-LOOK's three: **smooth motion is danger** (wind-ups, hammer heads, a falling section, a lunging sphere, the
Warden's tells move smoothly against her stroke and swell); **dither, never fade** (`renderer.setDissolve`, SHIP-FADE's
ordered screen-door, over 0.15-0.8 s); **the flash ceiling** (nothing over 3 Hz, heartbeats and falters at 2.5 Hz or less).
And the Ketch's own: **needles fall and glasses fill** - time runs down to a red pin, charge runs up from the foot, never
the other way, checked through the camera's one mirror (`world/mat4.js`); **she mends, she does not rewind** - a fallen
section is winched home, a rotten grating is swung back on a chain (the Hour rewinds; that is the Hour's meaning).

**Reduced motion** (`prefers-reduced-motion`, `ui/windowMotion.js`): holds the swell, the vanes' breath, the land's heave
and swing, the clouds' drift and the motes; never holds a needle, a glass, a hazard, the lift or a tell - those are
information.

### The shared vocabulary of states

| State | Light | Shape and place | Motion | Sound | Where |
|---|---|---|---|---|---|
| **Charged, fed, true** | AETHER in glass | a full glass; a crystal | a slow swirl (0.25 Hz) | its partial, in tune | a charged cell, a set socket, a true resonator, the fed engine, the running lift |
| **Filling** | AETHER rising from the foot | a sleeve or glass with its level | the level climbs smoothly; full, it dithers in and the clamp shuts | a rising whine; a clack at full | a cradle recharging (20 s; 12 s on the bridge), the engine's band ring |
| **Wanting, out of tune** | EMBER, dim | an empty glass; an ember eye or crystal | an ember breath (0.4 Hz); a false crystal turning fast | sour: -40 cents, beating | the starving engine, a false resonator, the crown in the Discord |
| **Count: how many of how many** | LAMP or AETHER, lit from the foot or the left | studs, a band ring, a lamp row, the pipe-forks | a band clicks on | a ratchet's clack | the engine's sockets, the board's lamps, the resonators' lamps, forks standing, the crew |
| **Time left** | a needle falling to its red pin, or studs going dark from the top | a dial (a 270-degree sweep, full at the right, the red pin at the lower left); a ring of studs | the needle falls smoothly | a tick each second in the last five | the lift's dials, the voyage's gauge, a Beat plate's studs, the stun's ring, the Discord's mark |
| **Coming (a wind-up)** | none, or the blow's own telegraph colour on its source | the source shows it: a head drawing up, a vent dribbling, a coil's glass filling, a body's tell | smooth | the machine's wind-up cue | every hazard, every construct, the Warden |
| **About to fail** | EMBER plus one or two falters at 2.5 Hz or less | seams, rims, the glass going ember | rivets popping | groaning metal | a warned section, a bleeding cell's last 5 s, a Beat plate's last 0.4 s, a rotting grating |
| **Gone, will return** | a 2-px LAMP ghost outline | the law's own shape where it will be, with its studs or needle | the needle runs to its pin | a clank on its return | a Beat plate, my rotten grating, a fallen section's place |
| **Closed, cold** | none: brass with no light | bolts across, gates down | still | a clank when tried | the quarter wall's door (forever), the hatches and the cabin before their stage, the dead lift |
| **Open, runs (the way on)** | LAMP lit over it | the bolt drawn, the gate up | the opening moves once | a bell or a chain | an opened hatch, the lift's gate, the bosun's post, the cabin's door |
| **Yours** | LAMP | your checkpoint's lantern, your chest's rings, your cell in your hands | still | none | - |
| **The Warden's wrong song: put it right or break it** | EMBER | the forks, the crown, the pipe-forks' count | rings (2 Hz at most) | its partial, sour | phases 2 and 3 |
| **The end** | RED | the bridge's inlay, the gauges' red sectors | none | the score's silence; the hull groaning | the turn west, a lost fight |
| **A beat lands** | white-gold, once | at the thing | none | a sting | every set, break, stun, wake and fall |

### The pixel law

- **Textures** are painted in code through the kit (`world/superDungeon/sdPixelKit.js`): 1-px bevels lit from the top-left,
  dark outlines, 3x3 rivets, an ordered dither between ramp steps, and the last step `quantizeIndexed` - every texel a
  `KT_PAL` step, an index image beside its colours. About 32 texels a metre on big surfaces (64 px for 2 m), 64-128 px
  atlases for parts; painted at 2x under Vanilla Enhanced (`systems/vanillaEnhanced/vanillaEnhanced.js` `veWorn`).
  Sampling is NEAREST, with no mips outside Retro Mode, so the read lives in features 4-8 texels wide or the floors shimmer.
- **Shader surfaces** (the gauges, the lines, steam, clouds, the bridge's glow, the shafts, the arcs, the veil, ghosts) go
  through `render/orderedDither.js` `SD_PIXEL_GLSL`: a Bayer offset, luminance posterized (10 steps on the lane, 8 on
  classic), the surface coordinate snapped to a grid near its wall's texel; under Retro Mode, the retro image's pixels.
- **Sprites** of the Ketch's own (the Warden, the Spider, the Ketchmaster) are ART_PAL index images in Daggerfall's
  record layout, about 44 px a metre (Daggerfall's own run near 50), five facings mirrored to eight, their tell layer a
  second image of the same frames.
- **Lines** (rigging, chains, drop-lines, aim lines, the bosun's line) are screen-width quads at least 1.5 px wide (wider
  on short screens, `telegraphLineW`'s law), never `GL_LINES`, which WebGL caps at 1 px.

### The sound language (D's, with the grafts)

**Her one note.** Her keel hums a low A at 55 Hz, and every note she makes - the score, the engine, the bells, the Warden's
voice, the four resonators, the seven forks, the Beat plates - is one of its harmonics. The scale they make (A B C# D# E F#
G, harmonics 8-14) is a natural horn's; the seventh (G) is why she never lands.

| Harmonic | Note (12-TET as written) | Hz | Where it sounds |
|---|---|---|---|
| h1 | A1 | 55 | the keel's hum, the pedal of every place-song; the Warden's fall cry |
| h2 | A2 | 110 | the keel's hum; the Warden's growl |
| h3 | E3 | 165 | the starved engine's open fifth; the Keel-Strike's wind-up |
| h4 | A3 | 220 | an engine partial; the chest's call |
| h5 | C#4 | 277 | **life**: the engine's FIRST cell gives back its third |
| h6 | E4 | 330 | an engine partial |
| h7 | G4 | 392 | **flight**: the engine's LAST cell; her horn's held note |
| h8, h10, h12, h16 | A4, C#5, E5, A5 | 440-880 | **the four resonators**: true together they spell A major |
| h8-h14 | A4 B4 C#5 D#5 E5 F#5 G5 | 440-784 | **the seven forks** (fork `c` rings h(8+c)); **the Beat plates** (each plate rings its own) |

**Her time.** Six (six quarter beats a bar, rolled on beats 1 and 4) is her true time, a ship in the wind; **five** is the
engine missing its sixth stroke (KETCHENG); **five catching six** is the engine waking (KETCHWAK); **seven** is the Discord's
extra beat - out of time as well as out of tune (KETCHWR2). Every other score in the game is in four (`sdScore.js`,
`gateScore.js`, `egScore.js` all lay `bar * 4 + beat`).

**Settled.** B's F Lydian, A's B-flat overtone series and C's D Lydian each made the same argument - an overtone series
whose out-of-tune partials carry the fight - and D's A carries it with the most in it: one source of pitch for the air,
the bells, the voices and the score, meters that carry meaning, and a harmony (A7, the dominant) that tells the arc's
own title. The others' keys are left out; their devices are kept inside D's: A's motif on the horns (KT_CALL), B's mended
motif at the fall (KT_KEEL_TRUE), C's per-cell and per-resonator state.

**The mechanic is heard, by one law.** A set restores one of her voices, a break removes one:

- a **cell** set gives the engine back one partial, in the order `KT_ENGINE_HARMONICS[nd]` - always C# (h5, life) first and
  G (h7, flight) last: need 4 is [5, 4, 6, 7]; 5 is [5, 4, 6, 8, 7]; 6 is [5, 4, 6, 8, 9, 7]; 7 is [5, 4, 6, 8, 9, 10, 7]
  (`engineNeeds`, `cl.nd`) - so feeding it, the crew hears the chord fill;
- a **resonator** put right snaps its own note into tune (a glide from -40 cents to 0 over 0.4 s) and takes a quarter of
  the score's sourness away; the four, righted in order, spell A major;
- a **fork** broken takes its partial out of the Keel-Song (its bed stops), so the crew counts forks by ear.

**The Discord is heard as real beating, by one mechanism**: D's live detune (`SongPlayer.detune`, below) bends the ship's
voices (keel, brass, horn, forks, whistle) `-40 x false / 4` cents against the crew's true ones (strings, choir, reed,
bass, kit) - about 10 Hz of beating at A4 with all four false, 2.5 Hz at A2. B's written channel bends (-31 and -49
cents on the seventh's and eleventh's channels) are left out: a bend written into a song cannot follow the resonators as
the crew sets them. The score is 12-TET everywhere else (the FM bank's), so the forks and resonators agree with it.

**Locked to the law's clock.** The Gallery's bar is the hammers' cycle (`net/ketch/ketchDeck.js` `KT_HAMMER.cycle` 3.0 s:
six beats at 120 BPM; `hammerPhase` lands three hammers on every half second, so every beat is a slam); the steam lanes'
bursts (every 2.0 s, half `KT_STEAM.cycle` apart) fall every four beats against the bar of six - the shanty's hemiola; the
starved hold's two bars of five are the arcs' `KT_ARCS.cycle` (5.0 s); the Sailwalk's bar is the Beat's
(`net/eliteGates/egSpanLaw.js` `EG_BEAT_CYCLE_S` 3.6 s: six beats at 100 BPM), so a plate arrives on beats 0 and 3. A
song begins and resumes at the shared clock's own tick (the clock lock, below): every crewmate hears the same bar as the
same hammer falls.

**The loudness ladder** (the value ladder's twin, measured through the real player, `tools/sdScoreProbe.mjs`'s law):

| Rung | dBFS | What |
|---|---|---|
| S0 keel | about -38 | her hum, under everything |
| S1 beds | -32 to -28 (the rigging -26 aloft) | rigging, hull, engine, coils, lift |
| S2 events | -26 to -20 | far events; hazards near (`far`-tagged, `systems/audio.js` `fadeFar`) |
| S3 score | places -21 to -19; fights -17 to -14.2 | the songs |
| S4 critical | sting peaks about -8; the score ducked 6 dB for 300 ms | a Warden blow on my feet, the Discord, the Keel-Song's landing (`systems/eliteGates/egMix.js` `createSpireMix`) |

Nothing peaks over -1 dBFS (each song's press ceiling, `songPlayer.js` `songPress`).

**Her made sounds** come from the player's own DAGGER.SND at runtime, as the Hour's works and bell are
(`scenes/superDungeon/sdAir.js` `buildHourWorks`, `buildOrreryHum`; `systems/superDungeon/sdRiftSound.js`), and nothing is
shipped: AmbientWindBlow1/1a/1b (70-72) and AmbientWindMoan (65) for the rigging; AmbientDoorOpen (67) and NormalDoorOpen
(94) slowed for the hull's creak; AmbientGrind (68) for the starving engine and the winches; AmbientStrumming (69)
resampled to her partials for the keel and the engine (B's graft - D's sines are the lab's and a data-less boot's fallback);
the clunk (Parry6, 433) for ratchets, anvils and pawls; the ship's bell (107, the naval host's) for the watch, the plates
and the city; ArenaFireDaemon (11), Kamer's mill, for the gun deck's machinery; Burning (420) for steam's crackle; the Iron
Atronach's bark (223) and move (222), tuned, for the Warden.

### The shared kit

**New modules** (each wired by a module the hosts already wire - HOST-SPLIT):

| Module | What |
|---|---|
| `world/ketch/ketchLook.js` (pure, a leaf) | `KT_PAL` (index ramps and fallbacks); the lights imported and pinned equal; `KT_LADDER`; `ketchMotionAt` (`ktStroke`, `ktBreath`, `ktSwell`, `ktWindAt`); `needleTo(left, total)`, `glassOf(have, need)`, `fillOf(backAt, now, ms)`, `falter(t, k)` |
| `world/ketch/ketchAtmos.js` (pure) | `KT_HOURS`: the light by hour and zone (ambient, trilight, sun colour and share, fog colour and density, lamps' gain, the lane's grade); `KT_MOTES`: the motes' layouts by zone |
| `world/ketch/ketchStates.js` (pure) | `ketchStatesOf(V, t, now, me, out)`: one kept record of every state the look, the air, the score and the HUD read (below); `KT_PVS`, the part groups each zone sees (The whole bill) |
| `world/ketch/ketchOrnament.js` (pure) | the ornament kit |
| `world/ketch/ketchDressModel.js` (pure) | the new parts: vanes, flippers, shutters, the swinging lanterns, rigging cradles, the Sentries' irises, the counterweight and sheave, the pipe-forks, resonator rings, the wheel, the armillary, the crown, the ward plates, the chest's lid and rings, the engine's eye, flywheel and pistons, the sleeves and clamp rings |
| `world/ketch/ketchBoards.js` (pure) | `KT_BOARD_SITES` (every instrument's place, facing, size and kind in the deck's frame) and `ketchGaugesInto(states, out)` |
| `world/ketch/ketchLand.js` (pure) | the land below from Daggerfall's own data: the plate, its windows, the city in relief, the heights; the painted fallback |
| `world/ketch/ketchStepsDress.js`, `ketchStepsArt.js` | the Sailwalk's dress for the Hour's Steps |
| `world/ketch/ketchShadow.js` (pure) | her silhouette and its caster's rectangle for the cloud-shadow field |
| `world/ketch/ketchRecolour.js` (pure) | a truecolour sprite's texels mapped by luminance onto a `KT_PAL` ramp |
| `world/ketch/ketchBake.js` (pure) | the deterministic software rasterizer (flat triangles, NEAREST, a z-buffer, Daggerfall's sprite key light from the upper front-left, 2x supersampling boxed down, an ordered-dither quantize to `KT_PAL` indices), a step at a time - `world/lowPolyTrees.js` `impostorSteps`' law - used by the sheets' tool and by her far picture |
| `world/ketch/ketchWardenModel.js`, `ketchSpiderModel.js`, `ketchMasterModel.js` | the three bodies of the Ketch's own, as code, and their small rigs |
| `scenes/ketch/ketchWake.js` (pure) | the engine's waking as tracks of its moment |
| `scenes/ketch/ketchFx.js` | bursts, shakes and landing flashes (`scenes/superDungeon/sdFx.js`'s law) |
| `scenes/ketch/ketchRead.js`, `ketchBeats.js` | the ground read (`scenes/superDungeon/sdArenaRead.js` `sdPerilAt`'s law); the beats on a title card (`createSdBeats`' law) |
| `scenes/ketch/ketchAir.js`, `ketchVoice.js`, `ketchReverb.js`, `ketchScoreHost.js` | her air, her voices, her rooms' reverb, her score's host |
| `scenes/ketch/ketchPresence.js` | her in the world: the far picture, the lights, the beacon, the plume, the shadow's caster, her sounds outside, the banner and the rumours |
| `scenes/ketch/ketchRide.js` | the lift-off, the riders' cages, the step's veil both ways, the arrival cage's moment |
| `scenes/ketch/ketchSailwalk.js` | `ketchSailwalkDeps(renderer, audio)`: the Steps' options for her course (the course, the dress, the sounds) |
| `systems/ketch/ketchScore.js`, `ketchSound.js` | the songs as notes and their law; the made sounds (`pitchOf`, `tuneTo`, the builders) |
| `render/ketch/ktGaugePass.js` | every instrument on the ship in one instanced draw (`drawArraysInstanced`; the Hour's ghost pass the precedent): up to 96 instances x 12 floats; kinds dial, glass, lamp row, flat ring, pulse along a segment |
| `render/ketch/ktLinePass.js` | every rope and chain as screen-width quads at least 1.5 px wide; about 76 static segments and 24 dynamic slots, one draw |
| `render/ketch/ktSteamPass.js` | every puff of steam: point sprites a pure function of their emitter's clock (`render/superDungeon/sdMotes.js`' law), Bayer alpha through `SD_PIXEL_GLSL`, 4 steps on the lane and 3 on classic, lit by the frame's ambient and the nearest lamp's colour; at most 768 particles from 24 emitters, one draw |
| `render/ketch/ktShaftPass.js`, `ktArcPass.js`, `ktBridgeGlow.js`, `ktCloudPass.js`, `ktMotes.js`, `ktLiftVeil.js` | the port shafts, the arcs, the bridge's floor light, the clouds, the motes (on the Spire's generator), the step's veil |
| `ketchLabProbe.mjs`, `ketchScoreProbe.mjs`, `ketchAirProbe.mjs`, `ketchVoiceProbe.mjs`, `ketchHudSheet.mjs`, `bakeKetchSprites.mjs` | the probes, the sheet, the bake |

**`ketchStatesOf`** writes one kept record (it makes nothing in a frame - AUDIT KETCH L3-16's law), each field from the
link's state `V` (`net/ketch/ketchLink.js`) or the shared clock, so the deck, the passes, the HUD, the air and the score
read the same number on every screen: `ship` (ASLEEP, AWAKE, SINGING); the cradles' and the bridge cradles' fills
(`cl.cr[j]` is 1 or its `backAt`: `1 - clamp((backAt - now) / KT_CRADLE_BACK_MS)`, `KT_BRIDGE_CRADLE_BACK_MS` on the
bridge); the sockets (`cl.sk`); each loose cell's time left (`(cl.lo[j][4] - now) / KT_CELL_LIES_MS`); the appetite
(`cl.bk / cl.nd`) and the partials sounding; the waking's age (`now - V.sga` once `V.sg` reaches the Sailwalk); the lift
(`liftYAt`, `ketchShaftGates` - its phase in the 32 s round: at the foot 0-7 s, rising 7-16, at the top 16-23, falling
23-32); each hazard's wind-up share (`hammerHeadY`, `world/ketch/ketchPose.js` `hazardState`); the spider vents' next pour
(predicted from law the page holds: the first at `sga + KT_SPIDER_EVERY_MS / 2`, then every 9 s while
`spidersMaxFor(crew)` exceeds the spiders alive - a rare false breath, when the relay's census and the page's crew differ,
costs a glow); the Watch's wave and its 3 s gap; each section's warn, gone and return shares (`sectionPose`'s numbers); the
resonators (`ws.rs`), the Discord's mark (`ws.da`), the Keel-Song (`ws.fk.at`) and each fork's health (`fk.c[j][2] /
fk.m`); the stun (`ws.su`; its start noted when `su` first steps past `now`); the phase turn (`ws.ou`), the fight's end
(`ws.ends`), the voyage (`ketchVoyageOf(n)`), the crew, and my chest (`scenes/ketch/ketchShares.js` `owed`).

**Reused**, each named where it is used: the paint kit and the Hour's records (`sdPixelKit`, `realmBrassArt`,
`realmEdgeArt`); `render/superDungeon/sdHalo.js` (`SD_HALO_MAX` 64; gain 1 on classic, 0.5 on the lane), the classic set's
bloom; `render/superDungeon/sdStepsPass.js` (ghosts); `render/superDungeon/sdStompWall.js` (walls of light, `sdHomeBeacon`);
`render/gate/gateFx.js` (`FX_BURSTS_MAX` 16, `FX_LIGHT_MS` 450); `render/gate/gateTelegraph.js` (unchanged, and WBX4's
`TELEGRAPH_KIND.mark`); `render/gate/gatePass.js`'s beacon (`gatePassValues`: per-draw colour and height); the dungeon
loop's `texRemap`, `noShadow` and `culled` (read by the arm today: `scenes/worldModes.js`, the dynamic loop);
`renderer.setSceneGrade`, `setDissolve`, `updateMeshVertices`, `createBillboardBatch`; `ui/gate/gateGroundView.js`,
`ui/superDungeon/sdTitleCard.js`, `ui/gate/gateDamageChart.js`; the score's machinery (`systems/gate/gateScore.js`
`midiNote`, `SCORE_TPQ`, `SCORE_STING_LEAD_MS`; `music.registerSong`; `songPlayer.js` `songVoices`, `songKit`); the air's
(`scenes/deadlandsAir.js` `airSourceAt`, `sdAir.js` `layBed` and `sdAirEvents`' slot law, `scenes/eliteGates/egCall.js`
`buildEgHorn`'s method); `systems/eliteGates/egMix.js` (`createSpireMix`, `egBarkCull`); `systems/eliteGates/egReverb.js`'s
zone law; `betterAmbience.weaponKick` (shakes, under the player's own maximum); `characters/dyes.js` `changeDyeBitmap`.

**Shared modules changed**, each keeping its other users' pins byte-equal:

| Module | Change | Whose pins stand |
|---|---|---|
| `scenes/superDungeon/sdSteps.js` | `createSdSteps` takes a `dress` (`'hour'` the default) and a `sounds` table (`SD_STEPS_SOUNDS` the default); a `cull(on)` method | the Hour's: `test/world/superDungeon/sd7b_steps.test.js`, `sd25_steps.test.js` unchanged |
| `render/superDungeon/sdStepsPass.js` | a `uDress` uniform: a ring of studs in place of the hand | the Hour's ghosts byte-equal |
| `render/eliteGates/egMotes.js` | `egMoteLayout` generalised to `egMoteLayoutOf(motes, lite, seed)`; kinds `vapour`, `droplet`, `aether`, `glint` added to `EG_MOTE_KINDS` | the bands' layouts pinned equal |
| `systems/song/songPlayer.js`, `systems/music.js` | the clock lock (`startTick`) and the live detune (`detune`) | a song with neither is untouched |
| `systems/reverbPresets.js` | four of Unity's AudioReverbPreset rows (Mountains, Hallway, SewerPipe, Room) beside Cave, Stoneroom and Quarry | the three |
| `ui/gate/gateVeil.js`, `render/gate/gateVeil.js` | `VEIL_THEMES` gains `ktUp` 9 and `ktDown` 10; the theme dispatch | fire, brass, the Hour's and the Spire's themes |
| `ui/superDungeon/sdTitleCard.js` | a `theme` option (a class: the aether rule `#7cc4ff`) | the Hour's card |
| `scenes/spoilsPool.js` | an optional `dropPitch(i)` (default 1) | every other pool |
| `world/superDungeon/sdPixelKit.js` | `quantizeIndexed` | `quantize` untouched |
| `render/volumetricClouds.js` | one optional caster in the shadow march (`setShadowCaster({ tex, rect, y, yaw } \| null)`) | none set: the field byte-equal |
| `ui/ink/inkMap.js` | `paintGateRing` draws a mark's `gauge`, `glyph` and `course` when present | every other ring |
| `tools/pngIO.mjs` | `writeIndexGreyPng` (8-bit greyscale, no PLTE) | `writePng`, `writeIndexedPng` |

### The hosts: terms in existing lines only

The four hosts were measured at the head against `test/scenes/hostceiling.test.js`: `bootWorld` stands at **36,369 of
36,369** logical lines and `createWorldModes` at **11,040 of 11,040** - no room at all - `buildDungeonContext` at 8,399 of
8,463, `bootExterior` at 5,063 of 5,441. A new statement or object entry in a host is a logical line, so the polish touches
the hosts only with **terms in lines they already have** (a call's argument, an operand of an expression), each checked
with `node tools/hostScope.mjs <host>` and the ceiling test in the slice that writes it. Everything else rides the doors
the Ketch already has: `ketch.frame()` (every mode), `ketch.drawSky(renderer)` (the exterior's world pass),
`host.drawKtFight` (the client's `drawPass`, after the flats), the deck host's `frameLook` (its light, its fog, now its
grade), `ctx.sdStepsRide` (the deck's pose before the motor), and `modes().stepThroughFire` (the mode machine's veiled
step, already among its reads).

| Host | Line | Term | Slice |
|---|---|---|---|
| `scenes/world.js` `bootWorld` | `hourScoreFrame`'s first `if` (`_spireScore.frame(...)`) | `\|\| ketch?.scoreFrame?.()` - the Ketch's score holds the music where its law plays one | KL4 |
| `scenes/world.js` | the exterior's late passes, the starfall's `if (starfall?.showing() && starfall.drawSky(...)) renderer.markForeignPass()` | `\| !!ketch?.drawPresence?.(proj, view, mwv.eye)` - her halos, beacon and plume after the opaque street, the same eye and fog (every late pass is its own statement, and a new one is a logical line) | KL20 |
| `scenes/world.js` | the rumour mill's `getNewsOrRumors` arrow | `?? ketch?.rumor?.(rumorHere(), session)` before the mill's own | KL20 |
| `scenes/world.js` | `presenceFrame`'s `drawGateBanner(...)` and its guard `if (gatePool \|\| sdHost) presenceFrame()` | `?? ketch?.banner?.()` in its text and look; `\|\| ketch` in the guard | KL20 |
| `scenes/worldModes.js` `createWorldModes` | the dungeon arm's `host.drawSky?.(cam.yaw, ...)` | `cam.yaw - ketchDeck.skyTurn(dungeonLoc)` - the world's sky turned as she comes about (0 off a ship, and at station) | KL13 |
| `scenes/worldModes.js` | the build's stand, `if (hit.ketch) ketchDeck.stand(ctx);` | `ketchDeck.stand(ctx, hit.blocksFile)` - the blocks file the made level was built from (`ketchShipHit`'s `ketchShipBlocks(blocks)`, which answers every real name), for the land below; the context carries no blocks file of its own | KL13 |
| `scenes/dungeonContext.js` `buildDungeonContext` | `createSdSteps({ course: KT_COURSE, renderer, audio })` | its argument becomes `ketchSailwalkDeps(renderer, audio)` - three object entries out, none in: the host's count falls by three | KL12 |
| `scenes/dungeonContext.js` | `noteFirstUse(...)`'s `{ after: SCENE_CHANGE_TUTORIAL_MS }` | `_ketch ? KT_ARRIVAL_HOLD_MS : SCENE_CHANGE_TUTORIAL_MS` (8,000 against 4,000) | KL21 |
| `scenes/exterior.js` `bootExterior` | - | FLAGGED: the offline bench has no Ketch | every slice |

No dependency is added to the client's construction in `bootWorld` (each would be an object entry): what the client
needs and does not hold it imports - the music service (`systems/music.js` `music`), the weather's word
(`systems/weather/weatherSim.js` `currentWeather`), the minute (`systems/worldTick.js` `skyMinutes`). The step's veil is
reached through `modes().stepThroughFire(go, look)`, which the mode machine already exports (the Rift's door). The compass
mark at the lift (D) is left out for this reason: the compass's marks are an object literal in `bootWorld`, and a key is a
logical line.

### The whole bill

"Today" is counted from the code at `b5f286182`: a ship's frame issues the same draws wherever the eye stands (the dungeon
arm draws the made level whole, `everyLightCasts`, LA-SHADOW3). Counted in GL draws (one a sub-mesh, the perf overlay's
unit - the live run read 153-175 a frame aboard): the static ship 15, the land 4, the 18 hammers 36, the cage and its two
gates 9, the hatches' leaves and the cabin's doors 14, the eight sections 40, the resonators 4, the lodestone 3, the
Sailwalk's Steps about 31 drawn (66 stood, the rest hidden) - **about 156** - plus the stage's cells (up to 6 cradles, 7
sockets, 16 loose and 8 carried, 2 each), its forks (up to 7, 3 each) and arcs (3), the clouds' and the steam's billboard
batches, the fight's sprite batches and the telegraph pass. Outside: her ship, chain and cage, 20 GL draws.

| Frame (desktop lane) | Today | After |
|---|---|---|
| The waist, the Watch's third wave, 8 crew | ~160 | **~93**: the PVS hides the gun deck, the hold and the bridge (the hammers, the sections, the resonators, the doors, the lodestone - 97 GL draws); the static ship about 20 (its records after the repaint), the land 3, the Sailwalk's dress about 26, the cage and gates 9, the waist's hatch 4, vanes 4, flippers 4, shutters 1, the eight nearest lanterns 8, rigging cradles 1, the Sentries' irises 3, weathervanes 2; and the passes: gauges 1, lines 1, halos 1, motes 1, clouds 1, steam 1, fx 1 |
| The Gallery of Hammers | ~160 | **~35**: the static ship 20, the hammers merged 2, their wheels 1, the hold's hatch 4; shafts 1, steam 1, gauges (the housing dials) 1, halos 1, motes 1, fx 1 |
| The hold, the engine waking | ~175 | **~52**: the static ship 20, the engine's eye, flywheel and pistons 6, the sleeves and clamp rings 2, cells (loose and carried, at most 24), the tower's chase 1, coherers 3, vent irises 1; arcs 1, gauges 1, steam 1, halos 1, motes 1, fx 1 |
| The bridge, the Last Note, 8 crew | ~175 | **~110**: the static ship 20, the sections 8 (one atlas record each), the resonators and their rings 8, the pipe-forks 8, the risen forks 21, the crown and ward plates 2, the Warden's body and tell batches 2, the wheel and armillary 2, the doors 6, the Sailwalk's dress 26, the land 3; glow 1, gauges 1, lines 1 (chains included), halos 1, motes 1, clouds 1, fx 1, walls up to 2 |
| The cabin, the chest | ~160 | **~45**: the static ship 20, the cabin's dress parts 6, the chest 2, the Ketchmaster 1 batch, the land 3; halos 1, motes 1, fx 1 |
| Outside, she at station, from the fields | 20 | **~30**: her ship 20, vanes 4, shutters 1, the chain 1 and cage 4 - or the far picture (one billboard) past the haze; halos 1, the beacon 1 at night, steam 1. The shadow costs no draw (it is in the cloud field's march) |

**Lights.** No net growth; the caps stand (16 on classic; the arm's lane list plus the deck's 24 nearest,
`createKetchDeckHost` `lightsNear(eye, 24)`). Removed: the six charged cradles' (`KT_GLOWS.cell`, range 4) and the seven
forks' (`KT_GLOWS.fork`) - their light becomes emission and a halo. Added: a light for each carried cell (range 4, at most
8 - the moving light through the dark hold, which today has none), the cabin's table lamp (cabin zone only), the chest's
gold for 3 s, and at most two landing flashes. Every glow is marked `carried`, so `world/eliteGates/egHall.js`
`egLightsWith` keeps it from casting (today's law, kept): no moving light records a cube. The 51 lamps (`ketchLights`: 23
on deck, 28 below) move, not grow: the gallery's ten wall lamps become six over the lanes, the hold's twelve become nine
hung from the ribs over the cradle rows and four round the engine - 48.

**Casters.** Nothing that moves casts (`everyLightCasts` would rebuild its cube every frame it moves): the cage, the vanes,
the flippers, the swinging lanterns, the hammers and every part posed by a clock are `noShadow`; a section casts only while it is
whole and still (`noShadow` from its warning until its return), so a cube rebuilds once when it leaves and once when it
comes back. Today the cage and the eight sections cast while they move. The PVS culls only parts whose shadows fall where
the eye's zone cannot see, and the static ship stays one draw that is never culled, so LA-SHADOW3's reason (no lamp lights
through the rock) holds.

**The PVS** (slice KL3; `world/ketch/ketchStates.js` `KT_PVS`). The eye's zone (`deckZoneAt`, held 4 m past the edge it
began at) names the part groups it can see, and the deck host's pose writes the rest `culled` - the dungeon loop's own
flag, which issues no draw and records no shadow (`scenes/worldModes.js`, the dynamic loop). **The decks** (the anchor deck,
the waist, the lift) see the open decks, the masts and the Sailwalk's dress; **aloft** (the top, the Sailwalk, the
gangway) sees those and the bridge; **below** (the gallery, the landing, the hold) sees the gun deck and the hold; **the bridge** sees the
bridge, the open decks and the Sailwalk; **the cabin** sees the cabin and the bridge. Within 6 m of a hatch, the lift's
foot or a doorway both sides' groups stand, so nothing pops through an opening. The static ship is one draw and never
culled; the land and the sky are never culled. A culled part's shadow falls only where the eye's zone cannot see -
the gun deck's hammers shadow no face the waist can see - so LA-SHADOW3's law holds. The Steps follow it through their new
`cull(on)` (element 8).

**Textures** (new, desktop, Classic textures): about 5 MB resident - the land's plate and windows 2 MB (512x512 each),
the Sailwalk's dress about 0.74 MB (kind atlases and the plates' stud frames), the sections' atlas 0.5 MB, her far picture
0.39 MB (8 headings at 192x64), the repaint's new records about 0.32 MB, the gauge faces, ornament and part records about
0.45 MB, the clouds 0.19 MB, the cabin 0.16 MB, the bridge's field and the shadow 32 KB; plus the Warden's frames uploaded
on demand (`uploadRecordFrame`, today's path), about 20 resident (at most 4.5 MB, typically 2). Retired: the arcs' four
frames, the steam's and clouds' puffs, and the painted ground wherever the data's land stands (about 0.7 MB). Committed:
the Warden's sheets about 2 MB, the Spider's about 150 KB, the Ketchmaster's flat about 40 KB. Phones carry about 1.6 MB
plus the Warden at half size.

**Painting.** About 130 ms of one-time CPU (the records about 90, the land about 30, her far picture about 10), spread over
idle frames after the deck's stand and the sky's first build - one record a frame on a phone, never a whole set.

**Added CPU a frame:** under 0.35 ms desktop, under 0.5 ms on phones: the states 0.02, the gauge instances 0.02, the
hammer mesh 0.04 (gun deck only), about 40 matrices 0.03, the line slots 0.01, the steam emitters 0.02, the cloud VBO
0.01, the read at 4 Hz 0.05, the fx 0.03, the air's and the score's law 0.05, her presence outside 0.03.

**Audio.** Seventeen songs, about 19,000 notes, made lazily (under 15 ms a song, about 1.2 MB of events); the made beds and
voices about 11 MB of PCM at 22,050 Hz desktop (the rigging 2.0, the hull 2.6, the keel 1.1, the engine's partials and the
cells' hums 1.5, the bridge's resonators and forks 0.6, the hazards 0.33, the voices 2.0, outside 1.2), about 3 MB on
phones (11,025 Hz, beds at half length); built one a frame, at most 10 ms each (the Spire's air's law, `egAir.js`).

---

## 1. Her coming and going, seen and heard from the world

### What the player sees

**Today** (`scenes/ketch/ketchSky.js`): she is drawn `noShadow`, dark but for her ports, still at station
(`ketchSkyPose` docked: `dx 0, dy 0, yaw 0`) and silent at every phase - `createKetchSky` has no audio. At night from the
fields (`e2e/sky_1.png`) she is a black pencil against the stars. Sighted, she starts `KT_SKY.approach` 6 km out, past the
exterior's haze (4 km at the enhanced default Land View 5, `world/landView.js`), so for most of the two hours she cannot
be seen. The chain is one 4-sided pipe scaled by the let-out length (`CHAIN[5] = place.let`), its texture stretched about
257 times into streaks. The held map's ring sits on Daggerfall's pixel whatever her pose (`ketchClient` `mapMark`: `cx` from
`cityRead().px`).

**Sighted** (`KT_SIGHT_MS`, two hours). From the walls, the streets and the fields, a dark brass whale-shape low in the
east, growing as she slows in, hazed toward the horizon's colour by distance but never under 35% of her own, so she never
vanishes. She is making way: her vanes bite, a plume of steam streams aft from her two stacks, and she bobs gently
(`KT_SKY.bob` 0.6 m on its 9 s, today's). At dawn and dusk the sun catches her brass: **one glint**, 0.4 s, at most once in
18 s, only while the sun stands within 40 degrees of the line from her to the eye (moment 1). By night she is **a slow
constellation coming in from the east**: two aether masthead lamps, the lamp-gold stern lantern, her lit ports and the
keel-light's blue line, none smaller than 3 px at 6 km.

**Her first sight** on this device this voyage - outdoors, within 8 km of Daggerfall, her middle within 35 degrees of the
view and above the horizon - **her horn** sounds once from her place, far and low: KT_CALL (A3 C#4 E4 A4 rising, then G4
held six beats - the call that never lands), 3D, reference 400 m, reach 9,000 m, tagged `far`. **Daggerfall's bells answer
her**: a peal of three bells (the ship's bell 107 at pitch 0.62, 0.70 and 0.83) in a falling round for 20 s from the
city's centre (reference 150 m, reach 2,500 m), at her sighting and again at her arrival. No music plays: the sighting
sting is left out by the owner's ruling 2.

**Arriving.** Over the sighting's last share she turns to her station's heading (bow south) and her horn sounds once
across the city. **The chain pays out** over 40 s (`KT_SKY.lower`): real links (0.35 m, every other one edge-on) with **a
ladder of lamps** - a brass guide-collar and lamp every 40 m, six in all - so by night a lit line runs from her bow to the
fields; its rattle runs from the cage (reference 30 m, reach 600 m); the cage lands with a thud and a grit burst and its
gate drops open.

**Keeping station** (seven hours - KETCH-EVERY; a day and a half when she came weekly): **asleep**. Her vanes feathered edge-on, her shutters half shut, one breath of
steam every 12.5 s, and **her keel's hum** filling the east fields - an A1 drone at her middle (reference 120 m, reach
1,600 m, linear), felt more than heard under her. **She keeps the real watch**: her ship's bell rings the UTC half-hours as
a ship's bells do - one bell at 00:30, two at 01:00 and so to eight at 04:00, in pairs (0.45 s within a pair, 1.1 s
between) - on the relay's clock, so everyone aboard any of her ships and everyone in the fields hears the same bell at the
same moment (the city keeps Tamriel's hours; she keeps ours). **By day on the lane her shadow** lies soft on the fields
under her at noon and, each morning, across Daggerfall's east quarter inside the wall (the owner's ruling 3). **By night
the anchor-lift hangs in a column of aether light** from her keel to the fields, a pool of blue round the cage, while the
lift is down and she boards (moment 2): "find the blue light east of the walls". Within 60 m of the lift a banner reads
*The Sky-Ketch Mzunthar* over *her anchor-lift - boarding until {time}* (SD19's door law, in her aether); within 450 m
**KETCHSKY** plays (the owner's ruling 2: the keel's pedal and her horn on the fields).

**Weighing anchor**: she wakes - her stacks blast, her vanes swing from feathered to biting, her horn sounds twice; the
chain comes up over 40 s, the lamp ladder climbing with it; she turns west over a minute (`KT_SKY.turnWest`), her hum
rising a fifth as she turns (a pitch ramp of 1.5 over the turn) and going with her; she gains way over the city
(`KT_SKY.accel` 0.012 m/s/s, `climb` 0.05 m/s), **her shadow crossing the streets** by day, her lights receding by night,
until she is a glint at the western horizon. **KETCHDEP** plays outdoors within 2.5 km of her while she weighs anchor (the
owner's ruling 2).

**On the map and the clock.** Her ring follows her (A, B, D): offset east by her `dx` on the map's scale while sighted,
with a dotted course in from the east; on her station at station; moving west, a course line out, as she leaves. It is a
gauge (C): its filled arc is her station's time left, full at her arrival, empty when she weighs anchor; inside it a small
ship glyph whose bow follows her yaw (B). The card under the pointer shows her small portrait (A), painted from her far
picture. The Timers row keeps its four phases; once this device holds a receipt for the voyage its line reads *Your crew
took her helm this voyage* (D). **The taverns** talk of her by phase (D): *"They say a brass ship comes over the east fields
at the week's turn."* (away); *"Something hangs in the east sky. The old men say it is Dwarven."* (sighted); *"The brass
ship's lift stands in the east fields. Stand in it and it takes you up."* (keeping station); *"The brass ship is turning
west."* (weighing anchor); and, once my crew felled the Warden, *"They say a crew took the brass ship's helm. Her song
rang true over the fields."* **On a device whose crew took her helm this voyage** her hum from the ground is the true
chord (A major: the keel's upper bed without its seventh) and her halos burn steady: the deed is heard in the world the
player returns to (D).

### How it is built

- **`scenes/ketch/ketchPresence.js`** (new), constructed by `createKetchClient` beside `createKetchSky` and framed from the
  client's `frame()` while the mode is the exterior; let go indoors as `windAudio` is (WIND3's law: every bed released, its
  events faded through `audio.fadeFar`). Its meshes draw from `ketch.drawSky(renderer)` (the exterior's existing seat,
  after the opaque street); its passes (halos, the beacon, the plume) from `ketch.drawPresence(proj, view, eye)`, reached by
  one term in the exterior's late-pass line (The hosts).
- **Her far picture.** At the sky's first build, `world/ketch/ketchBake.js` rasterizes her own mesh (`buildKetchShip` - the
  port's art, no game data) in 8 headings of 192x64, over idle frames a step at a time (`world/lowPolyTrees.js`
  `impostorSteps`' law), quantized to `KT_PAL` and resolved through the palette. It draws as one billboard whose record is
  picked by her yaw against the eye (a Daggerfall sprite's own facing rule) whenever she stands past the haze's far reach,
  its colour leaned to the sky's horizon by distance and floored at 35% of its own; inside the haze the mesh takes over
  through a 0.4 s dither (`renderer.setDissolve` around the mesh's draw in `drawSky`).
- **The glint**: one `sdHalo` quad at her sun-facing rim, white-gold, gated by the sun's angle, its 18 s slot seeded on
  the shared clock.
- **The lights**: `render/superDungeon/sdHalo.js` in the exterior, at most 24 quads - `ketchLampSpots().up` through her
  matrix (`ketchSkyMatrix`), the masthead and stern lanterns, the keel-light's three points, the cage's lamp and the
  ladder's six - each sized up with distance to stay at least 3 px. Her ports' glass swaps by hour (element 3).
- **The beacon**: the gate's beacon (`render/gate/gatePass.js`, its per-draw `beacon` - `{ below, height, start, color }`
  through `gatePassValues`), in `KT_GLOWS.cell` at 0.35, its foot at the cage, `KT_SKY_CHAIN` tall; drawn while the lift is
  down, she boards (`ketchBoards`) and `daylightScale` is under 0.3. The pool round the cage is a flat `sdHalo` quad on the
  terrain under it.
- **The chain**: `world/ketch/ketchModel.js` `buildKetchAnchorLift` builds a unit-link chain (8-sided links of 0.35 m,
  every other one turned) whose v runs a link every 0.5 m; its 8 UVs rewritten (`renderer.updateMeshVertices`) whenever the
  let-out length moves 0.5 m - only during the 40 s lowering and raising. The ladder's collars are a second small mesh placed
  per frame at fixed metres down the let-out length.
- **The plume and the breath**: `render/ketch/ktSteamPass.js` emitters at the stacks' heads, their rate `ktBreath`'s, their
  drift the voyage's wind.
- **The vanes** feather in the world as aboard (element 3): ASLEEP at station, biting while she moves.
- **Her shadow** (the owner's ruling 3): `world/ketch/ketchShadow.js` (new, pure) `ketchShadowArt()` paints a 256x64 R8
  silhouette (her hull's outline from `ketchHullOutline`, the vanes' spans, the bridge's disc) in three alpha steps with a
  dithered penumbra, and `ketchCasterOf(place, pose, out)` answers its rectangle, deck height and yaw. `render/
  volumetricClouds.js` gains one module-level door, `setCloudShadowCaster(c | null)`: while a caster is set, `SHADOW_FS`'s
  march multiplies a texel's transmittance by `1 - 0.65 x silhouette` where its ray from the ground toward the sun meets
  the caster's plane inside its rectangle. The field is re-marched on its own sweeps, so her shadow moves with the sun as
  the clouds' do; every surface already reads it through `render/cloudShadow.js` `cloudShadowAt` (the terrain, the
  characters and the air pass's shafts - "one field"). No caster set: the field is byte-equal. The classic set has no
  field (`uCloudShadowRect.w` 0) and draws none.
- **The sounds** (`systems/ketch/ketchSound.js`, new, pure synthesis over DAGGER.SND): `buildKeelHum` (A1 and A2 from
  AmbientStrumming 69 resampled to them, two copies 0.15 Hz apart; sines where the archive is not read), `buildKetchHorn`
  (`scenes/eliteGates/egCall.js` `buildEgHorn`'s method with KT_CALL's notes and a natural horn's partials), `buildChain`
  (the clunk, Parry6 433, laid 14 times a second at seeded pitches 1.1-1.6, low-passed at 5 kHz). The bells and peals are a
  pure function of the relay's clock - `scenes/ketch/ketchAir.js` `ketchBellsAt(t0, t1)` on `sdAirEvents`' slot law
  (KL9 rings them aboard first; here they ring from her bearing) - and the horn's moments are the
  phase edges `ketchVoyageAt` names, each owed once in its window as the herald's cards are. The lift's thud is FallHard (92)
  at 0.4 and DungeonDoorClose (24) at 0.5.
- **The map**: `scenes/ketch/ketchClient.js` `mapMark` moves `cx` by `pose.dx / 819.2` (a map pixel) while she is sighted
  or departing and adds `gauge` (her station's time left), `glyph` (her heading) and `course`; `ui/ink/inkMap.js`
  `paintGateRing` draws each when a mark carries it. `ui/ketch/ketchMapMark.js`'s tip gains her portrait.
- **The words**: the banner (`ketch.banner.*`), the rumours (`ketch.rumor.*`, five) and the Timers' line
  (`ketch.timers.helm`) through `t()` in `systems/ketch/ketchWords.js`; the rumours and the banner reach the world host by
  terms (The hosts); `systems/eventTimers.js` `ketchRows` reads this device's receipts (`net/ketch/ketchClaims.js`,
  page-side).

### Files and new modules

- **New:** `scenes/ketch/ketchPresence.js`, `world/ketch/ketchShadow.js`, `systems/ketch/ketchSound.js`,
  `world/ketch/ketchBake.js` (shared with element 10)
- **Changed:** `src/scenes/ketch/ketchSky.js` (the vanes, the chain, the far picture's hand-over, the riders' cages in
  element 2), `src/world/ketch/ketchModel.js` (`buildKetchAnchorLift`), `src/scenes/ketch/ketchClient.js` (`mapMark`,
  `drawPresence`, `rumor`, `banner`), `src/ui/ketch/ketchMapMark.js`, `src/ui/ink/inkMap.js`, `src/systems/eventTimers.js`,
  `src/render/volumetricClouds.js` (`setCloudShadowCaster`), `src/systems/ketch/ketchWords.js`, `src/scenes/world.js`
  (three terms)

### Cost

| | Today | After |
|---|---|---|
| Draws (GL), she at station | 20 (ship 15, chain 1, cage 4) | about 30 (vanes 4, shutters 1, the ladder's collars 1, or the far picture 1 past the haze) plus halos 1, the beacon 1 by night, steam 1 |
| Lights | 0 | 0 - the town's list untouched; her lights are emission and halos |
| Textures | - | the far picture 8 x 192x64 (393 KB), the shadow 256x64 R8 (16 KB) |
| CPU | the pose | the far picture's steps once (about 10 ms over idle frames); a frame under 0.05 ms (her matrices, 24 halos, 12 plume emitters, the bells' slot walk) |
| Audio | none | the hum 0.5 MB, the horn 0.4 MB, the chain 0.26 MB; at most 2-3 beds outdoors near her; at most eight strikes a half hour |

### Enhanced lane and classic set

- **Lane:** halos at gain 0.5 and the lane's bloom on them; the keel-light and the beacon bloom (L3); her shadow in the
  field, so the terrain, the bodies and the sun's shafts all darken under her.
- **Classic:** halos at gain 1.0 carry her at night; no shadow (the world's own law: classic has no cloud field).

### Phones

The far picture in 4 headings at 128x48; at most 12 halos (no port halos); 6 plume puffs; the ladder's six lamps and the
beacon kept (they are the read); her shadow where the phone's world draws its field; the hum and the chain at 11,025 Hz;
the horn and the bells kept.

### Lab check

The lab stands her over its own ground with `ketchSkyMatrix` (`?world=sighted|docked|departing&p=<share>`) and new
world-side views: `fields` (beside the lift's foot, 1.7 m up, looking up), `walls` (Daggerfall's east wall, 30 m up,
looking east), `street` (the city's centre, 20 degrees up), `far` (2 km west at her sighting).

| View | What must be true |
|---|---|
| `far&world=sighted&p=0.3&hour=12` and `&hour=2` | her far picture at least 6 px tall at 6 km by day; her lights at least 3 px by night; both under `?grey` |
| `walls&hour=6.5` | the glint fires at most once in 18 s (a probe over 60 s) |
| `fields&world=docked&hour=2` | the beacon lit at the cage's pixel; a halo at each projected lamp; the ladder's six lamps in a line |
| `fields&world=docked&hour=8`, `&hour=12` | (lane) her shadow's centroid where `260 x tan(zenith)` along the sun puts it: west of her in the morning, under her at noon |
| `?world=departing&p=0.6` | mid-turn; the map ring's `cx` moved west of her station |
| `?bells=8` | eight bells in four pairs on the lab's own context |

### Pins

`test/scenes/ketch_sky.test.js` extended (the chain's links a metre whatever its length; the far picture's hand-over at the
haze's reach; the halos' 3-px floor; the beacon only while she boards by night; the vanes feathered at station and biting
under way); `ketch_presence.test.js` (new: the bells heard outside on each of
`ketchBellsAt`'s strikes, from her bearing; the horn once a phase edge and never twice; the true chord from a receipt of this voyage only; the
rumour by phase; the map mark's `dx` and `gauge`); `test/render/volumetricClouds.test.js` extended (no caster: the march's
text and output byte-equal; a caster: transmittance falls only inside its projected rectangle). Mutants
`ketch_look_presence.json` (KTL-the-bell-rings-every-hour, KTL-the-shadow-off-the-sun, KTL-the-beacon-by-day,
KTL-the-ring-on-the-city).

---

## 2. The ride up and the arrival

### What the player sees

**Today**: standing in the cage `KT_BOARD_HOLD_MS` (2.5 s) while the chat counts down (`KT_SKY_TEXT.rising`), then a cut -
`enterKetch` is a dungeon transition with no veil. The first look (`arrive_hour12`) is a corridor between two 7 m
chain-link fences ending at a brick shed: no sky drop, no land, no height. The tutorial page `sky-ketch` opens over it.

The ride, as the owner ruled (about 3 s, the cloud inside):

1. **In the cage.** Its floor ring fills in aether, 12 segments over the 2.5 s hold: the countdown under your feet (the
   chat's count stays). The ship's bell strikes once a second (107 at pitch 1.6, short).
2. **The lift-off** (3 s, `KT_LIFTOFF_MS`). The cage's bar gate swings shut with a clank; the chain takes up and the cage
   dips 0.15 m; and **it lifts** - 0 to 6 m/s over 1.2 s, 14 m in 3 s - the fields falling away under its grated floor, the
   links rattling past overhead, the field's wind crossfading into her rigging's whistle.
3. **Her cloud** (the step's veil, `ktUp`). The sky's own colour at its foot (`ketchSkyFoot(minute)`) closes over the
   screen from the edges in 0.35 s, and while the level builds beneath it the veil shows the passage (moment 3): Daggerfall
   and its fields shrinking under the cage's grating, the chain racing down past the bars, the world going white in her
   cloud, her grooved belly and its keel-light filling the top of the screen. It opens on her deck in 0.7 s.
4. **The arrival.** You stand in the **arrival cage** on the Anchor Deck's lift disc (`KT_ANCHOR_LIFT`), its bar gate shut,
   its chain overhead swinging to rest (2 s, damped), the davit's pawl clacking three times; at 1.6 s (`KT_ARRIVAL_MS`) the
   gate drops into its slot with the bell. A breath of cloud vapour crosses the bow. The music held through the step (the
   Hour's AUDIT SD III A1 law): KETCHSKY on the fields becomes KETCHDCK on her deck with no dungeon song between. Her card,
   once a voyage: *Voyage {n}* over *The Sky-Ketch Mzunthar* over *She has not landed since her masters went*. **The first
   look**: rigging, not a fence - the land 260 m down and Daggerfall off the starboard beam through the cord; the board on
   the quarter wall, its voyage needle high and its engine glass empty; the vanes feathered aloft and a breath of steam.
5. **The page waits.** The `sky-ketch` tutorial page opens 8 s after the arrival (`KT_ARRIVAL_HOLD_MS`), never over the
   first look.
6. **Onlookers** in the fields see a crewmate rise in a cage, never float: a body standing in the lift's column above the
   field is drawn standing in a rider's cage.
7. **The way down** - the anchor-lift's way down and the stern lift: the reverse. The gate shuts, the cage sinks a metre,
   the veil (`ktDown`) runs the passage the other way, and you stand in the cage as it touches the fields. **A fall** (the
   made level's death save, `kt-fall`) takes the same veil tinted ember: forced, as the Hour's shattered veil says.

**Reduced motion:** no advection on the veil - a still of the fields from above, wiped by an ordered dither.

### How it is built

- **`scenes/ketch/ketchRide.js`** (new), constructed by the client. `liftOff(r)`: the cage a **mover** on the world's
  collider for 3 s (a bucket whose translation is read at every query - the deck cage's and the Steps' law, `scenes/
  superDungeon/sdSteps.js`), the body carried (`player/motor.js` `carryBy`); then the step under the veil through the mode
  machine's own door - `modes().stepThroughFire(() => modes().enterKetch(r), 'ktUp')` - in place of today's bare
  `modes().enterKetch` in the client's `board()`. `ketchBoards` is asked again at the top of the lift-off; a refusal at the
  door (`KT_DOOR_MS`) sets the cage back down over 1.5 s and says it (`ketchRefusal`), as today. The way down wraps
  `modes().ktLeave()` the same way with `'ktDown'`; the death save's fall with `'ktDown'` and `{ forced: true }`. No host line:
  `stepThroughFire` is already among the mode machine's reads (the Rift's step), and it unveils the step where no veil
  stands.
- **The veil**: `render/ketch/ktLiftVeil.js` (new), a program chosen by theme in `render/gate/gateVeil.js`
  (`GateVeilRenderer`, as `sdVeil` and the Spire's stair are), built lazily on its first cover (the `brass` theme its
  fallback if it will not build). One full-screen triangle on the veil's own canvas at one veil pixel per three device
  pixels (the Hour's sizing in `ui/gate/gateVeil.js`); a 128x128 R8 atlas made in code at its build (the cage's bars, a
  link, a field tile at three scales, the belly's grooves); the field drawn shrinking by `1/(1 + 9u)` (C), the chain
  scrolling, two octaves of value noise advected downward through the cloud band (A), lit from above, posterized to 6
  levels with `bayer4`. `ui/gate/gateVeil.js` `VEIL_THEMES` gains `ktUp` (9) and `ktDown` (10), and cues (the chain's run,
  the cage's clank, the bell). Closes 0.35 s, holds over the build, opens 0.7 s.
- **The arrival cage**: `buildKetchParts` gains `arrivalGate` (a bar gate about the lift disc's rim, with a collider as
  `gateHold` has), posed by the deck host from the client's `boardedAt`: shut until `KT_ARRIVAL_MS` (1,600 ms), dropped
  into its slot, gone for good after. A body is never held longer than 1.6 s, and the Watch's first wave waits twelve
  seconds after the first boarded - the law is untouched. The chain's swing is `ktSwell` with a decaying amplitude.
- **The riders' cages**: `ketchSky.frame` reads the peers the client holds (`deps.peers`); a peer standing within
  `KT_ANCHOR_LIFT.r` of the lift's axis and above the field draws the cage mesh (`buildKetchAnchorLift().cage`) at its
  feet - at most eight matrices, no wire, no law.
- **The page held**: one term in `scenes/dungeonContext.js`'s `noteFirstUse(...)` (The hosts): 8,000 ms on a ship.
- **The music held**: `scenes/ketch/ketchScoreHost.js` reads `modes()?.transitioning` (element 15).

### Files and new modules

- **New:** `scenes/ketch/ketchRide.js`, `render/ketch/ktLiftVeil.js`
- **Changed:** `src/scenes/ketch/ketchClient.js` (`board`, the way down, the fall), `src/scenes/ketch/ketchSky.js` (the
  lift-off's mover, the riders' cages, the ring fill), `src/world/ketch/ketchModel.js` (`arrivalGate`),
  `src/scenes/ketch/ketchDeckHost.js` (its pose), `src/render/gate/gateVeil.js`, `src/ui/gate/gateVeil.js`,
  `src/scenes/dungeonContext.js` (one term)

### Cost

The lift-off: one bucket for 3 s, the cage and chain (they exist). The veil: about 230k fragments at 1080p while it
stands (a quarter of the old brass whirl's cost, SD-LOOK S5's measure), 8 KB in the veil's own context; nothing reads back
the game's frame. The arrival gate: one part (about 200 triangles), one bucket for 1.6 s. The riders' cages: at most eight
draws while riders rise. Boarding takes 3.35 s more on the boarder's own screen; the relay sees none of it.

### Enhanced lane and classic set

Identical: the veil is its own canvas; the lift-off is the world's own frame.

### Phones

The lift-off in 2 s (9 m); the veil at one pixel per four device pixels, one octave of cloud; at most four riders' cages.

### Lab check

| Knob | What must be true |
|---|---|
| `fields&liftoff=0\|1.5\|3` | the cage at 0, 5 and 14 m with the painted ground falling away |
| `?veil=ktUp&vt=0.2\|1.0\|1.8`, `?veil=ktDown&vt=1.0`, `&forced` | closing; the cloud band mid-passage; opening on the deck; the fall in ember; with reduced motion forced, nothing advects |
| `arrive&arrival=0\|0.8\|1.6` with `?law` | the gate's collider stands until 1.6 s and is gone after |
| the sky-share probe at `arrive&arrival=1.6`, every hour | at least 40% of the frame's top half is sky or land, not net |

### Pins

`test/scenes/ketch_client.test.js` extended (boarding goes through `stepThroughFire` with `'ktUp'`; the way down and the
fall with `'ktDown'`, the fall forced; a refusal sets the cage down and boards nothing); `test/scenes/ketch_sky.test.js`
(the lift-off's height curve; the riders' cages only in the column); `test/scenes/ketch_deck_host.test.js` (the arrival
gate drops at 1,600 ms and never holds after; the ship's bucket untouched); the veil's theme pins beside the fire's and
the Hour's, theirs unchanged; `test/scenes/hostceiling.test.js` on the term. Mutants `ketch_look_ride.json`.

---

## 3. Her body whole

### What the player sees

**Today** (`side`, `bow`, `below`, `stern`): a slab-sided box. `buildKetchShip`'s hull is three rings - the deck's outline,
the bilge (x 0.94, at -14) and the keel (x 0.32, at -20, `KT_HULL`) - with a flat keel fin to -25. The clinker art
(`ketchHullArt`: 16-texel strakes) reads from inside the hold as bookshelves; the engine house is cool grey ashlar
(`KT_REC.stone`) with a barrel roof - a brick shed; the four fans (five blades each side of each mast, `buildKetchShip`'s
masts loop) are static triangles in copper mesh (`ketchVaneArt`, its darkest copper step) that read as maroon kites and
alias to moire on the flippers; every stay and shroud is a 0.04-0.05 m four-sided pipe (`R.chain`), sub-pixel past 20 m;
the ports are bright yellow squares at noon (`ketchGlassArt`'s emission ignores the hour, about 0.65); nothing on her moves.

**The brass whale.** The deck's outline stays (it is the law's), but below it the hull becomes **a lifting body**: six
rings - sheer, tumblehome, shoulder, belly, keel, fin - the keel dropping to -28 amidships and **sweeping up to -8 at bow
and stern**. Under her belly **fourteen grooves of Dwemer steel** run fore and aft like a rorqual's, the keel-light's aether
strips between them. Her stem rounds down into **a brass ram** under the bowsprit, with the two gear-glyph hawse discs
either side, unlit (nothing organic). Her stern counters round under the bridge.

**Plate, not brick.** Dwarven plate in courses, lapped and riveted, verdigris weeping only from the lower seams; a dark
keel band of rust and steel; **the Rourken script band** along the rub-rail with her name at bow and stern; the gilt
rub-rail kept. **Her ports** wear brass rims and **shutters - half shut while she sleeps, open when she wakes**; by day
their glass is dim (a fifth of its night glow).

**The engine house** is tan Dwemer stone with a fluted brass roof, fin crests along its ridge and a gear-glyph door, and
**two stacks** on its ridge - her blowholes - breathe her steam: every 12.5 s ASLEEP, 6 s AWAKE, 3 s SINGING.

**The vanes are fins that move.** Each of the four fans is pierced brass leaf on brass ribs, the sky showing through.
ASLEEP they stand **feathered** edge-on (70 degrees, their upper blades leaning forward, away from the jackstay that leaves
the main spar aft); as the crew feeds the engine they turn toward driving by its appetite (70 degrees less 50 times
`bk / nd`); AWAKE they **bite** at 20 degrees and breathe +-6 degrees with her breath; under way (sighted, departing) +-10.

**The flippers** are cambered on three steel ribs with brass panels, flexing +-3 degrees on the swell, an aether running
light at each tip. **The outrigger horns'** bells widen to 4.5 m and glow dim aether inside when she calls, and breathe
steam on the Keel-Song. **The rigging** is a web of lines that never thins under 1.5 px: stays as catenaries (eight
segments with sag), shrouds as chain with ratlines, dark and fogged. **Two weathervanes** of brass leaf - the main
masthead's and the cabin roof's - turn to the voyage's wind. **The eight lanterns nearest you swing** on their chains with
the swell (the rest hang still in the mesh: past 20 m a 3-degree swing of a 0.6 m chain is under a pixel).

### How it is built

- **The hull**: `world/ketch/ketchModel.js` `buildKetchShip`'s hull loop builds `ketchHullSection(t)` rings from the same
  `ketchHullOutline`; the grooves, the ram, the counter and the stacks in the static mesh; the hawse discs, fin crests and
  script band from `world/ketch/ketchOrnament.js`. Every new vertex lies outside every room's box in the deck plan and
  outside the collider's buckets - the hull's outer faces are drawn, never `solid` (pinned: below, `?law`).
- **The parts** (`world/ketch/ketchDressModel.js`, posed in `createKetchDeck.pose` aboard and in `createKetchSky.draw`
  outside, all `noShadow`): the four vanes (each turned about its own spar's axis by `ketchMotionAt`); the four flippers
  (flexed about their root line); the shutters (one mesh, slid 0.3 m by the state); the eight nearest lanterns (a pendulum
  on its hook, `ktSwell`, re-chosen when the eye moves 4 m); the two weathervanes. The ship's lights stay where they are
  (`ketchLights` unchanged).
- **The rigging leaves the mesh**: every `K.pipe(R.chain, ...)` stay and shroud goes to `render/ketch/ktLinePass.js` as a
  static segment; their sag a catenary sampled at eight points.
- **The art** (`world/ketch/ketchArt.js`, in index space): `hullPlate`, `hullBand` (the script), `hullKeel` (rust and
  steel), `hullInner` (the hold's walls: ribs, stringers, the plates' backs, pipe runs - no inside wall wears the
  outside's laps), `stoneDwemer`, `vaneLeaf` (pierced: alpha 0, `KT_CUTOUT_RECS` takes it), `belly` (the grooves),
  `keelLight` (emissive), `glassDay` (the ports' glass at 0.2 of its glow, swapped for `glass` by the ship draw's
  `texRemap` while `daylightScale` exceeds 0.6 - one kept remap object).
- **The breath and the plume**: `ktSteamPass` emitters at the stacks (element 1).

### Files and new modules

- **New:** `world/ketch/ketchDressModel.js`, `world/ketch/ketchOrnament.js`, `render/ketch/ktLinePass.js`
- **Changed:** `src/world/ketch/ketchModel.js`, `src/world/ketch/ketchArt.js`, `src/scenes/ketch/ketchDeckHost.js`
  (`pose`), `src/scenes/ketch/ketchSky.js` (`draw`)

### Cost

- **Triangles**: the static ship 14,021 today, about 19,000 after (the lifting body +3k, the grooves +1k, the ornament
  +1k, the rigging -1.2k to lines); records 15 to about 20.
- **Draws**: the vanes 4, the flippers 4, the shutters 1, the lanterns 8, the weathervanes 2 (all `noShadow`); the line
  pass 1.
- **Textures**: about 7 records at 64x64 x 2 (224 KB).
- **Lights**: none new. **CPU**: about 20 matrices, under 0.03 ms.

### Enhanced lane and classic set

- **Lane**: the static hull casts the sun's shadow as today; nothing that moves casts. The hull's rubbed edges catch a low
  sun; the keel-light and the horns' bells bloom at night.
- **Classic**: the same emission; halos at the running lights and the keel-light's points.

### Phones

Four hull rings (no shoulder, no fin); the grooves painted, not built; two vane parts (one a mast); the lanterns still;
the line pass at 2 px or more.

### Lab check

| View | What must be true |
|---|---|
| `bow`, `side`, `below`, `stern`, `above` at `hour=12\|19\|2` | the silhouette sheet, before and after; under `?grey` the hull's mean at most 0.30 against a sky at least 0.5 at noon |
| `side&stage=0` against `&stage=3` | feathered against biting; shutters half shut against open; a breath of 12.5 s against 6 s |
| a 60 Hz probe on each vane over a whole breath | no blade crosses the jackstay or the main top's ring |
| `?law` | no new vertex inside a room's box of the deck plan or the collider |

### Pins

`test/world/ketch_model.test.js` extended (the hull's six rings from the one outline; no new vertex inside a room's box;
`ketchColliderOf(buildKetchShip())` and every part's `hit` byte-equal to today's - the collider pin); `test/world/ketch/
ketch_look.test.js` (new: `ketchMotionAt`'s breath periods and the vanes' angle law, the feather never past the jackstay's
clearance); `test/world/ketch_walk.test.js` unchanged (the real ship on a real Collider and PlayerMotor). Mutants
`ketch_look_body.json`.

---

## 4. The open decks - the Anchor Deck, the waist, the quarter wall

### What the player sees

**Today** (`arrive`, `waist`, `waist-aft`, `city`): the 2 m deck tile repeats as a grid to the horizon (four shades, a
rivet glint at every plate corner - `ketchDeckArt`'s `step(Br, 4)` - measured to 0.71); the nets are a chain-link fence
(a 1 m brass diamond to a flat top at 7 m, `KT_NET_TOP`, measured 0.57-0.66 - as bright as the sky behind it); the
bulwarks a navy band (0.11); the cover three black crates and two capstans; the quarter wall a brick shed with a gilt door;
the spheres "drop from the rigging" (`ketchFight.js` `KT_DROP_M` 5) out of empty air and the Sentries and the Captain rise
through solid plate (`ktBodyAct`'s rise, `-2 x k`); from the `city` view, pitched 24 degrees down over the starboard rail,
Daggerfall cannot be seen.

- **Deck plates in courses** along the keel - 1 m wide, 2 m long, joints staggered - in four plate records mixed by a
  seeded map so no two neighbours repeat: plain tread; worn tread (a polish along the walk from the lift to the hatch); tread
  inlaid with a Rourken glyph; a drain plate (a brass grille at the bulwarks' foot every 6 m, a verdigris stain spreading
  from it). The rivet glints are gone (`step(Br, 2)`), the tread's relief halved. A brass keel-line inlay runs down the
  centreline, and **a compass rose** of brass inlay lies between the capstans at z 38, its long point aft at the bridge:
  the way on.
- **Rigging, not a fence.** The nets are brass cord on a 1.5 m mesh with 3x3 knots in the Dwarven ramp's darker steps,
  their top cord **sagging between the shrouds** (7 m at a shroud, 6.2 m mid-span); the 4 m posts become chain shrouds
  raking inboard toward the mastheads, with ratlines. The sky, the land and Daggerfall show through.
- **The bulwarks** in Dwarven plate with a verdigris sill and the script band at a metre; a Dwemer lantern every 8 m on a
  short chain. Inside their own thickness sits the deck's furniture - lockers, cleats, coiled chain hung on the shrouds,
  speaking tubes - never on the walkable floor, so neither a body nor a construct walks round any of it.
- **The cover** (inside `KT_WAIST_COVER`'s footprint, the law's): Dwemer capstans - domed brass drums with gear-glyph tops,
  steel bars, chain wound round them - and grated coamings with lifting rings for the hatch covers.
- **The quarter wall** is a façade of Dwemer stone between two pylons capped with dark resonators, its great gear-glyph
  door in the middle: brass with no light, still - closed, cold, forever. Set into the stone either side of the door is
  **the ship's board** (C): the tracker's whole page in brass and glass.
  - *Left of the door:* **the voyage gauge**, a 1.8 m dial whose needle falls from full at her arrival to its red pin when
    she weighs anchor, over 36 hours, and past the pin a red sector where a second needle runs her crews' last 20 minutes;
    **the crew lamps**, eight, places taken lit from the left - how many, never who.
  - *Right of the door:* **the six stage lamps** - passed lamp-gold, the present one breathing (0.5 Hz), the rest dark;
    **the Watch's three** - a standing wave's lamp ember, a broken wave's lamp-gold, the next breathing through its 3 s
    gap; **the engine's glass** - `nd` bands, `bk` lit aether; **the lift's dial** (element 7).
- **The Watch, seen and heard.** Each wave rings **"all hands"** - the ship's bell struck twice fast (D). Wave one: brass
  cradles hang in the rigging over the spheres' spots (`KT_WATCH_SPOTS`), full before the wave; the spheres are lowered on
  their drop-lines (B, C), landing with a clang and a ring of grit, the cradles swinging empty after. Wave two: the
  Sentries climb out of **round deck hatches that iris open** at their spots (B), an ember lamp ring round each while one
  rises. Wave three: the Watch-Captain climbs the hatch's stair under its grate - steam through the bars, the leaves heaving
  20 degrees (C) - the grate's collider never moving.
- **The way on.** As the Watch breaks, the hatch's bolt draws back, its leaves turn up (today's), **a lamp over it lights
  lamp-gold**, and one chime sounds (MakeItem 364 at 0.9, the Hour veil's open chime).
- **The hour on deck** (element 14): at dawn and dusk the low sun throws the nets' cords and the shrouds' lines across the
  plates (lane); at noon quiet plate under the vanes' moving shade; at night the lanterns' pools.

### How it is built

- **Art**: four deck plate records in one 128x64 atlas; the seeded map baked into the deck mesh's UV offsets (each 2 m
  cell offset into one of the four records' spaces - one record, no extra draw); `ketchNetArt` repainted at 48 texels a
  1.5 m cell, 2-texel cord, 3-texel knots; `ketchDeckArt`'s rivet glint and tread rows quieted.
- **Geometry** (`buildKetchShip` with the ornament kit): the bulwarks' furniture within `KT_BULWARK.t` of their inner face
  (pinned: every vertex at `|x| >= KT_WAIST.x1 - KT_BULWARK.t`, or at most 0.02 m proud of the floor); the keel-line and
  the compass as inlay 0.01 m proud (SD-LOOK's inlay law); the net's visible top cord a catenary - the collider's wall to
  7 m unchanged (nobody reaches 6.2 m: no run-leap, no levitation aboard, `systems/madeLevel.js`); the board's bezels
  (16-gon, about 600 triangles) in the stone.
- **The board**: `world/ketch/ketchBoards.js` `KT_BOARD_SITES` (the quarter wall's 14 instruments) and `ketchGaugesInto`
  from `ketchStatesOf`, drawn by `render/ketch/ktGaugePass.js`'s one instanced draw.
- **The Watch's fixtures**: the rigging cradles (one mesh of six hoops on the swell), the drop-lines (the line pass's
  dynamic slots, from each sphere's cradle to its body while `ktBodyAct` answers `rise` with `look.drop`), the Sentries'
  irises (a part each, opened over the 1.2 s before the body's `up` and closed after, their lamp ring by `texRemap`); the
  Captain's steam (`ktSteamPass`) and the leaves' heave (a visual turn of the grate's two leaf draws; the bucket untouched);
  the bell at the link's `wave` word (`fresh(w.at)`, the late rule).
- **The way-on lamp**: a lamp record on the hatch's coaming, `texRemap` dark or lit from the stage.

### Files and new modules

- **Changed:** `src/world/ketch/ketchModel.js`, `src/world/ketch/ketchArt.js`, `src/scenes/ketch/ketchDeckHost.js`,
  `src/scenes/ketch/ketchFight.js` (the rise's drop-line and iris)
- **New:** `world/ketch/ketchBoards.js`, `render/ketch/ktGaugePass.js` (shared from slice KL3)

### Cost

Static +2k triangles; the deck atlas 128x64 x 2 (64 KB); parts: the rigging cradles 1, the Sentries' irises 3, the
way-on lamp a remap (all `noShadow`); the board 14 instances inside the one gauge draw; drop-lines at most 12 line slots
for 1.2 s a wave. Lights: none - the lanterns are `ketchLampSpots`' lamps.

### Enhanced lane and classic set

- **Lane**: the grade holds the deck at L1; the board's needles and lamps bloom; the nets' and shrouds' shadows on the
  plates at a low sun (the cutout in the depth replay - checked below).
- **Classic**: the art's own contrast; halos on the board's lit lamps and the lanterns.

### Phones

Half the furniture; the irises kept (they are the read); the nets' sag kept (it is geometry); the board whole.

### Lab check

| View | What must be true |
|---|---|
| `arrive`, `waist`, `waist-aft`, `city` at `hour=6\|12\|19\|2` | the ladder probe: the floor at noon mean at most 0.22, p95 at most 0.30, no texel over 0.5; at night mean at least 0.06; `city` shows Daggerfall through the net |
| `board&stage=2&bk=3&nd=5&crew=6&voyage=0.4&wv=2` | three bands of five lit; six crew lamps; the third stage lamp breathing; the voyage needle at 40% |
| `waist&watch=1&rise=0.5`, `&watch=2&rise=0.6` | spheres on their lines, cradles swinging; irises open with their ember rings |
| `waist&hour=7` (lane) | the deck under the nets shows the cords' diamonds, not a wall's shadow |
| `?law` | no furniture on the walkable floor; no new collider |

### Pins

`test/world/ketch_model.test.js` (the furniture's band; the nets' collider unchanged); `ketch_boards.test.js`
(new: every site's place inside its wall's face; each gauge's value from `ketchStatesOf` over a voyage run whole through
`test/net/ketch/ketchSim.mjs`); `test/scenes/ketch_fight.test.js` (the rise: a drop-line for a sphere, an iris for a
Sentry, never a body under the deck's top while visible). Mutants `ketch_look_decks.json`.

---

## 5. Below decks - the Gallery of Hammers, the Wardens' landing, the hold

### What the player sees

**Today**: black - `gallery`, `hold`, `engine` measured at a whole-frame p50 of 0.003-0.005 at every hour, and
`gallery_hour12` is `gallery_hour2` byte for byte. The wall lamps every 12 m (range 9) leave a 24 m hold's middle unlit;
the iron ramp tops out at [86, 86, 92]; the below fog is dark brown (`KT_BELOW_FOG` [0.1, 0.08, 0.05]). The hammers' shafts
read as a crypt's pillars; the steam is grey hexagons hanging in the air (`e2e/gallery_1.png`); the telegraph slab clips to
white; the hold's walls read as bookshelves; the arc is a one-pixel scribble swapping four frames 16.7 times a second; and
nothing makes a sound.

- **Light where it means something.** Each hammer row carries a caged lamp under its middle housing, so each lane is lit
  from above and each slam lands in its own pool; the hold has lamps hung from its ribs down the middle over the cradle
  rows and a ring of four round the engine. The far end dissolves into warm haze, never black. Structure stands at L1
  (p50 at least 0.08) wherever you stand, at every hour.
- **The Gallery of Hammers.** Dwemer drop-hammers: a brass head with a gear-glyph face, a fluted steel piston in a brass
  sleeve, and on each housing **a counterweight wheel** that turns as the head hauls up, and **a small dial** whose needle
  climbs through the head's 1 s draw-up (`KT_HAMMER.wu`). The housing exhales steam as the head hauls back. Each landing:
  **an anvil's ring** you hear, grit and brass sparks at the head, a small shake within 4 m, the row's lamp swinging.
  **The song is the hammers' metronome**: KETCHGAL's bar is their 3.0 s cycle, so every beat is a slam somewhere in the
  room (element 15).
- **The ports keep the hour.** Each gun port stands open a hand's width: by day **a blade of daylight** slants through it
  across the plate, dust turning in it; amber at dusk; moonlight, faint, at night. The guns are Rourken thunder-guns -
  banded brass barrels with gear-glyph breeches and a brass ring at the port - the Thunderlock's great cousins, catching
  the port light.
- **The steam lanes are walls of steam.** Through the 0.9 s wind-up (`KT_STEAM.wu`) the pipe's valves shudder and whistle
  and two jets leak from the floor vents, a curtain growing to knee height; live (1.2 s), **a dense warm-white wall** from
  the floor to the ceiling across the corridor, lit by the lamps, with the fire telegraph's lane under it unchanged; at
  its end it breaks upward and is gone in 0.3 s - it never lingers looking live.
- **The Wardens' landing.** A brass threshold strip crosses the gun deck at z 98 (`KT_WARDEN_WAKE_Z`) under two dark lamps:
  past here they wake. The Hammer Wardens stand asleep at their posts - dim, a lazy puff of steam from their backs every
  3 s; woken (the link's `wk`), a blast of steam, the lamps light and their eyes catch.
- **The hold is her belly.** Steel ribs and stringers with pipe runs along them - no bookshelves - the cradles as charging
  yokes (element 6), the engine's light owning the room (ember-dim while it starves, flooding aether as it drinks).
- **The arc-coils** are copper windings topped by **coherer spheres**. Through the 0.8 s wind-up (`KT_ARCS.wu`) each coil's
  glass fills from the foot and its spheres brighten and crackle; live, **the bolt crawls** between the spheres for its
  1.4 s - three texels wide, smooth and steady, never flickering - sparks raining at both ends, its light on the floor
  (`KT_GLOWS.arc`).
- **The spider vents** are round gear-glyph grilles with an oil stain under each; they **breathe ember and rattle** in the
  second before each pour, and **iris open** as the spiders spill out.
- **Close air**: gold oil-dust turning in the lamps' cones, steam droplets falling slowly in the gallery, the engine's
  stroke under everything; the gun deck sounds like an iron hallway and the hold like an iron tube.

### How it is built

- **The light** (`world/ketch/ketchAtmos.js` below decks; slice KL1): `ketchLampSpots` moves the gallery's ten wall lamps
  to the six middle housings (`KT_HAMMER.rows`, x 0; the landing's four stay) and the hold's twelve wall lamps (x +-11.7,
  range 9) to nine hung from the ribs (x -7, 0, 7 at z 112, 119, 126) and four round the engine - 51 lamps become 48;
  the ambient below [0.26, 0.21, 0.16] (from `KT_LIGHT.below` [0.22, 0.18, 0.14]), the fog [0.16, 0.12, 0.08] at density
  0.012; the trilight's ground term warm. **The grade below** (`renderer.setSceneGrade` from the deck host's `frameLook`):
  key 0.14, max 1.5, bloom 0.75, vignette 0.34, contrast 1.08. **Settled**: A held the eye down (max 1.3) because the
  lane's adaptation (`AIR_ADAPT_MAX` 1.8) opened the dark gallery until the additive telegraph core clipped to white
  (`e2e/gallery_1.png`); B opened it (max 2.4) because the hold is black. The structure is lifted by light (the lamps and
  the ambient), not by the eye, so the eye opens only to 1.5 - and the ladder probe judges both at once: p50 at least
  0.08 and no telegraph core clipped (p99 under 0.98).
- **The hammers become one mesh**: the 18 heads (and their wheels, a second mesh) rewritten each frame from `hammerHeadY`
  (`world/ketch/ketchPose.js`) while the gun deck is in the PVS, `noShadow` - 36 GL draws become 2 (C). A wheel's angle is
  its head's height over its radius: pure of the law's clock. The housings are cylinders in the static mesh; their dials
  are 18 gauge instances (`ketchStatesOf`'s hammer shares). The exhaust: `ktSteamPass` emitters at the six hammers nearest
  the eye, keyed to the haul.
- **The slams**: the fight already walks `hazardsBetween` for the gallery (`ketchFight.frame`); the same landings feed
  `ketchFx` `slam` bursts within 20 m and the shake door (`betterAmbience.weaponKick`, under the player's own maximum).
- **The shafts**: `render/ketch/ktShaftPass.js` (new) - ten prisms of hard light (`KT_GUN_ZS` x two walls) from each port
  to its floor patch along the sun's or the moon's direction, additive, posterized to 4 steps under `SD_PIXEL_GLSL`,
  coloured by the hour (`ketchSkyFoot`, `daylightScale`), depth-tested, fogged by the below fog; one draw. The ports' glass
  three records (day, dusk, dark) by `texRemap`.
- **The steam walls**: `ktSteamPass`'s kind `wall`, 64 particles a lane, their height and density from `hazardState('steam',
  j, t)`'s `warn`, `k` and `live` - the law's own clock. The deck's `steam` billboard batch and `KT_STEAM_PUFFS` retire.
- **The arcs**: `render/ketch/ktArcPass.js` (new) replaces the four-frame swap (`D.arcs`, `KT_REC.arc0..3` retire): each
  live arc a 64-segment strip between its spheres, displaced by two octaves of value noise scrolled along it at 1.5 m/s,
  three texels wide, an aether core of constant brightness through its span; one draw for all three. The spheres' glow is a
  `texRemap` of three records through the wind-up; the coils' glasses are six gauge instances; sparks are `gateFx`
  `sputter` at both spheres.
- **The vents**: four iris parts, opened on a spider's `up` (`ktBodyAct`'s `rise`); their breath a gauge lamp at the
  predicted pour (`ketchStatesOf`); the rattle a cue.
- **The Wardens asleep**: their wash at 0.75 until `wk` (C), `ktSteamPass` emitters at their backs; the threshold strip
  inlay and its two lamps by `texRemap`.
- **The hold's walls**: `KT_REC.hull` inside the hold becomes `hullInner`.
- **The motes**: `render/ketch/ktMotes.js` (element 14) - `dust` in the lamps' cones, `droplet` in the gallery.
- **The sound** (element 15): every hazard on the law's clock, the beds, the reverb zones.

### Files and new modules

- **New:** `render/ketch/ktShaftPass.js`, `render/ketch/ktArcPass.js`, `render/ketch/ktSteamPass.js`
- **Changed:** `src/world/ketch/ketchModel.js` (`ketchLampSpots`, the hammer and housing, the guns, the coils, the vents),
  `src/world/ketch/ketchArt.js`, `src/scenes/ketch/ketchDeckHost.js` (the merged hammers, the arcs, the steam, the
  `frameLook` grade), `src/scenes/ketch/ketchFight.js` (the Wardens' wash)

### Cost

- **Draws**: hammers 36 to 2, wheels 1; shafts 1; arcs 3 meshes to 1 pass; steam 1 pass (the billboard batch retired);
  coherer spheres 3; vent irises 1.
- **Lights**: the lamps moved (51 to 48); the arcs at most 3 while live, the engine 1, as today.
- **Textures**: the arc frames retired (128 KB); about 5 records at 64x64 x 2 (inner hull, gun, hammer face, coherer x3:
  160 KB).
- **CPU**: about 1.4k hammer vertices rewritten while the gun deck is in view (about 0.04 ms); the steam emitters 0.02 ms.

### Enhanced lane and classic set

- **Lane**: the grade below; the shafts carrying the air pass's scatter in the below fog; the lamps' pools casting the
  guns' and housings' shadows (static casters).
- **Classic**: the brighter ambient and fallback ramps carry L1; the shafts' quads are the light; halos on the lamps and
  the coherers.

### Phones

No shafts (the ports' glow only); 32 particles a steam wall; two exhausts; arcs at 32 segments with no sparks; the vents'
breath and the hammers' dials kept (they are the read).

### Lab check

| View | What must be true |
|---|---|
| `gallery`, `landing`, `hold`, `engine`, `lift` at `hour=12\|19\|2` | the ladder probe: p50 at least 0.08, p90 at most 0.5; `gallery_hour12` and `gallery_hour2` now differ (the shafts) |
| `gallery&hazard=hammer&wt=0.6` | each dial and each head at 60% of its draw-up together; the contrast probe: the telegraph core at least 0.7 and under 0.98 |
| `gallery&hazard=steam&wt=0.5\|live` | the curtain at knee height; the wall floor to ceiling with its telegraph core readable through it |
| `hold&hazard=arc&wt=0.5\|live` | the glass half full; the bolt steady |
| the flash probe on a live arc and a coherer, 60 Hz for 4 s | at most 3 transitions a second at any pixel |

### Pins

`test/scenes/ketch_deck_host.test.js` (the merged hammers' heads at `hammerHeadY` for every row and lane; the wheel's angle
from the head; the steam wall's height from `hazardState`; no arc frame swap); `test/world/ketch_model.test.js` (the lamps'
count and places; every lamp outside every collider); `ketch_atmos.test.js` (new: the below row's values;
the grade written only below). Mutants `ketch_look_below.json` (KTL-the-arc-swaps, KTL-the-wheel-off-the-head,
KTL-the-steam-lingers).

---

## 6. The cells, and the engine waking

### What the player sees

**Today**: a charging cradle shows nothing for its 20 s (`KT_CRADLE_BACK_MS`), only the HUD's tally; a loose cell lies at
a fixed yaw (`l[0] x 1.3`) and vanishes at its `until` with nothing shown; my own cell is drawn 0.5 m ahead of my feet at
0.85 m (`ketchClient.carried`), below a first-person view; the engine's only read is a point light, 0.25 to 1 by `bk / nd`
(`KT_GLOWS.engine`), and its waking is one chat line (`KT_WORDS.engineFed`, `e2e/hold_1.png`) - nothing in view changes.
Each of the six charged cradles takes a point light while the cell in a carrier's hands, the one that moves through the
dark, has none.

- **A cradle is a charger.** A brass yoke on a steel base with two arc-prongs and **a glass sleeve**. Charged: the cell
  stands in the sleeve, full of aether, its clamp shut. Taken: the sleeve is empty and **aether rises in it from the foot**
  over 20 s (12 s on the bridge, `KT_BRIDGE_CRADLE_BACK_MS`), a thin arc crawling between the prongs; full, the cell
  dithers in and the clamp shuts with a clack. From across the hold you read which cradle is next.
- **The carry, in both hands.** Your cell **enters your view from below** as Daggerfall's weapons do (your weapon is put
  up while you carry, `scenes/ketch/ketchClient.js` the burden), held at the bottom-centre, bobbing with your stride, its
  aether lighting the deck round you; a low hum follows you. A crewmate's cell is a blue light at its chest.
- **Knocked loose.** The cell flies from your hands in a short arc to where the room says it lies, with a glass clatter
  and sparks; lying, **its glass drains** - full to empty over its 15 s (`KT_CELL_LIES_MS`) - its last 5 s ember,
  faltering twice a second through its last 2; bled out, it cracks, a puff of blue vapour escapes, and it dithers away.
- **Set in a socket.** A copper pedestal and a brass clamp-ring, dim ember while the engine starves. The cell drops in, the
  ring turns shut, **a pulse of aether runs up the socket's pipe** into the drum, one more band lights round the drum, the
  flywheel kicks a quarter turn, and **the engine's hum gains a partial** - you hear it fill (element 15). The beat, once.
- **The Starved Engine** is a drum of exposed gear trains round **a band of window slots** (`nd` of them, 4 to 7, one lit
  aether a cell set - how many, never which), **an eye** on its crown facing aft (a round crystal, ember and dim while it
  starves, breathing slowly at 0.4 Hz, turning toward aether by the share set), **four pistons** stroking with her starved
  bar (the stroke on beats 0 and 2.5 of five, the stroke on 4 missing), and **a flywheel** that twitches a quarter turn and
  falls back - it tries. On deck, while it drinks, her vanes turn toward driving and her stacks' wisp thickens: the whole
  ship drinks.

**THE ENGINE WAKES** (moment 4), about ten seconds from the stage's turn (`V.sga`), seen and heard from every deck at
once, in time with KETCHWAK (two bars of five, then six):

| s | What happens |
|---|---|
| 0.0 | the last clamp shuts; every band aether; **the eye flares white-gold** (the beat) and settles to aether; KETCHWAK's first bar, the tuba stumbling in five |
| 0.3 | the pistons stroke hard; the flywheel begins to spin up; the mill's machinery rises (pitch 0.5 to 0.8 over 3 s) |
| 0.6 | every socket pipe pulses into the drum together; every vent in the hold purges steam |
| 1.0 | **aether climbs the copper pipes** from the drum into the ceiling (to 2.5 s) |
| 2.5 | the hold's lamps **dip to 40%** - the engine drawing - then surge over 1 s to 120% for 2 s and settle: one dip, one surge, never a blink; the ship trembles (1.2, falling over 3 s) |
| 3.5 | **the mast-lift's tower lights from the hold to the top**: aether lamps chase up its four corner posts, sixteen a post, a tenth of a second apart; its gates' bolts throw and the cage's lamp lights aether |
| 5.0 | **the sixth stroke lands** (KETCHWAK's bar 2; the meter turns to six): ship-wide, every lamp steps up, the shutters open, the vanes swing from feathered to biting over 2 s, the stacks blast a column 25 m high, her horn sounds KT_CALL, the keel-lights run bow to stern, the board lights its third stage lamp and fills the engine's glass; the card: *The Starved Engine* over *Wakes* over *The mast-lift rises to the main top* |
| 8.0 | A major, its third restored; the flywheel at a turn in 2 s; the pistons on the fed stroke |
| 10.0 | the ring dies; the score passes to the place's song |

The lift itself runs on the law's clock (`liftYAt(t, sg >= KT_STAGE.sailwalk)`) whatever the beat shows. A page that comes
later than 3 s finds the engine fed and at rest - every track is a pure function of `sga`.

### How it is built

- **The states** (`ketchStatesOf`): the cradles' fills, each loose cell's time left, the appetite and the partials, the
  waking's age (The shared kit).
- **`scenes/ketch/ketchWake.js`** (new, pure): `ketchWakeAt(sinceMs, out)` answers the beat's tracks - `flash`, `flywheel`,
  `pistons`, `flowK`, `lampK` (the dip and surge), `shake`, `chase`, `shutterK`, `vaneK`, `stack`, `horn`, `card` - read by
  the deck host's `pose`, `ketchFx`, `ketchAir` and the score.
- **Parts** (`world/ketch/ketchDressModel.js`): the eight sleeves as one static mesh (a cutout glass record with brass
  hoops); the seven clamp rings as one mesh rewritten only when a socket changes; the eye with five records from ember to
  aether by `texRemap`; the flywheel moved out of the static mesh and turned by `ktStroke`; the four pistons; the band ring
  and the sleeves' levels as gauge instances; the pipes' flow an eight-frame emission record stepped four frames a second
  (one pulse passes a pixel every 2 s); the tower's chase one mesh of 64 lamp boxes with eight records of its progress.
- **The cells**: five fill records (`KT_REC.aether0..4`, `lightGlassArt` at five levels) and an ember record by `texRemap`;
  a loose cell's from `(cl.lo[j][4] - now) / KT_CELL_LIES_MS` (pure of the room's word, so a late page shows the right
  level); the falter `falter(t, k)` at 2 Hz. The toss: the loose cell's draw interpolates from the carrier's last drawn
  place to the room's `lo` point over 0.35 s on a 0.8 m arc, from the `drop` word; `ketchFx` `crack`.
- **My carried cell in view**: drawn by the deck host in view space - its matrix the camera's inverse times a held offset
  (0, -0.32, 0.46) with the weapon rig's own bob - after the world's opaque pass; drawn in the world at my chest only in
  third person. A carrier's light (range 4, `KT_GLOWS.cell`) for each carried cell, marked `carried` so it casts nothing.
- **The cradles' lights retire** (six point lights): their glass is emission and a halo.
- **The engine's light** reaches 18 m once fed (today 14); the hold's lamp gain follows `lampK` through `lightsNear`
  (written in place).
- **The shake** through the shake door, once, from the turn.

### Files and new modules

- **New:** `scenes/ketch/ketchWake.js`, `scenes/ketch/ketchFx.js` (first used here)
- **Changed:** `src/world/ketch/ketchModel.js` (sockets, cradles, the drum, the tower's lamps), `src/world/ketch/ketchArt.js`
  (fills, eye, flow, chase), `src/scenes/ketch/ketchDeckHost.js` (`pose`, `lightsNear`, the view-space cell),
  `src/scenes/ketch/ketchClient.js` (`carried` in third person only)

### Cost

- **Draws**: sleeves 1, clamp rings 1, the eye 1, the flywheel 1, pistons 4, the tower's chase 1, my cell in view 1; the
  band ring, sleeves' levels and pipe pulses inside the gauge draw.
- **Lights**: -6 (the cradles), +1 to +8 (carried cells, `carried`, casting nothing).
- **Textures**: about 180 KB (fills, eye, flow frames, chase records).
- **CPU**: the states under 0.01 ms; the clamp mesh rewritten only on a change; the wake's tracks a pure function.

### Enhanced lane and classic set

- **Lane**: the eye's flare, the pipes' flow and the sleeves bloom (L3-L4); a carried cell's light on the hands and the
  deck.
- **Classic**: halos on the eye, the sleeves' tops and every carried cell.

### Phones

Two pistons; the flow at two frames; the chase in four steps; all the reads kept.

### Lab check

| Knob | What must be true |
|---|---|
| `hold&stage=2&cr=1,0.25,1,0.8,1,1&bk=3&nd=5&lo=3:8` | sleeves at 25% and 80%; three of five bands lit; a loose cell half drained |
| `&lo=3:1.4` | the cell ember and faltering; the flash probe at most 3 transitions a second |
| `?view=carry` at 16:9 and 9:19.5 | the cell at the screen's bottom-centre, whole |
| `?wake=0\|0.9\|2.6\|3.6\|5\|8`, and `waist` at the same `?wake` | each row of the beat, and on deck the vanes and the shutters at 5 s |
| the flash probe over the whole waking | every light step at 2 Hz or less; one dip and one surge |
| `?grey` | charged, empty, draining and ember told apart by level and motion |

### Pins

`ketch_states.test.js` (KL3's, extended over a voyage run whole through `ketchSim.mjs`: each fill reaches 1 at its
`backAt`, each bleed reaches 0 at its `until`, the appetite steps at each `bank`, the waking's age from `sga` and never
from the page's hearing); `ketch_wake.test.js` (new: every track's envelope; a late page past 3 s gets
the fed rest; the lamp's dip and surge are one each); `test/scenes/ketch_deck_host.test.js` (the cradles' lights gone;
the carried lights marked `carried`). Mutants `ketch_look_cells.json` (KTL-the-sleeve-fills-down, KTL-the-cell-drains-late,
KTL-the-lamps-blink).

---

## 7. The mast-lift, the main top, the yard

### What the player sees

**Today**: a dark box in a closed iron shaft, silent; `lift_hour12stage3` differs from stage 0 by a navy patch; the dead
cage's lamp burns (the cage part's `R.lamp` box is emissive whatever the engine does); the lift's 32 s round
(`KT_LIFT_CYCLE`) shows nowhere; the cage casts while it moves; and the lab's `top` view stands at x 5 against the top
gate at x 5.85, its bars filling the frame (`top_hour12`).

- **A lift dial at each gate**, the hold's and the top's: its needle runs the cage's 32 s round on the shared clock, and the
  7 s the cage stands open at this landing is a lamp-gold sector - "the cage is here in nine seconds" at a glance. **A lamp
  over each gate**: dark while the cage is away, lamp-gold while it stands open here.
- **Dead** (the engine starving): the cage at its foot with its lamp out, the dials stopped at their red pins, the gates'
  bolts cold iron.
- **Running**: the cage's lamp aether; **a counterweight** runs down the tower's outer face as the cage rises and up as it
  falls, so from the waist you see where the cage is; the head sheave turns; **lit ports every 4 m** up the tower pass the
  cage's grating window by window as it rises - the hold's dark, the gun deck's lamps, then the waist and the open sky; a
  ratchet clicks as it climbs, a bell strikes at each landing, the chain runs, and **the wind rises with the cage** (the
  rigging's gain by the ear's height, from 0.05 at -12 m to 0.32 at +16 m).
- **Out of the shaft** (moment 5): the cage stops at the top, its gate lifts, and the view is 276 m of air - the
  Sailwalk's spars hanging from the jackstay along her port flank and stepping away aft, the bridge's disc and its
  pipe-forks far aft over the engine house, Daggerfall to starboard, the land and its clouds under it all. The collar's
  thick black posts become slender brass stanchions and the cord net. KETCHSAL begins.
- **The main top** wears a ring of lanterns. **The bosun's post** is a Dwemer davit with a pulley wheel that spins while
  someone rides; its lamp is dark until the bridge unbars, then lamp-gold, with a lamp-gold beacon over it for 10 s (8 m,
  settling to 3 m).
- **The yard** is a brass gangplank with a chevron tread and the gold edge line along both sides; walking out, the wind
  rises and the hull falls away under the rail.

### How it is built

- **The state**: `ketchStatesOf`'s lift - the phase in the round (`liftYAt`: at the foot 0-7 s, rising 7-16, at the top
  16-23, falling 23-32), whether it runs (`sg >= KT_STAGE.sailwalk`), and `ketchShaftGates`' answer.
- **Dials and lamps**: four gauge instances (`KT_BOARD_SITES`: the hold's dial lights the sector [0, 7), the top's [16, 23)).
- **Parts** (`world/ketch/ketchDressModel.js`, all `noShadow`): the counterweight, a 1.2 m steel box at
  `KT_LIFT.y0 + KT_LIFT.y1 - cageY - 3`; the head sheave, turned by the cage's travel; the cage itself `noShadow` (today it
  casts), its lamp record by `texRemap` (dark or aether); the davit's wheel, turned while the link says a rider is on the
  line.
- **The tower**: a port record every 4 m on its walls (the walls' collider quads unchanged, `KT_SHAFT`); the waking's chase
  lamps on its corner posts (element 6). The collar's and the main top's posts at r 0.04 in brass, their net the cord art
  (element 4).
- **The beacon**: `render/superDungeon/sdStompWall.js`'s strip under `sdHomeBeacon`'s law in LAMP, keyed to the link's
  `br.at` (the bridge unbarred).
- **The sounds** (`scenes/ketch/ketchAir.js`): the chain bed at the cage while `liftYAt` moves; the ratchet (Parry6 433 at
  pitch 1.2, four a second); the bell at each landing; the clank of the gates (24 at 0.6 with 433 at 0.8); `ktRigGain(zone,
  y)` pure.
- **The lab's `top`** becomes `top-out`: the eye at (9, 17.7, 51.5), yaw 120.

### Files and new modules

- **Changed:** `src/scenes/ketch/ketchDeckHost.js` (the cage `noShadow`, its lamp, the counterweight, the sheave),
  `src/world/ketch/ketchModel.js` (the tower's ports, the stanchions, the davit), `world/ketch/ketchBoards.js`,
  `src/tools/ketchLab.js` (`top-out`)

### Cost

Draws 3 (the counterweight, the sheave, the davit's wheel) and 4 gauge instances; the beacon for 10 s; one ports record;
lights none; the cage stops recording shadow cubes as it moves. CPU: 3 matrices.

### Enhanced lane and classic set

- **Lane**: the cage's shadow is gone from the lamps' cubes (the perf overlay's shadow column drops while it runs); the
  ports' light sweeps the cage's floor.
- **Classic**: halos on the gate lamps and the cage's lamp.

### Phones

The counterweight kept (it is the read); the sheave without teeth.

### Lab check

| View | What must be true |
|---|---|
| `lift`, `lift-top`, `top-out` at `stage=3&lift=4\|12\|20\|28` | the cage at its foot and open, rising, at the top and open, falling; the dials' needles and lamps agree with `ketchShaftGates` |
| `lift&stage=2` | dead: lamp out, dials at their pins |
| `lift-ride&lift=7..16` | the ports' light passing the grating; the waist and the sky at mid-rise |
| the sky-share probe at `top-out`, every hour | at least 50% of the frame is sky or land |
| the shadow probe over a rise | no cube face records the cage |

### Pins

`test/scenes/ketch_deck_host.test.js` (the counterweight the cage's mirror; the cage `noShadow`; the dead lamp dark);
`ketch_boards.test.js` (the dials' sectors are `liftYAt`'s landings). Mutants `ketch_look_lift.json`.

---

## 8. The Sailwalk

### What the player sees

**Today** the Sailwalk wears the Shattered Hour's dress: `scenes/dungeonContext.js` stands the Hour's Steps on the Ketch's
course (`createSdSteps({ course: KT_COURSE, renderer, audio })`) with clock-plates whose hands sweep backwards, pendulum
rods to gears floating 18 m up, waystones with the Hour's sign, a vane with no sign, and the Hour's sounds
(`SD_STEPS_SOUNDS`: the Beat's tick, the crumble's grind, the breath's wind, the void's moan). The land under it is a pale
checkerboard brighter than her hull (`ketchGroundArt`: square plots on a 420 m tile with a sine river); the nets that catch
a fall are never drawn; the bosun's line is a black chain of pipe segments. Her course (`net/ketch/ketchDeck.js`
`KT_COURSE`, the Hour's and the Spire's course law) is nineteen steps - six drifts, five Beat plates, a riser, seven
crumbling planks - with checkpoints A, B and C on the tops at x 24.

**The Hour's course law, unchanged, in the Ketch's own dress** (B):

- **The spars** (the drifts) are grated brass platforms on trusses, **slung on two chains from a block on the jackstay**:
  the block runs along the jackstay with the spar's drift, and the chains lean with its swing - so you read the drift's
  period and phase before you jump, by a physics you know.
- **The tonal plates** (the Beat) are round resonator plates of Dwarven brass. Solid, lamp gold, **the twelve studs round
  its rim go dark one by one** over its solid span (time left); its last 0.4 s ember, a falter or two; it dithers out; a
  2-px lamp-gold ghost outline hangs where it will return, its studs relighting; it dithers back in over 0.15 s and
  **rings as it returns**, each plate pitched to a partial of her keel - A4, C#5, E5, G5, A5 down the span - so the
  returning plates play her A7 across the air, on the beats of KETCHSAL, which is locked to them.
- **The riser** is a ratline - brass cord rungs up its face - with a lit lip: climb here.
- **The rotten rigging** (the crumbling planks) is corroded steel grating, verdigris-eaten, its cracks ember-dim. Under a
  foot its rust holes widen in three stages over the 0.7 s while flakes fall; then it breaks into four pieces that tumble
  away into the haze toward the cloud deck, and its ghost and studs count the 5 s; **in the last 0.6 s a fresh grating
  swings down on a chain from the jackstay** and clicks into place. The ship mends herself; the law's return at 5 s decides.
- **The lanterns on the tops** (A, B, C): yours lit lamp-gold, one at a time.
- **The Rotten Rigging's gust**: torn net-strips hanging from the jackstay over the course's end **stream toward the push
  one second before it** (`SD_GUST_WARN`), the rigging's whistle rising with them; then the vapour motes streak and bend.
- **The catch-net**: a long net of brass cord slung under the course from her flank to the jackstay's chains, half a metre
  under the void's floor (`world/superDungeon/sdSteps.js` `SD_VOID_Y` -30): the promise you will be caught. A fall that
  reaches it **billows** it where you struck; at your checkpoint a haul of cord lines converges on you with the net's thrum;
  today's words stay.
- **260 m under your boots** (moment 6): her brass belly curving away, the cloud deck drifting below, the real Daggerfall
  through its gaps (element 14). The score drops to the wind at your first jump and KETCHSAL enters on the first landing.
- **The bosun's line** (once the bridge is unbarred) is a brass cable with a traveller wheel. Riding it, the handle stands
  at the top of your view, the wheel whines, sparks fly from the sheave every 0.2 s and the land rushes below; the cable
  sags under the rider at the rider's own point; a crewmate riding is seen hanging from a traveller.

### How it is built

- **The dress**: `scenes/superDungeon/sdSteps.js` `createSdSteps` takes a `dress` (`'hour'` the default) - a table of the
  builders the Steps already call by kind (`world/superDungeon/sdStepsModel.js`, `sdStepsArt.js`) - and a `sounds` table
  (`SD_STEPS_SOUNDS` the default). The dungeon context's call takes `ketchSailwalkDeps(renderer, audio)`
  (`scenes/ketch/ketchSailwalk.js`), which answers the course, `KT_STEPS_DRESS` and `KT_STEPS_SOUNDS` (one term, The hosts).
- **`world/ketch/ketchStepsDress.js`** (new): the spar (inside `stepBox`); the tackle (the pendulum's frame: two chains from
  the step's edges to a block at `jackstayY(z)` - `world/ketch/ketchModel.js` - in the line pass, leaning `asin(dx / L)` at
  the law's `dx` over its own length `L`); the tonal plate (twelve stud frames, an ember frame and the ghost - the Beat's
  frame records by `texRemap`, as SD-LOOK S9 built them); the ratline; the grating's three stages and four chunks along its
  own crack lines; **the mend** in place of the rewind (in the chunks' last `SD_CHUNK.rewind` 0.6 s, a grating on a chain
  swinging in from the jackstay); the lantern (the waystone's place); the strips (the vane's place). **`stepAt`,
  `beatStands`, `stepTris`, `stepBox`, `crumbleAfter`, the ghost pass's law and every timing are untouched.**
- **`world/ketch/ketchStepsArt.js`** (new): the dress's four kind atlases (128x64), the stud frames and the grating's stages,
  through the kit in `KT_PAL`.
- **The ghosts**: `render/superDungeon/sdStepsPass.js` reused whole; its new `uDress` uniform draws a ring of studs in place
  of the hand.
- **The chunks** fall for as long as the law leaves them (about 95 m in the 4.4 s before the mend) - the dress's own
  `seen` depth.
- **The catch-net**: one cutout strip in the static mesh, never above `SD_VOID_Y` (visual - the void's law catches); its
  billow 6x10 quads rewritten through `renderer.updateMeshVertices` for 1.5 s after a cast-back (`sdCastBackSeen`'s moment);
  the haul a `ketchFx` `haul` burst.
- **The strips**: a part of 24 vertices rewritten from `gustAt` (the Steps' own) one second ahead.
- **The line**: `bosunLineAt` unchanged; the cable rebuilt on the rider's point while ridden (16 segments, its sag deepened
  at `u`) in the line pass's dynamic slots; the traveller a part at the rider's `u`; my own handle in view space as the
  carried cell is; `ketchFx` `trolley` sparks.
- **The sounds** (`KT_STEPS_SOUNDS`, `systems/ketch/ketchSound.js`): the plate's ring (the bell, 107, pitched to its
  partial, 3D, the four nearest); its falter a brass tap (433 at 1.25); the grating's creak (67 at 0.8) and snap (Hit5 112
  at 1.4); the gust through the stays (`kt:gust`, 70-72 swelled 0.8 s); at a cast-back the net's thrum (a made pluck at A2
  and E3 decaying 1.2 s) and the hull's creak.

### Files and new modules

- **New:** `world/ketch/ketchStepsDress.js`, `world/ketch/ketchStepsArt.js`, `scenes/ketch/ketchSailwalk.js`
- **Changed:** `src/scenes/superDungeon/sdSteps.js` (`dress`, `sounds`, `cull`), `src/render/superDungeon/sdStepsPass.js`
  (`uDress`), `src/world/ketch/ketchModel.js` (the catch-net), `src/scenes/dungeonContext.js` (one term),
  `src/scenes/ketch/ketchClient.js` (the line's ride)

### Cost

As SD-LOOK S9's Steps: one draw a step (the kind atlases), the tackles in the line pass, three lanterns, the strips, at
most eight chunks while one falls, and the one ghost draw - about 26 GL draws drawn, from about 31 today. Textures about
0.74 MB (kind atlases 256 KB; the plates' stud frames and the gratings' stages, 15 records at 64x64 x 2, 480 KB). CPU: the
Steps' own, plus 6 matrices and the strips' 24 vertices. **No lamp reaches the course, so a moving step rebuilds no cube:
kept so** (SD-LOOK's own rule).

### Enhanced lane and classic set

- **Lane**: the plates' gold and their ghosts at L3 bloom against the sky; the cloud deck's shade on the land below.
- **Classic**: the same records and ghost pass; halos at the lanterns.

### Phones

The Steps' lite (two chunks, 3-px ghost lines); the mend's grating without its chain; no billow; tackles as single
chains.

### Lab check

| View | What must be true |
|---|---|
| `sailwalk`, `sailwalk-side`, `sailwalk-down` at `hour=12\|19\|2` | the dress in every light; the land under it darker than the hull |
| `spar` (on spar 2) at `?t=N` and `N+1` | each tackle's lean equals the law's offset over its length |
| `?beat=` | one plate in its ember with its last studs, one gone with its ghost and relighting studs |
| `?crumble=0.5\|fall\|mend` | a grating mid-corrosion; chunks falling; a fresh grating swinging in |
| `?gust=warn` | the strips stream the push's way, checked through the camera's one mirror |
| `?castback=A&age=0.3` | the haul burst at A; the net's billow where the fall struck |
| `?law` | no tackle, strip or net inside a step's box; the net never above `SD_VOID_Y` |
| the flash probe on a plate; `?grey` at 30 m | at most 3 transitions a second; solid, ember and gone told apart |
| `?score=KETCHSAL&t=0` | each plate's ring within 30 ms of its beat |

### Pins

`test/world/superDungeon/sd7b_steps.test.js` and `sd25_steps.test.js` unchanged - the Hour's dress byte-equal;
`ketch_steps_dress.test.js` (new: the tackle's lean is `asin(dx / L)` at the law's `dx`; the studs are the
time left; the mend inside the law's return; the plate's partial by its place); `test/scenes/hostceiling.test.js` on the
term. Mutants `ketch_look_sailwalk.json` (KTL-the-tackle-leans-wrong, KTL-the-mend-before-the-law, KTL-the-net-above-the-void).

---

## 9. The bridge

### What the player sees

**Today** (`bridge`, `helm`): a sunny disc with gold rings (the floor's mean 0.21, p95 0.38-0.47 with the gilt disc),
eight lattice spires with cones (minarets), resonator crystals of 0.9 m at 4.6 m on red A-frames over black boxes, a
section's warning a +-0.06 m shake at 6.9 Hz (`world/ketch/ketchPose.js` `sectionPose`: `KT_SECTION_DROP.shudder x
sin(now / 23)`) - under a pixel at 20 m, and a flash-law breach - with no ember and no sound; a fallen section a tilted
slab with a cyan streak (`bridge_hour12stage4sec12`); the whole bridge's blows (the Discord, the Keel-Song, the turn west)
skip the telegraph pass (`ketchFight.frame`: `if (visible(bl, t) && !whole)`) - only the bar and a chat line show them; the
risen forks have no health on them; the falling sections and the resonators' pylons cast; the wheel is a flat disc; the
console a black box.

**The helm-chamber of a Rourken instrument, open to the sky.**

- **The floor** is Dwemer steel plate - the darkest floor aboard, so the telegraphs own it (mean at most 0.22 at noon) - in
  eight sectors whose dark seams are the outer ring's seams. Inlaid in brass: the core's two circles (r 6 and r 13, the
  fork band between them set darker, `KT_FORK_RING`, so you see where the forks will rise), **the Keel-Note's sigil** -
  eight rays, one to each seam - and four spokes out to the resonators.
- **The floor's light** (`ktBridgeGlow`): **the ward drawn on the floor** - each spoke lit as its resonator, ember false,
  aether true; **the Discord's clock** - the outer circle a needle-ring, a lamp-gold mark creeping round it over the 30 s to
  the next Discord (`ws.da`), the circle burning ember through its 2.5 s wind-up, landing as a ring of ember light rolling
  from the core to the rim; the Keel-Song's landing a white-gold ring to the rim; **the end** - in the fight's last minute
  (`ws.ends`) the spokes, circles and seams go red.
- **The ring's warning.** A section that will fall **burns ember along its two seams and its rim** through its 3 s warning
  (`KW_SECTION_WARN_MS`), brightening, faltering twice at 2 Hz in its last second; its rail lamps go out, rivets pop, grit
  falls from its underside, metal groans. At its moment its four chains snap from the core's rim davits and it drops away
  out of sight; where it was, **a lamp-gold ghost outline** of the arc hangs with **a needle at its middle running its 7 s**
  (`KW_SECTION_GONE_MS`); over its last 1.2 s (`KT_SECTION_RISE_MS`) **it is winched home**, the chains drawn taut from
  below, and the outline fills. Nobody steps onto a section without having seen it burn.
- **The eight pipe-forks** (the spires): organ-pipes of graded heights (7 to 11 m) in burnished Dwarven brass, banded, their
  mouths cut, each crowned with a fork's two tines - structure, unlit at rest; in the Discord they hum; **through the
  Keel-Song's 8 s wind-up they light one a second, ember, shortest to tallest** (moment 9: the song's clock, how many
  seconds left at a glance from anywhere on the bridge or the Sailwalk); every fork broken: their light snaps dark; the song
  lands: they flash once and the outrigger horns under her hull sound; they ring when the Tonal Ring lands.
- **The four resonators** (`KT_RESONATORS`, r 19): a 2.4 m crystal in a burnished brass cage on a finned foot, three
  tuning rings stacked about it. **True**: aether, turning slowly, its note in tune. **False**: ember, turning fast, its
  rings trembling out of phase (at most 2 Hz), a spark crackling every 1.5 s, its note sour and beating (moment 8: you hear
  which are false from across the bridge). **Put right**: the true crystal dithers in over the false in 0.8 s, the note
  glides into tune, the beat flashes, its spoke on the floor turns aether and one of the helm board's four lamps lights.
- **The helm**: a steering ring of eight gear-glyph spokes on a brass column wrapped in the Rourken script. Steered, it
  drifts +-20 degrees on the swell; **when the Warden lets go it spins free** behind it, slowing over 20 s, ticking (moment
  7); at the Warden's fall it spins again.
- **The lodestone** (`KT_LODESTONE`, today's) sits inside a brass armillary of three rings turning with it; it turns on its
  own while the Warden stands, and **after the fall it eases round to point at the city** - west-north-west from her
  station, the Numidium's pieces' lore (`Sky-Ketch.md` section 1).
- **The helm's board** on the cabin's face behind it (6 m up): the turn-west gauge; the Discord's gauge in phase 2 or the
  Keel-Song's in phase 3; the stun's; four resonator lamps, seven fork lamps, three phase lamps.
- **The cabin's façade**: a Dwemer pavilion of tan stone, brass pilasters, a domed roof with fin crests, its round
  gear-glyph doors cold until the fall.
- **The wind is strongest here**: vapour streaming across the disc, the cabin roof's weathervane turning.

### How it is built

- **The floor**: a `steelPlate` record; the inlay as geometry 0.01 m proud (SD-LOOK's lesson: inlay as geometry, never
  texel rows).
- **`render/ketch/ktBridgeGlow.js`** (new; `render/superDungeon/sdArenaGlow.js`'s law): **one premultiplied draw** - a flat
  disc 1.5 cm over the bridge (r 24) whose fragment taps a 128x128 R8 distance field baked once, each feature in its own
  value band (the 8 seams, the rim, two circles, 4 spokes); lit from uniforms written from `ketchStatesOf`: `uSecWarn[8]`
  (the warning's share and its falter), `uSecGone[8]` (the ghost's needle share), `uRes[4]`, `uDiscord` (the mark's angle,
  the burn's share, the roll), `uSong` (the landing's roll), `uEnd`; `SD_PIXEL_GLSL`, fogged, additive.
- **The sections**: one atlas record each (each section's plates, rim and rail baked into its cell of a 256x256 atlas -
  fixed shapes, no wrap): 40 GL draws become 8. `noShadow` from its warning to its return. `sectionPose`'s look changes
  (its law - `solid`, the moment, the return - does not): the shake 0 (slice KL0 slowed it first); the chains (four a
  section, in the line pass) drawn taut to the davits while whole, snapped and trailing as it drops, drawn up with it
  through the rise. The collider is the law's (`T.sections` at `KT_GONE_Y` while not solid) - unchanged.
- **The pipe-forks**: `world/ketch/ketchOrnament.js` pipe-fork (a lathe of 10 sides with a mouth cut-out and the two tines)
  at each spire's place. Their visual leaves the static mesh (8 draws, each with three records - dark, ember, flash - by
  `texRemap` from the song's blow: `ws.bl`'s `song`, its `at - wu`); **their collider triangles stay in the ship's `hit`
  exactly as today** (the `cyl` r 0.3 to 7 m), and the pipe's extra girth stands above 2.2 m only - nothing a body meets
  grows (the Hour's "nothing below 2 m past the law").
- **The resonators**: `buildKetchParts` `resonator.true|false` rebuilt (the 2.4 m crystal, the cage) with a rings part
  each (trembling by `yawAbout` +-3 degrees at 1.8 Hz while false); the 0.8 s turn drawn with `renderer.setDissolve` in the
  Ketch's own pass (`drawKtFight`'s door, the client's `drawPass`), because the dungeon loop reads no dissolve - the Spire's
  occluders' way (`scenes/eliteGates/egOcclude.js`); `ketchFx` `crackle` every 1.5 s a false one.
- **The wheel** a part (out of the static mesh), turned from the fight's state (`ws.op`'s letting go, `ws.fell`'s spin) and
  the swell. **The lodestone**: `KT_LODESTONE.spin` while the Warden stands, eased to the city's bearing after `ws.fell` (a
  pure function of the fall); the armillary's three rings a part.
- **The helm's board**: `KT_BOARD_SITES` into the gauge pass.
- **The sounds** (element 15): the resonators' beds, the sections' groan, wrench and clank, the rivets.

### Files and new modules

- **New:** `render/ketch/ktBridgeGlow.js`
- **Changed:** `src/world/ketch/ketchModel.js` (the floor, the inlay, the pipe-forks' visual out of the static mesh with
  their `hit` kept, the console, the armillary, the façade), `src/world/ketch/ketchPose.js` (`sectionPose`'s look),
  `src/scenes/ketch/ketchDeckHost.js` (the sections' atlas, the resonators, the wheel, the lodestone), `src/scenes/ketch/
  ketchClient.js` (`drawPass`: the dissolving parts), `src/world/ketch/ketchArt.js`

### Cost

- **Draws**: the glow 1; the pipe-forks 8; the resonators and their rings 8; the wheel 1; the armillary 1; the sections 40
  GL to 8; the chains in the line pass; the board inside the gauge draw (about 16 instances).
- **Lights**: unchanged on the bridge (the four resonators' and the core's lamps); the forks' seven retire (element 10).
- **Textures**: the field 16 KB, the sections' atlas 512 KB, the pipe-forks' records 32 KB, the steel and seam records
  160 KB.
- **CPU**: about 60 uniform floats and 6 matrices.

### Enhanced lane and classic set

- **Lane**: the burn, the pipe-forks' count and the Keel-Song's roll peak at L4 and bloom; the floor holds at L1.
- **Classic**: the glow in display values; halos on the crystals, the lit pipe-forks' mouths and the fork tips.

### Phones

The Discord's mark moves in 12 steps; no crackle sparks; the chains one a section; the armillary 8-sided; the ghosts kept.

### Lab check

| View and knob | What must be true |
|---|---|
| `bridge`, `helm`, `helm-board`, `bridge-far` at `hour=12\|19\|2` | the core floor's mean at most 0.22 and p95 at most 0.30 at noon; the contrast probe: every telegraph core at least 0.7 |
| `?fight=discord&rs=1,0,1,0&da=12\|1.2` | two false resonators trembling and two lamps lit; the mark at 12 s; the burn at 1.2 s |
| `?fight=song&st=4` | four pipe-forks lit |
| `?fight=sections&sec=1:2.2,2:-3` | one section burning in its last second; one gone with its ghost and needle |
| `?fight=west&left=40` | red |
| `?fight=fell&age=0\|5\|20` | the wheel spinning down; the lodestone turned to the city |
| `?res=0111&turn=0.4` | one resonator mid-dither |
| the flash probe on a burning seam; `?grey` | at most 3 transitions a second; the resonators' four states, the burn and the ghost told apart |
| `?law` | no pipe-fork wider than its collider under 2.2 m |

### Pins

`test/scenes/ketch_deck_host.test.js` (the sections' eight draws; `noShadow` from warn to return; the resonator's turn);
`test/world/ketch_model.test.js` (the spires' `hit` byte-equal); `kt_bridge_glow.test.js` (new: the
uniforms from `ketchStatesOf`; the field's bands); `sectionPose`'s look (no shake; its law unchanged). Mutants
`ketch_look_bridge.json` (KTL-the-seam-cold, KTL-the-pipes-count-wrong, KTL-the-section-casts-falling).

---

## 10. The Tonal Warden

### What the player sees

**Today** (`scenes/ketch/ketchFight.js` `KT_WARDEN_LOOK`): Daggerfall's Iron Atronach (mobile 36, TEXTURE.291 - a
muscled man; B counted 34% of its texels in the 0x70 metal band and 57% in the 0xD0 greys) grown 2.6 times and multiplied
by [1.0, 0.86, 0.5]: live, an orange-red man (`e2e/bridge_1.png`, `final_bridge.png`). No crown, nothing of a steersman;
its phases change nothing on it; the ward is a gold glint at 0.45; stunned it holds a hurt frame under a blue light; its
voice is the Atronach's hurt - the Brass Remnant's own voice (`scenes/superDungeon/sdRemnantVoice.js` `SD_IRON`) - and the
Oblivion Warden's growl (`world/gate/gateBoss.js` `BOSS_CUES.growl`); the Keel-Song's 8 s (`KW_BLOWS.song.wu`) shows only
on the bar, and the Discord is silent.

**A body of its own, oversized, as the owner rules for bosses**: 6.4 m (`KW_BODY.h`) of Rourken brass in Daggerfall's
Dwarven metal - a barrel chest that is a resonator (a slotted drum, an aether core behind eight slots), shoulders of brass
bell-mouths its voice comes out of, a head of a gear-glyph face-plate on a collar, legs of pistons over round feet, **the
right arm the Keel-Hammer** (a hammer whose head is a fork's yoke), **the left the Steam Lash** (a pipe arm ending in a
nozzle). Asleep it stands at the helm, both hands on the ring, its back to you; its hum grows as you cross the bridge.

- **THE CROWN** (C): a tuning-fork's two tines, 1.6 m of burnished brass, floating a hand over its face-plate - the lore's
  crown, carrying its state: asleep, dark; **the Steersman**, steady aether (it keeps her song true); **the Discord**, ember,
  its two tines beating against each other at 2 Hz; **the Last Note**, ember, and through the Keel-Song's 8 s its light
  climbs root to tip (the song's count on its own head); stunned, tilted and dark, a needle-ring round it running the stun's
  ten seconds; fallen, it drops, rings out for 4 s and rolls on the deck, one tine snapped (A).
- **THE WARD** (C): through the Discord, four plates bearing the resonators' sigils orbit its waist - each ember while its
  resonator is false, aether once true. All four true: they shatter and it reels into its stun.
- **ITS MARK**: a ring about its feet and a chevron where it faces, in its metal (WBX4's mark, as the Remnant's).
- **It lets go of the wheel** (moment 7; the fight's opening, `KW_OPENING_MS` 6 s, the bar's "It turns from the helm"):
  head up, hands off the helm - the wheel spins free behind it - it turns to the way in, its crown rings once (a struck
  fork), its chest's core lights.
- **I - The Steersman.** Every blow tells on its body before its floor, in the blow's colour, heating off, mid, hot as the
  wind-up runs (its tell layer):
  - **Keel-Strike** (`keel`: a lane 26 m, wind-up 1.9 s): the yoke heats gold-white from root to tip; the lane's centre
    line lights from its feet out; a run of sparks races the lane at its landing.
  - **Steam Lash** (`lash`: a 150-degree cone of fire, 1.7 s): the nozzle glows fire and spits, steam venting from its
    shoulders; steam then fire across the cone.
  - **Tonal Ring** (`ring`: a disc r 7, 1.8 s): its chest's core swells and its crown rings; a ring of light at its feet;
    then **the Tonal Wave** (to 20 m, 900 ms after) rolls out as **a low wall of light 0.6 m tall** at the very front the law
    strikes - "jump this" - and a tone riding its front passes your ears as it does (element 15).
- **II - The Discord.** It turns from the helm (`ws.ou`), strikes its own crown - the tines ring sour - and the four
  resonators go ember one after another; the score goes out of tune and into seven. Warded, the plates orbit and blows ring
  dull off it with sparks. **The Discord** (every 30 s, a quarter of everyone's health, 2.5 s wind-up): it arches back and
  every false resonator howls, the floor's circle burning; two Sentries climb over the bridge's rim in steam. **Tuned**
  (moment 8): the fourth cell seats - the chord snaps pure, the plates shatter into falling ember shards, and it **kneels in a
  ring of aether** on the floor, its chest's core blazing (struck half again as hard), the crown's needle-ring counting its
  ten seconds.
- **III - The Last Note.** Its chest's drum opens on its white core. **The Keel-Song** (every 45 s, 8 s wind-up; moment 9):
  its arms high and trembling; the crown's light climbing; the pipe-forks lighting one a second; **the forks rising out of
  the core's deck** in a ring of steam between the inlaid circles, each humming its own partial, ember; struck, a fork's
  tines crack through three stages with its health; in the song's last 0.5 s (`KW_FORKS_CLOSE_MS`) their tines go white -
  too late; broken, a fork shatters with a ping a step lower and its note leaves the song. **Every fork broken**: the song
  breaks - a crashing discord - and it staggers into its stun. **One standing**: the song lands - the outrigger horns blare,
  a white-gold wall sweeps the whole bridge, the bridge shakes, its core flares as it heals. The outer ring gives way
  (element 9).
- **The Ketch turns west** (fourteen minutes from its wake, a blow every 2 s): the floor's inlay red, the board's turn-west
  needle in its red sector, the score silent, the hull groaning, the land turning under her (element 14).
- **Silenced** (moment 10): its song breaks into its overtones, which fall silent one by one; **a tine snaps** and rings
  away across the deck; its chest's core gutters out in three beats; it topples onto the helm and the wheel spins; two
  seconds of wind and nothing else; then **eight bells** and KETCHFEL. Every resonator goes true; the bridge's inlay turns
  from ember to lamp-gold - the ship at peace; the cabin's lamps light from the door inward and its doors slide back; a
  lamp-gold beacon stands over the cabin door for 10 s.

### How it is built - a painted sprite of its own, baked from a model in code

**Why a sprite**: the owner ruled for the Spire, *"Bosses should also be oversized sprites. Not modeled like the abyss
dungeon"* (`Elite-Gates-Look.md`); its crew are Daggerfall Enemy Expansion's sprites and a model among them breaks the one
hand; and Daggerfall made its own monsters this way - TEXTURE.291's records are a pre-rendered model in five facings,
mirrored to eight. **Why not the Iron Atronach**: its silhouette is a muscled man; no recolour makes it an instrument.

- **The model**: `world/ketch/ketchWardenModel.js` (new): about 3k triangles through `ketchKit.js` and the ornament kit,
  painted with the Ketch's own index-space records, posed per frame of each state by a small rig of its own (pure).
  Inside the law's body (`KW_BODY` r 2.0, h 6.4): nothing below 2 m reaches past r 2.0.
- **The bake** (the owner's ruling 4): `bakeKetchSprites.mjs` runs `world/ketch/ketchBake.js` over the model -
  flat triangles, the Ketch's textures sampled NEAREST, Daggerfall's sprite key light from the upper front-left, a z-buffer,
  2x supersampling boxed down in the fallback colours and re-quantized with an ordered dither to `KT_PAL` indices (integer
  arithmetic throughout: the same bytes on every machine). It writes **Daggerfall's record layout**: records 0-4 move (4
  frames), 5-9 the Keel-Strike (6), 10-14 hurt (2), 15-19 idle at the helm (4), 20-24 the Steam Lash (5), 25-29 the Tonal
  Ring (5), 30-34 stunned (2), 35-39 the fall (5) - each record a facing, five facings mirrored for the other three; the
  alternate attacks reached by DFU's alternate-attack law (`primaryAttackAnimFrames2` and 3, as DEE's rows are,
  `characters/enemy/enemyBasics.js`). 33 frames a facing, 165 in all, 200x280 px (about 44 px a metre). **A tell layer**
  beside it: the same frames with only the telling part drawn, emissive. Written with `tools/pngIO.mjs` `writeIndexGreyPng`
  - 8-bit greyscale, each grey value an ART_PAL index, no PLTE, no colour - to `src/assets/ketch/warden/<anim>.png` and
  `<anim>-tell.png`, sixteen files, about 2 MB.
- **The gate**: `kt_sprite_bake.test.js` regenerates every frame from the model and compares byte for byte
  (`tools/bakeThunderlock.mjs`'s law: "a derivation you cannot re-run is a claim you cannot check"); it also fails a file
  that carries a PLTE chunk, an index outside `KT_PAL`'s steps, or a frame whose foot leaves the law's body. Each file has
  its "OURS" row in `test/tooling/doctrine.test.js` (the owner's call 4 records why it is not a render of game data).
- **Drawn by the path the Warden already has** (`ketchFight.js` `draw`, `bossFrame`, `mobileBillboardSize`): the sheets
  registered under a Ketch-only mobile row (`registerEnemyRows` - its frames, its sounds), each frame decoded in the page
  through `DecompressionStream('deflate')` (the realm save codec's door, `net/realm/realmSaveCodec.js`) - never through an
  image element, which may colour-manage - and resolved through the player's `ART_PAL.COL` at upload, on demand
  (`uploadRecordFrame`, today's path); `KT_WARDEN_LOOK.tint` retires. The tell layer is a second billboard batch of the same
  frame over it (the halo pass's blend), its strength the wind-up's share. The glint retires for the Warden (the plates
  carry the ward; the tells carry the blows).
- **The interim** (slice KL2, until the bake lands in KL15): the Iron Atronach **dyed Dwarven the Daggerfall way** - DFU's
  ChangeDye (`characters/dyes.js` `changeDyeBitmap`, `DYE_COLORS.Dwarven`) over its 0x70 band, a Ketch table over its 0xD0
  greys - at upload from the player's own TEXTURE.291 (never committed), in place of the multiply tint.
- **The crown and the plates** (`world/ketch/ketchDressModel.js` `buildCrown`, about 300 triangles, burnished, with its
  records - dark, aether, ember, the climbing light, by `texRemap`; `buildWardPlates`, four quads in one mesh): dynamic
  draws in the deck's set, `noShadow`, posed in `pose` from `ketchFight`'s new `wardenAt()` (its feet, its drawn height,
  its facing, its act, its blow and that blow's wind-up share): the crown at feet + drawn height + 0.3, the plates at r 2.4
  and 3 m up, turning 0.4 rad/s.
- **The mark**: `TELEGRAPH_KIND.mark` laid in `ketchFight.drawPass` (as `scenes/superDungeon/sdRemnantBlows.js` lays the
  Remnant's).
- **The walls**: `render/superDungeon/sdStompWall.js` records - the Tonal Wave at the blow's `shRing` front from r0 to r1
  over its `after` (`net/eliteGates/egShape.js`), the Keel-Song's landing; `SD_STOMP_WALL.max` 3 holds the Warden's and the
  Captain's.
- **The forks** (the law's, `ws.fk`): `buildKetchParts` `fork` rebuilt in burnished brass with ember tines and three crack
  records by `texRemap` from the forks' health (`fk.c[j][2] / fk.m`), a white record in the last `KW_FORKS_CLOSE_MS`, two
  tine parts thrown on a break (`ketchFx` `forkBreak`); risen 0.8 m out of the deck over 0.6 s from the song's start
  (`fk.at - wu`), `ktSteamPass` at their feet. **Their seven point lights retire** (`KT_GLOWS.fork`): emission and a halo.
- **The fall**: a pure function of `ws.fell.at` - the sprite's fall records at its size (EG-FALL's law,
  `scenes/eliteGates/egLordFall.js`), the crown's drop and roll on a matrix for 4 s, the snapped tine on an arc for 1.2 s,
  lying 20 s and dithered away; a late page sees the same.
- **Its light**: `ketchFight`'s Warden glow kept, coloured by phase - aether, ember, dark while stunned.
- **Its size**: the hit target's radius the relay's (`KW_BODY.r`), its height the drawn sprite's (EG-LOOK section 9: the
  relay judges no height).
- **Its voice** (element 15).

### Files and new modules

- **New:** `world/ketch/ketchWardenModel.js`, `world/ketch/ketchBake.js`, `bakeKetchSprites.mjs`,
  `src/assets/ketch/warden/*.png` (committed, gated)
- **Changed:** `src/scenes/ketch/ketchFight.js` (`KT_WARDEN_LOOK`, `wardenAt`, the tell batch, the mark), `src/scenes/ketch/
  ketchDeckHost.js` (the crown, the plates, the forks), `src/world/ketch/ketchModel.js` (`fork`), `src/characters/enemy/
  enemyBasics.js` (the row), `tools/pngIO.mjs` (`writeIndexGreyPng`), `test/tooling/doctrine.test.js` (the rows)

### Cost

- **Draws**: the body 1 batch and the tell 1 batch; the crown 1; the plates 1; the mark one telegraph slot; walls at most 2.
- **Triangles**: about 400 (crown and plates).
- **Lights**: its glow (1), as today; the forks' seven retire.
- **Textures**: frames uploaded on demand, about 20 resident x 224 KB (at most 4.5 MB, typically 2 MB); the crown's and
  plates' records 96 KB. **Committed**: about 2 MB.
- **CPU**: as today, plus 2 matrices.

### Enhanced lane and classic set

- **Lane**: the tell layer at L4 blooms; the crown's lit tines at L3-L4.
- **Classic**: the tell layer, and halos at the chest's core and the crown's tips.

### Phones

Frames at half size (every other texel - an index image is never filtered); the plates fixed, not orbiting; eight facings
kept.

### Lab check

The lab draws it with no game data - the sheets are the port's own, resolved through the fallbacks:

| Knob | What must be true |
|---|---|
| `warden-turntable&yaw=` at 8 bearings x every record | every frame poses cleanly; the mirrored facings mirror |
| `?fight=asleep\|wake\|keel&wt=0.6\|lash&wt=0.3\|ring\|wave` | the tells hot at 0.6; the wall at the wave's front |
| `?fight=discord&rs=1,0,0,1`, `tuned`, `stun&su=4` | two plates ember, two aether; the shards; the needle-ring halfway |
| `?fight=song&st=6&forks=3:100,40,0`, `&st=7.7` | the crown lit to six eighths; forks cracked by health; white tines in the last 0.5 s |
| `?fight=fell&age=0.6\|3` | the tine in flight; the crown rolling |
| `?grey`; a silhouette probe at 50 m | the tells at L4 against the body at L1; the crown's tines at least 6 px wide |
| `?law` | nothing below 2 m crosses r 2.0; the plates at waist height outside r 2.0 |

### Pins

`kt_sprite_bake.test.js` (the byte gate, no PLTE, every index a step, the feet inside the body);
`test/tooling/doctrine.test.js` (the rows); `test/scenes/ketch_fight.test.js` (the records by act; the tell's share is
the wind-up's; the crown's state by phase; `wardenAt`; the forks' lights gone); the Hour's `test/scenes/superDungeon/
sd17_body.test.js` untouched. Mutants `ketch_look_warden.json` (KTL-the-crown-wrong-phase, KTL-the-tell-late,
KTL-the-sheet-carries-a-palette, KTL-the-mirror-flipped).

---

## 11. The constructs

### What the player sees

**Today** (`ketchFight.js` `KT_LOOKS`): the Sphere is DEE's Centurion Sphere (mobile 289) at 0.85; the Sentry the same
sphere at 1.15 multiplied verdigris (muddy); the Spider Daggerfall's hairy giant spider (mobile 6, TEXTURE.261 - organic)
multiplied orange; the Hammer Warden DEE's Iron Golem (mobile 270) multiplied bronze; the Watch-Captain DEE's Steam
Centurion (mobile 290) at 1.4. Spheres drop out of empty air, Sentries and the Captain rise through solid deck, the dead
sink through it (`ktBodyAct`'s lift); their tell is the whole sprite's glint; their voice one bark for rise, wind-up and
hurt alike (`hostCue`), falling back to the Imp's row where a row is missing.

- **Spheres**: lowered on drop-lines from brass cradles in the rigging (element 4), landing with a clang and grit; a
  spin-up whine before each lunge; rolling, a mill's hum.
- **Sentries**: the same sprite **recoloured into verdigris by ramp** - its plates verdigris, its brass highlights kept, a
  weathered guard, not a muddy one - climbing out of irising deck hatches; through each wind-up **a thin aether line from
  the turret to its bolt's mark** (or its volley's three): whom it means; a crank's ratchet three times.
- **Spiders**: **a Dwarven Spider of its own** - a round brass body with an aether eye-lamp, six jointed legs and an arc
  stinger - pouring from the vents' irises, skittering, its sting an aether arc; dying, its legs fold and it sparks.
- **Hammer Wardens**: DEE's Iron Golem **recoloured into Dwarven brass by ramp**, its orange into ember; asleep at their
  posts dim and unmarked; waking, steam bursts from their floor rings, their eyes catch and their mark lies under them.
  Drawn at 1.6 times today's size, the Watch-Captain at 1.7 (A): the Spire's lords' law (EG-LOOK section 9: the drawn size
  the client's, the hit radius the relay's, the height the drawn).
- **The Watch-Captain**: DEE's Steam Centurion **with its crest recoloured gilt** - rank by palette, as Daggerfall shows
  rank; it climbs the hatch's stair (element 4); its stomp's Tonal Wave a wall of light; its mark under it.
- **Hits**: brass sparks at the struck chest (my own blows), a metallic ring; a Hammer Warden's a dull bell.
- **Falls**: the hurt clip, a burst of sparks and blue vapour (they are aether-driven), a clatter; the body **dithers out**
  over 0.6 s - never sinks through the deck - and leaves its corpse for 30 s where its row names a corpse record, as
  Daggerfall's monsters do; where none, the vapour covers its going.

### How it is built

- **`world/ketch/ketchRecolour.js`** (new, pure): a frame's texels mapped by luminance onto a target `KT_PAL` ramp - DFU's
  dye restated for a truecolour sprite (ChangeDye swaps a 16-index band; this swaps a luminance band) - applied at a frame's
  first upload through a wrap the fight's set holds around `uploadRecordFrame`, cached. `KT_LOOKS` gains `ramp` in place of
  `tint`. DEE's art is the mod's own, carried under Port-Doctrine's fourth exception, and recoloured at runtime only.
- **The Spider**: `world/ketch/ketchSpiderModel.js` and the same bake (records 0-4 move x4, 5-9 attack x4, 10-14 hurt x1,
  15-19 death x4; 96x64 px) to `src/assets/ketch/spider/`, gated the same way (about 150 KB). Until its slice, Daggerfall's
  spider recoloured into Dwarven brass by ramp.
- **Rising and falling**: `ktBodyAct`'s rise keeps `KT_DROP_M` for the drop and its upward lift through an open iris; its
  fall's lift held at 0 (no sink); the batch dithers out over 0.6 s at `KT_FALL_MS`; a corpse flat at the last feet (a
  batch per kind, at most 12), freed with the body set.
- **Aim lines and drop-lines**: the line pass's dynamic slots (`ktLinePass` `setDynamic`), at most 16.
- **Marks** under the Wardens and the Captain: `TELEGRAPH_KIND.mark`. **The Wardens' wash** by `B.wake` (0.75 asleep).
- **Presence**: `KT_LOOKS.scale` for the Warden and the Captain; the target's height from the drawn size (`ketchFight`
  `hostTargets`).
- **Sparks and falls**: `ketchFx` on `hostHit` (mine) and on a body's fall.
- **Voices**: `scenes/ketch/ketchVoice.js` `KT_CONSTRUCT_CUES` in place of `hostCue` for the four machine bodies (element
  15); barks capped at four a kind, nearest first (`systems/eliteGates/egMix.js` `egBarkCull`).

### Files and new modules

- **New:** `world/ketch/ketchRecolour.js`, `world/ketch/ketchSpiderModel.js`, `src/assets/ketch/spider/*.png`
  (committed, gated)
- **Changed:** `src/scenes/ketch/ketchFight.js` (`KT_LOOKS`, `ktBodyAct`, corpses, aim lines, marks), `bakeKetchSprites.mjs`

### Cost

The recolour about 0.1 ms the first time a frame is shown (a 100x120 frame); the Spider's sheet about 150 KB committed;
corpses at most 12 flats in a batch a kind; line slots at most 16; mark slots at most 3; bursts within `ketchFx`'s 16. No
lights.

### Enhanced lane and classic set

The same on both; the eyes' catch and the marks on both.

### Phones

Corpses for 10 s and at most 6; the hatches and the aim lines kept (they are the read); bursts at half their sparks.

### Lab check

| Knob | What must be true |
|---|---|
| `waist&watch=1\|2\|3&rise=0.5` | the waves' bodies from DEE's art in the repository (`?arena2` serves Daggerfall's own spider through the dev server, `vite.config.js` `arena2DevServer`) |
| `?kind=sentry\|warden\|captain\|spider&act=rise\|windup\|fall&k=` | each state; never a body under the deck's top while seen |
| `?aim=1` | the Sentry's line to its mark through its wind-up |
| `landing&wardens=asleep\|awake` | dim and unmarked; full, marked |
| `?grey` | verdigris against brass; the gilt crest against the body |

### Pins

`test/scenes/ketch_fight.test.js` (the recolour by ramp; no sink; the rise by drop-line or iris; corpses freed with the
set; the marks under the Wardens and the Captain); `kt_sprite_bake.test.js` (the Spider);
`ketch_voice.test.js` (the constructs' cues). Mutants `ketch_look_constructs.json`.

---

## 12. The blows and hazards seen

### What the player sees

**Today**: the telegraphs, on their floors (`ketchFight.js` `KT_TELEGRAPH_FLOORS`), and nothing else - no burst at a
landing, no shake, no landing light (`render/gate/gateFx.js` unused), no peril read (`ui/gate/gateGroundView.js` unused);
a hit on me is the game's red wash; the whole bridge's blows draw no telegraph.

**Every blow arrives three ways** - its source tells it (a head drawing up, a vent breathing, a coil's glass filling, a
body's tell, the crown), its floor tells it (the pinned telegraph), its sound tells it (a wind-up cue) - **and every
landing is seen, felt and heard**:

| Blow | Burst (`ketchFx`) | Shake (strength, reach) | Light | Sound |
|---|---|---|---|---|
| A hammer (the nearest 8) | grit and brass sparks at the head | 0.8 within 4 m | none (its lamp swings) | the anvil |
| A steam lane | the wall itself | 0.4 within 3 m | - | the hiss and roar |
| An arc | `sputter` at both spheres | - | its own (`KT_GLOWS.arc`) | a crack, then the buzz |
| A sphere's lunge, a spark | `sputter` | 0.4 within 4 m | the beat, 80 ms | its landing |
| The Captain's stomp | `slam` and a dust ring; the Tonal Wave's wall | 1.5 within 12 m | 120 ms | its landing and the bell |
| The Keel-Strike | sparks racing its 26 m lane at three points | 1.5 within 12 m | 120 ms | the yoke's clang and the deck's groan |
| The Steam Lash | embers and steam in its cone | 0.8 | fire, 200 ms | the hiss |
| The Tonal Ring and Wave | a dust ring rolling with the wall | 1.2 at the wall | aether, 150 ms | the struck bell; the wave's riding tone |
| The Discord | ember ripples from the four resonators; the floor's ember ring | 1.5, the whole bridge | - | the false notes swelling; the crash |
| The Keel-Song landing | the white-gold wall; the horns' steam | 3.0, the whole bridge | white-gold, 250 ms | the horns; the chord struck |
| The song broken | the forks' shards | 1.5 | - | the break |
| A section falling within 10 m | grit | 1.0 within 8 m | - | the wrench; the fall-away |
| A cell knocked loose | `sputter` | - | - | a glass clatter |
| The stun | the aether ring | 1.5 within 20 m | the beat | the true chord |
| The turn west (every 2 s) | a red ripple on the inlay | 1.0 | - | the hull's groan |
| The fall | three bursts as it falls | 3.0 | white-gold, 400 ms | the cry, the crash, eight bells |

**On my own feet**, the read (C's, on the Hour's SD15 law): the soonest blow of the Warden's or a construct's that will
land on my feet - its name, its wind-up share, its colour, and an arrow to the nearest way out - drawn by the gate's ground
view (the rim pulsing in its colour, words under the crosshair); **"Tonal Wave - jump!"** within 3 m of a rolling wall.
The hammers, the steam and the arcs keep their telegraphs, their sound and their source's tell and no arrow (the owner's
call 6, default off).

### How it is built

- **`scenes/ketch/ketchFx.js`** (new; `scenes/superDungeon/sdFx.js`'s law): `KT_FX_KINDS` (about twenty: slam, sputter,
  crack, rivet, crackle, trolley, shard, forkBreak, haul, vapour, lane sparks, ring, wall...) drawn by the gate's spark pass
  (`GateFxRenderer`, `FX_BURSTS_MAX` 16 - the oldest given up); a landing seen once and only within 500 ms of it
  (`SD_FX_LAND_LATE_MS`), a turn within `SD_FX_LATE_MS`; shakes through `betterAmbience.weaponKick` under the player's own
  maximum shake, scaled by distance; the landing lights through the fight's light channel (`ketchClient.lights` into the
  deck host's `frameLook`, `FX_LIGHT_MS` 450, marked `carried`). The whole bridge's blows still skip the telegraph pass;
  their world reads are the bridge's glow and the walls.
- **`scenes/ketch/ketchRead.js`** (new; `scenes/superDungeon/sdArenaRead.js` `sdPerilAt`'s law): `ktPerilAt(state, shapes,
  t, feet)` - the soonest blow from `ketchFight`'s shapes, its name by key (`ketchBlowName`), and the way out over the deck
  plan's floor (24 bearings, a quarter metre a step, at most 20 m, `deckZoneAt`; on the bridge never onto a warned or fallen
  section, `sectionPose`); drawn by `ui/gate/gateGroundView.js`, updated, never rebuilt; read at 4 Hz.
- The client frames both and hides them with the HUD.

### Files and new modules

- **New:** `scenes/ketch/ketchFx.js` (from KL8), `scenes/ketch/ketchRead.js`
- **Changed:** `src/scenes/ketch/ketchClient.js` (`lights`, the read's frame), `src/scenes/ketch/ketchFight.js` (the
  shapes handed to the read)

### Cost

One spark draw; at most two brief flashes in the channel; the read under 0.05 ms at 4 Hz.

### Enhanced lane and classic set

The spark pass is display-space on both; the flashes light the deck on both; the lane blooms them.

### Phones

At most 8 bursts of 32 sparks; the shakes kept (the player's own maximum governs); the read kept - it matters most on a
small screen.

### Lab check

| Knob | What must be true |
|---|---|
| `?fx=<kind>&age=` | each burst at its place; at most 16 standing |
| `?fight=keel&wt=1.0&age=0.1` | the sparks at the lane's three points |
| `gallery-lane&t=` | a hammer's landing: the grit, the lamp's swing |
| `?read=keel&me=x,z`, `?read=wave` | the arrow and the words; "jump!" within 3 m of the wall |
| the flash probe over 4 s of the hold and the bridge | no light changes faster than 2.5 Hz |

### Pins

`ketch_fx.test.js` (new: a landing once; a late one refused; shakes by distance and under the maximum);
`ketch_read.test.js` (new: the soonest blow; the way out never onto a warned or fallen section; no read
over the hazards while call 6 is off). Mutants `ketch_look_fx.json`.

---

## 13. The cabin and the Ketchmaster's hold

### What the player sees

**Today** (`cabin_hour12`, measured p50 0.137 at noon and 0.029 at night): a grey brick room (`ketchStoneArt`'s cool grey)
with one wall lamp, three brass poles on a gold disc (the stern lift) and an iron box with a gilt lid; `cabin_hour12stage5`
is stage 4's picture - the chest never opens; the share is two thin gold loot columns on the floor under a popup and the
dungeon's own flavour line (`e2e/final_spoils.png`, `final_cabin.png`).

- **Shut** until the Warden falls: dark through its two great ports, its lamps out. **Opened** (moment 10's end): the doors
  slide into their walls (today's), a wedge of warm light falls across the bridge from the doorway, the cabin's lamps light
  one by one from the door inward over 2 s, and the way-on chime sounds.
- **A Rourken captain's cabin** (moment 11): tan Dwemer stone with Dwarven-brass pilasters, a frieze of the Rourken script,
  a vault of brass ribs, a hanging ring of lanterns. **The stern gallery**: the aft wall is a great leaded window of Dwemer
  glass, and through it **the real sky and the land falling away astern**. **The Ketchmaster's chart table**: the Iliac Bay
  engraved in brass, her week's course a lit aether line looping the Bay, Daggerfall circled, a small brass ship over it. A
  rack on the starboard wall holds the silhouettes of a Thunderlock and a Pistolet - the guns found only here. **The
  Ketchmaster**: an empty Dwemer armour slumped in a high-backed brass chair at the chart, its helm turned to the windows -
  the Dwemer vanished, every one, in a day (`Sky-Ketch.md` section 1).
- **The chest**: a Dwemer puzzle-chest on a stepped plinth, a domed lid of Dwarven brass edged in gilt, **three gear-glyph
  rings** on its face. A share waits for me: the rings glow lamp-gold and turn slowly - **yours**. Nothing for me: dark.
  Pressed (*Open your share*, today's offer): the rings spin into line with three clacks over 0.9 s, **the lid lifts** on
  its gear (0.8 s), **gold light floods up from it**, a column of white-gold light stands from it for 1.5 s, and **the share
  is thrown across the floor** (the spoils pool's own spew and flight, `scenes/spoilsPool.js`) - each piece's landing
  pitched up her scale, so the share falls as her arpeggio; a Rare or better keeps the pool's chime; a Legendary adds the
  ship's bell. The share card names what fell, each line in its rarity's colour, for 6 s.
- **A Dwarven gun** in the share rises from the chest on a brass cradle and hangs turning 2 s before it settles, its breech
  closing with the Thunderlock's own sound. **A Gilded gun** (one in a hundred each, `systems/ketch/ketchSpoils.js`:
  Volendrung's Echo, the Ketchmaster's Word) bursts the lid open in gilt: the cabin washes gold for 1.5 s, **KETCHGLD**
  plays - the one D major chord in her score, the dominant landing at last - her horn sounds once (the ship salutes), the
  gun hangs turning 3 s, and the card reads *Gilded* over the piece's own name over *From the Ketchmaster's hold*.
- **The music box**: KETCHCAB, the crew's shanty on the concertina, at rest; the cabin sounds like a room.
- **The stern lift**: a smaller brass cage with its lamp lit - the way down (element 2, `ktDown`).

### How it is built

- **The room** (`world/ketch/ketchModel.js`'s cabin with the ornament kit): walls, vault and frieze over the colliders as
  they are (`KT_CABIN`). The stern wall's inside face a **cutout glass** record (leading and frames opaque, the panes alpha
  0): the dungeon arm draws the world's sky on a ship after the opaque level (`host.drawSky`) and shades only what nothing
  claimed, so the panes show the sky, and the land through them where the ground draw stands behind; the wall's collider
  stands.
- **No new collider**: the chart table built into the aft wall's frame (0.3 m proud, inside a body's standoff), the rack
  0.15 m on its wall; **the Ketchmaster a flat of its own** - baked by `bakeKetchSprites.mjs` from `world/ketch/
  ketchMasterModel.js` (one bearing, seated, as Daggerfall's decoration flats are; about 40 KB, committed and gated as the
  Warden's are) and walked through as Daggerfall's flats are; the chair is part of the flat.
- **The chart**: `world/ketch/ketchCabinArt.js` (new) - the Bay as a coastline of about sixty points engraved through the kit
  (the port's own drawing, no picture read), at 128x128; her course and Daggerfall's circle drawn over it in aether.
- **The chest**: `buildKetchParts` `chestRings` (three) and `chestLid`, posed by the deck host from the client's chest state
  (owed, opening, open - `scenes/ketch/ketchShares.js` knows what is owed) through `ketchChestAt(sinceMs, out)` (pure, in
  `scenes/ketch/ketchWake.js`): the rings, the lid, the gold light (a point light, range 6, for 3 s, entered first in the
  channel), the column (`sdStompWall`'s beacon in white-gold, 3 m for 1.5 s), the gun's cradle (a matrix over the pool's
  piece whose item is a Thunderlock or a Pistolet), the gilded wash (the grade's bloom +0.3 for 1.5 s, once). The box's
  collider unchanged.
- **The spill**: `scenes/spoilsPool.js` gains an optional `dropPitch(i)` (default 1); the Ketch passes `ketchSpillPitch(i)`
  - her harmonics 8 to 16 as ratios: 1, 9/8, 5/4, 11/8, 3/2, 13/8, 7/4, 2.
- **The lamps from the door inward**: `ketchLights` marks the cabin's lamps `cabin`; the deck's list lights them only at
  `sg >= KT_STAGE.vault`, each by its distance from the door over 2 s; the table lamp (a light, cabin zone only).
- **The cards**: the share card and the Gilded card through `scenes/ketch/ketchBeats.js` (element 16); KETCHGLD asked by the
  score host when a spilt piece of mine is Gilded (read off the pool's flight list).
- **The stern lift's sink**: a part translation over 0.8 s before `leave`; then the way down's veil.

### Files and new modules

- **New:** `world/ketch/ketchCabinArt.js`, `world/ketch/ketchMasterModel.js`, `src/assets/ketch/master.png`
  (committed, gated)
- **Changed:** `src/world/ketch/ketchModel.js` (the cabin, the chest's parts, the stern glass), `src/world/ketch/ketchArt.js`,
  `src/scenes/ketch/ketchDeckHost.js` (the chest, the lamps' order), `scenes/ketch/ketchWake.js` (`ketchChestAt`),
  `src/scenes/ketch/ketchClient.js` (`openChest`), `src/scenes/spoilsPool.js` (`dropPitch`)

### Cost

Static +2k triangles; parts the lid, the rings and the stern cage (3); the Ketchmaster one batch; records - frieze, stern
glass, panel at 64x64 and the chart at 128x128 (about 160 KB); one light for 3 s and the table lamp (cabin only); the
column one quad; one sting.

### Enhanced lane and classic set

- **Lane**: the stern glass's sky; the sun through the panes across the floor (the cutout in the shadow cascades); the
  chest's gold and the column bloom.
- **Classic**: halos in the chest's mouth and on the lanterns; the panes still show the sky (cutout, not blend).

### Phones

The chart at 64x64; the lantern ring four lamps; the gilded wash kept.

### Lab check

| Knob | What must be true |
|---|---|
| `cabin` at `hour=12\|19\|2` | p50 0.15-0.35; the windows show the hour |
| `?stage=5&chest=closed\|yours\|0.4\|1.2\|3` | the rings dark, then lit; the lid's swing; the gold light; a gun on its cradle at 1.2 |
| `?share=gilded` | the wash, the column, the card |
| `stern-window` | the sky through the panes, the land astern |
| `helm&stage=5` | the doorway's light on the bridge |
| `?law` | no cabin prop inside a walk path but the flat |

### Pins

`ketch_reward.test.js` (new: the spill's pitches walk the ratios; a Gilded piece asks KETCHGLD once; the
cradle only for a Thunderlock or a Pistolet); `test/scenes/ketch_deck_host.test.js` (the chest's states from `owed`; the
lamps lit in door order); `kt_sprite_bake.test.js` (the Ketchmaster's flat). Mutants
`ketch_look_cabin.json`.

---

## 14. Sky, light and air

### What the player sees

**Today**: the lab draws no sky (its clear colour is the fog's foot), so every dusk shot is one flat mauve-brown; in game the
world's sky draws (good), but her light is a two-point lerp between `KT_LIGHT.night` and `.noon` with the sun's colour fixed
(`KT_LIGHT.sun`) at every hour, no grade (`scenes/worldModes.js` grades the Hour, the Spire and interiors, never the Ketch),
and the decks black at dusk and night (floor mean 0.02 - the lane's ambient reaches a face at a third of its value, as
EG-LOOK found, "THE SHADED FACE READS"). The land below is a pale cyan checkerboard (`ketchGroundArt`, a 420 m tile and a
sine river) brighter than the ship (0.51-0.58), the clouds are 34 camera-facing discs with a checkered alpha rim
(`KT_CLOUDS`, `puffArt`), and there are no motes, no weather, no wind.

**The sky is the world's**: its sun, its moons and stars, its clouds, its hour. **Her light by the hour**
(`world/ketch/ketchAtmos.js` `KT_HOURS`, interpolated between rows by `daylightScale` and the dusk window - `ketchSkyFoot`'s
law):

| Row | Ambient | Sun (colour x share) | Fog (colour / density) | Lamps | Grade on the lane (key, max, bloom, vignette, contrast) |
|---|---|---|---|---|---|
| Dawn (5-7) | [0.36, 0.33, 0.36] | [1.0, 0.72, 0.5] x 0.6 | [0.66, 0.52, 0.5] / 0.0020 | x 1.0 | 0.18, 1.6, 0.6, 0.24, 1.04 |
| Day | `KT_LIGHT.noon` [0.56, 0.58, 0.62] | `KT_LIGHT.sun` [1.0, 0.95, 0.84] x 0.85 | `KT_AIR_FOG.color` / 0.0016 | x 0.6 | 0.16, 1.5, 0.7, 0.26, 1.06 |
| Dusk (17-19.5) | [0.34, 0.28, 0.26] | [1.0, 0.62, 0.36] x 0.7 | [0.62, 0.42, 0.36] / 0.0022 | x 1.2 | 0.17, 1.7, 0.65, 0.26, 1.05 |
| Night | [0.25, 0.27, 0.34] (DFU's 0.25 floor under her moon's tint) | the moons' key [0.18, 0.2, 0.28] from the higher moon | [0.05, 0.07, 0.12] / 0.0016 | x 1.4 | 0.16, 2.0, 0.7, 0.30, 1.06 |
| Below decks | [0.26, 0.21, 0.16] | none | [0.16, 0.12, 0.08] / 0.012 | x 1.0 | 0.14, 1.5, 0.75, 0.34, 1.08 |
| The cabin | the hour's row x 0.7 | the hour's, through the stern glass | the hour's | x 1.0 | 0.15, 1.6, 0.7, 0.30, 1.06 |

The sun's colour also follows its elevation (A): [1.0, 0.95, 0.84] above 12 degrees, easing to [1.0, 0.72, 0.42] at 3 and
[0.95, 0.5, 0.3] at the horizon. A trilight (C): the sky term the row's ambient, the equator x 0.8, the ground the deck's
bounce at 0.35 of the sun. **Settled**: the haze by day falls from today's 0.0028 to 0.0016 (A; B's 0.0020) so the city
at 800 m keeps about 28% of its contrast and the land darkens under the hull; at night 0.0016 (B; A's 0.0024) so the city's
lit windows read through it; dawn and dusk between. Dusk is the land amber under a violet sky, never one brown soup; night
is moonlit decks on L1 with the lamps' pools and the keel-light under her, and stars over the bulwarks.

**The land below is Daggerfall's own** (A, C; moments 6 and 12): the real city 260 m down - its own street plan, its roofs
in relief by their building's kind, its walls and keep - and its windows lit after dark; around it the fields on the
terrain's own rise and fall, with the road from the east gate; darker than her hull by day (L0 at most 0.40).

**The clouds**: a **cloud deck** of three broken sheets 60, 110 and 180 m under her keel, drifting on her wind, lit from
above by the sun's colour, gold at dusk, **warm underneath where the city's windows are** (A); about her, **lit cumulus** -
sunlit tops and shadowed bellies, amber at dusk, grey-blue under the moon - drifting through the rigging (C); their cover
the world's weather (clear 20%, cloudy 55%, overcast 85%). Every few minutes **a bank passes through her** when no blow is
live on the open deck: the fog thickens over 4 s, the far rigging fades, the lamps haze, and it clears (C).

**Weather aboard** (A, B): the world's rain and snow fall on her open decks, never below; in a storm, lightning in the cloud
deck under her and its thunder; fog raises the haze fourfold. The rain is heard as the street's: the indoor law already plays
the street's rain bed in a made level at the street's own gain (`scenes/world.js`'s indoor ambience, `underground`, DISC7
B1), so the decks need no host term - B's term would have lowered it.

**The motes** (D's kinds on the Spire's generator, C's counts), every mote a pure function of its seed and the relay's
clock (SD14c's law), none within 3 m over a fight floor (`EG_MOTE_FLOOR`):

| Where | Kinds (count; phones half) | How they move |
|---|---|---|
| open decks, the bridge | vapour 220 (cloud wisps 0.6-1.2 m); soot 120 downwind of the stacks | streaming on her wind at 6-14 m/s - seen with the gust that is heard |
| the top, the Sailwalk | vapour 320; at night ice glints 80 | the same, thicker |
| the gallery | steam droplets 200 | falling slowly, thickest at the lanes |
| the hold | brass dust 260 in the lamps' cones; aether 160 off charged cradles, cells and the fed engine | dust drifting; aether rising, breathing at 0.5 Hz |
| the bridge | aether 120 off true resonators; embers 80 off false ones | aether rising; embers jittering (2 Hz at most) |
| the cabin | dust 80 | still |

**Her breath in the land**: it heaves +-0.6 m on her swell and, at station, swings +-1.5 degrees about the anchor over
40 s - too slow to feel, enough to see the city drift past the rail. Reduced motion holds both.

**She comes about** (moment 12): crews still aboard when she weighs anchor (her crews' last twenty minutes, `KT_LAST_MS`)
see what the street sees - she turns west over a minute (the sun swings across the deck, the shadows wheel), her horn
sounds twice, she gains way, and **Daggerfall slides under her keel** (over its centre about 5.7 minutes after the turn,
`KT_SKY.accel` 0.012 m/s/s) and away astern, past the stern windows; KETCHDEP plays aboard where no fight stands. **The
fight's own turn west** (its last minute's blows) turns the land under the crew's ship the same way: her ship, her
crew's story.

### How it is built

- **The light**: `ketchAtmos.js` `KT_HOURS` replaces `KT_LIGHT`'s two-point lerp in `ketchFrameLook`;
  `renderer.setSceneGrade` per zone from the deck host's `frameLook`, every frame (the renderer takes the lane's defaults
  back the frame it is not called - `render/renderer.js` `_sceneGrade`, taken by the resolve); nothing on classic.
- **The land** (`world/ketch/ketchLand.js`, new, pure): `ketchLandOf({ blocks, location, heights }, out)` builds, over idle
  frames at the stand (at most 8, one record a frame on a phone):
  - **the plate** - Daggerfall's RMB blocks (its location row from MAPS, `world/arena/arenaCity.js` `ARENA_REGION`,
    `ARENA_LOCATION`, as the client's `cityRead` reads it; each block through the blocks file the made level was built from,
    `world/ketch/ketchShip.js` `ketchShipBlocks(real)`, which answers every real name) each give their FLD header's
    **`autoMapData`** (`getBlock(i).rmbBlock.fldHeader`, the path `scenes/snowfallHost.js` reads its ground by) - the 64x64 grid DFU's `ExteriorAutomap` paints, a pixel 1.6 m: the street 0, a building's kind plus
    one, a ground flat 0xfb - which the port already reads for its town maps (`ui/ink/inkTown.js`,
    `ui/exteriorAutomapWindow.js`). From it a 512x512 plate for the city's 819.2 m at the grid's own 1.6 m: streets in cobble,
    roofs by DFU's building groups, ground flats green, quantized to `KT_PAL`;
  - **its windows** - a 512x512 emission of warm window texels seeded along each built island's street edge (more on
    taverns and temples), lit by night through the hour's row;
  - **the city in relief** - each island traced (`inkTown.js` `boundarySegments`, `linkSegments`) and extruded to its
    group's height (houses 7 m, guild halls and temples 12-16 m, the castle's block 30 m) under a flat roof: about 10k
    triangles in one `noShadow` draw, in place of `buildKetchGround`'s 340 random houses (its wall ring, 24 towers and keep
    stay);
  - **the fields** - a 64x64-quad height mesh over 3.2 km from 65x65 heights sampled by `ketchPresence` from the world's
    own `heightAt` (the client's dependency) while she keeps station and the player stands within 600 m of her lift (the
    exterior streams there; spread over idle frames), kept on the client (17 KB) and handed to the deck host at the stand;
    painted in irregular plots of three sizes in Daggerfall's field colours with hedges, the road from the east gate and a
    wandering river (B).
  - **With no data** (the lab, a page with no ARENA2, a reload aboard with no heights): the painted fields on a flat ground
    at `KT_GROUND.y`, and the city painted on `KT_CITY`'s numbers. Pure and deterministic: every crew sees the same
    Daggerfall. It reads the player's own ARENA2 at the stand, never ships a byte of it, is asked again at every stand
    (PLACE-LRU: never kept across an eviction) and is freed with the ship (EVERY ALLOCATION HAS AN OWNER).
- **B's live capture of the world at boarding is left out** (it was admitted only if strictly better than the data;
  it is not): it needs the exterior drawn from a second camera under the veil - no such path exists, and the world host
  would grow; it costs 2 x 4 MB of GPU memory and 40-120 ms inside the veil; it catches only what has streamed at that
  instant, so a fast boarder gets a half-built city and each crewmate a different one; and it cannot light its windows by
  the hour. The data path is deterministic, the same for every crew, lit by the hour, and cheaper.
- **The clouds**: `render/ketch/ktCloudPass.js` (new), one draw: the deck's three sheets (one quad each, 2.4 km, a tiling
  value-noise cover thresholded through Bayer - no blend sorting - posterized to 4 steps, lit from above by the sun's colour
  and from below by the plate's window emission) and up to 40 camera-facing cumulus quads in one dynamic VBO (8 KB) from a
  384x128 atlas of three painted shapes (thickness in alpha, a normal in RG), lit by `sunDir` and the hour, posterized,
  fogged. `KT_CLOUDS`' billboard batch and `puffArt`'s puffs retire.
- **The passing banks**: `ketchStatesOf`'s `passage(t)` - a bank every 210 s on the shared clock (40% of the slots
  sounding), 20 s through, fog density from the hour's to 0.018 and back over 4, 12 and 4 s; only while the eye stands on
  the Anchor Deck, the waist, the top or the Sailwalk and no blow is live on that floor; the telegraphs keep their fog floor.
- **Weather**: a `render/precipitation.js` `PrecipitationRenderer` of the Ketch's own in its pass, and `render/
  lightningBolts.js`, read off `systems/weather/weatherSim.js` `currentWeather()` (a module read - no host term), bounded to
  the open zones.
- **The motes**: `render/ketch/ktMotes.js` (new) on `render/eliteGates/egMotes.js`: its law (`EG_MOTE_LAW_GLSL`), its cell
  wrapped about the eye (`EG_MOTE_CELL` 48 m), its pixel floor (`EG_MOTE_PX`), its floor clearing (`egMoteFloors` over the
  Ketch's floor boxes); `egMoteLayout` generalised to `egMoteLayoutOf(motes, lite, seed)` (the bands' layouts pinned equal);
  kinds added - `vapour` (rise 0, wind 3), `droplet` (rise -1, wind 0), `aether` (rise 1, breathe 1, glow 1), `glint` - and
  soot drawn as the existing `ash` in soot's colour; the layout chosen by `deckZoneAt` with 1 m of hysteresis; one draw
  from the client's `drawPass`.
- **She comes about**: the deck host's pose reads `ketchSkyPose(now)` (the world's own pure pose); while it says
  `departing` the land, the cloud deck, the clouds and the sun's direction are turned by `-pose.yaw` about her middle and
  slid by `-(dx, dy)`; the world's sky by the one term in `createWorldModes`' `drawSky` call (`ketchDeck.skyTurn`). She
  makes 6.5 km in those twenty minutes (`KT_SKY.far`), so the land is two draws: the city, which slides away, and the
  fields' plate, which stays centred under her and scrolls its repeat by `dx` - land without an edge. The fight's turn
  west uses the same turn, ramped over the fight's last 60 s from `ws.ends`. No collider moves.
- **The sun's shafts** (lane): the air pass's shafts follow the frame's sun, which `ketchFrameLook` already hands
  `beginFrame`.

### Files and new modules

- **New:** `world/ketch/ketchAtmos.js`, `world/ketch/ketchLand.js`, `render/ketch/ktCloudPass.js`,
  `render/ketch/ktMotes.js`
- **Changed:** `src/scenes/ketch/ketchDeckHost.js` (`ketchFrameLook`, the land's draws, `skyTurn`),
  `src/world/ketch/ketchModel.js` (`buildKetchGround` the fallback), `src/world/ketch/ketchArt.js` (the fallback fields),
  `scenes/ketch/ketchPresence.js` (the heights), `src/render/eliteGates/egMotes.js`, `src/scenes/worldModes.js` (two
  terms: the sky's turn, the blocks file)

### Cost

- **The land**: 2 draws (from 4 records); about 19k triangles (from 5.7k); 2 MB of plate and windows (phones 256x256,
  0.5 MB); about 30 ms of painting over idle frames.
- **The clouds**: 1 draw, 192 KB; **the motes** 1 draw (about 1,100 points); **the weather** 1-2 draws in rain or storm.
- **Lights**: none. **CPU**: about 0.04 ms (the cloud VBO, the motes' zone, the passage).

### Enhanced lane and classic set

- **Lane**: the grade by hour and zone; the shafts; the air pass's scatter in the passing banks; the windows' bloom
  through the cloud gaps at night.
- **Classic**: the hour's rows through the classic ambient, no grade; the art and the sheets carry the hour.

### Phones

The plate at 256x256 and the relief as walls and keep only; the fields at 32x32; two cloud sheets and 20 cumulus; motes
halved; a fixed haze for the passing banks; no rain or snow; the land's heave and swing held.

### Lab check

| View and knob | What must be true |
|---|---|
| `?sky` | the lab draws a sky (the procedural `render/enhancedSky.js`; with `?arena2`, the world's own) so the decks are judged under one |
| `arrive`, `waist`, `sailwalk`, `bridge`, `city` at `hour=5.5\|7\|12\|18.5\|19.5\|2` | dusk is no longer flat; the ladder at every hour |
| `city`, `sailwalk-down`, `above`, `below` with `?land=data\|painted` | the city from its blocks (with `?arena2`), else the painted land; the land under the hull's mean by day |
| `?weather=clear\|cloudy\|overcast\|rain\|storm\|snow\|fog` | rain on the open decks only |
| `?passage=0.5`, `?motes=0` | the bank at its thickest; the frame without motes |
| `?depart=0\|40\|100\|442\|1141` from `bridge` (seconds since she weighs anchor) | the lift drawn up at 40 (`KT_SKY.lower`); the turn done at 100 (`turnWest`); the city's centre under her keel at 442; gone at 1141 (`KT_SKY.far`) |

### Pins

`ketch_atmos.test.js` (the rows; the night floor; the grade by zone); `ketch_land.test.js`
(new: a fixed block set gives a fixed plate's hash and relief's count; the fallback with no data; nothing of ARENA2 kept
past the ship); `test/render/eliteGates/` egMotes pins (the bands' layouts equal); `test/scenes/ketch_deck_host.test.js`
(the turn under `departing`; no collider moves). Mutants `ketch_look_air.json` (KTL-the-haze-by-night, KTL-the-land-kept,
KTL-rain-below).

---

## 15. Sound - her score, her air and her voices

### What the player hears

**Today**: aboard, the music director plays Daggerfall's dungeon playlist - the made level is a dungeon to it, and
`scenes/world.js` `hourScoreFrame` claims only a Hollow, the Hour and the Spire; the dungeon's ambience is rightly off
aboard (`scenes/dungeonContext.js`, `!_ketch` guards `sceneAmbience.update`) and nothing replaces it; the world's wind
stops in every mode but the exterior (`windAudio.stop()`); the hammers, the steam, the arcs, the lift, the engine, the
cells, the hatches, the sections, the forks and the resonators are silent; the Sailwalk speaks the Hour's sounds; the
Warden speaks in borrowed voices; and from the ground she makes no sound at all.

#### The score of the Ketch

`systems/ketch/ketchScore.js` (new), in `sdScore.js`'s and `egScore.js`'s shape: its own `makeSong(name, bpm, beatsPerBar,
bars, write, level, press)`, laying `tick = (bar * beatsPerBar + beat) * SCORE_TPQ`; one note a key a moment (AUDIT SD III
A8); every voice's program, level and pan at tick 0; `seamless: true`; its own `voices` and `kit` (EG-ROAR, `songVoices`,
`songKit`); `midiNote`, `SCORE_TPQ` and `SCORE_STING_LEAD_MS` from `gateScore.js`; names of eight characters; played by the
game's own player and FM bank under names of their own, each replaceable by a music pack by name. Daggerfall has no
fight music and DFU's `SongManager` plays by place only: a departure, under Ledger A KETCH, as the Hour's was.

| Score | Key | World |
|---|---|---|
| the Warden (`gateScore.js`) | D minor | fire |
| the Hour (`sdScore.js`) | C minor | a clock: harpsichord, wood blocks, Westminster's chime |
| the Spire (`egScore.js`) | E Phrygian | the Battlemages' fanfare and the legion's drums |
| the Arena (`arenaScore.js`) | B-flat major | a march |
| **the Ketch** | **A, the acoustic scale (her keel's harmonics 8-14), over an A pedal, in six** | the Rourken brass, a natural horn on her harmonics, tuning-forks, a steam whistle, the engine's tuba and piston, a ship's bell rung two and two, the crew's concertina. No wood blocks, no harpsichord, no 3-3-2. Her harmony is A7, which never resolves to D; D major sounds once, in KETCHGLD |

**Channels** (CC7 level, CC10 pan; own voices in `songVoices`' ranges):

| ch | Voice | GM | Level, pan | Own voice |
|---|---|---|---|---|
| 0 | keel | 19 church organ | 92, 64 | unison 2, cents 3, sub 0.4, index 0.9, attack 0.4, release 1.2 |
| 1 | bass | 32 | 98, 64 | index 2.2 |
| 2 | strings | 48 | 104, 84 | attack 0.14, release 0.7, unison 3, cents 12, spread 0.5 |
| 3 | brass | 61 | 120, 52 | "tonal brass": mod 1.41, index 3.6, idxDecay 0.6, attack 0.05, unison 3, cents 7, spread 0.35 |
| 4 | choir | 52 | 108, 74 | low and male: mod 1, index 1.2, attack 0.25, unison 3, cents 12, spread 0.45 |
| 5 | horn | 60 | 116, 40 | natural horn: attack 0.08, index 2.4, idxDecay 0.8, unison 2, cents 5, spread 0.2 |
| 6 | timpani | 47 | 112, 64 | decay 0.9, release 0.5 |
| 7 | forks | 8 celesta | 100, 30 | tuning-fork: mod 1, index 0.12, idxDecay 2, attack 0.004, decay 2.4, sustain 0, release 1.8 |
| 8 | reed | 21 accordion | 104, 90 | concertina, two reeds 9 cents apart: mod 1, index 1.6, unison 2, cents 9, spread 0.3 |
| 9 | kit | - | 116 | `KETCH_KIT` |
| 10 | whistle | 78 | 98, 70 | steam whistle: mod 2, index 0.6, attack 0.06, sustain 0.9 (its glides are bends) |
| 11 | tuba | 58 | 110, 60 | the engine's stroke: index 2.2, decay 0.3, sustain 0.4, sub 0.35 |
| 12 | harp | 46 | 92, 24 | the wind in the stays: glissandi up her scale |
| 13 | hit | 55 | 106, 64 | index 4.5, decay 0.5, unison 2, cents 15, sub 0.35 |
| 14 | bells | 14 | 98, 100 | ship's bell: mod 1.4, index 6, idxDecay 0.5, decay 1.4, sustain 0.02, release 1.0 |
| 15 | swell | 119 | 86, 64 | the Spire's swell (`SPIRE_VOICES.swell`) |

**The kit** (`KETCH_KIT`): the piston on kick 36 (hz 46, decay 0.22, gain 1.2, click 0.65); the chuff on open hat 46 (hz
3000, q 0.5, decay 0.35, gain 0.8); the anvil on ride bell 53 (hz 1650, decay 0.9, gain 0.7, click 0.7, the Spire's); the
taiko on surdo 87 (hz 60, decay 0.95, drop 0.7, click 0.45); rim 40, snare 38 and toms 41-48 the Spire's; crash 49 and 57;
chinese 52; the chain on shaker 82 (decay 0.06). **The lilt in six**: the taiko on beats 0 and 3, the piston on 0, 1.5, 3
and 4.5 (her fed stroke), the chuff a quarter beat after each piston, the rim on 2 and 5.

**Voicings** (`KETCH_CHORDS`; arps six notes up and back in eighths, twelve a bar):

```
chord      bass  timp  pad (keel/organ)   strings      choir        arp
A7         A1    A2    A2 E3 G3 C#4       C#4 E4 G4    A2 E3 C#4    A2 E3 A3 C#4 E4 G4
A          A1    A2    A2 E3 A3 C#4       C#4 E4 A4    A2 E3 C#4    A2 E3 A3 C#4 E4 A4
B          B1    F#2   B2 F#3 D#4         D#4 F#4 B4   B2 F#3 D#4   B2 F#3 B3 D#4 F#4 B4
G+         G1    G2    G2 D#3 B3          B3 D#4 G4    G2 D#3 B3    G2 D#3 G3 B3 D#4 G4
F#m        F#1   F#2   F#2 C#3 A3         A3 C#4 F#4   F#2 C#3 A3   F#2 C#3 F#3 A3 C#4 F#4
Em         E1    E2    E2 B2 G3           G3 B3 E4     E2 B2 G3     E2 B2 E3 G3 B3 E4
E          E1    E2    E2 B2 G#3          G#3 B3 E4    E2 B2 G#3    E2 B2 E3 G#3 B3 E4
C#dim      C#2   C#2   C#3 G3 E4          C#4 E4 G4    C#3 G3 E4    C#3 E3 G3 C#4 E4 G4
G          G1    G2    G2 D3 B3           B3 D4 G4     G2 D3 B3     G2 D3 G3 B3 D4 G4
Am7        A1    A2    A2 E3 G3 C4        C4 E4 G4     A2 E3 C4     A2 E3 A3 C4 E4 G4      (starved: the third gone)
F          F1    F2    F2 C3 A3           A3 C4 F4     F2 C3 A3     F2 C3 F3 A3 C4 F4
Adim       A1    A2    A2 Eb3 C4          C4 Eb4 A4    A2 Eb3 C4    A2 Eb3 A3 C4 Eb4 A4
Eb         Eb2   Bb2   Eb3 Bb3 G4         Eb4 G4 Bb4   Eb3 Bb3 G4   Eb3 Bb3 Eb4 G4 Bb4 Eb5
C          C2    C2    C3 G3 E4           C4 E4 G4     C3 G3 E4     C3 G3 C4 E4 G4 C5
D          D2    D2    D3 A3 F#4          D4 F#4 A4    D3 A3 F#4    D3 A3 D4 F#4 A4 D5     (KETCHGLD only)
A5 G5 B5 E5 F#5   root octave 1, timp octave 2, pad root-fifth-octave        (the Gallery's open fifths)
```

**The motifs** (`[note, beats]`; a bar is six beats unless said):

```
KT_KEEL        (the Keel-Song: up her harmonics like a horn call, the Lydian D# turning home)
  b1: [A3,1] [E4,1] [A4,1] [C#5,2] [E5,1]        b2: [D#5,1.5] [E5,0.5] [C#5,1] [B4,1] [A4,2]
KT_KEEL_FALSE  (the Discord's: third and fifth flattened - A diminished, turning on D natural)
  b1: [A3,1] [Eb4,1] [A4,1] [C5,2] [Eb5,1]       b2: [D5,1.5] [Eb5,0.5] [C5,1] [Bb4,1] [A4,2]
KT_KEEL_TRUE   (the fall's: turning on F# - no seventh - rising to the octave)
  b1: [A3,1] [E4,1] [A4,1] [C#5,2] [E5,1]        b2: [F#5,1.5] [E5,0.5] [C#5,1] [E5,1] [A5,2]
KT_CALL        (her horn: harmonics 4-5-6-8, then the seventh held - the call that never lands)
  b1: [A3,1.5] [C#4,0.5] [E4,1] [A4,3]           b2: [G4,6]
KT_WARDEN      (the Steersman: the Keel-Song turned upside down, always turning on D#-E)
  b1: [E5,1] [C#5,1] [A4,1] [E4,2] [A3,1]        b2: [G4,1.5] [F#4,0.5] [E4,1] [D#4,1] [E4,2]
  b3: [C#5,1] [B4,1] [G4,1] [E4,2] [B3,1]        b4: [D#4,3] [E4,1] [G4,1] [A4,1]
KT_ENGINE5     (the starved stroke, a bar of FIVE on the tuba - the sixth missing)
  [A1,1] [rest,0.5] [E2,0.5] [A1,1] [A1,0.5] [G1,0.5] [rest,1]
KT_ENGINE6     (the fed stroke, a bar of six)
  [A1,1] [E2,0.5] [A1,0.5] [A1,1] [E2,1] [A1,0.5] [G1,0.5] [A1,1]
KT_SHANTY      (the crew's, on the concertina: A mixolydian - the crew's D natural against the ship's D#)
  b1: [E4,1] [A4,1] [A4,1] [A4,1.5] [B4,0.5] [C#5,1]    b2: [D5,2] [C#5,1] [B4,2] [G4,1]
  b3: [A4,1] [B4,1] [C#5,1] [E5,1.5] [D5,0.5] [C#5,1]   b4: [B4,1] [G4,1] [B4,1] [A4,3]
KT_BELLS(n)    (a ship's bell: strikes in pairs half a beat apart, pairs a beat and a half apart; an odd n ends on one)
KT_WHOLE       (the stays' glissando: her scale up in sixteenths, A3 to A5, on the harp)
```

**The seventeen songs**, in the order a voyage hears them (D's eighteen less the sighting sting, the owner's ruling 2).
"Lock": `voyage` - bar 0 at the voyage's `at`; `fight` - bar 0 at `ws.op`; the hazards' - their cycles at relay time 0;
`whole` - a sting played whole from its own first note.

| Song | Where, when | BPM / meter / bars (s) | Lock | Bar by bar |
|---|---|---|---|---|
| KETCHSKY | outdoors within 450 m of her lift while she keeps station (ruling 2) | 76 / 6 / 32 (151.6) | voyage | 4 x `A7 A7 B/A A7 F#m/A B/A Em/A A7` over the keel's A1 held throughout: 0-7 the keel and the strings' pad, the harp's `KT_WHOLE` into each fourth bar; 8-15 `KT_CALL` on the horn at 8 and 12; 16-23 `KT_KEEL` on the horn in augmentation; 24-31 the choir under it, `KT_CALL` low on the brass at 28; the taiko on 0 every other bar, the chain on 4.5; `KT_BELLS(2)` at bar 0 |
| KETCHDCK | the open decks at rest (before the first wave; after the Watch) | 92 / 6 / 32 (125.2) | voyage | 4 x `A7 B A7 G+ F#m B Em A7`: 0-7 the keel, the harp's arps, the whistle's A4 then G4; 8-15 `KT_SHANTY` on the concertina; 16-23 `KT_KEEL` on the brass, mezzo; 24-31 the shanty over the Keel-Song, an octave apart - the crew on her deck; the lilt at half |
| KETCHWAT | the Boarding Watch, from the first wave's word | 132 / 6 / 32 (87.3) | voyage | 4 x `A7 G F#m B A7 G Em E`: the lilt in full; brass stabs on 0 and 3; `KT_BELLS(2)` "all hands" at 0, 8, 16, 24; 8-15 `KT_KEEL` on the brass; 16-23 `KT_CALL` on the horns over spiccato strings; 24-31 `KT_KEEL` on brass and choir, a toms' fill into each fourth bar, a crash each eighth |
| KETCHGAL | the gallery and the landing while the gallery is the stage | 120 / 6 / 32 (96) | **the hammers: a bar is `KT_HAMMER.cycle` 3.0 s** | 4 x `A5 G5 A5 B5 A5 G5 F#5 E5`, open fifths: the anvil on every beat (110 on 0 and 3, 76 the rest) - the hammers' slams, locked; the chuff every four beats - the steam's hemiola; the tuba's `KT_ENGINE6` every bar; 0-15 low brass in fifths; 16-31 `KT_WARDEN`'s first two bars low on the horn (the Hammer Wardens); the whistle (A4 bent -200 to 0 cents over a beat) at 7, 15, 23, 31 |
| KETCHENG | below decks while the engine starves (the hold; the gun deck once its Wardens fall) | 120 / **5** / 32 (80) | **the arcs: two bars are `KT_ARCS.cycle` 5.0 s** | 4 x `Am7 G Am7 Em Am7 G F E` - the C natural, the keel's third gone: the tuba's `KT_ENGINE5` every bar; the piston on 0 and 2.5 and **nothing on beat 4**; the forks on A4 struck on the arcs' downbeats; 8-15 the strings' pad; 16-31 `KT_KEEL_FALSE`'s first bar on the brass every four bars; the whistle bending down at 15 and 31 |
| KETCHWAK | the engine wakes (`sg` reaches the Sailwalk), anywhere aboard | 120 / 5 then 6 / 2 + 4 (17) | whole | bars 0-1 in five: Am7, the tuba stumbling, the swell into bar 2; **bar 2 in six: the sixth stroke lands** with the hit on A7, the whistle A4 bent from -200 to 0 over two beats, the timpani on A2; bars 2-3 `KT_CALL` on brass and horns; bar 4 A, the third restored on strings and choir; bar 5 the ring, the keel alone |
| KETCHSAL | below decks once the engine is fed, the mast-lift, the top, the yard, the Sailwalk | 100 / 6 / 32 (115.2) | **the Beat: a bar is `EG_BEAT_CYCLE_S` 3.6 s** | 4 x `A7 B/A A7 C#dim F#m B G+ E`: beat 0 the forks' tick and the low tom (plate A arrives), beat 3 the forks a fifth up and the rim (plate B) - locked; the harp's `KT_WHOLE` into each fourth bar; 8-15 `KT_KEEL` on the horn; 16-23 `KT_CALL` high on the brass; 24-31 the Keel-Song and the shanty together - the crew crossing her |
| KETCHHLM | the bridge before the fight wakes, and after a lost one | 84 / 6 / 16 (68.6) | voyage | 2 x `A7 G+ A7 B A7 G+ Em A7`: the organ, the forks' `KT_KEEL` slow, the bells once each fourth bar; no kit |
| KETCHWR1 | phase 1, the Steersman | 138 / 6 / 32 (83.5) | fight | 4 x `A7 G+ F#m B A7 G+ C#dim E`: the lilt in full, `KT_ENGINE6` in eighths, brass stabs on 0, 1.5, 3; 8-15 `KT_WARDEN` on the brass; 16-23 `KT_WARDEN` on horns and choir against `KT_KEEL` on the forks; 24-31 `KT_WARDEN` on the brass with the hit each bar; the taiko's fill into each fourth bar |
| KETCHWR2 | phase 2, the Discord | 144 / **7** / 32 (93.3) | fight, **and detuned live** | 4 x `Adim Eb Adim Eb F#m C G+ E` - the A against its tritone, C natural against the keel's C#: the lilt plus a seventh beat on the rim (taiko 0 and 3, rim 6, piston 0, 2, 4); `KT_KEEL_FALSE` on the brass at 0, 8, 16, 24; `KT_WARDEN` on the horns at 8-15 and 24-31; the forks struck sour on beat 6 |
| KETCHWR3 | phase 3, the Last Note | 152 / 6 / 32 (75.8) | fight | 4 x `A7 B G+ A7 F#m B C#dim E`: the piston on every eighth, the choir chanting each beat, the strings' arp in sixteenths; `KT_KEEL` on the brass in diminution at 0-7 and 16-23, `KT_WARDEN` on the horns at 8-15, both at 24-31; `KT_BELLS(4)` each eighth bar |
| KETCHSNG | the Keel-Song's 8 s (`ws.fk`) | 135 / 6 / 4 (10.7) | **its fourth downbeat at `fk.at`** (three bars are 8.000 s) | bars 0-2: the keel's A1 pedal, the timpani rolling up, the choir singing `KT_KEEL` in augmentation (x1.5), the forks struck every beat, the strings holding A4 with a bend rising 0 to +200 cents (the whine); bar 3 beat 0: the full A7 hit; the law leaves the song at the stun or after the landing |
| KETCHWST | the fight's last minute before she turns west | 160 / 6 / 16 (36) | bar 0 at `ends - 60000` | 2 x `A7 Eb A7 Eb A7 Eb E E`: the ship's bell tolling every bar, counting, a semitone higher each eight; `KT_CALL` in octaves every two bars; the piston on every eighth |
| KETCHFEL | the fall, anywhere aboard (`KT_SCORE_FELL_MS` 18.5 s from its first note) | 84 / 6 / 8 (34.3) | whole | bar 0 the timpani roll, the choir on A3 E4 A4; bars 1-2 `KT_KEEL_TRUE` on brass and horns over A (no seventh) and E; **bar 3 eight bells** (`KT_BELLS(8)`): the watch is over; bars 4-7 the ring, the organ's A, the harp once |
| KETCHCAB | aboard once the cabin is open (`KT_STAGE.vault`) | 72 / 6 / 24 (120) | voyage | 3 x `A G A Em F#m G E A` - no D chord: `KT_SHANTY` on the concertina at 0, 8, 16; the harp; the forks' `KT_KEEL` once at 20; the taiko's lilt light; `KT_BELLS(1)` each eighth bar |
| KETCHGLD | a Gilded gun of mine spilt (`KT_SCORE_GILD_MS` 9 s) | 88 / 6 / 3 (12.3) | whole | bar 0 A7 with `KT_CALL`'s first bar on the horns; **bar 1 D major - the one D in her score**: brass, horns and choir on D, the shanty's last phrase landing `[F#5,1] [E5,1] [D5,4]`, the bells on D5, the hit on D; bar 2 the ring |
| KETCHDEP | weighing anchor: aboard with no fight on my floor, or outdoors within 2.5 km of her (ruling 2) | 69 / 6 / 24 (125.2) | voyage | 3 x `A7 A7 G+ G+ F#m B A7 A7`: `KT_CALL` on the horn at 0, 8 and 16, each at 0.85 of the velocity before - receding; the keel; the harp's glissando; no kit |

**The law** (`ketchScoreFor(p)`, pure): the place `p` is the client's - `{ aboard, zone, sg, wv, ws, cl, voyage, outside:
{ liftM, herM, phase }, dead, gild }` - and the answer is a song's name, `KT_SCORE_SILENCE`, or null (the director
stands). `KT_SCORE_PRIORITY` is pinned, as `EG_SCORE_PRIORITY` is; the first row that applies plays:

```
KT_SCORE_PRIORITY = [dead, fell, gild, wake, west, song, last, war, helm, cabin, sail, engine, gallery, watch, deck, depart, sky]
  dead     aboard and health 0                                         -> silence (the Hour's AUDIT SD III A5)
  fell     ws.fell, within KT_SCORE_FELL_MS of its first note          -> KETCHFEL, then KETCHCAB anywhere aboard
  gild     a Gilded piece of mine spilt, within KT_SCORE_GILD_MS       -> KETCHGLD
  wake     sg reached the Sailwalk, within KT_SCORE_WAKE_MS            -> KETCHWAK
  west     bridge, gangway or cabin, and the fight ended (ended, or now >= ends) -> silence (the air carries the turn)
  song     on the bridge, ws.fk and now < ws.fk.at                     -> KETCHSNG (locked to land at fk.at)
  last     on the bridge, and ws.ends - now <= KT_SCORE_LAST_MS (60 s) -> KETCHWST
  war      bridge or gangway, ws live, now >= ws.op                    -> KETCHWR{ph}
  helm     bridge or gangway otherwise (asleep, none, lost)            -> KETCHHLM
  cabin    aboard and sg >= vault                                      -> KETCHCAB
  sail     zone top, sailwalk or lift; or hold, gallery, landing with sg >= sailwalk -> KETCHSAL
  engine   zone hold with sg engine; or gallery, landing with sg == engine -> KETCHENG
  gallery  zone gallery or landing, sg gallery                         -> KETCHGAL
  watch    zone anchor or waist, sg watch, wv > 0                      -> KETCHWAT
  deck     aboard otherwise                                            -> KETCHDCK (while she weighs anchor: KETCHDEP)
  depart   outside, she weighs anchor, herM <= KT_SCORE_DEPART_M (2,500) -> KETCHDEP
  sky      outside, she keeps station, liftM <= KT_SCORE_LIFT_M (450)  -> KETCHSKY
```

The zone is `deckZoneAt`, held 4 m past the edge it began at (`KT_SCORE_HOLD_M`, the Hour's AUDIT SD III A10). Stings play
whole from their own first note (`createHourScore`'s law); a sting heard over 1.5 s late goes straight to what follows. The
music holds through the step (`modes()?.transitioning`, A1's law), so KETCHSKY becomes KETCHDCK with no dungeon song
between. Everywhere else the region's music plays as now.

**Two new powers of the game's own player** (shared code, small, pinned):

1. **THE CLOCK LOCK.** `systems/song/songPlayer.js` `SongPlayer.play(song)` reads `song.startTick?.()`, modulo
   `durationTicks`, in place of 0: `_cursorTick` is set to it, the controls before it folded through the player's own `_skip`
   (AUDIT 19 F8's door), and `_originTime` set back by that many ticks. The Ketch's songs carry `startTick: () =>
   ketchLockTick(name)`, which reads the relay's `now` and the lock's epoch; the tick is read when the song actually begins,
   after any switch's fade. A song re-entered resumes where the ship's time stands, every crewmate hears the same bar, and
   the Gallery and the Sailwalk play in time with their hazards. A song with no `startTick` (every other song in the game)
   is untouched. About 8 lines.
2. **THE DETUNE.** `SongPlayer.detune(cents, seconds, channels)` (and `music.detune`, passed through as `duck` is): a
   per-channel offset added to the bend of every sounding voice of those channels (each voice's `detunes`, the bend's own
   path) and of every new note, glided over `seconds`, reset to 0 at the next song. In KETCHWR2 the host asks
   `music.detune(-40 * false / 4, 0.4, [0, 3, 5, 7, 10])` each frame - the keel, the brass, the horn, the forks and the
   whistle; the strings, choir, reed, bass and kit stay true (the world's and the crew's). Each resonator put right takes 10
   cents of sourness away; all four true at the stun, the score is in tune and the stun's chord rings with it. About 15
   lines.

**Levels and press** (the Hour's law, `HOUR_LEVEL` and `HOUR_PRESS` shapes; the press the Spire's, EG-ROAR - ratio 3,
attack 0.012, ceiling -1): SKY 1.2 / 4.0; DCK 1.25 / 4.2; WAT 1.45 / 5.0; GAL 1.42 / 5.0; ENG 1.38 / 4.8; WAK 1.6 / 5.6; SAL
1.4 / 4.8; HLM 1.3 / 4.4; WR1 1.45 / 5.2; WR2 1.55 / 5.4; WR3 1.62 / 5.6; SNG 1.66 / 5.8; WST 1.68 / 5.8; FEL 1.7 / 5.6; CAB
1.25 / 4.2; GLD 1.6 / 5.4; DEP 1.2 / 4.0. Measured targets: the places (DCK, SAL, HLM, CAB) -19 to -20 dBFS; SKY and DEP
-21 (under the world's air); WAT, GAL, ENG -17; the war -16.4 / -15.6 / -14.6; SNG and WST -14.2; FEL -14.8; GLD -15.2.
Every peak under -1 dBFS at the highest music volume; every second sounding; every lock within 30 ms.

**The host**: `scenes/ketch/ketchScoreHost.js` (new; `systems/eliteGates/egScore.js` `createSpireScoreHost`'s shape):
songs registered on the first boarding or the first time she is near, made lazily a song at a time (the Spire's `made`
memo); the law's song played or faded; the stings' first notes; the locks' epochs; the detune. It imports the music service
(`systems/music.js` `music`); the client's `scoreFrame()` frames it, reached by the one term in `hourScoreFrame`.

#### Her air

`scenes/ketch/ketchAir.js` (new; `scenes/superDungeon/sdAir.js`'s engine law): beds made from the player's DAGGER.SND
through `audio.setBed` and `setBed3d`, made once the archive is read and asked again until then, built one a frame (at most
10 ms each, `egAir.js`'s law); events on the clock in seeded slots whole over `KT_AIR_PERIOD` (720 s), each from a stand-in
held at its bearing (`scenes/deadlandsAir.js` `airSourceAt`); let go the frame I leave her (`audio.fadeFar`, AUDIT SD IV
A5's law).

| Bed | Made of | Level |
|---|---|---|
| `ktair:rig` (23 s) | AmbientWindBlow1/1a/1b (70-72) laid by `sdAir.js` `layBed` (n 10, pitch 0.85, spread 0.18, 3.2 kHz) over the world's wind bed at 0.6 | deck 0.22, aloft (top, Sailwalk, gangway) 0.32, bridge 0.24, below 0.05, cabin 0.07; times `0.55 + 0.45 x gust(t)`; on the Sailwalk raised one second ahead of the Rotten Rigging's gust; in the shaft by the ear's height |
| `ktair:hull` (29 s) | AmbientDoorOpen 67 and NormalDoorOpen 94 at pitch 0.45-0.62, six seeded passes, AmbientGrind 68 at 0.3 under them | deck 0.16, below 0.30, cabin 0.24; times `0.6 + 0.4 x gust(t - 0.4)` - the hull creaks 0.4 s behind the gust |
| `ktair:keel` (12 s, 11,025 Hz) | A1 and A2 from AmbientStrumming 69 resampled, two copies 0.15 Hz apart (a slow beat) | 0.18 everywhere aboard |
| `ktair:keelup` (12 s) | her partials h3-h8 at `1/k^1.3`, low-passed at 1.4 kHz | 0.12; its pitch sours in the Discord (`2^(-40 x false / 4 / 1200)`); without h7 on a device whose crew took her helm (the true chord) |
| `ktair:eng:hK` (eight, 4 s each) | her partial `55 x K` Hz from AmbientStrumming, a 0.1 Hz wobble | 3D at `KT_ENGINE` (ref 6 m, reach 60 m), `0.5 / K^0.7`; a bed fades in over 1.5 s as `cl.bk` passes its place in `KT_ENGINE_HARMONICS[nd]` |
| the coils (three) | `kt:buzz`, a 100 Hz saw with crackle (2 s) | 3D at each coil (ref 3 m, reach 30 m): live 0.8, through the wind-up `0.25 x k`, else 0.06 |
| the gun deck | ArenaFireDaemon 11 at pitch 0.7 (Kamer's mill), the pipes' hiss | 3D at (0, -6, 90), ref 10 m, reach 50 m |
| the resonators (four) | `kt:resTrue:k` (one sine at its harmonic) or `kt:resSour:k` (two sines 6 Hz apart, -40 cents) | 3D at each pylon, 0.25 (ref 3 m, reach 22 m), switched by `ws.rs[k]` |
| the forks (up to seven) | fork `c` at h(8+c) | 3D at each standing fork, 0.3 (ref 2 m, reach 18 m) |
| the cells | an A3 and E4 hum | 3D at each charged cradle and lying cell, the nearest four; mine in the hands 2D, low |

**Events** (`ketchAirEvents(from, to)`, pure): a gust's moan in the stays (slot 18 s, 55%, clip 65, windward +6 m); a block's
knock aloft (9 s, 50%, 433 at 0.4-0.6); a vane's creak as it feathers (24 s, 45%, 433 x3 at 90 ms); a valve venting (30 s,
40%, `kt:hiss`); **the city far below** - the ship's bell from Daggerfall's bearing 260 m down on the world's hour (60 s,
35%, 107 at 0.06-0.1); thunder in the world's storm; **the watch bells** (element 1) aboard too, on the relay's clock.

**The machines heard**, each a pure function of the shared clock or of a word, once an occurrence, 3D at its source - the
same moments the relay judges (`hazardsBetween`, which `ketchFight` already walks: the list is passed, nothing walked
twice):

| Machine | Wind-up | Landing or run |
|---|---|---|
| a hammer (`KT_HAMMER.wu` 1 s) | a steam lift (`kt:hissRise`, 0.6 s) and a ratchet (433 at 1.6 x2) | `kt:slam` - Hit3 110 at 0.5, FallHard 92 at 0.6, BodyFall 15 at 0.45 and the bell 107 at 1.9 cut at 0.25 s: an anvil's ring (ref 4 m, reach 40 m, linear); within 18 m, at most two a half-second slot, the nearest |
| a steam lane (0.9 s) | the hiss swelling | 1.2 s of `kt:hiss` with Burning 420 at 1.4 crackling, at the lane's point nearest the ear |
| an arc (0.8 s) | its buzz bed rising | StormLightningShort 348 at 1.3 cracking at its start; the buzz at full through its 1.4 s |
| the lift | - | the chain's run while it moves; the ratchet four a second; a clank (24 at 0.6, 433 at 0.8) and the bell at each landing |
| a cell | pick: a clamp's clack and a glass ring | set: a clunk (433 at 0.8), the bubbles (114 at 0.5), a sine gliding A2 to A3 over 0.6 s - the engine drinks - and its partial joins the hum; knocked loose: a glass clatter (433 at 2.0, 342 at 2.4), the hum dropping a fourth to E3, its tremolo quickening 1 to 2.5 Hz as it bleeds; bled out: the hum gliding down an octave over 0.8 s |
| a hatch | - | a bolt drawn, then the chain |
| a section | a groan rising through its 3 s (68 at 0.35 and 67 at 0.4, 0.6 to 1.2) | `kt:fallaway` (433 at 0.4, 342 at 0.5) on a source dropping 40 m in 2 s; its return a clank |
| a resonator | false: its sour bed | put right: its glide into tune and the bell struck at its pitch |
| a fork | standing: its partial | struck: a ping at its pitch; broken: shards (342 at 2.0) and its bed stops |
| her horn | - | each stage's turn, the Warden's wake and fall, weighing anchor |

**The rooms' reverb**: `scenes/ketch/ketchReverb.js` (new; `systems/eliteGates/egReverb.js`'s law: a zone by `deckZoneAt`,
1 m of hysteresis, a 0.4 s crossfade, `audio.holdReverb('kt:ship')` so Better Ambience yields), with four of Unity's own
AudioReverbPreset rows (EAX's table) added to `systems/reverbPresets.js` `REVERB_PRESET` beside Cave, Stoneroom and Quarry, in their fields (millibels and seconds;
`HFReference`, `diffusion` and `density` copied from Unity's rows with the rest):

| Preset | room / roomHF | decay (s) / HF ratio | reflections / delay | reverb / delay | Where |
|---|---|---|---|---|---|
| Mountains | -1000 / -2500 | 1.49 / 0.21 | -2780 / 0.300 | -1434 / 0.100 | the decks and the Sailwalk - a late, faint single echo off 260 m of air |
| Hallway | -1000 / -300 | 1.49 / 0.59 | -1219 / 0.007 | 441 / 0.011 | the gun deck |
| SewerPipe | -1000 / -1000 | 2.81 / 0.14 | 429 / 0.014 | 1023 / 0.021 | the hold, an iron tube |
| Room | -1000 / -454 | 0.40 / 0.83 | -1646 / 0.002 | 53 / 0.003 | the cabin |

**The mix**: `systems/eliteGates/egMix.js` `createSpireMix` reused - peers' sounds 4 dB down, barks at most four a kind
(`egBarkCull`), a personal sting for a Warden blow on my feet (`BOSS_CUES.sting` at 2.2) and the critical duck (6 dB, 300
ms) for each whole-bridge blow.

#### Her voices

`scenes/ketch/ketchVoice.js` (new; `scenes/superDungeon/sdRemnantVoice.js`'s law: read off the fight each frame, a turn
heard as it happens, a wake or fall heard over 1.5 s late never sounded), framed inside `ketchFight.frame()` in place of
its `play(BOSS_CUES.growl, at)` and `play(hostCue('hurt', KT_WARDEN_LOOK.mobile), at)`.

**The Warden speaks in its keel's harmonics.** Every bark is the Iron Atronach's (223) **tuned**: its fundamental measured
once by autocorrelation over 60-400 Hz (`systems/ketch/ketchSound.js` `pitchOf`), resampled to land on a harmonic of A
(`tuneTo`), and doubled by a pure fork tone at the octave and the fifth - never the Remnant's (`SD_VOICE_CUES`, the same clip
pitched for size) nor the Oblivion Warden's (`BOSS_CUES.growl`, which goes).

| Cue | Tuned to | Volume, reach | When |
|---|---|---|---|
| growl | A2 | 0.9, 60 m | not striking: every 8 s plus a seeded part of 6 |
| wake | E2, the keel's hum surging | 2.0, 160 m | at `ws.op` |
| hurt | A3, short | 0.8, 40 m | each 0.4% lost, 1.4 s apart (`SD_HURT_FRAC`'s law) |
| the Discord begins | Eb3, the tritone | 2.0, 160 m | phase 2 |
| the Last Note | A2, the forks rising under it | 2.1, 160 m | phase 3 |
| stunned | C#3, cut at 0.4 s | 1.8, 120 m | the ward broken, or the song broken |
| fall cry | A1 | 2.0, 160 m | its fall |

Its body: a stride every 3.0 m walked (the move clip 222 tuned to A1, the bridge's plates under it, 92 at 0.5); the plates
ring once (107 at 0.25) when it falls. Each blow its own wind-up (WB13d's four-semitone law) and its release 350 ms before
it lands (`SD_RELEASE_MS`): the Keel-Strike - the bark tuned E3 and the keel's hum +6 dB over its 1.9 s, released as
SwingLowPitch 105 at 0.4 with the deck's groan; the Steam Lash - the whistle sliding A4 to E4 over 1.7 s, released as a hiss
burst; the Tonal Ring - a fork tone climbing A4 to E5 over 1.8 s, released as the bell tuned to E3, struck. **The Tonal
Wave is heard arriving** (moment 9's floor): a ringing tone (the bell tuned to A3, long) rides the wave's front, its source
placed on the ring's radius toward the ear (the blow's `shRing` stamp; `KW_BLOWS.ring.wave`'s `r1` 20 and `after` 900, the
Captain's `stomp.wave`), so it passes your ears as the front does: jump on the note. **The Discord**: every false resonator
howls, their sour tones swelling over the 2.5 s into a cluster (-40, -20, +25, -35 cents); it lands with a crash
(SpellImpactMagic 86 at 0.5 and 342 at 0.6) and the critical duck; through phase 2 the score is out of tune and so is the
keel's upper bed; warded, blows ring dull (433 at 0.7) and its body hums sour; at the stun the bark cuts off and the four
resonators' chord strikes true. **The Keel-Song**: the forks hum her scale; **the Warden sings the Keel-Song** - `kt:keelsong`,
made once (8.0 s), each note a fork tone over the tuned bark at -12 dB over the keel, 3D from the Warden (ref 20 m, reach
120 m), started so its last note lands at `fk.at` in time with KETCHSNG; each fork struck pings at its pitch, each broken
shatters and its note leaves the song; all broken, the song cuts mid-note (60 ms) into `kt:break` and the stun; one left, it
lands - the standing forks' chord struck with SpellImpactMagic 86 and FallHard 92, the heal heard as the forks' tones gliding
up an octave into the Warden. **The turn west**: the score silent, the ship groaning (67 and 68 at 0.3), the mill running up,
the hum rising a fifth over the minute. **Lost**: the bridge quiet but the lodestone's A5 and one far toll. **Fallen**: the
cry, the crash 1.1 s later (`KT_FALL_MS`), the plates' ring, and KETCHFEL's eight bells. **The lodestone** sings A5 faintly
behind the helm (a sine with a 0.3 Hz tremolo, 0.08, ref 1 m, reach 10 m).

**The constructs** (`KT_CONSTRUCT_CUES`, in place of `hostCue` for the four machine bodies; the Spider keeps its own clips,
mobile 6, 133-135):

| Construct | Rise | Stride, move | Wind-ups | Land, hurt, fall |
|---|---|---|---|---|
| Sphere | lowered: 433 at 1.3 and 24 at 1.6 (the clank of landing) | rolling: the mill (11) at 1.6, the nearest three | lunge: SwingHighPitch 106 at 0.8; spark: `kt:buzz` rising | land Hit2 109 at 0.9; hurt 433 at 1.8; fall 342 at 2.2 and 15 at 1.2 |
| Sentry | climbs from below: 68 at 0.8 | - | bolt: a crank (433 at 1.2 x3, 150 ms apart) released as ArrowShoot 3 at 0.8; volley: three of them, 120 ms apart | land: the shock's made impact (`systems/spell/spellImpactSound.js`); hurt 433 at 1.5; fall 15 and 342 at 1.8 |
| Spider | its own at 1.3 | `kt:skitter` (433 at 2.2, fourteen a second) each 1.2 m | sting: `kt:hissRise` | its own |
| Hammer Warden | wakes like a furnace drawing breath: `kt:bellows` (a noise swell, 1.2 s) and 107 at 0.35 | 92 at 0.55 each 2.4 m | hammer: the ratchet and `kt:hissRise`; sweep: 105 at 0.5; steam: the hiss | land `kt:slam`; hurt 433 at 0.9; fall 92, 15 at 0.4, 342 at 0.8 |
| Watch-Captain | "all hands" and the steam whistle sliding A4 to G4 (1.6, 90 m) | 92 at 0.45 each 2.6 m | stomp: `kt:bellows`; cleave: 105 at 0.55; steam: the hiss | the stomp lands (15 and 92 at 0.4) and **the Tonal Wave rides its front**; fall: 15 at 0.35 and 342 at 0.7, the whistle dying an octave |

### How it is built

Above, piece by piece: `systems/ketch/ketchScore.js` and `scenes/ketch/ketchScoreHost.js` (the score, its law, its host);
the two powers in `systems/song/songPlayer.js` and `systems/music.js`; `systems/ketch/ketchSound.js` (the made sounds -
`pitchOf`, `tuneTo`, `buildTonalBark`, `buildKeelSong`, `buildDiscord`, `buildBreak`, `buildSlam`, `buildHiss`,
`buildHissRise`, `buildBuzz`, `buildKeelHum`, `buildKetchHorn`, `buildChain`); `scenes/ketch/ketchAir.js`,
`scenes/ketch/ketchVoice.js`, `scenes/ketch/ketchReverb.js`; `systems/reverbPresets.js` (four rows); the Steps' `sounds`
table (element 8). The score reaches the world host by the one term in `hourScoreFrame`; the air and the voices frame inside
the client's `frame()` and the fight's.

### Files and new modules

- **New:** `systems/ketch/ketchScore.js`, `systems/ketch/ketchSound.js`, `scenes/ketch/ketchScoreHost.js`,
  `scenes/ketch/ketchAir.js`, `scenes/ketch/ketchVoice.js`, `scenes/ketch/ketchReverb.js`,
  `ketchScoreProbe.mjs`, `ketchAirProbe.mjs`, `ketchVoiceProbe.mjs`
- **Changed:** `src/systems/song/songPlayer.js`, `src/systems/music.js`, `src/systems/reverbPresets.js`,
  `src/scenes/ketch/ketchFight.js` (its `play` calls routed), `src/scenes/ketch/ketchClient.js` (`scoreFrame`, the air's
  frame), `src/scenes/world.js` (one term)

### Cost

| Piece | Cost |
|---|---|
| the songs | 17, about 19,000 notes; made lazily under 15 ms a song; about 1.2 MB of events; the war about 50 notes at once at a unison of 3 |
| the beds and voices | about 11 MB of PCM at 22,050 Hz on desktop (rigging 2.0, hull 2.6, keel 1.1, engine and cells 1.5, resonators and forks 0.6, hazards 0.33, voices 2.0, outside 1.2); about 3 MB on phones |
| sources | at most about 29 on the bridge in the Last Note (5 beds, 7 forks, 4 resonators, the keel, the one-shots) |
| a frame | the law and the host under 0.02 ms; the air's gains and its event walk about 0.03 ms |

### Enhanced lane and classic set

Identical: sound is not a lane.

### Phones

Every own voice at a unison of 1 and no sub (`ketchScoreSongs({ lite: isTouchDevice() })` - the same notes, about a third
of the oscillators); beds at 11,025 Hz and half length; the engine's eight beds folded to three (the base fifth, h4-h6,
h7-h8), each stepping in by thirds of the need; cell hums the nearest two; forks' beds the nearest four (a broken fork still
pings); one hammer slam a slot; barks two a kind; the reverb's impulses at half length.

### Lab check

| Knob | What must be true |
|---|---|
| `?score=<STEM>&t=` | the song through the game's own player and FM bank (no ARENA2: the score is code), its lock pinned by `t` |
| `?score=KETCHWR2&false=0..4` | the detune live: the beating measured at A4 is 10 +- 1.5 Hz with four false and under 1 Hz with none |
| `?ear=<zone>&gust=0..1` | the zone's beds; the synthesized ones (keel, engine, hiss, buzz, chain) with no data, the made ones with `?arena2` |
| `?ear=engine&cells=2&need=4`, `&cells=4` | the probe's FFT finds peaks at h1-h5, then seven |
| `?voice=keelsong&forks=4`, `?voice=discord&false=3`, `?voice=captain` | each cue in order |
| `?bells=1..8` | the watch |

### Pins

`kt_lock.test.js` (new: a song locked at tick k plays its event k first, the controls before it folded;
the detune glides sounding voices and resets at the next song; a song with neither is byte-equal);
`ketch_score.test.js` (new: the songs - no D chord but in KETCHGLD, the meters (six, five, seven), every
bar's length; the law row by row; the locks against `hazardsBetween` and `beatStands`; the stings whole; the sighting sting
absent); `ketch_air.test.js`, `ketch_voice.test.js` (the beds by zone, the events' slots, `ketchBellsAt`
ringing `((2h + half) % 8) || 8` strikes in pairs at each UTC half-hour, the hazards' cues once each, the tuned barks' targets, a late wake never sounded); `ketchScoreProbe.mjs` (the Hour's 32 checks
re-aimed, plus the locks and the detune), `ketchAirProbe.mjs` (every bed loops seamlessly - its first and last 10 ms
correlate above 0.98 - and the keel's FFT peaks at 55 and 110 Hz), `ketchVoiceProbe.mjs` (each tuned bark within 15
cents of its target). Mutants `ketch_look_score.json`, `ketch_look_air.json`, `ketch_look_voice.json`. The record names the
departures: from DFU's `SongManager` dungeon playlist aboard and under her lift, and from `AmbientEffectsPlayer` aboard
(already silenced).

---

## 16. The words and the HUD

### What the player sees

**Today** (`ui/ketch/ketchHud.js`): a good tracker and a good bar (`ketchHudModel`, `wardenBarModel`), nearly the only place
the voyage's state is said - its counts as sentences ("Cells set: 3 of 7"), six lines on a phone; every turn a chat line in
the same yellow; no title card for any beat; the chest's offer is the activation tooltip; the reward not presented at all.

- **The tracker as an instrument panel**: her name and *Voyage {n}* in the brass frame (`FRAME_TONES.brass`); under it
  **six stage studs** (Watch, Gallery, Engine, Sailwalk, Warden, Cabin) - passed lamp-gold, the present one breathing, ahead
  dark brass; the stage's ask on one line; the counts as **glyph rows**, filled and hollow - never colour alone: the
  engine's sockets (`nd` cell glyphs), the cradles (six studs), a lying cell (an ember diamond with its seconds), the
  resonators (four diamonds), the forks (tines), the crew (eight pips); the cell in my hands a glyph by its line; her clock
  with **a needle** beside its words. Three lines on a phone where there are six. The glyph rows are the same counts the
  ship's boards show: a glance at the HUD and a glance at the ship agree.
- **The Warden's bar** carries its epithet, *What the Rourken left at the helm*, and through the Keel-Song eight pipe pips
  lighting with the bridge's pipe-forks; its "Out of tune" now has a sound under it.
- **The beats on a title card** (D's words, in her aether), each once a voyage or a fight and live only - a late page shows
  none of what it missed; the bridge's drawn while its bar is near (`sdBarNear`'s law), never over the Sailwalk's jumps
  (AUDIT SD IV T1):

| Beat | Kicker / main / sub |
|---|---|
| boarding | *Voyage {n}* / *The Sky-Ketch Mzunthar* / *She has not landed since her masters went* |
| the first wave | *The Boarding Watch* / *The Watch sounds* / *Break three waves* |
| the gallery | *Below decks* / *The Gallery of Hammers* / *Cross when a lane stands clear* |
| the hold | *The hold* / *The Starved Engine* / *Feed it {n} aether cells* |
| the waking | *The Starved Engine* / *Wakes* / *The mast-lift rises to the main top* |
| the top | *The main top* / *The Sailwalk* / *260 m over the fields* |
| the Warden's wake | *The bridge* / *The Tonal Warden* / *What the Rourken left at the helm* |
| phase 2 | *II* / *The Discord* / *Put the four resonators right* |
| phase 3 | *III* / *The Last Note* / *Break the forks before the Keel-Song lands* |
| the last minute | *She turns west* / *In one minute* / - |
| the fall | *The Tonal Warden* / *Silenced* / *Eight bells: the watch is over* |
| the cabin | *The Ketchmaster's Cabin* / *Your share waits* / - |
| a Gilded gun | *Gilded* / *{piece}* / *From the Ketchmaster's hold* |
| weighing anchor, aboard | *She weighs anchor* / *{w} to leave her decks* / - |

- **The share card**: what fell, each line in its rarity's colour, 6 s.
- **The crew card** at the fall: `ui/gate/gateDamageChart.js` from the fall's `top` and its `dm` (the Warden's state carries
  `fell.dm`).
- **The ground read** (element 12); **the banner** at the lift, **the taverns' rumours**, **the Timers' line** and **the
  map's gauge-ring with her portrait** (element 1).
- **The chat keeps the link's lines** (`ketchLink.js` `KT_LINK_TEXT`); the mid-screen line stays for the player's own acts
  (a cell let go, hands full); the moments move to the cards.
- **The tutorial page waits** past the first look (element 2).

### How it is built

- `ui/ketch/ketchHud.js`: `ketchHudModel` returns glyph counts beside its words (`studs`, `sockets`, `cradles`, `loose`,
  `res`, `forks`, `crew`) and a `needle` share; `drawKetchHud` draws them as small canvas-free spans (CSS pixel glyphs, the
  port's pixel font for numerals; the needle an 18-px canvas redrawn only on a change); the node updated, never rebuilt (the
  HUD's own law). The count sentences (`ketch.hud.cells`, `cradles`, `cradlesLoose`, `resonators`, `forks`) become the glyph
  rows' screen-reader titles. `wardenBarModel` gains `epithet` and the pips.
- `scenes/ketch/ketchBeats.js` (new; `createSdBeats`' law): pure but for its memory; drawn by `ui/superDungeon/
  sdTitleCard.js` with its new `theme` option (the aether class: the rule `#7cc4ff`, `KT_RING_CSS`, the main's glow
  `rgba(124, 196, 255, 0.5)`).
- **The words**, through `t()` (read when said, never at import - L10N4), in `systems/ketch/ketchWords.js` `KT_BEAT_TEXT`
  and its neighbours, every key in `locales/en/Port_Strings.csv` and drafted later for all 25 languages: the beats' new
  kickers and subs (the stage and phase names reuse `ketchStageName` and `ketchPhaseName`), the epithet, the read's
  `ketch.read.jump` (*{name} - jump!*), the banner's line, the five rumours, the Timers' line, the share card's title - about
  thirty-five keys, few and plain. `test/systems/l10n4_hardcoded.test.js`'s count is unchanged: nothing new stays English.

### Files and new modules

- **New:** `scenes/ketch/ketchBeats.js`
- **Changed:** `src/ui/ketch/ketchHud.js`, `src/ui/superDungeon/sdTitleCard.js` (`theme`), `src/systems/ketch/ketchWords.js`,
  `locales/en/Port_Strings.csv`

### Cost

DOM only, written on change; the cards one node each, made once; no draws.

### Enhanced lane and classic set

Identical.

### Phones

The glyph rows wrap to two lines; the cards at their phone size (`sdTitleCard`'s own rules, clear of the bar's foot - AUDIT
SD III T2).

### Lab check

`?hud=<stage>&...` overlays the tracker, the bar and a card from the lab's stand-in voyage at any `?stage`, `?wv`, `?bk`,
`?rs`, `?forks`; `ketchHudSheet.mjs` (the card sheets' precedent) shoots every stage and phase at 960x600 and 390x844,
the glyph rows filled and hollow, under `?grey`.

### Pins

`test/ui/ketch_hud.test.js` extended (the glyph counts and the needle from a voyage run whole; the node updated, not
rebuilt); `ketch_beats.test.js` (new: every beat once, a late page none, every word routed through
`t()`); `test/systems/l10n4_hardcoded.test.js` unchanged. Mutants `ketch_look_hud.json`.

---

## 17. The lab

### What the reviewer sees

**Today** (`ketch.html`, `src/tools/ketchLab.js`, 157 lines): twenty views, `?hour`, `?stage`, `?sec`, `?forks`, `?law`, `?t`,
`?lane=off`; no sky (the clear colour is the fog's foot), no constructs and no Warden ("those are Daggerfall's sprites"), no
state knobs past the stage, no `?grey`, no probe, no sound; its `top` view stands inside the top gate.

The lab becomes the place every piece above is judged, with no game data where the art is the port's own and with
`ARENA2_PATH` where it reads the player's, on both lanes, frame-synced on `window.__frame` (`bible/Home.md` Process).

| Knob | Forces |
|---|---|
| `?grey`, `?lane=off`, `?lite` | the frame in grey (`canvas.style.filter`, `abyssLab`'s way); the classic set; the phone's tier (`ui/touch/touchDevice.js` `isTouchDevice`'s answer) |
| `?bill` | GL draws, binds, shadow records, lights, texture bytes and the ship's own CPU a frame (the perf overlay's counters) |
| `?sky`, `?weather=`, `?hour=`, `?passage=`, `?motes=0`, `?land=data\|painted` | the sky; the weather; the hour; a passing bank; no motes; the land |
| `?cr=`, `?br=`, `?bk=&nd=`, `?lo=<id>:<s>`, `?carry`, `?wake=<s>` | the cells and the engine |
| `?lift=<s in the round>` | the cage, its dials and lamps |
| `?hazard=hammer\|steam\|arc&wt=<share>\|live` | a hazard's wind-up |
| `?watch=1\|2\|3&rise=`, `?aim=1`, `?wardens=asleep\|awake`, `?kind=&act=&k=` | the Watch and the constructs |
| `?fight=asleep\|wake\|keel\|lash\|ring\|wave\|discord\|tuned\|song\|landed\|broken\|stun\|sections\|west\|fell` with `&wt`, `&rs`, `&da`, `&st`, `&forks=<n>:<h,...>`, `&su`, `&sec=<k>:<s>`, `&left`, `&age` | the Warden's fight |
| `?voyage=<share>`, `?crew=<n>`, `?wv=` | the boards |
| `?beat=`, `?crumble=`, `?gust=warn`, `?castback=A&age=` | the Sailwalk |
| `?fx=<kind>&age=`, `?read=<blow>&me=x,z` | the blows seen and read |
| `?world=sighted\|docked\|departing&p=`, `?depart=<s>` | her from outside and her coming about |
| `?liftoff=<s>`, `?veil=ktUp\|ktDown&vt=`, `&forced`, `?arrival=<s>` | the ride |
| `?chest=`, `?share=gilded` | the reward |
| `?score=<STEM>&t=`, `&false=`, `?ear=<zone>`, `&gust=`, `&cells=&need=`, `?voice=<cue>`, `?bells=<n>` | the sound, through the game's own player and the lab's own context |
| `?hud=<stage>` | the HUD at any state |
| `?arena2` | the constructs and the Atronach through the game's own sprite loader when the dev server serves the freeware at `/arena2/` (`vite.config.js` `arena2DevServer`; `sh tools/fetch-data.sh`) |

**Views added and fixed**: `fields`, `walls`, `street`, `far` (her from the world, stood with `ketchSkyMatrix` over the lab's
ground); `board`, `helm-board`; `top-out` (the `top` fixed: the eye at (9, 17.7, 51.5), yaw 120); `lift-top`, `lift-ride`;
`sailwalk-down`, `spar`; `bridge-far`; `warden`, `warden-turntable`; `gallery-lane`; `carry`; `cabin-in`, `stern-window`,
`chest`; `orbit` (a turntable about her, eight bearings).

**The probes** (`ketchLabProbe.mjs`, new; `tools/abyssLabProbe.mjs`'s shape, frame-synced):

- **the value probe** - every view at four hours on both lanes against the ladder's targets;
- **the contrast probe** - each fight floor at its L1 cap and every telegraph core at least 0.7 and under clipping (p99
  below 0.98), noon and night, both lanes;
- **the flash probe** - a sampled pixel at 60 Hz for 4 s shows at most 3 transitions a second, on a live arc, a coherer, a
  burning seam, a faltering cell, a Beat plate, a false resonator's rings and the hold's lamps through the waking;
- **the shadow probe** - no moving part records a cube face (the cage over a rise, a falling section, the vanes);
- **the grey probe** - aether against lamp, true against false, solid against ember against gone, a full cell against a
  draining one, the Warden's tell against its body;
- **the sky-share probe** - the arrival frame at least 40% sky or land, `top-out` at least 50%;
- **the law probe** - `?law`'s wire against every new visual: nothing inside a room's box or a collider, no net or strip
  above `SD_VOID_Y`, nothing of the Warden past r 2.0 under 2 m;
- **the bill** - its draw counts per view pinned as ceilings;
- **the sheets** - before and after, both lanes and `?grey`, every view at `hour=6|12|19|2`, for every slice's pull request.

The sound probes (`ketchScoreProbe.mjs`, `ketchAirProbe.mjs`, `ketchVoiceProbe.mjs`, element 15) and the HUD sheet
(`ketchHudSheet.mjs`, element 16) sit beside it.

### How it is built

`src/tools/ketchLab.js` grows a knob table and the fight's stand-ins: it builds a `createKetchFight` over a fake link whose
state the knobs write (`net/ketch/ketchLink.js`'s state shape: `wv`, `cl` with each loose cell's `until`, `ws` with `rs`,
`da`, `su`, `fk`, `sec`, `ends` and `fell`, and `sga`), so the lab draws what the game draws; the Warden and the Spider
from their committed sheets resolved through the fallbacks; DEE's art from the repository; the deck's passes exactly as the
dungeon arm draws them (`ketchFrameLook`, now with the grade); `?sky` the procedural `render/enhancedSky.js`; the
world-side views standing her by `ketchSkyMatrix` over the lab's painted land. `ketch_lab.test.js` (new) walks
every view and knob headless: no GL error, the frame lit, `window.__frame` advancing.

### Cost

A tools page: nothing of it ships in the game's own entry.

### Enhanced lane and classic set

Every view and knob on `?lane=on` and `?lane=off`; the value probe's numbers per lane.

### Phones

`?lite` forces the touch tier so every phone column above is shot and counted at 390x844.

### Lab check

The lab checks itself (`ketch_lab.test.js`). The live game is checked once a slice touches what the lab cannot
draw from the port's own art (Daggerfall's sprites, the city's blocks, DAGGER.SND's made sounds): `sh tools/fetch-data.sh`
puts the freeware at `/home/claude/dfdata/arena2`, `ARENA2_PATH` is set, and the e2e run (`tools/loadHarness.mjs`
`standServices`) shoots the waist, the gallery, the hold, the bridge, the cabin and her from the fields - with the
first-run popups dismissed (today's live frames are half covered by them).

### Pins

`ketch_lab.test.js`; the probes' own checks in each slice's pull request.

---

## The moments

A's twelve are the bar: the moments a player will remember, each built by the elements above and owed to a slice. The
starred five are the ones a review plays first. Four are carried as the rulings and the law reshaped them, and each is
said in the row.

| # | Moment | Built by (elements) | Slices | Seen in the lab |
|---|---|---|---|---|
| 1 | **The glint in the east** - from Daggerfall's east wall at dusk, a spark of brass on the horizon, then a whale-shape in the haze, her lamps lighting bow to stern as she nears | 1 (the far picture and its glint, her lamps) | KL15 (the bake the far picture uses), KL20 | `walls&hour=18.5&world=sighted&p=0.2\|0.6\|0.95` |
| 2 | ★ **The blue column** - at night the anchor-lift hangs in a column of aether light from her keel to the fields, the city's dark walls in front of it; her watch bells strike over the rooftops | 1 (the beacon while she boards, by night); 15 (the bells) | KL9 (`ketchBellsAt`), KL20 | `fields&hour=2&world=docked`, `?bells=1..8` |
| 3 | **The ride up** - the fields fall away under the cage's grating, the world goes white in her cloud, and the city falls away inside it; the arrival cage opens on her deck. *As ruled: about 3 s in the world, the cloud passage inside the step's veil (the owner's ruling 1), not A's 12 s* | 2 | KL21 | `?liftoff=0..3`, `?veil=ktUp&vt=`, `?arrival=0..1.6` |
| 4 | ★ **The heart wakes** - the last cell seats, the engine's eye opens, aether climbs the pipes, the lamps dip once and step up deck by deck, the mast-lift's tower lights from the hold to the top, her horn sounds, and the engine's five catches six | 6 (the waking's tracks); 15 (KETCHWAK, the partials, the horn) | KL8, KL4, KL9 | `hold&wake=0..10`, `?score=KETCHWAK` |
| 5 | **Out of the shaft** - the cage rises past the tower's lit ports and its gate opens on 276 m of air. *The ports are B's lit ports every 4 m, not A's slit windows (one ports record)* | 7 | KL10 | `lift-ride`, `top-out` |
| 6 | ★ **The first yard** - boots on a spar hung on its tackles, her brass belly curving away under you, the cloud deck below, the real city through it | 8 (the spars and the net); 14 (the land, the cloud deck) | KL12, KL13, KL14 | `sailwalk-down`, `spar` at `hour=7\|12\|19\|2`, `?land=data` with `?arena2` |
| 7 | **It lets go of the wheel** - the Tonal Warden's hands leave the helm, the wheel spins free behind it, the eight pipe-forks draw breath | 9 (the wheel, the pipe-forks); 10 (the wake); 15 (its wake cry) | KL11, KL15, KL18 | `?fight=wake&age=0..6` |
| 8 | ★ **Tuned** - the music and the bridge go out of tune (a sour beating drone, ember on four resonators); the fourth resonator's cell seats and the whole chord snaps true, the ward's plates shatter, the Warden kneels in a ring of aether. *The fourth set is a resonator's, as the law has it* | 9 (the resonators); 10 (the plates, the kneel); 15 (the live detune, the resonators' beds) | KL4 (`detune`), KL11, KL16, KL18 | `?fight=discord&rs=`, `?fight=tuned`, `?score=KETCHWR2&false=4\|0` |
| 9 | **The Keel-Song** - the pipe-forks light one a second, the Warden's arms rise and its crown climbs, the forks rise humming her scale; the ring's sections drop away. *The sections drop and are winched home on their chains (B, C); A's sections hanging under the rim would hang through her hull over the stern* | 9 (the pipe-forks' count, the sections); 10 (the tell, the forks); 15 (the song sung, KETCHSNG landing at `fk.at`) | KL11, KL16, KL18 | `?fight=song&wt=0..1&forks=`, `?fight=sections&sec=` |
| 10 | **Silenced** - its song breaks into its overtones, a tine of its crown snaps and rings away, it topples onto the helm, the wheel spins; two seconds of wind; then eight bells; the cabin's doors open on lamplight | 10 (the fall); 9 (the inlay to lamp-gold, every resonator true); 15 (KETCHFEL's eight bells); 13 (the doorway's light) | KL16, KL11, KL4, KL22 | `?fight=fell&age=0..20`, `helm&stage=5` |
| 11 | **The empty captain** - stern windows full of sky, an empty Dwemer suit slumped at the chart table, the chest's rings turning into line and its lid lifting in gold | 13 | KL22 | `cabin`, `stern-window`, `?chest=` |
| 12 | ★ **She comes about** - crews still aboard as she weighs anchor: the sun swings across the deck, her horn sounds twice, Daggerfall's castle slides under the keel and away; from the street, she turns west over the rooftops | 14 (aboard); 1 (from the street); 15 (KETCHDEP) | KL13, KL20 | `?depart=0..1141` from `bridge`, `street&world=departing&p=` |

---

## Beyond the Abyss Dungeon

What the Ketch has that the Hour (SD13-SD19, `Super-Dungeons-Look.md`) does not:

1. **She lives in the shared world.** One 240 m ship over the capital that every player online sees at once: sighted from
   the walls, her keel's hum over the east fields, her watch bells counting the real half hours, her horn at the phase
   edges, the blue column by night, her shadow across the east quarter each morning by the world's own shadow law, the
   map's ring as her station's gauge, her departure over the rooftops. The Hour lives in a pocket; its presence is a haze
   and a banner.
2. **The world and the raid are one place.** The ride rises out of the real fields; the land under the whole raid is
   Daggerfall's own streets from its own blocks, lit by night; a fall wakes you under her lift; she comes about with you
   on her deck. The Hour is reached through a veil into elsewhere, over a painted void.
3. **Daggerfall's own palette and Daggerfall's own Dwarven metal.** Every texel she shows is an `ART_PAL` index resolved
   through the player's palette; her brass is `METAL_TABLES.Dwarven`, the metal of every Dwarven blade in the game, so the
   ship, her crew and the player's armour are one metal. The Hour painted in free ramps.
4. **A boss made the way Daggerfall made its own.** The Tonal Warden is a model in code baked into Daggerfall's sprite
   layout, five facings mirrored to eight, committed and gated byte for byte - an oversized sprite of its own, as the owner
   ruled for bosses. The Remnant is a modelled body.
5. **One law under everything.** `ketchStatesOf` is one pure function the deck, every pass, the boards, the HUD, the air and
   the score read, so two screens and a song cannot disagree, and her boards on the quarter wall and at the helm carry the
   same needles and glasses as the parts they report on. The Hour's reads were built piece by piece.
6. **A score that keeps the law's time and is the fight's state.** The Gallery's bar is the hammers' cycle and the
   Sailwalk's is the Beat's, every song begins at the shared clock's own tick, and every crewmate hears the same downbeat
   as the same hammer falls. Each cell set gives the engine back one partial; the Discord detunes her voices live against
   the crew's, and each resonator put right takes a quarter of it away; each fork broken takes its note out of the song.
   The Hour's score follows its place and phase; this one follows what the crew does.
7. **Meter and harmony as meaning.** Six for her, five for a starving engine, five catching six as she wakes, seven for the
   Discord; a whole score on A7 that never resolves, whose one D major chord is a Gilded gun in your hands. Every other
   score in the game is in four.
8. **The hour and the weather are the art direction.** Dawn gold, noon white, dusk amber, night lamps over a lit city;
   rain and snow on her open decks; lightning in the cloud deck below; a cloud bank passing through her rigging. The
   Hour has no hour.
9. **One body that wakes.** Her state reads across the whole ship and, at station, from the ground: shutters open, vanes
   bite, stacks breathe faster, lamps step up, keel-lights run, the engine's eye opens. The Hour's states are each a local
   read.
10. **One gust, seen, heard and felt together.** The rigging's sound, the hull's creak, the vapour's streak, the clouds'
    drift and the hanging things' swing are one wind on the relay's clock, the same for the whole crew.
11. **The fight is heard.** The Tonal Wave carries a tone on its front that passes your ears as the ring does - jump on the
    note; the Warden speaks in its keel's harmonics; the forks count by ear.
12. **A costed engine.** A PVS that hides what the eye's zone cannot see, no moving shadow caster, thirteen fewer lights
    that only glowed, and the lab's bill pinned as ceilings - while showing far more.

---

## Left out, and why

**By the owner's rulings** (The owner's calls):

- **A's 12 s ride through the world** (ruling 1): about 3 s, the cloud carried inside the veil.
- **Her music across the city, and the sighting sting KETCHSGT** (ruling 2): her songs play within 450 m of her lift and
  within 2.5 km as she leaves, and nowhere else. B's 600 m and 3 km reaches are D's 450 m and 2.5 km: "near her lift"
  is the lift's own field, and 2.5 km keeps her departure inside the haze's reach where she is still seen.
- **A shadow by decal** (C, D) **or none** (B, for want of a decal path) (ruling 3): her silhouette is an occluder in the
  cloud-shadow field, the one number every surface reads.
- **The runtime bake** (ruling 4): the sheets are committed and gated.
- **The herald's portrait and D's helm card** (call 5, off): each is a relay version for a picture or a card.
- **The read's way out over the Gallery's hazards** (call 6, off).

**By the law** (nothing the relay judges or a body stands on moves):

- **Any relay change.** No file the relay bundles changes and no relay version moves; A's ask of the link is already met
  (`sga`). Every read is predicted from law the page holds - the spider vents included (C).
- **A deck that pitches or rolls, a camera roll, sway or FOV move** (A, B, C, D): her colliders are the law's, and it is
  motion sickness (SD-LOOK's rule). Her motion lives in her parts and in the land swinging slowly beneath her.
- **A bob or sway at station** (A, B): her collider stands while she keeps station (`createKetchSky` `standCollider`); she
  moves only as the clock moves her.
- **Fans turned about their spars** (B, C): a 26 m blade on a 36 m spar sweeps through the main top and the jackstay; the
  vanes feather (A).
- **Sections hanging under the bridge's rim** (A): those over her stern would hang through her hull.
- **New colliders** for the cabin's furniture, the nets or anything dressed (A): every prop stands inside a standoff,
  below a catch height, or is a flat walked through as Daggerfall's decoration is.
- **Bodies rising through solid deck or sinking through it** (today's `ktBodyAct` lift): a drop-line or an iris carries
  every rise; the dead dither out.
- **Louvres or blades on the Beat plates** (A, C): a plate tilted or opened while the law still holds it flat is a visual
  larger than the law.
- **One crew's waking shown to the street** (A): the street sees one ship and each crew boards its own; a crew's progress
  outside needs the relay.
- **Telling the crew of a Gilded** (A): the spoils are each player's own seed and never sent.

**By the hosts** (HOST-SPLIT: terms in existing lines only):

- **The compass mark at the lift** (D): a key in `bootWorld`'s compass object is a logical line in a host with none.
- **A's and C's veil passed into `enterKetch`**: the veil is `stepThroughFire`'s, which the mode machine already exports.
- **B's open-air rain term**: the indoor law already plays the street's rain in a made level at the street's gain; a term
  would have lowered it.
- **A new dependency in the client's construction**: each would be an object entry in `bootWorld`; what the client lacks it
  imports.

**By the canon and the language:**

- **Cloth** - pennants, banners, awnings (A, C): the Dwemer built in metal; brass-leaf vanes carry the wind (B).
- **A literal animal** - eyes, a tail, a mouth, lit hawse discs (A): she is a machine shaped like a whale.
- **Gulls** (A, B, D): nothing flies at 260 m over Daggerfall in Daggerfall.
- **The Hour's time motifs** on the Ketch - clock-hands, waystones, the Ending's vane, rewinding (B): she mends; the Hour
  rewinds.
- **A second metal** - A's blued-steel ramp, C's tonal brass, the Hour's orange brass: one metal, the Dwarven ramp and its
  burnished end.
- **C's TONAL light**: within 0.02 of the beat's luminance; EMBER carries the Warden's false song.
- **A's model of the Warden** on the Remnant's rig, and **A's 7 m ward shell**: the owner's ruling on bosses; the four
  plates show which resonator is false where a shell would hide the tells.
- **Other keys** - B's F Lydian, A's B-flat, C's D Lydian: D's A is the one source of pitch.
- **B's written channel bends** for the Discord: the live detune is the one mechanism.
- **A song switch per cell or per resonator**: one song at a time; the state lives in the air and the detune (D).
- **Just intonation** (D): the FM bank is 12-TET; the Discord's -40 cents is the one departure, and it carries the meaning.
- **Voiced words for the Warden** (D): Daggerfall's monsters have none; it speaks in tuned barks.
- **A's tonal motes orbiting the Warden**: the crown carries its state; the motes keep to their zones.
- **New words** past the few the moments need.

**By cost or by being bettered:**

- **B's live capture of the world at boarding**: a second camera the world host would have to grow, 2 x 4 MB and 40-120 ms
  inside the veil, a half-streamed city for a fast boarder and a different one for each crewmate, and no lit windows by
  the hour; the blocks' data is the same for every crew and lit by the hour (element 14).
- **B's chart from the player's own map**: the chart is the port's own engraving (A), the same with no data.
- **Volumetric clouds at her height** (A, B, C): the lane's whole frame; the cloud deck and lit cumulus carry it.
- **B's steam in the halo pass**: one steam law, `ktSteamPass`, for every puff and wall of steam.
- **C's carried cell in the world below the eye**: B's view-space carry reads first-person.
- **C's lift-plates for the Sentries**: hidden by the body they carry; B's iris reads from across the deck first.
- **C's twelve floor rays on the bridge**: the pipe-forks are the count.
- **A's slit windows on the tower**: one ports record (B).
- **A's separate Watch lanterns**: the board's three Watch lamps are the one count.
- **D's shakes up to 4**: capped at 3.0 under the player's own maximum (`betterAmbience.weaponKick`).
- **Rain and snow, and the passing banks' fog, on phones** (C): their cost on a weak GPU is not worth the read.
- **A convolver from a recorded hull** (D): nothing ships; Unity's own EAX rows cover the spaces.

---

## The build order

Each slice is shippable and checkable on its own, sized for one sitting, in dependency order - the flash law and the light
first. Every slice:

- writes its record in `Sky-Ketch.md` section 16 (KETCH-LOOK; KL0 opens it), amending sections 11 and 12's visual
  sentences where it changes them, cites as anchors (`npm run cites -- --apply`, then `-- --check`), and names its
  departures from DFU in Ledger A, KETCH;
- retires and rewrites only the pins it moves; every new pin fails under a one-character mutation, and its mutants are
  recorded (`tools/mutants/ketch_look_*.json`); its new test files take names no other test file has (the bible names a test by its
  file name alone, `test/bible/manifest`), in the Ketch's feature folders (`test/world/ketch/`, `test/scenes/ketch/`,
  `test/render/ketch/`, `test/systems/ketch/`);
- names all four hosts (`scenes/world.js`, `scenes/worldModes.js`, `scenes/dungeonContext.js`, `scenes/exterior.js`), each
  wired or flagged; a slice with a host term runs `node tools/hostScope.mjs <host>` and `test/scenes/hostceiling.test.js`;
- runs `npm run lint`, `npm run types`, the bible's gates (`test/bible/manifest`, `citeanchor`, `citedrift`, `mutantdrift`,
  `audit18_bible_docs`, `ledger`) and `npm run test:changed` - or, where a term in `worldModes.js` or `world.js` moves most
  of the suite, the slice's own test files, leaving the rest to CI's `verify`; merges main in before the push that is to be
  verified, and is not done until CI is green on its head;
- runs `sh tools/fetch-data.sh` and sets `ARENA2_PATH` whenever it reads the player's data or the running game (the
  palette test's fallbacks, the made sounds, the land, the sprites, the live run): a check without it is a check not yet run;
- carries before and after lab sheets on both lanes and under `?grey`, every view it touches at `hour=6|12|19|2`, the flash
  probe, and its patch notes in the pull request's description under `## Patch notes: <title>` - never a patch-notes file.

| Slice | What ships | Depends on | Pins | Lab views and probes |
|---|---|---|---|---|
| **KL0 The flash law, the casters, the lab's eyes** | The arcs' frame swap (`ketchDeckHost` `Math.floor(t * 16.7)`) gone: one frame a strike, a steady glow, until KL7's pass. The sections' warning shake from 6.9 Hz to a 1.5 Hz lurch (`ketchPose.js` `sectionPose`). The cage and every falling section `noShadow`. The lab's `?grey`, `?lite`, `?bill`, `?sky`, the `top-out` view; `ketchLabProbe.mjs` with the flash, shadow and value probes (measuring; the targets arrive with KL1); `ketch_lab.test.js` | - | `ketch_deck_host` (no frame swap; the cage's and a warned section's `noShadow`); `sectionPose`'s shake under 3 Hz; `ketch_lab` | the flash probe on a live arc and a warned section (at most 3 transitions a second); the shadow probe (no moving part records a cube face); every view's sheet as the baseline |
| **KL1 The light by the hour and the zone** | `world/ketch/ketchLook.js` (the lights imported and pinned equal, `KT_LADDER`); `world/ketch/ketchAtmos.js` `KT_HOURS` (the rows, the sun by elevation, the trilight); `setSceneGrade` per zone in the deck host's `frameLook`; the haze by hour; the below-decks fog colour; `ketchLampSpots` moved over the lanes and down the hold (51 to 48) | KL0 | `ketch_atmos` (new); `ketch_model` (the lamps' count and places, every lamp outside every collider); `ketch_deck_host` (the grade written on a ship, nothing off it) | the value probe's targets on: below-decks p50 at least 0.08, dusk deck at least 0.10, night deck at least 0.06, noon floor p95 at most 0.30, telegraph floors at most 0.25 - every view at `hour=5.5\|7\|12\|18.5\|19.5\|2`, both lanes |
| **KL2 Her metal** | `KT_PAL` (index ramps and fallbacks); `sdPixelKit` `quantizeIndexed`; every record repainted in `KT_PAL` with Daggerfall's panel-and-mottle grain (the hull's courses, steel, Dwemer stone, the nets as brass cord, brass-leaf vanes, verdigris weeping down); the Hour's orange brass retired from her; the interim Warden: the Iron Atronach dyed Dwarven (`characters/dyes.js` `changeDyeBitmap`) | KL1 | `kt_look_palette` (new: only `KT_PAL` steps; the Dwarven and Iron rows equal `METAL_TABLES`; with `ARENA2_PATH`, every fallback within 24 and every ramp rising); `ketch_model` and `ketch_deck_host` (the records' sizes and steps); `ketch_fight` (the dye) | `?grey` on every view; the `hold` without bookshelves, the waist without a fence; `bridge&arena2` for the dyed Atronach |
| **KL3 One law and the plumbing** | `world/ketch/ketchStates.js` `ketchStatesOf` and `KT_PVS` through the loop's `culled`; `sdSteps` `cull(on)`; `render/ketch/ktGaugePass.js` (its kinds, no sites yet); the deck's glows into `sdHalo` on classic; the lab's fake link and its state knobs (`?cr`, `?br`, `?bk`, `?nd`, `?lo`, `?wv`, `?fight=` and their companions) | KL1 | `ketch_states` (new, over a voyage run whole through `test/net/ketch/ketchSim.mjs`); `ketch_deck_host` (culled by zone, the 6 m door rule, a draw without a group never culled); `sd7b_steps`, `sd25_steps` unchanged; a `cull` pin; `kt_gauge_pass` (each kind at its shares) | `?bill` on `waist`, `gallery`, `hold`, `bridge`, `cabin` (the draws per zone pinned as ceilings); a `?gauges` card of every kind |
| **KL4 Her score** | `songPlayer.js` `startTick` (the clock lock) and `detune`, `music.detune`; `systems/ketch/ketchScore.js` (the seventeen songs, `KETCH_CHORDS`, the motifs, `KT_SCORE_PRIORITY`, `ketchScoreFor`); `scenes/ketch/ketchScoreHost.js`; the client's `scoreFrame`; the one term in `hourScoreFrame`. The dungeon playlist leaves her decks | KL3 | `kt_lock` (new: a song locked at tick k plays its event k first; the detune glides and resets; a song with neither byte-equal); `ketch_score` (new: no D chord but KETCHGLD; the meters; the law row by row; the locks against `hazardsBetween` and `beatStands`); `hostceiling` | `?score=<STEM>&t=`; `?score=KETCHWR2&false=0..4` (10 +- 1.5 Hz of beating at A4 with four false, under 1 with none); `ketchScoreProbe.mjs` (levels, peaks under -1 dBFS, every lock within 30 ms); the Hour's and the Spire's score probes unchanged |
| **KL5 Her body whole** | The lifting-body hull from the one outline (the belly, the rorqual grooves, the keel's sweep, the stacks, the ports' shutters, the keel-light); `world/ketch/ketchOrnament.js`; `world/ketch/ketchDressModel.js` (vanes feathering, flippers, shutters); `render/ketch/ktLinePass.js` (the rigging out of the mesh); `ketchMotionAt` (stroke, breath, swell, wind); the engine house in Dwemer stone | KL2, KL3 | `ketch_model` (the collider and every part's `hit` byte-equal; no vertex inside a room's box); `ketch_look` (new: the breath's periods, the vanes' law, the feather inside the jackstay's clearance); `ketch_walk` unchanged | `bow`, `side`, `below`, `stern`, `orbit` at `?stage=0\|3`; the law probe; the shadow probe on the vanes |
| **KL6 The open decks** | The deck plates' atlas and its map; the bulwarks' furniture; the nets' catenary; the eight nearest lanterns swinging on their chains; the capstans; the quarter wall's façade; `world/ketch/ketchBoards.js` and the ship's board (14 instruments); the spheres' cradles and drop-lines; the Sentries' irises; the way-on lamp | KL3, KL5 | `ketch_model` (the furniture's band; the nets' collider unchanged); `ketch_boards` (new: every site on its wall; each gauge from `ketchStatesOf`); `ketch_fight` (the rise: a drop-line or an iris, never a body under the deck's top while seen) | `waist`, `arrive`, `board`, `waist&watch=1&rise=0.5`, `&watch=2&rise=0.6` at four hours; the contrast probe on the waist's floor |
| **KL7 Below decks** | The hammers merged into one mesh with their counterweight wheels; `ktShaftPass`; `ktSteamPass` (the puffs' billboard batch retired); `ktArcPass` (the arcs' records retired); the coherer spheres; the vents' irises; the housing dials on the gauge pass; the guns; the Wardens' wash | KL1, KL3 | `ketch_deck_host` (heads at `hammerHeadY` for every row and lane; the wheel from the head; the steam wall from `hazardState`; no arc swap); `ketch_atmos` (the below row). Mutants KTL-the-arc-swaps, KTL-the-wheel-off-the-head, KTL-the-steam-lingers | `gallery`, `gallery-lane`, `hold`, `engine` at noon and night; `?hazard=hammer\|steam\|arc&wt=`; the flash probe on a live arc and a coherer |
| **KL8 The cells and the engine waking** | The cradles as chargers (the sleeve's fill), the sockets, the loose cell's bleed, the carry in view; the engine's eye, flywheel and pistons; `scenes/ketch/ketchWake.js`; `scenes/ketch/ketchFx.js` (first used); the cradles' and forks' lights retired, the carried cells' lights marked `carried` | KL3, KL7 | `ketch_states` extended (fills, bleeds, the appetite, the waking's age from `sga`); `ketch_wake` (new); `ketch_deck_host` (the lights). Mutants KTL-the-sleeve-fills-down, KTL-the-cell-drains-late, KTL-the-lamps-blink | `hold&wake=0..10`, `?cr=`, `?bk=&nd=`, `?lo=`, `?carry`; the flash probe over the waking and a faltering cell |
| **KL9 Her air** | `systems/ketch/ketchSound.js` (the made sounds); `scenes/ketch/ketchAir.js` (the beds, the events, `ketchBellsAt` aboard, the machines heard from the `hazardsBetween` list the fight walks); `scenes/ketch/ketchReverb.js` and the four EAX rows in `systems/reverbPresets.js`; the Spire's mix | KL4 | `ketch_air` (new: the beds by zone, the events' slots, the bells' count, each hazard's cue once); the three presets' pins unchanged | `?ear=<zone>&gust=`, `?ear=engine&cells=&need=`, `?bells=`; `ketchAirProbe.mjs` (seamless loops, the keel's FFT at 55 and 110 Hz) - with `ARENA2_PATH` for the made beds |
| **KL10 The mast-lift, the top, the yard** | The lift's dials and gate lamps on the gauge pass, the counterweight and the head sheave, the dead cage's lamp out, the tower's lit ports every 4 m and their chase at the waking, the stanchions and the davit | KL6, KL8 | `ketch_deck_host` (the counterweight the cage's mirror; the dead lamp dark); `ketch_boards` (the dials' sectors are `liftYAt`'s landings) | `lift-top`, `lift-ride`, `top-out`, `?lift=0..32`; the sky-share probe on `top-out` (at least 50%) |
| **KL11 The bridge** | `render/ketch/ktBridgeGlow.js` (the seams, the ghosts with needles, the spokes, the Discord's mark, the end in red); the resonators' crystals and cages; the pipe-forks' visual out of the static mesh (their `hit` kept); the wheel spun free; the armillary; the lodestone turning to the city; the sections' atlas (40 draws to 8), their chains and winch; the console's lamps | KL3, KL5 | `ketch_deck_host` (eight section draws; `noShadow` from warn to return); `ketch_model` (the spires' `hit` byte-equal); `kt_bridge_glow` (new). Mutants KTL-the-seam-cold, KTL-the-pipes-count-wrong, KTL-the-section-casts-falling | `bridge`, `helm`, `bridge-far` with `?fight=discord&rs=`, `?fight=song&wt=`, `?fight=sections&sec=`, `?fight=west`, `?fight=fell`; the contrast probe on the core's floor |
| **KL12 The Sailwalk** | `createSdSteps`' `dress` and `sounds`; `world/ketch/ketchStepsDress.js`, `ketchStepsArt.js` (spars on tackles, tonal plates that ring with their studs, ratline risers, gratings mended, torn net-strips, the gust's tell); `scenes/ketch/ketchSailwalk.js`; the catch-net; the bosun's line's ride; the one term in `buildDungeonContext` (its count falls by three) | KL3, KL5, KL9 | `sd7b_steps`, `sd25_steps` unchanged (the Hour's dress byte-equal); `ketch_steps_dress` (new); `hostceiling`. Mutants KTL-the-tackle-leans-wrong, KTL-the-mend-before-the-law, KTL-the-net-above-the-void | `sailwalk`, `sailwalk-down`, `spar`, `?beat=`, `?crumble=`, `?gust=warn`, `?castback=`; the flash probe on a plate's last 0.4 s; the law probe (no net above `SD_VOID_Y`) |
| **KL13 The land below, and she comes about** | `world/ketch/ketchLand.js` (the plate from the blocks' `autoMapData`, its windows, the city in relief, the fields on the heights, the painted fallback); `scenes/ketch/ketchPresence.js` opened with the heights' sampling; the turn under `departing` and the fight's turn west (the land, the sun); the two terms in `createWorldModes` (the sky's turn, the blocks file) | KL1, KL3 | `ketch_land` (new: a fixed block set's plate hash and relief count; the fallback; nothing of ARENA2 kept past the ship); `ketch_deck_host` (the turn; no collider moves); `hostceiling` | `city`, `sailwalk-down`, `above`, `below` with `?land=data\|painted` and `?arena2`; `?depart=0..1141`; the value probe (the land under the hull's mean by day) |
| **KL14 The clouds, the motes, the weather** | `render/ketch/ktCloudPass.js` (the cloud deck and lit cumulus; `KT_CLOUDS`' billboards and `puffArt` retired); `render/ketch/ktMotes.js` on `egMotes` (`egMoteLayoutOf`, the four kinds); the passing banks (`passage(t)`); rain, snow and lightning on the open decks from `currentWeather()` | KL13 | the egMotes pins (the bands' layouts equal); `ketch_atmos` (the passage only on open floors with no blow live). Mutant KTL-rain-below | `?weather=clear\|cloudy\|overcast\|rain\|storm\|snow\|fog`, `?passage=0.5`, `?motes=0`; the law probe (no mote within 3 m over a fight floor) |
| **KL15 The Warden's sheets** | `world/ketch/ketchWardenModel.js`; `world/ketch/ketchBake.js`; `bakeKetchSprites.mjs`; `tools/pngIO.mjs` `writeIndexGreyPng`; `src/assets/ketch/warden/*.png` committed (grey-index, no PLTE) with their "OURS" rows in `test/tooling/doctrine.test.js`; `KT_WARDEN_LOOK` and its row; the body and tell batches drawn in place of the dyed Atronach, resolved through the player's `ART_PAL` (the fallbacks in the lab) | KL2, KL11 | `kt_sprite_bake` (new: the gate regenerates every frame and compares byte for byte; no PLTE; every index a step; the feet inside the body); `doctrine` (the rows); `ketch_fight` (the records by act; the tell's share is the wind-up's). Mutants KTL-the-sheet-carries-a-palette, KTL-the-mirror-flipped | `warden`, `warden-turntable` (eight bearings; the mirror through `world/mat4.js`); `?fight=wake\|keel\|lash\|ring`; the law probe (nothing past r 2.0 under 2 m) |
| **KL16 The Warden's state** | The crown of floating tines (its state by phase), the ward's four plates, its floor mark, the Tonal Wave's wall (`sdStompWall`), the kneel's ring, the Keel-Song's forks dressed (rising in steam, cracking through three stages), the fall (the tine, the topple onto the helm) | KL15 | `ketch_fight` (the crown's state by phase; `wardenAt`; the forks' three stages). Mutants KTL-the-crown-wrong-phase, KTL-the-tell-late | `?fight=discord\|tuned\|song\|landed\|broken\|stun\|fell` with `&rs`, `&forks=`, `&age`; the grey probe (the tell against the body; ember against aether) |
| **KL17 The constructs** | `world/ketch/ketchRecolour.js` (the four machine bodies by ramp); `world/ketch/ketchSpiderModel.js` and the Spider's committed sheets; `KT_LOOKS`; corpses and the dither-out; aim lines; marks under the Wardens and the Captain; their presence (EG-LOOK section 9's law) | KL6, KL15 | `ketch_fight` (the recolour; no sink; corpses freed with the set; the marks); `kt_sprite_bake` (the Spider) | `?watch=&rise=`, `?aim=1`, `?wardens=asleep\|awake`, `?kind=&act=&k=` - with `?arena2` and the live run's sprites |
| **KL18 The voices and the blows seen** | `scenes/ketch/ketchVoice.js` (the Warden tuned to its keel, the Keel-Song sung, the Discord's howl, the wave's riding tone, the constructs' cues in place of `hostCue`); `ketchFx`'s bursts, shakes (capped at 3.0) and landing flashes for every blow; `scenes/ketch/ketchRead.js` and the ground view (the read's way out over the hazards off, call 6) | KL8, KL9, KL16, KL17 | `ketch_voice` (new: each cue once; a late wake never sounded; the tuned barks' targets); `ketch_fx` (new); `ketch_read` (new: no read over the hazards while call 6 is off). Mutants `ketch_look_fx`, `ketch_look_voice` | `?fx=<kind>&age=`, `?read=<blow>&me=`, `?voice=keelsong\|discord\|captain`; `ketchVoiceProbe.mjs` (each bark within 15 cents); the flash probe on the landing flashes (under 2.5 Hz) |
| **KL19 The words and the HUD** | The tracker as an instrument panel (stage studs, glyph rows, the needle); the bar's epithet and pipe pips; `scenes/ketch/ketchBeats.js` on `sdTitleCard`'s new `theme`; the crew card at the fall (`gateDamageChart` from `fell.dm`); the new `t()` keys in `locales/en/Port_Strings.csv` | KL3, KL16 | `ketch_hud` extended (glyph counts and the needle over a voyage run whole; the node updated, not rebuilt); `ketch_beats` (new: every beat once, a late page none, every word through `t()`); `l10n4_hardcoded`'s count unchanged | `?hud=<stage>` at 960x600 and 390x844 under `?grey`; `ketchHudSheet.mjs` |
| **KL20 Her presence in the world** | `ketchPresence.js` grown: the far picture (baked by `ketchBake`) and its dusk glint, the halos and running lights, the beacon by night, the plume, the chain of real links, her sounds outside (the keel's hum, the horn, the bells from her bearing), the shadow's caster (`setCloudShadowCaster`); the map's gauge-ring, glyph and course; the banner, the rumours, the Timers' line; KETCHSKY and KETCHDEP outside; the three terms in `bootWorld` | KL4, KL5, KL9, KL13, KL15, KL19 | `ketch_sky` extended; `ketch_presence` (new); `volumetricClouds` (no caster: byte-equal; a caster: only inside its rectangle); `hostceiling`. Mutants KTL-the-bell-rings-every-hour, KTL-the-shadow-off-the-sun, KTL-the-beacon-by-day, KTL-the-ring-on-the-city | `fields`, `walls`, `street`, `far` with `?world=sighted\|docked\|departing&p=` at four hours; the live run from the walls with `ARENA2_PATH` |
| **KL21 The ride up and the arrival** | `scenes/ketch/ketchRide.js` (the 3 s lift-off, the riders' cages, the veil both ways, the arrival cage's 1.6 s); `render/ketch/ktLiftVeil.js` and `VEIL_THEMES.ktUp` and `ktDown`; boarding, the way down and the fall through `stepThroughFire`; the tutorial page held past the first look (the one term in `buildDungeonContext`) | KL20 | `ketch_client` (boarding through `'ktUp'`, the way down and the fall through `'ktDown'`; a refusal boards nothing); `ketch_sky` (the lift-off's curve); `ketch_deck_host` (the arrival gate); the veil's theme pins beside the fire's and the Hour's; `hostceiling` | `?liftoff=0..3`, `?veil=ktUp\|ktDown&vt=`, `&forced`, `?arrival=0..1.6`; the sky-share probe on the arrival frame (at least 40%); the live run's boarding |
| **KL22 The cabin and the reward** | The Rourken cabin's dress and frieze; the stern glass; `world/ketch/ketchCabinArt.js` (the chart); the Ketchmaster's flat (`ketchMasterModel.js`, committed and gated); the chest's rings and lid (`ketchChestAt`); the lamps lit from the door inward; the spill up her scale (`spoilsPool` `dropPitch`); the Gilded salute and KETCHGLD; the share card | KL4, KL13, KL15, KL19 | `ketch_reward` (new: the spill's ratios; KETCHGLD once; the cradle only for a Thunderlock or a Pistolet); `ketch_deck_host` (the chest's states; the lamps' order); `kt_sprite_bake` (the Ketchmaster) | `cabin` at `hour=12\|19\|2`, `stern-window`, `chest`, `?chest=closed\|yours\|0.4\|1.2\|3`, `?share=gilded`, `helm&stage=5` |

**If the owner turns a call on**: call 5 ships as its own slice beside a relay version that ships anyway (the hub's
`_ktHeraldBeat`, `net/ketch/ketchHerald.js`, `net/herald/heraldCard.js`); call 6 is a switch in `ketchRead.js` and its pin
in KL18.

---

## Risks and what not to do

**What not to do.**

- **No relay change.** None of the eight Ketch files the relay bundles changes, no relay version moves, and `ketchLink.js`
  and `ketchClaims.js` stay as they are.
- **Never move a collider.** `ketchColliderOf(buildKetchShip())` and every part's `hit` stay byte-equal. No visual larger
  than the law where the law reads shape: the furniture inside the bulwarks' band, the pipe-forks' girth above 2.2 m, the
  Warden inside r 2.0 under 2 m, the nets' wall to 7 m, nothing on the walkable floor. Players believe silhouettes.
- **No host grows.** `bootWorld` and `createWorldModes` have no room at all: terms in their existing lines, each one in the
  hosts table, and nothing else.
- **No palette byte in the repository.** No `ART_PAL` colour in code, a test, a sheet or this page: the indices are code, the
  fallbacks are the port's own paint, the sheets are grey-index PNGs with no PLTE.
- **No ARENA2 byte kept or shipped.** The land, the made sounds and the sprites are read from the player's own data at
  runtime, asked again after an eviction, and freed with the ship.
- **Nothing that moves casts, and nothing carried casts.** `everyLightCasts` rebuilds a moving caster's cube every frame.
- **No flash over 3 Hz**, no frame swap, no blink; falters and heartbeats at 2.5 Hz or less.
- **No camera move** - no roll, pitch, sway or FOV - and no deck that moves.
- **No `GL_LINES`** for anything a player reads; every line at least 1.5 px.
- **Do not re-point pinned constants.** `KT_GLOWS`, `KT_LAMP`, `SD_LIGHT`, `TELEGRAPH_STYLE` and `KT_RING_CSS` stay where they
  are; `ketchLook.js` imports them.
- **No cloth, no wood, nothing organic**; no gulls; none of the Hour's time motifs.
- **No model for the Warden**, and nothing of the Remnant's rig on the Ketch.
- **No song switch for a cell or a resonator**: one song at a time; the state is in the air and the detune.
- **No read that eases the Gallery** while call 6 is off.

**Risks and their guards.**

1. **The hot loop.** The dungeon arm's dynamic loop is the most pinned path in the repository; this plan adds no field to
   it. The PVS writes `culled`, the moving parts `noShadow`, the states `texRemap` - each read only where a draw carries it
   today. `ketch_deck_host` and the loop's own tests run on every slice that touches the deck.
2. **The song player's two doors.** `startTick` and `detune` touch a shared system: both are additive and off unless a song
   asks; a song with neither is byte-equal, and the Hour's and the Spire's score probes run unchanged in KL4.
3. **The shared modules.** The Steps' `dress`, `sounds` and `cull`, the motes' layout, the veil's themes, the title card's
   `theme`, the spoils pool's `dropPitch`, the cloud field's caster and `writeIndexGreyPng` each keep their other users'
   pins byte-equal, and each is pinned as such in its slice.
4. **The bake's determinism.** The gate regenerates the sheets and compares them byte for byte: the rasterizer uses snapped
   integer edge functions, a fixed sample order and no `Math.random`, so the bytes are the same on every machine and
   Node version CI runs. A sheet that grows a PLTE chunk fails it.
5. **The land from data.** It reads the player's blocks at the stand: painted over idle frames (one record a frame on a
   phone), the painted fallback for a missing block or no heights, asked again at every stand and never kept across an
   eviction (PLACE-LRU), stood by the transform the world's city uses (`spawnedLocationCentreLocal`, as the client stands
   her), so the streets under her are the streets the street walks.
6. **Late pages.** The waking, the beats, the fall, the chest, the departure and every song's lock are pure functions of a
   word's `at` or the shared clock, never of when the page arrived; a page arriving late shows each as it stands.
7. **The mirror.** The needles, the vanes' feather, the wheel's spin, the turn west, the crown and the sprite's facings go
   through the camera's one mirror (`world/mat4.js`), pinned by lab probes - AUDIT SD II and III both learned it.
8. **Retro Mode.** The pixel-snapped passes snap to the retro image's pixels, or they go double-chunky.
9. **Shadows in the fight.** The bridge's lamps cast; the Warden's batches, the crown, the plates, the forks and the walls
   are `noShadow`; the sections cast only whole and still. Profile the Last Note with eight crew on a phone, and drop the
   motes, then the cumulus, then the reverb's impulses first.
10. **The PVS popping.** Zones held 4 m past their edge, and both sides drawn within 6 m of every opening; the lab walks
    every doorway at a step a frame and the probe fails a part that appears inside the frustum.
11. **Audio memory.** About 11 MB of made PCM on desktop and 3 MB on phones, built one bed a frame (at most 10 ms), let go
    the frame the player leaves her (`audio.fadeFar`).
12. **The score and the director.** The Ketch's law answers null wherever it has no song, and the director stands; the one
    term in `hourScoreFrame` is the only place it claims the music, so no two songs play together.
13. **Allocations.** Every mesh, pass, record, sheet upload and bed is freed by the module that made it, from the path that
    ends its life (`ketchDeckHost.clear()`, `ketchSky.destroy()`, the score host's leave); `ketchStatesOf` and the instance
    arrays are kept and written in place (AUDIT KETCH L3-16).
14. **Pins that move.** `ketch_deck_host` (the arcs, the lights, the draws, the sections), `ketch_sky`, `ketch_fight`
    (`KT_LOOKS`, the rise, `KT_WARDEN_LOOK`), `ketch_hud`, `ketch_model` (art sizes, the lamps) and `ketch_client`. Each slice
    rewrites only its own.
15. **CI's reach.** A term in `worldModes.js` or `world.js` (KL4, KL13, KL20) moves most of the suite: run the slice's own
    files and the host ceiling locally and leave the rest to CI's eight shards; merge main in first, since a pull request
    that conflicts runs no workflow.
