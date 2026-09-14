# The hardening program (HARD, 2026-09-14)

Mac: "I really want to focus on making everything clean, hardened and not
spaghetti. Refactor where absolutely needed and make it the best that it
can be. I think i want to take a break of additions and do this right."

This page is the plan and the running record. It exists because the
project has a measured failure mode, and adding features is no longer the
most valuable thing that can be done to it.

## What the evidence says the problem is

Not the language, and not the arithmetic. AUDIT 66 read one mod port -
one author, one day, a green gate - and found twelve defects with this
distribution:

| kind | count |
|---|---|
| arithmetic (a wrong number) | 1 |
| clocks (a law reading the wrong time source) | 2 |
| lifetime and seam (who ends this, in what order, in which host) | 9 |

`Port-Status-2026-09-02.md` reached the same conclusion from a much wider
sample: the data and formula translation is faithful, and what remains is
"a correct law with a broken seam, a missing dependency, a stale value, a
mismatched object shape, or a lifecycle registration problem."

The shape of that is worth stating plainly. **A correct system delivered
incorrectly by its caller.** Three structural facts make it the dominant
mode here:

1. **Four hosts.** Every cross-cutting system is wired four or five
   times, by hand, into host files of 566, 493, 387 and 292 KB. HT1 wired
   one pool into five hosts and got three of them wrong, in three
   different ways, on the same day.
2. **Unity was the mod's teardown list.** A MonoBehaviour dies with its
   GameObject. A `createX()` closure in this port dies when somebody
   remembers it. Nothing in the language reminds them.
3. **The rules exist, in prose.** "EVERY ALLOCATION HAS AN OWNER" is
   written in eighteen places. The torch pool was missing from a teardown
   list with that sentence in a comment four lines above it.

## The principle the program works by

**A rule enforced by an enumeration is a rule enforced by memory.**

This tree has 626 test files that read source text, which is a real
strength - but most of them pin the defects an audit found rather than
the rule the audit learned. `audit24_lifetimes.test.js` is the clearest
case: it gates the five leaks AUDIT 24 found, and it could not see the
sixth, which arrived two audits later and shipped green.

So every slice of this program converts a remembered rule into a derived
one. A derived gate reads the source, finds every site the rule applies
to, and fails closed on the ones that have not been decided. It protects
the future, not the past.

## The slices

### HARD1 - the lifetime gate, generative. SHIPPED 2026-09-14.

`test/hard1_ownership.test.js`. Reads each session-lifetime context,
finds every thing it builds through a factory, and requires each one to
be ended on EVERY one of that context's teardown paths - or declared,
with a sentence, as one of two things: it holds nothing, or it hands what
it holds to a named owner. Both kinds of declaration are re-checked
against the source, so a factory that later grows a resource turns the
gate red instead of the memory of whoever wrote the line.

Three properties make it fail closed:

- **The context list is derived too.** Any `destroy()` in `scenes/` that
  frees a GPU batch is a session-lifetime context by definition and must
  be registered, so a fifth context cannot arrive unnoticed.
- **Teardown paths are plural.** A context declares all of its ways out,
  and every pool must be ended on each. This is exactly AUDIT 66 F6: a
  pool that had joined the door's exit list and not the forced exit's.
- **Declarations expire.** A binding that is no longer built, or a
  hand-off whose other half was deleted, fails the gate.

Put the three known leaks back and it names all three without being told
they exist (AUDIT 66 F5, F6, and the one below).

It found one on its first run, in code that predates the torches by
months: `dungeonContext`'s hit-effects pool mints a billboard batch per
blood splash, and that context's teardown never retired them, while the
interior host has called `clear()` on its own copy of the same pool since
HE1. One line.

### HARD2 - the host contract. NEXT, and the one that needs a decision.

The four hosts are where the drift lives, and shrinking them is the
highest-leverage change available. It is also the riskiest thing in this
program, because a 1:1 port's behaviour is pinned by 7500 tests and its
value IS that behaviour. So the approach matters more than the appetite:

- **Not a rewrite.** Move composition, never laws. A cross-cutting system
  should enter each host through one contract instead of each host
  remembering another argument.
- **Extract by seam, smallest first.** The activation ladder is the
  natural first: AUDIT 66 F7 was one host's copy of "nearest thing under
  the ray wins" missing a term the other copies had. Four copies of a law
  is four chances to omit a term.
- **Every extraction ends with the hosts' pins unchanged.** If a pin has
  to move, the extraction changed behaviour and is wrong.

### HARD3 - types at the seams that crash.

Scoped, not repo-wide. The Weapon Widget crash was a shape mismatch at
the renderer boundary, and that boundary is where a wrong shape throws
rather than misbehaves. JSDoc plus `tsc --checkJs` over the renderer's
inputs, the save envelope and the wire protocol would catch that class.

It is listed third deliberately. Walking AUDIT 66's twelve findings
against a type checker, it catches approximately none: ordering,
omission, placement, reachability and unit convention are not shapes.
Types are worth having at three boundaries. They are not the answer to
the measured failure mode, and buying them first would feel like progress
while the actual defect distribution went untouched.

### HARD4 - the mod-port registry.

One row per vendored mod: upstream mod and version, the source commit or
bundle it was read from, permission and licence, the port's own version,
the date of the last parity check, and the known deviations. Today that
lives in a README sentence per mod, which is why Handheld Torches'
permission line is still an unfilled placeholder and an upstream enum it
depends on could not be verified. A registry makes both visible.

### HARD5 - shrink Home.md into an index.

It is 288 KB and carries the architecture, the postmortems, the policy,
the changelog and the project index at once. The split is right, but note
what is attached before starting: a tool rewrites a section of it
(`regenOpenFlags.mjs`), and tests pin line numbers inside it. It is not a
pure documentation move.

## The standing rule this program adds

When an audit finds a defect, the fix is not finished when the defect is
gone. Ask what class it belongs to, and whether the tree can be made to
answer that question by itself. If it can, that gate is the fix and the
one-line repair is a detail of it.
