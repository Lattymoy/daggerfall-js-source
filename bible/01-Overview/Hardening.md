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

**The weapon pose pair, shipped (HARD2c, 2026-09-15).** The second seam,
and the smallest of the three that were open. DFU writes the sheath and
the hand as ONE pair and restores them as ONE pair -
`SerializablePlayer.cs:175-176` and `:420-421` - and the port had that
pair written out by hand in three hosts and read back in three more.
**AUDIT 63 F25 is what four copies of a two-line law cost**: the port
carried only the first of the two lines, so a player fighting with the
left-hand weapon loaded back holding the right hand's item, or bare
fists. By the time it was found, the two restore lines had drifted six
and thirteen lines apart inside their own hosts, and the comment in
`worldModes.js` that pointed between them cited `world.js:5394` and
`dungeonContext.js:5826` - lines that had moved to `:4701` and `:5809`.
*Three copies of a rule, and the signpost between them stale as well.*

The pair lives in `src/combat/playerWeapon.js` now - `weaponPoseOf`,
`applyWeaponPose`, `mergeWeaponPose` - beside `usingRightHandFromSaveVars`,
the CLASSIC-save half of the very same law, which was already kept there
"so the law and its citation live with the hand". The hosts keep their
rigs, because which rig is in the player's hands genuinely differs per
host; only the arithmetic moved.

Both HARD2 rules held, and both were checked rather than asserted:

- **Two exhaustive differentials** carrying the old inline arithmetic
  verbatim - 76 compose cases and 84 restore cases over every shape a
  pose field has arrived in (set either way, absent, and both spellings
  of "nothing here"): **0 differ**. The compose differential includes
  `world.js`'s deliberate PER-FIELD `??` merge, which is defensive
  against a mode host answering a partial bag and is not the same thing
  as picking the bag whole.
- **Two behavioural pins moved, and both got stronger.** `audit26
  F222` and `audit63 F25` quoted the two lines character for character
  in each host - which is exactly the shape that let F25 lose one of
  them, and *a pin that quotes four copies cannot tell you they agree*.
  They run the law now and match only the WIRING: which rig each host
  offers, and that `world.js` lands the pair in the interior rig as well
  because DFU has one manager. `audit63`'s `new Function` mount of
  `worldModes`' two seams survives intact and is now handed the real law
  instead of a re-typed copy - the same "a pin getting simpler at an
  extraction is the sign the extraction was real" that HARD2a recorded.

`test/hard2c_weaponpose.test.js` pins the law directly and gates against
a fourth inline copy appearing.

**A correction to this page.** The line that used to sit here called the
next seam "the five-host save envelope assembly". That was wrong: only
`world.js` and `dungeonContext.js` call `snapshotPlayer`, and
`composeSessionState` had already extracted the quest+talk half at B4.
Counting hosts that *touch* saving is not the same as counting hosts that
*assemble the envelope*, and the record should not have overstated a seam
it was ranking.

**The last two seams, audited (HARD2-S1/S2, 2026-09-15) - and NEITHER
justifies an extraction.** A reason before a differential. Both were read
for the drift this program's thesis predicts, and both came back clean;
the honest result of an audit is sometimes that the work is not owed.

**S1 - the two exterior hosts' draw ladders. THE HOSTS ARE NOT PEERS,
and the record never said so.** `main.js:95` routes `?exterior`,
`?region` and `?loc` to `bootExterior`; the front door (`main.js:213`)
boots `bootWorld`. main.js says it in its own words: *"Dev scenes stay
one param away (?exterior/?world/etc)."* So this is a shipping ladder
against a dev scene's ladder, not two live copies of one law - which is
what made AUDIT 66 F7 worth paying, because both of ITS copies were
reachable in play.

Read anyway, derived: 352 distinct calls in `world.js`'s frame against
285 in `exterior.js`'s, 225 method names shared. Everything `world.js`
has and `exterior.js` lacks is the streaming host's own (terrain pixels,
riding, online peers). Everything `exterior.js` has and `world.js` lacks
is a `?rig`/`?rigNear`/`?shot` probe rig, its own `refreshSeason` - whose
streaming twin `tickSeason` is documented AND cites `refreshSeason` by
name at `world.js:417` - and two math helpers in the shot path. **No
drift.**

**S2 - the mode-transition teardown order. Three candidate findings, all
three collapsed on verification.**

1. *"`forceExitToExterior` is missing six of `tryExit`'s terms."* It is
   not. I had read a 25-line window of it; `unleveledLootPreTransition`,
   `cacheInteriorScene`, `host.onInteriorLeave`, `_intShared = null` and
   `questBridge.onExteriorTransition` are all there, above and below that
   window. **The function is the unit, not a window of lines** - the same
   error the HARD2c guard pass made an hour earlier, and the same one
   HARD2a's D10 pin was re-aimed for. Three times now; it is written
   down here so the fourth time is cheaper.
2. *"`npcSession.onWorldChanged()` is on both door exits and not on the
   teleport/load path."* True, and correct: every caller of
   `forceExitToExterior` follows it with `_teleportToPixel`, and THAT
   function owns the call (`world.js:4390`, DFU's `OnMapPixelChanged` /
   `OnLoadEvent`). The quickload caller goes through
   `restoreSessionState` instead. Calling it in both places would be the
   redundancy, not the fix.
3. *"`worldModes.js:8384` disposes the dungeon overlay that
   `dungeonCtx.destroy()` disposes again - HARD1's double free."* Already
   known, already written down, at `dungeonContext.js:6485-6486`:
   *"dispose() is idempotent (A2), which is what makes the outer host's
   call harmless."* The tree had the answer before the audit asked.

The one measured drift this seam ever had - AUDIT 66 F6,
`interiorTorches.destroyAll()` being *"the one that never joined this
list"* - was paid when it was found.

**So HARD2 rests here for now.** Two seams shipped (the activation race,
the weapon pose pair), both with a defect behind them. The two that
remain have no defect behind them, one is not even between peers, and
extracting on principle is how a 1:1 port loses behaviour it is pinned to
keep. They come back the day something is found in them.

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

### HARD5 - Home.md back to an index. SHIPPED 2026-09-15.

It was 291 KB and carried the architecture, the postmortems, the policy,
the changelog and the project index at once. **It is 30 KB now.** Two
sections were 254 KB of it and each has its own page:

| section | was | now |
| --- | --- | --- |
| `## Active arcs` | 172 KB in **89 lines** - an index whose entries had grown into essays | `01-Overview/Active-Arcs.md` |
| `## Audits` | 82 KB in 1,386 lines | `01-Overview/Audit-Log.md` |

**Both moves are byte for byte, and nothing was re-worded in them.** A
rewrite and a relocation in one commit is a diff nobody can read.
Shortening Active-Arcs' essay-length entries into real index lines is its
own later pass, and it needs each linked page read first to be sure the
summary is not the only place something is written down; each delegate
page says so in its own header, and a gate checks that it does.

**THE WARNING ON THIS PAGE WAS HALF WRONG, AND THAT IS THE FINDING.** It
said two things were attached: *"a tool rewrites a section of it
(`regenOpenFlags.mjs`), and tests pin line numbers inside it."*

- The tool is real. Its section, `## Open flags`, **stayed in Home.md**
  for exactly that reason - `regenOpenFlags.mjs` finds it by heading in
  that file, and `citedrift.test.js` and `flagsites.test.js` read the
  list there too.
- **The line-number pins do not exist.** Not one test indexes Home.md by
  line. The line numbers those tests handle are the ones INSIDE each
  open-flag entry, pointing at `src/` - a different thing entirely.

That is the second stale claim found on this page in one day; the first
was "the five-host save envelope assembly", which is two hosts. So:
**a warning is a claim, and an unchecked warning rots exactly like an
unchecked citation.** Both are now checked rather than believed - if a
line-number pin into Home.md is ever added, `hard5_index.test.js` goes
red and the warning becomes true and earns its place back.

**The real attachment was the one the record did not name.** Four gates
ask *"does Home.md name every record under `01-Overview/`, every arc plan
under `bible/`"* - and a split breaks all four while the index stays
complete. They were asking about THE INDEX, not about a file.

And behind those sits the hazard worth carrying forward:

> A `doesNotMatch(read('bible/Home.md'), ...)` pin says *"this stale
> claim is gone"*. Move the section it guards to another page and the pin
> goes **vacuously true** - it passes for ever, for the wrong reason, and
> nothing goes red. Three such pins were live when this split landed.

`test/bibleIndex.mjs` is the answer: the index is **derived** - Home.md,
plus every page Home.md's own stubs hand off to. A delegate cannot join
in silence (it has to be written into Home.md to count) and a stub naming
a page that is not there throws rather than quietly shrinking what the
gates read. The four index gates and the three negative pins read it now.

`test/hard5_index.test.js` holds the rest: a ceiling on Home.md's size so
it cannot grow back into an everything-page, a check that no section
exists twice across the index (a relocation that leaves the original
behind is worse than none - two texts, one edited and one read), the
ban on negative pins aimed at one page, the reason `## Open flags` stayed,
and the pin on the warning above. Mutation-verified three ways.

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

## CRASH2, 2026-09-15 - the gate CRASH1 shipped, audited

CRASH1 ended with a gate, and the standing rule below says the gate *is*
the fix. So the gate was read the way any other claim gets read. It was
wrong three ways, and every one of them is the failure it existed to
prevent.

**F1 - it read five doors of eight, in silence.** Its block finder
matched `return {` alone. `ui/pauseDoor.js` and `ui/inventoryDoor.js`
name the object (`const overlay = { ... }`) before handing it over, and
`ui/travelMapDoor.js` returns classes - so all three were skipped and the
suite went green over a claim that covered five of eight doors. One of
the two skipped doors is the pause menu, which is half of what the player
reported. **A gate that skips in silence is worse than no gate**: it
spends the credibility of a green suite on a check it never ran.

**F2 - its arm list was typed by hand, and wrong in both directions.**
The door list derived; the four arm names did not. It demanded `close`,
which no host has ever called on a slot - the hosts free a window with
`dispose?.()` - so that requirement was invented, and it passed only
because the one door lacking `close` was also the one being skipped. And
it omitted `tick`, which `interior.js:366` calls unguarded **every
frame**.

**F3 - it assumed the population was `ui/*Door.js`.** It is not. Twelve
window classes are constructed straight into a host slot, and
`townTalk.js:1122` paints every *covered* window as well
(`eachCoveredWindow((w) => w.draw(...))`), so depth is in the contract
too, not just the top of the stack.

### What the contract actually is

Read off the four hosts that own a window stack, scoped to the enclosing
function rather than a fixed lookback (the first pass used four lines and
mis-read `townTalk.js:1209` as unguarded; its guard sits eight lines up -
HARD2's D10 pin was re-aimed for the same reason):

| arm | required by | note |
| --- | --- | --- |
| `input` | townTalk, interior, dungeonContext | unguarded at 6 sites |
| `draw` | all four, plus every covered window | unguarded at 5 sites |
| `tick` | interior alone | `:361`, every frame |
| `hover`, `pointer`, `keyup`, `click`, `clickNative` | - | the host tests before calling: optional by design |

**The arms are not uniform, and pretending otherwise would have been a
false red six times over.** `ActionTextBox`, `ChoiceWindow`,
`ListPickerWindow`, `TalkWindow`, `TransportWindow` and
`MerchantServiceWindow` answer no `tick` at all. What makes `interior.js`
safe is not that its window happens to have one: it is that its slot can
hold exactly one class, written as a literal at the push site. So the
gate pins **that** - the closedness - and the day a second window is
wired into that host, the pin names the arms it now owes.

### The gates now

`test/windowContract.mjs` is the single derivation - hosts, slots, arms,
populations - and both gates ask it rather than each other. A second copy
of a rule is a second thing to keep in step, which is the whole failure
mode.

- `test/crash2_window_contract.test.js` derives the arms from the hosts,
  pins F2 in both directions so it cannot come back, checks every DOM
  door against the open hosts' arms, pins `interior.js`'s closed
  population, and **asserts its own coverage**: a door it cannot parse is
  a failure, never a skip.
- `test/crash1_overlay_contract.test.js` keeps what is genuinely this
  crash's - the named chronicle regression, the dead-contract ban, and
  the key map that made the report read the way it did.

Mutation-verified three ways: restoring CRASH1's narrow finder reddens
the coverage test; removing `input` from `pauseDoor` (the door CRASH1
skipped) reddens the arm test; guarding `interior.js`'s `tick` call
reddens the derivation test.

**No second live crash was found.** Every window that can reach a host
slot answers the arms that host calls. The finding here is about the
gate, not the game - which is the point: CRASH1's repair was sound and
its *guarantee* was not, and only reading the guarantee the way we read
the code could tell the difference.

## AUDIT-176, 2026-09-15 - HARD2c, the seam audit and HARD5, read before merging

Mac, again: "Audit and merge." Three findings over the branch's three
commits, and **two of them are in my own new gates** - which is the
result AUDIT-HARD predicted when it said a gate is code and rots like
code.

| # | where | what |
|---|---|---|
| A176-1 | `weaponPoseOf` | **the extraction changed one error path, and a comment claimed a reliance that does not exist.** The inline arithmetic dereferenced the rig unguarded, so a null rig THREW at the save; the extracted version returns null and the bag silently omits the pair, which a presence-gated restore reads as "leave the live hand". Quieter, and quieter is worse. The comment said callers use the null arm to mean "this mode has no rig"; no caller does - worldModes answers that with its own ternary |
| A176-2 | `hard2c_weaponpose` | **the no-fourth-copy gate named three hosts BY HAND.** A copy in a fourth host - `exterior.js`, say - would not have been seen. It walks `src/` now, and the mutation proves it: a copy planted in `exterior.js` reddens it |
| A176-3 | `hard5_index` | the negative-pin scan read ONE line, so the same pin formatted across two - `assert.doesNotMatch(` on one, the path on the next - walked straight past it. Two-line window now, and what it still cannot see (a pin reaching Home.md through a variable) is stated rather than papered over |

All three are paid. A176-1 keeps the tolerant arm - it is genuinely the
right shape for a future caller - but the comment now says plainly that
nothing relies on it, and the differential **pins the difference** rather
than leaving it to be discovered: the old arithmetic throws on a null rig,
the new one does not, and that is written down as the one behaviour this
extraction changed.

### What the split was checked for, and passed

- **Nothing was lost.** Every one of the 1,751 lines of the old
  `Home.md` appears somewhere in the three files that replaced it: 0
  missing.
- **Nothing was duplicated.** 0 substantial lines appear in both
  `Home.md` and a delegate - a relocation that leaves the original
  behind is two texts, one of which gets edited and one of which gets
  read.
- **Key order survived.** The save envelope is JSON and insertion order
  survives `JSON.stringify`, so a reordered pose bag is a different
  string. Both hosts compose byte-identical bags, and the rig still
  overrides a host-supplied pair, which is what the spread order decides.

### One thing left standing, deliberately

`citeShift` reports two citations "for a person" in a STRUCK row of
`Port-Ledger.md` - `combat/playerWeapon.js:119-161` and its `:808`
continuation. Read at the commit before this branch, **that span was
already stale**: it claims to name the port's own gesture path and
actually pointed at the sheath-and-hand region. HARD2c's insertion moved
it further along. It is left alone on purpose - the struck law freezes
citations in fixed rows precisely so historical text does not churn - but
being frozen is not the same as being right, and it is written down here
rather than left inside a "2 for a person" line nobody reads.

### The merge, and a conflict rule this program did not have

`origin/main` moved under the branch (PR #175) and the merge conflicted
in five files. Two were ordinary; the other three were **conflicts
between two sets of CITATIONS**, and the first resolution got half of
them wrong by taking one side wholesale:

> A citation conflict has no side. The `src/` line numbers were THIS
> branch's - it moved `world.js` and `dungeonContext.js` by one line
> each - and the `Port-Ledger.md` ROW numbers were MAIN's, which had
> inserted a Ledger row. Taking ours gave the right src lines and the
> wrong rows; taking theirs would have done the reverse. **Resolve a
> citation conflict number by number, by asking what each one names.**

Two further mechanics, both learned the expensive way here:

- **`citeShift` must not run mid-merge.** Run before the merge commit it
  reads a base that predates the incoming files (it said so itself:
  *"fatal: path 'test/ht3_sprite_upright.test.js' exists on disk, but
  not in 'HEAD'"*) and shifted seventeen citations off by one. Commit the
  merge first, then let the tool re-resolve against the new base - the
  same order PR #168's merge established.
- `src/buildTag.js` conflicts on every merge and is build output; take
  either side and let `prebuild` stamp it.

Post-merge the gate is green on 7,654 tests with `citeShift` reporting
nothing to move.

### The shape worth keeping

Two of three findings were **in the gates, not the code**, and the third
was a comment. The code this branch changed came through clean; the
things that claimed to check it did not. That is now the second audit in
a row to land there (AUDIT-HARD found four such), and it is the argument
for auditing gates on the same cycle as the port rather than trusting a
green suite.

## The standing rule this program adds

When an audit finds a defect, the fix is not finished when the defect is
gone. Ask what class it belongs to, and whether the tree can be made to
answer that question by itself. If it can, that gate is the fix and the
one-line repair is a detail of it.
