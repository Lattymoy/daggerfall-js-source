// RENOWN4 (2026-09-25, Mac: "Also why is there no way to view my renown ingame?" - "Plus XP bar"): MY OWN RENOWN ON
// MY OWN HUD. The row's law (ui/hudRenown.js renownHudView): the box, the bar only for a total that is the level's, the
// fill the service's credit, the ghost what is earned and not yet answered - never past the level's end - and the
// words. The service's mint answers the track's total beside the token (acct13 - acct11, then acct12, on its branch; main's WB5b took acct11 first and BASE-HIDE acct12) and the minter hands it on; a report's
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
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

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

test('RENOWN4 the row: none without a level; the box alone while the total is unknown or is not that level\'s; the fill the credit into the level, the ghost what is earned and unanswered after it and never past the level\'s end; the cap a full bar; UI3 the words in the bar - the credit into the level over the level\'s span, "Highest" at the cap, none without a bar (mutants: the bar drawn from another level\'s total; the ghost unclamped; the ghost from a negative pending; the words the track\'s total; the words with the pending in them; the cap\'s row with a need of 0 divided)', () => {
  assert.equal(renownHudView(null, 6000), null, 'offline, and online before a token says: no row');
  assert.equal(renownHudView(0, 0), null);
  assert.equal(renownHudView(51, 0), null, 'past the cap is no level');
  assert.equal(renownHudView(10.5, 6000), null);
  // the box alone
  assert.deepEqual(renownHudView(10, null), { level: 10, bar: false, frac: 0, ghost: 0, text: '' }, 'a service before acct13: the level, no total yet');
  assert.equal(renownHudView(10, renownXpFor(10) - 1).bar, false, 'a total a level behind is one the service has moved on from');
  assert.equal(renownHudView(10, renownXpFor(11)).bar, false, 'and one a level ahead is not this level\'s either');
  assert.equal(renownHudView(10, -5).bar, false);
  assert.equal(renownHudView(10, 6000.5).bar, false);
  // Renown 10 spans 5,510 to 7,660: 6,000 is 490 of its 2,150
  const v = renownHudView(10, 6000);
  assert.deepEqual([v.level, v.bar, v.ghost], [10, true, 0]);
  assert.deepEqual(Object.keys(v).sort(), ['bar', 'frac', 'ghost', 'level', 'text']);
  assert.equal(v.text, '490 / 2,150 XP', 'UI3: the words in the bar - the level\'s credit over its span, never the track\'s total');
  assert.equal(renownHudView(10, 6000, 1000).text, '490 / 2,150 XP', 'the credit alone: what is not yet answered is the ghost\'s to say');
  assert.equal(renownHudView(20, renownXpFor(20) + 5420).text, `5,420 / ${(renownXpFor(21) - renownXpFor(20)).toLocaleString('en-US')} XP`, 'thousands marked');
  assert.ok(Math.abs(v.frac - 490 / 2150) < 1e-12);
  assert.ok(Math.abs(renownHudView(10, 6000, 1000).ghost - 1000 / 2150) < 1e-12, 'what is earned and unanswered, after the fill');
  assert.ok(Math.abs(renownHudView(10, 6000, 5000).ghost - (1 - 490 / 2150)) < 1e-12, 'never past the level\'s end');
  assert.equal(renownHudView(10, 6000, -40).ghost, 0, 'nothing earned is nothing drawn');
  assert.equal(renownHudView(10, 6000, Number.NaN).ghost, 0);
  assert.equal(renownHudView(10, renownXpFor(10)).frac, 0, 'the level\'s first unit');
  assert.equal(renownHudView(1, 0, 40).frac, 0);
  assert.ok(Math.abs(renownHudView(1, 0, 40).ghost - 0.4) < 1e-12);
  // the cap
  assert.deepEqual(renownHudView(50, RENOWN_XP_MAX, 900), { level: 50, bar: true, frac: 1, ghost: 0, text: 'Highest' });
  assert.deepEqual(renownHudView(50, RENOWN_XP_MAX), { level: 50, bar: true, frac: 1, ghost: 0, text: 'Highest' }, 'the cap divides nothing: with nothing pending the ghost is 0, never 0 / 0');
  const short = renownHudView(49, renownXpFor(50) - 1);
  assert.ok(short.bar && Math.abs(short.frac - 175749 / 175750) < 1e-12, 'a level short of the cap still counts');
  assert.equal(short.text, '175,749 / 175,750 XP', 'and says so - the longest words the bar ever holds');
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

test('RENOWN4 the service: the mint answers the named character\'s track total beside its level (RENOWN-CHAR: the character\'s again, where RENOWN-ACCOUNT made it the account\'s) - 0 before it earns, the total after - and none for a mint naming no character; the token itself carries no total; acct13 (mutants: the total dropped; a total for no character; a new character\'s total not 0)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const call = await stand();
  const me = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
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
  assert.deepEqual([tok.level, tok.xp], [1, 0], 'another character is its own track (RENOWN-CHAR - RENOWN-ACCOUNT stood it at the account\'s)');
  assert.equal(ACCOUNT_VERSION, 'acct82');   // AUDIT ARENA-LADDER moved it on last (acct82: /v1/arena/attempt and migration 0082, the ladder attempt ticket - acct79 on its branch, renumbered past GLOBAL-MARKET, SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (acct81: DEVELOPER_HANDLES grants the Seraph Wings - DEVELOPER_AURA); SHADOW-CLOAK moved it on (acct80: SHADOW_FANG_HANDLES grants the Holo Shadow Cloak with the title - acct78 on its branch, renumbered past SERPENT1 and GLOBAL-MARKET at the merges); GLOBAL-MARKET moved it on (acct79: buy orders the Bay's - the Orders view reads every board's, and a fill from another region pays its courier out of its pay; no migration); SERPENT1 moved it on (acct78: /v1/serpent/claim and the serpents slain on the cards, migration 0081 - acct75, acct76 then acct77 on its branch, renumbered past HOME-PRICE (acct75), PRIMARCH and FOUNDER4 (acct76) and KNIGHT-HOUSE (acct77) at the merges); FIELD BUGS 2026-10-04d KNIGHT-HOUSE moved it on (acct77: a deed the realm gave, held off the record - /v1/homes/deed and the release of a hold, migration 0079); PRIMARCH and FOUNDER4 moved it on (acct76: PRIMARCH_HANDLES grants the Primarch's title, glyph and aura; migration 0078 links an account to a row it shares a character with, for Founder - acct75 on its branch, which HOME-PRICE took first); HOME-PRICE moved it on (acct75: a home's price held to the online range, the town's sale refund; before it, BAG1 and GUILD2's acct74: the Materials Bag carried count and /v1/stores/deposit, migration 0076; a guild new name and its vault, /v1/guilds/rename and /v1/guilds/vault*, migration 0077); AEGIS moved it on (acct73: AEGIS_HANDLES grants the Aegis of Oblivion's title, glyph and aura); ARENA4, ARENA4b and WD3 moved it on (acct72 - acct66 on the arena branch, renumbered past PROF-541's acct70 and SILVER-WAYS' acct71 at its merges onto main: the arena records and the online homes it displaced - migrations 0074 and 0075 - and the layout a home was bought in - 0073); SILVER-WAYS and PROF2b before it (acct71: a raid's silver under the day's combat cap, guild deeds and guild contracts, the Motherlodes - migrations 0071 and 0072 - acct66 on its branch, renumbered past PROF-541's acct66-acct70 at the merge); AUDIT PROF-541 before it (acct70: the Alchemy audit's fixes, the hall door set by rank alone - hallEntry; a jewel's first craft its piece and base's; no migration); PROF12 before it (acct69: Alchemy's brew, the Apothecaries' counter, a Transmuter's transmutations, Disenchanting, the Apothecary opened; migration 0070); PROF10 before it (acct68: the jeweller's bench's pieces and the jeweller's hand, a Lapidary's cracked gem; no migration); PROF9 before it (acct67: the fire's dishes and a dish's cook's hand, migration 0069; acct67 past another branch's acct66); GUILD-YARD before it (acct65: a guild hall's outside and yard, its keepers'; no migration); AUDIT 529 before it (acct64: SIEGE-VOID's route and migration 0067, STANDING-TREND's standing rows, the void's audit); GLYPH-WEAR before it (acct63: a player shows or hides each glyph, migration 0068); WB12d moved it on (acct62: a receipt's rite and the rite's own receipt, the rows' embers - migration 0066 - main's part four and the Seats arc took acct46-acct61 first); before it SEAT2b part two moved it on (acct61: the works at peace); AUDIT-SEATS, PROF11 and SEAT2b before it (acct60: the audit, Masonry and the works - the Seats arc's fourteen renumbered past main's PATREON-LINK and part four (acct45, acct46) at the merge); SEASON1 part three before it (acct59: the Hall of Records); SEASON1 part two, the banner ribbon before it (acct58: the banner ribbon); SEASON1 part two, the client's before it (acct57: the Orc Raids and the stormy sea); SEASON1 part two, the economy before it (acct56: the economy's Tides); SEASON1 part two before it (acct55: the Tides); SEASON1 part one before it (acct54: the Seasons); CROWN2 before it (acct53: fealty and Pacts); CROWN1 part two before it (acct52: the Royal Tourney); CROWN1 before it (acct51: the crown Edicts); SEAT2a part three before it (acct50: the siege's pass and result); SEAT2a before it (acct49: the battles' week - the holder's window, the schedule, the sides and their Sellswords; migration 0052); SEAT1d before it (acct48: holding a seat - the upkeep, the Tithe, the Edicts; migration 0051); GUILD1d, GUILD1e and SEAT1a before it (acct47: the guild hall, its heraldry, the guild's own board and the seats' registry - migrations 0046, 0047 and 0048; acct42, then acct43, then acct44, then acct45, on their branch, renumbered past main's REALM-GZIP, SCALE1, MARKET-ANY and PATREON-LINK at the merges); FIELD BUGS 2026-10-01 part four before it (acct46: ANY-HOUR and HERB-XP - no hour refused, a herb at the rank's tier; acct45 on its branch, past PATREON-LINK at the merge); PATREON-LINK before it (acct45: a patron's own Patreon linked, its tier's title held by the pledge - migration 0045); MARKET-ANY before it (acct44: FIELD BUGS 2026-10-01 - a piece from the pack listed for gold, migration 0044); SCALE1 before it (acct43: the scaling audit's service half - metrics, indexes, fewer writes); REALM-GZIP before it (acct42: a realm save rides gzipped); PROF8 before it (acct41: Fishing with the net - migration 0042); GOLD-MARKET before it (acct40: the market in gold or Drakes - migration 0041); PINE-SHARE before it (acct39: Pine in every forest); WB9g before it (acct38: the Broker's insignia - a title and an aura bought, recorded on the row (0040) and paid for by the account's closed gates; the aura worn and signed (`au`)); HOUSING before it (acct37: HOME-RENT's rooms, HOME-LOOK's outside, HOME-YARD's yards - migrations 0037-0039); the PROF7 merge before it (acct36: past main's FIELD BUGS 2026-09-30, acct33, and the branch's acct33-acct35 never deployed); AUDIT 32 S1 before it (acct35: the Weavers' cloth alone lays on no first-craft XP); AUDIT 32 before it (acct34); PROF7 before it (acct33: Hunting, the Skinning Knife and Outfitting); PROF-DELETE before it (acct32: a deleted character's professions go with it); before it RENOWN-CHAR moved it on (acct31: Renown a character's again, migration 0035); before it MERGE 2 moved it on (acct30: the professions branch - Marks, the Notice Board, the professions, the market and its auctions, the guild writs - acct22 to acct29 on its branch, never deployed, its migrations 0025-0034 behind main's 0018-0024); before it HOUSE-LOSS and RESTORE moved it on (acct23 - acct20, then acct21 and acct22, on their branch, which TERMS1, PENITENT and REALM-DOOR took first); before it REALM-DOOR and CUSTOMS-PASS moved it on (acct22: the mint signs whether the named character is the realm's, and a developer's customs pass); before it PENITENT's title and glyph and a fifth Disciple (acct21); before it TERMS1's agreement moved it on (acct20 - acct17, then acct19, on its branch, never deployed, renumbered past RAID4, AUDIT RAID and THE MERGE's REALM at the merges); before it THE MERGE moved it on (acct19: REALM P1-P2.2b and AUDIT REALM - acct17 on its branch, never deployed, renumbered past RAID4 (acct17) and AUDIT RAID (acct18); its migrations 0016-0018 are 0018-0020); AUDIT RAID before it (acct18: a town's thanks once a raid and account, a raid's Renown the hour's); before it RAID4 (acct17: the towns defended - a raid's receipt counted and paid in Renown); before it HOME-STATIONS (acct16 - acct15 on its branch, renumbered past FOUNDER3 at the merge: a decor place's station); FOUNDER3's first contact moved it on (acct15); RENOWN4 and GUILD1c, one deploy (acct11, then acct12, on their branch; main's WB5b took acct11 first and BASE-HIDE acct12) at acct13; SHADOW-FANG (acct14 - acct12 on its branch) after it
  assert.match(src('server-account/wrangler.toml'), /ACCOUNT_VERSION = "acct82"/);
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
  assert.match(online, /^ {2}if \(renownTracker\) \{\n(?:\s*\/\/[^\n]*\n)*\s*setHudRenown\(\(\) => \(\{ level: renownNow, xp: renownXp, pending: _renownCapHour === renownHour\(\) \? 0 : renownTracker\.pending\(\) \}\)\);/);
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

test('RENOWN4 the HUD, executed: the row hangs under the vitals - the foot\'s last row (UI3) - and is off until the page has a Renown; the box, then the bar - the fill, the ghost from the fill\'s end, the words in it (UI3) - and the box alone while the total is unknown; a getter taken away takes the row (mutants: the row never lit; the ghost from the bar\'s start; the box\'s number stale; nobar never set; the words stale)', async () => {
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
    const col = bottom.children.map((n) => n.className);
    assert.deepEqual(col, ['hud-hotdock', 'hud-breath', 'hud-breath hud-grip', 'hud-bars', 'hud-renown'], 'right under the vitals, and the foot ends there (UI3: the status row is the widget\'s tiles; CLIMB2: the grip beside the breath, above the vitals)');
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
    assert.equal(find(row, 'hud-renownnum').textContent, '490 / 2,150 XP', 'UI3: the XP in the bar');
    // the report lands: the ghost turns solid, and the level rises
    s = { level: 11, xp: 7700, pending: 0 };
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    assert.equal(find(row, 'hud-renownbox').textContent, '11');
    assert.equal(find(row, 'hud-renownghost').style.width, '0.0%');
    assert.equal(find(row, 'hud-renownnum').textContent, `${7700 - renownXpFor(11)} / ${(renownXpFor(12) - renownXpFor(11)).toLocaleString('en-US')} XP`, 'and the words follow it');
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

test('RENOWN4 the sheet: the row is off until lit, as wide as the vitals\' row on a desk and on a phone; the box is the name\'s gold in the HUD\'s square frame; the ghost is the fill\'s gold, faint; nobar takes the bar and leaves the box (mutants: the row always drawn; the widths drifted from the vitals\')', () => {
  const CSS = src('src/ui/enhancedStyle.js');
  assert.match(CSS, /\.hud-renown \{ display: none; align-items: center; gap: 8px; height: 22px; width: calc\(3 \* min\(190px, 23vw\) \+ 28px\); \}[^\n]*\n\.hud-renown\.on \{ display: grid; grid-template-columns: 36px minmax\(0, 1fr\) 36px; \}/);   // RENOWN4b: and its height, which the lifts count (renown4b.test.js); RENOWN-BAR: lit, a grid of three with the bar on the middle (renownbar.test.js)
  assert.match(CSS, /\.hud-vital \.hud-track \{ width: min\(190px, 23vw\); height: 20px;/, 'the vitals the row is as wide as');
  assert.match(CSS, /\.hud-bars \{ display: flex; align-items: center; gap: 14px; \}/);
  assert.match(CSS, /\.hud-vital \.hud-track \{ width: 26vw; \}\n\s*\.hud-renown \{ width: calc\(78vw \+ 20px\); \}/, 'the phone\'s three 26vw tracks and two 10px gaps');
  assert.match(CSS, /\.hud-bars \{ gap: 10px; \}/);
  assert.match(CSS, /\.hud-renownbox \{[^}]*color: #f2c46b;[^}]*border: 2px solid rgba\(242,196,107,0\.8\); \}/);
  assert.match(CSS, /\.hud-renown \.hud-fill \{[^}]*background: #f2c46b; \}/);
  assert.match(CSS, /\.hud-renownghost \{ position: absolute;[^}]*background: rgba\(242,196,107,0\.35\); \}/);
  assert.match(CSS, /\.hud-renown\.nobar \.hud-renowntrack \{ display: none; \}/);
  assert.match(CSS, /\.hud-renownnum \{ position: relative; z-index: 1;/, 'UI3: the words over the fill and the ghost');
});
