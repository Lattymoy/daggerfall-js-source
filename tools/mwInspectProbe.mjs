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
import { createServer } from 'vite';
import { chromium } from 'playwright';

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
const bsa = buildBsa([
  { name: 'meshes\\XBase_Anim.1st.nif', data: nif('NetImmerse File Format, Version 4.0.0.2', 0x04000002) },
  { name: 'meshes\\Base_Anim_Female.1st.nif', data: nif('NetImmerse File Format, Version 4.0.0.2', 0x04000002) },
  { name: 'meshes\\b\\B_N_Nord_M_Hand.nif', data: Uint8Array.from([1, 2, 3]) },
]);
const esm = Uint8Array.from([
  ...body('b_n_nord_m_hand.1st', 'nord', 'hand', { model: 'b/h1.nif' }),
  ...body('b_n_nord_m_wrist', 'nord', 'wrist'),           // third-person only
  ...body('b_n_nord_m_chest', 'nord', 'chest'),           // not an arm
]);

await page.setInputFiles('#file', [
  { name: 'Morrowind.bsa', mimeType: 'application/octet-stream', buffer: Buffer.from(bsa) },
  { name: 'Morrowind.esm', mimeType: 'application/octet-stream', buffer: Buffer.from(esm) },
]);
await page.waitForSelector('#out table', { timeout: 10000 });
const text = await page.textContent('#out');

ok(/3 files/.test(text), 'the archive is read and its file count shown');
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
