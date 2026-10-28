import assert from 'node:assert/strict';
import { createVideoSurfaceHost } from '../../../src/scenes/decor/videoSurfaceHost.js';
import { _resetVideoPush } from '../../../src/net/videoPush.js';
import { VIDEO_PAINTING_TEMPLATE } from '../../../src/net/videoSurfaceLaw.js';

_resetVideoPush();

const pieces = new Map();
const room = {
  pieceOf: (id) => pieces.get(id)?.piece ?? null,
  entryOf: (id) => pieces.get(id) ?? null,
};
pieces.set('abc123def456', {
  piece: {
    id: 'abc123def456',
    model: null, flat: [180, 0], item: { t: VIDEO_PAINTING_TEMPLATE, g: 9, m: null, v: null, a: null, p: 1 },
    pos: [1, 1.5, 2], rot: [90, 0, 0], scale: 1, paid: 0, light: null, storage: false, station: null,
  },
  o: [0, 0, 0],
  size: { w: 0.8, h: 0.6 },
});

const batches = [];
const renderer = {
  createDecalBatch: () => { const b = { id: batches.length }; batches.push(b); return b; },
  writeDecalSlot: () => {},
  destroyDecalBatch: (b) => { const i = batches.indexOf(b); if (i >= 0) batches.splice(i, 1); },
  drawDecalPicture: () => {},
  createVideoTexture: () => ({ kind: 'vid' }),
  updateVideoTexture: () => {},
  destroyVideoTexture: () => {},
};

let listed = 0;
const api = {
  videoSurfaces: async () => {
    listed++;
    return {
      ok: true,
      surfaces: [{
        mapId: 1001, buildingKey: 1, pieceId: 'abc123def456',
        provider: 'direct', sourceId: 'https://upload.wikimedia.org/x.mp4',
        status: 'stopped', basePositionSeconds: 0, serverStartedAt: null,
        updatedAt: 1, revision: 1,
      }],
    };
  },
  videoCmd: async (body) => ({
    ok: true,
    surface: body.op === 'clear' ? null : {
      mapId: 1001, buildingKey: 1, pieceId: 'abc123def456',
      provider: 'direct', sourceId: 'https://upload.wikimedia.org/x.mp4',
      status: 'playing', basePositionSeconds: 0, serverStartedAt: 1,
      updatedAt: 1, revision: (body.rev ?? 0) + 1,
    },
  }),
};

const host = createVideoSurfaceHost({
  renderer, room, api,
  mapId: () => 1001, buildingKey: () => 1, character: () => 'char1',
  eye: () => [1, 1.5, 2], origin: () => [0, 0, 0],
});

await host.load();
assert.equal(listed, 1);
assert.ok(host.configured('abc123def456'));
assert.equal(batches.length, 1);

const moved = { ...pieces.get('abc123def456') };
moved.piece = { ...moved.piece, pos: [2, 1.5, 2] };
pieces.set('abc123def456', moved);
host.onMoved();
assert.equal(batches.length, 1);

await host.cmd({
  op: 'play', mapId: 1001, buildingKey: 1, id: 'abc123def456', character: 'char1', rev: 1,
});
assert.equal(host.stateOf('abc123def456')?.status, 'playing');

host.destroy();
assert.equal(batches.length, 0);
assert.ok(!host.configured('abc123def456'));
host.dispose();
_resetVideoPush();
console.log('videoSurfaceHost: ok');
