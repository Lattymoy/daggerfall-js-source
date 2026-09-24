// TITLE-N — THE DUNGEON MASTER AND THE PATREON TIERS (2026-09-24).
//
// Mac: "Add 4 new titles/glyphs. Dungeon Master is an orange title with its own glyph. This title allows the user to
// use the /dm to message chat with orange text (similar to /red). This goes strictly to the account SquidKamer.
// Disciple, Apostle, Hierophant are new patreon titles. These also recieve their own unique glyphs. The account
// Dutchess will recieve the Disciple title/glyph."
//
// Each grant is a handle list in the account service's config (the developers' law), each title carries its own
// glyph, and /dm is RED1's law one glyph over: the relay alone decides, off the `dm` glyph in the signed token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { TITLES, GLYPHS, claimsValid, mintToken, verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import { TITLE_TEXT, TITLE_RGBA, GLYPH_RGBA, GLYPH_MARK, GLYPH_PATH, GLYPH_STROKE, FONT_GLYPH_MIN, FONT_GLYPH_MAX, cssRgba, titleBadge, glyphBadges } from '../src/ui/playerBadge.js';
import { GLYPH_LABEL } from '../src/ui/enhancedAccount.js';
import { titlesHeld, glyphsOf, equipRefusal, titleWorn, TIER_LISTS, TIER_GLYPH, FOUNDER_UNTIL } from '../server-account/src/titles.js';
import { parseClient, dmGate, redGate, DM_HZ_MAX, RED_HZ_MAX, DM_RELAY_MIN, relaySupportsDm, RELAY_VERSION, readBadge } from '../src/net/wire.js';
import { HOST_COMMANDS, parseChatLine } from '../src/net/chatCommands.js';
import { ChatLog } from '../src/net/chat.js';
import { OnlineSession } from '../src/net/online.js';
import { CHAT_CSS } from '../src/ui/chatPanel.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const { subtle } = webcrypto;
const NEW_TITLES = ['dungeonmaster', 'disciple', 'apostle', 'hierophant'];
const NEW_GLYPHS = ['dm', 'disciple', 'apostle', 'hierophant'];

// ── THE VOCABULARY AND ITS FACE ─────────────────────────────────────

test('TITLE-N vocabulary: four titles and four glyphs join, each title with its word and colour, each glyph with its title\'s colour, a shape and a classic mark of its own (mutants: a glyph wearing another title\'s colour; two glyphs sharing a mark; the Dungeon Master not orange)', () => {
  for (const t of NEW_TITLES) assert.ok(TITLES.includes(t), `${t} is a title`);
  for (const g of NEW_GLYPHS) assert.ok(GLYPHS.includes(g), `${g} is a glyph`);
  assert.deepEqual(NEW_TITLES.map((t) => TITLE_TEXT[t]), ['Dungeon Master', 'Disciple', 'Apostle', 'Hierophant']);
  assert.equal(cssRgba(TITLE_RGBA.dungeonmaster), '#ff8c1a', 'Mac: "Dungeon Master is an orange title"');
  NEW_TITLES.forEach((t, i) => assert.equal(GLYPH_RGBA[NEW_GLYPHS[i]], TITLE_RGBA[t], `${NEW_GLYPHS[i]} wears ${t}'s own colour, read from it`));
  const colours = new Set(TITLES.map((t) => cssRgba(TITLE_RGBA[t])));
  assert.equal(colours.size, TITLES.length, 'no two titles share a colour');
  const marks = GLYPHS.map((g) => GLYPH_MARK[g]);
  assert.equal(new Set(marks).size, GLYPHS.length, 'every glyph has a classic mark of its own');
  for (const m of marks) { assert.equal(m.length, 1); assert.ok(m.charCodeAt(0) >= FONT_GLYPH_MIN && m.charCodeAt(0) <= FONT_GLYPH_MAX, `${m} is in the font`); }
  for (const g of NEW_GLYPHS) { assert.ok(GLYPH_PATH[g], `${g} has a shape`); assert.equal(typeof GLYPH_STROKE[g], 'boolean'); assert.ok(GLYPH_LABEL[g], `${g} is named on the card`); }
  // the wire keeps what the vocabulary names, and the badge draws it
  assert.deepEqual(readBadge({ title: 'dungeonmaster', glyphs: ['dm', 'disciple'] }), { title: 'dungeonmaster', glyphs: ['dm', 'disciple'] });
  assert.equal(titleBadge({ title: 'hierophant' }).text, 'Hierophant');
  assert.deepEqual(glyphBadges({ glyphs: ['hierophant', 'dm'] }).map((b) => b.key), ['dm', 'hierophant'], 'the vocabulary\'s order, not the wire\'s');
});

// ── THE GRANTS ──────────────────────────────────────────────────────

test('TITLE-R founder: no account registered after the cutoff can obtain Founder, and every account that holds it keeps it - held and worn (Mac: "Remove the founder title from being obtained. Current users keep their founder title") (mutants: the cutoff moved forward; the cutoff an open end)', () => {
  assert.equal(FOUNDER_UNTIL, Date.UTC(2026, 8, 23) / 1000, 'the cutoff is the end of the day ACC3 shipped, and it is in the past');
  const today = Date.UTC(2026, 8, 24) / 1000;
  assert.ok(FOUNDER_UNTIL < today, 'closed before this change: nobody has been able to obtain it since');
  assert.deepEqual(titlesHeld({ handle: 'New', registered_at: today }, {}), [], 'registered now: no Founder');
  assert.deepEqual(titlesHeld({ handle: 'New', registered_at: FOUNDER_UNTIL + 1 }, {}), [], 'a second past the cutoff: no Founder');
  const old = { handle: 'Old', registered_at: FOUNDER_UNTIL - 86400, title: 'founder' };
  assert.deepEqual(titlesHeld(old, {}), ['founder'], 'registered before: kept');
  assert.equal(titleWorn(old, {}), 'founder', 'and still worn');
});

test('TITLE-N grants: the Dungeon Master is SquidKamer\'s alone and Disciple is Dutchess\'s, each from its handle list, case-folded; each held title brings its glyph; a guest and anyone else hold none, and cannot wear one (mutants: the lists crossed; a guest granted; the glyph without the title)', () => {
  const toml = rd('server-account/wrangler.toml');
  const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
  assert.equal(v('DUNGEON_MASTER_HANDLES'), 'SquidKamer', 'Mac: "This goes strictly to the account SquidKamer"');
  assert.equal(v('DISCIPLE_HANDLES'), 'Dutchess,Satranath', 'Mac: "The account Dutchess will recieve the Disciple title/glyph", then "Satranath please add this account as a disciple also"');
  assert.equal(v('APOSTLE_HANDLES'), '', 'nobody yet');
  assert.equal(v('HIEROPHANT_HANDLES'), '', 'nobody yet');
  assert.deepEqual(Object.keys(TIER_LISTS), NEW_TITLES);
  assert.deepEqual(Object.values(TIER_GLYPH), NEW_GLYPHS);
  const env = { DUNGEON_MASTER_HANDLES: v('DUNGEON_MASTER_HANDLES'), DISCIPLE_HANDLES: v('DISCIPLE_HANDLES'), APOSTLE_HANDLES: 'Paul', HIEROPHANT_HANDLES: 'Pope, Other' };
  const nowS = 1_900_000_000;
  const row = (handle) => ({ handle, created_at: 0, registered_at: 1_900_000_000 });
  assert.deepEqual(titlesHeld(row('squidkamer'), env), ['dungeonmaster'], 'the handle is case-folded');
  assert.deepEqual(glyphsOf(row('SquidKamer'), env, nowS), ['dm']);
  assert.deepEqual(titlesHeld(row('Dutchess'), env), ['disciple']);
  assert.deepEqual(glyphsOf(row('Dutchess'), env, nowS), ['disciple']);
  assert.deepEqual(titlesHeld(row('Satranath'), env), ['disciple'], 'the second Disciple, off the same list');
  assert.deepEqual(glyphsOf(row('satranath'), env, nowS), ['disciple']);
  assert.deepEqual(titlesHeld(row('Paul'), env), ['apostle']);
  assert.deepEqual(glyphsOf(row('pope'), env, nowS), ['hierophant']);
  assert.deepEqual(titlesHeld(row('Stranger'), env), []);
  assert.deepEqual(glyphsOf(row('Stranger'), env, nowS), []);
  assert.deepEqual(titlesHeld({ handle: null, created_at: 0 }, env), [], 'a guest holds none');
  assert.equal(equipRefusal('dungeonmaster', row('Dutchess'), env), 'not-held');
  assert.equal(equipRefusal('dungeonmaster', row('SquidKamer'), env), null);
  assert.equal(equipRefusal('disciple', row('Dutchess'), env), null);
  assert.deepEqual(titlesHeld(row('SquidKamer'), {}), [], 'an empty config grants nothing');
});

test('TITLE-N token: a token may carry a new title and its glyph, and a new glyph beside the old ones - the vocabulary is still closed', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-1', n: 'SquidKamer', k: 'linked', t: 'dungeonmaster', g: ['sprout', 'dm'] }, kp.privateKey, { subtle, nowS });
  const r = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(r.ok, r.why);
  assert.equal(r.claims.t, 'dungeonmaster');
  assert.deepEqual(r.claims.g, ['sprout', 'dm']);
  const base = { v: 1, s: 'acct-1', n: 'Mack', k: 'linked', i: nowS, e: nowS + 60 };
  for (const t of NEW_TITLES) assert.equal(claimsValid({ ...base, t }), true, t);
  assert.equal(claimsValid({ ...base, g: [...GLYPHS] }), true, 'every glyph at once still fits');
  assert.equal(claimsValid({ ...base, t: 'patron' }), false);
});

// ── /dm AT THE RELAY ────────────────────────────────────────────────

test('TITLE-N relay: a socket whose TOKEN carried the dm glyph narrates to everyone as {t:\'dm\'} with no id and no name; a player, a developer (whose right is /red) and a hello that TYPES the glyph are ignored in silence (mutants: the dev glyph admitted; the right read off the hello; a speaker on the line)', async () => {
  const r = fakeRoom('chat:world');
  const dm = r.connect(), dev = r.connect(), one = r.connect();
  await r.hello(dm, 'peer-0001', null, { glyphs: ['dm'] });
  await r.hello(dev, 'peer-0002', null, { glyphs: ['dev'] });
  await r.hello(one, 'peer-0003');
  for (const ws of [dm, dev, one]) ws.sent.length = 0;
  await r.raw(dm, JSON.stringify({ t: 'narrate', text: 'The torches gutter as something vast stirs below.' }));
  for (const [who, ws] of [['the Dungeon Master', dm], ['a developer', dev], ['a player', one]]) {
    const said = ofType(ws, 'dm');
    assert.equal(said.length, 1, `${who} did not hear it`);
    assert.equal(said[0].text, 'The torches gutter as something vast stirs below.');
    assert.equal('id' in said[0], false); assert.equal('name' in said[0], false);
    assert.ok(Number.isFinite(said[0].at));
  }
  for (const ws of [dm, dev, one]) ws.sent.length = 0;
  await r.raw(one, JSON.stringify({ t: 'narrate', text: 'I am the DM now' }));
  await r.raw(dev, JSON.stringify({ t: 'narrate', text: 'a developer narrating' }));
  for (const ws of [dm, dev, one]) assert.equal(ofType(ws, 'dm').length, 0, 'only the dm glyph narrates');
  assert.equal(one.closed, null, 'and nobody is closed for asking');
  const liar = r.connect();
  await r.hello(liar, 'peer-0004', null, { tok: await r.token('peer-0004', { n: 'peer-0004' }), glyphs: ['dm'] });
  liar.sent.length = 0;
  await r.raw(liar, JSON.stringify({ t: 'narrate', text: 'typed glyph' }));
  assert.equal(ofType(liar, 'dm').length, 0, 'a typed glyph is not a signed one');
});

test('TITLE-N relay: the Dungeon Master is rated on a bucket of its own - not chat\'s, not the server line\'s; a chat frame cannot become a dm one (mutants: the red bucket shared; a flag on a chat line honoured)', async () => {
  assert.equal(DM_HZ_MAX, RED_HZ_MAX, 'RED_HZ_MAX\'s reason: it reaches everyone on the World channel');
  const r = fakeRoom('chat:world');
  const both = r.connect(), other = r.connect();
  await r.hello(both, 'peer-0001', null, { glyphs: ['dev', 'dm'] });
  await r.hello(other, 'peer-0002');
  other.sent.length = 0;
  for (let i = 0; i < 4; i++) await r.raw(both, JSON.stringify({ t: 'narrate', text: `line ${i}` }));
  assert.equal(ofType(other, 'dm').length, 1, 'one through, the rest dropped');
  await r.raw(both, JSON.stringify({ t: 'say', text: 'the server, still' }));
  assert.equal(ofType(other, 'red').length, 1, 'the server line spends its own bucket');
  await r.raw(both, JSON.stringify({ t: 'chat', text: 'and hello', dm: true }));
  const chat = ofType(other, 'chat');
  assert.equal(chat.length, 1);
  assert.equal('dm' in chat[0], false, 'a chat line carries nothing the relay did not put there');
  // the shape only, at the parser - `say`'s law
  assert.deepEqual(parseClient(JSON.stringify({ t: 'narrate', text: 'hi' }), { hasHello: true }), { t: 'narrate', text: 'hi' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'narrate', text: '  ' }), { hasHello: true }), { error: 'bad narrate' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'narrate', text: 'hi' }), { hasHello: false }), { error: 'narrate before hello' });
  assert.notEqual(dmGate, redGate);
});

// ── /dm AT HOME ─────────────────────────────────────────────────────

test('TITLE-N session: /dm goes only to a relay that carries it (world104) as {t:\'narrate\'}, under its own gate; a {t:\'dm\'} in is handed on with no speaker (mutants: sent to an older relay; the frame named say; the line given an id)', () => {
  assert.equal(DM_RELAY_MIN, 104);
  assert.equal(relaySupportsDm('world103'), false, 'an older relay closes the socket on the frame');
  assert.equal(relaySupportsDm(RELAY_VERSION), true, 'this relay carries it');
  const s = new OnlineSession({ url: 'wss://example.test', name: 'SquidKamer', id: 'peer-0001', secret: 'x'.repeat(32), presence: false });
  const out = [];
  s._send = (f) => { out.push(f); return true; };
  assert.equal(s.sendDm('The door groans open.'), false, 'not before the welcome says the relay carries it');
  s.dmOk = true;
  assert.equal(s.sendDm('The door groans open.'), true);
  assert.deepEqual(out, [{ t: 'narrate', text: 'The door groans open.' }]);
  assert.equal(s.sendDm('again'), false, 'the gate, run at home first');
  assert.equal(s.sendDm('   '), false, 'nothing to say');
  const online = rd('src/net/online.js');
  const recv = online.slice(online.indexOf("} else if (m.t === 'dm') {"), online.indexOf("} else if (m.t === 'muted') {"));
  assert.match(recv, /this\.onDm\?\.\(\{ text, at:/, 'handed on');
  assert.doesNotMatch(recv, /m\.id|m\.name/, 'no speaker read off it');
  assert.match(recv, /chatInGate\(this\._inChat\.get\(room\), now\)/, 'gated coming in: the relay is the player\'s own choice');
  assert.match(online, /if \(primary\) this\.dmOk = relaySupportsDm\(relayV\);/);
});

test('TITLE-N log and panel: the Dungeon Master\'s line is a system line flagged `dm` from the frame type, one line on every tab, drawn orange in the title\'s own colour; the host parses /dm before /red and never guards it (mutants: the flag off a field; drawn red; the host checking a glyph)', () => {
  const log = new ChatLog();
  const line = log.pushAll({ text: 'Roll for initiative.', dm: true });
  assert.equal(line.dm, true); assert.equal(line.system, true); assert.equal(line.red, false);
  const one = log.push('world', { text: 'Nobody speaks this.', dm: true });
  assert.equal(one.system, true, 'a dm line is a system line by itself, not only through pushAll - nobody is speaking it, so no bubble hangs over an empty id');
  assert.equal(one.id, ''); assert.equal(one.name, '');
  assert.ok(log.tabs.filter((t) => t.shown).every((t) => t.messages.includes(line)), 'on every tab');
  assert.equal('dm' in log.push('world', { id: 'p', name: 'P', text: 'hi' }), false, 'a player\'s line carries no dm key at all');
  assert.ok(CHAT_CSS.includes(`.dfchat-line.dm .dfchat-text { color: ${cssRgba(TITLE_RGBA.dungeonmaster)};`), 'orange, the title\'s own');
  assert.match(rd('src/ui/chatPanel.js'), /\$\{line\.dm \? ' dm' : ''\}/);
  assert.ok(HOST_COMMANDS.includes('dm'));
  assert.deepEqual(parseChatLine('/dm hello'), { kind: 'host', name: 'dm' }, 'the parser leaves it to the host');
  const w = rd('src/scenes/world.js');
  assert.match(w, /const dm = \/\^\\\/dm\\s\+\(\[\\s\\S\]\+\)\$\/i\.exec\(text\.trim\(\)\);\s*if \(dm\) return chatLinks\.get\('world'\)\?\.sendDm\(dm\[1\]\) \?\? false;/);
  const arm = w.slice(w.indexOf('const dm = /^'), w.indexOf('const red = /^'));
  assert.doesNotMatch(arm.replace(/\/\/[^\n]*/g, ''), /glyph|wardrobe|title/i, 'the host does not decide who may narrate');
  assert.ok(w.indexOf('const dm = /^') < w.indexOf('const red = /^'), 'before /red');
  assert.match(w, /link\.onDm = \(line\) => chatLog\.pushAll\(\{ text: line\.text, at: line\.at, dm: true \}\);/, 'the flag set here, from the frame type');
});
