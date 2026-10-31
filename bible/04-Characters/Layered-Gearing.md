# Layered Gearing

The look that draws the player's body on foot, in the classic sprite style, in the armour it actually wears and with
the weapon it actually holds. It belongs to Eye of the Beholder's third-person sprites. The player chooses it on the
profile window's Skin card (**Look: Skins | Layered Gearing (WIP)**); it is the default.

## How it works

- **The choice.** `Graphics.LayeredGear` (`src/systems/modSettings.js`): 0 is Skins; 1 and 2 are the female or male
  body; 3 (`LAYERED_OWN`, `src/player/eyeOfTheBeholder/layeredArmor.js`) is the character's own body, the default. A
  player may choose either body whatever the character. The card (`src/ui/skinCard.js`) shows each body in plain
  leather (`layeredPreviewUrl`) and keeps the Mounted picker: a rider has no layered art, so on a horse the player
  wears the Mounted skin, and a werewolf or wereboar its beast sprite.
- **The outfit.** Three slots change the picture: chest (torso, shoulders, arms, hands), legs (belt to feet) and helmet
  (`OUTFIT_SLOTS`, `outfitOfItems`). Each wears its item's family, leather, chain or plate; plate wears its own metal
  (iron, steel, mithril, adamantium, ebony, orcish, daedric). An empty slot is leather. Gloves, boots and pauldrons do
  not change it. Silver, Elven and Dwarven draw as steel. Both bodies have all 27 outfits at 80 frames each.
- **The cloak.** A worn Casual or Formal Cloak adds its hood and cape in its dye over any outfit (`applyCloak`,
  `dyeCloth`); undyed is Light Brown (`CLOAK_DEFAULT_DYE`). The helmet stays under the hood, and what pokes past the
  hood is trimmed. Hood fixes fill the pixels a hooded frame needs (`applyHoodFix`, `closeHoodFoot`).
- **The weapon in the hands** (`src/player/eyeOfTheBeholder/layeredWeapon.js`). The strips' own warhammer is taken out
  of every frame and the body draws what the player holds: a melee weapon in its shape and metal, a bow upright in the
  free hand, empty hands for a cast or a sheathed weapon, a gun held from the hip for the shot (`weaponShownFor`). The
  weapon is its paperdoll icon, as on the back holster. A sheathed long weapon or bow rides the back on this look too.
  Where the art's hammer points at the camera at the strike, the weapon strikes along the arms (`STRIKE_SHORT`). From
  behind, a held blade hangs down from the fist, edge on (the rig's `wx`). A flail's chain hangs from its cap.
- **The shield** (`src/player/eyeOfTheBeholder/layeredShield.js`). A shield in the left hand rides in the outfit code
  after `^` (`layeredShieldOf`), so other players see it with nothing new on the wire. It is the paper doll's picture:
  its face from before, its inside from behind (`SHIELD_VIEWS`). It is drawn in every frame but the bow's loose, never
  beside a pair, a bow or a sheathed weapon. The art's one attack is two-handed, so a shield-bearer's is one-handed:
  the free arm comes out of each swing frame (`removeShieldArm`), and a view plays only the frames whose sword arm
  swings on its own side (`SHIELD_CUTS`). From before, the idle's free arm is laid back with the shield in its hand
  (`graftArm`).
- **The shield on the back** (`src/player/eyeOfTheBeholder/eotbBackShield.js`). Sheathed, the shield hangs upright on
  the spine, farther out than the sheathed weapon (`BACK_SHIELD`), so from behind it lies over the weapon. My body and
  every layered walker carry it; a class skin does not.
- **Online.** A look carries the chosen body as `lg` (1 female, 2 male; the own body is sent as the character's).
  While this player wears Layered Gearing (`viewerLayered`), every other player on foot is drawn as a walker in the
  armour their items say, in their chosen body or else their own (`createPeerWalkers`, `src/net/peer/peerRiders.js`).
  A Skins viewer sees others as they chose. Riders, beasts, the dying and peers in a Morrowind body are not walkers.
- **Memory.** An outfit is a look (`LA:` keys, `isLayeredKey`); the peers' art store lets an undrawn outfit and its
  textures go, and keeps only the most recently asked decoded pictures.

## Rules

- Players either equip skins or use Layered Gearing; the choice is a proper toggle on the profile (the owner).
- Layered Gearing is on by default (the owner).
- When this player uses Layered Gearing, they see every other player in layered gear too (the owner).
- The body holds the weapon the player uses, drawn from the paperdoll icon sprites as holstering does (the owner).
- A shield is held on the free arm through a one-handed swing; sheathed, it is on the back with the weapon behind it
  (the owner).
- The art is Port-Doctrine's third exception: the strips are drawn from Daggerfall's own sprites, approved by the owner
  and credited to DFO (`src/ui/credits.js`). `test/tooling/doctrine.test.js` marks the folder `derived`.
- It is a skin, not a feature: it has no Features row.

## Daggerfall Unity

DFU has no third-person body for the player. Eye of the Beholder is a DFU mod for third-person sprites; Layered
Gearing is the port's own addition to it, with its own art (`vendor/layered-armor/`). Daggerfall's back views hide a
held blade forward and show only the grip; the layered body hangs it down from the fist, because a grip alone read as
the hammer's stub.

## Code and tests

- `src/player/eyeOfTheBeholder/layeredArmor.js` - outfit, cloak, hood fixes, strip composition, decoding
- `src/player/eyeOfTheBeholder/layeredWeapon.js` - the held weapon
- `src/player/eyeOfTheBeholder/layeredShield.js`, `eotbBackShield.js` - the shield on the arm and on the back
- `src/net/peer/peerRiders.js` - other players' walkers and the art store
- `src/ui/skinCard.js` - the toggle and body choice
- `tools/layered-armor/` - rebuild scripts for strips, hood fixes and the weapon rig
- `test/player/eyeOfTheBeholder/worn_armour.test.js`, `layered_weapons.test.js` - outfit, strips, cloak, weapons
- `test/player/eyeOfTheBeholder/layered_shield.test.js`, `backshield.test.js` - the shield
- `test/ui/skinmode_toggle.test.js`, `test/net/layered_peers.test.js`, `test/net/peer/fb1022d_peerart.test.js` - the
  toggle, other players, memory

## Open

- The female hurt frames have no gold trim: no source exists for it.
- Dyes other than Light Brown and mixed metals have no reference frames; they were checked by eye.
- The body has the hammer's one swing; new motion needs new frames in every outfit. A helmet's or legs' rim of the
  hammer can leave a pixel or two.
- Some pieces still stand off the body: a claymore's or dagger's guard tip, the war axe behind male 8-1's hood, and
  female 8-2's fist from behind.
