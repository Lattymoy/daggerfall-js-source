// U46 probe: the buff and debuff icon rows, live, over a real cast.
//
// The unit tests drive the eight schemes and the split over fixtures.
// This proves the HOST half: that the icon sheet loads with the HUD
// art rather than with the spellbook window that used to be its only
// consumer, that a REAL cast through the host's own engine puts an
// icon on the right row, that the rows dodge the large HUD, and that
// the tooltip finds the icon under the pointer.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5221, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto('http://localhost:5221/play/?shot&play&exterior&time=12:00&class=1');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const fail = (m) => { console.log('FAIL:', m); process.exit(1); };
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const placed = () => page.evaluate(async () => {
  const m = await import('/src/ui/hud.js');
  return JSON.stringify(m.activeSpellIconsPlaced());
});
const rows = () => page.evaluate(async () => {
  const m = await import('/src/ui/hudActiveSpells.js');
  return JSON.stringify(m.activeSpellIcons(window.__playerEntity));
});

console.log('== THE SHEET LOADS WITH THE HUD, NOT WITH THE SPELLBOOK ==');
await page.waitForFunction(async () => (await import('/src/ui/spellIcons.js')).spellIconsLoaded(), null, { timeout: 60000 });
console.log('spellIconsLoaded (spellbook never opened):', await page.evaluate(async () =>
  (await import('/src/ui/spellIcons.js')).spellIconsLoaded()));
console.log('nothing active yet:', await placed());
if (JSON.parse(await placed()).length !== 0) fail('icons drawn with no active effect');

console.log('\n== A REAL CAST, A REAL SPELL RECORD ==');
// Not a hand-built spell: the player's own book, cast through the ONE
// producer (applySpell) with the player as caster - which is what the
// host's cast engine does at the attack click.
const cast = await page.evaluate(async () => {
  const E = await import('/src/systems/effects.js');
  const p = window.__playerEntity;
  const book = p.spells ?? [];
  const spell = book.find((sp) => sp.rangeType === 0) ?? book[0];
  if (!spell) return JSON.stringify({ error: 'the starting book is empty' });
  const named = { ...spell, name: `!${spell.name}` };   // the non-vendor bang
  const sinks = { hurt: () => {}, drainFatigue: () => {}, drainMagicka: () => {} };
  E.applySpell(named, 6, p, sinks, () => 0.5, { entity: p, sinks }, { bypassSavingThrows: true });
  return JSON.stringify({
    spell: spell.name, icon: spell.icon,
    stamped: (p.activeEffects ?? []).filter((a) => a.bundleId != null).length,
  });
});
const info = JSON.parse(cast);
console.log('cast:', cast);
if (info.error) fail(info.error);
if (!info.stamped) fail('the cast left no bundle-stamped entry - nothing for the HUD to read');
await waitFrames(4);
let r = JSON.parse(await rows());
console.log('rows:', JSON.stringify({ self: r.self.map((i) => i.displayName), other: r.other.map((i) => i.displayName) }));
if (r.self.length !== 1) fail(`a SELF cast belongs in the buff row, got ${r.self.length}`);
if (r.other.length !== 0) fail('and nothing in the debuff row');
if (r.self[0].displayName !== info.spell) fail(`the leading bang is dropped, got ${r.self[0].displayName}`);
if (r.self[0].iconIndex !== info.icon) fail(`the spell's own icon rides the bundle, got ${r.self[0].iconIndex}`);

let p0 = JSON.parse(await placed());
console.log('drawn:', JSON.stringify(p0));
if (p0.length !== 1) fail('the icon is not being drawn by the one HUD call');
if (p0[0].rect[0] !== 27 || p0[0].rect[1] !== 16) fail(`classic buff origin is (27,16), got ${p0[0].rect}`);

console.log('\n== A CAST BY SOMEONE ELSE IS A DEBUFF ==');
const foeCast = await page.evaluate(async () => {
  const E = await import('/src/systems/effects.js');
  const p = window.__playerEntity;
  const foe = { isPlayer: false, level: 5, stats: {}, activeEffects: [] };
  // A DIFFERENT spell: a re-cast of the same one is AddState, which
  // stacks rounds onto the incumbent and pushes no new entry at all
  // (X10's own note), so it would mint no second bundle to sort.
  const book = p.spells ?? [];
  const first = book.find((sp) => sp.rangeType === 0) ?? book[0];
  const base = book.find((sp) => sp !== first && sp.rangeType === 0
    && sp.effects?.[0]?.type !== first.effects?.[0]?.type);
  if (!base) return 'the book has only one spell';
  const spell = { ...base, name: 'Curse', icon: 12 };
  const sinks = { hurt: () => {}, drainFatigue: () => {}, drainMagicka: () => {} };
  E.applySpell(spell, 6, p, sinks, () => 0.5, { entity: foe, sinks }, { bypassSavingThrows: true });
  return (p.activeEffects ?? []).filter((a) => a.bundleId != null).length;
});
console.log('after the foe cast, stamped entries:', foeCast);
if (typeof foeCast === 'string') fail(foeCast);
await waitFrames(4);
r = JSON.parse(await rows());
console.log('rows:', JSON.stringify({ self: r.self.map((i) => i.displayName), other: r.other.map((i) => i.displayName) }));
if (r.other.length !== 1) fail(`a foe's cast belongs in the debuff row, got ${r.other.length}`);
p0 = JSON.parse(await placed());
const debuff = p0.find((i) => i.displayName === 'Curse');
if (!debuff) fail('the debuff icon is not drawn');
if (debuff.rect[1] !== 177) fail(`classic debuff origin is y=177, got ${debuff.rect[1]}`);
console.log('buff at y=%d, debuff at y=%d', p0.find((i) => i.displayName !== 'Curse').rect[1], debuff.rect[1]);

console.log('\n== THE LARGE HUD LIFTS THE DEBUFF ROW AND LEAVES THE BUFFS ==');
await page.evaluate(async () => {
  (await import('/src/systems/settings.js')).setValue('GUI', 'LargeHUD', 'True');
});
await page.waitForFunction(async () => (await import('/src/ui/hud.js')).largeHudBar() !== null, null, { timeout: 60000 });
await waitFrames(4);
const p1 = JSON.parse(await placed());
const buff1 = p1.find((i) => i.displayName !== 'Curse');
const debuff1 = p1.find((i) => i.displayName === 'Curse');
console.log('with the bar: buff y=%d, debuff y=%d', buff1.rect[1], debuff1.rect[1]);
if (buff1.rect[1] !== 16) fail('the buff row was already clear and must not move');
if (!(debuff1.rect[1] < 177)) fail('the debuff row must lift clear of the bar');

console.log('\n== THE TOOLTIP FINDS THE ICON UNDER THE POINTER ==');
const tip = await page.evaluate(async () => {
  const hl = await import('/src/ui/hudActiveSpells.js');
  const hud = await import('/src/ui/hud.js');
  const icons = hud.activeSpellIconsPlaced();
  const t = icons.find((i) => i.displayName !== 'Curse');
  const hit = hl.activeSpellAt(icons, t.rect[0] + 2, t.rect[1] + 2);
  const miss = hl.activeSpellAt(icons, 200, 100);
  return JSON.stringify({ want: t.displayName, hit: hit?.displayName ?? null, miss: miss?.displayName ?? null });
});
console.log('hit/miss:', tip);
if (JSON.parse(tip).hit !== JSON.parse(tip).want) fail('the icon under the pointer is not found');
if (JSON.parse(tip).miss !== null) fail('empty screen must find nothing');

await page.evaluate(async () => {
  (await import('/src/systems/settings.js')).setValue('GUI', 'LargeHUD', 'False');
});
if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS');
await browser.close();
await server.close();
process.exit(0);
