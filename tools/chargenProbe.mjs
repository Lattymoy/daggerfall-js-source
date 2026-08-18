// S3c/U9 probe: chargen runs in the EXTERIOR host (it used to live
// only in the dungeon, so booting into a town left the player on the
// pre-chargen INTERIM entity), and the chosen RACE/GENDER/FACE drives
// the paperdoll.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const key = async (k) => { await page.keyboard.press(k); await waitFrames(2); };
// the chargen overlay must be up on a fresh boot
await page.waitForFunction(() => JSON.parse(window.__talk()).overlay === true, null, { timeout: 60000 });
console.log('chargen overlay on boot:', JSON.parse(await page.evaluate(() => window.__talk())).overlay);
await waitFrames(2);
await page.screenshot({ path: '/home/claude/chargen-name.png' });
// name
for (const c of 'MAC') await key(c);
await key('Enter');
await waitFrames(2);
await page.screenshot({ path: '/home/claude/chargen-race.png' });
// race: Breton -> Redguard -> Nord -> DarkElf -> HighElf -> WoodElf -> Khajiit
// U10: the PROVINCE CLICK is verbatim - TAMRIEL2.IMG's palette index
// at the click point IS the race id. Click Hammerfell and the flow
// must land on Redguard (id 2) with no key pressed.
const M = { s: 4, ox: 60, oy: 50 };   // 1400x900 -> the native mapping
const clickNative = async (vx, vy) => { await page.mouse.click(M.ox + vx * M.s, M.oy + vy * M.s); await waitFrames(3); };
await clickNative(110, 95);           // Hammerfell
const clicked = await page.evaluate(() => window.__chargenRace?.() ?? null);
console.log('province click ->', clicked);
if (clicked !== 'Redguard') { console.log('PROVINCE CLICK DID NOT PICK A RACE', clicked); process.exit(1); }
// U11: the click opens the race's TEXT.RSC description in a Yes/No
// parchment box (CreateCharRaceSelect.cs:100-112).
await waitFrames(3);
const confirm = await page.evaluate(() => window.__chargenConfirm?.() ?? null);
console.log('race confirm box:', JSON.stringify(confirm?.slice(0, 2) ?? null));
if (!confirm?.length) { console.log('RACE DESCRIPTION BOX DID NOT OPEN'); process.exit(1); }
await page.screenshot({ path: '/home/claude/chargen-raceconfirm.png' });
await key('Escape');                  // NO - back to the map, race kept
if (await page.evaluate(() => window.__chargenConfirm?.() ?? null)) { console.log('NO DID NOT DISMISS'); process.exit(1); }
// the click left the cursor on Redguard (index 1); step to Khajiit (6)
for (let i = 0; i < 5; i++) await key('ArrowDown');
await waitFrames(2);
await page.screenshot({ path: '/home/claude/chargen-race.png' });   // U10: TMAP00I0
// AUDIT 17g F5: a KEYBOARD confirm opens the same description box a
// click does - it used to walk straight past it.
await key('Enter');
const kbConfirm = await page.evaluate(() => window.__chargenConfirm?.() ?? null);
if (!kbConfirm?.length) { console.log('KEYBOARD CONFIRM SKIPPED THE RACE BOX'); process.exit(1); }
console.log('keyboard confirm opened the box:', kbConfirm.length, 'rows');
await key('Enter');            // YES -> gender
await waitFrames(2);
await page.screenshot({ path: '/home/claude/chargen-gender.png' });
await key('ArrowDown');        // female
await key('Enter');            // face
for (let i = 0; i < 3; i++) await key('ArrowDown');
await waitFrames(10);          // U10: the FACE CIF streams in
await page.screenshot({ path: '/home/claude/chargen-face.png' });
await key('Enter');            // class
await waitFrames(2);
await page.screenshot({ path: '/home/claude/chargen-class.png' });   // U10: PICK00I0
await key('Enter');            // -> BIOGRAPHY (S3e)
await waitFrames(2);
// S3e: twelve real BIOG00T0.TXT questions. Shoot the first, then
// answer every one with its first option.
const biog = async () => JSON.parse(await page.evaluate(() => {
  const f = window.__chargenFlow?.();
  return JSON.stringify(f ? { state: f.state, q: f.biogQuestionIndex, text: f.biogQuestion?.()?.text ?? null,
    answers: f.biogQuestion?.()?.answers?.map((a) => a.text) ?? [], effects: f.biographyEffects.length } : null);
}));
let b = await biog();
console.log('biography opened:', JSON.stringify(b));
if (b?.state !== 'biography') { console.log('BIOGRAPHY SCREEN DID NOT OPEN', JSON.stringify(b)); process.exit(1); }
if (!b.text?.[0] || !b.answers.length) { console.log('BIOGRAPHY QUESTION EMPTY'); process.exit(1); }
await page.screenshot({ path: '/home/claude/chargen-biography.png' });
for (let i = 0; i < 12; i++) {
  const cur = await biog();
  if (cur.state !== 'biography') break;
  await key('Enter');          // the cursor sits on the first answer
}
const after = await biog();
console.log('after the twelve questions:', JSON.stringify({ state: after.state, effects: after.effects }));
if (after.state !== 'stats') { console.log('BIOGRAPHY DID NOT COMPLETE', JSON.stringify(after)); process.exit(1); }
if (after.effects < 12) { console.log('BIOGRAPHY COLLECTED NO EFFECTS', after.effects); process.exit(1); }
await waitFrames(2);
await waitFrames(2);
await page.screenshot({ path: '/home/claude/chargen-stats.png' });   // U10: CHAR02I0
// spend the stat pool, then each skill pool
const spend = async () => { for (let i = 0; i < 30; i++) await page.keyboard.press('='); await waitFrames(2); };
await spend();
await key('Enter');            // -> skills (gated until pool 0)
await waitFrames(2);
await page.screenshot({ path: '/home/claude/chargen-skills.png' });   // U10: CHAR03I0
for (let row = 0; row < 9; row++) { await spend(); await page.keyboard.press('ArrowDown'); }
await waitFrames(2);
await key('Enter');
await waitFrames(4);
const e = await page.evaluate(() => {
  const p = window.__playerEntity;
  return { name: p.name, race: p.race, raceId: p.raceId, gender: p.gender, face: p.faceIndex,
    chargenDone: !!p.chargenDone, maxHealth: p.maxHealth, career: p.career?.name,
    skillsIsArray: Array.isArray(p.skills), overlay: JSON.parse(window.__talk()).overlay,
    // S3d: the real starting kit replaces the interim dagger
    items: (p.items ?? []).map((i) => `${i.name}${i.stackCount > 1 ? 'x' + i.stackCount : ''}`),
    worn: (p.equip?.slots ?? []).filter(Boolean).map((i) => i.name),
    gold: (p.items ?? []).find((i) => i.group === 'Currency')?.stackCount ?? 0 };
});
console.log('entity after chargen:', JSON.stringify(e));
if (!e.chargenDone) { console.log('CHARGEN DID NOT COMPLETE'); process.exit(1); }
if (e.race !== 'Khajiit' || e.gender !== 'female') { console.log('IDENTITY NOT APPLIED'); process.exit(1); }
if (!e.skillsIsArray) { console.log('SKILLS STILL THE INTERIM FLAT NUMBER'); process.exit(1); }
// S3d: AssignStartingGear - dressed, armed, funded, and NO interim dagger
// S3e: the kit's 100 gold is the FLOOR now - a biography answer can
// add to it (GP +N) or take from it, so the assertion is that the kit
// landed and the biography moved it, not a fixed number.
if (e.gold < 100) { console.log('STARTING GOLD BELOW THE KIT', e.gold); process.exit(1); }
if (e.worn.length !== 2) { console.log('CLOTHES NOT WORN', JSON.stringify(e.worn)); process.exit(1); }
if (!e.items.includes('Spellbook')) { console.log('NO SPELLBOOK'); process.exit(1); }
if (e.items.includes('Dagger')) { console.log('THE INTERIM DAGGER SURVIVED CHARGEN'); process.exit(1); }
// AUDIT 17f: the bag order is AssignStartingGear's - Spellbook FIRST
// (AddPosition.Back), then the clothes, then the class weapon.
if (e.items[0] !== 'Spellbook') { console.log('SPELLBOOK NOT FIRST', JSON.stringify(e.items)); process.exit(1); }
if (e.items[1] !== 'Short Shirt' || e.items[2] !== 'Casual Pants') { console.log('TEMPLATE NAMES WRONG', JSON.stringify(e.items)); process.exit(1); }
// AUDIT 17f F2: a Mage/Spellsword created in a TOWN gets their
// starting spellbook - the exterior hosts used to call finishChargen
// with no spell table at all.
const spells = await page.evaluate(() => (window.__playerEntity.spells ?? []).map((s) => s.name ?? s.index));
console.log('starting spells:', JSON.stringify(spells));
// AUDIT 17f F1: the item list addresses icons for the WEARER'S
// morphology (SetRace). A Khajiit's short shirt must resolve to the
// Khajiit clothing archive, not the morphology-0 Argonian row the
// template carries.
const icons = await page.evaluate(async () => {
  const m = await import('/src/systems/itemTemplates.js');
  const p = window.__playerEntity;
  const shirt = (p.items ?? []).find((i) => i.name === 'Short Shirt');
  return { worn: m.inventoryItemImage(shirt, p), base: m.inventoryItemImage(shirt, { gender: 'female', race: 'Argonian' }) };
});
console.log('shirt icon archive:', JSON.stringify(icons));
if (icons.worn.archive !== icons.base.archive + 3) { console.log('ICON NOT ADDRESSED FOR THE WEARER', JSON.stringify(icons)); process.exit(1); }
// the paperdoll must reload on the chosen identity
await waitFrames(10);
await page.keyboard.press('F6');
await waitFrames(10);
await page.screenshot({ path: '/home/claude/chargen-paperdoll.png' });
// AUDIT 17f: eyeball the CLOTHING & MISC tab - the shirt/pants icons
// are the ones that were coming off the wrong morphology row.
const S = 4, OX = 60, OY = 50;
await page.mouse.click(OX + 205 * S, OY + 4 * S);
await waitFrames(12);
await page.screenshot({ path: '/home/claude/chargen-clothing-icons.png' });
// S3e: the biography effects must have REACHED the entity - the
// skills screen only displays the bonus, finishChargen applies it.
const bio = await page.evaluate(() => {
  const p = window.__playerEntity;
  return { rep: [...(p.sGroupReputations ?? [])], reaction: p.biographyReactionMod ?? 0,
    poison: p.biographyResistPoisonMod ?? 0, skillSum: (p.skills ?? []).reduce((a, b) => a + b, 0) };
});
console.log('biography on the entity:', JSON.stringify(bio));
if (!bio.rep.some((v) => v !== 0)) { console.log('BIOGRAPHY REPUTATION NEVER LANDED', JSON.stringify(bio.rep)); process.exit(1); }
console.log('CHARGEN OK');
await browser.close(); await server.close();
