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
import { parseClient, sanitizeChat, redGate, chatGate, RED_HZ_MAX, CHAT_HZ_MAX, CHAT_MAX, RELAY_VERSION, CHAT_ROOM_HZ_MAX, CHAT_WORLD_ROOM } from '../src/net/wire.js';
import { ChatLog } from '../src/net/chat.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';

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
  // CHAT-CHAN: from any tab, straight to the WORLD link - the one room every player online is in (a red line said in a
  // region's room, or on a tab with no room of its own, would reach a region or nobody)
  assert.match(w, /if \(red\) return chatLinks\.get\('world'\)\?\.sendRed\(red\[1\]\) \?\? false;/, 'straight to the link');
  const arm = w.slice(w.indexOf('const red = /^'), w.indexOf('const mod = parseModCommand(text);'));
  assert.doesNotMatch(arm, /glyph|dev|wardrobe|title/i, 'the host must not decide who may speak as the server');
  // ...and the SERVER's line lands on the log with the flag set by US,
  // from the frame type - never from a field on the frame.
  assert.match(w, /link\.onRed = \(line\) => chatLog\.pushAll\(\{ text: line\.text, at: line\.at, red: true \}\);/, 'the flag is set here, on a line nobody sent (CHAT-CHAN: one line on every tab)');

  const online = rd('src/net/online.js');
  const recv = online.slice(online.indexOf("} else if (m.t === 'red') {"), online.indexOf("} else if (m.t === 'social') {"));
  assert.match(recv, /this\.onRed\?\.\(\{ text, at:/, 'the session hands it on');
  assert.doesNotMatch(recv, /m\.id|m\.name/, 'a server line has neither, and reading one would invent a speaker');
  assert.match(recv, /if \(!this\._lineIn\(room, null, now\)\) return;/, 'CHAT-G: gated COMING IN too - the relay a client talks to is the player\'s own choice (AUDIT 68: through the chat line\'s own door)');
  // ...and DRIVEN, because the pattern above also matches the arm after this one: a flood of red lines from one relay
  // inside one instant reaches the log at the room's own rate and no faster (CHAT-CHAN found the gate's removal
  // surviving that pattern - RED1-12)
  const { FakeWS, sockets } = fakeSocketClass();
  const link = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', presence: false, WebSocketImpl: FakeWS, now: () => 1_000_000 });
  const reds = []; link.onRed = (line) => reds.push(line);
  const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {};
  try {
    link.join(CHAT_WORLD_ROOM); sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: null, world: null, v: RELAY_VERSION });
    for (let i = 0; i < CHAT_ROOM_HZ_MAX + 5; i++) sockets[0].receive({ t: 'red', text: `broadcast ${i}`, at: 1 });
  } finally { console.info = info; console.warn = warn; }
  assert.equal(reds.length, CHAT_ROOM_HZ_MAX, 'the room\'s rate, and the rest dropped');
  assert.equal(link.stats.chatsDropped, 5);

  // The panel draws it red, and not as an italic aside: the system's
  // notices are asides and this is an announcement.
  const panel = rd('src/ui/chatPanel.js');
  assert.match(panel, /\$\{line\.red \? ' red' : ''\}/, 'the class rides the line');
  assert.match(panel, /\.dfchat-line\.red \.dfchat-text \{ color: #e2453a;[^}]*font-style: normal;/, 'red, and not an italic aside');
});

test('RED1: the wire version moved, because this is a relay change', () => {
  // SLAM8's law reaches this slice like any other: a `say` frame the
  // old relay does not know is a different deployed worker.
  assert.equal(RELAY_VERSION, 'world169');   // AUDIT ARENA-LADDER moved it on last (world169: the arena ladder audit - elite champions, telegraphed blows, a judging floor and the attempt ticket - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (world168: the Seraph Wings join the aura vocabulary of the token - a relay before it refuses the token of a developer wearing them); SHADOW-CLOAK moved it on (world167: the Holo Shadow Cloak joins the token's aura vocabulary - a relay before it refuses SirMcMobdon's token once they wear it; world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges); SERPENT2 moved it on (world166: the serpent herald - a serpent site word to the hub, its bells and its kill posted to Discord); SERPENT1 moved it on (world165: the serpent frame - a sea serpent fight in the cell of its site; world162 on its branch, renumbered past PRIMARCH (world162) and SUNBABY1 (world163), then PARTY-LEAD (world164), at the merges); PARTY-LEAD moved it on (world164: the hub's party.lead act - a leader hands the lead to a member); SUNBABY1 moved it on (world163: the hub's live events gain the sun baby's word - LIVE_EVENTS, no frame changes shape); PRIMARCH moved it on (world162: the Primarch's title and glyph and the Golden Radiance's aura join the token's vocabulary - a relay before it refuses GA00250's token); GUILD2 moved it on (world161: no wire change - the guild and heraldry laws moved under the relay); AEGIS moved it on (world160: the Aegis of Oblivion's title and glyph and the Oblivion Ward's aura join the token's vocabulary - a relay before it refuses Sureme's token); ARENA4 moved it on (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main's FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant's name, nm, and a beaten one's kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon's Breach - its words in the omen's lines and the herald's posts, the faithful's rite - main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc's six relays renumbered past main's HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room); SEAT1c moved it on (world145: the seats' titles and glyphs - five generic title ids, a `ts` claim beside them, four glyphs); SEAT1b moved it on (world144: the Watch's tick - a `watch` frame carrying a `k1` receipt the relay signs, net/watchReceipt.js); ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose's climb - `cl`, `cw` and a move's `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the host of the Legion-Lord - the `ahit` blow on one of it, the words `ad`, `amv`, `aatk`, `ah` and `adie` of the room, `lg` in the state, `a` in a chart row, the brain law 5; GATE-HEAL's `heal` and a chart row's `hl` with it - main's HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`, the kills of quest foes a member held for a partner, counted by every copy of the quest); before it GATE-UX moved it on (world136: the damage chart made at the kill - every challenger and their part, ranked, on the `fell` word of the court and on the fall in the state (`dm`)); before it WB9 moved it on (world135: the three courts of the Warden and the Reckoning of Dagon - his court and the walkways laid in the state (`ct`, `xa`), the crystals, their breaking and the stun (`cx`, `cxh`, `cxb`, `stun`, `su`, `rk`) and a blow on a crystal (`xhit`), judged and fanned by the relay - main's PARTY-MAP took world134 first); before it PARTY-MAP moved it on (world134: the `amap` frame, the automap rows a Shared Cartography caster reveals, to the party alone); before it SOFTCAP1 moved it on (world133: the party pose `cl`, a member character level for mentor mode); before it STRIKE-SHARED moved it on (world132: the strike spell on a hit and the trapper on a dead foe, both read by the clients alone); before it MERGE 2 moved it on (world131: the professions branch, BOUNTY1 + AUDIT 28 - `bq` and `lv` on the party pose, `k`, `a` and `t` on a bounty row - world125 on its branch, never deployed, a number VOICE1 took on main); before it REALM-DOOR moved it on (world130: the door refuses a token the account service signed as naming no realm character); before it PENITENT's badge vocabulary (world129); before it WB8 moved it on (world128: marks on the gate state, the fed word - world126 on its branch, never deployed, renumbered past OW6L at the merge); before it OW6L (world127: the overworld ledger of a cell, the ow frame - never world125 (VOICE1, reverted) nor world126 (DISCORD-GATES on its branch)); before it TV8 (world124: the party's Overworld walk - world123 on its branch, renumbered past THE MERGE's); before it THE MERGE (world123: the raids, the gates and Discord - world122 to world126 on their branch, never deployed - one relay past main's TV3); before it TV3 (world122: a region's traveller marks); ONE-SEAT before it (world121 - world119, then world120, on its branch, renumbered past main's AUDIT SET (world119) and PARTY-BUFFS + REST-OPT (world120) at the merges: a hub hello's claim - one tab of an account online); before it PARTY-BUFFS + REST-OPT + the batch audit (world120 - world119, world120 and world121 on their branch, renumbered past main AUDIT SET at the merge: fx, rs and nr on the party pose, TRADE_REV_MAX and REST_OPT_RELAY_MIN named); before it AUDIT SET (world119 - world117 on its branch, renumbered past main's SHADOW-FANG (world117) and OWN1 + INVIS-NET (world118) at the merge: the dungeon foe record carries `v`, the joiner whose blow killed it); OWN1 + INVIS-NET moved it on before (world118 - world114 on its branch, renumbered past main's world114-117: the own lane and the pose's concealment bits); SHADOW-FANG's badge vocabulary moved it on (world117 - world114 on its branch, world116 at its first merge; main's Oblivion Gate WBX took world116 first); the Oblivion Gate's WBX5, AUDIT WBX and AUDIT WBX2 moved it on (world116 - world114 on its branch, renumbered past main's Enhanced Plus patch (world114) and GUILD1c (world115)); world115: GUILD1c's guild frames and guild line (world113 on its branch; main's AUDIT WB and the Enhanced Plus patch took world113 and world114 first); world114: the Enhanced Plus patch's PEERLIGHT1/2 and PEERFX1 pose fields; world113: AUDIT WB's relay half and WB3's gate frame and boss room (world111 and world110 on their branch); PARTY-TRAVEL's party pose fields moved it on (world112 - world110 on its branch); RENOWN1's level and renown frame moved it on (world111 - world108 on its branch; main's HT-WAIST-NET, PROFILE2 and SKIN2, and EVENT1 took world108 to world110 first); world107: DUEL1's duel frame and the card's account stamp; world106: DISC23-B's look; world105: AUDIT 68's relay law; world104: TITLE-N's narrate/dm frame and badge vocabulary; world103: the contributor's dd/rz over the arc's deploy; world102: CHAT-CHAN + DICE1 + EMOTE1 + INSPECT1 + JOURNAL1 + AUDIT ATTACH; world101: DISC12 lh/wb; world100: DISC7 hs; world99: HCC-PARK + RIDE; world98: SPELLFX1; world91: QUEST1 + TRADE1 + PEER-FS1; world92: AUDIT DROPS B3/C1/C3; world96: the party-rest drop's pose fields
  assert.match(rd('test/relayversion.test.js'), /world89: '[0-9a-f]{64}'/, 'and its law is recorded');
});
