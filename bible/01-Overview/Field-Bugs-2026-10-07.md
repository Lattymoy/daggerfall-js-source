# FIELD BUGS 2026-10-07 - the home the arena moved, emptied again at every boot

One Discord report, read 2026-10-07 from a screenshot of `#bug-reports`. Cruor, "Home storage randomly disappeared?":
*"Not sure if this is just the server struggling or not but all the stuff I kept in them seems to have disappeared!
Will keep updated if it comes back later or something."* An hour later: *"Still empty. Might be worth looking at! It's
not a big deal for me personally but it ate a bunch of aetherics/legendaries and IK a lot of people would prob crash out
if that happened to them :>"*

Every writer of an online home's storage was read. One of them could empty it, and it did so whenever the account
service failed at the wrong moment, which it did all through 2026-10-06. Fixed at its root, with the second gap the
same function had. No reporter's save and no ARENA2 were at hand; nothing here was seen in a browser.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "all the stuff I kept in them seems to have disappeared!" - "Still empty ... it ate a bunch of aetherics/legendaries" (Cruor) | a home the arena moved (ARENA4b) is moved again at every boot until the move is said read, and the read was lost whenever a checkpoint or `arena-seen` failed. The emptying of an old scene already gone wrote an empty record over the new home's own: every chest, storage piece, owned thing and floor pile. That boot's checkpoint then sent it to the realm | HOME-WIPE |
| 1b | (the same function, read for the fix) | the record a move makes was never stamped with its town's layout, so it read as Daggerfall's own town. Where the city stands in Beautiful Cities, the owner's first visit held the moved things back | CRATE-LAYOUT |

## Where a home's storage lives

HOME1: what an online home holds is its owner's save's, never the service's. The house's own chests are kept by index
(`lootContainers`, `container:<i>`), what the storage pieces hold by piece id (`decorItems`), the owner's own things
standing in the room (`decorOwn`), and the floor (`droppedPiles`). All of it sits under the home's OWN scene
(`systems/onlineHomes.js homeSceneName`), made permanent at the purchase and again at every entry, so the scene cache's
clearing at a map-pixel crossing keeps it. The realm keeps a character's save and the one before it, and nothing older
(`server-account/src/realm.js`, `obj` and `prev`). A record emptied and saved twice is gone.

The writers of that scene, read one by one:

- The visit's two doors (`scenes/worldModes.js` cacheInteriorScene and restoreInteriorScene). The visit's home is read
  once at the door and held for the visit. A save made inside writes the live room first (`interiorSaveData`).
- The sale (`sellHomeAt`): the owner's own things back to the pack, the scene let go.
- The scene cache's clearing (`systems/sceneCache.js` clearSceneCache): a permanent scene is kept.
- ARENA4b's move (`systems/arenaMove.js` emptyArenaScene, reached from `systems/onlineHomes.js` moveArenaHomes). The
  only writer that could empty a home its owner keeps.

## HOME-WIPE (1)

An online home in Daggerfall's cell (4,3), which the arena took, is moved by its owner's client: picked, posted inside
a realm act, and the old scene emptied into the new house's inside the act's apply. The move is said read
(`/v1/homes/arena-seen`) only once a checkpoint holding the emptied scene has landed (AUDIT PRE-MERGE 1003 O10). Until
then every boot reads the move as unread and empties it again - "the old scene emptied into the new again (harmless: a
scene emptied once is gone)".

It was not harmless. By the second boot the old scene was gone, so the emptying carried nothing. But its last step
cached `{ lootContainers: [], frame: 'building' }` under the new house's scene whenever that scene was permanent. It
always is: the move makes it permanent (the old one was), and HOME1 makes it so again at every visit. So the new home's
whole record - every chest, every storage piece's contents, the owner's own things standing in it (their pieces stand
on, the service's, but taking one down gives nothing back), the floor - was replaced by an empty one. The replay's own
checkpoint (`announce`, world.js onlineCheckpointLanded) then wrote that to the realm. Each boot while the move stayed unread did it again: the first
took the crate the move had carried, and each one after took whatever had been put in since.

A move stays unread when the checkpoint's put is refused or unanswered, when `arena-seen` fails, or when the page goes
between the two. The account service's two overloads of 2026-10-06 answered all of them with errors. In YARD-SHED every
database call failed. In STORM-SHED 34,793 requests failed in the 20:00 hour (`06-Systems/Online-Arc.md`). Players
reloaded through both. Reproduced headless with the real moveArenaHomes and emptyArenaScene over the real scene cache:
one replay replaced the new home's record whole, and every replay after did the same.

THE FIX (`systems/arenaMove.js` emptyArenaScene): the owner's record is never written over.

- **A kept home.** A permanent `to` with a record is the owner's. What a move carries joins its first container
  (`container:0`), after what that chest already holds. The chest is marked a crate, so a house with no such chest has
  the things set down where its owner walks in (restoreInteriorScene's crate arm) rather than dropped unseen. When
  nothing is carried, the record is left exactly as it stands, so the replay is now the no-op its comment said it was.
- **A stranger's visit.** An ordinary `to` - a visit the world moving on would take anyway - is replaced as before.
- **One arm removed.** The `|| containsPermanentScene(cache, to)` arm is gone. Its only remaining effect was an empty
  record that the live visit writes over.

## CRATE-LAYOUT (1b)

WD3 stamps an interior's record with the layout its town stood in (`layout`; no field for Daggerfall's own), and a visit
holds back a record made in another layout of the same town (restoreInteriorScene). ARENA1 renamed the old scene onto
the new house and carried its stamp. ARENA2's emptyArenaScene made a fresh record with no stamp, which reads as
Daggerfall's own town. So wherever the city stands in Beautiful Cities, the owner's first visit to the new house held
the crate back as another layout's, and the house stood empty. That covers an offline deed bought under the mod, and
online Daggerfall if its homes' layout is the mod's (the service keeps the first home's layout for its town).

THE FIX: the record a move makes is stamped with the layout the new house's town is visited in.

- **Offline** (moveArenaRecords): the deed's own layout. The move runs before the save's pins are read
  (`applyLayoutPins`), so the city's reading at that moment is not yet the deed's.
- **Online** (world.js moveArenaHomesOnline): the homes' towns' layout, read once they have landed.
- **A record already standing** keeps its own stamp.

## What this does not do, and what is wanted

- **It gives nothing back.** A home a replay already emptied is empty in its owner's realm record, and the realm keeps
  nothing older than the save before it. The items can only be restored by hand.
- **Not reproduced: whether Cruor's home was one the arena moved.** If it was not, this is not their cause. The other
  writers above empty nothing. Two can show a home empty for a while and bring it back:
  - a door the service does not answer within HOME_ASK_WAIT_MS stands the home under Daggerfall's own law: no storage
    of the owner's, a stranger's cupboards, no placed pieces;
  - a town whose homes' layouts are not heard stands in another layout and holds the home's record back.
  Both end once the service answers, and the record is untouched meanwhile. Wanted from Cruor: the town the home is in,
  whether the Daggerfall Bank's letter about a moved house was ever shown (it is shown again at each boot while a move
  is unread), and whether the placed pieces still stood.
- **No repair for CRATE-LAYOUT's gap.** A crate already held back by an unstamped record stays in the save, held for
  Daggerfall's own layout. No repair is made.

**The four hosts.** world.js WIRED: both moves - moveArenaDeed offline, moveArenaHomesOnline online - and the online
move's stamp. worldModes.js reads the stamp and the crate through restoreInteriorScene, unchanged. exterior.js runs no
move: the fixed city stands no save's records. dungeonContext.js has no house.

**Pinned.** `test/fb1007_homewipe.test.js` (4, new):

- the field's sequence through the real moveArenaHomes - two lost reads, four boots - with every save those boots wrote
  holding the new home whole, and the visit after finding it;
- the merge into a kept home: its own things first, a first chest added where the record has none, a stranger's visit
  replaced;
- the stamp, through the save's round trip and the offline deed's move;
- the online host, by source.

`tools/mutants/fb1007_homewipe.json` (12, all dead), the shipped block restored among them (three tests fail). Re-aimed
by content: test/arena4b_homeclient.test.js's host pin (the call carries the stamp now) and
`tools/mutants/arena2.json` ARENA2-MARKS-KEPT (dead).
