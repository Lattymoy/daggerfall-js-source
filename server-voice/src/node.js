// @ts-check
/* global process, Buffer */
// Runs the same `handle` the Worker exports, over node:http, for the self-hosted compose stack.
//
//   node server-voice/src/node.js            env from the process; PORT default 7890
//
// VOICE_PARTY_STUB='{"acct":"partyId",...}' lets the podman proof answer party membership without a relay beside it.
// VOICE_PRESENCE_STUB='["acct",...]' admits proximity voice without a relay beside it - every listed account reads as present in every room it asks for; set RELAY_URL and VOICE_RELAY_SECRET instead once a relay exists.

import { createServer } from 'node:http';
import { handle } from './index.js';
import { VOICE_BODY_MAX_BYTES } from '../../src/voice/voiceWire.js';

export function startVoiceService({ port = Number(process.env.PORT ?? 7890), env = process.env, host = '127.0.0.1' } = {}) {
  const stub = env.VOICE_PARTY_STUB ? JSON.parse(String(env.VOICE_PARTY_STUB)) : null;
  const presenceStub = env.VOICE_PRESENCE_STUB ? new Set(JSON.parse(String(env.VOICE_PRESENCE_STUB))) : null;
  const e = { ...env, ...(stub ? { partyOf: (/** @type {string} */ acct) => stub[acct] ?? null } : {}), ...(presenceStub ? { presenceOf: (/** @type {string} */ acct) => presenceStub.has(acct) } : {}) };
  const tooLarge = (req, res) => { res.writeHead(413, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify({ ok: false, error: 'too-large' })); req.resume().destroy(); };
  const server = createServer(async (req, res) => {
    // a lying or absent Content-Length is still bounded below, but a stated oversize answers without reading a byte
    const stated = Number(req.headers['content-length']);
    if (Number.isFinite(stated) && stated > VOICE_BODY_MAX_BYTES) return tooLarge(req, res);
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > VOICE_BODY_MAX_BYTES) return tooLarge(req, res);
      chunks.push(c);
    }
    const body = Buffer.concat(chunks);
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, { method: req.method, headers: /** @type {any} */ (req.headers), body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body });
    let out;
    try { out = await handle(request, e); } catch (err) { console.error('[voice]', err); out = new Response(JSON.stringify({ ok: false, error: 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } }); }
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve({ server, port: /** @type {any} */ (server.address()).port, close: () => new Promise((r) => server.close(() => r(undefined))) })));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href.replace(/file:\/\/(?=[A-Za-z]:)/, 'file:///')) {
  startVoiceService({ host: process.env.HOST ?? '0.0.0.0' }).then(({ port }) => console.log(`[voice] listening on ${port}`));
}
