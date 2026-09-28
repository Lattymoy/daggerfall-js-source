# FIELD BUGS 2026-09-27f - the bodies that filled up again

From the Discord, through Mac:

1. *"Hello, out of sync dungeons can generate infinite gold upon entry if there are dead corpses of monsters."*

## CORPSE-GOLD: a remembered body keeps the room's word when it stands as another species (1)

**Why the dungeon is "out of sync".** A dungeon's random monsters are drawn from its encounter table on a stream seeded
by the location, but the draw is banded by the PLAYER's level (`characters/dungeonEnemies.js` chooseRandomEnemyType,
DFU's own). The room's memory (WORLD1) keeps the roster as whoever built the room first saw it, and WORLD3 makes that
roster the room's: on entry, every random marker where this player's level drew another species is rebuilt as the
room's species (`retypeFoe`). A player at another level than the room's first visitor, or the same player after
levelling, sees some monsters change kind as they come in.

**Why the bodies filled up.** The rebuild is asynchronous (it awaits the species' art). `restoreSharedWorld` applies the
memory's loot list in the same call, before any rebuild lands. At that moment the foe at a rebuilt index is still this
entry's fresh build, alive, and not a container, so `applyLoot` skipped the body's record and did not mark it spoken
for. The rebuild then stood a fresh entity with its own loot roll (`spawnEnemyLoot`: the gold and the rest), `stand()`
forgot `corpse:<i>`, and the record's death laid that roll down as the body. Every remembered body at such a marker was
full again on every entry, whatever the room had taken from it. The level band is fixed per location and level, so it
happened every time. The first open then claimed that fresh list as the room's (a claim is refused only for a
container the room has spoken about), so the refill reached everyone else in the room too.

**The fix.** When the rebuild lands, `patchFoe` lays the body dead and the room's record for that body alone
(`bodyRecords`: `corpse:<i>`, by the canonical spelling applyLoot reads) is applied to it. Only that record: the rest of
the list landed with the restore, and landing it again would refill a container the player had taken from since.

**The same restore, a second way to the same bodies.** `validSharedFoe` refusing one foe record (a value out of the
wire's law) and `.filter(Boolean)` closing the gap renumbered every later record onto the next foe: deaths, feet and
species on the wrong bodies, and each body the room had emptied a stranger to its own record. A refused record is now a
hole at its own index, and applyWorld skips it.

A body nobody has opened is still each copy's own roll, as WORLD4 says of every unopened container. The fix reaches
only bodies the room has a word about. `06-Systems/Online-Arc.md` CORPSE-GOLD.

## For Mac

- **Still open: a word the memory has not caught up with.** Only the room's host publishes the memory: every 15 s
  (WORLD_PUBLISH_MS), and at once when the host leaves, dies or hides the page. A player who is not the host, takes from
  a body, leaves and comes back before the host's next publish reads the older memory. If that body was unopened in it,
  they get their own roll again, and opening it claims that roll for the room. While a host is playing, that is one
  refill per take inside a 15-second window. A host whose tab is in the background publishes nothing (the frame loop
  stops), so the window stays open until they return. Closing it is a design call, not taken here. The host could answer
  each arrival with its live loot words, or the relay could keep the loot words itself; the relay option means a relay
  deploy, which drops every connected player.
- **Still open, narrow: a live word during the rebuild.** A loot word from another player about a body whose rebuild is still
  loading its art finds no container and is skipped, so the rebuilt body takes the memory's older record. The window is
  the art load, and it matters only if someone is taking from that exact body right then.
- **Unchanged: a body the rebuild cannot stand.** When this client has no art for the room's species (`canStandFoe`),
  the rebuild refuses and the foe stands alive as its own species. The room's death is not applied, so it can be killed
  and looted again. That was already so, and those species are rare.

## Verification

`test/corpsegold.test.js` (4) mounts the real `restoreSharedWorld`, `applyWorld`, `patchFoe`, `applyLoot`, `retypeFoe`
and `stand()` from the context's source, with buildFoeAt's art await and fresh roll as the one stand-in. Run against
main's `dungeonContext.js` it fails 3 of 4: the emptied body comes back holding the rebuild's 501 gold, a body taken
from is not kept apart, and a refused record moves the next one up. The unopened-body case passes on both. Mutants
`tools/mutants/corpsegold.json`: 6, all dead.

Re-aimed by content: the restore's foe line in `respawn1`, `oncrash1`, `auditworld34` and `auditworld4` (and the
`respawn1` mutant aimed at it); the rebuild's callback in `world3`, `auditworld3` and `auditworld4`; the skipped hole
in `auditworld` and `world8`. Every mutant set that leans on those pins was re-run (`pins`, `respawn1`, `restx2camp`,
`slam11`, `slam13`, `survtiers`, `survtiers3`, `worldhover`, with `corpsegold`): 388 dead, 1 equivalent as recorded.
28 line cites moved by tools/citeShift.mjs, and one by hand (`chargenSession.js`'s `(:N)` on a comment's second line,
which the tool does not read as a continuation).

Lint, types, the build and the full suite green: 13403 runner tests, 0 failing (Suite: 13383 declared across 1405
files). No relay or account change: the server's import graph is untouched. Not verified in a browser or with two
players: no online session exists in this container.

Merged with main at #409 (ONE-SEAT, relay world121): nine conflicts, all line cites or index lines. Cite-only blocks took
main's text and tools/citeMerge.mjs re-applied this branch's moves by content (11). On the merged tree: 13439 runner
tests, 0 failing (Suite: 13419 declared across 1408 files), the build green, every mutant record aimed, and the sets
above re-run: 388 dead, 1 equivalent as recorded.
