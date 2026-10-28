import assert from 'node:assert/strict';
import { createPlaybackManager } from '../../../src/systems/video/playbackManager.js';
import { _resetVideoProviders, registerVideoProvider } from '../../../src/systems/video/providerRegistry.js';
import { videoCapabilitiesOf } from '../../../src/net/videoSurfaceLaw.js';

_resetVideoProviders();
const calls = [];
registerVideoProvider({
  id: 'direct',
  capabilities: videoCapabilitiesOf('direct'),
  create: () => {
    let t = 0;
    let vol = 1;
    return {
      async load(src) { calls.push(['load', src]); },
      play() { calls.push(['play']); },
      pause() { calls.push(['pause']); },
      seek(s) { t = s; calls.push(['seek', s]); },
      getCurrentTime() { return t; },
      getDuration() { return 100; },
      setVolume(v) { vol = v; calls.push(['vol', v]); },
      getState() { return 'paused'; },
      getTexture() { return { tex: 1 }; },
      destroy() { calls.push(['destroy']); },
    };
  },
});

const mgr = createPlaybackManager({ now: () => 10_000, activeMax: 1 });
const state = {
  mapId: 1, buildingKey: 2, pieceId: 'abc123def456',
  provider: 'direct', sourceId: 'https://upload.wikimedia.org/x.mp4',
  status: 'playing', basePositionSeconds: 0, serverStartedAt: 10_000,
  updatedAt: 10_000, revision: 1,
};
mgr.hear(state);
await mgr.tick([{
  id: '1:2:abc123def456', mapId: 1, buildingKey: 2, pieceId: 'abc123def456',
  dist: 5, visible: true,
}]);
assert.ok(calls.some((c) => c[0] === 'load'));
assert.ok(mgr.textureOf('1:2:abc123def456'));

mgr.hear({ ...state, revision: 2, status: 'paused', serverStartedAt: null, basePositionSeconds: 4 });
await mgr.tick([{
  id: '1:2:abc123def456', mapId: 1, buildingKey: 2, pieceId: 'abc123def456',
  dist: 5, visible: true,
}]);
assert.ok(calls.some((c) => c[0] === 'pause'));

mgr.hear({ ...state, revision: 1 }); // stale
assert.equal(mgr.stateOf('1:2:abc123def456').revision, 2);

mgr.clear('1:2:abc123def456');
assert.equal(mgr.textureOf('1:2:abc123def456'), null);
assert.ok(calls.some((c) => c[0] === 'destroy'));

_resetVideoProviders();
console.log('playbackManager: ok');
