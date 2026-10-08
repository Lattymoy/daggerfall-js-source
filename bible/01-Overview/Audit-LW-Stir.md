# AUDIT LW-STIR

## AUDIT LW-STIR - LW-STIR audited, 2026-10-08

Mac: *"Lets audit everything and ensure perfection"*, of LW-STIR (`06-Systems/Living-World.md`, Mac: "I say we improve
the living world and go deeper. Having spontaneous interactions, like a traveller being hostile with a guard and other
smaller details that make the world feel more alive") - the watch's word at the gate and on its rounds, the town's
quarrels, haggles and pleas, the street hushing and turning to look, its small voices. Five lenses on the head LW-STIR
left (`fe5c7ba4c`, frozen in a detached worktree so no fix moves under a verdict - Home.md, 17l): **the dealer's math
and laws** (A: `stir.js` and its words), **the street and every reader** (B: `livingTown.js`'s staging, the bodies, the
speech, the cost), **the plans and the hosts** (C: the `gate` stay, every reader of a plan, the four hosts, save and
load), **the pins' and the record's honesty** (D) and **the game's own towns** (E: every city of the freeware ARENA2 in
scratch) - five independent adversarial reviewers, never in the repository - and this session's own (F).

Every finding is reproduced before it is fixed. Every fix's pin fails on the code as it stood before it - proven by its
mutants (`tools/mutants/auditlwstir.json`), each the old line put back. Each change carries an `AUDIT LW-STIR` comment.
The lenses' findings are settled below as they are reproduced.

### Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F1 | Minor | **A stranger named a town of this one's own travels as their own.** The gate's and the watch's words ask where a stranger is from ("Hold there, traveller. From where?" - "{place}, and a long road it was"; "{b}, of {place}"), and `{place}` was the town's talk's own: one of the towns this town's people's trips were bound to (`lineCtx`'s `places`), picked by the incident's seed - a merchant come from Wayrest said "Daggerfall". | The gate's and the watch's `{place}` is the stranger's own town where the roads know it (`stir.js stirLine`'s `ctx.home`; `livingTown.js _homeOf`: a visitor's trip's home); a crew's, or one the roads do not name, the talk's as before; a quarrel's, a haggle's and a plea's the talk's. |

### Pins and mutants

`test/auditlwstir.test.js` (1) and `tools/mutants/auditlwstir.json` (3, all dead).
