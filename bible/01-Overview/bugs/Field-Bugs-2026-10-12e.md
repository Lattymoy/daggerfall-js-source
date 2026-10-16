# FIELD BUGS 2026-10-12e - the watch that vanished where it stood

One report from the owner, 2026-10-12, read on the code as it stands at main's `2f7d18b77`: "I notice sometimes guards
will spawn randomly to attack nearby enemies in towns and then despawn". Asked what the guards should do - keep the
feature as it is, change how they come and go, or take it off by default - the answer was "Walk in, walk off": keep the
feature, and stop the guards popping in and out.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "guards will spawn randomly to attack nearby enemies in towns and then despawn" | THE WATCH DEFENDS THE TOWN (DISC19-F). The guards arrive by DFU's own laws: a street guard is turned where he stands, or else 2-5 are placed just outside the view. But the town stood them down by deleting them on the spot, wherever the player was looking | fixed (WATCH-LEAVES) |

## WATCH-LEAVES: the defenders walk off (1)

`src/scenes/cityGuards.js` dismissDefenders, recallDefender, defenderCount, enlistDefender, summonDefenders,
standDefender, update, DEFENDER_LEAVE_LEG_SECONDS, `viewYaw`; `src/systems/town/townPopulation.js` popAllowChange;
`src/systems/livingWorld/livingTown.js` `_hidden`; `src/systems/raidingParties.js` spawn; `src/scenes/world.js` the guard
pool's `viewYaw`.

FOUND. The player saw THE WATCH DEFENDS THE TOWN at work (DISC19-F, `01-Overview/bugs/Field-Bugs-2026-09-24.md`, the
Features row `town-watch`, on by default). When a monster hunts the player inside a town (or hunts a defender, a
companion, or one of the living world's townspeople), the watch comes after Random.Range(5, 11) seconds.

The arrival is the crime response's own, and it is out of sight. A street guard within 77.5 of the player is turned
where he stands, and the walker and the watchman wear the same art (texture 399). With none in range, 2-5 are placed
through FoeSpawner's PlaceFoeFreely with its line-of-sight flag, which puts them just outside the field of view, 12.8-51.2
away (SPAWNER_ARMS.cityGuards). Then they run in. That arrival is what the report calls the "spawn".

The departure was not out of sight. Ten quiet seconds after the fight, the town stands the squad down, and
`dismissDefenders` did that with `g.dead = true`. That is the crime watch's despawn (EnemyEntity.cs:184-191): DFU runs it
for the watch a crime raised, and the port had lent it to this squad. Every defender left the world on that frame,
wherever he stood, whether the player was watching or not. The feature's own note promises the guard "comes to help, then
leaves once it's safe", but nothing in the code walked anywhere. That was the "despawn".

FIXED. A defender who is stood down now walks off. He leaves the world only where a street walker would be allowed to.
- **The stand-down** (`cityGuards.js:"function dismissDefenders() {"`). He is marked `leaving` and his target is taken,
  because his fight is over. He is no longer counted (`defenderCount`), so the town watch decides only on the defenders
  still standing.
- **The walk** (`cityGuards.js:"if (g.leaving) {"`). He walks away from the player's feet with EnemyAI.flee,
  WERE-FRIGHT's run at the watch's own gait, through the same capsule, obstacle and detour probes as a pursuit. Each leg
  lasts DEFENDER_LEAVE_LEG_SECONDS (3) and is aimed from where the player stands when it begins. He swings at nobody: he
  has no target, so a blow his brain still held at the stand-down has nothing to land on. (TACT2's forced swing, which
  breakWindup keeps outside a wind-up, would otherwise have struck the player beside him.)
- **Gone only out of sight.** He leaves the world only where DFU's PopulationManager lets any walker come or go:
  UpdateMobiles' allowChange, which is beyond allowVisiblePopRange (120) or outside the player's 180-degree forward view.
  He leaves no body. The law has one home now, `townPopulation.js:"export function popAllowChange("`. The street's pool
  and the living town (`_hidden`) each carried their own copy, and now read it as the guard pool does. A host that hands
  the pool no yaw has only the distance term to go by. Measured on the real pool and motor: a defender watched the whole
  way walks about 4.9 m/s and leaves the world at 120.06 m. If the player turns away, he leaves on that frame.
- **Set upon.** A monster that comes for him on his way hands him a target, whether by its blow
  (MakeEnemyHostileToAttacker) or by its pick (EnemySenses' recruit, EnemySenses.cs:403-407); the walk itself never does.
  He stops and fights it, still stood down, and walks on once it is gone. A target he already held at the stand-down
  went with his fight, so a monster merely passing by stops nobody. Whether he is the town's answer again is the town
  watch's word, never his: the first cut turned him back into a counted defender on the blow, and when the watch was
  dismissing outright (the player out of town, the switch off, a transformed lycanthrope) it stood him down again the
  same frame, turning him to and fro at every blow.
- **Called back.** The next summons calls the walking squad back before a street guard is turned or a new one is placed,
  and sends each man at the threat nearest him (`cityGuards.js:"for (const g of guards) if (!g.dead && g.leaving) {"`).
  A monster on a defender is the town's threat (AUDIT DISC19 W1), so one set upon in town is called back by the
  watch's own countdown. A raid's defender is called back the same way, before one is minted (`standDefender`), and the
  raid's list holds him once, not twice (`raidingParties.js:"if (!_live.some((e) => e.foe === foe)) _live.push("`). A
  crime enlists him where he walks (`enlistDefender`).
- **The living world** (`livingWatch.js` watchStep, unchanged). A turned defender's resident stays lent while he walks
  off. Once he is gone, the resident is back to their day, stood by the census out of the player's sight like any other
  resident. A walk never kills or slays them.
- **The four hosts.** `scenes/world.js` - WIRED: `viewYaw: () => cam.yaw`, the same yaw its street's population is
  handed. `scenes/exterior.js` - FLAGGED as DISC19-F has it: the fixed-city page runs no town watch, so no defender ever
  stands there, and its pool hands no yaw. `scenes/worldModes.js` - none: the interior watch never stands a defender,
  because summonDefenders and standDefender refuse indoors. `scenes/dungeonContext.js` - no watch.

NOT CHANGED. The crime watch's despawn is DFU's EnemyEntity.Update and stays: the watch a crime raised still leaves the
moment the crime clears. The arrival is DFU's: the conversion in place, and the placement outside the view. Defenders
are still not saved.

RECORDED, NOT BUILT. Online, a peer sees my defenders as puppets on the watch's stream. A walk-off hides the leaving
from me, not from them: a defender leaves my world when I can no longer see him, and the peer's puppet goes with his
record wherever that peer is looking. The crime watch's despawn has the same shape. Hiding it from every player in the
room would need the watch's frame to carry each reader's view, which it does not.

Pinned by `test/systems/fb1012e_watchleaves.test.js` (11) - the stand-down, the walk, the held swing, out of sight, set upon,
the call backs, a crime, the living resident, the town watch's frame end to end, the raid's list, the one law, the host -
and `tools/mutants/fb1012e_watchleaves.json` (25, all dead). Four older records named text this moved and were re-aimed
by content and run again, all dead: `disc19.json` DISC19-F-dismiss-leaves-a-body (the walk-off's removal),
`lwtalk.json` LW-TALK-hidden-no-range and -no-view (popAllowChange), `werefright.json` WERE-FRIGHT-fleers-still-target. Two older pins asserted the vanish (`dismissDefenders()` then
`dead`) and were re-aimed to the walk-off: DISC19-F's in `test/systems/disc19.test.js` and FB0929's in
`test/scenes/fb0929_raidguards.test.js`. AUDIT 24's lifetime pin (`test/scenes/audit24_lifetimes.test.js`), which read the defenders'
walk-away freeing its batch, now reads the walk-off's end doing so. Not seen in a browser.
