// AUDIT WATCH-KIT (2026-10-01, Mac: "Just want to audit this to make sure it's perfection") - the audit of COMPANION-KIT
// (PR #502: my companions' detailed bars, their party-panel cards and their packs), lenses U and P:
//
//   U - the cards and the bars on real Chromium: what a heal and a blow say on his card, through a window and a door;
//       a screen reader's tree; contrast over snow and on the plate; the phone held sideways; the icons' fit.
//   P - the packs and the presses: realm customs and the account service's first save, the tap's lock indoors and
//       underground, how far his pack opens from.
//
// Every finding was re-run before it was fixed and is pinned here by a test that FAILS on the code as it stood, for the
// finding's reason - the real modules driven headless (the party panel and the bars over a fake document, the sea's
// real host for the save, the shipped tap arms cut out of the shipped source and run, audit62_touch's own method); the
// sheets' facts read off the real style text, as the party's other pins read it. Each fix carries an `AUDIT WK-` comment.
// Mutation-proven: tools/mutants/auditwatchkit_ui.json - one mutant a fix putting the defect back, more on the new code,
// and THE SAFETY NET (lens D's fresh mutants on these files, each an untested behaviour of COMPANION-KIT's, pinned at
// the foot of this file).
//
// The four hosts (WK-P2): the street's tap arm (world.js) passed my companion by already; a building's and the world's
// dungeon's (worldModes.js) now do; exterior.js and the standalone dungeon.js stand no companions (the layer is world.js's
// alone, pinned below), and dungeonContext.js has no tap arm of its own. WK-P6 is the shared arm every host calls.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { createPartyPanel, companionKey, PARTY_CSS } from '../../src/ui/partyPanel.js';
import * as NH from '../../src/ui/naval/navalHud.js';   // a namespace: a new export reads undefined on the code as it stood, never a link error
import { fitIcon } from '../../src/ui/iconFit.js';
import { partyFxAbbrev } from '../../src/net/partyBuffs.js';
import { SocialState } from '../../src/net/social.js';
import { liquidWealthOf, liquidWorthOf, stashedItemLists, customsAllowance } from '../../src/net/realm/realmGoldLaw.js';
import { applyCustoms } from '../../src/systems/realmCustoms.js';
import { firstSaveRefusal } from '../../server-account/src/realm.js';
import { NAVAL_SAVE_VENDOR } from '../../src/scenes/naval/navalHost.js';
import { COME_SAIL_AWAY_VENDOR } from '../../src/systems/comeSailAway/comeSailAway.js';
import { goldStack, letterOfCredit } from '../../src/systems/inventory.js';
import { setItemFields } from '../../src/systems/item/itemTemplates.js';
import { HULL } from '../../src/systems/naval/navalShips.js';
import { pickFoe, RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE, TOO_FAR_AWAY_TEXT } from '../../src/player/activate.js';
import { LOCK_PICK_DISTANCE, createLockOn } from '../../src/player/lockOn.js';
import { activateMobileEnemy, tryMobileEnemyActivate, youSeeEnemyText } from '../../src/player/mobileEnemyActivate.js';
import { enemyDisplayName } from '../../src/characters/enemy/enemyBasics.js';
import { sea } from '../navalSea.mjs';

const { drawCrewBars, destroyNavalHud, NAVAL_HUD_CSS, MATE_BAR_W } = NH;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// ── a fake document (test/systems/companionkit.test.js's shape, with classList - ui/textureCanvas.js showFitted marks a picture) ─

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, id: '', attrs: {}, listeners: new Map(), src: '', alt: '',
    append(...cs) { for (const c of cs) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { for (const c of n.children) c.parent = null; n.children = []; for (const c of cs) { c.parent = n; n.children.push(c); } },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return n.attrs[k] ?? null; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    fire(t) { for (const fn of n.listeners.get(t) ?? []) fn(); },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
  };
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); doc.writes++; } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); doc.writes++; } });
  const classes = () => cls.split(/\s+/).filter(Boolean);
  n.classList = {
    contains: (c) => classes().includes(c),
    add: (...cs) => { n.className = [...new Set([...classes(), ...cs])].join(' '); },
    toggle: (c, on) => {
      const has = classes().includes(c), want = on === undefined ? !has : !!on;
      if (want !== has) n.className = (want ? [...classes(), c] : classes().filter((x) => x !== c)).join(' ');
      return want;
    },
  };
  n.style = new Proxy({}, { set(t, k, v) { t[k] = v; doc.writes++; return true; } });
  if (n.tagName === 'CANVAS') n.getContext = () => null;
  return n;
}
function fakeDocument() {
  const doc = { writes: 0 };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc); doc.documentElement = doc.body;
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };

// ── the style text, read (test/ui/plusdress1.test.js's reader) and measured (WCAG 2's relative luminance) ──────────────

/** A sheet as rules: each rule's selectors (trimmed) and its body. Comments out first; a rule inside @media is read
 *  as itself, and a keyframe's stops as rules of their own. */
const rules = (css) => [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => ({ sels: m[1].split(',').map((s) => s.trim()), body: m[2] }));
/** Every declaration the sheet writes for `sel` exactly, in order (later wins). */
const declsOf = (css, sel) => {
  const out = {};
  for (const r of rules(css)) {
    if (!r.sels.includes(sel)) continue;
    for (const d of r.body.split(';')) { const i = d.indexOf(':'); if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim(); }
  }
  return out;
};
/** A colour the sheet writes - `#rrggbb`, or a token's fallback (`var(--bone, #e9e4d9)`). */
const rgbOf = (v) => { const h = /#([0-9a-f]{6})/i.exec(String(v))?.[1]; assert.ok(h, `a colour: ${v}`); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** `ink` drawn at `alpha` over `ground`, as the compositor lays it. */
const over = (ink, ground, alpha) => ink.map((v, i) => v * alpha + ground[i] * (1 - alpha));

// ── the party panel's rig: my companions (world.js partyCompanions' shape - key, name, role, h, hm, fx) ────────────

const HILDA = Object.freeze({ key: '42:Hilda', name: 'Hilda', role: 'Bosun', h: 20, hm: 60, fx: [] });
const OLAF = Object.freeze({ key: '42:Olaf', name: 'Olaf', role: 'Cook', h: 60, hm: 60, fx: [] });
const member = (n, over = {}) => ({ acct: `acct-${n}`, name: n, online: true, seen: 1e12, peers: [`peer-${n}`], p: null, ...over });
const stateFrame = (party) => ({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac', friends: [], in: [], out: [], party, invites: [] });

/** The panel over my companions - offline (no `social`) unless a party is given. */
function rig(first, { party = null, here = null, touch = false } = {}) {
  const doc = fakeDocument();
  let social = null;
  if (party) {
    social = new SocialState({ now: () => 1e12 });
    social.apply(stateFrame({ id: 'q-party-1', leader: 'acct-me', members: [member('me', { acct: 'acct-me', name: 'Mac' }), ...party.map((n) => member(n))] }));
  }
  let now = first;
  const panel = createPartyPanel({ social, doc, faceLoader: async () => null, fxIcon: () => null, touch, here, companions: () => now });
  const card = (key = HILDA.key) => panel.cardFor(`companion:${key}`);
  return {
    doc, social, panel, root: panel.root, card,
    set: (list) => { now = list; },
    heals: () => find(panel.root, 'dfparty-heal').map((n) => n.textContent),
    fill: (key) => card(key).vitals[0].fill.className,
    /** The animations end: the flare's class comes off (its own animationend), the floats go. */
    end() {
      for (const n of find(panel.root, 'dfparty-heal')) n.remove();
      for (const n of find(panel.root, 'dfparty-fill')) n.fire('animationend');
    },
  };
}

// ── U: the cards ────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-U1 (major): a window closing repaints my companion\'s card - B8 made a covered card forget what it saw, and offline nothing repaints a companion\'s card until its words move: after the spellbook a heal is cast from (his pack, the pause) the heal floated no "+N" - the visible proof of "gain the players healing spells" - and the next blow did not flare; what changed UNDER the window is still no heal (mutants: the cover lifted without a repaint; the "+N" dropped; the flare dropped)', () => {
  const r = rig([HILDA]);
  r.panel.render({});
  r.set([{ ...HILDA, h: 40 }]); r.panel.render({});
  assert.deepEqual(r.heals(), ['+20'], 'with no window: a heal floats');
  r.set([{ ...HILDA, h: 25 }]); r.panel.render({});
  assert.match(r.fill(), /^dfparty-fill hit2?$/, 'and a blow flares');
  r.end();
  // the spellbook over the HUD, closed with nothing on her card moved - then the readied heal lands: 25 -> 45
  r.panel.render({ covered: true });
  r.panel.render({});
  r.panel.render({});
  r.set([{ ...HILDA, h: 45 }]); r.panel.render({});
  assert.deepEqual(r.heals(), ['+20'], 'the heal after a window floats');
  r.end();
  // his pack opened and closed - then a foe's blow: 45 -> 30
  r.panel.render({ covered: true }); r.panel.render({});
  r.set([{ ...HILDA, h: 30 }]); r.panel.render({});
  assert.match(r.fill(), /^dfparty-fill hit2?$/, 'the blow after a window flares');
  r.end();
  // B8 still: a rest that ended under the window is no heal the frame it closes
  r.panel.render({ covered: true });
  r.set([{ ...HILDA, h: 60 }]); r.panel.render({ covered: true });
  r.panel.render({});
  assert.deepEqual(r.heals(), [], 'what the window hid is no heal');
  assert.equal(r.fill(), 'dfparty-fill');
  r.set([{ ...HILDA, h: 50 }]); r.panel.render({});
  assert.match(r.fill(), /^dfparty-fill hit2?$/, 'and the card measures from what it showed as the window closed');
  r.panel.destroy();
});

test('AUDIT WK-U2 (major, the panel\'s half): A NEW WHOLE IS A NEW MEASURE - a door stood him in a pool rolled afresh (his share kept), and a body just taken ashore stands in at world.js partyCompanions\' 100/100 till his own stands: the card flared where his whole fell and floated "+12" where it rose, with no blow and no heal; a blow and a heal at the whole he has still read (mutants: a new whole measured; the whole never kept; every change a baseline)', () => {
  const r = rig([{ ...HILDA, h: 38, hm: 94 }]);
  r.panel.render({});
  r.set([{ ...HILDA, h: 35, hm: 86 }]); r.panel.render({});   // a door: 38/94 -> 35/86
  assert.equal(r.fill(), 'dfparty-fill', 'no blow at the door');
  assert.deepEqual(r.heals(), []);
  r.set([{ ...HILDA, h: 43, hm: 105 }]); r.panel.render({});   // the next: 35/86 -> 43/105
  assert.deepEqual(r.heals(), [], 'no heal at the next');
  assert.equal(r.fill(), 'dfparty-fill');
  r.set([{ ...HILDA, h: 30, hm: 105 }]); r.panel.render({});
  assert.match(r.fill(), /^dfparty-fill hit2?$/, 'a blow at the whole he has flares');
  r.end();
  r.set([{ ...HILDA, h: 40, hm: 105 }]); r.panel.render({});
  assert.deepEqual(r.heals(), ['+10'], 'a heal at it floats');
  r.panel.destroy();
  // Take ashore: the stand-in for the frames his stand takes, then his own rolled whole, below and above it
  for (const whole of [86, 112]) {
    const t = rig([{ ...HILDA, h: 100, hm: 100 }]);
    t.panel.render({}); t.panel.render({});
    t.set([{ ...HILDA, h: whole, hm: whole }]); t.panel.render({});
    assert.equal(t.fill(), 'dfparty-fill', `his own whole ${whole} is no blow`);
    assert.deepEqual(t.heals(), [], `his own whole ${whole} is no heal`);
    t.panel.destroy();
  }
});

test('AUDIT WK-U4 (minor): a companion\'s role letter is his role WRITTEN - the name\'s bone, whole, 4.5:1 or better on the plate (it wore the dim face-hole mark at .45: 1.9:1) - and never a word to a screen reader ("B Hilda"); his role line is a member\'s place line, undimmed (.8 more over snow: 2.5:1) (mutants: the letter dimmed, the letter read, the role line dimmed)', () => {
  const r = rig([HILDA], { party: ['Bran'] });
  r.panel.render({});
  const mark = r.card().facemark;
  assert.equal(mark.textContent, 'B', 'his role\'s letter');
  assert.equal(mark.getAttribute('aria-hidden'), 'true', 'the plate\'s, read by nobody - his name says who he is');
  assert.equal(r.panel.cardFor('acct-Bran').facemark.getAttribute('aria-hidden'), 'true', 'a member\'s plate mark (her face on its way) no more a word than his');
  // the letter as the cascade lays it, over the plate's lighter stop (the darker is darker still)
  const base = declsOf(PARTY_CSS, '.dfparty-facemark'), mate = declsOf(PARTY_CSS, '.dfparty-card.mate .dfparty-facemark');
  const look = { ...base, ...mate };
  const stops = [...(declsOf(PARTY_CSS, '.dfparty-face').background ?? '').matchAll(/#[0-9a-f]{6}/gi)].map((m) => rgbOf(m[0]));
  assert.equal(stops.length, 2, 'the plate\'s gradient');
  for (const plate of stops) {
    const c = contrast(over(rgbOf(look.color), plate, Number(look.opacity ?? 1)), plate);
    assert.ok(c >= 4.5, `his letter on the plate: ${c.toFixed(2)}:1`);
  }
  assert.equal(Number(base.opacity), 0.45, 'a member\'s mark - a face still on its way - stays the dim hole it is');
  // the role line: no rule weighs a companion's line apart from a member's place line
  assert.equal(rules(PARTY_CSS).some((x) => x.sels.some((s) => /\.mate\b/.test(s) && /\.dfparty-where\b/.test(s))), false,
    'his role line is drawn as a member\'s place line');
  r.panel.destroy();
});

test('AUDIT WK-U6 (minor): MY COMPANIONS ARE NEVER THE FIRST CUT - under the height cap (a phone held sideways, a short window under the quest card) a full party cut them whole, every time (they stood last in the one list); they stand in a list of their own after the seats\' that the cap never shrinks, and the seats\' list shrinks and is cut at its own foot - the order kept, the heal\'s rise off the first seat not cut with it, an empty list no gap (mutants: my companions among the seats, the lists\' order turned, their list shrunk, the seats\' list uncut, the rise cut, an empty list\'s gap, their list never filled)', () => {
  const r = rig([HILDA, OLAF], { party: ['Bran', 'Cyl'], touch: true });
  r.panel.render({});
  const root = r.root;
  assert.deepEqual(root.children.map((c) => c.className), ['dfparty-title', 'dfparty-list', 'dfparty-mates'], 'the seats, then my companions - each a list');
  const [seats, mates] = [root.children[1], root.children[2]];
  assert.deepEqual(seats.children, [r.panel.cardFor('acct-Bran').node, r.panel.cardFor('acct-Cyl').node], 'the seats in the hub\'s order');
  assert.deepEqual(mates.children, [r.card(HILDA.key).node, r.card(OLAF.key).node], 'my companions in theirs');
  r.set([OLAF]); r.panel.render({});
  assert.deepEqual(mates.children, [r.card(OLAF.key).node], 'one sent back aboard: his card goes');
  // the sheet: the cap shrinks the seats, never my companions
  assert.equal(declsOf(PARTY_CSS, '.dfparty-mates').flex, 'none', 'my companions\' list is never shrunk');
  const seatList = declsOf(PARTY_CSS, '.dfparty-list');
  assert.equal(seatList['min-height'], '0', 'the seats\' list shrinks');
  assert.equal(seatList.overflow, 'hidden', 'and is cut at its own foot');
  // ...reaching up as far as a heal's "+N" rises off the first seat's card, and drawn back by as much
  const heal = declsOf(PARTY_CSS, '.dfparty-heal');
  const lift = Math.min(...[...PARTY_CSS.match(/@keyframes dfparty-heal \{[^\n]*/)[0].matchAll(/translateY\((-?\d+)px\)/g)].map((m) => Number(m[1])));
  const rise = -(parseFloat(heal.top) + lift);
  assert.ok(rise > 0, 'the float rises over its card');
  assert.ok(parseFloat(seatList['padding-top']) >= rise, `the seats' list reaches ${seatList['padding-top']} up for a ${rise}px rise`);
  assert.equal(parseFloat(seatList['margin-top']), -parseFloat(seatList['padding-top']), 'and stands where it stood');
  assert.ok(rules(PARTY_CSS).some((x) => x.sels.includes('.dfparty-list:empty') && x.sels.includes('.dfparty-mates:empty') && /display:\s*none/.test(x.body)),
    'an empty list (no party offline, no companion ashore) takes no gap');
  r.panel.destroy();
});

// ── U: the bars ─────────────────────────────────────────────────────────────────────────────────────────────────

const hildaBar = (fx, over = {}) => [{ x: 10, y: 10, share: 0.5, distance: 5, name: 'Hilda', hp: 30, hpMax: 60, fx, ...over }];
const FORTIFY = Object.freeze({ i: 3, r: 4, n: 'Fortify Strength' });
const CURSE = Object.freeze({ i: 9, r: 2, n: 'Witch Curse', d: 1 });

test('AUDIT WK-U8 (minor): THE FIT LAW over his bar (ui/iconFit.js) - each effect\'s icon fitted to its tile (MATE_FX_BOX: the icon\'s own 16px, the party card\'s tile) at the device pixels the bar is drawn at - the screen\'s times the HUD scale it rides - and drawn at the picture\'s own size, whole pixels or a smooth reduction; the bar squeezed the icon\'s 2x cut into 12px under pixelated (0.375 of it on a 1x screen: of 16 columns a few stood) (mutants: the scale unread, the dpr dropped, the picture unsized, the tile 12px, the <img> forced to a box, a new scale never refitted)', () => {
  destroyNavalHud();
  const doc = fakeDocument();
  const asked = [];
  // ui/enhanced/enhancedArt.js spellIconPicture's own shape, by the law's own numbers for a 16px icon
  const fitted = (i, { box, dpr }) => {
    asked.push([i, box, dpr]);
    const f = fitIcon(16, 16, { box, dpr });
    return { src: `data:image/png;base64,icon${i}@${dpr}`, w: f.cssW, h: f.cssH, smooth: f.smooth };
  };
  const img = () => find(doc.body, 'dfnaval-crew-fxe')[0]?.children[0] ?? null;
  drawCrewBars(hildaBar([FORTIFY]), { doc, scale: 1, fxPicture: fitted });
  assert.deepEqual(asked.at(-1), [3, 16, 1], 'fitted to its 16px tile at the screen\'s pixels');
  assert.equal(NH.MATE_FX_BOX, 16);
  assert.equal(img()?.tagName, 'IMG');
  assert.equal(img().src, 'data:image/png;base64,icon3@1');
  assert.deepEqual([img().style.width, img().style.height], ['16px', '16px'], 'drawn at the picture\'s own size');
  assert.ok(img().classList.contains('fit') && !img().classList.contains('smooth'), 'at the HUD\'s scale on a 1x screen the icon\'s own pixels, whole');
  drawCrewBars(hildaBar([FORTIFY]), { doc, scale: 0.5, fxPicture: fitted });
  assert.deepEqual(asked.at(-1), [3, 16, 0.5], 'the bar rides scale(0.5): its tiles are 8 device pixels');
  assert.equal(img().src, 'data:image/png;base64,icon3@0.5', 'a new scale is a new picture');
  assert.ok(img().classList.contains('smooth'), 'a reduction is smooth, never pixelated');
  drawCrewBars(hildaBar([FORTIFY]), { doc, scale: 2, fxPicture: fitted });
  assert.deepEqual(asked.at(-1), [3, 16, 2]);
  assert.ok(!img().classList.contains('smooth'), 'two whole device pixels a source pixel');
  // the sheet: the tile is the box, and the picture is never forced into one
  const tile = declsOf(NAVAL_HUD_CSS, '.dfnaval-crew-fxe');
  assert.deepEqual([tile.width, tile.height], ['16px', '16px'], 'the icon\'s own 16px');
  const pic = declsOf(NAVAL_HUD_CSS, '.dfnaval-crew-fxe > img');
  assert.equal(pic.width ?? null, null, 'no box forced on the picture - its own numbers size it');
  assert.equal(pic.height ?? null, null);
  assert.equal(pic['image-rendering'], 'pixelated', 'made at its device size, copied pixel for pixel');
  destroyNavalHud();
});

test('AUDIT WK-U9 (nit): a debuff on his bar is ringed in the party card\'s own red, 3:1 or better against a buff\'s black ring (WCAG 1.4.11) - #6b1d14 was 1.75:1, a debuff told from a buff by its hue alone (mutant: the dark ring back)', () => {
  const buff = rgbOf(declsOf(NAVAL_HUD_CSS, '.dfnaval-crew-fxe')['box-shadow']);
  const debuff = rgbOf(declsOf(NAVAL_HUD_CSS, '.dfnaval-crew-fxe.debuff')['box-shadow']);
  const c = contrast(buff, debuff);
  assert.ok(c >= 3, `the debuff's ring against the buff's: ${c.toFixed(2)}:1`);
  assert.deepEqual(debuff, rgbOf(declsOf(PARTY_CSS, '.dfparty-fxe.debuff')['box-shadow']), 'the card\'s red, one meaning on both');
});

// ── P: the packs and the presses ────────────────────────────────────────────────────────────────────────────────

test('AUDIT WK-P1 (major): realm customs and the account service\'s first save count my companions\' packs - each companion\'s `items` in the sea\'s record (navalHost.js getSaveData `party`) is a container like the hold beside it: a million gold in his pack crossed whole and passed the first-save gate, while the hold\'s million was capped. Driven through the REAL host and keyed by its NAVAL_SAVE_VENDOR - the law\'s own name for it pinned equal, the twin of the hold\'s (AUDIT REALM2 T2) (mutants: the packs unread, the vendor misspelt, the resting read as the party, a malformed party thrown on)', async () => {
  const h = await sea({ hull: HULL.SmallShip });
  // world.js's codec for the packs (COMPANION-KIT: "saved as the cargo's are")
  h.deps.packedItems = { serialize: (items) => (items ?? []).map((it) => ({ ...it })), deserialize: (records) => (records ?? []).map((it) => setItemFields({ ...it })) };
  h.boat.crewed = true;
  h.host.restoreSaveData({ v: 1, boats: { 42: { hull: 420, sail: 160, crew: 24, fire: 0, state: 'afloat', barrels: 4 } }, notoriety: {}, day: 1, raids: [] });
  h.run(0.2);
  h.runtime.sailing = false;
  const name = h.host.crewOf(h.boat).hands[0].name;
  assert.equal(h.host.companionPress(h.boat, name, 0), 'take');
  h.host.companionPack(`42:${name}`).items.push(goldStack(1_000_000), letterOfCredit(50_000));
  const save = () => ({ level: 1, goldPieces: 0, items: [], wagonItems: [], bankAccounts: [], houses: [], modData: { [NAVAL_SAVE_VENDOR]: JSON.parse(JSON.stringify(h.host.getSaveData())) } });
  const snap = save();
  const pack = snap.modData[NAVAL_SAVE_VENDOR].party.party[0].items;
  assert.ok(stashedItemLists(snap).includes(pack), 'his pack is a stash customs reads');
  assert.equal(liquidWealthOf(snap), 1_050_000);
  const r = applyCustoms(snap);
  assert.deepEqual([r.wealth, r.taken, liquidWealthOf(snap)], [1_050_000, 1_050_000 - customsAllowance(1), customsAllowance(1)], 'capped at the allowance');
  assert.deepEqual(pack.map(liquidWorthOf), [customsAllowance(1)], 'his coin went first, then his letter down to the allowance');
  // the service's first save: a customs character's, and one born online - and what customs let through passes
  const row = { origin_id: 'offline-1', summary: JSON.stringify({ level: 1 }) };
  assert.deepEqual(firstSaveRefusal(JSON.stringify(save()), row), { error: 'customs-allowance' });
  assert.deepEqual(firstSaveRefusal(JSON.stringify(save()), { origin_id: null }), { error: 'realm-birth' });
  assert.equal(firstSaveRefusal(JSON.stringify(snap), row), null);
  // the twin it is (AUDIT REALM2 T2): the hold's million, counted alike
  const hold = { level: 1, goldPieces: 0, items: [], wagonItems: [], bankAccounts: [], modData: { [COME_SAIL_AWAY_VENDOR]: { placedBoats: [{ UID: 42, Items: [goldStack(1_000_000)] }] } } };
  assert.equal(liquidWealthOf(hold), 1_000_000);
  // a resting hand carries no pack; a record that is no party measures as none, and the service reads any bytes
  assert.equal(liquidWealthOf({ modData: { [NAVAL_SAVE_VENDOR]: { party: { party: [], resting: [{ boat: 42, name, until: 9, items: [goldStack(5)] }] } } } }), 0);
  for (const party of [5, {}, 'x', null, [null, 7, { items: 5 }]]) {
    assert.equal(liquidWealthOf({ modData: { [NAVAL_SAVE_VENDOR]: { party: { party } } } }), 0, `party ${JSON.stringify(party)}`);
  }
});

test('AUDIT WK-P2 (major): a tap never locks onto my companion in any host - a building\'s and the world dungeon\'s tap arms pass him by as the street\'s does (COMPANION-KIT): indoors a finger\'s tap locked onto him, ate the press (no pack on a phone indoors) and turned the camera to him; a foe behind him still locks; the street\'s, a building\'s and the world dungeon\'s arms pinned by source; the companion layer is world.js\'s alone, so those three are every arm that can meet him (mutants: the building\'s filter dropped, the dungeon\'s dropped)', () => {
  const wm = rd('src/scenes/worldModes.js'), w = rd('src/scenes/world.js');
  // the shipped arms, cut out of the shipped source and run (audit62_touch's own method)
  const cut = (src, start) => { const i = src.indexOf(start); assert.ok(i >= 0, `the arm moved: ${start}`); const j = src.indexOf('\n    }\n', i); return src.slice(i, j + 6); };
  const arms = { building: cut(wm, 'if (host.activateDir?.() && interiorCtx) {'), dungeon: cut(wm, 'if (host.activateDir?.() && dungeonCtx) {') };
  const hilda = { companion: '42:Hilda', shipmate: true, dead: false, mobileType: 144, ai: { feet: [0, 0, 2], height: 1.8 }, entity: { name: 'Hilda', isClass: true, team: 'PlayerAlly' } };
  const rat = { dead: false, mobileType: 0, ai: { feet: [0, 0, 6], height: 1.8 }, entity: { name: 'Rat' } };
  const tap = (arm, pool) => {
    const lock = createLockOn();
    const host = { activateDir: () => [0, -0.2, 1], lockToggle: (f) => lock.toggle(f), activateLockOnly: () => false };
    const collider = { raycast: () => Infinity };
    const out = new Function('host', 'pickFoe', 'LOCK_PICK_DISTANCE', 'eye', 'dir', 'interiorFoePool', 'interiorCtx', 'dungeonCtx', `${arm}\n return 'fell through';`)(
      host, pickFoe, LOCK_PICK_DISTANCE, [0, 1.6, 0], [0, -0.2, 1], () => pool, { collider }, { foes: pool, collider });
    return { out, locked: lock.target?.entity?.name ?? null };
  };
  for (const [where, arm] of Object.entries(arms)) {
    assert.deepEqual(tap(arm, [hilda]), { out: 'fell through', locked: null }, `${where}: a tap on him locks nothing - the ladder below opens his pack`);
    assert.deepEqual(tap(arm, [hilda, rat]), { out: true, locked: 'Rat' }, `${where}: the rat behind him locks`);
    assert.deepEqual(tap(arm, [rat]), { out: true, locked: 'Rat' }, `${where}: a foe alone, as ever`);
  }
  // the three arms by source
  assert.match(w, /pickFoe\(cam\.pos, useFwd, \[\.\.\.exteriorFoes\.foes, \.\.\.cityGuards\.guards\]\.filter\(\(f\) => f\.companion == null\), collider, LOCK_PICK_DISTANCE\)/, 'the street (COMPANION-KIT)');
  assert.match(wm, /pickFoe\(eye, dir, interiorFoePool\(\)\.filter\(\(f\) => f\.companion == null\), interiorCtx\.collider, LOCK_PICK_DISTANCE\)/, 'a building');
  assert.match(wm, /pickFoe\(eye, dir, dungeonCtx\.foes\.filter\(\(f\) => f\.companion == null\), dungeonCtx\.collider, LOCK_PICK_DISTANCE\)/, 'the world\'s dungeon');
  // the four hosts: the layer stands companions from world.js alone - exterior.js and dungeon.js stand none
  const standers = readdirSync(new URL('../../src/scenes/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js') && f.split(/[\\/]/).pop() !== 'crewAshore.js' && rd(`src/scenes/${f}`).includes('createCrewAshore('));
  assert.deepEqual(standers, ['world.js'], 'a host that stands companions is a host whose tap arm must pass them by');
});

test('AUDIT WK-P6 (minor): his pack is storage, reached as storage is - opened within TREASURE_ACTIVATION_DISTANCE and, past it, "You are too far away..." on the HUD\'s centre line, the press spent (the arm runs at the ray\'s 76.8 m and the pack opened from across a square); Steal stays the shipmate\'s silent break; a pack that will not open falls to DFU\'s own line, never a press eaten silent (mutants: the reach unbounded, the refusal unsaid, the refusal not consumed, the boundary refused; LD-MEA-failed-open-consumed)', () => {
  const hilda = (z) => ({ companion: '42:Hilda', shipmate: true, dead: false, mobileType: 144, ai: { feet: [0, 0, z], height: 1.8 }, entity: { name: 'Hilda', isClass: true, team: 'PlayerAlly' } });
  const press = (foe, { mode = 'grab', opens = true } = {}) => {
    const out = { opened: 0, mid: [], hud: [] };
    // the hosts' one call (world.js, worldModes.js): at the ray's reach, decided against the ladder's winner
    out.took = tryMobileEnemyActivate([0, 1.6, 0], [0, 0, 1], [foe], { raycast: () => Infinity }, RAY_DISTANCE, mode, {}, {
      nearerThan: Infinity, openCompanion: () => { out.opened++; return opens; }, midScreen: (t) => out.mid.push(t), hud: (t) => out.hud.push(t),
    });
    return out;
  };
  assert.deepEqual(press(hilda(2)), { opened: 1, mid: [], hud: [], took: true }, 'at arm\'s length: his pack');
  for (const z of [10, 39, 70]) {
    assert.deepEqual(press(hilda(z)), { opened: 0, mid: [TOO_FAR_AWAY_TEXT], hud: [], took: true }, `${z} m off: too far, and the press spent`);
    assert.deepEqual(press(hilda(z), { mode: 'info' }), { opened: 0, mid: [TOO_FAR_AWAY_TEXT], hud: [], took: true }, `${z} m off, in Info too`);
    assert.deepEqual(press(hilda(z), { mode: 'steal' }), { opened: 0, mid: [], hud: [], took: true }, `${z} m off, Steal: the shipmate's silent break`);
  }
  // the boundary is storage's: the reach itself opens, past it refuses
  const at = (d) => { const out = { opened: 0, mid: [] }; activateMobileEnemy(hilda(2), d, 'talk', {}, { openCompanion: () => { out.opened++; return true; }, midScreen: (t) => out.mid.push(t) }); return out; };
  assert.deepEqual(at(TREASURE_ACTIVATION_DISTANCE), { opened: 1, mid: [] });
  assert.deepEqual(at(TREASURE_ACTIVATION_DISTANCE + 0.01), { opened: 0, mid: [TOO_FAR_AWAY_TEXT] });
  // LD-MEA-failed-open-consumed: a pack that will not open (a window already up, the door not ready) is DFU's line
  assert.deepEqual(press(hilda(2), { opens: false }), { opened: 1, mid: [], hud: [youSeeEnemyText(enemyDisplayName(144))], took: true });
});

// ── THE SAFETY NET: lens D's fresh mutants on these files, each a behaviour of COMPANION-KIT's no suite held ─────────

test('AUDIT WK THE SAFETY NET, the cards: offline the title counts no seats; his line is his role whatever my place does; online his card repaints when he alone moved; an effect alone moves his key and his row; the crew\'s hairlines are never drawn on his card (mutants: LD-PP-seats-offline, LD-PP-role-as-place, LD-PP-online-never-repainted, LD-PP-key-without-fx, LD-PP-mate-thin-shown)', () => {
  const off = rig([HILDA]);
  off.panel.render({});
  assert.equal(find(off.root, 'dfparty-count')[0].textContent, '', 'no party: no "1/8"');
  off.set([{ ...HILDA, fx: [FORTIFY] }]); off.panel.render({});
  assert.notEqual(companionKey(HILDA), companionKey({ ...HILDA, fx: [FORTIFY] }));
  assert.equal(find(off.card().fx, 'dfparty-fxe').length, 1, 'a buff alone repaints his card');
  off.panel.destroy();
  let here = { px: 1, py: 1, in: 0 };
  const on = rig([HILDA], { party: ['Bran'], here: () => here });
  on.panel.render({});
  assert.equal(find(on.root, 'dfparty-count')[0].textContent, '2/8');
  on.set([{ ...HILDA, h: 50 }]); on.panel.render({});
  assert.equal(on.card().vitals[0].fill.style.width, '83%', 'online, repainted with the party\'s version still');
  here = { px: 9, py: 9, in: 1 }; on.panel.render({});   // I walk into a dungeon: the members' lines are read again
  assert.deepEqual([on.card().where.className, on.card().where.textContent], ['dfparty-where', 'Bosun'], 'his role stands');
  on.panel.destroy();
  assert.equal(declsOf(PARTY_CSS, '.dfparty-card.mate .dfparty-thin').display, 'none', 'the crew carry no stamina or magicka');
});

test('AUDIT WK THE SAFETY NET, the bar: a picture landing after its letters takes their place; a debuff\'s tile is marked; his bar is the wider one (mutants: LD-NH-art-landing-ignored, LD-NH-debuff-unmarked, LD-NH-mate-bar-narrow)', () => {
  destroyNavalHud();
  const doc = fakeDocument();
  let landed = false;
  const icon = (i) => (landed ? { src: `data:image/png;base64,icon${i}`, w: 16, h: 16, smooth: false } : null);
  const tiles = () => find(doc.body, 'dfnaval-crew-fxe');
  drawCrewBars(hildaBar([FORTIFY, CURSE]), { doc, fxPicture: icon });
  assert.deepEqual(tiles().map((t) => [t.textContent, t.children.length]), [[partyFxAbbrev(FORTIFY.n), 0], [partyFxAbbrev(CURSE.n), 0]], 'the letters while the sheet loads');
  assert.deepEqual(tiles().map((t) => t.className), ['dfnaval-crew-fxe', 'dfnaval-crew-fxe debuff'], 'a debuff marked');
  landed = true;
  drawCrewBars(hildaBar([FORTIFY, CURSE]), { doc, fxPicture: icon });
  assert.deepEqual(tiles().map((t) => t.children[0]?.src), ['data:image/png;base64,icon3', 'data:image/png;base64,icon9'], 'the icons the frame they land');
  destroyNavalHud();
  assert.equal(declsOf(NAVAL_HUD_CSS, '.dfnaval-crew.mate').width, `${MATE_BAR_W}px`, 'a companion\'s bar the wider one');
  assert.notEqual(declsOf(NAVAL_HUD_CSS, '.dfnaval-crew').width, `${MATE_BAR_W}px`, 'a deck hand\'s the narrow');
});
