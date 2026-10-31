# src/scenes

**HOST-SPLIT: the hosts do not grow** (`bible/01-Overview/Host-Split.md`). Never add behaviour to `bootWorld`,
`createWorldModes`, `buildDungeonContext`, `bootExterior`, `createNavalHost` or `createComeSailAwayRuntime`. Put it
in a module the host wires: `fishHost.js` is the shape. On the relay (`server/src/index.js`), add a Room method of its
own, never code in `_message`.

`test/scenes/hostceiling.test.js` fails a host that grows past its ceiling in logical lines (statements and entries,
so splitting a crowded line costs nothing). `node tools/hostScope.mjs <host>` maps what a block reads and writes
before you move it.

Many tests read these hosts as source text. A change here moves most of the suite, so run the change's own tests and
leave the rest to CI.
