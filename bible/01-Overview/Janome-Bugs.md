# JAN1 - Janome's play report, 2026-09-18

Janome, on the deployed build, relayed by Mac out of the Discord. Eight
reports, paraphrased to their claims:

> 1. CRASH `i.openCharSheet is not a function` toggling between F5 and F6
> 2. T then H to mount a horse switches the hand side
> 3. COST:NaN selling certain items; the merchant offers 0
> 4. Lights shining through attics at certain angles
> 5. Sometimes talking gives the classic "What do you want? / W - where
>    is... / T - tone / Esc - goodbye" box; everyone in the same building
>    does the same, until I leave and re-enter
> 6. Exiting a dungeon with sword and torch drawn shows a fist under the
>    torch flame - again
> 7. People walking in the sky just outside the city
> 8. CRASH `RangeError: region 17 is outside the 0 bank accounts` at the
>    bank; softlock withdrawing a letter of credit

All eight are fixed. Four are one-line reads of the wrong bag or the
wrong ring; four are laws that lived in one host, or one frame, and were
met from another.

## 1 - the pack's F5 (`ui/enhancedInventory.js`)

The CharacterSheet key arm called `onExit()` - which unmounts, and the
unmount clears the module's `deps` to `{}` - and THEN read
`deps.openCharSheet` off the emptied bag. The file's own law at its
close arm, THE HOOKS ARE READ BEFORE ANYTHING CLOSES, applied to the one
arm that broke it: the hook is captured first, asked for as a function,
and the close runs before it.

## 8 - the empty bank table (`systems/save.js`)

A save from before the banking slice restored an EMPTY account table.
An empty array is truthy, so the host's `??= createBankAccounts()` never
minted one, and every bank reader threw by DFU's own `ValidateRegion`
law. No accounts saved IS the full table, as a new game mints it; the
house registry beside it alike. The classic law - a region past the
table refuses - is untouched.

## 3 - COST:NaN (`systems/itemTemplates.js`, `systems/tradeModes.js`)

An item saved before MAC-N1 set every minter has no `value`, or a NaN
one, and the trade window read `item.value` raw. One value read for
every price arm now - `itemValueOf`: a non-finite value is an absent
one and the template's base price answers - and a save's items, wagon
and repair collection are set on the way in. Sell, SellMagic, Repair
and Buy all go through it.

## 2 - the hand that switched sides (`ui/input.js`)

H is TWO bindings: DialogShortcuts' TransportHorse inside the transport
window, and SwitchHand in the world - which DFU fires on the UP edge
(`ActionComplete`). The window opens on T, the host's keydown is gated
behind the overlay so H's down never reached the ring, the window picks
the horse and closes on that down, and then the keyup listener - which
was NOT gated - wrote H's up into the ring for the host to read as a
hand switch. **The ring releases only what it captured**: `own` holds
every code whose down the ring saw, and an up with no down of its own is
a window's, not the player's. The mouse listeners note their down
unconditionally, so a release under a window still clears.

## 6 - the fist under the torch (`combat/playerWeapon.js`, the doors)

The fourth time this report has been filed, and the third root. DFU has
ONE `WeaponManager`; the port has four `PlayerWeapon` rigs - `world.js`,
`exterior.js`, the interior host's and the dungeon's - and the sheathed
state and the drawn hand lived on the rig, while the torch is read off
the ENTITY. Cross a door with the sword out and the new rig woke
sheathed under a torch that was still lit. `weaponPoseOf` /
`applyWeaponPose` are one home; every door carries the pose across -
interior enter, interior exit, dungeon enter, dungeon exit (read BEFORE
the dungeon context is destroyed), and the forced exit.

## 7 - the walkers in the sky (`scenes/world.js`)

The fixed city's `groundY` answered the location's flat: `() =>
locOrigin[1]`. The navgrid extends some seventy units past the flattened
rectangle, so a villager walking off the edge of the flat stood at the
flat's height over terrain that had fallen away below. `groundY` is the
terrain floor now, out of the pixel's vertical frame, the same
`heightAt` the player stands on; both hosts on one law.

## 4 - the glare through the attic (`render/airPass.js`)

EL7's bloom glare sprite tested its light's occlusion at seven taps by
PRESENCE - is there depth in front of the light at this tap - and an
oblique floor or roof lands a tap within the slack at some pitch. The
sum stands; after it, a veto at the light's OWN pixel: a surface there
nearer than the lantern by more than the slack is a wall between the
eye and the light, whatever the seven taps said. Reconstructed in JS
in the pin: at every pitch a tap lands within the slack through an
oblique floor, the floor at the light's pixel is nearer by more than
the slack.

## 5 - the classic talk box (`scenes/world.js`)

Not a skin fallback and not a failed load. `openTalkWindow` has ONE
door: the enhanced panel mounts when the Where-is `directory` has rows,
and the keyed greeting chain - `W - where is...`, `T - tone`, `Esc` -
mounts when it has none. The directory is built from `syncTopics`, which
runs in the EXTERIOR frame alone, under the modal return, so nothing can
sync it while the player is inside a building. A restore that lands the
player INSIDE - the boot `?load`, which runs before the frame loop has
even started, and quickload's building arm - mounted the interior with
`topics` still null, and every NPC in that building took the chain until
the player walked out and an exterior frame ran. That is the report to
the letter: the scope was the visit, not the NPC.

The arrival already carried the session half of TalkManager's
`OnLoadEvent` (`npcSession.onWorldChanged()`); it carries the topics
half now, one `syncTopics()` beside it. Not from the modal frame: indoors
`cam.pos` is interior-local and the pixel walk would CLEAR the topics.

Diagnosed and reproduced headlessly - a topic-less `createTownTalk`
handed `openTalkWindow` mounts a `ChoiceWindow` whose labels are the
screenshot - before any line was changed.

## The campaign

`test/jan1_fixes.test.js` (4) and `test/jan1_field.test.js` (4).
`tools/mutants/jan1.json`: **26 mutants, 26 killed**, including the
eight that are the bugs themselves (the hook read after the close, the
truthy empty table, the raw `item.value`, the ungated up, the pose left
on the old rig, the constant `groundY`, the veto dropped, the arrival
that forgets the topics) and the one that opens the enhanced panel with
no directory at all.

## Not seen on a GPU

The glare veto, the walkers' floor and the pose across the dungeon door
are driven in node - the shader by JS reconstruction, the doors by two
real rigs. **Nobody has loaded Janome's save.** Worth a pass: boot a
save taken inside a shop with `?load`, talk to the shopkeeper; draw a
sword and a torch and take a dungeon door both ways; stand at a city's
edge at dusk and watch the road out.
