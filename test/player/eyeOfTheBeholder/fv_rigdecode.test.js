// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT) - the weapon rig's body sprites are
// fetched and decoded by the shipped pack's decode workers (vanillaEnhancedPack.js decodeServedPng), not on the page's
// thread. Nothing is kept, so held here: a worn-armour picture composed from strips the worker decodes is the picture
// composed from this thread's fetch and decode, byte for byte, and a strip the worker cannot have leaves the cloak off
// as a refused fetch did; a served PNG is asked of a worker by the page's absolute URL (a worker resolves a relative one
// against its own script).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodeLayered } from '../../../src/player/eyeOfTheBeholder/layeredArmor.js';
import { decodeServedPng, _setVePackIoForTests } from '../../../src/systems/vanillaEnhanced/vanillaEnhancedPack.js';

const dir = (k) => fileURLToPath(new URL(`../../../vendor/layered-armor/${k}`, import.meta.url));

test('FIRST-VISIT rig decode: a worn-armour picture from worker-decoded strips is this thread\'s picture, byte for byte; a strip the worker cannot have leaves the cloak off (mutants: the strip, cloak or hood fix not asked of the picture door)', async (t) => {
  const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
  if (!PNG) { t.skip('pngjs not installed'); return; }
  const decode = async (bytes) => PNG.sync.read(Buffer.from(bytes));
  const opts = {
    fetchUrl: async (u) => ({ ok: true, arrayBuffer: async () => readFileSync(dir(u)) }),
    urlOf: (k) => `${k}.png`, cloakUrlOf: (k) => `cloak/${k}.png`, hoodFixUrlOf: (k) => `hoodfix/${k}.png`,
  };
  const asked = [];
  const picture = async (u) => { asked.push(u); return decode(readFileSync(dir(u))); };   // the worker: a URL in, its pixels out
  const key = 'LA:male:chain_chain_leather:2-3:ccl~5';
  const here = await decodeLayered(key, decode, opts);
  const worker = await decodeLayered(key, async () => { throw new Error('not this thread'); }, { ...opts, picture });
  assert.deepEqual(asked, ['male/chain_chain_leather/2-3.png', 'cloak/male/2-3.png', 'hoodfix/male/chain_chain_leather/2-3.png']);
  assert.equal(Buffer.compare(Buffer.from(worker.data), Buffer.from(here.data)), 0);
  const refused = await decodeLayered(key, decode, { ...opts, fetchUrl: async (u) => (u.startsWith('cloak/') ? { ok: false, status: 404 } : opts.fetchUrl(u)) });
  const noCloak = await decodeLayered(key, decode, { ...opts, picture: async (u) => { if (u.startsWith('cloak/')) throw new Error('404'); return picture(u); } });
  assert.equal(Buffer.compare(Buffer.from(noCloak.data), Buffer.from(refused.data)), 0);
});

test('FIRST-VISIT rig decode: a served PNG is asked of a decode worker by its absolute URL (mutant: the relative URL posted)', async () => {
  const posted = [];
  const factory = () => {
    const w = { postMessage(msg) { posted.push(msg); setTimeout(() => w.onmessage({ data: { id: msg.id, width: 1, height: 1, data: Uint8Array.of(1, 2, 3, 4) } }), 0); }, terminate() {} };
    return w;
  };
  _setVePackIoForTests({ worker: factory });
  try {
    const img = await decodeServedPng('art/eotb/0-0.png');
    assert.deepEqual([img.width, img.height, [...img.data]], [1, 1, [1, 2, 3, 4]]);
    assert.equal(posted.length, 1);
    assert.ok(/^[a-z]+:\/\//.test(posted[0].url) && posted[0].url.endsWith('/art/eotb/0-0.png'), posted[0].url);
    assert.equal(posted[0].maxSize, Infinity, 'whole - never fitted to a texture detail');
  } finally { _setVePackIoForTests(); }
});
