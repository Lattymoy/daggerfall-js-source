# FIELD BUGS 2026-10-15e - the Gauntlets of the Rose, unseen

Two questions from #patreon-chat, read on the code as it stands at main's `3ffd1492` (merged forward to `7566f117`). Each is traced on the real modules
first; the fix is pinned.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Do gauntlets of the rose actually work? 'Fists land again for half' I haven't noticed any difference in damage or anything proccing while using them" | They work: every fist that lands strikes again for half. But the second blow lands through the struck foe's door, which runs no formula, and HN1's numbers are a readout of the formula - so the HUD showed the first blow alone, the same number as without the Rose | fixed (ROSE-SEEN) |
| 2 | "Does having a shield equipped make them not work?" | No. A shield forces the right hand, and an empty right hand is the bare fist | answered (SHIELD-FIST) |

## ROSE-SEEN: the second blow raises its own number

`src/systems/loot/lootPowers.js` again; `src/ui/hitNumbers.js` showFollowUp.

FOUND. Traced through the real formula, the Rose and a door (a Hand-to-Hand 60 player, 200 swings at a 60-armour foe):
every one of the 195 fists that landed struck again for half, through `again()` and the door's `hurtFoe` - 3798 damage
from the first blows, 1945 more from the second (51%). Open Hand works in every host whose door holds the struck foe
(the dungeon's pool, the exterior's foes and the city's guards) and, since OPEN-HAND (`Field-Bugs-2026-10-12g.md`), on
the Gate's Warden, his crystals and his host through their claims. What the player saw was HN1 (`10-UI/UI-Arc.md`): CalculateAttackDamage reports once per
attack and the enhanced HUD draws exactly that. The follow-up is no attack - no formula runs for it - so it rose no
number, made no sound and said nothing. The one number on screen was the first blow's, unchanged by the Rose: "no
difference in damage", "nothing proccing". Many Endings' echo (`warp-edge`, the same `again()`) was as silent.

FIXED. `again()` raises the follow-up's own number beside the first, tagged with the power's name ("Open Hand", "Many
Endings"), the damage it carries - half the landed blow for the Rose, the whole blow for the echo. None for a foe the
door holds dead, and none into the Warden's ward (lootStrike answers no warded blow since AUDIT WORLD-REWARDS B3).
Enhanced only, as HN1 is: the classic skin registers no numbers, and the blow lands there as before. The number is the formula's readout's peer - what the follow-up
carries, before a shared foe's toughness or the relay's caps, as the first blow's number is. In a bout between players
the loot's powers sleep (AUDIT 625 P2), so no number rises for a follow-up a rival's claim would drop.

## SHIELD-FIST: a shield leaves the fist

`src/combat/playerWeapon.js` updateHands, strikingWeapon.

ANSWERED. DFU's WeaponManager.UpdateHands (:648-676) reads a shield in the left hand as no weapon: it forces the right
hand (`usingRightHand = true`, :656) and blanks the left. The port's updateHands is that, verbatim. With nothing in the
right hand the striking weapon is null - the bare fist - and Open Hand's gate is `!weapon`. Traced: the same 200 swings
with an iron kite shield equipped land the same blows and the same second blows, number for number. A player who last
switched to the left hand is put back on the right by the shield.

`test/systems/fb1015e_rose.test.js` (2), `tools/mutants/fb1015e_rose.json` (11, 11 dead). Not reproduced in play here (this
container has no ARENA2); the trace and the pins are the real modules'.
