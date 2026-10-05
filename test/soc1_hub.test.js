// SOC1 (2026-09-16, Mac: "A social button next to the chat UI, that when tapped opens the new friends list + party
// interface. Players should now be able to friend other users, see if they are online/last online + be able to
// invite friends or other individuals to the new 4 person party system"): THE HUB - the wire's law and the relay's.
//
// WHERE IT LIVES AND WHY. Every player online holds one socket in the world channel (ROSTER-G's "the one room every
// player is in"), so that room's Durable Object is the one place that can see everyone at once, and it keeps the
// social state: accounts, friends, requests, presence and last-seen, parties. A PEER id is a tab's (TABS1) and a
// friend is a person, so a hello to the hub carries an ACCOUNT id and its secret beside the peer's - the same law,
// both guarded - and every frame the hub sends names peers by the ids the presence rooms already show. Presence rooms
// are untouched: a party member's name is green because the hub told MY client which peer ids are my party's.
//
// Driven over the fake Durable Object (test/fakeRoom.mjs), the way every relay pin is; the wire's projections are run
// on plain objects. Each pin names the mutants it kills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RELAY_VERSION, CHAT_WORLD_ROOM, SOCIAL_ROOM, isSocialRoom, SOCIAL_ACTS, NOTE_CODES, SOCIAL_KINDS, SOCIAL_HZ_MAX, SOCIAL_ROOM_HZ_MAX, PARTY_HZ_MAX, PARTY_SEND_MS,
  FRIENDS_MAX, PENDING_MAX, PARTY_MAX, PARTY_INVITES_MAX, INVITE_TTL_MS, PARTY_OFFLINE_MS, ACCOUNT_TABS_MAX, PARTY_LOC_MAX, SOCIAL_ERROR_MAX, MAP_PIXELS_X, MAP_PIXELS_Y, SOCIAL_REPEAT_MS,
  parseClient, validPartyPose, validSocialRow, validPartyView, validInvite, validSocialFrame, validPartyFrame, sanitizeLabel, mintPartyId, socialGate, partyGate,
  FOE_HEALTH_MAX, DROP_STRIKES_MAX, CLOSE_POLICY, FALLBACK_NAME, SEAT_ELSEWHERE,
} from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { ACCT_SEEN_WRITE_MS } from '../server/src/relayScale.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const P = Object.freeze({ px: 100, py: 200, loc: 'Daggerfall', in: 0, h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2 });
const ofKind = (ws, k) => ws.sent.filter((m) => m.t === 'social' && m.k === k);
const lastOf = (ws, k) => ofKind(ws, k).at(-1) ?? null;
const codes = (ws) => ofKind(ws, 'note').map((m) => m.code);
const errors = (ws) => ofKind(ws, 'error').map((m) => m.m);
const poses = (ws) => ws.sent.filter((m) => m.t === 'party');
/** The hub over a driven clock: `tick(ms)` moves it (the social gate refills at SOCIAL_HZ_MAX a second, so acts from one socket sit ~600 ms apart). */
async function withHub(fn, key = SOCIAL_ROOM) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tick = (ms = 600) => { clock += ms; };
  const act = (ws, o) => r.raw(ws, JSON.stringify({ t: 'social', ...o }));
  const pose = (ws, p = P) => r.raw(ws, JSON.stringify({ t: 'party', p }));
  /** A hello with an account: peer `peer-<n>`, account `acct-<n>`, name `<n>`. */
  const join = async (n, extra = {}) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, ...extra }); tick(10); return ws; };
  const now = () => clock;
  try { await fn({ r, act, pose, join, tick, now }); } finally { Date.now = realNow; }
}
/** Every frame the hub sent this socket passes the door its client reads through. */
function doorHolds(ws, tag) {
  for (const m of ws.sent) {
    if (m.t === 'social') assert.ok(validSocialFrame(m), `${tag}: the client's door refused a hub frame: ${JSON.stringify(m)}`);
    else if (m.t === 'party') assert.ok(validPartyFrame(m), `${tag}: the client's door refused a party frame: ${JSON.stringify(m)}`);
  }
}

// ---------------------------------------------------------------- THE WIRE ----------------------------------------------------------------

test('SOC1 wire: the hub is the world channel, the bounds are what Mac asked for, and the version moved (mutants: the hub a room of its own that nobody is in; a five-seat party; the version left at world77)', () => {
  assert.equal(SOCIAL_ROOM, CHAT_WORLD_ROOM, 'the one room every player online is in');
  assert.ok(isSocialRoom('chat:world')); assert.ok(!isSocialRoom('world:1,2')); assert.ok(!isSocialRoom('chat:trade')); assert.ok(!isSocialRoom(null));
  assert.equal(PARTY_MAX, 8, 'PARTY8 (2026-09-22, Mac: "increase the party limit to 8") over "the new 4 person party system"');
  assert.ok(FRIENDS_MAX >= 32 && PENDING_MAX >= 8 && PARTY_INVITES_MAX >= PARTY_MAX, 'room to be popular');
  assert.ok(INVITE_TTL_MS >= 60_000 && INVITE_TTL_MS <= 10 * 60_000, 'an invite stands for minutes, not for ever');
  assert.ok(PARTY_OFFLINE_MS >= 60_000, 'a refresh keeps a seat');
  assert.ok(PARTY_SEND_MS * PARTY_HZ_MAX >= 1000, 'the client\'s floor never trips the relay\'s gate');
  assert.equal(RELAY_VERSION, 'world170', 'FEUD moved it on last (world170: the foe record\'s wind-ups, staggers and blow classes and a revenant\'s adaptations, weakness, last stand, band follower, blows and signature - TELL8, AUDIT TELL, RVN13 and FEUD WIRE, world162-world165 on its branch, renumbered past main\'s world169 at its merge); AUDIT ARENA-LADDER moved it on (world169: the arena ladder audit - elite champions, telegraphed blows, a judging floor and the attempt ticket - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (world168: the Seraph Wings join the aura vocabulary of the token - a relay before it refuses the token of a developer wearing them); SHADOW-CLOAK moved it on (world167: the Holo Shadow Cloak joins the token\'s aura vocabulary - a relay before it refuses SirMcMobdon\'s token once they wear it; world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges); SERPENT2 moved it on (world166: the serpent herald - a serpent site word to the hub, its bells and its kill posted to Discord); SERPENT1 moved it on (world165: the serpent frame - a sea serpent fight in the cell of its site; world162 on its branch, renumbered past PRIMARCH (world162) and SUNBABY1 (world163), then PARTY-LEAD (world164), at the merges); PARTY-LEAD moved it on (world164: the hub\'s party.lead act - a leader hands the lead to a member); SUNBABY1 moved it on (world163: the hub\'s live events gain the sun baby\'s word - LIVE_EVENTS, no frame changes shape); PRIMARCH moved it on (world162: the Primarch\'s title and glyph and the Golden Radiance\'s aura join the token\'s vocabulary - a relay before it refuses GA00250\'s token); GUILD2 moved it on (world161: no wire change - the guild and heraldry laws moved under the relay); AEGIS moved it on (world160: the Aegis of Oblivion\'s title and glyph and the Oblivion Ward\'s aura join the token\'s vocabulary - a relay before it refuses Sureme\'s token); ARENA4 moved it on (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main\'s FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant\'s name, nm, and a beaten one\'s kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon\'s Breach - its words in the omen\'s lines and the herald\'s posts, the faithful\'s rite - main\'s CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc\'s six relays renumbered past main\'s HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room); SEAT1c moved it on (world145: the seats\' titles and glyphs - five generic title ids, a `ts` claim beside them, four glyphs); SEAT1b moved it on (world144: the Watch\'s tick - a `watch` frame carrying a `k1` receipt the relay signs, net/watchReceipt.js); ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose\'s climb - `cl`, `cw` and a move\'s `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the host of the Legion-Lord - the `ahit` blow on one of it, the words `ad`, `amv`, `aatk`, `ah` and `adie` of the room, `lg` in the state, `a` in a chart row, the brain law 5; GATE-HEAL\'s `heal` and a chart row\'s `hl` with it - main\'s HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`, the kills of quest foes a member held for a partner, counted by every copy of the quest); before it GATE-UX moved it on (world136: the damage chart made at the kill - every challenger and their part, ranked, on the `fell` word of the court and on the fall in the state (`dm`)); before it WB9 moved it on (world135: the three courts of the Warden and the Reckoning of Dagon - his court and the walkways laid in the state (`ct`, `xa`), the crystals, their breaking and the stun (`cx`, `cxh`, `cxb`, `stun`, `su`, `rk`) and a blow on a crystal (`xhit`), judged and fanned by the relay - main\'s PARTY-MAP took world134 first); before it PARTY-MAP moved it on (world134: the `amap` frame, the automap rows a Shared Cartography caster reveals, to the party alone); before it SOFTCAP1 moved it on (world133: the party pose `cl`, a member character level for mentor mode); before it STRIKE-SHARED moved it on (world132: the strike spell on a hit and the trapper on a dead foe, both read by the clients alone); before it MERGE 2 moved it on (world131: the professions branch, BOUNTY1 + AUDIT 28 - `bq` and `lv` on the party pose, `k`, `a` and `t` on a bounty row - world125 on its branch, never deployed, a number VOICE1 took on main); before it REALM-DOOR moved it on (world130: the door refuses a token the account service signed as naming no realm character); before it PENITENT\'s badge vocabulary (world129); before it WB8 moved it on (world128: marks on the gate state, the fed word - world126 on its branch, never deployed, renumbered past OW6L at the merge); before it OW6L (world127: the overworld ledger of a cell, the ow frame - never world125 (VOICE1, reverted) nor world126 (DISCORD-GATES on its branch)); before it TV8 (world124: the party\'s Overworld walk - world123 on its branch, renumbered past THE MERGE\'s); before it THE MERGE (world123: the raids, the gates and Discord - world122 to world126 on their branch, never deployed - one relay past main\'s TV3); before it TV3 (world122: a region\'s traveller marks); ONE-SEAT before it (world121 - world119, then world120, on its branch, renumbered past main\'s AUDIT SET (world119) and PARTY-BUFFS + REST-OPT (world120) at the merges: a hub hello\'s claim - one tab of an account online); before it PARTY-BUFFS + REST-OPT + the batch audit (world120 - world119, world120 and world121 on their branch, renumbered past main AUDIT SET at the merge: fx, rs and nr on the party pose, TRADE_REV_MAX and REST_OPT_RELAY_MIN named); before it AUDIT SET (world119 - world117 on its branch, renumbered past main\'s SHADOW-FANG (world117) and OWN1 + INVIS-NET (world118) at the merge: the dungeon foe record carries `v`, the joiner whose blow killed it); OWN1 + INVIS-NET moved it on before (world118 - world114 on its branch, renumbered past main\'s world114-117: the own lane and the pose\'s concealment bits); SHADOW-FANG\'s badge vocabulary moved it on (world117 - world114 on its branch, world116 at its first merge; main\'s Oblivion Gate WBX took world116 first); the Oblivion Gate\'s WBX5, AUDIT WBX and AUDIT WBX2 moved it on (world116 - world114 on its branch, renumbered past main\'s Enhanced Plus patch (world114) and GUILD1c (world115)); GUILD1c (world115 - world113 on its branch) last; the Enhanced Plus patch (world114) before it; AUDIT WB and WB3 (world113 - world111 and world110 on their branch) before it; PARTY-TRAVEL (world112 - world110 on its branch) before it; RENOWN1 (world111 - world108 on its branch) before it; EVENT1 (world110) before it; SKIN2 (world109), HT-WAIST-NET (world108) and DUEL1 (world107) before it; DISC23-B (world106) and AUDIT 68 (the relay\'s own law, world105) before it; TITLE-N (world104), before it CHAT-CHAN + DICE1 + EMOTE1 + INSPECT1 + JOURNAL1 + AUDIT ATTACH (the chat\'s channel, roll and emote frames, the card, the page, the meters off the attachment - world102); DISC12 (the pose\'s hand lh and beast form wb - world101); DISC7 (hs - world100); HCC-PARK + RIDE (the park frame and the pose\'s riding fields - world99); SPELLFX1 (the pose\'s cast element and arrows loosed - world98); PARTY-REST DROP (the pose\'s rest kind, the vote and cancel stamps, the 32-bit building key - world96); AUDIT DROPS (the trade bytes per sender, the hub\'s quest cooldown, the quest budget\'s order - world92); QUEST1 + TRADE1 + PEER-FS1 (three drops, one deploy: the quest frame, the trade frame, the pose\'s fk - world91); SOC1 changed the relay: bumped; AUDIT SOC again; RESPAWN1 again (the foe door\'s team pair); AUDIT WATCH1 again (wire.js gained CELL_WATCH_PUPPETS_MAX); the main merge again (a comment line in wire.js moved - the bytes are the law)');
  assert.deepEqual(Object.keys(SOCIAL_ACTS), ['friend.request', 'friend.accept', 'friend.decline', 'friend.cancel', 'friend.remove', 'party.invite', 'party.accept', 'party.decline', 'party.leave', 'party.kick', 'party.lead']);   // PARTY-LEAD (world164): the lead handed on
  assert.deepEqual(SOCIAL_KINDS, ['state', 'presence', 'party', 'invite', 'note', 'error']);
  assert.ok(NOTE_CODES.includes('party.joined') && NOTE_CODES.includes('friend.requested') && NOTE_CODES.includes('party.leader') && NOTE_CODES.includes('party.lapsed'));
  assert.equal(MAP_PIXELS_X, 1000); assert.equal(MAP_PIXELS_Y, 500);
  assert.ok(/^q[a-z0-9]+$/.test(mintPartyId(() => 0.5, 1e12)) && mintPartyId(() => 0.5, 1e12).length <= 40, 'a party id the wire\'s id law admits');
});

test('SOC1 wire: the hello carries an account - both or neither (mutants: the secret optional, which is an unguarded account; the account admitted on a bad id; the keys added to a hello that named none, which breaks every older hello pin)', () => {
  const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
  const base = { t: 'hello', id: 'peer-0001', secret: 'secret-of-peer-0001', name: 'Mac', look, pose: null };
  const plain = parseClient(JSON.stringify(base));
  assert.deepEqual(plain, { t: 'hello', id: 'peer-0001', secret: 'secret-of-peer-0001', name: 'Mac', look, pose: null }, 'no account named: the old shape, no acct key at all');
  assert.ok(!('acct' in plain) && !('asecret' in plain));
  const withAcct = parseClient(JSON.stringify({ ...base, acct: 'acct-0001', asecret: 'secret-of-acct-0001' }));
  assert.equal(withAcct.acct, 'acct-0001'); assert.equal(withAcct.asecret, 'secret-of-acct-0001');
  for (const bad of [{ acct: 'acct-0001' }, { asecret: 'secret-of-acct-0001' }, { acct: 'ab', asecret: 'secret-of-acct-0001' }, { acct: 'acct-0001', asecret: 'short' }, { acct: 7, asecret: 'secret-of-acct-0001' }, { acct: 'acct 0001', asecret: 'secret-of-acct-0001' }])
    assert.deepEqual(parseClient(JSON.stringify({ ...base, ...bad })), { error: 'bad account' }, JSON.stringify(bad));
});

test('SOC1 wire: a social act names exactly what its kind needs (mutants: a target by both acct and peer; a kick with no acct; an unknown kind admitted; an act before the hello)', () => {
  const pc = (o, hasHello = true) => parseClient(JSON.stringify({ t: 'social', ...o }), { hasHello });
  assert.deepEqual(pc({ k: 'friend.request', peer: 'peer-0002' }), { t: 'social', k: 'friend.request', peer: 'peer-0002' });
  assert.deepEqual(pc({ k: 'friend.request', acct: 'acct-0002' }), { t: 'social', k: 'friend.request', acct: 'acct-0002' });
  assert.deepEqual(pc({ k: 'friend.request', acct: 'acct-0002', peer: 'peer-0002' }), { error: 'bad social' }, 'one of the two, never both');
  assert.deepEqual(pc({ k: 'friend.request' }), { error: 'bad social' }, 'never neither');
  assert.deepEqual(pc({ k: 'party.invite', peer: 'peer-0002', party: 'q123456' }), { t: 'social', k: 'party.invite', peer: 'peer-0002' }, 'a field the kind does not need is dropped');
  for (const k of ['friend.accept', 'friend.decline', 'friend.cancel', 'friend.remove', 'party.kick']) {
    assert.deepEqual(pc({ k, acct: 'acct-0002' }), { t: 'social', k, acct: 'acct-0002' });
    assert.deepEqual(pc({ k, peer: 'peer-0002' }), { error: 'bad social' }, `${k} names an account, never a peer`);
    assert.deepEqual(pc({ k }), { error: 'bad social' });
  }
  for (const k of ['party.accept', 'party.decline']) { assert.deepEqual(pc({ k, party: 'q1234567' }), { t: 'social', k, party: 'q1234567' }); assert.deepEqual(pc({ k }), { error: 'bad social' }); }
  assert.deepEqual(pc({ k: 'party.leave' }), { t: 'social', k: 'party.leave' });
  assert.deepEqual(pc({ k: 'party.leave', acct: 'acct-0002' }), { t: 'social', k: 'party.leave' });
  for (const bad of ['', 'a', 'x'.repeat(41), 'no spaces', 7, null]) assert.deepEqual(pc({ k: 'friend.accept', acct: bad }), { error: 'bad social' }, JSON.stringify(bad));
  assert.deepEqual(pc({ k: 'friend.befriend', acct: 'acct-0002' }), { error: 'bad social' });
  assert.deepEqual(pc({ k: 7 }), { error: 'bad social' });
  assert.deepEqual(pc({ k: 'party.leave' }, false), { error: 'social before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'party', p: P }), { hasHello: true }), { t: 'party', p: validPartyPose(P) });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'party', p: { ...P, h: -1 } }), { hasHello: true }), { error: 'bad party' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'party', p: P })), { error: 'party before hello' });
});

test('SOC1 wire: a party pose is projected by its own law - the map pixel clamped, the vitals bounded and rounded, the place a label, the portrait by the look\'s bounds; refused whole (mutants: a vital past FOE_HEALTH_MAX admitted; a fraction on a bar; the place unfiltered; a record half landed)', () => {
  const p = validPartyPose(P);
  assert.deepEqual(p, { px: 100, py: 200, in: 0, loc: 'Daggerfall', h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2, bk: null, rest: null, restEnemyAt: null, restPending: null, ready: false, readyAt: null, voteAt: null, restCancelFor: null, restCancelAt: null, restStartedAt: null });
  assert.deepEqual(validPartyPose(p), p, 'idempotent');
  assert.deepEqual(validPartyPose({ ...P, px: 5000, py: -3 }), null, 'a negative pixel is no pixel');
  assert.equal(validPartyPose({ ...P, px: 5000.7 }).px, MAP_PIXELS_X - 1, 'clamped to the map');
  assert.equal(validPartyPose({ ...P, py: 499.9 }).py, 499);
  for (const k of ['h', 'hm', 'f', 'fm', 'm', 'mm']) {
    assert.equal(validPartyPose({ ...P, [k]: FOE_HEALTH_MAX + 1 }), null, `${k} past the bound`);
    assert.equal(validPartyPose({ ...P, [k]: 'x' }), null); assert.equal(validPartyPose({ ...P, [k]: NaN }), null); assert.equal(validPartyPose({ ...P, [k]: undefined }), null, `${k} is required`);
    assert.equal(validPartyPose({ ...P, [k]: 12.6 })[k], 13, 'rounded');
  }
  assert.equal(validPartyPose({ ...P, in: 2 }).in, 2); assert.equal(validPartyPose({ ...P, in: 1 }).in, 1); assert.equal(validPartyPose({ ...P, in: 9 }).in, 0); assert.equal(validPartyPose({ ...P, in: undefined }).in, 0);
  assert.equal(validPartyPose({ ...P, loc: '  Privateer\'s   Hold' + String.fromCharCode(0) + ' ' }).loc, 'Privateer\'s Hold', 'a label: printable ASCII, collapsed, trimmed');
  assert.equal(validPartyPose({ ...P, loc: 'x'.repeat(80) }).loc.length, PARTY_LOC_MAX);
  assert.equal(validPartyPose({ ...P, loc: undefined }).loc, ''); assert.equal(validPartyPose({ ...P, loc: 7 }).loc, '7');
  assert.equal(validPartyPose({ ...P, loc: 'cunt' }).loc, '', 'the name filter runs on a place a modified client could write');
  assert.equal(validPartyPose({ ...P, race: 'Not a race' }).race, 'Breton'); assert.equal(validPartyPose({ ...P, gender: 'other' }).gender, 'male'); assert.equal(validPartyPose({ ...P, face: 99 }).face, 9); assert.equal(validPartyPose({ ...P, face: undefined }).face, 0);
  for (const bad of [null, 7, 'x', [], { ...P, px: undefined }]) assert.equal(validPartyPose(bad), null);
  assert.equal(sanitizeLabel('the hub stumbled - try again', SOCIAL_ERROR_MAX, { filter: false }), 'the hub stumbled - try again');
  assert.equal(sanitizeLabel('x'.repeat(200), SOCIAL_ERROR_MAX, { filter: false }).length, SOCIAL_ERROR_MAX);
});

test('PARTY-REST1 wire: `bk` only means anything indoors, and `rest` is refused WHOLE on one bad number, never best-effort (mutants: bk kept outside or in a dungeon; a rest object with one bad field landing anyway; the mode enum accepting an out-of-range number; the hour clamps missing)', () => {
  // bk: real outside a building, null everywhere else - including a real 0, the
  // sentinel a mischievous client might send FOR "outside" to smuggle an
  // in-bounds key past a check that used 0 as its own "absent" reading.
  assert.equal(validPartyPose({ ...P, in: 2, bk: 5 }).bk, 5);
  assert.equal(validPartyPose({ ...P, in: 2, bk: 0 }).bk, 0, 'a real building key of 0 is not the same thing as absent');
  assert.equal(validPartyPose({ ...P, in: 2, bk: undefined }).bk, null);
  assert.equal(validPartyPose({ ...P, in: 2, bk: -1 }).bk, null, 'not a real key (uint refuses negative, same as px/py)');
  assert.equal(validPartyPose({ ...P, in: 0, bk: 5 }).bk, null, 'outside, a sent key is dropped, not trusted');
  assert.equal(validPartyPose({ ...P, in: 1, bk: 5 }).bk, null, 'a dungeon has no building key either');
  // rest: absent or null is a valid, ordinary pose (a stale client, or simply
  // not resting) - never refused for lacking it.
  assert.equal(validPartyPose({ ...P, rest: undefined }).rest, null);
  assert.equal(validPartyPose({ ...P, rest: null }).rest, null);
  const rest = { mode: 1, hoursRemaining: 4, totalHours: 2 };
  assert.deepEqual(validPartyPose({ ...P, rest }).rest, { ...rest, kind: null }, 'kind defaults to null, same law as ready/restPending - absent is its own ordinary value, never a refusal');
  // PARTY-REST4 (2026-09-21, per-request: "15m away from the leader do not change the healrate party member
  // MUST heal their health near the leader"): the leader's own live REST_KIND (systems/survival/rest.js),
  // broadcast so a follower's mirror can inherit the SAME rest quality instead of guessing their own.
  for (const kind of ['bed', 'camp', 'rough']) assert.equal(validPartyPose({ ...P, rest: { ...rest, kind } }).rest.kind, kind);
  assert.equal(validPartyPose({ ...P, rest: { ...rest, kind: null } }).rest.kind, null, 'survival mode off, or simply not yet resolved - a valid, ordinary value, never a refusal');
  assert.equal(validPartyPose({ ...P, rest: { ...rest, kind: 'bunk' } }), null, 'an unrecognised kind refuses the WHOLE pose, same law as a bad mode/hours');
  for (const mode of [0, 2]) assert.equal(validPartyPose({ ...P, rest: { ...rest, mode } }).rest.mode, mode);
  // refused WHOLE: one bad field inside `rest` refuses the POSE, not just
  // that field - a follower's mirror would otherwise have to guess the rest
  // of a half-landed session.
  for (const bad of [{ ...rest, mode: 3 }, { ...rest, mode: 'x' }, { ...rest, mode: undefined },
    { ...rest, hoursRemaining: 'x' }, { ...rest, hoursRemaining: NaN }, { ...rest, hoursRemaining: undefined },
    { ...rest, totalHours: 'x' }, { ...rest, totalHours: undefined }, 7, 'x', []]) {
    assert.equal(validPartyPose({ ...P, rest: bad }), null, `${JSON.stringify(bad)} refuses the whole pose`);
  }
  // clamped, not refused, same law as the vitals above.
  assert.equal(validPartyPose({ ...P, rest: { ...rest, hoursRemaining: -3 } }).rest.hoursRemaining, 0);
  assert.equal(validPartyPose({ ...P, rest: { ...rest, hoursRemaining: 500 } }).rest.hoursRemaining, 99, 'clamped to restSession.js\'s own MAX_REST_HOURS');
  assert.equal(validPartyPose({ ...P, rest: { ...rest, hoursRemaining: 4.6 } }).rest.hoursRemaining, 5, 'rounded, same as the vitals');
  assert.deepEqual(validPartyPose(validPartyPose({ ...P, rest })), validPartyPose({ ...P, rest }), 'idempotent with a rest object riding along');
});

test('PARTY-REST2 wire: `restPending` (the leader\'s proposal) is refused WHOLE on one bad field, same law as `rest`; `ready` is a plain, always-present boolean, never null (mutants: a half-landed proposal; ready defaulting to true; a stray truthy value passing as ready)', () => {
  assert.equal(validPartyPose({ ...P, restPending: undefined }).restPending, null);
  assert.equal(validPartyPose({ ...P, restPending: null }).restPending, null);
  const pending = { mode: 1, hours: 6 };
  assert.deepEqual(validPartyPose({ ...P, restPending: pending }).restPending, pending);
  for (const mode of [0, 2]) assert.equal(validPartyPose({ ...P, restPending: { ...pending, mode } }).restPending.mode, mode);
  for (const bad of [{ ...pending, mode: 3 }, { ...pending, mode: undefined }, { ...pending, hours: 'x' }, { ...pending, hours: NaN }, { ...pending, hours: undefined }, 7, 'x', []]) {
    assert.equal(validPartyPose({ ...P, restPending: bad }), null, `${JSON.stringify(bad)} refuses the whole pose`);
  }
  assert.equal(validPartyPose({ ...P, restPending: { ...pending, hours: -3 } }).restPending.hours, 0);
  assert.equal(validPartyPose({ ...P, restPending: { ...pending, hours: 500 } }).restPending.hours, 99);
  assert.equal(validPartyPose({ ...P, ready: true }).ready, true);
  assert.equal(validPartyPose({ ...P, ready: false }).ready, false);
  assert.equal(validPartyPose({ ...P, ready: undefined }).ready, false, 'absent reads as not ready, never true');
  for (const truthy of [1, 'yes', {}, []]) assert.equal(validPartyPose({ ...P, ready: truthy }).ready, false, `${JSON.stringify(truthy)} is not the literal true`);
});

test('SOC1 wire: the client\'s door on a hub frame - every kind projected, a bad row refuses the frame whole, a list is cut at its bound, a leader who is no member is no party, a note is a known code (mutants: a name unsanitized; a 1000-peer row; the party view admitted with a stranger for leader; the state applied half)', () => {
  const row = { acct: 'acct-0002', name: 'Bravo', online: true, seen: 1e12, peers: ['peer-0002'] };
  assert.deepEqual(validSocialRow(row), row);
  assert.deepEqual(validSocialRow({ acct: 'acct-0002', name: 'cunt', online: 1, seen: -5, peers: ['peer-0002', 'bad id', 'peer-0002', 7] }), { acct: 'acct-0002', name: FALLBACK_NAME, online: true, seen: null, peers: ['peer-0002'] }, 'the name through sanitizeName, a bad seen null, bad and repeated peers dropped');
  assert.equal(validSocialRow({ acct: 'acct-0002', peers: Array.from({ length: 50 }, (_, i) => `peer-${String(i).padStart(4, '0')}`) }).peers.length, ACCOUNT_TABS_MAX);
  assert.equal(validSocialRow({ name: 'x' }), null); assert.equal(validSocialRow(null), null);
  const member = { ...row, p: validPartyPose(P) };
  const view = { id: 'q1234567', leader: 'acct-0002', members: [member, { acct: 'acct-0003', name: 'Charlie', online: false, seen: 5, peers: [], p: null }] };
  assert.deepEqual(validPartyView(view), view);
  assert.equal(validPartyView({ ...view, leader: 'acct-0009' }), null, 'the leader is a member');
  assert.equal(validPartyView({ ...view, members: Array.from({ length: PARTY_MAX + 1 }, (_, i) => ({ ...member, acct: `acct-${String(i + 10).padStart(4, '0')}` })) }), null, 'more than PARTY_MAX is no party');
  assert.equal(validPartyView({ ...view, members: [member, { acct: 'acct-0003', p: { px: 1 } }] }), null, 'a bad pose on one member refuses the view');
  const invite = { party: 'q1234567', from: { acct: 'acct-0002', name: 'Bravo' }, members: [{ acct: 'acct-0002', name: 'Bravo' }], at: 1e12, expires: 1e12 + INVITE_TTL_MS };
  assert.deepEqual(validInvite(invite), invite);
  assert.equal(validInvite({ ...invite, expires: undefined }), null); assert.equal(validInvite({ ...invite, members: [{ acct: 'x' }] }), null);
  const state = { t: 'social', k: 'state', acct: 'acct-0001', name: 'Alpha', peers: ['peer-0001', 'peer-0011'], friends: [row], in: [{ ...row, at: 1e12 }], out: [], party: view, invites: [invite] };
  assert.deepEqual(validSocialFrame(state), state);
  assert.deepEqual(validSocialFrame({ t: 'social', k: 'state', acct: 'acct-0001' }), { t: 'social', k: 'state', acct: 'acct-0001', name: FALLBACK_NAME, peers: [], friends: [], in: [], out: [], party: null, invites: [] }, 'lists absent are lists empty');
  assert.deepEqual(validSocialFrame({ ...state, peers: ['peer-0001', 'bad id', 'peer-0001', 7] }).peers, ['peer-0001'], 'AUDIT SOC C20: my own tabs\' ids by the row\'s law - bad and repeated dropped');
  assert.equal(validSocialFrame({ ...state, peers: Array.from({ length: 50 }, (_, i) => `peer-${String(i).padStart(4, '0')}`) }).peers.length, ACCOUNT_TABS_MAX);
  assert.equal(validSocialFrame({ ...state, in: [row] }), null, 'a pending row without its stamp refuses the frame whole');
  assert.equal(validSocialFrame({ ...state, friends: [row, { name: 'nobody' }] }), null);
  assert.equal(validSocialFrame({ ...state, party: { id: 'q1' } }), null, 'a bad party refuses the frame, it does not read as no party');
  assert.equal(validSocialFrame({ ...state, friends: 'x' }), null);
  assert.equal(validSocialFrame({ ...state, friends: Array.from({ length: FRIENDS_MAX + 5 }, (_, i) => ({ acct: `acct-${String(i).padStart(4, '0')}` })) }).friends.length, FRIENDS_MAX, 'cut at the bound');
  assert.deepEqual(validSocialFrame({ t: 'social', k: 'presence', ...row }), { t: 'social', k: 'presence', ...row });
  assert.deepEqual(validSocialFrame({ t: 'social', k: 'party', party: null }), { t: 'social', k: 'party', party: null });
  assert.deepEqual(validSocialFrame({ t: 'social', k: 'party', party: view }), { t: 'social', k: 'party', party: view });
  assert.equal(validSocialFrame({ t: 'social', k: 'party', party: { id: 'q1' } }), null);
  assert.deepEqual(validSocialFrame({ t: 'social', k: 'invite', ...invite }), { t: 'social', k: 'invite', ...invite });
  assert.deepEqual(validSocialFrame({ t: 'social', k: 'note', code: 'party.joined', acct: 'acct-0002', name: 'Bravo' }), { t: 'social', k: 'note', code: 'party.joined', acct: 'acct-0002', name: 'Bravo' });
  assert.deepEqual(validSocialFrame({ t: 'social', k: 'note', code: 'party.joined' }), { t: 'social', k: 'note', code: 'party.joined', acct: null, name: null });
  assert.equal(validSocialFrame({ t: 'social', k: 'note', code: 'party.exploded' }), null, 'a code the client has no words for');
  assert.deepEqual(validSocialFrame({ t: 'social', k: 'error', m: 'the party is full' }), { t: 'social', k: 'error', m: 'the party is full' });
  assert.equal(validSocialFrame({ t: 'social', k: 'error', m: '' }), null); assert.equal(validSocialFrame({ t: 'social', k: 'error', m: 'x'.repeat(500) }).m.length, SOCIAL_ERROR_MAX);
  for (const bad of [null, { t: 'social' }, { t: 'social', k: 'wat' }, { t: 'chat', k: 'state' }, [], 'x']) assert.equal(validSocialFrame(bad), null);
  assert.deepEqual(validPartyFrame({ t: 'party', acct: 'acct-0002', p: P }), { t: 'party', acct: 'acct-0002', p: validPartyPose(P) });
  assert.equal(validPartyFrame({ t: 'party', acct: 'acct-0002', p: { px: 1 } }), null); assert.equal(validPartyFrame({ t: 'party', p: P }), null); assert.equal(validPartyFrame({ t: 'social', acct: 'acct-0002', p: P }), null);
  assert.equal(socialGate(null, 0).pass, true); assert.equal(partyGate(null, 0).pass, true);
  let b = null; let passed = 0; for (let i = 0; i < 10; i++) { const g = socialGate(b, 0); b = g.bucket; if (g.pass) passed++; } assert.equal(passed, SOCIAL_HZ_MAX, 'a burst is the rate');
});

// ---------------------------------------------------------------- THE HUB ----------------------------------------------------------------

// FRIENDS-SYNC (FIELD BUGS 2026-10-01 part five, "My friend list is different between devices"): THE HUB ACCOUNT IS THE
// TOKEN'S SUBJECT. It was the browser profile's id (net/social.js accountId), so a laptop and a desktop were two
// accounts; the profile pair (`acct`, `asecret`) is now a legacy credential, merged into the player's once when its
// secret matches (test/fb1001_friendsync.test.js). This harness's `join` signs the very account it names (fakeRoom:
// `s: over.acct`), so its hellos keep the profile's own law - the secret minted, then guarded. What changed here: the
// "thief" holds its OWN token now - a hello carrying someone else's profile pair is that player, seated as itself, and
// nothing of the pair's is taken; a SECOND TAB of an account is not a second socket of it in the hub any more
// (ONE-SEAT: one hub tab a subject) but a claim that moves the seat.
test('SOC1 hub: the hello with an account - the record made with the name and seen, the whole picture to THIS socket alone, the profile\'s secret minted then guarded, a hello naming none is the old chat with no social word; FRIENDS-SYNC: another player\'s profile pair seats THAT player as itself, and a second device takes the seat by its claim (mutants: the picture to everyone; the account admitted on a wrong secret; a profile merged on a wrong secret; a build before this slice refused)', () => withHub(async ({ r, act, join, tick }) => {
  const a = await join('a');
  assert.equal(r.store.get('asecret:acct-a'), 'secret-of-acct-a', 'the first hello mints the account\'s secret (the token names the profile id itself: the profile law)');
  assert.deepEqual(r.store.get('acct:acct-a'), { name: 'a', seen: 1e12, friends: [], in: [], out: [], invites: [], party: null }, 'the record');
  assert.equal(a.sent[0].t, 'welcome', 'the welcome first, so the session resets before its picture lands');
  assert.deepEqual(lastOf(a, 'state'), { t: 'social', k: 'state', acct: 'acct-a', name: 'a', peers: ['peer-a'], friends: [], in: [], out: [], party: null, invites: [] }, 'AUDIT SOC C20: the picture names the ids my own tabs stand as');
  assert.equal(a.att.acct, 'acct-a', 'the account rides the attachment'); assert.equal(a.att.party, null);
  const plain = r.connect(); await r.hello(plain, 'peer-p', null, { name: 'Plain' }); tick();
  assert.deepEqual(plain.sent.map((m) => m.t), ['welcome'], 'no account named: the chat as it was, and not one social frame');
  assert.equal(plain.att.acct, undefined);
  await act(plain, { k: 'party.leave' });
  assert.deepEqual(errors(plain), ['no account'], 'an act from a socket with no account is refused in words, not closed');
  assert.equal(plain.closed, null);
  assert.equal(ofKind(a, 'state').length, 1, 'a\'s picture was a\'s alone - the second hello sent a nothing');
  // FRIENDS-SYNC: a's profile pair with the wrong secret, from ANOTHER player (its own token) - that player, as itself
  const thief = r.connect(); await r.hello(thief, 'peer-t', null, { name: 'Thief', tokenSub: 'acct-thief', acct: 'acct-a', asecret: 'not-the-secret-of-a' }); tick();
  assert.equal(thief.sent[0].t, 'welcome'); assert.deepEqual(errors(thief), [], 'nothing refused: the token says who this is'); assert.equal(thief.closed, null, 'the chat works');
  assert.equal(thief.att.acct, 'acct-thief', 'seated as ITS OWN account - the subject, never the pair it carried');
  assert.deepEqual(lastOf(thief, 'state'), { t: 'social', k: 'state', acct: 'acct-thief', name: 'Thief', peers: ['peer-t'], friends: [], in: [], out: [], party: null, invites: [] }, 'its own picture, empty');
  assert.equal(r.store.get('asecret:acct-a'), 'secret-of-acct-a', 'the secret stands - a wrong secret merges nothing and retires nothing');
  assert.deepEqual(r.store.get('acct:acct-a'), { name: 'a', seen: 1e12, friends: [], in: [], out: [], invites: [], party: null }, 'and a\'s record is untouched');
  assert.equal(r.store.has('asecret:acct-thief'), false, 'a subject\'s account needs no secret of its own - the token is its proof');
  assert.ok(!a.closed && ofKind(a, 'state').length === 1, 'a never heard of it');
  // the same account from a second tab or device: a CLAIM (ONE-SEAT) - the first tab goes, the seat and the name move
  const a2 = r.connect(); await r.hello(a2, 'peer-a2', null, { name: 'a-renamed', acct: 'acct-a', asecret: 'secret-of-acct-a', cl: 1 }); tick();
  assert.equal(a.closed?.reason, SEAT_ELSEWHERE, 'the older tab is closed - one hub tab a player');
  assert.equal(lastOf(a2, 'state').name, 'a-renamed', 'the record takes the latest hello\'s name');
  assert.deepEqual(lastOf(a2, 'state').peers, ['peer-a2'], 'AUDIT SOC C20: the picture names the tab my seat stands as - the closed one is not among them');
  assert.equal(r.store.get('acct:acct-a').name, 'a-renamed');
  assert.equal(ofKind(a, 'state').length, 1, 'the first tab\'s picture is not re-sent by the second tab\'s hello');
  // the profile law's guard, where the token names the profile id itself: the wrong secret is told, and no account rides
  const wrong = r.connect(); await r.hello(wrong, 'peer-w', null, { name: 'a', acct: 'acct-a', asecret: 'not-the-secret-of-a', cl: 1 }); tick();
  assert.equal(wrong.sent[0].t, 'welcome'); assert.deepEqual(errors(wrong), ['account taken']); assert.equal(wrong.closed, null, 'the chat still works');
  assert.equal(wrong.att.acct, undefined, 'no account: the social arms answer "no account" to it');
  assert.equal(r.store.get('acct:acct-a').name, 'a-renamed', 'and the record was not renamed by it');
  doorHolds(a, 'a'); doorHolds(a2, 'a2'); doorHolds(thief, 'thief'); doorHolds(wrong, 'wrong');
}));

// FRIENDS-SYNC (FIELD BUGS 2026-10-01 part five): with one hub tab a subject, the only OTHER socket an account can have at
// its hello is one a claim just closed, which the runtime lists until the close completes (AUDIT ONESEAT R4) - so that
// is where "the picture to THIS socket alone" is still pinned.
test('SOC1 hub: the picture is THIS socket\'s alone - FRIENDS-SYNC: the tab a claim closed, which the runtime still lists, is not even tried with it (mutant: the picture to every tab of the account)', () => withHub(async ({ r, join, tick }) => {
  const a = await join('a');
  const tried = [];
  const send = a.send;
  a.send = function (s) { tried.push(JSON.parse(s)); return send.call(this, s); };
  a.close = function (code, reason) { this.closed = { code, reason }; };   // closed by the object, still listed
  const a2 = r.connect(); await r.hello(a2, 'peer-a2', null, { name: 'a', acct: 'acct-a', asecret: 'secret-of-acct-a', cl: 1 }); tick();
  assert.equal(tried.find((m) => m.t === 'error')?.m, SEAT_ELSEWHERE, 'the claim told the first tab, and closed it');
  assert.ok(a.closed && r.sockets.includes(a), 'closed, and still listed');
  assert.equal(ofKind(a2, 'state').length, 1, 'the claiming tab has its picture');
  assert.deepEqual(tried.filter((m) => m.t === 'social' && m.k === 'state'), [], 'and the closed tab was not even tried with it');
  doorHolds(a2, 'a2');
}));

test('SOC1 hub: friends - a request by PEER or by ACCOUNT, the inbox and the outbox both told with a note, accept makes friends both ways, decline and cancel are quiet, remove is mutual, and a request back is a yes (mutants: the request to nobody; the note to the sender; a one-sided friendship; the mutual request left pending)', () => withHub(async ({ r, act, join, tick, now }) => {
  const a = await join('a'), b = await join('b'), c = await join('c');
  await act(a, { k: 'friend.request', peer: 'peer-b' }); tick();
  assert.deepEqual(lastOf(b, 'state').in, [{ acct: 'acct-a', name: 'a', online: false, seen: null, peers: [], at: now() - 600 }], 'b\'s inbox names a - the name and nothing else (AUDIT SOC A6: a request is not a friendship; presence and the live peer ids are what a friendship grants)');
  assert.deepEqual(lastOf(a, 'state').out, [{ acct: 'acct-b', name: 'b', online: false, seen: null, peers: [], at: now() - 600 }], 'and a\'s outbox names b the same way - an unaccepted request tracked its target');
  assert.deepEqual(lastOf(a, 'state').out.map((e) => e.acct), ['acct-b'], 'a\'s outbox');
  assert.deepEqual(codes(b), ['friend.requested']); assert.deepEqual(codes(a), [], 'the note is the receiver\'s');
  assert.deepEqual(lastOf(b, 'note'), { t: 'social', k: 'note', code: 'friend.requested', acct: 'acct-a', name: 'a' });
  assert.equal(ofKind(c, 'state').length, 1, 'c hears nothing of it');
  await act(a, { k: 'friend.request', peer: 'peer-b' }); tick();
  assert.deepEqual(errors(a), ['already asked']);
  await act(b, { k: 'friend.accept', acct: 'acct-a' }); tick();
  assert.deepEqual(lastOf(a, 'state').friends.map((f) => f.acct), ['acct-b']); assert.deepEqual(lastOf(b, 'state').friends.map((f) => f.acct), ['acct-a']);
  assert.deepEqual(lastOf(a, 'state').out, []); assert.deepEqual(lastOf(b, 'state').in, []);
  assert.deepEqual(codes(a), ['friend.accepted']); assert.equal(lastOf(a, 'note').acct, 'acct-b');
  assert.deepEqual(r.store.get('acct:acct-a').friends, ['acct-b']); assert.deepEqual(r.store.get('acct:acct-b').friends, ['acct-a']);
  await act(a, { k: 'friend.request', acct: 'acct-b' }); tick(); assert.equal(errors(a).at(-1), 'already friends');
  await act(b, { k: 'friend.accept', acct: 'acct-a' }); tick(); assert.equal(errors(b).at(-1), 'no such request');
  // AUDIT SOC A6: a stranger is asked BY PEER - met in the world; by account alone is 'meet them first', nothing read and nothing told
  await act(c, { k: 'friend.request', acct: 'acct-a' }); tick(); assert.equal(errors(c).at(-1), 'meet them first');
  assert.deepEqual(lastOf(a, 'state').in, [], 'a heard nothing of it');
  // decline: c asks a, a declines - both pictures updated, no note
  await act(c, { k: 'friend.request', peer: 'peer-a' }); tick();
  assert.deepEqual(lastOf(a, 'state').in.map((e) => e.acct), ['acct-c']);
  const notesBefore = codes(c).length;
  await act(a, { k: 'friend.decline', acct: 'acct-c' }); tick();
  assert.deepEqual(lastOf(a, 'state').in, []); assert.deepEqual(lastOf(c, 'state').out, [], 'c\'s outbox emptied'); assert.equal(codes(c).length, notesBefore, 'quietly');
  // AUDIT SOC A1: asked again inside SOCIAL_REPEAT_MS - 'already asked', and a hears nothing (a request and its cancel were a 40x amplifier aimed at one player)
  const aHeard = a.sent.length;
  await act(c, { k: 'friend.request', peer: 'peer-a' }); tick(); assert.equal(errors(c).at(-1), 'already asked');
  assert.equal(a.sent.length, aHeard, 'nothing reached a'); assert.deepEqual(r.store.get('acct:acct-a').in, [], 'nothing written');
  tick(SOCIAL_REPEAT_MS);
  // cancel: c asks again and thinks better of it
  await act(c, { k: 'friend.request', peer: 'peer-a' }); tick();
  assert.deepEqual(lastOf(a, 'state').in.map((e) => e.acct), ['acct-c'], 'past the window it lands');
  await act(c, { k: 'friend.cancel', acct: 'acct-a' }); tick();
  assert.deepEqual(lastOf(a, 'state').in, []); assert.deepEqual(lastOf(c, 'state').out, []);
  await act(c, { k: 'friend.cancel', acct: 'acct-a' }); tick(); assert.equal(errors(c).at(-1), 'no such request');
  // mutual: c asks a, then a asks c - that is a yes (a request back BY ACCOUNT is the one by-account request there is)
  tick(SOCIAL_REPEAT_MS);
  await act(c, { k: 'friend.request', peer: 'peer-a' }); tick();
  await act(a, { k: 'friend.request', acct: 'acct-c' }); tick();
  assert.deepEqual(lastOf(a, 'state').friends.map((f) => f.acct).sort(), ['acct-b', 'acct-c']); assert.deepEqual(lastOf(c, 'state').friends.map((f) => f.acct), ['acct-a']);
  assert.equal(codes(c).at(-1), 'friend.accepted');
  // remove: mutual
  await act(a, { k: 'friend.remove', acct: 'acct-c' }); tick();
  assert.deepEqual(lastOf(a, 'state').friends.map((f) => f.acct), ['acct-b']); assert.deepEqual(lastOf(c, 'state').friends, []);
  await act(a, { k: 'friend.remove', acct: 'acct-c' }); tick(); assert.equal(errors(a).at(-1), 'not a friend');
  // the refusals in words
  await act(a, { k: 'friend.request', peer: 'peer-a' }); tick(); assert.equal(errors(a).at(-1), 'that is you');
  await act(a, { k: 'friend.request', acct: 'acct-a' }); tick(); assert.equal(errors(a).at(-1), 'that is you');
  await act(a, { k: 'friend.request', peer: 'peer-zzzz' }); tick(); assert.equal(errors(a).at(-1), 'they are not online');
  await act(a, { k: 'friend.request', acct: 'acct-never' }); tick(); assert.equal(errors(a).at(-1), 'meet them first', 'AUDIT SOC A6: an id nobody ever said hello with is answered as any stranger\'s is - the hub is no oracle of which ids exist');
  assert.equal(r.store.has('acct:acct-never'), false, 'and mints no record');
  const plain = r.connect(); await r.hello(plain, 'peer-p', null, { name: 'Plain' }); tick();
  await act(a, { k: 'friend.request', peer: 'peer-p' }); tick(); assert.equal(errors(a).at(-1), 'they have no account');
  for (const ws of [a, b, c]) assert.equal(ws.closed, null, 'a refusal in words closes nothing');
  doorHolds(a, 'a'); doorHolds(b, 'b'); doorHolds(c, 'c');
}));

test('SOC1 hub: the bounds - FRIENDS_MAX either side, PENDING_MAX out and PENDING_MAX in, refused in words (mutants: the cap on one side alone; the inbox unbounded)', () => withHub(async ({ r, act, join, tick, now }) => {
  const a = await join('a'), b = await join('b');
  const filler = (n) => Array.from({ length: n }, (_, i) => `acct-x${i}`);
  // AUDIT SOC A5: the awake object keeps the records it has read, so a record written behind its back is read on the next wake
  const set = (id, patch) => { r.store.set(`acct:${id}`, { ...r.store.get(`acct:${id}`), ...patch }); r.wake(); };
  set('acct-a', { friends: filler(FRIENDS_MAX) });
  await act(a, { k: 'friend.request', peer: 'peer-b' }); tick(); assert.equal(errors(a).at(-1), 'your friend list is full');
  set('acct-a', { friends: [] });
  set('acct-b', { friends: filler(FRIENDS_MAX) });
  await act(a, { k: 'friend.request', peer: 'peer-b' }); tick(); assert.equal(errors(a).at(-1), 'their friend list is full');
  set('acct-b', { friends: [] });
  set('acct-a', { out: filler(PENDING_MAX).map((acct) => ({ acct, at: now() })) });
  await act(a, { k: 'friend.request', peer: 'peer-b' }); tick(); assert.equal(errors(a).at(-1), 'too many requests out');
  set('acct-a', { out: [] });
  set('acct-b', { in: filler(PENDING_MAX).map((acct) => ({ acct, at: now() })) });
  await act(a, { k: 'friend.request', peer: 'peer-b' }); tick(); assert.equal(errors(a).at(-1), 'their inbox is full');
  set('acct-b', { in: [] });
  await act(a, { k: 'friend.request', peer: 'peer-b' }); tick(); assert.deepEqual(lastOf(b, 'state').in.map((e) => e.acct), ['acct-a'], 'under the bounds it lands - the refusals before it stamped no cooldown (AUDIT SOC A1: a refused act is no act)');
  // accept refused when a list filled meanwhile
  set('acct-b', { friends: filler(FRIENDS_MAX) });
  await act(b, { k: 'friend.accept', acct: 'acct-a' }); tick(); assert.equal(errors(b).at(-1), 'your friend list is full');
  doorHolds(a, 'a'); doorHolds(b, 'b');
}));

// FRIENDS-SYNC (FIELD BUGS 2026-10-01 part five): two tabs of one account in the hub at once is gone - the account is
// the token's subject and ONE-SEAT keeps one hub tab a subject - so "the first of two tabs leaving" is now the old tab a
// second device's CLAIM closes. The law is the same: last-seen is stamped when the account's LAST socket goes, and a
// seat that moved is not a logout.
test('SOC1 hub: presence - a friend\'s hello and leave reach its friends alone, with the peer ids its tabs stand as; last-seen is stamped when the LAST tab goes and not before - FRIENDS-SYNC: a second device\'s claim closes the first and the friends see the seat move, never a logout; a stranger hears nothing (mutants: presence to the whole room; seen stamped on the first of two tabs leaving; the peer list stale)', () => withHub(async ({ r, act, join, tick, now }) => {
  const a = await join('a'), b = await join('b'), c = await join('c');
  await act(a, { k: 'friend.request', peer: 'peer-b' }); tick(); await act(b, { k: 'friend.accept', acct: 'acct-a' }); tick();
  const before = ofKind(a, 'presence').length;
  const atMove = now();
  const b2 = r.connect(); await r.hello(b2, 'peer-b2', null, { name: 'b', acct: 'acct-b', asecret: 'secret-of-acct-b', cl: 1 }); tick();
  assert.equal(b.closed?.reason, SEAT_ELSEWHERE, 'the claim closed b\'s first tab');
  assert.deepEqual(lastOf(a, 'presence'), { t: 'social', k: 'presence', acct: 'acct-b', name: 'b', online: true, seen: atMove, peers: ['peer-b2'] }, 'the friend hears the peer id the seat stands as now - a friend marks me in the world by it');
  assert.ok(ofKind(a, 'presence').length > before, 'told');
  assert.ok(ofKind(a, 'presence').slice(before).every((f) => f.online && !f.peers.includes('peer-b')), 'and never offline in between, never the closed tab - the seat moved, nobody logged out');
  assert.equal(ofKind(c, 'presence').length, 0, 'c is nobody\'s friend and hears no presence');
  const seenAtB2 = r.store.get('acct:acct-b').seen;
  // SCALE2b re-aimed this line: the record took EVERY hello's clock, a storage write per hub hello whose only news was
  // the time. It is written when it holds news, or when its stamp is ACCT_SEEN_WRITE_MS stale - so b2's hello, minutes
  // after b's, wrote nothing; the leave below stamps it, and an online row reads the frame's clock (the line after next)
  assert.ok(seenAtB2 < atMove && atMove - seenAtB2 < ACCT_SEEN_WRITE_MS, 'the record keeps b\'s first hello\'s clock - b2\'s hello had no news for it - and the closed tab\'s leave stamped nothing over it');
  // AUDIT QS6 F7's FOURTH CATCH, and it turned out to be a mutant with no
  // victim. `S13-seen-stamped-on-first-tab` SURVIVED once the sweep made
  // every record apply again, so the question was what stamping `next`
  // unconditionally would COST - and the answer is nothing: the store is
  // written only when the last tab goes (`if (gone) await
  // this._putAcct(...)`, pinned by the line above) and a friend's
  // presence row never reads `rec.seen` while the account is online
  // (`_rowOf`: `seen: socks.length ? now : rec.seen`). So the record is
  // marked EQUIVALENT with that reasoning rather than pinned by a claim
  // the code does not make. What is asserted here is the law itself.
  assert.equal(lastOf(a, 'presence').seen, atMove,
    'an ONLINE account\'s row reads the clock AT THE FRAME, never the record - `seen` is what you say about somebody who is not here');
  tick(5000);
  await r.drop(b2); tick();
  assert.deepEqual(lastOf(a, 'presence'), { t: 'social', k: 'presence', acct: 'acct-b', name: 'b', online: false, seen: now() - 600, peers: [] }, 'the last tab gone: offline, last seen now');
  assert.ok(r.store.get('acct:acct-b').seen > seenAtB2, 'stamped on the record');
  assert.equal(ofKind(c, 'presence').length, 0);
  doorHolds(a, 'a'); doorHolds(c, 'c');
}));

test('SOC1 hub: the party - an invite by peer makes the party with me in the seat, the invited is handed the invite, a yes seats them and everyone hears the view; four seats and no more; an invite lapses; a no is told to the asker (mutants: the party unmade; the invite frame to the room; a fifth seat; a lapsed invite honoured)', () => withHub(async ({ r, act, join, tick, now }) => {
  const a = await join('a'), b = await join('b'), c = await join('c'), d = await join('d'), e = await join('e');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick();
  const pid = lastOf(b, 'invite').party;
  assert.ok(pid && r.store.get('party:' + pid), 'a party record, made by the first invite');
  assert.deepEqual(r.store.get('party:' + pid).members, ['acct-a']); assert.equal(r.store.get('party:' + pid).leader, 'acct-a');
  assert.deepEqual(lastOf(a, 'party').party, { id: pid, leader: 'acct-a', members: [{ acct: 'acct-a', name: 'a', online: true, seen: now() - 600, peers: ['peer-a'], p: null }] }, 'the maker sees a party of one');
  assert.deepEqual(lastOf(b, 'invite'), { t: 'social', k: 'invite', party: pid, from: { acct: 'acct-a', name: 'a' }, members: [{ acct: 'acct-a', name: 'a' }], at: now() - 600, expires: now() - 600 + INVITE_TTL_MS });
  assert.deepEqual(codes(a), ['party.invited']); assert.equal(lastOf(a, 'note').acct, 'acct-b');
  assert.equal(ofKind(c, 'invite').length, 0, 'the invite is the invited\'s alone');
  assert.equal(a.att.party, pid, 'the seat rides the attachment');
  await act(b, { k: 'party.accept', party: pid }); tick();
  assert.deepEqual(lastOf(a, 'party').party.members.map((m) => m.acct), ['acct-a', 'acct-b']);
  assert.deepEqual(lastOf(b, 'state').party.members.map((m) => m.acct), ['acct-a', 'acct-b'], 'the joiner\'s picture carries the party');
  assert.deepEqual(lastOf(b, 'state').invites, [], 'and the invite is spent');
  assert.deepEqual(codes(a), ['party.invited', 'party.joined']); assert.equal(b.att.party, pid);
  await act(b, { k: 'party.accept', party: pid }); tick(); assert.equal(errors(b).at(-1), 'no such invite');
  // AUDIT SOC A6: a stranger is invited BY PEER - met in the world; by account alone is for a friend (who sees my presence anyway), or 'they are not online' would answer any id
  await act(b, { k: 'party.invite', acct: 'acct-c' }); tick(); assert.equal(errors(b).at(-1), 'meet them first'); assert.equal(ofKind(c, 'invite').length, 0);
  // any member may invite; every seat the bound allows fills (PARTY8: eight); the one past it is refused
  await act(b, { k: 'party.invite', peer: 'peer-c' }); tick(); await act(c, { k: 'party.accept', party: pid }); tick();
  await act(a, { k: 'party.invite', peer: 'peer-d' }); tick(); await act(d, { k: 'party.accept', party: pid }); tick();
  const extra = [];
  for (let i = 4; i < PARTY_MAX; i++) {
    const x = await join(`x${i}`); extra.push(x);
    await act(a, { k: 'party.invite', peer: `peer-x${i}` }); tick(); await act(x, { k: 'party.accept', party: pid }); tick();
  }
  assert.equal(lastOf(a, 'party').party.members.length, PARTY_MAX);
  await act(a, { k: 'party.invite', peer: 'peer-e' }); tick(); assert.equal(errors(a).at(-1), 'the party is full');
  await act(a, { k: 'party.invite', peer: 'peer-d' }); tick(); assert.equal(errors(a).at(-1), 'already in your party');
  assert.equal(ofKind(e, 'invite').length, 0);
  // an invite that lapses: d leaves, e is invited, the clock runs past INVITE_TTL_MS, the yes is refused and the picture shed
  await act(d, { k: 'party.leave' }); tick();
  await act(a, { k: 'party.invite', peer: 'peer-e' }); tick();
  assert.equal(lastOf(e, 'invite').party, pid);
  // AUDIT SOC A8: invited again inside SOCIAL_REPEAT_MS - 'already asked', no second invite frame, the party's invite list unchanged
  const invitesAtE = ofKind(e, 'invite').length, partyInvites = JSON.stringify(r.store.get('party:' + pid).invites);
  await act(a, { k: 'party.invite', peer: 'peer-e' }); tick(); assert.equal(errors(a).at(-1), 'already asked');
  assert.equal(ofKind(e, 'invite').length, invitesAtE); assert.equal(JSON.stringify(r.store.get('party:' + pid).invites), partyInvites);
  tick(INVITE_TTL_MS);
  await act(e, { k: 'party.accept', party: pid }); tick();
  assert.equal(errors(e).at(-1), 'that invite has lapsed'); assert.deepEqual(lastOf(e, 'state').invites, []); assert.deepEqual(lastOf(e, 'state').party, null);
  // a no, told to the asker (the lapse ran the cooldown out: INVITE_TTL_MS is past SOCIAL_REPEAT_MS)
  assert.ok(INVITE_TTL_MS > SOCIAL_REPEAT_MS, 'an invite that lapsed may be sent again');
  await act(a, { k: 'party.invite', peer: 'peer-e' }); tick();
  await act(e, { k: 'party.decline', party: pid }); tick();
  assert.equal(codes(a).at(-1), 'party.declined'); assert.equal(lastOf(a, 'note').acct, 'acct-e');
  assert.deepEqual(lastOf(e, 'state').invites, []);
  assert.equal(r.store.get('party:' + pid).invites.some((i) => i.acct === 'acct-e'), false, 'the party\'s invite gone too');
  await act(e, { k: 'party.decline', party: pid }); tick(); assert.equal(errors(e).at(-1), 'no such invite');
  await act(e, { k: 'party.invite', peer: 'peer-zz' }); tick(); assert.equal(errors(e).at(-1), 'they are not online', 'no party is made for an invite that names nobody');
  assert.equal(e.att.party, null); assert.equal([...r.store.keys()].filter((k) => k.startsWith('party:')).length, 1);
  for (const ws of [a, b, c, d, e]) doorHolds(ws, 'party');
}));

test('SOC1 hub: the party - leave passes the seat to the longest-standing member, the last one out dissolves it; kick is the leader\'s alone and the kicked is told; a yes to another party is a no to the old (mutants: the seat passed to the newest; an empty party kept; anyone kicking; two parties at once)', () => withHub(async ({ r, act, join, tick }) => {
  const a = await join('a'), b = await join('b'), c = await join('c');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick(); await act(b, { k: 'party.accept', party: lastOf(b, 'invite').party }); tick();
  await act(a, { k: 'party.invite', peer: 'peer-c' }); tick(); await act(c, { k: 'party.accept', party: lastOf(c, 'invite').party }); tick();
  const pid = a.att.party;
  await act(b, { k: 'party.kick', acct: 'acct-c' }); tick(); assert.equal(errors(b).at(-1), 'only the leader can do that');
  await act(a, { k: 'party.kick', acct: 'acct-a' }); tick(); assert.equal(errors(a).at(-1), 'that is you');
  await act(a, { k: 'party.kick', acct: 'acct-zz' }); tick(); assert.equal(errors(a).at(-1), 'they are not in your party');
  await act(a, { k: 'party.kick', acct: 'acct-c' }); tick();
  assert.deepEqual(lastOf(c, 'party'), { t: 'social', k: 'party', party: null }); assert.equal(codes(c).at(-1), 'party.kicked'); assert.equal(lastOf(c, 'note').acct, 'acct-c', 'the note\'s subject is the kicked');
  assert.equal(c.att.party, null); assert.equal(r.store.get('acct:acct-c').party, null);
  assert.deepEqual(lastOf(b, 'party').party.members.map((m) => m.acct), ['acct-a', 'acct-b']); assert.equal(codes(b).at(-1), 'party.kicked'); assert.equal(lastOf(b, 'note').acct, 'acct-c');
  // the leader leaves: b, the longest-standing of the rest, leads (a's re-invite of c waits out the cooldown - AUDIT SOC A8)
  tick(SOCIAL_REPEAT_MS);
  await act(a, { k: 'party.invite', peer: 'peer-c' }); tick(); await act(c, { k: 'party.accept', party: lastOf(c, 'invite').party }); tick();
  await act(a, { k: 'party.leave' }); tick();
  assert.deepEqual(lastOf(a, 'party'), { t: 'social', k: 'party', party: null }); assert.equal(a.att.party, null);
  assert.equal(lastOf(b, 'party').party.leader, 'acct-b'); assert.deepEqual(lastOf(b, 'party').party.members.map((m) => m.acct), ['acct-b', 'acct-c']);
  assert.deepEqual(codes(b).slice(-2), ['party.left', 'party.leader']); assert.equal(ofKind(b, 'note').at(-1).acct, 'acct-b');
  assert.equal(r.store.get('party:' + pid).leader, 'acct-b');
  await act(a, { k: 'party.leave' }); tick(); assert.equal(errors(a).at(-1), 'you are not in a party');
  // a yes to another party is a no to the old: a makes a new party and invites c
  tick(SOCIAL_REPEAT_MS);
  await act(a, { k: 'party.invite', peer: 'peer-c' }); tick();
  const pid2 = a.att.party; assert.notEqual(pid2, pid);
  await act(c, { k: 'party.accept', party: pid2 }); tick();
  assert.deepEqual(lastOf(c, 'state').party.members.map((m) => m.acct), ['acct-a', 'acct-c']);
  assert.deepEqual(lastOf(b, 'party').party.members.map((m) => m.acct), ['acct-b'], 'the old party is b alone'); assert.equal(codes(b).at(-1), 'party.left');
  assert.equal(r.store.get('acct:acct-c').party, pid2);
  // the last one out dissolves it
  await act(b, { k: 'party.leave' }); tick();
  assert.equal(r.store.has('party:' + pid), false, 'an empty party is deleted');
  assert.equal(r.store.get('acct:acct-b').party, null);
  for (const ws of [a, b, c]) doorHolds(ws, 'party2');
}));

test('SOC1 hub: the party pose - kept on the attachment, fanned to the party\'s other members alone (never back, never to a stranger), and carried in the next view (mutants: the fan to the room; the sender\'s own back; the view without `p`)', () => withHub(async ({ r, act, pose, join, tick }) => {
  const a = await join('a'), b = await join('b'), c = await join('c');
  await pose(a); tick();
  assert.deepEqual(a.att.pm, { ...validPartyPose(P), at: 1e12 + 30 }, 'kept before any party - the seat I may yet take reads it');
  assert.equal(poses(b).length, 0, 'no party: fanned to no one');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick(); await act(b, { k: 'party.accept', party: lastOf(b, 'invite').party }); tick();
  assert.deepEqual(lastOf(b, 'state').party.members[0].p, validPartyPose(P), 'the joiner\'s view carries a\'s pose from before the party');
  const P2 = { ...P, px: 300, h: 12 };
  await pose(b, P2); tick();
  assert.deepEqual(poses(a).at(-1), { t: 'party', acct: 'acct-b', p: validPartyPose(P2) });
  assert.equal(poses(b).length, 0, 'never back to the sender');
  assert.equal(poses(c).length, 0, 'never to a stranger');
  // b moves to a second device - FRIENDS-SYNC (FIELD BUGS 2026-10-01 part five): one hub tab a subject (ONE-SEAT), so a
  // second tab of b is a CLAIM that closes the first, never a second socket beside it; the seat and its pose move with it
  // (the closed tab stays LISTED, as a runtime lists a socket the object closed until the close completes - AUDIT
  // ONESEAT R4 - so "never back to my own account" is still asked of every socket the account has: nothing is tried on it)
  const tried = [];
  const send = b.send;
  b.send = function (s) { tried.push(JSON.parse(s)); return send.call(this, s); };
  b.close = function (code, reason) { this.closed = { code, reason }; };
  const b2 = r.connect(); await r.hello(b2, 'peer-b2', null, { name: 'b', acct: 'acct-b', asecret: 'secret-of-acct-b', cl: 1 }); tick();
  assert.equal(tried.find((m) => m.t === 'error')?.m, SEAT_ELSEWHERE, 'the claim told the first tab');
  assert.ok(b.closed && r.sockets.includes(b), 'and closed it - still listed');
  assert.equal(b2.att.party, a.att.party, 'the claiming tab sits in the seat');
  assert.equal(poses(b2).length, 0);
  const views = ofKind(a, 'party').length;
  await pose(b2, { ...P, px: 7 }); tick();
  assert.equal(poses(a).at(-1).p.px, 7, 'the new tab speaks for the seat');
  assert.deepEqual(tried.filter((m) => m.t === 'party'), [], 'and its pose is never fanned back to its own account - not even tried on the tab the claim closed');
  assert.equal(ofKind(a, 'party').length, views, 'a pose is a pose frame, never a fresh view - the view a holds is from before; the next view says 7');
  await act(c, { k: 'party.invite', peer: 'peer-a' }); tick();   // c's own party, a invited - a stays put, c's fan reaches nobody
  await pose(c); tick(); assert.equal(poses(a).filter((m) => m.acct === 'acct-c').length, 0);
  await act(a, { k: 'party.leave' }); tick();
  await act(a, { k: 'party.invite', peer: 'peer-c' }); tick();
  await act(c, { k: 'party.accept', party: a.att.party }); tick();
  assert.equal(lastOf(a, 'party').party.members.find((m) => m.acct === 'acct-c').p.px, 100, 'c\'s pose from before rides its view');
  await pose(a, { ...P, px: 9 }); tick();
  assert.equal(poses(c).at(-1).p.px, 9); assert.equal(poses(b).filter((m) => m.acct === 'acct-a').length, 0, 'b hears nothing of a now they share no party');
  for (const ws of [a, b, b2, c]) doorHolds(ws, 'pose');
}));

test('SOC1 hub: a seat is kept PARTY_OFFLINE_MS for a member that dropped - the view says offline, a hello inside the window takes the seat straight back, past it the seat lapses on the next party event and the rest are told (mutants: the seat lost on the drop; the seat kept for ever; the lapse never applied)', () => withHub(async ({ r, act, pose, join, tick, now }) => {
  const a = await join('a'), b = await join('b');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick(); await act(b, { k: 'party.accept', party: lastOf(b, 'invite').party }); tick();
  const pid = a.att.party;
  await r.drop(b); tick();
  assert.deepEqual(lastOf(a, 'party').party.members.map((m) => [m.acct, m.online, m.peers]), [['acct-a', true, ['peer-a']], ['acct-b', false, []]], 'the view says b is away');
  assert.equal(r.store.get('party:' + pid).away['acct-b'], now() - 600);
  const b2 = r.connect(); await r.hello(b2, 'peer-b2', null, { name: 'b', acct: 'acct-b', asecret: 'secret-of-acct-b' }); tick();
  assert.deepEqual(lastOf(b2, 'state').party.members.map((m) => m.acct), ['acct-a', 'acct-b'], 'back inside the window: the seat is b\'s');
  assert.deepEqual(r.store.get('party:' + pid).away, {}, 'the away stamp cleared');
  assert.equal(lastOf(a, 'party').party.members[1].online, true);
  await r.drop(b2); tick();
  tick(PARTY_OFFLINE_MS);
  assert.deepEqual(r.store.get('party:' + pid).members, ['acct-a', 'acct-b'], 'nothing has happened yet: the seat stands until the next event');
  await pose(a); tick();   // a's party pose is the next event
  assert.deepEqual(r.store.get('party:' + pid).members, ['acct-a'], 'lapsed');
  assert.equal(codes(a).at(-1), 'party.lapsed'); assert.equal(lastOf(a, 'note').acct, 'acct-b');
  assert.deepEqual(lastOf(a, 'party').party.members.map((m) => m.acct), ['acct-a']);
  assert.equal(r.store.get('acct:acct-b').party, pid, 'b\'s record still points at it - cleared on b\'s next hello');
  const b3 = r.connect(); await r.hello(b3, 'peer-b3', null, { name: 'b', acct: 'acct-b', asecret: 'secret-of-acct-b' }); tick();
  assert.equal(lastOf(b3, 'state').party, null, 'the seat is gone'); assert.equal(r.store.get('acct:acct-b').party, null); assert.equal(b3.att.party, null);
  // the leader lapsing: the seat passes
  await act(a, { k: 'party.invite', peer: 'peer-b3' }); tick(); await act(b3, { k: 'party.accept', party: a.att.party }); tick();
  const pid2 = a.att.party;
  await r.drop(a); tick(); tick(PARTY_OFFLINE_MS);
  await pose(b3); tick();
  assert.equal(r.store.get('party:' + pid2).leader, 'acct-b'); assert.deepEqual(codes(b3).slice(-2), ['party.lapsed', 'party.leader']);
  doorHolds(a, 'a'); doorHolds(b3, 'b3');
}));

test('SOC1 hub: the gates - SOCIAL_HZ_MAX a socket (over it dropped, a strike counted, closed past DROP_STRIKES_MAX), SOCIAL_ROOM_HZ_MAX the room (over it "busy", nobody struck), PARTY_HZ_MAX the poses; outside the hub both frames are junk (mutants: the act ungated; the room budget missing; a cell taking party poses)', () => withHub(async ({ r, act, pose, join, tick }) => {
  const a = await join('a'), b = await join('b');
  for (let i = 0; i < SOCIAL_HZ_MAX + 3; i++) await act(a, { k: 'party.leave' });
  assert.equal(errors(a).length, SOCIAL_HZ_MAX, 'a burst is the rate; the rest are dropped without a word');
  assert.equal(a.meters.sdrops, 3); assert.equal(a.closed, null);
  for (let i = 0; i < DROP_STRIKES_MAX; i++) await act(a, { k: 'party.leave' });
  assert.deepEqual(a.closed, { code: CLOSE_POLICY, reason: 'too many social acts' }, 'a socket that keeps sending is closed');
  // the room's budget: every socket together, a fresh bucket's worth after the clock has run
  const socks = [];
  for (let i = 0; i < SOCIAL_ROOM_HZ_MAX + 4; i++) socks.push(await join(`r${i}`));
  tick(2000);
  let busy = 0, answered = 0;
  for (const ws of socks) { await act(ws, { k: 'party.leave' }); const e = errors(ws).at(-1); if (e === 'busy') busy++; else if (e === 'you are not in a party') answered++; }
  assert.equal(answered, SOCIAL_ROOM_HZ_MAX, 'the room answers its rate');
  assert.equal(busy, 4, 'and says busy past it'); for (const ws of socks) assert.equal(ws.closed, null);
  // party poses: their own gate
  tick(2000);
  for (let i = 0; i < PARTY_HZ_MAX + 2; i++) await pose(b);
  assert.equal(b.meters.pdrops, 2); assert.equal(b.closed, null);
  // outside the hub: junk, counted, closed past the strikes
  await withHub(async (cell) => {
    const w = cell.r.connect(); await cell.r.hello(w, 'peer-w', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, { acct: 'acct-w', asecret: 'secret-of-acct-w' }); cell.tick();
    assert.deepEqual(w.sent.map((m) => m.t), ['welcome', 'parks'], 'a cell keeps no account and says no social word (HCC-PARK: its welcome is followed by the cell\'s parked teams, an empty list included - not a social word)');
    assert.equal(w.att.acct, undefined);
    await cell.act(w, { k: 'party.leave' }); cell.tick(); await cell.pose(w); cell.tick();
    assert.equal(w.meters.junk, 2, 'junk, counted'); assert.equal(errors(w).length, 0);
    for (let i = 0; i < DROP_STRIKES_MAX; i++) { await cell.pose(w); cell.tick(); }
    assert.deepEqual(w.closed, { code: CLOSE_POLICY, reason: 'too many frames' });
  }, 'world:1,1');
}));

test('SOC1 hub: a hibernation between acts loses nothing - the accounts and the party in storage, the seat and the pose on the attachments (mutants: the party on the instance alone; the account index never rebuilt)', () => withHub(async ({ r, act, pose, join, tick, now }) => {
  const a = await join('a'), b = await join('b');
  await act(a, { k: 'friend.request', peer: 'peer-b' }); tick();
  r.wake();
  await act(b, { k: 'friend.accept', acct: 'acct-a' }); tick();
  assert.deepEqual(lastOf(a, 'state').friends.map((f) => f.acct), ['acct-b']);
  await act(a, { k: 'party.invite', acct: 'acct-b' }); tick();   // a friend: by account is allowed (AUDIT SOC A6)
  r.wake();
  await act(b, { k: 'party.accept', party: lastOf(b, 'invite').party }); tick();
  await pose(a); tick();
  r.wake();
  await pose(b, { ...P, px: 3 }); tick();
  assert.equal(poses(a).at(-1).p.px, 3, 'the fan reads the party from storage after the wake');
  r.wake();
  await act(a, { k: 'party.leave' }); tick();
  assert.deepEqual(lastOf(b, 'party').party.members.map((m) => m.acct), ['acct-b']); assert.equal(lastOf(b, 'party').party.members[0].p.px, 3, 'the pose on the attachment survived the wake');
  r.wake();
  await r.drop(b);
  assert.equal(r.store.get('acct:acct-b').seen, now(), 'the leave after a wake still stamps the record');
  doorHolds(a, 'a'); doorHolds(b, 'b');
}));

test('SOC1 hub: the sweep - a drain forgets the parties and never an account or its secret; a member back after a drain finds no party and its pointer cleared (mutants: acct: swept with the looks; party: kept for ever)', () => withHub(async ({ r, act, join, tick }) => {
  const a = await join('a'), b = await join('b');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick(); await act(b, { k: 'party.accept', party: lastOf(b, 'invite').party }); tick();
  const pid = a.att.party;
  await r.drop(a); tick(); await r.drop(b); tick();
  const keys = [...r.store.keys()];
  assert.ok(keys.includes('acct:acct-a') && keys.includes('asecret:acct-a') && keys.includes('acct:acct-b'), 'accounts stay');
  assert.ok(!keys.includes('party:' + pid), 'the party went with the drain');
  assert.ok(!keys.some((k) => k.startsWith('secret:') || k.startsWith('look:')), 'and the looks and secrets, as always');
  assert.equal(r.store.get('acct:acct-a').party, pid, 'the record\'s pointer stands until the hello');
  const a2 = await join('a');
  assert.equal(lastOf(a2, 'state').party, null); assert.equal(r.store.get('acct:acct-a').party, null);
  assert.deepEqual(lastOf(a2, 'state').friends, []);
  doorHolds(a2, 'a2');
}));

test('AUDIT SOC: the widest picture an account can hold - FRIENDS_MAX friends, PENDING_MAX requests each way, a party and an invite - is more than 128 records in ONE state frame, and the hub reads them in the runtime\'s batches (the fake enforces the 128-key wall now; mutants: the chunking dropped, which is SLAM5\'s 130th-player wall on the hub\'s own hello; a friend list read one key at a time)', () => withHub(async ({ r, act, join, tick, now }) => {
  const b = await join('b');
  const ids = (prefix, n) => Array.from({ length: n }, (_, i) => `acct-${prefix}${String(i).padStart(3, '0')}`);
  const friends = ids('f', FRIENDS_MAX), inbox = ids('i', PENDING_MAX), outbox = ids('o', PENDING_MAX);
  for (const id of [...friends, ...inbox, ...outbox]) r.store.set(`acct:${id}`, { name: 'N' + id.slice(-4), seen: 1e12 - 1000, friends: [], in: [], out: [], invites: [], party: null });
  r.store.set('acct:acct-a', { name: 'a', seen: 1e12, friends, in: inbox.map((acct) => ({ acct, at: 1e12 })), out: outbox.map((acct) => ({ acct, at: 1e12 })), invites: [], party: null });
  r.store.set('asecret:acct-a', 'secret-of-acct-a');
  const a = await join('a');
  const st = lastOf(a, 'state');
  assert.ok(st, 'the picture landed - a read over the wall would have thrown out of the hello');
  assert.equal(st.friends.length, FRIENDS_MAX); assert.equal(st.in.length, PENDING_MAX); assert.equal(st.out.length, PENDING_MAX);
  assert.equal(st.friends[3].name, 'Nf003', 'every row carries its record\'s name - the batches were read, not skipped');
  assert.ok(validSocialFrame(st), 'and it passes the client\'s door whole');
  // and with a party and an invite on top, still one frame
  await act(b, { k: 'party.invite', peer: 'peer-a' }); tick();
  assert.ok(lastOf(a, 'invite'), 'the invite lands on a picture this wide');
  await act(a, { k: 'party.accept', party: lastOf(a, 'invite').party }); tick();
  assert.equal(lastOf(a, 'state').party.members.length, 2);
  doorHolds(a, 'a'); doorHolds(b, 'b');
}));

test('SOC1 hub: the source - the account is handled after the channel\'s welcome and join, the leave stamps the account, the sweep spares acct: and asecret:, and the presence rooms are untouched (mutants: the picture before the welcome; the leave silent; a cell reading the account)', () => {
  const s = rd('server/src/index.js');
  assert.match(s, /for \(const \[other, b\] of \[\.\.\.this\._all\(\)\]\) if \(other !== ws && b\.id\) this\._send\(other, said\);\n\s*\/\/ SOC1[^\n]*\n[^\n]*\n\s*if \(isSocialRoom\(a\.key\) && m\.acct\) \{ try \{ await this\._helloAccount\(ws, m, now\); \}/, 'the account after the join fan (AUDIT SOC A2: contained)');
  assert.match(s, /if \(isSocialRoom\(a\.key\) && a\.acct\) \{ try \{ await this\._leaveAccount\(ws, a, Date\.now\(\)\); \}/, 'the leave');
  const drain = s.slice(s.indexOf('async _sweep() {'), s.indexOf('async _keysOf('));
  assert.match(drain, /for \(const prefix of \['look:', 'secret:'\]\)/, 'the drain\'s prefixes'); assert.doesNotMatch(drain, /acctKey|acctSecretKey|'acct:'|'asecret:'/, 'the drain never sweeps an account or its secret (AUDIT SOC A3: the hub\'s alarm does, one page of the idle and unlisted at a time)');
  assert.match(drain, /_keysOf\('party:'\)/, 'party: goes with the drain, in pages');
  assert.match(s, /if \(!isSocialRoom\(a\.key\)\) \{ this\._junk\(ws\); return; \}/, 'a social act outside the hub is junk');
  const partyArm = s.slice(s.indexOf("if (m.t === 'party') {"), s.indexOf("if (m.t === 'quest') {", s.indexOf("if (m.t === 'party') {")));   // AUDIT DROPS: the PARTY arm's own line - QUEST1's arm carries the same law, and a whole-file match let a mutant on this one hide behind it
  assert.match(partyArm, /if \(!isSocialRoom\(a\.key\) \|\| !a\.acct\) \{ this\._junk\(ws\); return; \}/, 'a party pose outside the hub, or without an account, is junk');
  const w = rd('src/net/wire.js');
  assert.match(w, /export const SOCIAL_ROOM = CHAT_WORLD_ROOM;/);
  assert.match(w, /export const RELAY_VERSION = 'world170';/, 'FEUD moved it on last (world170: the foe record\'s wind-ups, staggers and blow classes and a revenant\'s adaptations, weakness, last stand, band follower, blows and signature - TELL8, AUDIT TELL, RVN13 and FEUD WIRE, world162-world165 on its branch, renumbered past main\'s world169 at its merge); AUDIT ARENA-LADDER moved it on (world169: the arena ladder audit - elite champions, telegraphed blows, a judging floor and the attempt ticket - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (world168: the Seraph Wings join the aura vocabulary of the token - a relay before it refuses the token of a developer wearing them); SHADOW-CLOAK moved it on (world167: the Holo Shadow Cloak joins the token\'s aura vocabulary - a relay before it refuses SirMcMobdon\'s token once they wear it; world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges); SERPENT2 moved it on (world166: the serpent herald - a serpent site word to the hub, its bells and its kill posted to Discord); SERPENT1 moved it on (world165: the serpent frame - a sea serpent fight in the cell of its site; world162 on its branch, renumbered past PRIMARCH (world162) and SUNBABY1 (world163), then PARTY-LEAD (world164), at the merges); PARTY-LEAD moved it on (world164: the hub\'s party.lead act - a leader hands the lead to a member); SUNBABY1 moved it on (world163: the hub\'s live events gain the sun baby\'s word - LIVE_EVENTS, no frame changes shape); PRIMARCH moved it on (world162: the Primarch\'s title and glyph and the Golden Radiance\'s aura join the token\'s vocabulary - a relay before it refuses GA00250\'s token); GUILD2 moved it on (world161: no wire change - the guild and heraldry laws moved under the relay); AEGIS moved it on (world160: the Aegis of Oblivion\'s title and glyph and the Oblivion Ward\'s aura join the token\'s vocabulary - a relay before it refuses Sureme\'s token); ARENA4 moved it on (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main\'s FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant\'s name, nm, and a beaten one\'s kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon\'s Breach - its words in the omen\'s lines and the herald\'s posts, the faithful\'s rite - main\'s CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc\'s six relays renumbered past main\'s HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room); SEAT1c moved it on (world145: the seats\' titles and glyphs); SEAT1b moved it on (world144: the Watch\'s tick); ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose\'s climb - `cl`, `cw` and a move\'s `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the host of the Legion-Lord - the `ahit` blow on one of it, the words `ad`, `amv`, `aatk`, `ah` and `adie` of the room, `lg` in the state, `a` in a chart row, the brain law 5; GATE-HEAL\'s `heal` and a chart row\'s `hl` with it - main\'s HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`, the kills of quest foes a member held for a partner, counted by every copy of the quest); before it GATE-UX moved it on (world136: the damage chart made at the kill - every challenger and their part, ranked, on the `fell` word of the court and on the fall in the state (`dm`)); before it WB9 moved it on (world135: the three courts of the Warden and the Reckoning of Dagon - his court and the walkways laid in the state (`ct`, `xa`), the crystals, their breaking and the stun (`cx`, `cxh`, `cxb`, `stun`, `su`, `rk`) and a blow on a crystal (`xhit`), judged and fanned by the relay - main\'s PARTY-MAP took world134 first); before it PARTY-MAP moved it on (world134: the `amap` frame, the automap rows a Shared Cartography caster reveals, to the party alone); before it SOFTCAP1 moved it on (world133: the party pose `cl`, a member character level for mentor mode); before it STRIKE-SHARED moved it on (world132: the strike spell on a hit and the trapper on a dead foe, both read by the clients alone); before it MERGE 2 moved it on (world131: the professions branch, BOUNTY1 + AUDIT 28 - `bq` and `lv` on the party pose, `k`, `a` and `t` on a bounty row - world125 on its branch, never deployed, a number VOICE1 took on main); before it REALM-DOOR moved it on (world130: the door refuses a token the account service signed as naming no realm character); before it PENITENT\'s badge vocabulary (world129); before it WB8 moved it on (world128: marks on the gate state, the fed word - world126 on its branch, never deployed, renumbered past OW6L at the merge); before it OW6L (world127: the overworld ledger of a cell, the ow frame - never world125 (VOICE1, reverted) nor world126 (DISCORD-GATES on its branch)); before it TV8 (world124: the party\'s Overworld walk - world123 on its branch, renumbered past THE MERGE\'s); before it THE MERGE (world123: the raids, the gates and Discord - world122 to world126 on their branch, never deployed - one relay past main\'s TV3); before it TV3 (world122: a region\'s traveller marks); ONE-SEAT before it (world121 - world119, then world120, on its branch, renumbered past main\'s AUDIT SET (world119) and PARTY-BUFFS + REST-OPT (world120) at the merges: a hub hello\'s claim - one tab of an account online); before it PARTY-BUFFS + REST-OPT + the batch audit (world120 - world119, world120 and world121 on their branch, renumbered past main AUDIT SET at the merge: fx, rs and nr on the party pose, TRADE_REV_MAX and REST_OPT_RELAY_MIN named); before it AUDIT SET (world119 - world117 on its branch, renumbered past main\'s SHADOW-FANG (world117) and OWN1 + INVIS-NET (world118) at the merge: the dungeon foe record carries `v`, the joiner whose blow killed it); OWN1 + INVIS-NET moved it on before (world118 - world114 on its branch, renumbered past main\'s world114-117: the own lane and the pose\'s concealment bits); SHADOW-FANG\'s badge vocabulary moved it on (world117 - world114 on its branch, world116 at its first merge; main\'s Oblivion Gate WBX took world116 first); the Oblivion Gate\'s WBX5, AUDIT WBX and AUDIT WBX2 moved it on (world116 - world114 on its branch, renumbered past main\'s Enhanced Plus patch (world114) and GUILD1c (world115)); GUILD1c\'s guild frames and guild line moved it last (world115 - world113 on its branch), the Enhanced Plus patch\'s PEERLIGHT1/2 and PEERFX1 pose fields before it (world114), AUDIT WB\'s relay half and WB3\'s gate frame before them (world113 - world111 and world110 on their branch), PARTY-TRAVEL\'s party pose fields before it (world112 - world110 on its branch), RENOWN1\'s level and renown frame before it (world111 - world108 on its branch), EVENT1 (world110) before it; DUEL1\'s duel frame moved it last (world107), DISC23-B (world106) and AUDIT 68 (world105) before it; the community arc\'s frames and AUDIT ATTACH\'s meters moved it last (world102), DISC12 before them (world101), DISC7 before (world100); HCC-PARK + RIDE moved it last (world99); AUDIT SOC moved it, RESPAWN1 moved it again, AUDIT WATCH1 again, the main merge again, RELAY-H1 again, ACC1d again, the three drops again (world91), AUDIT DROPS again (world92), the party-rest drop again (world96), ALLY-CAST and its audit (world97), SPELLFX1 pose fields (world98)');
});

test('PARTY-REST2e wire: `voteAt` is a plain, bounded timestamp or null - never negative, never a fraction, refusing nothing (it is not part of the refuse-whole `rest`/`restPending` objects, just its own field, same law as `ready`) (mutants: a negative or fractional value admitted; absent reading as 0 instead of null; the whole pose refused for a bad voteAt instead of the field alone landing as null)', () => {
  assert.equal(validPartyPose({ ...P, voteAt: undefined }).voteAt, null);
  assert.equal(validPartyPose({ ...P, voteAt: null }).voteAt, null);
  assert.equal(validPartyPose({ ...P, voteAt: 1758000000000 }).voteAt, 1758000000000);
  assert.equal(validPartyPose({ ...P, voteAt: 1758000000000.7 }).voteAt, 1758000000001, 'rounded, same law as the vitals');
  assert.equal(validPartyPose({ ...P, voteAt: -5 }).voteAt, 0, 'clamped, not refused - the field alone lands as its own bound, unlike rest/restPending\'s refuse-whole');
  assert.equal(validPartyPose({ ...P, voteAt: 'x' }).voteAt, null);
  assert.equal(validPartyPose({ ...P, voteAt: NaN }).voteAt, null);
});

