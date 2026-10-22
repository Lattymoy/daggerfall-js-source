// SERPENT1 (2026-10-04, Mac: "A new world event that requires players with a ship to meet up and take on a large scale
// sea serpent in the ocean"): THE SERPENT ON THE RELAY AND IN THE BOOKS. The kill's receipt (net/serpent/serpentReceipt.js - the
// gate's ladder, never mistaken for a gate's, a raid's or an identity); the `serpent` frame both ways (net/wire.js); the
// relay over the real Room in a real cell (server/src/index.js - the fight stood where its site is, the join and its
// refusals, the beat on the cell's alarm beside the cell's own duties, the fan to the waters and not past them, a blow
// from the socket's own pose, the kill said once with its receipts, the hub's word to everyone online, the receipt again
// at a later `in`, the fight forgotten after its keeping); and the account service (server-account/src/serpents.js -
// one row a serpent an account, the fighting character's Renown, a guest not counted, the device's hoard once; the
// worker's route behind a session), and the device's carrier (net/serpent/serpentClaims.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import {
  SERPENT_RECEIPT_V, SERPENT_RECEIPT_TTL_S, SERPENT_RECEIPT_MAX, serpentReceiptValid, mintSerpentReceipt, readSerpentReceipt, verifySerpentReceipt,
} from '../../../src/net/serpent/serpentReceipt.js';
import { mintReceipt, verifyReceipt, importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import { mintRaidReceipt, verifyRaidReceipt } from '../../../src/net/raid/raidReceipt.js';
import { importPublicKeyB64 } from '../../../src/net/identityToken.js';
import {
  parseClient, validSerpentIn, validSerpentOut, relaySupportsSerpent, serpentGate, SERPENT_RELAY_MIN, SERPENT_HZ_MAX, SERPENT_KINDS,
  SERPENT_OUT_KINDS, SERPENT_NO_WORDS, SERPENT_LEGS_MAX, SERPENT_MODES_MAX, SERPENT_ATTACKS, SERPENT_MODES, SERPENT_CHART_MAX,
  SERPENT_RECEIPT_WIRE_MAX, SERPENT_DMG_WIRE_MAX, SERPENT_FIGHT_KEY, serpentFightId, SOCIAL_ROOM, RELAY_VERSION, cellRoomOfWire, PIXEL_UNITS,
} from '../../../src/net/wire.js';
import { serpentTimes, serpentBossOf, serpentSiteKey, SERPENT_BRAIN_V, SERPENT_DIVE_MS, SERPENT_NATIVE_PER_M } from '../../../src/net/serpent/serpentLaw.js';
import {
  SERPENT_ATTACK_BY_ID, SERPENT_TICK_MS, SERPENT_OPENING_MS, SERPENT_CLOSE_MS, FAN_R, ADMIT_R, SHIP_REF, SERPENT_TTK_S, SERPENT_DAMAGE_CHART_MAX, serpentStateOf, ZONES,
} from '../../../src/net/serpent/serpentBrain.js';
import { LEGS_KEPT, MODES_KEPT, MODE_NAMES } from '../../../src/net/serpent/serpentBody.js';
import { relayVersionAtLeast } from '../../relayVersion.mjs';
import { fakeRooms } from '../../fakeRoom.mjs';
import worker from '../../../server-account/src/index.js';
import { _resetKeyForTests } from '../../../server-account/src/signing.js';
import { createGuest } from '../../../server-account/src/accounts.js';
import { claimSerpent, serpentRecordOf, SERPENT_STOOD_RENOWN } from '../../../server-account/src/serpents.js';
import { ROUTES, OPEN_ROUTES } from '../../../server-account/src/service.js';
import { renownSerpentXp, renownRaidXp, RENOWN_SERPENT_QUESTS } from '../../../src/net/renown.js';
import { accountSerpents } from '../../../src/net/accountClient.js';
import { createSerpentClaims, serpentClaimVerdict, serpentRecordText, SERPENT_CLAIMS_KEY, SERPENT_CLAIM_RETRY_MS } from '../../../src/net/serpent/serpentClaims.js';
import { ACCEPTED } from '../../../src/net/legalLaw.js';

const subtle = globalThis.crypto.subtle;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const keypair = () => subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

// ═══ THE RECEIPT ═════════════════════════════════════════════════════════════════════════════════

test('SERPENT1 receipt: minted by the relay, verified by its public half - the day, the serpent, the account, the seed, how it was serpentEarned, the hull and the level, a week to carry it; never a gate\'s, a raid\'s or an identity, whichever verifier is asked (mutants: the version read after the signature; the claim shapes overlapping; an unsigned receipt honoured)', async () => {
  const kp = await keypair();
  const nowS = 1_800_000_000;
  const what = { d: 363, b: 'sethrakul', s: 'acct-0001', c: 4242, x: 'dealt', h: 4, l: 22 };
  const r = await mintSerpentReceipt(what, kp.privateKey, { subtle, nowS });
  assert.ok(r.startsWith(`${SERPENT_RECEIPT_V}.`) && r.length <= SERPENT_RECEIPT_MAX && r.length <= SERPENT_RECEIPT_WIRE_MAX);
  const ok = await verifySerpentReceipt(r, kp.publicKey, { subtle, nowS: nowS + 10 });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.claims, { ...what, i: nowS, e: nowS + SERPENT_RECEIPT_TTL_S });
  assert.equal((await verifySerpentReceipt(r, kp.publicKey, { subtle, nowS: nowS + SERPENT_RECEIPT_TTL_S })).why, 'expired');
  const forged = r.slice(0, -4) + (r.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
  assert.equal((await verifySerpentReceipt(forged, kp.publicKey, { subtle, nowS })).ok, false);
  // never another's: each verifier refuses the others at the version
  const gate = await mintReceipt({ d: 363, b: 'ruhn', s: 'acct-0001', c: 1, x: 'dealt' }, kp.privateKey, { subtle, nowS });
  const raid = await mintRaidReceipt({ w: '3:7:363', s: 'acct-0001', c: 1, y: 0 }, kp.privateKey, { subtle, nowS });
  assert.equal((await verifySerpentReceipt(gate, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.equal((await verifySerpentReceipt(raid, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.equal((await verifyReceipt(r, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.equal((await verifyRaidReceipt(r, kp.publicKey, { subtle, nowS })).why, 'version');
  // the shapes are disjoint
  assert.equal(serpentReceiptValid({ ...ok.claims, w: '3:7:363' }), false);
  assert.equal(serpentReceiptValid({ ...ok.claims, n: 'name' }), false);
  assert.equal(serpentReceiptValid({ ...ok.claims, h: 5 }), false, 'no such hull');
  assert.equal(serpentReceiptValid({ ...ok.claims, x: 'rite' }), false, 'a serpent is serpentEarned by dealing or standing');
  // unsigned: read, never honoured
  const un = await mintSerpentReceipt(what, null, { subtle, nowS });
  assert.ok(un.endsWith('.'));
  assert.equal(readSerpentReceipt(un).signed, false);
  assert.equal(readSerpentReceipt(un).c, 4242);
  assert.equal((await verifySerpentReceipt(un, kp.publicKey, { subtle, nowS })).why, 'unsigned');
  assert.equal(readSerpentReceipt(un.replace(/^l1\./, 'r1.')), null, 'read as a serpent\'s only under its own version');
  assert.equal(readSerpentReceipt(r.replace(/^l1\./, 'w1.')), null);
  await assert.rejects(() => mintSerpentReceipt({ ...what, x: 'bribed' }, kp.privateKey, { subtle, nowS }));
});

// ═══ THE WIRE ════════════════════════════════════════════════════════════════════════════════════

test('SERPENT1 wire: the client says five things - `in` with its day, law, level, hull and site, `hit` with a damage and where it struck, `wr` its ship wrecked or afloat, the coiled ship\'s `held` and `esc` - projected field by field after a hello alone; the first relay that holds a serpent is SERPENT_RELAY_MIN (mutants: an extra field carried; a hull past the table; a damage past the wire\'s bound; a wreck word not 0 or 1)', () => {
  assert.deepEqual(SERPENT_KINDS, ['in', 'hit', 'held', 'esc', 'wr', 'site', 'vt'], 'PIN MOVED (INT13): and her hull\'s word, `vt`, to the cell (test/net/int12_body_relay.test.js); PIN MOVED (SERPENT2): and `site`, to the hub alone (test/net/serpent/serpent2_herald.test.js) - the cell takes these six');
  const IN = { k: 'in', d: 363, bv: 1, lv: 20, hl: 4, sx: 205.5 * PIXEL_UNITS, sz: 285.5 * PIXEL_UNITS };
  assert.deepEqual(validSerpentIn({ ...IN, extra: 1 }), IN);
  assert.equal(validSerpentIn({ ...IN, hl: 5 }), null);
  assert.deepEqual(validSerpentIn({ ...IN, hl: -1 }), { ...IN, hl: -1 }, 'aboard another\'s ship');
  assert.equal(validSerpentIn({ ...IN, sx: Infinity }), null);
  assert.equal(validSerpentIn({ ...IN, lv: 0 }), null);
  assert.deepEqual(validSerpentIn({ k: 'hit', d: 12.5, z: ZONES.head, q: 9 }), { k: 'hit', d: 12.5, z: 1 });
  assert.equal(validSerpentIn({ k: 'hit', d: SERPENT_DMG_WIRE_MAX + 1, z: 0 }), null);
  assert.equal(validSerpentIn({ k: 'hit', d: 0, z: 0 }), null);
  assert.equal(validSerpentIn({ k: 'hit', d: 5, z: 3 }), null);
  assert.deepEqual(validSerpentIn({ k: 'held', i: 3, x: 10, z: -4 }), { k: 'held', i: 3, x: 10, z: -4 });
  assert.deepEqual(validSerpentIn({ k: 'esc', i: 3, x: 1 }), { k: 'esc', i: 3 });
  assert.equal(validSerpentIn({ k: 'esc', i: 0 }), null);
  assert.deepEqual(validSerpentIn({ k: 'wr', w: 1, i: 4 }), { k: 'wr', w: 1 });
  assert.deepEqual(validSerpentIn({ k: 'wr', w: 0 }), { k: 'wr', w: 0 });
  for (const w of [2, -1, true, '1', undefined]) assert.equal(validSerpentIn({ k: 'wr', w }), null, `wreck word ${w}`);
  assert.equal(validSerpentIn({ k: 'spent', d: 3 }), null);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'serpent', ...IN }), { hasHello: true }), { t: 'serpent', ...IN });
  assert.equal(parseClient(JSON.stringify({ t: 'serpent', ...IN }), { hasHello: false }).error, 'serpent before hello');
  assert.equal(parseClient(JSON.stringify({ t: 'serpent', k: 'hit', d: -1, z: 0 }), { hasHello: true }).error, 'bad serpent');
  // PIN MOVED (AUDIT 2 XC2, 2026-10-06): the first relay whose serpent this client fights is SERPENT3's own law's (world173 -
  // world172 at the audit, renumbered past main's WATCH-FIX at the merge),
  // no longer the first that keeps a fight (SERPENT1's world165) - it fought an older brain on a release day
  assert.equal(SERPENT_RELAY_MIN, 173);
  assert.ok(relayVersionAtLeast(SERPENT_RELAY_MIN), 'the relay this tree builds holds a serpent');
  assert.equal(RELAY_VERSION, 'world241');   // PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels, `chat:trade` and `chat:lfg`, joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub's hello and leave without a walk of every socket; a busy refusal's token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc's lane 3 - world186 on its branch, renumbered past SD-HERALD's world186 and WAGONS1's world187 at the merge); CHAP4c moved it on last (world183: the chapters' seats' titles - five ids and their claim on the token; NOT YET DEPLOYED - world177, world178, world179, world180, world181 then world182 on its branch, renumbered past THE WROTHGARIAN ZONE's, TAVERN CARDS', HOURS-FIRST's, TAVERN-TABLES', TV-BEYOND's and CARDS10's at the merges of main); CARDS10 moved it on (world182: Iliac Hand's season board, its champion's title in the token's vocabulary); TV-BEYOND moved it on (world181: the world's pixels on the wire Tamriel's, not the Bay's); TAVERN-TABLES moved it on (world180: the gold table an index - two card tables a tavern); HOURS-FIRST moved it on (world179: Hour's First and The First Hour in the token's vocabulary); TAVERN CARDS moved it on (world178: the card tables); THE WROTHGARIAN ZONE moved it on (world177: the open zone, its halls and its giants); SUPER-DUNGEONS moved it on (world176: the Super Dungeons arc, one version - SD-ONLINE first: a dungeon re-laid at the size the world gives it, small or medium, stands in a room of its own, so a page that lays it whole shares no stream and no memory with it; world171 on its branch, renumbered past CRYSTAL-FIST's world171 at one merge and past WATCH-FIX's world172, SERPENT3's world173 and LEGACY7's world174 at the next, and past TEXT-F1's world175 at the one after; TEXT-F1 moved it on (world175: the words a player types starred in sanitizeChat and wordsLine, a custom class the filter catches dropped from a look); LEGACY7 moved it on (world174: the house on the token and the row - world172 on its branch, renumbered past WATCH-FIX's world172 and SERPENT3's world173 at the merge); SERPENT3 moved it on (world173: the sea serpent brain swims every leg it shows - no leap - a slept fight taken up where it was and a blow judged where it struck; its law version 2; world171 on its branch, renumbered past CRYSTAL-FIST's world171 and WATCH-FIX's world172 at the merges); WATCH-FIX moved it on (world172: the foe record names the living-world resident a watchman stands for, `lr`); CRYSTAL-FIST moved it on (world171: the Crystal Fist's title and glyph and the Crystal Resonance's aura join the token's vocabulary - a relay before it refuses Flylighter's token; world170 on its branch, renumbered past FEUD's world170 at the merge); FEUD moved it on (world170: the foe record's wind-ups, staggers and blow classes and a revenant's adaptations, weakness, last stand, band follower, blows and signature - TELL8, AUDIT TELL, RVN13 and FEUD WIRE, world162-world165 on its branch, renumbered past main's world169 at its merge); AUDIT ARENA-LADDER moved it on (world169: the arena ladder audit - elite champions, telegraphed blows, a judging floor and the attempt ticket - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (world168: the Seraph Wings join the aura vocabulary of the token - a relay before it refuses the token of a developer wearing them); SHADOW-CLOAK moved it on (world167: the cloak's aura word on the token - world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges); SERPENT2 moved it on (world166: the serpent herald)
  assert.ok(relaySupportsSerpent('world173') && !relaySupportsSerpent('world172') && !relaySupportsSerpent('world165') && !relaySupportsSerpent(undefined));
  let b = null, pass = 0;
  for (let i = 0; i < 40; i++) { const g = serpentGate(b, 1000); b = g.bucket; if (g.pass) pass++; }
  assert.equal(pass, SERPENT_HZ_MAX, 'the frames\' own bucket');
});

test('SERPENT1 wire: the cell\'s every word projected for the client - a state the brain makes passes whole, its bounds the brain\'s own (pinned equal), a refusal a closed list of words, a receipt its prefix and length; anything else is nothing (mutants: a leg\'s turn unbounded; the legs uncapped; a word invented)', () => {
  assert.equal(SERPENT_LEGS_MAX, LEGS_KEPT * 2);
  assert.equal(SERPENT_MODES_MAX, MODES_KEPT);
  assert.equal(SERPENT_ATTACKS, SERPENT_ATTACK_BY_ID.length);
  assert.equal(SERPENT_MODES, MODE_NAMES.length);
  assert.equal(SERPENT_CHART_MAX, SERPENT_DAMAGE_CHART_MAX);
  assert.equal(SERPENT_RECEIPT_WIRE_MAX, SERPENT_RECEIPT_MAX);
  assert.deepEqual(SERPENT_OUT_KINDS, ['st', 'sw', 'dv', 'atk', 'hp', 'ph', 'coil', 'ch', 'cb', 'cr', 'cx', 'mael', 'fell', 'gone', 'no', 'rcpt', 'bd']);   // PIN MOVED (INT13): and the count's wreck
  const leg = { k: 1, at: 1000, x: 10, z: -20, yw: 0.5, v: 11, r: 60, sd: -1, j: 1 };
  assert.deepEqual(validSerpentOut({ k: 'sw', l: leg }), { k: 'sw', l: leg });
  assert.equal(validSerpentOut({ k: 'sw', l: { ...leg, sd: 0 } }), null);
  assert.equal(validSerpentOut({ k: 'sw', l: { ...leg, x: 9e9 } }), null);
  assert.deepEqual(validSerpentOut({ k: 'dv', at: 5, m: 3 }), { k: 'dv', at: 5, m: 3 });
  assert.equal(validSerpentOut({ k: 'dv', at: 5, m: 6 }), null);
  assert.deepEqual(validSerpentOut({ k: 'no', m: 'too far from its waters' }), { k: 'no', m: 'too far from its waters' });
  assert.equal(validSerpentOut({ k: 'no', m: 'go away' }), null);
  assert.ok(SERPENT_NO_WORDS.includes('reload'));
  assert.equal(validSerpentOut({ k: 'rcpt', r: 'r1.abc.def' }), null, 'a gate\'s receipt is not a serpent\'s');
  assert.deepEqual(validSerpentOut({ k: 'rcpt', r: 'l1.abc.def' }), { k: 'rcpt', r: 'l1.abc.def' });
  assert.equal(validSerpentOut({ k: 'wrath', at: 5 }), null);
  // a state the brain made, round-tripped
  const st = {
    k: 'st', d: 363, b: 'sethrakul', sx: 1e6, sz: 2e6, ph: 2, h: 100, m: 400, legs: [leg, { k: 0, at: 2000, x: 1, z: 2, yw: 0, v: 11 }], modes: [{ at: 1000, m: 1 }],
    coil: { i: 4, s: 'acct-0001', x: 0, z: 0, th: 0.2, at: 3000, until: 27000, off: 0, h: 50, m: 60 }, mael: null,
    atk: { i: 4, a: 4, at: 3000, x: 5, z: 6, yw: 1, tg: [[0, 0]], s: 'acct-0001' }, sh: 0, su: 0, sa: 9e12, n: 2, op: 1000,
    fell: { at: 9000, top: ['A', 'B'], n: 2, dm: [{ n: 'A', h: 4, d: 300, c: 40, x: 9, b: 50 }] }, gone: null,
  };
  assert.deepEqual(validSerpentOut(st), st);
  assert.equal(validSerpentOut({ ...st, legs: Array(SERPENT_LEGS_MAX + 1).fill(leg) }), null);
  assert.equal(validSerpentOut({ ...st, coil: { ...st.coil, h: 70 } }), null, 'a coil with more health than its whole');
  assert.equal(validSerpentOut({ ...st, fell: { ...st.fell, dm: [{ n: 'A', h: 4, d: 3, c: 40, x: 9, b: 50 }] } }), null, 'a chart row whose coils outweigh its whole');
  assert.equal(validSerpentOut({ ...st, h: 500 }), null);
  assert.deepEqual(validSerpentOut({ k: 'fell', at: 9, top: ['Ama'], n: 3, d: 363 }), { k: 'fell', at: 9, top: ['Ama'], n: 3, d: 363 });
  // AUDIT SERPENT S1: the hub's kill names its site - both halves or neither
  assert.deepEqual(validSerpentOut({ k: 'fell', at: 9, top: [], n: 3, d: 363, sx: 1e6, sz: 2e6 }), { k: 'fell', at: 9, top: [], n: 3, d: 363, sx: 1e6, sz: 2e6 });
  assert.equal(validSerpentOut({ k: 'fell', at: 9, top: [], n: 3, d: 363, sx: 1e6 }), null, 'half a site');
  assert.equal(validSerpentOut({ k: 'fell', at: 9, top: [], n: 3, d: 363, sx: 1e6, sz: 9e12 }), null, 'a site off the world');
  assert.deepEqual(validSerpentOut({ k: 'no', m: 'it is already slain' }), { k: 'no', m: 'it is already slain' });
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════

const DAY = 363;
const TT = serpentTimes(DAY);
const PX = 205, PY = 214;
const SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS;
const CELL = cellRoomOfWire(SX, SZ);
/** A pose `mx` metres east and `mz` north of the site. */
const at = (mx, mz, extra = {}) => ({ x: SX + mx * SERPENT_NATIVE_PER_M, y: 0, z: SZ + mz * SERPENT_NATIVE_PER_M, yaw: 0, pitch: 0, ...extra });
const words = (ws, k) => ws.sent.filter((m) => m.t === 'serpent' && (!k || m.k === k));
const IN = (o = {}) => ({ k: 'in', d: DAY, bv: SERPENT_BRAIN_V, lv: 20, hl: 4, sx: SX, sz: SZ, ...o });
/** The site's fight in the cell's storage, and on the instance (null for none). */
const FIGHT_AT = `${SERPENT_FIGHT_KEY}:${serpentFightId(DAY, serpentSiteKey(SX, SZ))}`;
const fightIn = (r) => r.room._serpents?.get(serpentFightId(DAY, serpentSiteKey(SX, SZ))) ?? null;
async function withSea(fn, { start = TT.riseAt + 20_000 } = {}) {
  // AUDIT SERPENT 2: Date.now patched INSIDE the try - a setup that throws never leaves every later pin on this clock
  const realNow = Date.now; let clock = start;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const r = world.room(CELL);
    const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += SERPENT_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'serpent', ...o }));
    await fn({ world, r, tick, say, now: () => clock, set: (t) => { clock = t; } });
  } finally { Date.now = realNow; }
}

test('SERPENT1 relay: THE JOIN - `in` from a pose by its waters stands the fight in the cell at the site it names and answers the whole state to the one who said it, the VERIFIED account joined with its hull\'s share; the beat goes on the cell\'s alarm and its words reach every fighter and every socket within FAN_R - none past it (mutants: the state fanned to all; the frame\'s name credited; the fan unbounded)', async () => {
  assert.ok(Math.hypot(0, -3600) > FAN_R && cellRoomOfWire(at(0, -3600).x, at(0, -3600).z) === CELL, 'the far socket is in the same cell, past the fan');
  await withSea(async ({ r, tick, say, now }) => {
    const a = r.connect(), b = r.connect(), c = r.connect();
    await r.hello(a, 'peer-0001', at(120, 0)); await r.hello(b, 'peer-0002', at(2000, 0)); await r.hello(c, 'peer-0003', at(0, -3600));
    await say(a, IN());
    const st = words(a, 'st')[0];
    assert.equal(st.d, DAY); assert.equal(st.b, serpentBossOf(DAY).id); assert.equal(st.sx, SX); assert.equal(st.sz, SZ);
    assert.equal(st.m, SERPENT_TTK_S * SHIP_REF[4]);
    assert.ok(fightIn(r).players['acct-peer-0001'], 'the account the token verified');
    assert.equal(r.store.get(FIGHT_AT).day, DAY, 'kept at once');
    assert.equal(words(b).length + words(c).length, 0, 'the state went to its asker alone');
    assert.equal(r.alarm.at, now() + SERPENT_TICK_MS, 'the beat armed');
    // PIN MOVED (SERPENT3): a Rising Maw or a coil chosen first is closed on at the surface (SERPENT_CLOSE_MS at most)
    await tick(Math.ceil((SERPENT_OPENING_MS + SERPENT_CLOSE_MS) / SERPENT_TICK_MS) + 24);
    const heard = words(a).filter((m) => m.k !== 'st');
    assert.ok(heard.some((m) => m.k === 'atk'), 'it struck after its opening');
    assert.deepEqual(words(b).filter((m) => m.k !== 'st'), heard, 'the watcher on the headland heard every word');
    assert.equal(words(c).length, 0, 'past FAN_R, nothing');
    assert.equal(r.alarm.at, now() + SERPENT_TICK_MS, 'the beat goes on while it is heard');
  });
});

test('SERPENT1 relay: THE REFUSALS - a game older than its law (`reload`), a day the clock is not about, a pose too far from its waters, a site in another cell (junk - no fight stood); and SERPENT4 - once the storm has broken over its waters a newcomer still joins (mutants: each refusal removed; the storm closing its waters)', async () => {
  await withSea(async ({ r, say, set }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(100, 0));
    await say(a, IN({ bv: 0 }));
    assert.deepEqual(words(a).at(-1), { t: 'serpent', k: 'no', m: 'reload' });
    await say(a, IN({ d: DAY + 2 }));
    assert.deepEqual(words(a).at(-1), { t: 'serpent', k: 'no', m: 'the serpent is gone' });
    await say(a, IN({ sx: SX + 20 * PIXEL_UNITS }));
    assert.equal(r.room._serpents?.size ?? 0, 0, 'a site in another cell stands nothing here');
    // ...even one a stone's throw over the cell's edge from a pose inside it
    const edgeM = (Math.floor(PX / 16) * 16 + 15.8 - (PX + 0.5)) * (PIXEL_UNITS / SERPENT_NATIVE_PER_M);
    const edge = r.connect(); await r.hello(edge, 'peer-0004', at(edgeM, 0));
    assert.equal(cellRoomOfWire(at(edgeM, 0).x, at(edgeM, 0).z), CELL);
    const over = SX + (Math.floor(PX / 16) * 16 + 16.3 - (PX + 0.5)) * PIXEL_UNITS;
    assert.notEqual(cellRoomOfWire(over, SZ), CELL);
    assert.ok(Math.abs(over - at(edgeM, 0).x) / SERPENT_NATIVE_PER_M < ADMIT_R, 'within sight of the site it names');
    await say(edge, IN({ sx: over }));
    assert.equal(r.room._serpents?.size ?? 0, 0, 'a site over the edge stands nothing here');
    const far = r.connect(); await r.hello(far, 'peer-0002', at(ADMIT_R + 100, 0));
    await say(far, IN());
    assert.deepEqual(words(far).at(-1), { t: 'serpent', k: 'no', m: 'too far from its waters' });
    assert.equal(fightIn(r), null);
    await say(a, IN());
    assert.ok(fightIn(r).players['acct-peer-0001']);
    set(TT.sealAt + 1);
    const late = r.connect(); await r.hello(late, 'peer-0003', at(200, 0));
    await say(late, IN());
    // PIN MOVED (SERPENT3): a fight not stepped since its birth (no beat in fifteen minutes) is taken up circling where
    // it was before she is shown it (serpentBrain.js serpentResume) - its swim and its ride said first, to her too
    // PIN MOVED (SERPENT4, the players: "The fact they block ships getting in after a while is stupid"): its waters are
    // open until it dives - she is shown it and joins
    assert.deepEqual(words(late).map((m) => m.k), ['sw', 'dv', 'st']);
    assert.ok(fightIn(r).players['acct-peer-0003'], 'a ship after the storm joins');
  });
});

test('SERPENT1 relay: A BLOW - believed as far as the brain allows from where the socket\'s OWN pose stands: before `in` it is not heard, a dead pose lands nothing; the coiled ship\'s word is hers alone (mutants: the frame trusted for where it stood; the dead striking)', async () => {
  await withSea(async ({ r, tick, say }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(150, 0));
    await say(a, { k: 'hit', d: 50, z: 0 });
    assert.equal(fightIn(r), null, 'no fight, nothing');
    await say(a, IN());
    const f = fightIn(r);
    await tick(2);
    // the serpent cruising round its waters' heart: a blow from 150 m lands
    f.legs = [{ k: 1, at: Date.now() - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }];
    f.modes = [{ at: Date.now() - 30_000, m: 1 }];
    await say(a, { k: 'hit', d: 50, z: 0 });
    assert.equal(f.players['acct-peer-0001'].dealt, 50);
    await r.pose(a, at(150, 0, { dd: 1 }));
    await say(a, { k: 'hit', d: 50, z: 0 });
    assert.equal(f.players['acct-peer-0001'].dealt, 50, 'the dead strike nothing');
  });
});

test('SERPENT1 relay: THE KILL - said once to everyone about it, a receipt to exactly the accounts that serpentEarned one (signed by GATE_SIGNING_KEY, its hull and level in it), the fight checkpointed with them, the hub\'s word to everyone online and to a hello while its day holds; a fighter back at an `in` is handed theirs again; the fight forgotten after its keeping (mutants: a receipt to one who serpentEarned nothing; the hub told nothing; said twice; the hello told nothing, or told past its day)', async () => {
  const kp = await keypair();
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  await withSea(async ({ world, r, tick, say, now, set }) => {
    r.env.GATE_SIGNING_KEY = pkcs8;
    const hub = world.room(SOCIAL_ROOM);
    const h9 = hub.connect(); await hub.hello(h9, 'peer-0009');
    const a = r.connect(), w = r.connect(), idle = r.connect();
    await r.hello(a, 'peer-0001', at(120, 0)); await r.hello(w, 'peer-0002', at(900, 900)); await r.hello(idle, 'peer-0003', at(0, 1300));
    await say(a, IN({ lv: 33 }));
    await say(idle, IN());   // in its fight, never within its engagement: it stood nothing and dealt nothing
    const f = fightIn(r);
    await tick(1);
    f.legs = [{ k: 1, at: now() - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }];
    f.modes = [{ at: now() - 30_000, m: 1 }];
    f.hp = 5; f.nextAt = Infinity;
    await say(a, { k: 'hit', d: 40, z: 0 });
    const fell = words(a, 'fell');
    assert.equal(fell.length, 1);
    assert.deepEqual(words(w, 'fell'), fell, 'the watcher heard it');
    const mine = words(a, 'rcpt');
    assert.equal(mine.length, 1);
    assert.equal(words(w, 'rcpt').length, 0);
    assert.ok(fightIn(r).players['acct-peer-0003'], 'the idle ship is a fighter');
    assert.equal(words(idle, 'fell').length, 1, 'it heard the kill');
    assert.equal(words(idle, 'rcpt').length, 0, 'and serpentEarned no receipt');
    const ok = await verifySerpentReceipt(mine[0].r, kp.publicKey, { subtle, nowS: Math.floor(now() / 1000) });
    assert.equal(ok.ok, true);
    assert.deepEqual([ok.claims.s, ok.claims.d, ok.claims.b, ok.claims.h, ok.claims.l], ['acct-peer-0001', DAY, 'sethrakul', 4, 33]);
    assert.equal(r.store.get(FIGHT_AT).said, true, 'checkpointed with the kill');
    assert.equal(r.store.get(FIGHT_AT).told, true, 'the hub answered');
    assert.deepEqual(words(h9, 'fell'), [{ t: 'serpent', k: 'fell', at: fell[0].at, top: fell[0].top, n: 2, d: DAY, sx: SX, sz: SZ }], 'everyone online, its site named');
    const late = hub.connect(); await hub.hello(late, 'peer-0010');
    assert.deepEqual(words(late, 'fell'), words(h9, 'fell'), 'a hello while its day holds hears it');
    await tick(4);
    assert.equal(words(a, 'fell').length, 1, 'said once');
    const back = r.connect(); await r.hello(back, 'peer-0001', at(100, 0));
    await say(back, IN());
    assert.deepEqual(words(back, 'rcpt').map((m) => m.r), [mine[0].r], 'handed again');
    // its keeping's end: the cell forgets it
    set(TT.soundAt + SERPENT_DIVE_MS + 2 * 60 * 60 * 1000 + 1);
    await r.fire();
    assert.equal(r.store.has(FIGHT_AT), false);
    const later = hub.connect(); await hub.hello(later, 'peer-0011');
    assert.equal(words(later, 'fell').length, 0, 'its day over, a hello hears nothing');
  });
});

test('SERPENT1 relay: THE CELL\'S OTHER DUTIES STILL RUN under a serpent\'s beat - its alarm the sooner of the beat and what they arm, the cell\'s raid sweep run while the fight beats; a cell with no serpent keeps its alarm as before (mutants: the beat displacing the rest for good; the rest run every beat)', async () => {
  await withSea(async ({ r, tick, say, now }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(120, 0));
    await say(a, IN());
    let sweeps = 0;
    const sweep = r.room._raidSweep.bind(r.room);
    r.room._raidSweep = async (t) => { sweeps++; return sweep(t); };
    await tick(40);   // ten seconds of beats
    assert.ok(sweeps >= 1 && sweeps <= 3, `the rest ran ${sweeps} times in ten seconds of beats`);
    assert.ok(r.alarm.at <= now() + SERPENT_TICK_MS);
  });
  assert.match(src('server/src/index.js'), /const sp = await this\._serpentTick\(\);\n\s+if \(sp\) \{/);
});

// ═══ THE BOOKS ═══════════════════════════════════════════════════════════════════════════════════

const MIGRATIONS = readdirSync(new URL('../../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...x) { args = x; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const res = stmt.run(...args); return { meta: { changes: Number(res.changes) } }; },
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
const T0S = 1_800_000_000;
const guest = async (db) => (await createGuest({ db, subtle, rand, nowS: T0S }, { deviceLabel: null })).id;
let handles = 0;
const member = async (db) => {
  const id = await guest(db);
  const h = `Captain${++handles}`;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
  return { id, handle: h };
};
async function relayPair() {
  const kp = await keypair();
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }), pub };
}
const serpentFor = (s, priv, d = DAY, nowS = T0S) => mintSerpentReceipt({ d, b: 'sethrakul', s, c: 99, x: 'dealt', h: 4, l: 20 }, priv, { subtle, nowS });
const CH = 'char-0001';
const CID = '0123456789abcdef', CID2 = 'fedcba9876543210';

test('SERPENT1 books: a serpent is worth RENOWN_SERPENT_QUESTS quests at the top quest level - twice a town defended; counted ONCE a serpent an account, paid to the character that fought it; a guest is not counted but given its hoard once; another\'s receipt, a forged one and no character are refused (mutants: the key on the receipt\'s seed; a guest counted; the hoard given twice)', async () => {
  assert.equal(RENOWN_SERPENT_QUESTS, 6);
  assert.equal(renownSerpentXp(10), 2 * renownRaidXp(10));
  const db = d1();
  const ctx = { db, nowS: T0S, subtle, rand };
  const { priv, pubKey } = await relayPair();
  const m = await member(db);
  const r = await serpentFor(m.id, priv);
  const first = await claimSerpent(ctx, m, { receipt: r, character: CH, name: 'Ann', cid: CID }, pubKey);
  assert.equal(first.recorded, true); assert.equal(first.slain, 1); assert.equal(first.spoils, true);
  assert.equal(first.renown.credited, renownSerpentXp(1));
  const again = await claimSerpent(ctx, m, { receipt: await serpentFor(m.id, priv, DAY, T0S + 1), character: CH, cid: CID2 }, pubKey);
  // PIN MOVED (AUDIT 625 P4): a repeat says the row's embers - none here: the first claim said none (a build from before them)
  assert.deepEqual(again, { recorded: false, why: 'claimed', slain: 1, spoils: false, stones: 0 }, 'one a serpent, whatever receipt says it - and its hoard was the first device\'s');
  assert.equal((await claimSerpent(ctx, m, { receipt: r, character: CH, cid: CID }, pubKey)).spoils, true, 'the same device asking again is answered the same');
  const next = await claimSerpent(ctx, m, { receipt: await serpentFor(m.id, priv, DAY + 2), character: CH, cid: CID }, pubKey);
  assert.equal(next.recorded, true); assert.equal(next.slain, 2, 'the next serpent counts');
  assert.deepEqual(await serpentRecordOf(ctx, m.id), { slain: 2 });
  // AUDIT SERPENT (the books): a hand who STOOD the fight out is paid SERPENT_STOOD_RENOWN of a serpent's Renown
  assert.equal(SERPENT_STOOD_RENOWN, 0.5);
  const hand = await member(db);
  const stood = await claimSerpent(ctx, hand, { receipt: await mintSerpentReceipt({ d: DAY, b: 'sethrakul', s: hand.id, c: 5, x: 'stood', h: -1, l: 20 }, priv, { subtle, nowS: T0S }), character: CH, cid: CID }, pubKey);
  assert.equal(stood.recorded, true);
  assert.equal(stood.renown.credited, Math.floor(renownSerpentXp(1) * SERPENT_STOOD_RENOWN), 'half');
  assert.ok(stood.renown.credited < first.renown.credited);
  // the gate's table is not the serpent's: a gate kill the same day is a row of its own
  assert.equal(db._raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'serpent_kills'").get().n, 1);
  const g = await guest(db);
  const rg = await serpentFor(g, priv);
  assert.deepEqual(await claimSerpent(ctx, { id: g, handle: null }, { receipt: rg, character: CH, cid: CID }, pubKey), { recorded: false, why: 'guest', slain: 0, spoils: true });
  assert.equal((await claimSerpent(ctx, { id: g, handle: null }, { receipt: rg, character: CH, cid: CID2 }, pubKey)).spoils, false, 'once');
  assert.deepEqual(await claimSerpent(ctx, m, { receipt: rg, character: CH }, pubKey), { error: 'not-yours' });
  // a signature character changed well inside it - its last three can already be 'AAA' (the top of Ed25519's S is
  // under 0x10), about one key in a thousand (cards10_relay.test.js's receipt, the same)
  const cut = r.length - 10;
  assert.equal((await claimSerpent(ctx, m, { receipt: r.slice(0, cut) + (r[cut] === 'A' ? 'B' : 'A') + r.slice(cut + 1), character: CH }, pubKey)).error, 'receipt');
  assert.deepEqual(await claimSerpent(ctx, m, { receipt: await serpentFor(m.id, priv, DAY + 4), character: '' }, pubKey), { error: 'renown-character' });
  assert.deepEqual(await claimSerpent(ctx, m, { receipt: r, character: CH }, null), { error: 'no-gate-key' });
});

test('SERPENT1 books: the worker\'s /v1/serpent/claim behind a session and never open - the session is the claimant, a rise comes back with a signed order, the cards say the serpents slain; the device carries a receipt until it settles (mutants: the route open; the body\'s account believed; a settled receipt offered again)', async (t) => {
  let clock = T0S * 1000;
  t.mock.method(Date, 'now', () => clock);
  const { priv, pub } = await relayPair();
  _resetKeyForTests();
  const kp = await keypair();
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', GATE_PUBLIC_KEY: pub };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  assert.ok(ROUTES.has('/v1/serpent/claim') && !OPEN_ROUTES.has('/v1/serpent/claim'));
  const me = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'Captain', password: 'correct horse battery', ...ACCEPTED }, me.secret)).status, 200);
  const r = await serpentFor(me.id, priv);
  assert.equal((await call('POST', '/v1/serpent/claim', { receipt: r, character: CH })).status, 401, 'a stranger claims nothing');
  const ok = await call('POST', '/v1/serpent/claim', { receipt: r, character: CH, name: 'Ann', cid: CID }, me.secret);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.recorded, true); assert.equal(ok.body.slain, 1); assert.equal(ok.body.renown.rose, true);
  assert.ok(typeof ok.body.order === 'string' && ok.body.order.length > 20, 'a rise carries its signed order');
  const card = await call('GET', '/v1/account', undefined, me.secret);
  assert.deepEqual(card.body.account.serpents, { slain: 1 });
  assert.equal(serpentRecordText({ slain: 1 }), '1'); assert.equal(serpentRecordText({ slain: 0 }), 'None yet'); assert.equal(serpentRecordText(null), null);
  // the device's carrier
  const store = new Map();
  const asked = [];
  const claims = createSerpentClaims({
    claim: async (rr, ch, nm, cid) => { asked.push(rr); return rr === r ? { ok: true, data: { recorded: true, slain: 1, renown: { credited: 9 }, spoils: true } } : { ok: false, error: 'offline' }; },
    store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) },
    nowS: () => T0S, nowMs: () => clock, me: () => me.id,
  });
  assert.equal(claims.add(r, CH, 'Ann', 20), true);
  await claims.flush();
  await new Promise((done) => setImmediate(done));   // the offer the add began, its hoard's grant awaited (AUDIT SERPENT D6)
  assert.equal(claims.kept().length, 0, 'settled');
  assert.equal(claims.add(r, CH, 'Ann', 20), false, 'never again on this device');
  assert.equal(serpentClaimVerdict({ ok: true, data: { why: 'guest' } }), 'keep');
  assert.equal(serpentClaimVerdict({ ok: false, error: 'receipt', why: 'expired' }), 'done');
  assert.equal(serpentClaimVerdict({ ok: false, error: 'receipt', why: 'signature' }), 'keep');
  assert.ok(SERPENT_CLAIMS_KEY && SERPENT_CLAIM_RETRY_MS > 0);
  assert.equal(typeof accountSerpents({ fetch, storage: null }).claim, 'function');
  assert.ok(serpentStateOf && SERPENT_ATTACK_BY_ID.length === 8);
});
