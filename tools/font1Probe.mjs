// FONT1 (2026-09-16, Mac: "Enhanced mode UI. Especially the new online
// interfaces font use our enhanced font. Ambient Text mod also doesnt
// use it. Any enhanced UI or text must be our enhanced version"):
// THE ENHANCED FACE, MEASURED.
//
// A font swap is a LAYOUT change, and node has no layout engine - the
// whole suite drives a fake DOM whose boxes are whatever the fake says
// they are (tools/chatLayoutProbe.mjs makes the same argument about the
// chat list). Pixelify Sans is a pixel face on a 12px grid and it is
// WIDER than Barlow Semi Condensed, the launcher face these surfaces
// used to be set in, so every fixed-width box in the online UI had to
// be re-measured rather than re-read.
//
// What this measures, over the REAL sheets:
//   1. THE RATIO - how much wider the pixel face runs at one size, on
//      strings these panels actually draw. The number in the sheets'
//      headers (about 1.29x, measured) is this one.
//   2. NOTHING SPILLS - no row in the four online surfaces is wider
//      than the box that holds it (a name column 132px wide, a party
//      card 244px, the peer menu's 208px card).
//   3. THE FINGER KEEPS ITS 44px - AUDIT SOC C8's targets are a
//      platform rule, not a typographic one, so the face must not have
//      moved them.
//   4. THE POPUP COLUMN CLEARS THE COMPASS - ui/enhancedHudText.js
//      starts at HUD_TEXT_TOP_PX, and the compass strip and a named
//      target's bar stand above it. This measures their bottom edge.
//      AUDIT FONT added three claims to the same page: the column also
//      clears the CHAT'S PEEK where a chat is mounted (F7 - the two
//      shared this corner and .dfchat is z-index 5 over it, so the
//      panel is built here and its real bottom measured); TWO models'
//      columns STACK rather than overlap (F1 - townTalk's and
//      dungeonContext's are both alive on ?world in a dungeon); and a
//      TEXT.RSC-length line WRAPS whole rather than being ellipsised
//      (F8), which is also where the two-rows-a-peek-line number in
//      enhancedStyle's chat offset comes from.
//
// THE FONTS COME FROM THE GAME'S OWN REQUEST. ENHANCED_FONTS_URL is
// fetched here in node (the browser in this harness has no route to it)
// and every latin face in it is inlined into the page as a data URI, so
// what is measured is the face a player is served. Offline, the probe
// says so and exits 1 rather than measuring the fallback and calling it
// a pass - a measurement of monospace is not a measurement of Pixelify.
//
//     node tools/font1Probe.mjs
//
// (Needs network. NODE_USE_ENV_PROXY=1 / NODE_EXTRA_CA_CERTS where a
// proxy stands in front of fonts.googleapis.com.)
import { chromium } from 'playwright';
import { CHAT_CSS } from '../src/ui/chatPanel.js';
import { SOCIAL_CSS } from '../src/ui/socialPanel.js';
import { PARTY_CSS } from '../src/ui/partyPanel.js';
import { SOCIAL_MENU_CSS } from '../src/ui/socialMenu.js';
import { ENHANCED_CSS, ENHANCED_FONTS_URL, HUD_TEXT_TOP_PX, HUD_TEXT_ROW_PX, HUD_TEXT_TOP_CHAT_PX, HUD_TEXT_TOP_CHAT_TOUCH_PX } from '../src/ui/enhancedStyle.js';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** The game's one font request, with every latin face in it inlined. */
async function inlineFonts() {
  const css = await (await fetch(ENHANCED_FONTS_URL, { headers: { 'user-agent': UA } })).text();
  const out = [];
  for (const block of css.split('@font-face').slice(1)) {
    if (!/U\+0000-00FF/.test(block)) continue;            // the latin subset alone - these panels draw latin
    const fam = /font-family: '([^']+)'/.exec(block)?.[1];
    const weight = /font-weight: ([\d ]+)/.exec(block)?.[1] ?? '400';
    const url = /url\((https[^)]+)\)/.exec(block)?.[1];
    if (!fam || !url) continue;
    const bytes = Buffer.from(await (await fetch(url, { headers: { 'user-agent': UA } })).arrayBuffer());
    out.push(`@font-face { font-family: '${fam}'; font-weight: ${weight}; src: url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2'); }`);
  }
  return out.join('\n');
}

/** 1. The ratio, on strings these surfaces draw. */
const MEASURE_RATIO = () => {
  const samples = [
    [10, 'already in a party'], [11, 'last seen 5 days ago'], [12, 'ONLINE PLAYERS'],
    [13, 'Mac the Wanderer'], [14, 'Your Long Blade skill has improved.'], [15, 'Invite to party'],
  ];
  const w = (fam, size, text) => {
    const s = document.createElement('span');
    s.style.cssText = `position:absolute;white-space:pre;font-family:${fam};font-size:${size}px`;
    s.textContent = text;
    document.body.append(s);
    const r = s.getBoundingClientRect().width;
    s.remove();
    return r;
  };
  return samples.map(([size, text]) => {
    const barlow = w("'Barlow Semi Condensed'", size, text);
    const pixel = w("'Pixelify Sans'", size, text);
    return { size, text, barlow: +barlow.toFixed(1), pixel: +pixel.toFixed(1), ratio: +(pixel / barlow).toFixed(3) };
  });
};

/** 2 + 3. The four online surfaces, built as their modules build them. */
const MEASURE_SURFACES = (touch) => {
  document.body.innerHTML = '';
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  // NAME_MAX (net/wire.js) is 24 - the longest name the hub will ever
  // hand these rows, and so the one that decides whether a column
  // clips. The probe draws it rather than a comfortable one.
  const NAME = 'Maximilian Wanderer XIV';
  // the chat, open, with a roster column
  const chat = el('div', `dfchat${touch ? ' touch' : ''}`);
  chat.dataset.state = 'open';
  const peek = el('div', 'dfchat-peek');
  for (let i = 0; i < 3; i++) {
    const line = el('div', 'dfchat-line');
    line.append(el('span', 'dfchat-time', '12:34'), el('span', 'dfchat-name', NAME),
      el('span', 'dfchat-tag', '#ab12'), el('span', 'dfchat-text', 'the road to Daggerfall is 5 days from here'));
    peek.append(line);
  }
  const box = el('div', 'dfchat-box');
  const tabs = el('div', 'dfchat-tabs');
  tabs.append(el('button', 'dfchat-tab active', 'World'), el('button', 'dfchat-social dfchat-social-tab', '☻'));
  const cols = el('div', 'dfchat-cols');
  const main = el('div', 'dfchat-main');
  const list = el('div', 'dfchat-list');
  list.append(...peek.cloneNode(true).children);
  const form = el('div', 'dfchat-form');
  form.append(el('input', 'dfchat-input'), el('button', 'dfchat-send', 'Send'));
  main.append(list, form);
  const who = el('div', 'dfchat-who');
  const wholist = el('div', 'dfchat-wholist');
  const row = el('div', 'dfchat-who-row act');
  row.append(el('span', 'dfchat-who-name', NAME), el('span', 'dfchat-who-tag', '#ab12'));
  const menu = el('div', 'dfchat-rowmenu');
  const rowbtn = el('button', 'dfchat-rowbtn');
  rowbtn.append(el('span', null, 'Invite to party'), el('span', 'dfchat-rowwhy', 'already in a party'));
  menu.append(rowbtn);
  row.append(menu);
  wholist.append(row);
  who.append(el('div', 'dfchat-whohead', 'Online'), wholist);
  cols.append(main, who);
  box.append(tabs, cols);
  chat.append(peek, box);
  document.body.append(chat);

  // the friends + party panel
  const social = el('div', `dfsocial${touch ? ' touch' : ''}`);
  social.dataset.open = '1';
  const head = el('div', 'dfsocial-head');
  head.append(el('div', 'dfsocial-title', 'Friends & party'), el('button', 'dfsocial-close', 'Close'));
  const body = el('div', 'dfsocial-body');
  const srow = el('div', 'dfsocial-row');
  const swho = el('div', 'dfsocial-who');
  swho.append(el('div', 'dfsocial-name', NAME), el('div', 'dfsocial-sub', 'last seen 5 days ago'));
  const sbtn = el('button', 'dfsocial-btn', 'Invite');
  srow.append(el('i', 'dfsocial-dot on'), swho, el('span', 'dfsocial-left', '1:58 left'), sbtn);
  body.append(el('div', 'dfsocial-sec', 'Friends'), srow);
  const stabs = el('div', 'dfsocial-tabs');
  stabs.append(el('button', 'dfsocial-tab active', 'Friends'), el('button', 'dfsocial-tab', 'Party'));
  social.append(head, stabs, body);
  document.body.append(social);

  // the party HUD
  const party = el('div', `dfparty${touch ? ' touch' : ''}`);
  const card = el('div', 'dfparty-card');
  const pbody = el('div', 'dfparty-body');
  const phead = el('div', 'dfparty-head');
  phead.append(el('span', 'dfparty-name', NAME), el('span', 'dfparty-lead', '★'));
  const vital = el('div', 'dfparty-vital health');
  vital.append(el('div', 'dfparty-track'), el('span', 'dfparty-num', '100 / 100'));
  pbody.append(phead, el('div', 'dfparty-where', 'Daggerfall, Privateer\'s Hold'), vital);
  card.append(el('div', 'dfparty-face'), pbody);
  party.append(el('div', 'dfparty-title', 'Party'), card);
  document.body.append(party);

  // the F-menu over a body
  const peer = el('div', 'dfpeer');
  peer.dataset.state = 'open';
  const pcard = el('div', 'dfpeer-card');
  const pbtn = el('button', 'dfpeer-btn');
  pbtn.append(el('span', null, 'Invite to party'), el('span', 'dfpeer-why', 'already in a party'));
  pcard.append(el('div', 'dfpeer-name', NAME), pbtn, el('button', 'dfpeer-btn cancel', 'Close'));
  peer.append(pcard);
  document.body.append(peer);

  // Does any text run wider than the box that holds it? scrollWidth is
  // the content's own width; a row whose content is wider than its
  // client box is a row a player reads the start of.
  // A box that declares `text-overflow: ellipsis` CLIPS BY DESIGN - a
  // name column has to end somewhere - so it is measured below rather
  // than counted a spill. Everything else is a row a player would read
  // the start of.
  const spills = [];
  for (const n of document.querySelectorAll('div, span, button')) {
    if (!n.className || typeof n.className !== 'string') continue;
    if (getComputedStyle(n).textOverflow === 'ellipsis') continue;
    if (n.scrollWidth > n.clientWidth + 1 && n.clientWidth > 0) {
      spills.push({ cls: n.className, content: n.scrollWidth, box: n.clientWidth });
    }
  }
  // AUDIT SOC C8's targets, on the touch skin.
  const targets = ['dfchat-social', 'dfchat-rowbtn', 'dfsocial-tab', 'dfsocial-close', 'dfsocial-btn', 'dfpeer-btn']
    .map((cls) => {
      const n = document.querySelector('.' + cls.replace(/ /g, '.'));
      return n ? { cls, h: +n.getBoundingClientRect().height.toFixed(1) } : { cls, h: null };
    });
  // What the ellipsising columns have room to SAY. The party card's
  // name is the one that clips (the roster's wraps), so the question it
  // answers is HOW MANY CHARACTERS fit whole - measured by shortening
  // the name until it stops being cut. A 24-character name (NAME_MAX)
  // ending in an ellipsis is the ellipsis doing its job; an ordinary
  // one being cut is the face being too big for the card.
  const nameNode = document.querySelector('.dfparty-name');
  let fits = 0;
  for (let n = 1; n <= NAME.length; n++) {
    nameNode.textContent = NAME.slice(0, n);   // a real name's own letters, not the widest glyph repeated
    if (nameNode.scrollWidth <= nameNode.clientWidth + 1) fits = n;
  }
  nameNode.textContent = NAME;
  const clipped = {
    nameBox: +nameNode.clientWidth.toFixed(1),
    longest: +nameNode.scrollWidth.toFixed(1),
    fits,
    vitals: (() => { const n = document.querySelector('.dfparty-num'); n.textContent = '1000 / 1000'; return { box: +n.clientWidth.toFixed(1), content: +n.scrollWidth.toFixed(1) }; })(),
  };
  return { spills, targets, clipped };
};

/** 4. The popup column against the HUD furniture above it. */
const MEASURE_HUDTEXT = () => {
  document.body.innerHTML = '';
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const hud = el('div', 'hud');
  const top = el('div', 'hud-top');
  const compass = el('div', 'hud-compass');
  compass.append(el('div', 'hud-strip'), el('i', 'hud-needle'));
  const foe = el('div', 'hud-foe on');
  foe.append(el('div', 'hud-foename', 'Grizzly Bear'), el('div', 'hud-track hud-foetrack'));
  top.append(compass, foe);
  hud.append(top);
  document.body.append(hud);
  // AUDIT FONT F1: the column is a STACK (one per document, holding the
  // place and the scale) with one `.hudtext` per PopupText model inside
  // it - townTalk's and dungeonContext's both draw on ?world in a
  // dungeon. The probe builds both, so what is measured is what two
  // live models really produce.
  const stack = el('div', 'hudtext-stack');
  const column = el('div', 'hudtext');
  const rows = ['Your Long Blade skill has improved.', 'You found 25 gold pieces.'];
  for (const t of rows) column.append(el('div', 'hudtext-row', t));
  const second = el('div', 'hudtext');
  second.append(el('div', 'hudtext-row', 'The wind carries the smell of the sea.'));
  stack.append(column, second);
  document.body.append(stack);
  // AUDIT FONT F7: ...and the CHAT, which shares this corner. .dfchat is
  // fixed at top 44 (72 on the touch skin) with CHAT_PEEK lines under
  // it at z-index 5, so a column that starts at HUD_TEXT_TOP_PX draws
  // underneath the peek and neither is readable. The sheet steps the
  // column below the peek where the chat is MOUNTED, so the page must
  // hold one for the number to mean anything.
  const buildChat = (touch) => {
    const c = el('div', `dfchat${touch ? ' touch' : ''}`);
    c.dataset.state = 'closed';
    const pk = el('div', 'dfchat-peek');
    for (let i = 0; i < 5; i++) {
      const line = el('div', 'dfchat-line');
      line.append(el('span', 'dfchat-time', '12:34'), el('span', 'dfchat-name', 'Mac the Wanderer'),
        el('span', 'dfchat-tag', '#ab12'), el('span', 'dfchat-text', 'the road to Daggerfall is 5 days from here'));
      pk.append(line);
    }
    const open = el('button', 'dfchat-open', 'Chat');
    c.append(pk, el('div', 'dfchat-hint', 'Enter to chat'), el('div', 'dfchat-status'), open);
    document.body.append(c);
    return c;
  };
  const chatTouch = buildChat(true);
  const chatTouchBottom = +chatTouch.getBoundingClientRect().bottom.toFixed(1);
  chatTouch.remove();
  const chat = buildChat(false);
  const at = (slide) => {
    column.style.setProperty('--hudtext-slide', `${slide}px`);
    return column.getBoundingClientRect();
  };
  const rest = at(0);
  const row0 = column.children[0].getBoundingClientRect();
  const slid = at(-20);
  at(0);
  const chatBottom = +chat.getBoundingClientRect().bottom.toFixed(1);
  const stackBox = stack.getBoundingClientRect();
  const secondBox = second.getBoundingClientRect();
  // AUDIT FONT F8: a TEXT.RSC-length line is drawn whole, not cut.
  const longRow = column.children[0];
  const LONG = 'You have been given a letter of introduction to the Knights of the Dragon, and are expected at their hall in Daggerfall before the 15th of Hearthfire.';
  longRow.textContent = LONG;
  const longBox = { content: +longRow.scrollWidth.toFixed(1), box: +longRow.clientWidth.toFixed(1), h: +longRow.getBoundingClientRect().height.toFixed(1) };
  longRow.textContent = rows[0];
  // ...and the OTHER text surface: the mid-screen label, at DFU's own
  // 146-of-200 height, against the bottom block it must not sit on.
  const bottom = el('div', 'hud-bottom');
  const bars = el('div', 'hud-bars');
  for (const kind of ['magicka', 'health', 'fatigue']) {
    const v = el('div', `hud-vital hud-${kind}`);
    v.append(el('div', 'hud-track'));
    bars.append(v);
  }
  bottom.append(bars, el('div', 'hud-effects'));
  hud.append(bottom);
  const mid = el('div', 'hudmid', 'Interaction is now in talk mode.');
  document.body.append(mid);
  const fallbackBox = mid.getBoundingClientRect();
  // AUDIT FONT F11: ...at the number ui/enhancedHudText.js writes for
  // this viewport, which is the CLASSIC label's own line - the floored
  // native fit (Math.floor(min(w/320, h/200))) with the 320x200 panel
  // centred in what is left. The sheet's 73% is the fallback above.
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth / 320, window.innerHeight / 200)));
  const oy = Math.floor((window.innerHeight - 200 * s) / 2);
  mid.style.setProperty('--hudmid-top', `${oy + 146 * s}px`);
  const midBox = mid.getBoundingClientRect();
  return {
    midFallbackTop: +fallbackBox.top.toFixed(1),
    midTop: +midBox.top.toFixed(1),
    midBottom: +midBox.bottom.toFixed(1),
    barsTop: +bottom.getBoundingClientRect().top.toFixed(1),
    reticleBottom: +(window.innerHeight / 2 + 9).toFixed(1),
    topBlockBottom: +top.getBoundingClientRect().bottom.toFixed(1),
    columnTop: +rest.top.toFixed(1),
    columnWidth: +rest.width.toFixed(1),
    rowHeight: +row0.height.toFixed(1),
    slidBy: +(rest.top - slid.top).toFixed(1),
    centred: Math.abs((rest.left + rest.right) / 2 - window.innerWidth / 2) < 1,
    chatBottom,
    chatTouchBottom,
    stackTop: +stackBox.top.toFixed(1),
    secondTop: +secondBox.top.toFixed(1),
    columnBottom: +rest.bottom.toFixed(1),
    longRow: longBox,
  };
};

const faces = await inlineFonts().catch((e) => { console.error(`the fonts did not load: ${e.message}`); return null; });
if (!faces || !/Pixelify Sans/.test(faces)) {
  console.error('FAILED: no Pixelify Sans to measure - this probe needs the network (ENHANCED_FONTS_URL).');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.setContent('<!doctype html><html><head></head><body style="margin:0"></body></html>');
await page.addStyleTag({ content: faces });
await page.addStyleTag({ content: ENHANCED_CSS });
for (const css of [CHAT_CSS, SOCIAL_CSS, PARTY_CSS, SOCIAL_MENU_CSS]) await page.addStyleTag({ content: css });
await page.evaluate(async () => {
  for (const f of ['400 14px "Pixelify Sans"', '600 14px "Pixelify Sans"', '400 14px "Barlow Semi Condensed"'])
    await document.fonts.load(f);
  await document.fonts.ready;
});

const fails = [];
console.log('1. THE RATIO - the pixel face against the launcher face, at one size');
const ratios = await page.evaluate(MEASURE_RATIO);
for (const r of ratios) console.log(`   ${String(r.size).padStart(2)}px  ${String(r.pixel).padStart(6)} vs ${String(r.barlow).padStart(6)}  x${r.ratio}   ${r.text}`);
const mean = ratios.reduce((a, r) => a + r.ratio, 0) / ratios.length;
console.log(`   mean x${mean.toFixed(3)}`);
if (!(mean > 1.05)) fails.push(`the two faces measure the same (x${mean.toFixed(3)}) - the page is drawing a fallback, not Pixelify`);

for (const touch of [false, true]) {
  console.log(`\n2. THE FOUR SURFACES (${touch ? 'touch' : 'desktop'} skin) - nothing wider than its box`);
  const { spills, targets, clipped } = await page.evaluate(MEASURE_SURFACES, touch);
  for (const s of spills) console.log(`   SPILL ${s.cls}: ${s.content}px of text in a ${s.box}px box`);
  if (!spills.length) console.log('   (none)');
  for (const s of spills) fails.push(`${s.cls} spills: ${s.content}px of text in a ${s.box}px box`);
  console.log(`   the party card's name box is ${clipped.nameBox}px: ${clipped.fits} of a name's characters fit whole,`
    + ` and the longest name the hub allows (NAME_MAX 24) measures ${clipped.longest}px`);
  console.log(`   its vitals column holds "1000 / 1000" in ${clipped.vitals.content}px of a ${clipped.vitals.box}px box`);
  if (clipped.fits < 16) fails.push(`only ${clipped.fits} characters of a party member's name fit the card - the face is too big for it`);
  if (clipped.vitals.content > clipped.vitals.box + 1) fails.push(`the party vitals column cuts "1000 / 1000" (${clipped.vitals.content}px in ${clipped.vitals.box}px)`);
  if (touch) {
    console.log('3. THE FINGER (AUDIT SOC C8): every target at least 44px tall');
    for (const t of targets) {
      console.log(`   ${t.cls}: ${t.h}px`);
      if (t.h === null) fails.push(`${t.cls} was not built - the probe and the sheet disagree`);
      else if (t.h < 44) fails.push(`${t.cls} is ${t.h}px, under the 44px AUDIT SOC C8 pinned`);
    }
  }
}

console.log('\n4. THE POPUP COLUMN (FONT1) - under the compass, centred, sliding by a row');
const h = await page.evaluate(MEASURE_HUDTEXT);
console.log(`   the HUD's top block ends at ${h.topBlockBottom}px; the column starts at ${h.columnTop}px (HUD_TEXT_TOP_PX ${HUD_TEXT_TOP_PX})`);
console.log(`   a row is ${h.rowHeight}px (HUD_TEXT_ROW_PX ${HUD_TEXT_ROW_PX}); a -20px slide moves the column ${h.slidBy}px; centred: ${h.centred}`);
console.log(`   the mid-screen label (DFU's y=146 of 200) stands ${h.midTop}-${h.midBottom}px, under the reticle's ${h.reticleBottom}px and over the bars at ${h.barsTop}px`);
console.log(`   ...where the sheet's 73% fallback alone would have put it at ${h.midFallbackTop}px (AUDIT FONT F11: the two agree at 16:10 and nowhere else)`);
if (h.midTop < h.reticleBottom) fails.push(`the mid-screen label starts at ${h.midTop}px, on top of the reticle (${h.reticleBottom}px)`);
if (h.midBottom > h.barsTop) fails.push(`the mid-screen label ends at ${h.midBottom}px, inside the bars at ${h.barsTop}px`);
if (h.columnTop < h.topBlockBottom) fails.push(`the popup column starts at ${h.columnTop}px, inside the HUD's top block, which ends at ${h.topBlockBottom}px`);
if (Math.abs(h.rowHeight - HUD_TEXT_ROW_PX) > 0.5) fails.push(`a row measures ${h.rowHeight}px where the module slides by ${HUD_TEXT_ROW_PX}px`);
if (Math.abs(h.slidBy - 20) > 0.5) fails.push(`the slide moved the column ${h.slidBy}px, not 20`);
if (!h.centred) fails.push('the popup column is not centred on the screen, as PopupText\'s is on the panel');
console.log(`   the chat's peek ends at ${h.chatBottom}px (${h.chatTouchBottom}px on the touch skin) and the column starts at ${h.stackTop}px (AUDIT FONT F7: HUD_TEXT_TOP_CHAT_PX ${HUD_TEXT_TOP_CHAT_PX} / ${HUD_TEXT_TOP_CHAT_TOUCH_PX})`);
if (HUD_TEXT_TOP_CHAT_TOUCH_PX < h.chatTouchBottom) fails.push(`the touch skin's offset is ${HUD_TEXT_TOP_CHAT_TOUCH_PX}px where its chat ends at ${h.chatTouchBottom}px`);
console.log(`   the second model's column starts at ${h.secondTop}px, under the first's ${h.columnBottom}px (AUDIT FONT F1: two models stack, never overwrite)`);
console.log(`   a ${h.longRow.content}px line wraps into a ${h.longRow.box}px box ${h.longRow.h}px tall (AUDIT FONT F8)`);
if (h.stackTop < h.chatBottom) fails.push(`the popup column starts at ${h.stackTop}px, inside the chat peek which ends at ${h.chatBottom}px`);
if (h.secondTop < h.columnBottom - 0.5) fails.push(`the second model's column starts at ${h.secondTop}px, over the first's rows which end at ${h.columnBottom}px`);
if (h.longRow.content > h.longRow.box + 1) fails.push(`a TEXT.RSC-length line is ${h.longRow.content}px in a ${h.longRow.box}px box - it is being cut, not wrapped`);
if (h.longRow.h <= h.rowHeight + 0.5) fails.push('a long line did not wrap to a second row - the column is still one line high');

await browser.close();
if (fails.length) {
  console.error('\nFAILED:');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nPASS: the enhanced face is what these surfaces are set in, nothing spills, the finger keeps its 44px,');
console.log('and the popup column stands under the compass where PopupText\'s column stands under nothing.');
