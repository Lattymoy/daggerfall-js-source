// LOOT7-CHECK - THE CHAMPIONS CHECKED (2026-10-01; bible/06-Systems/Loot-Arc.md section 17). Mac: "I want to check and see
// if the special enemy types from our recent loot commit is working properly", then "Yes and fix the smaller things.
// Just want this to be as detailed as possible". LOOT7's champions were driven through the real combat formula (the
// five traits each did what its sentence says) and four things were found and fixed - each pin below failed on the code
// before it:
//   - CORPSE-FIND: the corpse door rolled a COPY of the body's carried loot, and the door's unique find (the Dwarven
//     Thunderlock and its pellets) was pushed onto the copy and thrown away - no body ever kept one, and a champion's
//     body (its source four tiers up, so always past the find's tier 4) was where it was likeliest.
//   - CHAMP-HOVER: the World Tooltips plaque never names a HOSTILE foe (the mod's .cs:304-312), so a living champion's
//     name - its trait - was never on it; a champion was made the mod's one recorded exception. HOVER-PLAIN (2026-10-03,
//     Mac: "remove the crosshair tooltip. They should only have names/modifiers under their healthbar") retired it.
//   - CHAMP-SAID: the plaque and the target frame are the ENHANCED skin's, so on the classic skin nothing said a
//     champion stood until it died, and no screen said what a trait does; the first blow either way now says both on
//     the line every skin draws (DaggerfallUI.PopupMessage).
//   - DUNGEON-DIED: the dungeon never said EnemyDeath's kill notice ("%s just died.") for any foe - so no dungeon
//     champion's name was ever said at its death; it says it now, mine alone, and the striker's at the striker.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as CH from '../src/systems/champions.js';
import * as LR from '../src/systems/lootRarity.js';
import { isThunderlock, isPellet } from '../src/systems/thunderlock.js';   // imported, it registers its unique find
import { spawnEnemyLoot } from '../src/scenes/hostCombat.js';
import { equipTableOf } from '../src/systems/equip.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ENEMY_BASICS, enemyDisplayName } from '../src/characters/enemyBasics.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { calculateAttackDamage } from '../src/combat/formulas.js';
import { ARENA_PUPPET_OWNER } from '../src/net/arenaLaw.js';   // ARENA4: the kill door's puppet test, the real owner word (no puppet here)
import { playerEntity } from '../src/characters/playerEntity.js';
import { registerPresenter, _resetNotifyForTests } from '../src/systems/notify.js';
import { mobileEntityName, liveEntityName } from '../src/systems/worldTooltips.js';
import { resolveHover } from '../src/systems/worldHover.js';
import { markFoeStruck, foeTarget, clearFoeTarget } from '../src/ui/hudFoeTarget.js';   // HOVER-PLAIN: the name's one place
import { MOBILE_NPC_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { sayEnemyDied } from '../src/scenes/corpseMarker.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import { validFoeRecord } from '../src/net/wire.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const on = () => { _resetForTests(); setPref('lootRarity', true); CH._resetStreetChampionsForTests(); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
/** A real orc (ENEMY002's row, the 50s career) at level 10 - a champion of the trait given, or none. */
const orc = (trait = null) => { const e = makeEnemyEntity(7, ENEMY_BASICS[7], null, 10, lcg(9)); if (trait != null) CH.applyChampion(e, trait); return e; };
const said = (it) => [it.templateIndex, it.name ?? null, it.rarity ?? null, it.legendary ?? null, it.stackCount ?? null, JSON.stringify(it.affixes ?? null)];
const player = { level: 10, gender: 'male', stats: { luck: 50 }, activeEffects: [] };

test('LOOT7-CHECK CORPSE-FIND: a body keeps its unique find - the Thunderlock and its pellets - as the list door keeps it, seed for seed; through the spawn seam a champion\'s body carries it; off, nothing', () => {
  on();
  // THE SAME SEEDS THROUGH BOTH DOORS: a champion orc's body (its source four tiers up and half again its quality)
  // against the list door handed that same source - every piece and every find the list keeps, the body keeps
  let finds = 0;
  for (let seed = 1; seed <= 6000; seed++) {
    const body = { items: [createWeapon(113, 1)], level: 12, mobileType: 7, champion: 'mighty' };
    LR.rollCorpseLoot(body, { level: 12 }, { rolls: lcg(seed), luck: 50 });
    const src = LR.corpseSource({ level: 12 }, 12, 7);
    const list = [createWeapon(113, 1)];
    LR.rollLootRarity(list, { ...src, tier: src.tier + LR.CHAMPION_SOURCE.tier, qualityMult: LR.CHAMPION_SOURCE.quality }, { rolls: lcg(seed), luck: 50 });
    assert.deepEqual(body.items.map(said), list.map(said), `seed ${seed}: the body is the list`);
    if (body.items.some(isThunderlock)) {
      finds++;
      assert.ok(body.items.some(isPellet), `seed ${seed}: it arrives loaded`);
    }
  }
  assert.ok(finds >= 15, `the find comes to bodies (${finds} in 6,000 - about 5.6 per thousand at tier 16)`);
  // A FORCED FIND ON A BODY THAT WEARS ITS KIT: onto the body, the worn pieces untouched; a body with no list gets one
  const kitted = { items: [], level: 21, mobileType: 7 };
  const wornSword = createWeapon(113, 1);
  kitted.items.push(wornSword);
  equipTableOf(kitted)[5] = wornSword;
  LR.rollCorpseLoot(kitted, { level: 21, affinity: 'Daedra' }, { rolls: () => 0.0001, luck: 100 });
  assert.ok(kitted.items.some(isThunderlock) && kitted.items.some(isPellet), 'the find on the body');
  assert.equal(kitted.items[0], wornSword, 'the kit where it was');
  assert.equal(wornSword.rarity, undefined, 'and never rolled (LR4)');
  const bare = { level: 21, mobileType: 7 };
  LR.rollCorpseLoot(bare, { level: 21, affinity: 'Daedra' }, { rolls: () => 0.0001, luck: 100 });
  assert.ok(Array.isArray(bare.items) && bare.items.some(isThunderlock), 'a body with no list gets one, its find on it');
  // THE SPAWN SEAM, end to end: a champion orc's spawn on a stream that finds everything
  const champ = orc(0);
  spawnEnemyLoot(champ, 7, ENEMY_BASICS[7], player, { rolls: () => 0.0001 });
  const lock = champ.items.find(isThunderlock);
  assert.ok(lock, 'the champion\'s body carries the Thunderlock');
  assert.equal(lock.untaken, true, 'a found piece, counted for the drought at its take (LOOT8)');
  assert.ok(champ.items.some(isPellet), 'and its pellets');
  off();
  const offBody = { items: [createWeapon(113, 1)], level: 21, mobileType: 7 };
  LR.rollCorpseLoot(offBody, { level: 21, affinity: 'Daedra' }, { rolls: () => 0.0001, luck: 100 });
  assert.equal(offBody.items.length, 1, 'off: DFU\'s list, nothing added');
  const src = strip(read('src/systems/lootRarity.js'));
  assert.match(src, /if \(loot\.length > carried\) \(entity\.items \?\?= \[\]\)\.push\(\.\.\.loot\.slice\(carried\)\);/, 'what the roll added past the carried pieces goes onto the body');
});

test('HOVER-PLAIN (CHAMP-HOVER retired): a hostile champion, elite or revenant says nothing on the plaque, as any hostile foe; at peace named as ever; its name is the health bar\'s; all four live arms tell the door hostility alone, and the street\'s and the dungeon\'s a kneeling revenant done fighting', () => {
  on();
  // the law at its one home
  assert.equal(mobileEntityName('Rat', { hostile: true }), null, 'a hostile foe: nothing (.cs:304-312)');
  assert.equal(mobileEntityName('Knight', { hostile: false }), 'Knight', 'a foe at peace: named, as ever');
  // real special foes, through the hosts' own composition
  const name = (f) => mobileEntityName(liveEntityName(f, enemyDisplayName(f.mobileType)), { hostile: !!f.ai?.isHostile });
  const champ = { entity: orc(0), mobileType: 7, ai: { feet: [0, 0, 3], isHostile: true } };
  const elite = { entity: { ...orc(), eliteFoe: true }, mobileType: 7, ai: { feet: [0, 0, 3], isHostile: true } };
  assert.equal(champ.entity.champion, 'mighty', 'a champion stands');
  assert.equal(name(champ), null, 'a hostile champion: nothing');
  assert.equal(name(elite), null, 'a hostile elite: nothing');
  assert.equal(name({ ...champ, ai: { isHostile: false } }), 'Mighty Orc', 'at peace (calmed): named as ever, its trait too');
  assert.equal(name({ entity: { ...orc(), revenant: { id: 'r1', name: 'Grushnak the Kinslayer', rank: 1, sworn: true } }, mobileType: 7, ai: { isHostile: false } }), 'Grushnak the Kinslayer', 'a sworn companion: by its own name (revenantCompanions applySwornStrength)');
  // ...and so nothing onto the plaque's frame
  const namer = () => { const t = name(champ); return t ? { title: t } : null; };
  assert.equal(resolveHover({ key: 'mobileFoe:0', distance: 3, reach: MOBILE_NPC_ACTIVATION_DISTANCE }, { name: namer }), null, 'the plaque says nothing');
  // ...while the health bar names it, trait and all
  markFoeStruck({ entity: { ...champ.entity, name: 'Orc' } });
  assert.equal(foeTarget().name, 'Mighty Orc', 'the target frame: its name and its trait');
  clearFoeTarget();
  off();
  // the four live arms, each telling the door hostility alone - and the two that stand revenants, that a kneeling one
  // (its motor still hostile: revenantFate.beginYield never clears it) is done fighting, so its "- beaten" cue reads
  for (const [f, v, done] of [['src/scenes/exteriorFoes.js', 'f', ' && !f.yielded && !f._pupYield'], ['src/scenes/worldModes.js', 'f', ''], ['src/scenes/dungeonContext.js', 'f', ' && !f.yielded'], ['src/scenes/cityGuards.js', 'g', '']]) {
    const esc = done.replace(/[.?]/g, (c) => `\\${c}`);
    assert.match(read(f), new RegExp(String.raw`mobileEntityName\(liveEntityName\(${v}, enemyDisplayName\(${v}\.mobileType\)\), \{ hostile: !!${v}\.ai\?\.isHostile${esc} \}\)`), f);
  }
  assert.match(read('src/scenes/exteriorFoes.js'), /return t \? \{ title: f\.yielded \|\| f\._pupYield \? `\$\{t\} - beaten` : t \} : null;/, 'the street\'s cue');
  assert.match(read('src/scenes/dungeonContext.js'), /return t \? \{ title: f\.yielded \? `\$\{t\} - beaten` : t \} : null;/, 'the dungeon\'s cue');
  // WHY THE LINE BELOW EXISTS TOO: the plaque is the enhanced skin's - on the classic skin it never draws a name
  assert.match(strip(read('src/ui/worldPlaque.js')), /_gateOn = isEnhanced\(\) && !isTouchDevice\(\);/, 'the plaque: the enhanced skin\'s');
  assert.match(strip(read('src/ui/worldPlaque.js')), /export const classicPlaqueOn = \(\) => !isEnhanced\(\) && !isTouchDevice\(\) && quickLootOn\(\);/, 'the classic face: quick loot\'s piles alone');
});

test('LOOT7-CHECK CHAMP-SAID: the first blow either way says a champion on the line every skin draws - who, then what its trait does; once; never a plain foe, a peer\'s copy or a peer\'s blow; off, nothing', () => {
  on();
  // THE ROWS, golden: the name the death line says, then the trait's own sentence
  assert.deepEqual(CH.CHAMPION_TRAITS.map((t, i) => CH.championLines(orc(i))), [
    ['Mighty Orc stands as a champion.', 'Its blows land half again as hard.'],
    ['Stalwart Orc stands as a champion.', 'Half again its health, on top of a champion\'s double.'],
    ['Swift Orc stands as a champion.', 'Thirty more Speed: it closes, and it swings, sooner.'],
    ['Vampiric Orc stands as a champion.', 'Half of what its blows take from you heals it.'],
    ['Thorned Orc stands as a champion.', 'Your blows that land on it hurt you back, a seventh of them.'],
  ]);
  assert.equal(CH.championLines(orc()), null, 'a plain foe: none');
  assert.equal(CH.championLines(null), null);
  // THROUGH THE REAL BLOWS: the live host's line (a presenter, as the dungeon and the town register theirs)
  _resetNotifyForTests();
  const lines = [];
  const unregister = registerPresenter({ hudText: (l) => { lines.push(l); return true; } });
  try {
    playerEntity.level = 10;
    const land = (attacker, target) => { for (let s = 1; s <= 400; s++) if ((calculateAttackDamage(attacker, target, { rolls: lcg(s) }) || 0) > 0) return true; return false; };
    for (let t = 0; t < CH.CHAMPION_TRAITS.length; t++) {
      playerEntity.health = playerEntity.maxHealth = 100000;
      const c = orc(t);
      lines.length = 0;
      assert.ok(t % 2 ? land(playerEntity, c) : land(c, playerEntity), `trait ${t}: a blow landed`);
      assert.deepEqual(lines, CH.championLines(c), `trait ${t}: said at the first blow ${t % 2 ? 'of mine on it' : 'of its on me'}`);
      land(c, playerEntity); land(playerEntity, c);
      assert.equal(lines.length, 2, `trait ${t}: once`);
    }
    lines.length = 0;
    assert.ok(land(orc(), playerEntity) && land(playerEntity, orc()));
    assert.deepEqual(lines, [], 'a plain foe: nothing');
    assert.ok(land(orc(3), { ...playerEntity, peer: true }));
    assert.deepEqual(lines, [], 'its blow on a PEER\'s copy: another player\'s screen is theirs');
    assert.ok(land({ ...playerEntity, peer: true }, orc(4)), 'a peer\'s blow lands');
    assert.deepEqual(lines, [], 'a peer\'s blow resolved here: nothing of mine');
    off();
    playerEntity.health = 100000;
    assert.ok(land(orc(0), playerEntity));
    assert.deepEqual(lines, [], 'off: no champion stands, nothing said');
  } finally { unregister(); }
  on();
  // ONCE PER CHAMPION - a rebuild or a load is a new one, and says it again
  const heard = [];
  const c = orc(2);
  assert.equal(CH.sayChampion(c, (l) => heard.push(l)), true);
  assert.equal(CH.sayChampion(c, (l) => heard.push(l)), false, 'once');
  assert.equal(CH.sayChampion(orc(2), (l) => heard.push(l)), true, 'a new one: again');
  assert.equal(heard.length, 4);
  assert.equal(CH.sayChampion(orc(), (l) => heard.push(l)), false, 'never a plain foe');
  const src = strip(read('src/systems/champions.js'));
  assert.match(src, /registerPlayerStruckListener\(CHAMPIONS_SAID, \(attacker, target, damage\) => \{ if \(damage > 0 && target\?\.isPlayer && !target\.peer\) sayChampion\(attacker\); \}\);/);
  assert.match(src, /registerPlayerStrikeListener\(CHAMPIONS_SAID, \(attacker, target, damage\) => \{ if \(damage > 0 && attacker\?\.isPlayer && !attacker\.peer\) sayChampion\(target\); \}\);/);
  assert.match(src, /export function sayChampion\(entity, say = popupMessage\) \{/, 'the live host\'s line - DaggerfallUI.PopupMessage - unless a caller hands its own');
});

// ── the dungeon's two death doors, lifted from src/ and run (audit68_dungeonctx's law: the statements are src's) ──
const D = read('src/scenes/dungeonContext.js');
const AST = acorn.parse(D, { ecmaVersion: 'latest', sourceType: 'module' });
function find(pred) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(AST);
  return hit;
}
const fnSrc = (name) => { const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name); assert.ok(n, `src has function ${name}`); return D.slice(n.start, n.end); };
const declSrc = (name) => { const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)); assert.ok(n, `src declares ${name}`); return D.slice(n.start, n.end); };
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const foeRec = (mobileType = 0, entity = {}) => ({
  mobileType, dead: false, gender: 'male',
  entity: { health: 5, maxHealth: 5, level: 5, items: [], activeEffects: [], stats: { willpower: 50 }, career: {}, skills: {}, ...entity },
  ai: { feet: [0, 0, 0], yaw: 0, isHostile: true, target: null },
});
/** damageFoe, the host's kill door - its death arm whole, the doors around it stubbed. */
function killDoor() {
  const hud = [];
  const state = {
    foes: [], _authority: true, ARENA_PUPPET_OWNER, opts: {}, lastPlayerFeet: [0, 0, 0], _ecvT: 0, foeDeps: null, playerEntity: { isPlayer: true, items: [] }, audio: {},
    renownFoeStruck: () => {}, renownFoeDied: () => {}, reportPlayerKill: () => {}, takeWholeBlow: () => false, markFoeStruck: () => {}, markConcealedHit: () => {},
    handleAttackFromPlayer: () => {}, damageShieldPool: (e, n) => n, noteFighter: () => {}, PARTY_ME: 'me', _sharedFoe: () => false, partyFoeLoses: (f, n) => n, fightN: () => 1,
    peerSoulTrapOf: () => null, attemptSoulTrap: () => ({ allowDeath: true }), isAzurasStarEquipped: () => false, fillEmptyTrap: () => false,
    hudText: { add: (l) => hud.push(l) }, SOUL_TRAP_TEXT: {}, setEnemyAlert: () => {}, sayEnemyDied,
    spawnCorpse: () => {}, playRareDrop: () => {}, stampWonWeapons: () => {}, raiseEnemyDeath: () => {}, liveStat: () => 50,
  };
  return { hud, ...mount(`${fnSrc('damageFoe')} return { damageFoe };`, state) };
}
/** applyFoeRecord, a joiner's stream door (AUDIT SET P-M3's harness) - `self` the joiner's own id. */
function joiner(self) {
  const hud = [];
  const foes = [foeRec(0), foeRec(7, { champion: 'vampiric' })];
  const state = {
    foes, _layoutFoes: 2, _retyping: new Set(), _authority: false, validFoeRecord, opts: { selfId: () => self },
    renownFoeDied: () => {}, reportPlayerKill: () => {}, addCorpseFood: () => {}, stampWonWeapons: () => {}, liveStat: () => 50,
    playerEntity: { isPlayer: true, items: [] }, setFoeDead: (f, d) => { f.dead = d; }, retypeFoe: async () => false,
    sayEnemyDied, hudText: { add: (l) => hud.push(l) },
  };
  return { foes, hud, ...mount(`${declSrc('REMOTE_KILL')} ${fnSrc('applyFoeRecord')} return { applyFoeRecord };`, state) };
}

test('LOOT7-CHECK DUNGEON-DIED: a dungeon foe\'s death says EnemyDeath\'s kill notice - a champion by its name; never for a peer\'s killing blow, once, through the setting\'s gate; online the striker the host\'s record names hears its own', () => {
  resetToDefaults();
  const h = killDoor();
  const rat = foeRec(0), champ = foeRec(7, { champion: 'mighty' }), peers = foeRec(0);
  h.damageFoe(rat, 99);
  assert.deepEqual(h.hud, ['Rat just died.'], 'EnemyDeath.cs:79-83, at the dungeon\'s kill');
  h.damageFoe(rat, 99);
  assert.equal(h.hud.length, 1, 'a corpse takes no blow - said once');
  h.damageFoe(champ, 99);
  assert.equal(h.hud[1], 'Mighty Orc just died.', 'a champion by its name');
  h.damageFoe(peers, 99, null, null, { peer: true, peerId: 'peer-7' });
  assert.equal(peers.dead, true);
  assert.equal(h.hud.length, 2, 'a peer\'s killing blow applied here: no notice of mine (the street\'s law, AUDIT WORLD6b B2)');
  const fall = foeRec(0);
  h.damageFoe(fall, 99, null, null, { fromPlayer: false });
  assert.equal(h.hud[2], 'Rat just died.', 'a death by no one\'s blow: said here, as DFU says every death');
  setValue('GUI', 'DisableEnemyDeathAlert', true);
  h.damageFoe(foeRec(0), 99);
  assert.equal(h.hud.length, 3, 'DisableEnemyDeathAlert: silent');
  resetToDefaults();
  // THE STRIKER, online: the host's record names whose blow it was (`v`), and that joiner - no other - hears it
  const me = joiner('peer-7');
  me.applyFoeRecord(me.foes[1], { i: 1, d: 1, v: 'peer-7', f: [0, 0, 0] });
  assert.deepEqual(me.hud, ['Vampiric Orc just died.'], 'the striker hears its own kill, the champion by its name');
  me.applyFoeRecord(me.foes[1], { i: 1, d: 1, v: 'peer-7', f: [0, 0, 0] });
  assert.equal(me.hud.length, 1, 'once - the next frame finds it dead');
  me.applyFoeRecord(me.foes[0], { i: 0, d: 1, f: [0, 0, 0] });
  assert.equal(me.hud.length, 1, 'a death the record names nobody for: the host\'s to say');
  const other = joiner('peer-9');
  other.applyFoeRecord(other.foes[0], { i: 0, d: 1, v: 'peer-7', f: [0, 0, 0] });
  assert.deepEqual(other.hud, [], 'another joiner: not its kill');
  assert.equal(other.foes[0].dead, true, '...though it saw it fall');
});
