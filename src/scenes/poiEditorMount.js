// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { actionOf, isTextEntryTarget } from '../ui/input.js';
import { createPoiEdit } from '../poi/poiEdit.js';
import { createPoiEditorHost, createPoiEditorRouter, POI_EDITOR_EVENTS, POI_PICK_REACH } from './poiEditorHost.js';
import { createPoiEditorPanel } from '../ui/poi/poiEditorPanel.js';
import { cursorActive, releaseLook, requestLook, setCursorActive } from '../player/pointerLock.js';
import { decodePoiImage } from '../poi/poiImageDecode.js';
import { fieldOfView } from '../ui/viewSettings.js';
import { floorLanding, heldInSolid, openGroundNear } from '../player/enterExit.js';
import { groundHit } from '../player/travelPick.js';
import { holdHotbarKeys } from '../ui/enhanced/enhancedHotbar.js';
import { isOnFoot } from '../systems/transport.js';
import { overlayOpen } from '../ui/enhanced/enhancedOverlays.js';
import { PoiGizmoPass } from '../render/poiGizmoPass.js';
import { registerPlayerDamageMod } from '../characters/playerEntity.js';
import { restoresSoFar } from '../systems/save/save.js';
import { t } from '../systems/textManager.js';
import { TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';
import { worldViewportRect } from '../ui/hud/hudLarge.js';

/** @param {any} host */
export function createPoiEditorMount(host) {
  const {
    _mode,
    _teleportToPixel,
    buildTravelMapWindow,
    built,
    cam,
    canvas,
    climbFeel,
    collider,
    csaRuntime,
    gamePaused,
    keys,
    latch,
    player,
    pointerSurfaces,
    renderer,
    state,
    surfaceAt,
    townTalk,
    tvSeaY,
    walkMode,
  } = host;
  /** POI-3: THE EDITOR MADE - its documents, its eye and handles over this host's frame, its panel, its lines. The body
   *  stands where the builder left it while the editor is open: the motor held (frameMotor), no blow lands on it (the
   *  damage fold), the eye the world's own `cam` so the streamer and the floating origin follow it as they follow the dev
   *  fly-cam. Leaving: back to the body (fetched by a teleport if its pixel went while the eye was away), or stood on
   *  what is under the eye. */
  function mountPoiEditor(me, io) {
    const edit = createPoiEdit();
    const S = TERRAIN_SIZE;
    /** A scene point as its map pixel and the spot in that pixel's frame (streamingWorld.js pixelTranslation, inverted). */
    const sceneToPixel = (p) => {
      const t0 = state.pixelTranslation(0, 0, [0, 0, 0]);
      const px = Math.floor((p[0] - t0[0]) / S),
        py = Math.ceil((t0[2] - p[2]) / S);
      return { px, py, x: p[0] - (t0[0] + px * S), z: p[2] - (t0[2] - py * S) };
    };
    let panel = null;
    let openedAt = restoresSoFar(); // AUDIT POI E14: the loads made when the editor last opened (save.js restoresSoFar: every load passes its one door)
    const editor = createPoiEditorHost({
      edit,
      feed: host.poiFeed,
      host: host.poiHost,
      view: () =>
        host._lastProj && host._lastView
          ? {
              proj: host._lastProj,
              view: host._lastView,
              eye: cam.pos,
              fovY: fieldOfView() + climbFeel.fovRad(),
              w: canvas.clientWidth,
              h: canvas.clientHeight,
              rect: worldViewportRect(canvas.clientWidth, canvas.clientHeight),
              canvasRect: canvas.getBoundingClientRect(),
            }
          : null,
      translation: (px, py, out) => state.pixelTranslation(px, py, out),
      sceneToPixel,
      // the ground under a ray, or a model standing on it, whichever is nearer (a part placed on a roof stands on the roof)
      groundHit: (o, d) => {
        const g = groundHit(o, d, surfaceAt);
        const m = collider.raycastHit(o, d, Math.min(g.dist, POI_PICK_REACH));
        return m && m.dist < g.dist
          ? { point: [o[0] + d[0] * m.dist, o[1] + d[1] * m.dist, o[2] + d[2] * m.dist], dist: m.dist }
          : g;
      },
      surfaceAt: (x, z) => surfaceAt(x, z),
      onChange: () => panel?.refresh(),
      pass: new PoiGizmoPass(renderer.gl),
      actionOf: (e) => actionOf(e, keys), // the eye flies by the registry's actions - the builder's own bindings
      viewport: () => renderer.worldViewportPx, // AUDIT POI E18: the lines' pixels the world pass's own (the strip above a docked large HUD)
      // AUDIT POI E14: THE WORLD GONE FROM UNDER IT - a mode changed (a building or a dungeon entered by any door: the
      // editor's listener ate every key in it, the motor held on the way back out) or a game loaded: the editor left,
      // its eye and body where the change put them
      gone: () => _mode() !== 'exterior' || restoresSoFar() !== openedAt,
      onGone: () => exit('away'),
    });
    registerPlayerDamageMod('poi-editor', (_e, dmg) => (editor.active() ? 0 : dmg)); // the body left standing takes no blow
    let from = null,
      cursorWas = false,
      hotbarKeysBack = null;
    // the editor's input (scenes/poiEditorHost.js createPoiEditorRouter): the window's events in their capture phase, and a
    // key typed at the panel's own controls (AUDIT POI E2) on the panel's root
    const route = createPoiEditorRouter({
      editor,
      canvas,
      cam,
      acts: () => panel.acts,
      owns: (target) => panel.owns(target),
      overlayUp: () => townTalk.overlayActive,
      textEntry: isTextEntryTarget,
      win: window,
    });
    const onEvent = route.onEvent;
    /** AUDIT POI E3: the world's held keys and its key edges let go - a key held as the editor opened stayed held after it
     *  closed (the editor ate its keyup, and only the world's own keyup empties the set): the body walked on its own. */
    const worldKeysUp = () => {
      keys.clear();
      for (const ring of Object.values(latch.edge)) ring.clear();
    };
    function enter() {
      if (editor.active()) return;
      // AUDIT POI E12: on foot alone - a bench sets the eye on itself every frame after the editor's, a saddle's rig draws
      // over the view, and a helm is a ship's
      if (
        _mode() !== 'exterior' ||
        host.travelView?.active ||
        !isOnFoot(player.transportMode) ||
        !!csaRuntime?.isSailing?.()
      ) {
        townTalk.say(t('poi.editor.outdoorsOnly', 'The POI editor opens outdoors, on foot.'));
        return;
      }
      from = { yaw: cam.yaw, pitch: cam.pitch };
      openedAt = restoresSoFar();
      cursorWas = cursorActive();
      setCursorActive(true);
      releaseLook();
      hotbarKeysBack = holdHotbarKeys(); // AUDIT POI E1: the bar's digits are not the body's while the editor is open
      worldKeysUp();
      for (const ty of POI_EDITOR_EVENTS) window.addEventListener(ty, onEvent, { capture: true, passive: false });
      editor.enter();
      panel.setOn(true);
    }
    /** Leaving: 'back' to the body, 'here' onto the ground under the eye, 'away' as the world changed under it (a mode, a
     *  load - the eye and the body are where that put them). */
    function exit(how) {
      if (!editor.active()) return;
      let landing = null;
      if (how === 'here' && walkMode) {
        // stood on what is under the eye - the ground, a roof, a POI's own floor
        const below = surfaceAt(cam.pos[0], cam.pos[2]);
        // AUDIT POI E13: over ground not yet built, refused - the landing reached 15 m, found no floor and stood the body in
        // the air at the eye (the editor's guard against blows already down: the fall hurt)
        if (!Number.isFinite(below)) {
          panel.say(
            t(
              'poi.editor.hereNoGround',
              'The ground here has not loaded yet. Fly on, or exit to where you were standing.',
            ),
            'bad',
          );
          return;
        }
        landing = floorLanding(collider, [cam.pos[0], cam.pos[1], cam.pos[2]], Math.max(10, cam.pos[1] - below + 5), 0);
        // ...and the teleport's own check (UNSTUCK-OUT): a floor inside a rock is no place to stand - the nearest open ground
        if (heldInSolid(collider, landing))
          landing = openGroundNear(collider, landing[0], landing[2], { dry: (floor) => floor >= tvSeaY() }) ?? landing;
      }
      for (const ty of POI_EDITOR_EVENTS) window.removeEventListener(ty, onEvent, { capture: true });
      editor.exit();
      panel.setOn(false);
      hotbarKeysBack?.();
      hotbarKeysBack = null;
      worldKeysUp(); // AUDIT POI E3: the keys held under the editor are not the world's on the way out
      if (landing) {
        player.spawn(landing[0], landing[1], landing[2]);
        host.playerSpawned = true;
      } else if (from && how !== 'away') {
        cam.yaw = from.yaw;
        cam.pitch = from.pitch;
        const at = sceneToPixel(player.pos);
        // the body's pixel went while the eye was away: fetched back by the one door that rebuilds a place
        if (walkMode && !built.has(`${at.px},${at.py}`))
          _teleportToPixel(at.px, at.py, [at.x, player.pos[1] + 1, at.z], {
            grounded: true,
          }) /* ohTeleportToWorld's way: the pixel's own spot, the frame's height, landed on what is under it */
            .catch((e2) => console.warn('[poi] back to the body', e2?.message ?? e2));
      }
      if (walkMode && how !== 'away') cam.pos = player.eyeAt();
      setCursorActive(cursorWas);
      if (
        !cursorWas &&
        !gamePaused() &&
        !pointerSurfaces.size &&
        !(host.modes?.modalWindowUp?.() ?? false) &&
        !overlayOpen()
      )
        requestLook(canvas);
    }
    function jump() {
      // the map, armed: the body taken to the square picked (the one door that rebuilds a place far off), the eye above it
      const win = buildTravelMapWindow({
        onTeleport: (pick) => {
          const p = pick?.pixel;
          if (!p) return;
          _teleportToPixel(p.x, p.y, null, { grounded: true }).then(
            () => {
              cam.pos = [player.pos[0], player.pos[1] + 40, player.pos[2]];
              cam.pitch = -0.6;
            },
            (e2) => console.warn('[poi] the jump', e2?.message ?? e2),
          );
        },
      });
      win?.activateTeleportationTravel();
      if (win) townTalk.showOverlay(win);
    }
    /** POI-6: the eye to a POI's place (the approver's look) - the body taken there by the same door as the map's jump,
     *  the eye south of the place and above it, looking north and down at it. */
    function goTo(place) {
      if (!place) return;
      _teleportToPixel(place.px, place.py, [place.x, player.pos[1] + 1, place.z], { grounded: true }).then(
        () => {
          cam.pos = [player.pos[0], player.pos[1] + 25, player.pos[2] - 35];
          cam.yaw = 0;
          cam.pitch = -0.6;
        },
        (e2) => console.warn('[poi] going there', e2?.message ?? e2),
      );
    }
    panel = createPoiEditorPanel({
      edit,
      editor,
      feed: host.poiFeed,
      io,
      me,
      onExit: exit,
      onEnter: enter,
      onJump: jump,
      decodeImage: decodePoiImage,
      goTo,
    });
    for (const ty of ['keydown', 'keyup']) panel.root.addEventListener(ty, route.onPanelKey); // AUDIT POI E2: a key at the panel's controls
    editor.wantsOpen = (id) => {
      panel.open(id).catch((e2) => console.warn('[poi] opening it', e2?.message ?? e2));
    }; // AUDIT POI E15: a live POI clicked in the world is opened for editing (its own open draft, else its live revision), as the outliner opens it
    document.body.append(panel.root);
    host.poiEditor = editor;
    host.poiEditorLeave = exit;
    enter();
  }
  return { mountPoiEditor };
}
