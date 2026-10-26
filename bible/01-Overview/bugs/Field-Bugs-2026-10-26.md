# FIELD BUGS 2026-10-26 - a Redoubt's spoils that could not be picked up

One report, from a player's write-up of the Elite Breach (Discord, through the owner): "I also have been experiencing a
bug where I can't pick up any of the loot, and I have to leave the breach and claim 20+ pieces through the mailbox."
Read on main's `dc57127dd`. The pins are `test/scenes/eliteGates/fb1026_breachspoils.test.js`, the mutants
`tools/mutants/fb1026_breachspoils.json` (3, all dead). Not seen in a live breach: the circle's stand, the pool's own
target shape and the real pick run in the pins, the press's road from the mode machine to the pool does not.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "I can't pick up any of the loot, and I have to leave the breach and claim 20+ pieces through the mailbox" | EG-E throws a Redoubt's spoils into the Hour's pool and routes the press there (`world.js:"const floorPool = () =>"`), but a breach's hall never stood their targets: the Hour (`worldModes.js:"function standSdRealm(ctx) {"`), the court (`gateStand.js`) and the Ketch (`ketchDeckHost.js`) each register the floor's pieces with the context's one activation list and name them; `standEgHall` registered only the way home. The pieces were drawn and lit, and the ray never met one - no name under the crosshair, nothing for the press. Each lay until the next Redoubt's throw or the way out mailed it (LOST-SPOILS, `Accounts-And-Cloud-Saves-Arc.md`), so a run's spoils all reached the player by post | BREACH-SPOILS |

## BREACH-SPOILS (1) - `src/scenes/eliteGates/egCircleHost.js`

No DFU member: the Spire and its spoils are DFO's own (`11-Multiplayer/Elite-Gates.md`), so no Ledger row is owed.

THE CHANGE: `standEgHall` stands the floor's spoils as the Hour stands them - the outer host's live targets
(`egCircleHost.js:"ctx.addActivationTargets(() => host.spoilTargets?.() ?? NO_TARGETS);"`) and a namer for the `spoil`
keys before the way home's. The press already took a `spoil` key to the pool (`worldModes.js:"if (key.startsWith('spoil')) {"`),
so nothing else moves. THE SWAP stands a new circle in the same context, which keeps both doors; a step out and in again
builds a new context, and its stand registers them again.

Why it was missed: EG-E's record names `worldModes.js` "FLAGGED: nothing to wire" (`Elite-Gates.md`, EG-E's four hosts);
the routing it wired in `world.js` is right, and the context's half was never written. The pins of that routing
(`sd9e_spoils.test.js`, `wb9f_gate_spoils.test.js`) read `floorPool`, and the registration pins read the Hour's and the
court's stands - none read a breach hall's. Four Spire tests stood `standEgHall` on a fake context with no
`addActivationTargets`; each fake carries one now.

**The four hosts.**

- `src/scenes/world.js` - WIRED already: `floorPool`, `spoilTargets`, `spoilName`, `takeSpoil`; unchanged.
- `src/scenes/worldModes.js` - WIRED already: the press's `spoil` rung; the hall's stand is the circle's module it constructs.
- `src/scenes/dungeonContext.js` - unchanged: `addActivationTargets` is the seam.
- `src/scenes/exterior.js` - FLAGGED: offline, no breach.
