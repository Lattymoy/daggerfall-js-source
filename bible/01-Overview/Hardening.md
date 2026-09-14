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

### HARD2 - the host contract. FIRST SEAM SHIPPED 2026-09-14.

The four hosts are where the drift lives, and shrinking them is the
highest-leverage change available. It is also the riskiest thing in this
program, because a 1:1 port's behaviour is pinned by 7500 tests and its
value IS that behaviour. So the approach matters more than the appetite,
and these three rules are the approach:

- **Not a rewrite.** Move composition, never laws. A cross-cutting system
  should enter each host through one contract instead of each host
  remembering another argument.
- **Extract by seam, smallest first.** The activation ladder is the
  natural first: AUDIT 66 F7 was one host's copy of "nearest thing under
  the ray wins" missing a term the other copies had. Four copies of a law
  is four chances to omit a term.
- **Every extraction ends with the hosts' pins unchanged.** If a pin has
  to move, the extraction changed behaviour and is wrong.

**The activation race, shipped.** `src/player/activationRace.js` is the
one home for "the nearest thing under the one ray takes the click" - the
body against the pile, the torch against both and the door, and the two
rivals AUDIT 65 MC-2 split. It was written out by hand in both exterior
hosts, character for character, which is how F7 shipped a torch that had
to beat the pile but not the door. The hosts keep their ladders - the
ARMS are theirs, because what each does with a win differs - and ask who
won. `test/hard2_activationrace.test.js` pins the law directly and gates
against a third copy appearing.

Both rules held, and both were checked rather than asserted:

- A differential over 20,000 input combinations against the old inline
  arithmetic: **0 differ**.
- **No behavioural pin moved.** The only pins touched quoted the
  relocated text, and `audit63_guilds_court.test.js`'s got strictly
  STRONGER: it used to lift the line out of a host with `new Function`,
  because the law lived inline in two places and there was nothing to
  import. It now calls the law. A pin getting simpler at an extraction is
  the sign the extraction was real.

What the slice also taught, at its own cost: the extraction added one
import line per host, and moving every line below it cost more bookkeeping
than the code change itself. One pin (`hudlarge.test.js` D10) went red for
a reason that was never its law - it read "useFwd is built once, above the
ladder" as a fixed window of source lines, already widened from 60 to 80 by
two earlier audits. It reads the law now. **A pin that needs widening every
time the file grows is measuring the file, not the rule.**

Seams still open here: the two exterior hosts' draw ladders, the five-host
save envelope assembly, and the mode-transition teardown order. Each is
bigger than the race and each wants its own differential before it moves.

### HARD3 - types at the seams that crash. SHIPPED 2026-09-14.

Scoped, not repo-wide. The Weapon Widget crash was a shape mismatch at
the renderer boundary, and that boundary is where a wrong shape throws
rather than misbehaves. JSDoc plus `tsc --checkJs` over the renderer's
inputs, the save envelope and the wire protocol catches that class.

It was listed third deliberately, and the reason still stands: walking
AUDIT 66's twelve findings against a type checker, it catches
approximately none. Ordering, omission, placement, reachability and unit
convention are not shapes. Types are worth having at three boundaries.
They are not the answer to the measured failure mode, and buying them
first would have felt like progress while the actual defect distribution
went untouched.

**What shipped.** `tsconfig.json` with `checkJs: false`, `npm run types`
in `npm run check`, and `// @ts-check` on the first line of every seam
file. A file outside the seams is PARSED - the seams need their imports
for inference - and never reported.

The seam sets are DERIVED, which is what makes this a gate rather than a
list: every file in `render/`, every file in `net/`, and every `systems/`
module that knows `SAVE_VERSION`, because a module that knows the
envelope's version reads or writes the envelope. `test/hard3_types.test.js`
re-derives all three on every run, floor-checks each one so a refactor
cannot quietly empty it, and bans `@ts-ignore`, `@ts-expect-error` and
`@ts-nocheck` across `src/` with no allow-list. That last rule is the
load-bearing one. Twice in this slice a red line meant the TYPE I had
just written was wrong - a `Color32`'s view is not always 8-bit, and a
SaveTree record's `parsedData` is a union keyed by `recordType` - and a
hatch would have buried both findings under a silenced line.

`src/render/contract.js` is the renderer's side of it: `BillboardBatch`,
`MeshBundle`, `Color32` and `RendererLike`, types only, `export {}` so the
bundle never carries it. The gate holds its `BillboardBatch` against what
`createBillboardBatch` actually mints, field by field, so the contract
cannot drift from the factory.

**What it found.** Sixty-odd reported lines over three seams, which
sorted into four classes:

| class | what it was |
|---|---|
| a seam typed `{object}` | the dominant one, and the slice's whole thesis: the renderer, the batch, the record, the slot card |
| an undeclared field | lazily `??=`-minted scratch (`renderer`), and twelve uniform locations assigned through a string list (`precipitation`) |
| JSDoc that describes a different function | five `@param`s for one parameter; a `@returns` in prose; a type name no import resolved |
| a literal inferred from a default | `-1` becoming a variable's whole type, so every later assignment reads as a mistake |

Only the last is noise, and even it is answered by writing the true type
rather than by silencing anything. One was a defect in shipped code:
`classicSave.js`'s no-Character arm returned four of the five fields its
own `@returns` promises, so `goldPieces` reached the save envelope as
`undefined`. The one production caller throws before that arm can run, so
it is unreachable there - and reachable from any direct caller, which a
pin already is.

One was mine, one day old. HARD2's `activationRace.js` documented five
`@param`s for a function that takes one options bag, and gave each
`@returns` field a prose clause where its type belongs. Every line of it
described a signature the function does not have, and nothing but a
person had ever read it. **A contract nothing checks drifts from its code
at the speed the code changes**, which is the same sentence as HARD1's,
pointed at documentation instead of at teardown.

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
