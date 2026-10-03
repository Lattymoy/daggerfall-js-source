// AUDIT-SEATS (2026-10-01, Mac: "Finish the seats"): THE SEATS ARC'S CLIENT, AUDITED - a battle and a Royal Tourney
// left (C1), one battle's mint at a time (C2), an unsettled field asked on a backing-off wait and said once (C3), the
// first seat town of a session arrived at (C4), the receipts offered on their own clock (C5) by the relay's (C6), every
// settling answer on the card (C7), the Seat tab's words, reloads and relinquish (C8, C9, C13), the Watch kept through a
// session run out (C10), the Hall of Records read once at a time (C11), the frame's allocations (C12); the battles
// announced in the server's voice (G1) and fought with shafts, spells and wards (G5).
// bible/11-Multiplayer/Seats-Arc.md 6.1, 6.3, 6.6, 7.6, 7.9, 9.2, 19; `06-Systems/Online-Arc.md` SEAT2a part four,
// CROWN1 part two, SEASON1.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { byClass } from './chargenDom.mjs';
import {
  createSiegeSession, SIEGE_SESSION_TEXT, SIEGE_PASS_RETRY_MS, PASS_RETRY_MAX_MS, passRetryMs, BATTLE_AWAY_MS,
  isBattleLeaveCommand, BATTLE_NONE_TEXT,
} from '../src/net/siegeSession.js';
import { createRoyalSession, ROYAL_SESSION_TEXT, ROYAL_PASS_RETRY_MS } from '../src/net/royalSession.js';
import { createSiegeClaims, createRoyalClaims, SIEGE_CLAIM_RETRY_MS } from '../src/net/siegeClaims.js';
import { siegeHudModel, siegeHonourLine, siegeClaimRefusal, SIEGE_CLAIM_REFUSED, foldSiege, SIEGE_STATE_EMPTY } from '../src/net/siegeLink.js';
import { createSiegeHud, SIEGE_HUD_WORDS } from '../src/ui/siegeHud.js';
import { createTownSeatBook } from '../src/net/townSeatBook.js';
import { createSeatTab, SEAT_RELINQUISH_ARM_MS } from '../src/ui/seatTab.js';
import { SEAT_RELINQUISH_WORDS, SEAT_WATCH_CLAIM_MAX, seatWeekStartMs, seatWeekOf, battleAnnouncement, battleWhenText } from '../src/net/townSeatLaw.js';
import { GUILD_RANK_MASTER } from '../src/net/guildLaw.js';
import { mintSiegeReceipt, mintRoyalReceipt } from '../src/net/siegeReceipt.js';
import { mintWatchReceipt } from '../src/net/watchReceipt.js';
import { ribbonTints } from '../src/net/remotePlayers.js';
import { ribbonRgba } from '../src/net/heraldryLaw.js';
import { createSeatBanners } from '../src/scenes/seatBanners.js';
import { createSiegeHerald, heraldMarks, heraldDue, fightAnnouncement, SIEGE_HERALD_BEFORE_MS, SIEGE_HERALD_TICK_MS } from '../src/net/siegeHerald.js';
import { siegeBlowKind, siegeCastClamp, siegeSpellNumbers, siegeSpellBarred, SIEGE_SPELL_BARRED_TEXT, SIEGE_BARRED_EFFECTS } from '../src/combat/siegeCombat.js';
import { SIEGE_HIT, SIEGE_CASTS, siegeRoomKey, royalRoomKey } from '../src/net/siegeRef.js';
import { applySpell } from '../src/systems/effects.js';
import { duelStub, duelAttackerOf } from '../src/combat/duelCombat.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { registerLevitateWard, levitateWarded, setStaffPowers, registerFreeFlight } from '../src/characters/playerEntity.js';
import { applyMotorEffectFlags } from '../src/scenes/shared.js';

const { subtle } = webcrypto;
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const AT = 1_800_000_000_000;
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
const pose = (x, z) => ({ x, y: 0, z, yaw: 0, pitch: 0 });
const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: null }, EO = { id: 'g2', name: 'Ebon Oath', tag: 'EO', heraldry: null };
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const FIGHT = { kind: 'siege', tier: 'palace', attackerGuild: EO, defenderGuild: SH };
const eff = (type, subType, mag) => ({ type, subType, magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 });

/** A siege session over a fake socket - the pass answers in turn, the last for good. */
function siegeRig({ answers = [{ ok: true, pass: 'v1.p.q', side: 'attack', week: 20, window: Math.floor((AT + 7_200_000) / 1000) }], here = () => true } = {}) {
  const t = { now: AT, said: [], sent: [], hud: [], asked: 0, here };
  const online = { id: 'me-00001', room: null, status: 'open', terminal: false, mintSiegePass: null, sendSiege: (f) => { t.sent.push(f); return true; } };
  const pass = async () => { t.asked++; return answers.length > 1 ? answers.shift() : answers[0]; };
  const hud = { update: (m) => t.hud.push(m), hide: () => t.hud.push('hidden') };
  t.online = online;
  t.ses = createSiegeSession({ online, pass, hud, nowMs: () => t.now, say: (s) => t.said.push(s), relayOk: () => true, here: (seat) => t.here(seat) });
  return t;
}

test('AUDIT-SEATS C1 A BATTLE IS LEFT: by the player (true, its word said; nothing to leave: false), once away from the seat\'s town BATTLE_AWAY_MS (back within it: stays), when its socket closes for good; the HUD drawn in the battle\'s room alone - hidden in a building\'s; a Royal Tourney the same; the chat\'s `/leave` (mutants: the away clock; its reset; the terminal; the room; the return)', async () => {
  const t = siegeRig();
  assert.equal(t.ses.leave(), false, 'nothing entered: nothing left');
  t.ses.enter(ANTICLERE, FIGHT, [[1, 2]]); await settle();
  const room = t.ses.room();
  assert.equal(room, siegeRoomKey(3021, 20));
  t.online.room = room;
  t.ses.tick();
  assert.ok(t.hud.at(-1).bar, 'drawn in its room');
  // a building of the town: its room is not the field - the HUD hidden, the battle kept
  t.online.room = 'interior:3021:7';
  t.ses.tick();
  assert.equal(t.hud.at(-1), 'hidden');
  assert.equal(t.ses.active(), true);
  t.online.room = room;
  // away from the town: not at once - a step past the edge, a door, a load's frames
  t.here = () => false;
  t.ses.tick();
  t.now += BATTLE_AWAY_MS - 1; t.ses.tick();
  assert.equal(t.ses.active(), true, 'not before its grace');
  t.here = () => true; t.ses.tick();
  t.here = () => false; t.ses.tick();
  t.now += BATTLE_AWAY_MS - 1; t.ses.tick();
  assert.equal(t.ses.active(), true, 'back in the town: the clock begins again');
  t.now += 1; t.ses.tick();
  assert.equal(t.ses.active(), false);
  assert.equal(t.said.at(-1), SIEGE_SESSION_TEXT.away('Anticlere'));
  assert.equal(t.online.mintSiegePass, null);
  // the battle's socket closed for good (a hello refused, the seat taken by another tab)
  t.here = () => true;
  t.ses.enter(ANTICLERE, FIGHT, [[1, 2]]); await settle();
  t.online.room = t.ses.room(); t.online.terminal = true;
  t.ses.tick();
  assert.equal(t.ses.active(), false);
  assert.equal(t.said.at(-1), SIEGE_SESSION_TEXT.closed);
  t.online.terminal = false;
  // the player's own leave
  t.ses.enter(ANTICLERE, FIGHT, [[1, 2]]); await settle();
  assert.equal(t.ses.leave(), true);
  assert.equal(t.said.at(-1), SIEGE_SESSION_TEXT.left);
  // the Royal Tourney: the same three ways out
  let now = AT, away = false;
  const said = [], huds = [];
  const online = { id: 'p1', room: '', status: 'open', terminal: false, mintSiegePass: null, sendSiege: () => true };
  const rs = createRoyalSession({ online, pass: async (s, f, w) => ({ ok: true, side: w ? 'watch' : 'duel', week: 20, endsAt: AT / 1000 + 86400 * 6 }), hud: { update: (m) => huds.push(m), hide: () => huds.push('hidden') },
    nowMs: () => now, say: (s) => said.push(s), relayOk: () => true, here: () => !away });
  rs.enter(WAYREST, { prize: 5000 }, [[1, 2]], { watch: true }); await settle();
  online.room = rs.room();
  rs.tick();
  assert.ok(huds.at(-1).bar, 'a spectator\'s HUD in its room');
  online.room = 'cell:590:166'; rs.tick();
  assert.equal(huds.at(-1), 'hidden', 'never over every mode');
  away = true; rs.tick(); now += BATTLE_AWAY_MS; rs.tick();
  assert.equal(rs.active(), false, 'a Monday\'s watcher who walked out of Wayrest is no longer in its room');
  assert.equal(said.at(-1), ROYAL_SESSION_TEXT.away('Wayrest'));
  away = false;
  rs.enter(WAYREST, { prize: 5000 }, [[1, 2]]); await settle();
  online.room = rs.room(); online.terminal = true; rs.tick();
  assert.deepEqual([rs.active(), said.at(-1)], [false, ROYAL_SESSION_TEXT.closed]);
  online.terminal = false;
  rs.enter(WAYREST, { prize: 5000 }, [[1, 2]]); await settle();
  assert.deepEqual([rs.leave(), rs.leave(), said.at(-1)], [true, false, ROYAL_SESSION_TEXT.left]);
  // the chat's word
  assert.deepEqual(['/leave', ' /LEAVE ', '/leave now', 'leave', '/leaves'].map(isBattleLeaveCommand), [true, true, false, false, false]);
  assert.equal(BATTLE_NONE_TEXT, 'You are in no battle and no Royal Tourney.');
});

test('AUDIT-SEATS C1 THE HUD\'S WAY OUT: the bar\'s Leave and the result card\'s Close both leave (the world\'s one door); the bar\'s Leave stands down while the card shows; the card\'s Claim is still its first button (mutants: each button; the swap)', () => {
  let left = 0, claimed = 0;
  const hud = createSiegeHud(document, { onClaim: () => { claimed++; }, onLeave: () => { left++; } });
  let s = foldSiege(SIEGE_STATE_EMPTY, { k: 'f', b: [[2, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: AT, e: AT + 1_800_000, n: [1, 1, 0] }, AT);
  const battle = { seat: 'Anticlere', kind: 'siege', tier: 'palace', attacker: EO, defender: SH };
  hud.update(siegeHudModel(s, battle, 'me-00001', AT));
  const leave = byClass(hud.node, 'sg-leave')[0];
  assert.equal(leave.textContent, SIEGE_HUD_WORDS.leave);
  assert.equal(leave.style.display, '');
  leave.click();
  assert.equal(left, 1);
  s = foldSiege(s, { k: 'end', r: 'defend', a: 0, rc: 's1.x.y' }, AT + 1_800_000);
  hud.update(siegeHudModel(s, battle, 'me-00001', AT + 1_800_000, { claimable: true }));
  assert.equal(leave.style.display, 'none', 'the card stands for it');
  const card = byClass(hud.node, 'sg-card')[0];
  const [claim, close] = card.children.filter((c) => c.tagName === 'BUTTON');
  assert.equal(claim, card.querySelector('button'), 'Claim first');
  claim.click();
  assert.equal(claimed, 1);
  assert.equal(close.textContent, SIEGE_HUD_WORDS.close);
  close.click();
  assert.equal(left, 2, 'dismissing the card leaves the battle it ended');
  hud.destroy();
});

test('AUDIT-SEATS C1 THE WORLD\'S WAYS OUT by source: the one door (whichever is entered), the HUD\'s and the chat\'s, the sessions told where the seat is, the dead and a frame with no online tick (mutants: each wire)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const leaveBattle = \(\) => !!\(siegeSession\?\.leave\(\) \|\| royalSession\?\.leave\(\)\);/);
  assert.match(w, /siegeHud = createSiegeHud\(document, \{ onClaim: \(\) => siegeClaims\.offer\(\{ force: true \}\), onLeave: \(\) => leaveBattle\(\) \}\);/);
  assert.match(w, /if \(isBattleLeaveCommand\(text\)\) \{\n\s*if \(!leaveBattle\(\)\) chatLog\.push\(tabId, \{ text: BATTLE_NONE_TEXT, system: true \}\);\n\s*return true;\n\s*\}/);
  assert.equal((w.match(/here: \(seat\) => atSeat\(seat\)/g) ?? []).length, 2, 'both sessions');
  assert.match(w, /const atSeat = \(seat\) => \{\n\s*if \(!Array\.isArray\(seat\?\.pixel\) \|\| \(modes\?\.mode \?\? 'exterior'\) === 'dungeon'\) return false;\n\s*const p = playerTravelPixel\(\);\n\s*return Math\.abs\(p\.x - seat\.pixel\[0\]\) <= 1 && Math\.abs\(p\.y - seat\.pixel\[1\]\) <= 1;/);
  const frame = w.slice(w.indexOf('const gateFrame = () => {'), w.indexOf('const gateFrame = () => {') + 3500);
  assert.match(frame, /if \(townTalk\.overlay instanceof DeathScreen \|\| modes\?\.deathUp\?\.\(\)\) \{ leaveBattle\(\);/, 'the dead leave it - the gate\'s frame runs before the death return');
  assert.match(w, /onlineFrame\(now, dt\); \} else \{[^\n]*courtRing\(\) : null; if \(!player\.arena\) player\.arena = arenaBouts\.ring\(\); \/\* ARENA2[^*\n]*\*\/ siegeHud\?\.hide\(\); \/\*/);   // the arena merge: ARENA2's bout ring stands before it
});

test('AUDIT-SEATS C2 ONE MINT SLOT: a leave clears net/online.js mintSiegePass only while it is its own (another battle\'s stays); a fresh enter lets its old one go; the world enters one battle at a time (mutants: the ownership test; the doors\' leaves)', async () => {
  let now = AT;
  const online = { id: 'p1', room: '', status: 'open', terminal: false, mintSiegePass: null, sendSiege: () => true };
  const ses = createSiegeSession({ online, pass: async () => ({ ok: true, pass: 'v1.siege.x', side: 'attack', week: 20, window: AT / 1000 + 7200 }), nowMs: () => now, relayOk: () => true });
  const rs = createRoyalSession({ online, pass: async () => ({ ok: true, pass: 'v1.royal.x', side: 'duel', week: 20, endsAt: AT / 1000 + 86400 }), nowMs: () => now, relayOk: () => true });
  ses.enter(ANTICLERE, FIGHT, [[1, 2]]); await settle();
  assert.equal(await online.mintSiegePass(), 'v1.siege.x');
  rs.enter(WAYREST, { prize: 1 }, [[1, 2]]); await settle();
  assert.equal(await online.mintSiegePass(), 'v1.royal.x', 'the tourney\'s now');
  ses.leave({ quiet: true });
  assert.notEqual(online.mintSiegePass, null, 'the siege\'s leave leaves the tourney\'s mint');
  assert.equal(await online.mintSiegePass(), 'v1.royal.x');
  rs.leave({ quiet: true });
  assert.equal(online.mintSiegePass, null);
  // entered afresh: the first enter's mint goes even before the second's pass is answered
  ses.enter(ANTICLERE, FIGHT, [[1, 2]]); await settle();
  assert.notEqual(online.mintSiegePass, null);
  ses.enter(ANTICLERE, FIGHT, [[1, 2]]);
  assert.equal(online.mintSiegePass, null, 'its old pass\'s mint goes with the old entry');
  await settle();
  assert.equal(await online.mintSiegePass(), 'v1.siege.x');
  ses.leave({ quiet: true });
  rs.enter(WAYREST, { prize: 1 }, [[1, 2]]); await settle();
  rs.enter(WAYREST, { prize: 1 }, [[1, 2]]);
  assert.equal(online.mintSiegePass, null, 'the tourney\'s too');
  await settle();
  ses.enter(ANTICLERE, FIGHT, [[1, 2]]); await settle();
  assert.equal(await online.mintSiegePass(), 'v1.siege.x');
  rs.leave({ quiet: true });
  assert.equal(await online.mintSiegePass(), 'v1.siege.x', 'the tourney\'s leave leaves the siege\'s mint');
  ses.leave({ quiet: true });
  rs.enter(WAYREST, { prize: 1 }, [[1, 2]]); await settle();
  const other = createSiegeSession({ online, pass: async () => ({ ok: true }), relayOk: () => true });
  other.enter(ANTICLERE, FIGHT, [[1, 2]]);
  other.leave({ quiet: true });
  assert.equal(await online.mintSiegePass(), 'v1.royal.x', 'a siege that never joined clears nothing of the tourney\'s');
  rs.leave({ quiet: true });
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(field\) royalSession\?\.leave\(\);   \/\/ AUDIT-SEATS C2[^\n]*\n\s*return siegeSession\.enter\(seat, fight, field\);/);
  assert.match(w, /if \(field\) siegeSession\?\.leave\(\);   \/\/ AUDIT-SEATS C2[^\n]*\n\s*return royalSession\.enter\(seat, royal, field, \{ watch \}\);/);
});

test('AUDIT-SEATS C3 AN UNSETTLED FIELD BACKS OFF: said once, asked again after 5 s, 10, 20, 40, then every 60 s - twenty minutes ask some twenty-three times, never the 121 that ran into the service\'s hourly bound; a Royal Tourney\'s ring the same (mutants: the doubling; the ceiling; the once)', async () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map((n) => passRetryMs(n)), [5000, 10000, 20000, 40000, 60000, 60000, 60000]);
  assert.equal(PASS_RETRY_MAX_MS, 60_000);
  assert.equal(passRetryMs(1, ROYAL_PASS_RETRY_MS), ROYAL_PASS_RETRY_MS);
  const t = siegeRig({ answers: [{ ok: false, error: 'field-unsettled', text: 'wait for the scouts' }] });
  t.ses.enter(ANTICLERE, FIGHT, [[1, 2]]); await settle();
  for (let s = 0; s < 20 * 60; s++) { t.now += 1000; t.ses.tick(); await settle(2); }
  assert.ok(t.asked >= 20 && t.asked <= 26, `asked ${t.asked} times`);
  assert.deepEqual(t.said, ['wait for the scouts'], 'said once');
  // the waits themselves
  const r = siegeRig({ answers: [{ ok: false, error: 'field-unsettled', text: 'w' }] });
  r.ses.enter(ANTICLERE, FIGHT, [[1, 2]]); await settle();
  const at = [];
  for (let s = 0; s < 200; s++) { const before = r.asked; r.now += 1000; r.ses.tick(); await settle(2); if (r.asked > before) at.push(r.now - AT); }
  assert.deepEqual(at.slice(0, 6), [5000, 15000, 35000, 75000, 135000, 195000]);
  // the ring
  let now = AT, asked = 0;
  const said = [];
  const rs = createRoyalSession({ online: { id: 'p1', mintSiegePass: null, sendSiege: () => true }, pass: async () => { asked++; return { ok: false, error: 'ring-unsettled', text: 'two contenders must agree' }; }, nowMs: () => now, say: (s) => said.push(s), relayOk: () => true });
  rs.enter(WAYREST, {}, [[1, 2]]); await settle();
  for (let s = 0; s < 20 * 60; s++) { now += 1000; rs.tick(); await settle(2); }
  assert.ok(asked <= 26 && said.length === 1, `${asked} asks, ${said.length} lines`);
});

test('AUDIT-SEATS C4 THE FIRST SEAT TOWN: the arrival waits on the seats\' read and is said while the player still stands in that town; the seats read as the online session starts (mutants: the wait; the still-there; the start\'s read)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const arrive = \(\) => \{\n\s*if \(!stillAt\(mapId\)\) return;\n\s*const seat = seatHere\(mapId\);/);
  assert.match(w, /const stillAt = \(mapId\) => _wasInLocationRect && _musicLoc\?\.mapTableData\?\.mapId === mapId;/);
  assert.match(w, /if \(seatBook\) seatBook\.read\(\)\.then\(arrive, arrive\); else Promise\.resolve\(\)\.then\(arrive\);/);
  assert.doesNotMatch(w, /seatBook\?\.read\(\);\n\s*const seat = seatHere\(mapId\);/, 'never read un-awaited and asked at once');
  assert.match(w, /\n\s*seatBook\.read\(\);   \/\/ AUDIT-SEATS C4: the seats read as the session starts/);
  const start = w.indexOf('const onlineStart = () => {');
  const read = w.indexOf('seatBook.read();   // AUDIT-SEATS C4');
  assert.ok(start > 0 && read > start, 'in the online session\'s start');
});

test('AUDIT-SEATS C5 THE RECEIPTS OFFERED ON THEIR OWN CLOCK: `due` says, in sync, whether an unforced offer would go (something kept, none in flight, the retry run) - the gate\'s frame asks it each frame and offers then (mutants: each term; the frame\'s two)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  let now = AT;
  let answer = { ok: false, error: 'offline' };
  let release = null;
  const c = createSiegeClaims({ claim: () => new Promise((r) => { release = () => r(answer); }), me: () => 'acct-me01', nowMs: () => now, storage: null });
  assert.equal(c.due(), false, 'nothing kept');
  const rc = await mintSiegeReceipt({ s: 'acct-me01', sk: 3021, sw: 20, sd: 'attack', r: 'attack', a: 1, h: 1 }, kp.privateKey, { subtle, nowS: Math.floor(now / 1000) });
  c.keep(rc);
  assert.equal(c.due(), true, 'kept, never offered');
  const going = c.offer();
  assert.equal(c.due(), false, 'one in flight');
  now += SIEGE_CLAIM_RETRY_MS;
  assert.equal(c.due(), false, 'one in flight, however long it hangs');
  now -= SIEGE_CLAIM_RETRY_MS;
  release(); await going;
  assert.equal(c.due(), false, 'inside the retry');
  now += SIEGE_CLAIM_RETRY_MS - 1;
  assert.equal(c.due(), false);
  now += 1;
  assert.equal(c.due(), true, 'its minutes run');
  const r = createRoyalClaims({ claim: async () => ({ ok: true }), me: () => 'acct-me01', nowMs: () => now, storage: null });
  r.keep(await mintRoyalReceipt({ s: 'acct-me01', l: 'acct-them', sk: 5023, sw: 20, n: 1 }, kp.privateKey, { subtle, nowS: Math.floor(now / 1000) }));
  assert.equal(r.due(), true, 'the bouts\' carrier too');
  const w = rd('src/scenes/world.js');
  const frame = w.slice(w.indexOf('const gateFrame = () => {'), w.indexOf('const gateFrame = () => {') + 3000);
  assert.match(frame, /if \(siegeClaims\?\.due\(\)\) siegeClaims\.offer\(\);/);
  assert.match(frame, /if \(royalClaims\?\.due\(\)\) royalClaims\.offer\(\);/);
  assert.match(w, /let siegeClaims = null, royalClaims = null, siegeHud = null;/, 'kept where the frame can reach them');
});

test('AUDIT-SEATS C6 THE RELAY\'S CLOCK: both sessions and both carriers read the shared offset the rest of the scene reads (mutants: each nowMs)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const battleNowMs = \(\) => Date\.now\(\) \+ _sharedOffsetMs;/);
  assert.match(w, /siegeSession = createSiegeSession\(\{[^\n]*\n\s*nowMs: battleNowMs, here: \(seat\) => atSeat\(seat\) \}\);/);
  assert.match(w, /royalSession = createRoyalSession\(\{[^\n]*\n[^\n]*name: \(id\) => peerName\(id\) \?\? '', nowMs: battleNowMs, here: \(seat\) => atSeat\(seat\) \}\);/);
  assert.match(w, /siegeClaims = createSiegeClaims\(\{[^\n]*nowMs: battleNowMs,/);
  assert.match(w, /royalClaims = createRoyalClaims\(\{[^\n]*nowMs: battleNowMs \}\);/);
});

test('AUDIT-SEATS C7 EVERY SETTLING ANSWER REACHES THE CARD: claimed before, a void battle, a receipt that is not the relay\'s - each said in the Honours\' place, the Claim gone; a mendable refusal keeps it claimable; an older battle\'s answer is not this card\'s (mutants: the carrier\'s every-answer; the refusal\'s words; the receipt test)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const rc = (sw) => mintSiegeReceipt({ s: 'acct-me01', sk: 3021, sw, sd: 'attack', r: 'attack', a: 1, h: 1 }, kp.privateKey, { subtle, nowS: Math.floor(AT / 1000) });
  for (const [answer, said] of [
    [{ ok: false, error: 'honours-twice' }, 1], [{ ok: false, error: 'battle-none' }, 1], [{ ok: false, error: 'receipt', why: 'claims' }, 1],
    [{ ok: false, error: 'receipt', why: 'signature' }, 0], [{ ok: false, error: 'offline' }, 0], [{ ok: true, honours: { marks: 50 } }, 1],
  ]) {
    const heard = [];
    const c = createSiegeClaims({ claim: async () => answer, me: () => 'acct-me01', nowMs: () => AT, storage: null, onClaimed: (a, r) => heard.push([a, r]) });
    const r = await rc(20);
    c.keep(r);
    await c.offer({ force: true });
    assert.equal(heard.length, said, JSON.stringify(answer));
    if (said) assert.deepEqual(heard[0], [answer, r]);
  }
  assert.deepEqual([siegeClaimRefusal({ error: 'honours-twice' }), siegeClaimRefusal({ error: 'battle-none' }), siegeClaimRefusal({ error: 'receipt' }), siegeClaimRefusal({ error: 'whatever' })],
    [SIEGE_CLAIM_REFUSED['honours-twice'], SIEGE_CLAIM_REFUSED['battle-none'], SIEGE_CLAIM_REFUSED.receipt, SIEGE_CLAIM_REFUSED.receipt]);
  assert.equal(siegeHonourLine('No Honours this battle: the battle was void.'), 'No Honours this battle: the battle was void.');
  // the session's card
  const t = siegeRig();
  t.ses.enter(ANTICLERE, FIGHT, [[1, 2]]); await settle();
  t.online.room = t.ses.room();
  const mine = await rc(20), old = await rc(19);
  t.ses.onSiege({ k: 'end', r: 'attack', a: 1, rc: mine }, t.online.room);
  t.ses.tick();
  assert.equal(t.hud.at(-1).card.claim, true);
  assert.match(t.hud.at(-1).card.honour, /^Your receipt is kept/);
  t.ses.claimed({ ok: false, error: 'honours-twice' }, old);
  t.ses.tick();
  assert.equal(t.hud.at(-1).card.claim, true, 'an older battle\'s answer is not this card\'s');
  t.ses.claimed({ ok: false, error: 'honours-twice', text: 'the service\'s own words' }, mine);
  t.ses.tick();
  assert.deepEqual([t.hud.at(-1).card.claim, t.hud.at(-1).card.honour], [false, SIEGE_CLAIM_REFUSED['honours-twice']], 'never stuck on "claim it"');
  t.ses.claimed({ ok: true, honours: { marks: 50, xp: 2000 } }, mine);
  t.ses.tick();
  assert.match(t.hud.at(-1).card.honour, /50 Marks/);
  assert.match(rd('src/scenes/world.js'), /onClaimed: \(a, r\) => siegeSession\?\.claimed\(a, r\)/);
});

/** The Seat tab over a scripted book and a window stand-in. */
function tabRig(data, book = {}) {
  const t = { renders: 0, nowS: Math.floor(AT / 1000), runs: [] };
  const ui = { busy: () => false, run: (start) => { const p = start(); t.runs.push(p); return p; }, rerender: () => { t.renders++; }, nowS: () => t.nowS, alive: () => true };
  t.tab = createSeatTab({ seat: ANTICLERE, book: { standings: async () => ({ data, error: null }), zero: null, ...book } }, ui);
  return t;
}
const seatData = (o = {}) => ({
  seat: ANTICLERE, week: 6, phase: 'muster', reckoningAt: Math.floor(AT / 1000) + 3600, turningAt: Math.floor(AT / 1000) + 86400, defence: 4500,
  holder: { guild: SH, since: 3, standing: 55, tithe: 6, edict: null }, battle: null, standings: [], chronicle: [],
  mine: { guild: 'g1', rank: GUILD_RANK_MASTER, seasoned: true, bound: 'g1', pledges: [], influence: 0, tributeRoom: 0 }, ...o,
});

test('AUDIT-SEATS C8 THE TOURNEY\'S SIGNED LINE: "for the first contender", never "for the the first contender"; a siege\'s sides as ever (mutants: the words)', async () => {
  const fight = (kind, side) => ({ week: 6, key: 3021, kind, tier: 'palace', startsAt: Math.floor(AT / 1000) + 86400, endsAt: Math.floor(AT / 1000) + 90000, moved: false, state: 'scheduled',
    attackerGuild: EO, defenderGuild: SH, sides: { attack: { n: 1, swords: 0 }, defend: { n: 1, swords: 0 } }, max: 10, swordsMax: 2, open: true, window: null, mine: { side, signed: true, sellsword: false } });
  for (const [kind, side, words] of [['tourney', 'attack', 'You are signed for the first contender.'], ['tourney', 'defend', 'You are signed for the second contender.'], ['siege', 'attack', 'You are signed for the attackers.'], ['siege', 'defend', 'You are signed for the defenders.']]) {
    const t = tabRig(seatData({ fight: fight(kind, side) }));
    await t.tab.open(); await settle();
    const text = t.tab.body().textContent;
    assert.ok(text.includes(words), `${kind} ${side}: ${words}`);
    assert.ok(!text.includes('the the'), 'no doubled article');
  }
});

test('AUDIT-SEATS C9 AN ACT\'S RELOAD IS NEVER LOST: the tab queues a reload asked mid-read (forced if any asked it so); the book keeps no answer asked before an act and given after it - set the Tithe, proclaim an Edict, and the tab reads the Edict (mutants: the queue; the force; the generation)', async () => {
  // the tab
  const asks = [];
  const pending = [];
  const t = tabRig(null, { standings: (key, o) => { asks.push(!!o?.force); return new Promise((r) => pending.push(r)); } });
  t.tab.open();
  t.tab.reload();
  t.tab.reload();
  assert.deepEqual(asks, [false], 'one read in flight');
  pending.shift()({ data: seatData(), error: null }); await settle();
  assert.deepEqual(asks, [false, true], 'the queued reload ran, forced');
  pending.shift()({ data: seatData(), error: null }); await settle();
  assert.deepEqual(asks, [false, true], 'and once');
  // the book: the Tithe's read answered after the Edict's clear is not the seat's standings
  let answer = null;
  const reads = [];
  const door = {
    standings: () => new Promise((r) => reads.push(r)),
    tithe: async () => ({ ok: true }),
    edict: async () => ({ ok: true }),
  };
  const book = createTownSeatBook({ door: /** @type {any} */ (door), character: () => 'c1', storage: null, nowMs: () => AT });
  await book.tithe(ANTICLERE, 5);
  const afterTithe = book.standings(3021, { force: true });
  await book.edict(ANTICLERE, 'market');
  answer = { ok: true, data: { holding: { next: null } } };
  reads.shift()(answer);
  assert.deepEqual((await afterTithe).data, { holding: { next: null } }, 'the caller has its answer');
  const again = book.standings(3021);
  await settle();
  assert.equal(reads.length, 1, 'not kept: the seat is read again');
  reads.shift()({ ok: true, data: { holding: { next: 'market' } } });
  assert.equal((await again).data.holding.next, 'market');
  assert.equal((await book.standings(3021)).data.holding.next, 'market', 'the answer after the act is kept');
  assert.equal(reads.length, 0);
});

test('AUDIT-SEATS C10 THE WATCH KEPT THROUGH A SESSION RUN OUT: `auth` and `no-session` keep the receipts (signing in again mends them); `seats-closed`, a refusal for good and a count let them go (mutants: each word)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const T = Math.floor(AT / 1000);
  for (const [answer, keeps] of [[{ ok: false, error: 'auth' }, true], [{ ok: false, error: 'no-session' }, true], [{ ok: false, error: 'offline' }, true],
    [{ ok: false, error: 'seats-closed' }, false], [{ ok: false, error: 'bad-watch' }, false], [{ ok: true, data: { counted: 1 } }, false]]) {
    const store = new Map();
    const book = createTownSeatBook({
      door: /** @type {any} */ ({ list: async () => ({ ok: true, data: { seats: [] } }), watch: async () => answer }),
      storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }, nowMs: () => AT, me: () => 'acct-0001', character: () => 'c1',
      isSeatPixel: () => true, relayNowS: () => T,
    });
    await book.read();
    book.keepWatch(await mintWatchReceipt({ s: 'acct-0001', x: 402, y: 151, c: 1 }, kp.privateKey, { subtle, nowS: T }));
    await book.claimWatch({ force: true });
    assert.equal(book.watchHeldCount(), keeps ? 1 : 0, JSON.stringify(answer));
  }
});

test('AUDIT-SEATS C11 THE HALL OF RECORDS READ ONCE AT A TIME: a press while a read is in flight sends nothing; a book that lands over a window opened meanwhile (or after the player left) is disposed, never put in its place; the castle\'s the same (mutants: the flag; the overlay test; the dispose)', () => {
  const m = rd('src/scenes/worldModes.js');
  const palace = m.slice(m.indexOf('function openHallOfRecords(b) {'), m.indexOf('const castleRecordsHere = '));
  assert.match(palace, /if \(recordsReading\) return;\n\s*recordsReading = true;/);
  assert.match(palace, /recordsReading = false;\n\s*if \(interiorBuilding !== b \|\| interiorOverlay\) \{ dropRecords\(w\); return; \}/);
  assert.match(palace, /\.catch\(\(\) => \{ recordsReading = false; say\(HALL_OF_RECORDS_SHUT\); \}\);/);
  const castle = m.slice(m.indexOf('function openCastleRecords() {'), m.indexOf('function openCastleRecords() {') + 900);
  assert.match(castle, /if \(recordsReading\) return;\n\s*recordsReading = true;/);
  assert.match(castle, /if \(mode !== 'dungeon' \|\| dungeonLoc !== at \|\| dungeonCtx\?\.overlayWindow\?\.\(\)\) \{ dropRecords\(w\); return; \}/);
  assert.match(m, /const dropRecords = \(w\) => \{ try \{ w\?\.dispose\?\.\(\); \} catch \{ \/\* already gone \*\/ \} \};/);
});

test('AUDIT-SEATS C12 NOTHING MADE A FRAME FOR NOTHING: the Watch\'s due asked in sync agrees with its claim; a ribbon\'s tints parsed once; the seats\' banners one kept list, refilled in place as the origin moves (mutants: the due\'s terms; the cache; the kept list)', async () => {
  // the Watch's due
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const T = Math.floor(AT / 1000);
  let now = AT;
  const book = createTownSeatBook({
    door: /** @type {any} */ ({ list: async () => ({ ok: true, data: { seats: [] } }), watch: async () => ({ ok: true, data: { counted: 1 } }) }),
    storage: null, nowMs: () => now, me: () => 'acct-0001', character: () => 'c1', isSeatPixel: () => true, relayNowS: () => Math.floor(now / 1000),
  });
  assert.equal(book.claimWatchDue(), false, 'nothing held');
  book.keepWatch(await mintWatchReceipt({ s: 'acct-0001', x: 402, y: 151, c: 1 }, kp.privateKey, { subtle, nowS: T }));
  assert.equal(book.claimWatchDue(), false, 'one, new');
  for (let i = 2; i <= SEAT_WATCH_CLAIM_MAX; i++) book.keepWatch(await mintWatchReceipt({ s: 'acct-0001', x: 402, y: 151, c: i }, kp.privateKey, { subtle, nowS: T }));
  assert.equal(book.claimWatchDue(), false, 'a claim\'s worth held - but the seats not read open yet');
  assert.equal(await book.claimWatch(), null, 'and the claim agrees');
  await book.read();
  assert.equal(book.claimWatchDue(), true, 'a claim\'s worth');
  const b2 = createTownSeatBook({
    door: /** @type {any} */ ({ list: async () => ({ ok: true, data: { seats: [] } }), watch: async () => ({ ok: true }) }),
    storage: null, nowMs: () => now, me: () => 'acct-0001', character: () => 'c1', isSeatPixel: () => true, relayNowS: () => Math.floor(now / 1000),
  });
  await b2.read();
  b2.keepWatch(await mintWatchReceipt({ s: 'acct-0001', x: 402, y: 151, c: 1 }, kp.privateKey, { subtle, nowS: T }));
  now += 10 * 60_000 - 1000;
  assert.equal(b2.claimWatchDue(), false);
  now += 1000;
  assert.equal(b2.claimWatchDue(), true, 'the oldest ten minutes old');
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(seatBook\?\.claimWatchDue\(\)\) seatBook\.claimWatch\(\);/);
  // the ribbon
  const a = ribbonTints([0, 2]);
  assert.deepEqual(a, ribbonRgba([0, 2]));
  assert.equal(ribbonTints([0, 2]), a, 'the same tints, not parsed again');
  assert.equal(ribbonTints([1, 1]), null);
  assert.equal(ribbonTints('junk'), null);
  assert.match(rd('src/net/remotePlayers.js'), /const band = ribbonTints\(n\.rb\);/);
  // the banners
  let t = [100, 0, 200];
  const anchors = Array.from({ length: 3 }, (_, i) => ({ top: [i, 1, 0], right: [1, 0, 0], out: [0, 0, 1] }));
  const built = new Map([['p', { px: 1, py: 2, homeTown: 3021, seatAnchors: anchors }]]);
  const sb = createSeatBanners({ built: () => built, seatAt: () => ({ key: 3021, tier: 'palace', region: 21, holder: null }), translation: () => t, now: () => 0, version: () => 1 });
  const first = sb.list();
  assert.equal(first.length, 3);
  t = [110, 5, 210];
  const second = sb.list();
  assert.equal(second, first, 'the one kept list');
  assert.deepEqual(second[1].top, [111, 6, 210], 'refilled where the origin moved it');
});

test('AUDIT-SEATS C13 THE RELINQUISH BUTTON DISARMS ITSELF: armed by a press, drawn again with its first words once its four seconds run, without another redraw to wait on (mutant: the timer)', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const t = tabRig(seatData());
    t.tab.open(); await settle();
    const button = () => byClass(t.tab.body(), 'notice-seat-relinquish')[0];
    assert.equal(button().textContent, SEAT_RELINQUISH_WORDS.arm);
    button().onclick();
    assert.equal(button().textContent, SEAT_RELINQUISH_WORDS.sure);
    const renders = t.renders;
    t.nowS += SEAT_RELINQUISH_ARM_MS / 1000;
    mock.timers.tick(SEAT_RELINQUISH_ARM_MS - 1);
    assert.equal(t.renders, renders, 'not before its arm runs out');
    mock.timers.tick(1);
    assert.equal(t.renders, renders + 1, 'drawn again');
    assert.equal(button().textContent, SEAT_RELINQUISH_WORDS.arm);
  } finally { mock.timers.reset(); }
});

test('AUDIT-SEATS G1 THE MARKS: the Turning that placed a battle, 24 hours, 1 hour and 5 minutes before it is joined; the latest passed, none before the Turning and none once joined; the Seat tab\'s line reads the service\'s seconds (mutants: each mark; the joined; the seconds)', () => {
  const week = 20, start = seatWeekStartMs(week) + 3 * 86_400_000 + 20 * 3_600_000;
  assert.deepEqual(heraldMarks(week, start), [['turning', seatWeekStartMs(week)], ['day', start - 86_400_000], ['hour', start - 3_600_000], ['five', start - 300_000]]);
  assert.deepEqual(SIEGE_HERALD_BEFORE_MS, { day: 86_400_000, hour: 3_600_000, five: 300_000 });
  assert.deepEqual([seatWeekStartMs(week) - 1, seatWeekStartMs(week), start - 86_400_000 - 1, start - 86_400_000, start - 3_600_000, start - 300_001, start - 300_000, start - 1, start].map((n) => heraldDue(week, start, n)),
    [-1, 0, 0, 1, 2, 2, 3, 3, -1]);
  const f = { kind: 'siege', startsAt: start / 1000, moved: false, attackerGuild: SH, defenderGuild: EO };
  assert.equal(fightAnnouncement(f, 'Anticlere'), battleAnnouncement({ ...f, startsAt: start }, 'Anticlere'));
  assert.equal(fightAnnouncement(f, 'Anticlere'), `The Silver Hand <SH> has won the Right of Siege at Anticlere. Ebon Oath <EO> holds its Charter. Battle is joined ${battleWhenText(start)}.`);
  assert.notEqual(battleWhenText(start), battleWhenText(start / 1000), 'the seconds read as seconds');
  assert.equal(fightAnnouncement({ kind: 'siege' }, 'x'), null);
  assert.match(rd('src/ui/seatTab.js'), /out\.append\(el\('p', 'notice-seat-battle', fightAnnouncement\(f, seat\.name\)\)\);/);
});

test('AUDIT-SEATS G1 THE HERALD: each battle at a seat this client derives said in red at each mark, ONCE a page however often the list is read; a page opened late hears the latest mark alone; nothing once joined; a void battle and a seat the derivation lacks never; a line the chat cannot take yet offered again; its start read once a seat a week, or taken from the list (mutants: the once; the late; the void; the derivation; the retry; the one read)', async () => {
  const week = 20, start = seatWeekStartMs(week) + 3 * 86_400_000 + 20 * 3_600_000;
  let now = seatWeekStartMs(week) + 3_600_000;
  let list = [{ key: 3021, battle: { kind: 'siege', guild: SH, against: EO } }, { key: 9999, battle: { kind: 'siege', guild: SH, against: EO } }, { key: 5023, battle: null }];
  const reads = [], said = [];
  let chat = true, looked = 0;
  const fights = { 3021: { week, kind: 'siege', startsAt: start / 1000, moved: false, state: 'scheduled', attackerGuild: SH, defenderGuild: EO } };
  const herald = createSiegeHerald({
    seats: () => { looked++; return list; },
    fightOf: async (key) => { reads.push(key); return fights[key] ?? null; },
    nameOf: (key) => ({ 3021: 'Anticlere', 5023: 'Wayrest' })[key] ?? null,
    say: (text, at) => { if (!chat) return false; said.push([text, at]); return true; },
    nowMs: () => now,
  });
  const line = fightAnnouncement(fights[3021], 'Anticlere');
  herald.tick(); herald.tick(); await settle();
  assert.equal(looked, 1, 'it looks once a second, not once a frame');
  assert.deepEqual(reads, [3021], 'a seat the derivation lacks is never asked');
  now += SIEGE_HERALD_TICK_MS; herald.tick();
  assert.deepEqual(said, [[line, seatWeekStartMs(week)]], 'the Turning\'s');
  for (let i = 0; i < 3; i++) { list = list.slice(); now += SIEGE_HERALD_TICK_MS; herald.tick(); await settle(); }
  assert.equal(said.length, 1, 'once, however often the list is read');
  assert.deepEqual(reads, [3021], 'its start read once a seat a week');
  now = start - 86_400_000; herald.tick();
  now += 500; herald.tick();
  assert.equal(said.length, 2);
  assert.equal(said[1][1], start - 86_400_000);
  chat = false;
  now = start - 3_600_000 + 10; herald.tick();
  assert.equal(said.length, 2, 'no chat yet');
  chat = true;
  now += SIEGE_HERALD_TICK_MS; herald.tick();
  assert.equal(said.length, 3, 'offered again');
  now = start - 300_000; herald.tick();
  now = start + 60_000; herald.tick();
  assert.equal(said.length, 4, 'five minutes before; nothing once joined');
  // a page opened late: the latest mark alone
  const late = [];
  const h2 = createSiegeHerald({ seats: () => list, fightOf: async (key) => fights[key] ?? null, nameOf: () => 'Anticlere', say: (t, at) => late.push(at), nowMs: () => start - 30 * 60_000 });
  h2.tick(); await settle();
  const h2b = h2;
  // the clock does not move, so look again past the timer's second by a fresh herald on the same answer
  const h3 = createSiegeHerald({ seats: () => list, fightOf: async (key) => fights[key] ?? null, nameOf: () => 'Anticlere', say: (t, at) => late.push(at), nowMs: (() => { let n = start - 30 * 60_000; return () => (n += SIEGE_HERALD_TICK_MS); })() });
  h3.tick(); await settle(); h3.tick(); h3.tick();
  assert.deepEqual(late, [start - 3_600_000], 'the record: the hour\'s mark, not the Turning\'s and the day\'s before it');
  assert.ok(h2b.known.get(3021), 'known');
  // void, and a battle the list no longer names
  const v = [];
  let n = start - 3_600_000;
  const h4 = createSiegeHerald({ seats: () => list, fightOf: async () => ({ ...fights[3021], state: 'void' }), nameOf: () => 'Anticlere', say: (t) => v.push(t), nowMs: () => (n += SIEGE_HERALD_TICK_MS) });
  h4.tick(); await settle(); h4.tick();
  assert.deepEqual(v, [], 'a void battle is never announced');
  // the list's own start spares the read
  const r5 = [], s5 = [];
  let n5 = start - 2 * 3_600_000;
  const h5 = createSiegeHerald({ seats: () => [{ key: 3021, battle: { kind: 'siege', guild: SH, against: EO, startsAt: start / 1000 } }], fightOf: async (k) => { r5.push(k); return null; }, nameOf: () => 'Anticlere', say: (t) => s5.push(t), nowMs: () => (n5 += SIEGE_HERALD_TICK_MS) });
  h5.tick();
  assert.deepEqual([r5, s5], [[], [line]], 'no read; the day\'s mark said');
  // a battle the list stops naming (voided after the Turning) is not announced at its later marks
  let named = true;
  const s6 = [];
  let n6 = start - 2 * 3_600_000;
  const h6 = createSiegeHerald({ seats: () => (named ? [{ key: 3021, battle: { kind: 'siege', guild: SH, against: EO, startsAt: start / 1000 } }] : [{ key: 3021, battle: null }]), fightOf: async () => null, nameOf: () => 'Anticlere', say: (t) => s6.push(t), nowMs: () => n6 });
  h6.tick();
  named = false; n6 = start - 3_600_000 + 5; h6.tick();
  assert.deepEqual(s6, [line], 'the day\'s mark, and no hour\'s');
  assert.equal(seatWeekOf(start), week);
  const w = rd('src/scenes/world.js');
  assert.match(w, /siegeHerald = createSiegeHerald\(\{\n\s*seats: \(\) => \(seatBook\.open === true \? seatBook\.data\?\.seats \?\? null : null\),\n\s*fightOf: \(key\) => seatBook\.standings\(key\)\.then\(\(r\) => r\?\.data\?\.fight \?\? null\),\n\s*nameOf: \(key\) => seatAtMapId\(townSeats, key\)\?\.name \?\? null,\n\s*say: \(text, at\) => \(redChat \? redChat\(\{ text, at \}\) : false\),\n\s*nowMs: battleNowMs,/);
  assert.match(w, /siegeHerald\?\.tick\(\);/);
});

test('AUDIT-SEATS G5 A SHAFT, A SPELL AND THE WARDS: an arrow\'s blow is a shaft\'s on the wire; a harmful spell\'s harm and a heal\'s restoring counted through the one spell door (the heal as a gift lands - no save), clamped to what the referee keeps; Teleport (its Recall) and Levitate refused (mutants: the kind; each count; the self-cast; the clamps; the barred list)', () => {
  assert.deepEqual([siegeBlowKind('arrow'), siegeBlowKind('melee'), siegeBlowKind(undefined)], [SIEGE_HIT.Shaft, SIEGE_HIT.Melee, SIEGE_HIT.Melee]);
  assert.deepEqual([siegeCastClamp(500), siegeCastClamp(500, true), siegeCastClamp(12.4), siegeCastClamp(-3), siegeCastClamp('x', true)], [SIEGE_CASTS.damageMax, SIEGE_CASTS.healMax, 12, 0, 0]);
  const me = { level: 10, raceId: 1, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(40).fill(50), health: 100, maxHealth: 100, career: {}, activeEffects: [], items: [], equipTable: {} };
  const stub = () => duelStub(duelAttackerOf(me)).stub;
  const fire = { name: 'Fire', element: 0, rangeType: 2, effects: [eff(4, 0, 25)] };
  const heal = { name: 'Heal', element: 4, rangeType: 1, effects: [eff(10, 8, 30)] };
  const lowRoll = () => 0.01;   // a roll that saves against a spell landed at range
  assert.deepEqual(siegeSpellNumbers(heal, 10, stub(), me, { rolls: lowRoll }), { harm: 0, heal: 30 }, 'a gift lands whole - no save rolled');
  const f = siegeSpellNumbers(fire, 10, stub(), me, { rolls: () => 0.99 });
  assert.ok(f.harm > 0 && f.heal === 0, JSON.stringify(f));
  assert.deepEqual(siegeSpellNumbers({ name: 'Light', rangeType: 0, effects: [eff(29, 255, 1)] }, 10, stub(), me), { harm: 0, heal: 0 });
  assert.deepEqual(siegeSpellNumbers(fire, 10, stub(), me, { apply: () => { throw new Error('no'); } }), { harm: 0, heal: 0 }, 'a spell that throws counts nothing');
  const s = stub();
  const rot = siegeSpellNumbers({ name: 'Rot', element: 0, rangeType: 2, effects: [{ ...eff(1, 0, 5), durationBase: 5 }] }, 10, s, me, { rolls: () => 0.99 });
  assert.ok(rot.harm > 0, 'a continuous damage\'s first round is harm at once');
  assert.deepEqual(s.activeEffects, [], 'the stand-in keeps nothing (its rounds would have stood on it)');
  assert.deepEqual([...SIEGE_BARRED_EFFECTS], [43, 14]);
  assert.deepEqual([siegeSpellBarred({ effects: [eff(43, 255, 0)] }), siegeSpellBarred({ effects: [eff(4, 0, 1), eff(14, 255, 0)] }), siegeSpellBarred(fire), siegeSpellBarred(null)], [true, true, false, false]);
});

test('AUDIT-SEATS G5 THE ENGINE\'S WARDS AND MARKS: a spell its host refuses for what it is (spellRefusal) readies nothing, fires nothing readied before, and an item\'s lands nothing - each said; an area spell reaches every mark a host answers in an array (mutants: each gate; the array)', () => {
  const said = [], cast = [];
  const player = { isPlayer: true, level: 5, health: 20, maxHealth: 50, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const place = { ward: true };
  const marks = [{ id: 'foe-0001', feet: [1, 0, 0], height: 1.8 }, { id: 'foe-0002', feet: [0, 0, 1], height: 1.8 }];
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal: (n) => { player.health = Math.min(player.maxHealth, player.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => said.push(l) },
    say: (l) => said.push(l), surfacePlayer() {}, foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: false, day: true }), rolls: () => 0.99,
    spellRefusal: (sp) => (place.ward && siegeSpellBarred(sp) ? SIEGE_SPELL_BARRED_TEXT : null),
    duelMark: () => marks, castAtDuel: (id) => { cast.push(id); return true; },
  });
  const lev = { name: 'Levitate', index: 91, element: 4, rangeType: 0, effects: [eff(14, 255, 0)] };
  assert.equal(magic.readySpell(lev), false);
  assert.equal(said.at(-1), SIEGE_SPELL_BARRED_TEXT);
  said.length = 0;
  assert.equal(magic.readySpell({ name: 'Far Lift', index: 94, element: 4, rangeType: 2, effects: [eff(14, 255, 0)] }), false, 'a ranged one is not even readied');
  assert.deepEqual([said, magic.spellArmed()], [[SIEGE_SPELL_BARRED_TEXT], false]);
  place.ward = false;
  const tele = { name: 'Teleport', index: 92, element: 4, rangeType: 2, effects: [eff(43, 255, 0)] };
  assert.equal(magic.readySpell(tele), true, 'out of the battle\'s room: as ever');
  place.ward = true;
  const mana = player.magicka;
  assert.equal(magic.castInput([0, 1, 0], [0, 0, 1]), false, 'readied before, not fired in it');
  assert.equal(player.magicka, mana, 'nothing spent');
  assert.equal(magic.spellArmed(), false);
  const hp = player.health;
  assert.equal(magic.castByItemSelf({ name: 'Ring', rangeType: 0, element: 4, effects: [eff(14, 255, 0), eff(10, 8, 20)] }), null);
  assert.equal(player.health, hp, 'an item\'s warded spell lands nothing');
  // an area around me: both foes' bodies
  const blast = { name: 'Blast', index: 93, element: 0, rangeType: 3, effects: [eff(4, 0, 10)] };
  assert.equal(magic.readySpell(blast), true);
  magic.castInput([0, 1, 0], [0, 0, 1]);
  assert.deepEqual(cast.sort(), ['foe-0001', 'foe-0002'], 'each mark the host answered');
});

test('AUDIT-SEATS G5 LEVITATE WARDED IN THE ONE WRITE: a Levitate running lifts nothing while the ward holds - the flag written once, never set and cleared (the motor cancels a step on each change); the staff\'s /fly is never warded (mutants: the ward; the order)', () => {
  const writes = [];
  const player = { set levitating(v) { writes.push(v); }, get levitating() { return writes.at(-1); } };
  const entity = { activeEffects: [{ kind: 'levitate', roundsRemaining: 5 }] };
  let ward = true;
  registerLevitateWard(() => ward);
  try {
    assert.equal(levitateWarded(), true);
    applyMotorEffectFlags(player, entity);
    assert.deepEqual(writes, [false], 'one write, lifting nothing');
    ward = false; writes.length = 0;
    applyMotorEffectFlags(player, entity);
    assert.deepEqual(writes, [true]);
    ward = true; writes.length = 0;
    setStaffPowers({ fly: true });
    applyMotorEffectFlags(player, entity);
    assert.deepEqual(writes, [true], 'the staff\'s /fly is the typer\'s own');
    registerLevitateWard(() => { throw new Error('x'); });
    assert.equal(levitateWarded(), false, 'a ward that throws wards nothing');
  } finally { setStaffPowers({ fly: false }); registerLevitateWard(null); }
});

test('AUDIT-SEATS G4 A SPECTATOR\'S FREE CAMERA: while the host says I watch a battle from its room, the one motor-flag write lifts me - the motor\'s own flight (WASD, the mouse, the pad\'s sticks; the float keys up and down), a warded Levitate notwithstanding; a flight that throws lifts nothing; the host\'s watch, set back where I stood when it ends on the street, forgotten at a death (mutants: the flight; the throw; the watch; the return; the street; the death)', () => {
  const writes = [];
  const player = { set levitating(v) { writes.push(v); }, get levitating() { return writes.at(-1); } };
  let watching = true;
  registerFreeFlight(() => watching);
  registerLevitateWard(() => true);
  try {
    applyMotorEffectFlags(player, { activeEffects: [] });
    assert.deepEqual(writes, [true], 'one write: the spectator flies');
    watching = false; writes.length = 0;
    applyMotorEffectFlags(player, { activeEffects: [] });
    assert.deepEqual(writes, [false]);
    registerFreeFlight(() => { throw new Error('x'); });
    writes.length = 0;
    applyMotorEffectFlags(player, { activeEffects: [] });
    assert.deepEqual(writes, [false], 'a flight that throws lifts nothing');
  } finally { registerFreeFlight(null); registerLevitateWard(null); }
  const w = rd('src/scenes/world.js');
  assert.match(w, /const spectatingHere = \(\) => \{\n\s*const b = siegeSession\?\.active\(\) \? siegeSession : royalSession;\n\s*return !!b\?\.active\(\) && b\.side\(\) === 'watch' && !!online\?\.room && online\.room === b\.room\(\);/);
  assert.match(w, /registerFreeFlight\(\(\) => spectatingHere\(\)\);/);
  assert.match(w, /if \(watching\) \{ if \(!_watchedFrom\) _watchedFrom = campToWire\(player\.pos\); return; \}/);
  assert.match(w, /if \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior'\) \{\n\s*const q = campToScene\(_watchedFrom\);\n\s*player\.pos\[0\] = q\[0\]; player\.pos\[1\] = q\[1\]; player\.pos\[2\] = q\[2\];\n\s*player\._airVelX = 0; player\._airVelZ = 0; player\.velY = 0; player\.falling = false; player\.fallStart = player\.pos\[1\];/);
  assert.match(w, /\n\s*spectatorFrame\(\);   \/\/ AUDIT-SEATS G4/);
  assert.match(w, /\{ leaveBattle\(\); _watchedFrom = null; \}/);
});

test('AUDIT-SEATS G5 THE WORLD\'S BATTLE ARMS by source: the swing and the shaft one door with their kinds; the arrows and the cast engine see a battle\'s foes outside a duel; a heal on a side-mate goes to the referee; the wards and the saddle in a siege\'s room; the side-mates (mutants: each wire)', async () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const duelStrikeOut = \(by, weapon, swing, drawMs = 0, to = null\) => \{\n\s*if \(!duelMgr\.fighting\) return siegeStrikeOut\(to, by, weapon, swing, drawMs\);/);
  assert.match(w, /const duelSpellOut = \(peerId, sp\) => \{\n\s*if \(!duelMgr\.fighting\) return siegeSpellOut\(peerId, sp\);/);
  assert.match(w, /siegeStrikeOut\(best, 'melee', weaponRig\.playerWeapon\.strikingWeapon, weaponRig\.playerWeapon\.machine\?\.state\);/);
  assert.match(w, /battle\.blow\(to, \{ w: weapon \? weapon\.templateIndex : -1, m: held\?\.material \?\? 0, d: r\.dmg, r: siegeBlowKind\(by\) \}\);/);
  assert.match(w, /duelStrikeOut\('arrow', m\.weapon \?\? null, 'StrikeDown', weaponRig\.playerWeapon\?\.lastDrawMs \?\? 0, t\.id\)/);
  assert.match(w, /const duelArrowTargets = \(\) => \{\n\s*if \(!duelMgr\.fighting\) \{\n\s*const bodies = battleFoeBodies\(royalSession\?\.active\(\) \? royalSession : siegeSession\);/);
  assert.match(w, /duelMark: \(\) => \{ if \(!duelMgr\.fighting\) return siegeSpellMarks\(\);/);
  assert.match(w, /return harm > 0 && siegeSession\.cast\(peerId, siegeCastClamp\(harm, false\)\);/);
  assert.match(w, /const castAtAllyDoor = \(id, frame\) => siegeHealOut\(id, frame\) \|\| !!online\?\.sendCast\?\.\(frame\);/);
  assert.match(w, /return heal > 0 && siegeSession\.cast\(id, siegeCastClamp\(heal, true\), true\);/);
  assert.match(w, /spellRefusal: \(sp\) => battleSpellRefusal\(sp\),/);
  assert.match(w, /const battleSpellRefusal = \(sp\) => \(inSiegeRoom\(\) && siegeSpellBarred\(sp\) \? SIEGE_SPELL_BARRED_TEXT : null\);/);
  assert.match(w, /registerLevitateWard\(\(\) => inSiegeRoom\(\)\);/);
  assert.match(w, /if \(inSiegeRoom\(\) && isRiding\(player\.transportMode\)\) \{ setTransportModeHere\(TRANSPORT_MODES\.Foot\); townTalk\.say\(SIEGE_DISMOUNT_TEXT\); \}/);
  // the side-mates the heal reaches: standing, of my side, never me
  const t = siegeRig();
  t.ses.enter(ANTICLERE, FIGHT, [[1, 2]]); await settle();
  t.ses.onSiege({ k: 'st', f: [['me-00001', 320, 320, 0, 1], ['mate-001', 320, 320, 0, 1], ['mate-002', 0, 320, 1, 1], ['foe-0001', 400, 400, 0, 2]] }, t.ses.room());
  assert.deepEqual(t.ses.mates(), ['mate-001']);
  assert.deepEqual(t.ses.foes(), ['foe-0001']);
  const eye = createSiegeSession({ online: t.online, pass: async () => ({ ok: true, side: 'watch', week: 20, window: 9e9 }), relayOk: () => true });
  eye.enter(ANTICLERE, FIGHT, [[1, 2]]); await settle();
  eye.onSiege({ k: 'st', f: [['mate-001', 320, 320, 0, 1]] }, eye.room());
  assert.deepEqual(eye.mates(), [], 'a spectator heals no one');
  assert.equal(royalRoomKey(5023, 20), 'royal:5023:20');
});
