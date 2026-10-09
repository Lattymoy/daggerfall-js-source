// CARDS-SAID (2026-10-09, bible/11-Multiplayer/Tavern-Cards.md section 31; a live report: "Shes clicking deal me in but
// nothing happens"): A STAKE THE REALM REFUSED IS SAID ON THE PANEL. The gold table's buy-in asks the realm service for
// the stake (scenes/worldModes.js cardGoldSit); a refusal was said ALONE - a line under the panel (a phone's panel covers
// the screen's middle) - and the panel came back exactly as it was, "Deal me in" lit again: pressed, and nothing
// happened. Driven: the host's card block run (test/taverntables.test.js's way) over the real panel - the refusal on the
// panel beside the buy-in, gone at the next press; a stake the service holds sits as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nearestFreeSeat, takenSeats } from '../src/world/cardTables.js';
import { HOLDEM_GOLD_TABLE } from '../src/net/holdemTable.js';
import { RemoteCardTable } from '../src/systems/cardRemoteTable.js';
import * as court from '../src/systems/court.js';
import * as sess from '../src/systems/cardTableSession.js';
import * as hudm from '../src/ui/cardTableHud.js';
import { holdCursor } from '../src/player/pointerLock.js';
import { regularsToStand, regularBark, BARK_MS } from '../src/world/cardRegulars.js';
import { fakeDoc } from './decorFakes.mjs';
import { cardPackPrice, buyCardPack } from '../src/systems/cardSources.js';   // CARDS9: the house's packs at the table
import { openIliacTableGame } from '../src/scenes/iliacTableGame.js';   // CARDS10: the other game at the table
import { iliacGrade } from '../src/systems/iliacPatrons.js';
import { skillValue, SKILLS } from '../src/systems/skills.js';
import { liveStat } from '../src/systems/statMods.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ROOM = 'interior:m100.200';

// THE HOST (scenes/worldModes.js's card block, sliced and run as test/auditcards2_host.test.js runs it)
const WM = read('src/scenes/worldModes.js');
const BLOCK = WM.slice(WM.indexOf('  let cardSeat = null;'), WM.indexOf('\n', WM.indexOf("registerPlayerHurtListener('cards-seat'")));
function host({ online = true, relay = true, realm = false, stake = null }) {
  const doc = fakeDoc();
  const playerEntity = { name: 'Mac', goldPieces: 5000, items: [], health: 50 };
  const said = [], sent = [], asked = [];
  const seatList = Array.from({ length: 6 }, (_, k) => ({ x: k * 2, z: 0, eye: [k * 2, 1, 0], feet: [k * 2, 0, 0], yaw: 0, pitch: 0, top: 0.8 }));
  const scope = {
    isTavern: () => true, BUILDING_TYPES: { None: 0 },
    cardTableSeats: () => seatList, seatFloorOk: () => true, SEAT_FLOOR_PROBE: 1, nearestFreeSeat, takenSeats,
    player: { pos: [0, 0, 0], eyeAt: () => [0, 1.6, 0] },
    host: {
      relock: () => {}, seatedPeers: () => [], realmAct: realm ? {} : null,
      cardOnline: { ok: () => relay, send: (w) => { sent.push(w); return true; }, id: () => 'peer-me', welcomes: () => 0, room: () => ROOM },
      cardStakes: realm ? { goldOk: () => true, purse: () => 1000, elsewhere: () => [], voidable: () => [], owed: () => [], seated: () => {}, recover: async () => {}, claim: async () => {}, stake: async (q) => { asked.push(q); return stake ? stake(q) : { ok: true, stake: 'ORDER', id: 'abcdef0123456789abcd' }; } } : null,
    },
    say: (s) => said.push(s), cam: { yaw: 0, pitch: 0, pos: null },
    getNameBankOfRegion: () => 0, residentName: (seed, bank, g) => `R${seed}:${g}`,
    stakesFor: sess.stakesFor, buyInRange: sess.buyInRange, goldAmount: court.goldAmount,
    holdCursor, renderer: {},
    createCardTableDraw: () => ({ draw() {}, destroy() {} }),
    createCardTableHud: (p) => hudm.createCardTableHud({ ...p, doc }), cardHudModel: hudm.cardHudModel, eventLine: hudm.eventLine,
    deductGold: court.deductGold, addGold: court.addGold, playerEntity,
    CardTableSession: sess.CardTableSession, seatPatrons: sess.seatPatrons, regularsFor: sess.regularsFor, regularsAfter: sess.regularsAfter,
    CardScene: class { constructor(o) { this.places = o.places; this.playerSeat = o.playerSeat; } onEvent() {} poses() { return { cards: [], chips: [] }; } settledAt() { return 0; } },
    tablePlaces: (frame, s, seatOf) => ({ seatOf, seats: seatOf.map(() => ({})) }), tableFrame: () => ({ centre: [0, 0.8, 0], axisYaw: 0, halfLong: 1, halfShort: 0.5 }), hashSeed: (...x) => x.join(':'),
    buildingDirectory: () => ({ locationName: 'Daggerfall' }), registerPlayerHurtListener: () => {},
    isOnlinePage: () => online,
    mwViewFirstPerson: () => {}, homeTownOf: (b) => b?.townMapId || 0,
    worldMinutes: () => 0, MINUTES_PER_DAY: 1440,
    RemoteCardTable, mode: 'interior', regularsToStand, regularBark, BARK_MS, showdownWinners: hudm.showdownWinners, HOLDEM_REFUSALS: hudm.HOLDEM_REFUSALS,
    // PIN MOVED (CARDS9/10, at the merge): the block prices a pack at the table and opens Iliac Hand on the seat - their names, real
    cardPackPrice, buyCardPack, openIliacTableGame: (o) => openIliacTableGame({ ...o, doc }), iliacGrade, skillValue, SKILLS, liveStat,
  };
  const state = { interiorCtx: { tables: [{ aabb: {} }, { aabb: {}, gold: true }], collider: null }, interiorBuilding: { buildingKey: 7, quality: 10, regionIndex: 17, townMapId: 1111 } };
  const api = new Function('S', ...Object.keys(scope), `let interiorCtx = S.interiorCtx, interiorBuilding = S.interiorBuilding;\n${BLOCK}\n
    return { sitAtCardTable, standFromCardTable, get cardGame() { return cardGame; }, get cardSeat() { return cardSeat; } };`)(state, ...Object.values(scope));
  const panel = () => doc.body.children.filter((n) => n.className === 'dfcards' && !n.removed).at(-1);
  const walk = (n, f, out = []) => { if (!n) return out; if (f(n)) out.push(n); for (const c of n.children ?? []) walk(c, f, out); return out; };
  const press = (label) => { const b = walk(panel(), (n) => n.tag === 'button' && n.textContent.startsWith(label))[0]; assert.ok(b, `a "${label}" button`); b.fire('click'); };
  const shown = () => walk(panel(), (n) => n.tag !== 'button' && typeof n.textContent === 'string' && n.textContent && !n.children?.length).map((n) => n.textContent).join(' | ');
  return { api, said, sent, asked, press, shown };
}


test('CARDS-SAID a stake the realm refused is said on the panel, beside the buy-in - not the panel as it was; the next press takes it away', async () => {
  let answer = { ok: false, error: 'busy' };
  const h = host({ realm: true, stake: async () => answer });
  h.api.sitAtCardTable(HOLDEM_GOLD_TABLE);
  assert.match(h.shown(), /Buy in for 200-1000 gold\./);
  h.press('Deal me in');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(h.asked.length, 1, 'the realm asked');
  assert.match(h.shown(), /The realm is settling something else - try again in a moment\. \(Buy in for 200-1000 gold\.\)/, 'the refusal on the panel');
  assert.deepEqual(h.sent.filter((w) => w.op === 'sit'), [], 'no sit');
  for (const [error, line] of [['realm-gold', 'Your purse cannot cover that stake.'], ['cards-closed', 'The realm is not holding stakes right now.'], ['whatever-else', 'The realm could not hold your stake - try again.']]) {
    answer = { ok: false, error };
    h.press('Deal me in');
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(h.shown().includes(line), `${error}: ${h.shown()}`);
  }
  answer = { ok: false, error: 'offline', unknown: true };
  h.press('Deal me in');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(h.shown().includes('The realm did not answer - your stake will be settled when it does.'), 'a lost answer said as one');
  // the next press: the refusal goes while the realm is asked, and a held stake sits
  let release;
  answer = new Promise((r) => { release = r; });
  h.press('Deal me in');
  assert.match(h.shown(), /The realm is holding your stake\.\.\./);
  assert.equal(/did not answer/.test(h.shown()), false, 'the old refusal gone');
  release({ ok: true, stake: 'ORDER', id: 'abcdef0123456789abcd' });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(h.sent.filter((w) => w.op === 'sit').map((w) => [w.table, w.stake]), [[HOLDEM_GOLD_TABLE, 'ORDER']], 'sat with the stake');
  h.api.standFromCardTable();
});
