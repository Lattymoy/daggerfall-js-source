// AUDIT SETS (2026-09-28, Mac: "1. Audit this properly 2. Ensure online functionality is perfect"): the Sigil Sets'
// powers and the Aetheric pieces, audited online against RAID4b's tree and each finding pinned here. The powers are
// driven through the real seams (systems/sigil/sigilSetPowers.js) with a stand-in host door and the test's own clock; the
// wire's foe record and a building's loot word through their own pure doors; the hosts' wiring by source.
// bible/11-Multiplayer/Sigil-Sets.md, "AUDIT SETS".
//   M1 a foe's MAXIMUM health rides its record - "under half" is its owner's word, not this machine's roll;
//   M2 a room's loot word this build cannot read is never opened, claimed or closed over;
//   L1 No Escape's mark ends with its foe;  L2 "The Broken Oath brightens", never "Your The ...";
//   L3 a guard's blow the arrest flow holds back is heard when it lands;  L4 a warded blow spends no power;
//   L5 the mark's line only for a new mark, "ready again" only for a worn power (Iron Hide's once its ward is spent);
//   L6 an Aetheric piece off the wire carries its record's affixes and blow.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT: the host WHOLE
import {
  setBlow, setStruck, setRound, setHudChips, setSetPowersVoice, markedFoe, heldPlayerBlow, remarkPlayerBlow, BLOW_WINDOW_S,
  _setSetPowersClockForTests, _resetSetPowersForTests,
} from '../../src/systems/sigil/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, SIGIL_STAGES, _resetSigilForTests } from '../../src/systems/sigil/sigil.js';
import { setRiseLine, MARK_SECONDS, RIPOSTE_SECONDS, _resetSigilSetsForTests } from '../../src/systems/sigil/sigilSets.js';
import { AETHERIC_RECORDS, mintAetheric, validSetMarks, REGALIA_SET } from '../../src/systems/aetheric.js';
import { AFFIX_RANGES } from '../../src/systems/loot/lootRarity.js';
import { validFoeRecord, FOE_HEALTH_MAX } from '../../src/net/wire.js';
import { applyInteriorLoot, mintInteriorShared } from '../../src/world/interior/interiorShared.js';
import { LOOT_NEWER_TEXT } from '../../src/systems/loot/loot.js';
import { hurtPlayer } from '../../src/characters/playerEntity.js';
import { reportPlayerKill } from '../../src/systems/playerKills.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { equipItem, unequipItem } from '../../src/systems/equip.js';
import { mintCondition } from '../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({
  isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [],
  health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const BODY = [107, 106, 105, 102, 103, 104, 108];
const piece = (templateIndex, set) => { const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 }); it.rarity = 'rare'; it.sigil = { set, party: 1, xp: 0 }; return it; };
const wearSet = (e, set, n) => { for (const t of BODY.slice(0, n)) { const it = piece(t, set); e.items.push(it); equipItem(e, it); } return e; };
const sword = () => createWeapon(120, 0, () => 0.5);
const RAT = Object.freeze({ name: 'rat' });
let T = 0;
_setSetPowersClockForTests(() => T);
const at = (t) => { T = t; };
function fresh() {
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); setPlayerDoor(null); at(0);
  const v = { said: [], sounds: [] };
  setSetPowersVoice({ say: (l) => v.said.push(l), sound: (n) => v.sounds.push(n) });
  setSigilOnline(true); setSigilRenown(1);
  return v;
}
const foe = (name, x) => ({ name, entity: { name, health: 50, maxHealth: 50 }, ai: { feet: [x, 0, 0] }, dead: false });
function door(foes, me) {
  setPlayerDoor({ foes: () => foes.filter((f) => !f.dead && f.entity), feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => me });
}

// ═══ THE POWERS ═══════════════════════════════════════════════════════════════════════════════════

test('AUDIT SETS L1 + L5: NO ESCAPE\'S MARK ENDS WITH ITS FOE - killed by me or by anyone (its body read, not its clock), its chip gone; the same foe marked again renews its time and says nothing (mutants: the mark on a body; the kill of the marked foe leaving it; the line said for every re-mark)', () => {
  const v = fresh();
  const e = wearSet(player(), 'thieftaker', 6);
  const first = foe('first', 1), b = foe('b', 5), c = foe('c', 9);
  door([first, b, c], e);
  at(10);
  reportPlayerKill(first.entity);
  assert.equal(markedFoe(), b.entity);
  first.dead = true;
  assert.equal(v.said.length, 1);
  const again = foe('again', 1);
  door([again, b, c], e);
  at(12);
  reportPlayerKill(again.entity);
  assert.equal(markedFoe(), b.entity, 'the nearest is b again');
  assert.equal(v.said.length, 1, 'renewed, not said again (L5)');
  assert.equal(v.sounds.length, 1);
  at(12 + MARK_SECONDS - 1);
  assert.equal(markedFoe(), b.entity, 'its time renewed from the second kill');
  // I kill the marked foe, nothing else in reach: the mark ends with it
  door([b], e);
  reportPlayerKill(b.entity);
  assert.equal(markedFoe(), null, 'its own death ends its mark (L1)');
  assert.deepEqual(setHudChips(e), [], 'and its chip');
  // a peer kills it: its body is read
  const d = foe('d', 2), x = foe('x', 1);
  door([x, d], e);
  reportPlayerKill(x.entity);
  assert.equal(markedFoe(), d.entity);
  d.entity.health = 0;
  assert.equal(markedFoe(), null, 'a body is no mark');
});

test('AUDIT SETS L5: "READY AGAIN" ONLY FOR A POWER WORN AND AWAKE - never with its set taken off or asleep in a duel; Iron Hide\'s only once its ward is spent (mutants: said with the set off; said over a standing ward)', () => {
  const v = fresh();
  const e = wearSet(player(), 'orcsbane', 6);
  door([], e);
  at(100);
  reportPlayerKill(RAT);
  assert.deepEqual(v.said, ['Iron Hide! The next 10 damage is blocked.']);   // PIN MOVED (VOICE2): no dash aside (Voice.md rule 5)
  at(200);
  setRound(e);
  assert.equal(v.said.length, 1, 'the ward still stands: nothing to be ready for');
  const w = fresh();
  const o = wearSet(player(), 'orcsbane', 6);
  door([], o);
  at(100);
  reportPlayerKill(RAT);
  hurtPlayer(o, 20);   // the ward spent
  for (const it of [...o.items]) unequipItem(o, it);   // the set taken off
  at(200);
  setRound(o);
  assert.equal(w.said.length, 1, 'the set off: nothing said');
  const z = fresh();
  const p = wearSet(player(), 'orcsbane', 6);
  door([], p);
  at(100);
  reportPlayerKill(RAT);
  hurtPlayer(p, 20);
  at(200);
  setRound(p);
  assert.deepEqual(z.said.slice(1), ['Iron Hide is ready again.'], 'worn, spent, recovered: said');
});

test('AUDIT SETS L2: A SET\'S RISE LINE READS - "The Broken Oath brightens: Kindled.", never "Your The Broken Oath"; a set whose name is no "The ..." keeps its "Your" (mutants: the "Your" on every name)', () => {
  fresh();
  setSigilRenown(99);
  assert.equal(setRiseLine('oath', 1), `The Broken Oath brightens: ${SIGIL_STAGES[1].name}.`);
  assert.equal(setRiseLine('thieftaker', 1), `The Thief-Taker's Garb brightens: ${SIGIL_STAGES[1].name}.`);
  assert.equal(setRiseLine(REGALIA_SET, 1), `Your Ruhn's Regalia brightens: ${SIGIL_STAGES[1].name}.`);
});

test('AUDIT SETS L3: A GUARD\'S BLOW THE ARREST FLOW HOLDS BACK is heard when it lands - held, then marked again as it lands, it opens Riposte; withheld, its mark is the door\'s "nothing" and never the next hurt\'s; both hosts do so (mutants: the mark not held; not marked again; the withheld blow\'s mark left lying)', () => {
  fresh();
  const e = wearSet(player(), 'oath', 4);
  door([], e);
  const s = sword();
  at(0);
  setStruck(RAT, e, 5);
  const held = heldPlayerBlow();
  assert.deepEqual(held, { attacker: RAT }, 'the struck tail\'s mark, kept');
  at(3);   // the surrender box, answered "fight on"
  remarkPlayerBlow(held);
  hurtPlayer(e, 5);
  assert.equal(setBlow(s, 100, e, RAT, {}), 115, 'Riposte opened by the blow as it landed (+15% at Faint)');
  at(3 + RIPOSTE_SECONDS + 1);
  setStruck(RAT, e, 5);
  at(3 + RIPOSTE_SECONDS + 1 + BLOW_WINDOW_S * 2);
  hurtPlayer(e, 5);
  assert.equal(setBlow(s, 100, e, RAT, {}), 100, 'a mark left lying past the window is nobody\'s');
  assert.equal(heldPlayerBlow(), null, 'and none is held once taken');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const w = read(host);
    assert.match(w, /const held = heldPlayerBlow\(\);[^\n]*\n\s*const apply = \(\) => \{\n\s*remarkPlayerBlow\(held\);/, `${host}: held, and marked again as it lands`);
    assert.match(w, /if \(!arrestFlow\.onGuardHit\(dmg, apply, hit\)\) apply\(\);\n\s*else playerBlowCameToNothing\(playerEntity\);/, `${host}: withheld, the door's nothing`);   // WERE-FRIGHT: the striker's level (`hit`) rides to the flow
  }
});

test('AUDIT SETS L4: A BLOW THE WARDEN\'S WARD TURNS spends no power - Riposte stays for the next blow that lands; the court\'s ward rides his stand-in (mutants: a warded blow modded; the ward left off the stand-in)', () => {
  fresh();
  const e = wearSet(player(), 'oath', 4);
  door([], e);
  at(0);
  setStruck(RAT, e, 5);
  hurtPlayer(e, 5);
  const s = sword();
  assert.equal(setBlow(s, 100, e, { name: 'the Warden', warded: true }, {}), 100, 'turned whole: no Riposte on it');
  assert.equal(setBlow(s, 100, e, RAT, {}), 115, 'and the next blow that lands has it');
  assert.match(read('src/scenes/dungeonContext.js'), /b\.entity\.warded = !!b\.warded;/);
});

// ═══ THE WIRE AND THE ROOM ═══════════════════════════════════════════════════════════════════════

test('AUDIT SETS M1: A FOE\'S MAXIMUM HEALTH RIDES ITS RECORD (`k`) - bounded as its health is; the exterior owner and the dungeon host say it, the puppet and the guest\'s copy take it, so Run Them Down reads the OWNER\'s "under half" (mutants: `k` unbounded; unsaid; untaken)', () => {
  assert.deepEqual(validFoeRecord({ i: 1, h: 40, k: 70 }), { i: 1, h: 40, k: 70 });
  for (const k of [0, -5, FOE_HEALTH_MAX + 1, NaN, '70']) assert.equal(validFoeRecord({ i: 1, k }), null, `k=${String(k)}`);
  const ext = read('src/scenes/exteriorFoes.js'), dun = read('src/scenes/dungeonContext.js');
  assert.match(ext, /\.\.\.\(Number\.isFinite\(f\.entity\.maxHealth\) && f\.entity\.maxHealth >= 1 \? \{ k: Math\.min\(FOE_HEALTH_MAX, f\.entity\.maxHealth\) \} : \{\}\)/, 'the owner says it');
  assert.match(ext, /if \(r\.k !== undefined\) f\.entity\.maxHealth = r\.k;/, 'the puppet takes it');
  assert.match(dun, /if \(owesMax\) \{ r\.k = max; f\._maxSent = max; _maxLeft--; \}/, 'the host says it - on a delta while owed (test/net/restsync.test.js)');
  assert.match(dun, /r\.k = max; f\._maxSent = max; room -= 5 \+ String\(max\)\.length;/, 'and on a full frame while its room holds it');
  assert.match(dun, /if \(Number\.isFinite\(r\.k\)\) f\.entity\.maxHealth = r\.k;/, 'the guest\'s copy takes it');
  // the law it feeds: a raider at 40 of its owner's 70 is NOT under half, whatever my roll of 100 said
  fresh();
  const e = wearSet(player(), 'thieftaker', 4);
  door([], e);
  const puppet = { name: 'raider', health: 40, maxHealth: 100 };
  assert.equal(setBlow(sword(), 100, e, puppet, {}), 108, 'my roll: under half');
  puppet.maxHealth = validFoeRecord({ i: 1, h: 40, k: 70 }).k;
  assert.equal(setBlow(sword(), 100, e, puppet, {}), 100, 'the owner\'s: not');
});

test('AUDIT SETS M2: A ROOM\'S WORD THIS BUILD CANNOT READ - a newer game\'s item in a building\'s container - marks the container spoken and unreadable, never landed; a word it can read lands and clears it; neither host claims, closes over or opens one (mutants: the unreadable forgotten; the claim made over it; the close said over it; the dungeon\'s opened)', () => {
  const s = mintInteriorShared('b:1:2:3');
  assert.ok(s.unreadable instanceof Set);
  const box = { items: [{ name: 'mine' }] };
  const ctx = { shelves: [], containers: [box] };
  const today = 10;
  const bad = [{ k: 'container:0', r: [{ group: 'Weapons', templateIndex: 9999, sigil: { set: 'from-the-future' } }], d: today }];
  assert.equal(applyInteriorLoot(ctx, bad, { seen: s.seen, today, unreadable: s.unreadable }), 0);
  assert.ok(s.seen.has('container:0'), 'the room HAS spoken about it - this build will not claim it with its own roll');
  assert.ok(s.unreadable.has('container:0'));
  assert.deepEqual(box.items, [{ name: 'mine' }], 'nothing landed');
  assert.equal(applyInteriorLoot(ctx, [{ k: 'container:0', r: [], d: today }], { seen: s.seen, today, unreadable: s.unreadable }), 1);
  assert.equal(s.unreadable.has('container:0'), false, 'a word it can read again clears it');
  const wm = hostText('src/scenes/worldModes.js'), pure = read('src/world/interior/interiorShared.js'), dun = read('src/scenes/dungeonContext.js');   // PIN MOVED (OUTDOOR-LOOT): the building's loot doors stand in world/interior/interiorShared.js now (HOST-SPLIT moved them out of createWorldModes)
  assert.match(pure, /if \(bag\.unreadable\?\.has\(canon\)\) return false;   \/\/ AUDIT SETS M2/, 'never claimed or closed over in a building');
  assert.match(wm, /\{ \.\.\._intShared, from: id, today: stockedToday\(\), carried: carriedPieces\(playerEntity\) \}\)/, 'the building\'s bag whole - its set of the unreadable among it - handed to the door');   // PIN MOVED (AUTO-HOLD): and the pieces I carry beside it   // PIN MOVED (OUTDOOR-LOOT): the bag whole, and the sender
  // OUTDOOR-LOOT (DESIGN 4.6): and a cupboard the room spoke about in words this build cannot read is NEVER OPENED - not over a roll of its own either
  assert.match(wm, /if \(_intShared\?\.unreadable\?\.has\(key\)\) \{ setMidScreenText\(LOOT_NEWER_TEXT\); return true; \}/, 'the press says the newer-version line and opens nothing');
  assert.match(dun, /if \(!items\) \{ if \(lootHolder\(canon\) && !respawnDue\(rec\.t, _wallNow\(\)\)\) \{ _lootSeen\.add\(canon\); _lootUnreadable\.add\(canon\); \} continue; \}/, 'a word due back (WORLD8) locks nothing');
  assert.match(dun, /if \(_lootUnreadable\.has\(canon\)\) return false;   \/\/ AUDIT SETS M2/, 'never claimed or closed over in a dungeon');
  assert.match(dun, /if \(_u && _lootUnreadable\.has\(lootKeyOf\(_u\)\)\) \{ setMidScreenText\(LOOT_NEWER_TEXT\); return 0; \}/, 'nor opened');   // PIN MOVED BACK (AUDIT GRAVE-PARTY G2): GRAVE-PARTY opened a room container as the player's own here - an online pile is built empty, so it opened empty, or its base unclaimed; M2's refusal stands for every container again (test/systems/fb1016b_graveparty.test.js)
  assert.match(LOOT_NEWER_TEXT, /newer version of the game/);
});

test('AUDIT SETS L6: AN AETHERIC PIECE OFF THE WIRE CARRIES ITS RECORD\'S AFFIXES AND BLOW - the kinds in the record\'s order and none past its value (the Regalia\'s bounded by the band alone: a piece minted when its fire stood at the band\'s top is no forgery); a weapon\'s blow the record\'s (mutants: the values unchecked; the kinds unchecked; the blow unchecked; the Regalia\'s legacy fire refused)', () => {
  const oath = AETHERIC_RECORDS.find((r) => r.id === 'oath-helm') ?? AETHERIC_RECORDS.find((r) => r.set === 'oath' && r.group === 'Armor');
  const ok = mintAetheric(oath);
  assert.ok(validSetMarks(structuredClone(ok)), 'as minted');
  const pumped = structuredClone(ok);
  pumped.affixes[0].value = AFFIX_RANGES[pumped.affixes[0].id].legendary[1];
  if (pumped.affixes[0].value > ok.affixes[0].value) assert.equal(validSetMarks(pumped), null, 'a value past the record\'s');
  const other = structuredClone(ok);
  const withParam = other.affixes.find((a) => a.param !== undefined && a.id === 'stat');
  withParam.param = withParam.param === 'strength' ? 'luck' : 'strength';
  withParam.value = 1;
  assert.equal(validSetMarks(other), null, 'another kind in its place, however small');
  const short = structuredClone(ok);
  short.affixes = short.affixes.slice(1);
  assert.equal(validSetMarks(short), null, 'one missing');
  const extra = structuredClone(ok);
  extra.affixes = [...extra.affixes, { id: 'stat', param: 'luck', value: 1 }];
  assert.equal(validSetMarks(extra), null, 'one too many');
  const blade = mintAetheric(AETHERIC_RECORDS.find((r) => r.set === 'oath' && r.group === 'Weapons'));
  assert.ok(validSetMarks(structuredClone(blade)));
  const forged = structuredClone(blade);
  forged.sigil.power += 5;
  assert.equal(validSetMarks(forged), null, 'a blow past its record\'s');
  const crown = mintAetheric(AETHERIC_RECORDS.find((r) => r.id === 'ruhn-horned-crown'));
  const legacy = structuredClone(crown);
  const fire = legacy.affixes.find((a) => a.id === 'resist');
  fire.value = AFFIX_RANGES.resist.legendary[1];
  assert.ok(validSetMarks(legacy), 'the Regalia\'s fire at the band\'s top: minted before 322370d2, no forgery');
});
