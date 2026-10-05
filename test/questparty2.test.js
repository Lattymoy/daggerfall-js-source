// QUEST-PARTY phase 2 (2026-09-26, Mac: "Party shares them" - "then passing enemies to another member if that player
// leaves"). Phase 1 kept a shared quest's foes with their host: a host that died or walked out of the open country took
// them with it (they were never an heir's), and one whose connection dropped left them to vanish at every member - and
// a member's copy, whose waves had counted as placed while the host stood them, was left with a quest it could not
// finish. Now the dying or departing host names a party member heir (never a stranger), an owner gone without a word
// leaves its quest's foes to the one party member the law names (the lowest id near the foe), and either way the foe is
// bound to the new owner's own copy of the quest. Driven over the helpers and real encounter pools, and the world host
// by source.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adoptsOrphanQuestFoe, questBehaviourFor, QUEST_SHARE_RADIUS } from '../src/scenes/questFoeHost.js';
import { createExteriorFoes, validQuestTags } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('QUEST-PARTY 2: an orphan goes to the lowest id near it - me only if I stand near it and no nearer party member ranks below me', () => {
  const foe = [0, 0, 0];
  const base = { myId: 'mmm-0002', myFeet: [10, 0, 0], foeFeet: foe };
  assert.equal(adoptsOrphanQuestFoe({ ...base, partyPeers: [] }), true, 'the only one near');
  assert.equal(adoptsOrphanQuestFoe({ ...base, partyPeers: [{ id: 'aaa-0001', feet: [20, 0, 0] }] }), false, 'a lower id near it takes it');
  assert.equal(adoptsOrphanQuestFoe({ ...base, partyPeers: [{ id: 'zzz-0009', feet: [5, 0, 0] }] }), true, 'a higher id defers to me');
  assert.equal(adoptsOrphanQuestFoe({ ...base, partyPeers: [{ id: 'aaa-0001', feet: [QUEST_SHARE_RADIUS + 50, 0, 0] }] }), true, 'a lower id out of reach does not count');
  assert.equal(adoptsOrphanQuestFoe({ ...base, myFeet: [QUEST_SHARE_RADIUS + 50, 0, 0], partyPeers: [] }), false, 'not when I am out of reach of it');
  assert.equal(adoptsOrphanQuestFoe({ ...base, myId: null, partyPeers: [] }), false, 'offline, no one');
});

test('QUEST-PARTY 2: a foe taken over is bound to the taker\'s own Foe - a behaviour over it, or nothing for a quest it does not share', () => {
  const pirate = { isFoe: true, symbol: { name: '_pirate_' }, parentQuest: { uid: 7 } };
  const machine = { hasSharedQuestNamed: (n) => n === 'WAQ_SHIP_SMALLRAID', sharedCandidateNamed: () => ({ resources: new Map([['_pirate_', pirate]]) }) };
  const b = questBehaviourFor(machine, { q: 'WAQ_SHIP_SMALLRAID', s: '_pirate_' });
  assert.ok(b, 'a behaviour');
  assert.equal(b.questUID, 7, 'over the taker\'s own quest');
  assert.equal(b.targetSymbol, pirate.symbol, 'and its own Foe');
  assert.equal(questBehaviourFor(machine, { q: 'OTHER', s: '_pirate_' }), null, 'a quest the taker does not share binds nothing');
});

// the WORLD6b-ii rig
function craftCfg({ hpPerLevel = 40, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
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
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const PARTY = new Set(['host-0001', 'amy-0003', 'cat-0004']);
const fakeBehaviour = () => ({ questUID: 7, targetSymbol: { name: '_pirate_' }, bound: null, started: false, bindHost(h) { this.bound = h; }, start() { this.started = true; }, update() {} });
function pool(self, { orphans = () => false, staleMs = 0, clock = { t: 0 }, noQuest = false } = {}) {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'world:3,12', selfId: () => self, peers: () => [], now: () => clock.t, staleMs, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  const bound = [];
  p.setQuestShare({
    tagOf: (f) => (f.questBehaviour ? { q: 'WAQ_SHIP_SMALLRAID', s: f.questBehaviour.targetSymbol.name } : null),
    // the world host's own shape (world.js questShareSeam): a puppet stands for a LINKED copy (DISC28-J - `noQuest` is a
    // copy with none, which behaviourFor answers null for too); an heir's taking and a kept foe's blow ask the party
    // alone (partyPeer, AUDIT DISC28 QS-J)
    accepts: (from) => PARTY.has(self) && PARTY.has(from) && !noQuest,
    partyPeer: (id) => PARTY.has(self) && PARTY.has(id),
    peerMayHit: (peerId) => PARTY.has(peerId),
    onPuppetHurt: () => {}, onPuppetDied: () => {},
    behaviourFor: (tag) => { if (noQuest) return null; const b = fakeBehaviour(); b.targetSymbol = { name: tag.s }; bound.push(b); return b; },
    adoptsOrphan: (from, f) => orphans(from, f),
  });
  return { p, bound };
}
async function questFoes(p, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = await p.spawnFoe(0, [100 + i, 0, 100], { feetGiven: true, loose: true });
    f.questBehaviour = fakeBehaviour();
    out.push(f);
  }
  return out;
}

test('QUEST-PARTY 2 executed: a dying host names a party member heir for its shared quest\'s foes; the heir takes them as its own quest\'s, they ride as its, and the host lets them go', async () => {
  const host = pool('host-0001'), amy = pool('amy-0003');
  await questFoes(host.p, 3);
  amy.p.applyFoes('host-0001', host.p.foesFrame(true));
  await settle();
  assert.equal(amy.p.foes.filter((f) => f.puppet === 'host-0001').length, 3);
  const frame = host.p.handOverFrame(() => 'amy-0003');
  assert.ok(frame.f.every((r) => r.e === 'amy-0003'), 'every live foe of the quest names its heir');
  amy.p.applyFoes('host-0001', frame);
  const mine = amy.p.foes.filter((f) => !f.puppet && !f.dead);
  assert.equal(mine.length, 3, 'the heir takes them');
  assert.ok(mine.every((f) => f.isQuestFoe && f.questBehaviour?.started && f.questBehaviour.bound), 'each bound to the heir\'s own copy of the quest');
  assert.equal(amy.bound.length, 3);
  assert.ok(mine.every((f) => f._pupQuest == null), 'no longer a partner\'s word');
  const now = amy.p.foesFrame(true);
  assert.equal(now.qf?.length, 3, 'they ride to the party as the heir\'s');
  assert.equal(host.p.dropOwnLive(), 3, 'and the host lets them go');
});

test('QUEST-PARTY 2 executed: an owner gone without a handover leaves its quest\'s foes to the member the law names; the rest let them go, and a plain foe is let go by all', async () => {
  const host = pool('host-0001');
  await questFoes(host.p, 2);
  await host.p.spawnFoe(0, [120, 0, 100], { feetGiven: true, loose: true });   // a foe of no quest
  const frame = host.p.foesFrame(true);
  const amy = pool('amy-0003', { orphans: () => true }), cat = pool('cat-0004', { orphans: () => false });
  amy.p.applyFoes('host-0001', frame); cat.p.applyFoes('host-0001', frame);
  await settle();
  amy.p.pruneOwners(new Set()); cat.p.pruneOwners(new Set());
  const amyOwn = amy.p.foes.filter((f) => !f.puppet && !f.dead);
  assert.equal(amyOwn.length, 2, 'the named member takes the quest\'s two');
  assert.ok(amyOwn.every((f) => f.isQuestFoe && f.questBehaviour?.started), 'as its own quest\'s');
  assert.equal(amy.p.foes.filter((f) => f.puppet === 'host-0001').length, 0, 'and the plain foe went with its owner, as ever');
  assert.equal(cat.p.foes.filter((f) => f.puppet === 'host-0001' || !f.dead).length, 0, 'another member lets them go - it sees them again on the taker\'s stream');
});

test('QUEST-PARTY 2 by source: the world host\'s heirs for a quest foe are the party, and a taken foe is bound through its own copy', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const heirOf = \(f\) => \{[^\n]*if \(\(isPrivateQuestFoe\(f\) \|\| f\._keptTag\) && !social\?\.isPartyPeer\(q\.id\)\) continue;[^\n]*\n\s*return exteriorFoes\.handOver\(heirOf,/, 'never a stranger (the open air\'s handover; QUEST-PARTY phase 3b\'s building one is pinned beside its own; CURSE-SYNC: a PRIVATE quest\'s foe - a world quest\'s goes as an encounter\'s)');
  assert.match(w, /behaviourFor: \(tag\) => questBehaviourFor\(questBridge\?\.machine, tag\),/);
  assert.match(w, /adoptsOrphan: \(from, f\) => !!social\?\.party && adoptsOrphanQuestFoe\(\{ myId: online\?\.id \?\? null, myFeet: player\.feetAt\(\), foeFeet: f\.ai\?\.feet, partyPeers: \(peersNear\(\) \?\? \[\]\)\.filter\(\(p\) => p\.id !== from && social\.isPartyPeer\(p\.id\)\) \}\),/);
});

// ---- AUDIT (the pre-merge audit, 2026-09-27, Mac: "Audit before we merge"): phase 1-3b's findings over real pools.
const own = (p) => p.foes.filter((f) => !f.puppet && !f.dead);
const pups = (p, from) => p.foes.filter((f) => f.puppet === from && !f.dead);

test('AUDIT pre-merge D2 executed: a handover names ONE heir - a member it did not name lets the owner\'s foe go when the owner leaves, and never adopts it too', async () => {
  const host = pool('host-0001'), amy = pool('amy-0003'), cat = pool('cat-0004', { orphans: () => true });   // cat: the orphan law's pick
  await questFoes(host.p, 1);
  for (const x of [amy, cat]) x.p.applyFoes('host-0001', host.p.foesFrame(true));
  await settle();
  const handed = host.p.handOverFrame(() => 'amy-0003');
  amy.p.applyFoes('host-0001', handed); cat.p.applyFoes('host-0001', handed);
  assert.equal(own(amy.p).length, 1, 'the heir takes it');
  cat.p.pruneOwners(new Set());
  assert.equal(own(cat.p).length, 0, 'the member it did not name adopts nothing - one owner streams it, not two');
  assert.equal(pups(cat.p, 'host-0001').length, 0, 'and lets the old puppet go (the heir\'s stream stands it again)');
});

test('AUDIT pre-merge D2 executed: an owner gone QUIET but still in the room (a hidden tab, a held frame) keeps its foes - the stale sweep lets their puppets go and adopts none; they stand again when it wakes', async () => {
  const clock = { t: 0 };
  const host = pool('host-0001'), amy = pool('amy-0003', { orphans: () => true, staleMs: 6000, clock });
  await questFoes(host.p, 2);
  amy.p.applyFoes('host-0001', host.p.foesFrame(true));
  await settle();
  clock.t = 7000;
  amy.p.pruneOwners(new Set(['host-0001']));
  assert.equal(own(amy.p).length, 0, 'nothing adopted from an owner still here');
  assert.equal(pups(amy.p, 'host-0001').length, 0, 'its puppets go, as a quiet owner\'s always did');
  amy.p.applyFoes('host-0001', host.p.foesFrame(true));
  await settle();
  assert.equal(pups(amy.p, 'host-0001').length, 2, 'and stand again when it wakes');
});

test('AUDIT pre-merge D2 executed: a foe I took from an owner that left is theirs again when they stream it alive (a socket back under the same id) - mine goes with no death, theirs stands', async () => {
  const host = pool('host-0001'), amy = pool('amy-0003', { orphans: () => true });
  await questFoes(host.p, 1);
  amy.p.applyFoes('host-0001', host.p.foesFrame(true));
  await settle();
  amy.p.pruneOwners(new Set());
  const took = own(amy.p)[0];
  assert.ok(took?.isQuestFoe, 'the orphan taken');
  amy.p.applyFoes('host-0001', host.p.foesFrame(true));
  await settle();
  assert.equal(took.dead && took._gone && !took.corpse, true, 'mine let go - no death, no body');
  assert.ok(!amy.p.foes.includes(took));
  assert.equal(own(amy.p).length, 0);
  assert.equal(pups(amy.p, 'host-0001').length, 1, 'theirs stands as their puppet: one foe, one owner');
});

test('AUDIT pre-merge F3 executed: an heir whose puppet was still building when its owner\'s leave pruned it takes the foe on landing; a room change still ends such a build', async () => {
  const host = pool('host-0001'), amy = pool('amy-0003');
  await questFoes(host.p, 1);
  amy.p.applyFoes('host-0001', host.p.handOverFrame(() => 'amy-0003'));   // the handover is the first word it hears
  amy.p.pruneOwners(new Set());   // the owner's leave, before the build lands
  await settle();
  assert.equal(own(amy.p).length, 1, 'taken on landing - the owner had already let it go');
  assert.ok(own(amy.p)[0].isQuestFoe, 'as its own quest\'s');
  const h2 = pool('host-0001'), cat = pool('cat-0004');
  await questFoes(h2.p, 1);
  cat.p.applyFoes('host-0001', h2.p.handOverFrame(() => 'cat-0004'));
  cat.p.clearPuppets();   // a room change
  await settle();
  assert.equal(cat.p.foes.filter((f) => !f.dead).length, 0, 'a build a room change overtook ends on arrival');
});

test('AUDIT pre-merge Q3 + F1 executed: an heir whose copy holds no such quest keeps the partner\'s word - it rides to the party as the quest\'s (never to strangers), a marker\'s foe keeps its flag, and a save keeps the flag too', async () => {
  // the heir's id sorts ABOVE the owner's: the handed record's own mark would have stood the heir's new copy down.
  // F1 by an heir whose copy IS linked: it stood the puppet, so the handed record lands on it at once - and marks nothing
  {
    const h0 = pool('amy-0003'), linked = pool('cat-0004');
    const [mark] = await questFoes(h0.p, 1);
    mark._questMarker = true;
    linked.p.applyFoes('amy-0003', h0.p.foesFrame(true));
    await settle();
    assert.equal(pups(linked.p, 'amy-0003').length, 1, 'a linked copy stands the puppet');
    linked.p.applyFoes('amy-0003', h0.p.handOverFrame(() => 'cat-0004'));
    const took0 = own(linked.p)[0];
    assert.ok(took0?.isQuestFoe, 'taken as its own quest\'s, and not stood down by its own handover');
    assert.equal(took0._questMarker, true, 'still a marker\'s foe');
  }
  // Q3 + F1 by an heir whose copy holds no such quest
  const host = pool('amy-0003'), amy = pool('cat-0004', { noQuest: true });
  const [pirate] = await questFoes(host.p, 1);
  pirate._questMarker = true;
  pirate.entity.health = pirate.entity.maxHealth = 1;   // the owner's own roll, whole and untouched - my own roll of the species reads above it
  amy.p.applyFoes('amy-0003', host.p.foesFrame(true));
  await settle();
  assert.equal(pups(amy.p, 'amy-0003').length, 0, 'DISC28-J: a copy with no link stands none of the quest\'s puppets');
  amy.p.applyFoes('amy-0003', host.p.handOverFrame(() => 'cat-0004'));
  await settle();   // AUDIT DISC28 QS-J: the handover is the first it takes - built on its record, taken on landing
  const took = own(amy.p)[0];
  assert.ok(took && !took.isQuestFoe, 'taken with no quest of its own to bind');
  assert.deepEqual(took._keptTag, { q: 'WAQ_SHIP_SMALLRAID', s: '_pirate_' }, 'the partner\'s word kept');
  assert.equal(took._questMarker, true, 'still a marker\'s foe');
  const fr = amy.p.foesFrame(true);
  assert.deepEqual(fr.qf, [[took.seq, 'WAQ_SHIP_SMALLRAID', '_pirate_', 1]], 'it rides to the party as the quest\'s marker foe - untouched, as its owner said (my roll of its maximum is not a blow)');
  const bob = pool('bob-0009');   // a stranger
  bob.p.applyFoes('cat-0004', fr);
  await settle();
  assert.equal(pups(bob.p, 'cat-0004').length, 0, 'a stranger stands none of it');
  assert.equal(amy.p.applyHit('bob-0009', { i: took.seq, dmg: 5, kind: 'melee' }), false, 'nor lands a blow on it');
  const saved = host.p.snapshotWorld((feet) => ({ x: feet[0], z: feet[2] }));
  assert.equal(saved.find((s) => s.questResource !== undefined && s.questMarker === true) != null, true, 'the save carries the marker\'s flag');
  const back = pool('amy-0003');
  back.p.restoreWorld(saved, (x, z) => [x, z], 0, { reviveQuestBehaviour: () => fakeBehaviour() });
  await settle();
  assert.equal(back.p.foes.filter((f) => f._questMarker).length, 1, 'and the restore stands it as one (indoors the marker walk is suppressed)');
});

test('AUDIT pre-merge Q5 + Q6 executed: a quest foe\'s body offers no pile (its take arm answers the owner alone); the cure quests\' $-names ride', async () => {
  const host = pool('host-0001');
  const [q] = await questFoes(host.p, 1);
  const plain = await host.p.spawnFoe(0, [130, 0, 100], { feetGiven: true, loose: true });
  for (const f of [q, plain]) { f.dead = true; f.corpse = true; f.entity.items = [{ name: 'Gold' }]; }
  const fr = host.p.foesFrame(true);
  const rec = (f) => fr.f.find((r) => r.i === f.seq);
  assert.equal(rec(q).o, 0, 'a quest foe\'s body: no pile - a member\'s press asked again forever');
  assert.equal(rec(plain).o, 1, 'a plain body still offers its pile');
  const tags = validQuestTags([[1, '$CUREVAM', '_vampire_'], [2, '$CUREWER', '_wolf_'], [3, 'A$B C', '_x_']]);
  assert.deepEqual([...tags.keys()], [1, 2], 'the cure quests ride; a word with a space still does not');
});

test('AUDIT pre-merge Q4 + Q7 by source: a shared quest\'s foe past my relevance stands while a party member is near it; a partner\'s wave counts as placed only for a quest I hold as shared', () => {
  const x = rd('src/scenes/exteriorFoes.js'), w = rd('src/scenes/world.js');
  assert.match(x, /const partyNearFoe = \(f, r\) => peerCandidates\(\)\.some\(\(c\) => _peerMayHit\(c\.id, f\) && Math\.hypot\(c\.feet\[0\] - f\.ai\.feet\[0\], c\.feet\[1\] - f\.ai\.feet\[1\], c\.feet\[2\] - f\.ai\.feet\[2\]\) <= r\);/);
  assert.match(x, /&& !\(_qTag\(f\) && partyNearFoe\(f, _cullAt\)\) && !_relentless\) \{/, 'the cull asks it');   // PIN MOVED (RVN2: nor a Relentless revenant hunting me)
  assert.match(w, /const _liveSharer = \(q\) => \(questBridge\?\.machine\?\.hasSharedQuestNamed\?\.\(q\) \? \(_questSharer\.get\(q\) \?\? null\) : null\);/);
  assert.equal((w.match(/sharerOf: \(q\) => _liveSharer\(q\)/g) ?? []).length, 2, 'both the open air\'s and the rooms\' wave gates');
  assert.doesNotMatch(w, /sharerOf: \(q\) => _questSharer\.get\(q\)/);
});
