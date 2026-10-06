// SEASON1 part two, the banner ribbon (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE BANNER RIBBON
// (bible/11-Multiplayer/Seats-Arc.md 9.1: "every member of it the Season's banner ribbon (a thin band in the guild's
// colours under their name tag for the next Season)") - the law (the guilds a Season's end ribbons, the Season a ribbon
// is worn in, a heraldry as the token's two colours and back); through the real Worker, a Season's end writing it and the
// token's mint wearing it, against a twin counting no Season.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seasonRibbons, ribbonSeasonOf, seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S } from '../src/net/townSeatLaw.js';
import { ribbonClaimOf, ribbonClaimOk, ribbonColours, ribbonRgba, RIBBON_PLAIN, HERALDRY_COLOURS } from '../src/net/heraldryLaw.js';
import { readFileSync } from 'node:fs';
import { verifyToken, claimsValid, mintToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import { badged, readRibbon } from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';
import { accountTokenMinter, SESSION_KEY } from '../src/net/accountClient.js';
import { RemotePlayers, PEER_HEIGHT, NAME_GAP_PX } from '../src/net/remotePlayers.js';
import { measureText } from '../src/ui/text.js';
import { createNameLayer, NAME_CSS } from '../src/ui/nameLayer.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';

test('SEASON1 THE BANNER RIBBON\'S LAW: a Season\'s end ribbons each keeper\'s guild once (never a crown alone); a ribbon is worn in the Season after its own, none with no Season or in Season 0; a guild\'s field and border as two colour indexes, Argent bordered Ash for none; a claim two different colours of the sixteen, read back as their hexes (mutants: the keepers; the once; the Season before; each bound; the plain; the read)', () => {
  const titles = [{ guild: 'a', title: 'crowned', key: 1 }, { guild: 'a', title: 'keeper', key: 1 }, { guild: 'b', title: 'crowned', key: 2 }, { guild: 'c', title: 'keeper', key: 3 }, { guild: 'a', title: 'keeper', key: 4 }];
  assert.deepEqual(seasonRibbons(titles), ['a', 'c']);
  assert.deepEqual([seasonRibbons([]), seasonRibbons(null)], [[], []]);
  assert.deepEqual([ribbonSeasonOf({ n: 3 }), ribbonSeasonOf({ n: 1 }), ribbonSeasonOf({ n: 0 }), ribbonSeasonOf(null)], [2, 0, null, null]);
  const idx = (key) => HERALDRY_COLOURS.findIndex((c) => c.key === key);
  assert.deepEqual(ribbonClaimOf({ field: 'azure', border: 'gold', device: 'wolf' }), [idx('azure'), idx('gold')]);
  assert.deepEqual(ribbonClaimOf({ field: 'teal', border: 'ash', device: 'tree' }), [idx('teal'), idx('ash')]);
  assert.deepEqual({ ...RIBBON_PLAIN }, { field: 'argent', border: 'ash' });
  assert.deepEqual([ribbonClaimOf(null), ribbonClaimOf({ field: 'ash', border: 'gold', device: 'wolf' })], [[3, 14], [3, 14]], 'none, or none valid: Argent bordered Ash');
  assert.deepEqual([ribbonClaimOk([0, 2]), ribbonClaimOk([15, 0]), ribbonClaimOk([2, 2]), ribbonClaimOk([-1, 2]), ribbonClaimOk([0, 16]), ribbonClaimOk([0.5, 2]), ribbonClaimOk([0, 2, 3]), ribbonClaimOk('0,2'), ribbonClaimOk(null)],
    [true, true, false, false, false, false, false, false, false]);
  assert.deepEqual(ribbonColours([0, 2]), { field: '#3b6fd8', border: '#d4a017' });
  assert.deepEqual([ribbonColours([2, 2]), ribbonColours(undefined)], [null, null]);
});

const subtle = globalThis.crypto.subtle;
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const AFTER = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000) + 3 * 3600;

test('SEASON1 THE BANNER RIBBON IN THE SERVICE, AGAINST A TWIN COUNTING NONE: a Season\'s end ribbons the guild that kept its seat the whole Season, not one that took its seat in it; through the next Season the named character of a member at that Turning wears it on the token in its guild\'s colours (Argent bordered Ash for none), a member who joined after none, another character none, the Season after none (mutants: the write; the keepers; the Turning\'s time; the member\'s time; the character; the Season before; the colours; the answer)', async (t) => {
  const scenario = async (zero) => {
    let now = T0;
    t.mock.method(Date, 'now', () => now * 1000);
    const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', ...(zero != null ? { SEASON_ZERO_WEEK: String(zero) } : {}) });
    const raw = svc.env.DB._raw;
    const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
    for (const seat of [WAYREST, ALCAIRE]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
    raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
    const guild = async (handle, name, tag) => {
      const gm = await svc.registered(handle, { renown: 12 });
      assert.equal((await svc.found(gm, { name, tag })).status, 200);
      const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
      raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
      raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        VALUES ('mint', NULL, 'guild', ?, 'test', 100000, 1, 1, 'seed', NULL, ?)`).run(gid, `seed-${gid}`);
      return { gm, gid };
    };
    const hold = (seat, g, since) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
      VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 6, 0)`).run(seat.key, g.gid, seat.region, seat.tier, since, T0 - 7 * DAY);
    const oa = await guild('Orla', 'The Oath', 'OA'), sh = await guild('Gamal', 'The Silver Hand', 'SH');
    hold(WAYREST, oa, W - 10);
    hold(ALCAIRE, sh, W - 3);
    raw.prepare('UPDATE guilds SET heraldry = ? WHERE id = ?').run(JSON.stringify({ field: 'azure', border: 'gold', device: 'wolf' }), oa.gid);
    const join = async (handle, g, at) => {
      const m = await svc.registered(handle, { renown: 3 });
      raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 2, ?, ?)').run(m.id, m.character, g.gid, handle, at);
      return m;
    };
    const mira = await join('Mira', oa, T0 - 30 * DAY);
    const nell = await join('Nell', sh, T0 - 30 * DAY);
    now = AFTER(W);
    await svc.call('/v1/seats/list', {}, oa.gm.secret);   // the Turning that ends week W
    const late = await join('Late', oa, now);   // joined after that Turning
    const wear = async (who, character = who.character) => {
      const minted = (await svc.call('/v1/auth/token', { character }, who.secret)).body;
      const v = await verifyToken(minted.token, svc.identityPublic, { subtle, nowS: now });
      assert.deepEqual(minted.ribbon, v.claims.rb ?? null, 'the answer is the token\'s');
      return minted.ribbon;
    };
    return { svc, raw, oa, sh, mira, nell, late, wear, setNow: (v) => { now = v; } };
  };
  const twin = await scenario(null);
  assert.equal(twin.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_ribbons').get().n, 0);
  assert.equal(await twin.wear(twin.mira), null, 'no Season counted: none');
  // W the last week of Season 1: Season 0 W-11..W-8, Season 1 W-7..W
  const s = await scenario(W - 11);
  assert.deepEqual(s.raw.prepare('SELECT season, guild_id, at FROM town_seat_ribbons').all().map((r) => ({ ...r })), [{ season: 1, guild_id: s.oa.gid, at: Math.floor(seatWeekStartMs(W + 1) / 1000) }]);
  const oath = ribbonClaimOf({ field: 'azure', border: 'gold', device: 'wolf' });
  assert.deepEqual([await s.wear(s.mira), await s.wear(s.oa.gm)], [oath, oath], 'every member at the Turning, the guildmaster too');
  assert.deepEqual([await s.wear(s.nell), await s.wear(s.late)], [null, null], 'a seat taken in the Season; a member since the Turning');
  assert.equal(await s.wear(s.mira, 'not-her-character'), null, 'another character');
  s.raw.prepare('UPDATE guilds SET heraldry = NULL WHERE id = ?').run(s.oa.gid);
  assert.deepEqual(await s.wear(s.mira), ribbonClaimOf(null), 'no heraldry: Argent bordered Ash');
  s.raw.prepare('UPDATE guilds SET heraldry = ? WHERE id = ?').run('{not json', s.oa.gid);
  assert.deepEqual(await s.wear(s.mira), ribbonClaimOf(null), 'a heraldry unread: the same');
  // Season 3 (W+9 on): Season 1's ribbon is put away - the Turnings between settled as they stand
  for (let w = W + 1; w <= W + 8; w++) s.raw.prepare('INSERT OR IGNORE INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(w, T0);
  s.setNow(AFTER(W + 8));
  assert.equal(await s.wear(s.mira), null, 'the Season after the next: none');
});

const ofType = (ws, kind) => ws.sent.filter((m) => m.t === kind);
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('SEASON1 THE BANNER RIBBON ON THE TOKEN AND THE RELAY: a claim set may carry two of the sixteen colours and nothing else; the minter writes it only when worn (none, the bytes as before); the relay reads it off the signature onto the welcome\'s and the join\'s rows, never off a frame, and `badged` and `readRibbon` admit nothing else (mutants: the vocabulary; the minter; the relay\'s two reads; badged; the reader)', async () => {
  const base = { s: 'acct-0001', n: 'Mara', k: 'linked', i: 100, e: 200 };
  assert.deepEqual([claimsValid({ ...base, rb: [0, 2] }), claimsValid({ ...base, rb: [2, 2] }), claimsValid({ ...base, rb: [0, 16] }), claimsValid({ ...base, rb: '0,2' }), claimsValid(base)], [true, false, false, false, true]);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const worn = await mintToken({ s: 'acct-0001', n: 'Mara', k: 'linked', rb: [0, 2] }, kp.privateKey, { subtle, nowS: 1000 });
  assert.deepEqual((await verifyToken(worn, pub, { subtle, nowS: 1000 })).claims.rb, [0, 2]);
  const bare = await mintToken({ s: 'acct-0001', n: 'Mara', k: 'linked' }, kp.privateKey, { subtle, nowS: 1000 });
  assert.equal('rb' in (await verifyToken(bare, pub, { subtle, nowS: 1000 })).claims, false, 'none worn: no key');
  await assert.rejects(mintToken({ s: 'acct-0001', n: 'Mara', k: 'linked', rb: [3, 3] }, kp.privateKey, { subtle, nowS: 1000 }), /refused/);
  assert.deepEqual([badged({}, { rb: [1, 2] }).rb, 'rb' in badged({}, { rb: [1, 1] }), 'rb' in badged({}, {})], [[1, 2], false, false]);
  assert.deepEqual([readRibbon({ rb: [4, 5] }), readRibbon({ rb: [4] }), readRibbon(null)], [[4, 5], null, null]);
  // the relay
  const r = fakeRoom('town:m11');
  const mara = r.connect(); await r.hello(mara, 'mara-0001', null, { rb: [0, 2] });
  const bob = r.connect(); await r.hello(bob, 'bobb-0002');
  assert.deepEqual(ofType(bob, 'welcome')[0].peers.find((p) => p.id === 'mara-0001').rb, [0, 2], 'the welcome\'s row wears it');
  assert.equal('rb' in ofType(mara, 'join').find((j) => j.id === 'bobb-0002'), false, 'a token with none stamps none');
  const eve = r.connect(); await r.hello(eve, 'evee-0003', null, { rb: [3, 4] });
  assert.deepEqual([ofType(mara, 'join').find((j) => j.id === 'evee-0003').rb, ofType(bob, 'join').find((j) => j.id === 'evee-0003').rb], [[3, 4], [3, 4]], 'the join wears it');
  const sly = r.connect();
  await r.room.webSocketMessage(sly, JSON.stringify({ t: 'hello', id: 'slyy-0004', secret: 'secret-of-slyy-0004', name: 'slyy-0004', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: null, rb: [1, 2], tok: await r.token('slyy-0004') }));
  const slyJoin = ofType(bob, 'join').find((j) => j.id === 'slyy-0004');
  assert.ok(slyJoin, 'admitted');
  assert.equal('rb' in slyJoin, false, 'a frame that only types one gets none');
  // the wiring by source - the relay's two reads
  const relay = src('server/src/index.js');
  assert.match(relay, /glyphs: c\.g, gx: c\.gx, au: c\.au, rb: c\.rb, mu, lv: c\.lv,/);
  assert.match(relay, /au: who\.au, \.\.\.\(who\.rb \? \{ rb: who\.rb \} : \{\}\), lv: who\.lv,/);
});

test('SEASON1 THE BANNER RIBBON ON THE PAGE: the mint\'s answer hands mine to the page (null for none, nothing from an older service); the session keeps a peer\'s off the welcome and each hello (one taken off is gone), remembers it past a re-stand, and answers `ribbonOf`; the name point carries it; the bitmap face draws a band the run\'s width in the field colour under the name, edged in the border colour, none for none; the DOM face a band under the name row in both colours, written when it changes and off for none (mutants: the minter; the session\'s reads; the point; the bands; the DOM\'s colours and its off)', async () => {
  let answer = { token: 'v1.t.s', name: 'Mac', kind: 'linked', title: null, glyphs: [], level: 10, xp: 6000, ribbon: [0, 2] };
  const fetch = async () => ({ ok: true, status: 200, json: async () => answer });
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'p_me', name: 'Mac', kind: 'linked', sessionId: 's1', secret: 'SECRETSECRETSECRETSECRET' })]]);
  const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  const issued = [];
  const mint = accountTokenMinter({ fetch, storage, onIssued: (w) => issued.push(w), character: () => 'char-aaaa' });
  await mint();
  assert.deepEqual(issued.at(-1).ribbon, [0, 2]);
  answer = { ...answer, ribbon: null };
  await mint();
  assert.equal(issued.at(-1).ribbon, null, 'none, said');
  const { ribbon: _drop, ...older } = answer;
  answer = older;
  await mint();
  assert.equal('ribbon' in issued.at(-1), false, 'an older service says nothing');
  // the session
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1_000_000 });
  s.join('world:2,12', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0];
  ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', rb: [0, 2] }, { id: 'eve-0003', name: 'Eve', rb: [5, 5] }], n: 3, v: 'world149' });
  assert.deepEqual([s.ribbonOf('bob-0002'), s.ribbonOf('eve-0003'), s.ribbonOf(null)], [[0, 2], null, null], 'two of the same colour is none');
  ws.receive({ t: 'join', id: 'bob-0002', name: 'Bob' });
  assert.equal(s.ribbonOf('bob-0002'), null, 'the newest hello\'s, including none');
  const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
  ws.receive({ t: 'join', id: 'bob-0002', name: 'Bob', rb: [6, 7], pose });
  ws.receive({ t: 'leave', id: 'bob-0002' });
  assert.deepEqual(s.ribbonOf('bob-0002'), [6, 7], 'remembered past the room');
  ws.receive({ t: 'pose', id: 'bob-0002', p: { ...pose, x: 4 } });
  assert.deepEqual(s.peers.get('bob-0002')?.rb, [6, 7], 'a peer re-stood by a bare pose wears it at once, from memory');
  assert.equal(s.adoptIdentity({ name: 'Mac', ribbon: [0, 2] }), true);
  assert.deepEqual(s.ribbonOf('mac-0001'), [0, 2]);
  assert.equal(s.adoptIdentity({ name: 'Mac' }), false, 'an older service says nothing about it');
  assert.equal(s.adoptIdentity({ name: 'Mac', ribbon: [0, 2] }), false, 'the same: no change');
  assert.equal(s.adoptIdentity({ name: 'Mac', ribbon: null }), true);
  assert.equal(s.ribbonOf('mac-0001'), null);
  // the point
  const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
  const VIEW = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
  const rp = new RemotePlayers({ renderer: { drawScreenQuad() {} }, deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-0001', name: 'MACK', title: null, glyphs: [], rb: [0, 2], shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }], (p) => [p.x, p.y, p.z], { bodyHeight: () => PEER_HEIGHT });
  assert.deepEqual(rp.namePoints(PROJ, VIEW, 1600, 900, [0, 1.7, 0], (q) => [q.x, q.y, q.z])[0].rb, [0, 2]);
  // the bitmap face
  const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
  const quads = [];
  const rec = { drawScreenQuad: (tex, dst, src2, color) => quads.push({ tex, dst, color }), drawScreenQuadRun: () => {} };
  const pt = { id: 'p', name: 'Mack', x: 800, y: 400, scale: 1, title: null, glyphs: [], lv: null, gt: null };
  rp.drawNamePoints(rec, { fnt: FNT, tex: 'T' }, [{ ...pt, rb: [0, 2] }], 2);
  const solid = quads.filter((q) => q.tex === null);
  const tw = measureText(FNT, 'Mack') * 2, top = 400 - NAME_GAP_PX * 2 - 8 * 2;
  const tint = ribbonRgba([0, 2]);
  assert.deepEqual(solid.map((q) => [q.dst, q.color]), [
    [{ x: Math.round(800 - tw / 2), y: Math.round(top + 16 + 2), w: Math.round(tw), h: 4 }, tint.field],
    [{ x: Math.round(800 - tw / 2), y: Math.round(top + 16 + 2) + 4, w: Math.round(tw), h: 2 }, tint.border],
  ]);
  assert.deepEqual(tint, { field: [0x3b / 255, 0x6f / 255, 0xd8 / 255, 1], border: [0xd4 / 255, 0xa0 / 255, 0x17 / 255, 1] });
  quads.length = 0;
  rp.drawNamePoints(rec, { fnt: FNT, tex: 'T' }, [pt], 2);
  assert.equal(quads.filter((q) => q.tex === null).length, 0, 'none worn: no band');
  // the DOM face
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, style: {}, dataset: {},
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
      setAttribute(k, v) { n.attrs[k] = v; }, replaceChildren(...cs) { n.children.length = 0; n.append(...cs); },
      remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; }, addEventListener() {}, focus() {} };
    let text = '', cls = '';
    Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); n.children.length = 0; } });
    Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); } });
    return n;
  };
  const doc = { createElement: (t) => node(t), createElementNS: (ns, t) => node(t), head: node('head'), body: node('body'), getElementById: () => null };
  const layer = createNameLayer({ doc, now: () => 1000 });
  const at = (rb) => { layer.render({ points: [{ ...pt, id: 'peer-0001', x: 400, y: 300, rb }] }); return layer.tagFor('peer-0001'); };
  let t = at([0, 2]);
  assert.deepEqual(t.node.children.map((c) => c.className), ['dfname-bubble off', 'dfname-title', 'dfname-tag', 'dfname-house', 'dfname-ribbon'], 'under the name row (LEGACY7, PIN MOVED: the house\'s line between the name row and the ribbon)');
  assert.deepEqual([t.ribbon.style.background, t.ribbon.style.borderBottomColor], ['#3b6fd8', '#d4a017']);
  t.ribbon.style.background = 'rgb(59, 111, 216)';   // a browser reads it back normalised
  t = at([0, 2]);
  assert.equal(t.ribbon.style.background, 'rgb(59, 111, 216)', 'written when it changes, never every frame');
  t = at(null);
  assert.deepEqual([t.ribbon.className, t.ribbon.style.background, t.ribbon.style.borderBottomColor], ['dfname-ribbon off', '', ''], 'none: off, and its colours cleared');
  assert.match(NAME_CSS, /\.dfname-ribbon\.off \{ display: none; \}/);
});
