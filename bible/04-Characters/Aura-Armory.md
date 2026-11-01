# Aura Armory

Cosmetic effects worn on parts of the body: a crown of flame over the brow, a coal burning in the chest, bands of light
round the arms, a glow on the weapon. A piece is drawn over whatever body shows (the Eye of the Beholder sprite, the
Morrowind body, a peer's body) and changes none of it. The player buys pieces from the Sigil Broker and the shop,
wears them from the account card and the profile's character slots, and sees them on themselves and other players.

## How it works

- **The law** (`src/net/armoryLaw.js`, pure, importing nothing). Five slots (`ARMORY_SLOTS`): head, torso, arms, legs,
  weapon. Lines (`ARMORY_LINES`): Dagonfire (Crown of the Burning Door, Ember Heart, Ashbound Bracers, Cinderstride,
  Brand of the Breach), Eternal (Eternal Halo, Sigil, Armlets, Greaves, Edge), the guild's Insignia Armlet and the
  gifted Crystal Spurs (both arms pieces). A kit is five characters, one a slot: the piece's code or `0`
  (`ARMORY_EMPTY`).
- **Had.** A piece is the account's: every character may wear it. The Sigil Broker sells the Dagonfire pieces as
  insignia at 75 Deadlands Embers each (`ARMORY_BROKER_PRICE`, `src/net/insignia.js`). The shop sells the Eternal
  pieces at 600 Aurum each, or the set at 2,000 (`src/net/shopLaw.js`). The Insignia Armlet is bought in the guild
  window's shop; the Crystal Spurs were a gift to every account (`src/net/giftLaw.js`). A ware already held is not
  sold again.
- **Worn.** `POST /v1/account/armory` takes a slot and piece, `null` to bare it, or a whole kit. The service refuses a
  piece not held or not of its slot, and a kit with one such piece whole. The kit worn is checked against what is
  held at every ask, so a refunded piece is not signed.
- **Online.** The service signs the kit as the token claim `ak` (omitted when none is worn); `src/net/identityToken.js`
  refuses unknown pieces; the relay badges it on the peer row. A change says hello again on a fresh token, so the room
  sees it at once.
- **Drawn** by `src/render/armoryPass.js` after each mode's opaque world, beside the auras, wired by
  `src/scenes/auraHost.js`. `src/render/armoryPose.js` turns the drawn body into seventeen points: a rig's bone origins,
  or on a sprite rows of the frame moved by the picture's own marks (head, chest, pelvis, arm edges, legs) read once at
  upload. Pieces add light, test depth without writing it, and take fog. Their light is cut to the auras' levels
  through the ordered dither (`src/render/auraPixel.js`), never snapped to texels: a piece is a hand's breadth of fine
  work, and blocked it was noise.
- **The card law.** On a sprite every point is lifted toward the eye, so pieces lie on the card's near side. A sprite's
  forearm and an arm hidden behind the body draw nothing. Seen from behind under a cloak, pieces draw before the
  cloth so it lies over them.
- **A sprite's arm** (`armClip`, `armWornSide`). The card hides nothing of a piece, so each arm piece is cut at its
  arm's inner edge as the eye sees it: the line half the arm's width in from shoulder to elbow, toward the chest on the
  card. Nothing of it, embers included, lands on the body. A far arm the picture never shows clear of the body (no band
  read) wears nothing: it is behind the torso, and its trace runs on the torso's edge.
- **A sprite's chest.** The Ember Heart and the Eternal Sigil lay their depth along the eye's line through the painted
  chest, so they stay on it from every side, before the card from the front and behind it from the back. Seen edge on,
  a card's chest piece is gone. From behind and to a side, the Sigil's back stands between the back's far edge and the
  near arm's inner edge, because the chest's run there takes in that arm.
- **The body's states.** Beast form hides every piece; a rider keeps head, torso and arms; sunk to the neck only the
  head draws; the player's own first person draws no body piece.
- **The weapon slot** is drawn by the weapon glow, not the pass (`Weapon-Glow.md`): every weapon in the player's hand
  wears it, and peers see it. A Gilded weapon's crimson shows first, then an element, then the armory piece, then the
  arcane look.
- **The profile's character slots** (`src/ui/characterSlots.js`): the character on a stage
  (`src/render/characterStage.js`) between eight slots (Head, Torso, Arms, Legs, Over the head, Weapon, Portrait,
  Aura). A choice is tried on the stage and worn through the account flow. The stage draws the body as the world does,
  by the world's own aura and armory passes.

## Rules

- Free mix: any piece fits beside any other, and there is no set bonus (the owner).
- Earned and bought: the Dagonfire set is the Sigil Broker's alone and very expensive; the Eternal set is the shop's,
  priced as the owner's $20 for the set (the owner).
- Cosmetic always: a piece moves no number. The Wardrobe changes what gear is drawn as; the armory draws on top, and the
  two never read each other.
- A piece code is never reused and a stored bit never renumbered.
- At most `ARMORY_DRAW_MAX` (24) wearers draw, nearest first, within `ARMORY_RANGE_M` (60 m); past `ARMORY_DETAIL_M`
  (25 m) embers and motes stop. Others' Aura Armory (`armoryOthers`: All, Near within `ARMORY_NEAR_M` 20 m, None)
  limits peers; the player's own kit always draws.

## Daggerfall Unity

DFU has no accounts and no cosmetic effects. The Broker's sale extends the port's Sigil Broker.

## Code and tests

- `src/net/armoryLaw.js` - slots, pieces, kits
- `src/net/insignia.js`, `src/net/shopLaw.js` - the Broker's and the shop's offers
- `src/render/armoryPass.js`, `src/render/armoryPose.js` - drawing and the body's points
- `src/scenes/auraHost.js` - wearers each frame, auras and armory
- `src/ui/characterSlots.js`, `src/render/characterStage.js` - the profile's slots and stage
- `src/render/weaponPiecePreview.js` - a weapon piece's shop stage
- `test/render/armory.test.js`, `test/render/armorymirror.test.js` - drawing, sprite points, the card's right
- `test/render/armbehind.test.js`, `test/render/auditaurapixel.test.js` - the arm's cut, the chest from every side
- `tools/armoryProbe.mjs`, `tools/armorySpriteProbe.mjs` - the pieces on a real GPU; the second on Layered Gearing in
  all eight views (`SETS=1`, `ANIM=Move:2` for a walk's frame), the arms and the chest read against the picture
- `test/server/armory_service.test.js`, `test/net/armorylive.test.js` - the service and the live room
- `test/ui/profileslots.test.js` - the character slots
