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

| Slot | Dagonfire (Dagon's Breach) | Eternal (the shop, $6) |
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

A piece is the ACCOUNT's, as an aura is: every character on the account may wear it, and the kit worn follows the
account. What is held is read off the account's row at every ask (`server-account/src/titles.js` armoryHeld). A guest
holds none.

**Dagon's Breach.** A recorded Breach kill (`/v1/gate/claim`, `server-account/src/accounts.js` claimGate) rolls in the
claim's own batch beside the Weir Key, with the service's own die (`server-account/src/armory.js`). The roll draws
among the Dagonfire pieces the account does not hold, so it never gives a duplicate, and none is rolled once all are
held. The odds are one in twelve, one in eight for a fighter who broke the faithful's rite or on a portent night, and a
piece is certain after ten recorded kills in a row with none (`armory_miss`). A claim asked again rolls nothing. A find
is said in the chat.

**The shop.** The Eternal pieces are wares of the kind `armory`, a section of their own in the window
(`src/net/shopLaw.js`), each on sale while `SHOP_ON_SALE` names it.

**Wearing.** `POST /v1/account/armory` takes a slot and a piece, or `null` to bare the slot. The service refuses a piece
not held (`armory-not-held`, 403) or not of the slot (`no-piece`, 400). The account card's **Aura Armory** row lists
each slot with the pieces held for it, where the aura's choice is. The Collections page lists every piece by slot,
held or not, and how it is had.

## 5. Online

**The token.** The service signs the kit worn as the claim `ak`, OMITTED when none is worn, so a token without one
keeps its bytes. `src/net/identityToken.js` refuses a kit of unknown pieces. The relay badges it on a peer's row beside
the aura (`src/net/wire.js` badged, readArmory), and the session keeps it with the id, so a peer re-stood after a blip
is dressed at once.

**A change reaches the room at once.** The world host compares the kit the last token said with the kit stored now,
and says hello again on a fresh token when they differ (`net/online.js` rehello, AURA-LIVE's way).

**The service's row.** Migration 0191: `players.armory_held` (a Breach piece's bit), `players.armory_miss` (the pity's
count) and `players.armory` (the kit worn, read against what is held at every ask, so a refunded piece is signed for no
more). A shop piece is its ware's bit on `shop_wares`.

## 6. How it is drawn

`src/render/armoryPass.js` draws it, after each mode's opaque world through the veiled bodies' hook, beside the auras
and never under the travel view. `src/scenes/auraHost.js` gathers the wearers each frame - mine and every drawn peer's -
and draws both passes: the aura code moved out of bootWorld with the armory beside it (HOST-SPLIT).

**The pose.** `src/render/armoryPose.js` turns the body as drawn into seventeen points (head, crown, neck, chest,
pelvis, shoulders, elbows, wrists, hips, knees, feet). On a rig they are its bones' origins - a bone's origin is its
joint. On a sprite they are rows of the sets' frames, and the picture's own marks move them across: where the head,
chest and pelvis stand in that picture, read off its alpha once at upload (`spriteMarks`), since a painting with its
sword arm out is not centred on its feet. With no body to read, the rest pose, crouched or in the saddle.

**The pieces.** Tubes round a limb or the brow, a decal on the chest, cards for embers and motes. Light is added, the
depth tested and never written, and the fog applied. One program a piece (the auras' AURA-SPLIT law), each started at
the boot's idle (`src/render/playPrograms.js`). Every rate is whole over the auras' clock, so nothing jumps at its wrap.

## 7. The card law and the body's states

THE CARD LAW: on a sprite every point is lifted toward the eye (`ARMORY_LIFT_M`), so a piece lies on the card's near
side and what stands behind the body is hidden by the card's own depth. A chest piece weighs how squarely it faces the
eye; the Eternal Sigil also burns on the back.

**A sprite's forearm is not drawn.** A painting has no elbow or wrist to measure past the shoulder, so on a sprite an
arm piece is drawn on the upper arm alone; the forearm draws on a rig. The legs draw from the knee down on both.

**Beast form** hides every piece, as it tears the cape. **A rider** keeps head, torso and arms; the legs are the
horse's. **Sunk to the neck**, only the head piece draws. **My own first person** draws no body piece over the view.

## 8. The weapon slot - weapon glow law 7

A weapon piece is not drawn by the pass. It is the weapon glow's (`bible/05-Combat/Weapon-Glow.md` law 7): every weapon
in my hand wears it - the classic hand's sheet as an outline, the Morrowind hands' blades, both hands when dual
wielding - and the word rides my look, so peers' Morrowind bodies show it too (`brand2`, `edge2`). The Brand of the
Breach is molten fire running down the blade; the Eternal Edge a blue-violet line with a light running along it.

**What wins.** An element shows first, because it is the blow's truth. The armory piece shows before the arcane look.
On the classic hand the piece's outline is drawn on the plain sheet, so an enchanted weapon's own sheet gives way to it
while the piece is worn. A sprite in third person shows no weapon piece: its weapon is painted into the picture, with
nothing to measure.

## 9. The budget and the setting

At most 24 wearers draw, nearest first, within 60 m. Past 25 m a wearer's embers and motes stop and the glows stay.
**Others' Aura Armory** (Features: All, Near, None) lets a player on a weak machine draw every peer's pieces, those
within 20 m, or none. My own kit always draws.

## 10. How it is checked

- `test/render/armory.test.js` - the kit's law, the wire, the words, the pose, the marks, each piece's draws, the pass
  against a logging GL, the world host's gather.
- `test/server/armory_service.test.js` - the held and worn law, the roll and its pity end to end, the wear door.
- `test/net/armorylive.test.js` - a kit through the session's memory and the real relay.
- `test/systems/weaponglow1.test.js` law 7 - the weapon piece's place among the looks.
- `tools/armoryProbe.mjs` - the pass on a real GPU (Chromium): placement, the card law, the clock's wrap.
- `tools/mutants/armory.json` - every law above, mutated.

## 11. Decided while building

The owner asked for the system built without further questions. These were chosen and are the owner's to change:

- The Eternal pieces' price, $6 each, and putting them on sale (`SHOP_ON_SALE`).
- The Breach odds and the pity (section 4).
- The kit per account, as the aura is.
- The sprite's forearm and third-person weapon left undrawn (sections 7 and 8), rather than drawn where the art has no
  measure for them.
