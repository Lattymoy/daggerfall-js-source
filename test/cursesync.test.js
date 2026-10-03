// CURSE-SYNC (2026-09-27, the bug-reports channel: "Monsters aren't syncing ... The ghost on daggerfall ... We all had
// to kill them ... And everyone had to kill thier ow[n]"). S0000977, the Curse of Daggerfall, stands a wraith and a ghost
// at night in Daggerfall's streets for every character the tutorial started it for - and as a quest's foes they rode
// nowhere (Multiplayer.md's first lock), so each player fought a haunting nobody else could see. A WORLD QUEST'S FOES
// ARE THE WORLD'S: they ride the cell as an encounter's do, anyone may strike them and be hunted by them, and their
// quest still holds them. Any other quest's foe stays its player's own. Driven over the real quest (the vendored
// S0000977, scheduled in a real machine, its wave minted and bound by the real producer) and real encounter pools;
// the world host's handover by source.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine, questNameIn } from '../src/systems/quest/machine.js';
import { StartQuest } from '../src/systems/quest/actions.js';
import { isMainQuestName } from '../src/systems/quest/questLists.js';
import { mintQuestFoeWave, bindQuestFoeHost, reviveQuestBehaviour, questShareTag, sharedQuestFoe, WORLD_QUESTS, questNameOf, isWorldQuestFoe, isPrivateQuestFoe } from '../src/scenes/questFoeHost.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { isPeerTarget } from '../src/characters/enemyTargets.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

// ═══ the quests ══════════════════════════════════════════════════════════
const V = join(ROOT, 'vendor/dfu-quests/Tables');
const tables = {};
for (const f of readdirSync(V)) if (f.endsWith('.txt')) tables[f.replace('.txt', '')] = readFileSync(join(V, f), 'utf8').replace(/^\uFEFF/, '');
loadQuestTables(tables);
const questLines = (name) => rd(`vendor/dfu-quests/Quests/${name}.txt`).replace(/^\uFEFF/, '').split(/\r?\n/);
// a quest of the player's own that COUNTS its foes (DISC6's shape): its foes stay its player's
const KILL_ALL = ['Quest: __KTEST', 'QRC:', 'Message:  1020', ' You killed them all.', '', 'QBN:', 'Foe _rats_ is 2 Giant_rat', '',
  '_mondead_ task:', ' killed 2 _rats_', ' say 1020', ' log 1011 step 1', '', 'log 1010 step 0'];
function quests() {
  const m = new QuestMachine({ nowSeconds: () => 0, showPopup: () => {} });
  const curse = m.scheduleQuest(questLines('S0000977'), 0, { rolls: () => 0 });
  const mine = m.scheduleQuest(KILL_ALL, 0, { rolls: () => 0 });
  m.tick();
  return { m, curse, ghost: curse.resources.get('F.00'), wraith: curse.resources.get('wraith'), rats: mine.resources.get('rats') };
}
const behaviourOf = (m, foe) => mintQuestFoeWave(m, foe, 1)[0].behaviour;

test('CURSE-SYNC: the curse\'s ghost and wraith, minted and bound by the real producer, are a world quest\'s foes; a quest of the player\'s own stays private, and a foe of no quest is neither', () => {
  assert.deepEqual(WORLD_QUESTS, ['S0000977'], 'the Curse of Daggerfall, and nothing else');
  assert.match(rd('vendor/dfu-quests/Quests/_TUTOR__.txt'), /start quest 977 977/, 'the tutorial starts it for every character');
  assert.equal(isMainQuestName('S0000977'), true, 'a main quest - the share gates refuse it, so it never rides as a party\'s');
  const { m, ghost, wraith, rats } = quests();
  assert.equal(ghost.foeType, 18, 'Foe _F.00_ is Ghost');
  assert.equal(wraith.foeType, 23, 'Foe _wraith_ is Wraith');
  const pool = { removeFoe() {}, zeroFoeHealth() {}, foeSinks: () => ({}) };
  const bound = (foe) => { const f = { entity: { health: 10, maxHealth: 10 }, ai: {}, dead: false }; bindQuestFoeHost(f, behaviourOf(m, foe), pool); return f; };
  for (const foe of [ghost, wraith]) {
    const f = bound(foe);
    assert.equal(questNameOf(f), 'S0000977');
    assert.equal(isWorldQuestFoe(f), true);
    assert.equal(isPrivateQuestFoe(f), false);
  }
  const own = bound(rats);
  assert.equal(questNameOf(own), '__KTEST');
  assert.equal(isWorldQuestFoe(own), false);
  assert.equal(isPrivateQuestFoe(own), true, 'every other quest\'s foe is its player\'s alone, as ever');
  assert.equal(isPrivateQuestFoe({ questBehaviour: null }), false, 'a foe of no quest is no quest\'s');
  assert.equal(isWorldQuestFoe({}), false);
  // a wave minted and not yet stood (no Start: its quest is found by its uid) reads the same
  assert.equal(isWorldQuestFoe({ questBehaviour: behaviourOf(m, ghost) }), true);
  // the name as QuestMachine.IsProtectedQuest reads its list - case-insensitive
  assert.equal(isWorldQuestFoe({ questBehaviour: { targetQuest: { questName: 's0000977' } } }), true);
  assert.equal(isWorldQuestFoe({ questBehaviour: { targetQuest: { questName: 'S0000976' } } }), false);
  assert.equal(questShareTag(m, bound(ghost), true), null, 'partied or not, the curse carries no party\'s word');
});

// AUDIT CURSE-SYNC: what a world quest may be - no task counts its foes. Every line naming one of its Foe symbols is
// its Foe line or an action that stands it; the lines that break the rule, else none.
function countsItsFoes(name) {
  const lines = questLines(name);
  const syms = lines.map((l) => /^Foe (\S+) is /.exec(l)?.[1]).filter(Boolean);
  if (!syms.length) return ['(no Foe)'];
  return lines.filter((l) => !/^Foe /.test(l) && syms.some((sym) => l.includes(sym)) && !/^\s*(create|place) foe /.test(l)).map((l) => l.trim());
}

test('AUDIT CURSE-SYNC: a quest joins WORLD_QUESTS only if no task counts its foes - a handed foe is its heir\'s plain foe, which no quest counts; and the game names the curse as the list does', () => {
  for (const name of WORLD_QUESTS) assert.deepEqual(countsItsFoes(name), [], `${name}: its foes are counted by a task, so a foe handed on would lose its count`);
  assert.deepEqual(countsItsFoes('S0000002'), ['injured _F.00_ saying 1025', 'injured _battlemage_ saying 1025'], 'the check sees a quest that counts its foes (it is not vacuous)');
  // the running game starts the curse from the tutorial's close by NUMBER - StartQuest names it, and the name is the list's
  const [line] = questLines('_TUTOR__').filter((l) => /start quest 977/.test(l));
  const asked = [];
  const act = new StartQuest(null).createNew(line.trim(), { hooks: { startQuest: (n) => asked.push(n) } });
  act.update();
  assert.deepEqual(asked, ['S0000977']);
  assert.ok(WORLD_QUESTS.includes(asked[0]));
});

test('AUDIT CURSE-SYNC F1: a foe\'s world answer is kept once its quest is known - an ended quest leaving the machine does not turn a fighting ghost private; a save\'s foe stood before its quest is asked again, not held private', () => {
  const { m, curse, ghost } = quests();
  const pool = { removeFoe() {}, zeroFoeHealth() {}, foeSinks: () => ({}) };
  const f = { entity: { health: 10, maxHealth: 10 }, ai: {}, dead: false };
  bindQuestFoeHost(f, behaviourOf(m, ghost), pool);
  assert.equal(isWorldQuestFoe(f), true);
  m.removeQuest(curse);   // a week after the curse is lifted, the machine lets the quest go
  f.questBehaviour.update();   // and the behaviour lets its target go (DISC6's relink)
  assert.equal(questNameOf(f), null, 'the quest is gone from the table');
  assert.equal(isWorldQuestFoe(f), true, 'the ghost is still the world\'s - its puppets do not vanish mid-fight');
  assert.equal(isPrivateQuestFoe(f), false);
  // a save's foe revived before its quest is back in the table (the save's own record, through the pool's revive door)
  let loaded = false;
  const table = { getQuest: (uid) => (loaded && uid === curse.uid ? curse : null) };
  const saved = { questBehaviour: reviveQuestBehaviour(table, behaviourOf(m, ghost).getSaveData()) };
  assert.ok(saved.questBehaviour, 'revived with its quest link');
  assert.equal(isWorldQuestFoe(saved), false, 'its quest not known yet: private, as any quest foe');
  loaded = true;
  assert.equal(isWorldQuestFoe(saved), true, 'asked again once its quest is there - not held private for its life');
});

test('AUDIT CURSE-SYNC F3: IsProtectedQuest reads the one name test - a main-quest spine that faults is kept, whatever its case; any other quest that faults is ended', () => {
  // a quest whose update throws (a `remove foe` of a Foe it never declared - test/questactions.test.js's fault), by name
  const faults = (name) => {
    const m = new QuestMachine({ nowSeconds: () => 0, showPopup: () => {} });
    const q = m.scheduleQuest([`Quest: ${name}`, 'QRC:', 'Message:  1011', ' x', '', 'QBN:', ' remove foe _ghost_'], 0, { rolls: () => 0 });
    m.tick();
    return { kept: m.quests.size === 1 && !q.questTombstoned };
  };
  assert.equal(faults('__FAULT').kept, false, 'a quest of no protection is error-terminated');
  assert.equal(faults('S0000977').kept, true, 'the curse is the spine\'s - kept');
  assert.equal(faults('s0000977').kept, true, 'whatever its case, as C#');
  assert.equal(faults('_brisien').kept, true);
  assert.equal(questNameIn(['S0000977'], 's0000977'), true);
  assert.equal(questNameIn(['S0000977'], null), false, 'no name is in no list');
});

// the WORLD6b-ii rig (test/questparty.test.js): a synthetic MONSTER.BSA on flat open ground, with a net
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
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
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg({ hpPerLevel: 40 })]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const PARTY = new Set(['host-0001', 'amy-0003']);   // bob-0002 is in no party with anyone: a stranger in the streets
function pool(self, m, { peers = () => [] } = {}) {
  const pe = playerEntity();
  const sent = [];
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'world:3,12', selfId: () => self, peers, now: () => 0, staleMs: 0, onPeerHit: (hit) => { sent.push(hit); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  // the world host's own seam (world.js questShareSeam), over the real machine: the party's law for a SHARED quest
  p.setQuestShare({
    tagOf: (f) => questShareTag(m, f, PARTY.has(self)),
    accepts: (from, tag) => PARTY.has(self) && PARTY.has(from) && !!sharedQuestFoe(m, tag),   // DISC28-J: a LINKED copy
    partyPeer: (id) => PARTY.has(self) && PARTY.has(id),   // AUDIT DISC28 QS-J: an heir's taking and a kept foe's blow
    peerMayHit: (peerId, f) => PARTY.has(peerId) && f.entity?.team !== 'PlayerAlly' && !!questShareTag(m, f, PARTY.has(self)),
  });
  return { p, pe, sent };
}
/** One of `foe`'s wave stood in the pool the way world.js's quest arm stands it (questBehaviour, bound at the stand). */
const stand = (host, m, foe, at) => host.p.spawnFoe(0, at, { feetGiven: true, questBehaviour: behaviourOf(m, foe) });

test('CURSE-SYNC executed: the curse\'s ghost rides the cell untagged and a stranger in the streets stands it; a quest of the player\'s own still rides nowhere', async () => {
  const { m, ghost, rats } = quests();
  const host = pool('host-0001', m);
  const g = await stand(host, m, ghost, [100, 0, 100]);
  const own = await stand(host, m, rats, [104, 0, 100]);
  assert.ok(g?.isQuestFoe && own?.isQuestFoe, 'both are quest foes');
  const frame = host.p.foesFrame(true);
  assert.deepEqual(frame.f.map((r) => r.i), [g.seq], 'the ghost rides; the private quest\'s rat does not');
  assert.equal(frame.qf, undefined, 'untagged - no party\'s quest word, an encounter\'s record');
  const bob = pool('bob-0002', m), amy = pool('amy-0003', m);
  bob.p.applyFoes('host-0001', frame);
  amy.p.applyFoes('host-0001', frame);
  await settle();
  for (const who of [bob, amy]) {
    const pups = who.p.foes.filter((f) => f.puppet === 'host-0001' && !f.dead);
    assert.equal(pups.length, 1, 'every player in the cell sees it, in a party or not');
    assert.equal(pups[0]._pupQuest, null, 'as a plain foe');
  }
});

test('CURSE-SYNC executed: anyone\'s blow lands on the curse\'s foe, its fighters are counted as any shared foe\'s, and its fall is still its quest\'s own count; a quest of the player\'s own refuses a stranger\'s blow', async () => {
  const { m, ghost, rats } = quests();
  const host = pool('host-0001', m);
  const g = await stand(host, m, ghost, [100, 0, 100]);
  const own = await stand(host, m, rats, [104, 0, 100]);
  const hit = (from, f, dmg) => host.p.applyHit(from, { k: 'world:3,12', i: f.seq, dmg, kind: 'melee', p: [f.ai.feet[0] + 1, 0, f.ai.feet[2]], d: [1, 0, 0] });
  const o0 = own.entity.health;
  assert.equal(hit('bob-0002', own, 3), false, 'a stranger\'s blow on a private quest\'s foe is refused, as ever');
  assert.equal(own.entity.health, o0);
  const g0 = g.entity.health;
  assert.equal(hit('bob-0002', g, 3), true, 'a stranger\'s blow on the ghost lands');
  assert.ok(g.entity.health < g0);
  assert.equal(hit('amy-0003', g, 1), true, 'and a party member\'s');
  assert.equal(host.p.foesFrame(true).f.find((r) => r.i === g.seq)?.n, 2, 'two fight it (PSCALE1) - a shared foe');
  hit('bob-0002', g, 10000);
  assert.equal(g.dead, true, 'the stranger\'s blow killed it');
  host.p.update(0.05, [160, 0, 160], [160, 1.6, 160], senses(host.pe));
  host.p.update(0.05, [160, 0, 160], [160, 1.6, 160], senses(host.pe));
  assert.equal(ghost.killCount, 1, 'the quest still holds its foe - the Foe counts the kill, whoever struck it');
});

test('CURSE-SYNC executed: the curse\'s foe hunts a stranger in the streets; a quest of the player\'s own hunts no peer', async () => {
  const near = [{ id: 'bob-0002', feet: [101, 0, 100] }];
  const { m, ghost, rats } = quests();
  const host = pool('host-0001', m, { peers: () => near });
  const g = await stand(host, m, ghost, [100, 0, 100]);
  const own = await stand(host, m, rats, [100, 0, 101]);
  g.ai.isHostile = true; own.ai.isHostile = true;
  const me = [160, 0, 160];
  for (let i = 0; i < 40; i++) host.p.update(0.05, me, [me[0], 1.6, me[2]], senses(host.pe));
  assert.ok(isPeerTarget(g.ai.target), 'the ghost hunts a peer');
  assert.equal(g.ai.target.id, 'bob-0002');
  assert.ok(!isPeerTarget(own.ai.target), 'the private quest\'s foe hunts no peer: none stands a puppet of it');
});

test('CURSE-SYNC executed: the curse\'s body offers its pile and answers a stranger\'s take; a private quest\'s body answers nothing', async () => {
  const { m, ghost, rats } = quests();
  const host = pool('host-0001', m, { peers: () => [{ id: 'bob-0002', feet: [100.5, 0, 100] }] });
  const g = await stand(host, m, ghost, [100, 0, 100]);
  const own = await stand(host, m, rats, [100, 0, 100.5]);
  const hit = (f) => host.p.applyHit('bob-0002', { k: 'world:3,12', i: f.seq, dmg: 10000, kind: 'melee', p: [f.ai.feet[0] + 1, 0, f.ai.feet[2]], d: [1, 0, 0] });
  hit(g);
  own.entity.health = 0; host.p.damageFoe?.(own, 1);
  for (const f of [g, own]) { assert.equal(f.dead, true); f.entity.items = [{ templateIndex: 0, itemGroup: 4, name: 'Gold', stackCount: 5 }]; }
  host.p.update(0.05, [160, 0, 160], [160, 1.6, 160], senses(host.pe));   // the peers read once a frame - the taker's reach
  const rec = host.p.foesFrame(true).f.find((r) => r.i === g.seq);
  assert.equal(rec?.d, 1, 'its body rides');
  assert.ok(rec.o > 0, 'with its pile - a quest body advertised none, its take arm the owner\'s own');
  const take = (f) => { host.sent.length = 0; host.p.applyHit('bob-0002', { k: 'world:3,12', take: 1, i: f.seq }); return host.sent.filter((h) => h.grant !== undefined); };
  assert.equal(take(g).length, 1, 'the stranger\'s take is granted');
  assert.equal(take(own).length, 0, 'a private quest\'s body answers nothing - it never rode');
});

test('CURSE-SYNC executed: a player who leaves or falls hands the curse\'s foe to the nearest player, in a party or not; a private quest\'s goes to the party alone', () => {
  const W = rd('src/scenes/world.js');
  const body = (head) => {
    const at = W.indexOf(head);
    assert.ok(at > 0, `world.js has ${head}`);
    let depth = 0;
    for (let i = W.indexOf('{', at); i < W.length; i++) {
      if (W[i] === '{') depth++;
      else if (W[i] === '}' && --depth === 0) return W.slice(W.indexOf('{', at), i + 1);
    }
    return assert.fail('unbalanced');
  };
  const { m, ghost, rats } = quests();
  const pool = { removeFoe() {}, zeroFoeHealth() {}, foeSinks: () => ({}) };
  const bound = (foe) => { const f = { entity: { health: 10, maxHealth: 10 }, ai: { feet: [1, 0, 1] }, dead: false }; bindQuestFoeHost(f, behaviourOf(m, foe), pool); return f; };
  const g = bound(ghost), own = bound(rats);
  const near = [{ id: 'bob-0002', feet: [1, 0, 2] }, { id: 'amy-0003', feet: [9, 0, 9] }];   // the stranger nearest, the party member farther
  const social = { isPartyPeer: (id) => id === 'amy-0003' };
  const sent = [];
  const cell = new Function('modes', 'online', 'isCellRoom', 'peersNear', 'social', 'exteriorFoes', 'isPrivateQuestFoe', `return () => ${body('const handOverFoes = () =>')};`)(
    { mode: 'exterior' }, { room: 'world:3,12', sendFoes: (f) => { sent.push(f); return true; } }, () => true, () => near, social,
    { handOverFrame: (heirOf) => ({ f: [heirOf(g), heirOf(own)] }), dropOwnLive: () => 2 }, isPrivateQuestFoe);
  assert.equal(cell(), 2);
  assert.deepEqual(sent.at(-1).f, ['bob-0002', 'amy-0003'], 'the cell\'s: the ghost to the nearest player, the private quest\'s foe to the party');
  const room = new Function('modes', 'online', 'isWorldRoom', 'peersNear', 'social', 'isPrivateQuestFoe', `return () => ${body('const handOverRoomFoes = () =>')};`)(
    { mode: 'interior', ownHandOverFrame: (heirOf) => ({ f: [heirOf(g), heirOf(own)] }), dropOwnHanded: () => 2 },
    { room: 'world:bld:7', ownOk: true, sendOwnFoes: (f) => { sent.push(f); return true; } }, () => true, () => near, social, isPrivateQuestFoe);
  assert.equal(room(), 2);
  assert.deepEqual(sent.at(-1).f, ['bob-0002', 'amy-0003'], 'and a world room\'s, by the same word');
});

test('CURSE-SYNC by source: the pool\'s gates and the world host\'s handover read one word - a PRIVATE quest\'s foe, never any quest\'s', () => {
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /const _qTag = \(f\) => \(!f \|\| f\.puppet \? null : isPrivateQuestFoe\(f\) \? /, 'the party\'s word is asked of a private quest\'s foe alone');
  assert.match(x, /const _questLike = \(f\) => !!f && \(isPrivateQuestFoe\(f\) \|\| !!f\._keptTag\);/, 'what rides, whose blow lands, whom it hunts');
  assert.match(x, /&& \(!!f\.puppet \|\| \(\(!isPrivateQuestFoe\(f\) \|\| !!_qTag\(f\)\) && !\(f\.placed && !f\.site\)\)\);/, 'a shared foe (PSCALE1)');
  const w = rd('src/scenes/world.js');
  const heirs = w.match(/const heirOf = \(f\) => \{[^\n]*\}; /g) ?? [];
  assert.equal(heirs.length, 2, 'the cell\'s handover and the world room\'s');
  for (const h of heirs) {
    assert.match(h, /if \(\(isPrivateQuestFoe\(f\) \|\| f\._keptTag\) && !social\?\.isPartyPeer\(q\.id\)\) continue;/, 'a world quest\'s foe goes to the nearest player, as an encounter\'s');
    assert.doesNotMatch(h, /f\.isQuestFoe/);
  }
});
