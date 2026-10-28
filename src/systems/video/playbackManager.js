// @ts-check
// VIDEO1 — player lifecycle, proximity activation, drift correction, active cap.
import {
  videoPositionAt, videoDriftOf, videoCapabilitiesOf, videoRevNewer,
  VIDEO_ACTIVATE_M, VIDEO_DEACTIVATE_M, VIDEO_ACTIVE_MAX,
} from '../../net/videoSurfaceLaw.js';
import { videoProviderOf } from './providerRegistry.js';
import './directVideoAdapter.js';
import './youtubeAdapter.js';

/** @param {{ renderer?: any, audio?: any, document?: Document, origin?: string, now?: () => number, disabled?: () => boolean, muted?: () => boolean, activeMax?: number }} deps */
export function createPlaybackManager(deps = {}) {
  const now = deps.now ?? (() => Date.now());
  const activeMax = deps.activeMax ?? VIDEO_ACTIVE_MAX;
  /** @type {Map<string, { state: any, player: any, active: boolean, localMute: boolean, panel?: HTMLElement }>} */
  const slots = new Map();

  function keyOf(s) {
    return `${s.mapId}:${s.buildingKey}:${s.pieceId}`;
  }

  function destroySlot(slot) {
    try { slot.player?.destroy?.(); } catch { /* */ }
    slot.player = null;
    slot.active = false;
    if (slot.panel?.parentNode) slot.panel.parentNode.removeChild(slot.panel);
    slot.panel = undefined;
  }

  async function ensurePlayer(slot) {
    if (slot.player) return slot.player;
    const prov = videoProviderOf(slot.state.provider);
    if (!prov) return null;
    const panel = slot.state.provider === 'youtube'
      ? (deps.document ?? document)?.createElement?.('div')
      : undefined;
    if (panel) {
      panel.className = 'df-video-yt';
      panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:480px;height:270px;z-index:45;background:#000;';
      (deps.document ?? document)?.body?.appendChild(panel);
      slot.panel = panel;
    }
    const player = prov.create({
      renderer: deps.renderer,
      audio: deps.audio,
      document: deps.document,
      origin: deps.origin,
      mount: panel,
      onError: () => {},
      onAutoplayBlocked: () => {},
    });
    slot.player = player;
    await player.load(slot.state.sourceId);
    return player;
  }

  function applyState(slot) {
    const p = slot.player;
    if (!p) return;
    const serverPos = videoPositionAt(slot.state, now());
    const local = p.getCurrentTime?.() ?? 0;
    const drift = videoDriftOf(local, serverPos);
    if (slot.state.status === 'playing') {
      if (drift === 'hard') p.seek?.(serverPos);
      else if (drift === 'soft' && p.setPlaybackRate) {
        try { p.setPlaybackRate(local < serverPos ? 1.05 : 0.95); } catch { /* */ }
      }
      p.play?.();
    } else if (slot.state.status === 'paused') {
      if (drift !== 'ok') p.seek?.(serverPos);
      p.pause?.();
    } else {
      p.pause?.();
      if (slot.state.status === 'stopped') p.seek?.(0);
    }
    const vol = (deps.muted?.() || slot.localMute) ? 0 : 1;
    p.setVolume?.(vol);
  }

  return {
    /** Merge authoritative state if newer. */
    hear(state) {
      if (!state?.pieceId) return;
      const k = keyOf(state);
      let slot = slots.get(k);
      if (!slot) {
        slot = { state, player: null, active: false, localMute: false };
        slots.set(k, slot);
      } else if (!videoRevNewer(slot.state.revision, state.revision)) {
        return;
      } else if (slot.state.provider !== state.provider || slot.state.sourceId !== state.sourceId) {
        destroySlot(slot);
        slot.state = state;
      } else {
        slot.state = state;
      }
      if (slot.active) applyState(slot);
    },
    clear(pieceKey) {
      const slot = slots.get(pieceKey);
      if (!slot) return;
      destroySlot(slot);
      slots.delete(pieceKey);
    },
    clearAll() {
      for (const k of [...slots.keys()]) this.clear(k);
    },
    setLocalMute(pieceKey, mute) {
      const slot = slots.get(pieceKey);
      if (!slot) return;
      slot.localMute = !!mute;
      slot.player?.setVolume?.(mute || deps.muted?.() ? 0 : 1);
    },
    /**
     * Pick nearest surfaces to activate.
     * @param {{ id: string, mapId: number, buildingKey: number, pieceId: string, dist: number, visible: boolean }[]} candidates
     */
    async tick(candidates) {
      if (deps.disabled?.()) {
        for (const slot of slots.values()) if (slot.active) destroySlot(slot);
        return;
      }
      const ranked = [...candidates]
        .filter((c) => c.visible && c.dist <= VIDEO_DEACTIVATE_M)
        .sort((a, b) => a.dist - b.dist);
      const want = new Set();
      for (const c of ranked) {
        if (want.size >= activeMax) break;
        if (c.dist <= VIDEO_ACTIVATE_M || slots.get(`${c.mapId}:${c.buildingKey}:${c.pieceId}`)?.active) {
          want.add(`${c.mapId}:${c.buildingKey}:${c.pieceId}`);
        }
      }
      for (const [k, slot] of slots) {
        if (!want.has(k) && slot.active) destroySlot(slot);
      }
      for (const k of want) {
        const slot = slots.get(k);
        if (!slot) continue;
        if (!slot.active) {
          slot.active = true;
          try { await ensurePlayer(slot); applyState(slot); }
          catch { destroySlot(slot); }
        } else {
          applyState(slot);
          slot.player?.tick?.();
        }
      }
    },
    /** Texture for a direct-video surface, if active. */
    textureOf(pieceKey) {
      return slots.get(pieceKey)?.player?.getTexture?.() ?? null;
    },
    stateOf(pieceKey) {
      return slots.get(pieceKey)?.state ?? null;
    },
    slots: () => slots,
    capabilitiesOf: videoCapabilitiesOf,
  };
}
