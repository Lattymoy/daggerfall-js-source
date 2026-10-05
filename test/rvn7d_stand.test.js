// RVN7d - THE LAIR STAND (bible/12-Enhanced-AI/Feud-Arc.md section 18.4; Mac, 2026-10-04: "more complex, less easy
// to accomplish and more detailed", then "Go"). Entering its lair while it is living, unsworn and not out, and due or
// known, a revenant stands at the layout marker farthest from the entrance once the layout has stood - found resting
// (unaware until it sees or hears the player, so a first blow may be a backstab), its drop's gold x1.25, its band about
// it. A loose foe of the player's (online, on the room's SUMMON-SYNC lane - never a room's layout foe). In its own lair
// a due revenant answers a rest's first roll ("You wake to Grushnak standing over you."), and any rest's roll may be a
// due one's return - the open world's arm.
// Pinned: who is at home (each gate, the claim, the rank's order, a rest's due-only ask); the lair's gold; the wake's
// card; the dungeon's build arm and loose stand; the stand on the first frame, its place, its rest and its band; the
// band underground - stood, scattered by every door, its run spent, rank 5's rally; the taunt once roused; the rest's
// two arms, mine alone.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const me = (id = 'char-rvn7d') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });
const NOW = 1440 * 5;

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setWorldMinutes(NOW);
});

const LAIR = Object.freeze({ px: 40, py: 41, name: 'The Pit', region: 5 });
function made(p, { lair = LAIR, rank = 2, dueAt = NOW + 600, known = false } = {}) {
  const r = N.revenantDeed(p, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  r.lair = lair ? { ...lair } : null; r.lairKnown = known; r.rank = rank; r.dueAt = dueAt; r.out = false;
  return r;
}
const HERE = Object.freeze({ px: 40, py: 41 });

test('RVN7d WHO IS AT HOME: in its lair, living, unsworn, not out, and due or known - claimed (out) as a return is; the higher rank first; a rest asks the due alone; elsewhere, none (mutants: each gate dropped; unclaimed; the order)', () => {
  const p = me();
  const r = made(p);
  assert.equal(N.revenantForLair(p, HERE, { now: NOW }), null, 'not due, not known');
  r.lairKnown = true;
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, dueOnly: true }), null, 'a rest: known is not due');
  const got = N.revenantForLair(p, HERE, { now: NOW });
  assert.equal(got, r, 'known: at home');
  assert.equal(r.out, true, 'claimed');
  assert.ok(r.outAt > 0);
  assert.equal(N.revenantForLair(p, HERE, { now: NOW }), null, 'out: not twice');
  N.releaseRevenantStand(r);
  assert.equal(r.out, false);
  r.lairKnown = false; r.dueAt = NOW - 1;
  assert.equal(N.revenantForLair(p, HERE, { now: NOW, dueOnly: true }), r, 'due: a rest\'s too');
  N.releaseRevenantStand(r);
  assert.equal(N.revenantForLair(p, { px: 41, py: 41 }, { now: NOW }), null, 'another dungeon');
  assert.equal(N.revenantForLair(p, { px: 40, py: 42 }, { now: NOW }), null, 'another dungeon, one row down');
  r.sworn = true;
  assert.equal(N.revenantForLair(p, HERE, { now: NOW }), null, 'sworn');
  r.sworn = false; r.defeated = true;
  assert.equal(N.revenantForLair(p, HERE, { now: NOW }), null, 'fallen');
  r.defeated = false;
  setPref('lootRarity', false);
  assert.equal(N.revenantForLair(p, HERE, { now: NOW }), null, 'the switch off');
  setPref('lootRarity', true);
  assert.equal(N.revenantForLair(p, null, { now: NOW }), null);
  assert.equal(N.revenantForLair(p, { px: 'a', py: 41 }, { now: NOW }), null);
  // two at home: the higher rank, then the longer due
  const q = made(p, { rank: 4, dueAt: NOW - 1 });
  assert.equal(N.revenantForLair(p, HERE, { now: NOW }), q, 'the higher rank');
  N.releaseRevenantStand(q);
  q.rank = 2; q.dueAt = NOW - 1; r.dueAt = NOW - 50;
  assert.equal(N.revenantForLair(p, HERE, { now: NOW }), r, 'as high: the longer due');
});

test('RVN7d ITS GOLD AND ITS WAKE: found in its lair its drop\'s gold is x1.25, once; the wake\'s card in the narrator\'s words, its kicker its lair (mutants: the mult unread; the card unsaid)', () => {
  const p = me();
  const r = made(p);
  const plain = N.revenantLoot(10, 2, () => 0.5);
  const lair = N.revenantLoot(10, 2, () => 0.5, F.LAIR_GOLD);
  const amount = (items) => items.at(-1).stackCount;   // its gold the last of the drop
  assert.equal(lair.at(-1).group, 'Currency');
  const [lo, hi] = N.REVENANT_LOOT.goldPerLevel;
  assert.equal(amount(plain), Math.round(10 * 2 * (lo + 0.5 * (hi - lo))));
  assert.equal(amount(lair), Math.round(10 * 2 * (lo + 0.5 * (hi - lo)) * 1.25), 'x1.25');
  assert.equal(N.revenantLoot(10, 2, () => 0.5, 0).at(-1).stackCount, amount(plain), 'no mult: as it was');
  const e = { revenant: { id: r.id, rank: 2 }, items: [] };
  N.grantRevenantLoot(e, 10, () => 0.5, { goldMult: F.LAIR_GOLD });
  assert.equal(amount(e.items), amount(lair));
  N.grantRevenantLoot(e, 10, () => 0.5, { goldMult: F.LAIR_GOLD });
  assert.equal(e.items.length, lair.length, 'once');
  const ev = N.revenantWakeEvent(r);
  assert.equal(ev.kind, 'lair');
  assert.equal(ev.kicker, 'Its lair');
  assert.equal(ev.body, `You wake to ${r.given} standing over you.`);
  assert.equal(ev.line, ev.body);
});

const D = read('src/scenes/dungeonContext.js');

test('RVN7d THE DUNGEON\'S BUILD: a revenant\'s record stands on the built body (both builds - a person\'s and a monster\'s) before its loot, and its drop after it - its gold x LAIR_GOLD when found in its lair; a loose stand carries the record (mutants: unapplied; no drop; the lair\'s gold unread; the record dropped)', () => {
  assert.equal((D.match(/if \(e\.revenant && !puppet\) applyRevenant\(entity, e\.revenant, \{ turned: !!e\.turned \}\);/g) ?? []).length, 2, 'both builds');   // PIN MOVED (RVN11c: a betrayer's turning is no return)
  assert.equal((D.match(/if \(e\.revenant && entity\.revenant\) grantRevenantLoot\(entity, effectiveLevel\(D\.playerEntity\), Math\.random, \{ goldMult: e\.lairStand \? LAIR_GOLD : 1 \}\);/g) ?? []).length, 2);
  for (const [a, b] of [...D.matchAll(/applyRevenant\(entity, e\.revenant\)/g)].map((m) => [m.index, D.indexOf('spawnEnemyLoot(entity', m.index)])) assert.ok(b > a, 'before its loot');
  assert.match(D, /\.\.\.\(revenant \? \{ revenant, lairStand: !!lairStand, \.\.\.\(turned \? \{ turned: true \} : \{\}\) \} : \{\}\) \};/);   // PIN MOVED (RVN11c)
  assert.match(D, /async function spawnLooseFoe\(mobileType, position, \{[^}]*revenant = null, lairStand = false(?:, turned = false)? \} = \{\}\)/);   // PIN MOVED (RVN11c: and a betrayer's turning)
});

test('RVN7d THE STAND: asked once a visit, the first frame I stand there; this dungeon\'s pixel; at the layout marker farthest from the entrance; a loose foe of mine with its record\'s gender and level, found resting, its band about it; a stand that stood nobody frees the claim (mutants: never asked; asked every frame; the nearest marker; aware; no band; the claim kept)', () => {
  assert.match(D, /if \(playerFeet && !_lairAsked\) \{ _lairAsked = true; standLairRevenant\(\)\.catch\(\(\) => null\); \}/);
  assert.match(D, /let _lairAsked = false;/);
  assert.match(D, /const r = revenantForLair\(playerEntity, lairPixel\(\)\);/);
  assert.match(D, /const far = from && marks\.length \? marks\.reduce\(\(a, m\) => \(Math\.hypot\(m\.x - from\.x, m\.z - from\.z\) > Math\.hypot\(a\.x - from\.x, a\.z - from\.z\) \? m : a\)\) : marks\[0\] \?\? null;/);
  assert.match(D, /const from = dungeon\.enterMarker \?\? dungeon\.startMarker \?\? null;/);
  assert.match(D, /const f = await spawnLooseFoe\(r\.mobileType, \[sp\.x, sp\.y, sp\.z\], \{ gender: so\.gender, level: so\.level, revenant: r, lairStand: true \}\)\.catch\(\(\) => null\);\n\s*if \(!f \|\| !f\.entity\?\.revenant\) \{ releaseRevenantStand\(r\); return null; \}/);
  assert.match(D, /f\._lairStand = true;\n\s*if \(f\.ai\) \{ f\.ai\.detected = false; f\.ai\.target = null; \}   \/\/ found resting/);
  assert.match(D, /standDungeonBand\(f, bandMembers\(r, effectiveLevel\(playerEntity\)\)\);\n\s*return f;/);
  // the pixel is the lair door's own
  // PIN MOVED (AUDIT FEUD: no lair on the Burning Court, the Arena's floor or a spawned dungeon - `lairable`)
  assert.match(D, /function lairPixel\(\) \{\n\s*const mt = dfLocation\.mapTableData;\n\s*if \(!mt \|\| !lairable\(\)\) return null;\n\s*const p = longitudeLatitudeToMapPixel\(mt\.longitude, mt\.latitude\);\n\s*return \{ px: p\.x, py: p\.y \};/);
});

test('RVN7d THE BAND UNDERGROUND: stood about it in the ring, loose, marked, in its camp, named, resting with it; scattered by its kneel, its tear-away, its escape, its death and its execution, said once a break; a scattering follower gone when its run is spent; rank 5\'s rally (mutants: any door unwired; the run kept; no rally)', () => {
  assert.match(D, /g\.retinueOf = id; g\.entity\.retinueOf = id; g\.entity\.campId = campId; g\.entity\.bandName = name;/);
  assert.match(D, /if \(f\._lairStand && g\.ai\) \{ g\.ai\.detected = false; g\.ai\.target = null; \}/);
  assert.match(D, /const sp = spotAbout\(at, BAND_SPACING\);/);
  assert.match(D, /const ev = beginYield\(playerEntity, f, \{ now: Date\.now\(\) \}\);\n\s*scatterDungeonBand\(f\);/, 'it kneels');
  assert.match(D, /scatterDungeonBand\(f\);   \/\/ RVN7d\n\s*beginTearAway\(f,/, 'it tears away');
  assert.match(D, /function escapeDungeonFoe\(f, \{ slip = false, unbroken = false \} = \{\}\) \{\n\s*scatterDungeonBand\(f\);/, 'it escapes');
  assert.match(D, /if \(foe\.entity\?\.revenant\) scatterDungeonBand\(foe\);   \/\/ RVN7d: it dies/, 'it dies');
  assert.match(D, /scatterDungeonBand\(f\);   \/\/ RVN7d: executed/, 'it is executed');
  assert.match(D, /g\.ai\.flee\(f\.ai\.feet, BAND_SCATTER_S\);/);
  assert.match(D, /if \(n\) hudText\.add\(`The \$\{\(bandWord\(f\.mobileType\) \?\? 'band'\)\.toLowerCase\(\)\} scatters\.`\);/);
  assert.match(D, /if \(f\.scattering && !\(f\.ai\.fleeLeft > 0\)\) \{ questPoolOps\.removeFoe\(f\); f\.escaped = true; continue; \}/);
  assert.match(D, /if \(ev && \(f\.entity\.revenant\.rank \| 0\) >= 5\) rallyDungeonBand\(f\);/);
  assert.match(D, /return standDungeonBand\(f, bandMembers\(revenantById\(id\), effectiveLevel\(playerEntity\), RALLY_KIN\), \{ portal: true \}\)\.length;/);
});

test('RVN7d THE TAUNT AND THE REST: one found in its lair says what it came to say once roused, in sight and near; in its own lair a due one answers a rest\'s first roll (its card, its band), and any roll that hits may be a due one\'s return - mine alone, the room\'s rest its host\'s (mutants: the taunt every frame; the lair\'s roll unanswered; the return arm unwired; online)', () => {
  assert.match(D, /if \(f\._lairStand && !f\._taunted && f\.ai\.inSight && f\.ai\.detected && _pf && Math\.hypot\(_pf\[0\] - f\.ai\.feet\[0\], _pf\[2\] - f\.ai\.feet\[2\]\) < REVENANT_TAUNT_DISTANCE\) \{\n\s*f\._taunted = true;/);
  assert.match(D, /if \(l === 0 && !onlineRoom\(\) && restInLair\(\)\) break;\n\s*if \(hit\) \{ restEncounter\(hit\); break; \}/);
  assert.match(D, /if \(!onlineRoom\(\)\) return restReturn\(hit\) \? null : _spawnEncounter\(hit\);/);
  assert.match(D, /const r = revenantForLair\(playerEntity, lairPixel\(\), \{ dueOnly: true \}\);/);
  assert.match(D, /revenantSay\(revenantWakeEvent\(r, \{ archive: f\.mobileArchive \}\), \(l\) => hudText\.add\(l\)\);/);
  assert.match(D, /const r = revenantToReturn\(playerEntity\);\n\s*if \(!r\) return false;\n\s*_spawnEncounter\(\{ \.\.\.hit, mobileType: r\.mobileType \}, \{ revenant: r \}\)/);
  assert.match(D, /\.\.\.\(so \? \{ revenant, lairStand: !!lairStand, \.\.\.\(Number\.isFinite\(so\.level\) \? \{ level: so\.level \} : \{\}\) \} : \{\}\),/);
});
