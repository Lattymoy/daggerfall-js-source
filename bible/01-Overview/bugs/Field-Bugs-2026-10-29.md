# FIELD BUGS 2026-10-29 - the phone's boot, the Starfall's master, the families' cap, the open sea and the boards

Five Discord reports and the owner's board change, handed over by the owner in a session. Read on main's `c1f7101c0`
with the freeware's data (`tools/fetch-data.sh`). The mutants are `tools/mutants/fb1029_fieldbugs.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Game fails to load on mobile website client" - iPhone, Safari and Chrome: "undefined is not a constructor (evaluating 'new YKt({woods:Dt,woodsBytes:pt})')" | A top-level await (FIRST-VISIT, 2026-10-28) made the world's graph async; WebKit before Safari 27 resolves a second `import()` of one before it runs | WEBKIT-TLA |
| 2 | "Falling Star Elite Boss Softlock" - an Unquiet Elite Daedra Lord ran off, became a revenant, and the event stuck on its master | A world boss could wear the mark and run; a master gone with no body was still the master | STAR-MASTER-FLED |

## The phone's boot (WEBKIT-TLA)

FOUND. The error names `new TerrainGenClient({ woods, woodsBytes })` in `bootWorld`. In the bundle the class is a
`var` of the world chunk, set by the chunk's body, and `bootWorld` is a hoisted function: it reads `undefined` only if
it runs before that body. It can only run from an `import()` that resolved, so one resolved before the chunk ran.
`firstVisitStore.js` read its generated pins with a top-level await, which makes every graph that imports it async,
and the front door imports the world twice - the menu's warm-up and Play. WebKit's own write-up says its old loader
resolves the second import of such a graph at once (WebKit bug 242740, fixed in Safari 27, which has not shipped).
Every browser on an iPhone is WebKit. Desktop Chromium was unaffected.

MEASURED. Of every chunk the build writes, only the store's and the two prototype pages' entries awaited at the top.
Playwright's WebKit 26.6 shows the old loader's order (three imports of an awaiting module resolve 1, 3, 2; Chromium 1,
2, 3) but did not throw on this machine, so the field's error was not reproduced here: the cause is read from the
bundle, the timeline (the await merged a day before the report) and WebKit's record.

FIXED. The store imports the pins and awaits nothing. Every install, build and dev load writes or serves them, so a
plain import always finds them. The dev server still works them out again for each page load: each page's HTML now
drops the pins module it served, in place of the store asking under a URL of the load's own
(`scripts/firstVisitPins.mjs`). `test/tree/toplevelawait.test.js` refuses a top-level await in any module another
imports - only a page's own entry may await.

## The Starfall's master (STAR-MASTER-FLED)

FOUND. "Falling Star" is the Starfall (`11-Multiplayer/Starfall.md`), and "Kill the X" its tracker's master line.
The master is stood an elite, and an elite of the street draws the Unquiet mark one time in four (`eliteFoes.js`
promoteEliteFoe). A marked foe breaks at 35% health on one roll in two and runs; out of reach it escapes - dead, no
body - and rises as a revenant (`exteriorFoes.js` escapeFoe). The star counts the master's fall only with a body, and
its re-stand (C4) ran only with no master in its slot, so the escaped one held the star at its master until dawn.

FIXED. A world boss is no revenant: `revenantCandidate`, the mark's gate, `isUnquiet` and `foeTitle` refuse
`entity.worldBoss`, so the master never runs, rises from no deed and wears no "Unquiet" (`06-Systems/Revenants.md`
section 51). And a master gone from the pool with no fall is no master: it is stood again whole, as C4 stands one that
never stood (`scenes/starfall/starfallHost.js` owner). Pinned through the real street pool
(`test/systems/revenant/auditunquiet.test.js`) and the host (`test/scenes/starfall/star5_host.test.js`).
