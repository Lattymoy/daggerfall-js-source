import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CAMPS_PER_OWNER, CAMP_KIND, CAMP_TEXT, placeCampItem, strikeCamp, newCamp, campWire, validCampRecord } from '../../../src/systems/survival/camp.js';
import { createCamps } from '../../../src/scenes/camps.js';
import { createSurvivalItem, isCampingEquipment, isCampfireKit, SURVIVAL_USE_TEXT } from '../../../src/systems/survival/items.js';
import { TEMPLATE } from '../../../src/systems/survival/food.js';
import { createRestItem, REST_ITEM, REST_ITEM_TEXT } from '../../../src/systems/rest/restItems.js';
import { setWorldMinutes, setSharedClock } from '../../../src/systems/worldTick.js';
import { _resetForTests } from '../../../src/systems/uiPrefs.js';

// ═══ FIELD BUGS 2026-10-04d CAMP-CAP: THE CAP STRIKES THE OLDEST ══════
//
// Discord, 2026-10-04, several players: "Placing 5 or so tents around the
// world and leaving them behind means I can no longer place any new tents
// or campfires at all", "Keep getting this message on my character: 'You
// have enough camps standing already.' I'm completely locked out of
// camping anywhere and am effectively bricked on this character."
//
// The world host's pool holds every camp of the player's wherever it
// stands (the streaming sweep spares them, AUDIT SURV B), the save carries
// them all and a load stands them all as the player's own, and no camp
// burns away (REST2) - so four left anywhere refused every placing after
// them (survival/camp.js placeCampItem's `standing >= CAMPS_PER_OWNER`),
// and only a walk back to one undid it. A placing at the cap now stands
// and strikes the oldest where it stands, its gear home as the menu's Pack
// gives it. The fixtures are the producers': the items minted, the camps
// placed through the pool, the save its snapshot, the words its
// wireRecords, the room's memory dungeonContext's own campMemory.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
afterEach(() => { setSharedClock(null); setWorldMinutes(0); _resetForTests(); });

const tent = (uses) => createSurvivalItem(TEMPLATE.CampingEquipment, { condition: uses });
const campfire = (nights) => createSurvivalItem(TEMPLATE.Campfire, { condition: nights });
/** The ground half a metre under the probe (camps.js asks surfaceHit - CAMP-GROUND). */
const GROUND = Object.freeze({ surfaceHit: () => ({ dist: 0.5 }) });
const flat = (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null);   // a floor under every probe (surv3's), for the pure law

/** A host's pool: its ground, its place, its words, its id. `words` is what the host's publish reads when the pool says
 *  it changed - dungeonContext.js onChanged's act word, read at the call (the world host's asks a full foes frame,
 *  which reads the same list). */
function host({ self = null, items = [] } = {}) {
  const st = { feet: [0, 1, 0], yaw: 0, place: {}, self, col: GROUND };
  const said = [], menus = [], words = [];
  const entity = { items };
  let pool = null;
  pool = createCamps({
    entity, camera: () => ({ feet: st.feet, yaw: st.yaw }), collider: () => st.col, place: () => st.place,
    say: (l) => said.push(l), showOverlay: (w) => menus.push(w), selfId: () => st.self,
    onChanged: () => words.push(pool.wireRecords()),
  });
  return { pool, st, said, menus, words, entity };
}
/** Stand `item` from the pack at x metres along the road, at the world's `minute` (offline). */
const placeAt = (h, item, x, minute = null) => {
  if (minute != null) setWorldMinutes(minute);
  h.st.feet = [x, 1, 0];
  return h.pool.placeItem(item, h.entity.items);
};
const ids = (h) => h.pool.own().map((r) => r.id);
/** Everything the character owns of each kind: in the pack and standing as theirs, counted and with what it carries. */
const holdings = (h) => {
  const out = { tents: 0, tentUses: 0, fires: 0, fireNights: 0 };
  for (const it of h.entity.items) {
    if (isCampingEquipment(it)) { out.tents++; out.tentUses += it.currentCondition; }
    if (isCampfireKit(it)) { out.fires++; out.fireNights += it.currentCondition; }
  }
  for (const rec of h.pool.own()) {
    if (rec.kind === CAMP_KIND.Tent) { out.tents++; out.tentUses += rec.wear; }
    if (rec.kind === CAMP_KIND.Fire && rec.fuel) { out.fires++; out.fireNights += rec.wear; }
  }
  return out;
};
/** The save a host writes and a load reads back: the pool's own rows (world.js `camps: camps.snapshot(...)`) and the pack. */
const saveOf = (h) => JSON.parse(JSON.stringify({ camps: h.pool.snapshot(), items: h.entity.items }));
/** world.js worldQuickLoad's camp half (and the dungeon's truncating load): the pack from the save, mine dropped, the save's stood. */
const loadInto = (h, save) => { h.entity.items = JSON.parse(JSON.stringify(save.items)); h.pool.dropOwn(); h.pool.restore(JSON.parse(JSON.stringify(save.camps))); };
/** dungeonContext.js campMemory and applyCampMemory (their source pinned in the last test): the room's memory of every camp
 *  standing, each with its owner, and a joiner's apply of it, owner by owner. */
const memoryOf = (h, hostId) => h.pool.camps.map((c) => ({ ...campWire(c.rec), o: c.owner ?? hostId }));
function applyMemory(h, list) {
  const byOwner = new Map();
  for (const raw of list) if (raw && typeof raw.o === 'string' && validCampRecord(raw)) { if (!byOwner.has(raw.o)) byOwner.set(raw.o, []); byOwner.get(raw.o).push(raw); }
  for (const [owner, recs] of byOwner) h.pool.applyOwner(owner, recs);
}

test('CAMP-CAP the law: the cap is no refusal - a placing that stands asks for the oldest to be struck (none below the cap, one at it), one refused for any other reason strikes nothing; the struck camp\'s gear is the Pack\'s, in one line of its own', () => {
  const ctx = { now: 500, owner: 'p1', feet: [0, 1, 0], yaw: 0, probe: flat, place: {}, id: 'p1:9' };
  for (const standing of [0, 1, 2, 3]) {
    const it = campfire(3);
    const r = placeCampItem(it, [it], { ...ctx, standing });
    assert.deepEqual([r.ok, r.strike], [true, 0], `${standing} standing: nothing struck`);
  }
  for (const [item, text, spent] of [[campfire(3), CAMP_TEXT.lit, false], [tent(20), CAMP_TEXT.pitched, false], [createRestItem(REST_ITEM.EmberJar), REST_ITEM_TEXT.emberLit, true]]) {
    const pack = [item];
    const r = placeCampItem(item, pack, { ...ctx, standing: CAMPS_PER_OWNER });
    assert.deepEqual([r.ok, r.text, r.spent, r.strike, pack.length], [true, text, spent, 1, 0], `${item.name} at the cap stands, and asks for one struck`);
  }
  // refused for its own reason, at the cap: the item stays, nothing is struck
  for (const [place, item, text] of [
    [{ inTown: true }, campfire(3), SURVIVAL_USE_TEXT.campingTown], [{ insideBuilding: true }, tent(5), SURVIVAL_USE_TEXT.campingIndoors],
    [{ enemiesNearby: true }, campfire(3), SURVIVAL_USE_TEXT.campingFoes], [{ insideDungeon: true }, tent(5), CAMP_TEXT.noTentBelow],
    [{ inWater: true }, campfire(3), CAMP_TEXT.inWater], [{}, campfire(0), CAMP_TEXT.noFuel], [{}, tent(0), CAMP_TEXT.wornOut],
  ]) {
    const pack = [item];
    const r = placeCampItem(item, pack, { ...ctx, place, standing: CAMPS_PER_OWNER });
    assert.deepEqual([r.ok, r.text, r.strike ?? 0, pack.length], [false, text, 0, 1], `${text}: refused whole`);
  }
  const noGround = placeCampItem(campfire(3), [], { ...ctx, probe: null, standing: CAMPS_PER_OWNER });
  assert.deepEqual([noGround.ok, noGround.text, noGround.strike ?? 0], [false, CAMP_TEXT.noGround, 0]);
  // the strike: packCamp's gear, the strike's words
  const pitched = placeCampItem(tent(17), [], { ...ctx, standing: 0 }).camp;
  const lit = placeCampItem(campfire(5), [], { ...ctx, standing: 0 }).camp;
  const jar = placeCampItem(createRestItem(REST_ITEM.EmberJar), [], { ...ctx, standing: 0 }).camp;
  const t = strikeCamp(pitched), f = strikeCamp(lit), j = strikeCamp(jar);
  assert.deepEqual([t.item.templateIndex, t.item.currentCondition, t.text], [TEMPLATE.CampingEquipment, 17, 'Your oldest camp is packed away.'], 'the tent: its gear with its wear');
  assert.deepEqual([f.item.templateIndex, f.item.currentCondition, f.text], [TEMPLATE.Campfire, 5, 'Your oldest Campfire is packed away.'], 'a Campfire: picked up with its charges');
  assert.deepEqual([j.item, j.text], [null, 'Your oldest fire is put out.'], 'an Ember Jar\'s fire has no fuel of its own: nothing comes back');
  const oldKit = newCamp({ id: 'me:1', kind: CAMP_KIND.Fire, pos: [0, 0, 0], now: 0, wear: 2 });   // an old save's kit fire (AUDIT REST F12)
  assert.deepEqual([strikeCamp(oldKit).item, strikeCamp(oldKit).text], [null, CAMP_TEXT.struckOut], 'nor an old save\'s kit fire');
});

test('CAMP-CAP the brick: four camps a save left standing far apart, loaded on a new page, and the placing they refused for good - it stands; the oldest is struck where it stands and its gear comes home once, with its wear, said in one line', () => {
  // session one: four camps pitched two kilometres apart, an hour or two between them
  const one = host({ items: [tent(30), campfire(6), tent(12), campfire(3)] });
  for (let i = 0; i < 4; i++) assert.equal(placeAt(one, one.entity.items[0], i * 2000, 1000 + i * 100), true);
  const save = saveOf(one);
  assert.deepEqual([save.camps.length, save.items.length], [4, 0], 'the save carries the four and the pack is empty');
  // session two: a new page loads it - they stand as this player's, nine kilometres from where they play - and a
  // Campfire is bought
  setWorldMinutes(50_000);
  const two = host();
  loadInto(two, save);
  two.entity.items.push(campfire(8));
  assert.deepEqual(ids(two), save.camps.map((r) => r.id), 'the load stood all four as mine');
  assert.equal(placeAt(two, two.entity.items[0], -9000), true, 'the fifth placing stands - it was "You have enough camps standing already." for good');
  assert.deepEqual(two.said, [CAMP_TEXT.lit, CAMP_TEXT.struckCamp], 'the placing\'s line, and the strike\'s one');
  assert.equal(ids(two).length, CAMPS_PER_OWNER);
  assert.deepEqual(ids(two).slice(0, 3), save.camps.slice(1).map((r) => r.id), 'the OLDEST went - the first tent - and the three after it stand');
  assert.deepEqual(two.entity.items.map((it) => [it.templateIndex, it.currentCondition]), [[TEMPLATE.CampingEquipment, 30]], 'its gear came home once, with its thirty uses; the Campfire stands');
  assert.equal(two.words.length, 1, 'one word for the room');
  // and the one after: the gear that came home pitches again, and the next oldest - the six-night Campfire - comes back
  assert.equal(placeAt(two, two.entity.items[0], -9500), true);
  assert.deepEqual(two.said.slice(2), [CAMP_TEXT.pitched, CAMP_TEXT.struckFire]);
  assert.deepEqual(two.entity.items.map((it) => [it.templateIndex, it.currentCondition]), [[TEMPLATE.Campfire, 6]], 'picked up with its six nights');
  assert.deepEqual(ids(two).slice(0, 2), save.camps.slice(2).map((r) => r.id));
  assert.deepEqual(two.pool.own().slice(2).map((r) => [r.kind, r.wear]), [[CAMP_KIND.Fire, 8], [CAMP_KIND.Tent, 30]], 'the two new ones, newest last');
});

test('CAMP-CAP no item twice: the struck camp leaves the pool, the save and the word as its gear enters the pack - every placing at the cap keeps each kind\'s gear and charges whole; a refused placing strikes nothing; a fire with no fuel of its own gives nothing back; a load rewinds both halves together', () => {
  const h = host({ items: [tent(40), campfire(8), tent(9), campfire(2), tent(25), campfire(7), campfire(1), tent(3)] });
  for (let i = 0; i < 4; i++) placeAt(h, h.entity.items[0], i * 1000, 100 + i);
  const owned = holdings(h);
  assert.deepEqual(owned, { tents: 4, tentUses: 77, fires: 4, fireNights: 18 });
  const struck = [];
  for (let n = 0; n < 9; n++) {   // round and round: each placing at the cap strikes the oldest, and its gear is the next placed
    const before = ids(h);
    assert.equal(placeAt(h, h.entity.items[0], 10_000 + n * 50, 200 + n), true);
    const gone = before.filter((id) => !ids(h).includes(id));
    assert.deepEqual(gone, [before[0]], `placing ${n + 1}: the oldest alone went`);
    struck.push(gone[0]);
    assert.deepEqual(holdings(h), owned, `placing ${n + 1}: nothing made, nothing lost - every tent and Campfire with what it carries`);
    assert.equal(h.pool.own().length, CAMPS_PER_OWNER);
    // every door to the struck camp is shut: no ray, no hover, no menu, no save row, no word
    assert.equal(h.pool.targets().some((t) => t.key === `camp:${gone[0]}`), false);
    assert.equal(h.pool.hoverName(`camp:${gone[0]}`), null);
    assert.equal(h.pool.activate(`camp:${gone[0]}`, 'grab'), false, 'nothing left to pack');
    assert.equal(h.pool.snapshot().some((r) => r.id === gone[0]), false, 'the next save has no row for it');
    assert.equal(h.words.at(-1).some((r) => r.i === gone[0]), false, 'the word the placing said has none');
  }
  assert.equal(new Set(struck).size, struck.length, 'no camp struck twice');
  // a placing refused for its own reason at the cap strikes nothing (the arc Off is no reason since main's ENDLESS
  // PROVISIONS: a camp is every tier's)
  const standing = ids(h), pack = h.entity.items.length, told = h.words.length;
  for (const refuse of [() => { h.st.place = { inTown: true }; }, () => { h.st.place = { insideBuilding: true }; }, () => { h.st.place = { enemiesNearby: true }; },
    () => { h.st.col = { surfaceHit: () => ({ dist: 50 }) }; }]) {
    refuse();
    assert.equal(placeAt(h, h.entity.items[0], 0), false);
    h.st.place = {}; h.st.col = GROUND; _resetForTests();
    assert.deepEqual([ids(h), h.entity.items.length, h.words.length], [standing, pack, told], 'refused: the four stand, the pack and the room as they were');
  }
  // a fire with no fuel of its own (an Ember Jar's one night) struck gives nothing back - it was spent when it was lit
  const j = host({ items: [createRestItem(REST_ITEM.EmberJar), campfire(4), campfire(4), campfire(4), campfire(5)] });
  for (let i = 0; i < 5; i++) placeAt(j, j.entity.items[0], i * 30, 300 + i);
  assert.deepEqual(j.said.slice(-2), [CAMP_TEXT.lit, CAMP_TEXT.struckOut]);
  assert.deepEqual([j.entity.items, j.pool.own().map((r) => r.wear)], [[], [4, 4, 4, 5]], 'no Campfire minted from embers');
  // a load rewinds both halves together: the save before a strike stands the camp again and has no gear for it; the
  // save after has the gear and no camp
  const before = saveOf(h);
  const oldest = ids(h)[0];
  h.entity.items.push(campfire(8));
  placeAt(h, h.entity.items.at(-1), 5000, 400);
  const after = saveOf(h);
  const ownedNow = holdings(h);
  loadInto(h, before);
  assert.equal(ids(h)[0], oldest, 'the save before: the struck camp stands again...');
  assert.deepEqual(holdings(h), owned, '...and its gear is not in the pack: once');
  loadInto(h, after);
  assert.equal(ids(h).includes(oldest), false, 'the save after: no camp...');
  assert.deepEqual(holdings(h), ownedNow, '...and its gear in the pack: once');
});

test('CAMP-CAP online: the strike reaches every view - the placing\'s one word, read after it, says my four without it; a cell peer and a dungeon room\'s host drop it, the host\'s memory forgets it and a joiner never stands it; a memory from before it is refused as mine, or stands as a stranger\'s nobody can pack', () => {
  let wm = 30_000;
  setSharedClock(() => wm);   // online: the world's shared clock
  // THE CELL: my camps ride my full foes frame (world.js frame.c), a peer's pool takes them through applyOwner
  const me = host({ self: 'pA', items: [tent(30), campfire(6), tent(12), campfire(3), campfire(8)] });
  const peer = host({ self: 'pB' });
  for (let i = 0; i < 4; i++) { wm += 10; placeAt(me, me.entity.items[0], i * 400); }
  peer.pool.applyOwner('pA', me.words.at(-1), undefined, 1);
  const first = ids(me)[0];
  assert.deepEqual(peer.pool.camps.map((c) => c.rec.id), ids(me), 'the peer sees my four');
  wm += 10;
  assert.equal(placeAt(me, me.entity.items[0], 2000), true, 'online, at the cap: it stands');
  assert.equal(me.words.length, 5, 'one word for the placing');
  assert.deepEqual(me.words.at(-1).map((r) => r.i), ids(me), 'the word is read after the strike: my four now, the new one in, the struck one out');
  peer.pool.applyOwner('pA', me.words.at(-1), undefined, 2);
  assert.deepEqual(peer.pool.camps.map((c) => c.rec.id), ids(me), 'the peer dropped it');
  assert.equal(peer.pool.camps.some((c) => c.rec.id === first), false);
  for (const c of peer.pool.camps) {
    peer.pool.activate(`camp:${c.rec.id}`, 'grab');
    assert.equal(peer.menus.at(-1).items.includes(CAMP_TEXT.menuPack) || peer.menus.at(-1).items.includes(CAMP_TEXT.menuPickUp), false, 'and none of mine is theirs to pack');
  }
  // THE DUNGEON ROOM: my fires ride my act (dungeonContext onChanged: { k, c }); its host stands them through applyOwner and
  // keeps the room's memory (campMemory), which a joiner applies (applyCampMemory)
  const below = host({ self: 'pA', items: [campfire(8), campfire(7), campfire(6), campfire(5), campfire(4)] });
  below.st.place = { insideDungeon: true };
  const roomHost = host({ self: 'pH' });
  for (let i = 0; i < 4; i++) { wm += 10; placeAt(below, below.entity.items[0], i * 6); roomHost.pool.applyOwner('pA', below.words.at(-1)); }
  const stale = memoryOf(roomHost, 'pH');   // the room's memory before the strike
  const oldest = ids(below)[0];
  assert.deepEqual(stale.map((r) => [r.i, r.o]), ids(below).map((id) => [id, 'pA']));
  wm += 10;
  assert.equal(placeAt(below, below.entity.items[0], 30), true);
  assert.deepEqual(below.said.slice(-2), [CAMP_TEXT.lit, CAMP_TEXT.struckFire]);
  assert.deepEqual(below.entity.items.map((it) => [it.templateIndex, it.currentCondition]), [[TEMPLATE.Campfire, 8]], 'the oldest Campfire home with its eight nights');
  roomHost.pool.applyOwner('pA', below.words.at(-1));
  const memory = memoryOf(roomHost, 'pH');
  assert.deepEqual(memory.map((r) => r.i), ids(below), 'the host\'s memory follows my word: the struck fire is forgotten');
  const joiner = host({ self: 'pJ' });
  applyMemory(joiner, memory);
  assert.deepEqual(joiner.pool.camps.map((c) => c.rec.id), ids(below), 'a joiner never stands it');
  // a memory from before the strike, handed back to me: my own id is never a peer's word - nothing stands, nothing to pack
  const mine = ids(below), owned = holdings(below);
  applyMemory(below, stale);
  assert.deepEqual([below.pool.camps.map((c) => c.rec.id), holdings(below)], [mine, owned], 'refused as mine');
  // ...and after a new tab (a new id), it stands as the old tab's - a stranger's fire, which nobody can pick up
  below.st.self = 'pA2';
  applyMemory(below, stale);
  const ghost = below.pool.camps.find((c) => c.rec.id === oldest);
  assert.ok(ghost && ghost.owner === 'pA', 'the old tab\'s fire, under its old id');
  assert.deepEqual(ids(below), mine, 'never counted as mine');
  below.pool.activate(`camp:${oldest}`, 'grab');
  assert.equal(below.menus.at(-1).items.includes(CAMP_TEXT.menuPickUp), false, 'no Pick up on it');
  assert.deepEqual(holdings(below), owned, 'and no second Campfire');
});

test('CAMP-CAP the four hosts: one door - every placing is a pool\'s placeItem, which strikes, and no host calls the law around it; inside a building the world pool refuses before any strike; the room hears the word read at the call', () => {
  const callers = [];
  const walk = (dir) => {
    for (const f of readdirSync(join(root, dir))) {
      const p = `${dir}/${f}`;
      if (statSync(join(root, p)).isDirectory()) walk(p);
      else if (p.endsWith('.js') && /placeCampItem\(/.test(read(p))) callers.push(p);
    }
  };
  walk('src');
  assert.deepEqual(callers.sort(), ['src/scenes/camps.js', 'src/systems/survival/camp.js'], 'the law has one caller: the pool that strikes');
  assert.equal((read('src/scenes/camps.js').match(/placeCampItem\(/g) ?? []).length, 1);
  const world = read('src/scenes/world.js'), ext = read('src/scenes/exterior.js'), dc = read('src/scenes/dungeonContext.js'), modes = read('src/scenes/worldModes.js');
  for (const [name, src] of [['world', world], ['exterior', ext], ['dungeon', dc]]) {
    assert.match(src, /placeCamp: \(item, list\) => camps\.placeItem\(item, list \?\? playerEntity\.items \?\? \[\]\)/, `${name}: the pack and the hotbar place through its pool`);
  }
  // worldModes (interiors): its own pool has no placing door - the building's pack and hotbar are the world host's
  // (host.makeInventory, host.quickUse), into the world pool, whose place says indoors: refused before any strike
  assert.doesNotMatch(modes, /placeCamp:/);
  assert.match(modes, /const interiorCamps = createCamps\(\{\n\s+entity: playerEntity,\n\s+hearths: \(\) => \[\.\.\.interiorHearths, \.\.\.interiorDecor\.hearths\(\)\],[^\n]*\n\s+place: \(\) => \(\{ insideBuilding: true \}\),/);
  assert.match(world, /place: \(\) => \(\{ insideBuilding: _mode\(\) === 'interior', insideDungeon: _mode\(\) === 'dungeon',/);
  // the room's word, read when the pool says it changed - after the strike
  assert.match(world, /onChanged: \(\) => \{ _foesFullAt = -Infinity; \}/);
  assert.match(world, /if \(cell && full\) frame\.c = camps\.wireRecords\(campToWire\);/);
  assert.match(dc, /onChanged: \(\) => \{ const c = camps\.wireRecords\(\); opts\.onActions\?\.\(\{ k: _locationKey, c: c\.length \? c : \[\] \}\); \}/);
  assert.match(dc, /const campMemory = \(\) => camps\.camps\.map\(\(c\) => \(\{ \.\.\.campWire\(c\.rec\), o: c\.owner \?\? \(opts\.selfId\?\.\(\) \?\? 'host'\) \}\)\);/);
  assert.match(dc, /for \(const \[owner, recs\] of byOwner\) if \(camps\.applyOwner\(owner, recs\)\) n \+= recs\.length;/);
});
