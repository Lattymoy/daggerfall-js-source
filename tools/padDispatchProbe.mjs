// PAD1 (2026-09-21) - THE DISPATCH-TARGET LAW, proved in a real browser.
// ui/gamepadInput.js synthesises a keydown per pad button. Dispatched on
// the WINDOW, an event's path is the window alone and a listener on the
// DOCUMENT - the enhanced controls pane's capture, `document.addEventListener
// ('keydown', ..., { capture: true })` - never sees it; dispatched on the
// DOCUMENT it reaches the document's listeners and then bubbles to the
// window's, where the hosts listen. This prints what Chromium does with
// both, so the poller's choice of target is a measured fact, not a belief.
//   node tools/padDispatchProbe.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas></canvas>');
const seen = await page.evaluate(() => {
  const out = [];
  document.addEventListener('keydown', (e) => out.push(`document-capture:${e.code}`), { capture: true });
  window.addEventListener('keydown', (e) => out.push(`window:${e.code}`));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'JoystickButton4', bubbles: true }));
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'JoystickButton5', bubbles: true }));
  return out;
});
await browser.close();
console.log(JSON.stringify(seen));
const ok = !seen.includes('document-capture:JoystickButton4') && seen.includes('document-capture:JoystickButton5') && seen.includes('window:JoystickButton5');
console.log(ok ? 'PASS: a window-targeted key never reaches a document listener; a document-targeted one reaches both' : 'FAIL');
process.exit(ok ? 0 : 1);
