// AUDIT-STOREFRONT II, lane C (2026-10-29): a magic engine torn down before its idle warm-up ran. destroy() marked a
// pass broken only when one stood, so a warm still waiting saw a live engine and built the kill effects' pass - and the
// impact pass - on a dead one's context, a pass nothing would free. Both are marked broken first now.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPlayerMagic, liveCollider } from '../../src/scenes/hostMagic.js';
import { Collider } from '../../src/player/collider.js';

/** A WebGL2 context that answers enough to build a pass and counts every call made on it. */
function countingGl() {
  const gl = { calls: 0 };
  const answer = (/** @type {string} */ k) => (k === 'getExtension' ? null : k.startsWith('create') || k === 'getUniformLocation' ? {} : k === 'getProgramParameter' || k === 'getShaderParameter' ? true : k === 'isContextLost' ? false : k === 'getAttribLocation' ? 0 : undefined);
  return new Proxy(gl, {
    get: (o, k) => (k === 'calls' ? o.calls : typeof k !== 'string' || k === 'then' ? undefined : /^[A-Z0-9_]+$/.test(k) ? 1 : () => { o.calls++; return answer(k); }),
  });
}
const engine = (/** @type {any} */ gl) => {
  const sinks = { heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, hurt() {}, say() {} };
  return createPlayerMagic({
    renderer: { gl, createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => ({ width: 16, height: 16 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 }),
    uploadRecord: () => {}, uploadRecordFrame: () => {},
    collider: liveCollider(() => new Collider(() => 0)),
    playerEntity: { isPlayer: true, level: 10, health: 500, maxHealth: 500, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] },
    playerSinks: sinks, say() {}, surfacePlayer() {}, foes: () => [], foeSinks: () => sinks, absorbCtx: () => ({ inside: false, day: true }), rolls: () => 0.99,
  });
};

test('AUDIT-STOREFRONT II C2 a magic engine torn down before its idle warm-up ran: the warm stands down - no pass built and no call made on the dead engine\'s context; one left standing still warms both (mutants: the kill pass marked broken only when it stood; the impact pass the same)', async () => {
  const idle = /** @type {Function[]} */ ([]), ric = globalThis.requestIdleCallback;
  globalThis.requestIdleCallback = /** @type {any} */ ((/** @type {Function} */ fn) => idle.push(fn));
  const drain = async () => { for (let i = 0; i < 8; i++) { for (const f of idle.splice(0)) f(); await new Promise((r) => setImmediate(r)); } };
  try {
    const live = countingGl();
    engine(live);
    await drain();
    assert.ok(live.calls > 0, 'an engine left standing builds its passes at idle - the warm this pins');
    const gl = countingGl();
    const magic = engine(gl);
    assert.equal(idle.length, 2, 'the impact pass and the kill effects\' pass, each waiting on an idle');
    magic.destroy();
    const at = gl.calls;
    await drain();
    assert.equal(gl.calls, at, 'torn down first: the warm builds nothing on the dead context');
  } finally {
    if (ric === undefined) delete globalThis.requestIdleCallback; else globalThis.requestIdleCallback = ric;
  }
});
