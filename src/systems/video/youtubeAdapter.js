// @ts-check
// VIDEO1 — official YouTube IFrame Player API as a DOM panel (never a WebGL texture).
import { videoCapabilitiesOf } from '../../net/videoSurfaceLaw.js';
import { registerVideoProvider } from './providerRegistry.js';

const YT_API_SRC = 'https://www.youtube.com/iframe_api';

/** @type {Promise<any> | null} */
let apiReady = null;

function loadYtApi(/** @type {Document} */ doc) {
  if (apiReady) return apiReady;
  apiReady = new Promise((resolve, reject) => {
    const w = /** @type {any} */ (doc.defaultView ?? globalThis);
    if (w.YT?.Player) { resolve(w.YT); return; }
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      try { prev?.(); } catch { /* */ }
      resolve(w.YT);
    };
    if (![...doc.scripts].some((s) => s.src === YT_API_SRC)) {
      const s = doc.createElement('script');
      s.src = YT_API_SRC;
      s.async = true;
      s.onerror = () => reject(new Error('yt-api'));
      doc.head.appendChild(s);
    }
  });
  return apiReady;
}

/** @param {{ document?: Document, origin?: string, mount?: HTMLElement, onState?: (s: string) => void, onError?: (e: string) => void, onAutoplayBlocked?: () => void }} deps */
export function createYoutubeAdapter(deps) {
  const doc = deps.document ?? (typeof document !== 'undefined' ? document : null);
  /** @type {any} */
  let player = null;
  /** @type {HTMLElement | null} */
  let host = null;
  let destroyed = false;

  const api = {
    capabilities: videoCapabilitiesOf('youtube'),
    presentation: /** @type {const} */ ('domPanel'),
    async load(sourceId) {
      if (!doc) throw new Error('no-dom');
      const YT = await loadYtApi(doc);
      if (destroyed) return;
      host = deps.mount ?? doc.createElement('div');
      if (!host.parentNode && deps.mount == null) {
        host.style.cssText = 'position:fixed;inset:auto;width:480px;height:270px;z-index:40;';
        doc.body.appendChild(host);
      }
      const origin = deps.origin ?? (typeof location !== 'undefined' ? location.origin : undefined);
      player = new YT.Player(host, {
        width: 480,
        height: 270,
        videoId: String(sourceId),
        playerVars: {
          enablejsapi: 1,
          origin,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => deps.onState?.('ready'),
          onStateChange: (e) => {
            const map = { [-1]: 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' };
            deps.onState?.(map[e?.data] ?? 'unknown');
          },
          onError: (e) => deps.onError?.(String(e?.data ?? 'yt-error')),
          onAutoplayBlocked: () => deps.onAutoplayBlocked?.(),
        },
      });
    },
    play() { try { player?.playVideo?.(); } catch { deps.onAutoplayBlocked?.(); } },
    pause() { try { player?.pauseVideo?.(); } catch { /* */ } },
    seek(seconds) { try { player?.seekTo?.(Math.max(0, seconds), true); } catch { /* */ } },
    getCurrentTime() {
      try { return Number(player?.getCurrentTime?.()) || 0; } catch { return 0; }
    },
    getDuration() {
      try { return Number(player?.getDuration?.()) || 0; } catch { return 0; }
    },
    setVolume(value) {
      try { player?.setVolume?.(Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)); } catch { /* */ }
    },
    getState() {
      try {
        const s = player?.getPlayerState?.();
        return ({ [-1]: 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' })[s] ?? 'idle';
      } catch { return 'idle'; }
    },
    getHost() { return host; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try { player?.destroy?.(); } catch { /* */ }
      player = null;
      if (host && host.parentNode && deps.mount == null) host.parentNode.removeChild(host);
      host = null;
    },
  };
  return api;
}

registerVideoProvider({
  id: 'youtube',
  capabilities: videoCapabilitiesOf('youtube'),
  create: createYoutubeAdapter,
});
