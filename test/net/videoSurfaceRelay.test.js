import assert from 'node:assert/strict';
import { parseClient } from '../../src/net/wire.js';
import { validVideoFrame } from '../../src/net/videoSurfaceWordLaw.js';
import { oweVideoWord, videoFan } from '../../server/src/videoSurfaceRoom.js';

const yard = parseClient(JSON.stringify({ t: 'yard', order: 'x'.repeat(20) }), { hasHello: true });
assert.equal(yard.t, 'yard');

const video = parseClient(JSON.stringify({ t: 'video', order: 'y'.repeat(20) }), { hasHello: true });
assert.equal(video.t, 'video');
assert.equal(parseClient(JSON.stringify({ t: 'video', order: 'y' }), { hasHello: false }).error, 'video before hello');
assert.equal(parseClient(JSON.stringify({ t: 'video', order: '' }), { hasHello: true }).error, 'bad video');

const sent = [];
const room = {
  _all: () => [[1, { id: 'a' }], [2, { id: 'b' }]],
  _send: (_ws, frame) => { sent.push(JSON.parse(frame)); },
};
oweVideoWord(room, [1001, 1, 'abc123def456', 2], 1000);
oweVideoWord(room, [1001, 1, 'abc123def456', 1], 1000); // older ignored
videoFan(room, 1000);
assert.equal(sent.length, 2); // one frame to each hub socket
assert.equal(sent[0].t, 'video');
assert.deepEqual(sent[0].l[0], [1001, 1, 'abc123def456', 2]);
assert.ok(validVideoFrame(sent[0]));
assert.deepEqual(sent[0], sent[1]);

console.log('videoSurfaceRelay: ok');
