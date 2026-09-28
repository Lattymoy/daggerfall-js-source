# FIELD BUGS 2026-09-27 — invisible players, and a visitor's drops in a house

Relayed by Mac at the end of QUEST-PARTY phase 3 ("I'm recieving reports of"):

1. *"Other player's still see other players who are suppose to be invisible"*.
2. *"In houses, players can drop items and the owner cannot see them"*.

## INVIS-NET: a concealed player is concealed from the others too (report 1)

A player's magical concealment - Invisibility, Chameleon, Shadow (`systems/effects.js` isInvisible / isBlending /
isAShade, normal or true power) - lived on their own entity alone. The pose carried none of it, so every other player
drew them whole (the Morrowind body, the class sprite, the rider, the name), could press F on them, and their own foes
hunted them as if they stood in the open: enemyMotor's illusion gate reads a peer target's `concealment()` closure, and
no peer candidate carried one (its own note: "a peer's flags are a later slice's wire field").

- **The wire.** The pose carries `cv` - 1 invisible, 2 blending, 4 a shade (`effects.js concealBits`), OMITTED at 0,
  so an unconcealed pose is the bytes it always was; `validPose` bounds it, `poseChanged` sends its edge at once (a
  vanishing is news, not a keepalive), `lerpPose` carries it whole. A pose field is never gated: an older relay drops
  it and the others see what they saw before. It rides world114 on this branch - world118 at the merge onto main,
  the relay deploy OWN1 takes.
- **The draw.** A peer whose drawn pose is concealed is drawn as DFU draws every concealed entity that is not the
  player (EntityConcealmentBehaviour: the renderer off): no rider, no body, no walker, no sprite, no name (world.js,
  `seen` beside `drawable`). Its cast is still seen - a missile leaves an invisible caster's hand in DFU too.
  At the merge onto main, main's PEERLIGHT2 (a peer's Light spell hangs a candle - a sprite and its light - before
  them) read the whole list; it reads `seen` now, so the classic lane's invisible player does not walk behind a
  floating candle (`test/invisnet.test.js`, mutant `INVIS-candle-for-all`). A torch's light (PEERLIGHT1) is a light
  alone, no sprite, and stays - DFU turns a concealed entity's renderer off, not the lights about it.
- **The F key and the plaque** skip a concealed peer (`peerInSight`).
- **The foes.** `peersNear` carries each peer's bits, and both foe pools' peer candidates answer `concealment()` off
  them (`concealFlagsOfBits`), so EnemySenses.BlockedByIllusionEffect reads a peer as it reads any target.

Pinned: `test/invisnet.test.js` (5). `tools/mutants/invisnet.json` (15 dead, the candle's at the merge).

## HOUSE-DROP: a visitor drops nothing in someone else's online home (report 2)

A drop is the dropper's own (AUDIT WORLD B3) and an online home's room carries no loot at all (HOME1), so what a
visitor left on another's floor stood on the visitor's screen alone - the owner never saw it. Asked how it should
work (the owner's floor, the dropper's own shown to all, or no drop), Mac chose **"Block visitor drops"**.

- Both inventory skins ask the host's word whenever the destination IS the ground - the session's dropped list, or a
  pile the player dropped before - never a wagon, a chest, a corpse or a merchant (`inventorySession.js
  groundRefusalOf`), and the transfer law refuses with it said (`itemTransfer.js planStore` / `planDropGold`
  `groundRefusal`): "You cannot drop items in another's home." The item stays in the pack; gold stays in the purse.
- A light dropped or thrown (Handheld Torches) is refused the same way (`handheldTorches.js`, through the rig).
- The building's close is a belt: anything that still reaches it goes back to the pack, gold to the counter
  (`worldModes.js`, `takeOneInto`).
- Only a VISITOR in someone else's online home: the owner's own floor, an offline house and every other building are
  as they were.

Pinned: `test/housedrop.test.js` (5). `tools/mutants/housedrop.json` (16 dead).

## INVIS-LOOK: the transparent look (the follow-up, the same day)

Mac: *"Give invisibility the same invisibility we give enemies in enhanced AI. That transparent look"*. INVIS-NET drew
a concealed player as DFU draws any concealed entity that is not the player - not at all. That is the classic lane's
draw now. Under Enhanced Combat Visuals (the switch the concealed foes' look already takes) a concealed player is drawn
the way that lane draws a concealed foe: Chameleon's translucent shimmer and ripple, a shade's dark silhouette - and
an INVISIBLE player takes the shimmer too (a foe's invisibility is still not drawn; this is the one departure, asked).

- Every figure that can stand for the peer carries it: the rider, the Eye Of The Beholder walker, the class sprite and
  the doll (their billboards, the renderer's blended phase), and the Morrowind body (its sprite box's quad, with the
  billboard shader's own look, drawn after each mode's opaque world so what stands behind it shows through).
- No name over a concealed peer; a concealed walker's lantern is not drawn; F and the plaque still skip them, and
  their foes still read the flags.

Pinned: `test/invislook.test.js` (7). `tools/mutants/invislook.json` (31 dead).

## PSCALE-OWN: the first of phase 3c's two gaps (Mac: "Finish the 2 gaps")

A shared quest's foe underground (QUEST-PARTY phase 3c's own lane) was the one foe a party fights together that no
party's size weighed. It is weighed now, as every other shared foe is: as tough as the party striking it, striking each
as a party's foe, counted by whoever runs it - my own quest's by me whoever holds the seat, a party member's puppet by
its owner's record. My private quest's foe and my summoned ally stay unweighed. `06-Systems/Online-Arc.md` (PSCALE-OWN).
Pinned: `test/pscaleown.test.js` (3). `tools/mutants/pscaleown.json` (7 dead).

## SUMMON-SYNC: the second gap - a summon's foe underground is the room's

A loose stand past a dungeon's layout run - a summon's foe (a SoulBound's release, the Sanguine Rose's Daedroth) or a
Wabbajack's change - was its player's alone. It rides the room's own lane now, as a cell's loose stand rides its cell:
every player in the room sees it, strikes it through its owner and is hunted by it; a door out hands it to the player
nearest it; an owner gone without a word takes it along. A summoned ALLY is handed to nobody, outside or underground -
it goes with its summoner (an heir stood it as everyone's foe). With that the ONLINE-DUNGEON-FOES flag is retired - a private
quest's foe stays its player's own by the party's law. `06-Systems/Online-Arc.md` (SUMMON-SYNC).
Pinned: `test/summonsync.test.js` (9). `tools/mutants/summonsync.json` (24 dead).
