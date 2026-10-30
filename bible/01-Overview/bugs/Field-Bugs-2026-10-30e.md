# FIELD BUGS 2026-10-30e - the Aura Armory across a sprite's card (ARMORY-MIRROR)

Two reports from the owner, of the Aura Armory (`04-Characters/Aura-Armory.md`) on an Eye of the Beholder sprite: "New
guild arm band isnt correct on the sprite" and "Head aura doesnt allign on the sprite". Then, of the fixes as they
landed: "Arm band still has issues", "Guild patch is still wrong", "Still wrong on one of the angles", and "Dont worry
about the skin system. Only worry about the layered system". Then: "ensure the armory aura sets dont show through the
body and allign perfectly on the sprites".

Read on `b92fd38e1` with the freeware's data (`tools/fetch-data.sh`). Not a DFU member: Daggerfall Unity has no
cosmetic pieces. The pins are
`test/render/armorymirror.test.js` and `test/render/armory.test.js` (HOST-SPLIT, its pins moved), the mutants
`tools/mutants/armorymirror.json` (22, all dead). The probe `tools/armorySpriteProbe.mjs`, on Layered Gearing: 10 of 257
before (none of the armlet's), 296 of 296 after, 96 of 96 close up, and 392 of 392 for both sets piece by piece.

The names `-30c` and `-30d` are main's DECK-ROAD and BEAT-LANE pages, which took them first.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "New guild arm band isnt correct on the sprite" | Every sprite piece stood mirrored across the card; a side view put the band on the right arm, a three-quarter back view on the back | ARMORY-MIRROR 1, 2 |
| 4 | "ensure the armory aura sets dont show through the body" | The Ashbound Bracers and Eternal Armlets drew on an arm the picture hides, on the back; a side view's on the body's middle | ARMORY-MIRROR 4 |
| 3 | "Guild patch is still wrong", "Still wrong on one of the angles" | The patch stood half a guessed arm in from the arm's edge, on the strap and the shoulder's shadow, wider than the arm; a side view's on the body's middle | ARMORY-MIRROR 3 |
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

FIXED TOO. `armletSide` answers none there (`ARM_HIDDEN_SIN`, the eighth's edge off straight behind), and nothing is
drawn. A side view with the right side to the eye draws none either: the far arm's glow showed past the body's back.

## 3. The patch on the painted arm (ARMORY-MIRROR 3)

FOUND. The arm reader stands an arm's points half an arm (`ARM_PX.half`, 3.5 px) in from its outer edge, and the patch
stood a third of the way down. A painted upper arm is 3 to 7 px, and at that row it is often behind a strap or in the
shoulder's shadow, joined to the body's silhouette. So the patch stood on the strap and the armpit, wider than the arm.
A side view has no arms read, so its patch stood on the body's middle; its near arm is painted at the body's back edge.

FIXED. The reader also finds the arm's band (`ARM_BAND`): from a third of the way down, the first row where the arm's
own run stands clear of the body, its middle and its width. The patch stands there, its band and crest that wide. A side
view's patch stands half an arm in from the body's back edge, brought toward the eye along its line of sight, so it
stays on the painted arm from any distance. The arm reader's own points are unchanged.

## 4. Both arms' pieces (ARMORY-MIRROR 4)

FOUND. Drawn on Layered Gearing from all eight views, the crown, the halo, the heart, the sigil and both legs' pieces
stood on their parts. The Ashbound Bracers and the Eternal Armlets drew on both arms from every view. From three-quarters
behind, the far arm is hidden in the picture, so its piece stood on the back. A side view's near arm piece stood on the
body's middle, and both drew on the reader's guessed line.

FIXED. `armSide` answers each arm as `armletSide` answers the left: the picture's side, or none where the picture hides
it. Each arm's piece stands on its band where the arm stands clear, as wide, its line moved across to pass through it; a
side view's on the arm at the body's back edge, along the eye's line.

FOUND TOO, close up. From three-quarters behind, the near arm is painted against the back and never stands clear, so
the guess half an arm in stood its chain a picture's pixel or two outward: that arm is 9 px. FIXED: where no row stands
clear, the arm ends where its colour steps (`ARM_BAND.step`), when most rows agree on a steady width; else the guess.

## 5. How it is checked

`tools/armorySpriteProbe.mjs` draws Layered Gearing as the world composes it (`eotbSprite.js` spriteFor, decodeSprite,
flipRows), through the renderer's own billboard under the game's lens, from all eight views: male and female, leather,
chain and plate chests, and a cloak. It measures each piece against the picture's marks: the crown and the halo over
the head, the armlet on the left upper arm and no wider than it (hidden where the body covers that arm), the Ember Heart
on the chest seen square on, and the Eternal Greaves between the knees and feet. `CLOSE=1` draws it at 1.2 m. `SETS=1`
draws every body piece of both lines alone and each line whole, full length: no arm piece over an arm the picture hides,
and each arm's band no wider than the painted arm.

Three measures allow for the pieces' own design, in the picture's pixels. The halo is read by its ring's ends, since its
comet and its spark run round the ring. The heart is read square on only: its point stands 0.1 m forward of the body's
axis. A side view's greaves are held to 3 px, as its knees and feet stand 2 cm either side of the card.
