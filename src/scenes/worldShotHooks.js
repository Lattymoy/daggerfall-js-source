// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { areEnemiesNearby } from '../systems/encounters.js';
import { arenaLadderRestore, exhibitionFor } from '../systems/arena/arenaLadder.js';
import { audio } from '../systems/audio.js';
import { canRunHeavyRuntimeWork, canRunLightRuntimeWork } from '../world/deepWater/deepWaterRuntime.js';
import { AUDIO_CLIPS as CSA_AUDIO_CLIPS, setLights as csaSetLights } from '../systems/comeSailAway/comeSailAwayBoat.js';
import {
  BOAT_DEED_TEMPLATE as CSA_DEED_TEMPLATE,
  BOAT_PARTS_TEMPLATE as CSA_PARTS_TEMPLATE,
} from '../systems/comeSailAway/comeSailAwayItems.js';
import { quatRotate as csaQuatRotate } from '../world/quat.js';
import { forestAt } from '../world/terrain/terrainNature.js';
import { GRASS_TONES, GRASS_TONES_CLASSIC } from '../render/labGrass.js';
import { isEntityWaterWalking } from '../systems/effects.js';
import { liveBundles } from '../systems/mysticism.js';
import { liveStat } from '../systems/statMods.js';
import { pastBayPlacesIn } from '../world/pastBayPlaces.js';
import { playerEntity } from '../characters/playerEntity.js';
import { PUDDLE_RECORDS, puddleWetAt } from '../world/puddleMask.js';
import { REPOSITION } from '../systems/ship.js';
import { SEASON } from '../world/climateSwaps.js';
import { surfaceNormalAt, TERRAIN_TILE_DIM } from '../world/terrain/terrainSurface.js';
import { useItem } from '../systems/useItem.js';
import { WATER_DRAW_MASK_TABLE, waterCorners } from '../world/water/waterCorners.js';
import { worldMinutes } from '../systems/worldTick.js';
import { timeScale as worldTimeScale } from '../systems/timeScale.js';

/** @param {any} host */
export function createWorldShotHooks(host) {
  const {
    _csaBuckets,
    _csaLoops,
    _csaPics,
    _csaWidgetFrames,
    _teleportToPixel,
    arenaBouts,
    arenaCityPixel,
    arenaCityStage,
    arenaGate,
    arenaHerald,
    arenaHeraldAt,
    arenaStageNow,
    buildPixel,
    buildingDoors,
    built,
    cam,
    cityGuards,
    csa,
    csaActivate,
    csaActivationPick,
    csaCall,
    csaClipKey,
    csaModeCollider,
    csaRaycast,
    csaRender,
    csaRuntime,
    deepWaters,
    destroyPixel,
    droppedLoot,
    duelEnemyNear,
    dwDecor,
    dwEnemies,
    dwFish,
    dwFishLootHooks,
    dwPlayer,
    dwPlaying,
    exteriorFoePool,
    exteriorFoes,
    gamePaused,
    grassRecords,
    groundPuddles,
    heightAt,
    inFlight,
    labGrass,
    locationIndex,
    lookFilter,
    makeInventoryWindow,
    navalHostileNear,
    pauseDoorHooks,
    player,
    playerTravelPixel,
    queue,
    renderer,
    ripples,
    shotMode,
    state,
    townTalk,
    walkMode,
  } = host;
  // Shot-mode hooks: __move displaces the camera; __streamIdle reports
  // whether the build queue has drained.
  if (shotMode) {
    window.__move = (dx, dy, dz) => {
      cam.pos[0] += dx;
      cam.pos[1] += dy;
      cam.pos[2] += dz;
    };
    window.__pose = (x, y, z, yaw, pitch) => {
      // walk mode: the camera FOLLOWS the motor - move the player
      // (a bare cam.pos write is overwritten next frame; T1 probe fix)
      if (walkMode) {
        player.spawn(x, y, z);
        host.playerSpawned = true;
      } else cam.pos = [x, y, z];
      cam.yaw = yaw;
      cam.pitch = pitch;
    };
    window.__look = (yaw, pitch) => {
      cam.yaw = yaw;
      cam.pitch = pitch;
      lookFilter.settle();
    }; // CSA-F probe: the view turned in place (the helm pins the body, not the look)
    window.__streamIdle = () => queue.length === 0 && !host.building && inFlight.size === 0; // AUDIT EV: teleport builds count too - the probe told the truth only for pump's
    window.__builtCount = () => built.size;
    // LOAD-OWED probe surface (tools/pixelBuildSweep.mjs - the frame held by the probe, so nothing else runs): THE PUMP'S
    // OWN BUILD driven over the map, one pixel at a time - the stream re-centred on it as a teleport re-centres it (every
    // pixel down, the grid inited there), then `buildPixel`, a throw answered as the pump's catch answers it (torn down,
    // let go) and handed back with its stack. `again`: built, torn down and built once more, as a re-skin or a return
    // rebuilds a pixel after its release; `swap`: that rebuild under the other season (tickSeason's flip, both seasons'
    // sets in the session's caches), the season put back after.
    window.__pixelBuild = async (px, py, { again = false, swap = false } = {}) => {
      await Promise.allSettled([...inFlight.values()]); // a build the stream had under way finishes first
      for (const k of [...built.keys()]) {
        const [bx, by] = k.split(',').map(Number);
        destroyPixel(bx, by, { collectLoose: false });
        state.release(bx, by);
      }
      queue.length = 0;
      state.init(px, py);
      queue.length = 0;
      const t0 = performance.now();
      const one = async () => {
        try {
          await buildPixel(px, py);
          return null;
        } catch (e) {
          destroyPixel(px, py, { collectLoose: false });
          state.release(px, py);
          return { message: String(e?.message ?? e), stack: String(e?.stack ?? '') };
        }
      };
      let error = await one();
      if (!error && (again || swap)) {
        destroyPixel(px, py, { collectLoose: false });
        const was = host.season;
        if (swap) host.season = host.season === SEASON.Winter ? SEASON.Summer : SEASON.Winter;
        try {
          error = await one();
        } finally {
          host.season = was;
        }
      }
      const p = built.get(`${px},${py}`);
      return { error, ms: Math.round(performance.now() - t0), built: !!p, location: p?.location ?? null };
    };
    window.__locationPixels = () => [...locationIndex.keys()]; // the sweep's places: every location the index stands, mods' rows with the map's
    // the sweep's journey (tools/pixelBuildSweep.mjs --journey): the Overworld raised, and the clock, its hold and the stream read
    window.__overworld = () => ({
      entered: host.travelView?.enter() ?? false,
      allowed: host.travelViewAllowed(),
      danger: !!(duelEnemyNear() || areEnemiesNearby(host.wildSeen(exteriorFoePool()))),
      paused: gamePaused(),
      modal: host.modes?.modalWindowUp?.() ?? false,
    });
    window.__journeyState = () => {
      let owed = 0;
      for (const k of state.loaded.keys()) if (!built.has(k)) owed++;
      return {
        scale: worldTimeScale(),
        held: host.tvHeld,
        why: host.tvHeldWhy,
        walking: host.tvWalking,
        view: host.travelView?.state ?? null,
        pixel: playerTravelPixel(),
        built: built.size,
        owed,
        failed: state.failed.size,
        queue: queue.length,
      };
    };

    // OH-B probe surface: every streamed pixel's OceanPitTileState diagnostic past the hash's own "not selected", and its pit
    window.__ohStat = () =>
      host.oceanHoles
        ? [...built.values()]
            .map((e) => ({
              px: e.px,
              py: e.py,
              d: host.oceanHoles.stateOf(e)?.diagnostic ?? null,
              pit: e._ohPit ? host.oceanHoles.entranceOf(e) : null,
              sea: state.pixelTranslation(e.px, e.py, [0, 0, 0])[1] + deepWaters.oceanLocalY,
            }))
            .filter((r) => r.d && r.d !== 'rejected:not-selected')
        : null;
    window.__currentPixel = () => `${state.current.x},${state.current.y}`;
    // TESA2 probe surface (bible/03-World/Arena-Provinces.md): a jump to a pixel, as a fast travel lands (its start marker),
    // and what a built pixel stands - its place's name, its Arena slot, its blocks and buildings
    window.__tesaJump = (x, y) => _teleportToPixel(x, y, null, { reposition: REPOSITION.RandomStartMarker });
    // TESA13 probe surface (tools/tesa13MapProbe.mjs): the held map's read of the countryside and the lairs in a rectangle -
    // TESA15: the places the roads' regions laid
    window.__tesaPlaces = (x0, y0, x1, y1) => pastBayPlacesIn(x0, y0, x1, y1);
    window.__tesaPlace = (x, y) => {
      const b = built.get(`${x},${y}`),
        loc = locationIndex.get(`${x},${y}`);
      return {
        built: !!b,
        location: b?.location ?? null,
        arenaKey: b?.arenaSlot ? `${b.arenaSlot.provinceIndex}|${b.arenaSlot.id}` : null,
        name: loc?.name ?? null,
        arena: loc?.arena ?? null,
        mapId: loc?.mapTableData?.mapId ?? null,
        blocks: loc ? [loc.exterior?.exteriorData?.width, loc.exterior?.exteriorData?.height] : null,
        buildings: loc?.exterior?.buildings?.length ?? null,
        region: loc?.regionName ?? null,
        // TESA4: the Arena roads' layer it was painted with, whether they reached it, and the tiles the painter wrote
        roads: b
          ? {
              epoch: b.arenaRoadsEpoch,
              painted: b.arenaRoadsPainted,
              tiles: b.paths ? b.paths.reduce((n, t) => n + (t ? 1 : 0), 0) : null,
            }
          : null,
        // TESA6: its harbour byte, and the shipyard's and the lighthouse's sites its build stood
        port: loc ? (loc.exterior?.exteriorData?.portTownAndUnknown ?? 0) : null,
        portSites: b?.portSites?.length ?? null,
        country: loc?.country ?? null,
        type: loc?.mapTableData?.locationType ?? null,
      }; // TESA7: a country place's pixel, kind and template
    };
    // ARENA2 probe surface (tools/arenaProbe.mjs): the city floor's sand and the Herald's place, the bout standing (its
    // phase, its fighters' health, the crowd's mood and how many sit), and the Herald's three doors pressed as his choice
    window.__arena = () => {
      const b = arenaBouts.bout(),
        c = arenaBouts.crowd();
      return {
        centre: arenaCityPixel() ? [...arenaCityStage.centre()] : null,
        herald: arenaHeraldAt(),
        stage: arenaBouts.stageKind(),
        kind: arenaBouts.kind(),
        phase: b?.phase ?? null,
        result: b?.result ?? null,
        fighters: b
          ? b.fighters.map((f) => ({
              id: f.id,
              name: f.name,
              side: f.side,
              health: f.health,
              max: f.maxHealth,
              out: f.out,
            }))
          : [],
        mood: c?.mood ?? null,
        crowd: arenaBouts.batches().length,
        ladder: arenaLadderRestore(playerEntity.arenaLadder),
        mode: host.modes?.mode ?? 'exterior',
        near: arenaCityPixel()
          ? Math.hypot(player.pos[0] - arenaCityStage.centre()[0], player.pos[2] - arenaCityStage.centre()[2])
          : null,
        walk: !!walkMode && !!host.playerSpawned,
        hour: exhibitionFor(worldMinutes()),
        ran: host._arenaHourRun,
        pending: arenaBouts.pending()?.kind ?? null,
        frames: host._arenaFrames,
        paused: gamePaused(),
        stageNow: arenaStageNow()?.kind ?? null,
      };
    };
    window.__arenaHerald = () => arenaHerald();
    // ARENA3 probe surface (tools/arena3Probe.mjs): the gate's people and the window, the league and the purse
    window.__arenaGate = {
      recruiter: (r) => arenaGate.recruiter(r),
      bookmaker: () => arenaGate.bookmaker(),
      open: (p) => arenaGate.openWindow(p),
      board: () => arenaGate.board(),
    };
    window.__arenaLeague = () => ({
      league: playerEntity.arenaLeague ?? null,
      gold: playerEntity.goldPieces ?? 0,
      pauseDoor: !!pauseDoorHooks().arenaJoined?.(),
    });
    window.__arenaCloseOverlays = () => {
      let n = 0;
      while (townTalk.overlayActive && n < 40) {
        townTalk.closeOverlay?.();
        n++;
      }
      return n;
    }; // the tutorial's pages and the main quest's box, put away for a probe
    window.__arenaStrike = (dmg = 20) => {
      // a blow of mine on my bout's first opponent, through its pool's own door (a probe's swing)
      const b = arenaBouts.bout();
      const st = (host.modes?.mode ?? 'exterior') === 'dungeon' ? host.modes?.arenaFloorStage?.() : null;
      if (!b || !st) return false;
      const ctx = host.modes?.dungeonCtx;
      const foe = (ctx?.foes ?? ctx?.enemies ?? []).find((f) => f?.entity?.bout && !f.entity.bout.out);
      if (!foe) return false;
      ctx.damageFoe?.(foe, dmg, player.pos, null, { fromPlayer: true });
      return true;
    };
    // CSA-B probe surface: stand a boat at a pose (the placement ray is CSA-C's), light its lanterns, read the pool
    window.__csaSpawn = async (hull = 0, variant = 0, x = 0, y = 0, z = 0, yaw = 0) => {
      // CSA-C: through the runtime's own PlaceBoat (the int overload), the boat's forward along the yaw
      if (!csaRuntime || !(await csa.preload())) return null;
      csaRuntime.PlaceBoat([x, y, z], [Math.sin(yaw), 0, Math.cos(yaw)], hull, variant);
      return csa.stat();
    };
    window.__csaConsole = (line) => {
      const [name, ...args] = String(line).trim().split(/\s+/);
      return csaRuntime?.console[name]?.(args) ?? null;
    }; // CSA-C: a command, as the console runs it
    window.__csaReady = () => !!csaRuntime && csa.ready();
    window.__csaNodes = () =>
      csaRuntime?.AllBoats.map((b) => ({
        pixel: b.MapPixel,
        nodes: [...b.NodeTileMapIndices],
        active: b.GameObject.activeSelf,
      })) ?? null;
    /** GRASS-LOOK probe (tools/grassLookProbe.mjs): where to stand to see a FIELD - the centre of the first `r`-tile
     *  square of grass the archive's own records call grass (the player's pixel first), off any location's tiles, and
     *  the yaw that looks along it. `skip` passes over the first so many such squares, for a second look. GRASS-LIT2:
     *  `steep` asks for a hillside - the square's far half leaning at least that much (the ground normal's xz, off the
     *  near grid's normals), and the yaw that looks up or down it. */
    window.__grassSpot = (r = 6, skip = 0, steep = 0) => {
      r = Math.max(1, r | 0); // AUDIT GRASS-LIT2 B5: a zero step never left the loop
      const cur = built.get(`${state.current.x},${state.current.y}`);
      for (const p of [cur, ...built.values()]) {
        const grass = p?.tilemapBytes ? grassRecords.get(p.groundArchive) : null;
        if (!grass?.size) continue;
        const t = state.pixelTranslation(p.px, p.py, [0, 0, 0]);
        for (let tz = r; tz < 128 - r * 3; tz += r)
          for (let tx = r; tx < 128 - r; tx += r) {
            let all = true;
            for (let dz = -r; dz <= r * 3 && all; dz++)
              for (let dx = -r; dx <= r && all; dx++)
                all = grass.has(p.tilemapBytes[(tz + dz) * TERRAIN_TILE_DIM + tx + dx] >> 2);
            if (!all) continue;
            const x = t[0] + (tx + 0.5) * 6.4,
              z = t[2] + (tz + 0.5) * 6.4;
            const n =
              steep > 0 && p.groundNormals
                ? surfaceNormalAt(p.groundNormals, (tx + 0.5) * 6.4, (tz + r * 2 + 0.5) * 6.4, [0, 1, 0])
                : null; // AUDIT B5: the far half's middle
            if (steep > 0 && !(n && Math.hypot(n[0], n[2]) >= steep)) continue;
            if (skip-- > 0) continue;
            return {
              feet: [x, heightAt(x, z), z],
              yaw: n ? Math.atan2(n[0], n[2]) : 0,
              pixel: [p.px, p.py],
              archive: p.groundArchive,
              normal: n,
            }; // AUDIT B5: a hillside's yaw looks down it
          }
      }
      return null;
    };
    /** GRASS-LOOK probe: the field painted with other tones (render/labGrass.js GRASS_TONES' shape, four [r, g, b]
     *  ratios), or the shipped ones again with none */
    window.__grassTones = (tones, classic = false) => {
      if (labGrass) labGrass.setTones(tones ?? (classic ? GRASS_TONES_CLASSIC : GRASS_TONES), classic);
      return !!labGrass;
    }; // GRASS-LIT2: or the classic lane's; AUDIT MEADOW1: the meadow's art ground with them
    /** GRASS-LIT2 probe (tools/grassLookProbe.mjs): the heart of the deepest wood in the built pixels - the tile whose
     *  `r`-tile square reads the most forest (FOREST1's field, terrainNature.js forestAt) on ground the archive grows
     *  grass on, its feet and its pixel, the square's mean forest, and the pixel's origin. Where to look down on a wood
     *  from. `here` keeps to the player's own pixel, so a camera posed off it does not cross into the next. */
    window.__forestSpot = (r = 10, here = false) => {
      r = Math.max(1, r | 0); // AUDIT GRASS-LIT2 B5
      let best = null;
      const cur = built.get(`${state.current.x},${state.current.y}`);
      for (const p of here ? [cur] : built.values()) {
        const grass = p?.tilemapBytes ? grassRecords.get(p.groundArchive) : null;
        if (!grass?.size) continue;
        for (let tz = r; tz < 128 - r; tz += r)
          for (let tx = r; tx < 128 - r; tx += r) {
            if (!grass.has(p.tilemapBytes[tz * TERRAIN_TILE_DIM + tx] >> 2)) continue;
            let w = 0,
              k = 0;
            for (let dz = -r; dz <= r; dz += 2)
              for (let dx = -r; dx <= r; dx += 2) {
                w += forestAt(p.px * 128 + tx + dx, -p.py * 128 + tz + dz);
                k++;
              }
            if (!best || w / k > best.wood) best = { p, tx, tz, wood: w / k };
          }
      }
      if (!best) return null;
      const t = state.pixelTranslation(best.p.px, best.p.py, [0, 0, 0]);
      const x = t[0] + (best.tx + 0.5) * 6.4,
        z = t[2] + (best.tz + 0.5) * 6.4;
      return { feet: [x, heightAt(x, z), z], pixel: [best.p.px, best.p.py], wood: best.wood, origin: [t[0], t[2]] };
    };
    /** CSA-C probe: a land tile 3 tiles off a water tile (the player's pixel first) - where to stand, facing the water. */
    window.__csaShore = () => {
      const cur = built.get(`${state.current.x},${state.current.y}`);
      for (const p of [cur, ...built.values()]) {
        if (!p?.tilemapBytes) continue;
        const t = state.pixelTranslation(p.px, p.py, [0, 0, 0]);
        for (let tz = 4; tz < 124; tz += 2)
          for (let tx = 4; tx < 124; tx += 2) {
            if (p.tilemapBytes[tz * TERRAIN_TILE_DIM + tx] >> 2 !== 0) continue;
            for (const [dx, dz] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]) {
              const lx = tx + dx * 3,
                lz = tz + dz * 3;
              if (p.tilemapBytes[lz * TERRAIN_TILE_DIM + lx] >> 2 === 0) continue;
              const x = t[0] + (lx + 0.5) * 6.4,
                z = t[2] + (lz + 0.5) * 6.4,
                wx = t[0] + (tx + 0.5) * 6.4,
                wz = t[2] + (tz + 0.5) * 6.4;
              return {
                feet: [x, heightAt(x, z), z],
                yaw: Math.atan2(wx - x, wz - z),
                water: [wx, wz],
                pixel: [p.px, p.py],
              };
            }
          }
      }
      return null;
    };
    /** CSA-E probe: open water - a water tile every tile within `r` of which is water, the nearest the player's feet
     *  (where a boat's five nodes all read water, so its sails can be raised). */
    window.__csaOpenWater = (r = 3) => {
      let best = null;
      for (const p of built.values()) {
        if (!p?.tilemapBytes) continue;
        const t = state.pixelTranslation(p.px, p.py, [0, 0, 0]);
        for (let tz = r; tz < TERRAIN_TILE_DIM - r; tz += 2)
          for (let tx = r; tx < TERRAIN_TILE_DIM - r; tx += 2) {
            let open = true;
            for (let dz = -r; dz <= r && open; dz++)
              for (let dx = -r; dx <= r; dx++)
                if (p.tilemapBytes[(tz + dz) * TERRAIN_TILE_DIM + tx + dx] >> 2 !== 0) {
                  open = false;
                  break;
                }
            if (!open) continue;
            const x = t[0] + (tx + 0.5) * 6.4,
              z = t[2] + (tz + 0.5) * 6.4;
            const d = Math.hypot(x - player.pos[0], z - player.pos[2]);
            if (!best || d < best.d) best = { d, x, y: heightAt(x, z), z, pixel: [p.px, p.py] };
          }
      }
      return best;
    };
    /** CSA-C probe: the save's record out and straight back in (GetSaveData, RestoreSaveData, OnLoad) - what a save and its load hand the mod. */
    window.__csaRoundTrip = () => {
      if (!csaRuntime) return null;
      const rec = JSON.parse(JSON.stringify(csaRuntime.getSaveData()));
      csaRuntime.restoreSaveData(rec);
      csaRuntime.OnLoad();
      return {
        saved: rec.placedBoats.map((b) => ({
          Hull: b.Hull,
          Variant: b.Variant,
          MapPixel: b.MapPixel,
          Position: b.Position,
        })),
        stat: csa.stat(),
      };
    };
    window.__csaStat = () => csa.stat();
    window.__csaLights = (on) => {
      for (const b of csa.boats) csaSetLights(b, !!on);
      return csa.stat();
    };
    window.__csaClear = () => {
      while (csaRuntime?.AllBoats.length) csaRuntime.console.purgeboat(['0']);
      csa.destroyAll();
      return csa.stat();
    }; // CSA-C: purgeboat, boat by boat
    // CSA-D: the helm's probes - the state a frame leaves, the helm taken through the activation's own arm (the pick
    // off the ray from a point, as the F key's), the buckets the boats stand in the collider
    window.__csaHelm = () => {
      const b = csaRuntime?.state.CurrentBoat;
      const r = (v) => (v ? v.map((x) => +(+x).toFixed(3)) : null);
      return csaRuntime
        ? {
            sailing: csaRuntime.isSailing(),
            current: b ? csaRuntime.AllBoats.indexOf(b) : -1,
            boat: r(b?.GameObject.position),
            yaw: b
              ? +((Math.atan2(b.GameObject.worldMatrix()[8], b.GameObject.worldMatrix()[10]) * 180) / Math.PI).toFixed(
                  2,
                )
              : null,
            move: r(csaRuntime.state.MoveVectorCurrent),
            turn: +csaRuntime.state.TurnCurrent.toFixed(3),
            feet: r(player.pos),
            camYaw: +((cam.yaw * 180) / Math.PI).toFixed(2),
            frozen: +(player.freezeMotor ?? 0).toFixed(3),
            drive: r(b?.DrivePosition.position),
            nodes: b ? [...b.NodeTileMapIndices] : null,
            collision: r(csaRuntime.state.CollisionVector),
            buckets: _csaBuckets.size,
            cargoMod: csaRuntime.state.boatCargoMod,
            // CSA-E: the sails, the wind and the widget
            sail: csaRuntime.state.sailPosition,
            wind: r(csaRuntime.state.windVectorCurrent),
            windTarget: r(csaRuntime.state.windVectorTarget),
            widget: csaRuntime.state.windWidgetFrame,
            target: r(csaRuntime.state.MoveVectorTarget),
            sails: b
              ? b.Sails.map((n) => {
                  const a = n.getComponent('Animator')?.animator;
                  return a
                    ? {
                        state: a.stateName,
                        next: a.nextStateName,
                        stowed: a.GetBool('Stowed'),
                        wind: +a.GetFloat('Wind').toFixed(3),
                      }
                    : null;
                })
              : null,
            rudder: b?.RudderAnimator?.animator
              ? {
                  state: b.RudderAnimator.animator.stateName,
                  next: b.RudderAnimator.animator.nextStateName,
                  sailing: b.RudderAnimator.animator.GetBool('Sailing'),
                }
              : null,
            widgetFrames: _csaWidgetFrames.length,
          }
        : null;
    };
    // CSA-F: the waves' probe - the object, its mesh, its frame, the neighbours the current reads and the current;
    // `rebuild` asks UpdateWaveMesh now (as the events do)
    window.__csaWaves = (rebuild = false) => {
      if (!csaRuntime) return null;
      if (rebuild) csaCall(() => csaRuntime.UpdateWaveMesh());
      const w = csaRuntime.waves();
      const r = (v) => (v ? v.map((x) => +(+x).toFixed(3)) : null);
      return {
        position: r(w.position),
        vertices: w.mesh ? w.mesh.vertices.length / 3 : 0,
        triangles: w.mesh ? w.mesh.indices.length / 3 : 0,
        frame: w.frame,
        pictures: !!csaRender?.hasWaveFrames,
        neighbors: csaRuntime.state.currentNeighbors,
        current: r(csaRuntime.state.currentVector),
        pixel: csaRuntime.state && [state.current.x, state.current.y],
        compensation: r(state.compensation),
        feet: r(player.pos),
      };
    };
    /** CSA-F probe: every boat's particle systems that are alive - their node, count, playing and emitting */
    window.__csaFx = () =>
      csaRuntime
        ? csaRuntime.AllBoats.map((b) => ({
            wake: b.WakeEmitter && {
              n: b.WakeEmitter.particleCount,
              playing: b.WakeEmitter.isPlaying,
              emitting: b.WakeEmitter.isEmitting,
            },
            loops: [b.AudioSourceSlow?.isPlaying, b.AudioSourceFast?.isPlaying],
            live: (b.particleSystems ?? [])
              .filter((p) => p.particleCount)
              .map((p) => `${p.node.name}:${p.particleCount}`),
            flag: b.FlagObject ? csaQuatRotate(b.FlagObject.rotation, [0, 0, 1]).map((v) => +v.toFixed(2)) : null,
            bob: b.MeshObject ? b.MeshObject.localRotation.map((v) => +v.toFixed(4)) : null,
          }))
        : null;
    /** CSA-G probe: the clock and the sounds - Time.timeScale and the helm's step, Travel Options' answer, each loop's
     *  channel as the frame keeps it, the five clips' decode, the context's state; and a count of the oars' events
     *  through a boat's rudder listener (armed by `__csaOarWatch(i)`). */
    window.__csaTime = () =>
      csaRuntime
        ? {
            timeScale: worldTimeScale(),
            index: csaRuntime.state.timeScaleIndex,
            travelling: csaRuntime.state.isTravelling,
            loops: [..._csaLoops].map(([src, ch]) => ({
              clip: src.clip,
              volume: +src.volume.toFixed(3),
              plays: src.plays,
              channel: !!ch.handle,
            })),
            clips: CSA_AUDIO_CLIPS.map((n) => audio.buffers.get(csaClipKey(n)) != null),
            context: audio.ctx?.state ?? null,
            oarEvents: window.__csaOarCounts ?? null,
            enemies:
              areEnemiesNearby(
                (host.modes?.mode ?? 'exterior') === 'exterior'
                  ? [...exteriorFoes.foes, ...cityGuards.guards]
                  : (host.modes?.insideFoes?.() ?? []),
              ) || navalHostileNear(), // the time scale's own rule (NAV-H)
            overlay: townTalk?.overlay?.constructor?.name ?? null,
          }
        : null;
    /** CSA-H probe: the pack's boat items (name, message, value, weight, UID), a use of the first of a template through
     *  the one use ladder (the registered handler, its result), the picker up and a pick on it, the cargo, a boat's
     *  variant and whether a port is near. */
    window.__csaItems = () =>
      (playerEntity.items ?? [])
        .filter((it) => it.templateIndex === CSA_PARTS_TEMPLATE || it.templateIndex === CSA_DEED_TEMPLATE)
        .map((it) => ({
          t: it.templateIndex,
          name: it.name,
          message: it.message,
          value: it.value,
          weight: it.weightInKg ?? null,
          UID: it.UID ?? null,
        }));
    window.__csaUseItem = (templateIndex) => {
      const list = playerEntity.items ?? [];
      const item = list.find((it) => it.templateIndex === templateIndex);
      if (!item) return null;
      const r = useItem(item, list, { entity: playerEntity });
      return { result: r ? { kind: r.kind, closesWindow: !!r.closesWindow } : null, placing: !!csaRuntime?.placing };
    };
    window.__csaPicker = () => (host._csaPicker ? { rows: [...host._csaPicker.items] } : null);
    window.__csaPickerRow = (i) => {
      const w = host._csaPicker;
      if (!w) return false;
      w.onPick(i);
      return true;
    };
    window.__csaBoatVariant = (i = 0) =>
      csaRuntime?.AllBoats[i]
        ? {
            hull: csaRuntime.AllBoats[i].hull,
            variant: csaRuntime.AllBoats[i].variant,
            cargo: csaRuntime.AllBoats[i].Cargo.Items.length,
          }
        : null;
    window.__csaNearPort = (range = 3) => (csaRuntime ? csaRuntime.IsNearPort(range) : null);
    /** CSA-I probe: the position reading's state, and the water walk as the effect list stands. */
    window.__csaMapState = () =>
      csaRuntime
        ? {
            showing: csaRuntime.state.mapShowing,
            reading: csaRuntime.state.mapShowingPosition,
            running: csaRuntime.state.showingBoatPosition != null,
            mode: csaRuntime.state.mapMarkerMode,
            markers: csaRuntime.state.mapMarkers.map((m) => ({ position: m.position, label: m.label })),
            window: !!host._csaMapWindow,
            mouse: host._csaMouse.map((v) => +v.toFixed(1)),
            pictures: { map: !!_csaPics.map, line: !!_csaPics.line },
          }
        : null;
    window.__csaWaterWalk = () => ({
      walking: isEntityWaterWalking(playerEntity),
      flag: !!player.waterWalking,
      bundles: liveBundles(playerEntity).map((b) => ({ name: b.name, icon: b.showIcon })),
    });
    window.__csaOverlay = () => {
      const o = townTalk?.overlay;
      return o
        ? {
            name: o.constructor?.name ?? null,
            keys: Object.keys(o).slice(0, 12),
            done: !!townTalk.overlayDone,
            active: !!townTalk.overlayActive,
          }
        : null;
    }; // the street's window slot, what holds it
    window.__csaOarWatch = (i = 0) => {
      const l = csaRuntime?.AllBoats[i]?.RudderObject?.getComponent?.('RudderAnimationEventListener');
      if (!l) return false;
      window.__csaOarCounts = { OarEvent_In: 0, OarEvent_Sweep: 0, OarEvent_Out: 0 };
      for (const n of Object.keys(window.__csaOarCounts)) {
        const f0 = l[n];
        l[n] = () => {
          window.__csaOarCounts[n]++;
          f0();
        };
      }
      return true;
    };
    /** CSA-F probe: UpdateWaveMesh's first loop laid bare - each pixel round the player's, its WOODS.WLD height and the
     *  heights its four quarter-point rays meet (null: nothing) */
    window.__csaWaveRays = (d = 2) => {
      const px = playerTravelPixel(),
        wc = state.compensation,
        out = [];
      for (let i = -d; i <= d; i++)
        for (let j = -d; j <= d; j++) {
          const h = host.woods.getHeightMapValue(px.x + i, px.y + j);
          const rays =
            h > 2
              ? null
              : [
                  [204.8, 204.8],
                  [614.4, 204.8],
                  [204.8, 614.4],
                  [614.4, 614.4],
                ].map(([x, z]) => {
                  const hit = csaRaycast([x + 819.2 * i, wc[1] + 500, z - 819.2 * j], [0, -1, 0], 1000, {
                    triggers: true,
                  });
                  return hit ? { y: +hit.point[1].toFixed(2), name: hit.name ?? null } : null;
                });
          out.push({ i, j, h, rays });
        }
      return out;
    };
    /** CSA-F probe: the wave vertex nearest the player's feet, in the world (the object's position plus 819.2 a unit). */
    window.__csaWaveNearest = () => {
      const w = csaRuntime?.waves();
      if (!w?.mesh) return null;
      let best = null;
      for (let i = 0; i < w.mesh.vertices.length; i += 3) {
        const p = [
          w.position[0] + w.mesh.vertices[i] * w.scale,
          w.position[1],
          w.position[2] + w.mesh.vertices[i + 2] * w.scale,
        ];
        const d = Math.hypot(p[0] - player.pos[0], p[2] - player.pos[2]);
        if (!best || d < best.d) best = { d: +d.toFixed(1), point: p.map((x) => +x.toFixed(2)) };
      }
      return best;
    };
    window.__csaPick = (o, d) => {
      const p = csaActivationPick(
        o ?? cam.pos,
        d ?? [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)],
      );
      return p ? { key: p.key, distance: +p.distance.toFixed(3), modelId: p.modelId, node: p.hit.node?.name } : null;
    };
    window.__csaActivateAt = (i, part = 'drive', mode = 'grab') => {
      // the boat's box as the ray from above it meets it, through the arm
      const b = csaRuntime?.AllBoats[i];
      const node =
        part === 'board'
          ? b?.BoardTriggers[0]
          : part === 'status'
            ? b?.StatusTrigger
            : part === 'bed'
              ? b?.BedObject
              : part === 'cargo'
                ? b?.CargoTrigger
                : part === 'variant'
                  ? b?.VariantTrigger
                  : part === 'position'
                    ? b?.PositionTrigger
                    : b?.DriveTrigger;
      if (!node) return null;
      const c = node.position,
        o = [c[0], c[1] + (part === 'bed' ? 1 : 2), c[2]];
      const p = csaActivationPick(o, [0, -1, 0]);
      if (p?.bed)
        csaActivate(p); // CSA-G: the bed's arm, as the frame's race hands it
      else if (p) csaCall(() => csaRuntime.activate(p.modelId, p.hit, mode));
      return p ? { key: p.key, distance: +p.distance.toFixed(3), node: p.hit.node?.name ?? null } : null;
    };
    window.__csaWalkable = (x, z, top = 1000) => {
      const h = csaModeCollider()?.raycastHit([x, top, z], [0, -1, 0], 2000);
      return h && Number.isFinite(h.dist) ? { y: +(top - h.dist).toFixed(3), key: h.key } : null;
    };
    window.__cam = () => cam.pos.slice();
    window.__player = {
      get pos() {
        return [...player.pos];
      },
      warp: (x, y, z) => {
        player.spawn(x, y, z);
        host.playerSpawned = true;
      },
    };
    // FIX-C probe surface: is the player STANDING - spawned, on a built
    // pixel, at its ground - or in the sky (never spawned) or the ground
    // (no terrain under the feet). classicStartProbe reads it after the exit.
    window.__standing = () =>
      JSON.stringify({
        spawned: host.playerSpawned,
        y: +player.pos[1].toFixed(2),
        ground: heightAt(player.pos[0], player.pos[2]),
        built: built.has(`${state.current.x},${state.current.y}`),
      });
    // WATER-DRAW1 probe surface: THE TILE UNDER THE PLAYER, BY NUMBER.
    // The water pass discards a tile whose record the corner table gives
    // no water corners for, and the only way to name the record from a
    // screenshot is to stand on it. Prints the record, the transform,
    // the corners the DRAW gives it and the corners the FEET do - so a
    // tile that looks wrong reports itself in one line.
    window.__tileHere = () => {
      const p = built.get(`${state.current.x},${state.current.y}`);
      if (!p?.tilemapBytes) return JSON.stringify({ built: false });
      const t = state.pixelTranslation(p.px, p.py);
      const tx = Math.floor((cam.pos[0] - t[0]) / 6.4),
        tz = Math.floor((cam.pos[2] - t[2]) / 6.4);
      if (tx < 0 || tz < 0 || tx >= TERRAIN_TILE_DIM || tz >= TERRAIN_TILE_DIM)
        return JSON.stringify({ offPixel: true });
      const byte = p.tilemapBytes[tz * TERRAIN_TILE_DIM + tx];
      return JSON.stringify({
        pixel: `${p.px},${p.py}`,
        tile: `${tx},${tz}`,
        archive: p.groundArchive,
        record: byte >> 2,
        transform: byte & 3,
        byte,
        drawnWet: waterCorners(byte, WATER_DRAW_MASK_TABLE),
        feetWet: waterCorners(byte),
        // WATER-PUDDLE: a puddle record draws only where its art is water - is it, under the eye?
        artWet:
          PUDDLE_RECORDS.includes(byte >> 2) && groundPuddles.get(p.groundArchive)?.[byte >> 2]
            ? puddleWetAt(
                groundPuddles.get(p.groundArchive)[byte >> 2],
                byte,
                (cam.pos[0] - t[0]) / 6.4 - tx,
                (cam.pos[2] - t[2]) / 6.4 - tz,
              )
            : null,
        path: p.paths?.[tz * TERRAIN_TILE_DIM + tx] ? 1 : 0, // GRASS-PATH1
        location: p.location ?? null,
      });
    };
    // WATER-NEXT probe: the sea's surface in scene y at the camera's pixel (Iliac Puddle No More's ocean line), or null
    window.__seaY = () => {
      const at = playerTravelPixel();
      return deepWaters && at ? state.pixelTranslation(at.x, at.y, [0, 0, 0])[1] + deepWaters.oceanLocalY : null;
    };
    // WATER-NEXT 4 probe: a stir dropped into the ripple field at a world point (a body's splash), so a shot sees rings
    window.__ripple = (x, z, strength = 0.25) => {
      ripples?.field.disturb(x, z, strength, 1.2);
      return !!ripples;
    };
    // WATER-PUDDLE probe: every tile of these records in the built pixels, as world centres on the ground
    window.__findTiles = (records, max = 40) => {
      const want = new Set(records),
        out = [];
      for (const p of built.values()) {
        if (!p.tilemapBytes) continue;
        const t = state.pixelTranslation(p.px, p.py);
        for (let i = 0; i < p.tilemapBytes.length && out.length < max; i++) {
          const byte = p.tilemapBytes[i];
          if (!want.has(byte >> 2)) continue;
          const x = t[0] + ((i % TERRAIN_TILE_DIM) + 0.5) * 6.4,
            z = t[2] + (Math.floor(i / TERRAIN_TILE_DIM) + 0.5) * 6.4;
          out.push({
            pixel: `${p.px},${p.py}`,
            record: byte >> 2,
            byte,
            x: +x.toFixed(2),
            y: +heightAt(x, z).toFixed(2),
            z: +z.toFixed(2),
          });
        }
      }
      return out;
    };
    // M3 probe surface: the live climb state (the wall probe + the
    // check machine ride the real collider and the real skill rolls).
    window.__climb = () =>
      JSON.stringify({
        climbing: !!player.climb?.isClimbing,
        slipping: !!player.climb?.isSlipping,
        mantling: !!player.mantling,
        move: player._pkMove?.kind ?? null, // AUDIT CLIMB1 F9: the enhanced climb's move, for the probe
        wall: player._wall?.mode ?? null,
        grip: +player.grip.toFixed(3), // CLIMB2: the hold (hang | climb) and the grip
        y: +player.pos[1].toFixed(2),
        grounded: !!player.grounded,
      });
    // M3 probe surface: building-door spots - a door IS a wall with a
    // known outward normal, so the climb probe can stand square to
    // real geometry (centre/normal ride the door matrix per
    // staticDoors' own contract).
    window.__doorSpots = () =>
      JSON.stringify(
        buildingDoors.slice(0, 80).map((e) => {
          const d = host.shiftedDoor(e);
          const m = d.matrix,
            c = d.centre,
            n = d.normal;
          const wc = [
            m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12],
            m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13],
            m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14],
          ];
          const wn = [
            m[0] * n.x + m[4] * n.y + m[8] * n.z,
            m[1] * n.x + m[5] * n.y + m[9] * n.z,
            m[2] * n.x + m[6] * n.y + m[10] * n.z,
          ];
          const l = Math.hypot(wn[0], wn[2]) || 1;
          return { pos: wc.map((v) => +v.toFixed(2)), n: [+(wn[0] / l).toFixed(3), 0, +(wn[2] / l).toFixed(3)] };
        }),
      );
    window.__frame = 0;
    window.__renderer = renderer; // EV2: the probe surface every host carries now (the dungeon's U38 precedent) - draw counts land against renderer.stats
    window.__playerEntity = playerEntity; // DW-D: the probe's entity - a shot's stub has no Endurance, so a dive drowns it at once unless the probe hands it breath
    // DW-B: Deep Waters' probe - the bake, the promotes still owed, and what each standing pixel carries
    window.__dwDecorDebug = () => dwDecor?.debug ?? null; // DW-E2 probe
    window.__dwFishDebug = () => {
      // DW-E3 probe: the counts, and the fish nearest the eye
      if (!dwFish) return null;
      const e = walkMode ? player.pos : cam.pos,
        d = (o) => Math.hypot(o.fish.position[0] - e[0], o.fish.position[1] - e[1], o.fish.position[2] - e[2]);
      return {
        ...dwFish.debug,
        near: [...dwFish.fishes]
          .sort((a, b) => d(a) - d(b))
          .slice(0, 6)
          .map((o) => ({
            key: o.key,
            s: o.species.itemName,
            p: o.fish.position.map((v) => +v.toFixed(2)),
            d: +d(o).toFixed(1),
            vis: o.fish.visible,
            size: [+o.size.w.toFixed(2), +o.size.h.toFixed(2)],
          })),
      };
    };
    // DW-E4 probe: the deep's foes - the lane's counts, and each foe stood with where it is
    window.__dwFoes = () =>
      dwEnemies
        ? {
            live: dwEnemies.liveCount,
            pending: dwEnemies.pendingCount,
            level: dwPlayer?.waterLevelY ?? null,
            foes: exteriorFoes.foes
              .filter((f) => f.transient && !f.dead)
              .map((f) => ({
                t: f.mobileType,
                team: f.entity.team,
                feet: f.ai.feet.map((v) => +v.toFixed(2)),
                hostile: !!f.ai.isHostile,
              })),
          }
        : null;
    // DW-E3 probe: the pile arm's window on a fish (a fish flees the reach before a shot's key lands)
    window.__dwFishLoot = (key) => {
      const o = dwFish?.fishFor(key);
      if (!o) return null;
      const w = makeInventoryWindow({ onClose: () => droppedLoot.releaseEmptied(), loot: dwFishLootHooks(o) });
      if (w) townTalk.showOverlay(w);
      return !!w;
    };
    window.__dwStat = () => ({
      on: !!deepWaters,
      bake: !!deepWaters?.bake,
      pending: deepWaters?.pendingCount ?? 0,
      queue: queue.length,
      building: host.building,
      built: built.size,
      decor: dwDecor
        ? {
            playing: dwPlaying(),
            light: canRunLightRuntimeWork(dwPlaying()),
            heavy: canRunHeavyRuntimeWork(performance.now() / 1000, dwPlaying()),
            tex: dwDecor.texturesReady,
            pend: dwDecor.pendingBatchCount,
            promoteMs: +deepWaters.promoteMs.toFixed(2),
            work: dwDecor.pendingWorkCount,
            batches: [...built.values()].filter((p) => dwDecor.batchOf(p)).length,
            billboards: [...built.values()].reduce(
              (n, p) => n + (dwDecor.batchOf(p)?.groups ?? []).reduce((m, g) => m + g.count / 6, 0),
              0,
            ),
          }
        : null, // DW-E2
      floors: [...built.values()].filter((p) => p.deepWaters?.floor).length,
      hidden: [...built.values()].filter((p) => p.deepWaters?.hide).length,
      clipped: [...built.values()].filter((p) => p.dwTerrain).length,
      surfaces: [...built.values()].filter((p) => p.deepWaters?.surface).length,
      cur: state.current,
      swim: dwPlayer?.decision ? { ...dwPlayer.decision } : null,
      feet: walkMode ? player.pos.map((v) => +v.toFixed(2)) : null,
      swimming: !!player.isPlayerSwimming,
      motorSwim: !!player.swimming,
      breath: playerEntity.currentBreath ?? 0,
      health: playerEntity.health,
      endurance: liveStat(playerEntity, 'endurance'),
      race: playerEntity.raceId,
      motor: {
        sunk: !!player.sunk,
        toggleSink: !!player.toggleSink,
        ha: player.heightAction,
        height: +(player.height ?? 0).toFixed(2),
        grounded: !!player.grounded,
        cancel: !!player.cancelMovement,
        surf: player.waterSurfaceY == null ? null : +player.waterSurfaceY.toFixed(2),
        onExt: !!player.onExteriorWater,
        speed: +(player.speed ?? 0).toFixed(2),
      },
      fog: host._dwFogP
        ? {
            under: host._dwFogP.under,
            oceanY: +host._dwFogP.oceanY.toFixed(2),
            cam: +cam.pos[1].toFixed(2),
            dfu: host._dwUnderFog ? { mode: host._dwUnderFog.mode, density: host._dwUnderFog.density } : null,
          }
        : null,
      probe: (() => {
        const q = built.get(`${state.current.x},${state.current.y}`);
        const t = state.pixelTranslation(state.current.x, state.current.y);
        return {
          t,
          loc: q?.locOrigin,
          box: q?._box,
          h: [0, 200, 400, 600, 800].map((z) => +heightAt(t[0] + 409.6, t[2] + z).toFixed(1)),
        };
      })(),
      pixels: [...built.values()]
        .map(
          (p) =>
            `${p.px},${p.py}:${p.deepWaters ? (p.deepWaters.floor ? 'F' : '') + (p.deepWaters.hide ? 'H' : '') + (p.dwTerrain ? 'C' : '') + (p.deepWaters.surface ? 'S' : '') : '-'}`,
        )
        .join(' '),
    });
  }
}
