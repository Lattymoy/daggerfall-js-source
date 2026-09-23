// SEAT-HEAL (2026-09-22): a joiner whose host went quiet for FOES_STALE_MS took the dungeon's foes for itself and could
// never give them back - `applyFoes` refused every frame while it was the authority, and the heartbeat that ends the
// authority is stamped only when a frame is APPLIED. The joiner then played a private dungeon (a rat the host had
// killed stood alive; its own blows never reached the host).
//
// Mounted, not matched: the statements below are the ones in src/ - world.js' `dungeonAuthority`, `onHost` and
// `onFoes`, worldModes.js' two doors, and dungeonContext.js' `applyFoeRecord` / `setAuthority` / `applyFoes` (+ its
// frame body), sliced out of the source text and run against a fake clock and a fake session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { validFoeRecord } from '../src/net/wire.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const D = rd('src/scenes/dungeonContext.js');
const M = rd('src/scenes/worldModes.js');
const W = rd('src/scenes/world.js');

const fnSrc = (src, name) => {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (n.type === 'FunctionDeclaration' && n.id?.name === name) { hit = src.slice(n.start, n.end); return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(ast);
  assert.ok(hit, `src has function ${name}`);
  return hit;
};
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mustMatch = (src, re, what) => { const m = src.match(re); assert.ok(m, `src has ${what}`); return m[0]; };

/** One joiner: the real seat code, a fake clock, a fake session that names host 'H'. */
function joiner() {
  const mk = () => ({ mobileType: 0, dead: false, entity: { health: 5, items: [] }, ai: { feet: [0, 0, 0], yaw: 0, moving: false, isHostile: true }, src: {} });
  const foes = [mk(), mk()];   // index 0 is the rat
  const hooks = { retype: async () => false };
  const ctxBody = `
    let _authority = true, _foesSeqIn = -1, _foesFrom = null, _keyMismatchSaid = false;
    const _layoutFoes = foes.length, _locationKey = 'dungeon:7';
    const _retypeFails = new Map(), _retyping = new Set(), RETYPE_TRIES = 3, GENDER_BIT = ['male', 'female'];
    const setFoeDead = (f, d) => { f.dead = !!d; };
    ${fnSrc(D, 'applyFoeRecord')}
    ${fnSrc(D, 'setAuthority')}
    ${/function applyFoesFrame\(/.test(D) ? fnSrc(D, 'applyFoesFrame') : ''}
    ${fnSrc(D, 'applyFoes')}
    return { setAuthority, applyFoes, isAuthority: () => _authority };
  `;
  // CORPSE-FOOD (2026-09-23): the stream's first word of a death rolls this joiner's copy of the body its food - stood
  // down here, where the seat is the subject (survtiers3.test.js mounts that arm)
  const ctx = new Function('__s', `with (__s) { ${ctxBody} }`)(scoped({ foes, validFoeRecord, retypeFoe: (...a) => hooks.retype(...a), console, addCorpseFood: () => 0, liveStat: () => 50, playerEntity: null }));

  const applyDungeonFoesLine = mustMatch(M, /applyDungeonFoes\(id, data[^)]*\) \{[^\n]*\},/, 'worldModes.applyDungeonFoes');
  const setDungeonAuthorityLine = mustMatch(M, /setDungeonAuthority\(on\) \{[^\n]*\},/, 'worldModes.setDungeonAuthority');
  const mstate = { mode: 'dungeon', dungeonCtx: ctx, _dungeonAuthority: true };
  const modes = new Function('__s', `with (__s) { return ({ ${applyDungeonFoesLine} ${setDungeonAuthorityLine} }); }`)(scoped(mstate));
  Object.defineProperty(modes, 'mode', { get: () => mstate.mode });

  const dungeonAuthorityLine = mustMatch(W, /const dungeonAuthority = \(now = performance\.now\(\)\) => [^\n]*;/, 'world.dungeonAuthority');
  const onHostLine = mustMatch(W, /online\.onHost = \(id, mine\) => \{[^\n]*\};/, 'world onHost');
  const s0 = W.indexOf('online.onFoes = (id, data) => {');
  assert.ok(s0 > 0, 'world onFoes');
  const onFoesSrc = W.slice(s0, W.indexOf('\n    };', s0) + 7);

  const t = { now: 0 };
  const online = { room: 'dungeon:m7', status: 'open', host: 'H', id: 'J', isHost() { return this.host === this.id; }, onHost: null, onFoes: null };
  const ws = { online, modes, performance: { now: () => t.now }, _foesInAt: -Infinity, _foesFullAt: -Infinity, _worldPublishedAt: 0, FOES_STALE_MS: 6000, exteriorFoes: { applyFoes() {} }, isWorldRoom: (k) => /^(dungeon|interior):/.test(k), isCellRoom: () => false };
  new Function('__s', `with (__s) { ${dungeonAuthorityLine}\n ${onHostLine}\n ${onFoesSrc}\n __s.dungeonAuthority = dungeonAuthority; }`)(scoped(ws));

  let n = 0;
  const rat = (dead) => ({ i: 0, t: 0, f: [1, 0, 1], y: 0, h: dead ? 0 : 5, d: dead ? 1 : 0, a: 0, m: 0, g: '', c: 0, s: 0 });
  return {
    foes, ctx, online, t, hooks,
    frame(recs, k = 'dungeon:7') { online.onFoes('H', { n: ++n, k, f: recs }); },
    rat,
    render() { modes.setDungeonAuthority(ws.dungeonAuthority(t.now)); },
    /** advance the clock; a frame goes every 200 ms while the host is streaming */
    run(ms, { stream = null } = {}) {
      const end = t.now + ms;
      for (; t.now < end; t.now += 16) { if (stream && t.now % 192 < 16) this.frame([stream]); this.render(); }
    },
    join() { online.onHost('H', false); this.render(); },
  };
}

test('SEAT-HEAL: a host silent past FOES_STALE_MS hands the joiner the foes - and the next host frame takes them back', () => {
  const j = joiner();
  j.join();
  assert.equal(j.ctx.isAuthority(), false, 'the welcome names another host: the joiner is a puppet');
  j.run(1000, { stream: j.rat(false) });
  assert.equal(j.ctx.isAuthority(), false);
  assert.equal(j.foes[0].dead, false);

  j.run(8000);   // the host's tab is in the background: no frames, the socket stays open
  assert.equal(j.ctx.isAuthority(), true, 'a silent seat is handed back to the joiner (WORLD2 C2 - unchanged)');

  j.run(1000, { stream: j.rat(true) });   // the host is back, and its rat is dead
  assert.equal(j.ctx.isAuthority(), false, 'THE LATCH: the host streams again and the joiner follows it - it used to stay authority for ever');
  assert.equal(j.foes[0].dead, true, 'the rat the host killed is dead here too');

  j.run(8000, { stream: j.rat(true) });   // and it stays a puppet while the stream holds
  assert.equal(j.ctx.isAuthority(), false, 'the heartbeat is alive again');
});

test('SEAT-HEAL: the yield has bounds - no name, another dungeon\'s frame, a frame that throws: none of them takes the foes', () => {
  const j = joiner();
  j.join();
  j.run(8000);
  assert.equal(j.ctx.isAuthority(), true);

  assert.equal(j.ctx.applyFoes({ n: 1, k: 'dungeon:7', f: [j.rat(true)] }, null), false, 'an anonymous frame is no seat-holder\'s word');
  assert.equal(j.ctx.applyFoes({ n: 2, k: 'dungeon:7', f: [j.rat(true)] }, ''), false);
  assert.equal(j.ctx.isAuthority(), true);
  assert.equal(j.ctx.applyFoes({ n: 3, k: 'dungeon:99', f: [j.rat(true)] }, 'H'), false, 'another dungeon\'s stream is refused (C8) and the seat is not yielded for it');
  assert.equal(j.ctx.isAuthority(), true);
  assert.equal(j.foes[0].dead, false);

  j.hooks.retype = () => { throw new Error('boom'); };   // a species mismatch whose rebuild throws inside the frame
  assert.throws(() => j.ctx.applyFoes({ n: 4, k: 'dungeon:7', f: [{ ...j.rat(true), t: 5 }] }, 'H'), /boom/);
  assert.equal(j.ctx.isAuthority(), true, 'a stream that throws on this client cannot pose as a heartbeat (AUDIT ONCRASH1 A4): the seat is given back');
});

test('SEAT-HEAL: a puppet still refuses nothing new - a frame while the host is heard is applied as before, and the authority path is only entered from authority', () => {
  const j = joiner();
  j.join();
  j.frame([j.rat(true)]);
  assert.equal(j.foes[0].dead, true);
  assert.equal(j.ctx.isAuthority(), false);
  assert.equal(j.ctx.applyFoes(null, 'H'), false);
  assert.equal(j.ctx.applyFoes({ n: 1 }, 'H'), false, 'a frame with no list is nothing');
});
