# FIELD BUGS 2026-10-25e - a horse left at a dungeon door the online page never wakes beside

One report, handed over with no more detail than its title: "Broken Mounts: Horses in the inventory become unusable
after logging back in." Read on main's `80eafd01ff`, against Horse Cart and Cargo's own lifecycle
(`06-Systems/Horse-Cart-And-Cargo.md`, AUDIT HCC H2 and H3) and the online load's wake from a dungeon
(ONLINE-UNDERGROUND-LOAD1). Named 25b: main's `Field-Bugs-2026-10-25.md` (ART-DOLL, ASK-LONGER) took 25. The pins are `test/systems/horse/fb1025_horsewake.test.js`, the mutants
`tools/mutants/fb1025_horsewake.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Horses in the inventory become unusable after logging back in" | A dungeon door leaves the horse outside it, the save taken inside keeps it there, and the online page wakes the character at the nearest temple, town or graveyard - nothing called the horse to that place, and every mount measures the distance to it | HORSE-WAKE |

## HORSE-WAKE (1) - `src/systems/horse/horseCart.js`, `src/scenes/world.js`

FOUND. Reproduced through the real runtime before the fix (`test/hccWorld.mjs`, the save round-tripped as JSON): a
horse ridden into a dungeon, the save taken inside, the load landed 300 m away - `canMountHorseFromTransportWindow`
false, so the Transport window's horse row is dark (`mountRig.js:"hasHorse: rt ? !!rt.canMountHorseFromTransportWindow() : hasHorse(playerEntity.items ?? []),"`),
and the mount key says "Your horse is not close enough." The horse item is still in the pack, so the inventory's Mount
cell still names it. The same for a team driven in (the wagon parked at the door, its horse hitched) and for a horse
that followed its owner in on foot. A load at the save's own place mounts at once: the record itself survives a load.

THE CHAIN.

1. A dungeon door leaves the horse standing outside it - ridden in, driven in or following (HandlePreTransition, the
   mod's own: the horse loose behind the player, the team parked at the door).
2. Closing the tab inside saves there, and the save keeps the horse at the door (AUDIT HCC H3: every save carries
   the record).
3. An online page never puts a character back inside a dungeon: ONLINE-UNDERGROUND-LOAD1 wakes them at the nearest
   temple, town or graveyard to it (`world.js:"townTalk.say(undergroundWakeText(wake.kind));"`).
4. The record is restored after that landing, as it was saved. The Transport window and the mount key ask whether
   the horse is near (`horseCart.js:"function canUseHorseTransport() {"`), and its own click needs it in reach. It is
   at the dungeon door, often in another map pixel.

WHY NOTHING STOPPED IT. DFU's load always lands at the save, so the mod never meets a load that lands elsewhere. The
port's own landings elsewhere each took care of their own piece: Come Sail Away lets go of the helm (`csaElsewhere`,
CSA-J), and the online respawn calls the team (WILD1, AUDIT HCC H2). The load restored the horse's record and called
nothing.

THE CALL (the port's own; no DFU twin - recorded in `Port-Ledger.md` section A):

- **A load that lands away from its save calls the pair to the player.** The landing's word is the load's own
  `csaElsewhere` - the online wake from a dungeon, a dungeon that cannot be found, a dungeon that cannot be entered, a
  save taken somewhere else - handed to the restore
  (`world.js:"if (hccRecord) hccRuntime.restoreSaveData(hccRecord, { elsewhere: csaElsewhere });"`). The runtime calls
  the pair as the online respawn does, by WILD1's forced journey (`horseCart.js:"function callTeamToLanding() {"`).
- **Only what the respawn would call comes.** A horse waiting or following, and a team with its horse hitched, come
  and stand behind the player. A wagon parked alone stays where it was left, and a pair sent to the stable stays at
  the stable. A dungeon that could not be entered lands its player at its own door, so the horse there only steps
  behind them.
- **The call is the load's alone.** The forced journey is spent at once: the next fast travel follows Follow Fast
  Travel as before.
- **With the mod off, the record still takes the call.** RestoreSaveData runs whatever the switch says (AUDIT HCC H3),
  so a suspended runtime's record marks the horse following, still at the door's coordinates, with its relocation
  armed. Switched back on in the same session, the horse lands behind the player. A save taken while the mod is off
  keeps the door's coordinates - no worse than before the fix. With physical persistence off, the mod's own law puts the
  horse with the player.

THE FOUR HOSTS: `scenes/world.js` is the one wired - its load is the one that lands away from a save (the boot load an
online login runs included). `scenes/dungeonContext.js`'s same-dungeon load (`horseCartLoad`) lands at the save,
`scenes/worldModes.js` restores no horse record, and `scenes/exterior.js` is the block-viewer probe host with no load.
None of the three changed.

WORKAROUND, before the fix: Summon (its key, or the Stable page's Summon) has no distance test and brings the horse to
the player; so does riding back to the dungeon door.

PINS. `fb1025_horsewake.test.js` (5): through the real runtime, a horse ridden in, a team driven in and a horse
following in, each saved inside and loaded 300 m away - unmountable without the word, behind the player and ridden
with it; a load at the save leaving the horse waiting at the door; a wagon parked alone and a stabled pair left where
they are; and the next journey not forced. Pins moved, each re-pointed at the restore's new argument:
`test/player/hcc_hosts.test.js`, `test/systems/comeSailAway/csa_close.test.js`, `test/systems/wa1_warmAshesShips.test.js`.
MUTANTS: `tools/mutants/fb1025_horsewake.json` (6, all dead).

NOT SEEN IN GAME. Checked through the runtime over the test world, whose map pixel is one for every point, so the
landing in another pixel was not exercised. The call writes the horse's new place from the player's own ground and
never reads the old pixel; the real game's landing is unchecked.
