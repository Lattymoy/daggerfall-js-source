# FIELD BUGS 2026-10-25d - house storage disappears

One report, through the owner: "Disappearing House Storage: Items placed inside house storage randomly disappear". Read
on main's `80eafd01f`. Two earlier reports with the same words were other causes, already fixed: HOME-WIPE
(`Field-Bugs-2026-10-07.md`, a home the arena moved) and HOLD-KEPT (`Field-Bugs-2026-10-12g.md`, a chest's record by its
index). Both defects below came in with the decorations overhaul (#1223, merged 2026-10-25), which moved a shared
chest's goods out of the owner's save into the service's `decor_bin`. A report from a build before that merge is
neither of them. The pins are `test/server/fb1025d_homepour.test.js` and
`test/systems/decor/fb1025d_sharewait.test.js`; the mutants are `tools/mutants/fb1025d_homestorage.json` (10, all dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Items placed inside house storage randomly disappear" | A shared chest set back to private had its goods written into the building's scene, which the owner's client never reads for its home and which the next world move clears | HOME-POUR |
| 2 | (the same) | The owner's shared chest opened the save's window, empty, until the service said it was shared - for the whole visit if that answer never came. What went in there was hidden behind the bin | HOME-SHARE-WAIT |

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
(`server-account/src/decorAccess.js:"const name = homeSceneName(mapId, buildingKey);"`). The scene is made permanent in
the same write, so a save that had no scene for the home keeps the poured goods across a world move.
`test/server/decoraccess.test.js` laid its chest under the building's scene, the server's own wrong name; it lays it
under the home's now.

## HOME-SHARE-WAIT (2) - `src/systems/decor/decorGrants.js`, `src/scenes/worldModes.js`

Which chests are shared is the service's answer (`op: 'grants'`), asked when the room's pieces stand. Before it came,
`decorIsShared` answered false, and the owner's press fell through to the save's window - empty for a shared chest. A
refused or thrown ask was never asked again, so a slow service made it the whole visit.

THE CHANGE: the owner's press in an online home goes through `openOwnChest`
(`decorGrants.js:"export function openOwnChest(id, online, openSave) {"`). Until the answer stands, the chest stays shut
("The chest stays shut.") and the ask goes out again if none is out. A shared chest opens the bin, a private one the
save's window. An answer for an earlier room is not this room's (`asked`). A room with no grants door shares nothing.
The host's tail of `activateDecor` hands its window to it, at the same count of logical lines.

## Left as it is

- Per-character storage. Since ACCOUNT-HOMES every character of the account enters its homes as the owner, and each
  keeps its own chest contents in its own save (`onlineHomes.js` `homesGoneFrom`'s note). A second character finds the
  chests empty. That is the design; making storage account-wide is the owner's call.
- Goods already poured into a building's scene by a lost answer before this fix are not moved back.
- The 180-second hold on a shared chest is never refreshed (`decorAccess.js` `HOLD_S`'s note): a long sort closes with
  "Someone else is using this chest" and moves nothing. Nothing is lost.
- `ACCOUNT_VERSION` is not moved. The client does not depend on the service's change.
