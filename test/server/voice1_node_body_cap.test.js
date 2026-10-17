// the self-hosted HTTP server must cap a request body BEFORE buffering it whole - proven by
// actually starting the real server and sending real oversized bodies over a real socket, not a mocked handle().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startVoiceService } from '../../server-voice/src/node.js';
import { VOICE_BODY_MAX_BYTES } from '../../src/voice/voiceWire.js';

test('voice node door: a body over VOICE_BODY_MAX_BYTES is refused with 413 - with Content-Length stated, and without it', async () => {
  const { port, close } = await startVoiceService({ port: 0, env: {} });
  try {
    const base = `http://127.0.0.1:${port}`;
    const big = 'x'.repeat(VOICE_BODY_MAX_BYTES + 1);

    // the common case: a lying/honest Content-Length header states the oversize up front
    const withLength = await fetch(`${base}/v1/voice/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: big });
    assert.equal(withLength.status, 413);
    assert.equal((await withLength.json()).error, 'too-large');

    // no Content-Length at all (chunked transfer-encoding, e.g. a streaming client): the running-size check during
    // read must still catch it - this is the path a Content-Length check ALONE would miss
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(big)); controller.close(); } });
    const chunked = await fetch(`${base}/v1/voice/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half' });
    assert.equal(chunked.status, 413);
    assert.equal((await chunked.json()).error, 'too-large');

    // a body right at the limit, well-formed otherwise, is a normal 400 (bad shape) - the cap must not bite a real request
    const atLimit = 'x'.repeat(VOICE_BODY_MAX_BYTES - 50);
    const normal = await fetch(`${base}/v1/voice/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: atLimit, room: 'cell:1', channel: 'proximity' }) });
    assert.notEqual(normal.status, 413, 'a body within the cap must reach ordinary shape validation, not the size gate');
  } finally {
    await close();
  }
});
