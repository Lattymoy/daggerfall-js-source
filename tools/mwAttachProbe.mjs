// MWFIX LIVE PROOF: the attach door, pressed in a real browser.
//
// The three defects this guards were ALL invisible to the node suite -
// a z-index that loses to the pane that opens it is not a logic error,
// it is a stacking one, and only a real layout answers it. The proof is
// the browser's own hit test: press "Attach data" in the enhanced
// shell, then ask document.elementFromPoint what sits at the file
// input's centre. Before the fix it answered a SHELL element
// (DIV.row-note) and the input was unreachable; it must answer the
// input itself.
//
// Usage: node tools/mwAttachProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5233, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));

const fails = [];
const ok = (cond, label) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`);
  if (!cond) fails.push(label);
};

await page.goto('http://localhost:5233/menu.html');
await page.waitForTimeout(1200);

const r = await page.evaluate(async () => {
  const out = {};
  const em = await import('/src/ui/enhancedMenu.js');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:12;background:#0e1013;overflow:hidden';
  document.body.appendChild(host);
  em.mountEnhancedMenu(host, { mode: 'boot' });
  await new Promise((s) => setTimeout(s, 400));

  // the ENHANCED pane (the face's buttons carry diamonds)
  const tab = [...host.querySelectorAll('button')]
    .find((b) => /Enhanced/.test(b.textContent ?? '') && b.textContent.includes('◆'));
  out.reachedPane = !!tab;
  tab?.click();
  await new Promise((s) => setTimeout(s, 400));

  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Attach data');
  out.foundButton = !!btn;
  if (!btn) return out;
  btn.click();
  await new Promise((s) => setTimeout(s, 500));

  const input = document.querySelector('#pickassets');
  out.pickerExists = !!input;
  if (!input) return out;
  const b = input.getBoundingClientRect();
  const top = document.elementFromPoint(Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2));
  out.topAtPicker = top ? `${top.tagName}#${top.id || '-'}` : null;
  out.pickerIsHitTarget = top === input || input.contains(top);

  // ...and it can be dismissed without the mouse (the never-traps arm)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise((s) => setTimeout(s, 200));
  out.escapeClosed = !document.querySelector('#pickassets');
  return out;
});

ok(r.reachedPane, 'the Enhanced pane opens');
ok(r.foundButton, 'the attach card is on it');
ok(r.pickerExists, 'pressing Attach data builds the picker');
ok(r.pickerIsHitTarget, `the file input is the browser's OWN hit target (got ${r.topAtPicker})`);
ok(r.escapeClosed, 'and Escape closes it - the modal never traps');
ok(crashes.length === 0, `no page errors (${crashes.slice(0, 2).join(' | ')})`);

await browser.close();
await server.close();
console.log(fails.length ? `\nFAILED: ${fails.length}` : '\nALL GREEN');
process.exit(fails.length ? 1 : 0);
