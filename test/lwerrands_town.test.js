// LW-ERRANDS (2026-10-06, bible/06-Systems/Living-World.md "LW-ERRANDS"; Mac: "NPCs should also utilize going into
// guilds, shops, etc"): THE TOWN'S PEOPLE GO INTO ITS GUILD HALLS AND ITS SHOPS ON THEIR OWN BUSINESS. A guild hall saw
// its own two members and a sellsword's or an adventurer's hour - one of the two halls nearest their home, whatever its
// guild (a sorcerer at the Fighters Guild) - and nobody else: 10-12 a day in a city of three hundred. An errand went
// into one of the four shops nearest home or stood at a market, half and half, whatever the trade: a city's banks saw
// 1-6 a day, its library 0-4. Now a resident keeps a guild by their trade or their class (dayPlan.js guildHallOf) and
// its hall on their own two days of the week (guildDay); an errand goes into a shop ERRAND_SHOP_SHARE of the time, of a
// kind the trade has need of (ERRAND_NEEDS) ERRAND_NEED_SHARE of it (errandShop). The towns are the synthetic ones
// (test/lwTown.mjs), their guild halls given their guilds; the game's own where ARENA2_PATH names the data
// (test/lwRealTown.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown } from './lwTown.mjs';
import { skipReal, hostTown, townsOf, LOCATION_TYPES } from './lwRealTown.mjs';
import { townPlaces } from '../src/systems/livingWorld/places.js';
import { townCensus } from '../src/systems/livingWorld/census.js';
import { guildHallOf, guildDay, errandShop, favourites, dayPlan, ERRAND_NEEDS, ERRAND_NEED_SHARE, ERRAND_SHOP_SHARE, MAGES_GUILD, FIGHTERS_GUILD, ORDER_FACTIONS, DAY_MIN, DAY_START_MIN } from '../src/systems/livingWorld/dayPlan.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { BUILDING_TYPES as B } from '../src/world/buildingNames.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { PERSON_MOVE_SPEED } from '../src/characters/mobilePerson.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { seededRng } from '../src/systems/wind.js';

const MPM = PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND;
const TOWN = Object.freeze({ mapId: 4242, blocks: 36, region: 17, people: 3, port: false });

/** A town of six blocks by six, its halls given their guilds: the Mages Guild, two halls of the Fighters Guild, a knightly
 *  order (the Knights of the Dragon); and a library, a bookseller and a second general store among its houses. */
function guildTown(halls = { 1006: [B.GuildHall, MAGES_GUILD], 1009: [B.GuildHall, FIGHTERS_GUILD], 1030: [B.GuildHall, FIGHTERS_GUILD], 1014: [B.GuildHall, 368], 1010: [B.Library, 0], 1011: [B.Bookseller, 0], 1020: [B.GeneralStore, 0] }) {
  const fx = synthTown({ blocksW: 6, blocksH: 6 });
  const buildings = fx.buildings.map((b) => (halls[b.key] ? { ...b, type: halls[b.key][0], factionId: halls[b.key][1] } : b));
  const places = townPlaces(fx.nav, fx.doors, buildings);
  const census = townCensus(TOWN, buildings, new Set(places.doors.keys()));
  return { fx, buildings, places, census };
}
const homeOf = (places, r) => (r.home != null ? places.doors.get(r.home) ?? null : null);
const manhattan = (a, b) => Math.abs(a.cell[0] - b.cell[0]) + Math.abs(a.cell[1] - b.cell[1]);

test('LW-ERRANDS the town\'s places know each building\'s faction: a guild hall\'s guild, a temple\'s god - its summary\'s factionId (mutants: the factions unread)', () => {
  const { places } = guildTown();
  assert.deepEqual([1006, 1009, 1030, 1014, 1000, 1010].map((k) => places.factions.get(k)), [MAGES_GUILD, FIGHTERS_GUILD, FIGHTERS_GUILD, 368, 0, 0]);
  assert.equal(places.factions.size, places.types.size);
});

test('LW-ERRANDS a resident\'s guild: a hall\'s own members their hall; a courtier and a knight a knightly order (a knight where none stands the Fighters Guild); the mage\'s classes and the bookseller\'s, the library\'s and the alchemist\'s people the Mages Guild; the warrior\'s classes and the armourer\'s and the weaponsmith\'s people the Fighters Guild; the thief\'s classes and the rest none - the nearest to home of the town\'s halls of it, none where it keeps none (mutants: the members\' hall, the order, the knight, the trades, the mage\'s, the warrior\'s, the nearest)', () => {
  const { places, census } = guildTown();
  const halls = (test_) => [...places.doors.entries()].filter(([k]) => places.types.get(k) === B.GuildHall && test_(places.factions.get(k))).map(([, s]) => s);
  const nearest = (list, home) => [...list].sort((a, b) => manhattan(a, home) - manhattan(b, home) || a.key.localeCompare(b.key))[0] ?? null;
  const tally = new Map();
  for (const r of census) {
    const home = homeOf(places, r);
    if (!home) continue;
    const got = guildHallOf(r, places, home);
    const workType = r.work != null ? places.types.get(r.work) : -1;
    let want = null;
    if (r.job === 'guildsman') want = places.doors.get(r.work);
    else if (r.job === 'courtier') want = nearest(halls((f) => ORDER_FACTIONS.has(f)), home);
    else if ([B.Bookseller, B.Library, B.Alchemist].includes(workType) || (r.cls != null && r.cls >= M.Mage && r.cls <= M.Nightblade)) want = nearest(halls((f) => f === MAGES_GUILD), home);
    else if ([B.Armorer, B.WeaponSmith].includes(workType) || (r.cls != null && r.cls >= M.Monk && r.cls <= M.Knight)) want = nearest(halls((f) => f === FIGHTERS_GUILD), home);
    assert.equal(got, want, `${r.id} (${r.job}${r.cls != null ? `, class ${r.cls}` : ''}): ${got?.key ?? 'none'}`);
    const k = `${r.job}:${got ? places.factions.get(got.building ?? -1) : 'none'}`;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  for (const k of ['guildsman:40', 'guildsman:41', 'guildsman:368', 'courtier:368', 'scholar:40', 'smith:41', 'mercenary:40', 'mercenary:41', 'adventurer:40', 'adventurer:none', 'homemaker:none']) assert.ok(tally.get(k) > 0, `${k} (${JSON.stringify([...tally])})`);
  // the two halls of the Fighters Guild: each the nearest of some of its people
  const fighters = new Set(census.map((r) => guildHallOf(r, places, homeOf(places, r))).filter((h) => h && places.factions.get(h.building ?? -1) === FIGHTERS_GUILD).map((h) => h?.key));
  assert.equal(fighters.size, 2, 'either hall of the Fighters Guild the nearest of some');
  // by class, laid by hand: a sorcerer the Mages Guild (the first cut: the hall nearest home), a thief none, a knight his
  // order - and the Fighters Guild where the town keeps none; a sellsword with no hall of his guild in town none
  const base = census.find((r) => r.job === 'adventurer' && homeOf(places, r));
  const home = homeOf(places, base);
  const as = (cls, job = 'adventurer') => guildHallOf({ ...base, cls, job, work: null }, places, home);
  assert.equal(places.factions.get(as(M.Sorcerer)?.building ?? -1), MAGES_GUILD);
  assert.equal(as(M.Thief), null);
  assert.equal(places.factions.get(as(M.Knight)?.building ?? -1), 368);
  const noOrder = guildTown({ 1006: [B.GuildHall, MAGES_GUILD], 1009: [B.GuildHall, FIGHTERS_GUILD] });
  assert.equal(noOrder.places.factions.get(guildHallOf({ ...base, cls: M.Knight, work: null }, noOrder.places, homeOf(noOrder.places, base))?.building ?? -1), FIGHTERS_GUILD, 'a knight with no order in town: the Fighters Guild');
  assert.equal(guildHallOf({ ...base, job: 'courtier', cls: null, work: null }, noOrder.places, homeOf(noOrder.places, base)), null, 'a courtier with none: none');
  const noFighters = guildTown({ 1006: [B.GuildHall, MAGES_GUILD] });
  assert.equal(guildHallOf({ ...base, cls: M.Warrior, work: null }, noFighters.places, homeOf(noFighters.places, base)), null, 'no hall of his guild: none');
  // the same on every reader, every day: the favourite is it
  for (const r of census.slice(0, 80)) assert.equal(favourites(r, places, homeOf(places, r)).guild, guildHallOf(r, places, homeOf(places, r)));
});

test('LW-ERRANDS the guild\'s days: two days of the week, the member\'s own and three apart, the same each week - spread over the week across the town (mutants: the days)', () => {
  const { census } = guildTown();
  const weekdays = new Map();
  for (const r of census) {
    const days = [];
    for (let d = 700; d < 707; d++) if (guildDay(r, d)) days.push(d % 7);
    assert.equal(days.length, 2, `${r.id}: two days a week (${days})`);
    assert.ok((days[1] - days[0] === 3) || (days[1] - days[0] === 4), `${r.id}: three apart (${days})`);
    for (let d = 700; d < 707; d++) assert.equal(guildDay(r, d + 7), guildDay(r, d), `${r.id}: the same each week`);
    for (const w of days) weekdays.set(w, (weekdays.get(w) ?? 0) + 1);
  }
  assert.equal(weekdays.size, 7, 'every day of the week some one\'s');
  for (const [w, n] of weekdays) assert.ok(n > census.length * 2 / 7 / 2, `day ${w}: ${n}`);
});

test('LW-ERRANDS the guild\'s evenings: on their days a member by trade is at their hall from the day\'s work\'s end (six), a courtier at their order\'s from half past four - on no other day, and a hall\'s own members never as visitors; a sellsword and an adventurer at their own guild\'s hall each day, one of the thief\'s classes at none (mutants: the evening unkept, the members visiting, the courtier unkept, the days)', () => {
  const { places, census } = guildTown();
  let kept = 0, owed = 0, courts = 0;
  const evenings = ['keeper', 'smith', 'clerk', 'scholar', 'helper', 'courtier'];   // the trades' and the court's days
  for (const r of census) {
    const home = homeOf(places, r);
    if (!home) continue;
    const hall = guildHallOf(r, places, home);
    for (let day = 100; day < 114; day++) {
      const D0 = day * DAY_MIN;
      const plan = dayPlan(r, places, day, { mpm: MPM });
      const at = plan.filter((e) => e.kind === 'guild');
      for (const e of at) assert.equal(e.at, hall, `${r.id} day ${day}: at their own guild's hall`);
      if (r.job === 'guildsman') { assert.equal(at.length, 0, `${r.id}: a member of the hall is at it at work`); continue; }
      if (['mercenary', 'adventurer'].includes(r.job)) { if (!hall) assert.equal(at.length, 0, `${r.id}: no guild, no hall`); continue; }
      if (!hall || !evenings.includes(r.job)) { assert.equal(at.length, 0, `${r.id}: no guild's evening`); continue; }
      if (!guildDay(r, day)) { assert.equal(at.length, 0, `${r.id} day ${day}: not their day`); continue; }
      owed++;
      if (!at.length) continue;
      kept++;
      // at its hour (the stay begun sooner where they go on at once and wait there - the walk home and back the longer)
      const from = r.job === 'courtier' ? D0 + 16.5 * 60 : D0 + 18 * 60;
      assert.ok(at[0].t0 <= from + 120 && at[0].t1 > from, `${r.id} day ${day}: there at its hour (${((at[0].t0 - D0) / 60).toFixed(2)}-${((at[0].t1 - D0) / 60).toFixed(2)})`);
      if (r.job === 'courtier') courts++;
    }
  }
  // kept but where bed comes first: a lark living across the town walks home from work to bed (the hall and the walk home
  // after it past their bedtime)
  assert.ok(owed >= 40 && kept >= owed * 0.8, `the members' days kept (${kept} of ${owed})`);
  assert.ok(courts > 0, 'a courtier at their order\'s');
  // the travellers: each day at their own guild's hall, whatever is nearest
  for (const r of census.filter((x) => ['mercenary', 'adventurer'].includes(x.job))) {
    const hall = guildHallOf(r, places, homeOf(places, r));
    const days = Array.from({ length: 7 }, (_, i) => dayPlan(r, places, 200 + i, { mpm: MPM }).filter((e) => e.kind === 'guild'));
    if (hall) assert.ok(days.filter((d) => d.length).length >= 5 && days.flat().every((e) => e.at === hall), `${r.id}: at their guild's hall`);
    else assert.equal(days.flat().length, 0, `${r.id}: none`);
  }
});

test('LW-ERRANDS an errand\'s shop: of a kind the trade has need of (ERRAND_NEEDS) ERRAND_NEED_SHARE of the time, by its weight, the nearer of its two nearest home - else, and where the town keeps none of them, one of the four shops nearest home (mutants: the need, its share, its weights, the nearer two, the browse)', () => {
  assert.deepEqual([ERRAND_NEED_SHARE, ERRAND_SHOP_SHARE], [0.6, 2 / 3]);
  const { places, census } = guildTown();
  const r = census.find((x) => x.job === 'keeper' && homeOf(places, x));
  const shops = favourites(r, places, homeOf(places, r)).shops;
  const typeOf = (s) => places.types.get(s.building);
  const ofType = (t) => shops.filter((s) => typeOf(s) === t);
  const rng = seededRng(12345);
  const N = 6000;
  /** @type {Map<number, number>} */
  const byType = new Map();
  const near4 = new Set(shops.slice(0, 4));
  for (let i = 0; i < N; i++) {
    const s = /** @type {any} */ (errandShop('keeper', places, shops, rng));
    const t = typeOf(s);
    byType.set(t, (byType.get(t) ?? 0) + 1);
    const need = ERRAND_NEEDS.keeper.some(([k]) => k === t);
    assert.ok(near4.has(s) || (need && ofType(t).slice(0, 2).includes(s)), `${s.key}: of their need's two nearest, or of the four nearest`);
  }
  // the keeper's needs: the bank 3, the general store 2 - of ERRAND_NEED_SHARE; the rest the four nearest
  const bank = byType.get(B.Bank) ?? 0, store = byType.get(B.GeneralStore) ?? 0;
  const near4Bank = shops.slice(0, 4).filter((s) => typeOf(s) === B.Bank).length, near4Store = shops.slice(0, 4).filter((s) => typeOf(s) === B.GeneralStore).length;
  const expectBank = N * (ERRAND_NEED_SHARE * 3 / 5 + (1 - ERRAND_NEED_SHARE) * near4Bank / 4);
  const expectStore = N * (ERRAND_NEED_SHARE * 2 / 5 + (1 - ERRAND_NEED_SHARE) * near4Store / 4);
  assert.ok(Math.abs(bank - expectBank) < N * 0.03, `the bank ${bank}, by the law ${expectBank.toFixed(0)}`);
  assert.ok(Math.abs(store - expectStore) < N * 0.03, `the general store ${store}, by the law ${expectStore.toFixed(0)}`);
  // the town's two general stores: either the nearer of them by need (a third, were there one, only among the four nearest)
  const stores = ofType(B.GeneralStore);
  assert.equal(stores.length, 2);
  const picked = new Map();
  for (let i = 0; i < 2000; i++) { const s = errandShop('keeper', places, shops, rng); picked.set(s, (picked.get(s) ?? 0) + 1); }
  for (const st of stores) assert.ok((picked.get(st) ?? 0) > 2000 * ERRAND_NEED_SHARE * (2 / 5) / 2 * 0.7, `${st.key}: one of the nearer two (${picked.get(st) ?? 0})`);
  // a trade with no need listed, and a town that keeps none of a trade's needs: the four nearest
  for (const [job, list] of [['labourer', shops], ['scholar', shops.filter((s) => ![B.Library, B.Bookseller, B.Alchemist].includes(typeOf(s)))]]) {
    const four = new Set(list.slice(0, 4));
    const seen = new Set();
    for (let i = 0; i < 400; i++) { const s = errandShop(job, places, list, rng); assert.ok(four.has(s), `${job}: ${s.key} of the four nearest`); seen.add(s); }
    assert.equal(seen.size, Math.min(4, list.length), `${job}: each of the four`);
  }
  assert.equal(errandShop('keeper', places, [], rng), null, 'no shop: none');
});

test('LW-ERRANDS the day\'s errands: into a shop ERRAND_SHOP_SHARE of the time (the market the rest); a trade\'s shops of its needs - the bank its keepers\', smiths\' and merchants\', the library and the bookseller its scholars\' (mutants: the shop\'s share, the needs unread, the merchant\'s and the visitor\'s shops)', () => {
  const { places, census } = guildTown();
  let shops = 0, markets = 0;
  const visits = new Map();
  const tavern = [...places.doors.values()].find((s) => places.types.get(s.building ?? -1) === B.Tavern);
  for (let day = 100; day < 107; day++) {
    for (const r of census) {
      for (const visitor of r.job === 'merchant' ? [false, true] : [false]) {
        const plan = dayPlan(r, places, day, { mpm: MPM, visitor, home: visitor ? tavern : undefined });
        for (const e of plan) {
          if (e.kind === 'shop') {
            const k = `${visitor ? 'visitor' : r.job}:${places.types.get(e.at.building)}`;
            visits.set(k, (visits.get(k) ?? 0) + 1);
          }
          // a crafter's errand at nine: into a shop, or at the market (their only stay then - a homemaker's at eleven runs on
          // from their morning's market where it is the same)
          if (r.job === 'crafter' && e.t0 >= day * DAY_MIN + 9 * 60 - 1e-6 && e.t0 < day * DAY_MIN + 10.5 * 60) { if (e.kind === 'shop') shops++; else if (e.kind === 'market') markets++; }
        }
      }
    }
  }
  // every errand's shop one `errandShop` can give - of the two nearest home of a kind the trade needs, or of the four
  // nearest (a sellsword's and an adventurer's outfitter is their own)
  for (const r of census) {
    if (r.job === 'adventurer') continue;
    for (const visitor of r.job === 'merchant' ? [false, true] : [false]) {
      const home = visitor ? tavern : homeOf(places, r);
      if (!home) continue;
      const near = favourites(r, places, home).shops;
      const allowed = new Set(near.slice(0, 4));
      for (const [t] of ERRAND_NEEDS[visitor ? 'visitor' : r.job] ?? []) for (const s of near.filter((x) => places.types.get(x.building) === t).slice(0, 2)) allowed.add(s);
      for (let day = 100; day < 114; day++) {
        for (const e of dayPlan(r, places, day, { mpm: MPM, visitor, home: visitor ? tavern : undefined })) {
          if (e.kind === 'shop') assert.ok(allowed.has(e.at), `${r.id}${visitor ? ' visiting' : ''} day ${day}: ${e.at.key} - of their need's two nearest or of the four nearest`);
        }
      }
    }
  }
  const share = shops / Math.max(1, shops + markets);
  assert.ok(shops + markets > 200 && Math.abs(share - ERRAND_SHOP_SHARE) < 0.08, `a crafter's errand into a shop ${(100 * share).toFixed(0)}% (${shops} of ${shops + markets})`);
  const v = (k) => visits.get(k) ?? 0;
  assert.ok(v(`keeper:${B.Bank}`) + v(`smith:${B.Bank}`) > 0 && v(`merchant:${B.Bank}`) > 0, `the bank its keepers', smiths' and merchants' (${JSON.stringify([...visits])})`);
  assert.ok(v(`scholar:${B.Library}`) + v(`scholar:${B.Bookseller}`) > 0, 'the library and the bookseller its scholars\'');
  assert.ok(v(`homemaker:${B.GeneralStore}`) > v(`homemaker:${B.Bank}`), 'a household\'s stores before the bank');
  assert.ok([...visits.keys()].some((k) => k.startsWith('visitor:')), 'a visitor\'s wares');
});

test('LW-ERRANDS the game\'s own towns (ARENA2): Daggerfall, Ripmarket and Tuntale through a day - every guild hall\'s visitors its own guild\'s people, more of them than the first cut\'s (measured at LW-ERRANDS: 12, 10 and 10 a day - and of them the knights\' halls 8, 5 and 0, a sellsword\'s or an adventurer\'s nearest hall - before; 18, 11 and 14 after), and the banks\' and shops\' errands (the banks 2, 6 and 1 a day before, 7, 9 and 5 after) (mutants: the trades, the needs unread)', { skip: skipReal }, () => {
  const all = townsOf([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownVillage, LOCATION_TYPES.TownHamlet]);
  const DAY = 120;
  const want = { Daggerfall: [15, 5], Ripmarket: [10, 6], Tuntale: [12, 4] };
  for (const name of Object.keys(want)) {
    const h = hostTown(/** @type {any} */ (all.find((l) => l.name === name)));
    const lt = new LivingTown(h.nav, { town: h.town, buildings: h.buildings, doors: h.doors, makePerson: () => null, clock: () => DAY * DAY_MIN + DAY_START_MIN, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: MPM });
    const bt = new Map(h.buildings.map((b) => [b.key, b]));
    let guild = 0, bank = 0;
    for (const res of lt.peopleOf(DAY)) {
      const home = res.home != null ? lt.places.doors.get(res.home) ?? null : null;
      for (const e of lt.planOf(res, DAY)) {
        const b = e.at?.kind === 'door' && e.at.building != null ? bt.get(e.at.building) : null;   // in at its door (a social spot before a hall is the street's)
        if (!b || e.kind === 'walk' || b.key === res.home || b.key === res.work) continue;
        if (b.type === B.GuildHall) { guild++; assert.equal(e.at, guildHallOf(res, lt.places, home), `${name} ${res.id}: at their own guild's hall`); }
        if (b.type === B.Bank && e.kind === 'shop') bank++;
      }
    }
    assert.ok(guild >= want[name][0] && bank >= want[name][1], `${name}: ${guild} at the guild halls, ${bank} at the banks`);
  }
});
