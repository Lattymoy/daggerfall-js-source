# The FixPackage2 / loot-changes hand-off, 2026-09-18

Mac handed over two zips and asked for them to be integrated:
`FixPackage2.zip` (16 files) and `daggerfall-loot-changes.zip` (8). Like
`WildernessRestingHOTHOTFIX` before them these are not mods - they are
files out of a working tree - and the lesson that hand-off closed on is
the whole of this one:

> **A hand-off is a diff against a tree that has moved, and the dangerous
> half is not the conflict - it is the hunk that applies cleanly and
> quietly undoes something shipped.**

## The bases, measured before anything was copied

Each incoming file was diffed against every version of itself in history
to find the one it was actually cut from. The two zips answered very
differently:

| | vs HEAD | vs its real base | base | commits behind |
|---|---|---|---|---|
| **all 8 loot files** | = | = | HEAD | **0** |
| `src/net/remotePlayers.js` | 217 | 217 | `b9d8ee76` | 0 |
| `src/systems/campEncounters.js` | 63 | 63 | `c3ec6275` | 0 |
| `src/ui/enhancedMenu.js` | 43 | 26 | `d0cab242` | 1 |
| `src/ui/pauseWindow.js` | 14 | 10 | `65b730d9` | 19 |
| `src/scenes/exterior.js` | 184 | **18** | `dfd6f597` | 28 |
| `src/scenes/world.js` | **1143** | **155** | `dfd6f597` | **29** |
| `src/scenes/worldModes.js` | 149 | 69 | `65b730d9` | 31 |
| `src/scenes/dungeonContext.js` | 121 | 14 | `65b730d9` | 31 |

The loot zip was cut from HEAD, so copying it in **is** its change and it
was copied in as given. FixPackage2 was not: `world.js` alone would have
read as a 1,143-line change when the author's real diff is 155, and the
other ~1,000 lines would have been 29 commits of shipped work quietly
reverted. Every FixPackage2 file was 3-way merged against the base its own
content identified, never copied.

## The three conflicts, all combines

13 of 15 merged clean. Every real conflict was two people adding different
things in one place - not a choice between versions:

- **`world.js` respawn comment.** The zip's older phrasing of the
  Privateer's Hold exception against main's D-ONLINE2 text, over identical
  code. Main's kept: it carries the tag, and one tag is one law.
- **`worldQuickLoad`'s head.** Main had gained AUDIT-TO1 G1's
  travel-destination clear; the zip adds ONLINE-LOAD1's refusal. Both
  belong, and the **refusal goes first**: a load that is refused must not
  cancel the player's journey on its way out. (The zip repeated its own
  comment paragraph verbatim; kept once.) AUDIT-TO1's pin measured the gap
  from the latch to the clear and had to widen - what it pins, the clear
  happening before the first await, is unchanged.
- **The online-arrival line.** Main's SURV7/AUDIT-SURV-B survival-clock
  alignment against the zip's `uploadRecordFrame` dep on `RemotePlayers`.
  Both kept; the dep is load-bearing (`_buildMobile` bails without it).

## What landed

- **The loot rebalance.** A humanoid's loot-table roll and its worn gear
  both drop to a quarter of DFU's chance; **gold is computed before the
  scale and rolls at its full rate**. Animal meat, a humanoid's carried
  food and the hunt's yield are halved by *stochastic rounding*, so a
  one-unit catch (a rat's single meat) averages the cut over many kills
  instead of rounding back up to 1 every time.
- **ONLINE-CLASS1.** A peer without a Morrowind body stands as its
  class-enemy sprite instead of the flat paperdoll, off a new `class` on
  the look. The key is **omitted, not null**, when there is none: SOC1's
  own pin names that exact mutant ("the keys added to a hello that named
  none, which breaks every older hello pin"), and `lookKey` hashes the
  look, so a null would have missed every cached look as well as changing
  the bytes of every older peer's hello. `RELAY_VERSION` bumped to
  `world83`, its law row appended, never edited.
- **Themed camps.** A group is seeded once the normal way and its other
  members drawn from that seed's own faction, so a camp reads as a knot of
  bandits rather than a grab-bag.
- **ONLINE-LOAD1**, and the peer-sprites settings row.

## CAMP2: landed, but not as offered

`Active-Arcs.md` records CAMP2 being **refused** at the previous hand-off,
for three reasons. `mobileFactions.js` arriving with this zip answers only
the first. The other two were both consequences of the same thing - the
flag being **global**:

```js
} else if (infighting && !self.entity?.suppressInfighting && targetEntity && !targetEntity.suppressInfighting) {
  if (targetEntity.team === selfTeam) continue;      // infighting arm
} else {
  if (!isPlayer && selfMobileTeam !== 'PlayerAlly') continue;   // ...and the arm below it
}
```

Setting `suppressInfighting` on the entity does not relax the infighting
arm - it **skips it**, dropping to the arm below, where a foe targets
nothing but the player. The player's own summoned ally included. (That is
exactly what the flag is *for*, on the seducer; `MT-i` pins it.) And it
outlived the `campId` that justified it, because a quickload drops the id
and not the flag.

So the exemption is now the **camp's**: `enemyTargets.js` spares a
campmate its campmates and nobody else, keyed off `entity.campId`. A
campmate still fights a summon, still fights any other foe, and when the
id goes the group degrades to ordinary foes rather than to foes that
ignore the world. `enemytargets.test.js` pins all three halves, with a
no-camp-id control so the pin cannot go vacuous.

The zip's **`RemotePlayers` arguments**, refused last time as inert, are
read now and land. **`isOnlineWorldSession` is still absent and still
refused.**

## What the zips shipped broken

- **JSDoc `tsc` rejects.** `uploadRecordFrame`, `dt` and `eye` were used
  but not declared; `renderer.textures` and a string `record` key were not
  in the contract. The contract's own comment says the archive/record pair
  is `number|string` "on purpose and not by accident" - every row said so
  except `createBillboardBatch`, which `automapWindow` has been calling
  with `('amap', 'player')` all along. Corrected there.
- **`camp1_groups.test.js` was not updated** against the zip's own rewrite
  of `rollGroupComposition`, which now draws its seed member (two rolls)
  before the kind and size rolls. The scripted sequences were re-written in
  order rather than left cycling.

## The bill

1 new test, 3 mutant records re-aimed by content, ~260 cites re-resolved
(the tool's own `--apply` for the mechanical ones, by content for the 20
it left for a person, plus four range-ends and a probe-fleet span it
cannot see). Gate green: **8,944 tests, 0 failures**, lint, types, build.
