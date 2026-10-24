// SEAT2a part four (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE CLIENT'S
// SIEGE - the room's words projected (net/wire.js validSiegeOut) and folded (net/siege/siegeLink.js), the HUD's words and its
// readout (ui/siegeHud.js), the receipts carried (net/siege/siegeClaims.js), the field the town's records give
// (systems/siegeField.js), the socket's pass on every hello (net/online.js), and the session that ties them
// (net/siege/siegeSession.js). bible/11-Multiplayer/Seats-Arc.md 6.2, 6.8, 19; `06-Systems/Online-Arc.md` SEAT2a (part four).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../chargenDom.mjs';
import { validSiegeOut, SIEGE_END_RESULTS, SIEGE_ROLL_MAX, PIXEL_UNITS } from '../../../src/net/wire.js';
import { SIEGE_RESULTS, mintSiegeReceipt } from '../../../src/net/siege/siegeReceipt.js';
import { foldSiege, SIEGE_STATE_EMPTY, siegeBarLines, siegeSidesLine, siegeSelfLines, siegeResultTitle, siegeResultLine, siegeHonourLine, siegeClockText, bannerMark, siegeHudModel } from '../../../src/net/siege/siegeLink.js';
import { createSiegeHud, SIEGE_HUD_STYLE_ID } from '../../../src/ui/siegeHud.js';
import { createSiegeClaims, siegeClaimSettles, SIEGE_CLAIMS_KEY, SIEGE_CLAIM_RETRY_MS, SIEGE_CLAIMS_MAX } from '../../../src/net/siege/siegeClaims.js';
import { siegeFieldOf, siegeFieldWire, siegeWorldPoint, doorFace, buildingKeysOfType, SIEGE_FIELD } from '../../../src/systems/siegeField.js';
import { createSiegeSession, SIEGE_SESSION_TEXT, SIEGE_PASS_RETRY_MS } from '../../../src/net/siege/siegeSession.js';
import { siegeFieldValid } from '../../../src/net/identityToken.js';
import { SIEGE_UNITS_PER_M, siegeRoomKey } from '../../../src/net/siege/siegeRef.js';
import { OnlineSession } from '../../../src/net/online.js';

const { subtle } = globalThis.crypto;
const AT = 1_800_000_000_000;
const pose = (x, z) => ({ x, y: 0, z, yaw: 0, pitch: 0 });
const SH = { name: 'The Silver Hand', tag: 'SH' }, EO = { name: 'Ebon Oath', tag: 'EO' };
const BATTLE = { seat: 'Anticlere', kind: 'siege', tier: 'palace', attacker: EO, defender: SH };

test('SEAT2a part four THE ROOM\'S WORDS: each kind projected and bounded - the roll call, a fighter\'s vitality, a fall, a rise at its camp, a pull-back, a refusal, the field, the end and its receipt; anything else null; the end\'s results pinned EQUAL to the receipt\'s (mutants: each bound; the results)', () => {
  assert.deepEqual([...SIEGE_END_RESULTS], [...SIEGE_RESULTS], 'the wire imports no receipt\'s law - pinned equal');
  assert.deepEqual(validSiegeOut({ k: 'st', f: [['peer-0001', 320, 320, 0, 1], ['peer-0002', 0, 400, 1]] }), { k: 'st', f: [['peer-0001', 320, 320, 0, 1], ['peer-0002', 0, 400, 1]] });
  for (const f of [[['x', 1, 1, 0]], [['peer-0001', 2, 1, 0]], [['peer-0001', 1, 1, 2]], [['peer-0001', 1, 1, 0, 3]], [['peer-0001', 1001, 1001, 0]], Array.from({ length: SIEGE_ROLL_MAX + 1 }, () => ['peer-0001', 1, 1, 0])]) {
    assert.equal(validSiegeOut({ k: 'st', f }), null, JSON.stringify(f).slice(0, 60));
  }
  assert.deepEqual(validSiegeOut({ k: 'hp', id: 'peer-0001', h: 300, m: 320, junk: 1 }), { k: 'hp', id: 'peer-0001', h: 300, m: 320 });
  assert.equal(validSiegeOut({ k: 'hp', id: 'peer-0001', h: 330, m: 320 }), null);
  assert.deepEqual(validSiegeOut({ k: 'fell', id: 'peer-0001', by: 'peer-0002' }), { k: 'fell', id: 'peer-0001', by: 'peer-0002' });
  assert.equal(validSiegeOut({ k: 'fell', id: 'peer-0001' }), null);
  assert.deepEqual(validSiegeOut({ k: 'up', id: 'peer-0001' }), { k: 'up', id: 'peer-0001' });
  assert.deepEqual(validSiegeOut({ k: 'up', id: 'peer-0001', p: pose(5, 6) }).p.x, 5);
  assert.equal(validSiegeOut({ k: 'up', id: 'peer-0001', p: { x: 'a' } }), null);
  assert.equal(validSiegeOut({ k: 'back', p: pose(1, 2) }).p.z, 2);
  assert.equal(validSiegeOut({ k: 'back' }), null);
  assert.deepEqual(validSiegeOut({ k: 'no', m: 'the field is full' }), { k: 'no', m: 'the field is full' });
  assert.equal(validSiegeOut({ k: 'no', m: 'x'.repeat(121) }), null);
  const f = { k: 'f', b: [[1, 3, 2], [0, 0, 0], [2, 19, 1]], th: 12, s: 10, e: 20, n: [1, 2, 3] };
  assert.deepEqual(validSiegeOut(f), f);
  for (const bad of [{ b: [[1, 3, 2], [0, 0, 0]] }, { b: [[3, 0, 0], [0, 0, 0], [0, 0, 0]] }, { b: [[0, 21, 0], [0, 0, 0], [0, 0, 0]] }, { th: 181 }, { e: 10 }, { n: [1, 2] }, { n: [1, 2, 201] }]) {
    assert.equal(validSiegeOut({ ...f, ...bad }), null, JSON.stringify(bad));
  }
  assert.deepEqual(validSiegeOut({ k: 'end', r: 'forfeit', a: 0, rc: 's1.abc.' }), { k: 'end', r: 'forfeit', a: 0, rc: 's1.abc.' });
  for (const bad of [{ r: 'void' }, { a: 2 }, { rc: 'r1.abc.def' }, { rc: 7 }]) assert.equal(validSiegeOut({ k: 'end', r: 'attack', a: 1, ...bad }), null, JSON.stringify(bad));
  assert.equal(validSiegeOut({ k: 'nope' }), null);
});

test('SEAT2a part four THE FOLD AND THE HUD\'S WORDS: the roll call replaces every fighter, a vitality, a fall and a rise move one, the field replaces the field, the end is said with this fighter\'s receipt; the bar (the seat, the two guilds, the clock to the start and to the end, each banner\'s mark - ^ attackers, o defenders, ~ a raise under way - and the Throne\'s share and rule), the sides, the vitality and the wave, the spectator\'s count, the result card (mutants: each fold; each mark; the clock; the Throne\'s rule; the titles; the honour line)', () => {
  let s = foldSiege(SIEGE_STATE_EMPTY, validSiegeOut({ k: 'st', f: [['me-00001', 320, 320, 0, 1], ['foe-0001', 400, 400, 0, 2], ['foe-0002', 302, 302, 1, 2]] }), AT);
  assert.deepEqual(s.roll['me-00001'], { hp: 320, max: 320, down: false, side: 'attack' });
  s = foldSiege(s, { k: 'hp', id: 'foe-0001', h: 100, m: 400 }, AT);
  assert.deepEqual(s.roll['foe-0001'], { hp: 100, max: 400, down: false, side: 'defend' });
  s = foldSiege(s, { k: 'fell', id: 'me-00001', by: 'foe-0001' }, AT + 5000);
  assert.deepEqual([s.roll['me-00001'].down, s.roll['me-00001'].hp, s.fellAt['me-00001']], [true, 0, AT + 5000]);
  assert.deepEqual(siegeSelfLines(s, 'me-00001', AT + 5000), ['vitality  ..........  0 / 320', `next wave in ${Math.ceil((Math.ceil((AT + 5000) / 20000) * 20000 - (AT + 5000)) / 1000)} s`]);
  assert.deepEqual([siegeSelfLines(s, 'me-00001', AT + 5000)[1], siegeSelfLines(s, 'me-00001', AT + 5000, { tier: 'crown' })[1]], ['next wave in 15 s', 'next wave in 25 s'], 'the tier\'s own wave');
  assert.equal(foldSiege(s, { k: 'hp', id: 'me-00001', h: 320, m: 320 }, AT).roll['me-00001'].down, false, 'whole again is up, whatever word said it');
  s = foldSiege(s, { k: 'up', id: 'me-00001' }, AT + 20000);
  assert.deepEqual(s.roll['me-00001'], { hp: 320, max: 320, down: false, side: 'attack' });
  assert.deepEqual(siegeSelfLines(s, 'me-00001', AT), ['vitality  ||||||||||  320 / 320']);
  s = foldSiege(s, { k: 'hp', id: 'me-00001', h: 160, m: 320 }, AT);
  assert.equal(siegeSelfLines(s, 'me-00001', AT)[0], 'vitality  |||||.....  160 / 320');
  assert.deepEqual(siegeSelfLines(s, 'nobody', AT), []);
  s = foldSiege(s, { k: 'f', b: [[1, 0, 0], [2, 5, 1], [2, 0, 0]], th: 30, s: AT + 60_000, e: AT + 60_000 + 1_800_000, n: [3, 4, 41] }, AT);
  assert.deepEqual(siegeSelfLines(s, 'me-00001', AT, { watching: true }), ['Spectating - 41 of 60']);
  assert.deepEqual(siegeBarLines(s, BATTLE, AT), [
    'ANTICLERE   The Silver Hand <SH>   vs   Ebon Oath <EO>   joined in 1:00',
    'GATE [^ EO]    MARKET [~ 5/20]    TEMPLE [o SH]    THRONE 25% (2 of 3)',
  ]);
  assert.equal(siegeBarLines(s, BATTLE, AT + 60_000 + 1_800_000 - 754_000)[0].endsWith('12:34'), true, 'the clock to the end');
  assert.equal(siegeBarLines(foldSiege(s, { k: 'f', b: [[1, 0, 0], [1, 0, 0], [2, 0, 0]], th: 60, s: AT, e: AT + 1, n: [0, 0, 0] }, AT), BATTLE, AT)[1].endsWith('THRONE OPEN 50% (2 of 3)'), true);
  assert.equal(siegeBarLines(s, { ...BATTLE, kind: 'tourney' }, AT)[1], 'GATE [^ EO]    MARKET [~ 5/20]    TEMPLE [o SH]', 'a Tourney has no Throne');
  assert.equal(bannerMark([0, 0, 0], EO, SH), '-');
  assert.equal(bannerMark([1, 4, 1], EO, SH), '^ EO', 'its own side\'s raise is no contest');
  assert.equal(siegeClockText(61_001), '1:02');
  assert.equal(siegeClockText(-5), '0:00');
  assert.equal(siegeSidesLine(s, BATTLE), 'SH  1 up / 1 down      EO  1 up / 0 down');
  // the end
  s = foldSiege(s, { k: 'end', r: 'attack', a: 1, rc: 's1.x.y' }, AT + 60_000 + 74_000);
  assert.deepEqual([s.end, s.receipt], [{ r: 'attack', a: 1 }, 's1.x.y']);
  assert.equal(foldSiege(s, { k: 'end', r: 'attack', a: 1 }, AT).receipt, 's1.x.y', 'a receipt once heard is kept');
  assert.equal(siegeResultLine(s), '1 minutes 14 seconds.  Gate ^  Market o  Temple o');
  assert.deepEqual(['attack', 'defend', 'forfeit', 'absent'].map((r) => siegeResultTitle({ r }, BATTLE)), [
    'EBON OATH TAKES THE THRONE OF ANTICLERE', 'THE SILVER HAND HOLDS THE THRONE OF ANTICLERE',
    'EBON OATH NEVER CAME - THE SILVER HAND HOLDS ANTICLERE', 'NEITHER SIDE CAME - THE SILVER HAND KEEPS ANTICLERE']);
  assert.deepEqual(['attack', 'defend', 'tie'].map((r) => siegeResultTitle({ r }, { ...BATTLE, kind: 'tourney' })), [
    'EBON OATH WINS THE TOURNEY FOR ANTICLERE', 'THE SILVER HAND WINS THE TOURNEY FOR ANTICLERE', 'A DEAD HEAT AT ANTICLERE - THE GREATER INFLUENCE TAKES IT']);
  assert.equal(siegeHonourLine({ marks: 50, xp: 2000 }), 'Your Honor: 50 silver, 2,000 Renown, one Spoils of War roll');
  assert.match(siegeHonourLine({ marks: 0, xp: 0, spent: true }), /earned already this Season/);
  assert.match(siegeHonourLine(null), /^No Honors this battle/);
  assert.equal(foldSiege(s, { k: 'no', m: 'the stands are full' }, AT).no, 'the stands are full');
  assert.equal(foldSiege(s, { k: 'back', p: pose(0, 0) }, AT), s, 'a pull-back moves the player, not the state');
});

test('SEAT2a part four THE READOUT: made on the first update and updated, never rebuilt - each line written only when it changes; the result card with its Claim while a receipt waits and the Honours once answered; hidden, never removed (mutants: the card; the claim; the rewrite; the hide)', () => {
  let claimed = 0;
  const hud = createSiegeHud(document, { onClaim: () => { claimed++; } });
  let s = foldSiege(SIEGE_STATE_EMPTY, { k: 'f', b: [[2, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: AT, e: AT + 1_800_000, n: [1, 1, 0] }, AT);
  hud.update(siegeHudModel(s, BATTLE, 'me-00001', AT));
  const node = hud.node;
  assert.ok(document.head.children.some((n) => n.id === SIEGE_HUD_STYLE_ID), 'its sheet in the head');
  assert.match(node.textContent, /ANTICLERE/);
  const card = node.querySelector('.sg-card');
  assert.equal(card.style.display, 'none', 'no card before the end');
  const title = node.querySelector('.sg-bar').children[0];
  const seen = title.textContent;
  hud.update(siegeHudModel(s, BATTLE, 'me-00001', AT));
  assert.equal(node.querySelector('.sg-bar').children[0], title, 'updated, never rebuilt');
  assert.equal(title.textContent, seen);
  s = foldSiege(s, { k: 'end', r: 'defend', a: 0, rc: 's1.x.y' }, AT + 1_800_000);
  hud.update(siegeHudModel(s, BATTLE, 'me-00001', AT + 1_800_000, { claimable: true }));
  assert.equal(card.style.display, '');
  assert.match(card.textContent, /THE SILVER HAND HOLDS THE THRONE OF ANTICLERE/);
  assert.match(card.textContent, /Your receipt is saved\. Claim it for your Honors\./);
  const claim = card.querySelector('button');
  assert.equal(claim.style.display, '');
  claim.click();
  assert.equal(claimed, 1);
  hud.update(siegeHudModel(s, BATTLE, 'me-00001', AT + 1_800_000, { honours: { marks: 25, xp: 1000 } }));
  assert.match(card.textContent, /Your Honor: 25 silver, 1,000 Renown/);
  assert.equal(claim.style.display, 'none', 'nothing more to claim');
  hud.update(siegeHudModel(s, BATTLE, 'eye-0001', AT + 1_800_000, { watching: true, claimable: true }));
  assert.equal(claim.style.display, 'none', 'a spectator claims nothing');
  hud.hide();
  assert.equal(node.style.display, 'none');
  assert.ok(node.parentNode, 'hidden, not removed');
  hud.destroy();
});

test('SEAT2a part four THE RECEIPTS CARRIED: a signed, unexpired receipt kept once and offered at once; only the signed-in account\'s offered; an answer that settles it lets it go (claimed, claimed before, a void battle, not the relay\'s) and one the service can mend keeps it; offered again only past the retry; the oldest go past the bound; kept in storage (mutants: each settling word; the mendable; the account; the retry; the bound; the store)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  let now = AT;
  const nowS = () => Math.floor(now / 1000);
  const rc = (s, sw = 20) => mintSiegeReceipt({ s, sk: 3021, sw, sd: 'attack', r: 'attack', a: 1, h: 1 }, kp.privateKey, { subtle, nowS: nowS() });
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const answers = [];
  let next = { ok: true, result: 'attack', honours: { marks: 50 } };
  const said = [];
  const c = createSiegeClaims({ claim: async (r) => { answers.push(r); return next; }, me: () => 'acct-me01', nowMs: () => now, storage, onClaimed: (a) => said.push(a) });
  assert.equal(c.keep(await mintSiegeReceipt({ s: 'acct-me01', sk: 1, sw: 1, sd: 'attack', r: 'attack', a: 1, h: 1 }, null, { subtle, nowS: nowS() })), false, 'an unsigned receipt is never kept');
  const mine = await rc('acct-me01'), theirs = await rc('acct-them1');
  assert.equal(c.keep(mine), true);
  assert.equal(c.keep(mine), false, 'once');
  c.keep(theirs);
  assert.deepEqual(JSON.parse(store.get(SIEGE_CLAIMS_KEY)), [mine, theirs], 'kept in the store');
  next = { ok: false, error: 'offline' };
  assert.equal(await c.offer(), 0);
  assert.deepEqual(answers, [mine], 'only the signed-in account\'s');
  assert.equal(await c.offer(), 0);
  assert.equal(answers.length, 1, 'not again inside the retry');
  now += SIEGE_CLAIM_RETRY_MS;
  next = { ok: false, error: 'receipt', why: 'signature' };
  await c.offer();
  assert.equal(c.list().length, 2, 'a key the service can mend keeps it');
  next = { ok: true, result: 'attack', honours: { marks: 50 } };
  assert.equal(await c.offer({ force: true }), 1);
  assert.deepEqual(said, [next]);
  assert.deepEqual(c.list(), [theirs]);
  for (const [a, settles] of [[{ ok: true }, true], [{ ok: false, error: 'honours-twice' }, true], [{ ok: false, error: 'battle-none' }, true], [{ ok: false, error: 'receipt', why: 'claims' }, true],
    [{ ok: false, error: 'receipt', why: 'future' }, false], [{ ok: false, error: 'receipt', why: 'clock' }, false], [{ ok: false, error: 'receipt', why: 'verify-threw' }, false],
    [{ ok: false, error: 'not-yours' }, false], [{ ok: false, error: 'no-gate-key' }, false], [null, false]]) {
    assert.equal(siegeClaimSettles(a), settles, JSON.stringify(a));
  }
  // a store read back on a new carrier; the bound
  const again = createSiegeClaims({ claim: async () => ({ ok: false }), me: () => null, nowMs: () => now, storage });
  assert.deepEqual(again.list(), [theirs]);
  assert.equal(await again.offer({ force: true }), 0, 'nobody signed in: nothing offered');
  for (let i = 0; i < SIEGE_CLAIMS_MAX + 2; i++) again.keep(await rc('acct-me01', 100 + i));
  assert.equal(again.list().length, SIEGE_CLAIMS_MAX, 'the oldest go');
  now += 8 * 24 * 3600 * 1000;
  const late = createSiegeClaims({ claim: async () => { throw new Error('asked'); }, me: () => 'acct-me01', nowMs: () => now, storage });
  await late.offer({ force: true });
  assert.deepEqual(late.list(), [], 'an expired receipt is let go unasked');
});

test('SEAT2a part four THE FIELD FROM THE TOWN: the Throne a pace out of the palace door, the defenders\' camp 12 m before it, the Gate 6 m inside the city gate farthest from the palace and the attackers\' camp 14 m outside it, the Market the rumour board nearest the middle (a bounty board skipped), the Temple\'s door else the largest hall\'s, a crown\'s Palace square; a town with no walls; a palace with no door none; the world point pure arithmetic off the pixel - never the floating origin - and the pass\'s field valid (mutants: each point; the farthest; the nearest; the fallbacks; the world point)', () => {
  const door = (a, b, box) => ({ door: { a, b }, box });
  // the palace's door faces +z (away from its middle at z = -10); the Temple's faces +x
  const frames = new Map([
    ['palace', door([-1, 0, 0], [1, 0, 0], [-10, 0, -20, 10, 10, 0])],
    ['temple', door([30, 0, -1], [30, 0, 1], [20, 0, -5, 30, 8, 5])],
    ['hallS', door([0, 0, 50], [2, 0, 50], [0, 0, 40, 2, 5, 50])],
    ['hallL', door([60, 0, 50], [62, 0, 50], [50, 0, 30, 70, 5, 50])],
  ]);
  const gates = [{ box: [-1, 0, 99, 1, 6, 101] }, { box: [-1, 0, 299, 1, 6, 301] }];   // at z 100 and z 300 - the far one the attackers'
  const boards = [{ box: [40, 0, 40, 42, 2, 42] }, { box: [0, 0, 49, 2, 2, 51] }, { box: [9, 0, 59, 11, 2, 61] }];   // the nearest rumour board last
  const f = siegeFieldOf({ frames, palaceKeys: ['palace'], templeKeys: ['temple'], hallKeys: ['hallS', 'hallL'], gates, boards, bounty: new Set([1]), centre: [0, 50] });
  assert.deepEqual(f.throne, [0, SIEGE_FIELD.thronePaceM]);
  assert.deepEqual(f.camps.defend, [0, 12]);
  assert.deepEqual(f.banners[0], [0, 300 - 6], 'inside the far gate, towards the middle');
  assert.deepEqual(f.camps.attack, [0, 300 + 14]);
  assert.deepEqual(f.banners[1], [10, 60], 'the nearest rumour board - the bounty\'s nearer one skipped');
  assert.deepEqual(f.banners[2], [32, 0], 'the Temple\'s door, two paces out');
  assert.equal(f.banners.length, 3);
  const noTemple = siegeFieldOf({ frames, palaceKeys: ['palace'], hallKeys: ['hallS', 'hallL'], gates, boards, centre: [0, 50] });
  assert.deepEqual(noTemple.banners[2], [61, 52], 'the largest hall\'s door');
  const bare = siegeFieldOf({ frames, palaceKeys: ['palace'], centre: [0, 50], tier: 'crown' });
  assert.deepEqual([bare.banners[0], bare.camps.attack, bare.banners[1], bare.banners[2]], [[0, 90], [0, 110], [0, 50], [0, 50]], 'no walls: 40 m and 60 m out from the middle, away from the palace; no board, no temple: the middle');
  assert.deepEqual(bare.banners[3], [0, 20], 'a crown\'s Palace square');
  assert.equal(siegeFieldOf({ frames, palaceKeys: ['temple-none'], centre: [0, 0] }), null, 'no palace door, no field');
  assert.equal(doorFace(door([0, 0, 0], [0.1, 0, 0], [0, 0, 0, 1, 1, 1])), null, 'a door too narrow to face');
  // the world point
  assert.equal(PIXEL_UNITS, 32768); assert.equal(SIEGE_UNITS_PER_M, 40);
  assert.deepEqual(siegeWorldPoint(100, 200, [1.5, -2.25]), [100 * 32768 + 60, 299 * 32768 - 90]);
  const sf = siegeFieldWire(100, 200, f);
  assert.equal(sf.length, 6);
  assert.ok(siegeFieldValid(sf, 'palace'), 'a pass may carry it');
  assert.ok(siegeFieldValid(siegeFieldWire(100, 200, bare), 'crown'));
  assert.equal(siegeFieldWire(1, 1, null), null);
  // the type walk
  const blocks = [{ x: 1, y: 2, dfBlock: { rmbBlock: { fldHeader: { buildingDataList: [{ buildingType: 14 }, { buildingType: 11 }, { buildingType: 14 }] }, subRecords: [{}, {}] } } }];
  assert.deepEqual(buildingKeysOfType(blocks, (x, y, i) => `${x}.${y}.${i}`, 14), ['1.2.0'], 'the records the block holds, no more');
});

test('SEAT2a part four THE SOCKET: a siege\'s room hello carries a fresh pass minted for it (none elsewhere); its words reach the battle from my own socket alone; my words leave only at a relay that fights battles, in a siege\'s room, under the bucket (mutants: the pass on the hello; the room; the gate; the projection)', async () => {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close() {}
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: JSON.stringify(o) }); }
  }
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const o = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => AT });
  let minted = 0;
  o.mintSiegePass = async (room) => { minted++; return `v1.pass${minted}.${room.length}`; };
  const heard = [];
  o.onSiege = (g, room) => heard.push([g.k, room]);
  o.join('cell:100:200', pose(0, 0));
  sockets[0].open(); await settle();
  assert.equal(sockets[0].sent[0].sp, undefined, 'no pass into a town\'s cell');
  assert.equal(minted, 0);
  sockets[0].receive({ t: 'siege', k: 'no', m: 'not here' });
  assert.deepEqual(heard, [], 'a siege\'s word from a town\'s cell reaches nothing');
  const room = siegeRoomKey(3021, 20);
  o.join(room, pose(0, 0));
  const ws = sockets.at(-1);
  ws.open(); await settle();
  assert.equal(ws.sent[0].t, 'hello');
  assert.equal(ws.sent[0].sp, `v1.pass1.${room.length}`, 'a pass minted for this hello');
  assert.equal(o.sendSiege({ k: 'in' }), false, 'not before a relay that fights battles welcomed the socket');
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', world: null, now: AT, v: 'world149' });
  assert.equal(o.siegeOk, true);
  assert.equal(o.sendSiege({ k: 'in' }), true);
  assert.deepEqual(ws.sent.at(-1), { t: 'siege', k: 'in' });
  assert.equal(o.sendSiege({ k: 'blow', to: 'x' }), false, 'a malformed word never leaves');
  ws.receive({ t: 'siege', k: 'f', b: [[2, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: 1, e: 2, n: [0, 0, 0] });
  ws.receive({ t: 'siege', k: 'f', b: 'junk' });
  assert.deepEqual(heard, [['f', room]], 'projected - junk dropped');
  // back to the town: its hello carries no pass, though one was minted for the battle
  o.join('cell:100:201', pose(0, 0));
  const cell = sockets.at(-1);
  cell.open(); await settle();
  assert.equal(cell.sent[0].t, 'hello');
  assert.equal(cell.sent[0].sp, undefined, 'a pass rides a siege\'s hello alone');
  // a reconnect mints again
  ws.onclose?.({ code: 1006, reason: '' });
  const old = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0002', secret: 'shh-shh-shh-0002', WebSocketImpl: FakeWS, now: () => AT });
  old.join(room, pose(0, 0));
  const w2 = sockets.at(-1); w2.open(); await settle();
  w2.receive({ t: 'welcome', id: 'mac-0002', peers: [], host: 'mac-0002', world: null, now: AT, v: 'world146' });
  assert.equal(old.sendSiege({ k: 'in' }), false, 'an older relay closes on the frame: never sent');
});

test('SEAT2a part four THE SESSION: no field, not in the town; an old relay said; an unsettled field asked again after its wait; a pass joins the battle\'s room and mints for every hello; `in` said once an open socket, again after a reconnect; a pull-back and my own rise at the camp move me; the end\'s receipt carried; the HUD drawn; foes are the other side\'s standing fighters - a blow and a harmful cast for them alone, a heal for a side-mate; the window\'s close leaves (mutants: each)', async () => {
  let now = AT;
  const said = [], moved = [], sent = [], kept = [];
  const online = { id: 'me-00001', room: null, status: 'connecting', mintSiegePass: null, sendSiege: (f) => { sent.push(f); return true; } };
  const answers = [{ ok: false, error: 'field-unsettled', text: 'wait' }, { ok: true, pass: 'v1.p.q', side: 'attack', week: 20, window: Math.floor((AT + 7_200_000) / 1000) }];
  const asked = [];
  const pass = async (seat, field) => { asked.push(field); return answers.length > 1 ? answers.shift() : answers[0]; };
  const hudCalls = [];
  const hud = { update: (m) => hudCalls.push(m), hide: () => hudCalls.push('hidden') };
  const claims = { keep: (r) => kept.push(r), offer: () => kept.push('offered') };
  const seat = { key: 3021, name: 'Anticlere' };
  const fight = { kind: 'siege', tier: 'palace', attackerGuild: EO, defenderGuild: SH };
  let relay = false;
  const ses = createSiegeSession({ online, pass, claims, hud, nowMs: () => now, movePlayer: (p) => moved.push(p), say: (t) => said.push(t), relayOk: () => relay });
  assert.equal(ses.enter(seat, fight, [[1, 2]]), false);
  assert.deepEqual(said, [SIEGE_SESSION_TEXT.old]);
  relay = true;
  assert.equal(ses.enter(seat, fight, null), false);
  assert.equal(said.at(-1), SIEGE_SESSION_TEXT.notHere('Anticlere'));
  const sf = [[1, 2], [3, 4]];
  assert.equal(ses.enter(seat, fight, sf), true);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(said.at(-1), 'wait');
  assert.equal(ses.room(), null, 'not joined while the field settles');
  now += SIEGE_PASS_RETRY_MS - 1; ses.tick(); await Promise.resolve();
  assert.equal(asked.length, 1, 'not before its wait');
  now += 1; ses.tick(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(asked, [sf, sf]);
  assert.equal(ses.room(), siegeRoomKey(3021, 20));
  assert.equal(said.at(-1), SIEGE_SESSION_TEXT.entered('attack'));
  assert.equal(await online.mintSiegePass(), 'v1.p.q', 'a fresh pass for every hello');
  // the socket
  ses.tick();
  assert.deepEqual(sent, [], 'not before the room is open');
  online.room = ses.room(); online.status = 'open';
  ses.tick(); ses.tick();
  assert.deepEqual(sent, [{ k: 'in' }], 'once');
  online.status = 'connecting'; ses.tick(); online.status = 'open'; ses.tick();
  assert.deepEqual(sent, [{ k: 'in' }, { k: 'in' }], 'again after a reconnect');
  assert.ok(hudCalls.length >= 1 && hudCalls.at(-1).bar);
  // the words
  const room = ses.room();
  ses.onSiege({ k: 'st', f: [['me-00001', 320, 320, 0, 1], ['mate-001', 320, 320, 0, 1], ['foe-0001', 400, 400, 0, 2], ['foe-0002', 302, 302, 1, 2]] }, room);
  ses.onSiege({ k: 'st', f: [] }, 'cell:1:2');
  assert.deepEqual(ses.foes(), ['foe-0001'], 'the other side\'s, standing - another room\'s word changed nothing');
  assert.equal(ses.isFoe('mate-001'), false);
  assert.equal(ses.blow('foe-0001', { w: 123, m: 9, d: 30, r: 0 }), true);
  assert.equal(ses.blow('mate-001', { w: 123, m: 9, d: 30, r: 0 }), false);
  assert.equal(ses.cast('foe-0001', 20), true);
  assert.equal(ses.cast('mate-001', 20), false);
  assert.equal(ses.cast('mate-001', 20, true), true);
  assert.equal(ses.cast('foe-0001', 20, true), false);
  assert.deepEqual(sent.slice(2), [{ k: 'blow', to: 'foe-0001', w: 123, m: 9, d: 30, r: 0 }, { k: 'cast', to: 'foe-0001', d: 20, h: 0 }, { k: 'cast', to: 'mate-001', d: 20, h: 1 }]);
  ses.onSiege({ k: 'back', p: pose(7, 8) }, room);
  ses.onSiege({ k: 'up', id: 'mate-001', p: pose(1, 1) }, room);
  ses.onSiege({ k: 'up', id: 'me-00001', p: pose(9, 9) }, room);
  assert.deepEqual(moved.map((p) => [p.x, p.z]), [[7, 8], [9, 9]], 'a pull-back and my own rise move me; another\'s rise does not');
  ses.onSiege({ k: 'fell', id: 'me-00001', by: 'foe-0001' }, room);
  assert.equal(ses.down(), true);
  ses.onSiege({ k: 'no', m: 'the field is full' }, room);
  assert.equal(said.at(-1), 'the field is full');
  const rc = await mintSiegeReceipt({ s: 'acct-me01', sk: 3021, sw: 20, sd: 'attack', r: 'attack', a: 1, h: 1 }, null, { subtle, nowS: Math.floor(AT / 1000) });
  ses.onSiege({ k: 'end', r: 'attack', a: 1, rc }, room);
  assert.deepEqual(kept, [rc, 'offered'], 'the receipt kept and carried at once');
  ses.claimed({ ok: true, honours: { marks: 50, xp: 2000 } });
  ses.tick();
  assert.match(hudCalls.at(-1).card.honour, /50 silver/);   // PIN MOVED: GUILD3a (bible/11-Multiplayer/Guilds-Made-Plain.md) - silver, as every sentence says it
  // the window's close
  now = AT + 7_200_000;
  ses.tick();
  assert.equal(ses.room(), null);
  assert.equal(online.mintSiegePass, null);
  assert.deepEqual([hudCalls.at(-1), said.at(-1)], ['hidden', SIEGE_SESSION_TEXT.left]);
  // a refusal leaves at once
  const r2 = createSiegeSession({ online, pass: async () => ({ ok: false, error: 'pass-late', text: 'closed' }), nowMs: () => now, say: (t) => said.push(t), relayOk: () => true });
  r2.enter(seat, fight, sf); await Promise.resolve(); await Promise.resolve();
  assert.equal(r2.active(), false);
  assert.equal(said.at(-1), SIEGE_SESSION_TEXT.refused('closed'));
  // the book passes a refusal's rung to the carrier
  const { createTownSeatBook } = await import('../../../src/net/townSeatBook.js');
  const book = createTownSeatBook({ door: { claimSiege: async () => ({ ok: false, error: 'receipt', why: 'signature' }) }, character: () => 'c1', storage: null });
  assert.equal((await book.claimSiege('s1.a.b')).why, 'signature', 'the rung the carrier reads');
  // a spectator strikes nobody
  const w = createSiegeSession({ online, pass: async () => ({ ok: true, pass: 'v1.a.b', side: 'watch', week: 20, window: 9e9 }), nowMs: () => now, relayOk: () => true });
  w.enter(seat, fight, sf); await Promise.resolve(); await Promise.resolve();
  w.onSiege({ k: 'st', f: [['foe-0001', 400, 400, 0, 2]] }, w.room());
  assert.deepEqual([w.foes(), w.isFoe('foe-0001'), w.cast('foe-0001', 5)], [[], false, false]);
});
