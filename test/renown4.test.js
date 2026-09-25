// RENOWN4 (2026-09-25, Mac: "Also why is there no way to view my renown ingame?" - "Plus XP bar"): MY OWN RENOWN ON
// MY OWN HUD. The row's law (ui/hudRenown.js renownHudView): the box, the bar only for a total that is the level's, the
// fill the service's credit, the ghost what is earned and not yet answered - never past the level's end - and the
// words. The service's mint answers the track's total beside the token (acct11) and the minter hands it on; a report's
// answer carries it through the one pure plan (renownAnswer); the page adopts it only upward, before the level, and
// hands the HUD a getter only online; the HUD draws the row under the vitals, as wide as them, written only on change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { ACCOUNT_VERSION } from '../server-account/src/service.js';
import { renownXpFor, RENOWN_XP_MAX } from '../src/net/renown.js';
import { renownAnswer } from '../src/net/renownTracker.js';
import { accountTokenMinter, SESSION_KEY } from '../src/net/accountClient.js';
import { renownHudView, setHudRenown, hudRenown } from '../src/ui/hudRenown.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _rows() { return stmt.all(...args); },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => ({ results: st._rows() })); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const T0 = 1_800_000_000;
async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  return async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

// ── THE ROW'S LAW ───────────────────────────────────────────────────

test('RENOWN4 the row: none without a level; the box alone while the total is unknown or is not that level\'s; the fill the credit into the level, the ghost what is earned and unanswered after it and never past the level\'s end; "into / need XP", "Highest" at the cap (mutants: the bar drawn from another level\'s total; the ghost unclamped; the ghost from a negative pending; the words the track\'s total; the cap\'s row with a need of 0 divided)', () => {
  assert.equal(renownHudView(null, 6000), null, 'offline, and online before a token says: no row');
  assert.equal(renownHudView(0, 0), null);
  assert.equal(renownHudView(51, 0), null, 'past the cap is no level');
  assert.equal(renownHudView(10.5, 6000), null);
  // the box alone
  assert.deepEqual(renownHudView(10, null), { level: 10, bar: false, frac: 0, ghost: 0, text: '' }, 'a service before acct11: the level, no total yet');
  assert.equal(renownHudView(10, renownXpFor(10) - 1).bar, false, 'a total a level behind is one the service has moved on from');
  assert.equal(renownHudView(10, renownXpFor(11)).bar, false, 'and one a level ahead is not this level\'s either');
  assert.equal(renownHudView(10, -5).bar, false);
  assert.equal(renownHudView(10, 6000.5).bar, false);
  // Renown 10 spans 5,510 to 7,660: 6,000 is 490 of its 2,150
  const v = renownHudView(10, 6000);
  assert.deepEqual([v.level, v.bar, v.text, v.ghost], [10, true, '490 / 2,150 XP', 0]);
  assert.ok(Math.abs(v.frac - 490 / 2150) < 1e-12);
  assert.ok(Math.abs(renownHudView(10, 6000, 1000).ghost - 1000 / 2150) < 1e-12, 'what is earned and unanswered, after the fill');
  assert.ok(Math.abs(renownHudView(10, 6000, 5000).ghost - (1 - 490 / 2150)) < 1e-12, 'never past the level\'s end');
  assert.equal(renownHudView(10, 6000, -40).ghost, 0, 'nothing earned is nothing drawn');
  assert.equal(renownHudView(10, 6000, Number.NaN).ghost, 0);
  assert.equal(renownHudView(10, renownXpFor(10)).text, '0 / 2,150 XP', 'the level\'s first unit');
  assert.equal(renownHudView(1, 0, 40).text, '0 / 100 XP');
  assert.ok(Math.abs(renownHudView(1, 0, 40).ghost - 0.4) < 1e-12);
  // the cap
  assert.deepEqual(renownHudView(50, RENOWN_XP_MAX, 900), { level: 50, bar: true, frac: 1, ghost: 0, text: 'Highest' });
  assert.equal(renownHudView(49, renownXpFor(50) - 1).text, '175,749 / 175,750 XP', 'a level short of the cap still counts');
});

test('RENOWN4 the source: the page\'s getter read each frame - none set, none drawn; a getter answering null (offline) is no row; one that throws costs its row and never the frame (mutants: a throw carried into the frame; the pending unread)', () => {
  setHudRenown(null);
  assert.equal(hudRenown(), null);
  setHudRenown(() => null);
  assert.equal(hudRenown(), null);
  setHudRenown(() => ({ level: 10, xp: 6000, pending: 1000 }));
  assert.ok(Math.abs(hudRenown().ghost - 1000 / 2150) < 1e-12);
  setHudRenown(() => ({ level: 10, xp: 6000 }));
  assert.equal(hudRenown().ghost, 0, 'no pending, no ghost');
  setHudRenown(() => { throw new Error('boom'); });
  assert.equal(hudRenown(), null);
  setHudRenown('not a function');
  assert.equal(hudRenown(), null);
  setHudRenown(null);
});

// ── WHERE THE TOTAL COMES FROM ──────────────────────────────────────

test('RENOWN4 the service: the mint answers the named character\'s track total beside its level - 0 before it earns, the total after - and none for a mint naming no character; the token itself carries no total; acct11 (mutants: the total dropped; a total for no character; a new character\'s total not 0)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const call = await stand();
  const me = (await call('POST', '/v1/auth/guest', {})).body;
  let tok = (await call('POST', '/v1/auth/token', { character: 'char-aaaa' }, me.secret)).body;
  assert.deepEqual([tok.level, tok.xp], [1, 0], 'a character that earned nothing: Renown 1, no XP');
  assert.equal((await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 5000 }, me.secret)).status, 200);
  assert.equal((await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 1000 }, me.secret)).status, 200);
  tok = (await call('POST', '/v1/auth/token', { character: 'char-aaaa' }, me.secret)).body;
  assert.deepEqual([tok.level, tok.xp], [10, 6000]);
  const claims = JSON.parse(Buffer.from(tok.token.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(claims.lv, 10);
  assert.equal('xp' in claims, false, 'a room needs the level, never the total');
  tok = (await call('POST', '/v1/auth/token', {}, me.secret)).body;
  assert.deepEqual([tok.level, tok.xp], [null, null], 'an older build\'s mint names no character, and has neither');
  tok = (await call('POST', '/v1/auth/token', { character: 'char-bbbb' }, me.secret)).body;
  assert.deepEqual([tok.level, tok.xp], [1, 0], 'another character is its own track');
  assert.equal(ACCOUNT_VERSION, 'acct11');
  assert.match(src('server-account/wrangler.toml'), /ACCOUNT_VERSION = "acct11"/);
});

test('RENOWN4 the client: the minter hands the total on beside the level - null for none, a fraction or a negative; a report\'s answer carries it through renownAnswer (mutants: the total dropped by the minter; a bad total taken; the answer\'s total dropped)', async () => {
  let answer = { token: 'v1.t.s', name: 'Mac', kind: 'guest', title: null, glyphs: [], level: 10, xp: 6000 };
  const fetch = async () => ({ ok: true, status: 200, json: async () => answer });
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'p_me', name: 'Mac', kind: 'guest', sessionId: 's1', secret: 'SECRETSECRETSECRETSECRET' })]]);
  const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  const issued = [];
  const mint = accountTokenMinter({ fetch, storage, onIssued: (w) => issued.push(w), character: () => 'char-aaaa' });
  assert.equal(await mint(), 'v1.t.s');
  assert.deepEqual([issued[0].level, issued[0].xp], [10, 6000]);
  for (const xp of [undefined, null, -1, 1.5, '6000']) {
    answer = { ...answer, xp };
    await mint();
    assert.equal(issued.at(-1).xp, null, `a total of ${String(xp)} is none`);
  }
  answer = { ...answer, xp: 0 };
  await mint();
  assert.equal(issued.at(-1).xp, 0, 'a character that earned nothing has a total: 0');
  assert.equal(renownAnswer({ level: 10, xp: 6000, credited: 100 }, 100, 10).xp, 6000);
  assert.equal(renownAnswer({ level: 10, credited: 100 }, 100, 10).xp, null);
  assert.equal(renownAnswer({ level: 10, xp: '6000', credited: 100 }, 100, 10).xp, null);
  assert.equal(renownAnswer({ level: 10, xp: -1, credited: 100 }, 100, 10).xp, null);
});

test('RENOWN4 the page: the total adopted from the mint (before the level, so no frame draws the new level over the old total) and from every report\'s answer, only ever upward and only online; the HUD\'s getter built only with the tracker (online), its pending none in an hour the bound has spent (mutants: a lower total taken; the answer\'s total unread; the mint\'s unread; the getter offline; the ghost in a spent hour)', () => {
  const W = src('src/scenes/world.js');
  assert.match(W, /import \{ setHudRenown \} from '\.\.\/ui\/hudRenown\.js';/);
  assert.match(W, /const renownXpAdopt = \(xp\) => \{\n\s*if \(onlineOn && Number\.isSafeInteger\(xp\) && xp >= 0 && \(renownXp === null \|\| xp > renownXp\)\) renownXp = xp;\n\s*\};/);
  assert.match(W, /renownXpAdopt\(who\?\.xp\);[^\n]*\n\s*who = \{ \.\.\.who, level: renownAdopt\(who\?\.level\) \};/, 'the total first, then the level');
  assert.match(W, /const a = renownAnswer\(data, sent, renownSaid\);[^\n]*\n\s*renownXpAdopt\(a\.xp\);[^\n]*\n\s*renownAdopt\(a\.level\);/);
  const online = W.slice(W.indexOf('  if (renownTracker) {'));
  assert.match(online, /^ {2}if \(renownTracker\) \{\n(?:\s*\/\/[^\n]*\n)*\s*setHudRenown\(\(\) => \(\{ level: renownNow, xp: renownXp, pending: _renownCapHour === Math\.floor\(Date\.now\(\) \/ 3_600_000\) \? 0 : renownTracker\.pending\(\) \}\)\);/);
  assert.equal((W.match(/setHudRenown\(/g) ?? []).length, 1, 'one getter, built in one place');
});

// ── THE HUD ─────────────────────────────────────────────────────────

const mkEl = () => ({
  className: '', textContent: '', id: '', rel: '', href: '', src: '', alt: '', children: [], dataset: {},
  style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
  classList: {
    _s: new Set(),
    add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); },
    toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); },
  },
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); },
  getAttribute(k) { return this.attrs[k]; },
  removeAttribute(a) { delete this.attrs[a]; this[a] = ''; }, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
  replaceChildren(...c) { this.children = c; }, addEventListener(type, fn) { (this._on ??= {})[type] = fn; },
});
const find = (node, cls) => {
  if (String(node.className ?? '').split(/\s+/).includes(cls)) return node;
  for (const c of node.children ?? []) { const got = find(c, cls); if (got) return got; }
  return null;
};

test('RENOWN4 the HUD, executed: the row hangs under the vitals and is off until the page has a Renown; the box, then the bar - the fill, the ghost from the fill\'s end, the words - and the box alone while the total is unknown; a getter taken away takes the row (mutants: the row never lit; the ghost from the bar\'s start; the box\'s number stale; nobar never set)', async () => {
  const prev = globalThis.document;
  globalThis.document = {
    createElement: mkEl, createElementNS: (ns) => Object.assign(mkEl(), { ns }),
    getElementById: () => null, head: mkEl(), body: mkEl(),
  };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../src/ui/enhancedHud.js');
  const { clearQuickslots } = await import('../src/systems/quickslots.js');
  clearQuickslots();
  const entity = { health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null };
  try {
    setHudRenown(null);
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    const root = document.body.children.find((n) => n.className === 'hud');
    const bottom = find(root, 'hud-bottom');
    const row = find(root, 'hud-renown');
    assert.deepEqual(bottom.children.map((n) => n.className), ['hud-hotdock', 'hud-breath', 'hud-bars', 'hud-renown', 'hud-effects', 'hud-needs'], 'right under the vitals');
    assert.equal(row.classList.contains('on'), false, 'offline: no row');
    let s = { level: 10, xp: 6000, pending: 1000 };
    setHudRenown(() => s);
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    assert.equal(row.classList.contains('on'), true);
    assert.equal(row.classList.contains('nobar'), false);
    assert.equal(find(row, 'hud-renownbox').textContent, '10');
    assert.equal(find(row, 'hud-fill').style.width, '22.8%');
    assert.equal(find(row, 'hud-renownghost').style.left, '22.8%', 'the ghost starts where the credit ends');
    assert.equal(find(row, 'hud-renownghost').style.width, '46.5%');
    assert.equal(find(row, 'hud-renownnum').textContent, '490 / 2,150 XP');
    // the report lands: the ghost turns solid, and the level rises
    s = { level: 11, xp: 7700, pending: 0 };
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    assert.equal(find(row, 'hud-renownbox').textContent, '11');
    assert.equal(find(row, 'hud-renownghost').style.width, '0.0%');
    assert.equal(find(row, 'hud-renownnum').textContent, '40 / 2,750 XP');
    // a level without a total: the box alone
    s = { level: 12, xp: 7700 };
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    assert.equal(row.classList.contains('nobar'), true);
    assert.equal(find(row, 'hud-renownbox').textContent, '12');
    s = { level: 12, xp: renownXpFor(12) };
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    assert.equal(row.classList.contains('nobar'), false, 'and the bar again once the total is the level\'s');
    setHudRenown(null);
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    assert.equal(row.classList.contains('on'), false);
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    setHudRenown(null);
    globalThis.document = prev;
  }
});

test('RENOWN4 the sheet: the row is off until lit, as wide as the vitals\' row on a desk and on a phone; the box is the name\'s gold in the HUD\'s square frame; the ghost is the fill\'s gold, faint; nobar takes the bar and the words and leaves the box (mutants: the row always drawn; the widths drifted from the vitals\')', () => {
  const CSS = src('src/ui/enhancedStyle.js');
  assert.match(CSS, /\.hud-renown \{ display: none; align-items: center; gap: 8px; width: calc\(3 \* min\(190px, 23vw\) \+ 28px\); \}\n\.hud-renown\.on \{ display: flex; \}/);
  assert.match(CSS, /\.hud-vital \.hud-track \{ width: min\(190px, 23vw\); height: 20px;/, 'the vitals the row is as wide as');
  assert.match(CSS, /\.hud-bars \{ display: flex; align-items: center; gap: 14px; \}/);
  assert.match(CSS, /\.hud-vital \.hud-track \{ width: 26vw; \}\n\s*\.hud-renown \{ width: calc\(78vw \+ 20px\); \}/, 'the phone\'s three 26vw tracks and two 10px gaps');
  assert.match(CSS, /\.hud-bars \{ gap: 10px; \}/);
  assert.match(CSS, /\.hud-renownbox \{[^}]*color: #f2c46b;[^}]*border: 2px solid rgba\(242,196,107,0\.8\); \}/);
  assert.match(CSS, /\.hud-renown \.hud-fill \{[^}]*background: #f2c46b; \}/);
  assert.match(CSS, /\.hud-renownghost \{ position: absolute;[^}]*background: rgba\(242,196,107,0\.35\); \}/);
  assert.match(CSS, /\.hud-renown\.nobar \.hud-renowntrack, \.hud-renown\.nobar \.hud-renownnum \{ display: none; \}/);
});
