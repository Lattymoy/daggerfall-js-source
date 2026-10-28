// @ts-check
// VIDEO1 — thin host: maps video state onto painting pieces, draws direct textures, ticks playback.
import {
  VIDEO_ACTIVATE_M, VIDEO_DEACTIVATE_M, videoIsPaintingItem, videoStateOf,
} from '../../net/videoSurfaceLaw.js';
import { decorMountQuad, decorMountFloats } from './decorRoom.js';
import { createPlaybackManager } from '../../systems/video/playbackManager.js';
import { onVideoWords, carryVideoOrder, videoPushState } from '../../net/videoPush.js';
import { DECOR_MOUNT_LIFT } from '../../net/decorLaw.js';
import { openVideoSurfaceWindow } from '../../ui/videoSurfaceWindow.js';

/** Live bag for createInteriorVideoSurfaces — kept out of createWorldModes (HOST-SPLIT). */
export function videoInteriorBag(room, host, building, eye, origin, homeTownOf) {
  return {
    room, homeDecor: host?.homeDecor,
    mapId: building ? Number(homeTownOf(building)) >>> 0 : 0,
    buildingKey: building?.buildingKey ?? 0,
    character: host?.decorCharacter?.() ?? '',
    eye, origin,
  };
}

/** One-call wiring for worldModes (HOST-SPLIT). `live()` returns the interior bag each tick. */
export function createInteriorVideoSurfaces(renderer, audio, live) {
  const g = (k, fallback) => () => { const bag = live(); return bag?.[k] ?? fallback; };
  return createVideoSurfaceHost({
    renderer, audio,
    get room() { return live()?.room; },
    api: {
      videoSurfaces: (b) => live()?.homeDecor?.videoSurfaces?.(b),
      videoCmd: (b) => live()?.homeDecor?.videoCmd?.(b),
    },
    mapId: g('mapId', 0),
    buildingKey: g('buildingKey', 0),
    character: g('character', ''),
    eye: g('eye', [0, 0, 0]),
    origin: g('origin', [0, 0, 0]),
    disabled: () => false,
  });
}

/** @param {{ renderer: any, audio?: any, room: any, api?: any, mapId?: () => number, buildingKey?: () => number, character?: () => string, eye?: () => number[], origin?: () => number[], now?: () => number, disabled?: () => boolean, muted?: () => boolean }} deps */
export function createVideoSurfaceHost(deps) {
  const playback = createPlaybackManager({
    renderer: deps.renderer,
    audio: deps.audio,
    now: deps.now,
    disabled: deps.disabled,
    muted: deps.muted,
  });
  /** @type {Map<string, any>} */
  const byPiece = new Map();
  /** @type {Map<string, { batch: any, quad: any }>} */
  const mounts = new Map();
  let pollAt = 0;
  let pushEpoch = videoPushState().epoch;
  const offWords = onVideoWords((words) => {
    for (const w of words) {
      const [mapId, buildingKey, pieceId, revision] = w;
      if (deps.mapId?.() !== mapId || deps.buildingKey?.() !== buildingKey) continue;
      const have = byPiece.get(pieceId);
      if (have && have.revision >= revision) continue;
      void refreshOne(pieceId);
    }
  });

  async function refreshAll() {
    const api = deps.api;
    if (!api?.videoSurfaces) return;
    const mapId = deps.mapId?.();
    const buildingKey = deps.buildingKey?.();
    const character = deps.character?.();
    if (mapId == null || buildingKey == null || !character) return;
    const r = await api.videoSurfaces({ mapId, buildingKey, character });
    if (!r?.ok || !Array.isArray(r.surfaces)) return;
    const seen = new Set();
    for (const raw of r.surfaces) {
      const s = videoStateOf(raw);
      if (!s) continue;
      seen.add(s.pieceId);
      byPiece.set(s.pieceId, s);
      playback.hear(s);
      ensureMount(s.pieceId);
    }
    for (const id of [...byPiece.keys()]) {
      if (!seen.has(id)) {
        byPiece.delete(id);
        playback.clear(`${mapId}:${buildingKey}:${id}`);
        dropMount(id);
      }
    }
  }

  async function refreshOne(pieceId) {
    await refreshAll();
    void pieceId;
  }

  function pieceEntry(id) {
    const piece = deps.room?.pieceOf?.(id);
    if (!piece) return null;
    // Prefer the live standing entry when the room exposes it; else synthesize size from scale.
    const live = deps.room?.entryOf?.(id);
    if (live) return live;
    return { piece, o: deps.origin?.() ?? [0, 0, 0], size: { w: 0.6 * (piece.scale || 1), h: 0.45 * (piece.scale || 1) } };
  }

  function ensureMount(pieceId) {
    const entry = pieceEntry(pieceId);
    const piece = entry?.piece;
    if (!piece || !videoIsPaintingItem(piece.item)) return;
    if (mounts.has(pieceId) || !deps.renderer?.createDecalBatch) return;
    const size = entry.size ?? { w: 0.6 * (piece.scale || 1), h: 0.45 * (piece.scale || 1) };
    const o = deps.origin?.() ?? entry.o ?? [0, 0, 0];
    const lifted = {
      ...piece,
      pos: [
        piece.pos[0] + DECOR_MOUNT_LIFT * 0, // lift via mount frame normal below
        piece.pos[1],
        piece.pos[2],
      ],
    };
    const quad = decorMountQuad(lifted, o, size);
    // push along normal to avoid z-fight with the wall / billboard
    const n = quad.normal;
    quad.centre = [quad.centre[0] + n[0] * DECOR_MOUNT_LIFT, quad.centre[1] + n[1] * DECOR_MOUNT_LIFT, quad.centre[2] + n[2] * DECOR_MOUNT_LIFT];
    quad.corners = quad.corners.map((c) => [c[0] + n[0] * DECOR_MOUNT_LIFT, c[1] + n[1] * DECOR_MOUNT_LIFT, c[2] + n[2] * DECOR_MOUNT_LIFT]);
    const batch = deps.renderer.createDecalBatch(1);
    deps.renderer.writeDecalSlot?.(batch, 0, decorMountFloats(quad));
    mounts.set(pieceId, { batch, quad });
  }

  function dropMount(pieceId) {
    const m = mounts.get(pieceId);
    if (!m) return;
    deps.renderer?.destroyDecalBatch?.(m.batch);
    mounts.delete(pieceId);
  }

  function remountAll() {
    for (const id of [...mounts.keys()]) {
      dropMount(id);
      ensureMount(id);
    }
  }

  return {
    async load() { await refreshAll(); },
    hearOrder(order) { carryVideoOrder(order); },
    async cmd(body) {
      const api = deps.api;
      if (!api?.videoCmd) return { error: 'no-api' };
      const r = await api.videoCmd(body);
      if (r?.ok) {
        if (r.surface) {
          const s = videoStateOf(r.surface);
          if (s) { byPiece.set(s.pieceId, s); playback.hear(s); ensureMount(s.pieceId); }
        } else if (body?.id) {
          byPiece.delete(body.id);
          playback.clear(`${body.mapId}:${body.buildingKey}:${body.id}`);
          dropMount(body.id);
        }
        if (r.videoOrder) carryVideoOrder(r.videoOrder);
      }
      return r;
    },
    configured(pieceId) { return byPiece.has(pieceId); },
    stateOf(pieceId) { return byPiece.get(pieceId) ?? null; },
    /** Open the television menu for a painting piece; true when handled. */
    tryOpen(piece, pieceId, canControl, say) {
      if (!videoIsPaintingItem(piece?.item)) return false;
      const mapId = deps.mapId?.() ?? 0;
      const buildingKey = deps.buildingKey?.() ?? 0;
      const character = deps.character?.() ?? '';
      openVideoSurfaceWindow({
        mapId, buildingKey, pieceId, character,
        state: byPiece.get(pieceId) ?? null,
        canControl: !!canControl,
        onCmd: (body) => this.cmd(body),
        onMute: (mute) => this.setLocalMute(pieceId, mute),
        onClose: () => {},
        say,
      });
      return true;
    },
    setLocalMute(pieceId, mute) {
      const mapId = deps.mapId?.();
      const buildingKey = deps.buildingKey?.();
      if (mapId == null || buildingKey == null) return;
      playback.setLocalMute(`${mapId}:${buildingKey}:${pieceId}`, mute);
    },
    onMoved() { remountAll(); },
    async tick(dt) {
      const st = videoPushState();
      if (st.epoch !== pushEpoch) { pushEpoch = st.epoch; await refreshAll(); }
      pollAt += dt;
      if (pollAt >= 8 || (!st.healthy && pollAt >= 2)) { pollAt = 0; await refreshAll(); }

      const eye = deps.eye?.() ?? [0, 0, 0];
      const mapId = deps.mapId?.();
      const buildingKey = deps.buildingKey?.();
      if (mapId == null || buildingKey == null) return;
      const candidates = [];
      for (const [pieceId, state] of byPiece) {
        const entry = pieceEntry(pieceId);
        const pos = entry?.piece?.pos;
        if (!pos) continue;
        const o = deps.origin?.() ?? entry.o ?? [0, 0, 0];
        const wx = o[0] + pos[0], wy = o[1] + pos[1], wz = o[2] + pos[2];
        const dx = eye[0] - wx, dy = eye[1] - wy, dz = eye[2] - wz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        candidates.push({
          id: `${mapId}:${buildingKey}:${pieceId}`,
          mapId, buildingKey, pieceId, dist,
          visible: dist <= VIDEO_DEACTIVATE_M + 1,
        });
        void state;
      }
      await playback.tick(candidates);
    },
    draw(r = deps.renderer) {
      let n = 0;
      const mapId = deps.mapId?.();
      const buildingKey = deps.buildingKey?.();
      for (const [pieceId, m] of mounts) {
        const key = `${mapId}:${buildingKey}:${pieceId}`;
        const tex = playback.textureOf(key);
        if (!tex) continue;
        (r?.drawDecalPicture ?? r?.drawDecals)?.call(r, m.batch, tex);
        n++;
      }
      return n;
    },
    /** End of an interior visit — keep the push ear for the next visit. */
    destroy() {
      playback.clearAll();
      for (const id of [...mounts.keys()]) dropMount(id);
      byPiece.clear();
      pollAt = 0;
    },
    /** Modes teardown. */
    dispose() {
      this.destroy();
      offWords();
    },
    /** For tests. */
    _playback: playback,
    _byPiece: byPiece,
  };
}

void VIDEO_ACTIVATE_M;
