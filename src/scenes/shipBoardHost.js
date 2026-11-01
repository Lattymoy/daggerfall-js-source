// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { hudFade } from '../ui/fadeLayer.js';
import { playerEntity } from '../characters/playerEntity.js';
import { RECORD_GROUND_STAMP } from '../world/terrain/terrainSampler.js';
import { REPOSITION, shipMemory, shipRestorePos, shipTransition } from '../systems/ship.js';

/** @param {any} host */
export function createShipBoard(host) {
  const {
    _teleportToPixel, cacheExteriorScene, cam, enterLinkedBankCabin, groundFrameHeight, player,
    playerTravelPixel, restandHeight, restoreExteriorScene, scaleOf, setTransportModeHere, state, walkMode,
    worldMoveBusy
  } = host;
  async function boardOrDisembark() {
    if (worldMoveBusy()) return;   // AUDIT 68 S22
    if (await enterLinkedBankCabin()) return;
    const here = playerTravelPixel();
    const t = shipTransition(playerEntity, {
      boardShipPosition: playerEntity.boardShipPosition ?? null,
      mapPixel: here,
      position: shipMemory({ mapPixel: here, pos: [player.pos[0], groundFrameHeight(player.pos[1] - state.compensation[1], player.pos[0], player.pos[2]) + state.compensation[1], player.pos[2]], yaw: cam.yaw, ...RECORD_GROUND_STAMP }, state.compensation[1]),   // AUDIT LANDFORMS C1: its height in DFU's frame   // TERRAIN-SCALE1 (audit): the ground `pos` stood on; AUDIT 68 S22: its height without the streamer's compensation
    });
    if (!t) return;
    // AUDIT ETHER-OW C2-3 (AUDIT CAPTAIN'S SEA P6's law): NO BOARDING ACROSS THE VEIL - "Your Ship" is the Bay's (its two
    // pixels in region 31), and the board is a teleport: from past the Veil the transport's Ship row and Warm Ashes' raid
    // carried a captain over and home again without the crossing, the boat left behind. Leaving the ship always goes
    // back where it was boarded (`boardShipPosition`), whichever side that is
    if (!playerEntity.boardShipPosition && host.veilRefused(t.go)) return;
    // TR-AUDIT F-F1: READ the reposition, never infer it from `restore`.
    // MEASURED, 2026-09-03, against the owner's real MAPS.BSA: the two ship pixels are not open sea - (2,2) and (5,5)
    // are region 31's "Your Ship" locations (HomeYourShips, blocks SHIPAA00/SHIPAA01, banking.js SHIP_INTERIOR_MAP_IDS).
    // So boarding is an ordinary location arrival:
    // RandomStartMarker (PositionPlayerToLocation, :1437-1447) stands the player on the deck at a random side of the
    // block, not at a terrain origin dropped to sea level. Pinned by tr4_ship.test.js's data gate.
    // AUDIT 68 S22: the height is stood in the arrival's frame (compensation[1] survives state.init); a memory
    // written raw, before the flag, cannot be recovered and is GROUNDED.
    const legacy = t.reposition === REPOSITION.None && !t.restore.compensationFree;
    const localPos = t.reposition === REPOSITION.None ? (shipRestorePos(t.restore, state.compensation[1]) ?? t.restore.pos) : null;
    // A10 - THE SCENE CACHE ROUND THE TELEPORT (:382-388, :393-398): cache the pixel left, teleport, restore the pixel
    // reached - DFU's "ship is special case, cache will not be cleared". Without it _teleportToPixel destroyed the loose
    // piles, so a chest dropped on the dock was gone once you boarded. The piles travel as DFU's DroppedLoot entries
    // (:558-566) in NATIVE coordinates, never local ones the floating origin would move.
    hudFade.smashHUDToBlack();   // WA1: UpdateMode's ship arm opens black (TransportManager.cs:364) - and the quest machine holds while it fades back (QuestMachine.Update)
    cacheExteriorScene(here);
    await _teleportToPixel(t.go.x, t.go.y, localPos, { reposition: t.reposition, grounded: legacy });
    // TERRAIN-SCALE1 (audit): a deck remembered by a save from before the stamp stood on the prefab's 1.5 - the
    // teleport stood the player on it verbatim (not grounded); stood again now, over the pixel just built
    if (localPos && !legacy) {   // LANDFORM1: the row's lift put back on; an older frame's moves and a settlement's carve, the row off too
      const c = state.compensation[1];
      const y = restandHeight(localPos[1] - c, localPos[0], localPos[2], scaleOf(t.restore.terrainScale), t.restore.groundFrame) + c;   // BAY-LEFT-GROUND: by its frame's law
      if (walkMode) player.spawn(localPos[0], y, localPos[2]);
      cam.pos = [localPos[0], y + (walkMode ? 0 : 40), localPos[2]];
    }
    restoreExteriorScene(t.go);
    if (t.restore) cam.yaw = t.restore.yaw;
    playerEntity.boardShipPosition = t.boardShipPosition;
    setTransportModeHere(t.mode);
    hudFade.fadeHUDFromBlack();   // WA1: ...and closes on FadeHUDFromBlack (:401), the arrival awaited, as teleportTo's is
  }
  return { boardOrDisembark };
}
