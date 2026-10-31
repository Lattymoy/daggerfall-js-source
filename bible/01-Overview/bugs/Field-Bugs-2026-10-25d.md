# FIELD BUGS 2026-10-25d - house storage disappears

One report, through the owner: "Disappearing House Storage: Items placed inside house storage randomly disappear". Read
on main's `80eafd01f`. Two earlier reports with the same words were other causes, already fixed: HOME-WIPE
(`Field-Bugs-2026-10-07.md`, a home the arena moved) and HOLD-KEPT (`Field-Bugs-2026-10-12g.md`, a chest's record by its
index). The first two defects below came in with the decorations overhaul (#1223, merged 2026-10-25), which moved a shared
chest's goods out of the owner's save into the service's `decor_bin`. A report from a build before that merge is
neither of them. The pins are `test/server/fb1025d_homepour.test.js` and
`test/systems/decor/fb1025d_sharewait.test.js`; the mutants are `tools/mutants/fb1025d_homestorage.json` (10, all dead).
HOME-STRANDED, the third, recovers what the first left behind: its pins are `test/server/fb1025d_strandedpour.test.js`
and `test/systems/decor/fb1025d_homestranded.test.js`, its mutants `tools/mutants/fb1025d_homestranded.json` (13, all
dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Items placed inside house storage randomly disappear" | A shared chest set back to private had its goods written into the building's scene, which the owner's client never reads for its home and which the next world move clears | HOME-POUR |
| 2 | (the same) | The owner's shared chest opened the save's window, empty, until the service said it was shared - for the whole visit if that answer never came. What went in there was hidden behind the bin | HOME-SHARE-WAIT |
| 3 | (an in-game check of 1 on its base) | Goods 1 had already filed under a building's scene stayed there, out of reach; shared and set back to private, they could be lost for good | HOME-STRANDED |

DFU has no online home and no shared chest, so neither fix is a departure from it and no Ledger row is owed. The
scene cache keys a scene by its name, as DFU's SerializableStateManager does (`systems/sceneCache.js`).

## HOME-POUR (1) - `server-account/src/decorAccess.js`, `src/net/homeScene.js`

An online home's things are kept under the home's own scene, `OnlineHome [MapID=..., BuildingKey=...]`
(`systems/online/onlineHomes.js`, "AN ONLINE HOME KEEPS ITS OWN SCENE"). When a chest goes back to private, `moveChest`
pours the bin's goods back into the owner's save, and it named the building's scene, `DaggerfallInterior [...]`. When the
answer arrived, the client added the goods to the open chest and its next checkpoint wrote them under the right scene.
When the answer was lost, the session ended (`realmGoldAct`, `needsAnswer`), and the joined record held the goods only
under the building's scene: the chest stood empty, and the next map pixel's `clearSceneCache` dropped that scene.

THE CHANGE: `homeSceneName` moved to a leaf of its own, `net/homeScene.js`, which both ends read (`onlineHomes.js`
exports it from there; the account deploy's filter names it). It is not `net/homeLaw.js`, because the relay's law
hashes that module (`test/net/relayversion.test.js`) and the relay never reads a save's scenes. The pour names it
(`server-account/src/decorAccess.js:"const name = homeSceneName"`). The scene is made permanent in
the same write, so a save that had no scene for the home keeps the poured goods across a world move.
`test/server/decoraccess.test.js` laid its chest under the building's scene, the server's own wrong name; it lays it
under the home's now.

## HOME-SHARE-WAIT (2) - `src/systems/decor/decorGrants.js`, `src/scenes/worldModes.js`

Which chests are shared is the service's answer (`op: 'grants'`), asked when the room's pieces stand. Before it came,
`decorIsShared` answered false, and the owner's press fell through to the save's window - empty for a shared chest. A
refused or thrown ask was never asked again, so a slow service made it the whole visit.

THE CHANGE: the owner's press in an online home goes through `openOwnChest`
(`decorGrants.js:"export function openOwnChest"`). Until the answer stands, the chest stays shut
("The chest stays shut.") and the ask goes out again if none is out. A shared chest opens the bin, a private one the
save's window. An answer for an earlier room is not this room's (`asked`). A room with no grants door shares nothing.
The host's tail of `activateDecor` hands its window to it, at the same count of logical lines.

## HOME-STRANDED (3) - `src/systems/decor/homeStranded.js`, `server-account/src/decorAccess.js`

1 stood on the account service from #1223's deploy (2026-10-25, about 05:00Z) to the deploy that carried HOME-POUR
(about 22:15Z the same day). An in-game check on the base before HOME-POUR showed it: a crate made private while its
answer was lost came back empty, and when it was shared again the shared window listed the very goods. They were in the
record under `DaggerfallInterior [...]`, and `moveChest`'s share takes a piece's goods from every scene. The record keeps
them only until the client's first world move after its rejoin (`clearSceneCache`): the scene is not permanent.

Two more holes kept such goods at risk on main. The client's cache never drops what the service took: after a share, the
next checkpoint wrote the building's copy back, a ghost of the bin's goods. Set back to private, the pour counted that
ghost as already poured (`goodsIn` reads every scene), deleted the bin's rows, and the good stood under the building's
scene alone.

THE CHANGE:

- The pour counts only the home's own list as poured
  (`server-account/src/decorAccess.js:"const have = new"`), and
  takes the bin's goods out of every other scene in the same write (`clearGhosts`). Anything else there stays.
- The client follows the service's moves in its cache (`decorTool.js` `keepChestGoods`, `homeStranded.js`
  `dropGhosts`): a share drops the piece's goods from every cached scene, a pour drops the poured ones.
- At the boot, a held home's building scene that still holds goods with no piece of the save's standing for them is
  made permanent (`homesBootHost.js` `keepStrandedHomes`), so a world move before the owner's visit keeps them. The name
  stays permanent after: a house's deed may have made it so, and a permanent name with no entry keeps nothing.
- When the owner walks in and the grants answer arrives (`decorGrants.js` `noteDecorGrants`, handed the room's pool by
  the host at the same logical line count), `bringStrandedHome` moves those goods into the room's chests as the window
  reads them, and says so. It skips a chest the service shares or holds bin goods for (what the building holds of it is
  a ghost of the bin), and any good the save holds elsewhere: the pack, the chest, another scene. Moved goods leave the
  building's scene in the same step, so a second visit moves nothing.

WHAT IS LOST FOR GOOD: goods under a building's scene that a world move cleared before this deploy. The service keeps
a character's last two records (`obj`, `prev`) and the last one judged clean (`clean_obj`), nothing older, and no log
holds a chest's contents. Staff can roll a character back to `clean_obj` (`review.js`) only where that record predates
the loss and the player accepts losing everything since; otherwise STAFF-GIVE (`staffGive.js`) mints the template,
material and enchantments the player names, never the original piece. How many records still hold stranded goods was
not counted: that needs a read of every realm record in R2, and no staff session or account credentials were at hand.

A residual case is not caught: a ghost whose original the owner took out of the shared bin and then sold or dropped,
the chest made private, before the owner walks in. The ghost comes back as the good. It needs a stranded chest, a share
in the same session, a withdrawal and a disposal, all before this deploy.

## Left as it is

- Per-character storage. Since ACCOUNT-HOMES every character of the account enters its homes as the owner, and each
  keeps its own chest contents in its own save (`onlineHomes.js` `homesGoneFrom`'s note). A second character finds the
  chests empty. That is the design; making storage account-wide is the owner's call.
- ~~The 180-second hold on a shared chest is never refreshed (`decorAccess.js` `HOLD_S`'s note): a long sort closes with
  "Someone else is using this chest" and moves nothing. Nothing is lost.~~ Something was gained: a gold pile taken in that
  sort was the purse's at the click, so the refused close left it in the chest too - a dupe (two private reports,
  2026-10-26). RPT1026-CHESTGOLD: the window keeps its hold while it is used, a hold run out says so ('decor-lapsed'),
  and the gold reaches the purse only when the settle lands.
- `ACCOUNT_VERSION` is not moved. The client does not depend on the service's change.
