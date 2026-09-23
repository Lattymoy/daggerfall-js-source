// RED1 — THE SERVER SPEAKING (2026-09-22).
//
// Mac: "Before we merge after everything, I want to set up a red text
// system (kind of like warframe) where I can message chat as the
// server before we merge."
//
// ═══ THE ONE THING THESE PINS EXIST FOR ════════════════════════════
//
// A LINE THAT LOOKS LIKE THE SERVER IS THE MOST VALUABLE FORGERY IN
// THE GAME. "The relay is restarting in 5 minutes", "there is a
// duplication bug, log out now", "the developers are giving away X" -
// every one of them costs a player something, and every one is free to
// whoever can make a line look official.
//
// So the authority is a SIGNATURE and nothing else: `a.glyphs` on the
// socket's attachment, written by `_named` out of the verified token
// claims and writable by nothing else. That means these pins drive a
// REAL Room with a REAL Ed25519 key, and the negative cases are driven
// through the same door a real attacker would use - a hello that types
// the glyph, a socket with no grant, a chat frame carrying `red`.
//
// NOTHING HERE IS A NEW CREDENTIAL. That is the design: no admin
// password, no second route, no separate key - each would be another
// thing to leak and another thing to remember to revoke. A handle
// taken off DEVELOPER_HANDLES stops being able to do this within one
// token's life, with nothing to clear anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from './fakeRoom.mjs';
import { parseClient, sanitizeChat, redGate, chatGate, RED_HZ_MAX, CHAT_HZ_MAX, CHAT_MAX, RELAY_VERSION } from '../src/net/wire.js';
import { ChatLog } from '../src/net/chat.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

// ── THE WIRE'S SHAPE ────────────────────────────────────────────────

test('RED1: `say` is checked for SHAPE only - whether a socket may speak as the server is a question about a signature, and parseClient holds no key', () => {
  assert.deepEqual(parseClient(JSON.stringify({ t: 'say', text: 'hello all' }), { hasHello: true }), { t: 'say', text: 'hello all' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'say', text: '   ' }), { hasHello: true }), { error: 'bad say' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'say', text: 42 }), { hasHello: true }), { error: 'bad say' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'say', text: 'hi' }), { hasHello: false }), { error: 'say before hello' });
  // BOUNDED LIKE A CHAT LINE, because it is one - a broadcast is not a
  // licence to put four kilobytes over everybody's screen.
  const long = 'x'.repeat(CHAT_MAX * 3);
  assert.equal(parseClient(JSON.stringify({ t: 'say', text: long }), { hasHello: true }).text.length, CHAT_MAX);
  assert.equal(parseClient(JSON.stringify({ t: 'say', text: 'a\u0000b' }), { hasHello: true }).text, sanitizeChat('a\u0000b'));
  // parseClient is SYNC AND PURE and stays that way (ACC1d's split).
  const wire = rd('src/net/wire.js');
  const arm = wire.slice(wire.indexOf("if (m.t === 'say')"), wire.indexOf("if (m.t === 'social')"));
  assert.doesNotMatch(arm, /await|verify|glyph|dev/i, 'the parser must not try to answer a question only the relay can');
});

test('RED1: the server line is rated WELL UNDER a chat line, and the bound is derived rather than asserted', () => {
  // A player's line reaches a room; this reaches every player in the
  // game. The relation is what matters, not the number.
  assert.ok(RED_HZ_MAX < CHAT_HZ_MAX, `a broadcast must not be cheaper than a chat line (${RED_HZ_MAX} vs ${CHAT_HZ_MAX})`);
  // ...AND NOT BELOW ONE, which is a fact about the shared gate rather
  // than a preference. This pin exists because the first cut set 0.5
  // and the feature was silently DEAD: a fresh bucket starts with
  // `rate` tokens and a pass costs a whole one, so every frame was
  // refused. `tokenGate` says so at its own door now.
  assert.ok(RED_HZ_MAX >= 1, 'tokenGate cannot express a rate below one a second - under it, nothing ever passes');
  // ...and it is its OWN bucket, so spending one does not spend the other.
  const t0 = 1_000_000;
  const a = redGate(null, t0);
  assert.equal(a.pass, true);
  assert.equal(redGate(a.bucket, t0).pass, false, 'two in the same instant is one too many');
  assert.equal(chatGate(null, t0).pass, true, 'and an ordinary line is untouched by it');
  assert.equal(redGate(a.bucket, t0 + 1000 / RED_HZ_MAX).pass, true, 'it refills on its own clock');
});

// ── THE RELAY, over a real room with a real key ─────────────────────

test('RED1: a socket whose TOKEN carried the dev glyph speaks to everyone; one that did not is ignored, and a hello that TYPES the glyph gets nothing', async () => {
  const r = fakeRoom('chat:world');
  const dev = r.connect(), one = r.connect(), two = r.connect();
  await r.hello(dev, 'peer-0001', null, { glyphs: ['dev'] });
  await r.hello(one, 'peer-0002');
  await r.hello(two, 'peer-0003');
  for (const ws of [dev, one, two]) ws.sent.length = 0;

  await r.raw(dev, JSON.stringify({ t: 'say', text: 'The realm is closing for repairs.' }));
  for (const [who, ws] of [['the sender', dev], ['a player', one], ['another', two]]) {
    const said = ofType(ws, 'red');
    assert.equal(said.length, 1, `${who} did not hear it`);
    assert.equal(said[0].text, 'The realm is closing for repairs.');
    // A LINE NOBODY IS SPEAKING: no id, no name. There is nothing on it
    // to forge and nothing for a client to attribute.
    assert.equal('id' in said[0], false);
    assert.equal('name' in said[0], false);
    assert.ok(Number.isFinite(said[0].at));
  }

  // AN ORDINARY PLAYER IS IGNORED, and silently - a stranger probing
  // this learns nothing from being ignored, where a refusal would tell
  // them the frame exists and is worth attacking.
  for (const ws of [dev, one, two]) ws.sent.length = 0;
  await r.raw(one, JSON.stringify({ t: 'say', text: 'FREE GOLD, log out now' }));
  for (const ws of [dev, one, two]) assert.equal(ofType(ws, 'red').length, 0, 'a player spoke as the server');
  assert.equal(one.closed, null, 'and was not closed - a refusal is a signal too');

  // AND THE FRAME'S OWN WORD IS NOT A GRANT. This hello signs a token
  // with NO glyphs and types them on the frame, which is the whole
  // attack and the one ACC1g shut on the name one arc ago.
  const liar = r.connect();
  await r.hello(liar, 'peer-0004', null, { tok: await r.token('peer-0004', { n: 'peer-0004' }), glyphs: ['dev'] });
  liar.sent.length = 0;
  await r.raw(liar, JSON.stringify({ t: 'say', text: 'I am the server' }));
  assert.equal(ofType(liar, 'red').length, 0, 'a typed glyph is not a signed one');
});

test('RED1: a chat frame cannot become a red one, whatever it carries', async () => {
  // The client marks a red line from the FRAME TYPE, which no player
  // can send - net/chat.js\'s own note is the reason: a notice
  // recognised by a name or a flag on an ordinary line would be one
  // forged field away from a player announcing a fake restart.
  const r = fakeRoom('chat:world');
  const a = r.connect(), b = r.connect();
  await r.hello(a, 'peer-0001');
  await r.hello(b, 'peer-0002');
  b.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'chat', text: 'the realm is closing', red: true, system: true }));
  const heard = ofType(b, 'chat');
  assert.equal(heard.length, 1, 'the line still arrives as an ordinary one');
  assert.equal('red' in heard[0], false, 'and carries nothing the relay did not put there');
  assert.equal('system' in heard[0], false);
  assert.equal(ofType(b, 'red').length, 0);
});

test('RED1: even a developer is rated - the bucket is the socket\'s, and it is not the chat bucket', async () => {
  const r = fakeRoom('chat:world');
  const dev = r.connect(), other = r.connect();
  await r.hello(dev, 'peer-0001', null, { glyphs: ['dev'] });
  await r.hello(other, 'peer-0002');
  other.sent.length = 0;
  for (let i = 0; i < 4; i++) await r.raw(dev, JSON.stringify({ t: 'say', text: `line ${i}` }));
  assert.equal(ofType(other, 'red').length, 1, 'one got through and the rest were dropped, not queued');
  // ...AND THE CHAT BUCKET IS UNTOUCHED. A developer who has just
  // broadcast can still talk like anybody else.
  await r.raw(dev, JSON.stringify({ t: 'chat', text: 'and hello' }));
  assert.equal(ofType(other, 'chat').length, 1, 'the two rates are separate spends');
});

test('RED1: the grant is the SAME fact as the glyph beside the name - taking the handle off the list takes both', async () => {
  // This is the whole design, driven rather than argued: there is no
  // second credential. A developer reconnects with a token that no
  // longer carries the glyph - which is exactly what the service mints
  // once a handle leaves DEVELOPER_HANDLES - and stops being able to
  // do this, with nothing cleared anywhere.
  const r = fakeRoom('chat:world');
  // THE WATCHER GOES IN FIRST, so the developer's arrival reaches it as
  // a JOIN - that is the frame the glyph rides, and a welcome would
  // only show what was already standing there.
  const other = r.connect(), dev = r.connect();
  await r.hello(other, 'peer-0002');
  await r.hello(dev, 'peer-0001', null, { glyphs: ['dev'] });
  const joined = other.sent.find((m) => m.t === 'join' && m.id === 'peer-0001');
  other.sent.length = 0;
  await r.raw(dev, JSON.stringify({ t: 'say', text: 'while I hold it' }));
  assert.equal(ofType(other, 'red').length, 1);
  assert.equal(joined?.glyphs?.includes('dev'), true, 'and the glyph was beside the name');

  // the grant lapses: a fresh socket, a token minted without it
  const after = r.connect();
  other.sent.length = 0;
  await r.hello(after, 'peer-0003');
  const lapsed = other.sent.find((m) => m.t === 'join' && m.id === 'peer-0003');
  assert.ok(lapsed, 'the room announced them');
  assert.equal('glyphs' in lapsed, false, 'no glyph beside the name...');
  other.sent.length = 0;
  await r.raw(after, JSON.stringify({ t: 'say', text: 'after it lapsed' }));
  assert.equal(ofType(other, 'red').length, 0, '...and no server line. One fact, not two.');
});

// ── THE CLIENT ──────────────────────────────────────────────────────

test('RED1: the log marks a red line from the relay\'s frame TYPE, and a red line is a system line too', () => {
  const log = new ChatLog();
  const red = log.push('world', { text: 'The realm is closing for repairs.', red: true });
  assert.equal(red.red, true);
  // NOBODY IS SPEAKING IT, so it is a system line by construction -
  // which is what keeps every reader that already knows about system
  // lines (the peek, the bubbles' refusal) correct without being told.
  assert.equal(red.system, true);
  assert.equal(red.id, '');
  assert.equal(red.name, '');
  const plain = log.push('world', { id: 'peer-0001', name: 'Ragnar', text: 'hello' });
  assert.equal(plain.red, false);
  assert.equal(plain.system, false);
  // AND A BUBBLE IS REFUSED, because a bubble stands over a HEAD and
  // this line has nobody's - net/nameLayer.js's bubbleLineOk already
  // refuses a system line, so nothing new had to learn about this one.
  assert.equal(log.push('world', { text: '', red: true }), null, 'an empty broadcast is not a line');
});

test('RED1: the host parses /red and NEVER guards it - the authority is the relay\'s, and a second copy of it here would be wrong the moment a grant lapses', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const red = \/\^\\\/red\\s\+\(\[\\s\\S\]\+\)\$\/i\.exec\(text\.trim\(\)\);/, 'the command');
  assert.match(w, /if \(red\) return chatLinks\.get\(tabId\)\?\.sendRed\(red\[1\]\) \?\? false;/, 'straight to the link');
  const arm = w.slice(w.indexOf('const red = /^'), w.indexOf('return chatLinks.get(tabId)?.sendChat(text)'));
  assert.doesNotMatch(arm, /glyph|dev|wardrobe|title/i, 'the host must not decide who may speak as the server');
  // ...and the SERVER's line lands on the log with the flag set by US,
  // from the frame type - never from a field on the frame.
  assert.match(w, /link\.onRed = \(line\) => chatLog\.push\(tab\.id, \{ text: line\.text, at: line\.at, red: true \}\);/, 'the flag is set here, on a line nobody sent');

  const online = rd('src/net/online.js');
  const recv = online.slice(online.indexOf("} else if (m.t === 'red') {"), online.indexOf("} else if (m.t === 'social') {"));
  assert.match(recv, /this\.onRed\?\.\(\{ text, at:/, 'the session hands it on');
  assert.doesNotMatch(recv, /m\.id|m\.name/, 'a server line has neither, and reading one would invent a speaker');
  assert.match(recv, /chatInGate/, 'CHAT-G: gated COMING IN too - the relay a client talks to is the player\'s own choice');

  // The panel draws it red, and not as an italic aside: the system's
  // notices are asides and this is an announcement.
  const panel = rd('src/ui/chatPanel.js');
  assert.match(panel, /\$\{line\.red \? ' red' : ''\}/, 'the class rides the line');
  assert.match(panel, /\.dfchat-line\.red \.dfchat-text \{ color: #e2453a;[^}]*font-style: normal;/, 'red, and not an italic aside');
});

test('RED1: the wire version moved, because this is a relay change', () => {
  // SLAM8's law reaches this slice like any other: a `say` frame the
  // old relay does not know is a different deployed worker.
  assert.equal(RELAY_VERSION, 'world98');   // world91: QUEST1 + TRADE1 + PEER-FS1; world92: AUDIT DROPS B3/C1/C3; world96: the party-rest drop's pose fields
  assert.match(rd('test/relayversion.test.js'), /world89: '[0-9a-f]{64}'/, 'and its law is recorded');
});
