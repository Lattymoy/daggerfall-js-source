// Interior/dungeon mode machine (P3-P6, extracted at the P7
// consolidation): a HOST scene stays in 'exterior' mode until an E on a
// static door swaps the whole frame pipeline - draws, lighting, fog,
// collider - to a built context, and back on exit. The host keeps
// streaming/exterior rendering; the machine owns everything modal.
// Hosts: the streaming world (?world) and the exterior location scene.
//
// Host contract:
//   canvas, renderer, player, cam, keys - the live scene objects;
//   latch {use, jump} - shared edge-detect state (a held key must not
//     re-trigger across a mode switch);
//   blocks - BlocksFile (dungeon layout);
//   pipeline - {getGpuMesh, cpuModels, getTexture, uploadRecord} plus
//     arch for the dungeon pre-pass (dataPipeline.js);
//   doorTargets() - LIVE world-space static-door entries
//     {door, dfBlock, recordIndex, climateBase, season, dfLocation,
//      group}; group scopes dungeon-entrance candidates (the world's
//      pixelKey; a single location's constant key). Translations must
//      be frozen while a mode is active (both hosts early-return past
//      their streaming/recenter step), so entries captured at enter
//      stay valid for the exit landing math.
//   baseCollider() - the collider to restore on exit.

import { doorWorldAabb, doorWorldPosition, doorWorldNormal, interiorLanding, exteriorLanding, dungeonEntranceLanding, climbLadder, floorLanding } from '../player/enterExit.js';
import { INTERIOR_MARKER } from '../world/interiorLayout.js';
import { pickActivatable, worldAabb, activationTargets } from '../player/activate.js';
import { transferAll } from '../systems/inventory.js';
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { buildInteriorContext } from './interiorContext.js';
import { buildDungeonContext } from './dungeonContext.js';
import { DOOR_TYPE } from '../world/meshReader.js';
import { getGroundArchive } from '../world/climateSwaps.js';
import { DUNGEON_AMBIENT, DUNGEON_LIGHT_COLOR } from '../world/dungeonLights.js';
import { INTERIOR_AMBIENT, INTERIOR_LIGHT_COLOR, INTERIOR_LIGHT_RANGE, INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { nearestLights } from '../world/cityLights.js';
import { lookAt, perspective } from '../world/mat4.js';
import { routeKey } from '../ui/input.js';
let _charT0 = (typeof performance !== 'undefined' ? performance.now() : 0);
let _charAnimMode = 'idle'; // in-engine character animation: idle | walk | off (window.__anim)

// Dungeon water surface (R11 values, mirroring the dungeon scene).
const DUNGEON_WATER_COLOR = [1, 1, 1, 0.82];
const DUNGEON_WATER_SCROLL = 0.05;

export function createWorldModes(host) {
  const { canvas, renderer, player, cam, keys, latch, blocks, pipeline, doorTargets, baseCollider, voxelfolk = false, piece = 0, paint = false } = host;   // host.foes: C8 E1 rigged class enemies in dungeons
  const { getGpuMesh, cpuModels, getTexture, uploadRecord, arch, palette } = pipeline;

  let mode = 'exterior';
  let interiorCtx = null;
  let exitReturn = null;
  let dungeonCtx = null;
  let dungeonReturn = null; // entrance-door candidates of the group
  let transitioning = false;

  const eyeDir = () =>
    [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
  const objAabb = (o) => worldAabb(o.cpu.positions, o.matrix);

  async function tryEnter() {
    const eye = player.eye;
    const dir = eyeDir();
    const entries = doorTargets();
    const targets = entries.map((entry, i) => ({
      key: i, aabb: doorWorldAabb(entry.door),
    }));
    const key = pickActivatable(eye, dir, targets, baseCollider());
    if (key === null) return false;
    const hit = entries[key];
    // Route by verbatim door type: buildings to interiors, dungeon
    // entrances into the RDB crawl.
    if (hit.door.doorType === DOOR_TYPE.DUNGEON_ENTRANCE) return tryEnterDungeon(hit, entries);
    if (hit.door.doorType !== DOOR_TYPE.BUILDING || hit.recordIndex === undefined) return false;
    transitioning = true;
    try {
      // P8: parent the interior at the entered building's world matrix
      // (verbatim ownerPosition + buildingMatrix) - context coordinates
      // come back world-frame, landings run in one frame, and the walk
      // through the door is coordinate-seamless.
      const ctx = await buildInteriorContext(
        { renderer, getGpuMesh, cpuModels, getTexture, uploadRecord, palette },
        hit.dfBlock, 0, hit.recordIndex, hit.climateBase, hit.season,
        hit.door.matrix, { voxelfolk, piece, paint });
      const siblings = entries.filter((e) =>
        e.dfBlock === hit.dfBlock && e.recordIndex === hit.recordIndex);
      const landing = interiorLanding(
        doorWorldPosition(hit.door), ctx.enterMarkers, ctx.doors);
      if (!landing) throw new Error('no interior landing');
      exitReturn = { siblings };
      interiorCtx = ctx;
      player.collider = ctx.collider;
      const floored = floorLanding(ctx.collider, landing);   // verbatim FixStanding: instant snap, no gravity drop-in
      player.spawn(floored[0], floored[1], floored[2]);
      mode = 'interior';
      console.log(`interior: ${ctx.drawList.length} draws, ${ctx.doors.length} doors, ${ctx.lights.length} lights, ${ctx.people.length} people`);
    } finally {
      transitioning = false;
    }
    return true;
  }

  function rayAabbProbe(eye, dir, aabb) {
    let tMin = 0;
    let tMax = Infinity;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(dir[a]) < 1e-9) {
        if (eye[a] < aabb.min[a] || eye[a] > aabb.max[a]) return null;
        continue;
      }
      const inv = 1 / dir[a];
      let t0 = (aabb.min[a] - eye[a]) * inv;
      let t1 = (aabb.max[a] - eye[a]) * inv;
      if (t0 > t1) { const sw = t0; t0 = t1; t1 = sw; }
      if (t0 > tMin) tMin = t0;
      if (t1 < tMax) tMax = t1;
      if (tMin > tMax) return null;
    }
    return +tMin.toFixed(2);
  }

  function tryExit() {
    const eye = player.eye;
    const dir = eyeDir();
    // Exit doors and interior swing doors share the E ray; swing doors
    // use their LIVE matrices via the ActionSystem objects.
    const targets = interiorCtx.doors.map((d, i) => ({ key: `exit:${i}`, aabb: doorWorldAabb(d) }));
    interiorCtx.containers.forEach((c, i) => {
      targets.push({ key: `container:${i}`, aabb: worldAabb(c.cpu.positions, c.matrix) });   // S2b
    });
    for (const o of interiorCtx.actions.objects.values()) {
      targets.push({ key: o.key, aabb: objAabb(o) });
    }
    interiorCtx.ladders.forEach((l, i) => {
      targets.push({ key: `ladder:${i}`, aabb: objAabb(l) });
    });
    const key = pickActivatable(eye, dir, targets, interiorCtx.collider);
    if (key === null) return false;
    if (key.startsWith('ladder:')) {
      // Verbatim ClimbLadder: closest markers, below-top -> top,
      // above-bottom -> bottom.
      // ClimbLadder compares the CONTROLLER position, which after
      // FixStanding sits at floor + height * 0.65 = 1.17 (PlayerMotor
      // repositions to hit + up * (controller.height * 0.65f)) - NOT
      // the geometric half-height. The teleport target re-floors via
      // gravity exactly as FixStanding would.
      const standing = [player.pos[0], player.pos[1] + 1.8 * 0.65, player.pos[2]];
      const to = climbLadder(standing, interiorCtx.markers, INTERIOR_MARKER);
      if (to) {
        // Teleport just ABOVE the marker and let gravity floor it -
        // FixStanding's re-floor, without tunneling thin boards.
        player.spawn(to[0], to[1] + 0.1, to[2]);
        cam.pos = player.eye;
      }
      return true;
    }
    if (!key.startsWith('exit:')) {
      if (key.startsWith('container:')) {
        // S2b: open the house container - synchronous transfer through
        // the shared inventory (private furniture starts EMPTY; shops/
        // quests fill these later; open-feedback pends the UI arc).
        const c = interiorCtx.containers[Number(key.split(':')[1])];
        if (c) {
          transferAll(c.items, playerEntity.items);
            surfacePlayer();
        }
        return true;
      }
      interiorCtx.actions.activate(key);
      return true;
    }
    // Verbatim BuildingTransitionExteriorLogic: the closest exterior
    // door to the PLAYER (frames unified at P8), landing at
    // normal * radius*3. DFU compares transform.position - the
    // CONTROLLER standing at floor + height * 0.65 (the same
    // FixStanding constant P6 dug out for ClimbLadder), not the feet.
    const landing = exteriorLanding(
      [player.pos[0], player.pos[1] + 1.8 * 0.65, player.pos[2]],
      exitReturn.siblings.map((e) => e.door));
    if (!landing) { console.error('exit: no exterior landing (empty sibling doors)'); return false; }   // tryEnter guards its landing; this path was unguarded - a null here killed the frame loop
    interiorCtx.destroy();
    interiorCtx = null;
    player.collider = baseCollider();
    player.spawn(landing[0], landing[1], landing[2]);
    mode = 'exterior';
    console.log('exterior: returned at door');
    return true;
  }

  async function tryEnterDungeon(hit, entries) {
    const dfLocation = hit.dfLocation;
    if (!dfLocation || !dfLocation.hasDungeon) return false;
    transitioning = true;
    try {
      const ctx = await buildDungeonContext(
        { renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord, palette },
        dfLocation, blocks, dfLocation.climate.climateType, { foes: host.foes, playerClass: host.playerClass, playerSpell: host.playerSpell, playerWeapon: host.playerWeapon });
      dungeonCtx = ctx;
      // Classic water tile: the location climate's ground archive,
      // record 0 (R11) - uploaded here since the exterior ground path
      // never routes single records through uploadRecord.
      const waterArchive = getGroundArchive(hit.climateBase, hit.season);
      await getTexture(waterArchive);
      uploadRecord(waterArchive, 0);
      dungeonReturn = {
        waterArchive,
        candidates: entries.filter((e) =>
          e.group === hit.group && e.door.doorType === DOOR_TYPE.DUNGEON_ENTRANCE),
      };
      mode = 'dungeon';
      player.collider = ctx.collider;
      const spawn = ctx.startSpawn();   // ONE source: verbatim MovePlayerToMarker + FixStanding in the context
      player.spawn(spawn[0], spawn[1], spawn[2]);
      cam.pos = player.eye;
      console.log(`dungeon: ${ctx.drawList.length} draws, ${ctx.exitDoors.length} exit doors, ` +
        `${ctx.lights.length} lights, ${ctx.waterQuads.length} water, ${ctx.colliderTris} tris, ${ctx.enemies.length} enemies`);
    } finally {
      transitioning = false;
    }
    return true;
  }

  function tryExitDungeon() {
    const eye = player.eye;
    const dir = eyeDir();
    const targets = dungeonCtx.exitDoors.map((d, i) => ({ key: `exit:${i}`, aabb: doorWorldAabb(d) }));
    targets.push(...activationTargets(dungeonCtx.actions.objects));   // effects ride their precomputed aabb (crash fix, audit 2026-08-16)
    targets.push(...dungeonCtx.lootTargets());   // S2: piles + lootable corpses
    const key = pickActivatable(eye, dir, targets, dungeonCtx.collider);
    if (key === null) return false;
    if (key.startsWith('loot:') || key.startsWith('corpse:')) {
      dungeonCtx.takeLoot(key);   // transfer message: UI arc
      return true;
    }
    if (!key.startsWith('exit:')) {
      dungeonCtx.actions.activate(key);
      return true;
    }
    // Verbatim PositionPlayerToDungeonExit; the camera faces the normal.
    const landing = dungeonEntranceLanding(dungeonReturn.candidates.map((e) => e.door));
    dungeonCtx.destroy();
    dungeonCtx = null;
    mode = 'exterior';
    player.collider = baseCollider();
    if (landing) {
      player.spawn(landing.pos[0], landing.pos[1], landing.pos[2]);
      cam.yaw = Math.atan2(landing.normal[0], landing.normal[2]);
    }
    cam.pos = player.eye;
    console.log('exterior: returned at dungeon entrance');
    return true;
  }

  // The modal frame: player update + E + the whole render pipeline for
  // the active context. Returns true when a mode consumed the frame -
  // the host's exterior path (streaming, sky, weather) must not run.
  function frame(dt, now) {
    if (mode === 'exterior') return false;
    const fwd = eyeDir();
    const jumpHeld = keys.has('Space');
    if (mode === 'dungeon' && dungeonCtx) player.fallScale = dungeonCtx.playerFallScale;   // S8 slowfall
    player.update(dt, {
      forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
      strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
      run: keys.has('ShiftLeft'),
      jump: jumpHeld && !latch.jump,
    }, cam.yaw);
    latch.jump = jumpHeld;
    cam.pos = player.eye;
    const useHeld = keys.has('KeyE');
    if (useHeld && !latch.use) (mode === 'dungeon' ? tryExitDungeon : tryExit)();
    latch.use = useHeld;
    // A successful exit destroyed the modal context and flipped the
    // mode - the render below must NOT run against it. This frame is
    // the transition's; the host resumes next frame. (Root cause of
    // the production crash: tryExit nulled interiorCtx, then this
    // same frame fell into the interior render and read .lights of
    // null. The __exit shot probes call tryExit OUTSIDE the frame
    // loop, so P3/P8 verification never exercised the in-frame path.)
    if (mode === 'exterior') return true;

    const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.05, 500);
    const view = lookAt(cam.pos, [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]], [0, 1, 0]);
    const camRight = new Float32Array([Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)]);

    if (mode === 'dungeon') {
      dungeonCtx.actions.update(dt);
      dungeonCtx.flicker.tick(dt);
      renderer.setLighting(new Float32Array(DUNGEON_AMBIENT), 0);
      renderer.setFog('exp', 0.005, 0, 0, new Float32Array([0, 0, 0]));
      renderer.setPointLights(
        nearestLights(dungeonCtx.lights, cam.pos, 16, dungeonCtx.flicker.ranges),
        new Float32Array(DUNGEON_LIGHT_COLOR));
      renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
      for (const d of dungeonCtx.drawList) renderer.drawMesh(d.mesh, d.matrix, dungeonCtx.texRemap);
      for (const d of dungeonCtx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, dungeonCtx.texRemap);
      renderer.drawBillboards(dungeonCtx.billboardBatches, camRight, new Float32Array([0, 1, 0]));
      if (dungeonCtx.uiOverlayActive) { dungeonCtx.drawOverlay(canvas); return; }   // U2b/U3: overlays gate the dungeon
      dungeonCtx.drawFoes(dt, canvas, proj, view, cam.pos, player.pos);   // C8 foes + S3b clock + S4b missiles - internally gated, must run foes or not (trap spells fire in empty dungeons)
      if (dungeonCtx.waterQuads.length) {
        renderer.drawWater(dungeonCtx.waterQuads, DUNGEON_WATER_COLOR,
          renderer.textures.get(`${dungeonReturn.waterArchive}_0`),
          (now / 1000) * DUNGEON_WATER_SCROLL);
      }
      return true;
    }

    // Whole-pipeline swap: interior draws, lighting, fog, collider;
    // the world sleeps untouched underneath (the modal frame also
    // freezes streaming - the interior-local player position must
    // never feed the recenter logic).
    renderer.setLighting(new Float32Array(INTERIOR_AMBIENT), 0);
    renderer.setFog('exp', 0.001, 0, 0, new Float32Array([0, 0, 0]));
    renderer.setPointLights(
      nearestLights(interiorCtx.lights, cam.pos, 16, INTERIOR_LIGHT_RANGE),
      new Float32Array(INTERIOR_LIGHT_COLOR));
    interiorCtx.actions.update(dt);
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
    for (const d of interiorCtx.drawList) renderer.drawMesh(d.mesh, d.matrix, interiorCtx.texRemap);
    for (const d of interiorCtx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, interiorCtx.texRemap);
    renderer.drawBillboards(interiorCtx.billboardBatches, camRight, new Float32Array([0, 1, 0]));
    if (interiorCtx.animateChars) interiorCtx.animateChars((performance.now() - _charT0) / 1000, _charAnimMode);
    for (const d of interiorCtx.charDraws) renderer.drawCharacter(d.mesh, d.matrix);
    return true;
  }

  // Shot-mode hooks for everything modal (parity with the pre-P7 world
  // probes; __doors reads the host's live door registry).
  window.__anim = (m) => { _charAnimMode = ['idle','walk','off'].includes(m) ? m : _charAnimMode; return _charAnimMode; };
  function installShotProbes() {
    window.__doors = () => doorTargets().map((e, i) => (
      { i, pos: doorWorldPosition(e.door), normal: doorWorldNormal(e.door), record: e.recordIndex, block: e.dfBlock.name, type: e.door.doorType }));
    window.__enter = () => tryEnter();
    window.__exit = () => tryExit();
    window.__dungeon = () => dungeonCtx ? JSON.stringify({
      exits: dungeonCtx.exitDoors.map((d) => ({ pos: doorWorldPosition(d).map((v) => +v.toFixed(2)), normal: doorWorldNormal(d).map((v) => +v.toFixed(3)) })),
      actions: dungeonCtx.actions.objects.size,
    }) : null;
    window.__dungeonExit = () => tryExitDungeon();
    window.__pickInterior = () => {
      if (!interiorCtx) return null;
      const dir = eyeDir();
      const rows = [];
      interiorCtx.ladders.forEach((l, i) => {
        const aabb = objAabb(l);
        rows.push({ key: `ladder:${i}`, aabb: aabb.min.map((v) => +v.toFixed(2)).concat(aabb.max.map((v) => +v.toFixed(2))), hit: rayAabbProbe(player.eye, dir, aabb) });
      });
      return JSON.stringify({ eye: player.eye.map((v) => +v.toFixed(2)), dir: dir.map((v) => +v.toFixed(2)), occluder: +interiorCtx.collider.raycast(player.eye, dir, 50).toFixed(2), rows });
    };
    window.__markers = () => interiorCtx ? JSON.stringify(interiorCtx.markers.filter((m) => m.type === 21 || m.type === 22).map((m) => ({ t: m.type, x: +m.x.toFixed(2), y: +m.y.toFixed(2), z: +m.z.toFixed(2) }))) : null;
    window.__ladders = () => interiorCtx ? JSON.stringify(interiorCtx.ladders.map((l) => ({ x: +l.matrix[12].toFixed(2), y: +l.matrix[13].toFixed(2), z: +l.matrix[14].toFixed(2) }))) : null;
    window.__people = () => interiorCtx ? interiorCtx.people.length : null;
    window.__peopleList = () => interiorCtx ? JSON.stringify(interiorCtx.people.map((pn) => ({ a: pn.textureArchive, r: pn.textureRecord, x: +pn.x.toFixed(1), y: +pn.y.toFixed(1), z: +pn.z.toFixed(1) }))) : null;
    window.__enemies = () => dungeonCtx ? JSON.stringify(dungeonCtx.enemies.slice(0, 8).map((e) => ({ t: e.mobileType, x: +e.x.toFixed(1), y: +e.y.toFixed(1), z: +e.z.toFixed(1), fixed: e.fixed }))) : null;
    window.__interiorActions = () => interiorCtx ? JSON.stringify(
      [...interiorCtx.actions.objects.values()].map((o) => ({ key: o.key, state: o.state, pos: [o.matrix[12], o.matrix[13], o.matrix[14]].map((v) => +v.toFixed(2)), fwd: [o.matrix[8], o.matrix[9], o.matrix[10]].map((v) => +v.toFixed(3)) }))) : null;
    window.__interiorActivate = (k) => interiorCtx.actions.activate(k);
    window.__interiorRay = () => {
      const dir = eyeDir();
      return interiorCtx.collider.raycast(player.eye, dir, 50);
    };
    window.__mode = () => mode;
  }

  // C8 E3c: RMB drag-to-swing forwarded to the active dungeon context
  // (the shared machine consumes deltas once per frame). contextmenu
  // suppressed so the right button is a weapon control, as classic.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    if (mode === 'dungeon' && dungeonCtx && document.pointerLockElement === canvas && (e.buttons & 2)) {
      dungeonCtx.playerAttackInput(e.movementX, e.movementY, true);
    }
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 2 && mode === 'dungeon' && dungeonCtx) dungeonCtx.playerAttackInput(0, 0, false);
  });
  addEventListener('mousedown', (e) => {
    if (e.button === 2 && mode === 'dungeon' && dungeonCtx) dungeonCtx.playerAttackInput(0, 0, true);
  });

  addEventListener('keydown', (e) => {
    // The input map (ui/input.js) owns all bindings.
    if (mode !== 'dungeon' || !dungeonCtx) return;
    if (routeKey(e, dungeonCtx, () => ({ eye: cam.pos, dir: eyeDir() }), (p) => { player.pos[0] = p[0]; player.pos[1] = p[1]; player.pos[2] = p[2]; })) e.preventDefault();
  });

  return {
    get mode() { return mode; },
    get transitioning() { return transitioning; },
    get interiorCtx() { return interiorCtx; },
    get dungeonCtx() { return dungeonCtx; },
    tryEnter,
    frame,
    installShotProbes,
  };
}
