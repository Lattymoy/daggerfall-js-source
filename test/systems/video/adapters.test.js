import assert from 'node:assert/strict';
import { _resetVideoProviders, videoProviderOf } from '../../../src/systems/video/providerRegistry.js';
import { createDirectVideoAdapter } from '../../../src/systems/video/directVideoAdapter.js';
import { createYoutubeAdapter } from '../../../src/systems/video/youtubeAdapter.js';

_resetVideoProviders();
// Re-register via side-effect imports already done by create* modules — reset clears; re-import by calling factories directly.

{
  const uploads = [];
  const destroyed = [];
  const renderer = {
    createVideoTexture() { return { id: 'tex' }; },
    updateVideoTexture(tex, video, realloc) { uploads.push({ tex, realloc, w: video.videoWidth }); },
    destroyVideoTexture(tex) { destroyed.push(tex); },
  };
  const doc = {
    createElement(tag) {
      assert.equal(tag, 'video');
      const listeners = new Map();
      return {
        crossOrigin: '',
        playsInline: false,
        preload: '',
        muted: false,
        src: '',
        readyState: 2,
        videoWidth: 64,
        videoHeight: 36,
        currentTime: 0,
        volume: 1,
        paused: true,
        addEventListener(type, fn) { listeners.set(type, fn); },
        load() {},
        play() { this.paused = false; return Promise.resolve(); },
        pause() { this.paused = true; },
        requestVideoFrameCallback(cb) {
          if (!this._rvfc) { this._rvfc = 1; queueMicrotask(cb); }
          return 1;
        },
        cancelVideoFrameCallback() { this._rvfc = 0; },
      };
    },
  };
  const adapter = createDirectVideoAdapter({ renderer, document: /** @type {any} */ (doc) });
  assert.equal(adapter.presentation, 'worldTexture');
  await adapter.load('https://upload.wikimedia.org/wikipedia/commons/x.mp4');
  await adapter.play();
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(uploads.length >= 1);
  assert.ok(adapter.getTexture());
  adapter.destroy();
  adapter.destroy(); // idempotent
  assert.ok(destroyed.length >= 1);
}

{
  const players = [];
  const doc = {
    defaultView: {
      YT: {
        Player: class {
          constructor(host, opts) {
            players.push({ host, opts });
            queueMicrotask(() => opts.events?.onReady?.());
          }
          playVideo() {}
          pauseVideo() {}
          stopVideo() {}
          seekTo() {}
          getCurrentTime() { return 3; }
          getDuration() { return 30; }
          setVolume() {}
          getPlayerState() { return 1; }
          destroy() { players.push('destroyed'); }
        },
      },
    },
    createElement() { return { style: { cssText: '' }, parentNode: null }; },
    body: { appendChild() {} },
    scripts: [],
    head: { appendChild() {} },
  };
  const mount = { parentNode: {} };
  const adapter = createYoutubeAdapter({ document: /** @type {any} */ (doc), mount, origin: 'https://example.com' });
  assert.equal(adapter.presentation, 'domPanel');
  await adapter.load('dQw4w9WgXcQ');
  assert.equal(players[0].opts.videoId, 'dQw4w9WgXcQ');
  assert.equal(adapter.getCurrentTime(), 3);
  adapter.destroy();
  adapter.destroy();
  assert.ok(players.includes('destroyed'));
}

_resetVideoProviders();
assert.equal(videoProviderOf('direct'), null);
console.log('video adapters: ok');
