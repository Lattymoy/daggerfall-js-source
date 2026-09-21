# MAC-K - Mac's play report, 2026-09-15

Three lines, verbatim:

> Known Issues:
>
> 1. Mouse keybindings not working properly
> 2. Logbook not reflecting quests
> 3. T to mount not working outside interiors

All three are fixed. **AUDIT-MACK, the same day, found that the first
attempt had not fixed one of them and had invented another**: the T key
was still dead after MAC-K3, and MAC-K1's first cause was a
misdiagnosis. Both are below, under their own findings, and the whole
page is written after that audit rather than before it.

## K1 - the mouse

**One cause, not the two MAC-K claimed.**

The first claim was that the interior host never fed the buttons into
its held-key set - that AUDIT 39r had fixed `world.js`, `exterior.js`
and `dungeon.js` and left `worldModes.js` starved, so every mouse-bound
action was dead indoors. **AUDIT-MACK F2 found that false.**
`worldModes.js` does not OWN a held-key Set: it takes `keys` off the
host bag (`exterior.js:3435` and world.js's twin), and the lender's own
mousedown writes `keys.add(mouseCode(e.button))` **before any mode
gate**, on a listener that is never removed. The codes were always
there. AUDIT 39r was complete; MAC-K1 read its wording as a gap and
added a second writer to a Set that already had one - idempotent,
harmless, and a second law for one fact. It has been removed, and the
pin that stood for it is the real invariant now: one feeder per Set,
every reader on a fed one.

**What was actually broken: neither controls skin could capture a mouse
button at all.** DFU's
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
walking round a town is in** - answered nothing.

**AND THAT WAS NOT THE WHOLE BUG.** MAC-K3 hung `openTransport` on that
host's `hudCtx`, pinned that the door was there, and shipped. The door
WAS there and the T key still did nothing, because `routeAction` - the
only thing that dispatches `Transport` onto that door - is reached
through `routeKey`, and **neither outdoor host calls it.** Both route
their own keys through hand-written ladders, and those ladders carried
arms for five of `routeAction`'s ten actions. `Transport`, `Status`,
`UseMagicItem` and the two mode cycles had none, in either host, ever.

Nothing looked broken from the inside: the door answered when called,
and the large HUD's transport panel - which reaches `routeAction`
directly - opened the picker. Only the KEY was missing. AUDIT-MACK F1
found it, and the tail of each ladder is the TABLE now rather than a
list someone maintains: any action the arms above did not claim goes to
`routeAction` with that host's own ctx, exactly as `routeKey` would.
**A pin on the door is not a pin on the key.**

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

## AUDIT-MACK - the audit of the fix

Mac asked for one the same day. Three findings, all of them against
MAC-K itself.

**F1 - the reported bug was not fixed.** MAC-K3 built the fixed-city
host's mount surface and hung `openTransport` on its ctx. The T key
still did nothing, because neither outdoor host calls `routeKey` and
their hand-written ladders never carried a `Transport` arm. Four other
actions were in the same hole. The tail of both ladders is
`routeAction` now, and the gate is the **click/key asymmetry**: a host
that routes the large HUD's panels through `routeAction` must route its
keys through it too. Stated that way it needs no list of hosts and no
model of which file owns which ctx.

**F2 - one of the two causes claimed for K1 was not real.** Written up
in the K1 section above. The correction matters more than the code
change: the fix was a no-op either way, but the record said something
false about AUDIT 39r and about what a player was experiencing.

**F3 - a silent no-op, introduced by the fix.** MAC-K3 shipped `let
mountRig = null` in `world.js` with `mountRig?.setMode(mode)`. The
`?.` read like a guard against the build order and guarded nothing -
the rig is built unconditionally at the top level of the same function
and every caller is in a closure that cannot run first. What it did do
was turn a broken build order into a player quietly staying on foot
through a loaded save, the Test Room's ride and the ship's landing.
`exterior.js` already had the loud shape; two hosts with two spellings
of one seam is how they drift.

**Campaign:** 24 + 30 mutants, all killed. Two of the second batch
taught the pins something again - a pin can redden on its own prose (a
comment naming the thing it replaced), and a regex anchor can be
unpinned because every case in the fixture happens to satisfy it
anyway.

**And the lesson under F1 is the one worth keeping.** MAC-K was itself
written to fix a class of bug - a seam wired in three hosts and missing
from the fourth - and it made a fresh instance of the same class while
doing so, one layer up. The door is not the key; the key is not the
route; the route is not the host. Each of those is a place a pin can
stop short of a player.
