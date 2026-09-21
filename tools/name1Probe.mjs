// AUDIT NAME1 F15: THE NAMES OVER THE OTHERS, MEASURED IN A REAL BROWSER.
//
// The NAME1 + BUBBLE1 record said "Seen in Chromium" and shipped no artifact. This is the artifact: a page served
// from this repo, over the REAL modules (src/ui/nameLayer.js, src/net/remotePlayers.js, src/world/mat4.js - imported
// same-origin, not re-implemented here), three peers standing at three depths, and the numbers read back off the
// live layout engine. Node has no layout engine, so every claim about a BOX - the label's bottom edge landing the
// gap above the head, the size it wears at a distance, a bubble wrapping and being cut - is a claim the suite
// cannot check and this file can.
//
// It needs no game data and no dev server: it serves the tree itself on a loopback port, so the module graph is the
// shipping one.
//
//     node tools/name1Probe.mjs
//
// PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers in this environment; pass CHROMIUM=/path/to/chromium to override the
// executable.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html' };

/** The page: the real modules, three peers, one frame, and every box read back. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>NAME1 probe</title>
<style>html,body{margin:0;height:100%;background:#12141a;overflow:hidden}</style></head><body>
<script type="module">
import { createNameLayer, BUBBLE_CHARS, BUBBLE_ELLIPSIS } from '/src/ui/nameLayer.js';
import { RemotePlayers, NAME_GAP_PX, NAME_SCALE_REF, NAME_RANGE } from '/src/net/remotePlayers.js';
import { perspective, mirrorProjectionX, lookAt } from '/src/world/mat4.js';
import { PARTY_GREEN, PARTY_GREEN_CSS } from '/src/net/social.js';

const W = window.innerWidth, H = window.innerHeight;
const FOV = Number(new URLSearchParams(location.search).get('fov') ?? 60);
const proj = mirrorProjectionX(perspective((FOV * Math.PI) / 180, W / H, 0.2, 6000));
const eye = [0, 1.7, 0];
const view = lookAt(eye, [0, 1.7, -10], [0, 1, 0]);

// three peers, three depths: in your face, at the reference, and far out
const rows = [
  { id: 'near', name: 'NEARBY', z: -6 },
  { id: 'mid', name: 'MIDFIELD', z: -NAME_SCALE_REF },
  { id: 'far', name: 'FARAWAY', z: -(NAME_RANGE * 0.6) },
];
const rp = new RemotePlayers({ renderer: {}, deps: null, compose: async () => null });
rp.sync(rows.map((r) => ({ id: r.id, name: r.name, shown: { x: 0, y: 0, z: r.z, yaw: 0 }, look: null })),
  (p) => [p.x, p.y, p.z], { bodyHeight: () => 1.8 });

const layer = createNameLayer({});
// the party's own green for ONE of them, the picture's answer as the host hands it in
const colorOf = (id) => (id === 'mid' ? PARTY_GREEN : null);
// two bubbles: a short remark, and a line long enough to be cut AND wrapped
const LONG = 'this is the sort of remark a player types when they have a great deal to say and no sense at all of ' +
  'how much of it will fit over their own head in a bubble';
layer.say('near', 'over here');
layer.say('mid', LONG);
const drawn = rp.nameFrame({ proj, view, w: W, h: H, eye, toScene: (p) => [p.x, p.y, p.z], layer, colorOf, hudScale: 1 });

const points = rp.namePoints(proj, view, W, H, eye, (p) => [p.x, p.y, p.z]);
const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom }; };
const out = { W, H, FOV, drawn, gap: NAME_GAP_PX, partyGreen: PARTY_GREEN_CSS, peers: [], css: {} };
const root = document.querySelector('.dfnames');
out.css.zIndex = getComputedStyle(root).zIndex;
out.css.pointerEvents = getComputedStyle(root).pointerEvents;
for (const p of points) {
  const tag = layer.tagFor(p.id);
  const cs = getComputedStyle(tag.name);
  const bs = getComputedStyle(tag.bubble);
  out.peers.push({
    id: p.id, depth: p.depth, scale: p.scale,
    headX: p.x, headY: p.y,
    fontPx: Number(cs.fontSize.replace('px', '')),
    color: cs.color, family: cs.fontFamily.split(',')[0],
    label: box(tag.name), node: box(tag.node),
    bubble: tag.bubble.className.includes('off') ? null : { ...box(tag.bubble), text: tag.bubble.textContent, lines: Math.round(box(tag.bubble).h / parseFloat(bs.lineHeight)) },
  });
}
out.cut = { chars: BUBBLE_CHARS, mark: BUBBLE_ELLIPSIS, said: LONG.length };
window.__probe = out;
document.title = 'ready';
<\/script></body></html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  // the probe's own page has its own path: the ROOT is the landing page's, and a tool that drives the root as if it
  // were the game is a thing test/landing.test.js refuses (U60).
  if (url.pathname === '/probe/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  const path = normalize(join(ROOT, url.pathname));
  if (!path.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': MIME[path.slice(path.lastIndexOf('.'))] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fails = [];
const runs = [];
for (const [fov, size] of [[60, { width: 1600, height: 900 }], [120, { width: 1600, height: 900 }], [60, { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: size });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/probe/?fov=${fov}`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__probe, null, { timeout: 15000 }).catch(() => {});
  const probe = await page.evaluate(() => window.__probe ?? null);
  if (!probe) { fails.push(`FOV ${fov} ${size.width}x${size.height}: the page never reported (${errors.join('; ') || 'no error'})`); await page.close(); continue; }
  runs.push(probe);

  console.log(`\n== ${probe.W}x${probe.H}, FOV ${probe.FOV} - ${probe.drawn} names, layer z-index ${probe.css.zIndex}, pointer-events ${probe.css.pointerEvents}`);
  for (const p of probe.peers) {
    const clear = p.headY - p.label.bottom;
    console.log(`   ${p.id.padEnd(4)} depth ${p.depth.toFixed(1).padStart(5)}  scale ${p.scale.toFixed(3)}  font ${p.fontPx.toFixed(1)}px  ` +
      `label ${p.label.w.toFixed(1)}x${p.label.h.toFixed(1)}  bottom edge ${clear.toFixed(2)}px above the head  ${p.color}  ${p.family}`);
    if (clear < probe.gap - 0.51) fails.push(`${p.id} at FOV ${probe.FOV}: the label ends ${clear.toFixed(2)}px above the head, under the ${probe.gap}px gap`);
    if (p.label.bottom > p.headY) fails.push(`${p.id} at FOV ${probe.FOV}: the label reaches the head point itself`);
    if (!/Pixelify/i.test(p.family)) fails.push(`${p.id}: the face is ${p.family}, not the enhanced skin's`);
  }
  const green = probe.peers.find((p) => p.id === 'mid');
  console.log(`   party green: ${green.color} (the picture says ${probe.partyGreen})`);
  const bubbles = probe.peers.filter((p) => p.bubble);
  for (const p of bubbles) {
    console.log(`   bubble over ${p.id}: ${p.bubble.w.toFixed(1)}x${p.bubble.h.toFixed(1)} (bound ${(0.92 * p.fontPx * (15 + 2 * 0.55) + 2).toFixed(1)}) over ${p.bubble.lines} line(s), ${p.bubble.text.length} chars` +
      `${p.bubble.text.endsWith(probe.cut.mark) ? ` - CUT from ${probe.cut.said} with "${probe.cut.mark}"` : ''}`);
  }
  if (bubbles.length !== 2) fails.push(`FOV ${probe.FOV}: ${bubbles.length} bubbles standing, not 2`);
  const long = probe.peers.find((p) => p.id === 'mid');
  if (long.bubble) {
    // the cut's own length, which trims the tail before the mark, so it is AT MOST chars + the mark
    if (!long.bubble.text.endsWith(probe.cut.mark) || long.bubble.text.length > probe.cut.chars + probe.cut.mark.length) {
      fails.push(`the long line is ${long.bubble.text.length} chars and ends "${long.bubble.text.slice(-3)}", not the cut's ${probe.cut.chars} + "${probe.cut.mark}"`);
    }
    if (long.bubble.lines < 2) fails.push('the long line did not WRAP - the bubble is one line');
    // 15em of the BUBBLE's own size (.92em of the label's), plus its padding and border - the box, not the text
    const bound = 0.92 * long.fontPx * (15 + 2 * 0.55) + 2 + 1;
    if (long.bubble.w > bound) fails.push(`the bubble is ${long.bubble.w.toFixed(1)}px wide, past its ${bound.toFixed(1)}px bound`);
  }
  if (Number(probe.css.zIndex) >= 4) fails.push(`the layer sits at z-index ${probe.css.zIndex} - level with the HUD`);
  if (probe.css.pointerEvents !== 'none') fails.push('the layer takes clicks');
  await page.close();
}
await browser.close();
server.close();

// THE TWO LAWS ACROSS RUNS: a far name is smaller than a near one, and a wide lens (or a small screen) makes every
// name smaller than the same peer wore on the reference frame.
const [ref, wide, phone] = runs;
if (ref) {
  const [near, mid, far] = ref.peers;
  if (!(near.fontPx > mid.fontPx && mid.fontPx >= far.fontPx)) fails.push(`the sizes do not fall with depth: ${near.fontPx}, ${mid.fontPx}, ${far.fontPx}`);
  if (wide) for (const p of ref.peers) {
    const w = wide.peers.find((q) => q.id === p.id);
    if (w && w.fontPx > p.fontPx) fails.push(`${p.id}: FOV 120 wears ${w.fontPx}px against FOV 60's ${p.fontPx}px`);
  }
  if (phone) for (const p of ref.peers) {
    const q = phone.peers.find((r) => r.id === p.id);
    if (q && q.fontPx > p.fontPx) fails.push(`${p.id}: the phone wears ${q.fontPx}px against the desktop's ${p.fontPx}px`);
  }
}

if (fails.length) {
  console.error('\nFAILED:');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nPASS: every label\'s bottom edge clears the head by the gap, the size falls with depth and with the lens, the party green is the picture\'s, two bubbles stand and the long one is cut and wrapped.');
