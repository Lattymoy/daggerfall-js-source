// @ts-check
// HOME-POUR (FIELD BUGS 2026-10-25d, bible/01-Overview/bugs/Field-Bugs-2026-10-25d.md): THE SCENE AN ONLINE HOME'S THINGS
// ARE KEPT UNDER in its owner's save - its own, never the building's (systems/online/onlineHomes.js, "AN ONLINE HOME KEEPS
// ITS OWN SCENE"). One home for both ends: the client reads and writes it, and the account service writes a chest's goods
// back into it (server-account/src/decorAccess.js moveChest). A leaf of its own, outside net/homeLaw.js, which the relay's
// law hashes (test/net/relayversion.test.js): the relay never reads a save's scenes.

/** The home's scene name: the town's unsigned map id and the building's key. */
export const homeSceneName = (mapId, buildingKey) => `OnlineHome [MapID=${Number(mapId) >>> 0}, BuildingKey=${buildingKey}]`;
