# AUDIT LPT - Low Poly Trees, 2026-10-05

The owner, of PR #613's LPT1 (`07-Rendering/Low-Poly-Trees.md`, head `2be8e769`): *"Lets do a comprehensive audit on
this. I want it to be perfect"* - of the integration asked for as *"compatible with seasons of daggerfall, ... performance
doesnt take a hit and draw distance can remain the same. A true visual overhaul with no performance loss"*. Four lenses
read it, each against the real data (the shipped `.dfmod` and an ARENA2, both kept out of the repository): the
rendering (A); the lifecycle, the memory and the cost (B); fidelity to the mod, to DFU and to Seasons of the Iliac Bay
(C); and the pins, the records and the process rules (D). Every finding was reproduced before it was fixed. No finding
needed the owner's choice; one doctrine question (D13) was answered on the doctrine's safe side and is reported.

Each fix is pinned in `test/systems/lpt1_lowpolytrees.test.js` (LPT1's own file, rewritten: 27 tests to 41) or in the pin it
moved (TACT1's cover sites). Mutation-proven: `tools/mutants/lpt1_trees.json`, 111 records - 110 dead, and one recorded as unreachable (a run whose atlas is gone: no handle in a set can lose its atlases today; the guard is kept against a hole). Twelve records of seven other lists re-aimed where this pass moved their code (the enhanced lane's flat sun read, the far rings' call, the trees' frame call, four cites the cite shift moved), every one dead.

Severity: **High** breaks the owner's ask (the seasons, the cost or the draw distance) or a tree's look for many;
**Medium** a wrong outcome for some; **Low** a nit, a cost or a word. A finding two lenses made is listed once, under
the first, with the other's id.

## A - the rendering

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | Medium | **The trees took the last flat's own state.** The flats' pass sends a struck body's flash, an elite's glow and pad, a dissolve, a wash and a water column only when they change; the trees, drawn after it, reset none - online, a struck peer (`900000_*` sorts last) flashed every 3D tree within 160 m red. (B8.) | `drawBillboards` puts each back before the trees (AUDIT LPT A1). Pinned: a struck, glowing, dissolving, washed batch drawn last, every one neutral at the trees' draw. |
| A2 | Medium | **A brightness ring at the handover, all night.** The 3D tree's faces took the sun's light or none (1.0 at night), the far picture bakes `LPT_IMPOSTOR_LIGHT`: inside 140 m the wood was 29% brighter (median 35%, worst 81%) than past 160 m, and stepped at dusk. | BB_VS mesh mode lights a face by the far picture's own law turned to the eye, crossfaded to the sun's by its share (`min(1, sunScale / LPT_SUN_FULL)`, 0.25): at night and at the band the two are one picture. Pinned in the evaluator: a face toward the eye shades as the picture's face toward its viewer, the up face alike. |
| A3 | Low | The crown's lean was measured up the prototype's height, not the tree's: a 0.6 tree swayed 36% as much as its far picture, a 1.4 one's top 29% moved rigidly. | `lean` by `uSize.y * aScale`. Pinned: a tree twice the size leans twice as far at its top. |
| A4 | Low | **The material's cut ignored and the atlases' mips blended.** Everything cut at 0.5 where the 507/508/509/511 leaves cut at 0.333 (6-29% fewer leaf texels at distance); `NEAREST_MIPMAP_LINEAR` blended a clear finer texel into a leaf's edge (67-90% of its colour - a dark rim). (C6.) | Each submesh carries its material (`_Cutoff`, `_Cull`, `_Color` - `readLowPolyTrees`): its alpha is multiplied so its cut lands on the flats' 0.5 (`uMeshAlpha`, `lptAlphaOf`; 0 an opaque card); the atlases sample `NEAREST_MIPMAP_NEAREST`, the mod's Point (`createAtlasTexture`). The alpha-weighted chain is kept where 23 of the mod's 30 textures have none - a translation, recorded on the page. |
| A5 | Low | Retro Mode's "no mip maps" never reached the atlases. | The renderer owns them (`createAtlasTexture`, `lptAtlases`, `releaseAtlasTexture`): `_applyRetroMips` caps them, and one made under it is made capped. |
| A6 | Low | **The opaque cards were drawn from behind.** The mod's `*_Opaque` materials cull their backs (`_Cull` 2); the pass drew both faces - four open opaque submeshes (`505_31`, `509_31`, `509_10`, `509_11`) seen from behind, their backs lit as their fronts. | A front-only submesh draws with `CULL_FACE` (BACK under the port's `frontFace(CW)`), and `renderImpostor` skips its back faces. Pinned on the GPU's calls and texel for texel in the far picture. |
| A7 | Low | A mesh uv past 0..1 was cleared by the flats' margin rule (6 triangles of 4 meshes; one of `504_19`'s gone whole). | The texel as sampled is kept before the margin clear (`LPT_FS_KEEP`) and a tree's fragment takes it back. |
| A8 | Low | The far-ring rule read the far picture's ×1.4 envelope. | B1. |
| A9 | Low | On an opaque atlas a texel the port leaves clear draws black where the author's has colour (`swamp_opaque` 3.7% of its sampled texels, `Desert_Opaque` 3.3%). | The extractor fills an opaque atlas's leftover groups from four texels (`FILL_MIN_OPAQUE`), and paints a fill's cell on an opaque atlas when it brings back more of the author's colour than it lays over his black: of the texels their meshes sample, `swamp_opaque` 3.2% -> 2.6% black where he has colour, `Desert_Opaque` 2.6% -> 1.9%, `501_Atlas_Opaque` 0.7% -> 0.04%, none laying colour over his black past 0.5%. The rest is the fills' limit, recorded below. | |

## B - the lifecycle, the memory and the cost

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | High | **The far rings drew 1.5 to 2.2 times the flats.** MAC1's rule (past ring 1, only flats 2.5 m or taller) read the far picture's size - the model times 1.4 - so 95 of 253 prototypes whose flat it dropped drew on every ring (504 12 -> 20 records, 506 11 -> 22, 510 11 -> 23: hundreds more draws at land view 5), and three tall flats (501_19, 501_24, 502_19) lost their draw distance. (A8.) | The batch carries the flat's own height (`farH = plain.h`, the classic or the season's) and the rule reads it (`b.farH ?? b.size?.h`): the far rings stand exactly the trees they stood. |
| B2 | High | **A season's change took the 3D trees from every climate the mod does not re-skin.** The source was one key a season for every archive; the re-skin rebuilds only pixels on archives SIB manages, so a desert, swamp or rainforest pixel's near trees found no atlases under the new key and vanished (their far pictures stood whole at the player's feet); after a third season their far pictures were freed under standing batches - holes. (C3.) | **Handles** (`farPicture` answers one: a prototype painted under a source) and **per-archive sources** (C2): a pixel's set names its own handles, so its trees draw from what its far pictures were painted from until it is rebuilt; a pixel that is never rebuilt never changes source. |
| B3 | Medium | **A season's install cached classic trees under its key.** `ensureSeasonalAtlasesInstalled` clears the cache and sets the season, then awaits the textures; a paint inside that window read classic pictures under the new key and kept them for the season. | The streaming host paints nothing seasonal while an install runs (`SeasonHelper.installing`, the port's), and a source carries its install (`s<season>.<generation>`); a paint a new install overtook is never kept. |
| B4 | Medium | **The 3D trees were never culled to the view**, and under the enhanced lane every tree vertex ran the flats' soft sun-shadow kernel. A wooded 3x3 gathers about a thousand trees, two thirds of them off screen. | `cullNear` tests each tree's sphere against the frame's normalised planes every frame and packs the visible ones run by run (`drawStart`/`drawCount`); in mesh mode the lane takes one shadow tap at the root. |
| B5 | Medium | **Nothing was ever freed.** Atlases (5.6 MB of GPU each with their chain, plus a 4 MB CPU picture) and far pictures lived for the session, tied to no pixel - up to 121 MB of GPU and 91 MB of CPU a source. | **Ownership**: a pixel holds its handles (`acquire` at the build, `release` in `destroyPixel` and BUILD-FAIL1's ledger); a handle no pixel has held for `LPT_IDLE_S` (30 s) gives its far picture back, an atlas no live handle reads its texture; an atlas's CPU picture goes `LPT_PIC_IDLE_S` (10 s) after the last picture was drawn from it and is painted again on demand. |
| B6 | Medium | A far picture spanned the model's whole reach: not "a flat's cost" - 2.2 to 4.6 times the classic quad. | Trimmed to what it draws (`trimImpostor` - clear rows off the top, the same columns off both sides so the root stays centred): 11.4% of the far pictures' fill gone. The rest is the mod's trees being larger than the flats, stated on the page. |
| B7 | Low | **Paint steps outran the breather's slice** - worst warm steps 5-6 ms (a far picture), 4.6 ms (a blit), 2-2.8 ms (a mip level), and a 4 MB upload in one call. | A step is bounded where its cost is: `LPT_IMPOSTOR_TEXELS` (4,096) or `LPT_IMPOSTOR_TRIS` (256) a far-picture step, `LPT_MIP_TEXELS` (16,384) a mip step, `LPT_ATLAS_BAND` (128) rows an upload; the blit's per-texel pair and the far picture's per-triangle arrays are gone (`orientedStep`). Warm worst steps now about 1 ms (GC aside). |
| B8 | Low | The trees inherited the last flat's uniforms. | A1. |
| B9 | Low | A record the player's data lacks painted an atlas with holes, where the doc said the classic flat stands. | `paintAtlas` counts what it could not paint (`missing`); such a handle is null and the classic flat stands. |
| B10 | Low | Every built pixel kept its trees' set (28 bytes a tree, 0.22-0.29 MB a wooded pixel, 121 pixels at land view 5); only the 3x3 is read. | A set is made as its pixel comes into the eye's 3x3 (`buildTreeSet`) and let go past the 5x5. |

## C - fidelity to the mod, to DFU and to Seasons of the Iliac Bay

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | High | **Every wild tree was darkened 0-50%** by DFU's terrain tint - which no shader of the mod reads (`_TreeInstanceColor`: 0 references in its SpeedTree, SpeedTree8 and Standard programs, 8,104 to `_Color`): a DFU player sees every tree at its full colour. | The tint is gone, near and far (`lptVariety` answers scale and turn); its reason recorded. |
| C2 | High | **Under SIB the trees took the season by the archive each texel was copied from**, not by the tree's: rainforest, subtropical and desert trees turned autumn (73-96% of their texels) while their flats stayed; 511's snow mountains took SIB's winter repaint, which SIB never gives 511. (D8.) | A prototype is painted under the season only when SIB re-skins its own archive now (`seasonal.key(archive)`); then each record of an archive it re-skins takes the season's picture, the rest stay classic - the 3D tree turns exactly when its flat does. Pinned: a 504 tree's atlas carries both, a 500 tree never asks. |
| C3 | Medium | The near trees vanished at a season's change. | B2. |
| C4 | Medium | **Two top-down crowns of every 1024 atlas were never painted** - the extractor skipped a region with no copy within 8 texels; 504_1, 504_18, 505_1 and 505_18 lost a third of their crown cards. | The fallback the header promised: the nearest kept copy's record. |
| C5 | Medium | Some side views are fills, not copies, and differ visibly (28 trees past 50/765 colour error or 5% holes). | Better fills: the copies' crown pieces kept (every verified copy of 40+ texels), the flats whose trees sample a region put first among its candidates, a winter atlas's region tried against the winter twin, and a region tried as the record stretched over it (`fit`, either mirror). 25 trees remain past the bound - recorded below. |
| C6 | Low | `_Color` 0.8 and `_Cutoff` 0.333 dropped. | A4. |
| C7 | Low | DFU turns every town tree of a block's column alike (`Random.InitState((int)position.x)`); the port turns each by where it stands. | A translation, recorded (a column of identical turns is the reference's accident of seeding). |
| C8 | Low | DFU also stands the mod in a dungeon's nature flats (S0000041.RDB: 15 of its 21). | Flagged and quantified on the page, as the FOUR HOSTS rule asks. |
| C9 | Low | The coverage numbers ("80-91%", "76-100%"). | Measured again and corrected: D11. |

## D - the pins, the records and the process rules

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | High | **The far picture's content and orientation were unpinned** - upside-down, mirrored, off-centre, inverted light, no depth test and the root scale ignored all survived. | Texel for texel against a one-quad mod built in the test: each corner of the atlas where the viewer sees it, lit and coloured by the law, cut at its cut, its back faces by its material. |
| D2 | High | **The SIB pin could not fail on the law** - a season's picture asked for and never painted survived. | The atlas's texels counted by colour: the re-skinned archives' records carry the season's, the others the classic. |
| D3 | High | **"A tree gives the same cover" was unpinned on `world.js`**: TACT1's pattern missed the `plain` site, so deleting it, or covering at the tree's size, survived. | TACT1 counts four sites (the low-poly one at `plain`), and LPT1 pins `coverProxies(c, plain,` on both hosts. |
| D4 | Medium | A felled tree's fall (BB_VS's tip branch) was unpinned: a 945 m wide falling tree survived. | Evaluated: a scaled corner tips at its own share. |
| D5 | Medium | The door's run fields were never held to what the renderer reads. | One run deepEqual'd field by field from the door's frame. |
| D6 | Medium | The draw test missed most of `_drawLowPolyTrees` (the atlas bound, the trees' vertex array, the instances pointed, the origin, size, sway and cut sent). | Each pinned on the recording GL, with the material uniforms and the faces. |
| D7 | Medium | The hosts' placing and sizing was unpinned (the scale, the translation, the stamp, the location host's eye and scale, the sway's height). | Pinned in the hosts' test. |
| D8 | Medium | "Exactly where the flats would have" was false. | C2. |
| D9 | Medium | The step pin could not fail (112 triangles against 256 a step). | Exact step counts: a synthetic tall tree's, and the mod's largest (509_11, 4,488 triangles). |
| D10 | Medium | The A/B recipe given to the owner was not one: `SCENES=road` spawns a different town each run. | `SCENES=city` (the measurement's own scene). |
| D11 | Medium | The coverage figures were wrong in every record. | Measured again, of each larger atlas's drawn texels, 75.5-90.9% are copies (the five small pictures 100%), 8.4-22.0% fills - a fill's texel on average 155-290 of 765 off his colour - and 1.3-7.6% left clear. |
| D12 | Low | "The five small ones are TEXTURE.502/503 records" - they are 501_19, 502_25, 502_30, 508_1 and 506_28. | Corrected and pinned. |
| D13 | Medium | **Doctrine**: each erase run started and stopped on the record's own transparency, so `atlases.bin` held exact 1-bit silhouette fragments of ARENA2 records (335,404 spans). | Answered on the doctrine's safe side, without waiting for a ruling: a run is the whole gap between this copy's own claims, through texels the record leaves clear (the paint skips those anyway), so no run traces a record's silhouette - 335,404 spans to 300,993, the file 1,006,212 bytes to 903,518. Reported to the owner. |
| D14 | Low | Smaller records: "some 45 draws", "a climate using four to seven", the light law's claim, "rebuilds every file", the switch "read as each pixel is built" (it is read once, at boot), "Kamer's third" (his sixth), "the owner's word", the extractor's header. | Each corrected. |
| D15 | Low | Process rules: `LPT_SOURCE_ARCHIVES` repeated `LPT_ARCHIVES` (ONE DFU MEMBER, ONE EXPORT); `clearFrame`, `nearReady` had no caller. | The tool reads `LPT_ARCHIVES`; the dead members gone; `destroy` kept and said to be the test host's (the world holds the door for the session, as it holds the mills' parts). |
| D16 | Low | Weak details: the quarter turns checked against themselves, `LPT_REGATHER_M` pinned by its own name, `tileCrop`'s y-mirror and the snow flag unpinned. | Each pinned by value. |

**After the merge** (the same day): the desktop release's Windows leg refused to check the tree out - `LPT1` is a DOS
device name, reserved on Windows with any extension, so Git for Windows calls the mutant list `lpt1.json` (in `tools/mutants/`)
an invalid path (the PR's CI runs on Linux alone and never met it). The list is `tools/mutants/lpt1_trees.json` now, and REL7
(`test/tooling/rel4_release.test.js`) holds every path in the tree to what a Windows checkout takes.

## Recorded, not fixed

- **The fills are near the author's, not his.** The regions no record copies - his top-down crowns and some larger
  side views - are folded, tiled or stretched from the records they were made from. Measured against his atlases: of
  each large atlas's drawn texels, of each larger atlas's drawn texels, 75.5-90.9% are copies (the five small pictures 100%), 8.4-22.0% fills - a fill's texel on average 155-290 of 765 off his colour - and 1.3-7.6% left clear. In the far pictures (side on, his atlases against the port's): mean
  0.6% holes, 0.5% extra, 10/765 colour error; 25 of 253 trees past 50/765 or 5% - worst the winter firs 507_24/30 and
  511_30 (6.8% holes, 72/765), 507_5/11 and 511_5/11 (about 105/765), and the swamp tree 502_1 (its orange foliage
  olive). The only way to the author's every texel is his own pictures, which the doctrine keeps out of the repository:
  read from the player's own `.dfmod`, as Seasons of the Iliac Bay's are - offered to the owner as the next step.
- **A season's first install, mid-build.** A pixel whose build began while SIB's install was refilling its cache keeps
  classic trees (and, as before this PR, classic flats for the archives not yet refilled) until it is next built -
  AUDIT 61's re-skin keys on the install a build began under. The tree caches can no longer keep it past the pixel (B3).
- **A cold JIT.** The session's first paints run before the engine has compiled the painters: steps several times
  their warm cost, once.
