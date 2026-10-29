# FIELD BUGS 2026-10-29b - "can't sail no speed with the wind"

The Discord, ItMustBeMonday, handed over by the owner as a screenshot: "Seeing a lot of issues with sailing at the
moment" - "Basically someone in Iliac bay, can't sail no speed With the wind. Another person next to them can. Tried
different ships and all sorts". The owner, on the first reading: "People are having trouble sailing, period." Read on
main's `5a77fc2f2` with the freeware's data (`tools/fetch-data.sh`). The pins are `fb1029b_sailing.test.js`, the
mutants `tools/mutants/fb1029b_sailing.json` (12, all dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "can't sail no speed With the wind. Another person next to them can. Tried different ships" | Two laws stop every ship one player takes and never the one beside them. A boat with no map pixel threw in a door's boat visibility before the door laid the outdoors' wind, so the indoors' none stayed on the sea. And a wagon parked, stabled or following ashore was weighed against every hull | FIXED (WIND-FIRST, NO-PIXEL, CARGO-ASHORE, HEAVY-HINT) |

The screenshots behind the report were not handed over, so which of the two the reporter met is not known. Both are
fixed, and each one alone gives the report's words.

## WIND-FIRST and NO-PIXEL: a door lays its wind before it shows its boats (1)

`src/systems/comeSailAway/comeSailAway.js` (OnTransition, OnLoad, pixelOf, pixelUnderOn).

FOUND. Come Sail Away lays no wind indoors, and a door out lays the outdoors' wind in OnTransition (ComeSailAway.cs
1978-1985). The C# shows the boats first and lays the wind after. The boats' visibility reads each boat's map pixel,
and a boat with none threw there (`MapPixel.X` of null, the C#'s NullReferenceException, kept and pinned by
`csa_placing.test.js`). The host logs the throw and goes on (`world.js` csaCall), so the wind was never laid: the
indoors' none stood on the open sea. Measured on the real runtime, a Small Ship under sail 10 s from rest made 0.00
knots in a wind of 0, and the fix's made 20.86 in a wind of 1.5. The oars read no wind and rowed as ever.

That none outlives every door after it, since each exit throws again. OnLoad's SAIL-WIND check stood after the same
visibility, so a reload did not lay it either. The wind came back only on the game's next hour or a change of weather.
With no wind the wind widget points dead ahead and never turns with the ship - a player sees the wind behind them and
makes no way.

A boat gets no pixel where GetMapPixelFromTerrain answers none (a terrain the streamer no longer holds), and a record
saved so keeps it - its restore threw too, in SetBoatPositionAndDirection's map-pixel overload. A recentre's
OnPositionUpdate asks each boat's visibility, so every boat after her in the list kept the old frame's numbers.

THE LAW NOW. A door lays its wind before its boats are shown, and OnLoad checks SAIL-WIND's none before them too: the
wind reads no boat, so no boat can strand it. A boat with no pixel takes the pixel she stands on, read off the player's
terrain as `recoverLostBoats` reads one (`pixelUnderOn`, the one home of that sum now), else the player's own. Indoors
she takes the player's pixel. Port-Ledger A says so (WIND-FIRST, NO-PIXEL).

`tools/sailDrive.mjs` had judged only states with a wind already up, so a wind of nought outdoors was the one stop it
could not see. It judges every state with sails set outdoors now, may take a boat's pixel away, and logs a step that
throws and drives on, as the host does. Seed 7, 80 runs: on main 1 stop (the door threw, the wind `[0, 0, 0]`, 0 way),
on the fix none.

## CARGO-ASHORE: a wagon ashore is no ship's load (1)

`src/systems/comeSailAway/comeSailAway.js` (cargoLoad), `src/systems/horse/horseCart.js` (wagonWithPlayer),
`src/scenes/world.js` (the runtime's `entity.wagonWeight`).

FOUND. The cargo law (UpdateBoatCargoMod, ComeSailAway.cs 3820-3858) weighs the captain's body, pack and wagon
(Cargo.CartCarriedWeight, on by default) against the hull's hold, and at twice the hold she neither moves nor turns,
oars or sail. In DFU the wagon is always with its owner and holds 750 kg. Here Horse Cart and Cargo parks it at a door,
the Stable keeps it, a team follows on foot, and WAGONS1's Open Wagon holds 1,500 kg and the Caravan 2,000. Every one
of those loads weighed on every ship, wherever the wagon stood.

Measured, 120 kg carried, 15 s under sail from rest (m/s): a full Small Cart left the Rowboat and the Large Boat dead.
A full Open Wagon also cut the Small Ship from 9.72 to 1.99. A full Caravan stopped the Small Ship too and cut the Large
Galley from 4.86 to 2.28 and the Carrack from 11.66 to 5.48. The only word was three seconds mid-screen as the helm was
taken ("You're going to need a bigger boat"). It is the same law ETHER-STRAND read and could not reproduce
(`Field-Bugs-2026-10-12d.md` 4: "All other ships including rowboats were now non-functional").

THE LAW NOW. The wagon's load weighs on her only while the wagon is in its owner's keeping - Horse Cart and Cargo's
WithPlayer, not stabled. Parked, stabled or following on foot, it stays ashore. With the mod off the cart goes where
its owner goes, as in DFU. The host says the load aboard, so the runtime's law is the mod's line. Port-Ledger A says
so.

## HEAVY-HINT: the helm says a load that holds her, while it holds her (1)

`src/ui/enhanced/enhancedHelm.js` (helmHint, helmHeavyText - `helm.heavy`), the runtime's helmPanelState `heavy`.

While her load holds her to half her way or less (the cargo law's worse word), the helm panel's line says so under her
name, on a touch screen too: "Too heavy. Lighten your pack, your wagon or the hold". In irons is said first.

## The hosts

THE FOUR HOSTS. `scenes/world.js` holds the sea and the helm: wired (the wagon's seam). `scenes/exterior.js` FLAGGED
(it stands no Come Sail Away runtime), `scenes/worldModes.js` and `scenes/dungeonContext.js` raise the doors' events
and are unchanged - the order is the runtime's own. Every province alike: no law here reads a region or the Bay, and
the door's pin stands in Cyrodiil beside the Bay's.

## Pins

`test/systems/comeSailAway/fb1029b_sailing.test.js` (7): the report's door with a boat of no pixel, a Small Ship
sailing after it, and the same at the Imperial City's pixel past the Bay; a door whose boats throw still laying its wind; a load of a record with no pixel, and a load whose
boats throw; the Open Wagon's load ashore and aboard through the host's own line, run as the game runs it; Horse Cart
and Cargo's keeping (beside its owner, parked at a door, stabled); the helm's line. `csa_placing.test.js`'s C# throw re-aimed: a
boat with no pixel takes hers. `tools/mutants/fb1029b_sailing.json` (12, all dead).
