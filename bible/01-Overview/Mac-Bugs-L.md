# MAC-L — four reports out of the Discord, 2026-09-16

The `#bug-reports` channel, verbatim:

> **bigdaddywetwet** — also it appears that something causes spells to
> disappear from the spellbook
>
> **dycaite** — getting this when i press escape indoors (when playing
> thru the website)
> ```
> CRASH (10)
> TypeError: can't access property "at", w is null
>   togglePause@https://daggerfalljs.dev/assets/main-C_DM3ji_.js:45:23550
>   tm@https://daggerfalljs.dev/assets/travel-CjT9Xt8q.js:2985:114093
>   rP@https://daggerfalljs.dev/assets/travel-CjT9Xt8q.js:2985:113860
>   x6/<@https://daggerfalljs.dev/assets/main-C_DM3ji_.js:45:25862
> ```
> oh... actually, it's also happening outdoors now too
>
> **Orion** — Talking to a banker crashes the game. Also right click in
> general seems to cause either a new window to open, or for the page to
> refresh to the menu, causing unsaved progress to be lost.

`main-C_DM3ji_` is **`ff0cb3b`** — the commit AUDIT-MACK shipped. One of
these was written by that fix.

---

## L1 — Escape threw the session away

**The stack names the whole path.** `rP` → `tm` → `togglePause`, with
`rP`/`tm` in the travel chunk and the frames either side in main: the
host's keydown listener, into `ui/input.js`'s `routeKey` → `routeAction`,
into a host's pause door. Two faults met there.

### The first: THE FOUR HOSTS declared two signatures

| host | declared |
|---|---|
| `scenes/world.js` | `togglePause(opts = {})` |
| `scenes/exterior.js` | `togglePause(opts = {})` |
| `scenes/worldModes.js` | `togglePause(opts = {})` |
| `scenes/dungeonContext.js` | `togglePause(setPlayerPos = null, opts = {})` |

`routeAction`'s Escape arm spelt it **the odd one's way** —
`ctx.togglePause(setPlayerPos)` — so on the other three the first
argument, meant to be the options, was whatever the key router had for a
position applier.

*A positional pair three callers spell one way and one spells the other
is not a contract, it is a coin toss.* There is one shape now, an
options object with `setPlayerPos` inside it, and the gate reads all four
declarations out of the tree rather than listing them.

### The second: `opts = {}` does not defend against `null`

A default parameter fires on `undefined` **alone**. `routeAction`'s own
default for `setPlayerPos` is `null`, so the hosts got a hard null and
`opts.at` threw. `ui/pauseDoor.js`'s `pauseOpts` is the one reader now
and `?? {}` is the whole of it — a mutant proved the `typeof === 'object'`
screen beside it inert, because reading `.at` off a function is
`undefined` exactly as it is off `{}`.

### And the fall-through was not the tail

AUDIT-MACK's own fix wrote `routeAction`'s fall-through **above**
`world.js`'s Escape arm. So the table claimed Escape first and the
ladder's own arm — the one that passes no options and could never have
crashed — was unreachable. **That is how the signature fault reached a
player at all.**

*A tail that is not last is not a tail; it is an arm that silently
outranks every arm below it.* The pin gates the POSITION now, not the
presence: no named `act === …` arm may follow the fall-through.

### L1b — a shadow, found inside the first fault

`togglePause`'s parameter was called `opts`. So was
`buildDungeonContext`'s host bag. The parameter **shadowed** the bag, and
three arms inside that method read `opts.questBridge` and `opts.relock` —
which meant they read the method's own argument. **The dungeon pause
screen's Quests tab has always answered an empty list, and the resume
gesture's relock has always been a no-op.** Both looked wired.

This is the same shadow class AUDIT-CHATR F1 found in `ui/chatPanel.js`
**one day earlier**, in a second file. Two shadows, two silent dead
features, in two days. `no-shadow` is off for `src/`; it names this bug
by name. That is no longer a measurement, it is a queue.

---

## L2 — talking to a banker: **not reproduced**

No stack trace, no repro. What was checked and cleared:

- the window contract (`CRASH2`'s derived gate is green, and every
  unguarded host call — `draw`, `hover` — is guarded or answered);
- `MerchantServiceWindow`'s three arms, its draw, and its art gate;
- the bank window's own tests (63 pins, green).

**The most likely explanation is that this IS L1.** The banker's panel
is the only NPC surface that opens a two-button popup, a player leaves it
with Escape, and the next Escape on the same build is the crash above.
That is a hypothesis, not a finding, and it is written here as one.

What is owed: the crash overlay prints a stack — dycaite screenshotted
one — so **the next report of this should carry it**. Worth noting the
overlay is `pointer-events: none`, so a player cannot select the text to
paste it; a copy affordance would pay for itself.

---

## L3 — right click escaped the game, twice over

### The browser menu was a rule kept in four places out of seventeen

The right button is a **weapon** control here — classic Daggerfall swings
by dragging it — and every streaming host suppressed `contextmenu` **on
its canvas** for that reason. The canvas is not the play surface.
**Thirteen** surfaces are appended to `document.body` and exactly **two**
suppressed it themselves, so right-clicking the pause screen, the pack,
the spellbook, the talk window or the character sheet opened the
browser's menu over the game.

*A rule enforced by thirteen copies is a rule enforced by memory.* One
capture-phase listener on the document now, installed by the hosts and
idempotent, with **text entry excepted** — the chat field and the online
name field are real inputs and a player must be able to paste.

### And the port had no unload guard at all

Not one `beforeunload` in the tree. Every way out of a running game was
silent and instant: a gesture the browser reads as Back (which a page
that suppresses `contextmenu` makes *more* likely, because nothing
absorbs the press), the Back button, a trackpad swipe, Ctrl-W, the wrong
tab closed. Any of them and the save is whatever it was an hour ago.

So the fix is not to chase the gesture — there are too many and they are
the browser's — but to put one door in front of all of them.
`systems/unloadGuard.js` does that, and it does **not** try to save on
the way out: `beforeunload` gives no time for async work and a corrupt
slot is worse than a stale one.

**Many arms, one answer.** The first cut held a single predicate and the
last host to arm silently replaced the first one's — the world host's
honest *has the player spawned* overwritten by a mode machine's *yes*.
The same shape as L1's one name for two meanings, caught in the same
hour. Every arm stands on its own now and any `true` is a `true`.
`exitToTitleMenu` stands them all down **before** it navigates, because
prompting a player for the door they just pressed trains them to click
through the prompt that matters.

---

## L4 — the spells were deleted by a `.filter(Boolean)`

A **stock** spell travels in a save as its bare `SPELLS.STD` index — a
number — and resolving it needs `spellsByIndex`. The restore walked:

```js
entity.spells = (snap.spells ?? []).map((s) => (
  typeof s === 'object' && s !== null ? s : (spellsByIndex ? spellsByIndex.get(s) : null))).filter(Boolean);
```

`scenes/world.js` fires `loadMagicRegistries` at boot and does **not**
await it — correct, because every other consumer is a later frame — so
for the first seconds of a session that table is `null`. **A quickload in
that window resolved every stock spell to `null`, the filter swept them
all, and the next save wrote the emptied list back.** Silently, and
permanently. Made spells survived, because they carry their whole record;
which is exactly the shape of "*something* causes spells to disappear."

Two locks, because one of them is a promise and a promise is a thing a
future host can forget to await:

1. **The host waits for the table it reads a save with.** The boot keeps
   the promise, and the load arm awaits it before `restorePlayer`. That
   is the race, and that is where it is fixed.
2. **A restore may not destroy what it cannot read.** An entry this
   function cannot resolve is now **held** in its saved form,
   `snapshotPlayer` writes it back out beside the resolved ones, and
   `resolvePendingSpells` picks it up when a table arrives. A save that
   passes through a host with no `SPELLS.STD` comes out whole.

*`.filter(Boolean)` is a fine way to drop a blank. It is a terrible way
to handle a lookup miss, because by the time the filter runs the two are
indistinguishable — and the cost of confusing them here is a player's
spellbook.*

---

## The campaign

**20 mutants against the four fixes, 20 killed** — one after the dead
`typeof` screen it exposed was deleted rather than defended.

## The standing lesson

Three of the four findings are one of two eslint rules the tree already
applies to `server/src` and does not apply to `src`:

| fault | the rule that names it |
|---|---|
| L1b, the dungeon's shadowed host bag | `no-shadow` |
| AUDIT-CHATR F1, the shadowed `hidden` | `no-shadow` |
| AUDIT-CHATR F4, the dead import | `no-unused-vars` |

## Not seen on a GPU

Every fix here is driven in node. **The one that most needs a human is
L2**, which is not a fix: talk to a banker on the new build and, if it
still dies, send the crash text rather than a description.
