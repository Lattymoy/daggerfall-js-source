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

It named one on its first run, and **the first answer to it was wrong** -
which turned out to be the most useful thing in the program so far.

`dungeonContext`'s hit-effects pool was read as a leak and given a
`hitEffects.clear()` in `destroy()`. AUDIT-HARD (2026-09-15) proved it
was not a leak and that the line was a DOUBLE FREE: the pool hands every
batch away as it is born (`onSpawn: (b) => billboardBatches.push(b)`),
that list is freed higher up the same teardown, and `clear()` retired
each live splash into a second `destroyBillboardBatch` of the same GL
handles. Benign only because deleting a deleted WebGL object is specified
as a no-op.

Three things came out of it, and all three are in the gate now:

1. **The three answers are EXCLUSIVE**, so a hand-off that is *also*
   ended by hand is its own failure - `hard1_ownership.test.js` says so.
2. **The ownership check was reading comments.** It asked "does a line in
   this teardown name the binding, and does it end it" - and a *sentence*
   answers both. The wrong fix stayed green while a comment explained why
   it was wrong. A gate a comment can switch off is worse than an
   enumeration: an enumeration only fails to grow. It reads code now.
3. **What misled the fix was a stale comment** in the host - "that list
   is the static layout art", true until HE1 wired the `onSpawn` and
   never corrected since.

The genuine leaks this slice is built on are AUDIT 66's F5, F6 and F8,
and the gate names all three without being told they exist.

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
- **The pins that moved all quoted the relocated text**, and one of them
  is behavioural, so the original "no behavioural pin moved" was too
  strong: `ht1_handheldtorches.test.js` pinned AUDIT 66 F7 with two
  assertions - the torch arm's comparison, and `_doorDist` being read
  ONCE - and the second had no line left to name once the door's distance
  became an argument to the race. The law is not lost: the race takes
  `doorDistance` once, and `hard2_activationrace.test.js` pins both the
  feeding and the losing-to-a-door. But the claim needed correcting, and
  AUDIT-HARD corrected it. `audit63_guilds_court.test.js`'s got strictly
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

### HARD4 - the vendored-work registry. SHIPPED 2026-09-15.

`01-Overview/Mod-Registry.md`, and `test/hard4_registry.test.js` behind
it. One row per directory under `vendor/`: what the port takes, the
upstream author and version, the bundle or commit it was read from, the
licence or permission, the port slice, the parity date and the bible
page - plus the known deviations, per row.

Derived like the rest. The row list comes off the FILESYSTEM, so a
fifteenth vendored work cannot arrive without one and a row cannot
outlive its directory. Every version and author cell is cross-checked
against the vendored `.dfmod.json` where one ships (seven of the fourteen
do), so a bundle refreshed to a new upstream version cannot drift from
its row while the port keeps working. Every row's bible page must exist,
and every vendor key the player can switch on in `systems/modSettings.js`
must be registered - a mod cannot become player-visible without its
provenance written down.

**What reading the fourteen together found.** The plan above guessed at
one unfilled permission line. There are **six**: `dynamic-skies`,
`handheld-torches`, `seasons-iliac-bay`, `pcaao`, `roads-hazelnut` and
`weapon-widget` each carry a literal `[Mac: paste the text of the
permission, or the link to it, here.]`, and each sits directly under a
sentence saying permission WAS granted, by a named author, on a dated
day.

That is a RECORD problem and not a licence one, and the registry says so
in as many words. Mac's word settles whether the port may carry the
files. What is missing is the evidence - the author's own message, or a
link to it - and one README at a time, nobody would ever see that the
same prompt had gone unanswered six times.

So those rows read `RECORD OPEN`, and the gate holds the mark and the
placeholder in step **in both directions**: drop the mark while the
README still prompts and it is red; fill a README in and leave the mark
and it is red too. All five of its failure modes were verified by
breaking the tree and restoring it.

One more surfaced as a row rather than a defect: PCAAO's port is built
from the shipped 1.44 bundle, decompiled, while the last single-file
source in its repository is 1.40. The README always said so. The registry
is where a maintainer would look.

**The generalisation, which is the point of the slice.** Everything this
program had found until now was a rule about CODE enforced by memory.
This one is a rule about the RECORD - write the permission down - and it
failed in exactly the same way, at a higher rate than any code rule
measured so far: six of the six times it applied.

### HARD5 - shrink Home.md into an index.

It is 288 KB and carries the architecture, the postmortems, the policy,
the changelog and the project index at once. The split is right, but note
what is attached before starting: a tool rewrites a section of it
(`regenOpenFlags.mjs`), and tests pin line numbers inside it. It is not a
pure documentation move.

## AUDIT-HARD, 2026-09-15 - the program audited against itself

Mac, before merging: "Lets audit this before merging." Nine findings over
HARD1-4, of which one was a defect in shipped code and three were holes in
the gates themselves. **Every gate hole is the same shape as the defects
the program was written to catch**, which is the finding that matters:

| # | where | what |
|---|---|---|
| B2 | `dungeonContext.destroy()` | **HARD1's first fix was a DOUBLE FREE.** The pool it named is a hand-off, not a leak. Proven by driving the real pool with a counting renderer: two live splashes, two frees each |
| A6 | `hard1_ownership` | the ownership check read **comments** - a sentence naming the binding and any ending verb satisfied it, which is how B2's wrong fix stayed green while explaining itself |
| A1 | `hard3_types` | the escape-hatch scan walked a hand-written list of `src/` subdirectories, one level deep, and had four blind spots (`characters/pieces`, `characters/rewrite`, `systems/quest`, `tools/paperdoll`) |
| A2 | `hard1_ownership` | the factory-homes map walked nine named directories; a miss made the declaration-expiry check **silently skip**, guarded by `if (home && ...)` |
| A4 | `hard3_types` | the save seam searched `src/systems` only, though the rule it states ("a module that knows the envelope's VERSION") names no directory |
| A5 | `hard3_types` | the contract-vs-factory walk read **5 of 8** fields (a regex that consumed the comma the next field needed), and pooled `@property` lines across all four typedefs, so `MeshBundle`'s `buffers` answered for the batch's |
| A3 | `hard2_activationrace` | the extraction's differential lived in a scratchpad and a commit message - a proof nobody could re-run |
| C1 | the records | "no behavioural pin moved" was too strong (see HARD2 above) |
| C2 | `hard3_types` | a comment said flipping `checkJs` produces 382 errors. It produces **2,451**; 382 was a two-file import closure measured early and written down as if it were the tree |

All nine are paid. The three enumerations are derived walks now, the
ownership check reads code, the differential is a pin that carries the old
arithmetic and runs it over all 32,805 inputs, and the contract walk sees
every field (mutation-verified: dropping any one of the eight turns it
red). B2's own lesson became a gate - **a hand-off must not also be ended
by hand** - which fails on the exact line that was wrong.

What to take from it: **a gate is code, and it rots the way code rots.**
This program's premise is that a derived rule beats a remembered one, and
that still holds - but "derived" is a claim about an implementation, and
four of these gates claimed it while quietly enumerating. The gates need
auditing on the same cycle as the port.

## CRASH1, 2026-09-15 - the first one a player found

Someone tried the deployed build and reported it plainly: *"had a lot of
javascript issues with regards to menu accessibility. Opening the logbook
and pressing L reliably causes the errors, as well as sometimes randomly
when trying to access the pause menu with escape. It looks like a
potentially cool project, but it certainly needs a lot of time to cook."*

**Both symptoms were one defect, and it is this program's own shape.**

`ui/chronicleDoor.js`'s enhanced window - the logbook, on the DEFAULT
skin - answered `onKey`/`onPointer`, a contract **nothing in this tree
reads**, and had no `input`. The hosts dereference `input` unguarded on
every key that maps to an action, and `ui/input.js`'s `overlayAction`
maps `'char:<k>'` for every letter, digit and space and `'back'` for
Escape. So with the logbook open, L threw - and so did the whole
alphabet, which is why it was "reliable" - and Escape threw, which is the
pause key, and is why that one looked "random": it needed the logbook to
be the window that happened to be up.

**Four sibling doors carry a comment describing this exact failure, word
for word.** `pauseDoor`, `inventoryDoor`, `charSheetDoor` and
`spellbookDoor` each hit it first and each wrote down what it cost - "a
missing arm is a TypeError thrown inside the host's keydown handler".
The rule was enforced in four files by whoever remembered to copy the
block, and the fifth door never got it.

That is the enumeration problem exactly, and it is worth being blunt
about what it means: **the program's own thesis was demonstrated on a
player.** HARD1-4 and two audits found and paid a dozen defects, and the
one that reached a human was a rule written in four comments and held by
none of them.

`test/crash1_overlay_contract.test.js` derives it: the door list comes
off `ui/`, every DOM-overlay window must answer `input`/`draw`/`close`/
`dispose`, the dead `onKey`/`onPointer` contract is banned outright, and
the ban re-checks that no host has started reading it. Mutation-verified
by restoring the original defect.

Two smaller things came with it. The window also had no `dispose`, so
`showOverlay`'s `outgoing?.dispose?.()` never removed its DOM node - a
second logbook press left the first one's div in the body with its Tab
registration live. And a sweep of every overlay-slot window in `ui/` and
`scenes/` confirms the chronicle was the only one missing the contract,
so "a lot of javascript issues" was one door, hit many ways.

## The standing rule this program adds

When an audit finds a defect, the fix is not finished when the defect is
gone. Ask what class it belongs to, and whether the tree can be made to
answer that question by itself. If it can, that gate is the fix and the
one-line repair is a detail of it.
