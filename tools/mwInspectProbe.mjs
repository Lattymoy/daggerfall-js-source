// MW-D LIVE PROOF. The reverted arc's node tests were green through three
// broken releases; what caught the real defects every time was a probe that
// drove the actual page. So this one builds a Morrowind archive and record
// file BY HAND, hands them to mw-inspect.html through the REAL file input,
// and reads the verdicts back out of the rendered DOM.
//
// The headline assertion is the one the whole arc turned on: an archive
// WITHOUT meshes/base_anim.1st.nif - the name the reverted rig hardcoded -
// must say so, in words, on screen.
//
// Usage: node tools/mwInspectProbe.mjs
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { MwBsaFile } from '../src/formats/mwBsaFile.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const zt = (s) => [...ascii(s), 0];

function buildBsa(entries) {
  const n = entries.length;
  const names = []; const nameOffsets = [];
  let no = 0;
  for (const e of entries) { nameOffsets.push(no); names.push(...zt(e.name)); no += e.name.length + 1; }
  const dirsize = 12 * n + names.length;
  const table = []; let off = 0;
  for (const e of entries) { table.push(...u32(e.data.length), ...u32(off)); off += e.data.length; }
  for (const o of nameOffsets) table.push(...u32(o));
  return Uint8Array.from([...u32(0x100), ...u32(dirsize), ...u32(n), ...table, ...names,
    ...new Array(8 * n).fill(0xcd), ...entries.flatMap((e) => [...e.data])]);
}
const nif = (line, ver) => Uint8Array.from([...ascii(line), 0x0a, ...u32(ver), ...new Array(64).fill(0)]);
const sub = (name, data) => [...ascii(name), ...u32(data.length), ...data];
const PARTS = ['head', 'hair', 'neck', 'chest', 'groin', 'hand', 'wrist', 'forearm', 'upperarm'];
const body = (id, race, part, { female = false, model = 'b/x.nif' } = {}) => {
  const d = [...sub('NAME', zt(id)), ...sub('MODL', zt(model)), ...sub('FNAM', zt(race)),
    ...sub('BYDT', [PARTS.indexOf(part), 0, female ? 1 : 0, 0])];
  return [...ascii('BODY'), ...u32(d.length), ...u32(0), ...u32(0), ...d];
};

const server = await createServer({ server: { port: 5223, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));

const fails = [];
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) fails.push(label); };

await page.goto('http://localhost:5223/mw-inspect.html');

// An archive shaped like RETAIL: it has xbase_anim.1st.nif and does NOT
// have base_anim.1st.nif - exactly the situation the reverted rig died on.
// MW-D2: the two arm meshes differ ON PURPOSE - the hand carries a
// NiSkinInstance and the wrist does not - because a page that reports one
// verdict for everything would pass a fixture where they agree.
// The fixture archive is the source for the real files below - a loose
// base_anim.nif does not exist on disk, it lives inside it.
const fixtureBsa = new MwBsaFile(new Uint8Array(readFileSync('test/fixtures/mw/fixture.bsa')));
const nifRecs = (types) => {
  const out = [...ascii('NetImmerse File Format, Version 4.0.0.2'), 0x0a, ...u32(0x04000002)];
  for (const t of types) out.push(...u32(t.length), ...ascii(t), ...[7, 0, 0, 0, 1, 2, 3]);
  return Uint8Array.from(out);
};
const bsa = buildBsa([
  // A REAL skeleton, so MW-D4's bone table is actually exercised rather
  // than short-circuited by a header stub that cannot parse.
  { name: 'meshes\\XBase_Anim.1st.nif', data: fixtureBsa.get('meshes/base_anim.nif') },
  { name: 'meshes\\Base_Anim_Female.1st.nif', data: nif('NetImmerse File Format, Version 4.0.0.2', 0x04000002) },
  { name: 'meshes\\b\\H1.nif', data: nifRecs(['NiNode', 'NiTriShape', 'NiSkinInstance']) },
  // A REAL NIF, so the draw panel's SUCCESS path is proven live and not
  // only in node: this one must parse and put pixels on a canvas.
  { name: 'meshes\\b\\W.nif', data: new Uint8Array(readFileSync('test/fixtures/mw/plain.nif')) },
]);
const esm = Uint8Array.from([
  ...body('b_n_nord_m_hand.1st', 'nord', 'hand', { model: 'b/H1.nif' }),
  ...body('b_n_nord_m_wrist', 'nord', 'wrist', { model: 'b/W.nif' }),   // third-person only
  ...body('b_n_nord_m_chest', 'nord', 'chest'),                          // not an arm
]);

await page.setInputFiles('#file', [
  { name: 'Morrowind.bsa', mimeType: 'application/octet-stream', buffer: Buffer.from(bsa) },
  { name: 'Morrowind.esm', mimeType: 'application/octet-stream', buffer: Buffer.from(esm) },
]);
await page.waitForSelector('#out table', { timeout: 10000 });
const text = await page.textContent('#out');

ok(/4 files/.test(text), 'the archive is read and its file count shown');
ok(/xbase_anim\.1st\.nif[\s\S]{0,80}present/.test(text), 'the REAL first-person skeleton is reported present');
ok(/base_anim\.1st\.nif[\s\S]{0,120}ABSENT/.test(text),
  'and the name the reverted rig hardcoded is reported ABSENT');
ok(/not in this archive[\s\S]{0,200}never drew anything/.test(text),
  'the page SAYS WHY IN WORDS, which is the whole point of it');
ok(/4\.0\.0\.2/.test(text), 'the NIF header is parsed and its version shown');
ok(/bool = 4 bytes/.test(text), 'and the version-derived bool width is reported');
ok(/3 body records/.test(text) && /1 of them are first-person/.test(text),
  'the ESM body records are counted, first-person ones separately');
ok(/hand[\s\S]{0,120}first-person record found/.test(text), 'the hand slot finds its .1st record');
ok(/wrist[\s\S]{0,160}falls back to the third-person mesh/.test(text),
  'the wrist has no .1st record and the fallback is named as such');
ok(/forearm[\s\S]{0,120}NOTHING for this slot/.test(text), 'a slot with no data says so plainly');

ok(/SKINNED/.test(text), 'the skinned hand mesh is reported SKINNED');
ok(/rigid/.test(text), 'and the unskinned wrist mesh is reported rigid');
ok(/Both kinds are present here, so the rig must handle both/.test(text),
  'and when the two disagree the page says so, instead of picking one');
ok(/scan<\/b>, not a parse/.test(text) || /scan.{0,12}not a parse/.test(text),
  'the verdict carries its own uncertainty on screen');

// MW-D3: the fixture arm meshes are NOT real NIFs (they are record-name
// stubs for the scan), so the reader must REFUSE them and print the stage
// and message rather than leaving an empty box. That is the behaviour
// under test: a failure that says why.
await page.waitForSelector('#draws .draw', { timeout: 10000 });
const drawText = await page.textContent('#draws');
ok(/hand/.test(drawText) && /wrist/.test(drawText), 'each arm slot with a mesh gets its own panel');
const pixels = await page.evaluate(() => {
  const cvs = [...document.querySelectorAll('#draws canvas')];
  return cvs.map((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  });
});
ok(pixels.length >= 1, 'a real NIF gets a canvas, not just a message');
ok(pixels.some((n) => n > 200), `and the wireframe actually DRAWS (${pixels.join(', ')} lit pixels)`);
ok(/parse:|flatten:|geometry:/.test(drawText),
  `a mesh the strict reader refuses names its STAGE (got: ${drawText.replace(/\s+/g, ' ').slice(0, 120)})`);
ok(!/^\s*$/.test(drawText), 'and never an empty box - the reverted rig\'s defining behaviour');

// MW-D4: the bone table. The fixture skeleton is a TEST RIG, not
// Morrowind's, so the retail bone names are expected to be MISSING - and
// the assertion is that the page SAYS so, in the row, rather than
// shortening the list or defaulting to cheerful.
await page.waitForSelector('#bones table', { timeout: 10000 });
const boneText = await page.textContent('#bones');
ok(/Left Hand/.test(boneText) && /Weapon Bone Left/.test(boneText),
  'every required bone gets a row, including the bow-only one');
ok(/MISSING/.test(boneText), 'and a bone this skeleton lacks is named MISSING');
ok(/are missing[\s\S]{0,300}before a rig is written against them/.test(boneText),
  'with the consequence spelled out, not left for the reader to infer');

// a corrupt archive must be named, not swallowed
const bad = Uint8Array.from([...u32(0x102), ...u32(0), ...u32(0)]);
await page.setInputFiles('#file', [
  { name: 'Broken.bsa', mimeType: 'application/octet-stream', buffer: Buffer.from(bad) },
]);
await page.waitForSelector('.err', { timeout: 5000 }).catch(() => {});
ok(/not a Morrowind BSA/.test(await page.textContent('#out')), 'a wrong magic is reported, not swallowed');

ok(crashes.length === 0, `no pageerrors${crashes.length ? ': ' + crashes.join(' | ') : ''}`);

await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL GREEN');
process.exit(fails.length ? 1 : 0);
