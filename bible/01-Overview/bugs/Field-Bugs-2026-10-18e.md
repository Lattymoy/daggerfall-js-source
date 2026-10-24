# FIELD BUGS 2026-10-18e - a Large Galley's parts no one could lift out of storage

One report, from Mac: *"Having an issue where large galley ship is too damn heavy to even move outta storage into
inventory after stripping all carry weight items"*. Read on main at `138604baa`. The pin is
`test/systems/comeSailAway/fb1018e_partsweight.test.js`, the mutants `tools/mutants/fb1018e_partsweight.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | a Large Galley's parts too heavy to take out of storage into an emptied pack | A packed boat's parts carried her hold's weight, and CARGO-ANYWHERE's door stows into a packed hold with no gate, so the parts grew past what the bearer could lift. Set down in a chest, no door found them to weigh again, and every take refused them for good | fixed (PARTS-WEIGHT) |

## PARTS-WEIGHT (1)

`systems/comeSailAway/comeSailAway.js` (`PackBoat`, `partsTooHeavy`, `PARTS_TOO_HEAVY_TEXT` - was `HOLD_TOO_HEAVY_TEXT`),
`systems/comeSailAway/comeSailAwayHulls.js` (`PACKED_WEIGHT_MAX`, `packedHullWeight` and `hullFromMessage`, moved into the
leaf), `systems/comeSailAway/comeSailAwayItems.js` (`repairPartsWeights`), `systems/save/save.js` (`repairItemLists`),
`systems/comeSailAway/csaBoatMenu.js` (`tooHeavy`'s words), `scenes/holdDoor.js` (`openShip`), `scenes/world.js` (the
door's `weigh` seam taken out).

THE CAUSE. Come Sail Away's PackBoat (6130-6158) lays the cargo's weight on the parts it makes
(`val.weightInKg += weight`), and SHIP-PACK kept that. HOLD-WEIGHT (`Field-Bugs-2026-10-05c.md`) stopped PackBoat making
parts heavier than the bearer's MaxEncumbrance. Then CARGO-ANYWHERE (2026-10-17, `03-World/Naval-Refit.md`) opened a
packed ship's hold from anywhere and weighed her parts again as its window shut, her timbers and her hold. Nothing gated
a stow, so a packed galley's hold filled from the pack - the hold's key, the Fleet page's Hold - made her parts as heavy
as the hold. A bearer overloaded by them sets them down. In a chest, two things kept them there:

- **No take could lift them.** DFU's CanCarryAmount (`systems/item/itemTransfer.js` planTake) refuses an item heavier
  than MaxEncumbrance less the load, so even an empty pack was not enough. That is DFU's law, and it is right.
- **No door could lighten them.** The hold door finds a ship's parts in the pack alone (`deps.partsOf`), and so do the
  Fleet page and the hold's key. Parts in a chest got no window over their hold, and their weight was never written
  again.

THE FIX. Her parts weigh her timbers alone (`packedHullWeight`: the hull's table weight, never more than the Large
Boat's 120 kg). Her hold still goes into PackedCargoes under her number, opens from anywhere, and comes back aboard
when she is placed. A laid-up ship's hold and a standing ship's already weighed on no one, so a packed one now matches
them. Whatever is stowed, wherever the parts lie, a take lifts them as long as the bearer can lift 120 kg. A load gives
every parts item its hull's packed weight (`repairPartsWeights`, run by the load's item repairs over every list the
save holds - the pack, the wagon, a house chest, a scene's containers, Come Sail Away's cargoes), so the report's galley
lifts on the next load. Her hold stays under her number throughout, so nothing in it is lost.

A DEPARTURE from the mod's PackBoat sum (Port-Ledger SHIP-PACK row, narrowed). `partsTooHeavy` keeps HOLD-WEIGHT's
gate over her timbers alone: a bearer weaker than 120 kg (strength under 80 with no weight allowance) cannot pick a
ship up, and the pick-up and the menu say so in words that are true now - "The ship's parts are too heavy for you to
carry.", where they had said to unload the hold. A Rowboat's parts are her 30 kg.

NOT FIXED HERE. The take counts the purse's coins as DFU does (400 to the kilogram), so a bearer carrying a galley's
price in gold can still be refused 120 kg. That is DFU's law and stays.

THE FOUR HOSTS: `world.js` wired (its door's `weigh` seam gone). `exterior.js`, `worldModes.js` and `dungeonContext.js`
build no hold door, so they have nothing to wire.

Pins: `test/systems/comeSailAway/fb1018e_partsweight.test.js` (2). PIN MOVED in `test/systems/comeSailAway/fb1005c_holdweight.test.js`
(the gate weighs her timbers alone: a weak bearer is refused, a heavy hold packs), `test/scenes/holddoor.test.js`,
`test/systems/naval/auditrefit2.test.js`, `test/systems/comeSailAway/shippack.test.js` and `test/systems/csa_items.test.js`. Mutants:
`fb1018e_partsweight.json` (5); `fb1005c.json`'s gate records re-aimed by content, `holddoor.json`'s `HOLD-parts-unweighed` renamed
`HOLD-parts-left-in-hold`, `csa_items.json`'s `CSA-H-pack-weight` (the mod's sum itself) and `auditrefit2.json`'s `A2-hold-weighed-twice` and `A2-hold-refused-light` retired with the
weighing (a refused door has no weight to put back, so its call went too), and `shippack.json`'s
two cap records and `csa_placing.json`'s hull record moved to the leaf. Not seen in a browser.
