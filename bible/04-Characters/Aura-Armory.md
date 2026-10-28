# Aura Armory - effects worn on the body's parts (ARMORY, 2026-10-28)

> Design page, written before any code. Not a DFU member: Daggerfall Unity has no accounts and no cosmetic effects
> (Port-Ledger section A takes an ARMORY row with the first slice that ships). Where this page and the code disagree once
> code exists, the code's headers and its pins are what runs.

## 1. What was asked

The owner (2026-10-28), after the shop's first sales: *"I want to talk about developing a new cosmetic system. Aura
armory. This would be a unique new detailed system that would allow you to customize your character without changing
your overall sprite."* Five slots - head piece, torso, arms, legs, weapon and dual wield - *"topped off by our already
developing general aura cosmetic slot."*

The owner's answers to the four questions put to them:

| Question | Answer |
| --- | --- |
| Matching sets, or free mix? | Free mix |
| Earned, bought, or both? | Both: Dagon's Breach and the shop first |
| When does the weapon slot ship? | Last |
| The name "Aura Armory" | Approved |

## 2. What a piece is

An armory piece is an effect drawn ON one part of the body: a crown of flame over the brow, a coal burning in the chest,
bands of light round the forearms. It is drawn over whatever body is shown - the Eye of the Beholder sprite, the
Morrowind rig, Layered Gearing - and changes none of it. The sprite stays the sprite.

| Slot | Where it is drawn | Anchors |
| --- | --- | --- |
| Head | over and around the head | head, neck |
| Torso | the chest and the back | spine, both shoulders |
| Arms | the upper arms to the hands | shoulders, elbows, hands |
| Legs | the hips to the feet | hips, knees, feet |
| Weapon | along every weapon in hand - both when dual wielding | the weapon's grip and tip |
| Aura | the general aura, as today (`au`) | unchanged |

**Free mix.** A piece fits one slot and any piece fits beside any other: a Dagonfire crown with Eternal arms is a kit.
There is no set bonus. Each piece draws in its own colours.

**Cosmetic, always.** A piece moves no number, so THE CEILING HOLDS (`Home.md`) is untouched. The Wardrobe
(`04-Characters/Wardrobe.md`) changes what a piece of gear is drawn as; the armory draws on top of whatever the
Wardrobe drew. The two never read each other.

## 3. How a piece is had

A piece is the ACCOUNT's, as an aura is: every character on the account may wear it. What is held is read off the
account's row at every ask, as `server-account/src/titles.js` aurasHeld reads auras today. A guest holds none.

**The shop.** An armory piece is a ware of a new kind, `armory`, in `src/net/shopLaw.js`: a section of its own in the
window, a bit of its own on `players.shop_wares`, bought once. The window's stage (`src/render/auraPreview.js`) shows the
piece on a body before it is bought. The first shop pieces are the Eternal line (section 8).

**Dagon's Breach.** A recorded Breach kill (`/v1/gate/claim`, `server-account/src/accounts.js` claimGate) already rolls
the Weir Key with the service's own die. The armory rolls beside it, with its own die and its own pity count. The roll
draws only among the Breach pieces the account does not hold, so it never gives a duplicate, and when all are held it
does not roll. A registered account's alone, as the Spire's auras are.

**Proposed odds** (the owner's to sign off): one in twelve a recorded kill, one in eight for a fighter who broke the
rite or on a portent night (the key's pattern), and a certain piece after ten recorded kills in a row with none.

## 4. Wearing it

What is worn is the account's too: one piece or none in each of the five slots, beside the aura worn. The service
refuses a piece not held or not of its slot, as `auraRefusal` refuses an aura.

The **Aura Armory** panel stands on the account card beside the aura's choice, on Enhanced Plus and on the classic skin:
six slots, each with its piece or None, and the held pieces of a slot when one is picked. The preview stage shows the
whole kit on the character. A change reaches the room at once, as an aura does (`net/online.js` rehello).

## 5. How it is drawn

A pass of its own, a new file armoryPass.js in src/render, drawn with the aura pass after each mode's opaque world - the street, the
dungeon's late draw and the building - and never under the travel view. It reuses `auraRing.js`'s seams rather than
growing that file: the posed bones, the sprite's figure, the facing as the picture shows it (`auraSpritePosed`), the
kindle, the beast form and the rider. The world host wires it in one line through a module of its own
(a new armoryHost.js in src/scenes, HOST-SPLIT).

**On a rig** (the Morrowind body, Layered Gearing, a peer's body) every anchor is a bone the rig already poses: head,
neck, spine, upper arms, forearms, hands, thighs, calves and feet.

**On a sprite** a picture is a flat card. `auraSpriteBones` reads the head, neck, spine and shoulders off the figure
today; it has no elbows, hands, knees or feet (its calves are `null`). Head and torso pieces need nothing more. Arms and
legs need a table of points for each of the eight views and each walk and attack frame, measured off the art by a tool
and pinned (section 9, ARMORY-3).

## 6. The card law

THE CARD LAW: on a sprite, a piece is drawn on the eye's side of the card, placed by the view the picture shows. A chest
piece shows from the front and the three-quarters, narrows at the sides and is not drawn from the back; a back piece
does the opposite. A limb's piece shows while that limb is on the eye's side of the body, and is not drawn while the
body hides it. This is WINGS-FIT's and ETERNAL-FIT's lesson made a rule before a piece breaks it.

Pieces that hug the body are cut to the figure's outline: the pass reads the frame's own alpha, so a glow on the chest
never spills past the sprite's edge. Flares, sparks and embers fly free. The cost of that one texture a wearer is
measured in ARMORY-2 before it is kept.

**Beast form** burns every piece away, as the Eternal cape burns. **A rider** keeps head, torso and arms; legs fold away
with the saddle. **Sunk to the neck**, only the head piece draws. **Own first person** draws no head or torso piece
(the radiance's law); arms and weapon pieces in first person come with ARMORY-4 (`combat/fpArm.js`).

## 7. Online, the service and the budget

**The token.** A new signed claim, `ak`: the five slots' keys in order, an empty string for an empty slot, OMITTED
when none is worn, so a token without armory keeps its bytes. `src/net/identityToken.js` refuses a key that is no piece
of its slot, as it refuses an unknown `au`. The relay reads the claim it already verifies; RELAY_VERSION moves.

**The service.** A table `armory_held` (account, piece, how it was had, when) holds the Breach's pieces; the shop's are
its bits. A column `players.armory` holds what is worn. One migration, numbered at the merge. ACCOUNT_VERSION moves,
and the account service deploys first, since an older one would refuse the new claim.

**The budget.** Armory wearers share the aura pass's limits (AURA_DRAW_MAX, AURA_RANGE_M). Past a nearer range, to be
measured, a wearer's pieces draw as their glow alone. A setting, **Others' armory** (All, Nearby, None), lets a player
on a weak machine turn them down. One's own kit always draws.

## 8. The first pieces

| Line | Slot | Piece | What it looks like |
| --- | --- | --- | --- |
| Dagonfire (Breach) | Head | Crown of the Burning Door | horns of flame rising from a ring over the brow |
| Dagonfire (Breach) | Torso | Ember Heart | a coal in the chest, veins of fire across the ribs |
| Dagonfire (Breach) | Arms | Ashbound Bracers | chains of ember wound round the forearms |
| Dagonfire (Breach) | Legs | Cinderstride | flame licking the shins, an ember left in each step |
| Dagonfire (Breach) | Weapon | Brand of the Breach | fire running the edge, dripping from the tip |
| Eternal (shop) | Head | Eternal Halo | a thin ring of blue-violet fire, the Origin's spark at its front |
| Eternal (shop) | Torso | Eternal Sigil | the Origin's ring burning on the chest and back |

Dagonfire matches Dagon's Fire, the Breach's own aura. Eternal matches the shop's Eternal cape. The Eternal arms, legs
and weapon follow with their slices.

## 9. The slices

| Slice | What ships |
| --- | --- |
| ARMORY-1 | The law (a new armoryLaw.js in src/net: slots, pieces, the card law's rules, pure), the token's `ak`, the service's table, wear and refusal, the Breach roll, the shop's ware kind. No drawing yet. |
| ARMORY-2 | Head and torso on every body; the panel; the preview; the first four pieces (Crown, Ember Heart, Halo, Sigil); the budget measured. |
| ARMORY-3 | The sprite's limb table measured off the art; arms and legs; the Bracers and Cinderstride. |
| ARMORY-4 | The weapon slot and dual wield, third person and first person; the Brand of the Breach. |
| ARMORY-5 | The Collections part: every piece by slot, held or not, and how it is had. |
| AUDIT ARMORY | Cold lanes on a frozen snapshot, as every arc closes. |

Every slice that reads the running game runs `sh tools/fetch-data.sh` first (ARENA2). Each piece is checked in
close-up crops against the body it sits on, from all eight views.

## 10. The owner's to decide

- The shop price of each piece.
- The Breach odds and pity in section 3.
- Whether a kit should be worn per character instead of per account. This page follows the aura: per account.
