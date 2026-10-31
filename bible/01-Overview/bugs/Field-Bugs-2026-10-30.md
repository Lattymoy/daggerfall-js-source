# FIELD BUGS 2026-10-30 - the Eternal cape on a peer's front, and its curved cut (CAPE-CARD, CAPE-FLAT)

The owner, with a screenshot of a player in the Eternal cape: "With the new cape why is it showing on the front of the
player? Did we learn nothing from the angel wings aura? And the cape sides and top shouldnt be curved". Read on main's
`cc2e350af` with the freeware's data. The pins are `test/render/capecard.test.js`, the mutants
`tools/mutants/capecard.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | The cape on the front of the player | A peer drawn as a paperdoll or a class sprite had no face and no figure, so the cape hung on the pose's yaw, on the body's axis | CAPE-CARD |
| 2 | "the cape sides and top shouldnt be curved" | The cape was a span of the turn round the body, 0.64 of it at the collar | CAPE-FLAT, reverted at the owner's word |

## 1. The cape on a peer's front (CAPE-CARD)

FOUND. The ring and spark in the shot are the cape's outside, between the shoulder blades. They face the eye, under a
picture that shows its face, so the cape hung on the far side from the way the picture faces. A peer stands in one of
four layers: a Morrowind body (bones), the Eye of the Beholder walkers and riders (a figure and a face, WINGS-FIT and
SPRITE-FACE), or `net/remotePlayers.js`'s paperdoll or class sprite. The aura host asked only the first three. On the
fourth the cape hung on the pose's yaw from the rest pose on the axis. A paperdoll always shows its front, so a peer
facing away wore the cape over the doll's chest. The figures in the shot stand as Daggerfall's paperdolls do.

A class sprite had the same gap. Its picture is chosen for my own place, not my camera, so its cape could hang up to a
view off the picture. From the side it lay over the card, as the wings did before WINGS-FIT.

FIXED. `RemotePlayers.faceOf(id, eye)` says how its picture faces as the eye sees it - a doll its front, a class sprite
its view (`mobilePortrayedYaw`, mobileOrientation run backwards) - with the pose's yaw as `turn`. A class sprite's face
says `card`, and `auraSpritePosed` hangs the wings and the Eternal cape from the rest pose WING_SPRITE_BACK behind it
(`CLOAK_CARD_POSE`). A doll's says it too: the cut's sides and collar reach the card's plane at the body. The aura
host reads every sprite layer as one list (`sprites`,
`spriteAnswer`), so the Aura Armory's pieces on a doll face as the doll does too. In `scenes/world.js` the list replaces
the two getters it held, so bootWorld does not grow.

WHY THE PINS PASSED. ETERNAL-FIT's pin hung the cape on an Eye of the Beholder sprite's pose. No pin drew a peer as a
doll or a class sprite under an aura. The new pins build both with `RemotePlayers`' own producers (`Home.md`, TEST THE
SHAPE THE PRODUCER MINTS), and one hangs the cape on the doll from the shot: all of it behind the card now, more than a
hundred points in front of it before.

SEEN. A scratch Chromium probe drew the real pass over an Eye of the Beholder front picture standing for a doll whose
peer faces away. Before, the cape covered the picture's front with its sigil out, as in the shot. After, it hangs
behind the picture and shows at its edge.

THE FOUR HOSTS: world.js WIRED (the list); worldModes.js and dungeonContext.js draw through world.js's aura host,
unchanged; exterior.js draws no aura, unchanged.

## 2. The cut (CAPE-FLAT), reverted

FOUND. Eternal's cloth was the Holo Shadow Cloak's shell cut to a span of the turn round the body: 0.47 of it at the
hem, 0.5 at the shoulders, 0.64 at the collar. Its top wrapped the neck, its sides bowed round the body, and its hem
rose at the sides.

MADE, THEN REVERTED. `eternalPoint` cut it straight, a top edge across the shoulders and straight sides to a level hem.
The owner then: "Revert what I said about making it flat". The cape is the shape above again, the base's own lines;
the cut's pins, mutants and its audit findings (`../audits/Audit-Cape-Card.md` B, C1, C3, D2, D3) went with it.

PINS MOVED. `test/net/shadowcloak.test.js`, `test/net/seraphwings.test.js`,
`test/player/eyeOfTheBeholder/spriteface.test.js` and `test/render/armory.test.js` (the host's lines, now one list);
and the five host fixtures that named the two getters, in `armorylive`, `armory` (two), `capetoggle` and
`profileslots`. Mutant records re-aimed by content: `armory.json`, `seraphwings.json`, `shadowcloak.json` and
`spriteface.json`.

## Not changed

From the side, the cape on a card stands WING_SPRITE_BACK behind the picture's back, ETERNAL-FIT's law. The audit
(`../audits/Audit-Cape-Card.md`) turned every peer's picture to the camera that draws it, laid the swing in the frame
the cloth is drawn in with a doll's kept behind it, and made a sprite rider a card; its last section says what it left
to the owner.
