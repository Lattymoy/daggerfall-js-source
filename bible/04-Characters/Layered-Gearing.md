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

## The art - the doctrine's third exception

The strips are drawn from Daggerfall's own sprites (the caped class sprites 1540 and 1541, the enemy frames of
TEXTURE.475-490), so under `01-Overview/Port-Doctrine.md` they are a render of game data. The owner approved carrying
them as a named exception (2026-10-19), as for Vanilla Enhanced and the desert's and winter's ground, credited to DFO
(`src/ui/credits.js`, `Mod-Registry.md`). `test/tooling/doctrine.test.js` marks the folder `derived`.

- `vendor/layered-armor/male|female/<combo>/`: the body strips; `cloak/<body>/`: the hood and cape layer;
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
