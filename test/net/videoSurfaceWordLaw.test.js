import assert from 'node:assert/strict';
import {
  validVideoWord, validVideoFrame, VIDEO_WELCOME_FIELD, VIDEO_WORDS_MAX,
} from '../../src/net/videoSurfaceWordLaw.js';
import { orderValid, ORDER_KINDS } from '../../src/net/identityToken.js';

assert.ok(ORDER_KINDS.includes('video'));
assert.equal(VIDEO_WELCOME_FIELD, 'vd');

assert.deepEqual(validVideoWord([1001, 1, 'abc123def456', 3]), [1001, 1, 'abc123def456', 3]);
assert.equal(validVideoWord([1001, 1, 'bad id!', 1]), null);
assert.equal(validVideoWord([1001, 1, 'abc123def456', 0]), null);

const frame = validVideoFrame({ t: 'video', l: [[1001, 1, 'abc123def456', 2]] });
assert.ok(frame);
assert.equal(validVideoFrame({ l: [] }), null);
assert.equal(validVideoFrame({ l: new Array(VIDEO_WORDS_MAX + 1).fill([1001, 1, 'abc123def456', 1]) }), null);

assert.ok(orderValid({
  o: 'video', s: 'a'.repeat(16), vm: 1001, vb: 1, vs: 'abc123def456', vr: 2, i: 1, e: 30,
}));
assert.ok(!orderValid({
  o: 'mute', s: 'a'.repeat(16), mu: 0, vm: 1, i: 1, e: 30,
}));

console.log('videoSurfaceWordLaw: ok');
