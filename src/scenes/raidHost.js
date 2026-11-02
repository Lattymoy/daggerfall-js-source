// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { characterIdOf } from '../systems/characterId.js';
import { fieldOfView } from '../ui/viewSettings.js';
import { grantStaffSpoils } from '../systems/staffEventSpoils.js';
import { inEther } from '../world/ethericSea.js';
import { isTransformedLycanthrope } from '../systems/lycanthropy.js';
import { playerEntity } from '../characters/playerEntity.js';
import { politicClaimed } from '../systems/gate/gateSite.js';
import { isProvinceRegion } from '../formats/mapsTables.js';   // AUDIT TAMRIEL-WIDE C1: a province's politic is its region's too
import { RAID_SPAWN_MAX_DISTANCE, RAID_SPAWN_MIN_DISTANCE, outOfSight as raidOutOfSight, peerInEventPlace as raidPeerInPlace, raidSpawnRange, setRaidingPartiesHost } from '../systems/raidingParties.js';
import { REGION_NAMES } from '../formats/mapsFile.js';
import { spoilsLock } from './spoilsPool.js';
import { standLooseFoe } from './hostEnchant.js';
import { travelMapPickerData } from '../ui/travel/travelMapDoor.js';
import { keptPlaces } from '../net/staffPlaces.js';   // WW6: the world's registry, as the boot keeps it
import { capitalStreet } from './livingWorld/livingIndex.js';   // WW6: a capital one town (WW7-11)

/** @param {any} host */
export function createRaidHost(host) {
  const {
    _foeInTownRect, _musicInLocationRect, _questLoc, _questRegionIndex, _questStore, cam, cityGuards, collider,
    enchantFeet, etherSea, exteriorFoePool, exteriorFoes, maps, player, playerTravelPixel, state
  } = host;
  // RAID1: World Events - Raiding Parties' reaches into GameManager, answered by this host (systems/raidingParties.js).
  // Its raiders stand in the street's pool through DFU's loose-foe placement on the mod's own band - loose, so no
  // encounter cap refuses one, and transient, so no save carries one (the raid stands them again) - and its defenders
  // are the town watch's own (cityGuards.standDefender).
  setRaidingPartiesHost({
    random: Math.random,   // UnityEngine.Random.Range - THE ENGINE-PRNG RULE
    maps: () => maps,
    picker: () => travelMapPickerData(),   // DaggerfallUI.GetImgBitmap("TRAV0I01.IMG")
    regionIndex: () => { const px = playerTravelPixel(), pol = maps.getPoliticIndex(px.x, px.y); return !(etherSea && inEther(px.x, px.y)) && (politicClaimed(pol) || isProvinceRegion(pol - 128)) ? _questRegionIndex() : -1; },   // fix 8: the sea (politic 64) and an unmapped pixel are no province - AUDIT CAPTAIN'S SEA G7: nor the Eltheric Ocean (its composed politic is the isles' region's, and Betony's raids were announced to a captain past the Veil)
    regionName: (r) => REGION_NAMES[r] ?? String(r),   // GetLocalizedRegionName - the port speaks one language (ui/travel/travelMapWindow.js)
    townHere: (outdoors) => ((host.modes?.mode ?? 'exterior') !== 'exterior' ? null : outdoors || (_musicInLocationRect() ? _questLoc() : null)),   // FindCurrentRaid: outdoors, in the rect, at a location; STAFF-EVENT: `outdoors` (true) asks only that - an area's event
    playerPixel: () => playerTravelPixel(),
    standRaider: (mobileType, at, boss = false) => standLooseFoe({   // STAFF-EVENT PACKS: `at` a pack's place - around its leader's feet, or far (systems/raidingParties.js staffPackStep)
      collider, feet: at?.at ?? at?.near ?? enchantFeet(), yawRad: cam.yaw, fovDegrees: fieldOfView() * 180 / Math.PI, foes: exteriorFoePool(),
      spawn: (mt, pos, o) => exteriorFoes.spawnFoe(mt, pos, { yaw: o.yawRad, loose: true, transient: true, eventFoe: boss }),   // STAR-MASTER-FLED: the mini boss an event's own before its stand draws the mark
    }, mobileType, { ...raidSpawnRange(at), reach: (spot) => host.raidSites?.reachable?.(spot, at?.at ?? at?.near ?? enchantFeet()) ?? true }),   // RAID-REACH: on a street its player's street meets (scenes/raidSitesHost.js)
    standDefender: (threats) => cityGuards.standDefender({
      playerFeet: [...enchantFeet()], playerFwd: [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)], threats,
      minDistance: RAID_SPAWN_MIN_DISTANCE, maxDistance: RAID_SPAWN_MAX_DISTANCE,
    }),
    defenderCount: () => cityGuards.defenderCount(),
    defendersAllowed: () => !playerEntity.crimeCommitted && !isTransformedLycanthrope(playerEntity),   // the watch's own two refusals (_townWatchFrame)
    removeFoe: (f) => exteriorFoes.removeFoe(f),
    outOfSight: (f) => raidOutOfSight(f.ai?.feet, cam.pos, cam.yaw, fieldOfView() * 180 / Math.PI, (host.modes?.mode ?? 'exterior') === 'exterior'),
    reputation: () => ({ player: playerEntity, store: _questStore() }),
    // RAID2: the online arm - who I am, the peers standing in the raided town (their feet in the same rect the watch
    // reads a foe's), the raid's puppets I may have struck, the raid's foes I took over, on the net's own clock
    selfId: () => host.online?.id ?? null,
    wallNow: () => performance.now(),
    peersInTown: () => (host.peersNear() ?? []).filter((p) => _foeInTownRect({ ai: { feet: p.feet } })).map((p) => p.id),   // FIELD-RAID-FT: no room open (a fast travel between the old cell's room and the new) is nobody in town, never a null walked - the crash Discord reported arriving in a raided town
    sites: () => host.raidSites,   // RAID5: the town's places and people a raid's kind stands (scenes/raidSitesHost.js)
    peerFeetInTown: () => [[host.online?.id ?? '', player.feetAt(), playerEntity.level ?? 1], ...(host.peersNear() ?? []).filter((p) => raidPeerInPlace(p.feet, host._musicLoc ? _foeInTownRect : null, state, playerTravelPixel())).map((p) => [p.id, p.feet, host.online?.peers.get(p.id)?.lv ?? 0])],   // PACK-SPREAD: where each player in the town stands, for its share of the packs; BOSS-SPOT: me first, and each one's level
    raidPuppets: () => exteriorFoes.foes.filter((f) => f.puppet && f._pupRaid),   // STAFF-EVENT THE REWARD: the fallen too - a puppet I fought that fell is my kill on the board
    ownRaidFoes: () => exteriorFoes.foes.filter((f) => !f.puppet && f.raidKey && !f.dead),
    // RAID3: the relay's arm - does it keep this world's raids, and my word to the town's cell
    relayRaids: () => !!host.online?.raidOk,
    sendRaid: (w, cell) => !!host.online?.sendRaid(w, cell),
    // WW6 (bible/03-World/World-Wide.md WW6): the towns past the Bay the lanes raid - the world's registry, as the boot keeps
    // it (net/staffPlaces.js keptPlaces: `gamePlaces(createWorldPlaces())`), TESA's places on it where the land stands; a
    // capital one town, its centre (WW7-11)
    places: () => keptPlaces(),
    street: capitalStreet,
    // RAID4: my receipt for a town I held - to the account service with the character that fought it
    onRaidReceipt: (r, c, held) => { (c?.v ? grantStaffSpoils(host.raidSpoils, spoilsLock, c, playerEntity?.level ?? 1) : host.raidClaims?.add(r, characterIdOf(playerEntity), typeof playerEntity?.name === 'string' ? playerEntity.name : null, playerEntity?.level ?? 1, held === true)); },   // AUDIT WORLD-EVENTS L3-14: and whether the town was held, kept with the receipt for the character that fought; RAID4: to the account service - AUDIT RAID R4: whose answer gives the town's thanks (onSpoils); STAFF-EVENT THE REWARD: an event's receipt (`e1`, its claims name `v`) rolls its spoils here (systems/staffEventSpoils.js)
  });
}
