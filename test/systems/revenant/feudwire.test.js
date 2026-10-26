// FEUD WIRE (bible/12-Enhanced-AI/Feud-Arc.md section 25 and the FEUD WIRE record; Mac, 2026-10-05: "Take care of both
// gaps"). Online, a revenant's blows at a PEER were its kind's plain ones: its owner's `damageScale` - its rank's, its
// wrath's, a Night-stalker's night, phase two's x1.2 - rode no wire, and a signature landed at its shape's multiplier.
// Now the foe record carries its stand's blows (`rb`, per mille - systems/revenant/revenantFeud.js BLOWS_WIRE) and a wind-up its
// signature (`wk` +64, ai/puppetBlows.js WIRE_SIG); the puppet stands with them on its own scale (its kind's, its
// elite's, its champion's - never twice), so a peer is struck as its owner would be. Relay world165.
// Pinned: the law; the owner's stand and its restamp; the writer and the heir's write-back; the puppet's fold (said
// again, changed, withdrawn; on an elite's); the real door's damage; the signature both ways; the hosts' seams.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../../src/systems/revenant/revenant.js');
const F = await import('../../../src/systems/revenant/revenantFeud.js');
const Wire = await import('../../../src/net/wire.js');
const PB = await import('../../../src/ai/puppetBlows.js');
const { makeBlow, resetBlows, blowScaled, BLOW, IRON_COLOR } = await import('../../../src/ai/foeBlows.js');
const { setTacticsClock, resetTactics } = await import('../../../src/ai/tactics.js');
const { calculateAttackDamage } = await import('../../../src/combat/formulas.js');
const { makeEnemyEntity } = await import('../../../src/characters/enemy/enemyEntity.js');
const { ENEMY_BASICS } = await import('../../../src/characters/enemy/enemyBasics.js');
const { promoteEliteFoe } = await import('../../../src/systems/eliteFoes.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { MOBILE_TYPES: M } = await import('../../../src/characters/mobile/mobileTypes.js');
const { makePlayer } = await import('../../../tools/tellDuel.mjs');

const { createExteriorFoes } = await import('../../../src/scenes/exteriorFoes.js');
const { FOES_STALE_MS } = await import('../../../src/net/online.js');

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
// the real street pool on a crafted MONSTER.BSA (auditfeud2's rig)
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const poolRig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { isPlayer: true, level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5,
});
const netFor = () => ({ room: () => 'world:3,12', now: () => 0, staleMs: FOES_STALE_MS, onPeerHit: (h, fate) => { fate?.sent?.(); return true; }, toWire: (p) => p, toScene: (p) => p });
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
let T = 10;
setTacticsClock(() => T);
const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-feudwire', level: 8, items: [] };
beforeEach(() => { _resetForTests(); setPref('lootRarity', true); setPref('enhancedAI', true); N._resetRevenantForTests(); _store.clear(); resetTactics(); resetBlows(); T = 10; });
/** A rank-`rank` revenant in `wrath` stood on a real entity (its kind's scale `prior` before it). */
function stood(rank = 3, wrath = 0, prior = undefined) {
  const r = N.revenantDeed(me, { mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  r.rank = rank; r.wrath = wrath;
  const entity = { mobileType: M.Orc, level: 6, health: 60, maxHealth: 60, team: 'Monster', items: [], ...(prior ? { damageScale: prior } : {}) };
  N.applyRevenant(entity, r);
  return { entity, r };
}

test('FEUD WIRE THE LAW: `rb` a whole per mille from x1 to x4 (the writer\'s bounds the reader\'s); `wk` +64 a signature - each refused whole outside it (mutants: a bound dropped; the flag past the law)', () => {
  assert.equal(PB.WIRE_SIG, 64);
  assert.deepEqual({ ...F.BLOWS_WIRE }, { PER: 1000, MIN: 1000, MAX: 4000 });
  assert.equal(Wire.FOE_BLOWS_MIN, F.BLOWS_WIRE.MIN);
  assert.equal(Wire.FOE_BLOWS_MAX, F.BLOWS_WIRE.MAX);
  assert.equal(Wire.RELAY_VERSION, 'world267');   // PIN MOVED: world267, KETCH-WORDS (the Sky-Ketch herald cards reworded, the ship no longer she; NOT YET DEPLOYED); PIN MOVED: world266, AUDIT KETCH II (the airship raid: the whole state word carries the wave to five, a sweep by the ship says sw, the number of a voyage is a receipt bound, the last minutes of her crews forty-five, a fight lost after two minutes, the receipts of a fall told before her record goes; world265 on its branch, renumbered past GATE-COURTS at the merge; NOT YET DEPLOYED); PIN MOVED: world265, GATE-COURTS (the night of a gate held in courts of fifty, each seated by the book of the first; NOT YET DEPLOYED); PIN MOVED: world264, REWARD-KILLS (a staff event reward is earned by three kills alone; world258 then world262 on its branch, renumbered past world258-world263 at the merges; NOT YET DEPLOYED); PIN MOVED: world263, HIBERNATE (a quiet cell sleeps, a freeze or mute asks its lease with the door off; world260/world261 on its branch, renumbered past THE FOLD's world260, #1281's world261 and #1238's world262 at the merges); PIN MOVED: world261, EVENT-RULES, BOSS-TRAITS and RAID5 (a realm keeps a death down two minutes for a Resurrect by a friend, SD_REZ_MS; a foe record carries its boss traits bt, its wrath bw and the leader of a raid rl; NOT YET DEPLOYED); PIN MOVED: world259, ASK-LONGER (the word of the company open 30 s, net/eliteGates/egRun.js EG_ASK_MS; world257 on its branch, renumbered past STAFF-EVENT BOSS and KETCH-LONGER at the merge; NOT YET DEPLOYED); PIN MOVED: world258, KETCH-LONGER (the raid retuned: five Watch waves, the wire takes a wave to five; world257 on its branch, renumbered past STAFF-EVENT BOSS at the merge; NOT YET DEPLOYED); PIN MOVED: world257, STAFF-EVENT BOSS (the mini boss stood again when lost, called each time the meter fills, an exact health hp; NOT YET DEPLOYED); PIN MOVED: world256, STAFF-EVENT (staff events: the hub book, a place kill meter, the mini boss; world255 on its branch, renumbered past KETCH at the merge; NOT YET DEPLOYED); PIN MOVED: world255, KETCH (the sky-ketch frame kt in the room of a crew ship, validKetchIn and validKetchOut; world253 on its branch, renumbered past ROCKET1's world253 and AUDIT FOE-KEEPS' world254 at the merge; NOT YET DEPLOYED); PIN MOVED: world254, AUDIT FOE-KEEPS (the open zone kill credit: the word of a fighter that left the zone dying, dd; NOT YET DEPLOYED); PIN MOVED: world253, ROCKET1 (the live event word `rocket`; NOT YET DEPLOYED); PIN MOVED: world252, DECK-POSE (a pose carries its place aboard a boat, validPose `ab`; NOT YET DEPLOYED); PIN MOVED: world251, AUDIT MIXED-PAIR / SPELL-HAND (world249 on its branch, renumbered past STAFF-PANEL5-MONSTERS and HERALD-CARDS at the merge - validPose carries `ah`, the left hand of a pair struck last, so the peers draw a pair in both hands); PIN MOVED: world250, HERALD-CARDS (world243 on its branch, renumbered past PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES, STAFF-PANEL5, AUDIT EG-FALL and STAFF-PANEL5-MONSTERS at the merge - every herald post one card of its family - its title, its facts as fields, its colour - and each family a thread of its own in the world events channel, the relay settings gateThread, serpentThread, sdThread and egThread; net/herald/heraldCard.js joins the bundle); PIN MOVED: world249, STAFF-PANEL5-MONSTERS (the staff panel Monster watch counts monsters whatever grantStrip says, and its batch says measured; NOT YET DEPLOYED; world248 on its branch, renumbered past AUDIT EG-FALL at the merge); PIN MOVED: world248, AUDIT EG-FALL (world240 on its branch, renumbered past GUILD-CAP, SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES and STAFF-PANEL5 at the merge - a felled Elite Breach lord lies where it fell - net/eliteGates/egLords.js egLordHit stops its walk at its fall, egStop; no word changed); PIN MOVED: world247, STAFF-PANEL5 (the staff panel relay release: follow, Message on screen, the feeds, the staff cut, hidden staff, freeze and the staff chat; NOT YET DEPLOYED); PIN MOVED: world246, SEA VENTURES (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges - the Eltheric Ocean ventures, one relay: the hub reads a vault of the deep by its cell, a fall signs its room, the referee judges a broadside); PIN MOVED: world245, AUDIT PISTOLET (the siege referee knows the top of the Dwarven Pistolet - SIEGE_PISTOLET - and a duel shot from the off hand of a pair carries the DUAL terms, `off` on a shot as on a swing; world242 on its branch, renumbered past LEASE1, PARTY-PING and SPAWN-THIN at the merge); PIN MOVED: world244, SPAWN-THIN (the overworld keep drops a quarter of the spawn band; world242 on its branch, renumbered past PARTY-PING world243 at the merge); PIN MOVED: world243, PARTY-PING (validPartyPose carries pg); PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels, `chat:trade` and `chat:lfg`, joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub's hello and leave without a walk of every socket; a busy refusal's token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc's lane 3 - world186 on its branch, renumbered past SD-HERALD's world186 and WAGONS1's world187 at the merge); CHAP4c moved it on last (world183: the chapters' seats' titles - five ids and their claim on the token; NOT YET DEPLOYED - world177, world178, world179, world180, world181 then world182 on its branch, renumbered past THE WROTHGARIAN ZONE's, TAVERN CARDS', HOURS-FIRST's, TAVERN-TABLES', TV-BEYOND's and CARDS10's at the merges of main); CARDS10 moved it on (world182: Iliac Hand's season board, its champion's title in the token's vocabulary); TV-BEYOND moved it on (world181: the world's pixels on the wire Tamriel's, not the Bay's); TAVERN-TABLES moved it on (world180: the gold table an index - two card tables a tavern); HOURS-FIRST moved it on (world179: Hour's First and The First Hour in the token's vocabulary); TAVERN CARDS moved it on (world178: the card tables); THE WROTHGARIAN ZONE moved it on (world177: the open zone, its halls and its giants); SUPER-DUNGEONS moved it on (world176: a re-laid dungeon's room of its own - world171 on its branch, renumbered past CRYSTAL-FIST's at one merge and past WATCH-FIX's, SERPENT3's and LEGACY7's at the next; TEXT-F1 moved it on (world175: the words a player types starred in sanitizeChat and wordsLine, a custom class the filter catches dropped from a look); LEGACY7 moved it on (world174: the house on the token and the row - world172 on its branch, renumbered past WATCH-FIX's world172 and SERPENT3's world173 at the merge); SERPENT3 moved it on (world173: the sea serpent brain swims every leg it shows - no leap - a slept fight taken up where it was and a blow judged where it struck; its law version 2; world171 on its branch, renumbered past CRYSTAL-FIST's world171 and WATCH-FIX's world172 at the merges); WATCH-FIX moved it on (world172: the foe record names the living-world resident a watchman stands for, `lr`); CRYSTAL-FIST moved it on (world171: the Crystal Fist's title and glyph and the Crystal Resonance's aura join the token's vocabulary - world170 on its branch, renumbered past FEUD's at the merge); PIN MOVED (FEUD's merge of main): world165 on the branch, renumbered past main's world169
  const v = (extra) => Wire.validFoeRecord({ i: 4, ...extra });
  for (const rb of [1000, 1430, 4000]) assert.deepEqual(v({ rb }), { i: 4, rb });
  for (const rb of [999, 4001, 1430.5, '1430', null]) assert.equal(v({ rb }), null, `rb ${rb}`);
  const w = { wy: 0, wl: 500, wo: [0, 0, 0], wn: 1 };
  assert.equal(v({ ...w, wk: 2 | PB.WIRE_IRON | PB.WIRE_SIG }).wk, 2 | PB.WIRE_IRON | PB.WIRE_SIG, 'an iron signature slam');
  assert.equal(v({ ...w, wk: 0 | PB.WIRE_SIG | PB.WIRE_LANDED }).wk, PB.WIRE_SIG | PB.WIRE_LANDED, 'its landing said after it');
  assert.equal(v({ ...w, wk: 128 }), null, 'past the flags');
});

test('FEUD WIRE THE OWNER\'S STAND: its blows over its kind\'s - its rank\'s and its wrath\'s, never its elite\'s - kept on its stamp, and kept through a deed that stamps it again (mutants: the stand unrecorded; the elite\'s counted; the restamp drops it)', () => {
  const { entity } = stood(3, 2, 2);
  const rk = (n) => 1 + N.REVENANT_DAMAGE_PER_RANK * n;   // UNQUIET (Revenants.md section 46): its rank's blows by the law's number (0.15 a rank)
  assert.ok(near(entity.revenant.blows, rk(3) * (1 + 0.05 * 2)), 'its rank, x1.1 its wrath');
  assert.ok(near(entity.damageScale, 2 * entity.revenant.blows), 'its elite\'s x2 under it - its own');
  assert.ok(near(stood(1).entity.revenant.blows, rk(1)));
  N.revenantDeed(me, entity, 'slew', { mobileType: M.Orc, rolls: () => 0 });
  assert.ok(near(entity.revenant.blows, rk(3) * 1.1), 'a killer over my body still strikes with its stand');
  assert.equal(entity.revenant.rank, 3, 'stamped again - its rank kept: a kill ranks it every second time (UNQUIET)');
});

test('FEUD WIRE THE WRITER AND THE HEIR: `rb` out of the stamp (none at x1; clamped to the law), read back onto a puppet\'s stamp and written again the same by an heir (mutants: rb unwritten; the clamp; the heir\'s copy dropped)', () => {
  assert.deepEqual(F.feudWire({ learned: [], weak: null, blows: 1.43 }), { rb: 1430 });
  assert.deepEqual(F.feudWire({ learned: [], weak: null, blows: 1 }), {}, 'x1: none');
  assert.deepEqual(F.feudWire({ learned: [], weak: null }), {}, 'a plain foe made one by a deed: none');
  assert.deepEqual(F.feudWire({ learned: [], weak: null, blows: 9 }), { rb: 4000 }, 'never past the law (a record refused whole would lose its foe)');
  const { entity } = stood(5, 3);
  const wire = F.feudWire(entity.revenant);
  assert.equal(wire.rb, Math.round((1 + N.REVENANT_DAMAGE_PER_RANK * 5) * 1.15 * 1000));
  assert.ok(Wire.validFoeRecord({ i: 1, ...wire }), 'its rank-5 wrath on the wire');
  const rev = F.feudFromWire({ id: null, name: entity.revenant.name, rank: 0 }, wire);
  assert.equal(rev.blows, wire.rb / 1000);
  assert.equal(F.feudWire(rev).rb, wire.rb, 'an heir writes it back');
  assert.equal(F.feudFromWire(rev, {}).blows, null, 'a record without it: none');
});

test('FEUD WIRE THE PUPPET\'S FOLD: its stand\'s and phase two\'s on its own scale - said again never doubled, changed refolded, withdrawn given back; on an elite\'s it stays the elite\'s (mutants: the factor unread; phase two unread; the old factor never taken out)', () => {
  const e = {};
  assert.equal(F.puppetRevenantBlows(e, { rb: 1430 }), 1.43);
  assert.ok(near(e.damageScale, 1.43));
  F.puppetRevenantBlows(e, { rb: 1430 });
  assert.ok(near(e.damageScale, 1.43), 'said again: once');
  F.puppetRevenantBlows(e, { rb: 1430, p2: 1 });
  assert.ok(near(e.damageScale, 1.43 * F.PHASE_TWO.BLOWS), 'its last stand\'s phase two');
  F.puppetRevenantBlows(e, null);
  assert.ok(near(e.damageScale, 1), 'withdrawn: its own again');
  const elite = makeEnemyEntity(M.Orc, ENEMY_BASICS[M.Orc], null, 10, () => 0.5);
  promoteEliteFoe(elite, { own: false, checkLevel: false });
  const own = elite.damageScale;
  assert.ok(own > 1, 'an elite\'s blows');
  F.puppetRevenantBlows(elite, { rb: 1300, p2: 1 });
  assert.ok(near(elite.damageScale, own * 1.3 * 1.2));
  F.puppetRevenantBlows(elite, { rb: 1300 });
  assert.ok(near(elite.damageScale, own * 1.3));
  assert.equal(F.puppetRevenantBlows(null, { rb: 1300 }), 1);
});

test('FEUD WIRE THE DOOR: the puppet\'s blow at me through the real formula lands as its owner\'s would - x1.43 on the same roll (mutants: the fold unread at the door)', () => {
  const player = makePlayer('Longsword').entity;
  const rolls = () => { let i = 0; const s = [0.3, 0.99, 0.01, 0.99, 0.99]; return () => s[i++ % s.length]; };
  const swing = (ent) => calculateAttackDamage(ent, player, { rolls: rolls() });
  const plain = makeEnemyEntity(M.Orc, ENEMY_BASICS[M.Orc], null, 10, () => 0.5);
  const base = swing(plain);
  assert.ok(base > 1, `a blow that lands (${base})`);
  const pup = makeEnemyEntity(M.Orc, ENEMY_BASICS[M.Orc], null, 10, () => 0.5);
  F.puppetRevenantBlows(pup, { rb: 1430 });
  assert.equal(swing(pup), Math.max(1, Math.round(base * 1.43)));
});

test('FEUD WIRE THE SIGNATURE: its owner flags it; the puppet strikes it at x2.0 on my feet, in its ember, its WIND deeper - and with no numbers from its host, or no flag, its shape\'s (mutants: the flag unwritten; unread; the multiplier, the ember or the pitch dropped)', () => {
  const b = makeBlow('slam', [0, 0, 0], 0, 10, IRON_COLOR, 'iron');
  b.sig = true; b.mult = F.SIG.MULT;
  assert.equal(PB.blowWire({ _tac: { state: 'windup', blow: b } }, 10.1).wk, 2 | PB.WIRE_IRON | PB.WIRE_SIG);
  b.sig = false;
  assert.equal(PB.blowWire({ _tac: { state: 'windup', blow: b } }, 10.1).wk, 2 | PB.WIRE_IRON, 'a plain slam: no flag');
  const rec = { wk: 2 | PB.WIRE_SIG, wy: 0, wl: 500, wo: [0, 0, 0], wn: 1 };
  const at = (r, sig) => { const ai = { feet: [0, 0, 0] }; PB.applyBlowRecord(ai, r, { origin: [0, 0, 0], me: true, sig }); return ai; };
  let ai = at(rec, F.SIG);
  const pb = PB.puppetBlow(ai);
  assert.deepEqual([pb.sig, pb.mult, pb.windPitch, pb.color], [true, F.SIG.MULT, F.SIG.WIND_PITCH, F.SIG.COLOR]);
  T = 10.3; PB.puppetBlowTurn(ai, [0, 0, 1], T);
  T = 10.6; PB.puppetBlowTurn(ai, [0, 0, 1], T);
  assert.equal(ai._blowVerdict, true);
  assert.equal(ai._blowMult, F.SIG.MULT);
  assert.equal(blowScaled(ai, 10), 20, 'x2.0 on my feet, as on its owner\'s');
  T = 10; resetBlows();
  assert.equal(PB.puppetBlow(at(rec, null)).mult, BLOW.slam.mult, 'no numbers from the host: its shape\'s');
  T = 10; resetBlows();
  assert.equal(PB.puppetBlow(at({ ...rec, wk: 2 }, F.SIG)).mult, BLOW.slam.mult, 'no flag: its shape\'s');
});

test('FEUD WIRE THE HOSTS: both pass the signature\'s numbers to the puppet\'s blow; both streams key `rb` and stand the puppet\'s fold when it changes - the dungeon gives its own back when the record says none (mutants: each seam unwired; a key unwidened)', () => {
  const x = read('src/scenes/exteriorFoes.js');
  assert.match(x, /me: recipientIsMe\(f, r\.b \?\? r\.g \?\? p\.target\), entity: f\.entity, collider, sig: f\.entity\.revenant \? SIG : null \}\);/);   // PIN MOVED (GRANT0, Spawn-Grants.md section 8: the signature believed on a revenant alone)
  assert.match(x, /\$\{r\.p2 \?\? 0\},\$\{r\.rt \?\? -1\},\$\{r\.rb \?\? 0\}(?:,\$\{traitWireKey\(r\)\})?\$\{r\.wk !== undefined/);   // PIN MOVED (AUDIT WORLD-EVENTS L5-10): and the boss's wrath and live ward
  assert.match(x, /const fw = `\$\{r\.ad \?\? 0\},\$\{r\.wq \?\? -1\},\$\{r\.p2 \?\? 0\},\$\{r\.rb \?\? 0\}`; if \(f\._feudWire !== fw\) \{ f\._feudWire = fw; f\.entity\.revenant = feudFromWire\(f\.entity\.revenant, r\); puppetRevenantBlows\(f\.entity, r\); \}/);
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /me: _to != null && _me != null && _to === _me, entity: f\.entity, collider, sig: f\.entity\.revenant \? SIG : null \}\);/);   // PIN MOVED (GRANT0)
  assert.match(d, /\$\{r\.v\},\$\{r\.ad \?\? 0\},\$\{r\.wq \?\? -1\},\$\{r\.p2 \?\? 0\},\$\{r\.rb \?\? 0\}(?:,\$\{traitWireKey\(r\)\})?\$\{r\.wk !== undefined/);
  assert.match(d, /const _fw = r\.ad !== undefined \|\| r\.wq !== undefined \|\| r\.p2 !== undefined \|\| r\.rb !== undefined \? `\$\{r\.ad \?\? 0\},\$\{r\.wq \?\? -1\},\$\{r\.p2 \?\? 0\},\$\{r\.rb \?\? 0\}` : null;/);
  assert.match(d, /: \(f\.entity\.revenant\?\.id \? f\.entity\.revenant : null\); puppetRevenantBlows\(f\.entity, r\); \}/);
});

test('FEUD WIRE THROUGH THE REAL STREET POOL: a peer\'s revenant stands with its owner\'s blows - said again once, phase two folded on them, withdrawn given back; an heir\'s foe writes them (mutants: the reader unwired; the key unwidened; the writer unwritten)', async () => {
  const pool = createExteriorFoes(poolRig());
  pool.setNet(netFor());
  const rec = (n, extra) => ({ n, k: 'world:3,12', full: 1, f: [{ i: 5, t: 0, x: 0, f: [20, 0, 20], y: 0, h: 9, d: 0, a: 0, m: 0, nm: 'Grushnak the Butcher', ...extra }] });
  pool.applyFoes('bob-0002', rec(1, { rb: 1430 }));
  await settle();
  const pup = pool.foes.find((f) => f.puppet);
  const own = 1;   // a plain foe of the crafted kind - its own scale x1
  assert.ok(near(pup.entity.damageScale, own * 1.43), 'its owner\'s blows');
  assert.equal(pup.entity.revenant.blows, 1.43);
  pool.applyFoes('bob-0002', rec(2, { rb: 1430 }));
  assert.ok(near(pup.entity.damageScale, 1.43), 'said again: once');
  pool.applyFoes('bob-0002', rec(3, { rb: 1430, p2: 1 }));
  assert.ok(near(pup.entity.damageScale, 1.43 * F.PHASE_TWO.BLOWS), 'its last stand\'s phase two');
  pool.applyFoes('bob-0002', rec(4, {}));
  assert.ok(near(pup.entity.damageScale, own), 'withdrawn: its own');
  const f = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  f.entity.revenant = F.feudFromWire({ id: null, name: 'Grushnak the Butcher', rank: 0 }, { rb: 1430 });
  const r = pool.foesFrame(true)?.f?.find((x) => x.i === f.seq);
  assert.equal(r?.rb, 1430, 'an heir writes them back');
});
