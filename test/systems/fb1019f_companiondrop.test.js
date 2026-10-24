// FIELD BUGS 2026-10-19f COMPANION-DROP (a player's private report; the owner, 2026-10-19, answering this session's
// questions: "Bag drops; no send-off in zone"). A death in the open zone dropped the bag and the cart and never read a
// companion: what lay in a companion's pack - or a sworn revenant's kit - was outside the drop, and sending him off
// stowed it outside the zone. CART-AWAY's law, for the companions: storage WITH the player drops, storage outside the
// zone keeps. A crew hand ashore and the sworn revenant the zone stands at the player's side drop what they carry with
// the player's own (systems/wild/wildDropLaw.js wildPacks - the leaf the account service runs on the record and the
// fallen's game runs on its own lists); none of them is sent off from inside the zone, nothing of mine reaches one
// waiting outside it, and one carried off knocked out leaves what it carries with me. Every record here is the game's
// own: the crew's party out of the real naval host (test/navalSea.mjs), the sworn out of the real feud and its retinue,
// the packs filled through their own live lists, the record as the save writes it.
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
const { setWildHere, WILD_TEXT } = await import('../../src/systems/wild/wildZone.js');
const { takeWildDeath, wildDropCandidates, wildTookOf, wildTakeTook, wildPacks, wildPacksOf, wildSwornAtSide, WILD_PACK, WILD_REVENANTS_MAX, WILD_FALL_PACKS, wildFallWords, wildTookAny } = await import('../../src/systems/wild/wildDeath.js');
const { newSaveData } = await import('../../src/systems/horse/horseCartLaw.js');
const { mintWildReceipt, WILD_FALL_GRACE_S } = await import('../../src/net/wild/wildReceipt.js');
const { accountRefusalText } = await import('../../src/net/accountClient.js');
const { heldAtSide, packStaysAshore } = await import('../../src/systems/naval/crewCompanions.js');
const { NAVAL_SAVE_VENDOR } = await import('../../src/scenes/naval/navalHost.js');
const { HULL } = await import('../../src/systems/naval/navalShips.js');
const { sea } = await import('../navalSea.mjs');
const { standService } = await import('../accountDb.mjs');
const { seatRealm, recordOf, realmJoinAt } = await import('../realmSeat.mjs');
const { worldRoom } = await import('../../src/net/wire.js');

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

test('COMPANION-DROP THE LAW (wildDropLaw.js takeWildDeath, wildDropCandidates, takeWildGold over the record): his pack and the sworn one\'s pack and kit drop with the bag, by worth, each piece named by its pack - the letter too (LETTERS-DROP); what never changes hands stays in his pack (the bound Portal Stones, the potion the fallen keep); a tenth of each pack\'s coin into the one pile (FOE-KEEPS: it halved); the one waiting outside the zone and the one away keep everything (mutants: the packs never read; a pack\'s drop dropped; its coin kept; its coin\'s share unsaid; a kit\'s slots never written back)', async () => {
  const s = await stand();
  const rec = s.record();
  const cand = wildDropCandidates(rec, -1).map((it) => it.templateIndex);
  for (const t of [W.Claymore, W.War_Axe, W.Mace, W.Longsword]) assert.ok(cand.includes(t), `the ledger is asked of ${t}`);
  assert.ok(!cand.includes(W.Dagger) && !cand.includes(W.Saber), 'never of the ones outside the zone');
  const d = takeWildDeath(rec, -1);
  const where = Object.fromEntries(d.taken.map((it, i) => [it.group === 'Currency' ? 'gold' : it.templateIndex, d.from[i]]));
  assert.deepEqual(where, {
    gold: 'gold', [W.Claymore]: 'bag', [W.War_Axe]: WILD_PACK.crew(42, s.hand), [s.pack[1].templateIndex]: WILD_PACK.crew(42, s.hand),
    [W.Mace]: WILD_PACK.sworn(s.a.id), [W.Longsword]: WILD_PACK.kit(s.a.id),
  });
  // PIN MOVED (FOE-KEEPS, bible/11-Multiplayer/Wild-Zone.md section 4): a tenth of each purse, the usual death's share - it was half
  assert.deepEqual(d.gold, { purse: 40, cart: 0, packs: { [WILD_PACK.crew(42, s.hand)]: 30, [WILD_PACK.sworn(s.a.id)]: 10 } });
  assert.equal(d.taken[0].stackCount, 40 + 30 + 10, 'one pile: the purse\'s tenth, his and its');
  assert.equal(d.taken[1].value, 5000, 'the letter first, by its worth');
  // the record after: his pack keeps what never changes hands and nine tenths of his coin; the sworn's emptied but its coin's
  assert.deepEqual([kinds(crewOf(rec).items).sort(), coin(crewOf(rec).items)], [[PORTAL_STONE_TEMPLATE, s.pack[3].templateIndex].sort(), 270]);
  assert.deepEqual([kinds(swornOf(rec, s.a.id).companion.items), coin(swornOf(rec, s.a.id).companion.items)], [[], 90]);
  assert.deepEqual(swornOf(rec, s.a.id).companion.gear, {}, 'its kit\'s slot emptied');
  // the record's own packs, by default, wherever the take runs: a twin record finds every piece where it lay
  const twin = s.record();
  assert.equal(wildTakeTook(twin, wildTookOf(d.taken, d.from), d.gold).length, d.taken.length - 1);
  assert.deepEqual([crewOf(twin).items, swornOf(twin, s.a.id).companion], [crewOf(rec).items, swornOf(rec, s.a.id).companion], 'the twin as the record');
  assert.equal(twin.goldPieces, rec.goldPieces);
  // a piece the ledger keeps (keep) stands aside in his pack and comes back to its place
  const kept = s.record();
  const k = takeWildDeath(kept, -1, (it) => it.templateIndex === W.War_Axe);
  assert.ok(!k.taken.some((it) => it.templateIndex === W.War_Axe));
  assert.equal(crewOf(kept).items[0].templateIndex, W.War_Axe, 'kept, at its place');
  assert.deepEqual(kinds(swornOf(rec, s.b.id).companion.items), [W.Dagger], 'waiting outside the zone: kept');
  assert.deepEqual(kinds(swornOf(rec, s.c.id).companion.items), [W.Saber], 'away: kept');
  // a remains too full - her bag a hundred Elven claymores - takes the worthiest; what does not fit goes back where it lay:
  // his axe to his pack, its mace to its pack, its longsword to its kit's slot
  for (let i = 0; i < 100; i++) s.p.items.push(blade(W.Claymore, 3));
  const full = s.record();
  const many = takeWildDeath(full, -1);
  assert.equal(many.records.length, 96, 'the remains\' bound');
  assert.ok(many.from.includes(WILD_PACK.crew(42, s.hand)), 'his letter, worth more than any claymore, still taken');
  assert.deepEqual(kinds(crewOf(full).items).sort(), [W.War_Axe, PORTAL_STONE_TEMPLATE, s.pack[3].templateIndex].sort(), 'his axe back in his pack');
  assert.deepEqual(kinds(swornOf(full, s.a.id).companion.items), [W.Mace], 'its mace back in its pack');
  assert.equal(swornOf(full, s.a.id).companion.gear.weapon?.templateIndex, W.Longsword, 'its longsword back in its slot');
});

test('COMPANION-DROP THROUGH THE SERVICE AND BACK (server-account/src/wild.js, wildTakeTook): a death at another player\'s hand takes his pack and the sworn one\'s pack and kit off the record with the bag, its answer naming each piece\'s pack and each pack\'s coin share - and the fallen\'s game takes exactly that out of its own live lists (mutants: the service\'s packs share unsaid; a pack\'s piece taken from the bag; a pack\'s coin left; a kit\'s slot left)', async () => {
  const s = await stand();
  const svc = await standService();
  const ria = await svc.registered('Riadne'), bo = await svc.registered('Borin');
  const R = await seatRealm(svc.env, ria.secret, 'Riadne', s.record());
  const stored = () => JSON.parse(new TextDecoder().decode(svc.env.SAVES._map.get(svc.env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id).obj)));
  // her game's own words (world.js wildTakeDrop: wildFallWords - the mods off, the wagon with her; `packs` 1, her game reads
  // the packs). PIN MOVED (AUDIT FB1019f B2): the ask without them is a game from before the word, refused (below)
  // PIN MOVED (FOE-KEEPS): at Borin's hand, its receipt carried (no worn piece picked) - a death to a foe takes nothing now
  const receipt = await mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789b1', w: -1 }, svc.gatePriv, { subtle: globalThis.crypto.subtle, nowS: Math.floor(Date.now() / 1000) });
  const res = await quiet(() => svc.call('/v1/wild/fall', { room: worldRoom(520, 110), receipt, realm: R.at(), ...wildFallWords(false, null, null) }, ria.secret));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body;
  assert.deepEqual([...new Set(d.took.map((x) => x.f))].sort(), ['bag', WILD_PACK.crew(42, s.hand), WILD_PACK.kit(s.a.id), WILD_PACK.sworn(s.a.id)].sort());
  assert.deepEqual(d.gold, { purse: 40, cart: 0, packs: { [WILD_PACK.crew(42, s.hand)]: 30, [WILD_PACK.sworn(s.a.id)]: 10 } });   // PIN MOVED (FOE-KEEPS): a tenth
  assert.equal(d.items.find((i) => i.group === 'Currency').stackCount, 80, 'the remains\' gold');
  const after = stored();
  assert.deepEqual([kinds(crewOf(after).items).sort(), coin(crewOf(after).items)], [[PORTAL_STONE_TEMPLATE, s.pack[3].templateIndex].sort(), 270]);
  assert.deepEqual([kinds(swornOf(after, s.a.id).companion.items), swornOf(after, s.a.id).companion.gear], [[], {}]);
  // the fallen's game (world.js wildDropTaken): out of its own live lists, never its bag's
  const bag = s.p.items.length;
  const out = wildTakeTook(s.p, d.took, d.gold, () => {}, wildPacks(s.h.host.companions.party, RC.revenantsWithYou()));
  assert.equal(out.length, d.took.length, 'every piece found where it lay');
  assert.deepEqual([kinds(s.pack).sort(), coin(s.pack)], [[PORTAL_STONE_TEMPLATE, s.pack.find((it) => it.group === 'UselessItems1').templateIndex].sort(), 270], 'his live pack as the record');
  const a = N.revenantById(s.a.id);
  assert.deepEqual([kinds(a.companion.items), coin(a.companion.items), a.companion.gear], [[], 90, {}], 'the sworn one\'s live pack and kit');
  assert.equal(s.p.items.length, bag - 1, 'the bag lost its own claymore alone');
  assert.equal(s.p.goldPieces, 360);
  // a piece whose pack is not here is left, never another list's of the same marks
  const lone = { items: [blade(W.Mace, 1)] };
  assert.deepEqual(wildTakeTook(lone, [{ g: 'Weapons', t: W.Mace, m: 1, u: null, p: null, n: 1, f: WILD_PACK.sworn('gone') }], null, () => {}, []), []);
  assert.equal(lone.items.length, 1);
  // the service hands the shares on
  const svcSrc = rd('server-account/src/wild.js');
  assert.ok(svcSrc.includes('gold: { purse: tk?.gold?.purse ?? 0, cart: tk?.gold?.cart ?? 0, ...packs, ...letters }'));   // PIN MOVED (AUDIT FOE-KEEPS LETTERS-TENTH): and the letters' shares
});

test('COMPANION-DROP A TAB FROM BEFORE THE WORD (AUDIT FB1019f B2): the fallen\'s own ask says its game reads the packs (`packs` 1, wildFallWords, the wagon\'s word beside it); asked without it, a take of a companion\'s pack - his pieces, or his coin alone - is refused in the old build\'s word (`not-found`), nothing moved, never a smaller take; a fall at another\'s hand so refused is taken whole, packs and all, by the killer\'s seizure past the grace, which no game applies; a take that touches no pack is that tab\'s as ever; and risen, a companion\'s coin alone is said (B5) (mutants: the refusal gone; the word unread; a seizure refused; a pack\'s coin unread; the pile, the cart or the bag read as a pack; the words without the packs; the risen word blind to a pack\'s coin)', async () => {
  // the word, as the game says it
  assert.equal(WILD_FALL_PACKS, 1);
  // PIN MOVED (AUDIT FOE-KEEPS LETTERS-TENTH): and `letters` 1 - this game lowers a letter by its share
  assert.deepEqual(wildFallWords(false, null, null), { cart: 1, packs: 1, letters: 1 }, 'the mod off: the wagon goes where she goes, and the packs read');
  assert.deepEqual(wildFallWords(true, newSaveData(), null), { cart: 0, packs: 1, letters: 1 }, 'the mod on, no wagon: away');
  assert.equal(accountRefusalText('not-found'), 'The account service does not know that request. The game may need updating.', 'the old build\'s word, as every shipped build says it');
  assert.ok(rd('src/scenes/world.js').includes('...(online?.wildCollectAt?.(lay) ? { collect: 1 } : {}), ...wildFallWords(hccOn(), hccRuntime.getSaveData(), wildMaskOf(maps)) }),'), 'my own ask says them');
  // her record as play left it - her purse spent, so every coin a death takes is her companions'
  const s = await stand();
  s.p.goldPieces = 0;
  const svc = await standService();
  const ria = await svc.registered('Riadne'), bo = await svc.registered('Borin');
  const R = await seatRealm(svc.env, ria.secret, 'Riadne', s.record());
  const raw = svc.env.DB._raw;
  const row = () => ({ ...raw.prepare('SELECT seq, obj, lease FROM realm_characters WHERE id = ?').get(R.id) });
  const fall = (body, who = ria) => quiet(() => svc.call('/v1/wild/fall', { room: worldRoom(520, 110), ...body }, who.secret));
  const falls = () => raw.prepare('SELECT COUNT(*) AS n FROM wild_falls').get().n;
  const refused = async (body, why, error = 'not-found') => {
    const was = { row: row(), rec: recordOf(svc.env, R.id), falls: falls() };
    const r = await fall(body);
    assert.deepEqual([r.status, r.body.error], [400, error], `${why}: ${JSON.stringify(r.body)}`);
    assert.deepEqual([row(), recordOf(svc.env, R.id), falls()], [was.row, was.rec, was.falls], `${why}: nothing moved`);
  };
  // a death to a foe, asked as a tab from before the word (the wagon's word and no other): refused - PIN MOVED (FOE-KEEPS):
  // as every death to a foe is now, which takes nothing
  await refused({ n: '00112233445566c1', realm: R.at(), cart: 1 }, 'a death to a foe', 'foe');
  // at another's hand: her old tab refused - and past the grace her killer's seizure takes it whole, his pack and the
  // sworn one's pack and kit among it; no game applies a seizure: her tab plays a record that moved under it
  const rc = await mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789c2', w: -1 }, svc.gatePriv, { subtle: globalThis.crypto.subtle, nowS: Math.floor(Date.now() / 1000) - WILD_FALL_GRACE_S - 1 });
  await refused({ receipt: rc, realm: R.at() }, 'at another\'s hand');
  const seized = await fall({ receipt: rc }, bo);
  assert.equal(seized.status, 200, JSON.stringify(seized.body));
  assert.deepEqual([...new Set(seized.body.took.map((x) => x.f))].sort(), ['bag', WILD_PACK.crew(42, s.hand), WILD_PACK.kit(s.a.id), WILD_PACK.sworn(s.a.id)].sort(), 'the packs taken');
  assert.deepEqual(seized.body.gold, { purse: 0, cart: 0, packs: { [WILD_PACK.crew(42, s.hand)]: 30, [WILD_PACK.sworn(s.a.id)]: 10 } });   // PIN MOVED (FOE-KEEPS): a tenth
  assert.equal(row().lease, null, 'the seat taken from her tab: its next join reads the record');
  // her next join, and a death at Borin's hand (PIN MOVED, FOE-KEEPS: it was a foe's) with nothing left to drop but her
  // companions' coin: a take of the packs too - refused the old tab, taken for hers
  await realmJoinAt(svc.env, ria.secret, R.id);
  const twin = recordOf(svc.env, R.id);
  const rc3 = await mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789c3', w: -1 }, svc.gatePriv, { subtle: globalThis.crypto.subtle, nowS: Math.floor(Date.now() / 1000) });
  await refused({ receipt: rc3, realm: R.at(), cart: 1 }, 'his coin alone');
  const coined = await fall({ receipt: rc3, realm: R.at(), ...wildFallWords(false, null, null) });
  assert.equal(coined.status, 200, JSON.stringify(coined.body));
  assert.deepEqual([coined.body.took, coined.body.gold], [[], { purse: 0, cart: 0, packs: { [WILD_PACK.crew(42, s.hand)]: 27, [WILD_PACK.sworn(s.a.id)]: 9 } }], 'no piece: his coin\'s share and its');
  // B5: her game takes it out of its own (the record's twin here), no piece among it - and risen, she is told
  const out = wildTakeTook(twin, coined.body.took, coined.body.gold);
  assert.deepEqual([out, coin(crewOf(twin).items), coin(swornOf(twin, s.a.id).companion.items)], [[], 243, 81]);
  assert.equal(wildTookAny(out, coined.body.gold), true, 'a companion\'s coin alone is said');
  assert.equal(wildTookAny([], { purse: 0, cart: 0 }), false, 'nothing taken, nothing said');
  assert.ok(rd('src/scenes/world.js').includes("    else if (wildTookAny(out, d.gold)) townTalk.say(d.burnt ? zoneWord('burntLate', seaRoomOf(room) ? ETHER_KIND : null)() : zoneWord('dropLate', seaRoomOf(room) ? ETHER_KIND : null));"), 'the risen word asks it');   // PIN MOVED (AUDIT SEA VENTURES C7): the ground's own words
  // a take that touches no pack is that tab's as ever: a fallen with no companion - her bag, her cart and her purse
  const q = { isPlayer: true, name: 'Ilse Varn', characterId: 'char-fb1019f-b2', level: 20, stats: {}, skills: [], career: {}, activeEffects: [], items: [blade(W.Claymore, 1)], goldPieces: 400, health: 100, maxHealth: 100 };
  q.wagonItems = [blade(W.Saber, 1), goldStack(300)];
  const ilse = await svc.registered('Ilse');
  const I = await seatRealm(svc.env, ilse.secret, 'Ilse', JSON.parse(JSON.stringify(snapshotPlayer(q, {}))));
  const rc5 = await mintWildReceipt({ f: ilse.id, c: I.id, k: bo.id, r: '0123456789c5', w: -1 }, svc.gatePriv, { subtle: globalThis.crypto.subtle, nowS: Math.floor(Date.now() / 1000) });
  const plain = await fall({ receipt: rc5, realm: I.at(), cart: 1 }, ilse);
  assert.equal(plain.status, 200, JSON.stringify(plain.body));
  assert.deepEqual([[...new Set(plain.body.took.map((x) => x.f))].sort(), plain.body.gold], [['bag', 'cart'], { purse: 40, cart: 30 }], 'the bag, the cart and the purse, as before the word');
});

test('COMPANION-DROP NO SEND-OFF IN THE ZONE: a hand ashore is never sent back aboard from inside the zone - said in the zone\'s words, he stays ashore with his pack - and is outside it; the sworn one at the side is never sent away nor on an errand there, the one waiting outside the zone is; nothing of mine is given to one waiting outside the zone; the roster says the refusal (mutants: the zone unread at the boat\'s picker; the sworn\'s refusal unread; the errand\'s; the gift\'s; the one outside refused too)', async () => {
  const s = await stand();
  const w = WILD_TEXT.companionStays(s.hand);
  assert.equal(w, `${s.hand} stays at your side until you leave the Wrothgarian Mountains.`);
  setWildHere(true);
  assert.equal(s.h.host.companionPress(s.h.boat, s.hand, 0), null, 'refused');
  assert.equal(s.h.log.say.at(-1), w);
  assert.ok(s.h.host.companions.isAshore(42, s.hand), 'still ashore');
  assert.equal(s.pack.length, 5, 'his pack whole');
  assert.equal(heldAtSide('Bran', null), true);
  // the sworn
  assert.equal(RC.leaveRefusal(s.a), WILD_TEXT.companionStays(s.a.name));
  assert.equal(RC.sendRevenantAway(s.a.id), false, 'the one at the side stays');
  assert.equal(N.revenantById(s.a.id).companion.state, 'with');
  assert.equal(RC.errandRefusal(s.a, DAY * 10), WILD_TEXT.companionStays(s.a.name));
  assert.equal(RC.sendOnErrand(s.a.id, 'Daggerfall', 'plunder'), WILD_TEXT.companionStays(s.a.name));
  assert.equal(RC.leaveRefusal(s.b), null, 'the one waiting outside the zone');
  const gift = blade(W.Broadsword, 0);
  s.p.items.push(gift);
  assert.equal(RC.giveSwornGear(s.c.id, gift), WILD_TEXT.companionAway(s.c.name), 'nothing of mine reaches one outside the zone');
  assert.equal(WILD_TEXT.companionAway(s.c.name), `${s.c.name} is waiting outside the Wrothgarian Mountains. Come out to hand over gear.`);
  assert.ok(s.p.items.includes(gift) && !N.revenantById(s.c.id).companion.gear.weapon, 'the piece still mine');
  assert.equal(RC.sendRevenantAway(s.b.id), true, 'the one outside the zone may go');
  // outside the zone, as ever
  setWildHere(false);
  assert.equal(RC.leaveRefusal(s.a), null);
  assert.equal(RC.giveSwornGear(s.c.id, gift), null);
  assert.equal(RC.sendRevenantAway(s.a.id), true);
  assert.equal(heldAtSide('Bran', null), false);
  assert.equal(s.h.host.companionPress(s.h.boat, s.hand, 0), 'back', 'sent back aboard outside the zone');
  assert.deepEqual(s.h.log.given.at(-1), [5, s.h.boat], 'his pack into her hold');
  // the roster and the slots' hold ask the same law
  const roster = rd('src/ui/companionRoster.js');
  assert.ok(roster.includes('away.onclick = () => { const no = leaveRefusal(r); _notice = no ? { id: r.id, text: no } : null; if (!no) sendRevenantAway(r.id); rerender(); };'));
  assert.ok(rd('src/scenes/world.js').includes('const last = revenantsWithYou().filter((r) => !leaveRefusal(r)).sort((a, b) => (b.swornAt ?? 0) - (a.swornAt ?? 0))[0];'));
  assert.ok(rd('src/scenes/naval/navalHost.js').includes('    if (companions.isAshore(boat.uid, name)) {\n      if (heldAtSide(name, deps.say)) return null;'));
});

test('COMPANION-DROP CARRIED OFF IN THE ZONE: a hand knocked out there gives his pack up into my pack, never her hold - outside it, her hold; the sworn one at the side knocked out there hands me its pack and its kit, said once - outside it, they rest with it (mutants: the hold read in the zone; the hand-over dropped; the kit kept; the words unsaid; the hand-over outside the zone)', async () => {
  const s = await stand();
  const said = [];
  registerPresenter({ hudText: (t) => { said.push(t); return true; } });
  setWildHere(true);
  assert.equal(packStaysAshore(), true);
  const c = s.h.host.companions.party[0];
  s.h.host.companions.knock(42, s.hand, 0);
  s.h.host.companionKnocked(c);
  assert.deepEqual(s.h.log.given.at(-1), [5, null], 'into my pack - past its weight if it must');
  assert.ok(s.h.log.say.at(-1).includes('pack is stowed in your pack'));
  // the sworn one
  const before = s.p.items.length, gold = s.p.goldPieces;
  assert.equal(RC.revenantParty().knock('rv', s.a.id, DAY * 10), true);
  const a = N.revenantById(s.a.id);
  assert.deepEqual([a.companion.state, a.companion.items, a.companion.gear], ['resting', [], {}]);
  assert.equal(s.p.items.length, before + 2, 'its mace and its longsword in my pack');
  assert.ok(s.p.items.includes(s.sword), 'the kit back');
  assert.equal(s.p.goldPieces, gold + 100, 'its gold to my purse');
  assert.deepEqual(said, [WILD_TEXT.companionLeft(s.a.name, 3)]);
  assert.equal(said[0], `${s.a.name} hands you 3 items before leaving.`);
  // outside the zone: his mate knocked out, and the sworn one walking with me
  setWildHere(false);
  assert.equal(packStaysAshore(), false);
  const mate = s.h.host.crewOf(s.h.boat).hands[1].name;
  assert.equal(s.h.host.companionPress(s.h.boat, mate, 0), 'take');
  s.h.host.companionPack(`42:${mate}`).items.push(blade(W.Flail, 1));
  const m = s.h.host.companions.party.find((x) => x.name === mate);
  s.h.host.companions.knock(42, mate, 0);
  s.h.host.companionKnocked(m);
  assert.deepEqual(s.h.log.given.at(-1), [1, s.h.boat], 'her hold');
  const kit = blade(W.Shortsword, 0);
  s.p.items.push(kit);
  assert.equal(RC.giveSwornGear(s.b.id, kit), null);
  assert.equal(RC.revenantParty().knock('rv', s.b.id, DAY * 10), true);
  assert.deepEqual(kinds(N.revenantById(s.b.id).companion.items), [W.Dagger], 'it rests with its pack');
  assert.equal(N.revenantById(s.b.id).companion.gear.weapon, kit, 'and its kit');
  assert.equal(said.length, 1, 'said once, in the zone alone');
});

test('COMPANION-DROP CARRIED OFF EMPTY-HANDED (AUDIT FB1019f B4): the sworn one at the side knocked out in the zone with nothing in its pack and no kit hands nothing over, and nothing is said - never "hands you 0 items" (mutants: an empty hand-over said)', async () => {
  const s = await stand();
  // the first walking with her sent away before the zone; the second, its dagger taken back out of its pack, at her side
  assert.equal(RC.sendRevenantAway(s.a.id), true);
  assert.equal(RC.revenantParty().packOf(s.b.id).splice(0).length, 1, 'its dagger out of its pack');
  const said = [];
  registerPresenter({ hudText: (t) => { said.push(t); return true; } });
  setWildHere(true);
  assert.deepEqual(RC.swornAtYourSide().map((r) => r.id), [s.b.id], 'the one at her side, carrying nothing');
  assert.deepEqual([N.revenantById(s.b.id).companion.items, N.revenantById(s.b.id).companion.gear ?? {}], [[], {}]);
  const items = s.p.items.length, gold = s.p.goldPieces;
  assert.equal(RC.revenantParty().knock('rv', s.b.id, DAY * 10), true);
  assert.equal(N.revenantById(s.b.id).companion.state, 'resting', 'carried off');
  assert.deepEqual([s.p.items.length, s.p.goldPieces, said], [items, gold, []], 'nothing handed over, nothing said');
});
