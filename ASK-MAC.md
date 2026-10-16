# ASK MAC

A running list of what the work has turned up that is **Mac's to answer**, not
the agent's. Newest first. When an answer lands, the entry is struck or moved
into `bible/` — this file is a question queue, never a design record.

Not a substitute for `bible/Home.md`'s FLAGGED list. FLAGGED marks *code* that
wants an eye; this marks *decisions* nobody below Mac can take.

---

## 1. `classicArt.js` calls the paint records flat. They are not.

The table's own comment reads:

> `// ── paint and dyed cloth (a wagon's looks - systems/wagonLooks.js) - Daggerfall's flat colour swatches (TEXTURE.000`
> `// and .001, which Come Sail Away paints with too) and its woven fabrics (TEXTURE.049)`

`paintRed [1, 117]`, `paintBlue [0, 105]`, `paintGreen [1, 44]`, `paintBlack
[1, 92]`, `paintWhite [0, 113]`, `paintOchre [0, 24]`, `paintOxblood [1, 120]`.

**Checked in game by the operator, on the live server: a cart keeps its wood
grain on every colour.** So these records are *tinted wood*, not flat chips.

This matters beyond the comment. The false description has been copied into
reasoning at least twice — an agent was sent to build a dye to fix a "flat
cart" that was never flat, and `WHEEL_COLOURS`' neighbours were chosen against
a mental model the data contradicts. Nobody caught it because the cart *looked*
right.

**Asked:** what is the correct description, and should the table be corrected in
place? Any comment elsewhere in the repo that inherited the "flat swatch"
assumption should be swept at the same time.

---

## 2. The caravan's roof and room are painted with those same records

`WAGON_SOURCES`:

- `[TEX.caravanRoof]: DF.paintGreen`
- `[TEX.roomCeiling]: DF.hullPlanks`, and every `roomSide`/`roomFront`/`roomRear`
  is `caravanWall(TEX.*, DF.paintGreen)` — a leaded window laid into that paint

If `paintGreen` is tinted wood (see 1), **the caravan's roof is wood-grained and
its interior walls are too.**

**Asked:** is that intended? The operator has no caravan to test, so this is
unverified in game. If a roof should be canvas or tar, this is wrong and the
record is the wrong one.

---

## 3. An agent re-aimed a mutant record that predates its work

`tools/mutants/wagons2.json` holds `WAGONS2-the-built-look-kept-as-a-field`,
which points at a line in `wagonLooks.js`. The timber work changed that line;
`test/mutantdrift.test.js` then demanded the record be re-pointed, and it was,
by content, at `anyChosen`.

The law it pins is unchanged and the mutant still dies. But **an agent edited a
test record it did not write**, and "re-aim on drift" is a practice question,
not a fact question.

**Asked:** is re-aiming an existing mutant record in place acceptable, or must it
be retired and re-issued as a new record with its own history?

---

## 4. The host line-count ceiling is being dodged, not met

`src/scenes/world.js` carries a hard `bootWorld` line ceiling (~21741) enforced
by `HOST-SPLIT THE HOSTS DO NOT GROW`. The emblem wiring line was deliberately
placed on a `});` that closes the `GuildBook` construction, so the host's count
did not move.

That works, but it means world.js can no longer grow at all, and the next person
to add a real line will hit a wall and be tempted into the same dodge.

**Asked:** should the ceiling move, or should `world.js` be split? Doing nothing
means the ceiling ratchets tighter with every feature.

---

## 5. Two of five ship hulls have no port art at all

`HULL_NAMES` is five. Three are the port's own ships (galleon, large boat,
carrack) with their own pseudo-archives. **Hull 0 (Rowboat) and hull 3 (Large
Galley) still draw the Come Sail Away mod's prefabs straight to raw Daggerfall
records** (`comeSailAwayModels.js:302-322`).

So any ship appearance work — sails, hull colour, a flag — covers **three hulls
of five** until those two get art layers.

**Asked:** do Rowboat and Large Galley get pseudo-archives too, or is three-of-five
the accepted scope?

---

## 6. The galleon may be wearing two flags

`galleonModel.js:927` bakes a `FlagObject` into the galleon's own tree, and
`comeSailAwayPool.js:376-392` instances a **second** donor flag onto every
boat's tallest node. If both are live, the galleon carries two flags.

Not confirmed — no one has run it. The ship report flagged it as code-admitted
but unverified.

**Asked:** is one of them dead, or is this a live bug?

---

## 7. Relay deploy order for the timber wire bump

`RELAY_VERSION` is `world206`, not yet deployed (`SERPENT5`, 2026-10-15). The
timber work will bump it again and add two park-record fields (`ww`, `wr`).

The house rule, from the version comment itself:

> Deploy the relay BEFORE the account service (acct135), or a token signing
> either word is refused whole

**Asked:** confirm the order for this bump specifically — relay, then account
service, then clients — and whether the two new fields need the same treatment
or ride an already-deployed path.