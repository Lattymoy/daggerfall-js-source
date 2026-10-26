// COLLECTIONS-II (2026-10-22, the owner: "with the introduction of a lot of titles, auras, profile icons, etc I think its
// time we introduce these elements to the collections tab, along with telling how they are found, even if they arent
// currently able to be obtained"; bible/10-UI/Collections.md) and AUDIT COLLECTIONS-II (2026-10-22, the owner: "Audit
// this"; bible/01-Overview/audits/Audit-Collections-II.md): THE WARDROBE IN THE COLLECTIONS PAGE. The catalogue whole -
// every title, aura, icon and glyph of the vocabulary, its source and availability as a literal the record names, its
// words of how - and held to the service's own law (the lists and what they grant together, each roll's odds, each
// Redoubt, each board's floor, each questline's giver, the founders' instant, Season 0, a member's own fall, the cakes
// others take, a dealing claim's roll, the embers' three purses, the switches in its config); held, worn and counted off
// the wardrobe the service mints; a seat's glyph the character's; the seasons off the festival's dates; the page driven -
// its tiles and meters and counts, the account's line, the read once a menu visit and asked again when the card closes,
// the filters, a row opened whole, Wear through the flow without losing the keyboard, a "comes with" press; the kit's
// roles; the sheet on the page; the account card's note naming a title.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { TITLES, AURAS, ICONS, GLYPHS, SEAT_TITLES, CHAPTER_TITLES } from '../../src/net/identityToken.js';
import * as W from '../../src/ui/collections/wardrobeCatalogue.js';
import { setLocale, currentLocale, PSEUDO_LOCALE } from '../../src/systems/textManager.js';
import { drawWardrobePart, wardrobeFilterPasses, resetWardrobePart, WARDROBE_PART_CSS, WARDROBE_THEME_CSS, auraRingNode } from '../../src/ui/collections/wardrobePart.js';
import { drawCollectionsPage, resetCollectionsPage, setCollectionsPart, disarmCollectionsPage, rereadCollectionsAccount, partCount, collectionParts, WARDROBE_PARTS, COLLECTION_PAGE_STYLE_ID, COLLECTION_PAGE_CSS } from '../../src/ui/collectionsPage.js';
import { FRAME_ROLES } from '../../src/ui/enhanced/enhancedFrame.js';
import { INSIGNIA } from '../../src/net/insignia.js';
import { FESTIVALS, FESTIVAL_WARES, FESTIVAL_ICONS, HEARTHKEEPER_GIVEN, SOULCAKE_TAKEN } from '../../src/net/festivalLaw.js';
import { QL_SERVICE_LINES } from '../../src/net/questlineClaims.js';
import { QL_LINES } from '../../src/systems/questlines/qlLines.js';
import { ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES } from '../../src/net/arena/arenaLaw.js';
import { seasonTitles } from '../../src/net/townSeatLaw.js';
import { codexRows, codexSets, noteFind, _resetCodexForTests } from '../../src/systems/loot/lootCodex.js';
import { GILDED_RECORDS, DRAGONFIRE_OATH, mintGilded } from '../../src/systems/gilded.js';
import { STARTER_DECK, ILIAC_CARDS } from '../../src/net/iliac/iliacCards.js';
import { TIER_LISTS, TIER_GLYPH, TIER_AURA, DEVELOPER_AURA, HOURS_FIRST_AURA, FOUNDER_UNTIL, wardrobeOf } from '../../server-account/src/titles.js';
import { PATREON_TITLES } from '../../server-account/src/patreon.js';
import { SD_TITLE_CHANCE, SD_AURA_CHANCE } from '../../server-account/src/sds.js';
import { SERPENT_TITLE_CHANCE, SERPENT_AURA_CHANCE } from '../../server-account/src/serpents.js';
import { EG_HONOUR_TITLES, EG_HONOUR_AURA, EG_REDOUBT_HONOURS, EG_UNFALLEN_REDOUBT, EG_CHAMPION_TITLE, EG_FIRST_TITLE, EG_FIRST_AURA, EG_CHAMPIONS_TOP, egHonourBitsOf, egHonourTitlesOf } from '../../server-account/src/egHonours.js';
import { ILIAC_CHAMPION_MIN_GAMES, ILIAC_CHAMPION_MIN_FOES } from '../../server-account/src/iliac.js';
import { GAMBIT_CHAMPION_MIN_GAMES, GAMBIT_CHAMPION_MIN_FOES } from '../../server-account/src/gambit.js';
import { EMBERS_EARNED_SQL } from '../../server-account/src/accounts.js';
import { giveBinder } from '../../src/systems/iliac/iliacItems.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const WRANGLER = read('server-account/wrangler.toml');
/** A `KEY = "value"` line of the service's config. */
const configOf = (key) => WRANGLER.match(new RegExp(`^${key} = "([^"]*)"`, 'm'))?.[1] ?? null;
const FESTIVAL = FESTIVALS[0];
const DURING = FESTIVAL.fromMs + 86_400_000;
const AFTER = FESTIVAL.toMs + 86_400_000;

function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, dataset: {}, style: {}, title: '', type: '', disabled: false,
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    classList: { contains: (c) => classes.has(c) },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    append(...cs) { for (const c of cs) n.children.push(c); },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return n.attrs[k] ?? null; },
  };
  return n;
}
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
/** A document that makes SVG (the fake's elements), so the pictures are drawn. */
const doc = { createElementNS: (_ns, tag) => fakeEl(tag) };
const all = (root, f) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (f(c)) out.push(c); walk(c); } }; walk(root); return out; };
const cls = (root, c) => all(root, (x) => x.classList?.contains(c));
const focus = (root, key) => all(root, (x) => x.attrs?.['data-focus'] === key)[0];
const rowOf = (root, kind, key) => all(root, (x) => x.dataset?.wardrobe === `${kind}:${key}`)[0];
const heads = (root) => all(root, (x) => x.tag === 'h4').map((h) => h.textContent);
const tags = (row) => cls(row, 'coll-tag').map((x) => x.textContent);
const settle = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

/** A flow as accountFlow.js's is, as far as the page reads one: its stage, its account, its wardrobe, its words and its
 *  presses - each press held open (`answer()` lands it), as a request out on the network is. */
function fakeFlow(wardrobe, extra = {}) {
  const asked = [];
  const flow = { stage: 'in', busy: false, error: '', note: '', account: { kind: 'linked' }, wardrobe, started: 0, asked, start() { flow.started++; }, ...extra };
  for (const p of ['equip', 'wearAura', 'wearIcon', 'toggleGlyph']) flow[p] = (k) => { asked.push([p, k]); return Promise.resolve(true); };
  return flow;
}
/** The Collections page, driven: drawn into a fresh root on every repaint, as the menu's render does - its kit the menu's
 *  own shape (a meter, the account's constructor). `made` counts the flows the page had built. */
function page({ flow = null, player = { items: [] }, now = DURING } = {}) {
  const box = { root: null, draws: 0, made: 0, changed: null };
  const draw = () => {
    box.draws++;
    box.root = el('div');
    const account = flow ? (onChange) => { box.made++; box.changed = onChange; return flow; } : undefined;
    drawCollectionsPage(box.root, draw, { el, divider: (t) => el('h4', 'px-divider', t), meter: (n, m) => el('i', 'px-meter', `${n}/${m}`), player, doc, now: () => now, ...(account ? { account } : {}) });
  };
  box.draw = draw;
  draw();
  return box;
}

/** The row a registered founder from before the date minted, who bought the Broker's two pieces and the festival's Twin
 *  Moons, broke a Remnant for both its grants, and hid the sprout - read through the service's own wardrobeOf. */
function mintedWardrobe() {
  const nowS = Math.floor(DURING / 1000);
  const player = {
    handle: 'aelwyn', registered_at: 1_790_000_000, created_at: nowS - 3600, insignia: 'title:gatebreaker aura:dagonfire',
    sd_honours: 3, fest_wares: 'icon:twinmoons', title: 'gatebreaker', aura: 'dagonfire', icon: 'twinmoons', glyphs_off: 'sprout',
  };
  return wardrobeOf(player, {}, nowS);
}

/** THE CATALOGUE AS THE RECORD STATES IT (bible/10-UI/Collections.md section 3; AUDIT COLLECTIONS-II): `kind:key` ->
 *  `source availability [scope]`, every one. */
const CATALOGUE = {
  'title:spirewalker': 'spire open', 'title:beaconlighter': 'spire open', 'title:kynbane': 'spire open', 'title:unfallen': 'spire open',
  'title:lonebeacon': 'spire open', 'title:battlemage': 'spire open', 'title:wellheadwalker': 'spire open', 'title:mastergallery': 'spire open',
  'title:mastercairn': 'spire open', 'title:mastershade': 'spire open', 'title:masterwellhead': 'spire open', 'title:spirechampion': 'spire ranked',
  'title:spirefirst': 'spire retired', 'title:hourbreaker': 'abyss chance', 'title:hoursfirst': 'abyss retired', 'title:coilbreaker': 'serpent chance',
  'title:gatebreaker': 'broker open', 'title:doorwarden': 'questlines open', 'title:covenbane': 'questlines open', 'title:weirwalker': 'questlines open',
  'title:hourwitness': 'questlines open', 'title:satakalwitness': 'questlines open', 'title:skyfarer': 'questlines open' /* KETCH (PIN MOVED): the Sky-Ketch's line */, 'title:starwarden': 'questlines seasonal', 'title:witchwarden': 'festival seasonal',
  'title:hearthkeeper': 'festival seasonal', 'title:warden': 'seats open', 'title:protector': 'seats open', 'title:crowned': 'seats open',
  'title:keeper': 'seats open', 'title:champion': 'seats open', 'title:chaptermaster': 'chapters dormant', 'title:chapterofficer': 'chapters dormant',
  'title:formermaster': 'chapters dormant', 'title:highmaster': 'chapters dormant', 'title:seasonmaster': 'chapters dormant', 'title:grandchampion': 'ranked open',
  'title:arenachampion': 'ranked ranked', 'title:iliacchampion': 'ranked ranked', 'title:grandmaster': 'ranked ranked', 'title:ilovelamp': 'world open',
  'title:founder': 'account closed', 'title:disciple': 'patrons patron', 'title:apostle': 'patrons dormant', 'title:hierophant': 'patrons patron',
  'title:herald': 'patrons patron', 'title:developer': 'staff staff', 'title:dungeonmaster': 'staff staff', 'title:shadowfang': 'bestowed bestowed',
  'title:penitent': 'bestowed bestowed', 'title:aegis': 'bestowed bestowed', 'title:primarch': 'bestowed bestowed', 'title:crystalfist': 'bestowed bestowed',
  'title:wikimaid': 'bestowed bestowed', 'title:nirnrootsage': 'bestowed bestowed' /* NIRNROOT-SAGE (PIN MOVED): Blob-Marley's own */, 'aura:beaconlight': 'spire open', 'aura:burningstair': 'spire open', 'aura:firstlight': 'spire retired',
  'aura:turninghour': 'abyss chance', 'aura:firsthour': 'abyss retired', 'aura:maelstrom': 'serpent chance', 'aura:dagonfire': 'broker open',
  'aura:witchfire': 'festival seasonal', 'aura:seraphwings': 'staff staff', 'aura:oblivionward': 'bestowed bestowed', 'aura:radiance': 'bestowed bestowed',
  'aura:shadowcloak': 'bestowed bestowed', 'aura:resonance': 'bestowed bestowed', 'aura:lilacwarren': 'bestowed bestowed', 'aura:sagesmoke': 'bestowed bestowed' /* NIRNROOT-SAGE (PIN MOVED) */, 'icon:tallowskull': 'festival seasonal',
  'icon:twinmoons': 'festival seasonal', 'icon:wyrdcauldron': 'festival seasonal', 'icon:soulcake': 'festival seasonal', 'glyph:tower': 'seats open character',
  'glyph:crownDF': 'seats open character', 'glyph:crownWR': 'seats open character', 'glyph:crownSN': 'seats open character', 'glyph:laurel': 'ranked ranked',
  'glyph:sprout': 'account auto', 'glyph:disciple': 'patrons patron', 'glyph:apostle': 'patrons dormant', 'glyph:hierophant': 'patrons patron',
  'glyph:herald': 'patrons patron', 'glyph:dev': 'staff staff', 'glyph:mod': 'staff staff', 'glyph:dm': 'staff staff',
  'glyph:shadowfang': 'bestowed bestowed', 'glyph:penitent': 'bestowed bestowed', 'glyph:aegis': 'bestowed bestowed', 'glyph:primarch': 'bestowed bestowed',
  'glyph:crystalfist': 'bestowed bestowed', 'glyph:wikimaid': 'bestowed bestowed', 'glyph:nirnrootsage': 'bestowed bestowed' /* NIRNROOT-SAGE (PIN MOVED) */,
};

// ── THE CATALOGUE ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('COLLECTIONS-II THE CATALOGUE IS WHOLE AND AS RECORDED: every title, aura, icon and glyph of the vocabulary has one entry and none else, its source and availability the record\'s literal (AUDIT COLLECTIONS-II lane 5: only legal values were held, so an Arena Champion said open, a bestowed aura open, Firstlight open survived), the sources in their order, words of how with every argument filled, an aura\'s look, High Master alone a `via` (mutants: an entry dropped; any entry\'s availability or source; the sources\' order)', () => {
  const vocab = { title: TITLES, aura: AURAS, icon: ICONS, glyph: GLYPHS };
  for (const kind of W.WARDROBE_KINDS) assert.deepEqual(Object.keys(W.WARDROBE[kind]).sort(), [...vocab[kind]].sort(), `${kind}: the vocabulary exactly`);
  const got = {};
  for (const kind of W.WARDROBE_KINDS) for (const e of W.wardrobeEntries(kind)) got[`${kind}:${e.key}`] = [e.src, e.avail, ...(e.scope ? [e.scope] : [])].join(' ');
  assert.deepEqual(got, CATALOGUE);
  assert.deepEqual(W.WARDROBE_SOURCES.map(([id]) => id), ['spire', 'abyss', 'serpent', 'broker', 'questlines', 'festival', 'seats', 'chapters', 'ranked', 'world', 'account', 'patrons', 'staff', 'bestowed'], 'play\'s first, what no play earns last');
  for (const kind of W.WARDROBE_KINDS) for (const e of W.wardrobeEntries(kind)) {
    const how = e.how();
    assert.ok(typeof how === 'string' && how.length > 12, `${kind}:${e.key} says how`);
    assert.doesNotMatch(how, /\{|undefined|NaN|\b0 (Deadlands|Soul)/, `${kind}:${e.key}: its words filled - ${how}`);
    if (kind === 'aura') assert.ok(e.look?.().length > 12, `${e.key} says what it looks like`);
    assert.ok(W.AVAIL_TAG[e.avail] && W.availLine(e, DURING).length > 4);
  }
  assert.deepEqual(W.WARDROBE_KINDS.flatMap((k) => W.wardrobeEntries(k).filter((e) => e.via).map((e) => [k, e.key, e.via])), [['title', 'highmaster', 'chaptermaster']]);
  assert.deepEqual(W.WARDROBE_KINDS.flatMap((k) => W.wardrobeEntries(k).filter((e) => e.note).map((e) => `${k}:${e.key}`)), ['title:spirechampion'], 'one entry says its own availability');
});

test('COLLECTIONS-II WHAT COMES TOGETHER, ALL OF IT EACH WAY (AUDIT COLLECTIONS-II lane 1: an aura named its title and not the glyph granted beside it): each grant group of the service - a listed title with its glyph and aura (TIER_GLYPH, TIER_AURA), the developer\'s three, the firsts\' two, the Spire\'s two, the champion\'s laurel - is one clique in the catalogue, and nothing is said to come with anything else (mutants: an aura not granted with its title; an aura\'s glyph dropped)', () => {
  const groups = [];
  for (const t of Object.keys(TIER_LISTS)) groups.push([`title:${t}`, `glyph:${TIER_GLYPH[t]}`, ...(TIER_AURA[t] ? [`aura:${TIER_AURA[t]}`] : [])]);
  groups.push(['title:developer', `aura:${DEVELOPER_AURA}`, 'glyph:dev'], ['title:hoursfirst', `aura:${HOURS_FIRST_AURA}`], [`title:${EG_FIRST_TITLE}`, `aura:${EG_FIRST_AURA}`], ['title:arenachampion', 'glyph:laurel']);
  for (const [t, a] of Object.entries(EG_HONOUR_AURA)) groups.push([`title:${t}`, `aura:${a}`]);
  const want = {};
  for (const g of groups) for (const a of g) want[a] = g.filter((b) => b !== a).sort();
  const got = {};
  for (const kind of W.WARDROBE_KINDS) for (const e of W.wardrobeEntries(kind)) if (e.with?.length) got[`${kind}:${e.key}`] = [...e.with].sort();
  assert.deepEqual(got, want);
});

test('COLLECTIONS-II THE CATALOGUE IS THE SERVICE\'S LAW SAID, ENTRY BY ENTRY (AUDIT COLLECTIONS-II lanes 1 and 5): the lists\' titles; each roll\'s own odds, each Redoubt\'s own number, each patron tier\'s own name, each board\'s own floor, each questline\'s own name, giver and level or the line it follows; the founders\' instant and the routes still open; Season 0 crowning no one; a member\'s own fall; the Descent\'s rules and a champion held through the next season; the cakes others take; a dealing claim\'s roll; the embers\' three purses; the prices; the chapters\' switch and the festival\'s, the questlines\' and the seats\' (mutants: the Hourbreaker saying the aura\'s odds; Spirewalker another Redoubt; every patron the Disciple; a questline\'s level, its predecessor, another line; a board\'s floor; the founder retired; a switch off)', () => {
  const entry = (kind, key) => W.wardrobeEntry(kind, key);
  const how = (kind, key) => entry(kind, key).how();
  // the lists
  const mapped = (configOf('PATREON_TIERS') ?? '').split(',').map((p) => p.split(':')[1]).filter(Boolean);
  assert.ok(mapped.length >= 3, 'the config read');
  for (const t of Object.keys(TIER_LISTS)) {
    const e = entry('title', t);
    if (PATREON_TITLES.includes(t)) {
      assert.deepEqual([e.src, e.avail], ['patrons', mapped.includes(t) ? 'patron' : 'dormant'], `${t}: a pledge's, ${mapped.includes(t) ? 'mapped' : 'no tier yet'}`);
      if (mapped.includes(t)) assert.match(e.how(), new RegExp(`at the ${t[0].toUpperCase()}${t.slice(1)} tier`), `${t}: its own tier named`);
    } else if (t === 'dungeonmaster') assert.deepEqual([e.src, e.avail], ['staff', 'staff']);
    else assert.deepEqual([e.src, e.avail], ['bestowed', 'bestowed'], `${t}: one player's`);
    assert.equal(entry('glyph', TIER_GLYPH[t]).avail, e.avail, `${t}'s glyph is had as it is`);
    if (TIER_AURA[t]) assert.equal(entry('aura', TIER_AURA[t]).avail, e.avail, `${t}'s aura is had as it is`);
  }
  for (const [t, a] of [['developer', DEVELOPER_AURA], ['hoursfirst', HOURS_FIRST_AURA], [EG_FIRST_TITLE, EG_FIRST_AURA]]) assert.equal(entry('aura', a).avail, entry('title', t).avail);
  // the rolls and the Redoubts, each entry its own number
  assert.deepEqual([W.REMNANT_ODDS.hourbreaker, W.REMNANT_ODDS.turninghour], [1 / SD_TITLE_CHANCE, 1 / SD_AURA_CHANCE]);
  assert.deepEqual([W.SERPENT_ODDS.coilbreaker, W.SERPENT_ODDS.maelstrom], [1 / SERPENT_TITLE_CHANCE, 1 / SERPENT_AURA_CHANCE]);
  for (const [k, n] of [...Object.entries(W.REMNANT_ODDS), ...Object.entries(W.SERPENT_ODDS)]) assert.match(how(k in TIER_AURA || AURAS.includes(k) ? 'aura' : 'title', k), new RegExp(`one in ${n} `), `${k}: one in ${n}`);
  for (const [r, t] of EG_REDOUBT_HONOURS) { assert.equal(W.REDOUBT_OF[t], r); assert.match(how('title', t), new RegExp(`Redoubt ${r} `), `${t}: Redoubt ${r}`); }
  for (const [t, a] of Object.entries(EG_HONOUR_AURA)) { assert.equal(W.REDOUBT_OF[a], W.REDOUBT_OF[t]); assert.match(how('aura', a), new RegExp(`Redoubt ${W.REDOUBT_OF[t]} `)); }
  for (const t of [...EG_HONOUR_TITLES, EG_CHAMPION_TITLE, EG_FIRST_TITLE]) assert.equal(entry('title', t).src, 'spire');
  // the Unfallen is the member who never fell: the `w` receipt's `fl` is the member's own
  assert.equal(W.REDOUBT_OF.unfallen, EG_UNFALLEN_REDOUBT);
  assert.ok(egHonourTitlesOf(egHonourBitsOf({ q: 'w', w: 10, ew: 0, fl: 0 })).includes('unfallen') && !egHonourTitlesOf(egHonourBitsOf({ q: 'w', w: 10, ew: 0, fl: 1 })).includes('unfallen'));
  assert.match(read('src/net/eliteGates/egBrain.js'), /fl: m\.falls \?\? 0/, 'a member\'s own falls on its receipt');
  assert.match(how('title', 'unfallen'), /without falling yourself, in a breach begun at Hall 1/);
  for (const t of ['unfallen', 'lonebeacon', 'mastergallery', 'mastercairn', 'mastershade', 'masterwellhead', ...EG_REDOUBT_HONOURS.map(([, x]) => x)]) assert.match(how('title', t), /Rehearsal does not count/, `${t}: never from a Rehearsal`);
  // Spire Champion: the last season's Descent, its rules, held through the next
  assert.equal(W.SPIRE_CHAMPIONS_TOP, EG_CHAMPIONS_TOP);
  assert.match(read('server-account/src/egHonours.js'), /rh = 0 AND ew = 0 AND wg = 0/, 'the Descent: no Rehearsal, begun at Hall 1, unwagered');
  assert.match(how('title', 'spirechampion'), new RegExp(`top ${EG_CHAMPIONS_TOP} companies .* an unwagered breach begun at Hall 1, never a Rehearsal`));
  assert.equal(W.availLine(entry('title', 'spirechampion')), 'Held through the whole season after the one you earned it in.');
  // the boards' floors
  assert.match(how('title', 'arenachampion'), new RegExp(`at least ${ARENA_CHAMPION_MIN_BOUTS} rated bouts against ${ARENA_CHAMPION_MIN_FOES} different`));
  assert.equal(how('glyph', 'laurel'), how('title', 'arenachampion'));
  assert.deepEqual(W.TABLE_CHAMPION_FLOOR, { iliacchampion: { games: ILIAC_CHAMPION_MIN_GAMES, foes: ILIAC_CHAMPION_MIN_FOES }, grandmaster: { games: GAMBIT_CHAMPION_MIN_GAMES, foes: GAMBIT_CHAMPION_MIN_FOES } });
  for (const t of ['iliacchampion', 'grandmaster']) assert.match(how('title', t), new RegExp(`at least ${W.TABLE_CHAMPION_FLOOR[t].games} ranked games against ${W.TABLE_CHAMPION_FLOOR[t].foes} different`));
  assert.equal(W.availLine(entry('title', 'arenachampion')), 'Held only while you stay on top.', 'never "passes to whoever takes your place" - a #1 short of the floor holds nothing');
  // the questlines, each its own line's words - the line found by the service's own table, never by the catalogue's
  // reading of it (AUDIT COLLECTIONS-II lane 5: a reader that found another line said that line's words and the pin agreed)
  for (const [id, sl] of Object.entries(QL_SERVICE_LINES)) {
    const t = sl.title;
    const l = QL_LINES.find((x) => x.id === id);
    assert.ok(l && W.questlineOf(t)?.id === id && entry('title', t).src === 'questlines', `${t}: its line, ${id}`);
    const said = how('title', t);
    assert.ok(said.includes(l.title()) && said.includes(l.giver()), `${t}: its line's name and giver`);
    if (l.opens.after) assert.ok(said.includes(QL_LINES.find((x) => x.id === l.opens.after).title()), `${t}: the line it follows (the client's gate - the service names only the gates it enforces)`);
    else assert.match(said, new RegExp(`level ${l.opens.level}\\b`), `${t}: its level`);
    assert.ok(said.endsWith(`Offered by ${l.giver()}.`), `${t}: the giver last, its office closed by the sentence`);
  }
  assert.equal(entry('title', 'starwarden').avail, 'seasonal', 'the Thirteenth of Frostfall is the festival\'s');
  // the founders: the instant, the routes still open
  assert.equal(FOUNDER_UNTIL, Date.UTC(2026, 8, 25, 12) / 1000, 'noon UTC, 25 September 2026');
  assert.equal(entry('title', 'founder').avail, 'closed');
  assert.match(how('title', 'founder'), /by noon UTC on 25 September 2026, or is granted it by name\. A guest from before then earns it by registering; a character from before then brought onto your account counts too\./);
  assert.ok(!W.AVAIL_NOW.includes('closed') && !W.AVAIL_NOW.includes('retired'));
  // the seats: Season 0 crowns no one; the guildmaster's character wears a seat's title
  for (const t of SEAT_TITLES) assert.equal(entry('title', t).src, 'seats');
  assert.deepEqual(seasonTitles({ n: 0, start: 1 }, [{ key: 1, guild: 'g', tier: 'crown', since: 1 }]), []);
  assert.ok(seasonTitles({ n: 1, start: 3 }, [{ key: 1, guild: 'g', tier: 'crown', since: 3 }]).some((x) => x.title === 'crowned'));
  for (const t of ['crowned', 'keeper']) assert.match(how('title', t), /from Season 1 on/);
  for (const t of ['warden', 'protector']) assert.match(how('title', t), /Your guildmaster character wears it as/);
  assert.match(how('title', 'champion'), /held when its crown proclaims one/);
  // the festival's cakes: the ones others take
  assert.match(read('server-account/src/festival.js'), /UPDATE players SET fest_given = fest_given \+ \?2 WHERE id = \?1/);
  assert.match(how('title', 'hearthkeeper'), new RegExp(`have other players take ${HEARTHKEEPER_GIVEN} Soul Cakes from it`));
  assert.match(how('icon', 'soulcake'), new RegExp(`\\b${SOULCAKE_TAKEN} Soul Cakes`));
  // the serpent's roll: a dealing claim's alone
  assert.match(read('server-account/src/serpents.js'), /const draw = c\.x === 'stood' \? null/);
  for (const k of Object.keys(W.SERPENT_ODDS)) assert.match(how(k === 'maelstrom' ? 'aura' : 'title', k), /if your own fire dealt a real share of your ship’s/);
  // the embers: every purse
  for (const table of ['gate_kills', 'serpent_kills', 'eg_redoubts']) assert.ok(EMBERS_EARNED_SQL.includes(table), table);
  for (const o of INSIGNIA) { const e = entry(o.kind, o.key); assert.equal(e.src, 'broker'); assert.match(e.how(), new RegExp(`\\b${o.price} Deadlands Embers - won closing Dagon’s Breaches, slaying Sea Serpents and taking Elite Breach Redoubts`)); }
  for (const w of FESTIVAL_WARES.filter((x) => ['title', 'aura', 'icon'].includes(x.kind))) { const e = entry(w.kind, w.key); assert.deepEqual([e.src, e.avail], ['festival', 'seasonal']); assert.match(e.how(), new RegExp(`\\b${w.price} Soul Cakes`)); }
  assert.deepEqual(FESTIVAL_ICONS.map((i) => entry('icon', i).src), FESTIVAL_ICONS.map(() => 'festival'));
  // the service's switches, each a claim the catalogue makes
  const chaptersOn = configOf('CHAPTER_TITLES') === 'on';
  for (const t of CHAPTER_TITLES) assert.deepEqual([entry('title', t).src, entry('title', t).avail], ['chapters', chaptersOn ? 'open' : 'dormant'], `${t}: CHAPTER_TITLES is ${configOf('CHAPTER_TITLES')}`);
  for (const key of ['FESTIVAL_OPEN', 'QUESTLINES_OPEN', 'SEATS_OPEN']) assert.equal(configOf(key), 'on', `${key} is off: the catalogue says these can be had - say what changed in src/ui/collections/wardrobeCatalogue.js`);
});

test('COLLECTIONS-II HELD, WORN AND COUNTED off the wardrobe the service mints (titles.js wardrobeOf): the founder, the bought, the rolled and the festival\'s held; the one title, aura and icon worn; a glyph taken off held and not shown, one held and on shown; High Master with Chapter Master, never worn or counted; a seat\'s glyph the character\'s, never the account\'s - the service\'s wardrobe has none, so the page says nothing of its holding and counts it nowhere (AUDIT COLLECTIONS-II lanes 1, 2: the Seats\' glyphs read "not held" for their every holder); a service too old to name a kind holds none of it (mutants: worn read off held; a hidden glyph shown; the via counted; a character\'s glyph counted)', () => {
  const w = mintedWardrobe();
  assert.deepEqual(w.titles, ['founder', 'gatebreaker', 'hourbreaker'], 'the producer\'s own shape');
  for (const [k, key] of [['title', 'founder'], ['title', 'gatebreaker'], ['title', 'hourbreaker'], ['aura', 'dagonfire'], ['aura', 'turninghour'], ['icon', 'twinmoons'], ['glyph', 'sprout']]) assert.equal(W.wardrobeHeld(k, key, w), true, `${k}:${key} held`);
  assert.equal(W.wardrobeHeld('title', 'developer', w), false);
  assert.deepEqual(['title', 'aura', 'icon'].map((k) => W.wardrobeEntries(k).filter((e) => W.wardrobeWorn(k, e.key, w)).map((e) => e.key)), [['gatebreaker'], ['dagonfire'], ['twinmoons']], 'one worn a kind');
  assert.equal(W.wardrobeWorn('glyph', 'sprout', w), false, 'the sprout taken off');
  assert.equal(W.wardrobeWorn('glyph', 'sprout', { glyphs: ['sprout'] }), true, 'a glyph held and not taken off is shown');
  assert.deepEqual(W.wardrobeCount('title', w), { held: 3, total: TITLES.length - 1 });
  assert.deepEqual(W.wardrobeCount('aura', w), { held: 2, total: AURAS.length });
  const chap = { titles: ['chaptermaster'], title: 'chaptermaster' };
  assert.deepEqual([W.wardrobeHeld('title', 'highmaster', chap), W.wardrobeWorn('title', 'highmaster', chap), W.wardrobeCount('title', chap).held], [true, false, 1]);
  // a seat's glyph: the character's
  const seated = wardrobeOf({ handle: 'g', registered_at: 1, created_at: 1, seatTitles: ['warden', 'protector'] }, {}, 2e9);
  assert.ok(seated.titles.includes('warden'), 'the account holds the seat\'s title');
  assert.deepEqual(seated.glyphs.filter((g) => ['tower', 'crownDF', 'crownWR', 'crownSN'].includes(g)), [], 'and none of its glyphs - they are minted on the character');
  for (const g of ['tower', 'crownDF', 'crownWR', 'crownSN']) {
    const e = { ...W.wardrobeEntry('glyph', g), kind: 'glyph', key: g };
    assert.deepEqual([W.wardrobeKnown(e), W.wardrobeCounted(e), W.wardrobeHeld('glyph', g, { glyphs: [g] })], [false, false, false], g);
  }
  assert.deepEqual(W.wardrobeCount('glyph', null), { held: 0, total: GLYPHS.length - 4 });
  assert.equal(W.wardrobeHeld('icon', 'twinmoons', { titles: ['founder'] }), false, 'a wardrobe from before icons holds none');
});

test('COLLECTIONS-II THE SEASONS AND THE FILTERS: a festival\'s piece seasonal while one is open - its last day in words - and out of season after; Obtainable is what a player can act on now (never the closed, the retired, the bestowed, the staff\'s, the dormant or the out-of-season); Held and Not held split what the account can say - a character\'s own glyph is in neither (mutants: seasonal never resolved; retired obtainable; a character\'s glyph "missing")', () => {
  const witch = { ...W.wardrobeEntry('aura', 'witchfire'), kind: 'aura', key: 'witchfire' };
  assert.equal(W.wardrobeAvail(witch, DURING), 'seasonal');
  assert.equal(W.wardrobeAvail(witch, AFTER), 'offseason');
  assert.equal(W.wardrobeAvail(witch, FESTIVAL.fromMs - 1), 'offseason');
  assert.match(W.festivalUntilText(DURING), /7/);
  assert.equal(W.festivalUntilText(AFTER), '');
  assert.match(W.availLine(witch, DURING), new RegExp(W.festivalUntilText(DURING)));
  const w = mintedWardrobe();
  const titles = W.wardrobeEntries('title');
  const now = titles.filter((e) => wardrobeFilterPasses('now', e, w, DURING)).map((e) => e.key);
  for (const k of ['founder', 'shadowfang', 'developer', 'chaptermaster', 'hoursfirst', 'apostle']) assert.ok(!now.includes(k), `${k} is not to be had now`);
  assert.ok(!W.wardrobeEntries('glyph').filter((e) => wardrobeFilterPasses('now', e, w, DURING)).some((e) => e.key === 'sprout'), 'the sprout comes by itself, never had now');
  for (const k of ['gatebreaker', 'kynbane', 'hourbreaker', 'arenachampion', 'witchwarden', 'disciple', 'ilovelamp']) assert.ok(now.includes(k), `${k} is`);
  assert.ok(!titles.filter((e) => wardrobeFilterPasses('now', e, w, AFTER)).some((e) => e.key === 'witchwarden'), 'out of season, not now');
  const held = titles.filter((e) => wardrobeFilterPasses('held', e, w)).map((e) => e.key);
  const missing = titles.filter((e) => wardrobeFilterPasses('missing', e, w)).map((e) => e.key);
  assert.deepEqual([...held].sort(), ['founder', 'gatebreaker', 'hourbreaker']);
  assert.equal(held.length + missing.length, titles.length);
  const glyphs = W.wardrobeEntries('glyph');
  assert.ok(!glyphs.filter((e) => wardrobeFilterPasses('missing', e, w)).some((e) => e.key === 'tower'), 'a character\'s own is not missing from the account');
  assert.equal(titles.filter((e) => wardrobeFilterPasses('all', e, w)).length, titles.length);
});

// ── THE PAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('COLLECTIONS-II THE PAGE: six tiles, each its part\'s name over its count and the kit\'s meter of it (a dash, and an empty meter, where the account is not read); the codex\'s and the cards\' counts their producers\' own; the account\'s line for every state of the read - a guest told it keeps none, a refusal that signed out said (mutants: the meter never drawn, or backwards; the codex count short of the Gilded; the cards off by one; the count without the account; the auth sentence swallowed)', async () => {
  globalThis.document = undefined;
  _resetForTests(); setPref('lootRarity', true); _resetCodexForTests();
  resetCollectionsPage();
  const me = { items: [] };
  giveBinder(me);
  const flow = fakeFlow(mintedWardrobe());
  const p = page({ flow, player: me });
  await settle();
  const tiles = cls(p.root, 'coll-part');
  assert.deepEqual(tiles.map((b) => b.attrs['data-focus']), ['titles', 'auras', 'icons', 'glyphs', 'codex', 'cards'].map((id) => `coll-part-${id}`));
  assert.equal(tiles[0].children[1].textContent, `3 / ${TITLES.length - 1}`);
  assert.equal(cls(tiles[0], 'px-meter')[0].textContent, `3/${TITLES.length - 1}`, 'the meter, held of all');
  assert.equal(tiles[0].attrs['aria-pressed'], 'true');
  // the codex: every record its producers list
  const total = GILDED_RECORDS.length + codexRows().length + codexSets().reduce((s, x) => s + x.pieces.length, 0);
  assert.deepEqual(partCount('codex', null), { held: 0, total });
  noteFind(mintGilded(DRAGONFIRE_OATH), { quiet: true });
  assert.deepEqual(partCount('codex', null), { held: 1, total }, 'a Gilded found counts');
  // the cards: the catalog's, the starter deck's distinct cards held
  assert.deepEqual(partCount('cards', null, me), { held: new Set(STARTER_DECK).size, total: ILIAC_CARDS.length });
  assert.deepEqual(partCount('titles', null), { held: null, total: TITLES.length - 1 });
  // the account's line, every state
  const line = (f) => { resetCollectionsPage(); return cls(page({ flow: f }).root, 'coll-acct')[0]?.textContent ?? null; };
  assert.equal(line(null), null, 'a host with no flow: no line');
  assert.match(line(fakeFlow(null, { stage: 'loading' })), /Reading your account/);
  assert.match(line(fakeFlow(null, { stage: 'out' })), /^Sign in/);
  assert.match(line(fakeFlow(null, { stage: 'out', error: 'Your session has ended. Sign in again.' })), /^Your session has ended\. Sign in again\. Sign in from your profile/, 'why it signed out, then the way back');
  assert.equal(line(fakeFlow(null, { error: 'The account service could not be reached.' })), 'The account service could not be reached.Try again', 'a failed read, and the press that asks again');
  resetCollectionsPage();
  const failed = fakeFlow(null);
  const fp = page({ flow: failed });
  await settle();
  const starts = failed.started;
  focus(fp.root, 'coll-retry').onclick(); await settle();
  assert.equal(failed.started, starts + 1, 'Try again asks again');
  assert.match(line(fakeFlow(mintedWardrobe(), { busy: true })), /on every character\. Asking your account…$/, 'a press out says it waits');
  // AUDIT COLLECTIONS-II (lane 3): the flow's last word said on the part of the kind it was about, never on another's
  resetCollectionsPage();
  const said = fakeFlow(mintedWardrobe());
  const sp = page({ flow: said });
  rowOf(sp.root, 'title', 'gatebreaker').onclick();
  cls(sp.root, 'coll-wear')[0].onclick();
  said.note = 'Title removed.'; sp.draw();
  assert.match(cls(sp.root, 'coll-acct')[0].textContent, /on every character\. Title removed\.$/, 'on its own kind\'s part');
  setCollectionsPart('auras'); sp.draw();
  assert.equal(cls(sp.root, 'coll-acct')[0].textContent, 'Held by your account, on every character.', 'never on another\'s');
  assert.match(line(fakeFlow({ titles: [], glyphs: ['sprout'] }, { account: { kind: 'guest' } })), /A guest account keeps none of these but the sprout/);
  resetCollectionsPage();
  const out = page({ flow: fakeFlow(null, { stage: 'out' }) });
  assert.ok(cls(out.root, 'coll-part')[0].textContent.includes('– /'), 'unread: a dash');
  assert.equal(cls(cls(out.root, 'coll-part')[0], 'px-meter')[0].textContent, `0/${TITLES.length - 1}`, 'and an empty meter');
  assert.ok(heads(out.root).includes('The Elite Breach - –/13'), 'a dash in a divider too, unread');
  assert.deepEqual(cls(out.root, 'coll-filter').map((b) => b.attrs['data-focus']), ['coll-filter-all', 'coll-filter-now'], 'Held and Not held only where the account is read');
  // Held chosen while read, then the read gone (signed out on the card): every row again, never "Nothing here."
  resetCollectionsPage();
  const gone = fakeFlow(mintedWardrobe());
  const gp = page({ flow: gone });
  focus(gp.root, 'coll-filter-held').onclick();
  gone.stage = 'out'; gone.wardrobe = null; gp.draw();
  assert.deepEqual([cls(gp.root, 'coll-row').length, focus(gp.root, 'coll-filter-all').classList.contains('on')], [W.wardrobeEntries('title').length, true], 'the Held filter let go with the read');
  // the codex's words through the text core (AUDIT COLLECTIONS-II lanes 3 and 5): under the pseudo-locale none is English
  resetCollectionsPage();
  const was = currentLocale();
  setLocale(PSEUDO_LOCALE);
  let codexHeads;
  try { const cp = page({ player: me }); setCollectionsPart('codex'); cp.draw(); codexHeads = heads(cp.root); } finally { setLocale(was); }
  assert.ok(codexHeads.length >= 3 && codexHeads.every((h) => !/^(Gilded|Legendaries|Aetheric) - \d+ of \d+ found$/.test(h)), codexHeads.join(' | '));
  _resetCodexForTests(); resetCollectionsPage();
});

test('COLLECTIONS-II THE READ IS THE MENU VISIT\'S (AUDIT COLLECTIONS-II lanes 2 and 5): built once and asked once after the draw however many draws follow, never inside one; kept across leaving the page and coming back; let go by a new visit - its later word repaints nothing; asked again when the account card closes (a wear, a sign-out or another account there), at once while idle, and - a press of the page\'s own out - once that press is answered, never instead of it (mutants: a flow built every draw; the read inside the draw; the read let go on leaving; the card\'s close reading nothing; the busy answer dropped for the new read)', async () => {
  globalThis.document = undefined;
  resetCollectionsPage();
  const flow = fakeFlow(mintedWardrobe());
  const p = page({ flow });
  assert.equal(flow.started, 0, 'never asked inside the draw');
  p.draw(); p.draw();
  await settle();
  assert.deepEqual([p.made, flow.started], [1, 1], 'one flow, one read, three draws');
  disarmCollectionsPage(); p.draw(); await settle();
  assert.deepEqual([p.made, flow.started], [1, 1], 'leaving and coming back asks nothing');
  // the card closes: asked again
  rereadCollectionsAccount(); await settle();
  assert.equal(flow.started, 2, 'idle: asked again at once');
  flow.busy = true;
  rereadCollectionsAccount(); await settle();
  assert.equal(flow.started, 2, 'a press out: not instead of it');
  flow.busy = false;
  const before = p.draws;
  p.changed(); await settle();
  assert.equal(flow.started, 3, 'its answer in: then asked');
  assert.ok(p.draws > before, 'and repainted');
  // a new visit lets the old read go: its word, landing late, repaints nothing - the old visit's page nor the new
  const old = p.changed;
  resetCollectionsPage();
  const q = page({ flow: fakeFlow(mintedWardrobe()) });
  const [wasOld, wasNew] = [p.draws, q.draws];
  old();
  assert.deepEqual([p.draws, q.draws], [wasOld, wasNew], 'the old visit\'s word repaints nothing');
  rereadCollectionsAccount(); resetCollectionsPage();
  rereadCollectionsAccount();   // no read yet: nothing to ask
});

test('COLLECTIONS-II A KIND\'S PART: every one of the kind a row under its source\'s divider, each divider its own held of all whatever the filter (a via counted nowhere; a group the account keeps none of with no count); a row\'s state said only where the account holds it, a character\'s own as such, its availability always; a row opened whole says how, whether now, what comes with it and whose it is (nothing of whose while unread), and offers Wear, Take off, Show or Hide through the flow where held - never disabled, so the keyboard keeps its place (AUDIT COLLECTIONS-II lane 2), a press while one is out doing nothing; a "comes with" press opens that thing in its own part, the filter back to All, the keyboard on its row; the festival\'s line while it is on (mutants: Wear on a thing not held; the wrong press for a kind; Wear disabled; a comes-with that stays put, keeps the filter or drops the keyboard; a state chip on a row not held; a divider counting the via or only the filtered; whose said unread)', async () => {
  globalThis.document = undefined;
  _resetForTests();
  resetCollectionsPage();
  const w = mintedWardrobe();
  const flow = fakeFlow(w);
  let p = page({ flow });
  assert.equal(cls(p.root, 'coll-row').length, TITLES.length);
  for (const h of ['The Sigil Broker - 1/1', 'The Elite Breach - 0/13', 'Your Account - 1/1', 'The Abyss Dungeons - 1/2', 'The Guild Chapters - 0/4']) assert.ok(heads(p.root).includes(h), `${h} in ${heads(p.root).join(' | ')}`);
  const gate = rowOf(p.root, 'title', 'gatebreaker');
  assert.deepEqual(tags(gate), ['Worn', 'Obtainable']);
  assert.deepEqual(tags(rowOf(p.root, 'title', 'founder')), ['Held', 'Closed']);
  assert.deepEqual(tags(rowOf(p.root, 'title', 'hourbreaker')), ['Held', 'By chance']);
  assert.deepEqual(tags(rowOf(p.root, 'title', 'shadowfang')), ['Bestowed'], 'not held: no state chip');
  assert.ok(gate.classList.contains('held') && !rowOf(p.root, 'title', 'shadowfang').classList.contains('held'));
  assert.ok(gate.classList.contains('nopic') && cls(gate, 'coll-prev').length === 0, 'a title\'s picture is its word');
  assert.equal(cls(p.root, 'coll-season').length, 1, 'the festival is on');
  // the Held filter: the dividers keep their own counts
  focus(p.root, 'coll-filter-held').onclick();
  assert.ok(heads(p.root).includes('The Abyss Dungeons - 1/2') && heads(p.root).includes('Your Account - 1/1'), heads(p.root).join(' | '));
  focus(p.root, 'coll-filter-all').onclick();
  // opened whole, and worn off
  gate.onclick();
  assert.equal(rowOf(p.root, 'title', 'gatebreaker').attrs['aria-expanded'], 'true');
  const whole = cls(p.root, 'coll-whole')[0];
  assert.match(whole.textContent, /^Gatebreaker/, 'a title opened whole wears its word on top');
  assert.match(whole.textContent, /How to get it.*30 Deadlands Embers.*Availability.*You can earn it now\..*Your account holds this\./);
  assert.deepEqual(cls(whole, 'coll-foot').map((f) => cls(f, 'coll-wear').length), [1], 'Wear in the box\'s foot, centred under the row (AUDIT COLLECTIONS-II lane 3: the pad never reached it at the text\'s left)');
  let off = cls(p.root, 'coll-wear')[0];
  assert.equal(off.textContent, 'Take off');
  off.onclick();
  assert.deepEqual(flow.asked.at(-1), ['equip', 'gatebreaker']);
  flow.busy = true; p.draw();
  off = cls(p.root, 'coll-wear')[0];
  assert.deepEqual([off.disabled, off.attrs['aria-disabled'], off.classList.contains('busy')], [false, 'true', true], 'it says it waits - never disabled');
  const n = flow.asked.length;
  off.onclick();
  assert.equal(flow.asked.length, n, 'a press while one is out does nothing');
  flow.busy = false; p.draw();
  assert.equal(cls(p.root, 'coll-wear')[0].attrs['aria-disabled'], 'false');
  // a thing not held: no press
  rowOf(p.root, 'title', 'shadowfang').onclick();
  assert.equal(cls(p.root, 'coll-wear').length, 0);
  assert.match(cls(p.root, 'coll-whole')[0].textContent, /does not hold this yet/);
  // the other kinds' presses; a shown glyph offers Hide
  for (const [part, kind, key, press, word] of [['auras', 'aura', 'turninghour', 'wearAura', 'Wear'], ['icons', 'icon', 'twinmoons', 'wearIcon', 'Take off'], ['glyphs', 'glyph', 'sprout', 'toggleGlyph', 'Show']]) {
    setCollectionsPart(part); p.draw();
    rowOf(p.root, kind, key).onclick();
    const b = cls(p.root, 'coll-wear')[0];
    assert.equal(b.textContent, word, `${kind}:${key}`);
    assert.equal(cls(cls(p.root, 'coll-whole')[0], 'coll-bigword')[0]?.textContent, W.wardrobeName(kind, key), `${kind}:${key}: its name on top, every kind's (AUDIT COLLECTIONS-II lane 3: after a jump the row may be out of view)`);
    b.onclick();
    assert.deepEqual(flow.asked.at(-1), [press, key]);
  }
  assert.deepEqual(tags(rowOf(p.root, 'glyph', 'sprout')), ['Hidden', 'Automatic'], 'the sprout comes by itself - never Obtainable');
  flow.wardrobe = { ...w, glyphsOff: [] }; p.draw();
  assert.deepEqual([tags(rowOf(p.root, 'glyph', 'sprout'))[0], cls(p.root, 'coll-wear')[0].textContent], ['Shown', 'Hide']);
  // a seat's glyph: the character's
  assert.ok(heads(p.root).includes('The Seats'), 'no count for what the account never keeps');
  const tower = rowOf(p.root, 'glyph', 'tower');
  assert.deepEqual(tags(tower), ['Per character', 'Obtainable']);
  assert.ok(tower.classList.contains('held'), 'never dimmed as not held');
  tower.onclick();
  assert.match(cls(p.root, 'coll-whole')[0].textContent, /on that character - your account does not keep it\./);
  assert.equal(cls(p.root, 'coll-wear').length, 0);
  assert.equal(cls(p.root, 'coll-season').length, 0, 'no glyph is the festival\'s');
  // comes with: from the Kynbane title under the Held filter to its aura - the part, the row, All, the keyboard
  const focused = [];
  globalThis.requestAnimationFrame = (fn) => fn();
  const scrolled = [];
  globalThis.document = { querySelector: (sel) => ({ focus: () => focused.push(sel), scrollIntoView: (o) => scrolled.push([sel, o.block]) }) };
  try {
    setCollectionsPart('titles'); p.draw();
    rowOf(p.root, 'title', 'kynbane').onclick();
    assert.ok(cls(cls(p.root, 'coll-whole')[0], 'coll-foot')[0].children.some((c) => c.classList.contains('coll-withs')), 'Comes with in the foot too');
    focus(p.root, 'coll-filter-missing').onclick();
    focus(p.root, 'coll-with-aura-beaconlight').onclick();
  } finally { delete globalThis.requestAnimationFrame; globalThis.document = undefined; }
  assert.ok(focus(p.root, 'coll-part-auras').classList.contains('on'), 'the Auras part');
  assert.ok(rowOf(p.root, 'aura', 'beaconlight').classList.contains('on') && cls(p.root, 'coll-whole').length === 1, 'Beaconlight opened');
  assert.ok(focus(p.root, 'coll-filter-all').classList.contains('on'), 'the filter back to All');
  assert.deepEqual(focused, ['[data-focus="coll-row-aura-beaconlight"]'], 'the keyboard on the row it opened');
  assert.deepEqual(scrolled.at(-1), ['[data-focus="coll-row-aura-beaconlight"]', 'start'], 'and the row in view (the repaint kept the old part\'s scroll)');
  assert.deepEqual(scrolled.slice(0, 1), [['.px-sys .coll-whole', 'nearest']], 'a row opened brings its box into view');
  assert.match(cls(p.root, 'coll-whole')[0].textContent, /^Beaconlight/, 'an aura opened whole wears its name on top');
  // the via: High Master with Chapter Master, no press
  resetCollectionsPage();
  p = page({ flow: fakeFlow({ titles: ['chaptermaster'], title: 'chaptermaster', glyphs: [] }) });
  rowOf(p.root, 'title', 'highmaster').onclick();
  assert.deepEqual(tags(rowOf(p.root, 'title', 'highmaster')), ['With Chapter Master', 'Not yet available']);
  assert.equal(cls(p.root, 'coll-wear').length, 0);
  // signed out: the catalogue, nothing held, nothing said of whose, nothing worn from here; after the festival, out of season
  resetCollectionsPage();
  p = page({ flow: fakeFlow(null, { stage: 'out' }), now: AFTER });
  assert.equal(cls(p.root, 'coll-row').filter((r) => r.classList.contains('held')).length, 0);
  rowOf(p.root, 'title', 'witchwarden').onclick();
  assert.deepEqual([cls(p.root, 'coll-wear').length, cls(p.root, 'coll-own').length], [0, 0], 'no press; nothing of whose, unread');
  assert.deepEqual(tags(rowOf(p.root, 'title', 'witchwarden')), ['Out of season']);
  assert.equal(cls(p.root, 'coll-season').length, 0);
  resetCollectionsPage();
});

test('COLLECTIONS-II THE FILTERS, THE PICTURES, THE RESET: a filter pressed narrows every source\'s rows and marks itself; a filter with nothing says so; the reset forgets the filter and the row opened; an aura\'s ring, an icon\'s drawing and a glyph\'s mark drawn where the document makes SVG, a title\'s and an aura\'s word in its paint (mutants: the filter never applied; the reset keeping the filter or the row; an aura\'s word unpainted)', () => {
  globalThis.document = undefined;
  resetCollectionsPage();
  const p = page({ flow: fakeFlow(mintedWardrobe()) });
  focus(p.root, 'coll-filter-held').onclick();
  assert.deepEqual(cls(p.root, 'coll-row').map((r) => r.dataset.wardrobe).sort(), ['title:founder', 'title:gatebreaker', 'title:hourbreaker']);
  assert.ok(focus(p.root, 'coll-filter-held').classList.contains('on') && focus(p.root, 'coll-filter-held').attrs['aria-pressed'] === 'true');
  setCollectionsPart('icons'); p.draw();
  assert.equal(cls(p.root, 'coll-row').length, 1, 'the one icon held');
  focus(p.root, 'coll-filter-missing').onclick();
  assert.equal(cls(p.root, 'coll-row').length, ICONS.length - 1);
  resetCollectionsPage();
  const q = page({ flow: fakeFlow({ titles: [], glyphs: [], auras: [], icons: [] }) });
  focus(q.root, 'coll-filter-held').onclick();
  assert.equal(cls(q.root, 'coll-row').length, 0);
  assert.ok(all(q.root, (x) => x.textContent === 'Nothing here.').length === 1, 'said');
  focus(q.root, 'coll-filter-all').onclick();
  rowOf(q.root, 'title', 'founder').onclick();
  assert.equal(cls(q.root, 'coll-whole').length, 1);
  resetCollectionsPage(); q.draw();
  assert.ok(focus(q.root, 'coll-filter-all').classList.contains('on'), 'the filter forgotten');
  assert.equal(cls(q.root, 'coll-whole').length, 0, 'the row closed');
  focus(q.root, 'coll-filter-held').onclick(); resetCollectionsPage(); q.draw();
  assert.ok(focus(q.root, 'coll-filter-all').classList.contains('on'), 'a filter forgotten by the reset');
  // the pictures
  for (const [part, kind, key] of [['auras', 'aura', 'dagonfire'], ['icons', 'icon', 'soulcake'], ['glyphs', 'glyph', 'laurel']]) {
    setCollectionsPart(part); q.draw();
    assert.equal(cls(rowOf(q.root, kind, key), 'coll-prev')[0].children[0]?.tag, 'svg', `${kind}:${key} drawn`);
  }
  setCollectionsPart('auras'); q.draw();
  assert.ok(cls(rowOf(q.root, 'aura', 'witchfire'), 'coll-word')[0].style.color, 'an aura\'s word in its title\'s paint');
  const ring = auraRingNode(doc, 'witchfire');
  assert.ok(all(ring, (x) => x.tag === 'stop').length >= 2 && all(ring, (x) => x.tag === 'ellipse').length === 2, 'the ring in its title\'s colours');
  assert.equal(auraRingNode(null, 'witchfire'), null, 'no SVG door: no picture');
  setCollectionsPart('titles'); q.draw();
  const word = cls(rowOf(q.root, 'title', 'founder'), 'coll-word')[0];
  assert.ok(word.style.color, 'a title\'s word in its paint');
  assert.deepEqual([cls(rowOf(q.root, 'title', 'founder'), 'coll-nm')[0].children[0].className, cls(cls(rowOf(q.root, 'title', 'founder'), 'coll-nm')[0], 'coll-plate')[0].children[0]], ['coll-plate', word], 'the paint on a word as wide as its letters, in a plate (AUDIT COLLECTIONS-II lane 3: a gradient on the whole cell showed its first colour alone)');
  // on the Grimoire's page each colour inked as the dress inks its sheets
  const plain = cls(rowOf(q.root, 'title', 'gatebreaker'), 'coll-word')[0].style.backgroundImage;
  globalThis.document = { documentElement: { dataset: { plusDress: 'grimoire' } } };
  try { q.draw(); } finally { globalThis.document = undefined; }
  const inked = cls(rowOf(q.root, 'title', 'gatebreaker'), 'coll-word')[0].style.backgroundImage;
  assert.ok(plain.includes('#ffd152') && !inked.includes('#ffd152') && inked !== plain, `inked: ${inked}`);
  resetCollectionsPage();
});

test('COLLECTIONS-II DRESSED BY THE KIT, AND ON THE PAGE: the filters and a "comes with" press are tiles, a row a list line, a row opened a panel, a tag a chip, Wear the kit\'s button - the sheet gives them their edges and no ground or edge colour of its own; the sheet laid once in the document beside the page\'s own (mutants: a role dropped; the sheet\'s own ground on a row; the wardrobe\'s sheet never laid)', () => {
  const want = { tile: ['.px-sys .coll-part', '.px-sys .coll-filter', '.px-sys .coll-with'], listRow: ['.px-sys .coll-row'], panel: ['.px-sys .coll-whole'], chip: ['.px-sys .coll-tag'], button: ['.px-sys .act'] };
  for (const [role, sels] of Object.entries(want)) for (const s of sels) assert.ok(FRAME_ROLES[role].includes(s), `${role}: ${s}`);
  const rule = (sel) => WARDROBE_PART_CSS.split('\n').filter((l) => l.startsWith(`${sel} {`)).join(' ');
  for (const sel of ['.px-sys .coll-filter', '.px-sys .coll-with', '.px-sys .coll-whole']) assert.match(rule(sel), /border-width: 2px; border-style: solid;/, `${sel}: the kit's edge`);
  assert.match(rule('.px-sys .coll-row'), /border-width: 0 0 1px; border-style: solid;/, 'a line');
  assert.match(rule('.px-sys .coll-tag'), /border-width: 1px; border-style: solid;/, 'a chip\'s edge');
  assert.doesNotMatch(WARDROBE_PART_CSS, /background|border-color|border: \d/, 'no paint over the kit\'s');
  assert.match(rule('.px-sys .coll-row:not(.held) .coll-prev, .px-sys .coll-row:not(.held) .coll-nm'), /opacity: 0\.8;/, 'a name not held dimmed, never faded out (AUDIT COLLECTIONS-II lane 3: at 0.55 most read under 3:1)');
  assert.match(rule('.px-sys .coll-foot'), /grid-column: 1 \/ -1; .*align-items: center;/, 'the presses centred across the box');
  // the Stone theme's: every rule the theme's, a ground on the name's plate alone
  const themeRules = WARDROBE_THEME_CSS.split('\n').filter((l) => l.includes('{'));
  assert.ok(themeRules.length >= 3 && themeRules.every((l) => l.split('{')[0].split(',').every((s) => s.trim().startsWith(':root[data-plus-theme="stone"] .px-sys .coll-'))), 'all of it Stone\'s');
  assert.deepEqual(themeRules.filter((l) => /background/.test(l)).map((l) => l.split('{')[0].trim()), [':root[data-plus-theme="stone"] .px-sys .coll-plate'], 'a ground on the plate alone');
  assert.deepEqual(Object.values(WARDROBE_PARTS), W.WARDROBE_KINDS, 'a part a kind, in the kinds\' order');
  assert.deepEqual(collectionParts({ items: [] }).slice(0, 4).map(([id]) => id), Object.keys(WARDROBE_PARTS));
  // the sheet in the document, once
  const laid = [];
  globalThis.document = { getElementById: (id) => laid.find((x) => x.id === id) ?? null, createElement: () => ({ id: '', textContent: '' }), head: { appendChild: (x) => laid.push(x) } };
  try {
    resetCollectionsPage();
    page({}); page({});
  } finally { globalThis.document = undefined; }
  assert.equal(laid.length, 1);
  assert.equal(laid[0].id, COLLECTION_PAGE_STYLE_ID);
  assert.ok(laid[0].textContent.includes(COLLECTION_PAGE_CSS) && laid[0].textContent.includes(WARDROBE_PART_CSS) && laid[0].textContent.includes(WARDROBE_THEME_CSS));
  resetCollectionsPage();
});

test('COLLECTIONS-II THE MENU\'S WIRING (AUDIT COLLECTIONS-II lanes 2 and 5): the account card closing asks the page\'s read again; every part lands by its name (mutants: the close reading nothing; a wardrobe part\'s name landing elsewhere)', () => {
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /  acctPaint = null;\n  rereadCollectionsAccount\(\);   \/\/ AUDIT COLLECTIONS-II[^\n]*\n  render\(\);\n\}/);
  assert.match(menu, /else if \(at === 'collections' \|\| COLLECTION_PARTS\.some\(\(\[id\]\) => id === at\)\) \{ pauseTab = 'holdings'; holdSec = 'collections'; if \(at !== 'collections'\) setCollectionsPart\(at\); \}/);
});

test('COLLECTIONS-II the account card\'s note names the title worn, never its key (the page says that note)', async () => {
  const { AccountFlow } = await import('../../src/ui/accountFlow.js');
  const { SESSION_KEY } = await import('../../src/net/accountClient.js');
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'a1', name: 'Aelwyn', kind: 'linked', sessionId: 's1', secret: 'sec' })]]);
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const wardrobe = { titles: ['gatebreaker'], title: null, glyphs: [], auras: [], aura: null, insignia: ['title:gatebreaker'] };
  const answers = { '/v1/account': { account: { id: 'a1', name: 'Aelwyn', kind: 'linked', handle: 'aelwyn' }, wardrobe, devices: [] }, '/v1/account/title': { ok: true, ...wardrobe, title: 'gatebreaker' } };
  const fetch = async (url) => ({ ok: true, status: 200, json: async () => answers[url.replace(/^https?:\/\/[^/]+/, '')] });
  const flow = AccountFlow({ io: { fetch }, storage });
  await flow.start();
  assert.equal(await flow.equip('gatebreaker'), true);
  assert.equal(flow.note, 'Wearing Gatebreaker.');
});

test('COLLECTIONS-II the part draws alone too - a host with no flow lists the catalogue and holds nothing', () => {
  globalThis.document = undefined;
  resetWardrobePart();
  const root = el('div');
  drawWardrobePart(root, () => {}, { el, divider: (t) => el('h4', null, t), doc, now: () => AFTER }, 'icon', null);
  assert.equal(cls(root, 'coll-acct').length, 0);
  assert.equal(cls(root, 'coll-row').length, ICONS.length);
  assert.ok(cls(root, 'coll-row').every((r) => !r.classList.contains('held')));
});
