// STORE-KEEPS (2026-10-26, the owner: "Make it where you cant lose your wagon/horse or anything stored on death"; asked,
// "Wagon + companions' packs") - THE CART IS STORAGE, AND NO DEATH TAKES IT. FIELD BUGS 2026-10-15d CART-AWAY (Mac: "if
// its parked outside the zone nothing should be lost") had the cart's cargo and a share of its coin taken while the wagon
// was WITH the fallen - driven, beside them, following, or parked on the zone's own ground - and the fallen's tab say when
// it was away. STORE-KEEPS retired that word: a death in the zone takes the bag and the purse alone
// (systems/wild/wildDropLaw.js takeWildDeath, taken by the account service off the record - server-account/src/wild.js),
// whatever the wagon does and wherever it stands, and whatever a tab says. Every record here is the game's own: the
// wagon's out of the real Horse Cart and Cargo runtime (test/hccWorld.mjs), the pack the starting kit and the producers'
// pieces, the record as the save writes it; the zone's mask over the blob the zone's own pins stand
// (test/systems/pvpdungeons_game.test.js) - WW-C2: a cell a pixel, as buildWildMask lays one (Cyrodiil's own:
// test/world/worldWide/wwc2_zone.test.js). bible/11-Multiplayer/Wild-Zone.md section 4.
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
import { equipItem, isEquipped, unequipItem } from '../../src/systems/equip.js';
import { snapshotPlayer } from '../../src/systems/save/save.js';
import { stampItemIds } from '../../src/systems/item/itemIds.js';
import { addItem, goldStack } from '../../src/systems/inventory.js';
import '../../src/systems/item/itemLaw.js';   // the item law registers itself with the wire, as the game's boot does
import { takeWildDeath, wildDropCandidates, takeWildGold, wildTakeTook, wornOffer, wildFallWords } from '../../src/systems/wild/wildDeath.js';
import { WAGON_MODE, HCC_VENDOR, TRANSPORT } from '../../src/systems/horse/horseCartLaw.js';
import { buildWildMask, wildInside, wildNear } from '../../src/systems/wild/wildZone.js';
import { worldCoordToMapPixel } from '../../src/world/streamingWorld.js';
import { mintWildReceipt, WILD_FALL_GRACE_S } from '../../src/net/wild/wildReceipt.js';
import { worldRoom } from '../../src/net/wire.js';
import { hostText } from '../hostText.mjs';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const CELL = worldRoom(520, 110);
const nowS = () => Math.floor(Date.now() / 1000);
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };

// ─── THE ZONE, as every client's maps paint it ──────────────────────────────────────────────────────────────────

/** The zone's pins' blob (PIN MOVED, WW-C2: the zone a mask's cells - the Wrothgarian region and the owner's cut retired). */
const blob = (x, y) => { const dx = (x - 520) / 38, dy = (y - 110) / 24; return dx * dx + dy * dy + 0.15 * Math.sin(x / 5) < 1; };
const mask = buildWildMask({ width: 1000, height: 500, inZone: blob });
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
  for (const it of [...e.items]) if (isEquipped(it)) unequipItem(e, it);   // PIN MOVED (PVP-REWARD): the axe her one worn piece, the roll's
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

/** Every way a wagon stands, as play makes it - the zone's ground and off it, with them and away. */
const EVERY_WAGON = () => [
  ['driven', WAGON.driven()], ['following', WAGON.following()], ['beside them unstabled', WAGON.beside()],
  ['parked on the zone\'s ground', WAGON.parked(PIXELS.heart)], ['parked in the band about it', WAGON.parked(PIXELS.band)],
  ['parked far off the zone', WAGON.parked(PIXELS.far)], ['stabled', WAGON.stabled()], ['none', WAGON.none()],
];

test('STORE-KEEPS THE LAW (systems/wild/wildDropLaw.js takeWildDeath, wildDropCandidates, takeWildGold): over the record of every way a wagon stands - driven, following, beside, parked on the zone\'s ground or off it, stabled, none - a death in the zone takes the bag and a tenth of the purse, and nothing of the cart: every piece and the whole gold stack stay; the candidates the ledger is asked of are the bag\'s alone (mutants: the cart lifted again; its coin\'s share taken; the candidates keeping the cart)', () => {
  assert.ok(wildInside(mask, PIXELS.heart.x, PIXELS.heart.y) && !wildInside(mask, PIXELS.band.x, PIXELS.band.y) && wildNear(mask, PIXELS.band.x, PIXELS.band.y), 'the fixture: the heart is the zone, the band only near it');
  const kinds = (list) => list.map((i) => i.templateIndex);
  const { e: c } = pack();
  const bag = kinds(wildDropCandidates(c, -1));
  assert.ok(bag.includes(LONGSWORD) && bag.length > 1, 'the bag\'s drop: the Magic longsword and the kit\'s spare pieces');
  assert.ok(!bag.includes(CLAYMORE) && !bag.includes(SHORTSWORD), 'never the cart\'s');
  for (const [name, wagon] of EVERY_WAGON()) {
    const rec = recordOf(pack().e, wagon);
    assert.deepEqual([cargo(rec.wagonItems), coinOf(rec.wagonItems)], [[CLAYMORE, SHORTSWORD], 400], `${name}: the fixture`);
    const d = takeWildDeath(rec, -1);
    assert.deepEqual(d.from, ['gold', ...bag.map(() => 'bag')], `${name}: the purse's share, then the bag's drop - no cart`);
    assert.deepEqual(kinds(d.taken.slice(1)).sort(), [...bag].sort(), name);
    assert.deepEqual(d.gold, { purse: 40 }, `${name}: a tenth of the purse alone`);
    assert.equal(d.taken[1].templateIndex, LONGSWORD, `${name}: the Magic longsword first, by its worth`);
    assert.equal(rec.goldPieces, 360, name);
    assert.deepEqual([cargo(rec.wagonItems), coinOf(rec.wagonItems)], [[CLAYMORE, SHORTSWORD], 400], `${name}: "cant lose your wagon ... or anything stored" - every piece and the whole stack`);
    assert.deepEqual(dropsOf(rec).filter((t) => bag.includes(t)), [], `${name}: the bag still drops`);
  }
  // the gold alone
  const { e: g } = pack();
  assert.equal(takeWildGold(g).stackCount, 40, 'the purse\'s tenth');
  assert.deepEqual([g.goldPieces, coinOf(g.wagonItems)], [360, 400], 'the cart\'s coin untouched');
});

test('STORE-KEEPS THE CLIENT\'S WORDS: the fallen\'s ask says nothing of the wagon - CART-AWAY\'s word retired with the drop it shaped; the words left are the packs\' (an answer from before the word may still name one) and the letters\' (mutants: the wagon\'s word back)', () => {
  assert.deepEqual(wildFallWords(), { packs: 1, letters: 1 });
  const w = hostText('src/scenes/world.js');
  assert.ok(w.includes('call: (at) => wildAccount.fall({ receipt: rc, realm: at, room: lay, ...(host.online?.wildCollectAt?.(lay) ? { collect: 1 } : {}), ...wildFallWords() }),'), 'my drop names no wagon');
  assert.ok(!w.includes('hccRuntime.getSaveData(), cyrodiilMask()'), 'nor reads where it stands');   // WW-C2: the zone's mask, Cyrodiil's
  assert.ok(rd('src/scenes/wildSeizeHost.js').includes('wildAccount\n        .fall({ receipt: s.rc, room: s.room, ...(host.online?.wildCollectAt?.(s.room) ? { collect: 1 } : {}) })\n        .then('), 'a seizure says nothing of another\'s wagon');
  assert.ok(!rd('server-account/src/wild.js').includes('body?.cart'), 'the service reads no word of the wagon');
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

test('STORE-KEEPS THROUGH THE SERVICE: at another\'s hand, the cart keeps every piece and its whole gold stack in every way a wagon stands - whatever the fallen\'s tab says of it (`cart` 0, 1, or nothing, as a tab from before the word says) - while the killer\'s worn piece, the bag and a tenth of the purse still go; and the fallen\'s game takes out exactly that (mutants: the cart taken again; its coin\'s share taken)', async () => {
  const words = [{ cart: 0 }, { cart: 1 }, {}];
  let i = 0;
  for (const [name, wagon] of EVERY_WAGON()) {
    const p = await stood(wagon);
    const word = words[i++ % words.length];
    const res = await p.fall({ receipt: await p.receipt(), realm: p.R.at(), ...word });
    assert.equal(res.status, 200, `${name}: ${JSON.stringify(res.body)}`);
    const d = res.body;
    assert.deepEqual(d.took[0].t, BATTLE_AXE, `${name}: the killer's worn axe first`);
    assert.ok(!d.took.some((x) => x.t === LONGSWORD), `${name}: the bag's Magic longsword kept`);   // PIN MOVED (PVP-REWARD): no bag drop
    assert.deepEqual([...new Set(d.took.map((x) => x.f))], ['bag'], `${name}: nothing of the cart`);
    assert.deepEqual(d.gold, { purse: 0, cart: 0 }, name);   // PIN MOVED (PVP-NO-TENTH): no tenth of the purse
    assert.ok(!d.items.some((it) => it.templateIndex === CLAYMORE || it.templateIndex === SHORTSWORD), `${name}: no cargo in the remains`);
    assert.deepEqual(kept(p.record()), WHOLE, `${name}: the record's cart whole`);
    assert.equal(p.record().goldPieces, 400, `${name}: the purse whole`);
    const live = p.e;
    wildTakeTook(live, d.took, d.gold);
    assert.deepEqual([kept(live), live.goldPieces, dropsOf(live).includes(LONGSWORD)], [WHOLE, 400, true], `${name}: the game's own pack the same`);   // PIN MOVED (PVP-REWARD)
  }
});

test('STORE-KEEPS THROUGH THE SERVICE, A SEIZURE: the killer carrying the fall past WILD_FALL_GRACE_S takes no cart either - CART-AWAY\'s seizure took it whatever was said (mutants: a seizure taking the cart)', async () => {
  const k = await stood(WAGON.driven());
  const rc = await k.receipt({ nowS: nowS() - WILD_FALL_GRACE_S - 1 });
  const seized = await k.fall({ receipt: rc }, k.bo);
  assert.equal(seized.status, 200, JSON.stringify(seized.body));
  assert.deepEqual(seized.body.gold, { purse: 0, cart: 0 }, 'no gold at all');   // PIN MOVED (PVP-NO-TENTH)
  assert.deepEqual(kept(k.record()), WHOLE, 'the cart whole');
});
