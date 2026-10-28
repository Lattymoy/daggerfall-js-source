// @ts-check
// VIDEO1 — HTTPS MP4/WebM → one owned WebGL texture + optional media-element audio.
import { videoCapabilitiesOf } from '../../net/videoSurfaceLaw.js';
import { registerVideoProvider } from './providerRegistry.js';

/** @param {{ renderer: any, audio?: any, document?: Document, onState?: (s: string) => void, onError?: (e: string) => void }} deps */
export function createDirectVideoAdapter(deps) {
  const doc = deps.document ?? (typeof document !== 'undefined' ? document : null);
  /** @type {HTMLVideoElement | null} */
  let el = null;
  /** @type {WebGLTexture | null} */
  let tex = null;
  /** @type {any} */
  let media = null;
  let destroyed = false;
  let rvfc = 0;
  let lastW = 0;
  let lastH = 0;

  function ensureEl() {
    if (el || !doc) return el;
    el = doc.createElement('video');
    el.crossOrigin = 'anonymous';
    el.playsInline = true;
    el.preload = 'auto';
    el.muted = false;
    el.addEventListener('error', () => deps.onError?.('load-failed'));
    el.addEventListener('waiting', () => deps.onState?.('buffering'));
    el.addEventListener('playing', () => deps.onState?.('playing'));
    el.addEventListener('pause', () => deps.onState?.('paused'));
    el.addEventListener('ended', () => deps.onState?.('ended'));
    return el;
  }

  function ensureTex() {
    if (tex || !deps.renderer?.createVideoTexture) return tex;
    tex = deps.renderer.createVideoTexture();
    return tex;
  }

  function pumpFrame() {
    if (destroyed || !el || el.readyState < 2) return;
    const t = ensureTex();
    if (!t) return;
    const w = el.videoWidth | 0;
    const h = el.videoHeight | 0;
    if (w > 0 && h > 0) {
      deps.renderer.updateVideoTexture(t, el, w !== lastW || h !== lastH);
      lastW = w; lastH = h;
    }
    if (typeof el.requestVideoFrameCallback === 'function') {
      rvfc = el.requestVideoFrameCallback(() => pumpFrame());
    }
  }

  const api = {
    capabilities: videoCapabilitiesOf('direct'),
    presentation: /** @type {const} */ ('worldTexture'),
    async load(source) {
      const v = ensureEl();
      if (!v) throw new Error('no-dom');
      v.src = String(source);
      await v.load?.();
      ensureTex();
      if (deps.audio?.attachMediaElement && !media) {
        try { media = deps.audio.attachMediaElement(v); } catch { media = null; }
      }
      if (typeof v.requestVideoFrameCallback === 'function') {
        rvfc = v.requestVideoFrameCallback(() => pumpFrame());
      }
    },
    play() { return el?.play()?.catch(() => deps.onError?.('autoplay-blocked')); },
    pause() { el?.pause(); },
    seek(seconds) { if (el && Number.isFinite(seconds)) el.currentTime = Math.max(0, seconds); },
    getCurrentTime() { return el?.currentTime ?? 0; },
    getDuration() { return el?.duration && Number.isFinite(el.duration) ? el.duration : 0; },
    setVolume(value) {
      const v = Math.max(0, Math.min(1, Number(value) || 0));
      if (media?.gain) media.gain.gain.value = v;
      else if (el) el.volume = v;
    },
    getState() {
      if (!el) return 'idle';
      if (el.error) return 'error';
      if (el.ended) return 'ended';
      if (el.paused) return 'paused';
      return 'playing';
    },
    getTexture() { return tex; },
    tick() {
      if (destroyed || !el) return;
      if (typeof el.requestVideoFrameCallback !== 'function') pumpFrame();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (el && rvfc && typeof el.cancelVideoFrameCallback === 'function') {
        try { el.cancelVideoFrameCallback(rvfc); } catch { /* */ }
      }
      rvfc = 0;
      media?.disconnect?.();
      media = null;
      if (el) {
        try { el.pause?.(); el.removeAttribute?.('src'); el.src = ''; el.load?.(); } catch { /* */ }
        el = null;
      }
      if (tex) { deps.renderer?.destroyVideoTexture?.(tex); tex = null; }
    },
  };
  return api;
}

registerVideoProvider({
  id: 'direct',
  capabilities: videoCapabilitiesOf('direct'),
  create: createDirectVideoAdapter,
});
