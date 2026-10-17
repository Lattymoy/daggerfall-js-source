# AUDIT WEAPON-GLOW (2026-10-16) - the weapon glow, audited

The owner, of WEAPON-GLOW1 (`05-Combat/Weapon-Glow.md`; branch `ccr-431b94e1-ioad4i` at db230a2f): **"Just want to
audit this and ensure perfection"**. This page is the findings, each with its verdict. What the audit changed is written
into the record's sections as they now stand, each marked AUDIT WEAPON-GLOW and its id.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at db230a2f - `Home.md`'s DO NOT FIX WHILE
THE VERIFIER IS READING: the fixes went into the tree while the lanes read the snapshot), each told to prove a finding
- a repro run against the real code, or the code quoted with a concrete trace - before reporting it; then the author's
pass, every finding reproduced or traced before it was acted on:

| Lane | Over | How |
|---|---|---|
| LAW - the law | `systems/weaponGlow.js` against `lootRarity.js` `readLines`, `lootPowers.js` `linesOf`/`lootBlow`, every producer of an elemental line | the real producers (`applyRarity`, `addProcLine`, `setGem`, `exaltLegendary`, `mintGilded`, `mintAetheric`, MAGIC.DEF's `createRegularMagicItem`); probe mutants against the test file |
| SPR - the classic sprite | `drawScreenQuadGlow` and its shaders, the three classic drawers, the plain-sheet demotion | the real renderer in headless Chromium (SwiftShader): timed draws, the band's reach measured over 40 clock samples against a wide window, a frame flush with its edges |
| MW - the Morrowind pass | `_drawWeaponGlow`, the rings' depths, the third-person picture, the batch's tiles | the depth arithmetic at the sprite target's real format (D16), BODY-DEPTH's composite traced, the draw and call counts |
| NET - online | the look's `glow` from `composeLook` through the wire and the relay to `PeerBodies._arm` and the arm | the relay's real parse; every rollout order; the swap's timing in `fpArm.js` |
| DOC - the record, the tests, the mutants | every sentence the slice wrote against the code; the locales; the pins it moved | probe mutants (P1-P9) against the test file; the counts measured |

What reached a player: nothing (the branch is unmerged, the relay undeployed). On the branch, the classic outline cost
eighty times its sprite (SPR-1); a third-person or a peer's outline hid behind every wall and floor it stood in front of
(MW-1) and was cut flat at its picture's edge (MW-3); and during a peer's weapon swap the next weapon's glow was drawn on
the last (NET-1).

## Findings

### Lane LAW - the law

| # | Sev | Finding | Verdict |
|---|---|---|---|
| LAW-1 | MED | The tests left the law's regressions alive: the ladder's switch only ever injected (`{ ladder: false }`), the arcane look only ever asked of a Rare with the ladder on - four probe mutants survived | FIXED: the ladder's PREF off asked with no option, DFU's own MAGIC.DEF weapon arcane at level 2 with the ladder on and off, a forged out-of-band line, an Exalted's elemental line and the Hourlock at level 3 (`test/systems/weaponglow1.test.js`); mutants |
| LAW-2 | LOW | An Aetheric or a Gilded weapon with no element is bare in the Morrowind hand while any Rare glows arcane - they carry no DFU enchantment | LEFT, decided and written (`Weapon-Glow.md` law 5 and Not done): arcane is DFU's enchantment's look, and their powers are their records'; pinned (the Dragonfire Oath bare) |
| LAW-3 | NIT | The law's header cited two files that never existed | FIXED: it cites `renderer.js` `drawScreenQuadGlow` and `_drawWeaponGlow` |
| LAW-4 | LOW | Every ask allocated (an options spread, the sums, the result, a key string) though its comment said none - and it is asked every frame | FIXED: the element summed into arrays kept for it, every spec built once and frozen (`SPEC_TABLE`), the words a `Map`; a socketed piece's `readLines` still builds its capped copy - the blow's own reader, kept |
| LAW-5 | NIT | A cached spec was frozen but its ramp writable (a probe's write reached every later ask), and its level unchecked (`'2'` cached a string level) | FIXED: the ramp frozen with it; a level that is not 1-3 (the arcane look 2 alone) is no spec; pinned, mutants |
| LAW-6 | NIT | A dead check in the test (`LR.isEnchanted` does not exist) | FIXED: `inventory.js` `isEnchanted` |
| LAW-7 | NIT | The wire's pattern restated the looks, tied to nothing, and took `arcane1`/`arcane3` | FIXED with NET-4: the pattern takes exactly the specs' ten words, pinned against them |

### Lane SPR - the classic sprite

| # | Sev | Finding | Verdict |
|---|---|---|---|
| SPR-1 | HIGH | The outline searched up to 234 texels for every screen pixel of every frame - a fire outline at level 3 took 649 ms a draw against the sprite's 8 under SwiftShader (80x); a strike frame at 1080p 158M texel reads | FIXED: the frame's FIELD (`GLOW_FIELD_FS`) baked once a frame, look and cut into a small picture, read once a pixel; GLOW_FIELDS_MAX kept, the least recently drawn deleted; the lane's probe again: 46 ms (6x the sprite, its noise per pixel); pinned (the bake and the cache, the eviction), mutants |
| SPR-2 | MED | The window was smaller than the reach the shader makes - shock's band cut in 40 of 40 frames at level 3, frost's in 12 - ending in the window's box | FIXED: `GLOW_REACH_MAX` (each look's top, pinned against `gwReach`'s own numbers), the reach clamped there, and `GLOW_SPRITE_WINDOW` every cell within it in the look's metric (pinned cell by cell) |
| SPR-3 | MED | The frame's border counted as transparent: the arm's cut at the bottom of the screen took a rim, a band hung under it, and a frame flush with a retro pillar drew into it | FIXED: the drawer says the screen (`view`); the bottom and a flush side are CUT - a cell past one reads as its edge cell, and the quad grows no pad there; pinned, mutants |
| SPR-4 | MED | The outline was measured in texture texels, so the Thunderlock's (3.7 texels a pixel) and an HD frame's were a third as thick | FIXED: a cell is a Daggerfall pixel of the frame (the drawer's `art`, a record's size, the Thunderlock's union box); the probe's HD sword wears the classic one's outline exactly |
| SPR-5 | MED | The outline wraps the hand, the sleeve and the Thunderlock's smoke - "solid" is any opaque texel | LEFT, decided (`Weapon-Glow.md` Departures): a classic frame carries no mask of weapon from hand - the dye band marks metal alone, so a staff or a bow would lose its outline - and a hand on a burning hilt stands in its light |
| SPR-6 | LOW | Neither glow program was warmed | FIXED with MW-6 |
| SPR-7 | NIT | Every ask allocated | FIXED with LAW-4 |

Checked clean: row order and direction for every texture reaching the drawers; the mirror; the GLSL; the 2D bracket and
the shadows; the plain-sheet demotion's cache key under every change of switch, identity and set; the widget's type
change; every gate that hides the sprite hides the outline.

### Lane MW - the Morrowind pass

| # | Sev | Finding | Verdict |
|---|---|---|---|
| MW-1 | HIGH | BODY-DEPTH stood a ring's texel where its depth said - a reach (4 m and more) behind the body - so a wall or a floor behind a third-person body or a peer hid its outline | FIXED: a texel at `GLOW_DEPTH_FLOOR` or past it keeps the quad's own depth (`bodyDepth`); the floor pinned under every ring's depth, mutant |
| MW-2 | MED | The rings were 1e-5 apart in window depth and the sprite target's is 16-bit (a step 1.5e-5): the two inner rings fell on one value and the hottest band never drew | FIXED: `GLOW_RING_FAR` 0.999, `GLOW_RING_STEP` 1e-4 - every two depths at least `GLOW_DEPTH_STEPS` D16 steps apart, pinned |
| MW-3 | MED | A third-person picture grew by a share of its height, under a texel at a far body's rows, so the outline was cut flat at its edge | FIXED: `drawRigSpriteBox`'s `glowLook` pads the picture by `glowPad` - the reach in texels at the unit the PADDED picture draws at, a texel the size it was; the unit no longer floors at a texel (`GLOW_UNIT_MIN` 0.5); pinned, mutants |
| MW-4 | LOW | A batched body's pattern was in the target's coordinates, so it re-rolled whenever its tile moved | FIXED: counted from the tile's corner (`uGlowOrigin`); pinned on a real batch, mutant |
| MW-5 | MED | Fire drew 57 draws a weapon range a body a frame, each re-binding its texture - ten peers ~1,100 draws | FIXED: one instanced draw a range (`uGlowDraw`, `GLOW_DRAWS_MAX`); pinned (the rows, the count), mutants |
| MW-6 | LOW | Neither glow program was warmed | FIXED: both in `lazyWarmSteps`; pinned, mutant |
| MW-7 | NIT | The charge took its derivatives after a conditional discard | FIXED: first in `main`, as `skinFaceFs` does |
| MW-8 | NIT | Under a Weapon Widget scale the Morrowind outline stayed one thickness while the classic one grew | FIXED: the arm lays its LENS's unit on the mesh (`mesh.glowUnit`); pinned, mutants |

### Lane NET - online

| # | Sev | Finding | Verdict |
|---|---|---|---|
| NET-1 | LOW | During a weapon swap (its archives loading, or a hand switch while the arm is busy) the next weapon's glow was drawn on the weapon still held | FIXED: `setWeaponGlow(spec, item)` - the arm lays a glow only while its mesh holds the weapon it is of (`glowShown`, `wornWeaponKey`); pinned on the fixture rig, mutants |
| NET-2 | LOW | A sheathed weapon's glow drew nothing but still grew a third-person picture by a tenth a side | FIXED: shown only in hand (`weaponInHand`); the picture's room is MW-3's pad, asked of the look shown; pinned, mutant |
| NET-3 | NIT | world207's note was folded into world208's line | FIXED: its own `// world207:` line, world208 re-hashed in place (undeployed; the merge of main since renumbered the branch's law world209, past main's INSTANCES world208) |
| NET-4 | NIT | The wire took `arcane1`/`arcane3` and a weapon's glow in any slot | FIXED: the ten words, a weapon in a hand alone (`lookGlowOk`, `LOOK_GLOW_SLOTS` the siege referee's hands); `composeLook` and `peerStubEntity` read the one law; pinned (a shield in the left hand too), mutants |
| NET-5 | NIT | Two comments wrong (a `LOOK_ITEM_FIELDS` cite; "allocates nothing") | FIXED |
| NET-6 | NIT | `_arm`'s glow was pinned by text alone | FIXED: driven through `PeerBodies._arm` with a stub rig (the hand in use, a tool, claws, a creature, the viewer's switch, a new word), `setLook`'s glow-only change; mutants |

Checked clean: the relay's pass-through; nothing refuses a look; every rollout order (an older relay strips the word, an
older client never says it); world208 consistent across its pins; `isPlayer` true on every look a player composes.

### Lane DOC - the record, the tests, the mutants

| # | Sev | Finding | Verdict |
|---|---|---|---|
| DOC-1 | MED | The page said fire's embers were three shifts; they are nine | FIXED |
| DOC-2 | MED | The Features note said a weapon "that deals" an element's damage glows (a Legendary's power and a cast-when-strikes spell deal it and show none) and that Off draws weapons "as the original does" (OpenMW glows an enchanted part) | FIXED: "with a ... damage bonus", "as before"; the notes budget re-measured (22359), the 25 drafts redone |
| DOC-3 | MED | The patch notes said other players see your glow - false until the relay is deployed, and the viewer's switch decides | FIXED in the pull request's text |
| DOC-4 | MED | The arcane charge's swirl was outside the clock test's reach (a probe mutant survived) | FIXED: counted; mutant |
| DOC-5 | MED | Testing.md's glstate row said three 2D primitives | FIXED, and Rendering-Arc's record annotated |
| DOC-6 | MED | The law's header named files that never existed | FIXED with LAW-3 |
| DOC-7 | LOW | No Active-Arcs line | FIXED |
| DOC-8 | LOW | The page never named the relay version | FIXED: Online names it (world209 since the merge of main) and its rollout |
| DOC-9 | LOW | Law 3's wording made the level the tier's | FIXED: the total's (a Rare line of 3 reads 1, a Legendary's floor 2) |
| DOC-10 | LOW | Shock's surge "a few times a second" - one in five of its thirds of a second | FIXED |
| DOC-11 | LOW | The read-back exclusion named no mechanism | FIXED: `renderCharacterSpriteImage` raises `_studioDepth` |
| DOC-12 | LOW | Six probe mutants survived (the window's width, fire's window, the pull's sign, the charge's depth mask, the unit's clamp, arcane's level) and two test nits | FIXED: each pinned, each a mutant |
| DOC-13 | LOW | The Thunderlock and Diverse Weapons pages did not know the plain-sheet departure, and the page did not name `GetModdedWeaponFilename` | FIXED |
| DOC-14 | LOW | Testing.md's boot2 row did not record its ceiling's move (81) | FIXED |
| DOC-15 | LOW | Not done omitted the reference's glow on enchanted armour and clothing | FIXED |
| DOC-16 | LOW | The probe's default output directory was not ignored | FIXED (`.gitignore`) |
| DOC-17 | NIT | A stale pin message (world187), `heldGlow` for `askHeld`, the page's header, Online-Arc's six fields, the PR's wording, the Japanese Off sentence | FIXED |

## What stands

- `test/systems/weaponglow1.test.js`: 21 tests (14 before the audit). `tools/mutants/weaponglow1.json`: 58 mutants (21 before),
  all dead; three other slices' records (`mwnpc5`, `ow4j`, `prbow1`) re-aimed by content at the drawThird line the pad
  moved, and run again.
- `tools/weaponGlowProbe.mjs` draws the HD sword beside the classic one; the sprite lane's timing probe was run again on
  the fixed tree.
- Not verified here: neither ARENA2's WEAPON CIFs nor the Morrowind archives are in this environment, so the outline has
  not been seen on the real classic frames or on a real Morrowind NIF on a GPU; peer glow has not been seen across a
  deployed relay.
