# Townsfolk Outfits

The port's own clothes for townsfolk in Morrowind bodies, one outfit per Daggerfall walker sprite. A walker whose
picture has an outfit wears it in that picture's colours, so the body that replaces the picture at close range wears
what the picture wore. A picture with no outfit yet keeps the wardrobe (`Morrowind-NPCs.md`).

## How it works

- **The table.** `TOWNSFOLK_OUTFITS` (`src/characters/ownModels/ownClothingModels.js`) keys an outfit by the walker's
  sprite archive: Redguard 381-384, Breton 385-386, Nord 387-390, and the Redguard woman's hooded dress, 398. Each names
  its mesh (`townsfolk_<archive>.nif`), the skin it hides all round (`hides`) and the skin it dresses without hiding
  (`covers`). Nord 389 and 390 are recolours of 388 and 386.
- **The look.** `folkLookOf` (`src/characters/folkBodies.js`) gives a walker of the outfit's own sex (`spriteSex`) the
  outfit and no wardrobe garment. Khajiit and Argonians on an outfit's picture are dressed by the wardrobe. Every
  walker of one picture dresses alike, as the pictures do; faces differ, walked off each walker's seed. A resident is
  dressed the same way off their own id (`residentLook`, `src/characters/rosterBodies.js`).
- **The body.** `peerBuildOpts` (`src/net/peer/peerBodies.js`) hands the outfit to the build as a worn piece of its own
  kind; another outfit is another body key.
- **Composition** (`composeWornArmor`, `src/formats/morrowind/mwItemMap.js`). The outfit is one add, `outfit (<id>)`,
  claiming no slot, composed first as a robe is: armour over it takes its slots. The skin it hides is occupied with no
  mesh, in the third person only. A hood hides the hair, as a helm does.
- **Modesty** (`composeWornModest`). A chest an outfit covers takes no shirt (398's open bodice).
- **An outfit that binds nothing** hides and dresses nothing: the body is composed and built again without it, and the
  card says why. A hood that binds nothing gives the hair back.
- **Hosts.** The street's walkers and residents, road and room people (`src/world/travellerSprites.js`), the port's and
  the yards' people (`src/scenes/portHost.js`, `src/scenes/merchantYardsHost.js`) all mint their look through
  `folkLookOf`. No walker or resident stands in a dungeon.

## Rules

- Each sprite wears its own outfit; a sprite without one keeps the wardrobe (the owner).
- `hides` is measured: a part is hidden only if every ray out of its bone line meets the cloth, in the pose the outfit
  was made in (`test/tooling/mwfolk1.test.js`). A hem short of a part's span hides none of it.

## Daggerfall Unity

DFU draws townsfolk as billboards (`MobilePersonBillboard`, `PERSON_TEXTURES` in
`src/characters/mobile/mobilePerson.js`); these outfits exist only on the port's Morrowind bodies.

## Code and tests

- `src/characters/ownModels/ownClothingModels.js` - `TOWNSFOLK_OUTFITS`, `townsfolkOutfitOf`, `ownOutfitFor`
- `src/characters/folkBodies.js` `folkLookOf`, `src/characters/rosterBodies.js` `residentLook`
- `tools/bakeTownsfolk.mjs` - the bake
- `test/tooling/mwfolk1.test.js` - the bake, every outfit's hides and covers
- `test/characters/mwnpc7_folk.test.js`, `test/characters/mwnpc17_wardrobe.test.js` - walkers' looks

## Open

- Thirteen of twenty-four walker pictures (the Bretons' 391 and 394, every woman's but 398) keep the wardrobe until
  their outfits come.
- No cloth simulation: at a long stride some thighs and knees show through skirts and the dress.
- Read on the male retail skeleton only. 398 on a woman's skeleton, the hoods on Nord and Redguard heads and 398's
  bodice with Show Nudity off are to be seen in game.
- The two recolours (389, 390) were judged by eye; the owner's to confirm.
