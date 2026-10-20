// FIELD BUGS 2026-10-15d CART-AWAY (Mac, 2026-10-15, asked "If parked outside of the pvp zone in the wrothgarian
// mountains, can it be lost?": "Yeah, if its parked outside the zone nothing should be lost"). A death in the open zone
// dropped every piece in the cart and half its gold wherever the wagon stood (systems/wild/wildDropLaw.js takeWildDeath,
// taken by the account service off the record - server-account/src/wild.js). Now the cart's share is taken only while the
// wagon is WITH the fallen: driven, beside them on foot (the mod's WithPlayer, which its next door parks), following, or
// parked on the zone's own ground. Parked off the zone, stabled (WAGON-STABLED) or none, it keeps every piece and its
// coin. The zone's mask is the map files', which the service does not hold: the fallen's own tab SAYS its wagon is away
// (`cart` 0 - systems/wild/wildCart.js wildCartAway), and the service honours the word only where the record it keeps agrees
// by its mode (wildDropLaw.js wildCartMayBeAway). Every record here is the game's own: the wagon's out of the real Horse
// Cart and Cargo runtime (test/hccWorld.mjs), the pack the starting kit and the producers' pieces, the record as the save
// writes it; the zone wildMaskOf over the minimal map file the zone's own pins stand (test/systems/pvpdungeons_game.test.js).
// bible/11-Multiplayer/Wild-Zone.md section 4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { seeded } from '../honestItems.mjs';
import { makeWorld, RATIO, WX0, WZ0 } from '../hccWorld.mjs';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { assignStartingGear } from '../../src/systems/startingGear.js';
import { equipItem, isEquipped } from '../../src/systems/equip.js';
import { snapshotPlayer } from '../../src/systems/save/save.js';
import { stampItemIds } from '../../src/systems/item/itemIds.js';
import { addItem, goldStack } from '../../src/systems/inventory.js';
import '../../src/systems/item/itemLaw.js';   // the item law registers itself with the wire, as the game's boot does
import { takeWildDeath, wildDropCandidates, takeWildGold, wildTakeTook, wornOffer, wildCartRecordOf, wildCartMayBeAway } from '../../src/systems/wild/wildDeath.js';
import { wildCartAway, wildCartWord } from '../../src/systems/wild/wildCart.js';
import { WAGON_MODE, HCC_VENDOR, TRANSPORT } from '../../src/systems/horse/horseCartLaw.js';
import { WILD_REGION, wildMaskOf, wildInside, wildNear } from '../../src/systems/wild/wildZone.js';
import { worldCoordToMapPixel } from '../../src/world/streamingWorld.js';
import { mintWildReceipt, WILD_FALL_GRACE_S } from '../../src/net/wild/wildReceipt.js';
import { worldRoom } from '../../src/net/wire.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const CELL = worldRoom(520, 110);
const nowS = () => Math.floor(Date.now() / 1000);
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };

// ─── THE ZONE, as every client's maps paint it ──────────────────────────────────────────────────────────────────

/** The minimal map file of the zone's pins: region 16 a blob, the owner's cut over it (wildMaskOf's own WILD_CUT). */
const blob = (x, y) => { const dx = (x - 520) / 38, dy = (y - 110) / 24; return dx * dx + dy * dy + 0.15 * Math.sin(x / 5) < 1; };
const maps = { getRegionIndexAt: (x, y) => (blob(x, y) ? WILD_REGION : 3), getLocationByName: () => null };
const mask = wildMaskOf(maps);
/** Three map pixels: the zone's heart, its band (near the zone, not in it - the maps' hiding), and far off it. */
const PIXELS = (() => {
  let heart = null, band = null;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      const i = y * mask.width + x;
      if (mask.inside[i] && (!heart || mask.depth[i] > mask.depth[heart.y * mask.width + heart.x])) heart = { x, y };
      if (!band && mask.near[i] && !mask.inside[i]) band = { x, y };
    }
  }
  return { heart, band, far: { x: 300, y: 300 } };
})();

// ─── THE WAGON, as Horse Cart and Cargo records it ──────────────────────────────────────────────────────────────

/** The record the save carries (systems/horse/horseCart.js getSaveData - world.js's modData), as JSON. */
const saved = (h) => JSON.parse(JSON.stringify(h.rt.getSaveData()));
/** The scene point whose world coordinates stand at the middle of map pixel `px` (hccWorld's own frame). */
const sceneAt = (px) => [(px.x * 32768 + 16384 - WX0) / RATIO, 0.9, ((499 - px.y) * 32768 + 16384 - WZ0) / RATIO];
/** EACH MODE AS PLAY MAKES IT, out of the real runtime. */
const WAGON = {
  /** bought and on foot beside it - the mod's WithPlayer, which its next door parks outside */
  beside: () => { const h = makeWorld(); h.step(); return saved(h); },
  /** sent to the stable (HOLDINGS' Send away - WAGON-STABLED) */
  stabled: () => { const h = makeWorld(); h.step(); assert.equal(h.rt.sendTransportAway().ok, true); h.step(); return saved(h); },
  /** driven */
  driven: () => { const h = makeWorld(); h.step(); assert.equal(h.rt.tryUseTransport(TRANSPORT.Cart).succeeded, true); h.step(); h.walk(10); return saved(h); },
  /** the hitched team called to follow - the rise's own call (WILD1's forced journey) */
  following: () => { const h = makeWorld(); h.step(); h.rt.summonTransport(); h.step(5); h.rt.forceNextFastTravel(); h.rt.handlePreFastTravel(); return saved(h); },
  /** no wagon owned */
  none: () => { const h = makeWorld({ cart: false }); h.step(); return saved(h); },
  /** summoned where the player stands on map pixel `px`, and left there */
  parked: (px) => {
    const h = makeWorld(); h.step();
    h.w.pos = sceneAt(px); h.step();
    assert.equal(h.rt.summonTransport().ok, true); h.step();
    const rec = saved(h), at = worldCoordToMapPixel(rec.WorldX, rec.WorldZ);
    assert.deepEqual([rec.Mode, at.x, at.y], [WAGON_MODE.Deployed, px.x, px.y], 'parked on the pixel asked');
    return rec;
  },
};

// ─── THE FALLEN, as the game makes them ─────────────────────────────────────────────────────────────────────────

const LONGSWORD = 120, CLAYMORE = 122, BATTLE_AXE = 127, SHORTSWORD = 116, STEEL = 3, IRON = 1;
/** Riadne's pack: the starting kit, a Magic longsword carried in the bag, a battle axe worn, and in the cart a claymore,
 *  a shortsword and 400 gold; 400 in her purse. Ids stamped as the realm checkpoint stamps them. */
function pack() {
  const e = { name: 'Riadne', gender: 'female', level: 9, items: [], wagonItems: [], goldPieces: 400 };
  assignStartingGear(e, { classIndex: 16, rolls: seeded(3) });
  e.goldPieces = 400;   // after the kit's own purse
  const sword = applyRarity(createWeapon(LONGSWORD, STEEL, seeded(7)), 'magic', seeded(8));
  e.items.push(sword);
  const axe = createWeapon(BATTLE_AXE, IRON, seeded(9));
  e.items.push(axe);
  assert.notEqual(equipItem(e, axe), null);
  e.wagonItems.push(createWeapon(CLAYMORE, STEEL, seeded(10)), createWeapon(SHORTSWORD, IRON, seeded(11)));
  addItem(e.wagonItems, goldStack(400));
  stampItemIds(e);
  return { e, sword, axe };
}
/** The record as the save writes it - the wagon's beside it in its modData. */
const recordOf = (e, wagon) => JSON.parse(JSON.stringify(snapshotPlayer(e, { modData: { [HCC_VENDOR]: wagon } })));
const coinOf = (list) => list.find((i) => i?.group === 'Currency')?.stackCount ?? 0;
const cargo = (list) => list.filter((i) => i.group !== 'Currency').map((i) => i.templateIndex);
const dropsOf = (e) => e.items.filter((it) => !isEquipped(it)).map((i) => i.templateIndex);

test('CART-AWAY THE LAW (systems/wild/wildDropLaw.js takeWildDeath, wildDropCandidates, takeWildGold): with `cart` false a death in the zone takes nothing of the cart - every piece and the whole gold stack stay - while the bag still drops and the purse still halves; by default the cart drops as it always has; the candidates the ledger is asked of are the same (mutants: the option ignored in takeWildDeath; the gold share still taken; the candidates keeping the cart; takeWildGold\'s option ignored)', () => {
  const { e, sword } = pack();
  const away = recordOf(e, WAGON.stabled()), wth = recordOf(e, WAGON.driven());
  const kinds = (list) => list.map((i) => i.templateIndex);
  const bag = kinds(wildDropCandidates(away, -1, null, { cart: false }));
  assert.ok(bag.includes(LONGSWORD) && bag.length > 1, 'the bag\'s drop: the Magic longsword and the kit\'s spare pieces');
  assert.deepEqual([cargo(away.wagonItems), coinOf(away.wagonItems)], [[CLAYMORE, SHORTSWORD], 400]);
  // away: the bag's drop and half the purse, nothing of the cart
  const a = takeWildDeath(away, -1, () => false, null, { cart: false });
  assert.deepEqual(a.from, ['gold', ...bag.map(() => 'bag')], 'the purse\'s share, then the bag\'s drop - no cart');
  assert.deepEqual(kinds(a.taken.slice(1)).sort(), [...bag].sort());
  assert.deepEqual(a.gold, { purse: 200, cart: 0 });
  assert.equal(a.taken[0].stackCount, 200, 'one pile: the purse\'s share alone');
  assert.equal(a.taken[1].uid, sword.uid, 'the Magic longsword first, by its worth');
  assert.equal(away.goldPieces, 200, 'the purse halved');
  assert.deepEqual([cargo(away.wagonItems), coinOf(away.wagonItems)], [[CLAYMORE, SHORTSWORD], 400], '"nothing should be lost": every piece and the whole stack');
  assert.deepEqual(dropsOf(away).filter((t) => bag.includes(t)), [], 'the bag still drops');
  // with them: the cart's pieces and half its coin, as ever
  const w = takeWildDeath(wth, -1);
  assert.deepEqual([...new Set(w.from)].sort(), ['bag', 'cart', 'gold']);
  assert.deepEqual(w.gold, { purse: 200, cart: 200 });
  assert.deepEqual([cargo(wth.wagonItems), coinOf(wth.wagonItems)], [[], 200], 'the cart loses its loot and half its gold');
  // the ledger's candidates: the cart's only while it is with them
  const { e: c } = pack();
  assert.deepEqual(kinds(wildDropCandidates(c, -1, null, { cart: false })), bag);
  assert.deepEqual(kinds(wildDropCandidates(c, -1)), [...bag, CLAYMORE, SHORTSWORD], 'by default the cart\'s too');
  assert.deepEqual(kinds(wildDropCandidates(c, -1, null, { cart: true })), kinds(wildDropCandidates(c, -1)));
  // the gold alone
  const { e: g } = pack();
  assert.equal(takeWildGold(g, { cart: false }).stackCount, 200);
  assert.deepEqual([g.goldPieces, coinOf(g.wagonItems)], [200, 400]);
  assert.equal(takeWildGold(g).stackCount, 100 + 200, 'by default the cart\'s share too');
});

test('CART-AWAY THE SERVICE\'S CHECK (wildDropLaw.js wildCartMayBeAway over the record\'s own wagon, wildCartRecordOf): parked, stabled or none MAY be away; driven, following and beside them unstabled never; no record says nothing (mutants: stabled not read as away; beside read as away; parked not away; none not away)', () => {
  const may = (rec) => wildCartMayBeAway(wildCartRecordOf(recordOf(pack().e, rec)));
  assert.equal(may(WAGON.parked(PIXELS.far)), true, 'parked');
  assert.equal(may(WAGON.parked(PIXELS.heart)), true, 'parked - where, only the mask says');
  assert.equal(may(WAGON.stabled()), true, 'stabled');
  assert.equal(may(WAGON.none()), true, 'no wagon');
  assert.equal(may(WAGON.driven()), false, 'driven');
  assert.equal(may(WAGON.following()), false, 'following');
  assert.equal(may(WAGON.beside()), false, 'beside them on foot, never sent away - the next door parks it there');
  assert.equal(wildCartRecordOf({ modData: null }), null);
  assert.equal(wildCartMayBeAway(null), false, 'no record: never');
});

test('CART-AWAY THE CLIENT\'S WORD (systems/wild/wildCart.js wildCartAway / wildCartWord) over the runtime\'s records and the zone\'s own mask: away when stabled, none, or parked off the zone - its band included, which is no part of the zone - and with them when driven, following, beside them, or parked on the zone\'s ground, and wherever the mask cannot say; with the mod off the cart is Daggerfall\'s own, with them (mutants: the Deployed-inside case read as away; the band read as the zone; the mask unread; the mod\'s switch unread)', () => {
  assert.ok(wildInside(mask, PIXELS.heart.x, PIXELS.heart.y) && !wildInside(mask, PIXELS.band.x, PIXELS.band.y) && wildNear(mask, PIXELS.band.x, PIXELS.band.y), 'the fixture: the heart is the zone, the band only near it');
  assert.ok(!wildNear(mask, PIXELS.far.x, PIXELS.far.y), 'and the far pixel neither');
  const cases = [
    ['stabled', WAGON.stabled(), true], ['none', WAGON.none(), true],
    ['parked far off the zone', WAGON.parked(PIXELS.far), true], ['parked in the band about it', WAGON.parked(PIXELS.band), true],
    ['parked on the zone\'s ground', WAGON.parked(PIXELS.heart), false],
    ['driven', WAGON.driven(), false], ['following', WAGON.following(), false], ['beside them unstabled', WAGON.beside(), false],
  ];
  for (const [name, rec, away] of cases) {
    assert.equal(wildCartAway(rec, mask), away, name);
    assert.deepEqual(wildCartWord(true, rec, mask), { cart: away ? 0 : 1 }, `${name}: the word`);
  }
  assert.equal(wildCartAway(WAGON.parked(PIXELS.far), null), false, 'no mask: nothing can be said of a parked wagon');
  assert.equal(wildCartAway(null, mask), false, 'no record: nothing said');
  assert.deepEqual(wildCartWord(false, WAGON.stabled(), mask), { cart: 1 }, 'the mod off: the cart goes where its owner goes');
  // the host: the fallen's own ask carries the word, over the runtime's record and the zone's mask; the seizure none
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes('...(online?.wildCollectAt?.(lay) ? { collect: 1 } : {}), ...wildFallWords(hccOn(), hccRuntime.getSaveData(), wildMaskOf(maps)) }),'), 'my drop says where my wagon is');   // PIN MOVED (AUDIT FB1019f B2): the words through wildFallWords (systems/wild/wildDeath.js) - the wagon's and COMPANION-DROP's `packs` (test/systems/fb1019f_companiondrop.test.js)
  assert.ok(w.includes("wildFallWords, wildTookAny } from '../systems/wild/wildDeath.js';"));
  assert.ok(rd('src/systems/wild/wildDeath.js').includes('export const wildFallWords = (on, rec, mask) => ({ ...wildCartWord(on, rec, mask), packs: WILD_FALL_PACKS });'), 'the wagon\'s word among them');
  assert.ok(w.includes('wildAccount.fall({ receipt: s.rc, room: s.room, ...(online?.wildCollectAt?.(s.room) ? { collect: 1 } : {}) }).then('), 'a seizure says nothing of another\'s wagon');
});

// ─── THE ACCOUNT SERVICE, the whole act ─────────────────────────────────────────────────────────────────────────

/** Riadne's realm character, her record the game's own with `wagon` in its modData, and Borin, her killer. */
async function stood(wagon) {
  const svc = await standService();
  const ria = await svc.registered('Riadne'), bo = await svc.registered('Borin');
  const { e, sword, axe } = pack();
  const R = await seatRealm(svc.env, ria.secret, 'Riadne', recordOf(e, wagon));
  const record = () => JSON.parse(new TextDecoder().decode(svc.env.SAVES._map.get(svc.env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id).obj)));
  const receipt = async (o = {}) => mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789ab', w: wornOffer(e.items).indexOf(axe), wt: [BATTLE_AXE, axe.material ?? 0], ...o }, svc.gatePriv, { subtle, nowS: o.nowS ?? nowS() });
  const fall = (body, who = ria) => quiet(() => svc.call('/v1/wild/fall', { room: CELL, ...body }, who.secret));
  return { svc, ria, bo, R, e, sword, axe, record, receipt, fall };
}
const kept = (rec) => [cargo(rec.wagonItems), coinOf(rec.wagonItems)];
const WHOLE = [[CLAYMORE, SHORTSWORD], 400];

test('CART-AWAY THROUGH THE SERVICE, THE FALLEN\'S OWN WORD: at another\'s hand and to a foe, a wagon parked off the zone or stabled keeps every piece and its whole gold stack - the killer\'s worn piece, the bag and half the purse still go - and the fallen\'s game takes out exactly that; a wagon parked on the zone\'s ground, its word `cart` 1, loses its cargo as ever (mutants: the word unread; the option ignored; the gold share still taken)', async () => {
  // at another's hand, parked off the zone - the word the game says (wildCartWord over its record and the mask)
  const p = await stood(WAGON.parked(PIXELS.far));
  const word = wildCartWord(true, wildCartRecordOf(p.record()), mask);
  assert.deepEqual(word, { cart: 0 });
  const res = await p.fall({ receipt: await p.receipt(), realm: p.R.at(), ...word });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body;
  assert.deepEqual(d.took[0].t, BATTLE_AXE, 'the killer\'s worn axe first');
  assert.ok(d.took.some((x) => x.t === LONGSWORD), 'the bag\'s Magic longsword');
  assert.deepEqual([...new Set(d.took.map((x) => x.f))], ['bag'], 'nothing of the cart');
  assert.deepEqual(d.gold, { purse: 200, cart: 0 });
  assert.equal(d.items.find((i) => i.group === 'Currency').stackCount, 200, 'the remains\' gold: the purse\'s half alone');
  assert.ok(!d.items.some((i) => i.templateIndex === CLAYMORE || i.templateIndex === SHORTSWORD), 'no cargo in the remains');
  assert.deepEqual(kept(p.record()), WHOLE, 'the record\'s cart whole');
  assert.equal(p.record().goldPieces, 200, 'the purse halved');
  // the fallen's game takes out exactly what the service took (world.js wildDropTaken): its cart stays whole
  const live = p.e;
  wildTakeTook(live, d.took, d.gold);
  assert.deepEqual([kept(live), live.goldPieces, dropsOf(live).includes(LONGSWORD)], [WHOLE, 200, false]);
  // to a foe, stabled
  const s = await stood(WAGON.stabled());
  const sw = wildCartWord(true, wildCartRecordOf(s.record()), mask);
  const sd = (await s.fall({ n: '00112233445566aa', realm: s.R.at(), ...sw })).body;
  assert.deepEqual([sw, sd.gold, [...new Set(sd.took.map((x) => x.f))]], [{ cart: 0 }, { purse: 200, cart: 0 }, ['bag']]);
  assert.deepEqual(kept(s.record()), WHOLE);
  // parked on the zone's ground: the game's word says so, and the cart is lost as ever
  const h = await stood(WAGON.parked(PIXELS.heart));
  const hw = wildCartWord(true, wildCartRecordOf(h.record()), mask);
  assert.deepEqual(hw, { cart: 1 });
  const hd = (await h.fall({ n: '00112233445566ab', realm: h.R.at(), ...hw })).body;
  assert.deepEqual(hd.gold, { purse: 200, cart: 200 });
  assert.deepEqual(kept(h.record()), [[], 200], '"it also loses all loot in it"');
});

test('CART-AWAY THROUGH THE SERVICE, THE WORD CHECKED: a tab that says its wagon is away while its own record says it drives it, leads it or stands beside it loses the cargo - the service reads the record\'s mode, never the tab\'s word alone; a tab that says nothing (one from before the word) loses it wherever the wagon stands (mutants: the record\'s check removed; the word unread)', async () => {
  for (const [name, wagon] of [['driven', WAGON.driven()], ['following', WAGON.following()], ['beside them unstabled', WAGON.beside()]]) {
    const z = await stood(wagon);
    const d = (await z.fall({ n: '00112233445566ac', realm: z.R.at(), cart: 0 })).body;
    assert.deepEqual(d.gold, { purse: 200, cart: 200 }, `${name}: the word refused`);
    assert.deepEqual(kept(z.record()), [[], 200], `${name}: the cart lost`);
  }
  const old = await stood(WAGON.parked(PIXELS.far));
  const d = (await old.fall({ n: '00112233445566ad', realm: old.R.at() })).body;
  assert.deepEqual(d.gold, { purse: 200, cart: 200 }, 'no word: the cart taken, as before the word');
  assert.deepEqual(kept(old.record()), [[], 200]);
});

test('CART-AWAY THROUGH THE SERVICE, ONCE A FALL: asked again, a fall answers its first take whatever is said - the cart kept stays kept, the cart taken stays taken, the record moved once; a seizure (the killer past WILD_FALL_GRACE_S) honours no word of the wagon, its carrier holding neither the record nor the mask - but the fallen\'s own earlier ask is the fall, and the seizure is answered it (mutants: a seizure honouring the word)', async () => {
  const z = await stood(WAGON.stabled());
  const first = (await z.fall({ n: '00112233445566ae', realm: z.R.at(), cart: 0 })).body;
  const seq = z.R.at().seq;
  const again = (await z.fall({ n: '00112233445566ae', realm: z.R.at() })).body;
  assert.deepEqual([again.r, again.items, again.took, again.gold], [first.r, first.items, first.took, first.gold], 'the same answer');
  assert.deepEqual([z.R.at().seq, kept(z.record())], [seq, WHOLE], 'nothing moved twice');
  const t = await stood(WAGON.stabled());
  const took = (await t.fall({ n: '00112233445566af', realm: t.R.at() })).body;
  const late = (await t.fall({ n: '00112233445566af', realm: t.R.at(), cart: 0 })).body;
  assert.deepEqual([late.took, late.gold], [took.took, took.gold], 'a word said late is no second take');
  assert.deepEqual(kept(t.record()), [[], 200]);
  // the seizure: the killer's ask once the grace is gone
  const k = await stood(WAGON.stabled());
  const rc = await k.receipt({ nowS: nowS() - WILD_FALL_GRACE_S - 1 });
  const seized = await k.fall({ receipt: rc, cart: 0 }, k.bo);
  assert.equal(seized.status, 200, JSON.stringify(seized.body));
  assert.deepEqual(seized.body.gold, { purse: 200, cart: 200 }, 'a seizure takes the cart');
  assert.deepEqual(kept(k.record()), [[], 200]);
  // the fallen asked first, its wagon away: the seizure is answered that fall
  const f = await stood(WAGON.stabled());
  const frc = await f.receipt({ nowS: nowS() - WILD_FALL_GRACE_S - 1 });
  const own = (await f.fall({ receipt: frc, realm: f.R.at(), cart: 0 })).body;
  const after = await f.fall({ receipt: frc }, f.bo);
  assert.equal(after.status, 200, JSON.stringify(after.body));
  assert.deepEqual([after.body.took, after.body.gold], [own.took, own.gold]);
  assert.deepEqual(kept(f.record()), WHOLE, 'the cart kept');
});
