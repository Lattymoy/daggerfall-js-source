# FIELD BUGS 2026-10-19d - the Gauntlet's slain Casters

> Renumbered at the merge of main: main's FIELD BUGS 2026-10-19, 19b and 19c took the earlier letters; the test and the
> mutant record were renamed with it (`fb1019d_`), and the relay's version moved past main's `world220`-`world224`.

One report from the Discord's #general (a screenshot Mac passed on), read on the code as it stands at main's
`d6f1a4453`. The hall is the port's own: the Rampart's Gauntlet variant (`11-Multiplayer/Elite-Gates.md` section 8.3,
EG19's THE SHADE PERILOUS). DFU has no Elite Breach, so there is no DFU member to depart from.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | TheHalfinStream: "our run is fucked", then "can't silence casters after killing them lol"; ABBA: "Bugged" | The Gauntlet's door waited on every pillar's plate being held 3 s. A Caster killed by blows took its body away but left its pillar not done, and no screen marks the plates, so "Casters left" stood where it stood and the door never gave | fixed (GAUNTLET-SLAIN) |

## GAUNTLET-SLAIN: a Caster slain is a Caster silenced

`src/net/eliteGates/egBrain.js` trialStep's Gauntlet.

THE REPORT. An Elite Breach company in a Gauntlet hall killed its Casters and could not go on. The trial's line says
*Silence the casters.* (`egLaw.js` EG_OBJECTIVES), and the HUD counts *Casters left: N* (`ui/eliteGates/egHud.js`,
from the relay's `pg.left`).

FOUND. At the wake each of `2 + ceil(n/2)` pillars raises a pinned Caster and keeps its id (`g.i`). The trial counted a
pillar done only when a member's pose stood within EG_TOUCH_M of its plate for EG_SILENCE_MS
(`egBrain.js:"const pl = g.p.plate, on = pl &&"`). A Caster is an add like any other: blows slay it
(`egBrain.js:"function addDied(B, F, spec, a, sub, mm, now, here, out) {"`) and its body leaves the fight. Its pillar's
entry did not change. The plate is a point in the hall's spec and nothing on the client draws it (`winchPlates` draws the Winch's
`spots.winch`; nothing reads a pillar spot's `plate` under `src/scenes` or `src/world`), so a company that answered *Silence the casters* with blades had no
way left to finish: the count stood and the door held.

CHANGED: a pillar whose Caster's body is gone, by any hand, is done
(`egBrain.js:"if (g.i && !egBodyById(F, g.i)) { g.done = 1;"`). The hall says *silenced* once for it, as the plate does,
"Casters left" falls on the next beat, and the last one opens the door. The plate still silences a living Caster as
before (its Caster crumbles), and a pillar whose Caster was never raised (`g.i` unset) still waits on its plate. A run
already stuck in a Gauntlet when this deploys finishes on the relay's next beat: its slain Casters' pillars read done.

THE RELAY. `egBrain.js` is in the relay's bundle, so `RELAY_VERSION` moves to `world225` (`world220` on its branch, renumbered past main's `world220`-`world224` at the merge) (`src/net/wire.js`, its row in
`test/net/relayversion.test.js`; no file joins the bundle). Deploy the relay before the clients, as every Elite Breach
change is: the client is unchanged.

NOT CHANGED, AND OPEN. The plates are still unmarked on the screen. With a kill now counting, the plate is the way
round a Caster rather than the only way through, so marking it is a later slice's: a ground mark in
`scenes/eliteGates/egFight.js` beside the Winch's (`egFight.js:"function winchPlates(F, t) {"`, FB1018D WINCH-PLATES),
while a pillar is not done.

Pins: `test/net/eliteGates/fb1019d_gauntletslain.test.js` (2) - over the real relay (egBreachNew, egEnter, egStep,
egBlow) in seed 1's first Gauntlet in spec law 10. Mutants: `tools/mutants/fb1019d_gauntletslain.json` (3, all dead).
