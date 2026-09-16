# MAC-K - Mac's play report, 2026-09-15

Three lines, verbatim:

> Known Issues:
>
> 1. Mouse keybindings not working properly
> 2. Logbook not reflecting quests
> 3. T to mount not working outside interiors

All three are fixed. **Two of them are the same defect wearing different
clothes**, and it is the one THE FOUR HOSTS rule exists to prevent: a
seam wired into three hosts and missing from the fourth, with a pin
aimed at one host's source text standing guard over it. A pin like that
cannot see the host that is missing.

## K1 - the mouse

Two causes, both of them real.

**The interior host never fed the buttons into its held-key set.**
AUDIT 39r found this exact bug and fixed three quarters of it: it put
`mouseCode(e.button)` into `keys` in `scenes/world.js`,
`scenes/exterior.js` and `scenes/dungeon.js`, and left
`scenes/worldModes.js` alone. That host calls `held(keys, 'AutoRun')`
every frame and `held(keys, 'ActivateCenterObject')` for the drawn
bow's un-draw, and **Mouse2 and Mouse0 are what those two are bound to
by default** - so both were dead in every interior in the game for the
whole arc.

**Neither controls skin could capture a mouse button at all.** DFU's
`WaitForKeyPress` is `Input.GetKeyDown` walked over every `KeyCode`,
and `Mouse0`/`Mouse1`/`Mouse2` are KeyCodes like any other - which is
how three of its own shipped defaults come to be mouse buttons. The
port's registry, its storage, its duplicate law and every runtime
reader had taken mouse codes since AUDIT 39r; the one door a player
uses listened for `keydown`. So no action could be **moved onto** a
button, and one cleared **off** a button could never be put back. The
row was there, the ✕ worked, and there was no way to fill it again.

The enhanced pane now arms both doors together and disarms both
together - a half-disarm is a listener outliving its screen, which is
its own bug - and the classic grid's pointer seam carries the button
index, which `scenes/townTalk.js` had always been passing and the grid
had been discarding.

*A fourth button is not a binding.* `mouseCode` answers null past the
third, and the capture stays armed rather than writing nothing and
going quiet, which would blank the row with no explanation.

## K2 - the logbook

`LogBook` is `InputManager`'s own name for the L key. It opens the
**chronicle**, and the chronicle had three sections - Notes, Messages,
History - none of which is a quest. All four hosts were handing the
door a `questMessages` function and `chronicleModel` never read it: a
dep in, nothing out, which is precisely the shape AUDIT-EOTB had spent
the previous day on.

It was written down as intent. `ui/chronicleDoor.js` carried a note
beginning *"QUESTS ARE NOT IN IT, and that is deliberate"*, and the
hosts each carried *"the two quest modes land on Notes because the
pause window has carried quests since PX4"*. The reasoning is sound
about **duplication** and wrong about **which door**: a player pressing
the key named after the job got their notebook.

The chronicle has a Quests section now, leading the four, and the
duplication the old note feared is answered where it actually lives:

- the **walk** (`{active, finished}` off the machine) is
  `scenes/questBridge.js`'s `questLog()`;
- the **rail** it builds is `ui/questRail.js`;
- both are shared with the pause window's Quests tab, so the two faces
  cannot disagree about which quests are live or what they say.

**There were four copies of that walk, not three.** `exterior.js`'s own
comment said *"world.js keeps two copies of this walk; two copies is
two laws the day one of them moves"* - and a derived pin, written
because the walk had moved, found a fourth in world.js's interior host
bag that none of the three had counted.

## K3 - the mount

`KeyT` resolves to `Transport` and `ui/input.js` routes that to
`ctx.openTransport`. Three hosts answered: `worldModes.js` and
`dungeonContext.js` with the indoor refusal line, `world.js` with the
real picker. `exterior.js` - the **fixed-city host, the one a player
walking round a town is in** - answered nothing, so the key did
nothing at all.

And it was not a missing one-liner. That host had **no transport
surface whatever**: it read `player.transportMode` (the activation
reach, the mounted water gate) and could never set it, with no
animator, no art and no sprite behind the key if it had been routed.

The surface is `player/mountRig.js` now rather than a second copy -
HARD2a did this for the activation race and HARD2c for the weapon
pose, and exterior.js's own quest walk had carried the reason in
writing until K2 collapsed it.

**The ship stays with the host.** It is not a mode you travel in
(DFU's own comment on the enum) - it is a teleport across a streaming
world, and this route stands in one city for its whole life. It hands
`onShip: null` and the picker's Ship row goes dark, which is the truth
rather than a button that does nothing.

## What the campaign taught the pins

24 mutants, 24 killed. Two of them survived their first pin and each
one named a class of weak assertion:

1. **A grep cannot tell a live branch from a dead one.** The classic
   grid's fix was pinned by matching its source text; a mutant that put
   the old `return true` back and left the new arm under `if (false)`
   walked past it. The grid is **driven** now - a real window, armed
   and clicked.
2. **A hand-written host list is a pin that cannot see the host that is
   missing.** The chronicle's section mapping was checked over
   `[world, dungeon]`, a pair written on a day when `exterior.js` had
   no journal - so reverting that host's mapping changed nothing any
   pin could see. It is the host the bug was reported from. The check
   is a derived population now, and the mapping is executed rather than
   matched.

Both are the same lesson this port keeps relearning under different
names: **a pin on the unit is not a pin on the wiring**, and a pin on
one host is not a pin on the rule.
