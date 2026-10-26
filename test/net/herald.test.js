// HERALD — THE PATREON TIER BETWEEN DISCIPLE AND HIEROPHANT (2026-10-01).
//
// Mac, sending his Patreon tiers for PATREON-LINK: "Herald doesnt exist ingame yet", then "you'll need to develop the
// herald title/glyph". No colour or shape was named, so it is the tiers' kind - TITLE-N's law: one flat colour, the
// glyph a stroked shape in that colour - in AZURE, heraldry's own blue, with the herald's trumpet and its swallowtail
// banner for the glyph (ui/playerBadge.js says what was tried beside it). It is held by its pledge (PATREON_TIERS maps
// Mac's Herald tier to it) and by HERALD_HANDLES for a Herald Mac names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from '../fakeRoom.mjs';
import { TITLES, GLYPHS, claimsValid, mintToken, verifyToken, importPublicKeyB64 } from '../../src/net/identityToken.js';
import {
  TITLE_TEXT, TITLE_RGBA, TITLE_GRADIENT, TITLE_EDGE, GLYPH_RGBA, GLYPH_GRADIENT, GLYPH_DETAIL, GLYPH_MARK, GLYPH_PATH,
  GLYPH_STROKE, FONT_GLYPH_MIN, FONT_GLYPH_MAX, cssRgba, titleBadge, glyphBadges, glyphSvgNode, titlePaint, badgeCss,
} from '../../src/ui/playerBadge.js';
import { GLYPH_LABEL } from '../../src/ui/enhanced/enhancedAccount.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';
import { isStaff } from '../../src/net/staffCommands.js';
import { titlesHeld, glyphsOf, equipRefusal, titleWorn, TIER_LISTS, TIER_GLYPH } from '../../server-account/src/titles.js';
import { PATREON_TITLES, patreonTierMap } from '../../server-account/src/patreon.js';
import { readBadge, RELAY_VERSION } from '../../src/net/wire.js';
import { createNameLayer } from '../../src/ui/nameLayer.js';
import { RemotePlayers, PEER_HEIGHT } from '../../src/net/remotePlayers.js';
import { perspective, mirrorProjectionX, lookAt } from '../../src/world/mat4.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
/** The Worker's config as it reads it: every handle list, and the Patreon tiers. */
const ENV = { ...Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]])), PATREON_TIERS: v('PATREON_TIERS') };
const HERALD_TIER = '29666234';   // Mac's Herald tier: its Join link's `rid`
const AFTER = 1_900_000_000;      // first played long after Founder's cutoff, so no row below holds Founder by accident
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });
const LATER = AFTER + 30 * 86_400;   // past the sprout's two weeks, so the only glyph is the grant's

/** A colour's hue in degrees, HSV. */
const hueOf = ([r, g, b]) => {
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return 0;
  return max === r ? 60 * (((g - b) / d + 6) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
};

/** A path's corners, one list per shape (penitent.test.js's reading, for M L H V Z). */
const shapesOf = (d) => d.split(/(?=M)/).map((sub) => {
  const pts = [];
  let x = 0, y = 0;
  for (const [, cmd, args] of sub.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (cmd === 'M' || cmd === 'L') [x, y] = n;
    else if (cmd === 'H') [x] = n;
    else if (cmd === 'V') [y] = n;
    else continue;
    pts.push([x, y]);
  }
  return pts;
});

// ── the fake document (penitent.test.js's shape) ──
function fakeNode(tag, doc, ns = null) {
  const n = {
    tagName: tag.toUpperCase(), ns, children: [], parent: null, attrs: {}, writes: 0,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    setAttribute(k, val) { n.attrs[k] = val; },
    remove() { n.removed = true; },
  };
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (x) => { text = String(x); n.children.length = 0; } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (x) => { cls = String(x); } });
  n.style = new Proxy({}, { set(t, k, x) { t[k] = x; n.writes++; doc.writes++; return true; } });
  return n;
}
function fakeDocument() {
  const doc = { writes: 0 };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.createElementNS = (ns, tag) => fakeNode(tag, doc, ns);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls) => {
  if ((n.className ?? '').split(' ').includes(cls)) return n;
  for (const c of n.children) { const f = find(c, cls); if (f) return f; }
  return null;
};

// ── THE VOCABULARY AND ITS FACE ─────────────────────────────────────

test('HERALD vocabulary: the title and the glyph join the closed lists last, the word "Herald"; one flat AZURE - blue, apart from the moderator\'s shield and the Apostle\'s violet, no other title\'s colour - and the glyph in the title\'s own colour, read from it; no gradient, no edge, no detail; a classic mark of its own (mutants: the glyph in another colour; a mark another glyph has; the colour the shield\'s)', () => {
  assert.equal(TITLES[9], 'herald', 'the vocabulary\'s newest of main\'s, after the Gatebreaker - the seats\' five after it since the merge of the Seats arc (SEAT1c), and ARENA4\'s Grand Champion and Arena Champion after those (the pin reads past them)');
  assert.equal(GLYPHS[9], 'herald', 'after the penitent\'s - the seats\' four after it (SEAT1c), and ARENA4\'s laurel after those');
  assert.equal(TITLE_TEXT.herald, 'Herald');
  const azure = TITLE_RGBA.herald;
  assert.equal(cssRgba(azure), '#4f7dff');
  assert.ok(azure[2] > azure[1] && azure[1] > azure[0], 'blue, then green, then red: an azure');
  const hue = hueOf(azure);
  assert.ok(hue > 215 && hue < 240, `an azure's hue: ${hue.toFixed(1)}`);
  assert.ok(Math.abs(hue - hueOf(GLYPH_RGBA.mod)) > 10, 'not the moderator\'s shield blue');
  assert.ok(Math.abs(hue - hueOf(TITLE_RGBA.apostle)) > 10, 'nor the Apostle\'s violet');
  assert.equal(new Set(TITLES.map((t) => cssRgba(TITLE_RGBA[t]))).size, TITLES.length, 'no two titles share a colour');
  assert.equal(GLYPH_RGBA.herald, azure, 'the trumpet in the title\'s own azure - the two halves of one grant cannot drift');
  assert.equal(TITLE_GRADIENT.herald, undefined, 'a tier\'s one flat colour, as TITLE-N\'s');
  assert.equal(TITLE_EDGE.herald, undefined);
  assert.equal(GLYPH_GRADIENT.herald, undefined);
  assert.equal(GLYPH_DETAIL.herald, undefined);
  assert.equal(GLYPH_STROKE.herald, true, 'a stroked shape, as the tiers\' flame, book and crown');
  assert.equal(GLYPH_MARK.herald, '<', 'the bell\'s flare');
  const marks = GLYPHS.map((g) => GLYPH_MARK[g]);
  assert.equal(new Set(marks).size, marks.length, 'a classic mark of its own');
  assert.ok(GLYPH_MARK.herald.charCodeAt(0) >= FONT_GLYPH_MIN && GLYPH_MARK.herald.charCodeAt(0) <= FONT_GLYPH_MAX, 'inside the font');
  assert.equal(GLYPH_LABEL.herald, 'Herald', 'named on the account card');
  const badge = titleBadge({ title: 'herald' });
  assert.deepEqual({ text: badge.text, rgba: badge.rgba, gradient: badge.gradient, edge: badge.edge }, { text: 'Herald', rgba: azure, gradient: null, edge: null });
  assert.deepEqual(titlePaint(badge).color, '#4f7dff', 'painted in its one colour');
  assert.deepEqual(readBadge({ title: 'herald', glyphs: ['herald'] }), { title: 'herald', glyphs: ['herald'] }, 'the wire keeps it');
  assert.deepEqual(glyphBadges({ glyphs: ['herald', 'disciple'] }).map((b) => b.key), ['disciple', 'herald'], 'drawn in the vocabulary\'s order');
});

test('HERALD the glyph\'s shape: the herald\'s trumpet - a mouthpiece, the tube, the bell flaring right - and the swallowtail banner hanging from the tube, all inside the box with the stroke round it (mutants: the bell flaring back; the banner above the tube; the notch filled)', () => {
  const shapes = shapesOf(GLYPH_PATH.herald);
  assert.equal(shapes.length, 4, 'mouthpiece, tube, bell, banner');
  const [mouth, tube, bell, banner] = shapes;
  const half = 1.8 / 2;   // the widest stroke any face draws (the chat's 1.8)
  for (const s of shapes) for (const [x, y] of s) assert.ok(x - half >= 0 && x + half <= 16 && y - half >= 0 && y + half <= 16, `inside the 16x16 box with its stroke: ${x},${y}`);
  const xs = (s) => s.map((p) => p[0]), ys = (s) => s.map((p) => p[1]);
  const tubeY = tube[0][1];
  assert.equal(tube[1][1], tubeY, 'the tube is level');
  assert.ok(Math.min(...ys(mouth)) < tubeY && Math.max(...ys(mouth)) > tubeY && Math.max(...xs(mouth)) <= Math.min(...xs(tube)), 'the mouthpiece across the tube\'s left end');
  // the bell: its apex at the tube's right end, its mouth a vertical edge further right, taller than the mouthpiece
  const apex = bell[0];
  assert.deepEqual(apex, tube[1], 'the bell grows out of the tube\'s end');
  const mouthEdge = bell.slice(1);
  assert.ok(mouthEdge.every(([x]) => x > apex[0] + 4), 'flaring RIGHT, away from the mouthpiece');
  assert.equal(mouthEdge[0][0], mouthEdge[1][0], 'its mouth an upright edge');
  assert.ok(span(ys(mouthEdge)) > 2 * span(ys(mouth)), 'the bell\'s mouth wider than the mouthpiece - a trumpet, not a pipe');
  assert.ok(Math.min(...ys(mouthEdge)) < tubeY && Math.max(...ys(mouthEdge)) > tubeY, 'centred on the tube');
  // the banner hangs below the tube, between the mouthpiece and the bell, with the swallowtail notch at its foot
  assert.ok(banner.every(([, y]) => y >= tubeY), 'hanging from the tube, never above it');
  assert.ok(Math.min(...xs(banner)) > Math.max(...xs(mouth)) && Math.max(...xs(banner)) < apex[0], 'between the mouthpiece and the bell');
  const foot = banner.filter(([, y]) => y > tubeY + 4);
  assert.equal(foot.length, 3, 'two tails and the notch between them');
  const [left, notch, right] = foot;
  assert.equal(left[1], right[1], 'the tails level');
  assert.ok(notch[1] < left[1] - 1, 'the notch cut up into the banner');
  assert.equal(notch[0], (left[0] + right[0]) / 2, 'in the banner\'s middle');
  assert.ok(left[1] - tubeY > 1.5 * (right[0] - left[0]), 'a banner that hangs: longer than it is wide');
});
const span = (a) => Math.max(...a) - Math.min(...a);

// ── THE GRANT ───────────────────────────────────────────────────────

test('HERALD grant: a Herald pledge holds the title and its glyph by PATREON_TIERS (Mac\'s Herald tier), and HERALD_HANDLES grants both by name - empty, nobody yet; a guest, a lapsed pledge and every other tier hold none; no staff command rides it (mutants: the glyph without the title; the Herald tier unmapped; the list crossed with Penitent\'s)', () => {
  assert.equal(TIER_LISTS.herald, 'HERALD_HANDLES');
  assert.equal(TIER_GLYPH.herald, 'herald');
  assert.equal(v('HERALD_HANDLES'), '', 'nobody by name yet');
  assert.ok(PATREON_TITLES.includes('herald'), 'a Patreon tier may grant it');
  assert.equal(patreonTierMap(ENV).get(HERALD_TIER), 'herald', 'Mac\'s Herald tier grants it');
  const pledged = row('Herold', { patreon_user: '777', patreon_tiers: HERALD_TIER, patreon_status: 'active_patron' });
  assert.deepEqual(titlesHeld(pledged, ENV), ['herald'], 'a Herald patron holds Herald, and nothing else');
  assert.deepEqual(glyphsOf(pledged, ENV, LATER), ['herald'], 'with its trumpet');
  assert.equal(equipRefusal('herald', pledged, ENV), null, 'theirs to wear');
  assert.equal(titleWorn({ ...pledged, title: 'herald' }, ENV), 'herald');
  assert.equal(titleWorn({ ...pledged, title: 'herald', patreon_status: 'former_patron' }, ENV), undefined, 'a pledge that ended stops being worn');
  assert.deepEqual(titlesHeld({ ...pledged, patreon_tiers: '29666211' }, ENV), ['disciple'], 'the Disciple tier is the Disciple\'s');
  assert.deepEqual(titlesHeld({ ...pledged, patreon_tiers: '29701293' }, ENV), [], 'the Supporter tier holds none');
  assert.deepEqual(titlesHeld({ ...pledged, patreon_tiers: '29666221' }, ENV), ['hierophant'], 'the Hierophant tier is the Hierophant\'s (HIEROPHANT-TIER), never a Herald');
  assert.deepEqual(titlesHeld({ ...pledged, handle: null }, ENV), [], 'a guest holds none');
  const named = { ...ENV, HERALD_HANDLES: 'Crier' };
  for (const h of ['Crier', 'crier', 'CRIER']) {
    assert.deepEqual(titlesHeld(row(h), named), ['herald'], `${h}: by name, case-folded`);
    assert.deepEqual(glyphsOf(row(h), named, LATER), ['herald']);
  }
  for (const h of ['Diggleborf', 'Dutchess', 'SirMcMobdon', 'SquidKamer', 'Stranger']) {
    assert.ok(!titlesHeld(row(h), named).includes('herald'), `${h} does not hold it`);
    assert.equal(equipRefusal('herald', row(h), named), 'not-held');
  }
  assert.equal(isStaff(['herald']), false, 'a title and a glyph, not the staff\'s commands');
});

test('HERALD token and relay: a token may carry the title and the glyph and verifies, every glyph at once still fits, and the relay - world138, the one that knows the word - reads both out of the signature onto the peer\'s row (mutants: the vocabulary without it, so the relay refuses the token)', async () => {
  assert.equal(RELAY_VERSION, 'world267', 'PIN MOVED: world267, KETCH-WORDS (the Sky-Ketch herald cards reworded, the ship no longer she; NOT YET DEPLOYED); PIN MOVED: world266, AUDIT KETCH II (the airship raid: the whole state word carries the wave to five, a sweep by the ship says sw, the number of a voyage is a receipt bound, the last minutes of her crews forty-five, a fight lost after two minutes, the receipts of a fall told before her record goes; world265 on its branch, renumbered past GATE-COURTS at the merge; NOT YET DEPLOYED); PIN MOVED: world265, GATE-COURTS (the night of a gate held in courts of fifty, each seated by the book of the first; NOT YET DEPLOYED); PIN MOVED: world264, REWARD-KILLS (a staff event reward is earned by three kills alone; world258 then world262 on its branch, renumbered past world258-world263 at the merges; NOT YET DEPLOYED); PIN MOVED: world263, HIBERNATE (a quiet cell sleeps, a freeze or mute asks its lease with the door off; world260/world261 on its branch, renumbered past THE FOLD\'s world260, #1281\'s world261 and #1238\'s world262 at the merges); PIN MOVED: world261, EVENT-RULES, BOSS-TRAITS and RAID5 (a realm keeps a death down two minutes for a Resurrect by a friend, SD_REZ_MS; a foe record carries its boss traits bt, its wrath bw and the leader of a raid rl; NOT YET DEPLOYED); PIN MOVED: world259, ASK-LONGER (the word of the company open 30 s, net/eliteGates/egRun.js EG_ASK_MS; world257 on its branch, renumbered past STAFF-EVENT BOSS and KETCH-LONGER at the merge; NOT YET DEPLOYED); PIN MOVED: world258, KETCH-LONGER (the raid retuned: five Watch waves, the wire takes a wave to five; world257 on its branch, renumbered past STAFF-EVENT BOSS at the merge; NOT YET DEPLOYED); PIN MOVED: world257, STAFF-EVENT BOSS (the mini boss stood again when lost, called each time the meter fills, an exact health hp; NOT YET DEPLOYED); PIN MOVED: world256, STAFF-EVENT (staff events: the hub book, a place kill meter, the mini boss; world255 on its branch, renumbered past KETCH at the merge; NOT YET DEPLOYED); PIN MOVED: world255, KETCH (the sky-ketch frame kt in the room of a crew ship, validKetchIn and validKetchOut; world253 on its branch, renumbered past ROCKET1\'s world253 and AUDIT FOE-KEEPS\' world254 at the merge; NOT YET DEPLOYED); PIN MOVED: world254, AUDIT FOE-KEEPS (the open zone kill credit: the word of a fighter that left the zone dying, dd; NOT YET DEPLOYED); PIN MOVED: world253, ROCKET1 (the live event word `rocket`; NOT YET DEPLOYED); PIN MOVED: world252, DECK-POSE (a pose carries its place aboard a boat, validPose `ab`; NOT YET DEPLOYED); PIN MOVED: world251, AUDIT MIXED-PAIR / SPELL-HAND (world249 on its branch, renumbered past STAFF-PANEL5-MONSTERS and HERALD-CARDS at the merge - validPose carries `ah`, the left hand of a pair struck last, so the peers draw a pair in both hands); PIN MOVED: world250, HERALD-CARDS (world243 on its branch, renumbered past PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES, STAFF-PANEL5, AUDIT EG-FALL and STAFF-PANEL5-MONSTERS at the merge - every herald post one card of its family - its title, its facts as fields, its colour - and each family a thread of its own in the world events channel, the relay settings gateThread, serpentThread, sdThread and egThread; net/herald/heraldCard.js joins the bundle); PIN MOVED: world249, STAFF-PANEL5-MONSTERS (the staff panel Monster watch counts monsters whatever grantStrip says, and its batch says measured; NOT YET DEPLOYED; world248 on its branch, renumbered past AUDIT EG-FALL at the merge); PIN MOVED: world248, AUDIT EG-FALL (world240 on its branch, renumbered past GUILD-CAP, SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES and STAFF-PANEL5 at the merge - a felled Elite Breach lord lies where it fell - net/eliteGates/egLords.js egLordHit stops its walk at its fall, egStop; no word changed); PIN MOVED: world247, STAFF-PANEL5 (the staff panel relay release: follow, Message on screen, the feeds, the staff cut, hidden staff, freeze and the staff chat; NOT YET DEPLOYED); PIN MOVED: world246, SEA VENTURES (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges - the Eltheric Ocean ventures, one relay: the hub reads a vault of the deep by its cell, a fall signs its room, the referee judges a broadside); PIN MOVED: world245, AUDIT PISTOLET (the siege referee knows the top of the Dwarven Pistolet - SIEGE_PISTOLET - and a duel shot from the off hand of a pair carries the DUAL terms, `off` on a shot as on a swing; world242 on its branch, renumbered past LEASE1, PARTY-PING and SPAWN-THIN at the merge); PIN MOVED: world244, SPAWN-THIN (the overworld keep drops a quarter of the spawn band; world242 on its branch, renumbered past PARTY-PING world243 at the merge); PIN MOVED: world243, PARTY-PING (validPartyPose carries pg); PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay\'s bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR\'s world224, GAUNTLET-SLAIN\'s world225 and LORD-SHARES\' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look\'s `lg`, the On foot Layered Gearing Skin; the voice pass\'s words in the relay\'s own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords\' blows fair and whole, spec law 10 THE BROKEN WAY, the ways as proven); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main\'s INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King\'s Gambit - a gambit frame, four files more in the bundle; KG6: the gold table\'s stakes and a rated game\'s signed result; world203 on its branch, renumbered past FIVE-ASKS\'s world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE\'s world201 and FIVE-ASKS\'s world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub\'s hello and leave without a walk of every socket; a busy refusal\'s token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc\'s lane 3 - world186 on its branch, renumbered past SD-HERALD\'s world186 and WAGONS1\'s world187 at the merge); PIN MOVED: world185, INT7-INT10 (the INTEGRITY arc\'s lane 2 - world183, then world184, on its branch, renumbered past CHAP4c\'s world183 and PERF-RELAY1\'s world184 at the merges); PIN MOVED: world183, CHAP4c (the chapters\' seats\' titles on the token - past THE WROTHGARIAN ZONE\'s world177, TAVERN CARDS\' world178, HOURS-FIRST\'s world179, TAVERN-TABLES\' world180, TV-BEYOND\'s world181 and CARDS10\'s world182 at the merges); HERALD moved it on (world138; LOOT7 after it, world139; WB11 and GATE-HEAL after that, world140; CLIMB5 and CLIMB6, world141 - missed here at that bump; FRIENDS-SYNC, world142; ELITE FOES, world143; the Seats arc\'s seven after it, world144-world150; WB12 after them, world151; GLYPH-WEAR, world152; REVENANT-WIRE, world153; BROKER-CAGE, world154; ARENA4 after them, world155 - world142 on its branch, renumbered past main\'s at the merge; AEGIS, world160; GUILD2, world161 - no wire change, past the DFO integration\'s world157-world159 and AEGIS\'s world160; PRIMARCH, world162; SUNBABY1, world163 - a live event\'s word; PARTY-LEAD, world164 - the hub\'s party.lead act; SERPENT1, world165 - the serpent frame; SERPENT2, world166 - the serpent herald; SHADOW-CLOAK, world167 - the cloak\'s word; SERAPH-WINGS, world168 - the wings word; AUDIT ARENA-LADDER, world169 - the arena ladder audit; FEUD, world170 - the foe record\'s wind-ups and a revenant\'s fields; CRYSTAL-FIST, world171 - the Crystal Fist\'s words; WATCH-FIX, world172 - the watch record names its resident; SERPENT3, world173 - the sea serpent brain, world171 on its branch renumbered past CRYSTAL-FIST\'s and WATCH-FIX\'s at the merges; LEGACY7, world174 - the house on the token and the row and two players\' wed frame, world172 on its branch renumbered past WATCH-FIX\'s and SERPENT3\'s at the merge; TEXT-F1, world175 - the words a player types starred; SUPER-DUNGEONS, world176 - a re-laid dungeon\'s room of its own and the Super dungeon\'s frame, world171 on its branch renumbered past CRYSTAL-FIST\'s at one merge, past WATCH-FIX\'s, SERPENT3\'s and LEGACY7\'s at the next and past TEXT-F1\'s at the one after): an older relay refuses a token carrying the word');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-hd', n: 'Herold', k: 'linked', t: 'herald', g: ['sprout', 'herald'] }, kp.privateKey, { subtle, nowS });
  const r = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(r.ok, r.why);
  assert.equal(r.claims.t, 'herald');
  assert.deepEqual(r.claims.g, ['sprout', 'herald']);
  assert.equal(claimsValid({ v: 1, s: 'acct-hd', n: 'Herold', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS] }), true, 'every glyph at once still fits');
  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'Herold', title: 'herald', glyphs: ['herald'] });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((m) => m.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.equal(seen.title, 'herald');
  assert.deepEqual(seen.glyphs, ['herald']);
});

// ── THE FACES ───────────────────────────────────────────────────────

test('HERALD drawn: over a head the word in its azure and the trumpet beside the name; the glyph stroked in currentColor at the face\'s own stroke; the account card\'s button and chip in the azure from the skin (mutants: the trumpet filled)', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  layer.render({ points: [{ id: 'peer-0001', name: 'Herold', x: 400, y: 300, scale: 1, title: 'herald', glyphs: ['herald'] }] });
  const node = layer.tagFor('peer-0001').node;
  const title = find(node, 'dfname-title');
  assert.equal(title.textContent, 'Herald');
  assert.equal(title.style.color, '#4f7dff');
  const glyphs = find(node, 'dfname-glyphs');
  assert.equal(glyphs.children.length, 1, 'the trumpet beside the name');
  const [g] = glyphBadges({ glyphs: ['herald'] });
  const svg = glyphSvgNode(doc, g, 'x-glyph', 1.6);
  assert.equal(svg.style.color, '#4f7dff');
  assert.equal(svg.children.length, 1, 'one shape - no detail, no gradient');
  const [path] = svg.children;
  assert.equal(path.attrs.d, GLYPH_PATH.herald);
  assert.equal(path.attrs.fill, 'none');
  assert.equal(path.attrs.stroke, 'currentColor');
  assert.equal(path.attrs['stroke-width'], '1.6');
  for (const rule of ['.card button.acttitle.tl-herald { color: #4f7dff; }', '.card .acctglyph.gl-herald .acctglyphart { color: #4f7dff; }']) {
    assert.ok(badgeCss().includes(rule), rule);
    assert.ok(ENHANCED_CSS.includes(rule), `and it reached the skin: ${rule}`);
  }
});

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
const FONT = { fnt: FNT, tex: 'FONT-TEX' };
const recorder = () => {
  const runs = [];
  return { runs, drawScreenQuad: () => {}, drawScreenQuadRun: (tex, qs, color) => runs.push({ quads: qs, color }) };
};

test('HERALD the classic face: the name run carries the bell\'s mark, and the word is drawn in its azure (mutants: the mark dropped)', () => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-0001', name: 'HEROLD', title: 'herald', glyphs: ['herald'], shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }],
    (q) => [q.x, q.y, q.z], { bodyHeight: () => PEER_HEIGHT });
  const r = recorder();
  const drawn = rp.drawNames(r, FONT, mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)), lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]), 1600, 900, [0, 1.7, 0], 1, (q) => [q.x, q.y, q.z]);
  assert.equal(drawn, 2, 'the name and the title');
  const name = r.runs[0];
  assert.equal(name.quads.length, 'HEROLD<'.length, 'the name run carries the bell\'s mark');
  const word = r.runs.find((run) => run.quads.length === 'Herald'.length && run.color?.[2] === 1);
  assert.ok(word, 'the word drawn');
  assert.deepEqual([...word.color].map((c) => +c.toFixed(2)), [0.31, 0.49, 1, 1], 'in the azure');
});
