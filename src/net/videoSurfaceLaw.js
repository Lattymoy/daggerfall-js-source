// @ts-check
// VIDEO1 (2026-10-28, bible/11-Multiplayer/Video-Surfaces.md) — pure law for
// synchronized video surfaces on home paintings. No clock, no DOM, no network.

import { DECOR_ID_RE } from './decorLaw.js';
import { homeMapIdOk, homeBuildingKeyOk } from './homeLaw.js';

/** Paintings item template (itemTemplatesData.js). */
export const VIDEO_PAINTING_TEMPLATE = 284;

export const VIDEO_PROVIDERS = Object.freeze(['youtube', 'direct']);
export const VIDEO_STATUSES = Object.freeze(['idle', 'playing', 'paused', 'stopped']);

/** Soft drift nudge below this; hard seek at or above VIDEO_DRIFT_HARD_S. */
export const VIDEO_DRIFT_SOFT_S = 0.35;
export const VIDEO_DRIFT_HARD_S = 1.0;

export const VIDEO_ACTIVATE_M = 18;
export const VIDEO_DEACTIVATE_M = 24;
export const VIDEO_ACTIVE_MAX = 2;

export const VIDEO_OPS_MAX = 120;
export const VIDEO_OPS_WINDOW_S = 3600;

/** Direct hosts the service accepts. Empty means none until an entry is added. */
export const VIDEO_DIRECT_HOSTS = Object.freeze([
  'upload.wikimedia.org',
  'commons.wikimedia.org',
]);

export const VIDEO_SOURCE_MAX = 512;
export const VIDEO_YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be']);

/**
 * Canonical source from a pasted URL, or null.
 * @returns {{ provider: 'youtube'|'direct', sourceId: string, url: string } | null}
 */
export function videoSourceOf(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > VIDEO_SOURCE_MAX) return null;
  let u;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (u.username || u.password || u.hash) return null;
  const host = u.hostname.toLowerCase();
  if (YT_HOSTS.has(host)) {
    const id = youtubeIdOf(u);
    if (!id) return null;
    return { provider: 'youtube', sourceId: id, url: `https://www.youtube.com/watch?v=${id}` };
  }
  if (!VIDEO_DIRECT_HOSTS.includes(host)) return null;
  const path = u.pathname.toLowerCase();
  if (!path.endsWith('.mp4') && !path.endsWith('.webm')) return null;
  u.search = '';
  return { provider: 'direct', sourceId: u.href, url: u.href };
}

function youtubeIdOf(/** @type {URL} */ u) {
  const host = u.hostname.toLowerCase();
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0] ?? '';
    return VIDEO_YT_ID_RE.test(id) ? id : null;
  }
  if (u.pathname.startsWith('/shorts/')) {
    const id = u.pathname.slice('/shorts/'.length).split('/')[0] ?? '';
    return VIDEO_YT_ID_RE.test(id) ? id : null;
  }
  if (u.pathname.startsWith('/live/')) {
    const id = u.pathname.slice('/live/'.length).split('/')[0] ?? '';
    return VIDEO_YT_ID_RE.test(id) ? id : null;
  }
  const v = u.searchParams.get('v') ?? '';
  return VIDEO_YT_ID_RE.test(v) ? v : null;
}

/** Capability flags for a provider. */
export function videoCapabilitiesOf(provider) {
  if (provider === 'youtube') {
    return Object.freeze({
      seek: true, live: true, volume: true, rate: false,
      presentation: /** @type {const} */ ('domPanel'), texture: false,
    });
  }
  if (provider === 'direct') {
    return Object.freeze({
      seek: true, live: false, volume: true, rate: true,
      presentation: /** @type {const} */ ('worldTexture'), texture: true,
    });
  }
  return null;
}

/** Shared playback state, or null. @returns {null | { mapId: number, buildingKey: number, pieceId: string, provider: string, sourceId: string, status: string, basePositionSeconds: number, serverStartedAt: number | null, updatedAt: number, revision: number }} */
export function videoStateOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const {
    mapId, buildingKey, pieceId, provider, sourceId, status,
    basePositionSeconds = 0, serverStartedAt = null, updatedAt, revision,
  } = /** @type {any} */ (raw);
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return null;
  if (typeof pieceId !== 'string' || !DECOR_ID_RE.test(pieceId)) return null;
  if (!VIDEO_PROVIDERS.includes(provider) || typeof sourceId !== 'string' || !sourceId || sourceId.length > VIDEO_SOURCE_MAX) return null;
  if (!VIDEO_STATUSES.includes(status)) return null;
  if (!Number.isFinite(basePositionSeconds) || basePositionSeconds < 0 || basePositionSeconds > 86400 * 7) return null;
  if (serverStartedAt != null && (!Number.isSafeInteger(serverStartedAt) || serverStartedAt < 0)) return null;
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0) return null;
  if (!Number.isSafeInteger(revision) || revision < 1) return null;
  if (status === 'playing' && serverStartedAt == null) return null;
  return {
    mapId, buildingKey, pieceId, provider, sourceId, status,
    basePositionSeconds: Math.round(basePositionSeconds * 1000) / 1000,
    serverStartedAt, updatedAt, revision,
  };
}

/** Projected playback position at `nowMs`. */
export function videoPositionAt(state, nowMs) {
  if (!state) return 0;
  if (state.status !== 'playing' || state.serverStartedAt == null) return state.basePositionSeconds;
  const t = state.basePositionSeconds + (nowMs - state.serverStartedAt) / 1000;
  return t < 0 ? 0 : t;
}

/**
 * Drift decision for a local player vs server projection.
 * @returns {'ok'|'soft'|'hard'}
 */
export function videoDriftOf(localSeconds, serverSeconds) {
  const d = Math.abs(localSeconds - serverSeconds);
  if (d >= VIDEO_DRIFT_HARD_S) return 'hard';
  if (d >= VIDEO_DRIFT_SOFT_S) return 'soft';
  return 'ok';
}

/** Apply a command to prior state. Answers new fields or `{ error }`. */
export function videoApplyCmd(prior, cmd, nowMs) {
  const op = cmd?.op;
  if (op === 'source') {
    const src = videoSourceOf(cmd.url);
    if (!src) return { error: 'bad-source' };
    return {
      provider: src.provider, sourceId: src.sourceId, status: 'stopped',
      basePositionSeconds: 0, serverStartedAt: null, updatedAt: nowMs,
    };
  }
  if (!prior) return { error: 'no-surface' };
  if (op === 'play') {
    const base = Number.isFinite(cmd?.position) ? Math.max(0, cmd.position) : prior.basePositionSeconds;
    return {
      provider: prior.provider, sourceId: prior.sourceId, status: 'playing',
      basePositionSeconds: base, serverStartedAt: nowMs, updatedAt: nowMs,
    };
  }
  if (op === 'pause') {
    const at = videoPositionAt(prior, nowMs);
    return {
      provider: prior.provider, sourceId: prior.sourceId, status: 'paused',
      basePositionSeconds: at, serverStartedAt: null, updatedAt: nowMs,
    };
  }
  if (op === 'stop') {
    return {
      provider: prior.provider, sourceId: prior.sourceId, status: 'stopped',
      basePositionSeconds: 0, serverStartedAt: null, updatedAt: nowMs,
    };
  }
  if (op === 'seek') {
    const caps = videoCapabilitiesOf(prior.provider);
    if (!caps?.seek) return { error: 'no-seek' };
    if (!Number.isFinite(cmd.seconds) || cmd.seconds < 0) return { error: 'bad-seek' };
    const playing = prior.status === 'playing';
    return {
      provider: prior.provider, sourceId: prior.sourceId,
      status: playing ? 'playing' : (prior.status === 'idle' ? 'paused' : prior.status),
      basePositionSeconds: cmd.seconds,
      serverStartedAt: playing ? nowMs : null,
      updatedAt: nowMs,
    };
  }
  if (op === 'clear') return { error: 'clear' }; // service deletes the row
  return { error: 'bad-op' };
}

/** Whether this revision should replace the one held. */
export const videoRevNewer = (have, next) => Number.isSafeInteger(next) && (!Number.isSafeInteger(have) || next > have);

/** Whether a decor item descriptor is a Painting (template 284). */
export const videoIsPaintingItem = (item) => {
  if (!item) return false;
  const t = Number(item.t ?? item.templateIndex);
  return Number.isSafeInteger(t) && t === VIDEO_PAINTING_TEMPLATE;
};
