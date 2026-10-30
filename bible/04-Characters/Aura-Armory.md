# Aura Armory - effects worn on the body's parts (ARMORY, 2026-10-28)

> As built. Not a DFU member: Daggerfall Unity has no accounts and no cosmetic effects (Port-Ledger section A, ARMORY).
> Where this page and the code disagree, the code's headers and its pins are what runs.

## 1. What was asked

The owner (2026-10-28), after the shop's first sales: *"I want to talk about developing a new cosmetic system. Aura
armory. This would be a unique new detailed system that would allow you to customize your character without changing
your overall sprite."* Five slots - head piece, torso, arms, legs, weapon and dual wield - *"topped off by our already
developing general aura cosmetic slot."*

The owner's answers to the four questions put to them, then: *"Can you please leave me alone and build this."*

| Question | Answer |
| --- | --- |
| Matching sets, or free mix? | Free mix |
| Earned, bought, or both? | Both: Dagon's Breach and the shop first |
| When does the weapon slot ship? | Last |
| The name "Aura Armory" | Approved |

Then, of the built sets (2026-10-28): *"The dagon breach set should be very expensive from the dagon breach shop dealer"*
and *"The store set should be $20"*. Asked how, the owner chose the Sigil Broker alone, with no Breach drop, at 75
Deadlands Embers a piece; and the Eternal set whole at $20 beside each piece at $6.

## 2. What a piece is

An armory piece is an effect drawn ON one part of the body: a crown of flame over the brow, a coal burning in the chest,
bands of light round the arms. It is drawn over whatever body is shown - the Eye of the Beholder sprite, the Morrowind
rig, a peer's body - and changes none of it. The sprite stays the sprite.

**Free mix.** A piece fits one slot and any piece fits beside any other: a Dagonfire crown with Eternal arms is a kit.
There is no set bonus. Each piece draws in its line's colours: Dagonfire's ember orange, Eternal's blue-violet.

**Cosmetic, always.** A piece moves no number, so THE CEILING HOLDS (`Home.md`) is untouched. The Wardrobe
(`04-Characters/Wardrobe.md`) changes what a piece of gear is drawn as; the armory draws on top of whatever the
Wardrobe drew. The two never read each other.

## 3. The law

`src/net/armoryLaw.js` holds it, pure and importing nothing, so the relay's and the account worker's bundles stay flat.

| Slot | Dagonfire (the Sigil Broker, 75 embers) | Eternal (the shop, $6, or $20 the set) |
| --- | --- | --- |
| Head | Crown of the Burning Door | Eternal Halo |
| Torso | Ember Heart | Eternal Sigil |
| Arms | Ashbound Bracers | Eternal Armlets |
| Legs | Cinderstride | Eternal Greaves |
| Weapon | Brand of the Breach | Eternal Edge |

**The kit** is five characters, one a slot in the order above: `a` the Dagonfire piece, `b` the Eternal, `0` empty. A
kit is never all empty - no kit is no claim. A code is never reused and a stored bit never renumbered, since either is
something a player holds.

## 4. How a piece is had, and worn

> STOREFRONT (2026-10-29): in the shop's second law the Eternal set is a ware that gives its five pieces, as a bundle
> does - holding it holds them, and its price falls by the share of them already held (`06-Systems/Storefront.md` section 3).

A piece is the ACCOUNT's, as an aura is: every character on the account may wear it, and the kit worn follows the
account. What is held is read off the account's row at every ask (`server-account/src/titles.js` armoryHeld). A guest
holds none.

GUILD-SHOP (2026-10-30, `11-Multiplayer/Guild-Shop.md` section 3): the **Insignia Armlet** is the arms slot's guild
piece, bought for silver in the guild window's Shop - its bit on `players.guild_wares`, read by armoryHeld beside the
others. It draws the wearer's guild's crest on a gilt band round the left upper arm.

**The Sigil Broker.** The Dagonfire pieces are her insignia (`src/net/insignia.js` INSIGNIA, ids `armory:<piece>`),
sold beside the Gatebreaker title and Dagon's Fire aura through their one door (`/v1/account/insignia`,
`server-account/src/accounts.js` buyInsignia). Each is 75 Deadlands Embers, half again her aura's 50, so the five are
375: some 375 Breaches closed, fewer for the rite broken, a serpent slain or a Redoubt taken (EMBERS_EARNED_SQL). Her
window draws each piece on its own stage, as the shop does (`src/ui/brokerWindow.js`, `src/scenes/brokerInsignia.js`).
Daggerfall Unity has no such sale; this is the WB9g Broker's law, extended.

**The shop.** The Eternal pieces are wares of the kind `armory`, a section of their own in the window
(`src/net/shopLaw.js`): **The Eternal Set** at $20 (`armory:eternalset`, bit 256; AURUM-ONLY, 2,000 Aurum) gives all five, and each piece is $6 (600 Aurum)
alone. A ware already had is not sold again (`shopOwns`): a piece the set gave, or the set once the five singles are held.
Each is on sale while `SHOP_ON_SALE` names it.

**Wearing.** `POST /v1/account/armory` takes a slot and a piece, or `null` to bare the slot - or a whole `kit`, as the
set's **Wear** sends it, or `null` to bare all five. The service refuses a piece not held (`armory-not-held`, 403) or
not of its slot (`no-piece`, 400); a kit with one such piece is refused whole. The account card's **Aura Armory** row
lists each slot with the pieces held for it. The Collections page lists every piece by slot, held or not, and how it is
had.

**The Crystal Spurs** (THANKS-POST, 2026-10-30, the owner: "a free arm armoury aura. Small and varied crystallized arm
spikes that rotate color gradient but not overbearing"). An arms piece of its own line, `crystal`, code `d`, never sold:
the Storefront update's gift to every account standing then (`src/net/giftLaw.js`, `06-Systems/Aurum.md` section 3c). Five
spurs an arm, both arms (`src/render/armoryPass.js` ARMORY_SPURS): small six-sided cones of crystal, each its own size and
way round the arm, leaning toward the hand. A sprite shows the upper arm's three. Their colour turns slowly through
amethyst, aqua and rose (PRISM_RGB, a turn in 20 seconds), each spur its own phase, the tip brightest, a glint running
up the edges. Drawn at ARMORY_SPUR_GAIN, under the other pieces' full light. `test/server/thanks_post.test.js`.

## 5. Online

**The token.** The service signs the kit worn as the claim `ak`, OMITTED when none is worn, so a token without one
keeps its bytes. `src/net/identityToken.js` refuses a kit of unknown pieces. The relay badges it on a peer's row beside
the aura (`src/net/wire.js` badged, readArmory), and the session keeps it with the id, so a peer re-stood after a blip
is dressed at once.

**A change reaches the room at once.** The world host compares the kit the last token said with the kit stored now,
and says hello again on a fresh token when they differ (`net/online.js` rehello, AURA-LIVE's way). The stored session
keeps the kit, and the minter hands on the kit each token says (ARMORY-SEEN: both had dropped it, so no player saw
their own pieces in the world).

**The service's row.** Migration 0191: `players.armory`, the kit worn, read against what is held at every ask, so a
refunded piece is signed for no more. What is held has no column of its own: a Broker piece is its id on `insignia`, a
shop piece or the set its ware's bit on `shop_wares`.

## 6. How it is drawn

`src/render/armoryPass.js` draws it, after each mode's opaque world through the veiled bodies' hook, beside the auras
and never under the travel view. `src/scenes/auraHost.js` gathers the wearers each frame - mine and every drawn peer's -
and draws both passes: the aura code moved out of bootWorld with the armory beside it (HOST-SPLIT).

**The pose.** `src/render/armoryPose.js` turns the body as drawn into seventeen points (head, crown, neck, chest,
pelvis, shoulders, elbows, wrists, hips, knees, feet). On a rig they are its bones' origins - a bone's origin is its
joint. On a sprite they are rows of the sets' frames, and the picture's own marks move them across: where the head,
chest and pelvis stand in that picture, read off its alpha once at upload (`spriteMarks`), since a painting with its
sword arm out is not centred on its feet. A peer's Morrowind body stands the wearer at its own drawn feet and facing
(`peerBodies.bonesOf`), as the cape does. With no body to read, the rest pose, crouched or in the saddle.

**A sprite's arms, legs and head are read from its picture** (section 10's audit). The body is found from its legs, so
a sword held far out never takes it off the picture's middle. Each arm's outer edge is followed down from the shoulder
row; where something held reaches past it - a shield, a sack, a blade's guard - the arm goes on under it as it went. The
shoulder, elbow and wrist stand half an arm in from that edge, across the card, as the picture is seen. The knees and
feet are the two leg runs nearest the body, a robe split at its quarters, a staff's shaft never one. The head's top is
traced up from the neck. On a side view the near arm lies over the body with no edge to read, so its arm pieces keep
the sets' rows, turned with the body.

**The pieces.** Tubes round a limb or the brow, a decal on the chest, cards for embers and motes. Light is added, the
depth tested and never written, and the fog applied. One program a piece (the auras' AURA-SPLIT law), each started at
the boot's idle (`src/render/playPrograms.js`). Every rate is whole over the auras' clock, so nothing jumps at its wrap.

**The detail** (the owner, 2026-10-28: *"We need to push the detail of these further"*). The Dagonfire line: the Crown is
a circlet of molten iron with two rims and rivets, tall and short horns of flame by turns, and the Door at the brow - a
pointed arch of white fire with the Deadlands swirling in it. The Ember Heart's coal is crusted in plates, molten in their
cracks; its veins carry a pulse each beat, with fine capillaries and the ribs lit as it passes. The Ashbound Bracers are
a real chain, its links by turns flat and edge-on, a few gone to dull coal. Cinderstride has a ring of cracked coal at
each ankle under two sheets of flame.

The Eternal line: the Halo is a band between two rims with the Origin's runes round it and a comet of light. The Sigil
is the Origin's ouroboros - a dragon of light in scales biting its tail, its eye bright - with runes inside and slow rays
off the spark. The Armlets are engraved bands, flames licking off their rims. The Greaves carry a lattice of light and a
band at the knee with the Origin's spark.

## 7. The card law and the body's states

THE CARD LAW: on a sprite every point is lifted toward the eye (`ARMORY_LIFT_M`), so a piece lies on the card's near
side and what stands behind the body is hidden by the card's own depth. A chest piece weighs how squarely it faces the
eye; the Eternal Sigil also burns on the back, clear of a rig's torso.

**A sprite's forearm is not drawn.** A painting has no elbow or wrist to measure past the shoulder, so on a sprite an
arm piece is drawn on the upper arm alone; the forearm draws on a rig. The legs draw from the knee down on both.

**Under a cloth** (ARMORY-SEEN, `01-Overview/bugs/Field-Bugs-2026-10-29.md`). A cloak or a cape covers what is drawn
before it, and the pieces write no depth. Where the eye sees the back of a body whose aura hangs cloth there, its pieces
are drawn before the auras, so the cloth lies over them (`render/auraRing.js` auraClothOver, `scenes/auraHost.js`
armoryLayers). From the front and the side they are drawn after.

**Beast form** hides every piece, as it tears the cape. **A rider** keeps head, torso and arms; the legs are the
horse's. **Sunk to the neck**, only the head piece draws. **My own first person** draws no body piece over the view.

## 8. The weapon slot - weapon glow law 7

A weapon piece is not drawn by the pass. It is the weapon glow's (`bible/05-Combat/Weapon-Glow.md` law 7): every weapon
in my hand wears it - the classic hand's sheet as an outline, the Morrowind hands' blades, both hands when dual
wielding - and the word rides my look, so peers' Morrowind bodies show it too (`brand2`, `edge2`). The Brand of the
Breach is molten fire running down the blade, a gout of it falling down each column in turn and sparks caught in it;
the Eternal Edge a blue-violet line with a light running along it, a fainter one running back, and glints.

**What wins.** A Gilded weapon's crimson shows first, as its rung's own look (`05-Combat/Weapon-Glow.md` law 8,
GILDED-GLOW; AUDIT FB1029f D3: the owner may turn this round). An element shows next, because it is the blow's truth.
The armory piece shows before the arcane look.
On the classic hand the piece's outline is drawn on the plain sheet, so an enchanted weapon's own sheet gives way to it
while the piece is worn. A sprite in third person wears it as an outline round the whole sprite while its weapon is
drawn, and on the weapon on its back while sheathed (BACK-HOLSTER GLOW, `05-Combat/Weapon-Glow.md` "On a sprite"): its
weapon is painted into the picture, with nothing to tell it from the hand.

**In the shop** a weapon piece stands on a stage of its own (`src/render/weaponPiecePreview.js`): a longsword of
Daggerfall's pixels, outlined by the classic hand's own shaders - the field baked once, the band drawn each frame.

## 9. The budget and the setting

At most 24 wearers draw, nearest first, within 60 m. Past 25 m a wearer's embers and motes stop and the glows stay.
**Others' Aura Armory** (Features: All, Near, None) lets a player on a weak machine draw every peer's pieces, those
within 20 m, or none. My own kit always draws.

## 10. The profile's character slots (PROFILE-SLOTS)

The owner (2026-10-28), before this push: *"Overhaul the profile page and selection options to have a detailed
character slot section. Slots for each of the aura armor, the aura cosmetic, the title and glyph above the head and an
actual preview of either your morrowind/sprite for the selected character"* and *"Audit placement and ensure
perfection"*. Then, of the first pictures: *"The arm effects on the sprite aren't positioned correctly."*

**The section** (`src/ui/characterSlots.js`): the character on its stage between eight slots - Head, Torso, Arms and
Legs down the left; Over the head, Weapon, Portrait and Aura down the right. A slot pressed opens its picker under the
stage. A choice pointed at or focused is tried on the stage; pressed, it is worn through the account flow's own doors,
so the presses and the paint are the old Wardrobe's. A piece not held is tried on and says how it is had. A line held
whole has a button for the whole set. On a narrow window the stage stands over the slots, two to a row.

**The stage** (`src/render/characterStage.js`) draws the body as the world does, by the world's own aura and armory
passes. Paused in a game with a Morrowind body, that body: `fpArm.stage()` draws its portrait, and prisms on its bones
write the depth the pieces pass behind. Otherwise the sprite the world draws on foot: the chosen skin, or Layered
Gearing in the save's own armour (`src/ui/profileBody.js`). With no body, the shop's stand-in. A switch offers both
bodies where both stand.

**The frame and the plate.** One camera for every body (`STAGE_FRAME`): orthographic, a little above level, the highest
the plate can stand 21% down the picture and the widest aura ring's near edge 95% down. The plate is the world's own
label (`src/ui/namePlate.js`, the name layer's sheet), where the world stands it: a Morrowind body's head height
(`peerBodies.heightOf`), a sprite's card top (`peerRiders.heightOf`), 5 px over it. Over a head piece worn or tried on,
it rises to the piece's tip (`armoryHeadTip`). The frame keeps room for the tallest head piece, so a try-on moves the
plate and never the camera.

**The world's names** rise the same way: a peer's name stands over the crown's flames or the halo it wears
(`scenes/auraHost.js` nameTopOf into `remotePlayers.nameFrame`), where it covered them before. It is one wiring entry in
bootWorld, and its ceiling went up by one with that reason.

**The audit** drew every on-foot sprite - the sixteen sets, the twenty class skins, Layered Gearing in both bodies -
from the front, the three-quarter and the side, with its pose over it (`tools/spriteArmsSheet.mjs`). The arms and legs
were one symmetric table, so on most pictures an arm piece ran inside the torso, a bent, staff or shield arm was
missed, and a side view's stride had one greave between its legs; they are read from the picture now (section 6).
Three staff sets read the head's top off the staff's orb, so a crown floated over the hood. A side view with a sword
or a mace held out lost its body, its head points in the air beside it. The phone's account window filled the screen
only because the skin card's row happened to; its grid track is the screen's now.

**The second audit** made the sheet judge its bodies (every view's marks read, every pose point on its picture). It
found one record drawn at another scale: the female Acrobat seen three-quarter on is 81 px tall where the sets draw 110
(ACRO-SHORT's record scale). Read at the sets' rows its shoulders were its neck, and a head piece or a cape stood
0.4 m over its head. A picture's marks are read at the sets' rows and widths scaled by its record's scale
(`eotbSprite.js` spriteArtScale, spriteMarks' `art`), and its pose and its cape stand at the body's own heights. A
peer's name lifts only over a head piece drawn in that frame, and a sprite's Cinderstride embers fall at each foot.

## 11. How it is checked

- `test/render/armory.test.js` - the kit's law, the wire, the words, the pose, the marks, each piece's draws, the pass
  against a logging GL, the world host's gather.
- `test/server/armory_service.test.js` - the held and worn law, the Broker's sale and the shop's set, the wear door.
- `test/net/armorylive.test.js` - a kit through the session's memory and the real relay.
- `test/systems/weaponglow1.test.js` law 7 - the weapon piece's place among the looks.
- `tools/armoryProbe.mjs` - the pass on a real GPU (Chromium): on the stand-in, the sprite and retail's Morrowind
  skeleton; placement, the card law, the clock's wrap, and the weapon pieces' stages.
- `01-Overview/audits/Audit-Armory.md` - the audit and what it fixed.
- `tools/mutants/armory.json` - every law above, mutated.
- `test/ui/profileslots.test.js` - the slots, the presses, the stage's frame, the head pieces' tips, the bodies, and the
  world's names over a head piece; `tools/mutants/profileslots.json` mutates them.
- `tools/profileSlotsProbe.mjs` - the section on a real GPU, desktop and phone, round three bodies: the plate clear of
  the drawn head, a try-on and a press, and close-ups of each line's set. `tools/spriteArmsSheet.mjs` - every sprite's
  pose on its picture.

## 12. Decided while building

The owner asked for the system built without further questions. These were chosen and are the owner's to change:

- Putting the Eternal set and pieces on sale (`SHOP_ON_SALE`). The set is $20 whatever singles are held: no price for
  the rest of a set.
- The kit per account, as the aura is.
- The sprite's forearm and third-person weapon left undrawn (sections 7 and 8), rather than drawn where the art has no
  measure for them.
- The profile's plate stands where the world's does. On a Layered Gearing body it stands well over the head, as in the
  world: those pictures carry room over the head, and the world's law was kept rather than given a second one.
- The weapon slot's piece is not on the profile's stage: it is the weapon glow's (section 8), shown on the shop's stage.
- The Morrowind body shows on the profile only when paused in a game, where its rig is built; at the door, the save's
  sprite.
