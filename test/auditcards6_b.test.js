// AUDIT CARDS-6 (2026-10-09, bible/01-Overview/Audit-Cards-6.md) lane B: ILIAC HAND OFFLINE AGAINST THE REGULARS, driven.
// The stake held from the deal, so a pack emptied mid-game still pays a lost game for keeps and the table never says a
// take that did not happen (B1); the regular blind to the other side's face-down cards on the last turn too (B2); the
// cloth's columns clear of the next holding at every pair of the prop's six chairs, and read from the viewer's own (B3);
// a round of damage over time - a poison's minute, through the real ticker - standing nobody up (B4); the forfeits' book
// on the day the card is paid (B5) and the tavern just booked kept by a full book (B6); the regular not drawn inside a
// peer sat in his chair (B7); the corrected claims of a town regular's upgrades (B8) and of one temper at both games
// (B9); the panel played by the keyboard (B10); a trial cap that binds (B11); and a closed game staking nothing (B13).
// The host's card block is RUN, sliced from worldModes.js (`let cardSeat = null;` to the hurt listener) the way
// test/auditcards2_host.test.js runs it, over the real session, book, panel and hurt registry on a fake page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDoc, text } from './decorFakes.mjs';
import * as court from '../src/systems/court.js';
import * as sess from '../src/systems/cardTableSession.js';
import * as hudm from '../src/ui/cardTableHud.js';
import { holdCursor } from '../src/player/pointerLock.js';
import { nearestFreeSeat, takenSeats, cardTableSeats, tableFrame } from '../src/world/cardTables.js';
import { regularsToStand, regularBark, BARK_MS } from '../src/world/cardRegulars.js';
import { RemoteCardTable } from '../src/systems/cardRemoteTable.js';
import { cardPackPrice, buyCardPack } from '../src/systems/cardSources.js';
import { skillValue, SKILLS } from '../src/systems/skills.js';
import { liveStat } from '../src/systems/statMods.js';
import { tickInFlight, setWorldMinutes, worldMinutes, CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { registerPlayerHurtListener, hurtPlayer } from '../src/characters/playerEntity.js';
import { createPlayerTicker } from '../src/scenes/shared.js';
import { startPoison, POISONS } from '../src/systems/poisons.js';
import { openIliacTableGame, iliacTemperOf } from '../src/scenes/iliacTableGame.js';
import { iliacGrade, patronDeck, patronPlays, seededUnit, ILIAC_TEMPER_NAMES, TEMPER_UPGRADES, ILIAC_THINK_TRIALS } from '../src/systems/iliacPatrons.js';
import { IliacTableSession, forfeitsAfter, forfeitsFor, FORFEITS_BOOK_MAX } from '../src/systems/iliacTableSession.js';
import { giveBinderAtChargen, collectionOf, isIliacCard, mintIliacCard } from '../src/systems/iliacItems.js';
import { STARTER_DECK, ILIAC_CARDS, ILIAC_LOCATIONS, cardById } from '../src/net/iliacCards.js';
import { newGame, commit, reveal, iliacView, legalPlays, playsRefusal, ILIAC_TURNS, ILIAC_HAND_MAX, ILIAC_HOLDINGS } from '../src/net/iliacHand.js';
import { iliacPlaces } from '../src/world/iliacCloth.js';
import { CARD_W, CARD_L } from '../src/world/cardMotion.js';
import { CARD_TABLE_BOX } from '../src/world/cardTableProp.js';
import { createIliacTableHud, iliacHudModel } from '../src/ui/iliacTableHud.js';
import { seatPatrons } from '../src/systems/cardTableSession.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const src32 = (seed) => { const u = seededUnit(seed); return () => Math.floor(u() * 4294967296); };
const held = (items) => [...collectionOf(items).values()].reduce((a, b) => a + b, 0);
const every = (n, out = []) => { out.push(n); for (const c of n.children ?? []) every(c, out); return out; };
const WM = read('src/scenes/worldModes.js');
const BLOCK = WM.slice(WM.indexOf('  let cardSeat = null;'), WM.indexOf('\n', WM.indexOf("registerPlayerHurtListener('cards-seat'")));

/** The interior host's card block over fakes of the room and the page, the real everything else - its hurt listener
 *  captured (`hurt`), the seated peers' feet and the clock the test's to move. */
function host({ entity = null, building = { buildingKey: 7, quality: 10, regionIndex: 17, townMapId: 1111 }, minutes = 0 } = {}) {
  const doc = fakeDoc();
  const playerEntity = entity ?? { name: 'Mac', goldPieces: 500, items: [], health: 50 };
  const said = [], hurt = [];
  const seatList = Array.from({ length: 4 }, (_, k) => ({ x: k * 2, z: 0, eye: [k * 2, 1, 0], feet: [k * 2, 0, 0], yaw: 0, pitch: 0, top: 0.8 }));
  const clock = { minutes };
  const peers = { feet: [] };
  const scope = {
    isTavern: () => true, BUILDING_TYPES: { None: 0 },
    cardTableSeats: () => seatList, seatFloorOk: () => true, SEAT_FLOOR_PROBE: 1,
    nearestFreeSeat, takenSeats,
    player: { pos: [0, 0, 0], eyeAt: () => [0, 1.6, 0] },
    host: { realmAct: null, relock: () => said.push('<relock>'), seatedPeers: () => peers.feet },
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
    registerPlayerHurtListener: (name, fn) => hurt.push(fn),
    isOnlinePage: () => false,
    mwViewFirstPerson: () => {}, homeTownOf: (b) => b?.townMapId || 0,
    worldMinutes: () => clock.minutes, MINUTES_PER_DAY: 1440,
    RemoteCardTable, mode: 'interior', regularsToStand, regularBark, BARK_MS, showdownWinners: hudm.showdownWinners, HOLDEM_REFUSALS: hudm.HOLDEM_REFUSALS,
    cardPackPrice, buyCardPack, openIliacTableGame: (o) => openIliacTableGame({ ...o, doc }), iliacGrade, skillValue, SKILLS, liveStat,
    tickInFlight,   // AUDIT CARDS-6 B4: the hurt listener's own question
  };
  const state = { interiorCtx: { tables: [{ aabb: {} }], collider: null }, interiorBuilding: building };
  const api = new Function('S', ...Object.keys(scope), `let interiorCtx = S.interiorCtx, interiorBuilding = S.interiorBuilding;\n${BLOCK}\n
    return { sitAtCardTable, standFromCardTable, cardRegularsNow, get cardSeat() { return cardSeat; }, get iliacGame() { return iliacGame; } };`)(state, ...Object.values(scope));
  const walk = (n, f, out = []) => { if (!n) return out; if (f(n)) out.push(n); for (const c of n.children ?? []) walk(c, f, out); return out; };
  const panel = (cls) => doc.body.children.filter((n) => n.className === cls && !n.removed).at(-1);
  const press = (label, cls = 'dfcards') => { const b = walk(panel(cls), (n) => n.tag === 'button' && n.textContent.startsWith(label))[0]; assert.ok(b, `a "${label}" button`); b.fire('click'); };
  return { api, doc, playerEntity, said, hurt, clock, peers, press, panel, seatList };
}

/** The game on its own, the host's half (b07's: the starter deck against a city's regular, for keeps). */
function game(entity, over = {}) {
  let now = 0;
  const said = [];
  const g = openIliacTableGame({
    doc: fakeDoc(), renderer: null, entity, say: (t) => said.push(t), holdCursor: () => () => false, rand32: src32(77), now: () => now,
    day: 9, key: 'tav', grade: 2, friendly: false, regulars: [{ name: 'Ana', seed: 5, chair: 2 }],
    frame: { centre: [0, 0.8, 0], halfShort: 0.45 }, mySeatFeet: [0, 0, -1], chairFeet: () => [0, 0, 1], onHoldem: () => {}, onStand: () => {}, ...over,
  });
  return { g, said, tick: (ms) => { now += ms; g.frame(now); }, now: () => now };
}

test('AUDIT CARDS-6 B1: the stake held from the deal - a pack emptied mid-game still pays the lost game, and the take said is the card taken; a win and a draw bring it home', () => {
  const entity = { name: 'Ves', items: [], goldPieces: 500 };
  giveBinderAtChargen(entity);
  const before = held(entity.items);
  const t = game(entity);
  t.g.press('keeps'); t.g.press('deal');
  const s = t.g.g.session;
  assert.ok(s.forKeeps && t.g.staked());
  assert.ok(STARTER_DECK.includes(s.stake), 'the stake is a card of his deck, drawn at the deal');
  assert.equal(held(entity.items), before - 1, 'lifted out of the pack at the deal');
  assert.match(t.said.at(-1), new RegExp(`for a card - your ${cardById(s.stake).name} lies on the table\\.$`));
  // turn 2: every card dropped to the floor (the binder's Drop), then a pass every turn - he means to lose
  const pile = [];
  for (let i = 0; i < 400 && t.g.g.phase === 'playing'; i++) {
    t.tick(500);
    const v = s.view();
    if (!pile.length && v.turn === 2) for (const it of entity.items.filter(isIliacCard)) { entity.items.splice(entity.items.indexOf(it), 1); pile.push(it); }
    if (!v.players[0].committed && !v.over) t.g.press('commit');
  }
  assert.equal(s.over, 'lost');
  assert.deepEqual(s.prize, { from: 'player', card: s.stake }, 'the loss pays the stake');
  assert.equal(t.said.at(-1), `Ana takes a card from your deck: ${cardById(s.stake).name}.`);
  entity.items.push(...pile);   // he stands and picks the pile back up
  assert.equal(held(entity.items), before - 1, 'the game lost cost his card - an emptied pack is no free roll');
  t.g.close();
  entity.items.push(mintIliacCard(s.stake));   // his deck whole again, for the games below
  // a win: the regular's card paid, and the stake home
  const w = game(entity, { regulars: [{ name: 'Bors', seed: 6, chair: 3 }] });
  const atWin = held(entity.items);
  w.g.press('keeps'); w.g.press('deal');
  const stakeW = w.g.g.session.stake, hadW = collectionOf(entity.items).get(stakeW) ?? 0;
  w.g.g.session.over = 'won'; w.g.g.session.prize = { from: 'patron', card: 'lich' };
  w.tick(10);
  assert.equal(held(entity.items), atWin + 1, 'his card in, the stake home');
  assert.equal(collectionOf(entity.items).get(stakeW), hadW + 1, 'the stake back on its stack');
  w.g.close();
  // a draw: nobody pays, the stake home
  const dr = game(entity, { regulars: [{ name: 'Cal', seed: 8, chair: 3 }] });
  const atDraw = held(entity.items);
  dr.g.press('keeps'); dr.g.press('deal');
  assert.equal(held(entity.items), atDraw - 1);
  dr.g.g.session.over = 'draw';
  dr.tick(10);
  assert.equal(held(entity.items), atDraw, 'a draw pays nobody');
  dr.g.close();
  // standing up mid-game concedes the stake; a load's road (no concession) gives nothing back - the save holds it
  const up = game(entity, { regulars: [{ name: 'Dov', seed: 9, chair: 3 }] });
  const atUp = held(entity.items);
  up.g.press('keeps'); up.g.press('deal');
  up.g.close();
  assert.equal(held(entity.items), atUp - 1, 'conceded: the stake is his');
  entity.items.push(mintIliacCard(up.g.g.session.stake));
  const ld = game(entity, { regulars: [{ name: 'Eda', seed: 10, chair: 3 }] });
  const atLd = held(entity.items);
  ld.g.press('keeps'); ld.g.press('deal');
  ld.g.close({ concede: false });
  assert.equal(held(entity.items), atLd - 1, 'nothing put back over the loaded pack');
});

test('AUDIT CARDS-6 B2: the regular\'s last-turn trial never sees the other side\'s face-down cards - their identities varied, the same plays', () => {
  const locs = ILIAC_LOCATIONS.map((c) => c.id).filter((x) => x !== 'privateers-hold');
  let checked = 0;
  for (let gi = 0; gi < 90; gi++) {
    const temper = ILIAC_TEMPER_NAMES[gi % 3];
    const st = newGame({ decks: [STARTER_DECK.slice(), patronDeck(gi, temper, 2)], rand32: src32(gi + 5), locations: ['privateers-hold', locs[gi % locs.length], locs[(gi + 4) % locs.length]] });
    while (!st.over) {
      const mine = patronPlays(st, 0, 'tight', 2, seededUnit(gi + st.turn));
      if (st.turn === ILIAC_TURNS && st.holdings.some((hd) => hd.sides[0].some((x) => x.down))) {
        const as = (id) => { const c = structuredClone(st); for (const hd of c.holdings) for (const x of hd.sides[0]) if (x.down) x.id = id; return c; };
        const a = as('giant'), b = as('rat');
        assert.equal(JSON.stringify(iliacView(a, 1)), JSON.stringify(iliacView(b, 1)), 'the variation is hidden from his seat');
        assert.deepEqual(patronPlays(a, 1, temper, 2, seededUnit(1)), patronPlays(b, 1, temper, 2, seededUnit(1)), `game ${gi}: what lies face down changes nothing`);
        checked++;
      }
      const veiled = mine.map((x) => ({ ...x, holding: 0 }));   // the player lays at the veiled holding when the rules take it
      commit(st, 0, playsRefusal(st, 0, veiled) === null ? veiled : mine);
      commit(st, 1, patronPlays(st, 1, temper, 2, seededUnit(gi * 3 + st.turn)));
      reveal(st);
    }
  }
  assert.ok(checked >= 40, `${checked} last turns with face-down cards`);
});

test('AUDIT CARDS-6 B3: at every pair of the prop\'s six chairs, for either viewer, no card lies over another holding\'s card, every card on the felt, read from the viewer\'s own chair and thrown from its owner\'s own edge (the gold table is the same prop)', () => {
  const t = { aabb: { min: [-0.75, 0, -0.5], max: [0.75, CARD_TABLE_BOX.max[1], 0.5] }, box: CARD_TABLE_BOX };
  const seats = cardTableSeats(t, () => true), frame = tableFrame(t);
  assert.equal(seats.length, 6);
  const fw = CARD_TABLE_BOX.max[0] - 0.04, fd = CARD_TABLE_BOX.max[2] - 0.04;   // the felt, inside the rail (cardTableProp.js CARD_TABLE_RAIL)
  const dir = (s) => { const dx = s.x - frame.centre[0], dz = s.z - frame.centre[2], n = Math.hypot(dx, dz); return [dx / n, dz / n]; };
  let pairs = 0;
  for (let a = 0; a < seats.length; a++) for (let b = 0; b < seats.length; b++) {
    if (a === b) continue;
    for (const viewer of [0, 1]) {
      const pl = iliacPlaces(frame, seats[a].feet, seats[b].feet, viewer);
      const ux = [Math.cos(pl.yaw), -Math.sin(pl.yaw)], uz = [Math.sin(pl.yaw), Math.cos(pl.yaw)];
      const slots = [];
      for (let h = 0; h < 3; h++) { slots.push({ h, pos: pl.holding(h) }); for (let p = 0; p < 2; p++) for (let i = 0; i < 4; i++) slots.push({ h, pos: pl.side(h, p, i) }); }
      const f = (s) => [s.pos[0] * ux[0] + s.pos[2] * ux[1], s.pos[0] * uz[0] + s.pos[2] * uz[1]];   // every card shares the yaw: its own frame
      for (const s of slots) for (const q of slots) {
        if (s.h >= q.h) continue;
        const [sx, sz] = f(s), [qx, qz] = f(q);
        assert.ok(!(Math.abs(sx - qx) < CARD_W && Math.abs(sz - qz) < CARD_L), `chairs ${a} and ${b}, viewer ${viewer}: a card at holding ${s.h} over one at ${q.h}`);
      }
      for (const s of slots) for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = s.pos[0] + (ux[0] * cx * CARD_W + uz[0] * cz * CARD_L) / 2, z = s.pos[2] + (ux[1] * cx * CARD_W + uz[1] * cz * CARD_L) / 2;
        assert.ok(Math.abs(x) <= fw && Math.abs(z) <= fd, `chairs ${a} and ${b}: on the felt`);
      }
      const d = dir(viewer ? seats[b] : seats[a]);
      assert.ok(Math.abs(Math.sin(pl.yaw) + d[0]) < 1e-9 && Math.abs(Math.cos(pl.yaw) + d[1]) < 1e-9, `chairs ${a} and ${b}: read from viewer ${viewer}'s own chair`);
      for (const [p, chair] of [[0, seats[a]], [1, seats[b]]]) {
        const e = pl.edge(p), o = dir(chair), n = Math.hypot(e[0] - frame.centre[0], e[2] - frame.centre[2]);
        assert.ok(Math.abs((e[0] - frame.centre[0]) / n - o[0]) < 1e-9 && Math.abs((e[2] - frame.centre[2]) / n - o[1]) < 1e-9 && Math.abs(e[0]) <= fw && Math.abs(e[2]) <= fd, `chairs ${a} and ${b}: seat ${p}'s card thrown from his own edge`);
      }
      pairs++;
    }
  }
  assert.equal(pairs, 60);
});

test('AUDIT CARDS-6 B4: a poison\'s minute through the real ticker leaves the player seated and the game for keeps playing; a blow still stands him up and concedes', () => {
  const entity = { name: 'Mac', goldPieces: 500, items: [], health: 50, maxHealth: 50, skills: [], stats: {}, level: 1, activeEffects: [] };
  giveBinderAtChargen(entity);
  const h = host({ entity });
  registerPlayerHurtListener('cards-seat', h.hurt[0]);   // the slice's listener in the real registry, under the host's own name
  try {
    h.api.sitAtCardTable(0);
    h.press('Play Iliac Hand');
    const ig = h.api.iliacGame;
    ig.press('keeps'); ig.press('deal');
    assert.ok(ig.staked());
    const cards = held(entity.items);
    setWorldMinutes(1000);
    const ticker = createPlayerTicker(entity, {});
    assert.ok(startPoison(entity, POISONS.Nux_Vomica, Math.floor(worldMinutes()), () => 0), 'poisoned');
    const seen = [];
    registerPlayerHurtListener('auditcards6-b4', (_e, hu) => seen.push(tickInFlight() ? 'tick' : 'blow'));
    for (let i = 0; i < 12; i++) ticker.tick(1 / CLASSIC_MINUTES_PER_SECOND);
    assert.ok(seen.length >= 1 && seen.every((x) => x === 'tick'), `the poison's rounds hurt from inside the minute pass (${seen})`);
    assert.ok(entity.health < 50, 'and cost health');
    assert.ok(h.api.cardSeat, 'still seated');
    assert.equal(ig.g.session.over, null, 'the game plays on');
    assert.equal(held(entity.items), cards, 'no card conceded');
    hurtPlayer(entity, 1);   // a blow
    assert.equal(h.api.cardSeat, null, 'a blow stands him up');
    assert.equal(ig.g.session.over, 'left', 'and concedes');
  } finally {
    registerPlayerHurtListener('cards-seat', null);
    registerPlayerHurtListener('auditcards6-b4', null);
  }
});

test('AUDIT CARDS-6 B5: the forfeits\' book is written on the game day the card is paid - a game won past midnight books the new day, and he has paid on it', () => {
  const entity = { name: 'Mac', goldPieces: 500, items: [], health: 50 };
  giveBinderAtChargen(entity);
  const h = host({ entity, minutes: 5 * 1440 + 1430 });   // day 5, ten to midnight
  h.api.sitAtCardTable(0);
  h.press('Play Iliac Hand');
  const ig = h.api.iliacGame;
  ig.press('keeps'); ig.press('deal');
  h.clock.minutes = 6 * 1440 + 20;   // twenty past midnight: day 6
  const s = ig.g.session;
  s.over = 'won'; s.prize = { from: 'patron', card: 'lich' };
  ig.frame(1);
  const name = s.seats[1].name;
  assert.deepEqual(Object.values(entity.iliacForfeits).map((e) => e.day), [6], 'booked on day 6');
  assert.deepEqual(forfeitsFor(entity.iliacForfeits, Object.keys(entity.iliacForfeits)[0], 6), [name]);
  ig.press('again');
  assert.match(text(ig.g.hud.root), new RegExp(`${name} \\(\\w+\\) - has paid a card tonight`), 'the panel open since day 5 knows he paid on day 6');
  h.api.standFromCardTable();
});

test('AUDIT CARDS-6 B6: a full book of one day keeps the tavern just booked', () => {
  let b = {};
  for (let i = 0; i < FORFEITS_BOOK_MAX; i++) b = forfeitsAfter(b, `t${i}`, 7, 'Ana');
  b = forfeitsAfter(b, 'new', 7, 'Bors');
  assert.equal(Object.keys(b).length, FORFEITS_BOOK_MAX);
  assert.deepEqual(forfeitsFor(b, 'new', 7), ['Bors'], 'the tavern just booked is kept');
  b = forfeitsAfter(b, 't0', 8, 'Ana');
  assert.deepEqual(forfeitsFor(b, 't0', 8), ['Ana'], 'a newer day still first');
});

test('AUDIT CARDS-6 B7: a peer sat down in the Iliac regular\'s chair - the chair is his, the regular no longer drawn in it', () => {
  const entity = { name: 'Mac', goldPieces: 500, items: [], health: 50 };
  giveBinderAtChargen(entity);
  const h = host({ entity });
  h.api.sitAtCardTable(0);
  h.press('Play Iliac Hand');
  const ig = h.api.iliacGame;
  ig.press('deal');
  const chair = Number(ig.g.session.seats[1].id.split(':')[1]);
  assert.equal(h.api.cardRegularsNow(0).length, 1, 'the regular in his chair');
  h.peers.feet = [h.seatList[chair].feet.slice()];
  assert.deepEqual(h.api.cardRegularsNow(0), [], 'a peer in it: nobody drawn inside him');
  h.api.standFromCardTable();
});

test('AUDIT CARDS-6 B8, B9 (records corrected): a careful town regular carries one upgrade - his second is a legendary past a town\'s tiers - a reckless or a sly one two; his Iliac temper is his seed\'s, his Hold\'em temper the evening\'s draw', () => {
  const ups = (t) => TEMPER_UPGRADES[t].filter((id) => cardById(id).kind !== 'prince').slice(0, 2);
  for (const t of ILIAC_TEMPER_NAMES) for (let seed = 1; seed <= 40; seed++) {
    const d = patronDeck(seed, t, 1);
    const n = ups(t).filter((id) => d.includes(id)).length;
    assert.equal(n, t === 'tight' ? 1 : 2, `${t}, seed ${seed}`);
  }
  assert.equal(cardById('king-gothryd').tier, 'legendary');
  const P = read('src/systems/iliacPatrons.js');
  assert.ok(!P.includes('carries the first two that are not Princes; a'), 'the claim a careful town regular disproved is gone');
  assert.ok(P.includes('so a careful town regular\n *  carries the Knight of the Flame alone'));
  // B9: one regular, two tempers - Hold'em's is the table's draw, Iliac Hand's the seed's
  const tempers = new Set(Array.from({ length: 24 }, (_, i) => seatPatrons(['Ana'], { bb: 10 }, src32(i + 1))[0].temper));
  assert.ok(tempers.size > 1, 'Hold\'em draws Ana\'s temper off the table\'s source');
  assert.equal(iliacTemperOf(12345), iliacTemperOf(12345));
  for (const f of ['src/systems/iliacPatrons.js', 'src/scenes/iliacTableGame.js']) assert.ok(!read(f).includes('one temper at both games') && !read(f).includes('one regular, one temper'), `${f}: the false claim gone`);
});

test('AUDIT CARDS-6 B10: the panel by the keyboard - every row the mouse presses is in the Tab order and takes Enter or Space, a button\'s keys and Tab are the panel\'s, the keyboard kept across a repaint', () => {
  const doc = fakeDoc();
  const made = doc.createElement;
  let focused = null;
  doc.createElement = (t) => { const n = made(t); n.focus = () => { focused = n; doc.activeElement = n; }; return n; };
  const pressed = [];
  const hud = createIliacTableHud({ onPress: (id, v) => pressed.push(v === undefined ? [id] : [id, v]), doc });
  assert.equal(focused, hud.root, 'the keyboard starts in the panel');
  hud.root.contains = () => true;
  const key = (n, k) => { let stopped = false, prevented = false; n.fire('keydown', { key: k, stopPropagation() { stopped = true; }, preventDefault() { prevented = true; } }); return { stopped, prevented }; };
  const byKey = (k) => every(hud.root).find((n) => n.getAttribute?.('data-focus') === k);
  const setup = (deck) => iliacHudModel({ phase: 'setup', setup: { decks: [{ name: 'Starter Deck' }, { name: 'Mine' }], foes: [{ name: 'Ana', temper: 'tight' }, { name: 'Bors', temper: 'loose' }], deck, foe: 0, forKeeps: false, keepsOk: true } });
  hud.render(setup(0));
  for (const k of ['deck-0', 'deck-1', 'foe-0', 'foe-1', 'keeps']) {
    const n = byKey(k);
    assert.ok(n, k);
    assert.deepEqual([n.getAttribute('tabindex'), n.getAttribute('role')], ['0', 'button'], `${k} in the Tab order`);
  }
  assert.deepEqual(key(byKey('deck-1'), 'Enter'), { stopped: true, prevented: true }, 'Enter is the row\'s, never the game\'s');
  key(byKey('foe-1'), ' ');
  key(byKey('keeps'), 'Enter');
  key(byKey('deck-0'), 'a');
  assert.deepEqual(pressed, [['deck', 1], ['foe', 1], ['keeps']]);
  const deal = byKey('act-deal');
  assert.equal(deal.tag, 'button');
  assert.equal(key(deal, ' ').stopped, true, 'a button\'s Space is its own press, never a jump that stands him up');
  assert.equal(key(hud.root, 'Tab').stopped, true, 'Tab walks the panel, never the dial');
  assert.equal(key(hud.root, 'KeyW').stopped, false, 'every other key the game\'s');
  doc.activeElement = byKey('deck-1');
  hud.render(setup(1));
  assert.equal(focused, byKey('deck-1'), 'the repaint gives the keyboard back to its row');
  // the turn: the hand's cards, a holding a picked card can go to, a staged card
  const s = new IliacTableSession({ player: { id: 'you', name: 'Ves', deck: STARTER_DECK.slice() }, patron: { id: 'regular:2', name: 'Ana', temper: 'tight', grade: 1, deck: patronDeck(3, 'tight', 1) }, rand32: src32(31), now: 0 });
  s.state.players[0].magicka = 10;   // magicka to spare: a staged card leaves the rest of the hand playable
  const one = legalPlays(s.state, 0)[0];
  hud.render(iliacHudModel({ phase: 'playing', view: s.view(), staged: [], pick: one.card }));
  pressed.length = 0;
  key(byKey(`pick-${one.card}`), 'Enter');
  key(byKey(`hold-${one.holding}`), 'Enter');
  assert.deepEqual(pressed, [['pick', one.card], ['hold', one.holding]]);
  doc.activeElement = byKey(`hold-${one.holding}`);
  const m = iliacHudModel({ phase: 'playing', view: s.view(), staged: [one], pick: null });
  hud.render(m);
  assert.ok(!byKey(`hold-${one.holding}`), 'no card picked, no holding to press');
  const first = m.hand.find((c) => c.playable);
  assert.ok(first);
  assert.equal(focused, byKey(`pick-${first.i}`), 'its row gone, the keyboard on the hand\'s first card');
  key(byKey('unstage-0'), ' ');
  assert.deepEqual(pressed.at(-1), ['unstage', 0]);
  doc.activeElement = byKey(`pick-${first.i}`);
  hud.render(setup(0));
  assert.equal(focused, hud.root, 'nothing of it left: the panel itself, never a button a stray Enter would press');
  hud.destroy();
});

test('AUDIT CARDS-6 B11: the trial cap binds - a hand of seven cheap cards with magicka to spare is cut at it, never past it, and it lies under the hand\'s own bound', () => {
  assert.ok(ILIAC_THINK_TRIALS < 1 + ILIAC_HOLDINGS * (ILIAC_HAND_MAX * (ILIAC_HAND_MAX + 1)) / 2, 'short of the 85 greedy play can try');
  const cheap = ILIAC_CARDS.filter((c) => c.kind === 'unit' && c.cost <= 1 && c.tier === 'common').map((c) => c.id);
  const real = globalThis.structuredClone;
  let trials = 0, most = 0;
  globalThis.structuredClone = (x) => { trials++; return real(x); };   // a trial is one copy of the game
  try {
    for (let k = 0; k < 12; k++) {
      const st = newGame({ decks: [STARTER_DECK.slice(), STARTER_DECK.slice()], rand32: src32(k + 1), locations: ['sentinel', 'wayrest', 'daggerfall'] });
      st.turn = 2;
      st.players[1].magicka = 10;
      st.players[1].hand = Array.from({ length: ILIAC_HAND_MAX }, (_, i) => ({ uid: 900 + i, id: cheap[(k * 3 + i) % cheap.length] }));
      trials = 0;
      patronPlays(st, 1, 'loose', 2, seededUnit(3));
      most = Math.max(most, trials);
    }
  } finally { globalThis.structuredClone = real; }
  assert.equal(most, ILIAC_THINK_TRIALS, 'cut at the cap, never past it');
});

test('AUDIT CARDS-6 B13: a game closed mid-game stakes nothing', () => {
  const entity = { name: 'Ves', items: [], goldPieces: 500 };
  giveBinderAtChargen(entity);
  const t = game(entity);
  t.g.press('keeps'); t.g.press('deal');
  assert.ok(t.g.staked());
  t.g.close({ concede: false });
  assert.equal(t.g.staked(), false, 'the save waits on nothing');
});
