# AUDIT AMBIENT-LIFE - the creatures read cold, 2026-10-31

The owner, of AMBIENT-LIFE (`07-Rendering/Ambient-Life.md`) the day it was written: *"Can you audit this. Make sure its
perfect?"* Three cold lanes read the slice at `585c9bdfb`. Each was given its files and the repo's rules, never a
conclusion, and asked to reproduce a finding before reporting it; nothing was changed while they read. The CI-style
suite (no ARENA2) ran beside them and found five more (S1-S5).

| Lane | Read | Found |
|---|---|---|
| A | the sim and its law: the cast, the birds, the ground's creatures, the instances, their pins | A1-A19 |
| B | the pass and the hosts: the GL state, the shaders, the draw order, the worlds the hosts lend, the teardown | B1-B10 |
| C | the records, the moved pins, the player text and its 13 translations, the probe | C1-C17 |

In the tables, *Pinned by* names the test file: `audit` is `test/systems/ambientLife/ambientlife_audit.test.js`, `cast`
`ambientcast.test.js` beside it, `pass` `test/render/ambientlifepass.test.js`, `host`
`test/scenes/ambientlifehost.test.js`. Each pin's title carries its finding's ID.

## Decided here

| The question | The call | Why |
|---|---|---|
| **The lane** (B6): every sibling (Windfall, the wisps, the haze, the snow) stands on the enhanced lane alone. | The same: built with `enhanced: !!sky.enhanced`. | The row is an Enhanced one, and the classic lane keeps DFU's outdoors. |
| **The dry falls' word** (A1, B2, C1). | The ear's word, but a sandstorm's or an ashfall's own (`wildlifeWord`). | The ear hears those as a cloudy day; the birds should not fly in them. Recorded on the page as a departure from the ear. |
| **A cliff too steep to climb** (found pinning C2). | A lone bird turns back; it never goes into the ground. | A bird climbs what it can in 1.5 s and turns from the rest. |
| **The fixed city's water** (C15). | Wired: its tilemap's water tiles, as the streamed world's. | Cheaper than a flag in Home.md's list. |
| **The skipped gone bird** (a mutant). | Kept, recorded `equivalent`. | Belt-and-braces beside the guarded perch release (A11). |

## Fixed - the sim (A)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| A1 | HIGH | **A sandstorm or an ashfall grounded nothing**: the hosts passed the ear's word, which reads both as cloudy. | `wildlifeWord`: the world's own word for the dry falls. | host |
| A2 | HIGH | **Soarers never left, trailed kilometres behind a runner, and sank under a slope** (their height fixed at spawn). | Followed at 6 m/s, let go past 180 m, the height eased over the land below. | audit |
| A3 | MED | **Bats never left**: outrun, they trailed hundreds of metres behind. | Let go past 78 m; another comes. | audit |
| A4 | MED | **A flushed bird the player followed hung still** at its goal. | Its way pushed 60 m on ahead whenever it nears it. | audit |
| A5 | MED | **A feeding flock's birds landed inside houses** and on water: their patches and hops were not looked at. | Each patch and hop is open ground (built, dry, under no roof), or the spot. | audit |
| A6 | MED | **Butterflies and fireflies rose and drifted inside houses.** | Spawned on open ground, and each turns back from a roof or water ahead (found by the pin: the drift too). | audit |
| A7 | MED | **Pins that could not fail** (the jump, the prune, the origin, the speed, the coast, the leaves, the slope, the ridges, the cast's weathers). | One pin each; the record's numbers whole; 56 mutants committed. | audit, cast |
| A8 | MED | **A town's pigeons were dead code**: the clause excluded every climate it could change. | Each palette's own town bird. | cast |
| A9 | MED | **A walk read as a run**: 4.5 m/s is inside the walks (3.67 to 6.33). | 6.6 m/s, between the fastest walk and the slowest run. | audit |
| A10 | LOW | **A long frame read as a sprint**: the speed was taken on the clamped frame time. | On the frame's own time. | audit |
| A11 | LOW | **A perch release could splice the list's last perch** (index -1) when its bird was pruned the same frame. | Guarded, and a gone bird is skipped. | audit |
| A12 | LOW | **Ground still streaming read as a coast**: gulls inland on arrival. | A point counts only on built ground; four rings, 15 m apart, for the ponds between. | audit |
| A13 | LOW | **The town was forgotten for a frame** after an origin move, and the first cast read before the boxes. | The town held across a move; the host surveys before the cast; a clear forgets the coast. | audit, host |
| A14 | LOW | A cast's drop picked a runner already burrowing. | It skips them. | - |
| A15 | LOW | **A hamlet cost 24 rays a frame for ever**: its few roofs never filled the 28 perches. | After twelve looks that find nothing new, two looks a second. | audit |
| A16 | LOW | The angles grew without end, a float's precision lost after hours. | Written wrapped. | audit |
| A17 | LOW | Small allocations every frame (filters, closures, a generator). | In-place sweeps and loops. | - |
| A18 | LOW | Creatures vanished at full size at their leave distances. | Each fades over the last 15 m before its reach. | audit |
| A19 | LOW | The flock pin used an unseeded random and set its landing by hand; the page's flush delay was off. | Seeded; the landing pinned through the producer (A5); the page corrected. | audit |

## Fixed - the pass and the hosts (B)

| ID | Sev | Finding | Fix | Pinned by |
|---|---|---|---|---|
| B1 | HIGH | **Over Deep Waters' sea the birds flew under the water**: the ground there is the seafloor. | The streamed world's ground is the sea's top over the sea. | host |
| B3 | MED | **Nothing ran the draws or the vertex stage's `main()`**: the GL state, the underside, the travel view's guard. | A recording context (`test/render/fakeGl.mjs`); `main()` run in JS; the `!tvf` guards pinned. | pass, host |
| B4 | MED | **At the light's floor only its halo showed**, so a far firefly twinkled. | The floor holds the hot core at three pixels. | pass |
| B5 | MED | **Perched and feeding birds sank half into the roof**, the underside z-fighting a flat roof. | A bird with its wings shut is lifted onto its feet, and sits level. | pass |
| B7 | MED | **The blended flats and the veiled bodies painted over the fireflies** in the streamed world. | The lights drawn after them (`drawLights`), a seam of their own. | host |
| B8 | LOW | = A12. | | |
| B9 | LOW | A ray answer and a light read minted each call. | One ray answer kept; the light read only when the bodies draw. | host |
| B10 | LOW | A draw had no catch; a dispose before the compile left it started; the probe's handle kept a disposed host. | Caught as the frame is; the started compile let go; the handle cleared. | host |

## Fixed - the records and the text (C)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C2 | MED | Most of the record's numbers would survive a change; no mutant record. | `tools/mutants/ambientlife.json`: 56 mutants, 55 dead, one equivalent as recorded. |
| C4 | MED | No Port-Ledger row, where every comparable addition has one. | Port-Ledger A, AMBIENT-LIFE. |
| C5 | MED | The travel view's exemption was held by nothing. | = B3. |
| C6 | MED | The probe was described, never run. | Run below. |
| C7 | LOW | "Snow halves what flies" was untrue (butterflies kept). | Snow keeps the butterflies in; the page says what each weather does. |
| C8, C9 | LOW | "No sky" in `worldModes.js` (it has made levels); a door does not start the creatures afresh. | Both said as they are. |
| C10 | LOW | The cost figure was overstated. | Said with its conditions. |
| C11, C12 | LOW | Two index lines said "one instanced draw"; the switch's path was wrong. | Two draws; Settings › Graphics › Plants, wind & wildlife. |
| C13, C14 | LOW | Czech used the formal "you"; nine other drafts read stiffly. | Redrafted in-session. |
| C17 | LOW | "Trees are pictures" is untrue with Low Poly Trees. | "Trees stand no collider." |

C1 = A1, C3 = A8, C15 is decided above, C16 = A19.

## The suite (S)

| ID | Finding | Fix |
|---|---|---|
| S1 | `steer`, `makeBody`, `paletteOf`, `edgeShare` and `turnToward` were already exported elsewhere (`audit24_onehome.test.js`). | `steerBody`, `makeCreature`, `climatePalette`, `reachShare`, `headingToward`. |
| S2 | The probe handle's reset stood outside the shot gate (`probegate.test.js`). | Behind it. |
| S3 | `farring.test.js` counts the world host's seams. | Pin moved (33 to 35). |
| S4 | The haze upload's form (`bantha1_jungle.test.js`). | `haze ?? NO_HAZE`. |
| S5 | A reversed `smoothstep` in the light (`sd20c_render.test.js`). | Fixed before the audit, at `585c9bdfb`. |

## The probe

`tools/wildlifeProbe.mjs` boots the streamed world in Daggerfall at noon and jumps to Solitude. On this container's
software GL a boot takes most of an hour; its run is written here when it ends.
