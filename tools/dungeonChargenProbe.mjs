// AUDIT 17i probe: the DUNGEON host's chargen carries every
// dependency. It built its own ChargenFlow by hand and so missed the
// starting spellbook (17f), the starting kit (17f) and the biography
// (17h) in turn; all three hosts mint the flow through
// createChargenFlow now, and this proves it for the one that kept
// falling behind.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
// no ?class -> the real flow, not the headless skip
page.on('console', (m) => { const t = m.text(); if (/chargen|error|Error/.test(t)) console.log('[console]', t.slice(0, 160)); });
await page.goto('http://localhost:5199/play/?shot');
// the flow is what this probe is about; the scene's shot gate can
// wait behind it (the dungeon builds the flow during its own setup)
await page.waitForFunction(() => window.__chargenFlow?.() != null, null, { timeout: 240000 });
const state = JSON.parse(await page.evaluate(() => {
  const f = window.__chargenFlow();
  return JSON.stringify({
    state: f.state,
    careers: f.careers?.length ?? 0,
    hasBiog: typeof f.biogFor === 'function' && !!f.biogFor(0)?.questions?.length,
    biogQuestions: f.biogFor?.(0)?.questions?.length ?? 0,
    classQuestions: f.questionLibrary?.length ?? 0,   // U18
    hasClassesDat: !!f.classesData?.length,           // U18
  });
}));
console.log('dungeon chargen flow:', JSON.stringify(state));
if (state.careers !== 18) { console.log('CAREERS MISSING', state.careers); process.exit(1); }
if (!state.hasBiog) { console.log('THE DUNGEON HOST STILL HAS NO BIOGRAPHY'); process.exit(1); }
if (state.biogQuestions !== 12) { console.log('BIOGRAPHY INCOMPLETE', state.biogQuestions); process.exit(1); }
// U18: the class-questions data rides createChargenFlow, so the host
// that kept falling behind gets it structurally
if (state.classQuestions !== 40) { console.log('CLASS QUESTIONS MISSING', state.classQuestions); process.exit(1); }
if (!state.hasClassesDat) { console.log('CLASSES.DAT MISSING'); process.exit(1); }
console.log('DUNGEON CHARGEN OK');
await browser.close(); await server.close();
