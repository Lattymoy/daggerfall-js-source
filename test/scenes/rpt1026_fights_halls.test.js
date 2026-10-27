// RPT1026-FIGHTS HALL-SPELLS (two private reports: magic does nothing to players in the PvP zone's dungeons; a caster who
// could not hurt a player underground who could hurt them, until both were back on the surface): the cast engine's seam to the zone's fair players
// underground (PVPDUNGEON) was chosen once, at the build, by whether the context was handed the arena's door - and the
// world-hosted dungeon is handed it always (worldModes.js `arenaRival`, a door that answers null off a relay's sand). So
// every dungeon took the arena's branch: the duel marks were the bout's rival (none) and no spell of mine met a player in
// the zone's halls, while a swing - resolvePlayerHit asks the zone first - did. The seam asks at the cast now: the rival
// while a bout stands, else the zone's. The engine and the host's own text, run. tools/mutants/rpt1026_fights.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const D = read('src/scenes/dungeonContext.js');
const WM = read('src/scenes/worldModes.js');
const W = read('src/scenes/world.js');
const eff = (type, subType, mag) => ({ type, subType, magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 });
/** The two entries of the dungeon's cast engine that are its seam to another player, as the host writes them. */
function seamOf(scope) {
  const mark = D.match(/\n\s+(duelMark: [^\n]*?\},)\s+\/\/ PVPDUNGEON/);
  const cast = D.match(/\n\s+(castAtDuel: [^\n]*,)\n/);
  assert.ok(mark && cast, 'the dungeon\'s two seam entries');
  return new Function('arenaRivalBody', 'spellOnRival', 'opts', `return { ${mark[1]} ${cast[1]} };`)(scope.arenaRivalBody, scope.spellOnRival, scope.opts);
}
/** A cast engine on the seam, as audit_seats_client's (the engine whole, its world stubbed). */
function engineOn(seam) {
  const player = { isPlayer: true, level: 5, health: 50, maxHealth: 50, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  return createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {}, foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99,
    duelMark: seam.duelMark, castAtDuel: seam.castAtDuel,
  });
}
const blast = { name: 'Blast', index: 93, element: 0, rangeType: 3, effects: [eff(4, 0, 10)] };

test('RPT1026-FIGHTS HALL-SPELLS THE ZONE\'S HALLS: handed the arena\'s door as the world host hands it (a door answering null off the sand), my spell meets the zone\'s fair players underground and goes out through the zone\'s own send - each body it reached (mutants: the build-time choice back)', () => {
  // the world host hands both doors to every dungeon it builds - the arena's always, the zone's always
  assert.match(WM, /arenaRival: \(\) => host\.arenaRival\?\.\(\) \?\? null,/, 'the arena\'s door, in every dungeon');
  assert.match(WM, /wildSpellMarks: \(\) => host\.wildSpellMarks\?\.\(\) \?\? null, wildSpellOut: \(id, sp\) => !!host\.wildSpellOut\?\.\(id, sp\)/, 'and the zone\'s');
  assert.match(W, /wildSpellMarks: \(\) => wildSpellMarks\(\), wildSpellOut: \(id, sp\) => wildSpellOut\(id, sp\),/, 'from the world host\'s own');
  const sent = [], rival = [];
  const marks = [{ id: 'peer-0001', feet: [1, 0, 0], height: 1.8 }, { id: 'peer-0002', feet: [0, 0, 1], height: 1.8 }];
  const seam = seamOf({
    arenaRivalBody: () => null,   // no bout: the arena's door answers null
    spellOnRival: (sp) => { rival.push(sp.name); return true; },
    opts: { arenaRival: () => null, wildSpellMarks: () => marks, wildSpellOut: (id) => { sent.push(id); return true; } },
  });
  assert.deepEqual(seam.duelMark(), marks, 'the zone\'s fair players are the marks');
  const magic = engineOn(seam);
  assert.equal(magic.readySpell(blast), true);
  magic.castInput([0, 1, 0], [0, 0, 1]);
  assert.deepEqual(sent.sort(), ['peer-0001', 'peer-0002'], 'each through the zone\'s send');
  assert.deepEqual(rival, [], 'never the arena\'s door');
});

test('RPT1026-FIGHTS HALL-SPELLS THE ARENA\'S SAND UNCHANGED: while a bout between players stands, my opponent is the one mark and my spell is the rival\'s door (ARENA4b); a fair player\'s id that is not the rival goes to the zone (mutants: the rival never asked)', () => {
  const sent = [], rival = [];
  const rb = { rival: 'p1', entity: { name: 'Vex' }, ai: { feet: [1, 0, 0], height: 1.8 } };
  const seam = seamOf({
    arenaRivalBody: () => rb,
    spellOnRival: (sp) => { rival.push(sp.name); return true; },
    opts: { arenaRival: () => rb, wildSpellMarks: () => [{ id: 'peer-0009', feet: [0, 0, 1], height: 1.8 }], wildSpellOut: (id) => { sent.push(id); return true; } },
  });
  assert.deepEqual(seam.duelMark(), { id: 'p1', name: 'Vex', feet: [1, 0, 0], height: 1.8 }, 'the bout\'s rival, alone');
  const magic = engineOn(seam);
  magic.readySpell(blast);
  magic.castInput([0, 1, 0], [0, 0, 1]);
  assert.deepEqual([rival, sent], [['Blast'], []], 'the rival\'s door');
  assert.equal(seam.castAtDuel('peer-0009', blast), true, 'another id is the zone\'s');
  assert.deepEqual(sent, ['peer-0009']);
});
