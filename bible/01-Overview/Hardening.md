# Hardening: derived gates

Hardening is how the tree holds a rule by itself, not by memory. The project's common defect is a correct system
delivered wrongly by its caller: a missed teardown, a host's copy of a law missing a term, a window missing a method
its host calls. A gate that lists the cases it knows protects the past. A derived gate reads the source, finds every
site the rule covers, and fails on any site not yet decided. The player never sees this page's work directly: it keeps
crashes and leaks out of every host.

## How it works

Each gate below derives its population from the tree, checks every member, and asserts its own coverage. A floor or
a parse failure goes red; nothing is skipped in silence.

- **Lifetimes.** `test/scenes/hard1_ownership.test.js` reads each session-lifetime context
  (`src/scenes/dungeonContext.js`, `src/scenes/hostMagic.js`, `src/scenes/worldModes.js`). Every thing a context
  builds through a factory must be ended on every teardown path, declared resource-free with a reason, or declared
  handed off to a named owner. The three answers exclude each other. A declaration whose binding or hand-off is gone fails. Any `destroy()` under
  `src/scenes/` that frees a GPU batch must be a registered context.
- **One activation race.** `src/player/activationRace.js` `raceActivation` and `raceWinner` decide which thing under
  the ray takes the click. The hosts keep their own arms and ask the race who won.
  `test/scenes/hard2_activationrace.test.js` fails on a hand-rolled copy in any host.
- **One weapon pose pair.** `src/combat/playerWeapon.js` `weaponPoseOf`, `applyWeaponPose` and `mergeWeaponPose`
  save and restore the sheath and the hand together. `test/combat/hard2c_weaponpose.test.js` walks `src/` and fails on
  a host that spells the pair out again.
- **Types at the seams.** `test/systems/save/hard3_types.test.js` derives three seams: every file under `src/render/`,
  every file under `src/net/`, and every module that knows `SAVE_VERSION`. Each must open with `// @ts-check`, and
  `npm run types` checks them. `tsconfig.json` keeps `checkJs` false, so the opt-in is the scope. `@ts-ignore`,
  `@ts-expect-error` and `@ts-nocheck` are banned across `src/`. `src/render/contract.js` holds the renderer's types,
  and the gate holds them to the shapes the renderer makes.
- **Vendored work.** `test/systems/hard4_registry.test.js` reads `vendor/` and requires one row per directory in
  `bible/01-Overview/Mod-Registry.md`. A row's version and author must match the vendored `.dfmod.json`. A row
  whose `vendor/<dir>/README.md` still asks for the permission text must read `RECORD OPEN`, and the mark goes when
  the text is filled.
  Every mod a player can switch on must be registered.
- **Window contract.** `test/windowContract.mjs` reads the hosts that own a window stack and derives which methods
  they call unguarded (`input`, `draw`, `tick` where the host calls it) and which windows can reach a slot.
  `test/ui/crash2_window_contract.test.js` checks every door against those methods and fails on a door it cannot
  parse. `test/ui/crash1_overlay_contract.test.js` bans the dead `onKey`/`onPointer` contract.
- **The bible index.** `test/bibleIndex.mjs` derives the index from `bible/Home.md` and the pages its stubs hand off
  to, so an index gate cannot pass vacuously when a section moves.

## Rules

- When an audit finds a defect, the fix is not done when the defect is gone. Name its class and, where the tree can
  answer it, add the gate that does. That gate is the fix.
- Derive a gate's population from the source. A list typed into a gate is a rule held by memory.
- A gate asserts its own coverage. A case it cannot read is a failure, never a skip.
- A gate reads code, not comments. A sentence naming a binding does not end it.
- A gate is code and is audited like code.
- An extraction moves composition, never laws. If a behaviour pin has to move, the extraction changed behaviour.
- A pin reads a function as a unit, never a fixed window of source lines.
- New behaviour goes into a module a host wires, not into the host (HOST-SPLIT, `bible/01-Overview/Host-Split.md`).

## Daggerfall Unity

DFU frees a component with its GameObject. A `createX()` closure here ends only when its owner ends it, which is why
the lifetime gate exists. DFU's `SerializablePlayer.cs` writes and restores the weapon's sheath and hand as one pair,
and `src/combat/playerWeapon.js` keeps them as one pair for the same reason.

## Code and tests

- `test/scenes/hard1_ownership.test.js` - every built thing ended, declared, or handed off
- `test/scenes/hard2_activationrace.test.js` - the race's law, and no second copy
- `test/combat/hard2c_weaponpose.test.js` - the pose pair against `SerializablePlayer.cs`, and no host copy
- `test/systems/save/hard3_types.test.js` - the three seams opt in, no escape hatches, the renderer contract
- `test/systems/hard4_registry.test.js` - the vendored-work registry
- `test/windowContract.mjs`, `test/ui/crash1_overlay_contract.test.js`, `test/ui/crash2_window_contract.test.js` - the
  host and window contract
- `test/bibleIndex.mjs` - the derived bible index
