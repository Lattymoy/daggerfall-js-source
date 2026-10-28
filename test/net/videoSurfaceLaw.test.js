import assert from 'node:assert/strict';
import {
  videoSourceOf, videoStateOf, videoPositionAt, videoDriftOf, videoApplyCmd,
  videoRevNewer, videoCapabilitiesOf, VIDEO_DRIFT_SOFT_S, VIDEO_DRIFT_HARD_S,
  VIDEO_DIRECT_HOSTS, VIDEO_PAINTING_TEMPLATE, videoIsPaintingItem,
} from '../../src/net/videoSurfaceLaw.js';

const base = {
  mapId: 1001, buildingKey: 1, pieceId: 'abc123def456',
  provider: 'direct', sourceId: 'https://upload.wikimedia.org/x.mp4',
  status: 'paused', basePositionSeconds: 10, serverStartedAt: null,
  updatedAt: 1_000, revision: 1,
};

assert.equal(videoSourceOf('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.sourceId, 'dQw4w9WgXcQ');
assert.equal(videoSourceOf('https://youtu.be/dQw4w9WgXcQ')?.provider, 'youtube');
assert.equal(videoSourceOf('https://www.youtube.com/shorts/dQw4w9WgXcQ')?.sourceId, 'dQw4w9WgXcQ');
assert.equal(videoSourceOf('javascript:alert(1)'), null);
assert.equal(videoSourceOf('http://evil.example/x.mp4'), null);
assert.equal(videoSourceOf('https://evil.example/x.mp4'), null);
assert.ok(VIDEO_DIRECT_HOSTS.includes('upload.wikimedia.org'));
assert.equal(
  videoSourceOf('https://upload.wikimedia.org/wikipedia/commons/a/a0/test.webm')?.provider,
  'direct',
);
assert.equal(videoSourceOf('https://upload.wikimedia.org/x.mp4#frag'), null);

assert.equal(videoCapabilitiesOf('youtube').presentation, 'domPanel');
assert.equal(videoCapabilitiesOf('direct').texture, true);
assert.equal(videoCapabilitiesOf('twitch'), null);

const st = videoStateOf(base);
assert.ok(st);
assert.equal(videoStateOf({ ...base, revision: 0 }), null);
assert.equal(videoStateOf({ ...base, status: 'playing', serverStartedAt: null }), null);

assert.equal(videoPositionAt({ ...st, status: 'paused' }, 5000), 10);
assert.equal(videoPositionAt({
  ...st, status: 'playing', serverStartedAt: 1000, basePositionSeconds: 5,
}, 3500), 7.5);

assert.equal(videoDriftOf(1, 1 + VIDEO_DRIFT_SOFT_S - 0.01), 'ok');
assert.equal(videoDriftOf(1, 1 + VIDEO_DRIFT_SOFT_S), 'soft');
assert.equal(videoDriftOf(1, 1 + VIDEO_DRIFT_HARD_S), 'hard');

assert.equal(videoApplyCmd(null, { op: 'source', url: 'bad' }).error, 'bad-source');
const sourced = videoApplyCmd(null, {
  op: 'source', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
}, 2000);
assert.equal(sourced.provider, 'youtube');
assert.equal(sourced.status, 'stopped');

const playing = videoApplyCmd(st, { op: 'play' }, 5000);
assert.equal(playing.status, 'playing');
assert.equal(playing.serverStartedAt, 5000);
const paused = videoApplyCmd({ ...st, ...playing }, { op: 'pause' }, 7000);
assert.equal(paused.status, 'paused');
assert.ok(paused.basePositionSeconds >= 10);

assert.ok(videoRevNewer(1, 2));
assert.ok(!videoRevNewer(2, 2));
assert.ok(videoIsPaintingItem({ t: VIDEO_PAINTING_TEMPLATE }));
assert.ok(!videoIsPaintingItem({ t: 1 }));

console.log('videoSurfaceLaw: ok');
