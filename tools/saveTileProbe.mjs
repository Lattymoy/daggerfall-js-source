// TILE1/TILE2 — THE SAVE TILES, IN A REAL BROWSER.
//
// Mac: "a detailed tile based design for your saves which will
// translate to the load character pane also. Basically showing your
// portrait and character information."
//
// node cannot draw a tile, so the node pins hold its ARITHMETIC and
// this holds the drawing. Same machinery as tools/accountCardProbe.mjs
// and for the same reason ACC1e needed it: DECLARING a font family and
// RENDERING in it are different claims, and only a computed style can
// tell them apart.
//
//     node tools/saveTileProbe.mjs
//     PROBE_SHOTS=/tmp node tools/saveTileProbe.mjs
//
// THE PORTRAIT IS A STAND-IN AND THE SHEET SAYS SO. A real head is ten
// records in the race-and-gender FACE CIF and needs the player's own
// Daggerfall files, which this container does not have. The stand-in is
// drawn at the REAL size of a head record (64x80 at 1x, 2x here, which
// is what ui/facePortrait.js produces) so the layout under test is the
// layout a player gets - what it cannot show is the art itself.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const MODULES = { '/saveTile.js': read('src/ui/saveTile.js') };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.route('**/*', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (MODULES[path]) return route.fulfill({ status: 200, contentType: 'text/javascript', body: MODULES[path] });
  if (path === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><div id="app"></div></body></html>' });
  return route.abort();
});
await page.goto('http://probe.invalid/', { waitUntil: 'domcontentloaded' });

const { ENHANCED_CSS, ENHANCED_FONTS_URL, ENHANCED_TOKENS } = await import('../src/ui/enhancedStyle.js');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
let fontCss = await (await fetch(ENHANCED_FONTS_URL, { headers: { 'user-agent': UA } })).text();
for (const u of [...new Set([...fontCss.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]))]) {
  const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
  fontCss = fontCss.split(u).join(`data:font/woff2;base64,${buf.toString('base64')}`);
}
await page.addStyleTag({ content: fontCss });
await page.addStyleTag({ content: ENHANCED_CSS });
await page.evaluate(() => document.fonts.ready);

/** The saves a player would actually be looking at. */
const SAVES = [
  { name: 'Nystul', race: 'Breton', career: 'Battlemage', level: 12, health: 84, maxHealth: 120, gold: 14230,
    when: '17th of Hearthfire, 3E 405', hour: '21:40', saveName: 'QuickSave', face: true, cloud: 'saved' },
  { name: 'Aelwin the Grim', race: 'Nord', career: 'Barbarian', level: 7, health: 96, maxHealth: 96, gold: 320,
    when: '2nd of Frostfall, 3E 405', hour: '06:15', saveName: 'before the lich', face: true, cloud: 'none' },
  { name: 'Shazara', race: 'Redguard', career: 'Assassin', level: 19, health: 41, maxHealth: 155, gold: 88104,
    when: '28th of Last Seed, 3E 405', hour: '03:02', saveName: 'AutoSave', face: true, cloud: 'busy' },
  { name: 'Mithriil Stormaire', race: 'High Elf', career: 'Spellsword', level: 3, health: 30, maxHealth: 44, gold: 9,
    when: '1st of Morning Star, 3E 405', hour: '12:00', saveName: 'a very long slot name indeed', face: false, cloud: 'bad' },
  // AUDIT-312 F2: a card from before CHARID1. It cannot be filed in the
  // cloud yet and it is not a failure, so it gets the sentence and no
  // button - and it must still read as an ordinary tile.
  { name: 'Old Gwylim', race: 'Wood Elf', career: 'Archer', level: 5, health: 52, maxHealth: 52, gold: 1204,
    when: '9th of Sun\'s Dusk, 3E 405', hour: '18:30', saveName: 'QuickSave', face: false, cloud: 'wait' },
];

const measured = await page.evaluate(async ({ saves }) => {
  const { saveTile, saveFromCard } = await import('/saveTile.js');
  const app = document.getElementById('app');
  app.style.cssText = 'padding:28px;max-width:1040px;margin:0 auto;';

  /** A head record's real size (64x80 at 1x), drawn at 2x as
   *  facePortrait.js draws it - so the layout is the real layout. */
  const standIn = () => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#2b323b'; g.fillRect(0, 0, 128, 160);
    g.fillStyle = '#4a4034'; g.fillRect(34, 24, 60, 72);
    g.fillStyle = '#6b5c46'; g.fillRect(24, 96, 80, 64);
    g.fillStyle = '#0e1013'; g.fillRect(48, 50, 8, 8); g.fillRect(72, 50, 8, 8);
    return c;
  };

  const grid = document.createElement('div');
  grid.className = 'svgrid';
  app.append(grid);
  const cloudOf = (s) => ({
    // AUDIT-312 F1: a backed-up slot carries BOTH cloud buttons now -
    // the delete had a route and a client call and no door at all, while
    // the refusal table already told a player at the bound to delete
    // one. Two buttons plus the line is what has to fit.
    saved: { state: 'saved', when: '2 hours ago', actions: [{ label: 'Back up again' }, { label: 'Delete backup' }] },
    none: { state: 'none', actions: [{ label: 'Back up' }] },
    busy: { state: 'busy' },
    bad: { state: 'bad', why: 'Your cloud backup is full. Delete a save there to make room.', actions: [{ label: 'Try again' }] },
    wait: { state: 'wait', why: 'Load this save once, then it can be backed up.' },
    off: { state: 'off' },
  })[s.cloud];
  const tiles = [];
  saves.forEach((s, i) => {
    const t = saveTile(document, s, {
      current: i === 0,
      face: s.face ? standIn() : null,
      cloud: cloudOf(s),
      actions: i === 0
        ? [{ label: 'Load', primary: true }, { label: 'Delete' }]
        : [{ label: 'Load', primary: true }, { label: 'Delete' }],
    });
    grid.append(t);
    tiles.push(t);
  });

  // ...and the same tile with NO account, which is what most players
  // see: no cloud line at all, because ACC0's wall is at cloud saves
  // and a player who has not asked for one is not nagged on every tile.
  const plain = document.createElement('div');
  plain.className = 'svgrid';
  plain.style.marginTop = '8px';
  app.append(plain);
  const bare = saveTile(document, saves[0], { face: standIn(), cloud: { state: 'off' }, actions: [{ label: 'Play online', primary: true }] });
  plain.append(bare);

  // ── ACC2c: THE SAVES THAT ARE ONLY IN THE BACKUP ───────────────
  // Stood up in a REAL browser because that is the only place three of
  // its claims can be checked: that a heading in the display face
  // actually gets one (ACC1f found `.shell .card h3` forcing the pixel
  // face on a card that had never asked for it), that `is-only` is a
  // DIFFERENT colour from the verdigris a backed-up local save wears,
  // and that a tile with no face, no sub-line and no stats is still a
  // tile rather than a collapsed strip.
  const onlyBox = document.createElement('div');
  onlyBox.className = 'svcloudonly';
  const h4 = document.createElement('h4');
  h4.textContent = '2 saves are only in your backup';
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = 'Download one to bring it back to this device.';
  const onlyGrid = document.createElement('div');
  onlyGrid.className = 'svgrid';
  onlyBox.append(h4, meta, onlyGrid);
  app.append(onlyBox);
  const CARDS = [
    { characterId: 'c1', saveName: 'QuickSave', characterName: 'Nystul', gameTime: 523000, updatedAt: 0, bytes: 91233 },
    { characterId: 'c2', saveName: 'a very long slot name indeed', characterName: 'Mithriil Stormaire', gameTime: 9000, updatedAt: 0, bytes: 44000 },
  ];
  const onlyTiles = CARDS.map((card) => {
    const t = saveTile(document, saveFromCard(card, (m) => ({ hour: Math.floor(m / 60) % 24, minute: m % 60 }), () => '17th of Hearthfire, 3E 405'), {
      cloud: { state: 'only', when: '3 days ago', actions: [{ label: 'Delete backup' }] },
      actions: [{ label: 'Download', primary: true }],
    });
    onlyGrid.append(t);
    return t;
  });

  const cs = (el) => (el ? getComputedStyle(el) : null);
  const box = (el) => el.getBoundingClientRect();
  return {
    tiles: tiles.map((t, i) => ({
      name: saves[i].name,
      w: Math.round(box(t).width), h: Math.round(box(t).height),
      border: cs(t).borderTopColor,
      head: cs(t.querySelector('h3')).fontFamily,
      headSize: cs(t.querySelector('h3')).fontSize,
      sub: cs(t.querySelector('.svsub'))?.color ?? null,
      when: cs(t.querySelector('.svwhen'))?.color ?? null,
      faceW: t.querySelector('.svface canvas') ? Math.round(box(t.querySelector('.svface canvas')).width) : 0,
      wellW: Math.round(box(t.querySelector('.svface')).width),
      wellH: Math.round(box(t.querySelector('.svface')).height),
      initial: !!t.querySelector('.svinitial'),
      rendering: t.querySelector('.svface canvas') ? cs(t.querySelector('.svface canvas')).imageRendering : null,
      cloudSay: t.querySelector('.svsay')?.textContent ?? null,
      cloudColor: cs(t.querySelector('.svsay'))?.color ?? null,
      cloudButtons: [...t.querySelectorAll('.svcloud .act')].map((b) => b.textContent),
      // Does the cloud line fit? Its own right edge against the last
      // button's - a second button that wraps off the tile is the fault
      // a source sweep cannot see.
      cloudRight: t.querySelector('.svcloud')
        ? Math.round(box(t.querySelector('.svcloud')).right) : 0,
      cloudLastRight: t.querySelector('.svcloud .act:last-child')
        ? Math.round(box(t.querySelector('.svcloud .act:last-child')).right) : 0,
      slot: t.querySelector('.svslot')?.textContent ?? null,
      // A LONG SLOT NAME SITS ON THE HEADING'S LINE, so it is bounded
      // and clipped rather than allowed to crowd the character's name.
      slotW: t.querySelector('.svslot') ? Math.round(box(t.querySelector('.svslot')).width) : 0,
      // THE TEXT's right edge, not the heading BLOCK's: an h3 is
      // full-width whatever it says, so measuring its box would make
      // this check about the column and not about the name.
      nameRight: (() => {
        const h = t.querySelector('h3');
        const r = document.createRange();
        r.selectNodeContents(h);
        return Math.round(r.getBoundingClientRect().right);
      })(),
      slotLeft: t.querySelector('.svslot') ? Math.round(box(t.querySelector('.svslot')).left) : Infinity,
      // NOTHING MAY LEAVE ITS TILE. A long slot name and a long
      // character name are the two that would.
      overflow: [...t.querySelectorAll('*')].some((n) => box(n).right > box(t).right + 1 || box(n).bottom > box(t).bottom + 1),
      // THE ACTIONS LINE UP: the foot row starts at the same offset
      // from the tile's own top edge in every tile of a row, which is
      // what a grid of equal-height tiles buys.
      actsTop: Math.round(box(t.querySelector('.acts')).top - box(t).top),
    })),
    bare: { cloud: !!bare.querySelector('.svcloud'), h: Math.round(box(bare).height) },
    only: {
      headFace: cs(h4).fontFamily,
      headSize: cs(h4).fontSize,
      say: onlyTiles[0].querySelector('.svsay')?.textContent ?? null,
      sayColor: cs(onlyTiles[0].querySelector('.svsay'))?.color ?? null,
      // WHAT A CARD DOES NOT CARRY MUST NOT BE DRAWN: no sub-line, no
      // stats list, and the well on its initial.
      sub: !!onlyTiles[0].querySelector('.svsub'),
      stats: !!onlyTiles[0].querySelector('.stats'),
      initial: !!onlyTiles[0].querySelector('.svinitial'),
      wellW: Math.round(box(onlyTiles[0].querySelector('.svface')).width),
      tiles: onlyTiles.map((t) => ({ w: Math.round(box(t).width), h: Math.round(box(t).height) })),
      buttons: onlyTiles.map((t) => [...t.querySelectorAll('.act')].map((b) => b.textContent).join('/')),
      overflow: onlyTiles.some((t) => [...t.querySelectorAll('*')].some((n) => box(n).right > box(t).right + 1 || box(n).bottom > box(t).bottom + 1)),
      // The group's own rule above it, so the eye reads two groups.
      ruled: cs(onlyBox).borderTopWidth,
    },
    perRow: (() => {
      const tops = tiles.map((t) => Math.round(box(t).top));
      return tops.filter((v) => v === tops[0]).length;
    })(),
  };
}, { saves: SAVES });

const token = (n) => ENHANCED_TOKENS.match(new RegExp(`--${n}:\\s*([^;]+);`))?.[1]?.trim();
const rgb = (hex) => { const h = hex.replace('#', ''); return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`; };
const BRASS = rgb(token('brass')), DIM = rgb(token('dim')), VERDIGRIS = rgb(token('verdigris')), RUBY = rgb(token('ruby'));

check('no page errors while drawing any tile', errors.length === 0, errors.join(' | '));
check('every tile drew with real size', measured.tiles.every((t) => t.w > 280 && t.h > 140),
  measured.tiles.map((t) => `${t.name}:${t.w}x${t.h}`).join('  '));
check('the tiles sit in a GRID, more than one across at desktop width', measured.perRow >= 2, `${measured.perRow} across`);
check('nothing leaves its tile - not a long name, not a long slot name',
  measured.tiles.every((t) => !t.overflow), measured.tiles.filter((t) => t.overflow).map((t) => t.name).join(', '));
check('every tile in a row puts its buttons at the same height',
  new Set(measured.tiles.slice(0, measured.perRow).map((t) => t.actsTop)).size === 1,
  measured.tiles.map((t) => t.actsTop).join('/'));

check('a name is set in the skin\'s DISPLAY face', measured.tiles.every((t) => /Cormorant/.test(t.head)), measured.tiles[0].head);
check('the quiet lines are DIM, not the body colour', measured.tiles.every((t) => t.when === DIM), measured.tiles[0].when);
check('the slot this pane is ABOUT wears the brass edge, and no other',
  measured.tiles[0].border === BRASS && measured.tiles.slice(1).every((t) => t.border !== BRASS),
  measured.tiles.map((t) => t.border).join(' '));

check('the well is a FIXED box, so a tile is the same size with a portrait or without',
  new Set(measured.tiles.map((t) => `${t.wellW}x${t.wellH}`)).size === 1,
  [...new Set(measured.tiles.map((t) => `${t.wellW}x${t.wellH}`))].join(' '));
check('a portrait is drawn as PIXELS, never smoothed',
  measured.tiles.filter((t) => t.faceW).every((t) => t.rendering === 'pixelated'));
check('a save with no portrait draws its initial rather than a hole',
  measured.tiles.some((t) => t.initial) && measured.tiles.filter((t) => t.faceW).length >= 3);

check('the name and the slot share a row and never overlap, however long either is',
  measured.tiles.every((t) => t.slotLeft >= t.nameRight - 1),
  measured.tiles.map((t) => `slot@${t.slotLeft} vs name to ${t.nameRight}`).join(' | '));

check('the cloud line says the right thing in each state',
  measured.tiles[0].cloudSay.startsWith('Backed up') && measured.tiles[1].cloudSay === 'Not backed up'
  && measured.tiles[2].cloudSay.startsWith('Backing up') && /full/.test(measured.tiles[3].cloudSay),
  measured.tiles.map((t) => t.cloudSay).join(' | '));
check('a backup reads verdigris and a refusal reads ruby',
  measured.tiles[0].cloudColor === VERDIGRIS && measured.tiles[3].cloudColor === RUBY,
  `${measured.tiles[0].cloudColor} / ${measured.tiles[3].cloudColor}`);
check('NO ACCOUNT, NO CLOUD LINE - a player who has not asked for one is not nagged', !measured.bare.cloud);
// AUDIT-312 F1/F2: the delete's door, and the wait that had none.
check('a backed-up slot offers BOTH cloud buttons, and both fit on the tile',
  measured.tiles[0].cloudButtons.join('/') === 'Back up again/Delete backup'
  && measured.tiles[0].cloudLastRight <= measured.tiles[0].cloudRight,
  `${measured.tiles[0].cloudButtons.join('/')} | last ends ${measured.tiles[0].cloudLastRight} of ${measured.tiles[0].cloudRight}`);
check('a card from before CHARID1 says so and offers NO button',
  /Load this save once/.test(measured.tiles[4].cloudSay ?? '') && measured.tiles[4].cloudButtons.length === 0,
  `${measured.tiles[4].cloudSay} | ${measured.tiles[4].cloudButtons.length} buttons`);
check('...and it reads QUIET - a wait is not a failure', measured.tiles[4].cloudColor === DIM,
  measured.tiles[4].cloudColor);

// ── ACC2c: THE CLOUD-ONLY GROUP ─────────────────────────────────────
const only = measured.only;
check('ACC2c: the group heading is in the DISPLAY face, not the pixel one',
  /Cormorant/i.test(only.headFace), only.headFace);
check('ACC2c: a cloud-only tile says WHERE the save is, not that it is safe',
  only.say === 'Only in your backup · 3 days ago', String(only.say));
check('ACC2c: ...and it is BRASS, a different colour from the verdigris a backed-up LOCAL save wears',
  only.sayColor === BRASS && only.sayColor !== VERDIGRIS, `${only.sayColor} (brass ${BRASS}, verdigris ${VERDIGRIS})`);
check('ACC2c: what the card does not carry is not drawn - no sub-line, no stats',
  !only.sub && !only.stats, `sub:${only.sub} stats:${only.stats}`);
check('ACC2c: the well falls back to the initial and keeps its size, so the tile is not a collapsed strip',
  only.initial && only.wellW === 96 && only.tiles.every((t) => t.h > 140),
  `initial:${only.initial} well:${only.wellW} ${only.tiles.map((t) => `${t.w}x${t.h}`).join(' ')}`);
check('ACC2c: Download sits where Load sits, and Delete backup on the cloud line',
  only.buttons.every((b) => b === 'Delete backup/Download'), only.buttons.join(' | '));
check('ACC2c: nothing leaves a cloud-only tile, long slot name and all', !only.overflow);
check('ACC2c: the group is ruled off from the pane\'s own tiles', only.ruled === '1px', only.ruled);

await page.evaluate(() => { document.body.style.background = '#0e1013'; });
await page.screenshot({ path: `${shots}/tile-desktop.png`, fullPage: true });

await page.setViewportSize({ width: 390, height: 1600 });
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const phone = await page.evaluate(() => {
  const t = document.querySelector('.svtile');
  const box = (el) => el.getBoundingClientRect();
  return {
    overflow: [...document.querySelectorAll('.svtile')].some((tile) => [...tile.querySelectorAll('*')].some((n) => box(n).right > box(tile).right + 1)),
    docWider: document.documentElement.scrollWidth > window.innerWidth + 1,
    faceStillBeside: t ? box(t.querySelector('.svface')).right <= box(t.querySelector('.svwho')).left + 1 : false,
  };
});
check('nothing overflows at phone width', !phone.overflow);
check('the page itself does not scroll sideways on a phone', !phone.docWider);
check('the face stays BESIDE the text on a phone rather than stacking', phone.faceStillBeside);
await page.screenshot({ path: `${shots}/tile-phone.png`, fullPage: true });

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
console.log(`sheets: ${shots}/tile-desktop.png, ${shots}/tile-phone.png`);
console.log('NOTE: the portraits are STAND-INS at a head record\'s real size - this container has no arena2.');
process.exit(bad.length ? 1 : 0);
