// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { composeSessionState, snapshotPlayer } from '../systems/save/save.js';
import { layoutStampOfPixel, stampLayout } from '../systems/layoutPins.js';
import { localizedText } from '../systems/textManager.js';
import { mergeWeaponPose, weaponPoseOf } from '../combat/playerWeapon.js';
import { modSaveRecords } from '../systems/modSaveData.js';
import { mwViewSaveCamera } from '../player/mwView.js';
import { playerEntity } from '../characters/playerEntity.js';
import { QUICK_SAVE_NAME, requestScreenshot, saveSlot } from '../systems/save/saveSlots.js';
import { realmSaveSink } from './shared.js';
import { sayRealmSave } from '../systems/realmSaves.js';
import { stakedSaveRefusal } from '../ui/gambitTableWords.js';

/** @param {any} host */
export function createWorldQuickSave(host) {
  const {
    HCC_VENDOR, _spawnLedger, cam, campToRecord, camps, cityGuards, droppedLoot, droppedTorches, exteriorFoes,
    groundFrameHeight, groundFrameNative, hccRuntime, player, playerTicker, playerTravelPixel, state,
    townTalk, walkMode, weaponRig
  } = host;
  // P-slice: the ABOVE-GROUND QUICKSAVE (F9/F11, the dungeon's
  // bindings). The envelope is the dungeon's snapshotPlayer - entity,
  // items, spells, conditions, faction rep, the T4 discovery store -
  // plus this host's world half: the map pixel and the NATIVE world
  // coordinates (stable across every floating-origin recenter) with
  // the compensation-free height. One classic slot, shared with the
  // dungeon key: loading a save from the other side restores the
  // CHARACTER and says so (cross-side travel-on-load pends with the
  // dungeon's own note).
  /** Save(name, saveName) over the host's own envelope; F9 is the
   *  QuickSave name (QuickSave() = Save(Name, quickSaveName)) and the
   *  slot window's saveAs passes the typed one. */
  function worldQuickSave(saveName = QUICK_SAVE_NAME, { quiet = false, sink = null } = {}) {   // REALM P0.5: a quiet checkpoint takes no shot and says only a failure; P1.3: a realm character's goes to the service
    // AUDIT OH-F B4: never a save inside the descent (one frame in DFU): it would write the swimmer on the template's
    // land with the mod's record not yet Active. AUDIT REALM2 M5: said to a save pressed, never to the quiet checkpoint
    if (host.ohAbyss?.entering) { if (!quiet) townTalk.say('You cannot save now.'); return false; }   // cannotSaveNow (Internal_Strings)
    // AUDIT C&C (lens H): nor inside a journey. DFU's fast travel is one frame - TeleportToCoordinates, then RaiseTime
    // (DaggerfallTravelPopUp.cs :333, :344) - and here the teleport is awaited, frames running, before the clock moves:
    // a save between them (the online checkpoint, the page's exit save, a key) wrote the arrival's place with the
    // departure's clock and needs, and a load of it was there for nothing. The checkpoint tries again when next due.
    if (host._traveling) { if (!quiet) townTalk.say('You cannot save now.'); return false; }
    // AUDIT NAV1 (B14): nor in a boarding or on a ship of the sea's deck - the sea is never a save's, and the load set the
    // player over open water, the ship and her prize gone
    if (host.naval?.saveRefused?.()) { if (!quiet) townTalk.say('You cannot save now.'); return false; }
    // AUDIT CARDS-2 H1: nor with chips on a card table - the purse is short the buy-in and the chips are in no save
    if (host.modes?.cardTableLive?.()) { if (!quiet) townTalk.say('You cannot save with chips on the table.'); return false; }
    // CARDS10: nor with a card staked on a game of Iliac Hand - the card it may cost is in no save
    if (host.modes?.iliacStaked?.()) { if (!quiet) townTalk.say('You cannot save with a card staked on the table.'); return false; }
    if (host.modes?.gambitStaked?.()) { if (!quiet) townTalk.say(stakedSaveRefusal()); return false; }   // KG3: gold staked on The King's Gambit (Kings-Gambit.md 5.7)
    const pf = walkMode && host.playerSpawned ? player.pos : cam.pos;
    const wc = state.worldCoords(pf);
    // IS1 (AUDIT 26 F221): the inside-building half (SerializablePlayer
    // .cs:183-187) - resolved FIRST, because interiorSaveData writes
    // the live scene into the entity's P1 cache and snapshotPlayer is
    // about to read it. Null anywhere but interior mode. The world arm
    // below stays valid either way: the exterior pixel stands under
    // the building with its pools alive, and P8's unified frame makes
    // the inside position a plain world position.
    const interior = host.modes?.interiorSaveData?.() ?? null;
    // WD3: the load re-enters this building by its door, which names a building only in its town's layout - the
    // layout rides with it, and the load keeps the town in it (applyLayoutPins); none for classic
    if (interior) { const at = playerTravelPixel(); stampLayout(interior, layoutStampOfPixel(at.x, at.y)); }
    // AUDIT 63 F24: ...and the interior host's LIVE ENEMIES with it.
    // SaveLoadManager.cs:865's enemyData is unconditional, and the
    // fourth host's two pools rode nothing. Natives through the same
    // converter the outdoor pools take, with the compensation shed per
    // record - the pile/foe/guard law three lines below.
    const interiorPools = host.modes?.interiorPoolSnapshot?.((pos) => state.worldCoords(pos)) ?? null;
    if (interior && interiorPools) {
      const shed = (rows) => (rows ?? []).map((r) => ({ ...r, y: groundFrameNative(r.nativeX, r.nativeZ, r.y - state.compensation[1]) }));   // AUDIT LANDFORMS C1: DFU's frame
      interior.foes = shed(interiorPools.foes);
      interior.guards = shed(interiorPools.guards);
    }
    // SL-2 (AUDIT 65): THE RIG IN THE PLAYER'S HANDS. DFU has ONE
    // WeaponManager for every WorldContext and SerializablePlayer
    // .cs:175-176 reads it wherever the save is taken; this host has
    // four rigs and was reading its own EXTERIOR one unconditionally,
    // so an F9 pressed inside a shop recorded the street's sheath and
    // hand. The mode host answers for the rig that is actually drawn
    // and null outside interior mode (the dungeon owns its own
    // composer, dungeonContext.js:"damage = trunc(5 * (distance - 5))"), so exterior mode and a
    // pre-seam mode host compose exactly as before, per field.
    const wp = host.modes?.weaponPose?.() ?? null;
    const snap = snapshotPlayer(playerEntity, {
      interior,
      classicMinutes: Math.floor(playerTicker.ownMinutes),   // LIVED1: the save's clock is the character's own (every marker it holds is on it); save.js adds the world's minute beside it online
      readiedSpellIndex: host.magic.readiedIndex(),
      // B4: quest (Q4-v: machine + notebook + one-time list) and talk
      // (SaveDataConversation WHOLE, :368-375: the mill + questor-post
      // dict (TK-i), dictQuestInfo (TK-ii), npcsWithWork +
      // castleNPCsSpokenTo (TK-iv)) through the ONE composer both
      // hosts call - two inline copies of this envelope is exactly
      // how the dungeon half drifted to saving neither.
      ...composeSessionState({ questBridge: host.questBridge, talk: { mill: host.rumorMill, tree: host.topicTree, session: host.npcSession }, spawnLedger: _spawnLedger }),   // TTL1: the spawned-dungeon clocks ride every save
      // AUDIT 26 F222/F223/F101: the POSE - weaponDrawn
      // (SerializablePlayer :175, restored Sheathed = !weaponDrawn),
      // yaw/pitch/isCrouching (PlayerPositionData_v1 :212-214).
      // MW-D30: the camera's two persisted halves ride the pose - the
      // reference saves the first/third flag in its own REC_CAM_ record
      // (worldimp.cpp:425-427) and the zoom distance through the camera
      // script's onSave (camera.lua:350-352).
      // AUDIT 39: and the TRANSPORT MODE, SerializablePlayer.cs:179's
      // own line beside the weapon and the boarding memory the port
      // already took (:180 -> snap.boardShipPosition). The mode lives
      // on the motor, host-owned like the weapon, so it rides the pose
      // bag rather than the entity envelope.
      // AUDIT 63 F25: the SECOND line of that pair. DFU writes the
      // sheath and the HAND together - SerializablePlayer.cs:175-176
      // `data.weaponDrawn = !weaponManager.Sheathed;` /
      // `data.usingLeftHand = !weaponManager.UsingRightHand;` - and
      // restores them together at :420-421. The port carried only the
      // first line, so a player fighting with the left-hand weapon
      // loaded back on the right hand's item (or bare fists). The
      // port stores the POSITIVE sense because PlayerWeapon holds
      // `usingRightHand`; it is the same bit.
      // FALL-KEPT (FIELD BUGS 2026-09-30): and the FALL, which DFU never
      // keeps - a save a metre above the ground loaded from rest and
      // billed one metre. The motor's own record, null off a fall
      // (motor.js fallSnapshot); the load lands it with the position.
      pose: { yaw: cam.yaw, pitch: cam.pitch, crouching: !!player.crouching, ...mergeWeaponPose(wp, weaponPoseOf(weaponRig.playerWeapon)), camera: mwViewSaveCamera(), transport: player.transportMode, fall: player.fallSnapshot() },   // SL-2: the pair off the LIVE rig (the mode seam above), else this host's own - PER FIELD, which is mergeWeaponPose's whole job
      modData: { [HCC_VENDOR]: hccRuntime.getSaveData(), ...modSaveRecords() },   // WA1: every registered mod's record beside it (systems/modSaveData.js)   // AUDIT HCC H3: the mod's own record (WagonSaveData, GetSaveData [IL_9354]) in DFU's per-mod slot - written whatever the switch says, so a save taken with the mod off keeps the horse's name and the parked wagon for when it comes back on
      locationKey: 'world',
      world: {
        pixel: playerTravelPixel(), nativeX: wc.x, nativeZ: wc.z, y: groundFrameHeight(pf[1] - state.compensation[1], pf[0], pf[2]),   // AUDIT LANDFORMS C1: every height below in DFU's frame
        // P2-slice (items-2): loose piles ride the envelope in
        // NATIVES with the compensation-free height, the player
        // half's exact law.
        piles: droppedLoot.snapshotWorld((pos) => state.worldCoords(pos)).map((sp) => ({ ...sp, y: groundFrameNative(sp.nativeX, sp.nativeZ, sp.y - state.compensation[1]) })),
        droppedTorches: droppedTorches.snapshot((pos) => { const wc = state.worldCoords(pos); return [wc.x, groundFrameHeight(pos[1] - state.compensation[1], pos[0], pos[2]), wc.z]; }),
        camps: camps.snapshot(campToRecord),   // SURV3: my camps, in natives   // HT1: the mod's own save data rides the envelope
        // AUDIT 26 F216/F217: LIVE ENEMIES ride the envelope - DFU's
        // SaveData_v1 carries enemyData wherever the player stands
        // (:865, restored :1006). Saved nowhere, a quickload during a
        // wilderness ambush or a guard pursuit despawned every
        // attacker with the spawn catch-up suppressed: a free escape
        // from any outdoor fight. Natives, the pile law; the
        // compensation-free height rides per record.
        foes: exteriorFoes.snapshotWorld((pos) => state.worldCoords(pos)).map((sf) => ({ ...sf, y: groundFrameNative(sf.nativeX, sf.nativeZ, sf.y - state.compensation[1]) })),
        guards: cityGuards.snapshotWorld((pos) => state.worldCoords(pos)).map((sg) => ({ ...sg, y: groundFrameNative(sg.nativeX, sg.nativeZ, sg.y - state.compensation[1]) })),
      },
    });
    const into = sink ?? realmSaveSink();   // REALM P1.3: a realm character's save is the service's checkpoint, never a local slot
    if (into) { const said = into(snap); if (!quiet) sayRealmSave(said, (t) => townTalk.say(t)); return true; }   // AUDIT REALM2 C2: the realm's answer, not a hope
    const r = saveSlot(playerEntity.name, saveName, snap);
    // SS1: the shot is DEFERRED to frame end (SaveGame's two
    // WaitForEndOfFrame yields) - the frame loop's
    // capturePendingScreenshot delivers it once the save window has
    // popped, HUD in shot exactly as the C# leaves it.
    if (r.ok && !quiet) requestScreenshot(r.key);
    if (!r.ok || !quiet) townTalk.say(r.ok ? localizedText('gameSaved', 'Game saved.') : 'Save failed (storage full or disabled).');
    return r.ok;
  }
  return { worldQuickSave };
}
