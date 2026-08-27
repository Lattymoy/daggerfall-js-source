# AUDIT 27 - THE STATE-OF-THE-TREE AUDIT (2026-08-27)

Mac asked for "a comprehensive audit and bible update". This page is the
record.

**It is deliberately not another parity sweep.** AUDIT 26 read the whole
of `src/` against the whole of Daggerfall Unity the day before, with the
C# in the container, and its fix campaign is still running - eleven
clusters landed today. Re-reading the same tree against the same C#
twenty-four hours later would have burned a day to re-confirm yesterday's
answer. What no audit has ever read is the OTHER half: the things a
parity sweep does not look at, and the day's own work.

So this audit asks a different question - **is the tree, and the book
that describes it, internally true?** - in ten mechanical sweeps over
every tracked file, plus a doctrine read of what landed on 2026-08-27.

## Baseline

    npm test        3,889 tests, 0 fail, 189 skipped (ARENA2-gated)
    npx eslint      src/ tools/ test/ clean
    src/            403 files, 131,041 lines
    test/           402 files
    bible/          25 documents
    live            lattymoy.github.io/daggerfall-js-source, verified serving HEAD

Twenty-five non-merge commits landed on 2026-08-27 across two lanes: the
AUDIT 26 fix clusters, MobileTeams, Q5, the macro table, the quest/item
and talk/reaction batches - and, in this lane, the site (U60a-c), the
public repository, the four from-play fixes, the HMI clock and its
shunt, the Enhanced Music arc built and reverted whole, the two volume
fixes re-landed alone, U62, and the enhanced sky (ES1-ES1f).

## The sweeps

| # | Sweep | Result |
|---|---|---|
| 1 | Exported functions/classes with **no consumer anywhere** | 12 - **F301** |
| 2 | Exports unused outside their own module | 305, almost all named constants citing a C# value. That is the port's documentation style, not dead code. No finding. |
| 3 | The **four-hosts rule**: per-frame laws run by some hosts and not others | clean. `hitEffects.tick` reads as world+exterior only, which is correct since 2026-08-27 - the dungeon runs it inside `dungeonContext.drawFoes`, which both dungeon hosts call. |
| 4 | **Bible citation integrity**: every `path.js:NNN` in the bible | 251 citations, 0 files gone, 0 lines past EOF |
| 5 | **Doctrine allow-list**, both ways | 85 tracked binaries, 0 unlisted; 1 row for a file that does not exist - **F302** |
| 6 | **Testing.md** against `test/`, both ways, row by row | 402 files, 402 rows, 0 wrong counts |
| 7 | **Port-Ledger** integrity: 296 rows, 121 AUDIT 26 ids, 29 cited `src/` files | 0 dangling |
| 8 | **Home.md** against `bible/` | 2 arcs never listed - **F303** |
| 9 | **URL flags** the shipped build honours | 36, several of them powers - **F304** |
| 10 | The day's work against **Port-Doctrine** | 1 departure with no Ledger row - **F305**; and one live claim re-verified - **F306** |

## The findings

**F301 - twelve exported functions nothing calls.** Not "unused outside
their module" (that is 305, and mostly constants); these have zero
references anywhere in `src/`, `test/`, `tools/` or `scripts/`, their own
definition excluded. Five are debug getters in `characters/rewrite/body.js`
(`lastRavagerMuzzles`, `lastIdolMuzzle`, `lastBulwarkMuzzle`,
`lastBulwarkAim`, `lastRig`); five are test seams whose tests stopped
calling them (`_setDecodedForTests` in textureReplacement,
`_resetActiveSpellHud` in hud, `_resetLargeHud` in hudLarge,
`_resetIconsForTests` in textureCanvas, `_setTravelPopUpArtForTests` in
travelPopUp); two are laws (`removeHeldSpell` in enchantments,
`getPaintFile` in itemInfo). **NIT, not fixed here.** The five body.js
getters and several of the seams sit in files the AUDIT 26 fix campaign
is actively editing in the other lane, and deleting an export under a
running campaign trades a nit for a merge conflict. Port-Ledger row.

**F302 - the doctrine allow-list had a row for a file that has never
existed.** `public/logo.png` was listed as "OUR artwork - the title
screen brand (U21c)", and the file appears nowhere in the tree's
history. Harmless in itself - but it shows the list was only ever read
ONE way, so a row could be written for a file that never landed, or
outlive one that was deleted, and the list would still pass while
meaning less than it claims. **FIXED**: the row is gone, and
`doctrine.test.js` now checks the list in both directions. Mutant (a
phantom row added): dead.

**F303 - two arcs the bible's own index never named.**
`01-Overview/Audit-26.md` - the most recent audit, and the one driving
today's fix campaign - and `07-Rendering/Rendering-Arc.md`, which holds
the R-slices and the whole enhanced sky. Both were reachable only by
knowing they were there. **FIXED**: both in Home.md's Active arcs, with
this page.

**F304 - the shipped build honours 36 URL flags, and several are
powers.** `?fly` (free camera), `?nofoes` (no monsters), `?tp` (a
teleport mode), `?timescale`, `?load`, plus the debug and screenshot
ones. They are development doors and they work on the LIVE site: anyone
can add `?fly` to the address bar. **NOT A BUG, AND MAC'S CALL.** DFU
ships a console with more than this, and a single-player game's cheats
are the player's business - but the port has never DECIDED it, and a
decision is what the Ledger is for. Row written; the options are (a)
leave them, (b) gate the powers behind an existing setting, (c) strip
them from a production build. No code change without Mac.

**F305 - the enhanced sky is a departure with no Ledger row.** The
doctrine is explicit: a departure from DFU is approved on the Ledger,
and `doctrine.test.js` already enforces "every DEPARTURE declared in
`src/` has a Ledger row naming its file". The sky is the port's own -
DFU's Enhanced Sky is a MOD, not a thing to port - and it had an arc
record but no Ledger row. **FIXED**: section A row, naming the file and
the approval.

**F306 - a claim re-verified rather than trusted.** ES1e says the retro
grid is the painted sky's own pixel. Re-checked from both sides in this
audit: `RETRO.step === SKY_ANGLE_PER_PIXEL` (`Math.PI / 512`) is true by
identity, and `(PI/2) / step` is exactly 256 cells a face - 512 across
180 degrees, which is `SKY??.DAT`'s width. The claim holds.

## What this audit did NOT do

- **No parity reading.** AUDIT 26 owns that, it was yesterday, and its
  campaign is mid-flight. Nothing here re-judges a C# law.
- **No real-data verification.** ARENA2 is not in this container; 189
  corpus-gated tests skip. Every sweep here is over the repository, not
  over a run of the game with real files.
- **The sweeps are mechanical, and mechanical sweeps have a shape.**
  They find drift, dangling references and rules enforced in one
  direction. They do not find a law that is wrong in a way the tree is
  consistent about - which is exactly what a parity sweep is for, and
  why these two audits are different instruments.
- **One lane was moving under it.** Six commits from the other lane
  landed during the sweep and were merged before the record was written;
  the counts above are the merged tree's.
