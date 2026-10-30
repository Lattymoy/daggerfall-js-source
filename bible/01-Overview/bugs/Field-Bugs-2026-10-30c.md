# FIELD BUGS 2026-10-30c - the Aura Armory across a sprite's card (ARMORY-MIRROR)

Two reports from the owner, of the Aura Armory (`04-Characters/Aura-Armory.md`) on an Eye of the Beholder sprite: "New
guild arm band isnt correct on the sprite" and "Head aura doesnt allign on the sprite". Read on `b92fd38e1` with the
freeware's data (`tools/fetch-data.sh`). Not a DFU member: Daggerfall Unity has no cosmetic pieces. The pins are
`test/render/armorymirror.test.js` and `test/render/armory.test.js` (HOST-SPLIT, its pins moved), the mutants
`tools/mutants/armorymirror.json` (8, all dead). The probe `tools/armorySpriteProbe.mjs`: 5 of 67 before, 67 of 67 after.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "New guild arm band isnt correct on the sprite" | Every sprite piece stood mirrored across the card; a side view put the band on the right arm, a three-quarter back view on the back | ARMORY-MIRROR 1, 2 |
| 2 | "Head aura doesnt allign on the sprite" | The same mirror: the crown and the halo stood beside the head | ARMORY-MIRROR 1 |

## 1. The card's right (ARMORY-MIRROR 1)

FOUND. A sprite's pieces stand at its picture's own marks: each point moved across the card by its offset (`dx`,
`render/armoryPose.js` poseFromFigure) along the card's right. The pass took that right from the view's first row
(`render/armoryPass.js` draw, `scenes/auraHost.js`). The world's lens is mirrored (`world/mat4.js` mirrorProjectionX),
so that row is the screen's left. The billboard paints the picture along its camRight, the row's negative. So every
offset landed mirrored - the head, the chest, the arms, the legs - and the quad's own offset twice. In the real renderer
at 2.4 m a crown or a halo stood 15 to 115 px beside the head, and the armlet 6 to 135 px off its arm.

The profile's stage draws under a plain lens, its card along that row, so the pieces fit there. `tools/armoryProbe.mjs`
draws its own card the same way. Neither could see it.

FIXED. `cardRightOf` (`render/armoryPass.js`) is the view's first row, turned round under a mirrored lens (mirroredVp).
The pass and the world host's footfall step read it. On the stage it is the row, as before.

## 2. The armlet on a side view (ARMORY-MIRROR 2)

FOUND. A side view's arms are not read off its picture (`spriteArmsSeen`). Its arm points are the sets' rows turned
with the body, its own left and right. `armletSide` read them as the picture's sides. With the body's right side to the
eye, the band stood on the right arm; with its left side to the eye, on the far arm, hidden behind the body.

FIXED. A pose says when its arms were not read (`armsTurned`). The armlet then takes the body's left arm, as on a rig.

FOUND TOO, after the owner's "Arm band still has issues", in close-ups. Seen from behind and to the body's right, the
three-quarter back picture (mirrored) hides the left arm behind the torso in every set. Its picture's left edge is the
back's or the cape's, so the band stood on the back. The three-quarter front picture shows both arms, so it keeps them.

FIXED TOO. `armletSide` answers none there (`ARMLET_HIDDEN_SIN`, the eighth's edge off straight behind), and nothing is
drawn, as from the right side.

## 3. How it is checked

`tools/armorySpriteProbe.mjs` draws the sprite through the renderer's own billboard under the game's lens, from all
eight views, on a skin (112364) and on Layered Gearing (male, leather). It measures each piece against the picture's
marks: the crown and the halo over the head, the armlet on the left upper arm (hidden where the body covers that arm),
the Ember Heart on the chest seen square on, and the Eternal Greaves between the knees and feet.

Three measures allow for the pieces' own design. The halo is read by its ring's ends, since its comet and its spark run
round the ring. The heart is read square on only: its point stands 0.1 m forward of the body's axis. A side view's
greaves are held to 7 px, as its knees and feet stand 2 cm either side of the card.
