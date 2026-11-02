// HUNTERS-MARK-II (2026-10-27; bible/06-Systems/Bounty-Boards.md 12.4, 12.8): THE NAMED MARK ON A MATE'S SCREEN. The law
// that reads a peer's foe as the week's mark off its kind and its traits' mask (systems/hunt/namedMark.js), then the
// whole way between two real pools (scenes/exteriorFoes.js - auditwe_wire's rig): the hunter's real bounty host stands
// and crowns its mark, its frame goes, and the mate's pool stands it under its name with its two traits. Only the hunter
// is paid and reported; the mate who fought it gets the kill's Renown, as from any shared foe.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const { createExteriorFoes } = await import('../../src/scenes/exteriorFoes.js');
const { createBountyHost } = await import('../../src/scenes/bountyHost.js');
const { huntMarkSeen, huntMarkTraits, HUNT_MARK_TRAITS } = await import('../../src/systems/hunt/namedMark.js');
const { huntWeekAt, huntMarkOf, HUNT_MARK_NAMES, HUNT_RUNGS, HUNT_MARK_RUNG } = await import('../../src/net/huntLaw.js');
const { BOUNTY_TIERS } = await import('../../src/systems/bounty/bountyBoard.js');
const { bossTraitMask, giveBossTraits } = await import('../../src/systems/bossTraits.js');
const { promoteRaidLeader, eliteSize, promoteEliteFoe, grantEliteLoot, withdrawEliteLoot } = await import('../../src/systems/eliteFoes.js');
const { raidLeaderNameOf } = await import('../../src/systems/raidKinds.js');
const { foeTitle } = await import('../../src/systems/foeTitle.js');
const { trophyTitle } = await import('../../src/systems/hunt/trophies.js');
const { TROPHY_TEMPLATE } = await import('../../src/net/trophyLaw.js');
const { sharedClassicMinutes, validPartyPose } = await import('../../src/net/wire.js');
const { seatWeekStartMs } = await import('../../src/net/townSeatLaw.js');
const { worldMinutes, setWorldMinutes } = await import('../../src/systems/worldTick.js');
const { setRenownKillHandler } = await import('../../src/net/renownTracker.js');
const { createWeapon } = await import('../../src/combat/enemyEquipment.js');
const { WEAPONS } = await import('../../src/characters/weapons.js');
await import('../../src/systems/professions/profTemplates.js');   // the Mounted Trophy's row, as the game registers it

const DAY = 86_400_000;
const WALL = Date.UTC(2026, 9, 28, 12);
const maskOf = (week, tier) => bossTraitMask(huntMarkTraits(week, tier));

// ─── THE LAW ─────────────────────────────────────────────────────────

test('HUNTERS-MARK-II THE LAW: a peer\'s foe is the week\'s named mark when its kind is its tier\'s mark this week (or last week\'s, past the Turning) and its traits\' mask is the week\'s - read under the hunter\'s own title; another kind, another mask, a mark two weeks gone or no mask read as none; this week\'s name before last week\'s where both read (mutants: the kind unchecked; the mask unchecked; last week dropped; two weeks back read; last week first)', () => {
  const week = huntWeekAt(WALL);
  for (const [tier, row] of BOUNTY_TIERS.entries()) {
    const { foe, name } = huntMarkOf(week, row.min);
    const nameIndex = HUNT_MARK_NAMES.indexOf(name);
    assert.deepEqual(huntMarkSeen(foe, maskOf(week, tier), WALL), { week, tier, foe, nameIndex, title: trophyTitle(foe, nameIndex) }, `tier ${tier + 1}: the week's mark, under the hunter's title`);
    assert.equal(huntMarkTraits(week, tier).length, HUNT_MARK_TRAITS);
    for (const other of row.foes) if (other !== foe && other !== huntMarkOf(week - 1, row.min).foe) assert.equal(huntMarkSeen(other, maskOf(week, tier), WALL), null, `tier ${tier + 1}: another of its beasts is none`);
    for (let bit = 0; bit < 11; bit++) {
      const m = maskOf(week, tier) ^ (1 << bit);
      if (foe !== huntMarkOf(week - 1, row.min).foe || m !== maskOf(week - 1, tier)) assert.equal(huntMarkSeen(foe, m, WALL), null, `tier ${tier + 1}: another mask is none`);
    }
  }
  assert.equal(huntMarkSeen(huntMarkOf(week, 1).foe, 0, WALL), null, 'no traits, no mark');
  assert.equal(huntMarkSeen(huntMarkOf(week, 1).foe, undefined, WALL), null);
  assert.equal(huntMarkSeen(999, maskOf(week, 0), WALL), null, 'a kind no board posts');
  // past the Turning: last week's mark still stands where it was stood, and still reads; two weeks back does not
  const last = huntMarkOf(week - 1, BOUNTY_TIERS[4].min);
  assert.equal(huntMarkSeen(last.foe, maskOf(week - 1, 4), WALL)?.title, trophyTitle(last.foe, HUNT_MARK_NAMES.indexOf(last.name)), 'last week\'s');
  const gone = huntMarkOf(week - 2, BOUNTY_TIERS[4].min);
  assert.ok([week, week - 1].every((w) => huntMarkOf(w, BOUNTY_TIERS[4].min).foe !== gone.foe || maskOf(w, 4) !== maskOf(week - 2, 4)), 'the fixture: two weeks back is no later week\'s twin');
  assert.equal(huntMarkSeen(gone.foe, maskOf(week - 2, 4), WALL), null, 'two weeks back is none');
  // two weeks whose tier posts one beast with one mask: the current week's name is read
  let twin = null;
  for (let w = 1; w < 5000 && !twin; w++) for (const [tier, row] of BOUNTY_TIERS.entries()) {
    const a = huntMarkOf(w, row.min), b = huntMarkOf(w - 1, row.min);
    if (!twin && a.foe === b.foe && a.name !== b.name && maskOf(w, tier) === maskOf(w - 1, tier)) twin = { w, tier, a, b };
  }
  assert.ok(twin, 'the fixture: a week whose mark is its last week\'s twin');
  const at = seatWeekStartMs(twin.w) + DAY;
  assert.equal(huntMarkSeen(twin.a.foe, maskOf(twin.w, twin.tier), at)?.week, twin.w, 'this week\'s, not last week\'s');
  assert.match(huntMarkSeen(twin.a.foe, maskOf(twin.w, twin.tier), at)?.title, new RegExp(`^${twin.a.name} `));
});

// ─── THE WIRE ────────────────────────────────────────────────────────

// a synthetic MONSTER.BSA holding every board beast's ENEMYnnn.CFG (bosstraits_hosts' rig), a flat open world
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa(BOUNTY_TIERS.flatMap((t) => t.foes).map((f) => [`ENEMY${String(f).padStart(3, '0')}.CFG`, craftCfg()]));
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); };
const poolRig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
    move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { isPlayer: true, level: 16, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 }, health: 100, maxHealth: 100 },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
});
const netAs = (id) => ({ selfId: () => id, room: () => 'world:3,12', onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
/** A hunt's door offline for reports, its state the service's word: `clears` this character's board clears. */
const doorOf = (clears, cleared) => ({
  account: () => 'acct', state: async () => ({ ok: true, data: { clears, marks: 0, markDone: false, regions: {}, account: { clears } } }),
  clear: async (c, id, region) => { cleared.push([id, region]); return { ok: false, error: 'offline' }; },
});
/** A bounty host as the world host wires one (scenes/world.js createBountyHost), its packs stood in `pool`. */
function hostOn(pool, { level, clears, here, social = () => null }) {
  const entity = { goldPieces: 0, items: [] }, cleared = [];
  const host = createBountyHost({
    now: () => Math.floor(sharedClassicMinutes(WALL)), wallNow: () => WALL, level: () => level, entity: () => entity, townName: () => 'Daggerfall', regionAt: () => 9,
    siteOk: () => true, playerPixel: () => here.at, canStand: () => true, foePool: () => pool.foes,
    // the camp's own stand (world.js _standCampEncounter): a pack `loose` and `transient` - this one an elite of the stand's own roll
    standPack: ({ mobileType, count }) => ({ foes: Promise.all(Array.from({ length: count }, (_, k) => pool.spawnFoe(mobileType, [4 + k, 0, 40], { feetGiven: true, loose: true, transient: true, eliteFoe: true }))), dx: 4, dz: 40 }),
    say: () => {}, showNotice: () => true, openBoardWindow: () => {}, social, rolls: () => 0.3,
    hunt: { door: doorOf(clears, cleared), storage: memStorage(), character: () => `c-${level}` },
  });
  return { host, entity, cleared };
}
const BASE_POSE = { px: 300, py: 200, h: 100, hm: 100, f: 100, fm: 100, m: 50, mm: 50 };

test('HUNTERS-MARK-II THE WIRE, between two real pools: the hunter\'s mark - stood by its bounty host, an elite of its stand\'s own roll - wears the week\'s two traits, and the mate\'s copy stands under its name with those two, called on both screens by the same words; a raid\'s leader of that kind and those traits keeps its party\'s word, and a leader of other traits is no mark. Only the hunter is paid and reported: the mark rides no pose, and the mate who fought it earns the kill\'s Renown as from any shared foe (mutants: the stand\'s trait kept; the mark unnamed on the wire; the raid read as a mark; the mask unchecked; the mate\'s Renown gone)', async (t) => {
  t.mock.method(Date, 'now', () => WALL);
  const was = worldMinutes();
  setWorldMinutes(sharedClassicMinutes(WALL));   // the event clock both pools read (online, the shared clock)
  t.after(() => { setWorldMinutes(was); setRenownKillHandler(null); });
  const A = createExteriorFoes(poolRig()), B = createExteriorFoes(poolRig());
  A.setNet(netAs('mac-0001')); B.setNet(netAs('bob-0002'));
  const hereA = { at: null };
  const hunter = hostOn(A, { level: 16, clears: HUNT_RUNGS[HUNT_MARK_RUNG].at, here: hereA });
  await hunter.host.hunt.book.refresh();
  const mk = hunter.host.hunt.boardMark({ px: 300, py: 200 });
  assert.equal(mk?.state, 'open', 'a Stalker is posted the week\'s mark');
  const p = mk.posting;
  assert.equal(hunter.host.hunt.take(p.id).ok, true);
  hereA.at = { x: p.target.px, y: p.target.py };
  hunter.host.tick(1); await settle();
  const beast = A.foes.find((f) => !f.puppet && f.huntMark === p.id);
  assert.ok(beast, 'the mark stood in the hunter\'s pool');
  assert.deepEqual([...beast.entity.bossTraits].sort(), [...p.traits].sort(), 'the week\'s two, never the one its stand drew as an elite');
  assert.equal(beast.entity.raidLeader?.name, p.title);
  assert.equal(beast.entity._eliteLoot, true, 'its stand laid an elite\'s drop on it');
  assert.equal(withdrawEliteLoot(beast.entity), 0, 'and the mark took it back: its drop is its kind\'s own, never kit');
  // the mate's pool reads the hunter's frame
  B.applyFoes('mac-0001', A.foesFrame(true)); await settle();
  const copy = B.foes.find((f) => f.puppet === 'mac-0001' && f.seq === beast.seq);
  assert.ok(copy?.entity?.eliteFoe, 'an elite on the mate\'s screen');
  assert.equal(copy.entity.raidLeader?.name, p.title, 'under its name');
  assert.deepEqual([...copy.entity.bossTraits].sort(), [...p.traits].sort(), 'with its two traits');
  assert.equal(foeTitle(copy.entity, 'Beast'), foeTitle({ ...beast.entity, unquiet: false }, 'Beast'), 'called by the same words on both screens (an Unquiet mark is its owner\'s alone, as on any special foe - UNQUIET)');
  assert.equal(eliteSize(copy.entity), eliteSize(beast.entity), 'and drawn at the same size');
  // a raid's leader of that kind with those traits keeps its party's word; a leader of other traits is no mark
  const lead = await A.spawnFoe(p.foe, [20, 0, 20], { feetGiven: true, loose: true, eliteFoe: false });
  promoteRaidLeader(lead.entity, { name: raidLeaderNameOf(p.foe) }); lead.entity.bossTraits = undefined; giveBossTraits(lead.entity, p.traits);   // systems/raidingParties.js's own promotion
  lead.raidKey = '17:3:120';   // RAID2: it rides tagged with its raid (raidingParties.js raidKey)
  const odd = await A.spawnFoe(p.foe, [24, 0, 24], { feetGiven: true, loose: true, eliteFoe: false });
  promoteRaidLeader(odd.entity, { name: '' }); odd.entity.bossTraits = undefined;
  giveBossTraits(odd.entity, ['flameproof', 'thorned', 'warded', 'curbing'].filter((x) => !p.traits.includes(x)).slice(0, 2));
  await settle();
  B.applyFoes('mac-0001', A.foesFrame(true)); await settle();
  const at = (seq) => B.foes.find((f) => f.puppet === 'mac-0001' && f.seq === seq);
  assert.equal(at(lead.seq)?.entity?.raidLeader?.name, raidLeaderNameOf(p.foe), 'a raid\'s leader, by its party\'s word');
  assert.notEqual(at(odd.seq)?.entity?.raidLeader?.name, p.title, 'other traits: no mark');
  assert.ok(at(odd.seq)?.entity?.raidLeader, 'though a leader still');
  // ONLY THE HUNTER IS PAID. The mate - a Hunter, below the marks' rung - hunts beside them in a party.
  const hereB = { at: { x: p.target.px, y: p.target.py } };
  const mate = hostOn(B, { level: 16, clears: 20, here: hereB, social: () => ({ acct: 'bob', inParty: true, mates: [{ acct: 'mac', name: 'Mac', online: true, p: validPartyPose({ ...BASE_POSE, ...hunter.host.poseField(), lv: 16 }) }] }) });
  await mate.host.hunt.book.refresh();
  assert.deepEqual(hunter.host.poseField(), {}, 'the mark rides no pose row');
  assert.equal(validPartyPose({ ...BASE_POSE, bq: [{ i: p.id, c: 1 }] }).bq, undefined, 'and the pose\'s law takes none (a bounty\'s id alone)');
  const renowned = [];
  setRenownKillHandler((f) => renowned.push(f));
  B.damageFoe(copy, 1, [4, 0, 30], null, { kind: 'melee', weapon: createWeapon(WEAPONS.Longsword, 0, () => 0.5) });   // the mate's blow, sent to its owner
  beast.dead = true; beast.corpse = true; beast.entity.health = 0;
  hunter.host.tick(1); await settle();
  B.applyFoes('mac-0001', A.foesFrame(true)); await settle();
  mate.host.tick(1); await settle();
  assert.equal(copy.dead, true, 'the mate\'s copy falls with it');
  assert.equal(hunter.entity.goldPieces, p.gold, 'the hunter\'s purse');
  assert.ok(hunter.entity.items.some((i) => i.templateIndex === TROPHY_TEMPLATE), 'and its trophy');
  assert.deepEqual(hunter.host.hunt.book.kept(), [p.id], 'the hunter\'s clear, kept for the service');
  assert.equal(mate.entity.goldPieces, 0, 'the mate: no purse');
  assert.equal(mate.entity.items.length, 0, 'no trophy, no piece');
  assert.deepEqual(mate.host.hunt.book.kept(), [], 'no clear reported');
  assert.equal(mate.host.hunt._done().size, 0, 'no mark done');
  assert.deepEqual(mate.host._ledger().paid, [], 'no bounty paid');
  assert.deepEqual(renowned, [copy], 'the kill\'s Renown, as from any shared foe');
});

test('HUNTERS-MARK-II AN ELITE\'S PIECES TAKEN BACK: withdrawEliteLoot takes off exactly what the elite roll laid - the kind\'s own pieces stay, a foe no roll laid on loses nothing, and a second ask takes nothing (mutants: the record never kept; every piece taken)', () => {
  const own = [{ templateIndex: 1, own: true }, { templateIndex: 2, own: true }];
  const e = { eliteFoe: false, level: 12, items: [...own] };
  promoteEliteFoe(e, { own: false });
  grantEliteLoot(e, 12, () => 0.5);
  assert.ok(e.items.length > own.length, 'the roll laid its pieces');
  const laid = e.items.length - own.length;
  assert.equal(withdrawEliteLoot(e), laid, 'as many as it laid');
  assert.deepEqual(e.items, own, 'the kind\'s own stay, in order');
  assert.equal(withdrawEliteLoot(e), 0, 'nothing twice');
  const plain = { items: [{ templateIndex: 3 }] };
  assert.equal(withdrawEliteLoot(plain), 0);
  assert.equal(plain.items.length, 1);
});
