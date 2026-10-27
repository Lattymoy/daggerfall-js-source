# Audit ledger (lead's consolidation) - status per finding

## Lane A (world events) - in
- A1 HIGH CONFIRMED (lead re-ran probe + read pump): online + land past Bay: spawnGroundPlace.spawnAt -> _spawnCloneAt ->
  synthesizeDungeonLocation -> spawnedMapId throws RangeError past the Bay (spawnedDungeons.js:192). pixelBuild.js:243 every
  build; pump catch (world.js:16836) destroys pixel, BUILD-RETRY -> permanent holes. 39/800 px in a Skyrim box. From base's
  main merge 27a58c6ef7 (GROUND-AGREE) - in base and HEAD, not this PR's. Also tvLocationAt party walk path (world.js:27202).
  Fix: spawnAt returns null !inBay. One line + pin + mutant.
- A2 HIGH: GATE_LANES_OPEN=[0]; ground exists for lanes 1-8 (probe: real sites every province). Docs contradict (WW2 says
  opening = registering places; P7 says stays Bay's for scan cost 453ms). Needs relay change (world270 undeployed? in-place
  re-hash vs GATE_LANES_RELAY_MIN split), client gateLanes open, idle-slicing scans (A2c), A2b seat credit for lane>0
  (world.js:23078 gateSeatWord lane 0 only; one line regionOfTheatre).
- A3 MED: no online spawned dungeons / Elite tier past the Bay (only TESA8 lairs ~1-2%). Owner's call: elite lairs vs spawns
  under a world id lane.
- A4 LOW: Sky-Ketch single station at Daggerfall (owner's KETCH wording). Owner's call.
- A5 LOW docs: WW2 seats line, WW-C1 Motherlodes line superseded; WW2 vs P7 contradiction.
- Recorded-partly: Starfall (Bay scan, wire px 0..999; covens all Bay witches), Abyss census Bay 62, raids WW6 (blocker gone).

## Lane B (living world, towns, quests) - in
- B1 HIGH CONFIRMED (lead read): Project Legacy (default on) heir birth with seat past the Bay -> boot throws
  "location not found: Skyrim/Solitude" (world.js:2795 maps.getLocationByName MAPS.BSA only); seat recorded from
  locationIndex (tamrielPlacesHost sets past-Bay places). Also nearestTownAnywhere walks Bay 62 only (heir born far away).
- B2 MED = E1: market couriers no road to/from provinces (hubs from MAPS.BSA rows only, world.js:1912/2441).
- B3 MED-LOW: quest %di directions "...never mind..." past the Bay (questWorld.js:324 raw maps; talk.js:189 regionCount 62).
- B4 LOW-MED: Talk "Where is" regional always not found past Bay (world.js:18944 maps.getRegion null).
- B5 LOW-MED: map items / TG / DB reveals do nothing past Bay, item consumed (world.js:12922).
- B6 LOW: Mages Guild scrying refused past Bay (world.js:12950). R2 record's reason stale.
- B7 LOW: %lp says Hammerfell/High Rock past the Bay (questMacros.js:767).
- B8 LOW = E3: Bounty edict at a seat past the Bay can never pay (townSeatLaw.js:1077 bountySitePixel Bay only).
- Recorded, stale/partly: no house for sale in Arena towns/country places (reason "until TESA3" stale; one-line extension of
  R2-9's deedHeldIn by mapId); FACTION.TXT no court/people for provinces (palace nobles offer commoner work; Random Ruler) -
  owner's call; latent: vampire clans 150-158 carry regions 62-70.
- Stale doc lines: World-Wide.md:154 crime on the road; :579-580 Motherlodes/writs.

## Lane E (wire, servers, saves) - in
- E1 = B2 market-no-road (CONFIRMED-BY-PROBE with the real Worker over node:sqlite).
- E2 MED: building discovery key `${regionIndex}:${name}` collides across same-named towns past the Bay (169 hamlet names /
  25,000 px in Skyrim; IC 625 slices 14 names): door plaques, I-box counts, lockpick blocks, quest re-stamps cross towns.
  Fix: key-maker adds #mapId past the Bay (automap already does).
- E3 = B8.
- E4 LOW staff: /town audit for a province lists wrong 400 (ORDER BY location with negative indices).
- Tip for D: snowfall pixelOn world.js:2904 Bay-bound bound.
- Recorded holds: Abyss census, raids/starfall, staff town events, province chat shards, naval wire regions, crowns,
  classic saves, town econ key, Ocean Holes (next ask after TAMRIEL-DEEP), arena in Daggerfall.

## Pending: C (travel/sea/maps), D (ground/ambience/wild), F (PR #1321 cold review)
## Lead's own: Deep-Waters "is the Bay's" WW3 line stale (TAMRIEL-DEEP). deepWaters rect keys Bay-only, fine.

## Lane F (PR #1321's own work) - in. ALL THREE ARE THIS PR'S OWN DEFECTS.
- F1 HIGH CONFIRMED (lead re-ran p1b on the working tree: lake cell 6840 ms, other span cells 18085 ms, re-flood after evict
  6449 ms; pixelBuild.js:1361 awaits dwNear with no timeout): RUMARE-WATER made all 625 IC pixels PIXEL_MIXED and each
  cell flood calls rumareWaterSampler (full generateSamples + blend + capitalSeaGround, ~10-13 ms) for every span pixel in
  its window, nothing kept. Player arriving at the IC (ship voyage lands there) waits 7-21 s for the near ring. Fix: memo
  per pixel on the bake / derive bits from the plan's law; isle all-land pixels PIXEL_LAND.
- F2 MED CONFIRMED (lead read roadPainter.js:128-131, roadCurves.js:275): TS9's blended ring halves never painted past
  the Bay (curved painter paves ring===1 only; straight pass handed road 0). Probe: Bay 72/72 halves, past Bay 2/72.
  ARENA2 pin built the "past the Bay" city on a Bay pixel. Fix: ring halves in roadCurves' ring pass + move the pin.
- F3 MED CONFIRMED (lead read townFabricStand.js:141, world.js:4234): TS10's walk-shut key lost through fabricWalkShut
  wrapper -> yard memo signature 'shut' always -> yards placed before roads landed kept (Bay and beyond). Fix: carry .key.
- Sound: IC-PACE, CLIMB-CREST, TS8, TS10 law, RUMARE seams/caches, NIBEN zone/canal, TAMRIEL-DEEP threads, ports/lanes,
  QUEST-FABRIC (staged merge) no clash (bakeFabricSites --check in step; questfabric 5/5; worker purity on merged tree).

## Lane C (travel, sea, maps) - in (lead spot-checked C1, C2, C9, C10 lines: match)
- C1 MED-HIGH: held map drops party members, other players, trader coin, serpent ring, Motherlodes past the Bay
  (heldMap.js:613 _size 1000x500, no host passes mapSize; readers at :2230..:2293). Fix ~6 lines (read over sheet).
- C2 MED: waypoints (personal/party/guild) can't exist past the Bay; WILD-WAYPOINT remains flag dead in Cyrodiil zone
  (mapWaypoints.js:75 onMap 1000x500). Fix ~1 line -> worldPixelOk.
- C3 MED: tvPlaceSummary past-Bay reads locationIndex only (filled on build): passages to ports past the Bay vanish from
  lists; a booked passage past the Bay saved+reloaded silently never resumes (passageHost.js:176-177 every 20 s);
  Overworld far plates snapshot (settlements once); quest diamond presses do nothing. Fix: host module (stand on demand).
- C4 MED: Overworld shows no dungeons past the Bay (dungeonRows(mapDict) Bay only).
- C5 MED-LOW: no Harbormaster tab at the 29 ports past the Bay (crown null). Partly recorded (crowns owner's call).
- C6 MED-LOW: 4 capital harbours (Solitude, Alinor, Torval, IC Waterfront) stand no shipyard/crew hall/lighthouse/docks,
  banks sell no ship (portTownAndUnknown 0 in tamrielCapitals.js:785).
- C7 = E2 (discovery key collision; 907 places on 296 keys).
- C8 = B5 (map reveals).
- C9 MED-LOW: held map Find can't find any place past the Bay (heldMap.js:3446 Bay 62 only; 296/296 names missing).
- C10 MED-LOW: Travel Options road reads stop at the Bay's edge (pathData.js:66): Follow Paths "no path", junction map
  blank, straight walk on roads x60 not x100.
- C11 LOW: no port anchors/Ports filter past Bay; teleport card no province (_regionNameAt < regionCount); carriageTown
  decodes id as y*1000+x (walled cities past Bay never show the carriage wheel).
- C12 LOW: CSA's own position map is the Bay's picture.
- Recorded: TESA-NO-FAST holds (owner); OWNER item (journey FROM past Bay TO Bay is DFU fast travel) awaiting owner;
  crowns line's "until WW-R" stale (re-recorded owner's call); countryside "no harbour" no reason given (29 ports vs 106);
  doc-only stale: WW1 crime line, Arena "port byte 0", VOYAGER2.1 "trips stay on the Bay".
