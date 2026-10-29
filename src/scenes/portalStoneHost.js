// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { areEnemiesNearby } from '../systems/encounters.js';
import { hudFade } from '../ui/fadeLayer.js';
import { isOnShip } from '../systems/ship.js';
import { madeRuleHere } from '../systems/madeLevel.js';
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { PORTAL_HOLD_TEXT, PORTAL_TEXT, portalHold, portalStonePlace, spendPortalStone } from '../systems/portalStone.js';
import { travelMapDoorReady } from '../ui/travel/travelMapDoor.js';
import { teleportJourney } from '../systems/travel/pastBayTravel.js';   // PORTAL-BAY: the teleport's law past the Bay
import { pvpFlagOn } from './pvpFlagHost.js';   // PVP-FLAG: unflagged, a stone is free of the zone's law

/** @param {any} host */
export function createPortalStoneHost(host) {
  const {
    _mode, buildTravelMapWindow, cam, cityGuards, collider, csaBoatUnderMe, duelEnemyNear, exteriorFoes,
    hccRuntimeOn, navalHostileNear, player, playerTravelPixel, portalGates, teleportTo, townTalk, walkMode,
    worldMoveBusy
  } = host;
  /** PORTAL-BAY (bible/06-Systems/Portal-Stone.md): THE TELEPORT'S GATE, asked where a refusal still costs nothing - the
   *  pick (before a stone is spent) and the step (before the black): teleportTo's own three in its order (scenes/world.js
   *  - the open zone's, the Veil's, and the zone's journey under the teleport's law past the Bay, pastBayTravel.js
   *  teleportJourney), each said where it refuses. True when refused. */
  // PVP-FLAG (the owner: "with no flagg we will allow player to use portal stone anywwere"): unflagged, the zone's law is not asked
  const zoneRefused = (to = null) => pvpFlagOn() && host.wildTeleportRefused(to);
  const teleportRefused = (to) => zoneRefused(to) || host.veilRefused(to) || !host.wildTravelGate(to, 0, teleportJourney).ok;
  /** PORTAL1 (systems/portalStone.js): THE HOLDS, here - portalHold's ladder over this host's own words: dead or a move
   *  under way, my duel (an arena bout's hold with it), a siege's room (its wards: Teleport, Recall and Levitate do
   *  nothing there), an enemy near (the travel map's own pool), a journey (Travel Options' or the Overworld's). The door,
   *  the pick and the step all ask it (AUDIT PORTAL1 U2/U3/O4: the step asked none of it, and the pick only some). */
  const portalHoldNow = () => portalHold({
    dead: !(playerEntity.health > 0), busy: worldMoveBusy() || host._teleporting,
    duel: duelEnemyNear(), siege: host.inSiegeRoom(),
    enemies: areEnemiesNearby([...cityGuards.guards, ...exteriorFoes.foes]) || navalHostileNear(),
    journey: !!host.travelOptions?.isTravelActive || host.travelView.state !== 'off',
  });
  /** Why a portal may not open where I stand, or null: the open world's alone, the holds, the water, a boat's deck (a
   *  portal stands in the world's frame and would be sailed away from), and one of mine at a time. */
  const portalDoorRefusal = () => {
    if (_mode() !== 'exterior' || madeRuleHere('portalStone') === 'refused') return PORTAL_TEXT.notHere;   // EG-H2: and never in a made level (the made level's law - each is a dungeon too)
    const hold = portalHoldNow();
    if (hold) return PORTAL_HOLD_TEXT[hold];
    if (player.isPlayerSwimming) return PORTAL_TEXT.water;
    if (csaBoatUnderMe() || isOnShip(playerEntity, playerEntity.boardShipPosition ?? null, playerTravelPixel())) return PORTAL_TEXT.aboard;
    if (portalGates.mine()) return PORTAL_TEXT.standing;
    return null;
  };
  /** PORTAL1: A PORTAL STONE USED - asked at the door (portalDoorRefusal), then the travel map in teleport mode - the
   *  Mages Guild's, with no Travel Options fee: the stone is the fare - and a place picked there spends ONE stone
   *  (standPortal). A map closed without a pick spends nothing. Answers false when refused (the hotbar's refusal), the
   *  refusal said. */
  function openPortalStone(item, list) {
    const refuse = (line) => { townTalk.say(line); return false; };
    const why = portalDoorRefusal();
    if (why) return refuse(why);
    if (zoneRefused() || host.veilRefused()) return false;   // AUDIT CAPTAIN'S SEA P6: past the Veil its map's every place is across it - AUDIT TESA II Z5: and a stone's portal is a teleport (PVPDUNGEONS: "of any kind"), never out of the open zone
    if (!travelMapDoorReady()) return refuse(PORTAL_TEXT.noMap);
    // the list it came from, read again at the pick - a load in between stands a new pack (AUDIT PRE-MERGE 0928 S2's
    // law); a companion's or a sworn revenant's own storage is its own list (AUDIT PORTAL1 I2)
    const live = list === playerEntity.wagonItems ? () => playerEntity.wagonItems
      : list === playerEntity.items || !Array.isArray(list) ? () => playerEntity.items : () => list;
    const win = buildTravelMapWindow({
      travelOptions: () => null,   // the stone is the fare - never Travel Options' teleport fee
      portalLandPastBay: true,   // PORTAL-ANYWHERE (the owner: "Anywhere on land"): the stone's map picks any land past the Bay - the guild's keeps TESA13's cities
      onTeleport: (pick) => { standPortal(pick, item, live); },
    });
    if (!win) return refuse(PORTAL_TEXT.noMap);
    win.activateTeleportationTravel();
    townTalk.showOverlay(win);
    return true;
  }
  /** The pick: the door asked again (the world moved on while the map stood - a foe came, a duel was called, death),
   *  the place found (portalStonePlace: short of a wall, on the ground, off an event's gate's ground), ONE stone spent, the portal torn open, and - online
   *  - the next foes frame owed full, so the cell hears of it at once. The classic teleport box smashed the screen to
   *  black for an arrival that is not coming yet, so a black screen lifts; the held map smashes nothing, and nothing is
   *  faded there (AUDIT PORTAL1 U4: every pick on it flashed the screen black). */
  function standPortal(pick, item, live) {
    if (hudFade.backgroundColor[3] > 0 && !hudFade.fadeInProgress) hudFade.fadeHUDFromBlack();
    if (!pick?.pixel) return;
    const why = portalDoorRefusal();
    if (why) { townTalk.say(why); return; }
    if (teleportRefused(pick.pixel)) return;   // AUDIT CAPTAIN'S SEA P6 - AUDIT TESA II Z5: never into the open zone (the guild's teleport's and Recall's law) - PORTAL-BAY: the teleport's whole gate, before a stone is spent
    const feet = walkMode && host.playerSpawned ? player.feetAt() : cam.pos;
    const place = portalStonePlace(feet, cam.yaw, {   // RPT1026-EVENTS GATE-WAY: refused before an event's gate (systems/eventGround.js), nothing spent
      ground: (o, d, m) => collider.surfaceHit(o, d, m)?.dist,   // the ground there - a mesh or the terrain, whichever is nearer (CAMP-GROUND's probe)
      wall: (o, d, m) => collider.raycastHit(o, d, m)?.dist,   // a wall, a fence, a house in the way
    });
    if (place.refused) { townTalk.say(PORTAL_TEXT[place.refused]); return; }
    if (!spendPortalStone(item, live())) { townTalk.say(PORTAL_TEXT.gone); return; }
    portalGates.open(place.at, { pixel: { x: pick.pixel.x, y: pick.pixel.y }, name: pick.name });
    host._foesFullAt = -Infinity;
    surfacePlayer();
    townTalk.say(PORTAL_TEXT.opened(pick.name));
  }
  /** THE ARRIVAL: the screen black at once, the teleport a microtask on - OFF THE FRAME's draw (AUDIT PORTAL1 U6: the
   *  step is found inside the frame, and the teleport's synchronous half tore down batches the same frame then drew;
   *  every other teleport is called from input or deferred the same way) - the guild's own (teleportTo), with the
   *  following team's cache around it as every other journey's (HCC, AUDIT HCC H2: AUDIT PORTAL1 U7), and an arrival
   *  that failed lifts the black (AUDIT PORTAL1 U5). */
  function portalArrive(g) {
    if (teleportRefused(g.dest?.pixel ?? null)) return;   // AUDIT TESA II Z5: the step is each traveller's own teleport - never into, out of or inside the zone, whoever opened it; PORTAL-BAY: asked BEFORE the black, said, and the screen never blacked for an arrival that is not coming
    hudFade.smashHUDToBlack();
    Promise.resolve().then(async () => {
      if (worldMoveBusy() || host._teleporting) { hudFade.clearFade(); return; }
      hccRuntimeOn()?.handlePreFastTravel();
      try { if (!(await teleportTo(g.dest, { zoneFree: !pvpFlagOn() }))) hudFade.clearFade(); }   // AUDIT TAMRIEL-WIDE III F1: the zone asked above, by the flag - the stone already spent   // PORTAL-BAY: no arrival (the world moved on in between) lifts the black - never a black screen over a refusal
      finally { hccRuntimeOn()?.handlePostFastTravel(); }
    }).catch((e) => { console.warn('[portal] the arrival failed:', e?.message ?? e); hudFade.clearFade(); });
  }
  return { openPortalStone, portalArrive, portalHoldNow };
}
