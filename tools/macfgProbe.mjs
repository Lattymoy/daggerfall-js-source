// MAC-F / MAC-G IN A REAL BROWSER, WITH NO ARENA2.
//
// Both of Mac's reports are DOM behaviour - a card that folds and a
// page that lists what a career carries - and a source sweep cannot
// show either one working. This drives the two modules on the live
// page the way the enhanced menu probe does: /play/ opens without a
// byte of game data, and the two windows are mounted over it.
//
//     npx vite --port 5199 &
//     node tools/macfgProbe.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}/play/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.px-menu button', { timeout: 15000 });

// ── MAC-F: the chronicle's cards fold ────────────────────────────
const fold = await page.evaluate(async () => {
  const T = (text) => ({ formatting: 'text', text });
  const m = await import('/src/ui/enhancedChronicle.js');
  const host = document.createElement('div');
  host.id = 'probe-chronicle';
  // the probe mounts OVER the live title page, so it has to sit above it
  host.style.cssText = 'position:fixed; inset:0; z-index:99999;';
  document.body.append(host);
  m.mountEnhancedChronicle(host, {
    entity: { name: 'Janome', race: 'Breton', backStory: ['born somewhere'] },
    questLog: () => ({
      active: [
        { id: 1, name: 'Main Quest Backbone', questName: 'S0000011', messages: [[T('met Lady Brisienna')], [T('speak to the royal families')]] },
        { id: 2, name: 'A Rat Problem', questName: 'M0B00Y00', messages: [[T('kill the rats')]] },
        { id: 3, name: 'The Long Walk', questName: 'M0B00Y01', messages: [[T('walk')], [T('and walk')]] },
      ],
      finished: [],
    }),
  });
  const q = (sel) => host.querySelectorAll(sel);
  const bodies = () => q('.cr-entry p').length;
  const out = { opened: bodies(), cards: q('.cr-entry').length, folds: q('.cr-fold').length };
  // the section control folds every card at once
  host.querySelector('.cr-foldall').click();
  out.afterCollapseAll = bodies();
  out.foldAllLabel = host.querySelector('.cr-foldall').textContent;
  // one card's own head opens it again, and only it
  q('.cr-fold')[1].click();
  out.afterOneOpen = bodies();
  // ONE card open is not all of them open, so the control offers to
  // collapse rather than to expand - it reads the cards, not a flag
  out.labelAfterOneOpen = host.querySelector('.cr-foldall').textContent;
  // collapse the one that is open, then expand the lot
  host.querySelector('.cr-foldall').click();
  out.afterCollapseAgain = bodies();
  host.querySelector('.cr-foldall').click();
  out.afterExpandAll = bodies();
  // THE FOLD IS A READING POSITION: shut the tab, walk to Notes and
  // back, and it is still shut
  host.querySelector('.cr-foldall').click();
  const rows = [...host.querySelectorAll('.px-qrail .cr-row')];
  rows[1].click();
  rows[0].click();
  out.afterTabRoundTrip = bodies();
  // left standing, folded, for the screenshot below
  return out;
});
await page.screenshot({ path: `${shots}/macf-chronicle-folded.png` });
await page.evaluate(() => { document.getElementById('probe-chronicle')?.remove(); });
check('MAC-F: the chronicle opens READ, as it always has', fold.opened === 5 && fold.cards === 3, `${fold.opened} lines over ${fold.cards} cards`);
check('MAC-F: every card carries a fold handle', fold.folds === 3, `${fold.folds} handles`);
check('MAC-F: Collapse all shuts the whole tab', fold.afterCollapseAll === 0, `${fold.afterCollapseAll} lines left`);
check('MAC-F: the control flips to Expand all once they are shut', /Expand all/.test(fold.foldAllLabel), fold.foldAllLabel);
check('MAC-F: one head opens ONE card', fold.afterOneOpen === 1, `${fold.afterOneOpen} lines`);
check('MAC-F: with one open the control offers Collapse all', /Collapse all/.test(fold.labelAfterOneOpen), fold.labelAfterOneOpen);
check('MAC-F: and collapses it', fold.afterCollapseAgain === 0, `${fold.afterCollapseAgain} lines`);
check('MAC-F: Expand all opens them all again', fold.afterExpandAll === 5, `${fold.afterExpandAll} lines`);
check('MAC-F: a fold survives walking to another tab and back', fold.afterTabRoundTrip === 0, `${fold.afterTabRoundTrip} lines`);

// ── MAC-G: the stats page lists what the career carries ──────────
const specials = await page.evaluate(async () => {
  const { playerEntity } = await import('/src/characters/playerEntity.js');
  const { parseCareerData, DEFAULT_MAGERY_BITS } = await import('/src/systems/specialAdvantages.js');
  const career = {
    name: 'Spellsword', resistanceFlags: 0, immunityFlags: 0, lowToleranceFlags: 0,
    criticalWeaknessFlags: 0, abilityFlagsAndSpellPointsBitfield: DEFAULT_MAGERY_BITS << 8,
    rapidHealing: 0, regeneration: 0, spellAbsorptionFlags: 0, attackModifierFlags: 0,
    forbiddenMaterialsFlags: 0, weaponArmorShieldsBitfield: 0,
    primarySkills: [0, 1, 2], majorSkills: [3, 4, 5], minorSkills: [6, 7, 8, 9, 10, 11],
  };
  parseCareerData(career, [
    { primary: 'acuteHearing', secondary: '' },
    { primary: 'expertiseIn', secondary: 'longBlade' },
    { primary: 'increasedMagery', secondary: 'intInSpellPoints2' },
    { primary: 'forbiddenArmorType', secondary: 'plate' },
    { primary: 'phobia', secondary: 'animals' },
  ]);
  playerEntity.career = career;
  playerEntity.race = 'Breton';
  playerEntity.name = 'Janome';
  const menu = await import('/src/ui/enhancedMenu.js');
  const host = document.createElement('div');
  host.id = 'probe-stats';
  host.style.cssText = 'position:fixed; inset:0; z-index:99999;';
  document.body.append(host);
  menu.mountEnhancedMenu(host, { mode: 'pause', at: 'stats' });
  const rail = [...host.querySelectorAll('.px-qrail .px-qrow')].map((b) => b.textContent);
  const tab = [...host.querySelectorAll('.px-qrail .px-qrow')].find((b) => /Advantages/.test(b.textContent));
  tab?.click();
  const dividers = [...host.querySelectorAll('.px-qdetail *')]
    .filter((n) => /^(Advantages|Disadvantages)$/.test(n.textContent.trim()) && !n.querySelector('*'))
    .map((n) => n.textContent.trim());
  const rows = [...host.querySelectorAll('.px-qdetail .px-stat')]
    .map((r) => [r.querySelector('.k')?.textContent, r.querySelector('.v')?.textContent]);
  return { rail, dividers, rows };
});
await page.screenshot({ path: `${shots}/macg-advantages.png` });
await page.evaluate(() => { document.getElementById('probe-stats')?.remove(); });
check('MAC-G: the Stats rail carries an Advantages page', specials.rail.some((t) => /Advantages/.test(t)), specials.rail.join(' | '));
check('MAC-G: it splits the two lists', specials.dividers.join(',').includes('Advantages') && specials.dividers.join(',').includes('Disadvantages'), specials.dividers.join(' / '));
const labels = specials.rows.map(([k]) => k);
for (const want of ['Expertise in Long Blade', 'Increased Magery 2X INT In Spell Points', 'Acute Hearing', 'Phobia Animals', 'Forbidden Armor Type Plate', 'Resistance To Magic']) {
  check(`MAC-G: "${want}" is on the page`, labels.includes(want), labels.join(' | '));
}
check('MAC-G: the blood is marked as the blood', specials.rows.some(([k, v]) => k === 'Resistance To Magic' && v === 'Breton'), JSON.stringify(specials.rows.find(([k]) => k === 'Resistance To Magic')));
check('MAC-G: and the class as the class', specials.rows.some(([k, v]) => k === 'Acute Hearing' && v === 'Spellsword'));

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} ok`);
process.exit(bad.length ? 1 : 0);
