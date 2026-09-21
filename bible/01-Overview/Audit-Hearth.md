# AUDIT HEARTH1 (2026-09-19) - four findings over the world's own fires

Mac: *"audit this"*, over the slice that had just shipped
(`06-Systems/Climates-Calories.md`, "The world's own fires"). The diff
read adversarially with one question in front: **what did this add that
nothing will notice is wrong?**

Four findings, all four fixed. Two of them are the same shape - a claim
the code made about itself that nobody had checked - and one of those
was a comment I had written to explain why an optimisation was
unnecessary.

---

## F1 (FIXED) - the world's fires ignored the mod's own switch

`survivalOn()` is the arc's one door, and the arc's own sentence is
**"off, every seam is DFU's."** `scenes/camps.js` reads that switch in
exactly two places - `restore` and `applyOwner` - and it never needed a
third, because of a property that held right up until this slice: **a
camp has to be PLACED.** With Climates & Calories off nothing can pitch
a tent or light a kit, so the pool is empty and every question about it
answers no by itself. The gate was implicit in the data.

A brazier is in the world whether the mod is on or not. So the moment
`byFire` and `targets()` started reading a pool that is not the camps',
the implicit gate stopped holding and nothing replaced it: **a fire bowl
answered the activation ray with a cooking list, and reported `byFire`
to a law nobody had turned on.** Both exterior hosts push
`camps.targets()` into their ray unconditionally, and so does the
dungeon, and so does the interior arm this slice added.

One gate, at the one door - `worldFires()`. It is the only place either
question reaches the host's list, so gating it closes both.

The pin **drives the preference** rather than grepping for the call: the
same live pool, the same fire, the switch flipped both ways, and the
answers - `byFire` and the ray's targets - checked on each side.

## F2 (FIXED) - `byFire` runs every frame, and both halves of it were built for a cadence nobody had checked

`byFire` is read through the host's `survivalEnv`, and that is called by
`playerTicker.tick(...)` - which runs **every frame**. It is the ticker,
not the caller, that decides whether a game minute has rolled. Two
things were built on the assumption that it ran on the minute:

**The question was the expensive one.** `byFire` asked `nearestHearth`,
which cannot stop early - it has to see every entry to know which is
nearest. But `byFire` does not want the nearest, it wants a yes. A big
city's lantern list is hundreds long, and it was being walked end to end
sixty times a second for a question whose answer was usually in the
first entry. `hearthNear` is the first-hit test, and the pin counts the
reads through a property getter: exactly ONE, where the answer is first.
It is also checked to agree with `nearestHearth` everywhere it is asked,
including on the closed bound.

**The streaming host minted a list a frame.** Its walk built an array
and an object per fire, every frame - the precise churn PERF-LIGHTS had
taken out of the lanterns two thousand lines below in the same file. And
the reason it was written that way is the part worth recording: the
comment said this ran "on the survival tick and the activation ray", so
"a pool for that would be bookkeeping bought with nothing." **The
sentence was sound and its premise was false.** The objects live in a
store now, refilled in place; the answer array's own length is set,
which frees nothing because the store still holds every object it made.

## F3 (FIXED) - the three hosts do not agree where a hearth IS, vertically

Each collector places its light where DFU's own `AddLight` puts it, and
that is a different height on the sprite in each case:

| host | the y it hands over | relative to the flat |
| --- | --- | --- |
| both exterior hosts | `-yPos * scale + size.h` | the **TOP** |
| the interior | `f.y + h/2 + offset` | the **centre**, plus a per-record offset |
| the dungeon | the flat's stored `y` | the **centre** (its own batch shifts down by `h/2` to find the base) |

None of that is worth normalising - each is right about where the
**light** is, which is the flame. But nothing said so, and the
activation box had been sized as though one convention held everywhere.
`BY_FIRE_REACH` is four metres and swallows the difference whole; the
box does not. It reaches a sprite's height DOWNWARD now and only a
little up, so a player aiming at the bowl under the flame is aiming at
the fire under either convention - and deliberately no further, because
a taller box starts eating clicks meant for whatever stands behind it.
The law states the table; the pin quotes all three collectors, so a host
that changes its convention fails here rather than in the field.

## F4 (FIXED) - the law's own collection was exported for its own test

`collectHearths` shipped exported and called by nothing but
`test/hearth1_worldfires.test.js`, while three hosts hand-wrote the test
it performs. The interior takes it now (it is the one host with a
ready-made list to filter), and a mutant that hand-writes the filter
again dies. The other three call `isHearthFlat` from inside a loop they
were already running, which is the same law at its one home.

---

## Checked and refuted

- **A cached interior would restore without its fires.**
  `restoreInteriorScene()` runs *after* `interiorCtx = ctx`, and the
  hearth fill sits between them, so every fresh context is filled before
  anything can restore over it.
- **Online.** A hearth is world geometry: every peer reads the same
  block and derives the same fires, there is no record and nothing to
  publish. `campAt` still answers with camps alone, which is what keeps
  the wire, the packing and the menu on a record a brazier does not
  have.
- **The interior pool could stand a camp.** It cannot: `place()` says
  `insideBuilding`, which is the camp law's own refusal, and it is
  handed no texture door to mount a fire with. Both halves pinned.

**15 pins, 33 mutants (33 dead, 0 survived).** Full check green.

**The lesson: two of the four were a sentence the code told me about
itself. "The camps never needed a switch here" was true of camps and
stopped being true the moment the pool held something nobody placed; "a
pool would be bookkeeping bought with nothing" was sound reasoning from
a cadence I had not measured. A comment that justifies an omission is a
claim, and it ages exactly as badly as the code it sits over.**
