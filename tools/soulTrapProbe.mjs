// V3 probe: SOUL TRAP end to end, in a live dungeon. The last piece of
// the X4-X9 arc with no live coverage, and the one that crosses three
// lanes - X6 mints the gem, X5 arms the trap and intercepts the kill,
// and the kill itself goes through the host's ONE foe damage door.
//
// It is deliberately a CHAIN rather than three checks: the gem is
// minted by the same shelf code the guild service sells from, so what
// is proved is that X6's item satisfies X5's predicate on a real
// record - which is exactly what the pre-X5 name-based predicate
// could never have done, and what no unit test with a hand-built
// fixture would have caught.
//
// Covers:
//   the arm      - a monster takes the trap, the alert speaks
//   the CATCH    - the killing blow fills a real gem with that
//                  creature's own mobile id, and the foe dies
//   the TETHER   - with no empty gem, a successful roll REFUSES the
//                  death and leaves the foe alive at 1 health
//   the re-roll  - the tethered foe dies once a gem frees up
//
// Run: ARENA2_PATH=/path/to/arena2 node tools/soulTrapProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

const PORT = 5221;
const server = await createServer({ root: '/home/user/project-dagger', server: { port: PORT, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`http://localhost:${PORT}/play/?shot&class=0`);
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000 });

const out = { steps: {}, failures: [] };
const check = (name, ok, detail) => { out.steps[name] = { ok, ...detail }; if (!ok) out.failures.push(name); };

// ---- the GEM comes off X6's real shelf, not a hand-built fixture ----
out.steps.gems = await page.evaluate(async () => {
  const { stockSoulGems } = await import('/src/systems/shopStock.js');
  const { ENEMY_BASICS } = await import('/src/characters/enemyBasics.js');
  const shelf = stockSoulGems({ quality: 20, gameMinutes: 0 },
    { soulPointsOf: (t) => ENEMY_BASICS[t]?.soulPts ?? 0 });
  const empty = shelf.filter((g) => g.trappedSoulType === null);
  const e = window.__playerEntity;
  e.items = e.items ?? [];
  e.items.push(empty[0]);            // exactly ONE empty gem in the pack
  return { minted: shelf.length, emptyOnShelf: empty.length,
    carried: 1, group: empty[0].group, templateIndex: empty[0].templateIndex };
});

// ---- pick a live MONSTER (the trap refuses class enemies) -----------
const target = await page.evaluate(() => {
  const fs = JSON.parse(window.__foes());
  const i = fs.findIndex((f) => !f.dead && f.type < 128);
  return i < 0 ? null : { i, type: fs[i].type, health: fs[i].health };
});
check('a live monster to trap', !!target, target ?? {});
if (!target) { console.log(JSON.stringify(out, null, 2)); await browser.close(); await server.close(); process.exit(1); }
out.steps.target = target;

const trapSpell = () => page.evaluate(async () => {
  const { buildCustomSpell, blankEffectSettings } = await import('/src/systems/spellMaker.js');
  return buildCustomSpell({ slots: [{ type: 12, subType: 255,
    settings: { ...blankEffectSettings(), durationBase: 30, chanceBase: 100, chanceMod: 0 } }], rangeType: 1 });
});

// ---- ARM the trap on the live foe -----------------------------------
{
  const sp = await trapSpell();
  const armed = await page.evaluate(async ([spell, i]) => {
    const { applySpell } = await import('/src/systems/effects.js');
    const f = window.__foeRecord(i);
    const r = applySpell(spell, 5, f.entity, {}, () => 0, null, {});
    return { alert: r.trapAlert, kinds: (f.entity.activeEffects ?? []).map((a) => a.kind),
      chance: f.entity.activeEffects?.[0]?.chance };
  }, [sp, target.i]);
  check('X5 the trap arms on a monster', armed.kinds.includes('soulTrap') && armed.alert === 'trapActive', armed);
}

// ---- the CATCH: kill through the real damage door --------------------
{
  const res = JSON.parse(await page.evaluate(([i]) => window.__damageFoe(i, 9999), [target.i]));
  // spawnCorpse awaits a texture, so the billboard appears a beat
  // later. Waiting lets this assert the CONTRAST with X9: a soul-trap
  // kill is a real KILL and leaves a corpse, where a dispel destroy
  // leaves none. Reading it immediately would report corpse:false for
  // both and quietly lose the distinction.
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
  const corpsed = JSON.parse(await page.evaluate(([i]) => JSON.stringify(
    { corpse: !!window.__foeRecord(i)?.corpseBatch }), [target.i]));
  const gem = await page.evaluate(() => {
    const g = window.__playerEntity.items.filter((i) => i.group === 'MiscItems' && i.templateIndex === 274);
    return g.map((x) => ({ soul: x.trappedSoulType, value: x.value }));
  });
  out.steps.afterKill = { foe: res, ...corpsed, gem };
  check('X5 the foe dies once the soul is taken', res.dead === true, res);
  check('X5 a trapped kill is a KILL - it leaves a corpse, unlike a dispel',
    corpsed.corpse === true, corpsed);
  check('X5 the gem holds THAT creature', gem.length === 1 && gem[0].soul === target.type,
    { soul: gem[0]?.soul, expected: target.type });
}

// ---- the TETHER: a second trap with no empty gem left ---------------
{
  const second = await page.evaluate(() => {
    const fs = JSON.parse(window.__foes());
    const i = fs.findIndex((f) => !f.dead && f.type < 128);
    return i < 0 ? null : { i, type: fs[i].type };
  });
  if (!second) {
    check('X5 the tether', false, { reason: 'no second live monster' });
  } else {
    const sp = await trapSpell();
    await page.evaluate(async ([spell, i]) => {
      const { applySpell } = await import('/src/systems/effects.js');
      applySpell(spell, 5, window.__foeRecord(i).entity, {}, () => 0, null, {});
    }, [sp, second.i]);
    // Every gem in the pack is now full, so a successful roll has
    // nowhere to put the soul - DFU keeps the entity "tethered to life".
    const tethered = JSON.parse(await page.evaluate(([i]) => window.__damageFoe(i, 9999), [second.i]));
    check('X5 no empty gem REFUSES the death', tethered.dead === false && tethered.health === 1,
      { ...tethered, type: second.type });
    // Free a gem and the next blow lands.
    await page.evaluate(async () => {
      const { createEmptySoulTrap } = await import('/src/systems/shopStock.js');
      window.__playerEntity.items.push(createEmptySoulTrap());
    });
    const freed = JSON.parse(await page.evaluate(([i]) => window.__damageFoe(i, 9999), [second.i]));
    const gems = await page.evaluate(() => window.__playerEntity.items
      .filter((i) => i.group === 'MiscItems' && i.templateIndex === 274)
      .map((x) => x.trappedSoulType));
    check('X5 a freed gem lets the kill land', freed.dead === true, { ...freed, gems });
    out.steps.finalGems = gems;
  }
}

out.pageErrors = pageErrors.slice(0, 6);
console.log(JSON.stringify(out, null, 2));
await browser.close();
await server.close();
process.exit(out.failures.length ? 1 : 0);
