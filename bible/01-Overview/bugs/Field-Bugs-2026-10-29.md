# FIELD BUGS 2026-10-29 - the Aura Armory unseen on its wearer, and the paid set through the cape (ARMORY-SEEN)

Two player reports of the Aura Armory (`04-Characters/Aura-Armory.md`), handed over by the owner: "players are reporting
not being able to see them on their character", and the paid look "clips through the front of the character". Read on
main's `3b56d5119` with the freeware's data. The pins are `test/net/armorylive.test.js` and `test/render/armory.test.js`
(ARMORY-SEEN), the mutants `tools/mutants/armoryseen.json` (9, all dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "not being able to see them on their character" | The device's stored session never kept the kit, so a player's own body drew no piece | ARMORY-SEEN 1 |
| 2 | The paid look "clips through the front" | Seen from behind, the Eternal set's pieces burned on top of the Eternal cape that hangs over them | ARMORY-SEEN 2 |

## 1. The pieces unseen on their own wearer

FOUND. My own body draws the kit the device's stored session holds (`systems/ownGlyphs.js` ownArmory), and so does my
weapon's piece (`systems/weaponGlow.js` armoryWeaponLook). `adoptIdentity` wrote the kit into the session, but
`keepSession`, which writes it, keeps a list of named fields, and the kit was not on it. Every write dropped it, so my
body wore nothing in the world. The profile's stage reads the wardrobe, so the pieces showed there and nowhere else. A
write that dropped the kit also differed from the last one, so the session was written again at every answer.

FOUND TOO. The mint's answer carries the kit (`armory`), but the minter builds its identity field by field
(`net/accountClient.js` mintFresh) and left it out. The world host never heard the kit the token signed, so a piece
worn since was never said again to the room (AURA-LIVE). Others saw it at the next room.

FIXED. `keepSession` keeps the kit, and the minter hands it on as it does the aura.

WHY THE PINS PASSED. The world host's test wrote a session with a kit by hand and told the host a kit no minter told it
(`Home.md`, TEST THE SHAPE THE PRODUCER MINTS). The new pins run the real minter and the real session writer, and one
reads every field `adoptIdentity` writes off its source and holds `keepSession` to each.

## 2. The paid pieces through the cape

FOUND. Eternal's cape is drawn premultiplied: its cloth covers what was drawn before it (`render/auraRing.js`). The
armory's pass drew after every aura and writes no depth. From behind and three-quarters behind, the Eternal Sigil's back
ring, the Armlets and the Greaves burned on top of the cape that hangs between them and the eye. With their own pieces
unseen (1), players saw it on each other. The Shadow Cloak's cloth covers the same way.

FIXED. A body's pieces are drawn before the auras when its own cloth covers them from the eye: an aura with a cloak or
a cape, not folded on a rider, and the eye on the side the back faces (`render/auraRing.js` auraClothOver,
`scenes/auraHost.js` armoryLayers). From the front and the side they draw after, as before. The profile's stage always
looks from the front, so its order is already the law's.

CHECKED, NOT THE CAUSE. The cape's cloth itself, on retail's Morrowind skeleton standing, walking forward and back,
running back and strafing: no point of it stands in front of the body. On a sprite it hangs WING_SPRITE_BACK behind the
card (ETERNAL-FIT), and from the front it shows only through the picture's own gaps, beside the arms and the legs.

## Not changed

A cape far behind another wearer can cover that wearer's pieces outside its picture, such as a halo over the head.
The passes order wearers among themselves, not against each other's pieces.
