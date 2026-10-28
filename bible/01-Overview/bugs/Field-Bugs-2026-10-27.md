# FIELD BUGS 2026-10-27 - "Sailing Vessels Sometimes Have No Propulsion", read again

The Discord's #bug-reports thread from Dûmorîkh (2026-10-21), handed over again as a screenshot with no word beside it,
the thread still marked Unsolved. Read on main's `e1486b07c` with the freeware's data (`tools/fetch-data.sh`). The pin is
`fb1027_helmsight.test.js`, the mutants `tools/mutants/fb1027_helmsight.json`. AUDIT HELM-SIGHT read this record and its
change cold (`../audits/Audit-Helm-Sight.md`); its corrections are made below.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Dûmorîkh: "Sailing Vessels Sometimes Have No Propulsion" - "This is only with sails." | The report's own cause, the indoors' wind brought outdoors by a load, was fixed by SAIL-WIND the day it was posted (#1106). One more way to the same stop was found: a helm held across a party's jump. Its landing, when it succeeds, left an unpacked ship with the landing's pixel | ALREADY FIXED (SAIL-WIND); HELM-SIGHT |

## The report: already fixed by SAIL-WIND (1)

`Field-Bugs-2026-10-21b.md` SAIL-WIND read this thread to its root and merged in #1106 on 2026-10-21: a save made below
ground kept the indoors' wind of nought, and a load that landed outdoors laid it on the open sea. Re-read here on main:
`fb1021b_sailwind.test.js` passes, and the screenshots are that record's measure - "Stow sails" on both panels, a Small
Ship at 0.1 knots and a Large Boat at 0.0. The in-game chat's tip in the second screenshot, "the local map to travel a
bit", worked because travel passes the hour and OnNewHour lays a new wind.

## HELM-SIGHT: a held helm's boat stays in sight across a jump (1)

`src/systems/comeSailAway/comeSailAway.js` (OnWorldReanchored).

FOUND. To find any other way to the same stop, a seeded random drive of the real runtime over `test/csaScene.mjs` (the
helm taken and left, the ladder, End, doors, hours, weather, saves and loads, recentres, jumps, deaths, a load's start, a
magic round) asked every state with her sails up, a wind and the player outdoors to make way within 12 seconds. Under
the Responsive helm one path failed: the world re-anchored while the helm was held. The drive was committed at the audit
as `tools/sailDrive.mjs` (`--seed`, `--runs`, `--classic`); its counts are the audit's.

Every jump lets the helm go before it - a load at its start, a fast travel before it pays, any other jump in
`_teleportToPixel` (HELM-JUMP, `world.js:"if (modEvent == null && !resolveArrival) csaPreJump();"`) - but a party's
journey, which holds it until its landing is sure. OnWorldReanchored then showed or hid every
boat for the new pixel, the helm's own too. Her map pixel was the departure's, so the far landing hid her. A landing that
fails sends the player back to the departure and to the helm, and that jump showed her again.

An Animator switched off and on starts over with its parameters at their defaults (`world/unityAnimator.js`), so every
sail read Stowed while the helm still read them set. Her canvas counts only sails not stowed: she made no way, the panel
said "Stow sails" at 0.00 knots, and W said "All sail is set." Measured: a Large Boat 5.16 knots before the jump and 0.00
after, a Small Ship 15.47 and 0.00, a Large Galley 7.73 and 0.00, a Carrack 18.56 and 0.00. Her sails showed furled, so
this is not the report's own case, and End twice set them again.

A landing that succeeds had a fault of its own in the same place. It lets the helm go from the landing (StopSailing on
her deck, else OnPreFastTravel), and the let-go stamped the player's pixel on her, the landing's. A boat it does not pack
(a ship without her deed in the pack, her parts too heavy to carry) stays at the departure, so the next visibility check showed her
there, out of sight but heard: a boat's loop never falls below half its volume (`logarithmicRolloff`, its floor past
twice its least distance). Her save carried the landing's pixel with the departure's place.

THE LAW NOW. A re-anchor carries every boat and shows or hides each but the one whose helm is held
(`comeSailAway.js:"if (boat !== state.CurrentBoat || state.disembarking != null) UpdateBoatVisibilityOf(boat);"`), and
notes whether the player now stands on another pixel than hers (`helmAfar`). Her Animators keep their state. A helm let
go from afar leaves her own pixel on her and shows or hides her for it (`stopSailingHead`), and the world host plays no
loop of hers while it holds. The same jump after: 6.63, 19.89, 9.94 and 23.87 knots, where End twice had been the way
out. FIELD-CSA1's row in Port-Ledger A says so.

NOT THE CAUSE, the drive's other stops, all under the Classic helm (a player's own choice) and each the mod's model: the
square-sail assist stowing all of a square-rigged hull's canvas with the wind ahead of her beam (SAIL-WIND's NOT THE
CAUSE; the audit's B1 found the band it leaves unsaid), and the Carrack with no hold, which HELM-WAY records making no
way under oars or sail.

`test/systems/comeSailAway/fb1027_helmsight.test.js` (5): a Small Ship, a Large Boat and a Carrack under sail with the
helm held across a jump away and back keep their sails set and make way; a landing that succeeds leaves a ship it does
not pack (built as the game mints her - the audit's C1) at her own pixel, hidden and silent; a boat nobody holds is still
hidden and shown. The audit's pins are its own (`audit_helmsight*.test.js`). FIELD-CSA1's pin in
`csa_placing.test.js` moved: a held helm's boat stands beside the one it hides. `tools/mutants/fb1027_helmsight.json` (5,
5 dead); `field_csa1.json`'s reanchor-no-visibility record re-aimed (14, 14 dead).
