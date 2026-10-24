# FIELD BUGS 2026-10-17c - The Orrery no one could turn

One post from the Discord's #general, handed over as a screenshot on 2026-10-17 with the words "In regards to the Elite
breaches". Read on the code at main's `6e01e4eae`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Boar, in #general: "Is this room bugged?", with a screenshot of an Elite Breach's Athenaeum. The HUD says "Turn the Orrery true. Stones true: 0 of 6 - fray 0", and the floor shows six gold rings with nothing standing on them. Lanxus/Leximus answered: "Yeah, i just kill my run there" | THE ASCENT (spec law 9) stands the Athenaeum's court 15-24 m off the 0 floor. The activation ray's handles for the six stones stayed at 1 m over 0 whatever the court's height, out of every reach, so no stone could be turned. The door opens only on a true Orrery, and Harriers rise every 15 s until it does | fixed (ORRERY-HEIGHT) |

## ORRERY-HEIGHT: a stone's handles over its own floor

`src/scenes/eliteGates/egSpan.js` (the circle's stand: the targets the activation ray is offered).

FOUND. An Athenaeum is the Orrery hall (`11-Multiplayer/Elite-Gates.md` section 8.4). The relay raises six `stone`
objects on its court, and the client draws each as a gold disc on the floor (`scenes/eliteGates/egFight.js` drawGround:
the screenshot's rings). Each stone is turned through two handles that EG-FULL's layer three gave the activation ray
(`Elite-Gates.md`, "the Athenaeum could not be solved"): boxes 0.7 m on a side, 0.9 m to each side of the stone and
1 m up. A press on one sends `pz`, and the relay judges the turn within 3.5 m of the stone in plan
(`net/eliteGates/egBrain.js`, case `pz`).

The handles' height was the literal `1.0`, measured from the realm's 0. Under laws 4-8 that was right, because those laws
lay the Athenaeum's court at 0 and its spots carry no height. THE ASCENT (spec law 9, 2026-10-16, the build's law since
EG_SPEC 9) lays a hall as a way that climbs and falls. The Athenaeum's court stands where the way has climbed to, and the
law says each spot's height in centimetres (`net/eliteGates/egLaw.js`: "a spot's `y` stays in centimetres"). The relay
reads it (`spotY`), so the stones and their rings stood on the court. `egSpan.js` is the only client code that reads a
hall's spots, and it never did. Measured over the first ten law 9 Athenaeums `egCirclePlan` finds in circles 2, 3, 5, 8 and 12 of
seeds 1-9: seven courts stand 16-23.6 m over 0, two stand 15.5 and 18.6 m under it, and one stands at 0. On a court at 23.6 m every handle stood 22.6 m under the player's feet, against a
reach of 3.2 m (`player/activate.js` DEFAULT_ACTIVATION_DISTANCE). The crosshair never named a stone, no press was sent, and
the lock stayed at 0 of 6. The hall's door opens only when the Orrery is true (`egBrain.js`, the Athenaeum's arm of the
hall's tick), and until then `ceil(n/4)` Harriers rise every 15 s. So the run could not go on.

Why no test saw it: `test/net/eliteGates/egfrag_client.test.js` counted each Athenaeum's handles and pressed one by its
key. It never asked where a handle stood.

DFU has no Spire, no Athenaeum and no Orrery. This is our own hall's code, so no DFU member or ledger row moves.

FIXED. Each handle stands a metre over its own stone's floor: the spot's centimetres in metres, or 0 where a law lays no
height. Laws 4-8 therefore stand their handles where they stood before. No law file changed. The relay's bundle, its
version and the wire are untouched, and so are the four hosts: `scenes/world.js`, `scenes/worldModes.js`,
`scenes/dungeonContext.js` (which reads `egSpan.targets()` as before) and `scenes/exterior.js` (offline, no breach).

Not changed: the stones are still a disc on the floor with their handles unseen until the crosshair names one ("Orrery
stone 3 - Turn it forward an hour"), as EG-FULL stood them. A drawn stone is a question for the hall's look, not this fix.

`test/scenes/eliteGates/fb1017c_orreryheight.test.js` (2): a law 9 Athenaeum off the 0 floor (seed 1, circle 11, its court at
23.2 m). The circle's collider holds a floor under every stone at the spot's height. The circle's span is stood, and each
stone's two handles have their boxes about the point a metre over that floor. The real pick
(`pickActivatableHit`, over the circle's own collider) finds each one from the eye of a body standing at its stone, inside
its reach. The same holds for a law 8 Athenaeum, handed over as a breach opened under law 8 hands over its halls, with its
handles a metre over 0.
The first test fails on main: the ray from the court finds no handle. `tools/mutants/fb1017c.json`: 3 mutants, all dead
(the handles back at 1 m over 0, the centimetres read as metres, and a spot with no height read as no number).
