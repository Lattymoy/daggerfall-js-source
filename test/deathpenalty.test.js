// DEATH-PENALTY (2026-09-24, Mac: "add deathpenalty 25% of the gold you have with you" -
// "online mode only ofc" - "and it should be shown in the death screen"). DEATH-TENTH (2026-10-03, Mac: "Reduce gold
// loss on death"): a tenth of the purse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEATH_GOLD_FRACTION, DEATH_PENALTY_LINES, deathGoldLoss, applyDeathPenalty, deathPenaltyText, deathPenaltyLine } from '../src/systems/deathPenalty.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('a tenth of the purse, rounded down in the player\'s favour', () => {
  assert.equal(DEATH_GOLD_FRACTION, 0.1);
  assert.equal(deathGoldLoss(100), 10);
  assert.equal(deathGoldLoss(1009), 100);
  assert.equal(deathGoldLoss(10), 1);
  assert.equal(deathGoldLoss(9), 0);
  assert.equal(deathGoldLoss(6755399441055749), 675539944105574, 'AUDIT DEATH-TENTH: rounded down past 3 x 2^51 too, where g * 0.1 rounded up');
  assert.equal(deathGoldLoss(0), 0);
  for (const bad of [NaN, undefined, null, -50, Infinity]) assert.equal(deathGoldLoss(bad), 0, String(bad));
});

test('the penalty comes off the purse counter and answers what it took', () => {
  const p = { goldPieces: 400, items: [{ templateIndex: 0, value: 5000 }] };
  assert.equal(applyDeathPenalty(p), 40);
  assert.equal(p.goldPieces, 360);
  assert.equal(p.items[0].value, 5000, 'letters of credit are not "with you" gold - untouched');
  assert.equal(applyDeathPenalty({ goldPieces: 9 }), 0);
  assert.equal(applyDeathPenalty(null), 0);
  assert.equal(deathPenaltyText(100), 'Death claimed 100 gold from your purse.');
  assert.equal(deathPenaltyText(0), '');
});

test('it is taken by BOTH online respawn paths, once, and never by the offline end of run', () => {
  const world = read('src/scenes/world.js');
  const modes = read('src/scenes/worldModes.js');
  assert.match(world, /reviveForPlay\(playerEntity, \{ force: true \}\);\s*\n\s*surfacePlayer\(\);\s*\n\s*player\.stopAutorun\(\);[^\n]*\n\s*const goldLost = applyDeathPenalty\(playerEntity\);/,
    'respawnOnlinePlayer, after the _respawning guard');
  // PIN MOVED (RVN8: a revenant's theft rides the same box, after the price - bible/12-Enhanced-AI/Feud-Arc.md 19)
  assert.match(world, /\[respawnFlavorText\(kind\), deathPenaltyText\(goldLost\)(?:, took\?\.line)?\]\.filter\(Boolean\)/, 'and says so on waking');
  assert.match(modes, /const goldLost = applyDeathPenalty\(playerEntity\);[\s\S]*?say\(deathPenaltyText\(goldLost\)\)/, "Privateer's Hold's in-place respawn");
  const end = /function endRunToTitleMenu[\s\S]*?\n\}/.exec(read('src/scenes/shared.js'))?.[0] ?? '';
  assert.doesNotMatch(end, /applyDeathPenalty/, 'offline a death ends the run - nothing to take');
});

test('the death screen shows the loss - online only, and only when there is one', () => {
  const ds = read('src/ui/deathScreen.js');
  assert.match(ds, /this\.goldLoss = this\.online \? deathGoldLoss\(goldPiecesOf\(entity\)\) : 0;/);
  assert.match(ds, /if \(this\.goldLoss > 0\) \{[\s\S]*?DEATH CLAIMS \$\{this\.goldLoss\} GOLD/, 'classic face');
  const en = read('src/ui/enhancedDeath.js');
  assert.match(en, /const lossLine = screen\.goldLoss > 0 \? \(screen\.goldLossLine \|\| deathPenaltyLine\(screen\.goldLoss\)\) : '';/);
  assert.match(en, /el\('p', `dth-line\$\{lossLine \? ' dth-lossline' : ''\}`, lossLine \|\| \(online/, 'it takes the tagline\'s place and wears its font');
  assert.match(en, /band\.append\(title, rule, line, count, keys\);/, 'no second line under it');
  assert.doesNotMatch(en, /dth-loss[ '"]/, 'the separate brass loss line is gone');
  assert.match(ds, /this\.goldLossLine = deathPenaltyLine\(this\.goldLoss\);/, 'picked once per death, not per frame');
});

test('the death screen has four random lines, every one carrying the amount', () => {
  assert.equal(DEATH_PENALTY_LINES.length, 4);
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    const line = deathPenaltyLine(1234, () => i / 4);
    assert.ok(line.includes('1,234'), line);
    seen.add(line);
  }
  assert.equal(seen.size, 4, 'each roll lands on a different line');
  assert.equal(deathPenaltyLine(0), '');
  assert.equal(deathPenaltyLine(1, () => 0.25), '1 coin scatters into the void, leaving only your corpse behind.', 'one coin is a coin');
  for (let k = 0; k < 200; k++) assert.ok(deathPenaltyLine(50).length > 0, 'any roll answers a line');
  assert.ok(deathPenaltyLine(50, () => 0.9999999).length > 0 && deathPenaltyLine(50, () => 1).length > 0, 'the edge of the roll stays in the pool');
});
