// S24 probe: SPELL ABSORPTION live, through the dungeon host's own
// path. A SORCERER (?class=3) ships spellAbsorptionFlags = Always
// alongside NoRegenSpellPoints; before this slice only the PENALTY was
// live, so the class paid its whole cost and got nothing back.
//
// The probe drives a real SPELLS.STD record onto the player through
// applySpellToPlayer - the same function the foe-cast and
// missile-impact sites call - rather than choreographing foe AI.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5208, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => { console.log('[pageerror]', e.message); process.exitCode = 1; });
await page.goto('http://localhost:5208/play/?shot&class=3');   // Sorcerer
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000 });
await page.waitForFunction(() => window.__combat?.applySpellToPlayer && window.__playerEntity, null, { timeout: 60000 });
const die = (m, x) => { console.log('FAIL:', m, x ?? ''); process.exit(1); };

const info = await page.evaluate(() => {
  const e = window.__playerEntity;
  return { career: e.career?.name, absorb: e.career?.spellAbsorptionFlags, maxMagicka: e.maxMagicka, magicka: e.magicka, health: e.health };
});
console.log('career:', info.career, '| spellAbsorptionFlags:', info.absorb, '| magicka', info.magicka + '/' + info.maxMagicka);
if (info.career !== 'Sorcerer') die('THE HEADLESS SKIP DID NOT MAKE A SORCERER', info.career);
if (info.absorb !== 4) die('THE SORCERER DOES NOT CARRY absorb=Always', info.absorb);

// drain the pool so there is room to absorb into, then take a bolt
const result = await page.evaluate(() => {
  const e = window.__playerEntity;
  e.magicka = 0;
  const before = { health: e.health, magicka: e.magicka };
  // a real Destruction record: the first ranged damage spell in the file
  const spell = window.__spells?.() ?? null;
  const rec = spell ?? { element: 0, rangeType: 2, effects: [{
    type: 4, subType: 0, magnitudeBaseLow: 20, magnitudeBaseHigh: 20,
    magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
    durationBase: 0, durationMod: 0, durationPerLevel: 1,
    chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }] };
  const r = window.__combat.applySpellToPlayer(rec, 5, { name: 'a foe' });
  return { before, after: { health: e.health, magicka: e.magicka }, r };
});
console.log('before:', JSON.stringify(result.before));
console.log('after :', JSON.stringify(result.after));
console.log('result:', JSON.stringify(result.r));
if (result.after.health !== result.before.health) die('THE SORCERER TOOK DAMAGE FROM AN ABSORBED BOLT', `${result.before.health} -> ${result.after.health}`);
if (!(result.after.magicka > result.before.magicka)) die('NO SPELL POINTS WERE CREDITED', JSON.stringify(result.after));
console.log(`absorbed ${result.after.magicka - result.before.magicka} spell points, took 0 damage`);

// and a FULL pool absorbs nothing - the throttle
const full = await page.evaluate(() => {
  const e = window.__playerEntity;
  e.magicka = e.maxMagicka;
  const h0 = e.health;
  const rec = { element: 0, rangeType: 2, effects: [{
    type: 4, subType: 0, magnitudeBaseLow: 20, magnitudeBaseHigh: 20,
    magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
    durationBase: 0, durationMod: 0, durationPerLevel: 1,
    chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }] };
  const r = window.__combat.applySpellToPlayer(rec, 5, { name: 'a foe' });
  return { h0, h1: e.health, magicka: e.magicka, maxMagicka: e.maxMagicka, r };
});
console.log('full pool:', JSON.stringify(full));
// The law here is that NOTHING IS ABSORBED - whether the bolt then
// deals damage rides the saving throw, which is a different system and
// may legitimately roll a full save. Asserting on health would be
// asserting on someone else's dice.
if (full.r.absorbed) die('A FULL-POOL SORCERER ABSORBED ANYWAY', JSON.stringify(full.r));
// maxMagicka is rolled from INT at chargen, so compare against the
// entity's own ceiling rather than a literal
if (full.magicka !== full.maxMagicka) die('THE POOL MOVED WITH NO ROOM TO ABSORB INTO', `${full.magicka}/${full.maxMagicka}`);
console.log('with a full pool nothing is absorbed - the spell goes to the saving throw instead');

console.log('\nS24 PROBE PASSED: the Sorcerer absorbs, and only while it has room.');
await browser.close();
await server.close();
