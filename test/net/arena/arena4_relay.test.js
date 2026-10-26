// ARENA4 (2026-10-02, Mac: "choose to matchmake for a real opponent to take on in real time"; "Players can choose to
// watch AI fights, player fights"): THE ARENA'S ROOMS ON THE RELAY, over fake sockets and fake objects (test/fakeRoom.mjs)
// - the Worker's door, the hall's queue and its offers, a bout between players refereed by PVP-REF to its signed receipt,
// the stands, a forfeit, a void, and a ladder bout against the relay's own fighters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../server/src/index.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { readArenaReceipt, verifyArenaReceipt } from '../../../src/net/arena/arenaReceipt.js';
import { importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import {
  ARENA_HALL, arenaBoutRoom, ARENA_FLOOR_CENTRE, MATCH_ACCEPT_MS, MATCH_WIDEN_MS, ARENA_JOIN_WAIT_MS, ARENA_GONE_MS, ARENA_TICK_MS,
  pvpVitality, ARENA_SPECTATORS_MAX, validArenaIn, validArenaOut, arenaBlowCap, ARENA_HIT, ARENA_BUCKET_DEPTH, MATCH_REPAIR_MS,
  pairQueue, ARENA_BUCKET_RATE,
} from '../../../src/net/arena/arenaLaw.js';
import { parseClient, relaySupportsArena, RELAY_VERSION } from '../../../src/net/wire.js';
import { COUNT_MS, callMs, WALK_MAX_MS, END_HOLD_MS, VERDICT_MS, HEAL_HOLD_MS } from '../../../src/systems/arena/arenaBout.js';

const { subtle } = globalThis.crypto;
const C = ARENA_FLOOR_CENTRE;
const arena = (ws) => ws.sent.filter((m) => m.t === 'arena');
const last = (ws, k) => arena(ws).filter((m) => m.k === k).at(-1) ?? null;
const word = (r, ws, w) => r.raw(ws, JSON.stringify({ t: 'arena', ...w }));
const pose = (r, ws, x, z, extra = {}) => r.pose(ws, { x, y: 0.3, z, yaw: 0, pitch: 0, mv: 0, ...extra });

/** A world on a fake clock. */
async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await fn({ now: () => clock, step: (ms) => { clock += ms; }, set: (t) => { clock = t; } }); } finally { Date.now = realNow; }
}
/** The relay's signing pair, as tools/mintGateKeys.mjs mints it. */
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  return { pkcs8, pub: kp.publicKey, priv: await importReceiptKey(pkcs8, { subtle }) };
}
/** Two registered fighters in the hall, queued. */
async function hallOf(W, a = { ar: 1000 }, b = { ar: 1040 }) {
  const H = W.room(ARENA_HALL);
  const A = H.connect(), B = H.connect();
  await H.hello(A, 'peer-alva', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', ...a });
  await H.hello(B, 'peer-brann', null, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', ...b });
  return { H, A, B };
}

test('ARENA4 the door and the wire: the Worker opens the hall and a bout\'s room and no other arena key; an arena word is projected both ways, junk refused; the version that opens them (mutants: any arena key admitted; a blow\'s kind unchecked; the cap not doubled for a critical; a bare hand\'s most changed)', async () => {
  const env = { ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('x') }) } };
  const at = (k) => worker.fetch(new Request(`https://relay.invalid/room/${k}`), env);
  assert.equal((await at('arena:hall')).status, 426, 'the hall: a socket only');
  assert.equal((await at('arena:b0123456789abcdef')).status, 426, 'a bout');
  assert.equal((await at('arena:lobby')).status, 404, 'no other key');
  assert.equal((await at('arena:b0123')).status, 404);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'arena', k: 'q', lv: 9 }), { hasHello: true }), { t: 'arena', k: 'q', lv: 9 });
  assert.equal(parseClient(JSON.stringify({ t: 'arena', k: 'q' })).error, 'arena before hello');
  assert.equal(parseClient(JSON.stringify({ t: 'arena', k: 'boom' }), { hasHello: true }).error, 'bad arena');
  assert.deepEqual(validArenaIn({ k: 'hit', i: 'a0', d: 12.5, r: 0, w: 120, m: 3, q: 7 }), { k: 'hit', i: 'a0', d: 12.5, r: 0, w: 120, m: 3, q: 7 });
  assert.equal(validArenaIn({ k: 'hit', i: 'p9', d: 1, r: 0 }), null, 'no such fighter');
  assert.equal(validArenaIn({ k: 'hit', i: 'a0', d: 1, r: 3 }), null, 'no such kind');
  assert.equal(validArenaIn({ k: 'in', r: 'f', tier: 10, bout: 0 }), null, 'no eleventh tier');
  assert.equal(validArenaOut({ k: 'blow', i: 'a0', d: 4, to: 'p0' }).to, 'p0');
  assert.equal(validArenaOut({ k: 'st', o: 'x' }), null);
  assert.equal(arenaBlowCap({ r: ARENA_HIT.Melee, w: 123, m: 9 }), 2 * (21 + 6 + 20), 'a Daedric dai-katana, a critical\'s double');
  assert.equal(arenaBlowCap({ r: ARENA_HIT.Spell }), 60);
  assert.equal(arenaBlowCap({ r: ARENA_HIT.Melee }), 2 * (41 + 20), 'ARENA5: a bare hand\'s most (DFU\'s past the softcap) and the modifiers\' room, doubled');
  assert.equal(RELAY_VERSION, 'world266');   // PIN MOVED: world266, AUDIT KETCH II (the airship raid: the whole state word carries the wave to five, a sweep by the ship says sw, the number of a voyage is a receipt bound, the last minutes of her crews forty-five, a fight lost after two minutes, the receipts of a fall told before her record goes; world265 on its branch, renumbered past GATE-COURTS at the merge; NOT YET DEPLOYED); PIN MOVED: world265, GATE-COURTS (the night of a gate held in courts of fifty, each seated by the book of the first; NOT YET DEPLOYED); PIN MOVED: world264, REWARD-KILLS (a staff event reward is earned by three kills alone; world258 then world262 on its branch, renumbered past world258-world263 at the merges; NOT YET DEPLOYED); PIN MOVED: world263, HIBERNATE (a quiet cell sleeps, a freeze or mute asks its lease with the door off; world260/world261 on its branch, renumbered past THE FOLD's world260, #1281's world261 and #1238's world262 at the merges); PIN MOVED: world261, EVENT-RULES, BOSS-TRAITS and RAID5 (a realm keeps a death down two minutes for a Resurrect by a friend, SD_REZ_MS; a foe record carries its boss traits bt, its wrath bw and the leader of a raid rl; NOT YET DEPLOYED); PIN MOVED: world259, ASK-LONGER (the word of the company open 30 s, net/eliteGates/egRun.js EG_ASK_MS; world257 on its branch, renumbered past STAFF-EVENT BOSS and KETCH-LONGER at the merge; NOT YET DEPLOYED); PIN MOVED: world258, KETCH-LONGER (the raid retuned: five Watch waves, the wire takes a wave to five; world257 on its branch, renumbered past STAFF-EVENT BOSS at the merge; NOT YET DEPLOYED); PIN MOVED: world257, STAFF-EVENT BOSS (the mini boss stood again when lost, called each time the meter fills, an exact health hp; NOT YET DEPLOYED); PIN MOVED: world256, STAFF-EVENT (staff events: the hub book, a place kill meter, the mini boss; world255 on its branch, renumbered past KETCH at the merge; NOT YET DEPLOYED); PIN MOVED: world255, KETCH (the sky-ketch frame kt in the room of a crew ship, validKetchIn and validKetchOut; world253 on its branch, renumbered past ROCKET1's world253 and AUDIT FOE-KEEPS' world254 at the merge; NOT YET DEPLOYED); PIN MOVED: world254, AUDIT FOE-KEEPS (the open zone kill credit: the word of a fighter that left the zone dying, dd; NOT YET DEPLOYED); PIN MOVED: world253, ROCKET1 (the live event word `rocket`; NOT YET DEPLOYED); PIN MOVED: world252, DECK-POSE (a pose carries its place aboard a boat, validPose `ab`; NOT YET DEPLOYED); PIN MOVED: world251, AUDIT MIXED-PAIR / SPELL-HAND (world249 on its branch, renumbered past STAFF-PANEL5-MONSTERS and HERALD-CARDS at the merge - validPose carries `ah`, the left hand of a pair struck last, so the peers draw a pair in both hands); PIN MOVED: world250, HERALD-CARDS (world243 on its branch, renumbered past PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES, STAFF-PANEL5, AUDIT EG-FALL and STAFF-PANEL5-MONSTERS at the merge - every herald post one card of its family - its title, its facts as fields, its colour - and each family a thread of its own in the world events channel, the relay settings gateThread, serpentThread, sdThread and egThread; net/herald/heraldCard.js joins the bundle); PIN MOVED: world249, STAFF-PANEL5-MONSTERS (the staff panel Monster watch counts monsters whatever grantStrip says, and its batch says measured; NOT YET DEPLOYED; world248 on its branch, renumbered past AUDIT EG-FALL at the merge); PIN MOVED: world248, AUDIT EG-FALL (world240 on its branch, renumbered past GUILD-CAP, SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES and STAFF-PANEL5 at the merge - a felled Elite Breach lord lies where it fell - net/eliteGates/egLords.js egLordHit stops its walk at its fall, egStop; no word changed); PIN MOVED: world247, STAFF-PANEL5 (the staff panel relay release: follow, Message on screen, the feeds, the staff cut, hidden staff, freeze and the staff chat; NOT YET DEPLOYED); PIN MOVED: world246, SEA VENTURES (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges - the Eltheric Ocean ventures, one relay: the hub reads a vault of the deep by its cell, a fall signs its room, the referee judges a broadside); PIN MOVED: world245, AUDIT PISTOLET (the siege referee knows the top of the Dwarven Pistolet - SIEGE_PISTOLET - and a duel shot from the off hand of a pair carries the DUAL terms, `off` on a shot as on a swing; world242 on its branch, renumbered past LEASE1, PARTY-PING and SPAWN-THIN at the merge); PIN MOVED: world244, SPAWN-THIN (the overworld keep drops a quarter of the spawn band; world242 on its branch, renumbered past PARTY-PING world243 at the merge); PIN MOVED: world243, PARTY-PING (validPartyPose carries pg); PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels, `chat:trade` and `chat:lfg`, joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub's hello and leave without a walk of every socket; a busy refusal's token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc's lane 3 - world186 on its branch, renumbered past SD-HERALD's world186 and WAGONS1's world187 at the merge); PIN MOVED: world183, CHAP4c (the chapters' seats' titles on the token - past THE WROTHGARIAN ZONE's world177, TAVERN CARDS' world178, HOURS-FIRST's world179, TAVERN-TABLES' world180, TV-BEYOND's world181 and CARDS10's world182 at the merges); world142 on its branch, renumbered past main's world154 at the merge; AEGIS moved it on (world160), GUILD2 after it (world161, no wire change), PRIMARCH after that (world162), SUNBABY1 after it (world163, a live event's word), PARTY-LEAD after that (world164, the hub's party.lead act), SERPENT1 after it (world165, the serpent frame), SERPENT2 after that (world166, the serpent herald); SHADOW-CLOAK after it (world167, the cloak's word - PIN MOVED); SERAPH-WINGS after it (world168, the wings word - PIN MOVED); AUDIT ARENA-LADDER after that (world169, the arena ladder audit - PIN MOVED); FEUD after that (world170, the foe record's wind-ups and a revenant's fields - PIN MOVED); CRYSTAL-FIST after it (world171, the Crystal Fist's words - world170 on its branch, renumbered past FEUD's at the merge - PIN MOVED); WATCH-FIX after it (world172, the watch record names its resident - PIN MOVED); SERPENT3 after that (world173, the sea serpent brain - world171 on its branch, renumbered past CRYSTAL-FIST's and WATCH-FIX's at the merges - PIN MOVED); LEGACY7 after that (world174, the house on the token and the row - world172 on its branch, renumbered past WATCH-FIX's and SERPENT3's at the merge - PIN MOVED); TEXT-F1 after that (world175, the words a player types starred - PIN MOVED; SUPER-DUNGEONS after that (world176, a re-laid dungeon's room of its own - world171 on its branch, renumbered past CRYSTAL-FIST's at one merge and past WATCH-FIX's, SERPENT3's and LEGACY7's at the next - PIN MOVED)
  assert.equal(relaySupportsArena('world154'), false, 'main\'s FRIENDS-SYNC through BROKER-CAGE took world142-154 and open no arena room');
  assert.equal(relaySupportsArena('world142'), false);
  assert.equal(relaySupportsArena('world155'), true);
});

test('ARENA4 the hall: two registered fighters queued are offered one bout, both say yes and are sent to its room on their sides; a guest is not queued; the band widens with the wait (mutants: the guest queued; the offer to one alone; the sides swapped; the band\'s widening or the offer\'s clock changed; paired youngest first, past the narrower band, short of the nearest, or with themselves)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { H, A, B } = await hallOf(W);
  const G = H.connect();
  await H.hello(G, 'peer-gull', null, { name: 'Gull' });
  await word(H, G, { k: 'q' });
  assert.deepEqual(last(G, 'qx'), { t: 'arena', k: 'qx', m: 'guest' }, 'a guest fights no rated bout');
  await word(H, A, { k: 'q', lv: 9 });
  await word(H, B, { k: 'q', lv: 7 });
  assert.equal(last(A, 'qd').band, 100);
  step(1000); await H.fire();
  const oa = last(A, 'of'), ob = last(B, 'of');
  assert.ok(oa && ob, 'both offered');
  assert.equal(oa.o, ob.o, 'one bout');
  assert.deepEqual(oa.vs, { n: 'Brann', r: 1040 });
  assert.deepEqual(ob.vs, { n: 'Alva', r: 1000 });
  assert.equal(oa.until, Date.now() + MATCH_ACCEPT_MS);
  await word(H, A, { k: 'y', o: oa.o });
  assert.equal(last(A, 'go'), null, 'one yes is not a bout');
  await word(H, B, { k: 'y', o: oa.o });
  const ga = last(A, 'go'), gb = last(B, 'go');
  assert.deepEqual([ga.o, ga.side, gb.side], [gb.o, 0, 1]);
  assert.notEqual(ga.o, oa.o, 'AUDIT PRE-MERGE 1003 S7: the bout\'s room minted at the go, never the offer\'s id');
  assert.ok(W.made.has(arenaBoutRoom(ga.o)), 'the bout\'s room was opened by the hall');
  await word(H, A, { k: 'ls' });
  assert.equal(last(A, 'live').l[0].o, ga.o, 'and it is on the list to watch');
  // the band: 1000 and 1500 wait past four widenings before they meet
  const W2 = fakeRooms();
  const P = await hallOf(W2, { ar: 1000 }, { ar: 1500 });
  await word(P.H, P.A, { k: 'q' }); await word(P.H, P.B, { k: 'q' });
  for (let i = 0; i < 3; i++) { step(MATCH_WIDEN_MS); await P.H.fire(); }
  assert.equal(last(P.A, 'of'), null, '500 apart is past a 400 band');
  assert.equal(last(P.A, 'qd').band, 400);
  step(MATCH_WIDEN_MS); await P.H.fire();
  assert.ok(last(P.A, 'of'), 'the band reached 500');
  // ARENA5: Arena.md 7's two numbers, and pairQueue's own order - the oldest first, the nearest rating inside the
  // narrower of the two bands, never a fighter with themselves
  assert.deepEqual([MATCH_WIDEN_MS, MATCH_ACCEPT_MS], [10_000, 20_000], 'Arena.md 7: "the band widening every 10 s", "both accept in 20 s"');
  const Q = (sub, rating, at) => ({ sub, rating, at });
  const subs = (pairs) => pairs.map(([x, y]) => [x.sub, y.sub]);
  assert.deepEqual(subs(pairQueue([Q('a', 1000, 0), Q('b', 1050, 1), Q('c', 1100, 2)], 2)), [['a', 'b']], 'the oldest chooses first');
  assert.deepEqual(subs(pairQueue([Q('a', 1000, 0), Q('b', 1090, 0), Q('c', 1050, 0)], 0)), [['a', 'c']], 'the nearest rating, not the first inside the band');
  assert.deepEqual(pairQueue([Q('a', 1000, 0), Q('b', 1150, 2 * MATCH_WIDEN_MS)], 2 * MATCH_WIDEN_MS), [], 'a\'s band of 300 admits b; b\'s of 100 does not');
  assert.deepEqual(pairQueue([Q('a', 1000, 0), Q('a', 1000, 5)], 5), [], 'never a fighter with themselves');
}));

test('ARENA4 the offer: a no sends the other back to the queue, its wait kept, and the pair is not offered again for a minute; a lapse takes the silent one out; a socket gone takes its place out (mutants: the decliner kept; the pair re-offered at once; a lapse queues the silent one; the minute changed; a socket gone kept in the queue, closed or lost)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { H, A, B } = await hallOf(W);
  await word(H, A, { k: 'q' }); await word(H, B, { k: 'q' });
  step(1000); await H.fire();
  const o = last(A, 'of').o;
  await word(H, B, { k: 'n', o });
  assert.equal(last(A, 'qx').m, 'declined');
  assert.ok(last(A, 'qd'), 'back in the queue');
  assert.equal((await H.room._hallOf()).q.some((e) => e.sub === 'acct-brann'), false, 'ARENA5: the one who said no is out of it');
  assert.equal(MATCH_REPAIR_MS, 60_000, 'ARENA5: a minute');
  await word(H, B, { k: 'q' });
  step(1000); await H.fire();
  assert.equal(arena(A).filter((m) => m.k === 'of').length, 1, 'not offered again inside a minute');
  step(MATCH_REPAIR_MS); await H.fire();
  assert.equal(arena(A).filter((m) => m.k === 'of').length, 2, 'after it, they meet');
  const o2 = last(A, 'of').o;
  await word(H, A, { k: 'y', o: o2 });
  step(MATCH_ACCEPT_MS + 1); await H.fire();
  assert.equal(last(B, 'qx').m, 'lapsed');
  assert.equal(last(A, 'qx').m, 'lapsed');
  const lapsedQ = (await H.room._hallOf()).q.map((e) => e.sub);
  assert.deepEqual([lapsedQ.includes('acct-alva'), lapsedQ.includes('acct-brann')], [true, false], 'ARENA5: a lapse - the one who said yes back in the queue, the silent one out');
  const qdA = arena(A).filter((m) => m.k === 'qd').length;
  step(1000); await H.fire();
  assert.ok(arena(A).filter((m) => m.k === 'qd').length >= qdA, 'the one who said yes waits on');
  await H.drop(A);
  assert.equal((await H.room._hallOf()).q.some((e) => e.sub === 'acct-alva'), false, 'a socket gone takes its place out (ARENA5: at its close)');
  // ARENA5: and a socket the hall lost without a close (the runtime's own drop - a tab gone without a word) is out by
  // the hall's next beat
  await word(H, B, { k: 'q' });
  H.sockets.splice(H.sockets.indexOf(B), 1);
  step(1000); await H.fire();
  assert.equal((await H.room._hallOf()).q.some((e) => e.sub === 'acct-brann'), false, 'a queue holds only accounts with a socket in the hall');
}));

/** A matched bout between Alva and Brann, both on its sand, its law running. */
async function matched(W, step) {
  const { H, A, B } = await hallOf(W, { ar: 1000, lv: 20 }, { ar: 1040, lv: 30 });   // AUDIT PRE-MERGE 1003 S3: the vitality's level is the hall's token's, never the queue word's
  await word(H, A, { k: 'q', lv: 20 }); await word(H, B, { k: 'q', lv: 30 });
  step(1000); await H.fire();
  const of = last(A, 'of').o;
  await word(H, A, { k: 'y', o: of }); await word(H, B, { k: 'y', o: of });
  const o = last(A, 'go').o;   // AUDIT PRE-MERGE 1003 S7: the room the go names
  const R = W.room(arenaBoutRoom(o));
  const pair = await relayPair();
  R.env.GATE_SIGNING_KEY = pair.pkcs8;
  const a = R.connect(), b = R.connect();
  await R.hello(a, 'fight-alva', { x: C[0] - 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', lv: 20 });
  await R.hello(b, 'fight-brann', { x: C[0] + 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', lv: 30 });
  await word(R, a, { k: 'in', r: 'f' });
  assert.equal(last(a, 'st').ph, 'wait', 'one fighter on the sand waits for the other');
  await word(R, b, { k: 'in', r: 'f' });
  return { R, a, b, o, pair };
}
/** The clock walked to the fight's word, the room's beat run each step. */
async function toFight(R, step, n = 2) {
  const total = callMs({ fighters: Array(n) }) + 300 + COUNT_MS + 600;
  for (let t = 0; t < total; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await R.fire(); }
}

test('ARENA4 PVP-REF: a matched bout runs the bout law on the relay - both on the sand, the call, the count, the fight; the relay holds each fighter\'s vitality (300 + 2 x level) and believes a blow only in reach, under the rate, capped by the weapon and the bucket - and signs the result for both (mutants: a blow from across the sand landed; the rate unchecked; the bucket unspent; the vitality the client\'s; a pose too fast believed; the bucket\'s rate changed)', async () => onClock(async ({ step, now }) => {
  const W = fakeRooms();
  const { R, a, b, o, pair } = await matched(W, step);
  const st = last(a, 'st');
  assert.equal(st.ph, 'call');
  assert.equal(st.me, 'p0');
  assert.equal(last(b, 'st').me, 'p1');
  assert.deepEqual(st.f.map((f) => [f[0], f[4]]), [['p0', pvpVitality(20)], ['p1', pvpVitality(30)]], 'the vitality the relay holds');
  assert.deepEqual([pvpVitality(20), pvpVitality(30), pvpVitality(9999)], [340, 360, 420], 'ARENA5: 300 + 2 x level, the level held at sixty - a lie about it buys little');
  assert.ok(a.sent.some((m) => m.t === 'join' && m.id === 'fight-brann'), 'each fighter comes onto the other\'s sand');
  await toFight(R, step);
  assert.equal(last(a, 'st').ph, 'fight');
  // from across the sand: a miss
  await word(R, a, { k: 'hit', i: 'p1', d: 20, r: 0, w: 120, m: 1, q: 1 });
  assert.equal(last(a, 'hp')?.h?.find((h) => h[0] === 'p1')?.[1] ?? pvpVitality(30), pvpVitality(30), 'twelve metres is out of reach');
  // in reach: lands, capped by the weapon
  await pose(R, a, C[0] + 4.5, C[2]);
  step(300);
  await word(R, a, { k: 'hit', i: 'p1', d: 999, r: 0, w: 120, m: 1, q: 2 });
  const capped = arenaBlowCap({ r: 0, w: 120, m: 1 });
  assert.equal(last(b, 'hp').h.find((h) => h[0] === 'p1')[1], pvpVitality(30) - capped, `a longsword's claim of 999 is ${capped} at most`);
  // ARENA5: a pose too fast to believe is not believed - the reach is measured from the last good one
  step(300);
  await pose(R, a, C[0] - 13, C[2]);
  await word(R, a, { k: 'hit', i: 'p1', d: 3, r: 0, w: 120, m: 1, q: 3 });
  assert.equal(last(b, 'hp').h.find((h) => h[0] === 'p1')[1], pvpVitality(30) - capped - 3, 'seventeen metres in a third of a second is no step: the blow lands from where Alva last truly stood');
  // the rate: four blows a second; the fifth inside it is not believed
  step(1100);
  const before = last(b, 'hp').h.find((h) => h[0] === 'p1')[1];
  for (let q = 10; q < 15; q++) await word(R, a, { k: 'hit', i: 'p1', d: 5, r: 0, w: 120, m: 1, q });
  assert.equal(last(b, 'hp').h.find((h) => h[0] === 'p1')[1], before - 20, 'four of five');
  // the bucket: a long run of capped blows is held to its rate
  const hpB = () => last(b, 'hp').h.find((h) => h[0] === 'p1')[1];
  let down = hpB();
  const takes = [];
  for (let i = 0; i < 4; i++) { const h0 = hpB(); step(1000); await R.fire(); await word(R, a, { k: 'hit', i: 'p1', d: 999, r: 0, w: 123, m: 9, q: 100 + i }); takes.push(h0 - hpB()); }
  const after = hpB();
  assert.ok(down - after <= 4 * 40 + ARENA_BUCKET_DEPTH, `four seconds of capped blows took ${down - after}`);
  // ARENA5: the bound above is no tighter than what Brann had left (a run that fells him passes it - an unspent bucket's
  // did), so the run is read blow by blow: the first the weapon's capped most, then, the bucket dry, a second's refill
  assert.equal(takes[0], arenaBlowCap({ r: 0, w: 123, m: 9 }), 'the first, a Daedric dai-katana\'s capped most');
  assert.deepEqual(takes.slice(2), [ARENA_BUCKET_RATE, ARENA_BUCKET_RATE], `then the bucket's own rate, however a claim is dressed: ${takes}`);
  // to the floor: the fall, the end, the receipt
  for (let i = 0; i < 40 && !last(a, 'rc'); i++) { step(1000); await R.fire(); await word(R, a, { k: 'hit', i: 'p1', d: 999, r: 0, w: 123, m: 9, q: 200 + i }); }
  await R.fire();
  const ra = last(a, 'rc'), rb = last(b, 'rc');
  assert.ok(ra && rb, 'both are handed the receipt');
  assert.equal(ra.r, rb.r, 'one bout, one receipt');
  const c = readArenaReceipt(ra.r);
  assert.deepEqual([c.a, c.j, c.f, c.r, c.h], ['p', o, ['acct-alva', 'acct-brann'], 0, 'fall']);
  assert.equal((await verifyArenaReceipt(ra.r, pair.pub, { subtle, nowS: Math.floor(now() / 1000) })).ok, true, 'signed by the relay');
  void down;
}));

test('ARENA4 the stands: a spectator takes a seat - HOTFIX 1003f: a body the fighters see, as it sees them - and the whole bout, its cheer is fanned; sixty seats (mutants: the spectator drawn to nobody; its pose to nobody; the seats unbounded; sixty changed; a stranger let onto the sand)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { R, a, b } = await matched(W, step);
  const s = R.connect();
  await R.hello(s, 'seat-sola', { x: C[0], y: 7, z: C[2] - 21.8, yaw: 0, pitch: 0, mv: 0 }, { name: 'Sola' });
  const welcome = s.sent.find((m) => m.t === 'welcome');
  assert.deepEqual(welcome.peers.map((p) => p.id).sort(), ['fight-alva', 'fight-brann'], 'the stands see both fighters');
  await word(R, s, { k: 'in', r: 's' });
  assert.equal(last(s, 'st').me, '', 'a spectator fights nobody');
  await word(R, s, { k: 'in', r: 'f' });
  assert.equal(last(s, 'no').m, 'not yours', 'ARENA5: and is let onto nobody\'s sand');
  assert.equal(last(a, 'sp').n, 1);
  assert.ok(a.sent.some((m) => m.t === 'join' && m.id === 'seat-sola'), 'HOTFIX 1003f: the fighters see the stands - a spectator\'s hello is said to the room');
  const seen = a.sent.length;
  await pose(R, s, C[0] + 1, C[2] - 21);
  assert.ok(a.sent.slice(seen).some((m) => m.t === 'pose' && m.id === 'seat-sola'), 'HOTFIX 1003f: a spectator\'s pose reaches the fighters');
  await pose(R, a, C[0] - 5, C[2]);
  assert.ok(s.sent.some((m) => m.t === 'pose' && m.id === 'fight-alva'), 'a fighter\'s reaches the stands');
  await word(R, s, { k: 'ch', c: 1 });
  assert.deepEqual(last(b, 'cr'), { t: 'arena', k: 'cr', c: 1, n: 1 });
  await word(R, s, { k: 'ch', c: 1 });
  assert.equal(arena(b).filter((m) => m.k === 'cr').length, 1, 'one cheer a spectator in its time');
  await word(R, a, { k: 'ch', c: 1 });
  assert.equal(arena(b).filter((m) => m.k === 'cr').length, 1, 'a fighter cheers nobody');
  (await R.room._boutOf()).spectators = ARENA_SPECTATORS_MAX;
  const late = R.connect();
  await R.hello(late, 'seat-late', null, { name: 'Late' });
  await word(R, late, { k: 'in', r: 's' });
  assert.equal(last(late, 'no').m, 'seats full');
  assert.equal(ARENA_SPECTATORS_MAX, 60, 'ARENA5: Arena.md 7 - up to 60');
}));

test('ARENA4 a forfeit and a void: a fighter gone from a live fight past fifteen seconds forfeits it; a matched bout nobody comes to is void and leaves the list (mutants: no forfeit; a forfeit at once; the void never said; the fifteen seconds changed)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { R, a, b } = await matched(W, step);
  await toFight(R, step);
  assert.equal(ARENA_GONE_MS, 15_000, 'ARENA5: fifteen seconds');
  await R.drop(b);
  for (let t = 0; t < ARENA_GONE_MS - 1000; t += 1000) { step(1000); await R.fire(); }
  assert.equal(last(a, 'rc'), null, 'not yet');
  for (let t = 0; t < 3000; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await R.fire(); }
  const c = readArenaReceipt(last(a, 'rc').r);
  assert.deepEqual([c.r, c.h], [0, 'forfeit'], 'the one who stayed wins by forfeit');
  // void
  const W2 = fakeRooms();
  const { H, A, B } = await hallOf(W2);
  await word(H, A, { k: 'q' }); await word(H, B, { k: 'q' });
  step(1000); await H.fire();
  const of = last(A, 'of').o;
  await word(H, A, { k: 'y', o: of }); await word(H, B, { k: 'y', o: of });
  const o = last(A, 'go').o;   // AUDIT PRE-MERGE 1003 S7: the room the go names
  const R2 = W2.room(arenaBoutRoom(o));
  const x = R2.connect();
  await R2.hello(x, 'fight-x01', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva' });
  await word(R2, x, { k: 'in', r: 'f' });
  for (let t = 0; t <= ARENA_JOIN_WAIT_MS + 1000; t += 1000) { step(1000); await R2.fire(); }
  assert.equal(last(x, 'no').m, 'void');
  assert.equal(last(x, 'st').ph, 'void');
  await word(H, A, { k: 'ls' });
  assert.equal(last(A, 'live').l.some((e) => e.o === o), false, 'the hall forgets it');
}));

test('ARENA4 the ladder on the relay: the fighter\'s own `in` opens a ladder bout against the relay\'s fighters - they walk at the fighter, telegraph and land blows the fighter\'s game applies; beaten, the receipt names the tier and the bout (mutants: no walk; a blow out of reach landed; the receipt\'s step wrong; the receipt\'s result reversed; a class fighter\'s body changed)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const o = '00000000000000aa';
  const R = W.room(arenaBoutRoom(o));
  R.env.GATE_SIGNING_KEY = (await relayPair()).pkcs8;
  const p = R.connect();
  let px = C[0] - 6;
  await R.hello(p, 'fight-ceryn', { x: px, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Ceryn', kind: 'linked', tokenSub: 'acct-ceryn' });
  await word(R, p, { k: 'in', r: 'f', tier: 0, bout: 1, lv: 6, mh: 90, z: 'feedc0de00000001' });
  const st = last(p, 'st');
  assert.equal(st.kind, 'pve');
  assert.deepEqual([st.tier, st.bout], [0, 1]);
  assert.deepEqual(st.f.map((f) => [f[0], f[6], f[7]]), [['p0', 0, -1], ['a0', 1, 136]], 'the Pit\'s second bout: a Rogue');
  assert.equal(st.f[1][4], 26, 'ARENA5: a Rogue of level 2 - 10 and 8 a level');
  assert.ok(last(p, 'mv'), 'its place said');
  await toFight(R, step);
  // it walks at me
  step(ARENA_TICK_MS); await R.fire();
  const mv = arena(p).filter((m) => m.k === 'mv' && m.v > 0).at(-1);
  assert.ok(mv && mv.tx < mv.x, 'the Rogue walks west, at me');
  // I stand; it comes, telegraphs, and lands
  for (let t = 0; t < 6000 && !last(p, 'blow'); t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await pose(R, p, px, C[2]); await R.fire(); }
  const atk = last(p, 'atk');
  assert.ok(atk && atk.tg === 'p0', 'a blow telegraphed at me');
  const blow = last(p, 'blow');
  assert.ok(blow && blow.to === 'p0' && blow.d >= 1 && blow.d <= 8, `a Rogue's blow: ${blow?.d}`);
  // ARENA5: a blow telegraphed lands only on a foe still in its reach - step out of it before it falls and it is a miss
  const atks = () => arena(p).filter((m) => m.k === 'atk').length, blows = () => arena(p).filter((m) => m.k === 'blow').length;
  const atk0 = atks();
  for (let t = 0; t < 4000 && atks() === atk0; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await pose(R, p, px, C[2]); await R.fire(); }
  assert.ok(atks() > atk0, 'its next blow telegraphed');
  const blows0 = blows();
  step(ARENA_TICK_MS); px -= 3; await pose(R, p, px, C[2]); await R.fire();
  step(ARENA_TICK_MS); await R.fire();
  assert.equal(blows(), blows0, 'stepped back out of its reach before it fell: no blow');
  // I beat it
  for (let i = 0; i < 60 && !last(p, 'rc'); i++) {
    step(300); await pose(R, p, px, C[2]); await R.fire();
    await word(R, p, { k: 'hit', i: 'a0', d: 8, r: 0, w: 116, m: 1, q: 500 + i });
  }
  for (let i = 0; i < 4 && !last(p, 'rc'); i++) { step(ARENA_TICK_MS); await R.fire(); }
  const c = readArenaReceipt(last(p, 'rc').r);
  assert.deepEqual([c.a, c.s, c.q, c.u, c.j], ['l', 'acct-ceryn', 0, 1, o]);
  assert.equal(typeof c.r, 'number');
  assert.equal(c.r, 1, 'ARENA5: beaten - the receipt says the fighter won');
  void WALK_MAX_MS; void END_HOLD_MS; void VERDICT_MS; void HEAL_HOLD_MS;
}));
