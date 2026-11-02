// FIELD BUGS 2026-10-19f COMPANION-DROP (the owner, 2026-10-19: "Bag drops; no send-off in zone") had a companion at the
// player's side in the open zone drop his pack with theirs - a crew hand ashore, the sworn revenant the zone stands, its
// pack and its kit - and so kept him at their side there: no send-off, nothing given to one waiting outside, and one
// knocked out handing what he carried into the player's own pack. STORE-KEEPS (2026-10-26, the owner: "Make it where you
// cant lose your wagon/horse or anything stored on death"; asked, "Wagon + companions' packs") made every companion's
// pack, kit and coin storage, which no death takes - and the rules that kept them at the side went with the drop they
// served. The zone still stands one sworn one at the side (PVPDUNGEONS); the lists at the side are still named
// (systems/wild/wildDropLaw.js wildPacks, wildPacksOf), for the one reader left: an answer from before the word, asked
// again. Every record here is the game's own: the crew's party out of the real naval host (test/navalSea.mjs), the sworn
// out of the real feud and its retinue, the packs filled through their own live lists, the record as the save writes it.
// bible/11-Multiplayer/Wild-Zone.md section 4; bible/03-World/Naval-Combat.md COMPANION-KIT; bible/06-Systems/Revenants.md.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../src/systems/revenant/revenant.js');
const RC = await import('../../src/systems/revenant/revenantCompanions.js');
const S = await import('../../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../../src/characters/mobile/mobileTypes.js');
const { WEAPONS: W } = await import('../../src/characters/weapons.js');
const { createWeapon } = await import('../../src/combat/enemyEquipment.js');
const { createPotion } = await import('../../src/systems/loot/loot.js');
const { goldStack, letterOfCredit } = await import('../../src/systems/inventory.js');
const { portalStones, PORTAL_STONE_TEMPLATE } = await import('../../src/systems/gate/gateSpoils.js');
const { snapshotPlayer } = await import('../../src/systems/save/save.js');
const { modSaveRecords } = await import('../../src/systems/modSaveData.js');
const { registerPresenter, _resetNotifyForTests } = await import('../../src/systems/notify.js');
const { setWildHere } = await import('../../src/systems/wild/wildZone.js');
const { takeWildDeath, wildDropCandidates, wildTakeTook, wildPacks, wildPacksOf, wildSwornAtSide, WILD_PACK, WILD_REVENANTS_MAX, WILD_FALL_PACKS, wildFallWords, wildTookAny } = await import('../../src/systems/wild/wildDeath.js');
const { mintWildReceipt, WILD_FALL_GRACE_S } = await import('../../src/net/wild/wildReceipt.js');
const { NAVAL_SAVE_VENDOR } = await import('../../src/scenes/naval/navalHost.js');
const { HULL } = await import('../../src/systems/naval/navalShips.js');
const { sea } = await import('../navalSea.mjs');
const { standService } = await import('../accountDb.mjs');
const { seatRealm, recordOf, realmJoinAt } = await import('../realmSeat.mjs');
const { worldRoom } = await import('../../src/net/wire.js');
const { hostText } = await import('../hostText.mjs');

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DAY = 1440;
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };
beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear(); _resetNotifyForTests();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  setPlayerDoor(null); setWorldMinutes(DAY * 10); setWildHere(false);
});

const blade = (tpl, mat = 0) => createWeapon(tpl, mat, () => 0.5);
const kinds = (list) => (list ?? []).filter((it) => it?.group !== 'Currency').map((it) => it.templateIndex);
const coin = (list) => (list ?? []).find((it) => it?.group === 'Currency')?.stackCount ?? 0;
const killer = (champion) => ({ mobileType: M.Orc, level: 6, champion, unquiet: true, health: 50, maxHealth: 50, team: 'Monster' });

/**
 * THE FALLEN AND HER COMPANIONS, as play makes them. Riadne: a claymore carried and 400 gold in her purse. Ashore, a
 * hand of her Small Ship's crew taken by the boat's own picker (navalHost companionPress), his pack filled through its
 * live list (the storage window's): a war axe, a letter of credit, three Portal Stones (bound), a healing potion and 300
 * gold. Sworn, three Orcs spared at her side or away: the first walking with her (the one the zone stands) with a mace
 * and 100 gold in its pack and a longsword of hers given as its kit (giveSwornGear); the second walking with her too (in
 * the zone it waits outside) with a dagger; the third away with a saber. And ahead of them in the feud's list, an Orc that
 * fled her and was never spared: the feud's own hostile record, no companion (AUDIT FB1019f B3).
 */
async function stand() {
  const h = await sea({ hull: HULL.SmallShip });
  h.boat.crewed = true;
  h.host.restoreSaveData({ v: 1, boats: { 42: { hull: 420, sail: 160, crew: 24, fire: 0, state: 'afloat', barrels: 4 } }, notoriety: {}, day: 1, raids: [] });
  h.run(0.2);
  h.runtime.sailing = false;
  const hand = h.host.crewOf(h.boat).hands[0].name;
  assert.equal(h.host.companionPress(h.boat, hand, 0), 'take', 'he comes ashore');
  const pack = h.host.companionPack(`42:${hand}`).items;
  pack.push(blade(W.War_Axe, 1), letterOfCredit(5000), portalStones(3), createPotion('healing'), goldStack(300));
  const p = { isPlayer: true, name: 'Riadne Stormwind', characterId: 'char-fb1019f', level: 20, stats: {}, skills: [], career: {}, activeEffects: [], items: [blade(W.Claymore, 1)], goldPieces: 400, health: 100, maxHealth: 100 };
  RC.setRetinuePlayer(p);
  const foe = N.revenantDeed(p, killer('swift'), 'fled', { mobileType: M.Orc, rolls: () => 0 });
  const sworn =(champion, state) => N.revenantSpared(p, { revenant: { id: N.revenantDeed(p, killer(champion), 'fled', { mobileType: M.Orc, rolls: () => 0 }).id } }, { state });
  const a = sworn('mighty', 'with'), b = sworn('swift', 'with'), c = sworn('mighty', 'away');
  const party = RC.revenantParty();
  party.packOf(a.id).push(blade(W.Mace, 1), goldStack(100));
  party.packOf(b.id).push(blade(W.Dagger, 1));
  party.packOf(c.id).push(blade(W.Saber, 1));
  const sword = blade(W.Longsword, 0);
  p.items.push(sword);
  assert.equal(RC.giveSwornGear(a.id, sword), null, 'its kit given through its own door');
  const record = () => JSON.parse(JSON.stringify(snapshotPlayer(p, { modData: { [NAVAL_SAVE_VENDOR]: h.host.getSaveData(), [N.REVENANT_SAVE]: modSaveRecords()[N.REVENANT_SAVE] } })));
  return { h, hand, pack, p, foe, a, b, c, sword, record };
}
const swornOf = (rec, id) => rec.modData[N.REVENANT_SAVE].list.find((r) => r.id === id);
const crewOf = (rec) => rec.modData[NAVAL_SAVE_VENDOR].party.party[0];

test('COMPANION-DROP WHO IS AT THE SIDE (wildDropLaw.js wildPacksOf, wildSwornAtSide - the record\'s own): every crew hand ashore - his pack - and the sworn walking with her up to WILD_REVENANTS_MAX in the list\'s order - its pack and its kit; the second walking with her waits outside the zone and the one away is away; a hostile one listed ahead of them, no companion, is never at her side; the zone\'s party stands the same one (mutants: the sworn\'s state unread; the slice dropped; the kit unread; the crew unread; AUDIT FB1019f B3: the oath unread)', async () => {
  const s = await stand();
  const rec = s.record();
  const feud = rec.modData[N.REVENANT_SAVE].list;
  assert.deepEqual([feud[0].id, feud[0].sworn, feud[0].companion], [s.foe.id, false, null], 'the feud\'s hostile one first, no companion - its state unkept, read as walking with her');
  assert.deepEqual(wildPacksOf(rec).map((x) => x.f), [WILD_PACK.crew(42, s.hand), WILD_PACK.sworn(s.a.id), WILD_PACK.kit(s.a.id)]);
  assert.deepEqual([WILD_PACK.crew(42, s.hand), WILD_PACK.sworn(s.a.id), WILD_PACK.kit(s.a.id)], [`crew:42:${s.hand}`, `sworn:${s.a.id}`, `kit:${s.a.id}`], 'the take\'s words');
  assert.deepEqual(wildSwornAtSide(rec.modData[N.REVENANT_SAVE].list).map((r) => r.id), [s.a.id], 'the first walking with her');
  assert.equal(WILD_REVENANTS_MAX, RC.WILD_REVENANTS_MAX, 'one number at both ends');
  assert.equal(WILD_REVENANTS_MAX, 1);
  assert.deepEqual(kinds(wildPacksOf(rec)[2].items), [W.Longsword], 'its kit as a list');
  // the live lists are the same packs, the same shape
  assert.deepEqual(wildPacks(s.h.host.companions.party, RC.revenantsWithYou()).map((x) => [x.f, kinds(x.items)]), wildPacksOf(rec).map((x) => [x.f, kinds(x.items)]));
  // the zone's party stands the one whose pack drops; outside it, both walking with her
  assert.deepEqual(RC.revenantParty().party.map((m) => m.name), [s.a.id, s.b.id]);
  setWildHere(true);
  assert.deepEqual(RC.revenantParty().party.map((m) => m.name), [s.a.id], 'in the zone, the one at the side');
  assert.deepEqual(RC.swornAtYourSide().map((r) => r.id), [s.a.id]);
  // the first walking with her sent away (outside the zone): the next walking with her is the one at the side
  setWildHere(false);
  assert.equal(RC.sendRevenantAway(s.a.id), true);
  assert.deepEqual(wildSwornAtSide(s.record().modData[N.REVENANT_SAVE].list).map((r) => r.id), [s.b.id], 'an away one is never at the side');
  // a hand sent back before the zone is no one's at the side; a live character's record carries none
  assert.deepEqual(wildPacksOf({ items: [] }), []);
  assert.deepEqual(wildPacksOf({ modData: { [NAVAL_SAVE_VENDOR]: { party: { party: [] } }, [N.REVENANT_SAVE]: { list: [] } } }), []);
});

/** The packs at her side as the record keeps them - each list's pieces and its coin. */
const packsOf = (rec) => ({ crew: [kinds(crewOf(rec).items).sort(), coin(crewOf(rec).items)], sworn: [kinds(swornOf(rec, rec.__a).companion.items), coin(swornOf(rec, rec.__a).companion.items)], kit: kinds(Object.values(swornOf(rec, rec.__a).companion.gear ?? {})) });

test('STORE-KEEPS THE PACKS, THE LAW (wildDropLaw.js takeWildDeath, wildDropCandidates over the record): a death in the zone takes her bag and her purse\'s tenth - and nothing of his pack nor of the sworn one\'s pack, kit or coin, at her side or away; the ledger is asked of no piece of theirs (mutants: the packs read again; a pack\'s coin\'s share taken)', async () => {
  const s = await stand();
  const rec = s.record();
  rec.__a = s.a.id;
  const whole = packsOf(rec);
  assert.deepEqual(whole.crew[1], 300, 'the fixture: his coin');
  const cand = wildDropCandidates(rec, -1).map((it) => it.templateIndex);
  assert.ok(cand.includes(W.Claymore), 'the bag\'s claymore');
  for (const t of [W.War_Axe, W.Mace, W.Longsword, W.Dagger, W.Saber]) assert.ok(!cand.includes(t), `never ${t}, a companion's`);
  const d = takeWildDeath(rec, -1);
  assert.deepEqual([...new Set(d.from)].sort(), ['bag', 'gold'], 'the bag and the purse alone');
  assert.deepEqual(d.gold, { purse: 40 }, 'a tenth of her purse, no companion\'s coin');
  assert.equal(d.taken[0].stackCount, 40);
  assert.deepEqual(packsOf(rec), whole, '"anything stored": his pack, its pack, its kit and their coin, whole');
  assert.deepEqual(kinds(swornOf(rec, s.b.id).companion.items), [W.Dagger], 'the one waiting outside the zone: whole');
  assert.deepEqual(kinds(swornOf(rec, s.c.id).companion.items), [W.Saber], 'away: whole');
});

test('STORE-KEEPS THE PACKS THROUGH THE SERVICE AND BACK (server-account/src/wild.js, wildTakeTook): at another player\'s hand the service takes her bag and her purse\'s tenth off the record and nothing of a companion\'s - whether her tab says `packs` 1 or nothing, and on a seizure; her game takes exactly that out of its own lists, her companions\' untouched; an answer from before the word that names a pack\'s piece and coin still comes out of that pack alone (mutants: the packs taken again; the applier reading a pack\'s piece from the bag)', async () => {
  const s = await stand();
  const svc = await standService();
  const ria = await svc.registered('Riadne'), bo = await svc.registered('Borin');
  const R = await seatRealm(svc.env, ria.secret, 'Riadne', s.record());
  const stored = () => { const r = JSON.parse(new TextDecoder().decode(svc.env.SAVES._map.get(svc.env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id).obj))); r.__a = s.a.id; return r; };
  const whole = packsOf(stored());
  const now = () => Math.floor(Date.now() / 1000);
  const fall = (body, who = ria) => quiet(() => svc.call('/v1/wild/fall', { room: worldRoom(520, 110), ...body }, who.secret));
  // her game's own words, and a tab's from before them
  assert.deepEqual(wildFallWords(), { packs: WILD_FALL_PACKS, letters: 1 });
  const d = (await fall({ receipt: await mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789b1', w: -1 }, svc.gatePriv, { subtle: globalThis.crypto.subtle, nowS: now() }), realm: R.at(), collect: 1, ...wildFallWords() })).body;   // PIN MOVED (PVP-NO-TENTH): no worn piece, no policy - the last roll, where the room collects
  assert.deepEqual(d.took, [], JSON.stringify(d));   // PIN MOVED (PVP-REWARD): the bag drops nothing, and she wears nothing a kill takes
  assert.deepEqual(d.gold, { purse: 40, cart: 0 }, 'no pack\'s share');
  assert.equal(d.items.find((i) => i.group === 'Currency').stackCount, 40, 'the remains\' gold: her tenth alone');
  assert.deepEqual(packsOf(stored()), whole, 'the record\'s packs whole');
  const old = (await fall({ receipt: await mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789b2', w: -1 }, svc.gatePriv, { subtle: globalThis.crypto.subtle, nowS: now() }), realm: R.at(), cart: 1 })).body;
  assert.deepEqual([old.error, [...new Set(old.took.map((x) => x.f))].filter((f) => f !== 'bag')], [undefined, []], 'a tab from before the word: answered, no pack taken (COMPANION-DROP refused it)');
  const seized = await fall({ receipt: await mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789b3', w: -1 }, svc.gatePriv, { subtle: globalThis.crypto.subtle, nowS: now() - WILD_FALL_GRACE_S - 1 }) }, bo);
  assert.equal(seized.status, 200, JSON.stringify(seized.body));
  assert.equal(seized.body.gold.packs, undefined, 'a seizure takes no pack\'s coin');
  assert.deepEqual(packsOf(stored()), whole, 'nor its pieces');
  assert.ok(!rd('server-account/src/wild.js').includes("return 'not-found'"), 'no take of the packs to refuse');
  // her game: what the service took, out of its own lists - her purse's tenth (PIN MOVED, PVP-REWARD: her bag's claymore kept); her companions' live lists untouched
  const bag = s.p.items.length;
  const out = wildTakeTook(s.p, d.took, d.gold, () => {}, wildPacks(s.h.host.companions.party, RC.revenantsWithYou()));
  assert.deepEqual([out.length, s.p.items.length, s.p.goldPieces], [0, bag, 360]);
  assert.deepEqual([kinds(s.pack).length, coin(s.pack)], [4, 300], 'his live pack whole');
  // an answer from before STORE-KEEPS, asked again: its pack's piece and coin come out of that pack alone
  const was = { items: [], goldPieces: 0 };
  const hisAxe = s.pack.find((it) => it.templateIndex === W.War_Axe);
  const oldOut = wildTakeTook(was, [{ g: 'Weapons', t: W.War_Axe, m: hisAxe.material ?? 0, u: hisAxe.uid ?? null, p: null, n: 1, f: WILD_PACK.crew(42, s.hand) }], { purse: 0, cart: 0, packs: { [WILD_PACK.crew(42, s.hand)]: 30 } }, () => {}, wildPacks(s.h.host.companions.party, RC.revenantsWithYou()));
  assert.deepEqual([oldOut.length, coin(s.pack), s.pack.includes(hisAxe)], [1, 270, false], 'his piece and his share, out of his pack');
  assert.equal(wildTookAny(oldOut, { purse: 0 }), true);
  const lone = { items: [blade(W.Mace, 1)] };
  assert.deepEqual(wildTakeTook(lone, [{ g: 'Weapons', t: W.Mace, m: 1, u: null, p: null, n: 1, f: WILD_PACK.sworn('gone') }], null, () => {}, []), [], 'a piece whose pack is not here is left - never another list\'s');
  assert.equal(lone.items.length, 1);
});

test('STORE-KEEPS SEND-OFF IN THE ZONE: with nothing of theirs to drop, a hand ashore is sent back aboard from inside the zone - his pack to her hold - and the sworn one at the side is sent away or on an errand, and given kit while it waits outside, as anywhere; the roster, the slots\' hold and the boat\'s picker ask no zone (mutants: COMPANION-DROP\'s refusals back)', async () => {
  const s = await stand();
  setWildHere(true);
  assert.equal(s.h.host.companionPress(s.h.boat, s.hand, 0), 'back', 'sent back aboard inside the zone');
  assert.deepEqual(s.h.log.given.at(-1), [5, s.h.boat], 'his pack into her hold');
  assert.equal(RC.errandRefusal(s.a, DAY * 10), null, 'an errand may be asked');
  const gift = blade(W.Broadsword, 0);
  s.p.items.push(gift);
  assert.equal(RC.giveSwornGear(s.c.id, gift), null, 'kit to one waiting outside');
  assert.equal(RC.sendRevenantAway(s.a.id), true, 'the one at the side sent away');
  assert.equal(N.revenantById(s.a.id).companion.state, 'away');
  assert.equal(RC.leaveRefusal, undefined, 'no refusal left to ask');
  assert.ok(rd('src/ui/companionRoster.js').includes('away.onclick = () => {\n        _notice = null;\n        sendRevenantAway(r.id);\n        rerender();\n      };'));
  assert.ok(rd('src/scenes/world.js').includes('const last = revenantsWithYou().sort((a, b) => (b.swornAt ?? 0) - (a.swornAt ?? 0))[0];'));
  assert.ok(!rd('src/scenes/naval/navalHost.js').includes('heldAtSide'), 'the boat\'s picker asks no zone');
});

test('STORE-KEEPS CARRIED OFF IN THE ZONE: a hand knocked out there gives his pack up into her hold, as anywhere - never my pack, where a death would take it; the sworn one at the side knocked out there rests with its pack and its kit, nothing handed over and nothing said (mutants: the pack into mine in the zone; the hand-over back)', async () => {
  const s = await stand();
  const said = [];
  registerPresenter({ hudText: (t) => { said.push(t); return true; } });
  setWildHere(true);
  const c = s.h.host.companions.party[0];
  s.h.host.companions.knock(42, s.hand, 0);
  s.h.host.companionKnocked(c);
  assert.deepEqual(s.h.log.given.at(-1), [5, s.h.boat], 'her hold');
  const before = s.p.items.length, gold = s.p.goldPieces;
  assert.equal(RC.revenantParty().knock('rv', s.a.id, DAY * 10), true);
  const a = N.revenantById(s.a.id);
  assert.equal(a.companion.state, 'resting');
  assert.deepEqual(kinds(a.companion.items), [W.Mace], 'it rests with its pack');
  assert.equal(a.companion.gear.weapon, s.sword, 'and its kit');
  assert.deepEqual([s.p.items.length, s.p.goldPieces, said], [before, gold, []], 'nothing handed over, nothing said');
});

test('STORE-KEEPS AN ANSWER FROM BEFORE THE WORD (server-account/src/wild.js answerOf, wildDropLaw.js wildTakeTook, wildDeath.js wildTookAny): a fall COMPANION-DROP took, asked again, is answered its first take - each pack\'s coin share by its word - and the fallen\'s game takes it out of the packs it names, a record\'s own by default, a kit\'s slot emptied as its list now stands; risen, a companion\'s coin alone is said (mutants: the service\'s shares unsaid; the record\'s packs unread by default; the kit put backwards or left; the risen word blind to a pack\'s coin or asking the old question)', async () => {
  const s = await stand();
  const svc = await standService();
  const ria = await svc.registered('Riadne'), bo = await svc.registered('Borin');
  const R = await seatRealm(svc.env, ria.secret, 'Riadne', s.record());
  const rec = s.record();
  const crew = WILD_PACK.crew(42, s.hand), sworn = WILD_PACK.sworn(s.a.id), kit = WILD_PACK.kit(s.a.id);
  const mark = (it, f) => ({ g: it.group, t: it.templateIndex, m: it.material ?? 0, u: it.uid ?? null, p: null, n: 1, f });
  const axe = crewOf(rec).items.find((it) => it.templateIndex === W.War_Axe), mace = swornOf(rec, s.a.id).companion.items.find((it) => it.templateIndex === W.Mace);
  const took = [mark(axe, crew), mark(mace, sworn), mark(swornOf(rec, s.a.id).companion.gear.weapon, kit)];
  const gold = { purse: 0, cart: 0, packs: { [crew]: 30, [sworn]: 10 } };
  // the fall as COMPANION-DROP wrote it, its first take kept on the row
  svc.env.DB._raw.prepare("INSERT INTO wild_falls (r, char_id, player, killer, at, items, kept, burnt, wi, wm, oi, wg, tk) VALUES ('0123456789be', ?, ?, ?, ?, '[]', '[]', 0, -1, ?, 0, NULL, ?)")
    .run(R.id, ria.id, bo.id, Math.floor(Date.now() / 1000), worldRoom(520, 110), JSON.stringify({ took, gold }));
  const rc = await mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789be', w: -1 }, svc.gatePriv, { subtle: globalThis.crypto.subtle, nowS: Math.floor(Date.now() / 1000) });
  const again = await quiet(() => svc.call('/v1/wild/fall', { room: worldRoom(520, 110), receipt: rc, realm: R.at(), ...wildFallWords() }, ria.secret));
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.deepEqual([again.body.took.map((x) => x.f), again.body.gold], [[crew, sworn, kit], gold], 'its first take, each pack\'s share by its word');
  // a record's own packs by default: each piece out of the pack it names, the coin lowered, the kit's slot emptied
  const twin = s.record();
  const out = wildTakeTook(twin, again.body.took, again.body.gold);
  assert.equal(out.length, 3, 'every piece found in its own pack');
  assert.deepEqual([kinds(crewOf(twin).items).includes(W.War_Axe), coin(crewOf(twin).items)], [false, 270]);
  assert.deepEqual([kinds(swornOf(twin, s.a.id).companion.items), coin(swornOf(twin, s.a.id).companion.items)], [[], 90]);
  assert.deepEqual(swornOf(twin, s.a.id).companion.gear, {}, 'the kit\'s slot written back empty');
  // the live lists the same, the kit's slot too
  const live = wildTakeTook(s.p, again.body.took, again.body.gold, () => {}, wildPacks(s.h.host.companions.party, RC.revenantsWithYou()));
  assert.equal(live.length, 3);
  assert.deepEqual(N.revenantById(s.a.id).companion.gear ?? {}, {}, 'the live kit\'s slot emptied');
  // risen: a companion's coin alone is my loss too, and the host asks it so
  assert.equal(wildTookAny([], { purse: 0, cart: 0, packs: { [crew]: 3 } }), true);
  assert.ok(hostText('src/scenes/world.js').includes('    else if (wildTookAny(out, d.gold)) townTalk.say('), 'the risen word asks wildTookAny');
});
