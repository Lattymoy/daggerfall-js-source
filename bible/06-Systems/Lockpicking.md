# Lockpicking

Picking a lock is a minigame with a Lockpick item. In Steal mode at a locked dungeon door, building front door, chest
or crate, the player opens a window showing the lock in cross-section and sets each pin at the shear line; a slip can
snap the pick. Daggerfall's own chance becomes the lock's tolerance, and an Auto attempt keeps Daggerfall's roll. The
window opens on both skins, offline and online.

## How it works

### The Lockpick

Template `LOCKPICK_TEMPLATE` (584, `src/systems/lockpick/lockpickRow.js`; `lockpickItem.js`): a light, cheap, stackable
miscellany item with its own picture painted in code (`lockpickArt.js`). Without one in the pack a lock says "You need
a lockpick to pick this lock." and nothing is rolled or spent. Where it comes from:

- every General Store and Pawn Shop keeps a stack of `ENDLESS_LOCKPICK_STACK` (`src/systems/shopStock.js`), stood after
  DFU's draws; online a purchase is restocked, offline it sells out until the day's restock;
- a class with Lockpicking as a primary, major or minor skill starts with `LOCKPICK_KIT`, and an older character gets the
  same once on load;
- rogues carry a few (`ROGUE_LOCKPICKS`, an enemy loot extra).

### The tumblers (`src/systems/lockpick/lockpickLaw.js`, `lockpickAct.js`)

- **The lock.** Pins grow with the lock's value (`pinsFor`, two to six); spool pins appear on harder locks
  (`spoolsFor`). The order pins bind in is the lock's own, seeded by its name (`lockSeed`, `bindingOrder`), the same each
  visit and on every client.
- **A press lifts or sets.** Pressing a pin at rest lifts it. The binding pin rises heavily to the shear line, hangs,
  and falls back; any other pin springs straight back. Pressing the binding pin while it hangs sets it, and the next pin
  binds. A spool pin false-sets the first time and must be set again.
- **DFU's chance is the tolerance.** How long the binding pin hangs grows with DFU's chance for that site
  (`setWindowS`: interior formula underground, exterior at a front door), scaled by Agility. From Lockpicking 50 the
  binding pin is shown before it is lifted.
- **Mistakes cost.** A press off the hang slips and may snap the pick (`slipBreakChance`, from the chance DFU would
  fail); if it holds, the last set pin drops. Lifting a pin that is not binding can also snap it. A snap drops every pin.
- **Auto attempt** is DFU's roll itself (`autoOpens`): the lock opens, or a pick snaps.
- **The skill** is tallied once per attempt, which ends in a snap or an open.

### The window

`src/ui/lockpickWindow.js` and `src/ui/lockpickDoor.js`: a DOM window on the overlay stack, styled by the enhanced kit
and its own sheet on the classic skin. Its head names what is being picked and DFU's look-at line for the lock. The lock
is drawn on a canvas; under it, the last press's words, picks left, pins set, the skill, and the Auto attempt and Leave
presses. Leaving costs nothing.

### Where

`src/scenes/lockpickHost.js` `createLockpickHost` is the one home. `src/scenes/worldModes.js` uses it at a building's
front door (and a door a Lock spell locked), `src/scenes/dungeonContext.js` at a dungeon door and a locked chest or
crate. A lock of 20 or more stays magically held, as DFU's. An opened dungeon door goes out on the shared change seam, so
peers see it open.

## Rules

- A lock needs a Lockpick, and a snapped pick is spent (the owner).
- The roll is played: DFU's chance is the window; the Auto attempt keeps DFU's odds.
- A watching hand can beat DFU's odds; a blind rhythm cannot.
- The hosts do not grow: the host module wires where the roll stood, and `createWorldModes` and `buildDungeonContext`
  stay under their ceilings (HOST-SPLIT).

## Daggerfall Unity

DFU rolls once (`DaggerfallActionDoor.AttemptLockpicking` underground, `PlayerActivate.ActivateStaticDoor` at a front
door) with no item, and gates a retry on `FailedSkillLevel` and `PlayerGPS.LastLockpickAttempt`. Departures: the item
and its spending; the roll played as a minigame; the retry gates not read for a played lock (a snapped pick is the cost
of a retry; both fields still ride the save); the tally once per attempt; DFU's failure line not said for a played lock.
The magic arm and the Thieves Guild break-in tally (`isBrokenIn`) are DFU's.

## Code and tests

- `src/systems/lockpick/` - the item, the law, the act, the art, the sounds
- `src/scenes/lockpickHost.js` - the host module
- `src/ui/lockpickWindow.js`, `src/ui/lockpickDoor.js` - the window
- `test/systems/lockpick/lockpick.test.js` - the law and the item
- `test/systems/lockpick/lockpick_audit.test.js` - no blind rhythm opens a lock, at every Agility band
- `test/systems/lockpick/lockpick_door.test.js` - the hosts' doors
- `test/systems/lockpick/lockpick_ui.test.js` - the window

## Open

- No crime for being seen picking; no lockpick quality; a building's own doors stay unlockable.
- The world goes on while the window is open online; a foe can reach a picker.
