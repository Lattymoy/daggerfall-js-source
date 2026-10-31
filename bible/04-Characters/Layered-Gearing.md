# Layered Gearing - the body in the armor it wears (LAYERED-GEAR, 2026-10-18; merged 2026-10-19)

**The owner's calls.** 2026-10-18, of the skin card's two panels: *"add a option between those two thats also called On
foot Layered Gearing Skin (WIP) Female and Male"*. 2026-10-19, merging it: *"These need a proper toggle in the account
profile for players to either equip skins or use this integration"*, and of its art: *"Approve as an exception"*,
credited to DFO. Then: *"Make sure this is on by default"* (LAYERED-GEAR-ON).

With Layered Gearing chosen, the player's body on foot is drawn in the armor it actually wears, in the body chosen
(Female or Male - a male character may choose the female body and the other way round). The art is
`vendor/layered-armor/` (its README; the doctrine's third exception, below); the law is
`src/player/eyeOfTheBeholder/layeredArmor.js`.

## Where the choice is: the Skin card's toggle

The profile window's Skin card (`src/ui/skinCard.js`) opens on a two-way toggle, **Look: Skins | Layered Gearing
(WIP)** - a player either equips skins or uses this. The choice is the one setting the body and the look already read,
`Graphics.LayeredGear` (`systems/modSettings.js`): 0 is Skins; 1 and 2 are Layered Gearing in the female or the male
body; 3 (`LAYERED_OWN`, layeredArmor.js) is Layered Gearing in the character's own body, and **the default**: every
player starts in it, each character in its own body, and the card says so ("Your character's own body, until you choose
one."). The body resolves it live (`eotbBody.js` lookNow, `playerEntity.gender`); the look sends the body it is (`lg` 1
or 2), never 3.

- **Skins**: the On foot and Mounted pickers, as DISC23-B2 and SKIN2 laid them out.
- **Layered Gearing**: the body choice, Female or Male, each pictured in plain leather (`layeredPreviewUrl`), and the
  Mounted picker - a rider has no layered art, so on a horse the player is drawn in the Mounted skin, and as a werewolf
  or a wereboar in the beast's own sprite. The On foot picker is put away: it is not what the player is drawn as on
  foot. It stays the fallback for a frame the layered art has none for.
- Turning Layered Gearing on again wears the body last chosen this session (`layeredBodyToWear`), else the character's
  own (3). A body pressed is that body from then on, whatever the character. The card marks the own body by
  `playerEntity.gender` (handed in by the profile window, `enhancedMenu.js` accountWindow; no character, male, as
  `playerEntity` starts). Turning it off writes 0; the On foot skin chosen before is still the one worn.

It is a skin, not a feature: it is not in Features -> Eye of the Beholder's dials (the old `Graphics.Worn Armour`
switch is gone).

## What it draws

| Equipped slot | Changes |
|---|---|
| Chest armor | the whole upper body: torso, shoulders, arms, hands |
| Leg armor | the whole legs, belt down to the feet |
| Helmet | the helmet or hood |

- Each slot wears its item's family: leather, chain or plate. Plate wears the item's own metal (iron, steel, mithril,
  adamantium, ebony, orcish or daedric), per slot. An empty slot is leather. Gloves, boots and pauldrons do not change
  the picture. Silver, Elven and Dwarven are drawn as steel: there is no art for them.
- Both bodies have all 27 helmet/top/legs outfits with 80 frames each: walk, attack, hurt (records 10-14), idle, and
  bow or cast (records 20-24).
- **The cloak.** A worn Casual or Formal Cloak (templates 154, 155, 191, 192, in Cloak1 or Cloak2) adds its hood and
  cape in its dye (Daggerfall's clothing dye on the cloth's ramp; undyed is Light Brown), over any outfit, in every
  record. The hood is painted over the body and the worn helmet stays under it, so pauldrons and a helmet's neck guard
  stay whole; what a helmet pushes into the air beside the hood (horns, wing tips) is trimmed. `applyCloak`,
  `dyeCloth`, `applyHoodFix`.

- **The weapon on the back** (BACK-HOLSTER, 2026-10-30): a sheathed long blade, axe, blunt weapon, staff or bow rides
  the back, on this look and on the skins (`06-Systems/Eye-Of-The-Beholder.md` BACK-HOLSTER). The art holds its mace in
  every frame, so a sheathed layered body shows both. A bow carries its quiver, sheathed or drawn (QUIVER).

## Online

The look carries the body as an optional field `lg` (1 female, 2 male - the own-body default sent as the character's;
left out when off, so a look without it keeps the bytes it always had) - `net/remotePlayers.js` composeLook and `ownLayeredGear`, kept by the relay's `validLook`
(`net/wire.js`). A peer whose look has `lg` walks in their armor, in the body they chose (`net/peer/peerRiders.js`).
**RELAY_VERSION world224** (world218 in the package, renumbered past main's world218-223 at the merge): deploy the relay
before the clients. The cloak needs nothing new on the wire: a peer's look already carries its items' `equipSlot` and
`dye`.

**The viewer decides** (LAYERED-PEERS, 2026-10-19, the owner: *"when layered skins are on you only see it on your char
and players who also choosen the option. Normaly once you picked it you should see all other players too in their
layered gear"*). While this player wears Layered Gearing (`viewerLayered`: Eye of the Beholder on and
`Graphics.LayeredGear` a body, the default included), every other player on foot is a walker in the armor their look's
items say they wear (`createPeerWalkers`, read each frame): in the body they chose (`lg`), else their character's own (the
look's `gender`), whatever they chose themselves. So an older relay that drops `lg` costs only a chosen body, not the
armor. A Skins viewer sees what they always saw: a chosen set as the set, a chosen `lg` in armor, and no walker for a look
with neither. Riders, beasts, the dying and a peer a Morrowind body stands are no walkers either way.
`test/net/layered_peers.test.js`, `tools/mutants/layered_peers.json`.

**PEER-ART** (FIELD BUGS 2026-10-22d, `01-Overview/bugs/Field-Bugs-2026-10-22d.md`; Foretold, "Memory Leak": "an instance
out of 7 that is leaking 5gb of ram"). A walker in armor is some 55 sprites of its own outfit, and the peers' one art store
(`net/peer/peerRiders.js` createEotbArt) kept every sprite's decoded pictures for the session and let a texture go only
for a rider's horse look (COATS1) - every outfit met online stood for good, ~4 MB of pixels and its textures each. An
outfit is a look now (`spriteLookOf`: `LA:<body>:<combo>:<pieces>`), let go with every texture of it as a horse's is
(RIDER_LOOKS_KEPT, undrawn RIDER_LOOK_IDLE_MS); the decoded pictures are the RIDER_PIXELS_KEPT (64) sprites most recently
asked. AUDIT FB1022d D1: the looks are let go once a frame, after every layer drew (`sweep`, from the riders' `settle`) -
never one drawn this frame or the last; inside the draw, a 2 s hitch let a crowd's outfits go on screen. D4: my own body
lets its last outfit go - textures and decoded strips - once the new one is up (`eotbBody.js` releaseOutfits; a cloaked
outfit keeps the plain frames it shares). The renderer's cache is one for that store and my own body's
(`player/eyeOfTheBeholder/eotbBody.js`), so each asks it whether its texture still stands before trusting it, and uploads
again what the other let go. `test/net/peer/fb1022d_peerart.test.js`.

## The weapon in the hands (LAYERED-WEAPONS, 2026-10-30)

The owner, 2026-10-30: *"Id like to implement proper weapon and animations depending on what youre using because
currently the sprite only uses a hammer"*, then *"Do everything"*. The strips draw a warhammer into every walk, attack,
hurt and idle frame of every outfit. The body now holds what the player holds: `player/eyeOfTheBeholder/layeredWeapon.js`.

| The hands | Tables | Drawn |
|---|---|---|
| Sheathed, a spell readied, bare hands | Idle, Move, Death, IdleSpell, MoveSpell, any melee table with nothing held | nothing: the hammer is taken out |
| A melee weapon | IdleMelee, MoveMelee, AttackMelee | the weapon, its shape and its metal |
| A bow | IdleRanged, MoveRanged | the bow, upright in the free hand; the weapon hand empty |
| The loose | AttackRanged | the strips' own bow (records 20-24), as before; with hands known to hold no bow, the ranged stance, empty |
| A cast | AttackSpell | the swing's wind-up and throw (records 5-9, frames 0-3), hands empty |
| A gun (thunderlock, pistolet) | AttackMelee | the swing's frame 3, held for the shot, from the hip |
| A walker's flinch | Death (the hurt frame) | what its hands held before it (`armedTable`) |

The cast used to play the bow's loose; a caster drew a bow. An iron warhammer is the art's own hammer, under the key it
always had; a warhammer of another metal is that hammer recoloured.

**The rig.** `tools/layered-armor/build_weapon_rig.py` writes `vendor/layered-armor/weapon/`: for each hammer frame and
chest family (a plate chest moves the hammer a pixel or two), the hammer's pixels, the grip, the head, the head's
radius, the depth along the shaft (where the body hid it) and the fill for the hole. The pixels are the ones the
family's nine outfits draw alike, on the line from the grip to the head; the 120 grips were read by eye and snapped to
where the shaft meets the fist. A rebuild of one frame: name it (`male:0-0`), the rest are kept. The rig is cut from the
strips' own hammer, so it ships in the third exception's folder; the weapons drawn in its place are the game's drawing.

**Set by hand.** The back views (walk records 3 and 4) draw a glove as dark as the hammer's iron, and the trace took the
fist with it. Their hammer is set by hand (`HAND`): the light pixels of the butt and the shaft, every pixel of the head,
round a grip and head read by eye. So is male 8-4, whose head passes before a dark hood, and each body's 9-4, whose grip
is at the shaft's foot. The boxes are read on the leather chest's picture; another family's move with its hammer (plate
draws 8-4 and 9-4 three pixels lower). A light pixel in a walk is the hammer's only where the leather chest draws it
too, so a chain or plate sleeve stays.

**The iron left** (2026-10-31, the owner: "Theres still this global of texture where the hammer was removed"). Light
pixels alone left the hammer's dark iron: male 4-0's butt over the hip, 4-2's head beside the fingers, the back-3/4
walk's haft off the fist, and the back idle's lit haft (19-0, both bodies) over the hip. `steady` boxes take every
pixel but skin each outfit draws alike there - the legs behind differ by outfit, the hammer does not - and `EXTRA`
segments the idle's haft. Where the haft crossed open air past the hip or the fist, `AIR` keeps the fill from growing
the body (male 3-0, 3-1, 3-3, 4-0 and 19-0).

**The arms' pass** (2026-10-31, the owner: "Comprehensive pass on the arms ensuring no leftover hammer texture").
Every hammer frame of both bodies was composed empty-handed in each chest family and read beside the art. What stayed
is taken out by the rig's `ARMS` table: a butt below the fist (male 2-0, 2-3, female 2-0), the shaft between the fists
and below them (male 5-3, whose white had seeded the fill), the haft across open air (male 1-3, 6-5, female 1-1 to
1-3, where a chain or plate chest draws it longer), a lit edge by the hood (male 8-4), specks off a fist, and the thumb
laid up the shaft (male and female 5-1).

Its boxes take what any outfit of the family draws, so a chain or plate helmet's or legs' own rim of the haft goes
too. Where a chain or plate trace lost the hammer the leather one found
(male 10-0 and 12-0: the head kept in a flinch), that family takes the leather trace, moved onto its own picture
(`LIKE_LEATHER`).

**Taking it out.** Each hammer pixel takes the side of the nearest pixels outside it - at its edge, the side most of
them are on, so a butt poking past the fist into the air goes with the air: open air is cleared, a pixel the body was
behind is filled. Each such pixel copies its own source, written into the mask's colour (`fillFrom`): the builder fills
the hole from its edge in, each pixel from the place whose neighbourhood best matches its surroundings over the
family's outfits, so the body's texture carries on instead of a blur. Where none fits, the frame's shift, else the
blend. A pixel the rig marks open air (`AIR`, blue 64) is cleared whatever its edge says: the female's back walk 4-0
holds the hammer's head past the hand, over a dark lining the fill carried up into it.

**The front views** (`MIRROR`: the walk's 0-0, 0-1 and 0-3, the female's 0-2, and the idle's 15-0) copy the body's
other side, mirrored, its alpha too, so the hidden hand comes back whole; a copied piece that touches no body (the
other forearm, by the hip) is dropped. The male's front walk 0-2 hid the whole forearm: empty-handed it is drawn as 0-0's mirror twin (`BARE_TWINS`),
armed as 0-3 (`ARMED_TWINS`), so the weapon keeps its hand.

**Drawing one** (the owner, 2026-10-30: *"use the actual paperdoll icon sprites. Same as we use for the
holstering"*). The weapon is its paper-doll picture: the pack's own (`ui/item/itemIconColor32.js`, TEXTURE.234 for the
male, .233 for the female, dyed by its metal), the one BACK-HOLSTER hangs on the back. The doll's hand leaves a gap in
the handle, and that gap is the grip (`heldPicture`): the long axis is BACK-HOLSTER's (`eotbHolster.js`
weaponPictureAxis), the head the gap's longer side, the guard where a picture cuts its handle off (the tanto). It is
laid along the frame's line from the fist, foreshortened as the line is, at the body's scale (the idle is 1.8 m tall,
a picture pixel a centimetre: the rig's `cm`), its heavier side on the hammer face's side. A katana is its flat
picture. A thin handle keeps a pixel's width.

**Its chain and its grip** (the owner, 2026-10-30: "We need to animate the flail"). A flail's chain and ball are split
off the handle (`heldChain`) and run from its head end the way `chainWay` says. In a walk they hang and lag the hand's
move since the frame before (the rig's `cv`), at most 31 degrees off the plumb; at rest they hang plumb. In a swing they
trail the hands while they speed up (the raise: frames 0, 1, 5); at the strike (2) they are flung out along the handle,
foreshortened as it is; then the ball carries on past it and falls (3) and hangs as the arms come back (4). The ball
stays in the picture.

**The hand gap.** The doll's hand gap is bridged with the handle's own core
(`bridgeGap`, never a guard's breadth), drawn only into open air: where the art lost the fist with the hammer (the side
flinch), the pommel stays joined to the guard, and a fist the art keeps covers it.

**Held.** Daggerfall's walk holds the weapon before the body, pointed ahead and a little up: its Archer's sword
(TEXTURE.482, .481, one render with the strips) lies along the hammer's shaft wherever both show. Where the hammer hides
its shaft, the weapon is drawn on the sword's line instead (`SHAFT`, the rig's `w`). A front view's points at the
camera, up from the hand and before the body. A back-3/4 view's crosses behind the body and shows past it. The grip
is the fist's blade side (a front view's: the hand its fill leaves). The fist closes over the handle.

**BACK-CARRY** (2026-10-31, a player, through the owner: "drawn claymore is visually not in character's hand"; "you can
still see parts of default hammer weapon in right hand"). From behind the walk hid the blade forward, as Daggerfall's
Archer does, and showed only the grip and pommel below the fist - read as the hammer's stub, the weapon gone. A
departure from Daggerfall's back views: the blade hangs down from the fist, out with the arm's swing as the art's hammer
head hangs, before the body; the handle behind the fist; edge on to the eye (the rig's `wx`, its width's share: the
guard short, not a bar across the hip). `layered_weapons.test.js` BACK-CARRY.

**Where no picture comes** (a gun, a page with no canvas: the pins), the game draws the weapon: each template a shape
in centimetres (the hammer's grip to head is 70), supersampled, shaded from the upper left and rimmed dark, in the
strips' metal ramps (silver, elven and dwarven their own). Daggerfall Unity draws no third-person weapon for the
player. The Hand Wraps are bare hands. A weapon wearing a look is drawn as the look.

**The bow** is held in the left hand at its middle, upright, leant 12 degrees forward, its back turned 22.5 degrees
from the facing toward that hand's side, the string toward the body. It is the paper doll's bow (`heldBow`): the string
its axis (the thin line, not a short bow's thick limb), the gap in the limb its grip, drawn from its longer limb both
ways, since the doll cuts the lower limb short. The fist closes over the grip. Tip to tip it is the loose's own bow
(`BOW_PX`, the short bow three quarters). Edge on, it is a line, not dashes.

**Which hand.** The left is the art's free hand (`BOW_HAND`, the loose's own bow hand). Where the art hides it and
holds the hammer in the near hand - the side views - the near hand is the left, and the bow is there (`BOW_NEAR`), as
Daggerfall's side views hold a weapon. The back-3/4 idle and the female's 3-2 press that fist flat to the body in
profile, where a bow lies across the arm ("Bow is wonky on these frames still"): the body hides it, flipped or not.

**Flipped.** Records 1-3 and their idles are also drawn flipped (`eotbBillboard.js` MIRRORED), and the flip swaps the
hands (the owner, 2026-10-30: "Bow is still wrong on the back facing left. Its okay if the body hides it" - then
"Youre not presenting the flipped version of the sprite"). A flipped frame is its own picture (the key's `:m`): the
bow at the hammer's fist (`bowM`), the left hand once turned, on the far side, behind the body, which hides what it
covers.

**Two weapons** (LAYERED-DUAL, the owner, 2026-10-30: "We need to find a way to implement duel wielding perfectly"). A
pair (`combat/twoHands/handsLaw.js`) is both codes, `@ls7+dg3`, the hammer line's first: the right weapon on the line,
the left in the free hand. Flipped, the hands swap; in a swing the striking hand's is on the line (`strike`: the rig's
blow in flight, a walker's `ah`).

**The second line** is the rig's `off`. In the walk and the idle it is the free hand (the bow's), held as the first is,
mirrored from the front and behind, its blade hidden from behind; the hand is open in the art, so the handle and guard
pass behind its fingers. Daggerfall's swing is two-handed - both fists meet on the haft - so in a swing, a flinch, or
where the art hides that hand (aside), the hand that holds the second is not in the art, and neither is it (2026-10-31,
the owner, of the sheets: fanned off the first fist it read as two blades in one hand, and stuck out past the head). Each
weapon glows its own hand's colours.

**Its own cut of the swing** (SWING-CUTS, the owner, 2026-10-30: "Is there anyway to switch up the animation?"). The
art has one swing, six frames: up (0, 1), the strike (2, arms out), low through (3), back at the chest (4), up again (5).
Each weapon plays its cut (`SWING_CUTS`, `swingCutOf`): a short blade and a bare fist thrust (4 4 2 2 2 4), a long
blade slashes (4 2 3 3 4 4), the rest chop (0-5). A thrust's strike points its blade the way the body faces, along the
arms (`thrustRigOf`): from aside the whole blade, from the front a stub, from behind hidden. A pair's left-hand blow is
the right's flipped from the front or behind, and its own cut run backwards from aside, a rising backhand.

**The spell in the hands** (SPELL-BURST, the owner, 2026-10-30, of a concept sheet's "Wrath of Sithis": "Do both. I
wanna see what you can cook"). The art has no cast; the cast plays the swing's first four frames, and the outfit code
carries its element (`!0` fire to `!4` magic, `layeredSpell.js` `drawSpellBurst`). An orb gathers at the fists (0),
swells with crooked veins (1), bursts ahead as the arms throw (2) and scatters to specks (3), in the element's colours.
Thrown, it flies the way the body faces from the throw's fists; from behind it is past the body only, and flies on until
most of it clears the back. A one-handed weapon beside the spell (`spellHand`) stays in hand; else the hands are empty.
My cast's element is the rig's (`layeredCast`); a walker's is its pose's `ce`. The weapon's glow is not the spell's.

**The audit** (2026-10-31, the owner: "Lets do a comprehensive audit on everything and ensure all placements are
absolutely perfect along with functionality"). Every body, table, view, frame, flip and weapon was composed and checked
for floating pieces and grips off the fist. A notch in a haft past the hand (the war axe's short of its head, the flail's
of its cap) is filled with the haft (`HAFT_NOTCH`). A picture's px alone in the air is dropped (`dropSpecks`), but not
one beside the body. The art's own specks go where the code holds the hands (`dropLoneArt`: female 9-2, male 8-4).

**The placement audit** (2026-10-31, the owner: "Ensure placements are perfect including shields"). Every frame of
both bodies, in a leather and a plate chest, with a long blade, a claymore, a dagger, a mace, an axe, a flail, a staff,
the bows and four shields: each piece of the weapon (the frame's `held` px) or the shield must touch the body. A fist
the trace took as a piece of the hammer left floating is kept (`keep`, its skin: female 10-0's hand, female 8-2's,
male 9-3's), and three grips are set where the haft meets the fist (female 10-0, male 9-0, male 5-1, whose plate grip
sat ten px up the shaft).

A flail's chain hangs from its cap (FLAIL-LINK: the doll's first link sits below the cap, so
the chain is drawn from it, and the cap's px off the axis stay the handle's). Shields touch the body in every frame.
What still stands off: a claymore's or dagger's guard tip past the body, the war axe behind male 8-1's hood, and female
8-2's fist from behind, which the art joins to the body only through the hammer.

**What the audit fixed in the hands.** A clip keeps the hands it started with (`isAnimating.hands`, a walker's
`r.shot.hands`): the cast's element outlives the rig's cast, and a pair's next blow cannot turn this one. A weapon beside
a readied spell stays in hand. A pair's shot is the striking hand's gun. A flinch at the loose takes the bow's stance. A
left blow turns over from the picture as it stands. A walker's cast is the same look as its stance (`spriteLookOf`).

**Whose hands.** My body reads the item in the hand in use (`combat/weapon/weaponRig.js` eotbState `heldWeapon`,
`eotbBody.js` lookNow). A walker holds the tool of its gathering act, else the weapon in the hand its pose says it uses
(`net/peer/peerRiders.js` walkerWeapon, `peerBodies.js` peerWeaponOf): nothing new on the wire. The outfit code carries
what the hands show (`p6cl~2@ls7`, `@0` empty), so the pictures of each are their own; my body lets the last weapon's
go with its outfit's (`releaseOutfits`).

**Known limits.** The body has the hammer's one two-handed swing; each weapon plays its own cut of it (above), and new
motion needs new frames in every outfit (a shield-bearer's is one-handed: "The shield", below). An attack frame whose hammer points
at the camera draws the weapon short. Each outfit's helmet and legs draw the hammer's rim their own way, so a pixel or
two of it can stay, and a fill can borrow a patch of another piece's colour. The female's back-view flinch (14-0) keeps its raised hand two pixels off the wrist,
and with empty hands her back-3/4 swing (8-2) its hand, whose arm is behind the body.

**The sheets** (2026-10-31, the owner: "Fix all the minor issues and the attached innormalities"). The back-3/4 walk's
metal tip at the free wrist (male 3-0, female 3-1) goes with the hammer (the rig's HAND boxes). The female's leather
chest ghosts the loose's bow, two and three limbs; the same frame in a chain chest is clean, so the loose takes its bow
from that render in open air (`LOOSE_BOW_FROM`, `bowFrom`). A flinch holds the bow in the hammer's fist (the hurt
frames' `bow`), as the art's free hand is flung out of reach. A frame drawn before its weapon's paper-doll picture came is
`provisional`, and the stores decode it again after `PICTURE_RETRY_MS`. My own layered body holds a gathering act's tool
ready (`layeredTool`, its own field: a skin keeps the rig's state), a blow a stroke, as the walkers draw it; and keeps a
cast's frames with its outfit's.

**Known limits of the hands.** A pair shows one weapon where the art has no free hand. A weapon's glow stands round the
weapon alone (LAYERED-GLOW, `05-Combat/Weapon-Glow.md` "Round the weapon"). Verified by
`test/player/eyeOfTheBeholder/layered_weapons.test.js`, `spriteglow.test.js` and `tools/mutants/layered_weapons.json`
(150 mutants, all dead), with THE PLACEMENT AUDIT and FLAIL-LINK (`tools/mutants/flaillink.json`, 3, all dead); the
peer-art pins moved to the new codes (`test/net/peer/fb1022d_peerart.test.js`).

## The shield (LAYERED-SHIELD, 2026-10-31)

The owner: "Any way we can do shields?", then, of a shield held in the two-handed swing, "Lets try #1" and "Please take
your time and do this right". A shield worn in the left hand rides in the outfit code after `^` (`p6cl^k7`: shape b, r,
k or t, then l leather, c chain or the plate metal 0-9; `layeredShield.js` `layeredShieldOf`, read in
`layeredArmor.js` `outfitOfSlots`), so my body takes it from the equip table and a walker from its look's items, with
nothing new on the wire. It is drawn in every frame but the loose's, never beside a pair or a bow.

**The picture.** The paper doll's own shield (`loadShieldPicture`), its grip at the free hand: the rig's `sh` per frame
(`tools/layered-armor/build_weapon_rig.py` SHIELD_GRIP, else the bow's hand). From the front and three quarters before,
its face, over the body. From aside the free arm is the far one: its inside, before the chest, behind the body. From
behind, its inside turned round, at the body's left edge, in open air only (`SHIELD_VIEWS`). The inside is boards, the
face's rim and two straps (`shieldPicture`). A shield past a canvas widens it evenly and upward, so the body stands
where it was (`padFrame`).

**One-handed.** The art's one attack holds the hammer in both fists. The rig names the free arm's outline in each swing
frame it reaches into (SHIELD_ARM, `sa`); it comes out (`removeShieldArm`). A fill no body joins, and a scrap of the
arm's edge left floating, are open air. A view plays only the frames whose sword arm swings on its own side
(`SHIELD_CUTS`): from three quarters before 0-3, from the front and from behind 0-2 (after the strike the arms cross to
the shield), from aside all six, the far arm's crossing (7-3) taken out. A cast keeps to them, a held throw carrying its
stage (`!03`, `SHIELD_CAST`); a shot too (`SHIELD_GUN`).

**The arm put back** (the owner, 2026-10-31: "Its rough. You need to really go deep"). From before, the arm taken out
left the shield floating on the chest. Each front swing frame now takes the idle's free arm back (the rig's `sg`): the
idle of its view composed in the same outfit, its arm (`sp`) laid from this frame's shoulder (`graftArm`), the shield in
its hand where the idle and the walk hold it. The hole the swing's arm leaves is filled from the frame's own body, as
the hammer's is: the builder's inpaint over each chest family's outfits (`arm_sources`, `weapon/<body>/<rf>-arm.png`).
The idle's torso did not serve: the female chain and plate show skin at the neck the swing's turned chest does not.
The far hand that shows behind the back from aside (male 2-2 and 17-0, female 2-0 and 17-0) comes out too.

**The shoulder** (the owner, 2026-10-31: "ensure perfection"). Where the swing raised the free shoulder with the arm
(female 5-0 and 5-1, male 5-1), the outline takes the raised shoulder and the elbow out too: left in, the elbow
floated by the head, and the inpaint copied the shoulder down into the hole as a pale block. A fourth entry in `sg` then
lays the idle's shoulder as well (`ss`: the pauldron, or the hood's fall, and the arm under it). Female 5-2 keeps its
own shoulder: its outline stops under the pauldron, which it had cut in two. Male 6-0 and 6-1 take the free upper
arm out too: its highlights, left beside the outline, were copied into the chest. Female 6-3's fill drew a second
face on the chest from the one beside its hole: the face and the near arm are no source there (SHIELD_FILL_NOT).

**The chest it crossed** (DONOR-FILL, the owner, 2026-10-31: "Still seems really rough"). The inpaint fills a hole from
the frame's own px; across a chest of chain or plate it drew noise, and a smooth blend drew a smudge. Where the free arm
crossed the chest from three quarters (female 6-3, male 6-2 and 6-3) the hole is the idle's own chest (`sd`: the idle of
its view in the same outfit, the shift to its px, set by eye from the heads; `fillFromDonor`), the graft laid over it.
Male 6-3 crouches, so the idle's waist would sit high: its outline keeps to the chest above it, the fill below. Female
5-2's donor showed a bright chest the swing keeps in shadow, and male 5-2's the idle's hanging hand: both keep the fill.

**What it leaves alone.** The weapon is drawn after the shield: before it, or behind it where it is behind the body; its
glow is the weapon's alone. Where the body stands in its picture (ARMORY's marks) is read without the air the shield
fills (`withoutShield`). A bare walk's twin is the armed one, unturned, so the shield keeps its arm. Verified by
`test/player/eyeOfTheBeholder/layered_shield.test.js` and `tools/mutants/layered_shield.json` (34 mutants, all dead).

**The shield on the back** (BACK-SHIELD, the owner, 2026-10-31: "Implement the shield holstered on the back. The weapon
should sit behind the shield"). Sheathed, the shield leaves the arm (the look's `sheathed`: my rig's, a walker's `wd` 0)
and hangs on the back as a card of its own by the holster's law (`eotbBackShield.js`, `BACK_SHIELD`): upright on the
spine, its top over the shoulders, 8 cm farther out than the sheathed weapon. From behind it lies over the weapon; from
before both are behind the body's card. Its face from behind, its inside turned round from before, its width turned
with the body (`BACK_SHIELD_SQUEEZE`, edge on from aside). My body and every layered walker carry it (`drawBackShield`,
`slingBackShield`), listed for the redraw over the aura; a class skin none. Verified by
`test/player/eyeOfTheBeholder/backshield.test.js` and `tools/mutants/back_shield.json` (19, 18 dead, 1 equivalent).

## The art - the doctrine's third exception

The strips are drawn from Daggerfall's own sprites (the caped class sprites 1540 and 1541, the enemy frames of
TEXTURE.475-490), so under `01-Overview/Port-Doctrine.md` they are a render of game data. The owner approved carrying
them as a named exception (2026-10-19), as for Vanilla Enhanced and the desert's and winter's ground, credited to DFO
(`src/ui/credits.js`, `Mod-Registry.md`). `test/tooling/doctrine.test.js` marks the folder `derived`.

- `vendor/layered-armor/male|female/<combo>/`: the body strips; `weapon/<body>/<record>-<frame>.png` and
  `weapon/manifest.json`: where the strips' hammer is (LAYERED-WEAPONS); `cloak/<body>/`: the hood and cape layer;
  `hoodfix/<body>/<combo>/<record>-<frame>.png`: the pixels a hooded frame needs beyond body plus cloak (a frame that
  needs none has no file). `decodeLayered` fetches a hood fix only when a cloak is worn, and draws without it if it
  cannot be had.
- Every frame of the cleaned packages (4 x 141 x 80 = 45,120) composes pixel for pixel from the vendored strips
  (the package's own check). Dyes other than Light Brown and mixed metals have no reference frames; they were looked
  at by eye.
- **Rebuilding after another cleanup round**, on a copy of the frames (`<frames>` holds `male/` and `female/`, each
  with `no-hood/` and `with-hood/`): `python -I tools/layered-armor/strips_from_frames.py <frames> vendor/layered-armor`,
  then `fix_female_hood_shoulders.py` and `fix_hood_holes.py` the same way, then
  `node tools/layered-armor/build_hoodfix.mjs . <frames>` (needs pngjs). `build_cloak.py` does not know the female
  walk-from-behind frame 3-1's cloak moved down 4 px; rebuilding the cloak layer with it puts that frame back.

## The hood on the body (HOOD-GAP, 2026-10-20)

Dudey's shot of the female side walk (record 2, frames 2 and 3) showed the hood floating over the shoulders and the mace
head pale and black. `applyCloak` no longer clears a helmet trim pixel at or below the hood's foot (3 px up from its
lowest pixel in that column, along the hood's lower edge - a column whose foot is within 6 px of the lowest): that is
the helmet's neck under the hood, not a tip in the air. A tip beside the hood's sides is cleared as before. `closeHoodFoot` fills a run
of 1-5 empty pixels under the hood's lower edge with the hood's own foot colour where the body is right below it. The
mace head of 2-2 is 2-3's, copied 3 px left in every tile (`tools/layered-armor/fix_mace_head.py`).

## Known limits

- The female hurt frames have no gold trim: no trim source exists for them. Their metals come from the full-plate
  frames' own color mapping.
- The card pictures each body in plain leather; the player's own armor shows on the body in the game.

## Verification

`test/player/eyeOfTheBeholder/worn_armour.test.js` (the outfit, the strips, the composition, the cloak, the hood
fixes), the skin card's pins (`test/net/skin2_class_skins.test.js`, `test/net/disc23b_eotb_sprites.test.js`,
`test/ui/skinmode_toggle.test.js` for the toggle, `test/net/layered_peers.test.js` for the others), the body's (`prww1_werewolf`, `profile2_pause_profile`,
`eotb_audit2`), and the relay's (`relayversion`, the version pins).
