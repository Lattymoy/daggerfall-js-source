# Host Split

The hosts are functions that keep a whole scene's state in one scope: `bootWorld` (`src/scenes/world.js`),
`createWorldModes` (`src/scenes/worldModes.js`), `buildDungeonContext` (`src/scenes/dungeonContext.js`),
`bootExterior` (`src/scenes/exterior.js`), `createNavalHost` (`src/scenes/naval/navalHost.js`),
`createComeSailAwayRuntime` (`src/systems/comeSailAway/comeSailAway.js`), and the relay Room's `_message`
(`server/src/index.js`). Any member can read and write every other member's state, so nothing in them can be
imported, tested or reviewed alone, and every change lands in the same file. This page is how we stop them growing
and take them apart (Mac).

## Rules

- **The hosts do not grow (HOST-SPLIT).** New behaviour goes into a module the host wires. `src/scenes/fishHost.js`
  and `src/scenes/merchantYardsHost.js` are the shape: the module owns its state and its frame; the host constructs
  it once and calls it. The host's function gains the wiring, not the feature. On the relay, new code goes into a
  Room method of its own.
- **Each host has a ceiling.** `test/scenes/hostceiling.test.js` holds each host to its length in logical lines when
  measured, plus 400 (a fix's room, not a feature's). A logical line is a statement, an object or class entry, a
  switch case, or an arrow's implicit return (`tools/hostScope.mjs` `logicalLines`), so comments and layout weigh
  nothing.
- **A raise carries its reason.** A fix that truly cannot live elsewhere raises the ceiling, with the reason beside
  the row, in the same change.
- **A ceiling comes down with its host.** A change that moves code out lowers the ceiling in the same change. The
  suite fails a ceiling left more than 800 logical lines above its host.
- **New knots get ceilings.** Any outermost function in `src/` or `server/src/` past 2,400 logical lines must have a
  ceiling row; the walk reads every function shape.
- **The ceiling gates a change, never a deploy.** It holds on a pull request and on a contributor's machine. An
  overflow on main from two PRs landing together is the next PR's to fix.

## The map

`node tools/hostScope.mjs <host>` reads a host's scope. Each statement of the host's body is a member. For a member
or group it counts what the group reads from the host's scope, the host `let`s it writes (shared mutable state, the
hard part of a cut), and the members that use what it declares. Few writes and a small used-by make a cheap cut. It
matches names by spelling, so shadowing over-counts reads. Read the group before you move it.

## The method: move, don't rewrite

One group per change, behaviour unchanged:

1. **Read the map** for the group: its reads, writes and users.
2. **Move the code verbatim** into a module exporting a constructor that takes the host's handles (`createX(host)`).
   A `const`, a function nothing reassigns, or a `let` nothing reassigns is handed over as itself. A binding anyone
   writes is handed over live, as a getter (and setter) on the handles object, never a copy. A getter reads at the
   call, never at construction, so no name is touched inside its temporal dead zone.
3. **The pins move with the code.** A test that quotes the moved lines reads the new module instead, in the same
   change. A cite into the moved lines names the new file (`npm run cites -- --check`).
4. **Lower the ceiling** to the host's new length plus 400.
5. **Prove it**: lint, types, `npm run gates`, every test that reads the host or the module, and `tools/mutate.mjs`
   over the mutant lists that name the moved code. CI has no ARENA2, so Mac plays the change and runs `npm run perf`
   before it merges.

`node tools/hostMove.mjs` does step 2 and the mechanical half of step 3. It decides every name by the rules above,
writes the module and the host's construction, drops imports the host no longer reads, and re-aims every mutant
record and doc anchor that named the moved text. Test assertions that quote the moved code are moved by hand.

Where two or more hosts build the same thing, the moved module becomes its one construction seam (`Home.md`), and the
change names all four scene hosts, each wired or flagged.

## Open

- `bootWorld`'s `frame` comes apart by stage (input, simulation, network, render) once its callees have left.
- The online group (`onlineStart`, `chatStart`, `socialStart`, `onlineFrame`) writes dozens of the host's `let`s.
  Cutting it out is a redesign of who owns that state, not a move.
- The same work waits for `createWorldModes`, `buildDungeonContext`, `bootExterior` and the relay's `_message`.
- Three classes are past the knot size with their state on `this`: `Renderer`, `HeldMapWindow`, `OnlineSession`.
  Whether a class is a knot is the doctrine's call.
