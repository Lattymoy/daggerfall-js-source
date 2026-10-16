# ASK MAC

A running list of what the work has turned up that is **Mac's to answer**, not
the agent's. Newest first. When an answer lands, the entry is struck or moved
into `bible/` — this file is a question queue, never a design record.

Not a substitute for `bible/Home.md`'s FLAGGED list. FLAGGED marks *code* that
wants an eye; this marks *decisions* nobody below Mac can take.

---

## 1. `classicArt.js` calls the paint records flat. They are not. — SUPERSEDED 2026-10-16

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

 **2026-10-16 update:** the operator's dev test has since shown the cart
 painting FLAT and losing its grain — against the grain-keeping reported
 above. The branch now ships the flat reading plus a fix: cart paint dyes over
 the grain (CART_DYES, same `{dyed}` machinery as timber) rather than swapping
 the record. So whichever the records are, the wagon keeps grain. The table
 comment is still wrong in one direction or the other; the question above
 stands, but it no longer blocks anything the player sees.

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

## 7. Relay deploy order for the timber wire bump — UPDATED 2026-10-16

`RELAY_VERSION` is now `world208` (207 lived and died on the branch, never
deployed). The bump carries three park-record fields, not two: `ww` (wood),
`wr` (wheels), `og` (owner's guild tag, presence is the broadcast). Nothing
deployed yet — still one deploy.

The house rule, from the version comment itself:

> Deploy the relay BEFORE the account service (acct135), or a token signing
> either word is refused whole

**Asked:** confirm the order for this bump specifically — relay, then account
service, then clients — and whether the two new fields need the same treatment
or ride an already-deployed path.
---

## 8. A wagon wears the READER'S arms, not the owner's. Which is right? — ANSWERED 2026-10-16

Operator's ruling: the OWNER's arms; no guild → nothing overlaid; ONE setting
("Show guild's heraldry on wagon", on by default) whose presence on the wire
is the whole broadcast — off means no tag travels and everyone sees plain
cloth. Implemented as Pass A (wire + `/v1/guilds/arms`) and Pass B (per-tag
side pictures, toggle). Moved to `bible/06-Systems/Wagons.md`; the questions
below are kept as the record of what was decided.

`wagonHeraldry()` (`src/world/wagonEmblem.js`) takes **no arguments** and resolves
from one module-global wired to `guildBook?.guild?.heraldry`. So **every open wagon
in the game wears the arms of whoever is looking at it.** A stranger's wagon shows
your guild's shield.

This was never staleness. It was never per-wagon. The WAGON-EMBLEM commit declared
it prototype-scope, and the code says so honestly - but the failure mode is that a
guildmaster rides past another guild and sees *his own* shield on their cart.

**What already exists, which makes this cheap:**

- The roster **already carries the guild tag** - `gt`, stamped by `badged()`
  (`net/wire.js:2539`), read as `peer.gt` (`net/online.js:3479`) and surfaced as
  `RosterRow.gt` (`net/roster.js:163`). So a client always knows *who* a peer belongs to.
- **No frame carries the arms themselves.** The relay has no heraldry at all.
- But four endpoints return arbitrary guilds' arms **by tag**: `/v1/seats/list`,
  `/v1/board/read`, `/v1/homes/town`, `/v1/writs/list`. `/v1/homes/town` is
  **ungated** - "for everyone standing in it, guests too" - so any client can read
  any town's guild halls.
- `heraldryIndex` and `heraldryLookup` are ready and legal for exactly this. The
  seats already use them (`world.js:1891`).

**What is missing, in order:**

1. **The texture, not the data.** `ensureWagonArt` (`scenes/horseCartPool.js`) uploads
   `WAGON_SOURCES` once per session into fixed record names - there is no per-owner
   variant. `lookRemap` (the timber path) is the precedent for a records-per-look
   remap; an arms-keyed record is the same shape.
2. **A join** from `peer.gt` to arms, off sources beyond `[ownGuild, seatList]`.
3. **Coverage** for a guild that holds no seat, owns no hall, posted no note and has
   no writ. Not derivable from anything that exists.
4. **No staleness signal.** `setHeraldry` returns no `moved` word and no migration
   has a trigger on `guilds.heraldry`, so the relay never hears an arms change.

**Asked, and it is a product decision rather than a code one:**

- Should a wagon wear **its owner's** arms, the **viewer's**, or the owner's when the
  two differ? "The viewer's" is what ships today and is almost certainly not wanted.
- When a guildmaster passes another guild, whose arms does each player see? If both
  see the owner's, a guild's livery is legible to strangers - which is the point of a
  livery. If it shows the viewer's, it is a mirror, not a livery.
- Failing coverage for an unknown guild: the **throne's crown**, or nothing at all?
- Is a **reload-until-fresh** arms change acceptable, or is a live signal required?

